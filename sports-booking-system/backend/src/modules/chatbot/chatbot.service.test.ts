import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { TestContext } from "node:test";
import { ValidationError } from "../../shared/errors/AppError.js";

let caseId = 0;

async function loadService(
  t: TestContext,
  deps: {
    chatbotRepository?: Partial<Record<string, (...args: any[]) => any>>;
    bookingService?: Partial<Record<string, (...args: any[]) => any>>;
    provider?: any;
    tools?: any[];
    executeTool?: (...args: any[]) => any;
  } = {}
) {
  t.mock.module("./chatbot.repository.js", {
    namedExports: {
      chatbotRepository: {
        findConversationForUser: async () => null,
        getConversationMessages: async () => [],
        createConversation: async () => ({ id: "conv1" }),
        appendMessage: async () => {},
        findPendingBookingForUser: async () => null,
        markPendingBookingStatus: async () => {},
        ...deps.chatbotRepository
      }
    }
  });
  t.mock.module("../bookings/booking.service.js", {
    namedExports: {
      bookingService: {
        quote: async () => ({ ok: true }),
        checkout: async () => ({ ok: true }),
        ...deps.bookingService
      }
    }
  });
  t.mock.module("./providers/llmProviderFactory.js", {
    namedExports: { getLlmProvider: () => deps.provider ?? { createConversation: () => ({ appendToolResults() {} }), nextTurn: async () => ({ type: "text", text: "ok" }) } }
  });
  t.mock.module("./chatbot.knowledge.js", { namedExports: { buildSystemPrompt: () => "system" } });
  t.mock.module("./chatbot.tools.js", {
    namedExports: {
      toolsForAuthState: () => deps.tools ?? [],
      executeTool: deps.executeTool ?? (async () => ({ isError: false, result: {} }))
    }
  });

  caseId += 1;
  const mod = await import(`./chatbot.service.js?case=${caseId}`);
  return mod.chatbotService as typeof import("./chatbot.service.js").chatbotService;
}

function pendingFixture(overrides: Partial<any> = {}) {
  return {
    id: "pb1",
    status: "PENDING",
    expiresAt: new Date(Date.now() + 60_000),
    quotePayload: { courtId: "c1" },
    ...overrides
  };
}

describe("chatbot.service confirmBooking", () => {
  it("throws NotFoundError when the pending booking proposal does not exist", async (t) => {
    const chatbotService = await loadService(t, {
      chatbotRepository: { findPendingBookingForUser: async () => null }
    });

    await assert.rejects(() => chatbotService.confirmBooking("u1", "pb1"));
  });

  it("throws ValidationError when the proposal is no longer PENDING", async (t) => {
    const chatbotService = await loadService(t, {
      chatbotRepository: { findPendingBookingForUser: async () => pendingFixture({ status: "CONFIRMED" }) }
    });

    await assert.rejects(() => chatbotService.confirmBooking("u1", "pb1"));
  });

  it("expires a stale proposal instead of booking it", async (t) => {
    let markedStatus: string | null = null;
    const chatbotService = await loadService(t, {
      chatbotRepository: {
        findPendingBookingForUser: async () => pendingFixture({ expiresAt: new Date(Date.now() - 1000) }),
        markPendingBookingStatus: async (_id: string, status: string) => {
          markedStatus = status;
        }
      }
    });

    await assert.rejects(() => chatbotService.confirmBooking("u1", "pb1"));
    assert.equal(markedStatus, "EXPIRED");
  });

  it("re-quotes before checkout and confirms the proposal on success", async (t) => {
    let quoteCalledWith: any = null;
    let checkoutCalledWith: any = null;
    let markedStatus: string | null = null;
    const chatbotService = await loadService(t, {
      chatbotRepository: {
        findPendingBookingForUser: async () => pendingFixture({ quotePayload: { courtId: "c1", slots: [] } }),
        markPendingBookingStatus: async (_id: string, status: string) => {
          markedStatus = status;
        }
      },
      bookingService: {
        quote: async (_userId: string, payload: any) => {
          quoteCalledWith = payload;
          return { ok: true };
        },
        checkout: async (_userId: string, payload: any) => {
          checkoutCalledWith = payload;
          return { bookingId: "bk1" };
        }
      }
    });

    const result = await chatbotService.confirmBooking("u1", "pb1");

    assert.deepEqual(quoteCalledWith, { courtId: "c1", slots: [] });
    assert.deepEqual(checkoutCalledWith, { courtId: "c1", slots: [] });
    assert.equal(markedStatus, "CONFIRMED");
    assert.deepEqual(result, { bookingId: "bk1" });
  });

  it("cancels the proposal when checkout fails with a known AppError (price/availability drift)", async (t) => {
    let markedStatus: string | null = null;
    const chatbotService = await loadService(t, {
      chatbotRepository: {
        findPendingBookingForUser: async () => pendingFixture(),
        markPendingBookingStatus: async (_id: string, status: string) => {
          markedStatus = status;
        }
      },
      bookingService: {
        checkout: async () => {
          throw new ValidationError("San da duoc dat boi nguoi khac");
        }
      }
    });

    await assert.rejects(() => chatbotService.confirmBooking("u1", "pb1"));
    assert.equal(markedStatus, "CANCELLED");
  });

  it("leaves the proposal status untouched when checkout fails with an unexpected error", async (t) => {
    let markCalled = false;
    const chatbotService = await loadService(t, {
      chatbotRepository: {
        findPendingBookingForUser: async () => pendingFixture(),
        markPendingBookingStatus: async () => {
          markCalled = true;
        }
      },
      bookingService: {
        checkout: async () => {
          throw new Error("unexpected boom");
        }
      }
    });

    await assert.rejects(() => chatbotService.confirmBooking("u1", "pb1"));
    assert.equal(markCalled, false);
  });
});

describe("chatbot.service sendMessage tool-call guard", () => {
  it("refuses a second propose_booking call within the same turn once one is already pending", async (t) => {
    let executeToolCalls = 0;
    let turnIndex = 0;
    const provider = {
      createConversation: () => ({ appendToolResults(_results: any[]) {} }),
      nextTurn: async () => {
        turnIndex += 1;
        if (turnIndex === 1) {
          return {
            type: "tool_calls" as const,
            calls: [
              { id: "c1", name: "propose_booking", input: {} },
              { id: "c2", name: "propose_booking", input: {} }
            ]
          };
        }
        return { type: "text" as const, text: "done" };
      }
    };

    const chatbotService = await loadService(t, {
      provider,
      tools: [{ name: "propose_booking", description: "", inputSchema: {} }],
      executeTool: async () => {
        executeToolCalls += 1;
        return { isError: false, result: { summary: { pendingBookingId: "pb1" } } };
      }
    });

    const result = await chatbotService.sendMessage(undefined, { message: "dat san giup toi" });

    assert.equal(executeToolCalls, 1);
    assert.equal(result.reply, "done");
    assert.equal(result.pendingBooking?.pendingBookingId, "pb1");
  });
});

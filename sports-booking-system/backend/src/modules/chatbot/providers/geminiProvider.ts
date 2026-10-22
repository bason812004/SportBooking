import { GoogleGenAI, type Content, type FunctionDeclaration, type Part } from "@google/genai";
import { env } from "../../../config/env.js";
import { AppError } from "../../../shared/errors/AppError.js";
import type { ChatHistoryTurn } from "../chatbot.types.js";
import type { LlmConversationState, LlmProvider, LlmToolResultInput, LlmTurnResult } from "./llmProvider.types.js";

let geminiClient: GoogleGenAI | null = null;

function getClient() {
  if (!env.GEMINI_API_KEY) {
    throw new AppError(503, "CHATBOT_UNAVAILABLE", "Chatbot tam thoi khong kha dung, vui long thu lai sau");
  }
  if (!geminiClient) {
    geminiClient = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY, httpOptions: { timeout: env.CHATBOT_TIMEOUT_MS } });
  }
  return geminiClient;
}

function toGeminiRole(role: ChatHistoryTurn["role"]): "user" | "model" {
  return role === "assistant" ? "model" : "user";
}

class GeminiConversationState implements LlmConversationState {
  system: string;
  contents: Content[];
  // Real function-call ids from the last model turn, in the same order as the
  // tool calls handed to the orchestration loop — Gemini often omits `id`, in
  // which case the server matches function responses to calls by order instead.
  lastCallIds: Array<string | undefined> = [];

  constructor(system: string, history: ChatHistoryTurn[], newMessage: string) {
    this.system = system;
    this.contents = [
      ...history.map((turn) => ({ role: toGeminiRole(turn.role), parts: [{ text: turn.content }] })),
      { role: "user" as const, parts: [{ text: newMessage }] }
    ];
  }

  appendToolResults(results: LlmToolResultInput[]): void {
    const responseParts: Part[] = results.map((r, index) => ({
      functionResponse: {
        id: this.lastCallIds[index],
        name: r.toolName,
        response: r.isError ? { error: r.content } : { output: r.content }
      }
    }));
    this.contents.push({ role: "user", parts: responseParts });
  }
}

export const geminiProvider: LlmProvider = {
  createConversation(system, history, newMessage) {
    return new GeminiConversationState(system, history, newMessage);
  },

  async nextTurn(state, tools): Promise<LlmTurnResult> {
    const s = state as GeminiConversationState;
    const client = getClient();

    const functionDeclarations: FunctionDeclaration[] = tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      parametersJsonSchema: tool.input_schema
    }));

    const response = await client.models.generateContent({
      model: env.GEMINI_MODEL,
      contents: s.contents,
      config: {
        systemInstruction: s.system,
        maxOutputTokens: env.CHATBOT_MAX_OUTPUT_TOKENS,
        tools: [{ functionDeclarations }],
        // gemini-3.6-flash rejects thinkingBudget: 0 (INVALID_ARGUMENT) — this model
        // cannot fully disable thinking, so use the smallest budget that is accepted
        // to keep tool-calling latency low without burning excess thinking tokens.
        thinkingConfig: { thinkingBudget: 512 }
      }
    });

    const parts = response.candidates?.[0]?.content?.parts ?? [];
    s.contents.push({ role: "model", parts });

    const functionCalls = response.functionCalls;
    if (!functionCalls || functionCalls.length === 0) {
      s.lastCallIds = [];
      return { type: "text", text: (response.text ?? "").trim() };
    }

    s.lastCallIds = functionCalls.map((call) => call.id);

    return {
      type: "tool_calls",
      calls: functionCalls.map((call, index) => ({
        id: call.id ?? `call_${index}`,
        name: call.name ?? "",
        input: call.args ?? {}
      }))
    };
  }
};

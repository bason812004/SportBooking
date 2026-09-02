import Anthropic from "@anthropic-ai/sdk";
import { env } from "../../../config/env.js";
import { AppError } from "../../../shared/errors/AppError.js";
import type { ChatHistoryTurn } from "../chatbot.types.js";
import type { LlmConversationState, LlmProvider, LlmToolResultInput, LlmTurnResult } from "./llmProvider.types.js";

let anthropicClient: Anthropic | null = null;

function getClient() {
  if (!env.ANTHROPIC_API_KEY) {
    throw new AppError(503, "CHATBOT_UNAVAILABLE", "Chatbot tam thoi khong kha dung, vui long thu lai sau");
  }
  if (!anthropicClient) {
    anthropicClient = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, timeout: env.CHATBOT_TIMEOUT_MS });
  }
  return anthropicClient;
}

class AnthropicConversationState implements LlmConversationState {
  messages: Anthropic.MessageParam[];
  system: string;

  constructor(system: string, history: ChatHistoryTurn[], newMessage: string) {
    this.system = system;
    this.messages = [...history.map((turn) => ({ role: turn.role, content: turn.content })), { role: "user" as const, content: newMessage }];
  }

  appendToolResults(results: LlmToolResultInput[]): void {
    const toolResults: Anthropic.ToolResultBlockParam[] = results.map((r) => ({
      type: "tool_result",
      tool_use_id: r.callId,
      is_error: r.isError,
      content: r.content
    }));
    this.messages.push({ role: "user", content: toolResults });
  }
}

export const anthropicProvider: LlmProvider = {
  createConversation(system, history, newMessage) {
    return new AnthropicConversationState(system, history, newMessage);
  },

  async nextTurn(state, tools): Promise<LlmTurnResult> {
    const s = state as AnthropicConversationState;
    const client = getClient();

    const response = await client.messages.create({
      model: env.ANTHROPIC_MODEL,
      max_tokens: env.CHATBOT_MAX_OUTPUT_TOKENS,
      system: s.system,
      messages: s.messages,
      tools: tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        input_schema: tool.input_schema as Anthropic.Tool.InputSchema
      }))
    });

    s.messages.push({ role: "assistant", content: response.content });

    if (response.stop_reason !== "tool_use") {
      const text = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === "text")
        .map((block) => block.text)
        .join("\n")
        .trim();
      return { type: "text", text };
    }

    const toolUseBlocks = response.content.filter((block): block is Anthropic.ToolUseBlock => block.type === "tool_use");
    return {
      type: "tool_calls",
      calls: toolUseBlocks.map((block) => ({ id: block.id, name: block.name, input: block.input }))
    };
  }
};

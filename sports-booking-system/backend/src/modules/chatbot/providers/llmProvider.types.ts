import type { ChatHistoryTurn } from "../chatbot.types.js";
import type { ToolDefinition } from "../chatbot.tools.js";

export type LlmToolCall = { id: string; name: string; input: unknown };

export type LlmTurnResult = { type: "text"; text: string } | { type: "tool_calls"; calls: LlmToolCall[] };

export type LlmToolResultInput = { callId: string; toolName: string; isError: boolean; content: string };

export interface LlmConversationState {
  appendToolResults(results: LlmToolResultInput[]): void;
}

export interface LlmProvider {
  createConversation(system: string, history: ChatHistoryTurn[], newMessage: string): LlmConversationState;
  nextTurn(state: LlmConversationState, tools: ToolDefinition[]): Promise<LlmTurnResult>;
}

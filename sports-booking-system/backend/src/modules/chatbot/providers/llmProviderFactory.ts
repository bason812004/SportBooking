import { env } from "../../../config/env.js";
import { anthropicProvider } from "./anthropicProvider.js";
import { geminiProvider } from "./geminiProvider.js";
import type { LlmProvider } from "./llmProvider.types.js";

export function getLlmProvider(): LlmProvider {
  return env.CHATBOT_LLM_PROVIDER === "anthropic" ? anthropicProvider : geminiProvider;
}

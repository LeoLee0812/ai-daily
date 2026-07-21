// LLM 模型工厂（可切 provider）
// 默认走云雾（yunwu.ai）中转：一把 key 通 400+ 模型（DeepSeek / GPT / Claude / Gemini…），
// 默认模型 deepseek-v4-flash（便宜快、结构化稳定）。参考 media-studio/lib/llm.ts 的接入方式。
//
// 切换 provider：
//   - 默认（不设或 LLM_PROVIDER=yunwu）→ 云雾中转，改 LLM_MODEL 即可换任意云雾模型
//   - LLM_PROVIDER=deepseek → DeepSeek 官方直连（备用，需 DEEPSEEK_API_KEY）

import { createDeepSeek } from "@ai-sdk/deepseek";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";

export function getModel(): LanguageModel {
  const provider = process.env.LLM_PROVIDER || "yunwu";

  // DeepSeek 官方直连（备用）
  if (provider === "deepseek") {
    const deepseek = createDeepSeek({ apiKey: process.env.DEEPSEEK_API_KEY! });
    return deepseek(process.env.LLM_MODEL || "deepseek-chat");
  }

  // 云雾中转（默认）：各家都是 OpenAI 兼容接口，统一走 createOpenAICompatible
  const client = createOpenAICompatible({
    name: "yunwu",
    apiKey: process.env.YUNWU_API_KEY!,
    baseURL: process.env.YUNWU_API_BASE || "https://yunwu.ai/v1",
    // 必开：否则 generateObject 不下发 response_format，模型会返回裸文本导致解析为空
    supportsStructuredOutputs: true,
  });
  return client(process.env.LLM_MODEL || "deepseek-v4-flash");
}

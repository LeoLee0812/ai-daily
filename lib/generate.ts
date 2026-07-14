// 日报生成：DeepSeek 从候选素材里选 4-5 条，写成结构化日报（含 Leo 点评）

import { createDeepSeek } from "@ai-sdk/deepseek";
import { generateObject } from "ai";
import { z } from "zod";
import type { Candidate, DailyReport } from "./types";

const itemSchema = z.object({
  title: z.string().describe("条目标题，中文，信息密度高，可带一个转折/亮点"),
  body: z
    .string()
    .describe(
      "正文 2-4 段 markdown：发生了什么、关键数字/对比、对普通用户意味着什么。允许 **加粗**、- 列表",
    ),
  howTo: z
    .array(z.string())
    .describe("『怎么玩』可操作步骤，没有可操作性就给空数组"),
  links: z.array(z.string()).describe("从素材里挑 1-2 条最权威的原文链接"),
  comment: z
    .string()
    .describe("Leo 点评：一两句第一人称个人判断，口语化，敢下结论"),
});

const reportSchema = z.object({
  highlights: z
    .array(z.string())
    .min(4)
    .max(6)
    .describe("今日要点：每条一句话概括一个条目，含关键数字"),
  items: z.array(itemSchema).min(4).max(5),
  summary: z.string().describe("今日小结：两三句话串起全部条目，给出主线判断"),
});

const SYSTEM = `你是「Leo 的 AI 日报」主编。Leo 的人设：在读研究生 + 头部大厂实习 + 一人公司全栈开发者（OPC），每天用 Claude Code / DeepSeek 干活，关注 AI 工具怎么落地到个人生产力。

写作要求：
- 全程简体中文，克制使用 emoji（只在结构性位置）
- 只选真实素材里出现的新闻，不许编造事实、数字和链接；链接必须原样取自素材
- 优先选：模型/产品重大发布 > 对个人开发者可上手的工具 > 行业大事
- 点评要有 Leo 的个人视角：会不会用、值不值得跟、和自己工作流的关系；不要空话
- 避免 AI 腔：不用"值得注意的是""总的来说""赋能""重磅"这类词`;

export async function generateReport(
  date: string,
  candidates: Candidate[],
): Promise<DailyReport> {
  const deepseek = createDeepSeek({ apiKey: process.env.DEEPSEEK_API_KEY! });
  const model = deepseek(process.env.LLM_MODEL || "deepseek-chat");

  const material = candidates
    .slice(0, 60)
    .map(
      (c, i) =>
        `[${i + 1}] (${c.from}${c.source ? "/" + c.source : ""}) ${c.title}` +
        (c.summary ? `\n摘要: ${c.summary}` : "") +
        (c.url ? `\n链接: ${c.url}` : ""),
    )
    .join("\n\n");

  const { object } = await generateObject({
    model,
    schema: reportSchema,
    system: SYSTEM,
    prompt: `今天是 ${date}。以下是过去 24 小时的候选素材（共 ${candidates.length} 条），请选出最值得写的 4-5 条，生成今天的日报：\n\n${material}`,
  });

  return {
    date,
    highlights: object.highlights,
    items: object.items.map((it, i) => ({ rank: i + 1, ...it })),
    summary: object.summary,
    generatedAt: new Date().toISOString(),
    candidateCount: candidates.length,
  };
}

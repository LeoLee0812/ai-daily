// 日报生成 v2：两段式
// 第一段：DeepSeek 从候选素材里选 4-5 个选题
// 第二段：逐条抓原文全文，DeepSeek 深挖成完整条目；Leo 点评由人工填写
// 收尾：汇总生成今日要点与小结

import { createDeepSeek } from "@ai-sdk/deepseek";
import { generateObject } from "ai";
import { z } from "zod";
import type { Candidate, DailyItem, DailyReport } from "./types";
import { fetchArticleText } from "./sources";

const PERSONA = `你是「Leo 的 AI 日报」主编。Leo 的人设：在读研究生 + 头部大厂实习 + 一人公司全栈开发者（OPC），每天用 Claude Code / DeepSeek 干活，关注 AI 工具怎么落地到个人生产力。

写作要求：
- 全程简体中文，克制使用 emoji
- 只写素材里真实出现的事实、数字和链接，不许编造
- 避免 AI 腔：不用"值得注意的是""总的来说""赋能""重磅"这类词`;

function model() {
  const deepseek = createDeepSeek({ apiKey: process.env.DEEPSEEK_API_KEY! });
  return deepseek(process.env.LLM_MODEL || "deepseek-chat");
}

// ---------- 第一段：选题 ----------

const pickSchema = z.object({
  picks: z
    .array(
      z.object({
        index: z.number().describe("素材编号（方括号里的数字）"),
        angle: z.string().describe("这条的切入角度，一句话"),
      }),
    )
    .min(4)
    .max(5),
});

async function pickTopics(date: string, candidates: Candidate[]) {
  const material = candidates
    .slice(0, 80)
    .map(
      (c, i) =>
        `[${i + 1}] (${c.source ?? c.from}) ${c.title}` +
        (c.summary ? ` — ${c.summary.slice(0, 160)}` : ""),
    )
    .join("\n");

  const { object } = await generateObject({
    model: model(),
    schema: pickSchema,
    system: PERSONA,
    prompt: `今天是 ${date}。从以下过去 24 小时的候选素材中选出最值得深挖的 4-5 条做今日日报。
选题标准（按优先级）：模型/重要产品发布或重大升级 > 个人开发者马上能上手的新工具 > 行业重大事件（收购/融资/监管）。同一主题只选一条，优先一手来源。标了「版本更新」的是工具 release 监控，只有当版本变化足够重大（大版本、重要新功能）才值得选，日常小版本忽略。

${material}`,
  });
  return object.picks.filter((p) => p.index >= 1 && p.index <= candidates.length);
}

// ---------- 第二段：逐条深挖 ----------

const itemSchema = z.object({
  title: z.string().describe("条目标题，中文，信息密度高，可带冒号副题"),
  body: z
    .string()
    .describe(
      "正文 markdown：先 1-2 段讲清发生了什么和关键数字；如果内容适合对比（价格档位/版本差异/竞品对照），用 markdown 表格（|列|列|）呈现；如果有功能清单，用 - 列表。总长 150-350 字",
    ),
  howTo: z
    .array(z.string())
    .describe("『怎么玩』上手步骤，每步一句；无可操作性则空数组"),
});

async function deepDive(
  candidate: Candidate,
  angle: string,
): Promise<Omit<DailyItem, "rank">> {
  const article = candidate.url ? await fetchArticleText(candidate.url) : "";
  const { object } = await generateObject({
    model: model(),
    schema: itemSchema,
    system: PERSONA,
    prompt: `请把下面这条新闻写成日报条目。切入角度：${angle}

标题：${candidate.title}
来源：${candidate.source ?? ""}
链接：${candidate.url ?? "无"}
RSS 摘要：${candidate.summary ?? "无"}
${article ? `\n原文全文（已抓取，截断）：\n${article}` : "\n（原文抓取失败，只依据标题和摘要写，写不满就写短，不许脑补细节）"}`,
  });
  return {
    ...object,
    links: candidate.url ? [candidate.url] : [],
    comment: "",
  };
}

// ---------- 收尾：要点 + 小结 ----------

const wrapSchema = z.object({
  highlights: z
    .array(z.string())
    .min(4)
    .max(6)
    .describe("今日要点：每条一句话概括一个条目，含关键数字"),
  summary: z.string().describe("今日小结：两三句话串起全部条目，给出主线判断"),
});

async function wrapUp(items: Array<Omit<DailyItem, "rank">>) {
  const digest = items
    .map((it, i) => `${i + 1}. ${it.title}\n${it.body.slice(0, 200)}`)
    .join("\n\n");
  const { object } = await generateObject({
    model: model(),
    schema: wrapSchema,
    system: PERSONA,
    prompt: `以下是今天日报的全部条目，请写「今日要点」和「今日小结」：\n\n${digest}`,
  });
  return object;
}

// ---------- 入口 ----------

export async function generateReport(
  date: string,
  candidates: Candidate[],
): Promise<DailyReport> {
  const picks = await pickTopics(date, candidates);

  // 每个选题并发深挖（各自抓原文 + 各自一次 LLM 调用）
  const settled = await Promise.allSettled(
    picks.map((p) => deepDive(candidates[p.index - 1], p.angle)),
  );
  const items = settled
    .filter(
      (s): s is PromiseFulfilledResult<Omit<DailyItem, "rank">> =>
        s.status === "fulfilled",
    )
    .map((s) => s.value);
  if (items.length < 3) {
    throw new Error(`深挖成功条目过少（${items.length}），放弃生成`);
  }

  const { highlights, summary } = await wrapUp(items);

  return {
    date,
    status: "draft",
    highlights,
    items: items.map((it, i) => ({ rank: i + 1, ...it })),
    summary,
    generatedAt: new Date().toISOString(),
    candidateCount: candidates.length,
  };
}

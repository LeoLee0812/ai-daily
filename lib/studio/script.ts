// 口播稿生成：DeepSeek 把勾选素材写成「开场白 + 逐事件口播段 + 卡片要点 + 结束语」
// 逆向自橘鸦 AI 早报：口播稿按新闻事件分段，画面是 NotebookLM 风格知识卡片墙

import { generateObject } from "ai";
import { getModel } from "../model";
import { z } from "zod";
import type { StudioMaterial, VideoScript } from "./types";

const PERSONA = `你是「Leo 的 AI 日报」视频版的口播稿撰稿人。风格参考专业科技新闻播客：口语化但信息密度高，全程简体中文，数字和产品名精确，不用"值得注意的是""总的来说""赋能"这类 AI 腔，不用 emoji。`;

const scriptSchema = z.object({
  intro: z
    .string()
    .describe(
      '开场白：以"各位观众早上好，今天是X年X月X日 星期X，欢迎收看 Leo 的 AI 日报"开头，再用一两句预告今天最重要的一两条新闻。60 字内',
    ),
  events: z
    .array(
      z.object({
        title: z.string().describe("事件短标题，10 字左右，时间轴目录用"),
        narration: z
          .string()
          .describe(
            "该事件的口播正文：口语化播报，讲清发生了什么、关键数字、对开发者/用户意味着什么。100-200 字，纯文本无 markdown",
          ),
        cardTitle: z.string().describe("画面卡片大标题，15 字内，如「智谱开源 GLM-4.6V 多模态模型」"),
        points: z
          .array(
            z.object({
              heading: z.string().describe("要点小标题，2-6 字，如「模型发布」「性能表现」「价格策略」"),
              text: z
                .string()
                .describe("要点说明，25 字内，专有名词和关键数字用 **双星号** 包住以高亮"),
            }),
          )
          .min(4)
          .max(8)
          .describe("画面卡片的要点格子，覆盖该事件的核心信息"),
      }),
    )
    .min(1),
  outro: z
    .string()
    .describe('结束语："以上就是今天的全部内容"之类收尾 + 一句提醒关注，40 字内'),
});

/** 根据勾选素材生成完整口播稿（事件顺序与素材顺序一致） */
export async function generateVideoScript(
  date: string,
  materials: StudioMaterial[],
): Promise<VideoScript> {
  const weekday = "日一二三四五六"[new Date(`${date}T00:00:00+08:00`).getDay()];
  const materialText = materials
    .map(
      (m, i) =>
        `【素材 ${i + 1}】${m.title}\n来源：${m.source}\n内容：${m.summary}\n链接：${m.links.join(" ") || "无"}`,
    )
    .join("\n\n");

  const { object } = await generateObject({
    model: getModel(),
    schema: scriptSchema,
    system: PERSONA,
    prompt: `今天是 ${date}（星期${weekday}）。请把以下 ${materials.length} 条素材逐条写成视频口播稿，事件顺序与素材顺序一致，每条素材对应一个事件。只写素材里真实出现的事实和数字，不许编造。

${materialText}`,
  });

  return {
    intro: object.intro,
    outro: object.outro,
    events: object.events.slice(0, materials.length).map((ev, i) => ({
      title: ev.title,
      narration: ev.narration,
      card: { title: ev.cardTitle, points: ev.points },
      links: materials[i]?.links ?? [],
    })),
  };
}

// 本地端到端测试视频渲染流水线（跳过 DeepSeek 与火山 TTS，用假文稿+静音音频）
// 用法：npx tsx --env-file=.env.local scripts/test-render-local.mts

import { execFileSync } from "child_process";
import { createRequire } from "module";
import { mkdirSync, writeFileSync, readFileSync } from "fs";
import path from "path";
import { renderVideo } from "../lib/studio/video";
import { buildSrt } from "../lib/studio/tts";
import { putAsset } from "../lib/studio/store";
import type { VideoJob, TtsSentence } from "../lib/studio/types";

const require = createRequire(import.meta.url);
const ffmpeg = require("ffmpeg-static") as string;

const DATE = "2026-01-01"; // 测试专用日期，不影响真实数据

const script = {
  intro: "各位观众早上好，今天是2026年1月1日 星期四，欢迎收看 Leo 的 AI 日报。",
  outro: "以上就是今天的全部内容，我们明天见。",
  events: [
    {
      title: "测试事件一",
      narration: "这是第一个测试事件的口播正文。它包含两句话，用来验证字幕拆分。",
      card: {
        title: "智谱开源 GLM-4.6V 多模态模型",
        points: [
          { heading: "模型发布", text: "**GLM-4.6V (106B)** 正式开源" },
          { heading: "核心能力", text: "原生支持 **Function Calling**" },
          { heading: "性能表现", text: "30+ 基准 **SOTA** 表现" },
          { heading: "价格策略", text: "API 降价 **50%**" },
          { heading: "文档理解", text: "支持 **150 页** 文档解析" },
          { heading: "开源平台", text: "**HuggingFace** 与 ModelScope" },
        ],
      },
      links: ["https://example.com"],
    },
    {
      title: "测试事件二",
      narration: "第二个事件只有一句话，测试事件切换转场。",
      card: {
        title: "OpenAI 发布新一代推理模型",
        points: [
          { heading: "发布", text: "**o5** 系列上线" },
          { heading: "性能", text: "数学能力提升 **40%**" },
          { heading: "价格", text: "输入 **$2/M** tokens" },
          { heading: "可用性", text: "**Plus 用户** 即日可用" },
        ],
      },
      links: [],
    },
  ],
};

// 生成静音 mp3 假装 TTS 输出
function makeSilence(dir: string, name: string, sec: number): string {
  const f = path.join(dir, name);
  execFileSync(ffmpeg, [
    "-y", "-hide_banner", "-loglevel", "error",
    "-f", "lavfi", "-i", "anullsrc=r=24000:cl=mono",
    "-t", String(sec), "-c:a", "libmp3lame", "-b:a", "64k", f,
  ]);
  return f;
}

async function main() {
  const tmp = path.join(process.cwd(), "tmp", "test-render");
  mkdirSync(tmp, { recursive: true });

  // 按 tts.ts 的拆句逻辑手动铺时间轴：每句 2 秒，段落间隙 0.45 秒
  const texts: Array<{ segIndex: number; text: string }> = [
    { segIndex: -1, text: script.intro },
    { segIndex: 0, text: "这是第一个测试事件的口播正文。" },
    { segIndex: 0, text: "它包含两句话，用来验证字幕拆分。" },
    { segIndex: 1, text: "第二个事件只有一句话，测试事件切换转场。" },
    { segIndex: -2, text: script.outro },
  ];
  const sentences: TtsSentence[] = [];
  let cursor = 0;
  let prev: number | null = null;
  for (let i = 0; i < texts.length; i++) {
    const { segIndex, text } = texts[i];
    if (prev !== null && prev !== segIndex) cursor += 0.45;
    prev = segIndex;
    const f = makeSilence(tmp, `s${i}.mp3`, 2);
    const audioUrl = await putAsset(DATE, `audio/${String(i).padStart(3, "0")}.mp3`,
      readFileSync(f), "audio/mpeg");
    sentences.push({ segIndex, text, start: cursor, end: cursor + 2, audioUrl });
    cursor += 2;
  }
  const segments: Array<{ segIndex: number; title: string; start: number; end: number }> = [];
  for (const s of sentences) {
    const last = segments[segments.length - 1];
    if (last && last.segIndex === s.segIndex) last.end = s.end;
    else segments.push({ segIndex: s.segIndex, title: String(s.segIndex), start: s.start, end: s.end });
  }
  for (let i = 0; i < segments.length - 1; i++) segments[i].end = segments[i + 1].start;

  const job: VideoJob = {
    date: DATE,
    status: "audio",
    script,
    sourceTitles: [],
    timeline: {
      voiceType: "test",
      sentences,
      segments,
      totalDuration: cursor,
      srt: buildSrt(sentences),
    },
    updatedAt: new Date().toISOString(),
  };

  console.log(`时间轴 ${cursor.toFixed(1)}s，开始渲染…`);
  const t0 = Date.now();
  const { videoUrl, srtUrl } = await renderVideo(job);
  console.log(`渲染完成，耗时 ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  console.log("videoUrl:", videoUrl);
  console.log("srtUrl:", srtUrl);

  // 顺手把 SRT 也落地看一眼
  writeFileSync(path.join(tmp, "test.srt"), job.timeline!.srt);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

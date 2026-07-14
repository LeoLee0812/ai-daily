// TTS 合成（多供应商可插拔，TTS_PROVIDER 环境变量切换）
// 逐句合成：口播稿按标点拆短句，每句一个请求，用音频时长拼出全片时间轴

import { randomUUID } from "crypto";
import getMP3Duration from "get-mp3-duration";
import type { VideoScript, VideoTimeline, TtsSentence } from "./types";
import { putAsset } from "./store";

/** 事件之间的停顿（秒），模拟转场 */
const SEGMENT_GAP = 0.45;

interface TtsResult {
  audio: Buffer;
  durationSec: number;
}

/** 火山引擎 V1 非流式（注意 Authorization 是 "Bearer;token" 分号分隔，单次≤300汉字） */
async function synthVolcano(text: string, voiceType: string): Promise<Buffer> {
  const res = await fetch("https://openspeech.bytedance.com/api/v1/tts", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer;${process.env.VOLC_TTS_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({
      app: {
        appid: process.env.VOLC_TTS_APP_ID,
        token: "placeholder", // 实际鉴权在 header
        cluster: process.env.VOLC_TTS_CLUSTER || "volcano_tts",
      },
      user: { uid: "ai-daily-studio" },
      audio: {
        voice_type: voiceType,
        encoding: "mp3",
        rate: 24000,
        speed_ratio: Number(process.env.TTS_SPEED || 1.0),
      },
      request: {
        reqid: randomUUID(),
        text,
        text_type: "plain",
        operation: "query",
      },
    }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`火山 TTS HTTP ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { code: number; message: string; data?: string };
  if (json.code !== 3000 || !json.data) {
    throw new Error(`火山 TTS 失败 code=${json.code}: ${json.message}`);
  }
  return Buffer.from(json.data, "base64");
}

/** 硅基流动 CosyVoice2（OpenAI 兼容接口，返回 mp3，付费方案里最便宜） */
async function synthSiliconFlow(text: string, voice: string): Promise<Buffer> {
  const res = await fetch("https://api.siliconflow.cn/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.SILICONFLOW_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "FunAudioLLM/CosyVoice2-0.5B",
      input: text,
      voice,
      response_format: "mp3",
      speed: Number(process.env.TTS_SPEED || 1.0),
      stream: false,
    }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`硅基流动 TTS HTTP ${res.status}: ${await res.text()}`);
  return Buffer.from(await res.arrayBuffer());
}

/** 阿里百炼 qwen-tts（用现有千问 key，返回 wav 下载链接） */
async function synthDashscope(text: string, voice: string): Promise<Buffer> {
  const res = await fetch(
    "https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.DASHSCOPE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.DASHSCOPE_TTS_MODEL || "qwen-tts",
        input: { text, voice },
      }),
      signal: AbortSignal.timeout(60000),
    },
  );
  if (!res.ok) throw new Error(`百炼 TTS HTTP ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as {
    output?: { audio?: { url?: string } };
    message?: string;
  };
  const url = json.output?.audio?.url;
  if (!url) throw new Error(`百炼 TTS 无音频返回: ${json.message ?? JSON.stringify(json).slice(0, 200)}`);
  const wav = await fetch(url, { signal: AbortSignal.timeout(60000) });
  if (!wav.ok) throw new Error(`百炼 TTS 音频下载失败 ${wav.status}`);
  return Buffer.from(await wav.arrayBuffer());
}

/** 解析 wav 头取时长（data 块字节数 / 每秒字节数） */
function wavDuration(buf: Buffer): number {
  const byteRate = buf.readUInt32LE(28);
  // 从 fmt 之后找 data 块（有的文件带 LIST 等附加块）
  let off = 12;
  while (off + 8 <= buf.length) {
    const id = buf.toString("ascii", off, off + 4);
    const size = buf.readUInt32LE(off + 4);
    if (id === "data") return size / byteRate;
    off += 8 + size + (size % 2);
  }
  throw new Error("wav 缺少 data 块");
}

export type TtsProvider = "siliconflow" | "dashscope" | "volcano";

/** 供应商选择：显式 TTS_PROVIDER 优先，否则按已配置的 key 自动挑 */
export function resolveProvider(): TtsProvider {
  const p = process.env.TTS_PROVIDER as TtsProvider | undefined;
  if (p) return p;
  if (process.env.SILICONFLOW_API_KEY) return "siliconflow";
  if (process.env.DASHSCOPE_API_KEY) return "dashscope";
  return "volcano";
}

const DEFAULT_VOICE: Record<TtsProvider, string> = {
  siliconflow: "FunAudioLLM/CosyVoice2-0.5B:anna",
  dashscope: "Chelsie",
  volcano: "BV700_V2_streaming",
};

/** 单句合成：按供应商分发；时长本地解析（mp3 帧头 / wav 头） */
async function synthesize(text: string, voice: string): Promise<TtsResult & { ext: string }> {
  const provider = resolveProvider();
  if (provider === "siliconflow") {
    const audio = await synthSiliconFlow(text, voice);
    return { audio, durationSec: getMP3Duration(audio) / 1000, ext: "mp3" };
  }
  if (provider === "dashscope") {
    const audio = await synthDashscope(text, voice);
    return { audio, durationSec: wavDuration(audio), ext: "wav" };
  }
  const audio = await synthVolcano(text, voice);
  return { audio, durationSec: getMP3Duration(audio) / 1000, ext: "mp3" };
}

/** 口播段落拆短句：先按句末标点切，超长句再按逗号二次切 */
export function splitSentences(text: string): string[] {
  const rough = text
    .split(/(?<=[。！？；\n])/)
    .map((s) => s.trim())
    .filter(Boolean);
  const out: string[] = [];
  for (const s of rough) {
    if (s.length <= 80) {
      out.push(s);
      continue;
    }
    let buf = "";
    for (const piece of s.split(/(?<=[，、])/)) {
      if (buf.length + piece.length > 80 && buf) {
        out.push(buf);
        buf = piece;
      } else {
        buf += piece;
      }
    }
    if (buf) out.push(buf);
  }
  return out;
}

function fmtSrtTime(sec: number): string {
  const ms = Math.round(sec * 1000);
  const h = String(Math.floor(ms / 3600000)).padStart(2, "0");
  const m = String(Math.floor((ms % 3600000) / 60000)).padStart(2, "0");
  const s = String(Math.floor((ms % 60000) / 1000)).padStart(2, "0");
  const mm = String(ms % 1000).padStart(3, "0");
  return `${h}:${m}:${s},${mm}`;
}

export function buildSrt(sentences: TtsSentence[]): string {
  return sentences
    .map(
      (s, i) =>
        `${i + 1}\n${fmtSrtTime(s.start)} --> ${fmtSrtTime(s.end)}\n${s.text.replace(/\n/g, " ")}\n`,
    )
    .join("\n");
}

/** 全稿合成：逐句 TTS + 上传音频 + 生成时间轴与 SRT */
export async function synthesizeScript(
  date: string,
  script: VideoScript,
): Promise<VideoTimeline> {
  const provider = resolveProvider();
  const voiceType =
    process.env.TTS_VOICE || process.env.VOLC_TTS_VOICE || DEFAULT_VOICE[provider];

  // 展开为 (段落, 句子) 序列；intro=-1，outro=-2
  const plan: Array<{ segIndex: number; text: string }> = [];
  for (const s of splitSentences(script.intro)) plan.push({ segIndex: -1, text: s });
  script.events.forEach((ev, i) => {
    for (const s of splitSentences(ev.narration)) plan.push({ segIndex: i, text: s });
  });
  for (const s of splitSentences(script.outro)) plan.push({ segIndex: -2, text: s });

  // 逐句合成（串行，QPS 限制内最稳；一句失败重试一次）
  const sentences: TtsSentence[] = [];
  let cursor = 0;
  let prevSeg: number | null = null;
  for (let i = 0; i < plan.length; i++) {
    const { segIndex, text } = plan[i];
    if (prevSeg !== null && prevSeg !== segIndex) cursor += SEGMENT_GAP;
    prevSeg = segIndex;

    // 限流重试：429/瞬时错误指数退避，最多 5 次
    let result: (TtsResult & { ext: string }) | null = null;
    let lastErr: unknown;
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        result = await synthesize(text, voiceType);
        break;
      } catch (e) {
        lastErr = e;
        const msg = e instanceof Error ? e.message : String(e);
        const backoff = msg.includes("429") || msg.includes("Throttling") ? 3000 : 800;
        await new Promise((r) => setTimeout(r, backoff * (attempt + 1)));
      }
    }
    if (!result) throw lastErr;
    // dashscope 免费档 QPS 很低，句间强制留出间隔
    if (provider === "dashscope") await new Promise((r) => setTimeout(r, 1200));
    const audioUrl = await putAsset(
      date,
      `audio/${String(i).padStart(3, "0")}.${result.ext}`,
      result.audio,
      result.ext === "wav" ? "audio/wav" : "audio/mpeg",
    );
    sentences.push({
      segIndex,
      text,
      start: cursor,
      end: cursor + result.durationSec,
      audioUrl,
    });
    cursor += result.durationSec;
  }

  // 段落起止（画面切换点）
  const segments: VideoTimeline["segments"] = [];
  const segTitle = (idx: number) =>
    idx === -1 ? "Intro" : idx === -2 ? "Outro" : script.events[idx]?.title ?? `事件${idx + 1}`;
  for (const s of sentences) {
    const last = segments[segments.length - 1];
    if (last && last.segIndex === s.segIndex) {
      last.end = s.end;
    } else {
      segments.push({ segIndex: s.segIndex, title: segTitle(s.segIndex), start: s.start, end: s.end });
    }
  }
  // 段落边界对齐：每段结束延伸到下一段开始，消除画面空档
  for (let i = 0; i < segments.length - 1; i++) segments[i].end = segments[i + 1].start;

  return {
    voiceType: `${provider}/${voiceType}`,
    sentences,
    segments,
    totalDuration: cursor,
    srt: buildSrt(sentences),
  };
}

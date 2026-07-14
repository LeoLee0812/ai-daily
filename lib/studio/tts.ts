// 火山引擎大模型语音合成（V1 HTTP 非流式接口）
// 逐句合成：口播稿按标点拆短句，每句一个请求，用返回的音频时长拼出全片时间轴
// 注意：Authorization 是 "Bearer;token"（分号分隔），单次文本上限约 300 汉字

import { randomUUID } from "crypto";
import getMP3Duration from "get-mp3-duration";
import type { VideoScript, VideoTimeline, TtsSentence } from "./types";
import { putAsset } from "./store";

const TTS_ENDPOINT = "https://openspeech.bytedance.com/api/v1/tts";

/** 事件之间的停顿（秒），模拟转场 */
const SEGMENT_GAP = 0.45;

interface VolcanoResult {
  audio: Buffer;
  durationSec: number;
}

/** 单句合成，返回 mp3 音频与精确时长 */
async function synthesize(text: string, voiceType: string): Promise<VolcanoResult> {
  const res = await fetch(TTS_ENDPOINT, {
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
        speed_ratio: Number(process.env.VOLC_TTS_SPEED || 1.0),
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
  const json = (await res.json()) as {
    code: number;
    message: string;
    data?: string;
    addition?: { duration?: string };
  };
  if (json.code !== 3000 || !json.data) {
    throw new Error(`火山 TTS 失败 code=${json.code}: ${json.message}`);
  }
  const audio = Buffer.from(json.data, "base64");
  // 优先用接口返回的时长；缺失时本地解析 mp3 帧头兜底
  const apiMs = Number(json.addition?.duration ?? 0);
  const durationSec = (apiMs > 0 ? apiMs : getMP3Duration(audio)) / 1000;
  return { audio, durationSec };
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
  const voiceType = process.env.VOLC_TTS_VOICE || "BV700_V2_streaming";

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

    let result: VolcanoResult;
    try {
      result = await synthesize(text, voiceType);
    } catch {
      await new Promise((r) => setTimeout(r, 800));
      result = await synthesize(text, voiceType);
    }
    const audioUrl = await putAsset(
      date,
      `audio/${String(i).padStart(3, "0")}.mp3`,
      result.audio,
      "audio/mpeg",
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
    voiceType,
    sentences,
    segments,
    totalDuration: cursor,
    srt: buildSrt(sentences),
  };
}

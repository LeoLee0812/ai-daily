// 视频合成：帧序列（卡片+字幕预合成）+ 音频拼接 + 进度条叠加，ffmpeg 一次成片
// 流程：下载逐句音频 → 渲染段落卡片 → sharp 合成每句画面帧 → concat demuxer + overlay 进度条

import { execFile } from "child_process";
import { promisify } from "util";
import { mkdtemp, writeFile, rm } from "fs/promises";
import { readFileSync } from "fs";
import os from "os";
import path from "path";
import sharp from "sharp";
import type { VideoJob } from "./types";
import {
  renderEventCard,
  renderIntroCard,
  renderOutroCard,
  renderSubtitleStrip,
  CANVAS_W,
  CANVAS_H,
} from "./cards";
import { putAsset } from "./store";

const execFileP = promisify(execFile);

function ffmpegPath(): string {
  // ffmpeg-static 导出二进制绝对路径；require 以兼容 serverExternalPackages
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const p = require("ffmpeg-static") as string;
  if (!p) throw new Error("找不到 ffmpeg 二进制");
  return p;
}

async function ffmpeg(args: string[], cwd: string): Promise<void> {
  await execFileP(ffmpegPath(), ["-hide_banner", "-loglevel", "error", ...args], {
    cwd,
    maxBuffer: 64 * 1024 * 1024,
  });
}

/** concat 列表里的路径转义 */
const esc = (p: string) => `file '${p.replace(/'/g, "'\\''")}'`;

/** 合成成片并上传 Blob，返回 { videoUrl, srtUrl } */
export async function renderVideo(job: VideoJob): Promise<{ videoUrl: string; srtUrl: string }> {
  const tl = job.timeline;
  if (!tl) throw new Error("缺少时间轴，请先合成语音");
  const dir = await mkdtemp(path.join(os.tmpdir(), "aidaily-video-"));

  try {
    // 1. 下载逐句音频并统一转码成 44.1k 单声道 wav（抹平各 TTS 供应商的格式差异，concat 才安全）
    const audioFiles: string[] = [];
    for (let i = 0; i < tl.sentences.length; i++) {
      const res = await fetch(tl.sentences[i].audioUrl);
      if (!res.ok) throw new Error(`音频下载失败 ${i}: ${res.status}`);
      const ext = tl.sentences[i].audioUrl.split(".").pop() ?? "mp3";
      const raw = path.join(dir, `raw${String(i).padStart(3, "0")}.${ext}`);
      await writeFile(raw, Buffer.from(await res.arrayBuffer()));
      const f = path.join(dir, `a${String(i).padStart(3, "0")}.wav`);
      await ffmpeg(["-y", "-i", raw, "-ar", "44100", "-ac", "1", "-c:a", "pcm_s16le", f], dir);
      audioFiles.push(f);
    }

    // 2. 渲染段落底卡（intro/-1、outro/-2、事件/下标）
    const baseCards = new Map<number, string>();
    const renderBase = async (segIndex: number): Promise<string> => {
      if (baseCards.has(segIndex)) return baseCards.get(segIndex)!;
      let png: Buffer;
      if (segIndex === -1) png = await renderIntroCard(job.date, job.script);
      else if (segIndex === -2) png = await renderOutroCard(job.date);
      else png = await renderEventCard(job.date, job.script.events[segIndex].card);
      const f = path.join(dir, `card${segIndex + 2}.png`);
      await writeFile(f, png);
      baseCards.set(segIndex, f);
      return f;
    };

    // 3. 每句一帧：底卡 + 字幕条（贴底部）
    const frameFiles: string[] = [];
    for (let i = 0; i < tl.sentences.length; i++) {
      const s = tl.sentences[i];
      const base = await renderBase(s.segIndex);
      const strip = await renderSubtitleStrip(s.text);
      const frame = path.join(dir, `f${String(i).padStart(3, "0")}.png`);
      await sharp(readFileSync(base))
        .composite([{ input: strip, left: 0, top: CANVAS_H - 150 - 36 }])
        .png()
        .toFile(frame);
      frameFiles.push(frame);
    }

    // 4. 帧清单（concat demuxer，带每帧时长；段落间隙插入无字幕的下一段底卡作转场）
    const frameLines: string[] = [];
    for (let i = 0; i < tl.sentences.length; i++) {
      const cur = tl.sentences[i];
      const next = tl.sentences[i + 1];
      frameLines.push(esc(frameFiles[i]), `duration ${(cur.end - cur.start).toFixed(3)}`);
      if (next) {
        const gap = next.start - cur.end;
        if (gap > 0.05) {
          // 转场空档：显示下一段的干净卡片
          frameLines.push(esc(await renderBase(next.segIndex)), `duration ${gap.toFixed(3)}`);
        }
      }
    }
    // concat demuxer 要求末帧重复一次
    frameLines.push(esc(frameFiles[frameFiles.length - 1]));
    await writeFile(path.join(dir, "frames.txt"), frameLines.join("\n"));

    // 5. 音频清单：句间空档用同参数静音片段补齐
    const gaps = new Set<string>();
    const audioLines: string[] = [];
    for (let i = 0; i < tl.sentences.length; i++) {
      audioLines.push(esc(audioFiles[i]));
      const next = tl.sentences[i + 1];
      if (next) {
        const gap = next.start - tl.sentences[i].end;
        if (gap > 0.05) {
          const key = gap.toFixed(3);
          const silence = path.join(dir, `sil${key}.wav`);
          if (!gaps.has(key)) {
            await ffmpeg(
              ["-f", "lavfi", "-i", `anullsrc=r=44100:cl=mono`, "-t", key, "-c:a", "pcm_s16le", silence],
              dir,
            );
            gaps.add(key);
          }
          audioLines.push(esc(silence));
        }
      }
    }
    await writeFile(path.join(dir, "audio.txt"), audioLines.join("\n"));

    // 6. 进度条素材（玫红细条，overlay 随时间从左滑入）
    await sharp({
      create: { width: CANVAS_W, height: 12, channels: 4, background: "#E0537A" },
    })
      .png()
      .toFile(path.join(dir, "bar.png"));

    // 7. 一次成片：帧序列 + 音频 + 进度条 overlay
    const total = tl.totalDuration.toFixed(3);
    await ffmpeg(
      [
        "-y",
        "-f", "concat", "-safe", "0", "-i", "frames.txt",
        "-f", "concat", "-safe", "0", "-i", "audio.txt",
        "-loop", "1", "-i", "bar.png",
        "-filter_complex",
        `[0:v]fps=30,format=yuv420p[base];[2:v]format=rgba[bar];` +
          `[base][bar]overlay=x='-W+W*t/${total}':y=${CANVAS_H - 12}:shortest=1[v]`,
        "-map", "[v]", "-map", "1:a",
        "-c:v", "libx264", "-preset", "veryfast", "-tune", "stillimage", "-crf", "21",
        "-c:a", "aac", "-b:a", "160k", "-ar", "44100",
        "-t", total,
        "-movflags", "+faststart",
        "out.mp4",
      ],
      dir,
    );

    // 8. 上传成片与字幕
    const mp4 = readFileSync(path.join(dir, "out.mp4"));
    const videoUrl = await putAsset(job.date, `ai-daily-${job.date}.mp4`, mp4, "video/mp4");
    const srtUrl = await putAsset(job.date, `ai-daily-${job.date}.srt`, tl.srt, "text/plain; charset=utf-8");
    return { videoUrl, srtUrl };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

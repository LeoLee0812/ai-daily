// 视频任务存储：Vercel Blob（videos/YYYY-MM-DD/job.json + 音频/成片同目录）

import { list, put } from "@vercel/blob";
import type { VideoJob } from "./types";

const PREFIX = "videos/";

export function jobDir(date: string): string {
  return `${PREFIX}${date}/`;
}

export async function saveJob(job: VideoJob): Promise<void> {
  job.updatedAt = new Date().toISOString();
  await put(`${jobDir(job.date)}job.json`, JSON.stringify(job), {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
  });
}

export async function getJob(date: string): Promise<VideoJob | null> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const { blobs } = await list({ prefix: `${jobDir(date)}job.json`, limit: 1 });
  const blob = blobs[0];
  if (!blob) return null;
  const res = await fetch(blob.url, { cache: "no-store" });
  if (!res.ok) return null;
  return (await res.json()) as VideoJob;
}

/** 上传二进制资产（音频/视频/字幕），返回公开 URL */
export async function putAsset(
  date: string,
  name: string,
  data: Buffer | Uint8Array | string,
  contentType: string,
): Promise<string> {
  const { url } = await put(`${jobDir(date)}${name}`, data as Buffer, {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType,
    multipart: (data as Buffer).length > 8 * 1024 * 1024,
  });
  return url;
}

/** 列出有视频任务的日期（新的在前） */
export async function listJobDates(): Promise<string[]> {
  const { blobs } = await list({ prefix: PREFIX, limit: 1000 });
  const dates = new Set<string>();
  for (const b of blobs) {
    const m = b.pathname.match(/^videos\/(\d{4}-\d{2}-\d{2})\/job\.json$/);
    if (m) dates.add(m[1]);
  }
  return [...dates].sort().reverse();
}

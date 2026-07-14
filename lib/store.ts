// 存储层：Vercel Blob（reports/YYYY-MM-DD.json，公开可读、固定路径、允许覆盖）

import { list, put } from "@vercel/blob";
import type { DailyReport } from "./types";

const PREFIX = "reports/";

export async function saveReport(report: DailyReport): Promise<string> {
  const { url } = await put(
    `${PREFIX}${report.date}.json`,
    JSON.stringify(report),
    {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
    },
  );
  return url;
}

// 列出全部日报日期（新的在前）
export async function listReportDates(): Promise<string[]> {
  const { blobs } = await list({ prefix: PREFIX, limit: 1000 });
  return blobs
    .map((b) => b.pathname.slice(PREFIX.length).replace(/\.json$/, ""))
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
    .sort()
    .reverse();
}

export async function getReport(date: string): Promise<DailyReport | null> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const { blobs } = await list({ prefix: `${PREFIX}${date}.json`, limit: 1 });
  const blob = blobs[0];
  if (!blob) return null;
  const res = await fetch(blob.url, { cache: "no-store" });
  if (!res.ok) return null;
  return (await res.json()) as DailyReport;
}

// 北京时间的今天（YYYY-MM-DD）
export function beijingToday(): string {
  return new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);
}

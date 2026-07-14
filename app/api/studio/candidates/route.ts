// 工作台素材：当日日报条目（已深挖，质量高）+ 实时信源候选

import { NextRequest, NextResponse } from "next/server";
import { collectCandidates } from "@/lib/sources";
import { getReport, beijingToday } from "@/lib/store";
import type { StudioMaterial } from "@/lib/studio/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key");
  if (!process.env.ADMIN_KEY || key !== process.env.ADMIN_KEY) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const date = req.nextUrl.searchParams.get("date") || beijingToday();

  const materials: StudioMaterial[] = [];

  // 当日日报条目优先（正文已是深挖成稿）
  const report = await getReport(date);
  if (report) {
    for (const it of report.items) {
      materials.push({
        id: `report-${it.rank}`,
        title: it.title,
        summary: it.body,
        links: it.links,
        source: "当日日报",
        kind: "report",
      });
    }
  }

  // 实时信源候选（标题+摘要，未深挖）
  try {
    const candidates = await collectCandidates();
    for (let i = 0; i < Math.min(candidates.length, 40); i++) {
      const c = candidates[i];
      materials.push({
        id: `feed-${i}`,
        title: c.title,
        summary: c.summary ?? "",
        links: c.url ? [c.url] : [],
        source: c.source ?? c.from,
        kind: "feed",
      });
    }
  } catch (e) {
    console.warn("[studio] 信源采集失败:", e);
  }

  return NextResponse.json({ date, materials });
}

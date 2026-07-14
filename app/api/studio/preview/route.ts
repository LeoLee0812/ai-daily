// 卡片预览：把某段落的画面卡片渲染成 PNG 直接返回（工作台所见即所得）
// seg=-1 片头，seg=-2 片尾，seg>=0 对应事件下标

import { NextRequest, NextResponse } from "next/server";
import { getJob } from "@/lib/studio/store";
import { renderEventCard, renderIntroCard, renderOutroCard } from "@/lib/studio/cards";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key");
  if (!process.env.ADMIN_KEY || key !== process.env.ADMIN_KEY) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const date = req.nextUrl.searchParams.get("date") ?? "";
  const seg = Number(req.nextUrl.searchParams.get("seg") ?? "0");
  const job = await getJob(date);
  if (!job) return NextResponse.json({ error: "not found" }, { status: 404 });

  let png: Buffer;
  if (seg === -1) png = await renderIntroCard(date, job.script);
  else if (seg === -2) png = await renderOutroCard(date);
  else {
    const ev = job.script.events[seg];
    if (!ev) return NextResponse.json({ error: "段落不存在" }, { status: 404 });
    png = await renderEventCard(date, ev.card);
  }
  return new NextResponse(new Uint8Array(png), {
    headers: { "Content-Type": "image/png", "Cache-Control": "no-store" },
  });
}

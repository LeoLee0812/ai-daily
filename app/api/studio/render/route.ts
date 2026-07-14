// 视频合成：卡片渲染 + 帧合成 + ffmpeg 成片 → status=done
// 注意：这是重活，跑在 Node 运行时（Fluid），maxDuration 拉满

import { NextRequest, NextResponse } from "next/server";
import { getJob, saveJob } from "@/lib/studio/store";
import { renderVideo } from "@/lib/studio/video";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { key: string; date: string };
  if (!process.env.ADMIN_KEY || body.key !== process.env.ADMIN_KEY) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const job = await getJob(body.date);
  if (!job) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (!job.timeline) {
    return NextResponse.json({ error: "请先合成语音" }, { status: 400 });
  }

  job.status = "rendering";
  job.error = undefined;
  await saveJob(job);

  try {
    const { videoUrl, srtUrl } = await renderVideo(job);
    job.videoUrl = videoUrl;
    job.srtUrl = srtUrl;
    job.status = "done";
    await saveJob(job);
    return NextResponse.json({ ok: true, job });
  } catch (e) {
    job.status = "error";
    job.error = `视频合成失败：${e instanceof Error ? e.message : e}`;
    await saveJob(job);
    console.error("[studio] 渲染失败:", e);
    return NextResponse.json({ error: job.error }, { status: 500 });
  }
}

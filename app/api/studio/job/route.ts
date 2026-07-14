// 视频任务读写：GET 查询任务状态；POST 保存人工编辑后的口播稿

import { NextRequest, NextResponse } from "next/server";
import { getJob, saveJob } from "@/lib/studio/store";
import type { VideoScript } from "@/lib/studio/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key");
  if (!process.env.ADMIN_KEY || key !== process.env.ADMIN_KEY) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const date = req.nextUrl.searchParams.get("date") ?? "";
  const job = await getJob(date);
  return NextResponse.json({ job });
}

interface Body {
  key: string;
  date: string;
  script: VideoScript;
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as Body;
  if (!process.env.ADMIN_KEY || body.key !== process.env.ADMIN_KEY) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const job = await getJob(body.date);
  if (!job) return NextResponse.json({ error: "not found" }, { status: 404 });

  // 改稿后语音/成片作废，回到文稿态
  job.script = body.script;
  job.status = "script";
  job.timeline = undefined;
  job.videoUrl = undefined;
  job.srtUrl = undefined;
  job.error = undefined;
  await saveJob(job);
  return NextResponse.json({ ok: true, job });
}

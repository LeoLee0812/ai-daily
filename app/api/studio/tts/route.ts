// 语音合成：逐句火山 TTS → 时间轴 + SRT → status=audio

import { NextRequest, NextResponse } from "next/server";
import { getJob, saveJob } from "@/lib/studio/store";
import { synthesizeScript } from "@/lib/studio/tts";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { key: string; date: string };
  if (!process.env.ADMIN_KEY || body.key !== process.env.ADMIN_KEY) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!process.env.VOLC_TTS_APP_ID || !process.env.VOLC_TTS_ACCESS_TOKEN) {
    return NextResponse.json(
      { error: "未配置火山引擎 TTS（VOLC_TTS_APP_ID / VOLC_TTS_ACCESS_TOKEN）" },
      { status: 500 },
    );
  }
  const job = await getJob(body.date);
  if (!job) return NextResponse.json({ error: "not found" }, { status: 404 });

  try {
    job.timeline = await synthesizeScript(job.date, job.script);
    job.status = "audio";
    job.error = undefined;
    await saveJob(job);
    return NextResponse.json({ ok: true, job });
  } catch (e) {
    job.status = "error";
    job.error = `TTS 失败：${e instanceof Error ? e.message : e}`;
    await saveJob(job);
    return NextResponse.json({ error: job.error }, { status: 500 });
  }
}

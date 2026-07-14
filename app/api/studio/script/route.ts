// 口播稿生成：勾选素材 → DeepSeek 写稿 → 存为视频任务（status=script）

import { NextRequest, NextResponse } from "next/server";
import { generateVideoScript } from "@/lib/studio/script";
import { saveJob } from "@/lib/studio/store";
import type { StudioMaterial, VideoJob } from "@/lib/studio/types";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

interface Body {
  key: string;
  date: string;
  materials: StudioMaterial[];
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as Body;
  if (!process.env.ADMIN_KEY || body.key !== process.env.ADMIN_KEY) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(body.date) || !body.materials?.length) {
    return NextResponse.json({ error: "参数不合法" }, { status: 400 });
  }
  if (body.materials.length > 10) {
    return NextResponse.json({ error: "素材最多 10 条" }, { status: 400 });
  }

  const script = await generateVideoScript(body.date, body.materials);
  const job: VideoJob = {
    date: body.date,
    status: "script",
    script,
    sourceTitles: body.materials.map((m) => m.title),
    updatedAt: new Date().toISOString(),
  };
  await saveJob(job);
  return NextResponse.json({ ok: true, job });
}

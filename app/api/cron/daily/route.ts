// 每日生成入口：Vercel Cron 定时触发，或手动带 CRON_SECRET 触发
// 流程：采集信源 → DeepSeek 生成日报 → 存 Blob → 发邮件

import { NextRequest, NextResponse } from "next/server";
import { collectCandidates } from "@/lib/sources";
import { generateReport } from "@/lib/generate";
import { beijingToday, getReport, saveReport } from "@/lib/store";
import { sendDraftEmail } from "@/lib/email";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const date = req.nextUrl.searchParams.get("date") || beijingToday();
  const force = req.nextUrl.searchParams.get("force") === "1";

  // 干跑：只采集信源、返回各源分布，不生成不发信不落盘（运维排查用）
  if (req.nextUrl.searchParams.get("dry") === "1") {
    const cs = await collectCandidates();
    const bySource: Record<string, number> = {};
    for (const c of cs) {
      const k = c.source ?? c.from;
      bySource[k] = (bySource[k] ?? 0) + 1;
    }
    return NextResponse.json({ ok: true, dry: true, total: cs.length, bySource });
  }

  // 幂等：当天已有日报且未 force 时直接返回（cron 重试不重复烧 token）
  if (!force) {
    const existing = await getReport(date);
    if (existing) {
      return NextResponse.json({ ok: true, skipped: "exists", date });
    }
  }

  const candidates = await collectCandidates();
  if (candidates.length < 5) {
    return NextResponse.json(
      { error: `候选素材过少（${candidates.length} 条），放弃生成` },
      { status: 502 },
    );
  }

  const report = await generateReport(date, candidates);
  const url = await saveReport(report);

  let mailed = true;
  try {
    await sendDraftEmail(report);
  } catch (e) {
    mailed = false;
    console.error("[ai-daily] 邮件发送失败:", e);
  }

  return NextResponse.json({
    ok: true,
    date,
    items: report.items.length,
    candidates: candidates.length,
    blob: url,
    mailed,
  });
}

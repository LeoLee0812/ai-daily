// 人工审核写回：保存点评修改 / 定稿（定稿时发送正式邮件）

import { NextRequest, NextResponse } from "next/server";
import { getReport, saveReport } from "@/lib/store";
import { sendFinalEmail } from "@/lib/email";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface UpdateBody {
  date: string;
  key: string;
  action: "save" | "finalize";
  comments: string[];
  summary?: string;
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as UpdateBody;
  if (!process.env.ADMIN_KEY || body.key !== process.env.ADMIN_KEY) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const report = await getReport(body.date);
  if (!report) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  if (Array.isArray(body.comments)) {
    report.items.forEach((it, i) => {
      const c = body.comments[i];
      if (typeof c === "string") it.comment = c.trim();
    });
  }
  if (typeof body.summary === "string" && body.summary.trim()) {
    report.summary = body.summary.trim();
  }

  let mailed = false;
  if (body.action === "finalize") {
    report.status = "final";
    report.finalizedAt = new Date().toISOString();
    await saveReport(report);
    try {
      await sendFinalEmail(report);
      mailed = true;
    } catch (e) {
      console.error("[ai-daily] 定稿邮件发送失败:", e);
    }
  } else {
    await saveReport(report);
  }

  return NextResponse.json({ ok: true, status: report.status, mailed });
}

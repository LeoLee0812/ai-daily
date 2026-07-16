// 公开只读接口：给外部消费者（东京 VPS 的飞书 bot 定时播报）取日报 JSON
// GET /api/report/latest            → 北京时间今天的日报
// GET /api/report/latest?date=YYYY-MM-DD → 指定日期
// 内容与公开网页 /r/[date] 一致，故不加鉴权

import { NextRequest, NextResponse } from "next/server";
import { getReport, beijingToday } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get("date") || beijingToday();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "bad date" }, { status: 400 });
  }
  const report = await getReport(date);
  if (!report) {
    return NextResponse.json({ error: "not found", date }, { status: 404 });
  }
  return NextResponse.json(report, {
    headers: { "Cache-Control": "no-store" },
  });
}

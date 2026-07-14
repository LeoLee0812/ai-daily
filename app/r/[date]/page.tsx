// 单日日报页：shadcn 风格改版 + 一键导出长图 + 视频版内嵌播放
// 注意：#report-card 与 data-noexport 是长图导出的锚点，别动

import Link from "next/link";
import { notFound } from "next/navigation";
import { getReport } from "@/lib/store";
import { getJob } from "@/lib/studio/store";
import { mdToHtml } from "@/lib/markdown";
import { Badge } from "@/components/ui/badge";
import { Clapperboard, Link2, MessageSquareQuote } from "lucide-react";
import ExportButton from "./export-button";

export const dynamic = "force-dynamic";

export default async function ReportPage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { date } = await params;
  const [report, job] = await Promise.all([
    getReport(date),
    getJob(date).catch(() => null),
  ]);
  if (!report) notFound();
  const video = job?.status === "done" && job.videoUrl ? job : null;

  return (
    <div className="min-h-screen bg-neutral-100">
      <div className="mx-auto max-w-2xl px-4 py-10">
        <div id="report-card" className="rounded-2xl bg-white p-7 shadow-sm sm:p-9">
          {report.status === "draft" && (
            <div className="mb-5 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-[13px] text-amber-800">
              📝 草稿——点评尚未人工审核
            </div>
          )}
          <h1 className="text-2xl font-bold tracking-wide text-neutral-900">
            Leo 的 AI 日报 · {report.date.replaceAll("-", "")}
          </h1>

          {video && (
            <div className="mt-5" data-noexport>
              <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-pink-600">
                <Clapperboard className="h-4 w-4" /> 视频版
              </div>
              <video
                src={video.videoUrl}
                controls
                className="w-full rounded-xl border"
                poster=""
              />
            </div>
          )}

          <h2 className="mt-7 mb-2.5 text-base font-semibold text-neutral-900">
            📌 今日要点
          </h2>
          <ul className="list-disc space-y-1.5 pl-5 text-[14.5px] leading-relaxed text-neutral-700">
            {report.highlights.map((h, i) => (
              <li key={i}>{h}</li>
            ))}
          </ul>

          {report.items.map((it) => (
            <section key={it.rank} className="mt-9 border-t pt-6">
              <div className="mb-3 flex items-start gap-2.5">
                <Badge className="mt-0.5 shrink-0 bg-pink-600 hover:bg-pink-600">
                  {it.rank}
                </Badge>
                <h2 className="text-lg font-semibold leading-snug text-neutral-900">
                  {it.title}
                </h2>
              </div>
              <div
                className="body-md text-neutral-700"
                dangerouslySetInnerHTML={{ __html: mdToHtml(it.body) }}
              />
              {it.howTo.length > 0 && (
                <div className="mt-3 rounded-xl bg-neutral-100 px-4 py-3 text-[13.5px] text-neutral-700">
                  <strong>怎么玩：</strong>
                  <ol className="mt-1.5 list-decimal space-y-1 pl-5">
                    {it.howTo.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ol>
                </div>
              )}
              {it.links.map((l, i) => (
                <div
                  key={i}
                  className="mt-1.5 flex items-center gap-1.5 text-xs text-neutral-500"
                >
                  <Link2 className="h-3 w-3 shrink-0" />
                  <a
                    href={l}
                    target="_blank"
                    rel="noopener"
                    className="break-all text-blue-600 hover:underline"
                  >
                    {l}
                  </a>
                </div>
              ))}
              <div className="mt-3.5 flex gap-2 rounded-r-lg border-l-[3px] border-neutral-300 bg-neutral-50 px-4 py-2.5 text-[13.5px] text-neutral-500">
                <MessageSquareQuote className="mt-0.5 h-4 w-4 shrink-0" />
                <span>Leo 点评：{it.comment}</span>
              </div>
            </section>
          ))}

          <div className="mt-9 rounded-xl bg-neutral-100 px-4.5 py-4 text-[13.5px] leading-relaxed text-neutral-700">
            <strong>今日小结</strong>：{report.summary}
          </div>

          <div className="mt-7 border-t pt-4 text-center text-xs text-neutral-400">
            由 Leo 工具箱生成 · daily.saveme505.help ·{" "}
            <Link href="/" data-noexport className="hover:text-pink-600">
              历史日报
            </Link>
          </div>
        </div>
        <ExportButton date={report.date} />
      </div>
    </div>
  );
}

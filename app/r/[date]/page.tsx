// 单日日报页：仿长图日报排版 + 一键导出长图

import Link from "next/link";
import { notFound } from "next/navigation";
import { getReport } from "@/lib/store";
import { mdToHtml } from "@/lib/markdown";
import ExportButton from "./export-button";

export const dynamic = "force-dynamic";

export default async function ReportPage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { date } = await params;
  const report = await getReport(date);
  if (!report) notFound();

  return (
    <div className="wrap">
      <div className="card" id="report-card">
        {report.status === "draft" && (
          <div
            style={{
              marginBottom: 18,
              padding: "10px 16px",
              background: "#fef3c7",
              border: "1px solid #fcd34d",
              borderRadius: 10,
              fontSize: 13.5,
              color: "#92400e",
            }}
          >
            📝 草稿——点评尚未人工审核
          </div>
        )}
        <h1 className="report-title">
          Leo 的 AI 日报 · {report.date.replaceAll("-", "")}
        </h1>

        <h2 className="section-h">📌 今日要点</h2>
        <ul className="highlights">
          {report.highlights.map((h, i) => (
            <li key={i}>{h}</li>
          ))}
        </ul>

        {report.items.map((it) => (
          <section key={it.rank}>
            <h2 className="item-h">
              {it.rank}. {it.title}
            </h2>
            <div
              className="body-md"
              dangerouslySetInnerHTML={{ __html: mdToHtml(it.body) }}
            />
            {it.howTo.length > 0 && (
              <div className="howto">
                <strong>怎么玩：</strong>
                <ol>
                  {it.howTo.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ol>
              </div>
            )}
            {it.links.map((l, i) => (
              <div className="link-line" key={i}>
                🔗{" "}
                <a href={l} target="_blank" rel="noopener">
                  {l}
                </a>
              </div>
            ))}
            <div className="comment">💬 Leo 点评：{it.comment}</div>
          </section>
        ))}

        <div className="summary">
          <strong>今日小结</strong>：{report.summary}
        </div>

        <div className="footer">
          由 Leo 工具箱生成 · daily.saveme505.help ·{" "}
          <Link href="/" data-noexport>
            历史日报
          </Link>
        </div>
      </div>
      <ExportButton date={report.date} />
    </div>
  );
}

// 人工审核页：改每条的 Leo 点评和今日小结，保存或定稿
// 访问需带 ?key=<ADMIN_KEY>（草稿邮件里的按钮自带）

import { notFound } from "next/navigation";
import { getReport } from "@/lib/store";
import Editor from "./editor";

export const dynamic = "force-dynamic";

export default async function EditPage({
  params,
  searchParams,
}: {
  params: Promise<{ date: string }>;
  searchParams: Promise<{ key?: string }>;
}) {
  const { date } = await params;
  const { key } = await searchParams;
  if (!process.env.ADMIN_KEY || key !== process.env.ADMIN_KEY) {
    return (
      <div className="wrap">
        <div className="card">
          <h1 className="report-title">🔒 无权访问</h1>
          <p style={{ marginTop: 12, fontSize: 14 }}>
            请从草稿邮件里的「改点评并定稿」按钮进入。
          </p>
        </div>
      </div>
    );
  }
  const report = await getReport(date);
  if (!report) notFound();

  return (
    <div className="wrap">
      <div className="card">
        <h1 className="report-title">
          审核 · {report.date.replaceAll("-", "")}
          <span
            style={{
              marginLeft: 10,
              fontSize: 13,
              color: report.status === "draft" ? "#d97706" : "#059669",
            }}
          >
            {report.status === "draft" ? "草稿" : "已定稿"}
          </span>
        </h1>
        <Editor report={report} adminKey={key!} />
      </div>
    </div>
  );
}

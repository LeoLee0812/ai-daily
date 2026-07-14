// 首页：日报归档列表

import Link from "next/link";
import { listReportDates } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function Home() {
  const dates = await listReportDates();
  return (
    <div className="wrap">
      <div className="card">
        <h1 className="index-title">Leo 的 AI 日报</h1>
        <p className="index-sub">
          每天三分钟，看懂 AI 圈新鲜事 · 自动采集信源，AI 撰写，每早 09:30
          邮件送达
        </p>
        {dates.length === 0 ? (
          <p style={{ color: "var(--muted)", fontSize: 14 }}>
            还没有日报，明早见。
          </p>
        ) : (
          <ul className="report-list">
            {dates.map((d) => (
              <li key={d}>
                <Link href={`/r/${d}`}>
                  Leo 的 AI 日报 · {d.replaceAll("-", "")}
                </Link>
              </li>
            ))}
          </ul>
        )}
        <div className="footer">由 Leo 工具箱生成 · daily.saveme505.help</div>
      </div>
    </div>
  );
}

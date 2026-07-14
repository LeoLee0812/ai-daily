// 邮件渲染 + 发送（Resend HTTP API，样式内联保证邮件客户端兼容）

import { mdToHtml } from "./markdown";
import type { DailyReport } from "./types";

const SITE = process.env.SITE_URL || "https://daily.saveme505.help";

export function renderEmailHtml(report: DailyReport): string {
  const items = report.items
    .map(
      (it) => `
  <div style="margin:28px 0 0;">
    <h2 style="font-size:17px;margin:0 0 10px;color:#111827;">${it.rank}. ${it.title}</h2>
    <div style="font-size:14px;line-height:1.8;color:#374151;">${mdToHtml(it.body)}</div>
    ${
      it.howTo.length
        ? `<div style="margin:10px 0;padding:12px 14px;background:#f3f4f6;border-radius:8px;font-size:13px;color:#374151;">
             <strong>怎么玩：</strong><ol style="margin:6px 0 0;padding-left:18px;">${it.howTo
               .map((s) => `<li style="margin:3px 0;">${s}</li>`)
               .join("")}</ol></div>`
        : ""
    }
    ${it.links
      .map(
        (l) =>
          `<div style="font-size:12px;margin:4px 0;">🔗 <a href="${l}" style="color:#2563eb;word-break:break-all;">${l}</a></div>`,
      )
      .join("")}
    <div style="margin:10px 0 0;padding:10px 14px;border-left:3px solid #d1d5db;background:#fafafa;color:#6b7280;font-size:13px;">💬 Leo 点评：${it.comment}</div>
  </div>`,
    )
    .join("\n");

  return `
<div style="max-width:640px;margin:0 auto;padding:28px 20px;font-family:-apple-system,'PingFang SC','Microsoft YaHei',sans-serif;background:#ffffff;">
  <h1 style="font-size:22px;margin:0 0 4px;color:#111827;">Leo 的 AI 日报 · ${report.date.replaceAll("-", "")}</h1>
  <div style="margin:18px 0 0;">
    <h2 style="font-size:15px;margin:0 0 8px;color:#111827;">📌 今日要点</h2>
    <ul style="margin:0;padding-left:20px;font-size:14px;line-height:1.9;color:#374151;">
      ${report.highlights.map((h) => `<li>${h}</li>`).join("\n")}
    </ul>
  </div>
  ${items}
  <div style="margin:28px 0 0;padding:14px 16px;background:#f9fafb;border-radius:10px;font-size:13px;line-height:1.8;color:#4b5563;">
    <strong>今日小结</strong>：${report.summary}
  </div>
  <div style="margin:24px 0 0;padding-top:14px;border-top:1px solid #e5e7eb;font-size:12px;color:#9ca3af;text-align:center;">
    由 Leo 工具箱生成 · <a href="${SITE}/r/${report.date}" style="color:#9ca3af;">网页版</a> · <a href="${SITE}" style="color:#9ca3af;">历史日报</a>
  </div>
</div>`;
}

export async function sendReportEmail(report: DailyReport): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  const to = process.env.MAIL_TO;
  if (!key || !to) return; // 未配置邮件则跳过，不影响生成
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Leo 的 AI 日报 <claude@saveme505.help>",
      to: [to],
      subject: `Leo 的 AI 日报 · ${report.date.replaceAll("-", "")}`,
      html: renderEmailHtml(report),
    }),
  });
  if (!res.ok) {
    throw new Error(`Resend 发送失败 ${res.status}: ${await res.text()}`);
  }
}

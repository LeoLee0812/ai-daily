"use client";

// 审核编辑器：逐条改点评 + 改小结，保存草稿或定稿并发正式邮件

import { useState } from "react";
import type { DailyReport } from "@/lib/types";

export default function Editor({
  report,
  adminKey,
}: {
  report: DailyReport;
  adminKey: string;
}) {
  const [comments, setComments] = useState(
    report.items.map((it) => it.comment),
  );
  const [summary, setSummary] = useState(report.summary);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function submit(action: "save" | "finalize") {
    if (
      action === "finalize" &&
      !confirm("定稿后会发送正式日报邮件，确认？")
    ) {
      return;
    }
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/report/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: report.date,
          key: adminKey,
          action,
          comments,
          summary,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || res.status);
      setMsg(
        action === "finalize"
          ? j.mailed
            ? "✅ 已定稿，正式邮件已发送"
            : "✅ 已定稿（邮件发送失败，可稍后重试）"
          : "✅ 已保存",
      );
    } catch (e) {
      setMsg(`❌ 失败：${e instanceof Error ? e.message : e}`);
    } finally {
      setBusy(false);
    }
  }

  const ta: React.CSSProperties = {
    width: "100%",
    minHeight: 72,
    padding: "10px 12px",
    border: "1px solid var(--line)",
    borderRadius: 8,
    fontSize: 14,
    lineHeight: 1.7,
    fontFamily: "inherit",
    resize: "vertical",
  };

  return (
    <div style={{ marginTop: 20 }}>
      {report.items.map((it, i) => (
        <div key={it.rank} style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 15, color: "var(--ink)", marginBottom: 6 }}>
            <strong>
              {it.rank}. {it.title}
            </strong>
          </div>
          <div
            style={{ fontSize: 13, color: "var(--muted)", marginBottom: 8 }}
          >
            {it.body.slice(0, 120)}…
          </div>
          <textarea
            style={ta}
            value={comments[i]}
            onChange={(e) =>
              setComments(comments.map((c, j) => (j === i ? e.target.value : c)))
            }
          />
        </div>
      ))}

      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 15, color: "var(--ink)", marginBottom: 6 }}>
          <strong>今日小结</strong>
        </div>
        <textarea
          style={{ ...ta, minHeight: 96 }}
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
        />
      </div>

      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <button
          disabled={busy}
          onClick={() => submit("save")}
          style={{
            padding: "10px 20px",
            borderRadius: 8,
            border: "1px solid var(--line)",
            background: "#fff",
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          保存草稿
        </button>
        <button
          disabled={busy}
          onClick={() => submit("finalize")}
          style={{
            padding: "10px 20px",
            borderRadius: 8,
            border: "none",
            background: "#d97706",
            color: "#fff",
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          定稿并发送邮件
        </button>
        <span style={{ fontSize: 13, color: "var(--muted)" }}>{msg}</span>
      </div>
    </div>
  );
}

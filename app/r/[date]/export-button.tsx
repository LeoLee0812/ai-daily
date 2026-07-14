"use client";

// 一键导出长图：把日报卡片渲染成 2x PNG 下载（可直接发微信群）

import { useState } from "react";
import { toPng } from "html-to-image";

export default function ExportButton({ date }: { date: string }) {
  const [busy, setBusy] = useState(false);

  async function exportImage() {
    const node = document.getElementById("report-card");
    if (!node) return;
    setBusy(true);
    try {
      const dataUrl = await toPng(node, {
        pixelRatio: 2,
        backgroundColor: "#ffffff",
        // 排除标了 data-noexport 的元素（按钮本身等）
        filter: (n) =>
          !(n instanceof HTMLElement && n.dataset?.noexport !== undefined),
      });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `leo-ai-daily-${date.replaceAll("-", "")}.png`;
      a.click();
    } catch (e) {
      alert(`导出失败：${e instanceof Error ? e.message : e}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      data-noexport
      onClick={exportImage}
      disabled={busy}
      style={{
        position: "fixed",
        right: 20,
        bottom: 20,
        padding: "12px 20px",
        borderRadius: 999,
        border: "none",
        background: "#111827",
        color: "#fff",
        fontSize: 14,
        fontWeight: 600,
        cursor: "pointer",
        boxShadow: "0 4px 12px rgba(0,0,0,.2)",
      }}
    >
      {busy ? "导出中…" : "📷 导出长图"}
    </button>
  );
}

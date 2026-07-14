// 极简 markdown → HTML（只支持日报会用到的子集：段落、加粗、行内代码、链接、无序列表）

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function inline(s: string): string {
  return escapeHtml(s)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(
      /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener">$1</a>',
    );
}

// 管道表格行 → <tr>（带内联样式，邮件客户端也能正常显示）
function tableRow(line: string, isHeader: boolean): string {
  const cells = line
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());
  const tag = isHeader ? "th" : "td";
  const style = isHeader
    ? "border:1px solid #e5e7eb;padding:6px 10px;background:#f3f4f6;text-align:left;font-size:13px;"
    : "border:1px solid #e5e7eb;padding:6px 10px;font-size:13px;";
  return `<tr>${cells.map((c) => `<${tag} style="${style}">${inline(c)}</${tag}>`).join("")}</tr>`;
}

const isTableLine = (l: string) => /^\|.*\|$/.test(l);
const isTableSep = (l: string) => /^\|[\s\-:|]+\|$/.test(l);

export function mdToHtml(md: string): string {
  const lines = md.split(/\r?\n/);
  const out: string[] = [];
  let listOpen = false;
  let tableOpen = false;
  let tableHeaderDone = false;
  let para: string[] = [];

  const flushPara = () => {
    if (para.length) {
      out.push(`<p>${inline(para.join(" "))}</p>`);
      para = [];
    }
  };
  const closeList = () => {
    if (listOpen) {
      out.push("</ul>");
      listOpen = false;
    }
  };
  const closeTable = () => {
    if (tableOpen) {
      out.push("</table></div>");
      tableOpen = false;
      tableHeaderDone = false;
    }
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flushPara();
      closeList();
      closeTable();
      continue;
    }
    if (isTableLine(line)) {
      flushPara();
      closeList();
      if (isTableSep(line)) continue; // 分隔行跳过
      if (!tableOpen) {
        out.push(
          '<div style="overflow-x:auto;"><table style="border-collapse:collapse;margin:10px 0;width:100%;">',
        );
        tableOpen = true;
        out.push(tableRow(line, true));
        tableHeaderDone = true;
      } else {
        out.push(tableRow(line, !tableHeaderDone));
      }
      continue;
    }
    closeTable();
    if (/^[-*]\s+/.test(line)) {
      flushPara();
      if (!listOpen) {
        out.push("<ul>");
        listOpen = true;
      }
      out.push(`<li>${inline(line.replace(/^[-*]\s+/, ""))}</li>`);
    } else {
      closeList();
      para.push(line);
    }
  }
  flushPara();
  closeList();
  closeTable();
  return out.join("\n");
}

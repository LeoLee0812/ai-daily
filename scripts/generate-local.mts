// 本地试跑：采集 → 生成 → 落盘 tmp/（有 BLOB_READ_WRITE_TOKEN 时同时写 Blob）
// 用法：npm run gen [-- 2026-07-14]

import { mkdirSync, writeFileSync } from "node:fs";
import { collectCandidates } from "../lib/sources";
import { generateReport } from "../lib/generate";
import { beijingToday, saveReport } from "../lib/store";
import { renderEmailHtml } from "../lib/email";

const date = process.argv[2] || beijingToday();

console.log(`[1/3] 采集信源…`);
const candidates = await collectCandidates();
console.log(`      拿到 ${candidates.length} 条候选`);
if (candidates.length < 5) {
  console.error("候选太少，退出");
  process.exit(1);
}

console.log(`[2/3] DeepSeek 生成日报…`);
const report = await generateReport(date, candidates);

console.log(`[3/3] 落盘…`);
mkdirSync("tmp", { recursive: true });
writeFileSync(`tmp/${date}.json`, JSON.stringify(report, null, 2));
writeFileSync(`tmp/${date}.html`, renderEmailHtml(report));
console.log(`      tmp/${date}.json + tmp/${date}.html`);

if (process.env.BLOB_READ_WRITE_TOKEN) {
  const url = await saveReport(report);
  console.log(`      Blob: ${url}`);
}

console.log("\n== 今日要点 ==");
for (const h of report.highlights) console.log("· " + h);

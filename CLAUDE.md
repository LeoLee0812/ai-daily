# ai-daily — Leo 的 AI 日报

全自动 AI 日报流水线：采集信源 → DeepSeek 撰写 → Vercel Blob 归档 → Resend 邮件。上线于 **daily.saveme505.help**。形式逆向自老卫（@imwsl90）的「AI 玩耍群日报」。

## 技术栈与架构决策

- Next.js 16 App Router + TypeScript，无数据库、无登录门禁（内容公开）
- **存储用 Vercel Blob 而不是 Supabase**：bomi-jinan 的 `ms_app` 角色没有 DDL 权限（`permission denied for schema public`），建新表要走 Supabase MCP 人工授权；Blob 免建表、公开读、固定路径覆盖写，正合适。路径 `reports/YYYY-MM-DD.json`
- 文案引擎 DeepSeek（`@ai-sdk/deepseek` + `generateObject`），模型 `deepseek-chat`。deepseek 对 json_schema 走兼容模式（schema 注入 system），会打 warning，属正常
- 邮件直接 fetch Resend HTTP API（不引 SDK），发件人 `claude@saveme505.help`

## 信源契约（必须遵守）

- **aihot.virxact.com**：与 media-studio 同一套限流契约——串行 ≥1.1s、429 退避 30-60s、自报 UA `ai-daily-sync/1.0 (+mailto:…)`、只用官方 JSON API 不爬 HTML
- **HN Algolia**：`points>80` + AI 关键词，近 26h
- 任一信源挂掉不阻塞整体（`Promise.allSettled`）；候选 <5 条时放弃生成返回 502

## Cron 与幂等

- `vercel.json` cron：`30 1 * * *`（UTC）= 北京 09:30；Vercel 自动带 `Authorization: Bearer $CRON_SECRET` 调 `/api/cron/daily`
- 路由幂等：当天已有日报直接跳过；`?force=1` 强制重跑；`?date=` 补历史
- 邮件失败只记日志不失败整个请求（日报已落盘）

## 目录

```
app/api/cron/daily/route.ts  生成入口（鉴权+幂等+采集+生成+存储+邮件）
app/page.tsx                 归档列表    app/r/[date]/page.tsx  单日日报页
lib/sources.ts   信源采集     lib/generate.ts  DeepSeek 生成（人设+反AI腔在 SYSTEM）
lib/store.ts     Blob 存取    lib/email.ts     邮件渲染+Resend 发送
lib/markdown.ts  极简 md→html（页面与邮件共用）
scripts/generate-local.mts   本地试跑（npm run gen，落盘 tmp/）
```

## 常用命令

```bash
npm run gen              # 本地完整试跑（不发邮件；有 BLOB token 时会写线上）
npm run build            # 构建验证
vercel env ls            # 核对线上环境变量
```

## 环境变量

`DEEPSEEK_API_KEY` `LLM_MODEL` `RESEND_API_KEY` `MAIL_TO` `CRON_SECRET` `BLOB_READ_WRITE_TOKEN`（Blob store 连接项目后自动注入，本地要用 `vercel env pull`）`SITE_URL`

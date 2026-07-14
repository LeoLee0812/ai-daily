# ai-daily — Leo 的 AI 日报

全自动 AI 日报流水线：采集信源 → DeepSeek 撰写 → Vercel Blob 归档 → Resend 邮件。上线于 **daily.saveme505.help**。形式逆向自老卫（@imwsl90）的「AI 玩耍群日报」。

## 技术栈与架构决策

- Next.js 16 App Router + TypeScript，无数据库、无登录门禁（内容公开）
- **存储用 Vercel Blob 而不是 Supabase**：bomi-jinan 的 `ms_app` 角色没有 DDL 权限（`permission denied for schema public`），建新表要走 Supabase MCP 人工授权；Blob 免建表、公开读、固定路径覆盖写，正合适。路径 `reports/YYYY-MM-DD.json`
- 文案引擎 DeepSeek（`@ai-sdk/deepseek` + `generateObject`），模型 `deepseek-chat`。deepseek 对 json_schema 走兼容模式（schema 注入 system），会打 warning，属正常
- 邮件直接 fetch Resend HTTP API（不引 SDK），发件人 `claude@saveme505.help`

## 信源（v2，已弃用 aihot）

- **RSS**（`lib/sources.ts` 的 `FEEDS`）：OpenAI / Google AI / Google DeepMind 官方 + TechCrunch AI / The Verge AI / VentureBeat AI / 9to5Mac / Ars Technica（后两者 AI 关键词过滤）+ Simon Willison。自写极简解析器兼容 RSS 2.0 与 Atom，不引 XML 依赖。UA 必须是浏览器样式（blog.google 拒绝 bot UA）；Anthropic 官网无 RSS（404），靠媒体源覆盖
- **HN Algolia**：`points>50` + AI 关键词，近 26h
- 任一信源挂掉不阻塞整体（`Promise.allSettled`）；候选 <5 条时放弃生成返回 502
- **两段式生成**：先选题（4-5 条+角度）→ 逐条 `fetchArticleText` 抓原文（≤9000 字符）并发深挖 → 汇总要点/小结。深度来自原文抓取，这是和"聚合器标题直接写"拉开差距的关键

## 人工审核 + 长图（v2）

- 报告有 `status: draft|final`。cron 只出草稿并发 [草稿待审] 邮件（带 `/edit/[date]?key=ADMIN_KEY` 按钮）；`/edit` 页逐条改点评/小结，「定稿并发送邮件」→ `/api/report/update`（POST，ADMIN_KEY 鉴权）→ status=final + 正式邮件
- 长图导出：`/r/[date]` 右下角按钮，`html-to-image` 客户端 toPng（pixelRatio 2），`data-noexport` 元素会被过滤掉不进图

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

## 视频工作台（v3，逆向自橘鸦 AI 早报）

- `/studio?key=ADMIN_KEY`：选素材（当日日报条目+实时信源，勾选≤10条）→ DeepSeek 生成口播稿（开场/逐事件/结尾+卡片要点）→ 逐句火山 TTS 定时间轴 → satori 卡片 + sharp 字幕帧 + ffmpeg 成片
- **画面不走浏览器截图**：卡片用 satori(flexbox)+resvg 纯 Node 渲染，1920x1080 NotebookLM 风（米杏底 #F7F3EC + 玫红标题 #E0537A + 白底黑框要点卡），字幕预合成进帧，进度条用 ffmpeg overlay x 表达式
- 字体：`assets/fonts/` 是 GB2312 子集化的 Noto Sans SC（1.8MB/枚），别删；next.config 的 `outputFileTracingIncludes` 带上了字体和 ffmpeg 二进制
- 数据：Blob `videos/YYYY-MM-DD/`（job.json 状态机 script→audio→rendering→done + audio/*.mp3 + 成片/SRT）
- 火山 TTS：V1 非流式 `openspeech.bytedance.com/api/v1/tts`，**Authorization 是 `Bearer;token` 分号分隔**，单请求≤300汉字所以按句拆分逐句合成，事件间隙 0.45s 静音在音频 concat 清单里补
- `npm run render -- YYYY-MM-DD [--tts]`：线上 300s 超时跑不完时的本地渲染兜底（写回同一 Blob）
- 旧 CSS 变量与 shadcn 撞名的已改 `--d-muted/--d-accent`；全局禁止再写未分层的 `* { margin:0 }`（会压过 Tailwind 工具类）

### 新增环境变量（火山引擎语音合成）

`VOLC_TTS_APP_ID` `VOLC_TTS_ACCESS_TOKEN` `VOLC_TTS_CLUSTER`(默认 volcano_tts) `VOLC_TTS_VOICE`(默认 BV700_V2_streaming) `VOLC_TTS_SPEED`(默认 1.0)

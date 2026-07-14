// 本地渲染兜底：线上函数超时跑不完时，在本机完成 TTS/成片并回写 Blob
// 用法：npm run render -- 2026-07-14 [--tts]（--tts 表示连语音一起重新合成）

import { getJob, saveJob } from "../lib/studio/store";
import { synthesizeScript } from "../lib/studio/tts";
import { renderVideo } from "../lib/studio/video";

async function main() {
  const args = process.argv.slice(2).filter((a) => a !== "--");
  const date = args.find((a) => /^\d{4}-\d{2}-\d{2}$/.test(a));
  const withTts = args.includes("--tts");
  if (!date) {
    console.error("用法：npm run render -- YYYY-MM-DD [--tts]");
    process.exit(1);
  }

  const job = await getJob(date);
  if (!job) throw new Error(`没有 ${date} 的视频任务，先在工作台生成口播稿`);

  if (withTts || !job.timeline) {
    console.log("合成语音（火山引擎）…");
    job.timeline = await synthesizeScript(job.date, job.script);
    job.status = "audio";
    await saveJob(job);
    console.log(`语音就绪，全片 ${job.timeline.totalDuration.toFixed(1)}s`);
  }

  console.log("合成视频…");
  const t0 = Date.now();
  const { videoUrl, srtUrl } = await renderVideo(job);
  job.videoUrl = videoUrl;
  job.srtUrl = srtUrl;
  job.status = "done";
  await saveJob(job);
  console.log(`完成，耗时 ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  console.log("videoUrl:", videoUrl);
  console.log("srtUrl:", srtUrl);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

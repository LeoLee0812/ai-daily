import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 原生依赖不打包进 bundle，运行时从 node_modules 加载
  serverExternalPackages: ["@resvg/resvg-js", "sharp", "ffmpeg-static"],
  // 视频渲染相关函数需要带上字体文件与 ffmpeg 二进制
  outputFileTracingIncludes: {
    "/api/studio/render": ["./assets/fonts/**", "./node_modules/ffmpeg-static/ffmpeg"],
    "/api/studio/tts": ["./assets/fonts/**"],
  },
};

export default nextConfig;

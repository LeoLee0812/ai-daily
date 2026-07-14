// get-mp3-duration 无官方类型声明
declare module "get-mp3-duration" {
  /** 解析 mp3 帧头返回时长（毫秒） */
  export default function getMP3Duration(buffer: Buffer): number;
}

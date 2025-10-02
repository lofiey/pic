// Quantumult X - YouTube App 自动字幕强制繁体中文
// 作者: ChatGPT

let url = $request.url;

// 仅处理字幕接口
if (url.includes("/api/timedtext")) {

  // 移除已有的 tlang 参数
  url = url.replace(/(&|\?)tlang=[^&]*/g, "");

  // 移除已有的 hl 参数
  url = url.replace(/(&|\?)hl=[^&]*/g, "");

  // 如果最后没有 ? 就加 &
  if (url.includes("?")) {
    url += "&tlang=zh-Hant&hl=zh-Hant";
  } else {
    url += "?tlang=zh-Hant&hl=zh-Hant";
  }

  // 输出修改后的请求
  $done({ url: url });

} else {
  $done({});
}

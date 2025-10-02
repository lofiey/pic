/**
 * Quantumult X - 拦截 youtubei player 响应，尝试为 captionTracks 的 baseUrl 加上 tlang=zh-Hant
 * 说明：若 response 为 JSON，此脚本可工作；若为 protobuf 或不可解析格式，则无法处理。
 */

let body = $response.body;
let url = $request.url || "";

try {
  // 只处理 player 接口响应
  if (!/youtubei\.googleapis\.com\/youtubei\/v1\/player/.test(url)) {
    $done({ body });
  }

  // 尝试解析 JSON
  let obj = JSON.parse(body);

  // 有些响应把 captions 放在 obj.captions.playerCaptionsTracklistRenderer.captionTracks
  let tracks = null;
  if (obj && obj.captions && obj.captions.playerCaptionsTracklistRenderer && Array.isArray(obj.captions.playerCaptionsTracklistRenderer.captionTracks)) {
    tracks = obj.captions.playerCaptionsTracklistRenderer.captionTracks;
  } else if (obj && obj.captions && Array.isArray(obj.captions.captionTracks)) {
    // 兼容性备选
    tracks = obj.captions.captionTracks;
  } else if (obj && obj.captions && obj.captions.playerCaptionsTracklistRenderer && obj.captions.playerCaptionsTracklistRenderer.caption_tracks) {
    tracks = obj.captions.playerCaptionsTracklistRenderer.caption_tracks;
  }

  if (Array.isArray(tracks)) {
    for (let i = 0; i < tracks.length; i++) {
      let t = tracks[i];
      if (!t || !t.baseUrl) continue;

      // 如果已经有 tlang，就替换为 zh-Hant
      if (/(\?|&)(tlang)=[^&]*/.test(t.baseUrl)) {
        t.baseUrl = t.baseUrl.replace(/([?&])tlang=[^&]*/, "$1tlang=zh-Hant");
      } else {
        // 若 baseUrl 含有 ? 则用 & 否则用 ?
        t.baseUrl = t.baseUrl + (t.baseUrl.includes("?") ? "&tlang=zh-Hant" : "?tlang=zh-Hant");
      }

      // 试着也把 hl 加上（有时后端也看 hl）
      if (/(\?|&)(hl)=[^&]*/.test(t.baseUrl)) {
        t.baseUrl = t.baseUrl.replace(/([?&])hl=[^&]*/, "$1hl=zh-Hant");
      } else {
        t.baseUrl = t.baseUrl + "&hl=zh-Hant";
      }

      // 辅助：把 languageCode 标注为 zh-Hant，某些客户端会读取
      try {
        if (t.languageCode && t.languageCode !== "zh-Hant") {
          t.languageCode = "zh-Hant";
        }
      } catch (e) {}

      // 辅助：若含有 name 字段，标注一下
      if (t.name && t.name.simpleText) {
        t.name.simpleText = t.name.simpleText + " (繁體自動翻譯)";
      }
    }

    // 写回 body
    let newBody = JSON.stringify(obj);
    $done({ body: newBody });
  } else {
    // 没有找到 captions 路径，直接返回原 body
    $done({ body });
  }

} catch (err) {
  // 解析失败（可能是 protobuf 或非 JSON），返回原 body，打印到日志（若 QX 支持）
  console.log("yt-player-captions-fix error: " + err);
  $done({ body });
}

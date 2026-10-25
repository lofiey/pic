/*
 * YouTube 字幕请求探针 (Quantumult X)
 * 只在请求地址里出现字幕相关关键词时弹通知，不修改任何内容。
 *
 * [rewrite_local]
 * ^https:\/\/[^\/]*(youtube\.com|googleapis\.com)\/ url script-request-header youtube-probe.js
 *
 * [mitm]
 * hostname = *.youtube.com, youtubei.googleapis.com
 */
const u = $request.url;
if (/timedtext|caption|subtitle|transcript|\/api\/tt/i.test(u)) {
  $notify("YT探针 命中", u.split("?")[0], u.slice(0, 300));
  console.log("PROBE " + u);
}
$done({});

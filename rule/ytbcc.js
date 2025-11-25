// yt-subtitle-cgw.js
// [c g w] YouTube App 自动字幕翻译 — Simplified Chinese
// QuantumultX script-response-body

let body = $response.body;
if (!body) $done({});
let json; try { json = JSON.parse(body); } catch { $done({ body }); }

// 提取字幕文本（APP API 返回 JSON）
function collect(o, arr) {
  if (!o) return;
  if (typeof o === "object") {
    if (o.simpleText) arr.push(o.simpleText);
    if (o.runs) o.runs.forEach(r => r.text && arr.push(r.text));
    Object.values(o).forEach(v => collect(v, arr));
  }
}
let texts = [];
collect(json, texts);
texts = [...new Set(texts)].filter(t => t.trim());

// 若无文本直接返回
if (texts.length === 0) $done({ body });

// 翻译函数（Google 无需 Key）
function translate(t, cb) {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=zh-CN&dt=t&q=${encodeURIComponent(t)}`;
  $httpClient.get(url, (err, resp, data) => {
    if (!err && data) {
      try {
        const arr = JSON.parse(data);
        let output = arr[0].map(i => i[0]).join("");
        cb(output);
      } catch { cb(t); }
    } else cb(t);
  });
}

let pending = texts.length, dict = {};
texts.forEach(t => translate(t, r => {
  dict[t] = r; if (--pending === 0) replace();
}));

// 替换所有字幕文本
function replace() {
  (function walk(o) {
    if (typeof o === "object") {
      if (o.simpleText && dict[o.simpleText]) o.simpleText = dict[o.simpleText];
      if (o.runs) o.runs.forEach(r => r.text && (r.text = dict[r.text] || r.text));
      Object.values(o).forEach(v => walk(v));
    }
  })(json);
  $done({ body: JSON.stringify(json) });
}

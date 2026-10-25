/*
 * YouTube 双语字幕 for Quantumult X
 * 原文在上，译文在下；自动字幕会重新断句，避免重叠堆叠。
 *
 * [rewrite_local]
 * ^https:\/\/(www|m)\.youtube\.com\/api\/timedtext\? url script-response-body youtube-dual.js
 *
 * [mitm]
 * hostname = www.youtube.com, m.youtube.com
 *
 * 使用前请先停用原来的 DualSubs YouTube 重写，避免冲突。
 */

const CFG = {
  target: "zh-Hans",       // 译文语言：zh-Hans 简体 / zh-Hant 繁体 / ja / ko ...
  translationFirst: false, // false：原文在上译文在下；true：反过来
  maxWidth: 84,            // 单条字幕最大宽度（英文算1，中日韩算2）
  minWidth: 36,            // 遇到句末标点时，至少达到此宽度才断句
  gapMs: 1500,             // 两个词之间停顿超过这个毫秒数就断句
  maxCueMs: 6500,          // 单条字幕最长持续时间
  maxSplit: 4,             // 一句译文最多拆给几条原文
};

(async () => {
  try {
    const url = $request.url;
    if (/[?&]dsx=1/.test(url)) return $done({});
    if ($response.statusCode && $response.statusCode !== 200) return $done({});

    const body = $response.body || "";
    const fmt = sniff(body);
    if (!fmt) return $done({});

    const lang = (getParam(url, "lang") || "").toLowerCase().split("-")[0];
    const userT = getParam(url, "tlang");
    const target = userT || CFG.target;
    // 本身就是目标语言，不需要翻译
    if (!userT && lang && lang === target.toLowerCase().split("-")[0]) return $done({});

    const headers = Object.assign({}, $request.headers);
    Object.keys(headers).forEach((k) => { if (k[0] === ":") delete headers[k]; });

    const base = setParam(delParam(url, "tlang"), "fmt", "json3");
    const origUrl = setParam(base, "dsx", "1");
    const transUrl = setParam(setParam(base, "tlang", target), "dsx", "1");

    const get = (u) => $task.fetch({ url: u, method: "GET", headers }).then((r) => r.body || "");
    let origTxt = null, transTxt = null;
    if (fmt === "json3") { if (userT) transTxt = body; else origTxt = body; }
    [origTxt, transTxt] = await Promise.all([
      origTxt !== null ? origTxt : get(origUrl),
      transTxt !== null ? transTxt : get(transUrl),
    ]);

    const origEv = parseJson3(origTxt);
    if (!origEv.length) return $done({});
    const transEv = parseJson3(transTxt);

    const asr = /[?&]kind=asr/.test(url) ||
      origEv.some((e) => e.segs.some((s) => s.tOffsetMs !== undefined));
    const cues = asr ? buildAsrCues(origEv) : buildPlainCues(origEv);
    if (!cues.length) return $done({});

    attachTranslation(cues, toTransItems(transEv));

    const out = render(cues, fmt);
    $done({ body: out });
  } catch (e) {
    console.log("youtube-dual error: " + e);
    $done({});
  }
})();

/* ---------- 工具函数 ---------- */

function sniff(b) {
  const s = b.trim();
  if (!s) return null;
  if (s[0] === "{") return "json3";
  if (/^WEBVTT/.test(s)) return "vtt";
  if (s[0] === "<") return /<body>/.test(s.slice(0, 600)) ? "srv3" : "srv1";
  return null;
}

function getParam(u, k) {
  const m = u.match(new RegExp("[?&]" + k + "=([^&]*)"));
  return m ? decodeURIComponent(m[1]) : null;
}
function delParam(u, k) {
  return u
    .replace(new RegExp("([?&])" + k + "=[^&]*(&|$)"), (s, a, b) => (b === "&" ? a : ""))
    .replace(/[?&]$/, "");
}
function setParam(u, k, v) {
  u = delParam(u, k);
  return u + (u.indexOf("?") >= 0 ? "&" : "?") + k + "=" + encodeURIComponent(v);
}

const CJK = /[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af\uff00-\uffef]/;
function width(s) {
  let w = 0;
  for (const c of s) w += CJK.test(c) ? 2 : 1;
  return w;
}
function joinText(a, b) {
  b = (b || "").replace(/\s+/g, " ").trim();
  a = (a || "").replace(/\s+$/, "");
  if (!a) return b;
  if (!b) return a;
  const x = a.slice(-1), y = b[0];
  if (CJK.test(x) || CJK.test(y) || /[,.!?;:)，。！？、；：）]/.test(y)) return a + b;
  return a + " " + b;
}

function parseJson3(txt) {
  try {
    const j = JSON.parse(txt);
    return (j.events || []).filter((e) => e.segs && e.segs.length);
  } catch (e) {
    return [];
  }
}

/* ---------- 断句 ---------- */

// 自动字幕：拆成词 → 去重 → 按停顿/标点/长度重新分句
function buildAsrCues(events) {
  const words = [], seen = new Set();
  for (const e of events) {
    const st0 = e.tStartMs || 0, end = st0 + (e.dDurationMs || 0);
    for (const s of e.segs) {
      const t = (s.utf8 || "").replace(/\s+/g, " ").trim();
      if (!t) continue;
      const st = st0 + (s.tOffsetMs || 0);
      const key = st + "|" + t;
      if (seen.has(key)) continue;
      seen.add(key);
      words.push({ st, end, t });
    }
  }
  words.sort((a, b) => a.st - b.st);

  const cues = [];
  let cur = null;
  for (const w of words) {
    if (cur) {
      const w0 = width(cur.text);
      const brk =
        w.st - cur.lastSt > CFG.gapMs ||
        w0 >= CFG.maxWidth ||
        w.st - cur.st > CFG.maxCueMs ||
        (w0 >= CFG.minWidth && /[.?!。？！…]$/.test(cur.text));
      if (brk) { cues.push(cur); cur = null; }
    }
    if (!cur) cur = { st: w.st, lastSt: w.st, evEnd: w.end, text: w.t };
    else {
      cur.text = joinText(cur.text, w.t);
      cur.lastSt = w.st;
      cur.evEnd = w.end;
    }
  }
  if (cur) cues.push(cur);

  cues.forEach((c, i) => {
    const next = i + 1 < cues.length ? cues[i + 1].st : Infinity;
    const guess = Math.max(c.lastSt + 800, Math.min(c.evEnd, c.lastSt + 3000));
    c.end = Math.min(next, guess);
  });
  return cues;
}

// 人工字幕：一个 event 就是一条，只做去重和防重叠
function buildPlainCues(events) {
  const cues = [], seen = new Set();
  for (const e of events) {
    const text = e.segs.map((s) => s.utf8 || "").join("").replace(/\s+/g, " ").trim();
    if (!text) continue;
    const st = e.tStartMs || 0;
    const key = st + "|" + text;
    if (seen.has(key)) continue;
    seen.add(key);
    cues.push({ st, end: st + (e.dDurationMs || 2000), text });
  }
  cues.sort((a, b) => a.st - b.st);
  cues.forEach((c, i) => {
    if (i + 1 < cues.length) c.end = Math.min(c.end, cues[i + 1].st);
  });
  return cues.filter((c) => c.end > c.st);
}

/* ---------- 译文对齐 ---------- */

function toTransItems(events) {
  const out = [], seen = new Set();
  for (const e of events) {
    const text = e.segs.map((s) => s.utf8 || "").join("").replace(/\s+/g, " ").trim();
    if (!text) continue;
    const st = e.tStartMs || 0;
    const key = st + "|" + text;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ st, end: st + (e.dDurationMs || 2000), text });
  }
  return out.sort((a, b) => a.st - b.st);
}

// 最后一个 starts[i] <= t 的下标，没有则返回 0
function locate(starts, t) {
  let lo = 0, hi = starts.length - 1, ans = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (starts[mid] <= t) { ans = mid; lo = mid + 1; } else hi = mid - 1;
  }
  return ans;
}

function splitText(text, weights) {
  const total = weights.reduce((a, b) => a + b, 0) || 1;
  const isCut = (ch) => /[，。！？、；,.!?; ]/.test(ch || "");
  const out = [];
  let pos = 0, acc = 0;
  for (let i = 0; i < weights.length - 1; i++) {
    acc += weights[i];
    const cut = Math.round((text.length * acc) / total);
    let best = cut;
    for (let d = 0; d <= 5; d++) {
      if (isCut(text[cut + d - 1])) { best = cut + d; break; }
      if (cut - d > pos && isCut(text[cut - d - 1])) { best = cut - d; break; }
    }
    best = Math.max(pos, Math.min(best, text.length));
    out.push(text.slice(pos, best).trim());
    pos = best;
  }
  out.push(text.slice(pos).trim());
  return out;
}

function attachTranslation(cues, items) {
  const starts = cues.map((c) => c.st);
  for (const t of items) {
    const i0 = locate(starts, t.st + 150);
    let i1 = locate(starts, t.end - 300);
    if (i1 < i0) i1 = i0;
    if (i1 - i0 + 1 > CFG.maxSplit) i1 = i0 + CFG.maxSplit - 1;

    if (i1 > i0) {
      const idx = [];
      for (let i = i0; i <= i1; i++) idx.push(i);
      const parts = splitText(t.text, idx.map((i) => width(cues[i].text)));
      idx.forEach((ci, k) => { cues[ci].tr = joinText(cues[ci].tr, parts[k]); });
    } else {
      cues[i0].tr = joinText(cues[i0].tr, t.text);
    }
  }
}

/* ---------- 输出 ---------- */

function lineText(c) {
  if (!c.tr) return c.text;
  return CFG.translationFirst ? c.tr + "\n" + c.text : c.text + "\n" + c.tr;
}

function pad(n, l) { return String(n).padStart(l, "0"); }
function vttTime(ms) {
  ms = Math.max(0, Math.round(ms));
  return pad(Math.floor(ms / 3600000), 2) + ":" + pad(Math.floor(ms / 60000) % 60, 2) + ":" +
    pad(Math.floor(ms / 1000) % 60, 2) + "." + pad(ms % 1000, 3);
}
function esc(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function render(cues, fmt) {
  if (fmt === "json3") {
    return JSON.stringify({
      wireMagic: "pb3",
      events: cues.map((c) => ({
        tStartMs: Math.round(c.st),
        dDurationMs: Math.round(c.end - c.st),
        segs: [{ utf8: lineText(c) }],
      })),
    });
  }
  if (fmt === "vtt") {
    return "WEBVTT\n\n" + cues.map((c) =>
      vttTime(c.st) + " --> " + vttTime(c.end) + "\n" + lineText(c) + "\n").join("\n");
  }
  if (fmt === "srv3") {
    return '<?xml version="1.0" encoding="utf-8" ?><timedtext format="3"><body>' +
      cues.map((c) => '<p t="' + Math.round(c.st) + '" d="' + Math.round(c.end - c.st) + '">' +
        esc(lineText(c)) + "</p>").join("") + "</body></timedtext>";
  }
  return '<?xml version="1.0" encoding="utf-8" ?><transcript>' +
    cues.map((c) => '<text start="' + (c.st / 1000).toFixed(3) + '" dur="' +
      ((c.end - c.st) / 1000).toFixed(3) + '">' + esc(lineText(c)) + "</text>").join("") +
    "</transcript>";
}

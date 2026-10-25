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
  googleTimeoutMs: 8000,   // 谷歌翻译最多等待多久，超时就用已翻译好的部分
  googleRetry: 1,          // 谷歌翻译遇到 429/5xx 时，每个地址重试几次（间隔 0.5s、1s 递增）
  cacheVideos: 8,          // 缓存最近多少个视频的译文（重开字幕不再重复请求）
  useTlang: false,         // 是否先请求 YouTube 自带译文（容易被 429 限流，默认关）
  fallbackGoogle: true,    // YouTube 自带译文拿不到时，改用谷歌翻译
  debug: true,             // 调试：失败时把原因显示在字幕上，正常后改成 false
};

let FMT = null;
const DBG = [];

(async () => {
  try {
    const url = $request.url;
    if (/[?&]dsx=1/.test(url)) return $done({});
    if ($response.statusCode && $response.statusCode !== 200) return $done({});

    const body = $response.body || "";
    const fmt = sniff(body);
    FMT = fmt;
    DBG.push("fmt=" + fmt, "bodyLen=" + body.length);
    if (!fmt) return $done({});

    const lang = (getParam(url, "lang") || "").toLowerCase().split("-")[0];
    const userT = getParam(url, "tlang");
    const target = userT || CFG.target;
    // 本身就是目标语言，不需要翻译
    if (!userT && lang && lang === target.toLowerCase().split("-")[0]) return $done({});

    const headers = Object.assign({}, $request.headers);
    Object.keys(headers).forEach((k) => { if (k[0] === ":") delete headers[k]; });

    const noT = delParam(url, "tlang");
    const origUrl = setParam(noT, "dsx", "1");
    const transUrl = setParam(setParam(noT, "tlang", target), "dsx", "1");

    const get = async (u, tag) => {
      const r = await $task.fetch({ url: u, method: "GET", headers });
      const t = r.body || "";
      DBG.push(tag + "=" + r.statusCode + "/" + t.length);
      console.log("youtube-dual " + tag + " " + r.statusCode + " len=" + t.length);
      return t;
    };
    let origTxt = userT ? null : body, transTxt = userT ? body : null;
    [origTxt, transTxt] = await Promise.all([
      origTxt !== null ? origTxt : get(origUrl, "orig"),
      transTxt !== null ? transTxt : (CFG.useTlang ? get(transUrl, "trans") : ""),
    ]);

    const origEv = parseEvents(origTxt);
    if (!origEv.length) {
      DBG.push("原文为空");
      return $done(CFG.debug ? { body: render([{ st: 0, end: 8000, text: "[DS] " + DBG.join(" ") }], fmt) } : {});
    }
    const transEv = parseEvents(transTxt);

    const asr = /[?&]kind=asr/.test(url) ||
      origEv.some((e) => e.segs.some((s) => s.tOffsetMs !== undefined));
    const cues = asr ? buildAsrCues(origEv) : buildPlainCues(origEv);
    if (!cues.length) return $done({});

    attachTranslation(cues, toTransItems(transEv));

    let n = cues.filter((c) => c.tr).length;
    if (n === 0 && CFG.fallbackGoogle) {
      DBG.push("改用谷歌翻译");
      const trs = await googleTranslate(cues.map((c) => c.text), target, getParam(url, "v"));
      cues.forEach((c, i) => { if (trs[i]) c.tr = trs[i]; });
      n = cues.filter((c) => c.tr).length;
    }
    DBG.push("origEv=" + origEv.length, "transEv=" + transEv.length, "cues=" + cues.length, "withTr=" + n);
    console.log("youtube-dual " + DBG.join(" "));
    if (CFG.debug && n === 0) cues[0].tr = "[DS] 没有译文: " + DBG.join(" ");

    const outBody = render(cues, fmt);
    console.log("youtube-dual done bytes=" + outBody.length);
    $done({ body: outBody });
  } catch (e) {
    DBG.push("err=" + e);
    console.log("youtube-dual error: " + e);
    if (CFG.debug && FMT) {
      return $done({ body: render([{ st: 0, end: 8000, text: "[DS] " + DBG.join(" ") }], FMT) });
    }
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

function decodeXml(s) {
  return s
    .replace(/&#(\d+);/g, (m, n) => String.fromCodePoint(+n))
    .replace(/&#x([0-9a-f]+);/gi, (m, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
}
function attr(a, k) {
  const m = a.match(new RegExp("(?:^|\\s)" + k + '="([^"]*)"'));
  return m ? m[1] : null;
}

// 统一解析成 json3 风格的 events: {tStartMs, dDurationMs, segs:[{utf8, tOffsetMs}]}
function parseEvents(txt) {
  try {
    const t = (txt || "").trim();
    if (!t) return [];
    if (t[0] === "{") {
      return (JSON.parse(t).events || []).filter((e) => e.segs && e.segs.length);
    }
    const evs = [];
    let m;
    const reP = /<p\b([^>]*?)(?:\/>|>([\s\S]*?)<\/p>)/g;
    while ((m = reP.exec(t))) {
      const st = attr(m[1], "t"), d = attr(m[1], "d");
      if (st === null) continue;
      const inner = m[2] || "", segs = [];
      const reS = /<s\b([^>]*)>([\s\S]*?)<\/s>/g;
      let n;
      while ((n = reS.exec(inner))) {
        const o = attr(n[1], "t");
        const seg = { utf8: decodeXml(n[2].replace(/<[^>]+>/g, "")) };
        if (o !== null) seg.tOffsetMs = +o;
        segs.push(seg);
      }
      if (!segs.length) segs.push({ utf8: decodeXml(inner.replace(/<[^>]+>/g, "")) });
      evs.push({ tStartMs: +st, dDurationMs: d ? +d : 0, segs });
    }
    if (evs.length) return evs;
    const reT = /<text\b([^>]*)>([\s\S]*?)<\/text>/g;
    while ((m = reT.exec(t))) {
      const st = attr(m[1], "start"), d = attr(m[1], "dur");
      if (st === null) continue;
      evs.push({
        tStartMs: Math.round(parseFloat(st) * 1000),
        dDurationMs: d ? Math.round(parseFloat(d) * 1000) : 0,
        segs: [{ utf8: decodeXml(m[2].replace(/<[^>]+>/g, "")) }],
      });
    }
    return evs;
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


/* ---------- 谷歌翻译保底 ---------- */

const GT_HOSTS = ["translate.googleapis.com", "translate.google.com", "translate.google.cn"];
const GT_UAS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.55 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:95.0) Gecko/20100101 Firefox/95.0",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 12_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/12.1 Mobile/15E148 Safari/604.1",
];
const sleep = (ms) => (typeof setTimeout === "function" ? new Promise((r) => setTimeout(r, ms)) : Promise.resolve());
const gtHeaders = () => ({
  "Content-Type": "application/x-www-form-urlencoded",
  "User-Agent": GT_UAS[Math.floor(Math.random() * GT_UAS.length)],
  Referer: "https://translate.google.com/",
  Accept: "*/*",
});

function loadCache(key, sig) {
  try {
    if (typeof $prefs === "undefined") return null;
    const raw = $prefs.valueForKey(key);
    if (!raw) return null;
    const o = JSON.parse(raw);
    return o.sig === sig && Array.isArray(o.tr) ? o.tr : null;
  } catch (e) { return null; }
}
function saveCache(key, sig, tr) {
  try {
    if (typeof $prefs === "undefined") return;
    $prefs.setValueForKey(JSON.stringify({ sig, tr }), key);
    let idx = [];
    try { idx = JSON.parse($prefs.valueForKey("ds_cache_index") || "[]"); } catch (e) {}
    idx = idx.filter((k) => k !== key);
    idx.push(key);
    while (idx.length > CFG.cacheVideos) $prefs.removeValueForKey(idx.shift());
    $prefs.setValueForKey(JSON.stringify(idx), "ds_cache_index");
  } catch (e) {}
}

async function googleTranslate(texts, target, vid) {
  const tl = target.replace("zh-Hans", "zh-CN").replace("zh-Hant", "zh-TW");
  const sig = texts.length + ":" + texts.reduce((a, t) => a + t.length, 0);
  const key = "ds_" + (vid || "x") + "_" + tl;
  const out = loadCache(key, sig) || new Array(texts.length).fill("");

  const todo = [];
  texts.forEach((t, i) => { if (!out[i]) todo.push(i); });
  DBG.push("cached=" + (texts.length - todo.length));
  if (!todo.length) return out;

  // 分批：尽量大批量，减少请求次数
  const batches = [];
  let cur = [], len = 0;
  todo.forEach((i) => {
    const t = texts[i];
    if (cur.length && (len + t.length > 4500 || cur.length >= 100)) {
      batches.push(cur); cur = []; len = 0;
    }
    cur.push(i); len += t.length + 1;
  });
  if (cur.length) batches.push(cur);

  const blocked = {};
  let ok = 0, lastStatus = "";
  // 带重试：429/5xx 退避后再试，其它状态码直接放弃该地址
  const tryFetch = async (mk) => {
    for (let k = 0; k <= CFG.googleRetry; k++) {
      try {
        const r = await $task.fetch(mk());
        lastStatus = r.statusCode;
        if (r.statusCode === 200) return r;
        if (r.statusCode === 429 || r.statusCode >= 500) { await sleep(500 * Math.pow(2, k)); continue; }
        return null;
      } catch (e) {
        console.log("youtube-dual google error: " + e);
        await sleep(500);
      }
    }
    return null;
  };

  const callGoogle = async (q) => {
    for (const h of GT_HOSTS) {
      if (blocked[h]) continue;
      const r = await tryFetch(() => ({
        url: "https://" + h + "/translate_a/single?client=gtx&sl=auto&dt=t&tl=" + tl,
        method: "POST",
        headers: gtHeaders(),
        body: "q=" + encodeURIComponent(q),
      }));
      if (!r) { blocked[h] = true; continue; }
      try { return { segs: JSON.parse(r.body)[0] || [] }; } catch (e) { blocked[h] = true; }
    }
    // 备用入口：Chrome 词典扩展接口，限流单独计算
    if (!blocked.clients5) {
      const r = await tryFetch(() => ({
        url: "https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=auto&tl=" + tl,
        method: "POST",
        headers: gtHeaders(),
        body: "q=" + encodeURIComponent(q.replace(/\n/g, "\r")),
      }));
      if (!r) blocked.clients5 = true;
      else {
        try {
          const a = JSON.parse(r.body);
          let arr;
          if (Array.isArray(a)) {
            arr = a.length === 1 && Array.isArray(a[0])
              ? (a[0].length > 1 ? a[0].slice(0, -1) : a[0])
              : a.map((x) => (Array.isArray(x) ? x[0] : x));
          } else if (a && a.sentences) arr = a.sentences.map((x) => x.trans);
          if (arr && arr.length) return { lines: arr.join("").split(/\r\n|\r|\n/) };
        } catch (e) {}
        blocked.clients5 = true;
      }
    }
    return null;
  };

  const runBatch = async (idx) => {
    const q = idx.map((i) => texts[i]).join("\n");
    const res = await callGoogle(q);
    if (!res) return;
    if (res.lines) {   // 备用接口：按行返回
      const ls = res.lines.map((x) => x.trim());
      const parts = ls.length === idx.length
        ? ls
        : splitText(ls.join(" "), idx.map((i) => width(texts[i])));
      idx.forEach((i, k) => { out[i] = parts[k] || ""; });
      ok++;
      return;
    }
    const segs = res.segs;

    const spans = [];
    let off = 0;
    idx.forEach((i) => { spans.push([off, off + texts[i].length]); off += texts[i].length + 1; });

    let pos = 0;
    const got = idx.map(() => []);
    for (const sg of segs) {
      const trans = (sg[0] || "").replace(/\n/g, " ").trim();
      const orig = sg[1] || "";
      const a = pos, b = pos + orig.length;
      pos = b;
      if (!trans) continue;
      const hit = [], wts = [];
      spans.forEach((sp, k) => {
        const ov = Math.min(b, sp[1]) - Math.max(a, sp[0]);
        if (ov > 0) { hit.push(k); wts.push(ov); }
      });
      if (!hit.length) continue;
      if (hit.length === 1) got[hit[0]].push(trans);
      else splitText(trans, wts).forEach((part, j) => got[hit[j]].push(part));
    }
    idx.forEach((i, k) => { out[i] = got[k].join(" ").trim(); });
    ok++;
  };

  const all = (async () => {
    for (let i = 0; i < batches.length; i += 2) {
      await Promise.all(batches.slice(i, i + 2).map(runBatch));
    }
  })();
  if (typeof setTimeout === "function") {
    await Promise.race([all, new Promise((r) => setTimeout(r, CFG.googleTimeoutMs))]);
  } else {
    await all;
  }

  saveCache(key, sig, out);   // 已翻译的部分也存下来，下次只补缺的
  const blk = Object.keys(blocked).length;
  DBG.push("google=" + ok + "/" + batches.length, "gs=" + lastStatus, "blocked=" + blk);
  return out;
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
  return s.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/g, "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
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

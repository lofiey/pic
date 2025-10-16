// youtube_translate_fallback.js
// QX script-response-body fallback for youtube timedtext / get_transcript
// 主要逻辑：
// 1) 如果响应就是可解析的字幕（XML / VTT / JSON） -> 尝试解析 & 翻译（使用 LibreTranslate 或直接返回带 tlang 的服务器结果）
// 2) 如果响应不是文本（或是 srv3 二进制），脚本会主动向同一请求 URL 追加 &tlang=zh-Hans 再次请求，若拿到文本就返回。
// 3) 最后保底返回原始响应（以免破坏视频）

(async () => {
  const origBody = $response.body || "";
  const reqUrl = $request.url || "";

  // 简单判断是否为文本字幕（XML/VTT/JSON）
  function isTextSubtitle(body, url) {
    if (!body) return false;
    if (/^\s*<\?xml/i.test(body)) return true;
    if (/^\s*WEBVTT/m.test(body)) return true;
    if (/\{[\s\S]*"events"[\s\S]*\}/.test(body)) return true; // youtube get_transcript JSON 局部判断
    // Sometimes srv3 still contains readable tags, try to detect <text>
    if (/<text\b[^>]*>/.test(body)) return true;
    // Also allow typical <transcript> xml
    if (/<transcript\b[^>]*>/.test(body)) return true;
    return false;
  }

  // 简单 HTML 实体 decode/encode
  function htmlDecode(s){ return s ? s.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'") : ''; }
  function htmlEncode(s){ return s ? s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;') : ''; }

  // 调用 LibreTranslate 批量翻译（单条调用，若你改用付费 API 请替换此函数）
  async function translateTextBatch(arr) {
    if (!arr || arr.length === 0) return arr;
    const SEP = "\n☃☃☃\n";
    const q = arr.join(SEP);
    try {
      const resp = await $task.fetch({
        url: "https://libretranslate.de/translate",
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q: q, source: "auto", target: "zh", format: "text" })
      });
      if (!resp || !resp.body) return arr;
      const json = JSON.parse(resp.body);
      // libretranslate.de 返回 { translatedText: "..." } for single q; for combined q it may be string - handle both
      let translated = json.translatedText ?? json; 
      if (typeof translated === "string") {
        return translated.split(SEP).map(s => (s||"").trim());
      } else {
        return arr;
      }
    } catch (e) {
      return arr;
    }
  }

  // 如果原响应看起来就是可解析文本，我们尝试直接处理并翻译（以保证简体）
  if (isTextSubtitle(origBody, reqUrl)) {
    try {
      // XML timedtext
      if (/^\s*<\?xml/i.test(origBody) || /<text\b/.test(origBody) || /<transcript\b/.test(origBody)) {
        // 抽取 <text> 内容
        const re = /<text\b[^>]*>([\s\S]*?)<\/text>/gi;
        const texts = [];
        let m;
        while ((m = re.exec(origBody)) !== null) texts.push(htmlDecode(m[1].replace(/\n+/g,' ').trim()));
        if (texts.length) {
          const uniq = Array.from(new Set(texts));
          const tr = await translateTextBatch(uniq);
          // 构建 map
          const map = Object.create(null);
          for (let i=0;i<uniq.length;i++) map[uniq[i]] = tr[i]||uniq[i];
          // 替换回去
          const newBody = origBody.replace(/(<text\b[^>]*>)([\s\S]*?)(<\/text>)/gi, (all, a, b, c) => {
            const dec = htmlDecode(b.replace(/\n+/g,' ').trim());
            return a + htmlEncode(map[dec] || dec) + c;
          });
          $done({ body: newBody });
          return;
        }
      }

      // VTT - 逐行替换非时间戳行
      if (/^\s*WEBVTT/m.test(origBody) || /\.vtt/i.test(reqUrl)) {
        const lines = origBody.split(/\r?\n/);
        const subs = [];
        for (const l of lines) {
          if (!l.trim()) continue;
          if (/-->/i.test(l)) continue;
          if (/^\d+$/.test(l.trim())) continue;
          subs.push(l.trim());
        }
        if (subs.length) {
          const uniq = Array.from(new Set(subs));
          const tr = await translateTextBatch(uniq);
          const map = Object.create(null);
          for (let i=0;i<uniq.length;i++) map[uniq[i]] = tr[i]||uniq[i];
          const newLines = lines.map(l => {
            const t = l.trim();
            if (!t || /-->/i.test(t) || /^\d+$/.test(t)) return l;
            return map[t] ? htmlEncode(map[t]) : l;
          });
          $done({ body: newLines.join("\n") });
          return;
        }
      }

      // JSON (youtubei get_transcript)
      if (/\{[\s\S]*"events"[\s\S]*\}/.test(origBody)) {
        const json = JSON.parse(origBody);
        const texts = [];
        const paths = []; // store pointers
        const cues = json.events || [];
        for (let i=0;i<cues.length;i++){
          const segs = cues[i].segs;
          if (!segs) continue;
          for (let j=0;j<segs.length;j++){
            const txt = segs[j].utf8 || segs[j].utf16 || segs[j].t || "";
            if (txt) { texts.push(txt); paths.push([i,j]); }
          }
        }
        if (texts.length) {
          const uniq = Array.from(new Set(texts));
          const tr = await translateTextBatch(uniq);
          const map = Object.create(null);
          for (let i=0;i<uniq.length;i++) map[uniq[i]] = tr[i]||uniq[i];
          // write back
          let idx = 0;
          for (let k=0;k<paths.length;k++){
            const i = paths[k][0], j = paths[k][1];
            const orig = texts[k];
            json.events[i].segs[j].utf8 = map[orig] || orig;
          }
          $done({ body: JSON.stringify(json) });
          return;
        }
      }

    } catch (e) {
      // 任何异常，继续走“后备再次请求”逻辑
    }
  }

  // 到这里说明原响应不是文本或文本处理失败 —— 我们主动再次请求同一 URL，加上 &tlang=zh-Hans 参数，尝试拿到服务器直接翻译结果
  try {
    let newUrl = reqUrl;
    if (!/(\?|&)tlang=/.test(newUrl)) {
      // append tlang
      newUrl = newUrl + (newUrl.includes('?') ? '&' : '?') + 'tlang=zh-Hans';
    } else {
      // replace existing tlang
      newUrl = newUrl.replace(/([?&])tlang=[^&]*/i, '$1tlang=zh-Hans');
    }

    const r = await $task.fetch({ url: newUrl, method: "GET", headers: { "User-Agent": "Mozilla/5.0" } });
    if (r && r.body && isTextSubtitle(r.body, newUrl)) {
      // 如果拿到文本字幕，就返回此响应（比起原始二进制更有用）
      $done({ body: r.body });
      return;
    }
  } catch (e) {
    // ignore
  }

  // 最后保底：无法获取翻译，直接返回原响应体，避免破坏视频
  $done({ body: origBody });

})();

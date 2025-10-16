// youtube_translate.js
// Quantumult X script-response-body
// 自动翻译 YouTube 字幕为简体中文 (支持 timedtext / vtt / get_transcript JSON)

;(async () => {
  const body = $response.body;
  if (!body) return $done({});

  const url = $request.url;
  const isXML = /timedtext/i.test(url);
  const isVTT = /\.vtt/i.test(url);
  const isJSON = /get_transcript/i.test(url);

  // HTML 实体处理
  const decode = s => s?.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#39;/g, "'").replace(/&quot;/g, '"') || "";
  const encode = s => s?.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;") || "";

  // 提取字幕文本
  let texts = [];
  if (isXML) {
    const re = /<text[^>]*>([\s\S]*?)<\/text>/gi;
    let m; while ((m = re.exec(body)) !== null) texts.push(decode(m[1].trim()));
  } else if (isVTT) {
    const lines = body.split(/\r?\n/);
    for (const l of lines) if (l && !/-->|^\d+$|WEBVTT/i.test(l)) texts.push(l.trim());
  } else if (isJSON) {
    try {
      const json = JSON.parse(body);
      const cues = json?.actions?.[0]?.updateEngagementPanelAction?.content?.transcriptRenderer?.body?.transcriptBodyRenderer?.cueGroups || [];
      for (const c of cues) {
        const segs = c?.transcriptCueGroupRenderer?.cues || [];
        for (const s of segs) {
          const txt = s?.transcriptCueRenderer?.cue?.simpleText || s?.transcriptCueRenderer?.cue?.runs?.map(r => r.text).join("") || "";
          if (txt) texts.push(txt);
        }
      }
    } catch { return $done({ body }); }
  }

  if (!texts.length) return $done({ body });

  // 去重
  const unique = Array.from(new Set(texts.filter(t => t.trim() !== "")));
  const SEP = "\n☃☃☃\n";

  // LibreTranslate 免费接口
  async function translateBatch(arr) {
    const url = "https://libretranslate.de/translate";
    const resp = await $task.fetch({
      url,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        q: arr.join(SEP),
        source: "auto",
        target: "zh",
        format: "text"
      })
    });
    if (!resp.body) return null;
    const json = JSON.parse(resp.body);
    const translated = json.translatedText || "";
    return translated.split(SEP);
  }

  // 翻译
  let map = {};
  const result = await translateBatch(unique);
  if (result) for (let i = 0; i < unique.length; i++) map[unique[i]] = result[i] || unique[i];

  let newBody = body;
  if (isXML) {
    newBody = newBody.replace(/(<text[^>]*>)([\s\S]*?)(<\/text>)/gi, (m, o, t, c) => o + encode(map[decode(t.trim())] || t) + c);
  } else if (isVTT) {
    newBody = body.split(/\r?\n/).map(l => map[l.trim()] || l).join("\n");
  } else if (isJSON) {
    try {
      let json = JSON.parse(body);
      const cues = json?.actions?.[0]?.updateEngagementPanelAction?.content?.transcriptRenderer?.body?.transcriptBodyRenderer?.cueGroups || [];
      for (const c of cues) {
        const segs = c?.transcriptCueGroupRenderer?.cues || [];
        for (const s of segs) {
          if (s?.transcriptCueRenderer?.cue?.simpleText) {
            const t = s.transcriptCueRenderer.cue.simpleText;
            s.transcriptCueRenderer.cue.simpleText = map[t] || t;
          } else if (s?.transcriptCueRenderer?.cue?.runs) {
            s.transcriptCueRenderer.cue.runs = s.transcriptCueRenderer.cue.runs.map(r => ({
              ...r,
              text: map[r.text] || r.text
            }));
          }
        }
      }
      newBody = JSON.stringify(json);
    } catch {}
  }

  $done({ body: newBody });
})();

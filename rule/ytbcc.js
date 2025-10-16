// youtube_translate.js
// Quantumult X script-response-body
// 功能：拦截 YouTube 字幕（timedtext XML / WebVTT），批量调用 Google 翻译接口，替换为简体中文
// 注意：免费接口有请求限制与不稳定性，见脚本末尾备注

(async () => {
  const body = $response.body;
  if (!body) {
    $done({});
    return;
  }

  // 判定格式：XML timedtext (YouTube) 或 VTT
  const isXML = /<transcript|<text\b/i.test(body);
  const isVTT = /^WEBVTT/m.test(body) || /\.vtt/i.test($request.url);

  if (!isXML && !isVTT) {
    // 不是字幕响应，放行
    $done({ body });
    return;
  }

  // HTML 实体解码（基本）
  function htmlDecode(s) {
    if (!s) return '';
    return s.replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'");
  }
  function htmlEncode(s) {
    if (!s) return '';
    return s.replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
  }

  // 提取字幕文本数组（并保持原位置信息）
  let items = []; // {orig: "...", startIndex, endIndex}
  if (isXML) {
    // 匹配 <text ...>...</text>
    const re = /<text\b[^>]*>([\s\S]*?)<\/text>/gi;
    let m;
    while ((m = re.exec(body)) !== null) {
      const txt = htmlDecode(m[1].replace(/\n+/g, ' ').trim());
      items.push({ orig: txt, startIndex: m.index, endIndex: re.lastIndex });
    }
  } else if (isVTT) {
    // 简单匹配 VTT 的纯文本行（时间戳行后面的字幕行）
    // 这里用行分割，选择可能为字幕的行（排除时间戳、数字行）
    const lines = body.split(/\r?\n/);
    let buffer = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/^\d{2}:\d{2}:\d{2}\.\d{3}|-->/i.test(line) || line.trim() === '' || /^\d+$/.test(line.trim())) {
        // 跳过
        continue;
      } else {
        // 有可能是字幕文本（也可能是样式等），收集
        buffer.push(line);
      }
    }
    // 合并为 items（简单处理：以行做单元）
    // 注意：替换回去我们会在全体文本中逐个替换匹配字符串（可能有重复），但通常字幕行不同足够安全
    buffer.forEach(txt => {
      const t = htmlDecode(txt.trim());
      if (t) items.push({ orig: t });
    });
  }

  if (!items.length) {
    $done({ body });
    return;
  }

  // 去重并按顺序准备翻译文本
  const uniqueTexts = Array.from(new Set(items.map(i => i.orig))).filter(t => t.trim() !== '');
  // 为避免超长请求，将文本用特殊分隔符合并成若干批次
  const SEP = '\n☃☃☃\n'; // 分隔符，翻译后用它分割
  const MAX_Q_LEN = 2000; // 每次请求 q 长度上限（经验值），可调
  const batches = [];
  let cur = [];
  let curLen = 0;
  for (const t of uniqueTexts) {
    const l = t.length + SEP.length;
    if (curLen + l > MAX_Q_LEN && cur.length > 0) {
      batches.push(cur.slice());
      cur = [t];
      curLen = l;
    } else {
      cur.push(t);
      curLen += l;
    }
  }
  if (cur.length) batches.push(cur);

  // 翻译函数（使用 google 的公共接口）
  async function translateBatch(arr) {
    const q = arr.join(SEP);
const url = 'https://libretranslate.de/translate';
const resp = await $task.fetch({
  url,
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    q: arr.join(SEP),
    source: 'auto',
    target: 'zh',
    format: 'text'
  })
});
const data = JSON.parse(resp.body);
return data.translatedText.split(SEP);

  // 批量翻译并构建映射
  const map = Object.create(null); // original -> translated
  for (const batch of batches) {
    const result = await translateBatch(batch);
    if (!result) {
      // 翻译失败 —— 退回原文（不中断全部过程），同时记录失败
      batch.forEach((t, idx) => { map[t] = t; });
    } else {
      for (let i = 0; i < batch.length; i++) {
        const o = batch[i];
        const tr = result[i] ? result[i].trim() : o;
        // 把全角/半角空格和换行做简单处理：保持行内换行为 <br> 或 \n 视情况
        map[o] = tr;
      }
    }
  }

  // 替换原文为中文（注意编码回 XML 实体）
  let newBody = body;
  if (isXML) {
    // 替换每个 <text> 的内容（精确替换原始解码后的文本）
    newBody = newBody.replace(/(<text\b[^>]*>)([\s\S]*?)(<\/text>)/gi, function(_, openTag, inner, closeTag) {
      const dec = htmlDecode(inner.replace(/\n+/g, ' ').trim());
      if (map[dec]) {
        return openTag + htmlEncode(map[dec]) + closeTag;
      } else {
        return openTag + inner + closeTag;
      }
    });
  } else if (isVTT) {
    // 对 VTT，在全局文本中逐个替换（谨慎替换：只替换确切匹配的行）
    // 构造行替换：逐行替换以避免误伤时间戳等
    const lines = newBody.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim() === '' || /^\d+$/.test(line.trim()) || /^\d{2}:\d{2}:\d{2}\.\d{3}|-->/i.test(line)) continue;
      const dec = htmlDecode(line.trim());
      if (map[dec]) {
        lines[i] = htmlEncode(map[dec]);
      }
    }
    newBody = lines.join('\n');
  }

  $done({ body: newBody });
})();

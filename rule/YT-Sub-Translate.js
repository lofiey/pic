/*
 * YouTube 字幕强制翻译成中文（QuantumultX）
 * ------------------------------------------------
 * 不区分原字幕语言（英语/泰语/任何语言均可），一律用 Google 翻译
 * (sl=auto -> tl=zh-CN) 生成 “原文 + 中文” 双语字幕。
 *
 * 用法：QuantumultX 重写规则（rewrite_local）：
 * ^https:\/\/www\.youtube\.com\/api\/timedtext.+ url script-response-body https://你的地址/YT-Sub-Translate.js
 *
 * 同时在 [mitm] hostname 里加上 www.youtube.com
 */

const TAG = "[YT-Sub-Translate]";

(async () => {
  try {
    if (!$response || !$response.body) {
      console.log(`${TAG} 空响应，跳过`);
      $done({});
      return;
    }

    const body = $response.body;
    const headers = $response.headers || {};
    const ct = (headers["Content-Type"] || headers["content-type"] || "").split(";")[0];
    const trimmed = body.trim();

    let newBody = body;

    if (ct.includes("json") || trimmed.startsWith("{")) {
      newBody = await handleJson(body);
    } else if (
      ct.includes("xml") ||
      trimmed.startsWith("<?xml") ||
      trimmed.startsWith("<transcript") ||
      trimmed.startsWith("<timedtext")
    ) {
      newBody = await handleXml(body);
    } else {
      console.log(`${TAG} 未识别的格式(${ct})，原样返回`);
    }

    $response.body = newBody;
    $done($response);
  } catch (e) {
    console.log(`${TAG} 出错: ${e}`);
    $done({});
  }
})();

// ---------------- JSON3 格式 (最常见, ?fmt=json3) ----------------
async function handleJson(body) {
  let data;
  try {
    data = JSON.parse(body);
  } catch (e) {
    console.log(`${TAG} JSON 解析失败: ${e}`);
    return body;
  }
  if (!data.events || !data.events.length) {
    console.log(`${TAG} 无 events 字段，可能没有字幕内容`);
    return body;
  }

  // 提取每条字幕原文
  const originals = data.events.map((ev) => {
    if (ev.segs && ev.segs.length) {
      return ev.segs.map((s) => s.utf8 || "").join("");
    }
    return null;
  });

  const indexesToTranslate = [];
  const textsToTranslate = [];
  originals.forEach((t, i) => {
    if (t !== null && t.trim() !== "") {
      indexesToTranslate.push(i);
      textsToTranslate.push(t);
    }
  });

  console.log(`${TAG} 共 ${textsToTranslate.length} 条待翻译字幕`);
  const translations = await translateBatch(textsToTranslate);

  indexesToTranslate.forEach((idx, i) => {
    const original = originals[idx];
    const translated = translations[i] || "";
    data.events[idx].segs = [{ utf8: `${original}\n${translated}` }];
  });

  return JSON.stringify(data);
}

// ---------------- XML / srv3 / transcript 格式 ----------------
async function handleXml(body) {
  // 兼容 <text ...>内容</text> (老格式) 和 <p ...>内容</p> (srv3)
  const regex = /<(text|p)((?:\s+[^>]*)?)>([\s\S]*?)<\/\1>/g;
  const matches = [...body.matchAll(regex)];

  if (!matches.length) {
    console.log(`${TAG} 未匹配到字幕节点`);
    return body;
  }

  const texts = matches.map((m) => decodeEntities(m[3]));
  console.log(`${TAG} 共 ${texts.length} 条待翻译字幕`);
  const translations = await translateBatch(texts);

  let result = body;
  matches.forEach((m, idx) => {
    const [full, tag, attrs, content] = m;
    const translated = escapeEntities(translations[idx] || "");
    const replacement = `<${tag}${attrs}>${content}&#x000A;${translated}</${tag}>`;
    result = result.replace(full, replacement);
  });

  return result;
}

function decodeEntities(str) {
  return str
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function escapeEntities(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ---------------- 翻译逻辑 (强制 auto -> zh-CN) ----------------
async function translateBatch(texts, chunkSize = 60) {
  const chunks = [];
  for (let i = 0; i < texts.length; i += chunkSize) {
    chunks.push(texts.slice(i, i + chunkSize));
  }

  let results = [];
  for (const chunk of chunks) {
    const translated = await translateChunk(chunk);
    results = results.concat(translated);
  }
  return results;
}

function translateChunk(chunk, retriesLeft = 2) {
  const SEP = "\n@@@\n";
  return new Promise((resolve) => {
    const joined = chunk.join(SEP);
    const q = encodeURIComponent(joined);
    const reqUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=zh-CN&dt=t&q=${q}`;

    $task
      .fetch({
        url: reqUrl,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
        timeout: 10000,
      })
      .then((resp) => {
        try {
          const json = JSON.parse(resp.body);
          const translatedText = json[0].map((seg) => seg[0]).join("");
          const parts = translatedText
            .split(/\n?@@@\n?/)
            .map((s) => s.trim());

          if (parts.length === chunk.length) {
            resolve(parts);
          } else {
            console.log(
              `${TAG} 分段数量不匹配 (${parts.length}/${chunk.length})，回退为整体翻译`
            );
            resolve(chunk.map((_, i) => parts[i] || parts[0] || ""));
          }
        } catch (e) {
          console.log(`${TAG} 翻译结果解析失败: ${e}`);
          resolve(chunk.map(() => ""));
        }
      })
      .catch((err) => {
        console.log(`${TAG} 翻译请求失败: ${err}`);
        if (retriesLeft > 0) {
          setTimeout(() => {
            translateChunk(chunk, retriesLeft - 1).then(resolve);
          }, 500);
        } else {
          resolve(chunk.map(() => ""));
        }
      });
  });
}

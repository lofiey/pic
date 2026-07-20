/*
 * YouTube 字幕强制翻译成中文（QuantumultX 小语种增强版）
 * ------------------------------------------------
 * 专治泰语/日语/阿拉伯语等小语种翻译失效、分段错位及 URL 超长问题
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

// ---------------- JSON3 格式 ----------------
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
  const translations = await translateBatchSmart(textsToTranslate);

  indexesToTranslate.forEach((idx, i) => {
    const original = originals[idx];
    const translated = translations[i] || "";
    data.events[idx].segs = [{ utf8: `${original}\n${translated}` }];
  });

  return JSON.stringify(data);
}

// ---------------- XML / srv3 格式 ----------------
async function handleXml(body) {
  const regex = /<(text|p)((?:\s+[^>]*)?)>([\s\S]*?)<\/\1>/g;
  const matches = [...body.matchAll(regex)];

  if (!matches.length) {
    console.log(`${TAG} 未匹配到字幕节点`);
    return body;
  }

  const texts = matches.map((m) => decodeEntities(m[3]));
  console.log(`${TAG} 共 ${texts.length} 条待翻译字幕`);
  const translations = await translateBatchSmart(texts);

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

// ---------------- 智能动态打包翻译 ----------------
async function translateBatchSmart(texts) {
  // 1. 根据 URL 编码后的实际长度动态分包（防止小语种 URL 溢出拒绝）
  const MAX_ENCODED_LEN = 1200; 
  const SEP = "\n___SUB_SPLIT___\n";
  
  const chunks = [];
  let currentChunk = [];
  let currentLen = 0;

  for (const text of texts) {
    const encodedLen = encodeURIComponent(text + SEP).length;
    if (currentLen + encodedLen > MAX_ENCODED_LEN && currentChunk.length > 0) {
      chunks.push(currentChunk);
      currentChunk = [];
      currentLen = 0;
    }
    currentChunk.push(text);
    currentLen += encodedLen;
  }
  if (currentChunk.length > 0) chunks.push(currentChunk);

  // 2. 执行分批翻译
  let results = [];
  for (const chunk of chunks) {
    const translated = await translateChunk(chunk);
    results = results.concat(translated);
  }
  return results;
}

function translateChunk(chunk, retriesLeft = 1) {
  const SEP = "\n___SUB_SPLIT___\n";
  return new Promise((resolve) => {
    const joined = chunk.join(SEP);
    const q = encodeURIComponent(joined);
    const reqUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=zh-CN&dt=t&q=${q}`;

    $task
      .fetch({
        url: reqUrl,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
        },
        timeout: 6000,
      })
      .then((resp) => {
        try {
          const json = JSON.parse(resp.body);
          const translatedText = json[0].map((seg) => seg[0] || "").join("");

          // 弹性正则：容错小语种在分隔符前后产生的空格或换行变异
          const parts = translatedText
            .split(/\s*___SUB_SPLIT___\s*/)
            .map((s) => s.trim());

          if (parts.length === chunk.length) {
            resolve(parts);
          } else {
            console.log(
              `${TAG} 小语种切片错位 (${parts.length}/${chunk.length})，触发单句保底机制`
            );
            // 降级机制：如果小语种合成翻译切片失败，自动并发单句翻译
            Promise.all(chunk.map((singleText) => translateSingle(singleText))).then(resolve);
          }
        } catch (e) {
          console.log(`${TAG} 解析失败，触发单句保底: ${e}`);
          Promise.all(chunk.map((singleText) => translateSingle(singleText))).then(resolve);
        }
      })
      .catch((err) => {
        if (retriesLeft > 0) {
          setTimeout(() => {
            translateChunk(chunk, retriesLeft - 1).then(resolve);
          }, 300);
        } else {
          // 连环重试失败，直接回退单句并发
          Promise.all(chunk.map((singleText) => translateSingle(singleText))).then(resolve);
        }
      });
  });
}

// 逐句保底翻译函数（专门解决泰文/阿文等连字分割异常）
function translateSingle(text) {
  if (!text || !text.trim()) return Promise.resolve("");
  const q = encodeURIComponent(text);
  const reqUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=zh-CN&dt=t&q=${q}`;

  return $task
    .fetch({
      url: reqUrl,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
      },
      timeout: 4000,
    })
    .then((resp) => {
      const json = JSON.parse(resp.body);
      return json[0].map((seg) => seg[0] || "").join("").trim();
    })
    .catch(() => text); // 若单条彻底失败则保留原文
}

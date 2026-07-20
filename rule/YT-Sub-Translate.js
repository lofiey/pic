/*
 * YouTube 字幕强制翻译成中文（QuantumultX 增强版）
 * ------------------------------------------------
 * 解决泰语等小众语言分段错位、接口拒绝及 HTTP GET 长度超限问题
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
  // 泰语等小众语言批次放小到 20，避免 URL 越界
  const translations = await translateBatch(textsToTranslate, 20);

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
  const translations = await translateBatch(texts, 20);

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

// ---------------- 翻译核心（增强分隔符容错与小众语言支持） ----------------
async function translateBatch(texts, chunkSize = 20) {
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
  // 使用更不易被泰文/阿拉伯文合并的特殊隔离标记
  const SEP = "\n[[[XYZ]]]\n";
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
        timeout: 8000,
      })
      .then((resp) => {
        try {
          const json = JSON.parse(resp.body);
          // 拼接 Google 返回的句段
          const translatedText = json[0].map((seg) => seg[0]).join("");
          
          // 弹性正则匹配分隔符，容错空格和换行符变动
          const parts = translatedText
            .split(/\s*\[\[\[XYZ\]\]\]\s*/)
            .map((s) => s.trim());

          if (parts.length === chunk.length) {
            resolve(parts);
          } else {
            console.log(
              `${TAG} 分割校验失效 (${parts.length}/${chunk.length})，启动逐条降级翻译`
            );
            // 降级：如果批次拼接失败，则对当前 chunk 进行单条并发翻译，确保小众语言 100% 成功
            Promise.all(chunk.map((singleText) => translateSingle(singleText))).then(resolve);
          }
        } catch (e) {
          console.log(`${TAG} 解析失败，启动单条降级: ${e}`);
          Promise.all(chunk.map((singleText) => translateSingle(singleText))).then(resolve);
        }
      })
      .catch((err) => {
        if (retriesLeft > 0) {
          setTimeout(() => {
            translateChunk(chunk, retriesLeft - 1).then(resolve);
          }, 400);
        } else {
          resolve(chunk.map(() => ""));
        }
      });
  });
}

// 逐条翻译保底函数（专门对付小众语言分割异常）
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
      timeout: 5000,
    })
    .then((resp) => {
      const json = JSON.parse(resp.body);
      return json[0].map((seg) => seg[0]).join("").trim();
    })
    .catch(() => "");
}

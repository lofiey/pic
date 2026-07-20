/**
 * DualSubs: Universal Subtitle Translate Bundle
 * Fixed Google Translation Engine for Mobile Environments
 */

console.log("🍿 DualSubs: Subtitle Translator Engine Executing...");

// 1. 统一环境检测
const $ENV = (() => {
  const keys = Object.keys(globalThis);
  if (keys.includes("$task")) return "Quantumult X";
  if (keys.includes("$loon")) return "Loon";
  if (keys.includes("$rocket")) return "Shadowrocket";
  if (keys.includes("Egern")) return "Egern";
  if (keys.includes("$environment")) {
    if ($environment["surge-version"]) return "Surge";
    if ($environment["stash-version"]) return "Stash";
  }
  return "Surge";
})();

// 2. 兼容移动端的轻量级 Fetch 封装
function requestGoogleTranslate(textList, targetLang = "zh-CN") {
  return new Promise((resolve, reject) => {
    // 使用 \n 作为换行分隔符，避免某些环境下 \r 被过滤
    const queryText = Array.isArray(textList) ? textList.join("\n") : textList;
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&dt=t&sl=auto&tl=${targetLang}&q=${encodeURIComponent(queryText)}`;

    const reqOptions = {
      url: url,
      headers: {
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
        "Accept": "*/*"
      },
      timeout: 5
    };

    if ($ENV === "Quantumult X") {
      $task.fetch(reqOptions).then(
        (response) => {
          if (response.statusCode === 200) {
            resolve(parseGoogleResponse(response.body));
          } else {
            reject(`Google API Error Status: ${response.statusCode}`);
          }
        },
        (reason) => reject(`Quantumult X Fetch Error: ${reason.error}`)
      );
    } else {
      // Surge / Loon / Stash / Shadowrocket
      $httpClient.get(reqOptions, (err, response, body) => {
        if (err) {
          reject(`HttpClient Error: ${err}`);
          return;
        }
        if (response.status === 200 || response.statusCode === 200) {
          resolve(parseGoogleResponse(body));
        } else {
          reject(`Google API Response Code: ${response.status || response.statusCode}`);
        }
      });
    }
  });
}

// 3. 健壮的 Google 响应解析器
function parseGoogleResponse(rawBody) {
  try {
    const data = typeof rawBody === "string" ? JSON.parse(rawBody) : rawBody;
    let fullTranslatedStr = "";

    if (Array.isArray(data) && Array.isArray(data[0])) {
      // 循环拼接 Google 返回的所有文本片段
      data[0].forEach((item) => {
        if (item && item[0]) {
          fullTranslatedStr += item[0];
        }
      });
    }
    
    // 按换行拆分成数组返回
    return fullTranslatedStr.split("\n");
  } catch (e) {
    console.log(`❌ Parse Translated Text Error: ${e.message}`);
    return [];
  }
}

// 4. 模组调用入口示例
(async () => {
  try {
    // 假设测试字幕文本
    const originalSubtitles = ["Hello, welcome back.", "Today we are going to fix the translation module."];
    
    console.log("⏳ Translating subtitles to Chinese...");
    const translatedSubtitles = await requestGoogleTranslate(originalSubtitles, "zh-CN");
    
    console.log("✅ Translation succeed!");
    console.log(JSON.stringify(translatedSubtitles));
  } catch (error) {
    console.log(`❌ Translation failed: ${error}`);
  } finally {
    // 必须调用 $done 确保客户端请求不卡死
    if (typeof $done !== "undefined") {
      $done({});
    }
  }
})();

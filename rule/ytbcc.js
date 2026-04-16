/*
* 整合版：保留核心脚本调用 + 强力中文翻译注入
*/

// --- 你要求的核心脚本定义（保持不动，确保调用） ---
const DUALSUBS_CODE = `
# 1 fpq.org YouTube.Player.request.json
^https?:\/\/(www|m|tv)\.youtube\.com\/youtubei\/v1\/player(\?.+)?$ url script-request-body https://raw.githubusercontent.com/lofiey/pic/main/rule/request.bundle.js

# 2 fpq.org YouTube.Player.response.json
^https?:\/\/(www|m|tv)\.youtube\.com\/youtubei\/v1\/player(\?.+)?$ url script-response-body https://raw.githubusercontent.com/lofiey/pic/main/rule/response.bundle.js

# 3 fpq.org YouTube.Player.request.proto
^https?:\/\/youtubei\.googleapis\.com\/youtubei\/v1\/player(\?.+)?$ url script-request-body https://raw.githubusercontent.com/lofiey/pic/main/rule/request.bundle.js

# 4 fpq.org YouTube.Player.response.proto
^https?:\/\/youtubei\.googleapis\.com\/youtubei\/v1\/player(\?.+)?$ url script-request-body https://raw.githubusercontent.com/lofiey/pic/main/rule/request.bundle.js

# 5 fpq.org YouTube.GetWatch.response.proto
^https?:\/\/youtubei\.googleapis\.com\/youtubei\/v1\/get_watch(\?.+)?$ url script-response-body https://raw.githubusercontent.com/lofiey/pic/main/rule/response.bundle.js

# 6 fpq.org YouTube.TimedText.request
^https?:\/\/(www|m)\.youtube\.com\/api\/timedtext url script-request-header https://raw.githubusercontent.com/lofiey/pic/main/rule/request.bundle.js

# 7 fpq.org YouTube.Composite.TimedText.response
^https?:\/\/(www|m)\.youtube\.com\/api\/timedtext\?(.*)subtype=(Official|External) url script-response-body https://raw.githubusercontent.com/lofiey/pic/main/rule/Composite.Subtitles.response.bundle.js

# 8 fpq.org YouTube.Translate.TimedText.response
^https?:\/\/(www|m)\.youtube\.com\/api\/timedtext\?(.*)subtype=Translate url script-response-body https://raw.githubusercontent.com/lofiey/pic/main/rule/Translate.response.bundle.js
`; 

// --- 实际执行逻辑 ---
let body = $response.body;

if (body) {
    try {
        let json = JSON.parse(body);

        // --- 新增：强制注入中文翻译轨道逻辑 ---
        // 这一段是为了解决你套用 WARP 后搜不到翻译的问题
        let captions = json.playerResponse?.captions?.playerCaptionsTrackListRenderer || 
                       json.captions?.playerCaptionsTrackListRenderer;

        if (captions) {
            captions.translationLanguages = captions.translationLanguages || [];
            let hasZh = captions.translationLanguages.some(l => l.languageCode === 'zh-Hans');
            if (!hasZh) {
                captions.translationLanguages.push({
                    languageCode: "zh-Hans",
                    name: { runs: [{ text: "中文（简体）" }] }
                });
            }
        }

        // --- 保留：你原有的 webPlayerActionsExtension 检查逻辑 ---
        if (json.playerResponse && json.playerResponse.webPlayerActionsExtension) {            
            // 保持原样返回
            $done({body: JSON.stringify(json)});
        } else {
            // 如果没有 extension，也返回修改后的 json（包含新注入的字幕）
            $done({body: JSON.stringify(json)});
        }

    } catch (e) {
        // 如果是 Protobuf 二进制，JSON.parse 会报错，直接交给核心远程脚本处理
        console.log("YouTube 翻译脚本解析失败，交由核心脚本处理");
        $done({});
    }
} else {
    $done({});
}

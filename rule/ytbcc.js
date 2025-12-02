// DualSubs 腳本的實際代碼片段 (需要替換 YOUR_DUALSUBS_CODE_HERE)
const DUALSUBS_CODE = `
# 🍿️ DualSubs.YouTube.Player.request.json
^https?:\/\/(www|m|tv)\.youtube\.com\/youtubei\/v1\/player(\?.+)?$ url script-request-body https://raw.githubusercontent.com/lofiey/pic/main/rule/request.bundle-ytbm.js

# 🍿️ DualSubs.YouTube.Player.response.json
^https?:\/\/(www|m|tv)\.youtube\.com\/youtubei\/v1\/player(\?.+)?$ url script-response-body https://raw.githubusercontent.com/lofiey/pic/main/rule/request.bundle-ytbm.js

# 🍿️ DualSubs.YouTube.Player.request.proto
^https?:\/\/youtubei\.googleapis\.com\/youtubei\/v1\/player(\?.+)?$ url script-request-body https://raw.githubusercontent.com/lofiey/pic/main/rule/request.bundle-ytbm.js

# 🍿️ DualSubs.YouTube.Player.response.proto
^https?:\/\/youtubei\.googleapis\.com\/youtubei\/v1\/player(\?.+)?$ url script-response-body https://raw.githubusercontent.com/lofiey/pic/main/rule/request.bundle-ytbm.js

# 🍿️ DualSubs.YouTube.GetWatch.response.proto
^https?:\/\/youtubei\.googleapis\.com\/youtubei\/v1\/get_watch(\?.+)?$ url script-response-body https://raw.githubusercontent.com/lofiey/pic/main/rule/request.bundle-ytbm.js

# 🍿️ DualSubs.YouTube.TimedText.request
^https?:\/\/(www|m)\.youtube\.com\/api\/timedtext url script-request-header https://raw.githubusercontent.com/lofiey/pic/main/rule/request.bundle-ytbm.js

# 🍿️ DualSubs.YouTube.Composite.TimedText.response
^https?:\/\/(www|m)\.youtube\.com\/api\/timedtext\?(.*)subtype=(Official|External) url script-response-body https://raw.githubusercontent.com/lofiey/pic/main/rule/Composite.Subtitles.response.bundle.js

# 🍿️ DualSubs.YouTube.Translate.TimedText.response
^https?:\/\/(www|m)\.youtube\.com\/api\/timedtext\?(.*)subtype=Translate url script-response-body https://raw.githubusercontent.com/lofiey/pic/main/rule/Translate.response.bundle.js

# YouTube Music
# 🍿️ DualSubs.YouTubeMusic.Browse.request.json
^https?:\/\/music\.youtube\.com\/youtubei\/v1\/browse(\?.+)?$ url script-request-body https://raw.githubusercontent.com/lofiey/pic/main/rule/trb.js

# 🍿️ DualSubs.YouTube.Browse.request.proto
^https?:\/\/youtubei\.googleapis\.com\/youtubei\/v1\/browse(\?.+)?$ url script-request-body https://raw.githubusercontent.com/lofiey/pic/main/rule/request.bundle-ytbm.js

# 🍿️ DualSubs.YouTubeMusic.Translate.Lyrics.response.json
^https?:\/\/music\.youtube\.com\/youtubei\/v1\/browse\?(.*)subtype=Translate url script-response-body https://raw.githubusercontent.com/lofiey/pic/main/rule/Translate.response.bundle.js

# 🍿️ DualSubs.YouTubeMusic.Translate.Lyrics.response.proto
^https?:\/\/youtubei\.googleapis\.com\/youtubei\/v1\/browse\?(.*)subtype=Translate url script-response-body https://raw.githubusercontent.com/lofiey/pic/main/rule/Translate.response.bundle.js
`; 

let body = $response.body;

// 檢查 $response.body 是否存在
if (body) {
    try {
        let json = JSON.parse(body);

        // 查找 playerResponse JSON 中的播放器配置部分
        if (json.playerResponse && json.playerResponse.webPlayerActionsExtension) {
            
            // 找到可以注入腳本的地方（這部分高度依賴 YouTube API 結構，可能需要微調）
            // 此處為示意，實際注入位置請參考 DualSubs 的具體指引。
            
            // 最終將 DUALSUBS_CODE 注入到 JSON 結構中的適當位置
            // ... (注入邏輯) ...

            // 重新打包 JSON
            $done({body: JSON.stringify(json)});
        }
    } catch (e) {
        console.log("JSON parsing error:", e);
        $done({});
    }
}

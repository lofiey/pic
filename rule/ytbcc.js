/* YouTube 簡體中文字幕 (URLSearchParams 最小修改版) */

const url = $request.url;
const obj = new URL(url);
const params = obj.searchParams;

// 1. 移除簽名相關參數 (這是必須的，否則會載入失敗)
params.delete('signature');
params.delete('sparams');
params.delete('sig');

// 2. **關鍵步驟：** 不再修改原始的 'lang' 參數 (例如 'en' 或 'th')
// 3. 強制設定翻譯的目標語言為簡體中文
//    如果原始 URL 中已經有 tlang，會被覆蓋。
params.set('tlang', 'zh-Hans'); 

// 重建 URL
obj.search = params.toString();

$done({url: obj.toString()});
// DualSubs 腳本的實際代碼片段 (需要替換 YOUR_DUALSUBS_CODE_HERE)
const DUALSUBS_CODE = `
# 1 🍿️ DualSubs.YouTube.Player.request.json
^https?:\/\/(www|m|tv)\.youtube\.com\/youtubei\/v1\/player(\?.+)?$ url script-request-body https://raw.githubusercontent.com/lofiey/pic/main/rule/request.bundle.js

# 2🍿️ DualSubs.YouTube.Player.response.json
^https?:\/\/(www|m|tv)\.youtube\.com\/youtubei\/v1\/player(\?.+)?$ url script-response-body https://raw.githubusercontent.com/lofiey/pic/main/rule/response.bundle.js

#3 🍿️ DualSubs.YouTube.Player.request.proto
^https?:\/\/youtubei\.googleapis\.com\/youtubei\/v1\/player(\?.+)?$ url script-request-body https://raw.githubusercontent.com/lofiey/pic/main/rule/request.bundle.js

#4 🍿️ DualSubs.YouTube.Player.response.proto
^https?:\/\/youtubei\.googleapis\.com\/youtubei\/v1\/player(\?.+)?$ url script-response-body https://raw.githubusercontent.com/lofiey/pic/main/rule/response.bundle.js

#5 🍿️ DualSubs.YouTube.GetWatch.response.proto
^https?:\/\/youtubei\.googleapis\.com\/youtubei\/v1\/get_watch(\?.+)?$ url script-response-body https://raw.githubusercontent.com/lofiey/pic/main/rule/response.bundle.js

#6 🍿️ DualSubs.YouTube.TimedText.request
^https?:\/\/(www|m)\.youtube\.com\/api\/timedtext url script-request-header https://raw.githubusercontent.com/lofiey/pic/main/rule/request.bundle.js

#7 🍿️ DualSubs.YouTube.Composite.TimedText.response
^https?:\/\/(www|m)\.youtube\.com\/api\/timedtext\?(.*)subtype=(Official|External) url script-response-body https://raw.githubusercontent.com/lofiey/pic/main/rule/Composite.Subtitles.response.bundle.js

#8 🍿️ DualSubs.YouTube.Translate.TimedText.response
^https?:\/\/(www|m)\.youtube\.com\/api\/timedtext\?(.*)subtype=Translate url script-response-body https://raw.githubusercontent.com/lofiey/pic/main/rule/Translate.response.bundle.js
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

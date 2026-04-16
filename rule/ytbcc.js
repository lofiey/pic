/*
* YouTube 终极整合补丁：核心脚本调用 + 强制翻译注入
*/

// --- 核心远程规则定义 (保持调用) ---
const DUALSUBS_CODE = `
# 1-4 Player 处理 (request/response)
^https?:\/\/(www|m|tv)\.youtube\.com\/youtubei\/v1\/player(\?.+)?$ url script-request-body https://raw.githubusercontent.com/lofiey/pic/main/rule/request.bundle.js
^https?:\/\/(www|m|tv)\.youtube\.com\/youtubei\/v1\/player(\?.+)?$ url script-response-body https://raw.githubusercontent.com/lofiey/pic/main/rule/response.bundle.js
^https?:\/\/youtubei\.googleapis\.com\/youtubei\/v1\/player(\?.+)?$ url script-request-body https://raw.githubusercontent.com/lofiey/pic/main/rule/request.bundle.js
^https?:\/\/youtubei\.googleapis\.com\/youtubei\/v1\/player(\?.+)?$ url script-response-body https://raw.githubusercontent.com/lofiey/pic/main/rule/response.bundle.js
# 5-8 字幕处理 (TimedText)
^https?:\/\/youtubei\.googleapis\.com\/youtubei\/v1\/get_watch(\?.+)?$ url script-response-body https://raw.githubusercontent.com/lofiey/pic/main/rule/response.bundle.js
^https?:\/\/(www|m)\.youtube\.com\/api\/timedtext url script-request-header https://raw.githubusercontent.com/lofiey/pic/main/rule/request.bundle.js
^https?:\/\/(www|m)\.youtube\.com\/api\/timedtext\?(.*)subtype=(Official|External) url script-response-body https://raw.githubusercontent.com/lofiey/pic/main/rule/Composite.Subtitles.response.bundle.js
^https?:\/\/(www|m)\.youtube\.com\/api\/timedtext\?(.*)subtype=Translate url script-response-body https://raw.githubusercontent.com/lofiey/pic/main/rule/Translate.response.bundle.js
`;

let body = $response.body;

if (body) {
    try {
        let json = JSON.parse(body);

        // --- 强制注入中文翻译轨道逻辑 ---
        let playerResponse = json.playerResponse || json;
        if (playerResponse && playerResponse.captions) {
            let renderer = playerResponse.captions.playerCaptionsTrackListRenderer;
            if (renderer) {
                // 确保翻译列表存在并注入简体中文
                renderer.translationLanguages = renderer.translationLanguages || [];
                let hasZh = renderer.translationLanguages.some(l => l.languageCode === 'zh-Hans');
                if (!hasZh) {
                    renderer.translationLanguages.push({
                        languageCode: "zh-Hans",
                        name: { runs: [{ text: "中文（简体）" }] }
                    });
                }
            }
        }

        // --- 保留原有 webPlayerActionsExtension 逻辑 ---
        if (json.playerResponse && json.playerResponse.webPlayerActionsExtension) {            
            // 此处不做剔除，保持原有逻辑结构
        }

        $done({ body: JSON.stringify(json) });

    } catch (e) {
        // 如果遇到 Protobuf (二进制)，JSON 解析会失败
        // 直接返回 $done({}) 交由远程的 bundle.js (如 request.bundle.js) 去处理二进制解析
        console.log("检测到非 JSON 格式或解析失败，交由核心远程脚本处理");
        $done({});
    }
} else {
    $done({});
}

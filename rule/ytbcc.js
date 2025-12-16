#! Compiled by Lofiey, proofread by fpq.org 2025-12-16-21:52
#! Fixed bug, and to further improve upon the original version.
const DUALSUBS_CODE = `
# 1 fpq.org YouTube.Player.request.json
^https?:\/\/(www|m|tv)\.youtube\.com\/youtubei\/v1\/player(\?.+)?$ url script-request-body https://raw.githubusercontent.com/lofiey/pic/main/rule/request.bundle.js

# 2 fpq.org YouTube.Player.response.json
^https?:\/\/(www|m|tv)\.youtube\.com\/youtubei\/v1\/player(\?.+)?$ url script-response-body https://raw.githubusercontent.com/lofiey/pic/main/rule/response.bundle.js

# 3 fpq.org YouTube.Player.request.proto
^https?:\/\/youtubei\.googleapis\.com\/youtubei\/v1\/player(\?.+)?$ url script-request-body https://raw.githubusercontent.com/lofiey/pic/main/rule/request.bundle.js

# 4 fpq.org YouTube.Player.response.proto
^https?:\/\/youtubei\.googleapis\.com\/youtubei\/v1\/player(\?.+)?$ url script-response-body https://raw.githubusercontent.com/lofiey/pic/main/rule/response.bundle.js

# 5 fpq.org YouTube.GetWatch.response.proto
^https?:\/\/youtubei\.googleapis\.com\/youtubei\/v1\/get_watch(\?.+)?$ url script-response-body https://raw.githubusercontent.com/lofiey/pic/main/rule/response.bundle.js

# 6 fpq.org YouTube.TimedText.request
^https?:\/\/(www|m)\.youtube\.com\/api\/timedtext url script-request-header https://raw.githubusercontent.com/lofiey/pic/main/rule/request.bundle.js

# 7 fpq.org YouTube.Composite.TimedText.response
^https?:\/\/(www|m)\.youtube\.com\/api\/timedtext\?(.*)subtype=(Official|External) url script-response-body https://raw.githubusercontent.com/lofiey/pic/main/rule/Composite.Subtitles.response.bundle.js

# 8 fpq.org YouTube.Translate.TimedText.response
^https?:\/\/(www|m)\.youtube\.com\/api\/timedtext\?(.*)subtype=Translate url script-response-body https://raw.githubusercontent.com/lofiey/pic/main/rule/Translate.response.bundle.js
`; 

let body = $response.body;

// Check if $response.body exists.
if (body) {
    try {
        let json = JSON.parse(body);

        if (json.playerResponse && json.playerResponse.webPlayerActionsExtension) {            
            $done({body: JSON.stringify(json)});
        }
    } catch (e) {
        console.log("JSON parsing error:", e);
        $done({});
    }
}

// 自动开启 YouTube 字幕 + 自动选择中文机翻轨道

let body = $response.body;
if (!body) $done({body});

try {
    let obj = JSON.parse(body);

    const cap = obj?.captions?.playerCaptionsTracklistRenderer;
    if (cap && cap.captionTracks && cap.captionTracks.length > 0) {

        // 找到中文机翻轨
        let zhIndex = cap.captionTracks.findIndex(t =>
            t.languageCode?.includes("zh") ||
            t.name?.simpleText?.includes("中文") ||
            t.vssId?.includes(".zh")
        );

        // 如果找到了中文字幕轨
        if (zhIndex >= 0) {
            cap.defaultCaptionTrackIndex = zhIndex;
            cap.defaultAudioTrackIndex = 0;

            // 自动开启字幕
            cap.showCaptions = true;

            // 将中文机翻轨设置为默认
            cap.captionTrackIndices = [zhIndex];
        }
    }

    body = JSON.stringify(obj);

} catch (e) {
    console.log("YouTube Auto Caption Error:", e);
}

$done({body});

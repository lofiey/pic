/**
 * Quantumult X script-response-body
 * 强制 YouTube App 字幕为繁体中文
 */

let body = $response.body;

try {
    let data = JSON.parse(body);

    if (data && data.captions && data.captions.playerCaptionsTracklistRenderer) {
        let tracks = data.captions.playerCaptionsTracklistRenderer.captionTracks;

        if (tracks && tracks.length > 0) {
            tracks.forEach(track => {
                if (track.baseUrl && !track.baseUrl.includes('tlang=zh-Hant')) {
                    // 在 baseUrl 里添加 tlang=zh-Hant
                    track.baseUrl += (track.baseUrl.includes('?') ? '&' : '?') + 'tlang=zh-Hant';
                }
                // 同步 languageCode 为 zh-Hant
                track.languageCode = 'zh-Hant';
            });
        }

        // 输出修改后的 JSON
        body = JSON.stringify(data);
        console.log('[YT-Fix] CaptionTracks updated to zh-Hant.');
    } else {
        console.log('[YT-Fix] No captions found in response.');
    }
} catch (e) {
    console.log('[YT-Fix] JSON parse error:', e);
}

// 返回修改后的响应
$done({ body });

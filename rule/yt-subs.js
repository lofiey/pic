let url = $request.url;
let body = $response ? $response.body : null;

// 处理字幕请求头：这是解决“原始字幕”问题的核心
if (url.includes("api/timedtext")) {
    if (!$response && !url.includes("tlang=zh-Hans")) {
        // 发现字幕请求但没有中文参数，强制重定向到带中文参数的 URL
        let newUrl = url + "&tlang=zh-Hans&fmt=vtt"; 
        $done({ url: newUrl });
    } else {
        $done({});
    }
} 

// 处理响应体：在播放器配置中强行插入翻译开关
else if (body) {
    try {
        let obj = JSON.parse(body);
        let changed = false;

        // 递归寻找所有 captions 结构
        const fixCaptions = (target) => {
            if (target && target.playerCaptionsTrackListRenderer) {
                let tracks = target.playerCaptionsTrackListRenderer.captionTracks;
                if (tracks) {
                    tracks.forEach(t => { t.isTranslatable = true; });
                    changed = true;
                }
            }
        };

        if (obj.playerResponse) fixCaptions(obj.playerResponse.captions);
        if (obj.captions) fixCaptions(obj.captions);

        $done({ body: changed ? JSON.stringify(obj) : body });
    } catch (e) {
        $done({ body }); // 遇到 Protobuf 报错不拦截
    }
} else {
    $done({});
}

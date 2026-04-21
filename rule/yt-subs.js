let url = $request.url;
let body = $response ? $response.body : null;

// 1. 处理请求头：强制要求中文翻译
if (url.includes("api/timedtext") && !$response) {
    if (!url.includes("tlang=zh-Hans")) {
        let newUrl = url + "&tlang=zh-Hans";
        $done({ url: newUrl });
    } else {
        $done({});
    }
} 

// 2. 处理响应体：激活翻译菜单
else if (body) {
    try {
        let obj = JSON.parse(body);
        
        // 核心：处理 player 和 next 接口中的字幕列表
        let captions = obj.captions || (obj.playerResponse && obj.playerResponse.captions);
        
        if (captions && captions.playerCaptionsTrackListRenderer) {
            let tracks = captions.playerCaptionsTrackListRenderer.captionTracks;
            if (tracks) {
                tracks.forEach(track => {
                    track.isTranslatable = true; // 强制开启“可翻译”属性
                });
                console.log("YouTube 翻译菜单已激活");
            }
        }
        
        $done({ body: JSON.stringify(obj) });
    } catch (e) {
        // 如果是 Protobuf 或加密流，报错也不要紧，原样放行
        $done({ body });
    }
} 

else {
    $done({});
}

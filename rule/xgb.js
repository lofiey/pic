const TAG = '[YT-Player-Sub]';

(function() {
    // 检查响应体是否存在
    if (typeof $response === 'undefined' || !$response.body) {
        $done({});
        return;
    }

    try {
        let obj = JSON.parse($response.body);

        // 获取视频元数据中的字幕轨列表
        let renderer = obj?.captions?.playerCaptionsTracklistRenderer;
        let captionTracks = renderer?.captionTracks;

        if (captionTracks && Array.isArray(captionTracks) && captionTracks.length > 0) {
            let modifiedCount = 0;

            // 遍历所有可用的字幕轨（无论原语言是英/日/韩）
            captionTracks.forEach(track => {
                if (track.baseUrl && !/[?&]tlang=zh/.test(track.baseUrl)) {
                    // 直接在字幕接口的 baseUrl 末尾附加中文翻译参数
                    track.baseUrl += '&tlang=zh-Hans';
                    modifiedCount++;
                }
            });

            console.log(TAG + ' 成功改写 ' + modifiedCount + ' 条字幕轨的链接为中文');

            // 返回改写后的 JSON 响应
            $done({ body: JSON.stringify(obj) });
            return;
        }
    } catch (e) {
        // 如果遇到了非 JSON 格式数据（例如 Protobuf），直接放行不处理
        console.log(TAG + ' 解析 JSON 跳过: ' + e);
    }

    $done({});
})();

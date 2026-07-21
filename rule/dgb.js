const TAG = '[YT-ZH-Sub]';

(function() {
    let url = $request.url;

    // 如果请求里已经包含了 tlang 参数（说明已经是翻译字幕了），直接放行
    if (/[?&]tlang=/.test(url)) {
        $done({});
        return;
    }

    // 直接改写即将发出的请求 URL，追加中文翻译参数
    let newUrl = url + '&tlang=zh-Hans';
    console.log(TAG + ' 重定向字幕请求至中文: ' + newUrl.substring(0, 100));

    // 返回修改后的 url，Quantumult X 会直接向新 URL 发起请求
    $done({ url: newUrl });
})();

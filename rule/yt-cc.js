/**
 * 极简字幕翻译：只改 URL，不碰 Body
 */
let url = $request.url;

if (url.includes("api/timedtext")) {
    // 强制追加简体中文翻译参数 &tlang=zh-Hans
    if (!url.includes("tlang=zh-Hans")) {
        let newUrl = url + "&tlang=zh-Hans";
        console.log("YouTube 翻译：注入成功");
        $done({ url: newUrl });
    } else {
        $done({});
    }
} else {
    $done({});
}

/*
* YouTube 字幕修复：跳过正则匹配，直接参数注入
*/

let url = $request.url;

// 只处理 timedtext 字幕接口
if (url.includes("api/timedtext")) {
    // 如果已经有中文翻译参数了，直接放行
    if (url.includes("&tlang=zh-Hans") || url.includes("&tlang=zh-Hant")) {
        $done({});
    } else {
        // 关键逻辑：在 URL 后面补上翻译成简体的指令
        // 同时强制使用 vtt 格式，提高 App 兼容性
        let newUrl = url + "&tlang=zh-Hans&fmt=vtt";
        $done({ url: newUrl });
    }
} else {
    $done({});
}

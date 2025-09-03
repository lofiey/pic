/*
* YouTube 字幕自动翻译为简体中文
* 强制将所有自动翻译请求的目标语言设置为简体中文
* 版本: 2025-09-03
* 作者: Lofiey
*/

let url = $request.url;

// 检查请求 URL 是否是 YouTube 字幕翻译 API
if (url.includes("https://www.youtube.com/api/timedtext")) {
    let newUrl = new URL(url);
    // 设置翻译目标语言为简体中文
    newUrl.searchParams.set("tlang", "zh-Hans");
    $done({url: newUrl.toString()});
} else {
    $done({});
}

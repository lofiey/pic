// YouTube 字幕强制简体中文 Script
// 能够完美处理 HTTP/2 请求，避免加载错误

var url = $request.url;
var regex = /&lang=(?!zh)/;

// 如果URL里包含 lang=xx (非zh)，且没有指定 tlang
if (regex.test(url) && url.indexOf("&tlang=") === -1) {
    // 追加简体中文参数
    var newUrl = url + "&tlang=zh-Hans";
    // 告诉圈X使用新URL
    $done({url: newUrl});
} else {
    // 否则原样放行
    $done({});
}

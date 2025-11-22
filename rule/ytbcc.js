// YouTube 智能中文字幕脚本 (修复加载失败Bug)
// 原理：只有当连接里完全没有指定翻译语言时，才自动补全中文。
// 如果用户手动点击了翻译，或者App自带了参数，脚本自动“装死”，防止报错。

var url = $request.url;

// 1. 检查是否是字幕请求 (timedtext)
// 2. 检查是否已经包含 tlang 参数 (说明App已经请求了翻译)
if (url.indexOf("api/timedtext") !== -1 && url.indexOf("&tlang=") === -1) {
    
    // 只有在“原本是生肉”的情况下，才强制加上简体中文
    var newUrl = url + "&tlang=zh-Hans";
    
    // 使用 302 重定向让 App 重新请求带中文的链接
    // 这里使用 307 也可以，但 302 兼容性更好
    $done({
        response: {
            status: 302,
            headers: {
                Location: newUrl
            }
        }
    });
} else {
    // 其他情况（包括手动点击翻译时），原样放行，绝不捣乱
    $done({});
}

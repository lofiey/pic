/* * 只改参数，不拆数据包，最稳方案
 */
let url = $request.url;

if (url.includes("api/timedtext")) {
    // 如果 URL 里还没指定翻译成中文，强制补上
    if (!url.includes("tlang=zh-Hans")) {
        let newUrl = url + "&tlang=zh-Hans";
        $done({ url: newUrl });
    } else {
        $done({});
    }
} else {
    $done({});
}

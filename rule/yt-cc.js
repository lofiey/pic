/*
 * 最终稳健版：只改参数，不碰数据包
 */
let url = $request.url;

if (url.includes("api/timedtext")) {
    // 如果没有中文翻译参数，就强制补一个
    if (!url.includes("tlang=zh-Hans")) {
        // 注入简体中文指令
        let newUrl = url + "&tlang=zh-Hans";
        $done({ url: newUrl });
    } else {
        $done({});
    }
} else {
    $done({});
}

let reqUrl = $request.url;
reqUrl = reqUrl.replace(/([?&])lang=[^&]+/i, "$1lang=zh-Hans");
if (!/tlang=/.test(reqUrl)) {
    reqUrl += "&tlang=zh-Hans";
}
$done({ url: reqUrl });

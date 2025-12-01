let reqUrl = $request.url;
reqUrl = reqUrl.replace(/([?&])lang=[^&]+/, "$1lang=zh-Hans");
if (!/tlang=/.test(reqUrl)) {
  reqUrl += "&tlang=zh-Hans";
}
reqUrl = reqUrl.replace(/([?&])format=[^&]+/, "$1format=json3");
if (!/format=/.test(reqUrl)) {
  reqUrl += "&format=json3";
}
if (!/fmt=/.test(reqUrl)) {
  reqUrl += "&fmt=json3";
}
$done({ url: reqUrl, headers: $response.headers });

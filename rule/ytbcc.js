let url = new URL($request.url);

// 强制字幕语言为简体中文
url.searchParams.set("lang", "zh-Hans");

// 强制加入机翻目标语言
url.searchParams.set("tlang", "zh-Hans");

$done({ url: url.toString() });

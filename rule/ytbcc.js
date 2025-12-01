let url = new URL($request.url);

// 统一强制字幕为简体中文
url.searchParams.set("lang", "zh-Hans");

// 强制加入机翻语言参数
url.searchParams.set("tlang", "zh-Hans");

// 修复 YouTube APP 不稳定的 hl 参数（UI 语言），确保不冲突
url.searchParams.set("hl", "zh-CN");

$done({ url: url.toString() });

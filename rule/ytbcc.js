/* YouTube 自動繁體中文字幕 (Request Modifier) */

const url = $request.url;

// 找到 &lang= 後的參數，將其替換為 &lang=zh 並追加 &tlang=zh-Hant
// 這是專為修改請求 URL 設計的安全代碼。
const newUrl = url.replace(/&lang=([^&]+)/, "&lang=zh&tlang=zh-Hant");

// 返回新的 URL
$done({url: newUrl});

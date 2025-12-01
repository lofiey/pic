/* YouTube 自動繁體中文字幕 (Request Modifier - 移除簽名版本) */

const url = $request.url;
let newUrl = url;

// 1. 移除 signature 參數及其值 (這是導致失敗的主要原因)
newUrl = newUrl.replace(/&signature=([^&]+)/, "");

// 2. 移除 sparams 參數 (這是列出需要簽名參數的列表，必須移除)
newUrl = newUrl.replace(/&sparams=([^&]+)/, "");

// 3. 替換語言參數為 zh 並追加 tlang=zh-Hant
newUrl = newUrl.replace(/&lang=([^&]+)/, "&lang=zh&tlang=zh-Hant");

$done({url: newUrl});

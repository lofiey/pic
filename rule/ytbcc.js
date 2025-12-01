/* YouTube 自動繁體中文字幕 */
const url = $request.url;

// 檢查 URL 中是否已經包含 tlang=zh-Hant，如果包含則不做修改，直接通過。
if (url.includes("tlang=zh-Hant")) {
    $done({});
} else {
    // 使用 JS 替換邏輯：找到 &lang= 後的任意參數，將其替換為 &lang=zh 並追加 &tlang=zh-Hant
    const newUrl = url.replace(/&lang=([^&]+)/, "&lang=zh&tlang=zh-Hant");
    
    // 如果替換成功，則返回新 URL；如果找不到 &lang= 參數，則返回原始 URL。
    $done({url: newUrl});
}

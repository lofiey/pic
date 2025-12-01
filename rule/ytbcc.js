/* YouTube 自動繁體中文字幕 (URLSearchParams 終極版) */

const url = $request.url;

// 使用 URL 物件進行參數操作，這是最安全可靠的方法
const obj = new URL(url);
const params = obj.searchParams;

// 1. 移除簽名相關參數，確保請求不會因簽名無效被拒絕
params.delete('signature');
params.delete('sparams');
params.delete('sig'); // 移除可能存在的另一種簽名格式

// 2. 設置目標語言
// 將原始語言替換為中文 (zh)
params.set('lang', 'zh'); 

// 3. 強制設定自動翻譯的目標語言為繁體中文
params.set('tlang', 'zh-Hant');

// 重建 URL
obj.search = params.toString();

$done({url: obj.toString()});

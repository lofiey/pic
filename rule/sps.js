/* YouTube 簡體中文字幕 (URLSearchParams 單語版) */

const url = $request.url;
const obj = new URL(url);
const params = obj.searchParams;

params.delete('signature');
params.delete('sparams');
params.delete('sig');

params.set('lang', 'zh'); 

params.set('tlang', 'zh-Hans'); 

obj.search = params.toString();

$done({url: obj.toStrin

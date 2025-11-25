// yt-timedtext-translate-cgw.js
// Quantumult X script-response-body
// 功能：拦截 YouTube 的 timedtext 字幕 XML，并机翻为 简体中文 (zh-CN)
// 注：脚本名/标签包含 "c g w"（应用户要求）
// 作者：提供样例，请根据需要调整 translate endpoint 或托管位置

var body = $response && $response.body ? $response.body : '';
if (!body || body.indexOf('<text') === -1) {
  $done({body: body});
} else {
  // 提取所有 <text ...>...</text> 内容（保留属性不变）
  var re = /<text[^>]*>([\s\S]*?)<\/text>/g;
  var matches = [];
  var results;
  while ((results = re.exec(body)) !== null) {
    matches.push(results[1]);
  }

  // HTML 解码（基础）
  function htmlDecode(str) {
    if (!str) return '';
    return str.replace(/&amp;/g, '&')
              .replace(/&lt;/g, '<')
              .replace(/&gt;/g, '>')
              .replace(/&quot;/g, '"')
              .replace(/&#39;/g, "'");
  }
  // XML/HTML 编码（返回到字幕安全的形式）
  function xmlEncode(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;');
  }

  // 翻译单条文本（使用 translate.googleapis.com 非官方接口）
  function translateSingle(text, cb) {
    var t = htmlDecode(text);
    if (!t.trim()) return cb(null, text); // 空白直接返回原文
    var url = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=zh-CN&dt=t&q=' + encodeURIComponent(t);
    $httpClient.get(url, function(error, response, data) {
      if (error || !data) {
        cb(error || new Error('no data'), text);
      } else {
        try {
          var arr = JSON.parse(data);
          // arr[0] 是分段翻译，拼接每个部分的翻译结果
          var translated = '';
          if (Array.isArray(arr) && Array.isArray(arr[0])) {
            for (var i=0;i<arr[0].length;i++){
              if (arr[0][i] && arr[0][i][0]) translated += arr[0][i][0];
            }
          } else {
            translated = t; // fallback
          }
          cb(null, xmlEncode(translated));
        } catch (e){
          cb(e, text);
        }
      }
    });
  }

  // 顺序翻译所有匹配（避免并发请求太多）
  var idx = 0;
  var translatedParts = [];
  function next() {
    if (idx >= matches.length) {
      // 替换原 body 中的每个 <text>...</text> 内容（按序替换）
      var i = 0;
      var newBody = body.replace(/(<text[^>]*>)([\s\S]*?)(<\/text>)/g, function(_, a, b, c) {
        var rep = translatedParts[i] !== undefined ? translatedParts[i] : b;
        i++;
        return a + rep + c;
      });
      $done({body: newBody});
      return;
    }
    (function(j){
      translateSingle(matches[j], function(err, translated){
        if (err) {
          // 出错则保留原文（并继续）
          translatedParts[j] = xmlEncode(matches[j]);
        } else {
          translatedParts[j] = translated;
        }
        idx++;
        // 小延迟可降低并发（Quantumult X 环境内 setTimeout 可用）
        setTimeout(next, 50);
      });
    })(idx);
  }
  next();
}

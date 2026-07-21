const TAG = '[YT-ZH-Sub]';

(function() {
    var url = $request.url;

    if (/[?&]tlang=zh/.test(url) || /[?&]lang=zh/.test(url)) {
        console.log(TAG + ' already zh, skip');
        $done({});
        return;
    }

    var zhUrl = url + '&tlang=zh-Hans&_ytzhsub=1';

    var headers = {};
    if ($request.headers) {
        var keys = Object.keys($request.headers);
        for (var i = 0; i < keys.length; i++) {
            var k = keys[i];
            if (k.toLowerCase() !== 'host') {
                headers[k] = $request.headers[k];
            }
        }
    }
    delete headers['Cookie'];
    delete headers['cookie'];

    console.log(TAG + ' fetching zh: ' + zhUrl.substring(0, 120));

    fetchWithRetry(zhUrl, headers, 3, 800);
})();

function fetchWithRetry(zhUrl, headers, retriesLeft, delayMs) {
    $task.fetch({
        url: zhUrl,
        method: 'GET',
        headers: headers
    }).then(function(resp) {
        var status = resp.statusCode || resp.status || 0;
        console.log(TAG + ' fetch status=' + status + ' bodyLen=' + (resp.body ? resp.body.length : 0));

        if (status === 200 && resp.body && resp.body.length > 100) {
            console.log(TAG + ' replaced with zh subtitle');
            $done({ body: resp.body });
            return;
        }

        // 429 = 被 YouTube 限流，不是真的失败，等一下重试
        if (status === 429 && retriesLeft > 0) {
            var retryAfterHeader = resp.headers && (resp.headers['Retry-After'] || resp.headers['retry-after']);
            var wait = retryAfterHeader ? parseInt(retryAfterHeader, 10) * 1000 : delayMs;
            if (!wait || isNaN(wait)) wait = delayMs;

            console.log(TAG + ' got 429, retry in ' + wait + 'ms, retriesLeft=' + (retriesLeft - 1));
            setTimeout(function() {
                fetchWithRetry(zhUrl, headers, retriesLeft - 1, delayMs * 2);
            }, wait);
            return;
        }

        console.log(TAG + ' fetch failed (status=' + status + '), keep original');
        $done({});
    }, function(err) {
        console.log(TAG + ' fetch error: ' + (err.error || err));
        if (retriesLeft > 0) {
            console.log(TAG + ' network error, retry in ' + delayMs + 'ms, retriesLeft=' + (retriesLeft - 1));
            setTimeout(function() {
                fetchWithRetry(zhUrl, headers, retriesLeft - 1, delayMs * 2);
            }, delayMs);
        } else {
            $done({});
        }
    });
}

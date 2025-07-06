/*
    Dualsub for Quantumult X by Neurogram
 
        - Disney+, Star+, HBO Max, Prime Video, YouTube official bilingual subtitles
        - Disney+, Star+, HBO Max, Hulu, Netflix, Paramount+, Prime Video, etc. external subtitles
        - Disney+, Star+, HBO Max, Hulu, Netflix, Paramount+, Prime Video, etc. machine translation bilingual subtitles (Google, DeepL)
        - Customized language support
 
    Manual:
        Setting tool for Shortcuts: https://www.icloud.com/shortcuts/8ec4a2a3af514282bf27a11050f39fc2

        Quantumult X:

        [rewrite_local]

        // All in one
        ^http.+(media.(dss|star)ott|manifests.v2.api.hbo|hbomaxcdn|nflxvideo|cbs(aa|i)video|cloudfront|akamaihd|avi-cdn|huluim|youtube).(com|net)\/(.+\.vtt($|\?m=\d+)|.+-all-.+\.m3u8.*|hls\.m3u8.+|\?o=\d+&v=\d+&e=.+|\w+\/2\$.+\/[a-zA-Z0-9-]+\.m3u8|api\/timedtext.+) url script-response-body Dualsub.js
        ^http.+(setting|general).(media.dssott|hbomaxcdn|nflxvideo|youtube|cbsivideo|cloudfront|huluim).(com|net)\/\?action=(g|s)et url script-analyze-echo-response Dualsub.js

        // Netflix individual
        https:\/\/.+nflxvideo.net\/\?o=\d+&v=\d+&e=.+ url script-response-body Dualsub.js
        https:\/\/setting.nflxvideo.net\/\?action=(g|s)et url script-analyze-echo-response Dualsub.js

        // 
        [mitm]
        hostname = *.media.dssott.com, *.media.starott.com, *.api.hbo.com, *.hbomaxcdn.com, *.huluim.com, *.nflxvideo.net, *.cbsaavideo.com, *.cbsivideo.com, *.cloudfront.net, *.akamaihd.net, *.avi-cdn.net, *.youtube.com

    Author:
        Telegram: Neurogram
        GitHub: Neurogram-R
*/

let url = $request.url
let headers = $request.headers

let default_settings = {
    Netflix: {
        type: "Google", // Google, DeepL, External, Disable
        lang: "ZH-Hans",
        sl: "auto",
        tl: "English [CC]",
        line: "s", // f, s
        dkey: "null", // DeepL API key
        s_subtitles_url: "null",
        t_subtitles_url: "null",
        subtitles: "null",
        subtitles_type: "null",
        subtitles_sl: "null",
        subtitles_tl: "null",
        subtitles_line: "null",
        external_subtitles: "null"
    }
}

let settings = $prefs.valueForKey("settings")

if (!settings) settings = default_settings

if (typeof (settings) == "string") settings = JSON.parse(settings)

let service = ""
if (url.match(/nflxvideo.net/)) service = "Netflix"

if (settings.General) {
    let general_service = settings.General.service.split(", ")
    for (var s in general_service) {
        let patt = new RegExp(general_service[s])
        if (url.match(patt)) {
            service = "General"
            break
        }
    }
}

if (!service) $done({})

if (!settings[service]) settings[service] = default_settings[service]
let setting = settings[service]

if (url.match(/action=get/)) {
    delete setting.t_subtitles_url
    delete setting.subtitles
    delete setting.external_subtitles
    $done({ status: "HTTP/1.1 200 OK", body: JSON.stringify(setting), headers: { "Content-Type": "application/json" } })
}


let body = $response.body

if (service == "Netflix" && !body.match(/\d+:\d\d:\d\d.\d\d\d -->.+line.+\n.+/g)) $done({})

if (setting.type == "Disable") $done({})

if (setting.type != "Official" && url.match(/\.m3u8/)) $done({})

    let patt = new RegExp(`lang=${setting.tl}`)

    if (url.replace(/&lang=zh(-Hans)*&/, "&lang=zh-CN&").replace(/&lang=zh-Hant&/, "&lang=zh-TW&").match(patt) || url.match(/&tlang=/)) $done({})

    let t_url = `${url}&tlang=${setting.tl == "zh-CN" ? "zh-Hans" : setting.tl == "zh-TW" ? "zh-Hant" : setting.tl}`

    let options = {
        url: t_url,
        headers: headers
    }

    $task.fetch(options).then(response => {

        if (setting.line == "sl") $done({ body: response.body })
        let timeline = body.match(/<p t="\d+" d="\d+">/g)

        if (url.match(/&kind=asr/)) {
            body = body.replace(/<\/?s[^>]*>/g, "")
            response.body = response.body.replace(/<\/?s[^>]*>/g, "")
            timeline = body.match(/<p t="\d+" d="\d+"[^>]+>/g)
        }

        for (var i in timeline) {
            let patt = new RegExp(`${timeline[i]}([^<]+)<\\/p>`)
            if (body.match(patt) && response.body.match(patt)) {
                if (setting.line == "s") body = body.replace(patt, `${timeline[i]}$1\n${response.body.match(patt)[1]}</p>`)
                if (setting.line == "f") body = body.replace(patt, `${timeline[i]}${response.body.match(patt)[1]}\n$1</p>`)
            }
        }

        $done({ body })

    })

}

if (url.match(/\.(web)?vtt/) || service == "Netflix" || service == "General") {
    if (service != "Netflix" && url == setting.s_subtitles_url && setting.subtitles != "null" && setting.subtitles_type == setting.type && setting.subtitles_sl == setting.sl && setting.subtitles_tl == setting.tl && setting.subtitles_line == setting.line) $done({ body: setting.subtitles })

    if (setting.type == "Official") {
        if (subtitles_urls_data == "null") $done({})
        subtitles_urls_data = subtitles_urls_data.match(/.+\.vtt/g)
        if (subtitles_urls_data) official_subtitles(subtitles_urls_data)
    }

    if (setting.type == "Google") machine_subtitles("Google")

    if (setting.type == "DeepL") machine_subtitles("DeepL")

    if (setting.type == "External") external_subtitles()
}

function external_subtitles() {
    let patt = new RegExp(`(\\d+\\n)*\\d+:\\d\\d:\\d\\d.\\d\\d\\d --> \\d+:\\d\\d:\\d\\d.\\d.+(\\n|.)+`)
    if (!setting.external_subtitles.match(patt)) $done({})
    if (!body.match(patt)) $done({})
    let external = setting.external_subtitles.replace(/(\d+:\d\d:\d\d),(\d\d\d)/g, "$1.$2")
    body = body.replace(patt, external.match(patt)[0])
    $done({ body: body })
}

async function machine_subtitles(type) {

    body = body.replace(/\r/g, "")
    body = body.replace(/(\d+:\d\d:\d\d.\d\d\d --> \d+:\d\d:\d\d.\d.+\n.+)\n(.+)/g, "$1 $2")
    body = body.replace(/(\d+:\d\d:\d\d.\d\d\d --> \d+:\d\d:\d\d.\d.+\n.+)\n(.+)/g, "$1 $2")

    let dialogue = body.match(/\d+:\d\d:\d\d.\d\d\d --> \d+:\d\d:\d\d.\d.+\n.+/g)

    if (!dialogue) $done({})

    let timeline = body.match(/\d+:\d\d:\d\d.\d\d\d --> \d+:\d\d:\d\d.\d.+/g)

    let s_sentences = []
    for (var i in dialogue) {
        s_sentences.push(`${type == "Google" ? "~" + i + "~" : "&text="}${dialogue[i].replace(/<\/*(c\.[^>]+|i|c)>/g, "").replace(/\d+:\d\d:\d\d.\d\d\d --> \d+:\d\d:\d\d.\d.+\n/, "")}`)
    }
    s_sentences = groupAgain(s_sentences, type == "Google" ? 80 : 50)

    let t_sentences = []
    let trans_result = []

    if (type == "Google") {
        for (var p in s_sentences) {
            let options = {
                url: `https://translate.google.com/translate_a/single?client=it&dt=qca&dt=t&dt=rmt&dt=bd&dt=rms&dt=sos&dt=md&dt=gt&dt=ld&dt=ss&dt=ex&otf=2&dj=1&hl=en&ie=UTF-8&oe=UTF-8&sl=${setting.sl}&tl=${setting.tl}`,
                method: "POST",
                headers: {
                    "User-Agent": "GoogleTranslate/6.29.59279 (iPhone; iOS 15.4; en; iPhone14,2)"
                },
                body: `q=${encodeURIComponent(s_sentences[p].join("\n"))}`
            }

            let trans = await send_request(options)

            if (trans.sentences) {
                let sentences = trans.sentences
                for (var k in sentences) {
                    if (sentences[k].trans) trans_result.push(sentences[k].trans.replace(/\n$/g, "").replace(/\n/g, " ").replace(/〜|～/g, "~"))
                }
            }
        }

        if (trans_result.length > 0) {
            t_sentences = trans_result.join(" ").match(/~\d+~[^~]+/g)
        }

    }

    if (type == "DeepL") {
        for (var l in s_sentences) {
            let options = {
                url: "https://api-free.deepl.com/v2/translate",
                method: "POST",
                body: `auth_key=${setting.dkey}${setting.sl == "auto" ? "" : `&source_lang=${setting.sl}`}&target_lang=${setting.tl}${s_sentences[l].join("")}`
            }

            let trans = await send_request(options)

            if (trans.translations) trans_result.push(trans.translations)
        }

        if (trans_result.length > 0) {
            for (var o in trans_result) {
                for (var u in trans_result[o]) {
                    t_sentences.push(trans_result[o][u].text.replace(/\n/g, " "))
                }
            }
        }
    }

    if (t_sentences.length > 0) {
        let g_t_sentences = t_sentences.join("\n").replace(/\s\n/g, "\n")

        for (var j in dialogue) {
            let patt = new RegExp(`(${timeline[j]})`)
            if (setting.line == "s") patt = new RegExp(`(${dialogue[j].replace(/(\[|\]|\(|\)|\?)/g, "\\$1")})`)

            let patt2 = new RegExp(`~${j}~\\s*(.+)`)

            if (g_t_sentences.match(patt2) && type == "Google") body = body.replace(patt, `$1\n${g_t_sentences.match(patt2)[1]}`)

            if (type == "DeepL") body = body.replace(patt, `$1\n${t_sentences[j]}`)

        }

        if (service != "Netflix") {
            settings[service].s_subtitles_url = url
            settings[service].subtitles = body
            settings[service].subtitles_type = setting.type
            settings[service].subtitles_sl = setting.sl
            settings[service].subtitles_tl = setting.tl
            settings[service].subtitles_line = setting.line
            $prefs.setValueForKey(JSON.stringify(settings), "settings")
        }
    }

    $done({ body: body })

}

function send_request(options) {
    return new Promise((resolve, reject) => {
        $task.fetch(options).then(response => {
            resolve(options.method == "GET" ? response.body : JSON.parse(response.body))
        })
    })
}

function groupAgain(data, num) {
    var result = []
    for (var i = 0; i < data.length; i += num) {
        result.push(data.slice(i, i + num))
    }
    return result
}

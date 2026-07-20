/**
 * DualSubs: Universal Subtitle Translate Bundle
 * Optimized & Refactored Version
 */

console.log("🍿 DualSubs: 🕳 Universal");
console.log("Translate.response.bundle.js");
console.log("Version: 1.7.5 (Refactored)");

// ==========================================
// 1. Environment Detection & Environment Global
// ==========================================
const ENV = (() => {
  const keys = Object.keys(globalThis);
  if (keys.includes("$task")) return "Quantumult X";
  if (keys.includes("$loon")) return "Loon";
  if (keys.includes("$rocket")) return "Shadowrocket";
  if (typeof module !== "undefined") return "Node.js";
  if (keys.includes("Egern")) return "Egern";
  if (keys.includes("$environment")) {
    if ($environment["surge-version"]) return "Surge";
    if ($environment["stash-version"]) return "Stash";
  }
  return "Unknown";
})();

// ==========================================
// 2. MD5 & Crypto Standard Module
// ==========================================
const CryptoUtils = (() => {
  let nativeCrypto = typeof globalThis !== "undefined" && globalThis.crypto ? globalThis.crypto : null;
  if (!nativeCrypto && typeof window !== "undefined") nativeCrypto = window.crypto || window.msCrypto;

  function getRandomWord() {
    if (nativeCrypto) {
      if (typeof nativeCrypto.getRandomValues === "function") {
        try { return nativeCrypto.getRandomValues(new Uint32Array(1))[0]; } catch (_) {}
      }
      if (typeof nativeCrypto.randomBytes === "function") {
        try { return nativeCrypto.randomBytes(4).readInt32LE(); } catch (_) {}
      }
    }
    throw new Error("Native crypto module could not be used for secure random numbers.");
  }

  const Base = {
    extend(obj) {
      const instance = Object.create(this);
      if (obj) instance.mixIn(obj);
      if (!instance.hasOwnProperty("init") || this.init === instance.init) {
        instance.init = function () { instance.$super.init.apply(this, arguments); };
      }
      instance.init.prototype = instance;
      instance.$super = this;
      return instance;
    },
    create(...args) {
      const instance = this.extend();
      instance.init(...args);
      return instance;
    },
    init() {},
    mixIn(obj) {
      for (const k in obj) {
        if (obj.hasOwnProperty(k)) this[k] = obj[k];
      }
      if (obj.hasOwnProperty("toString")) this.toString = obj.toString;
    },
    clone() {
      return this.init.prototype.extend(this);
    }
  };

  const WordArray = Base.extend({
    init(words = [], sigBytes) {
      this.words = words;
      this.sigBytes = sigBytes !== undefined ? sigBytes : words.length * 4;
    },
    toString(encoder) {
      return (encoder || Hex).stringify(this);
    },
    concat(wordArray) {
      const thisWords = this.words;
      const thatWords = wordArray.words;
      const thisSig = this.sigBytes;
      const thatSig = wordArray.sigBytes;

      this.clamp();
      if (thisSig % 4) {
        for (let i = 0; i < thatSig; i++) {
          const byte = (thatWords[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
          thisWords[(thisSig + i) >>> 2] |= byte << (24 - ((thisSig + i) % 4) * 8);
        }
      } else {
        for (let i = 0; i < thatSig; i += 4) {
          thisWords[(thisSig + i) >>> 2] = thatWords[i >>> 2];
        }
      }
      this.sigBytes += thatSig;
      return this;
    },
    clamp() {
      const words = this.words;
      const sigBytes = this.sigBytes;
      words[sigBytes >>> 2] &= 0xffffffff << (32 - (sigBytes % 4) * 8);
      words.length = Math.ceil(sigBytes / 4);
    },
    clone() {
      const clone = Base.clone.call(this);
      clone.words = this.words.slice(0);
      return clone;
    }
  });

  const Hex = {
    stringify(wordArray) {
      const words = wordArray.words;
      const sigBytes = wordArray.sigBytes;
      const hexChars = [];
      for (let i = 0; i < sigBytes; i++) {
        const byte = (words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
        hexChars.push((byte >>> 4).toString(16), (byte & 0x0f).toString(16));
      }
      return hexChars.join("");
    }
  };

  const Latin1 = {
    stringify(wordArray) {
      const words = wordArray.words;
      const sigBytes = wordArray.sigBytes;
      const chars = [];
      for (let i = 0; i < sigBytes; i++) {
        const byte = (words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
        chars.push(String.fromCharCode(byte));
      }
      return chars.join("");
    },
    parse(str) {
      const len = str.length;
      const words = [];
      for (let i = 0; i < len; i++) {
        words[i >>> 2] |= (str.charCodeAt(i) & 0xff) << (24 - (i % 4) * 8);
      }
      return WordArray.create(words, len);
    }
  };

  const Utf8 = {
    stringify(wordArray) {
      try {
        return decodeURIComponent(escape(Latin1.stringify(wordArray)));
      } catch (_) {
        throw new Error("Malformed UTF-8 data");
      }
    },
    parse(str) {
      return Latin1.parse(unescape(encodeURIComponent(str)));
    }
  };

  const BufferedBlockAlgorithm = Base.extend({
    reset() {
      this._data = WordArray.create();
      this._nDataBytes = 0;
    },
    _append(data) {
      if (typeof data === "string") data = Utf8.parse(data);
      this._data.concat(data);
      this._nDataBytes += data.sigBytes;
    },
    _process(doFlush) {
      const data = this._data;
      const words = data.words;
      const sigBytes = data.sigBytes;
      const blockSize = this.blockSize;
      let blocksAvailable = sigBytes / (blockSize * 4);

      blocksAvailable = doFlush
        ? Math.ceil(blocksAvailable)
        : Math.max((blocksAvailable | 0) - this._minBufferSize, 0);

      const nWordsProcess = blocksAvailable * blockSize;
      const nBytesProcess = Math.min(nWordsProcess * 4, sigBytes);

      let processedWords;
      if (nWordsProcess) {
        for (let offset = 0; offset < nWordsProcess; offset += blockSize) {
          this._doProcessBlock(words, offset);
        }
        processedWords = words.splice(0, nWordsProcess);
        data.sigBytes -= nBytesProcess;
      }
      return WordArray.create(processedWords, nBytesProcess);
    },
    _minBufferSize: 0
  });

  const Hasher = BufferedBlockAlgorithm.extend({
    cfg: Base.extend(),
    init(cfg) {
      this.cfg = this.cfg.extend(cfg);
      this.reset();
    },
    reset() {
      BufferedBlockAlgorithm.reset.call(this);
      this._doReset();
    },
    update(data) {
      this._append(data);
      this._process();
      return this;
    },
    finalize(data) {
      if (data) this._append(data);
      return this._doFinalize();
    },
    blockSize:  block = 16
  });

  // MD5 Constants & Logic
  const T = [];
  for (let i = 0; i < 64; i++) {
    T[i] = (Math.abs(Math.sin(i + 1)) * 0x100000000) | 0;
  }

  function ff(a, b, c, d, x, s, t) {
    const n = a + ((b & c) | (~b & d)) + x + t;
    return ((n << s) | (n >>> (32 - s))) + b;
  }
  function gg(a, b, c, d, x, s, t) {
    const n = a + ((b & d) | (c & ~d)) + x + t;
    return ((n << s) | (n >>> (32 - s))) + b;
  }
  function hh(a, b, c, d, x, s, t) {
    const n = a + (b ^ c ^ d) + x + t;
    return ((n << s) | (n >>> (32 - s))) + b;
  }
  function ii(a, b, c, d, x, s, t) {
    const n = a + (c ^ (b | ~d)) + x + t;
    return ((n << s) | (n >>> (32 - s))) + b;
  }

  const MD5Hasher = Hasher.extend({
    _doReset() {
      this._hash = WordArray.create([0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476]);
    },
    _doProcessBlock(words, offset) {
      for (let i = 0; i < 16; i++) {
        const index = offset + i;
        const w = words[index];
        words[index] = ((w << 8) | (w >>> 24)) & 0x00ff00ff | ((w << 24) | (w >>> 8)) & 0xff00ff00;
      }

      const H = this._hash.words;
      let a = H[0], b = H[1], c = H[2], d = H[3];

      a = ff(a, b, c, d, words[offset + 0], 7, T[0]);
      d = ff(d, a, b, c, words[offset + 1], 12, T[1]);
      c = ff(c, d, a, b, words[offset + 2], 17, T[2]);
      b = ff(b, c, d, a, words[offset + 3], 22, T[3]);
      a = ff(a, b, c, d, words[offset + 4], 7, T[4]);
      d = ff(d, a, b, c, words[offset + 5], 12, T[5]);
      c = ff(c, d, a, b, words[offset + 6], 17, T[6]);
      b = ff(b, c, d, a, words[offset + 7], 22, T[7]);
      a = ff(a, b, c, d, words[offset + 8], 7, T[8]);
      d = ff(d, a, b, c, words[offset + 9], 12, T[9]);
      c = ff(c, d, a, b, words[offset + 10], 17, T[10]);
      b = ff(b, c, d, a, words[offset + 11], 22, T[11]);
      a = ff(a, b, c, d, words[offset + 12], 7, T[12]);
      d = ff(d, a, b, c, words[offset + 13], 12, T[13]);
      c = ff(c, d, a, b, words[offset + 14], 17, T[14]);
      b = ff(b, c, d, a, words[offset + 15], 22, T[15]);

      a = gg(a, b, c, d, words[offset + 1], 5, T[16]);
      d = gg(d, a, b, c, words[offset + 6], 9, T[17]);
      c = gg(c, d, a, b, words[offset + 11], 14, T[18]);
      b = gg(b, c, d, a, words[offset + 0], 20, T[19]);
      a = gg(a, b, c, d, words[offset + 5], 5, T[20]);
      d = gg(d, a, b, c, words[offset + 10], 9, T[21]);
      c = gg(c, d, a, b, words[offset + 15], 14, T[22]);
      b = gg(b, c, d, a, words[offset + 4], 20, T[23]);
      a = gg(a, b, c, d, words[offset + 9], 5, T[24]);
      d = gg(d, a, b, c, words[offset + 14], 9, T[25]);
      c = gg(c, d, a, b, words[offset + 3], 14, T[26]);
      b = gg(b, c, d, a, words[offset + 8], 20, T[27]);
      a = gg(a, b, c, d, words[offset + 13], 5, T[28]);
      d = gg(d, a, b, c, words[offset + 2], 9, T[29]);
      c = gg(c, d, a, b, words[offset + 7], 14, T[30]);
      b = gg(b, c, d, a, words[offset + 12], 20, T[31]);

      a = hh(a, b, c, d, words[offset + 5], 4, T[32]);
      d = hh(d, a, b, c, words[offset + 8], 11, T[33]);
      c = hh(c, d, a, b, words[offset + 11], 16, T[34]);
      b = hh(b, c, d, a, words[offset + 14], 23, T[35]);
      a = hh(a, b, c, d, words[offset + 1], 4, T[36]);
      d = hh(d, a, b, c, words[offset + 4], 11, T[37]);
      c = hh(c, d, a, b, words[offset + 7], 16, T[38]);
      b = hh(b, c, d, a, words[offset + 10], 23, T[39]);
      a = hh(a, b, c, d, words[offset + 13], 4, T[40]);
      d = hh(d, a, b, c, words[offset + 0], 11, T[41]);
      c = hh(c, d, a, b, words[offset + 3], 16, T[42]);
      b = hh(b, c, d, a, words[offset + 6], 23, T[43]);
      a = hh(a, b, c, d, words[offset + 9], 4, T[44]);
      d = hh(d, a, b, c, words[offset + 12], 11, T[45]);
      c = hh(c, d, a, b, words[offset + 15], 16, T[46]);
      b = hh(b, c, d, a, words[offset + 2], 23, T[47]);

      a = ii(a, b, c, d, words[offset + 0], 6, T[48]);
      d = ii(d, a, b, c, words[offset + 7], 10, T[49]);
      c = ii(c, d, a, b, words[offset + 14], 15, T[50]);
      b = ii(b, c, d, a, words[offset + 5], 21, T[51]);
      a = ii(a, b, c, d, words[offset + 12], 6, T[52]);
      d = ii(d, a, b, c, words[offset + 3], 10, T[53]);
      c = ii(c, d, a, b, words[offset + 10], 15, T[54]);
      b = ii(b, c, d, a, words[offset + 1], 21, T[55]);
      a = ii(a, b, c, d, words[offset + 8], 6, T[56]);
      d = ii(d, a, b, c, words[offset + 15], 10, T[57]);
      c = ii(c, d, a, b, words[offset + 6], 15, T[58]);
      b = ii(b, c, d, a, words[offset + 13], 21, T[59]);
      a = ii(a, b, c, d, words[offset + 4], 6, T[60]);
      d = ii(d, a, b, c, words[offset + 11], 10, T[61]);
      c = ii(c, d, a, b, words[offset + 2], 15, T[62]);
      b = ii(b, c, d, a, words[offset + 9], 21, T[63]);

      H[0] = (H[0] + a) | 0;
      H[1] = (H[1] + b) | 0;
      H[2] = (H[2] + c) | 0;
      H[3] = (H[3] + d) | 0;
    },
    _doFinalize() {
      const data = this._data;
      const words = data.words;
      const nBitsTotal = this._nDataBytes * 8;
      const nBitsLeft = data.sigBytes * 8;

      words[nBitsLeft >>> 5] |= 0x80 << (24 - (nBitsLeft % 32));
      const nBitsTotalHigh = Math.floor(nBitsTotal / 0x100000000);

      words[(((nBitsLeft + 64) >>> 9) << 4) + 15] =
        (((nBitsTotalHigh << 8) | (nBitsTotalHigh >>> 24)) & 0x00ff00ff) |
        (((nBitsTotalHigh << 24) | (nBitsTotalHigh >>> 8)) & 0xff00ff00);
      words[(((nBitsLeft + 64) >>> 9) << 4) + 14] =
        (((nBitsTotal << 8) | (nBitsTotal >>> 24)) & 0x00ff00ff) |
        (((nBitsTotal << 24) | (nBitsTotal >>> 8)) & 0xff00ff00);

      data.sigBytes = (words.length + 1) * 4;
      this._process();

      const H = this._hash.words;
      for (let i = 0; i < 4; i++) {
        const w = H[i];
        H[i] = ((w << 8) | (w >>> 24)) & 0x00ff00ff | ((w << 24) | (w >>> 8)) & 0xff00ff00;
      }
      return this._hash;
    }
  });

  return {
    MD5: (message) => MD5Hasher.create().finalize(message).toString()
  };
})();

// ==========================================
// 3. Logger & Object Helper Utilities
// ==========================================
class Logger {
  static #counters = new Map();
  static #groupStack = [];
  static #timers = new Map();
  static #level = 3; // 0: OFF, 1: ERROR, 2: WARN, 3: INFO, 4: DEBUG, 5: ALL

  static set logLevel(level) {
    if (typeof level === "string") {
      const map = { off: 0, error: 1, warn: 2, warning: 2, info: 3, debug: 4, all: 5 };
      this.#level = map[level.toLowerCase()] ?? 2;
    } else if (typeof level === "number") {
      this.#level = level;
    }
  }

  static log(...args) {
    if (this.#level === 0) return;
    let formatted = args.map(arg => typeof arg === "object" ? JSON.stringify(arg) : String(arg));
    this.#groupStack.forEach(group => {
      formatted = formatted.map(item => `  ${item}`);
      formatted.unshift(`▼ ${group}:`);
    });
    console.log(["", ...formatted].join("\n"));
  }

  static info(...args) { if (this.#level >= 3) this.log(...args.map(a => `ℹ️ ${a}`)); }
  static warn(...args) { if (this.#level >= 2) this.log(...args.map(a => `⚠️ ${a}`)); }
  static error(...args) {
    if (this.#level >= 1) {
      const msg = ENV === "Node.js" ? args.map(a => `❌ ${a.stack || a}`) : args.map(a => `❌ ${a}`);
      this.log(...msg);
    }
  }
  static debug(...args) { if (this.#level >= 4) this.log(...args.map(a => `🅱️ ${a}`)); }
  static time(label = "default") { this.#timers.set(label, Date.now()); }
  static timeEnd(label = "default") { this.#timers.delete(label); }
  static timeLog(label = "default") {
    const t = this.#timers.get(label);
    t ? this.log(`${label}: ${Date.now() - t}ms`) : this.warn(`Timer "${label}" doesn't exist`);
  }
}

class ObjectUtils {
  static toPath(path) {
    return Array.isArray(path) ? path : path.replace(/\[(\d+)\]/g, ".$1").split(".").filter(Boolean);
  }
  static get(obj = {}, path = "", defaultValue) {
    const res = this.toPath(path).reduce((acc, key) => Object(acc)[key], obj);
    return res === undefined ? defaultValue : res;
  }
  static set(obj, path, value) {
    const keys = this.toPath(path);
    keys.slice(0, -1).reduce((acc, key, idx) => {
      return Object(acc[key]) === acc[key]
        ? acc[key]
        : (acc[key] = /^\d+$/.test(keys[idx + 1]) ? [] : {});
    }, obj)[keys[keys.length - 1]] = value;
    return obj;
  }
  static unset(obj = {}, path = "") {
    const keys = this.toPath(path);
    return keys.reduce((acc, key, idx) => {
      if (idx === keys.length - 1) {
        delete acc[key];
        return true;
      }
      return Object(acc)[key];
    }, obj);
  }
}

// ==========================================
// 4. Unified HTTP Request Client
// ==========================================
const HTTP_STATUS_TEXT = {
  200: "OK", 201: "Created", 204: "No Content", 400: "Bad Request",
  401: "Unauthorized", 403: "Forbidden", 404: "Not Found", 500: "Internal Server Error"
};

async function fetchRequest(resource, options = {}) {
  let config = typeof resource === "string" ? { ...options, url: resource } : { ...options, ...resource };
  
  if (!config.method) {
    config.method = (config.body || config.bodyBytes) ? "POST" : "GET";
  }

  // Clean restricted headers
  if (config.headers) {
    delete config.headers.Host;
    delete config.headers[":authority"];
    delete config.headers["Content-Length"];
    delete config.headers["content-length"];
  }

  const methodLower = config.method.toLowerCase();
  config.timeout = config.timeout ? Number.parseInt(config.timeout, 10) : 5;
  if (config.timeout > 500) config.timeout = Math.round(config.timeout / 1000);

  // Platform specific proxy logic
  switch (ENV) {
    case "Loon":
    case "Surge":
    case "Stash":
    case "Egern":
    case "Shadowrocket":
    default: {
      if (config.timeout && ENV === "Loon") config.timeout *= 1000;
      if (config.policy) {
        if (ENV === "Loon") config.node = config.policy;
        else if (ENV === "Stash") ObjectUtils.set(config, "headers.X-Stash-Selected-Proxy", encodeURI(config.policy));
        else if (ENV === "Shadowrocket") ObjectUtils.set(config, "headers.X-Surge-Proxy", config.policy);
      }
      if (typeof config.redirection === "boolean") config["auto-redirect"] = config.redirection;
      if (config.bodyBytes && !config.body) {
        config.body = config.bodyBytes;
        config.bodyBytes = undefined;
      }

      return new Promise((resolve, reject) => {
        $httpClient[methodLower](config, (err, response, body) => {
          if (err) return reject(err);
          response.ok = /^2\d\d$/.test(response.status);
          response.statusCode = response.status;
          response.statusText = HTTP_STATUS_TEXT[response.status] || "";
          if (body) {
            response.body = body;
            if (config["binary-mode"]) response.bodyBytes = body;
          }
          resolve(response);
        });
      });
    }
    case "Quantumult X": {
      config.timeout *= 1000;
      if (config.policy) ObjectUtils.set(config, "opts.policy", config.policy);
      if (typeof config["auto-redirect"] === "boolean") ObjectUtils.set(config, "opts.redirection", config["auto-redirect"]);

      return Promise.race([
        $task.fetch(config).then(res => {
          res.ok = /^2\d\d$/.test(res.statusCode);
          res.status = res.statusCode;
          res.statusText = HTTP_STATUS_TEXT[res.status] || "";
          return res;
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), config.timeout))
      ]);
    }
    case "Node.js": {
      const fetchApi = globalThis.fetch || require("node-fetch");
      config.timeout *= 1000;
      const { url, ...opts } = config;

      return Promise.race([
        fetchApi(url, opts).then(async res => {
          const buffer = await res.arrayBuffer();
          return {
            ok: res.ok,
            status: res.status,
            statusCode: res.status,
            statusText: res.statusText,
            body: new TextDecoder("utf-8").decode(buffer),
            bodyBytes: buffer,
            headers: Object.fromEntries(res.headers.entries())
          };
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), config.timeout))
      ]);
    }
  }
}

// ==========================================
// 5. Main Translate Class Engine
// ==========================================
class Translate {
  constructor(options = {}) {
    this.Name = "Translate";
    this.Version = "1.0.7";
    Logger.log(`🟧 ${this.Name} v${this.Version}`);
    this.Source = "AUTO";
    this.Target = "ZH";
    this.API = {};
    Object.assign(this, options);
  }

  #userAgents = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
  ];

  #langMaps = {
    Google: { AUTO: "auto", EN: "en", ZH: "zh", "ZH-HANS": "zh-CN", "ZH-HANT": "zh-TW", JA: "ja", KO: "ko" },
    Microsoft: { AUTO: "", EN: "en", ZH: "zh-Hans", "ZH-HANS": "zh-Hans", "ZH-HANT": "zh-Hant", JA: "ja", KO: "ko" }
  };

  getRandomUA() {
    return this.#userAgents[Math.floor(Math.random() * this.#userAgents.length)];
  }

  async Google(textList = [], from = this.Source, to = this.Target) {
    const list = Array.isArray(textList) ? textList : [textList];
    const sourceLang = this.#langMaps.Google[from] || from.toLowerCase();
    const targetLang = this.#langMaps.Google[to] || to.toLowerCase();

    const endpoint = `https://translate.googleapis.com/translate_a/single?client=gtx&dt=t&sl=${sourceLang}&tl=${targetLang}&q=${encodeURIComponent(list.join("\r"))}`;
    const reqOpts = {
      url: endpoint,
      headers: { Accept: "*/*", "User-Agent": this.getRandomUA() }
    };

    try {
      const res = await fetchRequest(reqOpts);
      const data = JSON.parse(res.body);
      let translatedText = "";

      if (Array.isArray(data) && Array.isArray(data[0])) {
        translatedText = data[0].map(item => item[0]).join("");
      }
      return translatedText.split(/\r/);
    } catch (err) {
      return Promise.reject(err);
    }
  }
}

// Export global engine instance if necessary
if (typeof module !== "undefined") {
  module.exports = { Translate, Logger, CryptoUtils, fetchRequest };
}

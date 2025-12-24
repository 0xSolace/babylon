import {
  __commonJS,
  __toESM
} from "./client-4jeyk0v8.js";

// ../../../../node_modules/.bun/ms@2.1.3/node_modules/ms/index.js
var require_ms = __commonJS((exports, module) => {
  var s = 1000;
  var m = s * 60;
  var h = m * 60;
  var d = h * 24;
  var w = d * 7;
  var y = d * 365.25;
  module.exports = function(val, options) {
    options = options || {};
    var type = typeof val;
    if (type === "string" && val.length > 0) {
      return parse(val);
    } else if (type === "number" && isFinite(val)) {
      return options.long ? fmtLong(val) : fmtShort(val);
    }
    throw new Error("val is not a non-empty string or a valid number. val=" + JSON.stringify(val));
  };
  function parse(str) {
    str = String(str);
    if (str.length > 100) {
      return;
    }
    var match = /^(-?(?:\d+)?\.?\d+) *(milliseconds?|msecs?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|w|years?|yrs?|y)?$/i.exec(str);
    if (!match) {
      return;
    }
    var n = parseFloat(match[1]);
    var type = (match[2] || "ms").toLowerCase();
    switch (type) {
      case "years":
      case "year":
      case "yrs":
      case "yr":
      case "y":
        return n * y;
      case "weeks":
      case "week":
      case "w":
        return n * w;
      case "days":
      case "day":
      case "d":
        return n * d;
      case "hours":
      case "hour":
      case "hrs":
      case "hr":
      case "h":
        return n * h;
      case "minutes":
      case "minute":
      case "mins":
      case "min":
      case "m":
        return n * m;
      case "seconds":
      case "second":
      case "secs":
      case "sec":
      case "s":
        return n * s;
      case "milliseconds":
      case "millisecond":
      case "msecs":
      case "msec":
      case "ms":
        return n;
      default:
        return;
    }
  }
  function fmtShort(ms) {
    var msAbs = Math.abs(ms);
    if (msAbs >= d) {
      return Math.round(ms / d) + "d";
    }
    if (msAbs >= h) {
      return Math.round(ms / h) + "h";
    }
    if (msAbs >= m) {
      return Math.round(ms / m) + "m";
    }
    if (msAbs >= s) {
      return Math.round(ms / s) + "s";
    }
    return ms + "ms";
  }
  function fmtLong(ms) {
    var msAbs = Math.abs(ms);
    if (msAbs >= d) {
      return plural(ms, msAbs, d, "day");
    }
    if (msAbs >= h) {
      return plural(ms, msAbs, h, "hour");
    }
    if (msAbs >= m) {
      return plural(ms, msAbs, m, "minute");
    }
    if (msAbs >= s) {
      return plural(ms, msAbs, s, "second");
    }
    return ms + " ms";
  }
  function plural(ms, msAbs, n, name) {
    var isPlural = msAbs >= n * 1.5;
    return Math.round(ms / n) + " " + name + (isPlural ? "s" : "");
  }
});

// ../../../../node_modules/.bun/debug@4.4.3/node_modules/debug/src/common.js
var require_common = __commonJS((exports, module) => {
  function setup(env) {
    createDebug.debug = createDebug;
    createDebug.default = createDebug;
    createDebug.coerce = coerce;
    createDebug.disable = disable;
    createDebug.enable = enable;
    createDebug.enabled = enabled;
    createDebug.humanize = require_ms();
    createDebug.destroy = destroy;
    Object.keys(env).forEach((key) => {
      createDebug[key] = env[key];
    });
    createDebug.names = [];
    createDebug.skips = [];
    createDebug.formatters = {};
    function selectColor(namespace) {
      let hash = 0;
      for (let i = 0;i < namespace.length; i++) {
        hash = (hash << 5) - hash + namespace.charCodeAt(i);
        hash |= 0;
      }
      return createDebug.colors[Math.abs(hash) % createDebug.colors.length];
    }
    createDebug.selectColor = selectColor;
    function createDebug(namespace) {
      let prevTime;
      let enableOverride = null;
      let namespacesCache;
      let enabledCache;
      function debug(...args) {
        if (!debug.enabled) {
          return;
        }
        const self = debug;
        const curr = Number(new Date);
        const ms = curr - (prevTime || curr);
        self.diff = ms;
        self.prev = prevTime;
        self.curr = curr;
        prevTime = curr;
        args[0] = createDebug.coerce(args[0]);
        if (typeof args[0] !== "string") {
          args.unshift("%O");
        }
        let index = 0;
        args[0] = args[0].replace(/%([a-zA-Z%])/g, (match, format) => {
          if (match === "%%") {
            return "%";
          }
          index++;
          const formatter = createDebug.formatters[format];
          if (typeof formatter === "function") {
            const val = args[index];
            match = formatter.call(self, val);
            args.splice(index, 1);
            index--;
          }
          return match;
        });
        createDebug.formatArgs.call(self, args);
        const logFn = self.log || createDebug.log;
        logFn.apply(self, args);
      }
      debug.namespace = namespace;
      debug.useColors = createDebug.useColors();
      debug.color = createDebug.selectColor(namespace);
      debug.extend = extend;
      debug.destroy = createDebug.destroy;
      Object.defineProperty(debug, "enabled", {
        enumerable: true,
        configurable: false,
        get: () => {
          if (enableOverride !== null) {
            return enableOverride;
          }
          if (namespacesCache !== createDebug.namespaces) {
            namespacesCache = createDebug.namespaces;
            enabledCache = createDebug.enabled(namespace);
          }
          return enabledCache;
        },
        set: (v) => {
          enableOverride = v;
        }
      });
      if (typeof createDebug.init === "function") {
        createDebug.init(debug);
      }
      return debug;
    }
    function extend(namespace, delimiter) {
      const newDebug = createDebug(this.namespace + (typeof delimiter === "undefined" ? ":" : delimiter) + namespace);
      newDebug.log = this.log;
      return newDebug;
    }
    function enable(namespaces) {
      createDebug.save(namespaces);
      createDebug.namespaces = namespaces;
      createDebug.names = [];
      createDebug.skips = [];
      const split = (typeof namespaces === "string" ? namespaces : "").trim().replace(/\s+/g, ",").split(",").filter(Boolean);
      for (const ns of split) {
        if (ns[0] === "-") {
          createDebug.skips.push(ns.slice(1));
        } else {
          createDebug.names.push(ns);
        }
      }
    }
    function matchesTemplate(search, template) {
      let searchIndex = 0;
      let templateIndex = 0;
      let starIndex = -1;
      let matchIndex = 0;
      while (searchIndex < search.length) {
        if (templateIndex < template.length && (template[templateIndex] === search[searchIndex] || template[templateIndex] === "*")) {
          if (template[templateIndex] === "*") {
            starIndex = templateIndex;
            matchIndex = searchIndex;
            templateIndex++;
          } else {
            searchIndex++;
            templateIndex++;
          }
        } else if (starIndex !== -1) {
          templateIndex = starIndex + 1;
          matchIndex++;
          searchIndex = matchIndex;
        } else {
          return false;
        }
      }
      while (templateIndex < template.length && template[templateIndex] === "*") {
        templateIndex++;
      }
      return templateIndex === template.length;
    }
    function disable() {
      const namespaces = [
        ...createDebug.names,
        ...createDebug.skips.map((namespace) => "-" + namespace)
      ].join(",");
      createDebug.enable("");
      return namespaces;
    }
    function enabled(name) {
      for (const skip of createDebug.skips) {
        if (matchesTemplate(name, skip)) {
          return false;
        }
      }
      for (const ns of createDebug.names) {
        if (matchesTemplate(name, ns)) {
          return true;
        }
      }
      return false;
    }
    function coerce(val) {
      if (val instanceof Error) {
        return val.stack || val.message;
      }
      return val;
    }
    function destroy() {
      console.warn("Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.");
    }
    createDebug.enable(createDebug.load());
    return createDebug;
  }
  module.exports = setup;
});

// ../../../../node_modules/.bun/debug@4.4.3/node_modules/debug/src/browser.js
var require_browser = __commonJS((exports, module) => {
  exports.formatArgs = formatArgs;
  exports.save = save;
  exports.load = load;
  exports.useColors = useColors;
  exports.storage = localstorage();
  exports.destroy = (() => {
    let warned = false;
    return () => {
      if (!warned) {
        warned = true;
        console.warn("Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.");
      }
    };
  })();
  exports.colors = [
    "#0000CC",
    "#0000FF",
    "#0033CC",
    "#0033FF",
    "#0066CC",
    "#0066FF",
    "#0099CC",
    "#0099FF",
    "#00CC00",
    "#00CC33",
    "#00CC66",
    "#00CC99",
    "#00CCCC",
    "#00CCFF",
    "#3300CC",
    "#3300FF",
    "#3333CC",
    "#3333FF",
    "#3366CC",
    "#3366FF",
    "#3399CC",
    "#3399FF",
    "#33CC00",
    "#33CC33",
    "#33CC66",
    "#33CC99",
    "#33CCCC",
    "#33CCFF",
    "#6600CC",
    "#6600FF",
    "#6633CC",
    "#6633FF",
    "#66CC00",
    "#66CC33",
    "#9900CC",
    "#9900FF",
    "#9933CC",
    "#9933FF",
    "#99CC00",
    "#99CC33",
    "#CC0000",
    "#CC0033",
    "#CC0066",
    "#CC0099",
    "#CC00CC",
    "#CC00FF",
    "#CC3300",
    "#CC3333",
    "#CC3366",
    "#CC3399",
    "#CC33CC",
    "#CC33FF",
    "#CC6600",
    "#CC6633",
    "#CC9900",
    "#CC9933",
    "#CCCC00",
    "#CCCC33",
    "#FF0000",
    "#FF0033",
    "#FF0066",
    "#FF0099",
    "#FF00CC",
    "#FF00FF",
    "#FF3300",
    "#FF3333",
    "#FF3366",
    "#FF3399",
    "#FF33CC",
    "#FF33FF",
    "#FF6600",
    "#FF6633",
    "#FF9900",
    "#FF9933",
    "#FFCC00",
    "#FFCC33"
  ];
  function useColors() {
    if (typeof window !== "undefined" && window.process && (window.process.type === "renderer" || window.process.__nwjs)) {
      return true;
    }
    if (typeof navigator !== "undefined" && navigator.userAgent && navigator.userAgent.toLowerCase().match(/(edge|trident)\/(\d+)/)) {
      return false;
    }
    let m;
    return typeof document !== "undefined" && document.documentElement && document.documentElement.style && document.documentElement.style.WebkitAppearance || typeof window !== "undefined" && window.console && (window.console.firebug || window.console.exception && window.console.table) || typeof navigator !== "undefined" && navigator.userAgent && (m = navigator.userAgent.toLowerCase().match(/firefox\/(\d+)/)) && parseInt(m[1], 10) >= 31 || typeof navigator !== "undefined" && navigator.userAgent && navigator.userAgent.toLowerCase().match(/applewebkit\/(\d+)/);
  }
  function formatArgs(args) {
    args[0] = (this.useColors ? "%c" : "") + this.namespace + (this.useColors ? " %c" : " ") + args[0] + (this.useColors ? "%c " : " ") + "+" + module.exports.humanize(this.diff);
    if (!this.useColors) {
      return;
    }
    const c = "color: " + this.color;
    args.splice(1, 0, c, "color: inherit");
    let index = 0;
    let lastC = 0;
    args[0].replace(/%[a-zA-Z%]/g, (match) => {
      if (match === "%%") {
        return;
      }
      index++;
      if (match === "%c") {
        lastC = index;
      }
    });
    args.splice(lastC, 0, c);
  }
  exports.log = console.debug || console.log || (() => {});
  function save(namespaces) {
    try {
      if (namespaces) {
        exports.storage.setItem("debug", namespaces);
      } else {
        exports.storage.removeItem("debug");
      }
    } catch (error) {}
  }
  function load() {
    let r;
    try {
      r = exports.storage.getItem("debug") || exports.storage.getItem("DEBUG");
    } catch (error) {}
    if (!r && typeof process !== "undefined" && "env" in process) {
      r = process.env.DEBUG;
    }
    return r;
  }
  function localstorage() {
    try {
      return localStorage;
    } catch (error) {}
  }
  module.exports = require_common()(exports);
  var { formatters } = module.exports;
  formatters.j = function(v) {
    try {
      return JSON.stringify(v);
    } catch (error) {
      return "[UnexpectedJSONParseError]: " + error.message;
    }
  };
});

// ../../../../node_modules/.bun/ieee754@1.2.1/node_modules/ieee754/index.js
/*! ieee754. BSD-3-Clause License. Feross Aboukhadijeh <https://feross.org/opensource> */

// ../../../../node_modules/.bun/@borewit+text-codec@0.1.1/node_modules/@borewit/text-codec/lib/index.js
var WINDOWS_1252_EXTRA = {
  128: "€",
  130: "‚",
  131: "ƒ",
  132: "„",
  133: "…",
  134: "†",
  135: "‡",
  136: "ˆ",
  137: "‰",
  138: "Š",
  139: "‹",
  140: "Œ",
  142: "Ž",
  145: "‘",
  146: "’",
  147: "“",
  148: "”",
  149: "•",
  150: "–",
  151: "—",
  152: "˜",
  153: "™",
  154: "š",
  155: "›",
  156: "œ",
  158: "ž",
  159: "Ÿ"
};
var WINDOWS_1252_REVERSE = {};
for (const [code, char] of Object.entries(WINDOWS_1252_EXTRA)) {
  WINDOWS_1252_REVERSE[char] = Number.parseInt(code);
}
function textDecode(bytes, encoding = "utf-8") {
  switch (encoding.toLowerCase()) {
    case "utf-8":
    case "utf8":
      if (typeof globalThis.TextDecoder !== "undefined") {
        return new globalThis.TextDecoder("utf-8").decode(bytes);
      }
      return decodeUTF8(bytes);
    case "utf-16le":
      return decodeUTF16LE(bytes);
    case "ascii":
      return decodeASCII(bytes);
    case "latin1":
    case "iso-8859-1":
      return decodeLatin1(bytes);
    case "windows-1252":
      return decodeWindows1252(bytes);
    default:
      throw new RangeError(`Encoding '${encoding}' not supported`);
  }
}
function decodeUTF8(bytes) {
  let out = "";
  let i = 0;
  while (i < bytes.length) {
    const b1 = bytes[i++];
    if (b1 < 128) {
      out += String.fromCharCode(b1);
    } else if (b1 < 224) {
      const b2 = bytes[i++] & 63;
      out += String.fromCharCode((b1 & 31) << 6 | b2);
    } else if (b1 < 240) {
      const b2 = bytes[i++] & 63;
      const b3 = bytes[i++] & 63;
      out += String.fromCharCode((b1 & 15) << 12 | b2 << 6 | b3);
    } else {
      const b2 = bytes[i++] & 63;
      const b3 = bytes[i++] & 63;
      const b4 = bytes[i++] & 63;
      let cp = (b1 & 7) << 18 | b2 << 12 | b3 << 6 | b4;
      cp -= 65536;
      out += String.fromCharCode(55296 + (cp >> 10 & 1023), 56320 + (cp & 1023));
    }
  }
  return out;
}
function decodeUTF16LE(bytes) {
  let out = "";
  for (let i = 0;i < bytes.length; i += 2) {
    out += String.fromCharCode(bytes[i] | bytes[i + 1] << 8);
  }
  return out;
}
function decodeASCII(bytes) {
  return String.fromCharCode(...bytes.map((b) => b & 127));
}
function decodeLatin1(bytes) {
  return String.fromCharCode(...bytes);
}
function decodeWindows1252(bytes) {
  let out = "";
  for (const b of bytes) {
    if (b >= 128 && b <= 159 && WINDOWS_1252_EXTRA[b]) {
      out += WINDOWS_1252_EXTRA[b];
    } else {
      out += String.fromCharCode(b);
    }
  }
  return out;
}

// ../../../../node_modules/.bun/token-types@6.1.1/node_modules/token-types/lib/index.js
function dv(array) {
  return new DataView(array.buffer, array.byteOffset);
}
var UINT8 = {
  len: 1,
  get(array, offset) {
    return dv(array).getUint8(offset);
  },
  put(array, offset, value) {
    dv(array).setUint8(offset, value);
    return offset + 1;
  }
};
var UINT16_LE = {
  len: 2,
  get(array, offset) {
    return dv(array).getUint16(offset, true);
  },
  put(array, offset, value) {
    dv(array).setUint16(offset, value, true);
    return offset + 2;
  }
};
var UINT16_BE = {
  len: 2,
  get(array, offset) {
    return dv(array).getUint16(offset);
  },
  put(array, offset, value) {
    dv(array).setUint16(offset, value);
    return offset + 2;
  }
};
var UINT32_LE = {
  len: 4,
  get(array, offset) {
    return dv(array).getUint32(offset, true);
  },
  put(array, offset, value) {
    dv(array).setUint32(offset, value, true);
    return offset + 4;
  }
};
var UINT32_BE = {
  len: 4,
  get(array, offset) {
    return dv(array).getUint32(offset);
  },
  put(array, offset, value) {
    dv(array).setUint32(offset, value);
    return offset + 4;
  }
};
var INT32_BE = {
  len: 4,
  get(array, offset) {
    return dv(array).getInt32(offset);
  },
  put(array, offset, value) {
    dv(array).setInt32(offset, value);
    return offset + 4;
  }
};
var UINT64_LE = {
  len: 8,
  get(array, offset) {
    return dv(array).getBigUint64(offset, true);
  },
  put(array, offset, value) {
    dv(array).setBigUint64(offset, value, true);
    return offset + 8;
  }
};
class StringType {
  constructor(len, encoding) {
    this.len = len;
    this.encoding = encoding;
  }
  get(data, offset = 0) {
    const bytes = data.subarray(offset, offset + this.len);
    return textDecode(bytes, this.encoding);
  }
}

// ../../../../node_modules/.bun/strtok3@10.3.4/node_modules/strtok3/lib/stream/Errors.js
var defaultMessages = "End-Of-Stream";

class EndOfStreamError extends Error {
  constructor() {
    super(defaultMessages);
    this.name = "EndOfStreamError";
  }
}

class AbortError extends Error {
  constructor(message = "The operation was aborted") {
    super(message);
    this.name = "AbortError";
  }
}
// ../../../../node_modules/.bun/strtok3@10.3.4/node_modules/strtok3/lib/stream/AbstractStreamReader.js
class AbstractStreamReader {
  constructor() {
    this.endOfStream = false;
    this.interrupted = false;
    this.peekQueue = [];
  }
  async peek(uint8Array, mayBeLess = false) {
    const bytesRead = await this.read(uint8Array, mayBeLess);
    this.peekQueue.push(uint8Array.subarray(0, bytesRead));
    return bytesRead;
  }
  async read(buffer, mayBeLess = false) {
    if (buffer.length === 0) {
      return 0;
    }
    let bytesRead = this.readFromPeekBuffer(buffer);
    if (!this.endOfStream) {
      bytesRead += await this.readRemainderFromStream(buffer.subarray(bytesRead), mayBeLess);
    }
    if (bytesRead === 0 && !mayBeLess) {
      throw new EndOfStreamError;
    }
    return bytesRead;
  }
  readFromPeekBuffer(buffer) {
    let remaining = buffer.length;
    let bytesRead = 0;
    while (this.peekQueue.length > 0 && remaining > 0) {
      const peekData = this.peekQueue.pop();
      if (!peekData)
        throw new Error("peekData should be defined");
      const lenCopy = Math.min(peekData.length, remaining);
      buffer.set(peekData.subarray(0, lenCopy), bytesRead);
      bytesRead += lenCopy;
      remaining -= lenCopy;
      if (lenCopy < peekData.length) {
        this.peekQueue.push(peekData.subarray(lenCopy));
      }
    }
    return bytesRead;
  }
  async readRemainderFromStream(buffer, mayBeLess) {
    let bytesRead = 0;
    while (bytesRead < buffer.length && !this.endOfStream) {
      if (this.interrupted) {
        throw new AbortError;
      }
      const chunkLen = await this.readFromStream(buffer.subarray(bytesRead), mayBeLess);
      if (chunkLen === 0)
        break;
      bytesRead += chunkLen;
    }
    if (!mayBeLess && bytesRead < buffer.length) {
      throw new EndOfStreamError;
    }
    return bytesRead;
  }
}
// ../../../../node_modules/.bun/strtok3@10.3.4/node_modules/strtok3/lib/stream/WebStreamReader.js
class WebStreamReader extends AbstractStreamReader {
  constructor(reader) {
    super();
    this.reader = reader;
  }
  async abort() {
    return this.close();
  }
  async close() {
    this.reader.releaseLock();
  }
}

// ../../../../node_modules/.bun/strtok3@10.3.4/node_modules/strtok3/lib/stream/WebStreamByobReader.js
class WebStreamByobReader extends WebStreamReader {
  async readFromStream(buffer, mayBeLess) {
    if (buffer.length === 0)
      return 0;
    const result = await this.reader.read(new Uint8Array(buffer.length), { min: mayBeLess ? undefined : buffer.length });
    if (result.done) {
      this.endOfStream = result.done;
    }
    if (result.value) {
      buffer.set(result.value);
      return result.value.length;
    }
    return 0;
  }
}
// ../../../../node_modules/.bun/strtok3@10.3.4/node_modules/strtok3/lib/stream/WebStreamDefaultReader.js
class WebStreamDefaultReader extends AbstractStreamReader {
  constructor(reader) {
    super();
    this.reader = reader;
    this.buffer = null;
  }
  writeChunk(target, chunk) {
    const written = Math.min(chunk.length, target.length);
    target.set(chunk.subarray(0, written));
    if (written < chunk.length) {
      this.buffer = chunk.subarray(written);
    } else {
      this.buffer = null;
    }
    return written;
  }
  async readFromStream(buffer, mayBeLess) {
    if (buffer.length === 0)
      return 0;
    let totalBytesRead = 0;
    if (this.buffer) {
      totalBytesRead += this.writeChunk(buffer, this.buffer);
    }
    while (totalBytesRead < buffer.length && !this.endOfStream) {
      const result = await this.reader.read();
      if (result.done) {
        this.endOfStream = true;
        break;
      }
      if (result.value) {
        totalBytesRead += this.writeChunk(buffer.subarray(totalBytesRead), result.value);
      }
    }
    if (!mayBeLess && totalBytesRead === 0 && this.endOfStream) {
      throw new EndOfStreamError;
    }
    return totalBytesRead;
  }
  abort() {
    this.interrupted = true;
    return this.reader.cancel();
  }
  async close() {
    await this.abort();
    this.reader.releaseLock();
  }
}
// ../../../../node_modules/.bun/strtok3@10.3.4/node_modules/strtok3/lib/stream/WebStreamReaderFactory.js
function makeWebStreamReader(stream) {
  try {
    const reader = stream.getReader({ mode: "byob" });
    if (reader instanceof ReadableStreamDefaultReader) {
      return new WebStreamDefaultReader(reader);
    }
    return new WebStreamByobReader(reader);
  } catch (error) {
    if (error instanceof TypeError) {
      return new WebStreamDefaultReader(stream.getReader());
    }
    throw error;
  }
}
// ../../../../node_modules/.bun/strtok3@10.3.4/node_modules/strtok3/lib/AbstractTokenizer.js
class AbstractTokenizer {
  constructor(options) {
    this.numBuffer = new Uint8Array(8);
    this.position = 0;
    this.onClose = options?.onClose;
    if (options?.abortSignal) {
      options.abortSignal.addEventListener("abort", () => {
        this.abort();
      });
    }
  }
  async readToken(token, position = this.position) {
    const uint8Array = new Uint8Array(token.len);
    const len = await this.readBuffer(uint8Array, { position });
    if (len < token.len)
      throw new EndOfStreamError;
    return token.get(uint8Array, 0);
  }
  async peekToken(token, position = this.position) {
    const uint8Array = new Uint8Array(token.len);
    const len = await this.peekBuffer(uint8Array, { position });
    if (len < token.len)
      throw new EndOfStreamError;
    return token.get(uint8Array, 0);
  }
  async readNumber(token) {
    const len = await this.readBuffer(this.numBuffer, { length: token.len });
    if (len < token.len)
      throw new EndOfStreamError;
    return token.get(this.numBuffer, 0);
  }
  async peekNumber(token) {
    const len = await this.peekBuffer(this.numBuffer, { length: token.len });
    if (len < token.len)
      throw new EndOfStreamError;
    return token.get(this.numBuffer, 0);
  }
  async ignore(length) {
    if (this.fileInfo.size !== undefined) {
      const bytesLeft = this.fileInfo.size - this.position;
      if (length > bytesLeft) {
        this.position += bytesLeft;
        return bytesLeft;
      }
    }
    this.position += length;
    return length;
  }
  async close() {
    await this.abort();
    await this.onClose?.();
  }
  normalizeOptions(uint8Array, options) {
    if (!this.supportsRandomAccess() && options && options.position !== undefined && options.position < this.position) {
      throw new Error("`options.position` must be equal or greater than `tokenizer.position`");
    }
    return {
      ...{
        mayBeLess: false,
        offset: 0,
        length: uint8Array.length,
        position: this.position
      },
      ...options
    };
  }
  abort() {
    return Promise.resolve();
  }
}

// ../../../../node_modules/.bun/strtok3@10.3.4/node_modules/strtok3/lib/ReadStreamTokenizer.js
var maxBufferSize = 256000;

class ReadStreamTokenizer extends AbstractTokenizer {
  constructor(streamReader, options) {
    super(options);
    this.streamReader = streamReader;
    this.fileInfo = options?.fileInfo ?? {};
  }
  async readBuffer(uint8Array, options) {
    const normOptions = this.normalizeOptions(uint8Array, options);
    const skipBytes = normOptions.position - this.position;
    if (skipBytes > 0) {
      await this.ignore(skipBytes);
      return this.readBuffer(uint8Array, options);
    }
    if (skipBytes < 0) {
      throw new Error("`options.position` must be equal or greater than `tokenizer.position`");
    }
    if (normOptions.length === 0) {
      return 0;
    }
    const bytesRead = await this.streamReader.read(uint8Array.subarray(0, normOptions.length), normOptions.mayBeLess);
    this.position += bytesRead;
    if ((!options || !options.mayBeLess) && bytesRead < normOptions.length) {
      throw new EndOfStreamError;
    }
    return bytesRead;
  }
  async peekBuffer(uint8Array, options) {
    const normOptions = this.normalizeOptions(uint8Array, options);
    let bytesRead = 0;
    if (normOptions.position) {
      const skipBytes = normOptions.position - this.position;
      if (skipBytes > 0) {
        const skipBuffer = new Uint8Array(normOptions.length + skipBytes);
        bytesRead = await this.peekBuffer(skipBuffer, { mayBeLess: normOptions.mayBeLess });
        uint8Array.set(skipBuffer.subarray(skipBytes));
        return bytesRead - skipBytes;
      }
      if (skipBytes < 0) {
        throw new Error("Cannot peek from a negative offset in a stream");
      }
    }
    if (normOptions.length > 0) {
      try {
        bytesRead = await this.streamReader.peek(uint8Array.subarray(0, normOptions.length), normOptions.mayBeLess);
      } catch (err) {
        if (options?.mayBeLess && err instanceof EndOfStreamError) {
          return 0;
        }
        throw err;
      }
      if (!normOptions.mayBeLess && bytesRead < normOptions.length) {
        throw new EndOfStreamError;
      }
    }
    return bytesRead;
  }
  async ignore(length) {
    const bufSize = Math.min(maxBufferSize, length);
    const buf = new Uint8Array(bufSize);
    let totBytesRead = 0;
    while (totBytesRead < length) {
      const remaining = length - totBytesRead;
      const bytesRead = await this.readBuffer(buf, { length: Math.min(bufSize, remaining) });
      if (bytesRead < 0) {
        return bytesRead;
      }
      totBytesRead += bytesRead;
    }
    return totBytesRead;
  }
  abort() {
    return this.streamReader.abort();
  }
  async close() {
    return this.streamReader.close();
  }
  supportsRandomAccess() {
    return false;
  }
}

// ../../../../node_modules/.bun/strtok3@10.3.4/node_modules/strtok3/lib/BufferTokenizer.js
class BufferTokenizer extends AbstractTokenizer {
  constructor(uint8Array, options) {
    super(options);
    this.uint8Array = uint8Array;
    this.fileInfo = { ...options?.fileInfo ?? {}, ...{ size: uint8Array.length } };
  }
  async readBuffer(uint8Array, options) {
    if (options?.position) {
      this.position = options.position;
    }
    const bytesRead = await this.peekBuffer(uint8Array, options);
    this.position += bytesRead;
    return bytesRead;
  }
  async peekBuffer(uint8Array, options) {
    const normOptions = this.normalizeOptions(uint8Array, options);
    const bytes2read = Math.min(this.uint8Array.length - normOptions.position, normOptions.length);
    if (!normOptions.mayBeLess && bytes2read < normOptions.length) {
      throw new EndOfStreamError;
    }
    uint8Array.set(this.uint8Array.subarray(normOptions.position, normOptions.position + bytes2read));
    return bytes2read;
  }
  close() {
    return super.close();
  }
  supportsRandomAccess() {
    return true;
  }
  setPosition(position) {
    this.position = position;
  }
}

// ../../../../node_modules/.bun/strtok3@10.3.4/node_modules/strtok3/lib/BlobTokenizer.js
class BlobTokenizer extends AbstractTokenizer {
  constructor(blob, options) {
    super(options);
    this.blob = blob;
    this.fileInfo = { ...options?.fileInfo ?? {}, ...{ size: blob.size, mimeType: blob.type } };
  }
  async readBuffer(uint8Array, options) {
    if (options?.position) {
      this.position = options.position;
    }
    const bytesRead = await this.peekBuffer(uint8Array, options);
    this.position += bytesRead;
    return bytesRead;
  }
  async peekBuffer(buffer, options) {
    const normOptions = this.normalizeOptions(buffer, options);
    const bytes2read = Math.min(this.blob.size - normOptions.position, normOptions.length);
    if (!normOptions.mayBeLess && bytes2read < normOptions.length) {
      throw new EndOfStreamError;
    }
    const arrayBuffer = await this.blob.slice(normOptions.position, normOptions.position + bytes2read).arrayBuffer();
    buffer.set(new Uint8Array(arrayBuffer));
    return bytes2read;
  }
  close() {
    return super.close();
  }
  supportsRandomAccess() {
    return true;
  }
  setPosition(position) {
    this.position = position;
  }
}
// ../../../../node_modules/.bun/strtok3@10.3.4/node_modules/strtok3/lib/core.js
function fromWebStream(webStream, options) {
  const webStreamReader = makeWebStreamReader(webStream);
  const _options = options ?? {};
  const chainedClose = _options.onClose;
  _options.onClose = async () => {
    await webStreamReader.close();
    if (chainedClose) {
      return chainedClose();
    }
  };
  return new ReadStreamTokenizer(webStreamReader, _options);
}
function fromBuffer(uint8Array, options) {
  return new BufferTokenizer(uint8Array, options);
}
function fromBlob(blob, options) {
  return new BlobTokenizer(blob, options);
}

// ../../../../node_modules/.bun/@tokenizer+inflate@0.4.1/node_modules/@tokenizer/inflate/lib/ZipHandler.js
var import_debug = __toESM(require_browser(), 1);

// ../../../../node_modules/.bun/@tokenizer+inflate@0.4.1/node_modules/@tokenizer/inflate/lib/ZipToken.js
var Signature = {
  LocalFileHeader: 67324752,
  DataDescriptor: 134695760,
  CentralFileHeader: 33639248,
  EndOfCentralDirectory: 101010256
};
var DataDescriptor = {
  get(array) {
    return {
      signature: UINT32_LE.get(array, 0),
      compressedSize: UINT32_LE.get(array, 8),
      uncompressedSize: UINT32_LE.get(array, 12)
    };
  },
  len: 16
};
var LocalFileHeaderToken = {
  get(array) {
    const flags = UINT16_LE.get(array, 6);
    return {
      signature: UINT32_LE.get(array, 0),
      minVersion: UINT16_LE.get(array, 4),
      dataDescriptor: !!(flags & 8),
      compressedMethod: UINT16_LE.get(array, 8),
      compressedSize: UINT32_LE.get(array, 18),
      uncompressedSize: UINT32_LE.get(array, 22),
      filenameLength: UINT16_LE.get(array, 26),
      extraFieldLength: UINT16_LE.get(array, 28),
      filename: null
    };
  },
  len: 30
};
var EndOfCentralDirectoryRecordToken = {
  get(array) {
    return {
      signature: UINT32_LE.get(array, 0),
      nrOfThisDisk: UINT16_LE.get(array, 4),
      nrOfThisDiskWithTheStart: UINT16_LE.get(array, 6),
      nrOfEntriesOnThisDisk: UINT16_LE.get(array, 8),
      nrOfEntriesOfSize: UINT16_LE.get(array, 10),
      sizeOfCd: UINT32_LE.get(array, 12),
      offsetOfStartOfCd: UINT32_LE.get(array, 16),
      zipFileCommentLength: UINT16_LE.get(array, 20)
    };
  },
  len: 22
};
var FileHeader = {
  get(array) {
    const flags = UINT16_LE.get(array, 8);
    return {
      signature: UINT32_LE.get(array, 0),
      minVersion: UINT16_LE.get(array, 6),
      dataDescriptor: !!(flags & 8),
      compressedMethod: UINT16_LE.get(array, 10),
      compressedSize: UINT32_LE.get(array, 20),
      uncompressedSize: UINT32_LE.get(array, 24),
      filenameLength: UINT16_LE.get(array, 28),
      extraFieldLength: UINT16_LE.get(array, 30),
      fileCommentLength: UINT16_LE.get(array, 32),
      relativeOffsetOfLocalHeader: UINT32_LE.get(array, 42),
      filename: null
    };
  },
  len: 46
};

// ../../../../node_modules/.bun/@tokenizer+inflate@0.4.1/node_modules/@tokenizer/inflate/lib/ZipHandler.js
function signatureToArray(signature) {
  const signatureBytes = new Uint8Array(UINT32_LE.len);
  UINT32_LE.put(signatureBytes, 0, signature);
  return signatureBytes;
}
var debug = import_debug.default("tokenizer:inflate");
var syncBufferSize = 256 * 1024;
var ddSignatureArray = signatureToArray(Signature.DataDescriptor);
var eocdSignatureBytes = signatureToArray(Signature.EndOfCentralDirectory);

class ZipHandler {
  constructor(tokenizer) {
    this.tokenizer = tokenizer;
    this.syncBuffer = new Uint8Array(syncBufferSize);
  }
  async isZip() {
    return await this.peekSignature() === Signature.LocalFileHeader;
  }
  peekSignature() {
    return this.tokenizer.peekToken(UINT32_LE);
  }
  async findEndOfCentralDirectoryLocator() {
    const randomReadTokenizer = this.tokenizer;
    const chunkLength = Math.min(16 * 1024, randomReadTokenizer.fileInfo.size);
    const buffer = this.syncBuffer.subarray(0, chunkLength);
    await this.tokenizer.readBuffer(buffer, { position: randomReadTokenizer.fileInfo.size - chunkLength });
    for (let i = buffer.length - 4;i >= 0; i--) {
      if (buffer[i] === eocdSignatureBytes[0] && buffer[i + 1] === eocdSignatureBytes[1] && buffer[i + 2] === eocdSignatureBytes[2] && buffer[i + 3] === eocdSignatureBytes[3]) {
        return randomReadTokenizer.fileInfo.size - chunkLength + i;
      }
    }
    return -1;
  }
  async readCentralDirectory() {
    if (!this.tokenizer.supportsRandomAccess()) {
      debug("Cannot reading central-directory without random-read support");
      return;
    }
    debug("Reading central-directory...");
    const pos = this.tokenizer.position;
    const offset = await this.findEndOfCentralDirectoryLocator();
    if (offset > 0) {
      debug("Central-directory 32-bit signature found");
      const eocdHeader = await this.tokenizer.readToken(EndOfCentralDirectoryRecordToken, offset);
      const files = [];
      this.tokenizer.setPosition(eocdHeader.offsetOfStartOfCd);
      for (let n = 0;n < eocdHeader.nrOfEntriesOfSize; ++n) {
        const entry = await this.tokenizer.readToken(FileHeader);
        if (entry.signature !== Signature.CentralFileHeader) {
          throw new Error("Expected Central-File-Header signature");
        }
        entry.filename = await this.tokenizer.readToken(new StringType(entry.filenameLength, "utf-8"));
        await this.tokenizer.ignore(entry.extraFieldLength);
        await this.tokenizer.ignore(entry.fileCommentLength);
        files.push(entry);
        debug(`Add central-directory file-entry: n=${n + 1}/${files.length}: filename=${files[n].filename}`);
      }
      this.tokenizer.setPosition(pos);
      return files;
    }
    this.tokenizer.setPosition(pos);
  }
  async unzip(fileCb) {
    const entries = await this.readCentralDirectory();
    if (entries) {
      return this.iterateOverCentralDirectory(entries, fileCb);
    }
    let stop = false;
    do {
      const zipHeader = await this.readLocalFileHeader();
      if (!zipHeader)
        break;
      const next = fileCb(zipHeader);
      stop = !!next.stop;
      let fileData;
      await this.tokenizer.ignore(zipHeader.extraFieldLength);
      if (zipHeader.dataDescriptor && zipHeader.compressedSize === 0) {
        const chunks = [];
        let len = syncBufferSize;
        debug("Compressed-file-size unknown, scanning for next data-descriptor-signature....");
        let nextHeaderIndex = -1;
        while (nextHeaderIndex < 0 && len === syncBufferSize) {
          len = await this.tokenizer.peekBuffer(this.syncBuffer, { mayBeLess: true });
          nextHeaderIndex = indexOf(this.syncBuffer.subarray(0, len), ddSignatureArray);
          const size = nextHeaderIndex >= 0 ? nextHeaderIndex : len;
          if (next.handler) {
            const data = new Uint8Array(size);
            await this.tokenizer.readBuffer(data);
            chunks.push(data);
          } else {
            await this.tokenizer.ignore(size);
          }
        }
        debug(`Found data-descriptor-signature at pos=${this.tokenizer.position}`);
        if (next.handler) {
          await this.inflate(zipHeader, mergeArrays(chunks), next.handler);
        }
      } else {
        if (next.handler) {
          debug(`Reading compressed-file-data: ${zipHeader.compressedSize} bytes`);
          fileData = new Uint8Array(zipHeader.compressedSize);
          await this.tokenizer.readBuffer(fileData);
          await this.inflate(zipHeader, fileData, next.handler);
        } else {
          debug(`Ignoring compressed-file-data: ${zipHeader.compressedSize} bytes`);
          await this.tokenizer.ignore(zipHeader.compressedSize);
        }
      }
      debug(`Reading data-descriptor at pos=${this.tokenizer.position}`);
      if (zipHeader.dataDescriptor) {
        const dataDescriptor = await this.tokenizer.readToken(DataDescriptor);
        if (dataDescriptor.signature !== 134695760) {
          throw new Error(`Expected data-descriptor-signature at position ${this.tokenizer.position - DataDescriptor.len}`);
        }
      }
    } while (!stop);
  }
  async iterateOverCentralDirectory(entries, fileCb) {
    for (const fileHeader of entries) {
      const next = fileCb(fileHeader);
      if (next.handler) {
        this.tokenizer.setPosition(fileHeader.relativeOffsetOfLocalHeader);
        const zipHeader = await this.readLocalFileHeader();
        if (zipHeader) {
          await this.tokenizer.ignore(zipHeader.extraFieldLength);
          const fileData = new Uint8Array(fileHeader.compressedSize);
          await this.tokenizer.readBuffer(fileData);
          await this.inflate(zipHeader, fileData, next.handler);
        }
      }
      if (next.stop)
        break;
    }
  }
  async inflate(zipHeader, fileData, cb) {
    if (zipHeader.compressedMethod === 0) {
      return cb(fileData);
    }
    if (zipHeader.compressedMethod !== 8) {
      throw new Error(`Unsupported ZIP compression method: ${zipHeader.compressedMethod}`);
    }
    debug(`Decompress filename=${zipHeader.filename}, compressed-size=${fileData.length}`);
    const uncompressedData = await ZipHandler.decompressDeflateRaw(fileData);
    return cb(uncompressedData);
  }
  static async decompressDeflateRaw(data) {
    const input = new ReadableStream({
      start(controller) {
        controller.enqueue(data);
        controller.close();
      }
    });
    const ds = new DecompressionStream("deflate-raw");
    const output = input.pipeThrough(ds);
    try {
      const response = new Response(output);
      const buffer = await response.arrayBuffer();
      return new Uint8Array(buffer);
    } catch (err) {
      const message = err instanceof Error ? `Failed to deflate ZIP entry: ${err.message}` : "Unknown decompression error in ZIP entry";
      throw new TypeError(message);
    }
  }
  async readLocalFileHeader() {
    const signature = await this.tokenizer.peekToken(UINT32_LE);
    if (signature === Signature.LocalFileHeader) {
      const header = await this.tokenizer.readToken(LocalFileHeaderToken);
      header.filename = await this.tokenizer.readToken(new StringType(header.filenameLength, "utf-8"));
      return header;
    }
    if (signature === Signature.CentralFileHeader) {
      return false;
    }
    if (signature === 3759263696) {
      throw new Error("Encrypted ZIP");
    }
    throw new Error("Unexpected signature");
  }
}
function indexOf(buffer, portion) {
  const bufferLength = buffer.length;
  const portionLength = portion.length;
  if (portionLength > bufferLength)
    return -1;
  for (let i = 0;i <= bufferLength - portionLength; i++) {
    let found = true;
    for (let j = 0;j < portionLength; j++) {
      if (buffer[i + j] !== portion[j]) {
        found = false;
        break;
      }
    }
    if (found) {
      return i;
    }
  }
  return -1;
}
function mergeArrays(chunks) {
  const totalLength = chunks.reduce((acc, curr) => acc + curr.length, 0);
  const mergedArray = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    mergedArray.set(chunk, offset);
    offset += chunk.length;
  }
  return mergedArray;
}
// ../../../../node_modules/.bun/@tokenizer+inflate@0.4.1/node_modules/@tokenizer/inflate/lib/GzipHandler.js
class GzipHandler {
  constructor(tokenizer) {
    this.tokenizer = tokenizer;
  }
  inflate() {
    const tokenizer = this.tokenizer;
    return new ReadableStream({
      async pull(controller) {
        const buffer = new Uint8Array(1024);
        const size = await tokenizer.readBuffer(buffer, { mayBeLess: true });
        if (size === 0) {
          controller.close();
          return;
        }
        controller.enqueue(buffer.subarray(0, size));
      }
    }).pipeThrough(new DecompressionStream("gzip"));
  }
}
// ../../../../node_modules/.bun/uint8array-extras@1.5.0/node_modules/uint8array-extras/index.js
var cachedDecoders = {
  utf8: new globalThis.TextDecoder("utf8")
};
var cachedEncoder = new globalThis.TextEncoder;
var byteToHexLookupTable = Array.from({ length: 256 }, (_, index) => index.toString(16).padStart(2, "0"));
function getUintBE(view) {
  const { byteLength } = view;
  if (byteLength === 6) {
    return view.getUint16(0) * 2 ** 32 + view.getUint32(2);
  }
  if (byteLength === 5) {
    return view.getUint8(0) * 2 ** 32 + view.getUint32(1);
  }
  if (byteLength === 4) {
    return view.getUint32(0);
  }
  if (byteLength === 3) {
    return view.getUint8(0) * 2 ** 16 + view.getUint16(1);
  }
  if (byteLength === 2) {
    return view.getUint16(0);
  }
  if (byteLength === 1) {
    return view.getUint8(0);
  }
}

// ../../../../node_modules/.bun/file-type@21.1.1/node_modules/file-type/util.js
function stringToBytes(string, encoding) {
  if (encoding === "utf-16le") {
    const bytes = [];
    for (let index = 0;index < string.length; index++) {
      const code = string.charCodeAt(index);
      bytes.push(code & 255, code >> 8 & 255);
    }
    return bytes;
  }
  if (encoding === "utf-16be") {
    const bytes = [];
    for (let index = 0;index < string.length; index++) {
      const code = string.charCodeAt(index);
      bytes.push(code >> 8 & 255, code & 255);
    }
    return bytes;
  }
  return [...string].map((character) => character.charCodeAt(0));
}
function tarHeaderChecksumMatches(arrayBuffer, offset = 0) {
  const readSum = Number.parseInt(new StringType(6).get(arrayBuffer, 148).replace(/\0.*$/, "").trim(), 8);
  if (Number.isNaN(readSum)) {
    return false;
  }
  let sum = 8 * 32;
  for (let index = offset;index < offset + 148; index++) {
    sum += arrayBuffer[index];
  }
  for (let index = offset + 156;index < offset + 512; index++) {
    sum += arrayBuffer[index];
  }
  return readSum === sum;
}
var uint32SyncSafeToken = {
  get: (buffer, offset) => buffer[offset + 3] & 127 | buffer[offset + 2] << 7 | buffer[offset + 1] << 14 | buffer[offset] << 21,
  len: 4
};

// ../../../../node_modules/.bun/file-type@21.1.1/node_modules/file-type/supported.js
var extensions = [
  "jpg",
  "png",
  "apng",
  "gif",
  "webp",
  "flif",
  "xcf",
  "cr2",
  "cr3",
  "orf",
  "arw",
  "dng",
  "nef",
  "rw2",
  "raf",
  "tif",
  "bmp",
  "icns",
  "jxr",
  "psd",
  "indd",
  "zip",
  "tar",
  "rar",
  "gz",
  "bz2",
  "7z",
  "dmg",
  "mp4",
  "mid",
  "mkv",
  "webm",
  "mov",
  "avi",
  "mpg",
  "mp2",
  "mp3",
  "m4a",
  "oga",
  "ogg",
  "ogv",
  "opus",
  "flac",
  "wav",
  "spx",
  "amr",
  "pdf",
  "epub",
  "elf",
  "macho",
  "exe",
  "swf",
  "rtf",
  "wasm",
  "woff",
  "woff2",
  "eot",
  "ttf",
  "otf",
  "ttc",
  "ico",
  "flv",
  "ps",
  "xz",
  "sqlite",
  "nes",
  "crx",
  "xpi",
  "cab",
  "deb",
  "ar",
  "rpm",
  "Z",
  "lz",
  "cfb",
  "mxf",
  "mts",
  "blend",
  "bpg",
  "docx",
  "pptx",
  "xlsx",
  "3gp",
  "3g2",
  "j2c",
  "jp2",
  "jpm",
  "jpx",
  "mj2",
  "aif",
  "qcp",
  "odt",
  "ods",
  "odp",
  "xml",
  "mobi",
  "heic",
  "cur",
  "ktx",
  "ape",
  "wv",
  "dcm",
  "ics",
  "glb",
  "pcap",
  "dsf",
  "lnk",
  "alias",
  "voc",
  "ac3",
  "m4v",
  "m4p",
  "m4b",
  "f4v",
  "f4p",
  "f4b",
  "f4a",
  "mie",
  "asf",
  "ogm",
  "ogx",
  "mpc",
  "arrow",
  "shp",
  "aac",
  "mp1",
  "it",
  "s3m",
  "xm",
  "skp",
  "avif",
  "eps",
  "lzh",
  "pgp",
  "asar",
  "stl",
  "chm",
  "3mf",
  "zst",
  "jxl",
  "vcf",
  "jls",
  "pst",
  "dwg",
  "parquet",
  "class",
  "arj",
  "cpio",
  "ace",
  "avro",
  "icc",
  "fbx",
  "vsdx",
  "vtt",
  "apk",
  "drc",
  "lz4",
  "potx",
  "xltx",
  "dotx",
  "xltm",
  "ott",
  "ots",
  "otp",
  "odg",
  "otg",
  "xlsm",
  "docm",
  "dotm",
  "potm",
  "pptm",
  "jar",
  "rm",
  "ppsm",
  "ppsx",
  "tar.gz",
  "reg",
  "dat"
];
var mimeTypes = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/flif",
  "image/x-xcf",
  "image/x-canon-cr2",
  "image/x-canon-cr3",
  "image/tiff",
  "image/bmp",
  "image/vnd.ms-photo",
  "image/vnd.adobe.photoshop",
  "application/x-indesign",
  "application/epub+zip",
  "application/x-xpinstall",
  "application/vnd.ms-powerpoint.slideshow.macroenabled.12",
  "application/vnd.oasis.opendocument.text",
  "application/vnd.oasis.opendocument.spreadsheet",
  "application/vnd.oasis.opendocument.presentation",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.slideshow",
  "application/zip",
  "application/x-tar",
  "application/x-rar-compressed",
  "application/gzip",
  "application/x-bzip2",
  "application/x-7z-compressed",
  "application/x-apple-diskimage",
  "application/vnd.apache.arrow.file",
  "video/mp4",
  "audio/midi",
  "video/matroska",
  "video/webm",
  "video/quicktime",
  "video/vnd.avi",
  "audio/wav",
  "audio/qcelp",
  "audio/x-ms-asf",
  "video/x-ms-asf",
  "application/vnd.ms-asf",
  "video/mpeg",
  "video/3gpp",
  "audio/mpeg",
  "audio/mp4",
  "video/ogg",
  "audio/ogg",
  "audio/ogg; codecs=opus",
  "application/ogg",
  "audio/flac",
  "audio/ape",
  "audio/wavpack",
  "audio/amr",
  "application/pdf",
  "application/x-elf",
  "application/x-mach-binary",
  "application/x-msdownload",
  "application/x-shockwave-flash",
  "application/rtf",
  "application/wasm",
  "font/woff",
  "font/woff2",
  "application/vnd.ms-fontobject",
  "font/ttf",
  "font/otf",
  "font/collection",
  "image/x-icon",
  "video/x-flv",
  "application/postscript",
  "application/eps",
  "application/x-xz",
  "application/x-sqlite3",
  "application/x-nintendo-nes-rom",
  "application/x-google-chrome-extension",
  "application/vnd.ms-cab-compressed",
  "application/x-deb",
  "application/x-unix-archive",
  "application/x-rpm",
  "application/x-compress",
  "application/x-lzip",
  "application/x-cfb",
  "application/x-mie",
  "application/mxf",
  "video/mp2t",
  "application/x-blender",
  "image/bpg",
  "image/j2c",
  "image/jp2",
  "image/jpx",
  "image/jpm",
  "image/mj2",
  "audio/aiff",
  "application/xml",
  "application/x-mobipocket-ebook",
  "image/heif",
  "image/heif-sequence",
  "image/heic",
  "image/heic-sequence",
  "image/icns",
  "image/ktx",
  "application/dicom",
  "audio/x-musepack",
  "text/calendar",
  "text/vcard",
  "text/vtt",
  "model/gltf-binary",
  "application/vnd.tcpdump.pcap",
  "audio/x-dsf",
  "application/x.ms.shortcut",
  "application/x.apple.alias",
  "audio/x-voc",
  "audio/vnd.dolby.dd-raw",
  "audio/x-m4a",
  "image/apng",
  "image/x-olympus-orf",
  "image/x-sony-arw",
  "image/x-adobe-dng",
  "image/x-nikon-nef",
  "image/x-panasonic-rw2",
  "image/x-fujifilm-raf",
  "video/x-m4v",
  "video/3gpp2",
  "application/x-esri-shape",
  "audio/aac",
  "audio/x-it",
  "audio/x-s3m",
  "audio/x-xm",
  "video/MP1S",
  "video/MP2P",
  "application/vnd.sketchup.skp",
  "image/avif",
  "application/x-lzh-compressed",
  "application/pgp-encrypted",
  "application/x-asar",
  "model/stl",
  "application/vnd.ms-htmlhelp",
  "model/3mf",
  "image/jxl",
  "application/zstd",
  "image/jls",
  "application/vnd.ms-outlook",
  "image/vnd.dwg",
  "application/vnd.apache.parquet",
  "application/java-vm",
  "application/x-arj",
  "application/x-cpio",
  "application/x-ace-compressed",
  "application/avro",
  "application/vnd.iccprofile",
  "application/x.autodesk.fbx",
  "application/vnd.visio",
  "application/vnd.android.package-archive",
  "application/vnd.google.draco",
  "application/x-lz4",
  "application/vnd.openxmlformats-officedocument.presentationml.template",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.template",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.template",
  "application/vnd.ms-excel.template.macroenabled.12",
  "application/vnd.oasis.opendocument.text-template",
  "application/vnd.oasis.opendocument.spreadsheet-template",
  "application/vnd.oasis.opendocument.presentation-template",
  "application/vnd.oasis.opendocument.graphics",
  "application/vnd.oasis.opendocument.graphics-template",
  "application/vnd.ms-excel.sheet.macroenabled.12",
  "application/vnd.ms-word.document.macroenabled.12",
  "application/vnd.ms-word.template.macroenabled.12",
  "application/vnd.ms-powerpoint.template.macroenabled.12",
  "application/vnd.ms-powerpoint.presentation.macroenabled.12",
  "application/java-archive",
  "application/vnd.rn-realmedia",
  "application/x-ms-regedit",
  "application/x-ft-windows-registry-hive"
];

// ../../../../node_modules/.bun/file-type@21.1.1/node_modules/file-type/core.js
var reasonableDetectionSizeInBytes = 4100;
async function fileTypeFromStream(stream, options) {
  return new FileTypeParser(options).fromStream(stream);
}
async function fileTypeFromBuffer(input, options) {
  return new FileTypeParser(options).fromBuffer(input);
}
async function fileTypeFromBlob(blob, options) {
  return new FileTypeParser(options).fromBlob(blob);
}
function getFileTypeFromMimeType(mimeType) {
  mimeType = mimeType.toLowerCase();
  switch (mimeType) {
    case "application/epub+zip":
      return {
        ext: "epub",
        mime: mimeType
      };
    case "application/vnd.oasis.opendocument.text":
      return {
        ext: "odt",
        mime: mimeType
      };
    case "application/vnd.oasis.opendocument.text-template":
      return {
        ext: "ott",
        mime: mimeType
      };
    case "application/vnd.oasis.opendocument.spreadsheet":
      return {
        ext: "ods",
        mime: mimeType
      };
    case "application/vnd.oasis.opendocument.spreadsheet-template":
      return {
        ext: "ots",
        mime: mimeType
      };
    case "application/vnd.oasis.opendocument.presentation":
      return {
        ext: "odp",
        mime: mimeType
      };
    case "application/vnd.oasis.opendocument.presentation-template":
      return {
        ext: "otp",
        mime: mimeType
      };
    case "application/vnd.oasis.opendocument.graphics":
      return {
        ext: "odg",
        mime: mimeType
      };
    case "application/vnd.oasis.opendocument.graphics-template":
      return {
        ext: "otg",
        mime: mimeType
      };
    case "application/vnd.openxmlformats-officedocument.presentationml.slideshow":
      return {
        ext: "ppsx",
        mime: mimeType
      };
    case "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
      return {
        ext: "xlsx",
        mime: mimeType
      };
    case "application/vnd.ms-excel.sheet.macroenabled":
      return {
        ext: "xlsm",
        mime: "application/vnd.ms-excel.sheet.macroenabled.12"
      };
    case "application/vnd.openxmlformats-officedocument.spreadsheetml.template":
      return {
        ext: "xltx",
        mime: mimeType
      };
    case "application/vnd.ms-excel.template.macroenabled":
      return {
        ext: "xltm",
        mime: "application/vnd.ms-excel.template.macroenabled.12"
      };
    case "application/vnd.ms-powerpoint.slideshow.macroenabled":
      return {
        ext: "ppsm",
        mime: "application/vnd.ms-powerpoint.slideshow.macroenabled.12"
      };
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      return {
        ext: "docx",
        mime: mimeType
      };
    case "application/vnd.ms-word.document.macroenabled":
      return {
        ext: "docm",
        mime: "application/vnd.ms-word.document.macroenabled.12"
      };
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.template":
      return {
        ext: "dotx",
        mime: mimeType
      };
    case "application/vnd.ms-word.template.macroenabledtemplate":
      return {
        ext: "dotm",
        mime: "application/vnd.ms-word.template.macroenabled.12"
      };
    case "application/vnd.openxmlformats-officedocument.presentationml.template":
      return {
        ext: "potx",
        mime: mimeType
      };
    case "application/vnd.ms-powerpoint.template.macroenabled":
      return {
        ext: "potm",
        mime: "application/vnd.ms-powerpoint.template.macroenabled.12"
      };
    case "application/vnd.openxmlformats-officedocument.presentationml.presentation":
      return {
        ext: "pptx",
        mime: mimeType
      };
    case "application/vnd.ms-powerpoint.presentation.macroenabled":
      return {
        ext: "pptm",
        mime: "application/vnd.ms-powerpoint.presentation.macroenabled.12"
      };
    case "application/vnd.ms-visio.drawing":
      return {
        ext: "vsdx",
        mime: "application/vnd.visio"
      };
    case "application/vnd.ms-package.3dmanufacturing-3dmodel+xml":
      return {
        ext: "3mf",
        mime: "model/3mf"
      };
    default:
  }
}
function _check(buffer, headers, options) {
  options = {
    offset: 0,
    ...options
  };
  for (const [index, header] of headers.entries()) {
    if (options.mask) {
      if (header !== (options.mask[index] & buffer[index + options.offset])) {
        return false;
      }
    } else if (header !== buffer[index + options.offset]) {
      return false;
    }
  }
  return true;
}
async function fileTypeFromTokenizer(tokenizer, options) {
  return new FileTypeParser(options).fromTokenizer(tokenizer);
}
async function fileTypeStream(webStream, options) {
  return new FileTypeParser(options).toDetectionStream(webStream, options);
}

class FileTypeParser {
  constructor(options) {
    this.options = {
      mpegOffsetTolerance: 0,
      ...options
    };
    this.detectors = [
      ...options?.customDetectors ?? [],
      { id: "core", detect: this.detectConfident },
      { id: "core.imprecise", detect: this.detectImprecise }
    ];
    this.tokenizerOptions = {
      abortSignal: options?.signal
    };
  }
  async fromTokenizer(tokenizer) {
    const initialPosition = tokenizer.position;
    for (const detector of this.detectors) {
      const fileType = await detector.detect(tokenizer);
      if (fileType) {
        return fileType;
      }
      if (initialPosition !== tokenizer.position) {
        return;
      }
    }
  }
  async fromBuffer(input) {
    if (!(input instanceof Uint8Array || input instanceof ArrayBuffer)) {
      throw new TypeError(`Expected the \`input\` argument to be of type \`Uint8Array\` or \`ArrayBuffer\`, got \`${typeof input}\``);
    }
    const buffer = input instanceof Uint8Array ? input : new Uint8Array(input);
    if (!(buffer?.length > 1)) {
      return;
    }
    return this.fromTokenizer(fromBuffer(buffer, this.tokenizerOptions));
  }
  async fromBlob(blob) {
    const tokenizer = fromBlob(blob, this.tokenizerOptions);
    try {
      return await this.fromTokenizer(tokenizer);
    } finally {
      await tokenizer.close();
    }
  }
  async fromStream(stream) {
    const tokenizer = fromWebStream(stream, this.tokenizerOptions);
    try {
      return await this.fromTokenizer(tokenizer);
    } finally {
      await tokenizer.close();
    }
  }
  async toDetectionStream(stream, options) {
    const { sampleSize = reasonableDetectionSizeInBytes } = options;
    let detectedFileType;
    let firstChunk;
    const reader = stream.getReader({ mode: "byob" });
    try {
      const { value: chunk, done } = await reader.read(new Uint8Array(sampleSize));
      firstChunk = chunk;
      if (!done && chunk) {
        try {
          detectedFileType = await this.fromBuffer(chunk.subarray(0, sampleSize));
        } catch (error) {
          if (!(error instanceof EndOfStreamError)) {
            throw error;
          }
          detectedFileType = undefined;
        }
      }
      firstChunk = chunk;
    } finally {
      reader.releaseLock();
    }
    const transformStream = new TransformStream({
      async start(controller) {
        controller.enqueue(firstChunk);
      },
      transform(chunk, controller) {
        controller.enqueue(chunk);
      }
    });
    const newStream = stream.pipeThrough(transformStream);
    newStream.fileType = detectedFileType;
    return newStream;
  }
  check(header, options) {
    return _check(this.buffer, header, options);
  }
  checkString(header, options) {
    return this.check(stringToBytes(header, options?.encoding), options);
  }
  detectConfident = async (tokenizer) => {
    this.buffer = new Uint8Array(reasonableDetectionSizeInBytes);
    if (tokenizer.fileInfo.size === undefined) {
      tokenizer.fileInfo.size = Number.MAX_SAFE_INTEGER;
    }
    this.tokenizer = tokenizer;
    await tokenizer.peekBuffer(this.buffer, { length: 32, mayBeLess: true });
    if (this.check([66, 77])) {
      return {
        ext: "bmp",
        mime: "image/bmp"
      };
    }
    if (this.check([11, 119])) {
      return {
        ext: "ac3",
        mime: "audio/vnd.dolby.dd-raw"
      };
    }
    if (this.check([120, 1])) {
      return {
        ext: "dmg",
        mime: "application/x-apple-diskimage"
      };
    }
    if (this.check([77, 90])) {
      return {
        ext: "exe",
        mime: "application/x-msdownload"
      };
    }
    if (this.check([37, 33])) {
      await tokenizer.peekBuffer(this.buffer, { length: 24, mayBeLess: true });
      if (this.checkString("PS-Adobe-", { offset: 2 }) && this.checkString(" EPSF-", { offset: 14 })) {
        return {
          ext: "eps",
          mime: "application/eps"
        };
      }
      return {
        ext: "ps",
        mime: "application/postscript"
      };
    }
    if (this.check([31, 160]) || this.check([31, 157])) {
      return {
        ext: "Z",
        mime: "application/x-compress"
      };
    }
    if (this.check([199, 113])) {
      return {
        ext: "cpio",
        mime: "application/x-cpio"
      };
    }
    if (this.check([96, 234])) {
      return {
        ext: "arj",
        mime: "application/x-arj"
      };
    }
    if (this.check([239, 187, 191])) {
      this.tokenizer.ignore(3);
      return this.detectConfident(tokenizer);
    }
    if (this.check([71, 73, 70])) {
      return {
        ext: "gif",
        mime: "image/gif"
      };
    }
    if (this.check([73, 73, 188])) {
      return {
        ext: "jxr",
        mime: "image/vnd.ms-photo"
      };
    }
    if (this.check([31, 139, 8])) {
      const gzipHandler = new GzipHandler(tokenizer);
      const stream = gzipHandler.inflate();
      let shouldCancelStream = true;
      try {
        let compressedFileType;
        try {
          compressedFileType = await this.fromStream(stream);
        } catch {
          shouldCancelStream = false;
        }
        if (compressedFileType && compressedFileType.ext === "tar") {
          return {
            ext: "tar.gz",
            mime: "application/gzip"
          };
        }
      } finally {
        if (shouldCancelStream) {
          await stream.cancel();
        }
      }
      return {
        ext: "gz",
        mime: "application/gzip"
      };
    }
    if (this.check([66, 90, 104])) {
      return {
        ext: "bz2",
        mime: "application/x-bzip2"
      };
    }
    if (this.checkString("ID3")) {
      await tokenizer.ignore(6);
      const id3HeaderLength = await tokenizer.readToken(uint32SyncSafeToken);
      if (tokenizer.position + id3HeaderLength > tokenizer.fileInfo.size) {
        return {
          ext: "mp3",
          mime: "audio/mpeg"
        };
      }
      await tokenizer.ignore(id3HeaderLength);
      return this.fromTokenizer(tokenizer);
    }
    if (this.checkString("MP+")) {
      return {
        ext: "mpc",
        mime: "audio/x-musepack"
      };
    }
    if ((this.buffer[0] === 67 || this.buffer[0] === 70) && this.check([87, 83], { offset: 1 })) {
      return {
        ext: "swf",
        mime: "application/x-shockwave-flash"
      };
    }
    if (this.check([255, 216, 255])) {
      if (this.check([247], { offset: 3 })) {
        return {
          ext: "jls",
          mime: "image/jls"
        };
      }
      return {
        ext: "jpg",
        mime: "image/jpeg"
      };
    }
    if (this.check([79, 98, 106, 1])) {
      return {
        ext: "avro",
        mime: "application/avro"
      };
    }
    if (this.checkString("FLIF")) {
      return {
        ext: "flif",
        mime: "image/flif"
      };
    }
    if (this.checkString("8BPS")) {
      return {
        ext: "psd",
        mime: "image/vnd.adobe.photoshop"
      };
    }
    if (this.checkString("MPCK")) {
      return {
        ext: "mpc",
        mime: "audio/x-musepack"
      };
    }
    if (this.checkString("FORM")) {
      return {
        ext: "aif",
        mime: "audio/aiff"
      };
    }
    if (this.checkString("icns", { offset: 0 })) {
      return {
        ext: "icns",
        mime: "image/icns"
      };
    }
    if (this.check([80, 75, 3, 4])) {
      let fileType;
      await new ZipHandler(tokenizer).unzip((zipHeader) => {
        switch (zipHeader.filename) {
          case "META-INF/mozilla.rsa":
            fileType = {
              ext: "xpi",
              mime: "application/x-xpinstall"
            };
            return {
              stop: true
            };
          case "META-INF/MANIFEST.MF":
            fileType = {
              ext: "jar",
              mime: "application/java-archive"
            };
            return {
              stop: true
            };
          case "mimetype":
            return {
              async handler(fileData) {
                const mimeType = new TextDecoder("utf-8").decode(fileData).trim();
                fileType = getFileTypeFromMimeType(mimeType);
              },
              stop: true
            };
          case "[Content_Types].xml":
            return {
              async handler(fileData) {
                let xmlContent = new TextDecoder("utf-8").decode(fileData);
                const endPos = xmlContent.indexOf('.main+xml"');
                if (endPos === -1) {
                  const mimeType = "application/vnd.ms-package.3dmanufacturing-3dmodel+xml";
                  if (xmlContent.includes(`ContentType="${mimeType}"`)) {
                    fileType = getFileTypeFromMimeType(mimeType);
                  }
                } else {
                  xmlContent = xmlContent.slice(0, Math.max(0, endPos));
                  const firstPos = xmlContent.lastIndexOf('"');
                  const mimeType = xmlContent.slice(Math.max(0, firstPos + 1));
                  fileType = getFileTypeFromMimeType(mimeType);
                }
              },
              stop: true
            };
          default:
            if (/classes\d*\.dex/.test(zipHeader.filename)) {
              fileType = {
                ext: "apk",
                mime: "application/vnd.android.package-archive"
              };
              return { stop: true };
            }
            return {};
        }
      }).catch((error) => {
        if (!(error instanceof EndOfStreamError)) {
          throw error;
        }
      });
      return fileType ?? {
        ext: "zip",
        mime: "application/zip"
      };
    }
    if (this.checkString("OggS")) {
      await tokenizer.ignore(28);
      const type = new Uint8Array(8);
      await tokenizer.readBuffer(type);
      if (_check(type, [79, 112, 117, 115, 72, 101, 97, 100])) {
        return {
          ext: "opus",
          mime: "audio/ogg; codecs=opus"
        };
      }
      if (_check(type, [128, 116, 104, 101, 111, 114, 97])) {
        return {
          ext: "ogv",
          mime: "video/ogg"
        };
      }
      if (_check(type, [1, 118, 105, 100, 101, 111, 0])) {
        return {
          ext: "ogm",
          mime: "video/ogg"
        };
      }
      if (_check(type, [127, 70, 76, 65, 67])) {
        return {
          ext: "oga",
          mime: "audio/ogg"
        };
      }
      if (_check(type, [83, 112, 101, 101, 120, 32, 32])) {
        return {
          ext: "spx",
          mime: "audio/ogg"
        };
      }
      if (_check(type, [1, 118, 111, 114, 98, 105, 115])) {
        return {
          ext: "ogg",
          mime: "audio/ogg"
        };
      }
      return {
        ext: "ogx",
        mime: "application/ogg"
      };
    }
    if (this.check([80, 75]) && (this.buffer[2] === 3 || this.buffer[2] === 5 || this.buffer[2] === 7) && (this.buffer[3] === 4 || this.buffer[3] === 6 || this.buffer[3] === 8)) {
      return {
        ext: "zip",
        mime: "application/zip"
      };
    }
    if (this.checkString("MThd")) {
      return {
        ext: "mid",
        mime: "audio/midi"
      };
    }
    if (this.checkString("wOFF") && (this.check([0, 1, 0, 0], { offset: 4 }) || this.checkString("OTTO", { offset: 4 }))) {
      return {
        ext: "woff",
        mime: "font/woff"
      };
    }
    if (this.checkString("wOF2") && (this.check([0, 1, 0, 0], { offset: 4 }) || this.checkString("OTTO", { offset: 4 }))) {
      return {
        ext: "woff2",
        mime: "font/woff2"
      };
    }
    if (this.check([212, 195, 178, 161]) || this.check([161, 178, 195, 212])) {
      return {
        ext: "pcap",
        mime: "application/vnd.tcpdump.pcap"
      };
    }
    if (this.checkString("DSD ")) {
      return {
        ext: "dsf",
        mime: "audio/x-dsf"
      };
    }
    if (this.checkString("LZIP")) {
      return {
        ext: "lz",
        mime: "application/x-lzip"
      };
    }
    if (this.checkString("fLaC")) {
      return {
        ext: "flac",
        mime: "audio/flac"
      };
    }
    if (this.check([66, 80, 71, 251])) {
      return {
        ext: "bpg",
        mime: "image/bpg"
      };
    }
    if (this.checkString("wvpk")) {
      return {
        ext: "wv",
        mime: "audio/wavpack"
      };
    }
    if (this.checkString("%PDF")) {
      return {
        ext: "pdf",
        mime: "application/pdf"
      };
    }
    if (this.check([0, 97, 115, 109])) {
      return {
        ext: "wasm",
        mime: "application/wasm"
      };
    }
    if (this.check([73, 73])) {
      const fileType = await this.readTiffHeader(false);
      if (fileType) {
        return fileType;
      }
    }
    if (this.check([77, 77])) {
      const fileType = await this.readTiffHeader(true);
      if (fileType) {
        return fileType;
      }
    }
    if (this.checkString("MAC ")) {
      return {
        ext: "ape",
        mime: "audio/ape"
      };
    }
    if (this.check([26, 69, 223, 163])) {
      async function readField() {
        const msb = await tokenizer.peekNumber(UINT8);
        let mask = 128;
        let ic = 0;
        while ((msb & mask) === 0 && mask !== 0) {
          ++ic;
          mask >>= 1;
        }
        const id = new Uint8Array(ic + 1);
        await tokenizer.readBuffer(id);
        return id;
      }
      async function readElement() {
        const idField = await readField();
        const lengthField = await readField();
        lengthField[0] ^= 128 >> lengthField.length - 1;
        const nrLength = Math.min(6, lengthField.length);
        const idView = new DataView(idField.buffer);
        const lengthView = new DataView(lengthField.buffer, lengthField.length - nrLength, nrLength);
        return {
          id: getUintBE(idView),
          len: getUintBE(lengthView)
        };
      }
      async function readChildren(children) {
        while (children > 0) {
          const element = await readElement();
          if (element.id === 17026) {
            const rawValue = await tokenizer.readToken(new StringType(element.len));
            return rawValue.replaceAll(/\00.*$/g, "");
          }
          await tokenizer.ignore(element.len);
          --children;
        }
      }
      const re = await readElement();
      const documentType = await readChildren(re.len);
      switch (documentType) {
        case "webm":
          return {
            ext: "webm",
            mime: "video/webm"
          };
        case "matroska":
          return {
            ext: "mkv",
            mime: "video/matroska"
          };
        default:
          return;
      }
    }
    if (this.checkString("SQLi")) {
      return {
        ext: "sqlite",
        mime: "application/x-sqlite3"
      };
    }
    if (this.check([78, 69, 83, 26])) {
      return {
        ext: "nes",
        mime: "application/x-nintendo-nes-rom"
      };
    }
    if (this.checkString("Cr24")) {
      return {
        ext: "crx",
        mime: "application/x-google-chrome-extension"
      };
    }
    if (this.checkString("MSCF") || this.checkString("ISc(")) {
      return {
        ext: "cab",
        mime: "application/vnd.ms-cab-compressed"
      };
    }
    if (this.check([237, 171, 238, 219])) {
      return {
        ext: "rpm",
        mime: "application/x-rpm"
      };
    }
    if (this.check([197, 208, 211, 198])) {
      return {
        ext: "eps",
        mime: "application/eps"
      };
    }
    if (this.check([40, 181, 47, 253])) {
      return {
        ext: "zst",
        mime: "application/zstd"
      };
    }
    if (this.check([127, 69, 76, 70])) {
      return {
        ext: "elf",
        mime: "application/x-elf"
      };
    }
    if (this.check([33, 66, 68, 78])) {
      return {
        ext: "pst",
        mime: "application/vnd.ms-outlook"
      };
    }
    if (this.checkString("PAR1") || this.checkString("PARE")) {
      return {
        ext: "parquet",
        mime: "application/vnd.apache.parquet"
      };
    }
    if (this.checkString("ttcf")) {
      return {
        ext: "ttc",
        mime: "font/collection"
      };
    }
    if (this.check([207, 250, 237, 254])) {
      return {
        ext: "macho",
        mime: "application/x-mach-binary"
      };
    }
    if (this.check([4, 34, 77, 24])) {
      return {
        ext: "lz4",
        mime: "application/x-lz4"
      };
    }
    if (this.checkString("regf")) {
      return {
        ext: "dat",
        mime: "application/x-ft-windows-registry-hive"
      };
    }
    if (this.check([79, 84, 84, 79, 0])) {
      return {
        ext: "otf",
        mime: "font/otf"
      };
    }
    if (this.checkString("#!AMR")) {
      return {
        ext: "amr",
        mime: "audio/amr"
      };
    }
    if (this.checkString("{\\rtf")) {
      return {
        ext: "rtf",
        mime: "application/rtf"
      };
    }
    if (this.check([70, 76, 86, 1])) {
      return {
        ext: "flv",
        mime: "video/x-flv"
      };
    }
    if (this.checkString("IMPM")) {
      return {
        ext: "it",
        mime: "audio/x-it"
      };
    }
    if (this.checkString("-lh0-", { offset: 2 }) || this.checkString("-lh1-", { offset: 2 }) || this.checkString("-lh2-", { offset: 2 }) || this.checkString("-lh3-", { offset: 2 }) || this.checkString("-lh4-", { offset: 2 }) || this.checkString("-lh5-", { offset: 2 }) || this.checkString("-lh6-", { offset: 2 }) || this.checkString("-lh7-", { offset: 2 }) || this.checkString("-lzs-", { offset: 2 }) || this.checkString("-lz4-", { offset: 2 }) || this.checkString("-lz5-", { offset: 2 }) || this.checkString("-lhd-", { offset: 2 })) {
      return {
        ext: "lzh",
        mime: "application/x-lzh-compressed"
      };
    }
    if (this.check([0, 0, 1, 186])) {
      if (this.check([33], { offset: 4, mask: [241] })) {
        return {
          ext: "mpg",
          mime: "video/MP1S"
        };
      }
      if (this.check([68], { offset: 4, mask: [196] })) {
        return {
          ext: "mpg",
          mime: "video/MP2P"
        };
      }
    }
    if (this.checkString("ITSF")) {
      return {
        ext: "chm",
        mime: "application/vnd.ms-htmlhelp"
      };
    }
    if (this.check([202, 254, 186, 190])) {
      return {
        ext: "class",
        mime: "application/java-vm"
      };
    }
    if (this.checkString(".RMF")) {
      return {
        ext: "rm",
        mime: "application/vnd.rn-realmedia"
      };
    }
    if (this.checkString("DRACO")) {
      return {
        ext: "drc",
        mime: "application/vnd.google.draco"
      };
    }
    if (this.check([253, 55, 122, 88, 90, 0])) {
      return {
        ext: "xz",
        mime: "application/x-xz"
      };
    }
    if (this.checkString("<?xml ")) {
      return {
        ext: "xml",
        mime: "application/xml"
      };
    }
    if (this.check([55, 122, 188, 175, 39, 28])) {
      return {
        ext: "7z",
        mime: "application/x-7z-compressed"
      };
    }
    if (this.check([82, 97, 114, 33, 26, 7]) && (this.buffer[6] === 0 || this.buffer[6] === 1)) {
      return {
        ext: "rar",
        mime: "application/x-rar-compressed"
      };
    }
    if (this.checkString("solid ")) {
      return {
        ext: "stl",
        mime: "model/stl"
      };
    }
    if (this.checkString("AC")) {
      const version = new StringType(4, "latin1").get(this.buffer, 2);
      if (version.match("^d*") && version >= 1000 && version <= 1050) {
        return {
          ext: "dwg",
          mime: "image/vnd.dwg"
        };
      }
    }
    if (this.checkString("070707")) {
      return {
        ext: "cpio",
        mime: "application/x-cpio"
      };
    }
    if (this.checkString("BLENDER")) {
      return {
        ext: "blend",
        mime: "application/x-blender"
      };
    }
    if (this.checkString("!<arch>")) {
      await tokenizer.ignore(8);
      const string = await tokenizer.readToken(new StringType(13, "ascii"));
      if (string === "debian-binary") {
        return {
          ext: "deb",
          mime: "application/x-deb"
        };
      }
      return {
        ext: "ar",
        mime: "application/x-unix-archive"
      };
    }
    if (this.checkString("WEBVTT") && [`
`, "\r", "\t", " ", "\x00"].some((char7) => this.checkString(char7, { offset: 6 }))) {
      return {
        ext: "vtt",
        mime: "text/vtt"
      };
    }
    if (this.check([137, 80, 78, 71, 13, 10, 26, 10])) {
      await tokenizer.ignore(8);
      async function readChunkHeader() {
        return {
          length: await tokenizer.readToken(INT32_BE),
          type: await tokenizer.readToken(new StringType(4, "latin1"))
        };
      }
      do {
        const chunk = await readChunkHeader();
        if (chunk.length < 0) {
          return;
        }
        switch (chunk.type) {
          case "IDAT":
            return {
              ext: "png",
              mime: "image/png"
            };
          case "acTL":
            return {
              ext: "apng",
              mime: "image/apng"
            };
          default:
            await tokenizer.ignore(chunk.length + 4);
        }
      } while (tokenizer.position + 8 < tokenizer.fileInfo.size);
      return {
        ext: "png",
        mime: "image/png"
      };
    }
    if (this.check([65, 82, 82, 79, 87, 49, 0, 0])) {
      return {
        ext: "arrow",
        mime: "application/vnd.apache.arrow.file"
      };
    }
    if (this.check([103, 108, 84, 70, 2, 0, 0, 0])) {
      return {
        ext: "glb",
        mime: "model/gltf-binary"
      };
    }
    if (this.check([102, 114, 101, 101], { offset: 4 }) || this.check([109, 100, 97, 116], { offset: 4 }) || this.check([109, 111, 111, 118], { offset: 4 }) || this.check([119, 105, 100, 101], { offset: 4 })) {
      return {
        ext: "mov",
        mime: "video/quicktime"
      };
    }
    if (this.check([73, 73, 82, 79, 8, 0, 0, 0, 24])) {
      return {
        ext: "orf",
        mime: "image/x-olympus-orf"
      };
    }
    if (this.checkString("gimp xcf ")) {
      return {
        ext: "xcf",
        mime: "image/x-xcf"
      };
    }
    if (this.checkString("ftyp", { offset: 4 }) && (this.buffer[8] & 96) !== 0) {
      const brandMajor = new StringType(4, "latin1").get(this.buffer, 8).replace("\x00", " ").trim();
      switch (brandMajor) {
        case "avif":
        case "avis":
          return { ext: "avif", mime: "image/avif" };
        case "mif1":
          return { ext: "heic", mime: "image/heif" };
        case "msf1":
          return { ext: "heic", mime: "image/heif-sequence" };
        case "heic":
        case "heix":
          return { ext: "heic", mime: "image/heic" };
        case "hevc":
        case "hevx":
          return { ext: "heic", mime: "image/heic-sequence" };
        case "qt":
          return { ext: "mov", mime: "video/quicktime" };
        case "M4V":
        case "M4VH":
        case "M4VP":
          return { ext: "m4v", mime: "video/x-m4v" };
        case "M4P":
          return { ext: "m4p", mime: "video/mp4" };
        case "M4B":
          return { ext: "m4b", mime: "audio/mp4" };
        case "M4A":
          return { ext: "m4a", mime: "audio/x-m4a" };
        case "F4V":
          return { ext: "f4v", mime: "video/mp4" };
        case "F4P":
          return { ext: "f4p", mime: "video/mp4" };
        case "F4A":
          return { ext: "f4a", mime: "audio/mp4" };
        case "F4B":
          return { ext: "f4b", mime: "audio/mp4" };
        case "crx":
          return { ext: "cr3", mime: "image/x-canon-cr3" };
        default:
          if (brandMajor.startsWith("3g")) {
            if (brandMajor.startsWith("3g2")) {
              return { ext: "3g2", mime: "video/3gpp2" };
            }
            return { ext: "3gp", mime: "video/3gpp" };
          }
          return { ext: "mp4", mime: "video/mp4" };
      }
    }
    if (this.checkString(`REGEDIT4\r
`)) {
      return {
        ext: "reg",
        mime: "application/x-ms-regedit"
      };
    }
    if (this.check([82, 73, 70, 70])) {
      if (this.checkString("WEBP", { offset: 8 })) {
        return {
          ext: "webp",
          mime: "image/webp"
        };
      }
      if (this.check([65, 86, 73], { offset: 8 })) {
        return {
          ext: "avi",
          mime: "video/vnd.avi"
        };
      }
      if (this.check([87, 65, 86, 69], { offset: 8 })) {
        return {
          ext: "wav",
          mime: "audio/wav"
        };
      }
      if (this.check([81, 76, 67, 77], { offset: 8 })) {
        return {
          ext: "qcp",
          mime: "audio/qcelp"
        };
      }
    }
    if (this.check([73, 73, 85, 0, 24, 0, 0, 0, 136, 231, 116, 216])) {
      return {
        ext: "rw2",
        mime: "image/x-panasonic-rw2"
      };
    }
    if (this.check([48, 38, 178, 117, 142, 102, 207, 17, 166, 217])) {
      async function readHeader() {
        const guid = new Uint8Array(16);
        await tokenizer.readBuffer(guid);
        return {
          id: guid,
          size: Number(await tokenizer.readToken(UINT64_LE))
        };
      }
      await tokenizer.ignore(30);
      while (tokenizer.position + 24 < tokenizer.fileInfo.size) {
        const header = await readHeader();
        let payload = header.size - 24;
        if (_check(header.id, [145, 7, 220, 183, 183, 169, 207, 17, 142, 230, 0, 192, 12, 32, 83, 101])) {
          const typeId = new Uint8Array(16);
          payload -= await tokenizer.readBuffer(typeId);
          if (_check(typeId, [64, 158, 105, 248, 77, 91, 207, 17, 168, 253, 0, 128, 95, 92, 68, 43])) {
            return {
              ext: "asf",
              mime: "audio/x-ms-asf"
            };
          }
          if (_check(typeId, [192, 239, 25, 188, 77, 91, 207, 17, 168, 253, 0, 128, 95, 92, 68, 43])) {
            return {
              ext: "asf",
              mime: "video/x-ms-asf"
            };
          }
          break;
        }
        await tokenizer.ignore(payload);
      }
      return {
        ext: "asf",
        mime: "application/vnd.ms-asf"
      };
    }
    if (this.check([171, 75, 84, 88, 32, 49, 49, 187, 13, 10, 26, 10])) {
      return {
        ext: "ktx",
        mime: "image/ktx"
      };
    }
    if ((this.check([126, 16, 4]) || this.check([126, 24, 4])) && this.check([48, 77, 73, 69], { offset: 4 })) {
      return {
        ext: "mie",
        mime: "application/x-mie"
      };
    }
    if (this.check([39, 10, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], { offset: 2 })) {
      return {
        ext: "shp",
        mime: "application/x-esri-shape"
      };
    }
    if (this.check([255, 79, 255, 81])) {
      return {
        ext: "j2c",
        mime: "image/j2c"
      };
    }
    if (this.check([0, 0, 0, 12, 106, 80, 32, 32, 13, 10, 135, 10])) {
      await tokenizer.ignore(20);
      const type = await tokenizer.readToken(new StringType(4, "ascii"));
      switch (type) {
        case "jp2 ":
          return {
            ext: "jp2",
            mime: "image/jp2"
          };
        case "jpx ":
          return {
            ext: "jpx",
            mime: "image/jpx"
          };
        case "jpm ":
          return {
            ext: "jpm",
            mime: "image/jpm"
          };
        case "mjp2":
          return {
            ext: "mj2",
            mime: "image/mj2"
          };
        default:
          return;
      }
    }
    if (this.check([255, 10]) || this.check([0, 0, 0, 12, 74, 88, 76, 32, 13, 10, 135, 10])) {
      return {
        ext: "jxl",
        mime: "image/jxl"
      };
    }
    if (this.check([254, 255])) {
      if (this.checkString("<?xml ", { offset: 2, encoding: "utf-16be" })) {
        return {
          ext: "xml",
          mime: "application/xml"
        };
      }
      return;
    }
    if (this.check([208, 207, 17, 224, 161, 177, 26, 225])) {
      return {
        ext: "cfb",
        mime: "application/x-cfb"
      };
    }
    await tokenizer.peekBuffer(this.buffer, { length: Math.min(256, tokenizer.fileInfo.size), mayBeLess: true });
    if (this.check([97, 99, 115, 112], { offset: 36 })) {
      return {
        ext: "icc",
        mime: "application/vnd.iccprofile"
      };
    }
    if (this.checkString("**ACE", { offset: 7 }) && this.checkString("**", { offset: 12 })) {
      return {
        ext: "ace",
        mime: "application/x-ace-compressed"
      };
    }
    if (this.checkString("BEGIN:")) {
      if (this.checkString("VCARD", { offset: 6 })) {
        return {
          ext: "vcf",
          mime: "text/vcard"
        };
      }
      if (this.checkString("VCALENDAR", { offset: 6 })) {
        return {
          ext: "ics",
          mime: "text/calendar"
        };
      }
    }
    if (this.checkString("FUJIFILMCCD-RAW")) {
      return {
        ext: "raf",
        mime: "image/x-fujifilm-raf"
      };
    }
    if (this.checkString("Extended Module:")) {
      return {
        ext: "xm",
        mime: "audio/x-xm"
      };
    }
    if (this.checkString("Creative Voice File")) {
      return {
        ext: "voc",
        mime: "audio/x-voc"
      };
    }
    if (this.check([4, 0, 0, 0]) && this.buffer.length >= 16) {
      const jsonSize = new DataView(this.buffer.buffer).getUint32(12, true);
      if (jsonSize > 12 && this.buffer.length >= jsonSize + 16) {
        try {
          const header = new TextDecoder().decode(this.buffer.subarray(16, jsonSize + 16));
          const json = JSON.parse(header);
          if (json.files) {
            return {
              ext: "asar",
              mime: "application/x-asar"
            };
          }
        } catch {}
      }
    }
    if (this.check([6, 14, 43, 52, 2, 5, 1, 1, 13, 1, 2, 1, 1, 2])) {
      return {
        ext: "mxf",
        mime: "application/mxf"
      };
    }
    if (this.checkString("SCRM", { offset: 44 })) {
      return {
        ext: "s3m",
        mime: "audio/x-s3m"
      };
    }
    if (this.check([71]) && this.check([71], { offset: 188 })) {
      return {
        ext: "mts",
        mime: "video/mp2t"
      };
    }
    if (this.check([71], { offset: 4 }) && this.check([71], { offset: 196 })) {
      return {
        ext: "mts",
        mime: "video/mp2t"
      };
    }
    if (this.check([66, 79, 79, 75, 77, 79, 66, 73], { offset: 60 })) {
      return {
        ext: "mobi",
        mime: "application/x-mobipocket-ebook"
      };
    }
    if (this.check([68, 73, 67, 77], { offset: 128 })) {
      return {
        ext: "dcm",
        mime: "application/dicom"
      };
    }
    if (this.check([76, 0, 0, 0, 1, 20, 2, 0, 0, 0, 0, 0, 192, 0, 0, 0, 0, 0, 0, 70])) {
      return {
        ext: "lnk",
        mime: "application/x.ms.shortcut"
      };
    }
    if (this.check([98, 111, 111, 107, 0, 0, 0, 0, 109, 97, 114, 107, 0, 0, 0, 0])) {
      return {
        ext: "alias",
        mime: "application/x.apple.alias"
      };
    }
    if (this.checkString("Kaydara FBX Binary  \x00")) {
      return {
        ext: "fbx",
        mime: "application/x.autodesk.fbx"
      };
    }
    if (this.check([76, 80], { offset: 34 }) && (this.check([0, 0, 1], { offset: 8 }) || this.check([1, 0, 2], { offset: 8 }) || this.check([2, 0, 2], { offset: 8 }))) {
      return {
        ext: "eot",
        mime: "application/vnd.ms-fontobject"
      };
    }
    if (this.check([6, 6, 237, 245, 216, 29, 70, 229, 189, 49, 239, 231, 254, 116, 183, 29])) {
      return {
        ext: "indd",
        mime: "application/x-indesign"
      };
    }
    await tokenizer.peekBuffer(this.buffer, { length: Math.min(512, tokenizer.fileInfo.size), mayBeLess: true });
    if (this.checkString("ustar", { offset: 257 }) && (this.checkString("\x00", { offset: 262 }) || this.checkString(" ", { offset: 262 })) || this.check([0, 0, 0, 0, 0, 0], { offset: 257 }) && tarHeaderChecksumMatches(this.buffer)) {
      return {
        ext: "tar",
        mime: "application/x-tar"
      };
    }
    if (this.check([255, 254])) {
      const encoding = "utf-16le";
      if (this.checkString("<?xml ", { offset: 2, encoding })) {
        return {
          ext: "xml",
          mime: "application/xml"
        };
      }
      if (this.check([255, 14], { offset: 2 }) && this.checkString("SketchUp Model", { offset: 4, encoding })) {
        return {
          ext: "skp",
          mime: "application/vnd.sketchup.skp"
        };
      }
      if (this.checkString(`Windows Registry Editor Version 5.00\r
`, { offset: 2, encoding })) {
        return {
          ext: "reg",
          mime: "application/x-ms-regedit"
        };
      }
      return;
    }
    if (this.checkString("-----BEGIN PGP MESSAGE-----")) {
      return {
        ext: "pgp",
        mime: "application/pgp-encrypted"
      };
    }
  };
  detectImprecise = async (tokenizer) => {
    this.buffer = new Uint8Array(reasonableDetectionSizeInBytes);
    await tokenizer.peekBuffer(this.buffer, { length: Math.min(8, tokenizer.fileInfo.size), mayBeLess: true });
    if (this.check([0, 0, 1, 186]) || this.check([0, 0, 1, 179])) {
      return {
        ext: "mpg",
        mime: "video/mpeg"
      };
    }
    if (this.check([0, 1, 0, 0, 0])) {
      return {
        ext: "ttf",
        mime: "font/ttf"
      };
    }
    if (this.check([0, 0, 1, 0])) {
      return {
        ext: "ico",
        mime: "image/x-icon"
      };
    }
    if (this.check([0, 0, 2, 0])) {
      return {
        ext: "cur",
        mime: "image/x-icon"
      };
    }
    await tokenizer.peekBuffer(this.buffer, { length: Math.min(2 + this.options.mpegOffsetTolerance, tokenizer.fileInfo.size), mayBeLess: true });
    if (this.buffer.length >= 2 + this.options.mpegOffsetTolerance) {
      for (let depth = 0;depth <= this.options.mpegOffsetTolerance; ++depth) {
        const type = this.scanMpeg(depth);
        if (type) {
          return type;
        }
      }
    }
  };
  async readTiffTag(bigEndian) {
    const tagId = await this.tokenizer.readToken(bigEndian ? UINT16_BE : UINT16_LE);
    this.tokenizer.ignore(10);
    switch (tagId) {
      case 50341:
        return {
          ext: "arw",
          mime: "image/x-sony-arw"
        };
      case 50706:
        return {
          ext: "dng",
          mime: "image/x-adobe-dng"
        };
      default:
    }
  }
  async readTiffIFD(bigEndian) {
    const numberOfTags = await this.tokenizer.readToken(bigEndian ? UINT16_BE : UINT16_LE);
    for (let n = 0;n < numberOfTags; ++n) {
      const fileType = await this.readTiffTag(bigEndian);
      if (fileType) {
        return fileType;
      }
    }
  }
  async readTiffHeader(bigEndian) {
    const version = (bigEndian ? UINT16_BE : UINT16_LE).get(this.buffer, 2);
    const ifdOffset = (bigEndian ? UINT32_BE : UINT32_LE).get(this.buffer, 4);
    if (version === 42) {
      if (ifdOffset >= 6) {
        if (this.checkString("CR", { offset: 8 })) {
          return {
            ext: "cr2",
            mime: "image/x-canon-cr2"
          };
        }
        if (ifdOffset >= 8) {
          const someId1 = (bigEndian ? UINT16_BE : UINT16_LE).get(this.buffer, 8);
          const someId2 = (bigEndian ? UINT16_BE : UINT16_LE).get(this.buffer, 10);
          if (someId1 === 28 && someId2 === 254 || someId1 === 31 && someId2 === 11) {
            return {
              ext: "nef",
              mime: "image/x-nikon-nef"
            };
          }
        }
      }
      await this.tokenizer.ignore(ifdOffset);
      const fileType = await this.readTiffIFD(bigEndian);
      return fileType ?? {
        ext: "tif",
        mime: "image/tiff"
      };
    }
    if (version === 43) {
      return {
        ext: "tif",
        mime: "image/tiff"
      };
    }
  }
  scanMpeg(offset) {
    if (this.check([255, 224], { offset, mask: [255, 224] })) {
      if (this.check([16], { offset: offset + 1, mask: [22] })) {
        if (this.check([8], { offset: offset + 1, mask: [8] })) {
          return {
            ext: "aac",
            mime: "audio/aac"
          };
        }
        return {
          ext: "aac",
          mime: "audio/aac"
        };
      }
      if (this.check([2], { offset: offset + 1, mask: [6] })) {
        return {
          ext: "mp3",
          mime: "audio/mpeg"
        };
      }
      if (this.check([4], { offset: offset + 1, mask: [6] })) {
        return {
          ext: "mp2",
          mime: "audio/mpeg"
        };
      }
      if (this.check([6], { offset: offset + 1, mask: [6] })) {
        return {
          ext: "mp1",
          mime: "audio/mpeg"
        };
      }
    }
  }
}
var supportedExtensions = new Set(extensions);
var supportedMimeTypes = new Set(mimeTypes);
export {
  supportedMimeTypes,
  supportedExtensions,
  reasonableDetectionSizeInBytes,
  fileTypeStream,
  fileTypeFromTokenizer,
  fileTypeFromStream,
  fileTypeFromBuffer,
  fileTypeFromBlob,
  FileTypeParser
};

//# debugId=6BEBBA393B93894864756E2164756E21
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzLy5idW4vbXNAMi4xLjMvbm9kZV9tb2R1bGVzL21zL2luZGV4LmpzIiwgIi4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy8uYnVuL2RlYnVnQDQuNC4zL25vZGVfbW9kdWxlcy9kZWJ1Zy9zcmMvY29tbW9uLmpzIiwgIi4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy8uYnVuL2RlYnVnQDQuNC4zL25vZGVfbW9kdWxlcy9kZWJ1Zy9zcmMvYnJvd3Nlci5qcyIsICIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvLmJ1bi9pZWVlNzU0QDEuMi4xL25vZGVfbW9kdWxlcy9pZWVlNzU0L2luZGV4LmpzIiwgIi4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy8uYnVuL0Bib3Jld2l0K3RleHQtY29kZWNAMC4xLjEvbm9kZV9tb2R1bGVzL0Bib3Jld2l0L3RleHQtY29kZWMvbGliL2luZGV4LmpzIiwgIi4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy8uYnVuL3Rva2VuLXR5cGVzQDYuMS4xL25vZGVfbW9kdWxlcy90b2tlbi10eXBlcy9saWIvaW5kZXguanMiLCAiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzLy5idW4vc3RydG9rM0AxMC4zLjQvbm9kZV9tb2R1bGVzL3N0cnRvazMvbGliL3N0cmVhbS9FcnJvcnMuanMiLCAiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzLy5idW4vc3RydG9rM0AxMC4zLjQvbm9kZV9tb2R1bGVzL3N0cnRvazMvbGliL3N0cmVhbS9BYnN0cmFjdFN0cmVhbVJlYWRlci5qcyIsICIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvLmJ1bi9zdHJ0b2szQDEwLjMuNC9ub2RlX21vZHVsZXMvc3RydG9rMy9saWIvc3RyZWFtL1dlYlN0cmVhbVJlYWRlci5qcyIsICIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvLmJ1bi9zdHJ0b2szQDEwLjMuNC9ub2RlX21vZHVsZXMvc3RydG9rMy9saWIvc3RyZWFtL1dlYlN0cmVhbUJ5b2JSZWFkZXIuanMiLCAiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzLy5idW4vc3RydG9rM0AxMC4zLjQvbm9kZV9tb2R1bGVzL3N0cnRvazMvbGliL3N0cmVhbS9XZWJTdHJlYW1EZWZhdWx0UmVhZGVyLmpzIiwgIi4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy8uYnVuL3N0cnRvazNAMTAuMy40L25vZGVfbW9kdWxlcy9zdHJ0b2szL2xpYi9zdHJlYW0vV2ViU3RyZWFtUmVhZGVyRmFjdG9yeS5qcyIsICIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvLmJ1bi9zdHJ0b2szQDEwLjMuNC9ub2RlX21vZHVsZXMvc3RydG9rMy9saWIvQWJzdHJhY3RUb2tlbml6ZXIuanMiLCAiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzLy5idW4vc3RydG9rM0AxMC4zLjQvbm9kZV9tb2R1bGVzL3N0cnRvazMvbGliL1JlYWRTdHJlYW1Ub2tlbml6ZXIuanMiLCAiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzLy5idW4vc3RydG9rM0AxMC4zLjQvbm9kZV9tb2R1bGVzL3N0cnRvazMvbGliL0J1ZmZlclRva2VuaXplci5qcyIsICIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvLmJ1bi9zdHJ0b2szQDEwLjMuNC9ub2RlX21vZHVsZXMvc3RydG9rMy9saWIvQmxvYlRva2VuaXplci5qcyIsICIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvLmJ1bi9zdHJ0b2szQDEwLjMuNC9ub2RlX21vZHVsZXMvc3RydG9rMy9saWIvY29yZS5qcyIsICIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvLmJ1bi9AdG9rZW5pemVyK2luZmxhdGVAMC40LjEvbm9kZV9tb2R1bGVzL0B0b2tlbml6ZXIvaW5mbGF0ZS9saWIvWmlwSGFuZGxlci5qcyIsICIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvLmJ1bi9AdG9rZW5pemVyK2luZmxhdGVAMC40LjEvbm9kZV9tb2R1bGVzL0B0b2tlbml6ZXIvaW5mbGF0ZS9saWIvWmlwVG9rZW4uanMiLCAiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzLy5idW4vQHRva2VuaXplcitpbmZsYXRlQDAuNC4xL25vZGVfbW9kdWxlcy9AdG9rZW5pemVyL2luZmxhdGUvbGliL0d6aXBIYW5kbGVyLmpzIiwgIi4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy8uYnVuL3VpbnQ4YXJyYXktZXh0cmFzQDEuNS4wL25vZGVfbW9kdWxlcy91aW50OGFycmF5LWV4dHJhcy9pbmRleC5qcyIsICIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvLmJ1bi9maWxlLXR5cGVAMjEuMS4xL25vZGVfbW9kdWxlcy9maWxlLXR5cGUvdXRpbC5qcyIsICIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvLmJ1bi9maWxlLXR5cGVAMjEuMS4xL25vZGVfbW9kdWxlcy9maWxlLXR5cGUvc3VwcG9ydGVkLmpzIiwgIi4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy8uYnVuL2ZpbGUtdHlwZUAyMS4xLjEvbm9kZV9tb2R1bGVzL2ZpbGUtdHlwZS9jb3JlLmpzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWwogICAgIi8qKlxuICogSGVscGVycy5cbiAqL1xuXG52YXIgcyA9IDEwMDA7XG52YXIgbSA9IHMgKiA2MDtcbnZhciBoID0gbSAqIDYwO1xudmFyIGQgPSBoICogMjQ7XG52YXIgdyA9IGQgKiA3O1xudmFyIHkgPSBkICogMzY1LjI1O1xuXG4vKipcbiAqIFBhcnNlIG9yIGZvcm1hdCB0aGUgZ2l2ZW4gYHZhbGAuXG4gKlxuICogT3B0aW9uczpcbiAqXG4gKiAgLSBgbG9uZ2AgdmVyYm9zZSBmb3JtYXR0aW5nIFtmYWxzZV1cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ3xOdW1iZXJ9IHZhbFxuICogQHBhcmFtIHtPYmplY3R9IFtvcHRpb25zXVxuICogQHRocm93cyB7RXJyb3J9IHRocm93IGFuIGVycm9yIGlmIHZhbCBpcyBub3QgYSBub24tZW1wdHkgc3RyaW5nIG9yIGEgbnVtYmVyXG4gKiBAcmV0dXJuIHtTdHJpbmd8TnVtYmVyfVxuICogQGFwaSBwdWJsaWNcbiAqL1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uICh2YWwsIG9wdGlvbnMpIHtcbiAgb3B0aW9ucyA9IG9wdGlvbnMgfHwge307XG4gIHZhciB0eXBlID0gdHlwZW9mIHZhbDtcbiAgaWYgKHR5cGUgPT09ICdzdHJpbmcnICYmIHZhbC5sZW5ndGggPiAwKSB7XG4gICAgcmV0dXJuIHBhcnNlKHZhbCk7XG4gIH0gZWxzZSBpZiAodHlwZSA9PT0gJ251bWJlcicgJiYgaXNGaW5pdGUodmFsKSkge1xuICAgIHJldHVybiBvcHRpb25zLmxvbmcgPyBmbXRMb25nKHZhbCkgOiBmbXRTaG9ydCh2YWwpO1xuICB9XG4gIHRocm93IG5ldyBFcnJvcihcbiAgICAndmFsIGlzIG5vdCBhIG5vbi1lbXB0eSBzdHJpbmcgb3IgYSB2YWxpZCBudW1iZXIuIHZhbD0nICtcbiAgICAgIEpTT04uc3RyaW5naWZ5KHZhbClcbiAgKTtcbn07XG5cbi8qKlxuICogUGFyc2UgdGhlIGdpdmVuIGBzdHJgIGFuZCByZXR1cm4gbWlsbGlzZWNvbmRzLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBzdHJcbiAqIEByZXR1cm4ge051bWJlcn1cbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5cbmZ1bmN0aW9uIHBhcnNlKHN0cikge1xuICBzdHIgPSBTdHJpbmcoc3RyKTtcbiAgaWYgKHN0ci5sZW5ndGggPiAxMDApIHtcbiAgICByZXR1cm47XG4gIH1cbiAgdmFyIG1hdGNoID0gL14oLT8oPzpcXGQrKT9cXC4/XFxkKykgKihtaWxsaXNlY29uZHM/fG1zZWNzP3xtc3xzZWNvbmRzP3xzZWNzP3xzfG1pbnV0ZXM/fG1pbnM/fG18aG91cnM/fGhycz98aHxkYXlzP3xkfHdlZWtzP3x3fHllYXJzP3x5cnM/fHkpPyQvaS5leGVjKFxuICAgIHN0clxuICApO1xuICBpZiAoIW1hdGNoKSB7XG4gICAgcmV0dXJuO1xuICB9XG4gIHZhciBuID0gcGFyc2VGbG9hdChtYXRjaFsxXSk7XG4gIHZhciB0eXBlID0gKG1hdGNoWzJdIHx8ICdtcycpLnRvTG93ZXJDYXNlKCk7XG4gIHN3aXRjaCAodHlwZSkge1xuICAgIGNhc2UgJ3llYXJzJzpcbiAgICBjYXNlICd5ZWFyJzpcbiAgICBjYXNlICd5cnMnOlxuICAgIGNhc2UgJ3lyJzpcbiAgICBjYXNlICd5JzpcbiAgICAgIHJldHVybiBuICogeTtcbiAgICBjYXNlICd3ZWVrcyc6XG4gICAgY2FzZSAnd2Vlayc6XG4gICAgY2FzZSAndyc6XG4gICAgICByZXR1cm4gbiAqIHc7XG4gICAgY2FzZSAnZGF5cyc6XG4gICAgY2FzZSAnZGF5JzpcbiAgICBjYXNlICdkJzpcbiAgICAgIHJldHVybiBuICogZDtcbiAgICBjYXNlICdob3Vycyc6XG4gICAgY2FzZSAnaG91cic6XG4gICAgY2FzZSAnaHJzJzpcbiAgICBjYXNlICdocic6XG4gICAgY2FzZSAnaCc6XG4gICAgICByZXR1cm4gbiAqIGg7XG4gICAgY2FzZSAnbWludXRlcyc6XG4gICAgY2FzZSAnbWludXRlJzpcbiAgICBjYXNlICdtaW5zJzpcbiAgICBjYXNlICdtaW4nOlxuICAgIGNhc2UgJ20nOlxuICAgICAgcmV0dXJuIG4gKiBtO1xuICAgIGNhc2UgJ3NlY29uZHMnOlxuICAgIGNhc2UgJ3NlY29uZCc6XG4gICAgY2FzZSAnc2Vjcyc6XG4gICAgY2FzZSAnc2VjJzpcbiAgICBjYXNlICdzJzpcbiAgICAgIHJldHVybiBuICogcztcbiAgICBjYXNlICdtaWxsaXNlY29uZHMnOlxuICAgIGNhc2UgJ21pbGxpc2Vjb25kJzpcbiAgICBjYXNlICdtc2Vjcyc6XG4gICAgY2FzZSAnbXNlYyc6XG4gICAgY2FzZSAnbXMnOlxuICAgICAgcmV0dXJuIG47XG4gICAgZGVmYXVsdDpcbiAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gIH1cbn1cblxuLyoqXG4gKiBTaG9ydCBmb3JtYXQgZm9yIGBtc2AuXG4gKlxuICogQHBhcmFtIHtOdW1iZXJ9IG1zXG4gKiBAcmV0dXJuIHtTdHJpbmd9XG4gKiBAYXBpIHByaXZhdGVcbiAqL1xuXG5mdW5jdGlvbiBmbXRTaG9ydChtcykge1xuICB2YXIgbXNBYnMgPSBNYXRoLmFicyhtcyk7XG4gIGlmIChtc0FicyA+PSBkKSB7XG4gICAgcmV0dXJuIE1hdGgucm91bmQobXMgLyBkKSArICdkJztcbiAgfVxuICBpZiAobXNBYnMgPj0gaCkge1xuICAgIHJldHVybiBNYXRoLnJvdW5kKG1zIC8gaCkgKyAnaCc7XG4gIH1cbiAgaWYgKG1zQWJzID49IG0pIHtcbiAgICByZXR1cm4gTWF0aC5yb3VuZChtcyAvIG0pICsgJ20nO1xuICB9XG4gIGlmIChtc0FicyA+PSBzKSB7XG4gICAgcmV0dXJuIE1hdGgucm91bmQobXMgLyBzKSArICdzJztcbiAgfVxuICByZXR1cm4gbXMgKyAnbXMnO1xufVxuXG4vKipcbiAqIExvbmcgZm9ybWF0IGZvciBgbXNgLlxuICpcbiAqIEBwYXJhbSB7TnVtYmVyfSBtc1xuICogQHJldHVybiB7U3RyaW5nfVxuICogQGFwaSBwcml2YXRlXG4gKi9cblxuZnVuY3Rpb24gZm10TG9uZyhtcykge1xuICB2YXIgbXNBYnMgPSBNYXRoLmFicyhtcyk7XG4gIGlmIChtc0FicyA+PSBkKSB7XG4gICAgcmV0dXJuIHBsdXJhbChtcywgbXNBYnMsIGQsICdkYXknKTtcbiAgfVxuICBpZiAobXNBYnMgPj0gaCkge1xuICAgIHJldHVybiBwbHVyYWwobXMsIG1zQWJzLCBoLCAnaG91cicpO1xuICB9XG4gIGlmIChtc0FicyA+PSBtKSB7XG4gICAgcmV0dXJuIHBsdXJhbChtcywgbXNBYnMsIG0sICdtaW51dGUnKTtcbiAgfVxuICBpZiAobXNBYnMgPj0gcykge1xuICAgIHJldHVybiBwbHVyYWwobXMsIG1zQWJzLCBzLCAnc2Vjb25kJyk7XG4gIH1cbiAgcmV0dXJuIG1zICsgJyBtcyc7XG59XG5cbi8qKlxuICogUGx1cmFsaXphdGlvbiBoZWxwZXIuXG4gKi9cblxuZnVuY3Rpb24gcGx1cmFsKG1zLCBtc0FicywgbiwgbmFtZSkge1xuICB2YXIgaXNQbHVyYWwgPSBtc0FicyA+PSBuICogMS41O1xuICByZXR1cm4gTWF0aC5yb3VuZChtcyAvIG4pICsgJyAnICsgbmFtZSArIChpc1BsdXJhbCA/ICdzJyA6ICcnKTtcbn1cbiIsCiAgICAiXG4vKipcbiAqIFRoaXMgaXMgdGhlIGNvbW1vbiBsb2dpYyBmb3IgYm90aCB0aGUgTm9kZS5qcyBhbmQgd2ViIGJyb3dzZXJcbiAqIGltcGxlbWVudGF0aW9ucyBvZiBgZGVidWcoKWAuXG4gKi9cblxuZnVuY3Rpb24gc2V0dXAoZW52KSB7XG5cdGNyZWF0ZURlYnVnLmRlYnVnID0gY3JlYXRlRGVidWc7XG5cdGNyZWF0ZURlYnVnLmRlZmF1bHQgPSBjcmVhdGVEZWJ1Zztcblx0Y3JlYXRlRGVidWcuY29lcmNlID0gY29lcmNlO1xuXHRjcmVhdGVEZWJ1Zy5kaXNhYmxlID0gZGlzYWJsZTtcblx0Y3JlYXRlRGVidWcuZW5hYmxlID0gZW5hYmxlO1xuXHRjcmVhdGVEZWJ1Zy5lbmFibGVkID0gZW5hYmxlZDtcblx0Y3JlYXRlRGVidWcuaHVtYW5pemUgPSByZXF1aXJlKCdtcycpO1xuXHRjcmVhdGVEZWJ1Zy5kZXN0cm95ID0gZGVzdHJveTtcblxuXHRPYmplY3Qua2V5cyhlbnYpLmZvckVhY2goa2V5ID0+IHtcblx0XHRjcmVhdGVEZWJ1Z1trZXldID0gZW52W2tleV07XG5cdH0pO1xuXG5cdC8qKlxuXHQqIFRoZSBjdXJyZW50bHkgYWN0aXZlIGRlYnVnIG1vZGUgbmFtZXMsIGFuZCBuYW1lcyB0byBza2lwLlxuXHQqL1xuXG5cdGNyZWF0ZURlYnVnLm5hbWVzID0gW107XG5cdGNyZWF0ZURlYnVnLnNraXBzID0gW107XG5cblx0LyoqXG5cdCogTWFwIG9mIHNwZWNpYWwgXCIlblwiIGhhbmRsaW5nIGZ1bmN0aW9ucywgZm9yIHRoZSBkZWJ1ZyBcImZvcm1hdFwiIGFyZ3VtZW50LlxuXHQqXG5cdCogVmFsaWQga2V5IG5hbWVzIGFyZSBhIHNpbmdsZSwgbG93ZXIgb3IgdXBwZXItY2FzZSBsZXR0ZXIsIGkuZS4gXCJuXCIgYW5kIFwiTlwiLlxuXHQqL1xuXHRjcmVhdGVEZWJ1Zy5mb3JtYXR0ZXJzID0ge307XG5cblx0LyoqXG5cdCogU2VsZWN0cyBhIGNvbG9yIGZvciBhIGRlYnVnIG5hbWVzcGFjZVxuXHQqIEBwYXJhbSB7U3RyaW5nfSBuYW1lc3BhY2UgVGhlIG5hbWVzcGFjZSBzdHJpbmcgZm9yIHRoZSBkZWJ1ZyBpbnN0YW5jZSB0byBiZSBjb2xvcmVkXG5cdCogQHJldHVybiB7TnVtYmVyfFN0cmluZ30gQW4gQU5TSSBjb2xvciBjb2RlIGZvciB0aGUgZ2l2ZW4gbmFtZXNwYWNlXG5cdCogQGFwaSBwcml2YXRlXG5cdCovXG5cdGZ1bmN0aW9uIHNlbGVjdENvbG9yKG5hbWVzcGFjZSkge1xuXHRcdGxldCBoYXNoID0gMDtcblxuXHRcdGZvciAobGV0IGkgPSAwOyBpIDwgbmFtZXNwYWNlLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRoYXNoID0gKChoYXNoIDw8IDUpIC0gaGFzaCkgKyBuYW1lc3BhY2UuY2hhckNvZGVBdChpKTtcblx0XHRcdGhhc2ggfD0gMDsgLy8gQ29udmVydCB0byAzMmJpdCBpbnRlZ2VyXG5cdFx0fVxuXG5cdFx0cmV0dXJuIGNyZWF0ZURlYnVnLmNvbG9yc1tNYXRoLmFicyhoYXNoKSAlIGNyZWF0ZURlYnVnLmNvbG9ycy5sZW5ndGhdO1xuXHR9XG5cdGNyZWF0ZURlYnVnLnNlbGVjdENvbG9yID0gc2VsZWN0Q29sb3I7XG5cblx0LyoqXG5cdCogQ3JlYXRlIGEgZGVidWdnZXIgd2l0aCB0aGUgZ2l2ZW4gYG5hbWVzcGFjZWAuXG5cdCpcblx0KiBAcGFyYW0ge1N0cmluZ30gbmFtZXNwYWNlXG5cdCogQHJldHVybiB7RnVuY3Rpb259XG5cdCogQGFwaSBwdWJsaWNcblx0Ki9cblx0ZnVuY3Rpb24gY3JlYXRlRGVidWcobmFtZXNwYWNlKSB7XG5cdFx0bGV0IHByZXZUaW1lO1xuXHRcdGxldCBlbmFibGVPdmVycmlkZSA9IG51bGw7XG5cdFx0bGV0IG5hbWVzcGFjZXNDYWNoZTtcblx0XHRsZXQgZW5hYmxlZENhY2hlO1xuXG5cdFx0ZnVuY3Rpb24gZGVidWcoLi4uYXJncykge1xuXHRcdFx0Ly8gRGlzYWJsZWQ/XG5cdFx0XHRpZiAoIWRlYnVnLmVuYWJsZWQpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBzZWxmID0gZGVidWc7XG5cblx0XHRcdC8vIFNldCBgZGlmZmAgdGltZXN0YW1wXG5cdFx0XHRjb25zdCBjdXJyID0gTnVtYmVyKG5ldyBEYXRlKCkpO1xuXHRcdFx0Y29uc3QgbXMgPSBjdXJyIC0gKHByZXZUaW1lIHx8IGN1cnIpO1xuXHRcdFx0c2VsZi5kaWZmID0gbXM7XG5cdFx0XHRzZWxmLnByZXYgPSBwcmV2VGltZTtcblx0XHRcdHNlbGYuY3VyciA9IGN1cnI7XG5cdFx0XHRwcmV2VGltZSA9IGN1cnI7XG5cblx0XHRcdGFyZ3NbMF0gPSBjcmVhdGVEZWJ1Zy5jb2VyY2UoYXJnc1swXSk7XG5cblx0XHRcdGlmICh0eXBlb2YgYXJnc1swXSAhPT0gJ3N0cmluZycpIHtcblx0XHRcdFx0Ly8gQW55dGhpbmcgZWxzZSBsZXQncyBpbnNwZWN0IHdpdGggJU9cblx0XHRcdFx0YXJncy51bnNoaWZ0KCclTycpO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBBcHBseSBhbnkgYGZvcm1hdHRlcnNgIHRyYW5zZm9ybWF0aW9uc1xuXHRcdFx0bGV0IGluZGV4ID0gMDtcblx0XHRcdGFyZ3NbMF0gPSBhcmdzWzBdLnJlcGxhY2UoLyUoW2EtekEtWiVdKS9nLCAobWF0Y2gsIGZvcm1hdCkgPT4ge1xuXHRcdFx0XHQvLyBJZiB3ZSBlbmNvdW50ZXIgYW4gZXNjYXBlZCAlIHRoZW4gZG9uJ3QgaW5jcmVhc2UgdGhlIGFycmF5IGluZGV4XG5cdFx0XHRcdGlmIChtYXRjaCA9PT0gJyUlJykge1xuXHRcdFx0XHRcdHJldHVybiAnJSc7XG5cdFx0XHRcdH1cblx0XHRcdFx0aW5kZXgrKztcblx0XHRcdFx0Y29uc3QgZm9ybWF0dGVyID0gY3JlYXRlRGVidWcuZm9ybWF0dGVyc1tmb3JtYXRdO1xuXHRcdFx0XHRpZiAodHlwZW9mIGZvcm1hdHRlciA9PT0gJ2Z1bmN0aW9uJykge1xuXHRcdFx0XHRcdGNvbnN0IHZhbCA9IGFyZ3NbaW5kZXhdO1xuXHRcdFx0XHRcdG1hdGNoID0gZm9ybWF0dGVyLmNhbGwoc2VsZiwgdmFsKTtcblxuXHRcdFx0XHRcdC8vIE5vdyB3ZSBuZWVkIHRvIHJlbW92ZSBgYXJnc1tpbmRleF1gIHNpbmNlIGl0J3MgaW5saW5lZCBpbiB0aGUgYGZvcm1hdGBcblx0XHRcdFx0XHRhcmdzLnNwbGljZShpbmRleCwgMSk7XG5cdFx0XHRcdFx0aW5kZXgtLTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gbWF0Y2g7XG5cdFx0XHR9KTtcblxuXHRcdFx0Ly8gQXBwbHkgZW52LXNwZWNpZmljIGZvcm1hdHRpbmcgKGNvbG9ycywgZXRjLilcblx0XHRcdGNyZWF0ZURlYnVnLmZvcm1hdEFyZ3MuY2FsbChzZWxmLCBhcmdzKTtcblxuXHRcdFx0Y29uc3QgbG9nRm4gPSBzZWxmLmxvZyB8fCBjcmVhdGVEZWJ1Zy5sb2c7XG5cdFx0XHRsb2dGbi5hcHBseShzZWxmLCBhcmdzKTtcblx0XHR9XG5cblx0XHRkZWJ1Zy5uYW1lc3BhY2UgPSBuYW1lc3BhY2U7XG5cdFx0ZGVidWcudXNlQ29sb3JzID0gY3JlYXRlRGVidWcudXNlQ29sb3JzKCk7XG5cdFx0ZGVidWcuY29sb3IgPSBjcmVhdGVEZWJ1Zy5zZWxlY3RDb2xvcihuYW1lc3BhY2UpO1xuXHRcdGRlYnVnLmV4dGVuZCA9IGV4dGVuZDtcblx0XHRkZWJ1Zy5kZXN0cm95ID0gY3JlYXRlRGVidWcuZGVzdHJveTsgLy8gWFhYIFRlbXBvcmFyeS4gV2lsbCBiZSByZW1vdmVkIGluIHRoZSBuZXh0IG1ham9yIHJlbGVhc2UuXG5cblx0XHRPYmplY3QuZGVmaW5lUHJvcGVydHkoZGVidWcsICdlbmFibGVkJywge1xuXHRcdFx0ZW51bWVyYWJsZTogdHJ1ZSxcblx0XHRcdGNvbmZpZ3VyYWJsZTogZmFsc2UsXG5cdFx0XHRnZXQ6ICgpID0+IHtcblx0XHRcdFx0aWYgKGVuYWJsZU92ZXJyaWRlICE9PSBudWxsKSB7XG5cdFx0XHRcdFx0cmV0dXJuIGVuYWJsZU92ZXJyaWRlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmIChuYW1lc3BhY2VzQ2FjaGUgIT09IGNyZWF0ZURlYnVnLm5hbWVzcGFjZXMpIHtcblx0XHRcdFx0XHRuYW1lc3BhY2VzQ2FjaGUgPSBjcmVhdGVEZWJ1Zy5uYW1lc3BhY2VzO1xuXHRcdFx0XHRcdGVuYWJsZWRDYWNoZSA9IGNyZWF0ZURlYnVnLmVuYWJsZWQobmFtZXNwYWNlKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHJldHVybiBlbmFibGVkQ2FjaGU7XG5cdFx0XHR9LFxuXHRcdFx0c2V0OiB2ID0+IHtcblx0XHRcdFx0ZW5hYmxlT3ZlcnJpZGUgPSB2O1xuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdFx0Ly8gRW52LXNwZWNpZmljIGluaXRpYWxpemF0aW9uIGxvZ2ljIGZvciBkZWJ1ZyBpbnN0YW5jZXNcblx0XHRpZiAodHlwZW9mIGNyZWF0ZURlYnVnLmluaXQgPT09ICdmdW5jdGlvbicpIHtcblx0XHRcdGNyZWF0ZURlYnVnLmluaXQoZGVidWcpO1xuXHRcdH1cblxuXHRcdHJldHVybiBkZWJ1Zztcblx0fVxuXG5cdGZ1bmN0aW9uIGV4dGVuZChuYW1lc3BhY2UsIGRlbGltaXRlcikge1xuXHRcdGNvbnN0IG5ld0RlYnVnID0gY3JlYXRlRGVidWcodGhpcy5uYW1lc3BhY2UgKyAodHlwZW9mIGRlbGltaXRlciA9PT0gJ3VuZGVmaW5lZCcgPyAnOicgOiBkZWxpbWl0ZXIpICsgbmFtZXNwYWNlKTtcblx0XHRuZXdEZWJ1Zy5sb2cgPSB0aGlzLmxvZztcblx0XHRyZXR1cm4gbmV3RGVidWc7XG5cdH1cblxuXHQvKipcblx0KiBFbmFibGVzIGEgZGVidWcgbW9kZSBieSBuYW1lc3BhY2VzLiBUaGlzIGNhbiBpbmNsdWRlIG1vZGVzXG5cdCogc2VwYXJhdGVkIGJ5IGEgY29sb24gYW5kIHdpbGRjYXJkcy5cblx0KlxuXHQqIEBwYXJhbSB7U3RyaW5nfSBuYW1lc3BhY2VzXG5cdCogQGFwaSBwdWJsaWNcblx0Ki9cblx0ZnVuY3Rpb24gZW5hYmxlKG5hbWVzcGFjZXMpIHtcblx0XHRjcmVhdGVEZWJ1Zy5zYXZlKG5hbWVzcGFjZXMpO1xuXHRcdGNyZWF0ZURlYnVnLm5hbWVzcGFjZXMgPSBuYW1lc3BhY2VzO1xuXG5cdFx0Y3JlYXRlRGVidWcubmFtZXMgPSBbXTtcblx0XHRjcmVhdGVEZWJ1Zy5za2lwcyA9IFtdO1xuXG5cdFx0Y29uc3Qgc3BsaXQgPSAodHlwZW9mIG5hbWVzcGFjZXMgPT09ICdzdHJpbmcnID8gbmFtZXNwYWNlcyA6ICcnKVxuXHRcdFx0LnRyaW0oKVxuXHRcdFx0LnJlcGxhY2UoL1xccysvZywgJywnKVxuXHRcdFx0LnNwbGl0KCcsJylcblx0XHRcdC5maWx0ZXIoQm9vbGVhbik7XG5cblx0XHRmb3IgKGNvbnN0IG5zIG9mIHNwbGl0KSB7XG5cdFx0XHRpZiAobnNbMF0gPT09ICctJykge1xuXHRcdFx0XHRjcmVhdGVEZWJ1Zy5za2lwcy5wdXNoKG5zLnNsaWNlKDEpKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGNyZWF0ZURlYnVnLm5hbWVzLnB1c2gobnMpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdC8qKlxuXHQgKiBDaGVja3MgaWYgdGhlIGdpdmVuIHN0cmluZyBtYXRjaGVzIGEgbmFtZXNwYWNlIHRlbXBsYXRlLCBob25vcmluZ1xuXHQgKiBhc3Rlcmlza3MgYXMgd2lsZGNhcmRzLlxuXHQgKlxuXHQgKiBAcGFyYW0ge1N0cmluZ30gc2VhcmNoXG5cdCAqIEBwYXJhbSB7U3RyaW5nfSB0ZW1wbGF0ZVxuXHQgKiBAcmV0dXJuIHtCb29sZWFufVxuXHQgKi9cblx0ZnVuY3Rpb24gbWF0Y2hlc1RlbXBsYXRlKHNlYXJjaCwgdGVtcGxhdGUpIHtcblx0XHRsZXQgc2VhcmNoSW5kZXggPSAwO1xuXHRcdGxldCB0ZW1wbGF0ZUluZGV4ID0gMDtcblx0XHRsZXQgc3RhckluZGV4ID0gLTE7XG5cdFx0bGV0IG1hdGNoSW5kZXggPSAwO1xuXG5cdFx0d2hpbGUgKHNlYXJjaEluZGV4IDwgc2VhcmNoLmxlbmd0aCkge1xuXHRcdFx0aWYgKHRlbXBsYXRlSW5kZXggPCB0ZW1wbGF0ZS5sZW5ndGggJiYgKHRlbXBsYXRlW3RlbXBsYXRlSW5kZXhdID09PSBzZWFyY2hbc2VhcmNoSW5kZXhdIHx8IHRlbXBsYXRlW3RlbXBsYXRlSW5kZXhdID09PSAnKicpKSB7XG5cdFx0XHRcdC8vIE1hdGNoIGNoYXJhY3RlciBvciBwcm9jZWVkIHdpdGggd2lsZGNhcmRcblx0XHRcdFx0aWYgKHRlbXBsYXRlW3RlbXBsYXRlSW5kZXhdID09PSAnKicpIHtcblx0XHRcdFx0XHRzdGFySW5kZXggPSB0ZW1wbGF0ZUluZGV4O1xuXHRcdFx0XHRcdG1hdGNoSW5kZXggPSBzZWFyY2hJbmRleDtcblx0XHRcdFx0XHR0ZW1wbGF0ZUluZGV4Kys7IC8vIFNraXAgdGhlICcqJ1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHNlYXJjaEluZGV4Kys7XG5cdFx0XHRcdFx0dGVtcGxhdGVJbmRleCsrO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2UgaWYgKHN0YXJJbmRleCAhPT0gLTEpIHsgLy8gZXNsaW50LWRpc2FibGUtbGluZSBuby1uZWdhdGVkLWNvbmRpdGlvblxuXHRcdFx0XHQvLyBCYWNrdHJhY2sgdG8gdGhlIGxhc3QgJyonIGFuZCB0cnkgdG8gbWF0Y2ggbW9yZSBjaGFyYWN0ZXJzXG5cdFx0XHRcdHRlbXBsYXRlSW5kZXggPSBzdGFySW5kZXggKyAxO1xuXHRcdFx0XHRtYXRjaEluZGV4Kys7XG5cdFx0XHRcdHNlYXJjaEluZGV4ID0gbWF0Y2hJbmRleDtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHJldHVybiBmYWxzZTsgLy8gTm8gbWF0Y2hcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBIYW5kbGUgdHJhaWxpbmcgJyonIGluIHRlbXBsYXRlXG5cdFx0d2hpbGUgKHRlbXBsYXRlSW5kZXggPCB0ZW1wbGF0ZS5sZW5ndGggJiYgdGVtcGxhdGVbdGVtcGxhdGVJbmRleF0gPT09ICcqJykge1xuXHRcdFx0dGVtcGxhdGVJbmRleCsrO1xuXHRcdH1cblxuXHRcdHJldHVybiB0ZW1wbGF0ZUluZGV4ID09PSB0ZW1wbGF0ZS5sZW5ndGg7XG5cdH1cblxuXHQvKipcblx0KiBEaXNhYmxlIGRlYnVnIG91dHB1dC5cblx0KlxuXHQqIEByZXR1cm4ge1N0cmluZ30gbmFtZXNwYWNlc1xuXHQqIEBhcGkgcHVibGljXG5cdCovXG5cdGZ1bmN0aW9uIGRpc2FibGUoKSB7XG5cdFx0Y29uc3QgbmFtZXNwYWNlcyA9IFtcblx0XHRcdC4uLmNyZWF0ZURlYnVnLm5hbWVzLFxuXHRcdFx0Li4uY3JlYXRlRGVidWcuc2tpcHMubWFwKG5hbWVzcGFjZSA9PiAnLScgKyBuYW1lc3BhY2UpXG5cdFx0XS5qb2luKCcsJyk7XG5cdFx0Y3JlYXRlRGVidWcuZW5hYmxlKCcnKTtcblx0XHRyZXR1cm4gbmFtZXNwYWNlcztcblx0fVxuXG5cdC8qKlxuXHQqIFJldHVybnMgdHJ1ZSBpZiB0aGUgZ2l2ZW4gbW9kZSBuYW1lIGlzIGVuYWJsZWQsIGZhbHNlIG90aGVyd2lzZS5cblx0KlxuXHQqIEBwYXJhbSB7U3RyaW5nfSBuYW1lXG5cdCogQHJldHVybiB7Qm9vbGVhbn1cblx0KiBAYXBpIHB1YmxpY1xuXHQqL1xuXHRmdW5jdGlvbiBlbmFibGVkKG5hbWUpIHtcblx0XHRmb3IgKGNvbnN0IHNraXAgb2YgY3JlYXRlRGVidWcuc2tpcHMpIHtcblx0XHRcdGlmIChtYXRjaGVzVGVtcGxhdGUobmFtZSwgc2tpcCkpIHtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGZvciAoY29uc3QgbnMgb2YgY3JlYXRlRGVidWcubmFtZXMpIHtcblx0XHRcdGlmIChtYXRjaGVzVGVtcGxhdGUobmFtZSwgbnMpKSB7XG5cdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXG5cdC8qKlxuXHQqIENvZXJjZSBgdmFsYC5cblx0KlxuXHQqIEBwYXJhbSB7TWl4ZWR9IHZhbFxuXHQqIEByZXR1cm4ge01peGVkfVxuXHQqIEBhcGkgcHJpdmF0ZVxuXHQqL1xuXHRmdW5jdGlvbiBjb2VyY2UodmFsKSB7XG5cdFx0aWYgKHZhbCBpbnN0YW5jZW9mIEVycm9yKSB7XG5cdFx0XHRyZXR1cm4gdmFsLnN0YWNrIHx8IHZhbC5tZXNzYWdlO1xuXHRcdH1cblx0XHRyZXR1cm4gdmFsO1xuXHR9XG5cblx0LyoqXG5cdCogWFhYIERPIE5PVCBVU0UuIFRoaXMgaXMgYSB0ZW1wb3Jhcnkgc3R1YiBmdW5jdGlvbi5cblx0KiBYWFggSXQgV0lMTCBiZSByZW1vdmVkIGluIHRoZSBuZXh0IG1ham9yIHJlbGVhc2UuXG5cdCovXG5cdGZ1bmN0aW9uIGRlc3Ryb3koKSB7XG5cdFx0Y29uc29sZS53YXJuKCdJbnN0YW5jZSBtZXRob2QgYGRlYnVnLmRlc3Ryb3koKWAgaXMgZGVwcmVjYXRlZCBhbmQgbm8gbG9uZ2VyIGRvZXMgYW55dGhpbmcuIEl0IHdpbGwgYmUgcmVtb3ZlZCBpbiB0aGUgbmV4dCBtYWpvciB2ZXJzaW9uIG9mIGBkZWJ1Z2AuJyk7XG5cdH1cblxuXHRjcmVhdGVEZWJ1Zy5lbmFibGUoY3JlYXRlRGVidWcubG9hZCgpKTtcblxuXHRyZXR1cm4gY3JlYXRlRGVidWc7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gc2V0dXA7XG4iLAogICAgIi8qIGVzbGludC1lbnYgYnJvd3NlciAqL1xuXG4vKipcbiAqIFRoaXMgaXMgdGhlIHdlYiBicm93c2VyIGltcGxlbWVudGF0aW9uIG9mIGBkZWJ1ZygpYC5cbiAqL1xuXG5leHBvcnRzLmZvcm1hdEFyZ3MgPSBmb3JtYXRBcmdzO1xuZXhwb3J0cy5zYXZlID0gc2F2ZTtcbmV4cG9ydHMubG9hZCA9IGxvYWQ7XG5leHBvcnRzLnVzZUNvbG9ycyA9IHVzZUNvbG9ycztcbmV4cG9ydHMuc3RvcmFnZSA9IGxvY2Fsc3RvcmFnZSgpO1xuZXhwb3J0cy5kZXN0cm95ID0gKCgpID0+IHtcblx0bGV0IHdhcm5lZCA9IGZhbHNlO1xuXG5cdHJldHVybiAoKSA9PiB7XG5cdFx0aWYgKCF3YXJuZWQpIHtcblx0XHRcdHdhcm5lZCA9IHRydWU7XG5cdFx0XHRjb25zb2xlLndhcm4oJ0luc3RhbmNlIG1ldGhvZCBgZGVidWcuZGVzdHJveSgpYCBpcyBkZXByZWNhdGVkIGFuZCBubyBsb25nZXIgZG9lcyBhbnl0aGluZy4gSXQgd2lsbCBiZSByZW1vdmVkIGluIHRoZSBuZXh0IG1ham9yIHZlcnNpb24gb2YgYGRlYnVnYC4nKTtcblx0XHR9XG5cdH07XG59KSgpO1xuXG4vKipcbiAqIENvbG9ycy5cbiAqL1xuXG5leHBvcnRzLmNvbG9ycyA9IFtcblx0JyMwMDAwQ0MnLFxuXHQnIzAwMDBGRicsXG5cdCcjMDAzM0NDJyxcblx0JyMwMDMzRkYnLFxuXHQnIzAwNjZDQycsXG5cdCcjMDA2NkZGJyxcblx0JyMwMDk5Q0MnLFxuXHQnIzAwOTlGRicsXG5cdCcjMDBDQzAwJyxcblx0JyMwMENDMzMnLFxuXHQnIzAwQ0M2NicsXG5cdCcjMDBDQzk5Jyxcblx0JyMwMENDQ0MnLFxuXHQnIzAwQ0NGRicsXG5cdCcjMzMwMENDJyxcblx0JyMzMzAwRkYnLFxuXHQnIzMzMzNDQycsXG5cdCcjMzMzM0ZGJyxcblx0JyMzMzY2Q0MnLFxuXHQnIzMzNjZGRicsXG5cdCcjMzM5OUNDJyxcblx0JyMzMzk5RkYnLFxuXHQnIzMzQ0MwMCcsXG5cdCcjMzNDQzMzJyxcblx0JyMzM0NDNjYnLFxuXHQnIzMzQ0M5OScsXG5cdCcjMzNDQ0NDJyxcblx0JyMzM0NDRkYnLFxuXHQnIzY2MDBDQycsXG5cdCcjNjYwMEZGJyxcblx0JyM2NjMzQ0MnLFxuXHQnIzY2MzNGRicsXG5cdCcjNjZDQzAwJyxcblx0JyM2NkNDMzMnLFxuXHQnIzk5MDBDQycsXG5cdCcjOTkwMEZGJyxcblx0JyM5OTMzQ0MnLFxuXHQnIzk5MzNGRicsXG5cdCcjOTlDQzAwJyxcblx0JyM5OUNDMzMnLFxuXHQnI0NDMDAwMCcsXG5cdCcjQ0MwMDMzJyxcblx0JyNDQzAwNjYnLFxuXHQnI0NDMDA5OScsXG5cdCcjQ0MwMENDJyxcblx0JyNDQzAwRkYnLFxuXHQnI0NDMzMwMCcsXG5cdCcjQ0MzMzMzJyxcblx0JyNDQzMzNjYnLFxuXHQnI0NDMzM5OScsXG5cdCcjQ0MzM0NDJyxcblx0JyNDQzMzRkYnLFxuXHQnI0NDNjYwMCcsXG5cdCcjQ0M2NjMzJyxcblx0JyNDQzk5MDAnLFxuXHQnI0NDOTkzMycsXG5cdCcjQ0NDQzAwJyxcblx0JyNDQ0NDMzMnLFxuXHQnI0ZGMDAwMCcsXG5cdCcjRkYwMDMzJyxcblx0JyNGRjAwNjYnLFxuXHQnI0ZGMDA5OScsXG5cdCcjRkYwMENDJyxcblx0JyNGRjAwRkYnLFxuXHQnI0ZGMzMwMCcsXG5cdCcjRkYzMzMzJyxcblx0JyNGRjMzNjYnLFxuXHQnI0ZGMzM5OScsXG5cdCcjRkYzM0NDJyxcblx0JyNGRjMzRkYnLFxuXHQnI0ZGNjYwMCcsXG5cdCcjRkY2NjMzJyxcblx0JyNGRjk5MDAnLFxuXHQnI0ZGOTkzMycsXG5cdCcjRkZDQzAwJyxcblx0JyNGRkNDMzMnXG5dO1xuXG4vKipcbiAqIEN1cnJlbnRseSBvbmx5IFdlYktpdC1iYXNlZCBXZWIgSW5zcGVjdG9ycywgRmlyZWZveCA+PSB2MzEsXG4gKiBhbmQgdGhlIEZpcmVidWcgZXh0ZW5zaW9uIChhbnkgRmlyZWZveCB2ZXJzaW9uKSBhcmUga25vd25cbiAqIHRvIHN1cHBvcnQgXCIlY1wiIENTUyBjdXN0b21pemF0aW9ucy5cbiAqXG4gKiBUT0RPOiBhZGQgYSBgbG9jYWxTdG9yYWdlYCB2YXJpYWJsZSB0byBleHBsaWNpdGx5IGVuYWJsZS9kaXNhYmxlIGNvbG9yc1xuICovXG5cbi8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBjb21wbGV4aXR5XG5mdW5jdGlvbiB1c2VDb2xvcnMoKSB7XG5cdC8vIE5COiBJbiBhbiBFbGVjdHJvbiBwcmVsb2FkIHNjcmlwdCwgZG9jdW1lbnQgd2lsbCBiZSBkZWZpbmVkIGJ1dCBub3QgZnVsbHlcblx0Ly8gaW5pdGlhbGl6ZWQuIFNpbmNlIHdlIGtub3cgd2UncmUgaW4gQ2hyb21lLCB3ZSdsbCBqdXN0IGRldGVjdCB0aGlzIGNhc2Vcblx0Ly8gZXhwbGljaXRseVxuXHRpZiAodHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcgJiYgd2luZG93LnByb2Nlc3MgJiYgKHdpbmRvdy5wcm9jZXNzLnR5cGUgPT09ICdyZW5kZXJlcicgfHwgd2luZG93LnByb2Nlc3MuX19ud2pzKSkge1xuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cblx0Ly8gSW50ZXJuZXQgRXhwbG9yZXIgYW5kIEVkZ2UgZG8gbm90IHN1cHBvcnQgY29sb3JzLlxuXHRpZiAodHlwZW9mIG5hdmlnYXRvciAhPT0gJ3VuZGVmaW5lZCcgJiYgbmF2aWdhdG9yLnVzZXJBZ2VudCAmJiBuYXZpZ2F0b3IudXNlckFnZW50LnRvTG93ZXJDYXNlKCkubWF0Y2goLyhlZGdlfHRyaWRlbnQpXFwvKFxcZCspLykpIHtcblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cblxuXHRsZXQgbTtcblxuXHQvLyBJcyB3ZWJraXQ/IGh0dHA6Ly9zdGFja292ZXJmbG93LmNvbS9hLzE2NDU5NjA2LzM3Njc3M1xuXHQvLyBkb2N1bWVudCBpcyB1bmRlZmluZWQgaW4gcmVhY3QtbmF0aXZlOiBodHRwczovL2dpdGh1Yi5jb20vZmFjZWJvb2svcmVhY3QtbmF0aXZlL3B1bGwvMTYzMlxuXHQvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbm8tcmV0dXJuLWFzc2lnblxuXHRyZXR1cm4gKHR5cGVvZiBkb2N1bWVudCAhPT0gJ3VuZGVmaW5lZCcgJiYgZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50ICYmIGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5zdHlsZSAmJiBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuc3R5bGUuV2Via2l0QXBwZWFyYW5jZSkgfHxcblx0XHQvLyBJcyBmaXJlYnVnPyBodHRwOi8vc3RhY2tvdmVyZmxvdy5jb20vYS8zOTgxMjAvMzc2NzczXG5cdFx0KHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnICYmIHdpbmRvdy5jb25zb2xlICYmICh3aW5kb3cuY29uc29sZS5maXJlYnVnIHx8ICh3aW5kb3cuY29uc29sZS5leGNlcHRpb24gJiYgd2luZG93LmNvbnNvbGUudGFibGUpKSkgfHxcblx0XHQvLyBJcyBmaXJlZm94ID49IHYzMT9cblx0XHQvLyBodHRwczovL2RldmVsb3Blci5tb3ppbGxhLm9yZy9lbi1VUy9kb2NzL1Rvb2xzL1dlYl9Db25zb2xlI1N0eWxpbmdfbWVzc2FnZXNcblx0XHQodHlwZW9mIG5hdmlnYXRvciAhPT0gJ3VuZGVmaW5lZCcgJiYgbmF2aWdhdG9yLnVzZXJBZ2VudCAmJiAobSA9IG5hdmlnYXRvci51c2VyQWdlbnQudG9Mb3dlckNhc2UoKS5tYXRjaCgvZmlyZWZveFxcLyhcXGQrKS8pKSAmJiBwYXJzZUludChtWzFdLCAxMCkgPj0gMzEpIHx8XG5cdFx0Ly8gRG91YmxlIGNoZWNrIHdlYmtpdCBpbiB1c2VyQWdlbnQganVzdCBpbiBjYXNlIHdlIGFyZSBpbiBhIHdvcmtlclxuXHRcdCh0eXBlb2YgbmF2aWdhdG9yICE9PSAndW5kZWZpbmVkJyAmJiBuYXZpZ2F0b3IudXNlckFnZW50ICYmIG5hdmlnYXRvci51c2VyQWdlbnQudG9Mb3dlckNhc2UoKS5tYXRjaCgvYXBwbGV3ZWJraXRcXC8oXFxkKykvKSk7XG59XG5cbi8qKlxuICogQ29sb3JpemUgbG9nIGFyZ3VtZW50cyBpZiBlbmFibGVkLlxuICpcbiAqIEBhcGkgcHVibGljXG4gKi9cblxuZnVuY3Rpb24gZm9ybWF0QXJncyhhcmdzKSB7XG5cdGFyZ3NbMF0gPSAodGhpcy51c2VDb2xvcnMgPyAnJWMnIDogJycpICtcblx0XHR0aGlzLm5hbWVzcGFjZSArXG5cdFx0KHRoaXMudXNlQ29sb3JzID8gJyAlYycgOiAnICcpICtcblx0XHRhcmdzWzBdICtcblx0XHQodGhpcy51c2VDb2xvcnMgPyAnJWMgJyA6ICcgJykgK1xuXHRcdCcrJyArIG1vZHVsZS5leHBvcnRzLmh1bWFuaXplKHRoaXMuZGlmZik7XG5cblx0aWYgKCF0aGlzLnVzZUNvbG9ycykge1xuXHRcdHJldHVybjtcblx0fVxuXG5cdGNvbnN0IGMgPSAnY29sb3I6ICcgKyB0aGlzLmNvbG9yO1xuXHRhcmdzLnNwbGljZSgxLCAwLCBjLCAnY29sb3I6IGluaGVyaXQnKTtcblxuXHQvLyBUaGUgZmluYWwgXCIlY1wiIGlzIHNvbWV3aGF0IHRyaWNreSwgYmVjYXVzZSB0aGVyZSBjb3VsZCBiZSBvdGhlclxuXHQvLyBhcmd1bWVudHMgcGFzc2VkIGVpdGhlciBiZWZvcmUgb3IgYWZ0ZXIgdGhlICVjLCBzbyB3ZSBuZWVkIHRvXG5cdC8vIGZpZ3VyZSBvdXQgdGhlIGNvcnJlY3QgaW5kZXggdG8gaW5zZXJ0IHRoZSBDU1MgaW50b1xuXHRsZXQgaW5kZXggPSAwO1xuXHRsZXQgbGFzdEMgPSAwO1xuXHRhcmdzWzBdLnJlcGxhY2UoLyVbYS16QS1aJV0vZywgbWF0Y2ggPT4ge1xuXHRcdGlmIChtYXRjaCA9PT0gJyUlJykge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRpbmRleCsrO1xuXHRcdGlmIChtYXRjaCA9PT0gJyVjJykge1xuXHRcdFx0Ly8gV2Ugb25seSBhcmUgaW50ZXJlc3RlZCBpbiB0aGUgKmxhc3QqICVjXG5cdFx0XHQvLyAodGhlIHVzZXIgbWF5IGhhdmUgcHJvdmlkZWQgdGhlaXIgb3duKVxuXHRcdFx0bGFzdEMgPSBpbmRleDtcblx0XHR9XG5cdH0pO1xuXG5cdGFyZ3Muc3BsaWNlKGxhc3RDLCAwLCBjKTtcbn1cblxuLyoqXG4gKiBJbnZva2VzIGBjb25zb2xlLmRlYnVnKClgIHdoZW4gYXZhaWxhYmxlLlxuICogTm8tb3Agd2hlbiBgY29uc29sZS5kZWJ1Z2AgaXMgbm90IGEgXCJmdW5jdGlvblwiLlxuICogSWYgYGNvbnNvbGUuZGVidWdgIGlzIG5vdCBhdmFpbGFibGUsIGZhbGxzIGJhY2tcbiAqIHRvIGBjb25zb2xlLmxvZ2AuXG4gKlxuICogQGFwaSBwdWJsaWNcbiAqL1xuZXhwb3J0cy5sb2cgPSBjb25zb2xlLmRlYnVnIHx8IGNvbnNvbGUubG9nIHx8ICgoKSA9PiB7fSk7XG5cbi8qKlxuICogU2F2ZSBgbmFtZXNwYWNlc2AuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IG5hbWVzcGFjZXNcbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5mdW5jdGlvbiBzYXZlKG5hbWVzcGFjZXMpIHtcblx0dHJ5IHtcblx0XHRpZiAobmFtZXNwYWNlcykge1xuXHRcdFx0ZXhwb3J0cy5zdG9yYWdlLnNldEl0ZW0oJ2RlYnVnJywgbmFtZXNwYWNlcyk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGV4cG9ydHMuc3RvcmFnZS5yZW1vdmVJdGVtKCdkZWJ1ZycpO1xuXHRcdH1cblx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHQvLyBTd2FsbG93XG5cdFx0Ly8gWFhYIChAUWl4LSkgc2hvdWxkIHdlIGJlIGxvZ2dpbmcgdGhlc2U/XG5cdH1cbn1cblxuLyoqXG4gKiBMb2FkIGBuYW1lc3BhY2VzYC5cbiAqXG4gKiBAcmV0dXJuIHtTdHJpbmd9IHJldHVybnMgdGhlIHByZXZpb3VzbHkgcGVyc2lzdGVkIGRlYnVnIG1vZGVzXG4gKiBAYXBpIHByaXZhdGVcbiAqL1xuZnVuY3Rpb24gbG9hZCgpIHtcblx0bGV0IHI7XG5cdHRyeSB7XG5cdFx0ciA9IGV4cG9ydHMuc3RvcmFnZS5nZXRJdGVtKCdkZWJ1ZycpIHx8IGV4cG9ydHMuc3RvcmFnZS5nZXRJdGVtKCdERUJVRycpIDtcblx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHQvLyBTd2FsbG93XG5cdFx0Ly8gWFhYIChAUWl4LSkgc2hvdWxkIHdlIGJlIGxvZ2dpbmcgdGhlc2U/XG5cdH1cblxuXHQvLyBJZiBkZWJ1ZyBpc24ndCBzZXQgaW4gTFMsIGFuZCB3ZSdyZSBpbiBFbGVjdHJvbiwgdHJ5IHRvIGxvYWQgJERFQlVHXG5cdGlmICghciAmJiB0eXBlb2YgcHJvY2VzcyAhPT0gJ3VuZGVmaW5lZCcgJiYgJ2VudicgaW4gcHJvY2Vzcykge1xuXHRcdHIgPSBwcm9jZXNzLmVudi5ERUJVRztcblx0fVxuXG5cdHJldHVybiByO1xufVxuXG4vKipcbiAqIExvY2Fsc3RvcmFnZSBhdHRlbXB0cyB0byByZXR1cm4gdGhlIGxvY2Fsc3RvcmFnZS5cbiAqXG4gKiBUaGlzIGlzIG5lY2Vzc2FyeSBiZWNhdXNlIHNhZmFyaSB0aHJvd3NcbiAqIHdoZW4gYSB1c2VyIGRpc2FibGVzIGNvb2tpZXMvbG9jYWxzdG9yYWdlXG4gKiBhbmQgeW91IGF0dGVtcHQgdG8gYWNjZXNzIGl0LlxuICpcbiAqIEByZXR1cm4ge0xvY2FsU3RvcmFnZX1cbiAqIEBhcGkgcHJpdmF0ZVxuICovXG5cbmZ1bmN0aW9uIGxvY2Fsc3RvcmFnZSgpIHtcblx0dHJ5IHtcblx0XHQvLyBUVk1MS2l0IChBcHBsZSBUViBKUyBSdW50aW1lKSBkb2VzIG5vdCBoYXZlIGEgd2luZG93IG9iamVjdCwganVzdCBsb2NhbFN0b3JhZ2UgaW4gdGhlIGdsb2JhbCBjb250ZXh0XG5cdFx0Ly8gVGhlIEJyb3dzZXIgYWxzbyBoYXMgbG9jYWxTdG9yYWdlIGluIHRoZSBnbG9iYWwgY29udGV4dC5cblx0XHRyZXR1cm4gbG9jYWxTdG9yYWdlO1xuXHR9IGNhdGNoIChlcnJvcikge1xuXHRcdC8vIFN3YWxsb3dcblx0XHQvLyBYWFggKEBRaXgtKSBzaG91bGQgd2UgYmUgbG9nZ2luZyB0aGVzZT9cblx0fVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHJlcXVpcmUoJy4vY29tbW9uJykoZXhwb3J0cyk7XG5cbmNvbnN0IHtmb3JtYXR0ZXJzfSA9IG1vZHVsZS5leHBvcnRzO1xuXG4vKipcbiAqIE1hcCAlaiB0byBgSlNPTi5zdHJpbmdpZnkoKWAsIHNpbmNlIG5vIFdlYiBJbnNwZWN0b3JzIGRvIHRoYXQgYnkgZGVmYXVsdC5cbiAqL1xuXG5mb3JtYXR0ZXJzLmogPSBmdW5jdGlvbiAodikge1xuXHR0cnkge1xuXHRcdHJldHVybiBKU09OLnN0cmluZ2lmeSh2KTtcblx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRyZXR1cm4gJ1tVbmV4cGVjdGVkSlNPTlBhcnNlRXJyb3JdOiAnICsgZXJyb3IubWVzc2FnZTtcblx0fVxufTtcbiIsCiAgICAiLyohIGllZWU3NTQuIEJTRC0zLUNsYXVzZSBMaWNlbnNlLiBGZXJvc3MgQWJvdWtoYWRpamVoIDxodHRwczovL2Zlcm9zcy5vcmcvb3BlbnNvdXJjZT4gKi9cbmV4cG9ydHMucmVhZCA9IGZ1bmN0aW9uIChidWZmZXIsIG9mZnNldCwgaXNMRSwgbUxlbiwgbkJ5dGVzKSB7XG4gIHZhciBlLCBtXG4gIHZhciBlTGVuID0gKG5CeXRlcyAqIDgpIC0gbUxlbiAtIDFcbiAgdmFyIGVNYXggPSAoMSA8PCBlTGVuKSAtIDFcbiAgdmFyIGVCaWFzID0gZU1heCA+PiAxXG4gIHZhciBuQml0cyA9IC03XG4gIHZhciBpID0gaXNMRSA/IChuQnl0ZXMgLSAxKSA6IDBcbiAgdmFyIGQgPSBpc0xFID8gLTEgOiAxXG4gIHZhciBzID0gYnVmZmVyW29mZnNldCArIGldXG5cbiAgaSArPSBkXG5cbiAgZSA9IHMgJiAoKDEgPDwgKC1uQml0cykpIC0gMSlcbiAgcyA+Pj0gKC1uQml0cylcbiAgbkJpdHMgKz0gZUxlblxuICBmb3IgKDsgbkJpdHMgPiAwOyBlID0gKGUgKiAyNTYpICsgYnVmZmVyW29mZnNldCArIGldLCBpICs9IGQsIG5CaXRzIC09IDgpIHt9XG5cbiAgbSA9IGUgJiAoKDEgPDwgKC1uQml0cykpIC0gMSlcbiAgZSA+Pj0gKC1uQml0cylcbiAgbkJpdHMgKz0gbUxlblxuICBmb3IgKDsgbkJpdHMgPiAwOyBtID0gKG0gKiAyNTYpICsgYnVmZmVyW29mZnNldCArIGldLCBpICs9IGQsIG5CaXRzIC09IDgpIHt9XG5cbiAgaWYgKGUgPT09IDApIHtcbiAgICBlID0gMSAtIGVCaWFzXG4gIH0gZWxzZSBpZiAoZSA9PT0gZU1heCkge1xuICAgIHJldHVybiBtID8gTmFOIDogKChzID8gLTEgOiAxKSAqIEluZmluaXR5KVxuICB9IGVsc2Uge1xuICAgIG0gPSBtICsgTWF0aC5wb3coMiwgbUxlbilcbiAgICBlID0gZSAtIGVCaWFzXG4gIH1cbiAgcmV0dXJuIChzID8gLTEgOiAxKSAqIG0gKiBNYXRoLnBvdygyLCBlIC0gbUxlbilcbn1cblxuZXhwb3J0cy53cml0ZSA9IGZ1bmN0aW9uIChidWZmZXIsIHZhbHVlLCBvZmZzZXQsIGlzTEUsIG1MZW4sIG5CeXRlcykge1xuICB2YXIgZSwgbSwgY1xuICB2YXIgZUxlbiA9IChuQnl0ZXMgKiA4KSAtIG1MZW4gLSAxXG4gIHZhciBlTWF4ID0gKDEgPDwgZUxlbikgLSAxXG4gIHZhciBlQmlhcyA9IGVNYXggPj4gMVxuICB2YXIgcnQgPSAobUxlbiA9PT0gMjMgPyBNYXRoLnBvdygyLCAtMjQpIC0gTWF0aC5wb3coMiwgLTc3KSA6IDApXG4gIHZhciBpID0gaXNMRSA/IDAgOiAobkJ5dGVzIC0gMSlcbiAgdmFyIGQgPSBpc0xFID8gMSA6IC0xXG4gIHZhciBzID0gdmFsdWUgPCAwIHx8ICh2YWx1ZSA9PT0gMCAmJiAxIC8gdmFsdWUgPCAwKSA/IDEgOiAwXG5cbiAgdmFsdWUgPSBNYXRoLmFicyh2YWx1ZSlcblxuICBpZiAoaXNOYU4odmFsdWUpIHx8IHZhbHVlID09PSBJbmZpbml0eSkge1xuICAgIG0gPSBpc05hTih2YWx1ZSkgPyAxIDogMFxuICAgIGUgPSBlTWF4XG4gIH0gZWxzZSB7XG4gICAgZSA9IE1hdGguZmxvb3IoTWF0aC5sb2codmFsdWUpIC8gTWF0aC5MTjIpXG4gICAgaWYgKHZhbHVlICogKGMgPSBNYXRoLnBvdygyLCAtZSkpIDwgMSkge1xuICAgICAgZS0tXG4gICAgICBjICo9IDJcbiAgICB9XG4gICAgaWYgKGUgKyBlQmlhcyA+PSAxKSB7XG4gICAgICB2YWx1ZSArPSBydCAvIGNcbiAgICB9IGVsc2Uge1xuICAgICAgdmFsdWUgKz0gcnQgKiBNYXRoLnBvdygyLCAxIC0gZUJpYXMpXG4gICAgfVxuICAgIGlmICh2YWx1ZSAqIGMgPj0gMikge1xuICAgICAgZSsrXG4gICAgICBjIC89IDJcbiAgICB9XG5cbiAgICBpZiAoZSArIGVCaWFzID49IGVNYXgpIHtcbiAgICAgIG0gPSAwXG4gICAgICBlID0gZU1heFxuICAgIH0gZWxzZSBpZiAoZSArIGVCaWFzID49IDEpIHtcbiAgICAgIG0gPSAoKHZhbHVlICogYykgLSAxKSAqIE1hdGgucG93KDIsIG1MZW4pXG4gICAgICBlID0gZSArIGVCaWFzXG4gICAgfSBlbHNlIHtcbiAgICAgIG0gPSB2YWx1ZSAqIE1hdGgucG93KDIsIGVCaWFzIC0gMSkgKiBNYXRoLnBvdygyLCBtTGVuKVxuICAgICAgZSA9IDBcbiAgICB9XG4gIH1cblxuICBmb3IgKDsgbUxlbiA+PSA4OyBidWZmZXJbb2Zmc2V0ICsgaV0gPSBtICYgMHhmZiwgaSArPSBkLCBtIC89IDI1NiwgbUxlbiAtPSA4KSB7fVxuXG4gIGUgPSAoZSA8PCBtTGVuKSB8IG1cbiAgZUxlbiArPSBtTGVuXG4gIGZvciAoOyBlTGVuID4gMDsgYnVmZmVyW29mZnNldCArIGldID0gZSAmIDB4ZmYsIGkgKz0gZCwgZSAvPSAyNTYsIGVMZW4gLT0gOCkge31cblxuICBidWZmZXJbb2Zmc2V0ICsgaSAtIGRdIHw9IHMgKiAxMjhcbn1cbiIsCiAgICAiLy8gdGV4dC1wb2x5ZmlsbC50c1xuLy8gTWluaW1hbCBlbmNvZGUvZGVjb2RlIGZvciB1dGYtOCwgdXRmLTE2bGUsIGFzY2lpLCBsYXRpbjEsIHdpbmRvd3MtMTI1MlxuY29uc3QgV0lORE9XU18xMjUyX0VYVFJBID0ge1xuICAgIDB4ODA6IFwi4oKsXCIsIDB4ODI6IFwi4oCaXCIsIDB4ODM6IFwixpJcIiwgMHg4NDogXCLigJ5cIiwgMHg4NTogXCLigKZcIiwgMHg4NjogXCLigKBcIixcbiAgICAweDg3OiBcIuKAoVwiLCAweDg4OiBcIsuGXCIsIDB4ODk6IFwi4oCwXCIsIDB4OGE6IFwixaBcIiwgMHg4YjogXCLigLlcIiwgMHg4YzogXCLFklwiLFxuICAgIDB4OGU6IFwixb1cIiwgMHg5MTogXCLigJhcIiwgMHg5MjogXCLigJlcIiwgMHg5MzogXCLigJxcIiwgMHg5NDogXCLigJ1cIiwgMHg5NTogXCLigKJcIixcbiAgICAweDk2OiBcIuKAk1wiLCAweDk3OiBcIuKAlFwiLCAweDk4OiBcIsucXCIsIDB4OTk6IFwi4oSiXCIsIDB4OWE6IFwixaFcIiwgMHg5YjogXCLigLpcIixcbiAgICAweDljOiBcIsWTXCIsIDB4OWU6IFwixb5cIiwgMHg5ZjogXCLFuFwiLFxufTtcbmNvbnN0IFdJTkRPV1NfMTI1Ml9SRVZFUlNFID0ge307XG5mb3IgKGNvbnN0IFtjb2RlLCBjaGFyXSBvZiBPYmplY3QuZW50cmllcyhXSU5ET1dTXzEyNTJfRVhUUkEpKSB7XG4gICAgV0lORE9XU18xMjUyX1JFVkVSU0VbY2hhcl0gPSBOdW1iZXIucGFyc2VJbnQoY29kZSk7XG59XG4vKipcbiAqIERlY29kZSB0ZXh0IGZyb20gYmluYXJ5IGRhdGFcbiAqIEBwYXJhbSBieXRlcyBCaW5hcnkgZGF0YVxuICogQHBhcmFtIGVuY29kaW5nIEVuY29kaW5nXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiB0ZXh0RGVjb2RlKGJ5dGVzLCBlbmNvZGluZyA9IFwidXRmLThcIikge1xuICAgIHN3aXRjaCAoZW5jb2RpbmcudG9Mb3dlckNhc2UoKSkge1xuICAgICAgICBjYXNlIFwidXRmLThcIjpcbiAgICAgICAgY2FzZSBcInV0ZjhcIjpcbiAgICAgICAgICAgIGlmICh0eXBlb2YgZ2xvYmFsVGhpcy5UZXh0RGVjb2RlciAhPT0gXCJ1bmRlZmluZWRcIikge1xuICAgICAgICAgICAgICAgIHJldHVybiBuZXcgZ2xvYmFsVGhpcy5UZXh0RGVjb2RlcihcInV0Zi04XCIpLmRlY29kZShieXRlcyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gZGVjb2RlVVRGOChieXRlcyk7XG4gICAgICAgIGNhc2UgXCJ1dGYtMTZsZVwiOlxuICAgICAgICAgICAgcmV0dXJuIGRlY29kZVVURjE2TEUoYnl0ZXMpO1xuICAgICAgICBjYXNlIFwiYXNjaWlcIjpcbiAgICAgICAgICAgIHJldHVybiBkZWNvZGVBU0NJSShieXRlcyk7XG4gICAgICAgIGNhc2UgXCJsYXRpbjFcIjpcbiAgICAgICAgY2FzZSBcImlzby04ODU5LTFcIjpcbiAgICAgICAgICAgIHJldHVybiBkZWNvZGVMYXRpbjEoYnl0ZXMpO1xuICAgICAgICBjYXNlIFwid2luZG93cy0xMjUyXCI6XG4gICAgICAgICAgICByZXR1cm4gZGVjb2RlV2luZG93czEyNTIoYnl0ZXMpO1xuICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgdGhyb3cgbmV3IFJhbmdlRXJyb3IoYEVuY29kaW5nICcke2VuY29kaW5nfScgbm90IHN1cHBvcnRlZGApO1xuICAgIH1cbn1cbmV4cG9ydCBmdW5jdGlvbiB0ZXh0RW5jb2RlKGlucHV0ID0gXCJcIiwgZW5jb2RpbmcgPSBcInV0Zi04XCIpIHtcbiAgICBzd2l0Y2ggKGVuY29kaW5nLnRvTG93ZXJDYXNlKCkpIHtcbiAgICAgICAgY2FzZSBcInV0Zi04XCI6XG4gICAgICAgIGNhc2UgXCJ1dGY4XCI6XG4gICAgICAgICAgICBpZiAodHlwZW9mIGdsb2JhbFRoaXMuVGV4dEVuY29kZXIgIT09IFwidW5kZWZpbmVkXCIpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gbmV3IGdsb2JhbFRoaXMuVGV4dEVuY29kZXIoKS5lbmNvZGUoaW5wdXQpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIGVuY29kZVVURjgoaW5wdXQpO1xuICAgICAgICBjYXNlIFwidXRmLTE2bGVcIjpcbiAgICAgICAgICAgIHJldHVybiBlbmNvZGVVVEYxNkxFKGlucHV0KTtcbiAgICAgICAgY2FzZSBcImFzY2lpXCI6XG4gICAgICAgICAgICByZXR1cm4gZW5jb2RlQVNDSUkoaW5wdXQpO1xuICAgICAgICBjYXNlIFwibGF0aW4xXCI6XG4gICAgICAgIGNhc2UgXCJpc28tODg1OS0xXCI6XG4gICAgICAgICAgICByZXR1cm4gZW5jb2RlTGF0aW4xKGlucHV0KTtcbiAgICAgICAgY2FzZSBcIndpbmRvd3MtMTI1MlwiOlxuICAgICAgICAgICAgcmV0dXJuIGVuY29kZVdpbmRvd3MxMjUyKGlucHV0KTtcbiAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgIHRocm93IG5ldyBSYW5nZUVycm9yKGBFbmNvZGluZyAnJHtlbmNvZGluZ30nIG5vdCBzdXBwb3J0ZWRgKTtcbiAgICB9XG59XG4vLyAtLS0gSW50ZXJuYWwgaGVscGVycyAtLS1cbmZ1bmN0aW9uIGRlY29kZVVURjgoYnl0ZXMpIHtcbiAgICBsZXQgb3V0ID0gXCJcIjtcbiAgICBsZXQgaSA9IDA7XG4gICAgd2hpbGUgKGkgPCBieXRlcy5sZW5ndGgpIHtcbiAgICAgICAgY29uc3QgYjEgPSBieXRlc1tpKytdO1xuICAgICAgICBpZiAoYjEgPCAweDgwKSB7XG4gICAgICAgICAgICBvdXQgKz0gU3RyaW5nLmZyb21DaGFyQ29kZShiMSk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAoYjEgPCAweGUwKSB7XG4gICAgICAgICAgICBjb25zdCBiMiA9IGJ5dGVzW2krK10gJiAweDNmO1xuICAgICAgICAgICAgb3V0ICs9IFN0cmluZy5mcm9tQ2hhckNvZGUoKChiMSAmIDB4MWYpIDw8IDYpIHwgYjIpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKGIxIDwgMHhmMCkge1xuICAgICAgICAgICAgY29uc3QgYjIgPSBieXRlc1tpKytdICYgMHgzZjtcbiAgICAgICAgICAgIGNvbnN0IGIzID0gYnl0ZXNbaSsrXSAmIDB4M2Y7XG4gICAgICAgICAgICBvdXQgKz0gU3RyaW5nLmZyb21DaGFyQ29kZSgoKGIxICYgMHgwZikgPDwgMTIpIHwgKGIyIDw8IDYpIHwgYjMpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgY29uc3QgYjIgPSBieXRlc1tpKytdICYgMHgzZjtcbiAgICAgICAgICAgIGNvbnN0IGIzID0gYnl0ZXNbaSsrXSAmIDB4M2Y7XG4gICAgICAgICAgICBjb25zdCBiNCA9IGJ5dGVzW2krK10gJiAweDNmO1xuICAgICAgICAgICAgbGV0IGNwID0gKChiMSAmIDB4MDcpIDw8IDE4KSB8XG4gICAgICAgICAgICAgICAgKGIyIDw8IDEyKSB8XG4gICAgICAgICAgICAgICAgKGIzIDw8IDYpIHxcbiAgICAgICAgICAgICAgICBiNDtcbiAgICAgICAgICAgIGNwIC09IDB4MTAwMDA7XG4gICAgICAgICAgICBvdXQgKz0gU3RyaW5nLmZyb21DaGFyQ29kZSgweGQ4MDAgKyAoKGNwID4+IDEwKSAmIDB4M2ZmKSwgMHhkYzAwICsgKGNwICYgMHgzZmYpKTtcbiAgICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gb3V0O1xufVxuZnVuY3Rpb24gZGVjb2RlVVRGMTZMRShieXRlcykge1xuICAgIGxldCBvdXQgPSBcIlwiO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgYnl0ZXMubGVuZ3RoOyBpICs9IDIpIHtcbiAgICAgICAgb3V0ICs9IFN0cmluZy5mcm9tQ2hhckNvZGUoYnl0ZXNbaV0gfCAoYnl0ZXNbaSArIDFdIDw8IDgpKTtcbiAgICB9XG4gICAgcmV0dXJuIG91dDtcbn1cbmZ1bmN0aW9uIGRlY29kZUFTQ0lJKGJ5dGVzKSB7XG4gICAgcmV0dXJuIFN0cmluZy5mcm9tQ2hhckNvZGUoLi4uYnl0ZXMubWFwKChiKSA9PiBiICYgMHg3ZikpO1xufVxuZnVuY3Rpb24gZGVjb2RlTGF0aW4xKGJ5dGVzKSB7XG4gICAgcmV0dXJuIFN0cmluZy5mcm9tQ2hhckNvZGUoLi4uYnl0ZXMpO1xufVxuZnVuY3Rpb24gZGVjb2RlV2luZG93czEyNTIoYnl0ZXMpIHtcbiAgICBsZXQgb3V0ID0gXCJcIjtcbiAgICBmb3IgKGNvbnN0IGIgb2YgYnl0ZXMpIHtcbiAgICAgICAgaWYgKGIgPj0gMHg4MCAmJiBiIDw9IDB4OWYgJiYgV0lORE9XU18xMjUyX0VYVFJBW2JdKSB7XG4gICAgICAgICAgICBvdXQgKz0gV0lORE9XU18xMjUyX0VYVFJBW2JdO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgb3V0ICs9IFN0cmluZy5mcm9tQ2hhckNvZGUoYik7XG4gICAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG91dDtcbn1cbmZ1bmN0aW9uIGVuY29kZVVURjgoc3RyKSB7XG4gICAgY29uc3Qgb3V0ID0gW107XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBzdHIubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgY29uc3QgY3AgPSBzdHIuY2hhckNvZGVBdChpKTtcbiAgICAgICAgaWYgKGNwIDwgMHg4MCkge1xuICAgICAgICAgICAgb3V0LnB1c2goY3ApO1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKGNwIDwgMHg4MDApIHtcbiAgICAgICAgICAgIG91dC5wdXNoKDB4YzAgfCAoY3AgPj4gNiksIDB4ODAgfCAoY3AgJiAweDNmKSk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAoY3AgPCAweDEwMDAwKSB7XG4gICAgICAgICAgICBvdXQucHVzaCgweGUwIHwgKGNwID4+IDEyKSwgMHg4MCB8ICgoY3AgPj4gNikgJiAweDNmKSwgMHg4MCB8IChjcCAmIDB4M2YpKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIG91dC5wdXNoKDB4ZjAgfCAoY3AgPj4gMTgpLCAweDgwIHwgKChjcCA+PiAxMikgJiAweDNmKSwgMHg4MCB8ICgoY3AgPj4gNikgJiAweDNmKSwgMHg4MCB8IChjcCAmIDB4M2YpKTtcbiAgICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gbmV3IFVpbnQ4QXJyYXkob3V0KTtcbn1cbmZ1bmN0aW9uIGVuY29kZVVURjE2TEUoc3RyKSB7XG4gICAgY29uc3Qgb3V0ID0gbmV3IFVpbnQ4QXJyYXkoc3RyLmxlbmd0aCAqIDIpO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgc3RyLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGNvbnN0IGNvZGUgPSBzdHIuY2hhckNvZGVBdChpKTtcbiAgICAgICAgb3V0W2kgKiAyXSA9IGNvZGUgJiAweGZmO1xuICAgICAgICBvdXRbaSAqIDIgKyAxXSA9IGNvZGUgPj4gODtcbiAgICB9XG4gICAgcmV0dXJuIG91dDtcbn1cbmZ1bmN0aW9uIGVuY29kZUFTQ0lJKHN0cikge1xuICAgIHJldHVybiBuZXcgVWludDhBcnJheShbLi4uc3RyXS5tYXAoKGNoKSA9PiBjaC5jaGFyQ29kZUF0KDApICYgMHg3ZikpO1xufVxuZnVuY3Rpb24gZW5jb2RlTGF0aW4xKHN0cikge1xuICAgIHJldHVybiBuZXcgVWludDhBcnJheShbLi4uc3RyXS5tYXAoKGNoKSA9PiBjaC5jaGFyQ29kZUF0KDApICYgMHhmZikpO1xufVxuZnVuY3Rpb24gZW5jb2RlV2luZG93czEyNTIoc3RyKSB7XG4gICAgcmV0dXJuIG5ldyBVaW50OEFycmF5KFsuLi5zdHJdLm1hcCgoY2gpID0+IHtcbiAgICAgICAgY29uc3QgY29kZSA9IGNoLmNoYXJDb2RlQXQoMCk7XG4gICAgICAgIGlmIChjb2RlIDw9IDB4ZmYpXG4gICAgICAgICAgICByZXR1cm4gY29kZTtcbiAgICAgICAgaWYgKFdJTkRPV1NfMTI1Ml9SRVZFUlNFW2NoXSAhPT0gdW5kZWZpbmVkKVxuICAgICAgICAgICAgcmV0dXJuIFdJTkRPV1NfMTI1Ml9SRVZFUlNFW2NoXTtcbiAgICAgICAgcmV0dXJuIDB4M2Y7IC8vICc/J1xuICAgIH0pKTtcbn1cbiIsCiAgICAiaW1wb3J0ICogYXMgaWVlZTc1NCBmcm9tICdpZWVlNzU0JztcbmltcG9ydCB7IHRleHREZWNvZGUgfSBmcm9tIFwiQGJvcmV3aXQvdGV4dC1jb2RlY1wiO1xuLy8gUHJpbWl0aXZlIHR5cGVzXG5mdW5jdGlvbiBkdihhcnJheSkge1xuICAgIHJldHVybiBuZXcgRGF0YVZpZXcoYXJyYXkuYnVmZmVyLCBhcnJheS5ieXRlT2Zmc2V0KTtcbn1cbi8qXG4gKiA4LWJpdCB1bnNpZ25lZCBpbnRlZ2VyXG4gKi9cbmV4cG9ydCBjb25zdCBVSU5UOCA9IHtcbiAgICBsZW46IDEsXG4gICAgZ2V0KGFycmF5LCBvZmZzZXQpIHtcbiAgICAgICAgcmV0dXJuIGR2KGFycmF5KS5nZXRVaW50OChvZmZzZXQpO1xuICAgIH0sXG4gICAgcHV0KGFycmF5LCBvZmZzZXQsIHZhbHVlKSB7XG4gICAgICAgIGR2KGFycmF5KS5zZXRVaW50OChvZmZzZXQsIHZhbHVlKTtcbiAgICAgICAgcmV0dXJuIG9mZnNldCArIDE7XG4gICAgfVxufTtcbi8qKlxuICogMTYtYml0IHVuc2lnbmVkIGludGVnZXIsIExpdHRsZSBFbmRpYW4gYnl0ZSBvcmRlclxuICovXG5leHBvcnQgY29uc3QgVUlOVDE2X0xFID0ge1xuICAgIGxlbjogMixcbiAgICBnZXQoYXJyYXksIG9mZnNldCkge1xuICAgICAgICByZXR1cm4gZHYoYXJyYXkpLmdldFVpbnQxNihvZmZzZXQsIHRydWUpO1xuICAgIH0sXG4gICAgcHV0KGFycmF5LCBvZmZzZXQsIHZhbHVlKSB7XG4gICAgICAgIGR2KGFycmF5KS5zZXRVaW50MTYob2Zmc2V0LCB2YWx1ZSwgdHJ1ZSk7XG4gICAgICAgIHJldHVybiBvZmZzZXQgKyAyO1xuICAgIH1cbn07XG4vKipcbiAqIDE2LWJpdCB1bnNpZ25lZCBpbnRlZ2VyLCBCaWcgRW5kaWFuIGJ5dGUgb3JkZXJcbiAqL1xuZXhwb3J0IGNvbnN0IFVJTlQxNl9CRSA9IHtcbiAgICBsZW46IDIsXG4gICAgZ2V0KGFycmF5LCBvZmZzZXQpIHtcbiAgICAgICAgcmV0dXJuIGR2KGFycmF5KS5nZXRVaW50MTYob2Zmc2V0KTtcbiAgICB9LFxuICAgIHB1dChhcnJheSwgb2Zmc2V0LCB2YWx1ZSkge1xuICAgICAgICBkdihhcnJheSkuc2V0VWludDE2KG9mZnNldCwgdmFsdWUpO1xuICAgICAgICByZXR1cm4gb2Zmc2V0ICsgMjtcbiAgICB9XG59O1xuLyoqXG4gKiAyNC1iaXQgdW5zaWduZWQgaW50ZWdlciwgTGl0dGxlIEVuZGlhbiBieXRlIG9yZGVyXG4gKi9cbmV4cG9ydCBjb25zdCBVSU5UMjRfTEUgPSB7XG4gICAgbGVuOiAzLFxuICAgIGdldChhcnJheSwgb2Zmc2V0KSB7XG4gICAgICAgIGNvbnN0IGRhdGFWaWV3ID0gZHYoYXJyYXkpO1xuICAgICAgICByZXR1cm4gZGF0YVZpZXcuZ2V0VWludDgob2Zmc2V0KSArIChkYXRhVmlldy5nZXRVaW50MTYob2Zmc2V0ICsgMSwgdHJ1ZSkgPDwgOCk7XG4gICAgfSxcbiAgICBwdXQoYXJyYXksIG9mZnNldCwgdmFsdWUpIHtcbiAgICAgICAgY29uc3QgZGF0YVZpZXcgPSBkdihhcnJheSk7XG4gICAgICAgIGRhdGFWaWV3LnNldFVpbnQ4KG9mZnNldCwgdmFsdWUgJiAweGZmKTtcbiAgICAgICAgZGF0YVZpZXcuc2V0VWludDE2KG9mZnNldCArIDEsIHZhbHVlID4+IDgsIHRydWUpO1xuICAgICAgICByZXR1cm4gb2Zmc2V0ICsgMztcbiAgICB9XG59O1xuLyoqXG4gKiAyNC1iaXQgdW5zaWduZWQgaW50ZWdlciwgQmlnIEVuZGlhbiBieXRlIG9yZGVyXG4gKi9cbmV4cG9ydCBjb25zdCBVSU5UMjRfQkUgPSB7XG4gICAgbGVuOiAzLFxuICAgIGdldChhcnJheSwgb2Zmc2V0KSB7XG4gICAgICAgIGNvbnN0IGRhdGFWaWV3ID0gZHYoYXJyYXkpO1xuICAgICAgICByZXR1cm4gKGRhdGFWaWV3LmdldFVpbnQxNihvZmZzZXQpIDw8IDgpICsgZGF0YVZpZXcuZ2V0VWludDgob2Zmc2V0ICsgMik7XG4gICAgfSxcbiAgICBwdXQoYXJyYXksIG9mZnNldCwgdmFsdWUpIHtcbiAgICAgICAgY29uc3QgZGF0YVZpZXcgPSBkdihhcnJheSk7XG4gICAgICAgIGRhdGFWaWV3LnNldFVpbnQxNihvZmZzZXQsIHZhbHVlID4+IDgpO1xuICAgICAgICBkYXRhVmlldy5zZXRVaW50OChvZmZzZXQgKyAyLCB2YWx1ZSAmIDB4ZmYpO1xuICAgICAgICByZXR1cm4gb2Zmc2V0ICsgMztcbiAgICB9XG59O1xuLyoqXG4gKiAzMi1iaXQgdW5zaWduZWQgaW50ZWdlciwgTGl0dGxlIEVuZGlhbiBieXRlIG9yZGVyXG4gKi9cbmV4cG9ydCBjb25zdCBVSU5UMzJfTEUgPSB7XG4gICAgbGVuOiA0LFxuICAgIGdldChhcnJheSwgb2Zmc2V0KSB7XG4gICAgICAgIHJldHVybiBkdihhcnJheSkuZ2V0VWludDMyKG9mZnNldCwgdHJ1ZSk7XG4gICAgfSxcbiAgICBwdXQoYXJyYXksIG9mZnNldCwgdmFsdWUpIHtcbiAgICAgICAgZHYoYXJyYXkpLnNldFVpbnQzMihvZmZzZXQsIHZhbHVlLCB0cnVlKTtcbiAgICAgICAgcmV0dXJuIG9mZnNldCArIDQ7XG4gICAgfVxufTtcbi8qKlxuICogMzItYml0IHVuc2lnbmVkIGludGVnZXIsIEJpZyBFbmRpYW4gYnl0ZSBvcmRlclxuICovXG5leHBvcnQgY29uc3QgVUlOVDMyX0JFID0ge1xuICAgIGxlbjogNCxcbiAgICBnZXQoYXJyYXksIG9mZnNldCkge1xuICAgICAgICByZXR1cm4gZHYoYXJyYXkpLmdldFVpbnQzMihvZmZzZXQpO1xuICAgIH0sXG4gICAgcHV0KGFycmF5LCBvZmZzZXQsIHZhbHVlKSB7XG4gICAgICAgIGR2KGFycmF5KS5zZXRVaW50MzIob2Zmc2V0LCB2YWx1ZSk7XG4gICAgICAgIHJldHVybiBvZmZzZXQgKyA0O1xuICAgIH1cbn07XG4vKipcbiAqIDgtYml0IHNpZ25lZCBpbnRlZ2VyXG4gKi9cbmV4cG9ydCBjb25zdCBJTlQ4ID0ge1xuICAgIGxlbjogMSxcbiAgICBnZXQoYXJyYXksIG9mZnNldCkge1xuICAgICAgICByZXR1cm4gZHYoYXJyYXkpLmdldEludDgob2Zmc2V0KTtcbiAgICB9LFxuICAgIHB1dChhcnJheSwgb2Zmc2V0LCB2YWx1ZSkge1xuICAgICAgICBkdihhcnJheSkuc2V0SW50OChvZmZzZXQsIHZhbHVlKTtcbiAgICAgICAgcmV0dXJuIG9mZnNldCArIDE7XG4gICAgfVxufTtcbi8qKlxuICogMTYtYml0IHNpZ25lZCBpbnRlZ2VyLCBCaWcgRW5kaWFuIGJ5dGUgb3JkZXJcbiAqL1xuZXhwb3J0IGNvbnN0IElOVDE2X0JFID0ge1xuICAgIGxlbjogMixcbiAgICBnZXQoYXJyYXksIG9mZnNldCkge1xuICAgICAgICByZXR1cm4gZHYoYXJyYXkpLmdldEludDE2KG9mZnNldCk7XG4gICAgfSxcbiAgICBwdXQoYXJyYXksIG9mZnNldCwgdmFsdWUpIHtcbiAgICAgICAgZHYoYXJyYXkpLnNldEludDE2KG9mZnNldCwgdmFsdWUpO1xuICAgICAgICByZXR1cm4gb2Zmc2V0ICsgMjtcbiAgICB9XG59O1xuLyoqXG4gKiAxNi1iaXQgc2lnbmVkIGludGVnZXIsIExpdHRsZSBFbmRpYW4gYnl0ZSBvcmRlclxuICovXG5leHBvcnQgY29uc3QgSU5UMTZfTEUgPSB7XG4gICAgbGVuOiAyLFxuICAgIGdldChhcnJheSwgb2Zmc2V0KSB7XG4gICAgICAgIHJldHVybiBkdihhcnJheSkuZ2V0SW50MTYob2Zmc2V0LCB0cnVlKTtcbiAgICB9LFxuICAgIHB1dChhcnJheSwgb2Zmc2V0LCB2YWx1ZSkge1xuICAgICAgICBkdihhcnJheSkuc2V0SW50MTYob2Zmc2V0LCB2YWx1ZSwgdHJ1ZSk7XG4gICAgICAgIHJldHVybiBvZmZzZXQgKyAyO1xuICAgIH1cbn07XG4vKipcbiAqIDI0LWJpdCBzaWduZWQgaW50ZWdlciwgTGl0dGxlIEVuZGlhbiBieXRlIG9yZGVyXG4gKi9cbmV4cG9ydCBjb25zdCBJTlQyNF9MRSA9IHtcbiAgICBsZW46IDMsXG4gICAgZ2V0KGFycmF5LCBvZmZzZXQpIHtcbiAgICAgICAgY29uc3QgdW5zaWduZWQgPSBVSU5UMjRfTEUuZ2V0KGFycmF5LCBvZmZzZXQpO1xuICAgICAgICByZXR1cm4gdW5zaWduZWQgPiAweDdmZmZmZiA/IHVuc2lnbmVkIC0gMHgxMDAwMDAwIDogdW5zaWduZWQ7XG4gICAgfSxcbiAgICBwdXQoYXJyYXksIG9mZnNldCwgdmFsdWUpIHtcbiAgICAgICAgY29uc3QgZGF0YVZpZXcgPSBkdihhcnJheSk7XG4gICAgICAgIGRhdGFWaWV3LnNldFVpbnQ4KG9mZnNldCwgdmFsdWUgJiAweGZmKTtcbiAgICAgICAgZGF0YVZpZXcuc2V0VWludDE2KG9mZnNldCArIDEsIHZhbHVlID4+IDgsIHRydWUpO1xuICAgICAgICByZXR1cm4gb2Zmc2V0ICsgMztcbiAgICB9XG59O1xuLyoqXG4gKiAyNC1iaXQgc2lnbmVkIGludGVnZXIsIEJpZyBFbmRpYW4gYnl0ZSBvcmRlclxuICovXG5leHBvcnQgY29uc3QgSU5UMjRfQkUgPSB7XG4gICAgbGVuOiAzLFxuICAgIGdldChhcnJheSwgb2Zmc2V0KSB7XG4gICAgICAgIGNvbnN0IHVuc2lnbmVkID0gVUlOVDI0X0JFLmdldChhcnJheSwgb2Zmc2V0KTtcbiAgICAgICAgcmV0dXJuIHVuc2lnbmVkID4gMHg3ZmZmZmYgPyB1bnNpZ25lZCAtIDB4MTAwMDAwMCA6IHVuc2lnbmVkO1xuICAgIH0sXG4gICAgcHV0KGFycmF5LCBvZmZzZXQsIHZhbHVlKSB7XG4gICAgICAgIGNvbnN0IGRhdGFWaWV3ID0gZHYoYXJyYXkpO1xuICAgICAgICBkYXRhVmlldy5zZXRVaW50MTYob2Zmc2V0LCB2YWx1ZSA+PiA4KTtcbiAgICAgICAgZGF0YVZpZXcuc2V0VWludDgob2Zmc2V0ICsgMiwgdmFsdWUgJiAweGZmKTtcbiAgICAgICAgcmV0dXJuIG9mZnNldCArIDM7XG4gICAgfVxufTtcbi8qKlxuICogMzItYml0IHNpZ25lZCBpbnRlZ2VyLCBCaWcgRW5kaWFuIGJ5dGUgb3JkZXJcbiAqL1xuZXhwb3J0IGNvbnN0IElOVDMyX0JFID0ge1xuICAgIGxlbjogNCxcbiAgICBnZXQoYXJyYXksIG9mZnNldCkge1xuICAgICAgICByZXR1cm4gZHYoYXJyYXkpLmdldEludDMyKG9mZnNldCk7XG4gICAgfSxcbiAgICBwdXQoYXJyYXksIG9mZnNldCwgdmFsdWUpIHtcbiAgICAgICAgZHYoYXJyYXkpLnNldEludDMyKG9mZnNldCwgdmFsdWUpO1xuICAgICAgICByZXR1cm4gb2Zmc2V0ICsgNDtcbiAgICB9XG59O1xuLyoqXG4gKiAzMi1iaXQgc2lnbmVkIGludGVnZXIsIEJpZyBFbmRpYW4gYnl0ZSBvcmRlclxuICovXG5leHBvcnQgY29uc3QgSU5UMzJfTEUgPSB7XG4gICAgbGVuOiA0LFxuICAgIGdldChhcnJheSwgb2Zmc2V0KSB7XG4gICAgICAgIHJldHVybiBkdihhcnJheSkuZ2V0SW50MzIob2Zmc2V0LCB0cnVlKTtcbiAgICB9LFxuICAgIHB1dChhcnJheSwgb2Zmc2V0LCB2YWx1ZSkge1xuICAgICAgICBkdihhcnJheSkuc2V0SW50MzIob2Zmc2V0LCB2YWx1ZSwgdHJ1ZSk7XG4gICAgICAgIHJldHVybiBvZmZzZXQgKyA0O1xuICAgIH1cbn07XG4vKipcbiAqIDY0LWJpdCB1bnNpZ25lZCBpbnRlZ2VyLCBMaXR0bGUgRW5kaWFuIGJ5dGUgb3JkZXJcbiAqL1xuZXhwb3J0IGNvbnN0IFVJTlQ2NF9MRSA9IHtcbiAgICBsZW46IDgsXG4gICAgZ2V0KGFycmF5LCBvZmZzZXQpIHtcbiAgICAgICAgcmV0dXJuIGR2KGFycmF5KS5nZXRCaWdVaW50NjQob2Zmc2V0LCB0cnVlKTtcbiAgICB9LFxuICAgIHB1dChhcnJheSwgb2Zmc2V0LCB2YWx1ZSkge1xuICAgICAgICBkdihhcnJheSkuc2V0QmlnVWludDY0KG9mZnNldCwgdmFsdWUsIHRydWUpO1xuICAgICAgICByZXR1cm4gb2Zmc2V0ICsgODtcbiAgICB9XG59O1xuLyoqXG4gKiA2NC1iaXQgc2lnbmVkIGludGVnZXIsIExpdHRsZSBFbmRpYW4gYnl0ZSBvcmRlclxuICovXG5leHBvcnQgY29uc3QgSU5UNjRfTEUgPSB7XG4gICAgbGVuOiA4LFxuICAgIGdldChhcnJheSwgb2Zmc2V0KSB7XG4gICAgICAgIHJldHVybiBkdihhcnJheSkuZ2V0QmlnSW50NjQob2Zmc2V0LCB0cnVlKTtcbiAgICB9LFxuICAgIHB1dChhcnJheSwgb2Zmc2V0LCB2YWx1ZSkge1xuICAgICAgICBkdihhcnJheSkuc2V0QmlnSW50NjQob2Zmc2V0LCB2YWx1ZSwgdHJ1ZSk7XG4gICAgICAgIHJldHVybiBvZmZzZXQgKyA4O1xuICAgIH1cbn07XG4vKipcbiAqIDY0LWJpdCB1bnNpZ25lZCBpbnRlZ2VyLCBCaWcgRW5kaWFuIGJ5dGUgb3JkZXJcbiAqL1xuZXhwb3J0IGNvbnN0IFVJTlQ2NF9CRSA9IHtcbiAgICBsZW46IDgsXG4gICAgZ2V0KGFycmF5LCBvZmZzZXQpIHtcbiAgICAgICAgcmV0dXJuIGR2KGFycmF5KS5nZXRCaWdVaW50NjQob2Zmc2V0KTtcbiAgICB9LFxuICAgIHB1dChhcnJheSwgb2Zmc2V0LCB2YWx1ZSkge1xuICAgICAgICBkdihhcnJheSkuc2V0QmlnVWludDY0KG9mZnNldCwgdmFsdWUpO1xuICAgICAgICByZXR1cm4gb2Zmc2V0ICsgODtcbiAgICB9XG59O1xuLyoqXG4gKiA2NC1iaXQgc2lnbmVkIGludGVnZXIsIEJpZyBFbmRpYW4gYnl0ZSBvcmRlclxuICovXG5leHBvcnQgY29uc3QgSU5UNjRfQkUgPSB7XG4gICAgbGVuOiA4LFxuICAgIGdldChhcnJheSwgb2Zmc2V0KSB7XG4gICAgICAgIHJldHVybiBkdihhcnJheSkuZ2V0QmlnSW50NjQob2Zmc2V0KTtcbiAgICB9LFxuICAgIHB1dChhcnJheSwgb2Zmc2V0LCB2YWx1ZSkge1xuICAgICAgICBkdihhcnJheSkuc2V0QmlnSW50NjQob2Zmc2V0LCB2YWx1ZSk7XG4gICAgICAgIHJldHVybiBvZmZzZXQgKyA4O1xuICAgIH1cbn07XG4vKipcbiAqIElFRUUgNzU0IDE2LWJpdCAoaGFsZiBwcmVjaXNpb24pIGZsb2F0LCBiaWcgZW5kaWFuXG4gKi9cbmV4cG9ydCBjb25zdCBGbG9hdDE2X0JFID0ge1xuICAgIGxlbjogMixcbiAgICBnZXQoZGF0YVZpZXcsIG9mZnNldCkge1xuICAgICAgICByZXR1cm4gaWVlZTc1NC5yZWFkKGRhdGFWaWV3LCBvZmZzZXQsIGZhbHNlLCAxMCwgdGhpcy5sZW4pO1xuICAgIH0sXG4gICAgcHV0KGRhdGFWaWV3LCBvZmZzZXQsIHZhbHVlKSB7XG4gICAgICAgIGllZWU3NTQud3JpdGUoZGF0YVZpZXcsIHZhbHVlLCBvZmZzZXQsIGZhbHNlLCAxMCwgdGhpcy5sZW4pO1xuICAgICAgICByZXR1cm4gb2Zmc2V0ICsgdGhpcy5sZW47XG4gICAgfVxufTtcbi8qKlxuICogSUVFRSA3NTQgMTYtYml0IChoYWxmIHByZWNpc2lvbikgZmxvYXQsIGxpdHRsZSBlbmRpYW5cbiAqL1xuZXhwb3J0IGNvbnN0IEZsb2F0MTZfTEUgPSB7XG4gICAgbGVuOiAyLFxuICAgIGdldChhcnJheSwgb2Zmc2V0KSB7XG4gICAgICAgIHJldHVybiBpZWVlNzU0LnJlYWQoYXJyYXksIG9mZnNldCwgdHJ1ZSwgMTAsIHRoaXMubGVuKTtcbiAgICB9LFxuICAgIHB1dChhcnJheSwgb2Zmc2V0LCB2YWx1ZSkge1xuICAgICAgICBpZWVlNzU0LndyaXRlKGFycmF5LCB2YWx1ZSwgb2Zmc2V0LCB0cnVlLCAxMCwgdGhpcy5sZW4pO1xuICAgICAgICByZXR1cm4gb2Zmc2V0ICsgdGhpcy5sZW47XG4gICAgfVxufTtcbi8qKlxuICogSUVFRSA3NTQgMzItYml0IChzaW5nbGUgcHJlY2lzaW9uKSBmbG9hdCwgYmlnIGVuZGlhblxuICovXG5leHBvcnQgY29uc3QgRmxvYXQzMl9CRSA9IHtcbiAgICBsZW46IDQsXG4gICAgZ2V0KGFycmF5LCBvZmZzZXQpIHtcbiAgICAgICAgcmV0dXJuIGR2KGFycmF5KS5nZXRGbG9hdDMyKG9mZnNldCk7XG4gICAgfSxcbiAgICBwdXQoYXJyYXksIG9mZnNldCwgdmFsdWUpIHtcbiAgICAgICAgZHYoYXJyYXkpLnNldEZsb2F0MzIob2Zmc2V0LCB2YWx1ZSk7XG4gICAgICAgIHJldHVybiBvZmZzZXQgKyA0O1xuICAgIH1cbn07XG4vKipcbiAqIElFRUUgNzU0IDMyLWJpdCAoc2luZ2xlIHByZWNpc2lvbikgZmxvYXQsIGxpdHRsZSBlbmRpYW5cbiAqL1xuZXhwb3J0IGNvbnN0IEZsb2F0MzJfTEUgPSB7XG4gICAgbGVuOiA0LFxuICAgIGdldChhcnJheSwgb2Zmc2V0KSB7XG4gICAgICAgIHJldHVybiBkdihhcnJheSkuZ2V0RmxvYXQzMihvZmZzZXQsIHRydWUpO1xuICAgIH0sXG4gICAgcHV0KGFycmF5LCBvZmZzZXQsIHZhbHVlKSB7XG4gICAgICAgIGR2KGFycmF5KS5zZXRGbG9hdDMyKG9mZnNldCwgdmFsdWUsIHRydWUpO1xuICAgICAgICByZXR1cm4gb2Zmc2V0ICsgNDtcbiAgICB9XG59O1xuLyoqXG4gKiBJRUVFIDc1NCA2NC1iaXQgKGRvdWJsZSBwcmVjaXNpb24pIGZsb2F0LCBiaWcgZW5kaWFuXG4gKi9cbmV4cG9ydCBjb25zdCBGbG9hdDY0X0JFID0ge1xuICAgIGxlbjogOCxcbiAgICBnZXQoYXJyYXksIG9mZnNldCkge1xuICAgICAgICByZXR1cm4gZHYoYXJyYXkpLmdldEZsb2F0NjQob2Zmc2V0KTtcbiAgICB9LFxuICAgIHB1dChhcnJheSwgb2Zmc2V0LCB2YWx1ZSkge1xuICAgICAgICBkdihhcnJheSkuc2V0RmxvYXQ2NChvZmZzZXQsIHZhbHVlKTtcbiAgICAgICAgcmV0dXJuIG9mZnNldCArIDg7XG4gICAgfVxufTtcbi8qKlxuICogSUVFRSA3NTQgNjQtYml0IChkb3VibGUgcHJlY2lzaW9uKSBmbG9hdCwgbGl0dGxlIGVuZGlhblxuICovXG5leHBvcnQgY29uc3QgRmxvYXQ2NF9MRSA9IHtcbiAgICBsZW46IDgsXG4gICAgZ2V0KGFycmF5LCBvZmZzZXQpIHtcbiAgICAgICAgcmV0dXJuIGR2KGFycmF5KS5nZXRGbG9hdDY0KG9mZnNldCwgdHJ1ZSk7XG4gICAgfSxcbiAgICBwdXQoYXJyYXksIG9mZnNldCwgdmFsdWUpIHtcbiAgICAgICAgZHYoYXJyYXkpLnNldEZsb2F0NjQob2Zmc2V0LCB2YWx1ZSwgdHJ1ZSk7XG4gICAgICAgIHJldHVybiBvZmZzZXQgKyA4O1xuICAgIH1cbn07XG4vKipcbiAqIElFRUUgNzU0IDgwLWJpdCAoZXh0ZW5kZWQgcHJlY2lzaW9uKSBmbG9hdCwgYmlnIGVuZGlhblxuICovXG5leHBvcnQgY29uc3QgRmxvYXQ4MF9CRSA9IHtcbiAgICBsZW46IDEwLFxuICAgIGdldChhcnJheSwgb2Zmc2V0KSB7XG4gICAgICAgIHJldHVybiBpZWVlNzU0LnJlYWQoYXJyYXksIG9mZnNldCwgZmFsc2UsIDYzLCB0aGlzLmxlbik7XG4gICAgfSxcbiAgICBwdXQoYXJyYXksIG9mZnNldCwgdmFsdWUpIHtcbiAgICAgICAgaWVlZTc1NC53cml0ZShhcnJheSwgdmFsdWUsIG9mZnNldCwgZmFsc2UsIDYzLCB0aGlzLmxlbik7XG4gICAgICAgIHJldHVybiBvZmZzZXQgKyB0aGlzLmxlbjtcbiAgICB9XG59O1xuLyoqXG4gKiBJRUVFIDc1NCA4MC1iaXQgKGV4dGVuZGVkIHByZWNpc2lvbikgZmxvYXQsIGxpdHRsZSBlbmRpYW5cbiAqL1xuZXhwb3J0IGNvbnN0IEZsb2F0ODBfTEUgPSB7XG4gICAgbGVuOiAxMCxcbiAgICBnZXQoYXJyYXksIG9mZnNldCkge1xuICAgICAgICByZXR1cm4gaWVlZTc1NC5yZWFkKGFycmF5LCBvZmZzZXQsIHRydWUsIDYzLCB0aGlzLmxlbik7XG4gICAgfSxcbiAgICBwdXQoYXJyYXksIG9mZnNldCwgdmFsdWUpIHtcbiAgICAgICAgaWVlZTc1NC53cml0ZShhcnJheSwgdmFsdWUsIG9mZnNldCwgdHJ1ZSwgNjMsIHRoaXMubGVuKTtcbiAgICAgICAgcmV0dXJuIG9mZnNldCArIHRoaXMubGVuO1xuICAgIH1cbn07XG4vKipcbiAqIElnbm9yZSBhIGdpdmVuIG51bWJlciBvZiBieXRlc1xuICovXG5leHBvcnQgY2xhc3MgSWdub3JlVHlwZSB7XG4gICAgLyoqXG4gICAgICogQHBhcmFtIGxlbiBudW1iZXIgb2YgYnl0ZXMgdG8gaWdub3JlXG4gICAgICovXG4gICAgY29uc3RydWN0b3IobGVuKSB7XG4gICAgICAgIHRoaXMubGVuID0gbGVuO1xuICAgIH1cbiAgICAvLyBUb0RvOiBkb24ndCByZWFkLCBidXQgc2tpcCBkYXRhXG4gICAgZ2V0KF9hcnJheSwgX29mZikge1xuICAgIH1cbn1cbmV4cG9ydCBjbGFzcyBVaW50OEFycmF5VHlwZSB7XG4gICAgY29uc3RydWN0b3IobGVuKSB7XG4gICAgICAgIHRoaXMubGVuID0gbGVuO1xuICAgIH1cbiAgICBnZXQoYXJyYXksIG9mZnNldCkge1xuICAgICAgICByZXR1cm4gYXJyYXkuc3ViYXJyYXkob2Zmc2V0LCBvZmZzZXQgKyB0aGlzLmxlbik7XG4gICAgfVxufVxuLyoqXG4gKiBDb25zdW1lIGEgZml4ZWQgbnVtYmVyIG9mIGJ5dGVzIGZyb20gdGhlIHN0cmVhbSBhbmQgcmV0dXJuIGEgc3RyaW5nIHdpdGggYSBzcGVjaWZpZWQgZW5jb2RpbmcuXG4gKiBTdXBwb3J0cyBhbGwgZW5jb2RpbmdzIHN1cHBvcnRlZCBieSBUZXh0RGVjb2RlciwgcGx1cyAnd2luZG93cy0xMjUyJy5cbiAqL1xuZXhwb3J0IGNsYXNzIFN0cmluZ1R5cGUge1xuICAgIGNvbnN0cnVjdG9yKGxlbiwgZW5jb2RpbmcpIHtcbiAgICAgICAgdGhpcy5sZW4gPSBsZW47XG4gICAgICAgIHRoaXMuZW5jb2RpbmcgPSBlbmNvZGluZztcbiAgICB9XG4gICAgZ2V0KGRhdGEsIG9mZnNldCA9IDApIHtcbiAgICAgICAgY29uc3QgYnl0ZXMgPSBkYXRhLnN1YmFycmF5KG9mZnNldCwgb2Zmc2V0ICsgdGhpcy5sZW4pO1xuICAgICAgICByZXR1cm4gdGV4dERlY29kZShieXRlcywgdGhpcy5lbmNvZGluZyk7XG4gICAgfVxufVxuLyoqXG4gKiBBTlNJIExhdGluIDEgU3RyaW5nIHVzaW5nIFdpbmRvd3MtMTI1MiAoQ29kZSBQYWdlIDEyNTIpXG4gKiBXaW5kb3dzLTEyNTIgaXMgYSBzdXBlcnNldCBvZiBJU08gODg1OS0xIC8gTGF0aW4tMS5cbiAqL1xuZXhwb3J0IGNsYXNzIEFuc2lTdHJpbmdUeXBlIGV4dGVuZHMgU3RyaW5nVHlwZSB7XG4gICAgY29uc3RydWN0b3IobGVuKSB7XG4gICAgICAgIHN1cGVyKGxlbiwgJ3dpbmRvd3MtMTI1MicpO1xuICAgIH1cbn1cbiIsCiAgICAiZXhwb3J0IGNvbnN0IGRlZmF1bHRNZXNzYWdlcyA9ICdFbmQtT2YtU3RyZWFtJztcbi8qKlxuICogVGhyb3duIG9uIHJlYWQgb3BlcmF0aW9uIG9mIHRoZSBlbmQgb2YgZmlsZSBvciBzdHJlYW0gaGFzIGJlZW4gcmVhY2hlZFxuICovXG5leHBvcnQgY2xhc3MgRW5kT2ZTdHJlYW1FcnJvciBleHRlbmRzIEVycm9yIHtcbiAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgc3VwZXIoZGVmYXVsdE1lc3NhZ2VzKTtcbiAgICAgICAgdGhpcy5uYW1lID0gXCJFbmRPZlN0cmVhbUVycm9yXCI7XG4gICAgfVxufVxuZXhwb3J0IGNsYXNzIEFib3J0RXJyb3IgZXh0ZW5kcyBFcnJvciB7XG4gICAgY29uc3RydWN0b3IobWVzc2FnZSA9IFwiVGhlIG9wZXJhdGlvbiB3YXMgYWJvcnRlZFwiKSB7XG4gICAgICAgIHN1cGVyKG1lc3NhZ2UpO1xuICAgICAgICB0aGlzLm5hbWUgPSBcIkFib3J0RXJyb3JcIjtcbiAgICB9XG59XG4iLAogICAgImltcG9ydCB7IEVuZE9mU3RyZWFtRXJyb3IsIEFib3J0RXJyb3IgfSBmcm9tIFwiLi9FcnJvcnMuanNcIjtcbmV4cG9ydCBjbGFzcyBBYnN0cmFjdFN0cmVhbVJlYWRlciB7XG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHRoaXMuZW5kT2ZTdHJlYW0gPSBmYWxzZTtcbiAgICAgICAgdGhpcy5pbnRlcnJ1cHRlZCA9IGZhbHNlO1xuICAgICAgICAvKipcbiAgICAgICAgICogU3RvcmUgcGVla2VkIGRhdGFcbiAgICAgICAgICogQHR5cGUge0FycmF5fVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5wZWVrUXVldWUgPSBbXTtcbiAgICB9XG4gICAgYXN5bmMgcGVlayh1aW50OEFycmF5LCBtYXlCZUxlc3MgPSBmYWxzZSkge1xuICAgICAgICBjb25zdCBieXRlc1JlYWQgPSBhd2FpdCB0aGlzLnJlYWQodWludDhBcnJheSwgbWF5QmVMZXNzKTtcbiAgICAgICAgdGhpcy5wZWVrUXVldWUucHVzaCh1aW50OEFycmF5LnN1YmFycmF5KDAsIGJ5dGVzUmVhZCkpOyAvLyBQdXQgcmVhZCBkYXRhIGJhY2sgdG8gcGVlayBidWZmZXJcbiAgICAgICAgcmV0dXJuIGJ5dGVzUmVhZDtcbiAgICB9XG4gICAgYXN5bmMgcmVhZChidWZmZXIsIG1heUJlTGVzcyA9IGZhbHNlKSB7XG4gICAgICAgIGlmIChidWZmZXIubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICByZXR1cm4gMDtcbiAgICAgICAgfVxuICAgICAgICBsZXQgYnl0ZXNSZWFkID0gdGhpcy5yZWFkRnJvbVBlZWtCdWZmZXIoYnVmZmVyKTtcbiAgICAgICAgaWYgKCF0aGlzLmVuZE9mU3RyZWFtKSB7XG4gICAgICAgICAgICBieXRlc1JlYWQgKz0gYXdhaXQgdGhpcy5yZWFkUmVtYWluZGVyRnJvbVN0cmVhbShidWZmZXIuc3ViYXJyYXkoYnl0ZXNSZWFkKSwgbWF5QmVMZXNzKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoYnl0ZXNSZWFkID09PSAwICYmICFtYXlCZUxlc3MpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFbmRPZlN0cmVhbUVycm9yKCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGJ5dGVzUmVhZDtcbiAgICB9XG4gICAgLyoqXG4gICAgICogUmVhZCBjaHVuayBmcm9tIHN0cmVhbVxuICAgICAqIEBwYXJhbSBidWZmZXIgLSBUYXJnZXQgVWludDhBcnJheSAob3IgQnVmZmVyKSB0byBzdG9yZSBkYXRhIHJlYWQgZnJvbSBzdHJlYW0gaW5cbiAgICAgKiBAcmV0dXJucyBOdW1iZXIgb2YgYnl0ZXMgcmVhZFxuICAgICAqL1xuICAgIHJlYWRGcm9tUGVla0J1ZmZlcihidWZmZXIpIHtcbiAgICAgICAgbGV0IHJlbWFpbmluZyA9IGJ1ZmZlci5sZW5ndGg7XG4gICAgICAgIGxldCBieXRlc1JlYWQgPSAwO1xuICAgICAgICAvLyBjb25zdW1lIHBlZWtlZCBkYXRhIGZpcnN0XG4gICAgICAgIHdoaWxlICh0aGlzLnBlZWtRdWV1ZS5sZW5ndGggPiAwICYmIHJlbWFpbmluZyA+IDApIHtcbiAgICAgICAgICAgIGNvbnN0IHBlZWtEYXRhID0gdGhpcy5wZWVrUXVldWUucG9wKCk7IC8vIEZyb250IG9mIHF1ZXVlXG4gICAgICAgICAgICBpZiAoIXBlZWtEYXRhKVxuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcigncGVla0RhdGEgc2hvdWxkIGJlIGRlZmluZWQnKTtcbiAgICAgICAgICAgIGNvbnN0IGxlbkNvcHkgPSBNYXRoLm1pbihwZWVrRGF0YS5sZW5ndGgsIHJlbWFpbmluZyk7XG4gICAgICAgICAgICBidWZmZXIuc2V0KHBlZWtEYXRhLnN1YmFycmF5KDAsIGxlbkNvcHkpLCBieXRlc1JlYWQpO1xuICAgICAgICAgICAgYnl0ZXNSZWFkICs9IGxlbkNvcHk7XG4gICAgICAgICAgICByZW1haW5pbmcgLT0gbGVuQ29weTtcbiAgICAgICAgICAgIGlmIChsZW5Db3B5IDwgcGVla0RhdGEubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgLy8gcmVtYWluZGVyIGJhY2sgdG8gcXVldWVcbiAgICAgICAgICAgICAgICB0aGlzLnBlZWtRdWV1ZS5wdXNoKHBlZWtEYXRhLnN1YmFycmF5KGxlbkNvcHkpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gYnl0ZXNSZWFkO1xuICAgIH1cbiAgICBhc3luYyByZWFkUmVtYWluZGVyRnJvbVN0cmVhbShidWZmZXIsIG1heUJlTGVzcykge1xuICAgICAgICBsZXQgYnl0ZXNSZWFkID0gMDtcbiAgICAgICAgLy8gQ29udGludWUgcmVhZGluZyBmcm9tIHN0cmVhbSBpZiByZXF1aXJlZFxuICAgICAgICB3aGlsZSAoYnl0ZXNSZWFkIDwgYnVmZmVyLmxlbmd0aCAmJiAhdGhpcy5lbmRPZlN0cmVhbSkge1xuICAgICAgICAgICAgaWYgKHRoaXMuaW50ZXJydXB0ZWQpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgQWJvcnRFcnJvcigpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29uc3QgY2h1bmtMZW4gPSBhd2FpdCB0aGlzLnJlYWRGcm9tU3RyZWFtKGJ1ZmZlci5zdWJhcnJheShieXRlc1JlYWQpLCBtYXlCZUxlc3MpO1xuICAgICAgICAgICAgaWYgKGNodW5rTGVuID09PSAwKVxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgYnl0ZXNSZWFkICs9IGNodW5rTGVuO1xuICAgICAgICB9XG4gICAgICAgIGlmICghbWF5QmVMZXNzICYmIGJ5dGVzUmVhZCA8IGJ1ZmZlci5sZW5ndGgpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFbmRPZlN0cmVhbUVycm9yKCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGJ5dGVzUmVhZDtcbiAgICB9XG59XG4iLAogICAgImltcG9ydCB7IEFic3RyYWN0U3RyZWFtUmVhZGVyIH0gZnJvbSBcIi4vQWJzdHJhY3RTdHJlYW1SZWFkZXIuanNcIjtcbmV4cG9ydCBjbGFzcyBXZWJTdHJlYW1SZWFkZXIgZXh0ZW5kcyBBYnN0cmFjdFN0cmVhbVJlYWRlciB7XG4gICAgY29uc3RydWN0b3IocmVhZGVyKSB7XG4gICAgICAgIHN1cGVyKCk7XG4gICAgICAgIHRoaXMucmVhZGVyID0gcmVhZGVyO1xuICAgIH1cbiAgICBhc3luYyBhYm9ydCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuY2xvc2UoKTtcbiAgICB9XG4gICAgYXN5bmMgY2xvc2UoKSB7XG4gICAgICAgIHRoaXMucmVhZGVyLnJlbGVhc2VMb2NrKCk7XG4gICAgfVxufVxuIiwKICAgICJpbXBvcnQgeyBXZWJTdHJlYW1SZWFkZXIgfSBmcm9tICcuL1dlYlN0cmVhbVJlYWRlci5qcyc7XG4vKipcbiAqIFJlYWQgZnJvbSBhIFdlYlN0cmVhbSB1c2luZyBhIEJZT0IgcmVhZGVyXG4gKiBSZWZlcmVuY2U6IGh0dHBzOi8vbm9kZWpzLm9yZy9hcGkvd2Vic3RyZWFtcy5odG1sI2NsYXNzLXJlYWRhYmxlc3RyZWFtYnlvYnJlYWRlclxuICovXG5leHBvcnQgY2xhc3MgV2ViU3RyZWFtQnlvYlJlYWRlciBleHRlbmRzIFdlYlN0cmVhbVJlYWRlciB7XG4gICAgLyoqXG4gICAgICogUmVhZCBmcm9tIHN0cmVhbVxuICAgICAqIEBwYXJhbSBidWZmZXIgLSBUYXJnZXQgVWludDhBcnJheSAob3IgQnVmZmVyKSB0byBzdG9yZSBkYXRhIHJlYWQgZnJvbSBzdHJlYW0gaW5cbiAgICAgKiBAcGFyYW0gbWF5QmVMZXNzIC0gSWYgdHJ1ZSwgbWF5IGZpbGwgdGhlIGJ1ZmZlciBwYXJ0aWFsbHlcbiAgICAgKiBAcHJvdGVjdGVkIEJ5dGVzIHJlYWRcbiAgICAgKi9cbiAgICBhc3luYyByZWFkRnJvbVN0cmVhbShidWZmZXIsIG1heUJlTGVzcykge1xuICAgICAgICBpZiAoYnVmZmVyLmxlbmd0aCA9PT0gMClcbiAgICAgICAgICAgIHJldHVybiAwO1xuICAgICAgICAvLyBAdHMtaWdub3JlXG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRoaXMucmVhZGVyLnJlYWQobmV3IFVpbnQ4QXJyYXkoYnVmZmVyLmxlbmd0aCksIHsgbWluOiBtYXlCZUxlc3MgPyB1bmRlZmluZWQgOiBidWZmZXIubGVuZ3RoIH0pO1xuICAgICAgICBpZiAocmVzdWx0LmRvbmUpIHtcbiAgICAgICAgICAgIHRoaXMuZW5kT2ZTdHJlYW0gPSByZXN1bHQuZG9uZTtcbiAgICAgICAgfVxuICAgICAgICBpZiAocmVzdWx0LnZhbHVlKSB7XG4gICAgICAgICAgICBidWZmZXIuc2V0KHJlc3VsdC52YWx1ZSk7XG4gICAgICAgICAgICByZXR1cm4gcmVzdWx0LnZhbHVlLmxlbmd0aDtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gMDtcbiAgICB9XG59XG4iLAogICAgImltcG9ydCB7IEVuZE9mU3RyZWFtRXJyb3IgfSBmcm9tICcuL0Vycm9ycy5qcyc7XG5pbXBvcnQgeyBBYnN0cmFjdFN0cmVhbVJlYWRlciB9IGZyb20gXCIuL0Fic3RyYWN0U3RyZWFtUmVhZGVyLmpzXCI7XG5leHBvcnQgY2xhc3MgV2ViU3RyZWFtRGVmYXVsdFJlYWRlciBleHRlbmRzIEFic3RyYWN0U3RyZWFtUmVhZGVyIHtcbiAgICBjb25zdHJ1Y3RvcihyZWFkZXIpIHtcbiAgICAgICAgc3VwZXIoKTtcbiAgICAgICAgdGhpcy5yZWFkZXIgPSByZWFkZXI7XG4gICAgICAgIHRoaXMuYnVmZmVyID0gbnVsbDsgLy8gSW50ZXJuYWwgYnVmZmVyIHRvIHN0b3JlIGV4Y2VzcyBkYXRhXG4gICAgfVxuICAgIC8qKlxuICAgICAqIENvcHkgY2h1bmsgdG8gdGFyZ2V0LCBhbmQgc3RvcmUgdGhlIHJlbWFpbmRlciBpbiB0aGlzLmJ1ZmZlclxuICAgICAqL1xuICAgIHdyaXRlQ2h1bmsodGFyZ2V0LCBjaHVuaykge1xuICAgICAgICBjb25zdCB3cml0dGVuID0gTWF0aC5taW4oY2h1bmsubGVuZ3RoLCB0YXJnZXQubGVuZ3RoKTtcbiAgICAgICAgdGFyZ2V0LnNldChjaHVuay5zdWJhcnJheSgwLCB3cml0dGVuKSk7XG4gICAgICAgIC8vIEFkanVzdCB0aGUgcmVtYWluZGVyIG9mIHRoZSBidWZmZXJcbiAgICAgICAgaWYgKHdyaXR0ZW4gPCBjaHVuay5sZW5ndGgpIHtcbiAgICAgICAgICAgIHRoaXMuYnVmZmVyID0gY2h1bmsuc3ViYXJyYXkod3JpdHRlbik7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICB0aGlzLmJ1ZmZlciA9IG51bGw7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHdyaXR0ZW47XG4gICAgfVxuICAgIC8qKlxuICAgICAqIFJlYWQgZnJvbSBzdHJlYW1cbiAgICAgKiBAcGFyYW0gYnVmZmVyIC0gVGFyZ2V0IFVpbnQ4QXJyYXkgKG9yIEJ1ZmZlcikgdG8gc3RvcmUgZGF0YSByZWFkIGZyb20gc3RyZWFtIGluXG4gICAgICogQHBhcmFtIG1heUJlTGVzcyAtIElmIHRydWUsIG1heSBmaWxsIHRoZSBidWZmZXIgcGFydGlhbGx5XG4gICAgICogQHByb3RlY3RlZCBCeXRlcyByZWFkXG4gICAgICovXG4gICAgYXN5bmMgcmVhZEZyb21TdHJlYW0oYnVmZmVyLCBtYXlCZUxlc3MpIHtcbiAgICAgICAgaWYgKGJ1ZmZlci5sZW5ndGggPT09IDApXG4gICAgICAgICAgICByZXR1cm4gMDtcbiAgICAgICAgbGV0IHRvdGFsQnl0ZXNSZWFkID0gMDtcbiAgICAgICAgLy8gU2VydmUgZnJvbSB0aGUgaW50ZXJuYWwgYnVmZmVyIGZpcnN0XG4gICAgICAgIGlmICh0aGlzLmJ1ZmZlcikge1xuICAgICAgICAgICAgdG90YWxCeXRlc1JlYWQgKz0gdGhpcy53cml0ZUNodW5rKGJ1ZmZlciwgdGhpcy5idWZmZXIpO1xuICAgICAgICB9XG4gICAgICAgIC8vIENvbnRpbnVlIHJlYWRpbmcgZnJvbSB0aGUgc3RyZWFtIGlmIG1vcmUgZGF0YSBpcyBuZWVkZWRcbiAgICAgICAgd2hpbGUgKHRvdGFsQnl0ZXNSZWFkIDwgYnVmZmVyLmxlbmd0aCAmJiAhdGhpcy5lbmRPZlN0cmVhbSkge1xuICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgdGhpcy5yZWFkZXIucmVhZCgpO1xuICAgICAgICAgICAgaWYgKHJlc3VsdC5kb25lKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5lbmRPZlN0cmVhbSA9IHRydWU7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAocmVzdWx0LnZhbHVlKSB7XG4gICAgICAgICAgICAgICAgdG90YWxCeXRlc1JlYWQgKz0gdGhpcy53cml0ZUNodW5rKGJ1ZmZlci5zdWJhcnJheSh0b3RhbEJ5dGVzUmVhZCksIHJlc3VsdC52YWx1ZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCFtYXlCZUxlc3MgJiYgdG90YWxCeXRlc1JlYWQgPT09IDAgJiYgdGhpcy5lbmRPZlN0cmVhbSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVuZE9mU3RyZWFtRXJyb3IoKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdG90YWxCeXRlc1JlYWQ7XG4gICAgfVxuICAgIGFib3J0KCkge1xuICAgICAgICB0aGlzLmludGVycnVwdGVkID0gdHJ1ZTtcbiAgICAgICAgcmV0dXJuIHRoaXMucmVhZGVyLmNhbmNlbCgpO1xuICAgIH1cbiAgICBhc3luYyBjbG9zZSgpIHtcbiAgICAgICAgYXdhaXQgdGhpcy5hYm9ydCgpO1xuICAgICAgICB0aGlzLnJlYWRlci5yZWxlYXNlTG9jaygpO1xuICAgIH1cbn1cbiIsCiAgICAiaW1wb3J0IHsgV2ViU3RyZWFtQnlvYlJlYWRlciB9IGZyb20gJy4vV2ViU3RyZWFtQnlvYlJlYWRlci5qcyc7XG5pbXBvcnQgeyBXZWJTdHJlYW1EZWZhdWx0UmVhZGVyIH0gZnJvbSAnLi9XZWJTdHJlYW1EZWZhdWx0UmVhZGVyLmpzJztcbmV4cG9ydCBmdW5jdGlvbiBtYWtlV2ViU3RyZWFtUmVhZGVyKHN0cmVhbSkge1xuICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IHJlYWRlciA9IHN0cmVhbS5nZXRSZWFkZXIoeyBtb2RlOiBcImJ5b2JcIiB9KTtcbiAgICAgICAgaWYgKHJlYWRlciBpbnN0YW5jZW9mIFJlYWRhYmxlU3RyZWFtRGVmYXVsdFJlYWRlcikge1xuICAgICAgICAgICAgLy8gRmFsbGJhY2sgdG8gZGVmYXVsdCByZWFkZXIgaW4gY2FzZSBgbW9kZTogYnlvYmAgaXMgaWdub3JlZFxuICAgICAgICAgICAgcmV0dXJuIG5ldyBXZWJTdHJlYW1EZWZhdWx0UmVhZGVyKHJlYWRlcik7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG5ldyBXZWJTdHJlYW1CeW9iUmVhZGVyKHJlYWRlcik7XG4gICAgfVxuICAgIGNhdGNoIChlcnJvcikge1xuICAgICAgICBpZiAoZXJyb3IgaW5zdGFuY2VvZiBUeXBlRXJyb3IpIHtcbiAgICAgICAgICAgIC8vIEZhbGxiYWNrIHRvIGRlZmF1bHQgcmVhZGVyIGluIGNhc2UgYG1vZGU6IGJ5b2JgIHJlamVjdGVkIGJ5IGEgYFR5cGVFcnJvcmBcbiAgICAgICAgICAgIHJldHVybiBuZXcgV2ViU3RyZWFtRGVmYXVsdFJlYWRlcihzdHJlYW0uZ2V0UmVhZGVyKCkpO1xuICAgICAgICB9XG4gICAgICAgIHRocm93IGVycm9yO1xuICAgIH1cbn1cbiIsCiAgICAiaW1wb3J0IHsgRW5kT2ZTdHJlYW1FcnJvciB9IGZyb20gJy4vc3RyZWFtL2luZGV4LmpzJztcbi8qKlxuICogQ29yZSB0b2tlbml6ZXJcbiAqL1xuZXhwb3J0IGNsYXNzIEFic3RyYWN0VG9rZW5pemVyIHtcbiAgICAvKipcbiAgICAgKiBDb25zdHJ1Y3RvclxuICAgICAqIEBwYXJhbSBvcHRpb25zIFRva2VuaXplciBvcHRpb25zXG4gICAgICogQHByb3RlY3RlZFxuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKG9wdGlvbnMpIHtcbiAgICAgICAgdGhpcy5udW1CdWZmZXIgPSBuZXcgVWludDhBcnJheSg4KTtcbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRva2VuaXplci1zdHJlYW0gcG9zaXRpb25cbiAgICAgICAgICovXG4gICAgICAgIHRoaXMucG9zaXRpb24gPSAwO1xuICAgICAgICB0aGlzLm9uQ2xvc2UgPSBvcHRpb25zPy5vbkNsb3NlO1xuICAgICAgICBpZiAob3B0aW9ucz8uYWJvcnRTaWduYWwpIHtcbiAgICAgICAgICAgIG9wdGlvbnMuYWJvcnRTaWduYWwuYWRkRXZlbnRMaXN0ZW5lcignYWJvcnQnLCAoKSA9PiB7XG4gICAgICAgICAgICAgICAgdGhpcy5hYm9ydCgpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICB9XG4gICAgLyoqXG4gICAgICogUmVhZCBhIHRva2VuIGZyb20gdGhlIHRva2VuaXplci1zdHJlYW1cbiAgICAgKiBAcGFyYW0gdG9rZW4gLSBUaGUgdG9rZW4gdG8gcmVhZFxuICAgICAqIEBwYXJhbSBwb3NpdGlvbiAtIElmIHByb3ZpZGVkLCB0aGUgZGVzaXJlZCBwb3NpdGlvbiBpbiB0aGUgdG9rZW5pemVyLXN0cmVhbVxuICAgICAqIEByZXR1cm5zIFByb21pc2Ugd2l0aCB0b2tlbiBkYXRhXG4gICAgICovXG4gICAgYXN5bmMgcmVhZFRva2VuKHRva2VuLCBwb3NpdGlvbiA9IHRoaXMucG9zaXRpb24pIHtcbiAgICAgICAgY29uc3QgdWludDhBcnJheSA9IG5ldyBVaW50OEFycmF5KHRva2VuLmxlbik7XG4gICAgICAgIGNvbnN0IGxlbiA9IGF3YWl0IHRoaXMucmVhZEJ1ZmZlcih1aW50OEFycmF5LCB7IHBvc2l0aW9uIH0pO1xuICAgICAgICBpZiAobGVuIDwgdG9rZW4ubGVuKVxuICAgICAgICAgICAgdGhyb3cgbmV3IEVuZE9mU3RyZWFtRXJyb3IoKTtcbiAgICAgICAgcmV0dXJuIHRva2VuLmdldCh1aW50OEFycmF5LCAwKTtcbiAgICB9XG4gICAgLyoqXG4gICAgICogUGVlayBhIHRva2VuIGZyb20gdGhlIHRva2VuaXplci1zdHJlYW0uXG4gICAgICogQHBhcmFtIHRva2VuIC0gVG9rZW4gdG8gcGVlayBmcm9tIHRoZSB0b2tlbml6ZXItc3RyZWFtLlxuICAgICAqIEBwYXJhbSBwb3NpdGlvbiAtIE9mZnNldCB3aGVyZSB0byBiZWdpbiByZWFkaW5nIHdpdGhpbiB0aGUgZmlsZS4gSWYgcG9zaXRpb24gaXMgbnVsbCwgZGF0YSB3aWxsIGJlIHJlYWQgZnJvbSB0aGUgY3VycmVudCBmaWxlIHBvc2l0aW9uLlxuICAgICAqIEByZXR1cm5zIFByb21pc2Ugd2l0aCB0b2tlbiBkYXRhXG4gICAgICovXG4gICAgYXN5bmMgcGVla1Rva2VuKHRva2VuLCBwb3NpdGlvbiA9IHRoaXMucG9zaXRpb24pIHtcbiAgICAgICAgY29uc3QgdWludDhBcnJheSA9IG5ldyBVaW50OEFycmF5KHRva2VuLmxlbik7XG4gICAgICAgIGNvbnN0IGxlbiA9IGF3YWl0IHRoaXMucGVla0J1ZmZlcih1aW50OEFycmF5LCB7IHBvc2l0aW9uIH0pO1xuICAgICAgICBpZiAobGVuIDwgdG9rZW4ubGVuKVxuICAgICAgICAgICAgdGhyb3cgbmV3IEVuZE9mU3RyZWFtRXJyb3IoKTtcbiAgICAgICAgcmV0dXJuIHRva2VuLmdldCh1aW50OEFycmF5LCAwKTtcbiAgICB9XG4gICAgLyoqXG4gICAgICogUmVhZCBhIG51bWVyaWMgdG9rZW4gZnJvbSB0aGUgc3RyZWFtXG4gICAgICogQHBhcmFtIHRva2VuIC0gTnVtZXJpYyB0b2tlblxuICAgICAqIEByZXR1cm5zIFByb21pc2Ugd2l0aCBudW1iZXJcbiAgICAgKi9cbiAgICBhc3luYyByZWFkTnVtYmVyKHRva2VuKSB7XG4gICAgICAgIGNvbnN0IGxlbiA9IGF3YWl0IHRoaXMucmVhZEJ1ZmZlcih0aGlzLm51bUJ1ZmZlciwgeyBsZW5ndGg6IHRva2VuLmxlbiB9KTtcbiAgICAgICAgaWYgKGxlbiA8IHRva2VuLmxlbilcbiAgICAgICAgICAgIHRocm93IG5ldyBFbmRPZlN0cmVhbUVycm9yKCk7XG4gICAgICAgIHJldHVybiB0b2tlbi5nZXQodGhpcy5udW1CdWZmZXIsIDApO1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBSZWFkIGEgbnVtZXJpYyB0b2tlbiBmcm9tIHRoZSBzdHJlYW1cbiAgICAgKiBAcGFyYW0gdG9rZW4gLSBOdW1lcmljIHRva2VuXG4gICAgICogQHJldHVybnMgUHJvbWlzZSB3aXRoIG51bWJlclxuICAgICAqL1xuICAgIGFzeW5jIHBlZWtOdW1iZXIodG9rZW4pIHtcbiAgICAgICAgY29uc3QgbGVuID0gYXdhaXQgdGhpcy5wZWVrQnVmZmVyKHRoaXMubnVtQnVmZmVyLCB7IGxlbmd0aDogdG9rZW4ubGVuIH0pO1xuICAgICAgICBpZiAobGVuIDwgdG9rZW4ubGVuKVxuICAgICAgICAgICAgdGhyb3cgbmV3IEVuZE9mU3RyZWFtRXJyb3IoKTtcbiAgICAgICAgcmV0dXJuIHRva2VuLmdldCh0aGlzLm51bUJ1ZmZlciwgMCk7XG4gICAgfVxuICAgIC8qKlxuICAgICAqIElnbm9yZSBudW1iZXIgb2YgYnl0ZXMsIGFkdmFuY2VzIHRoZSBwb2ludGVyIGluIHVuZGVyIHRva2VuaXplci1zdHJlYW0uXG4gICAgICogQHBhcmFtIGxlbmd0aCAtIE51bWJlciBvZiBieXRlcyB0byBpZ25vcmVcbiAgICAgKiBAcmV0dXJuIHJlc29sdmVzIHRoZSBudW1iZXIgb2YgYnl0ZXMgaWdub3JlZCwgZXF1YWxzIGxlbmd0aCBpZiB0aGlzIGF2YWlsYWJsZSwgb3RoZXJ3aXNlIHRoZSBudW1iZXIgb2YgYnl0ZXMgYXZhaWxhYmxlXG4gICAgICovXG4gICAgYXN5bmMgaWdub3JlKGxlbmd0aCkge1xuICAgICAgICBpZiAodGhpcy5maWxlSW5mby5zaXplICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIGNvbnN0IGJ5dGVzTGVmdCA9IHRoaXMuZmlsZUluZm8uc2l6ZSAtIHRoaXMucG9zaXRpb247XG4gICAgICAgICAgICBpZiAobGVuZ3RoID4gYnl0ZXNMZWZ0KSB7XG4gICAgICAgICAgICAgICAgdGhpcy5wb3NpdGlvbiArPSBieXRlc0xlZnQ7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGJ5dGVzTGVmdDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICB0aGlzLnBvc2l0aW9uICs9IGxlbmd0aDtcbiAgICAgICAgcmV0dXJuIGxlbmd0aDtcbiAgICB9XG4gICAgYXN5bmMgY2xvc2UoKSB7XG4gICAgICAgIGF3YWl0IHRoaXMuYWJvcnQoKTtcbiAgICAgICAgYXdhaXQgdGhpcy5vbkNsb3NlPy4oKTtcbiAgICB9XG4gICAgbm9ybWFsaXplT3B0aW9ucyh1aW50OEFycmF5LCBvcHRpb25zKSB7XG4gICAgICAgIGlmICghdGhpcy5zdXBwb3J0c1JhbmRvbUFjY2VzcygpICYmIG9wdGlvbnMgJiYgb3B0aW9ucy5wb3NpdGlvbiAhPT0gdW5kZWZpbmVkICYmIG9wdGlvbnMucG9zaXRpb24gPCB0aGlzLnBvc2l0aW9uKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ2BvcHRpb25zLnBvc2l0aW9uYCBtdXN0IGJlIGVxdWFsIG9yIGdyZWF0ZXIgdGhhbiBgdG9rZW5pemVyLnBvc2l0aW9uYCcpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAuLi57XG4gICAgICAgICAgICAgICAgbWF5QmVMZXNzOiBmYWxzZSxcbiAgICAgICAgICAgICAgICBvZmZzZXQ6IDAsXG4gICAgICAgICAgICAgICAgbGVuZ3RoOiB1aW50OEFycmF5Lmxlbmd0aCxcbiAgICAgICAgICAgICAgICBwb3NpdGlvbjogdGhpcy5wb3NpdGlvblxuICAgICAgICAgICAgfSwgLi4ub3B0aW9uc1xuICAgICAgICB9O1xuICAgIH1cbiAgICBhYm9ydCgpIHtcbiAgICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSgpOyAvLyBJZ25vcmUgYWJvcnQgc2lnbmFsXG4gICAgfVxufVxuIiwKICAgICJpbXBvcnQgeyBBYnN0cmFjdFRva2VuaXplciB9IGZyb20gJy4vQWJzdHJhY3RUb2tlbml6ZXIuanMnO1xuaW1wb3J0IHsgRW5kT2ZTdHJlYW1FcnJvciB9IGZyb20gJy4vc3RyZWFtL2luZGV4LmpzJztcbmNvbnN0IG1heEJ1ZmZlclNpemUgPSAyNTYwMDA7XG5leHBvcnQgY2xhc3MgUmVhZFN0cmVhbVRva2VuaXplciBleHRlbmRzIEFic3RyYWN0VG9rZW5pemVyIHtcbiAgICAvKipcbiAgICAgKiBDb25zdHJ1Y3RvclxuICAgICAqIEBwYXJhbSBzdHJlYW1SZWFkZXIgc3RyZWFtLXJlYWRlciB0byByZWFkIGZyb21cbiAgICAgKiBAcGFyYW0gb3B0aW9ucyBUb2tlbml6ZXIgb3B0aW9uc1xuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKHN0cmVhbVJlYWRlciwgb3B0aW9ucykge1xuICAgICAgICBzdXBlcihvcHRpb25zKTtcbiAgICAgICAgdGhpcy5zdHJlYW1SZWFkZXIgPSBzdHJlYW1SZWFkZXI7XG4gICAgICAgIHRoaXMuZmlsZUluZm8gPSBvcHRpb25zPy5maWxlSW5mbyA/PyB7fTtcbiAgICB9XG4gICAgLyoqXG4gICAgICogUmVhZCBidWZmZXIgZnJvbSB0b2tlbml6ZXJcbiAgICAgKiBAcGFyYW0gdWludDhBcnJheSAtIFRhcmdldCBVaW50OEFycmF5IHRvIGZpbGwgd2l0aCBkYXRhIHJlYWQgZnJvbSB0aGUgdG9rZW5pemVyLXN0cmVhbVxuICAgICAqIEBwYXJhbSBvcHRpb25zIC0gUmVhZCBiZWhhdmlvdXIgb3B0aW9uc1xuICAgICAqIEByZXR1cm5zIFByb21pc2Ugd2l0aCBudW1iZXIgb2YgYnl0ZXMgcmVhZFxuICAgICAqL1xuICAgIGFzeW5jIHJlYWRCdWZmZXIodWludDhBcnJheSwgb3B0aW9ucykge1xuICAgICAgICBjb25zdCBub3JtT3B0aW9ucyA9IHRoaXMubm9ybWFsaXplT3B0aW9ucyh1aW50OEFycmF5LCBvcHRpb25zKTtcbiAgICAgICAgY29uc3Qgc2tpcEJ5dGVzID0gbm9ybU9wdGlvbnMucG9zaXRpb24gLSB0aGlzLnBvc2l0aW9uO1xuICAgICAgICBpZiAoc2tpcEJ5dGVzID4gMCkge1xuICAgICAgICAgICAgYXdhaXQgdGhpcy5pZ25vcmUoc2tpcEJ5dGVzKTtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLnJlYWRCdWZmZXIodWludDhBcnJheSwgb3B0aW9ucyk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHNraXBCeXRlcyA8IDApIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignYG9wdGlvbnMucG9zaXRpb25gIG11c3QgYmUgZXF1YWwgb3IgZ3JlYXRlciB0aGFuIGB0b2tlbml6ZXIucG9zaXRpb25gJyk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG5vcm1PcHRpb25zLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgcmV0dXJuIDA7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgYnl0ZXNSZWFkID0gYXdhaXQgdGhpcy5zdHJlYW1SZWFkZXIucmVhZCh1aW50OEFycmF5LnN1YmFycmF5KDAsIG5vcm1PcHRpb25zLmxlbmd0aCksIG5vcm1PcHRpb25zLm1heUJlTGVzcyk7XG4gICAgICAgIHRoaXMucG9zaXRpb24gKz0gYnl0ZXNSZWFkO1xuICAgICAgICBpZiAoKCFvcHRpb25zIHx8ICFvcHRpb25zLm1heUJlTGVzcykgJiYgYnl0ZXNSZWFkIDwgbm9ybU9wdGlvbnMubGVuZ3RoKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRW5kT2ZTdHJlYW1FcnJvcigpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBieXRlc1JlYWQ7XG4gICAgfVxuICAgIC8qKlxuICAgICAqIFBlZWsgKHJlYWQgYWhlYWQpIGJ1ZmZlciBmcm9tIHRva2VuaXplclxuICAgICAqIEBwYXJhbSB1aW50OEFycmF5IC0gVWludDhBcnJheSAob3IgQnVmZmVyKSB0byB3cml0ZSBkYXRhIHRvXG4gICAgICogQHBhcmFtIG9wdGlvbnMgLSBSZWFkIGJlaGF2aW91ciBvcHRpb25zXG4gICAgICogQHJldHVybnMgUHJvbWlzZSB3aXRoIG51bWJlciBvZiBieXRlcyBwZWVrZWRcbiAgICAgKi9cbiAgICBhc3luYyBwZWVrQnVmZmVyKHVpbnQ4QXJyYXksIG9wdGlvbnMpIHtcbiAgICAgICAgY29uc3Qgbm9ybU9wdGlvbnMgPSB0aGlzLm5vcm1hbGl6ZU9wdGlvbnModWludDhBcnJheSwgb3B0aW9ucyk7XG4gICAgICAgIGxldCBieXRlc1JlYWQgPSAwO1xuICAgICAgICBpZiAobm9ybU9wdGlvbnMucG9zaXRpb24pIHtcbiAgICAgICAgICAgIGNvbnN0IHNraXBCeXRlcyA9IG5vcm1PcHRpb25zLnBvc2l0aW9uIC0gdGhpcy5wb3NpdGlvbjtcbiAgICAgICAgICAgIGlmIChza2lwQnl0ZXMgPiAwKSB7XG4gICAgICAgICAgICAgICAgY29uc3Qgc2tpcEJ1ZmZlciA9IG5ldyBVaW50OEFycmF5KG5vcm1PcHRpb25zLmxlbmd0aCArIHNraXBCeXRlcyk7XG4gICAgICAgICAgICAgICAgYnl0ZXNSZWFkID0gYXdhaXQgdGhpcy5wZWVrQnVmZmVyKHNraXBCdWZmZXIsIHsgbWF5QmVMZXNzOiBub3JtT3B0aW9ucy5tYXlCZUxlc3MgfSk7XG4gICAgICAgICAgICAgICAgdWludDhBcnJheS5zZXQoc2tpcEJ1ZmZlci5zdWJhcnJheShza2lwQnl0ZXMpKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gYnl0ZXNSZWFkIC0gc2tpcEJ5dGVzO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHNraXBCeXRlcyA8IDApIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0Nhbm5vdCBwZWVrIGZyb20gYSBuZWdhdGl2ZSBvZmZzZXQgaW4gYSBzdHJlYW0nKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZiAobm9ybU9wdGlvbnMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBieXRlc1JlYWQgPSBhd2FpdCB0aGlzLnN0cmVhbVJlYWRlci5wZWVrKHVpbnQ4QXJyYXkuc3ViYXJyYXkoMCwgbm9ybU9wdGlvbnMubGVuZ3RoKSwgbm9ybU9wdGlvbnMubWF5QmVMZXNzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgICAgICBpZiAob3B0aW9ucz8ubWF5QmVMZXNzICYmIGVyciBpbnN0YW5jZW9mIEVuZE9mU3RyZWFtRXJyb3IpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIDA7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHRocm93IGVycjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmICgoIW5vcm1PcHRpb25zLm1heUJlTGVzcykgJiYgYnl0ZXNSZWFkIDwgbm9ybU9wdGlvbnMubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVuZE9mU3RyZWFtRXJyb3IoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gYnl0ZXNSZWFkO1xuICAgIH1cbiAgICBhc3luYyBpZ25vcmUobGVuZ3RoKSB7XG4gICAgICAgIC8vIGRlYnVnKGBpZ25vcmUgJHt0aGlzLnBvc2l0aW9ufS4uLiR7dGhpcy5wb3NpdGlvbiArIGxlbmd0aCAtIDF9YCk7XG4gICAgICAgIGNvbnN0IGJ1ZlNpemUgPSBNYXRoLm1pbihtYXhCdWZmZXJTaXplLCBsZW5ndGgpO1xuICAgICAgICBjb25zdCBidWYgPSBuZXcgVWludDhBcnJheShidWZTaXplKTtcbiAgICAgICAgbGV0IHRvdEJ5dGVzUmVhZCA9IDA7XG4gICAgICAgIHdoaWxlICh0b3RCeXRlc1JlYWQgPCBsZW5ndGgpIHtcbiAgICAgICAgICAgIGNvbnN0IHJlbWFpbmluZyA9IGxlbmd0aCAtIHRvdEJ5dGVzUmVhZDtcbiAgICAgICAgICAgIGNvbnN0IGJ5dGVzUmVhZCA9IGF3YWl0IHRoaXMucmVhZEJ1ZmZlcihidWYsIHsgbGVuZ3RoOiBNYXRoLm1pbihidWZTaXplLCByZW1haW5pbmcpIH0pO1xuICAgICAgICAgICAgaWYgKGJ5dGVzUmVhZCA8IDApIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gYnl0ZXNSZWFkO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdG90Qnl0ZXNSZWFkICs9IGJ5dGVzUmVhZDtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdG90Qnl0ZXNSZWFkO1xuICAgIH1cbiAgICBhYm9ydCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuc3RyZWFtUmVhZGVyLmFib3J0KCk7XG4gICAgfVxuICAgIGFzeW5jIGNsb3NlKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5zdHJlYW1SZWFkZXIuY2xvc2UoKTtcbiAgICB9XG4gICAgc3VwcG9ydHNSYW5kb21BY2Nlc3MoKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG59XG4iLAogICAgImltcG9ydCB7IEVuZE9mU3RyZWFtRXJyb3IgfSBmcm9tICcuL3N0cmVhbS9pbmRleC5qcyc7XG5pbXBvcnQgeyBBYnN0cmFjdFRva2VuaXplciB9IGZyb20gJy4vQWJzdHJhY3RUb2tlbml6ZXIuanMnO1xuZXhwb3J0IGNsYXNzIEJ1ZmZlclRva2VuaXplciBleHRlbmRzIEFic3RyYWN0VG9rZW5pemVyIHtcbiAgICAvKipcbiAgICAgKiBDb25zdHJ1Y3QgQnVmZmVyVG9rZW5pemVyXG4gICAgICogQHBhcmFtIHVpbnQ4QXJyYXkgLSBVaW50OEFycmF5IHRvIHRva2VuaXplXG4gICAgICogQHBhcmFtIG9wdGlvbnMgVG9rZW5pemVyIG9wdGlvbnNcbiAgICAgKi9cbiAgICBjb25zdHJ1Y3Rvcih1aW50OEFycmF5LCBvcHRpb25zKSB7XG4gICAgICAgIHN1cGVyKG9wdGlvbnMpO1xuICAgICAgICB0aGlzLnVpbnQ4QXJyYXkgPSB1aW50OEFycmF5O1xuICAgICAgICB0aGlzLmZpbGVJbmZvID0geyAuLi5vcHRpb25zPy5maWxlSW5mbyA/PyB7fSwgLi4ueyBzaXplOiB1aW50OEFycmF5Lmxlbmd0aCB9IH07XG4gICAgfVxuICAgIC8qKlxuICAgICAqIFJlYWQgYnVmZmVyIGZyb20gdG9rZW5pemVyXG4gICAgICogQHBhcmFtIHVpbnQ4QXJyYXkgLSBVaW50OEFycmF5IHRvIHRva2VuaXplXG4gICAgICogQHBhcmFtIG9wdGlvbnMgLSBSZWFkIGJlaGF2aW91ciBvcHRpb25zXG4gICAgICogQHJldHVybnMge1Byb21pc2U8bnVtYmVyPn1cbiAgICAgKi9cbiAgICBhc3luYyByZWFkQnVmZmVyKHVpbnQ4QXJyYXksIG9wdGlvbnMpIHtcbiAgICAgICAgaWYgKG9wdGlvbnM/LnBvc2l0aW9uKSB7XG4gICAgICAgICAgICB0aGlzLnBvc2l0aW9uID0gb3B0aW9ucy5wb3NpdGlvbjtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBieXRlc1JlYWQgPSBhd2FpdCB0aGlzLnBlZWtCdWZmZXIodWludDhBcnJheSwgb3B0aW9ucyk7XG4gICAgICAgIHRoaXMucG9zaXRpb24gKz0gYnl0ZXNSZWFkO1xuICAgICAgICByZXR1cm4gYnl0ZXNSZWFkO1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBQZWVrIChyZWFkIGFoZWFkKSBidWZmZXIgZnJvbSB0b2tlbml6ZXJcbiAgICAgKiBAcGFyYW0gdWludDhBcnJheVxuICAgICAqIEBwYXJhbSBvcHRpb25zIC0gUmVhZCBiZWhhdmlvdXIgb3B0aW9uc1xuICAgICAqIEByZXR1cm5zIHtQcm9taXNlPG51bWJlcj59XG4gICAgICovXG4gICAgYXN5bmMgcGVla0J1ZmZlcih1aW50OEFycmF5LCBvcHRpb25zKSB7XG4gICAgICAgIGNvbnN0IG5vcm1PcHRpb25zID0gdGhpcy5ub3JtYWxpemVPcHRpb25zKHVpbnQ4QXJyYXksIG9wdGlvbnMpO1xuICAgICAgICBjb25zdCBieXRlczJyZWFkID0gTWF0aC5taW4odGhpcy51aW50OEFycmF5Lmxlbmd0aCAtIG5vcm1PcHRpb25zLnBvc2l0aW9uLCBub3JtT3B0aW9ucy5sZW5ndGgpO1xuICAgICAgICBpZiAoKCFub3JtT3B0aW9ucy5tYXlCZUxlc3MpICYmIGJ5dGVzMnJlYWQgPCBub3JtT3B0aW9ucy5sZW5ndGgpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFbmRPZlN0cmVhbUVycm9yKCk7XG4gICAgICAgIH1cbiAgICAgICAgdWludDhBcnJheS5zZXQodGhpcy51aW50OEFycmF5LnN1YmFycmF5KG5vcm1PcHRpb25zLnBvc2l0aW9uLCBub3JtT3B0aW9ucy5wb3NpdGlvbiArIGJ5dGVzMnJlYWQpKTtcbiAgICAgICAgcmV0dXJuIGJ5dGVzMnJlYWQ7XG4gICAgfVxuICAgIGNsb3NlKCkge1xuICAgICAgICByZXR1cm4gc3VwZXIuY2xvc2UoKTtcbiAgICB9XG4gICAgc3VwcG9ydHNSYW5kb21BY2Nlc3MoKSB7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgICBzZXRQb3NpdGlvbihwb3NpdGlvbikge1xuICAgICAgICB0aGlzLnBvc2l0aW9uID0gcG9zaXRpb247XG4gICAgfVxufVxuIiwKICAgICJpbXBvcnQgeyBFbmRPZlN0cmVhbUVycm9yIH0gZnJvbSAnLi9zdHJlYW0vaW5kZXguanMnO1xuaW1wb3J0IHsgQWJzdHJhY3RUb2tlbml6ZXIgfSBmcm9tICcuL0Fic3RyYWN0VG9rZW5pemVyLmpzJztcbmV4cG9ydCBjbGFzcyBCbG9iVG9rZW5pemVyIGV4dGVuZHMgQWJzdHJhY3RUb2tlbml6ZXIge1xuICAgIC8qKlxuICAgICAqIENvbnN0cnVjdCBCdWZmZXJUb2tlbml6ZXJcbiAgICAgKiBAcGFyYW0gYmxvYiAtIFVpbnQ4QXJyYXkgdG8gdG9rZW5pemVcbiAgICAgKiBAcGFyYW0gb3B0aW9ucyBUb2tlbml6ZXIgb3B0aW9uc1xuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKGJsb2IsIG9wdGlvbnMpIHtcbiAgICAgICAgc3VwZXIob3B0aW9ucyk7XG4gICAgICAgIHRoaXMuYmxvYiA9IGJsb2I7XG4gICAgICAgIHRoaXMuZmlsZUluZm8gPSB7IC4uLm9wdGlvbnM/LmZpbGVJbmZvID8/IHt9LCAuLi57IHNpemU6IGJsb2Iuc2l6ZSwgbWltZVR5cGU6IGJsb2IudHlwZSB9IH07XG4gICAgfVxuICAgIC8qKlxuICAgICAqIFJlYWQgYnVmZmVyIGZyb20gdG9rZW5pemVyXG4gICAgICogQHBhcmFtIHVpbnQ4QXJyYXkgLSBVaW50OEFycmF5IHRvIHRva2VuaXplXG4gICAgICogQHBhcmFtIG9wdGlvbnMgLSBSZWFkIGJlaGF2aW91ciBvcHRpb25zXG4gICAgICogQHJldHVybnMge1Byb21pc2U8bnVtYmVyPn1cbiAgICAgKi9cbiAgICBhc3luYyByZWFkQnVmZmVyKHVpbnQ4QXJyYXksIG9wdGlvbnMpIHtcbiAgICAgICAgaWYgKG9wdGlvbnM/LnBvc2l0aW9uKSB7XG4gICAgICAgICAgICB0aGlzLnBvc2l0aW9uID0gb3B0aW9ucy5wb3NpdGlvbjtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBieXRlc1JlYWQgPSBhd2FpdCB0aGlzLnBlZWtCdWZmZXIodWludDhBcnJheSwgb3B0aW9ucyk7XG4gICAgICAgIHRoaXMucG9zaXRpb24gKz0gYnl0ZXNSZWFkO1xuICAgICAgICByZXR1cm4gYnl0ZXNSZWFkO1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBQZWVrIChyZWFkIGFoZWFkKSBidWZmZXIgZnJvbSB0b2tlbml6ZXJcbiAgICAgKiBAcGFyYW0gYnVmZmVyXG4gICAgICogQHBhcmFtIG9wdGlvbnMgLSBSZWFkIGJlaGF2aW91ciBvcHRpb25zXG4gICAgICogQHJldHVybnMge1Byb21pc2U8bnVtYmVyPn1cbiAgICAgKi9cbiAgICBhc3luYyBwZWVrQnVmZmVyKGJ1ZmZlciwgb3B0aW9ucykge1xuICAgICAgICBjb25zdCBub3JtT3B0aW9ucyA9IHRoaXMubm9ybWFsaXplT3B0aW9ucyhidWZmZXIsIG9wdGlvbnMpO1xuICAgICAgICBjb25zdCBieXRlczJyZWFkID0gTWF0aC5taW4odGhpcy5ibG9iLnNpemUgLSBub3JtT3B0aW9ucy5wb3NpdGlvbiwgbm9ybU9wdGlvbnMubGVuZ3RoKTtcbiAgICAgICAgaWYgKCghbm9ybU9wdGlvbnMubWF5QmVMZXNzKSAmJiBieXRlczJyZWFkIDwgbm9ybU9wdGlvbnMubGVuZ3RoKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRW5kT2ZTdHJlYW1FcnJvcigpO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IGFycmF5QnVmZmVyID0gYXdhaXQgdGhpcy5ibG9iLnNsaWNlKG5vcm1PcHRpb25zLnBvc2l0aW9uLCBub3JtT3B0aW9ucy5wb3NpdGlvbiArIGJ5dGVzMnJlYWQpLmFycmF5QnVmZmVyKCk7XG4gICAgICAgIGJ1ZmZlci5zZXQobmV3IFVpbnQ4QXJyYXkoYXJyYXlCdWZmZXIpKTtcbiAgICAgICAgcmV0dXJuIGJ5dGVzMnJlYWQ7XG4gICAgfVxuICAgIGNsb3NlKCkge1xuICAgICAgICByZXR1cm4gc3VwZXIuY2xvc2UoKTtcbiAgICB9XG4gICAgc3VwcG9ydHNSYW5kb21BY2Nlc3MoKSB7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgICBzZXRQb3NpdGlvbihwb3NpdGlvbikge1xuICAgICAgICB0aGlzLnBvc2l0aW9uID0gcG9zaXRpb247XG4gICAgfVxufVxuIiwKICAgICJpbXBvcnQgeyBTdHJlYW1SZWFkZXIsIG1ha2VXZWJTdHJlYW1SZWFkZXIgfSBmcm9tICcuL3N0cmVhbS9pbmRleC5qcyc7XG5pbXBvcnQgeyBSZWFkU3RyZWFtVG9rZW5pemVyIH0gZnJvbSAnLi9SZWFkU3RyZWFtVG9rZW5pemVyLmpzJztcbmltcG9ydCB7IEJ1ZmZlclRva2VuaXplciB9IGZyb20gJy4vQnVmZmVyVG9rZW5pemVyLmpzJztcbmltcG9ydCB7IEJsb2JUb2tlbml6ZXIgfSBmcm9tICcuL0Jsb2JUb2tlbml6ZXIuanMnO1xuZXhwb3J0IHsgRW5kT2ZTdHJlYW1FcnJvciwgQWJvcnRFcnJvciB9IGZyb20gJy4vc3RyZWFtL2luZGV4LmpzJztcbmV4cG9ydCB7IEFic3RyYWN0VG9rZW5pemVyIH0gZnJvbSAnLi9BYnN0cmFjdFRva2VuaXplci5qcyc7XG4vKipcbiAqIENvbnN0cnVjdCBSZWFkU3RyZWFtVG9rZW5pemVyIGZyb20gZ2l2ZW4gU3RyZWFtLlxuICogV2lsbCBzZXQgZmlsZVNpemUsIGlmIHByb3ZpZGVkIGdpdmVuIFN0cmVhbSBoYXMgc2V0IHRoZSAucGF0aCBwcm9wZXJ0eS9cbiAqIEBwYXJhbSBzdHJlYW0gLSBSZWFkIGZyb20gTm9kZS5qcyBTdHJlYW0uUmVhZGFibGVcbiAqIEBwYXJhbSBvcHRpb25zIC0gVG9rZW5pemVyIG9wdGlvbnNcbiAqIEByZXR1cm5zIFJlYWRTdHJlYW1Ub2tlbml6ZXJcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGZyb21TdHJlYW0oc3RyZWFtLCBvcHRpb25zKSB7XG4gICAgY29uc3Qgc3RyZWFtUmVhZGVyID0gbmV3IFN0cmVhbVJlYWRlcihzdHJlYW0pO1xuICAgIGNvbnN0IF9vcHRpb25zID0gb3B0aW9ucyA/PyB7fTtcbiAgICBjb25zdCBjaGFpbmVkQ2xvc2UgPSBfb3B0aW9ucy5vbkNsb3NlO1xuICAgIF9vcHRpb25zLm9uQ2xvc2UgPSBhc3luYyAoKSA9PiB7XG4gICAgICAgIGF3YWl0IHN0cmVhbVJlYWRlci5jbG9zZSgpO1xuICAgICAgICBpZiAoY2hhaW5lZENsb3NlKSB7XG4gICAgICAgICAgICByZXR1cm4gY2hhaW5lZENsb3NlKCk7XG4gICAgICAgIH1cbiAgICB9O1xuICAgIHJldHVybiBuZXcgUmVhZFN0cmVhbVRva2VuaXplcihzdHJlYW1SZWFkZXIsIF9vcHRpb25zKTtcbn1cbi8qKlxuICogQ29uc3RydWN0IFJlYWRTdHJlYW1Ub2tlbml6ZXIgZnJvbSBnaXZlbiBSZWFkYWJsZVN0cmVhbSAoV2ViU3RyZWFtIEFQSSkuXG4gKiBXaWxsIHNldCBmaWxlU2l6ZSwgaWYgcHJvdmlkZWQgZ2l2ZW4gU3RyZWFtIGhhcyBzZXQgdGhlIC5wYXRoIHByb3BlcnR5L1xuICogQHBhcmFtIHdlYlN0cmVhbSAtIFJlYWQgZnJvbSBOb2RlLmpzIFN0cmVhbS5SZWFkYWJsZSAobXVzdCBiZSBhIGJ5dGUgc3RyZWFtKVxuICogQHBhcmFtIG9wdGlvbnMgLSBUb2tlbml6ZXIgb3B0aW9uc1xuICogQHJldHVybnMgUmVhZFN0cmVhbVRva2VuaXplclxuICovXG5leHBvcnQgZnVuY3Rpb24gZnJvbVdlYlN0cmVhbSh3ZWJTdHJlYW0sIG9wdGlvbnMpIHtcbiAgICBjb25zdCB3ZWJTdHJlYW1SZWFkZXIgPSBtYWtlV2ViU3RyZWFtUmVhZGVyKHdlYlN0cmVhbSk7XG4gICAgY29uc3QgX29wdGlvbnMgPSBvcHRpb25zID8/IHt9O1xuICAgIGNvbnN0IGNoYWluZWRDbG9zZSA9IF9vcHRpb25zLm9uQ2xvc2U7XG4gICAgX29wdGlvbnMub25DbG9zZSA9IGFzeW5jICgpID0+IHtcbiAgICAgICAgYXdhaXQgd2ViU3RyZWFtUmVhZGVyLmNsb3NlKCk7XG4gICAgICAgIGlmIChjaGFpbmVkQ2xvc2UpIHtcbiAgICAgICAgICAgIHJldHVybiBjaGFpbmVkQ2xvc2UoKTtcbiAgICAgICAgfVxuICAgIH07XG4gICAgcmV0dXJuIG5ldyBSZWFkU3RyZWFtVG9rZW5pemVyKHdlYlN0cmVhbVJlYWRlciwgX29wdGlvbnMpO1xufVxuLyoqXG4gKiBDb25zdHJ1Y3QgUmVhZFN0cmVhbVRva2VuaXplciBmcm9tIGdpdmVuIEJ1ZmZlci5cbiAqIEBwYXJhbSB1aW50OEFycmF5IC0gVWludDhBcnJheSB0byB0b2tlbml6ZVxuICogQHBhcmFtIG9wdGlvbnMgLSBUb2tlbml6ZXIgb3B0aW9uc1xuICogQHJldHVybnMgQnVmZmVyVG9rZW5pemVyXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBmcm9tQnVmZmVyKHVpbnQ4QXJyYXksIG9wdGlvbnMpIHtcbiAgICByZXR1cm4gbmV3IEJ1ZmZlclRva2VuaXplcih1aW50OEFycmF5LCBvcHRpb25zKTtcbn1cbi8qKlxuICogQ29uc3RydWN0IFJlYWRTdHJlYW1Ub2tlbml6ZXIgZnJvbSBnaXZlbiBCbG9iLlxuICogQHBhcmFtIGJsb2IgLSBVaW50OEFycmF5IHRvIHRva2VuaXplXG4gKiBAcGFyYW0gb3B0aW9ucyAtIFRva2VuaXplciBvcHRpb25zXG4gKiBAcmV0dXJucyBCdWZmZXJUb2tlbml6ZXJcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGZyb21CbG9iKGJsb2IsIG9wdGlvbnMpIHtcbiAgICByZXR1cm4gbmV3IEJsb2JUb2tlbml6ZXIoYmxvYiwgb3B0aW9ucyk7XG59XG4iLAogICAgImltcG9ydCB7IFN0cmluZ1R5cGUsIFVJTlQzMl9MRSB9IGZyb20gJ3Rva2VuLXR5cGVzJztcbmltcG9ydCBpbml0RGVidWcgZnJvbSAnZGVidWcnO1xuaW1wb3J0IHsgRGF0YURlc2NyaXB0b3IsIEVuZE9mQ2VudHJhbERpcmVjdG9yeVJlY29yZFRva2VuLCBGaWxlSGVhZGVyLCBMb2NhbEZpbGVIZWFkZXJUb2tlbiwgU2lnbmF0dXJlIH0gZnJvbSBcIi4vWmlwVG9rZW4uanNcIjtcbmZ1bmN0aW9uIHNpZ25hdHVyZVRvQXJyYXkoc2lnbmF0dXJlKSB7XG4gICAgY29uc3Qgc2lnbmF0dXJlQnl0ZXMgPSBuZXcgVWludDhBcnJheShVSU5UMzJfTEUubGVuKTtcbiAgICBVSU5UMzJfTEUucHV0KHNpZ25hdHVyZUJ5dGVzLCAwLCBzaWduYXR1cmUpO1xuICAgIHJldHVybiBzaWduYXR1cmVCeXRlcztcbn1cbmNvbnN0IGRlYnVnID0gaW5pdERlYnVnKCd0b2tlbml6ZXI6aW5mbGF0ZScpO1xuY29uc3Qgc3luY0J1ZmZlclNpemUgPSAyNTYgKiAxMDI0O1xuY29uc3QgZGRTaWduYXR1cmVBcnJheSA9IHNpZ25hdHVyZVRvQXJyYXkoU2lnbmF0dXJlLkRhdGFEZXNjcmlwdG9yKTtcbmNvbnN0IGVvY2RTaWduYXR1cmVCeXRlcyA9IHNpZ25hdHVyZVRvQXJyYXkoU2lnbmF0dXJlLkVuZE9mQ2VudHJhbERpcmVjdG9yeSk7XG5leHBvcnQgY2xhc3MgWmlwSGFuZGxlciB7XG4gICAgY29uc3RydWN0b3IodG9rZW5pemVyKSB7XG4gICAgICAgIHRoaXMudG9rZW5pemVyID0gdG9rZW5pemVyO1xuICAgICAgICB0aGlzLnN5bmNCdWZmZXIgPSBuZXcgVWludDhBcnJheShzeW5jQnVmZmVyU2l6ZSk7XG4gICAgfVxuICAgIGFzeW5jIGlzWmlwKCkge1xuICAgICAgICByZXR1cm4gYXdhaXQgdGhpcy5wZWVrU2lnbmF0dXJlKCkgPT09IFNpZ25hdHVyZS5Mb2NhbEZpbGVIZWFkZXI7XG4gICAgfVxuICAgIHBlZWtTaWduYXR1cmUoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnRva2VuaXplci5wZWVrVG9rZW4oVUlOVDMyX0xFKTtcbiAgICB9XG4gICAgYXN5bmMgZmluZEVuZE9mQ2VudHJhbERpcmVjdG9yeUxvY2F0b3IoKSB7XG4gICAgICAgIGNvbnN0IHJhbmRvbVJlYWRUb2tlbml6ZXIgPSB0aGlzLnRva2VuaXplcjtcbiAgICAgICAgY29uc3QgY2h1bmtMZW5ndGggPSBNYXRoLm1pbigxNiAqIDEwMjQsIHJhbmRvbVJlYWRUb2tlbml6ZXIuZmlsZUluZm8uc2l6ZSk7XG4gICAgICAgIGNvbnN0IGJ1ZmZlciA9IHRoaXMuc3luY0J1ZmZlci5zdWJhcnJheSgwLCBjaHVua0xlbmd0aCk7XG4gICAgICAgIGF3YWl0IHRoaXMudG9rZW5pemVyLnJlYWRCdWZmZXIoYnVmZmVyLCB7IHBvc2l0aW9uOiByYW5kb21SZWFkVG9rZW5pemVyLmZpbGVJbmZvLnNpemUgLSBjaHVua0xlbmd0aCB9KTtcbiAgICAgICAgLy8gU2VhcmNoIHRoZSBidWZmZXIgZnJvbSBlbmQgdG8gYmVnaW5uaW5nIGZvciBFT0NEIHNpZ25hdHVyZVxuICAgICAgICAvLyBjb25zdCBzaWduYXR1cmUgPSAweDA2MDU0YjUwO1xuICAgICAgICBmb3IgKGxldCBpID0gYnVmZmVyLmxlbmd0aCAtIDQ7IGkgPj0gMDsgaS0tKSB7XG4gICAgICAgICAgICAvLyBDb21wYXJlIDQgYnl0ZXMgZGlyZWN0bHkgd2l0aG91dCBjYWxsaW5nIHJlYWRVSW50MzJMRVxuICAgICAgICAgICAgaWYgKGJ1ZmZlcltpXSA9PT0gZW9jZFNpZ25hdHVyZUJ5dGVzWzBdICYmXG4gICAgICAgICAgICAgICAgYnVmZmVyW2kgKyAxXSA9PT0gZW9jZFNpZ25hdHVyZUJ5dGVzWzFdICYmXG4gICAgICAgICAgICAgICAgYnVmZmVyW2kgKyAyXSA9PT0gZW9jZFNpZ25hdHVyZUJ5dGVzWzJdICYmXG4gICAgICAgICAgICAgICAgYnVmZmVyW2kgKyAzXSA9PT0gZW9jZFNpZ25hdHVyZUJ5dGVzWzNdKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHJhbmRvbVJlYWRUb2tlbml6ZXIuZmlsZUluZm8uc2l6ZSAtIGNodW5rTGVuZ3RoICsgaTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gLTE7XG4gICAgfVxuICAgIGFzeW5jIHJlYWRDZW50cmFsRGlyZWN0b3J5KCkge1xuICAgICAgICBpZiAoIXRoaXMudG9rZW5pemVyLnN1cHBvcnRzUmFuZG9tQWNjZXNzKCkpIHtcbiAgICAgICAgICAgIGRlYnVnKCdDYW5ub3QgcmVhZGluZyBjZW50cmFsLWRpcmVjdG9yeSB3aXRob3V0IHJhbmRvbS1yZWFkIHN1cHBvcnQnKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBkZWJ1ZygnUmVhZGluZyBjZW50cmFsLWRpcmVjdG9yeS4uLicpO1xuICAgICAgICBjb25zdCBwb3MgPSB0aGlzLnRva2VuaXplci5wb3NpdGlvbjtcbiAgICAgICAgY29uc3Qgb2Zmc2V0ID0gYXdhaXQgdGhpcy5maW5kRW5kT2ZDZW50cmFsRGlyZWN0b3J5TG9jYXRvcigpO1xuICAgICAgICBpZiAob2Zmc2V0ID4gMCkge1xuICAgICAgICAgICAgZGVidWcoJ0NlbnRyYWwtZGlyZWN0b3J5IDMyLWJpdCBzaWduYXR1cmUgZm91bmQnKTtcbiAgICAgICAgICAgIGNvbnN0IGVvY2RIZWFkZXIgPSBhd2FpdCB0aGlzLnRva2VuaXplci5yZWFkVG9rZW4oRW5kT2ZDZW50cmFsRGlyZWN0b3J5UmVjb3JkVG9rZW4sIG9mZnNldCk7XG4gICAgICAgICAgICBjb25zdCBmaWxlcyA9IFtdO1xuICAgICAgICAgICAgdGhpcy50b2tlbml6ZXIuc2V0UG9zaXRpb24oZW9jZEhlYWRlci5vZmZzZXRPZlN0YXJ0T2ZDZCk7XG4gICAgICAgICAgICBmb3IgKGxldCBuID0gMDsgbiA8IGVvY2RIZWFkZXIubnJPZkVudHJpZXNPZlNpemU7ICsrbikge1xuICAgICAgICAgICAgICAgIGNvbnN0IGVudHJ5ID0gYXdhaXQgdGhpcy50b2tlbml6ZXIucmVhZFRva2VuKEZpbGVIZWFkZXIpO1xuICAgICAgICAgICAgICAgIGlmIChlbnRyeS5zaWduYXR1cmUgIT09IFNpZ25hdHVyZS5DZW50cmFsRmlsZUhlYWRlcikge1xuICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0V4cGVjdGVkIENlbnRyYWwtRmlsZS1IZWFkZXIgc2lnbmF0dXJlJyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVudHJ5LmZpbGVuYW1lID0gYXdhaXQgdGhpcy50b2tlbml6ZXIucmVhZFRva2VuKG5ldyBTdHJpbmdUeXBlKGVudHJ5LmZpbGVuYW1lTGVuZ3RoLCAndXRmLTgnKSk7XG4gICAgICAgICAgICAgICAgYXdhaXQgdGhpcy50b2tlbml6ZXIuaWdub3JlKGVudHJ5LmV4dHJhRmllbGRMZW5ndGgpO1xuICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMudG9rZW5pemVyLmlnbm9yZShlbnRyeS5maWxlQ29tbWVudExlbmd0aCk7XG4gICAgICAgICAgICAgICAgZmlsZXMucHVzaChlbnRyeSk7XG4gICAgICAgICAgICAgICAgZGVidWcoYEFkZCBjZW50cmFsLWRpcmVjdG9yeSBmaWxlLWVudHJ5OiBuPSR7biArIDF9LyR7ZmlsZXMubGVuZ3RofTogZmlsZW5hbWU9JHtmaWxlc1tuXS5maWxlbmFtZX1gKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMudG9rZW5pemVyLnNldFBvc2l0aW9uKHBvcyk7XG4gICAgICAgICAgICByZXR1cm4gZmlsZXM7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy50b2tlbml6ZXIuc2V0UG9zaXRpb24ocG9zKTtcbiAgICB9XG4gICAgYXN5bmMgdW56aXAoZmlsZUNiKSB7XG4gICAgICAgIGNvbnN0IGVudHJpZXMgPSBhd2FpdCB0aGlzLnJlYWRDZW50cmFsRGlyZWN0b3J5KCk7XG4gICAgICAgIGlmIChlbnRyaWVzKSB7XG4gICAgICAgICAgICAvLyBVc2UgQ2VudHJhbCBEaXJlY3RvcnkgdG8gaXRlcmF0ZSBvdmVyIGZpbGVzXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5pdGVyYXRlT3ZlckNlbnRyYWxEaXJlY3RvcnkoZW50cmllcywgZmlsZUNiKTtcbiAgICAgICAgfVxuICAgICAgICAvLyBTY2FuIFppcCBmaWxlcyBmb3IgbG9jYWwtZmlsZS1oZWFkZXJcbiAgICAgICAgbGV0IHN0b3AgPSBmYWxzZTtcbiAgICAgICAgZG8ge1xuICAgICAgICAgICAgY29uc3QgemlwSGVhZGVyID0gYXdhaXQgdGhpcy5yZWFkTG9jYWxGaWxlSGVhZGVyKCk7XG4gICAgICAgICAgICBpZiAoIXppcEhlYWRlcilcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNvbnN0IG5leHQgPSBmaWxlQ2IoemlwSGVhZGVyKTtcbiAgICAgICAgICAgIHN0b3AgPSAhIW5leHQuc3RvcDtcbiAgICAgICAgICAgIGxldCBmaWxlRGF0YTtcbiAgICAgICAgICAgIGF3YWl0IHRoaXMudG9rZW5pemVyLmlnbm9yZSh6aXBIZWFkZXIuZXh0cmFGaWVsZExlbmd0aCk7XG4gICAgICAgICAgICBpZiAoemlwSGVhZGVyLmRhdGFEZXNjcmlwdG9yICYmIHppcEhlYWRlci5jb21wcmVzc2VkU2l6ZSA9PT0gMCkge1xuICAgICAgICAgICAgICAgIGNvbnN0IGNodW5rcyA9IFtdO1xuICAgICAgICAgICAgICAgIGxldCBsZW4gPSBzeW5jQnVmZmVyU2l6ZTtcbiAgICAgICAgICAgICAgICBkZWJ1ZygnQ29tcHJlc3NlZC1maWxlLXNpemUgdW5rbm93biwgc2Nhbm5pbmcgZm9yIG5leHQgZGF0YS1kZXNjcmlwdG9yLXNpZ25hdHVyZS4uLi4nKTtcbiAgICAgICAgICAgICAgICBsZXQgbmV4dEhlYWRlckluZGV4ID0gLTE7XG4gICAgICAgICAgICAgICAgd2hpbGUgKG5leHRIZWFkZXJJbmRleCA8IDAgJiYgbGVuID09PSBzeW5jQnVmZmVyU2l6ZSkge1xuICAgICAgICAgICAgICAgICAgICBsZW4gPSBhd2FpdCB0aGlzLnRva2VuaXplci5wZWVrQnVmZmVyKHRoaXMuc3luY0J1ZmZlciwgeyBtYXlCZUxlc3M6IHRydWUgfSk7XG4gICAgICAgICAgICAgICAgICAgIG5leHRIZWFkZXJJbmRleCA9IGluZGV4T2YodGhpcy5zeW5jQnVmZmVyLnN1YmFycmF5KDAsIGxlbiksIGRkU2lnbmF0dXJlQXJyYXkpO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBzaXplID0gbmV4dEhlYWRlckluZGV4ID49IDAgPyBuZXh0SGVhZGVySW5kZXggOiBsZW47XG4gICAgICAgICAgICAgICAgICAgIGlmIChuZXh0LmhhbmRsZXIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGRhdGEgPSBuZXcgVWludDhBcnJheShzaXplKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMudG9rZW5pemVyLnJlYWRCdWZmZXIoZGF0YSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBjaHVua3MucHVzaChkYXRhKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIE1vdmUgcG9zaXRpb24gdG8gdGhlIG5leHQgaGVhZGVyIGlmIGZvdW5kLCBza2lwIHRoZSB3aG9sZSBidWZmZXIgb3RoZXJ3aXNlXG4gICAgICAgICAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLnRva2VuaXplci5pZ25vcmUoc2l6ZSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZGVidWcoYEZvdW5kIGRhdGEtZGVzY3JpcHRvci1zaWduYXR1cmUgYXQgcG9zPSR7dGhpcy50b2tlbml6ZXIucG9zaXRpb259YCk7XG4gICAgICAgICAgICAgICAgaWYgKG5leHQuaGFuZGxlcikge1xuICAgICAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLmluZmxhdGUoemlwSGVhZGVyLCBtZXJnZUFycmF5cyhjaHVua3MpLCBuZXh0LmhhbmRsZXIpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIGlmIChuZXh0LmhhbmRsZXIpIHtcbiAgICAgICAgICAgICAgICAgICAgZGVidWcoYFJlYWRpbmcgY29tcHJlc3NlZC1maWxlLWRhdGE6ICR7emlwSGVhZGVyLmNvbXByZXNzZWRTaXplfSBieXRlc2ApO1xuICAgICAgICAgICAgICAgICAgICBmaWxlRGF0YSA9IG5ldyBVaW50OEFycmF5KHppcEhlYWRlci5jb21wcmVzc2VkU2l6ZSk7XG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMudG9rZW5pemVyLnJlYWRCdWZmZXIoZmlsZURhdGEpO1xuICAgICAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLmluZmxhdGUoemlwSGVhZGVyLCBmaWxlRGF0YSwgbmV4dC5oYW5kbGVyKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGRlYnVnKGBJZ25vcmluZyBjb21wcmVzc2VkLWZpbGUtZGF0YTogJHt6aXBIZWFkZXIuY29tcHJlc3NlZFNpemV9IGJ5dGVzYCk7XG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMudG9rZW5pemVyLmlnbm9yZSh6aXBIZWFkZXIuY29tcHJlc3NlZFNpemUpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGRlYnVnKGBSZWFkaW5nIGRhdGEtZGVzY3JpcHRvciBhdCBwb3M9JHt0aGlzLnRva2VuaXplci5wb3NpdGlvbn1gKTtcbiAgICAgICAgICAgIGlmICh6aXBIZWFkZXIuZGF0YURlc2NyaXB0b3IpIHtcbiAgICAgICAgICAgICAgICAvLyBhd2FpdCB0aGlzLnRva2VuaXplci5pZ25vcmUoRGF0YURlc2NyaXB0b3IubGVuKTtcbiAgICAgICAgICAgICAgICBjb25zdCBkYXRhRGVzY3JpcHRvciA9IGF3YWl0IHRoaXMudG9rZW5pemVyLnJlYWRUb2tlbihEYXRhRGVzY3JpcHRvcik7XG4gICAgICAgICAgICAgICAgaWYgKGRhdGFEZXNjcmlwdG9yLnNpZ25hdHVyZSAhPT0gMHgwODA3NGI1MCkge1xuICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEV4cGVjdGVkIGRhdGEtZGVzY3JpcHRvci1zaWduYXR1cmUgYXQgcG9zaXRpb24gJHt0aGlzLnRva2VuaXplci5wb3NpdGlvbiAtIERhdGFEZXNjcmlwdG9yLmxlbn1gKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gd2hpbGUgKCFzdG9wKTtcbiAgICB9XG4gICAgYXN5bmMgaXRlcmF0ZU92ZXJDZW50cmFsRGlyZWN0b3J5KGVudHJpZXMsIGZpbGVDYikge1xuICAgICAgICBmb3IgKGNvbnN0IGZpbGVIZWFkZXIgb2YgZW50cmllcykge1xuICAgICAgICAgICAgY29uc3QgbmV4dCA9IGZpbGVDYihmaWxlSGVhZGVyKTtcbiAgICAgICAgICAgIGlmIChuZXh0LmhhbmRsZXIpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnRva2VuaXplci5zZXRQb3NpdGlvbihmaWxlSGVhZGVyLnJlbGF0aXZlT2Zmc2V0T2ZMb2NhbEhlYWRlcik7XG4gICAgICAgICAgICAgICAgY29uc3QgemlwSGVhZGVyID0gYXdhaXQgdGhpcy5yZWFkTG9jYWxGaWxlSGVhZGVyKCk7XG4gICAgICAgICAgICAgICAgaWYgKHppcEhlYWRlcikge1xuICAgICAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLnRva2VuaXplci5pZ25vcmUoemlwSGVhZGVyLmV4dHJhRmllbGRMZW5ndGgpO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBmaWxlRGF0YSA9IG5ldyBVaW50OEFycmF5KGZpbGVIZWFkZXIuY29tcHJlc3NlZFNpemUpO1xuICAgICAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLnRva2VuaXplci5yZWFkQnVmZmVyKGZpbGVEYXRhKTtcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgdGhpcy5pbmZsYXRlKHppcEhlYWRlciwgZmlsZURhdGEsIG5leHQuaGFuZGxlcik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKG5leHQuc3RvcClcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgIH1cbiAgICBhc3luYyBpbmZsYXRlKHppcEhlYWRlciwgZmlsZURhdGEsIGNiKSB7XG4gICAgICAgIGlmICh6aXBIZWFkZXIuY29tcHJlc3NlZE1ldGhvZCA9PT0gMCkge1xuICAgICAgICAgICAgLy8gU3RvcmVkICh1bmNvbXByZXNzZWQpXG4gICAgICAgICAgICByZXR1cm4gY2IoZmlsZURhdGEpO1xuICAgICAgICB9XG4gICAgICAgIGlmICh6aXBIZWFkZXIuY29tcHJlc3NlZE1ldGhvZCAhPT0gOCkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbnN1cHBvcnRlZCBaSVAgY29tcHJlc3Npb24gbWV0aG9kOiAke3ppcEhlYWRlci5jb21wcmVzc2VkTWV0aG9kfWApO1xuICAgICAgICB9XG4gICAgICAgIGRlYnVnKGBEZWNvbXByZXNzIGZpbGVuYW1lPSR7emlwSGVhZGVyLmZpbGVuYW1lfSwgY29tcHJlc3NlZC1zaXplPSR7ZmlsZURhdGEubGVuZ3RofWApO1xuICAgICAgICBjb25zdCB1bmNvbXByZXNzZWREYXRhID0gYXdhaXQgWmlwSGFuZGxlci5kZWNvbXByZXNzRGVmbGF0ZVJhdyhmaWxlRGF0YSk7XG4gICAgICAgIHJldHVybiBjYih1bmNvbXByZXNzZWREYXRhKTtcbiAgICB9XG4gICAgc3RhdGljIGFzeW5jIGRlY29tcHJlc3NEZWZsYXRlUmF3KGRhdGEpIHtcbiAgICAgICAgLy8gV3JhcCBVaW50OEFycmF5IGluIGEgUmVhZGFibGVTdHJlYW0gd2l0aG91dCBjb3B5aW5nXG4gICAgICAgIGNvbnN0IGlucHV0ID0gbmV3IFJlYWRhYmxlU3RyZWFtKHtcbiAgICAgICAgICAgIHN0YXJ0KGNvbnRyb2xsZXIpIHtcbiAgICAgICAgICAgICAgICBjb250cm9sbGVyLmVucXVldWUoZGF0YSk7XG4gICAgICAgICAgICAgICAgY29udHJvbGxlci5jbG9zZSgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgICAgY29uc3QgZHMgPSBuZXcgRGVjb21wcmVzc2lvblN0cmVhbShcImRlZmxhdGUtcmF3XCIpO1xuICAgICAgICBjb25zdCBvdXRwdXQgPSBpbnB1dC5waXBlVGhyb3VnaChkcyk7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICAvLyBDb2xsZWN0IGRlY29tcHJlc3NlZCBieXRlcyBmcm9tIHRoZSBvdXRwdXQgc3RyZWFtXG4gICAgICAgICAgICBjb25zdCByZXNwb25zZSA9IG5ldyBSZXNwb25zZShvdXRwdXQpO1xuICAgICAgICAgICAgY29uc3QgYnVmZmVyID0gYXdhaXQgcmVzcG9uc2UuYXJyYXlCdWZmZXIoKTtcbiAgICAgICAgICAgIHJldHVybiBuZXcgVWludDhBcnJheShidWZmZXIpO1xuICAgICAgICB9XG4gICAgICAgIGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgIC8vIFByb3ZpZGUgWklQLXNwZWNpZmljIGVycm9yIGNvbnRleHRcbiAgICAgICAgICAgIGNvbnN0IG1lc3NhZ2UgPSBlcnIgaW5zdGFuY2VvZiBFcnJvclxuICAgICAgICAgICAgICAgID8gYEZhaWxlZCB0byBkZWZsYXRlIFpJUCBlbnRyeTogJHtlcnIubWVzc2FnZX1gXG4gICAgICAgICAgICAgICAgOiBcIlVua25vd24gZGVjb21wcmVzc2lvbiBlcnJvciBpbiBaSVAgZW50cnlcIjtcbiAgICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IobWVzc2FnZSk7XG4gICAgICAgIH1cbiAgICB9XG4gICAgYXN5bmMgcmVhZExvY2FsRmlsZUhlYWRlcigpIHtcbiAgICAgICAgY29uc3Qgc2lnbmF0dXJlID0gYXdhaXQgdGhpcy50b2tlbml6ZXIucGVla1Rva2VuKFVJTlQzMl9MRSk7XG4gICAgICAgIGlmIChzaWduYXR1cmUgPT09IFNpZ25hdHVyZS5Mb2NhbEZpbGVIZWFkZXIpIHtcbiAgICAgICAgICAgIGNvbnN0IGhlYWRlciA9IGF3YWl0IHRoaXMudG9rZW5pemVyLnJlYWRUb2tlbihMb2NhbEZpbGVIZWFkZXJUb2tlbik7XG4gICAgICAgICAgICBoZWFkZXIuZmlsZW5hbWUgPSBhd2FpdCB0aGlzLnRva2VuaXplci5yZWFkVG9rZW4obmV3IFN0cmluZ1R5cGUoaGVhZGVyLmZpbGVuYW1lTGVuZ3RoLCAndXRmLTgnKSk7XG4gICAgICAgICAgICByZXR1cm4gaGVhZGVyO1xuICAgICAgICB9XG4gICAgICAgIGlmIChzaWduYXR1cmUgPT09IFNpZ25hdHVyZS5DZW50cmFsRmlsZUhlYWRlcikge1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgICAgIGlmIChzaWduYXR1cmUgPT09IDB4RTAxMUNGRDApIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignRW5jcnlwdGVkIFpJUCcpO1xuICAgICAgICB9XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignVW5leHBlY3RlZCBzaWduYXR1cmUnKTtcbiAgICB9XG59XG5mdW5jdGlvbiBpbmRleE9mKGJ1ZmZlciwgcG9ydGlvbikge1xuICAgIGNvbnN0IGJ1ZmZlckxlbmd0aCA9IGJ1ZmZlci5sZW5ndGg7XG4gICAgY29uc3QgcG9ydGlvbkxlbmd0aCA9IHBvcnRpb24ubGVuZ3RoO1xuICAgIC8vIFJldHVybiAtMSBpZiB0aGUgcG9ydGlvbiBpcyBsb25nZXIgdGhhbiB0aGUgYnVmZmVyXG4gICAgaWYgKHBvcnRpb25MZW5ndGggPiBidWZmZXJMZW5ndGgpXG4gICAgICAgIHJldHVybiAtMTtcbiAgICAvLyBTZWFyY2ggZm9yIHRoZSBwb3J0aW9uIGluIHRoZSBidWZmZXJcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8PSBidWZmZXJMZW5ndGggLSBwb3J0aW9uTGVuZ3RoOyBpKyspIHtcbiAgICAgICAgbGV0IGZvdW5kID0gdHJ1ZTtcbiAgICAgICAgZm9yIChsZXQgaiA9IDA7IGogPCBwb3J0aW9uTGVuZ3RoOyBqKyspIHtcbiAgICAgICAgICAgIGlmIChidWZmZXJbaSArIGpdICE9PSBwb3J0aW9uW2pdKSB7XG4gICAgICAgICAgICAgICAgZm91bmQgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZiAoZm91bmQpIHtcbiAgICAgICAgICAgIHJldHVybiBpOyAvLyBSZXR1cm4gdGhlIHN0YXJ0aW5nIG9mZnNldFxuICAgICAgICB9XG4gICAgfVxuICAgIHJldHVybiAtMTsgLy8gTm90IGZvdW5kXG59XG5mdW5jdGlvbiBtZXJnZUFycmF5cyhjaHVua3MpIHtcbiAgICAvLyBDb25jYXRlbmF0ZSBjaHVua3MgaW50byBhIHNpbmdsZSBVaW50OEFycmF5XG4gICAgY29uc3QgdG90YWxMZW5ndGggPSBjaHVua3MucmVkdWNlKChhY2MsIGN1cnIpID0+IGFjYyArIGN1cnIubGVuZ3RoLCAwKTtcbiAgICBjb25zdCBtZXJnZWRBcnJheSA9IG5ldyBVaW50OEFycmF5KHRvdGFsTGVuZ3RoKTtcbiAgICBsZXQgb2Zmc2V0ID0gMDtcbiAgICBmb3IgKGNvbnN0IGNodW5rIG9mIGNodW5rcykge1xuICAgICAgICBtZXJnZWRBcnJheS5zZXQoY2h1bmssIG9mZnNldCk7XG4gICAgICAgIG9mZnNldCArPSBjaHVuay5sZW5ndGg7XG4gICAgfVxuICAgIHJldHVybiBtZXJnZWRBcnJheTtcbn1cbiIsCiAgICAiLyoqXG4gKiBSZWYgaHR0cHM6Ly9wa3dhcmUuY2FjaGVmbHkubmV0L3dlYmRvY3MvY2FzZXN0dWRpZXMvQVBQTk9URS5UWFRcbiAqL1xuaW1wb3J0IHsgVUlOVDE2X0xFLCBVSU5UMzJfTEUgfSBmcm9tIFwidG9rZW4tdHlwZXNcIjtcbmV4cG9ydCBjb25zdCBTaWduYXR1cmUgPSB7XG4gICAgTG9jYWxGaWxlSGVhZGVyOiAweDA0MDM0YjUwLFxuICAgIERhdGFEZXNjcmlwdG9yOiAweDA4MDc0YjUwLFxuICAgIENlbnRyYWxGaWxlSGVhZGVyOiAweDAyMDE0YjUwLFxuICAgIEVuZE9mQ2VudHJhbERpcmVjdG9yeTogMHgwNjA1NGI1MFxufTtcbmV4cG9ydCBjb25zdCBEYXRhRGVzY3JpcHRvciA9IHtcbiAgICBnZXQoYXJyYXkpIHtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHNpZ25hdHVyZTogVUlOVDMyX0xFLmdldChhcnJheSwgMCksXG4gICAgICAgICAgICBjb21wcmVzc2VkU2l6ZTogVUlOVDMyX0xFLmdldChhcnJheSwgOCksXG4gICAgICAgICAgICB1bmNvbXByZXNzZWRTaXplOiBVSU5UMzJfTEUuZ2V0KGFycmF5LCAxMiksXG4gICAgICAgIH07XG4gICAgfSwgbGVuOiAxNlxufTtcbi8qKlxuICogRmlyc3QgcGFydCBvZiB0aGUgWklQIExvY2FsIEZpbGUgSGVhZGVyXG4gKiBPZmZzZXQgfCBCeXRlc3wgRGVzY3JpcHRpb25cbiAqIC0tLS0tLS18LS0tLS0tKy0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICAgICAgMCB8ICAgIDQgfCBTaWduYXR1cmUgKDB4MDQwMzRiNTApXG4gKiAgICAgIDQgfCAgICAyIHwgTWluaW11bSB2ZXJzaW9uIG5lZWRlZCB0byBleHRyYWN0XG4gKiAgICAgIDYgfCAgICAyIHwgQml0IGZsYWdcbiAqICAgICAgOCB8ICAgIDIgfCBDb21wcmVzc2lvbiBtZXRob2RcbiAqICAgICAxMCB8ICAgIDIgfCBGaWxlIGxhc3QgbW9kaWZpY2F0aW9uIHRpbWUgKE1TLURPUyBmb3JtYXQpXG4gKiAgICAgMTIgfCAgICAyIHwgRmlsZSBsYXN0IG1vZGlmaWNhdGlvbiBkYXRlIChNUy1ET1MgZm9ybWF0KVxuICogICAgIDE0IHwgICAgNCB8IENSQy0zMiBvZiB1bmNvbXByZXNzZWQgZGF0YVxuICogICAgIDE4IHwgICAgNCB8IENvbXByZXNzZWQgc2l6ZVxuICogICAgIDIyIHwgICAgNCB8IFVuY29tcHJlc3NlZCBzaXplXG4gKiAgICAgMjYgfCAgICAyIHwgRmlsZSBuYW1lIGxlbmd0aCAobilcbiAqICAgICAyOCB8ICAgIDIgfCBFeHRyYSBmaWVsZCBsZW5ndGggKG0pXG4gKiAgICAgMzAgfCAgICBuIHwgRmlsZSBuYW1lXG4gKiAzMCArIG4gfCAgICBtIHwgRXh0cmEgZmllbGRcbiAqL1xuZXhwb3J0IGNvbnN0IExvY2FsRmlsZUhlYWRlclRva2VuID0ge1xuICAgIGdldChhcnJheSkge1xuICAgICAgICBjb25zdCBmbGFncyA9IFVJTlQxNl9MRS5nZXQoYXJyYXksIDYpO1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgc2lnbmF0dXJlOiBVSU5UMzJfTEUuZ2V0KGFycmF5LCAwKSxcbiAgICAgICAgICAgIG1pblZlcnNpb246IFVJTlQxNl9MRS5nZXQoYXJyYXksIDQpLFxuICAgICAgICAgICAgZGF0YURlc2NyaXB0b3I6ICEhKGZsYWdzICYgMHgwMDA4KSxcbiAgICAgICAgICAgIGNvbXByZXNzZWRNZXRob2Q6IFVJTlQxNl9MRS5nZXQoYXJyYXksIDgpLFxuICAgICAgICAgICAgY29tcHJlc3NlZFNpemU6IFVJTlQzMl9MRS5nZXQoYXJyYXksIDE4KSxcbiAgICAgICAgICAgIHVuY29tcHJlc3NlZFNpemU6IFVJTlQzMl9MRS5nZXQoYXJyYXksIDIyKSxcbiAgICAgICAgICAgIGZpbGVuYW1lTGVuZ3RoOiBVSU5UMTZfTEUuZ2V0KGFycmF5LCAyNiksXG4gICAgICAgICAgICBleHRyYUZpZWxkTGVuZ3RoOiBVSU5UMTZfTEUuZ2V0KGFycmF5LCAyOCksXG4gICAgICAgICAgICBmaWxlbmFtZTogbnVsbFxuICAgICAgICB9O1xuICAgIH0sIGxlbjogMzBcbn07XG4vKipcbiAqIDQuMy4xNiAgRW5kIG9mIGNlbnRyYWwgZGlyZWN0b3J5IHJlY29yZDpcbiAqICBlbmQgb2YgY2VudHJhbCBkaXIgc2lnbmF0dXJlICgweDA2MDY0YjUwKSAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgNCBieXRlc1xuICogIG51bWJlciBvZiB0aGlzIGRpc2sgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAyIGJ5dGVzXG4gKiAgbnVtYmVyIG9mIHRoZSBkaXNrIHdpdGggdGhlIHN0YXJ0IG9mIHRoZSBjZW50cmFsIGRpcmVjdG9yeSAgICAgICAgICAgICAgICAgICAgIDIgYnl0ZXNcbiAqICB0b3RhbCBudW1iZXIgb2YgZW50cmllcyBpbiB0aGUgY2VudHJhbCBkaXJlY3Rvcnkgb24gdGhpcyBkaXNrICAgICAgICAgICAgICAgICAgMiBieXRlc1xuICogIHRvdGFsIG51bWJlciBvZiBlbnRyaWVzIGluIHRoZSBzaXplIG9mIHRoZSBjZW50cmFsIGRpcmVjdG9yeSAgICAgICAgICAgICAgICAgICAyIGJ5dGVzXG4gKiAgc2l6ZU9mVGhlQ2VudHJhbERpcmVjdG9yeSAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDQgYnl0ZXNcbiAqICBvZmZzZXQgb2Ygc3RhcnQgb2YgY2VudHJhbCBkaXJlY3Rvcnkgd2l0aCByZXNwZWN0IHRvIHRoZSBzdGFydGluZyBkaXNrIG51bWJlciAgNCBieXRlc1xuICogIC5aSVAgZmlsZSBjb21tZW50IGxlbmd0aCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAyIGJ5dGVzXG4gKiAgLlpJUCBmaWxlIGNvbW1lbnQgICAgICAgKHZhcmlhYmxlIHNpemUpXG4gKi9cbmV4cG9ydCBjb25zdCBFbmRPZkNlbnRyYWxEaXJlY3RvcnlSZWNvcmRUb2tlbiA9IHtcbiAgICBnZXQoYXJyYXkpIHtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHNpZ25hdHVyZTogVUlOVDMyX0xFLmdldChhcnJheSwgMCksXG4gICAgICAgICAgICBuck9mVGhpc0Rpc2s6IFVJTlQxNl9MRS5nZXQoYXJyYXksIDQpLFxuICAgICAgICAgICAgbnJPZlRoaXNEaXNrV2l0aFRoZVN0YXJ0OiBVSU5UMTZfTEUuZ2V0KGFycmF5LCA2KSxcbiAgICAgICAgICAgIG5yT2ZFbnRyaWVzT25UaGlzRGlzazogVUlOVDE2X0xFLmdldChhcnJheSwgOCksXG4gICAgICAgICAgICBuck9mRW50cmllc09mU2l6ZTogVUlOVDE2X0xFLmdldChhcnJheSwgMTApLFxuICAgICAgICAgICAgc2l6ZU9mQ2Q6IFVJTlQzMl9MRS5nZXQoYXJyYXksIDEyKSxcbiAgICAgICAgICAgIG9mZnNldE9mU3RhcnRPZkNkOiBVSU5UMzJfTEUuZ2V0KGFycmF5LCAxNiksXG4gICAgICAgICAgICB6aXBGaWxlQ29tbWVudExlbmd0aDogVUlOVDE2X0xFLmdldChhcnJheSwgMjApLFxuICAgICAgICB9O1xuICAgIH0sIGxlbjogMjJcbn07XG4vKipcbiAqIEZpbGUgaGVhZGVyOlxuICogICAgY2VudHJhbCBmaWxlIGhlYWRlciBzaWduYXR1cmUgICA0IGJ5dGVzICAgMCAoMHgwMjAxNGI1MClcbiAqICAgIHZlcnNpb24gbWFkZSBieSAgICAgICAgICAgICAgICAgMiBieXRlcyAgIDRcbiAqICAgIHZlcnNpb24gbmVlZGVkIHRvIGV4dHJhY3QgICAgICAgMiBieXRlcyAgIDZcbiAqICAgIGdlbmVyYWwgcHVycG9zZSBiaXQgZmxhZyAgICAgICAgMiBieXRlcyAgIDhcbiAqICAgIGNvbXByZXNzaW9uIG1ldGhvZCAgICAgICAgICAgICAgMiBieXRlcyAgMTBcbiAqICAgIGxhc3QgbW9kIGZpbGUgdGltZSAgICAgICAgICAgICAgMiBieXRlcyAgMTJcbiAqICAgIGxhc3QgbW9kIGZpbGUgZGF0ZSAgICAgICAgICAgICAgMiBieXRlcyAgMTRcbiAqICAgIGNyYy0zMiAgICAgICAgICAgICAgICAgICAgICAgICAgNCBieXRlcyAgMTZcbiAqICAgIGNvbXByZXNzZWQgc2l6ZSAgICAgICAgICAgICAgICAgNCBieXRlcyAgMjBcbiAqICAgIHVuY29tcHJlc3NlZCBzaXplICAgICAgICAgICAgICAgNCBieXRlcyAgMjRcbiAqICAgIGZpbGUgbmFtZSBsZW5ndGggICAgICAgICAgICAgICAgMiBieXRlcyAgMjhcbiAqICAgIGV4dHJhIGZpZWxkIGxlbmd0aCAgICAgICAgICAgICAgMiBieXRlcyAgMzBcbiAqICAgIGZpbGUgY29tbWVudCBsZW5ndGggICAgICAgICAgICAgMiBieXRlcyAgMzJcbiAqICAgIGRpc2sgbnVtYmVyIHN0YXJ0ICAgICAgICAgICAgICAgMiBieXRlcyAgMzRcbiAqICAgIGludGVybmFsIGZpbGUgYXR0cmlidXRlcyAgICAgICAgMiBieXRlcyAgMzZcbiAqICAgIGV4dGVybmFsIGZpbGUgYXR0cmlidXRlcyAgICAgICAgNCBieXRlcyAgMzhcbiAqICAgIHJlbGF0aXZlIG9mZnNldCBvZiBsb2NhbCBoZWFkZXIgNCBieXRlcyAgNDJcbiAqL1xuZXhwb3J0IGNvbnN0IEZpbGVIZWFkZXIgPSB7XG4gICAgZ2V0KGFycmF5KSB7XG4gICAgICAgIGNvbnN0IGZsYWdzID0gVUlOVDE2X0xFLmdldChhcnJheSwgOCk7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBzaWduYXR1cmU6IFVJTlQzMl9MRS5nZXQoYXJyYXksIDApLFxuICAgICAgICAgICAgbWluVmVyc2lvbjogVUlOVDE2X0xFLmdldChhcnJheSwgNiksXG4gICAgICAgICAgICBkYXRhRGVzY3JpcHRvcjogISEoZmxhZ3MgJiAweDAwMDgpLFxuICAgICAgICAgICAgY29tcHJlc3NlZE1ldGhvZDogVUlOVDE2X0xFLmdldChhcnJheSwgMTApLFxuICAgICAgICAgICAgY29tcHJlc3NlZFNpemU6IFVJTlQzMl9MRS5nZXQoYXJyYXksIDIwKSxcbiAgICAgICAgICAgIHVuY29tcHJlc3NlZFNpemU6IFVJTlQzMl9MRS5nZXQoYXJyYXksIDI0KSxcbiAgICAgICAgICAgIGZpbGVuYW1lTGVuZ3RoOiBVSU5UMTZfTEUuZ2V0KGFycmF5LCAyOCksXG4gICAgICAgICAgICBleHRyYUZpZWxkTGVuZ3RoOiBVSU5UMTZfTEUuZ2V0KGFycmF5LCAzMCksXG4gICAgICAgICAgICBmaWxlQ29tbWVudExlbmd0aDogVUlOVDE2X0xFLmdldChhcnJheSwgMzIpLFxuICAgICAgICAgICAgcmVsYXRpdmVPZmZzZXRPZkxvY2FsSGVhZGVyOiBVSU5UMzJfTEUuZ2V0KGFycmF5LCA0MiksXG4gICAgICAgICAgICBmaWxlbmFtZTogbnVsbFxuICAgICAgICB9O1xuICAgIH0sIGxlbjogNDZcbn07XG4iLAogICAgImV4cG9ydCBjbGFzcyBHemlwSGFuZGxlciB7XG4gICAgY29uc3RydWN0b3IodG9rZW5pemVyKSB7XG4gICAgICAgIHRoaXMudG9rZW5pemVyID0gdG9rZW5pemVyO1xuICAgIH1cbiAgICBpbmZsYXRlKCkge1xuICAgICAgICBjb25zdCB0b2tlbml6ZXIgPSB0aGlzLnRva2VuaXplcjtcbiAgICAgICAgcmV0dXJuIG5ldyBSZWFkYWJsZVN0cmVhbSh7XG4gICAgICAgICAgICBhc3luYyBwdWxsKGNvbnRyb2xsZXIpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBidWZmZXIgPSBuZXcgVWludDhBcnJheSgxMDI0KTtcbiAgICAgICAgICAgICAgICBjb25zdCBzaXplID0gYXdhaXQgdG9rZW5pemVyLnJlYWRCdWZmZXIoYnVmZmVyLCB7IG1heUJlTGVzczogdHJ1ZSB9KTtcbiAgICAgICAgICAgICAgICBpZiAoc2l6ZSA9PT0gMCkge1xuICAgICAgICAgICAgICAgICAgICBjb250cm9sbGVyLmNsb3NlKCk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY29udHJvbGxlci5lbnF1ZXVlKGJ1ZmZlci5zdWJhcnJheSgwLCBzaXplKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pLnBpcGVUaHJvdWdoKG5ldyBEZWNvbXByZXNzaW9uU3RyZWFtKFwiZ3ppcFwiKSk7XG4gICAgfVxufVxuIiwKICAgICJjb25zdCBvYmplY3RUb1N0cmluZyA9IE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmc7XG5jb25zdCB1aW50OEFycmF5U3RyaW5naWZpZWQgPSAnW29iamVjdCBVaW50OEFycmF5XSc7XG5jb25zdCBhcnJheUJ1ZmZlclN0cmluZ2lmaWVkID0gJ1tvYmplY3QgQXJyYXlCdWZmZXJdJztcblxuZnVuY3Rpb24gaXNUeXBlKHZhbHVlLCB0eXBlQ29uc3RydWN0b3IsIHR5cGVTdHJpbmdpZmllZCkge1xuXHRpZiAoIXZhbHVlKSB7XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cblx0aWYgKHZhbHVlLmNvbnN0cnVjdG9yID09PSB0eXBlQ29uc3RydWN0b3IpIHtcblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXG5cdHJldHVybiBvYmplY3RUb1N0cmluZy5jYWxsKHZhbHVlKSA9PT0gdHlwZVN0cmluZ2lmaWVkO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaXNVaW50OEFycmF5KHZhbHVlKSB7XG5cdHJldHVybiBpc1R5cGUodmFsdWUsIFVpbnQ4QXJyYXksIHVpbnQ4QXJyYXlTdHJpbmdpZmllZCk7XG59XG5cbmZ1bmN0aW9uIGlzQXJyYXlCdWZmZXIodmFsdWUpIHtcblx0cmV0dXJuIGlzVHlwZSh2YWx1ZSwgQXJyYXlCdWZmZXIsIGFycmF5QnVmZmVyU3RyaW5naWZpZWQpO1xufVxuXG5mdW5jdGlvbiBpc1VpbnQ4QXJyYXlPckFycmF5QnVmZmVyKHZhbHVlKSB7XG5cdHJldHVybiBpc1VpbnQ4QXJyYXkodmFsdWUpIHx8IGlzQXJyYXlCdWZmZXIodmFsdWUpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gYXNzZXJ0VWludDhBcnJheSh2YWx1ZSkge1xuXHRpZiAoIWlzVWludDhBcnJheSh2YWx1ZSkpIHtcblx0XHR0aHJvdyBuZXcgVHlwZUVycm9yKGBFeHBlY3RlZCBcXGBVaW50OEFycmF5XFxgLCBnb3QgXFxgJHt0eXBlb2YgdmFsdWV9XFxgYCk7XG5cdH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGFzc2VydFVpbnQ4QXJyYXlPckFycmF5QnVmZmVyKHZhbHVlKSB7XG5cdGlmICghaXNVaW50OEFycmF5T3JBcnJheUJ1ZmZlcih2YWx1ZSkpIHtcblx0XHR0aHJvdyBuZXcgVHlwZUVycm9yKGBFeHBlY3RlZCBcXGBVaW50OEFycmF5XFxgIG9yIFxcYEFycmF5QnVmZmVyXFxgLCBnb3QgXFxgJHt0eXBlb2YgdmFsdWV9XFxgYCk7XG5cdH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHRvVWludDhBcnJheSh2YWx1ZSkge1xuXHRpZiAodmFsdWUgaW5zdGFuY2VvZiBBcnJheUJ1ZmZlcikge1xuXHRcdHJldHVybiBuZXcgVWludDhBcnJheSh2YWx1ZSk7XG5cdH1cblxuXHRpZiAoQXJyYXlCdWZmZXIuaXNWaWV3KHZhbHVlKSkge1xuXHRcdHJldHVybiBuZXcgVWludDhBcnJheSh2YWx1ZS5idWZmZXIsIHZhbHVlLmJ5dGVPZmZzZXQsIHZhbHVlLmJ5dGVMZW5ndGgpO1xuXHR9XG5cblx0dGhyb3cgbmV3IFR5cGVFcnJvcihgVW5zdXBwb3J0ZWQgdmFsdWUsIGdvdCBcXGAke3R5cGVvZiB2YWx1ZX1cXGAuYCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjb25jYXRVaW50OEFycmF5cyhhcnJheXMsIHRvdGFsTGVuZ3RoKSB7XG5cdGlmIChhcnJheXMubGVuZ3RoID09PSAwKSB7XG5cdFx0cmV0dXJuIG5ldyBVaW50OEFycmF5KDApO1xuXHR9XG5cblx0dG90YWxMZW5ndGggPz89IGFycmF5cy5yZWR1Y2UoKGFjY3VtdWxhdG9yLCBjdXJyZW50VmFsdWUpID0+IGFjY3VtdWxhdG9yICsgY3VycmVudFZhbHVlLmxlbmd0aCwgMCk7XG5cblx0Y29uc3QgcmV0dXJuVmFsdWUgPSBuZXcgVWludDhBcnJheSh0b3RhbExlbmd0aCk7XG5cblx0bGV0IG9mZnNldCA9IDA7XG5cdGZvciAoY29uc3QgYXJyYXkgb2YgYXJyYXlzKSB7XG5cdFx0YXNzZXJ0VWludDhBcnJheShhcnJheSk7XG5cdFx0cmV0dXJuVmFsdWUuc2V0KGFycmF5LCBvZmZzZXQpO1xuXHRcdG9mZnNldCArPSBhcnJheS5sZW5ndGg7XG5cdH1cblxuXHRyZXR1cm4gcmV0dXJuVmFsdWU7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBhcmVVaW50OEFycmF5c0VxdWFsKGEsIGIpIHtcblx0YXNzZXJ0VWludDhBcnJheShhKTtcblx0YXNzZXJ0VWludDhBcnJheShiKTtcblxuXHRpZiAoYSA9PT0gYikge1xuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cblx0aWYgKGEubGVuZ3RoICE9PSBiLmxlbmd0aCkge1xuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXG5cdC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSB1bmljb3JuL25vLWZvci1sb29wXG5cdGZvciAobGV0IGluZGV4ID0gMDsgaW5kZXggPCBhLmxlbmd0aDsgaW5kZXgrKykge1xuXHRcdGlmIChhW2luZGV4XSAhPT0gYltpbmRleF0pIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cdH1cblxuXHRyZXR1cm4gdHJ1ZTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNvbXBhcmVVaW50OEFycmF5cyhhLCBiKSB7XG5cdGFzc2VydFVpbnQ4QXJyYXkoYSk7XG5cdGFzc2VydFVpbnQ4QXJyYXkoYik7XG5cblx0Y29uc3QgbGVuZ3RoID0gTWF0aC5taW4oYS5sZW5ndGgsIGIubGVuZ3RoKTtcblxuXHRmb3IgKGxldCBpbmRleCA9IDA7IGluZGV4IDwgbGVuZ3RoOyBpbmRleCsrKSB7XG5cdFx0Y29uc3QgZGlmZiA9IGFbaW5kZXhdIC0gYltpbmRleF07XG5cdFx0aWYgKGRpZmYgIT09IDApIHtcblx0XHRcdHJldHVybiBNYXRoLnNpZ24oZGlmZik7XG5cdFx0fVxuXHR9XG5cblx0Ly8gQXQgdGhpcyBwb2ludCwgYWxsIHRoZSBjb21wYXJlZCBlbGVtZW50cyBhcmUgZXF1YWwuXG5cdC8vIFRoZSBzaG9ydGVyIGFycmF5IHNob3VsZCBjb21lIGZpcnN0IGlmIHRoZSBhcnJheXMgYXJlIG9mIGRpZmZlcmVudCBsZW5ndGhzLlxuXHRyZXR1cm4gTWF0aC5zaWduKGEubGVuZ3RoIC0gYi5sZW5ndGgpO1xufVxuXG5jb25zdCBjYWNoZWREZWNvZGVycyA9IHtcblx0dXRmODogbmV3IGdsb2JhbFRoaXMuVGV4dERlY29kZXIoJ3V0ZjgnKSxcbn07XG5cbmV4cG9ydCBmdW5jdGlvbiB1aW50OEFycmF5VG9TdHJpbmcoYXJyYXksIGVuY29kaW5nID0gJ3V0ZjgnKSB7XG5cdGFzc2VydFVpbnQ4QXJyYXlPckFycmF5QnVmZmVyKGFycmF5KTtcblx0Y2FjaGVkRGVjb2RlcnNbZW5jb2RpbmddID8/PSBuZXcgZ2xvYmFsVGhpcy5UZXh0RGVjb2RlcihlbmNvZGluZyk7XG5cdHJldHVybiBjYWNoZWREZWNvZGVyc1tlbmNvZGluZ10uZGVjb2RlKGFycmF5KTtcbn1cblxuZnVuY3Rpb24gYXNzZXJ0U3RyaW5nKHZhbHVlKSB7XG5cdGlmICh0eXBlb2YgdmFsdWUgIT09ICdzdHJpbmcnKSB7XG5cdFx0dGhyb3cgbmV3IFR5cGVFcnJvcihgRXhwZWN0ZWQgXFxgc3RyaW5nXFxgLCBnb3QgXFxgJHt0eXBlb2YgdmFsdWV9XFxgYCk7XG5cdH1cbn1cblxuY29uc3QgY2FjaGVkRW5jb2RlciA9IG5ldyBnbG9iYWxUaGlzLlRleHRFbmNvZGVyKCk7XG5cbmV4cG9ydCBmdW5jdGlvbiBzdHJpbmdUb1VpbnQ4QXJyYXkoc3RyaW5nKSB7XG5cdGFzc2VydFN0cmluZyhzdHJpbmcpO1xuXHRyZXR1cm4gY2FjaGVkRW5jb2Rlci5lbmNvZGUoc3RyaW5nKTtcbn1cblxuZnVuY3Rpb24gYmFzZTY0VG9CYXNlNjRVcmwoYmFzZTY0KSB7XG5cdHJldHVybiBiYXNlNjQucmVwbGFjZUFsbCgnKycsICctJykucmVwbGFjZUFsbCgnLycsICdfJykucmVwbGFjZSgvPSskLywgJycpO1xufVxuXG5mdW5jdGlvbiBiYXNlNjRVcmxUb0Jhc2U2NChiYXNlNjR1cmwpIHtcblx0Y29uc3QgYmFzZTY0ID0gYmFzZTY0dXJsLnJlcGxhY2VBbGwoJy0nLCAnKycpLnJlcGxhY2VBbGwoJ18nLCAnLycpO1xuXHRjb25zdCBwYWRkaW5nID0gKDQgLSAoYmFzZTY0Lmxlbmd0aCAlIDQpKSAlIDQ7XG5cdHJldHVybiBiYXNlNjQgKyAnPScucmVwZWF0KHBhZGRpbmcpO1xufVxuXG4vLyBSZWZlcmVuY2U6IGh0dHBzOi8vcGh1b2MubmcvY29sbGVjdGlvbi90aGlzLXZzLXRoYXQvY29uY2F0LXZzLXB1c2gvXG4vLyBJbXBvcnRhbnQ6IEtlZXAgdGhpcyB2YWx1ZSBkaXZpc2libGUgYnkgMyBzbyBpbnRlcm1lZGlhdGUgY2h1bmtzIHByb2R1Y2Ugbm8gQmFzZTY0IHBhZGRpbmcuXG5jb25zdCBNQVhfQkxPQ0tfU0laRSA9IDY1XzUzNTtcblxuZXhwb3J0IGZ1bmN0aW9uIHVpbnQ4QXJyYXlUb0Jhc2U2NChhcnJheSwge3VybFNhZmUgPSBmYWxzZX0gPSB7fSkge1xuXHRhc3NlcnRVaW50OEFycmF5KGFycmF5KTtcblxuXHRsZXQgYmFzZTY0ID0gJyc7XG5cblx0Zm9yIChsZXQgaW5kZXggPSAwOyBpbmRleCA8IGFycmF5Lmxlbmd0aDsgaW5kZXggKz0gTUFYX0JMT0NLX1NJWkUpIHtcblx0XHRjb25zdCBjaHVuayA9IGFycmF5LnN1YmFycmF5KGluZGV4LCBpbmRleCArIE1BWF9CTE9DS19TSVpFKTtcblx0XHQvLyBSZXF1aXJlZCBhcyBgYnRvYWAgYW5kIGBhdG9iYCBkb24ndCBwcm9wZXJseSBzdXBwb3J0IFVuaWNvZGU6IGh0dHBzOi8vZGV2ZWxvcGVyLm1vemlsbGEub3JnL2VuLVVTL2RvY3MvR2xvc3NhcnkvQmFzZTY0I3RoZV91bmljb2RlX3Byb2JsZW1cblx0XHRiYXNlNjQgKz0gZ2xvYmFsVGhpcy5idG9hKFN0cmluZy5mcm9tQ29kZVBvaW50LmFwcGx5KHVuZGVmaW5lZCwgY2h1bmspKTtcblx0fVxuXG5cdHJldHVybiB1cmxTYWZlID8gYmFzZTY0VG9CYXNlNjRVcmwoYmFzZTY0KSA6IGJhc2U2NDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGJhc2U2NFRvVWludDhBcnJheShiYXNlNjRTdHJpbmcpIHtcblx0YXNzZXJ0U3RyaW5nKGJhc2U2NFN0cmluZyk7XG5cdHJldHVybiBVaW50OEFycmF5LmZyb20oZ2xvYmFsVGhpcy5hdG9iKGJhc2U2NFVybFRvQmFzZTY0KGJhc2U2NFN0cmluZykpLCB4ID0+IHguY29kZVBvaW50QXQoMCkpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc3RyaW5nVG9CYXNlNjQoc3RyaW5nLCB7dXJsU2FmZSA9IGZhbHNlfSA9IHt9KSB7XG5cdGFzc2VydFN0cmluZyhzdHJpbmcpO1xuXHRyZXR1cm4gdWludDhBcnJheVRvQmFzZTY0KHN0cmluZ1RvVWludDhBcnJheShzdHJpbmcpLCB7dXJsU2FmZX0pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gYmFzZTY0VG9TdHJpbmcoYmFzZTY0U3RyaW5nKSB7XG5cdGFzc2VydFN0cmluZyhiYXNlNjRTdHJpbmcpO1xuXHRyZXR1cm4gdWludDhBcnJheVRvU3RyaW5nKGJhc2U2NFRvVWludDhBcnJheShiYXNlNjRTdHJpbmcpKTtcbn1cblxuY29uc3QgYnl0ZVRvSGV4TG9va3VwVGFibGUgPSBBcnJheS5mcm9tKHtsZW5ndGg6IDI1Nn0sIChfLCBpbmRleCkgPT4gaW5kZXgudG9TdHJpbmcoMTYpLnBhZFN0YXJ0KDIsICcwJykpO1xuXG5leHBvcnQgZnVuY3Rpb24gdWludDhBcnJheVRvSGV4KGFycmF5KSB7XG5cdGFzc2VydFVpbnQ4QXJyYXkoYXJyYXkpO1xuXG5cdC8vIENvbmNhdGVuYXRpbmcgYSBzdHJpbmcgaXMgZmFzdGVyIHRoYW4gdXNpbmcgYW4gYXJyYXkuXG5cdGxldCBoZXhTdHJpbmcgPSAnJztcblxuXHQvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgdW5pY29ybi9uby1mb3ItbG9vcCAtLSBNYXggcGVyZm9ybWFuY2UgaXMgY3JpdGljYWwuXG5cdGZvciAobGV0IGluZGV4ID0gMDsgaW5kZXggPCBhcnJheS5sZW5ndGg7IGluZGV4KyspIHtcblx0XHRoZXhTdHJpbmcgKz0gYnl0ZVRvSGV4TG9va3VwVGFibGVbYXJyYXlbaW5kZXhdXTtcblx0fVxuXG5cdHJldHVybiBoZXhTdHJpbmc7XG59XG5cbmNvbnN0IGhleFRvRGVjaW1hbExvb2t1cFRhYmxlID0ge1xuXHQwOiAwLFxuXHQxOiAxLFxuXHQyOiAyLFxuXHQzOiAzLFxuXHQ0OiA0LFxuXHQ1OiA1LFxuXHQ2OiA2LFxuXHQ3OiA3LFxuXHQ4OiA4LFxuXHQ5OiA5LFxuXHRhOiAxMCxcblx0YjogMTEsXG5cdGM6IDEyLFxuXHRkOiAxMyxcblx0ZTogMTQsXG5cdGY6IDE1LFxuXHRBOiAxMCxcblx0QjogMTEsXG5cdEM6IDEyLFxuXHREOiAxMyxcblx0RTogMTQsXG5cdEY6IDE1LFxufTtcblxuZXhwb3J0IGZ1bmN0aW9uIGhleFRvVWludDhBcnJheShoZXhTdHJpbmcpIHtcblx0YXNzZXJ0U3RyaW5nKGhleFN0cmluZyk7XG5cblx0aWYgKGhleFN0cmluZy5sZW5ndGggJSAyICE9PSAwKSB7XG5cdFx0dGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIEhleCBzdHJpbmcgbGVuZ3RoLicpO1xuXHR9XG5cblx0Y29uc3QgcmVzdWx0TGVuZ3RoID0gaGV4U3RyaW5nLmxlbmd0aCAvIDI7XG5cdGNvbnN0IGJ5dGVzID0gbmV3IFVpbnQ4QXJyYXkocmVzdWx0TGVuZ3RoKTtcblxuXHRmb3IgKGxldCBpbmRleCA9IDA7IGluZGV4IDwgcmVzdWx0TGVuZ3RoOyBpbmRleCsrKSB7XG5cdFx0Y29uc3QgaGlnaE5pYmJsZSA9IGhleFRvRGVjaW1hbExvb2t1cFRhYmxlW2hleFN0cmluZ1tpbmRleCAqIDJdXTtcblx0XHRjb25zdCBsb3dOaWJibGUgPSBoZXhUb0RlY2ltYWxMb29rdXBUYWJsZVtoZXhTdHJpbmdbKGluZGV4ICogMikgKyAxXV07XG5cblx0XHRpZiAoaGlnaE5pYmJsZSA9PT0gdW5kZWZpbmVkIHx8IGxvd05pYmJsZSA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoYEludmFsaWQgSGV4IGNoYXJhY3RlciBlbmNvdW50ZXJlZCBhdCBwb3NpdGlvbiAke2luZGV4ICogMn1gKTtcblx0XHR9XG5cblx0XHRieXRlc1tpbmRleF0gPSAoaGlnaE5pYmJsZSA8PCA0KSB8IGxvd05pYmJsZTsgLy8gZXNsaW50LWRpc2FibGUtbGluZSBuby1iaXR3aXNlXG5cdH1cblxuXHRyZXR1cm4gYnl0ZXM7XG59XG5cbi8qKlxuQHBhcmFtIHtEYXRhVmlld30gdmlld1xuQHJldHVybnMge251bWJlcn1cbiovXG5leHBvcnQgZnVuY3Rpb24gZ2V0VWludEJFKHZpZXcpIHtcblx0Y29uc3Qge2J5dGVMZW5ndGh9ID0gdmlldztcblxuXHRpZiAoYnl0ZUxlbmd0aCA9PT0gNikge1xuXHRcdHJldHVybiAodmlldy5nZXRVaW50MTYoMCkgKiAoMiAqKiAzMikpICsgdmlldy5nZXRVaW50MzIoMik7XG5cdH1cblxuXHRpZiAoYnl0ZUxlbmd0aCA9PT0gNSkge1xuXHRcdHJldHVybiAodmlldy5nZXRVaW50OCgwKSAqICgyICoqIDMyKSkgKyB2aWV3LmdldFVpbnQzMigxKTtcblx0fVxuXG5cdGlmIChieXRlTGVuZ3RoID09PSA0KSB7XG5cdFx0cmV0dXJuIHZpZXcuZ2V0VWludDMyKDApO1xuXHR9XG5cblx0aWYgKGJ5dGVMZW5ndGggPT09IDMpIHtcblx0XHRyZXR1cm4gKHZpZXcuZ2V0VWludDgoMCkgKiAoMiAqKiAxNikpICsgdmlldy5nZXRVaW50MTYoMSk7XG5cdH1cblxuXHRpZiAoYnl0ZUxlbmd0aCA9PT0gMikge1xuXHRcdHJldHVybiB2aWV3LmdldFVpbnQxNigwKTtcblx0fVxuXG5cdGlmIChieXRlTGVuZ3RoID09PSAxKSB7XG5cdFx0cmV0dXJuIHZpZXcuZ2V0VWludDgoMCk7XG5cdH1cbn1cblxuLyoqXG5AcGFyYW0ge1VpbnQ4QXJyYXl9IGFycmF5XG5AcGFyYW0ge1VpbnQ4QXJyYXl9IHZhbHVlXG5AcmV0dXJucyB7bnVtYmVyfVxuKi9cbmV4cG9ydCBmdW5jdGlvbiBpbmRleE9mKGFycmF5LCB2YWx1ZSkge1xuXHRjb25zdCBhcnJheUxlbmd0aCA9IGFycmF5Lmxlbmd0aDtcblx0Y29uc3QgdmFsdWVMZW5ndGggPSB2YWx1ZS5sZW5ndGg7XG5cblx0aWYgKHZhbHVlTGVuZ3RoID09PSAwKSB7XG5cdFx0cmV0dXJuIC0xO1xuXHR9XG5cblx0aWYgKHZhbHVlTGVuZ3RoID4gYXJyYXlMZW5ndGgpIHtcblx0XHRyZXR1cm4gLTE7XG5cdH1cblxuXHRjb25zdCB2YWxpZE9mZnNldExlbmd0aCA9IGFycmF5TGVuZ3RoIC0gdmFsdWVMZW5ndGg7XG5cblx0Zm9yIChsZXQgaW5kZXggPSAwOyBpbmRleCA8PSB2YWxpZE9mZnNldExlbmd0aDsgaW5kZXgrKykge1xuXHRcdGxldCBpc01hdGNoID0gdHJ1ZTtcblx0XHRmb3IgKGxldCBpbmRleDIgPSAwOyBpbmRleDIgPCB2YWx1ZUxlbmd0aDsgaW5kZXgyKyspIHtcblx0XHRcdGlmIChhcnJheVtpbmRleCArIGluZGV4Ml0gIT09IHZhbHVlW2luZGV4Ml0pIHtcblx0XHRcdFx0aXNNYXRjaCA9IGZhbHNlO1xuXHRcdFx0XHRicmVhaztcblx0XHRcdH1cblx0XHR9XG5cblx0XHRpZiAoaXNNYXRjaCkge1xuXHRcdFx0cmV0dXJuIGluZGV4O1xuXHRcdH1cblx0fVxuXG5cdHJldHVybiAtMTtcbn1cblxuLyoqXG5AcGFyYW0ge1VpbnQ4QXJyYXl9IGFycmF5XG5AcGFyYW0ge1VpbnQ4QXJyYXl9IHZhbHVlXG5AcmV0dXJucyB7Ym9vbGVhbn1cbiovXG5leHBvcnQgZnVuY3Rpb24gaW5jbHVkZXMoYXJyYXksIHZhbHVlKSB7XG5cdHJldHVybiBpbmRleE9mKGFycmF5LCB2YWx1ZSkgIT09IC0xO1xufVxuIiwKICAgICJpbXBvcnQge1N0cmluZ1R5cGV9IGZyb20gJ3Rva2VuLXR5cGVzJztcblxuZXhwb3J0IGZ1bmN0aW9uIHN0cmluZ1RvQnl0ZXMoc3RyaW5nLCBlbmNvZGluZykge1xuXHRpZiAoZW5jb2RpbmcgPT09ICd1dGYtMTZsZScpIHtcblx0XHRjb25zdCBieXRlcyA9IFtdO1xuXHRcdGZvciAobGV0IGluZGV4ID0gMDsgaW5kZXggPCBzdHJpbmcubGVuZ3RoOyBpbmRleCsrKSB7XG5cdFx0XHRjb25zdCBjb2RlID0gc3RyaW5nLmNoYXJDb2RlQXQoaW5kZXgpOyAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIHVuaWNvcm4vcHJlZmVyLWNvZGUtcG9pbnRcblx0XHRcdGJ5dGVzLnB1c2goY29kZSAmIDB4RkYsIChjb2RlID4+IDgpICYgMHhGRik7IC8vIEhpZ2ggYnl0ZVxuXHRcdH1cblxuXHRcdHJldHVybiBieXRlcztcblx0fVxuXG5cdGlmIChlbmNvZGluZyA9PT0gJ3V0Zi0xNmJlJykge1xuXHRcdGNvbnN0IGJ5dGVzID0gW107XG5cdFx0Zm9yIChsZXQgaW5kZXggPSAwOyBpbmRleCA8IHN0cmluZy5sZW5ndGg7IGluZGV4KyspIHtcblx0XHRcdGNvbnN0IGNvZGUgPSBzdHJpbmcuY2hhckNvZGVBdChpbmRleCk7IC8vIGVzbGludC1kaXNhYmxlLWxpbmUgdW5pY29ybi9wcmVmZXItY29kZS1wb2ludFxuXHRcdFx0Ynl0ZXMucHVzaCgoY29kZSA+PiA4KSAmIDB4RkYsIGNvZGUgJiAweEZGKTsgLy8gTG93IGJ5dGVcblx0XHR9XG5cblx0XHRyZXR1cm4gYnl0ZXM7XG5cdH1cblxuXHRyZXR1cm4gWy4uLnN0cmluZ10ubWFwKGNoYXJhY3RlciA9PiBjaGFyYWN0ZXIuY2hhckNvZGVBdCgwKSk7IC8vIGVzbGludC1kaXNhYmxlLWxpbmUgdW5pY29ybi9wcmVmZXItY29kZS1wb2ludFxufVxuXG4vKipcbkNoZWNrcyB3aGV0aGVyIHRoZSBUQVIgY2hlY2tzdW0gaXMgdmFsaWQuXG5cbkBwYXJhbSB7VWludDhBcnJheX0gYXJyYXlCdWZmZXIgLSBUaGUgVEFSIGhlYWRlciBgW29mZnNldCAuLi4gb2Zmc2V0ICsgNTEyXWAuXG5AcGFyYW0ge251bWJlcn0gb2Zmc2V0IC0gVEFSIGhlYWRlciBvZmZzZXQuXG5AcmV0dXJucyB7Ym9vbGVhbn0gYHRydWVgIGlmIHRoZSBUQVIgY2hlY2tzdW0gaXMgdmFsaWQsIG90aGVyd2lzZSBgZmFsc2VgLlxuKi9cbmV4cG9ydCBmdW5jdGlvbiB0YXJIZWFkZXJDaGVja3N1bU1hdGNoZXMoYXJyYXlCdWZmZXIsIG9mZnNldCA9IDApIHtcblx0Y29uc3QgcmVhZFN1bSA9IE51bWJlci5wYXJzZUludChuZXcgU3RyaW5nVHlwZSg2KS5nZXQoYXJyYXlCdWZmZXIsIDE0OCkucmVwbGFjZSgvXFwwLiokLywgJycpLnRyaW0oKSwgOCk7IC8vIFJlYWQgc3VtIGluIGhlYWRlclxuXHRpZiAoTnVtYmVyLmlzTmFOKHJlYWRTdW0pKSB7XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cblx0bGV0IHN1bSA9IDggKiAweDIwOyAvLyBJbml0aWFsaXplIHNpZ25lZCBiaXQgc3VtXG5cblx0Zm9yIChsZXQgaW5kZXggPSBvZmZzZXQ7IGluZGV4IDwgb2Zmc2V0ICsgMTQ4OyBpbmRleCsrKSB7XG5cdFx0c3VtICs9IGFycmF5QnVmZmVyW2luZGV4XTtcblx0fVxuXG5cdGZvciAobGV0IGluZGV4ID0gb2Zmc2V0ICsgMTU2OyBpbmRleCA8IG9mZnNldCArIDUxMjsgaW5kZXgrKykge1xuXHRcdHN1bSArPSBhcnJheUJ1ZmZlcltpbmRleF07XG5cdH1cblxuXHRyZXR1cm4gcmVhZFN1bSA9PT0gc3VtO1xufVxuXG4vKipcbklEMyBVSU5UMzIgc3luYy1zYWZlIHRva2VuaXplciB0b2tlbi5cbjI4IGJpdHMgKHJlcHJlc2VudGluZyB1cCB0byAyNTZNQikgaW50ZWdlciwgdGhlIG1zYiBpcyAwIHRvIGF2b2lkIFwiZmFsc2Ugc3luY3NpZ25hbHNcIi5cbiovXG5leHBvcnQgY29uc3QgdWludDMyU3luY1NhZmVUb2tlbiA9IHtcblx0Z2V0OiAoYnVmZmVyLCBvZmZzZXQpID0+IChidWZmZXJbb2Zmc2V0ICsgM10gJiAweDdGKSB8ICgoYnVmZmVyW29mZnNldCArIDJdKSA8PCA3KSB8ICgoYnVmZmVyW29mZnNldCArIDFdKSA8PCAxNCkgfCAoKGJ1ZmZlcltvZmZzZXRdKSA8PCAyMSksXG5cdGxlbjogNCxcbn07XG4iLAogICAgImV4cG9ydCBjb25zdCBleHRlbnNpb25zID0gW1xuXHQnanBnJyxcblx0J3BuZycsXG5cdCdhcG5nJyxcblx0J2dpZicsXG5cdCd3ZWJwJyxcblx0J2ZsaWYnLFxuXHQneGNmJyxcblx0J2NyMicsXG5cdCdjcjMnLFxuXHQnb3JmJyxcblx0J2FydycsXG5cdCdkbmcnLFxuXHQnbmVmJyxcblx0J3J3MicsXG5cdCdyYWYnLFxuXHQndGlmJyxcblx0J2JtcCcsXG5cdCdpY25zJyxcblx0J2p4cicsXG5cdCdwc2QnLFxuXHQnaW5kZCcsXG5cdCd6aXAnLFxuXHQndGFyJyxcblx0J3JhcicsXG5cdCdneicsXG5cdCdiejInLFxuXHQnN3onLFxuXHQnZG1nJyxcblx0J21wNCcsXG5cdCdtaWQnLFxuXHQnbWt2Jyxcblx0J3dlYm0nLFxuXHQnbW92Jyxcblx0J2F2aScsXG5cdCdtcGcnLFxuXHQnbXAyJyxcblx0J21wMycsXG5cdCdtNGEnLFxuXHQnb2dhJyxcblx0J29nZycsXG5cdCdvZ3YnLFxuXHQnb3B1cycsXG5cdCdmbGFjJyxcblx0J3dhdicsXG5cdCdzcHgnLFxuXHQnYW1yJyxcblx0J3BkZicsXG5cdCdlcHViJyxcblx0J2VsZicsXG5cdCdtYWNobycsXG5cdCdleGUnLFxuXHQnc3dmJyxcblx0J3J0ZicsXG5cdCd3YXNtJyxcblx0J3dvZmYnLFxuXHQnd29mZjInLFxuXHQnZW90Jyxcblx0J3R0ZicsXG5cdCdvdGYnLFxuXHQndHRjJyxcblx0J2ljbycsXG5cdCdmbHYnLFxuXHQncHMnLFxuXHQneHonLFxuXHQnc3FsaXRlJyxcblx0J25lcycsXG5cdCdjcngnLFxuXHQneHBpJyxcblx0J2NhYicsXG5cdCdkZWInLFxuXHQnYXInLFxuXHQncnBtJyxcblx0J1onLFxuXHQnbHonLFxuXHQnY2ZiJyxcblx0J214ZicsXG5cdCdtdHMnLFxuXHQnYmxlbmQnLFxuXHQnYnBnJyxcblx0J2RvY3gnLFxuXHQncHB0eCcsXG5cdCd4bHN4Jyxcblx0JzNncCcsXG5cdCczZzInLFxuXHQnajJjJyxcblx0J2pwMicsXG5cdCdqcG0nLFxuXHQnanB4Jyxcblx0J21qMicsXG5cdCdhaWYnLFxuXHQncWNwJyxcblx0J29kdCcsXG5cdCdvZHMnLFxuXHQnb2RwJyxcblx0J3htbCcsXG5cdCdtb2JpJyxcblx0J2hlaWMnLFxuXHQnY3VyJyxcblx0J2t0eCcsXG5cdCdhcGUnLFxuXHQnd3YnLFxuXHQnZGNtJyxcblx0J2ljcycsXG5cdCdnbGInLFxuXHQncGNhcCcsXG5cdCdkc2YnLFxuXHQnbG5rJyxcblx0J2FsaWFzJyxcblx0J3ZvYycsXG5cdCdhYzMnLFxuXHQnbTR2Jyxcblx0J200cCcsXG5cdCdtNGInLFxuXHQnZjR2Jyxcblx0J2Y0cCcsXG5cdCdmNGInLFxuXHQnZjRhJyxcblx0J21pZScsXG5cdCdhc2YnLFxuXHQnb2dtJyxcblx0J29neCcsXG5cdCdtcGMnLFxuXHQnYXJyb3cnLFxuXHQnc2hwJyxcblx0J2FhYycsXG5cdCdtcDEnLFxuXHQnaXQnLFxuXHQnczNtJyxcblx0J3htJyxcblx0J3NrcCcsXG5cdCdhdmlmJyxcblx0J2VwcycsXG5cdCdsemgnLFxuXHQncGdwJyxcblx0J2FzYXInLFxuXHQnc3RsJyxcblx0J2NobScsXG5cdCczbWYnLFxuXHQnenN0Jyxcblx0J2p4bCcsXG5cdCd2Y2YnLFxuXHQnamxzJyxcblx0J3BzdCcsXG5cdCdkd2cnLFxuXHQncGFycXVldCcsXG5cdCdjbGFzcycsXG5cdCdhcmonLFxuXHQnY3BpbycsXG5cdCdhY2UnLFxuXHQnYXZybycsXG5cdCdpY2MnLFxuXHQnZmJ4Jyxcblx0J3ZzZHgnLFxuXHQndnR0Jyxcblx0J2FwaycsXG5cdCdkcmMnLFxuXHQnbHo0Jyxcblx0J3BvdHgnLFxuXHQneGx0eCcsXG5cdCdkb3R4Jyxcblx0J3hsdG0nLFxuXHQnb3R0Jyxcblx0J290cycsXG5cdCdvdHAnLFxuXHQnb2RnJyxcblx0J290ZycsXG5cdCd4bHNtJyxcblx0J2RvY20nLFxuXHQnZG90bScsXG5cdCdwb3RtJyxcblx0J3BwdG0nLFxuXHQnamFyJyxcblx0J3JtJyxcblx0J3Bwc20nLFxuXHQncHBzeCcsXG5cdCd0YXIuZ3onLFxuXHQncmVnJyxcblx0J2RhdCcsXG5dO1xuXG5leHBvcnQgY29uc3QgbWltZVR5cGVzID0gW1xuXHQnaW1hZ2UvanBlZycsXG5cdCdpbWFnZS9wbmcnLFxuXHQnaW1hZ2UvZ2lmJyxcblx0J2ltYWdlL3dlYnAnLFxuXHQnaW1hZ2UvZmxpZicsXG5cdCdpbWFnZS94LXhjZicsXG5cdCdpbWFnZS94LWNhbm9uLWNyMicsXG5cdCdpbWFnZS94LWNhbm9uLWNyMycsXG5cdCdpbWFnZS90aWZmJyxcblx0J2ltYWdlL2JtcCcsXG5cdCdpbWFnZS92bmQubXMtcGhvdG8nLFxuXHQnaW1hZ2Uvdm5kLmFkb2JlLnBob3Rvc2hvcCcsXG5cdCdhcHBsaWNhdGlvbi94LWluZGVzaWduJyxcblx0J2FwcGxpY2F0aW9uL2VwdWIremlwJyxcblx0J2FwcGxpY2F0aW9uL3gteHBpbnN0YWxsJyxcblx0J2FwcGxpY2F0aW9uL3ZuZC5tcy1wb3dlcnBvaW50LnNsaWRlc2hvdy5tYWNyb2VuYWJsZWQuMTInLFxuXHQnYXBwbGljYXRpb24vdm5kLm9hc2lzLm9wZW5kb2N1bWVudC50ZXh0Jyxcblx0J2FwcGxpY2F0aW9uL3ZuZC5vYXNpcy5vcGVuZG9jdW1lbnQuc3ByZWFkc2hlZXQnLFxuXHQnYXBwbGljYXRpb24vdm5kLm9hc2lzLm9wZW5kb2N1bWVudC5wcmVzZW50YXRpb24nLFxuXHQnYXBwbGljYXRpb24vdm5kLm9wZW54bWxmb3JtYXRzLW9mZmljZWRvY3VtZW50LndvcmRwcm9jZXNzaW5nbWwuZG9jdW1lbnQnLFxuXHQnYXBwbGljYXRpb24vdm5kLm9wZW54bWxmb3JtYXRzLW9mZmljZWRvY3VtZW50LnByZXNlbnRhdGlvbm1sLnByZXNlbnRhdGlvbicsXG5cdCdhcHBsaWNhdGlvbi92bmQub3BlbnhtbGZvcm1hdHMtb2ZmaWNlZG9jdW1lbnQuc3ByZWFkc2hlZXRtbC5zaGVldCcsXG5cdCdhcHBsaWNhdGlvbi92bmQub3BlbnhtbGZvcm1hdHMtb2ZmaWNlZG9jdW1lbnQucHJlc2VudGF0aW9ubWwuc2xpZGVzaG93Jyxcblx0J2FwcGxpY2F0aW9uL3ppcCcsXG5cdCdhcHBsaWNhdGlvbi94LXRhcicsXG5cdCdhcHBsaWNhdGlvbi94LXJhci1jb21wcmVzc2VkJyxcblx0J2FwcGxpY2F0aW9uL2d6aXAnLFxuXHQnYXBwbGljYXRpb24veC1iemlwMicsXG5cdCdhcHBsaWNhdGlvbi94LTd6LWNvbXByZXNzZWQnLFxuXHQnYXBwbGljYXRpb24veC1hcHBsZS1kaXNraW1hZ2UnLFxuXHQnYXBwbGljYXRpb24vdm5kLmFwYWNoZS5hcnJvdy5maWxlJyxcblx0J3ZpZGVvL21wNCcsXG5cdCdhdWRpby9taWRpJyxcblx0J3ZpZGVvL21hdHJvc2thJyxcblx0J3ZpZGVvL3dlYm0nLFxuXHQndmlkZW8vcXVpY2t0aW1lJyxcblx0J3ZpZGVvL3ZuZC5hdmknLFxuXHQnYXVkaW8vd2F2Jyxcblx0J2F1ZGlvL3FjZWxwJyxcblx0J2F1ZGlvL3gtbXMtYXNmJyxcblx0J3ZpZGVvL3gtbXMtYXNmJyxcblx0J2FwcGxpY2F0aW9uL3ZuZC5tcy1hc2YnLFxuXHQndmlkZW8vbXBlZycsXG5cdCd2aWRlby8zZ3BwJyxcblx0J2F1ZGlvL21wZWcnLFxuXHQnYXVkaW8vbXA0JywgLy8gUkZDIDQzMzdcblx0J3ZpZGVvL29nZycsXG5cdCdhdWRpby9vZ2cnLFxuXHQnYXVkaW8vb2dnOyBjb2RlY3M9b3B1cycsXG5cdCdhcHBsaWNhdGlvbi9vZ2cnLFxuXHQnYXVkaW8vZmxhYycsXG5cdCdhdWRpby9hcGUnLFxuXHQnYXVkaW8vd2F2cGFjaycsXG5cdCdhdWRpby9hbXInLFxuXHQnYXBwbGljYXRpb24vcGRmJyxcblx0J2FwcGxpY2F0aW9uL3gtZWxmJyxcblx0J2FwcGxpY2F0aW9uL3gtbWFjaC1iaW5hcnknLFxuXHQnYXBwbGljYXRpb24veC1tc2Rvd25sb2FkJyxcblx0J2FwcGxpY2F0aW9uL3gtc2hvY2t3YXZlLWZsYXNoJyxcblx0J2FwcGxpY2F0aW9uL3J0ZicsXG5cdCdhcHBsaWNhdGlvbi93YXNtJyxcblx0J2ZvbnQvd29mZicsXG5cdCdmb250L3dvZmYyJyxcblx0J2FwcGxpY2F0aW9uL3ZuZC5tcy1mb250b2JqZWN0Jyxcblx0J2ZvbnQvdHRmJyxcblx0J2ZvbnQvb3RmJyxcblx0J2ZvbnQvY29sbGVjdGlvbicsXG5cdCdpbWFnZS94LWljb24nLFxuXHQndmlkZW8veC1mbHYnLFxuXHQnYXBwbGljYXRpb24vcG9zdHNjcmlwdCcsXG5cdCdhcHBsaWNhdGlvbi9lcHMnLFxuXHQnYXBwbGljYXRpb24veC14eicsXG5cdCdhcHBsaWNhdGlvbi94LXNxbGl0ZTMnLFxuXHQnYXBwbGljYXRpb24veC1uaW50ZW5kby1uZXMtcm9tJyxcblx0J2FwcGxpY2F0aW9uL3gtZ29vZ2xlLWNocm9tZS1leHRlbnNpb24nLFxuXHQnYXBwbGljYXRpb24vdm5kLm1zLWNhYi1jb21wcmVzc2VkJyxcblx0J2FwcGxpY2F0aW9uL3gtZGViJyxcblx0J2FwcGxpY2F0aW9uL3gtdW5peC1hcmNoaXZlJyxcblx0J2FwcGxpY2F0aW9uL3gtcnBtJyxcblx0J2FwcGxpY2F0aW9uL3gtY29tcHJlc3MnLFxuXHQnYXBwbGljYXRpb24veC1semlwJyxcblx0J2FwcGxpY2F0aW9uL3gtY2ZiJyxcblx0J2FwcGxpY2F0aW9uL3gtbWllJyxcblx0J2FwcGxpY2F0aW9uL214ZicsXG5cdCd2aWRlby9tcDJ0Jyxcblx0J2FwcGxpY2F0aW9uL3gtYmxlbmRlcicsXG5cdCdpbWFnZS9icGcnLFxuXHQnaW1hZ2UvajJjJyxcblx0J2ltYWdlL2pwMicsXG5cdCdpbWFnZS9qcHgnLFxuXHQnaW1hZ2UvanBtJyxcblx0J2ltYWdlL21qMicsXG5cdCdhdWRpby9haWZmJyxcblx0J2FwcGxpY2F0aW9uL3htbCcsXG5cdCdhcHBsaWNhdGlvbi94LW1vYmlwb2NrZXQtZWJvb2snLFxuXHQnaW1hZ2UvaGVpZicsXG5cdCdpbWFnZS9oZWlmLXNlcXVlbmNlJyxcblx0J2ltYWdlL2hlaWMnLFxuXHQnaW1hZ2UvaGVpYy1zZXF1ZW5jZScsXG5cdCdpbWFnZS9pY25zJyxcblx0J2ltYWdlL2t0eCcsXG5cdCdhcHBsaWNhdGlvbi9kaWNvbScsXG5cdCdhdWRpby94LW11c2VwYWNrJyxcblx0J3RleHQvY2FsZW5kYXInLFxuXHQndGV4dC92Y2FyZCcsXG5cdCd0ZXh0L3Z0dCcsXG5cdCdtb2RlbC9nbHRmLWJpbmFyeScsXG5cdCdhcHBsaWNhdGlvbi92bmQudGNwZHVtcC5wY2FwJyxcblx0J2F1ZGlvL3gtZHNmJywgLy8gTm9uLXN0YW5kYXJkXG5cdCdhcHBsaWNhdGlvbi94Lm1zLnNob3J0Y3V0JywgLy8gSW52ZW50ZWQgYnkgdXNcblx0J2FwcGxpY2F0aW9uL3guYXBwbGUuYWxpYXMnLCAvLyBJbnZlbnRlZCBieSB1c1xuXHQnYXVkaW8veC12b2MnLFxuXHQnYXVkaW8vdm5kLmRvbGJ5LmRkLXJhdycsXG5cdCdhdWRpby94LW00YScsXG5cdCdpbWFnZS9hcG5nJyxcblx0J2ltYWdlL3gtb2x5bXB1cy1vcmYnLFxuXHQnaW1hZ2UveC1zb255LWFydycsXG5cdCdpbWFnZS94LWFkb2JlLWRuZycsXG5cdCdpbWFnZS94LW5pa29uLW5lZicsXG5cdCdpbWFnZS94LXBhbmFzb25pYy1ydzInLFxuXHQnaW1hZ2UveC1mdWppZmlsbS1yYWYnLFxuXHQndmlkZW8veC1tNHYnLFxuXHQndmlkZW8vM2dwcDInLFxuXHQnYXBwbGljYXRpb24veC1lc3JpLXNoYXBlJyxcblx0J2F1ZGlvL2FhYycsXG5cdCdhdWRpby94LWl0Jyxcblx0J2F1ZGlvL3gtczNtJyxcblx0J2F1ZGlvL3gteG0nLFxuXHQndmlkZW8vTVAxUycsXG5cdCd2aWRlby9NUDJQJyxcblx0J2FwcGxpY2F0aW9uL3ZuZC5za2V0Y2h1cC5za3AnLFxuXHQnaW1hZ2UvYXZpZicsXG5cdCdhcHBsaWNhdGlvbi94LWx6aC1jb21wcmVzc2VkJyxcblx0J2FwcGxpY2F0aW9uL3BncC1lbmNyeXB0ZWQnLFxuXHQnYXBwbGljYXRpb24veC1hc2FyJyxcblx0J21vZGVsL3N0bCcsXG5cdCdhcHBsaWNhdGlvbi92bmQubXMtaHRtbGhlbHAnLFxuXHQnbW9kZWwvM21mJyxcblx0J2ltYWdlL2p4bCcsXG5cdCdhcHBsaWNhdGlvbi96c3RkJyxcblx0J2ltYWdlL2pscycsXG5cdCdhcHBsaWNhdGlvbi92bmQubXMtb3V0bG9vaycsXG5cdCdpbWFnZS92bmQuZHdnJyxcblx0J2FwcGxpY2F0aW9uL3ZuZC5hcGFjaGUucGFycXVldCcsXG5cdCdhcHBsaWNhdGlvbi9qYXZhLXZtJyxcblx0J2FwcGxpY2F0aW9uL3gtYXJqJyxcblx0J2FwcGxpY2F0aW9uL3gtY3BpbycsXG5cdCdhcHBsaWNhdGlvbi94LWFjZS1jb21wcmVzc2VkJyxcblx0J2FwcGxpY2F0aW9uL2F2cm8nLFxuXHQnYXBwbGljYXRpb24vdm5kLmljY3Byb2ZpbGUnLFxuXHQnYXBwbGljYXRpb24veC5hdXRvZGVzay5mYngnLCAvLyBJbnZlbnRlZCBieSB1c1xuXHQnYXBwbGljYXRpb24vdm5kLnZpc2lvJyxcblx0J2FwcGxpY2F0aW9uL3ZuZC5hbmRyb2lkLnBhY2thZ2UtYXJjaGl2ZScsXG5cdCdhcHBsaWNhdGlvbi92bmQuZ29vZ2xlLmRyYWNvJywgLy8gSW52ZW50ZWQgYnkgdXNcblx0J2FwcGxpY2F0aW9uL3gtbHo0JywgLy8gSW52ZW50ZWQgYnkgdXNcblx0J2FwcGxpY2F0aW9uL3ZuZC5vcGVueG1sZm9ybWF0cy1vZmZpY2Vkb2N1bWVudC5wcmVzZW50YXRpb25tbC50ZW1wbGF0ZScsXG5cdCdhcHBsaWNhdGlvbi92bmQub3BlbnhtbGZvcm1hdHMtb2ZmaWNlZG9jdW1lbnQuc3ByZWFkc2hlZXRtbC50ZW1wbGF0ZScsXG5cdCdhcHBsaWNhdGlvbi92bmQub3BlbnhtbGZvcm1hdHMtb2ZmaWNlZG9jdW1lbnQud29yZHByb2Nlc3NpbmdtbC50ZW1wbGF0ZScsXG5cdCdhcHBsaWNhdGlvbi92bmQubXMtZXhjZWwudGVtcGxhdGUubWFjcm9lbmFibGVkLjEyJyxcblx0J2FwcGxpY2F0aW9uL3ZuZC5vYXNpcy5vcGVuZG9jdW1lbnQudGV4dC10ZW1wbGF0ZScsXG5cdCdhcHBsaWNhdGlvbi92bmQub2FzaXMub3BlbmRvY3VtZW50LnNwcmVhZHNoZWV0LXRlbXBsYXRlJyxcblx0J2FwcGxpY2F0aW9uL3ZuZC5vYXNpcy5vcGVuZG9jdW1lbnQucHJlc2VudGF0aW9uLXRlbXBsYXRlJyxcblx0J2FwcGxpY2F0aW9uL3ZuZC5vYXNpcy5vcGVuZG9jdW1lbnQuZ3JhcGhpY3MnLFxuXHQnYXBwbGljYXRpb24vdm5kLm9hc2lzLm9wZW5kb2N1bWVudC5ncmFwaGljcy10ZW1wbGF0ZScsXG5cdCdhcHBsaWNhdGlvbi92bmQubXMtZXhjZWwuc2hlZXQubWFjcm9lbmFibGVkLjEyJyxcblx0J2FwcGxpY2F0aW9uL3ZuZC5tcy13b3JkLmRvY3VtZW50Lm1hY3JvZW5hYmxlZC4xMicsXG5cdCdhcHBsaWNhdGlvbi92bmQubXMtd29yZC50ZW1wbGF0ZS5tYWNyb2VuYWJsZWQuMTInLFxuXHQnYXBwbGljYXRpb24vdm5kLm1zLXBvd2VycG9pbnQudGVtcGxhdGUubWFjcm9lbmFibGVkLjEyJyxcblx0J2FwcGxpY2F0aW9uL3ZuZC5tcy1wb3dlcnBvaW50LnByZXNlbnRhdGlvbi5tYWNyb2VuYWJsZWQuMTInLFxuXHQnYXBwbGljYXRpb24vamF2YS1hcmNoaXZlJyxcblx0J2FwcGxpY2F0aW9uL3ZuZC5ybi1yZWFsbWVkaWEnLFxuXHQnYXBwbGljYXRpb24veC1tcy1yZWdlZGl0Jyxcblx0J2FwcGxpY2F0aW9uL3gtZnQtd2luZG93cy1yZWdpc3RyeS1oaXZlJyxcbl07XG4iLAogICAgIi8qKlxuUHJpbWFyeSBlbnRyeSBwb2ludCwgTm9kZS5qcyBzcGVjaWZpYyBlbnRyeSBwb2ludCBpcyBpbmRleC5qc1xuKi9cblxuaW1wb3J0ICogYXMgVG9rZW4gZnJvbSAndG9rZW4tdHlwZXMnO1xuaW1wb3J0ICogYXMgc3RydG9rMyBmcm9tICdzdHJ0b2szL2NvcmUnO1xuaW1wb3J0IHtaaXBIYW5kbGVyLCBHemlwSGFuZGxlcn0gZnJvbSAnQHRva2VuaXplci9pbmZsYXRlJztcbmltcG9ydCB7Z2V0VWludEJFfSBmcm9tICd1aW50OGFycmF5LWV4dHJhcyc7XG5pbXBvcnQge1xuXHRzdHJpbmdUb0J5dGVzLFxuXHR0YXJIZWFkZXJDaGVja3N1bU1hdGNoZXMsXG5cdHVpbnQzMlN5bmNTYWZlVG9rZW4sXG59IGZyb20gJy4vdXRpbC5qcyc7XG5pbXBvcnQge2V4dGVuc2lvbnMsIG1pbWVUeXBlc30gZnJvbSAnLi9zdXBwb3J0ZWQuanMnO1xuXG5leHBvcnQgY29uc3QgcmVhc29uYWJsZURldGVjdGlvblNpemVJbkJ5dGVzID0gNDEwMDsgLy8gQSBmYWlyIGFtb3VudCBvZiBmaWxlLXR5cGVzIGFyZSBkZXRlY3RhYmxlIHdpdGhpbiB0aGlzIHJhbmdlLlxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZmlsZVR5cGVGcm9tU3RyZWFtKHN0cmVhbSwgb3B0aW9ucykge1xuXHRyZXR1cm4gbmV3IEZpbGVUeXBlUGFyc2VyKG9wdGlvbnMpLmZyb21TdHJlYW0oc3RyZWFtKTtcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGZpbGVUeXBlRnJvbUJ1ZmZlcihpbnB1dCwgb3B0aW9ucykge1xuXHRyZXR1cm4gbmV3IEZpbGVUeXBlUGFyc2VyKG9wdGlvbnMpLmZyb21CdWZmZXIoaW5wdXQpO1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZmlsZVR5cGVGcm9tQmxvYihibG9iLCBvcHRpb25zKSB7XG5cdHJldHVybiBuZXcgRmlsZVR5cGVQYXJzZXIob3B0aW9ucykuZnJvbUJsb2IoYmxvYik7XG59XG5cbmZ1bmN0aW9uIGdldEZpbGVUeXBlRnJvbU1pbWVUeXBlKG1pbWVUeXBlKSB7XG5cdG1pbWVUeXBlID0gbWltZVR5cGUudG9Mb3dlckNhc2UoKTtcblx0c3dpdGNoIChtaW1lVHlwZSkge1xuXHRcdGNhc2UgJ2FwcGxpY2F0aW9uL2VwdWIremlwJzpcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGV4dDogJ2VwdWInLFxuXHRcdFx0XHRtaW1lOiBtaW1lVHlwZSxcblx0XHRcdH07XG5cdFx0Y2FzZSAnYXBwbGljYXRpb24vdm5kLm9hc2lzLm9wZW5kb2N1bWVudC50ZXh0Jzpcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGV4dDogJ29kdCcsXG5cdFx0XHRcdG1pbWU6IG1pbWVUeXBlLFxuXHRcdFx0fTtcblx0XHRjYXNlICdhcHBsaWNhdGlvbi92bmQub2FzaXMub3BlbmRvY3VtZW50LnRleHQtdGVtcGxhdGUnOlxuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0ZXh0OiAnb3R0Jyxcblx0XHRcdFx0bWltZTogbWltZVR5cGUsXG5cdFx0XHR9O1xuXHRcdGNhc2UgJ2FwcGxpY2F0aW9uL3ZuZC5vYXNpcy5vcGVuZG9jdW1lbnQuc3ByZWFkc2hlZXQnOlxuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0ZXh0OiAnb2RzJyxcblx0XHRcdFx0bWltZTogbWltZVR5cGUsXG5cdFx0XHR9O1xuXHRcdGNhc2UgJ2FwcGxpY2F0aW9uL3ZuZC5vYXNpcy5vcGVuZG9jdW1lbnQuc3ByZWFkc2hlZXQtdGVtcGxhdGUnOlxuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0ZXh0OiAnb3RzJyxcblx0XHRcdFx0bWltZTogbWltZVR5cGUsXG5cdFx0XHR9O1xuXHRcdGNhc2UgJ2FwcGxpY2F0aW9uL3ZuZC5vYXNpcy5vcGVuZG9jdW1lbnQucHJlc2VudGF0aW9uJzpcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGV4dDogJ29kcCcsXG5cdFx0XHRcdG1pbWU6IG1pbWVUeXBlLFxuXHRcdFx0fTtcblx0XHRjYXNlICdhcHBsaWNhdGlvbi92bmQub2FzaXMub3BlbmRvY3VtZW50LnByZXNlbnRhdGlvbi10ZW1wbGF0ZSc6XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRleHQ6ICdvdHAnLFxuXHRcdFx0XHRtaW1lOiBtaW1lVHlwZSxcblx0XHRcdH07XG5cdFx0Y2FzZSAnYXBwbGljYXRpb24vdm5kLm9hc2lzLm9wZW5kb2N1bWVudC5ncmFwaGljcyc6XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRleHQ6ICdvZGcnLFxuXHRcdFx0XHRtaW1lOiBtaW1lVHlwZSxcblx0XHRcdH07XG5cdFx0Y2FzZSAnYXBwbGljYXRpb24vdm5kLm9hc2lzLm9wZW5kb2N1bWVudC5ncmFwaGljcy10ZW1wbGF0ZSc6XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRleHQ6ICdvdGcnLFxuXHRcdFx0XHRtaW1lOiBtaW1lVHlwZSxcblx0XHRcdH07XG5cdFx0Y2FzZSAnYXBwbGljYXRpb24vdm5kLm9wZW54bWxmb3JtYXRzLW9mZmljZWRvY3VtZW50LnByZXNlbnRhdGlvbm1sLnNsaWRlc2hvdyc6XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRleHQ6ICdwcHN4Jyxcblx0XHRcdFx0bWltZTogbWltZVR5cGUsXG5cdFx0XHR9O1xuXHRcdGNhc2UgJ2FwcGxpY2F0aW9uL3ZuZC5vcGVueG1sZm9ybWF0cy1vZmZpY2Vkb2N1bWVudC5zcHJlYWRzaGVldG1sLnNoZWV0Jzpcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGV4dDogJ3hsc3gnLFxuXHRcdFx0XHRtaW1lOiBtaW1lVHlwZSxcblx0XHRcdH07XG5cdFx0Y2FzZSAnYXBwbGljYXRpb24vdm5kLm1zLWV4Y2VsLnNoZWV0Lm1hY3JvZW5hYmxlZCc6XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRleHQ6ICd4bHNtJyxcblx0XHRcdFx0bWltZTogJ2FwcGxpY2F0aW9uL3ZuZC5tcy1leGNlbC5zaGVldC5tYWNyb2VuYWJsZWQuMTInLFxuXHRcdFx0fTtcblx0XHRjYXNlICdhcHBsaWNhdGlvbi92bmQub3BlbnhtbGZvcm1hdHMtb2ZmaWNlZG9jdW1lbnQuc3ByZWFkc2hlZXRtbC50ZW1wbGF0ZSc6XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRleHQ6ICd4bHR4Jyxcblx0XHRcdFx0bWltZTogbWltZVR5cGUsXG5cdFx0XHR9O1xuXHRcdGNhc2UgJ2FwcGxpY2F0aW9uL3ZuZC5tcy1leGNlbC50ZW1wbGF0ZS5tYWNyb2VuYWJsZWQnOlxuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0ZXh0OiAneGx0bScsXG5cdFx0XHRcdG1pbWU6ICdhcHBsaWNhdGlvbi92bmQubXMtZXhjZWwudGVtcGxhdGUubWFjcm9lbmFibGVkLjEyJyxcblx0XHRcdH07XG5cdFx0Y2FzZSAnYXBwbGljYXRpb24vdm5kLm1zLXBvd2VycG9pbnQuc2xpZGVzaG93Lm1hY3JvZW5hYmxlZCc6XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRleHQ6ICdwcHNtJyxcblx0XHRcdFx0bWltZTogJ2FwcGxpY2F0aW9uL3ZuZC5tcy1wb3dlcnBvaW50LnNsaWRlc2hvdy5tYWNyb2VuYWJsZWQuMTInLFxuXHRcdFx0fTtcblx0XHRjYXNlICdhcHBsaWNhdGlvbi92bmQub3BlbnhtbGZvcm1hdHMtb2ZmaWNlZG9jdW1lbnQud29yZHByb2Nlc3NpbmdtbC5kb2N1bWVudCc6XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRleHQ6ICdkb2N4Jyxcblx0XHRcdFx0bWltZTogbWltZVR5cGUsXG5cdFx0XHR9O1xuXHRcdGNhc2UgJ2FwcGxpY2F0aW9uL3ZuZC5tcy13b3JkLmRvY3VtZW50Lm1hY3JvZW5hYmxlZCc6XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRleHQ6ICdkb2NtJyxcblx0XHRcdFx0bWltZTogJ2FwcGxpY2F0aW9uL3ZuZC5tcy13b3JkLmRvY3VtZW50Lm1hY3JvZW5hYmxlZC4xMicsXG5cdFx0XHR9O1xuXHRcdGNhc2UgJ2FwcGxpY2F0aW9uL3ZuZC5vcGVueG1sZm9ybWF0cy1vZmZpY2Vkb2N1bWVudC53b3JkcHJvY2Vzc2luZ21sLnRlbXBsYXRlJzpcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGV4dDogJ2RvdHgnLFxuXHRcdFx0XHRtaW1lOiBtaW1lVHlwZSxcblx0XHRcdH07XG5cdFx0Y2FzZSAnYXBwbGljYXRpb24vdm5kLm1zLXdvcmQudGVtcGxhdGUubWFjcm9lbmFibGVkdGVtcGxhdGUnOlxuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0ZXh0OiAnZG90bScsXG5cdFx0XHRcdG1pbWU6ICdhcHBsaWNhdGlvbi92bmQubXMtd29yZC50ZW1wbGF0ZS5tYWNyb2VuYWJsZWQuMTInLFxuXHRcdFx0fTtcblx0XHRjYXNlICdhcHBsaWNhdGlvbi92bmQub3BlbnhtbGZvcm1hdHMtb2ZmaWNlZG9jdW1lbnQucHJlc2VudGF0aW9ubWwudGVtcGxhdGUnOlxuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0ZXh0OiAncG90eCcsXG5cdFx0XHRcdG1pbWU6IG1pbWVUeXBlLFxuXHRcdFx0fTtcblx0XHRjYXNlICdhcHBsaWNhdGlvbi92bmQubXMtcG93ZXJwb2ludC50ZW1wbGF0ZS5tYWNyb2VuYWJsZWQnOlxuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0ZXh0OiAncG90bScsXG5cdFx0XHRcdG1pbWU6ICdhcHBsaWNhdGlvbi92bmQubXMtcG93ZXJwb2ludC50ZW1wbGF0ZS5tYWNyb2VuYWJsZWQuMTInLFxuXHRcdFx0fTtcblx0XHRjYXNlICdhcHBsaWNhdGlvbi92bmQub3BlbnhtbGZvcm1hdHMtb2ZmaWNlZG9jdW1lbnQucHJlc2VudGF0aW9ubWwucHJlc2VudGF0aW9uJzpcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGV4dDogJ3BwdHgnLFxuXHRcdFx0XHRtaW1lOiBtaW1lVHlwZSxcblx0XHRcdH07XG5cdFx0Y2FzZSAnYXBwbGljYXRpb24vdm5kLm1zLXBvd2VycG9pbnQucHJlc2VudGF0aW9uLm1hY3JvZW5hYmxlZCc6XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRleHQ6ICdwcHRtJyxcblx0XHRcdFx0bWltZTogJ2FwcGxpY2F0aW9uL3ZuZC5tcy1wb3dlcnBvaW50LnByZXNlbnRhdGlvbi5tYWNyb2VuYWJsZWQuMTInLFxuXHRcdFx0fTtcblx0XHRjYXNlICdhcHBsaWNhdGlvbi92bmQubXMtdmlzaW8uZHJhd2luZyc6XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRleHQ6ICd2c2R4Jyxcblx0XHRcdFx0bWltZTogJ2FwcGxpY2F0aW9uL3ZuZC52aXNpbycsXG5cdFx0XHR9O1xuXHRcdGNhc2UgJ2FwcGxpY2F0aW9uL3ZuZC5tcy1wYWNrYWdlLjNkbWFudWZhY3R1cmluZy0zZG1vZGVsK3htbCc6XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRleHQ6ICczbWYnLFxuXHRcdFx0XHRtaW1lOiAnbW9kZWwvM21mJyxcblx0XHRcdH07XG5cdFx0ZGVmYXVsdDpcblx0fVxufVxuXG5mdW5jdGlvbiBfY2hlY2soYnVmZmVyLCBoZWFkZXJzLCBvcHRpb25zKSB7XG5cdG9wdGlvbnMgPSB7XG5cdFx0b2Zmc2V0OiAwLFxuXHRcdC4uLm9wdGlvbnMsXG5cdH07XG5cblx0Zm9yIChjb25zdCBbaW5kZXgsIGhlYWRlcl0gb2YgaGVhZGVycy5lbnRyaWVzKCkpIHtcblx0XHQvLyBJZiBhIGJpdG1hc2sgaXMgc2V0XG5cdFx0aWYgKG9wdGlvbnMubWFzaykge1xuXHRcdFx0Ly8gSWYgaGVhZGVyIGRvZXNuJ3QgZXF1YWwgYGJ1ZmAgd2l0aCBiaXRzIG1hc2tlZCBvZmZcblx0XHRcdGlmIChoZWFkZXIgIT09IChvcHRpb25zLm1hc2tbaW5kZXhdICYgYnVmZmVyW2luZGV4ICsgb3B0aW9ucy5vZmZzZXRdKSkge1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9XG5cdFx0fSBlbHNlIGlmIChoZWFkZXIgIT09IGJ1ZmZlcltpbmRleCArIG9wdGlvbnMub2Zmc2V0XSkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0fVxuXG5cdHJldHVybiB0cnVlO1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZmlsZVR5cGVGcm9tVG9rZW5pemVyKHRva2VuaXplciwgb3B0aW9ucykge1xuXHRyZXR1cm4gbmV3IEZpbGVUeXBlUGFyc2VyKG9wdGlvbnMpLmZyb21Ub2tlbml6ZXIodG9rZW5pemVyKTtcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGZpbGVUeXBlU3RyZWFtKHdlYlN0cmVhbSwgb3B0aW9ucykge1xuXHRyZXR1cm4gbmV3IEZpbGVUeXBlUGFyc2VyKG9wdGlvbnMpLnRvRGV0ZWN0aW9uU3RyZWFtKHdlYlN0cmVhbSwgb3B0aW9ucyk7XG59XG5cbmV4cG9ydCBjbGFzcyBGaWxlVHlwZVBhcnNlciB7XG5cdGNvbnN0cnVjdG9yKG9wdGlvbnMpIHtcblx0XHR0aGlzLm9wdGlvbnMgPSB7XG5cdFx0XHRtcGVnT2Zmc2V0VG9sZXJhbmNlOiAwLFxuXHRcdFx0Li4ub3B0aW9ucyxcblx0XHR9O1xuXG5cdFx0dGhpcy5kZXRlY3RvcnMgPSBbLi4uKG9wdGlvbnM/LmN1c3RvbURldGVjdG9ycyA/PyBbXSksXG5cdFx0XHR7aWQ6ICdjb3JlJywgZGV0ZWN0OiB0aGlzLmRldGVjdENvbmZpZGVudH0sXG5cdFx0XHR7aWQ6ICdjb3JlLmltcHJlY2lzZScsIGRldGVjdDogdGhpcy5kZXRlY3RJbXByZWNpc2V9XTtcblx0XHR0aGlzLnRva2VuaXplck9wdGlvbnMgPSB7XG5cdFx0XHRhYm9ydFNpZ25hbDogb3B0aW9ucz8uc2lnbmFsLFxuXHRcdH07XG5cdH1cblxuXHRhc3luYyBmcm9tVG9rZW5pemVyKHRva2VuaXplcikge1xuXHRcdGNvbnN0IGluaXRpYWxQb3NpdGlvbiA9IHRva2VuaXplci5wb3NpdGlvbjtcblxuXHRcdC8vIEl0ZXJhdGUgdGhyb3VnaCBhbGwgZmlsZS10eXBlIGRldGVjdG9yc1xuXHRcdGZvciAoY29uc3QgZGV0ZWN0b3Igb2YgdGhpcy5kZXRlY3RvcnMpIHtcblx0XHRcdGNvbnN0IGZpbGVUeXBlID0gYXdhaXQgZGV0ZWN0b3IuZGV0ZWN0KHRva2VuaXplcik7XG5cdFx0XHRpZiAoZmlsZVR5cGUpIHtcblx0XHRcdFx0cmV0dXJuIGZpbGVUeXBlO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoaW5pdGlhbFBvc2l0aW9uICE9PSB0b2tlbml6ZXIucG9zaXRpb24pIHtcblx0XHRcdFx0cmV0dXJuIHVuZGVmaW5lZDsgLy8gQ2Fubm90IHByb2NlZWQgc2Nhbm5pbmcgb2YgdGhlIHRva2VuaXplciBpcyBhdCBhbiBhcmJpdHJhcnkgcG9zaXRpb25cblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRhc3luYyBmcm9tQnVmZmVyKGlucHV0KSB7XG5cdFx0aWYgKCEoaW5wdXQgaW5zdGFuY2VvZiBVaW50OEFycmF5IHx8IGlucHV0IGluc3RhbmNlb2YgQXJyYXlCdWZmZXIpKSB7XG5cdFx0XHR0aHJvdyBuZXcgVHlwZUVycm9yKGBFeHBlY3RlZCB0aGUgXFxgaW5wdXRcXGAgYXJndW1lbnQgdG8gYmUgb2YgdHlwZSBcXGBVaW50OEFycmF5XFxgIG9yIFxcYEFycmF5QnVmZmVyXFxgLCBnb3QgXFxgJHt0eXBlb2YgaW5wdXR9XFxgYCk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgYnVmZmVyID0gaW5wdXQgaW5zdGFuY2VvZiBVaW50OEFycmF5ID8gaW5wdXQgOiBuZXcgVWludDhBcnJheShpbnB1dCk7XG5cblx0XHRpZiAoIShidWZmZXI/Lmxlbmd0aCA+IDEpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRoaXMuZnJvbVRva2VuaXplcihzdHJ0b2szLmZyb21CdWZmZXIoYnVmZmVyLCB0aGlzLnRva2VuaXplck9wdGlvbnMpKTtcblx0fVxuXG5cdGFzeW5jIGZyb21CbG9iKGJsb2IpIHtcblx0XHRjb25zdCB0b2tlbml6ZXIgPSBzdHJ0b2szLmZyb21CbG9iKGJsb2IsIHRoaXMudG9rZW5pemVyT3B0aW9ucyk7XG5cdFx0dHJ5IHtcblx0XHRcdHJldHVybiBhd2FpdCB0aGlzLmZyb21Ub2tlbml6ZXIodG9rZW5pemVyKTtcblx0XHR9IGZpbmFsbHkge1xuXHRcdFx0YXdhaXQgdG9rZW5pemVyLmNsb3NlKCk7XG5cdFx0fVxuXHR9XG5cblx0YXN5bmMgZnJvbVN0cmVhbShzdHJlYW0pIHtcblx0XHRjb25zdCB0b2tlbml6ZXIgPSBzdHJ0b2szLmZyb21XZWJTdHJlYW0oc3RyZWFtLCB0aGlzLnRva2VuaXplck9wdGlvbnMpO1xuXHRcdHRyeSB7XG5cdFx0XHRyZXR1cm4gYXdhaXQgdGhpcy5mcm9tVG9rZW5pemVyKHRva2VuaXplcik7XG5cdFx0fSBmaW5hbGx5IHtcblx0XHRcdGF3YWl0IHRva2VuaXplci5jbG9zZSgpO1xuXHRcdH1cblx0fVxuXG5cdGFzeW5jIHRvRGV0ZWN0aW9uU3RyZWFtKHN0cmVhbSwgb3B0aW9ucykge1xuXHRcdGNvbnN0IHtzYW1wbGVTaXplID0gcmVhc29uYWJsZURldGVjdGlvblNpemVJbkJ5dGVzfSA9IG9wdGlvbnM7XG5cdFx0bGV0IGRldGVjdGVkRmlsZVR5cGU7XG5cdFx0bGV0IGZpcnN0Q2h1bms7XG5cblx0XHRjb25zdCByZWFkZXIgPSBzdHJlYW0uZ2V0UmVhZGVyKHttb2RlOiAnYnlvYid9KTtcblx0XHR0cnkge1xuXHRcdFx0Ly8gUmVhZCB0aGUgZmlyc3QgY2h1bmsgZnJvbSB0aGUgc3RyZWFtXG5cdFx0XHRjb25zdCB7dmFsdWU6IGNodW5rLCBkb25lfSA9IGF3YWl0IHJlYWRlci5yZWFkKG5ldyBVaW50OEFycmF5KHNhbXBsZVNpemUpKTtcblx0XHRcdGZpcnN0Q2h1bmsgPSBjaHVuaztcblx0XHRcdGlmICghZG9uZSAmJiBjaHVuaykge1xuXHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdC8vIEF0dGVtcHQgdG8gZGV0ZWN0IHRoZSBmaWxlIHR5cGUgZnJvbSB0aGUgY2h1bmtcblx0XHRcdFx0XHRkZXRlY3RlZEZpbGVUeXBlID0gYXdhaXQgdGhpcy5mcm9tQnVmZmVyKGNodW5rLnN1YmFycmF5KDAsIHNhbXBsZVNpemUpKTtcblx0XHRcdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdFx0XHRpZiAoIShlcnJvciBpbnN0YW5jZW9mIHN0cnRvazMuRW5kT2ZTdHJlYW1FcnJvcikpIHtcblx0XHRcdFx0XHRcdHRocm93IGVycm9yOyAvLyBSZS10aHJvdyBub24tRW5kT2ZTdHJlYW1FcnJvclxuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdGRldGVjdGVkRmlsZVR5cGUgPSB1bmRlZmluZWQ7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0Zmlyc3RDaHVuayA9IGNodW5rO1xuXHRcdH0gZmluYWxseSB7XG5cdFx0XHRyZWFkZXIucmVsZWFzZUxvY2soKTsgLy8gRW5zdXJlIHRoZSByZWFkZXIgaXMgcmVsZWFzZWRcblx0XHR9XG5cblx0XHQvLyBDcmVhdGUgYSBuZXcgUmVhZGFibGVTdHJlYW0gdG8gbWFuYWdlIGxvY2tpbmcgaXNzdWVzXG5cdFx0Y29uc3QgdHJhbnNmb3JtU3RyZWFtID0gbmV3IFRyYW5zZm9ybVN0cmVhbSh7XG5cdFx0XHRhc3luYyBzdGFydChjb250cm9sbGVyKSB7XG5cdFx0XHRcdGNvbnRyb2xsZXIuZW5xdWV1ZShmaXJzdENodW5rKTsgLy8gRW5xdWV1ZSB0aGUgaW5pdGlhbCBjaHVua1xuXHRcdFx0fSxcblx0XHRcdHRyYW5zZm9ybShjaHVuaywgY29udHJvbGxlcikge1xuXHRcdFx0XHQvLyBQYXNzIHRocm91Z2ggdGhlIGNodW5rcyB3aXRob3V0IG1vZGlmaWNhdGlvblxuXHRcdFx0XHRjb250cm9sbGVyLmVucXVldWUoY2h1bmspO1xuXHRcdFx0fSxcblx0XHR9KTtcblxuXHRcdGNvbnN0IG5ld1N0cmVhbSA9IHN0cmVhbS5waXBlVGhyb3VnaCh0cmFuc2Zvcm1TdHJlYW0pO1xuXHRcdG5ld1N0cmVhbS5maWxlVHlwZSA9IGRldGVjdGVkRmlsZVR5cGU7XG5cblx0XHRyZXR1cm4gbmV3U3RyZWFtO1xuXHR9XG5cblx0Y2hlY2soaGVhZGVyLCBvcHRpb25zKSB7XG5cdFx0cmV0dXJuIF9jaGVjayh0aGlzLmJ1ZmZlciwgaGVhZGVyLCBvcHRpb25zKTtcblx0fVxuXG5cdGNoZWNrU3RyaW5nKGhlYWRlciwgb3B0aW9ucykge1xuXHRcdHJldHVybiB0aGlzLmNoZWNrKHN0cmluZ1RvQnl0ZXMoaGVhZGVyLCBvcHRpb25zPy5lbmNvZGluZyksIG9wdGlvbnMpO1xuXHR9XG5cblx0Ly8gRGV0ZWN0aW9ucyB3aXRoIGEgaGlnaCBkZWdyZWUgb2YgY2VydGFpbnR5IGluIGlkZW50aWZ5aW5nIHRoZSBjb3JyZWN0IGZpbGUgdHlwZVxuXHRkZXRlY3RDb25maWRlbnQgPSBhc3luYyB0b2tlbml6ZXIgPT4ge1xuXHRcdHRoaXMuYnVmZmVyID0gbmV3IFVpbnQ4QXJyYXkocmVhc29uYWJsZURldGVjdGlvblNpemVJbkJ5dGVzKTtcblxuXHRcdC8vIEtlZXAgcmVhZGluZyB1bnRpbCBFT0YgaWYgdGhlIGZpbGUgc2l6ZSBpcyB1bmtub3duLlxuXHRcdGlmICh0b2tlbml6ZXIuZmlsZUluZm8uc2l6ZSA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0XHR0b2tlbml6ZXIuZmlsZUluZm8uc2l6ZSA9IE51bWJlci5NQVhfU0FGRV9JTlRFR0VSO1xuXHRcdH1cblxuXHRcdHRoaXMudG9rZW5pemVyID0gdG9rZW5pemVyO1xuXG5cdFx0YXdhaXQgdG9rZW5pemVyLnBlZWtCdWZmZXIodGhpcy5idWZmZXIsIHtsZW5ndGg6IDMyLCBtYXlCZUxlc3M6IHRydWV9KTtcblxuXHRcdC8vIC0tIDItYnl0ZSBzaWduYXR1cmVzIC0tXG5cblx0XHRpZiAodGhpcy5jaGVjayhbMHg0MiwgMHg0RF0pKSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRleHQ6ICdibXAnLFxuXHRcdFx0XHRtaW1lOiAnaW1hZ2UvYm1wJyxcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuY2hlY2soWzB4MEIsIDB4NzddKSkge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0ZXh0OiAnYWMzJyxcblx0XHRcdFx0bWltZTogJ2F1ZGlvL3ZuZC5kb2xieS5kZC1yYXcnLFxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5jaGVjayhbMHg3OCwgMHgwMV0pKSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRleHQ6ICdkbWcnLFxuXHRcdFx0XHRtaW1lOiAnYXBwbGljYXRpb24veC1hcHBsZS1kaXNraW1hZ2UnLFxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5jaGVjayhbMHg0RCwgMHg1QV0pKSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRleHQ6ICdleGUnLFxuXHRcdFx0XHRtaW1lOiAnYXBwbGljYXRpb24veC1tc2Rvd25sb2FkJyxcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuY2hlY2soWzB4MjUsIDB4MjFdKSkge1xuXHRcdFx0YXdhaXQgdG9rZW5pemVyLnBlZWtCdWZmZXIodGhpcy5idWZmZXIsIHtsZW5ndGg6IDI0LCBtYXlCZUxlc3M6IHRydWV9KTtcblxuXHRcdFx0aWYgKFxuXHRcdFx0XHR0aGlzLmNoZWNrU3RyaW5nKCdQUy1BZG9iZS0nLCB7b2Zmc2V0OiAyfSlcblx0XHRcdFx0JiYgdGhpcy5jaGVja1N0cmluZygnIEVQU0YtJywge29mZnNldDogMTR9KVxuXHRcdFx0KSB7XG5cdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0ZXh0OiAnZXBzJyxcblx0XHRcdFx0XHRtaW1lOiAnYXBwbGljYXRpb24vZXBzJyxcblx0XHRcdFx0fTtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0ZXh0OiAncHMnLFxuXHRcdFx0XHRtaW1lOiAnYXBwbGljYXRpb24vcG9zdHNjcmlwdCcsXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdGlmIChcblx0XHRcdHRoaXMuY2hlY2soWzB4MUYsIDB4QTBdKVxuXHRcdFx0fHwgdGhpcy5jaGVjayhbMHgxRiwgMHg5RF0pXG5cdFx0KSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRleHQ6ICdaJyxcblx0XHRcdFx0bWltZTogJ2FwcGxpY2F0aW9uL3gtY29tcHJlc3MnLFxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5jaGVjayhbMHhDNywgMHg3MV0pKSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRleHQ6ICdjcGlvJyxcblx0XHRcdFx0bWltZTogJ2FwcGxpY2F0aW9uL3gtY3BpbycsXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLmNoZWNrKFsweDYwLCAweEVBXSkpIHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGV4dDogJ2FyaicsXG5cdFx0XHRcdG1pbWU6ICdhcHBsaWNhdGlvbi94LWFyaicsXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdC8vIC0tIDMtYnl0ZSBzaWduYXR1cmVzIC0tXG5cblx0XHRpZiAodGhpcy5jaGVjayhbMHhFRiwgMHhCQiwgMHhCRl0pKSB7IC8vIFVURi04LUJPTVxuXHRcdFx0Ly8gU3RyaXAgb2ZmIFVURi04LUJPTVxuXHRcdFx0dGhpcy50b2tlbml6ZXIuaWdub3JlKDMpO1xuXHRcdFx0cmV0dXJuIHRoaXMuZGV0ZWN0Q29uZmlkZW50KHRva2VuaXplcik7XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuY2hlY2soWzB4NDcsIDB4NDksIDB4NDZdKSkge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0ZXh0OiAnZ2lmJyxcblx0XHRcdFx0bWltZTogJ2ltYWdlL2dpZicsXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLmNoZWNrKFsweDQ5LCAweDQ5LCAweEJDXSkpIHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGV4dDogJ2p4cicsXG5cdFx0XHRcdG1pbWU6ICdpbWFnZS92bmQubXMtcGhvdG8nLFxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5jaGVjayhbMHgxRiwgMHg4QiwgMHg4XSkpIHtcblx0XHRcdGNvbnN0IGd6aXBIYW5kbGVyID0gbmV3IEd6aXBIYW5kbGVyKHRva2VuaXplcik7XG5cblx0XHRcdGNvbnN0IHN0cmVhbSA9IGd6aXBIYW5kbGVyLmluZmxhdGUoKTtcblx0XHRcdGxldCBzaG91bGRDYW5jZWxTdHJlYW0gPSB0cnVlO1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0bGV0IGNvbXByZXNzZWRGaWxlVHlwZTtcblx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHRjb21wcmVzc2VkRmlsZVR5cGUgPSBhd2FpdCB0aGlzLmZyb21TdHJlYW0oc3RyZWFtKTtcblx0XHRcdFx0fSBjYXRjaCB7XG5cdFx0XHRcdFx0c2hvdWxkQ2FuY2VsU3RyZWFtID0gZmFsc2U7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiAoY29tcHJlc3NlZEZpbGVUeXBlICYmIGNvbXByZXNzZWRGaWxlVHlwZS5leHQgPT09ICd0YXInKSB7XG5cdFx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRcdGV4dDogJ3Rhci5neicsXG5cdFx0XHRcdFx0XHRtaW1lOiAnYXBwbGljYXRpb24vZ3ppcCcsXG5cdFx0XHRcdFx0fTtcblx0XHRcdFx0fVxuXHRcdFx0fSBmaW5hbGx5IHtcblx0XHRcdFx0aWYgKHNob3VsZENhbmNlbFN0cmVhbSkge1xuXHRcdFx0XHRcdGF3YWl0IHN0cmVhbS5jYW5jZWwoKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRleHQ6ICdneicsXG5cdFx0XHRcdG1pbWU6ICdhcHBsaWNhdGlvbi9nemlwJyxcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuY2hlY2soWzB4NDIsIDB4NUEsIDB4NjhdKSkge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0ZXh0OiAnYnoyJyxcblx0XHRcdFx0bWltZTogJ2FwcGxpY2F0aW9uL3gtYnppcDInLFxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5jaGVja1N0cmluZygnSUQzJykpIHtcblx0XHRcdGF3YWl0IHRva2VuaXplci5pZ25vcmUoNik7IC8vIFNraXAgSUQzIGhlYWRlciB1bnRpbCB0aGUgaGVhZGVyIHNpemVcblx0XHRcdGNvbnN0IGlkM0hlYWRlckxlbmd0aCA9IGF3YWl0IHRva2VuaXplci5yZWFkVG9rZW4odWludDMyU3luY1NhZmVUb2tlbik7XG5cdFx0XHRpZiAodG9rZW5pemVyLnBvc2l0aW9uICsgaWQzSGVhZGVyTGVuZ3RoID4gdG9rZW5pemVyLmZpbGVJbmZvLnNpemUpIHtcblx0XHRcdFx0Ly8gR3Vlc3MgZmlsZSB0eXBlIGJhc2VkIG9uIElEMyBoZWFkZXIgZm9yIGJhY2t3YXJkIGNvbXBhdGliaWxpdHlcblx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRleHQ6ICdtcDMnLFxuXHRcdFx0XHRcdG1pbWU6ICdhdWRpby9tcGVnJyxcblx0XHRcdFx0fTtcblx0XHRcdH1cblxuXHRcdFx0YXdhaXQgdG9rZW5pemVyLmlnbm9yZShpZDNIZWFkZXJMZW5ndGgpO1xuXHRcdFx0cmV0dXJuIHRoaXMuZnJvbVRva2VuaXplcih0b2tlbml6ZXIpOyAvLyBTa2lwIElEMyBoZWFkZXIsIHJlY3Vyc2lvblxuXHRcdH1cblxuXHRcdC8vIE11c2VwYWNrLCBTVjdcblx0XHRpZiAodGhpcy5jaGVja1N0cmluZygnTVArJykpIHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGV4dDogJ21wYycsXG5cdFx0XHRcdG1pbWU6ICdhdWRpby94LW11c2VwYWNrJyxcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0aWYgKFxuXHRcdFx0KHRoaXMuYnVmZmVyWzBdID09PSAweDQzIHx8IHRoaXMuYnVmZmVyWzBdID09PSAweDQ2KVxuXHRcdFx0JiYgdGhpcy5jaGVjayhbMHg1NywgMHg1M10sIHtvZmZzZXQ6IDF9KVxuXHRcdCkge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0ZXh0OiAnc3dmJyxcblx0XHRcdFx0bWltZTogJ2FwcGxpY2F0aW9uL3gtc2hvY2t3YXZlLWZsYXNoJyxcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0Ly8gLS0gNC1ieXRlIHNpZ25hdHVyZXMgLS1cblxuXHRcdC8vIFJlcXVpcmVzIGEgc2FtcGxlIHNpemUgb2YgNCBieXRlc1xuXHRcdGlmICh0aGlzLmNoZWNrKFsweEZGLCAweEQ4LCAweEZGXSkpIHtcblx0XHRcdGlmICh0aGlzLmNoZWNrKFsweEY3XSwge29mZnNldDogM30pKSB7IC8vIEpQRzcvU09GNTUsIGluZGljYXRpbmcgYSBJU08vSUVDIDE0NDk1IC8gSlBFRy1MUyBmaWxlXG5cdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0ZXh0OiAnamxzJyxcblx0XHRcdFx0XHRtaW1lOiAnaW1hZ2UvamxzJyxcblx0XHRcdFx0fTtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0ZXh0OiAnanBnJyxcblx0XHRcdFx0bWltZTogJ2ltYWdlL2pwZWcnLFxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5jaGVjayhbMHg0RiwgMHg2MiwgMHg2QSwgMHgwMV0pKSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRleHQ6ICdhdnJvJyxcblx0XHRcdFx0bWltZTogJ2FwcGxpY2F0aW9uL2F2cm8nLFxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5jaGVja1N0cmluZygnRkxJRicpKSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRleHQ6ICdmbGlmJyxcblx0XHRcdFx0bWltZTogJ2ltYWdlL2ZsaWYnLFxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5jaGVja1N0cmluZygnOEJQUycpKSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRleHQ6ICdwc2QnLFxuXHRcdFx0XHRtaW1lOiAnaW1hZ2Uvdm5kLmFkb2JlLnBob3Rvc2hvcCcsXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdC8vIE11c2VwYWNrLCBTVjhcblx0XHRpZiAodGhpcy5jaGVja1N0cmluZygnTVBDSycpKSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRleHQ6ICdtcGMnLFxuXHRcdFx0XHRtaW1lOiAnYXVkaW8veC1tdXNlcGFjaycsXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLmNoZWNrU3RyaW5nKCdGT1JNJykpIHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGV4dDogJ2FpZicsXG5cdFx0XHRcdG1pbWU6ICdhdWRpby9haWZmJyxcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuY2hlY2tTdHJpbmcoJ2ljbnMnLCB7b2Zmc2V0OiAwfSkpIHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGV4dDogJ2ljbnMnLFxuXHRcdFx0XHRtaW1lOiAnaW1hZ2UvaWNucycsXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdC8vIFppcC1iYXNlZCBmaWxlIGZvcm1hdHNcblx0XHQvLyBOZWVkIHRvIGJlIGJlZm9yZSB0aGUgYHppcGAgY2hlY2tcblx0XHRpZiAodGhpcy5jaGVjayhbMHg1MCwgMHg0QiwgMHgzLCAweDRdKSkgeyAvLyBMb2NhbCBmaWxlIGhlYWRlciBzaWduYXR1cmVcblx0XHRcdGxldCBmaWxlVHlwZTtcblx0XHRcdGF3YWl0IG5ldyBaaXBIYW5kbGVyKHRva2VuaXplcikudW56aXAoemlwSGVhZGVyID0+IHtcblx0XHRcdFx0c3dpdGNoICh6aXBIZWFkZXIuZmlsZW5hbWUpIHtcblx0XHRcdFx0XHRjYXNlICdNRVRBLUlORi9tb3ppbGxhLnJzYSc6XG5cdFx0XHRcdFx0XHRmaWxlVHlwZSA9IHtcblx0XHRcdFx0XHRcdFx0ZXh0OiAneHBpJyxcblx0XHRcdFx0XHRcdFx0bWltZTogJ2FwcGxpY2F0aW9uL3gteHBpbnN0YWxsJyxcblx0XHRcdFx0XHRcdH07XG5cdFx0XHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdFx0XHRzdG9wOiB0cnVlLFxuXHRcdFx0XHRcdFx0fTtcblx0XHRcdFx0XHRjYXNlICdNRVRBLUlORi9NQU5JRkVTVC5NRic6XG5cdFx0XHRcdFx0XHRmaWxlVHlwZSA9IHtcblx0XHRcdFx0XHRcdFx0ZXh0OiAnamFyJyxcblx0XHRcdFx0XHRcdFx0bWltZTogJ2FwcGxpY2F0aW9uL2phdmEtYXJjaGl2ZScsXG5cdFx0XHRcdFx0XHR9O1xuXHRcdFx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRcdFx0c3RvcDogdHJ1ZSxcblx0XHRcdFx0XHRcdH07XG5cdFx0XHRcdFx0Y2FzZSAnbWltZXR5cGUnOlxuXHRcdFx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRcdFx0YXN5bmMgaGFuZGxlcihmaWxlRGF0YSkge1xuXHRcdFx0XHRcdFx0XHRcdC8vIFVzZSBUZXh0RGVjb2RlciB0byBkZWNvZGUgdGhlIFVURi04IGVuY29kZWQgZGF0YVxuXHRcdFx0XHRcdFx0XHRcdGNvbnN0IG1pbWVUeXBlID0gbmV3IFRleHREZWNvZGVyKCd1dGYtOCcpLmRlY29kZShmaWxlRGF0YSkudHJpbSgpO1xuXHRcdFx0XHRcdFx0XHRcdGZpbGVUeXBlID0gZ2V0RmlsZVR5cGVGcm9tTWltZVR5cGUobWltZVR5cGUpO1xuXHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XHRzdG9wOiB0cnVlLFxuXHRcdFx0XHRcdFx0fTtcblxuXHRcdFx0XHRcdGNhc2UgJ1tDb250ZW50X1R5cGVzXS54bWwnOlxuXHRcdFx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRcdFx0YXN5bmMgaGFuZGxlcihmaWxlRGF0YSkge1xuXHRcdFx0XHRcdFx0XHRcdC8vIFVzZSBUZXh0RGVjb2RlciB0byBkZWNvZGUgdGhlIFVURi04IGVuY29kZWQgZGF0YVxuXHRcdFx0XHRcdFx0XHRcdGxldCB4bWxDb250ZW50ID0gbmV3IFRleHREZWNvZGVyKCd1dGYtOCcpLmRlY29kZShmaWxlRGF0YSk7XG5cdFx0XHRcdFx0XHRcdFx0Y29uc3QgZW5kUG9zID0geG1sQ29udGVudC5pbmRleE9mKCcubWFpbit4bWxcIicpO1xuXHRcdFx0XHRcdFx0XHRcdGlmIChlbmRQb3MgPT09IC0xKSB7XG5cdFx0XHRcdFx0XHRcdFx0XHRjb25zdCBtaW1lVHlwZSA9ICdhcHBsaWNhdGlvbi92bmQubXMtcGFja2FnZS4zZG1hbnVmYWN0dXJpbmctM2Rtb2RlbCt4bWwnO1xuXHRcdFx0XHRcdFx0XHRcdFx0aWYgKHhtbENvbnRlbnQuaW5jbHVkZXMoYENvbnRlbnRUeXBlPVwiJHttaW1lVHlwZX1cImApKSB7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdGZpbGVUeXBlID0gZ2V0RmlsZVR5cGVGcm9tTWltZVR5cGUobWltZVR5cGUpO1xuXHRcdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdFx0XHR4bWxDb250ZW50ID0geG1sQ29udGVudC5zbGljZSgwLCBNYXRoLm1heCgwLCBlbmRQb3MpKTtcblx0XHRcdFx0XHRcdFx0XHRcdGNvbnN0IGZpcnN0UG9zID0geG1sQ29udGVudC5sYXN0SW5kZXhPZignXCInKTtcblx0XHRcdFx0XHRcdFx0XHRcdGNvbnN0IG1pbWVUeXBlID0geG1sQ29udGVudC5zbGljZShNYXRoLm1heCgwLCBmaXJzdFBvcyArIDEpKTtcblx0XHRcdFx0XHRcdFx0XHRcdGZpbGVUeXBlID0gZ2V0RmlsZVR5cGVGcm9tTWltZVR5cGUobWltZVR5cGUpO1xuXHRcdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdFx0c3RvcDogdHJ1ZSxcblx0XHRcdFx0XHRcdH07XG5cdFx0XHRcdFx0ZGVmYXVsdDpcblx0XHRcdFx0XHRcdGlmICgvY2xhc3Nlc1xcZCpcXC5kZXgvLnRlc3QoemlwSGVhZGVyLmZpbGVuYW1lKSkge1xuXHRcdFx0XHRcdFx0XHRmaWxlVHlwZSA9IHtcblx0XHRcdFx0XHRcdFx0XHRleHQ6ICdhcGsnLFxuXHRcdFx0XHRcdFx0XHRcdG1pbWU6ICdhcHBsaWNhdGlvbi92bmQuYW5kcm9pZC5wYWNrYWdlLWFyY2hpdmUnLFxuXHRcdFx0XHRcdFx0XHR9O1xuXHRcdFx0XHRcdFx0XHRyZXR1cm4ge3N0b3A6IHRydWV9O1xuXHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0XHRyZXR1cm4ge307XG5cdFx0XHRcdH1cblx0XHRcdH0pLmNhdGNoKGVycm9yID0+IHtcblx0XHRcdFx0aWYgKCEoZXJyb3IgaW5zdGFuY2VvZiBzdHJ0b2szLkVuZE9mU3RyZWFtRXJyb3IpKSB7XG5cdFx0XHRcdFx0dGhyb3cgZXJyb3I7IC8vIFJlLXRocm93IG5vbi1FbmRPZlN0cmVhbUVycm9yXG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXG5cdFx0XHRyZXR1cm4gZmlsZVR5cGUgPz8ge1xuXHRcdFx0XHRleHQ6ICd6aXAnLFxuXHRcdFx0XHRtaW1lOiAnYXBwbGljYXRpb24vemlwJyxcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuY2hlY2tTdHJpbmcoJ09nZ1MnKSkge1xuXHRcdFx0Ly8gVGhpcyBpcyBhbiBPR0cgY29udGFpbmVyXG5cdFx0XHRhd2FpdCB0b2tlbml6ZXIuaWdub3JlKDI4KTtcblx0XHRcdGNvbnN0IHR5cGUgPSBuZXcgVWludDhBcnJheSg4KTtcblx0XHRcdGF3YWl0IHRva2VuaXplci5yZWFkQnVmZmVyKHR5cGUpO1xuXG5cdFx0XHQvLyBOZWVkcyB0byBiZSBiZWZvcmUgYG9nZ2AgY2hlY2tcblx0XHRcdGlmIChfY2hlY2sodHlwZSwgWzB4NEYsIDB4NzAsIDB4NzUsIDB4NzMsIDB4NDgsIDB4NjUsIDB4NjEsIDB4NjRdKSkge1xuXHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdGV4dDogJ29wdXMnLFxuXHRcdFx0XHRcdG1pbWU6ICdhdWRpby9vZ2c7IGNvZGVjcz1vcHVzJyxcblx0XHRcdFx0fTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gSWYgJyB0aGVvcmEnIGluIGhlYWRlci5cblx0XHRcdGlmIChfY2hlY2sodHlwZSwgWzB4ODAsIDB4NzQsIDB4NjgsIDB4NjUsIDB4NkYsIDB4NzIsIDB4NjFdKSkge1xuXHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdGV4dDogJ29ndicsXG5cdFx0XHRcdFx0bWltZTogJ3ZpZGVvL29nZycsXG5cdFx0XHRcdH07XG5cdFx0XHR9XG5cblx0XHRcdC8vIElmICdcXHgwMXZpZGVvJyBpbiBoZWFkZXIuXG5cdFx0XHRpZiAoX2NoZWNrKHR5cGUsIFsweDAxLCAweDc2LCAweDY5LCAweDY0LCAweDY1LCAweDZGLCAweDAwXSkpIHtcblx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRleHQ6ICdvZ20nLFxuXHRcdFx0XHRcdG1pbWU6ICd2aWRlby9vZ2cnLFxuXHRcdFx0XHR9O1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBJZiAnIEZMQUMnIGluIGhlYWRlciAgaHR0cHM6Ly94aXBoLm9yZy9mbGFjL2ZhcS5odG1sXG5cdFx0XHRpZiAoX2NoZWNrKHR5cGUsIFsweDdGLCAweDQ2LCAweDRDLCAweDQxLCAweDQzXSkpIHtcblx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRleHQ6ICdvZ2EnLFxuXHRcdFx0XHRcdG1pbWU6ICdhdWRpby9vZ2cnLFxuXHRcdFx0XHR9O1xuXHRcdFx0fVxuXG5cdFx0XHQvLyAnU3BlZXggICcgaW4gaGVhZGVyIGh0dHBzOi8vZW4ud2lraXBlZGlhLm9yZy93aWtpL1NwZWV4XG5cdFx0XHRpZiAoX2NoZWNrKHR5cGUsIFsweDUzLCAweDcwLCAweDY1LCAweDY1LCAweDc4LCAweDIwLCAweDIwXSkpIHtcblx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRleHQ6ICdzcHgnLFxuXHRcdFx0XHRcdG1pbWU6ICdhdWRpby9vZ2cnLFxuXHRcdFx0XHR9O1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBJZiAnXFx4MDF2b3JiaXMnIGluIGhlYWRlclxuXHRcdFx0aWYgKF9jaGVjayh0eXBlLCBbMHgwMSwgMHg3NiwgMHg2RiwgMHg3MiwgMHg2MiwgMHg2OSwgMHg3M10pKSB7XG5cdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0ZXh0OiAnb2dnJyxcblx0XHRcdFx0XHRtaW1lOiAnYXVkaW8vb2dnJyxcblx0XHRcdFx0fTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gRGVmYXVsdCBPR0cgY29udGFpbmVyIGh0dHBzOi8vd3d3LmlhbmEub3JnL2Fzc2lnbm1lbnRzL21lZGlhLXR5cGVzL2FwcGxpY2F0aW9uL29nZ1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0ZXh0OiAnb2d4Jyxcblx0XHRcdFx0bWltZTogJ2FwcGxpY2F0aW9uL29nZycsXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdGlmIChcblx0XHRcdHRoaXMuY2hlY2soWzB4NTAsIDB4NEJdKVxuXHRcdFx0JiYgKHRoaXMuYnVmZmVyWzJdID09PSAweDMgfHwgdGhpcy5idWZmZXJbMl0gPT09IDB4NSB8fCB0aGlzLmJ1ZmZlclsyXSA9PT0gMHg3KVxuXHRcdFx0JiYgKHRoaXMuYnVmZmVyWzNdID09PSAweDQgfHwgdGhpcy5idWZmZXJbM10gPT09IDB4NiB8fCB0aGlzLmJ1ZmZlclszXSA9PT0gMHg4KVxuXHRcdCkge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0ZXh0OiAnemlwJyxcblx0XHRcdFx0bWltZTogJ2FwcGxpY2F0aW9uL3ppcCcsXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLmNoZWNrU3RyaW5nKCdNVGhkJykpIHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGV4dDogJ21pZCcsXG5cdFx0XHRcdG1pbWU6ICdhdWRpby9taWRpJyxcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0aWYgKFxuXHRcdFx0dGhpcy5jaGVja1N0cmluZygnd09GRicpXG5cdFx0XHQmJiAoXG5cdFx0XHRcdHRoaXMuY2hlY2soWzB4MDAsIDB4MDEsIDB4MDAsIDB4MDBdLCB7b2Zmc2V0OiA0fSlcblx0XHRcdFx0fHwgdGhpcy5jaGVja1N0cmluZygnT1RUTycsIHtvZmZzZXQ6IDR9KVxuXHRcdFx0KVxuXHRcdCkge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0ZXh0OiAnd29mZicsXG5cdFx0XHRcdG1pbWU6ICdmb250L3dvZmYnLFxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHRpZiAoXG5cdFx0XHR0aGlzLmNoZWNrU3RyaW5nKCd3T0YyJylcblx0XHRcdCYmIChcblx0XHRcdFx0dGhpcy5jaGVjayhbMHgwMCwgMHgwMSwgMHgwMCwgMHgwMF0sIHtvZmZzZXQ6IDR9KVxuXHRcdFx0XHR8fCB0aGlzLmNoZWNrU3RyaW5nKCdPVFRPJywge29mZnNldDogNH0pXG5cdFx0XHQpXG5cdFx0KSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRleHQ6ICd3b2ZmMicsXG5cdFx0XHRcdG1pbWU6ICdmb250L3dvZmYyJyxcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuY2hlY2soWzB4RDQsIDB4QzMsIDB4QjIsIDB4QTFdKSB8fCB0aGlzLmNoZWNrKFsweEExLCAweEIyLCAweEMzLCAweEQ0XSkpIHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGV4dDogJ3BjYXAnLFxuXHRcdFx0XHRtaW1lOiAnYXBwbGljYXRpb24vdm5kLnRjcGR1bXAucGNhcCcsXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdC8vIFNvbnkgRFNEIFN0cmVhbSBGaWxlIChEU0YpXG5cdFx0aWYgKHRoaXMuY2hlY2tTdHJpbmcoJ0RTRCAnKSkge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0ZXh0OiAnZHNmJyxcblx0XHRcdFx0bWltZTogJ2F1ZGlvL3gtZHNmJywgLy8gTm9uLXN0YW5kYXJkXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLmNoZWNrU3RyaW5nKCdMWklQJykpIHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGV4dDogJ2x6Jyxcblx0XHRcdFx0bWltZTogJ2FwcGxpY2F0aW9uL3gtbHppcCcsXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLmNoZWNrU3RyaW5nKCdmTGFDJykpIHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGV4dDogJ2ZsYWMnLFxuXHRcdFx0XHRtaW1lOiAnYXVkaW8vZmxhYycsXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLmNoZWNrKFsweDQyLCAweDUwLCAweDQ3LCAweEZCXSkpIHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGV4dDogJ2JwZycsXG5cdFx0XHRcdG1pbWU6ICdpbWFnZS9icGcnLFxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5jaGVja1N0cmluZygnd3ZwaycpKSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRleHQ6ICd3dicsXG5cdFx0XHRcdG1pbWU6ICdhdWRpby93YXZwYWNrJyxcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuY2hlY2tTdHJpbmcoJyVQREYnKSkge1xuXHRcdFx0Ly8gQXNzdW1lIHRoaXMgaXMganVzdCBhIG5vcm1hbCBQREZcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGV4dDogJ3BkZicsXG5cdFx0XHRcdG1pbWU6ICdhcHBsaWNhdGlvbi9wZGYnLFxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5jaGVjayhbMHgwMCwgMHg2MSwgMHg3MywgMHg2RF0pKSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRleHQ6ICd3YXNtJyxcblx0XHRcdFx0bWltZTogJ2FwcGxpY2F0aW9uL3dhc20nLFxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHQvLyBUSUZGLCBsaXR0bGUtZW5kaWFuIHR5cGVcblx0XHRpZiAodGhpcy5jaGVjayhbMHg0OSwgMHg0OV0pKSB7XG5cdFx0XHRjb25zdCBmaWxlVHlwZSA9IGF3YWl0IHRoaXMucmVhZFRpZmZIZWFkZXIoZmFsc2UpO1xuXHRcdFx0aWYgKGZpbGVUeXBlKSB7XG5cdFx0XHRcdHJldHVybiBmaWxlVHlwZTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBUSUZGLCBiaWctZW5kaWFuIHR5cGVcblx0XHRpZiAodGhpcy5jaGVjayhbMHg0RCwgMHg0RF0pKSB7XG5cdFx0XHRjb25zdCBmaWxlVHlwZSA9IGF3YWl0IHRoaXMucmVhZFRpZmZIZWFkZXIodHJ1ZSk7XG5cdFx0XHRpZiAoZmlsZVR5cGUpIHtcblx0XHRcdFx0cmV0dXJuIGZpbGVUeXBlO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmICh0aGlzLmNoZWNrU3RyaW5nKCdNQUMgJykpIHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGV4dDogJ2FwZScsXG5cdFx0XHRcdG1pbWU6ICdhdWRpby9hcGUnLFxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHQvLyBodHRwczovL2dpdGh1Yi5jb20vZmlsZS9maWxlL2Jsb2IvbWFzdGVyL21hZ2ljL01hZ2Rpci9tYXRyb3NrYVxuXHRcdGlmICh0aGlzLmNoZWNrKFsweDFBLCAweDQ1LCAweERGLCAweEEzXSkpIHsgLy8gUm9vdCBlbGVtZW50OiBFQk1MXG5cdFx0XHRhc3luYyBmdW5jdGlvbiByZWFkRmllbGQoKSB7XG5cdFx0XHRcdGNvbnN0IG1zYiA9IGF3YWl0IHRva2VuaXplci5wZWVrTnVtYmVyKFRva2VuLlVJTlQ4KTtcblx0XHRcdFx0bGV0IG1hc2sgPSAweDgwO1xuXHRcdFx0XHRsZXQgaWMgPSAwOyAvLyAwID0gQSwgMSA9IEIsIDIgPSBDLCAzID0gRFxuXG5cdFx0XHRcdHdoaWxlICgobXNiICYgbWFzaykgPT09IDAgJiYgbWFzayAhPT0gMCkge1xuXHRcdFx0XHRcdCsraWM7XG5cdFx0XHRcdFx0bWFzayA+Pj0gMTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGNvbnN0IGlkID0gbmV3IFVpbnQ4QXJyYXkoaWMgKyAxKTtcblx0XHRcdFx0YXdhaXQgdG9rZW5pemVyLnJlYWRCdWZmZXIoaWQpO1xuXHRcdFx0XHRyZXR1cm4gaWQ7XG5cdFx0XHR9XG5cblx0XHRcdGFzeW5jIGZ1bmN0aW9uIHJlYWRFbGVtZW50KCkge1xuXHRcdFx0XHRjb25zdCBpZEZpZWxkID0gYXdhaXQgcmVhZEZpZWxkKCk7XG5cdFx0XHRcdGNvbnN0IGxlbmd0aEZpZWxkID0gYXdhaXQgcmVhZEZpZWxkKCk7XG5cblx0XHRcdFx0bGVuZ3RoRmllbGRbMF0gXj0gMHg4MCA+PiAobGVuZ3RoRmllbGQubGVuZ3RoIC0gMSk7XG5cdFx0XHRcdGNvbnN0IG5yTGVuZ3RoID0gTWF0aC5taW4oNiwgbGVuZ3RoRmllbGQubGVuZ3RoKTsgLy8gSmF2YVNjcmlwdCBjYW4gbWF4IHJlYWQgNiBieXRlcyBpbnRlZ2VyXG5cblx0XHRcdFx0Y29uc3QgaWRWaWV3ID0gbmV3IERhdGFWaWV3KGlkRmllbGQuYnVmZmVyKTtcblx0XHRcdFx0Y29uc3QgbGVuZ3RoVmlldyA9IG5ldyBEYXRhVmlldyhsZW5ndGhGaWVsZC5idWZmZXIsIGxlbmd0aEZpZWxkLmxlbmd0aCAtIG5yTGVuZ3RoLCBuckxlbmd0aCk7XG5cblx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRpZDogZ2V0VWludEJFKGlkVmlldyksXG5cdFx0XHRcdFx0bGVuOiBnZXRVaW50QkUobGVuZ3RoVmlldyksXG5cdFx0XHRcdH07XG5cdFx0XHR9XG5cblx0XHRcdGFzeW5jIGZ1bmN0aW9uIHJlYWRDaGlsZHJlbihjaGlsZHJlbikge1xuXHRcdFx0XHR3aGlsZSAoY2hpbGRyZW4gPiAwKSB7XG5cdFx0XHRcdFx0Y29uc3QgZWxlbWVudCA9IGF3YWl0IHJlYWRFbGVtZW50KCk7XG5cdFx0XHRcdFx0aWYgKGVsZW1lbnQuaWQgPT09IDB4NDJfODIpIHtcblx0XHRcdFx0XHRcdGNvbnN0IHJhd1ZhbHVlID0gYXdhaXQgdG9rZW5pemVyLnJlYWRUb2tlbihuZXcgVG9rZW4uU3RyaW5nVHlwZShlbGVtZW50LmxlbikpO1xuXHRcdFx0XHRcdFx0cmV0dXJuIHJhd1ZhbHVlLnJlcGxhY2VBbGwoL1xcMDAuKiQvZywgJycpOyAvLyBSZXR1cm4gRG9jVHlwZVxuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdGF3YWl0IHRva2VuaXplci5pZ25vcmUoZWxlbWVudC5sZW4pOyAvLyBpZ25vcmUgcGF5bG9hZFxuXHRcdFx0XHRcdC0tY2hpbGRyZW47XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgcmUgPSBhd2FpdCByZWFkRWxlbWVudCgpO1xuXHRcdFx0Y29uc3QgZG9jdW1lbnRUeXBlID0gYXdhaXQgcmVhZENoaWxkcmVuKHJlLmxlbik7XG5cblx0XHRcdHN3aXRjaCAoZG9jdW1lbnRUeXBlKSB7XG5cdFx0XHRcdGNhc2UgJ3dlYm0nOlxuXHRcdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0XHRleHQ6ICd3ZWJtJyxcblx0XHRcdFx0XHRcdG1pbWU6ICd2aWRlby93ZWJtJyxcblx0XHRcdFx0XHR9O1xuXG5cdFx0XHRcdGNhc2UgJ21hdHJvc2thJzpcblx0XHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdFx0ZXh0OiAnbWt2Jyxcblx0XHRcdFx0XHRcdG1pbWU6ICd2aWRlby9tYXRyb3NrYScsXG5cdFx0XHRcdFx0fTtcblxuXHRcdFx0XHRkZWZhdWx0OlxuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRpZiAodGhpcy5jaGVja1N0cmluZygnU1FMaScpKSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRleHQ6ICdzcWxpdGUnLFxuXHRcdFx0XHRtaW1lOiAnYXBwbGljYXRpb24veC1zcWxpdGUzJyxcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuY2hlY2soWzB4NEUsIDB4NDUsIDB4NTMsIDB4MUFdKSkge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0ZXh0OiAnbmVzJyxcblx0XHRcdFx0bWltZTogJ2FwcGxpY2F0aW9uL3gtbmludGVuZG8tbmVzLXJvbScsXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLmNoZWNrU3RyaW5nKCdDcjI0JykpIHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGV4dDogJ2NyeCcsXG5cdFx0XHRcdG1pbWU6ICdhcHBsaWNhdGlvbi94LWdvb2dsZS1jaHJvbWUtZXh0ZW5zaW9uJyxcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0aWYgKFxuXHRcdFx0dGhpcy5jaGVja1N0cmluZygnTVNDRicpXG5cdFx0XHR8fCB0aGlzLmNoZWNrU3RyaW5nKCdJU2MoJylcblx0XHQpIHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGV4dDogJ2NhYicsXG5cdFx0XHRcdG1pbWU6ICdhcHBsaWNhdGlvbi92bmQubXMtY2FiLWNvbXByZXNzZWQnLFxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5jaGVjayhbMHhFRCwgMHhBQiwgMHhFRSwgMHhEQl0pKSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRleHQ6ICdycG0nLFxuXHRcdFx0XHRtaW1lOiAnYXBwbGljYXRpb24veC1ycG0nLFxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5jaGVjayhbMHhDNSwgMHhEMCwgMHhEMywgMHhDNl0pKSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRleHQ6ICdlcHMnLFxuXHRcdFx0XHRtaW1lOiAnYXBwbGljYXRpb24vZXBzJyxcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuY2hlY2soWzB4MjgsIDB4QjUsIDB4MkYsIDB4RkRdKSkge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0ZXh0OiAnenN0Jyxcblx0XHRcdFx0bWltZTogJ2FwcGxpY2F0aW9uL3pzdGQnLFxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5jaGVjayhbMHg3RiwgMHg0NSwgMHg0QywgMHg0Nl0pKSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRleHQ6ICdlbGYnLFxuXHRcdFx0XHRtaW1lOiAnYXBwbGljYXRpb24veC1lbGYnLFxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5jaGVjayhbMHgyMSwgMHg0MiwgMHg0NCwgMHg0RV0pKSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRleHQ6ICdwc3QnLFxuXHRcdFx0XHRtaW1lOiAnYXBwbGljYXRpb24vdm5kLm1zLW91dGxvb2snLFxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5jaGVja1N0cmluZygnUEFSMScpIHx8IHRoaXMuY2hlY2tTdHJpbmcoJ1BBUkUnKSkge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0ZXh0OiAncGFycXVldCcsXG5cdFx0XHRcdG1pbWU6ICdhcHBsaWNhdGlvbi92bmQuYXBhY2hlLnBhcnF1ZXQnLFxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5jaGVja1N0cmluZygndHRjZicpKSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRleHQ6ICd0dGMnLFxuXHRcdFx0XHRtaW1lOiAnZm9udC9jb2xsZWN0aW9uJyxcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuY2hlY2soWzB4Q0YsIDB4RkEsIDB4RUQsIDB4RkVdKSkge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0ZXh0OiAnbWFjaG8nLFxuXHRcdFx0XHRtaW1lOiAnYXBwbGljYXRpb24veC1tYWNoLWJpbmFyeScsXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLmNoZWNrKFsweDA0LCAweDIyLCAweDRELCAweDE4XSkpIHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGV4dDogJ2x6NCcsXG5cdFx0XHRcdG1pbWU6ICdhcHBsaWNhdGlvbi94LWx6NCcsIC8vIEludmVudGVkIGJ5IHVzXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLmNoZWNrU3RyaW5nKCdyZWdmJykpIHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGV4dDogJ2RhdCcsXG5cdFx0XHRcdG1pbWU6ICdhcHBsaWNhdGlvbi94LWZ0LXdpbmRvd3MtcmVnaXN0cnktaGl2ZScsXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdC8vIC0tIDUtYnl0ZSBzaWduYXR1cmVzIC0tXG5cblx0XHRpZiAodGhpcy5jaGVjayhbMHg0RiwgMHg1NCwgMHg1NCwgMHg0RiwgMHgwMF0pKSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRleHQ6ICdvdGYnLFxuXHRcdFx0XHRtaW1lOiAnZm9udC9vdGYnLFxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5jaGVja1N0cmluZygnIyFBTVInKSkge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0ZXh0OiAnYW1yJyxcblx0XHRcdFx0bWltZTogJ2F1ZGlvL2FtcicsXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLmNoZWNrU3RyaW5nKCd7XFxcXHJ0ZicpKSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRleHQ6ICdydGYnLFxuXHRcdFx0XHRtaW1lOiAnYXBwbGljYXRpb24vcnRmJyxcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuY2hlY2soWzB4NDYsIDB4NEMsIDB4NTYsIDB4MDFdKSkge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0ZXh0OiAnZmx2Jyxcblx0XHRcdFx0bWltZTogJ3ZpZGVvL3gtZmx2Jyxcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuY2hlY2tTdHJpbmcoJ0lNUE0nKSkge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0ZXh0OiAnaXQnLFxuXHRcdFx0XHRtaW1lOiAnYXVkaW8veC1pdCcsXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdGlmIChcblx0XHRcdHRoaXMuY2hlY2tTdHJpbmcoJy1saDAtJywge29mZnNldDogMn0pXG5cdFx0XHR8fCB0aGlzLmNoZWNrU3RyaW5nKCctbGgxLScsIHtvZmZzZXQ6IDJ9KVxuXHRcdFx0fHwgdGhpcy5jaGVja1N0cmluZygnLWxoMi0nLCB7b2Zmc2V0OiAyfSlcblx0XHRcdHx8IHRoaXMuY2hlY2tTdHJpbmcoJy1saDMtJywge29mZnNldDogMn0pXG5cdFx0XHR8fCB0aGlzLmNoZWNrU3RyaW5nKCctbGg0LScsIHtvZmZzZXQ6IDJ9KVxuXHRcdFx0fHwgdGhpcy5jaGVja1N0cmluZygnLWxoNS0nLCB7b2Zmc2V0OiAyfSlcblx0XHRcdHx8IHRoaXMuY2hlY2tTdHJpbmcoJy1saDYtJywge29mZnNldDogMn0pXG5cdFx0XHR8fCB0aGlzLmNoZWNrU3RyaW5nKCctbGg3LScsIHtvZmZzZXQ6IDJ9KVxuXHRcdFx0fHwgdGhpcy5jaGVja1N0cmluZygnLWx6cy0nLCB7b2Zmc2V0OiAyfSlcblx0XHRcdHx8IHRoaXMuY2hlY2tTdHJpbmcoJy1sejQtJywge29mZnNldDogMn0pXG5cdFx0XHR8fCB0aGlzLmNoZWNrU3RyaW5nKCctbHo1LScsIHtvZmZzZXQ6IDJ9KVxuXHRcdFx0fHwgdGhpcy5jaGVja1N0cmluZygnLWxoZC0nLCB7b2Zmc2V0OiAyfSlcblx0XHQpIHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGV4dDogJ2x6aCcsXG5cdFx0XHRcdG1pbWU6ICdhcHBsaWNhdGlvbi94LWx6aC1jb21wcmVzc2VkJyxcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0Ly8gTVBFRyBwcm9ncmFtIHN0cmVhbSAoUFMgb3IgTVBFRy1QUylcblx0XHRpZiAodGhpcy5jaGVjayhbMHgwMCwgMHgwMCwgMHgwMSwgMHhCQV0pKSB7XG5cdFx0XHQvLyAgTVBFRy1QUywgTVBFRy0xIFBhcnQgMVxuXHRcdFx0aWYgKHRoaXMuY2hlY2soWzB4MjFdLCB7b2Zmc2V0OiA0LCBtYXNrOiBbMHhGMV19KSkge1xuXHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdGV4dDogJ21wZycsIC8vIE1heSBhbHNvIGJlIC5wcywgLm1wZWdcblx0XHRcdFx0XHRtaW1lOiAndmlkZW8vTVAxUycsXG5cdFx0XHRcdH07XG5cdFx0XHR9XG5cblx0XHRcdC8vIE1QRUctUFMsIE1QRUctMiBQYXJ0IDFcblx0XHRcdGlmICh0aGlzLmNoZWNrKFsweDQ0XSwge29mZnNldDogNCwgbWFzazogWzB4QzRdfSkpIHtcblx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRleHQ6ICdtcGcnLCAvLyBNYXkgYWxzbyBiZSAubXBnLCAubTJwLCAudm9iIG9yIC5zdWJcblx0XHRcdFx0XHRtaW1lOiAndmlkZW8vTVAyUCcsXG5cdFx0XHRcdH07XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuY2hlY2tTdHJpbmcoJ0lUU0YnKSkge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0ZXh0OiAnY2htJyxcblx0XHRcdFx0bWltZTogJ2FwcGxpY2F0aW9uL3ZuZC5tcy1odG1saGVscCcsXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLmNoZWNrKFsweENBLCAweEZFLCAweEJBLCAweEJFXSkpIHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGV4dDogJ2NsYXNzJyxcblx0XHRcdFx0bWltZTogJ2FwcGxpY2F0aW9uL2phdmEtdm0nLFxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5jaGVja1N0cmluZygnLlJNRicpKSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRleHQ6ICdybScsXG5cdFx0XHRcdG1pbWU6ICdhcHBsaWNhdGlvbi92bmQucm4tcmVhbG1lZGlhJyxcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0Ly8gLS0gNS1ieXRlIHNpZ25hdHVyZXMgLS1cblxuXHRcdGlmICh0aGlzLmNoZWNrU3RyaW5nKCdEUkFDTycpKSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRleHQ6ICdkcmMnLFxuXHRcdFx0XHRtaW1lOiAnYXBwbGljYXRpb24vdm5kLmdvb2dsZS5kcmFjbycsIC8vIEludmVudGVkIGJ5IHVzXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdC8vIC0tIDYtYnl0ZSBzaWduYXR1cmVzIC0tXG5cblx0XHRpZiAodGhpcy5jaGVjayhbMHhGRCwgMHgzNywgMHg3QSwgMHg1OCwgMHg1QSwgMHgwMF0pKSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRleHQ6ICd4eicsXG5cdFx0XHRcdG1pbWU6ICdhcHBsaWNhdGlvbi94LXh6Jyxcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuY2hlY2tTdHJpbmcoJzw/eG1sICcpKSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRleHQ6ICd4bWwnLFxuXHRcdFx0XHRtaW1lOiAnYXBwbGljYXRpb24veG1sJyxcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuY2hlY2soWzB4MzcsIDB4N0EsIDB4QkMsIDB4QUYsIDB4MjcsIDB4MUNdKSkge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0ZXh0OiAnN3onLFxuXHRcdFx0XHRtaW1lOiAnYXBwbGljYXRpb24veC03ei1jb21wcmVzc2VkJyxcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0aWYgKFxuXHRcdFx0dGhpcy5jaGVjayhbMHg1MiwgMHg2MSwgMHg3MiwgMHgyMSwgMHgxQSwgMHg3XSlcblx0XHRcdCYmICh0aGlzLmJ1ZmZlcls2XSA9PT0gMHgwIHx8IHRoaXMuYnVmZmVyWzZdID09PSAweDEpXG5cdFx0KSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRleHQ6ICdyYXInLFxuXHRcdFx0XHRtaW1lOiAnYXBwbGljYXRpb24veC1yYXItY29tcHJlc3NlZCcsXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLmNoZWNrU3RyaW5nKCdzb2xpZCAnKSkge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0ZXh0OiAnc3RsJyxcblx0XHRcdFx0bWltZTogJ21vZGVsL3N0bCcsXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLmNoZWNrU3RyaW5nKCdBQycpKSB7XG5cdFx0XHRjb25zdCB2ZXJzaW9uID0gbmV3IFRva2VuLlN0cmluZ1R5cGUoNCwgJ2xhdGluMScpLmdldCh0aGlzLmJ1ZmZlciwgMik7XG5cdFx0XHRpZiAodmVyc2lvbi5tYXRjaCgnXmQqJykgJiYgdmVyc2lvbiA+PSAxMDAwICYmIHZlcnNpb24gPD0gMTA1MCkge1xuXHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdGV4dDogJ2R3ZycsXG5cdFx0XHRcdFx0bWltZTogJ2ltYWdlL3ZuZC5kd2cnLFxuXHRcdFx0XHR9O1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmICh0aGlzLmNoZWNrU3RyaW5nKCcwNzA3MDcnKSkge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0ZXh0OiAnY3BpbycsXG5cdFx0XHRcdG1pbWU6ICdhcHBsaWNhdGlvbi94LWNwaW8nLFxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHQvLyAtLSA3LWJ5dGUgc2lnbmF0dXJlcyAtLVxuXG5cdFx0aWYgKHRoaXMuY2hlY2tTdHJpbmcoJ0JMRU5ERVInKSkge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0ZXh0OiAnYmxlbmQnLFxuXHRcdFx0XHRtaW1lOiAnYXBwbGljYXRpb24veC1ibGVuZGVyJyxcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuY2hlY2tTdHJpbmcoJyE8YXJjaD4nKSkge1xuXHRcdFx0YXdhaXQgdG9rZW5pemVyLmlnbm9yZSg4KTtcblx0XHRcdGNvbnN0IHN0cmluZyA9IGF3YWl0IHRva2VuaXplci5yZWFkVG9rZW4obmV3IFRva2VuLlN0cmluZ1R5cGUoMTMsICdhc2NpaScpKTtcblx0XHRcdGlmIChzdHJpbmcgPT09ICdkZWJpYW4tYmluYXJ5Jykge1xuXHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdGV4dDogJ2RlYicsXG5cdFx0XHRcdFx0bWltZTogJ2FwcGxpY2F0aW9uL3gtZGViJyxcblx0XHRcdFx0fTtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0ZXh0OiAnYXInLFxuXHRcdFx0XHRtaW1lOiAnYXBwbGljYXRpb24veC11bml4LWFyY2hpdmUnLFxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHRpZiAoXG5cdFx0XHR0aGlzLmNoZWNrU3RyaW5nKCdXRUJWVFQnKVxuXHRcdFx0JiZcdChcblx0XHRcdFx0Ly8gT25lIG9mIExGLCBDUiwgdGFiLCBzcGFjZSwgb3IgZW5kIG9mIGZpbGUgbXVzdCBmb2xsb3cgXCJXRUJWVFRcIiBwZXIgdGhlIHNwZWMgKHNlZSBgZml4dHVyZS9maXh0dXJlLXZ0dC0qLnZ0dGAgZm9yIGV4YW1wbGVzKS4gTm90ZSB0aGF0IGBcXDBgIGlzIHRlY2huaWNhbGx5IHRoZSBudWxsIGNoYXJhY3RlciAodGhlcmUgaXMgbm8gc3VjaCB0aGluZyBhcyBhbiBFT0YgY2hhcmFjdGVyKS4gSG93ZXZlciwgY2hlY2tpbmcgZm9yIGBcXDBgIGdpdmVzIHVzIHRoZSBzYW1lIHJlc3VsdCBhcyBjaGVja2luZyBmb3IgdGhlIGVuZCBvZiB0aGUgc3RyZWFtLlxuXHRcdFx0XHQoWydcXG4nLCAnXFxyJywgJ1xcdCcsICcgJywgJ1xcMCddLnNvbWUoY2hhcjcgPT4gdGhpcy5jaGVja1N0cmluZyhjaGFyNywge29mZnNldDogNn0pKSkpXG5cdFx0KSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRleHQ6ICd2dHQnLFxuXHRcdFx0XHRtaW1lOiAndGV4dC92dHQnLFxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHQvLyAtLSA4LWJ5dGUgc2lnbmF0dXJlcyAtLVxuXG5cdFx0aWYgKHRoaXMuY2hlY2soWzB4ODksIDB4NTAsIDB4NEUsIDB4NDcsIDB4MEQsIDB4MEEsIDB4MUEsIDB4MEFdKSkge1xuXHRcdFx0Ly8gQVBORyBmb3JtYXQgKGh0dHBzOi8vd2lraS5tb3ppbGxhLm9yZy9BUE5HX1NwZWNpZmljYXRpb24pXG5cdFx0XHQvLyAxLiBGaW5kIHRoZSBmaXJzdCBJREFUIChpbWFnZSBkYXRhKSBjaHVuayAoNDkgNDQgNDEgNTQpXG5cdFx0XHQvLyAyLiBDaGVjayBpZiB0aGVyZSBpcyBhbiBcImFjVExcIiBjaHVuayBiZWZvcmUgdGhlIElEQVQgb25lICg2MSA2MyA1NCA0QylcblxuXHRcdFx0Ly8gT2Zmc2V0IGNhbGN1bGF0ZWQgYXMgZm9sbG93czpcblx0XHRcdC8vIC0gOCBieXRlczogUE5HIHNpZ25hdHVyZVxuXHRcdFx0Ly8gLSA0IChsZW5ndGgpICsgNCAoY2h1bmsgdHlwZSkgKyAxMyAoY2h1bmsgZGF0YSkgKyA0IChDUkMpOiBJSERSIGNodW5rXG5cblx0XHRcdGF3YWl0IHRva2VuaXplci5pZ25vcmUoOCk7IC8vIGlnbm9yZSBQTkcgc2lnbmF0dXJlXG5cblx0XHRcdGFzeW5jIGZ1bmN0aW9uIHJlYWRDaHVua0hlYWRlcigpIHtcblx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRsZW5ndGg6IGF3YWl0IHRva2VuaXplci5yZWFkVG9rZW4oVG9rZW4uSU5UMzJfQkUpLFxuXHRcdFx0XHRcdHR5cGU6IGF3YWl0IHRva2VuaXplci5yZWFkVG9rZW4obmV3IFRva2VuLlN0cmluZ1R5cGUoNCwgJ2xhdGluMScpKSxcblx0XHRcdFx0fTtcblx0XHRcdH1cblxuXHRcdFx0ZG8ge1xuXHRcdFx0XHRjb25zdCBjaHVuayA9IGF3YWl0IHJlYWRDaHVua0hlYWRlcigpO1xuXHRcdFx0XHRpZiAoY2h1bmsubGVuZ3RoIDwgMCkge1xuXHRcdFx0XHRcdHJldHVybjsgLy8gSW52YWxpZCBjaHVuayBsZW5ndGhcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHN3aXRjaCAoY2h1bmsudHlwZSkge1xuXHRcdFx0XHRcdGNhc2UgJ0lEQVQnOlxuXHRcdFx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRcdFx0ZXh0OiAncG5nJyxcblx0XHRcdFx0XHRcdFx0bWltZTogJ2ltYWdlL3BuZycsXG5cdFx0XHRcdFx0XHR9O1xuXHRcdFx0XHRcdGNhc2UgJ2FjVEwnOlxuXHRcdFx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRcdFx0ZXh0OiAnYXBuZycsXG5cdFx0XHRcdFx0XHRcdG1pbWU6ICdpbWFnZS9hcG5nJyxcblx0XHRcdFx0XHRcdH07XG5cdFx0XHRcdFx0ZGVmYXVsdDpcblx0XHRcdFx0XHRcdGF3YWl0IHRva2VuaXplci5pZ25vcmUoY2h1bmsubGVuZ3RoICsgNCk7IC8vIElnbm9yZSBjaHVuay1kYXRhICsgQ1JDXG5cdFx0XHRcdH1cblx0XHRcdH0gd2hpbGUgKHRva2VuaXplci5wb3NpdGlvbiArIDggPCB0b2tlbml6ZXIuZmlsZUluZm8uc2l6ZSk7XG5cblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGV4dDogJ3BuZycsXG5cdFx0XHRcdG1pbWU6ICdpbWFnZS9wbmcnLFxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5jaGVjayhbMHg0MSwgMHg1MiwgMHg1MiwgMHg0RiwgMHg1NywgMHgzMSwgMHgwMCwgMHgwMF0pKSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRleHQ6ICdhcnJvdycsXG5cdFx0XHRcdG1pbWU6ICdhcHBsaWNhdGlvbi92bmQuYXBhY2hlLmFycm93LmZpbGUnLFxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5jaGVjayhbMHg2NywgMHg2QywgMHg1NCwgMHg0NiwgMHgwMiwgMHgwMCwgMHgwMCwgMHgwMF0pKSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRleHQ6ICdnbGInLFxuXHRcdFx0XHRtaW1lOiAnbW9kZWwvZ2x0Zi1iaW5hcnknLFxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHQvLyBgbW92YCBmb3JtYXQgdmFyaWFudHNcblx0XHRpZiAoXG5cdFx0XHR0aGlzLmNoZWNrKFsweDY2LCAweDcyLCAweDY1LCAweDY1XSwge29mZnNldDogNH0pIC8vIGBmcmVlYFxuXHRcdFx0fHwgdGhpcy5jaGVjayhbMHg2RCwgMHg2NCwgMHg2MSwgMHg3NF0sIHtvZmZzZXQ6IDR9KSAvLyBgbWRhdGAgTUpQRUdcblx0XHRcdHx8IHRoaXMuY2hlY2soWzB4NkQsIDB4NkYsIDB4NkYsIDB4NzZdLCB7b2Zmc2V0OiA0fSkgLy8gYG1vb3ZgXG5cdFx0XHR8fCB0aGlzLmNoZWNrKFsweDc3LCAweDY5LCAweDY0LCAweDY1XSwge29mZnNldDogNH0pIC8vIGB3aWRlYFxuXHRcdCkge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0ZXh0OiAnbW92Jyxcblx0XHRcdFx0bWltZTogJ3ZpZGVvL3F1aWNrdGltZScsXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdC8vIC0tIDktYnl0ZSBzaWduYXR1cmVzIC0tXG5cblx0XHRpZiAodGhpcy5jaGVjayhbMHg0OSwgMHg0OSwgMHg1MiwgMHg0RiwgMHgwOCwgMHgwMCwgMHgwMCwgMHgwMCwgMHgxOF0pKSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRleHQ6ICdvcmYnLFxuXHRcdFx0XHRtaW1lOiAnaW1hZ2UveC1vbHltcHVzLW9yZicsXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLmNoZWNrU3RyaW5nKCdnaW1wIHhjZiAnKSkge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0ZXh0OiAneGNmJyxcblx0XHRcdFx0bWltZTogJ2ltYWdlL3gteGNmJyxcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0Ly8gRmlsZSBUeXBlIEJveCAoaHR0cHM6Ly9lbi53aWtpcGVkaWEub3JnL3dpa2kvSVNPX2Jhc2VfbWVkaWFfZmlsZV9mb3JtYXQpXG5cdFx0Ly8gSXQncyBub3QgcmVxdWlyZWQgdG8gYmUgZmlyc3QsIGJ1dCBpdCdzIHJlY29tbWVuZGVkIHRvIGJlLiBBbG1vc3QgYWxsIElTTyBiYXNlIG1lZGlhIGZpbGVzIHN0YXJ0IHdpdGggYGZ0eXBgIGJveC5cblx0XHQvLyBgZnR5cGAgYm94IG11c3QgY29udGFpbiBhIGJyYW5kIG1ham9yIGlkZW50aWZpZXIsIHdoaWNoIG11c3QgY29uc2lzdCBvZiBJU08gODg1OS0xIHByaW50YWJsZSBjaGFyYWN0ZXJzLlxuXHRcdC8vIEhlcmUgd2UgY2hlY2sgZm9yIDg4NTktMSBwcmludGFibGUgY2hhcmFjdGVycyAoZm9yIHNpbXBsaWNpdHksIGl0J3MgYSBtYXNrIHdoaWNoIGFsc28gY2F0Y2hlcyBvbmUgbm9uLXByaW50YWJsZSBjaGFyYWN0ZXIpLlxuXHRcdGlmIChcblx0XHRcdHRoaXMuY2hlY2tTdHJpbmcoJ2Z0eXAnLCB7b2Zmc2V0OiA0fSlcblx0XHRcdCYmICh0aGlzLmJ1ZmZlcls4XSAmIDB4NjApICE9PSAweDAwIC8vIEJyYW5kIG1ham9yLCBmaXJzdCBjaGFyYWN0ZXIgQVNDSUk/XG5cdFx0KSB7XG5cdFx0XHQvLyBUaGV5IGFsbCBjYW4gaGF2ZSBNSU1FIGB2aWRlby9tcDRgIGV4Y2VwdCBgYXBwbGljYXRpb24vbXA0YCBzcGVjaWFsLWNhc2Ugd2hpY2ggaXMgaGFyZCB0byBkZXRlY3QuXG5cdFx0XHQvLyBGb3Igc29tZSBjYXNlcywgd2UncmUgc3BlY2lmaWMsIGV2ZXJ5dGhpbmcgZWxzZSBmYWxscyB0byBgdmlkZW8vbXA0YCB3aXRoIGBtcDRgIGV4dGVuc2lvbi5cblx0XHRcdGNvbnN0IGJyYW5kTWFqb3IgPSBuZXcgVG9rZW4uU3RyaW5nVHlwZSg0LCAnbGF0aW4xJykuZ2V0KHRoaXMuYnVmZmVyLCA4KS5yZXBsYWNlKCdcXDAnLCAnICcpLnRyaW0oKTtcblx0XHRcdHN3aXRjaCAoYnJhbmRNYWpvcikge1xuXHRcdFx0XHRjYXNlICdhdmlmJzpcblx0XHRcdFx0Y2FzZSAnYXZpcyc6XG5cdFx0XHRcdFx0cmV0dXJuIHtleHQ6ICdhdmlmJywgbWltZTogJ2ltYWdlL2F2aWYnfTtcblx0XHRcdFx0Y2FzZSAnbWlmMSc6XG5cdFx0XHRcdFx0cmV0dXJuIHtleHQ6ICdoZWljJywgbWltZTogJ2ltYWdlL2hlaWYnfTtcblx0XHRcdFx0Y2FzZSAnbXNmMSc6XG5cdFx0XHRcdFx0cmV0dXJuIHtleHQ6ICdoZWljJywgbWltZTogJ2ltYWdlL2hlaWYtc2VxdWVuY2UnfTtcblx0XHRcdFx0Y2FzZSAnaGVpYyc6XG5cdFx0XHRcdGNhc2UgJ2hlaXgnOlxuXHRcdFx0XHRcdHJldHVybiB7ZXh0OiAnaGVpYycsIG1pbWU6ICdpbWFnZS9oZWljJ307XG5cdFx0XHRcdGNhc2UgJ2hldmMnOlxuXHRcdFx0XHRjYXNlICdoZXZ4Jzpcblx0XHRcdFx0XHRyZXR1cm4ge2V4dDogJ2hlaWMnLCBtaW1lOiAnaW1hZ2UvaGVpYy1zZXF1ZW5jZSd9O1xuXHRcdFx0XHRjYXNlICdxdCc6XG5cdFx0XHRcdFx0cmV0dXJuIHtleHQ6ICdtb3YnLCBtaW1lOiAndmlkZW8vcXVpY2t0aW1lJ307XG5cdFx0XHRcdGNhc2UgJ000Vic6XG5cdFx0XHRcdGNhc2UgJ000VkgnOlxuXHRcdFx0XHRjYXNlICdNNFZQJzpcblx0XHRcdFx0XHRyZXR1cm4ge2V4dDogJ200dicsIG1pbWU6ICd2aWRlby94LW00did9O1xuXHRcdFx0XHRjYXNlICdNNFAnOlxuXHRcdFx0XHRcdHJldHVybiB7ZXh0OiAnbTRwJywgbWltZTogJ3ZpZGVvL21wNCd9O1xuXHRcdFx0XHRjYXNlICdNNEInOlxuXHRcdFx0XHRcdHJldHVybiB7ZXh0OiAnbTRiJywgbWltZTogJ2F1ZGlvL21wNCd9O1xuXHRcdFx0XHRjYXNlICdNNEEnOlxuXHRcdFx0XHRcdHJldHVybiB7ZXh0OiAnbTRhJywgbWltZTogJ2F1ZGlvL3gtbTRhJ307XG5cdFx0XHRcdGNhc2UgJ0Y0Vic6XG5cdFx0XHRcdFx0cmV0dXJuIHtleHQ6ICdmNHYnLCBtaW1lOiAndmlkZW8vbXA0J307XG5cdFx0XHRcdGNhc2UgJ0Y0UCc6XG5cdFx0XHRcdFx0cmV0dXJuIHtleHQ6ICdmNHAnLCBtaW1lOiAndmlkZW8vbXA0J307XG5cdFx0XHRcdGNhc2UgJ0Y0QSc6XG5cdFx0XHRcdFx0cmV0dXJuIHtleHQ6ICdmNGEnLCBtaW1lOiAnYXVkaW8vbXA0J307XG5cdFx0XHRcdGNhc2UgJ0Y0Qic6XG5cdFx0XHRcdFx0cmV0dXJuIHtleHQ6ICdmNGInLCBtaW1lOiAnYXVkaW8vbXA0J307XG5cdFx0XHRcdGNhc2UgJ2NyeCc6XG5cdFx0XHRcdFx0cmV0dXJuIHtleHQ6ICdjcjMnLCBtaW1lOiAnaW1hZ2UveC1jYW5vbi1jcjMnfTtcblx0XHRcdFx0ZGVmYXVsdDpcblx0XHRcdFx0XHRpZiAoYnJhbmRNYWpvci5zdGFydHNXaXRoKCczZycpKSB7XG5cdFx0XHRcdFx0XHRpZiAoYnJhbmRNYWpvci5zdGFydHNXaXRoKCczZzInKSkge1xuXHRcdFx0XHRcdFx0XHRyZXR1cm4ge2V4dDogJzNnMicsIG1pbWU6ICd2aWRlby8zZ3BwMid9O1xuXHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0XHRyZXR1cm4ge2V4dDogJzNncCcsIG1pbWU6ICd2aWRlby8zZ3BwJ307XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0cmV0dXJuIHtleHQ6ICdtcDQnLCBtaW1lOiAndmlkZW8vbXA0J307XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gLS0gMTAtYnl0ZSBzaWduYXR1cmVzIC0tXG5cblx0XHRpZiAodGhpcy5jaGVja1N0cmluZygnUkVHRURJVDRcXHJcXG4nKSkge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0ZXh0OiAncmVnJyxcblx0XHRcdFx0bWltZTogJ2FwcGxpY2F0aW9uL3gtbXMtcmVnZWRpdCcsXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdC8vIC0tIDEyLWJ5dGUgc2lnbmF0dXJlcyAtLVxuXG5cdFx0Ly8gUklGRiBmaWxlIGZvcm1hdCB3aGljaCBtaWdodCBiZSBBVkksIFdBViwgUUNQLCBldGNcblx0XHRpZiAodGhpcy5jaGVjayhbMHg1MiwgMHg0OSwgMHg0NiwgMHg0Nl0pKSB7XG5cdFx0XHRpZiAodGhpcy5jaGVja1N0cmluZygnV0VCUCcsIHtvZmZzZXQ6IDh9KSkge1xuXHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdGV4dDogJ3dlYnAnLFxuXHRcdFx0XHRcdG1pbWU6ICdpbWFnZS93ZWJwJyxcblx0XHRcdFx0fTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKHRoaXMuY2hlY2soWzB4NDEsIDB4NTYsIDB4NDldLCB7b2Zmc2V0OiA4fSkpIHtcblx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRleHQ6ICdhdmknLFxuXHRcdFx0XHRcdG1pbWU6ICd2aWRlby92bmQuYXZpJyxcblx0XHRcdFx0fTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKHRoaXMuY2hlY2soWzB4NTcsIDB4NDEsIDB4NTYsIDB4NDVdLCB7b2Zmc2V0OiA4fSkpIHtcblx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRleHQ6ICd3YXYnLFxuXHRcdFx0XHRcdG1pbWU6ICdhdWRpby93YXYnLFxuXHRcdFx0XHR9O1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBRTENNLCBRQ1AgZmlsZVxuXHRcdFx0aWYgKHRoaXMuY2hlY2soWzB4NTEsIDB4NEMsIDB4NDMsIDB4NERdLCB7b2Zmc2V0OiA4fSkpIHtcblx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRleHQ6ICdxY3AnLFxuXHRcdFx0XHRcdG1pbWU6ICdhdWRpby9xY2VscCcsXG5cdFx0XHRcdH07XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuY2hlY2soWzB4NDksIDB4NDksIDB4NTUsIDB4MDAsIDB4MTgsIDB4MDAsIDB4MDAsIDB4MDAsIDB4ODgsIDB4RTcsIDB4NzQsIDB4RDhdKSkge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0ZXh0OiAncncyJyxcblx0XHRcdFx0bWltZTogJ2ltYWdlL3gtcGFuYXNvbmljLXJ3MicsXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdC8vIEFTRl9IZWFkZXJfT2JqZWN0IGZpcnN0IDgwIGJ5dGVzXG5cdFx0aWYgKHRoaXMuY2hlY2soWzB4MzAsIDB4MjYsIDB4QjIsIDB4NzUsIDB4OEUsIDB4NjYsIDB4Q0YsIDB4MTEsIDB4QTYsIDB4RDldKSkge1xuXHRcdFx0YXN5bmMgZnVuY3Rpb24gcmVhZEhlYWRlcigpIHtcblx0XHRcdFx0Y29uc3QgZ3VpZCA9IG5ldyBVaW50OEFycmF5KDE2KTtcblx0XHRcdFx0YXdhaXQgdG9rZW5pemVyLnJlYWRCdWZmZXIoZ3VpZCk7XG5cdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0aWQ6IGd1aWQsXG5cdFx0XHRcdFx0c2l6ZTogTnVtYmVyKGF3YWl0IHRva2VuaXplci5yZWFkVG9rZW4oVG9rZW4uVUlOVDY0X0xFKSksXG5cdFx0XHRcdH07XG5cdFx0XHR9XG5cblx0XHRcdGF3YWl0IHRva2VuaXplci5pZ25vcmUoMzApO1xuXHRcdFx0Ly8gU2VhcmNoIGZvciBoZWFkZXIgc2hvdWxkIGJlIGluIGZpcnN0IDFLQiBvZiBmaWxlLlxuXHRcdFx0d2hpbGUgKHRva2VuaXplci5wb3NpdGlvbiArIDI0IDwgdG9rZW5pemVyLmZpbGVJbmZvLnNpemUpIHtcblx0XHRcdFx0Y29uc3QgaGVhZGVyID0gYXdhaXQgcmVhZEhlYWRlcigpO1xuXHRcdFx0XHRsZXQgcGF5bG9hZCA9IGhlYWRlci5zaXplIC0gMjQ7XG5cdFx0XHRcdGlmIChfY2hlY2soaGVhZGVyLmlkLCBbMHg5MSwgMHgwNywgMHhEQywgMHhCNywgMHhCNywgMHhBOSwgMHhDRiwgMHgxMSwgMHg4RSwgMHhFNiwgMHgwMCwgMHhDMCwgMHgwQywgMHgyMCwgMHg1MywgMHg2NV0pKSB7XG5cdFx0XHRcdFx0Ly8gU3luYyBvbiBTdHJlYW0tUHJvcGVydGllcy1PYmplY3QgKEI3REMwNzkxLUE5QjctMTFDRi04RUU2LTAwQzAwQzIwNTM2NSlcblx0XHRcdFx0XHRjb25zdCB0eXBlSWQgPSBuZXcgVWludDhBcnJheSgxNik7XG5cdFx0XHRcdFx0cGF5bG9hZCAtPSBhd2FpdCB0b2tlbml6ZXIucmVhZEJ1ZmZlcih0eXBlSWQpO1xuXG5cdFx0XHRcdFx0aWYgKF9jaGVjayh0eXBlSWQsIFsweDQwLCAweDlFLCAweDY5LCAweEY4LCAweDRELCAweDVCLCAweENGLCAweDExLCAweEE4LCAweEZELCAweDAwLCAweDgwLCAweDVGLCAweDVDLCAweDQ0LCAweDJCXSkpIHtcblx0XHRcdFx0XHRcdC8vIEZvdW5kIGF1ZGlvOlxuXHRcdFx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRcdFx0ZXh0OiAnYXNmJyxcblx0XHRcdFx0XHRcdFx0bWltZTogJ2F1ZGlvL3gtbXMtYXNmJyxcblx0XHRcdFx0XHRcdH07XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0aWYgKF9jaGVjayh0eXBlSWQsIFsweEMwLCAweEVGLCAweDE5LCAweEJDLCAweDRELCAweDVCLCAweENGLCAweDExLCAweEE4LCAweEZELCAweDAwLCAweDgwLCAweDVGLCAweDVDLCAweDQ0LCAweDJCXSkpIHtcblx0XHRcdFx0XHRcdC8vIEZvdW5kIHZpZGVvOlxuXHRcdFx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRcdFx0ZXh0OiAnYXNmJyxcblx0XHRcdFx0XHRcdFx0bWltZTogJ3ZpZGVvL3gtbXMtYXNmJyxcblx0XHRcdFx0XHRcdH07XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRhd2FpdCB0b2tlbml6ZXIuaWdub3JlKHBheWxvYWQpO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBEZWZhdWx0IHRvIEFTRiBnZW5lcmljIGV4dGVuc2lvblxuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0ZXh0OiAnYXNmJyxcblx0XHRcdFx0bWltZTogJ2FwcGxpY2F0aW9uL3ZuZC5tcy1hc2YnLFxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5jaGVjayhbMHhBQiwgMHg0QiwgMHg1NCwgMHg1OCwgMHgyMCwgMHgzMSwgMHgzMSwgMHhCQiwgMHgwRCwgMHgwQSwgMHgxQSwgMHgwQV0pKSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRleHQ6ICdrdHgnLFxuXHRcdFx0XHRtaW1lOiAnaW1hZ2Uva3R4Jyxcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0aWYgKCh0aGlzLmNoZWNrKFsweDdFLCAweDEwLCAweDA0XSkgfHwgdGhpcy5jaGVjayhbMHg3RSwgMHgxOCwgMHgwNF0pKSAmJiB0aGlzLmNoZWNrKFsweDMwLCAweDRELCAweDQ5LCAweDQ1XSwge29mZnNldDogNH0pKSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRleHQ6ICdtaWUnLFxuXHRcdFx0XHRtaW1lOiAnYXBwbGljYXRpb24veC1taWUnLFxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5jaGVjayhbMHgyNywgMHgwQSwgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMF0sIHtvZmZzZXQ6IDJ9KSkge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0ZXh0OiAnc2hwJyxcblx0XHRcdFx0bWltZTogJ2FwcGxpY2F0aW9uL3gtZXNyaS1zaGFwZScsXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLmNoZWNrKFsweEZGLCAweDRGLCAweEZGLCAweDUxXSkpIHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGV4dDogJ2oyYycsXG5cdFx0XHRcdG1pbWU6ICdpbWFnZS9qMmMnLFxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5jaGVjayhbMHgwMCwgMHgwMCwgMHgwMCwgMHgwQywgMHg2QSwgMHg1MCwgMHgyMCwgMHgyMCwgMHgwRCwgMHgwQSwgMHg4NywgMHgwQV0pKSB7XG5cdFx0XHQvLyBKUEVHLTIwMDAgZmFtaWx5XG5cblx0XHRcdGF3YWl0IHRva2VuaXplci5pZ25vcmUoMjApO1xuXHRcdFx0Y29uc3QgdHlwZSA9IGF3YWl0IHRva2VuaXplci5yZWFkVG9rZW4obmV3IFRva2VuLlN0cmluZ1R5cGUoNCwgJ2FzY2lpJykpO1xuXHRcdFx0c3dpdGNoICh0eXBlKSB7XG5cdFx0XHRcdGNhc2UgJ2pwMiAnOlxuXHRcdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0XHRleHQ6ICdqcDInLFxuXHRcdFx0XHRcdFx0bWltZTogJ2ltYWdlL2pwMicsXG5cdFx0XHRcdFx0fTtcblx0XHRcdFx0Y2FzZSAnanB4ICc6XG5cdFx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRcdGV4dDogJ2pweCcsXG5cdFx0XHRcdFx0XHRtaW1lOiAnaW1hZ2UvanB4Jyxcblx0XHRcdFx0XHR9O1xuXHRcdFx0XHRjYXNlICdqcG0gJzpcblx0XHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdFx0ZXh0OiAnanBtJyxcblx0XHRcdFx0XHRcdG1pbWU6ICdpbWFnZS9qcG0nLFxuXHRcdFx0XHRcdH07XG5cdFx0XHRcdGNhc2UgJ21qcDInOlxuXHRcdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0XHRleHQ6ICdtajInLFxuXHRcdFx0XHRcdFx0bWltZTogJ2ltYWdlL21qMicsXG5cdFx0XHRcdFx0fTtcblx0XHRcdFx0ZGVmYXVsdDpcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKFxuXHRcdFx0dGhpcy5jaGVjayhbMHhGRiwgMHgwQV0pXG5cdFx0XHR8fCB0aGlzLmNoZWNrKFsweDAwLCAweDAwLCAweDAwLCAweDBDLCAweDRBLCAweDU4LCAweDRDLCAweDIwLCAweDBELCAweDBBLCAweDg3LCAweDBBXSlcblx0XHQpIHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGV4dDogJ2p4bCcsXG5cdFx0XHRcdG1pbWU6ICdpbWFnZS9qeGwnLFxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5jaGVjayhbMHhGRSwgMHhGRl0pKSB7IC8vIFVURi0xNi1CT00tQkVcblx0XHRcdGlmICh0aGlzLmNoZWNrU3RyaW5nKCc8P3htbCAnLCB7b2Zmc2V0OiAyLCBlbmNvZGluZzogJ3V0Zi0xNmJlJ30pKSB7XG5cdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0ZXh0OiAneG1sJyxcblx0XHRcdFx0XHRtaW1lOiAnYXBwbGljYXRpb24veG1sJyxcblx0XHRcdFx0fTtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDsgLy8gU29tZSB1bmtub3duIHRleHQgYmFzZWQgZm9ybWF0XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuY2hlY2soWzB4RDAsIDB4Q0YsIDB4MTEsIDB4RTAsIDB4QTEsIDB4QjEsIDB4MUEsIDB4RTFdKSkge1xuXHRcdFx0Ly8gRGV0ZWN0ZWQgTWljcm9zb2Z0IENvbXBvdW5kIEZpbGUgQmluYXJ5IEZpbGUgKE1TLUNGQikgRm9ybWF0LlxuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0ZXh0OiAnY2ZiJyxcblx0XHRcdFx0bWltZTogJ2FwcGxpY2F0aW9uL3gtY2ZiJyxcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0Ly8gSW5jcmVhc2Ugc2FtcGxlIHNpemUgZnJvbSAzMiB0byAyNTYuXG5cdFx0YXdhaXQgdG9rZW5pemVyLnBlZWtCdWZmZXIodGhpcy5idWZmZXIsIHtsZW5ndGg6IE1hdGgubWluKDI1NiwgdG9rZW5pemVyLmZpbGVJbmZvLnNpemUpLCBtYXlCZUxlc3M6IHRydWV9KTtcblxuXHRcdGlmICh0aGlzLmNoZWNrKFsweDYxLCAweDYzLCAweDczLCAweDcwXSwge29mZnNldDogMzZ9KSkge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0ZXh0OiAnaWNjJyxcblx0XHRcdFx0bWltZTogJ2FwcGxpY2F0aW9uL3ZuZC5pY2Nwcm9maWxlJyxcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0Ly8gQUNFOiByZXF1aXJlcyAxNCBieXRlcyBpbiB0aGUgYnVmZmVyXG5cdFx0aWYgKHRoaXMuY2hlY2tTdHJpbmcoJyoqQUNFJywge29mZnNldDogN30pICYmIHRoaXMuY2hlY2tTdHJpbmcoJyoqJywge29mZnNldDogMTJ9KSkge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0ZXh0OiAnYWNlJyxcblx0XHRcdFx0bWltZTogJ2FwcGxpY2F0aW9uL3gtYWNlLWNvbXByZXNzZWQnLFxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHQvLyAtLSAxNS1ieXRlIHNpZ25hdHVyZXMgLS1cblxuXHRcdGlmICh0aGlzLmNoZWNrU3RyaW5nKCdCRUdJTjonKSkge1xuXHRcdFx0aWYgKHRoaXMuY2hlY2tTdHJpbmcoJ1ZDQVJEJywge29mZnNldDogNn0pKSB7XG5cdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0ZXh0OiAndmNmJyxcblx0XHRcdFx0XHRtaW1lOiAndGV4dC92Y2FyZCcsXG5cdFx0XHRcdH07XG5cdFx0XHR9XG5cblx0XHRcdGlmICh0aGlzLmNoZWNrU3RyaW5nKCdWQ0FMRU5EQVInLCB7b2Zmc2V0OiA2fSkpIHtcblx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRleHQ6ICdpY3MnLFxuXHRcdFx0XHRcdG1pbWU6ICd0ZXh0L2NhbGVuZGFyJyxcblx0XHRcdFx0fTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBgcmFmYCBpcyBoZXJlIGp1c3QgdG8ga2VlcCBhbGwgdGhlIHJhdyBpbWFnZSBkZXRlY3RvcnMgdG9nZXRoZXIuXG5cdFx0aWYgKHRoaXMuY2hlY2tTdHJpbmcoJ0ZVSklGSUxNQ0NELVJBVycpKSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRleHQ6ICdyYWYnLFxuXHRcdFx0XHRtaW1lOiAnaW1hZ2UveC1mdWppZmlsbS1yYWYnLFxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5jaGVja1N0cmluZygnRXh0ZW5kZWQgTW9kdWxlOicpKSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRleHQ6ICd4bScsXG5cdFx0XHRcdG1pbWU6ICdhdWRpby94LXhtJyxcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuY2hlY2tTdHJpbmcoJ0NyZWF0aXZlIFZvaWNlIEZpbGUnKSkge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0ZXh0OiAndm9jJyxcblx0XHRcdFx0bWltZTogJ2F1ZGlvL3gtdm9jJyxcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuY2hlY2soWzB4MDQsIDB4MDAsIDB4MDAsIDB4MDBdKSAmJiB0aGlzLmJ1ZmZlci5sZW5ndGggPj0gMTYpIHsgLy8gUm91Z2ggJiBxdWljayBjaGVjayBQaWNrbGUvQVNBUlxuXHRcdFx0Y29uc3QganNvblNpemUgPSBuZXcgRGF0YVZpZXcodGhpcy5idWZmZXIuYnVmZmVyKS5nZXRVaW50MzIoMTIsIHRydWUpO1xuXG5cdFx0XHRpZiAoanNvblNpemUgPiAxMiAmJiB0aGlzLmJ1ZmZlci5sZW5ndGggPj0ganNvblNpemUgKyAxNikge1xuXHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdGNvbnN0IGhlYWRlciA9IG5ldyBUZXh0RGVjb2RlcigpLmRlY29kZSh0aGlzLmJ1ZmZlci5zdWJhcnJheSgxNiwganNvblNpemUgKyAxNikpO1xuXHRcdFx0XHRcdGNvbnN0IGpzb24gPSBKU09OLnBhcnNlKGhlYWRlcik7XG5cdFx0XHRcdFx0Ly8gQ2hlY2sgaWYgUGlja2xlIGlzIEFTQVJcblx0XHRcdFx0XHRpZiAoanNvbi5maWxlcykgeyAvLyBGaW5hbCBjaGVjaywgYXNzdXJpbmcgUGlja2xlL0FTQVIgZm9ybWF0XG5cdFx0XHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdFx0XHRleHQ6ICdhc2FyJyxcblx0XHRcdFx0XHRcdFx0bWltZTogJ2FwcGxpY2F0aW9uL3gtYXNhcicsXG5cdFx0XHRcdFx0XHR9O1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSBjYXRjaCB7fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmICh0aGlzLmNoZWNrKFsweDA2LCAweDBFLCAweDJCLCAweDM0LCAweDAyLCAweDA1LCAweDAxLCAweDAxLCAweDBELCAweDAxLCAweDAyLCAweDAxLCAweDAxLCAweDAyXSkpIHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGV4dDogJ214ZicsXG5cdFx0XHRcdG1pbWU6ICdhcHBsaWNhdGlvbi9teGYnLFxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5jaGVja1N0cmluZygnU0NSTScsIHtvZmZzZXQ6IDQ0fSkpIHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGV4dDogJ3MzbScsXG5cdFx0XHRcdG1pbWU6ICdhdWRpby94LXMzbScsXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdC8vIFJhdyBNUEVHLTIgdHJhbnNwb3J0IHN0cmVhbSAoMTg4LWJ5dGUgcGFja2V0cylcblx0XHRpZiAodGhpcy5jaGVjayhbMHg0N10pICYmIHRoaXMuY2hlY2soWzB4NDddLCB7b2Zmc2V0OiAxODh9KSkge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0ZXh0OiAnbXRzJyxcblx0XHRcdFx0bWltZTogJ3ZpZGVvL21wMnQnLFxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHQvLyBCbHUtcmF5IERpc2MgQXVkaW8tVmlkZW8gKEJEQVYpIE1QRUctMiB0cmFuc3BvcnQgc3RyZWFtIGhhcyA0LWJ5dGUgVFBfZXh0cmFfaGVhZGVyIGJlZm9yZSBlYWNoIDE4OC1ieXRlIHBhY2tldFxuXHRcdGlmICh0aGlzLmNoZWNrKFsweDQ3XSwge29mZnNldDogNH0pICYmIHRoaXMuY2hlY2soWzB4NDddLCB7b2Zmc2V0OiAxOTZ9KSkge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0ZXh0OiAnbXRzJyxcblx0XHRcdFx0bWltZTogJ3ZpZGVvL21wMnQnLFxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5jaGVjayhbMHg0MiwgMHg0RiwgMHg0RiwgMHg0QiwgMHg0RCwgMHg0RiwgMHg0MiwgMHg0OV0sIHtvZmZzZXQ6IDYwfSkpIHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGV4dDogJ21vYmknLFxuXHRcdFx0XHRtaW1lOiAnYXBwbGljYXRpb24veC1tb2JpcG9ja2V0LWVib29rJyxcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuY2hlY2soWzB4NDQsIDB4NDksIDB4NDMsIDB4NERdLCB7b2Zmc2V0OiAxMjh9KSkge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0ZXh0OiAnZGNtJyxcblx0XHRcdFx0bWltZTogJ2FwcGxpY2F0aW9uL2RpY29tJyxcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuY2hlY2soWzB4NEMsIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDEsIDB4MTQsIDB4MDIsIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIDB4QzAsIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIDB4NDZdKSkge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0ZXh0OiAnbG5rJyxcblx0XHRcdFx0bWltZTogJ2FwcGxpY2F0aW9uL3gubXMuc2hvcnRjdXQnLCAvLyBJbnZlbnRlZCBieSB1c1xuXHRcdFx0fTtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5jaGVjayhbMHg2MiwgMHg2RiwgMHg2RiwgMHg2QiwgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgMHg2RCwgMHg2MSwgMHg3MiwgMHg2QiwgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMF0pKSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRleHQ6ICdhbGlhcycsXG5cdFx0XHRcdG1pbWU6ICdhcHBsaWNhdGlvbi94LmFwcGxlLmFsaWFzJywgLy8gSW52ZW50ZWQgYnkgdXNcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuY2hlY2tTdHJpbmcoJ0theWRhcmEgRkJYIEJpbmFyeSAgXFx1MDAwMCcpKSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRleHQ6ICdmYngnLFxuXHRcdFx0XHRtaW1lOiAnYXBwbGljYXRpb24veC5hdXRvZGVzay5mYngnLCAvLyBJbnZlbnRlZCBieSB1c1xuXHRcdFx0fTtcblx0XHR9XG5cblx0XHRpZiAoXG5cdFx0XHR0aGlzLmNoZWNrKFsweDRDLCAweDUwXSwge29mZnNldDogMzR9KVxuXHRcdFx0JiYgKFxuXHRcdFx0XHR0aGlzLmNoZWNrKFsweDAwLCAweDAwLCAweDAxXSwge29mZnNldDogOH0pXG5cdFx0XHRcdHx8IHRoaXMuY2hlY2soWzB4MDEsIDB4MDAsIDB4MDJdLCB7b2Zmc2V0OiA4fSlcblx0XHRcdFx0fHwgdGhpcy5jaGVjayhbMHgwMiwgMHgwMCwgMHgwMl0sIHtvZmZzZXQ6IDh9KVxuXHRcdFx0KVxuXHRcdCkge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0ZXh0OiAnZW90Jyxcblx0XHRcdFx0bWltZTogJ2FwcGxpY2F0aW9uL3ZuZC5tcy1mb250b2JqZWN0Jyxcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuY2hlY2soWzB4MDYsIDB4MDYsIDB4RUQsIDB4RjUsIDB4RDgsIDB4MUQsIDB4NDYsIDB4RTUsIDB4QkQsIDB4MzEsIDB4RUYsIDB4RTcsIDB4RkUsIDB4NzQsIDB4QjcsIDB4MURdKSkge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0ZXh0OiAnaW5kZCcsXG5cdFx0XHRcdG1pbWU6ICdhcHBsaWNhdGlvbi94LWluZGVzaWduJyxcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0Ly8gSW5jcmVhc2Ugc2FtcGxlIHNpemUgZnJvbSAyNTYgdG8gNTEyXG5cdFx0YXdhaXQgdG9rZW5pemVyLnBlZWtCdWZmZXIodGhpcy5idWZmZXIsIHtsZW5ndGg6IE1hdGgubWluKDUxMiwgdG9rZW5pemVyLmZpbGVJbmZvLnNpemUpLCBtYXlCZUxlc3M6IHRydWV9KTtcblxuXHRcdC8vIFJlcXVpcmVzIGEgYnVmZmVyIHNpemUgb2YgNTEyIGJ5dGVzXG5cdFx0aWYgKCh0aGlzLmNoZWNrU3RyaW5nKCd1c3RhcicsIHtvZmZzZXQ6IDI1N30pICYmICh0aGlzLmNoZWNrU3RyaW5nKCdcXDAnLCB7b2Zmc2V0OiAyNjJ9KSB8fCB0aGlzLmNoZWNrU3RyaW5nKCcgJywge29mZnNldDogMjYyfSkpKVxuXHRcdFx0fHwgKHRoaXMuY2hlY2soWzAsIDAsIDAsIDAsIDAsIDBdLCB7b2Zmc2V0OiAyNTd9KSAmJiB0YXJIZWFkZXJDaGVja3N1bU1hdGNoZXModGhpcy5idWZmZXIpKSkge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0ZXh0OiAndGFyJyxcblx0XHRcdFx0bWltZTogJ2FwcGxpY2F0aW9uL3gtdGFyJyxcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuY2hlY2soWzB4RkYsIDB4RkVdKSkgeyAvLyBVVEYtMTYtQk9NLUxFXG5cdFx0XHRjb25zdCBlbmNvZGluZyA9ICd1dGYtMTZsZSc7XG5cdFx0XHRpZiAodGhpcy5jaGVja1N0cmluZygnPD94bWwgJywge29mZnNldDogMiwgZW5jb2Rpbmd9KSkge1xuXHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdGV4dDogJ3htbCcsXG5cdFx0XHRcdFx0bWltZTogJ2FwcGxpY2F0aW9uL3htbCcsXG5cdFx0XHRcdH07XG5cdFx0XHR9XG5cblx0XHRcdGlmICh0aGlzLmNoZWNrKFsweEZGLCAweDBFXSwge29mZnNldDogMn0pICYmIHRoaXMuY2hlY2tTdHJpbmcoJ1NrZXRjaFVwIE1vZGVsJywge29mZnNldDogNCwgZW5jb2Rpbmd9KSkge1xuXHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdGV4dDogJ3NrcCcsXG5cdFx0XHRcdFx0bWltZTogJ2FwcGxpY2F0aW9uL3ZuZC5za2V0Y2h1cC5za3AnLFxuXHRcdFx0XHR9O1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAodGhpcy5jaGVja1N0cmluZygnV2luZG93cyBSZWdpc3RyeSBFZGl0b3IgVmVyc2lvbiA1LjAwXFxyXFxuJywge29mZnNldDogMiwgZW5jb2Rpbmd9KSkge1xuXHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdGV4dDogJ3JlZycsXG5cdFx0XHRcdFx0bWltZTogJ2FwcGxpY2F0aW9uL3gtbXMtcmVnZWRpdCcsXG5cdFx0XHRcdH07XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiB1bmRlZmluZWQ7IC8vIFNvbWUgdGV4dCBiYXNlZCBmb3JtYXRcblx0XHR9XG5cblx0XHRpZiAodGhpcy5jaGVja1N0cmluZygnLS0tLS1CRUdJTiBQR1AgTUVTU0FHRS0tLS0tJykpIHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGV4dDogJ3BncCcsXG5cdFx0XHRcdG1pbWU6ICdhcHBsaWNhdGlvbi9wZ3AtZW5jcnlwdGVkJyxcblx0XHRcdH07XG5cdFx0fVxuXHR9O1xuXHQvLyBEZXRlY3Rpb25zIHdpdGggbGltaXRlZCBzdXBwb3J0aW5nIGRhdGEsIHJlc3VsdGluZyBpbiBhIGhpZ2hlciBsaWtlbGlob29kIG9mIGZhbHNlIHBvc2l0aXZlc1xuXHRkZXRlY3RJbXByZWNpc2UgPSBhc3luYyB0b2tlbml6ZXIgPT4ge1xuXHRcdHRoaXMuYnVmZmVyID0gbmV3IFVpbnQ4QXJyYXkocmVhc29uYWJsZURldGVjdGlvblNpemVJbkJ5dGVzKTtcblxuXHRcdC8vIFJlYWQgaW5pdGlhbCBzYW1wbGUgc2l6ZSBvZiA4IGJ5dGVzXG5cdFx0YXdhaXQgdG9rZW5pemVyLnBlZWtCdWZmZXIodGhpcy5idWZmZXIsIHtsZW5ndGg6IE1hdGgubWluKDgsIHRva2VuaXplci5maWxlSW5mby5zaXplKSwgbWF5QmVMZXNzOiB0cnVlfSk7XG5cblx0XHRpZiAoXG5cdFx0XHR0aGlzLmNoZWNrKFsweDAsIDB4MCwgMHgxLCAweEJBXSlcblx0XHRcdHx8IHRoaXMuY2hlY2soWzB4MCwgMHgwLCAweDEsIDB4QjNdKVxuXHRcdCkge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0ZXh0OiAnbXBnJyxcblx0XHRcdFx0bWltZTogJ3ZpZGVvL21wZWcnLFxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5jaGVjayhbMHgwMCwgMHgwMSwgMHgwMCwgMHgwMCwgMHgwMF0pKSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRleHQ6ICd0dGYnLFxuXHRcdFx0XHRtaW1lOiAnZm9udC90dGYnLFxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5jaGVjayhbMHgwMCwgMHgwMCwgMHgwMSwgMHgwMF0pKSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRleHQ6ICdpY28nLFxuXHRcdFx0XHRtaW1lOiAnaW1hZ2UveC1pY29uJyxcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuY2hlY2soWzB4MDAsIDB4MDAsIDB4MDIsIDB4MDBdKSkge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0ZXh0OiAnY3VyJyxcblx0XHRcdFx0bWltZTogJ2ltYWdlL3gtaWNvbicsXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdC8vIEFkanVzdCBidWZmZXIgdG8gYG1wZWdPZmZzZXRUb2xlcmFuY2VgXG5cdFx0YXdhaXQgdG9rZW5pemVyLnBlZWtCdWZmZXIodGhpcy5idWZmZXIsIHtsZW5ndGg6IE1hdGgubWluKDIgKyB0aGlzLm9wdGlvbnMubXBlZ09mZnNldFRvbGVyYW5jZSwgdG9rZW5pemVyLmZpbGVJbmZvLnNpemUpLCBtYXlCZUxlc3M6IHRydWV9KTtcblxuXHRcdC8vIENoZWNrIE1QRUcgMSBvciAyIExheWVyIDMgaGVhZGVyLCBvciAnbGF5ZXIgMCcgZm9yIEFEVFMgKE1QRUcgc3luYy13b3JkIDB4RkZFKVxuXHRcdGlmICh0aGlzLmJ1ZmZlci5sZW5ndGggPj0gKDIgKyB0aGlzLm9wdGlvbnMubXBlZ09mZnNldFRvbGVyYW5jZSkpIHtcblx0XHRcdGZvciAobGV0IGRlcHRoID0gMDsgZGVwdGggPD0gdGhpcy5vcHRpb25zLm1wZWdPZmZzZXRUb2xlcmFuY2U7ICsrZGVwdGgpIHtcblx0XHRcdFx0Y29uc3QgdHlwZSA9IHRoaXMuc2Nhbk1wZWcoZGVwdGgpO1xuXHRcdFx0XHRpZiAodHlwZSkge1xuXHRcdFx0XHRcdHJldHVybiB0eXBlO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHR9O1xuXG5cdGFzeW5jIHJlYWRUaWZmVGFnKGJpZ0VuZGlhbikge1xuXHRcdGNvbnN0IHRhZ0lkID0gYXdhaXQgdGhpcy50b2tlbml6ZXIucmVhZFRva2VuKGJpZ0VuZGlhbiA/IFRva2VuLlVJTlQxNl9CRSA6IFRva2VuLlVJTlQxNl9MRSk7XG5cdFx0dGhpcy50b2tlbml6ZXIuaWdub3JlKDEwKTtcblx0XHRzd2l0Y2ggKHRhZ0lkKSB7XG5cdFx0XHRjYXNlIDUwXzM0MTpcblx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRleHQ6ICdhcncnLFxuXHRcdFx0XHRcdG1pbWU6ICdpbWFnZS94LXNvbnktYXJ3Jyxcblx0XHRcdFx0fTtcblx0XHRcdGNhc2UgNTBfNzA2OlxuXHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdGV4dDogJ2RuZycsXG5cdFx0XHRcdFx0bWltZTogJ2ltYWdlL3gtYWRvYmUtZG5nJyxcblx0XHRcdFx0fTtcblx0XHRcdGRlZmF1bHQ6XG5cdFx0fVxuXHR9XG5cblx0YXN5bmMgcmVhZFRpZmZJRkQoYmlnRW5kaWFuKSB7XG5cdFx0Y29uc3QgbnVtYmVyT2ZUYWdzID0gYXdhaXQgdGhpcy50b2tlbml6ZXIucmVhZFRva2VuKGJpZ0VuZGlhbiA/IFRva2VuLlVJTlQxNl9CRSA6IFRva2VuLlVJTlQxNl9MRSk7XG5cdFx0Zm9yIChsZXQgbiA9IDA7IG4gPCBudW1iZXJPZlRhZ3M7ICsrbikge1xuXHRcdFx0Y29uc3QgZmlsZVR5cGUgPSBhd2FpdCB0aGlzLnJlYWRUaWZmVGFnKGJpZ0VuZGlhbik7XG5cdFx0XHRpZiAoZmlsZVR5cGUpIHtcblx0XHRcdFx0cmV0dXJuIGZpbGVUeXBlO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdGFzeW5jIHJlYWRUaWZmSGVhZGVyKGJpZ0VuZGlhbikge1xuXHRcdGNvbnN0IHZlcnNpb24gPSAoYmlnRW5kaWFuID8gVG9rZW4uVUlOVDE2X0JFIDogVG9rZW4uVUlOVDE2X0xFKS5nZXQodGhpcy5idWZmZXIsIDIpO1xuXHRcdGNvbnN0IGlmZE9mZnNldCA9IChiaWdFbmRpYW4gPyBUb2tlbi5VSU5UMzJfQkUgOiBUb2tlbi5VSU5UMzJfTEUpLmdldCh0aGlzLmJ1ZmZlciwgNCk7XG5cblx0XHRpZiAodmVyc2lvbiA9PT0gNDIpIHtcblx0XHRcdC8vIFRJRkYgZmlsZSBoZWFkZXJcblx0XHRcdGlmIChpZmRPZmZzZXQgPj0gNikge1xuXHRcdFx0XHRpZiAodGhpcy5jaGVja1N0cmluZygnQ1InLCB7b2Zmc2V0OiA4fSkpIHtcblx0XHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdFx0ZXh0OiAnY3IyJyxcblx0XHRcdFx0XHRcdG1pbWU6ICdpbWFnZS94LWNhbm9uLWNyMicsXG5cdFx0XHRcdFx0fTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmIChpZmRPZmZzZXQgPj0gOCkge1xuXHRcdFx0XHRcdGNvbnN0IHNvbWVJZDEgPSAoYmlnRW5kaWFuID8gVG9rZW4uVUlOVDE2X0JFIDogVG9rZW4uVUlOVDE2X0xFKS5nZXQodGhpcy5idWZmZXIsIDgpO1xuXHRcdFx0XHRcdGNvbnN0IHNvbWVJZDIgPSAoYmlnRW5kaWFuID8gVG9rZW4uVUlOVDE2X0JFIDogVG9rZW4uVUlOVDE2X0xFKS5nZXQodGhpcy5idWZmZXIsIDEwKTtcblxuXHRcdFx0XHRcdGlmIChcblx0XHRcdFx0XHRcdChzb21lSWQxID09PSAweDFDICYmIHNvbWVJZDIgPT09IDB4RkUpXG5cdFx0XHRcdFx0XHR8fCAoc29tZUlkMSA9PT0gMHgxRiAmJiBzb21lSWQyID09PSAweDBCKSkge1xuXHRcdFx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRcdFx0ZXh0OiAnbmVmJyxcblx0XHRcdFx0XHRcdFx0bWltZTogJ2ltYWdlL3gtbmlrb24tbmVmJyxcblx0XHRcdFx0XHRcdH07XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdGF3YWl0IHRoaXMudG9rZW5pemVyLmlnbm9yZShpZmRPZmZzZXQpO1xuXHRcdFx0Y29uc3QgZmlsZVR5cGUgPSBhd2FpdCB0aGlzLnJlYWRUaWZmSUZEKGJpZ0VuZGlhbik7XG5cdFx0XHRyZXR1cm4gZmlsZVR5cGUgPz8ge1xuXHRcdFx0XHRleHQ6ICd0aWYnLFxuXHRcdFx0XHRtaW1lOiAnaW1hZ2UvdGlmZicsXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdGlmICh2ZXJzaW9uID09PSA0Mykge1x0Ly8gQmlnIFRJRkYgZmlsZSBoZWFkZXJcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGV4dDogJ3RpZicsXG5cdFx0XHRcdG1pbWU6ICdpbWFnZS90aWZmJyxcblx0XHRcdH07XG5cdFx0fVxuXHR9XG5cblx0LyoqXG5cdFNjYW4gY2hlY2sgTVBFRyAxIG9yIDIgTGF5ZXIgMyBoZWFkZXIsIG9yICdsYXllciAwJyBmb3IgQURUUyAoTVBFRyBzeW5jLXdvcmQgMHhGRkUpLlxuXG5cdEBwYXJhbSBvZmZzZXQgLSBPZmZzZXQgdG8gc2NhbiBmb3Igc3luYy1wcmVhbWJsZS5cblx0QHJldHVybnMge3tleHQ6IHN0cmluZywgbWltZTogc3RyaW5nfX1cblx0Ki9cblx0c2Nhbk1wZWcob2Zmc2V0KSB7XG5cdFx0aWYgKHRoaXMuY2hlY2soWzB4RkYsIDB4RTBdLCB7b2Zmc2V0LCBtYXNrOiBbMHhGRiwgMHhFMF19KSkge1xuXHRcdFx0aWYgKHRoaXMuY2hlY2soWzB4MTBdLCB7b2Zmc2V0OiBvZmZzZXQgKyAxLCBtYXNrOiBbMHgxNl19KSkge1xuXHRcdFx0XHQvLyBDaGVjayBmb3IgKEFEVFMpIE1QRUctMlxuXHRcdFx0XHRpZiAodGhpcy5jaGVjayhbMHgwOF0sIHtvZmZzZXQ6IG9mZnNldCArIDEsIG1hc2s6IFsweDA4XX0pKSB7XG5cdFx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRcdGV4dDogJ2FhYycsXG5cdFx0XHRcdFx0XHRtaW1lOiAnYXVkaW8vYWFjJyxcblx0XHRcdFx0XHR9O1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Ly8gTXVzdCBiZSAoQURUUykgTVBFRy00XG5cdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0ZXh0OiAnYWFjJyxcblx0XHRcdFx0XHRtaW1lOiAnYXVkaW8vYWFjJyxcblx0XHRcdFx0fTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gTVBFRyAxIG9yIDIgTGF5ZXIgMyBoZWFkZXJcblx0XHRcdC8vIENoZWNrIGZvciBNUEVHIGxheWVyIDNcblx0XHRcdGlmICh0aGlzLmNoZWNrKFsweDAyXSwge29mZnNldDogb2Zmc2V0ICsgMSwgbWFzazogWzB4MDZdfSkpIHtcblx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRleHQ6ICdtcDMnLFxuXHRcdFx0XHRcdG1pbWU6ICdhdWRpby9tcGVnJyxcblx0XHRcdFx0fTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gQ2hlY2sgZm9yIE1QRUcgbGF5ZXIgMlxuXHRcdFx0aWYgKHRoaXMuY2hlY2soWzB4MDRdLCB7b2Zmc2V0OiBvZmZzZXQgKyAxLCBtYXNrOiBbMHgwNl19KSkge1xuXHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdGV4dDogJ21wMicsXG5cdFx0XHRcdFx0bWltZTogJ2F1ZGlvL21wZWcnLFxuXHRcdFx0XHR9O1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBDaGVjayBmb3IgTVBFRyBsYXllciAxXG5cdFx0XHRpZiAodGhpcy5jaGVjayhbMHgwNl0sIHtvZmZzZXQ6IG9mZnNldCArIDEsIG1hc2s6IFsweDA2XX0pKSB7XG5cdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0ZXh0OiAnbXAxJyxcblx0XHRcdFx0XHRtaW1lOiAnYXVkaW8vbXBlZycsXG5cdFx0XHRcdH07XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG59XG5cbmV4cG9ydCBjb25zdCBzdXBwb3J0ZWRFeHRlbnNpb25zID0gbmV3IFNldChleHRlbnNpb25zKTtcbmV4cG9ydCBjb25zdCBzdXBwb3J0ZWRNaW1lVHlwZXMgPSBuZXcgU2V0KG1pbWVUeXBlcyk7XG4iCiAgXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7O0VBSUEsSUFBSSxJQUFJO0FBQUEsRUFDUixJQUFJLElBQUksSUFBSTtBQUFBLEVBQ1osSUFBSSxJQUFJLElBQUk7QUFBQSxFQUNaLElBQUksSUFBSSxJQUFJO0FBQUEsRUFDWixJQUFJLElBQUksSUFBSTtBQUFBLEVBQ1osSUFBSSxJQUFJLElBQUk7QUFBQSxFQWdCWixPQUFPLFVBQVUsUUFBUyxDQUFDLEtBQUssU0FBUztBQUFBLElBQ3ZDLFVBQVUsV0FBVyxDQUFDO0FBQUEsSUFDdEIsSUFBSSxPQUFPLE9BQU87QUFBQSxJQUNsQixJQUFJLFNBQVMsWUFBWSxJQUFJLFNBQVMsR0FBRztBQUFBLE1BQ3ZDLE9BQU8sTUFBTSxHQUFHO0FBQUEsSUFDbEIsRUFBTyxTQUFJLFNBQVMsWUFBWSxTQUFTLEdBQUcsR0FBRztBQUFBLE1BQzdDLE9BQU8sUUFBUSxPQUFPLFFBQVEsR0FBRyxJQUFJLFNBQVMsR0FBRztBQUFBLElBQ25EO0FBQUEsSUFDQSxNQUFNLElBQUksTUFDUiwwREFDRSxLQUFLLFVBQVUsR0FBRyxDQUN0QjtBQUFBO0FBQUEsRUFXRixTQUFTLEtBQUssQ0FBQyxLQUFLO0FBQUEsSUFDbEIsTUFBTSxPQUFPLEdBQUc7QUFBQSxJQUNoQixJQUFJLElBQUksU0FBUyxLQUFLO0FBQUEsTUFDcEI7QUFBQSxJQUNGO0FBQUEsSUFDQSxJQUFJLFFBQVEsbUlBQW1JLEtBQzdJLEdBQ0Y7QUFBQSxJQUNBLElBQUksQ0FBQyxPQUFPO0FBQUEsTUFDVjtBQUFBLElBQ0Y7QUFBQSxJQUNBLElBQUksSUFBSSxXQUFXLE1BQU0sRUFBRTtBQUFBLElBQzNCLElBQUksUUFBUSxN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TTtBQUFBLElBQ3hCLElBQUksU0FBUztBQUFBLElBRWIsT0FBTyxNQUFNO0FBQUEsTUFDWixJQUFJLENBQUMsUUFBUTtBQUFBLFFBQ1osU0FBUztBQUFBLFFBQ1QsUUFBUSxLQUFLLHVJQUF1STtBQUFBLE1BQ3JKO0FBQUE7QUFBQSxLQUVDO0FBQUEsRUFNSyxpQkFBUztBQUFBLElBQ2hCO0FBQUEsSUFDQTtBQUFBLElBQ0E7QUFBQSxJQUNBO0FBQUEsSUFDQTtBQUFBLElBQ0E7QUFBQSxJQUNBO0FBQUEsSUFDQTtBQUFBLElBQ0E7QUFBQSxJQUNBO0FBQUEsSUFDQTtBQUFBLElBQ0E7QUFBQSxJQUNBO0FBQUEsSUFDQTtBQUFBLElBQ0E7QUFBQSxJQUNBO0FBQUEsSUFDQTtBQUFBLElBQ0E7QUFBQSxJQUNBO0FBQUEsSUFDQTtBQUFBLElBQ0E7QUFBQSxJQUNBO0FBQUEsSUFDQTtBQUFBLElBQ0E7QUFBQSxJQUNBO0FBQUEsSUFDQTtBQUFBLElBQ0E7QUFBQSxJQUNBO0FBQUEsSUFDQTtBQUFBLElBQ0E7QUFBQSxJQUNBO0FBQUEsSUFDQTtBQUFBLElBQ0E7QUFBQSxJQUNBO0FBQUEsSUFDQTtBQUFBLElBQ0E7QUFBQSxJQUNBO0FBQUEsSUFDQTtBQUFBLElBQ0E7QUFBQSxJQUNBO0FBQUEsSUFDQTtBQUFBLElBQ0E7QUFBQSxJQUNBO0FBQUEsSUFDQTtBQUFBLElBQ0E7QUFBQSxJQUNBO0FBQUEsSUFDQTtBQUFBLElBQ0E7QUFBQSxJQUNBO0FBQUEsSUFDQTtBQUFBLElBQ0E7QUFBQSxJQUNBO0FBQUEsSUFDQTtBQUFBLElBQ0E7QUFBQSxJQUNBO0FBQUEsSUFDQTtBQUFBLElBQ0E7QUFBQSxJQUNBO0FBQUEsSUFDQTtBQUFBLElBQ0E7QUFBQSxJQUNBO0FBQUEsSUFDQTtBQUFBLElBQ0E7QUFBQSxJQUNBO0FBQUEsSUFDQTtBQUFBLElBQ0E7QUFBQSxJQUNBO0FBQUEsSUFDQTtBQUFBLElBQ0E7QUFBQSxJQUNBO0FBQUEsSUFDQTtBQUFBLElBQ0E7QUFBQSxJQUNBO0FBQUEsSUFDQTtBQUFBLElB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QTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQ0Q7QUFFTyxJQUFNLFlBQVk7QUFBQSxFQUN4QjtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFDRDs7O0FDcFZPLElBQU0saUNBQWlDO0FBRTlDLGVBQXNCLGtCQUFrQixDQUFDLFFBQVEsU0FBUztBQUFBLEVBQ3pELE9BQU8sSUFBSSxlQUFlLE9BQU8sRUFBRSxXQUFXLE1BQU07QUFBQTtBQUdyRCxlQUFzQixrQkFBa0IsQ0FBQyxPQUFPLFNBQVM7QUFBQSxFQUN4RCxPQUFPLElBQUksZUFBZSxPQUFPLEVBQUUsV0FBVyxLQUFLO0FBQUE7QUFHcEQsZUFBc0IsZ0JBQWdCLENBQUMsTUFBTSxTQUFTO0FBQUEsRUFDckQsT0FBTyxJQUFJLGVBQWUsT0FBTyxFQUFFLFNBQVMsSUFBSTtBQUFBO0FBR2pELFNBQVMsdUJBQXVCLENBQUMsVUFBVTtBQUFBLEVBQzFDLFdBQVcsU0FBUyxZQUFZO0FBQUEsRUFDaEMsUUFBUTtBQUFBLFNBQ0Y7QUFBQSxNQUNKLE9BQU87QUFBQSxRQUNOLEtBQUs7QUFBQSxRQUNMLE1BQU07QUFBQSxNQUNQO0FBQUEsU0FDSTtBQUFBLE1BQ0osT0FBTztBQUFBLFFBQ04sS0FBSztBQUFBLFFBQ0wsTUFBTTtBQUFBLE1BQ1A7QUFBQSxTQUNJO0FBQUEsTUFDSixPQUFPO0FBQUEsUUFDTixLQUFLO0FBQUEsUUFDTCxNQUFNO0FBQUEsTUFDUDtBQUFBLFNBQ0k7QUFBQSxNQUNKLE9BQU87QUFBQSxRQUNOLEtBQUs7QUFBQSxRQUNMLE1BQU07QUFBQSxNQUNQO0FBQUEsU0FDSTtBQUFBLE1BQ0osT0FBTztBQUFBLFFBQ04sS0FBSztBQUFBLFFBQ0wsTUFBTTtBQUFBLE1BQ1A7QUFBQSxTQUNJO0FBQUEsTUFDSixPQUFPO0FBQUEsUUFDTixLQUFLO0FBQUEsUUFDTCxNQUFNO0FBQUEsTUFDUDtBQUFBLFNBQ0k7QUFBQSxNQUNKLE9BQU87QUFBQSxRQUNOLEtBQUs7QUFBQSxRQUNMLE1BQU07QUFBQSxNQUNQO0FBQUEsU0FDSTtBQUFBLE1BQ0osT0FBTztBQUFBLFFBQ04sS0FBSztBQUFBLFFBQ0wsTUFBTTtBQUFBLE1BQ1A7QUFBQSxTQUNJO0FBQUEsTUFDSixPQUFPO0FBQUEsUUFDTixLQUFLO0FBQUEsUUFDTCxNQUFNO0FBQUEsTUFDUDtBQUFBLFNBQ0k7QUFBQSxNQUNKLE9BQU87QUFBQSxRQUNOLEtBQUs7QUFBQSxRQUNMLE1BQU07QUFBQSxNQUNQO0FBQUEsU0FDSTtBQUFBLE1BQ0osT0FBTztBQUFBLFFBQ04sS0FBSztBQUFBLFFBQ0wsTUFBTTtBQUFBLE1BQ1A7QUFBQSxTQUNJO0FBQUEsTUFDSixPQUFPO0FBQUEsUUFDTixLQUFLO0FBQUEsUUFDTCxNQUFNO0FBQUEsTUFDUDtBQUFBLFNBQ0k7QUFBQSxNQUNKLE9BQU87QUFBQSxRQUNOLEtBQUs7QUFBQSxRQUNMLE1BQU07QUFBQSxNQUNQO0FBQUEsU0FDSTtBQUFBLE1BQ0osT0FBTztBQUFBLFFBQ04sS0FBSztBQUFBLFFBQ0wsTUFBTTtBQUFBLE1BQ1A7QUFBQSxTQUNJO0FBQUEsTUFDSixPQUFPO0FBQUEsUUFDTixLQUFLO0FBQUEsUUFDTCxNQUFNO0FBQUEsTUFDUDtBQUFBLFNBQ0k7QUFBQSxNQUNKLE9BQU87QUFBQSxRQUNOLEtBQUs7QUFBQSxRQUNMLE1BQU07QUFBQSxNQUNQO0FBQUEsU0FDSTtBQUFBLE1BQ0osT0FBTztBQUFBLFFBQ04sS0FBSztBQUFBLFFBQ0wsTUFBTTtBQUFBLE1BQ1A7QUFBQSxTQUNJO0FBQUEsTUFDSixPQUFPO0FBQUEsUUFDTixLQUFLO0FBQUEsUUFDTCxNQUFNO0FBQUEsTUFDUDtBQUFBLFNBQ0k7QUFBQSxNQUNKLE9BQU87QUFBQSxRQUNOLEtBQUs7QUFBQSxRQUNMLE1BQU07QUFBQSxNQUNQO0FBQUEsU0FDSTtBQUFBLE1BQ0osT0FBTztBQUFBLFFBQ04sS0FBSztBQUFBLFFBQ0wsTUFBTTtBQUFBLE1BQ1A7QUFBQSxTQUNJO0FBQUEsTUFDSixPQUFPO0FBQUEsUUFDTixLQUFLO0FBQUEsUUFDTCxNQUFNO0FBQUEsTUFDUDtBQUFBLFNBQ0k7QUFBQSxNQUNKLE9BQU87QUFBQSxRQUNOLEtBQUs7QUFBQSxRQUNMLE1BQU07QUFBQSxNQUNQO0FBQUEsU0FDSTtBQUFBLE1BQ0osT0FBTztBQUFBLFFBQ04sS0FBSztBQUFBLFFBQ0wsTUFBTTtBQUFBLE1BQ1A7QUFBQSxTQUNJO0FBQUEsTUFDSixPQUFPO0FBQUEsUUFDTixLQUFLO0FBQUEsUUFDTCxNQUFNO0FBQUEsTUFDUDtBQUFBLFNBQ0k7QUFBQSxNQUNKLE9BQU87QUFBQSxRQUNOLEtBQUs7QUFBQSxRQUNMLE1BQU07QUFBQSxNQUNQO0FBQUE7QUFBQTtBQUFBO0FBS0gsU0FBUyxNQUFNLENBQUMsUUFBUSxTQUFTLFNBQVM7QUFBQSxFQUN6QyxVQUFVO0FBQUEsSUFDVCxRQUFRO0FBQUEsT0FDTDtBQUFBLEVBQ0o7QUFBQSxFQUVBLFlBQVksT0FBTyxX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QUssTUFBTSxDQUFDLEtBQU0sS0FBTSxLQUFNLEdBQUksQ0FBQyxHQUFHO0FBQUEsTUFDekMsT0FBTztBQUFBLFFBQ04sS0FBSztBQUFBLFFBQ0wsTUFBTTtBQUFBLE1BQ1A7QUFBQSxJQUNEO0FBQUEsSUFFQSxJQUFJLEtBQUssTUFBTSxDQUFDLEtBQU0sS0FBTSxLQUFNLEdBQUksQ0FBQyxHQUFHO0FBQUEsTUFDekMsT0FBTztBQUFBLFFBQ04sS0FBSztBQUFBLFFBQ0wsTUFBTTtBQUFBLE1BQ1A7QUFBQSxJQUNEO0FBQUEsSUFFQSxJQUFJLEtBQUssTUFBTSxDQUFDLElBQU0sS0FBTSxJQUFNLEdBQUksQ0FBQyxHQUFHO0FBQUEsTUFDekMsT0FBTztBQUFBLFFBQ04sS0FBSztBQUFBLFFBQ0wsTUFBTTtBQUFBLE1BQ1A7QUFBQSxJQUNEO0FBQUEsSUFFQSxJQUFJLEtBQUssTUFBTSxDQUFDLEtBQU0sSUFBTSxJQUFNLEVBQUksQ0FBQyxHQUFHO0FBQUEsTUFDekMsT0FBTztBQUFBLFFBQ04sS0FBSztBQUFBLFFBQ0wsTUFBTTtBQUFBLE1BQ1A7QUFBQSxJQUNEO0FBQUEsSUFFQSxJQUFJLEtBQUssTUFBTSxDQUFDLElBQU0sSUFBTSxJQUFNLEVBQUksQ0FBQyxHQUFHO0FBQUEsTUFDekMsT0FBTztBQUFBLFFBQ04sS0FBSztBQUFBLFFBQ0wsTUFBTTtBQUFBLE1BQ1A7QUFBQSxJQUNEO0FBQUEsSUFFQSxJQUFJLEtBQUssWUFBWSxNQUFNLEtBQUssS0FBSyxZQUFZLE1BQU0sR0FBRztBQUFBLE1BQ3pELE9BQU87QUFBQSxRQUNOLEtBQUs7QUFBQSxRQUNMLE1BQU07QUFBQSxNQUNQO0FBQUEsSUFDRDtBQUFBLElBRUEsSUFBSSxLQUFLLFlBQVksTUFBTSxHQUFHO0FBQUEsTUFDN0IsT0FBTztBQUFBLFFBQ04sS0FBSztBQUFBLFFBQ0wsTUFBTTtBQUFBLE1BQ1A7QUFBQSxJQUNEO0FBQUEsSUFFQSxJQUFJLEtBQUssTUFBTSxDQUFDLEtBQU0sS0FBTSxLQUFNLEdBQUksQ0FBQyxHQUFHO0FBQUEs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QUVBLElBQUksWUFBWSxJQUFJO0FBQUEsTUFDbkIsT0FBTztBQUFBLFFBQ04sS0FBSztBQUFBLFFBQ0wsTUFBTTtBQUFBLE1BQ1A7QUFBQSxJQUNEO0FBQUE7QUFBQSxFQVNELFFBQVEsQ0FBQyxRQUFRO0FBQUEsSUFDaEIsSUFBSSxLQUFLLE1BQU0sQ0FBQyxLQUFNLEdBQUksR0FBRyxFQUFDLFFBQVEsTUFBTSxDQUFDLEtBQU0sR0FBSSxFQUFDLENBQUMsR0FBRztBQUFBLE1BQzNELElBQUksS0FBSyxNQUFNLENBQUMsRUFBSSxHQUFHLEVBQUMsUUFBUSxTQUFTLEdBQUcsTUFBTSxDQUFDLEVBQUksRUFBQyxDQUFDLEdBQUc7QUFBQSxRQUUzRCxJQUFJLEtBQUssTUFBTSxDQUFDLENBQUksR0FBRyxFQUFDLFFBQVEsU0FBUyxHQUFHLE1BQU0sQ0FBQyxDQUFJLEVBQUMsQ0FBQyxHQUFHO0FBQUEsVUFDM0QsT0FBTztBQUFBLFlBQ04sS0FBSztBQUFBLFlBQ0wsTUFBTTtBQUFBLFVBQ1A7QUFBQSxRQUNEO0FBQUEsUUFHQSxPQUFPO0FBQUEsVUFDTixLQUFLO0FBQUEsVUFDTCxNQUFNO0FBQUEsUUFDUDtBQUFBLE1BQ0Q7QUFBQSxNQUlBLElBQUksS0FBSyxNQUFNLENBQUMsQ0FBSSxHQUFHLEVBQUMsUUFBUSxTQUFTLEdBQUcsTUFBTSxDQUFDLENBQUksRUFBQyxDQUFDLEdBQUc7QUFBQSxRQUMzRCxPQUFPO0FBQUEsVUFDTixLQUFLO0FBQUEsVUFDTCxNQUFNO0FBQUEsUUFDUDtBQUFBLE1BQ0Q7QUFBQSxNQUdBLElBQUksS0FBSyxNQUFNLENBQUMsQ0FBSSxHQUFHLEVBQUMsUUFBUSxTQUFTLEdBQUcsTUFBTSxDQUFDLENBQUksRUFBQyxDQUFDLEdBQUc7QUFBQSxRQUMzRCxPQUFPO0FBQUEsVUFDTixLQUFLO0FBQUEsVUFDTCxNQUFNO0FBQUEsUUFDUDtBQUFBLE1BQ0Q7QUFBQSxNQUdBLElBQUksS0FBSyxNQUFNLENBQUMsQ0FBSSxHQUFHLEVBQUMsUUFBUSxTQUFTLEdBQUcsTUFBTSxDQUFDLENBQUksRUFBQyxDQUFDLEdBQUc7QUFBQSxRQUMzRCxPQUFPO0FBQUEsVUFDTixLQUFLO0FBQUEsVUFDTCxNQUFNO0FBQUEsUUFDUDtBQUFBLE1BQ0Q7QUFBQSxJQUNEO0FBQUE7QUFFRjtBQUVPLElBQU0sc0JBQXNCLElBQUksSUFBSSxVQUFVO0FBQzlDLElBQU0scUJBQXFCLElBQUksSUFBSSxTQUFTOyIsCiAgImRlYnVnSWQiOiAiNkJFQkJBMzkzQjkzODk0ODY0NzU2RTIxNjQ3NTZFMjEiLAogICJuYW1lcyI6IFtdCn0=

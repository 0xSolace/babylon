import {
  Hash,
  abytes,
  aexists,
  ahash,
  anumber,
  aoutput,
  bytesToHex,
  clean,
  concatBytes,
  createHasher,
  createView,
  hexToBytes,
  isBytes,
  randomBytes,
  rotr,
  toBytes,
  utf8ToBytes
} from "./client-a8gb9g34.js";
import"./client-4jeyk0v8.js";

// ../../../../node_modules/.bun/@noble+hashes@1.8.0/node_modules/@noble/hashes/esm/_md.js
function setBigUint64(view, byteOffset, value, isLE) {
  if (typeof view.setBigUint64 === "function")
    return view.setBigUint64(byteOffset, value, isLE);
  const _32n = BigInt(32);
  const _u32_max = BigInt(4294967295);
  const wh = Number(value >> _32n & _u32_max);
  const wl = Number(value & _u32_max);
  const h = isLE ? 4 : 0;
  const l = isLE ? 0 : 4;
  view.setUint32(byteOffset + h, wh, isLE);
  view.setUint32(byteOffset + l, wl, isLE);
}
function Chi(a, b, c) {
  return a & b ^ ~a & c;
}
function Maj(a, b, c) {
  return a & b ^ a & c ^ b & c;
}

class HashMD extends Hash {
  constructor(blockLen, outputLen, padOffset, isLE) {
    super();
    this.finished = false;
    this.length = 0;
    this.pos = 0;
    this.destroyed = false;
    this.blockLen = blockLen;
    this.outputLen = outputLen;
    this.padOffset = padOffset;
    this.isLE = isLE;
    this.buffer = new Uint8Array(blockLen);
    this.view = createView(this.buffer);
  }
  update(data) {
    aexists(this);
    data = toBytes(data);
    abytes(data);
    const { view, buffer, blockLen } = this;
    const len = data.length;
    for (let pos = 0;pos < len; ) {
      const take = Math.min(blockLen - this.pos, len - pos);
      if (take === blockLen) {
        const dataView = createView(data);
        for (;blockLen <= len - pos; pos += blockLen)
          this.process(dataView, pos);
        continue;
      }
      buffer.set(data.subarray(pos, pos + take), this.pos);
      this.pos += take;
      pos += take;
      if (this.pos === blockLen) {
        this.process(view, 0);
        this.pos = 0;
      }
    }
    this.length += data.length;
    this.roundClean();
    return this;
  }
  digestInto(out) {
    aexists(this);
    aoutput(out, this);
    this.finished = true;
    const { buffer, view, blockLen, isLE } = this;
    let { pos } = this;
    buffer[pos++] = 128;
    clean(this.buffer.subarray(pos));
    if (this.padOffset > blockLen - pos) {
      this.process(view, 0);
      pos = 0;
    }
    for (let i = pos;i < blockLen; i++)
      buffer[i] = 0;
    setBigUint64(view, blockLen - 8, BigInt(this.length * 8), isLE);
    this.process(view, 0);
    const oview = createView(out);
    const len = this.outputLen;
    if (len % 4)
      throw new Error("_sha2: outputLen should be aligned to 32bit");
    const outLen = len / 4;
    const state = this.get();
    if (outLen > state.length)
      throw new Error("_sha2: outputLen bigger than state");
    for (let i = 0;i < outLen; i++)
      oview.setUint32(4 * i, state[i], isLE);
  }
  digest() {
    const { buffer, outputLen } = this;
    this.digestInto(buffer);
    const res = buffer.slice(0, outputLen);
    this.destroy();
    return res;
  }
  _cloneInto(to) {
    to || (to = new this.constructor);
    to.set(...this.get());
    const { blockLen, buffer, length, finished, destroyed, pos } = this;
    to.destroyed = destroyed;
    to.finished = finished;
    to.length = length;
    to.pos = pos;
    if (length % blockLen)
      to.buffer.set(buffer);
    return to;
  }
  clone() {
    return this._cloneInto();
  }
}
var SHA256_IV = /* @__PURE__ */ Uint32Array.from([
  1779033703,
  3144134277,
  1013904242,
  2773480762,
  1359893119,
  2600822924,
  528734635,
  1541459225
]);

// ../../../../node_modules/.bun/@noble+hashes@1.8.0/node_modules/@noble/hashes/esm/sha2.js
var SHA256_K = /* @__PURE__ */ Uint32Array.from([
  1116352408,
  1899447441,
  3049323471,
  3921009573,
  961987163,
  1508970993,
  2453635748,
  2870763221,
  3624381080,
  310598401,
  607225278,
  1426881987,
  1925078388,
  2162078206,
  2614888103,
  3248222580,
  3835390401,
  4022224774,
  264347078,
  604807628,
  770255983,
  1249150122,
  1555081692,
  1996064986,
  2554220882,
  2821834349,
  2952996808,
  3210313671,
  3336571891,
  3584528711,
  113926993,
  338241895,
  666307205,
  773529912,
  1294757372,
  1396182291,
  1695183700,
  1986661051,
  2177026350,
  2456956037,
  2730485921,
  2820302411,
  3259730800,
  3345764771,
  3516065817,
  3600352804,
  4094571909,
  275423344,
  430227734,
  506948616,
  659060556,
  883997877,
  958139571,
  1322822218,
  1537002063,
  1747873779,
  1955562222,
  2024104815,
  2227730452,
  2361852424,
  2428436474,
  2756734187,
  3204031479,
  3329325298
]);
var SHA256_W = /* @__PURE__ */ new Uint32Array(64);

class SHA256 extends HashMD {
  constructor(outputLen = 32) {
    super(64, outputLen, 8, false);
    this.A = SHA256_IV[0] | 0;
    this.B = SHA256_IV[1] | 0;
    this.C = SHA256_IV[2] | 0;
    this.D = SHA256_IV[3] | 0;
    this.E = SHA256_IV[4] | 0;
    this.F = SHA256_IV[5] | 0;
    this.G = SHA256_IV[6] | 0;
    this.H = SHA256_IV[7] | 0;
  }
  get() {
    const { A, B, C, D, E, F, G, H } = this;
    return [A, B, C, D, E, F, G, H];
  }
  set(A, B, C, D, E, F, G, H) {
    this.A = A | 0;
    this.B = B | 0;
    this.C = C | 0;
    this.D = D | 0;
    this.E = E | 0;
    this.F = F | 0;
    this.G = G | 0;
    this.H = H | 0;
  }
  process(view, offset) {
    for (let i = 0;i < 16; i++, offset += 4)
      SHA256_W[i] = view.getUint32(offset, false);
    for (let i = 16;i < 64; i++) {
      const W15 = SHA256_W[i - 15];
      const W2 = SHA256_W[i - 2];
      const s0 = rotr(W15, 7) ^ rotr(W15, 18) ^ W15 >>> 3;
      const s1 = rotr(W2, 17) ^ rotr(W2, 19) ^ W2 >>> 10;
      SHA256_W[i] = s1 + SHA256_W[i - 7] + s0 + SHA256_W[i - 16] | 0;
    }
    let { A, B, C, D, E, F, G, H } = this;
    for (let i = 0;i < 64; i++) {
      const sigma1 = rotr(E, 6) ^ rotr(E, 11) ^ rotr(E, 25);
      const T1 = H + sigma1 + Chi(E, F, G) + SHA256_K[i] + SHA256_W[i] | 0;
      const sigma0 = rotr(A, 2) ^ rotr(A, 13) ^ rotr(A, 22);
      const T2 = sigma0 + Maj(A, B, C) | 0;
      H = G;
      G = F;
      F = E;
      E = D + T1 | 0;
      D = C;
      C = B;
      B = A;
      A = T1 + T2 | 0;
    }
    A = A + this.A | 0;
    B = B + this.B | 0;
    C = C + this.C | 0;
    D = D + this.D | 0;
    E = E + this.E | 0;
    F = F + this.F | 0;
    G = G + this.G | 0;
    H = H + this.H | 0;
    this.set(A, B, C, D, E, F, G, H);
  }
  roundClean() {
    clean(SHA256_W);
  }
  destroy() {
    this.set(0, 0, 0, 0, 0, 0, 0, 0);
    clean(this.buffer);
  }
}
var sha256 = /* @__PURE__ */ createHasher(() => new SHA256);

// ../../../../node_modules/.bun/@noble+hashes@1.8.0/node_modules/@noble/hashes/esm/hmac.js
class HMAC extends Hash {
  constructor(hash, _key) {
    super();
    this.finished = false;
    this.destroyed = false;
    ahash(hash);
    const key = toBytes(_key);
    this.iHash = hash.create();
    if (typeof this.iHash.update !== "function")
      throw new Error("Expected instance of class which extends utils.Hash");
    this.blockLen = this.iHash.blockLen;
    this.outputLen = this.iHash.outputLen;
    const blockLen = this.blockLen;
    const pad = new Uint8Array(blockLen);
    pad.set(key.length > blockLen ? hash.create().update(key).digest() : key);
    for (let i = 0;i < pad.length; i++)
      pad[i] ^= 54;
    this.iHash.update(pad);
    this.oHash = hash.create();
    for (let i = 0;i < pad.length; i++)
      pad[i] ^= 54 ^ 92;
    this.oHash.update(pad);
    clean(pad);
  }
  update(buf) {
    aexists(this);
    this.iHash.update(buf);
    return this;
  }
  digestInto(out) {
    aexists(this);
    abytes(out, this.outputLen);
    this.finished = true;
    this.iHash.digestInto(out);
    this.oHash.update(out);
    this.oHash.digestInto(out);
    this.destroy();
  }
  digest() {
    const out = new Uint8Array(this.oHash.outputLen);
    this.digestInto(out);
    return out;
  }
  _cloneInto(to) {
    to || (to = Object.create(Object.getPrototypeOf(this), {}));
    const { oHash, iHash, finished, destroyed, blockLen, outputLen } = this;
    to = to;
    to.finished = finished;
    to.destroyed = destroyed;
    to.blockLen = blockLen;
    to.outputLen = outputLen;
    to.oHash = oHash._cloneInto(to.oHash);
    to.iHash = iHash._cloneInto(to.iHash);
    return to;
  }
  clone() {
    return this._cloneInto();
  }
  destroy() {
    this.destroyed = true;
    this.oHash.destroy();
    this.iHash.destroy();
  }
}
var hmac = (hash, key, message) => new HMAC(hash, key).update(message).digest();
hmac.create = (hash, key) => new HMAC(hash, key);

// ../../../../node_modules/.bun/@noble+curves@1.9.7/node_modules/@noble/curves/esm/utils.js
/*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) */
var _0n = /* @__PURE__ */ BigInt(0);
var _1n = /* @__PURE__ */ BigInt(1);
function _abool2(value, title = "") {
  if (typeof value !== "boolean") {
    const prefix = title && `"${title}"`;
    throw new Error(prefix + "expected boolean, got type=" + typeof value);
  }
  return value;
}
function _abytes2(value, length, title = "") {
  const bytes = isBytes(value);
  const len = value?.length;
  const needsLen = length !== undefined;
  if (!bytes || needsLen && len !== length) {
    const prefix = title && `"${title}" `;
    const ofLen = needsLen ? ` of length ${length}` : "";
    const got = bytes ? `length=${len}` : `type=${typeof value}`;
    throw new Error(prefix + "expected Uint8Array" + ofLen + ", got " + got);
  }
  return value;
}
function numberToHexUnpadded(num) {
  const hex = num.toString(16);
  return hex.length & 1 ? "0" + hex : hex;
}
function hexToNumber(hex) {
  if (typeof hex !== "string")
    throw new Error("hex string expected, got " + typeof hex);
  return hex === "" ? _0n : BigInt("0x" + hex);
}
function bytesToNumberBE(bytes) {
  return hexToNumber(bytesToHex(bytes));
}
function bytesToNumberLE(bytes) {
  abytes(bytes);
  return hexToNumber(bytesToHex(Uint8Array.from(bytes).reverse()));
}
function numberToBytesBE(n, len) {
  return hexToBytes(n.toString(16).padStart(len * 2, "0"));
}
function numberToBytesLE(n, len) {
  return numberToBytesBE(n, len).reverse();
}
function ensureBytes(title, hex, expectedLength) {
  let res;
  if (typeof hex === "string") {
    try {
      res = hexToBytes(hex);
    } catch (e) {
      throw new Error(title + " must be hex string or Uint8Array, cause: " + e);
    }
  } else if (isBytes(hex)) {
    res = Uint8Array.from(hex);
  } else {
    throw new Error(title + " must be hex string or Uint8Array");
  }
  const len = res.length;
  if (typeof expectedLength === "number" && len !== expectedLength)
    throw new Error(title + " of length " + expectedLength + " expected, got " + len);
  return res;
}
var isPosBig = (n) => typeof n === "bigint" && _0n <= n;
function inRange(n, min, max) {
  return isPosBig(n) && isPosBig(min) && isPosBig(max) && min <= n && n < max;
}
function aInRange(title, n, min, max) {
  if (!inRange(n, min, max))
    throw new Error("expected valid " + title + ": " + min + " <= n < " + max + ", got " + n);
}
function bitLen(n) {
  let len;
  for (len = 0;n > _0n; n >>= _1n, len += 1)
    ;
  return len;
}
var bitMask = (n) => (_1n << BigInt(n)) - _1n;
function createHmacDrbg(hashLen, qByteLen, hmacFn) {
  if (typeof hashLen !== "number" || hashLen < 2)
    throw new Error("hashLen must be a number");
  if (typeof qByteLen !== "number" || qByteLen < 2)
    throw new Error("qByteLen must be a number");
  if (typeof hmacFn !== "function")
    throw new Error("hmacFn must be a function");
  const u8n = (len) => new Uint8Array(len);
  const u8of = (byte) => Uint8Array.of(byte);
  let v = u8n(hashLen);
  let k = u8n(hashLen);
  let i = 0;
  const reset = () => {
    v.fill(1);
    k.fill(0);
    i = 0;
  };
  const h = (...b) => hmacFn(k, v, ...b);
  const reseed = (seed = u8n(0)) => {
    k = h(u8of(0), seed);
    v = h();
    if (seed.length === 0)
      return;
    k = h(u8of(1), seed);
    v = h();
  };
  const gen = () => {
    if (i++ >= 1000)
      throw new Error("drbg: tried 1000 values");
    let len = 0;
    const out = [];
    while (len < qByteLen) {
      v = h();
      const sl = v.slice();
      out.push(sl);
      len += v.length;
    }
    return concatBytes(...out);
  };
  const genUntil = (seed, pred) => {
    reset();
    reseed(seed);
    let res = undefined;
    while (!(res = pred(gen())))
      reseed();
    reset();
    return res;
  };
  return genUntil;
}
function isHash(val) {
  return typeof val === "function" && Number.isSafeInteger(val.outputLen);
}
function _validateObject(object, fields, optFields = {}) {
  if (!object || typeof object !== "object")
    throw new Error("expected valid options object");
  function checkField(fieldName, expectedType, isOpt) {
    const val = object[fieldName];
    if (isOpt && val === undefined)
      return;
    const current = typeof val;
    if (current !== expectedType || val === null)
      throw new Error(`param "${fieldName}" is invalid: expected ${expectedType}, got ${current}`);
  }
  Object.entries(fields).forEach(([k, v]) => checkField(k, v, false));
  Object.entries(optFields).forEach(([k, v]) => checkField(k, v, true));
}
function memoized(fn) {
  const map = new WeakMap;
  return (arg, ...args) => {
    const val = map.get(arg);
    if (val !== undefined)
      return val;
    const computed = fn(arg, ...args);
    map.set(arg, computed);
    return computed;
  };
}

// ../../../../node_modules/.bun/@noble+curves@1.9.7/node_modules/@noble/curves/esm/abstract/modular.js
/*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) */
var _0n2 = BigInt(0);
var _1n2 = BigInt(1);
var _2n = /* @__PURE__ */ BigInt(2);
var _3n = /* @__PURE__ */ BigInt(3);
var _4n = /* @__PURE__ */ BigInt(4);
var _5n = /* @__PURE__ */ BigInt(5);
var _7n = /* @__PURE__ */ BigInt(7);
var _8n = /* @__PURE__ */ BigInt(8);
var _9n = /* @__PURE__ */ BigInt(9);
var _16n = /* @__PURE__ */ BigInt(16);
function mod(a, b) {
  const result = a % b;
  return result >= _0n2 ? result : b + result;
}
function pow2(x, power, modulo) {
  let res = x;
  while (power-- > _0n2) {
    res *= res;
    res %= modulo;
  }
  return res;
}
function invert(number, modulo) {
  if (number === _0n2)
    throw new Error("invert: expected non-zero number");
  if (modulo <= _0n2)
    throw new Error("invert: expected positive modulus, got " + modulo);
  let a = mod(number, modulo);
  let b = modulo;
  let x = _0n2, y = _1n2, u = _1n2, v = _0n2;
  while (a !== _0n2) {
    const q = b / a;
    const r = b % a;
    const m = x - u * q;
    const n = y - v * q;
    b = a, a = r, x = u, y = v, u = m, v = n;
  }
  const gcd = b;
  if (gcd !== _1n2)
    throw new Error("invert: does not exist");
  return mod(x, modulo);
}
function assertIsSquare(Fp, root, n) {
  if (!Fp.eql(Fp.sqr(root), n))
    throw new Error("Cannot find square root");
}
function sqrt3mod4(Fp, n) {
  const p1div4 = (Fp.ORDER + _1n2) / _4n;
  const root = Fp.pow(n, p1div4);
  assertIsSquare(Fp, root, n);
  return root;
}
function sqrt5mod8(Fp, n) {
  const p5div8 = (Fp.ORDER - _5n) / _8n;
  const n2 = Fp.mul(n, _2n);
  const v = Fp.pow(n2, p5div8);
  const nv = Fp.mul(n, v);
  const i = Fp.mul(Fp.mul(nv, _2n), v);
  const root = Fp.mul(nv, Fp.sub(i, Fp.ONE));
  assertIsSquare(Fp, root, n);
  return root;
}
function sqrt9mod16(P) {
  const Fp_ = Field(P);
  const tn = tonelliShanks(P);
  const c1 = tn(Fp_, Fp_.neg(Fp_.ONE));
  const c2 = tn(Fp_, c1);
  const c3 = tn(Fp_, Fp_.neg(c1));
  const c4 = (P + _7n) / _16n;
  return (Fp, n) => {
    let tv1 = Fp.pow(n, c4);
    let tv2 = Fp.mul(tv1, c1);
    const tv3 = Fp.mul(tv1, c2);
    const tv4 = Fp.mul(tv1, c3);
    const e1 = Fp.eql(Fp.sqr(tv2), n);
    const e2 = Fp.eql(Fp.sqr(tv3), n);
    tv1 = Fp.cmov(tv1, tv2, e1);
    tv2 = Fp.cmov(tv4, tv3, e2);
    const e3 = Fp.eql(Fp.sqr(tv2), n);
    const root = Fp.cmov(tv1, tv2, e3);
    assertIsSquare(Fp, root, n);
    return root;
  };
}
function tonelliShanks(P) {
  if (P < _3n)
    throw new Error("sqrt is not defined for small field");
  let Q = P - _1n2;
  let S = 0;
  while (Q % _2n === _0n2) {
    Q /= _2n;
    S++;
  }
  let Z = _2n;
  const _Fp = Field(P);
  while (FpLegendre(_Fp, Z) === 1) {
    if (Z++ > 1000)
      throw new Error("Cannot find square root: probably non-prime P");
  }
  if (S === 1)
    return sqrt3mod4;
  let cc = _Fp.pow(Z, Q);
  const Q1div2 = (Q + _1n2) / _2n;
  return function tonelliSlow(Fp, n) {
    if (Fp.is0(n))
      return n;
    if (FpLegendre(Fp, n) !== 1)
      throw new Error("Cannot find square root");
    let M = S;
    let c = Fp.mul(Fp.ONE, cc);
    let t = Fp.pow(n, Q);
    let R = Fp.pow(n, Q1div2);
    while (!Fp.eql(t, Fp.ONE)) {
      if (Fp.is0(t))
        return Fp.ZERO;
      let i = 1;
      let t_tmp = Fp.sqr(t);
      while (!Fp.eql(t_tmp, Fp.ONE)) {
        i++;
        t_tmp = Fp.sqr(t_tmp);
        if (i === M)
          throw new Error("Cannot find square root");
      }
      const exponent = _1n2 << BigInt(M - i - 1);
      const b = Fp.pow(c, exponent);
      M = i;
      c = Fp.sqr(b);
      t = Fp.mul(t, c);
      R = Fp.mul(R, b);
    }
    return R;
  };
}
function FpSqrt(P) {
  if (P % _4n === _3n)
    return sqrt3mod4;
  if (P % _8n === _5n)
    return sqrt5mod8;
  if (P % _16n === _9n)
    return sqrt9mod16(P);
  return tonelliShanks(P);
}
var FIELD_FIELDS = [
  "create",
  "isValid",
  "is0",
  "neg",
  "inv",
  "sqrt",
  "sqr",
  "eql",
  "add",
  "sub",
  "mul",
  "pow",
  "div",
  "addN",
  "subN",
  "mulN",
  "sqrN"
];
function validateField(field) {
  const initial = {
    ORDER: "bigint",
    MASK: "bigint",
    BYTES: "number",
    BITS: "number"
  };
  const opts = FIELD_FIELDS.reduce((map, val) => {
    map[val] = "function";
    return map;
  }, initial);
  _validateObject(field, opts);
  return field;
}
function FpPow(Fp, num, power) {
  if (power < _0n2)
    throw new Error("invalid exponent, negatives unsupported");
  if (power === _0n2)
    return Fp.ONE;
  if (power === _1n2)
    return num;
  let p = Fp.ONE;
  let d = num;
  while (power > _0n2) {
    if (power & _1n2)
      p = Fp.mul(p, d);
    d = Fp.sqr(d);
    power >>= _1n2;
  }
  return p;
}
function FpInvertBatch(Fp, nums, passZero = false) {
  const inverted = new Array(nums.length).fill(passZero ? Fp.ZERO : undefined);
  const multipliedAcc = nums.reduce((acc, num, i) => {
    if (Fp.is0(num))
      return acc;
    inverted[i] = acc;
    return Fp.mul(acc, num);
  }, Fp.ONE);
  const invertedAcc = Fp.inv(multipliedAcc);
  nums.reduceRight((acc, num, i) => {
    if (Fp.is0(num))
      return acc;
    inverted[i] = Fp.mul(acc, inverted[i]);
    return Fp.mul(acc, num);
  }, invertedAcc);
  return inverted;
}
function FpLegendre(Fp, n) {
  const p1mod2 = (Fp.ORDER - _1n2) / _2n;
  const powered = Fp.pow(n, p1mod2);
  const yes = Fp.eql(powered, Fp.ONE);
  const zero = Fp.eql(powered, Fp.ZERO);
  const no = Fp.eql(powered, Fp.neg(Fp.ONE));
  if (!yes && !zero && !no)
    throw new Error("invalid Legendre symbol result");
  return yes ? 1 : zero ? 0 : -1;
}
function nLength(n, nBitLength) {
  if (nBitLength !== undefined)
    anumber(nBitLength);
  const _nBitLength = nBitLength !== undefined ? nBitLength : n.toString(2).length;
  const nByteLength = Math.ceil(_nBitLength / 8);
  return { nBitLength: _nBitLength, nByteLength };
}
function Field(ORDER, bitLenOrOpts, isLE = false, opts = {}) {
  if (ORDER <= _0n2)
    throw new Error("invalid field: expected ORDER > 0, got " + ORDER);
  let _nbitLength = undefined;
  let _sqrt = undefined;
  let modFromBytes = false;
  let allowedLengths = undefined;
  if (typeof bitLenOrOpts === "object" && bitLenOrOpts != null) {
    if (opts.sqrt || isLE)
      throw new Error("cannot specify opts in two arguments");
    const _opts = bitLenOrOpts;
    if (_opts.BITS)
      _nbitLength = _opts.BITS;
    if (_opts.sqrt)
      _sqrt = _opts.sqrt;
    if (typeof _opts.isLE === "boolean")
      isLE = _opts.isLE;
    if (typeof _opts.modFromBytes === "boolean")
      modFromBytes = _opts.modFromBytes;
    allowedLengths = _opts.allowedLengths;
  } else {
    if (typeof bitLenOrOpts === "number")
      _nbitLength = bitLenOrOpts;
    if (opts.sqrt)
      _sqrt = opts.sqrt;
  }
  const { nBitLength: BITS, nByteLength: BYTES } = nLength(ORDER, _nbitLength);
  if (BYTES > 2048)
    throw new Error("invalid field: expected ORDER of <= 2048 bytes");
  let sqrtP;
  const f = Object.freeze({
    ORDER,
    isLE,
    BITS,
    BYTES,
    MASK: bitMask(BITS),
    ZERO: _0n2,
    ONE: _1n2,
    allowedLengths,
    create: (num) => mod(num, ORDER),
    isValid: (num) => {
      if (typeof num !== "bigint")
        throw new Error("invalid field element: expected bigint, got " + typeof num);
      return _0n2 <= num && num < ORDER;
    },
    is0: (num) => num === _0n2,
    isValidNot0: (num) => !f.is0(num) && f.isValid(num),
    isOdd: (num) => (num & _1n2) === _1n2,
    neg: (num) => mod(-num, ORDER),
    eql: (lhs, rhs) => lhs === rhs,
    sqr: (num) => mod(num * num, ORDER),
    add: (lhs, rhs) => mod(lhs + rhs, ORDER),
    sub: (lhs, rhs) => mod(lhs - rhs, ORDER),
    mul: (lhs, rhs) => mod(lhs * rhs, ORDER),
    pow: (num, power) => FpPow(f, num, power),
    div: (lhs, rhs) => mod(lhs * invert(rhs, ORDER), ORDER),
    sqrN: (num) => num * num,
    addN: (lhs, rhs) => lhs + rhs,
    subN: (lhs, rhs) => lhs - rhs,
    mulN: (lhs, rhs) => lhs * rhs,
    inv: (num) => invert(num, ORDER),
    sqrt: _sqrt || ((n) => {
      if (!sqrtP)
        sqrtP = FpSqrt(ORDER);
      return sqrtP(f, n);
    }),
    toBytes: (num) => isLE ? numberToBytesLE(num, BYTES) : numberToBytesBE(num, BYTES),
    fromBytes: (bytes, skipValidation = true) => {
      if (allowedLengths) {
        if (!allowedLengths.includes(bytes.length) || bytes.length > BYTES) {
          throw new Error("Field.fromBytes: expected " + allowedLengths + " bytes, got " + bytes.length);
        }
        const padded = new Uint8Array(BYTES);
        padded.set(bytes, isLE ? 0 : padded.length - bytes.length);
        bytes = padded;
      }
      if (bytes.length !== BYTES)
        throw new Error("Field.fromBytes: expected " + BYTES + " bytes, got " + bytes.length);
      let scalar = isLE ? bytesToNumberLE(bytes) : bytesToNumberBE(bytes);
      if (modFromBytes)
        scalar = mod(scalar, ORDER);
      if (!skipValidation) {
        if (!f.isValid(scalar))
          throw new Error("invalid field element: outside of range 0..ORDER");
      }
      return scalar;
    },
    invertBatch: (lst) => FpInvertBatch(f, lst),
    cmov: (a, b, c) => c ? b : a
  });
  return Object.freeze(f);
}
function getFieldBytesLength(fieldOrder) {
  if (typeof fieldOrder !== "bigint")
    throw new Error("field order must be bigint");
  const bitLength = fieldOrder.toString(2).length;
  return Math.ceil(bitLength / 8);
}
function getMinHashLength(fieldOrder) {
  const length = getFieldBytesLength(fieldOrder);
  return length + Math.ceil(length / 2);
}
function mapHashToField(key, fieldOrder, isLE = false) {
  const len = key.length;
  const fieldLen = getFieldBytesLength(fieldOrder);
  const minLen = getMinHashLength(fieldOrder);
  if (len < 16 || len < minLen || len > 1024)
    throw new Error("expected " + minLen + "-1024 bytes of input, got " + len);
  const num = isLE ? bytesToNumberLE(key) : bytesToNumberBE(key);
  const reduced = mod(num, fieldOrder - _1n2) + _1n2;
  return isLE ? numberToBytesLE(reduced, fieldLen) : numberToBytesBE(reduced, fieldLen);
}

// ../../../../node_modules/.bun/@noble+curves@1.9.7/node_modules/@noble/curves/esm/abstract/curve.js
/*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) */
var _0n3 = BigInt(0);
var _1n3 = BigInt(1);
function negateCt(condition, item) {
  const neg = item.negate();
  return condition ? neg : item;
}
function normalizeZ(c, points) {
  const invertedZs = FpInvertBatch(c.Fp, points.map((p) => p.Z));
  return points.map((p, i) => c.fromAffine(p.toAffine(invertedZs[i])));
}
function validateW(W, bits) {
  if (!Number.isSafeInteger(W) || W <= 0 || W > bits)
    throw new Error("invalid window size, expected [1.." + bits + "], got W=" + W);
}
function calcWOpts(W, scalarBits) {
  validateW(W, scalarBits);
  const windows = Math.ceil(scalarBits / W) + 1;
  const windowSize = 2 ** (W - 1);
  const maxNumber = 2 ** W;
  const mask = bitMask(W);
  const shiftBy = BigInt(W);
  return { windows, windowSize, mask, maxNumber, shiftBy };
}
function calcOffsets(n, window, wOpts) {
  const { windowSize, mask, maxNumber, shiftBy } = wOpts;
  let wbits = Number(n & mask);
  let nextN = n >> shiftBy;
  if (wbits > windowSize) {
    wbits -= maxNumber;
    nextN += _1n3;
  }
  const offsetStart = window * windowSize;
  const offset = offsetStart + Math.abs(wbits) - 1;
  const isZero = wbits === 0;
  const isNeg = wbits < 0;
  const isNegF = window % 2 !== 0;
  const offsetF = offsetStart;
  return { nextN, offset, isZero, isNeg, isNegF, offsetF };
}
function validateMSMPoints(points, c) {
  if (!Array.isArray(points))
    throw new Error("array expected");
  points.forEach((p, i) => {
    if (!(p instanceof c))
      throw new Error("invalid point at index " + i);
  });
}
function validateMSMScalars(scalars, field) {
  if (!Array.isArray(scalars))
    throw new Error("array of scalars expected");
  scalars.forEach((s, i) => {
    if (!field.isValid(s))
      throw new Error("invalid scalar at index " + i);
  });
}
var pointPrecomputes = new WeakMap;
var pointWindowSizes = new WeakMap;
function getW(P) {
  return pointWindowSizes.get(P) || 1;
}
function assert0(n) {
  if (n !== _0n3)
    throw new Error("invalid wNAF");
}

class wNAF {
  constructor(Point, bits) {
    this.BASE = Point.BASE;
    this.ZERO = Point.ZERO;
    this.Fn = Point.Fn;
    this.bits = bits;
  }
  _unsafeLadder(elm, n, p = this.ZERO) {
    let d = elm;
    while (n > _0n3) {
      if (n & _1n3)
        p = p.add(d);
      d = d.double();
      n >>= _1n3;
    }
    return p;
  }
  precomputeWindow(point, W) {
    const { windows, windowSize } = calcWOpts(W, this.bits);
    const points = [];
    let p = point;
    let base = p;
    for (let window = 0;window < windows; window++) {
      base = p;
      points.push(base);
      for (let i = 1;i < windowSize; i++) {
        base = base.add(p);
        points.push(base);
      }
      p = base.double();
    }
    return points;
  }
  wNAF(W, precomputes, n) {
    if (!this.Fn.isValid(n))
      throw new Error("invalid scalar");
    let p = this.ZERO;
    let f = this.BASE;
    const wo = calcWOpts(W, this.bits);
    for (let window = 0;window < wo.windows; window++) {
      const { nextN, offset, isZero, isNeg, isNegF, offsetF } = calcOffsets(n, window, wo);
      n = nextN;
      if (isZero) {
        f = f.add(negateCt(isNegF, precomputes[offsetF]));
      } else {
        p = p.add(negateCt(isNeg, precomputes[offset]));
      }
    }
    assert0(n);
    return { p, f };
  }
  wNAFUnsafe(W, precomputes, n, acc = this.ZERO) {
    const wo = calcWOpts(W, this.bits);
    for (let window = 0;window < wo.windows; window++) {
      if (n === _0n3)
        break;
      const { nextN, offset, isZero, isNeg } = calcOffsets(n, window, wo);
      n = nextN;
      if (isZero) {
        continue;
      } else {
        const item = precomputes[offset];
        acc = acc.add(isNeg ? item.negate() : item);
      }
    }
    assert0(n);
    return acc;
  }
  getPrecomputes(W, point, transform) {
    let comp = pointPrecomputes.get(point);
    if (!comp) {
      comp = this.precomputeWindow(point, W);
      if (W !== 1) {
        if (typeof transform === "function")
          comp = transform(comp);
        pointPrecomputes.set(point, comp);
      }
    }
    return comp;
  }
  cached(point, scalar, transform) {
    const W = getW(point);
    return this.wNAF(W, this.getPrecomputes(W, point, transform), scalar);
  }
  unsafe(point, scalar, transform, prev) {
    const W = getW(point);
    if (W === 1)
      return this._unsafeLadder(point, scalar, prev);
    return this.wNAFUnsafe(W, this.getPrecomputes(W, point, transform), scalar, prev);
  }
  createCache(P, W) {
    validateW(W, this.bits);
    pointWindowSizes.set(P, W);
    pointPrecomputes.delete(P);
  }
  hasCache(elm) {
    return getW(elm) !== 1;
  }
}
function mulEndoUnsafe(Point, point, k1, k2) {
  let acc = point;
  let p1 = Point.ZERO;
  let p2 = Point.ZERO;
  while (k1 > _0n3 || k2 > _0n3) {
    if (k1 & _1n3)
      p1 = p1.add(acc);
    if (k2 & _1n3)
      p2 = p2.add(acc);
    acc = acc.double();
    k1 >>= _1n3;
    k2 >>= _1n3;
  }
  return { p1, p2 };
}
function pippenger(c, fieldN, points, scalars) {
  validateMSMPoints(points, c);
  validateMSMScalars(scalars, fieldN);
  const plength = points.length;
  const slength = scalars.length;
  if (plength !== slength)
    throw new Error("arrays of points and scalars must have equal length");
  const zero = c.ZERO;
  const wbits = bitLen(BigInt(plength));
  let windowSize = 1;
  if (wbits > 12)
    windowSize = wbits - 3;
  else if (wbits > 4)
    windowSize = wbits - 2;
  else if (wbits > 0)
    windowSize = 2;
  const MASK = bitMask(windowSize);
  const buckets = new Array(Number(MASK) + 1).fill(zero);
  const lastBits = Math.floor((fieldN.BITS - 1) / windowSize) * windowSize;
  let sum = zero;
  for (let i = lastBits;i >= 0; i -= windowSize) {
    buckets.fill(zero);
    for (let j = 0;j < slength; j++) {
      const scalar = scalars[j];
      const wbits2 = Number(scalar >> BigInt(i) & MASK);
      buckets[wbits2] = buckets[wbits2].add(points[j]);
    }
    let resI = zero;
    for (let j = buckets.length - 1, sumI = zero;j > 0; j--) {
      sumI = sumI.add(buckets[j]);
      resI = resI.add(sumI);
    }
    sum = sum.add(resI);
    if (i !== 0)
      for (let j = 0;j < windowSize; j++)
        sum = sum.double();
  }
  return sum;
}
function createField(order, field, isLE) {
  if (field) {
    if (field.ORDER !== order)
      throw new Error("Field.ORDER must match order: Fp == p, Fn == n");
    validateField(field);
    return field;
  } else {
    return Field(order, { isLE });
  }
}
function _createCurveFields(type, CURVE, curveOpts = {}, FpFnLE) {
  if (FpFnLE === undefined)
    FpFnLE = type === "edwards";
  if (!CURVE || typeof CURVE !== "object")
    throw new Error(`expected valid ${type} CURVE object`);
  for (const p of ["p", "n", "h"]) {
    const val = CURVE[p];
    if (!(typeof val === "bigint" && val > _0n3))
      throw new Error(`CURVE.${p} must be positive bigint`);
  }
  const Fp = createField(CURVE.p, curveOpts.Fp, FpFnLE);
  const Fn = createField(CURVE.n, curveOpts.Fn, FpFnLE);
  const _b = type === "weierstrass" ? "b" : "d";
  const params = ["Gx", "Gy", "a", _b];
  for (const p of params) {
    if (!Fp.isValid(CURVE[p]))
      throw new Error(`CURVE.${p} must be valid field element of CURVE.Fp`);
  }
  CURVE = Object.freeze(Object.assign({}, CURVE));
  return { CURVE, Fp, Fn };
}

// ../../../../node_modules/.bun/@noble+curves@1.9.7/node_modules/@noble/curves/esm/abstract/weierstrass.js
/*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) */
var divNearest = (num, den) => (num + (num >= 0 ? den : -den) / _2n2) / den;
function _splitEndoScalar(k, basis, n) {
  const [[a1, b1], [a2, b2]] = basis;
  const c1 = divNearest(b2 * k, n);
  const c2 = divNearest(-b1 * k, n);
  let k1 = k - c1 * a1 - c2 * a2;
  let k2 = -c1 * b1 - c2 * b2;
  const k1neg = k1 < _0n4;
  const k2neg = k2 < _0n4;
  if (k1neg)
    k1 = -k1;
  if (k2neg)
    k2 = -k2;
  const MAX_NUM = bitMask(Math.ceil(bitLen(n) / 2)) + _1n4;
  if (k1 < _0n4 || k1 >= MAX_NUM || k2 < _0n4 || k2 >= MAX_NUM) {
    throw new Error("splitScalar (endomorphism): failed, k=" + k);
  }
  return { k1neg, k1, k2neg, k2 };
}
function validateSigFormat(format) {
  if (!["compact", "recovered", "der"].includes(format))
    throw new Error('Signature format must be "compact", "recovered", or "der"');
  return format;
}
function validateSigOpts(opts, def) {
  const optsn = {};
  for (let optName of Object.keys(def)) {
    optsn[optName] = opts[optName] === undefined ? def[optName] : opts[optName];
  }
  _abool2(optsn.lowS, "lowS");
  _abool2(optsn.prehash, "prehash");
  if (optsn.format !== undefined)
    validateSigFormat(optsn.format);
  return optsn;
}

class DERErr extends Error {
  constructor(m = "") {
    super(m);
  }
}
var DER = {
  Err: DERErr,
  _tlv: {
    encode: (tag, data) => {
      const { Err: E } = DER;
      if (tag < 0 || tag > 256)
        throw new E("tlv.encode: wrong tag");
      if (data.length & 1)
        throw new E("tlv.encode: unpadded data");
      const dataLen = data.length / 2;
      const len = numberToHexUnpadded(dataLen);
      if (len.length / 2 & 128)
        throw new E("tlv.encode: long form length too big");
      const lenLen = dataLen > 127 ? numberToHexUnpadded(len.length / 2 | 128) : "";
      const t = numberToHexUnpadded(tag);
      return t + lenLen + len + data;
    },
    decode(tag, data) {
      const { Err: E } = DER;
      let pos = 0;
      if (tag < 0 || tag > 256)
        throw new E("tlv.encode: wrong tag");
      if (data.length < 2 || data[pos++] !== tag)
        throw new E("tlv.decode: wrong tlv");
      const first = data[pos++];
      const isLong = !!(first & 128);
      let length = 0;
      if (!isLong)
        length = first;
      else {
        const lenLen = first & 127;
        if (!lenLen)
          throw new E("tlv.decode(long): indefinite length not supported");
        if (lenLen > 4)
          throw new E("tlv.decode(long): byte length is too big");
        const lengthBytes = data.subarray(pos, pos + lenLen);
        if (lengthBytes.length !== lenLen)
          throw new E("tlv.decode: length bytes not complete");
        if (lengthBytes[0] === 0)
          throw new E("tlv.decode(long): zero leftmost byte");
        for (const b of lengthBytes)
          length = length << 8 | b;
        pos += lenLen;
        if (length < 128)
          throw new E("tlv.decode(long): not minimal encoding");
      }
      const v = data.subarray(pos, pos + length);
      if (v.length !== length)
        throw new E("tlv.decode: wrong value length");
      return { v, l: data.subarray(pos + length) };
    }
  },
  _int: {
    encode(num) {
      const { Err: E } = DER;
      if (num < _0n4)
        throw new E("integer: negative integers are not allowed");
      let hex = numberToHexUnpadded(num);
      if (Number.parseInt(hex[0], 16) & 8)
        hex = "00" + hex;
      if (hex.length & 1)
        throw new E("unexpected DER parsing assertion: unpadded hex");
      return hex;
    },
    decode(data) {
      const { Err: E } = DER;
      if (data[0] & 128)
        throw new E("invalid signature integer: negative");
      if (data[0] === 0 && !(data[1] & 128))
        throw new E("invalid signature integer: unnecessary leading zero");
      return bytesToNumberBE(data);
    }
  },
  toSig(hex) {
    const { Err: E, _int: int, _tlv: tlv } = DER;
    const data = ensureBytes("signature", hex);
    const { v: seqBytes, l: seqLeftBytes } = tlv.decode(48, data);
    if (seqLeftBytes.length)
      throw new E("invalid signature: left bytes after parsing");
    const { v: rBytes, l: rLeftBytes } = tlv.decode(2, seqBytes);
    const { v: sBytes, l: sLeftBytes } = tlv.decode(2, rLeftBytes);
    if (sLeftBytes.length)
      throw new E("invalid signature: left bytes after parsing");
    return { r: int.decode(rBytes), s: int.decode(sBytes) };
  },
  hexFromSig(sig) {
    const { _tlv: tlv, _int: int } = DER;
    const rs = tlv.encode(2, int.encode(sig.r));
    const ss = tlv.encode(2, int.encode(sig.s));
    const seq = rs + ss;
    return tlv.encode(48, seq);
  }
};
var _0n4 = BigInt(0);
var _1n4 = BigInt(1);
var _2n2 = BigInt(2);
var _3n2 = BigInt(3);
var _4n2 = BigInt(4);
function _normFnElement(Fn, key) {
  const { BYTES: expected } = Fn;
  let num;
  if (typeof key === "bigint") {
    num = key;
  } else {
    let bytes = ensureBytes("private key", key);
    try {
      num = Fn.fromBytes(bytes);
    } catch (error) {
      throw new Error(`invalid private key: expected ui8a of size ${expected}, got ${typeof key}`);
    }
  }
  if (!Fn.isValidNot0(num))
    throw new Error("invalid private key: out of range [1..N-1]");
  return num;
}
function weierstrassN(params, extraOpts = {}) {
  const validated = _createCurveFields("weierstrass", params, extraOpts);
  const { Fp, Fn } = validated;
  let CURVE = validated.CURVE;
  const { h: cofactor, n: CURVE_ORDER } = CURVE;
  _validateObject(extraOpts, {}, {
    allowInfinityPoint: "boolean",
    clearCofactor: "function",
    isTorsionFree: "function",
    fromBytes: "function",
    toBytes: "function",
    endo: "object",
    wrapPrivateKey: "boolean"
  });
  const { endo } = extraOpts;
  if (endo) {
    if (!Fp.is0(CURVE.a) || typeof endo.beta !== "bigint" || !Array.isArray(endo.basises)) {
      throw new Error('invalid endo: expected "beta": bigint and "basises": array');
    }
  }
  const lengths = getWLengths(Fp, Fn);
  function assertCompressionIsSupported() {
    if (!Fp.isOdd)
      throw new Error("compression is not supported: Field does not have .isOdd()");
  }
  function pointToBytes(_c, point, isCompressed) {
    const { x, y } = point.toAffine();
    const bx = Fp.toBytes(x);
    _abool2(isCompressed, "isCompressed");
    if (isCompressed) {
      assertCompressionIsSupported();
      const hasEvenY = !Fp.isOdd(y);
      return concatBytes(pprefix(hasEvenY), bx);
    } else {
      return concatBytes(Uint8Array.of(4), bx, Fp.toBytes(y));
    }
  }
  function pointFromBytes(bytes) {
    _abytes2(bytes, undefined, "Point");
    const { publicKey: comp, publicKeyUncompressed: uncomp } = lengths;
    const length = bytes.length;
    const head = bytes[0];
    const tail = bytes.subarray(1);
    if (length === comp && (head === 2 || head === 3)) {
      const x = Fp.fromBytes(tail);
      if (!Fp.isValid(x))
        throw new Error("bad point: is not on curve, wrong x");
      const y2 = weierstrassEquation(x);
      let y;
      try {
        y = Fp.sqrt(y2);
      } catch (sqrtError) {
        const err = sqrtError instanceof Error ? ": " + sqrtError.message : "";
        throw new Error("bad point: is not on curve, sqrt error" + err);
      }
      assertCompressionIsSupported();
      const isYOdd = Fp.isOdd(y);
      const isHeadOdd = (head & 1) === 1;
      if (isHeadOdd !== isYOdd)
        y = Fp.neg(y);
      return { x, y };
    } else if (length === uncomp && head === 4) {
      const L = Fp.BYTES;
      const x = Fp.fromBytes(tail.subarray(0, L));
      const y = Fp.fromBytes(tail.subarray(L, L * 2));
      if (!isValidXY(x, y))
        throw new Error("bad point: is not on curve");
      return { x, y };
    } else {
      throw new Error(`bad point: got length ${length}, expected compressed=${comp} or uncompressed=${uncomp}`);
    }
  }
  const encodePoint = extraOpts.toBytes || pointToBytes;
  const decodePoint = extraOpts.fromBytes || pointFromBytes;
  function weierstrassEquation(x) {
    const x2 = Fp.sqr(x);
    const x3 = Fp.mul(x2, x);
    return Fp.add(Fp.add(x3, Fp.mul(x, CURVE.a)), CURVE.b);
  }
  function isValidXY(x, y) {
    const left = Fp.sqr(y);
    const right = weierstrassEquation(x);
    return Fp.eql(left, right);
  }
  if (!isValidXY(CURVE.Gx, CURVE.Gy))
    throw new Error("bad curve params: generator point");
  const _4a3 = Fp.mul(Fp.pow(CURVE.a, _3n2), _4n2);
  const _27b2 = Fp.mul(Fp.sqr(CURVE.b), BigInt(27));
  if (Fp.is0(Fp.add(_4a3, _27b2)))
    throw new Error("bad curve params: a or b");
  function acoord(title, n, banZero = false) {
    if (!Fp.isValid(n) || banZero && Fp.is0(n))
      throw new Error(`bad point coordinate ${title}`);
    return n;
  }
  function aprjpoint(other) {
    if (!(other instanceof Point))
      throw new Error("ProjectivePoint expected");
  }
  function splitEndoScalarN(k) {
    if (!endo || !endo.basises)
      throw new Error("no endo");
    return _splitEndoScalar(k, endo.basises, Fn.ORDER);
  }
  const toAffineMemo = memoized((p, iz) => {
    const { X, Y, Z } = p;
    if (Fp.eql(Z, Fp.ONE))
      return { x: X, y: Y };
    const is0 = p.is0();
    if (iz == null)
      iz = is0 ? Fp.ONE : Fp.inv(Z);
    const x = Fp.mul(X, iz);
    const y = Fp.mul(Y, iz);
    const zz = Fp.mul(Z, iz);
    if (is0)
      return { x: Fp.ZERO, y: Fp.ZERO };
    if (!Fp.eql(zz, Fp.ONE))
      throw new Error("invZ was invalid");
    return { x, y };
  });
  const assertValidMemo = memoized((p) => {
    if (p.is0()) {
      if (extraOpts.allowInfinityPoint && !Fp.is0(p.Y))
        return;
      throw new Error("bad point: ZERO");
    }
    const { x, y } = p.toAffine();
    if (!Fp.isValid(x) || !Fp.isValid(y))
      throw new Error("bad point: x or y not field elements");
    if (!isValidXY(x, y))
      throw new Error("bad point: equation left != right");
    if (!p.isTorsionFree())
      throw new Error("bad point: not in prime-order subgroup");
    return true;
  });
  function finishEndo(endoBeta, k1p, k2p, k1neg, k2neg) {
    k2p = new Point(Fp.mul(k2p.X, endoBeta), k2p.Y, k2p.Z);
    k1p = negateCt(k1neg, k1p);
    k2p = negateCt(k2neg, k2p);
    return k1p.add(k2p);
  }

  class Point {
    constructor(X, Y, Z) {
      this.X = acoord("x", X);
      this.Y = acoord("y", Y, true);
      this.Z = acoord("z", Z);
      Object.freeze(this);
    }
    static CURVE() {
      return CURVE;
    }
    static fromAffine(p) {
      const { x, y } = p || {};
      if (!p || !Fp.isValid(x) || !Fp.isValid(y))
        throw new Error("invalid affine point");
      if (p instanceof Point)
        throw new Error("projective point not allowed");
      if (Fp.is0(x) && Fp.is0(y))
        return Point.ZERO;
      return new Point(x, y, Fp.ONE);
    }
    static fromBytes(bytes) {
      const P = Point.fromAffine(decodePoint(_abytes2(bytes, undefined, "point")));
      P.assertValidity();
      return P;
    }
    static fromHex(hex) {
      return Point.fromBytes(ensureBytes("pointHex", hex));
    }
    get x() {
      return this.toAffine().x;
    }
    get y() {
      return this.toAffine().y;
    }
    precompute(windowSize = 8, isLazy = true) {
      wnaf.createCache(this, windowSize);
      if (!isLazy)
        this.multiply(_3n2);
      return this;
    }
    assertValidity() {
      assertValidMemo(this);
    }
    hasEvenY() {
      const { y } = this.toAffine();
      if (!Fp.isOdd)
        throw new Error("Field doesn't support isOdd");
      return !Fp.isOdd(y);
    }
    equals(other) {
      aprjpoint(other);
      const { X: X1, Y: Y1, Z: Z1 } = this;
      const { X: X2, Y: Y2, Z: Z2 } = other;
      const U1 = Fp.eql(Fp.mul(X1, Z2), Fp.mul(X2, Z1));
      const U2 = Fp.eql(Fp.mul(Y1, Z2), Fp.mul(Y2, Z1));
      return U1 && U2;
    }
    negate() {
      return new Point(this.X, Fp.neg(this.Y), this.Z);
    }
    double() {
      const { a, b } = CURVE;
      const b3 = Fp.mul(b, _3n2);
      const { X: X1, Y: Y1, Z: Z1 } = this;
      let { ZERO: X3, ZERO: Y3, ZERO: Z3 } = Fp;
      let t0 = Fp.mul(X1, X1);
      let t1 = Fp.mul(Y1, Y1);
      let t2 = Fp.mul(Z1, Z1);
      let t3 = Fp.mul(X1, Y1);
      t3 = Fp.add(t3, t3);
      Z3 = Fp.mul(X1, Z1);
      Z3 = Fp.add(Z3, Z3);
      X3 = Fp.mul(a, Z3);
      Y3 = Fp.mul(b3, t2);
      Y3 = Fp.add(X3, Y3);
      X3 = Fp.sub(t1, Y3);
      Y3 = Fp.add(t1, Y3);
      Y3 = Fp.mul(X3, Y3);
      X3 = Fp.mul(t3, X3);
      Z3 = Fp.mul(b3, Z3);
      t2 = Fp.mul(a, t2);
      t3 = Fp.sub(t0, t2);
      t3 = Fp.mul(a, t3);
      t3 = Fp.add(t3, Z3);
      Z3 = Fp.add(t0, t0);
      t0 = Fp.add(Z3, t0);
      t0 = Fp.add(t0, t2);
      t0 = Fp.mul(t0, t3);
      Y3 = Fp.add(Y3, t0);
      t2 = Fp.mul(Y1, Z1);
      t2 = Fp.add(t2, t2);
      t0 = Fp.mul(t2, t3);
      X3 = Fp.sub(X3, t0);
      Z3 = Fp.mul(t2, t1);
      Z3 = Fp.add(Z3, Z3);
      Z3 = Fp.add(Z3, Z3);
      return new Point(X3, Y3, Z3);
    }
    add(other) {
      aprjpoint(other);
      const { X: X1, Y: Y1, Z: Z1 } = this;
      const { X: X2, Y: Y2, Z: Z2 } = other;
      let { ZERO: X3, ZERO: Y3, ZERO: Z3 } = Fp;
      const a = CURVE.a;
      const b3 = Fp.mul(CURVE.b, _3n2);
      let t0 = Fp.mul(X1, X2);
      let t1 = Fp.mul(Y1, Y2);
      let t2 = Fp.mul(Z1, Z2);
      let t3 = Fp.add(X1, Y1);
      let t4 = Fp.add(X2, Y2);
      t3 = Fp.mul(t3, t4);
      t4 = Fp.add(t0, t1);
      t3 = Fp.sub(t3, t4);
      t4 = Fp.add(X1, Z1);
      let t5 = Fp.add(X2, Z2);
      t4 = Fp.mul(t4, t5);
      t5 = Fp.add(t0, t2);
      t4 = Fp.sub(t4, t5);
      t5 = Fp.add(Y1, Z1);
      X3 = Fp.add(Y2, Z2);
      t5 = Fp.mul(t5, X3);
      X3 = Fp.add(t1, t2);
      t5 = Fp.sub(t5, X3);
      Z3 = Fp.mul(a, t4);
      X3 = Fp.mul(b3, t2);
      Z3 = Fp.add(X3, Z3);
      X3 = Fp.sub(t1, Z3);
      Z3 = Fp.add(t1, Z3);
      Y3 = Fp.mul(X3, Z3);
      t1 = Fp.add(t0, t0);
      t1 = Fp.add(t1, t0);
      t2 = Fp.mul(a, t2);
      t4 = Fp.mul(b3, t4);
      t1 = Fp.add(t1, t2);
      t2 = Fp.sub(t0, t2);
      t2 = Fp.mul(a, t2);
      t4 = Fp.add(t4, t2);
      t0 = Fp.mul(t1, t4);
      Y3 = Fp.add(Y3, t0);
      t0 = Fp.mul(t5, t4);
      X3 = Fp.mul(t3, X3);
      X3 = Fp.sub(X3, t0);
      t0 = Fp.mul(t3, t1);
      Z3 = Fp.mul(t5, Z3);
      Z3 = Fp.add(Z3, t0);
      return new Point(X3, Y3, Z3);
    }
    subtract(other) {
      return this.add(other.negate());
    }
    is0() {
      return this.equals(Point.ZERO);
    }
    multiply(scalar) {
      const { endo: endo2 } = extraOpts;
      if (!Fn.isValidNot0(scalar))
        throw new Error("invalid scalar: out of range");
      let point, fake;
      const mul = (n) => wnaf.cached(this, n, (p) => normalizeZ(Point, p));
      if (endo2) {
        const { k1neg, k1, k2neg, k2 } = splitEndoScalarN(scalar);
        const { p: k1p, f: k1f } = mul(k1);
        const { p: k2p, f: k2f } = mul(k2);
        fake = k1f.add(k2f);
        point = finishEndo(endo2.beta, k1p, k2p, k1neg, k2neg);
      } else {
        const { p, f } = mul(scalar);
        point = p;
        fake = f;
      }
      return normalizeZ(Point, [point, fake])[0];
    }
    multiplyUnsafe(sc) {
      const { endo: endo2 } = extraOpts;
      const p = this;
      if (!Fn.isValid(sc))
        throw new Error("invalid scalar: out of range");
      if (sc === _0n4 || p.is0())
        return Point.ZERO;
      if (sc === _1n4)
        return p;
      if (wnaf.hasCache(this))
        return this.multiply(sc);
      if (endo2) {
        const { k1neg, k1, k2neg, k2 } = splitEndoScalarN(sc);
        const { p1, p2 } = mulEndoUnsafe(Point, p, k1, k2);
        return finishEndo(endo2.beta, p1, p2, k1neg, k2neg);
      } else {
        return wnaf.unsafe(p, sc);
      }
    }
    multiplyAndAddUnsafe(Q, a, b) {
      const sum = this.multiplyUnsafe(a).add(Q.multiplyUnsafe(b));
      return sum.is0() ? undefined : sum;
    }
    toAffine(invertedZ) {
      return toAffineMemo(this, invertedZ);
    }
    isTorsionFree() {
      const { isTorsionFree } = extraOpts;
      if (cofactor === _1n4)
        return true;
      if (isTorsionFree)
        return isTorsionFree(Point, this);
      return wnaf.unsafe(this, CURVE_ORDER).is0();
    }
    clearCofactor() {
      const { clearCofactor } = extraOpts;
      if (cofactor === _1n4)
        return this;
      if (clearCofactor)
        return clearCofactor(Point, this);
      return this.multiplyUnsafe(cofactor);
    }
    isSmallOrder() {
      return this.multiplyUnsafe(cofactor).is0();
    }
    toBytes(isCompressed = true) {
      _abool2(isCompressed, "isCompressed");
      this.assertValidity();
      return encodePoint(Point, this, isCompressed);
    }
    toHex(isCompressed = true) {
      return bytesToHex(this.toBytes(isCompressed));
    }
    toString() {
      return `<Point ${this.is0() ? "ZERO" : this.toHex()}>`;
    }
    get px() {
      return this.X;
    }
    get py() {
      return this.X;
    }
    get pz() {
      return this.Z;
    }
    toRawBytes(isCompressed = true) {
      return this.toBytes(isCompressed);
    }
    _setWindowSize(windowSize) {
      this.precompute(windowSize);
    }
    static normalizeZ(points) {
      return normalizeZ(Point, points);
    }
    static msm(points, scalars) {
      return pippenger(Point, Fn, points, scalars);
    }
    static fromPrivateKey(privateKey) {
      return Point.BASE.multiply(_normFnElement(Fn, privateKey));
    }
  }
  Point.BASE = new Point(CURVE.Gx, CURVE.Gy, Fp.ONE);
  Point.ZERO = new Point(Fp.ZERO, Fp.ONE, Fp.ZERO);
  Point.Fp = Fp;
  Point.Fn = Fn;
  const bits = Fn.BITS;
  const wnaf = new wNAF(Point, extraOpts.endo ? Math.ceil(bits / 2) : bits);
  Point.BASE.precompute(8);
  return Point;
}
function pprefix(hasEvenY) {
  return Uint8Array.of(hasEvenY ? 2 : 3);
}
function SWUFpSqrtRatio(Fp, Z) {
  const q = Fp.ORDER;
  let l = _0n4;
  for (let o = q - _1n4;o % _2n2 === _0n4; o /= _2n2)
    l += _1n4;
  const c1 = l;
  const _2n_pow_c1_1 = _2n2 << c1 - _1n4 - _1n4;
  const _2n_pow_c1 = _2n_pow_c1_1 * _2n2;
  const c2 = (q - _1n4) / _2n_pow_c1;
  const c3 = (c2 - _1n4) / _2n2;
  const c4 = _2n_pow_c1 - _1n4;
  const c5 = _2n_pow_c1_1;
  const c6 = Fp.pow(Z, c2);
  const c7 = Fp.pow(Z, (c2 + _1n4) / _2n2);
  let sqrtRatio = (u, v) => {
    let tv1 = c6;
    let tv2 = Fp.pow(v, c4);
    let tv3 = Fp.sqr(tv2);
    tv3 = Fp.mul(tv3, v);
    let tv5 = Fp.mul(u, tv3);
    tv5 = Fp.pow(tv5, c3);
    tv5 = Fp.mul(tv5, tv2);
    tv2 = Fp.mul(tv5, v);
    tv3 = Fp.mul(tv5, u);
    let tv4 = Fp.mul(tv3, tv2);
    tv5 = Fp.pow(tv4, c5);
    let isQR = Fp.eql(tv5, Fp.ONE);
    tv2 = Fp.mul(tv3, c7);
    tv5 = Fp.mul(tv4, tv1);
    tv3 = Fp.cmov(tv2, tv3, isQR);
    tv4 = Fp.cmov(tv5, tv4, isQR);
    for (let i = c1;i > _1n4; i--) {
      let tv52 = i - _2n2;
      tv52 = _2n2 << tv52 - _1n4;
      let tvv5 = Fp.pow(tv4, tv52);
      const e1 = Fp.eql(tvv5, Fp.ONE);
      tv2 = Fp.mul(tv3, tv1);
      tv1 = Fp.mul(tv1, tv1);
      tvv5 = Fp.mul(tv4, tv1);
      tv3 = Fp.cmov(tv2, tv3, e1);
      tv4 = Fp.cmov(tvv5, tv4, e1);
    }
    return { isValid: isQR, value: tv3 };
  };
  if (Fp.ORDER % _4n2 === _3n2) {
    const c12 = (Fp.ORDER - _3n2) / _4n2;
    const c22 = Fp.sqrt(Fp.neg(Z));
    sqrtRatio = (u, v) => {
      let tv1 = Fp.sqr(v);
      const tv2 = Fp.mul(u, v);
      tv1 = Fp.mul(tv1, tv2);
      let y1 = Fp.pow(tv1, c12);
      y1 = Fp.mul(y1, tv2);
      const y2 = Fp.mul(y1, c22);
      const tv3 = Fp.mul(Fp.sqr(y1), v);
      const isQR = Fp.eql(tv3, u);
      let y = Fp.cmov(y2, y1, isQR);
      return { isValid: isQR, value: y };
    };
  }
  return sqrtRatio;
}
function mapToCurveSimpleSWU(Fp, opts) {
  validateField(Fp);
  const { A, B, Z } = opts;
  if (!Fp.isValid(A) || !Fp.isValid(B) || !Fp.isValid(Z))
    throw new Error("mapToCurveSimpleSWU: invalid opts");
  const sqrtRatio = SWUFpSqrtRatio(Fp, Z);
  if (!Fp.isOdd)
    throw new Error("Field does not have .isOdd()");
  return (u) => {
    let tv1, tv2, tv3, tv4, tv5, tv6, x, y;
    tv1 = Fp.sqr(u);
    tv1 = Fp.mul(tv1, Z);
    tv2 = Fp.sqr(tv1);
    tv2 = Fp.add(tv2, tv1);
    tv3 = Fp.add(tv2, Fp.ONE);
    tv3 = Fp.mul(tv3, B);
    tv4 = Fp.cmov(Z, Fp.neg(tv2), !Fp.eql(tv2, Fp.ZERO));
    tv4 = Fp.mul(tv4, A);
    tv2 = Fp.sqr(tv3);
    tv6 = Fp.sqr(tv4);
    tv5 = Fp.mul(tv6, A);
    tv2 = Fp.add(tv2, tv5);
    tv2 = Fp.mul(tv2, tv3);
    tv6 = Fp.mul(tv6, tv4);
    tv5 = Fp.mul(tv6, B);
    tv2 = Fp.add(tv2, tv5);
    x = Fp.mul(tv1, tv3);
    const { isValid, value } = sqrtRatio(tv2, tv6);
    y = Fp.mul(tv1, u);
    y = Fp.mul(y, value);
    x = Fp.cmov(x, tv3, isValid);
    y = Fp.cmov(y, value, isValid);
    const e1 = Fp.isOdd(u) === Fp.isOdd(y);
    y = Fp.cmov(Fp.neg(y), y, e1);
    const tv4_inv = FpInvertBatch(Fp, [tv4], true)[0];
    x = Fp.mul(x, tv4_inv);
    return { x, y };
  };
}
function getWLengths(Fp, Fn) {
  return {
    secretKey: Fn.BYTES,
    publicKey: 1 + Fp.BYTES,
    publicKeyUncompressed: 1 + 2 * Fp.BYTES,
    publicKeyHasPrefix: true,
    signature: 2 * Fn.BYTES
  };
}
function ecdh(Point, ecdhOpts = {}) {
  const { Fn } = Point;
  const randomBytes_ = ecdhOpts.randomBytes || randomBytes;
  const lengths = Object.assign(getWLengths(Point.Fp, Fn), { seed: getMinHashLength(Fn.ORDER) });
  function isValidSecretKey(secretKey) {
    try {
      return !!_normFnElement(Fn, secretKey);
    } catch (error) {
      return false;
    }
  }
  function isValidPublicKey(publicKey, isCompressed) {
    const { publicKey: comp, publicKeyUncompressed } = lengths;
    try {
      const l = publicKey.length;
      if (isCompressed === true && l !== comp)
        return false;
      if (isCompressed === false && l !== publicKeyUncompressed)
        return false;
      return !!Point.fromBytes(publicKey);
    } catch (error) {
      return false;
    }
  }
  function randomSecretKey(seed = randomBytes_(lengths.seed)) {
    return mapHashToField(_abytes2(seed, lengths.seed, "seed"), Fn.ORDER);
  }
  function getPublicKey(secretKey, isCompressed = true) {
    return Point.BASE.multiply(_normFnElement(Fn, secretKey)).toBytes(isCompressed);
  }
  function keygen(seed) {
    const secretKey = randomSecretKey(seed);
    return { secretKey, publicKey: getPublicKey(secretKey) };
  }
  function isProbPub(item) {
    if (typeof item === "bigint")
      return false;
    if (item instanceof Point)
      return true;
    const { secretKey, publicKey, publicKeyUncompressed } = lengths;
    if (Fn.allowedLengths || secretKey === publicKey)
      return;
    const l = ensureBytes("key", item).length;
    return l === publicKey || l === publicKeyUncompressed;
  }
  function getSharedSecret(secretKeyA, publicKeyB, isCompressed = true) {
    if (isProbPub(secretKeyA) === true)
      throw new Error("first arg must be private key");
    if (isProbPub(publicKeyB) === false)
      throw new Error("second arg must be public key");
    const s = _normFnElement(Fn, secretKeyA);
    const b = Point.fromHex(publicKeyB);
    return b.multiply(s).toBytes(isCompressed);
  }
  const utils = {
    isValidSecretKey,
    isValidPublicKey,
    randomSecretKey,
    isValidPrivateKey: isValidSecretKey,
    randomPrivateKey: randomSecretKey,
    normPrivateKeyToScalar: (key) => _normFnElement(Fn, key),
    precompute(windowSize = 8, point = Point.BASE) {
      return point.precompute(windowSize, false);
    }
  };
  return Object.freeze({ getPublicKey, getSharedSecret, keygen, Point, utils, lengths });
}
function ecdsa(Point, hash, ecdsaOpts = {}) {
  ahash(hash);
  _validateObject(ecdsaOpts, {}, {
    hmac: "function",
    lowS: "boolean",
    randomBytes: "function",
    bits2int: "function",
    bits2int_modN: "function"
  });
  const randomBytes2 = ecdsaOpts.randomBytes || randomBytes;
  const hmac2 = ecdsaOpts.hmac || ((key, ...msgs) => hmac(hash, key, concatBytes(...msgs)));
  const { Fp, Fn } = Point;
  const { ORDER: CURVE_ORDER, BITS: fnBits } = Fn;
  const { keygen, getPublicKey, getSharedSecret, utils, lengths } = ecdh(Point, ecdsaOpts);
  const defaultSigOpts = {
    prehash: false,
    lowS: typeof ecdsaOpts.lowS === "boolean" ? ecdsaOpts.lowS : false,
    format: undefined,
    extraEntropy: false
  };
  const defaultSigOpts_format = "compact";
  function isBiggerThanHalfOrder(number) {
    const HALF = CURVE_ORDER >> _1n4;
    return number > HALF;
  }
  function validateRS(title, num) {
    if (!Fn.isValidNot0(num))
      throw new Error(`invalid signature ${title}: out of range 1..Point.Fn.ORDER`);
    return num;
  }
  function validateSigLength(bytes, format) {
    validateSigFormat(format);
    const size = lengths.signature;
    const sizer = format === "compact" ? size : format === "recovered" ? size + 1 : undefined;
    return _abytes2(bytes, sizer, `${format} signature`);
  }

  class Signature {
    constructor(r, s, recovery) {
      this.r = validateRS("r", r);
      this.s = validateRS("s", s);
      if (recovery != null)
        this.recovery = recovery;
      Object.freeze(this);
    }
    static fromBytes(bytes, format = defaultSigOpts_format) {
      validateSigLength(bytes, format);
      let recid;
      if (format === "der") {
        const { r: r2, s: s2 } = DER.toSig(_abytes2(bytes));
        return new Signature(r2, s2);
      }
      if (format === "recovered") {
        recid = bytes[0];
        format = "compact";
        bytes = bytes.subarray(1);
      }
      const L = Fn.BYTES;
      const r = bytes.subarray(0, L);
      const s = bytes.subarray(L, L * 2);
      return new Signature(Fn.fromBytes(r), Fn.fromBytes(s), recid);
    }
    static fromHex(hex, format) {
      return this.fromBytes(hexToBytes(hex), format);
    }
    addRecoveryBit(recovery) {
      return new Signature(this.r, this.s, recovery);
    }
    recoverPublicKey(messageHash) {
      const FIELD_ORDER = Fp.ORDER;
      const { r, s, recovery: rec } = this;
      if (rec == null || ![0, 1, 2, 3].includes(rec))
        throw new Error("recovery id invalid");
      const hasCofactor = CURVE_ORDER * _2n2 < FIELD_ORDER;
      if (hasCofactor && rec > 1)
        throw new Error("recovery id is ambiguous for h>1 curve");
      const radj = rec === 2 || rec === 3 ? r + CURVE_ORDER : r;
      if (!Fp.isValid(radj))
        throw new Error("recovery id 2 or 3 invalid");
      const x = Fp.toBytes(radj);
      const R = Point.fromBytes(concatBytes(pprefix((rec & 1) === 0), x));
      const ir = Fn.inv(radj);
      const h = bits2int_modN(ensureBytes("msgHash", messageHash));
      const u1 = Fn.create(-h * ir);
      const u2 = Fn.create(s * ir);
      const Q = Point.BASE.multiplyUnsafe(u1).add(R.multiplyUnsafe(u2));
      if (Q.is0())
        throw new Error("point at infinify");
      Q.assertValidity();
      return Q;
    }
    hasHighS() {
      return isBiggerThanHalfOrder(this.s);
    }
    toBytes(format = defaultSigOpts_format) {
      validateSigFormat(format);
      if (format === "der")
        return hexToBytes(DER.hexFromSig(this));
      const r = Fn.toBytes(this.r);
      const s = Fn.toBytes(this.s);
      if (format === "recovered") {
        if (this.recovery == null)
          throw new Error("recovery bit must be present");
        return concatBytes(Uint8Array.of(this.recovery), r, s);
      }
      return concatBytes(r, s);
    }
    toHex(format) {
      return bytesToHex(this.toBytes(format));
    }
    assertValidity() {}
    static fromCompact(hex) {
      return Signature.fromBytes(ensureBytes("sig", hex), "compact");
    }
    static fromDER(hex) {
      return Signature.fromBytes(ensureBytes("sig", hex), "der");
    }
    normalizeS() {
      return this.hasHighS() ? new Signature(this.r, Fn.neg(this.s), this.recovery) : this;
    }
    toDERRawBytes() {
      return this.toBytes("der");
    }
    toDERHex() {
      return bytesToHex(this.toBytes("der"));
    }
    toCompactRawBytes() {
      return this.toBytes("compact");
    }
    toCompactHex() {
      return bytesToHex(this.toBytes("compact"));
    }
  }
  const bits2int = ecdsaOpts.bits2int || function bits2int_def(bytes) {
    if (bytes.length > 8192)
      throw new Error("input is too large");
    const num = bytesToNumberBE(bytes);
    const delta = bytes.length * 8 - fnBits;
    return delta > 0 ? num >> BigInt(delta) : num;
  };
  const bits2int_modN = ecdsaOpts.bits2int_modN || function bits2int_modN_def(bytes) {
    return Fn.create(bits2int(bytes));
  };
  const ORDER_MASK = bitMask(fnBits);
  function int2octets(num) {
    aInRange("num < 2^" + fnBits, num, _0n4, ORDER_MASK);
    return Fn.toBytes(num);
  }
  function validateMsgAndHash(message, prehash) {
    _abytes2(message, undefined, "message");
    return prehash ? _abytes2(hash(message), undefined, "prehashed message") : message;
  }
  function prepSig(message, privateKey, opts) {
    if (["recovered", "canonical"].some((k) => (k in opts)))
      throw new Error("sign() legacy options not supported");
    const { lowS, prehash, extraEntropy } = validateSigOpts(opts, defaultSigOpts);
    message = validateMsgAndHash(message, prehash);
    const h1int = bits2int_modN(message);
    const d = _normFnElement(Fn, privateKey);
    const seedArgs = [int2octets(d), int2octets(h1int)];
    if (extraEntropy != null && extraEntropy !== false) {
      const e = extraEntropy === true ? randomBytes2(lengths.secretKey) : extraEntropy;
      seedArgs.push(ensureBytes("extraEntropy", e));
    }
    const seed = concatBytes(...seedArgs);
    const m = h1int;
    function k2sig(kBytes) {
      const k = bits2int(kBytes);
      if (!Fn.isValidNot0(k))
        return;
      const ik = Fn.inv(k);
      const q = Point.BASE.multiply(k).toAffine();
      const r = Fn.create(q.x);
      if (r === _0n4)
        return;
      const s = Fn.create(ik * Fn.create(m + r * d));
      if (s === _0n4)
        return;
      let recovery = (q.x === r ? 0 : 2) | Number(q.y & _1n4);
      let normS = s;
      if (lowS && isBiggerThanHalfOrder(s)) {
        normS = Fn.neg(s);
        recovery ^= 1;
      }
      return new Signature(r, normS, recovery);
    }
    return { seed, k2sig };
  }
  function sign(message, secretKey, opts = {}) {
    message = ensureBytes("message", message);
    const { seed, k2sig } = prepSig(message, secretKey, opts);
    const drbg = createHmacDrbg(hash.outputLen, Fn.BYTES, hmac2);
    const sig = drbg(seed, k2sig);
    return sig;
  }
  function tryParsingSig(sg) {
    let sig = undefined;
    const isHex = typeof sg === "string" || isBytes(sg);
    const isObj = !isHex && sg !== null && typeof sg === "object" && typeof sg.r === "bigint" && typeof sg.s === "bigint";
    if (!isHex && !isObj)
      throw new Error("invalid signature, expected Uint8Array, hex string or Signature instance");
    if (isObj) {
      sig = new Signature(sg.r, sg.s);
    } else if (isHex) {
      try {
        sig = Signature.fromBytes(ensureBytes("sig", sg), "der");
      } catch (derError) {
        if (!(derError instanceof DER.Err))
          throw derError;
      }
      if (!sig) {
        try {
          sig = Signature.fromBytes(ensureBytes("sig", sg), "compact");
        } catch (error) {
          return false;
        }
      }
    }
    if (!sig)
      return false;
    return sig;
  }
  function verify(signature, message, publicKey, opts = {}) {
    const { lowS, prehash, format } = validateSigOpts(opts, defaultSigOpts);
    publicKey = ensureBytes("publicKey", publicKey);
    message = validateMsgAndHash(ensureBytes("message", message), prehash);
    if ("strict" in opts)
      throw new Error("options.strict was renamed to lowS");
    const sig = format === undefined ? tryParsingSig(signature) : Signature.fromBytes(ensureBytes("sig", signature), format);
    if (sig === false)
      return false;
    try {
      const P = Point.fromBytes(publicKey);
      if (lowS && sig.hasHighS())
        return false;
      const { r, s } = sig;
      const h = bits2int_modN(message);
      const is = Fn.inv(s);
      const u1 = Fn.create(h * is);
      const u2 = Fn.create(r * is);
      const R = Point.BASE.multiplyUnsafe(u1).add(P.multiplyUnsafe(u2));
      if (R.is0())
        return false;
      const v = Fn.create(R.x);
      return v === r;
    } catch (e) {
      return false;
    }
  }
  function recoverPublicKey(signature, message, opts = {}) {
    const { prehash } = validateSigOpts(opts, defaultSigOpts);
    message = validateMsgAndHash(message, prehash);
    return Signature.fromBytes(signature, "recovered").recoverPublicKey(message).toBytes();
  }
  return Object.freeze({
    keygen,
    getPublicKey,
    getSharedSecret,
    utils,
    lengths,
    Point,
    sign,
    verify,
    recoverPublicKey,
    Signature,
    hash
  });
}
function _weierstrass_legacy_opts_to_new(c) {
  const CURVE = {
    a: c.a,
    b: c.b,
    p: c.Fp.ORDER,
    n: c.n,
    h: c.h,
    Gx: c.Gx,
    Gy: c.Gy
  };
  const Fp = c.Fp;
  let allowedLengths = c.allowedPrivateKeyLengths ? Array.from(new Set(c.allowedPrivateKeyLengths.map((l) => Math.ceil(l / 2)))) : undefined;
  const Fn = Field(CURVE.n, {
    BITS: c.nBitLength,
    allowedLengths,
    modFromBytes: c.wrapPrivateKey
  });
  const curveOpts = {
    Fp,
    Fn,
    allowInfinityPoint: c.allowInfinityPoint,
    endo: c.endo,
    isTorsionFree: c.isTorsionFree,
    clearCofactor: c.clearCofactor,
    fromBytes: c.fromBytes,
    toBytes: c.toBytes
  };
  return { CURVE, curveOpts };
}
function _ecdsa_legacy_opts_to_new(c) {
  const { CURVE, curveOpts } = _weierstrass_legacy_opts_to_new(c);
  const ecdsaOpts = {
    hmac: c.hmac,
    randomBytes: c.randomBytes,
    lowS: c.lowS,
    bits2int: c.bits2int,
    bits2int_modN: c.bits2int_modN
  };
  return { CURVE, curveOpts, hash: c.hash, ecdsaOpts };
}
function _ecdsa_new_output_to_legacy(c, _ecdsa) {
  const Point = _ecdsa.Point;
  return Object.assign({}, _ecdsa, {
    ProjectivePoint: Point,
    CURVE: Object.assign({}, c, nLength(Point.Fn.ORDER, Point.Fn.BITS))
  });
}
function weierstrass(c) {
  const { CURVE, curveOpts, hash, ecdsaOpts } = _ecdsa_legacy_opts_to_new(c);
  const Point = weierstrassN(CURVE, curveOpts);
  const signs = ecdsa(Point, hash, ecdsaOpts);
  return _ecdsa_new_output_to_legacy(c, signs);
}

// ../../../../node_modules/.bun/@noble+curves@1.9.7/node_modules/@noble/curves/esm/_shortw_utils.js
/*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) */
function createCurve(curveDef, defHash) {
  const create = (hash) => weierstrass({ ...curveDef, hash });
  return { ...create(defHash), create };
}

// ../../../../node_modules/.bun/@noble+curves@1.9.7/node_modules/@noble/curves/esm/abstract/hash-to-curve.js
var os2ip = bytesToNumberBE;
function i2osp(value, length) {
  anum(value);
  anum(length);
  if (value < 0 || value >= 1 << 8 * length)
    throw new Error("invalid I2OSP input: " + value);
  const res = Array.from({ length }).fill(0);
  for (let i = length - 1;i >= 0; i--) {
    res[i] = value & 255;
    value >>>= 8;
  }
  return new Uint8Array(res);
}
function strxor(a, b) {
  const arr = new Uint8Array(a.length);
  for (let i = 0;i < a.length; i++) {
    arr[i] = a[i] ^ b[i];
  }
  return arr;
}
function anum(item) {
  if (!Number.isSafeInteger(item))
    throw new Error("number expected");
}
function normDST(DST) {
  if (!isBytes(DST) && typeof DST !== "string")
    throw new Error("DST must be Uint8Array or string");
  return typeof DST === "string" ? utf8ToBytes(DST) : DST;
}
function expand_message_xmd(msg, DST, lenInBytes, H) {
  abytes(msg);
  anum(lenInBytes);
  DST = normDST(DST);
  if (DST.length > 255)
    DST = H(concatBytes(utf8ToBytes("H2C-OVERSIZE-DST-"), DST));
  const { outputLen: b_in_bytes, blockLen: r_in_bytes } = H;
  const ell = Math.ceil(lenInBytes / b_in_bytes);
  if (lenInBytes > 65535 || ell > 255)
    throw new Error("expand_message_xmd: invalid lenInBytes");
  const DST_prime = concatBytes(DST, i2osp(DST.length, 1));
  const Z_pad = i2osp(0, r_in_bytes);
  const l_i_b_str = i2osp(lenInBytes, 2);
  const b = new Array(ell);
  const b_0 = H(concatBytes(Z_pad, msg, l_i_b_str, i2osp(0, 1), DST_prime));
  b[0] = H(concatBytes(b_0, i2osp(1, 1), DST_prime));
  for (let i = 1;i <= ell; i++) {
    const args = [strxor(b_0, b[i - 1]), i2osp(i + 1, 1), DST_prime];
    b[i] = H(concatBytes(...args));
  }
  const pseudo_random_bytes = concatBytes(...b);
  return pseudo_random_bytes.slice(0, lenInBytes);
}
function expand_message_xof(msg, DST, lenInBytes, k, H) {
  abytes(msg);
  anum(lenInBytes);
  DST = normDST(DST);
  if (DST.length > 255) {
    const dkLen = Math.ceil(2 * k / 8);
    DST = H.create({ dkLen }).update(utf8ToBytes("H2C-OVERSIZE-DST-")).update(DST).digest();
  }
  if (lenInBytes > 65535 || DST.length > 255)
    throw new Error("expand_message_xof: invalid lenInBytes");
  return H.create({ dkLen: lenInBytes }).update(msg).update(i2osp(lenInBytes, 2)).update(DST).update(i2osp(DST.length, 1)).digest();
}
function hash_to_field(msg, count, options) {
  _validateObject(options, {
    p: "bigint",
    m: "number",
    k: "number",
    hash: "function"
  });
  const { p, k, m, hash, expand, DST } = options;
  if (!isHash(options.hash))
    throw new Error("expected valid hash");
  abytes(msg);
  anum(count);
  const log2p = p.toString(2).length;
  const L = Math.ceil((log2p + k) / 8);
  const len_in_bytes = count * m * L;
  let prb;
  if (expand === "xmd") {
    prb = expand_message_xmd(msg, DST, len_in_bytes, hash);
  } else if (expand === "xof") {
    prb = expand_message_xof(msg, DST, len_in_bytes, k, hash);
  } else if (expand === "_internal_pass") {
    prb = msg;
  } else {
    throw new Error('expand must be "xmd" or "xof"');
  }
  const u = new Array(count);
  for (let i = 0;i < count; i++) {
    const e = new Array(m);
    for (let j = 0;j < m; j++) {
      const elm_offset = L * (j + i * m);
      const tv = prb.subarray(elm_offset, elm_offset + L);
      e[j] = mod(os2ip(tv), p);
    }
    u[i] = e;
  }
  return u;
}
function isogenyMap(field, map) {
  const coeff = map.map((i) => Array.from(i).reverse());
  return (x, y) => {
    const [xn, xd, yn, yd] = coeff.map((val) => val.reduce((acc, i) => field.add(field.mul(acc, x), i)));
    const [xd_inv, yd_inv] = FpInvertBatch(field, [xd, yd], true);
    x = field.mul(xn, xd_inv);
    y = field.mul(y, field.mul(yn, yd_inv));
    return { x, y };
  };
}
var _DST_scalar = utf8ToBytes("HashToScalar-");
function createHasher2(Point, mapToCurve, defaults) {
  if (typeof mapToCurve !== "function")
    throw new Error("mapToCurve() must be defined");
  function map(num) {
    return Point.fromAffine(mapToCurve(num));
  }
  function clear(initial) {
    const P = initial.clearCofactor();
    if (P.equals(Point.ZERO))
      return Point.ZERO;
    P.assertValidity();
    return P;
  }
  return {
    defaults,
    hashToCurve(msg, options) {
      const opts = Object.assign({}, defaults, options);
      const u = hash_to_field(msg, 2, opts);
      const u0 = map(u[0]);
      const u1 = map(u[1]);
      return clear(u0.add(u1));
    },
    encodeToCurve(msg, options) {
      const optsDst = defaults.encodeDST ? { DST: defaults.encodeDST } : {};
      const opts = Object.assign({}, defaults, optsDst, options);
      const u = hash_to_field(msg, 1, opts);
      const u0 = map(u[0]);
      return clear(u0);
    },
    mapToCurve(scalars) {
      if (!Array.isArray(scalars))
        throw new Error("expected array of bigints");
      for (const i of scalars)
        if (typeof i !== "bigint")
          throw new Error("expected array of bigints");
      return clear(map(scalars));
    },
    hashToScalar(msg, options) {
      const N = Point.Fn.ORDER;
      const opts = Object.assign({}, defaults, { p: N, m: 1, DST: _DST_scalar }, options);
      return hash_to_field(msg, 1, opts)[0][0];
    }
  };
}

// ../../../../node_modules/.bun/@noble+curves@1.9.7/node_modules/@noble/curves/esm/secp256k1.js
/*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) */
var secp256k1_CURVE = {
  p: BigInt("0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2f"),
  n: BigInt("0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141"),
  h: BigInt(1),
  a: BigInt(0),
  b: BigInt(7),
  Gx: BigInt("0x79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798"),
  Gy: BigInt("0x483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8")
};
var secp256k1_ENDO = {
  beta: BigInt("0x7ae96a2b657c07106e64479eac3434e99cf0497512f58995c1396c28719501ee"),
  basises: [
    [BigInt("0x3086d221a7d46bcde86c90e49284eb15"), -BigInt("0xe4437ed6010e88286f547fa90abfe4c3")],
    [BigInt("0x114ca50f7a8e2f3f657c1108d9d44cfd8"), BigInt("0x3086d221a7d46bcde86c90e49284eb15")]
  ]
};
var _0n5 = /* @__PURE__ */ BigInt(0);
var _1n5 = /* @__PURE__ */ BigInt(1);
var _2n3 = /* @__PURE__ */ BigInt(2);
function sqrtMod(y) {
  const P = secp256k1_CURVE.p;
  const _3n3 = BigInt(3), _6n = BigInt(6), _11n = BigInt(11), _22n = BigInt(22);
  const _23n = BigInt(23), _44n = BigInt(44), _88n = BigInt(88);
  const b2 = y * y * y % P;
  const b3 = b2 * b2 * y % P;
  const b6 = pow2(b3, _3n3, P) * b3 % P;
  const b9 = pow2(b6, _3n3, P) * b3 % P;
  const b11 = pow2(b9, _2n3, P) * b2 % P;
  const b22 = pow2(b11, _11n, P) * b11 % P;
  const b44 = pow2(b22, _22n, P) * b22 % P;
  const b88 = pow2(b44, _44n, P) * b44 % P;
  const b176 = pow2(b88, _88n, P) * b88 % P;
  const b220 = pow2(b176, _44n, P) * b44 % P;
  const b223 = pow2(b220, _3n3, P) * b3 % P;
  const t1 = pow2(b223, _23n, P) * b22 % P;
  const t2 = pow2(t1, _6n, P) * b2 % P;
  const root = pow2(t2, _2n3, P);
  if (!Fpk1.eql(Fpk1.sqr(root), y))
    throw new Error("Cannot find square root");
  return root;
}
var Fpk1 = Field(secp256k1_CURVE.p, { sqrt: sqrtMod });
var secp256k1 = createCurve({ ...secp256k1_CURVE, Fp: Fpk1, lowS: true, endo: secp256k1_ENDO }, sha256);
var TAGGED_HASH_PREFIXES = {};
function taggedHash(tag, ...messages) {
  let tagP = TAGGED_HASH_PREFIXES[tag];
  if (tagP === undefined) {
    const tagH = sha256(utf8ToBytes(tag));
    tagP = concatBytes(tagH, tagH);
    TAGGED_HASH_PREFIXES[tag] = tagP;
  }
  return sha256(concatBytes(tagP, ...messages));
}
var pointToBytes = (point) => point.toBytes(true).slice(1);
var Pointk1 = /* @__PURE__ */ (() => secp256k1.Point)();
var hasEven = (y) => y % _2n3 === _0n5;
function schnorrGetExtPubKey(priv) {
  const { Fn, BASE } = Pointk1;
  const d_ = _normFnElement(Fn, priv);
  const p = BASE.multiply(d_);
  const scalar = hasEven(p.y) ? d_ : Fn.neg(d_);
  return { scalar, bytes: pointToBytes(p) };
}
function lift_x(x) {
  const Fp = Fpk1;
  if (!Fp.isValidNot0(x))
    throw new Error("invalid x: Fail if x ≥ p");
  const xx = Fp.create(x * x);
  const c = Fp.create(xx * x + BigInt(7));
  let y = Fp.sqrt(c);
  if (!hasEven(y))
    y = Fp.neg(y);
  const p = Pointk1.fromAffine({ x, y });
  p.assertValidity();
  return p;
}
var num = bytesToNumberBE;
function challenge(...args) {
  return Pointk1.Fn.create(num(taggedHash("BIP0340/challenge", ...args)));
}
function schnorrGetPublicKey(secretKey) {
  return schnorrGetExtPubKey(secretKey).bytes;
}
function schnorrSign(message, secretKey, auxRand = randomBytes(32)) {
  const { Fn } = Pointk1;
  const m = ensureBytes("message", message);
  const { bytes: px, scalar: d } = schnorrGetExtPubKey(secretKey);
  const a = ensureBytes("auxRand", auxRand, 32);
  const t = Fn.toBytes(d ^ num(taggedHash("BIP0340/aux", a)));
  const rand = taggedHash("BIP0340/nonce", t, px, m);
  const { bytes: rx, scalar: k } = schnorrGetExtPubKey(rand);
  const e = challenge(rx, px, m);
  const sig = new Uint8Array(64);
  sig.set(rx, 0);
  sig.set(Fn.toBytes(Fn.create(k + e * d)), 32);
  if (!schnorrVerify(sig, m, px))
    throw new Error("sign: Invalid signature produced");
  return sig;
}
function schnorrVerify(signature, message, publicKey) {
  const { Fn, BASE } = Pointk1;
  const sig = ensureBytes("signature", signature, 64);
  const m = ensureBytes("message", message);
  const pub = ensureBytes("publicKey", publicKey, 32);
  try {
    const P = lift_x(num(pub));
    const r = num(sig.subarray(0, 32));
    if (!inRange(r, _1n5, secp256k1_CURVE.p))
      return false;
    const s = num(sig.subarray(32, 64));
    if (!inRange(s, _1n5, secp256k1_CURVE.n))
      return false;
    const e = challenge(Fn.toBytes(r), pointToBytes(P), m);
    const R = BASE.multiplyUnsafe(s).add(P.multiplyUnsafe(Fn.neg(e)));
    const { x, y } = R.toAffine();
    if (R.is0() || !hasEven(y) || x !== r)
      return false;
    return true;
  } catch (error) {
    return false;
  }
}
var schnorr = /* @__PURE__ */ (() => {
  const size = 32;
  const seedLength = 48;
  const randomSecretKey = (seed = randomBytes(seedLength)) => {
    return mapHashToField(seed, secp256k1_CURVE.n);
  };
  secp256k1.utils.randomSecretKey;
  function keygen(seed) {
    const secretKey = randomSecretKey(seed);
    return { secretKey, publicKey: schnorrGetPublicKey(secretKey) };
  }
  return {
    keygen,
    getPublicKey: schnorrGetPublicKey,
    sign: schnorrSign,
    verify: schnorrVerify,
    Point: Pointk1,
    utils: {
      randomSecretKey,
      randomPrivateKey: randomSecretKey,
      taggedHash,
      lift_x,
      pointToBytes,
      numberToBytesBE,
      bytesToNumberBE,
      mod
    },
    lengths: {
      secretKey: size,
      publicKey: size,
      publicKeyHasPrefix: false,
      signature: size * 2,
      seed: seedLength
    }
  };
})();
var isoMap = /* @__PURE__ */ (() => isogenyMap(Fpk1, [
  [
    "0x8e38e38e38e38e38e38e38e38e38e38e38e38e38e38e38e38e38e38daaaaa8c7",
    "0x7d3d4c80bc321d5b9f315cea7fd44c5d595d2fc0bf63b92dfff1044f17c6581",
    "0x534c328d23f234e6e2a413deca25caece4506144037c40314ecbd0b53d9dd262",
    "0x8e38e38e38e38e38e38e38e38e38e38e38e38e38e38e38e38e38e38daaaaa88c"
  ],
  [
    "0xd35771193d94918a9ca34ccbb7b640dd86cd409542f8487d9fe6b745781eb49b",
    "0xedadc6f64383dc1df7c4b2d51b54225406d36b641f5e41bbc52a56612a8c6d14",
    "0x0000000000000000000000000000000000000000000000000000000000000001"
  ],
  [
    "0x4bda12f684bda12f684bda12f684bda12f684bda12f684bda12f684b8e38e23c",
    "0xc75e0c32d5cb7c0fa9d0a54b12a0a6d5647ab046d686da6fdffc90fc201d71a3",
    "0x29a6194691f91a73715209ef6512e576722830a201be2018a765e85a9ecee931",
    "0x2f684bda12f684bda12f684bda12f684bda12f684bda12f684bda12f38e38d84"
  ],
  [
    "0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffefffff93b",
    "0x7a06534bb8bdb49fd5e9e6632722c2989467c1bfc8e8d978dfb425d2685c2573",
    "0x6484aa716545ca2cf3a70c3fa8fe337e0a3d21162f0d6299a7bf8192bfd2a76f",
    "0x0000000000000000000000000000000000000000000000000000000000000001"
  ]
].map((i) => i.map((j) => BigInt(j)))))();
var mapSWU = /* @__PURE__ */ (() => mapToCurveSimpleSWU(Fpk1, {
  A: BigInt("0x3f8731abdd661adca08a5558f0f5d272e953d363cb6f0e5d405447c01a444533"),
  B: BigInt("1771"),
  Z: Fpk1.create(BigInt("-11"))
}))();
var secp256k1_hasher = /* @__PURE__ */ (() => createHasher2(secp256k1.Point, (scalars) => {
  const { x, y } = mapSWU(Fpk1.create(scalars[0]));
  return isoMap(x, y);
}, {
  DST: "secp256k1_XMD:SHA-256_SSWU_RO_",
  encodeDST: "secp256k1_XMD:SHA-256_SSWU_NU_",
  p: Fpk1.ORDER,
  m: 1,
  k: 128,
  expand: "xmd",
  hash: sha256
}))();
var hashToCurve = /* @__PURE__ */ (() => secp256k1_hasher.hashToCurve)();
var encodeToCurve = /* @__PURE__ */ (() => secp256k1_hasher.encodeToCurve)();
export {
  secp256k1_hasher,
  secp256k1,
  schnorr,
  hashToCurve,
  encodeToCurve
};

export { sha256, secp256k1 };

//# debugId=61FCF4AFFD33598364756E2164756E21
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzLy5idW4vQG5vYmxlK2hhc2hlc0AxLjguMC9ub2RlX21vZHVsZXMvQG5vYmxlL2hhc2hlcy9lc20vX21kLmpzIiwgIi4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy8uYnVuL0Bub2JsZStoYXNoZXNAMS44LjAvbm9kZV9tb2R1bGVzL0Bub2JsZS9oYXNoZXMvZXNtL3NoYTIuanMiLCAiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzLy5idW4vQG5vYmxlK2hhc2hlc0AxLjguMC9ub2RlX21vZHVsZXMvQG5vYmxlL2hhc2hlcy9lc20vaG1hYy5qcyIsICIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvLmJ1bi9Abm9ibGUrY3VydmVzQDEuOS43L25vZGVfbW9kdWxlcy9Abm9ibGUvY3VydmVzL2VzbS91dGlscy5qcyIsICIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvLmJ1bi9Abm9ibGUrY3VydmVzQDEuOS43L25vZGVfbW9kdWxlcy9Abm9ibGUvY3VydmVzL2VzbS9hYnN0cmFjdC9tb2R1bGFyLmpzIiwgIi4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy8uYnVuL0Bub2JsZStjdXJ2ZXNAMS45Ljcvbm9kZV9tb2R1bGVzL0Bub2JsZS9jdXJ2ZXMvZXNtL2Fic3RyYWN0L2N1cnZlLmpzIiwgIi4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy8uYnVuL0Bub2JsZStjdXJ2ZXNAMS45Ljcvbm9kZV9tb2R1bGVzL0Bub2JsZS9jdXJ2ZXMvZXNtL2Fic3RyYWN0L3dlaWVyc3RyYXNzLmpzIiwgIi4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy8uYnVuL0Bub2JsZStjdXJ2ZXNAMS45Ljcvbm9kZV9tb2R1bGVzL0Bub2JsZS9jdXJ2ZXMvZXNtL19zaG9ydHdfdXRpbHMuanMiLCAiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzLy5idW4vQG5vYmxlK2N1cnZlc0AxLjkuNy9ub2RlX21vZHVsZXMvQG5vYmxlL2N1cnZlcy9lc20vYWJzdHJhY3QvaGFzaC10by1jdXJ2ZS5qcyIsICIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvLmJ1bi9Abm9ibGUrY3VydmVzQDEuOS43L25vZGVfbW9kdWxlcy9Abm9ibGUvY3VydmVzL2VzbS9zZWNwMjU2azEuanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbCiAgICAiLyoqXG4gKiBJbnRlcm5hbCBNZXJrbGUtRGFtZ2FyZCBoYXNoIHV0aWxzLlxuICogQG1vZHVsZVxuICovXG5pbXBvcnQgeyBIYXNoLCBhYnl0ZXMsIGFleGlzdHMsIGFvdXRwdXQsIGNsZWFuLCBjcmVhdGVWaWV3LCB0b0J5dGVzIH0gZnJvbSBcIi4vdXRpbHMuanNcIjtcbi8qKiBQb2x5ZmlsbCBmb3IgU2FmYXJpIDE0LiBodHRwczovL2Nhbml1c2UuY29tL21kbi1qYXZhc2NyaXB0X2J1aWx0aW5zX2RhdGF2aWV3X3NldGJpZ3VpbnQ2NCAqL1xuZXhwb3J0IGZ1bmN0aW9uIHNldEJpZ1VpbnQ2NCh2aWV3LCBieXRlT2Zmc2V0LCB2YWx1ZSwgaXNMRSkge1xuICAgIGlmICh0eXBlb2Ygdmlldy5zZXRCaWdVaW50NjQgPT09ICdmdW5jdGlvbicpXG4gICAgICAgIHJldHVybiB2aWV3LnNldEJpZ1VpbnQ2NChieXRlT2Zmc2V0LCB2YWx1ZSwgaXNMRSk7XG4gICAgY29uc3QgXzMybiA9IEJpZ0ludCgzMik7XG4gICAgY29uc3QgX3UzMl9tYXggPSBCaWdJbnQoMHhmZmZmZmZmZik7XG4gICAgY29uc3Qgd2ggPSBOdW1iZXIoKHZhbHVlID4+IF8zMm4pICYgX3UzMl9tYXgpO1xuICAgIGNvbnN0IHdsID0gTnVtYmVyKHZhbHVlICYgX3UzMl9tYXgpO1xuICAgIGNvbnN0IGggPSBpc0xFID8gNCA6IDA7XG4gICAgY29uc3QgbCA9IGlzTEUgPyAwIDogNDtcbiAgICB2aWV3LnNldFVpbnQzMihieXRlT2Zmc2V0ICsgaCwgd2gsIGlzTEUpO1xuICAgIHZpZXcuc2V0VWludDMyKGJ5dGVPZmZzZXQgKyBsLCB3bCwgaXNMRSk7XG59XG4vKiogQ2hvaWNlOiBhID8gYiA6IGMgKi9cbmV4cG9ydCBmdW5jdGlvbiBDaGkoYSwgYiwgYykge1xuICAgIHJldHVybiAoYSAmIGIpIF4gKH5hICYgYyk7XG59XG4vKiogTWFqb3JpdHkgZnVuY3Rpb24sIHRydWUgaWYgYW55IHR3byBpbnB1dHMgaXMgdHJ1ZS4gKi9cbmV4cG9ydCBmdW5jdGlvbiBNYWooYSwgYiwgYykge1xuICAgIHJldHVybiAoYSAmIGIpIF4gKGEgJiBjKSBeIChiICYgYyk7XG59XG4vKipcbiAqIE1lcmtsZS1EYW1nYXJkIGhhc2ggY29uc3RydWN0aW9uIGJhc2UgY2xhc3MuXG4gKiBDb3VsZCBiZSB1c2VkIHRvIGNyZWF0ZSBNRDUsIFJJUEVNRCwgU0hBMSwgU0hBMi5cbiAqL1xuZXhwb3J0IGNsYXNzIEhhc2hNRCBleHRlbmRzIEhhc2gge1xuICAgIGNvbnN0cnVjdG9yKGJsb2NrTGVuLCBvdXRwdXRMZW4sIHBhZE9mZnNldCwgaXNMRSkge1xuICAgICAgICBzdXBlcigpO1xuICAgICAgICB0aGlzLmZpbmlzaGVkID0gZmFsc2U7XG4gICAgICAgIHRoaXMubGVuZ3RoID0gMDtcbiAgICAgICAgdGhpcy5wb3MgPSAwO1xuICAgICAgICB0aGlzLmRlc3Ryb3llZCA9IGZhbHNlO1xuICAgICAgICB0aGlzLmJsb2NrTGVuID0gYmxvY2tMZW47XG4gICAgICAgIHRoaXMub3V0cHV0TGVuID0gb3V0cHV0TGVuO1xuICAgICAgICB0aGlzLnBhZE9mZnNldCA9IHBhZE9mZnNldDtcbiAgICAgICAgdGhpcy5pc0xFID0gaXNMRTtcbiAgICAgICAgdGhpcy5idWZmZXIgPSBuZXcgVWludDhBcnJheShibG9ja0xlbik7XG4gICAgICAgIHRoaXMudmlldyA9IGNyZWF0ZVZpZXcodGhpcy5idWZmZXIpO1xuICAgIH1cbiAgICB1cGRhdGUoZGF0YSkge1xuICAgICAgICBhZXhpc3RzKHRoaXMpO1xuICAgICAgICBkYXRhID0gdG9CeXRlcyhkYXRhKTtcbiAgICAgICAgYWJ5dGVzKGRhdGEpO1xuICAgICAgICBjb25zdCB7IHZpZXcsIGJ1ZmZlciwgYmxvY2tMZW4gfSA9IHRoaXM7XG4gICAgICAgIGNvbnN0IGxlbiA9IGRhdGEubGVuZ3RoO1xuICAgICAgICBmb3IgKGxldCBwb3MgPSAwOyBwb3MgPCBsZW47KSB7XG4gICAgICAgICAgICBjb25zdCB0YWtlID0gTWF0aC5taW4oYmxvY2tMZW4gLSB0aGlzLnBvcywgbGVuIC0gcG9zKTtcbiAgICAgICAgICAgIC8vIEZhc3QgcGF0aDogd2UgaGF2ZSBhdCBsZWFzdCBvbmUgYmxvY2sgaW4gaW5wdXQsIGNhc3QgaXQgdG8gdmlldyBhbmQgcHJvY2Vzc1xuICAgICAgICAgICAgaWYgKHRha2UgPT09IGJsb2NrTGVuKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgZGF0YVZpZXcgPSBjcmVhdGVWaWV3KGRhdGEpO1xuICAgICAgICAgICAgICAgIGZvciAoOyBibG9ja0xlbiA8PSBsZW4gLSBwb3M7IHBvcyArPSBibG9ja0xlbilcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5wcm9jZXNzKGRhdGFWaWV3LCBwb3MpO1xuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgYnVmZmVyLnNldChkYXRhLnN1YmFycmF5KHBvcywgcG9zICsgdGFrZSksIHRoaXMucG9zKTtcbiAgICAgICAgICAgIHRoaXMucG9zICs9IHRha2U7XG4gICAgICAgICAgICBwb3MgKz0gdGFrZTtcbiAgICAgICAgICAgIGlmICh0aGlzLnBvcyA9PT0gYmxvY2tMZW4pIHtcbiAgICAgICAgICAgICAgICB0aGlzLnByb2Nlc3ModmlldywgMCk7XG4gICAgICAgICAgICAgICAgdGhpcy5wb3MgPSAwO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHRoaXMubGVuZ3RoICs9IGRhdGEubGVuZ3RoO1xuICAgICAgICB0aGlzLnJvdW5kQ2xlYW4oKTtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuICAgIGRpZ2VzdEludG8ob3V0KSB7XG4gICAgICAgIGFleGlzdHModGhpcyk7XG4gICAgICAgIGFvdXRwdXQob3V0LCB0aGlzKTtcbiAgICAgICAgdGhpcy5maW5pc2hlZCA9IHRydWU7XG4gICAgICAgIC8vIFBhZGRpbmdcbiAgICAgICAgLy8gV2UgY2FuIGF2b2lkIGFsbG9jYXRpb24gb2YgYnVmZmVyIGZvciBwYWRkaW5nIGNvbXBsZXRlbHkgaWYgaXRcbiAgICAgICAgLy8gd2FzIHByZXZpb3VzbHkgbm90IGFsbG9jYXRlZCBoZXJlLiBCdXQgaXQgd29uJ3QgY2hhbmdlIHBlcmZvcm1hbmNlLlxuICAgICAgICBjb25zdCB7IGJ1ZmZlciwgdmlldywgYmxvY2tMZW4sIGlzTEUgfSA9IHRoaXM7XG4gICAgICAgIGxldCB7IHBvcyB9ID0gdGhpcztcbiAgICAgICAgLy8gYXBwZW5kIHRoZSBiaXQgJzEnIHRvIHRoZSBtZXNzYWdlXG4gICAgICAgIGJ1ZmZlcltwb3MrK10gPSAwYjEwMDAwMDAwO1xuICAgICAgICBjbGVhbih0aGlzLmJ1ZmZlci5zdWJhcnJheShwb3MpKTtcbiAgICAgICAgLy8gd2UgaGF2ZSBsZXNzIHRoYW4gcGFkT2Zmc2V0IGxlZnQgaW4gYnVmZmVyLCBzbyB3ZSBjYW5ub3QgcHV0IGxlbmd0aCBpblxuICAgICAgICAvLyBjdXJyZW50IGJsb2NrLCBuZWVkIHByb2Nlc3MgaXQgYW5kIHBhZCBhZ2FpblxuICAgICAgICBpZiAodGhpcy5wYWRPZmZzZXQgPiBibG9ja0xlbiAtIHBvcykge1xuICAgICAgICAgICAgdGhpcy5wcm9jZXNzKHZpZXcsIDApO1xuICAgICAgICAgICAgcG9zID0gMDtcbiAgICAgICAgfVxuICAgICAgICAvLyBQYWQgdW50aWwgZnVsbCBibG9jayBieXRlIHdpdGggemVyb3NcbiAgICAgICAgZm9yIChsZXQgaSA9IHBvczsgaSA8IGJsb2NrTGVuOyBpKyspXG4gICAgICAgICAgICBidWZmZXJbaV0gPSAwO1xuICAgICAgICAvLyBOb3RlOiBzaGE1MTIgcmVxdWlyZXMgbGVuZ3RoIHRvIGJlIDEyOGJpdCBpbnRlZ2VyLCBidXQgbGVuZ3RoIGluIEpTIHdpbGwgb3ZlcmZsb3cgYmVmb3JlIHRoYXRcbiAgICAgICAgLy8gWW91IG5lZWQgdG8gd3JpdGUgYXJvdW5kIDIgZXhhYnl0ZXMgKHU2NF9tYXggLyA4IC8gKDEwMjQqKjYpKSBmb3IgdGhpcyB0byBoYXBwZW4uXG4gICAgICAgIC8vIFNvIHdlIGp1c3Qgd3JpdGUgbG93ZXN0IDY0IGJpdHMgb2YgdGhhdCB2YWx1ZS5cbiAgICAgICAgc2V0QmlnVWludDY0KHZpZXcsIGJsb2NrTGVuIC0gOCwgQmlnSW50KHRoaXMubGVuZ3RoICogOCksIGlzTEUpO1xuICAgICAgICB0aGlzLnByb2Nlc3ModmlldywgMCk7XG4gICAgICAgIGNvbnN0IG92aWV3ID0gY3JlYXRlVmlldyhvdXQpO1xuICAgICAgICBjb25zdCBsZW4gPSB0aGlzLm91dHB1dExlbjtcbiAgICAgICAgLy8gTk9URTogd2UgZG8gZGl2aXNpb24gYnkgNCBsYXRlciwgd2hpY2ggc2hvdWxkIGJlIGZ1c2VkIGluIHNpbmdsZSBvcCB3aXRoIG1vZHVsbyBieSBKSVRcbiAgICAgICAgaWYgKGxlbiAlIDQpXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ19zaGEyOiBvdXRwdXRMZW4gc2hvdWxkIGJlIGFsaWduZWQgdG8gMzJiaXQnKTtcbiAgICAgICAgY29uc3Qgb3V0TGVuID0gbGVuIC8gNDtcbiAgICAgICAgY29uc3Qgc3RhdGUgPSB0aGlzLmdldCgpO1xuICAgICAgICBpZiAob3V0TGVuID4gc3RhdGUubGVuZ3RoKVxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdfc2hhMjogb3V0cHV0TGVuIGJpZ2dlciB0aGFuIHN0YXRlJyk7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgb3V0TGVuOyBpKyspXG4gICAgICAgICAgICBvdmlldy5zZXRVaW50MzIoNCAqIGksIHN0YXRlW2ldLCBpc0xFKTtcbiAgICB9XG4gICAgZGlnZXN0KCkge1xuICAgICAgICBjb25zdCB7IGJ1ZmZlciwgb3V0cHV0TGVuIH0gPSB0aGlzO1xuICAgICAgICB0aGlzLmRpZ2VzdEludG8oYnVmZmVyKTtcbiAgICAgICAgY29uc3QgcmVzID0gYnVmZmVyLnNsaWNlKDAsIG91dHB1dExlbik7XG4gICAgICAgIHRoaXMuZGVzdHJveSgpO1xuICAgICAgICByZXR1cm4gcmVzO1xuICAgIH1cbiAgICBfY2xvbmVJbnRvKHRvKSB7XG4gICAgICAgIHRvIHx8ICh0byA9IG5ldyB0aGlzLmNvbnN0cnVjdG9yKCkpO1xuICAgICAgICB0by5zZXQoLi4udGhpcy5nZXQoKSk7XG4gICAgICAgIGNvbnN0IHsgYmxvY2tMZW4sIGJ1ZmZlciwgbGVuZ3RoLCBmaW5pc2hlZCwgZGVzdHJveWVkLCBwb3MgfSA9IHRoaXM7XG4gICAgICAgIHRvLmRlc3Ryb3llZCA9IGRlc3Ryb3llZDtcbiAgICAgICAgdG8uZmluaXNoZWQgPSBmaW5pc2hlZDtcbiAgICAgICAgdG8ubGVuZ3RoID0gbGVuZ3RoO1xuICAgICAgICB0by5wb3MgPSBwb3M7XG4gICAgICAgIGlmIChsZW5ndGggJSBibG9ja0xlbilcbiAgICAgICAgICAgIHRvLmJ1ZmZlci5zZXQoYnVmZmVyKTtcbiAgICAgICAgcmV0dXJuIHRvO1xuICAgIH1cbiAgICBjbG9uZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2Nsb25lSW50bygpO1xuICAgIH1cbn1cbi8qKlxuICogSW5pdGlhbCBTSEEtMiBzdGF0ZTogZnJhY3Rpb25hbCBwYXJ0cyBvZiBzcXVhcmUgcm9vdHMgb2YgZmlyc3QgMTYgcHJpbWVzIDIuLjUzLlxuICogQ2hlY2sgb3V0IGB0ZXN0L21pc2Mvc2hhMi1nZW4taXYuanNgIGZvciByZWNvbXB1dGF0aW9uIGd1aWRlLlxuICovXG4vKiogSW5pdGlhbCBTSEEyNTYgc3RhdGUuIEJpdHMgMC4uMzIgb2YgZnJhYyBwYXJ0IG9mIHNxcnQgb2YgcHJpbWVzIDIuLjE5ICovXG5leHBvcnQgY29uc3QgU0hBMjU2X0lWID0gLyogQF9fUFVSRV9fICovIFVpbnQzMkFycmF5LmZyb20oW1xuICAgIDB4NmEwOWU2NjcsIDB4YmI2N2FlODUsIDB4M2M2ZWYzNzIsIDB4YTU0ZmY1M2EsIDB4NTEwZTUyN2YsIDB4OWIwNTY4OGMsIDB4MWY4M2Q5YWIsIDB4NWJlMGNkMTksXG5dKTtcbi8qKiBJbml0aWFsIFNIQTIyNCBzdGF0ZS4gQml0cyAzMi4uNjQgb2YgZnJhYyBwYXJ0IG9mIHNxcnQgb2YgcHJpbWVzIDIzLi41MyAqL1xuZXhwb3J0IGNvbnN0IFNIQTIyNF9JViA9IC8qIEBfX1BVUkVfXyAqLyBVaW50MzJBcnJheS5mcm9tKFtcbiAgICAweGMxMDU5ZWQ4LCAweDM2N2NkNTA3LCAweDMwNzBkZDE3LCAweGY3MGU1OTM5LCAweGZmYzAwYjMxLCAweDY4NTgxNTExLCAweDY0Zjk4ZmE3LCAweGJlZmE0ZmE0LFxuXSk7XG4vKiogSW5pdGlhbCBTSEEzODQgc3RhdGUuIEJpdHMgMC4uNjQgb2YgZnJhYyBwYXJ0IG9mIHNxcnQgb2YgcHJpbWVzIDIzLi41MyAqL1xuZXhwb3J0IGNvbnN0IFNIQTM4NF9JViA9IC8qIEBfX1BVUkVfXyAqLyBVaW50MzJBcnJheS5mcm9tKFtcbiAgICAweGNiYmI5ZDVkLCAweGMxMDU5ZWQ4LCAweDYyOWEyOTJhLCAweDM2N2NkNTA3LCAweDkxNTkwMTVhLCAweDMwNzBkZDE3LCAweDE1MmZlY2Q4LCAweGY3MGU1OTM5LFxuICAgIDB4NjczMzI2NjcsIDB4ZmZjMDBiMzEsIDB4OGViNDRhODcsIDB4Njg1ODE1MTEsIDB4ZGIwYzJlMGQsIDB4NjRmOThmYTcsIDB4NDdiNTQ4MWQsIDB4YmVmYTRmYTQsXG5dKTtcbi8qKiBJbml0aWFsIFNIQTUxMiBzdGF0ZS4gQml0cyAwLi42NCBvZiBmcmFjIHBhcnQgb2Ygc3FydCBvZiBwcmltZXMgMi4uMTkgKi9cbmV4cG9ydCBjb25zdCBTSEE1MTJfSVYgPSAvKiBAX19QVVJFX18gKi8gVWludDMyQXJyYXkuZnJvbShbXG4gICAgMHg2YTA5ZTY2NywgMHhmM2JjYzkwOCwgMHhiYjY3YWU4NSwgMHg4NGNhYTczYiwgMHgzYzZlZjM3MiwgMHhmZTk0ZjgyYiwgMHhhNTRmZjUzYSwgMHg1ZjFkMzZmMSxcbiAgICAweDUxMGU1MjdmLCAweGFkZTY4MmQxLCAweDliMDU2ODhjLCAweDJiM2U2YzFmLCAweDFmODNkOWFiLCAweGZiNDFiZDZiLCAweDViZTBjZDE5LCAweDEzN2UyMTc5LFxuXSk7XG4vLyMgc291cmNlTWFwcGluZ1VSTD1fbWQuanMubWFwIiwKICAgICIvKipcbiAqIFNIQTIgaGFzaCBmdW5jdGlvbi4gQS5rLmEuIHNoYTI1Niwgc2hhMzg0LCBzaGE1MTIsIHNoYTUxMl8yMjQsIHNoYTUxMl8yNTYuXG4gKiBTSEEyNTYgaXMgdGhlIGZhc3Rlc3QgaGFzaCBpbXBsZW1lbnRhYmxlIGluIEpTLCBldmVuIGZhc3RlciB0aGFuIEJsYWtlMy5cbiAqIENoZWNrIG91dCBbUkZDIDQ2MzRdKGh0dHBzOi8vZGF0YXRyYWNrZXIuaWV0Zi5vcmcvZG9jL2h0bWwvcmZjNDYzNCkgYW5kXG4gKiBbRklQUyAxODAtNF0oaHR0cHM6Ly9udmxwdWJzLm5pc3QuZ292L25pc3RwdWJzL0ZJUFMvTklTVC5GSVBTLjE4MC00LnBkZikuXG4gKiBAbW9kdWxlXG4gKi9cbmltcG9ydCB7IENoaSwgSGFzaE1ELCBNYWosIFNIQTIyNF9JViwgU0hBMjU2X0lWLCBTSEEzODRfSVYsIFNIQTUxMl9JViB9IGZyb20gXCIuL19tZC5qc1wiO1xuaW1wb3J0ICogYXMgdTY0IGZyb20gXCIuL191NjQuanNcIjtcbmltcG9ydCB7IGNsZWFuLCBjcmVhdGVIYXNoZXIsIHJvdHIgfSBmcm9tIFwiLi91dGlscy5qc1wiO1xuLyoqXG4gKiBSb3VuZCBjb25zdGFudHM6XG4gKiBGaXJzdCAzMiBiaXRzIG9mIGZyYWN0aW9uYWwgcGFydHMgb2YgdGhlIGN1YmUgcm9vdHMgb2YgdGhlIGZpcnN0IDY0IHByaW1lcyAyLi4zMTEpXG4gKi9cbi8vIHByZXR0aWVyLWlnbm9yZVxuY29uc3QgU0hBMjU2X0sgPSAvKiBAX19QVVJFX18gKi8gVWludDMyQXJyYXkuZnJvbShbXG4gICAgMHg0MjhhMmY5OCwgMHg3MTM3NDQ5MSwgMHhiNWMwZmJjZiwgMHhlOWI1ZGJhNSwgMHgzOTU2YzI1YiwgMHg1OWYxMTFmMSwgMHg5MjNmODJhNCwgMHhhYjFjNWVkNSxcbiAgICAweGQ4MDdhYTk4LCAweDEyODM1YjAxLCAweDI0MzE4NWJlLCAweDU1MGM3ZGMzLCAweDcyYmU1ZDc0LCAweDgwZGViMWZlLCAweDliZGMwNmE3LCAweGMxOWJmMTc0LFxuICAgIDB4ZTQ5YjY5YzEsIDB4ZWZiZTQ3ODYsIDB4MGZjMTlkYzYsIDB4MjQwY2ExY2MsIDB4MmRlOTJjNmYsIDB4NGE3NDg0YWEsIDB4NWNiMGE5ZGMsIDB4NzZmOTg4ZGEsXG4gICAgMHg5ODNlNTE1MiwgMHhhODMxYzY2ZCwgMHhiMDAzMjdjOCwgMHhiZjU5N2ZjNywgMHhjNmUwMGJmMywgMHhkNWE3OTE0NywgMHgwNmNhNjM1MSwgMHgxNDI5Mjk2NyxcbiAgICAweDI3YjcwYTg1LCAweDJlMWIyMTM4LCAweDRkMmM2ZGZjLCAweDUzMzgwZDEzLCAweDY1MGE3MzU0LCAweDc2NmEwYWJiLCAweDgxYzJjOTJlLCAweDkyNzIyYzg1LFxuICAgIDB4YTJiZmU4YTEsIDB4YTgxYTY2NGIsIDB4YzI0YjhiNzAsIDB4Yzc2YzUxYTMsIDB4ZDE5MmU4MTksIDB4ZDY5OTA2MjQsIDB4ZjQwZTM1ODUsIDB4MTA2YWEwNzAsXG4gICAgMHgxOWE0YzExNiwgMHgxZTM3NmMwOCwgMHgyNzQ4Nzc0YywgMHgzNGIwYmNiNSwgMHgzOTFjMGNiMywgMHg0ZWQ4YWE0YSwgMHg1YjljY2E0ZiwgMHg2ODJlNmZmMyxcbiAgICAweDc0OGY4MmVlLCAweDc4YTU2MzZmLCAweDg0Yzg3ODE0LCAweDhjYzcwMjA4LCAweDkwYmVmZmZhLCAweGE0NTA2Y2ViLCAweGJlZjlhM2Y3LCAweGM2NzE3OGYyXG5dKTtcbi8qKiBSZXVzYWJsZSB0ZW1wb3JhcnkgYnVmZmVyLiBcIldcIiBjb21lcyBzdHJhaWdodCBmcm9tIHNwZWMuICovXG5jb25zdCBTSEEyNTZfVyA9IC8qIEBfX1BVUkVfXyAqLyBuZXcgVWludDMyQXJyYXkoNjQpO1xuZXhwb3J0IGNsYXNzIFNIQTI1NiBleHRlbmRzIEhhc2hNRCB7XG4gICAgY29uc3RydWN0b3Iob3V0cHV0TGVuID0gMzIpIHtcbiAgICAgICAgc3VwZXIoNjQsIG91dHB1dExlbiwgOCwgZmFsc2UpO1xuICAgICAgICAvLyBXZSBjYW5ub3QgdXNlIGFycmF5IGhlcmUgc2luY2UgYXJyYXkgYWxsb3dzIGluZGV4aW5nIGJ5IHZhcmlhYmxlXG4gICAgICAgIC8vIHdoaWNoIG1lYW5zIG9wdGltaXplci9jb21waWxlciBjYW5ub3QgdXNlIHJlZ2lzdGVycy5cbiAgICAgICAgdGhpcy5BID0gU0hBMjU2X0lWWzBdIHwgMDtcbiAgICAgICAgdGhpcy5CID0gU0hBMjU2X0lWWzFdIHwgMDtcbiAgICAgICAgdGhpcy5DID0gU0hBMjU2X0lWWzJdIHwgMDtcbiAgICAgICAgdGhpcy5EID0gU0hBMjU2X0lWWzNdIHwgMDtcbiAgICAgICAgdGhpcy5FID0gU0hBMjU2X0lWWzRdIHwgMDtcbiAgICAgICAgdGhpcy5GID0gU0hBMjU2X0lWWzVdIHwgMDtcbiAgICAgICAgdGhpcy5HID0gU0hBMjU2X0lWWzZdIHwgMDtcbiAgICAgICAgdGhpcy5IID0gU0hBMjU2X0lWWzddIHwgMDtcbiAgICB9XG4gICAgZ2V0KCkge1xuICAgICAgICBjb25zdCB7IEEsIEIsIEMsIEQsIEUsIEYsIEcsIEggfSA9IHRoaXM7XG4gICAgICAgIHJldHVybiBbQSwgQiwgQywgRCwgRSwgRiwgRywgSF07XG4gICAgfVxuICAgIC8vIHByZXR0aWVyLWlnbm9yZVxuICAgIHNldChBLCBCLCBDLCBELCBFLCBGLCBHLCBIKSB7XG4gICAgICAgIHRoaXMuQSA9IEEgfCAwO1xuICAgICAgICB0aGlzLkIgPSBCIHwgMDtcbiAgICAgICAgdGhpcy5DID0gQyB8IDA7XG4gICAgICAgIHRoaXMuRCA9IEQgfCAwO1xuICAgICAgICB0aGlzLkUgPSBFIHwgMDtcbiAgICAgICAgdGhpcy5GID0gRiB8IDA7XG4gICAgICAgIHRoaXMuRyA9IEcgfCAwO1xuICAgICAgICB0aGlzLkggPSBIIHwgMDtcbiAgICB9XG4gICAgcHJvY2Vzcyh2aWV3LCBvZmZzZXQpIHtcbiAgICAgICAgLy8gRXh0ZW5kIHRoZSBmaXJzdCAxNiB3b3JkcyBpbnRvIHRoZSByZW1haW5pbmcgNDggd29yZHMgd1sxNi4uNjNdIG9mIHRoZSBtZXNzYWdlIHNjaGVkdWxlIGFycmF5XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgMTY7IGkrKywgb2Zmc2V0ICs9IDQpXG4gICAgICAgICAgICBTSEEyNTZfV1tpXSA9IHZpZXcuZ2V0VWludDMyKG9mZnNldCwgZmFsc2UpO1xuICAgICAgICBmb3IgKGxldCBpID0gMTY7IGkgPCA2NDsgaSsrKSB7XG4gICAgICAgICAgICBjb25zdCBXMTUgPSBTSEEyNTZfV1tpIC0gMTVdO1xuICAgICAgICAgICAgY29uc3QgVzIgPSBTSEEyNTZfV1tpIC0gMl07XG4gICAgICAgICAgICBjb25zdCBzMCA9IHJvdHIoVzE1LCA3KSBeIHJvdHIoVzE1LCAxOCkgXiAoVzE1ID4+PiAzKTtcbiAgICAgICAgICAgIGNvbnN0IHMxID0gcm90cihXMiwgMTcpIF4gcm90cihXMiwgMTkpIF4gKFcyID4+PiAxMCk7XG4gICAgICAgICAgICBTSEEyNTZfV1tpXSA9IChzMSArIFNIQTI1Nl9XW2kgLSA3XSArIHMwICsgU0hBMjU2X1dbaSAtIDE2XSkgfCAwO1xuICAgICAgICB9XG4gICAgICAgIC8vIENvbXByZXNzaW9uIGZ1bmN0aW9uIG1haW4gbG9vcCwgNjQgcm91bmRzXG4gICAgICAgIGxldCB7IEEsIEIsIEMsIEQsIEUsIEYsIEcsIEggfSA9IHRoaXM7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgNjQ7IGkrKykge1xuICAgICAgICAgICAgY29uc3Qgc2lnbWExID0gcm90cihFLCA2KSBeIHJvdHIoRSwgMTEpIF4gcm90cihFLCAyNSk7XG4gICAgICAgICAgICBjb25zdCBUMSA9IChIICsgc2lnbWExICsgQ2hpKEUsIEYsIEcpICsgU0hBMjU2X0tbaV0gKyBTSEEyNTZfV1tpXSkgfCAwO1xuICAgICAgICAgICAgY29uc3Qgc2lnbWEwID0gcm90cihBLCAyKSBeIHJvdHIoQSwgMTMpIF4gcm90cihBLCAyMik7XG4gICAgICAgICAgICBjb25zdCBUMiA9IChzaWdtYTAgKyBNYWooQSwgQiwgQykpIHwgMDtcbiAgICAgICAgICAgIEggPSBHO1xuICAgICAgICAgICAgRyA9IEY7XG4gICAgICAgICAgICBGID0gRTtcbiAgICAgICAgICAgIEUgPSAoRCArIFQxKSB8IDA7XG4gICAgICAgICAgICBEID0gQztcbiAgICAgICAgICAgIEMgPSBCO1xuICAgICAgICAgICAgQiA9IEE7XG4gICAgICAgICAgICBBID0gKFQxICsgVDIpIHwgMDtcbiAgICAgICAgfVxuICAgICAgICAvLyBBZGQgdGhlIGNvbXByZXNzZWQgY2h1bmsgdG8gdGhlIGN1cnJlbnQgaGFzaCB2YWx1ZVxuICAgICAgICBBID0gKEEgKyB0aGlzLkEpIHwgMDtcbiAgICAgICAgQiA9IChCICsgdGhpcy5CKSB8IDA7XG4gICAgICAgIEMgPSAoQyArIHRoaXMuQykgfCAwO1xuICAgICAgICBEID0gKEQgKyB0aGlzLkQpIHwgMDtcbiAgICAgICAgRSA9IChFICsgdGhpcy5FKSB8IDA7XG4gICAgICAgIEYgPSAoRiArIHRoaXMuRikgfCAwO1xuICAgICAgICBHID0gKEcgKyB0aGlzLkcpIHwgMDtcbiAgICAgICAgSCA9IChIICsgdGhpcy5IKSB8IDA7XG4gICAgICAgIHRoaXMuc2V0KEEsIEIsIEMsIEQsIEUsIEYsIEcsIEgpO1xuICAgIH1cbiAgICByb3VuZENsZWFuKCkge1xuICAgICAgICBjbGVhbihTSEEyNTZfVyk7XG4gICAgfVxuICAgIGRlc3Ryb3koKSB7XG4gICAgICAgIHRoaXMuc2V0KDAsIDAsIDAsIDAsIDAsIDAsIDAsIDApO1xuICAgICAgICBjbGVhbih0aGlzLmJ1ZmZlcik7XG4gICAgfVxufVxuZXhwb3J0IGNsYXNzIFNIQTIyNCBleHRlbmRzIFNIQTI1NiB7XG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHN1cGVyKDI4KTtcbiAgICAgICAgdGhpcy5BID0gU0hBMjI0X0lWWzBdIHwgMDtcbiAgICAgICAgdGhpcy5CID0gU0hBMjI0X0lWWzFdIHwgMDtcbiAgICAgICAgdGhpcy5DID0gU0hBMjI0X0lWWzJdIHwgMDtcbiAgICAgICAgdGhpcy5EID0gU0hBMjI0X0lWWzNdIHwgMDtcbiAgICAgICAgdGhpcy5FID0gU0hBMjI0X0lWWzRdIHwgMDtcbiAgICAgICAgdGhpcy5GID0gU0hBMjI0X0lWWzVdIHwgMDtcbiAgICAgICAgdGhpcy5HID0gU0hBMjI0X0lWWzZdIHwgMDtcbiAgICAgICAgdGhpcy5IID0gU0hBMjI0X0lWWzddIHwgMDtcbiAgICB9XG59XG4vLyBTSEEyLTUxMiBpcyBzbG93ZXIgdGhhbiBzaGEyNTYgaW4ganMgYmVjYXVzZSB1NjQgb3BlcmF0aW9ucyBhcmUgc2xvdy5cbi8vIFJvdW5kIGNvbnRhbnRzXG4vLyBGaXJzdCAzMiBiaXRzIG9mIHRoZSBmcmFjdGlvbmFsIHBhcnRzIG9mIHRoZSBjdWJlIHJvb3RzIG9mIHRoZSBmaXJzdCA4MCBwcmltZXMgMi4uNDA5XG4vLyBwcmV0dGllci1pZ25vcmVcbmNvbnN0IEs1MTIgPSAvKiBAX19QVVJFX18gKi8gKCgpID0+IHU2NC5zcGxpdChbXG4gICAgJzB4NDI4YTJmOThkNzI4YWUyMicsICcweDcxMzc0NDkxMjNlZjY1Y2QnLCAnMHhiNWMwZmJjZmVjNGQzYjJmJywgJzB4ZTliNWRiYTU4MTg5ZGJiYycsXG4gICAgJzB4Mzk1NmMyNWJmMzQ4YjUzOCcsICcweDU5ZjExMWYxYjYwNWQwMTknLCAnMHg5MjNmODJhNGFmMTk0ZjliJywgJzB4YWIxYzVlZDVkYTZkODExOCcsXG4gICAgJzB4ZDgwN2FhOThhMzAzMDI0MicsICcweDEyODM1YjAxNDU3MDZmYmUnLCAnMHgyNDMxODViZTRlZTRiMjhjJywgJzB4NTUwYzdkYzNkNWZmYjRlMicsXG4gICAgJzB4NzJiZTVkNzRmMjdiODk2ZicsICcweDgwZGViMWZlM2IxNjk2YjEnLCAnMHg5YmRjMDZhNzI1YzcxMjM1JywgJzB4YzE5YmYxNzRjZjY5MjY5NCcsXG4gICAgJzB4ZTQ5YjY5YzE5ZWYxNGFkMicsICcweGVmYmU0Nzg2Mzg0ZjI1ZTMnLCAnMHgwZmMxOWRjNjhiOGNkNWI1JywgJzB4MjQwY2ExY2M3N2FjOWM2NScsXG4gICAgJzB4MmRlOTJjNmY1OTJiMDI3NScsICcweDRhNzQ4NGFhNmVhNmU0ODMnLCAnMHg1Y2IwYTlkY2JkNDFmYmQ0JywgJzB4NzZmOTg4ZGE4MzExNTNiNScsXG4gICAgJzB4OTgzZTUxNTJlZTY2ZGZhYicsICcweGE4MzFjNjZkMmRiNDMyMTAnLCAnMHhiMDAzMjdjODk4ZmIyMTNmJywgJzB4YmY1OTdmYzdiZWVmMGVlNCcsXG4gICAgJzB4YzZlMDBiZjMzZGE4OGZjMicsICcweGQ1YTc5MTQ3OTMwYWE3MjUnLCAnMHgwNmNhNjM1MWUwMDM4MjZmJywgJzB4MTQyOTI5NjcwYTBlNmU3MCcsXG4gICAgJzB4MjdiNzBhODU0NmQyMmZmYycsICcweDJlMWIyMTM4NWMyNmM5MjYnLCAnMHg0ZDJjNmRmYzVhYzQyYWVkJywgJzB4NTMzODBkMTM5ZDk1YjNkZicsXG4gICAgJzB4NjUwYTczNTQ4YmFmNjNkZScsICcweDc2NmEwYWJiM2M3N2IyYTgnLCAnMHg4MWMyYzkyZTQ3ZWRhZWU2JywgJzB4OTI3MjJjODUxNDgyMzUzYicsXG4gICAgJzB4YTJiZmU4YTE0Y2YxMDM2NCcsICcweGE4MWE2NjRiYmM0MjMwMDEnLCAnMHhjMjRiOGI3MGQwZjg5NzkxJywgJzB4Yzc2YzUxYTMwNjU0YmUzMCcsXG4gICAgJzB4ZDE5MmU4MTlkNmVmNTIxOCcsICcweGQ2OTkwNjI0NTU2NWE5MTAnLCAnMHhmNDBlMzU4NTU3NzEyMDJhJywgJzB4MTA2YWEwNzAzMmJiZDFiOCcsXG4gICAgJzB4MTlhNGMxMTZiOGQyZDBjOCcsICcweDFlMzc2YzA4NTE0MWFiNTMnLCAnMHgyNzQ4Nzc0Y2RmOGVlYjk5JywgJzB4MzRiMGJjYjVlMTliNDhhOCcsXG4gICAgJzB4MzkxYzBjYjNjNWM5NWE2MycsICcweDRlZDhhYTRhZTM0MThhY2InLCAnMHg1YjljY2E0Zjc3NjNlMzczJywgJzB4NjgyZTZmZjNkNmIyYjhhMycsXG4gICAgJzB4NzQ4ZjgyZWU1ZGVmYjJmYycsICcweDc4YTU2MzZmNDMxNzJmNjAnLCAnMHg4NGM4NzgxNGExZjBhYjcyJywgJzB4OGNjNzAyMDgxYTY0MzllYycsXG4gICAgJzB4OTBiZWZmZmEyMzYzMWUyOCcsICcweGE0NTA2Y2ViZGU4MmJkZTknLCAnMHhiZWY5YTNmN2IyYzY3OTE1JywgJzB4YzY3MTc4ZjJlMzcyNTMyYicsXG4gICAgJzB4Y2EyNzNlY2VlYTI2NjE5YycsICcweGQxODZiOGM3MjFjMGMyMDcnLCAnMHhlYWRhN2RkNmNkZTBlYjFlJywgJzB4ZjU3ZDRmN2ZlZTZlZDE3OCcsXG4gICAgJzB4MDZmMDY3YWE3MjE3NmZiYScsICcweDBhNjM3ZGM1YTJjODk4YTYnLCAnMHgxMTNmOTgwNGJlZjkwZGFlJywgJzB4MWI3MTBiMzUxMzFjNDcxYicsXG4gICAgJzB4MjhkYjc3ZjUyMzA0N2Q4NCcsICcweDMyY2FhYjdiNDBjNzI0OTMnLCAnMHgzYzllYmUwYTE1YzliZWJjJywgJzB4NDMxZDY3YzQ5YzEwMGQ0YycsXG4gICAgJzB4NGNjNWQ0YmVjYjNlNDJiNicsICcweDU5N2YyOTljZmM2NTdlMmEnLCAnMHg1ZmNiNmZhYjNhZDZmYWVjJywgJzB4NmM0NDE5OGM0YTQ3NTgxNydcbl0ubWFwKG4gPT4gQmlnSW50KG4pKSkpKCk7XG5jb25zdCBTSEE1MTJfS2ggPSAvKiBAX19QVVJFX18gKi8gKCgpID0+IEs1MTJbMF0pKCk7XG5jb25zdCBTSEE1MTJfS2wgPSAvKiBAX19QVVJFX18gKi8gKCgpID0+IEs1MTJbMV0pKCk7XG4vLyBSZXVzYWJsZSB0ZW1wb3JhcnkgYnVmZmVyc1xuY29uc3QgU0hBNTEyX1dfSCA9IC8qIEBfX1BVUkVfXyAqLyBuZXcgVWludDMyQXJyYXkoODApO1xuY29uc3QgU0hBNTEyX1dfTCA9IC8qIEBfX1BVUkVfXyAqLyBuZXcgVWludDMyQXJyYXkoODApO1xuZXhwb3J0IGNsYXNzIFNIQTUxMiBleHRlbmRzIEhhc2hNRCB7XG4gICAgY29uc3RydWN0b3Iob3V0cHV0TGVuID0gNjQpIHtcbiAgICAgICAgc3VwZXIoMTI4LCBvdXRwdXRMZW4sIDE2LCBmYWxzZSk7XG4gICAgICAgIC8vIFdlIGNhbm5vdCB1c2UgYXJyYXkgaGVyZSBzaW5jZSBhcnJheSBhbGxvd3MgaW5kZXhpbmcgYnkgdmFyaWFibGVcbiAgICAgICAgLy8gd2hpY2ggbWVhbnMgb3B0aW1pemVyL2NvbXBpbGVyIGNhbm5vdCB1c2UgcmVnaXN0ZXJzLlxuICAgICAgICAvLyBoIC0tIGhpZ2ggMzIgYml0cywgbCAtLSBsb3cgMzIgYml0c1xuICAgICAgICB0aGlzLkFoID0gU0hBNTEyX0lWWzBdIHwgMDtcbiAgICAgICAgdGhpcy5BbCA9IFNIQTUxMl9JVlsxXSB8IDA7XG4gICAgICAgIHRoaXMuQmggPSBTSEE1MTJfSVZbMl0gfCAwO1xuICAgICAgICB0aGlzLkJsID0gU0hBNTEyX0lWWzNdIHwgMDtcbiAgICAgICAgdGhpcy5DaCA9IFNIQTUxMl9JVls0XSB8IDA7XG4gICAgICAgIHRoaXMuQ2wgPSBTSEE1MTJfSVZbNV0gfCAwO1xuICAgICAgICB0aGlzLkRoID0gU0hBNTEyX0lWWzZdIHwgMDtcbiAgICAgICAgdGhpcy5EbCA9IFNIQTUxMl9JVls3XSB8IDA7XG4gICAgICAgIHRoaXMuRWggPSBTSEE1MTJfSVZbOF0gfCAwO1xuICAgICAgICB0aGlzLkVsID0gU0hBNTEyX0lWWzldIHwgMDtcbiAgICAgICAgdGhpcy5GaCA9IFNIQTUxMl9JVlsxMF0gfCAwO1xuICAgICAgICB0aGlzLkZsID0gU0hBNTEyX0lWWzExXSB8IDA7XG4gICAgICAgIHRoaXMuR2ggPSBTSEE1MTJfSVZbMTJdIHwgMDtcbiAgICAgICAgdGhpcy5HbCA9IFNIQTUxMl9JVlsxM10gfCAwO1xuICAgICAgICB0aGlzLkhoID0gU0hBNTEyX0lWWzE0XSB8IDA7XG4gICAgICAgIHRoaXMuSGwgPSBTSEE1MTJfSVZbMTVdIHwgMDtcbiAgICB9XG4gICAgLy8gcHJldHRpZXItaWdub3JlXG4gICAgZ2V0KCkge1xuICAgICAgICBjb25zdCB7IEFoLCBBbCwgQmgsIEJsLCBDaCwgQ2wsIERoLCBEbCwgRWgsIEVsLCBGaCwgRmwsIEdoLCBHbCwgSGgsIEhsIH0gPSB0aGlzO1xuICAgICAgICByZXR1cm4gW0FoLCBBbCwgQmgsIEJsLCBDaCwgQ2wsIERoLCBEbCwgRWgsIEVsLCBGaCwgRmwsIEdoLCBHbCwgSGgsIEhsXTtcbiAgICB9XG4gICAgLy8gcHJldHRpZXItaWdub3JlXG4gICAgc2V0KEFoLCBBbCwgQmgsIEJsLCBDaCwgQ2wsIERoLCBEbCwgRWgsIEVsLCBGaCwgRmwsIEdoLCBHbCwgSGgsIEhsKSB7XG4gICAgICAgIHRoaXMuQWggPSBBaCB8IDA7XG4gICAgICAgIHRoaXMuQWwgPSBBbCB8IDA7XG4gICAgICAgIHRoaXMuQmggPSBCaCB8IDA7XG4gICAgICAgIHRoaXMuQmwgPSBCbCB8IDA7XG4gICAgICAgIHRoaXMuQ2ggPSBDaCB8IDA7XG4gICAgICAgIHRoaXMuQ2wgPSBDbCB8IDA7XG4gICAgICAgIHRoaXMuRGggPSBEaCB8IDA7XG4gICAgICAgIHRoaXMuRGwgPSBEbCB8IDA7XG4gICAgICAgIHRoaXMuRWggPSBFaCB8IDA7XG4gICAgICAgIHRoaXMuRWwgPSBFbCB8IDA7XG4gICAgICAgIHRoaXMuRmggPSBGaCB8IDA7XG4gICAgICAgIHRoaXMuRmwgPSBGbCB8IDA7XG4gICAgICAgIHRoaXMuR2ggPSBHaCB8IDA7XG4gICAgICAgIHRoaXMuR2wgPSBHbCB8IDA7XG4gICAgICAgIHRoaXMuSGggPSBIaCB8IDA7XG4gICAgICAgIHRoaXMuSGwgPSBIbCB8IDA7XG4gICAgfVxuICAgIHByb2Nlc3Modmlldywgb2Zmc2V0KSB7XG4gICAgICAgIC8vIEV4dGVuZCB0aGUgZmlyc3QgMTYgd29yZHMgaW50byB0aGUgcmVtYWluaW5nIDY0IHdvcmRzIHdbMTYuLjc5XSBvZiB0aGUgbWVzc2FnZSBzY2hlZHVsZSBhcnJheVxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IDE2OyBpKyssIG9mZnNldCArPSA0KSB7XG4gICAgICAgICAgICBTSEE1MTJfV19IW2ldID0gdmlldy5nZXRVaW50MzIob2Zmc2V0KTtcbiAgICAgICAgICAgIFNIQTUxMl9XX0xbaV0gPSB2aWV3LmdldFVpbnQzMigob2Zmc2V0ICs9IDQpKTtcbiAgICAgICAgfVxuICAgICAgICBmb3IgKGxldCBpID0gMTY7IGkgPCA4MDsgaSsrKSB7XG4gICAgICAgICAgICAvLyBzMCA6PSAod1tpLTE1XSByaWdodHJvdGF0ZSAxKSB4b3IgKHdbaS0xNV0gcmlnaHRyb3RhdGUgOCkgeG9yICh3W2ktMTVdIHJpZ2h0c2hpZnQgNylcbiAgICAgICAgICAgIGNvbnN0IFcxNWggPSBTSEE1MTJfV19IW2kgLSAxNV0gfCAwO1xuICAgICAgICAgICAgY29uc3QgVzE1bCA9IFNIQTUxMl9XX0xbaSAtIDE1XSB8IDA7XG4gICAgICAgICAgICBjb25zdCBzMGggPSB1NjQucm90clNIKFcxNWgsIFcxNWwsIDEpIF4gdTY0LnJvdHJTSChXMTVoLCBXMTVsLCA4KSBeIHU2NC5zaHJTSChXMTVoLCBXMTVsLCA3KTtcbiAgICAgICAgICAgIGNvbnN0IHMwbCA9IHU2NC5yb3RyU0woVzE1aCwgVzE1bCwgMSkgXiB1NjQucm90clNMKFcxNWgsIFcxNWwsIDgpIF4gdTY0LnNoclNMKFcxNWgsIFcxNWwsIDcpO1xuICAgICAgICAgICAgLy8gczEgOj0gKHdbaS0yXSByaWdodHJvdGF0ZSAxOSkgeG9yICh3W2ktMl0gcmlnaHRyb3RhdGUgNjEpIHhvciAod1tpLTJdIHJpZ2h0c2hpZnQgNilcbiAgICAgICAgICAgIGNvbnN0IFcyaCA9IFNIQTUxMl9XX0hbaSAtIDJdIHwgMDtcbiAgICAgICAgICAgIGNvbnN0IFcybCA9IFNIQTUxMl9XX0xbaSAtIDJdIHwgMDtcbiAgICAgICAgICAgIGNvbnN0IHMxaCA9IHU2NC5yb3RyU0goVzJoLCBXMmwsIDE5KSBeIHU2NC5yb3RyQkgoVzJoLCBXMmwsIDYxKSBeIHU2NC5zaHJTSChXMmgsIFcybCwgNik7XG4gICAgICAgICAgICBjb25zdCBzMWwgPSB1NjQucm90clNMKFcyaCwgVzJsLCAxOSkgXiB1NjQucm90ckJMKFcyaCwgVzJsLCA2MSkgXiB1NjQuc2hyU0woVzJoLCBXMmwsIDYpO1xuICAgICAgICAgICAgLy8gU0hBMjU2X1dbaV0gPSBzMCArIHMxICsgU0hBMjU2X1dbaSAtIDddICsgU0hBMjU2X1dbaSAtIDE2XTtcbiAgICAgICAgICAgIGNvbnN0IFNVTWwgPSB1NjQuYWRkNEwoczBsLCBzMWwsIFNIQTUxMl9XX0xbaSAtIDddLCBTSEE1MTJfV19MW2kgLSAxNl0pO1xuICAgICAgICAgICAgY29uc3QgU1VNaCA9IHU2NC5hZGQ0SChTVU1sLCBzMGgsIHMxaCwgU0hBNTEyX1dfSFtpIC0gN10sIFNIQTUxMl9XX0hbaSAtIDE2XSk7XG4gICAgICAgICAgICBTSEE1MTJfV19IW2ldID0gU1VNaCB8IDA7XG4gICAgICAgICAgICBTSEE1MTJfV19MW2ldID0gU1VNbCB8IDA7XG4gICAgICAgIH1cbiAgICAgICAgbGV0IHsgQWgsIEFsLCBCaCwgQmwsIENoLCBDbCwgRGgsIERsLCBFaCwgRWwsIEZoLCBGbCwgR2gsIEdsLCBIaCwgSGwgfSA9IHRoaXM7XG4gICAgICAgIC8vIENvbXByZXNzaW9uIGZ1bmN0aW9uIG1haW4gbG9vcCwgODAgcm91bmRzXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgODA7IGkrKykge1xuICAgICAgICAgICAgLy8gUzEgOj0gKGUgcmlnaHRyb3RhdGUgMTQpIHhvciAoZSByaWdodHJvdGF0ZSAxOCkgeG9yIChlIHJpZ2h0cm90YXRlIDQxKVxuICAgICAgICAgICAgY29uc3Qgc2lnbWExaCA9IHU2NC5yb3RyU0goRWgsIEVsLCAxNCkgXiB1NjQucm90clNIKEVoLCBFbCwgMTgpIF4gdTY0LnJvdHJCSChFaCwgRWwsIDQxKTtcbiAgICAgICAgICAgIGNvbnN0IHNpZ21hMWwgPSB1NjQucm90clNMKEVoLCBFbCwgMTQpIF4gdTY0LnJvdHJTTChFaCwgRWwsIDE4KSBeIHU2NC5yb3RyQkwoRWgsIEVsLCA0MSk7XG4gICAgICAgICAgICAvL2NvbnN0IFQxID0gKEggKyBzaWdtYTEgKyBDaGkoRSwgRiwgRykgKyBTSEEyNTZfS1tpXSArIFNIQTI1Nl9XW2ldKSB8IDA7XG4gICAgICAgICAgICBjb25zdCBDSEloID0gKEVoICYgRmgpIF4gKH5FaCAmIEdoKTtcbiAgICAgICAgICAgIGNvbnN0IENISWwgPSAoRWwgJiBGbCkgXiAofkVsICYgR2wpO1xuICAgICAgICAgICAgLy8gVDEgPSBIICsgc2lnbWExICsgQ2hpKEUsIEYsIEcpICsgU0hBNTEyX0tbaV0gKyBTSEE1MTJfV1tpXVxuICAgICAgICAgICAgLy8gcHJldHRpZXItaWdub3JlXG4gICAgICAgICAgICBjb25zdCBUMWxsID0gdTY0LmFkZDVMKEhsLCBzaWdtYTFsLCBDSElsLCBTSEE1MTJfS2xbaV0sIFNIQTUxMl9XX0xbaV0pO1xuICAgICAgICAgICAgY29uc3QgVDFoID0gdTY0LmFkZDVIKFQxbGwsIEhoLCBzaWdtYTFoLCBDSEloLCBTSEE1MTJfS2hbaV0sIFNIQTUxMl9XX0hbaV0pO1xuICAgICAgICAgICAgY29uc3QgVDFsID0gVDFsbCB8IDA7XG4gICAgICAgICAgICAvLyBTMCA6PSAoYSByaWdodHJvdGF0ZSAyOCkgeG9yIChhIHJpZ2h0cm90YXRlIDM0KSB4b3IgKGEgcmlnaHRyb3RhdGUgMzkpXG4gICAgICAgICAgICBjb25zdCBzaWdtYTBoID0gdTY0LnJvdHJTSChBaCwgQWwsIDI4KSBeIHU2NC5yb3RyQkgoQWgsIEFsLCAzNCkgXiB1NjQucm90ckJIKEFoLCBBbCwgMzkpO1xuICAgICAgICAgICAgY29uc3Qgc2lnbWEwbCA9IHU2NC5yb3RyU0woQWgsIEFsLCAyOCkgXiB1NjQucm90ckJMKEFoLCBBbCwgMzQpIF4gdTY0LnJvdHJCTChBaCwgQWwsIDM5KTtcbiAgICAgICAgICAgIGNvbnN0IE1BSmggPSAoQWggJiBCaCkgXiAoQWggJiBDaCkgXiAoQmggJiBDaCk7XG4gICAgICAgICAgICBjb25zdCBNQUpsID0gKEFsICYgQmwpIF4gKEFsICYgQ2wpIF4gKEJsICYgQ2wpO1xuICAgICAgICAgICAgSGggPSBHaCB8IDA7XG4gICAgICAgICAgICBIbCA9IEdsIHwgMDtcbiAgICAgICAgICAgIEdoID0gRmggfCAwO1xuICAgICAgICAgICAgR2wgPSBGbCB8IDA7XG4gICAgICAgICAgICBGaCA9IEVoIHwgMDtcbiAgICAgICAgICAgIEZsID0gRWwgfCAwO1xuICAgICAgICAgICAgKHsgaDogRWgsIGw6IEVsIH0gPSB1NjQuYWRkKERoIHwgMCwgRGwgfCAwLCBUMWggfCAwLCBUMWwgfCAwKSk7XG4gICAgICAgICAgICBEaCA9IENoIHwgMDtcbiAgICAgICAgICAgIERsID0gQ2wgfCAwO1xuICAgICAgICAgICAgQ2ggPSBCaCB8IDA7XG4gICAgICAgICAgICBDbCA9IEJsIHwgMDtcbiAgICAgICAgICAgIEJoID0gQWggfCAwO1xuICAgICAgICAgICAgQmwgPSBBbCB8IDA7XG4gICAgICAgICAgICBjb25zdCBBbGwgPSB1NjQuYWRkM0woVDFsLCBzaWdtYTBsLCBNQUpsKTtcbiAgICAgICAgICAgIEFoID0gdTY0LmFkZDNIKEFsbCwgVDFoLCBzaWdtYTBoLCBNQUpoKTtcbiAgICAgICAgICAgIEFsID0gQWxsIHwgMDtcbiAgICAgICAgfVxuICAgICAgICAvLyBBZGQgdGhlIGNvbXByZXNzZWQgY2h1bmsgdG8gdGhlIGN1cnJlbnQgaGFzaCB2YWx1ZVxuICAgICAgICAoeyBoOiBBaCwgbDogQWwgfSA9IHU2NC5hZGQodGhpcy5BaCB8IDAsIHRoaXMuQWwgfCAwLCBBaCB8IDAsIEFsIHwgMCkpO1xuICAgICAgICAoeyBoOiBCaCwgbDogQmwgfSA9IHU2NC5hZGQodGhpcy5CaCB8IDAsIHRoaXMuQmwgfCAwLCBCaCB8IDAsIEJsIHwgMCkpO1xuICAgICAgICAoeyBoOiBDaCwgbDogQ2wgfSA9IHU2NC5hZGQodGhpcy5DaCB8IDAsIHRoaXMuQ2wgfCAwLCBDaCB8IDAsIENsIHwgMCkpO1xuICAgICAgICAoeyBoOiBEaCwgbDogRGwgfSA9IHU2NC5hZGQodGhpcy5EaCB8IDAsIHRoaXMuRGwgfCAwLCBEaCB8IDAsIERsIHwgMCkpO1xuICAgICAgICAoeyBoOiBFaCwgbDogRWwgfSA9IHU2NC5hZGQodGhpcy5FaCB8IDAsIHRoaXMuRWwgfCAwLCBFaCB8IDAsIEVsIHwgMCkpO1xuICAgICAgICAoeyBoOiBGaCwgbDogRmwgfSA9IHU2NC5hZGQodGhpcy5GaCB8IDAsIHRoaXMuRmwgfCAwLCBGaCB8IDAsIEZsIHwgMCkpO1xuICAgICAgICAoeyBoOiBHaCwgbDogR2wgfSA9IHU2NC5hZGQodGhpcy5HaCB8IDAsIHRoaXMuR2wgfCAwLCBHaCB8IDAsIEdsIHwgMCkpO1xuICAgICAgICAoeyBoOiBIaCwgbDogSGwgfSA9IHU2NC5hZGQodGhpcy5IaCB8IDAsIHRoaXMuSGwgfCAwLCBIaCB8IDAsIEhsIHwgMCkpO1xuICAgICAgICB0aGlzLnNldChBaCwgQWwsIEJoLCBCbCwgQ2gsIENsLCBEaCwgRGwsIEVoLCBFbCwgRmgsIEZsLCBHaCwgR2wsIEhoLCBIbCk7XG4gICAgfVxuICAgIHJvdW5kQ2xlYW4oKSB7XG4gICAgICAgIGNsZWFuKFNIQTUxMl9XX0gsIFNIQTUxMl9XX0wpO1xuICAgIH1cbiAgICBkZXN0cm95KCkge1xuICAgICAgICBjbGVhbih0aGlzLmJ1ZmZlcik7XG4gICAgICAgIHRoaXMuc2V0KDAsIDAsIDAsIDAsIDAsIDAsIDAsIDAsIDAsIDAsIDAsIDAsIDAsIDAsIDAsIDApO1xuICAgIH1cbn1cbmV4cG9ydCBjbGFzcyBTSEEzODQgZXh0ZW5kcyBTSEE1MTIge1xuICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICBzdXBlcig0OCk7XG4gICAgICAgIHRoaXMuQWggPSBTSEEzODRfSVZbMF0gfCAwO1xuICAgICAgICB0aGlzLkFsID0gU0hBMzg0X0lWWzFdIHwgMDtcbiAgICAgICAgdGhpcy5CaCA9IFNIQTM4NF9JVlsyXSB8IDA7XG4gICAgICAgIHRoaXMuQmwgPSBTSEEzODRfSVZbM10gfCAwO1xuICAgICAgICB0aGlzLkNoID0gU0hBMzg0X0lWWzRdIHwgMDtcbiAgICAgICAgdGhpcy5DbCA9IFNIQTM4NF9JVls1XSB8IDA7XG4gICAgICAgIHRoaXMuRGggPSBTSEEzODRfSVZbNl0gfCAwO1xuICAgICAgICB0aGlzLkRsID0gU0hBMzg0X0lWWzddIHwgMDtcbiAgICAgICAgdGhpcy5FaCA9IFNIQTM4NF9JVls4XSB8IDA7XG4gICAgICAgIHRoaXMuRWwgPSBTSEEzODRfSVZbOV0gfCAwO1xuICAgICAgICB0aGlzLkZoID0gU0hBMzg0X0lWWzEwXSB8IDA7XG4gICAgICAgIHRoaXMuRmwgPSBTSEEzODRfSVZbMTFdIHwgMDtcbiAgICAgICAgdGhpcy5HaCA9IFNIQTM4NF9JVlsxMl0gfCAwO1xuICAgICAgICB0aGlzLkdsID0gU0hBMzg0X0lWWzEzXSB8IDA7XG4gICAgICAgIHRoaXMuSGggPSBTSEEzODRfSVZbMTRdIHwgMDtcbiAgICAgICAgdGhpcy5IbCA9IFNIQTM4NF9JVlsxNV0gfCAwO1xuICAgIH1cbn1cbi8qKlxuICogVHJ1bmNhdGVkIFNIQTUxMi8yNTYgYW5kIFNIQTUxMi8yMjQuXG4gKiBTSEE1MTJfSVYgaXMgWE9SZWQgd2l0aCAweGE1YTVhNWE1YTVhNWE1YTUsIHRoZW4gdXNlZCBhcyBcImludGVybWVkaWFyeVwiIElWIG9mIFNIQTUxMi90LlxuICogVGhlbiB0IGhhc2hlcyBzdHJpbmcgdG8gcHJvZHVjZSByZXN1bHQgSVYuXG4gKiBTZWUgYHRlc3QvbWlzYy9zaGEyLWdlbi1pdi5qc2AuXG4gKi9cbi8qKiBTSEE1MTIvMjI0IElWICovXG5jb25zdCBUMjI0X0lWID0gLyogQF9fUFVSRV9fICovIFVpbnQzMkFycmF5LmZyb20oW1xuICAgIDB4OGMzZDM3YzgsIDB4MTk1NDRkYTIsIDB4NzNlMTk5NjYsIDB4ODlkY2Q0ZDYsIDB4MWRmYWI3YWUsIDB4MzJmZjljODIsIDB4Njc5ZGQ1MTQsIDB4NTgyZjlmY2YsXG4gICAgMHgwZjZkMmI2OSwgMHg3YmQ0NGRhOCwgMHg3N2UzNmY3MywgMHgwNGM0ODk0MiwgMHgzZjlkODVhOCwgMHg2YTFkMzZjOCwgMHgxMTEyZTZhZCwgMHg5MWQ2OTJhMSxcbl0pO1xuLyoqIFNIQTUxMi8yNTYgSVYgKi9cbmNvbnN0IFQyNTZfSVYgPSAvKiBAX19QVVJFX18gKi8gVWludDMyQXJyYXkuZnJvbShbXG4gICAgMHgyMjMxMjE5NCwgMHhmYzJiZjcyYywgMHg5ZjU1NWZhMywgMHhjODRjNjRjMiwgMHgyMzkzYjg2YiwgMHg2ZjUzYjE1MSwgMHg5NjM4NzcxOSwgMHg1OTQwZWFiZCxcbiAgICAweDk2MjgzZWUyLCAweGE4OGVmZmUzLCAweGJlNWUxZTI1LCAweDUzODYzOTkyLCAweDJiMDE5OWZjLCAweDJjODViOGFhLCAweDBlYjcyZGRjLCAweDgxYzUyY2EyLFxuXSk7XG5leHBvcnQgY2xhc3MgU0hBNTEyXzIyNCBleHRlbmRzIFNIQTUxMiB7XG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHN1cGVyKDI4KTtcbiAgICAgICAgdGhpcy5BaCA9IFQyMjRfSVZbMF0gfCAwO1xuICAgICAgICB0aGlzLkFsID0gVDIyNF9JVlsxXSB8IDA7XG4gICAgICAgIHRoaXMuQmggPSBUMjI0X0lWWzJdIHwgMDtcbiAgICAgICAgdGhpcy5CbCA9IFQyMjRfSVZbM10gfCAwO1xuICAgICAgICB0aGlzLkNoID0gVDIyNF9JVls0XSB8IDA7XG4gICAgICAgIHRoaXMuQ2wgPSBUMjI0X0lWWzVdIHwgMDtcbiAgICAgICAgdGhpcy5EaCA9IFQyMjRfSVZbNl0gfCAwO1xuICAgICAgICB0aGlzLkRsID0gVDIyNF9JVls3XSB8IDA7XG4gICAgICAgIHRoaXMuRWggPSBUMjI0X0lWWzhdIHwgMDtcbiAgICAgICAgdGhpcy5FbCA9IFQyMjRfSVZbOV0gfCAwO1xuICAgICAgICB0aGlzLkZoID0gVDIyNF9JVlsxMF0gfCAwO1xuICAgICAgICB0aGlzLkZsID0gVDIyNF9JVlsxMV0gfCAwO1xuICAgICAgICB0aGlzLkdoID0gVDIyNF9JVlsxMl0gfCAwO1xuICAgICAgICB0aGlzLkdsID0gVDIyNF9JVlsxM10gfCAwO1xuICAgICAgICB0aGlzLkhoID0gVDIyNF9JVlsxNF0gfCAwO1xuICAgICAgICB0aGlzLkhsID0gVDIyNF9JVlsxNV0gfCAwO1xuICAgIH1cbn1cbmV4cG9ydCBjbGFzcyBTSEE1MTJfMjU2IGV4dGVuZHMgU0hBNTEyIHtcbiAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgc3VwZXIoMzIpO1xuICAgICAgICB0aGlzLkFoID0gVDI1Nl9JVlswXSB8IDA7XG4gICAgICAgIHRoaXMuQWwgPSBUMjU2X0lWWzFdIHwgMDtcbiAgICAgICAgdGhpcy5CaCA9IFQyNTZfSVZbMl0gfCAwO1xuICAgICAgICB0aGlzLkJsID0gVDI1Nl9JVlszXSB8IDA7XG4gICAgICAgIHRoaXMuQ2ggPSBUMjU2X0lWWzRdIHwgMDtcbiAgICAgICAgdGhpcy5DbCA9IFQyNTZfSVZbNV0gfCAwO1xuICAgICAgICB0aGlzLkRoID0gVDI1Nl9JVls2XSB8IDA7XG4gICAgICAgIHRoaXMuRGwgPSBUMjU2X0lWWzddIHwgMDtcbiAgICAgICAgdGhpcy5FaCA9IFQyNTZfSVZbOF0gfCAwO1xuICAgICAgICB0aGlzLkVsID0gVDI1Nl9JVls5XSB8IDA7XG4gICAgICAgIHRoaXMuRmggPSBUMjU2X0lWWzEwXSB8IDA7XG4gICAgICAgIHRoaXMuRmwgPSBUMjU2X0lWWzExXSB8IDA7XG4gICAgICAgIHRoaXMuR2ggPSBUMjU2X0lWWzEyXSB8IDA7XG4gICAgICAgIHRoaXMuR2wgPSBUMjU2X0lWWzEzXSB8IDA7XG4gICAgICAgIHRoaXMuSGggPSBUMjU2X0lWWzE0XSB8IDA7XG4gICAgICAgIHRoaXMuSGwgPSBUMjU2X0lWWzE1XSB8IDA7XG4gICAgfVxufVxuLyoqXG4gKiBTSEEyLTI1NiBoYXNoIGZ1bmN0aW9uIGZyb20gUkZDIDQ2MzQuXG4gKlxuICogSXQgaXMgdGhlIGZhc3Rlc3QgSlMgaGFzaCwgZXZlbiBmYXN0ZXIgdGhhbiBCbGFrZTMuXG4gKiBUbyBicmVhayBzaGEyNTYgdXNpbmcgYmlydGhkYXkgYXR0YWNrLCBhdHRhY2tlcnMgbmVlZCB0byB0cnkgMl4xMjggaGFzaGVzLlxuICogQlRDIG5ldHdvcmsgaXMgZG9pbmcgMl43MCBoYXNoZXMvc2VjICgyXjk1IGhhc2hlcy95ZWFyKSBhcyBwZXIgMjAyNS5cbiAqL1xuZXhwb3J0IGNvbnN0IHNoYTI1NiA9IC8qIEBfX1BVUkVfXyAqLyBjcmVhdGVIYXNoZXIoKCkgPT4gbmV3IFNIQTI1NigpKTtcbi8qKiBTSEEyLTIyNCBoYXNoIGZ1bmN0aW9uIGZyb20gUkZDIDQ2MzQgKi9cbmV4cG9ydCBjb25zdCBzaGEyMjQgPSAvKiBAX19QVVJFX18gKi8gY3JlYXRlSGFzaGVyKCgpID0+IG5ldyBTSEEyMjQoKSk7XG4vKiogU0hBMi01MTIgaGFzaCBmdW5jdGlvbiBmcm9tIFJGQyA0NjM0LiAqL1xuZXhwb3J0IGNvbnN0IHNoYTUxMiA9IC8qIEBfX1BVUkVfXyAqLyBjcmVhdGVIYXNoZXIoKCkgPT4gbmV3IFNIQTUxMigpKTtcbi8qKiBTSEEyLTM4NCBoYXNoIGZ1bmN0aW9uIGZyb20gUkZDIDQ2MzQuICovXG5leHBvcnQgY29uc3Qgc2hhMzg0ID0gLyogQF9fUFVSRV9fICovIGNyZWF0ZUhhc2hlcigoKSA9PiBuZXcgU0hBMzg0KCkpO1xuLyoqXG4gKiBTSEEyLTUxMi8yNTYgXCJ0cnVuY2F0ZWRcIiBoYXNoIGZ1bmN0aW9uLCB3aXRoIGltcHJvdmVkIHJlc2lzdGFuY2UgdG8gbGVuZ3RoIGV4dGVuc2lvbiBhdHRhY2tzLlxuICogU2VlIHRoZSBwYXBlciBvbiBbdHJ1bmNhdGVkIFNIQTUxMl0oaHR0cHM6Ly9lcHJpbnQuaWFjci5vcmcvMjAxMC81NDgucGRmKS5cbiAqL1xuZXhwb3J0IGNvbnN0IHNoYTUxMl8yNTYgPSAvKiBAX19QVVJFX18gKi8gY3JlYXRlSGFzaGVyKCgpID0+IG5ldyBTSEE1MTJfMjU2KCkpO1xuLyoqXG4gKiBTSEEyLTUxMi8yMjQgXCJ0cnVuY2F0ZWRcIiBoYXNoIGZ1bmN0aW9uLCB3aXRoIGltcHJvdmVkIHJlc2lzdGFuY2UgdG8gbGVuZ3RoIGV4dGVuc2lvbiBhdHRhY2tzLlxuICogU2VlIHRoZSBwYXBlciBvbiBbdHJ1bmNhdGVkIFNIQTUxMl0oaHR0cHM6Ly9lcHJpbnQuaWFjci5vcmcvMjAxMC81NDgucGRmKS5cbiAqL1xuZXhwb3J0IGNvbnN0IHNoYTUxMl8yMjQgPSAvKiBAX19QVVJFX18gKi8gY3JlYXRlSGFzaGVyKCgpID0+IG5ldyBTSEE1MTJfMjI0KCkpO1xuLy8jIHNvdXJjZU1hcHBpbmdVUkw9c2hhMi5qcy5tYXAiLAogICAgIi8qKlxuICogSE1BQzogUkZDMjEwNCBtZXNzYWdlIGF1dGhlbnRpY2F0aW9uIGNvZGUuXG4gKiBAbW9kdWxlXG4gKi9cbmltcG9ydCB7IGFieXRlcywgYWV4aXN0cywgYWhhc2gsIGNsZWFuLCBIYXNoLCB0b0J5dGVzIH0gZnJvbSBcIi4vdXRpbHMuanNcIjtcbmV4cG9ydCBjbGFzcyBITUFDIGV4dGVuZHMgSGFzaCB7XG4gICAgY29uc3RydWN0b3IoaGFzaCwgX2tleSkge1xuICAgICAgICBzdXBlcigpO1xuICAgICAgICB0aGlzLmZpbmlzaGVkID0gZmFsc2U7XG4gICAgICAgIHRoaXMuZGVzdHJveWVkID0gZmFsc2U7XG4gICAgICAgIGFoYXNoKGhhc2gpO1xuICAgICAgICBjb25zdCBrZXkgPSB0b0J5dGVzKF9rZXkpO1xuICAgICAgICB0aGlzLmlIYXNoID0gaGFzaC5jcmVhdGUoKTtcbiAgICAgICAgaWYgKHR5cGVvZiB0aGlzLmlIYXNoLnVwZGF0ZSAhPT0gJ2Z1bmN0aW9uJylcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignRXhwZWN0ZWQgaW5zdGFuY2Ugb2YgY2xhc3Mgd2hpY2ggZXh0ZW5kcyB1dGlscy5IYXNoJyk7XG4gICAgICAgIHRoaXMuYmxvY2tMZW4gPSB0aGlzLmlIYXNoLmJsb2NrTGVuO1xuICAgICAgICB0aGlzLm91dHB1dExlbiA9IHRoaXMuaUhhc2gub3V0cHV0TGVuO1xuICAgICAgICBjb25zdCBibG9ja0xlbiA9IHRoaXMuYmxvY2tMZW47XG4gICAgICAgIGNvbnN0IHBhZCA9IG5ldyBVaW50OEFycmF5KGJsb2NrTGVuKTtcbiAgICAgICAgLy8gYmxvY2tMZW4gY2FuIGJlIGJpZ2dlciB0aGFuIG91dHB1dExlblxuICAgICAgICBwYWQuc2V0KGtleS5sZW5ndGggPiBibG9ja0xlbiA/IGhhc2guY3JlYXRlKCkudXBkYXRlKGtleSkuZGlnZXN0KCkgOiBrZXkpO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHBhZC5sZW5ndGg7IGkrKylcbiAgICAgICAgICAgIHBhZFtpXSBePSAweDM2O1xuICAgICAgICB0aGlzLmlIYXNoLnVwZGF0ZShwYWQpO1xuICAgICAgICAvLyBCeSBkb2luZyB1cGRhdGUgKHByb2Nlc3Npbmcgb2YgZmlyc3QgYmxvY2spIG9mIG91dGVyIGhhc2ggaGVyZSB3ZSBjYW4gcmUtdXNlIGl0IGJldHdlZW4gbXVsdGlwbGUgY2FsbHMgdmlhIGNsb25lXG4gICAgICAgIHRoaXMub0hhc2ggPSBoYXNoLmNyZWF0ZSgpO1xuICAgICAgICAvLyBVbmRvIGludGVybmFsIFhPUiAmJiBhcHBseSBvdXRlciBYT1JcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBwYWQubGVuZ3RoOyBpKyspXG4gICAgICAgICAgICBwYWRbaV0gXj0gMHgzNiBeIDB4NWM7XG4gICAgICAgIHRoaXMub0hhc2gudXBkYXRlKHBhZCk7XG4gICAgICAgIGNsZWFuKHBhZCk7XG4gICAgfVxuICAgIHVwZGF0ZShidWYpIHtcbiAgICAgICAgYWV4aXN0cyh0aGlzKTtcbiAgICAgICAgdGhpcy5pSGFzaC51cGRhdGUoYnVmKTtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuICAgIGRpZ2VzdEludG8ob3V0KSB7XG4gICAgICAgIGFleGlzdHModGhpcyk7XG4gICAgICAgIGFieXRlcyhvdXQsIHRoaXMub3V0cHV0TGVuKTtcbiAgICAgICAgdGhpcy5maW5pc2hlZCA9IHRydWU7XG4gICAgICAgIHRoaXMuaUhhc2guZGlnZXN0SW50byhvdXQpO1xuICAgICAgICB0aGlzLm9IYXNoLnVwZGF0ZShvdXQpO1xuICAgICAgICB0aGlzLm9IYXNoLmRpZ2VzdEludG8ob3V0KTtcbiAgICAgICAgdGhpcy5kZXN0cm95KCk7XG4gICAgfVxuICAgIGRpZ2VzdCgpIHtcbiAgICAgICAgY29uc3Qgb3V0ID0gbmV3IFVpbnQ4QXJyYXkodGhpcy5vSGFzaC5vdXRwdXRMZW4pO1xuICAgICAgICB0aGlzLmRpZ2VzdEludG8ob3V0KTtcbiAgICAgICAgcmV0dXJuIG91dDtcbiAgICB9XG4gICAgX2Nsb25lSW50byh0bykge1xuICAgICAgICAvLyBDcmVhdGUgbmV3IGluc3RhbmNlIHdpdGhvdXQgY2FsbGluZyBjb25zdHJ1Y3RvciBzaW5jZSBrZXkgYWxyZWFkeSBpbiBzdGF0ZSBhbmQgd2UgZG9uJ3Qga25vdyBpdC5cbiAgICAgICAgdG8gfHwgKHRvID0gT2JqZWN0LmNyZWF0ZShPYmplY3QuZ2V0UHJvdG90eXBlT2YodGhpcyksIHt9KSk7XG4gICAgICAgIGNvbnN0IHsgb0hhc2gsIGlIYXNoLCBmaW5pc2hlZCwgZGVzdHJveWVkLCBibG9ja0xlbiwgb3V0cHV0TGVuIH0gPSB0aGlzO1xuICAgICAgICB0byA9IHRvO1xuICAgICAgICB0by5maW5pc2hlZCA9IGZpbmlzaGVkO1xuICAgICAgICB0by5kZXN0cm95ZWQgPSBkZXN0cm95ZWQ7XG4gICAgICAgIHRvLmJsb2NrTGVuID0gYmxvY2tMZW47XG4gICAgICAgIHRvLm91dHB1dExlbiA9IG91dHB1dExlbjtcbiAgICAgICAgdG8ub0hhc2ggPSBvSGFzaC5fY2xvbmVJbnRvKHRvLm9IYXNoKTtcbiAgICAgICAgdG8uaUhhc2ggPSBpSGFzaC5fY2xvbmVJbnRvKHRvLmlIYXNoKTtcbiAgICAgICAgcmV0dXJuIHRvO1xuICAgIH1cbiAgICBjbG9uZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2Nsb25lSW50bygpO1xuICAgIH1cbiAgICBkZXN0cm95KCkge1xuICAgICAgICB0aGlzLmRlc3Ryb3llZCA9IHRydWU7XG4gICAgICAgIHRoaXMub0hhc2guZGVzdHJveSgpO1xuICAgICAgICB0aGlzLmlIYXNoLmRlc3Ryb3koKTtcbiAgICB9XG59XG4vKipcbiAqIEhNQUM6IFJGQzIxMDQgbWVzc2FnZSBhdXRoZW50aWNhdGlvbiBjb2RlLlxuICogQHBhcmFtIGhhc2ggLSBmdW5jdGlvbiB0aGF0IHdvdWxkIGJlIHVzZWQgZS5nLiBzaGEyNTZcbiAqIEBwYXJhbSBrZXkgLSBtZXNzYWdlIGtleVxuICogQHBhcmFtIG1lc3NhZ2UgLSBtZXNzYWdlIGRhdGFcbiAqIEBleGFtcGxlXG4gKiBpbXBvcnQgeyBobWFjIH0gZnJvbSAnQG5vYmxlL2hhc2hlcy9obWFjJztcbiAqIGltcG9ydCB7IHNoYTI1NiB9IGZyb20gJ0Bub2JsZS9oYXNoZXMvc2hhMic7XG4gKiBjb25zdCBtYWMxID0gaG1hYyhzaGEyNTYsICdrZXknLCAnbWVzc2FnZScpO1xuICovXG5leHBvcnQgY29uc3QgaG1hYyA9IChoYXNoLCBrZXksIG1lc3NhZ2UpID0+IG5ldyBITUFDKGhhc2gsIGtleSkudXBkYXRlKG1lc3NhZ2UpLmRpZ2VzdCgpO1xuaG1hYy5jcmVhdGUgPSAoaGFzaCwga2V5KSA9PiBuZXcgSE1BQyhoYXNoLCBrZXkpO1xuLy8jIHNvdXJjZU1hcHBpbmdVUkw9aG1hYy5qcy5tYXAiLAogICAgIi8qKlxuICogSGV4LCBieXRlcyBhbmQgbnVtYmVyIHV0aWxpdGllcy5cbiAqIEBtb2R1bGVcbiAqL1xuLyohIG5vYmxlLWN1cnZlcyAtIE1JVCBMaWNlbnNlIChjKSAyMDIyIFBhdWwgTWlsbGVyIChwYXVsbWlsbHIuY29tKSAqL1xuaW1wb3J0IHsgYWJ5dGVzIGFzIGFieXRlc18sIGJ5dGVzVG9IZXggYXMgYnl0ZXNUb0hleF8sIGNvbmNhdEJ5dGVzIGFzIGNvbmNhdEJ5dGVzXywgaGV4VG9CeXRlcyBhcyBoZXhUb0J5dGVzXywgaXNCeXRlcyBhcyBpc0J5dGVzXywgfSBmcm9tICdAbm9ibGUvaGFzaGVzL3V0aWxzLmpzJztcbmV4cG9ydCB7IGFieXRlcywgYW51bWJlciwgYnl0ZXNUb0hleCwgYnl0ZXNUb1V0ZjgsIGNvbmNhdEJ5dGVzLCBoZXhUb0J5dGVzLCBpc0J5dGVzLCByYW5kb21CeXRlcywgdXRmOFRvQnl0ZXMsIH0gZnJvbSAnQG5vYmxlL2hhc2hlcy91dGlscy5qcyc7XG5jb25zdCBfMG4gPSAvKiBAX19QVVJFX18gKi8gQmlnSW50KDApO1xuY29uc3QgXzFuID0gLyogQF9fUFVSRV9fICovIEJpZ0ludCgxKTtcbmV4cG9ydCBmdW5jdGlvbiBhYm9vbCh0aXRsZSwgdmFsdWUpIHtcbiAgICBpZiAodHlwZW9mIHZhbHVlICE9PSAnYm9vbGVhbicpXG4gICAgICAgIHRocm93IG5ldyBFcnJvcih0aXRsZSArICcgYm9vbGVhbiBleHBlY3RlZCwgZ290ICcgKyB2YWx1ZSk7XG59XG4vLyB0bXAgbmFtZSB1bnRpbCB2MlxuZXhwb3J0IGZ1bmN0aW9uIF9hYm9vbDIodmFsdWUsIHRpdGxlID0gJycpIHtcbiAgICBpZiAodHlwZW9mIHZhbHVlICE9PSAnYm9vbGVhbicpIHtcbiAgICAgICAgY29uc3QgcHJlZml4ID0gdGl0bGUgJiYgYFwiJHt0aXRsZX1cImA7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihwcmVmaXggKyAnZXhwZWN0ZWQgYm9vbGVhbiwgZ290IHR5cGU9JyArIHR5cGVvZiB2YWx1ZSk7XG4gICAgfVxuICAgIHJldHVybiB2YWx1ZTtcbn1cbi8vIHRtcCBuYW1lIHVudGlsIHYyXG4vKiogQXNzZXJ0cyBzb21ldGhpbmcgaXMgVWludDhBcnJheS4gKi9cbmV4cG9ydCBmdW5jdGlvbiBfYWJ5dGVzMih2YWx1ZSwgbGVuZ3RoLCB0aXRsZSA9ICcnKSB7XG4gICAgY29uc3QgYnl0ZXMgPSBpc0J5dGVzXyh2YWx1ZSk7XG4gICAgY29uc3QgbGVuID0gdmFsdWU/Lmxlbmd0aDtcbiAgICBjb25zdCBuZWVkc0xlbiA9IGxlbmd0aCAhPT0gdW5kZWZpbmVkO1xuICAgIGlmICghYnl0ZXMgfHwgKG5lZWRzTGVuICYmIGxlbiAhPT0gbGVuZ3RoKSkge1xuICAgICAgICBjb25zdCBwcmVmaXggPSB0aXRsZSAmJiBgXCIke3RpdGxlfVwiIGA7XG4gICAgICAgIGNvbnN0IG9mTGVuID0gbmVlZHNMZW4gPyBgIG9mIGxlbmd0aCAke2xlbmd0aH1gIDogJyc7XG4gICAgICAgIGNvbnN0IGdvdCA9IGJ5dGVzID8gYGxlbmd0aD0ke2xlbn1gIDogYHR5cGU9JHt0eXBlb2YgdmFsdWV9YDtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKHByZWZpeCArICdleHBlY3RlZCBVaW50OEFycmF5JyArIG9mTGVuICsgJywgZ290ICcgKyBnb3QpO1xuICAgIH1cbiAgICByZXR1cm4gdmFsdWU7XG59XG4vLyBVc2VkIGluIHdlaWVyc3RyYXNzLCBkZXJcbmV4cG9ydCBmdW5jdGlvbiBudW1iZXJUb0hleFVucGFkZGVkKG51bSkge1xuICAgIGNvbnN0IGhleCA9IG51bS50b1N0cmluZygxNik7XG4gICAgcmV0dXJuIGhleC5sZW5ndGggJiAxID8gJzAnICsgaGV4IDogaGV4O1xufVxuZXhwb3J0IGZ1bmN0aW9uIGhleFRvTnVtYmVyKGhleCkge1xuICAgIGlmICh0eXBlb2YgaGV4ICE9PSAnc3RyaW5nJylcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdoZXggc3RyaW5nIGV4cGVjdGVkLCBnb3QgJyArIHR5cGVvZiBoZXgpO1xuICAgIHJldHVybiBoZXggPT09ICcnID8gXzBuIDogQmlnSW50KCcweCcgKyBoZXgpOyAvLyBCaWcgRW5kaWFuXG59XG4vLyBCRTogQmlnIEVuZGlhbiwgTEU6IExpdHRsZSBFbmRpYW5cbmV4cG9ydCBmdW5jdGlvbiBieXRlc1RvTnVtYmVyQkUoYnl0ZXMpIHtcbiAgICByZXR1cm4gaGV4VG9OdW1iZXIoYnl0ZXNUb0hleF8oYnl0ZXMpKTtcbn1cbmV4cG9ydCBmdW5jdGlvbiBieXRlc1RvTnVtYmVyTEUoYnl0ZXMpIHtcbiAgICBhYnl0ZXNfKGJ5dGVzKTtcbiAgICByZXR1cm4gaGV4VG9OdW1iZXIoYnl0ZXNUb0hleF8oVWludDhBcnJheS5mcm9tKGJ5dGVzKS5yZXZlcnNlKCkpKTtcbn1cbmV4cG9ydCBmdW5jdGlvbiBudW1iZXJUb0J5dGVzQkUobiwgbGVuKSB7XG4gICAgcmV0dXJuIGhleFRvQnl0ZXNfKG4udG9TdHJpbmcoMTYpLnBhZFN0YXJ0KGxlbiAqIDIsICcwJykpO1xufVxuZXhwb3J0IGZ1bmN0aW9uIG51bWJlclRvQnl0ZXNMRShuLCBsZW4pIHtcbiAgICByZXR1cm4gbnVtYmVyVG9CeXRlc0JFKG4sIGxlbikucmV2ZXJzZSgpO1xufVxuLy8gVW5wYWRkZWQsIHJhcmVseSB1c2VkXG5leHBvcnQgZnVuY3Rpb24gbnVtYmVyVG9WYXJCeXRlc0JFKG4pIHtcbiAgICByZXR1cm4gaGV4VG9CeXRlc18obnVtYmVyVG9IZXhVbnBhZGRlZChuKSk7XG59XG4vKipcbiAqIFRha2VzIGhleCBzdHJpbmcgb3IgVWludDhBcnJheSwgY29udmVydHMgdG8gVWludDhBcnJheS5cbiAqIFZhbGlkYXRlcyBvdXRwdXQgbGVuZ3RoLlxuICogV2lsbCB0aHJvdyBlcnJvciBmb3Igb3RoZXIgdHlwZXMuXG4gKiBAcGFyYW0gdGl0bGUgZGVzY3JpcHRpdmUgdGl0bGUgZm9yIGFuIGVycm9yIGUuZy4gJ3NlY3JldCBrZXknXG4gKiBAcGFyYW0gaGV4IGhleCBzdHJpbmcgb3IgVWludDhBcnJheVxuICogQHBhcmFtIGV4cGVjdGVkTGVuZ3RoIG9wdGlvbmFsLCB3aWxsIGNvbXBhcmUgdG8gcmVzdWx0IGFycmF5J3MgbGVuZ3RoXG4gKiBAcmV0dXJuc1xuICovXG5leHBvcnQgZnVuY3Rpb24gZW5zdXJlQnl0ZXModGl0bGUsIGhleCwgZXhwZWN0ZWRMZW5ndGgpIHtcbiAgICBsZXQgcmVzO1xuICAgIGlmICh0eXBlb2YgaGV4ID09PSAnc3RyaW5nJykge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgcmVzID0gaGV4VG9CeXRlc18oaGV4KTtcbiAgICAgICAgfVxuICAgICAgICBjYXRjaCAoZSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKHRpdGxlICsgJyBtdXN0IGJlIGhleCBzdHJpbmcgb3IgVWludDhBcnJheSwgY2F1c2U6ICcgKyBlKTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBlbHNlIGlmIChpc0J5dGVzXyhoZXgpKSB7XG4gICAgICAgIC8vIFVpbnQ4QXJyYXkuZnJvbSgpIGluc3RlYWQgb2YgaGFzaC5zbGljZSgpIGJlY2F1c2Ugbm9kZS5qcyBCdWZmZXJcbiAgICAgICAgLy8gaXMgaW5zdGFuY2Ugb2YgVWludDhBcnJheSwgYW5kIGl0cyBzbGljZSgpIGNyZWF0ZXMgKiptdXRhYmxlKiogY29weVxuICAgICAgICByZXMgPSBVaW50OEFycmF5LmZyb20oaGV4KTtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcih0aXRsZSArICcgbXVzdCBiZSBoZXggc3RyaW5nIG9yIFVpbnQ4QXJyYXknKTtcbiAgICB9XG4gICAgY29uc3QgbGVuID0gcmVzLmxlbmd0aDtcbiAgICBpZiAodHlwZW9mIGV4cGVjdGVkTGVuZ3RoID09PSAnbnVtYmVyJyAmJiBsZW4gIT09IGV4cGVjdGVkTGVuZ3RoKVxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IodGl0bGUgKyAnIG9mIGxlbmd0aCAnICsgZXhwZWN0ZWRMZW5ndGggKyAnIGV4cGVjdGVkLCBnb3QgJyArIGxlbik7XG4gICAgcmV0dXJuIHJlcztcbn1cbi8vIENvbXBhcmVzIDIgdThhLXMgaW4ga2luZGEgY29uc3RhbnQgdGltZVxuZXhwb3J0IGZ1bmN0aW9uIGVxdWFsQnl0ZXMoYSwgYikge1xuICAgIGlmIChhLmxlbmd0aCAhPT0gYi5sZW5ndGgpXG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICBsZXQgZGlmZiA9IDA7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBhLmxlbmd0aDsgaSsrKVxuICAgICAgICBkaWZmIHw9IGFbaV0gXiBiW2ldO1xuICAgIHJldHVybiBkaWZmID09PSAwO1xufVxuLyoqXG4gKiBDb3BpZXMgVWludDhBcnJheS4gV2UgY2FuJ3QgdXNlIHU4YS5zbGljZSgpLCBiZWNhdXNlIHU4YSBjYW4gYmUgQnVmZmVyLFxuICogYW5kIEJ1ZmZlciNzbGljZSBjcmVhdGVzIG11dGFibGUgY29weS4gTmV2ZXIgdXNlIEJ1ZmZlcnMhXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjb3B5Qnl0ZXMoYnl0ZXMpIHtcbiAgICByZXR1cm4gVWludDhBcnJheS5mcm9tKGJ5dGVzKTtcbn1cbi8qKlxuICogRGVjb2RlcyA3LWJpdCBBU0NJSSBzdHJpbmcgdG8gVWludDhBcnJheSwgdGhyb3dzIG9uIG5vbi1hc2NpaSBzeW1ib2xzXG4gKiBTaG91bGQgYmUgc2FmZSB0byB1c2UgZm9yIHRoaW5ncyBleHBlY3RlZCB0byBiZSBBU0NJSS5cbiAqIFJldHVybnMgZXhhY3Qgc2FtZSByZXN1bHQgYXMgdXRmOFRvQnl0ZXMgZm9yIEFTQ0lJIG9yIHRocm93cy5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGFzY2lpVG9CeXRlcyhhc2NpaSkge1xuICAgIHJldHVybiBVaW50OEFycmF5LmZyb20oYXNjaWksIChjLCBpKSA9PiB7XG4gICAgICAgIGNvbnN0IGNoYXJDb2RlID0gYy5jaGFyQ29kZUF0KDApO1xuICAgICAgICBpZiAoYy5sZW5ndGggIT09IDEgfHwgY2hhckNvZGUgPiAxMjcpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgc3RyaW5nIGNvbnRhaW5zIG5vbi1BU0NJSSBjaGFyYWN0ZXIgXCIke2FzY2lpW2ldfVwiIHdpdGggY29kZSAke2NoYXJDb2RlfSBhdCBwb3NpdGlvbiAke2l9YCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGNoYXJDb2RlO1xuICAgIH0pO1xufVxuLyoqXG4gKiBAZXhhbXBsZSB1dGY4VG9CeXRlcygnYWJjJykgLy8gbmV3IFVpbnQ4QXJyYXkoWzk3LCA5OCwgOTldKVxuICovXG4vLyBleHBvcnQgY29uc3QgdXRmOFRvQnl0ZXM6IHR5cGVvZiB1dGY4VG9CeXRlc18gPSB1dGY4VG9CeXRlc187XG4vKipcbiAqIENvbnZlcnRzIGJ5dGVzIHRvIHN0cmluZyB1c2luZyBVVEY4IGVuY29kaW5nLlxuICogQGV4YW1wbGUgYnl0ZXNUb1V0ZjgoVWludDhBcnJheS5mcm9tKFs5NywgOTgsIDk5XSkpIC8vICdhYmMnXG4gKi9cbi8vIGV4cG9ydCBjb25zdCBieXRlc1RvVXRmODogdHlwZW9mIGJ5dGVzVG9VdGY4XyA9IGJ5dGVzVG9VdGY4Xztcbi8vIElzIHBvc2l0aXZlIGJpZ2ludFxuY29uc3QgaXNQb3NCaWcgPSAobikgPT4gdHlwZW9mIG4gPT09ICdiaWdpbnQnICYmIF8wbiA8PSBuO1xuZXhwb3J0IGZ1bmN0aW9uIGluUmFuZ2UobiwgbWluLCBtYXgpIHtcbiAgICByZXR1cm4gaXNQb3NCaWcobikgJiYgaXNQb3NCaWcobWluKSAmJiBpc1Bvc0JpZyhtYXgpICYmIG1pbiA8PSBuICYmIG4gPCBtYXg7XG59XG4vKipcbiAqIEFzc2VydHMgbWluIDw9IG4gPCBtYXguIE5PVEU6IEl0J3MgPCBtYXggYW5kIG5vdCA8PSBtYXguXG4gKiBAZXhhbXBsZVxuICogYUluUmFuZ2UoJ3gnLCB4LCAxbiwgMjU2bik7IC8vIHdvdWxkIGFzc3VtZSB4IGlzIGluICgxbi4uMjU1bilcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGFJblJhbmdlKHRpdGxlLCBuLCBtaW4sIG1heCkge1xuICAgIC8vIFdoeSBtaW4gPD0gbiA8IG1heCBhbmQgbm90IGEgKG1pbiA8IG4gPCBtYXgpIE9SIGIgKG1pbiA8PSBuIDw9IG1heCk/XG4gICAgLy8gY29uc2lkZXIgUD0yNTZuLCBtaW49MG4sIG1heD1QXG4gICAgLy8gLSBhIGZvciBtaW49MCB3b3VsZCByZXF1aXJlIC0xOiAgICAgICAgICBgaW5SYW5nZSgneCcsIHgsIC0xbiwgUClgXG4gICAgLy8gLSBiIHdvdWxkIGNvbW1vbmx5IHJlcXVpcmUgc3VidHJhY3Rpb246ICBgaW5SYW5nZSgneCcsIHgsIDBuLCBQIC0gMW4pYFxuICAgIC8vIC0gb3VyIHdheSBpcyB0aGUgY2xlYW5lc3Q6ICAgICAgICAgICAgICAgYGluUmFuZ2UoJ3gnLCB4LCAwbiwgUClcbiAgICBpZiAoIWluUmFuZ2UobiwgbWluLCBtYXgpKVxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ2V4cGVjdGVkIHZhbGlkICcgKyB0aXRsZSArICc6ICcgKyBtaW4gKyAnIDw9IG4gPCAnICsgbWF4ICsgJywgZ290ICcgKyBuKTtcbn1cbi8vIEJpdCBvcGVyYXRpb25zXG4vKipcbiAqIENhbGN1bGF0ZXMgYW1vdW50IG9mIGJpdHMgaW4gYSBiaWdpbnQuXG4gKiBTYW1lIGFzIGBuLnRvU3RyaW5nKDIpLmxlbmd0aGBcbiAqIFRPRE86IG1lcmdlIHdpdGggbkxlbmd0aCBpbiBtb2R1bGFyXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBiaXRMZW4obikge1xuICAgIGxldCBsZW47XG4gICAgZm9yIChsZW4gPSAwOyBuID4gXzBuOyBuID4+PSBfMW4sIGxlbiArPSAxKVxuICAgICAgICA7XG4gICAgcmV0dXJuIGxlbjtcbn1cbi8qKlxuICogR2V0cyBzaW5nbGUgYml0IGF0IHBvc2l0aW9uLlxuICogTk9URTogZmlyc3QgYml0IHBvc2l0aW9uIGlzIDAgKHNhbWUgYXMgYXJyYXlzKVxuICogU2FtZSBhcyBgISErQXJyYXkuZnJvbShuLnRvU3RyaW5nKDIpKS5yZXZlcnNlKClbcG9zXWBcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGJpdEdldChuLCBwb3MpIHtcbiAgICByZXR1cm4gKG4gPj4gQmlnSW50KHBvcykpICYgXzFuO1xufVxuLyoqXG4gKiBTZXRzIHNpbmdsZSBiaXQgYXQgcG9zaXRpb24uXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBiaXRTZXQobiwgcG9zLCB2YWx1ZSkge1xuICAgIHJldHVybiBuIHwgKCh2YWx1ZSA/IF8xbiA6IF8wbikgPDwgQmlnSW50KHBvcykpO1xufVxuLyoqXG4gKiBDYWxjdWxhdGUgbWFzayBmb3IgTiBiaXRzLiBOb3QgdXNpbmcgKiogb3BlcmF0b3Igd2l0aCBiaWdpbnRzIGJlY2F1c2Ugb2Ygb2xkIGVuZ2luZXMuXG4gKiBTYW1lIGFzIEJpZ0ludChgMGIke0FycmF5KGkpLmZpbGwoJzEnKS5qb2luKCcnKX1gKVxuICovXG5leHBvcnQgY29uc3QgYml0TWFzayA9IChuKSA9PiAoXzFuIDw8IEJpZ0ludChuKSkgLSBfMW47XG4vKipcbiAqIE1pbmltYWwgSE1BQy1EUkJHIGZyb20gTklTVCA4MDAtOTAgZm9yIFJGQzY5Nzkgc2lncy5cbiAqIEByZXR1cm5zIGZ1bmN0aW9uIHRoYXQgd2lsbCBjYWxsIERSQkcgdW50aWwgMm5kIGFyZyByZXR1cm5zIHNvbWV0aGluZyBtZWFuaW5nZnVsXG4gKiBAZXhhbXBsZVxuICogICBjb25zdCBkcmJnID0gY3JlYXRlSG1hY0RSQkc8S2V5PigzMiwgMzIsIGhtYWMpO1xuICogICBkcmJnKHNlZWQsIGJ5dGVzVG9LZXkpOyAvLyBieXRlc1RvS2V5IG11c3QgcmV0dXJuIEtleSBvciB1bmRlZmluZWRcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUhtYWNEcmJnKGhhc2hMZW4sIHFCeXRlTGVuLCBobWFjRm4pIHtcbiAgICBpZiAodHlwZW9mIGhhc2hMZW4gIT09ICdudW1iZXInIHx8IGhhc2hMZW4gPCAyKVxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ2hhc2hMZW4gbXVzdCBiZSBhIG51bWJlcicpO1xuICAgIGlmICh0eXBlb2YgcUJ5dGVMZW4gIT09ICdudW1iZXInIHx8IHFCeXRlTGVuIDwgMilcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdxQnl0ZUxlbiBtdXN0IGJlIGEgbnVtYmVyJyk7XG4gICAgaWYgKHR5cGVvZiBobWFjRm4gIT09ICdmdW5jdGlvbicpXG4gICAgICAgIHRocm93IG5ldyBFcnJvcignaG1hY0ZuIG11c3QgYmUgYSBmdW5jdGlvbicpO1xuICAgIC8vIFN0ZXAgQiwgU3RlcCBDOiBzZXQgaGFzaExlbiB0byA4KmNlaWwoaGxlbi84KVxuICAgIGNvbnN0IHU4biA9IChsZW4pID0+IG5ldyBVaW50OEFycmF5KGxlbik7IC8vIGNyZWF0ZXMgVWludDhBcnJheVxuICAgIGNvbnN0IHU4b2YgPSAoYnl0ZSkgPT4gVWludDhBcnJheS5vZihieXRlKTsgLy8gYW5vdGhlciBzaG9ydGN1dFxuICAgIGxldCB2ID0gdThuKGhhc2hMZW4pOyAvLyBNaW5pbWFsIG5vbi1mdWxsLXNwZWMgSE1BQy1EUkJHIGZyb20gTklTVCA4MDAtOTAgZm9yIFJGQzY5Nzkgc2lncy5cbiAgICBsZXQgayA9IHU4bihoYXNoTGVuKTsgLy8gU3RlcHMgQiBhbmQgQyBvZiBSRkM2OTc5IDMuMjogc2V0IGhhc2hMZW4sIGluIG91ciBjYXNlIGFsd2F5cyBzYW1lXG4gICAgbGV0IGkgPSAwOyAvLyBJdGVyYXRpb25zIGNvdW50ZXIsIHdpbGwgdGhyb3cgd2hlbiBvdmVyIDEwMDBcbiAgICBjb25zdCByZXNldCA9ICgpID0+IHtcbiAgICAgICAgdi5maWxsKDEpO1xuICAgICAgICBrLmZpbGwoMCk7XG4gICAgICAgIGkgPSAwO1xuICAgIH07XG4gICAgY29uc3QgaCA9ICguLi5iKSA9PiBobWFjRm4oaywgdiwgLi4uYik7IC8vIGhtYWMoaykodiwgLi4udmFsdWVzKVxuICAgIGNvbnN0IHJlc2VlZCA9IChzZWVkID0gdThuKDApKSA9PiB7XG4gICAgICAgIC8vIEhNQUMtRFJCRyByZXNlZWQoKSBmdW5jdGlvbi4gU3RlcHMgRC1HXG4gICAgICAgIGsgPSBoKHU4b2YoMHgwMCksIHNlZWQpOyAvLyBrID0gaG1hYyhrIHx8IHYgfHwgMHgwMCB8fCBzZWVkKVxuICAgICAgICB2ID0gaCgpOyAvLyB2ID0gaG1hYyhrIHx8IHYpXG4gICAgICAgIGlmIChzZWVkLmxlbmd0aCA9PT0gMClcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgayA9IGgodThvZigweDAxKSwgc2VlZCk7IC8vIGsgPSBobWFjKGsgfHwgdiB8fCAweDAxIHx8IHNlZWQpXG4gICAgICAgIHYgPSBoKCk7IC8vIHYgPSBobWFjKGsgfHwgdilcbiAgICB9O1xuICAgIGNvbnN0IGdlbiA9ICgpID0+IHtcbiAgICAgICAgLy8gSE1BQy1EUkJHIGdlbmVyYXRlKCkgZnVuY3Rpb25cbiAgICAgICAgaWYgKGkrKyA+PSAxMDAwKVxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdkcmJnOiB0cmllZCAxMDAwIHZhbHVlcycpO1xuICAgICAgICBsZXQgbGVuID0gMDtcbiAgICAgICAgY29uc3Qgb3V0ID0gW107XG4gICAgICAgIHdoaWxlIChsZW4gPCBxQnl0ZUxlbikge1xuICAgICAgICAgICAgdiA9IGgoKTtcbiAgICAgICAgICAgIGNvbnN0IHNsID0gdi5zbGljZSgpO1xuICAgICAgICAgICAgb3V0LnB1c2goc2wpO1xuICAgICAgICAgICAgbGVuICs9IHYubGVuZ3RoO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBjb25jYXRCeXRlc18oLi4ub3V0KTtcbiAgICB9O1xuICAgIGNvbnN0IGdlblVudGlsID0gKHNlZWQsIHByZWQpID0+IHtcbiAgICAgICAgcmVzZXQoKTtcbiAgICAgICAgcmVzZWVkKHNlZWQpOyAvLyBTdGVwcyBELUdcbiAgICAgICAgbGV0IHJlcyA9IHVuZGVmaW5lZDsgLy8gU3RlcCBIOiBncmluZCB1bnRpbCBrIGlzIGluIFsxLi5uLTFdXG4gICAgICAgIHdoaWxlICghKHJlcyA9IHByZWQoZ2VuKCkpKSlcbiAgICAgICAgICAgIHJlc2VlZCgpO1xuICAgICAgICByZXNldCgpO1xuICAgICAgICByZXR1cm4gcmVzO1xuICAgIH07XG4gICAgcmV0dXJuIGdlblVudGlsO1xufVxuLy8gVmFsaWRhdGluZyBjdXJ2ZXMgYW5kIGZpZWxkc1xuY29uc3QgdmFsaWRhdG9yRm5zID0ge1xuICAgIGJpZ2ludDogKHZhbCkgPT4gdHlwZW9mIHZhbCA9PT0gJ2JpZ2ludCcsXG4gICAgZnVuY3Rpb246ICh2YWwpID0+IHR5cGVvZiB2YWwgPT09ICdmdW5jdGlvbicsXG4gICAgYm9vbGVhbjogKHZhbCkgPT4gdHlwZW9mIHZhbCA9PT0gJ2Jvb2xlYW4nLFxuICAgIHN0cmluZzogKHZhbCkgPT4gdHlwZW9mIHZhbCA9PT0gJ3N0cmluZycsXG4gICAgc3RyaW5nT3JVaW50OEFycmF5OiAodmFsKSA9PiB0eXBlb2YgdmFsID09PSAnc3RyaW5nJyB8fCBpc0J5dGVzXyh2YWwpLFxuICAgIGlzU2FmZUludGVnZXI6ICh2YWwpID0+IE51bWJlci5pc1NhZmVJbnRlZ2VyKHZhbCksXG4gICAgYXJyYXk6ICh2YWwpID0+IEFycmF5LmlzQXJyYXkodmFsKSxcbiAgICBmaWVsZDogKHZhbCwgb2JqZWN0KSA9PiBvYmplY3QuRnAuaXNWYWxpZCh2YWwpLFxuICAgIGhhc2g6ICh2YWwpID0+IHR5cGVvZiB2YWwgPT09ICdmdW5jdGlvbicgJiYgTnVtYmVyLmlzU2FmZUludGVnZXIodmFsLm91dHB1dExlbiksXG59O1xuLy8gdHlwZSBSZWNvcmQ8SyBleHRlbmRzIHN0cmluZyB8IG51bWJlciB8IHN5bWJvbCwgVD4gPSB7IFtQIGluIEtdOiBUOyB9XG5leHBvcnQgZnVuY3Rpb24gdmFsaWRhdGVPYmplY3Qob2JqZWN0LCB2YWxpZGF0b3JzLCBvcHRWYWxpZGF0b3JzID0ge30pIHtcbiAgICBjb25zdCBjaGVja0ZpZWxkID0gKGZpZWxkTmFtZSwgdHlwZSwgaXNPcHRpb25hbCkgPT4ge1xuICAgICAgICBjb25zdCBjaGVja1ZhbCA9IHZhbGlkYXRvckZuc1t0eXBlXTtcbiAgICAgICAgaWYgKHR5cGVvZiBjaGVja1ZhbCAhPT0gJ2Z1bmN0aW9uJylcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignaW52YWxpZCB2YWxpZGF0b3IgZnVuY3Rpb24nKTtcbiAgICAgICAgY29uc3QgdmFsID0gb2JqZWN0W2ZpZWxkTmFtZV07XG4gICAgICAgIGlmIChpc09wdGlvbmFsICYmIHZhbCA9PT0gdW5kZWZpbmVkKVxuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICBpZiAoIWNoZWNrVmFsKHZhbCwgb2JqZWN0KSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdwYXJhbSAnICsgU3RyaW5nKGZpZWxkTmFtZSkgKyAnIGlzIGludmFsaWQuIEV4cGVjdGVkICcgKyB0eXBlICsgJywgZ290ICcgKyB2YWwpO1xuICAgICAgICB9XG4gICAgfTtcbiAgICBmb3IgKGNvbnN0IFtmaWVsZE5hbWUsIHR5cGVdIG9mIE9iamVjdC5lbnRyaWVzKHZhbGlkYXRvcnMpKVxuICAgICAgICBjaGVja0ZpZWxkKGZpZWxkTmFtZSwgdHlwZSwgZmFsc2UpO1xuICAgIGZvciAoY29uc3QgW2ZpZWxkTmFtZSwgdHlwZV0gb2YgT2JqZWN0LmVudHJpZXMob3B0VmFsaWRhdG9ycykpXG4gICAgICAgIGNoZWNrRmllbGQoZmllbGROYW1lLCB0eXBlLCB0cnVlKTtcbiAgICByZXR1cm4gb2JqZWN0O1xufVxuLy8gdmFsaWRhdGUgdHlwZSB0ZXN0c1xuLy8gY29uc3QgbzogeyBhOiBudW1iZXI7IGI6IG51bWJlcjsgYzogbnVtYmVyIH0gPSB7IGE6IDEsIGI6IDUsIGM6IDYgfTtcbi8vIGNvbnN0IHowID0gdmFsaWRhdGVPYmplY3QobywgeyBhOiAnaXNTYWZlSW50ZWdlcicgfSwgeyBjOiAnYmlnaW50JyB9KTsgLy8gT2shXG4vLyAvLyBTaG91bGQgZmFpbCB0eXBlLWNoZWNrXG4vLyBjb25zdCB6MSA9IHZhbGlkYXRlT2JqZWN0KG8sIHsgYTogJ3RtcCcgfSwgeyBjOiAnenonIH0pO1xuLy8gY29uc3QgejIgPSB2YWxpZGF0ZU9iamVjdChvLCB7IGE6ICdpc1NhZmVJbnRlZ2VyJyB9LCB7IGM6ICd6eicgfSk7XG4vLyBjb25zdCB6MyA9IHZhbGlkYXRlT2JqZWN0KG8sIHsgdGVzdDogJ2Jvb2xlYW4nLCB6OiAnYnVnJyB9KTtcbi8vIGNvbnN0IHo0ID0gdmFsaWRhdGVPYmplY3QobywgeyBhOiAnYm9vbGVhbicsIHo6ICdidWcnIH0pO1xuZXhwb3J0IGZ1bmN0aW9uIGlzSGFzaCh2YWwpIHtcbiAgICByZXR1cm4gdHlwZW9mIHZhbCA9PT0gJ2Z1bmN0aW9uJyAmJiBOdW1iZXIuaXNTYWZlSW50ZWdlcih2YWwub3V0cHV0TGVuKTtcbn1cbmV4cG9ydCBmdW5jdGlvbiBfdmFsaWRhdGVPYmplY3Qob2JqZWN0LCBmaWVsZHMsIG9wdEZpZWxkcyA9IHt9KSB7XG4gICAgaWYgKCFvYmplY3QgfHwgdHlwZW9mIG9iamVjdCAhPT0gJ29iamVjdCcpXG4gICAgICAgIHRocm93IG5ldyBFcnJvcignZXhwZWN0ZWQgdmFsaWQgb3B0aW9ucyBvYmplY3QnKTtcbiAgICBmdW5jdGlvbiBjaGVja0ZpZWxkKGZpZWxkTmFtZSwgZXhwZWN0ZWRUeXBlLCBpc09wdCkge1xuICAgICAgICBjb25zdCB2YWwgPSBvYmplY3RbZmllbGROYW1lXTtcbiAgICAgICAgaWYgKGlzT3B0ICYmIHZhbCA9PT0gdW5kZWZpbmVkKVxuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICBjb25zdCBjdXJyZW50ID0gdHlwZW9mIHZhbDtcbiAgICAgICAgaWYgKGN1cnJlbnQgIT09IGV4cGVjdGVkVHlwZSB8fCB2YWwgPT09IG51bGwpXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYHBhcmFtIFwiJHtmaWVsZE5hbWV9XCIgaXMgaW52YWxpZDogZXhwZWN0ZWQgJHtleHBlY3RlZFR5cGV9LCBnb3QgJHtjdXJyZW50fWApO1xuICAgIH1cbiAgICBPYmplY3QuZW50cmllcyhmaWVsZHMpLmZvckVhY2goKFtrLCB2XSkgPT4gY2hlY2tGaWVsZChrLCB2LCBmYWxzZSkpO1xuICAgIE9iamVjdC5lbnRyaWVzKG9wdEZpZWxkcykuZm9yRWFjaCgoW2ssIHZdKSA9PiBjaGVja0ZpZWxkKGssIHYsIHRydWUpKTtcbn1cbi8qKlxuICogdGhyb3dzIG5vdCBpbXBsZW1lbnRlZCBlcnJvclxuICovXG5leHBvcnQgY29uc3Qgbm90SW1wbGVtZW50ZWQgPSAoKSA9PiB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdub3QgaW1wbGVtZW50ZWQnKTtcbn07XG4vKipcbiAqIE1lbW9pemVzIChjYWNoZXMpIGNvbXB1dGF0aW9uIHJlc3VsdC5cbiAqIFVzZXMgV2Vha01hcDogdGhlIHZhbHVlIGlzIGdvaW5nIGF1dG8tY2xlYW5lZCBieSBHQyBhZnRlciBsYXN0IHJlZmVyZW5jZSBpcyByZW1vdmVkLlxuICovXG5leHBvcnQgZnVuY3Rpb24gbWVtb2l6ZWQoZm4pIHtcbiAgICBjb25zdCBtYXAgPSBuZXcgV2Vha01hcCgpO1xuICAgIHJldHVybiAoYXJnLCAuLi5hcmdzKSA9PiB7XG4gICAgICAgIGNvbnN0IHZhbCA9IG1hcC5nZXQoYXJnKTtcbiAgICAgICAgaWYgKHZhbCAhPT0gdW5kZWZpbmVkKVxuICAgICAgICAgICAgcmV0dXJuIHZhbDtcbiAgICAgICAgY29uc3QgY29tcHV0ZWQgPSBmbihhcmcsIC4uLmFyZ3MpO1xuICAgICAgICBtYXAuc2V0KGFyZywgY29tcHV0ZWQpO1xuICAgICAgICByZXR1cm4gY29tcHV0ZWQ7XG4gICAgfTtcbn1cbi8vIyBzb3VyY2VNYXBwaW5nVVJMPXV0aWxzLmpzLm1hcCIsCiAgICAiLyoqXG4gKiBVdGlscyBmb3IgbW9kdWxhciBkaXZpc2lvbiBhbmQgZmllbGRzLlxuICogRmllbGQgb3ZlciAxMSBpcyBhIGZpbml0ZSAoR2Fsb2lzKSBmaWVsZCBpcyBpbnRlZ2VyIG51bWJlciBvcGVyYXRpb25zIGBtb2QgMTFgLlxuICogVGhlcmUgaXMgbm8gZGl2aXNpb246IGl0IGlzIHJlcGxhY2VkIGJ5IG1vZHVsYXIgbXVsdGlwbGljYXRpdmUgaW52ZXJzZS5cbiAqIEBtb2R1bGVcbiAqL1xuLyohIG5vYmxlLWN1cnZlcyAtIE1JVCBMaWNlbnNlIChjKSAyMDIyIFBhdWwgTWlsbGVyIChwYXVsbWlsbHIuY29tKSAqL1xuaW1wb3J0IHsgX3ZhbGlkYXRlT2JqZWN0LCBhbnVtYmVyLCBiaXRNYXNrLCBieXRlc1RvTnVtYmVyQkUsIGJ5dGVzVG9OdW1iZXJMRSwgZW5zdXJlQnl0ZXMsIG51bWJlclRvQnl0ZXNCRSwgbnVtYmVyVG9CeXRlc0xFLCB9IGZyb20gXCIuLi91dGlscy5qc1wiO1xuLy8gcHJldHRpZXItaWdub3JlXG5jb25zdCBfMG4gPSBCaWdJbnQoMCksIF8xbiA9IEJpZ0ludCgxKSwgXzJuID0gLyogQF9fUFVSRV9fICovIEJpZ0ludCgyKSwgXzNuID0gLyogQF9fUFVSRV9fICovIEJpZ0ludCgzKTtcbi8vIHByZXR0aWVyLWlnbm9yZVxuY29uc3QgXzRuID0gLyogQF9fUFVSRV9fICovIEJpZ0ludCg0KSwgXzVuID0gLyogQF9fUFVSRV9fICovIEJpZ0ludCg1KSwgXzduID0gLyogQF9fUFVSRV9fICovIEJpZ0ludCg3KTtcbi8vIHByZXR0aWVyLWlnbm9yZVxuY29uc3QgXzhuID0gLyogQF9fUFVSRV9fICovIEJpZ0ludCg4KSwgXzluID0gLyogQF9fUFVSRV9fICovIEJpZ0ludCg5KSwgXzE2biA9IC8qIEBfX1BVUkVfXyAqLyBCaWdJbnQoMTYpO1xuLy8gQ2FsY3VsYXRlcyBhIG1vZHVsbyBiXG5leHBvcnQgZnVuY3Rpb24gbW9kKGEsIGIpIHtcbiAgICBjb25zdCByZXN1bHQgPSBhICUgYjtcbiAgICByZXR1cm4gcmVzdWx0ID49IF8wbiA/IHJlc3VsdCA6IGIgKyByZXN1bHQ7XG59XG4vKipcbiAqIEVmZmljaWVudGx5IHJhaXNlIG51bSB0byBwb3dlciBhbmQgZG8gbW9kdWxhciBkaXZpc2lvbi5cbiAqIFVuc2FmZSBpbiBzb21lIGNvbnRleHRzOiB1c2VzIGxhZGRlciwgc28gY2FuIGV4cG9zZSBiaWdpbnQgYml0cy5cbiAqIEBleGFtcGxlXG4gKiBwb3coMm4sIDZuLCAxMW4pIC8vIDY0biAlIDExbiA9PSA5blxuICovXG5leHBvcnQgZnVuY3Rpb24gcG93KG51bSwgcG93ZXIsIG1vZHVsbykge1xuICAgIHJldHVybiBGcFBvdyhGaWVsZChtb2R1bG8pLCBudW0sIHBvd2VyKTtcbn1cbi8qKiBEb2VzIGB4XigyXnBvd2VyKWAgbW9kIHAuIGBwb3cyKDMwLCA0KWAgPT0gYDMwXigyXjQpYCAqL1xuZXhwb3J0IGZ1bmN0aW9uIHBvdzIoeCwgcG93ZXIsIG1vZHVsbykge1xuICAgIGxldCByZXMgPSB4O1xuICAgIHdoaWxlIChwb3dlci0tID4gXzBuKSB7XG4gICAgICAgIHJlcyAqPSByZXM7XG4gICAgICAgIHJlcyAlPSBtb2R1bG87XG4gICAgfVxuICAgIHJldHVybiByZXM7XG59XG4vKipcbiAqIEludmVyc2VzIG51bWJlciBvdmVyIG1vZHVsby5cbiAqIEltcGxlbWVudGVkIHVzaW5nIFtFdWNsaWRlYW4gR0NEXShodHRwczovL2JyaWxsaWFudC5vcmcvd2lraS9leHRlbmRlZC1ldWNsaWRlYW4tYWxnb3JpdGhtLykuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBpbnZlcnQobnVtYmVyLCBtb2R1bG8pIHtcbiAgICBpZiAobnVtYmVyID09PSBfMG4pXG4gICAgICAgIHRocm93IG5ldyBFcnJvcignaW52ZXJ0OiBleHBlY3RlZCBub24temVybyBudW1iZXInKTtcbiAgICBpZiAobW9kdWxvIDw9IF8wbilcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdpbnZlcnQ6IGV4cGVjdGVkIHBvc2l0aXZlIG1vZHVsdXMsIGdvdCAnICsgbW9kdWxvKTtcbiAgICAvLyBGZXJtYXQncyBsaXR0bGUgdGhlb3JlbSBcIkNULWxpa2VcIiB2ZXJzaW9uIGludihuKSA9IG5eKG0tMikgbW9kIG0gaXMgMzB4IHNsb3dlci5cbiAgICBsZXQgYSA9IG1vZChudW1iZXIsIG1vZHVsbyk7XG4gICAgbGV0IGIgPSBtb2R1bG87XG4gICAgLy8gcHJldHRpZXItaWdub3JlXG4gICAgbGV0IHggPSBfMG4sIHkgPSBfMW4sIHUgPSBfMW4sIHYgPSBfMG47XG4gICAgd2hpbGUgKGEgIT09IF8wbikge1xuICAgICAgICAvLyBKSVQgYXBwbGllcyBvcHRpbWl6YXRpb24gaWYgdGhvc2UgdHdvIGxpbmVzIGZvbGxvdyBlYWNoIG90aGVyXG4gICAgICAgIGNvbnN0IHEgPSBiIC8gYTtcbiAgICAgICAgY29uc3QgciA9IGIgJSBhO1xuICAgICAgICBjb25zdCBtID0geCAtIHUgKiBxO1xuICAgICAgICBjb25zdCBuID0geSAtIHYgKiBxO1xuICAgICAgICAvLyBwcmV0dGllci1pZ25vcmVcbiAgICAgICAgYiA9IGEsIGEgPSByLCB4ID0gdSwgeSA9IHYsIHUgPSBtLCB2ID0gbjtcbiAgICB9XG4gICAgY29uc3QgZ2NkID0gYjtcbiAgICBpZiAoZ2NkICE9PSBfMW4pXG4gICAgICAgIHRocm93IG5ldyBFcnJvcignaW52ZXJ0OiBkb2VzIG5vdCBleGlzdCcpO1xuICAgIHJldHVybiBtb2QoeCwgbW9kdWxvKTtcbn1cbmZ1bmN0aW9uIGFzc2VydElzU3F1YXJlKEZwLCByb290LCBuKSB7XG4gICAgaWYgKCFGcC5lcWwoRnAuc3FyKHJvb3QpLCBuKSlcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdDYW5ub3QgZmluZCBzcXVhcmUgcm9vdCcpO1xufVxuLy8gTm90IGFsbCByb290cyBhcmUgcG9zc2libGUhIEV4YW1wbGUgd2hpY2ggd2lsbCB0aHJvdzpcbi8vIGNvbnN0IE5VTSA9XG4vLyBuID0gNzIwNTc1OTQwMzc5Mjc4MTZuO1xuLy8gRnAgPSBGaWVsZChCaWdJbnQoJzB4MWEwMTExZWEzOTdmZTY5YTRiMWJhN2I2NDM0YmFjZDc2NDc3NGI4NGYzODUxMmJmNjczMGQyYTBmNmIwZjYyNDFlYWJmZmZlYjE1M2ZmZmZiOWZlZmZmZmZmZmZhYWFiJykpO1xuZnVuY3Rpb24gc3FydDNtb2Q0KEZwLCBuKSB7XG4gICAgY29uc3QgcDFkaXY0ID0gKEZwLk9SREVSICsgXzFuKSAvIF80bjtcbiAgICBjb25zdCByb290ID0gRnAucG93KG4sIHAxZGl2NCk7XG4gICAgYXNzZXJ0SXNTcXVhcmUoRnAsIHJvb3QsIG4pO1xuICAgIHJldHVybiByb290O1xufVxuZnVuY3Rpb24gc3FydDVtb2Q4KEZwLCBuKSB7XG4gICAgY29uc3QgcDVkaXY4ID0gKEZwLk9SREVSIC0gXzVuKSAvIF84bjtcbiAgICBjb25zdCBuMiA9IEZwLm11bChuLCBfMm4pO1xuICAgIGNvbnN0IHYgPSBGcC5wb3cobjIsIHA1ZGl2OCk7XG4gICAgY29uc3QgbnYgPSBGcC5tdWwobiwgdik7XG4gICAgY29uc3QgaSA9IEZwLm11bChGcC5tdWwobnYsIF8ybiksIHYpO1xuICAgIGNvbnN0IHJvb3QgPSBGcC5tdWwobnYsIEZwLnN1YihpLCBGcC5PTkUpKTtcbiAgICBhc3NlcnRJc1NxdWFyZShGcCwgcm9vdCwgbik7XG4gICAgcmV0dXJuIHJvb3Q7XG59XG4vLyBCYXNlZCBvbiBSRkM5MzgwLCBLb25nIGFsZ29yaXRobVxuLy8gcHJldHRpZXItaWdub3JlXG5mdW5jdGlvbiBzcXJ0OW1vZDE2KFApIHtcbiAgICBjb25zdCBGcF8gPSBGaWVsZChQKTtcbiAgICBjb25zdCB0biA9IHRvbmVsbGlTaGFua3MoUCk7XG4gICAgY29uc3QgYzEgPSB0bihGcF8sIEZwXy5uZWcoRnBfLk9ORSkpOyAvLyAgMS4gYzEgPSBzcXJ0KC0xKSBpbiBGLCBpLmUuLCAoYzFeMikgPT0gLTEgaW4gRlxuICAgIGNvbnN0IGMyID0gdG4oRnBfLCBjMSk7IC8vICAyLiBjMiA9IHNxcnQoYzEpIGluIEYsIGkuZS4sIChjMl4yKSA9PSBjMSBpbiBGXG4gICAgY29uc3QgYzMgPSB0bihGcF8sIEZwXy5uZWcoYzEpKTsgLy8gIDMuIGMzID0gc3FydCgtYzEpIGluIEYsIGkuZS4sIChjM14yKSA9PSAtYzEgaW4gRlxuICAgIGNvbnN0IGM0ID0gKFAgKyBfN24pIC8gXzE2bjsgLy8gIDQuIGM0ID0gKHEgKyA3KSAvIDE2ICAgICAgICAjIEludGVnZXIgYXJpdGhtZXRpY1xuICAgIHJldHVybiAoRnAsIG4pID0+IHtcbiAgICAgICAgbGV0IHR2MSA9IEZwLnBvdyhuLCBjNCk7IC8vICAxLiB0djEgPSB4XmM0XG4gICAgICAgIGxldCB0djIgPSBGcC5tdWwodHYxLCBjMSk7IC8vICAyLiB0djIgPSBjMSAqIHR2MVxuICAgICAgICBjb25zdCB0djMgPSBGcC5tdWwodHYxLCBjMik7IC8vICAzLiB0djMgPSBjMiAqIHR2MVxuICAgICAgICBjb25zdCB0djQgPSBGcC5tdWwodHYxLCBjMyk7IC8vICA0LiB0djQgPSBjMyAqIHR2MVxuICAgICAgICBjb25zdCBlMSA9IEZwLmVxbChGcC5zcXIodHYyKSwgbik7IC8vICA1LiAgZTEgPSAodHYyXjIpID09IHhcbiAgICAgICAgY29uc3QgZTIgPSBGcC5lcWwoRnAuc3FyKHR2MyksIG4pOyAvLyAgNi4gIGUyID0gKHR2M14yKSA9PSB4XG4gICAgICAgIHR2MSA9IEZwLmNtb3YodHYxLCB0djIsIGUxKTsgLy8gIDcuIHR2MSA9IENNT1YodHYxLCB0djIsIGUxKSAgIyBTZWxlY3QgdHYyIGlmICh0djJeMikgPT0geFxuICAgICAgICB0djIgPSBGcC5jbW92KHR2NCwgdHYzLCBlMik7IC8vICA4LiB0djIgPSBDTU9WKHR2NCwgdHYzLCBlMikgICMgU2VsZWN0IHR2MyBpZiAodHYzXjIpID09IHhcbiAgICAgICAgY29uc3QgZTMgPSBGcC5lcWwoRnAuc3FyKHR2MiksIG4pOyAvLyAgOS4gIGUzID0gKHR2Ml4yKSA9PSB4XG4gICAgICAgIGNvbnN0IHJvb3QgPSBGcC5jbW92KHR2MSwgdHYyLCBlMyk7IC8vIDEwLiAgeiA9IENNT1YodHYxLCB0djIsIGUzKSAgICMgU2VsZWN0IHNxcnQgZnJvbSB0djEgJiB0djJcbiAgICAgICAgYXNzZXJ0SXNTcXVhcmUoRnAsIHJvb3QsIG4pO1xuICAgICAgICByZXR1cm4gcm9vdDtcbiAgICB9O1xufVxuLyoqXG4gKiBUb25lbGxpLVNoYW5rcyBzcXVhcmUgcm9vdCBzZWFyY2ggYWxnb3JpdGhtLlxuICogMS4gaHR0cHM6Ly9lcHJpbnQuaWFjci5vcmcvMjAxMi82ODUucGRmIChwYWdlIDEyKVxuICogMi4gU3F1YXJlIFJvb3RzIGZyb20gMTsgMjQsIDUxLCAxMCB0byBEYW4gU2hhbmtzXG4gKiBAcGFyYW0gUCBmaWVsZCBvcmRlclxuICogQHJldHVybnMgZnVuY3Rpb24gdGhhdCB0YWtlcyBmaWVsZCBGcCAoY3JlYXRlZCBmcm9tIFApIGFuZCBudW1iZXIgblxuICovXG5leHBvcnQgZnVuY3Rpb24gdG9uZWxsaVNoYW5rcyhQKSB7XG4gICAgLy8gSW5pdGlhbGl6YXRpb24gKHByZWNvbXB1dGF0aW9uKS5cbiAgICAvLyBDYWNoaW5nIGluaXRpYWxpemF0aW9uIGNvdWxkIGJvb3N0IHBlcmYgYnkgNyUuXG4gICAgaWYgKFAgPCBfM24pXG4gICAgICAgIHRocm93IG5ldyBFcnJvcignc3FydCBpcyBub3QgZGVmaW5lZCBmb3Igc21hbGwgZmllbGQnKTtcbiAgICAvLyBGYWN0b3IgUCAtIDEgPSBRICogMl5TLCB3aGVyZSBRIGlzIG9kZFxuICAgIGxldCBRID0gUCAtIF8xbjtcbiAgICBsZXQgUyA9IDA7XG4gICAgd2hpbGUgKFEgJSBfMm4gPT09IF8wbikge1xuICAgICAgICBRIC89IF8ybjtcbiAgICAgICAgUysrO1xuICAgIH1cbiAgICAvLyBGaW5kIHRoZSBmaXJzdCBxdWFkcmF0aWMgbm9uLXJlc2lkdWUgWiA+PSAyXG4gICAgbGV0IFogPSBfMm47XG4gICAgY29uc3QgX0ZwID0gRmllbGQoUCk7XG4gICAgd2hpbGUgKEZwTGVnZW5kcmUoX0ZwLCBaKSA9PT0gMSkge1xuICAgICAgICAvLyBCYXNpYyBwcmltYWxpdHkgdGVzdCBmb3IgUC4gQWZ0ZXIgeCBpdGVyYXRpb25zLCBjaGFuY2Ugb2ZcbiAgICAgICAgLy8gbm90IGZpbmRpbmcgcXVhZHJhdGljIG5vbi1yZXNpZHVlIGlzIDJeeCwgc28gMl4xMDAwLlxuICAgICAgICBpZiAoWisrID4gMTAwMClcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignQ2Fubm90IGZpbmQgc3F1YXJlIHJvb3Q6IHByb2JhYmx5IG5vbi1wcmltZSBQJyk7XG4gICAgfVxuICAgIC8vIEZhc3QtcGF0aDsgdXN1YWxseSBkb25lIGJlZm9yZSBaLCBidXQgd2UgZG8gXCJwcmltYWxpdHkgdGVzdFwiLlxuICAgIGlmIChTID09PSAxKVxuICAgICAgICByZXR1cm4gc3FydDNtb2Q0O1xuICAgIC8vIFNsb3ctcGF0aFxuICAgIC8vIFRPRE86IHRlc3Qgb24gRnAyIGFuZCBvdGhlcnNcbiAgICBsZXQgY2MgPSBfRnAucG93KFosIFEpOyAvLyBjID0gel5RXG4gICAgY29uc3QgUTFkaXYyID0gKFEgKyBfMW4pIC8gXzJuO1xuICAgIHJldHVybiBmdW5jdGlvbiB0b25lbGxpU2xvdyhGcCwgbikge1xuICAgICAgICBpZiAoRnAuaXMwKG4pKVxuICAgICAgICAgICAgcmV0dXJuIG47XG4gICAgICAgIC8vIENoZWNrIGlmIG4gaXMgYSBxdWFkcmF0aWMgcmVzaWR1ZSB1c2luZyBMZWdlbmRyZSBzeW1ib2xcbiAgICAgICAgaWYgKEZwTGVnZW5kcmUoRnAsIG4pICE9PSAxKVxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdDYW5ub3QgZmluZCBzcXVhcmUgcm9vdCcpO1xuICAgICAgICAvLyBJbml0aWFsaXplIHZhcmlhYmxlcyBmb3IgdGhlIG1haW4gbG9vcFxuICAgICAgICBsZXQgTSA9IFM7XG4gICAgICAgIGxldCBjID0gRnAubXVsKEZwLk9ORSwgY2MpOyAvLyBjID0gel5RLCBtb3ZlIGNjIGZyb20gZmllbGQgX0ZwIGludG8gZmllbGQgRnBcbiAgICAgICAgbGV0IHQgPSBGcC5wb3cobiwgUSk7IC8vIHQgPSBuXlEsIGZpcnN0IGd1ZXNzIGF0IHRoZSBmdWRnZSBmYWN0b3JcbiAgICAgICAgbGV0IFIgPSBGcC5wb3cobiwgUTFkaXYyKTsgLy8gUiA9IG5eKChRKzEpLzIpLCBmaXJzdCBndWVzcyBhdCB0aGUgc3F1YXJlIHJvb3RcbiAgICAgICAgLy8gTWFpbiBsb29wXG4gICAgICAgIC8vIHdoaWxlIHQgIT0gMVxuICAgICAgICB3aGlsZSAoIUZwLmVxbCh0LCBGcC5PTkUpKSB7XG4gICAgICAgICAgICBpZiAoRnAuaXMwKHQpKVxuICAgICAgICAgICAgICAgIHJldHVybiBGcC5aRVJPOyAvLyBpZiB0PTAgcmV0dXJuIFI9MFxuICAgICAgICAgICAgbGV0IGkgPSAxO1xuICAgICAgICAgICAgLy8gRmluZCB0aGUgc21hbGxlc3QgaSA+PSAxIHN1Y2ggdGhhdCB0XigyXmkpIOKJoSAxIChtb2QgUClcbiAgICAgICAgICAgIGxldCB0X3RtcCA9IEZwLnNxcih0KTsgLy8gdF4oMl4xKVxuICAgICAgICAgICAgd2hpbGUgKCFGcC5lcWwodF90bXAsIEZwLk9ORSkpIHtcbiAgICAgICAgICAgICAgICBpKys7XG4gICAgICAgICAgICAgICAgdF90bXAgPSBGcC5zcXIodF90bXApOyAvLyB0XigyXjIpLi4uXG4gICAgICAgICAgICAgICAgaWYgKGkgPT09IE0pXG4gICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignQ2Fubm90IGZpbmQgc3F1YXJlIHJvb3QnKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIENhbGN1bGF0ZSB0aGUgZXhwb25lbnQgZm9yIGI6IDJeKE0gLSBpIC0gMSlcbiAgICAgICAgICAgIGNvbnN0IGV4cG9uZW50ID0gXzFuIDw8IEJpZ0ludChNIC0gaSAtIDEpOyAvLyBiaWdpbnQgaXMgaW1wb3J0YW50XG4gICAgICAgICAgICBjb25zdCBiID0gRnAucG93KGMsIGV4cG9uZW50KTsgLy8gYiA9IDJeKE0gLSBpIC0gMSlcbiAgICAgICAgICAgIC8vIFVwZGF0ZSB2YXJpYWJsZXNcbiAgICAgICAgICAgIE0gPSBpO1xuICAgICAgICAgICAgYyA9IEZwLnNxcihiKTsgLy8gYyA9IGJeMlxuICAgICAgICAgICAgdCA9IEZwLm11bCh0LCBjKTsgLy8gdCA9ICh0ICogYl4yKVxuICAgICAgICAgICAgUiA9IEZwLm11bChSLCBiKTsgLy8gUiA9IFIqYlxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBSO1xuICAgIH07XG59XG4vKipcbiAqIFNxdWFyZSByb290IGZvciBhIGZpbml0ZSBmaWVsZC4gV2lsbCB0cnkgb3B0aW1pemVkIHZlcnNpb25zIGZpcnN0OlxuICpcbiAqIDEuIFAg4omhIDMgKG1vZCA0KVxuICogMi4gUCDiiaEgNSAobW9kIDgpXG4gKiAzLiBQIOKJoSA5IChtb2QgMTYpXG4gKiA0LiBUb25lbGxpLVNoYW5rcyBhbGdvcml0aG1cbiAqXG4gKiBEaWZmZXJlbnQgYWxnb3JpdGhtcyBjYW4gZ2l2ZSBkaWZmZXJlbnQgcm9vdHMsIGl0IGlzIHVwIHRvIHVzZXIgdG8gZGVjaWRlIHdoaWNoIG9uZSB0aGV5IHdhbnQuXG4gKiBGb3IgZXhhbXBsZSB0aGVyZSBpcyBGcFNxcnRPZGQvRnBTcXJ0RXZlbiB0byBjaG9pY2Ugcm9vdCBiYXNlZCBvbiBvZGRuZXNzICh1c2VkIGZvciBoYXNoLXRvLWN1cnZlKS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIEZwU3FydChQKSB7XG4gICAgLy8gUCDiiaEgMyAobW9kIDQpID0+IOKImm4gPSBuXigoUCsxKS80KVxuICAgIGlmIChQICUgXzRuID09PSBfM24pXG4gICAgICAgIHJldHVybiBzcXJ0M21vZDQ7XG4gICAgLy8gUCDiiaEgNSAobW9kIDgpID0+IEF0a2luIGFsZ29yaXRobSwgcGFnZSAxMCBvZiBodHRwczovL2VwcmludC5pYWNyLm9yZy8yMDEyLzY4NS5wZGZcbiAgICBpZiAoUCAlIF84biA9PT0gXzVuKVxuICAgICAgICByZXR1cm4gc3FydDVtb2Q4O1xuICAgIC8vIFAg4omhIDkgKG1vZCAxNikgPT4gS29uZyBhbGdvcml0aG0sIHBhZ2UgMTEgb2YgaHR0cHM6Ly9lcHJpbnQuaWFjci5vcmcvMjAxMi82ODUucGRmIChhbGdvcml0aG0gNClcbiAgICBpZiAoUCAlIF8xNm4gPT09IF85bilcbiAgICAgICAgcmV0dXJuIHNxcnQ5bW9kMTYoUCk7XG4gICAgLy8gVG9uZWxsaS1TaGFua3MgYWxnb3JpdGhtXG4gICAgcmV0dXJuIHRvbmVsbGlTaGFua3MoUCk7XG59XG4vLyBMaXR0bGUtZW5kaWFuIGNoZWNrIGZvciBmaXJzdCBMRSBiaXQgKGxhc3QgQkUgYml0KTtcbmV4cG9ydCBjb25zdCBpc05lZ2F0aXZlTEUgPSAobnVtLCBtb2R1bG8pID0+IChtb2QobnVtLCBtb2R1bG8pICYgXzFuKSA9PT0gXzFuO1xuLy8gcHJldHRpZXItaWdub3JlXG5jb25zdCBGSUVMRF9GSUVMRFMgPSBbXG4gICAgJ2NyZWF0ZScsICdpc1ZhbGlkJywgJ2lzMCcsICduZWcnLCAnaW52JywgJ3NxcnQnLCAnc3FyJyxcbiAgICAnZXFsJywgJ2FkZCcsICdzdWInLCAnbXVsJywgJ3BvdycsICdkaXYnLFxuICAgICdhZGROJywgJ3N1Yk4nLCAnbXVsTicsICdzcXJOJ1xuXTtcbmV4cG9ydCBmdW5jdGlvbiB2YWxpZGF0ZUZpZWxkKGZpZWxkKSB7XG4gICAgY29uc3QgaW5pdGlhbCA9IHtcbiAgICAgICAgT1JERVI6ICdiaWdpbnQnLFxuICAgICAgICBNQVNLOiAnYmlnaW50JyxcbiAgICAgICAgQllURVM6ICdudW1iZXInLFxuICAgICAgICBCSVRTOiAnbnVtYmVyJyxcbiAgICB9O1xuICAgIGNvbnN0IG9wdHMgPSBGSUVMRF9GSUVMRFMucmVkdWNlKChtYXAsIHZhbCkgPT4ge1xuICAgICAgICBtYXBbdmFsXSA9ICdmdW5jdGlvbic7XG4gICAgICAgIHJldHVybiBtYXA7XG4gICAgfSwgaW5pdGlhbCk7XG4gICAgX3ZhbGlkYXRlT2JqZWN0KGZpZWxkLCBvcHRzKTtcbiAgICAvLyBjb25zdCBtYXggPSAxNjM4NDtcbiAgICAvLyBpZiAoZmllbGQuQllURVMgPCAxIHx8IGZpZWxkLkJZVEVTID4gbWF4KSB0aHJvdyBuZXcgRXJyb3IoJ2ludmFsaWQgZmllbGQnKTtcbiAgICAvLyBpZiAoZmllbGQuQklUUyA8IDEgfHwgZmllbGQuQklUUyA+IDggKiBtYXgpIHRocm93IG5ldyBFcnJvcignaW52YWxpZCBmaWVsZCcpO1xuICAgIHJldHVybiBmaWVsZDtcbn1cbi8vIEdlbmVyaWMgZmllbGQgZnVuY3Rpb25zXG4vKipcbiAqIFNhbWUgYXMgYHBvd2AgYnV0IGZvciBGcDogbm9uLWNvbnN0YW50LXRpbWUuXG4gKiBVbnNhZmUgaW4gc29tZSBjb250ZXh0czogdXNlcyBsYWRkZXIsIHNvIGNhbiBleHBvc2UgYmlnaW50IGJpdHMuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBGcFBvdyhGcCwgbnVtLCBwb3dlcikge1xuICAgIGlmIChwb3dlciA8IF8wbilcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdpbnZhbGlkIGV4cG9uZW50LCBuZWdhdGl2ZXMgdW5zdXBwb3J0ZWQnKTtcbiAgICBpZiAocG93ZXIgPT09IF8wbilcbiAgICAgICAgcmV0dXJuIEZwLk9ORTtcbiAgICBpZiAocG93ZXIgPT09IF8xbilcbiAgICAgICAgcmV0dXJuIG51bTtcbiAgICBsZXQgcCA9IEZwLk9ORTtcbiAgICBsZXQgZCA9IG51bTtcbiAgICB3aGlsZSAocG93ZXIgPiBfMG4pIHtcbiAgICAgICAgaWYgKHBvd2VyICYgXzFuKVxuICAgICAgICAgICAgcCA9IEZwLm11bChwLCBkKTtcbiAgICAgICAgZCA9IEZwLnNxcihkKTtcbiAgICAgICAgcG93ZXIgPj49IF8xbjtcbiAgICB9XG4gICAgcmV0dXJuIHA7XG59XG4vKipcbiAqIEVmZmljaWVudGx5IGludmVydCBhbiBhcnJheSBvZiBGaWVsZCBlbGVtZW50cy5cbiAqIEV4Y2VwdGlvbi1mcmVlLiBXaWxsIHJldHVybiBgdW5kZWZpbmVkYCBmb3IgMCBlbGVtZW50cy5cbiAqIEBwYXJhbSBwYXNzWmVybyBtYXAgMCB0byAwIChpbnN0ZWFkIG9mIHVuZGVmaW5lZClcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIEZwSW52ZXJ0QmF0Y2goRnAsIG51bXMsIHBhc3NaZXJvID0gZmFsc2UpIHtcbiAgICBjb25zdCBpbnZlcnRlZCA9IG5ldyBBcnJheShudW1zLmxlbmd0aCkuZmlsbChwYXNzWmVybyA/IEZwLlpFUk8gOiB1bmRlZmluZWQpO1xuICAgIC8vIFdhbGsgZnJvbSBmaXJzdCB0byBsYXN0LCBtdWx0aXBseSB0aGVtIGJ5IGVhY2ggb3RoZXIgTU9EIHBcbiAgICBjb25zdCBtdWx0aXBsaWVkQWNjID0gbnVtcy5yZWR1Y2UoKGFjYywgbnVtLCBpKSA9PiB7XG4gICAgICAgIGlmIChGcC5pczAobnVtKSlcbiAgICAgICAgICAgIHJldHVybiBhY2M7XG4gICAgICAgIGludmVydGVkW2ldID0gYWNjO1xuICAgICAgICByZXR1cm4gRnAubXVsKGFjYywgbnVtKTtcbiAgICB9LCBGcC5PTkUpO1xuICAgIC8vIEludmVydCBsYXN0IGVsZW1lbnRcbiAgICBjb25zdCBpbnZlcnRlZEFjYyA9IEZwLmludihtdWx0aXBsaWVkQWNjKTtcbiAgICAvLyBXYWxrIGZyb20gbGFzdCB0byBmaXJzdCwgbXVsdGlwbHkgdGhlbSBieSBpbnZlcnRlZCBlYWNoIG90aGVyIE1PRCBwXG4gICAgbnVtcy5yZWR1Y2VSaWdodCgoYWNjLCBudW0sIGkpID0+IHtcbiAgICAgICAgaWYgKEZwLmlzMChudW0pKVxuICAgICAgICAgICAgcmV0dXJuIGFjYztcbiAgICAgICAgaW52ZXJ0ZWRbaV0gPSBGcC5tdWwoYWNjLCBpbnZlcnRlZFtpXSk7XG4gICAgICAgIHJldHVybiBGcC5tdWwoYWNjLCBudW0pO1xuICAgIH0sIGludmVydGVkQWNjKTtcbiAgICByZXR1cm4gaW52ZXJ0ZWQ7XG59XG4vLyBUT0RPOiByZW1vdmVcbmV4cG9ydCBmdW5jdGlvbiBGcERpdihGcCwgbGhzLCByaHMpIHtcbiAgICByZXR1cm4gRnAubXVsKGxocywgdHlwZW9mIHJocyA9PT0gJ2JpZ2ludCcgPyBpbnZlcnQocmhzLCBGcC5PUkRFUikgOiBGcC5pbnYocmhzKSk7XG59XG4vKipcbiAqIExlZ2VuZHJlIHN5bWJvbC5cbiAqIExlZ2VuZHJlIGNvbnN0YW50IGlzIHVzZWQgdG8gY2FsY3VsYXRlIExlZ2VuZHJlIHN5bWJvbCAoYSB8IHApXG4gKiB3aGljaCBkZW5vdGVzIHRoZSB2YWx1ZSBvZiBhXigocC0xKS8yKSAobW9kIHApLlxuICpcbiAqICogKGEgfCBwKSDiiaEgMSAgICBpZiBhIGlzIGEgc3F1YXJlIChtb2QgcCksIHF1YWRyYXRpYyByZXNpZHVlXG4gKiAqIChhIHwgcCkg4omhIC0xICAgaWYgYSBpcyBub3QgYSBzcXVhcmUgKG1vZCBwKSwgcXVhZHJhdGljIG5vbiByZXNpZHVlXG4gKiAqIChhIHwgcCkg4omhIDAgICAgaWYgYSDiiaEgMCAobW9kIHApXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBGcExlZ2VuZHJlKEZwLCBuKSB7XG4gICAgLy8gV2UgY2FuIHVzZSAzcmQgYXJndW1lbnQgYXMgb3B0aW9uYWwgY2FjaGUgb2YgdGhpcyB2YWx1ZVxuICAgIC8vIGJ1dCBzZWVtcyB1bm5lZWRlZCBmb3Igbm93LiBUaGUgb3BlcmF0aW9uIGlzIHZlcnkgZmFzdC5cbiAgICBjb25zdCBwMW1vZDIgPSAoRnAuT1JERVIgLSBfMW4pIC8gXzJuO1xuICAgIGNvbnN0IHBvd2VyZWQgPSBGcC5wb3cobiwgcDFtb2QyKTtcbiAgICBjb25zdCB5ZXMgPSBGcC5lcWwocG93ZXJlZCwgRnAuT05FKTtcbiAgICBjb25zdCB6ZXJvID0gRnAuZXFsKHBvd2VyZWQsIEZwLlpFUk8pO1xuICAgIGNvbnN0IG5vID0gRnAuZXFsKHBvd2VyZWQsIEZwLm5lZyhGcC5PTkUpKTtcbiAgICBpZiAoIXllcyAmJiAhemVybyAmJiAhbm8pXG4gICAgICAgIHRocm93IG5ldyBFcnJvcignaW52YWxpZCBMZWdlbmRyZSBzeW1ib2wgcmVzdWx0Jyk7XG4gICAgcmV0dXJuIHllcyA/IDEgOiB6ZXJvID8gMCA6IC0xO1xufVxuLy8gVGhpcyBmdW5jdGlvbiByZXR1cm5zIFRydWUgd2hlbmV2ZXIgdGhlIHZhbHVlIHggaXMgYSBzcXVhcmUgaW4gdGhlIGZpZWxkIEYuXG5leHBvcnQgZnVuY3Rpb24gRnBJc1NxdWFyZShGcCwgbikge1xuICAgIGNvbnN0IGwgPSBGcExlZ2VuZHJlKEZwLCBuKTtcbiAgICByZXR1cm4gbCA9PT0gMTtcbn1cbi8vIENVUlZFLm4gbGVuZ3Roc1xuZXhwb3J0IGZ1bmN0aW9uIG5MZW5ndGgobiwgbkJpdExlbmd0aCkge1xuICAgIC8vIEJpdCBzaXplLCBieXRlIHNpemUgb2YgQ1VSVkUublxuICAgIGlmIChuQml0TGVuZ3RoICE9PSB1bmRlZmluZWQpXG4gICAgICAgIGFudW1iZXIobkJpdExlbmd0aCk7XG4gICAgY29uc3QgX25CaXRMZW5ndGggPSBuQml0TGVuZ3RoICE9PSB1bmRlZmluZWQgPyBuQml0TGVuZ3RoIDogbi50b1N0cmluZygyKS5sZW5ndGg7XG4gICAgY29uc3QgbkJ5dGVMZW5ndGggPSBNYXRoLmNlaWwoX25CaXRMZW5ndGggLyA4KTtcbiAgICByZXR1cm4geyBuQml0TGVuZ3RoOiBfbkJpdExlbmd0aCwgbkJ5dGVMZW5ndGggfTtcbn1cbi8qKlxuICogQ3JlYXRlcyBhIGZpbml0ZSBmaWVsZC4gTWFqb3IgcGVyZm9ybWFuY2Ugb3B0aW1pemF0aW9uczpcbiAqICogMS4gRGVub3JtYWxpemVkIG9wZXJhdGlvbnMgbGlrZSBtdWxOIGluc3RlYWQgb2YgbXVsLlxuICogKiAyLiBJZGVudGljYWwgb2JqZWN0IHNoYXBlOiBuZXZlciBhZGQgb3IgcmVtb3ZlIGtleXMuXG4gKiAqIDMuIGBPYmplY3QuZnJlZXplYC5cbiAqIEZyYWdpbGU6IGFsd2F5cyBydW4gYSBiZW5jaG1hcmsgb24gYSBjaGFuZ2UuXG4gKiBTZWN1cml0eSBub3RlOiBvcGVyYXRpb25zIGRvbid0IGNoZWNrICdpc1ZhbGlkJyBmb3IgYWxsIGVsZW1lbnRzIGZvciBwZXJmb3JtYW5jZSByZWFzb25zLFxuICogaXQgaXMgY2FsbGVyIHJlc3BvbnNpYmlsaXR5IHRvIGNoZWNrIHRoaXMuXG4gKiBUaGlzIGlzIGxvdy1sZXZlbCBjb2RlLCBwbGVhc2UgbWFrZSBzdXJlIHlvdSBrbm93IHdoYXQgeW91J3JlIGRvaW5nLlxuICpcbiAqIE5vdGUgYWJvdXQgZmllbGQgcHJvcGVydGllczpcbiAqICogQ0hBUkFDVEVSSVNUSUMgcCA9IHByaW1lIG51bWJlciwgbnVtYmVyIG9mIGVsZW1lbnRzIGluIG1haW4gc3ViZ3JvdXAuXG4gKiAqIE9SREVSIHEgPSBzaW1pbGFyIHRvIGNvZmFjdG9yIGluIGN1cnZlcywgbWF5IGJlIGNvbXBvc2l0ZSBgcSA9IHBebWAuXG4gKlxuICogQHBhcmFtIE9SREVSIGZpZWxkIG9yZGVyLCBwcm9iYWJseSBwcmltZSwgb3IgY291bGQgYmUgY29tcG9zaXRlXG4gKiBAcGFyYW0gYml0TGVuIGhvdyBtYW55IGJpdHMgdGhlIGZpZWxkIGNvbnN1bWVzXG4gKiBAcGFyYW0gaXNMRSAoZGVmYXVsdDogZmFsc2UpIGlmIGVuY29kaW5nIC8gZGVjb2Rpbmcgc2hvdWxkIGJlIGluIGxpdHRsZS1lbmRpYW5cbiAqIEBwYXJhbSByZWRlZiBvcHRpb25hbCBmYXN0ZXIgcmVkZWZpbml0aW9ucyBvZiBzcXJ0IGFuZCBvdGhlciBtZXRob2RzXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBGaWVsZChPUkRFUiwgYml0TGVuT3JPcHRzLCAvLyBUT0RPOiB1c2Ugb3B0cyBvbmx5IGluIHYyP1xuaXNMRSA9IGZhbHNlLCBvcHRzID0ge30pIHtcbiAgICBpZiAoT1JERVIgPD0gXzBuKVxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ2ludmFsaWQgZmllbGQ6IGV4cGVjdGVkIE9SREVSID4gMCwgZ290ICcgKyBPUkRFUik7XG4gICAgbGV0IF9uYml0TGVuZ3RoID0gdW5kZWZpbmVkO1xuICAgIGxldCBfc3FydCA9IHVuZGVmaW5lZDtcbiAgICBsZXQgbW9kRnJvbUJ5dGVzID0gZmFsc2U7XG4gICAgbGV0IGFsbG93ZWRMZW5ndGhzID0gdW5kZWZpbmVkO1xuICAgIGlmICh0eXBlb2YgYml0TGVuT3JPcHRzID09PSAnb2JqZWN0JyAmJiBiaXRMZW5Pck9wdHMgIT0gbnVsbCkge1xuICAgICAgICBpZiAob3B0cy5zcXJ0IHx8IGlzTEUpXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ2Nhbm5vdCBzcGVjaWZ5IG9wdHMgaW4gdHdvIGFyZ3VtZW50cycpO1xuICAgICAgICBjb25zdCBfb3B0cyA9IGJpdExlbk9yT3B0cztcbiAgICAgICAgaWYgKF9vcHRzLkJJVFMpXG4gICAgICAgICAgICBfbmJpdExlbmd0aCA9IF9vcHRzLkJJVFM7XG4gICAgICAgIGlmIChfb3B0cy5zcXJ0KVxuICAgICAgICAgICAgX3NxcnQgPSBfb3B0cy5zcXJ0O1xuICAgICAgICBpZiAodHlwZW9mIF9vcHRzLmlzTEUgPT09ICdib29sZWFuJylcbiAgICAgICAgICAgIGlzTEUgPSBfb3B0cy5pc0xFO1xuICAgICAgICBpZiAodHlwZW9mIF9vcHRzLm1vZEZyb21CeXRlcyA9PT0gJ2Jvb2xlYW4nKVxuICAgICAgICAgICAgbW9kRnJvbUJ5dGVzID0gX29wdHMubW9kRnJvbUJ5dGVzO1xuICAgICAgICBhbGxvd2VkTGVuZ3RocyA9IF9vcHRzLmFsbG93ZWRMZW5ndGhzO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgICAgaWYgKHR5cGVvZiBiaXRMZW5Pck9wdHMgPT09ICdudW1iZXInKVxuICAgICAgICAgICAgX25iaXRMZW5ndGggPSBiaXRMZW5Pck9wdHM7XG4gICAgICAgIGlmIChvcHRzLnNxcnQpXG4gICAgICAgICAgICBfc3FydCA9IG9wdHMuc3FydDtcbiAgICB9XG4gICAgY29uc3QgeyBuQml0TGVuZ3RoOiBCSVRTLCBuQnl0ZUxlbmd0aDogQllURVMgfSA9IG5MZW5ndGgoT1JERVIsIF9uYml0TGVuZ3RoKTtcbiAgICBpZiAoQllURVMgPiAyMDQ4KVxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ2ludmFsaWQgZmllbGQ6IGV4cGVjdGVkIE9SREVSIG9mIDw9IDIwNDggYnl0ZXMnKTtcbiAgICBsZXQgc3FydFA7IC8vIGNhY2hlZCBzcXJ0UFxuICAgIGNvbnN0IGYgPSBPYmplY3QuZnJlZXplKHtcbiAgICAgICAgT1JERVIsXG4gICAgICAgIGlzTEUsXG4gICAgICAgIEJJVFMsXG4gICAgICAgIEJZVEVTLFxuICAgICAgICBNQVNLOiBiaXRNYXNrKEJJVFMpLFxuICAgICAgICBaRVJPOiBfMG4sXG4gICAgICAgIE9ORTogXzFuLFxuICAgICAgICBhbGxvd2VkTGVuZ3RoczogYWxsb3dlZExlbmd0aHMsXG4gICAgICAgIGNyZWF0ZTogKG51bSkgPT4gbW9kKG51bSwgT1JERVIpLFxuICAgICAgICBpc1ZhbGlkOiAobnVtKSA9PiB7XG4gICAgICAgICAgICBpZiAodHlwZW9mIG51bSAhPT0gJ2JpZ2ludCcpXG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdpbnZhbGlkIGZpZWxkIGVsZW1lbnQ6IGV4cGVjdGVkIGJpZ2ludCwgZ290ICcgKyB0eXBlb2YgbnVtKTtcbiAgICAgICAgICAgIHJldHVybiBfMG4gPD0gbnVtICYmIG51bSA8IE9SREVSOyAvLyAwIGlzIHZhbGlkIGVsZW1lbnQsIGJ1dCBpdCdzIG5vdCBpbnZlcnRpYmxlXG4gICAgICAgIH0sXG4gICAgICAgIGlzMDogKG51bSkgPT4gbnVtID09PSBfMG4sXG4gICAgICAgIC8vIGlzIHZhbGlkIGFuZCBpbnZlcnRpYmxlXG4gICAgICAgIGlzVmFsaWROb3QwOiAobnVtKSA9PiAhZi5pczAobnVtKSAmJiBmLmlzVmFsaWQobnVtKSxcbiAgICAgICAgaXNPZGQ6IChudW0pID0+IChudW0gJiBfMW4pID09PSBfMW4sXG4gICAgICAgIG5lZzogKG51bSkgPT4gbW9kKC1udW0sIE9SREVSKSxcbiAgICAgICAgZXFsOiAobGhzLCByaHMpID0+IGxocyA9PT0gcmhzLFxuICAgICAgICBzcXI6IChudW0pID0+IG1vZChudW0gKiBudW0sIE9SREVSKSxcbiAgICAgICAgYWRkOiAobGhzLCByaHMpID0+IG1vZChsaHMgKyByaHMsIE9SREVSKSxcbiAgICAgICAgc3ViOiAobGhzLCByaHMpID0+IG1vZChsaHMgLSByaHMsIE9SREVSKSxcbiAgICAgICAgbXVsOiAobGhzLCByaHMpID0+IG1vZChsaHMgKiByaHMsIE9SREVSKSxcbiAgICAgICAgcG93OiAobnVtLCBwb3dlcikgPT4gRnBQb3coZiwgbnVtLCBwb3dlciksXG4gICAgICAgIGRpdjogKGxocywgcmhzKSA9PiBtb2QobGhzICogaW52ZXJ0KHJocywgT1JERVIpLCBPUkRFUiksXG4gICAgICAgIC8vIFNhbWUgYXMgYWJvdmUsIGJ1dCBkb2Vzbid0IG5vcm1hbGl6ZVxuICAgICAgICBzcXJOOiAobnVtKSA9PiBudW0gKiBudW0sXG4gICAgICAgIGFkZE46IChsaHMsIHJocykgPT4gbGhzICsgcmhzLFxuICAgICAgICBzdWJOOiAobGhzLCByaHMpID0+IGxocyAtIHJocyxcbiAgICAgICAgbXVsTjogKGxocywgcmhzKSA9PiBsaHMgKiByaHMsXG4gICAgICAgIGludjogKG51bSkgPT4gaW52ZXJ0KG51bSwgT1JERVIpLFxuICAgICAgICBzcXJ0OiBfc3FydCB8fFxuICAgICAgICAgICAgKChuKSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKCFzcXJ0UClcbiAgICAgICAgICAgICAgICAgICAgc3FydFAgPSBGcFNxcnQoT1JERVIpO1xuICAgICAgICAgICAgICAgIHJldHVybiBzcXJ0UChmLCBuKTtcbiAgICAgICAgICAgIH0pLFxuICAgICAgICB0b0J5dGVzOiAobnVtKSA9PiAoaXNMRSA/IG51bWJlclRvQnl0ZXNMRShudW0sIEJZVEVTKSA6IG51bWJlclRvQnl0ZXNCRShudW0sIEJZVEVTKSksXG4gICAgICAgIGZyb21CeXRlczogKGJ5dGVzLCBza2lwVmFsaWRhdGlvbiA9IHRydWUpID0+IHtcbiAgICAgICAgICAgIGlmIChhbGxvd2VkTGVuZ3Rocykge1xuICAgICAgICAgICAgICAgIGlmICghYWxsb3dlZExlbmd0aHMuaW5jbHVkZXMoYnl0ZXMubGVuZ3RoKSB8fCBieXRlcy5sZW5ndGggPiBCWVRFUykge1xuICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ZpZWxkLmZyb21CeXRlczogZXhwZWN0ZWQgJyArIGFsbG93ZWRMZW5ndGhzICsgJyBieXRlcywgZ290ICcgKyBieXRlcy5sZW5ndGgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjb25zdCBwYWRkZWQgPSBuZXcgVWludDhBcnJheShCWVRFUyk7XG4gICAgICAgICAgICAgICAgLy8gaXNMRSBhZGQgMCB0byByaWdodCwgIWlzTEUgdG8gdGhlIGxlZnQuXG4gICAgICAgICAgICAgICAgcGFkZGVkLnNldChieXRlcywgaXNMRSA/IDAgOiBwYWRkZWQubGVuZ3RoIC0gYnl0ZXMubGVuZ3RoKTtcbiAgICAgICAgICAgICAgICBieXRlcyA9IHBhZGRlZDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChieXRlcy5sZW5ndGggIT09IEJZVEVTKVxuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignRmllbGQuZnJvbUJ5dGVzOiBleHBlY3RlZCAnICsgQllURVMgKyAnIGJ5dGVzLCBnb3QgJyArIGJ5dGVzLmxlbmd0aCk7XG4gICAgICAgICAgICBsZXQgc2NhbGFyID0gaXNMRSA/IGJ5dGVzVG9OdW1iZXJMRShieXRlcykgOiBieXRlc1RvTnVtYmVyQkUoYnl0ZXMpO1xuICAgICAgICAgICAgaWYgKG1vZEZyb21CeXRlcylcbiAgICAgICAgICAgICAgICBzY2FsYXIgPSBtb2Qoc2NhbGFyLCBPUkRFUik7XG4gICAgICAgICAgICBpZiAoIXNraXBWYWxpZGF0aW9uKVxuICAgICAgICAgICAgICAgIGlmICghZi5pc1ZhbGlkKHNjYWxhcikpXG4gICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignaW52YWxpZCBmaWVsZCBlbGVtZW50OiBvdXRzaWRlIG9mIHJhbmdlIDAuLk9SREVSJyk7XG4gICAgICAgICAgICAvLyBOT1RFOiB3ZSBkb24ndCB2YWxpZGF0ZSBzY2FsYXIgaGVyZSwgcGxlYXNlIHVzZSBpc1ZhbGlkLiBUaGlzIGRvbmUgc3VjaCB3YXkgYmVjYXVzZSBzb21lXG4gICAgICAgICAgICAvLyBwcm90b2NvbCBtYXkgYWxsb3cgbm9uLXJlZHVjZWQgc2NhbGFyIHRoYXQgcmVkdWNlZCBsYXRlciBvciBjaGFuZ2VkIHNvbWUgb3RoZXIgd2F5LlxuICAgICAgICAgICAgcmV0dXJuIHNjYWxhcjtcbiAgICAgICAgfSxcbiAgICAgICAgLy8gVE9ETzogd2UgZG9uJ3QgbmVlZCBpdCBoZXJlLCBtb3ZlIG91dCB0byBzZXBhcmF0ZSBmblxuICAgICAgICBpbnZlcnRCYXRjaDogKGxzdCkgPT4gRnBJbnZlcnRCYXRjaChmLCBsc3QpLFxuICAgICAgICAvLyBXZSBjYW4ndCBtb3ZlIHRoaXMgb3V0IGJlY2F1c2UgRnA2LCBGcDEyIGltcGxlbWVudCBpdFxuICAgICAgICAvLyBhbmQgaXQncyB1bmNsZWFyIHdoYXQgdG8gcmV0dXJuIGluIHRoZXJlLlxuICAgICAgICBjbW92OiAoYSwgYiwgYykgPT4gKGMgPyBiIDogYSksXG4gICAgfSk7XG4gICAgcmV0dXJuIE9iamVjdC5mcmVlemUoZik7XG59XG4vLyBHZW5lcmljIHJhbmRvbSBzY2FsYXIsIHdlIGNhbiBkbyBzYW1lIGZvciBvdGhlciBmaWVsZHMgaWYgdmlhIEZwMi5tdWwoRnAyLk9ORSwgRnAyLnJhbmRvbSk/XG4vLyBUaGlzIGFsbG93cyB1bnNhZmUgbWV0aG9kcyBsaWtlIGlnbm9yZSBiaWFzIG9yIHplcm8uIFRoZXNlIHVuc2FmZSwgYnV0IG9mdGVuIHVzZWQgaW4gZGlmZmVyZW50IHByb3RvY29scyAoaWYgZGV0ZXJtaW5pc3RpYyBSTkcpLlxuLy8gd2hpY2ggbWVhbiB3ZSBjYW5ub3QgZm9yY2UgdGhpcyB2aWEgb3B0cy5cbi8vIE5vdCBzdXJlIHdoYXQgdG8gZG8gd2l0aCByYW5kb21CeXRlcywgd2UgY2FuIGFjY2VwdCBpdCBpbnNpZGUgb3B0cyBpZiB3YW50ZWQuXG4vLyBQcm9iYWJseSBuZWVkIHRvIGV4cG9ydCBnZXRNaW5IYXNoTGVuZ3RoIHNvbWV3aGVyZT9cbi8vIHJhbmRvbShieXRlcz86IFVpbnQ4QXJyYXksIHVuc2FmZUFsbG93WmVybyA9IGZhbHNlLCB1bnNhZmVBbGxvd0JpYXMgPSBmYWxzZSkge1xuLy8gICBjb25zdCBMRU4gPSAhdW5zYWZlQWxsb3dCaWFzID8gZ2V0TWluSGFzaExlbmd0aChPUkRFUikgOiBCWVRFUztcbi8vICAgaWYgKGJ5dGVzID09PSB1bmRlZmluZWQpIGJ5dGVzID0gcmFuZG9tQnl0ZXMoTEVOKTsgLy8gX29wdHMucmFuZG9tQnl0ZXM/XG4vLyAgIGNvbnN0IG51bSA9IGlzTEUgPyBieXRlc1RvTnVtYmVyTEUoYnl0ZXMpIDogYnl0ZXNUb051bWJlckJFKGJ5dGVzKTtcbi8vICAgLy8gYG1vZCh4LCAxMSlgIGNhbiBzb21ldGltZXMgcHJvZHVjZSAwLiBgbW9kKHgsIDEwKSArIDFgIGlzIHRoZSBzYW1lLCBidXQgbm8gMFxuLy8gICBjb25zdCByZWR1Y2VkID0gdW5zYWZlQWxsb3daZXJvID8gbW9kKG51bSwgT1JERVIpIDogbW9kKG51bSwgT1JERVIgLSBfMW4pICsgXzFuO1xuLy8gICByZXR1cm4gcmVkdWNlZDtcbi8vIH0sXG5leHBvcnQgZnVuY3Rpb24gRnBTcXJ0T2RkKEZwLCBlbG0pIHtcbiAgICBpZiAoIUZwLmlzT2RkKVxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJGaWVsZCBkb2Vzbid0IGhhdmUgaXNPZGRcIik7XG4gICAgY29uc3Qgcm9vdCA9IEZwLnNxcnQoZWxtKTtcbiAgICByZXR1cm4gRnAuaXNPZGQocm9vdCkgPyByb290IDogRnAubmVnKHJvb3QpO1xufVxuZXhwb3J0IGZ1bmN0aW9uIEZwU3FydEV2ZW4oRnAsIGVsbSkge1xuICAgIGlmICghRnAuaXNPZGQpXG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcIkZpZWxkIGRvZXNuJ3QgaGF2ZSBpc09kZFwiKTtcbiAgICBjb25zdCByb290ID0gRnAuc3FydChlbG0pO1xuICAgIHJldHVybiBGcC5pc09kZChyb290KSA/IEZwLm5lZyhyb290KSA6IHJvb3Q7XG59XG4vKipcbiAqIFwiQ29uc3RhbnQtdGltZVwiIHByaXZhdGUga2V5IGdlbmVyYXRpb24gdXRpbGl0eS5cbiAqIFNhbWUgYXMgbWFwS2V5VG9GaWVsZCwgYnV0IGFjY2VwdHMgbGVzcyBieXRlcyAoNDAgaW5zdGVhZCBvZiA0OCBmb3IgMzItYnl0ZSBmaWVsZCkuXG4gKiBXaGljaCBtYWtlcyBpdCBzbGlnaHRseSBtb3JlIGJpYXNlZCwgbGVzcyBzZWN1cmUuXG4gKiBAZGVwcmVjYXRlZCB1c2UgYG1hcEtleVRvRmllbGRgIGluc3RlYWRcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGhhc2hUb1ByaXZhdGVTY2FsYXIoaGFzaCwgZ3JvdXBPcmRlciwgaXNMRSA9IGZhbHNlKSB7XG4gICAgaGFzaCA9IGVuc3VyZUJ5dGVzKCdwcml2YXRlSGFzaCcsIGhhc2gpO1xuICAgIGNvbnN0IGhhc2hMZW4gPSBoYXNoLmxlbmd0aDtcbiAgICBjb25zdCBtaW5MZW4gPSBuTGVuZ3RoKGdyb3VwT3JkZXIpLm5CeXRlTGVuZ3RoICsgODtcbiAgICBpZiAobWluTGVuIDwgMjQgfHwgaGFzaExlbiA8IG1pbkxlbiB8fCBoYXNoTGVuID4gMTAyNClcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdoYXNoVG9Qcml2YXRlU2NhbGFyOiBleHBlY3RlZCAnICsgbWluTGVuICsgJy0xMDI0IGJ5dGVzIG9mIGlucHV0LCBnb3QgJyArIGhhc2hMZW4pO1xuICAgIGNvbnN0IG51bSA9IGlzTEUgPyBieXRlc1RvTnVtYmVyTEUoaGFzaCkgOiBieXRlc1RvTnVtYmVyQkUoaGFzaCk7XG4gICAgcmV0dXJuIG1vZChudW0sIGdyb3VwT3JkZXIgLSBfMW4pICsgXzFuO1xufVxuLyoqXG4gKiBSZXR1cm5zIHRvdGFsIG51bWJlciBvZiBieXRlcyBjb25zdW1lZCBieSB0aGUgZmllbGQgZWxlbWVudC5cbiAqIEZvciBleGFtcGxlLCAzMiBieXRlcyBmb3IgdXN1YWwgMjU2LWJpdCB3ZWllcnN0cmFzcyBjdXJ2ZS5cbiAqIEBwYXJhbSBmaWVsZE9yZGVyIG51bWJlciBvZiBmaWVsZCBlbGVtZW50cywgdXN1YWxseSBDVVJWRS5uXG4gKiBAcmV0dXJucyBieXRlIGxlbmd0aCBvZiBmaWVsZFxuICovXG5leHBvcnQgZnVuY3Rpb24gZ2V0RmllbGRCeXRlc0xlbmd0aChmaWVsZE9yZGVyKSB7XG4gICAgaWYgKHR5cGVvZiBmaWVsZE9yZGVyICE9PSAnYmlnaW50JylcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdmaWVsZCBvcmRlciBtdXN0IGJlIGJpZ2ludCcpO1xuICAgIGNvbnN0IGJpdExlbmd0aCA9IGZpZWxkT3JkZXIudG9TdHJpbmcoMikubGVuZ3RoO1xuICAgIHJldHVybiBNYXRoLmNlaWwoYml0TGVuZ3RoIC8gOCk7XG59XG4vKipcbiAqIFJldHVybnMgbWluaW1hbCBhbW91bnQgb2YgYnl0ZXMgdGhhdCBjYW4gYmUgc2FmZWx5IHJlZHVjZWRcbiAqIGJ5IGZpZWxkIG9yZGVyLlxuICogU2hvdWxkIGJlIDJeLTEyOCBmb3IgMTI4LWJpdCBjdXJ2ZSBzdWNoIGFzIFAyNTYuXG4gKiBAcGFyYW0gZmllbGRPcmRlciBudW1iZXIgb2YgZmllbGQgZWxlbWVudHMsIHVzdWFsbHkgQ1VSVkUublxuICogQHJldHVybnMgYnl0ZSBsZW5ndGggb2YgdGFyZ2V0IGhhc2hcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGdldE1pbkhhc2hMZW5ndGgoZmllbGRPcmRlcikge1xuICAgIGNvbnN0IGxlbmd0aCA9IGdldEZpZWxkQnl0ZXNMZW5ndGgoZmllbGRPcmRlcik7XG4gICAgcmV0dXJuIGxlbmd0aCArIE1hdGguY2VpbChsZW5ndGggLyAyKTtcbn1cbi8qKlxuICogXCJDb25zdGFudC10aW1lXCIgcHJpdmF0ZSBrZXkgZ2VuZXJhdGlvbiB1dGlsaXR5LlxuICogQ2FuIHRha2UgKG4gKyBuLzIpIG9yIG1vcmUgYnl0ZXMgb2YgdW5pZm9ybSBpbnB1dCBlLmcuIGZyb20gQ1NQUk5HIG9yIEtERlxuICogYW5kIGNvbnZlcnQgdGhlbSBpbnRvIHByaXZhdGUgc2NhbGFyLCB3aXRoIHRoZSBtb2R1bG8gYmlhcyBiZWluZyBuZWdsaWdpYmxlLlxuICogTmVlZHMgYXQgbGVhc3QgNDggYnl0ZXMgb2YgaW5wdXQgZm9yIDMyLWJ5dGUgcHJpdmF0ZSBrZXkuXG4gKiBodHRwczovL3Jlc2VhcmNoLmt1ZGVsc2tpc2VjdXJpdHkuY29tLzIwMjAvMDcvMjgvdGhlLWRlZmluaXRpdmUtZ3VpZGUtdG8tbW9kdWxvLWJpYXMtYW5kLWhvdy10by1hdm9pZC1pdC9cbiAqIEZJUFMgMTg2LTUsIEEuMiBodHRwczovL2NzcmMubmlzdC5nb3YvcHVibGljYXRpb25zL2RldGFpbC9maXBzLzE4Ni81L2ZpbmFsXG4gKiBSRkMgOTM4MCwgaHR0cHM6Ly93d3cucmZjLWVkaXRvci5vcmcvcmZjL3JmYzkzODAjc2VjdGlvbi01XG4gKiBAcGFyYW0gaGFzaCBoYXNoIG91dHB1dCBmcm9tIFNIQTMgb3IgYSBzaW1pbGFyIGZ1bmN0aW9uXG4gKiBAcGFyYW0gZ3JvdXBPcmRlciBzaXplIG9mIHN1Ymdyb3VwIC0gKGUuZy4gc2VjcDI1NmsxLkNVUlZFLm4pXG4gKiBAcGFyYW0gaXNMRSBpbnRlcnByZXQgaGFzaCBieXRlcyBhcyBMRSBudW1cbiAqIEByZXR1cm5zIHZhbGlkIHByaXZhdGUgc2NhbGFyXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBtYXBIYXNoVG9GaWVsZChrZXksIGZpZWxkT3JkZXIsIGlzTEUgPSBmYWxzZSkge1xuICAgIGNvbnN0IGxlbiA9IGtleS5sZW5ndGg7XG4gICAgY29uc3QgZmllbGRMZW4gPSBnZXRGaWVsZEJ5dGVzTGVuZ3RoKGZpZWxkT3JkZXIpO1xuICAgIGNvbnN0IG1pbkxlbiA9IGdldE1pbkhhc2hMZW5ndGgoZmllbGRPcmRlcik7XG4gICAgLy8gTm8gc21hbGwgbnVtYmVyczogbmVlZCB0byB1bmRlcnN0YW5kIGJpYXMgc3RvcnkuIE5vIGh1Z2UgbnVtYmVyczogZWFzaWVyIHRvIGRldGVjdCBKUyB0aW1pbmdzLlxuICAgIGlmIChsZW4gPCAxNiB8fCBsZW4gPCBtaW5MZW4gfHwgbGVuID4gMTAyNClcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdleHBlY3RlZCAnICsgbWluTGVuICsgJy0xMDI0IGJ5dGVzIG9mIGlucHV0LCBnb3QgJyArIGxlbik7XG4gICAgY29uc3QgbnVtID0gaXNMRSA/IGJ5dGVzVG9OdW1iZXJMRShrZXkpIDogYnl0ZXNUb051bWJlckJFKGtleSk7XG4gICAgLy8gYG1vZCh4LCAxMSlgIGNhbiBzb21ldGltZXMgcHJvZHVjZSAwLiBgbW9kKHgsIDEwKSArIDFgIGlzIHRoZSBzYW1lLCBidXQgbm8gMFxuICAgIGNvbnN0IHJlZHVjZWQgPSBtb2QobnVtLCBmaWVsZE9yZGVyIC0gXzFuKSArIF8xbjtcbiAgICByZXR1cm4gaXNMRSA/IG51bWJlclRvQnl0ZXNMRShyZWR1Y2VkLCBmaWVsZExlbikgOiBudW1iZXJUb0J5dGVzQkUocmVkdWNlZCwgZmllbGRMZW4pO1xufVxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9bW9kdWxhci5qcy5tYXAiLAogICAgIi8qKlxuICogTWV0aG9kcyBmb3IgZWxsaXB0aWMgY3VydmUgbXVsdGlwbGljYXRpb24gYnkgc2NhbGFycy5cbiAqIENvbnRhaW5zIHdOQUYsIHBpcHBlbmdlci5cbiAqIEBtb2R1bGVcbiAqL1xuLyohIG5vYmxlLWN1cnZlcyAtIE1JVCBMaWNlbnNlIChjKSAyMDIyIFBhdWwgTWlsbGVyIChwYXVsbWlsbHIuY29tKSAqL1xuaW1wb3J0IHsgYml0TGVuLCBiaXRNYXNrLCB2YWxpZGF0ZU9iamVjdCB9IGZyb20gXCIuLi91dGlscy5qc1wiO1xuaW1wb3J0IHsgRmllbGQsIEZwSW52ZXJ0QmF0Y2gsIG5MZW5ndGgsIHZhbGlkYXRlRmllbGQgfSBmcm9tIFwiLi9tb2R1bGFyLmpzXCI7XG5jb25zdCBfMG4gPSBCaWdJbnQoMCk7XG5jb25zdCBfMW4gPSBCaWdJbnQoMSk7XG5leHBvcnQgZnVuY3Rpb24gbmVnYXRlQ3QoY29uZGl0aW9uLCBpdGVtKSB7XG4gICAgY29uc3QgbmVnID0gaXRlbS5uZWdhdGUoKTtcbiAgICByZXR1cm4gY29uZGl0aW9uID8gbmVnIDogaXRlbTtcbn1cbi8qKlxuICogVGFrZXMgYSBidW5jaCBvZiBQcm9qZWN0aXZlIFBvaW50cyBidXQgZXhlY3V0ZXMgb25seSBvbmVcbiAqIGludmVyc2lvbiBvbiBhbGwgb2YgdGhlbS4gSW52ZXJzaW9uIGlzIHZlcnkgc2xvdyBvcGVyYXRpb24sXG4gKiBzbyB0aGlzIGltcHJvdmVzIHBlcmZvcm1hbmNlIG1hc3NpdmVseS5cbiAqIE9wdGltaXphdGlvbjogY29udmVydHMgYSBsaXN0IG9mIHByb2plY3RpdmUgcG9pbnRzIHRvIGEgbGlzdCBvZiBpZGVudGljYWwgcG9pbnRzIHdpdGggWj0xLlxuICovXG5leHBvcnQgZnVuY3Rpb24gbm9ybWFsaXplWihjLCBwb2ludHMpIHtcbiAgICBjb25zdCBpbnZlcnRlZFpzID0gRnBJbnZlcnRCYXRjaChjLkZwLCBwb2ludHMubWFwKChwKSA9PiBwLlopKTtcbiAgICByZXR1cm4gcG9pbnRzLm1hcCgocCwgaSkgPT4gYy5mcm9tQWZmaW5lKHAudG9BZmZpbmUoaW52ZXJ0ZWRac1tpXSkpKTtcbn1cbmZ1bmN0aW9uIHZhbGlkYXRlVyhXLCBiaXRzKSB7XG4gICAgaWYgKCFOdW1iZXIuaXNTYWZlSW50ZWdlcihXKSB8fCBXIDw9IDAgfHwgVyA+IGJpdHMpXG4gICAgICAgIHRocm93IG5ldyBFcnJvcignaW52YWxpZCB3aW5kb3cgc2l6ZSwgZXhwZWN0ZWQgWzEuLicgKyBiaXRzICsgJ10sIGdvdCBXPScgKyBXKTtcbn1cbmZ1bmN0aW9uIGNhbGNXT3B0cyhXLCBzY2FsYXJCaXRzKSB7XG4gICAgdmFsaWRhdGVXKFcsIHNjYWxhckJpdHMpO1xuICAgIGNvbnN0IHdpbmRvd3MgPSBNYXRoLmNlaWwoc2NhbGFyQml0cyAvIFcpICsgMTsgLy8gVz04IDMzLiBOb3QgMzIsIGJlY2F1c2Ugd2Ugc2tpcCB6ZXJvXG4gICAgY29uc3Qgd2luZG93U2l6ZSA9IDIgKiogKFcgLSAxKTsgLy8gVz04IDEyOC4gTm90IDI1NiwgYmVjYXVzZSB3ZSBza2lwIHplcm9cbiAgICBjb25zdCBtYXhOdW1iZXIgPSAyICoqIFc7IC8vIFc9OCAyNTZcbiAgICBjb25zdCBtYXNrID0gYml0TWFzayhXKTsgLy8gVz04IDI1NSA9PSBtYXNrIDBiMTExMTExMTFcbiAgICBjb25zdCBzaGlmdEJ5ID0gQmlnSW50KFcpOyAvLyBXPTggOFxuICAgIHJldHVybiB7IHdpbmRvd3MsIHdpbmRvd1NpemUsIG1hc2ssIG1heE51bWJlciwgc2hpZnRCeSB9O1xufVxuZnVuY3Rpb24gY2FsY09mZnNldHMobiwgd2luZG93LCB3T3B0cykge1xuICAgIGNvbnN0IHsgd2luZG93U2l6ZSwgbWFzaywgbWF4TnVtYmVyLCBzaGlmdEJ5IH0gPSB3T3B0cztcbiAgICBsZXQgd2JpdHMgPSBOdW1iZXIobiAmIG1hc2spOyAvLyBleHRyYWN0IFcgYml0cy5cbiAgICBsZXQgbmV4dE4gPSBuID4+IHNoaWZ0Qnk7IC8vIHNoaWZ0IG51bWJlciBieSBXIGJpdHMuXG4gICAgLy8gV2hhdCBhY3R1YWxseSBoYXBwZW5zIGhlcmU6XG4gICAgLy8gY29uc3QgaGlnaGVzdEJpdCA9IE51bWJlcihtYXNrIF4gKG1hc2sgPj4gMW4pKTtcbiAgICAvLyBsZXQgd2JpdHMyID0gd2JpdHMgLSAxOyAvLyBza2lwIHplcm9cbiAgICAvLyBpZiAod2JpdHMyICYgaGlnaGVzdEJpdCkgeyB3Yml0czIgXj0gTnVtYmVyKG1hc2spOyAvLyAofik7XG4gICAgLy8gc3BsaXQgaWYgYml0cyA+IG1heDogKzIyNCA9PiAyNTYtMzJcbiAgICBpZiAod2JpdHMgPiB3aW5kb3dTaXplKSB7XG4gICAgICAgIC8vIHdlIHNraXAgemVybywgd2hpY2ggbWVhbnMgaW5zdGVhZCBvZiBgPj0gc2l6ZS0xYCwgd2UgZG8gYD4gc2l6ZWBcbiAgICAgICAgd2JpdHMgLT0gbWF4TnVtYmVyOyAvLyAtMzIsIGNhbiBiZSBtYXhOdW1iZXIgLSB3Yml0cywgYnV0IHRoZW4gd2UgbmVlZCB0byBzZXQgaXNOZWcgaGVyZS5cbiAgICAgICAgbmV4dE4gKz0gXzFuOyAvLyArMjU2IChjYXJyeSlcbiAgICB9XG4gICAgY29uc3Qgb2Zmc2V0U3RhcnQgPSB3aW5kb3cgKiB3aW5kb3dTaXplO1xuICAgIGNvbnN0IG9mZnNldCA9IG9mZnNldFN0YXJ0ICsgTWF0aC5hYnMod2JpdHMpIC0gMTsgLy8gLTEgYmVjYXVzZSB3ZSBza2lwIHplcm9cbiAgICBjb25zdCBpc1plcm8gPSB3Yml0cyA9PT0gMDsgLy8gaXMgY3VycmVudCB3aW5kb3cgc2xpY2UgYSAwP1xuICAgIGNvbnN0IGlzTmVnID0gd2JpdHMgPCAwOyAvLyBpcyBjdXJyZW50IHdpbmRvdyBzbGljZSBuZWdhdGl2ZT9cbiAgICBjb25zdCBpc05lZ0YgPSB3aW5kb3cgJSAyICE9PSAwOyAvLyBmYWtlIHJhbmRvbSBzdGF0ZW1lbnQgZm9yIG5vaXNlXG4gICAgY29uc3Qgb2Zmc2V0RiA9IG9mZnNldFN0YXJ0OyAvLyBmYWtlIG9mZnNldCBmb3Igbm9pc2VcbiAgICByZXR1cm4geyBuZXh0Tiwgb2Zmc2V0LCBpc1plcm8sIGlzTmVnLCBpc05lZ0YsIG9mZnNldEYgfTtcbn1cbmZ1bmN0aW9uIHZhbGlkYXRlTVNNUG9pbnRzKHBvaW50cywgYykge1xuICAgIGlmICghQXJyYXkuaXNBcnJheShwb2ludHMpKVxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ2FycmF5IGV4cGVjdGVkJyk7XG4gICAgcG9pbnRzLmZvckVhY2goKHAsIGkpID0+IHtcbiAgICAgICAgaWYgKCEocCBpbnN0YW5jZW9mIGMpKVxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdpbnZhbGlkIHBvaW50IGF0IGluZGV4ICcgKyBpKTtcbiAgICB9KTtcbn1cbmZ1bmN0aW9uIHZhbGlkYXRlTVNNU2NhbGFycyhzY2FsYXJzLCBmaWVsZCkge1xuICAgIGlmICghQXJyYXkuaXNBcnJheShzY2FsYXJzKSlcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdhcnJheSBvZiBzY2FsYXJzIGV4cGVjdGVkJyk7XG4gICAgc2NhbGFycy5mb3JFYWNoKChzLCBpKSA9PiB7XG4gICAgICAgIGlmICghZmllbGQuaXNWYWxpZChzKSlcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignaW52YWxpZCBzY2FsYXIgYXQgaW5kZXggJyArIGkpO1xuICAgIH0pO1xufVxuLy8gU2luY2UgcG9pbnRzIGluIGRpZmZlcmVudCBncm91cHMgY2Fubm90IGJlIGVxdWFsIChkaWZmZXJlbnQgb2JqZWN0IGNvbnN0cnVjdG9yKSxcbi8vIHdlIGNhbiBoYXZlIHNpbmdsZSBwbGFjZSB0byBzdG9yZSBwcmVjb21wdXRlcy5cbi8vIEFsbG93cyB0byBtYWtlIHBvaW50cyBmcm96ZW4gLyBpbW11dGFibGUuXG5jb25zdCBwb2ludFByZWNvbXB1dGVzID0gbmV3IFdlYWtNYXAoKTtcbmNvbnN0IHBvaW50V2luZG93U2l6ZXMgPSBuZXcgV2Vha01hcCgpO1xuZnVuY3Rpb24gZ2V0VyhQKSB7XG4gICAgLy8gVG8gZGlzYWJsZSBwcmVjb21wdXRlczpcbiAgICAvLyByZXR1cm4gMTtcbiAgICByZXR1cm4gcG9pbnRXaW5kb3dTaXplcy5nZXQoUCkgfHwgMTtcbn1cbmZ1bmN0aW9uIGFzc2VydDAobikge1xuICAgIGlmIChuICE9PSBfMG4pXG4gICAgICAgIHRocm93IG5ldyBFcnJvcignaW52YWxpZCB3TkFGJyk7XG59XG4vKipcbiAqIEVsbGlwdGljIGN1cnZlIG11bHRpcGxpY2F0aW9uIG9mIFBvaW50IGJ5IHNjYWxhci4gRnJhZ2lsZS5cbiAqIFRhYmxlIGdlbmVyYXRpb24gdGFrZXMgKiozME1CIG9mIHJhbSBhbmQgMTBtcyBvbiBoaWdoLWVuZCBDUFUqKixcbiAqIGJ1dCBtYXkgdGFrZSBtdWNoIGxvbmdlciBvbiBzbG93IGRldmljZXMuIEFjdHVhbCBnZW5lcmF0aW9uIHdpbGwgaGFwcGVuIG9uXG4gKiBmaXJzdCBjYWxsIG9mIGBtdWx0aXBseSgpYC4gQnkgZGVmYXVsdCwgYEJBU0VgIHBvaW50IGlzIHByZWNvbXB1dGVkLlxuICpcbiAqIFNjYWxhcnMgc2hvdWxkIGFsd2F5cyBiZSBsZXNzIHRoYW4gY3VydmUgb3JkZXI6IHRoaXMgc2hvdWxkIGJlIGNoZWNrZWQgaW5zaWRlIG9mIGEgY3VydmUgaXRzZWxmLlxuICogQ3JlYXRlcyBwcmVjb21wdXRhdGlvbiB0YWJsZXMgZm9yIGZhc3QgbXVsdGlwbGljYXRpb246XG4gKiAtIHByaXZhdGUgc2NhbGFyIGlzIHNwbGl0IGJ5IGZpeGVkIHNpemUgd2luZG93cyBvZiBXIGJpdHNcbiAqIC0gZXZlcnkgd2luZG93IHBvaW50IGlzIGNvbGxlY3RlZCBmcm9tIHdpbmRvdydzIHRhYmxlICYgYWRkZWQgdG8gYWNjdW11bGF0b3JcbiAqIC0gc2luY2Ugd2luZG93cyBhcmUgZGlmZmVyZW50LCBzYW1lIHBvaW50IGluc2lkZSB0YWJsZXMgd29uJ3QgYmUgYWNjZXNzZWQgbW9yZSB0aGFuIG9uY2UgcGVyIGNhbGNcbiAqIC0gZWFjaCBtdWx0aXBsaWNhdGlvbiBpcyAnTWF0aC5jZWlsKENVUlZFX09SREVSIC8g8J2RiikgKyAxJyBwb2ludCBhZGRpdGlvbnMgKGZpeGVkIGZvciBhbnkgc2NhbGFyKVxuICogLSArMSB3aW5kb3cgaXMgbmVjY2Vzc2FyeSBmb3Igd05BRlxuICogLSB3TkFGIHJlZHVjZXMgdGFibGUgc2l6ZTogMnggbGVzcyBtZW1vcnkgKyAyeCBmYXN0ZXIgZ2VuZXJhdGlvbiwgYnV0IDEwJSBzbG93ZXIgbXVsdGlwbGljYXRpb25cbiAqXG4gKiBAdG9kbyBSZXNlYXJjaCByZXR1cm5pbmcgMmQgSlMgYXJyYXkgb2Ygd2luZG93cywgaW5zdGVhZCBvZiBhIHNpbmdsZSB3aW5kb3cuXG4gKiBUaGlzIHdvdWxkIGFsbG93IHdpbmRvd3MgdG8gYmUgaW4gZGlmZmVyZW50IG1lbW9yeSBsb2NhdGlvbnNcbiAqL1xuZXhwb3J0IGNsYXNzIHdOQUYge1xuICAgIC8vIFBhcmFtZXRyaXplZCB3aXRoIGEgZ2l2ZW4gUG9pbnQgY2xhc3MgKG5vdCBpbmRpdmlkdWFsIHBvaW50KVxuICAgIGNvbnN0cnVjdG9yKFBvaW50LCBiaXRzKSB7XG4gICAgICAgIHRoaXMuQkFTRSA9IFBvaW50LkJBU0U7XG4gICAgICAgIHRoaXMuWkVSTyA9IFBvaW50LlpFUk87XG4gICAgICAgIHRoaXMuRm4gPSBQb2ludC5GbjtcbiAgICAgICAgdGhpcy5iaXRzID0gYml0cztcbiAgICB9XG4gICAgLy8gbm9uLWNvbnN0IHRpbWUgbXVsdGlwbGljYXRpb24gbGFkZGVyXG4gICAgX3Vuc2FmZUxhZGRlcihlbG0sIG4sIHAgPSB0aGlzLlpFUk8pIHtcbiAgICAgICAgbGV0IGQgPSBlbG07XG4gICAgICAgIHdoaWxlIChuID4gXzBuKSB7XG4gICAgICAgICAgICBpZiAobiAmIF8xbilcbiAgICAgICAgICAgICAgICBwID0gcC5hZGQoZCk7XG4gICAgICAgICAgICBkID0gZC5kb3VibGUoKTtcbiAgICAgICAgICAgIG4gPj49IF8xbjtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcDtcbiAgICB9XG4gICAgLyoqXG4gICAgICogQ3JlYXRlcyBhIHdOQUYgcHJlY29tcHV0YXRpb24gd2luZG93LiBVc2VkIGZvciBjYWNoaW5nLlxuICAgICAqIERlZmF1bHQgd2luZG93IHNpemUgaXMgc2V0IGJ5IGB1dGlscy5wcmVjb21wdXRlKClgIGFuZCBpcyBlcXVhbCB0byA4LlxuICAgICAqIE51bWJlciBvZiBwcmVjb21wdXRlZCBwb2ludHMgZGVwZW5kcyBvbiB0aGUgY3VydmUgc2l6ZTpcbiAgICAgKiAyXijwnZGK4oiSMSkgKiAoTWF0aC5jZWlsKPCdkZsgLyDwnZGKKSArIDEpLCB3aGVyZTpcbiAgICAgKiAtIPCdkYogaXMgdGhlIHdpbmRvdyBzaXplXG4gICAgICogLSDwnZGbIGlzIHRoZSBiaXRsZW5ndGggb2YgdGhlIGN1cnZlIG9yZGVyLlxuICAgICAqIEZvciBhIDI1Ni1iaXQgY3VydmUgYW5kIHdpbmRvdyBzaXplIDgsIHRoZSBudW1iZXIgb2YgcHJlY29tcHV0ZWQgcG9pbnRzIGlzIDEyOCAqIDMzID0gNDIyNC5cbiAgICAgKiBAcGFyYW0gcG9pbnQgUG9pbnQgaW5zdGFuY2VcbiAgICAgKiBAcGFyYW0gVyB3aW5kb3cgc2l6ZVxuICAgICAqIEByZXR1cm5zIHByZWNvbXB1dGVkIHBvaW50IHRhYmxlcyBmbGF0dGVuZWQgdG8gYSBzaW5nbGUgYXJyYXlcbiAgICAgKi9cbiAgICBwcmVjb21wdXRlV2luZG93KHBvaW50LCBXKSB7XG4gICAgICAgIGNvbnN0IHsgd2luZG93cywgd2luZG93U2l6ZSB9ID0gY2FsY1dPcHRzKFcsIHRoaXMuYml0cyk7XG4gICAgICAgIGNvbnN0IHBvaW50cyA9IFtdO1xuICAgICAgICBsZXQgcCA9IHBvaW50O1xuICAgICAgICBsZXQgYmFzZSA9IHA7XG4gICAgICAgIGZvciAobGV0IHdpbmRvdyA9IDA7IHdpbmRvdyA8IHdpbmRvd3M7IHdpbmRvdysrKSB7XG4gICAgICAgICAgICBiYXNlID0gcDtcbiAgICAgICAgICAgIHBvaW50cy5wdXNoKGJhc2UpO1xuICAgICAgICAgICAgLy8gaT0xLCBiYyB3ZSBza2lwIDBcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAxOyBpIDwgd2luZG93U2l6ZTsgaSsrKSB7XG4gICAgICAgICAgICAgICAgYmFzZSA9IGJhc2UuYWRkKHApO1xuICAgICAgICAgICAgICAgIHBvaW50cy5wdXNoKGJhc2UpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcCA9IGJhc2UuZG91YmxlKCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHBvaW50cztcbiAgICB9XG4gICAgLyoqXG4gICAgICogSW1wbGVtZW50cyBlYyBtdWx0aXBsaWNhdGlvbiB1c2luZyBwcmVjb21wdXRlZCB0YWJsZXMgYW5kIHctYXJ5IG5vbi1hZGphY2VudCBmb3JtLlxuICAgICAqIE1vcmUgY29tcGFjdCBpbXBsZW1lbnRhdGlvbjpcbiAgICAgKiBodHRwczovL2dpdGh1Yi5jb20vcGF1bG1pbGxyL25vYmxlLXNlY3AyNTZrMS9ibG9iLzQ3Y2IxNjY5YjZlNTA2YWQ2NmIzNWZlN2Q3NjEzMmFlOTc0NjVkYTIvaW5kZXgudHMjTDUwMi1MNTQxXG4gICAgICogQHJldHVybnMgcmVhbCBhbmQgZmFrZSAoZm9yIGNvbnN0LXRpbWUpIHBvaW50c1xuICAgICAqL1xuICAgIHdOQUYoVywgcHJlY29tcHV0ZXMsIG4pIHtcbiAgICAgICAgLy8gU2NhbGFyIHNob3VsZCBiZSBzbWFsbGVyIHRoYW4gZmllbGQgb3JkZXJcbiAgICAgICAgaWYgKCF0aGlzLkZuLmlzVmFsaWQobikpXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ2ludmFsaWQgc2NhbGFyJyk7XG4gICAgICAgIC8vIEFjY3VtdWxhdG9yc1xuICAgICAgICBsZXQgcCA9IHRoaXMuWkVSTztcbiAgICAgICAgbGV0IGYgPSB0aGlzLkJBU0U7XG4gICAgICAgIC8vIFRoaXMgY29kZSB3YXMgZmlyc3Qgd3JpdHRlbiB3aXRoIGFzc3VtcHRpb24gdGhhdCAnZicgYW5kICdwJyB3aWxsIG5ldmVyIGJlIGluZmluaXR5IHBvaW50OlxuICAgICAgICAvLyBzaW5jZSBlYWNoIGFkZGl0aW9uIGlzIG11bHRpcGxpZWQgYnkgMiAqKiBXLCBpdCBjYW5ub3QgY2FuY2VsIGVhY2ggb3RoZXIuIEhvd2V2ZXIsXG4gICAgICAgIC8vIHRoZXJlIGlzIG5lZ2F0ZSBub3c6IGl0IGlzIHBvc3NpYmxlIHRoYXQgbmVnYXRlZCBlbGVtZW50IGZyb20gbG93IHZhbHVlXG4gICAgICAgIC8vIHdvdWxkIGJlIHRoZSBzYW1lIGFzIGhpZ2ggZWxlbWVudCwgd2hpY2ggd2lsbCBjcmVhdGUgY2FycnkgaW50byBuZXh0IHdpbmRvdy5cbiAgICAgICAgLy8gSXQncyBub3Qgb2J2aW91cyBob3cgdGhpcyBjYW4gZmFpbCwgYnV0IHN0aWxsIHdvcnRoIGludmVzdGlnYXRpbmcgbGF0ZXIuXG4gICAgICAgIGNvbnN0IHdvID0gY2FsY1dPcHRzKFcsIHRoaXMuYml0cyk7XG4gICAgICAgIGZvciAobGV0IHdpbmRvdyA9IDA7IHdpbmRvdyA8IHdvLndpbmRvd3M7IHdpbmRvdysrKSB7XG4gICAgICAgICAgICAvLyAobiA9PT0gXzBuKSBpcyBoYW5kbGVkIGFuZCBub3QgZWFybHktZXhpdGVkLiBpc0V2ZW4gYW5kIG9mZnNldEYgYXJlIHVzZWQgZm9yIG5vaXNlXG4gICAgICAgICAgICBjb25zdCB7IG5leHROLCBvZmZzZXQsIGlzWmVybywgaXNOZWcsIGlzTmVnRiwgb2Zmc2V0RiB9ID0gY2FsY09mZnNldHMobiwgd2luZG93LCB3byk7XG4gICAgICAgICAgICBuID0gbmV4dE47XG4gICAgICAgICAgICBpZiAoaXNaZXJvKSB7XG4gICAgICAgICAgICAgICAgLy8gYml0cyBhcmUgMDogYWRkIGdhcmJhZ2UgdG8gZmFrZSBwb2ludFxuICAgICAgICAgICAgICAgIC8vIEltcG9ydGFudCBwYXJ0IGZvciBjb25zdC10aW1lIGdldFB1YmxpY0tleTogYWRkIHJhbmRvbSBcIm5vaXNlXCIgcG9pbnQgdG8gZi5cbiAgICAgICAgICAgICAgICBmID0gZi5hZGQobmVnYXRlQ3QoaXNOZWdGLCBwcmVjb21wdXRlc1tvZmZzZXRGXSkpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgLy8gYml0cyBhcmUgMTogYWRkIHRvIHJlc3VsdCBwb2ludFxuICAgICAgICAgICAgICAgIHAgPSBwLmFkZChuZWdhdGVDdChpc05lZywgcHJlY29tcHV0ZXNbb2Zmc2V0XSkpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGFzc2VydDAobik7XG4gICAgICAgIC8vIFJldHVybiBib3RoIHJlYWwgYW5kIGZha2UgcG9pbnRzOiBKSVQgd29uJ3QgZWxpbWluYXRlIGYuXG4gICAgICAgIC8vIEF0IHRoaXMgcG9pbnQgdGhlcmUgaXMgYSB3YXkgdG8gRiBiZSBpbmZpbml0eS1wb2ludCBldmVuIGlmIHAgaXMgbm90LFxuICAgICAgICAvLyB3aGljaCBtYWtlcyBpdCBsZXNzIGNvbnN0LXRpbWU6IGFyb3VuZCAxIGJpZ2ludCBtdWx0aXBseS5cbiAgICAgICAgcmV0dXJuIHsgcCwgZiB9O1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBJbXBsZW1lbnRzIGVjIHVuc2FmZSAobm9uIGNvbnN0LXRpbWUpIG11bHRpcGxpY2F0aW9uIHVzaW5nIHByZWNvbXB1dGVkIHRhYmxlcyBhbmQgdy1hcnkgbm9uLWFkamFjZW50IGZvcm0uXG4gICAgICogQHBhcmFtIGFjYyBhY2N1bXVsYXRvciBwb2ludCB0byBhZGQgcmVzdWx0IG9mIG11bHRpcGxpY2F0aW9uXG4gICAgICogQHJldHVybnMgcG9pbnRcbiAgICAgKi9cbiAgICB3TkFGVW5zYWZlKFcsIHByZWNvbXB1dGVzLCBuLCBhY2MgPSB0aGlzLlpFUk8pIHtcbiAgICAgICAgY29uc3Qgd28gPSBjYWxjV09wdHMoVywgdGhpcy5iaXRzKTtcbiAgICAgICAgZm9yIChsZXQgd2luZG93ID0gMDsgd2luZG93IDwgd28ud2luZG93czsgd2luZG93KyspIHtcbiAgICAgICAgICAgIGlmIChuID09PSBfMG4pXG4gICAgICAgICAgICAgICAgYnJlYWs7IC8vIEVhcmx5LWV4aXQsIHNraXAgMCB2YWx1ZVxuICAgICAgICAgICAgY29uc3QgeyBuZXh0Tiwgb2Zmc2V0LCBpc1plcm8sIGlzTmVnIH0gPSBjYWxjT2Zmc2V0cyhuLCB3aW5kb3csIHdvKTtcbiAgICAgICAgICAgIG4gPSBuZXh0TjtcbiAgICAgICAgICAgIGlmIChpc1plcm8pIHtcbiAgICAgICAgICAgICAgICAvLyBXaW5kb3cgYml0cyBhcmUgMDogc2tpcCBwcm9jZXNzaW5nLlxuICAgICAgICAgICAgICAgIC8vIE1vdmUgdG8gbmV4dCB3aW5kb3cuXG4gICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICBjb25zdCBpdGVtID0gcHJlY29tcHV0ZXNbb2Zmc2V0XTtcbiAgICAgICAgICAgICAgICBhY2MgPSBhY2MuYWRkKGlzTmVnID8gaXRlbS5uZWdhdGUoKSA6IGl0ZW0pOyAvLyBSZS11c2luZyBhY2MgYWxsb3dzIHRvIHNhdmUgYWRkcyBpbiBNU01cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBhc3NlcnQwKG4pO1xuICAgICAgICByZXR1cm4gYWNjO1xuICAgIH1cbiAgICBnZXRQcmVjb21wdXRlcyhXLCBwb2ludCwgdHJhbnNmb3JtKSB7XG4gICAgICAgIC8vIENhbGN1bGF0ZSBwcmVjb21wdXRlcyBvbiBhIGZpcnN0IHJ1biwgcmV1c2UgdGhlbSBhZnRlclxuICAgICAgICBsZXQgY29tcCA9IHBvaW50UHJlY29tcHV0ZXMuZ2V0KHBvaW50KTtcbiAgICAgICAgaWYgKCFjb21wKSB7XG4gICAgICAgICAgICBjb21wID0gdGhpcy5wcmVjb21wdXRlV2luZG93KHBvaW50LCBXKTtcbiAgICAgICAgICAgIGlmIChXICE9PSAxKSB7XG4gICAgICAgICAgICAgICAgLy8gRG9pbmcgdHJhbnNmb3JtIG91dHNpZGUgb2YgaWYgYnJpbmdzIDE1JSBwZXJmIGhpdFxuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgdHJhbnNmb3JtID09PSAnZnVuY3Rpb24nKVxuICAgICAgICAgICAgICAgICAgICBjb21wID0gdHJhbnNmb3JtKGNvbXApO1xuICAgICAgICAgICAgICAgIHBvaW50UHJlY29tcHV0ZXMuc2V0KHBvaW50LCBjb21wKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gY29tcDtcbiAgICB9XG4gICAgY2FjaGVkKHBvaW50LCBzY2FsYXIsIHRyYW5zZm9ybSkge1xuICAgICAgICBjb25zdCBXID0gZ2V0Vyhwb2ludCk7XG4gICAgICAgIHJldHVybiB0aGlzLndOQUYoVywgdGhpcy5nZXRQcmVjb21wdXRlcyhXLCBwb2ludCwgdHJhbnNmb3JtKSwgc2NhbGFyKTtcbiAgICB9XG4gICAgdW5zYWZlKHBvaW50LCBzY2FsYXIsIHRyYW5zZm9ybSwgcHJldikge1xuICAgICAgICBjb25zdCBXID0gZ2V0Vyhwb2ludCk7XG4gICAgICAgIGlmIChXID09PSAxKVxuICAgICAgICAgICAgcmV0dXJuIHRoaXMuX3Vuc2FmZUxhZGRlcihwb2ludCwgc2NhbGFyLCBwcmV2KTsgLy8gRm9yIFc9MSBsYWRkZXIgaXMgfngyIGZhc3RlclxuICAgICAgICByZXR1cm4gdGhpcy53TkFGVW5zYWZlKFcsIHRoaXMuZ2V0UHJlY29tcHV0ZXMoVywgcG9pbnQsIHRyYW5zZm9ybSksIHNjYWxhciwgcHJldik7XG4gICAgfVxuICAgIC8vIFdlIGNhbGN1bGF0ZSBwcmVjb21wdXRlcyBmb3IgZWxsaXB0aWMgY3VydmUgcG9pbnQgbXVsdGlwbGljYXRpb25cbiAgICAvLyB1c2luZyB3aW5kb3dlZCBtZXRob2QuIFRoaXMgc3BlY2lmaWVzIHdpbmRvdyBzaXplIGFuZFxuICAgIC8vIHN0b3JlcyBwcmVjb21wdXRlZCB2YWx1ZXMuIFVzdWFsbHkgb25seSBiYXNlIHBvaW50IHdvdWxkIGJlIHByZWNvbXB1dGVkLlxuICAgIGNyZWF0ZUNhY2hlKFAsIFcpIHtcbiAgICAgICAgdmFsaWRhdGVXKFcsIHRoaXMuYml0cyk7XG4gICAgICAgIHBvaW50V2luZG93U2l6ZXMuc2V0KFAsIFcpO1xuICAgICAgICBwb2ludFByZWNvbXB1dGVzLmRlbGV0ZShQKTtcbiAgICB9XG4gICAgaGFzQ2FjaGUoZWxtKSB7XG4gICAgICAgIHJldHVybiBnZXRXKGVsbSkgIT09IDE7XG4gICAgfVxufVxuLyoqXG4gKiBFbmRvbW9ycGhpc20tc3BlY2lmaWMgbXVsdGlwbGljYXRpb24gZm9yIEtvYmxpdHogY3VydmVzLlxuICogQ29zdDogMTI4IGRibCwgMC0yNTYgYWRkcy5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIG11bEVuZG9VbnNhZmUoUG9pbnQsIHBvaW50LCBrMSwgazIpIHtcbiAgICBsZXQgYWNjID0gcG9pbnQ7XG4gICAgbGV0IHAxID0gUG9pbnQuWkVSTztcbiAgICBsZXQgcDIgPSBQb2ludC5aRVJPO1xuICAgIHdoaWxlIChrMSA+IF8wbiB8fCBrMiA+IF8wbikge1xuICAgICAgICBpZiAoazEgJiBfMW4pXG4gICAgICAgICAgICBwMSA9IHAxLmFkZChhY2MpO1xuICAgICAgICBpZiAoazIgJiBfMW4pXG4gICAgICAgICAgICBwMiA9IHAyLmFkZChhY2MpO1xuICAgICAgICBhY2MgPSBhY2MuZG91YmxlKCk7XG4gICAgICAgIGsxID4+PSBfMW47XG4gICAgICAgIGsyID4+PSBfMW47XG4gICAgfVxuICAgIHJldHVybiB7IHAxLCBwMiB9O1xufVxuLyoqXG4gKiBQaXBwZW5nZXIgYWxnb3JpdGhtIGZvciBtdWx0aS1zY2FsYXIgbXVsdGlwbGljYXRpb24gKE1TTSwgUGEgKyBRYiArIFJjICsgLi4uKS5cbiAqIDMweCBmYXN0ZXIgdnMgbmFpdmUgYWRkaXRpb24gb24gTD00MDk2LCAxMHggZmFzdGVyIHRoYW4gcHJlY29tcHV0ZXMuXG4gKiBGb3IgTj0yNTRiaXQsIEw9MSwgaXQgZG9lczogMTAyNCBBREQgKyAyNTQgREJMLiBGb3IgTD01OiAxNTM2IEFERCArIDI1NCBEQkwuXG4gKiBBbGdvcml0aG1pY2FsbHkgY29uc3RhbnQtdGltZSAoZm9yIHNhbWUgTCksIGV2ZW4gd2hlbiAxIHBvaW50ICsgc2NhbGFyLCBvciB3aGVuIHNjYWxhciA9IDAuXG4gKiBAcGFyYW0gYyBDdXJ2ZSBQb2ludCBjb25zdHJ1Y3RvclxuICogQHBhcmFtIGZpZWxkTiBmaWVsZCBvdmVyIENVUlZFLk4gLSBpbXBvcnRhbnQgdGhhdCBpdCdzIG5vdCBvdmVyIENVUlZFLlBcbiAqIEBwYXJhbSBwb2ludHMgYXJyYXkgb2YgTCBjdXJ2ZSBwb2ludHNcbiAqIEBwYXJhbSBzY2FsYXJzIGFycmF5IG9mIEwgc2NhbGFycyAoYWthIHNlY3JldCBrZXlzIC8gYmlnaW50cylcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHBpcHBlbmdlcihjLCBmaWVsZE4sIHBvaW50cywgc2NhbGFycykge1xuICAgIC8vIElmIHdlIHNwbGl0IHNjYWxhcnMgYnkgc29tZSB3aW5kb3cgKGxldCdzIHNheSA4IGJpdHMpLCBldmVyeSBjaHVuayB3aWxsIG9ubHlcbiAgICAvLyB0YWtlIDI1NiBidWNrZXRzIGV2ZW4gaWYgdGhlcmUgYXJlIDQwOTYgc2NhbGFycywgYWxzbyByZS11c2VzIGRvdWJsZS5cbiAgICAvLyBUT0RPOlxuICAgIC8vIC0gaHR0cHM6Ly9lcHJpbnQuaWFjci5vcmcvMjAyNC83NTAucGRmXG4gICAgLy8gLSBodHRwczovL3RjaGVzLmlhY3Iub3JnL2luZGV4LnBocC9UQ0hFUy9hcnRpY2xlL3ZpZXcvMTAyODdcbiAgICAvLyAwIGlzIGFjY2VwdGVkIGluIHNjYWxhcnNcbiAgICB2YWxpZGF0ZU1TTVBvaW50cyhwb2ludHMsIGMpO1xuICAgIHZhbGlkYXRlTVNNU2NhbGFycyhzY2FsYXJzLCBmaWVsZE4pO1xuICAgIGNvbnN0IHBsZW5ndGggPSBwb2ludHMubGVuZ3RoO1xuICAgIGNvbnN0IHNsZW5ndGggPSBzY2FsYXJzLmxlbmd0aDtcbiAgICBpZiAocGxlbmd0aCAhPT0gc2xlbmd0aClcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdhcnJheXMgb2YgcG9pbnRzIGFuZCBzY2FsYXJzIG11c3QgaGF2ZSBlcXVhbCBsZW5ndGgnKTtcbiAgICAvLyBpZiAocGxlbmd0aCA9PT0gMCkgdGhyb3cgbmV3IEVycm9yKCdhcnJheSBtdXN0IGJlIG9mIGxlbmd0aCA+PSAyJyk7XG4gICAgY29uc3QgemVybyA9IGMuWkVSTztcbiAgICBjb25zdCB3Yml0cyA9IGJpdExlbihCaWdJbnQocGxlbmd0aCkpO1xuICAgIGxldCB3aW5kb3dTaXplID0gMTsgLy8gYml0c1xuICAgIGlmICh3Yml0cyA+IDEyKVxuICAgICAgICB3aW5kb3dTaXplID0gd2JpdHMgLSAzO1xuICAgIGVsc2UgaWYgKHdiaXRzID4gNClcbiAgICAgICAgd2luZG93U2l6ZSA9IHdiaXRzIC0gMjtcbiAgICBlbHNlIGlmICh3Yml0cyA+IDApXG4gICAgICAgIHdpbmRvd1NpemUgPSAyO1xuICAgIGNvbnN0IE1BU0sgPSBiaXRNYXNrKHdpbmRvd1NpemUpO1xuICAgIGNvbnN0IGJ1Y2tldHMgPSBuZXcgQXJyYXkoTnVtYmVyKE1BU0spICsgMSkuZmlsbCh6ZXJvKTsgLy8gKzEgZm9yIHplcm8gYXJyYXlcbiAgICBjb25zdCBsYXN0Qml0cyA9IE1hdGguZmxvb3IoKGZpZWxkTi5CSVRTIC0gMSkgLyB3aW5kb3dTaXplKSAqIHdpbmRvd1NpemU7XG4gICAgbGV0IHN1bSA9IHplcm87XG4gICAgZm9yIChsZXQgaSA9IGxhc3RCaXRzOyBpID49IDA7IGkgLT0gd2luZG93U2l6ZSkge1xuICAgICAgICBidWNrZXRzLmZpbGwoemVybyk7XG4gICAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgc2xlbmd0aDsgaisrKSB7XG4gICAgICAgICAgICBjb25zdCBzY2FsYXIgPSBzY2FsYXJzW2pdO1xuICAgICAgICAgICAgY29uc3Qgd2JpdHMgPSBOdW1iZXIoKHNjYWxhciA+PiBCaWdJbnQoaSkpICYgTUFTSyk7XG4gICAgICAgICAgICBidWNrZXRzW3diaXRzXSA9IGJ1Y2tldHNbd2JpdHNdLmFkZChwb2ludHNbal0pO1xuICAgICAgICB9XG4gICAgICAgIGxldCByZXNJID0gemVybzsgLy8gbm90IHVzaW5nIHRoaXMgd2lsbCBkbyBzbWFsbCBzcGVlZC11cCwgYnV0IHdpbGwgbG9zZSBjdFxuICAgICAgICAvLyBTa2lwIGZpcnN0IGJ1Y2tldCwgYmVjYXVzZSBpdCBpcyB6ZXJvXG4gICAgICAgIGZvciAobGV0IGogPSBidWNrZXRzLmxlbmd0aCAtIDEsIHN1bUkgPSB6ZXJvOyBqID4gMDsgai0tKSB7XG4gICAgICAgICAgICBzdW1JID0gc3VtSS5hZGQoYnVja2V0c1tqXSk7XG4gICAgICAgICAgICByZXNJID0gcmVzSS5hZGQoc3VtSSk7XG4gICAgICAgIH1cbiAgICAgICAgc3VtID0gc3VtLmFkZChyZXNJKTtcbiAgICAgICAgaWYgKGkgIT09IDApXG4gICAgICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IHdpbmRvd1NpemU7IGorKylcbiAgICAgICAgICAgICAgICBzdW0gPSBzdW0uZG91YmxlKCk7XG4gICAgfVxuICAgIHJldHVybiBzdW07XG59XG4vKipcbiAqIFByZWNvbXB1dGVkIG11bHRpLXNjYWxhciBtdWx0aXBsaWNhdGlvbiAoTVNNLCBQYSArIFFiICsgUmMgKyAuLi4pLlxuICogQHBhcmFtIGMgQ3VydmUgUG9pbnQgY29uc3RydWN0b3JcbiAqIEBwYXJhbSBmaWVsZE4gZmllbGQgb3ZlciBDVVJWRS5OIC0gaW1wb3J0YW50IHRoYXQgaXQncyBub3Qgb3ZlciBDVVJWRS5QXG4gKiBAcGFyYW0gcG9pbnRzIGFycmF5IG9mIEwgY3VydmUgcG9pbnRzXG4gKiBAcmV0dXJucyBmdW5jdGlvbiB3aGljaCBtdWx0aXBsaWVzIHBvaW50cyB3aXRoIHNjYWFyc1xuICovXG5leHBvcnQgZnVuY3Rpb24gcHJlY29tcHV0ZU1TTVVuc2FmZShjLCBmaWVsZE4sIHBvaW50cywgd2luZG93U2l6ZSkge1xuICAgIC8qKlxuICAgICAqIFBlcmZvcm1hbmNlIEFuYWx5c2lzIG9mIFdpbmRvdy1iYXNlZCBQcmVjb21wdXRhdGlvblxuICAgICAqXG4gICAgICogQmFzZSBDYXNlICgyNTYtYml0IHNjYWxhciwgOC1iaXQgd2luZG93KTpcbiAgICAgKiAtIFN0YW5kYXJkIHByZWNvbXB1dGF0aW9uIHJlcXVpcmVzOlxuICAgICAqICAgLSAzMSBhZGRpdGlvbnMgcGVyIHNjYWxhciDDlyAyNTYgc2NhbGFycyA9IDcsOTM2IG9wc1xuICAgICAqICAgLSBQbHVzIDI1NSBzdW1tYXJ5IGFkZGl0aW9ucyA9IDgsMTkxIHRvdGFsIG9wc1xuICAgICAqICAgTm90ZTogU3VtbWFyeSBhZGRpdGlvbnMgY2FuIGJlIG9wdGltaXplZCB2aWEgYWNjdW11bGF0b3JcbiAgICAgKlxuICAgICAqIENodW5rZWQgUHJlY29tcHV0YXRpb24gQW5hbHlzaXM6XG4gICAgICogLSBVc2luZyAzMiBjaHVua3MgcmVxdWlyZXM6XG4gICAgICogICAtIDI1NSBhZGRpdGlvbnMgcGVyIGNodW5rXG4gICAgICogICAtIDI1NiBkb3VibGluZ3NcbiAgICAgKiAgIC0gVG90YWw6ICgyNTUgw5cgMzIpICsgMjU2ID0gOCw0MTYgb3BzXG4gICAgICpcbiAgICAgKiBNZW1vcnkgVXNhZ2UgQ29tcGFyaXNvbjpcbiAgICAgKiBXaW5kb3cgU2l6ZSB8IFN0YW5kYXJkIFBvaW50cyB8IENodW5rZWQgUG9pbnRzXG4gICAgICogLS0tLS0tLS0tLS0tfC0tLS0tLS0tLS0tLS0tLS0tfC0tLS0tLS0tLS0tLS0tLVxuICAgICAqICAgICA0LWJpdCAgIHwgICAgIDUyMCAgICAgICAgIHwgICAgICAxNVxuICAgICAqICAgICA4LWJpdCAgIHwgICAgNCwyMjQgICAgICAgIHwgICAgIDI1NVxuICAgICAqICAgIDEwLWJpdCAgIHwgICAxMyw4MjQgICAgICAgIHwgICAxLDAyM1xuICAgICAqICAgIDE2LWJpdCAgIHwgIDU1NywwNTYgICAgICAgIHwgIDY1LDUzNVxuICAgICAqXG4gICAgICogS2V5IEFkdmFudGFnZXM6XG4gICAgICogMS4gRW5hYmxlcyBsYXJnZXIgd2luZG93IHNpemVzIGR1ZSB0byByZWR1Y2VkIG1lbW9yeSBvdmVyaGVhZFxuICAgICAqIDIuIE1vcmUgZWZmaWNpZW50IGZvciBzbWFsbGVyIHNjYWxhciBjb3VudHM6XG4gICAgICogICAgLSAxNiBjaHVua3M6ICgxNiDDlyAyNTUpICsgMjU2ID0gNCwzMzYgb3BzXG4gICAgICogICAgLSB+MnggZmFzdGVyIHRoYW4gc3RhbmRhcmQgOCwxOTEgb3BzXG4gICAgICpcbiAgICAgKiBMaW1pdGF0aW9uczpcbiAgICAgKiAtIE5vdCBzdWl0YWJsZSBmb3IgcGxhaW4gcHJlY29tcHV0ZXMgKHJlcXVpcmVzIDI1NiBjb25zdGFudCBkb3VibGluZ3MpXG4gICAgICogLSBQZXJmb3JtYW5jZSBkZWdyYWRlcyB3aXRoIGxhcmdlciBzY2FsYXIgY291bnRzOlxuICAgICAqICAgLSBPcHRpbWFsIGZvciB+MjU2IHNjYWxhcnNcbiAgICAgKiAgIC0gTGVzcyBlZmZpY2llbnQgZm9yIDQwOTYrIHNjYWxhcnMgKFBpcHBlbmdlciBwcmVmZXJyZWQpXG4gICAgICovXG4gICAgdmFsaWRhdGVXKHdpbmRvd1NpemUsIGZpZWxkTi5CSVRTKTtcbiAgICB2YWxpZGF0ZU1TTVBvaW50cyhwb2ludHMsIGMpO1xuICAgIGNvbnN0IHplcm8gPSBjLlpFUk87XG4gICAgY29uc3QgdGFibGVTaXplID0gMiAqKiB3aW5kb3dTaXplIC0gMTsgLy8gdGFibGUgc2l6ZSAod2l0aG91dCB6ZXJvKVxuICAgIGNvbnN0IGNodW5rcyA9IE1hdGguY2VpbChmaWVsZE4uQklUUyAvIHdpbmRvd1NpemUpOyAvLyBjaHVua3Mgb2YgaXRlbVxuICAgIGNvbnN0IE1BU0sgPSBiaXRNYXNrKHdpbmRvd1NpemUpO1xuICAgIGNvbnN0IHRhYmxlcyA9IHBvaW50cy5tYXAoKHApID0+IHtcbiAgICAgICAgY29uc3QgcmVzID0gW107XG4gICAgICAgIGZvciAobGV0IGkgPSAwLCBhY2MgPSBwOyBpIDwgdGFibGVTaXplOyBpKyspIHtcbiAgICAgICAgICAgIHJlcy5wdXNoKGFjYyk7XG4gICAgICAgICAgICBhY2MgPSBhY2MuYWRkKHApO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiByZXM7XG4gICAgfSk7XG4gICAgcmV0dXJuIChzY2FsYXJzKSA9PiB7XG4gICAgICAgIHZhbGlkYXRlTVNNU2NhbGFycyhzY2FsYXJzLCBmaWVsZE4pO1xuICAgICAgICBpZiAoc2NhbGFycy5sZW5ndGggPiBwb2ludHMubGVuZ3RoKVxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdhcnJheSBvZiBzY2FsYXJzIG11c3QgYmUgc21hbGxlciB0aGFuIGFycmF5IG9mIHBvaW50cycpO1xuICAgICAgICBsZXQgcmVzID0gemVybztcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBjaHVua3M7IGkrKykge1xuICAgICAgICAgICAgLy8gTm8gbmVlZCB0byBkb3VibGUgaWYgYWNjdW11bGF0b3IgaXMgc3RpbGwgemVyby5cbiAgICAgICAgICAgIGlmIChyZXMgIT09IHplcm8pXG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaiA9IDA7IGogPCB3aW5kb3dTaXplOyBqKyspXG4gICAgICAgICAgICAgICAgICAgIHJlcyA9IHJlcy5kb3VibGUoKTtcbiAgICAgICAgICAgIGNvbnN0IHNoaWZ0QnkgPSBCaWdJbnQoY2h1bmtzICogd2luZG93U2l6ZSAtIChpICsgMSkgKiB3aW5kb3dTaXplKTtcbiAgICAgICAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgc2NhbGFycy5sZW5ndGg7IGorKykge1xuICAgICAgICAgICAgICAgIGNvbnN0IG4gPSBzY2FsYXJzW2pdO1xuICAgICAgICAgICAgICAgIGNvbnN0IGN1cnIgPSBOdW1iZXIoKG4gPj4gc2hpZnRCeSkgJiBNQVNLKTtcbiAgICAgICAgICAgICAgICBpZiAoIWN1cnIpXG4gICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlOyAvLyBza2lwIHplcm8gc2NhbGFycyBjaHVua3NcbiAgICAgICAgICAgICAgICByZXMgPSByZXMuYWRkKHRhYmxlc1tqXVtjdXJyIC0gMV0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiByZXM7XG4gICAgfTtcbn1cbi8vIFRPRE86IHJlbW92ZVxuLyoqIEBkZXByZWNhdGVkICovXG5leHBvcnQgZnVuY3Rpb24gdmFsaWRhdGVCYXNpYyhjdXJ2ZSkge1xuICAgIHZhbGlkYXRlRmllbGQoY3VydmUuRnApO1xuICAgIHZhbGlkYXRlT2JqZWN0KGN1cnZlLCB7XG4gICAgICAgIG46ICdiaWdpbnQnLFxuICAgICAgICBoOiAnYmlnaW50JyxcbiAgICAgICAgR3g6ICdmaWVsZCcsXG4gICAgICAgIEd5OiAnZmllbGQnLFxuICAgIH0sIHtcbiAgICAgICAgbkJpdExlbmd0aDogJ2lzU2FmZUludGVnZXInLFxuICAgICAgICBuQnl0ZUxlbmd0aDogJ2lzU2FmZUludGVnZXInLFxuICAgIH0pO1xuICAgIC8vIFNldCBkZWZhdWx0c1xuICAgIHJldHVybiBPYmplY3QuZnJlZXplKHtcbiAgICAgICAgLi4ubkxlbmd0aChjdXJ2ZS5uLCBjdXJ2ZS5uQml0TGVuZ3RoKSxcbiAgICAgICAgLi4uY3VydmUsXG4gICAgICAgIC4uLnsgcDogY3VydmUuRnAuT1JERVIgfSxcbiAgICB9KTtcbn1cbmZ1bmN0aW9uIGNyZWF0ZUZpZWxkKG9yZGVyLCBmaWVsZCwgaXNMRSkge1xuICAgIGlmIChmaWVsZCkge1xuICAgICAgICBpZiAoZmllbGQuT1JERVIgIT09IG9yZGVyKVxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdGaWVsZC5PUkRFUiBtdXN0IG1hdGNoIG9yZGVyOiBGcCA9PSBwLCBGbiA9PSBuJyk7XG4gICAgICAgIHZhbGlkYXRlRmllbGQoZmllbGQpO1xuICAgICAgICByZXR1cm4gZmllbGQ7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgICByZXR1cm4gRmllbGQob3JkZXIsIHsgaXNMRSB9KTtcbiAgICB9XG59XG4vKiogVmFsaWRhdGVzIENVUlZFIG9wdHMgYW5kIGNyZWF0ZXMgZmllbGRzICovXG5leHBvcnQgZnVuY3Rpb24gX2NyZWF0ZUN1cnZlRmllbGRzKHR5cGUsIENVUlZFLCBjdXJ2ZU9wdHMgPSB7fSwgRnBGbkxFKSB7XG4gICAgaWYgKEZwRm5MRSA9PT0gdW5kZWZpbmVkKVxuICAgICAgICBGcEZuTEUgPSB0eXBlID09PSAnZWR3YXJkcyc7XG4gICAgaWYgKCFDVVJWRSB8fCB0eXBlb2YgQ1VSVkUgIT09ICdvYmplY3QnKVxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYGV4cGVjdGVkIHZhbGlkICR7dHlwZX0gQ1VSVkUgb2JqZWN0YCk7XG4gICAgZm9yIChjb25zdCBwIG9mIFsncCcsICduJywgJ2gnXSkge1xuICAgICAgICBjb25zdCB2YWwgPSBDVVJWRVtwXTtcbiAgICAgICAgaWYgKCEodHlwZW9mIHZhbCA9PT0gJ2JpZ2ludCcgJiYgdmFsID4gXzBuKSlcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgQ1VSVkUuJHtwfSBtdXN0IGJlIHBvc2l0aXZlIGJpZ2ludGApO1xuICAgIH1cbiAgICBjb25zdCBGcCA9IGNyZWF0ZUZpZWxkKENVUlZFLnAsIGN1cnZlT3B0cy5GcCwgRnBGbkxFKTtcbiAgICBjb25zdCBGbiA9IGNyZWF0ZUZpZWxkKENVUlZFLm4sIGN1cnZlT3B0cy5GbiwgRnBGbkxFKTtcbiAgICBjb25zdCBfYiA9IHR5cGUgPT09ICd3ZWllcnN0cmFzcycgPyAnYicgOiAnZCc7XG4gICAgY29uc3QgcGFyYW1zID0gWydHeCcsICdHeScsICdhJywgX2JdO1xuICAgIGZvciAoY29uc3QgcCBvZiBwYXJhbXMpIHtcbiAgICAgICAgLy8gQHRzLWlnbm9yZVxuICAgICAgICBpZiAoIUZwLmlzVmFsaWQoQ1VSVkVbcF0pKVxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBDVVJWRS4ke3B9IG11c3QgYmUgdmFsaWQgZmllbGQgZWxlbWVudCBvZiBDVVJWRS5GcGApO1xuICAgIH1cbiAgICBDVVJWRSA9IE9iamVjdC5mcmVlemUoT2JqZWN0LmFzc2lnbih7fSwgQ1VSVkUpKTtcbiAgICByZXR1cm4geyBDVVJWRSwgRnAsIEZuIH07XG59XG4vLyMgc291cmNlTWFwcGluZ1VSTD1jdXJ2ZS5qcy5tYXAiLAogICAgIi8qKlxuICogU2hvcnQgV2VpZXJzdHJhc3MgY3VydmUgbWV0aG9kcy4gVGhlIGZvcm11bGEgaXM6IHnCsiA9IHjCsyArIGF4ICsgYi5cbiAqXG4gKiAjIyMgRGVzaWduIHJhdGlvbmFsZSBmb3IgdHlwZXNcbiAqXG4gKiAqIEludGVyYWN0aW9uIGJldHdlZW4gY2xhc3NlcyBmcm9tIGRpZmZlcmVudCBjdXJ2ZXMgc2hvdWxkIGZhaWw6XG4gKiAgIGBrMjU2LlBvaW50LkJBU0UuYWRkKHAyNTYuUG9pbnQuQkFTRSlgXG4gKiAqIEZvciB0aGlzIHB1cnBvc2Ugd2Ugd2FudCB0byB1c2UgYGluc3RhbmNlb2ZgIG9wZXJhdG9yLCB3aGljaCBpcyBmYXN0IGFuZCB3b3JrcyBkdXJpbmcgcnVudGltZVxuICogKiBEaWZmZXJlbnQgY2FsbHMgb2YgYGN1cnZlKClgIHdvdWxkIHJldHVybiBkaWZmZXJlbnQgY2xhc3NlcyAtXG4gKiAgIGBjdXJ2ZShwYXJhbXMpICE9PSBjdXJ2ZShwYXJhbXMpYDogaWYgc29tZWJvZHkgZGVjaWRlZCB0byBtb25rZXktcGF0Y2ggdGhlaXIgY3VydmUsXG4gKiAgIGl0IHdvbid0IGFmZmVjdCBvdGhlcnNcbiAqXG4gKiBUeXBlU2NyaXB0IGNhbid0IGluZmVyIHR5cGVzIGZvciBjbGFzc2VzIGNyZWF0ZWQgaW5zaWRlIGEgZnVuY3Rpb24uIENsYXNzZXMgaXMgb25lIGluc3RhbmNlXG4gKiBvZiBub21pbmF0aXZlIHR5cGVzIGluIFR5cGVTY3JpcHQgYW5kIGludGVyZmFjZXMgb25seSBjaGVjayBmb3Igc2hhcGUsIHNvIGl0J3MgaGFyZCB0byBjcmVhdGVcbiAqIHVuaXF1ZSB0eXBlIGZvciBldmVyeSBmdW5jdGlvbiBjYWxsLlxuICpcbiAqIFdlIGNhbiB1c2UgZ2VuZXJpYyB0eXBlcyB2aWEgc29tZSBwYXJhbSwgbGlrZSBjdXJ2ZSBvcHRzLCBidXQgdGhhdCB3b3VsZDpcbiAqICAgICAxLiBFbmFibGUgaW50ZXJhY3Rpb24gYmV0d2VlbiBgY3VydmUocGFyYW1zKWAgYW5kIGBjdXJ2ZShwYXJhbXMpYCAoY3VydmVzIG9mIHNhbWUgcGFyYW1zKVxuICogICAgIHdoaWNoIGlzIGhhcmQgdG8gZGVidWcuXG4gKiAgICAgMi4gUGFyYW1zIGNhbiBiZSBnZW5lcmljIGFuZCB3ZSBjYW4ndCBlbmZvcmNlIHRoZW0gdG8gYmUgY29uc3RhbnQgdmFsdWU6XG4gKiAgICAgaWYgc29tZWJvZHkgY3JlYXRlcyBjdXJ2ZSBmcm9tIG5vbi1jb25zdGFudCBwYXJhbXMsXG4gKiAgICAgaXQgd291bGQgYmUgYWxsb3dlZCB0byBpbnRlcmFjdCB3aXRoIG90aGVyIGN1cnZlcyB3aXRoIG5vbi1jb25zdGFudCBwYXJhbXNcbiAqXG4gKiBAdG9kbyBodHRwczovL3d3dy50eXBlc2NyaXB0bGFuZy5vcmcvZG9jcy9oYW5kYm9vay9yZWxlYXNlLW5vdGVzL3R5cGVzY3JpcHQtMi03Lmh0bWwjdW5pcXVlLXN5bWJvbFxuICogQG1vZHVsZVxuICovXG4vKiEgbm9ibGUtY3VydmVzIC0gTUlUIExpY2Vuc2UgKGMpIDIwMjIgUGF1bCBNaWxsZXIgKHBhdWxtaWxsci5jb20pICovXG5pbXBvcnQgeyBobWFjIGFzIG5vYmxlSG1hYyB9IGZyb20gJ0Bub2JsZS9oYXNoZXMvaG1hYy5qcyc7XG5pbXBvcnQgeyBhaGFzaCB9IGZyb20gJ0Bub2JsZS9oYXNoZXMvdXRpbHMnO1xuaW1wb3J0IHsgX3ZhbGlkYXRlT2JqZWN0LCBfYWJvb2wyIGFzIGFib29sLCBfYWJ5dGVzMiBhcyBhYnl0ZXMsIGFJblJhbmdlLCBiaXRMZW4sIGJpdE1hc2ssIGJ5dGVzVG9IZXgsIGJ5dGVzVG9OdW1iZXJCRSwgY29uY2F0Qnl0ZXMsIGNyZWF0ZUhtYWNEcmJnLCBlbnN1cmVCeXRlcywgaGV4VG9CeXRlcywgaW5SYW5nZSwgaXNCeXRlcywgbWVtb2l6ZWQsIG51bWJlclRvSGV4VW5wYWRkZWQsIHJhbmRvbUJ5dGVzIGFzIHJhbmRvbUJ5dGVzV2ViLCB9IGZyb20gXCIuLi91dGlscy5qc1wiO1xuaW1wb3J0IHsgX2NyZWF0ZUN1cnZlRmllbGRzLCBtdWxFbmRvVW5zYWZlLCBuZWdhdGVDdCwgbm9ybWFsaXplWiwgcGlwcGVuZ2VyLCB3TkFGLCB9IGZyb20gXCIuL2N1cnZlLmpzXCI7XG5pbXBvcnQgeyBGaWVsZCwgRnBJbnZlcnRCYXRjaCwgZ2V0TWluSGFzaExlbmd0aCwgbWFwSGFzaFRvRmllbGQsIG5MZW5ndGgsIHZhbGlkYXRlRmllbGQsIH0gZnJvbSBcIi4vbW9kdWxhci5qc1wiO1xuLy8gV2UgY29uc3RydWN0IGJhc2lzIGluIHN1Y2ggd2F5IHRoYXQgZGVuIGlzIGFsd2F5cyBwb3NpdGl2ZSBhbmQgZXF1YWxzIG4sIGJ1dCBudW0gc2lnbiBkZXBlbmRzIG9uIGJhc2lzIChub3Qgb24gc2VjcmV0IHZhbHVlKVxuY29uc3QgZGl2TmVhcmVzdCA9IChudW0sIGRlbikgPT4gKG51bSArIChudW0gPj0gMCA/IGRlbiA6IC1kZW4pIC8gXzJuKSAvIGRlbjtcbi8qKlxuICogU3BsaXRzIHNjYWxhciBmb3IgR0xWIGVuZG9tb3JwaGlzbS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIF9zcGxpdEVuZG9TY2FsYXIoaywgYmFzaXMsIG4pIHtcbiAgICAvLyBTcGxpdCBzY2FsYXIgaW50byB0d28gc3VjaCB0aGF0IHBhcnQgaXMgfmhhbGYgYml0czogYGFicyhwYXJ0KSA8IHNxcnQoTilgXG4gICAgLy8gU2luY2UgcGFydCBjYW4gYmUgbmVnYXRpdmUsIHdlIG5lZWQgdG8gZG8gdGhpcyBvbiBwb2ludC5cbiAgICAvLyBUT0RPOiB2ZXJpZnlTY2FsYXIgZnVuY3Rpb24gd2hpY2ggY29uc3VtZXMgbGFtYmRhXG4gICAgY29uc3QgW1thMSwgYjFdLCBbYTIsIGIyXV0gPSBiYXNpcztcbiAgICBjb25zdCBjMSA9IGRpdk5lYXJlc3QoYjIgKiBrLCBuKTtcbiAgICBjb25zdCBjMiA9IGRpdk5lYXJlc3QoLWIxICogaywgbik7XG4gICAgLy8gfGsxfC98azJ8IGlzIDwgc3FydChOKSwgYnV0IGNhbiBiZSBuZWdhdGl2ZS5cbiAgICAvLyBJZiB3ZSBkbyBgazEgbW9kIE5gLCB3ZSdsbCBnZXQgYmlnIHNjYWxhciAoYD4gc3FydChOKWApOiBzbywgd2UgZG8gY2hlYXBlciBuZWdhdGlvbiBpbnN0ZWFkLlxuICAgIGxldCBrMSA9IGsgLSBjMSAqIGExIC0gYzIgKiBhMjtcbiAgICBsZXQgazIgPSAtYzEgKiBiMSAtIGMyICogYjI7XG4gICAgY29uc3QgazFuZWcgPSBrMSA8IF8wbjtcbiAgICBjb25zdCBrMm5lZyA9IGsyIDwgXzBuO1xuICAgIGlmIChrMW5lZylcbiAgICAgICAgazEgPSAtazE7XG4gICAgaWYgKGsybmVnKVxuICAgICAgICBrMiA9IC1rMjtcbiAgICAvLyBEb3VibGUgY2hlY2sgdGhhdCByZXN1bHRpbmcgc2NhbGFyIGxlc3MgdGhhbiBoYWxmIGJpdHMgb2YgTjogb3RoZXJ3aXNlIHdOQUYgd2lsbCBmYWlsLlxuICAgIC8vIFRoaXMgc2hvdWxkIG9ubHkgaGFwcGVuIG9uIHdyb25nIGJhc2lzZXMuIEFsc28sIG1hdGggaW5zaWRlIGlzIHRvbyBjb21wbGV4IGFuZCBJIGRvbid0IHRydXN0IGl0LlxuICAgIGNvbnN0IE1BWF9OVU0gPSBiaXRNYXNrKE1hdGguY2VpbChiaXRMZW4obikgLyAyKSkgKyBfMW47IC8vIEhhbGYgYml0cyBvZiBOXG4gICAgaWYgKGsxIDwgXzBuIHx8IGsxID49IE1BWF9OVU0gfHwgazIgPCBfMG4gfHwgazIgPj0gTUFYX05VTSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ3NwbGl0U2NhbGFyIChlbmRvbW9ycGhpc20pOiBmYWlsZWQsIGs9JyArIGspO1xuICAgIH1cbiAgICByZXR1cm4geyBrMW5lZywgazEsIGsybmVnLCBrMiB9O1xufVxuZnVuY3Rpb24gdmFsaWRhdGVTaWdGb3JtYXQoZm9ybWF0KSB7XG4gICAgaWYgKCFbJ2NvbXBhY3QnLCAncmVjb3ZlcmVkJywgJ2RlciddLmluY2x1ZGVzKGZvcm1hdCkpXG4gICAgICAgIHRocm93IG5ldyBFcnJvcignU2lnbmF0dXJlIGZvcm1hdCBtdXN0IGJlIFwiY29tcGFjdFwiLCBcInJlY292ZXJlZFwiLCBvciBcImRlclwiJyk7XG4gICAgcmV0dXJuIGZvcm1hdDtcbn1cbmZ1bmN0aW9uIHZhbGlkYXRlU2lnT3B0cyhvcHRzLCBkZWYpIHtcbiAgICBjb25zdCBvcHRzbiA9IHt9O1xuICAgIGZvciAobGV0IG9wdE5hbWUgb2YgT2JqZWN0LmtleXMoZGVmKSkge1xuICAgICAgICAvLyBAdHMtaWdub3JlXG4gICAgICAgIG9wdHNuW29wdE5hbWVdID0gb3B0c1tvcHROYW1lXSA9PT0gdW5kZWZpbmVkID8gZGVmW29wdE5hbWVdIDogb3B0c1tvcHROYW1lXTtcbiAgICB9XG4gICAgYWJvb2wob3B0c24ubG93UywgJ2xvd1MnKTtcbiAgICBhYm9vbChvcHRzbi5wcmVoYXNoLCAncHJlaGFzaCcpO1xuICAgIGlmIChvcHRzbi5mb3JtYXQgIT09IHVuZGVmaW5lZClcbiAgICAgICAgdmFsaWRhdGVTaWdGb3JtYXQob3B0c24uZm9ybWF0KTtcbiAgICByZXR1cm4gb3B0c247XG59XG5leHBvcnQgY2xhc3MgREVSRXJyIGV4dGVuZHMgRXJyb3Ige1xuICAgIGNvbnN0cnVjdG9yKG0gPSAnJykge1xuICAgICAgICBzdXBlcihtKTtcbiAgICB9XG59XG4vKipcbiAqIEFTTi4xIERFUiBlbmNvZGluZyB1dGlsaXRpZXMuIEFTTiBpcyB2ZXJ5IGNvbXBsZXggJiBmcmFnaWxlLiBGb3JtYXQ6XG4gKlxuICogICAgIFsweDMwIChTRVFVRU5DRSksIGJ5dGVsZW5ndGgsIDB4MDIgKElOVEVHRVIpLCBpbnRMZW5ndGgsIFIsIDB4MDIgKElOVEVHRVIpLCBpbnRMZW5ndGgsIFNdXG4gKlxuICogRG9jczogaHR0cHM6Ly9sZXRzZW5jcnlwdC5vcmcvZG9jcy9hLXdhcm0td2VsY29tZS10by1hc24xLWFuZC1kZXIvLCBodHRwczovL2x1Y2EubnRvcC5vcmcvVGVhY2hpbmcvQXBwdW50aS9hc24xLmh0bWxcbiAqL1xuZXhwb3J0IGNvbnN0IERFUiA9IHtcbiAgICAvLyBhc24uMSBERVIgZW5jb2RpbmcgdXRpbHNcbiAgICBFcnI6IERFUkVycixcbiAgICAvLyBCYXNpYyBidWlsZGluZyBibG9jayBpcyBUTFYgKFRhZy1MZW5ndGgtVmFsdWUpXG4gICAgX3Rsdjoge1xuICAgICAgICBlbmNvZGU6ICh0YWcsIGRhdGEpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IHsgRXJyOiBFIH0gPSBERVI7XG4gICAgICAgICAgICBpZiAodGFnIDwgMCB8fCB0YWcgPiAyNTYpXG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEUoJ3Rsdi5lbmNvZGU6IHdyb25nIHRhZycpO1xuICAgICAgICAgICAgaWYgKGRhdGEubGVuZ3RoICYgMSlcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRSgndGx2LmVuY29kZTogdW5wYWRkZWQgZGF0YScpO1xuICAgICAgICAgICAgY29uc3QgZGF0YUxlbiA9IGRhdGEubGVuZ3RoIC8gMjtcbiAgICAgICAgICAgIGNvbnN0IGxlbiA9IG51bWJlclRvSGV4VW5wYWRkZWQoZGF0YUxlbik7XG4gICAgICAgICAgICBpZiAoKGxlbi5sZW5ndGggLyAyKSAmIDEyOClcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRSgndGx2LmVuY29kZTogbG9uZyBmb3JtIGxlbmd0aCB0b28gYmlnJyk7XG4gICAgICAgICAgICAvLyBsZW5ndGggb2YgbGVuZ3RoIHdpdGggbG9uZyBmb3JtIGZsYWdcbiAgICAgICAgICAgIGNvbnN0IGxlbkxlbiA9IGRhdGFMZW4gPiAxMjcgPyBudW1iZXJUb0hleFVucGFkZGVkKChsZW4ubGVuZ3RoIC8gMikgfCAxMjgpIDogJyc7XG4gICAgICAgICAgICBjb25zdCB0ID0gbnVtYmVyVG9IZXhVbnBhZGRlZCh0YWcpO1xuICAgICAgICAgICAgcmV0dXJuIHQgKyBsZW5MZW4gKyBsZW4gKyBkYXRhO1xuICAgICAgICB9LFxuICAgICAgICAvLyB2IC0gdmFsdWUsIGwgLSBsZWZ0IGJ5dGVzICh1bnBhcnNlZClcbiAgICAgICAgZGVjb2RlKHRhZywgZGF0YSkge1xuICAgICAgICAgICAgY29uc3QgeyBFcnI6IEUgfSA9IERFUjtcbiAgICAgICAgICAgIGxldCBwb3MgPSAwO1xuICAgICAgICAgICAgaWYgKHRhZyA8IDAgfHwgdGFnID4gMjU2KVxuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFKCd0bHYuZW5jb2RlOiB3cm9uZyB0YWcnKTtcbiAgICAgICAgICAgIGlmIChkYXRhLmxlbmd0aCA8IDIgfHwgZGF0YVtwb3MrK10gIT09IHRhZylcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRSgndGx2LmRlY29kZTogd3JvbmcgdGx2Jyk7XG4gICAgICAgICAgICBjb25zdCBmaXJzdCA9IGRhdGFbcG9zKytdO1xuICAgICAgICAgICAgY29uc3QgaXNMb25nID0gISEoZmlyc3QgJiAxMjgpOyAvLyBGaXJzdCBiaXQgb2YgZmlyc3QgbGVuZ3RoIGJ5dGUgaXMgZmxhZyBmb3Igc2hvcnQvbG9uZyBmb3JtXG4gICAgICAgICAgICBsZXQgbGVuZ3RoID0gMDtcbiAgICAgICAgICAgIGlmICghaXNMb25nKVxuICAgICAgICAgICAgICAgIGxlbmd0aCA9IGZpcnN0O1xuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgLy8gTG9uZyBmb3JtOiBbbG9uZ0ZsYWcoMWJpdCksIGxlbmd0aExlbmd0aCg3Yml0KSwgbGVuZ3RoIChCRSldXG4gICAgICAgICAgICAgICAgY29uc3QgbGVuTGVuID0gZmlyc3QgJiAxMjc7XG4gICAgICAgICAgICAgICAgaWYgKCFsZW5MZW4pXG4gICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBFKCd0bHYuZGVjb2RlKGxvbmcpOiBpbmRlZmluaXRlIGxlbmd0aCBub3Qgc3VwcG9ydGVkJyk7XG4gICAgICAgICAgICAgICAgaWYgKGxlbkxlbiA+IDQpXG4gICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBFKCd0bHYuZGVjb2RlKGxvbmcpOiBieXRlIGxlbmd0aCBpcyB0b28gYmlnJyk7IC8vIHRoaXMgd2lsbCBvdmVyZmxvdyB1MzIgaW4ganNcbiAgICAgICAgICAgICAgICBjb25zdCBsZW5ndGhCeXRlcyA9IGRhdGEuc3ViYXJyYXkocG9zLCBwb3MgKyBsZW5MZW4pO1xuICAgICAgICAgICAgICAgIGlmIChsZW5ndGhCeXRlcy5sZW5ndGggIT09IGxlbkxlbilcbiAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IEUoJ3Rsdi5kZWNvZGU6IGxlbmd0aCBieXRlcyBub3QgY29tcGxldGUnKTtcbiAgICAgICAgICAgICAgICBpZiAobGVuZ3RoQnl0ZXNbMF0gPT09IDApXG4gICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBFKCd0bHYuZGVjb2RlKGxvbmcpOiB6ZXJvIGxlZnRtb3N0IGJ5dGUnKTtcbiAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IGIgb2YgbGVuZ3RoQnl0ZXMpXG4gICAgICAgICAgICAgICAgICAgIGxlbmd0aCA9IChsZW5ndGggPDwgOCkgfCBiO1xuICAgICAgICAgICAgICAgIHBvcyArPSBsZW5MZW47XG4gICAgICAgICAgICAgICAgaWYgKGxlbmd0aCA8IDEyOClcbiAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IEUoJ3Rsdi5kZWNvZGUobG9uZyk6IG5vdCBtaW5pbWFsIGVuY29kaW5nJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb25zdCB2ID0gZGF0YS5zdWJhcnJheShwb3MsIHBvcyArIGxlbmd0aCk7XG4gICAgICAgICAgICBpZiAodi5sZW5ndGggIT09IGxlbmd0aClcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRSgndGx2LmRlY29kZTogd3JvbmcgdmFsdWUgbGVuZ3RoJyk7XG4gICAgICAgICAgICByZXR1cm4geyB2LCBsOiBkYXRhLnN1YmFycmF5KHBvcyArIGxlbmd0aCkgfTtcbiAgICAgICAgfSxcbiAgICB9LFxuICAgIC8vIGh0dHBzOi8vY3J5cHRvLnN0YWNrZXhjaGFuZ2UuY29tL2EvNTc3MzQgTGVmdG1vc3QgYml0IG9mIGZpcnN0IGJ5dGUgaXMgJ25lZ2F0aXZlJyBmbGFnLFxuICAgIC8vIHNpbmNlIHdlIGFsd2F5cyB1c2UgcG9zaXRpdmUgaW50ZWdlcnMgaGVyZS4gSXQgbXVzdCBhbHdheXMgYmUgZW1wdHk6XG4gICAgLy8gLSBhZGQgemVybyBieXRlIGlmIGV4aXN0c1xuICAgIC8vIC0gaWYgbmV4dCBieXRlIGRvZXNuJ3QgaGF2ZSBhIGZsYWcsIGxlYWRpbmcgemVybyBpcyBub3QgYWxsb3dlZCAobWluaW1hbCBlbmNvZGluZylcbiAgICBfaW50OiB7XG4gICAgICAgIGVuY29kZShudW0pIHtcbiAgICAgICAgICAgIGNvbnN0IHsgRXJyOiBFIH0gPSBERVI7XG4gICAgICAgICAgICBpZiAobnVtIDwgXzBuKVxuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFKCdpbnRlZ2VyOiBuZWdhdGl2ZSBpbnRlZ2VycyBhcmUgbm90IGFsbG93ZWQnKTtcbiAgICAgICAgICAgIGxldCBoZXggPSBudW1iZXJUb0hleFVucGFkZGVkKG51bSk7XG4gICAgICAgICAgICAvLyBQYWQgd2l0aCB6ZXJvIGJ5dGUgaWYgbmVnYXRpdmUgZmxhZyBpcyBwcmVzZW50XG4gICAgICAgICAgICBpZiAoTnVtYmVyLnBhcnNlSW50KGhleFswXSwgMTYpICYgMGIxMDAwKVxuICAgICAgICAgICAgICAgIGhleCA9ICcwMCcgKyBoZXg7XG4gICAgICAgICAgICBpZiAoaGV4Lmxlbmd0aCAmIDEpXG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEUoJ3VuZXhwZWN0ZWQgREVSIHBhcnNpbmcgYXNzZXJ0aW9uOiB1bnBhZGRlZCBoZXgnKTtcbiAgICAgICAgICAgIHJldHVybiBoZXg7XG4gICAgICAgIH0sXG4gICAgICAgIGRlY29kZShkYXRhKSB7XG4gICAgICAgICAgICBjb25zdCB7IEVycjogRSB9ID0gREVSO1xuICAgICAgICAgICAgaWYgKGRhdGFbMF0gJiAxMjgpXG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEUoJ2ludmFsaWQgc2lnbmF0dXJlIGludGVnZXI6IG5lZ2F0aXZlJyk7XG4gICAgICAgICAgICBpZiAoZGF0YVswXSA9PT0gMHgwMCAmJiAhKGRhdGFbMV0gJiAxMjgpKVxuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFKCdpbnZhbGlkIHNpZ25hdHVyZSBpbnRlZ2VyOiB1bm5lY2Vzc2FyeSBsZWFkaW5nIHplcm8nKTtcbiAgICAgICAgICAgIHJldHVybiBieXRlc1RvTnVtYmVyQkUoZGF0YSk7XG4gICAgICAgIH0sXG4gICAgfSxcbiAgICB0b1NpZyhoZXgpIHtcbiAgICAgICAgLy8gcGFyc2UgREVSIHNpZ25hdHVyZVxuICAgICAgICBjb25zdCB7IEVycjogRSwgX2ludDogaW50LCBfdGx2OiB0bHYgfSA9IERFUjtcbiAgICAgICAgY29uc3QgZGF0YSA9IGVuc3VyZUJ5dGVzKCdzaWduYXR1cmUnLCBoZXgpO1xuICAgICAgICBjb25zdCB7IHY6IHNlcUJ5dGVzLCBsOiBzZXFMZWZ0Qnl0ZXMgfSA9IHRsdi5kZWNvZGUoMHgzMCwgZGF0YSk7XG4gICAgICAgIGlmIChzZXFMZWZ0Qnl0ZXMubGVuZ3RoKVxuICAgICAgICAgICAgdGhyb3cgbmV3IEUoJ2ludmFsaWQgc2lnbmF0dXJlOiBsZWZ0IGJ5dGVzIGFmdGVyIHBhcnNpbmcnKTtcbiAgICAgICAgY29uc3QgeyB2OiByQnl0ZXMsIGw6IHJMZWZ0Qnl0ZXMgfSA9IHRsdi5kZWNvZGUoMHgwMiwgc2VxQnl0ZXMpO1xuICAgICAgICBjb25zdCB7IHY6IHNCeXRlcywgbDogc0xlZnRCeXRlcyB9ID0gdGx2LmRlY29kZSgweDAyLCByTGVmdEJ5dGVzKTtcbiAgICAgICAgaWYgKHNMZWZ0Qnl0ZXMubGVuZ3RoKVxuICAgICAgICAgICAgdGhyb3cgbmV3IEUoJ2ludmFsaWQgc2lnbmF0dXJlOiBsZWZ0IGJ5dGVzIGFmdGVyIHBhcnNpbmcnKTtcbiAgICAgICAgcmV0dXJuIHsgcjogaW50LmRlY29kZShyQnl0ZXMpLCBzOiBpbnQuZGVjb2RlKHNCeXRlcykgfTtcbiAgICB9LFxuICAgIGhleEZyb21TaWcoc2lnKSB7XG4gICAgICAgIGNvbnN0IHsgX3RsdjogdGx2LCBfaW50OiBpbnQgfSA9IERFUjtcbiAgICAgICAgY29uc3QgcnMgPSB0bHYuZW5jb2RlKDB4MDIsIGludC5lbmNvZGUoc2lnLnIpKTtcbiAgICAgICAgY29uc3Qgc3MgPSB0bHYuZW5jb2RlKDB4MDIsIGludC5lbmNvZGUoc2lnLnMpKTtcbiAgICAgICAgY29uc3Qgc2VxID0gcnMgKyBzcztcbiAgICAgICAgcmV0dXJuIHRsdi5lbmNvZGUoMHgzMCwgc2VxKTtcbiAgICB9LFxufTtcbi8vIEJlIGZyaWVuZGx5IHRvIGJhZCBFQ01BU2NyaXB0IHBhcnNlcnMgYnkgbm90IHVzaW5nIGJpZ2ludCBsaXRlcmFsc1xuLy8gcHJldHRpZXItaWdub3JlXG5jb25zdCBfMG4gPSBCaWdJbnQoMCksIF8xbiA9IEJpZ0ludCgxKSwgXzJuID0gQmlnSW50KDIpLCBfM24gPSBCaWdJbnQoMyksIF80biA9IEJpZ0ludCg0KTtcbmV4cG9ydCBmdW5jdGlvbiBfbm9ybUZuRWxlbWVudChGbiwga2V5KSB7XG4gICAgY29uc3QgeyBCWVRFUzogZXhwZWN0ZWQgfSA9IEZuO1xuICAgIGxldCBudW07XG4gICAgaWYgKHR5cGVvZiBrZXkgPT09ICdiaWdpbnQnKSB7XG4gICAgICAgIG51bSA9IGtleTtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICAgIGxldCBieXRlcyA9IGVuc3VyZUJ5dGVzKCdwcml2YXRlIGtleScsIGtleSk7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBudW0gPSBGbi5mcm9tQnl0ZXMoYnl0ZXMpO1xuICAgICAgICB9XG4gICAgICAgIGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBpbnZhbGlkIHByaXZhdGUga2V5OiBleHBlY3RlZCB1aThhIG9mIHNpemUgJHtleHBlY3RlZH0sIGdvdCAke3R5cGVvZiBrZXl9YCk7XG4gICAgICAgIH1cbiAgICB9XG4gICAgaWYgKCFGbi5pc1ZhbGlkTm90MChudW0pKVxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ2ludmFsaWQgcHJpdmF0ZSBrZXk6IG91dCBvZiByYW5nZSBbMS4uTi0xXScpO1xuICAgIHJldHVybiBudW07XG59XG4vKipcbiAqIENyZWF0ZXMgd2VpZXJzdHJhc3MgUG9pbnQgY29uc3RydWN0b3IsIGJhc2VkIG9uIHNwZWNpZmllZCBjdXJ2ZSBvcHRpb25zLlxuICpcbiAqIEBleGFtcGxlXG5gYGBqc1xuY29uc3Qgb3B0cyA9IHtcbiAgcDogQmlnSW50KCcweGZmZmZmZmZmMDAwMDAwMDEwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDBmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmYnKSxcbiAgbjogQmlnSW50KCcweGZmZmZmZmZmMDAwMDAwMDBmZmZmZmZmZmZmZmZmZmZmYmNlNmZhYWRhNzE3OWU4NGYzYjljYWMyZmM2MzI1NTEnKSxcbiAgaDogQmlnSW50KDEpLFxuICBhOiBCaWdJbnQoJzB4ZmZmZmZmZmYwMDAwMDAwMTAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMGZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmYycpLFxuICBiOiBCaWdJbnQoJzB4NWFjNjM1ZDhhYTNhOTNlN2IzZWJiZDU1NzY5ODg2YmM2NTFkMDZiMGNjNTNiMGY2M2JjZTNjM2UyN2QyNjA0YicpLFxuICBHeDogQmlnSW50KCcweDZiMTdkMWYyZTEyYzQyNDdmOGJjZTZlNTYzYTQ0MGYyNzcwMzdkODEyZGViMzNhMGY0YTEzOTQ1ZDg5OGMyOTYnKSxcbiAgR3k6IEJpZ0ludCgnMHg0ZmUzNDJlMmZlMWE3ZjliOGVlN2ViNGE3YzBmOWUxNjJiY2UzMzU3NmIzMTVlY2VjYmI2NDA2ODM3YmY1MWY1JyksXG59O1xuY29uc3QgcDI1Nl9Qb2ludCA9IHdlaWVyc3RyYXNzKG9wdHMpO1xuYGBgXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiB3ZWllcnN0cmFzc04ocGFyYW1zLCBleHRyYU9wdHMgPSB7fSkge1xuICAgIGNvbnN0IHZhbGlkYXRlZCA9IF9jcmVhdGVDdXJ2ZUZpZWxkcygnd2VpZXJzdHJhc3MnLCBwYXJhbXMsIGV4dHJhT3B0cyk7XG4gICAgY29uc3QgeyBGcCwgRm4gfSA9IHZhbGlkYXRlZDtcbiAgICBsZXQgQ1VSVkUgPSB2YWxpZGF0ZWQuQ1VSVkU7XG4gICAgY29uc3QgeyBoOiBjb2ZhY3RvciwgbjogQ1VSVkVfT1JERVIgfSA9IENVUlZFO1xuICAgIF92YWxpZGF0ZU9iamVjdChleHRyYU9wdHMsIHt9LCB7XG4gICAgICAgIGFsbG93SW5maW5pdHlQb2ludDogJ2Jvb2xlYW4nLFxuICAgICAgICBjbGVhckNvZmFjdG9yOiAnZnVuY3Rpb24nLFxuICAgICAgICBpc1RvcnNpb25GcmVlOiAnZnVuY3Rpb24nLFxuICAgICAgICBmcm9tQnl0ZXM6ICdmdW5jdGlvbicsXG4gICAgICAgIHRvQnl0ZXM6ICdmdW5jdGlvbicsXG4gICAgICAgIGVuZG86ICdvYmplY3QnLFxuICAgICAgICB3cmFwUHJpdmF0ZUtleTogJ2Jvb2xlYW4nLFxuICAgIH0pO1xuICAgIGNvbnN0IHsgZW5kbyB9ID0gZXh0cmFPcHRzO1xuICAgIGlmIChlbmRvKSB7XG4gICAgICAgIC8vIHZhbGlkYXRlT2JqZWN0KGVuZG8sIHsgYmV0YTogJ2JpZ2ludCcsIHNwbGl0U2NhbGFyOiAnZnVuY3Rpb24nIH0pO1xuICAgICAgICBpZiAoIUZwLmlzMChDVVJWRS5hKSB8fCB0eXBlb2YgZW5kby5iZXRhICE9PSAnYmlnaW50JyB8fCAhQXJyYXkuaXNBcnJheShlbmRvLmJhc2lzZXMpKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ2ludmFsaWQgZW5kbzogZXhwZWN0ZWQgXCJiZXRhXCI6IGJpZ2ludCBhbmQgXCJiYXNpc2VzXCI6IGFycmF5Jyk7XG4gICAgICAgIH1cbiAgICB9XG4gICAgY29uc3QgbGVuZ3RocyA9IGdldFdMZW5ndGhzKEZwLCBGbik7XG4gICAgZnVuY3Rpb24gYXNzZXJ0Q29tcHJlc3Npb25Jc1N1cHBvcnRlZCgpIHtcbiAgICAgICAgaWYgKCFGcC5pc09kZClcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignY29tcHJlc3Npb24gaXMgbm90IHN1cHBvcnRlZDogRmllbGQgZG9lcyBub3QgaGF2ZSAuaXNPZGQoKScpO1xuICAgIH1cbiAgICAvLyBJbXBsZW1lbnRzIElFRUUgUDEzNjMgcG9pbnQgZW5jb2RpbmdcbiAgICBmdW5jdGlvbiBwb2ludFRvQnl0ZXMoX2MsIHBvaW50LCBpc0NvbXByZXNzZWQpIHtcbiAgICAgICAgY29uc3QgeyB4LCB5IH0gPSBwb2ludC50b0FmZmluZSgpO1xuICAgICAgICBjb25zdCBieCA9IEZwLnRvQnl0ZXMoeCk7XG4gICAgICAgIGFib29sKGlzQ29tcHJlc3NlZCwgJ2lzQ29tcHJlc3NlZCcpO1xuICAgICAgICBpZiAoaXNDb21wcmVzc2VkKSB7XG4gICAgICAgICAgICBhc3NlcnRDb21wcmVzc2lvbklzU3VwcG9ydGVkKCk7XG4gICAgICAgICAgICBjb25zdCBoYXNFdmVuWSA9ICFGcC5pc09kZCh5KTtcbiAgICAgICAgICAgIHJldHVybiBjb25jYXRCeXRlcyhwcHJlZml4KGhhc0V2ZW5ZKSwgYngpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIGNvbmNhdEJ5dGVzKFVpbnQ4QXJyYXkub2YoMHgwNCksIGJ4LCBGcC50b0J5dGVzKHkpKTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBmdW5jdGlvbiBwb2ludEZyb21CeXRlcyhieXRlcykge1xuICAgICAgICBhYnl0ZXMoYnl0ZXMsIHVuZGVmaW5lZCwgJ1BvaW50Jyk7XG4gICAgICAgIGNvbnN0IHsgcHVibGljS2V5OiBjb21wLCBwdWJsaWNLZXlVbmNvbXByZXNzZWQ6IHVuY29tcCB9ID0gbGVuZ3RoczsgLy8gZS5nLiBmb3IgMzItYnl0ZTogMzMsIDY1XG4gICAgICAgIGNvbnN0IGxlbmd0aCA9IGJ5dGVzLmxlbmd0aDtcbiAgICAgICAgY29uc3QgaGVhZCA9IGJ5dGVzWzBdO1xuICAgICAgICBjb25zdCB0YWlsID0gYnl0ZXMuc3ViYXJyYXkoMSk7XG4gICAgICAgIC8vIE5vIGFjdHVhbCB2YWxpZGF0aW9uIGlzIGRvbmUgaGVyZTogdXNlIC5hc3NlcnRWYWxpZGl0eSgpXG4gICAgICAgIGlmIChsZW5ndGggPT09IGNvbXAgJiYgKGhlYWQgPT09IDB4MDIgfHwgaGVhZCA9PT0gMHgwMykpIHtcbiAgICAgICAgICAgIGNvbnN0IHggPSBGcC5mcm9tQnl0ZXModGFpbCk7XG4gICAgICAgICAgICBpZiAoIUZwLmlzVmFsaWQoeCkpXG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdiYWQgcG9pbnQ6IGlzIG5vdCBvbiBjdXJ2ZSwgd3JvbmcgeCcpO1xuICAgICAgICAgICAgY29uc3QgeTIgPSB3ZWllcnN0cmFzc0VxdWF0aW9uKHgpOyAvLyB5wrIgPSB4wrMgKyBheCArIGJcbiAgICAgICAgICAgIGxldCB5O1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICB5ID0gRnAuc3FydCh5Mik7IC8vIHkgPSB5wrIgXiAocCsxKS80XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjYXRjaCAoc3FydEVycm9yKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgZXJyID0gc3FydEVycm9yIGluc3RhbmNlb2YgRXJyb3IgPyAnOiAnICsgc3FydEVycm9yLm1lc3NhZ2UgOiAnJztcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ2JhZCBwb2ludDogaXMgbm90IG9uIGN1cnZlLCBzcXJ0IGVycm9yJyArIGVycik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBhc3NlcnRDb21wcmVzc2lvbklzU3VwcG9ydGVkKCk7XG4gICAgICAgICAgICBjb25zdCBpc1lPZGQgPSBGcC5pc09kZCh5KTsgLy8gKHkgJiBfMW4pID09PSBfMW47XG4gICAgICAgICAgICBjb25zdCBpc0hlYWRPZGQgPSAoaGVhZCAmIDEpID09PSAxOyAvLyBFQ0RTQS1zcGVjaWZpY1xuICAgICAgICAgICAgaWYgKGlzSGVhZE9kZCAhPT0gaXNZT2RkKVxuICAgICAgICAgICAgICAgIHkgPSBGcC5uZWcoeSk7XG4gICAgICAgICAgICByZXR1cm4geyB4LCB5IH07XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAobGVuZ3RoID09PSB1bmNvbXAgJiYgaGVhZCA9PT0gMHgwNCkge1xuICAgICAgICAgICAgLy8gVE9ETzogbW9yZSBjaGVja3NcbiAgICAgICAgICAgIGNvbnN0IEwgPSBGcC5CWVRFUztcbiAgICAgICAgICAgIGNvbnN0IHggPSBGcC5mcm9tQnl0ZXModGFpbC5zdWJhcnJheSgwLCBMKSk7XG4gICAgICAgICAgICBjb25zdCB5ID0gRnAuZnJvbUJ5dGVzKHRhaWwuc3ViYXJyYXkoTCwgTCAqIDIpKTtcbiAgICAgICAgICAgIGlmICghaXNWYWxpZFhZKHgsIHkpKVxuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignYmFkIHBvaW50OiBpcyBub3Qgb24gY3VydmUnKTtcbiAgICAgICAgICAgIHJldHVybiB7IHgsIHkgfTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgYmFkIHBvaW50OiBnb3QgbGVuZ3RoICR7bGVuZ3RofSwgZXhwZWN0ZWQgY29tcHJlc3NlZD0ke2NvbXB9IG9yIHVuY29tcHJlc3NlZD0ke3VuY29tcH1gKTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBjb25zdCBlbmNvZGVQb2ludCA9IGV4dHJhT3B0cy50b0J5dGVzIHx8IHBvaW50VG9CeXRlcztcbiAgICBjb25zdCBkZWNvZGVQb2ludCA9IGV4dHJhT3B0cy5mcm9tQnl0ZXMgfHwgcG9pbnRGcm9tQnl0ZXM7XG4gICAgZnVuY3Rpb24gd2VpZXJzdHJhc3NFcXVhdGlvbih4KSB7XG4gICAgICAgIGNvbnN0IHgyID0gRnAuc3FyKHgpOyAvLyB4ICogeFxuICAgICAgICBjb25zdCB4MyA9IEZwLm11bCh4MiwgeCk7IC8vIHjCsiAqIHhcbiAgICAgICAgcmV0dXJuIEZwLmFkZChGcC5hZGQoeDMsIEZwLm11bCh4LCBDVVJWRS5hKSksIENVUlZFLmIpOyAvLyB4wrMgKyBhICogeCArIGJcbiAgICB9XG4gICAgLy8gVE9ETzogbW92ZSB0b3AtbGV2ZWxcbiAgICAvKiogQ2hlY2tzIHdoZXRoZXIgZXF1YXRpb24gaG9sZHMgZm9yIGdpdmVuIHgsIHk6IHnCsiA9PSB4wrMgKyBheCArIGIgKi9cbiAgICBmdW5jdGlvbiBpc1ZhbGlkWFkoeCwgeSkge1xuICAgICAgICBjb25zdCBsZWZ0ID0gRnAuc3FyKHkpOyAvLyB5wrJcbiAgICAgICAgY29uc3QgcmlnaHQgPSB3ZWllcnN0cmFzc0VxdWF0aW9uKHgpOyAvLyB4wrMgKyBheCArIGJcbiAgICAgICAgcmV0dXJuIEZwLmVxbChsZWZ0LCByaWdodCk7XG4gICAgfVxuICAgIC8vIFZhbGlkYXRlIHdoZXRoZXIgdGhlIHBhc3NlZCBjdXJ2ZSBwYXJhbXMgYXJlIHZhbGlkLlxuICAgIC8vIFRlc3QgMTogZXF1YXRpb24gecKyID0geMKzICsgYXggKyBiIHNob3VsZCB3b3JrIGZvciBnZW5lcmF0b3IgcG9pbnQuXG4gICAgaWYgKCFpc1ZhbGlkWFkoQ1VSVkUuR3gsIENVUlZFLkd5KSlcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdiYWQgY3VydmUgcGFyYW1zOiBnZW5lcmF0b3IgcG9pbnQnKTtcbiAgICAvLyBUZXN0IDI6IGRpc2NyaW1pbmFudCDOlCBwYXJ0IHNob3VsZCBiZSBub24temVybzogNGHCsyArIDI3YsKyICE9IDAuXG4gICAgLy8gR3VhcmFudGVlcyBjdXJ2ZSBpcyBnZW51cy0xLCBzbW9vdGggKG5vbi1zaW5ndWxhcikuXG4gICAgY29uc3QgXzRhMyA9IEZwLm11bChGcC5wb3coQ1VSVkUuYSwgXzNuKSwgXzRuKTtcbiAgICBjb25zdCBfMjdiMiA9IEZwLm11bChGcC5zcXIoQ1VSVkUuYiksIEJpZ0ludCgyNykpO1xuICAgIGlmIChGcC5pczAoRnAuYWRkKF80YTMsIF8yN2IyKSkpXG4gICAgICAgIHRocm93IG5ldyBFcnJvcignYmFkIGN1cnZlIHBhcmFtczogYSBvciBiJyk7XG4gICAgLyoqIEFzc2VydHMgY29vcmRpbmF0ZSBpcyB2YWxpZDogMCA8PSBuIDwgRnAuT1JERVIuICovXG4gICAgZnVuY3Rpb24gYWNvb3JkKHRpdGxlLCBuLCBiYW5aZXJvID0gZmFsc2UpIHtcbiAgICAgICAgaWYgKCFGcC5pc1ZhbGlkKG4pIHx8IChiYW5aZXJvICYmIEZwLmlzMChuKSkpXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYGJhZCBwb2ludCBjb29yZGluYXRlICR7dGl0bGV9YCk7XG4gICAgICAgIHJldHVybiBuO1xuICAgIH1cbiAgICBmdW5jdGlvbiBhcHJqcG9pbnQob3RoZXIpIHtcbiAgICAgICAgaWYgKCEob3RoZXIgaW5zdGFuY2VvZiBQb2ludCkpXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1Byb2plY3RpdmVQb2ludCBleHBlY3RlZCcpO1xuICAgIH1cbiAgICBmdW5jdGlvbiBzcGxpdEVuZG9TY2FsYXJOKGspIHtcbiAgICAgICAgaWYgKCFlbmRvIHx8ICFlbmRvLmJhc2lzZXMpXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ25vIGVuZG8nKTtcbiAgICAgICAgcmV0dXJuIF9zcGxpdEVuZG9TY2FsYXIoaywgZW5kby5iYXNpc2VzLCBGbi5PUkRFUik7XG4gICAgfVxuICAgIC8vIE1lbW9pemVkIHRvQWZmaW5lIC8gdmFsaWRpdHkgY2hlY2suIFRoZXkgYXJlIGhlYXZ5LiBQb2ludHMgYXJlIGltbXV0YWJsZS5cbiAgICAvLyBDb252ZXJ0cyBQcm9qZWN0aXZlIHBvaW50IHRvIGFmZmluZSAoeCwgeSkgY29vcmRpbmF0ZXMuXG4gICAgLy8gQ2FuIGFjY2VwdCBwcmVjb21wdXRlZCBaXi0xIC0gZm9yIGV4YW1wbGUsIGZyb20gaW52ZXJ0QmF0Y2guXG4gICAgLy8gKFgsIFksIFopIOKIiyAoeD1YL1osIHk9WS9aKVxuICAgIGNvbnN0IHRvQWZmaW5lTWVtbyA9IG1lbW9pemVkKChwLCBpeikgPT4ge1xuICAgICAgICBjb25zdCB7IFgsIFksIFogfSA9IHA7XG4gICAgICAgIC8vIEZhc3QtcGF0aCBmb3Igbm9ybWFsaXplZCBwb2ludHNcbiAgICAgICAgaWYgKEZwLmVxbChaLCBGcC5PTkUpKVxuICAgICAgICAgICAgcmV0dXJuIHsgeDogWCwgeTogWSB9O1xuICAgICAgICBjb25zdCBpczAgPSBwLmlzMCgpO1xuICAgICAgICAvLyBJZiBpbnZaIHdhcyAwLCB3ZSByZXR1cm4gemVybyBwb2ludC4gSG93ZXZlciB3ZSBzdGlsbCB3YW50IHRvIGV4ZWN1dGVcbiAgICAgICAgLy8gYWxsIG9wZXJhdGlvbnMsIHNvIHdlIHJlcGxhY2UgaW52WiB3aXRoIGEgcmFuZG9tIG51bWJlciwgMS5cbiAgICAgICAgaWYgKGl6ID09IG51bGwpXG4gICAgICAgICAgICBpeiA9IGlzMCA/IEZwLk9ORSA6IEZwLmludihaKTtcbiAgICAgICAgY29uc3QgeCA9IEZwLm11bChYLCBpeik7XG4gICAgICAgIGNvbnN0IHkgPSBGcC5tdWwoWSwgaXopO1xuICAgICAgICBjb25zdCB6eiA9IEZwLm11bChaLCBpeik7XG4gICAgICAgIGlmIChpczApXG4gICAgICAgICAgICByZXR1cm4geyB4OiBGcC5aRVJPLCB5OiBGcC5aRVJPIH07XG4gICAgICAgIGlmICghRnAuZXFsKHp6LCBGcC5PTkUpKVxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdpbnZaIHdhcyBpbnZhbGlkJyk7XG4gICAgICAgIHJldHVybiB7IHgsIHkgfTtcbiAgICB9KTtcbiAgICAvLyBOT1RFOiBvbiBleGNlcHRpb24gdGhpcyB3aWxsIGNyYXNoICdjYWNoZWQnIGFuZCBubyB2YWx1ZSB3aWxsIGJlIHNldC5cbiAgICAvLyBPdGhlcndpc2UgdHJ1ZSB3aWxsIGJlIHJldHVyblxuICAgIGNvbnN0IGFzc2VydFZhbGlkTWVtbyA9IG1lbW9pemVkKChwKSA9PiB7XG4gICAgICAgIGlmIChwLmlzMCgpKSB7XG4gICAgICAgICAgICAvLyAoMCwgMSwgMCkgYWthIFpFUk8gaXMgaW52YWxpZCBpbiBtb3N0IGNvbnRleHRzLlxuICAgICAgICAgICAgLy8gSW4gQkxTLCBaRVJPIGNhbiBiZSBzZXJpYWxpemVkLCBzbyB3ZSBhbGxvdyBpdC5cbiAgICAgICAgICAgIC8vICgwLCAwLCAwKSBpcyBpbnZhbGlkIHJlcHJlc2VudGF0aW9uIG9mIFpFUk8uXG4gICAgICAgICAgICBpZiAoZXh0cmFPcHRzLmFsbG93SW5maW5pdHlQb2ludCAmJiAhRnAuaXMwKHAuWSkpXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdiYWQgcG9pbnQ6IFpFUk8nKTtcbiAgICAgICAgfVxuICAgICAgICAvLyBTb21lIDNyZC1wYXJ0eSB0ZXN0IHZlY3RvcnMgcmVxdWlyZSBkaWZmZXJlbnQgd29yZGluZyBiZXR3ZWVuIGhlcmUgJiBgZnJvbUNvbXByZXNzZWRIZXhgXG4gICAgICAgIGNvbnN0IHsgeCwgeSB9ID0gcC50b0FmZmluZSgpO1xuICAgICAgICBpZiAoIUZwLmlzVmFsaWQoeCkgfHwgIUZwLmlzVmFsaWQoeSkpXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ2JhZCBwb2ludDogeCBvciB5IG5vdCBmaWVsZCBlbGVtZW50cycpO1xuICAgICAgICBpZiAoIWlzVmFsaWRYWSh4LCB5KSlcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignYmFkIHBvaW50OiBlcXVhdGlvbiBsZWZ0ICE9IHJpZ2h0Jyk7XG4gICAgICAgIGlmICghcC5pc1RvcnNpb25GcmVlKCkpXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ2JhZCBwb2ludDogbm90IGluIHByaW1lLW9yZGVyIHN1Ymdyb3VwJyk7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH0pO1xuICAgIGZ1bmN0aW9uIGZpbmlzaEVuZG8oZW5kb0JldGEsIGsxcCwgazJwLCBrMW5lZywgazJuZWcpIHtcbiAgICAgICAgazJwID0gbmV3IFBvaW50KEZwLm11bChrMnAuWCwgZW5kb0JldGEpLCBrMnAuWSwgazJwLlopO1xuICAgICAgICBrMXAgPSBuZWdhdGVDdChrMW5lZywgazFwKTtcbiAgICAgICAgazJwID0gbmVnYXRlQ3QoazJuZWcsIGsycCk7XG4gICAgICAgIHJldHVybiBrMXAuYWRkKGsycCk7XG4gICAgfVxuICAgIC8qKlxuICAgICAqIFByb2plY3RpdmUgUG9pbnQgd29ya3MgaW4gM2QgLyBwcm9qZWN0aXZlIChob21vZ2VuZW91cykgY29vcmRpbmF0ZXM6KFgsIFksIFopIOKIiyAoeD1YL1osIHk9WS9aKS5cbiAgICAgKiBEZWZhdWx0IFBvaW50IHdvcmtzIGluIDJkIC8gYWZmaW5lIGNvb3JkaW5hdGVzOiAoeCwgeSkuXG4gICAgICogV2UncmUgZG9pbmcgY2FsY3VsYXRpb25zIGluIHByb2plY3RpdmUsIGJlY2F1c2UgaXRzIG9wZXJhdGlvbnMgZG9uJ3QgcmVxdWlyZSBjb3N0bHkgaW52ZXJzaW9uLlxuICAgICAqL1xuICAgIGNsYXNzIFBvaW50IHtcbiAgICAgICAgLyoqIERvZXMgTk9UIHZhbGlkYXRlIGlmIHRoZSBwb2ludCBpcyB2YWxpZC4gVXNlIGAuYXNzZXJ0VmFsaWRpdHkoKWAuICovXG4gICAgICAgIGNvbnN0cnVjdG9yKFgsIFksIFopIHtcbiAgICAgICAgICAgIHRoaXMuWCA9IGFjb29yZCgneCcsIFgpO1xuICAgICAgICAgICAgdGhpcy5ZID0gYWNvb3JkKCd5JywgWSwgdHJ1ZSk7XG4gICAgICAgICAgICB0aGlzLlogPSBhY29vcmQoJ3onLCBaKTtcbiAgICAgICAgICAgIE9iamVjdC5mcmVlemUodGhpcyk7XG4gICAgICAgIH1cbiAgICAgICAgc3RhdGljIENVUlZFKCkge1xuICAgICAgICAgICAgcmV0dXJuIENVUlZFO1xuICAgICAgICB9XG4gICAgICAgIC8qKiBEb2VzIE5PVCB2YWxpZGF0ZSBpZiB0aGUgcG9pbnQgaXMgdmFsaWQuIFVzZSBgLmFzc2VydFZhbGlkaXR5KClgLiAqL1xuICAgICAgICBzdGF0aWMgZnJvbUFmZmluZShwKSB7XG4gICAgICAgICAgICBjb25zdCB7IHgsIHkgfSA9IHAgfHwge307XG4gICAgICAgICAgICBpZiAoIXAgfHwgIUZwLmlzVmFsaWQoeCkgfHwgIUZwLmlzVmFsaWQoeSkpXG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdpbnZhbGlkIGFmZmluZSBwb2ludCcpO1xuICAgICAgICAgICAgaWYgKHAgaW5zdGFuY2VvZiBQb2ludClcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ3Byb2plY3RpdmUgcG9pbnQgbm90IGFsbG93ZWQnKTtcbiAgICAgICAgICAgIC8vICgwLCAwKSB3b3VsZCd2ZSBwcm9kdWNlZCAoMCwgMCwgMSkgLSBpbnN0ZWFkLCB3ZSBuZWVkICgwLCAxLCAwKVxuICAgICAgICAgICAgaWYgKEZwLmlzMCh4KSAmJiBGcC5pczAoeSkpXG4gICAgICAgICAgICAgICAgcmV0dXJuIFBvaW50LlpFUk87XG4gICAgICAgICAgICByZXR1cm4gbmV3IFBvaW50KHgsIHksIEZwLk9ORSk7XG4gICAgICAgIH1cbiAgICAgICAgc3RhdGljIGZyb21CeXRlcyhieXRlcykge1xuICAgICAgICAgICAgY29uc3QgUCA9IFBvaW50LmZyb21BZmZpbmUoZGVjb2RlUG9pbnQoYWJ5dGVzKGJ5dGVzLCB1bmRlZmluZWQsICdwb2ludCcpKSk7XG4gICAgICAgICAgICBQLmFzc2VydFZhbGlkaXR5KCk7XG4gICAgICAgICAgICByZXR1cm4gUDtcbiAgICAgICAgfVxuICAgICAgICBzdGF0aWMgZnJvbUhleChoZXgpIHtcbiAgICAgICAgICAgIHJldHVybiBQb2ludC5mcm9tQnl0ZXMoZW5zdXJlQnl0ZXMoJ3BvaW50SGV4JywgaGV4KSk7XG4gICAgICAgIH1cbiAgICAgICAgZ2V0IHgoKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy50b0FmZmluZSgpLng7XG4gICAgICAgIH1cbiAgICAgICAgZ2V0IHkoKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy50b0FmZmluZSgpLnk7XG4gICAgICAgIH1cbiAgICAgICAgLyoqXG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB3aW5kb3dTaXplXG4gICAgICAgICAqIEBwYXJhbSBpc0xhenkgdHJ1ZSB3aWxsIGRlZmVyIHRhYmxlIGNvbXB1dGF0aW9uIHVudGlsIHRoZSBmaXJzdCBtdWx0aXBsaWNhdGlvblxuICAgICAgICAgKiBAcmV0dXJuc1xuICAgICAgICAgKi9cbiAgICAgICAgcHJlY29tcHV0ZSh3aW5kb3dTaXplID0gOCwgaXNMYXp5ID0gdHJ1ZSkge1xuICAgICAgICAgICAgd25hZi5jcmVhdGVDYWNoZSh0aGlzLCB3aW5kb3dTaXplKTtcbiAgICAgICAgICAgIGlmICghaXNMYXp5KVxuICAgICAgICAgICAgICAgIHRoaXMubXVsdGlwbHkoXzNuKTsgLy8gcmFuZG9tIG51bWJlclxuICAgICAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgICAgIH1cbiAgICAgICAgLy8gVE9ETzogcmV0dXJuIGB0aGlzYFxuICAgICAgICAvKiogQSBwb2ludCBvbiBjdXJ2ZSBpcyB2YWxpZCBpZiBpdCBjb25mb3JtcyB0byBlcXVhdGlvbi4gKi9cbiAgICAgICAgYXNzZXJ0VmFsaWRpdHkoKSB7XG4gICAgICAgICAgICBhc3NlcnRWYWxpZE1lbW8odGhpcyk7XG4gICAgICAgIH1cbiAgICAgICAgaGFzRXZlblkoKSB7XG4gICAgICAgICAgICBjb25zdCB7IHkgfSA9IHRoaXMudG9BZmZpbmUoKTtcbiAgICAgICAgICAgIGlmICghRnAuaXNPZGQpXG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiRmllbGQgZG9lc24ndCBzdXBwb3J0IGlzT2RkXCIpO1xuICAgICAgICAgICAgcmV0dXJuICFGcC5pc09kZCh5KTtcbiAgICAgICAgfVxuICAgICAgICAvKiogQ29tcGFyZSBvbmUgcG9pbnQgdG8gYW5vdGhlci4gKi9cbiAgICAgICAgZXF1YWxzKG90aGVyKSB7XG4gICAgICAgICAgICBhcHJqcG9pbnQob3RoZXIpO1xuICAgICAgICAgICAgY29uc3QgeyBYOiBYMSwgWTogWTEsIFo6IFoxIH0gPSB0aGlzO1xuICAgICAgICAgICAgY29uc3QgeyBYOiBYMiwgWTogWTIsIFo6IFoyIH0gPSBvdGhlcjtcbiAgICAgICAgICAgIGNvbnN0IFUxID0gRnAuZXFsKEZwLm11bChYMSwgWjIpLCBGcC5tdWwoWDIsIFoxKSk7XG4gICAgICAgICAgICBjb25zdCBVMiA9IEZwLmVxbChGcC5tdWwoWTEsIFoyKSwgRnAubXVsKFkyLCBaMSkpO1xuICAgICAgICAgICAgcmV0dXJuIFUxICYmIFUyO1xuICAgICAgICB9XG4gICAgICAgIC8qKiBGbGlwcyBwb2ludCB0byBvbmUgY29ycmVzcG9uZGluZyB0byAoeCwgLXkpIGluIEFmZmluZSBjb29yZGluYXRlcy4gKi9cbiAgICAgICAgbmVnYXRlKCkge1xuICAgICAgICAgICAgcmV0dXJuIG5ldyBQb2ludCh0aGlzLlgsIEZwLm5lZyh0aGlzLlkpLCB0aGlzLlopO1xuICAgICAgICB9XG4gICAgICAgIC8vIFJlbmVzLUNvc3RlbGxvLUJhdGluYSBleGNlcHRpb24tZnJlZSBkb3VibGluZyBmb3JtdWxhLlxuICAgICAgICAvLyBUaGVyZSBpcyAzMCUgZmFzdGVyIEphY29iaWFuIGZvcm11bGEsIGJ1dCBpdCBpcyBub3QgY29tcGxldGUuXG4gICAgICAgIC8vIGh0dHBzOi8vZXByaW50LmlhY3Iub3JnLzIwMTUvMTA2MCwgYWxnb3JpdGhtIDNcbiAgICAgICAgLy8gQ29zdDogOE0gKyAzUyArIDMqYSArIDIqYjMgKyAxNWFkZC5cbiAgICAgICAgZG91YmxlKCkge1xuICAgICAgICAgICAgY29uc3QgeyBhLCBiIH0gPSBDVVJWRTtcbiAgICAgICAgICAgIGNvbnN0IGIzID0gRnAubXVsKGIsIF8zbik7XG4gICAgICAgICAgICBjb25zdCB7IFg6IFgxLCBZOiBZMSwgWjogWjEgfSA9IHRoaXM7XG4gICAgICAgICAgICBsZXQgWDMgPSBGcC5aRVJPLCBZMyA9IEZwLlpFUk8sIFozID0gRnAuWkVSTzsgLy8gcHJldHRpZXItaWdub3JlXG4gICAgICAgICAgICBsZXQgdDAgPSBGcC5tdWwoWDEsIFgxKTsgLy8gc3RlcCAxXG4gICAgICAgICAgICBsZXQgdDEgPSBGcC5tdWwoWTEsIFkxKTtcbiAgICAgICAgICAgIGxldCB0MiA9IEZwLm11bChaMSwgWjEpO1xuICAgICAgICAgICAgbGV0IHQzID0gRnAubXVsKFgxLCBZMSk7XG4gICAgICAgICAgICB0MyA9IEZwLmFkZCh0MywgdDMpOyAvLyBzdGVwIDVcbiAgICAgICAgICAgIFozID0gRnAubXVsKFgxLCBaMSk7XG4gICAgICAgICAgICBaMyA9IEZwLmFkZChaMywgWjMpO1xuICAgICAgICAgICAgWDMgPSBGcC5tdWwoYSwgWjMpO1xuICAgICAgICAgICAgWTMgPSBGcC5tdWwoYjMsIHQyKTtcbiAgICAgICAgICAgIFkzID0gRnAuYWRkKFgzLCBZMyk7IC8vIHN0ZXAgMTBcbiAgICAgICAgICAgIFgzID0gRnAuc3ViKHQxLCBZMyk7XG4gICAgICAgICAgICBZMyA9IEZwLmFkZCh0MSwgWTMpO1xuICAgICAgICAgICAgWTMgPSBGcC5tdWwoWDMsIFkzKTtcbiAgICAgICAgICAgIFgzID0gRnAubXVsKHQzLCBYMyk7XG4gICAgICAgICAgICBaMyA9IEZwLm11bChiMywgWjMpOyAvLyBzdGVwIDE1XG4gICAgICAgICAgICB0MiA9IEZwLm11bChhLCB0Mik7XG4gICAgICAgICAgICB0MyA9IEZwLnN1Yih0MCwgdDIpO1xuICAgICAgICAgICAgdDMgPSBGcC5tdWwoYSwgdDMpO1xuICAgICAgICAgICAgdDMgPSBGcC5hZGQodDMsIFozKTtcbiAgICAgICAgICAgIFozID0gRnAuYWRkKHQwLCB0MCk7IC8vIHN0ZXAgMjBcbiAgICAgICAgICAgIHQwID0gRnAuYWRkKFozLCB0MCk7XG4gICAgICAgICAgICB0MCA9IEZwLmFkZCh0MCwgdDIpO1xuICAgICAgICAgICAgdDAgPSBGcC5tdWwodDAsIHQzKTtcbiAgICAgICAgICAgIFkzID0gRnAuYWRkKFkzLCB0MCk7XG4gICAgICAgICAgICB0MiA9IEZwLm11bChZMSwgWjEpOyAvLyBzdGVwIDI1XG4gICAgICAgICAgICB0MiA9IEZwLmFkZCh0MiwgdDIpO1xuICAgICAgICAgICAgdDAgPSBGcC5tdWwodDIsIHQzKTtcbiAgICAgICAgICAgIFgzID0gRnAuc3ViKFgzLCB0MCk7XG4gICAgICAgICAgICBaMyA9IEZwLm11bCh0MiwgdDEpO1xuICAgICAgICAgICAgWjMgPSBGcC5hZGQoWjMsIFozKTsgLy8gc3RlcCAzMFxuICAgICAgICAgICAgWjMgPSBGcC5hZGQoWjMsIFozKTtcbiAgICAgICAgICAgIHJldHVybiBuZXcgUG9pbnQoWDMsIFkzLCBaMyk7XG4gICAgICAgIH1cbiAgICAgICAgLy8gUmVuZXMtQ29zdGVsbG8tQmF0aW5hIGV4Y2VwdGlvbi1mcmVlIGFkZGl0aW9uIGZvcm11bGEuXG4gICAgICAgIC8vIFRoZXJlIGlzIDMwJSBmYXN0ZXIgSmFjb2JpYW4gZm9ybXVsYSwgYnV0IGl0IGlzIG5vdCBjb21wbGV0ZS5cbiAgICAgICAgLy8gaHR0cHM6Ly9lcHJpbnQuaWFjci5vcmcvMjAxNS8xMDYwLCBhbGdvcml0aG0gMVxuICAgICAgICAvLyBDb3N0OiAxMk0gKyAwUyArIDMqYSArIDMqYjMgKyAyM2FkZC5cbiAgICAgICAgYWRkKG90aGVyKSB7XG4gICAgICAgICAgICBhcHJqcG9pbnQob3RoZXIpO1xuICAgICAgICAgICAgY29uc3QgeyBYOiBYMSwgWTogWTEsIFo6IFoxIH0gPSB0aGlzO1xuICAgICAgICAgICAgY29uc3QgeyBYOiBYMiwgWTogWTIsIFo6IFoyIH0gPSBvdGhlcjtcbiAgICAgICAgICAgIGxldCBYMyA9IEZwLlpFUk8sIFkzID0gRnAuWkVSTywgWjMgPSBGcC5aRVJPOyAvLyBwcmV0dGllci1pZ25vcmVcbiAgICAgICAgICAgIGNvbnN0IGEgPSBDVVJWRS5hO1xuICAgICAgICAgICAgY29uc3QgYjMgPSBGcC5tdWwoQ1VSVkUuYiwgXzNuKTtcbiAgICAgICAgICAgIGxldCB0MCA9IEZwLm11bChYMSwgWDIpOyAvLyBzdGVwIDFcbiAgICAgICAgICAgIGxldCB0MSA9IEZwLm11bChZMSwgWTIpO1xuICAgICAgICAgICAgbGV0IHQyID0gRnAubXVsKFoxLCBaMik7XG4gICAgICAgICAgICBsZXQgdDMgPSBGcC5hZGQoWDEsIFkxKTtcbiAgICAgICAgICAgIGxldCB0NCA9IEZwLmFkZChYMiwgWTIpOyAvLyBzdGVwIDVcbiAgICAgICAgICAgIHQzID0gRnAubXVsKHQzLCB0NCk7XG4gICAgICAgICAgICB0NCA9IEZwLmFkZCh0MCwgdDEpO1xuICAgICAgICAgICAgdDMgPSBGcC5zdWIodDMsIHQ0KTtcbiAgICAgICAgICAgIHQ0ID0gRnAuYWRkKFgxLCBaMSk7XG4gICAgICAgICAgICBsZXQgdDUgPSBGcC5hZGQoWDIsIFoyKTsgLy8gc3RlcCAxMFxuICAgICAgICAgICAgdDQgPSBGcC5tdWwodDQsIHQ1KTtcbiAgICAgICAgICAgIHQ1ID0gRnAuYWRkKHQwLCB0Mik7XG4gICAgICAgICAgICB0NCA9IEZwLnN1Yih0NCwgdDUpO1xuICAgICAgICAgICAgdDUgPSBGcC5hZGQoWTEsIFoxKTtcbiAgICAgICAgICAgIFgzID0gRnAuYWRkKFkyLCBaMik7IC8vIHN0ZXAgMTVcbiAgICAgICAgICAgIHQ1ID0gRnAubXVsKHQ1LCBYMyk7XG4gICAgICAgICAgICBYMyA9IEZwLmFkZCh0MSwgdDIpO1xuICAgICAgICAgICAgdDUgPSBGcC5zdWIodDUsIFgzKTtcbiAgICAgICAgICAgIFozID0gRnAubXVsKGEsIHQ0KTtcbiAgICAgICAgICAgIFgzID0gRnAubXVsKGIzLCB0Mik7IC8vIHN0ZXAgMjBcbiAgICAgICAgICAgIFozID0gRnAuYWRkKFgzLCBaMyk7XG4gICAgICAgICAgICBYMyA9IEZwLnN1Yih0MSwgWjMpO1xuICAgICAgICAgICAgWjMgPSBGcC5hZGQodDEsIFozKTtcbiAgICAgICAgICAgIFkzID0gRnAubXVsKFgzLCBaMyk7XG4gICAgICAgICAgICB0MSA9IEZwLmFkZCh0MCwgdDApOyAvLyBzdGVwIDI1XG4gICAgICAgICAgICB0MSA9IEZwLmFkZCh0MSwgdDApO1xuICAgICAgICAgICAgdDIgPSBGcC5tdWwoYSwgdDIpO1xuICAgICAgICAgICAgdDQgPSBGcC5tdWwoYjMsIHQ0KTtcbiAgICAgICAgICAgIHQxID0gRnAuYWRkKHQxLCB0Mik7XG4gICAgICAgICAgICB0MiA9IEZwLnN1Yih0MCwgdDIpOyAvLyBzdGVwIDMwXG4gICAgICAgICAgICB0MiA9IEZwLm11bChhLCB0Mik7XG4gICAgICAgICAgICB0NCA9IEZwLmFkZCh0NCwgdDIpO1xuICAgICAgICAgICAgdDAgPSBGcC5tdWwodDEsIHQ0KTtcbiAgICAgICAgICAgIFkzID0gRnAuYWRkKFkzLCB0MCk7XG4gICAgICAgICAgICB0MCA9IEZwLm11bCh0NSwgdDQpOyAvLyBzdGVwIDM1XG4gICAgICAgICAgICBYMyA9IEZwLm11bCh0MywgWDMpO1xuICAgICAgICAgICAgWDMgPSBGcC5zdWIoWDMsIHQwKTtcbiAgICAgICAgICAgIHQwID0gRnAubXVsKHQzLCB0MSk7XG4gICAgICAgICAgICBaMyA9IEZwLm11bCh0NSwgWjMpO1xuICAgICAgICAgICAgWjMgPSBGcC5hZGQoWjMsIHQwKTsgLy8gc3RlcCA0MFxuICAgICAgICAgICAgcmV0dXJuIG5ldyBQb2ludChYMywgWTMsIFozKTtcbiAgICAgICAgfVxuICAgICAgICBzdWJ0cmFjdChvdGhlcikge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuYWRkKG90aGVyLm5lZ2F0ZSgpKTtcbiAgICAgICAgfVxuICAgICAgICBpczAoKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5lcXVhbHMoUG9pbnQuWkVSTyk7XG4gICAgICAgIH1cbiAgICAgICAgLyoqXG4gICAgICAgICAqIENvbnN0YW50IHRpbWUgbXVsdGlwbGljYXRpb24uXG4gICAgICAgICAqIFVzZXMgd05BRiBtZXRob2QuIFdpbmRvd2VkIG1ldGhvZCBtYXkgYmUgMTAlIGZhc3RlcixcbiAgICAgICAgICogYnV0IHRha2VzIDJ4IGxvbmdlciB0byBnZW5lcmF0ZSBhbmQgY29uc3VtZXMgMnggbWVtb3J5LlxuICAgICAgICAgKiBVc2VzIHByZWNvbXB1dGVzIHdoZW4gYXZhaWxhYmxlLlxuICAgICAgICAgKiBVc2VzIGVuZG9tb3JwaGlzbSBmb3IgS29ibGl0eiBjdXJ2ZXMuXG4gICAgICAgICAqIEBwYXJhbSBzY2FsYXIgYnkgd2hpY2ggdGhlIHBvaW50IHdvdWxkIGJlIG11bHRpcGxpZWRcbiAgICAgICAgICogQHJldHVybnMgTmV3IHBvaW50XG4gICAgICAgICAqL1xuICAgICAgICBtdWx0aXBseShzY2FsYXIpIHtcbiAgICAgICAgICAgIGNvbnN0IHsgZW5kbyB9ID0gZXh0cmFPcHRzO1xuICAgICAgICAgICAgaWYgKCFGbi5pc1ZhbGlkTm90MChzY2FsYXIpKVxuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignaW52YWxpZCBzY2FsYXI6IG91dCBvZiByYW5nZScpOyAvLyAwIGlzIGludmFsaWRcbiAgICAgICAgICAgIGxldCBwb2ludCwgZmFrZTsgLy8gRmFrZSBwb2ludCBpcyB1c2VkIHRvIGNvbnN0LXRpbWUgbXVsdFxuICAgICAgICAgICAgY29uc3QgbXVsID0gKG4pID0+IHduYWYuY2FjaGVkKHRoaXMsIG4sIChwKSA9PiBub3JtYWxpemVaKFBvaW50LCBwKSk7XG4gICAgICAgICAgICAvKiogU2VlIGRvY3MgZm9yIHtAbGluayBFbmRvbW9ycGhpc21PcHRzfSAqL1xuICAgICAgICAgICAgaWYgKGVuZG8pIHtcbiAgICAgICAgICAgICAgICBjb25zdCB7IGsxbmVnLCBrMSwgazJuZWcsIGsyIH0gPSBzcGxpdEVuZG9TY2FsYXJOKHNjYWxhcik7XG4gICAgICAgICAgICAgICAgY29uc3QgeyBwOiBrMXAsIGY6IGsxZiB9ID0gbXVsKGsxKTtcbiAgICAgICAgICAgICAgICBjb25zdCB7IHA6IGsycCwgZjogazJmIH0gPSBtdWwoazIpO1xuICAgICAgICAgICAgICAgIGZha2UgPSBrMWYuYWRkKGsyZik7XG4gICAgICAgICAgICAgICAgcG9pbnQgPSBmaW5pc2hFbmRvKGVuZG8uYmV0YSwgazFwLCBrMnAsIGsxbmVnLCBrMm5lZyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICBjb25zdCB7IHAsIGYgfSA9IG11bChzY2FsYXIpO1xuICAgICAgICAgICAgICAgIHBvaW50ID0gcDtcbiAgICAgICAgICAgICAgICBmYWtlID0gZjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIE5vcm1hbGl6ZSBgemAgZm9yIGJvdGggcG9pbnRzLCBidXQgcmV0dXJuIG9ubHkgcmVhbCBvbmVcbiAgICAgICAgICAgIHJldHVybiBub3JtYWxpemVaKFBvaW50LCBbcG9pbnQsIGZha2VdKVswXTtcbiAgICAgICAgfVxuICAgICAgICAvKipcbiAgICAgICAgICogTm9uLWNvbnN0YW50LXRpbWUgbXVsdGlwbGljYXRpb24uIFVzZXMgZG91YmxlLWFuZC1hZGQgYWxnb3JpdGhtLlxuICAgICAgICAgKiBJdCdzIGZhc3RlciwgYnV0IHNob3VsZCBvbmx5IGJlIHVzZWQgd2hlbiB5b3UgZG9uJ3QgY2FyZSBhYm91dFxuICAgICAgICAgKiBhbiBleHBvc2VkIHNlY3JldCBrZXkgZS5nLiBzaWcgdmVyaWZpY2F0aW9uLCB3aGljaCB3b3JrcyBvdmVyICpwdWJsaWMqIGtleXMuXG4gICAgICAgICAqL1xuICAgICAgICBtdWx0aXBseVVuc2FmZShzYykge1xuICAgICAgICAgICAgY29uc3QgeyBlbmRvIH0gPSBleHRyYU9wdHM7XG4gICAgICAgICAgICBjb25zdCBwID0gdGhpcztcbiAgICAgICAgICAgIGlmICghRm4uaXNWYWxpZChzYykpXG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdpbnZhbGlkIHNjYWxhcjogb3V0IG9mIHJhbmdlJyk7IC8vIDAgaXMgdmFsaWRcbiAgICAgICAgICAgIGlmIChzYyA9PT0gXzBuIHx8IHAuaXMwKCkpXG4gICAgICAgICAgICAgICAgcmV0dXJuIFBvaW50LlpFUk87XG4gICAgICAgICAgICBpZiAoc2MgPT09IF8xbilcbiAgICAgICAgICAgICAgICByZXR1cm4gcDsgLy8gZmFzdC1wYXRoXG4gICAgICAgICAgICBpZiAod25hZi5oYXNDYWNoZSh0aGlzKSlcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5tdWx0aXBseShzYyk7XG4gICAgICAgICAgICBpZiAoZW5kbykge1xuICAgICAgICAgICAgICAgIGNvbnN0IHsgazFuZWcsIGsxLCBrMm5lZywgazIgfSA9IHNwbGl0RW5kb1NjYWxhck4oc2MpO1xuICAgICAgICAgICAgICAgIGNvbnN0IHsgcDEsIHAyIH0gPSBtdWxFbmRvVW5zYWZlKFBvaW50LCBwLCBrMSwgazIpOyAvLyAzMCUgZmFzdGVyIHZzIHduYWYudW5zYWZlXG4gICAgICAgICAgICAgICAgcmV0dXJuIGZpbmlzaEVuZG8oZW5kby5iZXRhLCBwMSwgcDIsIGsxbmVnLCBrMm5lZyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gd25hZi51bnNhZmUocCwgc2MpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIG11bHRpcGx5QW5kQWRkVW5zYWZlKFEsIGEsIGIpIHtcbiAgICAgICAgICAgIGNvbnN0IHN1bSA9IHRoaXMubXVsdGlwbHlVbnNhZmUoYSkuYWRkKFEubXVsdGlwbHlVbnNhZmUoYikpO1xuICAgICAgICAgICAgcmV0dXJuIHN1bS5pczAoKSA/IHVuZGVmaW5lZCA6IHN1bTtcbiAgICAgICAgfVxuICAgICAgICAvKipcbiAgICAgICAgICogQ29udmVydHMgUHJvamVjdGl2ZSBwb2ludCB0byBhZmZpbmUgKHgsIHkpIGNvb3JkaW5hdGVzLlxuICAgICAgICAgKiBAcGFyYW0gaW52ZXJ0ZWRaIFpeLTEgKGludmVydGVkIHplcm8pIC0gb3B0aW9uYWwsIHByZWNvbXB1dGF0aW9uIGlzIHVzZWZ1bCBmb3IgaW52ZXJ0QmF0Y2hcbiAgICAgICAgICovXG4gICAgICAgIHRvQWZmaW5lKGludmVydGVkWikge1xuICAgICAgICAgICAgcmV0dXJuIHRvQWZmaW5lTWVtbyh0aGlzLCBpbnZlcnRlZFopO1xuICAgICAgICB9XG4gICAgICAgIC8qKlxuICAgICAgICAgKiBDaGVja3Mgd2hldGhlciBQb2ludCBpcyBmcmVlIG9mIHRvcnNpb24gZWxlbWVudHMgKGlzIGluIHByaW1lIHN1Ymdyb3VwKS5cbiAgICAgICAgICogQWx3YXlzIHRvcnNpb24tZnJlZSBmb3IgY29mYWN0b3I9MSBjdXJ2ZXMuXG4gICAgICAgICAqL1xuICAgICAgICBpc1RvcnNpb25GcmVlKCkge1xuICAgICAgICAgICAgY29uc3QgeyBpc1RvcnNpb25GcmVlIH0gPSBleHRyYU9wdHM7XG4gICAgICAgICAgICBpZiAoY29mYWN0b3IgPT09IF8xbilcbiAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgIGlmIChpc1RvcnNpb25GcmVlKVxuICAgICAgICAgICAgICAgIHJldHVybiBpc1RvcnNpb25GcmVlKFBvaW50LCB0aGlzKTtcbiAgICAgICAgICAgIHJldHVybiB3bmFmLnVuc2FmZSh0aGlzLCBDVVJWRV9PUkRFUikuaXMwKCk7XG4gICAgICAgIH1cbiAgICAgICAgY2xlYXJDb2ZhY3RvcigpIHtcbiAgICAgICAgICAgIGNvbnN0IHsgY2xlYXJDb2ZhY3RvciB9ID0gZXh0cmFPcHRzO1xuICAgICAgICAgICAgaWYgKGNvZmFjdG9yID09PSBfMW4pXG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXM7IC8vIEZhc3QtcGF0aFxuICAgICAgICAgICAgaWYgKGNsZWFyQ29mYWN0b3IpXG4gICAgICAgICAgICAgICAgcmV0dXJuIGNsZWFyQ29mYWN0b3IoUG9pbnQsIHRoaXMpO1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMubXVsdGlwbHlVbnNhZmUoY29mYWN0b3IpO1xuICAgICAgICB9XG4gICAgICAgIGlzU21hbGxPcmRlcigpIHtcbiAgICAgICAgICAgIC8vIGNhbiB3ZSB1c2UgdGhpcy5jbGVhckNvZmFjdG9yKCk/XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5tdWx0aXBseVVuc2FmZShjb2ZhY3RvcikuaXMwKCk7XG4gICAgICAgIH1cbiAgICAgICAgdG9CeXRlcyhpc0NvbXByZXNzZWQgPSB0cnVlKSB7XG4gICAgICAgICAgICBhYm9vbChpc0NvbXByZXNzZWQsICdpc0NvbXByZXNzZWQnKTtcbiAgICAgICAgICAgIHRoaXMuYXNzZXJ0VmFsaWRpdHkoKTtcbiAgICAgICAgICAgIHJldHVybiBlbmNvZGVQb2ludChQb2ludCwgdGhpcywgaXNDb21wcmVzc2VkKTtcbiAgICAgICAgfVxuICAgICAgICB0b0hleChpc0NvbXByZXNzZWQgPSB0cnVlKSB7XG4gICAgICAgICAgICByZXR1cm4gYnl0ZXNUb0hleCh0aGlzLnRvQnl0ZXMoaXNDb21wcmVzc2VkKSk7XG4gICAgICAgIH1cbiAgICAgICAgdG9TdHJpbmcoKSB7XG4gICAgICAgICAgICByZXR1cm4gYDxQb2ludCAke3RoaXMuaXMwKCkgPyAnWkVSTycgOiB0aGlzLnRvSGV4KCl9PmA7XG4gICAgICAgIH1cbiAgICAgICAgLy8gVE9ETzogcmVtb3ZlXG4gICAgICAgIGdldCBweCgpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLlg7XG4gICAgICAgIH1cbiAgICAgICAgZ2V0IHB5KCkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuWDtcbiAgICAgICAgfVxuICAgICAgICBnZXQgcHooKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5aO1xuICAgICAgICB9XG4gICAgICAgIHRvUmF3Qnl0ZXMoaXNDb21wcmVzc2VkID0gdHJ1ZSkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMudG9CeXRlcyhpc0NvbXByZXNzZWQpO1xuICAgICAgICB9XG4gICAgICAgIF9zZXRXaW5kb3dTaXplKHdpbmRvd1NpemUpIHtcbiAgICAgICAgICAgIHRoaXMucHJlY29tcHV0ZSh3aW5kb3dTaXplKTtcbiAgICAgICAgfVxuICAgICAgICBzdGF0aWMgbm9ybWFsaXplWihwb2ludHMpIHtcbiAgICAgICAgICAgIHJldHVybiBub3JtYWxpemVaKFBvaW50LCBwb2ludHMpO1xuICAgICAgICB9XG4gICAgICAgIHN0YXRpYyBtc20ocG9pbnRzLCBzY2FsYXJzKSB7XG4gICAgICAgICAgICByZXR1cm4gcGlwcGVuZ2VyKFBvaW50LCBGbiwgcG9pbnRzLCBzY2FsYXJzKTtcbiAgICAgICAgfVxuICAgICAgICBzdGF0aWMgZnJvbVByaXZhdGVLZXkocHJpdmF0ZUtleSkge1xuICAgICAgICAgICAgcmV0dXJuIFBvaW50LkJBU0UubXVsdGlwbHkoX25vcm1GbkVsZW1lbnQoRm4sIHByaXZhdGVLZXkpKTtcbiAgICAgICAgfVxuICAgIH1cbiAgICAvLyBiYXNlIC8gZ2VuZXJhdG9yIHBvaW50XG4gICAgUG9pbnQuQkFTRSA9IG5ldyBQb2ludChDVVJWRS5HeCwgQ1VSVkUuR3ksIEZwLk9ORSk7XG4gICAgLy8gemVybyAvIGluZmluaXR5IC8gaWRlbnRpdHkgcG9pbnRcbiAgICBQb2ludC5aRVJPID0gbmV3IFBvaW50KEZwLlpFUk8sIEZwLk9ORSwgRnAuWkVSTyk7IC8vIDAsIDEsIDBcbiAgICAvLyBtYXRoIGZpZWxkXG4gICAgUG9pbnQuRnAgPSBGcDtcbiAgICAvLyBzY2FsYXIgZmllbGRcbiAgICBQb2ludC5GbiA9IEZuO1xuICAgIGNvbnN0IGJpdHMgPSBGbi5CSVRTO1xuICAgIGNvbnN0IHduYWYgPSBuZXcgd05BRihQb2ludCwgZXh0cmFPcHRzLmVuZG8gPyBNYXRoLmNlaWwoYml0cyAvIDIpIDogYml0cyk7XG4gICAgUG9pbnQuQkFTRS5wcmVjb21wdXRlKDgpOyAvLyBFbmFibGUgcHJlY29tcHV0ZXMuIFNsb3dzIGRvd24gZmlyc3QgcHVibGljS2V5IGNvbXB1dGF0aW9uIGJ5IDIwbXMuXG4gICAgcmV0dXJuIFBvaW50O1xufVxuLy8gUG9pbnRzIHN0YXJ0IHdpdGggYnl0ZSAweDAyIHdoZW4geSBpcyBldmVuOyBvdGhlcndpc2UgMHgwM1xuZnVuY3Rpb24gcHByZWZpeChoYXNFdmVuWSkge1xuICAgIHJldHVybiBVaW50OEFycmF5Lm9mKGhhc0V2ZW5ZID8gMHgwMiA6IDB4MDMpO1xufVxuLyoqXG4gKiBJbXBsZW1lbnRhdGlvbiBvZiB0aGUgU2hhbGx1ZSBhbmQgdmFuIGRlIFdvZXN0aWpuZSBtZXRob2QgZm9yIGFueSB3ZWllcnN0cmFzcyBjdXJ2ZS5cbiAqIFRPRE86IGNoZWNrIGlmIHRoZXJlIGlzIGEgd2F5IHRvIG1lcmdlIHRoaXMgd2l0aCB1dlJhdGlvIGluIEVkd2FyZHM7IG1vdmUgdG8gbW9kdWxhci5cbiAqIGIgPSBUcnVlIGFuZCB5ID0gc3FydCh1IC8gdikgaWYgKHUgLyB2KSBpcyBzcXVhcmUgaW4gRiwgYW5kXG4gKiBiID0gRmFsc2UgYW5kIHkgPSBzcXJ0KFogKiAodSAvIHYpKSBvdGhlcndpc2UuXG4gKiBAcGFyYW0gRnBcbiAqIEBwYXJhbSBaXG4gKiBAcmV0dXJuc1xuICovXG5leHBvcnQgZnVuY3Rpb24gU1dVRnBTcXJ0UmF0aW8oRnAsIFopIHtcbiAgICAvLyBHZW5lcmljIGltcGxlbWVudGF0aW9uXG4gICAgY29uc3QgcSA9IEZwLk9SREVSO1xuICAgIGxldCBsID0gXzBuO1xuICAgIGZvciAobGV0IG8gPSBxIC0gXzFuOyBvICUgXzJuID09PSBfMG47IG8gLz0gXzJuKVxuICAgICAgICBsICs9IF8xbjtcbiAgICBjb25zdCBjMSA9IGw7IC8vIDEuIGMxLCB0aGUgbGFyZ2VzdCBpbnRlZ2VyIHN1Y2ggdGhhdCAyXmMxIGRpdmlkZXMgcSAtIDEuXG4gICAgLy8gV2UgbmVlZCAybiAqKiBjMSBhbmQgMm4gKiogKGMxLTEpLiBXZSBjYW4ndCB1c2UgKio7IGJ1dCB3ZSBjYW4gdXNlIDw8LlxuICAgIC8vIDJuICoqIGMxID09IDJuIDw8IChjMS0xKVxuICAgIGNvbnN0IF8ybl9wb3dfYzFfMSA9IF8ybiA8PCAoYzEgLSBfMW4gLSBfMW4pO1xuICAgIGNvbnN0IF8ybl9wb3dfYzEgPSBfMm5fcG93X2MxXzEgKiBfMm47XG4gICAgY29uc3QgYzIgPSAocSAtIF8xbikgLyBfMm5fcG93X2MxOyAvLyAyLiBjMiA9IChxIC0gMSkgLyAoMl5jMSkgICMgSW50ZWdlciBhcml0aG1ldGljXG4gICAgY29uc3QgYzMgPSAoYzIgLSBfMW4pIC8gXzJuOyAvLyAzLiBjMyA9IChjMiAtIDEpIC8gMiAgICAgICAgICAgICMgSW50ZWdlciBhcml0aG1ldGljXG4gICAgY29uc3QgYzQgPSBfMm5fcG93X2MxIC0gXzFuOyAvLyA0LiBjNCA9IDJeYzEgLSAxICAgICAgICAgICAgICAgICMgSW50ZWdlciBhcml0aG1ldGljXG4gICAgY29uc3QgYzUgPSBfMm5fcG93X2MxXzE7IC8vIDUuIGM1ID0gMl4oYzEgLSAxKSAgICAgICAgICAgICAgICAgICMgSW50ZWdlciBhcml0aG1ldGljXG4gICAgY29uc3QgYzYgPSBGcC5wb3coWiwgYzIpOyAvLyA2LiBjNiA9IFpeYzJcbiAgICBjb25zdCBjNyA9IEZwLnBvdyhaLCAoYzIgKyBfMW4pIC8gXzJuKTsgLy8gNy4gYzcgPSBaXigoYzIgKyAxKSAvIDIpXG4gICAgbGV0IHNxcnRSYXRpbyA9ICh1LCB2KSA9PiB7XG4gICAgICAgIGxldCB0djEgPSBjNjsgLy8gMS4gdHYxID0gYzZcbiAgICAgICAgbGV0IHR2MiA9IEZwLnBvdyh2LCBjNCk7IC8vIDIuIHR2MiA9IHZeYzRcbiAgICAgICAgbGV0IHR2MyA9IEZwLnNxcih0djIpOyAvLyAzLiB0djMgPSB0djJeMlxuICAgICAgICB0djMgPSBGcC5tdWwodHYzLCB2KTsgLy8gNC4gdHYzID0gdHYzICogdlxuICAgICAgICBsZXQgdHY1ID0gRnAubXVsKHUsIHR2Myk7IC8vIDUuIHR2NSA9IHUgKiB0djNcbiAgICAgICAgdHY1ID0gRnAucG93KHR2NSwgYzMpOyAvLyA2LiB0djUgPSB0djVeYzNcbiAgICAgICAgdHY1ID0gRnAubXVsKHR2NSwgdHYyKTsgLy8gNy4gdHY1ID0gdHY1ICogdHYyXG4gICAgICAgIHR2MiA9IEZwLm11bCh0djUsIHYpOyAvLyA4LiB0djIgPSB0djUgKiB2XG4gICAgICAgIHR2MyA9IEZwLm11bCh0djUsIHUpOyAvLyA5LiB0djMgPSB0djUgKiB1XG4gICAgICAgIGxldCB0djQgPSBGcC5tdWwodHYzLCB0djIpOyAvLyAxMC4gdHY0ID0gdHYzICogdHYyXG4gICAgICAgIHR2NSA9IEZwLnBvdyh0djQsIGM1KTsgLy8gMTEuIHR2NSA9IHR2NF5jNVxuICAgICAgICBsZXQgaXNRUiA9IEZwLmVxbCh0djUsIEZwLk9ORSk7IC8vIDEyLiBpc1FSID0gdHY1ID09IDFcbiAgICAgICAgdHYyID0gRnAubXVsKHR2MywgYzcpOyAvLyAxMy4gdHYyID0gdHYzICogYzdcbiAgICAgICAgdHY1ID0gRnAubXVsKHR2NCwgdHYxKTsgLy8gMTQuIHR2NSA9IHR2NCAqIHR2MVxuICAgICAgICB0djMgPSBGcC5jbW92KHR2MiwgdHYzLCBpc1FSKTsgLy8gMTUuIHR2MyA9IENNT1YodHYyLCB0djMsIGlzUVIpXG4gICAgICAgIHR2NCA9IEZwLmNtb3YodHY1LCB0djQsIGlzUVIpOyAvLyAxNi4gdHY0ID0gQ01PVih0djUsIHR2NCwgaXNRUilcbiAgICAgICAgLy8gMTcuIGZvciBpIGluIChjMSwgYzEgLSAxLCAuLi4sIDIpOlxuICAgICAgICBmb3IgKGxldCBpID0gYzE7IGkgPiBfMW47IGktLSkge1xuICAgICAgICAgICAgbGV0IHR2NSA9IGkgLSBfMm47IC8vIDE4LiAgICB0djUgPSBpIC0gMlxuICAgICAgICAgICAgdHY1ID0gXzJuIDw8ICh0djUgLSBfMW4pOyAvLyAxOS4gICAgdHY1ID0gMl50djVcbiAgICAgICAgICAgIGxldCB0dnY1ID0gRnAucG93KHR2NCwgdHY1KTsgLy8gMjAuICAgIHR2NSA9IHR2NF50djVcbiAgICAgICAgICAgIGNvbnN0IGUxID0gRnAuZXFsKHR2djUsIEZwLk9ORSk7IC8vIDIxLiAgICBlMSA9IHR2NSA9PSAxXG4gICAgICAgICAgICB0djIgPSBGcC5tdWwodHYzLCB0djEpOyAvLyAyMi4gICAgdHYyID0gdHYzICogdHYxXG4gICAgICAgICAgICB0djEgPSBGcC5tdWwodHYxLCB0djEpOyAvLyAyMy4gICAgdHYxID0gdHYxICogdHYxXG4gICAgICAgICAgICB0dnY1ID0gRnAubXVsKHR2NCwgdHYxKTsgLy8gMjQuICAgIHR2NSA9IHR2NCAqIHR2MVxuICAgICAgICAgICAgdHYzID0gRnAuY21vdih0djIsIHR2MywgZTEpOyAvLyAyNS4gICAgdHYzID0gQ01PVih0djIsIHR2MywgZTEpXG4gICAgICAgICAgICB0djQgPSBGcC5jbW92KHR2djUsIHR2NCwgZTEpOyAvLyAyNi4gICAgdHY0ID0gQ01PVih0djUsIHR2NCwgZTEpXG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHsgaXNWYWxpZDogaXNRUiwgdmFsdWU6IHR2MyB9O1xuICAgIH07XG4gICAgaWYgKEZwLk9SREVSICUgXzRuID09PSBfM24pIHtcbiAgICAgICAgLy8gc3FydF9yYXRpb18zbW9kNCh1LCB2KVxuICAgICAgICBjb25zdCBjMSA9IChGcC5PUkRFUiAtIF8zbikgLyBfNG47IC8vIDEuIGMxID0gKHEgLSAzKSAvIDQgICAgICMgSW50ZWdlciBhcml0aG1ldGljXG4gICAgICAgIGNvbnN0IGMyID0gRnAuc3FydChGcC5uZWcoWikpOyAvLyAyLiBjMiA9IHNxcnQoLVopXG4gICAgICAgIHNxcnRSYXRpbyA9ICh1LCB2KSA9PiB7XG4gICAgICAgICAgICBsZXQgdHYxID0gRnAuc3FyKHYpOyAvLyAxLiB0djEgPSB2XjJcbiAgICAgICAgICAgIGNvbnN0IHR2MiA9IEZwLm11bCh1LCB2KTsgLy8gMi4gdHYyID0gdSAqIHZcbiAgICAgICAgICAgIHR2MSA9IEZwLm11bCh0djEsIHR2Mik7IC8vIDMuIHR2MSA9IHR2MSAqIHR2MlxuICAgICAgICAgICAgbGV0IHkxID0gRnAucG93KHR2MSwgYzEpOyAvLyA0LiB5MSA9IHR2MV5jMVxuICAgICAgICAgICAgeTEgPSBGcC5tdWwoeTEsIHR2Mik7IC8vIDUuIHkxID0geTEgKiB0djJcbiAgICAgICAgICAgIGNvbnN0IHkyID0gRnAubXVsKHkxLCBjMik7IC8vIDYuIHkyID0geTEgKiBjMlxuICAgICAgICAgICAgY29uc3QgdHYzID0gRnAubXVsKEZwLnNxcih5MSksIHYpOyAvLyA3LiB0djMgPSB5MV4yOyA4LiB0djMgPSB0djMgKiB2XG4gICAgICAgICAgICBjb25zdCBpc1FSID0gRnAuZXFsKHR2MywgdSk7IC8vIDkuIGlzUVIgPSB0djMgPT0gdVxuICAgICAgICAgICAgbGV0IHkgPSBGcC5jbW92KHkyLCB5MSwgaXNRUik7IC8vIDEwLiB5ID0gQ01PVih5MiwgeTEsIGlzUVIpXG4gICAgICAgICAgICByZXR1cm4geyBpc1ZhbGlkOiBpc1FSLCB2YWx1ZTogeSB9OyAvLyAxMS4gcmV0dXJuIChpc1FSLCB5KSBpc1FSID8geSA6IHkqYzJcbiAgICAgICAgfTtcbiAgICB9XG4gICAgLy8gTm8gY3VydmVzIHVzZXMgdGhhdFxuICAgIC8vIGlmIChGcC5PUkRFUiAlIF84biA9PT0gXzVuKSAvLyBzcXJ0X3JhdGlvXzVtb2Q4XG4gICAgcmV0dXJuIHNxcnRSYXRpbztcbn1cbi8qKlxuICogU2ltcGxpZmllZCBTaGFsbHVlLXZhbiBkZSBXb2VzdGlqbmUtVWxhcyBNZXRob2RcbiAqIGh0dHBzOi8vd3d3LnJmYy1lZGl0b3Iub3JnL3JmYy9yZmM5MzgwI3NlY3Rpb24tNi42LjJcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIG1hcFRvQ3VydmVTaW1wbGVTV1UoRnAsIG9wdHMpIHtcbiAgICB2YWxpZGF0ZUZpZWxkKEZwKTtcbiAgICBjb25zdCB7IEEsIEIsIFogfSA9IG9wdHM7XG4gICAgaWYgKCFGcC5pc1ZhbGlkKEEpIHx8ICFGcC5pc1ZhbGlkKEIpIHx8ICFGcC5pc1ZhbGlkKFopKVxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ21hcFRvQ3VydmVTaW1wbGVTV1U6IGludmFsaWQgb3B0cycpO1xuICAgIGNvbnN0IHNxcnRSYXRpbyA9IFNXVUZwU3FydFJhdGlvKEZwLCBaKTtcbiAgICBpZiAoIUZwLmlzT2RkKVxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ZpZWxkIGRvZXMgbm90IGhhdmUgLmlzT2RkKCknKTtcbiAgICAvLyBJbnB1dDogdSwgYW4gZWxlbWVudCBvZiBGLlxuICAgIC8vIE91dHB1dDogKHgsIHkpLCBhIHBvaW50IG9uIEUuXG4gICAgcmV0dXJuICh1KSA9PiB7XG4gICAgICAgIC8vIHByZXR0aWVyLWlnbm9yZVxuICAgICAgICBsZXQgdHYxLCB0djIsIHR2MywgdHY0LCB0djUsIHR2NiwgeCwgeTtcbiAgICAgICAgdHYxID0gRnAuc3FyKHUpOyAvLyAxLiAgdHYxID0gdV4yXG4gICAgICAgIHR2MSA9IEZwLm11bCh0djEsIFopOyAvLyAyLiAgdHYxID0gWiAqIHR2MVxuICAgICAgICB0djIgPSBGcC5zcXIodHYxKTsgLy8gMy4gIHR2MiA9IHR2MV4yXG4gICAgICAgIHR2MiA9IEZwLmFkZCh0djIsIHR2MSk7IC8vIDQuICB0djIgPSB0djIgKyB0djFcbiAgICAgICAgdHYzID0gRnAuYWRkKHR2MiwgRnAuT05FKTsgLy8gNS4gIHR2MyA9IHR2MiArIDFcbiAgICAgICAgdHYzID0gRnAubXVsKHR2MywgQik7IC8vIDYuICB0djMgPSBCICogdHYzXG4gICAgICAgIHR2NCA9IEZwLmNtb3YoWiwgRnAubmVnKHR2MiksICFGcC5lcWwodHYyLCBGcC5aRVJPKSk7IC8vIDcuICB0djQgPSBDTU9WKFosIC10djIsIHR2MiAhPSAwKVxuICAgICAgICB0djQgPSBGcC5tdWwodHY0LCBBKTsgLy8gOC4gIHR2NCA9IEEgKiB0djRcbiAgICAgICAgdHYyID0gRnAuc3FyKHR2Myk7IC8vIDkuICB0djIgPSB0djNeMlxuICAgICAgICB0djYgPSBGcC5zcXIodHY0KTsgLy8gMTAuIHR2NiA9IHR2NF4yXG4gICAgICAgIHR2NSA9IEZwLm11bCh0djYsIEEpOyAvLyAxMS4gdHY1ID0gQSAqIHR2NlxuICAgICAgICB0djIgPSBGcC5hZGQodHYyLCB0djUpOyAvLyAxMi4gdHYyID0gdHYyICsgdHY1XG4gICAgICAgIHR2MiA9IEZwLm11bCh0djIsIHR2Myk7IC8vIDEzLiB0djIgPSB0djIgKiB0djNcbiAgICAgICAgdHY2ID0gRnAubXVsKHR2NiwgdHY0KTsgLy8gMTQuIHR2NiA9IHR2NiAqIHR2NFxuICAgICAgICB0djUgPSBGcC5tdWwodHY2LCBCKTsgLy8gMTUuIHR2NSA9IEIgKiB0djZcbiAgICAgICAgdHYyID0gRnAuYWRkKHR2MiwgdHY1KTsgLy8gMTYuIHR2MiA9IHR2MiArIHR2NVxuICAgICAgICB4ID0gRnAubXVsKHR2MSwgdHYzKTsgLy8gMTcuICAgeCA9IHR2MSAqIHR2M1xuICAgICAgICBjb25zdCB7IGlzVmFsaWQsIHZhbHVlIH0gPSBzcXJ0UmF0aW8odHYyLCB0djYpOyAvLyAxOC4gKGlzX2d4MV9zcXVhcmUsIHkxKSA9IHNxcnRfcmF0aW8odHYyLCB0djYpXG4gICAgICAgIHkgPSBGcC5tdWwodHYxLCB1KTsgLy8gMTkuICAgeSA9IHR2MSAqIHUgIC0+IFogKiB1XjMgKiB5MVxuICAgICAgICB5ID0gRnAubXVsKHksIHZhbHVlKTsgLy8gMjAuICAgeSA9IHkgKiB5MVxuICAgICAgICB4ID0gRnAuY21vdih4LCB0djMsIGlzVmFsaWQpOyAvLyAyMS4gICB4ID0gQ01PVih4LCB0djMsIGlzX2d4MV9zcXVhcmUpXG4gICAgICAgIHkgPSBGcC5jbW92KHksIHZhbHVlLCBpc1ZhbGlkKTsgLy8gMjIuICAgeSA9IENNT1YoeSwgeTEsIGlzX2d4MV9zcXVhcmUpXG4gICAgICAgIGNvbnN0IGUxID0gRnAuaXNPZGQodSkgPT09IEZwLmlzT2RkKHkpOyAvLyAyMy4gIGUxID0gc2duMCh1KSA9PSBzZ24wKHkpXG4gICAgICAgIHkgPSBGcC5jbW92KEZwLm5lZyh5KSwgeSwgZTEpOyAvLyAyNC4gICB5ID0gQ01PVigteSwgeSwgZTEpXG4gICAgICAgIGNvbnN0IHR2NF9pbnYgPSBGcEludmVydEJhdGNoKEZwLCBbdHY0XSwgdHJ1ZSlbMF07XG4gICAgICAgIHggPSBGcC5tdWwoeCwgdHY0X2ludik7IC8vIDI1LiAgIHggPSB4IC8gdHY0XG4gICAgICAgIHJldHVybiB7IHgsIHkgfTtcbiAgICB9O1xufVxuZnVuY3Rpb24gZ2V0V0xlbmd0aHMoRnAsIEZuKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgICAgc2VjcmV0S2V5OiBGbi5CWVRFUyxcbiAgICAgICAgcHVibGljS2V5OiAxICsgRnAuQllURVMsXG4gICAgICAgIHB1YmxpY0tleVVuY29tcHJlc3NlZDogMSArIDIgKiBGcC5CWVRFUyxcbiAgICAgICAgcHVibGljS2V5SGFzUHJlZml4OiB0cnVlLFxuICAgICAgICBzaWduYXR1cmU6IDIgKiBGbi5CWVRFUyxcbiAgICB9O1xufVxuLyoqXG4gKiBTb21ldGltZXMgdXNlcnMgb25seSBuZWVkIGdldFB1YmxpY0tleSwgZ2V0U2hhcmVkU2VjcmV0LCBhbmQgc2VjcmV0IGtleSBoYW5kbGluZy5cbiAqIFRoaXMgaGVscGVyIGVuc3VyZXMgbm8gc2lnbmF0dXJlIGZ1bmN0aW9uYWxpdHkgaXMgcHJlc2VudC4gTGVzcyBjb2RlLCBzbWFsbGVyIGJ1bmRsZSBzaXplLlxuICovXG5leHBvcnQgZnVuY3Rpb24gZWNkaChQb2ludCwgZWNkaE9wdHMgPSB7fSkge1xuICAgIGNvbnN0IHsgRm4gfSA9IFBvaW50O1xuICAgIGNvbnN0IHJhbmRvbUJ5dGVzXyA9IGVjZGhPcHRzLnJhbmRvbUJ5dGVzIHx8IHJhbmRvbUJ5dGVzV2ViO1xuICAgIGNvbnN0IGxlbmd0aHMgPSBPYmplY3QuYXNzaWduKGdldFdMZW5ndGhzKFBvaW50LkZwLCBGbiksIHsgc2VlZDogZ2V0TWluSGFzaExlbmd0aChGbi5PUkRFUikgfSk7XG4gICAgZnVuY3Rpb24gaXNWYWxpZFNlY3JldEtleShzZWNyZXRLZXkpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIHJldHVybiAhIV9ub3JtRm5FbGVtZW50KEZuLCBzZWNyZXRLZXkpO1xuICAgICAgICB9XG4gICAgICAgIGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgfVxuICAgIGZ1bmN0aW9uIGlzVmFsaWRQdWJsaWNLZXkocHVibGljS2V5LCBpc0NvbXByZXNzZWQpIHtcbiAgICAgICAgY29uc3QgeyBwdWJsaWNLZXk6IGNvbXAsIHB1YmxpY0tleVVuY29tcHJlc3NlZCB9ID0gbGVuZ3RocztcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IGwgPSBwdWJsaWNLZXkubGVuZ3RoO1xuICAgICAgICAgICAgaWYgKGlzQ29tcHJlc3NlZCA9PT0gdHJ1ZSAmJiBsICE9PSBjb21wKVxuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIGlmIChpc0NvbXByZXNzZWQgPT09IGZhbHNlICYmIGwgIT09IHB1YmxpY0tleVVuY29tcHJlc3NlZClcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICByZXR1cm4gISFQb2ludC5mcm9tQnl0ZXMocHVibGljS2V5KTtcbiAgICAgICAgfVxuICAgICAgICBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgIH1cbiAgICAvKipcbiAgICAgKiBQcm9kdWNlcyBjcnlwdG9ncmFwaGljYWxseSBzZWN1cmUgc2VjcmV0IGtleSBmcm9tIHJhbmRvbSBvZiBzaXplXG4gICAgICogKGdyb3VwTGVuICsgY2VpbChncm91cExlbiAvIDIpKSB3aXRoIG1vZHVsbyBiaWFzIGJlaW5nIG5lZ2xpZ2libGUuXG4gICAgICovXG4gICAgZnVuY3Rpb24gcmFuZG9tU2VjcmV0S2V5KHNlZWQgPSByYW5kb21CeXRlc18obGVuZ3Rocy5zZWVkKSkge1xuICAgICAgICByZXR1cm4gbWFwSGFzaFRvRmllbGQoYWJ5dGVzKHNlZWQsIGxlbmd0aHMuc2VlZCwgJ3NlZWQnKSwgRm4uT1JERVIpO1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBDb21wdXRlcyBwdWJsaWMga2V5IGZvciBhIHNlY3JldCBrZXkuIENoZWNrcyBmb3IgdmFsaWRpdHkgb2YgdGhlIHNlY3JldCBrZXkuXG4gICAgICogQHBhcmFtIGlzQ29tcHJlc3NlZCB3aGV0aGVyIHRvIHJldHVybiBjb21wYWN0IChkZWZhdWx0KSwgb3IgZnVsbCBrZXlcbiAgICAgKiBAcmV0dXJucyBQdWJsaWMga2V5LCBmdWxsIHdoZW4gaXNDb21wcmVzc2VkPWZhbHNlOyBzaG9ydCB3aGVuIGlzQ29tcHJlc3NlZD10cnVlXG4gICAgICovXG4gICAgZnVuY3Rpb24gZ2V0UHVibGljS2V5KHNlY3JldEtleSwgaXNDb21wcmVzc2VkID0gdHJ1ZSkge1xuICAgICAgICByZXR1cm4gUG9pbnQuQkFTRS5tdWx0aXBseShfbm9ybUZuRWxlbWVudChGbiwgc2VjcmV0S2V5KSkudG9CeXRlcyhpc0NvbXByZXNzZWQpO1xuICAgIH1cbiAgICBmdW5jdGlvbiBrZXlnZW4oc2VlZCkge1xuICAgICAgICBjb25zdCBzZWNyZXRLZXkgPSByYW5kb21TZWNyZXRLZXkoc2VlZCk7XG4gICAgICAgIHJldHVybiB7IHNlY3JldEtleSwgcHVibGljS2V5OiBnZXRQdWJsaWNLZXkoc2VjcmV0S2V5KSB9O1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBRdWljayBhbmQgZGlydHkgY2hlY2sgZm9yIGl0ZW0gYmVpbmcgcHVibGljIGtleS4gRG9lcyBub3QgdmFsaWRhdGUgaGV4LCBvciBiZWluZyBvbi1jdXJ2ZS5cbiAgICAgKi9cbiAgICBmdW5jdGlvbiBpc1Byb2JQdWIoaXRlbSkge1xuICAgICAgICBpZiAodHlwZW9mIGl0ZW0gPT09ICdiaWdpbnQnKVxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICBpZiAoaXRlbSBpbnN0YW5jZW9mIFBvaW50KVxuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIGNvbnN0IHsgc2VjcmV0S2V5LCBwdWJsaWNLZXksIHB1YmxpY0tleVVuY29tcHJlc3NlZCB9ID0gbGVuZ3RocztcbiAgICAgICAgaWYgKEZuLmFsbG93ZWRMZW5ndGhzIHx8IHNlY3JldEtleSA9PT0gcHVibGljS2V5KVxuICAgICAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICAgICAgY29uc3QgbCA9IGVuc3VyZUJ5dGVzKCdrZXknLCBpdGVtKS5sZW5ndGg7XG4gICAgICAgIHJldHVybiBsID09PSBwdWJsaWNLZXkgfHwgbCA9PT0gcHVibGljS2V5VW5jb21wcmVzc2VkO1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBFQ0RIIChFbGxpcHRpYyBDdXJ2ZSBEaWZmaWUgSGVsbG1hbikuXG4gICAgICogQ29tcHV0ZXMgc2hhcmVkIHB1YmxpYyBrZXkgZnJvbSBzZWNyZXQga2V5IEEgYW5kIHB1YmxpYyBrZXkgQi5cbiAgICAgKiBDaGVja3M6IDEpIHNlY3JldCBrZXkgdmFsaWRpdHkgMikgc2hhcmVkIGtleSBpcyBvbi1jdXJ2ZS5cbiAgICAgKiBEb2VzIE5PVCBoYXNoIHRoZSByZXN1bHQuXG4gICAgICogQHBhcmFtIGlzQ29tcHJlc3NlZCB3aGV0aGVyIHRvIHJldHVybiBjb21wYWN0IChkZWZhdWx0KSwgb3IgZnVsbCBrZXlcbiAgICAgKiBAcmV0dXJucyBzaGFyZWQgcHVibGljIGtleVxuICAgICAqL1xuICAgIGZ1bmN0aW9uIGdldFNoYXJlZFNlY3JldChzZWNyZXRLZXlBLCBwdWJsaWNLZXlCLCBpc0NvbXByZXNzZWQgPSB0cnVlKSB7XG4gICAgICAgIGlmIChpc1Byb2JQdWIoc2VjcmV0S2V5QSkgPT09IHRydWUpXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ2ZpcnN0IGFyZyBtdXN0IGJlIHByaXZhdGUga2V5Jyk7XG4gICAgICAgIGlmIChpc1Byb2JQdWIocHVibGljS2V5QikgPT09IGZhbHNlKVxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdzZWNvbmQgYXJnIG11c3QgYmUgcHVibGljIGtleScpO1xuICAgICAgICBjb25zdCBzID0gX25vcm1GbkVsZW1lbnQoRm4sIHNlY3JldEtleUEpO1xuICAgICAgICBjb25zdCBiID0gUG9pbnQuZnJvbUhleChwdWJsaWNLZXlCKTsgLy8gY2hlY2tzIGZvciBiZWluZyBvbi1jdXJ2ZVxuICAgICAgICByZXR1cm4gYi5tdWx0aXBseShzKS50b0J5dGVzKGlzQ29tcHJlc3NlZCk7XG4gICAgfVxuICAgIGNvbnN0IHV0aWxzID0ge1xuICAgICAgICBpc1ZhbGlkU2VjcmV0S2V5LFxuICAgICAgICBpc1ZhbGlkUHVibGljS2V5LFxuICAgICAgICByYW5kb21TZWNyZXRLZXksXG4gICAgICAgIC8vIFRPRE86IHJlbW92ZVxuICAgICAgICBpc1ZhbGlkUHJpdmF0ZUtleTogaXNWYWxpZFNlY3JldEtleSxcbiAgICAgICAgcmFuZG9tUHJpdmF0ZUtleTogcmFuZG9tU2VjcmV0S2V5LFxuICAgICAgICBub3JtUHJpdmF0ZUtleVRvU2NhbGFyOiAoa2V5KSA9PiBfbm9ybUZuRWxlbWVudChGbiwga2V5KSxcbiAgICAgICAgcHJlY29tcHV0ZSh3aW5kb3dTaXplID0gOCwgcG9pbnQgPSBQb2ludC5CQVNFKSB7XG4gICAgICAgICAgICByZXR1cm4gcG9pbnQucHJlY29tcHV0ZSh3aW5kb3dTaXplLCBmYWxzZSk7XG4gICAgICAgIH0sXG4gICAgfTtcbiAgICByZXR1cm4gT2JqZWN0LmZyZWV6ZSh7IGdldFB1YmxpY0tleSwgZ2V0U2hhcmVkU2VjcmV0LCBrZXlnZW4sIFBvaW50LCB1dGlscywgbGVuZ3RocyB9KTtcbn1cbi8qKlxuICogQ3JlYXRlcyBFQ0RTQSBzaWduaW5nIGludGVyZmFjZSBmb3IgZ2l2ZW4gZWxsaXB0aWMgY3VydmUgYFBvaW50YCBhbmQgYGhhc2hgIGZ1bmN0aW9uLlxuICogV2UgbmVlZCBgaGFzaGAgZm9yIDIgZmVhdHVyZXM6XG4gKiAxLiBNZXNzYWdlIHByZWhhc2gtaW5nLiBOT1QgdXNlZCBpZiBgc2lnbmAgLyBgdmVyaWZ5YCBhcmUgY2FsbGVkIHdpdGggYHByZWhhc2g6IGZhbHNlYFxuICogMi4gayBnZW5lcmF0aW9uIGluIGBzaWduYCwgdXNpbmcgSE1BQy1kcmJnKGhhc2gpXG4gKlxuICogRUNEU0FPcHRzIGFyZSBvbmx5IHJhcmVseSBuZWVkZWQuXG4gKlxuICogQGV4YW1wbGVcbiAqIGBgYGpzXG4gKiBjb25zdCBwMjU2X1BvaW50ID0gd2VpZXJzdHJhc3MoLi4uKTtcbiAqIGNvbnN0IHAyNTZfc2hhMjU2ID0gZWNkc2EocDI1Nl9Qb2ludCwgc2hhMjU2KTtcbiAqIGNvbnN0IHAyNTZfc2hhMjI0ID0gZWNkc2EocDI1Nl9Qb2ludCwgc2hhMjI0KTtcbiAqIGNvbnN0IHAyNTZfc2hhMjI0X3IgPSBlY2RzYShwMjU2X1BvaW50LCBzaGEyMjQsIHsgcmFuZG9tQnl0ZXM6IChsZW5ndGgpID0+IHsgLi4uIH0gfSk7XG4gKiBgYGBcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGVjZHNhKFBvaW50LCBoYXNoLCBlY2RzYU9wdHMgPSB7fSkge1xuICAgIGFoYXNoKGhhc2gpO1xuICAgIF92YWxpZGF0ZU9iamVjdChlY2RzYU9wdHMsIHt9LCB7XG4gICAgICAgIGhtYWM6ICdmdW5jdGlvbicsXG4gICAgICAgIGxvd1M6ICdib29sZWFuJyxcbiAgICAgICAgcmFuZG9tQnl0ZXM6ICdmdW5jdGlvbicsXG4gICAgICAgIGJpdHMyaW50OiAnZnVuY3Rpb24nLFxuICAgICAgICBiaXRzMmludF9tb2ROOiAnZnVuY3Rpb24nLFxuICAgIH0pO1xuICAgIGNvbnN0IHJhbmRvbUJ5dGVzID0gZWNkc2FPcHRzLnJhbmRvbUJ5dGVzIHx8IHJhbmRvbUJ5dGVzV2ViO1xuICAgIGNvbnN0IGhtYWMgPSBlY2RzYU9wdHMuaG1hYyB8fFxuICAgICAgICAoKGtleSwgLi4ubXNncykgPT4gbm9ibGVIbWFjKGhhc2gsIGtleSwgY29uY2F0Qnl0ZXMoLi4ubXNncykpKTtcbiAgICBjb25zdCB7IEZwLCBGbiB9ID0gUG9pbnQ7XG4gICAgY29uc3QgeyBPUkRFUjogQ1VSVkVfT1JERVIsIEJJVFM6IGZuQml0cyB9ID0gRm47XG4gICAgY29uc3QgeyBrZXlnZW4sIGdldFB1YmxpY0tleSwgZ2V0U2hhcmVkU2VjcmV0LCB1dGlscywgbGVuZ3RocyB9ID0gZWNkaChQb2ludCwgZWNkc2FPcHRzKTtcbiAgICBjb25zdCBkZWZhdWx0U2lnT3B0cyA9IHtcbiAgICAgICAgcHJlaGFzaDogZmFsc2UsXG4gICAgICAgIGxvd1M6IHR5cGVvZiBlY2RzYU9wdHMubG93UyA9PT0gJ2Jvb2xlYW4nID8gZWNkc2FPcHRzLmxvd1MgOiBmYWxzZSxcbiAgICAgICAgZm9ybWF0OiB1bmRlZmluZWQsIC8vJ2NvbXBhY3QnIGFzIEVDRFNBU2lnRm9ybWF0LFxuICAgICAgICBleHRyYUVudHJvcHk6IGZhbHNlLFxuICAgIH07XG4gICAgY29uc3QgZGVmYXVsdFNpZ09wdHNfZm9ybWF0ID0gJ2NvbXBhY3QnO1xuICAgIGZ1bmN0aW9uIGlzQmlnZ2VyVGhhbkhhbGZPcmRlcihudW1iZXIpIHtcbiAgICAgICAgY29uc3QgSEFMRiA9IENVUlZFX09SREVSID4+IF8xbjtcbiAgICAgICAgcmV0dXJuIG51bWJlciA+IEhBTEY7XG4gICAgfVxuICAgIGZ1bmN0aW9uIHZhbGlkYXRlUlModGl0bGUsIG51bSkge1xuICAgICAgICBpZiAoIUZuLmlzVmFsaWROb3QwKG51bSkpXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYGludmFsaWQgc2lnbmF0dXJlICR7dGl0bGV9OiBvdXQgb2YgcmFuZ2UgMS4uUG9pbnQuRm4uT1JERVJgKTtcbiAgICAgICAgcmV0dXJuIG51bTtcbiAgICB9XG4gICAgZnVuY3Rpb24gdmFsaWRhdGVTaWdMZW5ndGgoYnl0ZXMsIGZvcm1hdCkge1xuICAgICAgICB2YWxpZGF0ZVNpZ0Zvcm1hdChmb3JtYXQpO1xuICAgICAgICBjb25zdCBzaXplID0gbGVuZ3Rocy5zaWduYXR1cmU7XG4gICAgICAgIGNvbnN0IHNpemVyID0gZm9ybWF0ID09PSAnY29tcGFjdCcgPyBzaXplIDogZm9ybWF0ID09PSAncmVjb3ZlcmVkJyA/IHNpemUgKyAxIDogdW5kZWZpbmVkO1xuICAgICAgICByZXR1cm4gYWJ5dGVzKGJ5dGVzLCBzaXplciwgYCR7Zm9ybWF0fSBzaWduYXR1cmVgKTtcbiAgICB9XG4gICAgLyoqXG4gICAgICogRUNEU0Egc2lnbmF0dXJlIHdpdGggaXRzIChyLCBzKSBwcm9wZXJ0aWVzLiBTdXBwb3J0cyBjb21wYWN0LCByZWNvdmVyZWQgJiBERVIgcmVwcmVzZW50YXRpb25zLlxuICAgICAqL1xuICAgIGNsYXNzIFNpZ25hdHVyZSB7XG4gICAgICAgIGNvbnN0cnVjdG9yKHIsIHMsIHJlY292ZXJ5KSB7XG4gICAgICAgICAgICB0aGlzLnIgPSB2YWxpZGF0ZVJTKCdyJywgcik7IC8vIHIgaW4gWzEuLk4tMV07XG4gICAgICAgICAgICB0aGlzLnMgPSB2YWxpZGF0ZVJTKCdzJywgcyk7IC8vIHMgaW4gWzEuLk4tMV07XG4gICAgICAgICAgICBpZiAocmVjb3ZlcnkgIT0gbnVsbClcbiAgICAgICAgICAgICAgICB0aGlzLnJlY292ZXJ5ID0gcmVjb3Zlcnk7XG4gICAgICAgICAgICBPYmplY3QuZnJlZXplKHRoaXMpO1xuICAgICAgICB9XG4gICAgICAgIHN0YXRpYyBmcm9tQnl0ZXMoYnl0ZXMsIGZvcm1hdCA9IGRlZmF1bHRTaWdPcHRzX2Zvcm1hdCkge1xuICAgICAgICAgICAgdmFsaWRhdGVTaWdMZW5ndGgoYnl0ZXMsIGZvcm1hdCk7XG4gICAgICAgICAgICBsZXQgcmVjaWQ7XG4gICAgICAgICAgICBpZiAoZm9ybWF0ID09PSAnZGVyJykge1xuICAgICAgICAgICAgICAgIGNvbnN0IHsgciwgcyB9ID0gREVSLnRvU2lnKGFieXRlcyhieXRlcykpO1xuICAgICAgICAgICAgICAgIHJldHVybiBuZXcgU2lnbmF0dXJlKHIsIHMpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGZvcm1hdCA9PT0gJ3JlY292ZXJlZCcpIHtcbiAgICAgICAgICAgICAgICByZWNpZCA9IGJ5dGVzWzBdO1xuICAgICAgICAgICAgICAgIGZvcm1hdCA9ICdjb21wYWN0JztcbiAgICAgICAgICAgICAgICBieXRlcyA9IGJ5dGVzLnN1YmFycmF5KDEpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29uc3QgTCA9IEZuLkJZVEVTO1xuICAgICAgICAgICAgY29uc3QgciA9IGJ5dGVzLnN1YmFycmF5KDAsIEwpO1xuICAgICAgICAgICAgY29uc3QgcyA9IGJ5dGVzLnN1YmFycmF5KEwsIEwgKiAyKTtcbiAgICAgICAgICAgIHJldHVybiBuZXcgU2lnbmF0dXJlKEZuLmZyb21CeXRlcyhyKSwgRm4uZnJvbUJ5dGVzKHMpLCByZWNpZCk7XG4gICAgICAgIH1cbiAgICAgICAgc3RhdGljIGZyb21IZXgoaGV4LCBmb3JtYXQpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmZyb21CeXRlcyhoZXhUb0J5dGVzKGhleCksIGZvcm1hdCk7XG4gICAgICAgIH1cbiAgICAgICAgYWRkUmVjb3ZlcnlCaXQocmVjb3ZlcnkpIHtcbiAgICAgICAgICAgIHJldHVybiBuZXcgU2lnbmF0dXJlKHRoaXMuciwgdGhpcy5zLCByZWNvdmVyeSk7XG4gICAgICAgIH1cbiAgICAgICAgcmVjb3ZlclB1YmxpY0tleShtZXNzYWdlSGFzaCkge1xuICAgICAgICAgICAgY29uc3QgRklFTERfT1JERVIgPSBGcC5PUkRFUjtcbiAgICAgICAgICAgIGNvbnN0IHsgciwgcywgcmVjb3Zlcnk6IHJlYyB9ID0gdGhpcztcbiAgICAgICAgICAgIGlmIChyZWMgPT0gbnVsbCB8fCAhWzAsIDEsIDIsIDNdLmluY2x1ZGVzKHJlYykpXG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdyZWNvdmVyeSBpZCBpbnZhbGlkJyk7XG4gICAgICAgICAgICAvLyBFQ0RTQSByZWNvdmVyeSBpcyBoYXJkIGZvciBjb2ZhY3RvciA+IDEgY3VydmVzLlxuICAgICAgICAgICAgLy8gSW4gc2lnbiwgYHIgPSBxLnggbW9kIG5gLCBhbmQgaGVyZSB3ZSByZWNvdmVyIHEueCBmcm9tIHIuXG4gICAgICAgICAgICAvLyBXaGlsZSByZWNvdmVyaW5nIHEueCA+PSBuLCB3ZSBuZWVkIHRvIGFkZCByK24gZm9yIGNvZmFjdG9yPTEgY3VydmVzLlxuICAgICAgICAgICAgLy8gSG93ZXZlciwgZm9yIGNvZmFjdG9yPjEsIHIrbiBtYXkgbm90IGdldCBxLng6XG4gICAgICAgICAgICAvLyByK24qaSB3b3VsZCBuZWVkIHRvIGJlIGRvbmUgaW5zdGVhZCB3aGVyZSBpIGlzIHVua25vd24uXG4gICAgICAgICAgICAvLyBUbyBlYXNpbHkgZ2V0IGksIHdlIGVpdGhlciBuZWVkIHRvOlxuICAgICAgICAgICAgLy8gYS4gaW5jcmVhc2UgYW1vdW50IG9mIHZhbGlkIHJlY2lkIHZhbHVlcyAoNCwgNS4uLik7IE9SXG4gICAgICAgICAgICAvLyBiLiBwcm9oaWJpdCBub24tcHJpbWUtb3JkZXIgc2lnbmF0dXJlcyAocmVjaWQgPiAxKS5cbiAgICAgICAgICAgIGNvbnN0IGhhc0NvZmFjdG9yID0gQ1VSVkVfT1JERVIgKiBfMm4gPCBGSUVMRF9PUkRFUjtcbiAgICAgICAgICAgIGlmIChoYXNDb2ZhY3RvciAmJiByZWMgPiAxKVxuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcigncmVjb3ZlcnkgaWQgaXMgYW1iaWd1b3VzIGZvciBoPjEgY3VydmUnKTtcbiAgICAgICAgICAgIGNvbnN0IHJhZGogPSByZWMgPT09IDIgfHwgcmVjID09PSAzID8gciArIENVUlZFX09SREVSIDogcjtcbiAgICAgICAgICAgIGlmICghRnAuaXNWYWxpZChyYWRqKSlcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ3JlY292ZXJ5IGlkIDIgb3IgMyBpbnZhbGlkJyk7XG4gICAgICAgICAgICBjb25zdCB4ID0gRnAudG9CeXRlcyhyYWRqKTtcbiAgICAgICAgICAgIGNvbnN0IFIgPSBQb2ludC5mcm9tQnl0ZXMoY29uY2F0Qnl0ZXMocHByZWZpeCgocmVjICYgMSkgPT09IDApLCB4KSk7XG4gICAgICAgICAgICBjb25zdCBpciA9IEZuLmludihyYWRqKTsgLy8gcl4tMVxuICAgICAgICAgICAgY29uc3QgaCA9IGJpdHMyaW50X21vZE4oZW5zdXJlQnl0ZXMoJ21zZ0hhc2gnLCBtZXNzYWdlSGFzaCkpOyAvLyBUcnVuY2F0ZSBoYXNoXG4gICAgICAgICAgICBjb25zdCB1MSA9IEZuLmNyZWF0ZSgtaCAqIGlyKTsgLy8gLWhyXi0xXG4gICAgICAgICAgICBjb25zdCB1MiA9IEZuLmNyZWF0ZShzICogaXIpOyAvLyBzcl4tMVxuICAgICAgICAgICAgLy8gKHNyXi0xKVItKGhyXi0xKUcgPSAtKGhyXi0xKUcgKyAoc3JeLTEpLiB1bnNhZmUgaXMgZmluZTogdGhlcmUgaXMgbm8gcHJpdmF0ZSBkYXRhLlxuICAgICAgICAgICAgY29uc3QgUSA9IFBvaW50LkJBU0UubXVsdGlwbHlVbnNhZmUodTEpLmFkZChSLm11bHRpcGx5VW5zYWZlKHUyKSk7XG4gICAgICAgICAgICBpZiAoUS5pczAoKSlcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ3BvaW50IGF0IGluZmluaWZ5Jyk7XG4gICAgICAgICAgICBRLmFzc2VydFZhbGlkaXR5KCk7XG4gICAgICAgICAgICByZXR1cm4gUTtcbiAgICAgICAgfVxuICAgICAgICAvLyBTaWduYXR1cmVzIHNob3VsZCBiZSBsb3ctcywgdG8gcHJldmVudCBtYWxsZWFiaWxpdHkuXG4gICAgICAgIGhhc0hpZ2hTKCkge1xuICAgICAgICAgICAgcmV0dXJuIGlzQmlnZ2VyVGhhbkhhbGZPcmRlcih0aGlzLnMpO1xuICAgICAgICB9XG4gICAgICAgIHRvQnl0ZXMoZm9ybWF0ID0gZGVmYXVsdFNpZ09wdHNfZm9ybWF0KSB7XG4gICAgICAgICAgICB2YWxpZGF0ZVNpZ0Zvcm1hdChmb3JtYXQpO1xuICAgICAgICAgICAgaWYgKGZvcm1hdCA9PT0gJ2RlcicpXG4gICAgICAgICAgICAgICAgcmV0dXJuIGhleFRvQnl0ZXMoREVSLmhleEZyb21TaWcodGhpcykpO1xuICAgICAgICAgICAgY29uc3QgciA9IEZuLnRvQnl0ZXModGhpcy5yKTtcbiAgICAgICAgICAgIGNvbnN0IHMgPSBGbi50b0J5dGVzKHRoaXMucyk7XG4gICAgICAgICAgICBpZiAoZm9ybWF0ID09PSAncmVjb3ZlcmVkJykge1xuICAgICAgICAgICAgICAgIGlmICh0aGlzLnJlY292ZXJ5ID09IG51bGwpXG4gICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcigncmVjb3ZlcnkgYml0IG11c3QgYmUgcHJlc2VudCcpO1xuICAgICAgICAgICAgICAgIHJldHVybiBjb25jYXRCeXRlcyhVaW50OEFycmF5Lm9mKHRoaXMucmVjb3ZlcnkpLCByLCBzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBjb25jYXRCeXRlcyhyLCBzKTtcbiAgICAgICAgfVxuICAgICAgICB0b0hleChmb3JtYXQpIHtcbiAgICAgICAgICAgIHJldHVybiBieXRlc1RvSGV4KHRoaXMudG9CeXRlcyhmb3JtYXQpKTtcbiAgICAgICAgfVxuICAgICAgICAvLyBUT0RPOiByZW1vdmVcbiAgICAgICAgYXNzZXJ0VmFsaWRpdHkoKSB7IH1cbiAgICAgICAgc3RhdGljIGZyb21Db21wYWN0KGhleCkge1xuICAgICAgICAgICAgcmV0dXJuIFNpZ25hdHVyZS5mcm9tQnl0ZXMoZW5zdXJlQnl0ZXMoJ3NpZycsIGhleCksICdjb21wYWN0Jyk7XG4gICAgICAgIH1cbiAgICAgICAgc3RhdGljIGZyb21ERVIoaGV4KSB7XG4gICAgICAgICAgICByZXR1cm4gU2lnbmF0dXJlLmZyb21CeXRlcyhlbnN1cmVCeXRlcygnc2lnJywgaGV4KSwgJ2RlcicpO1xuICAgICAgICB9XG4gICAgICAgIG5vcm1hbGl6ZVMoKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5oYXNIaWdoUygpID8gbmV3IFNpZ25hdHVyZSh0aGlzLnIsIEZuLm5lZyh0aGlzLnMpLCB0aGlzLnJlY292ZXJ5KSA6IHRoaXM7XG4gICAgICAgIH1cbiAgICAgICAgdG9ERVJSYXdCeXRlcygpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLnRvQnl0ZXMoJ2RlcicpO1xuICAgICAgICB9XG4gICAgICAgIHRvREVSSGV4KCkge1xuICAgICAgICAgICAgcmV0dXJuIGJ5dGVzVG9IZXgodGhpcy50b0J5dGVzKCdkZXInKSk7XG4gICAgICAgIH1cbiAgICAgICAgdG9Db21wYWN0UmF3Qnl0ZXMoKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy50b0J5dGVzKCdjb21wYWN0Jyk7XG4gICAgICAgIH1cbiAgICAgICAgdG9Db21wYWN0SGV4KCkge1xuICAgICAgICAgICAgcmV0dXJuIGJ5dGVzVG9IZXgodGhpcy50b0J5dGVzKCdjb21wYWN0JykpO1xuICAgICAgICB9XG4gICAgfVxuICAgIC8vIFJGQzY5Nzk6IGVuc3VyZSBFQ0RTQSBtc2cgaXMgWCBieXRlcyBhbmQgPCBOLiBSRkMgc3VnZ2VzdHMgb3B0aW9uYWwgdHJ1bmNhdGluZyB2aWEgYml0czJvY3RldHMuXG4gICAgLy8gRklQUyAxODYtNCA0LjYgc3VnZ2VzdHMgdGhlIGxlZnRtb3N0IG1pbihuQml0TGVuLCBvdXRMZW4pIGJpdHMsIHdoaWNoIG1hdGNoZXMgYml0czJpbnQuXG4gICAgLy8gYml0czJpbnQgY2FuIHByb2R1Y2UgcmVzPk4sIHdlIGNhbiBkbyBtb2QocmVzLCBOKSBzaW5jZSB0aGUgYml0TGVuIGlzIHRoZSBzYW1lLlxuICAgIC8vIGludDJvY3RldHMgY2FuJ3QgYmUgdXNlZDsgcGFkcyBzbWFsbCBtc2dzIHdpdGggMDogdW5hY2NlcHRhdGJsZSBmb3IgdHJ1bmMgYXMgcGVyIFJGQyB2ZWN0b3JzXG4gICAgY29uc3QgYml0czJpbnQgPSBlY2RzYU9wdHMuYml0czJpbnQgfHxcbiAgICAgICAgZnVuY3Rpb24gYml0czJpbnRfZGVmKGJ5dGVzKSB7XG4gICAgICAgICAgICAvLyBPdXIgY3VzdG9tIGNoZWNrIFwianVzdCBpbiBjYXNlXCIsIGZvciBwcm90ZWN0aW9uIGFnYWluc3QgRG9TXG4gICAgICAgICAgICBpZiAoYnl0ZXMubGVuZ3RoID4gODE5MilcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ2lucHV0IGlzIHRvbyBsYXJnZScpO1xuICAgICAgICAgICAgLy8gRm9yIGN1cnZlcyB3aXRoIG5CaXRMZW5ndGggJSA4ICE9PSAwOiBiaXRzMm9jdGV0cyhiaXRzMm9jdGV0cyhtKSkgIT09IGJpdHMyb2N0ZXRzKG0pXG4gICAgICAgICAgICAvLyBmb3Igc29tZSBjYXNlcywgc2luY2UgYnl0ZXMubGVuZ3RoICogOCBpcyBub3QgYWN0dWFsIGJpdExlbmd0aC5cbiAgICAgICAgICAgIGNvbnN0IG51bSA9IGJ5dGVzVG9OdW1iZXJCRShieXRlcyk7IC8vIGNoZWNrIGZvciA9PSB1OCBkb25lIGhlcmVcbiAgICAgICAgICAgIGNvbnN0IGRlbHRhID0gYnl0ZXMubGVuZ3RoICogOCAtIGZuQml0czsgLy8gdHJ1bmNhdGUgdG8gbkJpdExlbmd0aCBsZWZ0bW9zdCBiaXRzXG4gICAgICAgICAgICByZXR1cm4gZGVsdGEgPiAwID8gbnVtID4+IEJpZ0ludChkZWx0YSkgOiBudW07XG4gICAgICAgIH07XG4gICAgY29uc3QgYml0czJpbnRfbW9kTiA9IGVjZHNhT3B0cy5iaXRzMmludF9tb2ROIHx8XG4gICAgICAgIGZ1bmN0aW9uIGJpdHMyaW50X21vZE5fZGVmKGJ5dGVzKSB7XG4gICAgICAgICAgICByZXR1cm4gRm4uY3JlYXRlKGJpdHMyaW50KGJ5dGVzKSk7IC8vIGNhbid0IHVzZSBieXRlc1RvTnVtYmVyQkUgaGVyZVxuICAgICAgICB9O1xuICAgIC8vIFBhZHMgb3V0cHV0IHdpdGggemVybyBhcyBwZXIgc3BlY1xuICAgIGNvbnN0IE9SREVSX01BU0sgPSBiaXRNYXNrKGZuQml0cyk7XG4gICAgLyoqIENvbnZlcnRzIHRvIGJ5dGVzLiBDaGVja3MgaWYgbnVtIGluIGBbMC4uT1JERVJfTUFTSy0xXWAgZS5nLjogYFswLi4yXjI1Ni0xXWAuICovXG4gICAgZnVuY3Rpb24gaW50Mm9jdGV0cyhudW0pIHtcbiAgICAgICAgLy8gSU1QT1JUQU5UOiB0aGUgY2hlY2sgZW5zdXJlcyB3b3JraW5nIGZvciBjYXNlIGBGbi5CWVRFUyAhPSBGbi5CSVRTICogOGBcbiAgICAgICAgYUluUmFuZ2UoJ251bSA8IDJeJyArIGZuQml0cywgbnVtLCBfMG4sIE9SREVSX01BU0spO1xuICAgICAgICByZXR1cm4gRm4udG9CeXRlcyhudW0pO1xuICAgIH1cbiAgICBmdW5jdGlvbiB2YWxpZGF0ZU1zZ0FuZEhhc2gobWVzc2FnZSwgcHJlaGFzaCkge1xuICAgICAgICBhYnl0ZXMobWVzc2FnZSwgdW5kZWZpbmVkLCAnbWVzc2FnZScpO1xuICAgICAgICByZXR1cm4gcHJlaGFzaCA/IGFieXRlcyhoYXNoKG1lc3NhZ2UpLCB1bmRlZmluZWQsICdwcmVoYXNoZWQgbWVzc2FnZScpIDogbWVzc2FnZTtcbiAgICB9XG4gICAgLyoqXG4gICAgICogU3RlcHMgQSwgRCBvZiBSRkM2OTc5IDMuMi5cbiAgICAgKiBDcmVhdGVzIFJGQzY5Nzkgc2VlZDsgY29udmVydHMgbXNnL3ByaXZLZXkgdG8gbnVtYmVycy5cbiAgICAgKiBVc2VkIG9ubHkgaW4gc2lnbiwgbm90IGluIHZlcmlmeS5cbiAgICAgKlxuICAgICAqIFdhcm5pbmc6IHdlIGNhbm5vdCBhc3N1bWUgaGVyZSB0aGF0IG1lc3NhZ2UgaGFzIHNhbWUgYW1vdW50IG9mIGJ5dGVzIGFzIGN1cnZlIG9yZGVyLFxuICAgICAqIHRoaXMgd2lsbCBiZSBpbnZhbGlkIGF0IGxlYXN0IGZvciBQNTIxLiBBbHNvIGl0IGNhbiBiZSBiaWdnZXIgZm9yIFAyMjQgKyBTSEEyNTYuXG4gICAgICovXG4gICAgZnVuY3Rpb24gcHJlcFNpZyhtZXNzYWdlLCBwcml2YXRlS2V5LCBvcHRzKSB7XG4gICAgICAgIGlmIChbJ3JlY292ZXJlZCcsICdjYW5vbmljYWwnXS5zb21lKChrKSA9PiBrIGluIG9wdHMpKVxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdzaWduKCkgbGVnYWN5IG9wdGlvbnMgbm90IHN1cHBvcnRlZCcpO1xuICAgICAgICBjb25zdCB7IGxvd1MsIHByZWhhc2gsIGV4dHJhRW50cm9weSB9ID0gdmFsaWRhdGVTaWdPcHRzKG9wdHMsIGRlZmF1bHRTaWdPcHRzKTtcbiAgICAgICAgbWVzc2FnZSA9IHZhbGlkYXRlTXNnQW5kSGFzaChtZXNzYWdlLCBwcmVoYXNoKTsgLy8gUkZDNjk3OSAzLjIgQTogaDEgPSBIKG0pXG4gICAgICAgIC8vIFdlIGNhbid0IGxhdGVyIGNhbGwgYml0czJvY3RldHMsIHNpbmNlIG5lc3RlZCBiaXRzMmludCBpcyBicm9rZW4gZm9yIGN1cnZlc1xuICAgICAgICAvLyB3aXRoIGZuQml0cyAlIDggIT09IDAuIEJlY2F1c2Ugb2YgdGhhdCwgd2UgdW53cmFwIGl0IGhlcmUgYXMgaW50Mm9jdGV0cyBjYWxsLlxuICAgICAgICAvLyBjb25zdCBiaXRzMm9jdGV0cyA9IChiaXRzKSA9PiBpbnQyb2N0ZXRzKGJpdHMyaW50X21vZE4oYml0cykpXG4gICAgICAgIGNvbnN0IGgxaW50ID0gYml0czJpbnRfbW9kTihtZXNzYWdlKTtcbiAgICAgICAgY29uc3QgZCA9IF9ub3JtRm5FbGVtZW50KEZuLCBwcml2YXRlS2V5KTsgLy8gdmFsaWRhdGUgc2VjcmV0IGtleSwgY29udmVydCB0byBiaWdpbnRcbiAgICAgICAgY29uc3Qgc2VlZEFyZ3MgPSBbaW50Mm9jdGV0cyhkKSwgaW50Mm9jdGV0cyhoMWludCldO1xuICAgICAgICAvLyBleHRyYUVudHJvcHkuIFJGQzY5NzkgMy42OiBhZGRpdGlvbmFsIGsnIChvcHRpb25hbCkuXG4gICAgICAgIGlmIChleHRyYUVudHJvcHkgIT0gbnVsbCAmJiBleHRyYUVudHJvcHkgIT09IGZhbHNlKSB7XG4gICAgICAgICAgICAvLyBLID0gSE1BQ19LKFYgfHwgMHgwMCB8fCBpbnQyb2N0ZXRzKHgpIHx8IGJpdHMyb2N0ZXRzKGgxKSB8fCBrJylcbiAgICAgICAgICAgIC8vIGdlbiByYW5kb20gYnl0ZXMgT1IgcGFzcyBhcy1pc1xuICAgICAgICAgICAgY29uc3QgZSA9IGV4dHJhRW50cm9weSA9PT0gdHJ1ZSA/IHJhbmRvbUJ5dGVzKGxlbmd0aHMuc2VjcmV0S2V5KSA6IGV4dHJhRW50cm9weTtcbiAgICAgICAgICAgIHNlZWRBcmdzLnB1c2goZW5zdXJlQnl0ZXMoJ2V4dHJhRW50cm9weScsIGUpKTsgLy8gY2hlY2sgZm9yIGJlaW5nIGJ5dGVzXG4gICAgICAgIH1cbiAgICAgICAgY29uc3Qgc2VlZCA9IGNvbmNhdEJ5dGVzKC4uLnNlZWRBcmdzKTsgLy8gU3RlcCBEIG9mIFJGQzY5NzkgMy4yXG4gICAgICAgIGNvbnN0IG0gPSBoMWludDsgLy8gTk9URTogbm8gbmVlZCB0byBjYWxsIGJpdHMyaW50IHNlY29uZCB0aW1lIGhlcmUsIGl0IGlzIGluc2lkZSB0cnVuY2F0ZUhhc2ghXG4gICAgICAgIC8vIENvbnZlcnRzIHNpZ25hdHVyZSBwYXJhbXMgaW50byBwb2ludCB3IHIvcywgY2hlY2tzIHJlc3VsdCBmb3IgdmFsaWRpdHkuXG4gICAgICAgIC8vIFRvIHRyYW5zZm9ybSBrID0+IFNpZ25hdHVyZTpcbiAgICAgICAgLy8gcSA9IGvii4VHXG4gICAgICAgIC8vIHIgPSBxLnggbW9kIG5cbiAgICAgICAgLy8gcyA9IGteLTEobSArIHJkKSBtb2QgblxuICAgICAgICAvLyBDYW4gdXNlIHNjYWxhciBibGluZGluZyBiXi0xKGJtICsgYmRyKSB3aGVyZSBiIOKIiCBbMSxx4oiSMV0gYWNjb3JkaW5nIHRvXG4gICAgICAgIC8vIGh0dHBzOi8vdGNoZXMuaWFjci5vcmcvaW5kZXgucGhwL1RDSEVTL2FydGljbGUvdmlldy83MzM3LzY1MDkuIFdlJ3ZlIGRlY2lkZWQgYWdhaW5zdCBpdDpcbiAgICAgICAgLy8gYSkgZGVwZW5kZW5jeSBvbiBDU1BSTkcgYikgMTUlIHNsb3dkb3duIGMpIGRvZXNuJ3QgcmVhbGx5IGhlbHAgc2luY2UgYmlnaW50cyBhcmUgbm90IENUXG4gICAgICAgIGZ1bmN0aW9uIGsyc2lnKGtCeXRlcykge1xuICAgICAgICAgICAgLy8gUkZDIDY5NzkgU2VjdGlvbiAzLjIsIHN0ZXAgMzogayA9IGJpdHMyaW50KFQpXG4gICAgICAgICAgICAvLyBJbXBvcnRhbnQ6IGFsbCBtb2QoKSBjYWxscyBoZXJlIG11c3QgYmUgZG9uZSBvdmVyIE5cbiAgICAgICAgICAgIGNvbnN0IGsgPSBiaXRzMmludChrQnl0ZXMpOyAvLyBtb2Qgbiwgbm90IG1vZCBwXG4gICAgICAgICAgICBpZiAoIUZuLmlzVmFsaWROb3QwKGspKVxuICAgICAgICAgICAgICAgIHJldHVybjsgLy8gVmFsaWQgc2NhbGFycyAoaW5jbHVkaW5nIGspIG11c3QgYmUgaW4gMS4uTi0xXG4gICAgICAgICAgICBjb25zdCBpayA9IEZuLmludihrKTsgLy8ga14tMSBtb2QgblxuICAgICAgICAgICAgY29uc3QgcSA9IFBvaW50LkJBU0UubXVsdGlwbHkoaykudG9BZmZpbmUoKTsgLy8gcSA9IGvii4VHXG4gICAgICAgICAgICBjb25zdCByID0gRm4uY3JlYXRlKHEueCk7IC8vIHIgPSBxLnggbW9kIG5cbiAgICAgICAgICAgIGlmIChyID09PSBfMG4pXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgY29uc3QgcyA9IEZuLmNyZWF0ZShpayAqIEZuLmNyZWF0ZShtICsgciAqIGQpKTsgLy8gTm90IHVzaW5nIGJsaW5kaW5nIGhlcmUsIHNlZSBjb21tZW50IGFib3ZlXG4gICAgICAgICAgICBpZiAocyA9PT0gXzBuKVxuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIGxldCByZWNvdmVyeSA9IChxLnggPT09IHIgPyAwIDogMikgfCBOdW1iZXIocS55ICYgXzFuKTsgLy8gcmVjb3ZlcnkgYml0ICgyIG9yIDMsIHdoZW4gcS54ID4gbilcbiAgICAgICAgICAgIGxldCBub3JtUyA9IHM7XG4gICAgICAgICAgICBpZiAobG93UyAmJiBpc0JpZ2dlclRoYW5IYWxmT3JkZXIocykpIHtcbiAgICAgICAgICAgICAgICBub3JtUyA9IEZuLm5lZyhzKTsgLy8gaWYgbG93UyB3YXMgcGFzc2VkLCBlbnN1cmUgcyBpcyBhbHdheXNcbiAgICAgICAgICAgICAgICByZWNvdmVyeSBePSAxOyAvLyAvLyBpbiB0aGUgYm90dG9tIGhhbGYgb2YgTlxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIG5ldyBTaWduYXR1cmUociwgbm9ybVMsIHJlY292ZXJ5KTsgLy8gdXNlIG5vcm1TLCBub3Qgc1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB7IHNlZWQsIGsyc2lnIH07XG4gICAgfVxuICAgIC8qKlxuICAgICAqIFNpZ25zIG1lc3NhZ2UgaGFzaCB3aXRoIGEgc2VjcmV0IGtleS5cbiAgICAgKlxuICAgICAqIGBgYFxuICAgICAqIHNpZ24obSwgZCkgd2hlcmVcbiAgICAgKiAgIGsgPSByZmM2OTc5X2htYWNfZHJiZyhtLCBkKVxuICAgICAqICAgKHgsIHkpID0gRyDDlyBrXG4gICAgICogICByID0geCBtb2QgblxuICAgICAqICAgcyA9IChtICsgZHIpIC8gayBtb2QgblxuICAgICAqIGBgYFxuICAgICAqL1xuICAgIGZ1bmN0aW9uIHNpZ24obWVzc2FnZSwgc2VjcmV0S2V5LCBvcHRzID0ge30pIHtcbiAgICAgICAgbWVzc2FnZSA9IGVuc3VyZUJ5dGVzKCdtZXNzYWdlJywgbWVzc2FnZSk7XG4gICAgICAgIGNvbnN0IHsgc2VlZCwgazJzaWcgfSA9IHByZXBTaWcobWVzc2FnZSwgc2VjcmV0S2V5LCBvcHRzKTsgLy8gU3RlcHMgQSwgRCBvZiBSRkM2OTc5IDMuMi5cbiAgICAgICAgY29uc3QgZHJiZyA9IGNyZWF0ZUhtYWNEcmJnKGhhc2gub3V0cHV0TGVuLCBGbi5CWVRFUywgaG1hYyk7XG4gICAgICAgIGNvbnN0IHNpZyA9IGRyYmcoc2VlZCwgazJzaWcpOyAvLyBTdGVwcyBCLCBDLCBELCBFLCBGLCBHXG4gICAgICAgIHJldHVybiBzaWc7XG4gICAgfVxuICAgIGZ1bmN0aW9uIHRyeVBhcnNpbmdTaWcoc2cpIHtcbiAgICAgICAgLy8gVHJ5IHRvIGRlZHVjZSBmb3JtYXRcbiAgICAgICAgbGV0IHNpZyA9IHVuZGVmaW5lZDtcbiAgICAgICAgY29uc3QgaXNIZXggPSB0eXBlb2Ygc2cgPT09ICdzdHJpbmcnIHx8IGlzQnl0ZXMoc2cpO1xuICAgICAgICBjb25zdCBpc09iaiA9ICFpc0hleCAmJlxuICAgICAgICAgICAgc2cgIT09IG51bGwgJiZcbiAgICAgICAgICAgIHR5cGVvZiBzZyA9PT0gJ29iamVjdCcgJiZcbiAgICAgICAgICAgIHR5cGVvZiBzZy5yID09PSAnYmlnaW50JyAmJlxuICAgICAgICAgICAgdHlwZW9mIHNnLnMgPT09ICdiaWdpbnQnO1xuICAgICAgICBpZiAoIWlzSGV4ICYmICFpc09iailcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignaW52YWxpZCBzaWduYXR1cmUsIGV4cGVjdGVkIFVpbnQ4QXJyYXksIGhleCBzdHJpbmcgb3IgU2lnbmF0dXJlIGluc3RhbmNlJyk7XG4gICAgICAgIGlmIChpc09iaikge1xuICAgICAgICAgICAgc2lnID0gbmV3IFNpZ25hdHVyZShzZy5yLCBzZy5zKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmIChpc0hleCkge1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBzaWcgPSBTaWduYXR1cmUuZnJvbUJ5dGVzKGVuc3VyZUJ5dGVzKCdzaWcnLCBzZyksICdkZXInKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNhdGNoIChkZXJFcnJvcikge1xuICAgICAgICAgICAgICAgIGlmICghKGRlckVycm9yIGluc3RhbmNlb2YgREVSLkVycikpXG4gICAgICAgICAgICAgICAgICAgIHRocm93IGRlckVycm9yO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKCFzaWcpIHtcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBzaWcgPSBTaWduYXR1cmUuZnJvbUJ5dGVzKGVuc3VyZUJ5dGVzKCdzaWcnLCBzZyksICdjb21wYWN0Jyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNhdGNoIChlcnJvcikge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmICghc2lnKVxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICByZXR1cm4gc2lnO1xuICAgIH1cbiAgICAvKipcbiAgICAgKiBWZXJpZmllcyBhIHNpZ25hdHVyZSBhZ2FpbnN0IG1lc3NhZ2UgYW5kIHB1YmxpYyBrZXkuXG4gICAgICogUmVqZWN0cyBsb3dTIHNpZ25hdHVyZXMgYnkgZGVmYXVsdDogc2VlIHtAbGluayBFQ0RTQVZlcmlmeU9wdHN9LlxuICAgICAqIEltcGxlbWVudHMgc2VjdGlvbiA0LjEuNCBmcm9tIGh0dHBzOi8vd3d3LnNlY2cub3JnL3NlYzEtdjIucGRmOlxuICAgICAqXG4gICAgICogYGBgXG4gICAgICogdmVyaWZ5KHIsIHMsIGgsIFApIHdoZXJlXG4gICAgICogICB1MSA9IGhzXi0xIG1vZCBuXG4gICAgICogICB1MiA9IHJzXi0xIG1vZCBuXG4gICAgICogICBSID0gdTHii4VHICsgdTLii4VQXG4gICAgICogICBtb2QoUi54LCBuKSA9PSByXG4gICAgICogYGBgXG4gICAgICovXG4gICAgZnVuY3Rpb24gdmVyaWZ5KHNpZ25hdHVyZSwgbWVzc2FnZSwgcHVibGljS2V5LCBvcHRzID0ge30pIHtcbiAgICAgICAgY29uc3QgeyBsb3dTLCBwcmVoYXNoLCBmb3JtYXQgfSA9IHZhbGlkYXRlU2lnT3B0cyhvcHRzLCBkZWZhdWx0U2lnT3B0cyk7XG4gICAgICAgIHB1YmxpY0tleSA9IGVuc3VyZUJ5dGVzKCdwdWJsaWNLZXknLCBwdWJsaWNLZXkpO1xuICAgICAgICBtZXNzYWdlID0gdmFsaWRhdGVNc2dBbmRIYXNoKGVuc3VyZUJ5dGVzKCdtZXNzYWdlJywgbWVzc2FnZSksIHByZWhhc2gpO1xuICAgICAgICBpZiAoJ3N0cmljdCcgaW4gb3B0cylcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignb3B0aW9ucy5zdHJpY3Qgd2FzIHJlbmFtZWQgdG8gbG93UycpO1xuICAgICAgICBjb25zdCBzaWcgPSBmb3JtYXQgPT09IHVuZGVmaW5lZFxuICAgICAgICAgICAgPyB0cnlQYXJzaW5nU2lnKHNpZ25hdHVyZSlcbiAgICAgICAgICAgIDogU2lnbmF0dXJlLmZyb21CeXRlcyhlbnN1cmVCeXRlcygnc2lnJywgc2lnbmF0dXJlKSwgZm9ybWF0KTtcbiAgICAgICAgaWYgKHNpZyA9PT0gZmFsc2UpXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCBQID0gUG9pbnQuZnJvbUJ5dGVzKHB1YmxpY0tleSk7XG4gICAgICAgICAgICBpZiAobG93UyAmJiBzaWcuaGFzSGlnaFMoKSlcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICBjb25zdCB7IHIsIHMgfSA9IHNpZztcbiAgICAgICAgICAgIGNvbnN0IGggPSBiaXRzMmludF9tb2ROKG1lc3NhZ2UpOyAvLyBtb2Qgbiwgbm90IG1vZCBwXG4gICAgICAgICAgICBjb25zdCBpcyA9IEZuLmludihzKTsgLy8gc14tMSBtb2QgblxuICAgICAgICAgICAgY29uc3QgdTEgPSBGbi5jcmVhdGUoaCAqIGlzKTsgLy8gdTEgPSBoc14tMSBtb2QgblxuICAgICAgICAgICAgY29uc3QgdTIgPSBGbi5jcmVhdGUociAqIGlzKTsgLy8gdTIgPSByc14tMSBtb2QgblxuICAgICAgICAgICAgY29uc3QgUiA9IFBvaW50LkJBU0UubXVsdGlwbHlVbnNhZmUodTEpLmFkZChQLm11bHRpcGx5VW5zYWZlKHUyKSk7IC8vIHUx4ouFRyArIHUy4ouFUFxuICAgICAgICAgICAgaWYgKFIuaXMwKCkpXG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgY29uc3QgdiA9IEZuLmNyZWF0ZShSLngpOyAvLyB2ID0gci54IG1vZCBuXG4gICAgICAgICAgICByZXR1cm4gdiA9PT0gcjtcbiAgICAgICAgfVxuICAgICAgICBjYXRjaCAoZSkge1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgfVxuICAgIGZ1bmN0aW9uIHJlY292ZXJQdWJsaWNLZXkoc2lnbmF0dXJlLCBtZXNzYWdlLCBvcHRzID0ge30pIHtcbiAgICAgICAgY29uc3QgeyBwcmVoYXNoIH0gPSB2YWxpZGF0ZVNpZ09wdHMob3B0cywgZGVmYXVsdFNpZ09wdHMpO1xuICAgICAgICBtZXNzYWdlID0gdmFsaWRhdGVNc2dBbmRIYXNoKG1lc3NhZ2UsIHByZWhhc2gpO1xuICAgICAgICByZXR1cm4gU2lnbmF0dXJlLmZyb21CeXRlcyhzaWduYXR1cmUsICdyZWNvdmVyZWQnKS5yZWNvdmVyUHVibGljS2V5KG1lc3NhZ2UpLnRvQnl0ZXMoKTtcbiAgICB9XG4gICAgcmV0dXJuIE9iamVjdC5mcmVlemUoe1xuICAgICAgICBrZXlnZW4sXG4gICAgICAgIGdldFB1YmxpY0tleSxcbiAgICAgICAgZ2V0U2hhcmVkU2VjcmV0LFxuICAgICAgICB1dGlscyxcbiAgICAgICAgbGVuZ3RocyxcbiAgICAgICAgUG9pbnQsXG4gICAgICAgIHNpZ24sXG4gICAgICAgIHZlcmlmeSxcbiAgICAgICAgcmVjb3ZlclB1YmxpY0tleSxcbiAgICAgICAgU2lnbmF0dXJlLFxuICAgICAgICBoYXNoLFxuICAgIH0pO1xufVxuLyoqIEBkZXByZWNhdGVkIHVzZSBgd2VpZXJzdHJhc3NgIGluIG5ld2VyIHJlbGVhc2VzICovXG5leHBvcnQgZnVuY3Rpb24gd2VpZXJzdHJhc3NQb2ludHMoYykge1xuICAgIGNvbnN0IHsgQ1VSVkUsIGN1cnZlT3B0cyB9ID0gX3dlaWVyc3RyYXNzX2xlZ2FjeV9vcHRzX3RvX25ldyhjKTtcbiAgICBjb25zdCBQb2ludCA9IHdlaWVyc3RyYXNzTihDVVJWRSwgY3VydmVPcHRzKTtcbiAgICByZXR1cm4gX3dlaWVyc3RyYXNzX25ld19vdXRwdXRfdG9fbGVnYWN5KGMsIFBvaW50KTtcbn1cbmZ1bmN0aW9uIF93ZWllcnN0cmFzc19sZWdhY3lfb3B0c190b19uZXcoYykge1xuICAgIGNvbnN0IENVUlZFID0ge1xuICAgICAgICBhOiBjLmEsXG4gICAgICAgIGI6IGMuYixcbiAgICAgICAgcDogYy5GcC5PUkRFUixcbiAgICAgICAgbjogYy5uLFxuICAgICAgICBoOiBjLmgsXG4gICAgICAgIEd4OiBjLkd4LFxuICAgICAgICBHeTogYy5HeSxcbiAgICB9O1xuICAgIGNvbnN0IEZwID0gYy5GcDtcbiAgICBsZXQgYWxsb3dlZExlbmd0aHMgPSBjLmFsbG93ZWRQcml2YXRlS2V5TGVuZ3Roc1xuICAgICAgICA/IEFycmF5LmZyb20obmV3IFNldChjLmFsbG93ZWRQcml2YXRlS2V5TGVuZ3Rocy5tYXAoKGwpID0+IE1hdGguY2VpbChsIC8gMikpKSlcbiAgICAgICAgOiB1bmRlZmluZWQ7XG4gICAgY29uc3QgRm4gPSBGaWVsZChDVVJWRS5uLCB7XG4gICAgICAgIEJJVFM6IGMubkJpdExlbmd0aCxcbiAgICAgICAgYWxsb3dlZExlbmd0aHM6IGFsbG93ZWRMZW5ndGhzLFxuICAgICAgICBtb2RGcm9tQnl0ZXM6IGMud3JhcFByaXZhdGVLZXksXG4gICAgfSk7XG4gICAgY29uc3QgY3VydmVPcHRzID0ge1xuICAgICAgICBGcCxcbiAgICAgICAgRm4sXG4gICAgICAgIGFsbG93SW5maW5pdHlQb2ludDogYy5hbGxvd0luZmluaXR5UG9pbnQsXG4gICAgICAgIGVuZG86IGMuZW5kbyxcbiAgICAgICAgaXNUb3JzaW9uRnJlZTogYy5pc1RvcnNpb25GcmVlLFxuICAgICAgICBjbGVhckNvZmFjdG9yOiBjLmNsZWFyQ29mYWN0b3IsXG4gICAgICAgIGZyb21CeXRlczogYy5mcm9tQnl0ZXMsXG4gICAgICAgIHRvQnl0ZXM6IGMudG9CeXRlcyxcbiAgICB9O1xuICAgIHJldHVybiB7IENVUlZFLCBjdXJ2ZU9wdHMgfTtcbn1cbmZ1bmN0aW9uIF9lY2RzYV9sZWdhY3lfb3B0c190b19uZXcoYykge1xuICAgIGNvbnN0IHsgQ1VSVkUsIGN1cnZlT3B0cyB9ID0gX3dlaWVyc3RyYXNzX2xlZ2FjeV9vcHRzX3RvX25ldyhjKTtcbiAgICBjb25zdCBlY2RzYU9wdHMgPSB7XG4gICAgICAgIGhtYWM6IGMuaG1hYyxcbiAgICAgICAgcmFuZG9tQnl0ZXM6IGMucmFuZG9tQnl0ZXMsXG4gICAgICAgIGxvd1M6IGMubG93UyxcbiAgICAgICAgYml0czJpbnQ6IGMuYml0czJpbnQsXG4gICAgICAgIGJpdHMyaW50X21vZE46IGMuYml0czJpbnRfbW9kTixcbiAgICB9O1xuICAgIHJldHVybiB7IENVUlZFLCBjdXJ2ZU9wdHMsIGhhc2g6IGMuaGFzaCwgZWNkc2FPcHRzIH07XG59XG5leHBvcnQgZnVuY3Rpb24gX2xlZ2FjeUhlbHBlckVxdWF0KEZwLCBhLCBiKSB7XG4gICAgLyoqXG4gICAgICogecKyID0geMKzICsgYXggKyBiOiBTaG9ydCB3ZWllcnN0cmFzcyBjdXJ2ZSBmb3JtdWxhLiBUYWtlcyB4LCByZXR1cm5zIHnCsi5cbiAgICAgKiBAcmV0dXJucyB5wrJcbiAgICAgKi9cbiAgICBmdW5jdGlvbiB3ZWllcnN0cmFzc0VxdWF0aW9uKHgpIHtcbiAgICAgICAgY29uc3QgeDIgPSBGcC5zcXIoeCk7IC8vIHggKiB4XG4gICAgICAgIGNvbnN0IHgzID0gRnAubXVsKHgyLCB4KTsgLy8geMKyICogeFxuICAgICAgICByZXR1cm4gRnAuYWRkKEZwLmFkZCh4MywgRnAubXVsKHgsIGEpKSwgYik7IC8vIHjCsyArIGEgKiB4ICsgYlxuICAgIH1cbiAgICByZXR1cm4gd2VpZXJzdHJhc3NFcXVhdGlvbjtcbn1cbmZ1bmN0aW9uIF93ZWllcnN0cmFzc19uZXdfb3V0cHV0X3RvX2xlZ2FjeShjLCBQb2ludCkge1xuICAgIGNvbnN0IHsgRnAsIEZuIH0gPSBQb2ludDtcbiAgICBmdW5jdGlvbiBpc1dpdGhpbkN1cnZlT3JkZXIobnVtKSB7XG4gICAgICAgIHJldHVybiBpblJhbmdlKG51bSwgXzFuLCBGbi5PUkRFUik7XG4gICAgfVxuICAgIGNvbnN0IHdlaWVyc3RyYXNzRXF1YXRpb24gPSBfbGVnYWN5SGVscGVyRXF1YXQoRnAsIGMuYSwgYy5iKTtcbiAgICByZXR1cm4gT2JqZWN0LmFzc2lnbih7fSwge1xuICAgICAgICBDVVJWRTogYyxcbiAgICAgICAgUG9pbnQ6IFBvaW50LFxuICAgICAgICBQcm9qZWN0aXZlUG9pbnQ6IFBvaW50LFxuICAgICAgICBub3JtUHJpdmF0ZUtleVRvU2NhbGFyOiAoa2V5KSA9PiBfbm9ybUZuRWxlbWVudChGbiwga2V5KSxcbiAgICAgICAgd2VpZXJzdHJhc3NFcXVhdGlvbixcbiAgICAgICAgaXNXaXRoaW5DdXJ2ZU9yZGVyLFxuICAgIH0pO1xufVxuZnVuY3Rpb24gX2VjZHNhX25ld19vdXRwdXRfdG9fbGVnYWN5KGMsIF9lY2RzYSkge1xuICAgIGNvbnN0IFBvaW50ID0gX2VjZHNhLlBvaW50O1xuICAgIHJldHVybiBPYmplY3QuYXNzaWduKHt9LCBfZWNkc2EsIHtcbiAgICAgICAgUHJvamVjdGl2ZVBvaW50OiBQb2ludCxcbiAgICAgICAgQ1VSVkU6IE9iamVjdC5hc3NpZ24oe30sIGMsIG5MZW5ndGgoUG9pbnQuRm4uT1JERVIsIFBvaW50LkZuLkJJVFMpKSxcbiAgICB9KTtcbn1cbi8vIF9lY2RzYV9sZWdhY3lcbmV4cG9ydCBmdW5jdGlvbiB3ZWllcnN0cmFzcyhjKSB7XG4gICAgY29uc3QgeyBDVVJWRSwgY3VydmVPcHRzLCBoYXNoLCBlY2RzYU9wdHMgfSA9IF9lY2RzYV9sZWdhY3lfb3B0c190b19uZXcoYyk7XG4gICAgY29uc3QgUG9pbnQgPSB3ZWllcnN0cmFzc04oQ1VSVkUsIGN1cnZlT3B0cyk7XG4gICAgY29uc3Qgc2lnbnMgPSBlY2RzYShQb2ludCwgaGFzaCwgZWNkc2FPcHRzKTtcbiAgICByZXR1cm4gX2VjZHNhX25ld19vdXRwdXRfdG9fbGVnYWN5KGMsIHNpZ25zKTtcbn1cbi8vIyBzb3VyY2VNYXBwaW5nVVJMPXdlaWVyc3RyYXNzLmpzLm1hcCIsCiAgICAiLyoqXG4gKiBVdGlsaXRpZXMgZm9yIHNob3J0IHdlaWVyc3RyYXNzIGN1cnZlcywgY29tYmluZWQgd2l0aCBub2JsZS1oYXNoZXMuXG4gKiBAbW9kdWxlXG4gKi9cbi8qISBub2JsZS1jdXJ2ZXMgLSBNSVQgTGljZW5zZSAoYykgMjAyMiBQYXVsIE1pbGxlciAocGF1bG1pbGxyLmNvbSkgKi9cbmltcG9ydCB7IHdlaWVyc3RyYXNzIH0gZnJvbSBcIi4vYWJzdHJhY3Qvd2VpZXJzdHJhc3MuanNcIjtcbi8qKiBjb25uZWN0cyBub2JsZS1jdXJ2ZXMgdG8gbm9ibGUtaGFzaGVzICovXG5leHBvcnQgZnVuY3Rpb24gZ2V0SGFzaChoYXNoKSB7XG4gICAgcmV0dXJuIHsgaGFzaCB9O1xufVxuLyoqIEBkZXByZWNhdGVkIHVzZSBuZXcgYHdlaWVyc3RyYXNzKClgIGFuZCBgZWNkc2EoKWAgbWV0aG9kcyAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUN1cnZlKGN1cnZlRGVmLCBkZWZIYXNoKSB7XG4gICAgY29uc3QgY3JlYXRlID0gKGhhc2gpID0+IHdlaWVyc3RyYXNzKHsgLi4uY3VydmVEZWYsIGhhc2g6IGhhc2ggfSk7XG4gICAgcmV0dXJuIHsgLi4uY3JlYXRlKGRlZkhhc2gpLCBjcmVhdGUgfTtcbn1cbi8vIyBzb3VyY2VNYXBwaW5nVVJMPV9zaG9ydHdfdXRpbHMuanMubWFwIiwKICAgICJpbXBvcnQgeyBfdmFsaWRhdGVPYmplY3QsIGFieXRlcywgYnl0ZXNUb051bWJlckJFLCBjb25jYXRCeXRlcywgaXNCeXRlcywgaXNIYXNoLCB1dGY4VG9CeXRlcywgfSBmcm9tIFwiLi4vdXRpbHMuanNcIjtcbmltcG9ydCB7IEZwSW52ZXJ0QmF0Y2gsIG1vZCB9IGZyb20gXCIuL21vZHVsYXIuanNcIjtcbi8vIE9jdGV0IFN0cmVhbSB0byBJbnRlZ2VyLiBcInNwZWNcIiBpbXBsZW1lbnRhdGlvbiBvZiBvczJpcCBpcyAyLjV4IHNsb3dlciB2cyBieXRlc1RvTnVtYmVyQkUuXG5jb25zdCBvczJpcCA9IGJ5dGVzVG9OdW1iZXJCRTtcbi8vIEludGVnZXIgdG8gT2N0ZXQgU3RyZWFtIChudW1iZXJUb0J5dGVzQkUpXG5mdW5jdGlvbiBpMm9zcCh2YWx1ZSwgbGVuZ3RoKSB7XG4gICAgYW51bSh2YWx1ZSk7XG4gICAgYW51bShsZW5ndGgpO1xuICAgIGlmICh2YWx1ZSA8IDAgfHwgdmFsdWUgPj0gMSA8PCAoOCAqIGxlbmd0aCkpXG4gICAgICAgIHRocm93IG5ldyBFcnJvcignaW52YWxpZCBJMk9TUCBpbnB1dDogJyArIHZhbHVlKTtcbiAgICBjb25zdCByZXMgPSBBcnJheS5mcm9tKHsgbGVuZ3RoIH0pLmZpbGwoMCk7XG4gICAgZm9yIChsZXQgaSA9IGxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAgICAgIHJlc1tpXSA9IHZhbHVlICYgMHhmZjtcbiAgICAgICAgdmFsdWUgPj4+PSA4O1xuICAgIH1cbiAgICByZXR1cm4gbmV3IFVpbnQ4QXJyYXkocmVzKTtcbn1cbmZ1bmN0aW9uIHN0cnhvcihhLCBiKSB7XG4gICAgY29uc3QgYXJyID0gbmV3IFVpbnQ4QXJyYXkoYS5sZW5ndGgpO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgYS5sZW5ndGg7IGkrKykge1xuICAgICAgICBhcnJbaV0gPSBhW2ldIF4gYltpXTtcbiAgICB9XG4gICAgcmV0dXJuIGFycjtcbn1cbmZ1bmN0aW9uIGFudW0oaXRlbSkge1xuICAgIGlmICghTnVtYmVyLmlzU2FmZUludGVnZXIoaXRlbSkpXG4gICAgICAgIHRocm93IG5ldyBFcnJvcignbnVtYmVyIGV4cGVjdGVkJyk7XG59XG5mdW5jdGlvbiBub3JtRFNUKERTVCkge1xuICAgIGlmICghaXNCeXRlcyhEU1QpICYmIHR5cGVvZiBEU1QgIT09ICdzdHJpbmcnKVxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0RTVCBtdXN0IGJlIFVpbnQ4QXJyYXkgb3Igc3RyaW5nJyk7XG4gICAgcmV0dXJuIHR5cGVvZiBEU1QgPT09ICdzdHJpbmcnID8gdXRmOFRvQnl0ZXMoRFNUKSA6IERTVDtcbn1cbi8qKlxuICogUHJvZHVjZXMgYSB1bmlmb3JtbHkgcmFuZG9tIGJ5dGUgc3RyaW5nIHVzaW5nIGEgY3J5cHRvZ3JhcGhpYyBoYXNoIGZ1bmN0aW9uIEggdGhhdCBvdXRwdXRzIGIgYml0cy5cbiAqIFtSRkMgOTM4MCA1LjMuMV0oaHR0cHM6Ly93d3cucmZjLWVkaXRvci5vcmcvcmZjL3JmYzkzODAjc2VjdGlvbi01LjMuMSkuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBleHBhbmRfbWVzc2FnZV94bWQobXNnLCBEU1QsIGxlbkluQnl0ZXMsIEgpIHtcbiAgICBhYnl0ZXMobXNnKTtcbiAgICBhbnVtKGxlbkluQnl0ZXMpO1xuICAgIERTVCA9IG5vcm1EU1QoRFNUKTtcbiAgICAvLyBodHRwczovL3d3dy5yZmMtZWRpdG9yLm9yZy9yZmMvcmZjOTM4MCNzZWN0aW9uLTUuMy4zXG4gICAgaWYgKERTVC5sZW5ndGggPiAyNTUpXG4gICAgICAgIERTVCA9IEgoY29uY2F0Qnl0ZXModXRmOFRvQnl0ZXMoJ0gyQy1PVkVSU0laRS1EU1QtJyksIERTVCkpO1xuICAgIGNvbnN0IHsgb3V0cHV0TGVuOiBiX2luX2J5dGVzLCBibG9ja0xlbjogcl9pbl9ieXRlcyB9ID0gSDtcbiAgICBjb25zdCBlbGwgPSBNYXRoLmNlaWwobGVuSW5CeXRlcyAvIGJfaW5fYnl0ZXMpO1xuICAgIGlmIChsZW5JbkJ5dGVzID4gNjU1MzUgfHwgZWxsID4gMjU1KVxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ2V4cGFuZF9tZXNzYWdlX3htZDogaW52YWxpZCBsZW5JbkJ5dGVzJyk7XG4gICAgY29uc3QgRFNUX3ByaW1lID0gY29uY2F0Qnl0ZXMoRFNULCBpMm9zcChEU1QubGVuZ3RoLCAxKSk7XG4gICAgY29uc3QgWl9wYWQgPSBpMm9zcCgwLCByX2luX2J5dGVzKTtcbiAgICBjb25zdCBsX2lfYl9zdHIgPSBpMm9zcChsZW5JbkJ5dGVzLCAyKTsgLy8gbGVuX2luX2J5dGVzX3N0clxuICAgIGNvbnN0IGIgPSBuZXcgQXJyYXkoZWxsKTtcbiAgICBjb25zdCBiXzAgPSBIKGNvbmNhdEJ5dGVzKFpfcGFkLCBtc2csIGxfaV9iX3N0ciwgaTJvc3AoMCwgMSksIERTVF9wcmltZSkpO1xuICAgIGJbMF0gPSBIKGNvbmNhdEJ5dGVzKGJfMCwgaTJvc3AoMSwgMSksIERTVF9wcmltZSkpO1xuICAgIGZvciAobGV0IGkgPSAxOyBpIDw9IGVsbDsgaSsrKSB7XG4gICAgICAgIGNvbnN0IGFyZ3MgPSBbc3RyeG9yKGJfMCwgYltpIC0gMV0pLCBpMm9zcChpICsgMSwgMSksIERTVF9wcmltZV07XG4gICAgICAgIGJbaV0gPSBIKGNvbmNhdEJ5dGVzKC4uLmFyZ3MpKTtcbiAgICB9XG4gICAgY29uc3QgcHNldWRvX3JhbmRvbV9ieXRlcyA9IGNvbmNhdEJ5dGVzKC4uLmIpO1xuICAgIHJldHVybiBwc2V1ZG9fcmFuZG9tX2J5dGVzLnNsaWNlKDAsIGxlbkluQnl0ZXMpO1xufVxuLyoqXG4gKiBQcm9kdWNlcyBhIHVuaWZvcm1seSByYW5kb20gYnl0ZSBzdHJpbmcgdXNpbmcgYW4gZXh0ZW5kYWJsZS1vdXRwdXQgZnVuY3Rpb24gKFhPRikgSC5cbiAqIDEuIFRoZSBjb2xsaXNpb24gcmVzaXN0YW5jZSBvZiBIIE1VU1QgYmUgYXQgbGVhc3QgayBiaXRzLlxuICogMi4gSCBNVVNUIGJlIGFuIFhPRiB0aGF0IGhhcyBiZWVuIHByb3ZlZCBpbmRpZmZlcmVudGlhYmxlIGZyb21cbiAqICAgIGEgcmFuZG9tIG9yYWNsZSB1bmRlciBhIHJlYXNvbmFibGUgY3J5cHRvZ3JhcGhpYyBhc3N1bXB0aW9uLlxuICogW1JGQyA5MzgwIDUuMy4yXShodHRwczovL3d3dy5yZmMtZWRpdG9yLm9yZy9yZmMvcmZjOTM4MCNzZWN0aW9uLTUuMy4yKS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGV4cGFuZF9tZXNzYWdlX3hvZihtc2csIERTVCwgbGVuSW5CeXRlcywgaywgSCkge1xuICAgIGFieXRlcyhtc2cpO1xuICAgIGFudW0obGVuSW5CeXRlcyk7XG4gICAgRFNUID0gbm9ybURTVChEU1QpO1xuICAgIC8vIGh0dHBzOi8vd3d3LnJmYy1lZGl0b3Iub3JnL3JmYy9yZmM5MzgwI3NlY3Rpb24tNS4zLjNcbiAgICAvLyBEU1QgPSBIKCdIMkMtT1ZFUlNJWkUtRFNULScgfHwgYV92ZXJ5X2xvbmdfRFNULCBNYXRoLmNlaWwoKGxlbkluQnl0ZXMgKiBrKSAvIDgpKTtcbiAgICBpZiAoRFNULmxlbmd0aCA+IDI1NSkge1xuICAgICAgICBjb25zdCBka0xlbiA9IE1hdGguY2VpbCgoMiAqIGspIC8gOCk7XG4gICAgICAgIERTVCA9IEguY3JlYXRlKHsgZGtMZW4gfSkudXBkYXRlKHV0ZjhUb0J5dGVzKCdIMkMtT1ZFUlNJWkUtRFNULScpKS51cGRhdGUoRFNUKS5kaWdlc3QoKTtcbiAgICB9XG4gICAgaWYgKGxlbkluQnl0ZXMgPiA2NTUzNSB8fCBEU1QubGVuZ3RoID4gMjU1KVxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ2V4cGFuZF9tZXNzYWdlX3hvZjogaW52YWxpZCBsZW5JbkJ5dGVzJyk7XG4gICAgcmV0dXJuIChILmNyZWF0ZSh7IGRrTGVuOiBsZW5JbkJ5dGVzIH0pXG4gICAgICAgIC51cGRhdGUobXNnKVxuICAgICAgICAudXBkYXRlKGkyb3NwKGxlbkluQnl0ZXMsIDIpKVxuICAgICAgICAvLyAyLiBEU1RfcHJpbWUgPSBEU1QgfHwgSTJPU1AobGVuKERTVCksIDEpXG4gICAgICAgIC51cGRhdGUoRFNUKVxuICAgICAgICAudXBkYXRlKGkyb3NwKERTVC5sZW5ndGgsIDEpKVxuICAgICAgICAuZGlnZXN0KCkpO1xufVxuLyoqXG4gKiBIYXNoZXMgYXJiaXRyYXJ5LWxlbmd0aCBieXRlIHN0cmluZ3MgdG8gYSBsaXN0IG9mIG9uZSBvciBtb3JlIGVsZW1lbnRzIG9mIGEgZmluaXRlIGZpZWxkIEYuXG4gKiBbUkZDIDkzODAgNS4yXShodHRwczovL3d3dy5yZmMtZWRpdG9yLm9yZy9yZmMvcmZjOTM4MCNzZWN0aW9uLTUuMikuXG4gKiBAcGFyYW0gbXNnIGEgYnl0ZSBzdHJpbmcgY29udGFpbmluZyB0aGUgbWVzc2FnZSB0byBoYXNoXG4gKiBAcGFyYW0gY291bnQgdGhlIG51bWJlciBvZiBlbGVtZW50cyBvZiBGIHRvIG91dHB1dFxuICogQHBhcmFtIG9wdGlvbnMgYHtEU1Q6IHN0cmluZywgcDogYmlnaW50LCBtOiBudW1iZXIsIGs6IG51bWJlciwgZXhwYW5kOiAneG1kJyB8ICd4b2YnLCBoYXNoOiBIfWAsIHNlZSBhYm92ZVxuICogQHJldHVybnMgW3VfMCwgLi4uLCB1Xyhjb3VudCAtIDEpXSwgYSBsaXN0IG9mIGZpZWxkIGVsZW1lbnRzLlxuICovXG5leHBvcnQgZnVuY3Rpb24gaGFzaF90b19maWVsZChtc2csIGNvdW50LCBvcHRpb25zKSB7XG4gICAgX3ZhbGlkYXRlT2JqZWN0KG9wdGlvbnMsIHtcbiAgICAgICAgcDogJ2JpZ2ludCcsXG4gICAgICAgIG06ICdudW1iZXInLFxuICAgICAgICBrOiAnbnVtYmVyJyxcbiAgICAgICAgaGFzaDogJ2Z1bmN0aW9uJyxcbiAgICB9KTtcbiAgICBjb25zdCB7IHAsIGssIG0sIGhhc2gsIGV4cGFuZCwgRFNUIH0gPSBvcHRpb25zO1xuICAgIGlmICghaXNIYXNoKG9wdGlvbnMuaGFzaCkpXG4gICAgICAgIHRocm93IG5ldyBFcnJvcignZXhwZWN0ZWQgdmFsaWQgaGFzaCcpO1xuICAgIGFieXRlcyhtc2cpO1xuICAgIGFudW0oY291bnQpO1xuICAgIGNvbnN0IGxvZzJwID0gcC50b1N0cmluZygyKS5sZW5ndGg7XG4gICAgY29uc3QgTCA9IE1hdGguY2VpbCgobG9nMnAgKyBrKSAvIDgpOyAvLyBzZWN0aW9uIDUuMSBvZiBpZXRmIGRyYWZ0IGxpbmsgYWJvdmVcbiAgICBjb25zdCBsZW5faW5fYnl0ZXMgPSBjb3VudCAqIG0gKiBMO1xuICAgIGxldCBwcmI7IC8vIHBzZXVkb19yYW5kb21fYnl0ZXNcbiAgICBpZiAoZXhwYW5kID09PSAneG1kJykge1xuICAgICAgICBwcmIgPSBleHBhbmRfbWVzc2FnZV94bWQobXNnLCBEU1QsIGxlbl9pbl9ieXRlcywgaGFzaCk7XG4gICAgfVxuICAgIGVsc2UgaWYgKGV4cGFuZCA9PT0gJ3hvZicpIHtcbiAgICAgICAgcHJiID0gZXhwYW5kX21lc3NhZ2VfeG9mKG1zZywgRFNULCBsZW5faW5fYnl0ZXMsIGssIGhhc2gpO1xuICAgIH1cbiAgICBlbHNlIGlmIChleHBhbmQgPT09ICdfaW50ZXJuYWxfcGFzcycpIHtcbiAgICAgICAgLy8gZm9yIGludGVybmFsIHRlc3RzIG9ubHlcbiAgICAgICAgcHJiID0gbXNnO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdleHBhbmQgbXVzdCBiZSBcInhtZFwiIG9yIFwieG9mXCInKTtcbiAgICB9XG4gICAgY29uc3QgdSA9IG5ldyBBcnJheShjb3VudCk7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBjb3VudDsgaSsrKSB7XG4gICAgICAgIGNvbnN0IGUgPSBuZXcgQXJyYXkobSk7XG4gICAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgbTsgaisrKSB7XG4gICAgICAgICAgICBjb25zdCBlbG1fb2Zmc2V0ID0gTCAqIChqICsgaSAqIG0pO1xuICAgICAgICAgICAgY29uc3QgdHYgPSBwcmIuc3ViYXJyYXkoZWxtX29mZnNldCwgZWxtX29mZnNldCArIEwpO1xuICAgICAgICAgICAgZVtqXSA9IG1vZChvczJpcCh0diksIHApO1xuICAgICAgICB9XG4gICAgICAgIHVbaV0gPSBlO1xuICAgIH1cbiAgICByZXR1cm4gdTtcbn1cbmV4cG9ydCBmdW5jdGlvbiBpc29nZW55TWFwKGZpZWxkLCBtYXApIHtcbiAgICAvLyBNYWtlIHNhbWUgb3JkZXIgYXMgaW4gc3BlY1xuICAgIGNvbnN0IGNvZWZmID0gbWFwLm1hcCgoaSkgPT4gQXJyYXkuZnJvbShpKS5yZXZlcnNlKCkpO1xuICAgIHJldHVybiAoeCwgeSkgPT4ge1xuICAgICAgICBjb25zdCBbeG4sIHhkLCB5biwgeWRdID0gY29lZmYubWFwKCh2YWwpID0+IHZhbC5yZWR1Y2UoKGFjYywgaSkgPT4gZmllbGQuYWRkKGZpZWxkLm11bChhY2MsIHgpLCBpKSkpO1xuICAgICAgICAvLyA2LjYuM1xuICAgICAgICAvLyBFeGNlcHRpb25hbCBjYXNlcyBvZiBpc29fbWFwIGFyZSBpbnB1dHMgdGhhdCBjYXVzZSB0aGUgZGVub21pbmF0b3Igb2ZcbiAgICAgICAgLy8gZWl0aGVyIHJhdGlvbmFsIGZ1bmN0aW9uIHRvIGV2YWx1YXRlIHRvIHplcm87IHN1Y2ggY2FzZXMgTVVTVCByZXR1cm5cbiAgICAgICAgLy8gdGhlIGlkZW50aXR5IHBvaW50IG9uIEUuXG4gICAgICAgIGNvbnN0IFt4ZF9pbnYsIHlkX2ludl0gPSBGcEludmVydEJhdGNoKGZpZWxkLCBbeGQsIHlkXSwgdHJ1ZSk7XG4gICAgICAgIHggPSBmaWVsZC5tdWwoeG4sIHhkX2ludik7IC8vIHhOdW0gLyB4RGVuXG4gICAgICAgIHkgPSBmaWVsZC5tdWwoeSwgZmllbGQubXVsKHluLCB5ZF9pbnYpKTsgLy8geSAqICh5TnVtIC8geURldilcbiAgICAgICAgcmV0dXJuIHsgeCwgeSB9O1xuICAgIH07XG59XG5leHBvcnQgY29uc3QgX0RTVF9zY2FsYXIgPSB1dGY4VG9CeXRlcygnSGFzaFRvU2NhbGFyLScpO1xuLyoqIENyZWF0ZXMgaGFzaC10by1jdXJ2ZSBtZXRob2RzIGZyb20gRUMgUG9pbnQgYW5kIG1hcFRvQ3VydmUgZnVuY3Rpb24uIFNlZSB7QGxpbmsgSDJDSGFzaGVyfS4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVIYXNoZXIoUG9pbnQsIG1hcFRvQ3VydmUsIGRlZmF1bHRzKSB7XG4gICAgaWYgKHR5cGVvZiBtYXBUb0N1cnZlICE9PSAnZnVuY3Rpb24nKVxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ21hcFRvQ3VydmUoKSBtdXN0IGJlIGRlZmluZWQnKTtcbiAgICBmdW5jdGlvbiBtYXAobnVtKSB7XG4gICAgICAgIHJldHVybiBQb2ludC5mcm9tQWZmaW5lKG1hcFRvQ3VydmUobnVtKSk7XG4gICAgfVxuICAgIGZ1bmN0aW9uIGNsZWFyKGluaXRpYWwpIHtcbiAgICAgICAgY29uc3QgUCA9IGluaXRpYWwuY2xlYXJDb2ZhY3RvcigpO1xuICAgICAgICBpZiAoUC5lcXVhbHMoUG9pbnQuWkVSTykpXG4gICAgICAgICAgICByZXR1cm4gUG9pbnQuWkVSTzsgLy8gemVybyB3aWxsIHRocm93IGluIGFzc2VydFxuICAgICAgICBQLmFzc2VydFZhbGlkaXR5KCk7XG4gICAgICAgIHJldHVybiBQO1xuICAgIH1cbiAgICByZXR1cm4ge1xuICAgICAgICBkZWZhdWx0cyxcbiAgICAgICAgaGFzaFRvQ3VydmUobXNnLCBvcHRpb25zKSB7XG4gICAgICAgICAgICBjb25zdCBvcHRzID0gT2JqZWN0LmFzc2lnbih7fSwgZGVmYXVsdHMsIG9wdGlvbnMpO1xuICAgICAgICAgICAgY29uc3QgdSA9IGhhc2hfdG9fZmllbGQobXNnLCAyLCBvcHRzKTtcbiAgICAgICAgICAgIGNvbnN0IHUwID0gbWFwKHVbMF0pO1xuICAgICAgICAgICAgY29uc3QgdTEgPSBtYXAodVsxXSk7XG4gICAgICAgICAgICByZXR1cm4gY2xlYXIodTAuYWRkKHUxKSk7XG4gICAgICAgIH0sXG4gICAgICAgIGVuY29kZVRvQ3VydmUobXNnLCBvcHRpb25zKSB7XG4gICAgICAgICAgICBjb25zdCBvcHRzRHN0ID0gZGVmYXVsdHMuZW5jb2RlRFNUID8geyBEU1Q6IGRlZmF1bHRzLmVuY29kZURTVCB9IDoge307XG4gICAgICAgICAgICBjb25zdCBvcHRzID0gT2JqZWN0LmFzc2lnbih7fSwgZGVmYXVsdHMsIG9wdHNEc3QsIG9wdGlvbnMpO1xuICAgICAgICAgICAgY29uc3QgdSA9IGhhc2hfdG9fZmllbGQobXNnLCAxLCBvcHRzKTtcbiAgICAgICAgICAgIGNvbnN0IHUwID0gbWFwKHVbMF0pO1xuICAgICAgICAgICAgcmV0dXJuIGNsZWFyKHUwKTtcbiAgICAgICAgfSxcbiAgICAgICAgLyoqIFNlZSB7QGxpbmsgSDJDSGFzaGVyfSAqL1xuICAgICAgICBtYXBUb0N1cnZlKHNjYWxhcnMpIHtcbiAgICAgICAgICAgIGlmICghQXJyYXkuaXNBcnJheShzY2FsYXJzKSlcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ2V4cGVjdGVkIGFycmF5IG9mIGJpZ2ludHMnKTtcbiAgICAgICAgICAgIGZvciAoY29uc3QgaSBvZiBzY2FsYXJzKVxuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgaSAhPT0gJ2JpZ2ludCcpXG4gICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignZXhwZWN0ZWQgYXJyYXkgb2YgYmlnaW50cycpO1xuICAgICAgICAgICAgcmV0dXJuIGNsZWFyKG1hcChzY2FsYXJzKSk7XG4gICAgICAgIH0sXG4gICAgICAgIC8vIGhhc2hfdG9fc2NhbGFyIGNhbiBwcm9kdWNlIDA6IGh0dHBzOi8vd3d3LnJmYy1lZGl0b3Iub3JnL2VycmF0YS9laWQ4MzkzXG4gICAgICAgIC8vIFJGQyA5MzgwLCBkcmFmdC1pcnRmLWNmcmctYmJzLXNpZ25hdHVyZXMtMDhcbiAgICAgICAgaGFzaFRvU2NhbGFyKG1zZywgb3B0aW9ucykge1xuICAgICAgICAgICAgLy8gQHRzLWlnbm9yZVxuICAgICAgICAgICAgY29uc3QgTiA9IFBvaW50LkZuLk9SREVSO1xuICAgICAgICAgICAgY29uc3Qgb3B0cyA9IE9iamVjdC5hc3NpZ24oe30sIGRlZmF1bHRzLCB7IHA6IE4sIG06IDEsIERTVDogX0RTVF9zY2FsYXIgfSwgb3B0aW9ucyk7XG4gICAgICAgICAgICByZXR1cm4gaGFzaF90b19maWVsZChtc2csIDEsIG9wdHMpWzBdWzBdO1xuICAgICAgICB9LFxuICAgIH07XG59XG4vLyMgc291cmNlTWFwcGluZ1VSTD1oYXNoLXRvLWN1cnZlLmpzLm1hcCIsCiAgICAiLyoqXG4gKiBTRUNHIHNlY3AyNTZrMS4gU2VlIFtwZGZdKGh0dHBzOi8vd3d3LnNlY2cub3JnL3NlYzItdjIucGRmKS5cbiAqXG4gKiBCZWxvbmdzIHRvIEtvYmxpdHogY3VydmVzOiBpdCBoYXMgZWZmaWNpZW50bHktY29tcHV0YWJsZSBHTFYgZW5kb21vcnBoaXNtIM+ILFxuICogY2hlY2sgb3V0IHtAbGluayBFbmRvbW9ycGhpc21PcHRzfS4gU2VlbXMgdG8gYmUgcmlnaWQgKG5vdCBiYWNrZG9vcmVkKS5cbiAqIEBtb2R1bGVcbiAqL1xuLyohIG5vYmxlLWN1cnZlcyAtIE1JVCBMaWNlbnNlIChjKSAyMDIyIFBhdWwgTWlsbGVyIChwYXVsbWlsbHIuY29tKSAqL1xuaW1wb3J0IHsgc2hhMjU2IH0gZnJvbSAnQG5vYmxlL2hhc2hlcy9zaGEyLmpzJztcbmltcG9ydCB7IHJhbmRvbUJ5dGVzIH0gZnJvbSAnQG5vYmxlL2hhc2hlcy91dGlscy5qcyc7XG5pbXBvcnQgeyBjcmVhdGVDdXJ2ZSB9IGZyb20gXCIuL19zaG9ydHdfdXRpbHMuanNcIjtcbmltcG9ydCB7IGNyZWF0ZUhhc2hlciwgaXNvZ2VueU1hcCwgfSBmcm9tIFwiLi9hYnN0cmFjdC9oYXNoLXRvLWN1cnZlLmpzXCI7XG5pbXBvcnQgeyBGaWVsZCwgbWFwSGFzaFRvRmllbGQsIG1vZCwgcG93MiB9IGZyb20gXCIuL2Fic3RyYWN0L21vZHVsYXIuanNcIjtcbmltcG9ydCB7IF9ub3JtRm5FbGVtZW50LCBtYXBUb0N1cnZlU2ltcGxlU1dVLCB9IGZyb20gXCIuL2Fic3RyYWN0L3dlaWVyc3RyYXNzLmpzXCI7XG5pbXBvcnQgeyBieXRlc1RvTnVtYmVyQkUsIGNvbmNhdEJ5dGVzLCBlbnN1cmVCeXRlcywgaW5SYW5nZSwgbnVtYmVyVG9CeXRlc0JFLCB1dGY4VG9CeXRlcywgfSBmcm9tIFwiLi91dGlscy5qc1wiO1xuLy8gU2VlbXMgbGlrZSBnZW5lcmF0b3Igd2FzIHByb2R1Y2VkIGZyb20gc29tZSBzZWVkOlxuLy8gYFBvaW50LkJBU0UubXVsdGlwbHkoUG9pbnQuRm4uaW52KDJuLCBOKSkudG9BZmZpbmUoKS54YFxuLy8gLy8gZ2l2ZXMgc2hvcnQgeCAweDNiNzhjZTU2M2Y4OWEwZWQ5NDE0ZjVhYTI4YWQwZDk2ZDY3OTVmOWM2M25cbmNvbnN0IHNlY3AyNTZrMV9DVVJWRSA9IHtcbiAgICBwOiBCaWdJbnQoJzB4ZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmVmZmZmZmMyZicpLFxuICAgIG46IEJpZ0ludCgnMHhmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZWJhYWVkY2U2YWY0OGEwM2JiZmQyNWU4Y2QwMzY0MTQxJyksXG4gICAgaDogQmlnSW50KDEpLFxuICAgIGE6IEJpZ0ludCgwKSxcbiAgICBiOiBCaWdJbnQoNyksXG4gICAgR3g6IEJpZ0ludCgnMHg3OWJlNjY3ZWY5ZGNiYmFjNTVhMDYyOTVjZTg3MGIwNzAyOWJmY2RiMmRjZTI4ZDk1OWYyODE1YjE2ZjgxNzk4JyksXG4gICAgR3k6IEJpZ0ludCgnMHg0ODNhZGE3NzI2YTNjNDY1NWRhNGZiZmMwZTExMDhhOGZkMTdiNDQ4YTY4NTU0MTk5YzQ3ZDA4ZmZiMTBkNGI4JyksXG59O1xuY29uc3Qgc2VjcDI1NmsxX0VORE8gPSB7XG4gICAgYmV0YTogQmlnSW50KCcweDdhZTk2YTJiNjU3YzA3MTA2ZTY0NDc5ZWFjMzQzNGU5OWNmMDQ5NzUxMmY1ODk5NWMxMzk2YzI4NzE5NTAxZWUnKSxcbiAgICBiYXNpc2VzOiBbXG4gICAgICAgIFtCaWdJbnQoJzB4MzA4NmQyMjFhN2Q0NmJjZGU4NmM5MGU0OTI4NGViMTUnKSwgLUJpZ0ludCgnMHhlNDQzN2VkNjAxMGU4ODI4NmY1NDdmYTkwYWJmZTRjMycpXSxcbiAgICAgICAgW0JpZ0ludCgnMHgxMTRjYTUwZjdhOGUyZjNmNjU3YzExMDhkOWQ0NGNmZDgnKSwgQmlnSW50KCcweDMwODZkMjIxYTdkNDZiY2RlODZjOTBlNDkyODRlYjE1JyldLFxuICAgIF0sXG59O1xuY29uc3QgXzBuID0gLyogQF9fUFVSRV9fICovIEJpZ0ludCgwKTtcbmNvbnN0IF8xbiA9IC8qIEBfX1BVUkVfXyAqLyBCaWdJbnQoMSk7XG5jb25zdCBfMm4gPSAvKiBAX19QVVJFX18gKi8gQmlnSW50KDIpO1xuLyoqXG4gKiDiiJpuID0gbl4oKHArMSkvNCkgZm9yIGZpZWxkcyBwID0gMyBtb2QgNC4gV2UgdW53cmFwIHRoZSBsb29wIGFuZCBtdWx0aXBseSBiaXQtYnktYml0LlxuICogKFArMW4vNG4pLnRvU3RyaW5nKDIpIHdvdWxkIHByb2R1Y2UgYml0cyBbMjIzeCAxLCAwLCAyMnggMSwgNHggMCwgMTEsIDAwXVxuICovXG5mdW5jdGlvbiBzcXJ0TW9kKHkpIHtcbiAgICBjb25zdCBQID0gc2VjcDI1NmsxX0NVUlZFLnA7XG4gICAgLy8gcHJldHRpZXItaWdub3JlXG4gICAgY29uc3QgXzNuID0gQmlnSW50KDMpLCBfNm4gPSBCaWdJbnQoNiksIF8xMW4gPSBCaWdJbnQoMTEpLCBfMjJuID0gQmlnSW50KDIyKTtcbiAgICAvLyBwcmV0dGllci1pZ25vcmVcbiAgICBjb25zdCBfMjNuID0gQmlnSW50KDIzKSwgXzQ0biA9IEJpZ0ludCg0NCksIF84OG4gPSBCaWdJbnQoODgpO1xuICAgIGNvbnN0IGIyID0gKHkgKiB5ICogeSkgJSBQOyAvLyB4XjMsIDExXG4gICAgY29uc3QgYjMgPSAoYjIgKiBiMiAqIHkpICUgUDsgLy8geF43XG4gICAgY29uc3QgYjYgPSAocG93MihiMywgXzNuLCBQKSAqIGIzKSAlIFA7XG4gICAgY29uc3QgYjkgPSAocG93MihiNiwgXzNuLCBQKSAqIGIzKSAlIFA7XG4gICAgY29uc3QgYjExID0gKHBvdzIoYjksIF8ybiwgUCkgKiBiMikgJSBQO1xuICAgIGNvbnN0IGIyMiA9IChwb3cyKGIxMSwgXzExbiwgUCkgKiBiMTEpICUgUDtcbiAgICBjb25zdCBiNDQgPSAocG93MihiMjIsIF8yMm4sIFApICogYjIyKSAlIFA7XG4gICAgY29uc3QgYjg4ID0gKHBvdzIoYjQ0LCBfNDRuLCBQKSAqIGI0NCkgJSBQO1xuICAgIGNvbnN0IGIxNzYgPSAocG93MihiODgsIF84OG4sIFApICogYjg4KSAlIFA7XG4gICAgY29uc3QgYjIyMCA9IChwb3cyKGIxNzYsIF80NG4sIFApICogYjQ0KSAlIFA7XG4gICAgY29uc3QgYjIyMyA9IChwb3cyKGIyMjAsIF8zbiwgUCkgKiBiMykgJSBQO1xuICAgIGNvbnN0IHQxID0gKHBvdzIoYjIyMywgXzIzbiwgUCkgKiBiMjIpICUgUDtcbiAgICBjb25zdCB0MiA9IChwb3cyKHQxLCBfNm4sIFApICogYjIpICUgUDtcbiAgICBjb25zdCByb290ID0gcG93Mih0MiwgXzJuLCBQKTtcbiAgICBpZiAoIUZwazEuZXFsKEZwazEuc3FyKHJvb3QpLCB5KSlcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdDYW5ub3QgZmluZCBzcXVhcmUgcm9vdCcpO1xuICAgIHJldHVybiByb290O1xufVxuY29uc3QgRnBrMSA9IEZpZWxkKHNlY3AyNTZrMV9DVVJWRS5wLCB7IHNxcnQ6IHNxcnRNb2QgfSk7XG4vKipcbiAqIHNlY3AyNTZrMSBjdXJ2ZSwgRUNEU0EgYW5kIEVDREggbWV0aG9kcy5cbiAqXG4gKiBGaWVsZDogYDJuKioyNTZuIC0gMm4qKjMybiAtIDJuKio5biAtIDJuKio4biAtIDJuKio3biAtIDJuKio2biAtIDJuKio0biAtIDFuYFxuICpcbiAqIEBleGFtcGxlXG4gKiBgYGBqc1xuICogaW1wb3J0IHsgc2VjcDI1NmsxIH0gZnJvbSAnQG5vYmxlL2N1cnZlcy9zZWNwMjU2azEnO1xuICogY29uc3QgeyBzZWNyZXRLZXksIHB1YmxpY0tleSB9ID0gc2VjcDI1NmsxLmtleWdlbigpO1xuICogY29uc3QgbXNnID0gbmV3IFRleHRFbmNvZGVyKCkuZW5jb2RlKCdoZWxsbycpO1xuICogY29uc3Qgc2lnID0gc2VjcDI1NmsxLnNpZ24obXNnLCBzZWNyZXRLZXkpO1xuICogY29uc3QgaXNWYWxpZCA9IHNlY3AyNTZrMS52ZXJpZnkoc2lnLCBtc2csIHB1YmxpY0tleSkgPT09IHRydWU7XG4gKiBgYGBcbiAqL1xuZXhwb3J0IGNvbnN0IHNlY3AyNTZrMSA9IGNyZWF0ZUN1cnZlKHsgLi4uc2VjcDI1NmsxX0NVUlZFLCBGcDogRnBrMSwgbG93UzogdHJ1ZSwgZW5kbzogc2VjcDI1NmsxX0VORE8gfSwgc2hhMjU2KTtcbi8vIFNjaG5vcnIgc2lnbmF0dXJlcyBhcmUgc3VwZXJpb3IgdG8gRUNEU0EgZnJvbSBhYm92ZS4gQmVsb3cgaXMgU2Nobm9yci1zcGVjaWZpYyBCSVAwMzQwIGNvZGUuXG4vLyBodHRwczovL2dpdGh1Yi5jb20vYml0Y29pbi9iaXBzL2Jsb2IvbWFzdGVyL2JpcC0wMzQwLm1lZGlhd2lraVxuLyoqIEFuIG9iamVjdCBtYXBwaW5nIHRhZ3MgdG8gdGhlaXIgdGFnZ2VkIGhhc2ggcHJlZml4IG9mIFtTSEEyNTYodGFnKSB8IFNIQTI1Nih0YWcpXSAqL1xuY29uc3QgVEFHR0VEX0hBU0hfUFJFRklYRVMgPSB7fTtcbmZ1bmN0aW9uIHRhZ2dlZEhhc2godGFnLCAuLi5tZXNzYWdlcykge1xuICAgIGxldCB0YWdQID0gVEFHR0VEX0hBU0hfUFJFRklYRVNbdGFnXTtcbiAgICBpZiAodGFnUCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGNvbnN0IHRhZ0ggPSBzaGEyNTYodXRmOFRvQnl0ZXModGFnKSk7XG4gICAgICAgIHRhZ1AgPSBjb25jYXRCeXRlcyh0YWdILCB0YWdIKTtcbiAgICAgICAgVEFHR0VEX0hBU0hfUFJFRklYRVNbdGFnXSA9IHRhZ1A7XG4gICAgfVxuICAgIHJldHVybiBzaGEyNTYoY29uY2F0Qnl0ZXModGFnUCwgLi4ubWVzc2FnZXMpKTtcbn1cbi8vIEVDRFNBIGNvbXBhY3QgcG9pbnRzIGFyZSAzMy1ieXRlLiBTY2hub3JyIGlzIDMyOiB3ZSBzdHJpcCBmaXJzdCBieXRlIDB4MDIgb3IgMHgwM1xuY29uc3QgcG9pbnRUb0J5dGVzID0gKHBvaW50KSA9PiBwb2ludC50b0J5dGVzKHRydWUpLnNsaWNlKDEpO1xuY29uc3QgUG9pbnRrMSA9IC8qIEBfX1BVUkVfXyAqLyAoKCkgPT4gc2VjcDI1NmsxLlBvaW50KSgpO1xuY29uc3QgaGFzRXZlbiA9ICh5KSA9PiB5ICUgXzJuID09PSBfMG47XG4vLyBDYWxjdWxhdGUgcG9pbnQsIHNjYWxhciBhbmQgYnl0ZXNcbmZ1bmN0aW9uIHNjaG5vcnJHZXRFeHRQdWJLZXkocHJpdikge1xuICAgIGNvbnN0IHsgRm4sIEJBU0UgfSA9IFBvaW50azE7XG4gICAgY29uc3QgZF8gPSBfbm9ybUZuRWxlbWVudChGbiwgcHJpdik7XG4gICAgY29uc3QgcCA9IEJBU0UubXVsdGlwbHkoZF8pOyAvLyBQID0gZCfii4VHOyAwIDwgZCcgPCBuIGNoZWNrIGlzIGRvbmUgaW5zaWRlXG4gICAgY29uc3Qgc2NhbGFyID0gaGFzRXZlbihwLnkpID8gZF8gOiBGbi5uZWcoZF8pO1xuICAgIHJldHVybiB7IHNjYWxhciwgYnl0ZXM6IHBvaW50VG9CeXRlcyhwKSB9O1xufVxuLyoqXG4gKiBsaWZ0X3ggZnJvbSBCSVAzNDAuIENvbnZlcnQgMzItYnl0ZSB4IGNvb3JkaW5hdGUgdG8gZWxsaXB0aWMgY3VydmUgcG9pbnQuXG4gKiBAcmV0dXJucyB2YWxpZCBwb2ludCBjaGVja2VkIGZvciBiZWluZyBvbi1jdXJ2ZVxuICovXG5mdW5jdGlvbiBsaWZ0X3goeCkge1xuICAgIGNvbnN0IEZwID0gRnBrMTtcbiAgICBpZiAoIUZwLmlzVmFsaWROb3QwKHgpKVxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ2ludmFsaWQgeDogRmFpbCBpZiB4IOKJpSBwJyk7XG4gICAgY29uc3QgeHggPSBGcC5jcmVhdGUoeCAqIHgpO1xuICAgIGNvbnN0IGMgPSBGcC5jcmVhdGUoeHggKiB4ICsgQmlnSW50KDcpKTsgLy8gTGV0IGMgPSB4wrMgKyA3IG1vZCBwLlxuICAgIGxldCB5ID0gRnAuc3FydChjKTsgLy8gTGV0IHkgPSBjXihwKzEpLzQgbW9kIHAuIFNhbWUgYXMgc3FydCgpLlxuICAgIC8vIFJldHVybiB0aGUgdW5pcXVlIHBvaW50IFAgc3VjaCB0aGF0IHgoUCkgPSB4IGFuZFxuICAgIC8vIHkoUCkgPSB5IGlmIHkgbW9kIDIgPSAwIG9yIHkoUCkgPSBwLXkgb3RoZXJ3aXNlLlxuICAgIGlmICghaGFzRXZlbih5KSlcbiAgICAgICAgeSA9IEZwLm5lZyh5KTtcbiAgICBjb25zdCBwID0gUG9pbnRrMS5mcm9tQWZmaW5lKHsgeCwgeSB9KTtcbiAgICBwLmFzc2VydFZhbGlkaXR5KCk7XG4gICAgcmV0dXJuIHA7XG59XG5jb25zdCBudW0gPSBieXRlc1RvTnVtYmVyQkU7XG4vKipcbiAqIENyZWF0ZSB0YWdnZWQgaGFzaCwgY29udmVydCBpdCB0byBiaWdpbnQsIHJlZHVjZSBtb2R1bG8tbi5cbiAqL1xuZnVuY3Rpb24gY2hhbGxlbmdlKC4uLmFyZ3MpIHtcbiAgICByZXR1cm4gUG9pbnRrMS5Gbi5jcmVhdGUobnVtKHRhZ2dlZEhhc2goJ0JJUDAzNDAvY2hhbGxlbmdlJywgLi4uYXJncykpKTtcbn1cbi8qKlxuICogU2Nobm9yciBwdWJsaWMga2V5IGlzIGp1c3QgYHhgIGNvb3JkaW5hdGUgb2YgUG9pbnQgYXMgcGVyIEJJUDM0MC5cbiAqL1xuZnVuY3Rpb24gc2Nobm9yckdldFB1YmxpY0tleShzZWNyZXRLZXkpIHtcbiAgICByZXR1cm4gc2Nobm9yckdldEV4dFB1YktleShzZWNyZXRLZXkpLmJ5dGVzOyAvLyBkJz1pbnQoc2spLiBGYWlsIGlmIGQnPTAgb3IgZCfiiaVuLiBSZXQgYnl0ZXMoZCfii4VHKVxufVxuLyoqXG4gKiBDcmVhdGVzIFNjaG5vcnIgc2lnbmF0dXJlIGFzIHBlciBCSVAzNDAuIFZlcmlmaWVzIGl0c2VsZiBiZWZvcmUgcmV0dXJuaW5nIGFueXRoaW5nLlxuICogYXV4UmFuZCBpcyBvcHRpb25hbCBhbmQgaXMgbm90IHRoZSBzb2xlIHNvdXJjZSBvZiBrIGdlbmVyYXRpb246IGJhZCBDU1BSTkcgd29uJ3QgYmUgZGFuZ2Vyb3VzLlxuICovXG5mdW5jdGlvbiBzY2hub3JyU2lnbihtZXNzYWdlLCBzZWNyZXRLZXksIGF1eFJhbmQgPSByYW5kb21CeXRlcygzMikpIHtcbiAgICBjb25zdCB7IEZuIH0gPSBQb2ludGsxO1xuICAgIGNvbnN0IG0gPSBlbnN1cmVCeXRlcygnbWVzc2FnZScsIG1lc3NhZ2UpO1xuICAgIGNvbnN0IHsgYnl0ZXM6IHB4LCBzY2FsYXI6IGQgfSA9IHNjaG5vcnJHZXRFeHRQdWJLZXkoc2VjcmV0S2V5KTsgLy8gY2hlY2tzIGZvciBpc1dpdGhpbkN1cnZlT3JkZXJcbiAgICBjb25zdCBhID0gZW5zdXJlQnl0ZXMoJ2F1eFJhbmQnLCBhdXhSYW5kLCAzMik7IC8vIEF1eGlsaWFyeSByYW5kb20gZGF0YSBhOiBhIDMyLWJ5dGUgYXJyYXlcbiAgICBjb25zdCB0ID0gRm4udG9CeXRlcyhkIF4gbnVtKHRhZ2dlZEhhc2goJ0JJUDAzNDAvYXV4JywgYSkpKTsgLy8gTGV0IHQgYmUgdGhlIGJ5dGUtd2lzZSB4b3Igb2YgYnl0ZXMoZCkgYW5kIGhhc2gvYXV4KGEpXG4gICAgY29uc3QgcmFuZCA9IHRhZ2dlZEhhc2goJ0JJUDAzNDAvbm9uY2UnLCB0LCBweCwgbSk7IC8vIExldCByYW5kID0gaGFzaC9ub25jZSh0IHx8IGJ5dGVzKFApIHx8IG0pXG4gICAgLy8gTGV0IGsnID0gaW50KHJhbmQpIG1vZCBuLiBGYWlsIGlmIGsnID0gMC4gTGV0IFIgPSBrJ+KLhUdcbiAgICBjb25zdCB7IGJ5dGVzOiByeCwgc2NhbGFyOiBrIH0gPSBzY2hub3JyR2V0RXh0UHViS2V5KHJhbmQpO1xuICAgIGNvbnN0IGUgPSBjaGFsbGVuZ2UocngsIHB4LCBtKTsgLy8gTGV0IGUgPSBpbnQoaGFzaC9jaGFsbGVuZ2UoYnl0ZXMoUikgfHwgYnl0ZXMoUCkgfHwgbSkpIG1vZCBuLlxuICAgIGNvbnN0IHNpZyA9IG5ldyBVaW50OEFycmF5KDY0KTsgLy8gTGV0IHNpZyA9IGJ5dGVzKFIpIHx8IGJ5dGVzKChrICsgZWQpIG1vZCBuKS5cbiAgICBzaWcuc2V0KHJ4LCAwKTtcbiAgICBzaWcuc2V0KEZuLnRvQnl0ZXMoRm4uY3JlYXRlKGsgKyBlICogZCkpLCAzMik7XG4gICAgLy8gSWYgVmVyaWZ5KGJ5dGVzKFApLCBtLCBzaWcpIChzZWUgYmVsb3cpIHJldHVybnMgZmFpbHVyZSwgYWJvcnRcbiAgICBpZiAoIXNjaG5vcnJWZXJpZnkoc2lnLCBtLCBweCkpXG4gICAgICAgIHRocm93IG5ldyBFcnJvcignc2lnbjogSW52YWxpZCBzaWduYXR1cmUgcHJvZHVjZWQnKTtcbiAgICByZXR1cm4gc2lnO1xufVxuLyoqXG4gKiBWZXJpZmllcyBTY2hub3JyIHNpZ25hdHVyZS5cbiAqIFdpbGwgc3dhbGxvdyBlcnJvcnMgJiByZXR1cm4gZmFsc2UgZXhjZXB0IGZvciBpbml0aWFsIHR5cGUgdmFsaWRhdGlvbiBvZiBhcmd1bWVudHMuXG4gKi9cbmZ1bmN0aW9uIHNjaG5vcnJWZXJpZnkoc2lnbmF0dXJlLCBtZXNzYWdlLCBwdWJsaWNLZXkpIHtcbiAgICBjb25zdCB7IEZuLCBCQVNFIH0gPSBQb2ludGsxO1xuICAgIGNvbnN0IHNpZyA9IGVuc3VyZUJ5dGVzKCdzaWduYXR1cmUnLCBzaWduYXR1cmUsIDY0KTtcbiAgICBjb25zdCBtID0gZW5zdXJlQnl0ZXMoJ21lc3NhZ2UnLCBtZXNzYWdlKTtcbiAgICBjb25zdCBwdWIgPSBlbnN1cmVCeXRlcygncHVibGljS2V5JywgcHVibGljS2V5LCAzMik7XG4gICAgdHJ5IHtcbiAgICAgICAgY29uc3QgUCA9IGxpZnRfeChudW0ocHViKSk7IC8vIFAgPSBsaWZ0X3goaW50KHBrKSk7IGZhaWwgaWYgdGhhdCBmYWlsc1xuICAgICAgICBjb25zdCByID0gbnVtKHNpZy5zdWJhcnJheSgwLCAzMikpOyAvLyBMZXQgciA9IGludChzaWdbMDozMl0pOyBmYWlsIGlmIHIg4omlIHAuXG4gICAgICAgIGlmICghaW5SYW5nZShyLCBfMW4sIHNlY3AyNTZrMV9DVVJWRS5wKSlcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgY29uc3QgcyA9IG51bShzaWcuc3ViYXJyYXkoMzIsIDY0KSk7IC8vIExldCBzID0gaW50KHNpZ1szMjo2NF0pOyBmYWlsIGlmIHMg4omlIG4uXG4gICAgICAgIGlmICghaW5SYW5nZShzLCBfMW4sIHNlY3AyNTZrMV9DVVJWRS5uKSlcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgLy8gaW50KGNoYWxsZW5nZShieXRlcyhyKXx8Ynl0ZXMoUCl8fG0pKSVuXG4gICAgICAgIGNvbnN0IGUgPSBjaGFsbGVuZ2UoRm4udG9CeXRlcyhyKSwgcG9pbnRUb0J5dGVzKFApLCBtKTtcbiAgICAgICAgLy8gUiA9IHPii4VHIC0gZeKLhVAsIHdoZXJlIC1lUCA9PSAobi1lKVBcbiAgICAgICAgY29uc3QgUiA9IEJBU0UubXVsdGlwbHlVbnNhZmUocykuYWRkKFAubXVsdGlwbHlVbnNhZmUoRm4ubmVnKGUpKSk7XG4gICAgICAgIGNvbnN0IHsgeCwgeSB9ID0gUi50b0FmZmluZSgpO1xuICAgICAgICAvLyBGYWlsIGlmIGlzX2luZmluaXRlKFIpIC8gbm90IGhhc19ldmVuX3koUikgLyB4KFIpIOKJoCByLlxuICAgICAgICBpZiAoUi5pczAoKSB8fCAhaGFzRXZlbih5KSB8fCB4ICE9PSByKVxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gICAgY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG59XG4vKipcbiAqIFNjaG5vcnIgc2lnbmF0dXJlcyBvdmVyIHNlY3AyNTZrMS5cbiAqIGh0dHBzOi8vZ2l0aHViLmNvbS9iaXRjb2luL2JpcHMvYmxvYi9tYXN0ZXIvYmlwLTAzNDAubWVkaWF3aWtpXG4gKiBAZXhhbXBsZVxuICogYGBganNcbiAqIGltcG9ydCB7IHNjaG5vcnIgfSBmcm9tICdAbm9ibGUvY3VydmVzL3NlY3AyNTZrMSc7XG4gKiBjb25zdCB7IHNlY3JldEtleSwgcHVibGljS2V5IH0gPSBzY2hub3JyLmtleWdlbigpO1xuICogLy8gY29uc3QgcHVibGljS2V5ID0gc2Nobm9yci5nZXRQdWJsaWNLZXkoc2VjcmV0S2V5KTtcbiAqIGNvbnN0IG1zZyA9IG5ldyBUZXh0RW5jb2RlcigpLmVuY29kZSgnaGVsbG8nKTtcbiAqIGNvbnN0IHNpZyA9IHNjaG5vcnIuc2lnbihtc2csIHNlY3JldEtleSk7XG4gKiBjb25zdCBpc1ZhbGlkID0gc2Nobm9yci52ZXJpZnkoc2lnLCBtc2csIHB1YmxpY0tleSk7XG4gKiBgYGBcbiAqL1xuZXhwb3J0IGNvbnN0IHNjaG5vcnIgPSAvKiBAX19QVVJFX18gKi8gKCgpID0+IHtcbiAgICBjb25zdCBzaXplID0gMzI7XG4gICAgY29uc3Qgc2VlZExlbmd0aCA9IDQ4O1xuICAgIGNvbnN0IHJhbmRvbVNlY3JldEtleSA9IChzZWVkID0gcmFuZG9tQnl0ZXMoc2VlZExlbmd0aCkpID0+IHtcbiAgICAgICAgcmV0dXJuIG1hcEhhc2hUb0ZpZWxkKHNlZWQsIHNlY3AyNTZrMV9DVVJWRS5uKTtcbiAgICB9O1xuICAgIC8vIFRPRE86IHJlbW92ZVxuICAgIHNlY3AyNTZrMS51dGlscy5yYW5kb21TZWNyZXRLZXk7XG4gICAgZnVuY3Rpb24ga2V5Z2VuKHNlZWQpIHtcbiAgICAgICAgY29uc3Qgc2VjcmV0S2V5ID0gcmFuZG9tU2VjcmV0S2V5KHNlZWQpO1xuICAgICAgICByZXR1cm4geyBzZWNyZXRLZXksIHB1YmxpY0tleTogc2Nobm9yckdldFB1YmxpY0tleShzZWNyZXRLZXkpIH07XG4gICAgfVxuICAgIHJldHVybiB7XG4gICAgICAgIGtleWdlbixcbiAgICAgICAgZ2V0UHVibGljS2V5OiBzY2hub3JyR2V0UHVibGljS2V5LFxuICAgICAgICBzaWduOiBzY2hub3JyU2lnbixcbiAgICAgICAgdmVyaWZ5OiBzY2hub3JyVmVyaWZ5LFxuICAgICAgICBQb2ludDogUG9pbnRrMSxcbiAgICAgICAgdXRpbHM6IHtcbiAgICAgICAgICAgIHJhbmRvbVNlY3JldEtleTogcmFuZG9tU2VjcmV0S2V5LFxuICAgICAgICAgICAgcmFuZG9tUHJpdmF0ZUtleTogcmFuZG9tU2VjcmV0S2V5LFxuICAgICAgICAgICAgdGFnZ2VkSGFzaCxcbiAgICAgICAgICAgIC8vIFRPRE86IHJlbW92ZVxuICAgICAgICAgICAgbGlmdF94LFxuICAgICAgICAgICAgcG9pbnRUb0J5dGVzLFxuICAgICAgICAgICAgbnVtYmVyVG9CeXRlc0JFLFxuICAgICAgICAgICAgYnl0ZXNUb051bWJlckJFLFxuICAgICAgICAgICAgbW9kLFxuICAgICAgICB9LFxuICAgICAgICBsZW5ndGhzOiB7XG4gICAgICAgICAgICBzZWNyZXRLZXk6IHNpemUsXG4gICAgICAgICAgICBwdWJsaWNLZXk6IHNpemUsXG4gICAgICAgICAgICBwdWJsaWNLZXlIYXNQcmVmaXg6IGZhbHNlLFxuICAgICAgICAgICAgc2lnbmF0dXJlOiBzaXplICogMixcbiAgICAgICAgICAgIHNlZWQ6IHNlZWRMZW5ndGgsXG4gICAgICAgIH0sXG4gICAgfTtcbn0pKCk7XG5jb25zdCBpc29NYXAgPSAvKiBAX19QVVJFX18gKi8gKCgpID0+IGlzb2dlbnlNYXAoRnBrMSwgW1xuICAgIC8vIHhOdW1cbiAgICBbXG4gICAgICAgICcweDhlMzhlMzhlMzhlMzhlMzhlMzhlMzhlMzhlMzhlMzhlMzhlMzhlMzhlMzhlMzhlMzhlMzhlMzhkYWFhYWE4YzcnLFxuICAgICAgICAnMHg3ZDNkNGM4MGJjMzIxZDViOWYzMTVjZWE3ZmQ0NGM1ZDU5NWQyZmMwYmY2M2I5MmRmZmYxMDQ0ZjE3YzY1ODEnLFxuICAgICAgICAnMHg1MzRjMzI4ZDIzZjIzNGU2ZTJhNDEzZGVjYTI1Y2FlY2U0NTA2MTQ0MDM3YzQwMzE0ZWNiZDBiNTNkOWRkMjYyJyxcbiAgICAgICAgJzB4OGUzOGUzOGUzOGUzOGUzOGUzOGUzOGUzOGUzOGUzOGUzOGUzOGUzOGUzOGUzOGUzOGUzOGUzOGRhYWFhYTg4YycsXG4gICAgXSxcbiAgICAvLyB4RGVuXG4gICAgW1xuICAgICAgICAnMHhkMzU3NzExOTNkOTQ5MThhOWNhMzRjY2JiN2I2NDBkZDg2Y2Q0MDk1NDJmODQ4N2Q5ZmU2Yjc0NTc4MWViNDliJyxcbiAgICAgICAgJzB4ZWRhZGM2ZjY0MzgzZGMxZGY3YzRiMmQ1MWI1NDIyNTQwNmQzNmI2NDFmNWU0MWJiYzUyYTU2NjEyYThjNmQxNCcsXG4gICAgICAgICcweDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDEnLCAvLyBMQVNUIDFcbiAgICBdLFxuICAgIC8vIHlOdW1cbiAgICBbXG4gICAgICAgICcweDRiZGExMmY2ODRiZGExMmY2ODRiZGExMmY2ODRiZGExMmY2ODRiZGExMmY2ODRiZGExMmY2ODRiOGUzOGUyM2MnLFxuICAgICAgICAnMHhjNzVlMGMzMmQ1Y2I3YzBmYTlkMGE1NGIxMmEwYTZkNTY0N2FiMDQ2ZDY4NmRhNmZkZmZjOTBmYzIwMWQ3MWEzJyxcbiAgICAgICAgJzB4MjlhNjE5NDY5MWY5MWE3MzcxNTIwOWVmNjUxMmU1NzY3MjI4MzBhMjAxYmUyMDE4YTc2NWU4NWE5ZWNlZTkzMScsXG4gICAgICAgICcweDJmNjg0YmRhMTJmNjg0YmRhMTJmNjg0YmRhMTJmNjg0YmRhMTJmNjg0YmRhMTJmNjg0YmRhMTJmMzhlMzhkODQnLFxuICAgIF0sXG4gICAgLy8geURlblxuICAgIFtcbiAgICAgICAgJzB4ZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmVmZmZmZjkzYicsXG4gICAgICAgICcweDdhMDY1MzRiYjhiZGI0OWZkNWU5ZTY2MzI3MjJjMjk4OTQ2N2MxYmZjOGU4ZDk3OGRmYjQyNWQyNjg1YzI1NzMnLFxuICAgICAgICAnMHg2NDg0YWE3MTY1NDVjYTJjZjNhNzBjM2ZhOGZlMzM3ZTBhM2QyMTE2MmYwZDYyOTlhN2JmODE5MmJmZDJhNzZmJyxcbiAgICAgICAgJzB4MDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMScsIC8vIExBU1QgMVxuICAgIF0sXG5dLm1hcCgoaSkgPT4gaS5tYXAoKGopID0+IEJpZ0ludChqKSkpKSkoKTtcbmNvbnN0IG1hcFNXVSA9IC8qIEBfX1BVUkVfXyAqLyAoKCkgPT4gbWFwVG9DdXJ2ZVNpbXBsZVNXVShGcGsxLCB7XG4gICAgQTogQmlnSW50KCcweDNmODczMWFiZGQ2NjFhZGNhMDhhNTU1OGYwZjVkMjcyZTk1M2QzNjNjYjZmMGU1ZDQwNTQ0N2MwMWE0NDQ1MzMnKSxcbiAgICBCOiBCaWdJbnQoJzE3NzEnKSxcbiAgICBaOiBGcGsxLmNyZWF0ZShCaWdJbnQoJy0xMScpKSxcbn0pKSgpO1xuLyoqIEhhc2hpbmcgLyBlbmNvZGluZyB0byBzZWNwMjU2azEgcG9pbnRzIC8gZmllbGQuIFJGQyA5MzgwIG1ldGhvZHMuICovXG5leHBvcnQgY29uc3Qgc2VjcDI1NmsxX2hhc2hlciA9IC8qIEBfX1BVUkVfXyAqLyAoKCkgPT4gY3JlYXRlSGFzaGVyKHNlY3AyNTZrMS5Qb2ludCwgKHNjYWxhcnMpID0+IHtcbiAgICBjb25zdCB7IHgsIHkgfSA9IG1hcFNXVShGcGsxLmNyZWF0ZShzY2FsYXJzWzBdKSk7XG4gICAgcmV0dXJuIGlzb01hcCh4LCB5KTtcbn0sIHtcbiAgICBEU1Q6ICdzZWNwMjU2azFfWE1EOlNIQS0yNTZfU1NXVV9ST18nLFxuICAgIGVuY29kZURTVDogJ3NlY3AyNTZrMV9YTUQ6U0hBLTI1Nl9TU1dVX05VXycsXG4gICAgcDogRnBrMS5PUkRFUixcbiAgICBtOiAxLFxuICAgIGs6IDEyOCxcbiAgICBleHBhbmQ6ICd4bWQnLFxuICAgIGhhc2g6IHNoYTI1Nixcbn0pKSgpO1xuLyoqIEBkZXByZWNhdGVkIHVzZSBgaW1wb3J0IHsgc2VjcDI1NmsxX2hhc2hlciB9IGZyb20gJ0Bub2JsZS9jdXJ2ZXMvc2VjcDI1NmsxLmpzJztgICovXG5leHBvcnQgY29uc3QgaGFzaFRvQ3VydmUgPSAvKiBAX19QVVJFX18gKi8gKCgpID0+IHNlY3AyNTZrMV9oYXNoZXIuaGFzaFRvQ3VydmUpKCk7XG4vKiogQGRlcHJlY2F0ZWQgdXNlIGBpbXBvcnQgeyBzZWNwMjU2azFfaGFzaGVyIH0gZnJvbSAnQG5vYmxlL2N1cnZlcy9zZWNwMjU2azEuanMnO2AgKi9cbmV4cG9ydCBjb25zdCBlbmNvZGVUb0N1cnZlID0gLyogQF9fUFVSRV9fICovICgoKSA9PiBzZWNwMjU2azFfaGFzaGVyLmVuY29kZVRvQ3VydmUpKCk7XG4vLyMgc291cmNlTWFwcGluZ1VSTD1zZWNwMjU2azEuanMubWFwIgogIF0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQU1PLFNBQVMsWUFBWSxDQUFDLE1BQU0sWUFBWSxPQUFPLE1BQU07QUFBQSxFQUN4RCxJQUFJLE9BQU8sS0FBSyxpQkFBaUI7QUFBQSxJQUM3QixPQUFPLEtBQUssYUFBYSxZQUFZLE9BQU8sSUFBSTtBQUFBLEVBQ3BELE1BQU0sT0FBTyxPQUFPLEVBQUU7QUFBQSxFQUN0QixNQUFNLFdBQVcsT0FBTyxVQUFVO0FBQUEsRUFDbEMsTUFBTSxLQUFLLE9BQVEsU0FBUyxPQUFRLFFBQVE7QUFBQSxFQUM1QyxNQUFNLEtBQUssT0FBTyxRQUFRLFFBQVE7QUFBQSxFQUNsQyxNQUFNLElBQUksT0FBTyxJQUFJO0FBQUEsRUFDckIsTUFBTSxJQUFJLE9BQU8sSUFBSTtBQUFBLEVBQ3JCLEtBQUssVUFB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QUFJLElBQUksRUFBRTtBQUFBLE1BQ2xCLEtBQUssR0FBRyxJQUFJLElBQUksRUFBRTtBQUFBLE1BQ2xCLEtBQUssR0FBRyxJQUFJLElBQUksRUFBRTtBQUFBLE1BQ2xCLEtBQUssR0FBRyxJQUFJLElBQUksRUFBRTtBQUFBLE1BQ2xCLEtBQUssR0FBRyxJQUFJLElBQUksRUFBRTtBQUFBLE1BQ2xCLEtBQUssR0FBRyxJQUFJLEdBQUcsRUFBRTtBQUFBLE1BQ2pCLEtBQUssR0FBRyxJQUFJLElBQUksRUFBRTtBQUFBLE1BQ2xCLEtBQUssR0FBRyxJQUFJLEdBQUcsRUFBRTtBQUFBLE1BQ2pCLEtBQUssR0FBRyxJQUFJLElBQUksRUFBRTtBQUFBLE1BQ2xCLEtBQUssR0FBRyxJQUFJLElBQUksRUFBRTtBQUFBLE1BQ2xCLEtBQUssR0FBRyxJQUFJLElBQUksRUFBRTtBQUFBLE1BQ2xCLEtBQUssR0FBRyxJQUFJLElBQUksRUFBRTtBQUFBLE1BQ2xCLEtBQUssR0FBRyxJQUFJLElBQUksRUFBRTtBQUFBLE1BQ2xCLEtBQUssR0FBRyxJQUFJLElBQUksRUFBRTtBQUFBLE1BQ2xCLEtBQUssR0FBRyxJQUFJLElBQUksRUFBRTtBQUFBLE1BQ2xCLEtBQUssR0FBRyxJQUFJLElBQUksRUFBRTtBQUFBLE1BQ2xCLEtBQUssR0FBRyxJQUFJLElBQUksRUFBRTtBQUFBLE1BQ2xCLEtBQUssR0FBRyxJQUFJLElBQUksRUFBRTtBQUFBLE1BQ2xCLEtBQUssR0FBRyxJQUFJLElBQUksRUFBRTtBQUFBLE1BQ2xCLEtBQUssR0FBRyxJQUFJLElBQUksRUFBRTtBQUFBLE1BQ2xCLEtBQUssR0FBRyxJQUFJLElBQUksRUFBRTtBQUFBLE1BQ2xCLE9BQU8sSUFBSSxNQUFNLElBQUksSUFBSSxFQUFFO0FBQUE7QUFBQSxJQU0vQixHQUFHLENBQUMsT0FBTztBQUFBLE1BQ1AsVUFBVSxLQUFLO0FBQUEsTUFDZixRQUFRLEdBQUcsSUFBSSxHQUFHLElBQUksR0FBRyxPQUFPO0FBQUEsTUFDaEMsUUFBUSxHQUFHLElBQUksR0FBRyxJQUFJLEdBQUcsT0FBTztBQUFBLE1BQ2hDLE1BQVksTUFBUixJQUFzQixNQUFSLElBQXNCLE1BQVIsT0FBVDtBQUFBLE1BQ3ZCLE1BQU0sSUFBSSxNQUFNO0FBQUEsTUFDaEIsTUFBTSxLQUFLLEdBQUcsSUFBSSxNQUFNLEdBQUcsSUFBRztBQUFBLE1BQzlCLElBQUksS0FBSyxHQUFHLElBQUksSUFBSSxFQUFFO0FBQUEsTUFDdEIsSUFBSSxLQUFLLEdBQUcsSUFBSSxJQUFJLEVBQUU7QUFBQSxNQUN0QixJQUFJLEtBQUssR0FBRyxJQUFJLElBQUksRUFBRTtBQUFBLE1BQ3RCLElBQUksS0FBSyxHQUFHLElBQUksSUFBSSxFQUFFO0FBQUEsTUFDdEIsSUFBSSxLQUFLLEdBQUcsSUFBSSxJQUFJLEVBQUU7QUFBQSxNQUN0QixLQUFLLEdBQUcsSUFBSSxJQUFJLEVBQUU7QUFBQSxNQUNsQixLQUFLLEdBQUcsSUFBSSxJQUFJLEVBQUU7QUFBQSxNQUNsQixLQUFLLEdBQUcsSUFBSSxJQUFJLEVBQUU7QUFBQSxNQUNsQixLQUFLLEdBQUcsSUFBSSxJQUFJLEVBQUU7QUFBQSxNQUNsQixJQUFJLEtBQUssR0FBRyxJQUFJLElBQUksRUFBRTtBQUFBLE1BQ3RCLEtBQUssR0FBRyxJQUFJLElBQUksRUFBRTtBQUFBLE1BQ2xCLEtBQUssR0FBRyxJQUFJLElBQUksRUFBRTtBQUFBLE1BQ2xCLEtBQUssR0FBRyxJQUFJLElBQUksRUFBRTtBQUFBLE1BQ2xCLEtBQUssR0FBRyxJQUFJLElBQUksRUFBRTtBQUFBLE1BQ2xCLEtBQUssR0FBRyxJQUFJLElBQUksRUFBRTtBQUFBLE1BQ2xCLEtBQUssR0FBRyxJQUFJLElBQUksRUFBRTtBQUFBLE1BQ2xCLEtBQUssR0FBRyxJQUFJLElBQUksRUFBRTtBQUFBLE1BQ2xCLEtBQUssR0FBRyxJQUFJLElBQUksRUFBRTtBQUFBLE1BQ2xCLEtBQUssR0FBRyxJQUFJLEdBQUcsRUFBRTtBQUFBLE1BQ2pCLEtBQUssR0FBRyxJQUFJLElBQUksRUFBRTtBQUFBLE1BQ2xCLEtBQUssR0FBRyxJQUFJLElBQUksRUFBRTtBQUFBLE1BQ2xCLEtBQUssR0FBRyxJQUFJLElBQUksRUFBRTtBQUFBLE1BQ2xCLEtBQUssR0FBRyxJQUFJLElBQUksRUFBRTtBQUFBLE1BQ2xCLEtBQUssR0FBRyxJQUFJLElBQUksRUFBRTtBQUFBLE1BQ2xCLEtBQUssR0FBRyxJQUFJLElBQUksRUFBRTtBQUFBLE1BQ2xCLEtBQUssR0FBRyxJQUFJLElBQUksRUFBRTtBQUFBLE1BQ2xCLEtBQUssR0FBRyxJQUFJLEdBQUcsRUFBRTtBQUFBLE1BQ2pCLEtBQUssR0FBRyxJQUFJLElBQUksRUFBRTtBQUFBLE1BQ2xCLEtBQUssR0FBRyxJQUFJLElBQUksRUFBRTtBQUFBLE1BQ2xCLEtBQUssR0FBRyxJQUFJLElBQUksRUFBRTtBQUFBLE1BQ2xCLEtBQUssR0FBRyxJQUFJLEdBQUcsRUFBRTtBQUFBLE1BQ2pCLEtBQUssR0FBRyxJQUFJLElBQUksRUFBRTtBQUFBLE1BQ2xCLEtBQUssR0FBRyxJQUFJLElBQUksRUFBRTtBQUFBLE1BQ2xCLEtBQUssR0FBRyxJQUFJLElBQUksRUFBRTtBQUFBLE1BQ2xCLEtBQUssR0FBRyxJQUFJLElBQUksRUFBRTtBQUFBLE1BQ2xCLEtBQUssR0FBRyxJQUFJLElBQUksRUFBRTtBQUFBLE1BQ2xCLEtBQUssR0FBRyxJQUFJLElBQUksRUFBRTtBQUFBLE1BQ2xCLEtBQUssR0FBRyxJQUFJLElBQUksRUFBRTtBQUFBLE1BQ2xCLEtBQUssR0FBRyxJQUFJLElBQUksRUFBRTtBQUFBLE1BQ2xCLEtBQUssR0FBRyxJQUFJLElBQUksRUFBRTtBQUFBLE1BQ2xCLE9BQU8sSUFBSSxNQUFNLElBQUksSUFBSSxFQUFFO0FBQUE7QUFBQSxJQUUvQixRQUFRLENBQUMsT0FBTztBQUFBLE1BQ1osT0FBTyxLQUFLLElBQUksTUFBTSxPQUFPLENBQUM7QUFBQTtBQUFBLElBRWxDLEdBQUcsR0FBRztBQUFBLE1BQ0YsT0FBTyxLQUFLLE9BQU8sTUFBTSxJQUFJO0FBQUE7QUFBQSxJQVdqQyxRQUFR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QyxPQUFPLEVBQUUsV0FBVyxXQUFXLG9CQUFvQixTQUFTLEVBQUU7QUFBQTtBQUFBLEVBRWxFLE9BQU87QUFBQSxJQUNIO0FBQUEsSUFDQSxjQUFjO0FBQUEsSUFDZCxNQUFNO0FBQUEsSUFDTixRQUFRO0FBQUEsSUFDUixPQUFPO0FBQUEsSUFDUCxPQUFPO0FBQUEsTUFDSDtBQUFBLE1BQ0Esa0JBQWtCO0FBQUEsTUFDbEI7QUFBQSxNQUVBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLElBQ0o7QUFBQSxJQUNBLFNBQVM7QUFBQSxNQUNMLFdBQVc7QUFBQSxNQUNYLFdBQVc7QUFBQSxNQUNYLG9CQUFvQjtBQUFBLE1BQ3BCLFdBQVcsT0FBTztBQUFBLE1BQ2xCLE1BQU07QUFBQSxJQUNWO0FBQUEsRUFDSjtBQUFBLEdBQ0Q7QUFDSCxJQUFNLDBCQUEwQixNQUFNLFdBQVcsTUFBTTtBQUFBLEVBRW5EO0FBQUEsSUFDSTtBQUFBLElBQ0E7QUFBQSxJQUNBO0FBQUEsSUFDQTtBQUFBLEVBQ0o7QUFBQSxFQUVBO0FBQUEsSUFDSTtBQUFBLElBQ0E7QUFBQSxJQUNBO0FBQUEsRUFDSjtBQUFBLEVBRUE7QUFBQSxJQUNJO0FBQUEsSUFDQTtBQUFBLElBQ0E7QUFBQSxJQUNBO0FBQUEsRUFDSjtBQUFBLEVBRUE7QUFBQSxJQUNJO0FBQUEsSUFDQTtBQUFBLElBQ0E7QUFBQSxJQUNBO0FBQUEsRUFDSjtBQUNKLEVBQUUsSUFBSSxDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsTUFBTSxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRztBQUN4QyxJQUFNLDBCQUEwQixNQUFNLG9CQUFvQixNQUFNO0FBQUEsRUFDNUQsR0FBRyxPQUFPLG9FQUFvRTtBQUFBLEVBQzlFLEdBQUcsT0FBTyxNQUFNO0FBQUEsRUFDaEIsR0FBRyxLQUFLLE9BQU8sT0FBTyxLQUFLLENBQUM7QUFDaEMsQ0FBQyxHQUFHO0FBRUcsSUFBTSxvQ0FBb0MsTUFBTSxjQUFhLFVBQVUsT0FBTyxDQUFDLFlBQVk7QUFBQSxFQUM5RixRQUFRLEdBQUcsTUFBTSxPQUFPLEtBQUssT0FBTyxRQUFRLEVBQUUsQ0FBQztBQUFBLEVBQy9DLE9BQU8sT0FBTyxHQUFHLENBQUM7QUFBQSxHQUNuQjtBQUFBLEVBQ0MsS0FBSztBQUFBLEVBQ0wsV0FBVztBQUFBLEVBQ1gsR0FBRyxLQUFLO0FBQUEsRUFDUixHQUFHO0FBQUEsRUFDSCxHQUFHO0FBQUEsRUFDSCxRQUFRO0FBQUEsRUFDUixNQUFNO0FBQ1YsQ0FBQyxHQUFHO0FBRUcsSUFBTSwrQkFBK0IsTUFBTSxpQkFBaUIsYUFBYTtBQUV6RSxJQUFNLGlDQUFpQyxNQUFNLGlCQUFpQixlQUFlOyIsCiAgImRlYnVnSWQiOiAiNjFGQ0Y0QUZGRDMzNTk4MzY0NzU2RTIxNjQ3NTZFMjEiLAogICJuYW1lcyI6IFtdCn0=

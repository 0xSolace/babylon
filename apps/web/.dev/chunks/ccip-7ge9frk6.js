import {
  Hash,
  abytes,
  aexists,
  anumber,
  aoutput,
  clean,
  createHasher,
  rotlBH,
  rotlBL,
  rotlSH,
  rotlSL,
  split,
  swap32IfBE,
  toBytes,
  u32
} from "./client-a8gb9g34.js";
import {
  __require,
  __toESM
} from "./client-4jeyk0v8.js";

// ../../../../node_modules/.bun/abitype@1.2.3+0470b0a66942a3da/node_modules/abitype/dist/esm/version.js
var version = "1.2.3";

// ../../../../node_modules/.bun/abitype@1.2.3+0470b0a66942a3da/node_modules/abitype/dist/esm/errors.js
class BaseError extends Error {
  constructor(shortMessage, args = {}) {
    const details = args.cause instanceof BaseError ? args.cause.details : args.cause?.message ? args.cause.message : args.details;
    const docsPath = args.cause instanceof BaseError ? args.cause.docsPath || args.docsPath : args.docsPath;
    const message = [
      shortMessage || "An error occurred.",
      "",
      ...args.metaMessages ? [...args.metaMessages, ""] : [],
      ...docsPath ? [`Docs: https://abitype.dev${docsPath}`] : [],
      ...details ? [`Details: ${details}`] : [],
      `Version: abitype@${version}`
    ].join(`
`);
    super(message);
    Object.defineProperty(this, "details", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: undefined
    });
    Object.defineProperty(this, "docsPath", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: undefined
    });
    Object.defineProperty(this, "metaMessages", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: undefined
    });
    Object.defineProperty(this, "shortMessage", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: undefined
    });
    Object.defineProperty(this, "name", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: "AbiTypeError"
    });
    if (args.cause)
      this.cause = args.cause;
    this.details = details;
    this.docsPath = docsPath;
    this.metaMessages = args.metaMessages;
    this.shortMessage = shortMessage;
  }
}

// ../../../../node_modules/.bun/abitype@1.2.3+0470b0a66942a3da/node_modules/abitype/dist/esm/regex.js
function execTyped(regex, string) {
  const match = regex.exec(string);
  return match?.groups;
}
var bytesRegex = /^bytes([1-9]|1[0-9]|2[0-9]|3[0-2])?$/;
var integerRegex = /^u?int(8|16|24|32|40|48|56|64|72|80|88|96|104|112|120|128|136|144|152|160|168|176|184|192|200|208|216|224|232|240|248|256)?$/;
var isTupleRegex = /^\(.+?\).*?$/;

// ../../../../node_modules/.bun/abitype@1.2.3+0470b0a66942a3da/node_modules/abitype/dist/esm/human-readable/formatAbiParameter.js
var tupleRegex = /^tuple(?<array>(\[(\d*)\])*)$/;
function formatAbiParameter(abiParameter) {
  let type = abiParameter.type;
  if (tupleRegex.test(abiParameter.type) && "components" in abiParameter) {
    type = "(";
    const length = abiParameter.components.length;
    for (let i = 0;i < length; i++) {
      const component = abiParameter.components[i];
      type += formatAbiParameter(component);
      if (i < length - 1)
        type += ", ";
    }
    const result = execTyped(tupleRegex, abiParameter.type);
    type += `)${result?.array || ""}`;
    return formatAbiParameter({
      ...abiParameter,
      type
    });
  }
  if ("indexed" in abiParameter && abiParameter.indexed)
    type = `${type} indexed`;
  if (abiParameter.name)
    return `${type} ${abiParameter.name}`;
  return type;
}

// ../../../../node_modules/.bun/abitype@1.2.3+0470b0a66942a3da/node_modules/abitype/dist/esm/human-readable/formatAbiParameters.js
function formatAbiParameters(abiParameters) {
  let params = "";
  const length = abiParameters.length;
  for (let i = 0;i < length; i++) {
    const abiParameter = abiParameters[i];
    params += formatAbiParameter(abiParameter);
    if (i !== length - 1)
      params += ", ";
  }
  return params;
}

// ../../../../node_modules/.bun/abitype@1.2.3+0470b0a66942a3da/node_modules/abitype/dist/esm/human-readable/formatAbiItem.js
function formatAbiItem(abiItem) {
  if (abiItem.type === "function")
    return `function ${abiItem.name}(${formatAbiParameters(abiItem.inputs)})${abiItem.stateMutability && abiItem.stateMutability !== "nonpayable" ? ` ${abiItem.stateMutability}` : ""}${abiItem.outputs?.length ? ` returns (${formatAbiParameters(abiItem.outputs)})` : ""}`;
  if (abiItem.type === "event")
    return `event ${abiItem.name}(${formatAbiParameters(abiItem.inputs)})`;
  if (abiItem.type === "error")
    return `error ${abiItem.name}(${formatAbiParameters(abiItem.inputs)})`;
  if (abiItem.type === "constructor")
    return `constructor(${formatAbiParameters(abiItem.inputs)})${abiItem.stateMutability === "payable" ? " payable" : ""}`;
  if (abiItem.type === "fallback")
    return `fallback() external${abiItem.stateMutability === "payable" ? " payable" : ""}`;
  return "receive() external payable";
}
// ../../../../node_modules/.bun/abitype@1.2.3+0470b0a66942a3da/node_modules/abitype/dist/esm/human-readable/runtime/signatures.js
var errorSignatureRegex = /^error (?<name>[a-zA-Z$_][a-zA-Z0-9$_]*)\((?<parameters>.*?)\)$/;
function isErrorSignature(signature) {
  return errorSignatureRegex.test(signature);
}
function execErrorSignature(signature) {
  return execTyped(errorSignatureRegex, signature);
}
var eventSignatureRegex = /^event (?<name>[a-zA-Z$_][a-zA-Z0-9$_]*)\((?<parameters>.*?)\)$/;
function isEventSignature(signature) {
  return eventSignatureRegex.test(signature);
}
function execEventSignature(signature) {
  return execTyped(eventSignatureRegex, signature);
}
var functionSignatureRegex = /^function (?<name>[a-zA-Z$_][a-zA-Z0-9$_]*)\((?<parameters>.*?)\)(?: (?<scope>external|public{1}))?(?: (?<stateMutability>pure|view|nonpayable|payable{1}))?(?: returns\s?\((?<returns>.*?)\))?$/;
function isFunctionSignature(signature) {
  return functionSignatureRegex.test(signature);
}
function execFunctionSignature(signature) {
  return execTyped(functionSignatureRegex, signature);
}
var structSignatureRegex = /^struct (?<name>[a-zA-Z$_][a-zA-Z0-9$_]*) \{(?<properties>.*?)\}$/;
function isStructSignature(signature) {
  return structSignatureRegex.test(signature);
}
function execStructSignature(signature) {
  return execTyped(structSignatureRegex, signature);
}
var constructorSignatureRegex = /^constructor\((?<parameters>.*?)\)(?:\s(?<stateMutability>payable{1}))?$/;
function isConstructorSignature(signature) {
  return constructorSignatureRegex.test(signature);
}
function execConstructorSignature(signature) {
  return execTyped(constructorSignatureRegex, signature);
}
var fallbackSignatureRegex = /^fallback\(\) external(?:\s(?<stateMutability>payable{1}))?$/;
function isFallbackSignature(signature) {
  return fallbackSignatureRegex.test(signature);
}
function execFallbackSignature(signature) {
  return execTyped(fallbackSignatureRegex, signature);
}
var receiveSignatureRegex = /^receive\(\) external payable$/;
function isReceiveSignature(signature) {
  return receiveSignatureRegex.test(signature);
}
var modifiers = new Set([
  "memory",
  "indexed",
  "storage",
  "calldata"
]);
var eventModifiers = new Set(["indexed"]);
var functionModifiers = new Set([
  "calldata",
  "memory",
  "storage"
]);

// ../../../../node_modules/.bun/abitype@1.2.3+0470b0a66942a3da/node_modules/abitype/dist/esm/human-readable/errors/abiItem.js
class InvalidAbiItemError extends BaseError {
  constructor({ signature }) {
    super("Failed to parse ABI item.", {
      details: `parseAbiItem(${JSON.stringify(signature, null, 2)})`,
      docsPath: "/api/human#parseabiitem-1"
    });
    Object.defineProperty(this, "name", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: "InvalidAbiItemError"
    });
  }
}

class UnknownTypeError extends BaseError {
  constructor({ type }) {
    super("Unknown type.", {
      metaMessages: [
        `Type "${type}" is not a valid ABI type. Perhaps you forgot to include a struct signature?`
      ]
    });
    Object.defineProperty(this, "name", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: "UnknownTypeError"
    });
  }
}

class UnknownSolidityTypeError extends BaseError {
  constructor({ type }) {
    super("Unknown type.", {
      metaMessages: [`Type "${type}" is not a valid ABI type.`]
    });
    Object.defineProperty(this, "name", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: "UnknownSolidityTypeError"
    });
  }
}

// ../../../../node_modules/.bun/abitype@1.2.3+0470b0a66942a3da/node_modules/abitype/dist/esm/human-readable/errors/abiParameter.js
class InvalidAbiParametersError extends BaseError {
  constructor({ params }) {
    super("Failed to parse ABI parameters.", {
      details: `parseAbiParameters(${JSON.stringify(params, null, 2)})`,
      docsPath: "/api/human#parseabiparameters-1"
    });
    Object.defineProperty(this, "name", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: "InvalidAbiParametersError"
    });
  }
}

class InvalidParameterError extends BaseError {
  constructor({ param }) {
    super("Invalid ABI parameter.", {
      details: param
    });
    Object.defineProperty(this, "name", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: "InvalidParameterError"
    });
  }
}

class SolidityProtectedKeywordError extends BaseError {
  constructor({ param, name }) {
    super("Invalid ABI parameter.", {
      details: param,
      metaMessages: [
        `"${name}" is a protected Solidity keyword. More info: https://docs.soliditylang.org/en/latest/cheatsheet.html`
      ]
    });
    Object.defineProperty(this, "name", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: "SolidityProtectedKeywordError"
    });
  }
}

class InvalidModifierError extends BaseError {
  constructor({ param, type, modifier }) {
    super("Invalid ABI parameter.", {
      details: param,
      metaMessages: [
        `Modifier "${modifier}" not allowed${type ? ` in "${type}" type` : ""}.`
      ]
    });
    Object.defineProperty(this, "name", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: "InvalidModifierError"
    });
  }
}

class InvalidFunctionModifierError extends BaseError {
  constructor({ param, type, modifier }) {
    super("Invalid ABI parameter.", {
      details: param,
      metaMessages: [
        `Modifier "${modifier}" not allowed${type ? ` in "${type}" type` : ""}.`,
        `Data location can only be specified for array, struct, or mapping types, but "${modifier}" was given.`
      ]
    });
    Object.defineProperty(this, "name", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: "InvalidFunctionModifierError"
    });
  }
}

class InvalidAbiTypeParameterError extends BaseError {
  constructor({ abiParameter }) {
    super("Invalid ABI parameter.", {
      details: JSON.stringify(abiParameter, null, 2),
      metaMessages: ["ABI parameter type is invalid."]
    });
    Object.defineProperty(this, "name", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: "InvalidAbiTypeParameterError"
    });
  }
}

// ../../../../node_modules/.bun/abitype@1.2.3+0470b0a66942a3da/node_modules/abitype/dist/esm/human-readable/errors/signature.js
class InvalidSignatureError extends BaseError {
  constructor({ signature, type }) {
    super(`Invalid ${type} signature.`, {
      details: signature
    });
    Object.defineProperty(this, "name", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: "InvalidSignatureError"
    });
  }
}

class UnknownSignatureError extends BaseError {
  constructor({ signature }) {
    super("Unknown signature.", {
      details: signature
    });
    Object.defineProperty(this, "name", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: "UnknownSignatureError"
    });
  }
}

class InvalidStructSignatureError extends BaseError {
  constructor({ signature }) {
    super("Invalid struct signature.", {
      details: signature,
      metaMessages: ["No properties exist."]
    });
    Object.defineProperty(this, "name", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: "InvalidStructSignatureError"
    });
  }
}

// ../../../../node_modules/.bun/abitype@1.2.3+0470b0a66942a3da/node_modules/abitype/dist/esm/human-readable/errors/struct.js
class CircularReferenceError extends BaseError {
  constructor({ type }) {
    super("Circular reference detected.", {
      metaMessages: [`Struct "${type}" is a circular reference.`]
    });
    Object.defineProperty(this, "name", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: "CircularReferenceError"
    });
  }
}

// ../../../../node_modules/.bun/abitype@1.2.3+0470b0a66942a3da/node_modules/abitype/dist/esm/human-readable/errors/splitParameters.js
class InvalidParenthesisError extends BaseError {
  constructor({ current, depth }) {
    super("Unbalanced parentheses.", {
      metaMessages: [
        `"${current.trim()}" has too many ${depth > 0 ? "opening" : "closing"} parentheses.`
      ],
      details: `Depth "${depth}"`
    });
    Object.defineProperty(this, "name", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: "InvalidParenthesisError"
    });
  }
}

// ../../../../node_modules/.bun/abitype@1.2.3+0470b0a66942a3da/node_modules/abitype/dist/esm/human-readable/runtime/cache.js
function getParameterCacheKey(param, type, structs) {
  let structKey = "";
  if (structs)
    for (const struct of Object.entries(structs)) {
      if (!struct)
        continue;
      let propertyKey = "";
      for (const property of struct[1]) {
        propertyKey += `[${property.type}${property.name ? `:${property.name}` : ""}]`;
      }
      structKey += `(${struct[0]}{${propertyKey}})`;
    }
  if (type)
    return `${type}:${param}${structKey}`;
  return `${param}${structKey}`;
}
var parameterCache = new Map([
  ["address", { type: "address" }],
  ["bool", { type: "bool" }],
  ["bytes", { type: "bytes" }],
  ["bytes32", { type: "bytes32" }],
  ["int", { type: "int256" }],
  ["int256", { type: "int256" }],
  ["string", { type: "string" }],
  ["uint", { type: "uint256" }],
  ["uint8", { type: "uint8" }],
  ["uint16", { type: "uint16" }],
  ["uint24", { type: "uint24" }],
  ["uint32", { type: "uint32" }],
  ["uint64", { type: "uint64" }],
  ["uint96", { type: "uint96" }],
  ["uint112", { type: "uint112" }],
  ["uint160", { type: "uint160" }],
  ["uint192", { type: "uint192" }],
  ["uint256", { type: "uint256" }],
  ["address owner", { type: "address", name: "owner" }],
  ["address to", { type: "address", name: "to" }],
  ["bool approved", { type: "bool", name: "approved" }],
  ["bytes _data", { type: "bytes", name: "_data" }],
  ["bytes data", { type: "bytes", name: "data" }],
  ["bytes signature", { type: "bytes", name: "signature" }],
  ["bytes32 hash", { type: "bytes32", name: "hash" }],
  ["bytes32 r", { type: "bytes32", name: "r" }],
  ["bytes32 root", { type: "bytes32", name: "root" }],
  ["bytes32 s", { type: "bytes32", name: "s" }],
  ["string name", { type: "string", name: "name" }],
  ["string symbol", { type: "string", name: "symbol" }],
  ["string tokenURI", { type: "string", name: "tokenURI" }],
  ["uint tokenId", { type: "uint256", name: "tokenId" }],
  ["uint8 v", { type: "uint8", name: "v" }],
  ["uint256 balance", { type: "uint256", name: "balance" }],
  ["uint256 tokenId", { type: "uint256", name: "tokenId" }],
  ["uint256 value", { type: "uint256", name: "value" }],
  [
    "event:address indexed from",
    { type: "address", name: "from", indexed: true }
  ],
  ["event:address indexed to", { type: "address", name: "to", indexed: true }],
  [
    "event:uint indexed tokenId",
    { type: "uint256", name: "tokenId", indexed: true }
  ],
  [
    "event:uint256 indexed tokenId",
    { type: "uint256", name: "tokenId", indexed: true }
  ]
]);

// ../../../../node_modules/.bun/abitype@1.2.3+0470b0a66942a3da/node_modules/abitype/dist/esm/human-readable/runtime/utils.js
function parseSignature(signature, structs = {}) {
  if (isFunctionSignature(signature))
    return parseFunctionSignature(signature, structs);
  if (isEventSignature(signature))
    return parseEventSignature(signature, structs);
  if (isErrorSignature(signature))
    return parseErrorSignature(signature, structs);
  if (isConstructorSignature(signature))
    return parseConstructorSignature(signature, structs);
  if (isFallbackSignature(signature))
    return parseFallbackSignature(signature);
  if (isReceiveSignature(signature))
    return {
      type: "receive",
      stateMutability: "payable"
    };
  throw new UnknownSignatureError({ signature });
}
function parseFunctionSignature(signature, structs = {}) {
  const match = execFunctionSignature(signature);
  if (!match)
    throw new InvalidSignatureError({ signature, type: "function" });
  const inputParams = splitParameters(match.parameters);
  const inputs = [];
  const inputLength = inputParams.length;
  for (let i = 0;i < inputLength; i++) {
    inputs.push(parseAbiParameter(inputParams[i], {
      modifiers: functionModifiers,
      structs,
      type: "function"
    }));
  }
  const outputs = [];
  if (match.returns) {
    const outputParams = splitParameters(match.returns);
    const outputLength = outputParams.length;
    for (let i = 0;i < outputLength; i++) {
      outputs.push(parseAbiParameter(outputParams[i], {
        modifiers: functionModifiers,
        structs,
        type: "function"
      }));
    }
  }
  return {
    name: match.name,
    type: "function",
    stateMutability: match.stateMutability ?? "nonpayable",
    inputs,
    outputs
  };
}
function parseEventSignature(signature, structs = {}) {
  const match = execEventSignature(signature);
  if (!match)
    throw new InvalidSignatureError({ signature, type: "event" });
  const params = splitParameters(match.parameters);
  const abiParameters = [];
  const length = params.length;
  for (let i = 0;i < length; i++)
    abiParameters.push(parseAbiParameter(params[i], {
      modifiers: eventModifiers,
      structs,
      type: "event"
    }));
  return { name: match.name, type: "event", inputs: abiParameters };
}
function parseErrorSignature(signature, structs = {}) {
  const match = execErrorSignature(signature);
  if (!match)
    throw new InvalidSignatureError({ signature, type: "error" });
  const params = splitParameters(match.parameters);
  const abiParameters = [];
  const length = params.length;
  for (let i = 0;i < length; i++)
    abiParameters.push(parseAbiParameter(params[i], { structs, type: "error" }));
  return { name: match.name, type: "error", inputs: abiParameters };
}
function parseConstructorSignature(signature, structs = {}) {
  const match = execConstructorSignature(signature);
  if (!match)
    throw new InvalidSignatureError({ signature, type: "constructor" });
  const params = splitParameters(match.parameters);
  const abiParameters = [];
  const length = params.length;
  for (let i = 0;i < length; i++)
    abiParameters.push(parseAbiParameter(params[i], { structs, type: "constructor" }));
  return {
    type: "constructor",
    stateMutability: match.stateMutability ?? "nonpayable",
    inputs: abiParameters
  };
}
function parseFallbackSignature(signature) {
  const match = execFallbackSignature(signature);
  if (!match)
    throw new InvalidSignatureError({ signature, type: "fallback" });
  return {
    type: "fallback",
    stateMutability: match.stateMutability ?? "nonpayable"
  };
}
var abiParameterWithoutTupleRegex = /^(?<type>[a-zA-Z$_][a-zA-Z0-9$_]*(?:\spayable)?)(?<array>(?:\[\d*?\])+?)?(?:\s(?<modifier>calldata|indexed|memory|storage{1}))?(?:\s(?<name>[a-zA-Z$_][a-zA-Z0-9$_]*))?$/;
var abiParameterWithTupleRegex = /^\((?<type>.+?)\)(?<array>(?:\[\d*?\])+?)?(?:\s(?<modifier>calldata|indexed|memory|storage{1}))?(?:\s(?<name>[a-zA-Z$_][a-zA-Z0-9$_]*))?$/;
var dynamicIntegerRegex = /^u?int$/;
function parseAbiParameter(param, options) {
  const parameterCacheKey = getParameterCacheKey(param, options?.type, options?.structs);
  if (parameterCache.has(parameterCacheKey))
    return parameterCache.get(parameterCacheKey);
  const isTuple = isTupleRegex.test(param);
  const match = execTyped(isTuple ? abiParameterWithTupleRegex : abiParameterWithoutTupleRegex, param);
  if (!match)
    throw new InvalidParameterError({ param });
  if (match.name && isSolidityKeyword(match.name))
    throw new SolidityProtectedKeywordError({ param, name: match.name });
  const name = match.name ? { name: match.name } : {};
  const indexed = match.modifier === "indexed" ? { indexed: true } : {};
  const structs = options?.structs ?? {};
  let type;
  let components = {};
  if (isTuple) {
    type = "tuple";
    const params = splitParameters(match.type);
    const components_ = [];
    const length = params.length;
    for (let i = 0;i < length; i++) {
      components_.push(parseAbiParameter(params[i], { structs }));
    }
    components = { components: components_ };
  } else if (match.type in structs) {
    type = "tuple";
    components = { components: structs[match.type] };
  } else if (dynamicIntegerRegex.test(match.type)) {
    type = `${match.type}256`;
  } else if (match.type === "address payable") {
    type = "address";
  } else {
    type = match.type;
    if (!(options?.type === "struct") && !isSolidityType(type))
      throw new UnknownSolidityTypeError({ type });
  }
  if (match.modifier) {
    if (!options?.modifiers?.has?.(match.modifier))
      throw new InvalidModifierError({
        param,
        type: options?.type,
        modifier: match.modifier
      });
    if (functionModifiers.has(match.modifier) && !isValidDataLocation(type, !!match.array))
      throw new InvalidFunctionModifierError({
        param,
        type: options?.type,
        modifier: match.modifier
      });
  }
  const abiParameter = {
    type: `${type}${match.array ?? ""}`,
    ...name,
    ...indexed,
    ...components
  };
  parameterCache.set(parameterCacheKey, abiParameter);
  return abiParameter;
}
function splitParameters(params, result = [], current = "", depth = 0) {
  const length = params.trim().length;
  for (let i = 0;i < length; i++) {
    const char = params[i];
    const tail = params.slice(i + 1);
    switch (char) {
      case ",":
        return depth === 0 ? splitParameters(tail, [...result, current.trim()]) : splitParameters(tail, result, `${current}${char}`, depth);
      case "(":
        return splitParameters(tail, result, `${current}${char}`, depth + 1);
      case ")":
        return splitParameters(tail, result, `${current}${char}`, depth - 1);
      default:
        return splitParameters(tail, result, `${current}${char}`, depth);
    }
  }
  if (current === "")
    return result;
  if (depth !== 0)
    throw new InvalidParenthesisError({ current, depth });
  result.push(current.trim());
  return result;
}
function isSolidityType(type) {
  return type === "address" || type === "bool" || type === "function" || type === "string" || bytesRegex.test(type) || integerRegex.test(type);
}
var protectedKeywordsRegex = /^(?:after|alias|anonymous|apply|auto|byte|calldata|case|catch|constant|copyof|default|defined|error|event|external|false|final|function|immutable|implements|in|indexed|inline|internal|let|mapping|match|memory|mutable|null|of|override|partial|private|promise|public|pure|reference|relocatable|return|returns|sizeof|static|storage|struct|super|supports|switch|this|true|try|typedef|typeof|var|view|virtual)$/;
function isSolidityKeyword(name) {
  return name === "address" || name === "bool" || name === "function" || name === "string" || name === "tuple" || bytesRegex.test(name) || integerRegex.test(name) || protectedKeywordsRegex.test(name);
}
function isValidDataLocation(type, isArray) {
  return isArray || type === "bytes" || type === "string" || type === "tuple";
}

// ../../../../node_modules/.bun/abitype@1.2.3+0470b0a66942a3da/node_modules/abitype/dist/esm/human-readable/runtime/structs.js
function parseStructs(signatures) {
  const shallowStructs = {};
  const signaturesLength = signatures.length;
  for (let i = 0;i < signaturesLength; i++) {
    const signature = signatures[i];
    if (!isStructSignature(signature))
      continue;
    const match = execStructSignature(signature);
    if (!match)
      throw new InvalidSignatureError({ signature, type: "struct" });
    const properties = match.properties.split(";");
    const components = [];
    const propertiesLength = properties.length;
    for (let k = 0;k < propertiesLength; k++) {
      const property = properties[k];
      const trimmed = property.trim();
      if (!trimmed)
        continue;
      const abiParameter = parseAbiParameter(trimmed, {
        type: "struct"
      });
      components.push(abiParameter);
    }
    if (!components.length)
      throw new InvalidStructSignatureError({ signature });
    shallowStructs[match.name] = components;
  }
  const resolvedStructs = {};
  const entries = Object.entries(shallowStructs);
  const entriesLength = entries.length;
  for (let i = 0;i < entriesLength; i++) {
    const [name, parameters] = entries[i];
    resolvedStructs[name] = resolveStructs(parameters, shallowStructs);
  }
  return resolvedStructs;
}
var typeWithoutTupleRegex = /^(?<type>[a-zA-Z$_][a-zA-Z0-9$_]*)(?<array>(?:\[\d*?\])+?)?$/;
function resolveStructs(abiParameters = [], structs = {}, ancestors = new Set) {
  const components = [];
  const length = abiParameters.length;
  for (let i = 0;i < length; i++) {
    const abiParameter = abiParameters[i];
    const isTuple = isTupleRegex.test(abiParameter.type);
    if (isTuple)
      components.push(abiParameter);
    else {
      const match = execTyped(typeWithoutTupleRegex, abiParameter.type);
      if (!match?.type)
        throw new InvalidAbiTypeParameterError({ abiParameter });
      const { array, type } = match;
      if (type in structs) {
        if (ancestors.has(type))
          throw new CircularReferenceError({ type });
        components.push({
          ...abiParameter,
          type: `tuple${array ?? ""}`,
          components: resolveStructs(structs[type], structs, new Set([...ancestors, type]))
        });
      } else {
        if (isSolidityType(type))
          components.push(abiParameter);
        else
          throw new UnknownTypeError({ type });
      }
    }
  }
  return components;
}

// ../../../../node_modules/.bun/abitype@1.2.3+0470b0a66942a3da/node_modules/abitype/dist/esm/human-readable/parseAbi.js
function parseAbi(signatures) {
  const structs = parseStructs(signatures);
  const abi = [];
  const length = signatures.length;
  for (let i = 0;i < length; i++) {
    const signature = signatures[i];
    if (isStructSignature(signature))
      continue;
    abi.push(parseSignature(signature, structs));
  }
  return abi;
}
// ../../../../node_modules/.bun/abitype@1.2.3+0470b0a66942a3da/node_modules/abitype/dist/esm/human-readable/parseAbiItem.js
function parseAbiItem(signature) {
  let abiItem;
  if (typeof signature === "string")
    abiItem = parseSignature(signature);
  else {
    const structs = parseStructs(signature);
    const length = signature.length;
    for (let i = 0;i < length; i++) {
      const signature_ = signature[i];
      if (isStructSignature(signature_))
        continue;
      abiItem = parseSignature(signature_, structs);
      break;
    }
  }
  if (!abiItem)
    throw new InvalidAbiItemError({ signature });
  return abiItem;
}
// ../../../../node_modules/.bun/abitype@1.2.3+0470b0a66942a3da/node_modules/abitype/dist/esm/human-readable/parseAbiParameters.js
function parseAbiParameters(params) {
  const abiParameters = [];
  if (typeof params === "string") {
    const parameters = splitParameters(params);
    const length = parameters.length;
    for (let i = 0;i < length; i++) {
      abiParameters.push(parseAbiParameter(parameters[i], { modifiers }));
    }
  } else {
    const structs = parseStructs(params);
    const length = params.length;
    for (let i = 0;i < length; i++) {
      const signature = params[i];
      if (isStructSignature(signature))
        continue;
      const parameters = splitParameters(signature);
      const length2 = parameters.length;
      for (let k = 0;k < length2; k++) {
        abiParameters.push(parseAbiParameter(parameters[k], { modifiers, structs }));
      }
    }
  }
  if (abiParameters.length === 0)
    throw new InvalidAbiParametersError({ params });
  return abiParameters;
}
// ../../../../node_modules/.bun/ox@0.11.1+0470b0a66942a3da/node_modules/ox/_esm/core/version.js
var version2 = "0.1.1";

// ../../../../node_modules/.bun/ox@0.11.1+0470b0a66942a3da/node_modules/ox/_esm/core/internal/errors.js
function getVersion() {
  return version2;
}

// ../../../../node_modules/.bun/ox@0.11.1+0470b0a66942a3da/node_modules/ox/_esm/core/Errors.js
class BaseError2 extends Error {
  static setStaticOptions(options) {
    BaseError2.prototype.docsOrigin = options.docsOrigin;
    BaseError2.prototype.showVersion = options.showVersion;
    BaseError2.prototype.version = options.version;
  }
  constructor(shortMessage, options = {}) {
    const details = (() => {
      if (options.cause instanceof BaseError2) {
        if (options.cause.details)
          return options.cause.details;
        if (options.cause.shortMessage)
          return options.cause.shortMessage;
      }
      if (options.cause && "details" in options.cause && typeof options.cause.details === "string")
        return options.cause.details;
      if (options.cause?.message)
        return options.cause.message;
      return options.details;
    })();
    const docsPath = (() => {
      if (options.cause instanceof BaseError2)
        return options.cause.docsPath || options.docsPath;
      return options.docsPath;
    })();
    const docsBaseUrl = options.docsOrigin ?? BaseError2.prototype.docsOrigin;
    const docs = `${docsBaseUrl}${docsPath ?? ""}`;
    const showVersion = Boolean(options.version ?? BaseError2.prototype.showVersion);
    const version3 = options.version ?? BaseError2.prototype.version;
    const message = [
      shortMessage || "An error occurred.",
      ...options.metaMessages ? ["", ...options.metaMessages] : [],
      ...details || docsPath || showVersion ? [
        "",
        details ? `Details: ${details}` : undefined,
        docsPath ? `See: ${docs}` : undefined,
        showVersion ? `Version: ${version3}` : undefined
      ] : []
    ].filter((x) => typeof x === "string").join(`
`);
    super(message, options.cause ? { cause: options.cause } : undefined);
    Object.defineProperty(this, "details", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: undefined
    });
    Object.defineProperty(this, "docs", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: undefined
    });
    Object.defineProperty(this, "docsOrigin", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: undefined
    });
    Object.defineProperty(this, "docsPath", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: undefined
    });
    Object.defineProperty(this, "shortMessage", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: undefined
    });
    Object.defineProperty(this, "showVersion", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: undefined
    });
    Object.defineProperty(this, "version", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: undefined
    });
    Object.defineProperty(this, "cause", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: undefined
    });
    Object.defineProperty(this, "name", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: "BaseError"
    });
    this.cause = options.cause;
    this.details = details;
    this.docs = docs;
    this.docsOrigin = docsBaseUrl;
    this.docsPath = docsPath;
    this.shortMessage = shortMessage;
    this.showVersion = showVersion;
    this.version = version3;
  }
  walk(fn) {
    return walk(this, fn);
  }
}
Object.defineProperty(BaseError2, "defaultStaticOptions", {
  enumerable: true,
  configurable: true,
  writable: true,
  value: {
    docsOrigin: "https://oxlib.sh",
    showVersion: false,
    version: `ox@${getVersion()}`
  }
});
(() => {
  BaseError2.setStaticOptions(BaseError2.defaultStaticOptions);
})();
function walk(err, fn) {
  if (fn?.(err))
    return err;
  if (err && typeof err === "object" && "cause" in err && err.cause)
    return walk(err.cause, fn);
  return fn ? null : err;
}

// ../../../../node_modules/.bun/ox@0.11.1+0470b0a66942a3da/node_modules/ox/_esm/core/internal/bytes.js
function assertSize(bytes, size_) {
  if (size(bytes) > size_)
    throw new SizeOverflowError({
      givenSize: size(bytes),
      maxSize: size_
    });
}
function assertStartOffset(value, start) {
  if (typeof start === "number" && start > 0 && start > size(value) - 1)
    throw new SliceOffsetOutOfBoundsError({
      offset: start,
      position: "start",
      size: size(value)
    });
}
function assertEndOffset(value, start, end) {
  if (typeof start === "number" && typeof end === "number" && size(value) !== end - start) {
    throw new SliceOffsetOutOfBoundsError({
      offset: end,
      position: "end",
      size: size(value)
    });
  }
}
var charCodeMap = {
  zero: 48,
  nine: 57,
  A: 65,
  F: 70,
  a: 97,
  f: 102
};
function charCodeToBase16(char) {
  if (char >= charCodeMap.zero && char <= charCodeMap.nine)
    return char - charCodeMap.zero;
  if (char >= charCodeMap.A && char <= charCodeMap.F)
    return char - (charCodeMap.A - 10);
  if (char >= charCodeMap.a && char <= charCodeMap.f)
    return char - (charCodeMap.a - 10);
  return;
}
function pad(bytes, options = {}) {
  const { dir, size: size2 = 32 } = options;
  if (size2 === 0)
    return bytes;
  if (bytes.length > size2)
    throw new SizeExceedsPaddingSizeError({
      size: bytes.length,
      targetSize: size2,
      type: "Bytes"
    });
  const paddedBytes = new Uint8Array(size2);
  for (let i = 0;i < size2; i++) {
    const padEnd = dir === "right";
    paddedBytes[padEnd ? i : size2 - i - 1] = bytes[padEnd ? i : bytes.length - i - 1];
  }
  return paddedBytes;
}
function trim(value, options = {}) {
  const { dir = "left" } = options;
  let data = value;
  let sliceLength = 0;
  for (let i = 0;i < data.length - 1; i++) {
    if (data[dir === "left" ? i : data.length - i - 1].toString() === "0")
      sliceLength++;
    else
      break;
  }
  data = dir === "left" ? data.slice(sliceLength) : data.slice(0, data.length - sliceLength);
  return data;
}

// ../../../../node_modules/.bun/ox@0.11.1+0470b0a66942a3da/node_modules/ox/_esm/core/internal/hex.js
function assertSize2(hex, size_) {
  if (size2(hex) > size_)
    throw new SizeOverflowError2({
      givenSize: size2(hex),
      maxSize: size_
    });
}
function assertStartOffset2(value, start) {
  if (typeof start === "number" && start > 0 && start > size2(value) - 1)
    throw new SliceOffsetOutOfBoundsError2({
      offset: start,
      position: "start",
      size: size2(value)
    });
}
function assertEndOffset2(value, start, end) {
  if (typeof start === "number" && typeof end === "number" && size2(value) !== end - start) {
    throw new SliceOffsetOutOfBoundsError2({
      offset: end,
      position: "end",
      size: size2(value)
    });
  }
}
function pad2(hex_, options = {}) {
  const { dir, size: size3 = 32 } = options;
  if (size3 === 0)
    return hex_;
  const hex = hex_.replace("0x", "");
  if (hex.length > size3 * 2)
    throw new SizeExceedsPaddingSizeError2({
      size: Math.ceil(hex.length / 2),
      targetSize: size3,
      type: "Hex"
    });
  return `0x${hex[dir === "right" ? "padEnd" : "padStart"](size3 * 2, "0")}`;
}
function trim2(value, options = {}) {
  const { dir = "left" } = options;
  let data = value.replace("0x", "");
  let sliceLength = 0;
  for (let i = 0;i < data.length - 1; i++) {
    if (data[dir === "left" ? i : data.length - i - 1].toString() === "0")
      sliceLength++;
    else
      break;
  }
  data = dir === "left" ? data.slice(sliceLength) : data.slice(0, data.length - sliceLength);
  if (data === "0")
    return "0x";
  if (dir === "right" && data.length % 2 === 1)
    return `0x${data}0`;
  return `0x${data}`;
}

// ../../../../node_modules/.bun/ox@0.11.1+0470b0a66942a3da/node_modules/ox/_esm/core/Json.js
var bigIntSuffix = "#__bigint";
function stringify(value, replacer, space) {
  return JSON.stringify(value, (key, value2) => {
    if (typeof replacer === "function")
      return replacer(key, value2);
    if (typeof value2 === "bigint")
      return value2.toString() + bigIntSuffix;
    return value2;
  }, space);
}

// ../../../../node_modules/.bun/ox@0.11.1+0470b0a66942a3da/node_modules/ox/_esm/core/Bytes.js
var decoder = /* @__PURE__ */ new TextDecoder;
var encoder = /* @__PURE__ */ new TextEncoder;
function assert(value) {
  if (value instanceof Uint8Array)
    return;
  if (!value)
    throw new InvalidBytesTypeError(value);
  if (typeof value !== "object")
    throw new InvalidBytesTypeError(value);
  if (!("BYTES_PER_ELEMENT" in value))
    throw new InvalidBytesTypeError(value);
  if (value.BYTES_PER_ELEMENT !== 1 || value.constructor.name !== "Uint8Array")
    throw new InvalidBytesTypeError(value);
}
function from(value) {
  if (value instanceof Uint8Array)
    return value;
  if (typeof value === "string")
    return fromHex(value);
  return fromArray(value);
}
function fromArray(value) {
  return value instanceof Uint8Array ? value : new Uint8Array(value);
}
function fromHex(value, options = {}) {
  const { size: size3 } = options;
  let hex = value;
  if (size3) {
    assertSize2(value, size3);
    hex = padRight(value, size3);
  }
  let hexString = hex.slice(2);
  if (hexString.length % 2)
    hexString = `0${hexString}`;
  const length = hexString.length / 2;
  const bytes = new Uint8Array(length);
  for (let index = 0, j = 0;index < length; index++) {
    const nibbleLeft = charCodeToBase16(hexString.charCodeAt(j++));
    const nibbleRight = charCodeToBase16(hexString.charCodeAt(j++));
    if (nibbleLeft === undefined || nibbleRight === undefined) {
      throw new BaseError2(`Invalid byte sequence ("${hexString[j - 2]}${hexString[j - 1]}" in "${hexString}").`);
    }
    bytes[index] = nibbleLeft << 4 | nibbleRight;
  }
  return bytes;
}
function fromString(value, options = {}) {
  const { size: size3 } = options;
  const bytes = encoder.encode(value);
  if (typeof size3 === "number") {
    assertSize(bytes, size3);
    return padRight2(bytes, size3);
  }
  return bytes;
}
function padRight2(value, size3) {
  return pad(value, { dir: "right", size: size3 });
}
function size(value) {
  return value.length;
}
function slice(value, start, end, options = {}) {
  const { strict } = options;
  assertStartOffset(value, start);
  const value_ = value.slice(start, end);
  if (strict)
    assertEndOffset(value_, start, end);
  return value_;
}
function toBigInt2(bytes, options = {}) {
  const { size: size3 } = options;
  if (typeof size3 !== "undefined")
    assertSize(bytes, size3);
  const hex = fromBytes(bytes, options);
  return toBigInt(hex, options);
}
function toBoolean(bytes, options = {}) {
  const { size: size3 } = options;
  let bytes_ = bytes;
  if (typeof size3 !== "undefined") {
    assertSize(bytes_, size3);
    bytes_ = trimLeft(bytes_);
  }
  if (bytes_.length > 1 || bytes_[0] > 1)
    throw new InvalidBytesBooleanError(bytes_);
  return Boolean(bytes_[0]);
}
function toNumber2(bytes, options = {}) {
  const { size: size3 } = options;
  if (typeof size3 !== "undefined")
    assertSize(bytes, size3);
  const hex = fromBytes(bytes, options);
  return toNumber(hex, options);
}
function toString(bytes, options = {}) {
  const { size: size3 } = options;
  let bytes_ = bytes;
  if (typeof size3 !== "undefined") {
    assertSize(bytes_, size3);
    bytes_ = trimRight(bytes_);
  }
  return decoder.decode(bytes_);
}
function trimLeft(value) {
  return trim(value, { dir: "left" });
}
function trimRight(value) {
  return trim(value, { dir: "right" });
}
function validate(value) {
  try {
    assert(value);
    return true;
  } catch {
    return false;
  }
}

class InvalidBytesBooleanError extends BaseError2 {
  constructor(bytes) {
    super(`Bytes value \`${bytes}\` is not a valid boolean.`, {
      metaMessages: [
        "The bytes array must contain a single byte of either a `0` or `1` value."
      ]
    });
    Object.defineProperty(this, "name", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: "Bytes.InvalidBytesBooleanError"
    });
  }
}

class InvalidBytesTypeError extends BaseError2 {
  constructor(value) {
    super(`Value \`${typeof value === "object" ? stringify(value) : value}\` of type \`${typeof value}\` is an invalid Bytes value.`, {
      metaMessages: ["Bytes values must be of type `Bytes`."]
    });
    Object.defineProperty(this, "name", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: "Bytes.InvalidBytesTypeError"
    });
  }
}

class SizeOverflowError extends BaseError2 {
  constructor({ givenSize, maxSize }) {
    super(`Size cannot exceed \`${maxSize}\` bytes. Given size: \`${givenSize}\` bytes.`);
    Object.defineProperty(this, "name", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: "Bytes.SizeOverflowError"
    });
  }
}

class SliceOffsetOutOfBoundsError extends BaseError2 {
  constructor({ offset, position, size: size3 }) {
    super(`Slice ${position === "start" ? "starting" : "ending"} at offset \`${offset}\` is out-of-bounds (size: \`${size3}\`).`);
    Object.defineProperty(this, "name", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: "Bytes.SliceOffsetOutOfBoundsError"
    });
  }
}

class SizeExceedsPaddingSizeError extends BaseError2 {
  constructor({ size: size3, targetSize, type }) {
    super(`${type.charAt(0).toUpperCase()}${type.slice(1).toLowerCase()} size (\`${size3}\`) exceeds padding size (\`${targetSize}\`).`);
    Object.defineProperty(this, "name", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: "Bytes.SizeExceedsPaddingSizeError"
    });
  }
}

// ../../../../node_modules/.bun/ox@0.11.1+0470b0a66942a3da/node_modules/ox/_esm/core/Hex.js
var encoder2 = /* @__PURE__ */ new TextEncoder;
var hexes = /* @__PURE__ */ Array.from({ length: 256 }, (_v, i) => i.toString(16).padStart(2, "0"));
function assert2(value, options = {}) {
  const { strict = false } = options;
  if (!value)
    throw new InvalidHexTypeError(value);
  if (typeof value !== "string")
    throw new InvalidHexTypeError(value);
  if (strict) {
    if (!/^0x[0-9a-fA-F]*$/.test(value))
      throw new InvalidHexValueError(value);
  }
  if (!value.startsWith("0x"))
    throw new InvalidHexValueError(value);
}
function concat(...values) {
  return `0x${values.reduce((acc, x) => acc + x.replace("0x", ""), "")}`;
}
function from2(value) {
  if (value instanceof Uint8Array)
    return fromBytes(value);
  if (Array.isArray(value))
    return fromBytes(new Uint8Array(value));
  return value;
}
function fromBoolean(value, options = {}) {
  const hex = `0x${Number(value)}`;
  if (typeof options.size === "number") {
    assertSize2(hex, options.size);
    return padLeft(hex, options.size);
  }
  return hex;
}
function fromBytes(value, options = {}) {
  let string = "";
  for (let i = 0;i < value.length; i++)
    string += hexes[value[i]];
  const hex = `0x${string}`;
  if (typeof options.size === "number") {
    assertSize2(hex, options.size);
    return padRight(hex, options.size);
  }
  return hex;
}
function fromNumber(value, options = {}) {
  const { signed, size: size3 } = options;
  const value_ = BigInt(value);
  let maxValue;
  if (size3) {
    if (signed)
      maxValue = (1n << BigInt(size3) * 8n - 1n) - 1n;
    else
      maxValue = 2n ** (BigInt(size3) * 8n) - 1n;
  } else if (typeof value === "number") {
    maxValue = BigInt(Number.MAX_SAFE_INTEGER);
  }
  const minValue = typeof maxValue === "bigint" && signed ? -maxValue - 1n : 0;
  if (maxValue && value_ > maxValue || value_ < minValue) {
    const suffix = typeof value === "bigint" ? "n" : "";
    throw new IntegerOutOfRangeError({
      max: maxValue ? `${maxValue}${suffix}` : undefined,
      min: `${minValue}${suffix}`,
      signed,
      size: size3,
      value: `${value}${suffix}`
    });
  }
  const stringValue = (signed && value_ < 0 ? BigInt.asUintN(size3 * 8, BigInt(value_)) : value_).toString(16);
  const hex = `0x${stringValue}`;
  if (size3)
    return padLeft(hex, size3);
  return hex;
}
function fromString2(value, options = {}) {
  return fromBytes(encoder2.encode(value), options);
}
function padLeft(value, size3) {
  return pad2(value, { dir: "left", size: size3 });
}
function padRight(value, size3) {
  return pad2(value, { dir: "right", size: size3 });
}
function slice2(value, start, end, options = {}) {
  const { strict } = options;
  assertStartOffset2(value, start);
  const value_ = `0x${value.replace("0x", "").slice((start ?? 0) * 2, (end ?? value.length) * 2)}`;
  if (strict)
    assertEndOffset2(value_, start, end);
  return value_;
}
function size2(value) {
  return Math.ceil((value.length - 2) / 2);
}
function trimLeft2(value) {
  return trim2(value, { dir: "left" });
}
function toBigInt(hex, options = {}) {
  const { signed } = options;
  if (options.size)
    assertSize2(hex, options.size);
  const value = BigInt(hex);
  if (!signed)
    return value;
  const size3 = (hex.length - 2) / 2;
  const max_unsigned = (1n << BigInt(size3) * 8n) - 1n;
  const max_signed = max_unsigned >> 1n;
  if (value <= max_signed)
    return value;
  return value - max_unsigned - 1n;
}
function toNumber(hex, options = {}) {
  const { signed, size: size3 } = options;
  if (!signed && !size3)
    return Number(hex);
  return Number(toBigInt(hex, options));
}
function validate2(value, options = {}) {
  const { strict = false } = options;
  try {
    assert2(value, { strict });
    return true;
  } catch {
    return false;
  }
}

class IntegerOutOfRangeError extends BaseError2 {
  constructor({ max, min, signed, size: size3, value }) {
    super(`Number \`${value}\` is not in safe${size3 ? ` ${size3 * 8}-bit` : ""}${signed ? " signed" : " unsigned"} integer range ${max ? `(\`${min}\` to \`${max}\`)` : `(above \`${min}\`)`}`);
    Object.defineProperty(this, "name", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: "Hex.IntegerOutOfRangeError"
    });
  }
}
class InvalidHexTypeError extends BaseError2 {
  constructor(value) {
    super(`Value \`${typeof value === "object" ? stringify(value) : value}\` of type \`${typeof value}\` is an invalid hex type.`, {
      metaMessages: ['Hex types must be represented as `"0x${string}"`.']
    });
    Object.defineProperty(this, "name", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: "Hex.InvalidHexTypeError"
    });
  }
}

class InvalidHexValueError extends BaseError2 {
  constructor(value) {
    super(`Value \`${value}\` is an invalid hex value.`, {
      metaMessages: [
        'Hex values must start with `"0x"` and contain only hexadecimal characters (0-9, a-f, A-F).'
      ]
    });
    Object.defineProperty(this, "name", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: "Hex.InvalidHexValueError"
    });
  }
}
class SizeOverflowError2 extends BaseError2 {
  constructor({ givenSize, maxSize }) {
    super(`Size cannot exceed \`${maxSize}\` bytes. Given size: \`${givenSize}\` bytes.`);
    Object.defineProperty(this, "name", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: "Hex.SizeOverflowError"
    });
  }
}

class SliceOffsetOutOfBoundsError2 extends BaseError2 {
  constructor({ offset, position, size: size3 }) {
    super(`Slice ${position === "start" ? "starting" : "ending"} at offset \`${offset}\` is out-of-bounds (size: \`${size3}\`).`);
    Object.defineProperty(this, "name", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: "Hex.SliceOffsetOutOfBoundsError"
    });
  }
}

class SizeExceedsPaddingSizeError2 extends BaseError2 {
  constructor({ size: size3, targetSize, type }) {
    super(`${type.charAt(0).toUpperCase()}${type.slice(1).toLowerCase()} size (\`${size3}\`) exceeds padding size (\`${targetSize}\`).`);
    Object.defineProperty(this, "name", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: "Hex.SizeExceedsPaddingSizeError"
    });
  }
}

// ../../../../node_modules/.bun/ox@0.11.1+0470b0a66942a3da/node_modules/ox/_esm/core/Withdrawal.js
function toRpc(withdrawal) {
  return {
    address: withdrawal.address,
    amount: fromNumber(withdrawal.amount),
    index: fromNumber(withdrawal.index),
    validatorIndex: fromNumber(withdrawal.validatorIndex)
  };
}

// ../../../../node_modules/.bun/ox@0.11.1+0470b0a66942a3da/node_modules/ox/_esm/core/BlockOverrides.js
function toRpc2(blockOverrides) {
  return {
    ...typeof blockOverrides.baseFeePerGas === "bigint" && {
      baseFeePerGas: fromNumber(blockOverrides.baseFeePerGas)
    },
    ...typeof blockOverrides.blobBaseFee === "bigint" && {
      blobBaseFee: fromNumber(blockOverrides.blobBaseFee)
    },
    ...typeof blockOverrides.feeRecipient === "string" && {
      feeRecipient: blockOverrides.feeRecipient
    },
    ...typeof blockOverrides.gasLimit === "bigint" && {
      gasLimit: fromNumber(blockOverrides.gasLimit)
    },
    ...typeof blockOverrides.number === "bigint" && {
      number: fromNumber(blockOverrides.number)
    },
    ...typeof blockOverrides.prevRandao === "bigint" && {
      prevRandao: fromNumber(blockOverrides.prevRandao)
    },
    ...typeof blockOverrides.time === "bigint" && {
      time: fromNumber(blockOverrides.time)
    },
    ...blockOverrides.withdrawals && {
      withdrawals: blockOverrides.withdrawals.map(toRpc)
    }
  };
}

// ../../../../node_modules/.bun/viem@2.43.3+0470b0a66942a3da/node_modules/viem/_esm/accounts/utils/parseAccount.js
function parseAccount(account) {
  if (typeof account === "string")
    return { address: account, type: "json-rpc" };
  return account;
}

// ../../../../node_modules/.bun/viem@2.43.3+0470b0a66942a3da/node_modules/viem/_esm/constants/abis.js
var multicall3Abi = [
  {
    inputs: [
      {
        components: [
          {
            name: "target",
            type: "address"
          },
          {
            name: "allowFailure",
            type: "bool"
          },
          {
            name: "callData",
            type: "bytes"
          }
        ],
        name: "calls",
        type: "tuple[]"
      }
    ],
    name: "aggregate3",
    outputs: [
      {
        components: [
          {
            name: "success",
            type: "bool"
          },
          {
            name: "returnData",
            type: "bytes"
          }
        ],
        name: "returnData",
        type: "tuple[]"
      }
    ],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [],
    name: "getCurrentBlockTimestamp",
    outputs: [
      {
        internalType: "uint256",
        name: "timestamp",
        type: "uint256"
      }
    ],
    stateMutability: "view",
    type: "function"
  }
];
var batchGatewayAbi = [
  {
    name: "query",
    type: "function",
    stateMutability: "view",
    inputs: [
      {
        type: "tuple[]",
        name: "queries",
        components: [
          {
            type: "address",
            name: "sender"
          },
          {
            type: "string[]",
            name: "urls"
          },
          {
            type: "bytes",
            name: "data"
          }
        ]
      }
    ],
    outputs: [
      {
        type: "bool[]",
        name: "failures"
      },
      {
        type: "bytes[]",
        name: "responses"
      }
    ]
  },
  {
    name: "HttpError",
    type: "error",
    inputs: [
      {
        type: "uint16",
        name: "status"
      },
      {
        type: "string",
        name: "message"
      }
    ]
  }
];
var universalResolverErrors = [
  {
    inputs: [
      {
        name: "dns",
        type: "bytes"
      }
    ],
    name: "DNSDecodingFailed",
    type: "error"
  },
  {
    inputs: [
      {
        name: "ens",
        type: "string"
      }
    ],
    name: "DNSEncodingFailed",
    type: "error"
  },
  {
    inputs: [],
    name: "EmptyAddress",
    type: "error"
  },
  {
    inputs: [
      {
        name: "status",
        type: "uint16"
      },
      {
        name: "message",
        type: "string"
      }
    ],
    name: "HttpError",
    type: "error"
  },
  {
    inputs: [],
    name: "InvalidBatchGatewayResponse",
    type: "error"
  },
  {
    inputs: [
      {
        name: "errorData",
        type: "bytes"
      }
    ],
    name: "ResolverError",
    type: "error"
  },
  {
    inputs: [
      {
        name: "name",
        type: "bytes"
      },
      {
        name: "resolver",
        type: "address"
      }
    ],
    name: "ResolverNotContract",
    type: "error"
  },
  {
    inputs: [
      {
        name: "name",
        type: "bytes"
      }
    ],
    name: "ResolverNotFound",
    type: "error"
  },
  {
    inputs: [
      {
        name: "primary",
        type: "string"
      },
      {
        name: "primaryAddress",
        type: "bytes"
      }
    ],
    name: "ReverseAddressMismatch",
    type: "error"
  },
  {
    inputs: [
      {
        internalType: "bytes4",
        name: "selector",
        type: "bytes4"
      }
    ],
    name: "UnsupportedResolverProfile",
    type: "error"
  }
];
var universalResolverResolveAbi = [
  ...universalResolverErrors,
  {
    name: "resolveWithGateways",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "name", type: "bytes" },
      { name: "data", type: "bytes" },
      { name: "gateways", type: "string[]" }
    ],
    outputs: [
      { name: "", type: "bytes" },
      { name: "address", type: "address" }
    ]
  }
];
var universalResolverReverseAbi = [
  ...universalResolverErrors,
  {
    name: "reverseWithGateways",
    type: "function",
    stateMutability: "view",
    inputs: [
      { type: "bytes", name: "reverseName" },
      { type: "uint256", name: "coinType" },
      { type: "string[]", name: "gateways" }
    ],
    outputs: [
      { type: "string", name: "resolvedName" },
      { type: "address", name: "resolver" },
      { type: "address", name: "reverseResolver" }
    ]
  }
];
var textResolverAbi = [
  {
    name: "text",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "name", type: "bytes32" },
      { name: "key", type: "string" }
    ],
    outputs: [{ name: "", type: "string" }]
  }
];
var addressResolverAbi = [
  {
    name: "addr",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "name", type: "bytes32" }],
    outputs: [{ name: "", type: "address" }]
  },
  {
    name: "addr",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "name", type: "bytes32" },
      { name: "coinType", type: "uint256" }
    ],
    outputs: [{ name: "", type: "bytes" }]
  }
];
var erc1271Abi = [
  {
    name: "isValidSignature",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "hash", type: "bytes32" },
      { name: "signature", type: "bytes" }
    ],
    outputs: [{ name: "", type: "bytes4" }]
  }
];
var erc6492SignatureValidatorAbi = [
  {
    inputs: [
      {
        name: "_signer",
        type: "address"
      },
      {
        name: "_hash",
        type: "bytes32"
      },
      {
        name: "_signature",
        type: "bytes"
      }
    ],
    stateMutability: "nonpayable",
    type: "constructor"
  },
  {
    inputs: [
      {
        name: "_signer",
        type: "address"
      },
      {
        name: "_hash",
        type: "bytes32"
      },
      {
        name: "_signature",
        type: "bytes"
      }
    ],
    outputs: [
      {
        type: "bool"
      }
    ],
    stateMutability: "nonpayable",
    type: "function",
    name: "isValidSig"
  }
];

// ../../../../node_modules/.bun/viem@2.43.3+0470b0a66942a3da/node_modules/viem/_esm/constants/contract.js
var aggregate3Signature = "0x82ad56cb";

// ../../../../node_modules/.bun/viem@2.43.3+0470b0a66942a3da/node_modules/viem/_esm/constants/contracts.js
var deploylessCallViaBytecodeBytecode = "0x608060405234801561001057600080fd5b5060405161018e38038061018e83398101604081905261002f91610124565b6000808351602085016000f59050803b61004857600080fd5b6000808351602085016000855af16040513d6000823e81610067573d81fd5b3d81f35b634e487b7160e01b600052604160045260246000fd5b600082601f83011261009257600080fd5b81516001600160401b038111156100ab576100ab61006b565b604051601f8201601f19908116603f011681016001600160401b03811182821017156100d9576100d961006b565b6040528181528382016020018510156100f157600080fd5b60005b82811015610110576020818601810151838301820152016100f4565b506000918101602001919091529392505050565b6000806040838503121561013757600080fd5b82516001600160401b0381111561014d57600080fd5b61015985828601610081565b602085015190935090506001600160401b0381111561017757600080fd5b61018385828601610081565b915050925092905056fe";
var deploylessCallViaFactoryBytecode = "0x608060405234801561001057600080fd5b506040516102c03803806102c083398101604081905261002f916101e6565b836001600160a01b03163b6000036100e457600080836001600160a01b03168360405161005c9190610270565b6000604051808303816000865af19150503d8060008114610099576040519150601f19603f3d011682016040523d82523d6000602084013e61009e565b606091505b50915091508115806100b857506001600160a01b0386163b155b156100e1578060405163101bb98d60e01b81526004016100d8919061028c565b60405180910390fd5b50505b6000808451602086016000885af16040513d6000823e81610103573d81fd5b3d81f35b80516001600160a01b038116811461011e57600080fd5b919050565b634e487b7160e01b600052604160045260246000fd5b60005b8381101561015457818101518382015260200161013c565b50506000910152565b600082601f83011261016e57600080fd5b81516001600160401b0381111561018757610187610123565b604051601f8201601f19908116603f011681016001600160401b03811182821017156101b5576101b5610123565b6040528181528382016020018510156101cd57600080fd5b6101de826020830160208701610139565b949350505050565b600080600080608085870312156101fc57600080fd5b61020585610107565b60208601519094506001600160401b0381111561022157600080fd5b61022d8782880161015d565b93505061023c60408601610107565b60608601519092506001600160401b0381111561025857600080fd5b6102648782880161015d565b91505092959194509250565b60008251610282818460208701610139565b9190910192915050565b60208152600082518060208401526102ab816040850160208701610139565b601f01601f1916919091016040019291505056fe";
var erc6492SignatureValidatorByteCode = "0x608060405234801561001057600080fd5b5060405161069438038061069483398101604081905261002f9161051e565b600061003c848484610048565b9050806000526001601ff35b60007f64926492649264926492649264926492649264926492649264926492649264926100748361040c565b036101e7576000606080848060200190518101906100929190610577565b60405192955090935091506000906001600160a01b038516906100b69085906105dd565b6000604051808303816000865af19150503d80600081146100f3576040519150601f19603f3d011682016040523d82523d6000602084013e6100f8565b606091505b50509050876001600160a01b03163b60000361016057806101605760405162461bcd60e51b815260206004820152601e60248201527f5369676e617475726556616c696461746f723a206465706c6f796d656e74000060448201526064015b60405180910390fd5b604051630b135d3f60e11b808252906001600160a01b038a1690631626ba7e90610190908b9087906004016105f9565b602060405180830381865afa1580156101ad573d6000803e3d6000fd5b505050506040513d601f19601f820116820180604052508101906101d19190610633565b6001600160e01b03191614945050505050610405565b6001600160a01b0384163b1561027a57604051630b135d3f60e11b808252906001600160a01b03861690631626ba7e9061022790879087906004016105f9565b602060405180830381865afa158015610244573d6000803e3d6000fd5b505050506040513d601f19601f820116820180604052508101906102689190610633565b6001600160e01b031916149050610405565b81516041146102df5760405162461bcd60e51b815260206004820152603a602482015260008051602061067483398151915260448201527f3a20696e76616c6964207369676e6174757265206c656e6774680000000000006064820152608401610157565b6102e7610425565b5060208201516040808401518451859392600091859190811061030c5761030c61065d565b016020015160f81c9050601b811480159061032b57508060ff16601c14155b1561038c5760405162461bcd60e51b815260206004820152603b602482015260008051602061067483398151915260448201527f3a20696e76616c6964207369676e617475726520762076616c756500000000006064820152608401610157565b60408051600081526020810180835289905260ff83169181019190915260608101849052608081018390526001600160a01b0389169060019060a0016020604051602081039080840390855afa1580156103ea573d6000803e3d6000fd5b505050602060405103516001600160a01b0316149450505050505b9392505050565b600060208251101561041d57600080fd5b508051015190565b60405180606001604052806003906020820280368337509192915050565b6001600160a01b038116811461045857600080fd5b50565b634e487b7160e01b600052604160045260246000fd5b60005b8381101561048c578181015183820152602001610474565b50506000910152565b600082601f8301126104a657600080fd5b81516001600160401b038111156104bf576104bf61045b565b604051601f8201601f19908116603f011681016001600160401b03811182821017156104ed576104ed61045b565b60405281815283820160200185101561050557600080fd5b610516826020830160208701610471565b949350505050565b60008060006060848603121561053357600080fd5b835161053e81610443565b6020850151604086015191945092506001600160401b0381111561056157600080fd5b61056d86828701610495565b9150509250925092565b60008060006060848603121561058c57600080fd5b835161059781610443565b60208501519093506001600160401b038111156105b357600080fd5b6105bf86828701610495565b604086015190935090506001600160401b0381111561056157600080fd5b600082516105ef818460208701610471565b9190910192915050565b828152604060208201526000825180604084015261061e816060850160208701610471565b601f01601f1916919091016060019392505050565b60006020828403121561064557600080fd5b81516001600160e01b03198116811461040557600080fd5b634e487b7160e01b600052603260045260246000fdfe5369676e617475726556616c696461746f72237265636f7665725369676e6572";
var multicall3Bytecode = "0x608060405234801561001057600080fd5b506115b9806100206000396000f3fe6080604052600436106100f35760003560e01c80634d2301cc1161008a578063a8b0574e11610059578063a8b0574e14610325578063bce38bd714610350578063c3077fa914610380578063ee82ac5e146103b2576100f3565b80634d2301cc1461026257806372425d9d1461029f57806382ad56cb146102ca57806386d516e8146102fa576100f3565b80633408e470116100c65780633408e470146101af578063399542e9146101da5780633e64a6961461020c57806342cbb15c14610237576100f3565b80630f28c97d146100f8578063174dea7114610123578063252dba421461015357806327e86d6e14610184575b600080fd5b34801561010457600080fd5b5061010d6103ef565b60405161011a9190610c0a565b60405180910390f35b61013d60048036038101906101389190610c94565b6103f7565b60405161014a9190610e94565b60405180910390f35b61016d60048036038101906101689190610f0c565b610615565b60405161017b92919061101b565b60405180910390f35b34801561019057600080fd5b506101996107ab565b6040516101a69190611064565b60405180910390f35b3480156101bb57600080fd5b506101c46107b7565b6040516101d19190610c0a565b60405180910390f35b6101f460048036038101906101ef91906110ab565b6107bf565b6040516102039392919061110b565b60405180910390f35b34801561021857600080fd5b506102216107e1565b60405161022e9190610c0a565b60405180910390f35b34801561024357600080fd5b5061024c6107e9565b6040516102599190610c0a565b60405180910390f35b34801561026e57600080fd5b50610289600480360381019061028491906111a7565b6107f1565b6040516102969190610c0a565b60405180910390f35b3480156102ab57600080fd5b506102b4610812565b6040516102c19190610c0a565b60405180910390f35b6102e460048036038101906102df919061122a565b61081a565b6040516102f19190610e94565b60405180910390f35b34801561030657600080fd5b5061030f6109e4565b60405161031c9190610c0a565b60405180910390f35b34801561033157600080fd5b5061033a6109ec565b6040516103479190611286565b60405180910390f35b61036a600480360381019061036591906110ab565b6109f4565b6040516103779190610e94565b60405180910390f35b61039a60048036038101906103959190610f0c565b610ba6565b6040516103a99392919061110b565b60405180910390f35b3480156103be57600080fd5b506103d960048036038101906103d491906112cd565b610bca565b6040516103e69190611064565b60405180910390f35b600042905090565b60606000808484905090508067ffffffffffffffff81111561041c5761041b6112fa565b5b60405190808252806020026020018201604052801561045557816020015b610442610bd5565b81526020019060019003908161043a5790505b5092503660005b828110156105c957600085828151811061047957610478611329565b5b6020026020010151905087878381811061049657610495611329565b5b90506020028101906104a89190611367565b925060008360400135905080860195508360000160208101906104cb91906111a7565b73ffffffffffffffffffffffffffffffffffffffff16818580606001906104f2919061138f565b604051610500929190611431565b60006040518083038185875af1925050503d806000811461053d576040519150601f19603f3d011682016040523d82523d6000602084013e610542565b606091505b5083600001846020018290528215151515815250505081516020850135176105bc577f08c379a000000000000000000000000000000000000000000000000000000000600052602060045260176024527f4d756c746963616c6c333a2063616c6c206661696c656400000000000000000060445260846000fd5b826001019250505061045c565b5082341461060c576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401610603906114a7565b60405180910390fd5b50505092915050565b6000606043915060008484905090508067ffffffffffffffff81111561063e5761063d6112fa565b5b60405190808252806020026020018201604052801561067157816020015b606081526020019060019003908161065c5790505b5091503660005b828110156107a157600087878381811061069557610694611329565b5b90506020028101906106a791906114c7565b92508260000160208101906106bc91906111a7565b73ffffffffffffffffffffffffffffffffffffffff168380602001906106e2919061138f565b6040516106f0929190611431565b6000604051808303816000865af19150503d806000811461072d576040519150601f19603f3d011682016040523d82523d6000602084013e610732565b606091505b5086848151811061074657610745611329565b5b60200260200101819052819250505080610795576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040161078c9061153b565b60405180910390fd5b81600101915050610678565b5050509250929050565b60006001430340905090565b600046905090565b6000806060439250434091506107d68686866109f4565b905093509350939050565b600048905090565b600043905090565b60008173ffffffffffffffffffffffffffffffffffffffff16319050919050565b600044905090565b606060008383905090508067ffffffffffffffff81111561083e5761083d6112fa565b5b60405190808252806020026020018201604052801561087757816020015b610864610bd5565b81526020019060019003908161085c5790505b5091503660005b828110156109db57600084828151811061089b5761089a611329565b5b602002602001015190508686838181106108b8576108b7611329565b5b90506020028101906108ca919061155b565b92508260000160208101906108df91906111a7565b73ffffffffffffffffffffffffffffffffffffffff16838060400190610905919061138f565b604051610913929190611431565b6000604051808303816000865af19150503d8060008114610950576040519150601f19603f3d011682016040523d82523d6000602084013e610955565b606091505b5082600001836020018290528215151515815250505080516020840135176109cf577f08c379a000000000000000000000000000000000000000000000000000000000600052602060045260176024527f4d756c746963616c6c333a2063616c6c206661696c656400000000000000000060445260646000fd5b8160010191505061087e565b50505092915050565b600045905090565b600041905090565b606060008383905090508067ffffffffffffffff811115610a1857610a176112fa565b5b604051908082528060200260200182016040528015610a5157816020015b610a3e610bd5565b815260200190600190039081610a365790505b5091503660005b82811015610b9c576000848281518110610a7557610a74611329565b5b60200260200101519050868683818110610a9257610a91611329565b5b9050602002810190610aa491906114c7565b9250826000016020810190610ab991906111a7565b73ffffffffffffffffffffffffffffffffffffffff16838060200190610adf919061138f565b604051610aed929190611431565b6000604051808303816000865af19150503d8060008114610b2a576040519150601f19603f3d011682016040523d82523d6000602084013e610b2f565b606091505b508260000183602001829052821515151581525050508715610b90578060000151610b8f576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401610b869061153b565b60405180910390fd5b5b81600101915050610a58565b5050509392505050565b6000806060610bb7600186866107bf565b8093508194508295505050509250925092565b600081409050919050565b6040518060400160405280600015158152602001606081525090565b6000819050919050565b610c0481610bf1565b82525050565b6000602082019050610c1f6000830184610bfb565b92915050565b600080fd5b600080fd5b600080fd5b600080fd5b600080fd5b60008083601f840112610c5457610c53610c2f565b5b8235905067ffffffffffffffff811115610c7157610c70610c34565b5b602083019150836020820283011115610c8d57610c8c610c39565b5b9250929050565b60008060208385031215610cab57610caa610c25565b5b600083013567ffffffffffffffff811115610cc957610cc8610c2a565b5b610cd585828601610c3e565b92509250509250929050565b600081519050919050565b600082825260208201905092915050565b6000819050602082019050919050565b60008115159050919050565b610d2281610d0d565b82525050565b600081519050919050565b600082825260208201905092915050565b60005b83811015610d62578082015181840152602081019050610d47565b83811115610d71576000848401525b50505050565b6000601f19601f8301169050919050565b6000610d9382610d28565b610d9d8185610d33565b9350610dad818560208601610d44565b610db681610d77565b840191505092915050565b6000604083016000830151610dd96000860182610d19565b5060208301518482036020860152610df18282610d88565b9150508091505092915050565b6000610e0a8383610dc1565b905092915050565b6000602082019050919050565b6000610e2a82610ce1565b610e348185610cec565b935083602082028501610e4685610cfd565b8060005b85811015610e825784840389528151610e638582610dfe565b9450610e6e83610e12565b925060208a01995050600181019050610e4a565b50829750879550505050505092915050565b60006020820190508181036000830152610eae8184610e1f565b905092915050565b60008083601f840112610ecc57610ecb610c2f565b5b8235905067ffffffffffffffff811115610ee957610ee8610c34565b5b602083019150836020820283011115610f0557610f04610c39565b5b9250929050565b60008060208385031215610f2357610f22610c25565b5b600083013567ffffffffffffffff811115610f4157610f40610c2a565b5b610f4d85828601610eb6565b92509250509250929050565b600081519050919050565b600082825260208201905092915050565b6000819050602082019050919050565b6000610f918383610d88565b905092915050565b6000602082019050919050565b6000610fb182610f59565b610fbb8185610f64565b935083602082028501610fcd85610f75565b8060005b858110156110095784840389528151610fea8582610f85565b9450610ff583610f99565b925060208a01995050600181019050610fd1565b50829750879550505050505092915050565b60006040820190506110306000830185610bfb565b81810360208301526110428184610fa6565b90509392505050565b6000819050919050565b61105e8161104b565b82525050565b60006020820190506110796000830184611055565b92915050565b61108881610d0d565b811461109357600080fd5b50565b6000813590506110a58161107f565b92915050565b6000806000604084860312156110c4576110c3610c25565b5b60006110d286828701611096565b935050602084013567ffffffffffffffff8111156110f3576110f2610c2a565b5b6110ff86828701610eb6565b92509250509250925092565b60006060820190506111206000830186610bfb565b61112d6020830185611055565b818103604083015261113f8184610e1f565b9050949350505050565b600073ffffffffffffffffffffffffffffffffffffffff82169050919050565b600061117482611149565b9050919050565b61118481611169565b811461118f57600080fd5b50565b6000813590506111a18161117b565b92915050565b6000602082840312156111bd576111bc610c25565b5b60006111cb84828501611192565b91505092915050565b60008083601f8401126111ea576111e9610c2f565b5b8235905067ffffffffffffffff81111561120757611206610c34565b5b60208301915083602082028301111561122357611222610c39565b5b9250929050565b6000806020838503121561124157611240610c25565b5b600083013567ffffffffffffffff81111561125f5761125e610c2a565b5b61126b858286016111d4565b92509250509250929050565b61128081611169565b82525050565b600060208201905061129b6000830184611277565b92915050565b6112aa81610bf1565b81146112b557600080fd5b50565b6000813590506112c7816112a1565b92915050565b6000602082840312156112e3576112e2610c25565b5b60006112f1848285016112b8565b91505092915050565b7f4e487b7100000000000000000000000000000000000000000000000000000000600052604160045260246000fd5b7f4e487b7100000000000000000000000000000000000000000000000000000000600052603260045260246000fd5b600080fd5b600080fd5b600080fd5b60008235600160800383360303811261138357611382611358565b5b80830191505092915050565b600080833560016020038436030381126113ac576113ab611358565b5b80840192508235915067ffffffffffffffff8211156113ce576113cd61135d565b5b6020830192506001820236038313156113ea576113e9611362565b5b509250929050565b600081905092915050565b82818337600083830152505050565b600061141883856113f2565b93506114258385846113fd565b82840190509392505050565b600061143e82848661140c565b91508190509392505050565b600082825260208201905092915050565b7f4d756c746963616c6c333a2076616c7565206d69736d61746368000000000000600082015250565b6000611491601a8361144a565b915061149c8261145b565b602082019050919050565b600060208201905081810360008301526114c081611484565b9050919050565b6000823560016040038336030381126114e3576114e2611358565b5b80830191505092915050565b7f4d756c746963616c6c333a2063616c6c206661696c6564000000000000000000600082015250565b600061152560178361144a565b9150611530826114ef565b602082019050919050565b6000602082019050818103600083015261155481611518565b9050919050565b60008235600160600383360303811261157757611576611358565b5b8083019150509291505056fea264697066735822122020c1bc9aacf8e4a6507193432a895a8e77094f45a1395583f07b24e860ef06cd64736f6c634300080c0033";

// ../../../../node_modules/.bun/viem@2.43.3+0470b0a66942a3da/node_modules/viem/_esm/errors/version.js
var version3 = "2.43.3";

// ../../../../node_modules/.bun/viem@2.43.3+0470b0a66942a3da/node_modules/viem/_esm/errors/base.js
var errorConfig = {
  getDocsUrl: ({ docsBaseUrl, docsPath = "", docsSlug }) => docsPath ? `${docsBaseUrl ?? "https://viem.sh"}${docsPath}${docsSlug ? `#${docsSlug}` : ""}` : undefined,
  version: `viem@${version3}`
};
class BaseError3 extends Error {
  constructor(shortMessage, args = {}) {
    const details = (() => {
      if (args.cause instanceof BaseError3)
        return args.cause.details;
      if (args.cause?.message)
        return args.cause.message;
      return args.details;
    })();
    const docsPath = (() => {
      if (args.cause instanceof BaseError3)
        return args.cause.docsPath || args.docsPath;
      return args.docsPath;
    })();
    const docsUrl = errorConfig.getDocsUrl?.({ ...args, docsPath });
    const message = [
      shortMessage || "An error occurred.",
      "",
      ...args.metaMessages ? [...args.metaMessages, ""] : [],
      ...docsUrl ? [`Docs: ${docsUrl}`] : [],
      ...details ? [`Details: ${details}`] : [],
      ...errorConfig.version ? [`Version: ${errorConfig.version}`] : []
    ].join(`
`);
    super(message, args.cause ? { cause: args.cause } : undefined);
    Object.defineProperty(this, "details", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: undefined
    });
    Object.defineProperty(this, "docsPath", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: undefined
    });
    Object.defineProperty(this, "metaMessages", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: undefined
    });
    Object.defineProperty(this, "shortMessage", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: undefined
    });
    Object.defineProperty(this, "version", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: undefined
    });
    Object.defineProperty(this, "name", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: "BaseError"
    });
    this.details = details;
    this.docsPath = docsPath;
    this.metaMessages = args.metaMessages;
    this.name = args.name ?? this.name;
    this.shortMessage = shortMessage;
    this.version = version3;
  }
  walk(fn) {
    return walk2(this, fn);
  }
}
function walk2(err, fn) {
  if (fn?.(err))
    return err;
  if (err && typeof err === "object" && "cause" in err && err.cause !== undefined)
    return walk2(err.cause, fn);
  return fn ? null : err;
}

// ../../../../node_modules/.bun/viem@2.43.3+0470b0a66942a3da/node_modules/viem/_esm/errors/chain.js
class ChainDoesNotSupportContract extends BaseError3 {
  constructor({ blockNumber, chain, contract }) {
    super(`Chain "${chain.name}" does not support contract "${contract.name}".`, {
      metaMessages: [
        "This could be due to any of the following:",
        ...blockNumber && contract.blockCreated && contract.blockCreated > blockNumber ? [
          `- The contract "${contract.name}" was not deployed until block ${contract.blockCreated} (current block ${blockNumber}).`
        ] : [
          `- The chain does not have the contract "${contract.name}" configured.`
        ]
      ],
      name: "ChainDoesNotSupportContract"
    });
  }
}

class ChainMismatchError extends BaseError3 {
  constructor({ chain, currentChainId }) {
    super(`The current chain of the wallet (id: ${currentChainId}) does not match the target chain for the transaction (id: ${chain.id} – ${chain.name}).`, {
      metaMessages: [
        `Current Chain ID:  ${currentChainId}`,
        `Expected Chain ID: ${chain.id} – ${chain.name}`
      ],
      name: "ChainMismatchError"
    });
  }
}

class ChainNotFoundError extends BaseError3 {
  constructor() {
    super([
      "No chain was provided to the request.",
      "Please provide a chain with the `chain` argument on the Action, or by supplying a `chain` to WalletClient."
    ].join(`
`), {
      name: "ChainNotFoundError"
    });
  }
}

class ClientChainNotConfiguredError extends BaseError3 {
  constructor() {
    super("No chain was provided to the Client.", {
      name: "ClientChainNotConfiguredError"
    });
  }
}

class InvalidChainIdError extends BaseError3 {
  constructor({ chainId }) {
    super(typeof chainId === "number" ? `Chain ID "${chainId}" is invalid.` : "Chain ID is invalid.", { name: "InvalidChainIdError" });
  }
}

// ../../../../node_modules/.bun/viem@2.43.3+0470b0a66942a3da/node_modules/viem/_esm/constants/solidity.js
var panicReasons = {
  1: "An `assert` condition failed.",
  17: "Arithmetic operation resulted in underflow or overflow.",
  18: "Division or modulo by zero (e.g. `5 / 0` or `23 % 0`).",
  33: "Attempted to convert to an invalid type.",
  34: "Attempted to access a storage byte array that is incorrectly encoded.",
  49: "Performed `.pop()` on an empty array",
  50: "Array index is out of bounds.",
  65: "Allocated too much memory or created an array which is too large.",
  81: "Attempted to call a zero-initialized variable of internal function type."
};
var solidityError = {
  inputs: [
    {
      name: "message",
      type: "string"
    }
  ],
  name: "Error",
  type: "error"
};
var solidityPanic = {
  inputs: [
    {
      name: "reason",
      type: "uint256"
    }
  ],
  name: "Panic",
  type: "error"
};

// ../../../../node_modules/.bun/viem@2.43.3+0470b0a66942a3da/node_modules/viem/_esm/utils/abi/formatAbiItem.js
function formatAbiItem2(abiItem, { includeName = false } = {}) {
  if (abiItem.type !== "function" && abiItem.type !== "event" && abiItem.type !== "error")
    throw new InvalidDefinitionTypeError(abiItem.type);
  return `${abiItem.name}(${formatAbiParams(abiItem.inputs, { includeName })})`;
}
function formatAbiParams(params, { includeName = false } = {}) {
  if (!params)
    return "";
  return params.map((param) => formatAbiParam(param, { includeName })).join(includeName ? ", " : ",");
}
function formatAbiParam(param, { includeName }) {
  if (param.type.startsWith("tuple")) {
    return `(${formatAbiParams(param.components, { includeName })})${param.type.slice("tuple".length)}`;
  }
  return param.type + (includeName && param.name ? ` ${param.name}` : "");
}

// ../../../../node_modules/.bun/viem@2.43.3+0470b0a66942a3da/node_modules/viem/_esm/utils/data/isHex.js
function isHex(value, { strict = true } = {}) {
  if (!value)
    return false;
  if (typeof value !== "string")
    return false;
  return strict ? /^0x[0-9a-fA-F]*$/.test(value) : value.startsWith("0x");
}

// ../../../../node_modules/.bun/viem@2.43.3+0470b0a66942a3da/node_modules/viem/_esm/utils/data/size.js
function size3(value) {
  if (isHex(value, { strict: false }))
    return Math.ceil((value.length - 2) / 2);
  return value.length;
}

// ../../../../node_modules/.bun/viem@2.43.3+0470b0a66942a3da/node_modules/viem/_esm/errors/abi.js
class AbiConstructorNotFoundError extends BaseError3 {
  constructor({ docsPath }) {
    super([
      "A constructor was not found on the ABI.",
      "Make sure you are using the correct ABI and that the constructor exists on it."
    ].join(`
`), {
      docsPath,
      name: "AbiConstructorNotFoundError"
    });
  }
}

class AbiConstructorParamsNotFoundError extends BaseError3 {
  constructor({ docsPath }) {
    super([
      "Constructor arguments were provided (`args`), but a constructor parameters (`inputs`) were not found on the ABI.",
      "Make sure you are using the correct ABI, and that the `inputs` attribute on the constructor exists."
    ].join(`
`), {
      docsPath,
      name: "AbiConstructorParamsNotFoundError"
    });
  }
}
class AbiDecodingDataSizeTooSmallError extends BaseError3 {
  constructor({ data, params, size: size4 }) {
    super([`Data size of ${size4} bytes is too small for given parameters.`].join(`
`), {
      metaMessages: [
        `Params: (${formatAbiParams(params, { includeName: true })})`,
        `Data:   ${data} (${size4} bytes)`
      ],
      name: "AbiDecodingDataSizeTooSmallError"
    });
    Object.defineProperty(this, "data", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: undefined
    });
    Object.defineProperty(this, "params", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: undefined
    });
    Object.defineProperty(this, "size", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: undefined
    });
    this.data = data;
    this.params = params;
    this.size = size4;
  }
}

class AbiDecodingZeroDataError extends BaseError3 {
  constructor() {
    super('Cannot decode zero data ("0x") with ABI parameters.', {
      name: "AbiDecodingZeroDataError"
    });
  }
}

class AbiEncodingArrayLengthMismatchError extends BaseError3 {
  constructor({ expectedLength, givenLength, type }) {
    super([
      `ABI encoding array length mismatch for type ${type}.`,
      `Expected length: ${expectedLength}`,
      `Given length: ${givenLength}`
    ].join(`
`), { name: "AbiEncodingArrayLengthMismatchError" });
  }
}

class AbiEncodingBytesSizeMismatchError extends BaseError3 {
  constructor({ expectedSize, value }) {
    super(`Size of bytes "${value}" (bytes${size3(value)}) does not match expected size (bytes${expectedSize}).`, { name: "AbiEncodingBytesSizeMismatchError" });
  }
}

class AbiEncodingLengthMismatchError extends BaseError3 {
  constructor({ expectedLength, givenLength }) {
    super([
      "ABI encoding params/values length mismatch.",
      `Expected length (params): ${expectedLength}`,
      `Given length (values): ${givenLength}`
    ].join(`
`), { name: "AbiEncodingLengthMismatchError" });
  }
}

class AbiErrorInputsNotFoundError extends BaseError3 {
  constructor(errorName, { docsPath }) {
    super([
      `Arguments (\`args\`) were provided to "${errorName}", but "${errorName}" on the ABI does not contain any parameters (\`inputs\`).`,
      "Cannot encode error result without knowing what the parameter types are.",
      "Make sure you are using the correct ABI and that the inputs exist on it."
    ].join(`
`), {
      docsPath,
      name: "AbiErrorInputsNotFoundError"
    });
  }
}

class AbiErrorNotFoundError extends BaseError3 {
  constructor(errorName, { docsPath } = {}) {
    super([
      `Error ${errorName ? `"${errorName}" ` : ""}not found on ABI.`,
      "Make sure you are using the correct ABI and that the error exists on it."
    ].join(`
`), {
      docsPath,
      name: "AbiErrorNotFoundError"
    });
  }
}

class AbiErrorSignatureNotFoundError extends BaseError3 {
  constructor(signature, { docsPath }) {
    super([
      `Encoded error signature "${signature}" not found on ABI.`,
      "Make sure you are using the correct ABI and that the error exists on it.",
      `You can look up the decoded signature here: https://openchain.xyz/signatures?query=${signature}.`
    ].join(`
`), {
      docsPath,
      name: "AbiErrorSignatureNotFoundError"
    });
    Object.defineProperty(this, "signature", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: undefined
    });
    this.signature = signature;
  }
}

class AbiEventSignatureEmptyTopicsError extends BaseError3 {
  constructor({ docsPath }) {
    super("Cannot extract event signature from empty topics.", {
      docsPath,
      name: "AbiEventSignatureEmptyTopicsError"
    });
  }
}

class AbiEventSignatureNotFoundError extends BaseError3 {
  constructor(signature, { docsPath }) {
    super([
      `Encoded event signature "${signature}" not found on ABI.`,
      "Make sure you are using the correct ABI and that the event exists on it.",
      `You can look up the signature here: https://openchain.xyz/signatures?query=${signature}.`
    ].join(`
`), {
      docsPath,
      name: "AbiEventSignatureNotFoundError"
    });
  }
}

class AbiEventNotFoundError extends BaseError3 {
  constructor(eventName, { docsPath } = {}) {
    super([
      `Event ${eventName ? `"${eventName}" ` : ""}not found on ABI.`,
      "Make sure you are using the correct ABI and that the event exists on it."
    ].join(`
`), {
      docsPath,
      name: "AbiEventNotFoundError"
    });
  }
}

class AbiFunctionNotFoundError extends BaseError3 {
  constructor(functionName, { docsPath } = {}) {
    super([
      `Function ${functionName ? `"${functionName}" ` : ""}not found on ABI.`,
      "Make sure you are using the correct ABI and that the function exists on it."
    ].join(`
`), {
      docsPath,
      name: "AbiFunctionNotFoundError"
    });
  }
}

class AbiFunctionOutputsNotFoundError extends BaseError3 {
  constructor(functionName, { docsPath }) {
    super([
      `Function "${functionName}" does not contain any \`outputs\` on ABI.`,
      "Cannot decode function result without knowing what the parameter types are.",
      "Make sure you are using the correct ABI and that the function exists on it."
    ].join(`
`), {
      docsPath,
      name: "AbiFunctionOutputsNotFoundError"
    });
  }
}

class AbiFunctionSignatureNotFoundError extends BaseError3 {
  constructor(signature, { docsPath }) {
    super([
      `Encoded function signature "${signature}" not found on ABI.`,
      "Make sure you are using the correct ABI and that the function exists on it.",
      `You can look up the signature here: https://openchain.xyz/signatures?query=${signature}.`
    ].join(`
`), {
      docsPath,
      name: "AbiFunctionSignatureNotFoundError"
    });
  }
}

class AbiItemAmbiguityError extends BaseError3 {
  constructor(x, y) {
    super("Found ambiguous types in overloaded ABI items.", {
      metaMessages: [
        `\`${x.type}\` in \`${formatAbiItem2(x.abiItem)}\`, and`,
        `\`${y.type}\` in \`${formatAbiItem2(y.abiItem)}\``,
        "",
        "These types encode differently and cannot be distinguished at runtime.",
        "Remove one of the ambiguous items in the ABI."
      ],
      name: "AbiItemAmbiguityError"
    });
  }
}

class BytesSizeMismatchError extends BaseError3 {
  constructor({ expectedSize, givenSize }) {
    super(`Expected bytes${expectedSize}, got bytes${givenSize}.`, {
      name: "BytesSizeMismatchError"
    });
  }
}

class DecodeLogDataMismatch extends BaseError3 {
  constructor({ abiItem, data, params, size: size4 }) {
    super([
      `Data size of ${size4} bytes is too small for non-indexed event parameters.`
    ].join(`
`), {
      metaMessages: [
        `Params: (${formatAbiParams(params, { includeName: true })})`,
        `Data:   ${data} (${size4} bytes)`
      ],
      name: "DecodeLogDataMismatch"
    });
    Object.defineProperty(this, "abiItem", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: undefined
    });
    Object.defineProperty(this, "data", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: undefined
    });
    Object.defineProperty(this, "params", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: undefined
    });
    Object.defineProperty(this, "size", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: undefined
    });
    this.abiItem = abiItem;
    this.data = data;
    this.params = params;
    this.size = size4;
  }
}

class DecodeLogTopicsMismatch extends BaseError3 {
  constructor({ abiItem, param }) {
    super([
      `Expected a topic for indexed event parameter${param.name ? ` "${param.name}"` : ""} on event "${formatAbiItem2(abiItem, { includeName: true })}".`
    ].join(`
`), { name: "DecodeLogTopicsMismatch" });
    Object.defineProperty(this, "abiItem", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: undefined
    });
    this.abiItem = abiItem;
  }
}

class InvalidAbiEncodingTypeError extends BaseError3 {
  constructor(type, { docsPath }) {
    super([
      `Type "${type}" is not a valid encoding type.`,
      "Please provide a valid ABI type."
    ].join(`
`), { docsPath, name: "InvalidAbiEncodingType" });
  }
}

class InvalidAbiDecodingTypeError extends BaseError3 {
  constructor(type, { docsPath }) {
    super([
      `Type "${type}" is not a valid decoding type.`,
      "Please provide a valid ABI type."
    ].join(`
`), { docsPath, name: "InvalidAbiDecodingType" });
  }
}

class InvalidArrayError extends BaseError3 {
  constructor(value) {
    super([`Value "${value}" is not a valid array.`].join(`
`), {
      name: "InvalidArrayError"
    });
  }
}

class InvalidDefinitionTypeError extends BaseError3 {
  constructor(type) {
    super([
      `"${type}" is not a valid definition type.`,
      'Valid types: "function", "event", "error"'
    ].join(`
`), { name: "InvalidDefinitionTypeError" });
  }
}

// ../../../../node_modules/.bun/viem@2.43.3+0470b0a66942a3da/node_modules/viem/_esm/errors/data.js
class SliceOffsetOutOfBoundsError3 extends BaseError3 {
  constructor({ offset, position, size: size4 }) {
    super(`Slice ${position === "start" ? "starting" : "ending"} at offset "${offset}" is out-of-bounds (size: ${size4}).`, { name: "SliceOffsetOutOfBoundsError" });
  }
}

class SizeExceedsPaddingSizeError3 extends BaseError3 {
  constructor({ size: size4, targetSize, type }) {
    super(`${type.charAt(0).toUpperCase()}${type.slice(1).toLowerCase()} size (${size4}) exceeds padding size (${targetSize}).`, { name: "SizeExceedsPaddingSizeError" });
  }
}

class InvalidBytesLengthError extends BaseError3 {
  constructor({ size: size4, targetSize, type }) {
    super(`${type.charAt(0).toUpperCase()}${type.slice(1).toLowerCase()} is expected to be ${targetSize} ${type} long, but is ${size4} ${type} long.`, { name: "InvalidBytesLengthError" });
  }
}

// ../../../../node_modules/.bun/viem@2.43.3+0470b0a66942a3da/node_modules/viem/_esm/utils/data/slice.js
function slice3(value, start, end, { strict } = {}) {
  if (isHex(value, { strict: false }))
    return sliceHex(value, start, end, {
      strict
    });
  return sliceBytes(value, start, end, {
    strict
  });
}
function assertStartOffset3(value, start) {
  if (typeof start === "number" && start > 0 && start > size3(value) - 1)
    throw new SliceOffsetOutOfBoundsError3({
      offset: start,
      position: "start",
      size: size3(value)
    });
}
function assertEndOffset3(value, start, end) {
  if (typeof start === "number" && typeof end === "number" && size3(value) !== end - start) {
    throw new SliceOffsetOutOfBoundsError3({
      offset: end,
      position: "end",
      size: size3(value)
    });
  }
}
function sliceBytes(value_, start, end, { strict } = {}) {
  assertStartOffset3(value_, start);
  const value = value_.slice(start, end);
  if (strict)
    assertEndOffset3(value, start, end);
  return value;
}
function sliceHex(value_, start, end, { strict } = {}) {
  assertStartOffset3(value_, start);
  const value = `0x${value_.replace("0x", "").slice((start ?? 0) * 2, (end ?? value_.length) * 2)}`;
  if (strict)
    assertEndOffset3(value, start, end);
  return value;
}

// ../../../../node_modules/.bun/viem@2.43.3+0470b0a66942a3da/node_modules/viem/_esm/utils/data/pad.js
function pad3(hexOrBytes, { dir, size: size4 = 32 } = {}) {
  if (typeof hexOrBytes === "string")
    return padHex(hexOrBytes, { dir, size: size4 });
  return padBytes(hexOrBytes, { dir, size: size4 });
}
function padHex(hex_, { dir, size: size4 = 32 } = {}) {
  if (size4 === null)
    return hex_;
  const hex = hex_.replace("0x", "");
  if (hex.length > size4 * 2)
    throw new SizeExceedsPaddingSizeError3({
      size: Math.ceil(hex.length / 2),
      targetSize: size4,
      type: "hex"
    });
  return `0x${hex[dir === "right" ? "padEnd" : "padStart"](size4 * 2, "0")}`;
}
function padBytes(bytes, { dir, size: size4 = 32 } = {}) {
  if (size4 === null)
    return bytes;
  if (bytes.length > size4)
    throw new SizeExceedsPaddingSizeError3({
      size: bytes.length,
      targetSize: size4,
      type: "bytes"
    });
  const paddedBytes = new Uint8Array(size4);
  for (let i = 0;i < size4; i++) {
    const padEnd = dir === "right";
    paddedBytes[padEnd ? i : size4 - i - 1] = bytes[padEnd ? i : bytes.length - i - 1];
  }
  return paddedBytes;
}

// ../../../../node_modules/.bun/viem@2.43.3+0470b0a66942a3da/node_modules/viem/_esm/errors/encoding.js
class IntegerOutOfRangeError2 extends BaseError3 {
  constructor({ max, min, signed, size: size4, value }) {
    super(`Number "${value}" is not in safe ${size4 ? `${size4 * 8}-bit ${signed ? "signed" : "unsigned"} ` : ""}integer range ${max ? `(${min} to ${max})` : `(above ${min})`}`, { name: "IntegerOutOfRangeError" });
  }
}

class InvalidBytesBooleanError2 extends BaseError3 {
  constructor(bytes) {
    super(`Bytes value "${bytes}" is not a valid boolean. The bytes array must contain a single byte of either a 0 or 1 value.`, {
      name: "InvalidBytesBooleanError"
    });
  }
}

class InvalidHexBooleanError extends BaseError3 {
  constructor(hex) {
    super(`Hex value "${hex}" is not a valid boolean. The hex value must be "0x0" (false) or "0x1" (true).`, { name: "InvalidHexBooleanError" });
  }
}
class SizeOverflowError3 extends BaseError3 {
  constructor({ givenSize, maxSize }) {
    super(`Size cannot exceed ${maxSize} bytes. Given size: ${givenSize} bytes.`, { name: "SizeOverflowError" });
  }
}

// ../../../../node_modules/.bun/viem@2.43.3+0470b0a66942a3da/node_modules/viem/_esm/utils/data/trim.js
function trim3(hexOrBytes, { dir = "left" } = {}) {
  let data = typeof hexOrBytes === "string" ? hexOrBytes.replace("0x", "") : hexOrBytes;
  let sliceLength = 0;
  for (let i = 0;i < data.length - 1; i++) {
    if (data[dir === "left" ? i : data.length - i - 1].toString() === "0")
      sliceLength++;
    else
      break;
  }
  data = dir === "left" ? data.slice(sliceLength) : data.slice(0, data.length - sliceLength);
  if (typeof hexOrBytes === "string") {
    if (data.length === 1 && dir === "right")
      data = `${data}0`;
    return `0x${data.length % 2 === 1 ? `0${data}` : data}`;
  }
  return data;
}

// ../../../../node_modules/.bun/viem@2.43.3+0470b0a66942a3da/node_modules/viem/_esm/utils/encoding/fromHex.js
function assertSize3(hexOrBytes, { size: size4 }) {
  if (size3(hexOrBytes) > size4)
    throw new SizeOverflowError3({
      givenSize: size3(hexOrBytes),
      maxSize: size4
    });
}
function hexToBigInt(hex, opts = {}) {
  const { signed } = opts;
  if (opts.size)
    assertSize3(hex, { size: opts.size });
  const value = BigInt(hex);
  if (!signed)
    return value;
  const size4 = (hex.length - 2) / 2;
  const max = (1n << BigInt(size4) * 8n - 1n) - 1n;
  if (value <= max)
    return value;
  return value - BigInt(`0x${"f".padStart(size4 * 2, "f")}`) - 1n;
}
function hexToBool(hex_, opts = {}) {
  let hex = hex_;
  if (opts.size) {
    assertSize3(hex, { size: opts.size });
    hex = trim3(hex);
  }
  if (trim3(hex) === "0x00")
    return false;
  if (trim3(hex) === "0x01")
    return true;
  throw new InvalidHexBooleanError(hex);
}
function hexToNumber(hex, opts = {}) {
  return Number(hexToBigInt(hex, opts));
}

// ../../../../node_modules/.bun/viem@2.43.3+0470b0a66942a3da/node_modules/viem/_esm/utils/encoding/toHex.js
var hexes2 = /* @__PURE__ */ Array.from({ length: 256 }, (_v, i) => i.toString(16).padStart(2, "0"));
function toHex(value, opts = {}) {
  if (typeof value === "number" || typeof value === "bigint")
    return numberToHex(value, opts);
  if (typeof value === "string") {
    return stringToHex(value, opts);
  }
  if (typeof value === "boolean")
    return boolToHex(value, opts);
  return bytesToHex(value, opts);
}
function boolToHex(value, opts = {}) {
  const hex = `0x${Number(value)}`;
  if (typeof opts.size === "number") {
    assertSize3(hex, { size: opts.size });
    return pad3(hex, { size: opts.size });
  }
  return hex;
}
function bytesToHex(value, opts = {}) {
  let string = "";
  for (let i = 0;i < value.length; i++) {
    string += hexes2[value[i]];
  }
  const hex = `0x${string}`;
  if (typeof opts.size === "number") {
    assertSize3(hex, { size: opts.size });
    return pad3(hex, { dir: "right", size: opts.size });
  }
  return hex;
}
function numberToHex(value_, opts = {}) {
  const { signed, size: size4 } = opts;
  const value = BigInt(value_);
  let maxValue;
  if (size4) {
    if (signed)
      maxValue = (1n << BigInt(size4) * 8n - 1n) - 1n;
    else
      maxValue = 2n ** (BigInt(size4) * 8n) - 1n;
  } else if (typeof value_ === "number") {
    maxValue = BigInt(Number.MAX_SAFE_INTEGER);
  }
  const minValue = typeof maxValue === "bigint" && signed ? -maxValue - 1n : 0;
  if (maxValue && value > maxValue || value < minValue) {
    const suffix = typeof value_ === "bigint" ? "n" : "";
    throw new IntegerOutOfRangeError2({
      max: maxValue ? `${maxValue}${suffix}` : undefined,
      min: `${minValue}${suffix}`,
      signed,
      size: size4,
      value: `${value_}${suffix}`
    });
  }
  const hex = `0x${(signed && value < 0 ? (1n << BigInt(size4 * 8)) + BigInt(value) : value).toString(16)}`;
  if (size4)
    return pad3(hex, { size: size4 });
  return hex;
}
var encoder3 = /* @__PURE__ */ new TextEncoder;
function stringToHex(value_, opts = {}) {
  const value = encoder3.encode(value_);
  return bytesToHex(value, opts);
}

// ../../../../node_modules/.bun/viem@2.43.3+0470b0a66942a3da/node_modules/viem/_esm/utils/encoding/toBytes.js
var encoder4 = /* @__PURE__ */ new TextEncoder;
function toBytes2(value, opts = {}) {
  if (typeof value === "number" || typeof value === "bigint")
    return numberToBytes(value, opts);
  if (typeof value === "boolean")
    return boolToBytes(value, opts);
  if (isHex(value))
    return hexToBytes(value, opts);
  return stringToBytes(value, opts);
}
function boolToBytes(value, opts = {}) {
  const bytes = new Uint8Array(1);
  bytes[0] = Number(value);
  if (typeof opts.size === "number") {
    assertSize3(bytes, { size: opts.size });
    return pad3(bytes, { size: opts.size });
  }
  return bytes;
}
var charCodeMap2 = {
  zero: 48,
  nine: 57,
  A: 65,
  F: 70,
  a: 97,
  f: 102
};
function charCodeToBase162(char) {
  if (char >= charCodeMap2.zero && char <= charCodeMap2.nine)
    return char - charCodeMap2.zero;
  if (char >= charCodeMap2.A && char <= charCodeMap2.F)
    return char - (charCodeMap2.A - 10);
  if (char >= charCodeMap2.a && char <= charCodeMap2.f)
    return char - (charCodeMap2.a - 10);
  return;
}
function hexToBytes(hex_, opts = {}) {
  let hex = hex_;
  if (opts.size) {
    assertSize3(hex, { size: opts.size });
    hex = pad3(hex, { dir: "right", size: opts.size });
  }
  let hexString = hex.slice(2);
  if (hexString.length % 2)
    hexString = `0${hexString}`;
  const length = hexString.length / 2;
  const bytes = new Uint8Array(length);
  for (let index = 0, j = 0;index < length; index++) {
    const nibbleLeft = charCodeToBase162(hexString.charCodeAt(j++));
    const nibbleRight = charCodeToBase162(hexString.charCodeAt(j++));
    if (nibbleLeft === undefined || nibbleRight === undefined) {
      throw new BaseError3(`Invalid byte sequence ("${hexString[j - 2]}${hexString[j - 1]}" in "${hexString}").`);
    }
    bytes[index] = nibbleLeft * 16 + nibbleRight;
  }
  return bytes;
}
function numberToBytes(value, opts) {
  const hex = numberToHex(value, opts);
  return hexToBytes(hex);
}
function stringToBytes(value, opts = {}) {
  const bytes = encoder4.encode(value);
  if (typeof opts.size === "number") {
    assertSize3(bytes, { size: opts.size });
    return pad3(bytes, { dir: "right", size: opts.size });
  }
  return bytes;
}

// ../../../../node_modules/.bun/@noble+hashes@1.8.0/node_modules/@noble/hashes/esm/sha3.js
var _0n = BigInt(0);
var _1n = BigInt(1);
var _2n = BigInt(2);
var _7n = BigInt(7);
var _256n = BigInt(256);
var _0x71n = BigInt(113);
var SHA3_PI = [];
var SHA3_ROTL = [];
var _SHA3_IOTA = [];
for (let round = 0, R = _1n, x = 1, y = 0;round < 24; round++) {
  [x, y] = [y, (2 * x + 3 * y) % 5];
  SHA3_PI.push(2 * (5 * y + x));
  SHA3_ROTL.push((round + 1) * (round + 2) / 2 % 64);
  let t = _0n;
  for (let j = 0;j < 7; j++) {
    R = (R << _1n ^ (R >> _7n) * _0x71n) % _256n;
    if (R & _2n)
      t ^= _1n << (_1n << /* @__PURE__ */ BigInt(j)) - _1n;
  }
  _SHA3_IOTA.push(t);
}
var IOTAS = split(_SHA3_IOTA, true);
var SHA3_IOTA_H = IOTAS[0];
var SHA3_IOTA_L = IOTAS[1];
var rotlH = (h, l, s) => s > 32 ? rotlBH(h, l, s) : rotlSH(h, l, s);
var rotlL = (h, l, s) => s > 32 ? rotlBL(h, l, s) : rotlSL(h, l, s);
function keccakP(s, rounds = 24) {
  const B = new Uint32Array(5 * 2);
  for (let round = 24 - rounds;round < 24; round++) {
    for (let x = 0;x < 10; x++)
      B[x] = s[x] ^ s[x + 10] ^ s[x + 20] ^ s[x + 30] ^ s[x + 40];
    for (let x = 0;x < 10; x += 2) {
      const idx1 = (x + 8) % 10;
      const idx0 = (x + 2) % 10;
      const B0 = B[idx0];
      const B1 = B[idx0 + 1];
      const Th = rotlH(B0, B1, 1) ^ B[idx1];
      const Tl = rotlL(B0, B1, 1) ^ B[idx1 + 1];
      for (let y = 0;y < 50; y += 10) {
        s[x + y] ^= Th;
        s[x + y + 1] ^= Tl;
      }
    }
    let curH = s[2];
    let curL = s[3];
    for (let t = 0;t < 24; t++) {
      const shift = SHA3_ROTL[t];
      const Th = rotlH(curH, curL, shift);
      const Tl = rotlL(curH, curL, shift);
      const PI = SHA3_PI[t];
      curH = s[PI];
      curL = s[PI + 1];
      s[PI] = Th;
      s[PI + 1] = Tl;
    }
    for (let y = 0;y < 50; y += 10) {
      for (let x = 0;x < 10; x++)
        B[x] = s[y + x];
      for (let x = 0;x < 10; x++)
        s[y + x] ^= ~B[(x + 2) % 10] & B[(x + 4) % 10];
    }
    s[0] ^= SHA3_IOTA_H[round];
    s[1] ^= SHA3_IOTA_L[round];
  }
  clean(B);
}

class Keccak extends Hash {
  constructor(blockLen, suffix, outputLen, enableXOF = false, rounds = 24) {
    super();
    this.pos = 0;
    this.posOut = 0;
    this.finished = false;
    this.destroyed = false;
    this.enableXOF = false;
    this.blockLen = blockLen;
    this.suffix = suffix;
    this.outputLen = outputLen;
    this.enableXOF = enableXOF;
    this.rounds = rounds;
    anumber(outputLen);
    if (!(0 < blockLen && blockLen < 200))
      throw new Error("only keccak-f1600 function is supported");
    this.state = new Uint8Array(200);
    this.state32 = u32(this.state);
  }
  clone() {
    return this._cloneInto();
  }
  keccak() {
    swap32IfBE(this.state32);
    keccakP(this.state32, this.rounds);
    swap32IfBE(this.state32);
    this.posOut = 0;
    this.pos = 0;
  }
  update(data) {
    aexists(this);
    data = toBytes(data);
    abytes(data);
    const { blockLen, state } = this;
    const len = data.length;
    for (let pos = 0;pos < len; ) {
      const take = Math.min(blockLen - this.pos, len - pos);
      for (let i = 0;i < take; i++)
        state[this.pos++] ^= data[pos++];
      if (this.pos === blockLen)
        this.keccak();
    }
    return this;
  }
  finish() {
    if (this.finished)
      return;
    this.finished = true;
    const { state, suffix, pos, blockLen } = this;
    state[pos] ^= suffix;
    if ((suffix & 128) !== 0 && pos === blockLen - 1)
      this.keccak();
    state[blockLen - 1] ^= 128;
    this.keccak();
  }
  writeInto(out) {
    aexists(this, false);
    abytes(out);
    this.finish();
    const bufferOut = this.state;
    const { blockLen } = this;
    for (let pos = 0, len = out.length;pos < len; ) {
      if (this.posOut >= blockLen)
        this.keccak();
      const take = Math.min(blockLen - this.posOut, len - pos);
      out.set(bufferOut.subarray(this.posOut, this.posOut + take), pos);
      this.posOut += take;
      pos += take;
    }
    return out;
  }
  xofInto(out) {
    if (!this.enableXOF)
      throw new Error("XOF is not possible for this instance");
    return this.writeInto(out);
  }
  xof(bytes) {
    anumber(bytes);
    return this.xofInto(new Uint8Array(bytes));
  }
  digestInto(out) {
    aoutput(out, this);
    if (this.finished)
      throw new Error("digest() was already called");
    this.writeInto(out);
    this.destroy();
    return out;
  }
  digest() {
    return this.digestInto(new Uint8Array(this.outputLen));
  }
  destroy() {
    this.destroyed = true;
    clean(this.state);
  }
  _cloneInto(to) {
    const { blockLen, suffix, outputLen, rounds, enableXOF } = this;
    to || (to = new Keccak(blockLen, suffix, outputLen, enableXOF, rounds));
    to.state32.set(this.state32);
    to.pos = this.pos;
    to.posOut = this.posOut;
    to.finished = this.finished;
    to.rounds = rounds;
    to.suffix = suffix;
    to.outputLen = outputLen;
    to.enableXOF = enableXOF;
    to.destroyed = this.destroyed;
    return to;
  }
}
var gen = (suffix, blockLen, outputLen) => createHasher(() => new Keccak(blockLen, suffix, outputLen));
var keccak_256 = /* @__PURE__ */ (() => gen(1, 136, 256 / 8))();

// ../../../../node_modules/.bun/viem@2.43.3+0470b0a66942a3da/node_modules/viem/_esm/utils/hash/keccak256.js
function keccak256(value, to_) {
  const to = to_ || "hex";
  const bytes = keccak_256(isHex(value, { strict: false }) ? toBytes2(value) : value);
  if (to === "bytes")
    return bytes;
  return toHex(bytes);
}

// ../../../../node_modules/.bun/viem@2.43.3+0470b0a66942a3da/node_modules/viem/_esm/utils/hash/hashSignature.js
var hash = (value) => keccak256(toBytes2(value));
function hashSignature(sig) {
  return hash(sig);
}

// ../../../../node_modules/.bun/viem@2.43.3+0470b0a66942a3da/node_modules/viem/_esm/utils/hash/normalizeSignature.js
function normalizeSignature(signature) {
  let active = true;
  let current = "";
  let level = 0;
  let result = "";
  let valid = false;
  for (let i = 0;i < signature.length; i++) {
    const char = signature[i];
    if (["(", ")", ","].includes(char))
      active = true;
    if (char === "(")
      level++;
    if (char === ")")
      level--;
    if (!active)
      continue;
    if (level === 0) {
      if (char === " " && ["event", "function", ""].includes(result))
        result = "";
      else {
        result += char;
        if (char === ")") {
          valid = true;
          break;
        }
      }
      continue;
    }
    if (char === " ") {
      if (signature[i - 1] !== "," && current !== "," && current !== ",(") {
        current = "";
        active = false;
      }
      continue;
    }
    result += char;
    current += char;
  }
  if (!valid)
    throw new BaseError3("Unable to normalize signature.");
  return result;
}

// ../../../../node_modules/.bun/viem@2.43.3+0470b0a66942a3da/node_modules/viem/_esm/utils/hash/toSignature.js
var toSignature = (def) => {
  const def_ = (() => {
    if (typeof def === "string")
      return def;
    return formatAbiItem(def);
  })();
  return normalizeSignature(def_);
};

// ../../../../node_modules/.bun/viem@2.43.3+0470b0a66942a3da/node_modules/viem/_esm/utils/hash/toSignatureHash.js
function toSignatureHash(fn) {
  return hashSignature(toSignature(fn));
}

// ../../../../node_modules/.bun/viem@2.43.3+0470b0a66942a3da/node_modules/viem/_esm/utils/hash/toFunctionSelector.js
var toFunctionSelector = (fn) => slice3(toSignatureHash(fn), 0, 4);

// ../../../../node_modules/.bun/viem@2.43.3+0470b0a66942a3da/node_modules/viem/_esm/errors/address.js
class InvalidAddressError extends BaseError3 {
  constructor({ address }) {
    super(`Address "${address}" is invalid.`, {
      metaMessages: [
        "- Address must be a hex value of 20 bytes (40 hex characters).",
        "- Address must match its checksum counterpart."
      ],
      name: "InvalidAddressError"
    });
  }
}

// ../../../../node_modules/.bun/viem@2.43.3+0470b0a66942a3da/node_modules/viem/_esm/utils/lru.js
class LruMap extends Map {
  constructor(size4) {
    super();
    Object.defineProperty(this, "maxSize", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: undefined
    });
    this.maxSize = size4;
  }
  get(key) {
    const value = super.get(key);
    if (super.has(key) && value !== undefined) {
      this.delete(key);
      super.set(key, value);
    }
    return value;
  }
  set(key, value) {
    super.set(key, value);
    if (this.maxSize && this.size > this.maxSize) {
      const firstKey = this.keys().next().value;
      if (firstKey)
        this.delete(firstKey);
    }
    return this;
  }
}

// ../../../../node_modules/.bun/viem@2.43.3+0470b0a66942a3da/node_modules/viem/_esm/utils/address/isAddress.js
var addressRegex = /^0x[a-fA-F0-9]{40}$/;
var isAddressCache = /* @__PURE__ */ new LruMap(8192);
function isAddress(address, options) {
  const { strict = true } = options ?? {};
  const cacheKey = `${address}.${strict}`;
  if (isAddressCache.has(cacheKey))
    return isAddressCache.get(cacheKey);
  const result = (() => {
    if (!addressRegex.test(address))
      return false;
    if (address.toLowerCase() === address)
      return true;
    if (strict)
      return checksumAddress(address) === address;
    return true;
  })();
  isAddressCache.set(cacheKey, result);
  return result;
}

// ../../../../node_modules/.bun/viem@2.43.3+0470b0a66942a3da/node_modules/viem/_esm/utils/address/getAddress.js
var checksumAddressCache = /* @__PURE__ */ new LruMap(8192);
function checksumAddress(address_, chainId) {
  if (checksumAddressCache.has(`${address_}.${chainId}`))
    return checksumAddressCache.get(`${address_}.${chainId}`);
  const hexAddress = chainId ? `${chainId}${address_.toLowerCase()}` : address_.substring(2).toLowerCase();
  const hash2 = keccak256(stringToBytes(hexAddress), "bytes");
  const address = (chainId ? hexAddress.substring(`${chainId}0x`.length) : hexAddress).split("");
  for (let i = 0;i < 40; i += 2) {
    if (hash2[i >> 1] >> 4 >= 8 && address[i]) {
      address[i] = address[i].toUpperCase();
    }
    if ((hash2[i >> 1] & 15) >= 8 && address[i + 1]) {
      address[i + 1] = address[i + 1].toUpperCase();
    }
  }
  const result = `0x${address.join("")}`;
  checksumAddressCache.set(`${address_}.${chainId}`, result);
  return result;
}
function getAddress(address, chainId) {
  if (!isAddress(address, { strict: false }))
    throw new InvalidAddressError({ address });
  return checksumAddress(address, chainId);
}

// ../../../../node_modules/.bun/viem@2.43.3+0470b0a66942a3da/node_modules/viem/_esm/errors/cursor.js
class NegativeOffsetError extends BaseError3 {
  constructor({ offset }) {
    super(`Offset \`${offset}\` cannot be negative.`, {
      name: "NegativeOffsetError"
    });
  }
}

class PositionOutOfBoundsError extends BaseError3 {
  constructor({ length, position }) {
    super(`Position \`${position}\` is out of bounds (\`0 < position < ${length}\`).`, { name: "PositionOutOfBoundsError" });
  }
}

class RecursiveReadLimitExceededError extends BaseError3 {
  constructor({ count, limit }) {
    super(`Recursive read limit of \`${limit}\` exceeded (recursive read count: \`${count}\`).`, { name: "RecursiveReadLimitExceededError" });
  }
}

// ../../../../node_modules/.bun/viem@2.43.3+0470b0a66942a3da/node_modules/viem/_esm/utils/cursor.js
var staticCursor = {
  bytes: new Uint8Array,
  dataView: new DataView(new ArrayBuffer(0)),
  position: 0,
  positionReadCount: new Map,
  recursiveReadCount: 0,
  recursiveReadLimit: Number.POSITIVE_INFINITY,
  assertReadLimit() {
    if (this.recursiveReadCount >= this.recursiveReadLimit)
      throw new RecursiveReadLimitExceededError({
        count: this.recursiveReadCount + 1,
        limit: this.recursiveReadLimit
      });
  },
  assertPosition(position) {
    if (position < 0 || position > this.bytes.length - 1)
      throw new PositionOutOfBoundsError({
        length: this.bytes.length,
        position
      });
  },
  decrementPosition(offset) {
    if (offset < 0)
      throw new NegativeOffsetError({ offset });
    const position = this.position - offset;
    this.assertPosition(position);
    this.position = position;
  },
  getReadCount(position) {
    return this.positionReadCount.get(position || this.position) || 0;
  },
  incrementPosition(offset) {
    if (offset < 0)
      throw new NegativeOffsetError({ offset });
    const position = this.position + offset;
    this.assertPosition(position);
    this.position = position;
  },
  inspectByte(position_) {
    const position = position_ ?? this.position;
    this.assertPosition(position);
    return this.bytes[position];
  },
  inspectBytes(length, position_) {
    const position = position_ ?? this.position;
    this.assertPosition(position + length - 1);
    return this.bytes.subarray(position, position + length);
  },
  inspectUint8(position_) {
    const position = position_ ?? this.position;
    this.assertPosition(position);
    return this.bytes[position];
  },
  inspectUint16(position_) {
    const position = position_ ?? this.position;
    this.assertPosition(position + 1);
    return this.dataView.getUint16(position);
  },
  inspectUint24(position_) {
    const position = position_ ?? this.position;
    this.assertPosition(position + 2);
    return (this.dataView.getUint16(position) << 8) + this.dataView.getUint8(position + 2);
  },
  inspectUint32(position_) {
    const position = position_ ?? this.position;
    this.assertPosition(position + 3);
    return this.dataView.getUint32(position);
  },
  pushByte(byte) {
    this.assertPosition(this.position);
    this.bytes[this.position] = byte;
    this.position++;
  },
  pushBytes(bytes) {
    this.assertPosition(this.position + bytes.length - 1);
    this.bytes.set(bytes, this.position);
    this.position += bytes.length;
  },
  pushUint8(value) {
    this.assertPosition(this.position);
    this.bytes[this.position] = value;
    this.position++;
  },
  pushUint16(value) {
    this.assertPosition(this.position + 1);
    this.dataView.setUint16(this.position, value);
    this.position += 2;
  },
  pushUint24(value) {
    this.assertPosition(this.position + 2);
    this.dataView.setUint16(this.position, value >> 8);
    this.dataView.setUint8(this.position + 2, value & ~4294967040);
    this.position += 3;
  },
  pushUint32(value) {
    this.assertPosition(this.position + 3);
    this.dataView.setUint32(this.position, value);
    this.position += 4;
  },
  readByte() {
    this.assertReadLimit();
    this._touch();
    const value = this.inspectByte();
    this.position++;
    return value;
  },
  readBytes(length, size4) {
    this.assertReadLimit();
    this._touch();
    const value = this.inspectBytes(length);
    this.position += size4 ?? length;
    return value;
  },
  readUint8() {
    this.assertReadLimit();
    this._touch();
    const value = this.inspectUint8();
    this.position += 1;
    return value;
  },
  readUint16() {
    this.assertReadLimit();
    this._touch();
    const value = this.inspectUint16();
    this.position += 2;
    return value;
  },
  readUint24() {
    this.assertReadLimit();
    this._touch();
    const value = this.inspectUint24();
    this.position += 3;
    return value;
  },
  readUint32() {
    this.assertReadLimit();
    this._touch();
    const value = this.inspectUint32();
    this.position += 4;
    return value;
  },
  get remaining() {
    return this.bytes.length - this.position;
  },
  setPosition(position) {
    const oldPosition = this.position;
    this.assertPosition(position);
    this.position = position;
    return () => this.position = oldPosition;
  },
  _touch() {
    if (this.recursiveReadLimit === Number.POSITIVE_INFINITY)
      return;
    const count = this.getReadCount();
    this.positionReadCount.set(this.position, count + 1);
    if (count > 0)
      this.recursiveReadCount++;
  }
};
function createCursor(bytes, { recursiveReadLimit = 8192 } = {}) {
  const cursor = Object.create(staticCursor);
  cursor.bytes = bytes;
  cursor.dataView = new DataView(bytes.buffer ?? bytes, bytes.byteOffset, bytes.byteLength);
  cursor.positionReadCount = new Map;
  cursor.recursiveReadLimit = recursiveReadLimit;
  return cursor;
}

// ../../../../node_modules/.bun/viem@2.43.3+0470b0a66942a3da/node_modules/viem/_esm/utils/encoding/fromBytes.js
function bytesToBigInt(bytes, opts = {}) {
  if (typeof opts.size !== "undefined")
    assertSize3(bytes, { size: opts.size });
  const hex = bytesToHex(bytes, opts);
  return hexToBigInt(hex, opts);
}
function bytesToBool(bytes_, opts = {}) {
  let bytes = bytes_;
  if (typeof opts.size !== "undefined") {
    assertSize3(bytes, { size: opts.size });
    bytes = trim3(bytes);
  }
  if (bytes.length > 1 || bytes[0] > 1)
    throw new InvalidBytesBooleanError2(bytes);
  return Boolean(bytes[0]);
}
function bytesToNumber(bytes, opts = {}) {
  if (typeof opts.size !== "undefined")
    assertSize3(bytes, { size: opts.size });
  const hex = bytesToHex(bytes, opts);
  return hexToNumber(hex, opts);
}
function bytesToString(bytes_, opts = {}) {
  let bytes = bytes_;
  if (typeof opts.size !== "undefined") {
    assertSize3(bytes, { size: opts.size });
    bytes = trim3(bytes, { dir: "right" });
  }
  return new TextDecoder().decode(bytes);
}

// ../../../../node_modules/.bun/viem@2.43.3+0470b0a66942a3da/node_modules/viem/_esm/utils/data/concat.js
function concat2(values) {
  if (typeof values[0] === "string")
    return concatHex(values);
  return concatBytes(values);
}
function concatBytes(values) {
  let length = 0;
  for (const arr of values) {
    length += arr.length;
  }
  const result = new Uint8Array(length);
  let offset = 0;
  for (const arr of values) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}
function concatHex(values) {
  return `0x${values.reduce((acc, x) => acc + x.replace("0x", ""), "")}`;
}

// ../../../../node_modules/.bun/viem@2.43.3+0470b0a66942a3da/node_modules/viem/_esm/utils/regex.js
var bytesRegex2 = /^bytes([1-9]|1[0-9]|2[0-9]|3[0-2])?$/;
var integerRegex2 = /^(u?int)(8|16|24|32|40|48|56|64|72|80|88|96|104|112|120|128|136|144|152|160|168|176|184|192|200|208|216|224|232|240|248|256)?$/;

// ../../../../node_modules/.bun/viem@2.43.3+0470b0a66942a3da/node_modules/viem/_esm/utils/abi/encodeAbiParameters.js
function encodeAbiParameters(params, values) {
  if (params.length !== values.length)
    throw new AbiEncodingLengthMismatchError({
      expectedLength: params.length,
      givenLength: values.length
    });
  const preparedParams = prepareParams({
    params,
    values
  });
  const data = encodeParams(preparedParams);
  if (data.length === 0)
    return "0x";
  return data;
}
function prepareParams({ params, values }) {
  const preparedParams = [];
  for (let i = 0;i < params.length; i++) {
    preparedParams.push(prepareParam({ param: params[i], value: values[i] }));
  }
  return preparedParams;
}
function prepareParam({ param, value }) {
  const arrayComponents = getArrayComponents(param.type);
  if (arrayComponents) {
    const [length, type] = arrayComponents;
    return encodeArray(value, { length, param: { ...param, type } });
  }
  if (param.type === "tuple") {
    return encodeTuple(value, {
      param
    });
  }
  if (param.type === "address") {
    return encodeAddress(value);
  }
  if (param.type === "bool") {
    return encodeBool(value);
  }
  if (param.type.startsWith("uint") || param.type.startsWith("int")) {
    const signed = param.type.startsWith("int");
    const [, , size4 = "256"] = integerRegex2.exec(param.type) ?? [];
    return encodeNumber(value, {
      signed,
      size: Number(size4)
    });
  }
  if (param.type.startsWith("bytes")) {
    return encodeBytes(value, { param });
  }
  if (param.type === "string") {
    return encodeString(value);
  }
  throw new InvalidAbiEncodingTypeError(param.type, {
    docsPath: "/docs/contract/encodeAbiParameters"
  });
}
function encodeParams(preparedParams) {
  let staticSize = 0;
  for (let i = 0;i < preparedParams.length; i++) {
    const { dynamic, encoded } = preparedParams[i];
    if (dynamic)
      staticSize += 32;
    else
      staticSize += size3(encoded);
  }
  const staticParams = [];
  const dynamicParams = [];
  let dynamicSize = 0;
  for (let i = 0;i < preparedParams.length; i++) {
    const { dynamic, encoded } = preparedParams[i];
    if (dynamic) {
      staticParams.push(numberToHex(staticSize + dynamicSize, { size: 32 }));
      dynamicParams.push(encoded);
      dynamicSize += size3(encoded);
    } else {
      staticParams.push(encoded);
    }
  }
  return concat2([...staticParams, ...dynamicParams]);
}
function encodeAddress(value) {
  if (!isAddress(value))
    throw new InvalidAddressError({ address: value });
  return { dynamic: false, encoded: padHex(value.toLowerCase()) };
}
function encodeArray(value, { length, param }) {
  const dynamic = length === null;
  if (!Array.isArray(value))
    throw new InvalidArrayError(value);
  if (!dynamic && value.length !== length)
    throw new AbiEncodingArrayLengthMismatchError({
      expectedLength: length,
      givenLength: value.length,
      type: `${param.type}[${length}]`
    });
  let dynamicChild = false;
  const preparedParams = [];
  for (let i = 0;i < value.length; i++) {
    const preparedParam = prepareParam({ param, value: value[i] });
    if (preparedParam.dynamic)
      dynamicChild = true;
    preparedParams.push(preparedParam);
  }
  if (dynamic || dynamicChild) {
    const data = encodeParams(preparedParams);
    if (dynamic) {
      const length2 = numberToHex(preparedParams.length, { size: 32 });
      return {
        dynamic: true,
        encoded: preparedParams.length > 0 ? concat2([length2, data]) : length2
      };
    }
    if (dynamicChild)
      return { dynamic: true, encoded: data };
  }
  return {
    dynamic: false,
    encoded: concat2(preparedParams.map(({ encoded }) => encoded))
  };
}
function encodeBytes(value, { param }) {
  const [, paramSize] = param.type.split("bytes");
  const bytesSize = size3(value);
  if (!paramSize) {
    let value_ = value;
    if (bytesSize % 32 !== 0)
      value_ = padHex(value_, {
        dir: "right",
        size: Math.ceil((value.length - 2) / 2 / 32) * 32
      });
    return {
      dynamic: true,
      encoded: concat2([padHex(numberToHex(bytesSize, { size: 32 })), value_])
    };
  }
  if (bytesSize !== Number.parseInt(paramSize, 10))
    throw new AbiEncodingBytesSizeMismatchError({
      expectedSize: Number.parseInt(paramSize, 10),
      value
    });
  return { dynamic: false, encoded: padHex(value, { dir: "right" }) };
}
function encodeBool(value) {
  if (typeof value !== "boolean")
    throw new BaseError3(`Invalid boolean value: "${value}" (type: ${typeof value}). Expected: \`true\` or \`false\`.`);
  return { dynamic: false, encoded: padHex(boolToHex(value)) };
}
function encodeNumber(value, { signed, size: size4 = 256 }) {
  if (typeof size4 === "number") {
    const max = 2n ** (BigInt(size4) - (signed ? 1n : 0n)) - 1n;
    const min = signed ? -max - 1n : 0n;
    if (value > max || value < min)
      throw new IntegerOutOfRangeError2({
        max: max.toString(),
        min: min.toString(),
        signed,
        size: size4 / 8,
        value: value.toString()
      });
  }
  return {
    dynamic: false,
    encoded: numberToHex(value, {
      size: 32,
      signed
    })
  };
}
function encodeString(value) {
  const hexValue = stringToHex(value);
  const partsLength = Math.ceil(size3(hexValue) / 32);
  const parts = [];
  for (let i = 0;i < partsLength; i++) {
    parts.push(padHex(slice3(hexValue, i * 32, (i + 1) * 32), {
      dir: "right"
    }));
  }
  return {
    dynamic: true,
    encoded: concat2([
      padHex(numberToHex(size3(hexValue), { size: 32 })),
      ...parts
    ])
  };
}
function encodeTuple(value, { param }) {
  let dynamic = false;
  const preparedParams = [];
  for (let i = 0;i < param.components.length; i++) {
    const param_ = param.components[i];
    const index = Array.isArray(value) ? i : param_.name;
    const preparedParam = prepareParam({
      param: param_,
      value: value[index]
    });
    preparedParams.push(preparedParam);
    if (preparedParam.dynamic)
      dynamic = true;
  }
  return {
    dynamic,
    encoded: dynamic ? encodeParams(preparedParams) : concat2(preparedParams.map(({ encoded }) => encoded))
  };
}
function getArrayComponents(type) {
  const matches = type.match(/^(.*)\[(\d+)?\]$/);
  return matches ? [matches[2] ? Number(matches[2]) : null, matches[1]] : undefined;
}

// ../../../../node_modules/.bun/viem@2.43.3+0470b0a66942a3da/node_modules/viem/_esm/utils/abi/decodeAbiParameters.js
function decodeAbiParameters(params, data) {
  const bytes = typeof data === "string" ? hexToBytes(data) : data;
  const cursor = createCursor(bytes);
  if (size3(bytes) === 0 && params.length > 0)
    throw new AbiDecodingZeroDataError;
  if (size3(data) && size3(data) < 32)
    throw new AbiDecodingDataSizeTooSmallError({
      data: typeof data === "string" ? data : bytesToHex(data),
      params,
      size: size3(data)
    });
  let consumed = 0;
  const values = [];
  for (let i = 0;i < params.length; ++i) {
    const param = params[i];
    cursor.setPosition(consumed);
    const [data2, consumed_] = decodeParameter(cursor, param, {
      staticPosition: 0
    });
    consumed += consumed_;
    values.push(data2);
  }
  return values;
}
function decodeParameter(cursor, param, { staticPosition }) {
  const arrayComponents = getArrayComponents(param.type);
  if (arrayComponents) {
    const [length, type] = arrayComponents;
    return decodeArray(cursor, { ...param, type }, { length, staticPosition });
  }
  if (param.type === "tuple")
    return decodeTuple(cursor, param, { staticPosition });
  if (param.type === "address")
    return decodeAddress(cursor);
  if (param.type === "bool")
    return decodeBool(cursor);
  if (param.type.startsWith("bytes"))
    return decodeBytes(cursor, param, { staticPosition });
  if (param.type.startsWith("uint") || param.type.startsWith("int"))
    return decodeNumber(cursor, param);
  if (param.type === "string")
    return decodeString(cursor, { staticPosition });
  throw new InvalidAbiDecodingTypeError(param.type, {
    docsPath: "/docs/contract/decodeAbiParameters"
  });
}
var sizeOfLength = 32;
var sizeOfOffset = 32;
function decodeAddress(cursor) {
  const value = cursor.readBytes(32);
  return [checksumAddress(bytesToHex(sliceBytes(value, -20))), 32];
}
function decodeArray(cursor, param, { length, staticPosition }) {
  if (!length) {
    const offset = bytesToNumber(cursor.readBytes(sizeOfOffset));
    const start = staticPosition + offset;
    const startOfData = start + sizeOfLength;
    cursor.setPosition(start);
    const length2 = bytesToNumber(cursor.readBytes(sizeOfLength));
    const dynamicChild = hasDynamicChild(param);
    let consumed2 = 0;
    const value2 = [];
    for (let i = 0;i < length2; ++i) {
      cursor.setPosition(startOfData + (dynamicChild ? i * 32 : consumed2));
      const [data, consumed_] = decodeParameter(cursor, param, {
        staticPosition: startOfData
      });
      consumed2 += consumed_;
      value2.push(data);
    }
    cursor.setPosition(staticPosition + 32);
    return [value2, 32];
  }
  if (hasDynamicChild(param)) {
    const offset = bytesToNumber(cursor.readBytes(sizeOfOffset));
    const start = staticPosition + offset;
    const value2 = [];
    for (let i = 0;i < length; ++i) {
      cursor.setPosition(start + i * 32);
      const [data] = decodeParameter(cursor, param, {
        staticPosition: start
      });
      value2.push(data);
    }
    cursor.setPosition(staticPosition + 32);
    return [value2, 32];
  }
  let consumed = 0;
  const value = [];
  for (let i = 0;i < length; ++i) {
    const [data, consumed_] = decodeParameter(cursor, param, {
      staticPosition: staticPosition + consumed
    });
    consumed += consumed_;
    value.push(data);
  }
  return [value, consumed];
}
function decodeBool(cursor) {
  return [bytesToBool(cursor.readBytes(32), { size: 32 }), 32];
}
function decodeBytes(cursor, param, { staticPosition }) {
  const [_, size4] = param.type.split("bytes");
  if (!size4) {
    const offset = bytesToNumber(cursor.readBytes(32));
    cursor.setPosition(staticPosition + offset);
    const length = bytesToNumber(cursor.readBytes(32));
    if (length === 0) {
      cursor.setPosition(staticPosition + 32);
      return ["0x", 32];
    }
    const data = cursor.readBytes(length);
    cursor.setPosition(staticPosition + 32);
    return [bytesToHex(data), 32];
  }
  const value = bytesToHex(cursor.readBytes(Number.parseInt(size4, 10), 32));
  return [value, 32];
}
function decodeNumber(cursor, param) {
  const signed = param.type.startsWith("int");
  const size4 = Number.parseInt(param.type.split("int")[1] || "256", 10);
  const value = cursor.readBytes(32);
  return [
    size4 > 48 ? bytesToBigInt(value, { signed }) : bytesToNumber(value, { signed }),
    32
  ];
}
function decodeTuple(cursor, param, { staticPosition }) {
  const hasUnnamedChild = param.components.length === 0 || param.components.some(({ name }) => !name);
  const value = hasUnnamedChild ? [] : {};
  let consumed = 0;
  if (hasDynamicChild(param)) {
    const offset = bytesToNumber(cursor.readBytes(sizeOfOffset));
    const start = staticPosition + offset;
    for (let i = 0;i < param.components.length; ++i) {
      const component = param.components[i];
      cursor.setPosition(start + consumed);
      const [data, consumed_] = decodeParameter(cursor, component, {
        staticPosition: start
      });
      consumed += consumed_;
      value[hasUnnamedChild ? i : component?.name] = data;
    }
    cursor.setPosition(staticPosition + 32);
    return [value, 32];
  }
  for (let i = 0;i < param.components.length; ++i) {
    const component = param.components[i];
    const [data, consumed_] = decodeParameter(cursor, component, {
      staticPosition
    });
    value[hasUnnamedChild ? i : component?.name] = data;
    consumed += consumed_;
  }
  return [value, consumed];
}
function decodeString(cursor, { staticPosition }) {
  const offset = bytesToNumber(cursor.readBytes(32));
  const start = staticPosition + offset;
  cursor.setPosition(start);
  const length = bytesToNumber(cursor.readBytes(32));
  if (length === 0) {
    cursor.setPosition(staticPosition + 32);
    return ["", 32];
  }
  const data = cursor.readBytes(length, 32);
  const value = bytesToString(trim3(data));
  cursor.setPosition(staticPosition + 32);
  return [value, 32];
}
function hasDynamicChild(param) {
  const { type } = param;
  if (type === "string")
    return true;
  if (type === "bytes")
    return true;
  if (type.endsWith("[]"))
    return true;
  if (type === "tuple")
    return param.components?.some(hasDynamicChild);
  const arrayComponents = getArrayComponents(param.type);
  if (arrayComponents && hasDynamicChild({ ...param, type: arrayComponents[1] }))
    return true;
  return false;
}

// ../../../../node_modules/.bun/viem@2.43.3+0470b0a66942a3da/node_modules/viem/_esm/utils/abi/decodeErrorResult.js
function decodeErrorResult(parameters) {
  const { abi, data } = parameters;
  const signature = slice3(data, 0, 4);
  if (signature === "0x")
    throw new AbiDecodingZeroDataError;
  const abi_ = [...abi || [], solidityError, solidityPanic];
  const abiItem = abi_.find((x) => x.type === "error" && signature === toFunctionSelector(formatAbiItem2(x)));
  if (!abiItem)
    throw new AbiErrorSignatureNotFoundError(signature, {
      docsPath: "/docs/contract/decodeErrorResult"
    });
  return {
    abiItem,
    args: "inputs" in abiItem && abiItem.inputs && abiItem.inputs.length > 0 ? decodeAbiParameters(abiItem.inputs, slice3(data, 4)) : undefined,
    errorName: abiItem.name
  };
}

// ../../../../node_modules/.bun/viem@2.43.3+0470b0a66942a3da/node_modules/viem/_esm/utils/stringify.js
var stringify2 = (value, replacer, space) => JSON.stringify(value, (key, value_) => {
  const value2 = typeof value_ === "bigint" ? value_.toString() : value_;
  return typeof replacer === "function" ? replacer(key, value2) : value2;
}, space);

// ../../../../node_modules/.bun/viem@2.43.3+0470b0a66942a3da/node_modules/viem/_esm/utils/abi/formatAbiItemWithArgs.js
function formatAbiItemWithArgs({ abiItem, args, includeFunctionName = true, includeName = false }) {
  if (!("name" in abiItem))
    return;
  if (!("inputs" in abiItem))
    return;
  if (!abiItem.inputs)
    return;
  return `${includeFunctionName ? abiItem.name : ""}(${abiItem.inputs.map((input, i) => `${includeName && input.name ? `${input.name}: ` : ""}${typeof args[i] === "object" ? stringify2(args[i]) : args[i]}`).join(", ")})`;
}

// ../../../../node_modules/.bun/viem@2.43.3+0470b0a66942a3da/node_modules/viem/_esm/utils/hash/toEventSelector.js
var toEventSelector = toSignatureHash;

// ../../../../node_modules/.bun/viem@2.43.3+0470b0a66942a3da/node_modules/viem/_esm/utils/abi/getAbiItem.js
function getAbiItem(parameters) {
  const { abi, args = [], name } = parameters;
  const isSelector = isHex(name, { strict: false });
  const abiItems = abi.filter((abiItem) => {
    if (isSelector) {
      if (abiItem.type === "function")
        return toFunctionSelector(abiItem) === name;
      if (abiItem.type === "event")
        return toEventSelector(abiItem) === name;
      return false;
    }
    return "name" in abiItem && abiItem.name === name;
  });
  if (abiItems.length === 0)
    return;
  if (abiItems.length === 1)
    return abiItems[0];
  let matchedAbiItem;
  for (const abiItem of abiItems) {
    if (!("inputs" in abiItem))
      continue;
    if (!args || args.length === 0) {
      if (!abiItem.inputs || abiItem.inputs.length === 0)
        return abiItem;
      continue;
    }
    if (!abiItem.inputs)
      continue;
    if (abiItem.inputs.length === 0)
      continue;
    if (abiItem.inputs.length !== args.length)
      continue;
    const matched = args.every((arg, index) => {
      const abiParameter = "inputs" in abiItem && abiItem.inputs[index];
      if (!abiParameter)
        return false;
      return isArgOfType(arg, abiParameter);
    });
    if (matched) {
      if (matchedAbiItem && "inputs" in matchedAbiItem && matchedAbiItem.inputs) {
        const ambiguousTypes = getAmbiguousTypes(abiItem.inputs, matchedAbiItem.inputs, args);
        if (ambiguousTypes)
          throw new AbiItemAmbiguityError({
            abiItem,
            type: ambiguousTypes[0]
          }, {
            abiItem: matchedAbiItem,
            type: ambiguousTypes[1]
          });
      }
      matchedAbiItem = abiItem;
    }
  }
  if (matchedAbiItem)
    return matchedAbiItem;
  return abiItems[0];
}
function isArgOfType(arg, abiParameter) {
  const argType = typeof arg;
  const abiParameterType = abiParameter.type;
  switch (abiParameterType) {
    case "address":
      return isAddress(arg, { strict: false });
    case "bool":
      return argType === "boolean";
    case "function":
      return argType === "string";
    case "string":
      return argType === "string";
    default: {
      if (abiParameterType === "tuple" && "components" in abiParameter)
        return Object.values(abiParameter.components).every((component, index) => {
          return isArgOfType(Object.values(arg)[index], component);
        });
      if (/^u?int(8|16|24|32|40|48|56|64|72|80|88|96|104|112|120|128|136|144|152|160|168|176|184|192|200|208|216|224|232|240|248|256)?$/.test(abiParameterType))
        return argType === "number" || argType === "bigint";
      if (/^bytes([1-9]|1[0-9]|2[0-9]|3[0-2])?$/.test(abiParameterType))
        return argType === "string" || arg instanceof Uint8Array;
      if (/[a-z]+[1-9]{0,3}(\[[0-9]{0,}\])+$/.test(abiParameterType)) {
        return Array.isArray(arg) && arg.every((x) => isArgOfType(x, {
          ...abiParameter,
          type: abiParameterType.replace(/(\[[0-9]{0,}\])$/, "")
        }));
      }
      return false;
    }
  }
}
function getAmbiguousTypes(sourceParameters, targetParameters, args) {
  for (const parameterIndex in sourceParameters) {
    const sourceParameter = sourceParameters[parameterIndex];
    const targetParameter = targetParameters[parameterIndex];
    if (sourceParameter.type === "tuple" && targetParameter.type === "tuple" && "components" in sourceParameter && "components" in targetParameter)
      return getAmbiguousTypes(sourceParameter.components, targetParameter.components, args[parameterIndex]);
    const types = [sourceParameter.type, targetParameter.type];
    const ambiguous = (() => {
      if (types.includes("address") && types.includes("bytes20"))
        return true;
      if (types.includes("address") && types.includes("string"))
        return isAddress(args[parameterIndex], { strict: false });
      if (types.includes("address") && types.includes("bytes"))
        return isAddress(args[parameterIndex], { strict: false });
      return false;
    })();
    if (ambiguous)
      return types;
  }
  return;
}

// ../../../../node_modules/.bun/viem@2.43.3+0470b0a66942a3da/node_modules/viem/_esm/constants/unit.js
var etherUnits = {
  gwei: 9,
  wei: 18
};
var gweiUnits = {
  ether: -9,
  wei: 9
};

// ../../../../node_modules/.bun/viem@2.43.3+0470b0a66942a3da/node_modules/viem/_esm/utils/unit/formatUnits.js
function formatUnits(value, decimals) {
  let display = value.toString();
  const negative = display.startsWith("-");
  if (negative)
    display = display.slice(1);
  display = display.padStart(decimals, "0");
  let [integer, fraction] = [
    display.slice(0, display.length - decimals),
    display.slice(display.length - decimals)
  ];
  fraction = fraction.replace(/(0+)$/, "");
  return `${negative ? "-" : ""}${integer || "0"}${fraction ? `.${fraction}` : ""}`;
}

// ../../../../node_modules/.bun/viem@2.43.3+0470b0a66942a3da/node_modules/viem/_esm/utils/unit/formatEther.js
function formatEther(wei, unit = "wei") {
  return formatUnits(wei, etherUnits[unit]);
}

// ../../../../node_modules/.bun/viem@2.43.3+0470b0a66942a3da/node_modules/viem/_esm/utils/unit/formatGwei.js
function formatGwei(wei, unit = "wei") {
  return formatUnits(wei, gweiUnits[unit]);
}

// ../../../../node_modules/.bun/viem@2.43.3+0470b0a66942a3da/node_modules/viem/_esm/errors/stateOverride.js
class AccountStateConflictError extends BaseError3 {
  constructor({ address }) {
    super(`State for account "${address}" is set multiple times.`, {
      name: "AccountStateConflictError"
    });
  }
}

class StateAssignmentConflictError extends BaseError3 {
  constructor() {
    super("state and stateDiff are set on the same account.", {
      name: "StateAssignmentConflictError"
    });
  }
}
function prettyStateMapping(stateMapping) {
  return stateMapping.reduce((pretty, { slot, value }) => {
    return `${pretty}        ${slot}: ${value}
`;
  }, "");
}
function prettyStateOverride(stateOverride) {
  return stateOverride.reduce((pretty, { address, ...state }) => {
    let val = `${pretty}    ${address}:
`;
    if (state.nonce)
      val += `      nonce: ${state.nonce}
`;
    if (state.balance)
      val += `      balance: ${state.balance}
`;
    if (state.code)
      val += `      code: ${state.code}
`;
    if (state.state) {
      val += `      state:
`;
      val += prettyStateMapping(state.state);
    }
    if (state.stateDiff) {
      val += `      stateDiff:
`;
      val += prettyStateMapping(state.stateDiff);
    }
    return val;
  }, `  State Override:
`).slice(0, -1);
}

// ../../../../node_modules/.bun/viem@2.43.3+0470b0a66942a3da/node_modules/viem/_esm/errors/transaction.js
function prettyPrint(args) {
  const entries = Object.entries(args).map(([key, value]) => {
    if (value === undefined || value === false)
      return null;
    return [key, value];
  }).filter(Boolean);
  const maxLength = entries.reduce((acc, [key]) => Math.max(acc, key.length), 0);
  return entries.map(([key, value]) => `  ${`${key}:`.padEnd(maxLength + 1)}  ${value}`).join(`
`);
}
class InvalidLegacyVError extends BaseError3 {
  constructor({ v }) {
    super(`Invalid \`v\` value "${v}". Expected 27 or 28.`, {
      name: "InvalidLegacyVError"
    });
  }
}

class InvalidSerializableTransactionError extends BaseError3 {
  constructor({ transaction }) {
    super("Cannot infer a transaction type from provided transaction.", {
      metaMessages: [
        "Provided Transaction:",
        "{",
        prettyPrint(transaction),
        "}",
        "",
        "To infer the type, either provide:",
        "- a `type` to the Transaction, or",
        "- an EIP-1559 Transaction with `maxFeePerGas`, or",
        "- an EIP-2930 Transaction with `gasPrice` & `accessList`, or",
        "- an EIP-4844 Transaction with `blobs`, `blobVersionedHashes`, `sidecars`, or",
        "- an EIP-7702 Transaction with `authorizationList`, or",
        "- a Legacy Transaction with `gasPrice`"
      ],
      name: "InvalidSerializableTransactionError"
    });
  }
}
class InvalidStorageKeySizeError extends BaseError3 {
  constructor({ storageKey }) {
    super(`Size for storage key "${storageKey}" is invalid. Expected 32 bytes. Got ${Math.floor((storageKey.length - 2) / 2)} bytes.`, { name: "InvalidStorageKeySizeError" });
  }
}

class TransactionExecutionError extends BaseError3 {
  constructor(cause, { account, docsPath, chain, data, gas, gasPrice, maxFeePerGas, maxPriorityFeePerGas, nonce, to, value }) {
    const prettyArgs = prettyPrint({
      chain: chain && `${chain?.name} (id: ${chain?.id})`,
      from: account?.address,
      to,
      value: typeof value !== "undefined" && `${formatEther(value)} ${chain?.nativeCurrency?.symbol || "ETH"}`,
      data,
      gas,
      gasPrice: typeof gasPrice !== "undefined" && `${formatGwei(gasPrice)} gwei`,
      maxFeePerGas: typeof maxFeePerGas !== "undefined" && `${formatGwei(maxFeePerGas)} gwei`,
      maxPriorityFeePerGas: typeof maxPriorityFeePerGas !== "undefined" && `${formatGwei(maxPriorityFeePerGas)} gwei`,
      nonce
    });
    super(cause.shortMessage, {
      cause,
      docsPath,
      metaMessages: [
        ...cause.metaMessages ? [...cause.metaMessages, " "] : [],
        "Request Arguments:",
        prettyArgs
      ].filter(Boolean),
      name: "TransactionExecutionError"
    });
    Object.defineProperty(this, "cause", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: undefined
    });
    this.cause = cause;
  }
}

class TransactionNotFoundError extends BaseError3 {
  constructor({ blockHash, blockNumber, blockTag, hash: hash2, index }) {
    let identifier = "Transaction";
    if (blockTag && index !== undefined)
      identifier = `Transaction at block time "${blockTag}" at index "${index}"`;
    if (blockHash && index !== undefined)
      identifier = `Transaction at block hash "${blockHash}" at index "${index}"`;
    if (blockNumber && index !== undefined)
      identifier = `Transaction at block number "${blockNumber}" at index "${index}"`;
    if (hash2)
      identifier = `Transaction with hash "${hash2}"`;
    super(`${identifier} could not be found.`, {
      name: "TransactionNotFoundError"
    });
  }
}

class TransactionReceiptNotFoundError extends BaseError3 {
  constructor({ hash: hash2 }) {
    super(`Transaction receipt with hash "${hash2}" could not be found. The Transaction may not be processed on a block yet.`, {
      name: "TransactionReceiptNotFoundError"
    });
  }
}

class TransactionReceiptRevertedError extends BaseError3 {
  constructor({ receipt }) {
    super(`Transaction with hash "${receipt.transactionHash}" reverted.`, {
      metaMessages: [
        'The receipt marked the transaction as "reverted". This could mean that the function on the contract you are trying to call threw an error.',
        " ",
        "You can attempt to extract the revert reason by:",
        "- calling the `simulateContract` or `simulateCalls` Action with the `abi` and `functionName` of the contract",
        "- using the `call` Action with raw `data`"
      ],
      name: "TransactionReceiptRevertedError"
    });
    Object.defineProperty(this, "receipt", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: undefined
    });
    this.receipt = receipt;
  }
}

class WaitForTransactionReceiptTimeoutError extends BaseError3 {
  constructor({ hash: hash2 }) {
    super(`Timed out while waiting for transaction with hash "${hash2}" to be confirmed.`, { name: "WaitForTransactionReceiptTimeoutError" });
  }
}

// ../../../../node_modules/.bun/viem@2.43.3+0470b0a66942a3da/node_modules/viem/_esm/errors/utils.js
var getContractAddress = (address) => address;
var getUrl = (url) => url;

// ../../../../node_modules/.bun/viem@2.43.3+0470b0a66942a3da/node_modules/viem/_esm/errors/contract.js
class CallExecutionError extends BaseError3 {
  constructor(cause, { account: account_, docsPath, chain, data, gas, gasPrice, maxFeePerGas, maxPriorityFeePerGas, nonce, to, value, stateOverride }) {
    const account = account_ ? parseAccount(account_) : undefined;
    let prettyArgs = prettyPrint({
      from: account?.address,
      to,
      value: typeof value !== "undefined" && `${formatEther(value)} ${chain?.nativeCurrency?.symbol || "ETH"}`,
      data,
      gas,
      gasPrice: typeof gasPrice !== "undefined" && `${formatGwei(gasPrice)} gwei`,
      maxFeePerGas: typeof maxFeePerGas !== "undefined" && `${formatGwei(maxFeePerGas)} gwei`,
      maxPriorityFeePerGas: typeof maxPriorityFeePerGas !== "undefined" && `${formatGwei(maxPriorityFeePerGas)} gwei`,
      nonce
    });
    if (stateOverride) {
      prettyArgs += `
${prettyStateOverride(stateOverride)}`;
    }
    super(cause.shortMessage, {
      cause,
      docsPath,
      metaMessages: [
        ...cause.metaMessages ? [...cause.metaMessages, " "] : [],
        "Raw Call Arguments:",
        prettyArgs
      ].filter(Boolean),
      name: "CallExecutionError"
    });
    Object.defineProperty(this, "cause", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: undefined
    });
    this.cause = cause;
  }
}

class ContractFunctionExecutionError extends BaseError3 {
  constructor(cause, { abi, args, contractAddress, docsPath, functionName, sender }) {
    const abiItem = getAbiItem({ abi, args, name: functionName });
    const formattedArgs = abiItem ? formatAbiItemWithArgs({
      abiItem,
      args,
      includeFunctionName: false,
      includeName: false
    }) : undefined;
    const functionWithParams = abiItem ? formatAbiItem2(abiItem, { includeName: true }) : undefined;
    const prettyArgs = prettyPrint({
      address: contractAddress && getContractAddress(contractAddress),
      function: functionWithParams,
      args: formattedArgs && formattedArgs !== "()" && `${[...Array(functionName?.length ?? 0).keys()].map(() => " ").join("")}${formattedArgs}`,
      sender
    });
    super(cause.shortMessage || `An unknown error occurred while executing the contract function "${functionName}".`, {
      cause,
      docsPath,
      metaMessages: [
        ...cause.metaMessages ? [...cause.metaMessages, " "] : [],
        prettyArgs && "Contract Call:",
        prettyArgs
      ].filter(Boolean),
      name: "ContractFunctionExecutionError"
    });
    Object.defineProperty(this, "abi", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: undefined
    });
    Object.defineProperty(this, "args", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: undefined
    });
    Object.defineProperty(this, "cause", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: undefined
    });
    Object.defineProperty(this, "contractAddress", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: undefined
    });
    Object.defineProperty(this, "formattedArgs", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: undefined
    });
    Object.defineProperty(this, "functionName", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: undefined
    });
    Object.defineProperty(this, "sender", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: undefined
    });
    this.abi = abi;
    this.args = args;
    this.cause = cause;
    this.contractAddress = contractAddress;
    this.functionName = functionName;
    this.sender = sender;
  }
}

class ContractFunctionRevertedError extends BaseError3 {
  constructor({ abi, data, functionName, message }) {
    let cause;
    let decodedData;
    let metaMessages;
    let reason;
    if (data && data !== "0x") {
      try {
        decodedData = decodeErrorResult({ abi, data });
        const { abiItem, errorName, args: errorArgs } = decodedData;
        if (errorName === "Error") {
          reason = errorArgs[0];
        } else if (errorName === "Panic") {
          const [firstArg] = errorArgs;
          reason = panicReasons[firstArg];
        } else {
          const errorWithParams = abiItem ? formatAbiItem2(abiItem, { includeName: true }) : undefined;
          const formattedArgs = abiItem && errorArgs ? formatAbiItemWithArgs({
            abiItem,
            args: errorArgs,
            includeFunctionName: false,
            includeName: false
          }) : undefined;
          metaMessages = [
            errorWithParams ? `Error: ${errorWithParams}` : "",
            formattedArgs && formattedArgs !== "()" ? `       ${[...Array(errorName?.length ?? 0).keys()].map(() => " ").join("")}${formattedArgs}` : ""
          ];
        }
      } catch (err) {
        cause = err;
      }
    } else if (message)
      reason = message;
    let signature;
    if (cause instanceof AbiErrorSignatureNotFoundError) {
      signature = cause.signature;
      metaMessages = [
        `Unable to decode signature "${signature}" as it was not found on the provided ABI.`,
        "Make sure you are using the correct ABI and that the error exists on it.",
        `You can look up the decoded signature here: https://openchain.xyz/signatures?query=${signature}.`
      ];
    }
    super(reason && reason !== "execution reverted" || signature ? [
      `The contract function "${functionName}" reverted with the following ${signature ? "signature" : "reason"}:`,
      reason || signature
    ].join(`
`) : `The contract function "${functionName}" reverted.`, {
      cause,
      metaMessages,
      name: "ContractFunctionRevertedError"
    });
    Object.defineProperty(this, "data", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: undefined
    });
    Object.defineProperty(this, "raw", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: undefined
    });
    Object.defineProperty(this, "reason", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: undefined
    });
    Object.defineProperty(this, "signature", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: undefined
    });
    this.data = decodedData;
    this.raw = data;
    this.reason = reason;
    this.signature = signature;
  }
}

class ContractFunctionZeroDataError extends BaseError3 {
  constructor({ functionName }) {
    super(`The contract function "${functionName}" returned no data ("0x").`, {
      metaMessages: [
        "This could be due to any of the following:",
        `  - The contract does not have the function "${functionName}",`,
        "  - The parameters passed to the contract function may be invalid, or",
        "  - The address is not a contract."
      ],
      name: "ContractFunctionZeroDataError"
    });
  }
}

class CounterfactualDeploymentFailedError extends BaseError3 {
  constructor({ factory }) {
    super(`Deployment for counterfactual contract call failed${factory ? ` for factory "${factory}".` : ""}`, {
      metaMessages: [
        "Please ensure:",
        "- The `factory` is a valid contract deployment factory (ie. Create2 Factory, ERC-4337 Factory, etc).",
        "- The `factoryData` is a valid encoded function call for contract deployment function on the factory."
      ],
      name: "CounterfactualDeploymentFailedError"
    });
  }
}

class RawContractError extends BaseError3 {
  constructor({ data, message }) {
    super(message || "", { name: "RawContractError" });
    Object.defineProperty(this, "code", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: 3
    });
    Object.defineProperty(this, "data", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: undefined
    });
    this.data = data;
  }
}

// ../../../../node_modules/.bun/viem@2.43.3+0470b0a66942a3da/node_modules/viem/_esm/utils/abi/decodeFunctionResult.js
var docsPath = "/docs/contract/decodeFunctionResult";
function decodeFunctionResult(parameters) {
  const { abi, args, functionName, data } = parameters;
  let abiItem = abi[0];
  if (functionName) {
    const item = getAbiItem({ abi, args, name: functionName });
    if (!item)
      throw new AbiFunctionNotFoundError(functionName, { docsPath });
    abiItem = item;
  }
  if (abiItem.type !== "function")
    throw new AbiFunctionNotFoundError(undefined, { docsPath });
  if (!abiItem.outputs)
    throw new AbiFunctionOutputsNotFoundError(abiItem.name, { docsPath });
  const values = decodeAbiParameters(abiItem.outputs, data);
  if (values && values.length > 1)
    return values;
  if (values && values.length === 1)
    return values[0];
  return;
}

// ../../../../node_modules/.bun/viem@2.43.3+0470b0a66942a3da/node_modules/viem/_esm/utils/abi/encodeDeployData.js
var docsPath2 = "/docs/contract/encodeDeployData";
function encodeDeployData(parameters) {
  const { abi, args, bytecode } = parameters;
  if (!args || args.length === 0)
    return bytecode;
  const description = abi.find((x) => ("type" in x) && x.type === "constructor");
  if (!description)
    throw new AbiConstructorNotFoundError({ docsPath: docsPath2 });
  if (!("inputs" in description))
    throw new AbiConstructorParamsNotFoundError({ docsPath: docsPath2 });
  if (!description.inputs || description.inputs.length === 0)
    throw new AbiConstructorParamsNotFoundError({ docsPath: docsPath2 });
  const data = encodeAbiParameters(description.inputs, args);
  return concatHex([bytecode, data]);
}

// ../../../../node_modules/.bun/viem@2.43.3+0470b0a66942a3da/node_modules/viem/_esm/utils/abi/prepareEncodeFunctionData.js
var docsPath3 = "/docs/contract/encodeFunctionData";
function prepareEncodeFunctionData(parameters) {
  const { abi, args, functionName } = parameters;
  let abiItem = abi[0];
  if (functionName) {
    const item = getAbiItem({
      abi,
      args,
      name: functionName
    });
    if (!item)
      throw new AbiFunctionNotFoundError(functionName, { docsPath: docsPath3 });
    abiItem = item;
  }
  if (abiItem.type !== "function")
    throw new AbiFunctionNotFoundError(undefined, { docsPath: docsPath3 });
  return {
    abi: [abiItem],
    functionName: toFunctionSelector(formatAbiItem2(abiItem))
  };
}

// ../../../../node_modules/.bun/viem@2.43.3+0470b0a66942a3da/node_modules/viem/_esm/utils/abi/encodeFunctionData.js
function encodeFunctionData(parameters) {
  const { args } = parameters;
  const { abi, functionName } = (() => {
    if (parameters.abi.length === 1 && parameters.functionName?.startsWith("0x"))
      return parameters;
    return prepareEncodeFunctionData(parameters);
  })();
  const abiItem = abi[0];
  const signature = functionName;
  const data = "inputs" in abiItem && abiItem.inputs ? encodeAbiParameters(abiItem.inputs, args ?? []) : undefined;
  return concatHex([signature, data ?? "0x"]);
}

// ../../../../node_modules/.bun/viem@2.43.3+0470b0a66942a3da/node_modules/viem/_esm/utils/chain/getChainContractAddress.js
function getChainContractAddress({ blockNumber, chain, contract: name }) {
  const contract = chain?.contracts?.[name];
  if (!contract)
    throw new ChainDoesNotSupportContract({
      chain,
      contract: { name }
    });
  if (blockNumber && contract.blockCreated && contract.blockCreated > blockNumber)
    throw new ChainDoesNotSupportContract({
      blockNumber,
      chain,
      contract: {
        name,
        blockCreated: contract.blockCreated
      }
    });
  return contract.address;
}

// ../../../../node_modules/.bun/viem@2.43.3+0470b0a66942a3da/node_modules/viem/_esm/errors/node.js
class ExecutionRevertedError extends BaseError3 {
  constructor({ cause, message } = {}) {
    const reason = message?.replace("execution reverted: ", "")?.replace("execution reverted", "");
    super(`Execution reverted ${reason ? `with reason: ${reason}` : "for an unknown reason"}.`, {
      cause,
      name: "ExecutionRevertedError"
    });
  }
}
Object.defineProperty(ExecutionRevertedError, "code", {
  enumerable: true,
  configurable: true,
  writable: true,
  value: 3
});
Object.defineProperty(ExecutionRevertedError, "nodeMessage", {
  enumerable: true,
  configurable: true,
  writable: true,
  value: /execution reverted|gas required exceeds allowance/
});

class FeeCapTooHighError extends BaseError3 {
  constructor({ cause, maxFeePerGas } = {}) {
    super(`The fee cap (\`maxFeePerGas\`${maxFeePerGas ? ` = ${formatGwei(maxFeePerGas)} gwei` : ""}) cannot be higher than the maximum allowed value (2^256-1).`, {
      cause,
      name: "FeeCapTooHighError"
    });
  }
}
Object.defineProperty(FeeCapTooHighError, "nodeMessage", {
  enumerable: true,
  configurable: true,
  writable: true,
  value: /max fee per gas higher than 2\^256-1|fee cap higher than 2\^256-1/
});

class FeeCapTooLowError extends BaseError3 {
  constructor({ cause, maxFeePerGas } = {}) {
    super(`The fee cap (\`maxFeePerGas\`${maxFeePerGas ? ` = ${formatGwei(maxFeePerGas)}` : ""} gwei) cannot be lower than the block base fee.`, {
      cause,
      name: "FeeCapTooLowError"
    });
  }
}
Object.defineProperty(FeeCapTooLowError, "nodeMessage", {
  enumerable: true,
  configurable: true,
  writable: true,
  value: /max fee per gas less than block base fee|fee cap less than block base fee|transaction is outdated/
});

class NonceTooHighError extends BaseError3 {
  constructor({ cause, nonce } = {}) {
    super(`Nonce provided for the transaction ${nonce ? `(${nonce}) ` : ""}is higher than the next one expected.`, { cause, name: "NonceTooHighError" });
  }
}
Object.defineProperty(NonceTooHighError, "nodeMessage", {
  enumerable: true,
  configurable: true,
  writable: true,
  value: /nonce too high/
});

class NonceTooLowError extends BaseError3 {
  constructor({ cause, nonce } = {}) {
    super([
      `Nonce provided for the transaction ${nonce ? `(${nonce}) ` : ""}is lower than the current nonce of the account.`,
      "Try increasing the nonce or find the latest nonce with `getTransactionCount`."
    ].join(`
`), { cause, name: "NonceTooLowError" });
  }
}
Object.defineProperty(NonceTooLowError, "nodeMessage", {
  enumerable: true,
  configurable: true,
  writable: true,
  value: /nonce too low|transaction already imported|already known/
});

class NonceMaxValueError extends BaseError3 {
  constructor({ cause, nonce } = {}) {
    super(`Nonce provided for the transaction ${nonce ? `(${nonce}) ` : ""}exceeds the maximum allowed nonce.`, { cause, name: "NonceMaxValueError" });
  }
}
Object.defineProperty(NonceMaxValueError, "nodeMessage", {
  enumerable: true,
  configurable: true,
  writable: true,
  value: /nonce has max value/
});

class InsufficientFundsError extends BaseError3 {
  constructor({ cause } = {}) {
    super([
      "The total cost (gas * gas fee + value) of executing this transaction exceeds the balance of the account."
    ].join(`
`), {
      cause,
      metaMessages: [
        "This error could arise when the account does not have enough funds to:",
        " - pay for the total gas fee,",
        " - pay for the value to send.",
        " ",
        "The cost of the transaction is calculated as `gas * gas fee + value`, where:",
        " - `gas` is the amount of gas needed for transaction to execute,",
        " - `gas fee` is the gas fee,",
        " - `value` is the amount of ether to send to the recipient."
      ],
      name: "InsufficientFundsError"
    });
  }
}
Object.defineProperty(InsufficientFundsError, "nodeMessage", {
  enumerable: true,
  configurable: true,
  writable: true,
  value: /insufficient funds|exceeds transaction sender account balance/
});

class IntrinsicGasTooHighError extends BaseError3 {
  constructor({ cause, gas } = {}) {
    super(`The amount of gas ${gas ? `(${gas}) ` : ""}provided for the transaction exceeds the limit allowed for the block.`, {
      cause,
      name: "IntrinsicGasTooHighError"
    });
  }
}
Object.defineProperty(IntrinsicGasTooHighError, "nodeMessage", {
  enumerable: true,
  configurable: true,
  writable: true,
  value: /intrinsic gas too high|gas limit reached/
});

class IntrinsicGasTooLowError extends BaseError3 {
  constructor({ cause, gas } = {}) {
    super(`The amount of gas ${gas ? `(${gas}) ` : ""}provided for the transaction is too low.`, {
      cause,
      name: "IntrinsicGasTooLowError"
    });
  }
}
Object.defineProperty(IntrinsicGasTooLowError, "nodeMessage", {
  enumerable: true,
  configurable: true,
  writable: true,
  value: /intrinsic gas too low/
});

class TransactionTypeNotSupportedError extends BaseError3 {
  constructor({ cause }) {
    super("The transaction type is not supported for this chain.", {
      cause,
      name: "TransactionTypeNotSupportedError"
    });
  }
}
Object.defineProperty(TransactionTypeNotSupportedError, "nodeMessage", {
  enumerable: true,
  configurable: true,
  writable: true,
  value: /transaction type not valid/
});

class TipAboveFeeCapError extends BaseError3 {
  constructor({ cause, maxPriorityFeePerGas, maxFeePerGas } = {}) {
    super([
      `The provided tip (\`maxPriorityFeePerGas\`${maxPriorityFeePerGas ? ` = ${formatGwei(maxPriorityFeePerGas)} gwei` : ""}) cannot be higher than the fee cap (\`maxFeePerGas\`${maxFeePerGas ? ` = ${formatGwei(maxFeePerGas)} gwei` : ""}).`
    ].join(`
`), {
      cause,
      name: "TipAboveFeeCapError"
    });
  }
}
Object.defineProperty(TipAboveFeeCapError, "nodeMessage", {
  enumerable: true,
  configurable: true,
  writable: true,
  value: /max priority fee per gas higher than max fee per gas|tip higher than fee cap/
});

class UnknownNodeError extends BaseError3 {
  constructor({ cause }) {
    super(`An error occurred while executing: ${cause?.shortMessage}`, {
      cause,
      name: "UnknownNodeError"
    });
  }
}

// ../../../../node_modules/.bun/viem@2.43.3+0470b0a66942a3da/node_modules/viem/_esm/errors/request.js
class HttpRequestError extends BaseError3 {
  constructor({ body, cause, details, headers, status, url }) {
    super("HTTP request failed.", {
      cause,
      details,
      metaMessages: [
        status && `Status: ${status}`,
        `URL: ${getUrl(url)}`,
        body && `Request body: ${stringify2(body)}`
      ].filter(Boolean),
      name: "HttpRequestError"
    });
    Object.defineProperty(this, "body", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: undefined
    });
    Object.defineProperty(this, "headers", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: undefined
    });
    Object.defineProperty(this, "status", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: undefined
    });
    Object.defineProperty(this, "url", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: undefined
    });
    this.body = body;
    this.headers = headers;
    this.status = status;
    this.url = url;
  }
}
class RpcRequestError extends BaseError3 {
  constructor({ body, error, url }) {
    super("RPC Request failed.", {
      cause: error,
      details: error.message,
      metaMessages: [`URL: ${getUrl(url)}`, `Request body: ${stringify2(body)}`],
      name: "RpcRequestError"
    });
    Object.defineProperty(this, "code", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: undefined
    });
    Object.defineProperty(this, "data", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: undefined
    });
    Object.defineProperty(this, "url", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: undefined
    });
    this.code = error.code;
    this.data = error.data;
    this.url = url;
  }
}
class TimeoutError extends BaseError3 {
  constructor({ body, url }) {
    super("The request took too long to respond.", {
      details: "The request timed out.",
      metaMessages: [`URL: ${getUrl(url)}`, `Request body: ${stringify2(body)}`],
      name: "TimeoutError"
    });
    Object.defineProperty(this, "url", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: undefined
    });
    this.url = url;
  }
}

// ../../../../node_modules/.bun/viem@2.43.3+0470b0a66942a3da/node_modules/viem/_esm/errors/rpc.js
var unknownErrorCode = -1;

class RpcError extends BaseError3 {
  constructor(cause, { code, docsPath: docsPath4, metaMessages, name, shortMessage }) {
    super(shortMessage, {
      cause,
      docsPath: docsPath4,
      metaMessages: metaMessages || cause?.metaMessages,
      name: name || "RpcError"
    });
    Object.defineProperty(this, "code", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: undefined
    });
    this.name = name || cause.name;
    this.code = cause instanceof RpcRequestError ? cause.code : code ?? unknownErrorCode;
  }
}

class ProviderRpcError extends RpcError {
  constructor(cause, options) {
    super(cause, options);
    Object.defineProperty(this, "data", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: undefined
    });
    this.data = options.data;
  }
}

class ParseRpcError extends RpcError {
  constructor(cause) {
    super(cause, {
      code: ParseRpcError.code,
      name: "ParseRpcError",
      shortMessage: "Invalid JSON was received by the server. An error occurred on the server while parsing the JSON text."
    });
  }
}
Object.defineProperty(ParseRpcError, "code", {
  enumerable: true,
  configurable: true,
  writable: true,
  value: -32700
});

class InvalidRequestRpcError extends RpcError {
  constructor(cause) {
    super(cause, {
      code: InvalidRequestRpcError.code,
      name: "InvalidRequestRpcError",
      shortMessage: "JSON is not a valid request object."
    });
  }
}
Object.defineProperty(InvalidRequestRpcError, "code", {
  enumerable: true,
  configurable: true,
  writable: true,
  value: -32600
});

class MethodNotFoundRpcError extends RpcError {
  constructor(cause, { method } = {}) {
    super(cause, {
      code: MethodNotFoundRpcError.code,
      name: "MethodNotFoundRpcError",
      shortMessage: `The method${method ? ` "${method}"` : ""} does not exist / is not available.`
    });
  }
}
Object.defineProperty(MethodNotFoundRpcError, "code", {
  enumerable: true,
  configurable: true,
  writable: true,
  value: -32601
});

class InvalidParamsRpcError extends RpcError {
  constructor(cause) {
    super(cause, {
      code: InvalidParamsRpcError.code,
      name: "InvalidParamsRpcError",
      shortMessage: [
        "Invalid parameters were provided to the RPC method.",
        "Double check you have provided the correct parameters."
      ].join(`
`)
    });
  }
}
Object.defineProperty(InvalidParamsRpcError, "code", {
  enumerable: true,
  configurable: true,
  writable: true,
  value: -32602
});

class InternalRpcError extends RpcError {
  constructor(cause) {
    super(cause, {
      code: InternalRpcError.code,
      name: "InternalRpcError",
      shortMessage: "An internal error was received."
    });
  }
}
Object.defineProperty(InternalRpcError, "code", {
  enumerable: true,
  configurable: true,
  writable: true,
  value: -32603
});

class InvalidInputRpcError extends RpcError {
  constructor(cause) {
    super(cause, {
      code: InvalidInputRpcError.code,
      name: "InvalidInputRpcError",
      shortMessage: [
        "Missing or invalid parameters.",
        "Double check you have provided the correct parameters."
      ].join(`
`)
    });
  }
}
Object.defineProperty(InvalidInputRpcError, "code", {
  enumerable: true,
  configurable: true,
  writable: true,
  value: -32000
});

class ResourceNotFoundRpcError extends RpcError {
  constructor(cause) {
    super(cause, {
      code: ResourceNotFoundRpcError.code,
      name: "ResourceNotFoundRpcError",
      shortMessage: "Requested resource not found."
    });
    Object.defineProperty(this, "name", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: "ResourceNotFoundRpcError"
    });
  }
}
Object.defineProperty(ResourceNotFoundRpcError, "code", {
  enumerable: true,
  configurable: true,
  writable: true,
  value: -32001
});

class ResourceUnavailableRpcError extends RpcError {
  constructor(cause) {
    super(cause, {
      code: ResourceUnavailableRpcError.code,
      name: "ResourceUnavailableRpcError",
      shortMessage: "Requested resource not available."
    });
  }
}
Object.defineProperty(ResourceUnavailableRpcError, "code", {
  enumerable: true,
  configurable: true,
  writable: true,
  value: -32002
});

class TransactionRejectedRpcError extends RpcError {
  constructor(cause) {
    super(cause, {
      code: TransactionRejectedRpcError.code,
      name: "TransactionRejectedRpcError",
      shortMessage: "Transaction creation failed."
    });
  }
}
Object.defineProperty(TransactionRejectedRpcError, "code", {
  enumerable: true,
  configurable: true,
  writable: true,
  value: -32003
});

class MethodNotSupportedRpcError extends RpcError {
  constructor(cause, { method } = {}) {
    super(cause, {
      code: MethodNotSupportedRpcError.code,
      name: "MethodNotSupportedRpcError",
      shortMessage: `Method${method ? ` "${method}"` : ""} is not supported.`
    });
  }
}
Object.defineProperty(MethodNotSupportedRpcError, "code", {
  enumerable: true,
  configurable: true,
  writable: true,
  value: -32004
});

class LimitExceededRpcError extends RpcError {
  constructor(cause) {
    super(cause, {
      code: LimitExceededRpcError.code,
      name: "LimitExceededRpcError",
      shortMessage: "Request exceeds defined limit."
    });
  }
}
Object.defineProperty(LimitExceededRpcError, "code", {
  enumerable: true,
  configurable: true,
  writable: true,
  value: -32005
});

class JsonRpcVersionUnsupportedError extends RpcError {
  constructor(cause) {
    super(cause, {
      code: JsonRpcVersionUnsupportedError.code,
      name: "JsonRpcVersionUnsupportedError",
      shortMessage: "Version of JSON-RPC protocol is not supported."
    });
  }
}
Object.defineProperty(JsonRpcVersionUnsupportedError, "code", {
  enumerable: true,
  configurable: true,
  writable: true,
  value: -32006
});

class UserRejectedRequestError extends ProviderRpcError {
  constructor(cause) {
    super(cause, {
      code: UserRejectedRequestError.code,
      name: "UserRejectedRequestError",
      shortMessage: "User rejected the request."
    });
  }
}
Object.defineProperty(UserRejectedRequestError, "code", {
  enumerable: true,
  configurable: true,
  writable: true,
  value: 4001
});

class UnauthorizedProviderError extends ProviderRpcError {
  constructor(cause) {
    super(cause, {
      code: UnauthorizedProviderError.code,
      name: "UnauthorizedProviderError",
      shortMessage: "The requested method and/or account has not been authorized by the user."
    });
  }
}
Object.defineProperty(UnauthorizedProviderError, "code", {
  enumerable: true,
  configurable: true,
  writable: true,
  value: 4100
});

class UnsupportedProviderMethodError extends ProviderRpcError {
  constructor(cause, { method } = {}) {
    super(cause, {
      code: UnsupportedProviderMethodError.code,
      name: "UnsupportedProviderMethodError",
      shortMessage: `The Provider does not support the requested method${method ? ` " ${method}"` : ""}.`
    });
  }
}
Object.defineProperty(UnsupportedProviderMethodError, "code", {
  enumerable: true,
  configurable: true,
  writable: true,
  value: 4200
});

class ProviderDisconnectedError extends ProviderRpcError {
  constructor(cause) {
    super(cause, {
      code: ProviderDisconnectedError.code,
      name: "ProviderDisconnectedError",
      shortMessage: "The Provider is disconnected from all chains."
    });
  }
}
Object.defineProperty(ProviderDisconnectedError, "code", {
  enumerable: true,
  configurable: true,
  writable: true,
  value: 4900
});

class ChainDisconnectedError extends ProviderRpcError {
  constructor(cause) {
    super(cause, {
      code: ChainDisconnectedError.code,
      name: "ChainDisconnectedError",
      shortMessage: "The Provider is not connected to the requested chain."
    });
  }
}
Object.defineProperty(ChainDisconnectedError, "code", {
  enumerable: true,
  configurable: true,
  writable: true,
  value: 4901
});

class SwitchChainError extends ProviderRpcError {
  constructor(cause) {
    super(cause, {
      code: SwitchChainError.code,
      name: "SwitchChainError",
      shortMessage: "An error occurred when attempting to switch chain."
    });
  }
}
Object.defineProperty(SwitchChainError, "code", {
  enumerable: true,
  configurable: true,
  writable: true,
  value: 4902
});

class UnsupportedNonOptionalCapabilityError extends ProviderRpcError {
  constructor(cause) {
    super(cause, {
      code: UnsupportedNonOptionalCapabilityError.code,
      name: "UnsupportedNonOptionalCapabilityError",
      shortMessage: "This Wallet does not support a capability that was not marked as optional."
    });
  }
}
Object.defineProperty(UnsupportedNonOptionalCapabilityError, "code", {
  enumerable: true,
  configurable: true,
  writable: true,
  value: 5700
});

class UnsupportedChainIdError extends ProviderRpcError {
  constructor(cause) {
    super(cause, {
      code: UnsupportedChainIdError.code,
      name: "UnsupportedChainIdError",
      shortMessage: "This Wallet does not support the requested chain ID."
    });
  }
}
Object.defineProperty(UnsupportedChainIdError, "code", {
  enumerable: true,
  configurable: true,
  writable: true,
  value: 5710
});

class DuplicateIdError extends ProviderRpcError {
  constructor(cause) {
    super(cause, {
      code: DuplicateIdError.code,
      name: "DuplicateIdError",
      shortMessage: "There is already a bundle submitted with this ID."
    });
  }
}
Object.defineProperty(DuplicateIdError, "code", {
  enumerable: true,
  configurable: true,
  writable: true,
  value: 5720
});

class UnknownBundleIdError extends ProviderRpcError {
  constructor(cause) {
    super(cause, {
      code: UnknownBundleIdError.code,
      name: "UnknownBundleIdError",
      shortMessage: "This bundle id is unknown / has not been submitted"
    });
  }
}
Object.defineProperty(UnknownBundleIdError, "code", {
  enumerable: true,
  configurable: true,
  writable: true,
  value: 5730
});

class BundleTooLargeError extends ProviderRpcError {
  constructor(cause) {
    super(cause, {
      code: BundleTooLargeError.code,
      name: "BundleTooLargeError",
      shortMessage: "The call bundle is too large for the Wallet to process."
    });
  }
}
Object.defineProperty(BundleTooLargeError, "code", {
  enumerable: true,
  configurable: true,
  writable: true,
  value: 5740
});

class AtomicReadyWalletRejectedUpgradeError extends ProviderRpcError {
  constructor(cause) {
    super(cause, {
      code: AtomicReadyWalletRejectedUpgradeError.code,
      name: "AtomicReadyWalletRejectedUpgradeError",
      shortMessage: "The Wallet can support atomicity after an upgrade, but the user rejected the upgrade."
    });
  }
}
Object.defineProperty(AtomicReadyWalletRejectedUpgradeError, "code", {
  enumerable: true,
  configurable: true,
  writable: true,
  value: 5750
});

class AtomicityNotSupportedError extends ProviderRpcError {
  constructor(cause) {
    super(cause, {
      code: AtomicityNotSupportedError.code,
      name: "AtomicityNotSupportedError",
      shortMessage: "The wallet does not support atomic execution but the request requires it."
    });
  }
}
Object.defineProperty(AtomicityNotSupportedError, "code", {
  enumerable: true,
  configurable: true,
  writable: true,
  value: 5760
});

class UnknownRpcError extends RpcError {
  constructor(cause) {
    super(cause, {
      name: "UnknownRpcError",
      shortMessage: "An unknown RPC error occurred."
    });
  }
}

// ../../../../node_modules/.bun/viem@2.43.3+0470b0a66942a3da/node_modules/viem/_esm/utils/errors/getNodeError.js
function getNodeError(err, args) {
  const message = (err.details || "").toLowerCase();
  const executionRevertedError = err instanceof BaseError3 ? err.walk((e) => e?.code === ExecutionRevertedError.code) : err;
  if (executionRevertedError instanceof BaseError3)
    return new ExecutionRevertedError({
      cause: err,
      message: executionRevertedError.details
    });
  if (ExecutionRevertedError.nodeMessage.test(message))
    return new ExecutionRevertedError({
      cause: err,
      message: err.details
    });
  if (FeeCapTooHighError.nodeMessage.test(message))
    return new FeeCapTooHighError({
      cause: err,
      maxFeePerGas: args?.maxFeePerGas
    });
  if (FeeCapTooLowError.nodeMessage.test(message))
    return new FeeCapTooLowError({
      cause: err,
      maxFeePerGas: args?.maxFeePerGas
    });
  if (NonceTooHighError.nodeMessage.test(message))
    return new NonceTooHighError({ cause: err, nonce: args?.nonce });
  if (NonceTooLowError.nodeMessage.test(message))
    return new NonceTooLowError({ cause: err, nonce: args?.nonce });
  if (NonceMaxValueError.nodeMessage.test(message))
    return new NonceMaxValueError({ cause: err, nonce: args?.nonce });
  if (InsufficientFundsError.nodeMessage.test(message))
    return new InsufficientFundsError({ cause: err });
  if (IntrinsicGasTooHighError.nodeMessage.test(message))
    return new IntrinsicGasTooHighError({ cause: err, gas: args?.gas });
  if (IntrinsicGasTooLowError.nodeMessage.test(message))
    return new IntrinsicGasTooLowError({ cause: err, gas: args?.gas });
  if (TransactionTypeNotSupportedError.nodeMessage.test(message))
    return new TransactionTypeNotSupportedError({ cause: err });
  if (TipAboveFeeCapError.nodeMessage.test(message))
    return new TipAboveFeeCapError({
      cause: err,
      maxFeePerGas: args?.maxFeePerGas,
      maxPriorityFeePerGas: args?.maxPriorityFeePerGas
    });
  return new UnknownNodeError({
    cause: err
  });
}

// ../../../../node_modules/.bun/viem@2.43.3+0470b0a66942a3da/node_modules/viem/_esm/utils/errors/getCallError.js
function getCallError(err, { docsPath: docsPath4, ...args }) {
  const cause = (() => {
    const cause2 = getNodeError(err, args);
    if (cause2 instanceof UnknownNodeError)
      return err;
    return cause2;
  })();
  return new CallExecutionError(cause, {
    docsPath: docsPath4,
    ...args
  });
}

// ../../../../node_modules/.bun/viem@2.43.3+0470b0a66942a3da/node_modules/viem/_esm/utils/formatters/extract.js
function extract(value_, { format }) {
  if (!format)
    return {};
  const value = {};
  function extract_(formatted2) {
    const keys = Object.keys(formatted2);
    for (const key of keys) {
      if (key in value_)
        value[key] = value_[key];
      if (formatted2[key] && typeof formatted2[key] === "object" && !Array.isArray(formatted2[key]))
        extract_(formatted2[key]);
    }
  }
  const formatted = format(value_ || {});
  extract_(formatted);
  return value;
}

// ../../../../node_modules/.bun/viem@2.43.3+0470b0a66942a3da/node_modules/viem/_esm/utils/formatters/formatter.js
function defineFormatter(type, format) {
  return ({ exclude, format: overrides }) => {
    return {
      exclude,
      format: (args, action) => {
        const formatted = format(args, action);
        if (exclude) {
          for (const key of exclude) {
            delete formatted[key];
          }
        }
        return {
          ...formatted,
          ...overrides(args, action)
        };
      },
      type
    };
  };
}

// ../../../../node_modules/.bun/viem@2.43.3+0470b0a66942a3da/node_modules/viem/_esm/utils/formatters/transactionRequest.js
var rpcTransactionType = {
  legacy: "0x0",
  eip2930: "0x1",
  eip1559: "0x2",
  eip4844: "0x3",
  eip7702: "0x4"
};
function formatTransactionRequest(request, _) {
  const rpcRequest = {};
  if (typeof request.authorizationList !== "undefined")
    rpcRequest.authorizationList = formatAuthorizationList(request.authorizationList);
  if (typeof request.accessList !== "undefined")
    rpcRequest.accessList = request.accessList;
  if (typeof request.blobVersionedHashes !== "undefined")
    rpcRequest.blobVersionedHashes = request.blobVersionedHashes;
  if (typeof request.blobs !== "undefined") {
    if (typeof request.blobs[0] !== "string")
      rpcRequest.blobs = request.blobs.map((x) => bytesToHex(x));
    else
      rpcRequest.blobs = request.blobs;
  }
  if (typeof request.data !== "undefined")
    rpcRequest.data = request.data;
  if (request.account)
    rpcRequest.from = request.account.address;
  if (typeof request.from !== "undefined")
    rpcRequest.from = request.from;
  if (typeof request.gas !== "undefined")
    rpcRequest.gas = numberToHex(request.gas);
  if (typeof request.gasPrice !== "undefined")
    rpcRequest.gasPrice = numberToHex(request.gasPrice);
  if (typeof request.maxFeePerBlobGas !== "undefined")
    rpcRequest.maxFeePerBlobGas = numberToHex(request.maxFeePerBlobGas);
  if (typeof request.maxFeePerGas !== "undefined")
    rpcRequest.maxFeePerGas = numberToHex(request.maxFeePerGas);
  if (typeof request.maxPriorityFeePerGas !== "undefined")
    rpcRequest.maxPriorityFeePerGas = numberToHex(request.maxPriorityFeePerGas);
  if (typeof request.nonce !== "undefined")
    rpcRequest.nonce = numberToHex(request.nonce);
  if (typeof request.to !== "undefined")
    rpcRequest.to = request.to;
  if (typeof request.type !== "undefined")
    rpcRequest.type = rpcTransactionType[request.type];
  if (typeof request.value !== "undefined")
    rpcRequest.value = numberToHex(request.value);
  return rpcRequest;
}
function formatAuthorizationList(authorizationList) {
  return authorizationList.map((authorization) => ({
    address: authorization.address,
    r: authorization.r ? numberToHex(BigInt(authorization.r)) : authorization.r,
    s: authorization.s ? numberToHex(BigInt(authorization.s)) : authorization.s,
    chainId: numberToHex(authorization.chainId),
    nonce: numberToHex(authorization.nonce),
    ...typeof authorization.yParity !== "undefined" ? { yParity: numberToHex(authorization.yParity) } : {},
    ...typeof authorization.v !== "undefined" && typeof authorization.yParity === "undefined" ? { v: numberToHex(authorization.v) } : {}
  }));
}

// ../../../../node_modules/.bun/viem@2.43.3+0470b0a66942a3da/node_modules/viem/_esm/utils/promise/withResolvers.js
function withResolvers() {
  let resolve = () => {
    return;
  };
  let reject = () => {
    return;
  };
  const promise = new Promise((resolve_, reject_) => {
    resolve = resolve_;
    reject = reject_;
  });
  return { promise, resolve, reject };
}

// ../../../../node_modules/.bun/viem@2.43.3+0470b0a66942a3da/node_modules/viem/_esm/utils/promise/createBatchScheduler.js
var schedulerCache = /* @__PURE__ */ new Map;
function createBatchScheduler({ fn, id, shouldSplitBatch, wait = 0, sort }) {
  const exec = async () => {
    const scheduler = getScheduler();
    flush();
    const args = scheduler.map(({ args: args2 }) => args2);
    if (args.length === 0)
      return;
    fn(args).then((data) => {
      if (sort && Array.isArray(data))
        data.sort(sort);
      for (let i = 0;i < scheduler.length; i++) {
        const { resolve } = scheduler[i];
        resolve?.([data[i], data]);
      }
    }).catch((err) => {
      for (let i = 0;i < scheduler.length; i++) {
        const { reject } = scheduler[i];
        reject?.(err);
      }
    });
  };
  const flush = () => schedulerCache.delete(id);
  const getBatchedArgs = () => getScheduler().map(({ args }) => args);
  const getScheduler = () => schedulerCache.get(id) || [];
  const setScheduler = (item) => schedulerCache.set(id, [...getScheduler(), item]);
  return {
    flush,
    async schedule(args) {
      const { promise, resolve, reject } = withResolvers();
      const split2 = shouldSplitBatch?.([...getBatchedArgs(), args]);
      if (split2)
        exec();
      const hasActiveScheduler = getScheduler().length > 0;
      if (hasActiveScheduler) {
        setScheduler({ args, resolve, reject });
        return promise;
      }
      setScheduler({ args, resolve, reject });
      setTimeout(exec, wait);
      return promise;
    }
  };
}

// ../../../../node_modules/.bun/viem@2.43.3+0470b0a66942a3da/node_modules/viem/_esm/utils/stateOverride.js
function serializeStateMapping(stateMapping) {
  if (!stateMapping || stateMapping.length === 0)
    return;
  return stateMapping.reduce((acc, { slot, value }) => {
    if (slot.length !== 66)
      throw new InvalidBytesLengthError({
        size: slot.length,
        targetSize: 66,
        type: "hex"
      });
    if (value.length !== 66)
      throw new InvalidBytesLengthError({
        size: value.length,
        targetSize: 66,
        type: "hex"
      });
    acc[slot] = value;
    return acc;
  }, {});
}
function serializeAccountStateOverride(parameters) {
  const { balance, nonce, state, stateDiff, code } = parameters;
  const rpcAccountStateOverride = {};
  if (code !== undefined)
    rpcAccountStateOverride.code = code;
  if (balance !== undefined)
    rpcAccountStateOverride.balance = numberToHex(balance);
  if (nonce !== undefined)
    rpcAccountStateOverride.nonce = numberToHex(nonce);
  if (state !== undefined)
    rpcAccountStateOverride.state = serializeStateMapping(state);
  if (stateDiff !== undefined) {
    if (rpcAccountStateOverride.state)
      throw new StateAssignmentConflictError;
    rpcAccountStateOverride.stateDiff = serializeStateMapping(stateDiff);
  }
  return rpcAccountStateOverride;
}
function serializeStateOverride(parameters) {
  if (!parameters)
    return;
  const rpcStateOverride = {};
  for (const { address, ...accountState } of parameters) {
    if (!isAddress(address, { strict: false }))
      throw new InvalidAddressError({ address });
    if (rpcStateOverride[address])
      throw new AccountStateConflictError({ address });
    rpcStateOverride[address] = serializeAccountStateOverride(accountState);
  }
  return rpcStateOverride;
}

// ../../../../node_modules/.bun/viem@2.43.3+0470b0a66942a3da/node_modules/viem/_esm/constants/number.js
var maxInt8 = 2n ** (8n - 1n) - 1n;
var maxInt16 = 2n ** (16n - 1n) - 1n;
var maxInt24 = 2n ** (24n - 1n) - 1n;
var maxInt32 = 2n ** (32n - 1n) - 1n;
var maxInt40 = 2n ** (40n - 1n) - 1n;
var maxInt48 = 2n ** (48n - 1n) - 1n;
var maxInt56 = 2n ** (56n - 1n) - 1n;
var maxInt64 = 2n ** (64n - 1n) - 1n;
var maxInt72 = 2n ** (72n - 1n) - 1n;
var maxInt80 = 2n ** (80n - 1n) - 1n;
var maxInt88 = 2n ** (88n - 1n) - 1n;
var maxInt96 = 2n ** (96n - 1n) - 1n;
var maxInt104 = 2n ** (104n - 1n) - 1n;
var maxInt112 = 2n ** (112n - 1n) - 1n;
var maxInt120 = 2n ** (120n - 1n) - 1n;
var maxInt128 = 2n ** (128n - 1n) - 1n;
var maxInt136 = 2n ** (136n - 1n) - 1n;
var maxInt144 = 2n ** (144n - 1n) - 1n;
var maxInt152 = 2n ** (152n - 1n) - 1n;
var maxInt160 = 2n ** (160n - 1n) - 1n;
var maxInt168 = 2n ** (168n - 1n) - 1n;
var maxInt176 = 2n ** (176n - 1n) - 1n;
var maxInt184 = 2n ** (184n - 1n) - 1n;
var maxInt192 = 2n ** (192n - 1n) - 1n;
var maxInt200 = 2n ** (200n - 1n) - 1n;
var maxInt208 = 2n ** (208n - 1n) - 1n;
var maxInt216 = 2n ** (216n - 1n) - 1n;
var maxInt224 = 2n ** (224n - 1n) - 1n;
var maxInt232 = 2n ** (232n - 1n) - 1n;
var maxInt240 = 2n ** (240n - 1n) - 1n;
var maxInt248 = 2n ** (248n - 1n) - 1n;
var maxInt256 = 2n ** (256n - 1n) - 1n;
var minInt8 = -(2n ** (8n - 1n));
var minInt16 = -(2n ** (16n - 1n));
var minInt24 = -(2n ** (24n - 1n));
var minInt32 = -(2n ** (32n - 1n));
var minInt40 = -(2n ** (40n - 1n));
var minInt48 = -(2n ** (48n - 1n));
var minInt56 = -(2n ** (56n - 1n));
var minInt64 = -(2n ** (64n - 1n));
var minInt72 = -(2n ** (72n - 1n));
var minInt80 = -(2n ** (80n - 1n));
var minInt88 = -(2n ** (88n - 1n));
var minInt96 = -(2n ** (96n - 1n));
var minInt104 = -(2n ** (104n - 1n));
var minInt112 = -(2n ** (112n - 1n));
var minInt120 = -(2n ** (120n - 1n));
var minInt128 = -(2n ** (128n - 1n));
var minInt136 = -(2n ** (136n - 1n));
var minInt144 = -(2n ** (144n - 1n));
var minInt152 = -(2n ** (152n - 1n));
var minInt160 = -(2n ** (160n - 1n));
var minInt168 = -(2n ** (168n - 1n));
var minInt176 = -(2n ** (176n - 1n));
var minInt184 = -(2n ** (184n - 1n));
var minInt192 = -(2n ** (192n - 1n));
var minInt200 = -(2n ** (200n - 1n));
var minInt208 = -(2n ** (208n - 1n));
var minInt216 = -(2n ** (216n - 1n));
var minInt224 = -(2n ** (224n - 1n));
var minInt232 = -(2n ** (232n - 1n));
var minInt240 = -(2n ** (240n - 1n));
var minInt248 = -(2n ** (248n - 1n));
var minInt256 = -(2n ** (256n - 1n));
var maxUint8 = 2n ** 8n - 1n;
var maxUint16 = 2n ** 16n - 1n;
var maxUint24 = 2n ** 24n - 1n;
var maxUint32 = 2n ** 32n - 1n;
var maxUint40 = 2n ** 40n - 1n;
var maxUint48 = 2n ** 48n - 1n;
var maxUint56 = 2n ** 56n - 1n;
var maxUint64 = 2n ** 64n - 1n;
var maxUint72 = 2n ** 72n - 1n;
var maxUint80 = 2n ** 80n - 1n;
var maxUint88 = 2n ** 88n - 1n;
var maxUint96 = 2n ** 96n - 1n;
var maxUint104 = 2n ** 104n - 1n;
var maxUint112 = 2n ** 112n - 1n;
var maxUint120 = 2n ** 120n - 1n;
var maxUint128 = 2n ** 128n - 1n;
var maxUint136 = 2n ** 136n - 1n;
var maxUint144 = 2n ** 144n - 1n;
var maxUint152 = 2n ** 152n - 1n;
var maxUint160 = 2n ** 160n - 1n;
var maxUint168 = 2n ** 168n - 1n;
var maxUint176 = 2n ** 176n - 1n;
var maxUint184 = 2n ** 184n - 1n;
var maxUint192 = 2n ** 192n - 1n;
var maxUint200 = 2n ** 200n - 1n;
var maxUint208 = 2n ** 208n - 1n;
var maxUint216 = 2n ** 216n - 1n;
var maxUint224 = 2n ** 224n - 1n;
var maxUint232 = 2n ** 232n - 1n;
var maxUint240 = 2n ** 240n - 1n;
var maxUint248 = 2n ** 248n - 1n;
var maxUint256 = 2n ** 256n - 1n;

// ../../../../node_modules/.bun/viem@2.43.3+0470b0a66942a3da/node_modules/viem/_esm/utils/transaction/assertRequest.js
function assertRequest(args) {
  const { account: account_, maxFeePerGas, maxPriorityFeePerGas, to } = args;
  const account = account_ ? parseAccount(account_) : undefined;
  if (account && !isAddress(account.address))
    throw new InvalidAddressError({ address: account.address });
  if (to && !isAddress(to))
    throw new InvalidAddressError({ address: to });
  if (maxFeePerGas && maxFeePerGas > maxUint256)
    throw new FeeCapTooHighError({ maxFeePerGas });
  if (maxPriorityFeePerGas && maxFeePerGas && maxPriorityFeePerGas > maxFeePerGas)
    throw new TipAboveFeeCapError({ maxFeePerGas, maxPriorityFeePerGas });
}

// ../../../../node_modules/.bun/viem@2.43.3+0470b0a66942a3da/node_modules/viem/_esm/actions/public/call.js
async function call(client, args) {
  const { account: account_ = client.account, authorizationList, batch = Boolean(client.batch?.multicall), blockNumber, blockTag = client.experimental_blockTag ?? "latest", accessList, blobs, blockOverrides, code, data: data_, factory, factoryData, gas, gasPrice, maxFeePerBlobGas, maxFeePerGas, maxPriorityFeePerGas, nonce, to, value, stateOverride, ...rest } = args;
  const account = account_ ? parseAccount(account_) : undefined;
  if (code && (factory || factoryData))
    throw new BaseError3("Cannot provide both `code` & `factory`/`factoryData` as parameters.");
  if (code && to)
    throw new BaseError3("Cannot provide both `code` & `to` as parameters.");
  const deploylessCallViaBytecode = code && data_;
  const deploylessCallViaFactory = factory && factoryData && to && data_;
  const deploylessCall = deploylessCallViaBytecode || deploylessCallViaFactory;
  const data = (() => {
    if (deploylessCallViaBytecode)
      return toDeploylessCallViaBytecodeData({
        code,
        data: data_
      });
    if (deploylessCallViaFactory)
      return toDeploylessCallViaFactoryData({
        data: data_,
        factory,
        factoryData,
        to
      });
    return data_;
  })();
  try {
    assertRequest(args);
    const blockNumberHex = typeof blockNumber === "bigint" ? numberToHex(blockNumber) : undefined;
    const block = blockNumberHex || blockTag;
    const rpcBlockOverrides = blockOverrides ? toRpc2(blockOverrides) : undefined;
    const rpcStateOverride = serializeStateOverride(stateOverride);
    const chainFormat = client.chain?.formatters?.transactionRequest?.format;
    const format = chainFormat || formatTransactionRequest;
    const request = format({
      ...extract(rest, { format: chainFormat }),
      accessList,
      account,
      authorizationList,
      blobs,
      data,
      gas,
      gasPrice,
      maxFeePerBlobGas,
      maxFeePerGas,
      maxPriorityFeePerGas,
      nonce,
      to: deploylessCall ? undefined : to,
      value
    }, "call");
    if (batch && shouldPerformMulticall({ request }) && !rpcStateOverride && !rpcBlockOverrides) {
      try {
        return await scheduleMulticall(client, {
          ...request,
          blockNumber,
          blockTag
        });
      } catch (err) {
        if (!(err instanceof ClientChainNotConfiguredError) && !(err instanceof ChainDoesNotSupportContract))
          throw err;
      }
    }
    const params = (() => {
      const base = [
        request,
        block
      ];
      if (rpcStateOverride && rpcBlockOverrides)
        return [...base, rpcStateOverride, rpcBlockOverrides];
      if (rpcStateOverride)
        return [...base, rpcStateOverride];
      if (rpcBlockOverrides)
        return [...base, {}, rpcBlockOverrides];
      return base;
    })();
    const response = await client.request({
      method: "eth_call",
      params
    });
    if (response === "0x")
      return { data: undefined };
    return { data: response };
  } catch (err) {
    const data2 = getRevertErrorData(err);
    const { offchainLookup, offchainLookupSignature } = await import("./ccip-7ge9frk6.js");
    if (client.ccipRead !== false && data2?.slice(0, 10) === offchainLookupSignature && to)
      return { data: await offchainLookup(client, { data: data2, to }) };
    if (deploylessCall && data2?.slice(0, 10) === "0x101bb98d")
      throw new CounterfactualDeploymentFailedError({ factory });
    throw getCallError(err, {
      ...args,
      account,
      chain: client.chain
    });
  }
}
function shouldPerformMulticall({ request }) {
  const { data, to, ...request_ } = request;
  if (!data)
    return false;
  if (data.startsWith(aggregate3Signature))
    return false;
  if (!to)
    return false;
  if (Object.values(request_).filter((x) => typeof x !== "undefined").length > 0)
    return false;
  return true;
}
async function scheduleMulticall(client, args) {
  const { batchSize = 1024, deployless = false, wait = 0 } = typeof client.batch?.multicall === "object" ? client.batch.multicall : {};
  const { blockNumber, blockTag = client.experimental_blockTag ?? "latest", data, to } = args;
  const multicallAddress = (() => {
    if (deployless)
      return null;
    if (args.multicallAddress)
      return args.multicallAddress;
    if (client.chain) {
      return getChainContractAddress({
        blockNumber,
        chain: client.chain,
        contract: "multicall3"
      });
    }
    throw new ClientChainNotConfiguredError;
  })();
  const blockNumberHex = typeof blockNumber === "bigint" ? numberToHex(blockNumber) : undefined;
  const block = blockNumberHex || blockTag;
  const { schedule } = createBatchScheduler({
    id: `${client.uid}.${block}`,
    wait,
    shouldSplitBatch(args2) {
      const size4 = args2.reduce((size5, { data: data2 }) => size5 + (data2.length - 2), 0);
      return size4 > batchSize * 2;
    },
    fn: async (requests) => {
      const calls = requests.map((request) => ({
        allowFailure: true,
        callData: request.data,
        target: request.to
      }));
      const calldata = encodeFunctionData({
        abi: multicall3Abi,
        args: [calls],
        functionName: "aggregate3"
      });
      const data2 = await client.request({
        method: "eth_call",
        params: [
          {
            ...multicallAddress === null ? {
              data: toDeploylessCallViaBytecodeData({
                code: multicall3Bytecode,
                data: calldata
              })
            } : { to: multicallAddress, data: calldata }
          },
          block
        ]
      });
      return decodeFunctionResult({
        abi: multicall3Abi,
        args: [calls],
        functionName: "aggregate3",
        data: data2 || "0x"
      });
    }
  });
  const [{ returnData, success }] = await schedule({ data, to });
  if (!success)
    throw new RawContractError({ data: returnData });
  if (returnData === "0x")
    return { data: undefined };
  return { data: returnData };
}
function toDeploylessCallViaBytecodeData(parameters) {
  const { code, data } = parameters;
  return encodeDeployData({
    abi: parseAbi(["constructor(bytes, bytes)"]),
    bytecode: deploylessCallViaBytecodeBytecode,
    args: [code, data]
  });
}
function toDeploylessCallViaFactoryData(parameters) {
  const { data, factory, factoryData, to } = parameters;
  return encodeDeployData({
    abi: parseAbi(["constructor(address, bytes, address, bytes)"]),
    bytecode: deploylessCallViaFactoryBytecode,
    args: [to, data, factory, factoryData]
  });
}
function getRevertErrorData(err) {
  if (!(err instanceof BaseError3))
    return;
  const error = err.walk();
  return typeof error?.data === "object" ? error.data?.data : error.data;
}

// ../../../../node_modules/.bun/viem@2.43.3+0470b0a66942a3da/node_modules/viem/_esm/errors/ccip.js
class OffchainLookupError extends BaseError3 {
  constructor({ callbackSelector, cause, data, extraData, sender, urls }) {
    super(cause.shortMessage || "An error occurred while fetching for an offchain result.", {
      cause,
      metaMessages: [
        ...cause.metaMessages || [],
        cause.metaMessages?.length ? "" : [],
        "Offchain Gateway Call:",
        urls && [
          "  Gateway URL(s):",
          ...urls.map((url) => `    ${getUrl(url)}`)
        ],
        `  Sender: ${sender}`,
        `  Data: ${data}`,
        `  Callback selector: ${callbackSelector}`,
        `  Extra data: ${extraData}`
      ].flat(),
      name: "OffchainLookupError"
    });
  }
}

class OffchainLookupResponseMalformedError extends BaseError3 {
  constructor({ result, url }) {
    super("Offchain gateway response is malformed. Response data must be a hex value.", {
      metaMessages: [
        `Gateway URL: ${getUrl(url)}`,
        `Response: ${stringify2(result)}`
      ],
      name: "OffchainLookupResponseMalformedError"
    });
  }
}

class OffchainLookupSenderMismatchError extends BaseError3 {
  constructor({ sender, to }) {
    super("Reverted sender address does not match target contract address (`to`).", {
      metaMessages: [
        `Contract address: ${to}`,
        `OffchainLookup sender address: ${sender}`
      ],
      name: "OffchainLookupSenderMismatchError"
    });
  }
}

// ../../../../node_modules/.bun/viem@2.43.3+0470b0a66942a3da/node_modules/viem/_esm/utils/address/isAddressEqual.js
function isAddressEqual(a, b) {
  if (!isAddress(a, { strict: false }))
    throw new InvalidAddressError({ address: a });
  if (!isAddress(b, { strict: false }))
    throw new InvalidAddressError({ address: b });
  return a.toLowerCase() === b.toLowerCase();
}

// ../../../../node_modules/.bun/viem@2.43.3+0470b0a66942a3da/node_modules/viem/_esm/utils/abi/decodeFunctionData.js
function decodeFunctionData(parameters) {
  const { abi, data } = parameters;
  const signature = slice3(data, 0, 4);
  const description = abi.find((x) => x.type === "function" && signature === toFunctionSelector(formatAbiItem2(x)));
  if (!description)
    throw new AbiFunctionSignatureNotFoundError(signature, {
      docsPath: "/docs/contract/decodeFunctionData"
    });
  return {
    functionName: description.name,
    args: "inputs" in description && description.inputs && description.inputs.length > 0 ? decodeAbiParameters(description.inputs, slice3(data, 4)) : undefined
  };
}

// ../../../../node_modules/.bun/viem@2.43.3+0470b0a66942a3da/node_modules/viem/_esm/utils/abi/encodeErrorResult.js
var docsPath4 = "/docs/contract/encodeErrorResult";
function encodeErrorResult(parameters) {
  const { abi, errorName, args } = parameters;
  let abiItem = abi[0];
  if (errorName) {
    const item = getAbiItem({ abi, args, name: errorName });
    if (!item)
      throw new AbiErrorNotFoundError(errorName, { docsPath: docsPath4 });
    abiItem = item;
  }
  if (abiItem.type !== "error")
    throw new AbiErrorNotFoundError(undefined, { docsPath: docsPath4 });
  const definition = formatAbiItem2(abiItem);
  const signature = toFunctionSelector(definition);
  let data = "0x";
  if (args && args.length > 0) {
    if (!abiItem.inputs)
      throw new AbiErrorInputsNotFoundError(abiItem.name, { docsPath: docsPath4 });
    data = encodeAbiParameters(abiItem.inputs, args);
  }
  return concatHex([signature, data]);
}

// ../../../../node_modules/.bun/viem@2.43.3+0470b0a66942a3da/node_modules/viem/_esm/utils/abi/encodeFunctionResult.js
var docsPath5 = "/docs/contract/encodeFunctionResult";
function encodeFunctionResult(parameters) {
  const { abi, functionName, result } = parameters;
  let abiItem = abi[0];
  if (functionName) {
    const item = getAbiItem({ abi, name: functionName });
    if (!item)
      throw new AbiFunctionNotFoundError(functionName, { docsPath: docsPath5 });
    abiItem = item;
  }
  if (abiItem.type !== "function")
    throw new AbiFunctionNotFoundError(undefined, { docsPath: docsPath5 });
  if (!abiItem.outputs)
    throw new AbiFunctionOutputsNotFoundError(abiItem.name, { docsPath: docsPath5 });
  const values = (() => {
    if (abiItem.outputs.length === 0)
      return [];
    if (abiItem.outputs.length === 1)
      return [result];
    if (Array.isArray(result))
      return result;
    throw new InvalidArrayError(result);
  })();
  return encodeAbiParameters(abiItem.outputs, values);
}

// ../../../../node_modules/.bun/viem@2.43.3+0470b0a66942a3da/node_modules/viem/_esm/utils/ens/localBatchGatewayRequest.js
var localBatchGatewayUrl = "x-batch-gateway:true";
async function localBatchGatewayRequest(parameters) {
  const { data, ccipRequest } = parameters;
  const { args: [queries] } = decodeFunctionData({ abi: batchGatewayAbi, data });
  const failures = [];
  const responses = [];
  await Promise.all(queries.map(async (query, i) => {
    try {
      responses[i] = query.urls.includes(localBatchGatewayUrl) ? await localBatchGatewayRequest({ data: query.data, ccipRequest }) : await ccipRequest(query);
      failures[i] = false;
    } catch (err) {
      failures[i] = true;
      responses[i] = encodeError(err);
    }
  }));
  return encodeFunctionResult({
    abi: batchGatewayAbi,
    functionName: "query",
    result: [failures, responses]
  });
}
function encodeError(error) {
  if (error.name === "HttpRequestError" && error.status)
    return encodeErrorResult({
      abi: batchGatewayAbi,
      errorName: "HttpError",
      args: [error.status, error.shortMessage]
    });
  return encodeErrorResult({
    abi: [solidityError],
    errorName: "Error",
    args: ["shortMessage" in error ? error.shortMessage : error.message]
  });
}

// ../../../../node_modules/.bun/viem@2.43.3+0470b0a66942a3da/node_modules/viem/_esm/utils/ccip.js
var offchainLookupSignature = "0x556f1830";
var offchainLookupAbiItem = {
  name: "OffchainLookup",
  type: "error",
  inputs: [
    {
      name: "sender",
      type: "address"
    },
    {
      name: "urls",
      type: "string[]"
    },
    {
      name: "callData",
      type: "bytes"
    },
    {
      name: "callbackFunction",
      type: "bytes4"
    },
    {
      name: "extraData",
      type: "bytes"
    }
  ]
};
async function offchainLookup(client, { blockNumber, blockTag, data, to }) {
  const { args } = decodeErrorResult({
    data,
    abi: [offchainLookupAbiItem]
  });
  const [sender, urls, callData, callbackSelector, extraData] = args;
  const { ccipRead } = client;
  const ccipRequest_ = ccipRead && typeof ccipRead?.request === "function" ? ccipRead.request : ccipRequest;
  try {
    if (!isAddressEqual(to, sender))
      throw new OffchainLookupSenderMismatchError({ sender, to });
    const result = urls.includes(localBatchGatewayUrl) ? await localBatchGatewayRequest({
      data: callData,
      ccipRequest: ccipRequest_
    }) : await ccipRequest_({ data: callData, sender, urls });
    const { data: data_ } = await call(client, {
      blockNumber,
      blockTag,
      data: concat2([
        callbackSelector,
        encodeAbiParameters([{ type: "bytes" }, { type: "bytes" }], [result, extraData])
      ]),
      to
    });
    return data_;
  } catch (err) {
    throw new OffchainLookupError({
      callbackSelector,
      cause: err,
      data,
      extraData,
      sender,
      urls
    });
  }
}
async function ccipRequest({ data, sender, urls }) {
  let error = new Error("An unknown error occurred.");
  for (let i = 0;i < urls.length; i++) {
    const url = urls[i];
    const method = url.includes("{data}") ? "GET" : "POST";
    const body = method === "POST" ? { data, sender } : undefined;
    const headers = method === "POST" ? { "Content-Type": "application/json" } : {};
    try {
      const response = await fetch(url.replace("{sender}", sender.toLowerCase()).replace("{data}", data), {
        body: JSON.stringify(body),
        headers,
        method
      });
      let result;
      if (response.headers.get("Content-Type")?.startsWith("application/json")) {
        result = (await response.json()).data;
      } else {
        result = await response.text();
      }
      if (!response.ok) {
        error = new HttpRequestError({
          body,
          details: result?.error ? stringify2(result.error) : response.statusText,
          headers: response.headers,
          status: response.status,
          url
        });
        continue;
      }
      if (!isHex(result)) {
        error = new OffchainLookupResponseMalformedError({
          result,
          url
        });
        continue;
      }
      return result;
    } catch (err) {
      error = new HttpRequestError({
        body,
        details: err.message,
        url
      });
    }
  }
  throw error;
}
export {
  offchainLookupSignature,
  offchainLookupAbiItem,
  offchainLookup,
  ccipRequest
};

export { formatAbiParameters, formatAbiItem, parseAbiItem, parseAbiParameters, formatAbiItem2 as formatAbiItem1, isHex, size3 as size, BaseError3 as BaseError, AbiDecodingDataSizeTooSmallError, AbiDecodingZeroDataError, AbiEventSignatureEmptyTopicsError, AbiEventSignatureNotFoundError, AbiEventNotFoundError, BytesSizeMismatchError, DecodeLogDataMismatch, DecodeLogTopicsMismatch, trim3 as trim, hexToBigInt, hexToBool, hexToNumber, toHex, bytesToHex, numberToHex, stringToHex, toBytes2 as toBytes, hexToBytes, stringToBytes, keccak_256, keccak256, toEventSelector, InvalidAddressError, LruMap, checksumAddress, getAddress, isAddress, concat2 as concat, concatHex, slice3 as slice, sliceHex, bytesRegex2 as bytesRegex, integerRegex2 as integerRegex, encodeAbiParameters, getAbiItem, parseAccount, encodeFunctionData, PositionOutOfBoundsError, createCursor, decodeAbiParameters, stringify2 as stringify, formatEther, formatGwei, prettyPrint, InvalidLegacyVError, InvalidSerializableTransactionError, InvalidStorageKeySizeError, TransactionExecutionError, TransactionNotFoundError, TransactionReceiptNotFoundError, TransactionReceiptRevertedError, WaitForTransactionReceiptTimeoutError, CallExecutionError, ContractFunctionExecutionError, ContractFunctionRevertedError, ContractFunctionZeroDataError, RawContractError, HttpRequestError, RpcRequestError, TimeoutError, ParseRpcError, InvalidRequestRpcError, MethodNotFoundRpcError, InvalidParamsRpcError, InternalRpcError, InvalidInputRpcError, ResourceNotFoundRpcError, ResourceUnavailableRpcError, TransactionRejectedRpcError, MethodNotSupportedRpcError, LimitExceededRpcError, JsonRpcVersionUnsupportedError, UserRejectedRequestError, UnauthorizedProviderError, UnsupportedProviderMethodError, ProviderDisconnectedError, ChainDisconnectedError, SwitchChainError, UnsupportedNonOptionalCapabilityError, UnsupportedChainIdError, DuplicateIdError, UnknownBundleIdError, BundleTooLargeError, AtomicReadyWalletRejectedUpgradeError, AtomicityNotSupportedError, UnknownRpcError, FeeCapTooHighError, TipAboveFeeCapError, UnknownNodeError, getNodeError, extract, defineFormatter, formatTransactionRequest, serializeStateOverride, maxUint256, assertRequest, isAddressEqual, decodeFunctionResult, BaseError2 as BaseError1, stringify as stringify1, from, fromHex, fromString, size as size1, slice as slice1, toBigInt2 as toBigInt, toBoolean, toNumber2 as toNumber, toString, trimLeft, validate, concat as concat1, from2 as from1, fromBoolean, fromBytes, fromNumber, fromString2 as fromString1, padLeft, padRight, slice2, size2, trimLeft2 as trimLeft1, toNumber as toNumber1, validate2 as validate1, IntegerOutOfRangeError, toRpc2 as toRpc, multicall3Abi, universalResolverResolveAbi, universalResolverReverseAbi, textResolverAbi, addressResolverAbi, erc1271Abi, erc6492SignatureValidatorAbi, deploylessCallViaBytecodeBytecode, erc6492SignatureValidatorByteCode, multicall3Bytecode, ChainMismatchError, ChainNotFoundError, InvalidChainIdError, encodeDeployData, getChainContractAddress, getCallError, withResolvers, createBatchScheduler, localBatchGatewayUrl, call };

//# debugId=EE2F2AAEAEFFF23764756E2164756E21
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzLy5idW4vYWJpdHlwZUAxLjIuMyswNDcwYjBhNjY5NDJhM2RhL25vZGVfbW9kdWxlcy9hYml0eXBlL2Rpc3QvZXNtL3ZlcnNpb24uanMiLCAiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzLy5idW4vYWJpdHlwZUAxLjIuMyswNDcwYjBhNjY5NDJhM2RhL25vZGVfbW9kdWxlcy9hYml0eXBlL2Rpc3QvZXNtL2Vycm9ycy5qcyIsICIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvLmJ1bi9hYml0eXBlQDEuMi4zKzA0NzBiMGE2Njk0MmEzZGEvbm9kZV9tb2R1bGVzL2FiaXR5cGUvZGlzdC9lc20vcmVnZXguanMiLCAiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzLy5idW4vYWJpdHlwZUAxLjIuMyswNDcwYjBhNjY5NDJhM2RhL25vZGVfbW9kdWxlcy9hYml0eXBlL2Rpc3QvZXNtL2h1bWFuLXJlYWRhYmxlL2Zvcm1hdEFiaVBhcmFtZXRlci5qcyIsICIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvLmJ1bi9hYml0eXBlQDEuMi4zKzA0NzBiMGE2Njk0MmEzZGEvbm9kZV9tb2R1bGVzL2FiaXR5cGUvZGlzdC9lc20vaHVtYW4tcmVhZGFibGUvZm9ybWF0QWJpUGFyYW1ldGVycy5qcyIsICIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvLmJ1bi9hYml0eXBlQDEuMi4zKzA0NzBiMGE2Njk0MmEzZGEvbm9kZV9tb2R1bGVzL2FiaXR5cGUvZGlzdC9lc20vaHVtYW4tcmVhZGFibGUvZm9ybWF0QWJpSXRlbS5qcyIsICIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvLmJ1bi9hYml0eXBlQDEuMi4zKzA0NzBiMGE2Njk0MmEzZGEvbm9kZV9tb2R1bGVzL2FiaXR5cGUvZGlzdC9lc20vaHVtYW4tcmVhZGFibGUvcnVudGltZS9zaWduYXR1cmVzLmpzIiwgIi4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy8uYnVuL2FiaXR5cGVAMS4yLjMrMDQ3MGIwYTY2OTQyYTNkYS9ub2RlX21vZHVsZXMvYWJpdHlwZS9kaXN0L2VzbS9odW1hbi1yZWFkYWJsZS9lcnJvcnMvYWJpSXRlbS5qcyIsICIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvLmJ1bi9hYml0eXBlQDEuMi4zKzA0NzBiMGE2Njk0MmEzZGEvbm9kZV9tb2R1bGVzL2FiaXR5cGUvZGlzdC9lc20vaHVtYW4tcmVhZGFibGUvZXJyb3JzL2FiaVBhcmFtZXRlci5qcyIsICIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvLmJ1bi9hYml0eXBlQDEuMi4zKzA0NzBiMGE2Njk0MmEzZGEvbm9kZV9tb2R1bGVzL2FiaXR5cGUvZGlzdC9lc20vaHVtYW4tcmVhZGFibGUvZXJyb3JzL3NpZ25hdHVyZS5qcyIsICIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvLmJ1bi9hYml0eXBlQDEuMi4zKzA0NzBiMGE2Njk0MmEzZGEvbm9kZV9tb2R1bGVzL2FiaXR5cGUvZGlzdC9lc20vaHVtYW4tcmVhZGFibGUvZXJyb3JzL3N0cnVjdC5qcyIsICIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvLmJ1bi9hYml0eXBlQDEuMi4zKzA0NzBiMGE2Njk0MmEzZGEvbm9kZV9tb2R1bGVzL2FiaXR5cGUvZGlzdC9lc20vaHVtYW4tcmVhZGFibGUvZXJyb3JzL3NwbGl0UGFyYW1ldGVycy5qcyIsICIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvLmJ1bi9hYml0eXBlQDEuMi4zKzA0NzBiMGE2Njk0MmEzZGEvbm9kZV9tb2R1bGVzL2FiaXR5cGUvZGlzdC9lc20vaHVtYW4tcmVhZGFibGUvcnVudGltZS9jYWNoZS5qcyIsICIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvLmJ1bi9hYml0eXBlQDEuMi4zKzA0NzBiMGE2Njk0MmEzZGEvbm9kZV9tb2R1bGVzL2FiaXR5cGUvZGlzdC9lc20vaHVtYW4tcmVhZGFibGUvcnVudGltZS91dGlscy5qcyIsICIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvLmJ1bi9hYml0eXBlQDEuMi4zKzA0NzBiMGE2Njk0MmEzZGEvbm9kZV9tb2R1bGVzL2FiaXR5cGUvZGlzdC9lc20vaHVtYW4tcmVhZGFibGUvcnVudGltZS9zdHJ1Y3RzLmpzIiwgIi4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy8uYnVuL2FiaXR5cGVAMS4yLjMrMDQ3MGIwYTY2OTQyYTNkYS9ub2RlX21vZHVsZXMvYWJpdHlwZS9kaXN0L2VzbS9odW1hbi1yZWFkYWJsZS9wYXJzZUFiaS5qcyIsICIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvLmJ1bi9hYml0eXBlQDEuMi4zKzA0NzBiMGE2Njk0MmEzZGEvbm9kZV9tb2R1bGVzL2FiaXR5cGUvZGlzdC9lc20vaHVtYW4tcmVhZGFibGUvcGFyc2VBYmlJdGVtLmpzIiwgIi4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy8uYnVuL2FiaXR5cGVAMS4yLjMrMDQ3MGIwYTY2OTQyYTNkYS9ub2RlX21vZHVsZXMvYWJpdHlwZS9kaXN0L2VzbS9odW1hbi1yZWFkYWJsZS9wYXJzZUFiaVBhcmFtZXRlcnMuanMiLCAiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzLy5idW4vb3hAMC4xMS4xKzA0NzBiMGE2Njk0MmEzZGEvbm9kZV9tb2R1bGVzL294L19lc20vY29yZS92ZXJzaW9uLmpzIiwgIi4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy8uYnVuL294QDAuMTEuMSswNDcwYjBhNjY5NDJhM2RhL25vZGVfbW9kdWxlcy9veC9fZXNtL2NvcmUvaW50ZXJuYWwvZXJyb3JzLmpzIiwgIi4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy8uYnVuL294QDAuMTEuMSswNDcwYjBhNjY5NDJhM2RhL25vZGVfbW9kdWxlcy9veC9fZXNtL2NvcmUvRXJyb3JzLmpzIiwgIi4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy8uYnVuL294QDAuMTEuMSswNDcwYjBhNjY5NDJhM2RhL25vZGVfbW9kdWxlcy9veC9fZXNtL2NvcmUvaW50ZXJuYWwvYnl0ZXMuanMiLCAiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzLy5idW4vb3hAMC4xMS4xKzA0NzBiMGE2Njk0MmEzZGEvbm9kZV9tb2R1bGVzL294L19lc20vY29yZS9pbnRlcm5hbC9oZXguanMiLCAiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzLy5idW4vb3hAMC4xMS4xKzA0NzBiMGE2Njk0MmEzZGEvbm9kZV9tb2R1bGVzL294L19lc20vY29yZS9Kc29uLmpzIiwgIi4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy8uYnVuL294QDAuMTEuMSswNDcwYjBhNjY5NDJhM2RhL25vZGVfbW9kdWxlcy9veC9fZXNtL2NvcmUvQnl0ZXMuanMiLCAiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzLy5idW4vb3hAMC4xMS4xKzA0NzBiMGE2Njk0MmEzZGEvbm9kZV9tb2R1bGVzL294L19lc20vY29yZS9IZXguanMiLCAiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzLy5idW4vb3hAMC4xMS4xKzA0NzBiMGE2Njk0MmEzZGEvbm9kZV9tb2R1bGVzL294L19lc20vY29yZS9XaXRoZHJhd2FsLmpzIiwgIi4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy8uYnVuL294QDAuMTEuMSswNDcwYjBhNjY5NDJhM2RhL25vZGVfbW9kdWxlcy9veC9fZXNtL2NvcmUvQmxvY2tPdmVycmlkZXMuanMiLCAiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzLy5idW4vdmllbUAyLjQzLjMrMDQ3MGIwYTY2OTQyYTNkYS9ub2RlX21vZHVsZXMvdmllbS9fZXNtL2FjY291bnRzL3V0aWxzL3BhcnNlQWNjb3VudC5qcyIsICIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvLmJ1bi92aWVtQDIuNDMuMyswNDcwYjBhNjY5NDJhM2RhL25vZGVfbW9kdWxlcy92aWVtL19lc20vY29uc3RhbnRzL2FiaXMuanMiLCAiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzLy5idW4vdmllbUAyLjQzLjMrMDQ3MGIwYTY2OTQyYTNkYS9ub2RlX21vZHVsZXMvdmllbS9fZXNtL2NvbnN0YW50cy9jb250cmFjdC5qcyIsICIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvLmJ1bi92aWVtQDIuNDMuMyswNDcwYjBhNjY5NDJhM2RhL25vZGVfbW9kdWxlcy92aWVtL19lc20vY29uc3RhbnRzL2NvbnRyYWN0cy5qcyIsICIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvLmJ1bi92aWVtQDIuNDMuMyswNDcwYjBhNjY5NDJhM2RhL25vZGVfbW9kdWxlcy92aWVtL19lc20vZXJyb3JzL3ZlcnNpb24uanMiLCAiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzLy5idW4vdmllbUAyLjQzLjMrMDQ3MGIwYTY2OTQyYTNkYS9ub2RlX21vZHVsZXMvdmllbS9fZXNtL2Vycm9ycy9iYXNlLmpzIiwgIi4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy8uYnVuL3ZpZW1AMi40My4zKzA0NzBiMGE2Njk0MmEzZGEvbm9kZV9tb2R1bGVzL3ZpZW0vX2VzbS9lcnJvcnMvY2hhaW4uanMiLCAiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzLy5idW4vdmllbUAyLjQzLjMrMDQ3MGIwYTY2OTQyYTNkYS9ub2RlX21vZHVsZXMvdmllbS9fZXNtL2NvbnN0YW50cy9zb2xpZGl0eS5qcyIsICIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvLmJ1bi92aWVtQDIuNDMuMyswNDcwYjBhNjY5NDJhM2RhL25vZGVfbW9kdWxlcy92aWVtL19lc20vdXRpbHMvYWJpL2Zvcm1hdEFiaUl0ZW0uanMiLCAiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzLy5idW4vdmllbUAyLjQzLjMrMDQ3MGIwYTY2OTQyYTNkYS9ub2RlX21vZHVsZXMvdmllbS9fZXNtL3V0aWxzL2RhdGEvaXNIZXguanMiLCAiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzLy5idW4vdmllbUAyLjQzLjMrMDQ3MGIwYTY2OTQyYTNkYS9ub2RlX21vZHVsZXMvdmllbS9fZXNtL3V0aWxzL2RhdGEvc2l6ZS5qcyIsICIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvLmJ1bi92aWVtQDIuNDMuMyswNDcwYjBhNjY5NDJhM2RhL25vZGVfbW9kdWxlcy92aWVtL19lc20vZXJyb3JzL2FiaS5qcyIsICIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvLmJ1bi92aWVtQDIuNDMuMyswNDcwYjBhNjY5NDJhM2RhL25vZGVfbW9kdWxlcy92aWVtL19lc20vZXJyb3JzL2RhdGEuanMiLCAiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzLy5idW4vdmllbUAyLjQzLjMrMDQ3MGIwYTY2OTQyYTNkYS9ub2RlX21vZHVsZXMvdmllbS9fZXNtL3V0aWxzL2RhdGEvc2xpY2UuanMiLCAiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzLy5idW4vdmllbUAyLjQzLjMrMDQ3MGIwYTY2OTQyYTNkYS9ub2RlX21vZHVsZXMvdmllbS9fZXNtL3V0aWxzL2RhdGEvcGFkLmpzIiwgIi4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy8uYnVuL3ZpZW1AMi40My4zKzA0NzBiMGE2Njk0MmEzZGEvbm9kZV9tb2R1bGVzL3ZpZW0vX2VzbS9lcnJvcnMvZW5jb2RpbmcuanMiLCAiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzLy5idW4vdmllbUAyLjQzLjMrMDQ3MGIwYTY2OTQyYTNkYS9ub2RlX21vZHVsZXMvdmllbS9fZXNtL3V0aWxzL2RhdGEvdHJpbS5qcyIsICIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvLmJ1bi92aWVtQDIuNDMuMyswNDcwYjBhNjY5NDJhM2RhL25vZGVfbW9kdWxlcy92aWVtL19lc20vdXRpbHMvZW5jb2RpbmcvZnJvbUhleC5qcyIsICIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvLmJ1bi92aWVtQDIuNDMuMyswNDcwYjBhNjY5NDJhM2RhL25vZGVfbW9kdWxlcy92aWVtL19lc20vdXRpbHMvZW5jb2RpbmcvdG9IZXguanMiLCAiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzLy5idW4vdmllbUAyLjQzLjMrMDQ3MGIwYTY2OTQyYTNkYS9ub2RlX21vZHVsZXMvdmllbS9fZXNtL3V0aWxzL2VuY29kaW5nL3RvQnl0ZXMuanMiLCAiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzLy5idW4vQG5vYmxlK2hhc2hlc0AxLjguMC9ub2RlX21vZHVsZXMvQG5vYmxlL2hhc2hlcy9lc20vc2hhMy5qcyIsICIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvLmJ1bi92aWVtQDIuNDMuMyswNDcwYjBhNjY5NDJhM2RhL25vZGVfbW9kdWxlcy92aWVtL19lc20vdXRpbHMvaGFzaC9rZWNjYWsyNTYuanMiLCAiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzLy5idW4vdmllbUAyLjQzLjMrMDQ3MGIwYTY2OTQyYTNkYS9ub2RlX21vZHVsZXMvdmllbS9fZXNtL3V0aWxzL2hhc2gvaGFzaFNpZ25hdHVyZS5qcyIsICIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvLmJ1bi92aWVtQDIuNDMuMyswNDcwYjBhNjY5NDJhM2RhL25vZGVfbW9kdWxlcy92aWVtL19lc20vdXRpbHMvaGFzaC9ub3JtYWxpemVTaWduYXR1cmUuanMiLCAiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzLy5idW4vdmllbUAyLjQzLjMrMDQ3MGIwYTY2OTQyYTNkYS9ub2RlX21vZHVsZXMvdmllbS9fZXNtL3V0aWxzL2hhc2gvdG9TaWduYXR1cmUuanMiLCAiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzLy5idW4vdmllbUAyLjQzLjMrMDQ3MGIwYTY2OTQyYTNkYS9ub2RlX21vZHVsZXMvdmllbS9fZXNtL3V0aWxzL2hhc2gvdG9TaWduYXR1cmVIYXNoLmpzIiwgIi4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy8uYnVuL3ZpZW1AMi40My4zKzA0NzBiMGE2Njk0MmEzZGEvbm9kZV9tb2R1bGVzL3ZpZW0vX2VzbS91dGlscy9oYXNoL3RvRnVuY3Rpb25TZWxlY3Rvci5qcyIsICIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvLmJ1bi92aWVtQDIuNDMuMyswNDcwYjBhNjY5NDJhM2RhL25vZGVfbW9kdWxlcy92aWVtL19lc20vZXJyb3JzL2FkZHJlc3MuanMiLCAiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzLy5idW4vdmllbUAyLjQzLjMrMDQ3MGIwYTY2OTQyYTNkYS9ub2RlX21vZHVsZXMvdmllbS9fZXNtL3V0aWxzL2xydS5qcyIsICIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvLmJ1bi92aWVtQDIuNDMuMyswNDcwYjBhNjY5NDJhM2RhL25vZGVfbW9kdWxlcy92aWVtL19lc20vdXRpbHMvYWRkcmVzcy9pc0FkZHJlc3MuanMiLCAiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzLy5idW4vdmllbUAyLjQzLjMrMDQ3MGIwYTY2OTQyYTNkYS9ub2RlX21vZHVsZXMvdmllbS9fZXNtL3V0aWxzL2FkZHJlc3MvZ2V0QWRkcmVzcy5qcyIsICIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvLmJ1bi92aWVtQDIuNDMuMyswNDcwYjBhNjY5NDJhM2RhL25vZGVfbW9kdWxlcy92aWVtL19lc20vZXJyb3JzL2N1cnNvci5qcyIsICIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvLmJ1bi92aWVtQDIuNDMuMyswNDcwYjBhNjY5NDJhM2RhL25vZGVfbW9kdWxlcy92aWVtL19lc20vdXRpbHMvY3Vyc29yLmpzIiwgIi4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy8uYnVuL3ZpZW1AMi40My4zKzA0NzBiMGE2Njk0MmEzZGEvbm9kZV9tb2R1bGVzL3ZpZW0vX2VzbS91dGlscy9lbmNvZGluZy9mcm9tQnl0ZXMuanMiLCAiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzLy5idW4vdmllbUAyLjQzLjMrMDQ3MGIwYTY2OTQyYTNkYS9ub2RlX21vZHVsZXMvdmllbS9fZXNtL3V0aWxzL2RhdGEvY29uY2F0LmpzIiwgIi4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy8uYnVuL3ZpZW1AMi40My4zKzA0NzBiMGE2Njk0MmEzZGEvbm9kZV9tb2R1bGVzL3ZpZW0vX2VzbS91dGlscy9yZWdleC5qcyIsICIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvLmJ1bi92aWVtQDIuNDMuMyswNDcwYjBhNjY5NDJhM2RhL25vZGVfbW9kdWxlcy92aWVtL19lc20vdXRpbHMvYWJpL2VuY29kZUFiaVBhcmFtZXRlcnMuanMiLCAiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzLy5idW4vdmllbUAyLjQzLjMrMDQ3MGIwYTY2OTQyYTNkYS9ub2RlX21vZHVsZXMvdmllbS9fZXNtL3V0aWxzL2FiaS9kZWNvZGVBYmlQYXJhbWV0ZXJzLmpzIiwgIi4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy8uYnVuL3ZpZW1AMi40My4zKzA0NzBiMGE2Njk0MmEzZGEvbm9kZV9tb2R1bGVzL3ZpZW0vX2VzbS91dGlscy9hYmkvZGVjb2RlRXJyb3JSZXN1bHQuanMiLCAiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzLy5idW4vdmllbUAyLjQzLjMrMDQ3MGIwYTY2OTQyYTNkYS9ub2RlX21vZHVsZXMvdmllbS9fZXNtL3V0aWxzL3N0cmluZ2lmeS5qcyIsICIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvLmJ1bi92aWVtQDIuNDMuMyswNDcwYjBhNjY5NDJhM2RhL25vZGVfbW9kdWxlcy92aWVtL19lc20vdXRpbHMvYWJpL2Zvcm1hdEFiaUl0ZW1XaXRoQXJncy5qcyIsICIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvLmJ1bi92aWVtQDIuNDMuMyswNDcwYjBhNjY5NDJhM2RhL25vZGVfbW9kdWxlcy92aWVtL19lc20vdXRpbHMvaGFzaC90b0V2ZW50U2VsZWN0b3IuanMiLCAiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzLy5idW4vdmllbUAyLjQzLjMrMDQ3MGIwYTY2OTQyYTNkYS9ub2RlX21vZHVsZXMvdmllbS9fZXNtL3V0aWxzL2FiaS9nZXRBYmlJdGVtLmpzIiwgIi4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy8uYnVuL3ZpZW1AMi40My4zKzA0NzBiMGE2Njk0MmEzZGEvbm9kZV9tb2R1bGVzL3ZpZW0vX2VzbS9jb25zdGFudHMvdW5pdC5qcyIsICIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvLmJ1bi92aWVtQDIuNDMuMyswNDcwYjBhNjY5NDJhM2RhL25vZGVfbW9kdWxlcy92aWVtL19lc20vdXRpbHMvdW5pdC9mb3JtYXRVbml0cy5qcyIsICIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvLmJ1bi92aWVtQDIuNDMuMyswNDcwYjBhNjY5NDJhM2RhL25vZGVfbW9kdWxlcy92aWVtL19lc20vdXRpbHMvdW5pdC9mb3JtYXRFdGhlci5qcyIsICIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvLmJ1bi92aWVtQDIuNDMuMyswNDcwYjBhNjY5NDJhM2RhL25vZGVfbW9kdWxlcy92aWVtL19lc20vdXRpbHMvdW5pdC9mb3JtYXRHd2VpLmpzIiwgIi4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy8uYnVuL3ZpZW1AMi40My4zKzA0NzBiMGE2Njk0MmEzZGEvbm9kZV9tb2R1bGVzL3ZpZW0vX2VzbS9lcnJvcnMvc3RhdGVPdmVycmlkZS5qcyIsICIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvLmJ1bi92aWVtQDIuNDMuMyswNDcwYjBhNjY5NDJhM2RhL25vZGVfbW9kdWxlcy92aWVtL19lc20vZXJyb3JzL3RyYW5zYWN0aW9uLmpzIiwgIi4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy8uYnVuL3ZpZW1AMi40My4zKzA0NzBiMGE2Njk0MmEzZGEvbm9kZV9tb2R1bGVzL3ZpZW0vX2VzbS9lcnJvcnMvdXRpbHMuanMiLCAiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzLy5idW4vdmllbUAyLjQzLjMrMDQ3MGIwYTY2OTQyYTNkYS9ub2RlX21vZHVsZXMvdmllbS9fZXNtL2Vycm9ycy9jb250cmFjdC5qcyIsICIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvLmJ1bi92aWVtQDIuNDMuMyswNDcwYjBhNjY5NDJhM2RhL25vZGVfbW9kdWxlcy92aWVtL19lc20vdXRpbHMvYWJpL2RlY29kZUZ1bmN0aW9uUmVzdWx0LmpzIiwgIi4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy8uYnVuL3ZpZW1AMi40My4zKzA0NzBiMGE2Njk0MmEzZGEvbm9kZV9tb2R1bGVzL3ZpZW0vX2VzbS91dGlscy9hYmkvZW5jb2RlRGVwbG95RGF0YS5qcyIsICIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvLmJ1bi92aWVtQDIuNDMuMyswNDcwYjBhNjY5NDJhM2RhL25vZGVfbW9kdWxlcy92aWVtL19lc20vdXRpbHMvYWJpL3ByZXBhcmVFbmNvZGVGdW5jdGlvbkRhdGEuanMiLCAiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzLy5idW4vdmllbUAyLjQzLjMrMDQ3MGIwYTY2OTQyYTNkYS9ub2RlX21vZHVsZXMvdmllbS9fZXNtL3V0aWxzL2FiaS9lbmNvZGVGdW5jdGlvbkRhdGEuanMiLCAiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzLy5idW4vdmllbUAyLjQzLjMrMDQ3MGIwYTY2OTQyYTNkYS9ub2RlX21vZHVsZXMvdmllbS9fZXNtL3V0aWxzL2NoYWluL2dldENoYWluQ29udHJhY3RBZGRyZXNzLmpzIiwgIi4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy8uYnVuL3ZpZW1AMi40My4zKzA0NzBiMGE2Njk0MmEzZGEvbm9kZV9tb2R1bGVzL3ZpZW0vX2VzbS9lcnJvcnMvbm9kZS5qcyIsICIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvLmJ1bi92aWVtQDIuNDMuMyswNDcwYjBhNjY5NDJhM2RhL25vZGVfbW9kdWxlcy92aWVtL19lc20vZXJyb3JzL3JlcXVlc3QuanMiLCAiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzLy5idW4vdmllbUAyLjQzLjMrMDQ3MGIwYTY2OTQyYTNkYS9ub2RlX21vZHVsZXMvdmllbS9fZXNtL2Vycm9ycy9ycGMuanMiLCAiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzLy5idW4vdmllbUAyLjQzLjMrMDQ3MGIwYTY2OTQyYTNkYS9ub2RlX21vZHVsZXMvdmllbS9fZXNtL3V0aWxzL2Vycm9ycy9nZXROb2RlRXJyb3IuanMiLCAiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzLy5idW4vdmllbUAyLjQzLjMrMDQ3MGIwYTY2OTQyYTNkYS9ub2RlX21vZHVsZXMvdmllbS9fZXNtL3V0aWxzL2Vycm9ycy9nZXRDYWxsRXJyb3IuanMiLCAiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzLy5idW4vdmllbUAyLjQzLjMrMDQ3MGIwYTY2OTQyYTNkYS9ub2RlX21vZHVsZXMvdmllbS9fZXNtL3V0aWxzL2Zvcm1hdHRlcnMvZXh0cmFjdC5qcyIsICIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvLmJ1bi92aWVtQDIuNDMuMyswNDcwYjBhNjY5NDJhM2RhL25vZGVfbW9kdWxlcy92aWVtL19lc20vdXRpbHMvZm9ybWF0dGVycy9mb3JtYXR0ZXIuanMiLCAiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzLy5idW4vdmllbUAyLjQzLjMrMDQ3MGIwYTY2OTQyYTNkYS9ub2RlX21vZHVsZXMvdmllbS9fZXNtL3V0aWxzL2Zvcm1hdHRlcnMvdHJhbnNhY3Rpb25SZXF1ZXN0LmpzIiwgIi4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy8uYnVuL3ZpZW1AMi40My4zKzA0NzBiMGE2Njk0MmEzZGEvbm9kZV9tb2R1bGVzL3ZpZW0vX2VzbS91dGlscy9wcm9taXNlL3dpdGhSZXNvbHZlcnMuanMiLCAiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzLy5idW4vdmllbUAyLjQzLjMrMDQ3MGIwYTY2OTQyYTNkYS9ub2RlX21vZHVsZXMvdmllbS9fZXNtL3V0aWxzL3Byb21pc2UvY3JlYXRlQmF0Y2hTY2hlZHVsZXIuanMiLCAiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzLy5idW4vdmllbUAyLjQzLjMrMDQ3MGIwYTY2OTQyYTNkYS9ub2RlX21vZHVsZXMvdmllbS9fZXNtL3V0aWxzL3N0YXRlT3ZlcnJpZGUuanMiLCAiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzLy5idW4vdmllbUAyLjQzLjMrMDQ3MGIwYTY2OTQyYTNkYS9ub2RlX21vZHVsZXMvdmllbS9fZXNtL2NvbnN0YW50cy9udW1iZXIuanMiLCAiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzLy5idW4vdmllbUAyLjQzLjMrMDQ3MGIwYTY2OTQyYTNkYS9ub2RlX21vZHVsZXMvdmllbS9fZXNtL3V0aWxzL3RyYW5zYWN0aW9uL2Fzc2VydFJlcXVlc3QuanMiLCAiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzLy5idW4vdmllbUAyLjQzLjMrMDQ3MGIwYTY2OTQyYTNkYS9ub2RlX21vZHVsZXMvdmllbS9fZXNtL2FjdGlvbnMvcHVibGljL2NhbGwuanMiLCAiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzLy5idW4vdmllbUAyLjQzLjMrMDQ3MGIwYTY2OTQyYTNkYS9ub2RlX21vZHVsZXMvdmllbS9fZXNtL2Vycm9ycy9jY2lwLmpzIiwgIi4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy8uYnVuL3ZpZW1AMi40My4zKzA0NzBiMGE2Njk0MmEzZGEvbm9kZV9tb2R1bGVzL3ZpZW0vX2VzbS91dGlscy9hZGRyZXNzL2lzQWRkcmVzc0VxdWFsLmpzIiwgIi4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy8uYnVuL3ZpZW1AMi40My4zKzA0NzBiMGE2Njk0MmEzZGEvbm9kZV9tb2R1bGVzL3ZpZW0vX2VzbS91dGlscy9hYmkvZGVjb2RlRnVuY3Rpb25EYXRhLmpzIiwgIi4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy8uYnVuL3ZpZW1AMi40My4zKzA0NzBiMGE2Njk0MmEzZGEvbm9kZV9tb2R1bGVzL3ZpZW0vX2VzbS91dGlscy9hYmkvZW5jb2RlRXJyb3JSZXN1bHQuanMiLCAiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzLy5idW4vdmllbUAyLjQzLjMrMDQ3MGIwYTY2OTQyYTNkYS9ub2RlX21vZHVsZXMvdmllbS9fZXNtL3V0aWxzL2FiaS9lbmNvZGVGdW5jdGlvblJlc3VsdC5qcyIsICIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvLmJ1bi92aWVtQDIuNDMuMyswNDcwYjBhNjY5NDJhM2RhL25vZGVfbW9kdWxlcy92aWVtL19lc20vdXRpbHMvZW5zL2xvY2FsQmF0Y2hHYXRld2F5UmVxdWVzdC5qcyIsICIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvLmJ1bi92aWVtQDIuNDMuMyswNDcwYjBhNjY5NDJhM2RhL25vZGVfbW9kdWxlcy92aWVtL19lc20vdXRpbHMvY2NpcC5qcyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsKICAgICJleHBvcnQgY29uc3QgdmVyc2lvbiA9ICcxLjIuMyc7XG4vLyMgc291cmNlTWFwcGluZ1VSTD12ZXJzaW9uLmpzLm1hcCIsCiAgICAiaW1wb3J0IHsgdmVyc2lvbiB9IGZyb20gJy4vdmVyc2lvbi5qcyc7XG5leHBvcnQgY2xhc3MgQmFzZUVycm9yIGV4dGVuZHMgRXJyb3Ige1xuICAgIGNvbnN0cnVjdG9yKHNob3J0TWVzc2FnZSwgYXJncyA9IHt9KSB7XG4gICAgICAgIGNvbnN0IGRldGFpbHMgPSBhcmdzLmNhdXNlIGluc3RhbmNlb2YgQmFzZUVycm9yXG4gICAgICAgICAgICA/IGFyZ3MuY2F1c2UuZGV0YWlsc1xuICAgICAgICAgICAgOiBhcmdzLmNhdXNlPy5tZXNzYWdlXG4gICAgICAgICAgICAgICAgPyBhcmdzLmNhdXNlLm1lc3NhZ2VcbiAgICAgICAgICAgICAgICA6IGFyZ3MuZGV0YWlscztcbiAgICAgICAgY29uc3QgZG9jc1BhdGggPSBhcmdzLmNhdXNlIGluc3RhbmNlb2YgQmFzZUVycm9yXG4gICAgICAgICAgICA/IGFyZ3MuY2F1c2UuZG9jc1BhdGggfHwgYXJncy5kb2NzUGF0aFxuICAgICAgICAgICAgOiBhcmdzLmRvY3NQYXRoO1xuICAgICAgICBjb25zdCBtZXNzYWdlID0gW1xuICAgICAgICAgICAgc2hvcnRNZXNzYWdlIHx8ICdBbiBlcnJvciBvY2N1cnJlZC4nLFxuICAgICAgICAgICAgJycsXG4gICAgICAgICAgICAuLi4oYXJncy5tZXRhTWVzc2FnZXMgPyBbLi4uYXJncy5tZXRhTWVzc2FnZXMsICcnXSA6IFtdKSxcbiAgICAgICAgICAgIC4uLihkb2NzUGF0aCA/IFtgRG9jczogaHR0cHM6Ly9hYml0eXBlLmRldiR7ZG9jc1BhdGh9YF0gOiBbXSksXG4gICAgICAgICAgICAuLi4oZGV0YWlscyA/IFtgRGV0YWlsczogJHtkZXRhaWxzfWBdIDogW10pLFxuICAgICAgICAgICAgYFZlcnNpb246IGFiaXR5cGVAJHt2ZXJzaW9ufWAsXG4gICAgICAgIF0uam9pbignXFxuJyk7XG4gICAgICAgIHN1cGVyKG1lc3NhZ2UpO1xuICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkodGhpcywgXCJkZXRhaWxzXCIsIHtcbiAgICAgICAgICAgIGVudW1lcmFibGU6IHRydWUsXG4gICAgICAgICAgICBjb25maWd1cmFibGU6IHRydWUsXG4gICAgICAgICAgICB3cml0YWJsZTogdHJ1ZSxcbiAgICAgICAgICAgIHZhbHVlOiB2b2lkIDBcbiAgICAgICAgfSk7XG4gICAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0aGlzLCBcImRvY3NQYXRoXCIsIHtcbiAgICAgICAgICAgIGVudW1lcmFibGU6IHRydWUsXG4gICAgICAgICAgICBjb25maWd1cmFibGU6IHRydWUsXG4gICAgICAgICAgICB3cml0YWJsZTogdHJ1ZSxcbiAgICAgICAgICAgIHZhbHVlOiB2b2lkIDBcbiAgICAgICAgfSk7XG4gICAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0aGlzLCBcIm1ldGFNZXNzYWdlc1wiLCB7XG4gICAgICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlLFxuICAgICAgICAgICAgd3JpdGFibGU6IHRydWUsXG4gICAgICAgICAgICB2YWx1ZTogdm9pZCAwXG4gICAgICAgIH0pO1xuICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkodGhpcywgXCJzaG9ydE1lc3NhZ2VcIiwge1xuICAgICAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICAgICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgICAgICAgICAgIHdyaXRhYmxlOiB0cnVlLFxuICAgICAgICAgICAgdmFsdWU6IHZvaWQgMFxuICAgICAgICB9KTtcbiAgICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRoaXMsIFwibmFtZVwiLCB7XG4gICAgICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlLFxuICAgICAgICAgICAgd3JpdGFibGU6IHRydWUsXG4gICAgICAgICAgICB2YWx1ZTogJ0FiaVR5cGVFcnJvcidcbiAgICAgICAgfSk7XG4gICAgICAgIGlmIChhcmdzLmNhdXNlKVxuICAgICAgICAgICAgdGhpcy5jYXVzZSA9IGFyZ3MuY2F1c2U7XG4gICAgICAgIHRoaXMuZGV0YWlscyA9IGRldGFpbHM7XG4gICAgICAgIHRoaXMuZG9jc1BhdGggPSBkb2NzUGF0aDtcbiAgICAgICAgdGhpcy5tZXRhTWVzc2FnZXMgPSBhcmdzLm1ldGFNZXNzYWdlcztcbiAgICAgICAgdGhpcy5zaG9ydE1lc3NhZ2UgPSBzaG9ydE1lc3NhZ2U7XG4gICAgfVxufVxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9ZXJyb3JzLmpzLm1hcCIsCiAgICAiLy8gVE9ETzogVGhpcyBsb29rcyBjb29sLiBOZWVkIHRvIGNoZWNrIHRoZSBwZXJmb3JtYW5jZSBvZiBgbmV3IFJlZ0V4cGAgdmVyc3VzIGRlZmluZWQgaW5saW5lIHRob3VnaC5cbi8vIGh0dHBzOi8vdHdpdHRlci5jb20vR2FicmllbFZlcmduYXVkL3N0YXR1cy8xNjIyOTA2ODM0MzQzMzY2NjU3XG5leHBvcnQgZnVuY3Rpb24gZXhlY1R5cGVkKHJlZ2V4LCBzdHJpbmcpIHtcbiAgICBjb25zdCBtYXRjaCA9IHJlZ2V4LmV4ZWMoc3RyaW5nKTtcbiAgICByZXR1cm4gbWF0Y2g/Lmdyb3Vwcztcbn1cbi8vIGBieXRlczxNPmA6IGJpbmFyeSB0eXBlIG9mIGBNYCBieXRlcywgYDAgPCBNIDw9IDMyYFxuLy8gaHR0cHM6Ly9yZWdleHIuY29tLzZ2YTU1XG5leHBvcnQgY29uc3QgYnl0ZXNSZWdleCA9IC9eYnl0ZXMoWzEtOV18MVswLTldfDJbMC05XXwzWzAtMl0pPyQvO1xuLy8gYCh1KWludDxNPmA6ICh1bilzaWduZWQgaW50ZWdlciB0eXBlIG9mIGBNYCBiaXRzLCBgMCA8IE0gPD0gMjU2YCwgYE0gJSA4ID09IDBgXG4vLyBodHRwczovL3JlZ2V4ci5jb20vNnY4aHBcbmV4cG9ydCBjb25zdCBpbnRlZ2VyUmVnZXggPSAvXnU/aW50KDh8MTZ8MjR8MzJ8NDB8NDh8NTZ8NjR8NzJ8ODB8ODh8OTZ8MTA0fDExMnwxMjB8MTI4fDEzNnwxNDR8MTUyfDE2MHwxNjh8MTc2fDE4NHwxOTJ8MjAwfDIwOHwyMTZ8MjI0fDIzMnwyNDB8MjQ4fDI1Nik/JC87XG5leHBvcnQgY29uc3QgaXNUdXBsZVJlZ2V4ID0gL15cXCguKz9cXCkuKj8kLztcbi8vIyBzb3VyY2VNYXBwaW5nVVJMPXJlZ2V4LmpzLm1hcCIsCiAgICAiaW1wb3J0IHsgZXhlY1R5cGVkIH0gZnJvbSAnLi4vcmVnZXguanMnO1xuLy8gaHR0cHM6Ly9yZWdleHIuY29tLzdmN3J2XG5jb25zdCB0dXBsZVJlZ2V4ID0gL150dXBsZSg/PGFycmF5PihcXFsoXFxkKilcXF0pKikkLztcbi8qKlxuICogRm9ybWF0cyB7QGxpbmsgQWJpUGFyYW1ldGVyfSB0byBodW1hbi1yZWFkYWJsZSBBQkkgcGFyYW1ldGVyLlxuICpcbiAqIEBwYXJhbSBhYmlQYXJhbWV0ZXIgLSBBQkkgcGFyYW1ldGVyXG4gKiBAcmV0dXJucyBIdW1hbi1yZWFkYWJsZSBBQkkgcGFyYW1ldGVyXG4gKlxuICogQGV4YW1wbGVcbiAqIGNvbnN0IHJlc3VsdCA9IGZvcm1hdEFiaVBhcmFtZXRlcih7IHR5cGU6ICdhZGRyZXNzJywgbmFtZTogJ2Zyb20nIH0pXG4gKiAvLyAgICBePyBjb25zdCByZXN1bHQ6ICdhZGRyZXNzIGZyb20nXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBmb3JtYXRBYmlQYXJhbWV0ZXIoYWJpUGFyYW1ldGVyKSB7XG4gICAgbGV0IHR5cGUgPSBhYmlQYXJhbWV0ZXIudHlwZTtcbiAgICBpZiAodHVwbGVSZWdleC50ZXN0KGFiaVBhcmFtZXRlci50eXBlKSAmJiAnY29tcG9uZW50cycgaW4gYWJpUGFyYW1ldGVyKSB7XG4gICAgICAgIHR5cGUgPSAnKCc7XG4gICAgICAgIGNvbnN0IGxlbmd0aCA9IGFiaVBhcmFtZXRlci5jb21wb25lbnRzLmxlbmd0aDtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgY29tcG9uZW50ID0gYWJpUGFyYW1ldGVyLmNvbXBvbmVudHNbaV07XG4gICAgICAgICAgICB0eXBlICs9IGZvcm1hdEFiaVBhcmFtZXRlcihjb21wb25lbnQpO1xuICAgICAgICAgICAgaWYgKGkgPCBsZW5ndGggLSAxKVxuICAgICAgICAgICAgICAgIHR5cGUgKz0gJywgJztcbiAgICAgICAgfVxuICAgICAgICBjb25zdCByZXN1bHQgPSBleGVjVHlwZWQodHVwbGVSZWdleCwgYWJpUGFyYW1ldGVyLnR5cGUpO1xuICAgICAgICB0eXBlICs9IGApJHtyZXN1bHQ/LmFycmF5IHx8ICcnfWA7XG4gICAgICAgIHJldHVybiBmb3JtYXRBYmlQYXJhbWV0ZXIoe1xuICAgICAgICAgICAgLi4uYWJpUGFyYW1ldGVyLFxuICAgICAgICAgICAgdHlwZSxcbiAgICAgICAgfSk7XG4gICAgfVxuICAgIC8vIEFkZCBgaW5kZXhlZGAgdG8gdHlwZSBpZiBpbiBgYWJpUGFyYW1ldGVyYFxuICAgIGlmICgnaW5kZXhlZCcgaW4gYWJpUGFyYW1ldGVyICYmIGFiaVBhcmFtZXRlci5pbmRleGVkKVxuICAgICAgICB0eXBlID0gYCR7dHlwZX0gaW5kZXhlZGA7XG4gICAgLy8gUmV0dXJuIGh1bWFuLXJlYWRhYmxlIEFCSSBwYXJhbWV0ZXJcbiAgICBpZiAoYWJpUGFyYW1ldGVyLm5hbWUpXG4gICAgICAgIHJldHVybiBgJHt0eXBlfSAke2FiaVBhcmFtZXRlci5uYW1lfWA7XG4gICAgcmV0dXJuIHR5cGU7XG59XG4vLyMgc291cmNlTWFwcGluZ1VSTD1mb3JtYXRBYmlQYXJhbWV0ZXIuanMubWFwIiwKICAgICJpbXBvcnQgeyBmb3JtYXRBYmlQYXJhbWV0ZXIsIH0gZnJvbSAnLi9mb3JtYXRBYmlQYXJhbWV0ZXIuanMnO1xuLyoqXG4gKiBGb3JtYXRzIHtAbGluayBBYmlQYXJhbWV0ZXJ9cyB0byBodW1hbi1yZWFkYWJsZSBBQkkgcGFyYW1ldGVycy5cbiAqXG4gKiBAcGFyYW0gYWJpUGFyYW1ldGVycyAtIEFCSSBwYXJhbWV0ZXJzXG4gKiBAcmV0dXJucyBIdW1hbi1yZWFkYWJsZSBBQkkgcGFyYW1ldGVyc1xuICpcbiAqIEBleGFtcGxlXG4gKiBjb25zdCByZXN1bHQgPSBmb3JtYXRBYmlQYXJhbWV0ZXJzKFtcbiAqICAgLy8gIF4/IGNvbnN0IHJlc3VsdDogJ2FkZHJlc3MgZnJvbSwgdWludDI1NiB0b2tlbklkJ1xuICogICB7IHR5cGU6ICdhZGRyZXNzJywgbmFtZTogJ2Zyb20nIH0sXG4gKiAgIHsgdHlwZTogJ3VpbnQyNTYnLCBuYW1lOiAndG9rZW5JZCcgfSxcbiAqIF0pXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBmb3JtYXRBYmlQYXJhbWV0ZXJzKGFiaVBhcmFtZXRlcnMpIHtcbiAgICBsZXQgcGFyYW1zID0gJyc7XG4gICAgY29uc3QgbGVuZ3RoID0gYWJpUGFyYW1ldGVycy5sZW5ndGg7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgICAgICBjb25zdCBhYmlQYXJhbWV0ZXIgPSBhYmlQYXJhbWV0ZXJzW2ldO1xuICAgICAgICBwYXJhbXMgKz0gZm9ybWF0QWJpUGFyYW1ldGVyKGFiaVBhcmFtZXRlcik7XG4gICAgICAgIGlmIChpICE9PSBsZW5ndGggLSAxKVxuICAgICAgICAgICAgcGFyYW1zICs9ICcsICc7XG4gICAgfVxuICAgIHJldHVybiBwYXJhbXM7XG59XG4vLyMgc291cmNlTWFwcGluZ1VSTD1mb3JtYXRBYmlQYXJhbWV0ZXJzLmpzLm1hcCIsCiAgICAiaW1wb3J0IHsgZm9ybWF0QWJpUGFyYW1ldGVycywgfSBmcm9tICcuL2Zvcm1hdEFiaVBhcmFtZXRlcnMuanMnO1xuLyoqXG4gKiBGb3JtYXRzIEFCSSBpdGVtIChlLmcuIGVycm9yLCBldmVudCwgZnVuY3Rpb24pIGludG8gaHVtYW4tcmVhZGFibGUgQUJJIGl0ZW1cbiAqXG4gKiBAcGFyYW0gYWJpSXRlbSAtIEFCSSBpdGVtXG4gKiBAcmV0dXJucyBIdW1hbi1yZWFkYWJsZSBBQkkgaXRlbVxuICovXG5leHBvcnQgZnVuY3Rpb24gZm9ybWF0QWJpSXRlbShhYmlJdGVtKSB7XG4gICAgaWYgKGFiaUl0ZW0udHlwZSA9PT0gJ2Z1bmN0aW9uJylcbiAgICAgICAgcmV0dXJuIGBmdW5jdGlvbiAke2FiaUl0ZW0ubmFtZX0oJHtmb3JtYXRBYmlQYXJhbWV0ZXJzKGFiaUl0ZW0uaW5wdXRzKX0pJHthYmlJdGVtLnN0YXRlTXV0YWJpbGl0eSAmJiBhYmlJdGVtLnN0YXRlTXV0YWJpbGl0eSAhPT0gJ25vbnBheWFibGUnXG4gICAgICAgICAgICA/IGAgJHthYmlJdGVtLnN0YXRlTXV0YWJpbGl0eX1gXG4gICAgICAgICAgICA6ICcnfSR7YWJpSXRlbS5vdXRwdXRzPy5sZW5ndGhcbiAgICAgICAgICAgID8gYCByZXR1cm5zICgke2Zvcm1hdEFiaVBhcmFtZXRlcnMoYWJpSXRlbS5vdXRwdXRzKX0pYFxuICAgICAgICAgICAgOiAnJ31gO1xuICAgIGlmIChhYmlJdGVtLnR5cGUgPT09ICdldmVudCcpXG4gICAgICAgIHJldHVybiBgZXZlbnQgJHthYmlJdGVtLm5hbWV9KCR7Zm9ybWF0QWJpUGFyYW1ldGVycyhhYmlJdGVtLmlucHV0cyl9KWA7XG4gICAgaWYgKGFiaUl0ZW0udHlwZSA9PT0gJ2Vycm9yJylcbiAgICAgICAgcmV0dXJuIGBlcnJvciAke2FiaUl0ZW0ubmFtZX0oJHtmb3JtYXRBYmlQYXJhbWV0ZXJzKGFiaUl0ZW0uaW5wdXRzKX0pYDtcbiAgICBpZiAoYWJpSXRlbS50eXBlID09PSAnY29uc3RydWN0b3InKVxuICAgICAgICByZXR1cm4gYGNvbnN0cnVjdG9yKCR7Zm9ybWF0QWJpUGFyYW1ldGVycyhhYmlJdGVtLmlucHV0cyl9KSR7YWJpSXRlbS5zdGF0ZU11dGFiaWxpdHkgPT09ICdwYXlhYmxlJyA/ICcgcGF5YWJsZScgOiAnJ31gO1xuICAgIGlmIChhYmlJdGVtLnR5cGUgPT09ICdmYWxsYmFjaycpXG4gICAgICAgIHJldHVybiBgZmFsbGJhY2soKSBleHRlcm5hbCR7YWJpSXRlbS5zdGF0ZU11dGFiaWxpdHkgPT09ICdwYXlhYmxlJyA/ICcgcGF5YWJsZScgOiAnJ31gO1xuICAgIHJldHVybiAncmVjZWl2ZSgpIGV4dGVybmFsIHBheWFibGUnO1xufVxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9Zm9ybWF0QWJpSXRlbS5qcy5tYXAiLAogICAgImltcG9ydCB7IGV4ZWNUeXBlZCB9IGZyb20gJy4uLy4uL3JlZ2V4LmpzJztcbi8vIGh0dHBzOi8vcmVnZXhyLmNvbS83Z21va1xuY29uc3QgZXJyb3JTaWduYXR1cmVSZWdleCA9IC9eZXJyb3IgKD88bmFtZT5bYS16QS1aJF9dW2EtekEtWjAtOSRfXSopXFwoKD88cGFyYW1ldGVycz4uKj8pXFwpJC87XG5leHBvcnQgZnVuY3Rpb24gaXNFcnJvclNpZ25hdHVyZShzaWduYXR1cmUpIHtcbiAgICByZXR1cm4gZXJyb3JTaWduYXR1cmVSZWdleC50ZXN0KHNpZ25hdHVyZSk7XG59XG5leHBvcnQgZnVuY3Rpb24gZXhlY0Vycm9yU2lnbmF0dXJlKHNpZ25hdHVyZSkge1xuICAgIHJldHVybiBleGVjVHlwZWQoZXJyb3JTaWduYXR1cmVSZWdleCwgc2lnbmF0dXJlKTtcbn1cbi8vIGh0dHBzOi8vcmVnZXhyLmNvbS83Z21vcVxuY29uc3QgZXZlbnRTaWduYXR1cmVSZWdleCA9IC9eZXZlbnQgKD88bmFtZT5bYS16QS1aJF9dW2EtekEtWjAtOSRfXSopXFwoKD88cGFyYW1ldGVycz4uKj8pXFwpJC87XG5leHBvcnQgZnVuY3Rpb24gaXNFdmVudFNpZ25hdHVyZShzaWduYXR1cmUpIHtcbiAgICByZXR1cm4gZXZlbnRTaWduYXR1cmVSZWdleC50ZXN0KHNpZ25hdHVyZSk7XG59XG5leHBvcnQgZnVuY3Rpb24gZXhlY0V2ZW50U2lnbmF0dXJlKHNpZ25hdHVyZSkge1xuICAgIHJldHVybiBleGVjVHlwZWQoZXZlbnRTaWduYXR1cmVSZWdleCwgc2lnbmF0dXJlKTtcbn1cbi8vIGh0dHBzOi8vcmVnZXhyLmNvbS83Z21vdFxuY29uc3QgZnVuY3Rpb25TaWduYXR1cmVSZWdleCA9IC9eZnVuY3Rpb24gKD88bmFtZT5bYS16QS1aJF9dW2EtekEtWjAtOSRfXSopXFwoKD88cGFyYW1ldGVycz4uKj8pXFwpKD86ICg/PHNjb3BlPmV4dGVybmFsfHB1YmxpY3sxfSkpPyg/OiAoPzxzdGF0ZU11dGFiaWxpdHk+cHVyZXx2aWV3fG5vbnBheWFibGV8cGF5YWJsZXsxfSkpPyg/OiByZXR1cm5zXFxzP1xcKCg/PHJldHVybnM+Lio/KVxcKSk/JC87XG5leHBvcnQgZnVuY3Rpb24gaXNGdW5jdGlvblNpZ25hdHVyZShzaWduYXR1cmUpIHtcbiAgICByZXR1cm4gZnVuY3Rpb25TaWduYXR1cmVSZWdleC50ZXN0KHNpZ25hdHVyZSk7XG59XG5leHBvcnQgZnVuY3Rpb24gZXhlY0Z1bmN0aW9uU2lnbmF0dXJlKHNpZ25hdHVyZSkge1xuICAgIHJldHVybiBleGVjVHlwZWQoZnVuY3Rpb25TaWduYXR1cmVSZWdleCwgc2lnbmF0dXJlKTtcbn1cbi8vIGh0dHBzOi8vcmVnZXhyLmNvbS83Z21wM1xuY29uc3Qgc3RydWN0U2lnbmF0dXJlUmVnZXggPSAvXnN0cnVjdCAoPzxuYW1lPlthLXpBLVokX11bYS16QS1aMC05JF9dKikgXFx7KD88cHJvcGVydGllcz4uKj8pXFx9JC87XG5leHBvcnQgZnVuY3Rpb24gaXNTdHJ1Y3RTaWduYXR1cmUoc2lnbmF0dXJlKSB7XG4gICAgcmV0dXJuIHN0cnVjdFNpZ25hdHVyZVJlZ2V4LnRlc3Qoc2lnbmF0dXJlKTtcbn1cbmV4cG9ydCBmdW5jdGlvbiBleGVjU3RydWN0U2lnbmF0dXJlKHNpZ25hdHVyZSkge1xuICAgIHJldHVybiBleGVjVHlwZWQoc3RydWN0U2lnbmF0dXJlUmVnZXgsIHNpZ25hdHVyZSk7XG59XG4vLyBodHRwczovL3JlZ2V4ci5jb20vNzh1MDFcbmNvbnN0IGNvbnN0cnVjdG9yU2lnbmF0dXJlUmVnZXggPSAvXmNvbnN0cnVjdG9yXFwoKD88cGFyYW1ldGVycz4uKj8pXFwpKD86XFxzKD88c3RhdGVNdXRhYmlsaXR5PnBheWFibGV7MX0pKT8kLztcbmV4cG9ydCBmdW5jdGlvbiBpc0NvbnN0cnVjdG9yU2lnbmF0dXJlKHNpZ25hdHVyZSkge1xuICAgIHJldHVybiBjb25zdHJ1Y3RvclNpZ25hdHVyZVJlZ2V4LnRlc3Qoc2lnbmF0dXJlKTtcbn1cbmV4cG9ydCBmdW5jdGlvbiBleGVjQ29uc3RydWN0b3JTaWduYXR1cmUoc2lnbmF0dXJlKSB7XG4gICAgcmV0dXJuIGV4ZWNUeXBlZChjb25zdHJ1Y3RvclNpZ25hdHVyZVJlZ2V4LCBzaWduYXR1cmUpO1xufVxuLy8gaHR0cHM6Ly9yZWdleHIuY29tLzdzcnRuXG5jb25zdCBmYWxsYmFja1NpZ25hdHVyZVJlZ2V4ID0gL15mYWxsYmFja1xcKFxcKSBleHRlcm5hbCg/Olxccyg/PHN0YXRlTXV0YWJpbGl0eT5wYXlhYmxlezF9KSk/JC87XG5leHBvcnQgZnVuY3Rpb24gaXNGYWxsYmFja1NpZ25hdHVyZShzaWduYXR1cmUpIHtcbiAgICByZXR1cm4gZmFsbGJhY2tTaWduYXR1cmVSZWdleC50ZXN0KHNpZ25hdHVyZSk7XG59XG5leHBvcnQgZnVuY3Rpb24gZXhlY0ZhbGxiYWNrU2lnbmF0dXJlKHNpZ25hdHVyZSkge1xuICAgIHJldHVybiBleGVjVHlwZWQoZmFsbGJhY2tTaWduYXR1cmVSZWdleCwgc2lnbmF0dXJlKTtcbn1cbi8vIGh0dHBzOi8vcmVnZXhyLmNvbS83OHUxa1xuY29uc3QgcmVjZWl2ZVNpZ25hdHVyZVJlZ2V4ID0gL15yZWNlaXZlXFwoXFwpIGV4dGVybmFsIHBheWFibGUkLztcbmV4cG9ydCBmdW5jdGlvbiBpc1JlY2VpdmVTaWduYXR1cmUoc2lnbmF0dXJlKSB7XG4gICAgcmV0dXJuIHJlY2VpdmVTaWduYXR1cmVSZWdleC50ZXN0KHNpZ25hdHVyZSk7XG59XG5leHBvcnQgY29uc3QgbW9kaWZpZXJzID0gbmV3IFNldChbXG4gICAgJ21lbW9yeScsXG4gICAgJ2luZGV4ZWQnLFxuICAgICdzdG9yYWdlJyxcbiAgICAnY2FsbGRhdGEnLFxuXSk7XG5leHBvcnQgY29uc3QgZXZlbnRNb2RpZmllcnMgPSBuZXcgU2V0KFsnaW5kZXhlZCddKTtcbmV4cG9ydCBjb25zdCBmdW5jdGlvbk1vZGlmaWVycyA9IG5ldyBTZXQoW1xuICAgICdjYWxsZGF0YScsXG4gICAgJ21lbW9yeScsXG4gICAgJ3N0b3JhZ2UnLFxuXSk7XG4vLyMgc291cmNlTWFwcGluZ1VSTD1zaWduYXR1cmVzLmpzLm1hcCIsCiAgICAiaW1wb3J0IHsgQmFzZUVycm9yIH0gZnJvbSAnLi4vLi4vZXJyb3JzLmpzJztcbmV4cG9ydCBjbGFzcyBJbnZhbGlkQWJpSXRlbUVycm9yIGV4dGVuZHMgQmFzZUVycm9yIHtcbiAgICBjb25zdHJ1Y3Rvcih7IHNpZ25hdHVyZSB9KSB7XG4gICAgICAgIHN1cGVyKCdGYWlsZWQgdG8gcGFyc2UgQUJJIGl0ZW0uJywge1xuICAgICAgICAgICAgZGV0YWlsczogYHBhcnNlQWJpSXRlbSgke0pTT04uc3RyaW5naWZ5KHNpZ25hdHVyZSwgbnVsbCwgMil9KWAsXG4gICAgICAgICAgICBkb2NzUGF0aDogJy9hcGkvaHVtYW4jcGFyc2VhYmlpdGVtLTEnLFxuICAgICAgICB9KTtcbiAgICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRoaXMsIFwibmFtZVwiLCB7XG4gICAgICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlLFxuICAgICAgICAgICAgd3JpdGFibGU6IHRydWUsXG4gICAgICAgICAgICB2YWx1ZTogJ0ludmFsaWRBYmlJdGVtRXJyb3InXG4gICAgICAgIH0pO1xuICAgIH1cbn1cbmV4cG9ydCBjbGFzcyBVbmtub3duVHlwZUVycm9yIGV4dGVuZHMgQmFzZUVycm9yIHtcbiAgICBjb25zdHJ1Y3Rvcih7IHR5cGUgfSkge1xuICAgICAgICBzdXBlcignVW5rbm93biB0eXBlLicsIHtcbiAgICAgICAgICAgIG1ldGFNZXNzYWdlczogW1xuICAgICAgICAgICAgICAgIGBUeXBlIFwiJHt0eXBlfVwiIGlzIG5vdCBhIHZhbGlkIEFCSSB0eXBlLiBQZXJoYXBzIHlvdSBmb3Jnb3QgdG8gaW5jbHVkZSBhIHN0cnVjdCBzaWduYXR1cmU/YCxcbiAgICAgICAgICAgIF0sXG4gICAgICAgIH0pO1xuICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkodGhpcywgXCJuYW1lXCIsIHtcbiAgICAgICAgICAgIGVudW1lcmFibGU6IHRydWUsXG4gICAgICAgICAgICBjb25maWd1cmFibGU6IHRydWUsXG4gICAgICAgICAgICB3cml0YWJsZTogdHJ1ZSxcbiAgICAgICAgICAgIHZhbHVlOiAnVW5rbm93blR5cGVFcnJvcidcbiAgICAgICAgfSk7XG4gICAgfVxufVxuZXhwb3J0IGNsYXNzIFVua25vd25Tb2xpZGl0eVR5cGVFcnJvciBleHRlbmRzIEJhc2VFcnJvciB7XG4gICAgY29uc3RydWN0b3IoeyB0eXBlIH0pIHtcbiAgICAgICAgc3VwZXIoJ1Vua25vd24gdHlwZS4nLCB7XG4gICAgICAgICAgICBtZXRhTWVzc2FnZXM6IFtgVHlwZSBcIiR7dHlwZX1cIiBpcyBub3QgYSB2YWxpZCBBQkkgdHlwZS5gXSxcbiAgICAgICAgfSk7XG4gICAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0aGlzLCBcIm5hbWVcIiwge1xuICAgICAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICAgICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgICAgICAgICAgIHdyaXRhYmxlOiB0cnVlLFxuICAgICAgICAgICAgdmFsdWU6ICdVbmtub3duU29saWRpdHlUeXBlRXJyb3InXG4gICAgICAgIH0pO1xuICAgIH1cbn1cbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWFiaUl0ZW0uanMubWFwIiwKICAgICJpbXBvcnQgeyBCYXNlRXJyb3IgfSBmcm9tICcuLi8uLi9lcnJvcnMuanMnO1xuZXhwb3J0IGNsYXNzIEludmFsaWRBYmlQYXJhbWV0ZXJFcnJvciBleHRlbmRzIEJhc2VFcnJvciB7XG4gICAgY29uc3RydWN0b3IoeyBwYXJhbSB9KSB7XG4gICAgICAgIHN1cGVyKCdGYWlsZWQgdG8gcGFyc2UgQUJJIHBhcmFtZXRlci4nLCB7XG4gICAgICAgICAgICBkZXRhaWxzOiBgcGFyc2VBYmlQYXJhbWV0ZXIoJHtKU09OLnN0cmluZ2lmeShwYXJhbSwgbnVsbCwgMil9KWAsXG4gICAgICAgICAgICBkb2NzUGF0aDogJy9hcGkvaHVtYW4jcGFyc2VhYmlwYXJhbWV0ZXItMScsXG4gICAgICAgIH0pO1xuICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkodGhpcywgXCJuYW1lXCIsIHtcbiAgICAgICAgICAgIGVudW1lcmFibGU6IHRydWUsXG4gICAgICAgICAgICBjb25maWd1cmFibGU6IHRydWUsXG4gICAgICAgICAgICB3cml0YWJsZTogdHJ1ZSxcbiAgICAgICAgICAgIHZhbHVlOiAnSW52YWxpZEFiaVBhcmFtZXRlckVycm9yJ1xuICAgICAgICB9KTtcbiAgICB9XG59XG5leHBvcnQgY2xhc3MgSW52YWxpZEFiaVBhcmFtZXRlcnNFcnJvciBleHRlbmRzIEJhc2VFcnJvciB7XG4gICAgY29uc3RydWN0b3IoeyBwYXJhbXMgfSkge1xuICAgICAgICBzdXBlcignRmFpbGVkIHRvIHBhcnNlIEFCSSBwYXJhbWV0ZXJzLicsIHtcbiAgICAgICAgICAgIGRldGFpbHM6IGBwYXJzZUFiaVBhcmFtZXRlcnMoJHtKU09OLnN0cmluZ2lmeShwYXJhbXMsIG51bGwsIDIpfSlgLFxuICAgICAgICAgICAgZG9jc1BhdGg6ICcvYXBpL2h1bWFuI3BhcnNlYWJpcGFyYW1ldGVycy0xJyxcbiAgICAgICAgfSk7XG4gICAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0aGlzLCBcIm5hbWVcIiwge1xuICAgICAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICAgICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgICAgICAgICAgIHdyaXRhYmxlOiB0cnVlLFxuICAgICAgICAgICAgdmFsdWU6ICdJbnZhbGlkQWJpUGFyYW1ldGVyc0Vycm9yJ1xuICAgICAgICB9KTtcbiAgICB9XG59XG5leHBvcnQgY2xhc3MgSW52YWxpZFBhcmFtZXRlckVycm9yIGV4dGVuZHMgQmFzZUVycm9yIHtcbiAgICBjb25zdHJ1Y3Rvcih7IHBhcmFtIH0pIHtcbiAgICAgICAgc3VwZXIoJ0ludmFsaWQgQUJJIHBhcmFtZXRlci4nLCB7XG4gICAgICAgICAgICBkZXRhaWxzOiBwYXJhbSxcbiAgICAgICAgfSk7XG4gICAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0aGlzLCBcIm5hbWVcIiwge1xuICAgICAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICAgICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgICAgICAgICAgIHdyaXRhYmxlOiB0cnVlLFxuICAgICAgICAgICAgdmFsdWU6ICdJbnZhbGlkUGFyYW1ldGVyRXJyb3InXG4gICAgICAgIH0pO1xuICAgIH1cbn1cbmV4cG9ydCBjbGFzcyBTb2xpZGl0eVByb3RlY3RlZEtleXdvcmRFcnJvciBleHRlbmRzIEJhc2VFcnJvciB7XG4gICAgY29uc3RydWN0b3IoeyBwYXJhbSwgbmFtZSB9KSB7XG4gICAgICAgIHN1cGVyKCdJbnZhbGlkIEFCSSBwYXJhbWV0ZXIuJywge1xuICAgICAgICAgICAgZGV0YWlsczogcGFyYW0sXG4gICAgICAgICAgICBtZXRhTWVzc2FnZXM6IFtcbiAgICAgICAgICAgICAgICBgXCIke25hbWV9XCIgaXMgYSBwcm90ZWN0ZWQgU29saWRpdHkga2V5d29yZC4gTW9yZSBpbmZvOiBodHRwczovL2RvY3Muc29saWRpdHlsYW5nLm9yZy9lbi9sYXRlc3QvY2hlYXRzaGVldC5odG1sYCxcbiAgICAgICAgICAgIF0sXG4gICAgICAgIH0pO1xuICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkodGhpcywgXCJuYW1lXCIsIHtcbiAgICAgICAgICAgIGVudW1lcmFibGU6IHRydWUsXG4gICAgICAgICAgICBjb25maWd1cmFibGU6IHRydWUsXG4gICAgICAgICAgICB3cml0YWJsZTogdHJ1ZSxcbiAgICAgICAgICAgIHZhbHVlOiAnU29saWRpdHlQcm90ZWN0ZWRLZXl3b3JkRXJyb3InXG4gICAgICAgIH0pO1xuICAgIH1cbn1cbmV4cG9ydCBjbGFzcyBJbnZhbGlkTW9kaWZpZXJFcnJvciBleHRlbmRzIEJhc2VFcnJvciB7XG4gICAgY29uc3RydWN0b3IoeyBwYXJhbSwgdHlwZSwgbW9kaWZpZXIsIH0pIHtcbiAgICAgICAgc3VwZXIoJ0ludmFsaWQgQUJJIHBhcmFtZXRlci4nLCB7XG4gICAgICAgICAgICBkZXRhaWxzOiBwYXJhbSxcbiAgICAgICAgICAgIG1ldGFNZXNzYWdlczogW1xuICAgICAgICAgICAgICAgIGBNb2RpZmllciBcIiR7bW9kaWZpZXJ9XCIgbm90IGFsbG93ZWQke3R5cGUgPyBgIGluIFwiJHt0eXBlfVwiIHR5cGVgIDogJyd9LmAsXG4gICAgICAgICAgICBdLFxuICAgICAgICB9KTtcbiAgICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRoaXMsIFwibmFtZVwiLCB7XG4gICAgICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlLFxuICAgICAgICAgICAgd3JpdGFibGU6IHRydWUsXG4gICAgICAgICAgICB2YWx1ZTogJ0ludmFsaWRNb2RpZmllckVycm9yJ1xuICAgICAgICB9KTtcbiAgICB9XG59XG5leHBvcnQgY2xhc3MgSW52YWxpZEZ1bmN0aW9uTW9kaWZpZXJFcnJvciBleHRlbmRzIEJhc2VFcnJvciB7XG4gICAgY29uc3RydWN0b3IoeyBwYXJhbSwgdHlwZSwgbW9kaWZpZXIsIH0pIHtcbiAgICAgICAgc3VwZXIoJ0ludmFsaWQgQUJJIHBhcmFtZXRlci4nLCB7XG4gICAgICAgICAgICBkZXRhaWxzOiBwYXJhbSxcbiAgICAgICAgICAgIG1ldGFNZXNzYWdlczogW1xuICAgICAgICAgICAgICAgIGBNb2RpZmllciBcIiR7bW9kaWZpZXJ9XCIgbm90IGFsbG93ZWQke3R5cGUgPyBgIGluIFwiJHt0eXBlfVwiIHR5cGVgIDogJyd9LmAsXG4gICAgICAgICAgICAgICAgYERhdGEgbG9jYXRpb24gY2FuIG9ubHkgYmUgc3BlY2lmaWVkIGZvciBhcnJheSwgc3RydWN0LCBvciBtYXBwaW5nIHR5cGVzLCBidXQgXCIke21vZGlmaWVyfVwiIHdhcyBnaXZlbi5gLFxuICAgICAgICAgICAgXSxcbiAgICAgICAgfSk7XG4gICAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0aGlzLCBcIm5hbWVcIiwge1xuICAgICAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICAgICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgICAgICAgICAgIHdyaXRhYmxlOiB0cnVlLFxuICAgICAgICAgICAgdmFsdWU6ICdJbnZhbGlkRnVuY3Rpb25Nb2RpZmllckVycm9yJ1xuICAgICAgICB9KTtcbiAgICB9XG59XG5leHBvcnQgY2xhc3MgSW52YWxpZEFiaVR5cGVQYXJhbWV0ZXJFcnJvciBleHRlbmRzIEJhc2VFcnJvciB7XG4gICAgY29uc3RydWN0b3IoeyBhYmlQYXJhbWV0ZXIsIH0pIHtcbiAgICAgICAgc3VwZXIoJ0ludmFsaWQgQUJJIHBhcmFtZXRlci4nLCB7XG4gICAgICAgICAgICBkZXRhaWxzOiBKU09OLnN0cmluZ2lmeShhYmlQYXJhbWV0ZXIsIG51bGwsIDIpLFxuICAgICAgICAgICAgbWV0YU1lc3NhZ2VzOiBbJ0FCSSBwYXJhbWV0ZXIgdHlwZSBpcyBpbnZhbGlkLiddLFxuICAgICAgICB9KTtcbiAgICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRoaXMsIFwibmFtZVwiLCB7XG4gICAgICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlLFxuICAgICAgICAgICAgd3JpdGFibGU6IHRydWUsXG4gICAgICAgICAgICB2YWx1ZTogJ0ludmFsaWRBYmlUeXBlUGFyYW1ldGVyRXJyb3InXG4gICAgICAgIH0pO1xuICAgIH1cbn1cbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWFiaVBhcmFtZXRlci5qcy5tYXAiLAogICAgImltcG9ydCB7IEJhc2VFcnJvciB9IGZyb20gJy4uLy4uL2Vycm9ycy5qcyc7XG5leHBvcnQgY2xhc3MgSW52YWxpZFNpZ25hdHVyZUVycm9yIGV4dGVuZHMgQmFzZUVycm9yIHtcbiAgICBjb25zdHJ1Y3Rvcih7IHNpZ25hdHVyZSwgdHlwZSwgfSkge1xuICAgICAgICBzdXBlcihgSW52YWxpZCAke3R5cGV9IHNpZ25hdHVyZS5gLCB7XG4gICAgICAgICAgICBkZXRhaWxzOiBzaWduYXR1cmUsXG4gICAgICAgIH0pO1xuICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkodGhpcywgXCJuYW1lXCIsIHtcbiAgICAgICAgICAgIGVudW1lcmFibGU6IHRydWUsXG4gICAgICAgICAgICBjb25maWd1cmFibGU6IHRydWUsXG4gICAgICAgICAgICB3cml0YWJsZTogdHJ1ZSxcbiAgICAgICAgICAgIHZhbHVlOiAnSW52YWxpZFNpZ25hdHVyZUVycm9yJ1xuICAgICAgICB9KTtcbiAgICB9XG59XG5leHBvcnQgY2xhc3MgVW5rbm93blNpZ25hdHVyZUVycm9yIGV4dGVuZHMgQmFzZUVycm9yIHtcbiAgICBjb25zdHJ1Y3Rvcih7IHNpZ25hdHVyZSB9KSB7XG4gICAgICAgIHN1cGVyKCdVbmtub3duIHNpZ25hdHVyZS4nLCB7XG4gICAgICAgICAgICBkZXRhaWxzOiBzaWduYXR1cmUsXG4gICAgICAgIH0pO1xuICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkodGhpcywgXCJuYW1lXCIsIHtcbiAgICAgICAgICAgIGVudW1lcmFibGU6IHRydWUsXG4gICAgICAgICAgICBjb25maWd1cmFibGU6IHRydWUsXG4gICAgICAgICAgICB3cml0YWJsZTogdHJ1ZSxcbiAgICAgICAgICAgIHZhbHVlOiAnVW5rbm93blNpZ25hdHVyZUVycm9yJ1xuICAgICAgICB9KTtcbiAgICB9XG59XG5leHBvcnQgY2xhc3MgSW52YWxpZFN0cnVjdFNpZ25hdHVyZUVycm9yIGV4dGVuZHMgQmFzZUVycm9yIHtcbiAgICBjb25zdHJ1Y3Rvcih7IHNpZ25hdHVyZSB9KSB7XG4gICAgICAgIHN1cGVyKCdJbnZhbGlkIHN0cnVjdCBzaWduYXR1cmUuJywge1xuICAgICAgICAgICAgZGV0YWlsczogc2lnbmF0dXJlLFxuICAgICAgICAgICAgbWV0YU1lc3NhZ2VzOiBbJ05vIHByb3BlcnRpZXMgZXhpc3QuJ10sXG4gICAgICAgIH0pO1xuICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkodGhpcywgXCJuYW1lXCIsIHtcbiAgICAgICAgICAgIGVudW1lcmFibGU6IHRydWUsXG4gICAgICAgICAgICBjb25maWd1cmFibGU6IHRydWUsXG4gICAgICAgICAgICB3cml0YWJsZTogdHJ1ZSxcbiAgICAgICAgICAgIHZhbHVlOiAnSW52YWxpZFN0cnVjdFNpZ25hdHVyZUVycm9yJ1xuICAgICAgICB9KTtcbiAgICB9XG59XG4vLyMgc291cmNlTWFwcGluZ1VSTD1zaWduYXR1cmUuanMubWFwIiwKICAgICJpbXBvcnQgeyBCYXNlRXJyb3IgfSBmcm9tICcuLi8uLi9lcnJvcnMuanMnO1xuZXhwb3J0IGNsYXNzIENpcmN1bGFyUmVmZXJlbmNlRXJyb3IgZXh0ZW5kcyBCYXNlRXJyb3Ige1xuICAgIGNvbnN0cnVjdG9yKHsgdHlwZSB9KSB7XG4gICAgICAgIHN1cGVyKCdDaXJjdWxhciByZWZlcmVuY2UgZGV0ZWN0ZWQuJywge1xuICAgICAgICAgICAgbWV0YU1lc3NhZ2VzOiBbYFN0cnVjdCBcIiR7dHlwZX1cIiBpcyBhIGNpcmN1bGFyIHJlZmVyZW5jZS5gXSxcbiAgICAgICAgfSk7XG4gICAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0aGlzLCBcIm5hbWVcIiwge1xuICAgICAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICAgICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgICAgICAgICAgIHdyaXRhYmxlOiB0cnVlLFxuICAgICAgICAgICAgdmFsdWU6ICdDaXJjdWxhclJlZmVyZW5jZUVycm9yJ1xuICAgICAgICB9KTtcbiAgICB9XG59XG4vLyMgc291cmNlTWFwcGluZ1VSTD1zdHJ1Y3QuanMubWFwIiwKICAgICJpbXBvcnQgeyBCYXNlRXJyb3IgfSBmcm9tICcuLi8uLi9lcnJvcnMuanMnO1xuZXhwb3J0IGNsYXNzIEludmFsaWRQYXJlbnRoZXNpc0Vycm9yIGV4dGVuZHMgQmFzZUVycm9yIHtcbiAgICBjb25zdHJ1Y3Rvcih7IGN1cnJlbnQsIGRlcHRoIH0pIHtcbiAgICAgICAgc3VwZXIoJ1VuYmFsYW5jZWQgcGFyZW50aGVzZXMuJywge1xuICAgICAgICAgICAgbWV0YU1lc3NhZ2VzOiBbXG4gICAgICAgICAgICAgICAgYFwiJHtjdXJyZW50LnRyaW0oKX1cIiBoYXMgdG9vIG1hbnkgJHtkZXB0aCA+IDAgPyAnb3BlbmluZycgOiAnY2xvc2luZyd9IHBhcmVudGhlc2VzLmAsXG4gICAgICAgICAgICBdLFxuICAgICAgICAgICAgZGV0YWlsczogYERlcHRoIFwiJHtkZXB0aH1cImAsXG4gICAgICAgIH0pO1xuICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkodGhpcywgXCJuYW1lXCIsIHtcbiAgICAgICAgICAgIGVudW1lcmFibGU6IHRydWUsXG4gICAgICAgICAgICBjb25maWd1cmFibGU6IHRydWUsXG4gICAgICAgICAgICB3cml0YWJsZTogdHJ1ZSxcbiAgICAgICAgICAgIHZhbHVlOiAnSW52YWxpZFBhcmVudGhlc2lzRXJyb3InXG4gICAgICAgIH0pO1xuICAgIH1cbn1cbi8vIyBzb3VyY2VNYXBwaW5nVVJMPXNwbGl0UGFyYW1ldGVycy5qcy5tYXAiLAogICAgIi8qKlxuICogR2V0cyB7QGxpbmsgcGFyYW1ldGVyQ2FjaGV9IGNhY2hlIGtleSBuYW1lc3BhY2VkIGJ5IHtAbGluayB0eXBlfSBhbmQge0BsaW5rIHN0cnVjdHN9LiBUaGlzIHByZXZlbnRzIHBhcmFtZXRlcnMgZnJvbSBiZWluZyBhY2Nlc3NpYmxlIHRvIHR5cGVzIHRoYXQgZG9uJ3QgYWxsb3cgdGhlbSAoZS5nLiBgc3RyaW5nIGluZGV4ZWQgZm9vYCBub3QgYWxsb3dlZCBvdXRzaWRlIG9mIGB0eXBlOiAnZXZlbnQnYCkgYW5kIGVuc3VyZXMgZGlmZmVyZW50IHN0cnVjdCBkZWZpbml0aW9ucyB3aXRoIHRoZSBzYW1lIG5hbWUgYXJlIGNhY2hlZCBzZXBhcmF0ZWx5LlxuICogQHBhcmFtIHBhcmFtIEFCSSBwYXJhbWV0ZXIgc3RyaW5nXG4gKiBAcGFyYW0gdHlwZSBBQkkgcGFyYW1ldGVyIHR5cGVcbiAqIEBwYXJhbSBzdHJ1Y3RzIFN0cnVjdCBkZWZpbml0aW9ucyB0byBpbmNsdWRlIGluIGNhY2hlIGtleVxuICogQHJldHVybnMgQ2FjaGUga2V5IGZvciB7QGxpbmsgcGFyYW1ldGVyQ2FjaGV9XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBnZXRQYXJhbWV0ZXJDYWNoZUtleShwYXJhbSwgdHlwZSwgc3RydWN0cykge1xuICAgIGxldCBzdHJ1Y3RLZXkgPSAnJztcbiAgICBpZiAoc3RydWN0cylcbiAgICAgICAgZm9yIChjb25zdCBzdHJ1Y3Qgb2YgT2JqZWN0LmVudHJpZXMoc3RydWN0cykpIHtcbiAgICAgICAgICAgIGlmICghc3RydWN0KVxuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgbGV0IHByb3BlcnR5S2V5ID0gJyc7XG4gICAgICAgICAgICBmb3IgKGNvbnN0IHByb3BlcnR5IG9mIHN0cnVjdFsxXSkge1xuICAgICAgICAgICAgICAgIHByb3BlcnR5S2V5ICs9IGBbJHtwcm9wZXJ0eS50eXBlfSR7cHJvcGVydHkubmFtZSA/IGA6JHtwcm9wZXJ0eS5uYW1lfWAgOiAnJ31dYDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHN0cnVjdEtleSArPSBgKCR7c3RydWN0WzBdfXske3Byb3BlcnR5S2V5fX0pYDtcbiAgICAgICAgfVxuICAgIGlmICh0eXBlKVxuICAgICAgICByZXR1cm4gYCR7dHlwZX06JHtwYXJhbX0ke3N0cnVjdEtleX1gO1xuICAgIHJldHVybiBgJHtwYXJhbX0ke3N0cnVjdEtleX1gO1xufVxuLyoqXG4gKiBCYXNpYyBjYWNoZSBzZWVkZWQgd2l0aCBjb21tb24gQUJJIHBhcmFtZXRlciBzdHJpbmdzLlxuICpcbiAqICoqTm90ZTogV2hlbiBzZWVkaW5nIG1vcmUgcGFyYW1ldGVycywgbWFrZSBzdXJlIHlvdSBiZW5jaG1hcmsgcGVyZm9ybWFuY2UuIFRoZSBjdXJyZW50IG51bWJlciBpcyB0aGUgaWRlYWwgYmFsYW5jZSBiZXR3ZWVuIHBlcmZvcm1hbmNlIGFuZCBoYXZpbmcgYW4gYWxyZWFkeSBleGlzdGluZyBjYWNoZS4qKlxuICovXG5leHBvcnQgY29uc3QgcGFyYW1ldGVyQ2FjaGUgPSBuZXcgTWFwKFtcbiAgICAvLyBVbm5hbWVkXG4gICAgWydhZGRyZXNzJywgeyB0eXBlOiAnYWRkcmVzcycgfV0sXG4gICAgWydib29sJywgeyB0eXBlOiAnYm9vbCcgfV0sXG4gICAgWydieXRlcycsIHsgdHlwZTogJ2J5dGVzJyB9XSxcbiAgICBbJ2J5dGVzMzInLCB7IHR5cGU6ICdieXRlczMyJyB9XSxcbiAgICBbJ2ludCcsIHsgdHlwZTogJ2ludDI1NicgfV0sXG4gICAgWydpbnQyNTYnLCB7IHR5cGU6ICdpbnQyNTYnIH1dLFxuICAgIFsnc3RyaW5nJywgeyB0eXBlOiAnc3RyaW5nJyB9XSxcbiAgICBbJ3VpbnQnLCB7IHR5cGU6ICd1aW50MjU2JyB9XSxcbiAgICBbJ3VpbnQ4JywgeyB0eXBlOiAndWludDgnIH1dLFxuICAgIFsndWludDE2JywgeyB0eXBlOiAndWludDE2JyB9XSxcbiAgICBbJ3VpbnQyNCcsIHsgdHlwZTogJ3VpbnQyNCcgfV0sXG4gICAgWyd1aW50MzInLCB7IHR5cGU6ICd1aW50MzInIH1dLFxuICAgIFsndWludDY0JywgeyB0eXBlOiAndWludDY0JyB9XSxcbiAgICBbJ3VpbnQ5NicsIHsgdHlwZTogJ3VpbnQ5NicgfV0sXG4gICAgWyd1aW50MTEyJywgeyB0eXBlOiAndWludDExMicgfV0sXG4gICAgWyd1aW50MTYwJywgeyB0eXBlOiAndWludDE2MCcgfV0sXG4gICAgWyd1aW50MTkyJywgeyB0eXBlOiAndWludDE5MicgfV0sXG4gICAgWyd1aW50MjU2JywgeyB0eXBlOiAndWludDI1NicgfV0sXG4gICAgLy8gTmFtZWRcbiAgICBbJ2FkZHJlc3Mgb3duZXInLCB7IHR5cGU6ICdhZGRyZXNzJywgbmFtZTogJ293bmVyJyB9XSxcbiAgICBbJ2FkZHJlc3MgdG8nLCB7IHR5cGU6ICdhZGRyZXNzJywgbmFtZTogJ3RvJyB9XSxcbiAgICBbJ2Jvb2wgYXBwcm92ZWQnLCB7IHR5cGU6ICdib29sJywgbmFtZTogJ2FwcHJvdmVkJyB9XSxcbiAgICBbJ2J5dGVzIF9kYXRhJywgeyB0eXBlOiAnYnl0ZXMnLCBuYW1lOiAnX2RhdGEnIH1dLFxuICAgIFsnYnl0ZXMgZGF0YScsIHsgdHlwZTogJ2J5dGVzJywgbmFtZTogJ2RhdGEnIH1dLFxuICAgIFsnYnl0ZXMgc2lnbmF0dXJlJywgeyB0eXBlOiAnYnl0ZXMnLCBuYW1lOiAnc2lnbmF0dXJlJyB9XSxcbiAgICBbJ2J5dGVzMzIgaGFzaCcsIHsgdHlwZTogJ2J5dGVzMzInLCBuYW1lOiAnaGFzaCcgfV0sXG4gICAgWydieXRlczMyIHInLCB7IHR5cGU6ICdieXRlczMyJywgbmFtZTogJ3InIH1dLFxuICAgIFsnYnl0ZXMzMiByb290JywgeyB0eXBlOiAnYnl0ZXMzMicsIG5hbWU6ICdyb290JyB9XSxcbiAgICBbJ2J5dGVzMzIgcycsIHsgdHlwZTogJ2J5dGVzMzInLCBuYW1lOiAncycgfV0sXG4gICAgWydzdHJpbmcgbmFtZScsIHsgdHlwZTogJ3N0cmluZycsIG5hbWU6ICduYW1lJyB9XSxcbiAgICBbJ3N0cmluZyBzeW1ib2wnLCB7IHR5cGU6ICdzdHJpbmcnLCBuYW1lOiAnc3ltYm9sJyB9XSxcbiAgICBbJ3N0cmluZyB0b2tlblVSSScsIHsgdHlwZTogJ3N0cmluZycsIG5hbWU6ICd0b2tlblVSSScgfV0sXG4gICAgWyd1aW50IHRva2VuSWQnLCB7IHR5cGU6ICd1aW50MjU2JywgbmFtZTogJ3Rva2VuSWQnIH1dLFxuICAgIFsndWludDggdicsIHsgdHlwZTogJ3VpbnQ4JywgbmFtZTogJ3YnIH1dLFxuICAgIFsndWludDI1NiBiYWxhbmNlJywgeyB0eXBlOiAndWludDI1NicsIG5hbWU6ICdiYWxhbmNlJyB9XSxcbiAgICBbJ3VpbnQyNTYgdG9rZW5JZCcsIHsgdHlwZTogJ3VpbnQyNTYnLCBuYW1lOiAndG9rZW5JZCcgfV0sXG4gICAgWyd1aW50MjU2IHZhbHVlJywgeyB0eXBlOiAndWludDI1NicsIG5hbWU6ICd2YWx1ZScgfV0sXG4gICAgLy8gSW5kZXhlZFxuICAgIFtcbiAgICAgICAgJ2V2ZW50OmFkZHJlc3MgaW5kZXhlZCBmcm9tJyxcbiAgICAgICAgeyB0eXBlOiAnYWRkcmVzcycsIG5hbWU6ICdmcm9tJywgaW5kZXhlZDogdHJ1ZSB9LFxuICAgIF0sXG4gICAgWydldmVudDphZGRyZXNzIGluZGV4ZWQgdG8nLCB7IHR5cGU6ICdhZGRyZXNzJywgbmFtZTogJ3RvJywgaW5kZXhlZDogdHJ1ZSB9XSxcbiAgICBbXG4gICAgICAgICdldmVudDp1aW50IGluZGV4ZWQgdG9rZW5JZCcsXG4gICAgICAgIHsgdHlwZTogJ3VpbnQyNTYnLCBuYW1lOiAndG9rZW5JZCcsIGluZGV4ZWQ6IHRydWUgfSxcbiAgICBdLFxuICAgIFtcbiAgICAgICAgJ2V2ZW50OnVpbnQyNTYgaW5kZXhlZCB0b2tlbklkJyxcbiAgICAgICAgeyB0eXBlOiAndWludDI1NicsIG5hbWU6ICd0b2tlbklkJywgaW5kZXhlZDogdHJ1ZSB9LFxuICAgIF0sXG5dKTtcbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWNhY2hlLmpzLm1hcCIsCiAgICAiaW1wb3J0IHsgYnl0ZXNSZWdleCwgZXhlY1R5cGVkLCBpbnRlZ2VyUmVnZXgsIGlzVHVwbGVSZWdleCwgfSBmcm9tICcuLi8uLi9yZWdleC5qcyc7XG5pbXBvcnQgeyBVbmtub3duU29saWRpdHlUeXBlRXJyb3IgfSBmcm9tICcuLi9lcnJvcnMvYWJpSXRlbS5qcyc7XG5pbXBvcnQgeyBJbnZhbGlkRnVuY3Rpb25Nb2RpZmllckVycm9yLCBJbnZhbGlkTW9kaWZpZXJFcnJvciwgSW52YWxpZFBhcmFtZXRlckVycm9yLCBTb2xpZGl0eVByb3RlY3RlZEtleXdvcmRFcnJvciwgfSBmcm9tICcuLi9lcnJvcnMvYWJpUGFyYW1ldGVyLmpzJztcbmltcG9ydCB7IEludmFsaWRTaWduYXR1cmVFcnJvciwgVW5rbm93blNpZ25hdHVyZUVycm9yLCB9IGZyb20gJy4uL2Vycm9ycy9zaWduYXR1cmUuanMnO1xuaW1wb3J0IHsgSW52YWxpZFBhcmVudGhlc2lzRXJyb3IgfSBmcm9tICcuLi9lcnJvcnMvc3BsaXRQYXJhbWV0ZXJzLmpzJztcbmltcG9ydCB7IGdldFBhcmFtZXRlckNhY2hlS2V5LCBwYXJhbWV0ZXJDYWNoZSB9IGZyb20gJy4vY2FjaGUuanMnO1xuaW1wb3J0IHsgZXZlbnRNb2RpZmllcnMsIGV4ZWNDb25zdHJ1Y3RvclNpZ25hdHVyZSwgZXhlY0Vycm9yU2lnbmF0dXJlLCBleGVjRXZlbnRTaWduYXR1cmUsIGV4ZWNGYWxsYmFja1NpZ25hdHVyZSwgZXhlY0Z1bmN0aW9uU2lnbmF0dXJlLCBmdW5jdGlvbk1vZGlmaWVycywgaXNDb25zdHJ1Y3RvclNpZ25hdHVyZSwgaXNFcnJvclNpZ25hdHVyZSwgaXNFdmVudFNpZ25hdHVyZSwgaXNGYWxsYmFja1NpZ25hdHVyZSwgaXNGdW5jdGlvblNpZ25hdHVyZSwgaXNSZWNlaXZlU2lnbmF0dXJlLCB9IGZyb20gJy4vc2lnbmF0dXJlcy5qcyc7XG5leHBvcnQgZnVuY3Rpb24gcGFyc2VTaWduYXR1cmUoc2lnbmF0dXJlLCBzdHJ1Y3RzID0ge30pIHtcbiAgICBpZiAoaXNGdW5jdGlvblNpZ25hdHVyZShzaWduYXR1cmUpKVxuICAgICAgICByZXR1cm4gcGFyc2VGdW5jdGlvblNpZ25hdHVyZShzaWduYXR1cmUsIHN0cnVjdHMpO1xuICAgIGlmIChpc0V2ZW50U2lnbmF0dXJlKHNpZ25hdHVyZSkpXG4gICAgICAgIHJldHVybiBwYXJzZUV2ZW50U2lnbmF0dXJlKHNpZ25hdHVyZSwgc3RydWN0cyk7XG4gICAgaWYgKGlzRXJyb3JTaWduYXR1cmUoc2lnbmF0dXJlKSlcbiAgICAgICAgcmV0dXJuIHBhcnNlRXJyb3JTaWduYXR1cmUoc2lnbmF0dXJlLCBzdHJ1Y3RzKTtcbiAgICBpZiAoaXNDb25zdHJ1Y3RvclNpZ25hdHVyZShzaWduYXR1cmUpKVxuICAgICAgICByZXR1cm4gcGFyc2VDb25zdHJ1Y3RvclNpZ25hdHVyZShzaWduYXR1cmUsIHN0cnVjdHMpO1xuICAgIGlmIChpc0ZhbGxiYWNrU2lnbmF0dXJlKHNpZ25hdHVyZSkpXG4gICAgICAgIHJldHVybiBwYXJzZUZhbGxiYWNrU2lnbmF0dXJlKHNpZ25hdHVyZSk7XG4gICAgaWYgKGlzUmVjZWl2ZVNpZ25hdHVyZShzaWduYXR1cmUpKVxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgdHlwZTogJ3JlY2VpdmUnLFxuICAgICAgICAgICAgc3RhdGVNdXRhYmlsaXR5OiAncGF5YWJsZScsXG4gICAgICAgIH07XG4gICAgdGhyb3cgbmV3IFVua25vd25TaWduYXR1cmVFcnJvcih7IHNpZ25hdHVyZSB9KTtcbn1cbmV4cG9ydCBmdW5jdGlvbiBwYXJzZUZ1bmN0aW9uU2lnbmF0dXJlKHNpZ25hdHVyZSwgc3RydWN0cyA9IHt9KSB7XG4gICAgY29uc3QgbWF0Y2ggPSBleGVjRnVuY3Rpb25TaWduYXR1cmUoc2lnbmF0dXJlKTtcbiAgICBpZiAoIW1hdGNoKVxuICAgICAgICB0aHJvdyBuZXcgSW52YWxpZFNpZ25hdHVyZUVycm9yKHsgc2lnbmF0dXJlLCB0eXBlOiAnZnVuY3Rpb24nIH0pO1xuICAgIGNvbnN0IGlucHV0UGFyYW1zID0gc3BsaXRQYXJhbWV0ZXJzKG1hdGNoLnBhcmFtZXRlcnMpO1xuICAgIGNvbnN0IGlucHV0cyA9IFtdO1xuICAgIGNvbnN0IGlucHV0TGVuZ3RoID0gaW5wdXRQYXJhbXMubGVuZ3RoO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgaW5wdXRMZW5ndGg7IGkrKykge1xuICAgICAgICBpbnB1dHMucHVzaChwYXJzZUFiaVBhcmFtZXRlcihpbnB1dFBhcmFtc1tpXSwge1xuICAgICAgICAgICAgbW9kaWZpZXJzOiBmdW5jdGlvbk1vZGlmaWVycyxcbiAgICAgICAgICAgIHN0cnVjdHMsXG4gICAgICAgICAgICB0eXBlOiAnZnVuY3Rpb24nLFxuICAgICAgICB9KSk7XG4gICAgfVxuICAgIGNvbnN0IG91dHB1dHMgPSBbXTtcbiAgICBpZiAobWF0Y2gucmV0dXJucykge1xuICAgICAgICBjb25zdCBvdXRwdXRQYXJhbXMgPSBzcGxpdFBhcmFtZXRlcnMobWF0Y2gucmV0dXJucyk7XG4gICAgICAgIGNvbnN0IG91dHB1dExlbmd0aCA9IG91dHB1dFBhcmFtcy5sZW5ndGg7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgb3V0cHV0TGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIG91dHB1dHMucHVzaChwYXJzZUFiaVBhcmFtZXRlcihvdXRwdXRQYXJhbXNbaV0sIHtcbiAgICAgICAgICAgICAgICBtb2RpZmllcnM6IGZ1bmN0aW9uTW9kaWZpZXJzLFxuICAgICAgICAgICAgICAgIHN0cnVjdHMsXG4gICAgICAgICAgICAgICAgdHlwZTogJ2Z1bmN0aW9uJyxcbiAgICAgICAgICAgIH0pKTtcbiAgICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4ge1xuICAgICAgICBuYW1lOiBtYXRjaC5uYW1lLFxuICAgICAgICB0eXBlOiAnZnVuY3Rpb24nLFxuICAgICAgICBzdGF0ZU11dGFiaWxpdHk6IG1hdGNoLnN0YXRlTXV0YWJpbGl0eSA/PyAnbm9ucGF5YWJsZScsXG4gICAgICAgIGlucHV0cyxcbiAgICAgICAgb3V0cHV0cyxcbiAgICB9O1xufVxuZXhwb3J0IGZ1bmN0aW9uIHBhcnNlRXZlbnRTaWduYXR1cmUoc2lnbmF0dXJlLCBzdHJ1Y3RzID0ge30pIHtcbiAgICBjb25zdCBtYXRjaCA9IGV4ZWNFdmVudFNpZ25hdHVyZShzaWduYXR1cmUpO1xuICAgIGlmICghbWF0Y2gpXG4gICAgICAgIHRocm93IG5ldyBJbnZhbGlkU2lnbmF0dXJlRXJyb3IoeyBzaWduYXR1cmUsIHR5cGU6ICdldmVudCcgfSk7XG4gICAgY29uc3QgcGFyYW1zID0gc3BsaXRQYXJhbWV0ZXJzKG1hdGNoLnBhcmFtZXRlcnMpO1xuICAgIGNvbnN0IGFiaVBhcmFtZXRlcnMgPSBbXTtcbiAgICBjb25zdCBsZW5ndGggPSBwYXJhbXMubGVuZ3RoO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbGVuZ3RoOyBpKyspXG4gICAgICAgIGFiaVBhcmFtZXRlcnMucHVzaChwYXJzZUFiaVBhcmFtZXRlcihwYXJhbXNbaV0sIHtcbiAgICAgICAgICAgIG1vZGlmaWVyczogZXZlbnRNb2RpZmllcnMsXG4gICAgICAgICAgICBzdHJ1Y3RzLFxuICAgICAgICAgICAgdHlwZTogJ2V2ZW50JyxcbiAgICAgICAgfSkpO1xuICAgIHJldHVybiB7IG5hbWU6IG1hdGNoLm5hbWUsIHR5cGU6ICdldmVudCcsIGlucHV0czogYWJpUGFyYW1ldGVycyB9O1xufVxuZXhwb3J0IGZ1bmN0aW9uIHBhcnNlRXJyb3JTaWduYXR1cmUoc2lnbmF0dXJlLCBzdHJ1Y3RzID0ge30pIHtcbiAgICBjb25zdCBtYXRjaCA9IGV4ZWNFcnJvclNpZ25hdHVyZShzaWduYXR1cmUpO1xuICAgIGlmICghbWF0Y2gpXG4gICAgICAgIHRocm93IG5ldyBJbnZhbGlkU2lnbmF0dXJlRXJyb3IoeyBzaWduYXR1cmUsIHR5cGU6ICdlcnJvcicgfSk7XG4gICAgY29uc3QgcGFyYW1zID0gc3BsaXRQYXJhbWV0ZXJzKG1hdGNoLnBhcmFtZXRlcnMpO1xuICAgIGNvbnN0IGFiaVBhcmFtZXRlcnMgPSBbXTtcbiAgICBjb25zdCBsZW5ndGggPSBwYXJhbXMubGVuZ3RoO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbGVuZ3RoOyBpKyspXG4gICAgICAgIGFiaVBhcmFtZXRlcnMucHVzaChwYXJzZUFiaVBhcmFtZXRlcihwYXJhbXNbaV0sIHsgc3RydWN0cywgdHlwZTogJ2Vycm9yJyB9KSk7XG4gICAgcmV0dXJuIHsgbmFtZTogbWF0Y2gubmFtZSwgdHlwZTogJ2Vycm9yJywgaW5wdXRzOiBhYmlQYXJhbWV0ZXJzIH07XG59XG5leHBvcnQgZnVuY3Rpb24gcGFyc2VDb25zdHJ1Y3RvclNpZ25hdHVyZShzaWduYXR1cmUsIHN0cnVjdHMgPSB7fSkge1xuICAgIGNvbnN0IG1hdGNoID0gZXhlY0NvbnN0cnVjdG9yU2lnbmF0dXJlKHNpZ25hdHVyZSk7XG4gICAgaWYgKCFtYXRjaClcbiAgICAgICAgdGhyb3cgbmV3IEludmFsaWRTaWduYXR1cmVFcnJvcih7IHNpZ25hdHVyZSwgdHlwZTogJ2NvbnN0cnVjdG9yJyB9KTtcbiAgICBjb25zdCBwYXJhbXMgPSBzcGxpdFBhcmFtZXRlcnMobWF0Y2gucGFyYW1ldGVycyk7XG4gICAgY29uc3QgYWJpUGFyYW1ldGVycyA9IFtdO1xuICAgIGNvbnN0IGxlbmd0aCA9IHBhcmFtcy5sZW5ndGg7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsZW5ndGg7IGkrKylcbiAgICAgICAgYWJpUGFyYW1ldGVycy5wdXNoKHBhcnNlQWJpUGFyYW1ldGVyKHBhcmFtc1tpXSwgeyBzdHJ1Y3RzLCB0eXBlOiAnY29uc3RydWN0b3InIH0pKTtcbiAgICByZXR1cm4ge1xuICAgICAgICB0eXBlOiAnY29uc3RydWN0b3InLFxuICAgICAgICBzdGF0ZU11dGFiaWxpdHk6IG1hdGNoLnN0YXRlTXV0YWJpbGl0eSA/PyAnbm9ucGF5YWJsZScsXG4gICAgICAgIGlucHV0czogYWJpUGFyYW1ldGVycyxcbiAgICB9O1xufVxuZXhwb3J0IGZ1bmN0aW9uIHBhcnNlRmFsbGJhY2tTaWduYXR1cmUoc2lnbmF0dXJlKSB7XG4gICAgY29uc3QgbWF0Y2ggPSBleGVjRmFsbGJhY2tTaWduYXR1cmUoc2lnbmF0dXJlKTtcbiAgICBpZiAoIW1hdGNoKVxuICAgICAgICB0aHJvdyBuZXcgSW52YWxpZFNpZ25hdHVyZUVycm9yKHsgc2lnbmF0dXJlLCB0eXBlOiAnZmFsbGJhY2snIH0pO1xuICAgIHJldHVybiB7XG4gICAgICAgIHR5cGU6ICdmYWxsYmFjaycsXG4gICAgICAgIHN0YXRlTXV0YWJpbGl0eTogbWF0Y2guc3RhdGVNdXRhYmlsaXR5ID8/ICdub25wYXlhYmxlJyxcbiAgICB9O1xufVxuY29uc3QgYWJpUGFyYW1ldGVyV2l0aG91dFR1cGxlUmVnZXggPSAvXig/PHR5cGU+W2EtekEtWiRfXVthLXpBLVowLTkkX10qKD86XFxzcGF5YWJsZSk/KSg/PGFycmF5Pig/OlxcW1xcZCo/XFxdKSs/KT8oPzpcXHMoPzxtb2RpZmllcj5jYWxsZGF0YXxpbmRleGVkfG1lbW9yeXxzdG9yYWdlezF9KSk/KD86XFxzKD88bmFtZT5bYS16QS1aJF9dW2EtekEtWjAtOSRfXSopKT8kLztcbmNvbnN0IGFiaVBhcmFtZXRlcldpdGhUdXBsZVJlZ2V4ID0gL15cXCgoPzx0eXBlPi4rPylcXCkoPzxhcnJheT4oPzpcXFtcXGQqP1xcXSkrPyk/KD86XFxzKD88bW9kaWZpZXI+Y2FsbGRhdGF8aW5kZXhlZHxtZW1vcnl8c3RvcmFnZXsxfSkpPyg/Olxccyg/PG5hbWU+W2EtekEtWiRfXVthLXpBLVowLTkkX10qKSk/JC87XG5jb25zdCBkeW5hbWljSW50ZWdlclJlZ2V4ID0gL151P2ludCQvO1xuZXhwb3J0IGZ1bmN0aW9uIHBhcnNlQWJpUGFyYW1ldGVyKHBhcmFtLCBvcHRpb25zKSB7XG4gICAgLy8gb3B0aW9uYWwgbmFtZXNwYWNlIGNhY2hlIGJ5IGB0eXBlYFxuICAgIGNvbnN0IHBhcmFtZXRlckNhY2hlS2V5ID0gZ2V0UGFyYW1ldGVyQ2FjaGVLZXkocGFyYW0sIG9wdGlvbnM/LnR5cGUsIG9wdGlvbnM/LnN0cnVjdHMpO1xuICAgIGlmIChwYXJhbWV0ZXJDYWNoZS5oYXMocGFyYW1ldGVyQ2FjaGVLZXkpKVxuICAgICAgICByZXR1cm4gcGFyYW1ldGVyQ2FjaGUuZ2V0KHBhcmFtZXRlckNhY2hlS2V5KTtcbiAgICBjb25zdCBpc1R1cGxlID0gaXNUdXBsZVJlZ2V4LnRlc3QocGFyYW0pO1xuICAgIGNvbnN0IG1hdGNoID0gZXhlY1R5cGVkKGlzVHVwbGUgPyBhYmlQYXJhbWV0ZXJXaXRoVHVwbGVSZWdleCA6IGFiaVBhcmFtZXRlcldpdGhvdXRUdXBsZVJlZ2V4LCBwYXJhbSk7XG4gICAgaWYgKCFtYXRjaClcbiAgICAgICAgdGhyb3cgbmV3IEludmFsaWRQYXJhbWV0ZXJFcnJvcih7IHBhcmFtIH0pO1xuICAgIGlmIChtYXRjaC5uYW1lICYmIGlzU29saWRpdHlLZXl3b3JkKG1hdGNoLm5hbWUpKVxuICAgICAgICB0aHJvdyBuZXcgU29saWRpdHlQcm90ZWN0ZWRLZXl3b3JkRXJyb3IoeyBwYXJhbSwgbmFtZTogbWF0Y2gubmFtZSB9KTtcbiAgICBjb25zdCBuYW1lID0gbWF0Y2gubmFtZSA/IHsgbmFtZTogbWF0Y2gubmFtZSB9IDoge307XG4gICAgY29uc3QgaW5kZXhlZCA9IG1hdGNoLm1vZGlmaWVyID09PSAnaW5kZXhlZCcgPyB7IGluZGV4ZWQ6IHRydWUgfSA6IHt9O1xuICAgIGNvbnN0IHN0cnVjdHMgPSBvcHRpb25zPy5zdHJ1Y3RzID8/IHt9O1xuICAgIGxldCB0eXBlO1xuICAgIGxldCBjb21wb25lbnRzID0ge307XG4gICAgaWYgKGlzVHVwbGUpIHtcbiAgICAgICAgdHlwZSA9ICd0dXBsZSc7XG4gICAgICAgIGNvbnN0IHBhcmFtcyA9IHNwbGl0UGFyYW1ldGVycyhtYXRjaC50eXBlKTtcbiAgICAgICAgY29uc3QgY29tcG9uZW50c18gPSBbXTtcbiAgICAgICAgY29uc3QgbGVuZ3RoID0gcGFyYW1zLmxlbmd0aDtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgLy8gcmVtb3ZlIGBtb2RpZmllcnNgIGZyb20gYG9wdGlvbnNgIHRvIHByZXZlbnQgZnJvbSBiZWluZyBhZGRlZCB0byB0dXBsZSBjb21wb25lbnRzXG4gICAgICAgICAgICBjb21wb25lbnRzXy5wdXNoKHBhcnNlQWJpUGFyYW1ldGVyKHBhcmFtc1tpXSwgeyBzdHJ1Y3RzIH0pKTtcbiAgICAgICAgfVxuICAgICAgICBjb21wb25lbnRzID0geyBjb21wb25lbnRzOiBjb21wb25lbnRzXyB9O1xuICAgIH1cbiAgICBlbHNlIGlmIChtYXRjaC50eXBlIGluIHN0cnVjdHMpIHtcbiAgICAgICAgdHlwZSA9ICd0dXBsZSc7XG4gICAgICAgIGNvbXBvbmVudHMgPSB7IGNvbXBvbmVudHM6IHN0cnVjdHNbbWF0Y2gudHlwZV0gfTtcbiAgICB9XG4gICAgZWxzZSBpZiAoZHluYW1pY0ludGVnZXJSZWdleC50ZXN0KG1hdGNoLnR5cGUpKSB7XG4gICAgICAgIHR5cGUgPSBgJHttYXRjaC50eXBlfTI1NmA7XG4gICAgfVxuICAgIGVsc2UgaWYgKG1hdGNoLnR5cGUgPT09ICdhZGRyZXNzIHBheWFibGUnKSB7XG4gICAgICAgIHR5cGUgPSAnYWRkcmVzcyc7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgICB0eXBlID0gbWF0Y2gudHlwZTtcbiAgICAgICAgaWYgKCEob3B0aW9ucz8udHlwZSA9PT0gJ3N0cnVjdCcpICYmICFpc1NvbGlkaXR5VHlwZSh0eXBlKSlcbiAgICAgICAgICAgIHRocm93IG5ldyBVbmtub3duU29saWRpdHlUeXBlRXJyb3IoeyB0eXBlIH0pO1xuICAgIH1cbiAgICBpZiAobWF0Y2gubW9kaWZpZXIpIHtcbiAgICAgICAgLy8gQ2hlY2sgaWYgbW9kaWZpZXIgZXhpc3RzLCBidXQgaXMgbm90IGFsbG93ZWQgKGUuZy4gYGluZGV4ZWRgIGluIGBmdW5jdGlvbk1vZGlmaWVyc2ApXG4gICAgICAgIGlmICghb3B0aW9ucz8ubW9kaWZpZXJzPy5oYXM/LihtYXRjaC5tb2RpZmllcikpXG4gICAgICAgICAgICB0aHJvdyBuZXcgSW52YWxpZE1vZGlmaWVyRXJyb3Ioe1xuICAgICAgICAgICAgICAgIHBhcmFtLFxuICAgICAgICAgICAgICAgIHR5cGU6IG9wdGlvbnM/LnR5cGUsXG4gICAgICAgICAgICAgICAgbW9kaWZpZXI6IG1hdGNoLm1vZGlmaWVyLFxuICAgICAgICAgICAgfSk7XG4gICAgICAgIC8vIENoZWNrIGlmIHJlc29sdmVkIGB0eXBlYCBpcyB2YWxpZCBpZiB0aGVyZSBpcyBhIGZ1bmN0aW9uIG1vZGlmaWVyXG4gICAgICAgIGlmIChmdW5jdGlvbk1vZGlmaWVycy5oYXMobWF0Y2gubW9kaWZpZXIpICYmXG4gICAgICAgICAgICAhaXNWYWxpZERhdGFMb2NhdGlvbih0eXBlLCAhIW1hdGNoLmFycmF5KSlcbiAgICAgICAgICAgIHRocm93IG5ldyBJbnZhbGlkRnVuY3Rpb25Nb2RpZmllckVycm9yKHtcbiAgICAgICAgICAgICAgICBwYXJhbSxcbiAgICAgICAgICAgICAgICB0eXBlOiBvcHRpb25zPy50eXBlLFxuICAgICAgICAgICAgICAgIG1vZGlmaWVyOiBtYXRjaC5tb2RpZmllcixcbiAgICAgICAgICAgIH0pO1xuICAgIH1cbiAgICBjb25zdCBhYmlQYXJhbWV0ZXIgPSB7XG4gICAgICAgIHR5cGU6IGAke3R5cGV9JHttYXRjaC5hcnJheSA/PyAnJ31gLFxuICAgICAgICAuLi5uYW1lLFxuICAgICAgICAuLi5pbmRleGVkLFxuICAgICAgICAuLi5jb21wb25lbnRzLFxuICAgIH07XG4gICAgcGFyYW1ldGVyQ2FjaGUuc2V0KHBhcmFtZXRlckNhY2hlS2V5LCBhYmlQYXJhbWV0ZXIpO1xuICAgIHJldHVybiBhYmlQYXJhbWV0ZXI7XG59XG4vLyBzL28gbGF0aWthIGZvciB0aGlzXG5leHBvcnQgZnVuY3Rpb24gc3BsaXRQYXJhbWV0ZXJzKHBhcmFtcywgcmVzdWx0ID0gW10sIGN1cnJlbnQgPSAnJywgZGVwdGggPSAwKSB7XG4gICAgY29uc3QgbGVuZ3RoID0gcGFyYW1zLnRyaW0oKS5sZW5ndGg7XG4gICAgLy8gYmlvbWUtaWdub3JlIGxpbnQvY29ycmVjdG5lc3Mvbm9VbnJlYWNoYWJsZTogcmVjdXJzaXZlXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgICAgICBjb25zdCBjaGFyID0gcGFyYW1zW2ldO1xuICAgICAgICBjb25zdCB0YWlsID0gcGFyYW1zLnNsaWNlKGkgKyAxKTtcbiAgICAgICAgc3dpdGNoIChjaGFyKSB7XG4gICAgICAgICAgICBjYXNlICcsJzpcbiAgICAgICAgICAgICAgICByZXR1cm4gZGVwdGggPT09IDBcbiAgICAgICAgICAgICAgICAgICAgPyBzcGxpdFBhcmFtZXRlcnModGFpbCwgWy4uLnJlc3VsdCwgY3VycmVudC50cmltKCldKVxuICAgICAgICAgICAgICAgICAgICA6IHNwbGl0UGFyYW1ldGVycyh0YWlsLCByZXN1bHQsIGAke2N1cnJlbnR9JHtjaGFyfWAsIGRlcHRoKTtcbiAgICAgICAgICAgIGNhc2UgJygnOlxuICAgICAgICAgICAgICAgIHJldHVybiBzcGxpdFBhcmFtZXRlcnModGFpbCwgcmVzdWx0LCBgJHtjdXJyZW50fSR7Y2hhcn1gLCBkZXB0aCArIDEpO1xuICAgICAgICAgICAgY2FzZSAnKSc6XG4gICAgICAgICAgICAgICAgcmV0dXJuIHNwbGl0UGFyYW1ldGVycyh0YWlsLCByZXN1bHQsIGAke2N1cnJlbnR9JHtjaGFyfWAsIGRlcHRoIC0gMSk7XG4gICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgICAgIHJldHVybiBzcGxpdFBhcmFtZXRlcnModGFpbCwgcmVzdWx0LCBgJHtjdXJyZW50fSR7Y2hhcn1gLCBkZXB0aCk7XG4gICAgICAgIH1cbiAgICB9XG4gICAgaWYgKGN1cnJlbnQgPT09ICcnKVxuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgIGlmIChkZXB0aCAhPT0gMClcbiAgICAgICAgdGhyb3cgbmV3IEludmFsaWRQYXJlbnRoZXNpc0Vycm9yKHsgY3VycmVudCwgZGVwdGggfSk7XG4gICAgcmVzdWx0LnB1c2goY3VycmVudC50cmltKCkpO1xuICAgIHJldHVybiByZXN1bHQ7XG59XG5leHBvcnQgZnVuY3Rpb24gaXNTb2xpZGl0eVR5cGUodHlwZSkge1xuICAgIHJldHVybiAodHlwZSA9PT0gJ2FkZHJlc3MnIHx8XG4gICAgICAgIHR5cGUgPT09ICdib29sJyB8fFxuICAgICAgICB0eXBlID09PSAnZnVuY3Rpb24nIHx8XG4gICAgICAgIHR5cGUgPT09ICdzdHJpbmcnIHx8XG4gICAgICAgIGJ5dGVzUmVnZXgudGVzdCh0eXBlKSB8fFxuICAgICAgICBpbnRlZ2VyUmVnZXgudGVzdCh0eXBlKSk7XG59XG5jb25zdCBwcm90ZWN0ZWRLZXl3b3Jkc1JlZ2V4ID0gL14oPzphZnRlcnxhbGlhc3xhbm9ueW1vdXN8YXBwbHl8YXV0b3xieXRlfGNhbGxkYXRhfGNhc2V8Y2F0Y2h8Y29uc3RhbnR8Y29weW9mfGRlZmF1bHR8ZGVmaW5lZHxlcnJvcnxldmVudHxleHRlcm5hbHxmYWxzZXxmaW5hbHxmdW5jdGlvbnxpbW11dGFibGV8aW1wbGVtZW50c3xpbnxpbmRleGVkfGlubGluZXxpbnRlcm5hbHxsZXR8bWFwcGluZ3xtYXRjaHxtZW1vcnl8bXV0YWJsZXxudWxsfG9mfG92ZXJyaWRlfHBhcnRpYWx8cHJpdmF0ZXxwcm9taXNlfHB1YmxpY3xwdXJlfHJlZmVyZW5jZXxyZWxvY2F0YWJsZXxyZXR1cm58cmV0dXJuc3xzaXplb2Z8c3RhdGljfHN0b3JhZ2V8c3RydWN0fHN1cGVyfHN1cHBvcnRzfHN3aXRjaHx0aGlzfHRydWV8dHJ5fHR5cGVkZWZ8dHlwZW9mfHZhcnx2aWV3fHZpcnR1YWwpJC87XG4vKiogQGludGVybmFsICovXG5leHBvcnQgZnVuY3Rpb24gaXNTb2xpZGl0eUtleXdvcmQobmFtZSkge1xuICAgIHJldHVybiAobmFtZSA9PT0gJ2FkZHJlc3MnIHx8XG4gICAgICAgIG5hbWUgPT09ICdib29sJyB8fFxuICAgICAgICBuYW1lID09PSAnZnVuY3Rpb24nIHx8XG4gICAgICAgIG5hbWUgPT09ICdzdHJpbmcnIHx8XG4gICAgICAgIG5hbWUgPT09ICd0dXBsZScgfHxcbiAgICAgICAgYnl0ZXNSZWdleC50ZXN0KG5hbWUpIHx8XG4gICAgICAgIGludGVnZXJSZWdleC50ZXN0KG5hbWUpIHx8XG4gICAgICAgIHByb3RlY3RlZEtleXdvcmRzUmVnZXgudGVzdChuYW1lKSk7XG59XG4vKiogQGludGVybmFsICovXG5leHBvcnQgZnVuY3Rpb24gaXNWYWxpZERhdGFMb2NhdGlvbih0eXBlLCBpc0FycmF5KSB7XG4gICAgcmV0dXJuIGlzQXJyYXkgfHwgdHlwZSA9PT0gJ2J5dGVzJyB8fCB0eXBlID09PSAnc3RyaW5nJyB8fCB0eXBlID09PSAndHVwbGUnO1xufVxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9dXRpbHMuanMubWFwIiwKICAgICJpbXBvcnQgeyBleGVjVHlwZWQsIGlzVHVwbGVSZWdleCB9IGZyb20gJy4uLy4uL3JlZ2V4LmpzJztcbmltcG9ydCB7IFVua25vd25UeXBlRXJyb3IgfSBmcm9tICcuLi9lcnJvcnMvYWJpSXRlbS5qcyc7XG5pbXBvcnQgeyBJbnZhbGlkQWJpVHlwZVBhcmFtZXRlckVycm9yIH0gZnJvbSAnLi4vZXJyb3JzL2FiaVBhcmFtZXRlci5qcyc7XG5pbXBvcnQgeyBJbnZhbGlkU2lnbmF0dXJlRXJyb3IsIEludmFsaWRTdHJ1Y3RTaWduYXR1cmVFcnJvciwgfSBmcm9tICcuLi9lcnJvcnMvc2lnbmF0dXJlLmpzJztcbmltcG9ydCB7IENpcmN1bGFyUmVmZXJlbmNlRXJyb3IgfSBmcm9tICcuLi9lcnJvcnMvc3RydWN0LmpzJztcbmltcG9ydCB7IGV4ZWNTdHJ1Y3RTaWduYXR1cmUsIGlzU3RydWN0U2lnbmF0dXJlIH0gZnJvbSAnLi9zaWduYXR1cmVzLmpzJztcbmltcG9ydCB7IGlzU29saWRpdHlUeXBlLCBwYXJzZUFiaVBhcmFtZXRlciB9IGZyb20gJy4vdXRpbHMuanMnO1xuZXhwb3J0IGZ1bmN0aW9uIHBhcnNlU3RydWN0cyhzaWduYXR1cmVzKSB7XG4gICAgLy8gQ3JlYXRlIFwic2hhbGxvd1wiIHZlcnNpb24gb2YgZWFjaCBzdHJ1Y3QgKGFuZCBmaWx0ZXIgb3V0IG5vbi1zdHJ1Y3RzIG9yIGludmFsaWQgc3RydWN0cylcbiAgICBjb25zdCBzaGFsbG93U3RydWN0cyA9IHt9O1xuICAgIGNvbnN0IHNpZ25hdHVyZXNMZW5ndGggPSBzaWduYXR1cmVzLmxlbmd0aDtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHNpZ25hdHVyZXNMZW5ndGg7IGkrKykge1xuICAgICAgICBjb25zdCBzaWduYXR1cmUgPSBzaWduYXR1cmVzW2ldO1xuICAgICAgICBpZiAoIWlzU3RydWN0U2lnbmF0dXJlKHNpZ25hdHVyZSkpXG4gICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgY29uc3QgbWF0Y2ggPSBleGVjU3RydWN0U2lnbmF0dXJlKHNpZ25hdHVyZSk7XG4gICAgICAgIGlmICghbWF0Y2gpXG4gICAgICAgICAgICB0aHJvdyBuZXcgSW52YWxpZFNpZ25hdHVyZUVycm9yKHsgc2lnbmF0dXJlLCB0eXBlOiAnc3RydWN0JyB9KTtcbiAgICAgICAgY29uc3QgcHJvcGVydGllcyA9IG1hdGNoLnByb3BlcnRpZXMuc3BsaXQoJzsnKTtcbiAgICAgICAgY29uc3QgY29tcG9uZW50cyA9IFtdO1xuICAgICAgICBjb25zdCBwcm9wZXJ0aWVzTGVuZ3RoID0gcHJvcGVydGllcy5sZW5ndGg7XG4gICAgICAgIGZvciAobGV0IGsgPSAwOyBrIDwgcHJvcGVydGllc0xlbmd0aDsgaysrKSB7XG4gICAgICAgICAgICBjb25zdCBwcm9wZXJ0eSA9IHByb3BlcnRpZXNba107XG4gICAgICAgICAgICBjb25zdCB0cmltbWVkID0gcHJvcGVydHkudHJpbSgpO1xuICAgICAgICAgICAgaWYgKCF0cmltbWVkKVxuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgY29uc3QgYWJpUGFyYW1ldGVyID0gcGFyc2VBYmlQYXJhbWV0ZXIodHJpbW1lZCwge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJ1Y3QnLFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBjb21wb25lbnRzLnB1c2goYWJpUGFyYW1ldGVyKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoIWNvbXBvbmVudHMubGVuZ3RoKVxuICAgICAgICAgICAgdGhyb3cgbmV3IEludmFsaWRTdHJ1Y3RTaWduYXR1cmVFcnJvcih7IHNpZ25hdHVyZSB9KTtcbiAgICAgICAgc2hhbGxvd1N0cnVjdHNbbWF0Y2gubmFtZV0gPSBjb21wb25lbnRzO1xuICAgIH1cbiAgICAvLyBSZXNvbHZlIG5lc3RlZCBzdHJ1Y3RzIGluc2lkZSBlYWNoIHBhcmFtZXRlclxuICAgIGNvbnN0IHJlc29sdmVkU3RydWN0cyA9IHt9O1xuICAgIGNvbnN0IGVudHJpZXMgPSBPYmplY3QuZW50cmllcyhzaGFsbG93U3RydWN0cyk7XG4gICAgY29uc3QgZW50cmllc0xlbmd0aCA9IGVudHJpZXMubGVuZ3RoO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZW50cmllc0xlbmd0aDsgaSsrKSB7XG4gICAgICAgIGNvbnN0IFtuYW1lLCBwYXJhbWV0ZXJzXSA9IGVudHJpZXNbaV07XG4gICAgICAgIHJlc29sdmVkU3RydWN0c1tuYW1lXSA9IHJlc29sdmVTdHJ1Y3RzKHBhcmFtZXRlcnMsIHNoYWxsb3dTdHJ1Y3RzKTtcbiAgICB9XG4gICAgcmV0dXJuIHJlc29sdmVkU3RydWN0cztcbn1cbmNvbnN0IHR5cGVXaXRob3V0VHVwbGVSZWdleCA9IC9eKD88dHlwZT5bYS16QS1aJF9dW2EtekEtWjAtOSRfXSopKD88YXJyYXk+KD86XFxbXFxkKj9cXF0pKz8pPyQvO1xuZnVuY3Rpb24gcmVzb2x2ZVN0cnVjdHMoYWJpUGFyYW1ldGVycyA9IFtdLCBzdHJ1Y3RzID0ge30sIGFuY2VzdG9ycyA9IG5ldyBTZXQoKSkge1xuICAgIGNvbnN0IGNvbXBvbmVudHMgPSBbXTtcbiAgICBjb25zdCBsZW5ndGggPSBhYmlQYXJhbWV0ZXJzLmxlbmd0aDtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGNvbnN0IGFiaVBhcmFtZXRlciA9IGFiaVBhcmFtZXRlcnNbaV07XG4gICAgICAgIGNvbnN0IGlzVHVwbGUgPSBpc1R1cGxlUmVnZXgudGVzdChhYmlQYXJhbWV0ZXIudHlwZSk7XG4gICAgICAgIGlmIChpc1R1cGxlKVxuICAgICAgICAgICAgY29tcG9uZW50cy5wdXNoKGFiaVBhcmFtZXRlcik7XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgY29uc3QgbWF0Y2ggPSBleGVjVHlwZWQodHlwZVdpdGhvdXRUdXBsZVJlZ2V4LCBhYmlQYXJhbWV0ZXIudHlwZSk7XG4gICAgICAgICAgICBpZiAoIW1hdGNoPy50eXBlKVxuICAgICAgICAgICAgICAgIHRocm93IG5ldyBJbnZhbGlkQWJpVHlwZVBhcmFtZXRlckVycm9yKHsgYWJpUGFyYW1ldGVyIH0pO1xuICAgICAgICAgICAgY29uc3QgeyBhcnJheSwgdHlwZSB9ID0gbWF0Y2g7XG4gICAgICAgICAgICBpZiAodHlwZSBpbiBzdHJ1Y3RzKSB7XG4gICAgICAgICAgICAgICAgaWYgKGFuY2VzdG9ycy5oYXModHlwZSkpXG4gICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBDaXJjdWxhclJlZmVyZW5jZUVycm9yKHsgdHlwZSB9KTtcbiAgICAgICAgICAgICAgICBjb21wb25lbnRzLnB1c2goe1xuICAgICAgICAgICAgICAgICAgICAuLi5hYmlQYXJhbWV0ZXIsXG4gICAgICAgICAgICAgICAgICAgIHR5cGU6IGB0dXBsZSR7YXJyYXkgPz8gJyd9YCxcbiAgICAgICAgICAgICAgICAgICAgY29tcG9uZW50czogcmVzb2x2ZVN0cnVjdHMoc3RydWN0c1t0eXBlXSwgc3RydWN0cywgbmV3IFNldChbLi4uYW5jZXN0b3JzLCB0eXBlXSkpLFxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgaWYgKGlzU29saWRpdHlUeXBlKHR5cGUpKVxuICAgICAgICAgICAgICAgICAgICBjb21wb25lbnRzLnB1c2goYWJpUGFyYW1ldGVyKTtcbiAgICAgICAgICAgICAgICBlbHNlXG4gICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBVbmtub3duVHlwZUVycm9yKHsgdHlwZSB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gY29tcG9uZW50cztcbn1cbi8vIyBzb3VyY2VNYXBwaW5nVVJMPXN0cnVjdHMuanMubWFwIiwKICAgICJpbXBvcnQgeyBpc1N0cnVjdFNpZ25hdHVyZSB9IGZyb20gJy4vcnVudGltZS9zaWduYXR1cmVzLmpzJztcbmltcG9ydCB7IHBhcnNlU3RydWN0cyB9IGZyb20gJy4vcnVudGltZS9zdHJ1Y3RzLmpzJztcbmltcG9ydCB7IHBhcnNlU2lnbmF0dXJlIH0gZnJvbSAnLi9ydW50aW1lL3V0aWxzLmpzJztcbi8qKlxuICogUGFyc2VzIGh1bWFuLXJlYWRhYmxlIEFCSSBpbnRvIEpTT04ge0BsaW5rIEFiaX1cbiAqXG4gKiBAcGFyYW0gc2lnbmF0dXJlcyAtIEh1bWFuLVJlYWRhYmxlIEFCSVxuICogQHJldHVybnMgUGFyc2VkIHtAbGluayBBYml9XG4gKlxuICogQGV4YW1wbGVcbiAqIGNvbnN0IGFiaSA9IHBhcnNlQWJpKFtcbiAqICAgLy8gIF4/IGNvbnN0IGFiaTogcmVhZG9ubHkgW3sgbmFtZTogXCJiYWxhbmNlT2ZcIjsgdHlwZTogXCJmdW5jdGlvblwiOyBzdGF0ZU11dGFiaWxpdHk6Li4uXG4gKiAgICdmdW5jdGlvbiBiYWxhbmNlT2YoYWRkcmVzcyBvd25lcikgdmlldyByZXR1cm5zICh1aW50MjU2KScsXG4gKiAgICdldmVudCBUcmFuc2ZlcihhZGRyZXNzIGluZGV4ZWQgZnJvbSwgYWRkcmVzcyBpbmRleGVkIHRvLCB1aW50MjU2IGFtb3VudCknLFxuICogXSlcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHBhcnNlQWJpKHNpZ25hdHVyZXMpIHtcbiAgICBjb25zdCBzdHJ1Y3RzID0gcGFyc2VTdHJ1Y3RzKHNpZ25hdHVyZXMpO1xuICAgIGNvbnN0IGFiaSA9IFtdO1xuICAgIGNvbnN0IGxlbmd0aCA9IHNpZ25hdHVyZXMubGVuZ3RoO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICAgICAgY29uc3Qgc2lnbmF0dXJlID0gc2lnbmF0dXJlc1tpXTtcbiAgICAgICAgaWYgKGlzU3RydWN0U2lnbmF0dXJlKHNpZ25hdHVyZSkpXG4gICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgYWJpLnB1c2gocGFyc2VTaWduYXR1cmUoc2lnbmF0dXJlLCBzdHJ1Y3RzKSk7XG4gICAgfVxuICAgIHJldHVybiBhYmk7XG59XG4vLyMgc291cmNlTWFwcGluZ1VSTD1wYXJzZUFiaS5qcy5tYXAiLAogICAgImltcG9ydCB7IEludmFsaWRBYmlJdGVtRXJyb3IgfSBmcm9tICcuL2Vycm9ycy9hYmlJdGVtLmpzJztcbmltcG9ydCB7IGlzU3RydWN0U2lnbmF0dXJlIH0gZnJvbSAnLi9ydW50aW1lL3NpZ25hdHVyZXMuanMnO1xuaW1wb3J0IHsgcGFyc2VTdHJ1Y3RzIH0gZnJvbSAnLi9ydW50aW1lL3N0cnVjdHMuanMnO1xuaW1wb3J0IHsgcGFyc2VTaWduYXR1cmUgfSBmcm9tICcuL3J1bnRpbWUvdXRpbHMuanMnO1xuLyoqXG4gKiBQYXJzZXMgaHVtYW4tcmVhZGFibGUgQUJJIGl0ZW0gKGUuZy4gZXJyb3IsIGV2ZW50LCBmdW5jdGlvbikgaW50byB7QGxpbmsgQWJpfSBpdGVtXG4gKlxuICogQHBhcmFtIHNpZ25hdHVyZSAtIEh1bWFuLXJlYWRhYmxlIEFCSSBpdGVtXG4gKiBAcmV0dXJucyBQYXJzZWQge0BsaW5rIEFiaX0gaXRlbVxuICpcbiAqIEBleGFtcGxlXG4gKiBjb25zdCBhYmlJdGVtID0gcGFyc2VBYmlJdGVtKCdmdW5jdGlvbiBiYWxhbmNlT2YoYWRkcmVzcyBvd25lcikgdmlldyByZXR1cm5zICh1aW50MjU2KScpXG4gKiAvLyAgICBePyBjb25zdCBhYmlJdGVtOiB7IG5hbWU6IFwiYmFsYW5jZU9mXCI7IHR5cGU6IFwiZnVuY3Rpb25cIjsgc3RhdGVNdXRhYmlsaXR5OiBcInZpZXdcIjsuLi5cbiAqXG4gKiBAZXhhbXBsZVxuICogY29uc3QgYWJpSXRlbSA9IHBhcnNlQWJpSXRlbShbXG4gKiAgIC8vICBePyBjb25zdCBhYmlJdGVtOiB7IG5hbWU6IFwiZm9vXCI7IHR5cGU6IFwiZnVuY3Rpb25cIjsgc3RhdGVNdXRhYmlsaXR5OiBcInZpZXdcIjsgaW5wdXRzOi4uLlxuICogICAnZnVuY3Rpb24gZm9vKEJheiBiYXIpIHZpZXcgcmV0dXJucyAoc3RyaW5nKScsXG4gKiAgICdzdHJ1Y3QgQmF6IHsgc3RyaW5nIG5hbWU7IH0nLFxuICogXSlcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHBhcnNlQWJpSXRlbShzaWduYXR1cmUpIHtcbiAgICBsZXQgYWJpSXRlbTtcbiAgICBpZiAodHlwZW9mIHNpZ25hdHVyZSA9PT0gJ3N0cmluZycpXG4gICAgICAgIGFiaUl0ZW0gPSBwYXJzZVNpZ25hdHVyZShzaWduYXR1cmUpO1xuICAgIGVsc2Uge1xuICAgICAgICBjb25zdCBzdHJ1Y3RzID0gcGFyc2VTdHJ1Y3RzKHNpZ25hdHVyZSk7XG4gICAgICAgIGNvbnN0IGxlbmd0aCA9IHNpZ25hdHVyZS5sZW5ndGg7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGNvbnN0IHNpZ25hdHVyZV8gPSBzaWduYXR1cmVbaV07XG4gICAgICAgICAgICBpZiAoaXNTdHJ1Y3RTaWduYXR1cmUoc2lnbmF0dXJlXykpXG4gICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICBhYmlJdGVtID0gcGFyc2VTaWduYXR1cmUoc2lnbmF0dXJlXywgc3RydWN0cyk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgIH1cbiAgICBpZiAoIWFiaUl0ZW0pXG4gICAgICAgIHRocm93IG5ldyBJbnZhbGlkQWJpSXRlbUVycm9yKHsgc2lnbmF0dXJlIH0pO1xuICAgIHJldHVybiBhYmlJdGVtO1xufVxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9cGFyc2VBYmlJdGVtLmpzLm1hcCIsCiAgICAiaW1wb3J0IHsgSW52YWxpZEFiaVBhcmFtZXRlcnNFcnJvciB9IGZyb20gJy4vZXJyb3JzL2FiaVBhcmFtZXRlci5qcyc7XG5pbXBvcnQgeyBpc1N0cnVjdFNpZ25hdHVyZSwgbW9kaWZpZXJzIH0gZnJvbSAnLi9ydW50aW1lL3NpZ25hdHVyZXMuanMnO1xuaW1wb3J0IHsgcGFyc2VTdHJ1Y3RzIH0gZnJvbSAnLi9ydW50aW1lL3N0cnVjdHMuanMnO1xuaW1wb3J0IHsgc3BsaXRQYXJhbWV0ZXJzIH0gZnJvbSAnLi9ydW50aW1lL3V0aWxzLmpzJztcbmltcG9ydCB7IHBhcnNlQWJpUGFyYW1ldGVyIGFzIHBhcnNlQWJpUGFyYW1ldGVyXyB9IGZyb20gJy4vcnVudGltZS91dGlscy5qcyc7XG4vKipcbiAqIFBhcnNlcyBodW1hbi1yZWFkYWJsZSBBQkkgcGFyYW1ldGVycyBpbnRvIHtAbGluayBBYmlQYXJhbWV0ZXJ9c1xuICpcbiAqIEBwYXJhbSBwYXJhbXMgLSBIdW1hbi1yZWFkYWJsZSBBQkkgcGFyYW1ldGVyc1xuICogQHJldHVybnMgUGFyc2VkIHtAbGluayBBYmlQYXJhbWV0ZXJ9c1xuICpcbiAqIEBleGFtcGxlXG4gKiBjb25zdCBhYmlQYXJhbWV0ZXJzID0gcGFyc2VBYmlQYXJhbWV0ZXJzKCdhZGRyZXNzIGZyb20sIGFkZHJlc3MgdG8sIHVpbnQyNTYgYW1vdW50JylcbiAqIC8vICAgIF4/IGNvbnN0IGFiaVBhcmFtZXRlcnM6IFt7IHR5cGU6IFwiYWRkcmVzc1wiOyBuYW1lOiBcImZyb21cIjsgfSwgeyB0eXBlOiBcImFkZHJlc3NcIjsuLi5cbiAqXG4gKiBAZXhhbXBsZVxuICogY29uc3QgYWJpUGFyYW1ldGVycyA9IHBhcnNlQWJpUGFyYW1ldGVycyhbXG4gKiAgIC8vICBePyBjb25zdCBhYmlQYXJhbWV0ZXJzOiBbeyB0eXBlOiBcInR1cGxlXCI7IGNvbXBvbmVudHM6IFt7IHR5cGU6IFwic3RyaW5nXCI7IG5hbWU6Li4uXG4gKiAgICdCYXogYmFyJyxcbiAqICAgJ3N0cnVjdCBCYXogeyBzdHJpbmcgbmFtZTsgfScsXG4gKiBdKVxuICovXG5leHBvcnQgZnVuY3Rpb24gcGFyc2VBYmlQYXJhbWV0ZXJzKHBhcmFtcykge1xuICAgIGNvbnN0IGFiaVBhcmFtZXRlcnMgPSBbXTtcbiAgICBpZiAodHlwZW9mIHBhcmFtcyA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgY29uc3QgcGFyYW1ldGVycyA9IHNwbGl0UGFyYW1ldGVycyhwYXJhbXMpO1xuICAgICAgICBjb25zdCBsZW5ndGggPSBwYXJhbWV0ZXJzLmxlbmd0aDtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgYWJpUGFyYW1ldGVycy5wdXNoKHBhcnNlQWJpUGFyYW1ldGVyXyhwYXJhbWV0ZXJzW2ldLCB7IG1vZGlmaWVycyB9KSk7XG4gICAgICAgIH1cbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICAgIGNvbnN0IHN0cnVjdHMgPSBwYXJzZVN0cnVjdHMocGFyYW1zKTtcbiAgICAgICAgY29uc3QgbGVuZ3RoID0gcGFyYW1zLmxlbmd0aDtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29uc3Qgc2lnbmF0dXJlID0gcGFyYW1zW2ldO1xuICAgICAgICAgICAgaWYgKGlzU3RydWN0U2lnbmF0dXJlKHNpZ25hdHVyZSkpXG4gICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICBjb25zdCBwYXJhbWV0ZXJzID0gc3BsaXRQYXJhbWV0ZXJzKHNpZ25hdHVyZSk7XG4gICAgICAgICAgICBjb25zdCBsZW5ndGggPSBwYXJhbWV0ZXJzLmxlbmd0aDtcbiAgICAgICAgICAgIGZvciAobGV0IGsgPSAwOyBrIDwgbGVuZ3RoOyBrKyspIHtcbiAgICAgICAgICAgICAgICBhYmlQYXJhbWV0ZXJzLnB1c2gocGFyc2VBYmlQYXJhbWV0ZXJfKHBhcmFtZXRlcnNba10sIHsgbW9kaWZpZXJzLCBzdHJ1Y3RzIH0pKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbiAgICBpZiAoYWJpUGFyYW1ldGVycy5sZW5ndGggPT09IDApXG4gICAgICAgIHRocm93IG5ldyBJbnZhbGlkQWJpUGFyYW1ldGVyc0Vycm9yKHsgcGFyYW1zIH0pO1xuICAgIHJldHVybiBhYmlQYXJhbWV0ZXJzO1xufVxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9cGFyc2VBYmlQYXJhbWV0ZXJzLmpzLm1hcCIsCiAgICAiLyoqIEBpbnRlcm5hbCAqL1xuZXhwb3J0IGNvbnN0IHZlcnNpb24gPSAnMC4xLjEnO1xuLy8jIHNvdXJjZU1hcHBpbmdVUkw9dmVyc2lvbi5qcy5tYXAiLAogICAgImltcG9ydCB7IHZlcnNpb24gfSBmcm9tICcuLi92ZXJzaW9uLmpzJztcbi8qKiBAaW50ZXJuYWwgKi9cbmV4cG9ydCBmdW5jdGlvbiBnZXRVcmwodXJsKSB7XG4gICAgcmV0dXJuIHVybDtcbn1cbi8qKiBAaW50ZXJuYWwgKi9cbmV4cG9ydCBmdW5jdGlvbiBnZXRWZXJzaW9uKCkge1xuICAgIHJldHVybiB2ZXJzaW9uO1xufVxuLyoqIEBpbnRlcm5hbCAqL1xuZXhwb3J0IGZ1bmN0aW9uIHByZXR0eVByaW50KGFyZ3MpIHtcbiAgICBpZiAoIWFyZ3MpXG4gICAgICAgIHJldHVybiAnJztcbiAgICBjb25zdCBlbnRyaWVzID0gT2JqZWN0LmVudHJpZXMoYXJncylcbiAgICAgICAgLm1hcCgoW2tleSwgdmFsdWVdKSA9PiB7XG4gICAgICAgIGlmICh2YWx1ZSA9PT0gdW5kZWZpbmVkIHx8IHZhbHVlID09PSBmYWxzZSlcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICByZXR1cm4gW2tleSwgdmFsdWVdO1xuICAgIH0pXG4gICAgICAgIC5maWx0ZXIoQm9vbGVhbik7XG4gICAgY29uc3QgbWF4TGVuZ3RoID0gZW50cmllcy5yZWR1Y2UoKGFjYywgW2tleV0pID0+IE1hdGgubWF4KGFjYywga2V5Lmxlbmd0aCksIDApO1xuICAgIHJldHVybiBlbnRyaWVzXG4gICAgICAgIC5tYXAoKFtrZXksIHZhbHVlXSkgPT4gYCAgJHtgJHtrZXl9OmAucGFkRW5kKG1heExlbmd0aCArIDEpfSAgJHt2YWx1ZX1gKVxuICAgICAgICAuam9pbignXFxuJyk7XG59XG4vLyMgc291cmNlTWFwcGluZ1VSTD1lcnJvcnMuanMubWFwIiwKICAgICJpbXBvcnQgeyBnZXRWZXJzaW9uIH0gZnJvbSAnLi9pbnRlcm5hbC9lcnJvcnMuanMnO1xuLyoqXG4gKiBCYXNlIGVycm9yIGNsYXNzIGluaGVyaXRlZCBieSBhbGwgZXJyb3JzIHRocm93biBieSBveC5cbiAqXG4gKiBAZXhhbXBsZVxuICogYGBgdHNcbiAqIGltcG9ydCB7IEVycm9ycyB9IGZyb20gJ294J1xuICogdGhyb3cgbmV3IEVycm9ycy5CYXNlRXJyb3IoJ0FuIGVycm9yIG9jY3VycmVkJylcbiAqIGBgYFxuICovXG5leHBvcnQgY2xhc3MgQmFzZUVycm9yIGV4dGVuZHMgRXJyb3Ige1xuICAgIHN0YXRpYyBzZXRTdGF0aWNPcHRpb25zKG9wdGlvbnMpIHtcbiAgICAgICAgQmFzZUVycm9yLnByb3RvdHlwZS5kb2NzT3JpZ2luID0gb3B0aW9ucy5kb2NzT3JpZ2luO1xuICAgICAgICBCYXNlRXJyb3IucHJvdG90eXBlLnNob3dWZXJzaW9uID0gb3B0aW9ucy5zaG93VmVyc2lvbjtcbiAgICAgICAgQmFzZUVycm9yLnByb3RvdHlwZS52ZXJzaW9uID0gb3B0aW9ucy52ZXJzaW9uO1xuICAgIH1cbiAgICBjb25zdHJ1Y3RvcihzaG9ydE1lc3NhZ2UsIG9wdGlvbnMgPSB7fSkge1xuICAgICAgICBjb25zdCBkZXRhaWxzID0gKCgpID0+IHtcbiAgICAgICAgICAgIGlmIChvcHRpb25zLmNhdXNlIGluc3RhbmNlb2YgQmFzZUVycm9yKSB7XG4gICAgICAgICAgICAgICAgaWYgKG9wdGlvbnMuY2F1c2UuZGV0YWlscylcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG9wdGlvbnMuY2F1c2UuZGV0YWlscztcbiAgICAgICAgICAgICAgICBpZiAob3B0aW9ucy5jYXVzZS5zaG9ydE1lc3NhZ2UpXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBvcHRpb25zLmNhdXNlLnNob3J0TWVzc2FnZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChvcHRpb25zLmNhdXNlICYmXG4gICAgICAgICAgICAgICAgJ2RldGFpbHMnIGluIG9wdGlvbnMuY2F1c2UgJiZcbiAgICAgICAgICAgICAgICB0eXBlb2Ygb3B0aW9ucy5jYXVzZS5kZXRhaWxzID09PSAnc3RyaW5nJylcbiAgICAgICAgICAgICAgICByZXR1cm4gb3B0aW9ucy5jYXVzZS5kZXRhaWxzO1xuICAgICAgICAgICAgaWYgKG9wdGlvbnMuY2F1c2U/Lm1lc3NhZ2UpXG4gICAgICAgICAgICAgICAgcmV0dXJuIG9wdGlvbnMuY2F1c2UubWVzc2FnZTtcbiAgICAgICAgICAgIHJldHVybiBvcHRpb25zLmRldGFpbHM7XG4gICAgICAgIH0pKCk7XG4gICAgICAgIGNvbnN0IGRvY3NQYXRoID0gKCgpID0+IHtcbiAgICAgICAgICAgIGlmIChvcHRpb25zLmNhdXNlIGluc3RhbmNlb2YgQmFzZUVycm9yKVxuICAgICAgICAgICAgICAgIHJldHVybiBvcHRpb25zLmNhdXNlLmRvY3NQYXRoIHx8IG9wdGlvbnMuZG9jc1BhdGg7XG4gICAgICAgICAgICByZXR1cm4gb3B0aW9ucy5kb2NzUGF0aDtcbiAgICAgICAgfSkoKTtcbiAgICAgICAgY29uc3QgZG9jc0Jhc2VVcmwgPSBvcHRpb25zLmRvY3NPcmlnaW4gPz8gQmFzZUVycm9yLnByb3RvdHlwZS5kb2NzT3JpZ2luO1xuICAgICAgICBjb25zdCBkb2NzID0gYCR7ZG9jc0Jhc2VVcmx9JHtkb2NzUGF0aCA/PyAnJ31gO1xuICAgICAgICBjb25zdCBzaG93VmVyc2lvbiA9IEJvb2xlYW4ob3B0aW9ucy52ZXJzaW9uID8/IEJhc2VFcnJvci5wcm90b3R5cGUuc2hvd1ZlcnNpb24pO1xuICAgICAgICBjb25zdCB2ZXJzaW9uID0gb3B0aW9ucy52ZXJzaW9uID8/IEJhc2VFcnJvci5wcm90b3R5cGUudmVyc2lvbjtcbiAgICAgICAgY29uc3QgbWVzc2FnZSA9IFtcbiAgICAgICAgICAgIHNob3J0TWVzc2FnZSB8fCAnQW4gZXJyb3Igb2NjdXJyZWQuJyxcbiAgICAgICAgICAgIC4uLihvcHRpb25zLm1ldGFNZXNzYWdlcyA/IFsnJywgLi4ub3B0aW9ucy5tZXRhTWVzc2FnZXNdIDogW10pLFxuICAgICAgICAgICAgLi4uKGRldGFpbHMgfHwgZG9jc1BhdGggfHwgc2hvd1ZlcnNpb25cbiAgICAgICAgICAgICAgICA/IFtcbiAgICAgICAgICAgICAgICAgICAgJycsXG4gICAgICAgICAgICAgICAgICAgIGRldGFpbHMgPyBgRGV0YWlsczogJHtkZXRhaWxzfWAgOiB1bmRlZmluZWQsXG4gICAgICAgICAgICAgICAgICAgIGRvY3NQYXRoID8gYFNlZTogJHtkb2NzfWAgOiB1bmRlZmluZWQsXG4gICAgICAgICAgICAgICAgICAgIHNob3dWZXJzaW9uID8gYFZlcnNpb246ICR7dmVyc2lvbn1gIDogdW5kZWZpbmVkLFxuICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgICA6IFtdKSxcbiAgICAgICAgXVxuICAgICAgICAgICAgLmZpbHRlcigoeCkgPT4gdHlwZW9mIHggPT09ICdzdHJpbmcnKVxuICAgICAgICAgICAgLmpvaW4oJ1xcbicpO1xuICAgICAgICBzdXBlcihtZXNzYWdlLCBvcHRpb25zLmNhdXNlID8geyBjYXVzZTogb3B0aW9ucy5jYXVzZSB9IDogdW5kZWZpbmVkKTtcbiAgICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRoaXMsIFwiZGV0YWlsc1wiLCB7XG4gICAgICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlLFxuICAgICAgICAgICAgd3JpdGFibGU6IHRydWUsXG4gICAgICAgICAgICB2YWx1ZTogdm9pZCAwXG4gICAgICAgIH0pO1xuICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkodGhpcywgXCJkb2NzXCIsIHtcbiAgICAgICAgICAgIGVudW1lcmFibGU6IHRydWUsXG4gICAgICAgICAgICBjb25maWd1cmFibGU6IHRydWUsXG4gICAgICAgICAgICB3cml0YWJsZTogdHJ1ZSxcbiAgICAgICAgICAgIHZhbHVlOiB2b2lkIDBcbiAgICAgICAgfSk7XG4gICAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0aGlzLCBcImRvY3NPcmlnaW5cIiwge1xuICAgICAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICAgICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgICAgICAgICAgIHdyaXRhYmxlOiB0cnVlLFxuICAgICAgICAgICAgdmFsdWU6IHZvaWQgMFxuICAgICAgICB9KTtcbiAgICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRoaXMsIFwiZG9jc1BhdGhcIiwge1xuICAgICAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICAgICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgICAgICAgICAgIHdyaXRhYmxlOiB0cnVlLFxuICAgICAgICAgICAgdmFsdWU6IHZvaWQgMFxuICAgICAgICB9KTtcbiAgICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRoaXMsIFwic2hvcnRNZXNzYWdlXCIsIHtcbiAgICAgICAgICAgIGVudW1lcmFibGU6IHRydWUsXG4gICAgICAgICAgICBjb25maWd1cmFibGU6IHRydWUsXG4gICAgICAgICAgICB3cml0YWJsZTogdHJ1ZSxcbiAgICAgICAgICAgIHZhbHVlOiB2b2lkIDBcbiAgICAgICAgfSk7XG4gICAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0aGlzLCBcInNob3dWZXJzaW9uXCIsIHtcbiAgICAgICAgICAgIGVudW1lcmFibGU6IHRydWUsXG4gICAgICAgICAgICBjb25maWd1cmFibGU6IHRydWUsXG4gICAgICAgICAgICB3cml0YWJsZTogdHJ1ZSxcbiAgICAgICAgICAgIHZhbHVlOiB2b2lkIDBcbiAgICAgICAgfSk7XG4gICAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0aGlzLCBcInZlcnNpb25cIiwge1xuICAgICAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICAgICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgICAgICAgICAgIHdyaXRhYmxlOiB0cnVlLFxuICAgICAgICAgICAgdmFsdWU6IHZvaWQgMFxuICAgICAgICB9KTtcbiAgICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRoaXMsIFwiY2F1c2VcIiwge1xuICAgICAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICAgICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgICAgICAgICAgIHdyaXRhYmxlOiB0cnVlLFxuICAgICAgICAgICAgdmFsdWU6IHZvaWQgMFxuICAgICAgICB9KTtcbiAgICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRoaXMsIFwibmFtZVwiLCB7XG4gICAgICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlLFxuICAgICAgICAgICAgd3JpdGFibGU6IHRydWUsXG4gICAgICAgICAgICB2YWx1ZTogJ0Jhc2VFcnJvcidcbiAgICAgICAgfSk7XG4gICAgICAgIHRoaXMuY2F1c2UgPSBvcHRpb25zLmNhdXNlO1xuICAgICAgICB0aGlzLmRldGFpbHMgPSBkZXRhaWxzO1xuICAgICAgICB0aGlzLmRvY3MgPSBkb2NzO1xuICAgICAgICB0aGlzLmRvY3NPcmlnaW4gPSBkb2NzQmFzZVVybDtcbiAgICAgICAgdGhpcy5kb2NzUGF0aCA9IGRvY3NQYXRoO1xuICAgICAgICB0aGlzLnNob3J0TWVzc2FnZSA9IHNob3J0TWVzc2FnZTtcbiAgICAgICAgdGhpcy5zaG93VmVyc2lvbiA9IHNob3dWZXJzaW9uO1xuICAgICAgICB0aGlzLnZlcnNpb24gPSB2ZXJzaW9uO1xuICAgIH1cbiAgICB3YWxrKGZuKSB7XG4gICAgICAgIHJldHVybiB3YWxrKHRoaXMsIGZuKTtcbiAgICB9XG59XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoQmFzZUVycm9yLCBcImRlZmF1bHRTdGF0aWNPcHRpb25zXCIsIHtcbiAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgICB3cml0YWJsZTogdHJ1ZSxcbiAgICB2YWx1ZToge1xuICAgICAgICBkb2NzT3JpZ2luOiAnaHR0cHM6Ly9veGxpYi5zaCcsXG4gICAgICAgIHNob3dWZXJzaW9uOiBmYWxzZSxcbiAgICAgICAgdmVyc2lvbjogYG94QCR7Z2V0VmVyc2lvbigpfWAsXG4gICAgfVxufSk7XG4oKCkgPT4ge1xuICAgIEJhc2VFcnJvci5zZXRTdGF0aWNPcHRpb25zKEJhc2VFcnJvci5kZWZhdWx0U3RhdGljT3B0aW9ucyk7XG59KSgpO1xuLyoqIEBpbnRlcm5hbCAqL1xuZnVuY3Rpb24gd2FsayhlcnIsIGZuKSB7XG4gICAgaWYgKGZuPy4oZXJyKSlcbiAgICAgICAgcmV0dXJuIGVycjtcbiAgICBpZiAoZXJyICYmIHR5cGVvZiBlcnIgPT09ICdvYmplY3QnICYmICdjYXVzZScgaW4gZXJyICYmIGVyci5jYXVzZSlcbiAgICAgICAgcmV0dXJuIHdhbGsoZXJyLmNhdXNlLCBmbik7XG4gICAgcmV0dXJuIGZuID8gbnVsbCA6IGVycjtcbn1cbi8vIyBzb3VyY2VNYXBwaW5nVVJMPUVycm9ycy5qcy5tYXAiLAogICAgImltcG9ydCAqIGFzIEJ5dGVzIGZyb20gJy4uL0J5dGVzLmpzJztcbi8qKiBAaW50ZXJuYWwgKi9cbmV4cG9ydCBmdW5jdGlvbiBhc3NlcnRTaXplKGJ5dGVzLCBzaXplXykge1xuICAgIGlmIChCeXRlcy5zaXplKGJ5dGVzKSA+IHNpemVfKVxuICAgICAgICB0aHJvdyBuZXcgQnl0ZXMuU2l6ZU92ZXJmbG93RXJyb3Ioe1xuICAgICAgICAgICAgZ2l2ZW5TaXplOiBCeXRlcy5zaXplKGJ5dGVzKSxcbiAgICAgICAgICAgIG1heFNpemU6IHNpemVfLFxuICAgICAgICB9KTtcbn1cbi8qKiBAaW50ZXJuYWwgKi9cbmV4cG9ydCBmdW5jdGlvbiBhc3NlcnRTdGFydE9mZnNldCh2YWx1ZSwgc3RhcnQpIHtcbiAgICBpZiAodHlwZW9mIHN0YXJ0ID09PSAnbnVtYmVyJyAmJiBzdGFydCA+IDAgJiYgc3RhcnQgPiBCeXRlcy5zaXplKHZhbHVlKSAtIDEpXG4gICAgICAgIHRocm93IG5ldyBCeXRlcy5TbGljZU9mZnNldE91dE9mQm91bmRzRXJyb3Ioe1xuICAgICAgICAgICAgb2Zmc2V0OiBzdGFydCxcbiAgICAgICAgICAgIHBvc2l0aW9uOiAnc3RhcnQnLFxuICAgICAgICAgICAgc2l6ZTogQnl0ZXMuc2l6ZSh2YWx1ZSksXG4gICAgICAgIH0pO1xufVxuLyoqIEBpbnRlcm5hbCAqL1xuZXhwb3J0IGZ1bmN0aW9uIGFzc2VydEVuZE9mZnNldCh2YWx1ZSwgc3RhcnQsIGVuZCkge1xuICAgIGlmICh0eXBlb2Ygc3RhcnQgPT09ICdudW1iZXInICYmXG4gICAgICAgIHR5cGVvZiBlbmQgPT09ICdudW1iZXInICYmXG4gICAgICAgIEJ5dGVzLnNpemUodmFsdWUpICE9PSBlbmQgLSBzdGFydCkge1xuICAgICAgICB0aHJvdyBuZXcgQnl0ZXMuU2xpY2VPZmZzZXRPdXRPZkJvdW5kc0Vycm9yKHtcbiAgICAgICAgICAgIG9mZnNldDogZW5kLFxuICAgICAgICAgICAgcG9zaXRpb246ICdlbmQnLFxuICAgICAgICAgICAgc2l6ZTogQnl0ZXMuc2l6ZSh2YWx1ZSksXG4gICAgICAgIH0pO1xuICAgIH1cbn1cbi8qKiBAaW50ZXJuYWwgKi9cbmV4cG9ydCBjb25zdCBjaGFyQ29kZU1hcCA9IHtcbiAgICB6ZXJvOiA0OCxcbiAgICBuaW5lOiA1NyxcbiAgICBBOiA2NSxcbiAgICBGOiA3MCxcbiAgICBhOiA5NyxcbiAgICBmOiAxMDIsXG59O1xuLyoqIEBpbnRlcm5hbCAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNoYXJDb2RlVG9CYXNlMTYoY2hhcikge1xuICAgIGlmIChjaGFyID49IGNoYXJDb2RlTWFwLnplcm8gJiYgY2hhciA8PSBjaGFyQ29kZU1hcC5uaW5lKVxuICAgICAgICByZXR1cm4gY2hhciAtIGNoYXJDb2RlTWFwLnplcm87XG4gICAgaWYgKGNoYXIgPj0gY2hhckNvZGVNYXAuQSAmJiBjaGFyIDw9IGNoYXJDb2RlTWFwLkYpXG4gICAgICAgIHJldHVybiBjaGFyIC0gKGNoYXJDb2RlTWFwLkEgLSAxMCk7XG4gICAgaWYgKGNoYXIgPj0gY2hhckNvZGVNYXAuYSAmJiBjaGFyIDw9IGNoYXJDb2RlTWFwLmYpXG4gICAgICAgIHJldHVybiBjaGFyIC0gKGNoYXJDb2RlTWFwLmEgLSAxMCk7XG4gICAgcmV0dXJuIHVuZGVmaW5lZDtcbn1cbi8qKiBAaW50ZXJuYWwgKi9cbmV4cG9ydCBmdW5jdGlvbiBwYWQoYnl0ZXMsIG9wdGlvbnMgPSB7fSkge1xuICAgIGNvbnN0IHsgZGlyLCBzaXplID0gMzIgfSA9IG9wdGlvbnM7XG4gICAgaWYgKHNpemUgPT09IDApXG4gICAgICAgIHJldHVybiBieXRlcztcbiAgICBpZiAoYnl0ZXMubGVuZ3RoID4gc2l6ZSlcbiAgICAgICAgdGhyb3cgbmV3IEJ5dGVzLlNpemVFeGNlZWRzUGFkZGluZ1NpemVFcnJvcih7XG4gICAgICAgICAgICBzaXplOiBieXRlcy5sZW5ndGgsXG4gICAgICAgICAgICB0YXJnZXRTaXplOiBzaXplLFxuICAgICAgICAgICAgdHlwZTogJ0J5dGVzJyxcbiAgICAgICAgfSk7XG4gICAgY29uc3QgcGFkZGVkQnl0ZXMgPSBuZXcgVWludDhBcnJheShzaXplKTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHNpemU7IGkrKykge1xuICAgICAgICBjb25zdCBwYWRFbmQgPSBkaXIgPT09ICdyaWdodCc7XG4gICAgICAgIHBhZGRlZEJ5dGVzW3BhZEVuZCA/IGkgOiBzaXplIC0gaSAtIDFdID1cbiAgICAgICAgICAgIGJ5dGVzW3BhZEVuZCA/IGkgOiBieXRlcy5sZW5ndGggLSBpIC0gMV07XG4gICAgfVxuICAgIHJldHVybiBwYWRkZWRCeXRlcztcbn1cbi8qKiBAaW50ZXJuYWwgKi9cbmV4cG9ydCBmdW5jdGlvbiB0cmltKHZhbHVlLCBvcHRpb25zID0ge30pIHtcbiAgICBjb25zdCB7IGRpciA9ICdsZWZ0JyB9ID0gb3B0aW9ucztcbiAgICBsZXQgZGF0YSA9IHZhbHVlO1xuICAgIGxldCBzbGljZUxlbmd0aCA9IDA7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBkYXRhLmxlbmd0aCAtIDE7IGkrKykge1xuICAgICAgICBpZiAoZGF0YVtkaXIgPT09ICdsZWZ0JyA/IGkgOiBkYXRhLmxlbmd0aCAtIGkgLSAxXS50b1N0cmluZygpID09PSAnMCcpXG4gICAgICAgICAgICBzbGljZUxlbmd0aCsrO1xuICAgICAgICBlbHNlXG4gICAgICAgICAgICBicmVhaztcbiAgICB9XG4gICAgZGF0YSA9XG4gICAgICAgIGRpciA9PT0gJ2xlZnQnXG4gICAgICAgICAgICA/IGRhdGEuc2xpY2Uoc2xpY2VMZW5ndGgpXG4gICAgICAgICAgICA6IGRhdGEuc2xpY2UoMCwgZGF0YS5sZW5ndGggLSBzbGljZUxlbmd0aCk7XG4gICAgcmV0dXJuIGRhdGE7XG59XG4vLyMgc291cmNlTWFwcGluZ1VSTD1ieXRlcy5qcy5tYXAiLAogICAgImltcG9ydCAqIGFzIEhleCBmcm9tICcuLi9IZXguanMnO1xuLyoqIEBpbnRlcm5hbCAqL1xuZXhwb3J0IGZ1bmN0aW9uIGFzc2VydFNpemUoaGV4LCBzaXplXykge1xuICAgIGlmIChIZXguc2l6ZShoZXgpID4gc2l6ZV8pXG4gICAgICAgIHRocm93IG5ldyBIZXguU2l6ZU92ZXJmbG93RXJyb3Ioe1xuICAgICAgICAgICAgZ2l2ZW5TaXplOiBIZXguc2l6ZShoZXgpLFxuICAgICAgICAgICAgbWF4U2l6ZTogc2l6ZV8sXG4gICAgICAgIH0pO1xufVxuLyoqIEBpbnRlcm5hbCAqL1xuZXhwb3J0IGZ1bmN0aW9uIGFzc2VydFN0YXJ0T2Zmc2V0KHZhbHVlLCBzdGFydCkge1xuICAgIGlmICh0eXBlb2Ygc3RhcnQgPT09ICdudW1iZXInICYmIHN0YXJ0ID4gMCAmJiBzdGFydCA+IEhleC5zaXplKHZhbHVlKSAtIDEpXG4gICAgICAgIHRocm93IG5ldyBIZXguU2xpY2VPZmZzZXRPdXRPZkJvdW5kc0Vycm9yKHtcbiAgICAgICAgICAgIG9mZnNldDogc3RhcnQsXG4gICAgICAgICAgICBwb3NpdGlvbjogJ3N0YXJ0JyxcbiAgICAgICAgICAgIHNpemU6IEhleC5zaXplKHZhbHVlKSxcbiAgICAgICAgfSk7XG59XG4vKiogQGludGVybmFsICovXG5leHBvcnQgZnVuY3Rpb24gYXNzZXJ0RW5kT2Zmc2V0KHZhbHVlLCBzdGFydCwgZW5kKSB7XG4gICAgaWYgKHR5cGVvZiBzdGFydCA9PT0gJ251bWJlcicgJiZcbiAgICAgICAgdHlwZW9mIGVuZCA9PT0gJ251bWJlcicgJiZcbiAgICAgICAgSGV4LnNpemUodmFsdWUpICE9PSBlbmQgLSBzdGFydCkge1xuICAgICAgICB0aHJvdyBuZXcgSGV4LlNsaWNlT2Zmc2V0T3V0T2ZCb3VuZHNFcnJvcih7XG4gICAgICAgICAgICBvZmZzZXQ6IGVuZCxcbiAgICAgICAgICAgIHBvc2l0aW9uOiAnZW5kJyxcbiAgICAgICAgICAgIHNpemU6IEhleC5zaXplKHZhbHVlKSxcbiAgICAgICAgfSk7XG4gICAgfVxufVxuLyoqIEBpbnRlcm5hbCAqL1xuZXhwb3J0IGZ1bmN0aW9uIHBhZChoZXhfLCBvcHRpb25zID0ge30pIHtcbiAgICBjb25zdCB7IGRpciwgc2l6ZSA9IDMyIH0gPSBvcHRpb25zO1xuICAgIGlmIChzaXplID09PSAwKVxuICAgICAgICByZXR1cm4gaGV4XztcbiAgICBjb25zdCBoZXggPSBoZXhfLnJlcGxhY2UoJzB4JywgJycpO1xuICAgIGlmIChoZXgubGVuZ3RoID4gc2l6ZSAqIDIpXG4gICAgICAgIHRocm93IG5ldyBIZXguU2l6ZUV4Y2VlZHNQYWRkaW5nU2l6ZUVycm9yKHtcbiAgICAgICAgICAgIHNpemU6IE1hdGguY2VpbChoZXgubGVuZ3RoIC8gMiksXG4gICAgICAgICAgICB0YXJnZXRTaXplOiBzaXplLFxuICAgICAgICAgICAgdHlwZTogJ0hleCcsXG4gICAgICAgIH0pO1xuICAgIHJldHVybiBgMHgke2hleFtkaXIgPT09ICdyaWdodCcgPyAncGFkRW5kJyA6ICdwYWRTdGFydCddKHNpemUgKiAyLCAnMCcpfWA7XG59XG4vKiogQGludGVybmFsICovXG5leHBvcnQgZnVuY3Rpb24gdHJpbSh2YWx1ZSwgb3B0aW9ucyA9IHt9KSB7XG4gICAgY29uc3QgeyBkaXIgPSAnbGVmdCcgfSA9IG9wdGlvbnM7XG4gICAgbGV0IGRhdGEgPSB2YWx1ZS5yZXBsYWNlKCcweCcsICcnKTtcbiAgICBsZXQgc2xpY2VMZW5ndGggPSAwO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZGF0YS5sZW5ndGggLSAxOyBpKyspIHtcbiAgICAgICAgaWYgKGRhdGFbZGlyID09PSAnbGVmdCcgPyBpIDogZGF0YS5sZW5ndGggLSBpIC0gMV0udG9TdHJpbmcoKSA9PT0gJzAnKVxuICAgICAgICAgICAgc2xpY2VMZW5ndGgrKztcbiAgICAgICAgZWxzZVxuICAgICAgICAgICAgYnJlYWs7XG4gICAgfVxuICAgIGRhdGEgPVxuICAgICAgICBkaXIgPT09ICdsZWZ0J1xuICAgICAgICAgICAgPyBkYXRhLnNsaWNlKHNsaWNlTGVuZ3RoKVxuICAgICAgICAgICAgOiBkYXRhLnNsaWNlKDAsIGRhdGEubGVuZ3RoIC0gc2xpY2VMZW5ndGgpO1xuICAgIGlmIChkYXRhID09PSAnMCcpXG4gICAgICAgIHJldHVybiAnMHgnO1xuICAgIGlmIChkaXIgPT09ICdyaWdodCcgJiYgZGF0YS5sZW5ndGggJSAyID09PSAxKVxuICAgICAgICByZXR1cm4gYDB4JHtkYXRhfTBgO1xuICAgIHJldHVybiBgMHgke2RhdGF9YDtcbn1cbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWhleC5qcy5tYXAiLAogICAgImNvbnN0IGJpZ0ludFN1ZmZpeCA9ICcjX19iaWdpbnQnO1xuLyoqXG4gKiBQYXJzZXMgYSBKU09OIHN0cmluZywgd2l0aCBzdXBwb3J0IGZvciBgYmlnaW50YC5cbiAqXG4gKiBAZXhhbXBsZVxuICogYGBgdHMgdHdvc2xhc2hcbiAqIGltcG9ydCB7IEpzb24gfSBmcm9tICdveCdcbiAqXG4gKiBjb25zdCBqc29uID0gSnNvbi5wYXJzZSgne1wiZm9vXCI6XCJiYXJcIixcImJhelwiOlwiNjk0MjA2OTQyMDY5NDIwNjk0MjA2OTQyMDY5NDIwNjk0MjA2OTQyMDY5NDIwNjk0MjAjX19iaWdpbnRcIn0nKVxuICogLy8gQGxvZzoge1xuICogLy8gQGxvZzogICBmb286ICdiYXInLFxuICogLy8gQGxvZzogICBiYXo6IDY5NDIwNjk0MjA2OTQyMDY5NDIwNjk0MjA2OTQyMDY5NDIwNjk0MjA2OTQyMDY5NDIwblxuICogLy8gQGxvZzogfVxuICogYGBgXG4gKlxuICogQHBhcmFtIHN0cmluZyAtIFRoZSB2YWx1ZSB0byBwYXJzZS5cbiAqIEBwYXJhbSByZXZpdmVyIC0gQSBmdW5jdGlvbiB0aGF0IHRyYW5zZm9ybXMgdGhlIHJlc3VsdHMuXG4gKiBAcmV0dXJucyBUaGUgcGFyc2VkIHZhbHVlLlxuICovXG5leHBvcnQgZnVuY3Rpb24gcGFyc2Uoc3RyaW5nLCByZXZpdmVyKSB7XG4gICAgcmV0dXJuIEpTT04ucGFyc2Uoc3RyaW5nLCAoa2V5LCB2YWx1ZV8pID0+IHtcbiAgICAgICAgY29uc3QgdmFsdWUgPSB2YWx1ZV87XG4gICAgICAgIGlmICh0eXBlb2YgdmFsdWUgPT09ICdzdHJpbmcnICYmIHZhbHVlLmVuZHNXaXRoKGJpZ0ludFN1ZmZpeCkpXG4gICAgICAgICAgICByZXR1cm4gQmlnSW50KHZhbHVlLnNsaWNlKDAsIC1iaWdJbnRTdWZmaXgubGVuZ3RoKSk7XG4gICAgICAgIHJldHVybiB0eXBlb2YgcmV2aXZlciA9PT0gJ2Z1bmN0aW9uJyA/IHJldml2ZXIoa2V5LCB2YWx1ZSkgOiB2YWx1ZTtcbiAgICB9KTtcbn1cbi8qKlxuICogU3RyaW5naWZpZXMgYSB2YWx1ZSB0byBpdHMgSlNPTiByZXByZXNlbnRhdGlvbiwgd2l0aCBzdXBwb3J0IGZvciBgYmlnaW50YC5cbiAqXG4gKiBAZXhhbXBsZVxuICogYGBgdHMgdHdvc2xhc2hcbiAqIGltcG9ydCB7IEpzb24gfSBmcm9tICdveCdcbiAqXG4gKiBjb25zdCBqc29uID0gSnNvbi5zdHJpbmdpZnkoe1xuICogICBmb286ICdiYXInLFxuICogICBiYXo6IDY5NDIwNjk0MjA2OTQyMDY5NDIwNjk0MjA2OTQyMDY5NDIwNjk0MjA2OTQyMDY5NDIwbixcbiAqIH0pXG4gKiAvLyBAbG9nOiAne1wiZm9vXCI6XCJiYXJcIixcImJhelwiOlwiNjk0MjA2OTQyMDY5NDIwNjk0MjA2OTQyMDY5NDIwNjk0MjA2OTQyMDY5NDIwNjk0MjAjX19iaWdpbnRcIn0nXG4gKiBgYGBcbiAqXG4gKiBAcGFyYW0gdmFsdWUgLSBUaGUgdmFsdWUgdG8gc3RyaW5naWZ5LlxuICogQHBhcmFtIHJlcGxhY2VyIC0gQSBmdW5jdGlvbiB0aGF0IHRyYW5zZm9ybXMgdGhlIHJlc3VsdHMuIEl0IGlzIHBhc3NlZCB0aGUga2V5IGFuZCB2YWx1ZSBvZiB0aGUgcHJvcGVydHksIGFuZCBtdXN0IHJldHVybiB0aGUgdmFsdWUgdG8gYmUgdXNlZCBpbiB0aGUgSlNPTiBzdHJpbmcuIElmIHRoaXMgZnVuY3Rpb24gcmV0dXJucyBgdW5kZWZpbmVkYCwgdGhlIHByb3BlcnR5IGlzIG5vdCBpbmNsdWRlZCBpbiB0aGUgcmVzdWx0aW5nIEpTT04gc3RyaW5nLlxuICogQHBhcmFtIHNwYWNlIC0gQSBzdHJpbmcgb3IgbnVtYmVyIHRoYXQgZGV0ZXJtaW5lcyB0aGUgaW5kZW50YXRpb24gb2YgdGhlIEpTT04gc3RyaW5nLiBJZiBpdCBpcyBhIG51bWJlciwgaXQgaW5kaWNhdGVzIHRoZSBudW1iZXIgb2Ygc3BhY2VzIHRvIHVzZSBhcyBpbmRlbnRhdGlvbjsgaWYgaXQgaXMgYSBzdHJpbmcgKGUuZy4gYCdcXHQnYCksIGl0IHVzZXMgdGhlIHN0cmluZyBhcyB0aGUgaW5kZW50YXRpb24gY2hhcmFjdGVyLlxuICogQHJldHVybnMgVGhlIEpTT04gc3RyaW5nLlxuICovXG5leHBvcnQgZnVuY3Rpb24gc3RyaW5naWZ5KHZhbHVlLCByZXBsYWNlciwgc3BhY2UpIHtcbiAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkodmFsdWUsIChrZXksIHZhbHVlKSA9PiB7XG4gICAgICAgIGlmICh0eXBlb2YgcmVwbGFjZXIgPT09ICdmdW5jdGlvbicpXG4gICAgICAgICAgICByZXR1cm4gcmVwbGFjZXIoa2V5LCB2YWx1ZSk7XG4gICAgICAgIGlmICh0eXBlb2YgdmFsdWUgPT09ICdiaWdpbnQnKVxuICAgICAgICAgICAgcmV0dXJuIHZhbHVlLnRvU3RyaW5nKCkgKyBiaWdJbnRTdWZmaXg7XG4gICAgICAgIHJldHVybiB2YWx1ZTtcbiAgICB9LCBzcGFjZSk7XG59XG4vLyMgc291cmNlTWFwcGluZ1VSTD1Kc29uLmpzLm1hcCIsCiAgICAiaW1wb3J0IHsgZXF1YWxCeXRlcyB9IGZyb20gJ0Bub2JsZS9jdXJ2ZXMvYWJzdHJhY3QvdXRpbHMnO1xuaW1wb3J0ICogYXMgRXJyb3JzIGZyb20gJy4vRXJyb3JzLmpzJztcbmltcG9ydCAqIGFzIEhleCBmcm9tICcuL0hleC5qcyc7XG5pbXBvcnQgKiBhcyBpbnRlcm5hbCBmcm9tICcuL2ludGVybmFsL2J5dGVzLmpzJztcbmltcG9ydCAqIGFzIGludGVybmFsX2hleCBmcm9tICcuL2ludGVybmFsL2hleC5qcyc7XG5pbXBvcnQgKiBhcyBKc29uIGZyb20gJy4vSnNvbi5qcyc7XG5jb25zdCBkZWNvZGVyID0gLyojX19QVVJFX18qLyBuZXcgVGV4dERlY29kZXIoKTtcbmNvbnN0IGVuY29kZXIgPSAvKiNfX1BVUkVfXyovIG5ldyBUZXh0RW5jb2RlcigpO1xuLyoqXG4gKiBBc3NlcnRzIGlmIHRoZSBnaXZlbiB2YWx1ZSBpcyB7QGxpbmsgb3gjQnl0ZXMuQnl0ZXN9LlxuICpcbiAqIEBleGFtcGxlXG4gKiBgYGB0cyB0d29zbGFzaFxuICogaW1wb3J0IHsgQnl0ZXMgfSBmcm9tICdveCdcbiAqXG4gKiBCeXRlcy5hc3NlcnQoJ2FiYycpXG4gKiAvLyBAZXJyb3I6IEJ5dGVzLkludmFsaWRCeXRlc1R5cGVFcnJvcjpcbiAqIC8vIEBlcnJvcjogVmFsdWUgYFwiYWJjXCJgIG9mIHR5cGUgYHN0cmluZ2AgaXMgYW4gaW52YWxpZCBCeXRlcyB2YWx1ZS5cbiAqIC8vIEBlcnJvcjogQnl0ZXMgdmFsdWVzIG11c3QgYmUgb2YgdHlwZSBgVWludDhBcnJheWAuXG4gKiBgYGBcbiAqXG4gKiBAcGFyYW0gdmFsdWUgLSBWYWx1ZSB0byBhc3NlcnQuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBhc3NlcnQodmFsdWUpIHtcbiAgICBpZiAodmFsdWUgaW5zdGFuY2VvZiBVaW50OEFycmF5KVxuICAgICAgICByZXR1cm47XG4gICAgaWYgKCF2YWx1ZSlcbiAgICAgICAgdGhyb3cgbmV3IEludmFsaWRCeXRlc1R5cGVFcnJvcih2YWx1ZSk7XG4gICAgaWYgKHR5cGVvZiB2YWx1ZSAhPT0gJ29iamVjdCcpXG4gICAgICAgIHRocm93IG5ldyBJbnZhbGlkQnl0ZXNUeXBlRXJyb3IodmFsdWUpO1xuICAgIGlmICghKCdCWVRFU19QRVJfRUxFTUVOVCcgaW4gdmFsdWUpKVxuICAgICAgICB0aHJvdyBuZXcgSW52YWxpZEJ5dGVzVHlwZUVycm9yKHZhbHVlKTtcbiAgICBpZiAodmFsdWUuQllURVNfUEVSX0VMRU1FTlQgIT09IDEgfHwgdmFsdWUuY29uc3RydWN0b3IubmFtZSAhPT0gJ1VpbnQ4QXJyYXknKVxuICAgICAgICB0aHJvdyBuZXcgSW52YWxpZEJ5dGVzVHlwZUVycm9yKHZhbHVlKTtcbn1cbi8qKlxuICogQ29uY2F0ZW5hdGVzIHR3byBvciBtb3JlIHtAbGluayBveCNCeXRlcy5CeXRlc30uXG4gKlxuICogQGV4YW1wbGVcbiAqIGBgYHRzIHR3b3NsYXNoXG4gKiBpbXBvcnQgeyBCeXRlcyB9IGZyb20gJ294J1xuICpcbiAqIGNvbnN0IGJ5dGVzID0gQnl0ZXMuY29uY2F0KFxuICogICBCeXRlcy5mcm9tKFsxXSksXG4gKiAgIEJ5dGVzLmZyb20oWzY5XSksXG4gKiAgIEJ5dGVzLmZyb20oWzQyMCwgNjldKSxcbiAqIClcbiAqIC8vIEBsb2c6IFVpbnQ4QXJyYXkgWyAxLCA2OSwgNDIwLCA2OSBdXG4gKiBgYGBcbiAqXG4gKiBAcGFyYW0gdmFsdWVzIC0gVmFsdWVzIHRvIGNvbmNhdGVuYXRlLlxuICogQHJldHVybnMgQ29uY2F0ZW5hdGVkIHtAbGluayBveCNCeXRlcy5CeXRlc30uXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjb25jYXQoLi4udmFsdWVzKSB7XG4gICAgbGV0IGxlbmd0aCA9IDA7XG4gICAgZm9yIChjb25zdCBhcnIgb2YgdmFsdWVzKSB7XG4gICAgICAgIGxlbmd0aCArPSBhcnIubGVuZ3RoO1xuICAgIH1cbiAgICBjb25zdCByZXN1bHQgPSBuZXcgVWludDhBcnJheShsZW5ndGgpO1xuICAgIGZvciAobGV0IGkgPSAwLCBpbmRleCA9IDA7IGkgPCB2YWx1ZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgY29uc3QgYXJyID0gdmFsdWVzW2ldO1xuICAgICAgICByZXN1bHQuc2V0KGFyciwgaW5kZXgpO1xuICAgICAgICBpbmRleCArPSBhcnIubGVuZ3RoO1xuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xufVxuLyoqXG4gKiBJbnN0YW50aWF0ZXMgYSB7QGxpbmsgb3gjQnl0ZXMuQnl0ZXN9IHZhbHVlIGZyb20gYSBgVWludDhBcnJheWAsIGEgaGV4IHN0cmluZywgb3IgYW4gYXJyYXkgb2YgdW5zaWduZWQgOC1iaXQgaW50ZWdlcnMuXG4gKlxuICogOjo6dGlwXG4gKlxuICogVG8gaW5zdGFudGlhdGUgZnJvbSBhICoqQm9vbGVhbioqLCAqKlN0cmluZyoqLCBvciAqKk51bWJlcioqLCB1c2Ugb25lIG9mIHRoZSBmb2xsb3dpbmc6XG4gKlxuICogLSBgQnl0ZXMuZnJvbUJvb2xlYW5gXG4gKlxuICogLSBgQnl0ZXMuZnJvbVN0cmluZ2BcbiAqXG4gKiAtIGBCeXRlcy5mcm9tTnVtYmVyYFxuICpcbiAqIDo6OlxuICpcbiAqIEBleGFtcGxlXG4gKiBgYGB0cyB0d29zbGFzaFxuICogLy8gQG5vRXJyb3JzXG4gKiBpbXBvcnQgeyBCeXRlcyB9IGZyb20gJ294J1xuICpcbiAqIGNvbnN0IGRhdGEgPSBCeXRlcy5mcm9tKFsyNTUsIDEyNCwgNSwgNF0pXG4gKiAvLyBAbG9nOiBVaW50OEFycmF5KFsyNTUsIDEyNCwgNSwgNF0pXG4gKlxuICogY29uc3QgZGF0YSA9IEJ5dGVzLmZyb20oJzB4ZGVhZGJlZWYnKVxuICogLy8gQGxvZzogVWludDhBcnJheShbMjIyLCAxNzMsIDE5MCwgMjM5XSlcbiAqIGBgYFxuICpcbiAqIEBwYXJhbSB2YWx1ZSAtIFZhbHVlIHRvIGNvbnZlcnQuXG4gKiBAcmV0dXJucyBBIHtAbGluayBveCNCeXRlcy5CeXRlc30gaW5zdGFuY2UuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBmcm9tKHZhbHVlKSB7XG4gICAgaWYgKHZhbHVlIGluc3RhbmNlb2YgVWludDhBcnJheSlcbiAgICAgICAgcmV0dXJuIHZhbHVlO1xuICAgIGlmICh0eXBlb2YgdmFsdWUgPT09ICdzdHJpbmcnKVxuICAgICAgICByZXR1cm4gZnJvbUhleCh2YWx1ZSk7XG4gICAgcmV0dXJuIGZyb21BcnJheSh2YWx1ZSk7XG59XG4vKipcbiAqIENvbnZlcnRzIGFuIGFycmF5IG9mIHVuc2lnbmVkIDgtYml0IGludGVnZXJzIGludG8ge0BsaW5rIG94I0J5dGVzLkJ5dGVzfS5cbiAqXG4gKiBAZXhhbXBsZVxuICogYGBgdHMgdHdvc2xhc2hcbiAqIGltcG9ydCB7IEJ5dGVzIH0gZnJvbSAnb3gnXG4gKlxuICogY29uc3QgZGF0YSA9IEJ5dGVzLmZyb21BcnJheShbMjU1LCAxMjQsIDUsIDRdKVxuICogLy8gQGxvZzogVWludDhBcnJheShbMjU1LCAxMjQsIDUsIDRdKVxuICogYGBgXG4gKlxuICogQHBhcmFtIHZhbHVlIC0gVmFsdWUgdG8gY29udmVydC5cbiAqIEByZXR1cm5zIEEge0BsaW5rIG94I0J5dGVzLkJ5dGVzfSBpbnN0YW5jZS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGZyb21BcnJheSh2YWx1ZSkge1xuICAgIHJldHVybiB2YWx1ZSBpbnN0YW5jZW9mIFVpbnQ4QXJyYXkgPyB2YWx1ZSA6IG5ldyBVaW50OEFycmF5KHZhbHVlKTtcbn1cbi8qKlxuICogRW5jb2RlcyBhIGJvb2xlYW4gdmFsdWUgaW50byB7QGxpbmsgb3gjQnl0ZXMuQnl0ZXN9LlxuICpcbiAqIEBleGFtcGxlXG4gKiBgYGB0cyB0d29zbGFzaFxuICogaW1wb3J0IHsgQnl0ZXMgfSBmcm9tICdveCdcbiAqXG4gKiBjb25zdCBkYXRhID0gQnl0ZXMuZnJvbUJvb2xlYW4odHJ1ZSlcbiAqIC8vIEBsb2c6IFVpbnQ4QXJyYXkoWzFdKVxuICogYGBgXG4gKlxuICogQGV4YW1wbGVcbiAqIGBgYHRzIHR3b3NsYXNoXG4gKiBpbXBvcnQgeyBCeXRlcyB9IGZyb20gJ294J1xuICpcbiAqIGNvbnN0IGRhdGEgPSBCeXRlcy5mcm9tQm9vbGVhbih0cnVlLCB7IHNpemU6IDMyIH0pXG4gKiAvLyBAbG9nOiBVaW50OEFycmF5KFswLCAwLCAwLCAwLCAwLCAwLCAwLCAwLCAwLCAwLCAwLCAwLCAwLCAwLCAwLCAwLCAwLCAwLCAwLCAwLCAwLCAwLCAwLCAwLCAwLCAwLCAxXSlcbiAqIGBgYFxuICpcbiAqIEBwYXJhbSB2YWx1ZSAtIEJvb2xlYW4gdmFsdWUgdG8gZW5jb2RlLlxuICogQHBhcmFtIG9wdGlvbnMgLSBFbmNvZGluZyBvcHRpb25zLlxuICogQHJldHVybnMgRW5jb2RlZCB7QGxpbmsgb3gjQnl0ZXMuQnl0ZXN9LlxuICovXG5leHBvcnQgZnVuY3Rpb24gZnJvbUJvb2xlYW4odmFsdWUsIG9wdGlvbnMgPSB7fSkge1xuICAgIGNvbnN0IHsgc2l6ZSB9ID0gb3B0aW9ucztcbiAgICBjb25zdCBieXRlcyA9IG5ldyBVaW50OEFycmF5KDEpO1xuICAgIGJ5dGVzWzBdID0gTnVtYmVyKHZhbHVlKTtcbiAgICBpZiAodHlwZW9mIHNpemUgPT09ICdudW1iZXInKSB7XG4gICAgICAgIGludGVybmFsLmFzc2VydFNpemUoYnl0ZXMsIHNpemUpO1xuICAgICAgICByZXR1cm4gcGFkTGVmdChieXRlcywgc2l6ZSk7XG4gICAgfVxuICAgIHJldHVybiBieXRlcztcbn1cbi8qKlxuICogRW5jb2RlcyBhIHtAbGluayBveCNIZXguSGV4fSB2YWx1ZSBpbnRvIHtAbGluayBveCNCeXRlcy5CeXRlc30uXG4gKlxuICogQGV4YW1wbGVcbiAqIGBgYHRzIHR3b3NsYXNoXG4gKiBpbXBvcnQgeyBCeXRlcyB9IGZyb20gJ294J1xuICpcbiAqIGNvbnN0IGRhdGEgPSBCeXRlcy5mcm9tSGV4KCcweDQ4NjU2YzZjNmYyMDc3NmY3MjZjNjQyMScpXG4gKiAvLyBAbG9nOiBVaW50OEFycmF5KFs3MiwgMTAxLCAxMDgsIDEwOCwgMTExLCAzMiwgODcsIDExMSwgMTE0LCAxMDgsIDEwMCwgMzNdKVxuICogYGBgXG4gKlxuICogQGV4YW1wbGVcbiAqIGBgYHRzIHR3b3NsYXNoXG4gKiBpbXBvcnQgeyBCeXRlcyB9IGZyb20gJ294J1xuICpcbiAqIGNvbnN0IGRhdGEgPSBCeXRlcy5mcm9tSGV4KCcweDQ4NjU2YzZjNmYyMDc3NmY3MjZjNjQyMScsIHsgc2l6ZTogMzIgfSlcbiAqIC8vIEBsb2c6IFVpbnQ4QXJyYXkoWzcyLCAxMDEsIDEwOCwgMTA4LCAxMTEsIDMyLCA4NywgMTExLCAxMTQsIDEwOCwgMTAwLCAzMywgMCwgMCwgMCwgMCwgMCwgMCwgMCwgMCwgMCwgMCwgMCwgMCwgMCwgMCwgMCwgMCwgMCwgMCwgMCwgMF0pXG4gKiBgYGBcbiAqXG4gKiBAcGFyYW0gdmFsdWUgLSB7QGxpbmsgb3gjSGV4LkhleH0gdmFsdWUgdG8gZW5jb2RlLlxuICogQHBhcmFtIG9wdGlvbnMgLSBFbmNvZGluZyBvcHRpb25zLlxuICogQHJldHVybnMgRW5jb2RlZCB7QGxpbmsgb3gjQnl0ZXMuQnl0ZXN9LlxuICovXG5leHBvcnQgZnVuY3Rpb24gZnJvbUhleCh2YWx1ZSwgb3B0aW9ucyA9IHt9KSB7XG4gICAgY29uc3QgeyBzaXplIH0gPSBvcHRpb25zO1xuICAgIGxldCBoZXggPSB2YWx1ZTtcbiAgICBpZiAoc2l6ZSkge1xuICAgICAgICBpbnRlcm5hbF9oZXguYXNzZXJ0U2l6ZSh2YWx1ZSwgc2l6ZSk7XG4gICAgICAgIGhleCA9IEhleC5wYWRSaWdodCh2YWx1ZSwgc2l6ZSk7XG4gICAgfVxuICAgIGxldCBoZXhTdHJpbmcgPSBoZXguc2xpY2UoMik7XG4gICAgaWYgKGhleFN0cmluZy5sZW5ndGggJSAyKVxuICAgICAgICBoZXhTdHJpbmcgPSBgMCR7aGV4U3RyaW5nfWA7XG4gICAgY29uc3QgbGVuZ3RoID0gaGV4U3RyaW5nLmxlbmd0aCAvIDI7XG4gICAgY29uc3QgYnl0ZXMgPSBuZXcgVWludDhBcnJheShsZW5ndGgpO1xuICAgIGZvciAobGV0IGluZGV4ID0gMCwgaiA9IDA7IGluZGV4IDwgbGVuZ3RoOyBpbmRleCsrKSB7XG4gICAgICAgIGNvbnN0IG5pYmJsZUxlZnQgPSBpbnRlcm5hbC5jaGFyQ29kZVRvQmFzZTE2KGhleFN0cmluZy5jaGFyQ29kZUF0KGorKykpO1xuICAgICAgICBjb25zdCBuaWJibGVSaWdodCA9IGludGVybmFsLmNoYXJDb2RlVG9CYXNlMTYoaGV4U3RyaW5nLmNoYXJDb2RlQXQoaisrKSk7XG4gICAgICAgIGlmIChuaWJibGVMZWZ0ID09PSB1bmRlZmluZWQgfHwgbmliYmxlUmlnaHQgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9ycy5CYXNlRXJyb3IoYEludmFsaWQgYnl0ZSBzZXF1ZW5jZSAoXCIke2hleFN0cmluZ1tqIC0gMl19JHtoZXhTdHJpbmdbaiAtIDFdfVwiIGluIFwiJHtoZXhTdHJpbmd9XCIpLmApO1xuICAgICAgICB9XG4gICAgICAgIGJ5dGVzW2luZGV4XSA9IChuaWJibGVMZWZ0IDw8IDQpIHwgbmliYmxlUmlnaHQ7XG4gICAgfVxuICAgIHJldHVybiBieXRlcztcbn1cbi8qKlxuICogRW5jb2RlcyBhIG51bWJlciB2YWx1ZSBpbnRvIHtAbGluayBveCNCeXRlcy5CeXRlc30uXG4gKlxuICogQGV4YW1wbGVcbiAqIGBgYHRzIHR3b3NsYXNoXG4gKiBpbXBvcnQgeyBCeXRlcyB9IGZyb20gJ294J1xuICpcbiAqIGNvbnN0IGRhdGEgPSBCeXRlcy5mcm9tTnVtYmVyKDQyMClcbiAqIC8vIEBsb2c6IFVpbnQ4QXJyYXkoWzEsIDE2NF0pXG4gKiBgYGBcbiAqXG4gKiBAZXhhbXBsZVxuICogYGBgdHMgdHdvc2xhc2hcbiAqIGltcG9ydCB7IEJ5dGVzIH0gZnJvbSAnb3gnXG4gKlxuICogY29uc3QgZGF0YSA9IEJ5dGVzLmZyb21OdW1iZXIoNDIwLCB7IHNpemU6IDQgfSlcbiAqIC8vIEBsb2c6IFVpbnQ4QXJyYXkoWzAsIDAsIDEsIDE2NF0pXG4gKiBgYGBcbiAqXG4gKiBAcGFyYW0gdmFsdWUgLSBOdW1iZXIgdmFsdWUgdG8gZW5jb2RlLlxuICogQHBhcmFtIG9wdGlvbnMgLSBFbmNvZGluZyBvcHRpb25zLlxuICogQHJldHVybnMgRW5jb2RlZCB7QGxpbmsgb3gjQnl0ZXMuQnl0ZXN9LlxuICovXG5leHBvcnQgZnVuY3Rpb24gZnJvbU51bWJlcih2YWx1ZSwgb3B0aW9ucykge1xuICAgIGNvbnN0IGhleCA9IEhleC5mcm9tTnVtYmVyKHZhbHVlLCBvcHRpb25zKTtcbiAgICByZXR1cm4gZnJvbUhleChoZXgpO1xufVxuLyoqXG4gKiBFbmNvZGVzIGEgc3RyaW5nIGludG8ge0BsaW5rIG94I0J5dGVzLkJ5dGVzfS5cbiAqXG4gKiBAZXhhbXBsZVxuICogYGBgdHMgdHdvc2xhc2hcbiAqIGltcG9ydCB7IEJ5dGVzIH0gZnJvbSAnb3gnXG4gKlxuICogY29uc3QgZGF0YSA9IEJ5dGVzLmZyb21TdHJpbmcoJ0hlbGxvIHdvcmxkIScpXG4gKiAvLyBAbG9nOiBVaW50OEFycmF5KFs3MiwgMTAxLCAxMDgsIDEwOCwgMTExLCAzMiwgMTE5LCAxMTEsIDExNCwgMTA4LCAxMDAsIDMzXSlcbiAqIGBgYFxuICpcbiAqIEBleGFtcGxlXG4gKiBgYGB0cyB0d29zbGFzaFxuICogaW1wb3J0IHsgQnl0ZXMgfSBmcm9tICdveCdcbiAqXG4gKiBjb25zdCBkYXRhID0gQnl0ZXMuZnJvbVN0cmluZygnSGVsbG8gd29ybGQhJywgeyBzaXplOiAzMiB9KVxuICogLy8gQGxvZzogVWludDhBcnJheShbNzIsIDEwMSwgMTA4LCAxMDgsIDExMSwgMzIsIDg3LCAxMTEsIDExNCwgMTA4LCAxMDAsIDMzLCAwLCAwLCAwLCAwLCAwLCAwLCAwLCAwLCAwLCAwLCAwLCAwLCAwLCAwLCAwLCAwLCAwLCAwLCAwLCAwXSlcbiAqIGBgYFxuICpcbiAqIEBwYXJhbSB2YWx1ZSAtIFN0cmluZyB0byBlbmNvZGUuXG4gKiBAcGFyYW0gb3B0aW9ucyAtIEVuY29kaW5nIG9wdGlvbnMuXG4gKiBAcmV0dXJucyBFbmNvZGVkIHtAbGluayBveCNCeXRlcy5CeXRlc30uXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBmcm9tU3RyaW5nKHZhbHVlLCBvcHRpb25zID0ge30pIHtcbiAgICBjb25zdCB7IHNpemUgfSA9IG9wdGlvbnM7XG4gICAgY29uc3QgYnl0ZXMgPSBlbmNvZGVyLmVuY29kZSh2YWx1ZSk7XG4gICAgaWYgKHR5cGVvZiBzaXplID09PSAnbnVtYmVyJykge1xuICAgICAgICBpbnRlcm5hbC5hc3NlcnRTaXplKGJ5dGVzLCBzaXplKTtcbiAgICAgICAgcmV0dXJuIHBhZFJpZ2h0KGJ5dGVzLCBzaXplKTtcbiAgICB9XG4gICAgcmV0dXJuIGJ5dGVzO1xufVxuLyoqXG4gKiBDaGVja3MgaWYgdHdvIHtAbGluayBveCNCeXRlcy5CeXRlc30gdmFsdWVzIGFyZSBlcXVhbC5cbiAqXG4gKiBAZXhhbXBsZVxuICogYGBgdHMgdHdvc2xhc2hcbiAqIGltcG9ydCB7IEJ5dGVzIH0gZnJvbSAnb3gnXG4gKlxuICogQnl0ZXMuaXNFcXVhbChCeXRlcy5mcm9tKFsxXSksIEJ5dGVzLmZyb20oWzFdKSlcbiAqIC8vIEBsb2c6IHRydWVcbiAqXG4gKiBCeXRlcy5pc0VxdWFsKEJ5dGVzLmZyb20oWzFdKSwgQnl0ZXMuZnJvbShbMl0pKVxuICogLy8gQGxvZzogZmFsc2VcbiAqIGBgYFxuICpcbiAqIEBwYXJhbSBieXRlc0EgLSBGaXJzdCB7QGxpbmsgb3gjQnl0ZXMuQnl0ZXN9IHZhbHVlLlxuICogQHBhcmFtIGJ5dGVzQiAtIFNlY29uZCB7QGxpbmsgb3gjQnl0ZXMuQnl0ZXN9IHZhbHVlLlxuICogQHJldHVybnMgYHRydWVgIGlmIHRoZSB0d28gdmFsdWVzIGFyZSBlcXVhbCwgb3RoZXJ3aXNlIGBmYWxzZWAuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBpc0VxdWFsKGJ5dGVzQSwgYnl0ZXNCKSB7XG4gICAgcmV0dXJuIGVxdWFsQnl0ZXMoYnl0ZXNBLCBieXRlc0IpO1xufVxuLyoqXG4gKiBQYWRzIGEge0BsaW5rIG94I0J5dGVzLkJ5dGVzfSB2YWx1ZSB0byB0aGUgbGVmdCB3aXRoIHplcm8gYnl0ZXMgdW50aWwgaXQgcmVhY2hlcyB0aGUgZ2l2ZW4gYHNpemVgIChkZWZhdWx0OiAzMiBieXRlcykuXG4gKlxuICogQGV4YW1wbGVcbiAqIGBgYHRzIHR3b3NsYXNoXG4gKiBpbXBvcnQgeyBCeXRlcyB9IGZyb20gJ294J1xuICpcbiAqIEJ5dGVzLnBhZExlZnQoQnl0ZXMuZnJvbShbMV0pLCA0KVxuICogLy8gQGxvZzogVWludDhBcnJheShbMCwgMCwgMCwgMV0pXG4gKiBgYGBcbiAqXG4gKiBAcGFyYW0gdmFsdWUgLSB7QGxpbmsgb3gjQnl0ZXMuQnl0ZXN9IHZhbHVlIHRvIHBhZC5cbiAqIEBwYXJhbSBzaXplIC0gU2l6ZSB0byBwYWQgdGhlIHtAbGluayBveCNCeXRlcy5CeXRlc30gdmFsdWUgdG8uXG4gKiBAcmV0dXJucyBQYWRkZWQge0BsaW5rIG94I0J5dGVzLkJ5dGVzfSB2YWx1ZS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHBhZExlZnQodmFsdWUsIHNpemUpIHtcbiAgICByZXR1cm4gaW50ZXJuYWwucGFkKHZhbHVlLCB7IGRpcjogJ2xlZnQnLCBzaXplIH0pO1xufVxuLyoqXG4gKiBQYWRzIGEge0BsaW5rIG94I0J5dGVzLkJ5dGVzfSB2YWx1ZSB0byB0aGUgcmlnaHQgd2l0aCB6ZXJvIGJ5dGVzIHVudGlsIGl0IHJlYWNoZXMgdGhlIGdpdmVuIGBzaXplYCAoZGVmYXVsdDogMzIgYnl0ZXMpLlxuICpcbiAqIEBleGFtcGxlXG4gKiBgYGB0cyB0d29zbGFzaFxuICogaW1wb3J0IHsgQnl0ZXMgfSBmcm9tICdveCdcbiAqXG4gKiBCeXRlcy5wYWRSaWdodChCeXRlcy5mcm9tKFsxXSksIDQpXG4gKiAvLyBAbG9nOiBVaW50OEFycmF5KFsxLCAwLCAwLCAwXSlcbiAqIGBgYFxuICpcbiAqIEBwYXJhbSB2YWx1ZSAtIHtAbGluayBveCNCeXRlcy5CeXRlc30gdmFsdWUgdG8gcGFkLlxuICogQHBhcmFtIHNpemUgLSBTaXplIHRvIHBhZCB0aGUge0BsaW5rIG94I0J5dGVzLkJ5dGVzfSB2YWx1ZSB0by5cbiAqIEByZXR1cm5zIFBhZGRlZCB7QGxpbmsgb3gjQnl0ZXMuQnl0ZXN9IHZhbHVlLlxuICovXG5leHBvcnQgZnVuY3Rpb24gcGFkUmlnaHQodmFsdWUsIHNpemUpIHtcbiAgICByZXR1cm4gaW50ZXJuYWwucGFkKHZhbHVlLCB7IGRpcjogJ3JpZ2h0Jywgc2l6ZSB9KTtcbn1cbi8qKlxuICogR2VuZXJhdGVzIHJhbmRvbSB7QGxpbmsgb3gjQnl0ZXMuQnl0ZXN9IG9mIHRoZSBzcGVjaWZpZWQgbGVuZ3RoLlxuICpcbiAqIEBleGFtcGxlXG4gKiBgYGB0cyB0d29zbGFzaFxuICogaW1wb3J0IHsgQnl0ZXMgfSBmcm9tICdveCdcbiAqXG4gKiBjb25zdCBieXRlcyA9IEJ5dGVzLnJhbmRvbSgzMilcbiAqIC8vIEBsb2c6IFVpbnQ4QXJyYXkoWy4uLiB4MzJdKVxuICogYGBgXG4gKlxuICogQHBhcmFtIGxlbmd0aCAtIExlbmd0aCBvZiB0aGUgcmFuZG9tIHtAbGluayBveCNCeXRlcy5CeXRlc30gdG8gZ2VuZXJhdGUuXG4gKiBAcmV0dXJucyBSYW5kb20ge0BsaW5rIG94I0J5dGVzLkJ5dGVzfSBvZiB0aGUgc3BlY2lmaWVkIGxlbmd0aC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHJhbmRvbShsZW5ndGgpIHtcbiAgICByZXR1cm4gY3J5cHRvLmdldFJhbmRvbVZhbHVlcyhuZXcgVWludDhBcnJheShsZW5ndGgpKTtcbn1cbi8qKlxuICogUmV0cmlldmVzIHRoZSBzaXplIG9mIGEge0BsaW5rIG94I0J5dGVzLkJ5dGVzfSB2YWx1ZS5cbiAqXG4gKiBAZXhhbXBsZVxuICogYGBgdHMgdHdvc2xhc2hcbiAqIGltcG9ydCB7IEJ5dGVzIH0gZnJvbSAnb3gnXG4gKlxuICogQnl0ZXMuc2l6ZShCeXRlcy5mcm9tKFsxLCAyLCAzLCA0XSkpXG4gKiAvLyBAbG9nOiA0XG4gKiBgYGBcbiAqXG4gKiBAcGFyYW0gdmFsdWUgLSB7QGxpbmsgb3gjQnl0ZXMuQnl0ZXN9IHZhbHVlLlxuICogQHJldHVybnMgU2l6ZSBvZiB0aGUge0BsaW5rIG94I0J5dGVzLkJ5dGVzfSB2YWx1ZS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHNpemUodmFsdWUpIHtcbiAgICByZXR1cm4gdmFsdWUubGVuZ3RoO1xufVxuLyoqXG4gKiBSZXR1cm5zIGEgc2VjdGlvbiBvZiBhIHtAbGluayBveCNCeXRlcy5CeXRlc30gdmFsdWUgZ2l2ZW4gYSBzdGFydC9lbmQgYnl0ZXMgb2Zmc2V0LlxuICpcbiAqIEBleGFtcGxlXG4gKiBgYGB0cyB0d29zbGFzaFxuICogaW1wb3J0IHsgQnl0ZXMgfSBmcm9tICdveCdcbiAqXG4gKiBCeXRlcy5zbGljZShcbiAqICAgQnl0ZXMuZnJvbShbMSwgMiwgMywgNCwgNSwgNiwgNywgOCwgOV0pLFxuICogICAxLFxuICogICA0LFxuICogKVxuICogLy8gQGxvZzogVWludDhBcnJheShbMiwgMywgNF0pXG4gKiBgYGBcbiAqXG4gKiBAcGFyYW0gdmFsdWUgLSBUaGUge0BsaW5rIG94I0J5dGVzLkJ5dGVzfSB2YWx1ZS5cbiAqIEBwYXJhbSBzdGFydCAtIFN0YXJ0IG9mZnNldC5cbiAqIEBwYXJhbSBlbmQgLSBFbmQgb2Zmc2V0LlxuICogQHBhcmFtIG9wdGlvbnMgLSBTbGljZSBvcHRpb25zLlxuICogQHJldHVybnMgU2xpY2VkIHtAbGluayBveCNCeXRlcy5CeXRlc30gdmFsdWUuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBzbGljZSh2YWx1ZSwgc3RhcnQsIGVuZCwgb3B0aW9ucyA9IHt9KSB7XG4gICAgY29uc3QgeyBzdHJpY3QgfSA9IG9wdGlvbnM7XG4gICAgaW50ZXJuYWwuYXNzZXJ0U3RhcnRPZmZzZXQodmFsdWUsIHN0YXJ0KTtcbiAgICBjb25zdCB2YWx1ZV8gPSB2YWx1ZS5zbGljZShzdGFydCwgZW5kKTtcbiAgICBpZiAoc3RyaWN0KVxuICAgICAgICBpbnRlcm5hbC5hc3NlcnRFbmRPZmZzZXQodmFsdWVfLCBzdGFydCwgZW5kKTtcbiAgICByZXR1cm4gdmFsdWVfO1xufVxuLyoqXG4gKiBEZWNvZGVzIGEge0BsaW5rIG94I0J5dGVzLkJ5dGVzfSBpbnRvIGEgYmlnaW50LlxuICpcbiAqIEBleGFtcGxlXG4gKiBgYGB0c1xuICogaW1wb3J0IHsgQnl0ZXMgfSBmcm9tICdveCdcbiAqXG4gKiBCeXRlcy50b0JpZ0ludChCeXRlcy5mcm9tKFsxLCAxNjRdKSlcbiAqIC8vIEBsb2c6IDQyMG5cbiAqIGBgYFxuICpcbiAqIEBwYXJhbSBieXRlcyAtIFRoZSB7QGxpbmsgb3gjQnl0ZXMuQnl0ZXN9IHRvIGRlY29kZS5cbiAqIEBwYXJhbSBvcHRpb25zIC0gRGVjb2Rpbmcgb3B0aW9ucy5cbiAqIEByZXR1cm5zIERlY29kZWQgYmlnaW50LlxuICovXG5leHBvcnQgZnVuY3Rpb24gdG9CaWdJbnQoYnl0ZXMsIG9wdGlvbnMgPSB7fSkge1xuICAgIGNvbnN0IHsgc2l6ZSB9ID0gb3B0aW9ucztcbiAgICBpZiAodHlwZW9mIHNpemUgIT09ICd1bmRlZmluZWQnKVxuICAgICAgICBpbnRlcm5hbC5hc3NlcnRTaXplKGJ5dGVzLCBzaXplKTtcbiAgICBjb25zdCBoZXggPSBIZXguZnJvbUJ5dGVzKGJ5dGVzLCBvcHRpb25zKTtcbiAgICByZXR1cm4gSGV4LnRvQmlnSW50KGhleCwgb3B0aW9ucyk7XG59XG4vKipcbiAqIERlY29kZXMgYSB7QGxpbmsgb3gjQnl0ZXMuQnl0ZXN9IGludG8gYSBib29sZWFuLlxuICpcbiAqIEBleGFtcGxlXG4gKiBgYGB0c1xuICogaW1wb3J0IHsgQnl0ZXMgfSBmcm9tICdveCdcbiAqXG4gKiBCeXRlcy50b0Jvb2xlYW4oQnl0ZXMuZnJvbShbMV0pKVxuICogLy8gQGxvZzogdHJ1ZVxuICogYGBgXG4gKlxuICogQHBhcmFtIGJ5dGVzIC0gVGhlIHtAbGluayBveCNCeXRlcy5CeXRlc30gdG8gZGVjb2RlLlxuICogQHBhcmFtIG9wdGlvbnMgLSBEZWNvZGluZyBvcHRpb25zLlxuICogQHJldHVybnMgRGVjb2RlZCBib29sZWFuLlxuICovXG5leHBvcnQgZnVuY3Rpb24gdG9Cb29sZWFuKGJ5dGVzLCBvcHRpb25zID0ge30pIHtcbiAgICBjb25zdCB7IHNpemUgfSA9IG9wdGlvbnM7XG4gICAgbGV0IGJ5dGVzXyA9IGJ5dGVzO1xuICAgIGlmICh0eXBlb2Ygc2l6ZSAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgaW50ZXJuYWwuYXNzZXJ0U2l6ZShieXRlc18sIHNpemUpO1xuICAgICAgICBieXRlc18gPSB0cmltTGVmdChieXRlc18pO1xuICAgIH1cbiAgICBpZiAoYnl0ZXNfLmxlbmd0aCA+IDEgfHwgYnl0ZXNfWzBdID4gMSlcbiAgICAgICAgdGhyb3cgbmV3IEludmFsaWRCeXRlc0Jvb2xlYW5FcnJvcihieXRlc18pO1xuICAgIHJldHVybiBCb29sZWFuKGJ5dGVzX1swXSk7XG59XG4vKipcbiAqIEVuY29kZXMgYSB7QGxpbmsgb3gjQnl0ZXMuQnl0ZXN9IHZhbHVlIGludG8gYSB7QGxpbmsgb3gjSGV4LkhleH0gdmFsdWUuXG4gKlxuICogQGV4YW1wbGVcbiAqIGBgYHRzIHR3b3NsYXNoXG4gKiBpbXBvcnQgeyBCeXRlcyB9IGZyb20gJ294J1xuICpcbiAqIEJ5dGVzLnRvSGV4KEJ5dGVzLmZyb20oWzcyLCAxMDEsIDEwOCwgMTA4LCAxMTEsIDMyLCA4NywgMTExLCAxMTQsIDEwOCwgMTAwLCAzM10pKVxuICogLy8gJzB4NDg2NTZjNmM2ZjIwNTc2ZjcyNmM2NDIxJ1xuICogYGBgXG4gKlxuICogQHBhcmFtIHZhbHVlIC0gVGhlIHtAbGluayBveCNCeXRlcy5CeXRlc30gdG8gZGVjb2RlLlxuICogQHBhcmFtIG9wdGlvbnMgLSBPcHRpb25zLlxuICogQHJldHVybnMgRGVjb2RlZCB7QGxpbmsgb3gjSGV4LkhleH0gdmFsdWUuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiB0b0hleCh2YWx1ZSwgb3B0aW9ucyA9IHt9KSB7XG4gICAgcmV0dXJuIEhleC5mcm9tQnl0ZXModmFsdWUsIG9wdGlvbnMpO1xufVxuLyoqXG4gKiBEZWNvZGVzIGEge0BsaW5rIG94I0J5dGVzLkJ5dGVzfSBpbnRvIGEgbnVtYmVyLlxuICpcbiAqIEBleGFtcGxlXG4gKiBgYGB0cyB0d29zbGFzaFxuICogaW1wb3J0IHsgQnl0ZXMgfSBmcm9tICdveCdcbiAqXG4gKiBCeXRlcy50b051bWJlcihCeXRlcy5mcm9tKFsxLCAxNjRdKSlcbiAqIC8vIEBsb2c6IDQyMFxuICogYGBgXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiB0b051bWJlcihieXRlcywgb3B0aW9ucyA9IHt9KSB7XG4gICAgY29uc3QgeyBzaXplIH0gPSBvcHRpb25zO1xuICAgIGlmICh0eXBlb2Ygc2l6ZSAhPT0gJ3VuZGVmaW5lZCcpXG4gICAgICAgIGludGVybmFsLmFzc2VydFNpemUoYnl0ZXMsIHNpemUpO1xuICAgIGNvbnN0IGhleCA9IEhleC5mcm9tQnl0ZXMoYnl0ZXMsIG9wdGlvbnMpO1xuICAgIHJldHVybiBIZXgudG9OdW1iZXIoaGV4LCBvcHRpb25zKTtcbn1cbi8qKlxuICogRGVjb2RlcyBhIHtAbGluayBveCNCeXRlcy5CeXRlc30gaW50byBhIHN0cmluZy5cbiAqXG4gKiBAZXhhbXBsZVxuICogYGBgdHMgdHdvc2xhc2hcbiAqIGltcG9ydCB7IEJ5dGVzIH0gZnJvbSAnb3gnXG4gKlxuICogY29uc3QgZGF0YSA9IEJ5dGVzLnRvU3RyaW5nKEJ5dGVzLmZyb20oWzcyLCAxMDEsIDEwOCwgMTA4LCAxMTEsIDMyLCA4NywgMTExLCAxMTQsIDEwOCwgMTAwLCAzM10pKVxuICogLy8gQGxvZzogJ0hlbGxvIHdvcmxkJ1xuICogYGBgXG4gKlxuICogQHBhcmFtIGJ5dGVzIC0gVGhlIHtAbGluayBveCNCeXRlcy5CeXRlc30gdG8gZGVjb2RlLlxuICogQHBhcmFtIG9wdGlvbnMgLSBPcHRpb25zLlxuICogQHJldHVybnMgRGVjb2RlZCBzdHJpbmcuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiB0b1N0cmluZyhieXRlcywgb3B0aW9ucyA9IHt9KSB7XG4gICAgY29uc3QgeyBzaXplIH0gPSBvcHRpb25zO1xuICAgIGxldCBieXRlc18gPSBieXRlcztcbiAgICBpZiAodHlwZW9mIHNpemUgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgIGludGVybmFsLmFzc2VydFNpemUoYnl0ZXNfLCBzaXplKTtcbiAgICAgICAgYnl0ZXNfID0gdHJpbVJpZ2h0KGJ5dGVzXyk7XG4gICAgfVxuICAgIHJldHVybiBkZWNvZGVyLmRlY29kZShieXRlc18pO1xufVxuLyoqXG4gKiBUcmltcyBsZWFkaW5nIHplcm9zIGZyb20gYSB7QGxpbmsgb3gjQnl0ZXMuQnl0ZXN9IHZhbHVlLlxuICpcbiAqIEBleGFtcGxlXG4gKiBgYGB0cyB0d29zbGFzaFxuICogaW1wb3J0IHsgQnl0ZXMgfSBmcm9tICdveCdcbiAqXG4gKiBCeXRlcy50cmltTGVmdChCeXRlcy5mcm9tKFswLCAwLCAwLCAwLCAxLCAyLCAzXSkpXG4gKiAvLyBAbG9nOiBVaW50OEFycmF5KFsxLCAyLCAzXSlcbiAqIGBgYFxuICpcbiAqIEBwYXJhbSB2YWx1ZSAtIHtAbGluayBveCNCeXRlcy5CeXRlc30gdmFsdWUuXG4gKiBAcmV0dXJucyBUcmltbWVkIHtAbGluayBveCNCeXRlcy5CeXRlc30gdmFsdWUuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiB0cmltTGVmdCh2YWx1ZSkge1xuICAgIHJldHVybiBpbnRlcm5hbC50cmltKHZhbHVlLCB7IGRpcjogJ2xlZnQnIH0pO1xufVxuLyoqXG4gKiBUcmltcyB0cmFpbGluZyB6ZXJvcyBmcm9tIGEge0BsaW5rIG94I0J5dGVzLkJ5dGVzfSB2YWx1ZS5cbiAqXG4gKiBAZXhhbXBsZVxuICogYGBgdHMgdHdvc2xhc2hcbiAqIGltcG9ydCB7IEJ5dGVzIH0gZnJvbSAnb3gnXG4gKlxuICogQnl0ZXMudHJpbVJpZ2h0KEJ5dGVzLmZyb20oWzEsIDIsIDMsIDAsIDAsIDAsIDBdKSlcbiAqIC8vIEBsb2c6IFVpbnQ4QXJyYXkoWzEsIDIsIDNdKVxuICogYGBgXG4gKlxuICogQHBhcmFtIHZhbHVlIC0ge0BsaW5rIG94I0J5dGVzLkJ5dGVzfSB2YWx1ZS5cbiAqIEByZXR1cm5zIFRyaW1tZWQge0BsaW5rIG94I0J5dGVzLkJ5dGVzfSB2YWx1ZS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHRyaW1SaWdodCh2YWx1ZSkge1xuICAgIHJldHVybiBpbnRlcm5hbC50cmltKHZhbHVlLCB7IGRpcjogJ3JpZ2h0JyB9KTtcbn1cbi8qKlxuICogQ2hlY2tzIGlmIHRoZSBnaXZlbiB2YWx1ZSBpcyB7QGxpbmsgb3gjQnl0ZXMuQnl0ZXN9LlxuICpcbiAqIEBleGFtcGxlXG4gKiBgYGB0cyB0d29zbGFzaFxuICogaW1wb3J0IHsgQnl0ZXMgfSBmcm9tICdveCdcbiAqXG4gKiBCeXRlcy52YWxpZGF0ZSgnMHgnKVxuICogLy8gQGxvZzogZmFsc2VcbiAqXG4gKiBCeXRlcy52YWxpZGF0ZShCeXRlcy5mcm9tKFsxLCAyLCAzXSkpXG4gKiAvLyBAbG9nOiB0cnVlXG4gKiBgYGBcbiAqXG4gKiBAcGFyYW0gdmFsdWUgLSBWYWx1ZSB0byBjaGVjay5cbiAqIEByZXR1cm5zIGB0cnVlYCBpZiB0aGUgdmFsdWUgaXMge0BsaW5rIG94I0J5dGVzLkJ5dGVzfSwgb3RoZXJ3aXNlIGBmYWxzZWAuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiB2YWxpZGF0ZSh2YWx1ZSkge1xuICAgIHRyeSB7XG4gICAgICAgIGFzc2VydCh2YWx1ZSk7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgICBjYXRjaCB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG59XG4vKipcbiAqIFRocm93biB3aGVuIHRoZSBieXRlcyB2YWx1ZSBjYW5ub3QgYmUgcmVwcmVzZW50ZWQgYXMgYSBib29sZWFuLlxuICpcbiAqIEBleGFtcGxlXG4gKiBgYGB0cyB0d29zbGFzaFxuICogaW1wb3J0IHsgQnl0ZXMgfSBmcm9tICdveCdcbiAqXG4gKiBCeXRlcy50b0Jvb2xlYW4oQnl0ZXMuZnJvbShbNV0pKVxuICogLy8gQGVycm9yOiBCeXRlcy5JbnZhbGlkQnl0ZXNCb29sZWFuRXJyb3I6IEJ5dGVzIHZhbHVlIGBbNV1gIGlzIG5vdCBhIHZhbGlkIGJvb2xlYW4uXG4gKiAvLyBAZXJyb3I6IFRoZSBieXRlcyBhcnJheSBtdXN0IGNvbnRhaW4gYSBzaW5nbGUgYnl0ZSBvZiBlaXRoZXIgYSBgMGAgb3IgYDFgIHZhbHVlLlxuICogYGBgXG4gKi9cbmV4cG9ydCBjbGFzcyBJbnZhbGlkQnl0ZXNCb29sZWFuRXJyb3IgZXh0ZW5kcyBFcnJvcnMuQmFzZUVycm9yIHtcbiAgICBjb25zdHJ1Y3RvcihieXRlcykge1xuICAgICAgICBzdXBlcihgQnl0ZXMgdmFsdWUgXFxgJHtieXRlc31cXGAgaXMgbm90IGEgdmFsaWQgYm9vbGVhbi5gLCB7XG4gICAgICAgICAgICBtZXRhTWVzc2FnZXM6IFtcbiAgICAgICAgICAgICAgICAnVGhlIGJ5dGVzIGFycmF5IG11c3QgY29udGFpbiBhIHNpbmdsZSBieXRlIG9mIGVpdGhlciBhIGAwYCBvciBgMWAgdmFsdWUuJyxcbiAgICAgICAgICAgIF0sXG4gICAgICAgIH0pO1xuICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkodGhpcywgXCJuYW1lXCIsIHtcbiAgICAgICAgICAgIGVudW1lcmFibGU6IHRydWUsXG4gICAgICAgICAgICBjb25maWd1cmFibGU6IHRydWUsXG4gICAgICAgICAgICB3cml0YWJsZTogdHJ1ZSxcbiAgICAgICAgICAgIHZhbHVlOiAnQnl0ZXMuSW52YWxpZEJ5dGVzQm9vbGVhbkVycm9yJ1xuICAgICAgICB9KTtcbiAgICB9XG59XG4vKipcbiAqIFRocm93biB3aGVuIGEgdmFsdWUgY2Fubm90IGJlIGNvbnZlcnRlZCB0byBieXRlcy5cbiAqXG4gKiBAZXhhbXBsZVxuICogYGBgdHMgdHdvc2xhc2hcbiAqIC8vIEBub0Vycm9yc1xuICogaW1wb3J0IHsgQnl0ZXMgfSBmcm9tICdveCdcbiAqXG4gKiBCeXRlcy5mcm9tKCdmb28nKVxuICogLy8gQGVycm9yOiBCeXRlcy5JbnZhbGlkQnl0ZXNUeXBlRXJyb3I6IFZhbHVlIGBmb29gIG9mIHR5cGUgYHN0cmluZ2AgaXMgYW4gaW52YWxpZCBCeXRlcyB2YWx1ZS5cbiAqIGBgYFxuICovXG5leHBvcnQgY2xhc3MgSW52YWxpZEJ5dGVzVHlwZUVycm9yIGV4dGVuZHMgRXJyb3JzLkJhc2VFcnJvciB7XG4gICAgY29uc3RydWN0b3IodmFsdWUpIHtcbiAgICAgICAgc3VwZXIoYFZhbHVlIFxcYCR7dHlwZW9mIHZhbHVlID09PSAnb2JqZWN0JyA/IEpzb24uc3RyaW5naWZ5KHZhbHVlKSA6IHZhbHVlfVxcYCBvZiB0eXBlIFxcYCR7dHlwZW9mIHZhbHVlfVxcYCBpcyBhbiBpbnZhbGlkIEJ5dGVzIHZhbHVlLmAsIHtcbiAgICAgICAgICAgIG1ldGFNZXNzYWdlczogWydCeXRlcyB2YWx1ZXMgbXVzdCBiZSBvZiB0eXBlIGBCeXRlc2AuJ10sXG4gICAgICAgIH0pO1xuICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkodGhpcywgXCJuYW1lXCIsIHtcbiAgICAgICAgICAgIGVudW1lcmFibGU6IHRydWUsXG4gICAgICAgICAgICBjb25maWd1cmFibGU6IHRydWUsXG4gICAgICAgICAgICB3cml0YWJsZTogdHJ1ZSxcbiAgICAgICAgICAgIHZhbHVlOiAnQnl0ZXMuSW52YWxpZEJ5dGVzVHlwZUVycm9yJ1xuICAgICAgICB9KTtcbiAgICB9XG59XG4vKipcbiAqIFRocm93biB3aGVuIGEgc2l6ZSBleGNlZWRzIHRoZSBtYXhpbXVtIGFsbG93ZWQgc2l6ZS5cbiAqXG4gKiBAZXhhbXBsZVxuICogYGBgdHMgdHdvc2xhc2hcbiAqIGltcG9ydCB7IEJ5dGVzIH0gZnJvbSAnb3gnXG4gKlxuICogQnl0ZXMuZnJvbVN0cmluZygnSGVsbG8gV29ybGQhJywgeyBzaXplOiA4IH0pXG4gKiAvLyBAZXJyb3I6IEJ5dGVzLlNpemVPdmVyZmxvd0Vycm9yOiBTaXplIGNhbm5vdCBleGNlZWQgYDhgIGJ5dGVzLiBHaXZlbiBzaXplOiBgMTJgIGJ5dGVzLlxuICogYGBgXG4gKi9cbmV4cG9ydCBjbGFzcyBTaXplT3ZlcmZsb3dFcnJvciBleHRlbmRzIEVycm9ycy5CYXNlRXJyb3Ige1xuICAgIGNvbnN0cnVjdG9yKHsgZ2l2ZW5TaXplLCBtYXhTaXplIH0pIHtcbiAgICAgICAgc3VwZXIoYFNpemUgY2Fubm90IGV4Y2VlZCBcXGAke21heFNpemV9XFxgIGJ5dGVzLiBHaXZlbiBzaXplOiBcXGAke2dpdmVuU2l6ZX1cXGAgYnl0ZXMuYCk7XG4gICAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0aGlzLCBcIm5hbWVcIiwge1xuICAgICAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICAgICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgICAgICAgICAgIHdyaXRhYmxlOiB0cnVlLFxuICAgICAgICAgICAgdmFsdWU6ICdCeXRlcy5TaXplT3ZlcmZsb3dFcnJvcidcbiAgICAgICAgfSk7XG4gICAgfVxufVxuLyoqXG4gKiBUaHJvd24gd2hlbiBhIHNsaWNlIG9mZnNldCBpcyBvdXQtb2YtYm91bmRzLlxuICpcbiAqIEBleGFtcGxlXG4gKiBgYGB0cyB0d29zbGFzaFxuICogaW1wb3J0IHsgQnl0ZXMgfSBmcm9tICdveCdcbiAqXG4gKiBCeXRlcy5zbGljZShCeXRlcy5mcm9tKFsxLCAyLCAzXSksIDQpXG4gKiAvLyBAZXJyb3I6IEJ5dGVzLlNsaWNlT2Zmc2V0T3V0T2ZCb3VuZHNFcnJvcjogU2xpY2Ugc3RhcnRpbmcgYXQgb2Zmc2V0IGA0YCBpcyBvdXQtb2YtYm91bmRzIChzaXplOiBgM2ApLlxuICogYGBgXG4gKi9cbmV4cG9ydCBjbGFzcyBTbGljZU9mZnNldE91dE9mQm91bmRzRXJyb3IgZXh0ZW5kcyBFcnJvcnMuQmFzZUVycm9yIHtcbiAgICBjb25zdHJ1Y3Rvcih7IG9mZnNldCwgcG9zaXRpb24sIHNpemUsIH0pIHtcbiAgICAgICAgc3VwZXIoYFNsaWNlICR7cG9zaXRpb24gPT09ICdzdGFydCcgPyAnc3RhcnRpbmcnIDogJ2VuZGluZyd9IGF0IG9mZnNldCBcXGAke29mZnNldH1cXGAgaXMgb3V0LW9mLWJvdW5kcyAoc2l6ZTogXFxgJHtzaXplfVxcYCkuYCk7XG4gICAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0aGlzLCBcIm5hbWVcIiwge1xuICAgICAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICAgICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgICAgICAgICAgIHdyaXRhYmxlOiB0cnVlLFxuICAgICAgICAgICAgdmFsdWU6ICdCeXRlcy5TbGljZU9mZnNldE91dE9mQm91bmRzRXJyb3InXG4gICAgICAgIH0pO1xuICAgIH1cbn1cbi8qKlxuICogVGhyb3duIHdoZW4gYSB0aGUgcGFkZGluZyBzaXplIGV4Y2VlZHMgdGhlIG1heGltdW0gYWxsb3dlZCBzaXplLlxuICpcbiAqIEBleGFtcGxlXG4gKiBgYGB0cyB0d29zbGFzaFxuICogaW1wb3J0IHsgQnl0ZXMgfSBmcm9tICdveCdcbiAqXG4gKiBCeXRlcy5wYWRMZWZ0KEJ5dGVzLmZyb21TdHJpbmcoJ0hlbGxvIFdvcmxkIScpLCA4KVxuICogLy8gQGVycm9yOiBbQnl0ZXMuU2l6ZUV4Y2VlZHNQYWRkaW5nU2l6ZUVycm9yOiBCeXRlcyBzaXplIChgMTJgKSBleGNlZWRzIHBhZGRpbmcgc2l6ZSAoYDhgKS5cbiAqIGBgYFxuICovXG5leHBvcnQgY2xhc3MgU2l6ZUV4Y2VlZHNQYWRkaW5nU2l6ZUVycm9yIGV4dGVuZHMgRXJyb3JzLkJhc2VFcnJvciB7XG4gICAgY29uc3RydWN0b3IoeyBzaXplLCB0YXJnZXRTaXplLCB0eXBlLCB9KSB7XG4gICAgICAgIHN1cGVyKGAke3R5cGUuY2hhckF0KDApLnRvVXBwZXJDYXNlKCl9JHt0eXBlXG4gICAgICAgICAgICAuc2xpY2UoMSlcbiAgICAgICAgICAgIC50b0xvd2VyQ2FzZSgpfSBzaXplIChcXGAke3NpemV9XFxgKSBleGNlZWRzIHBhZGRpbmcgc2l6ZSAoXFxgJHt0YXJnZXRTaXplfVxcYCkuYCk7XG4gICAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0aGlzLCBcIm5hbWVcIiwge1xuICAgICAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICAgICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgICAgICAgICAgIHdyaXRhYmxlOiB0cnVlLFxuICAgICAgICAgICAgdmFsdWU6ICdCeXRlcy5TaXplRXhjZWVkc1BhZGRpbmdTaXplRXJyb3InXG4gICAgICAgIH0pO1xuICAgIH1cbn1cbi8vIyBzb3VyY2VNYXBwaW5nVVJMPUJ5dGVzLmpzLm1hcCIsCiAgICAiaW1wb3J0IHsgZXF1YWxCeXRlcyB9IGZyb20gJ0Bub2JsZS9jdXJ2ZXMvYWJzdHJhY3QvdXRpbHMnO1xuaW1wb3J0ICogYXMgQnl0ZXMgZnJvbSAnLi9CeXRlcy5qcyc7XG5pbXBvcnQgKiBhcyBFcnJvcnMgZnJvbSAnLi9FcnJvcnMuanMnO1xuaW1wb3J0ICogYXMgaW50ZXJuYWxfYnl0ZXMgZnJvbSAnLi9pbnRlcm5hbC9ieXRlcy5qcyc7XG5pbXBvcnQgKiBhcyBpbnRlcm5hbCBmcm9tICcuL2ludGVybmFsL2hleC5qcyc7XG5pbXBvcnQgKiBhcyBKc29uIGZyb20gJy4vSnNvbi5qcyc7XG5jb25zdCBlbmNvZGVyID0gLyojX19QVVJFX18qLyBuZXcgVGV4dEVuY29kZXIoKTtcbmNvbnN0IGhleGVzID0gLyojX19QVVJFX18qLyBBcnJheS5mcm9tKHsgbGVuZ3RoOiAyNTYgfSwgKF92LCBpKSA9PiBpLnRvU3RyaW5nKDE2KS5wYWRTdGFydCgyLCAnMCcpKTtcbi8qKlxuICogQXNzZXJ0cyBpZiB0aGUgZ2l2ZW4gdmFsdWUgaXMge0BsaW5rIG94I0hleC5IZXh9LlxuICpcbiAqIEBleGFtcGxlXG4gKiBgYGB0cyB0d29zbGFzaFxuICogaW1wb3J0IHsgSGV4IH0gZnJvbSAnb3gnXG4gKlxuICogSGV4LmFzc2VydCgnYWJjJylcbiAqIC8vIEBlcnJvcjogSW52YWxpZEhleFZhbHVlVHlwZUVycm9yOlxuICogLy8gQGVycm9yOiBWYWx1ZSBgXCJhYmNcImAgb2YgdHlwZSBgc3RyaW5nYCBpcyBhbiBpbnZhbGlkIGhleCB0eXBlLlxuICogLy8gQGVycm9yOiBIZXggdHlwZXMgbXVzdCBiZSByZXByZXNlbnRlZCBhcyBgXCIweFxcJHtzdHJpbmd9XCJgLlxuICogYGBgXG4gKlxuICogQHBhcmFtIHZhbHVlIC0gVGhlIHZhbHVlIHRvIGFzc2VydC5cbiAqIEBwYXJhbSBvcHRpb25zIC0gT3B0aW9ucy5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGFzc2VydCh2YWx1ZSwgb3B0aW9ucyA9IHt9KSB7XG4gICAgY29uc3QgeyBzdHJpY3QgPSBmYWxzZSB9ID0gb3B0aW9ucztcbiAgICBpZiAoIXZhbHVlKVxuICAgICAgICB0aHJvdyBuZXcgSW52YWxpZEhleFR5cGVFcnJvcih2YWx1ZSk7XG4gICAgaWYgKHR5cGVvZiB2YWx1ZSAhPT0gJ3N0cmluZycpXG4gICAgICAgIHRocm93IG5ldyBJbnZhbGlkSGV4VHlwZUVycm9yKHZhbHVlKTtcbiAgICBpZiAoc3RyaWN0KSB7XG4gICAgICAgIGlmICghL14weFswLTlhLWZBLUZdKiQvLnRlc3QodmFsdWUpKVxuICAgICAgICAgICAgdGhyb3cgbmV3IEludmFsaWRIZXhWYWx1ZUVycm9yKHZhbHVlKTtcbiAgICB9XG4gICAgaWYgKCF2YWx1ZS5zdGFydHNXaXRoKCcweCcpKVxuICAgICAgICB0aHJvdyBuZXcgSW52YWxpZEhleFZhbHVlRXJyb3IodmFsdWUpO1xufVxuLyoqXG4gKiBDb25jYXRlbmF0ZXMgdHdvIG9yIG1vcmUge0BsaW5rIG94I0hleC5IZXh9LlxuICpcbiAqIEBleGFtcGxlXG4gKiBgYGB0cyB0d29zbGFzaFxuICogaW1wb3J0IHsgSGV4IH0gZnJvbSAnb3gnXG4gKlxuICogSGV4LmNvbmNhdCgnMHgxMjMnLCAnMHg0NTYnKVxuICogLy8gQGxvZzogJzB4MTIzNDU2J1xuICogYGBgXG4gKlxuICogQHBhcmFtIHZhbHVlcyAtIFRoZSB7QGxpbmsgb3gjSGV4LkhleH0gdmFsdWVzIHRvIGNvbmNhdGVuYXRlLlxuICogQHJldHVybnMgVGhlIGNvbmNhdGVuYXRlZCB7QGxpbmsgb3gjSGV4LkhleH0gdmFsdWUuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjb25jYXQoLi4udmFsdWVzKSB7XG4gICAgcmV0dXJuIGAweCR7dmFsdWVzLnJlZHVjZSgoYWNjLCB4KSA9PiBhY2MgKyB4LnJlcGxhY2UoJzB4JywgJycpLCAnJyl9YDtcbn1cbi8qKlxuICogSW5zdGFudGlhdGVzIGEge0BsaW5rIG94I0hleC5IZXh9IHZhbHVlIGZyb20gYSBoZXggc3RyaW5nIG9yIHtAbGluayBveCNCeXRlcy5CeXRlc30gdmFsdWUuXG4gKlxuICogOjo6dGlwXG4gKlxuICogVG8gaW5zdGFudGlhdGUgZnJvbSBhICoqQm9vbGVhbioqLCAqKlN0cmluZyoqLCBvciAqKk51bWJlcioqLCB1c2Ugb25lIG9mIHRoZSBmb2xsb3dpbmc6XG4gKlxuICogLSBgSGV4LmZyb21Cb29sZWFuYFxuICpcbiAqIC0gYEhleC5mcm9tU3RyaW5nYFxuICpcbiAqIC0gYEhleC5mcm9tTnVtYmVyYFxuICpcbiAqIDo6OlxuICpcbiAqIEBleGFtcGxlXG4gKiBgYGB0cyB0d29zbGFzaFxuICogaW1wb3J0IHsgQnl0ZXMsIEhleCB9IGZyb20gJ294J1xuICpcbiAqIEhleC5mcm9tKCcweDQ4NjU2YzZjNmYyMDU3NmY3MjZjNjQyMScpXG4gKiAvLyBAbG9nOiAnMHg0ODY1NmM2YzZmMjA1NzZmNzI2YzY0MjEnXG4gKlxuICogSGV4LmZyb20oQnl0ZXMuZnJvbShbNzIsIDEwMSwgMTA4LCAxMDgsIDExMSwgMzIsIDg3LCAxMTEsIDExNCwgMTA4LCAxMDAsIDMzXSkpXG4gKiAvLyBAbG9nOiAnMHg0ODY1NmM2YzZmMjA1NzZmNzI2YzY0MjEnXG4gKiBgYGBcbiAqXG4gKiBAcGFyYW0gdmFsdWUgLSBUaGUge0BsaW5rIG94I0J5dGVzLkJ5dGVzfSB2YWx1ZSB0byBlbmNvZGUuXG4gKiBAcmV0dXJucyBUaGUgZW5jb2RlZCB7QGxpbmsgb3gjSGV4LkhleH0gdmFsdWUuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBmcm9tKHZhbHVlKSB7XG4gICAgaWYgKHZhbHVlIGluc3RhbmNlb2YgVWludDhBcnJheSlcbiAgICAgICAgcmV0dXJuIGZyb21CeXRlcyh2YWx1ZSk7XG4gICAgaWYgKEFycmF5LmlzQXJyYXkodmFsdWUpKVxuICAgICAgICByZXR1cm4gZnJvbUJ5dGVzKG5ldyBVaW50OEFycmF5KHZhbHVlKSk7XG4gICAgcmV0dXJuIHZhbHVlO1xufVxuLyoqXG4gKiBFbmNvZGVzIGEgYm9vbGVhbiBpbnRvIGEge0BsaW5rIG94I0hleC5IZXh9IHZhbHVlLlxuICpcbiAqIEBleGFtcGxlXG4gKiBgYGB0cyB0d29zbGFzaFxuICogaW1wb3J0IHsgSGV4IH0gZnJvbSAnb3gnXG4gKlxuICogSGV4LmZyb21Cb29sZWFuKHRydWUpXG4gKiAvLyBAbG9nOiAnMHgxJ1xuICpcbiAqIEhleC5mcm9tQm9vbGVhbihmYWxzZSlcbiAqIC8vIEBsb2c6ICcweDAnXG4gKlxuICogSGV4LmZyb21Cb29sZWFuKHRydWUsIHsgc2l6ZTogMzIgfSlcbiAqIC8vIEBsb2c6ICcweDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDEnXG4gKiBgYGBcbiAqXG4gKiBAcGFyYW0gdmFsdWUgLSBUaGUgYm9vbGVhbiB2YWx1ZSB0byBlbmNvZGUuXG4gKiBAcGFyYW0gb3B0aW9ucyAtIE9wdGlvbnMuXG4gKiBAcmV0dXJucyBUaGUgZW5jb2RlZCB7QGxpbmsgb3gjSGV4LkhleH0gdmFsdWUuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBmcm9tQm9vbGVhbih2YWx1ZSwgb3B0aW9ucyA9IHt9KSB7XG4gICAgY29uc3QgaGV4ID0gYDB4JHtOdW1iZXIodmFsdWUpfWA7XG4gICAgaWYgKHR5cGVvZiBvcHRpb25zLnNpemUgPT09ICdudW1iZXInKSB7XG4gICAgICAgIGludGVybmFsLmFzc2VydFNpemUoaGV4LCBvcHRpb25zLnNpemUpO1xuICAgICAgICByZXR1cm4gcGFkTGVmdChoZXgsIG9wdGlvbnMuc2l6ZSk7XG4gICAgfVxuICAgIHJldHVybiBoZXg7XG59XG4vKipcbiAqIEVuY29kZXMgYSB7QGxpbmsgb3gjQnl0ZXMuQnl0ZXN9IHZhbHVlIGludG8gYSB7QGxpbmsgb3gjSGV4LkhleH0gdmFsdWUuXG4gKlxuICogQGV4YW1wbGVcbiAqIGBgYHRzIHR3b3NsYXNoXG4gKiBpbXBvcnQgeyBCeXRlcywgSGV4IH0gZnJvbSAnb3gnXG4gKlxuICogSGV4LmZyb21CeXRlcyhCeXRlcy5mcm9tKFs3MiwgMTAxLCAxMDgsIDEwOCwgMTExLCAzMiwgODcsIDExMSwgMTE0LCAxMDgsIDEwMCwgMzNdKSlcbiAqIC8vIEBsb2c6ICcweDQ4NjU2YzZjNmYyMDU3NmY3MjZjNjQyMSdcbiAqIGBgYFxuICpcbiAqIEBwYXJhbSB2YWx1ZSAtIFRoZSB7QGxpbmsgb3gjQnl0ZXMuQnl0ZXN9IHZhbHVlIHRvIGVuY29kZS5cbiAqIEBwYXJhbSBvcHRpb25zIC0gT3B0aW9ucy5cbiAqIEByZXR1cm5zIFRoZSBlbmNvZGVkIHtAbGluayBveCNIZXguSGV4fSB2YWx1ZS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGZyb21CeXRlcyh2YWx1ZSwgb3B0aW9ucyA9IHt9KSB7XG4gICAgbGV0IHN0cmluZyA9ICcnO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdmFsdWUubGVuZ3RoOyBpKyspXG4gICAgICAgIHN0cmluZyArPSBoZXhlc1t2YWx1ZVtpXV07XG4gICAgY29uc3QgaGV4ID0gYDB4JHtzdHJpbmd9YDtcbiAgICBpZiAodHlwZW9mIG9wdGlvbnMuc2l6ZSA9PT0gJ251bWJlcicpIHtcbiAgICAgICAgaW50ZXJuYWwuYXNzZXJ0U2l6ZShoZXgsIG9wdGlvbnMuc2l6ZSk7XG4gICAgICAgIHJldHVybiBwYWRSaWdodChoZXgsIG9wdGlvbnMuc2l6ZSk7XG4gICAgfVxuICAgIHJldHVybiBoZXg7XG59XG4vKipcbiAqIEVuY29kZXMgYSBudW1iZXIgb3IgYmlnaW50IGludG8gYSB7QGxpbmsgb3gjSGV4LkhleH0gdmFsdWUuXG4gKlxuICogQGV4YW1wbGVcbiAqIGBgYHRzIHR3b3NsYXNoXG4gKiBpbXBvcnQgeyBIZXggfSBmcm9tICdveCdcbiAqXG4gKiBIZXguZnJvbU51bWJlcig0MjApXG4gKiAvLyBAbG9nOiAnMHgxYTQnXG4gKlxuICogSGV4LmZyb21OdW1iZXIoNDIwLCB7IHNpemU6IDMyIH0pXG4gKiAvLyBAbG9nOiAnMHgwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMWE0J1xuICogYGBgXG4gKlxuICogQHBhcmFtIHZhbHVlIC0gVGhlIG51bWJlciBvciBiaWdpbnQgdmFsdWUgdG8gZW5jb2RlLlxuICogQHBhcmFtIG9wdGlvbnMgLSBPcHRpb25zLlxuICogQHJldHVybnMgVGhlIGVuY29kZWQge0BsaW5rIG94I0hleC5IZXh9IHZhbHVlLlxuICovXG5leHBvcnQgZnVuY3Rpb24gZnJvbU51bWJlcih2YWx1ZSwgb3B0aW9ucyA9IHt9KSB7XG4gICAgY29uc3QgeyBzaWduZWQsIHNpemUgfSA9IG9wdGlvbnM7XG4gICAgY29uc3QgdmFsdWVfID0gQmlnSW50KHZhbHVlKTtcbiAgICBsZXQgbWF4VmFsdWU7XG4gICAgaWYgKHNpemUpIHtcbiAgICAgICAgaWYgKHNpZ25lZClcbiAgICAgICAgICAgIG1heFZhbHVlID0gKDFuIDw8IChCaWdJbnQoc2l6ZSkgKiA4biAtIDFuKSkgLSAxbjtcbiAgICAgICAgZWxzZVxuICAgICAgICAgICAgbWF4VmFsdWUgPSAybiAqKiAoQmlnSW50KHNpemUpICogOG4pIC0gMW47XG4gICAgfVxuICAgIGVsc2UgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ251bWJlcicpIHtcbiAgICAgICAgbWF4VmFsdWUgPSBCaWdJbnQoTnVtYmVyLk1BWF9TQUZFX0lOVEVHRVIpO1xuICAgIH1cbiAgICBjb25zdCBtaW5WYWx1ZSA9IHR5cGVvZiBtYXhWYWx1ZSA9PT0gJ2JpZ2ludCcgJiYgc2lnbmVkID8gLW1heFZhbHVlIC0gMW4gOiAwO1xuICAgIGlmICgobWF4VmFsdWUgJiYgdmFsdWVfID4gbWF4VmFsdWUpIHx8IHZhbHVlXyA8IG1pblZhbHVlKSB7XG4gICAgICAgIGNvbnN0IHN1ZmZpeCA9IHR5cGVvZiB2YWx1ZSA9PT0gJ2JpZ2ludCcgPyAnbicgOiAnJztcbiAgICAgICAgdGhyb3cgbmV3IEludGVnZXJPdXRPZlJhbmdlRXJyb3Ioe1xuICAgICAgICAgICAgbWF4OiBtYXhWYWx1ZSA/IGAke21heFZhbHVlfSR7c3VmZml4fWAgOiB1bmRlZmluZWQsXG4gICAgICAgICAgICBtaW46IGAke21pblZhbHVlfSR7c3VmZml4fWAsXG4gICAgICAgICAgICBzaWduZWQsXG4gICAgICAgICAgICBzaXplLFxuICAgICAgICAgICAgdmFsdWU6IGAke3ZhbHVlfSR7c3VmZml4fWAsXG4gICAgICAgIH0pO1xuICAgIH1cbiAgICBjb25zdCBzdHJpbmdWYWx1ZSA9IChzaWduZWQgJiYgdmFsdWVfIDwgMCA/IEJpZ0ludC5hc1VpbnROKHNpemUgKiA4LCBCaWdJbnQodmFsdWVfKSkgOiB2YWx1ZV8pLnRvU3RyaW5nKDE2KTtcbiAgICBjb25zdCBoZXggPSBgMHgke3N0cmluZ1ZhbHVlfWA7XG4gICAgaWYgKHNpemUpXG4gICAgICAgIHJldHVybiBwYWRMZWZ0KGhleCwgc2l6ZSk7XG4gICAgcmV0dXJuIGhleDtcbn1cbi8qKlxuICogRW5jb2RlcyBhIHN0cmluZyBpbnRvIGEge0BsaW5rIG94I0hleC5IZXh9IHZhbHVlLlxuICpcbiAqIEBleGFtcGxlXG4gKiBgYGB0cyB0d29zbGFzaFxuICogaW1wb3J0IHsgSGV4IH0gZnJvbSAnb3gnXG4gKiBIZXguZnJvbVN0cmluZygnSGVsbG8gV29ybGQhJylcbiAqIC8vICcweDQ4NjU2YzZjNmYyMDU3NmY3MjZjNjQyMSdcbiAqXG4gKiBIZXguZnJvbVN0cmluZygnSGVsbG8gV29ybGQhJywgeyBzaXplOiAzMiB9KVxuICogLy8gJzB4NDg2NTZjNmM2ZjIwNTc2ZjcyNmM2NDIxMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMCdcbiAqIGBgYFxuICpcbiAqIEBwYXJhbSB2YWx1ZSAtIFRoZSBzdHJpbmcgdmFsdWUgdG8gZW5jb2RlLlxuICogQHBhcmFtIG9wdGlvbnMgLSBPcHRpb25zLlxuICogQHJldHVybnMgVGhlIGVuY29kZWQge0BsaW5rIG94I0hleC5IZXh9IHZhbHVlLlxuICovXG5leHBvcnQgZnVuY3Rpb24gZnJvbVN0cmluZyh2YWx1ZSwgb3B0aW9ucyA9IHt9KSB7XG4gICAgcmV0dXJuIGZyb21CeXRlcyhlbmNvZGVyLmVuY29kZSh2YWx1ZSksIG9wdGlvbnMpO1xufVxuLyoqXG4gKiBDaGVja3MgaWYgdHdvIHtAbGluayBveCNIZXguSGV4fSB2YWx1ZXMgYXJlIGVxdWFsLlxuICpcbiAqIEBleGFtcGxlXG4gKiBgYGB0cyB0d29zbGFzaFxuICogaW1wb3J0IHsgSGV4IH0gZnJvbSAnb3gnXG4gKlxuICogSGV4LmlzRXF1YWwoJzB4ZGVhZGJlZWYnLCAnMHhkZWFkYmVlZicpXG4gKiAvLyBAbG9nOiB0cnVlXG4gKlxuICogSGV4LmlzRXF1YWwoJzB4ZGEnLCAnMHhiYScpXG4gKiAvLyBAbG9nOiBmYWxzZVxuICogYGBgXG4gKlxuICogQHBhcmFtIGhleEEgLSBUaGUgZmlyc3Qge0BsaW5rIG94I0hleC5IZXh9IHZhbHVlLlxuICogQHBhcmFtIGhleEIgLSBUaGUgc2Vjb25kIHtAbGluayBveCNIZXguSGV4fSB2YWx1ZS5cbiAqIEByZXR1cm5zIGB0cnVlYCBpZiB0aGUgdHdvIHtAbGluayBveCNIZXguSGV4fSB2YWx1ZXMgYXJlIGVxdWFsLCBgZmFsc2VgIG90aGVyd2lzZS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGlzRXF1YWwoaGV4QSwgaGV4Qikge1xuICAgIHJldHVybiBlcXVhbEJ5dGVzKEJ5dGVzLmZyb21IZXgoaGV4QSksIEJ5dGVzLmZyb21IZXgoaGV4QikpO1xufVxuLyoqXG4gKiBQYWRzIGEge0BsaW5rIG94I0hleC5IZXh9IHZhbHVlIHRvIHRoZSBsZWZ0IHdpdGggemVybyBieXRlcyB1bnRpbCBpdCByZWFjaGVzIHRoZSBnaXZlbiBgc2l6ZWAgKGRlZmF1bHQ6IDMyIGJ5dGVzKS5cbiAqXG4gKiBAZXhhbXBsZVxuICogYGBgdHMgdHdvc2xhc2hcbiAqIGltcG9ydCB7IEhleCB9IGZyb20gJ294J1xuICpcbiAqIEhleC5wYWRMZWZ0KCcweDEyMzQnLCA0KVxuICogLy8gQGxvZzogJzB4MDAwMDEyMzQnXG4gKiBgYGBcbiAqXG4gKiBAcGFyYW0gdmFsdWUgLSBUaGUge0BsaW5rIG94I0hleC5IZXh9IHZhbHVlIHRvIHBhZC5cbiAqIEBwYXJhbSBzaXplIC0gVGhlIHNpemUgKGluIGJ5dGVzKSBvZiB0aGUgb3V0cHV0IGhleCB2YWx1ZS5cbiAqIEByZXR1cm5zIFRoZSBwYWRkZWQge0BsaW5rIG94I0hleC5IZXh9IHZhbHVlLlxuICovXG5leHBvcnQgZnVuY3Rpb24gcGFkTGVmdCh2YWx1ZSwgc2l6ZSkge1xuICAgIHJldHVybiBpbnRlcm5hbC5wYWQodmFsdWUsIHsgZGlyOiAnbGVmdCcsIHNpemUgfSk7XG59XG4vKipcbiAqIFBhZHMgYSB7QGxpbmsgb3gjSGV4LkhleH0gdmFsdWUgdG8gdGhlIHJpZ2h0IHdpdGggemVybyBieXRlcyB1bnRpbCBpdCByZWFjaGVzIHRoZSBnaXZlbiBgc2l6ZWAgKGRlZmF1bHQ6IDMyIGJ5dGVzKS5cbiAqXG4gKiBAZXhhbXBsZVxuICogYGBgdHNcbiAqIGltcG9ydCB7IEhleCB9IGZyb20gJ294J1xuICpcbiAqIEhleC5wYWRSaWdodCgnMHgxMjM0JywgNClcbiAqIC8vIEBsb2c6ICcweDEyMzQwMDAwJ1xuICogYGBgXG4gKlxuICogQHBhcmFtIHZhbHVlIC0gVGhlIHtAbGluayBveCNIZXguSGV4fSB2YWx1ZSB0byBwYWQuXG4gKiBAcGFyYW0gc2l6ZSAtIFRoZSBzaXplIChpbiBieXRlcykgb2YgdGhlIG91dHB1dCBoZXggdmFsdWUuXG4gKiBAcmV0dXJucyBUaGUgcGFkZGVkIHtAbGluayBveCNIZXguSGV4fSB2YWx1ZS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHBhZFJpZ2h0KHZhbHVlLCBzaXplKSB7XG4gICAgcmV0dXJuIGludGVybmFsLnBhZCh2YWx1ZSwgeyBkaXI6ICdyaWdodCcsIHNpemUgfSk7XG59XG4vKipcbiAqIEdlbmVyYXRlcyBhIHJhbmRvbSB7QGxpbmsgb3gjSGV4LkhleH0gdmFsdWUgb2YgdGhlIHNwZWNpZmllZCBsZW5ndGguXG4gKlxuICogQGV4YW1wbGVcbiAqIGBgYHRzIHR3b3NsYXNoXG4gKiBpbXBvcnQgeyBIZXggfSBmcm9tICdveCdcbiAqXG4gKiBjb25zdCBoZXggPSBIZXgucmFuZG9tKDMyKVxuICogLy8gQGxvZzogJzB4Li4uJ1xuICogYGBgXG4gKlxuICogQHJldHVybnMgUmFuZG9tIHtAbGluayBveCNIZXguSGV4fSB2YWx1ZS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHJhbmRvbShsZW5ndGgpIHtcbiAgICByZXR1cm4gZnJvbUJ5dGVzKEJ5dGVzLnJhbmRvbShsZW5ndGgpKTtcbn1cbi8qKlxuICogUmV0dXJucyBhIHNlY3Rpb24gb2YgYSB7QGxpbmsgb3gjQnl0ZXMuQnl0ZXN9IHZhbHVlIGdpdmVuIGEgc3RhcnQvZW5kIGJ5dGVzIG9mZnNldC5cbiAqXG4gKiBAZXhhbXBsZVxuICogYGBgdHMgdHdvc2xhc2hcbiAqIGltcG9ydCB7IEhleCB9IGZyb20gJ294J1xuICpcbiAqIEhleC5zbGljZSgnMHgwMTIzNDU2Nzg5JywgMSwgNClcbiAqIC8vIEBsb2c6ICcweDIzNDU2NydcbiAqIGBgYFxuICpcbiAqIEBwYXJhbSB2YWx1ZSAtIFRoZSB7QGxpbmsgb3gjSGV4LkhleH0gdmFsdWUgdG8gc2xpY2UuXG4gKiBAcGFyYW0gc3RhcnQgLSBUaGUgc3RhcnQgb2Zmc2V0IChpbiBieXRlcykuXG4gKiBAcGFyYW0gZW5kIC0gVGhlIGVuZCBvZmZzZXQgKGluIGJ5dGVzKS5cbiAqIEBwYXJhbSBvcHRpb25zIC0gT3B0aW9ucy5cbiAqIEByZXR1cm5zIFRoZSBzbGljZWQge0BsaW5rIG94I0hleC5IZXh9IHZhbHVlLlxuICovXG5leHBvcnQgZnVuY3Rpb24gc2xpY2UodmFsdWUsIHN0YXJ0LCBlbmQsIG9wdGlvbnMgPSB7fSkge1xuICAgIGNvbnN0IHsgc3RyaWN0IH0gPSBvcHRpb25zO1xuICAgIGludGVybmFsLmFzc2VydFN0YXJ0T2Zmc2V0KHZhbHVlLCBzdGFydCk7XG4gICAgY29uc3QgdmFsdWVfID0gYDB4JHt2YWx1ZVxuICAgICAgICAucmVwbGFjZSgnMHgnLCAnJylcbiAgICAgICAgLnNsaWNlKChzdGFydCA/PyAwKSAqIDIsIChlbmQgPz8gdmFsdWUubGVuZ3RoKSAqIDIpfWA7XG4gICAgaWYgKHN0cmljdClcbiAgICAgICAgaW50ZXJuYWwuYXNzZXJ0RW5kT2Zmc2V0KHZhbHVlXywgc3RhcnQsIGVuZCk7XG4gICAgcmV0dXJuIHZhbHVlXztcbn1cbi8qKlxuICogUmV0cmlldmVzIHRoZSBzaXplIG9mIGEge0BsaW5rIG94I0hleC5IZXh9IHZhbHVlIChpbiBieXRlcykuXG4gKlxuICogQGV4YW1wbGVcbiAqIGBgYHRzIHR3b3NsYXNoXG4gKiBpbXBvcnQgeyBIZXggfSBmcm9tICdveCdcbiAqXG4gKiBIZXguc2l6ZSgnMHhkZWFkYmVlZicpXG4gKiAvLyBAbG9nOiA0XG4gKiBgYGBcbiAqXG4gKiBAcGFyYW0gdmFsdWUgLSBUaGUge0BsaW5rIG94I0hleC5IZXh9IHZhbHVlIHRvIGdldCB0aGUgc2l6ZSBvZi5cbiAqIEByZXR1cm5zIFRoZSBzaXplIG9mIHRoZSB7QGxpbmsgb3gjSGV4LkhleH0gdmFsdWUgKGluIGJ5dGVzKS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHNpemUodmFsdWUpIHtcbiAgICByZXR1cm4gTWF0aC5jZWlsKCh2YWx1ZS5sZW5ndGggLSAyKSAvIDIpO1xufVxuLyoqXG4gKiBUcmltcyBsZWFkaW5nIHplcm9zIGZyb20gYSB7QGxpbmsgb3gjSGV4LkhleH0gdmFsdWUuXG4gKlxuICogQGV4YW1wbGVcbiAqIGBgYHRzIHR3b3NsYXNoXG4gKiBpbXBvcnQgeyBIZXggfSBmcm9tICdveCdcbiAqXG4gKiBIZXgudHJpbUxlZnQoJzB4MDAwMDAwMDBkZWFkYmVlZicpXG4gKiAvLyBAbG9nOiAnMHhkZWFkYmVlZidcbiAqIGBgYFxuICpcbiAqIEBwYXJhbSB2YWx1ZSAtIFRoZSB7QGxpbmsgb3gjSGV4LkhleH0gdmFsdWUgdG8gdHJpbS5cbiAqIEByZXR1cm5zIFRoZSB0cmltbWVkIHtAbGluayBveCNIZXguSGV4fSB2YWx1ZS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHRyaW1MZWZ0KHZhbHVlKSB7XG4gICAgcmV0dXJuIGludGVybmFsLnRyaW0odmFsdWUsIHsgZGlyOiAnbGVmdCcgfSk7XG59XG4vKipcbiAqIFRyaW1zIHRyYWlsaW5nIHplcm9zIGZyb20gYSB7QGxpbmsgb3gjSGV4LkhleH0gdmFsdWUuXG4gKlxuICogQGV4YW1wbGVcbiAqIGBgYHRzIHR3b3NsYXNoXG4gKiBpbXBvcnQgeyBIZXggfSBmcm9tICdveCdcbiAqXG4gKiBIZXgudHJpbVJpZ2h0KCcweGRlYWRiZWVmMDAwMDAwMDAnKVxuICogLy8gQGxvZzogJzB4ZGVhZGJlZWYnXG4gKiBgYGBcbiAqXG4gKiBAcGFyYW0gdmFsdWUgLSBUaGUge0BsaW5rIG94I0hleC5IZXh9IHZhbHVlIHRvIHRyaW0uXG4gKiBAcmV0dXJucyBUaGUgdHJpbW1lZCB7QGxpbmsgb3gjSGV4LkhleH0gdmFsdWUuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiB0cmltUmlnaHQodmFsdWUpIHtcbiAgICByZXR1cm4gaW50ZXJuYWwudHJpbSh2YWx1ZSwgeyBkaXI6ICdyaWdodCcgfSk7XG59XG4vKipcbiAqIERlY29kZXMgYSB7QGxpbmsgb3gjSGV4LkhleH0gdmFsdWUgaW50byBhIEJpZ0ludC5cbiAqXG4gKiBAZXhhbXBsZVxuICogYGBgdHMgdHdvc2xhc2hcbiAqIGltcG9ydCB7IEhleCB9IGZyb20gJ294J1xuICpcbiAqIEhleC50b0JpZ0ludCgnMHgxYTQnKVxuICogLy8gQGxvZzogNDIwblxuICpcbiAqIEhleC50b0JpZ0ludCgnMHgwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMWE0JywgeyBzaXplOiAzMiB9KVxuICogLy8gQGxvZzogNDIwblxuICogYGBgXG4gKlxuICogQHBhcmFtIGhleCAtIFRoZSB7QGxpbmsgb3gjSGV4LkhleH0gdmFsdWUgdG8gZGVjb2RlLlxuICogQHBhcmFtIG9wdGlvbnMgLSBPcHRpb25zLlxuICogQHJldHVybnMgVGhlIGRlY29kZWQgQmlnSW50LlxuICovXG5leHBvcnQgZnVuY3Rpb24gdG9CaWdJbnQoaGV4LCBvcHRpb25zID0ge30pIHtcbiAgICBjb25zdCB7IHNpZ25lZCB9ID0gb3B0aW9ucztcbiAgICBpZiAob3B0aW9ucy5zaXplKVxuICAgICAgICBpbnRlcm5hbC5hc3NlcnRTaXplKGhleCwgb3B0aW9ucy5zaXplKTtcbiAgICBjb25zdCB2YWx1ZSA9IEJpZ0ludChoZXgpO1xuICAgIGlmICghc2lnbmVkKVxuICAgICAgICByZXR1cm4gdmFsdWU7XG4gICAgY29uc3Qgc2l6ZSA9IChoZXgubGVuZ3RoIC0gMikgLyAyO1xuICAgIGNvbnN0IG1heF91bnNpZ25lZCA9ICgxbiA8PCAoQmlnSW50KHNpemUpICogOG4pKSAtIDFuO1xuICAgIGNvbnN0IG1heF9zaWduZWQgPSBtYXhfdW5zaWduZWQgPj4gMW47XG4gICAgaWYgKHZhbHVlIDw9IG1heF9zaWduZWQpXG4gICAgICAgIHJldHVybiB2YWx1ZTtcbiAgICByZXR1cm4gdmFsdWUgLSBtYXhfdW5zaWduZWQgLSAxbjtcbn1cbi8qKlxuICogRGVjb2RlcyBhIHtAbGluayBveCNIZXguSGV4fSB2YWx1ZSBpbnRvIGEgYm9vbGVhbi5cbiAqXG4gKiBAZXhhbXBsZVxuICogYGBgdHMgdHdvc2xhc2hcbiAqIGltcG9ydCB7IEhleCB9IGZyb20gJ294J1xuICpcbiAqIEhleC50b0Jvb2xlYW4oJzB4MDEnKVxuICogLy8gQGxvZzogdHJ1ZVxuICpcbiAqIEhleC50b0Jvb2xlYW4oJzB4MDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMScsIHsgc2l6ZTogMzIgfSlcbiAqIC8vIEBsb2c6IHRydWVcbiAqIGBgYFxuICpcbiAqIEBwYXJhbSBoZXggLSBUaGUge0BsaW5rIG94I0hleC5IZXh9IHZhbHVlIHRvIGRlY29kZS5cbiAqIEBwYXJhbSBvcHRpb25zIC0gT3B0aW9ucy5cbiAqIEByZXR1cm5zIFRoZSBkZWNvZGVkIGJvb2xlYW4uXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiB0b0Jvb2xlYW4oaGV4LCBvcHRpb25zID0ge30pIHtcbiAgICBpZiAob3B0aW9ucy5zaXplKVxuICAgICAgICBpbnRlcm5hbC5hc3NlcnRTaXplKGhleCwgb3B0aW9ucy5zaXplKTtcbiAgICBjb25zdCBoZXhfID0gdHJpbUxlZnQoaGV4KTtcbiAgICBpZiAoaGV4XyA9PT0gJzB4JylcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIGlmIChoZXhfID09PSAnMHgxJylcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgdGhyb3cgbmV3IEludmFsaWRIZXhCb29sZWFuRXJyb3IoaGV4KTtcbn1cbi8qKlxuICogRGVjb2RlcyBhIHtAbGluayBveCNIZXguSGV4fSB2YWx1ZSBpbnRvIGEge0BsaW5rIG94I0J5dGVzLkJ5dGVzfS5cbiAqXG4gKiBAZXhhbXBsZVxuICogYGBgdHMgdHdvc2xhc2hcbiAqIGltcG9ydCB7IEhleCB9IGZyb20gJ294J1xuICpcbiAqIGNvbnN0IGRhdGEgPSBIZXgudG9CeXRlcygnMHg0ODY1NmM2YzZmMjA3NzZmNzI2YzY0MjEnKVxuICogLy8gQGxvZzogVWludDhBcnJheShbNzIsIDEwMSwgMTA4LCAxMDgsIDExMSwgMzIsIDg3LCAxMTEsIDExNCwgMTA4LCAxMDAsIDMzXSlcbiAqIGBgYFxuICpcbiAqIEBwYXJhbSBoZXggLSBUaGUge0BsaW5rIG94I0hleC5IZXh9IHZhbHVlIHRvIGRlY29kZS5cbiAqIEBwYXJhbSBvcHRpb25zIC0gT3B0aW9ucy5cbiAqIEByZXR1cm5zIFRoZSBkZWNvZGVkIHtAbGluayBveCNCeXRlcy5CeXRlc30uXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiB0b0J5dGVzKGhleCwgb3B0aW9ucyA9IHt9KSB7XG4gICAgcmV0dXJuIEJ5dGVzLmZyb21IZXgoaGV4LCBvcHRpb25zKTtcbn1cbi8qKlxuICogRGVjb2RlcyBhIHtAbGluayBveCNIZXguSGV4fSB2YWx1ZSBpbnRvIGEgbnVtYmVyLlxuICpcbiAqIEBleGFtcGxlXG4gKiBgYGB0cyB0d29zbGFzaFxuICogaW1wb3J0IHsgSGV4IH0gZnJvbSAnb3gnXG4gKlxuICogSGV4LnRvTnVtYmVyKCcweDFhNCcpXG4gKiAvLyBAbG9nOiA0MjBcbiAqXG4gKiBIZXgudG9OdW1iZXIoJzB4MDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDFhNCcsIHsgc2l6ZTogMzIgfSlcbiAqIC8vIEBsb2c6IDQyMFxuICogYGBgXG4gKlxuICogQHBhcmFtIGhleCAtIFRoZSB7QGxpbmsgb3gjSGV4LkhleH0gdmFsdWUgdG8gZGVjb2RlLlxuICogQHBhcmFtIG9wdGlvbnMgLSBPcHRpb25zLlxuICogQHJldHVybnMgVGhlIGRlY29kZWQgbnVtYmVyLlxuICovXG5leHBvcnQgZnVuY3Rpb24gdG9OdW1iZXIoaGV4LCBvcHRpb25zID0ge30pIHtcbiAgICBjb25zdCB7IHNpZ25lZCwgc2l6ZSB9ID0gb3B0aW9ucztcbiAgICBpZiAoIXNpZ25lZCAmJiAhc2l6ZSlcbiAgICAgICAgcmV0dXJuIE51bWJlcihoZXgpO1xuICAgIHJldHVybiBOdW1iZXIodG9CaWdJbnQoaGV4LCBvcHRpb25zKSk7XG59XG4vKipcbiAqIERlY29kZXMgYSB7QGxpbmsgb3gjSGV4LkhleH0gdmFsdWUgaW50byBhIHN0cmluZy5cbiAqXG4gKiBAZXhhbXBsZVxuICogYGBgdHMgdHdvc2xhc2hcbiAqIGltcG9ydCB7IEhleCB9IGZyb20gJ294J1xuICpcbiAqIEhleC50b1N0cmluZygnMHg0ODY1NmM2YzZmMjA1NzZmNzI2YzY0MjEnKVxuICogLy8gQGxvZzogJ0hlbGxvIHdvcmxkISdcbiAqXG4gKiBIZXgudG9TdHJpbmcoJzB4NDg2NTZjNmM2ZjIwNTc2ZjcyNmM2NDIxMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMCcsIHtcbiAqICBzaXplOiAzMixcbiAqIH0pXG4gKiAvLyBAbG9nOiAnSGVsbG8gd29ybGQnXG4gKiBgYGBcbiAqXG4gKiBAcGFyYW0gaGV4IC0gVGhlIHtAbGluayBveCNIZXguSGV4fSB2YWx1ZSB0byBkZWNvZGUuXG4gKiBAcGFyYW0gb3B0aW9ucyAtIE9wdGlvbnMuXG4gKiBAcmV0dXJucyBUaGUgZGVjb2RlZCBzdHJpbmcuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiB0b1N0cmluZyhoZXgsIG9wdGlvbnMgPSB7fSkge1xuICAgIGNvbnN0IHsgc2l6ZSB9ID0gb3B0aW9ucztcbiAgICBsZXQgYnl0ZXMgPSBCeXRlcy5mcm9tSGV4KGhleCk7XG4gICAgaWYgKHNpemUpIHtcbiAgICAgICAgaW50ZXJuYWxfYnl0ZXMuYXNzZXJ0U2l6ZShieXRlcywgc2l6ZSk7XG4gICAgICAgIGJ5dGVzID0gQnl0ZXMudHJpbVJpZ2h0KGJ5dGVzKTtcbiAgICB9XG4gICAgcmV0dXJuIG5ldyBUZXh0RGVjb2RlcigpLmRlY29kZShieXRlcyk7XG59XG4vKipcbiAqIENoZWNrcyBpZiB0aGUgZ2l2ZW4gdmFsdWUgaXMge0BsaW5rIG94I0hleC5IZXh9LlxuICpcbiAqIEBleGFtcGxlXG4gKiBgYGB0cyB0d29zbGFzaFxuICogaW1wb3J0IHsgQnl0ZXMsIEhleCB9IGZyb20gJ294J1xuICpcbiAqIEhleC52YWxpZGF0ZSgnMHhkZWFkYmVlZicpXG4gKiAvLyBAbG9nOiB0cnVlXG4gKlxuICogSGV4LnZhbGlkYXRlKEJ5dGVzLmZyb20oWzEsIDIsIDNdKSlcbiAqIC8vIEBsb2c6IGZhbHNlXG4gKiBgYGBcbiAqXG4gKiBAcGFyYW0gdmFsdWUgLSBUaGUgdmFsdWUgdG8gY2hlY2suXG4gKiBAcGFyYW0gb3B0aW9ucyAtIE9wdGlvbnMuXG4gKiBAcmV0dXJucyBgdHJ1ZWAgaWYgdGhlIHZhbHVlIGlzIGEge0BsaW5rIG94I0hleC5IZXh9LCBgZmFsc2VgIG90aGVyd2lzZS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHZhbGlkYXRlKHZhbHVlLCBvcHRpb25zID0ge30pIHtcbiAgICBjb25zdCB7IHN0cmljdCA9IGZhbHNlIH0gPSBvcHRpb25zO1xuICAgIHRyeSB7XG4gICAgICAgIGFzc2VydCh2YWx1ZSwgeyBzdHJpY3QgfSk7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgICBjYXRjaCB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG59XG4vKipcbiAqIFRocm93biB3aGVuIHRoZSBwcm92aWRlZCBpbnRlZ2VyIGlzIG91dCBvZiByYW5nZSwgYW5kIGNhbm5vdCBiZSByZXByZXNlbnRlZCBhcyBhIGhleCB2YWx1ZS5cbiAqXG4gKiBAZXhhbXBsZVxuICogYGBgdHMgdHdvc2xhc2hcbiAqIGltcG9ydCB7IEhleCB9IGZyb20gJ294J1xuICpcbiAqIEhleC5mcm9tTnVtYmVyKDQyMDE4MjczODkxMjczMTI4MzcxMjkzNzEyOSlcbiAqIC8vIEBlcnJvcjogSGV4LkludGVnZXJPdXRPZlJhbmdlRXJyb3I6IE51bWJlciBcXGA0LjIwMTgyNzM4OTEyNzMxMjZlKzI2XFxgIGlzIG5vdCBpbiBzYWZlIHVuc2lnbmVkIGludGVnZXIgcmFuZ2UgKGAwYCB0byBgOTAwNzE5OTI1NDc0MDk5MWApXG4gKiBgYGBcbiAqL1xuZXhwb3J0IGNsYXNzIEludGVnZXJPdXRPZlJhbmdlRXJyb3IgZXh0ZW5kcyBFcnJvcnMuQmFzZUVycm9yIHtcbiAgICBjb25zdHJ1Y3Rvcih7IG1heCwgbWluLCBzaWduZWQsIHNpemUsIHZhbHVlLCB9KSB7XG4gICAgICAgIHN1cGVyKGBOdW1iZXIgXFxgJHt2YWx1ZX1cXGAgaXMgbm90IGluIHNhZmUke3NpemUgPyBgICR7c2l6ZSAqIDh9LWJpdGAgOiAnJ30ke3NpZ25lZCA/ICcgc2lnbmVkJyA6ICcgdW5zaWduZWQnfSBpbnRlZ2VyIHJhbmdlICR7bWF4ID8gYChcXGAke21pbn1cXGAgdG8gXFxgJHttYXh9XFxgKWAgOiBgKGFib3ZlIFxcYCR7bWlufVxcYClgfWApO1xuICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkodGhpcywgXCJuYW1lXCIsIHtcbiAgICAgICAgICAgIGVudW1lcmFibGU6IHRydWUsXG4gICAgICAgICAgICBjb25maWd1cmFibGU6IHRydWUsXG4gICAgICAgICAgICB3cml0YWJsZTogdHJ1ZSxcbiAgICAgICAgICAgIHZhbHVlOiAnSGV4LkludGVnZXJPdXRPZlJhbmdlRXJyb3InXG4gICAgICAgIH0pO1xuICAgIH1cbn1cbi8qKlxuICogVGhyb3duIHdoZW4gdGhlIHByb3ZpZGVkIGhleCB2YWx1ZSBjYW5ub3QgYmUgcmVwcmVzZW50ZWQgYXMgYSBib29sZWFuLlxuICpcbiAqIEBleGFtcGxlXG4gKiBgYGB0cyB0d29zbGFzaFxuICogaW1wb3J0IHsgSGV4IH0gZnJvbSAnb3gnXG4gKlxuICogSGV4LnRvQm9vbGVhbignMHhhJylcbiAqIC8vIEBlcnJvcjogSGV4LkludmFsaWRIZXhCb29sZWFuRXJyb3I6IEhleCB2YWx1ZSBgXCIweGFcImAgaXMgbm90IGEgdmFsaWQgYm9vbGVhbi5cbiAqIC8vIEBlcnJvcjogVGhlIGhleCB2YWx1ZSBtdXN0IGJlIGBcIjB4MFwiYCAoZmFsc2UpIG9yIGBcIjB4MVwiYCAodHJ1ZSkuXG4gKiBgYGBcbiAqL1xuZXhwb3J0IGNsYXNzIEludmFsaWRIZXhCb29sZWFuRXJyb3IgZXh0ZW5kcyBFcnJvcnMuQmFzZUVycm9yIHtcbiAgICBjb25zdHJ1Y3RvcihoZXgpIHtcbiAgICAgICAgc3VwZXIoYEhleCB2YWx1ZSBcXGBcIiR7aGV4fVwiXFxgIGlzIG5vdCBhIHZhbGlkIGJvb2xlYW4uYCwge1xuICAgICAgICAgICAgbWV0YU1lc3NhZ2VzOiBbXG4gICAgICAgICAgICAgICAgJ1RoZSBoZXggdmFsdWUgbXVzdCBiZSBgXCIweDBcImAgKGZhbHNlKSBvciBgXCIweDFcImAgKHRydWUpLicsXG4gICAgICAgICAgICBdLFxuICAgICAgICB9KTtcbiAgICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRoaXMsIFwibmFtZVwiLCB7XG4gICAgICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlLFxuICAgICAgICAgICAgd3JpdGFibGU6IHRydWUsXG4gICAgICAgICAgICB2YWx1ZTogJ0hleC5JbnZhbGlkSGV4Qm9vbGVhbkVycm9yJ1xuICAgICAgICB9KTtcbiAgICB9XG59XG4vKipcbiAqIFRocm93biB3aGVuIHRoZSBwcm92aWRlZCB2YWx1ZSBpcyBub3QgYSB2YWxpZCBoZXggdHlwZS5cbiAqXG4gKiBAZXhhbXBsZVxuICogYGBgdHMgdHdvc2xhc2hcbiAqIGltcG9ydCB7IEhleCB9IGZyb20gJ294J1xuICpcbiAqIEhleC5hc3NlcnQoMSlcbiAqIC8vIEBlcnJvcjogSGV4LkludmFsaWRIZXhUeXBlRXJyb3I6IFZhbHVlIGAxYCBvZiB0eXBlIGBudW1iZXJgIGlzIGFuIGludmFsaWQgaGV4IHR5cGUuXG4gKiBgYGBcbiAqL1xuZXhwb3J0IGNsYXNzIEludmFsaWRIZXhUeXBlRXJyb3IgZXh0ZW5kcyBFcnJvcnMuQmFzZUVycm9yIHtcbiAgICBjb25zdHJ1Y3Rvcih2YWx1ZSkge1xuICAgICAgICBzdXBlcihgVmFsdWUgXFxgJHt0eXBlb2YgdmFsdWUgPT09ICdvYmplY3QnID8gSnNvbi5zdHJpbmdpZnkodmFsdWUpIDogdmFsdWV9XFxgIG9mIHR5cGUgXFxgJHt0eXBlb2YgdmFsdWV9XFxgIGlzIGFuIGludmFsaWQgaGV4IHR5cGUuYCwge1xuICAgICAgICAgICAgbWV0YU1lc3NhZ2VzOiBbJ0hleCB0eXBlcyBtdXN0IGJlIHJlcHJlc2VudGVkIGFzIGBcIjB4JHtzdHJpbmd9XCJgLiddLFxuICAgICAgICB9KTtcbiAgICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRoaXMsIFwibmFtZVwiLCB7XG4gICAgICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlLFxuICAgICAgICAgICAgd3JpdGFibGU6IHRydWUsXG4gICAgICAgICAgICB2YWx1ZTogJ0hleC5JbnZhbGlkSGV4VHlwZUVycm9yJ1xuICAgICAgICB9KTtcbiAgICB9XG59XG4vKipcbiAqIFRocm93biB3aGVuIHRoZSBwcm92aWRlZCBoZXggdmFsdWUgaXMgaW52YWxpZC5cbiAqXG4gKiBAZXhhbXBsZVxuICogYGBgdHMgdHdvc2xhc2hcbiAqIGltcG9ydCB7IEhleCB9IGZyb20gJ294J1xuICpcbiAqIEhleC5hc3NlcnQoJzB4MDEyMzQ1Njc4OWFiY2RlZmcnKVxuICogLy8gQGVycm9yOiBIZXguSW52YWxpZEhleFZhbHVlRXJyb3I6IFZhbHVlIGAweDAxMjM0NTY3ODlhYmNkZWZnYCBpcyBhbiBpbnZhbGlkIGhleCB2YWx1ZS5cbiAqIC8vIEBlcnJvcjogSGV4IHZhbHVlcyBtdXN0IHN0YXJ0IHdpdGggYFwiMHhcImAgYW5kIGNvbnRhaW4gb25seSBoZXhhZGVjaW1hbCBjaGFyYWN0ZXJzICgwLTksIGEtZiwgQS1GKS5cbiAqIGBgYFxuICovXG5leHBvcnQgY2xhc3MgSW52YWxpZEhleFZhbHVlRXJyb3IgZXh0ZW5kcyBFcnJvcnMuQmFzZUVycm9yIHtcbiAgICBjb25zdHJ1Y3Rvcih2YWx1ZSkge1xuICAgICAgICBzdXBlcihgVmFsdWUgXFxgJHt2YWx1ZX1cXGAgaXMgYW4gaW52YWxpZCBoZXggdmFsdWUuYCwge1xuICAgICAgICAgICAgbWV0YU1lc3NhZ2VzOiBbXG4gICAgICAgICAgICAgICAgJ0hleCB2YWx1ZXMgbXVzdCBzdGFydCB3aXRoIGBcIjB4XCJgIGFuZCBjb250YWluIG9ubHkgaGV4YWRlY2ltYWwgY2hhcmFjdGVycyAoMC05LCBhLWYsIEEtRikuJyxcbiAgICAgICAgICAgIF0sXG4gICAgICAgIH0pO1xuICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkodGhpcywgXCJuYW1lXCIsIHtcbiAgICAgICAgICAgIGVudW1lcmFibGU6IHRydWUsXG4gICAgICAgICAgICBjb25maWd1cmFibGU6IHRydWUsXG4gICAgICAgICAgICB3cml0YWJsZTogdHJ1ZSxcbiAgICAgICAgICAgIHZhbHVlOiAnSGV4LkludmFsaWRIZXhWYWx1ZUVycm9yJ1xuICAgICAgICB9KTtcbiAgICB9XG59XG4vKipcbiAqIFRocm93biB3aGVuIHRoZSBwcm92aWRlZCBoZXggdmFsdWUgaXMgYW4gb2RkIGxlbmd0aC5cbiAqXG4gKiBAZXhhbXBsZVxuICogYGBgdHMgdHdvc2xhc2hcbiAqIGltcG9ydCB7IEJ5dGVzIH0gZnJvbSAnb3gnXG4gKlxuICogQnl0ZXMuZnJvbUhleCgnMHhhYmNkZScpXG4gKiAvLyBAZXJyb3I6IEhleC5JbnZhbGlkTGVuZ3RoRXJyb3I6IEhleCB2YWx1ZSBgXCIweGFiY2RlXCJgIGlzIGFuIG9kZCBsZW5ndGggKDUgbmliYmxlcykuXG4gKiBgYGBcbiAqL1xuZXhwb3J0IGNsYXNzIEludmFsaWRMZW5ndGhFcnJvciBleHRlbmRzIEVycm9ycy5CYXNlRXJyb3Ige1xuICAgIGNvbnN0cnVjdG9yKHZhbHVlKSB7XG4gICAgICAgIHN1cGVyKGBIZXggdmFsdWUgXFxgXCIke3ZhbHVlfVwiXFxgIGlzIGFuIG9kZCBsZW5ndGggKCR7dmFsdWUubGVuZ3RoIC0gMn0gbmliYmxlcykuYCwge1xuICAgICAgICAgICAgbWV0YU1lc3NhZ2VzOiBbJ0l0IG11c3QgYmUgYW4gZXZlbiBsZW5ndGguJ10sXG4gICAgICAgIH0pO1xuICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkodGhpcywgXCJuYW1lXCIsIHtcbiAgICAgICAgICAgIGVudW1lcmFibGU6IHRydWUsXG4gICAgICAgICAgICBjb25maWd1cmFibGU6IHRydWUsXG4gICAgICAgICAgICB3cml0YWJsZTogdHJ1ZSxcbiAgICAgICAgICAgIHZhbHVlOiAnSGV4LkludmFsaWRMZW5ndGhFcnJvcidcbiAgICAgICAgfSk7XG4gICAgfVxufVxuLyoqXG4gKiBUaHJvd24gd2hlbiB0aGUgc2l6ZSBvZiB0aGUgdmFsdWUgZXhjZWVkcyB0aGUgZXhwZWN0ZWQgbWF4IHNpemUuXG4gKlxuICogQGV4YW1wbGVcbiAqIGBgYHRzIHR3b3NsYXNoXG4gKiBpbXBvcnQgeyBIZXggfSBmcm9tICdveCdcbiAqXG4gKiBIZXguZnJvbVN0cmluZygnSGVsbG8gV29ybGQhJywgeyBzaXplOiA4IH0pXG4gKiAvLyBAZXJyb3I6IEhleC5TaXplT3ZlcmZsb3dFcnJvcjogU2l6ZSBjYW5ub3QgZXhjZWVkIGA4YCBieXRlcy4gR2l2ZW4gc2l6ZTogYDEyYCBieXRlcy5cbiAqIGBgYFxuICovXG5leHBvcnQgY2xhc3MgU2l6ZU92ZXJmbG93RXJyb3IgZXh0ZW5kcyBFcnJvcnMuQmFzZUVycm9yIHtcbiAgICBjb25zdHJ1Y3Rvcih7IGdpdmVuU2l6ZSwgbWF4U2l6ZSB9KSB7XG4gICAgICAgIHN1cGVyKGBTaXplIGNhbm5vdCBleGNlZWQgXFxgJHttYXhTaXplfVxcYCBieXRlcy4gR2l2ZW4gc2l6ZTogXFxgJHtnaXZlblNpemV9XFxgIGJ5dGVzLmApO1xuICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkodGhpcywgXCJuYW1lXCIsIHtcbiAgICAgICAgICAgIGVudW1lcmFibGU6IHRydWUsXG4gICAgICAgICAgICBjb25maWd1cmFibGU6IHRydWUsXG4gICAgICAgICAgICB3cml0YWJsZTogdHJ1ZSxcbiAgICAgICAgICAgIHZhbHVlOiAnSGV4LlNpemVPdmVyZmxvd0Vycm9yJ1xuICAgICAgICB9KTtcbiAgICB9XG59XG4vKipcbiAqIFRocm93biB3aGVuIHRoZSBzbGljZSBvZmZzZXQgZXhjZWVkcyB0aGUgYm91bmRzIG9mIHRoZSB2YWx1ZS5cbiAqXG4gKiBAZXhhbXBsZVxuICogYGBgdHMgdHdvc2xhc2hcbiAqIGltcG9ydCB7IEhleCB9IGZyb20gJ294J1xuICpcbiAqIEhleC5zbGljZSgnMHgwMTIzNDU2Nzg5JywgNilcbiAqIC8vIEBlcnJvcjogSGV4LlNsaWNlT2Zmc2V0T3V0T2ZCb3VuZHNFcnJvcjogU2xpY2Ugc3RhcnRpbmcgYXQgb2Zmc2V0IGA2YCBpcyBvdXQtb2YtYm91bmRzIChzaXplOiBgNWApLlxuICogYGBgXG4gKi9cbmV4cG9ydCBjbGFzcyBTbGljZU9mZnNldE91dE9mQm91bmRzRXJyb3IgZXh0ZW5kcyBFcnJvcnMuQmFzZUVycm9yIHtcbiAgICBjb25zdHJ1Y3Rvcih7IG9mZnNldCwgcG9zaXRpb24sIHNpemUsIH0pIHtcbiAgICAgICAgc3VwZXIoYFNsaWNlICR7cG9zaXRpb24gPT09ICdzdGFydCcgPyAnc3RhcnRpbmcnIDogJ2VuZGluZyd9IGF0IG9mZnNldCBcXGAke29mZnNldH1cXGAgaXMgb3V0LW9mLWJvdW5kcyAoc2l6ZTogXFxgJHtzaXplfVxcYCkuYCk7XG4gICAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0aGlzLCBcIm5hbWVcIiwge1xuICAgICAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICAgICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgICAgICAgICAgIHdyaXRhYmxlOiB0cnVlLFxuICAgICAgICAgICAgdmFsdWU6ICdIZXguU2xpY2VPZmZzZXRPdXRPZkJvdW5kc0Vycm9yJ1xuICAgICAgICB9KTtcbiAgICB9XG59XG4vKipcbiAqIFRocm93biB3aGVuIHRoZSBzaXplIG9mIHRoZSB2YWx1ZSBleGNlZWRzIHRoZSBwYWQgc2l6ZS5cbiAqXG4gKiBAZXhhbXBsZVxuICogYGBgdHMgdHdvc2xhc2hcbiAqIGltcG9ydCB7IEhleCB9IGZyb20gJ294J1xuICpcbiAqIEhleC5wYWRMZWZ0KCcweDFhNGUxMmE0NWEyMTMyMzEyM2FhYTg3YTg5N2E4OTdhODk4YTY1NjdhNTc4YTg2N2E5ODc3OGE2NjdhODVhODc1YTg3YTZhNzg3YTY1YTY3NWE2YTknLCAzMilcbiAqIC8vIEBlcnJvcjogSGV4LlNpemVFeGNlZWRzUGFkZGluZ1NpemVFcnJvcjogSGV4IHNpemUgKGA0M2ApIGV4Y2VlZHMgcGFkZGluZyBzaXplIChgMzJgKS5cbiAqIGBgYFxuICovXG5leHBvcnQgY2xhc3MgU2l6ZUV4Y2VlZHNQYWRkaW5nU2l6ZUVycm9yIGV4dGVuZHMgRXJyb3JzLkJhc2VFcnJvciB7XG4gICAgY29uc3RydWN0b3IoeyBzaXplLCB0YXJnZXRTaXplLCB0eXBlLCB9KSB7XG4gICAgICAgIHN1cGVyKGAke3R5cGUuY2hhckF0KDApLnRvVXBwZXJDYXNlKCl9JHt0eXBlXG4gICAgICAgICAgICAuc2xpY2UoMSlcbiAgICAgICAgICAgIC50b0xvd2VyQ2FzZSgpfSBzaXplIChcXGAke3NpemV9XFxgKSBleGNlZWRzIHBhZGRpbmcgc2l6ZSAoXFxgJHt0YXJnZXRTaXplfVxcYCkuYCk7XG4gICAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0aGlzLCBcIm5hbWVcIiwge1xuICAgICAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICAgICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgICAgICAgICAgIHdyaXRhYmxlOiB0cnVlLFxuICAgICAgICAgICAgdmFsdWU6ICdIZXguU2l6ZUV4Y2VlZHNQYWRkaW5nU2l6ZUVycm9yJ1xuICAgICAgICB9KTtcbiAgICB9XG59XG4vLyMgc291cmNlTWFwcGluZ1VSTD1IZXguanMubWFwIiwKICAgICJpbXBvcnQgKiBhcyBIZXggZnJvbSAnLi9IZXguanMnO1xuLyoqXG4gKiBDb252ZXJ0cyBhIHtAbGluayBveCNXaXRoZHJhd2FsLlJwY30gdG8gYW4ge0BsaW5rIG94I1dpdGhkcmF3YWwuV2l0aGRyYXdhbH0uXG4gKlxuICogQGV4YW1wbGVcbiAqIGBgYHRzIHR3b3NsYXNoXG4gKiBpbXBvcnQgeyBXaXRoZHJhd2FsIH0gZnJvbSAnb3gnXG4gKlxuICogY29uc3Qgd2l0aGRyYXdhbCA9IFdpdGhkcmF3YWwuZnJvbVJwYyh7XG4gKiAgIGFkZHJlc3M6ICcweDAwMDAwMDAwMjE5YWI1NDAzNTZjQkI4MzlDYmUwNTMwM2Q3NzA1RmEnLFxuICogICBhbW91bnQ6ICcweDYyMDMyMycsXG4gKiAgIGluZGV4OiAnMHgwJyxcbiAqICAgdmFsaWRhdG9ySW5kZXg6ICcweDEnLFxuICogfSlcbiAqIC8vIEBsb2c6IHtcbiAqIC8vIEBsb2c6ICAgYWRkcmVzczogJzB4MDAwMDAwMDAyMTlhYjU0MDM1NmNCQjgzOUNiZTA1MzAzZDc3MDVGYScsXG4gKiAvLyBAbG9nOiAgIGFtb3VudDogNjQyMzMzMW4sXG4gKiAvLyBAbG9nOiAgIGluZGV4OiAwLFxuICogLy8gQGxvZzogICB2YWxpZGF0b3JJbmRleDogMVxuICogLy8gQGxvZzogfVxuICogYGBgXG4gKlxuICogQHBhcmFtIHdpdGhkcmF3YWwgLSBUaGUgUlBDIHdpdGhkcmF3YWwgdG8gY29udmVydC5cbiAqIEByZXR1cm5zIEFuIGluc3RhbnRpYXRlZCB7QGxpbmsgb3gjV2l0aGRyYXdhbC5XaXRoZHJhd2FsfS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGZyb21ScGMod2l0aGRyYXdhbCkge1xuICAgIHJldHVybiB7XG4gICAgICAgIC4uLndpdGhkcmF3YWwsXG4gICAgICAgIGFtb3VudDogQmlnSW50KHdpdGhkcmF3YWwuYW1vdW50KSxcbiAgICAgICAgaW5kZXg6IE51bWJlcih3aXRoZHJhd2FsLmluZGV4KSxcbiAgICAgICAgdmFsaWRhdG9ySW5kZXg6IE51bWJlcih3aXRoZHJhd2FsLnZhbGlkYXRvckluZGV4KSxcbiAgICB9O1xufVxuLyoqXG4gKiBDb252ZXJ0cyBhIHtAbGluayBveCNXaXRoZHJhd2FsLldpdGhkcmF3YWx9IHRvIGFuIHtAbGluayBveCNXaXRoZHJhd2FsLlJwY30uXG4gKlxuICogQGV4YW1wbGVcbiAqIGBgYHRzIHR3b3NsYXNoXG4gKiBpbXBvcnQgeyBXaXRoZHJhd2FsIH0gZnJvbSAnb3gnXG4gKlxuICogY29uc3Qgd2l0aGRyYXdhbCA9IFdpdGhkcmF3YWwudG9ScGMoe1xuICogICBhZGRyZXNzOiAnMHgwMDAwMDAwMDIxOWFiNTQwMzU2Y0JCODM5Q2JlMDUzMDNkNzcwNUZhJyxcbiAqICAgYW1vdW50OiA2NDIzMzMxbixcbiAqICAgaW5kZXg6IDAsXG4gKiAgIHZhbGlkYXRvckluZGV4OiAxLFxuICogfSlcbiAqIC8vIEBsb2c6IHtcbiAqIC8vIEBsb2c6ICAgYWRkcmVzczogJzB4MDAwMDAwMDAyMTlhYjU0MDM1NmNCQjgzOUNiZTA1MzAzZDc3MDVGYScsXG4gKiAvLyBAbG9nOiAgIGFtb3VudDogJzB4NjIwMzIzJyxcbiAqIC8vIEBsb2c6ICAgaW5kZXg6ICcweDAnLFxuICogLy8gQGxvZzogICB2YWxpZGF0b3JJbmRleDogJzB4MScsXG4gKiAvLyBAbG9nOiB9XG4gKiBgYGBcbiAqXG4gKiBAcGFyYW0gd2l0aGRyYXdhbCAtIFRoZSBXaXRoZHJhd2FsIHRvIGNvbnZlcnQuXG4gKiBAcmV0dXJucyBBbiBSUEMgV2l0aGRyYXdhbC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHRvUnBjKHdpdGhkcmF3YWwpIHtcbiAgICByZXR1cm4ge1xuICAgICAgICBhZGRyZXNzOiB3aXRoZHJhd2FsLmFkZHJlc3MsXG4gICAgICAgIGFtb3VudDogSGV4LmZyb21OdW1iZXIod2l0aGRyYXdhbC5hbW91bnQpLFxuICAgICAgICBpbmRleDogSGV4LmZyb21OdW1iZXIod2l0aGRyYXdhbC5pbmRleCksXG4gICAgICAgIHZhbGlkYXRvckluZGV4OiBIZXguZnJvbU51bWJlcih3aXRoZHJhd2FsLnZhbGlkYXRvckluZGV4KSxcbiAgICB9O1xufVxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9V2l0aGRyYXdhbC5qcy5tYXAiLAogICAgImltcG9ydCAqIGFzIEhleCBmcm9tICcuL0hleC5qcyc7XG5pbXBvcnQgKiBhcyBXaXRoZHJhd2FsIGZyb20gJy4vV2l0aGRyYXdhbC5qcyc7XG4vKipcbiAqIENvbnZlcnRzIGFuIHtAbGluayBveCNCbG9ja092ZXJyaWRlcy5ScGN9IHRvIGFuIHtAbGluayBveCNCbG9ja092ZXJyaWRlcy5CbG9ja092ZXJyaWRlc30uXG4gKlxuICogQGV4YW1wbGVcbiAqIGBgYHRzIHR3b3NsYXNoXG4gKiBpbXBvcnQgeyBCbG9ja092ZXJyaWRlcyB9IGZyb20gJ294J1xuICpcbiAqIGNvbnN0IGJsb2NrT3ZlcnJpZGVzID0gQmxvY2tPdmVycmlkZXMuZnJvbVJwYyh7XG4gKiAgIGJhc2VGZWVQZXJHYXM6ICcweDEnLFxuICogICBibG9iQmFzZUZlZTogJzB4MicsXG4gKiAgIGZlZVJlY2lwaWVudDogJzB4MDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMCcsXG4gKiAgIGdhc0xpbWl0OiAnMHg0JyxcbiAqICAgbnVtYmVyOiAnMHg1JyxcbiAqICAgcHJldlJhbmRhbzogJzB4NicsXG4gKiAgIHRpbWU6ICcweDEyMzQ1Njc4OTAnLFxuICogICB3aXRoZHJhd2FsczogW1xuICogICAgIHtcbiAqICAgICAgIGFkZHJlc3M6ICcweDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAnLFxuICogICAgICAgYW1vdW50OiAnMHgxJyxcbiAqICAgICAgIGluZGV4OiAnMHgwJyxcbiAqICAgICAgIHZhbGlkYXRvckluZGV4OiAnMHgxJyxcbiAqICAgICB9LFxuICogICBdLFxuICogfSlcbiAqIGBgYFxuICpcbiAqIEBwYXJhbSBycGNCbG9ja092ZXJyaWRlcyAtIFRoZSBSUEMgYmxvY2sgb3ZlcnJpZGVzIHRvIGNvbnZlcnQuXG4gKiBAcmV0dXJucyBBbiBpbnN0YW50aWF0ZWQge0BsaW5rIG94I0Jsb2NrT3ZlcnJpZGVzLkJsb2NrT3ZlcnJpZGVzfS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGZyb21ScGMocnBjQmxvY2tPdmVycmlkZXMpIHtcbiAgICByZXR1cm4ge1xuICAgICAgICAuLi4ocnBjQmxvY2tPdmVycmlkZXMuYmFzZUZlZVBlckdhcyAmJiB7XG4gICAgICAgICAgICBiYXNlRmVlUGVyR2FzOiBCaWdJbnQocnBjQmxvY2tPdmVycmlkZXMuYmFzZUZlZVBlckdhcyksXG4gICAgICAgIH0pLFxuICAgICAgICAuLi4ocnBjQmxvY2tPdmVycmlkZXMuYmxvYkJhc2VGZWUgJiYge1xuICAgICAgICAgICAgYmxvYkJhc2VGZWU6IEJpZ0ludChycGNCbG9ja092ZXJyaWRlcy5ibG9iQmFzZUZlZSksXG4gICAgICAgIH0pLFxuICAgICAgICAuLi4ocnBjQmxvY2tPdmVycmlkZXMuZmVlUmVjaXBpZW50ICYmIHtcbiAgICAgICAgICAgIGZlZVJlY2lwaWVudDogcnBjQmxvY2tPdmVycmlkZXMuZmVlUmVjaXBpZW50LFxuICAgICAgICB9KSxcbiAgICAgICAgLi4uKHJwY0Jsb2NrT3ZlcnJpZGVzLmdhc0xpbWl0ICYmIHtcbiAgICAgICAgICAgIGdhc0xpbWl0OiBCaWdJbnQocnBjQmxvY2tPdmVycmlkZXMuZ2FzTGltaXQpLFxuICAgICAgICB9KSxcbiAgICAgICAgLi4uKHJwY0Jsb2NrT3ZlcnJpZGVzLm51bWJlciAmJiB7XG4gICAgICAgICAgICBudW1iZXI6IEJpZ0ludChycGNCbG9ja092ZXJyaWRlcy5udW1iZXIpLFxuICAgICAgICB9KSxcbiAgICAgICAgLi4uKHJwY0Jsb2NrT3ZlcnJpZGVzLnByZXZSYW5kYW8gJiYge1xuICAgICAgICAgICAgcHJldlJhbmRhbzogQmlnSW50KHJwY0Jsb2NrT3ZlcnJpZGVzLnByZXZSYW5kYW8pLFxuICAgICAgICB9KSxcbiAgICAgICAgLi4uKHJwY0Jsb2NrT3ZlcnJpZGVzLnRpbWUgJiYge1xuICAgICAgICAgICAgdGltZTogQmlnSW50KHJwY0Jsb2NrT3ZlcnJpZGVzLnRpbWUpLFxuICAgICAgICB9KSxcbiAgICAgICAgLi4uKHJwY0Jsb2NrT3ZlcnJpZGVzLndpdGhkcmF3YWxzICYmIHtcbiAgICAgICAgICAgIHdpdGhkcmF3YWxzOiBycGNCbG9ja092ZXJyaWRlcy53aXRoZHJhd2Fscy5tYXAoV2l0aGRyYXdhbC5mcm9tUnBjKSxcbiAgICAgICAgfSksXG4gICAgfTtcbn1cbi8qKlxuICogQ29udmVydHMgYW4ge0BsaW5rIG94I0Jsb2NrT3ZlcnJpZGVzLkJsb2NrT3ZlcnJpZGVzfSB0byBhbiB7QGxpbmsgb3gjQmxvY2tPdmVycmlkZXMuUnBjfS5cbiAqXG4gKiBAZXhhbXBsZVxuICogYGBgdHMgdHdvc2xhc2hcbiAqIGltcG9ydCB7IEJsb2NrT3ZlcnJpZGVzIH0gZnJvbSAnb3gnXG4gKlxuICogY29uc3QgYmxvY2tPdmVycmlkZXMgPSBCbG9ja092ZXJyaWRlcy50b1JwYyh7XG4gKiAgIGJhc2VGZWVQZXJHYXM6IDFuLFxuICogICBibG9iQmFzZUZlZTogMm4sXG4gKiAgIGZlZVJlY2lwaWVudDogJzB4MDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMCcsXG4gKiAgIGdhc0xpbWl0OiA0bixcbiAqICAgbnVtYmVyOiA1bixcbiAqICAgcHJldlJhbmRhbzogNm4sXG4gKiAgIHRpbWU6IDc4MTg3NDkzNTIwbixcbiAqICAgd2l0aGRyYXdhbHM6IFtcbiAqICAgICB7XG4gKiAgICAgICBhZGRyZXNzOiAnMHgwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwJyxcbiAqICAgICAgIGFtb3VudDogMW4sXG4gKiAgICAgICBpbmRleDogMCxcbiAqICAgICAgIHZhbGlkYXRvckluZGV4OiAxLFxuICogICAgIH0sXG4gKiAgIF0sXG4gKiB9KVxuICogYGBgXG4gKlxuICogQHBhcmFtIGJsb2NrT3ZlcnJpZGVzIC0gVGhlIGJsb2NrIG92ZXJyaWRlcyB0byBjb252ZXJ0LlxuICogQHJldHVybnMgQW4gaW5zdGFudGlhdGVkIHtAbGluayBveCNCbG9ja092ZXJyaWRlcy5ScGN9LlxuICovXG5leHBvcnQgZnVuY3Rpb24gdG9ScGMoYmxvY2tPdmVycmlkZXMpIHtcbiAgICByZXR1cm4ge1xuICAgICAgICAuLi4odHlwZW9mIGJsb2NrT3ZlcnJpZGVzLmJhc2VGZWVQZXJHYXMgPT09ICdiaWdpbnQnICYmIHtcbiAgICAgICAgICAgIGJhc2VGZWVQZXJHYXM6IEhleC5mcm9tTnVtYmVyKGJsb2NrT3ZlcnJpZGVzLmJhc2VGZWVQZXJHYXMpLFxuICAgICAgICB9KSxcbiAgICAgICAgLi4uKHR5cGVvZiBibG9ja092ZXJyaWRlcy5ibG9iQmFzZUZlZSA9PT0gJ2JpZ2ludCcgJiYge1xuICAgICAgICAgICAgYmxvYkJhc2VGZWU6IEhleC5mcm9tTnVtYmVyKGJsb2NrT3ZlcnJpZGVzLmJsb2JCYXNlRmVlKSxcbiAgICAgICAgfSksXG4gICAgICAgIC4uLih0eXBlb2YgYmxvY2tPdmVycmlkZXMuZmVlUmVjaXBpZW50ID09PSAnc3RyaW5nJyAmJiB7XG4gICAgICAgICAgICBmZWVSZWNpcGllbnQ6IGJsb2NrT3ZlcnJpZGVzLmZlZVJlY2lwaWVudCxcbiAgICAgICAgfSksXG4gICAgICAgIC4uLih0eXBlb2YgYmxvY2tPdmVycmlkZXMuZ2FzTGltaXQgPT09ICdiaWdpbnQnICYmIHtcbiAgICAgICAgICAgIGdhc0xpbWl0OiBIZXguZnJvbU51bWJlcihibG9ja092ZXJyaWRlcy5nYXNMaW1pdCksXG4gICAgICAgIH0pLFxuICAgICAgICAuLi4odHlwZW9mIGJsb2NrT3ZlcnJpZGVzLm51bWJlciA9PT0gJ2JpZ2ludCcgJiYge1xuICAgICAgICAgICAgbnVtYmVyOiBIZXguZnJvbU51bWJlcihibG9ja092ZXJyaWRlcy5udW1iZXIpLFxuICAgICAgICB9KSxcbiAgICAgICAgLi4uKHR5cGVvZiBibG9ja092ZXJyaWRlcy5wcmV2UmFuZGFvID09PSAnYmlnaW50JyAmJiB7XG4gICAgICAgICAgICBwcmV2UmFuZGFvOiBIZXguZnJvbU51bWJlcihibG9ja092ZXJyaWRlcy5wcmV2UmFuZGFvKSxcbiAgICAgICAgfSksXG4gICAgICAgIC4uLih0eXBlb2YgYmxvY2tPdmVycmlkZXMudGltZSA9PT0gJ2JpZ2ludCcgJiYge1xuICAgICAgICAgICAgdGltZTogSGV4LmZyb21OdW1iZXIoYmxvY2tPdmVycmlkZXMudGltZSksXG4gICAgICAgIH0pLFxuICAgICAgICAuLi4oYmxvY2tPdmVycmlkZXMud2l0aGRyYXdhbHMgJiYge1xuICAgICAgICAgICAgd2l0aGRyYXdhbHM6IGJsb2NrT3ZlcnJpZGVzLndpdGhkcmF3YWxzLm1hcChXaXRoZHJhd2FsLnRvUnBjKSxcbiAgICAgICAgfSksXG4gICAgfTtcbn1cbi8vIyBzb3VyY2VNYXBwaW5nVVJMPUJsb2NrT3ZlcnJpZGVzLmpzLm1hcCIsCiAgICAiZXhwb3J0IGZ1bmN0aW9uIHBhcnNlQWNjb3VudChhY2NvdW50KSB7XG4gICAgaWYgKHR5cGVvZiBhY2NvdW50ID09PSAnc3RyaW5nJylcbiAgICAgICAgcmV0dXJuIHsgYWRkcmVzczogYWNjb3VudCwgdHlwZTogJ2pzb24tcnBjJyB9O1xuICAgIHJldHVybiBhY2NvdW50O1xufVxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9cGFyc2VBY2NvdW50LmpzLm1hcCIsCiAgICAiLyogW011bHRpY2FsbDNdKGh0dHBzOi8vZ2l0aHViLmNvbS9tZHMxL211bHRpY2FsbCkgKi9cbmV4cG9ydCBjb25zdCBtdWx0aWNhbGwzQWJpID0gW1xuICAgIHtcbiAgICAgICAgaW5wdXRzOiBbXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgY29tcG9uZW50czogW1xuICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICBuYW1lOiAndGFyZ2V0JyxcbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6ICdhZGRyZXNzJyxcbiAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICAgbmFtZTogJ2FsbG93RmFpbHVyZScsXG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAnYm9vbCcsXG4gICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG5hbWU6ICdjYWxsRGF0YScsXG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAnYnl0ZXMnLFxuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICAgICAgbmFtZTogJ2NhbGxzJyxcbiAgICAgICAgICAgICAgICB0eXBlOiAndHVwbGVbXScsXG4gICAgICAgICAgICB9LFxuICAgICAgICBdLFxuICAgICAgICBuYW1lOiAnYWdncmVnYXRlMycsXG4gICAgICAgIG91dHB1dHM6IFtcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBjb21wb25lbnRzOiBbXG4gICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG5hbWU6ICdzdWNjZXNzJyxcbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6ICdib29sJyxcbiAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICAgbmFtZTogJ3JldHVybkRhdGEnLFxuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogJ2J5dGVzJyxcbiAgICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgICAgIG5hbWU6ICdyZXR1cm5EYXRhJyxcbiAgICAgICAgICAgICAgICB0eXBlOiAndHVwbGVbXScsXG4gICAgICAgICAgICB9LFxuICAgICAgICBdLFxuICAgICAgICBzdGF0ZU11dGFiaWxpdHk6ICd2aWV3JyxcbiAgICAgICAgdHlwZTogJ2Z1bmN0aW9uJyxcbiAgICB9LFxuICAgIHtcbiAgICAgICAgaW5wdXRzOiBbXSxcbiAgICAgICAgbmFtZTogJ2dldEN1cnJlbnRCbG9ja1RpbWVzdGFtcCcsXG4gICAgICAgIG91dHB1dHM6IFtcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBpbnRlcm5hbFR5cGU6ICd1aW50MjU2JyxcbiAgICAgICAgICAgICAgICBuYW1lOiAndGltZXN0YW1wJyxcbiAgICAgICAgICAgICAgICB0eXBlOiAndWludDI1NicsXG4gICAgICAgICAgICB9LFxuICAgICAgICBdLFxuICAgICAgICBzdGF0ZU11dGFiaWxpdHk6ICd2aWV3JyxcbiAgICAgICAgdHlwZTogJ2Z1bmN0aW9uJyxcbiAgICB9LFxuXTtcbmV4cG9ydCBjb25zdCBiYXRjaEdhdGV3YXlBYmkgPSBbXG4gICAge1xuICAgICAgICBuYW1lOiAncXVlcnknLFxuICAgICAgICB0eXBlOiAnZnVuY3Rpb24nLFxuICAgICAgICBzdGF0ZU11dGFiaWxpdHk6ICd2aWV3JyxcbiAgICAgICAgaW5wdXRzOiBbXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3R1cGxlW10nLFxuICAgICAgICAgICAgICAgIG5hbWU6ICdxdWVyaWVzJyxcbiAgICAgICAgICAgICAgICBjb21wb25lbnRzOiBbXG4gICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6ICdhZGRyZXNzJyxcbiAgICAgICAgICAgICAgICAgICAgICAgIG5hbWU6ICdzZW5kZXInLFxuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nW10nLFxuICAgICAgICAgICAgICAgICAgICAgICAgbmFtZTogJ3VybHMnLFxuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAnYnl0ZXMnLFxuICAgICAgICAgICAgICAgICAgICAgICAgbmFtZTogJ2RhdGEnLFxuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICB9LFxuICAgICAgICBdLFxuICAgICAgICBvdXRwdXRzOiBbXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ2Jvb2xbXScsXG4gICAgICAgICAgICAgICAgbmFtZTogJ2ZhaWx1cmVzJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ2J5dGVzW10nLFxuICAgICAgICAgICAgICAgIG5hbWU6ICdyZXNwb25zZXMnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgXSxcbiAgICB9LFxuICAgIHtcbiAgICAgICAgbmFtZTogJ0h0dHBFcnJvcicsXG4gICAgICAgIHR5cGU6ICdlcnJvcicsXG4gICAgICAgIGlucHV0czogW1xuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIHR5cGU6ICd1aW50MTYnLFxuICAgICAgICAgICAgICAgIG5hbWU6ICdzdGF0dXMnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICBuYW1lOiAnbWVzc2FnZScsXG4gICAgICAgICAgICB9LFxuICAgICAgICBdLFxuICAgIH0sXG5dO1xuY29uc3QgdW5pdmVyc2FsUmVzb2x2ZXJFcnJvcnMgPSBbXG4gICAge1xuICAgICAgICBpbnB1dHM6IFtcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBuYW1lOiAnZG5zJyxcbiAgICAgICAgICAgICAgICB0eXBlOiAnYnl0ZXMnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgXSxcbiAgICAgICAgbmFtZTogJ0ROU0RlY29kaW5nRmFpbGVkJyxcbiAgICAgICAgdHlwZTogJ2Vycm9yJyxcbiAgICB9LFxuICAgIHtcbiAgICAgICAgaW5wdXRzOiBbXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgbmFtZTogJ2VucycsXG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICB9LFxuICAgICAgICBdLFxuICAgICAgICBuYW1lOiAnRE5TRW5jb2RpbmdGYWlsZWQnLFxuICAgICAgICB0eXBlOiAnZXJyb3InLFxuICAgIH0sXG4gICAge1xuICAgICAgICBpbnB1dHM6IFtdLFxuICAgICAgICBuYW1lOiAnRW1wdHlBZGRyZXNzJyxcbiAgICAgICAgdHlwZTogJ2Vycm9yJyxcbiAgICB9LFxuICAgIHtcbiAgICAgICAgaW5wdXRzOiBbXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgbmFtZTogJ3N0YXR1cycsXG4gICAgICAgICAgICAgICAgdHlwZTogJ3VpbnQxNicsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIG5hbWU6ICdtZXNzYWdlJyxcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgIF0sXG4gICAgICAgIG5hbWU6ICdIdHRwRXJyb3InLFxuICAgICAgICB0eXBlOiAnZXJyb3InLFxuICAgIH0sXG4gICAge1xuICAgICAgICBpbnB1dHM6IFtdLFxuICAgICAgICBuYW1lOiAnSW52YWxpZEJhdGNoR2F0ZXdheVJlc3BvbnNlJyxcbiAgICAgICAgdHlwZTogJ2Vycm9yJyxcbiAgICB9LFxuICAgIHtcbiAgICAgICAgaW5wdXRzOiBbXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgbmFtZTogJ2Vycm9yRGF0YScsXG4gICAgICAgICAgICAgICAgdHlwZTogJ2J5dGVzJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgIF0sXG4gICAgICAgIG5hbWU6ICdSZXNvbHZlckVycm9yJyxcbiAgICAgICAgdHlwZTogJ2Vycm9yJyxcbiAgICB9LFxuICAgIHtcbiAgICAgICAgaW5wdXRzOiBbXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgbmFtZTogJ25hbWUnLFxuICAgICAgICAgICAgICAgIHR5cGU6ICdieXRlcycsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIG5hbWU6ICdyZXNvbHZlcicsXG4gICAgICAgICAgICAgICAgdHlwZTogJ2FkZHJlc3MnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgXSxcbiAgICAgICAgbmFtZTogJ1Jlc29sdmVyTm90Q29udHJhY3QnLFxuICAgICAgICB0eXBlOiAnZXJyb3InLFxuICAgIH0sXG4gICAge1xuICAgICAgICBpbnB1dHM6IFtcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBuYW1lOiAnbmFtZScsXG4gICAgICAgICAgICAgICAgdHlwZTogJ2J5dGVzJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgIF0sXG4gICAgICAgIG5hbWU6ICdSZXNvbHZlck5vdEZvdW5kJyxcbiAgICAgICAgdHlwZTogJ2Vycm9yJyxcbiAgICB9LFxuICAgIHtcbiAgICAgICAgaW5wdXRzOiBbXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgbmFtZTogJ3ByaW1hcnknLFxuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBuYW1lOiAncHJpbWFyeUFkZHJlc3MnLFxuICAgICAgICAgICAgICAgIHR5cGU6ICdieXRlcycsXG4gICAgICAgICAgICB9LFxuICAgICAgICBdLFxuICAgICAgICBuYW1lOiAnUmV2ZXJzZUFkZHJlc3NNaXNtYXRjaCcsXG4gICAgICAgIHR5cGU6ICdlcnJvcicsXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGlucHV0czogW1xuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGludGVybmFsVHlwZTogJ2J5dGVzNCcsXG4gICAgICAgICAgICAgICAgbmFtZTogJ3NlbGVjdG9yJyxcbiAgICAgICAgICAgICAgICB0eXBlOiAnYnl0ZXM0JyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgIF0sXG4gICAgICAgIG5hbWU6ICdVbnN1cHBvcnRlZFJlc29sdmVyUHJvZmlsZScsXG4gICAgICAgIHR5cGU6ICdlcnJvcicsXG4gICAgfSxcbl07XG5leHBvcnQgY29uc3QgdW5pdmVyc2FsUmVzb2x2ZXJSZXNvbHZlQWJpID0gW1xuICAgIC4uLnVuaXZlcnNhbFJlc29sdmVyRXJyb3JzLFxuICAgIHtcbiAgICAgICAgbmFtZTogJ3Jlc29sdmVXaXRoR2F0ZXdheXMnLFxuICAgICAgICB0eXBlOiAnZnVuY3Rpb24nLFxuICAgICAgICBzdGF0ZU11dGFiaWxpdHk6ICd2aWV3JyxcbiAgICAgICAgaW5wdXRzOiBbXG4gICAgICAgICAgICB7IG5hbWU6ICduYW1lJywgdHlwZTogJ2J5dGVzJyB9LFxuICAgICAgICAgICAgeyBuYW1lOiAnZGF0YScsIHR5cGU6ICdieXRlcycgfSxcbiAgICAgICAgICAgIHsgbmFtZTogJ2dhdGV3YXlzJywgdHlwZTogJ3N0cmluZ1tdJyB9LFxuICAgICAgICBdLFxuICAgICAgICBvdXRwdXRzOiBbXG4gICAgICAgICAgICB7IG5hbWU6ICcnLCB0eXBlOiAnYnl0ZXMnIH0sXG4gICAgICAgICAgICB7IG5hbWU6ICdhZGRyZXNzJywgdHlwZTogJ2FkZHJlc3MnIH0sXG4gICAgICAgIF0sXG4gICAgfSxcbl07XG5leHBvcnQgY29uc3QgdW5pdmVyc2FsUmVzb2x2ZXJSZXZlcnNlQWJpID0gW1xuICAgIC4uLnVuaXZlcnNhbFJlc29sdmVyRXJyb3JzLFxuICAgIHtcbiAgICAgICAgbmFtZTogJ3JldmVyc2VXaXRoR2F0ZXdheXMnLFxuICAgICAgICB0eXBlOiAnZnVuY3Rpb24nLFxuICAgICAgICBzdGF0ZU11dGFiaWxpdHk6ICd2aWV3JyxcbiAgICAgICAgaW5wdXRzOiBbXG4gICAgICAgICAgICB7IHR5cGU6ICdieXRlcycsIG5hbWU6ICdyZXZlcnNlTmFtZScgfSxcbiAgICAgICAgICAgIHsgdHlwZTogJ3VpbnQyNTYnLCBuYW1lOiAnY29pblR5cGUnIH0sXG4gICAgICAgICAgICB7IHR5cGU6ICdzdHJpbmdbXScsIG5hbWU6ICdnYXRld2F5cycgfSxcbiAgICAgICAgXSxcbiAgICAgICAgb3V0cHV0czogW1xuICAgICAgICAgICAgeyB0eXBlOiAnc3RyaW5nJywgbmFtZTogJ3Jlc29sdmVkTmFtZScgfSxcbiAgICAgICAgICAgIHsgdHlwZTogJ2FkZHJlc3MnLCBuYW1lOiAncmVzb2x2ZXInIH0sXG4gICAgICAgICAgICB7IHR5cGU6ICdhZGRyZXNzJywgbmFtZTogJ3JldmVyc2VSZXNvbHZlcicgfSxcbiAgICAgICAgXSxcbiAgICB9LFxuXTtcbmV4cG9ydCBjb25zdCB0ZXh0UmVzb2x2ZXJBYmkgPSBbXG4gICAge1xuICAgICAgICBuYW1lOiAndGV4dCcsXG4gICAgICAgIHR5cGU6ICdmdW5jdGlvbicsXG4gICAgICAgIHN0YXRlTXV0YWJpbGl0eTogJ3ZpZXcnLFxuICAgICAgICBpbnB1dHM6IFtcbiAgICAgICAgICAgIHsgbmFtZTogJ25hbWUnLCB0eXBlOiAnYnl0ZXMzMicgfSxcbiAgICAgICAgICAgIHsgbmFtZTogJ2tleScsIHR5cGU6ICdzdHJpbmcnIH0sXG4gICAgICAgIF0sXG4gICAgICAgIG91dHB1dHM6IFt7IG5hbWU6ICcnLCB0eXBlOiAnc3RyaW5nJyB9XSxcbiAgICB9LFxuXTtcbmV4cG9ydCBjb25zdCBhZGRyZXNzUmVzb2x2ZXJBYmkgPSBbXG4gICAge1xuICAgICAgICBuYW1lOiAnYWRkcicsXG4gICAgICAgIHR5cGU6ICdmdW5jdGlvbicsXG4gICAgICAgIHN0YXRlTXV0YWJpbGl0eTogJ3ZpZXcnLFxuICAgICAgICBpbnB1dHM6IFt7IG5hbWU6ICduYW1lJywgdHlwZTogJ2J5dGVzMzInIH1dLFxuICAgICAgICBvdXRwdXRzOiBbeyBuYW1lOiAnJywgdHlwZTogJ2FkZHJlc3MnIH1dLFxuICAgIH0sXG4gICAge1xuICAgICAgICBuYW1lOiAnYWRkcicsXG4gICAgICAgIHR5cGU6ICdmdW5jdGlvbicsXG4gICAgICAgIHN0YXRlTXV0YWJpbGl0eTogJ3ZpZXcnLFxuICAgICAgICBpbnB1dHM6IFtcbiAgICAgICAgICAgIHsgbmFtZTogJ25hbWUnLCB0eXBlOiAnYnl0ZXMzMicgfSxcbiAgICAgICAgICAgIHsgbmFtZTogJ2NvaW5UeXBlJywgdHlwZTogJ3VpbnQyNTYnIH0sXG4gICAgICAgIF0sXG4gICAgICAgIG91dHB1dHM6IFt7IG5hbWU6ICcnLCB0eXBlOiAnYnl0ZXMnIH1dLFxuICAgIH0sXG5dO1xuLy8gRVJDLTEyNzFcbi8vIGlzVmFsaWRTaWduYXR1cmUoYnl0ZXMzMiBoYXNoLCBieXRlcyBzaWduYXR1cmUpIOKGkiBieXRlczQgbWFnaWNWYWx1ZVxuLyoqIEBpbnRlcm5hbCAqL1xuZXhwb3J0IGNvbnN0IGVyYzEyNzFBYmkgPSBbXG4gICAge1xuICAgICAgICBuYW1lOiAnaXNWYWxpZFNpZ25hdHVyZScsXG4gICAgICAgIHR5cGU6ICdmdW5jdGlvbicsXG4gICAgICAgIHN0YXRlTXV0YWJpbGl0eTogJ3ZpZXcnLFxuICAgICAgICBpbnB1dHM6IFtcbiAgICAgICAgICAgIHsgbmFtZTogJ2hhc2gnLCB0eXBlOiAnYnl0ZXMzMicgfSxcbiAgICAgICAgICAgIHsgbmFtZTogJ3NpZ25hdHVyZScsIHR5cGU6ICdieXRlcycgfSxcbiAgICAgICAgXSxcbiAgICAgICAgb3V0cHV0czogW3sgbmFtZTogJycsIHR5cGU6ICdieXRlczQnIH1dLFxuICAgIH0sXG5dO1xuLy8gRVJDLTY0OTIgLSB1bml2ZXJzYWwgZGVwbG95bGVzcyBzaWduYXR1cmUgdmFsaWRhdG9yIGNvbnRyYWN0XG4vLyBjb25zdHJ1Y3RvcihhZGRyZXNzIF9zaWduZXIsIGJ5dGVzMzIgX2hhc2gsIGJ5dGVzIF9zaWduYXR1cmUpIOKGkiBieXRlczQgcmV0dXJuVmFsdWVcbi8vIHJldHVyblZhbHVlIGlzIGVpdGhlciAweDEgKHZhbGlkKSBvciAweDAgKGludmFsaWQpXG5leHBvcnQgY29uc3QgZXJjNjQ5MlNpZ25hdHVyZVZhbGlkYXRvckFiaSA9IFtcbiAgICB7XG4gICAgICAgIGlucHV0czogW1xuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIG5hbWU6ICdfc2lnbmVyJyxcbiAgICAgICAgICAgICAgICB0eXBlOiAnYWRkcmVzcycsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIG5hbWU6ICdfaGFzaCcsXG4gICAgICAgICAgICAgICAgdHlwZTogJ2J5dGVzMzInLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBuYW1lOiAnX3NpZ25hdHVyZScsXG4gICAgICAgICAgICAgICAgdHlwZTogJ2J5dGVzJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgIF0sXG4gICAgICAgIHN0YXRlTXV0YWJpbGl0eTogJ25vbnBheWFibGUnLFxuICAgICAgICB0eXBlOiAnY29uc3RydWN0b3InLFxuICAgIH0sXG4gICAge1xuICAgICAgICBpbnB1dHM6IFtcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBuYW1lOiAnX3NpZ25lcicsXG4gICAgICAgICAgICAgICAgdHlwZTogJ2FkZHJlc3MnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBuYW1lOiAnX2hhc2gnLFxuICAgICAgICAgICAgICAgIHR5cGU6ICdieXRlczMyJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgbmFtZTogJ19zaWduYXR1cmUnLFxuICAgICAgICAgICAgICAgIHR5cGU6ICdieXRlcycsXG4gICAgICAgICAgICB9LFxuICAgICAgICBdLFxuICAgICAgICBvdXRwdXRzOiBbXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ2Jvb2wnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgXSxcbiAgICAgICAgc3RhdGVNdXRhYmlsaXR5OiAnbm9ucGF5YWJsZScsXG4gICAgICAgIHR5cGU6ICdmdW5jdGlvbicsXG4gICAgICAgIG5hbWU6ICdpc1ZhbGlkU2lnJyxcbiAgICB9LFxuXTtcbi8qKiBbRVJDLTIwIFRva2VuIFN0YW5kYXJkXShodHRwczovL2V0aGVyZXVtLm9yZy9lbi9kZXZlbG9wZXJzL2RvY3Mvc3RhbmRhcmRzL3Rva2Vucy9lcmMtMjApICovXG5leHBvcnQgY29uc3QgZXJjMjBBYmkgPSBbXG4gICAge1xuICAgICAgICB0eXBlOiAnZXZlbnQnLFxuICAgICAgICBuYW1lOiAnQXBwcm92YWwnLFxuICAgICAgICBpbnB1dHM6IFtcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBpbmRleGVkOiB0cnVlLFxuICAgICAgICAgICAgICAgIG5hbWU6ICdvd25lcicsXG4gICAgICAgICAgICAgICAgdHlwZTogJ2FkZHJlc3MnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBpbmRleGVkOiB0cnVlLFxuICAgICAgICAgICAgICAgIG5hbWU6ICdzcGVuZGVyJyxcbiAgICAgICAgICAgICAgICB0eXBlOiAnYWRkcmVzcycsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGluZGV4ZWQ6IGZhbHNlLFxuICAgICAgICAgICAgICAgIG5hbWU6ICd2YWx1ZScsXG4gICAgICAgICAgICAgICAgdHlwZTogJ3VpbnQyNTYnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgXSxcbiAgICB9LFxuICAgIHtcbiAgICAgICAgdHlwZTogJ2V2ZW50JyxcbiAgICAgICAgbmFtZTogJ1RyYW5zZmVyJyxcbiAgICAgICAgaW5wdXRzOiBbXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgaW5kZXhlZDogdHJ1ZSxcbiAgICAgICAgICAgICAgICBuYW1lOiAnZnJvbScsXG4gICAgICAgICAgICAgICAgdHlwZTogJ2FkZHJlc3MnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBpbmRleGVkOiB0cnVlLFxuICAgICAgICAgICAgICAgIG5hbWU6ICd0bycsXG4gICAgICAgICAgICAgICAgdHlwZTogJ2FkZHJlc3MnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBpbmRleGVkOiBmYWxzZSxcbiAgICAgICAgICAgICAgICBuYW1lOiAndmFsdWUnLFxuICAgICAgICAgICAgICAgIHR5cGU6ICd1aW50MjU2JyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgIF0sXG4gICAgfSxcbiAgICB7XG4gICAgICAgIHR5cGU6ICdmdW5jdGlvbicsXG4gICAgICAgIG5hbWU6ICdhbGxvd2FuY2UnLFxuICAgICAgICBzdGF0ZU11dGFiaWxpdHk6ICd2aWV3JyxcbiAgICAgICAgaW5wdXRzOiBbXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgbmFtZTogJ293bmVyJyxcbiAgICAgICAgICAgICAgICB0eXBlOiAnYWRkcmVzcycsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIG5hbWU6ICdzcGVuZGVyJyxcbiAgICAgICAgICAgICAgICB0eXBlOiAnYWRkcmVzcycsXG4gICAgICAgICAgICB9LFxuICAgICAgICBdLFxuICAgICAgICBvdXRwdXRzOiBbXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3VpbnQyNTYnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgXSxcbiAgICB9LFxuICAgIHtcbiAgICAgICAgdHlwZTogJ2Z1bmN0aW9uJyxcbiAgICAgICAgbmFtZTogJ2FwcHJvdmUnLFxuICAgICAgICBzdGF0ZU11dGFiaWxpdHk6ICdub25wYXlhYmxlJyxcbiAgICAgICAgaW5wdXRzOiBbXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgbmFtZTogJ3NwZW5kZXInLFxuICAgICAgICAgICAgICAgIHR5cGU6ICdhZGRyZXNzJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgbmFtZTogJ2Ftb3VudCcsXG4gICAgICAgICAgICAgICAgdHlwZTogJ3VpbnQyNTYnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgXSxcbiAgICAgICAgb3V0cHV0czogW1xuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdib29sJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgIF0sXG4gICAgfSxcbiAgICB7XG4gICAgICAgIHR5cGU6ICdmdW5jdGlvbicsXG4gICAgICAgIG5hbWU6ICdiYWxhbmNlT2YnLFxuICAgICAgICBzdGF0ZU11dGFiaWxpdHk6ICd2aWV3JyxcbiAgICAgICAgaW5wdXRzOiBbXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgbmFtZTogJ2FjY291bnQnLFxuICAgICAgICAgICAgICAgIHR5cGU6ICdhZGRyZXNzJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgIF0sXG4gICAgICAgIG91dHB1dHM6IFtcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICB0eXBlOiAndWludDI1NicsXG4gICAgICAgICAgICB9LFxuICAgICAgICBdLFxuICAgIH0sXG4gICAge1xuICAgICAgICB0eXBlOiAnZnVuY3Rpb24nLFxuICAgICAgICBuYW1lOiAnZGVjaW1hbHMnLFxuICAgICAgICBzdGF0ZU11dGFiaWxpdHk6ICd2aWV3JyxcbiAgICAgICAgaW5wdXRzOiBbXSxcbiAgICAgICAgb3V0cHV0czogW1xuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIHR5cGU6ICd1aW50OCcsXG4gICAgICAgICAgICB9LFxuICAgICAgICBdLFxuICAgIH0sXG4gICAge1xuICAgICAgICB0eXBlOiAnZnVuY3Rpb24nLFxuICAgICAgICBuYW1lOiAnbmFtZScsXG4gICAgICAgIHN0YXRlTXV0YWJpbGl0eTogJ3ZpZXcnLFxuICAgICAgICBpbnB1dHM6IFtdLFxuICAgICAgICBvdXRwdXRzOiBbXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICB9LFxuICAgICAgICBdLFxuICAgIH0sXG4gICAge1xuICAgICAgICB0eXBlOiAnZnVuY3Rpb24nLFxuICAgICAgICBuYW1lOiAnc3ltYm9sJyxcbiAgICAgICAgc3RhdGVNdXRhYmlsaXR5OiAndmlldycsXG4gICAgICAgIGlucHV0czogW10sXG4gICAgICAgIG91dHB1dHM6IFtcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgIF0sXG4gICAgfSxcbiAgICB7XG4gICAgICAgIHR5cGU6ICdmdW5jdGlvbicsXG4gICAgICAgIG5hbWU6ICd0b3RhbFN1cHBseScsXG4gICAgICAgIHN0YXRlTXV0YWJpbGl0eTogJ3ZpZXcnLFxuICAgICAgICBpbnB1dHM6IFtdLFxuICAgICAgICBvdXRwdXRzOiBbXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3VpbnQyNTYnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgXSxcbiAgICB9LFxuICAgIHtcbiAgICAgICAgdHlwZTogJ2Z1bmN0aW9uJyxcbiAgICAgICAgbmFtZTogJ3RyYW5zZmVyJyxcbiAgICAgICAgc3RhdGVNdXRhYmlsaXR5OiAnbm9ucGF5YWJsZScsXG4gICAgICAgIGlucHV0czogW1xuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIG5hbWU6ICdyZWNpcGllbnQnLFxuICAgICAgICAgICAgICAgIHR5cGU6ICdhZGRyZXNzJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgbmFtZTogJ2Ftb3VudCcsXG4gICAgICAgICAgICAgICAgdHlwZTogJ3VpbnQyNTYnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgXSxcbiAgICAgICAgb3V0cHV0czogW1xuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdib29sJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgIF0sXG4gICAgfSxcbiAgICB7XG4gICAgICAgIHR5cGU6ICdmdW5jdGlvbicsXG4gICAgICAgIG5hbWU6ICd0cmFuc2ZlckZyb20nLFxuICAgICAgICBzdGF0ZU11dGFiaWxpdHk6ICdub25wYXlhYmxlJyxcbiAgICAgICAgaW5wdXRzOiBbXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgbmFtZTogJ3NlbmRlcicsXG4gICAgICAgICAgICAgICAgdHlwZTogJ2FkZHJlc3MnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBuYW1lOiAncmVjaXBpZW50JyxcbiAgICAgICAgICAgICAgICB0eXBlOiAnYWRkcmVzcycsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIG5hbWU6ICdhbW91bnQnLFxuICAgICAgICAgICAgICAgIHR5cGU6ICd1aW50MjU2JyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgIF0sXG4gICAgICAgIG91dHB1dHM6IFtcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnYm9vbCcsXG4gICAgICAgICAgICB9LFxuICAgICAgICBdLFxuICAgIH0sXG5dO1xuLyoqXG4gKiBbYnl0ZXMzMi1mbGF2b3JlZCBFUkMtMjBdKGh0dHBzOi8vZG9jcy5tYWtlcmRhby5jb20vc21hcnQtY29udHJhY3QtbW9kdWxlcy9ta3ItbW9kdWxlIzQuLWdvdGNoYXMtcG90ZW50aWFsLXNvdXJjZS1vZi11c2VyLWVycm9yKVxuICogZm9yIHRva2VucyAoaWUuIE1ha2VyKSB0aGF0IHVzZSBieXRlczMyIGluc3RlYWQgb2Ygc3RyaW5nLlxuICovXG5leHBvcnQgY29uc3QgZXJjMjBBYmlfYnl0ZXMzMiA9IFtcbiAgICB7XG4gICAgICAgIHR5cGU6ICdldmVudCcsXG4gICAgICAgIG5hbWU6ICdBcHByb3ZhbCcsXG4gICAgICAgIGlucHV0czogW1xuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGluZGV4ZWQ6IHRydWUsXG4gICAgICAgICAgICAgICAgbmFtZTogJ293bmVyJyxcbiAgICAgICAgICAgICAgICB0eXBlOiAnYWRkcmVzcycsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGluZGV4ZWQ6IHRydWUsXG4gICAgICAgICAgICAgICAgbmFtZTogJ3NwZW5kZXInLFxuICAgICAgICAgICAgICAgIHR5cGU6ICdhZGRyZXNzJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgaW5kZXhlZDogZmFsc2UsXG4gICAgICAgICAgICAgICAgbmFtZTogJ3ZhbHVlJyxcbiAgICAgICAgICAgICAgICB0eXBlOiAndWludDI1NicsXG4gICAgICAgICAgICB9LFxuICAgICAgICBdLFxuICAgIH0sXG4gICAge1xuICAgICAgICB0eXBlOiAnZXZlbnQnLFxuICAgICAgICBuYW1lOiAnVHJhbnNmZXInLFxuICAgICAgICBpbnB1dHM6IFtcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBpbmRleGVkOiB0cnVlLFxuICAgICAgICAgICAgICAgIG5hbWU6ICdmcm9tJyxcbiAgICAgICAgICAgICAgICB0eXBlOiAnYWRkcmVzcycsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGluZGV4ZWQ6IHRydWUsXG4gICAgICAgICAgICAgICAgbmFtZTogJ3RvJyxcbiAgICAgICAgICAgICAgICB0eXBlOiAnYWRkcmVzcycsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGluZGV4ZWQ6IGZhbHNlLFxuICAgICAgICAgICAgICAgIG5hbWU6ICd2YWx1ZScsXG4gICAgICAgICAgICAgICAgdHlwZTogJ3VpbnQyNTYnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgXSxcbiAgICB9LFxuICAgIHtcbiAgICAgICAgdHlwZTogJ2Z1bmN0aW9uJyxcbiAgICAgICAgbmFtZTogJ2FsbG93YW5jZScsXG4gICAgICAgIHN0YXRlTXV0YWJpbGl0eTogJ3ZpZXcnLFxuICAgICAgICBpbnB1dHM6IFtcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBuYW1lOiAnb3duZXInLFxuICAgICAgICAgICAgICAgIHR5cGU6ICdhZGRyZXNzJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgbmFtZTogJ3NwZW5kZXInLFxuICAgICAgICAgICAgICAgIHR5cGU6ICdhZGRyZXNzJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgIF0sXG4gICAgICAgIG91dHB1dHM6IFtcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICB0eXBlOiAndWludDI1NicsXG4gICAgICAgICAgICB9LFxuICAgICAgICBdLFxuICAgIH0sXG4gICAge1xuICAgICAgICB0eXBlOiAnZnVuY3Rpb24nLFxuICAgICAgICBuYW1lOiAnYXBwcm92ZScsXG4gICAgICAgIHN0YXRlTXV0YWJpbGl0eTogJ25vbnBheWFibGUnLFxuICAgICAgICBpbnB1dHM6IFtcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBuYW1lOiAnc3BlbmRlcicsXG4gICAgICAgICAgICAgICAgdHlwZTogJ2FkZHJlc3MnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBuYW1lOiAnYW1vdW50JyxcbiAgICAgICAgICAgICAgICB0eXBlOiAndWludDI1NicsXG4gICAgICAgICAgICB9LFxuICAgICAgICBdLFxuICAgICAgICBvdXRwdXRzOiBbXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ2Jvb2wnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgXSxcbiAgICB9LFxuICAgIHtcbiAgICAgICAgdHlwZTogJ2Z1bmN0aW9uJyxcbiAgICAgICAgbmFtZTogJ2JhbGFuY2VPZicsXG4gICAgICAgIHN0YXRlTXV0YWJpbGl0eTogJ3ZpZXcnLFxuICAgICAgICBpbnB1dHM6IFtcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBuYW1lOiAnYWNjb3VudCcsXG4gICAgICAgICAgICAgICAgdHlwZTogJ2FkZHJlc3MnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgXSxcbiAgICAgICAgb3V0cHV0czogW1xuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIHR5cGU6ICd1aW50MjU2JyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgIF0sXG4gICAgfSxcbiAgICB7XG4gICAgICAgIHR5cGU6ICdmdW5jdGlvbicsXG4gICAgICAgIG5hbWU6ICdkZWNpbWFscycsXG4gICAgICAgIHN0YXRlTXV0YWJpbGl0eTogJ3ZpZXcnLFxuICAgICAgICBpbnB1dHM6IFtdLFxuICAgICAgICBvdXRwdXRzOiBbXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3VpbnQ4JyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgIF0sXG4gICAgfSxcbiAgICB7XG4gICAgICAgIHR5cGU6ICdmdW5jdGlvbicsXG4gICAgICAgIG5hbWU6ICduYW1lJyxcbiAgICAgICAgc3RhdGVNdXRhYmlsaXR5OiAndmlldycsXG4gICAgICAgIGlucHV0czogW10sXG4gICAgICAgIG91dHB1dHM6IFtcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnYnl0ZXMzMicsXG4gICAgICAgICAgICB9LFxuICAgICAgICBdLFxuICAgIH0sXG4gICAge1xuICAgICAgICB0eXBlOiAnZnVuY3Rpb24nLFxuICAgICAgICBuYW1lOiAnc3ltYm9sJyxcbiAgICAgICAgc3RhdGVNdXRhYmlsaXR5OiAndmlldycsXG4gICAgICAgIGlucHV0czogW10sXG4gICAgICAgIG91dHB1dHM6IFtcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnYnl0ZXMzMicsXG4gICAgICAgICAgICB9LFxuICAgICAgICBdLFxuICAgIH0sXG4gICAge1xuICAgICAgICB0eXBlOiAnZnVuY3Rpb24nLFxuICAgICAgICBuYW1lOiAndG90YWxTdXBwbHknLFxuICAgICAgICBzdGF0ZU11dGFiaWxpdHk6ICd2aWV3JyxcbiAgICAgICAgaW5wdXRzOiBbXSxcbiAgICAgICAgb3V0cHV0czogW1xuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIHR5cGU6ICd1aW50MjU2JyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgIF0sXG4gICAgfSxcbiAgICB7XG4gICAgICAgIHR5cGU6ICdmdW5jdGlvbicsXG4gICAgICAgIG5hbWU6ICd0cmFuc2ZlcicsXG4gICAgICAgIHN0YXRlTXV0YWJpbGl0eTogJ25vbnBheWFibGUnLFxuICAgICAgICBpbnB1dHM6IFtcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBuYW1lOiAncmVjaXBpZW50JyxcbiAgICAgICAgICAgICAgICB0eXBlOiAnYWRkcmVzcycsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIG5hbWU6ICdhbW91bnQnLFxuICAgICAgICAgICAgICAgIHR5cGU6ICd1aW50MjU2JyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgIF0sXG4gICAgICAgIG91dHB1dHM6IFtcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnYm9vbCcsXG4gICAgICAgICAgICB9LFxuICAgICAgICBdLFxuICAgIH0sXG4gICAge1xuICAgICAgICB0eXBlOiAnZnVuY3Rpb24nLFxuICAgICAgICBuYW1lOiAndHJhbnNmZXJGcm9tJyxcbiAgICAgICAgc3RhdGVNdXRhYmlsaXR5OiAnbm9ucGF5YWJsZScsXG4gICAgICAgIGlucHV0czogW1xuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIG5hbWU6ICdzZW5kZXInLFxuICAgICAgICAgICAgICAgIHR5cGU6ICdhZGRyZXNzJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgbmFtZTogJ3JlY2lwaWVudCcsXG4gICAgICAgICAgICAgICAgdHlwZTogJ2FkZHJlc3MnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBuYW1lOiAnYW1vdW50JyxcbiAgICAgICAgICAgICAgICB0eXBlOiAndWludDI1NicsXG4gICAgICAgICAgICB9LFxuICAgICAgICBdLFxuICAgICAgICBvdXRwdXRzOiBbXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ2Jvb2wnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgXSxcbiAgICB9LFxuXTtcbi8qKiBbRVJDLTExNTUgTXVsdGkgVG9rZW4gU3RhbmRhcmRdKGh0dHBzOi8vZXRoZXJldW0ub3JnL2VuL2RldmVsb3BlcnMvZG9jcy9zdGFuZGFyZHMvdG9rZW5zL2VyYy0xMTU1KSAqL1xuZXhwb3J0IGNvbnN0IGVyYzExNTVBYmkgPSBbXG4gICAge1xuICAgICAgICBpbnB1dHM6IFtcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBpbnRlcm5hbFR5cGU6ICdhZGRyZXNzJyxcbiAgICAgICAgICAgICAgICBuYW1lOiAnc2VuZGVyJyxcbiAgICAgICAgICAgICAgICB0eXBlOiAnYWRkcmVzcycsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGludGVybmFsVHlwZTogJ3VpbnQyNTYnLFxuICAgICAgICAgICAgICAgIG5hbWU6ICdiYWxhbmNlJyxcbiAgICAgICAgICAgICAgICB0eXBlOiAndWludDI1NicsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGludGVybmFsVHlwZTogJ3VpbnQyNTYnLFxuICAgICAgICAgICAgICAgIG5hbWU6ICduZWVkZWQnLFxuICAgICAgICAgICAgICAgIHR5cGU6ICd1aW50MjU2JyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgaW50ZXJuYWxUeXBlOiAndWludDI1NicsXG4gICAgICAgICAgICAgICAgbmFtZTogJ3Rva2VuSWQnLFxuICAgICAgICAgICAgICAgIHR5cGU6ICd1aW50MjU2JyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgIF0sXG4gICAgICAgIG5hbWU6ICdFUkMxMTU1SW5zdWZmaWNpZW50QmFsYW5jZScsXG4gICAgICAgIHR5cGU6ICdlcnJvcicsXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGlucHV0czogW1xuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGludGVybmFsVHlwZTogJ2FkZHJlc3MnLFxuICAgICAgICAgICAgICAgIG5hbWU6ICdhcHByb3ZlcicsXG4gICAgICAgICAgICAgICAgdHlwZTogJ2FkZHJlc3MnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgXSxcbiAgICAgICAgbmFtZTogJ0VSQzExNTVJbnZhbGlkQXBwcm92ZXInLFxuICAgICAgICB0eXBlOiAnZXJyb3InLFxuICAgIH0sXG4gICAge1xuICAgICAgICBpbnB1dHM6IFtcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBpbnRlcm5hbFR5cGU6ICd1aW50MjU2JyxcbiAgICAgICAgICAgICAgICBuYW1lOiAnaWRzTGVuZ3RoJyxcbiAgICAgICAgICAgICAgICB0eXBlOiAndWludDI1NicsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGludGVybmFsVHlwZTogJ3VpbnQyNTYnLFxuICAgICAgICAgICAgICAgIG5hbWU6ICd2YWx1ZXNMZW5ndGgnLFxuICAgICAgICAgICAgICAgIHR5cGU6ICd1aW50MjU2JyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgIF0sXG4gICAgICAgIG5hbWU6ICdFUkMxMTU1SW52YWxpZEFycmF5TGVuZ3RoJyxcbiAgICAgICAgdHlwZTogJ2Vycm9yJyxcbiAgICB9LFxuICAgIHtcbiAgICAgICAgaW5wdXRzOiBbXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgaW50ZXJuYWxUeXBlOiAnYWRkcmVzcycsXG4gICAgICAgICAgICAgICAgbmFtZTogJ29wZXJhdG9yJyxcbiAgICAgICAgICAgICAgICB0eXBlOiAnYWRkcmVzcycsXG4gICAgICAgICAgICB9LFxuICAgICAgICBdLFxuICAgICAgICBuYW1lOiAnRVJDMTE1NUludmFsaWRPcGVyYXRvcicsXG4gICAgICAgIHR5cGU6ICdlcnJvcicsXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGlucHV0czogW1xuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGludGVybmFsVHlwZTogJ2FkZHJlc3MnLFxuICAgICAgICAgICAgICAgIG5hbWU6ICdyZWNlaXZlcicsXG4gICAgICAgICAgICAgICAgdHlwZTogJ2FkZHJlc3MnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgXSxcbiAgICAgICAgbmFtZTogJ0VSQzExNTVJbnZhbGlkUmVjZWl2ZXInLFxuICAgICAgICB0eXBlOiAnZXJyb3InLFxuICAgIH0sXG4gICAge1xuICAgICAgICBpbnB1dHM6IFtcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBpbnRlcm5hbFR5cGU6ICdhZGRyZXNzJyxcbiAgICAgICAgICAgICAgICBuYW1lOiAnc2VuZGVyJyxcbiAgICAgICAgICAgICAgICB0eXBlOiAnYWRkcmVzcycsXG4gICAgICAgICAgICB9LFxuICAgICAgICBdLFxuICAgICAgICBuYW1lOiAnRVJDMTE1NUludmFsaWRTZW5kZXInLFxuICAgICAgICB0eXBlOiAnZXJyb3InLFxuICAgIH0sXG4gICAge1xuICAgICAgICBpbnB1dHM6IFtcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBpbnRlcm5hbFR5cGU6ICdhZGRyZXNzJyxcbiAgICAgICAgICAgICAgICBuYW1lOiAnb3BlcmF0b3InLFxuICAgICAgICAgICAgICAgIHR5cGU6ICdhZGRyZXNzJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgaW50ZXJuYWxUeXBlOiAnYWRkcmVzcycsXG4gICAgICAgICAgICAgICAgbmFtZTogJ293bmVyJyxcbiAgICAgICAgICAgICAgICB0eXBlOiAnYWRkcmVzcycsXG4gICAgICAgICAgICB9LFxuICAgICAgICBdLFxuICAgICAgICBuYW1lOiAnRVJDMTE1NU1pc3NpbmdBcHByb3ZhbEZvckFsbCcsXG4gICAgICAgIHR5cGU6ICdlcnJvcicsXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGFub255bW91czogZmFsc2UsXG4gICAgICAgIGlucHV0czogW1xuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGluZGV4ZWQ6IHRydWUsXG4gICAgICAgICAgICAgICAgaW50ZXJuYWxUeXBlOiAnYWRkcmVzcycsXG4gICAgICAgICAgICAgICAgbmFtZTogJ2FjY291bnQnLFxuICAgICAgICAgICAgICAgIHR5cGU6ICdhZGRyZXNzJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgaW5kZXhlZDogdHJ1ZSxcbiAgICAgICAgICAgICAgICBpbnRlcm5hbFR5cGU6ICdhZGRyZXNzJyxcbiAgICAgICAgICAgICAgICBuYW1lOiAnb3BlcmF0b3InLFxuICAgICAgICAgICAgICAgIHR5cGU6ICdhZGRyZXNzJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgaW5kZXhlZDogZmFsc2UsXG4gICAgICAgICAgICAgICAgaW50ZXJuYWxUeXBlOiAnYm9vbCcsXG4gICAgICAgICAgICAgICAgbmFtZTogJ2FwcHJvdmVkJyxcbiAgICAgICAgICAgICAgICB0eXBlOiAnYm9vbCcsXG4gICAgICAgICAgICB9LFxuICAgICAgICBdLFxuICAgICAgICBuYW1lOiAnQXBwcm92YWxGb3JBbGwnLFxuICAgICAgICB0eXBlOiAnZXZlbnQnLFxuICAgIH0sXG4gICAge1xuICAgICAgICBhbm9ueW1vdXM6IGZhbHNlLFxuICAgICAgICBpbnB1dHM6IFtcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBpbmRleGVkOiB0cnVlLFxuICAgICAgICAgICAgICAgIGludGVybmFsVHlwZTogJ2FkZHJlc3MnLFxuICAgICAgICAgICAgICAgIG5hbWU6ICdvcGVyYXRvcicsXG4gICAgICAgICAgICAgICAgdHlwZTogJ2FkZHJlc3MnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBpbmRleGVkOiB0cnVlLFxuICAgICAgICAgICAgICAgIGludGVybmFsVHlwZTogJ2FkZHJlc3MnLFxuICAgICAgICAgICAgICAgIG5hbWU6ICdmcm9tJyxcbiAgICAgICAgICAgICAgICB0eXBlOiAnYWRkcmVzcycsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGluZGV4ZWQ6IHRydWUsXG4gICAgICAgICAgICAgICAgaW50ZXJuYWxUeXBlOiAnYWRkcmVzcycsXG4gICAgICAgICAgICAgICAgbmFtZTogJ3RvJyxcbiAgICAgICAgICAgICAgICB0eXBlOiAnYWRkcmVzcycsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGluZGV4ZWQ6IGZhbHNlLFxuICAgICAgICAgICAgICAgIGludGVybmFsVHlwZTogJ3VpbnQyNTZbXScsXG4gICAgICAgICAgICAgICAgbmFtZTogJ2lkcycsXG4gICAgICAgICAgICAgICAgdHlwZTogJ3VpbnQyNTZbXScsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGluZGV4ZWQ6IGZhbHNlLFxuICAgICAgICAgICAgICAgIGludGVybmFsVHlwZTogJ3VpbnQyNTZbXScsXG4gICAgICAgICAgICAgICAgbmFtZTogJ3ZhbHVlcycsXG4gICAgICAgICAgICAgICAgdHlwZTogJ3VpbnQyNTZbXScsXG4gICAgICAgICAgICB9LFxuICAgICAgICBdLFxuICAgICAgICBuYW1lOiAnVHJhbnNmZXJCYXRjaCcsXG4gICAgICAgIHR5cGU6ICdldmVudCcsXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGFub255bW91czogZmFsc2UsXG4gICAgICAgIGlucHV0czogW1xuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGluZGV4ZWQ6IHRydWUsXG4gICAgICAgICAgICAgICAgaW50ZXJuYWxUeXBlOiAnYWRkcmVzcycsXG4gICAgICAgICAgICAgICAgbmFtZTogJ29wZXJhdG9yJyxcbiAgICAgICAgICAgICAgICB0eXBlOiAnYWRkcmVzcycsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGluZGV4ZWQ6IHRydWUsXG4gICAgICAgICAgICAgICAgaW50ZXJuYWxUeXBlOiAnYWRkcmVzcycsXG4gICAgICAgICAgICAgICAgbmFtZTogJ2Zyb20nLFxuICAgICAgICAgICAgICAgIHR5cGU6ICdhZGRyZXNzJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgaW5kZXhlZDogdHJ1ZSxcbiAgICAgICAgICAgICAgICBpbnRlcm5hbFR5cGU6ICdhZGRyZXNzJyxcbiAgICAgICAgICAgICAgICBuYW1lOiAndG8nLFxuICAgICAgICAgICAgICAgIHR5cGU6ICdhZGRyZXNzJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgaW5kZXhlZDogZmFsc2UsXG4gICAgICAgICAgICAgICAgaW50ZXJuYWxUeXBlOiAndWludDI1NicsXG4gICAgICAgICAgICAgICAgbmFtZTogJ2lkJyxcbiAgICAgICAgICAgICAgICB0eXBlOiAndWludDI1NicsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGluZGV4ZWQ6IGZhbHNlLFxuICAgICAgICAgICAgICAgIGludGVybmFsVHlwZTogJ3VpbnQyNTYnLFxuICAgICAgICAgICAgICAgIG5hbWU6ICd2YWx1ZScsXG4gICAgICAgICAgICAgICAgdHlwZTogJ3VpbnQyNTYnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgXSxcbiAgICAgICAgbmFtZTogJ1RyYW5zZmVyU2luZ2xlJyxcbiAgICAgICAgdHlwZTogJ2V2ZW50JyxcbiAgICB9LFxuICAgIHtcbiAgICAgICAgYW5vbnltb3VzOiBmYWxzZSxcbiAgICAgICAgaW5wdXRzOiBbXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgaW5kZXhlZDogZmFsc2UsXG4gICAgICAgICAgICAgICAgaW50ZXJuYWxUeXBlOiAnc3RyaW5nJyxcbiAgICAgICAgICAgICAgICBuYW1lOiAndmFsdWUnLFxuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBpbmRleGVkOiB0cnVlLFxuICAgICAgICAgICAgICAgIGludGVybmFsVHlwZTogJ3VpbnQyNTYnLFxuICAgICAgICAgICAgICAgIG5hbWU6ICdpZCcsXG4gICAgICAgICAgICAgICAgdHlwZTogJ3VpbnQyNTYnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgXSxcbiAgICAgICAgbmFtZTogJ1VSSScsXG4gICAgICAgIHR5cGU6ICdldmVudCcsXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGlucHV0czogW1xuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGludGVybmFsVHlwZTogJ2FkZHJlc3MnLFxuICAgICAgICAgICAgICAgIG5hbWU6ICdhY2NvdW50JyxcbiAgICAgICAgICAgICAgICB0eXBlOiAnYWRkcmVzcycsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGludGVybmFsVHlwZTogJ3VpbnQyNTYnLFxuICAgICAgICAgICAgICAgIG5hbWU6ICdpZCcsXG4gICAgICAgICAgICAgICAgdHlwZTogJ3VpbnQyNTYnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgXSxcbiAgICAgICAgbmFtZTogJ2JhbGFuY2VPZicsXG4gICAgICAgIG91dHB1dHM6IFtcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBpbnRlcm5hbFR5cGU6ICd1aW50MjU2JyxcbiAgICAgICAgICAgICAgICBuYW1lOiAnJyxcbiAgICAgICAgICAgICAgICB0eXBlOiAndWludDI1NicsXG4gICAgICAgICAgICB9LFxuICAgICAgICBdLFxuICAgICAgICBzdGF0ZU11dGFiaWxpdHk6ICd2aWV3JyxcbiAgICAgICAgdHlwZTogJ2Z1bmN0aW9uJyxcbiAgICB9LFxuICAgIHtcbiAgICAgICAgaW5wdXRzOiBbXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgaW50ZXJuYWxUeXBlOiAnYWRkcmVzc1tdJyxcbiAgICAgICAgICAgICAgICBuYW1lOiAnYWNjb3VudHMnLFxuICAgICAgICAgICAgICAgIHR5cGU6ICdhZGRyZXNzW10nLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBpbnRlcm5hbFR5cGU6ICd1aW50MjU2W10nLFxuICAgICAgICAgICAgICAgIG5hbWU6ICdpZHMnLFxuICAgICAgICAgICAgICAgIHR5cGU6ICd1aW50MjU2W10nLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgXSxcbiAgICAgICAgbmFtZTogJ2JhbGFuY2VPZkJhdGNoJyxcbiAgICAgICAgb3V0cHV0czogW1xuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGludGVybmFsVHlwZTogJ3VpbnQyNTZbXScsXG4gICAgICAgICAgICAgICAgbmFtZTogJycsXG4gICAgICAgICAgICAgICAgdHlwZTogJ3VpbnQyNTZbXScsXG4gICAgICAgICAgICB9LFxuICAgICAgICBdLFxuICAgICAgICBzdGF0ZU11dGFiaWxpdHk6ICd2aWV3JyxcbiAgICAgICAgdHlwZTogJ2Z1bmN0aW9uJyxcbiAgICB9LFxuICAgIHtcbiAgICAgICAgaW5wdXRzOiBbXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgaW50ZXJuYWxUeXBlOiAnYWRkcmVzcycsXG4gICAgICAgICAgICAgICAgbmFtZTogJ2FjY291bnQnLFxuICAgICAgICAgICAgICAgIHR5cGU6ICdhZGRyZXNzJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgaW50ZXJuYWxUeXBlOiAnYWRkcmVzcycsXG4gICAgICAgICAgICAgICAgbmFtZTogJ29wZXJhdG9yJyxcbiAgICAgICAgICAgICAgICB0eXBlOiAnYWRkcmVzcycsXG4gICAgICAgICAgICB9LFxuICAgICAgICBdLFxuICAgICAgICBuYW1lOiAnaXNBcHByb3ZlZEZvckFsbCcsXG4gICAgICAgIG91dHB1dHM6IFtcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBpbnRlcm5hbFR5cGU6ICdib29sJyxcbiAgICAgICAgICAgICAgICBuYW1lOiAnJyxcbiAgICAgICAgICAgICAgICB0eXBlOiAnYm9vbCcsXG4gICAgICAgICAgICB9LFxuICAgICAgICBdLFxuICAgICAgICBzdGF0ZU11dGFiaWxpdHk6ICd2aWV3JyxcbiAgICAgICAgdHlwZTogJ2Z1bmN0aW9uJyxcbiAgICB9LFxuICAgIHtcbiAgICAgICAgaW5wdXRzOiBbXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgaW50ZXJuYWxUeXBlOiAnYWRkcmVzcycsXG4gICAgICAgICAgICAgICAgbmFtZTogJ2Zyb20nLFxuICAgICAgICAgICAgICAgIHR5cGU6ICdhZGRyZXNzJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgaW50ZXJuYWxUeXBlOiAnYWRkcmVzcycsXG4gICAgICAgICAgICAgICAgbmFtZTogJ3RvJyxcbiAgICAgICAgICAgICAgICB0eXBlOiAnYWRkcmVzcycsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGludGVybmFsVHlwZTogJ3VpbnQyNTZbXScsXG4gICAgICAgICAgICAgICAgbmFtZTogJ2lkcycsXG4gICAgICAgICAgICAgICAgdHlwZTogJ3VpbnQyNTZbXScsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGludGVybmFsVHlwZTogJ3VpbnQyNTZbXScsXG4gICAgICAgICAgICAgICAgbmFtZTogJ3ZhbHVlcycsXG4gICAgICAgICAgICAgICAgdHlwZTogJ3VpbnQyNTZbXScsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGludGVybmFsVHlwZTogJ2J5dGVzJyxcbiAgICAgICAgICAgICAgICBuYW1lOiAnZGF0YScsXG4gICAgICAgICAgICAgICAgdHlwZTogJ2J5dGVzJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgIF0sXG4gICAgICAgIG5hbWU6ICdzYWZlQmF0Y2hUcmFuc2ZlckZyb20nLFxuICAgICAgICBvdXRwdXRzOiBbXSxcbiAgICAgICAgc3RhdGVNdXRhYmlsaXR5OiAnbm9ucGF5YWJsZScsXG4gICAgICAgIHR5cGU6ICdmdW5jdGlvbicsXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGlucHV0czogW1xuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGludGVybmFsVHlwZTogJ2FkZHJlc3MnLFxuICAgICAgICAgICAgICAgIG5hbWU6ICdmcm9tJyxcbiAgICAgICAgICAgICAgICB0eXBlOiAnYWRkcmVzcycsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGludGVybmFsVHlwZTogJ2FkZHJlc3MnLFxuICAgICAgICAgICAgICAgIG5hbWU6ICd0bycsXG4gICAgICAgICAgICAgICAgdHlwZTogJ2FkZHJlc3MnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBpbnRlcm5hbFR5cGU6ICd1aW50MjU2JyxcbiAgICAgICAgICAgICAgICBuYW1lOiAnaWQnLFxuICAgICAgICAgICAgICAgIHR5cGU6ICd1aW50MjU2JyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgaW50ZXJuYWxUeXBlOiAndWludDI1NicsXG4gICAgICAgICAgICAgICAgbmFtZTogJ3ZhbHVlJyxcbiAgICAgICAgICAgICAgICB0eXBlOiAndWludDI1NicsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGludGVybmFsVHlwZTogJ2J5dGVzJyxcbiAgICAgICAgICAgICAgICBuYW1lOiAnZGF0YScsXG4gICAgICAgICAgICAgICAgdHlwZTogJ2J5dGVzJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgIF0sXG4gICAgICAgIG5hbWU6ICdzYWZlVHJhbnNmZXJGcm9tJyxcbiAgICAgICAgb3V0cHV0czogW10sXG4gICAgICAgIHN0YXRlTXV0YWJpbGl0eTogJ25vbnBheWFibGUnLFxuICAgICAgICB0eXBlOiAnZnVuY3Rpb24nLFxuICAgIH0sXG4gICAge1xuICAgICAgICBpbnB1dHM6IFtcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBpbnRlcm5hbFR5cGU6ICdhZGRyZXNzJyxcbiAgICAgICAgICAgICAgICBuYW1lOiAnb3BlcmF0b3InLFxuICAgICAgICAgICAgICAgIHR5cGU6ICdhZGRyZXNzJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgaW50ZXJuYWxUeXBlOiAnYm9vbCcsXG4gICAgICAgICAgICAgICAgbmFtZTogJ2FwcHJvdmVkJyxcbiAgICAgICAgICAgICAgICB0eXBlOiAnYm9vbCcsXG4gICAgICAgICAgICB9LFxuICAgICAgICBdLFxuICAgICAgICBuYW1lOiAnc2V0QXBwcm92YWxGb3JBbGwnLFxuICAgICAgICBvdXRwdXRzOiBbXSxcbiAgICAgICAgc3RhdGVNdXRhYmlsaXR5OiAnbm9ucGF5YWJsZScsXG4gICAgICAgIHR5cGU6ICdmdW5jdGlvbicsXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGlucHV0czogW1xuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGludGVybmFsVHlwZTogJ2J5dGVzNCcsXG4gICAgICAgICAgICAgICAgbmFtZTogJ2ludGVyZmFjZUlkJyxcbiAgICAgICAgICAgICAgICB0eXBlOiAnYnl0ZXM0JyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgIF0sXG4gICAgICAgIG5hbWU6ICdzdXBwb3J0c0ludGVyZmFjZScsXG4gICAgICAgIG91dHB1dHM6IFtcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBpbnRlcm5hbFR5cGU6ICdib29sJyxcbiAgICAgICAgICAgICAgICBuYW1lOiAnJyxcbiAgICAgICAgICAgICAgICB0eXBlOiAnYm9vbCcsXG4gICAgICAgICAgICB9LFxuICAgICAgICBdLFxuICAgICAgICBzdGF0ZU11dGFiaWxpdHk6ICd2aWV3JyxcbiAgICAgICAgdHlwZTogJ2Z1bmN0aW9uJyxcbiAgICB9LFxuICAgIHtcbiAgICAgICAgaW5wdXRzOiBbXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgaW50ZXJuYWxUeXBlOiAndWludDI1NicsXG4gICAgICAgICAgICAgICAgbmFtZTogJycsXG4gICAgICAgICAgICAgICAgdHlwZTogJ3VpbnQyNTYnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgXSxcbiAgICAgICAgbmFtZTogJ3VyaScsXG4gICAgICAgIG91dHB1dHM6IFtcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBpbnRlcm5hbFR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgICAgIG5hbWU6ICcnLFxuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgXSxcbiAgICAgICAgc3RhdGVNdXRhYmlsaXR5OiAndmlldycsXG4gICAgICAgIHR5cGU6ICdmdW5jdGlvbicsXG4gICAgfSxcbl07XG4vKiogW0VSQy03MjEgTm9uLUZ1bmdpYmxlIFRva2VuIFN0YW5kYXJkXShodHRwczovL2V0aGVyZXVtLm9yZy9lbi9kZXZlbG9wZXJzL2RvY3Mvc3RhbmRhcmRzL3Rva2Vucy9lcmMtNzIxKSAqL1xuZXhwb3J0IGNvbnN0IGVyYzcyMUFiaSA9IFtcbiAgICB7XG4gICAgICAgIHR5cGU6ICdldmVudCcsXG4gICAgICAgIG5hbWU6ICdBcHByb3ZhbCcsXG4gICAgICAgIGlucHV0czogW1xuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGluZGV4ZWQ6IHRydWUsXG4gICAgICAgICAgICAgICAgbmFtZTogJ293bmVyJyxcbiAgICAgICAgICAgICAgICB0eXBlOiAnYWRkcmVzcycsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGluZGV4ZWQ6IHRydWUsXG4gICAgICAgICAgICAgICAgbmFtZTogJ3NwZW5kZXInLFxuICAgICAgICAgICAgICAgIHR5cGU6ICdhZGRyZXNzJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgaW5kZXhlZDogdHJ1ZSxcbiAgICAgICAgICAgICAgICBuYW1lOiAndG9rZW5JZCcsXG4gICAgICAgICAgICAgICAgdHlwZTogJ3VpbnQyNTYnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgXSxcbiAgICB9LFxuICAgIHtcbiAgICAgICAgdHlwZTogJ2V2ZW50JyxcbiAgICAgICAgbmFtZTogJ0FwcHJvdmFsRm9yQWxsJyxcbiAgICAgICAgaW5wdXRzOiBbXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgaW5kZXhlZDogdHJ1ZSxcbiAgICAgICAgICAgICAgICBuYW1lOiAnb3duZXInLFxuICAgICAgICAgICAgICAgIHR5cGU6ICdhZGRyZXNzJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgaW5kZXhlZDogdHJ1ZSxcbiAgICAgICAgICAgICAgICBuYW1lOiAnb3BlcmF0b3InLFxuICAgICAgICAgICAgICAgIHR5cGU6ICdhZGRyZXNzJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgaW5kZXhlZDogZmFsc2UsXG4gICAgICAgICAgICAgICAgbmFtZTogJ2FwcHJvdmVkJyxcbiAgICAgICAgICAgICAgICB0eXBlOiAnYm9vbCcsXG4gICAgICAgICAgICB9LFxuICAgICAgICBdLFxuICAgIH0sXG4gICAge1xuICAgICAgICB0eXBlOiAnZXZlbnQnLFxuICAgICAgICBuYW1lOiAnVHJhbnNmZXInLFxuICAgICAgICBpbnB1dHM6IFtcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBpbmRleGVkOiB0cnVlLFxuICAgICAgICAgICAgICAgIG5hbWU6ICdmcm9tJyxcbiAgICAgICAgICAgICAgICB0eXBlOiAnYWRkcmVzcycsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGluZGV4ZWQ6IHRydWUsXG4gICAgICAgICAgICAgICAgbmFtZTogJ3RvJyxcbiAgICAgICAgICAgICAgICB0eXBlOiAnYWRkcmVzcycsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGluZGV4ZWQ6IHRydWUsXG4gICAgICAgICAgICAgICAgbmFtZTogJ3Rva2VuSWQnLFxuICAgICAgICAgICAgICAgIHR5cGU6ICd1aW50MjU2JyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgIF0sXG4gICAgfSxcbiAgICB7XG4gICAgICAgIHR5cGU6ICdmdW5jdGlvbicsXG4gICAgICAgIG5hbWU6ICdhcHByb3ZlJyxcbiAgICAgICAgc3RhdGVNdXRhYmlsaXR5OiAncGF5YWJsZScsXG4gICAgICAgIGlucHV0czogW1xuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIG5hbWU6ICdzcGVuZGVyJyxcbiAgICAgICAgICAgICAgICB0eXBlOiAnYWRkcmVzcycsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIG5hbWU6ICd0b2tlbklkJyxcbiAgICAgICAgICAgICAgICB0eXBlOiAndWludDI1NicsXG4gICAgICAgICAgICB9LFxuICAgICAgICBdLFxuICAgICAgICBvdXRwdXRzOiBbXSxcbiAgICB9LFxuICAgIHtcbiAgICAgICAgdHlwZTogJ2Z1bmN0aW9uJyxcbiAgICAgICAgbmFtZTogJ2JhbGFuY2VPZicsXG4gICAgICAgIHN0YXRlTXV0YWJpbGl0eTogJ3ZpZXcnLFxuICAgICAgICBpbnB1dHM6IFtcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBuYW1lOiAnYWNjb3VudCcsXG4gICAgICAgICAgICAgICAgdHlwZTogJ2FkZHJlc3MnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgXSxcbiAgICAgICAgb3V0cHV0czogW1xuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIHR5cGU6ICd1aW50MjU2JyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgIF0sXG4gICAgfSxcbiAgICB7XG4gICAgICAgIHR5cGU6ICdmdW5jdGlvbicsXG4gICAgICAgIG5hbWU6ICdnZXRBcHByb3ZlZCcsXG4gICAgICAgIHN0YXRlTXV0YWJpbGl0eTogJ3ZpZXcnLFxuICAgICAgICBpbnB1dHM6IFtcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBuYW1lOiAndG9rZW5JZCcsXG4gICAgICAgICAgICAgICAgdHlwZTogJ3VpbnQyNTYnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgXSxcbiAgICAgICAgb3V0cHV0czogW1xuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdhZGRyZXNzJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgIF0sXG4gICAgfSxcbiAgICB7XG4gICAgICAgIHR5cGU6ICdmdW5jdGlvbicsXG4gICAgICAgIG5hbWU6ICdpc0FwcHJvdmVkRm9yQWxsJyxcbiAgICAgICAgc3RhdGVNdXRhYmlsaXR5OiAndmlldycsXG4gICAgICAgIGlucHV0czogW1xuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIG5hbWU6ICdvd25lcicsXG4gICAgICAgICAgICAgICAgdHlwZTogJ2FkZHJlc3MnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBuYW1lOiAnb3BlcmF0b3InLFxuICAgICAgICAgICAgICAgIHR5cGU6ICdhZGRyZXNzJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgIF0sXG4gICAgICAgIG91dHB1dHM6IFtcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnYm9vbCcsXG4gICAgICAgICAgICB9LFxuICAgICAgICBdLFxuICAgIH0sXG4gICAge1xuICAgICAgICB0eXBlOiAnZnVuY3Rpb24nLFxuICAgICAgICBuYW1lOiAnbmFtZScsXG4gICAgICAgIHN0YXRlTXV0YWJpbGl0eTogJ3ZpZXcnLFxuICAgICAgICBpbnB1dHM6IFtdLFxuICAgICAgICBvdXRwdXRzOiBbXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICB9LFxuICAgICAgICBdLFxuICAgIH0sXG4gICAge1xuICAgICAgICB0eXBlOiAnZnVuY3Rpb24nLFxuICAgICAgICBuYW1lOiAnb3duZXJPZicsXG4gICAgICAgIHN0YXRlTXV0YWJpbGl0eTogJ3ZpZXcnLFxuICAgICAgICBpbnB1dHM6IFtcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBuYW1lOiAndG9rZW5JZCcsXG4gICAgICAgICAgICAgICAgdHlwZTogJ3VpbnQyNTYnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgXSxcbiAgICAgICAgb3V0cHV0czogW1xuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIG5hbWU6ICdvd25lcicsXG4gICAgICAgICAgICAgICAgdHlwZTogJ2FkZHJlc3MnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgXSxcbiAgICB9LFxuICAgIHtcbiAgICAgICAgdHlwZTogJ2Z1bmN0aW9uJyxcbiAgICAgICAgbmFtZTogJ3NhZmVUcmFuc2ZlckZyb20nLFxuICAgICAgICBzdGF0ZU11dGFiaWxpdHk6ICdwYXlhYmxlJyxcbiAgICAgICAgaW5wdXRzOiBbXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgbmFtZTogJ2Zyb20nLFxuICAgICAgICAgICAgICAgIHR5cGU6ICdhZGRyZXNzJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgbmFtZTogJ3RvJyxcbiAgICAgICAgICAgICAgICB0eXBlOiAnYWRkcmVzcycsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIG5hbWU6ICd0b2tlbklkJyxcbiAgICAgICAgICAgICAgICB0eXBlOiAndWludDI1NicsXG4gICAgICAgICAgICB9LFxuICAgICAgICBdLFxuICAgICAgICBvdXRwdXRzOiBbXSxcbiAgICB9LFxuICAgIHtcbiAgICAgICAgdHlwZTogJ2Z1bmN0aW9uJyxcbiAgICAgICAgbmFtZTogJ3NhZmVUcmFuc2ZlckZyb20nLFxuICAgICAgICBzdGF0ZU11dGFiaWxpdHk6ICdub25wYXlhYmxlJyxcbiAgICAgICAgaW5wdXRzOiBbXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgbmFtZTogJ2Zyb20nLFxuICAgICAgICAgICAgICAgIHR5cGU6ICdhZGRyZXNzJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgbmFtZTogJ3RvJyxcbiAgICAgICAgICAgICAgICB0eXBlOiAnYWRkcmVzcycsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIG5hbWU6ICdpZCcsXG4gICAgICAgICAgICAgICAgdHlwZTogJ3VpbnQyNTYnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBuYW1lOiAnZGF0YScsXG4gICAgICAgICAgICAgICAgdHlwZTogJ2J5dGVzJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgIF0sXG4gICAgICAgIG91dHB1dHM6IFtdLFxuICAgIH0sXG4gICAge1xuICAgICAgICB0eXBlOiAnZnVuY3Rpb24nLFxuICAgICAgICBuYW1lOiAnc2V0QXBwcm92YWxGb3JBbGwnLFxuICAgICAgICBzdGF0ZU11dGFiaWxpdHk6ICdub25wYXlhYmxlJyxcbiAgICAgICAgaW5wdXRzOiBbXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgbmFtZTogJ29wZXJhdG9yJyxcbiAgICAgICAgICAgICAgICB0eXBlOiAnYWRkcmVzcycsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIG5hbWU6ICdhcHByb3ZlZCcsXG4gICAgICAgICAgICAgICAgdHlwZTogJ2Jvb2wnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgXSxcbiAgICAgICAgb3V0cHV0czogW10sXG4gICAgfSxcbiAgICB7XG4gICAgICAgIHR5cGU6ICdmdW5jdGlvbicsXG4gICAgICAgIG5hbWU6ICdzeW1ib2wnLFxuICAgICAgICBzdGF0ZU11dGFiaWxpdHk6ICd2aWV3JyxcbiAgICAgICAgaW5wdXRzOiBbXSxcbiAgICAgICAgb3V0cHV0czogW1xuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgXSxcbiAgICB9LFxuICAgIHtcbiAgICAgICAgdHlwZTogJ2Z1bmN0aW9uJyxcbiAgICAgICAgbmFtZTogJ3Rva2VuQnlJbmRleCcsXG4gICAgICAgIHN0YXRlTXV0YWJpbGl0eTogJ3ZpZXcnLFxuICAgICAgICBpbnB1dHM6IFtcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBuYW1lOiAnaW5kZXgnLFxuICAgICAgICAgICAgICAgIHR5cGU6ICd1aW50MjU2JyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgIF0sXG4gICAgICAgIG91dHB1dHM6IFtcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICB0eXBlOiAndWludDI1NicsXG4gICAgICAgICAgICB9LFxuICAgICAgICBdLFxuICAgIH0sXG4gICAge1xuICAgICAgICB0eXBlOiAnZnVuY3Rpb24nLFxuICAgICAgICBuYW1lOiAndG9rZW5CeUluZGV4JyxcbiAgICAgICAgc3RhdGVNdXRhYmlsaXR5OiAndmlldycsXG4gICAgICAgIGlucHV0czogW1xuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIG5hbWU6ICdvd25lcicsXG4gICAgICAgICAgICAgICAgdHlwZTogJ2FkZHJlc3MnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBuYW1lOiAnaW5kZXgnLFxuICAgICAgICAgICAgICAgIHR5cGU6ICd1aW50MjU2JyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgIF0sXG4gICAgICAgIG91dHB1dHM6IFtcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBuYW1lOiAndG9rZW5JZCcsXG4gICAgICAgICAgICAgICAgdHlwZTogJ3VpbnQyNTYnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgXSxcbiAgICB9LFxuICAgIHtcbiAgICAgICAgdHlwZTogJ2Z1bmN0aW9uJyxcbiAgICAgICAgbmFtZTogJ3Rva2VuVVJJJyxcbiAgICAgICAgc3RhdGVNdXRhYmlsaXR5OiAndmlldycsXG4gICAgICAgIGlucHV0czogW1xuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIG5hbWU6ICd0b2tlbklkJyxcbiAgICAgICAgICAgICAgICB0eXBlOiAndWludDI1NicsXG4gICAgICAgICAgICB9LFxuICAgICAgICBdLFxuICAgICAgICBvdXRwdXRzOiBbXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgICAgICB9LFxuICAgICAgICBdLFxuICAgIH0sXG4gICAge1xuICAgICAgICB0eXBlOiAnZnVuY3Rpb24nLFxuICAgICAgICBuYW1lOiAndG90YWxTdXBwbHknLFxuICAgICAgICBzdGF0ZU11dGFiaWxpdHk6ICd2aWV3JyxcbiAgICAgICAgaW5wdXRzOiBbXSxcbiAgICAgICAgb3V0cHV0czogW1xuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIHR5cGU6ICd1aW50MjU2JyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgIF0sXG4gICAgfSxcbiAgICB7XG4gICAgICAgIHR5cGU6ICdmdW5jdGlvbicsXG4gICAgICAgIG5hbWU6ICd0cmFuc2ZlckZyb20nLFxuICAgICAgICBzdGF0ZU11dGFiaWxpdHk6ICdwYXlhYmxlJyxcbiAgICAgICAgaW5wdXRzOiBbXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgbmFtZTogJ3NlbmRlcicsXG4gICAgICAgICAgICAgICAgdHlwZTogJ2FkZHJlc3MnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBuYW1lOiAncmVjaXBpZW50JyxcbiAgICAgICAgICAgICAgICB0eXBlOiAnYWRkcmVzcycsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIG5hbWU6ICd0b2tlbklkJyxcbiAgICAgICAgICAgICAgICB0eXBlOiAndWludDI1NicsXG4gICAgICAgICAgICB9LFxuICAgICAgICBdLFxuICAgICAgICBvdXRwdXRzOiBbXSxcbiAgICB9LFxuXTtcbi8qKiBbRVJDLTQ2MjYgVG9rZW5pemVkIFZhdWx0cyBTdGFuZGFyZF0oaHR0cHM6Ly9ldGhlcmV1bS5vcmcvZW4vZGV2ZWxvcGVycy9kb2NzL3N0YW5kYXJkcy90b2tlbnMvZXJjLTQ2MjYpICovXG5leHBvcnQgY29uc3QgZXJjNDYyNkFiaSA9IFtcbiAgICB7XG4gICAgICAgIGFub255bW91czogZmFsc2UsXG4gICAgICAgIGlucHV0czogW1xuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGluZGV4ZWQ6IHRydWUsXG4gICAgICAgICAgICAgICAgbmFtZTogJ293bmVyJyxcbiAgICAgICAgICAgICAgICB0eXBlOiAnYWRkcmVzcycsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGluZGV4ZWQ6IHRydWUsXG4gICAgICAgICAgICAgICAgbmFtZTogJ3NwZW5kZXInLFxuICAgICAgICAgICAgICAgIHR5cGU6ICdhZGRyZXNzJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgaW5kZXhlZDogZmFsc2UsXG4gICAgICAgICAgICAgICAgbmFtZTogJ3ZhbHVlJyxcbiAgICAgICAgICAgICAgICB0eXBlOiAndWludDI1NicsXG4gICAgICAgICAgICB9LFxuICAgICAgICBdLFxuICAgICAgICBuYW1lOiAnQXBwcm92YWwnLFxuICAgICAgICB0eXBlOiAnZXZlbnQnLFxuICAgIH0sXG4gICAge1xuICAgICAgICBhbm9ueW1vdXM6IGZhbHNlLFxuICAgICAgICBpbnB1dHM6IFtcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBpbmRleGVkOiB0cnVlLFxuICAgICAgICAgICAgICAgIG5hbWU6ICdzZW5kZXInLFxuICAgICAgICAgICAgICAgIHR5cGU6ICdhZGRyZXNzJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgaW5kZXhlZDogdHJ1ZSxcbiAgICAgICAgICAgICAgICBuYW1lOiAncmVjZWl2ZXInLFxuICAgICAgICAgICAgICAgIHR5cGU6ICdhZGRyZXNzJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgaW5kZXhlZDogZmFsc2UsXG4gICAgICAgICAgICAgICAgbmFtZTogJ2Fzc2V0cycsXG4gICAgICAgICAgICAgICAgdHlwZTogJ3VpbnQyNTYnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBpbmRleGVkOiBmYWxzZSxcbiAgICAgICAgICAgICAgICBuYW1lOiAnc2hhcmVzJyxcbiAgICAgICAgICAgICAgICB0eXBlOiAndWludDI1NicsXG4gICAgICAgICAgICB9LFxuICAgICAgICBdLFxuICAgICAgICBuYW1lOiAnRGVwb3NpdCcsXG4gICAgICAgIHR5cGU6ICdldmVudCcsXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGFub255bW91czogZmFsc2UsXG4gICAgICAgIGlucHV0czogW1xuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGluZGV4ZWQ6IHRydWUsXG4gICAgICAgICAgICAgICAgbmFtZTogJ2Zyb20nLFxuICAgICAgICAgICAgICAgIHR5cGU6ICdhZGRyZXNzJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgaW5kZXhlZDogdHJ1ZSxcbiAgICAgICAgICAgICAgICBuYW1lOiAndG8nLFxuICAgICAgICAgICAgICAgIHR5cGU6ICdhZGRyZXNzJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgaW5kZXhlZDogZmFsc2UsXG4gICAgICAgICAgICAgICAgbmFtZTogJ3ZhbHVlJyxcbiAgICAgICAgICAgICAgICB0eXBlOiAndWludDI1NicsXG4gICAgICAgICAgICB9LFxuICAgICAgICBdLFxuICAgICAgICBuYW1lOiAnVHJhbnNmZXInLFxuICAgICAgICB0eXBlOiAnZXZlbnQnLFxuICAgIH0sXG4gICAge1xuICAgICAgICBhbm9ueW1vdXM6IGZhbHNlLFxuICAgICAgICBpbnB1dHM6IFtcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBpbmRleGVkOiB0cnVlLFxuICAgICAgICAgICAgICAgIG5hbWU6ICdzZW5kZXInLFxuICAgICAgICAgICAgICAgIHR5cGU6ICdhZGRyZXNzJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgaW5kZXhlZDogdHJ1ZSxcbiAgICAgICAgICAgICAgICBuYW1lOiAncmVjZWl2ZXInLFxuICAgICAgICAgICAgICAgIHR5cGU6ICdhZGRyZXNzJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgaW5kZXhlZDogdHJ1ZSxcbiAgICAgICAgICAgICAgICBuYW1lOiAnb3duZXInLFxuICAgICAgICAgICAgICAgIHR5cGU6ICdhZGRyZXNzJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgaW5kZXhlZDogZmFsc2UsXG4gICAgICAgICAgICAgICAgbmFtZTogJ2Fzc2V0cycsXG4gICAgICAgICAgICAgICAgdHlwZTogJ3VpbnQyNTYnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBpbmRleGVkOiBmYWxzZSxcbiAgICAgICAgICAgICAgICBuYW1lOiAnc2hhcmVzJyxcbiAgICAgICAgICAgICAgICB0eXBlOiAndWludDI1NicsXG4gICAgICAgICAgICB9LFxuICAgICAgICBdLFxuICAgICAgICBuYW1lOiAnV2l0aGRyYXcnLFxuICAgICAgICB0eXBlOiAnZXZlbnQnLFxuICAgIH0sXG4gICAge1xuICAgICAgICBpbnB1dHM6IFtcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBuYW1lOiAnb3duZXInLFxuICAgICAgICAgICAgICAgIHR5cGU6ICdhZGRyZXNzJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgbmFtZTogJ3NwZW5kZXInLFxuICAgICAgICAgICAgICAgIHR5cGU6ICdhZGRyZXNzJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgIF0sXG4gICAgICAgIG5hbWU6ICdhbGxvd2FuY2UnLFxuICAgICAgICBvdXRwdXRzOiBbXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3VpbnQyNTYnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgXSxcbiAgICAgICAgc3RhdGVNdXRhYmlsaXR5OiAndmlldycsXG4gICAgICAgIHR5cGU6ICdmdW5jdGlvbicsXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGlucHV0czogW1xuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIG5hbWU6ICdzcGVuZGVyJyxcbiAgICAgICAgICAgICAgICB0eXBlOiAnYWRkcmVzcycsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIG5hbWU6ICdhbW91bnQnLFxuICAgICAgICAgICAgICAgIHR5cGU6ICd1aW50MjU2JyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgIF0sXG4gICAgICAgIG5hbWU6ICdhcHByb3ZlJyxcbiAgICAgICAgb3V0cHV0czogW1xuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIHR5cGU6ICdib29sJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgIF0sXG4gICAgICAgIHN0YXRlTXV0YWJpbGl0eTogJ25vbnBheWFibGUnLFxuICAgICAgICB0eXBlOiAnZnVuY3Rpb24nLFxuICAgIH0sXG4gICAge1xuICAgICAgICBpbnB1dHM6IFtdLFxuICAgICAgICBuYW1lOiAnYXNzZXQnLFxuICAgICAgICBvdXRwdXRzOiBbXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgbmFtZTogJ2Fzc2V0VG9rZW5BZGRyZXNzJyxcbiAgICAgICAgICAgICAgICB0eXBlOiAnYWRkcmVzcycsXG4gICAgICAgICAgICB9LFxuICAgICAgICBdLFxuICAgICAgICBzdGF0ZU11dGFiaWxpdHk6ICd2aWV3JyxcbiAgICAgICAgdHlwZTogJ2Z1bmN0aW9uJyxcbiAgICB9LFxuICAgIHtcbiAgICAgICAgaW5wdXRzOiBbXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgbmFtZTogJ2FjY291bnQnLFxuICAgICAgICAgICAgICAgIHR5cGU6ICdhZGRyZXNzJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgIF0sXG4gICAgICAgIG5hbWU6ICdiYWxhbmNlT2YnLFxuICAgICAgICBvdXRwdXRzOiBbXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ3VpbnQyNTYnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgXSxcbiAgICAgICAgc3RhdGVNdXRhYmlsaXR5OiAndmlldycsXG4gICAgICAgIHR5cGU6ICdmdW5jdGlvbicsXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGlucHV0czogW1xuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIG5hbWU6ICdzaGFyZXMnLFxuICAgICAgICAgICAgICAgIHR5cGU6ICd1aW50MjU2JyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgIF0sXG4gICAgICAgIG5hbWU6ICdjb252ZXJ0VG9Bc3NldHMnLFxuICAgICAgICBvdXRwdXRzOiBbXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgbmFtZTogJ2Fzc2V0cycsXG4gICAgICAgICAgICAgICAgdHlwZTogJ3VpbnQyNTYnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgXSxcbiAgICAgICAgc3RhdGVNdXRhYmlsaXR5OiAndmlldycsXG4gICAgICAgIHR5cGU6ICdmdW5jdGlvbicsXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGlucHV0czogW1xuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIG5hbWU6ICdhc3NldHMnLFxuICAgICAgICAgICAgICAgIHR5cGU6ICd1aW50MjU2JyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgIF0sXG4gICAgICAgIG5hbWU6ICdjb252ZXJ0VG9TaGFyZXMnLFxuICAgICAgICBvdXRwdXRzOiBbXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgbmFtZTogJ3NoYXJlcycsXG4gICAgICAgICAgICAgICAgdHlwZTogJ3VpbnQyNTYnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgXSxcbiAgICAgICAgc3RhdGVNdXRhYmlsaXR5OiAndmlldycsXG4gICAgICAgIHR5cGU6ICdmdW5jdGlvbicsXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGlucHV0czogW1xuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIG5hbWU6ICdhc3NldHMnLFxuICAgICAgICAgICAgICAgIHR5cGU6ICd1aW50MjU2JyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgbmFtZTogJ3JlY2VpdmVyJyxcbiAgICAgICAgICAgICAgICB0eXBlOiAnYWRkcmVzcycsXG4gICAgICAgICAgICB9LFxuICAgICAgICBdLFxuICAgICAgICBuYW1lOiAnZGVwb3NpdCcsXG4gICAgICAgIG91dHB1dHM6IFtcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBuYW1lOiAnc2hhcmVzJyxcbiAgICAgICAgICAgICAgICB0eXBlOiAndWludDI1NicsXG4gICAgICAgICAgICB9LFxuICAgICAgICBdLFxuICAgICAgICBzdGF0ZU11dGFiaWxpdHk6ICdub25wYXlhYmxlJyxcbiAgICAgICAgdHlwZTogJ2Z1bmN0aW9uJyxcbiAgICB9LFxuICAgIHtcbiAgICAgICAgaW5wdXRzOiBbXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgbmFtZTogJ2NhbGxlcicsXG4gICAgICAgICAgICAgICAgdHlwZTogJ2FkZHJlc3MnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgXSxcbiAgICAgICAgbmFtZTogJ21heERlcG9zaXQnLFxuICAgICAgICBvdXRwdXRzOiBbXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgbmFtZTogJ21heEFzc2V0cycsXG4gICAgICAgICAgICAgICAgdHlwZTogJ3VpbnQyNTYnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgXSxcbiAgICAgICAgc3RhdGVNdXRhYmlsaXR5OiAndmlldycsXG4gICAgICAgIHR5cGU6ICdmdW5jdGlvbicsXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGlucHV0czogW1xuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIG5hbWU6ICdjYWxsZXInLFxuICAgICAgICAgICAgICAgIHR5cGU6ICdhZGRyZXNzJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgIF0sXG4gICAgICAgIG5hbWU6ICdtYXhNaW50JyxcbiAgICAgICAgb3V0cHV0czogW1xuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIG5hbWU6ICdtYXhTaGFyZXMnLFxuICAgICAgICAgICAgICAgIHR5cGU6ICd1aW50MjU2JyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgIF0sXG4gICAgICAgIHN0YXRlTXV0YWJpbGl0eTogJ3ZpZXcnLFxuICAgICAgICB0eXBlOiAnZnVuY3Rpb24nLFxuICAgIH0sXG4gICAge1xuICAgICAgICBpbnB1dHM6IFtcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBuYW1lOiAnb3duZXInLFxuICAgICAgICAgICAgICAgIHR5cGU6ICdhZGRyZXNzJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgIF0sXG4gICAgICAgIG5hbWU6ICdtYXhSZWRlZW0nLFxuICAgICAgICBvdXRwdXRzOiBbXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgbmFtZTogJ21heFNoYXJlcycsXG4gICAgICAgICAgICAgICAgdHlwZTogJ3VpbnQyNTYnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgXSxcbiAgICAgICAgc3RhdGVNdXRhYmlsaXR5OiAndmlldycsXG4gICAgICAgIHR5cGU6ICdmdW5jdGlvbicsXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGlucHV0czogW1xuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIG5hbWU6ICdvd25lcicsXG4gICAgICAgICAgICAgICAgdHlwZTogJ2FkZHJlc3MnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgXSxcbiAgICAgICAgbmFtZTogJ21heFdpdGhkcmF3JyxcbiAgICAgICAgb3V0cHV0czogW1xuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIG5hbWU6ICdtYXhBc3NldHMnLFxuICAgICAgICAgICAgICAgIHR5cGU6ICd1aW50MjU2JyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgIF0sXG4gICAgICAgIHN0YXRlTXV0YWJpbGl0eTogJ3ZpZXcnLFxuICAgICAgICB0eXBlOiAnZnVuY3Rpb24nLFxuICAgIH0sXG4gICAge1xuICAgICAgICBpbnB1dHM6IFtcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBuYW1lOiAnc2hhcmVzJyxcbiAgICAgICAgICAgICAgICB0eXBlOiAndWludDI1NicsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIG5hbWU6ICdyZWNlaXZlcicsXG4gICAgICAgICAgICAgICAgdHlwZTogJ2FkZHJlc3MnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgXSxcbiAgICAgICAgbmFtZTogJ21pbnQnLFxuICAgICAgICBvdXRwdXRzOiBbXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgbmFtZTogJ2Fzc2V0cycsXG4gICAgICAgICAgICAgICAgdHlwZTogJ3VpbnQyNTYnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgXSxcbiAgICAgICAgc3RhdGVNdXRhYmlsaXR5OiAnbm9ucGF5YWJsZScsXG4gICAgICAgIHR5cGU6ICdmdW5jdGlvbicsXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGlucHV0czogW1xuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIG5hbWU6ICdhc3NldHMnLFxuICAgICAgICAgICAgICAgIHR5cGU6ICd1aW50MjU2JyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgIF0sXG4gICAgICAgIG5hbWU6ICdwcmV2aWV3RGVwb3NpdCcsXG4gICAgICAgIG91dHB1dHM6IFtcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBuYW1lOiAnc2hhcmVzJyxcbiAgICAgICAgICAgICAgICB0eXBlOiAndWludDI1NicsXG4gICAgICAgICAgICB9LFxuICAgICAgICBdLFxuICAgICAgICBzdGF0ZU11dGFiaWxpdHk6ICd2aWV3JyxcbiAgICAgICAgdHlwZTogJ2Z1bmN0aW9uJyxcbiAgICB9LFxuICAgIHtcbiAgICAgICAgaW5wdXRzOiBbXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgbmFtZTogJ3NoYXJlcycsXG4gICAgICAgICAgICAgICAgdHlwZTogJ3VpbnQyNTYnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgXSxcbiAgICAgICAgbmFtZTogJ3ByZXZpZXdNaW50JyxcbiAgICAgICAgb3V0cHV0czogW1xuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIG5hbWU6ICdhc3NldHMnLFxuICAgICAgICAgICAgICAgIHR5cGU6ICd1aW50MjU2JyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgIF0sXG4gICAgICAgIHN0YXRlTXV0YWJpbGl0eTogJ3ZpZXcnLFxuICAgICAgICB0eXBlOiAnZnVuY3Rpb24nLFxuICAgIH0sXG4gICAge1xuICAgICAgICBpbnB1dHM6IFtcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBuYW1lOiAnc2hhcmVzJyxcbiAgICAgICAgICAgICAgICB0eXBlOiAndWludDI1NicsXG4gICAgICAgICAgICB9LFxuICAgICAgICBdLFxuICAgICAgICBuYW1lOiAncHJldmlld1JlZGVlbScsXG4gICAgICAgIG91dHB1dHM6IFtcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBuYW1lOiAnYXNzZXRzJyxcbiAgICAgICAgICAgICAgICB0eXBlOiAndWludDI1NicsXG4gICAgICAgICAgICB9LFxuICAgICAgICBdLFxuICAgICAgICBzdGF0ZU11dGFiaWxpdHk6ICd2aWV3JyxcbiAgICAgICAgdHlwZTogJ2Z1bmN0aW9uJyxcbiAgICB9LFxuICAgIHtcbiAgICAgICAgaW5wdXRzOiBbXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgbmFtZTogJ2Fzc2V0cycsXG4gICAgICAgICAgICAgICAgdHlwZTogJ3VpbnQyNTYnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgXSxcbiAgICAgICAgbmFtZTogJ3ByZXZpZXdXaXRoZHJhdycsXG4gICAgICAgIG91dHB1dHM6IFtcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBuYW1lOiAnc2hhcmVzJyxcbiAgICAgICAgICAgICAgICB0eXBlOiAndWludDI1NicsXG4gICAgICAgICAgICB9LFxuICAgICAgICBdLFxuICAgICAgICBzdGF0ZU11dGFiaWxpdHk6ICd2aWV3JyxcbiAgICAgICAgdHlwZTogJ2Z1bmN0aW9uJyxcbiAgICB9LFxuICAgIHtcbiAgICAgICAgaW5wdXRzOiBbXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgbmFtZTogJ3NoYXJlcycsXG4gICAgICAgICAgICAgICAgdHlwZTogJ3VpbnQyNTYnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBuYW1lOiAncmVjZWl2ZXInLFxuICAgICAgICAgICAgICAgIHR5cGU6ICdhZGRyZXNzJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgbmFtZTogJ293bmVyJyxcbiAgICAgICAgICAgICAgICB0eXBlOiAnYWRkcmVzcycsXG4gICAgICAgICAgICB9LFxuICAgICAgICBdLFxuICAgICAgICBuYW1lOiAncmVkZWVtJyxcbiAgICAgICAgb3V0cHV0czogW1xuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIG5hbWU6ICdhc3NldHMnLFxuICAgICAgICAgICAgICAgIHR5cGU6ICd1aW50MjU2JyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgIF0sXG4gICAgICAgIHN0YXRlTXV0YWJpbGl0eTogJ25vbnBheWFibGUnLFxuICAgICAgICB0eXBlOiAnZnVuY3Rpb24nLFxuICAgIH0sXG4gICAge1xuICAgICAgICBpbnB1dHM6IFtdLFxuICAgICAgICBuYW1lOiAndG90YWxBc3NldHMnLFxuICAgICAgICBvdXRwdXRzOiBbXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgbmFtZTogJ3RvdGFsTWFuYWdlZEFzc2V0cycsXG4gICAgICAgICAgICAgICAgdHlwZTogJ3VpbnQyNTYnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgXSxcbiAgICAgICAgc3RhdGVNdXRhYmlsaXR5OiAndmlldycsXG4gICAgICAgIHR5cGU6ICdmdW5jdGlvbicsXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGlucHV0czogW10sXG4gICAgICAgIG5hbWU6ICd0b3RhbFN1cHBseScsXG4gICAgICAgIG91dHB1dHM6IFtcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICB0eXBlOiAndWludDI1NicsXG4gICAgICAgICAgICB9LFxuICAgICAgICBdLFxuICAgICAgICBzdGF0ZU11dGFiaWxpdHk6ICd2aWV3JyxcbiAgICAgICAgdHlwZTogJ2Z1bmN0aW9uJyxcbiAgICB9LFxuICAgIHtcbiAgICAgICAgaW5wdXRzOiBbXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgbmFtZTogJ3RvJyxcbiAgICAgICAgICAgICAgICB0eXBlOiAnYWRkcmVzcycsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIG5hbWU6ICdhbW91bnQnLFxuICAgICAgICAgICAgICAgIHR5cGU6ICd1aW50MjU2JyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgIF0sXG4gICAgICAgIG5hbWU6ICd0cmFuc2ZlcicsXG4gICAgICAgIG91dHB1dHM6IFtcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICB0eXBlOiAnYm9vbCcsXG4gICAgICAgICAgICB9LFxuICAgICAgICBdLFxuICAgICAgICBzdGF0ZU11dGFiaWxpdHk6ICdub25wYXlhYmxlJyxcbiAgICAgICAgdHlwZTogJ2Z1bmN0aW9uJyxcbiAgICB9LFxuICAgIHtcbiAgICAgICAgaW5wdXRzOiBbXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgbmFtZTogJ2Zyb20nLFxuICAgICAgICAgICAgICAgIHR5cGU6ICdhZGRyZXNzJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgbmFtZTogJ3RvJyxcbiAgICAgICAgICAgICAgICB0eXBlOiAnYWRkcmVzcycsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIG5hbWU6ICdhbW91bnQnLFxuICAgICAgICAgICAgICAgIHR5cGU6ICd1aW50MjU2JyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgIF0sXG4gICAgICAgIG5hbWU6ICd0cmFuc2ZlckZyb20nLFxuICAgICAgICBvdXRwdXRzOiBbXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgdHlwZTogJ2Jvb2wnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgXSxcbiAgICAgICAgc3RhdGVNdXRhYmlsaXR5OiAnbm9ucGF5YWJsZScsXG4gICAgICAgIHR5cGU6ICdmdW5jdGlvbicsXG4gICAgfSxcbiAgICB7XG4gICAgICAgIGlucHV0czogW1xuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIG5hbWU6ICdhc3NldHMnLFxuICAgICAgICAgICAgICAgIHR5cGU6ICd1aW50MjU2JyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgbmFtZTogJ3JlY2VpdmVyJyxcbiAgICAgICAgICAgICAgICB0eXBlOiAnYWRkcmVzcycsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIG5hbWU6ICdvd25lcicsXG4gICAgICAgICAgICAgICAgdHlwZTogJ2FkZHJlc3MnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgXSxcbiAgICAgICAgbmFtZTogJ3dpdGhkcmF3JyxcbiAgICAgICAgb3V0cHV0czogW1xuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIG5hbWU6ICdzaGFyZXMnLFxuICAgICAgICAgICAgICAgIHR5cGU6ICd1aW50MjU2JyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgIF0sXG4gICAgICAgIHN0YXRlTXV0YWJpbGl0eTogJ25vbnBheWFibGUnLFxuICAgICAgICB0eXBlOiAnZnVuY3Rpb24nLFxuICAgIH0sXG5dO1xuLy8jIHNvdXJjZU1hcHBpbmdVUkw9YWJpcy5qcy5tYXAiLAogICAgImV4cG9ydCBjb25zdCBhZ2dyZWdhdGUzU2lnbmF0dXJlID0gJzB4ODJhZDU2Y2InO1xuLy8jIHNvdXJjZU1hcHBpbmdVUkw9Y29udHJhY3QuanMubWFwIiwKICAgICJleHBvcnQgY29uc3QgZGVwbG95bGVzc0NhbGxWaWFCeXRlY29kZUJ5dGVjb2RlID0gJzB4NjA4MDYwNDA1MjM0ODAxNTYxMDAxMDU3NjAwMDgwZmQ1YjUwNjA0MDUxNjEwMThlMzgwMzgwNjEwMThlODMzOTgxMDE2MDQwODE5MDUyNjEwMDJmOTE2MTAxMjQ1NjViNjAwMDgwODM1MTYwMjA4NTAxNjAwMGY1OTA1MDgwM2I2MTAwNDg1NzYwMDA4MGZkNWI2MDAwODA4MzUxNjAyMDg1MDE2MDAwODU1YWYxNjA0MDUxM2Q2MDAwODIzZTgxNjEwMDY3NTczZDgxZmQ1YjNkODFmMzViNjM0ZTQ4N2I3MTYwZTAxYjYwMDA1MjYwNDE2MDA0NTI2MDI0NjAwMGZkNWI2MDAwODI2MDFmODMwMTEyNjEwMDkyNTc2MDAwODBmZDViODE1MTYwMDE2MDAxNjA0MDFiMDM4MTExMTU2MTAwYWI1NzYxMDBhYjYxMDA2YjU2NWI2MDQwNTE2MDFmODIwMTYwMWYxOTkwODExNjYwM2YwMTE2ODEwMTYwMDE2MDAxNjA0MDFiMDM4MTExODI4MjEwMTcxNTYxMDBkOTU3NjEwMGQ5NjEwMDZiNTY1YjYwNDA1MjgxODE1MjgzODIwMTYwMjAwMTg1MTAxNTYxMDBmMTU3NjAwMDgwZmQ1YjYwMDA1YjgyODExMDE1NjEwMTEwNTc2MDIwODE4NjAxODEwMTUxODM4MzAxODIwMTUyMDE2MTAwZjQ1NjViNTA2MDAwOTE4MTAxNjAyMDAxOTE5MDkxNTI5MzkyNTA1MDUwNTY1YjYwMDA4MDYwNDA4Mzg1MDMxMjE1NjEwMTM3NTc2MDAwODBmZDViODI1MTYwMDE2MDAxNjA0MDFiMDM4MTExMTU2MTAxNGQ1NzYwMDA4MGZkNWI2MTAxNTk4NTgyODYwMTYxMDA4MTU2NWI2MDIwODUwMTUxOTA5MzUwOTA1MDYwMDE2MDAxNjA0MDFiMDM4MTExMTU2MTAxNzc1NzYwMDA4MGZkNWI2MTAxODM4NTgyODYwMTYxMDA4MTU2NWI5MTUwNTA5MjUwOTI5MDUwNTZmZSc7XG5leHBvcnQgY29uc3QgZGVwbG95bGVzc0NhbGxWaWFGYWN0b3J5Qnl0ZWNvZGUgPSAnMHg2MDgwNjA0MDUyMzQ4MDE1NjEwMDEwNTc2MDAwODBmZDViNTA2MDQwNTE2MTAyYzAzODAzODA2MTAyYzA4MzM5ODEwMTYwNDA4MTkwNTI2MTAwMmY5MTYxMDFlNjU2NWI4MzYwMDE2MDAxNjBhMDFiMDMxNjNiNjAwMDAzNjEwMGU0NTc2MDAwODA4MzYwMDE2MDAxNjBhMDFiMDMxNjgzNjA0MDUxNjEwMDVjOTE5MDYxMDI3MDU2NWI2MDAwNjA0MDUxODA4MzAzODE2MDAwODY1YWYxOTE1MDUwM2Q4MDYwMDA4MTE0NjEwMDk5NTc2MDQwNTE5MTUwNjAxZjE5NjAzZjNkMDExNjgyMDE2MDQwNTIzZDgyNTIzZDYwMDA2MDIwODQwMTNlNjEwMDllNTY1YjYwNjA5MTUwNWI1MDkxNTA5MTUwODExNTgwNjEwMGI4NTc1MDYwMDE2MDAxNjBhMDFiMDM4NjE2M2IxNTViMTU2MTAwZTE1NzgwNjA0MDUxNjMxMDFiYjk4ZDYwZTAxYjgxNTI2MDA0MDE2MTAwZDg5MTkwNjEwMjhjNTY1YjYwNDA1MTgwOTEwMzkwZmQ1YjUwNTA1YjYwMDA4MDg0NTE2MDIwODYwMTYwMDA4ODVhZjE2MDQwNTEzZDYwMDA4MjNlODE2MTAxMDM1NzNkODFmZDViM2Q4MWYzNWI4MDUxNjAwMTYwMDE2MGEwMWIwMzgxMTY4MTE0NjEwMTFlNTc2MDAwODBmZDViOTE5MDUwNTY1YjYzNGU0ODdiNzE2MGUwMWI2MDAwNTI2MDQxNjAwNDUyNjAyNDYwMDBmZDViNjAwMDViODM4MTEwMTU2MTAxNTQ1NzgxODEwMTUxODM4MjAxNTI2MDIwMDE2MTAxM2M1NjViNTA1MDYwMDA5MTAxNTI1NjViNjAwMDgyNjAxZjgzMDExMjYxMDE2ZTU3NjAwMDgwZmQ1YjgxNTE2MDAxNjAwMTYwNDAxYjAzODExMTE1NjEwMTg3NTc2MTAxODc2MTAxMjM1NjViNjA0MDUxNjAxZjgyMDE2MDFmMTk5MDgxMTY2MDNmMDExNjgxMDE2MDAxNjAwMTYwNDAxYjAzODExMTgyODIxMDE3MTU2MTAxYjU1NzYxMDFiNTYxMDEyMzU2NWI2MDQwNTI4MTgxNTI4MzgyMDE2MDIwMDE4NTEwMTU2MTAxY2Q1NzYwMDA4MGZkNWI2MTAxZGU4MjYwMjA4MzAxNjAyMDg3MDE2MTAxMzk1NjViOTQ5MzUwNTA1MDUwNTY1YjYwMDA4MDYwMDA4MDYwODA4NTg3MDMxMjE1NjEwMWZjNTc2MDAwODBmZDViNjEwMjA1ODU2MTAxMDc1NjViNjAyMDg2MDE1MTkwOTQ1MDYwMDE2MDAxNjA0MDFiMDM4MTExMTU2MTAyMjE1NzYwMDA4MGZkNWI2MTAyMmQ4NzgyODgwMTYxMDE1ZDU2NWI5MzUwNTA2MTAyM2M2MDQwODYwMTYxMDEwNzU2NWI2MDYwODYwMTUxOTA5MjUwNjAwMTYwMDE2MDQwMWIwMzgxMTExNTYxMDI1ODU3NjAwMDgwZmQ1YjYxMDI2NDg3ODI4ODAxNjEwMTVkNTY1YjkxNTA1MDkyOTU5MTk0NTA5MjUwNTY1YjYwMDA4MjUxNjEwMjgyODE4NDYwMjA4NzAxNjEwMTM5NTY1YjkxOTA5MTAxOTI5MTUwNTA1NjViNjAyMDgxNTI2MDAwODI1MTgwNjAyMDg0MDE1MjYxMDJhYjgxNjA0MDg1MDE2MDIwODcwMTYxMDEzOTU2NWI2MDFmMDE2MDFmMTkxNjkxOTA5MTAxNjA0MDAxOTI5MTUwNTA1NmZlJztcbmV4cG9ydCBjb25zdCBlcmM2NDkyU2lnbmF0dXJlVmFsaWRhdG9yQnl0ZUNvZGUgPSAnMHg2MDgwNjA0MDUyMzQ4MDE1NjEwMDEwNTc2MDAwODBmZDViNTA2MDQwNTE2MTA2OTQzODAzODA2MTA2OTQ4MzM5ODEwMTYwNDA4MTkwNTI2MTAwMmY5MTYxMDUxZTU2NWI2MDAwNjEwMDNjODQ4NDg0NjEwMDQ4NTY1YjkwNTA4MDYwMDA1MjYwMDE2MDFmZjM1YjYwMDA3ZjY0OTI2NDkyNjQ5MjY0OTI2NDkyNjQ5MjY0OTI2NDkyNjQ5MjY0OTI2NDkyNjQ5MjY0OTI2NDkyNjQ5MjY0OTI2MTAwNzQ4MzYxMDQwYzU2NWIwMzYxMDFlNzU3NjAwMDYwNjA4MDg0ODA2MDIwMDE5MDUxODEwMTkwNjEwMDkyOTE5MDYxMDU3NzU2NWI2MDQwNTE5Mjk1NTA5MDkzNTA5MTUwNjAwMDkwNjAwMTYwMDE2MGEwMWIwMzg1MTY5MDYxMDBiNjkwODU5MDYxMDVkZDU2NWI2MDAwNjA0MDUxODA4MzAzODE2MDAwODY1YWYxOTE1MDUwM2Q4MDYwMDA4MTE0NjEwMGYzNTc2MDQwNTE5MTUwNjAxZjE5NjAzZjNkMDExNjgyMDE2MDQwNTIzZDgyNTIzZDYwMDA2MDIwODQwMTNlNjEwMGY4NTY1YjYwNjA5MTUwNWI1MDUwOTA1MDg3NjAwMTYwMDE2MGEwMWIwMzE2M2I2MDAwMDM2MTAxNjA1NzgwNjEwMTYwNTc2MDQwNTE2MjQ2MWJjZDYwZTUxYjgxNTI2MDIwNjAwNDgyMDE1MjYwMWU2MDI0ODIwMTUyN2Y1MzY5Njc2ZTYxNzQ3NTcyNjU1NjYxNmM2OTY0NjE3NDZmNzIzYTIwNjQ2NTcwNmM2Zjc5NmQ2NTZlNzQwMDAwNjA0NDgyMDE1MjYwNjQwMTViNjA0MDUxODA5MTAzOTBmZDViNjA0MDUxNjMwYjEzNWQzZjYwZTExYjgwODI1MjkwNjAwMTYwMDE2MGEwMWIwMzhhMTY5MDYzMTYyNmJhN2U5MDYxMDE5MDkwOGI5MDg3OTA2MDA0MDE2MTA1Zjk1NjViNjAyMDYwNDA1MTgwODMwMzgxODY1YWZhMTU4MDE1NjEwMWFkNTczZDYwMDA4MDNlM2Q2MDAwZmQ1YjUwNTA1MDUwNjA0MDUxM2Q2MDFmMTk2MDFmODIwMTE2ODIwMTgwNjA0MDUyNTA4MTAxOTA2MTAxZDE5MTkwNjEwNjMzNTY1YjYwMDE2MDAxNjBlMDFiMDMxOTE2MTQ5NDUwNTA1MDUwNTA2MTA0MDU1NjViNjAwMTYwMDE2MGEwMWIwMzg0MTYzYjE1NjEwMjdhNTc2MDQwNTE2MzBiMTM1ZDNmNjBlMTFiODA4MjUyOTA2MDAxNjAwMTYwYTAxYjAzODYxNjkwNjMxNjI2YmE3ZTkwNjEwMjI3OTA4NzkwODc5MDYwMDQwMTYxMDVmOTU2NWI2MDIwNjA0MDUxODA4MzAzODE4NjVhZmExNTgwMTU2MTAyNDQ1NzNkNjAwMDgwM2UzZDYwMDBmZDViNTA1MDUwNTA2MDQwNTEzZDYwMWYxOTYwMWY4MjAxMTY4MjAxODA2MDQwNTI1MDgxMDE5MDYxMDI2ODkxOTA2MTA2MzM1NjViNjAwMTYwMDE2MGUwMWIwMzE5MTYxNDkwNTA2MTA0MDU1NjViODE1MTYwNDExNDYxMDJkZjU3NjA0MDUxNjI0NjFiY2Q2MGU1MWI4MTUyNjAyMDYwMDQ4MjAxNTI2MDNhNjAyNDgyMDE1MjYwMDA4MDUxNjAyMDYxMDY3NDgzMzk4MTUxOTE1MjYwNDQ4MjAxNTI3ZjNhMjA2OTZlNzY2MTZjNjk2NDIwNzM2OTY3NmU2MTc0NzU3MjY1MjA2YzY1NmU2Nzc0NjgwMDAwMDAwMDAwMDA2MDY0ODIwMTUyNjA4NDAxNjEwMTU3NTY1YjYxMDJlNzYxMDQyNTU2NWI1MDYwMjA4MjAxNTE2MDQwODA4NDAxNTE4NDUxODU5MzkyNjAwMDkxODU5MTkwODExMDYxMDMwYzU3NjEwMzBjNjEwNjVkNTY1YjAxNjAyMDAxNTE2MGY4MWM5MDUwNjAxYjgxMTQ4MDE1OTA2MTAzMmI1NzUwODA2MGZmMTY2MDFjMTQxNTViMTU2MTAzOGM1NzYwNDA1MTYyNDYxYmNkNjBlNTFiODE1MjYwMjA2MDA0ODIwMTUyNjAzYjYwMjQ4MjAxNTI2MDAwODA1MTYwMjA2MTA2NzQ4MzM5ODE1MTkxNTI2MDQ0ODIwMTUyN2YzYTIwNjk2ZTc2NjE2YzY5NjQyMDczNjk2NzZlNjE3NDc1NzI2NTIwNzYyMDc2NjE2Yzc1NjUwMDAwMDAwMDAwNjA2NDgyMDE1MjYwODQwMTYxMDE1NzU2NWI2MDQwODA1MTYwMDA4MTUyNjAyMDgxMDE4MDgzNTI4OTkwNTI2MGZmODMxNjkxODEwMTkxOTA5MTUyNjA2MDgxMDE4NDkwNTI2MDgwODEwMTgzOTA1MjYwMDE2MDAxNjBhMDFiMDM4OTE2OTA2MDAxOTA2MGEwMDE2MDIwNjA0MDUxNjAyMDgxMDM5MDgwODQwMzkwODU1YWZhMTU4MDE1NjEwM2VhNTczZDYwMDA4MDNlM2Q2MDAwZmQ1YjUwNTA1MDYwMjA2MDQwNTEwMzUxNjAwMTYwMDE2MGEwMWIwMzE2MTQ5NDUwNTA1MDUwNTA1YjkzOTI1MDUwNTA1NjViNjAwMDYwMjA4MjUxMTAxNTYxMDQxZDU3NjAwMDgwZmQ1YjUwODA1MTAxNTE5MDU2NWI2MDQwNTE4MDYwNjAwMTYwNDA1MjgwNjAwMzkwNjAyMDgyMDI4MDM2ODMzNzUwOTE5MjkxNTA1MDU2NWI2MDAxNjAwMTYwYTAxYjAzODExNjgxMTQ2MTA0NTg1NzYwMDA4MGZkNWI1MDU2NWI2MzRlNDg3YjcxNjBlMDFiNjAwMDUyNjA0MTYwMDQ1MjYwMjQ2MDAwZmQ1YjYwMDA1YjgzODExMDE1NjEwNDhjNTc4MTgxMDE1MTgzODIwMTUyNjAyMDAxNjEwNDc0NTY1YjUwNTA2MDAwOTEwMTUyNTY1YjYwMDA4MjYwMWY4MzAxMTI2MTA0YTY1NzYwMDA4MGZkNWI4MTUxNjAwMTYwMDE2MDQwMWIwMzgxMTExNTYxMDRiZjU3NjEwNGJmNjEwNDViNTY1YjYwNDA1MTYwMWY4MjAxNjAxZjE5OTA4MTE2NjAzZjAxMTY4MTAxNjAwMTYwMDE2MDQwMWIwMzgxMTE4MjgyMTAxNzE1NjEwNGVkNTc2MTA0ZWQ2MTA0NWI1NjViNjA0MDUyODE4MTUyODM4MjAxNjAyMDAxODUxMDE1NjEwNTA1NTc2MDAwODBmZDViNjEwNTE2ODI2MDIwODMwMTYwMjA4NzAxNjEwNDcxNTY1Yjk0OTM1MDUwNTA1MDU2NWI2MDAwODA2MDAwNjA2MDg0ODYwMzEyMTU2MTA1MzM1NzYwMDA4MGZkNWI4MzUxNjEwNTNlODE2MTA0NDM1NjViNjAyMDg1MDE1MTYwNDA4NjAxNTE5MTk0NTA5MjUwNjAwMTYwMDE2MDQwMWIwMzgxMTExNTYxMDU2MTU3NjAwMDgwZmQ1YjYxMDU2ZDg2ODI4NzAxNjEwNDk1NTY1YjkxNTA1MDkyNTA5MjUwOTI1NjViNjAwMDgwNjAwMDYwNjA4NDg2MDMxMjE1NjEwNThjNTc2MDAwODBmZDViODM1MTYxMDU5NzgxNjEwNDQzNTY1YjYwMjA4NTAxNTE5MDkzNTA2MDAxNjAwMTYwNDAxYjAzODExMTE1NjEwNWIzNTc2MDAwODBmZDViNjEwNWJmODY4Mjg3MDE2MTA0OTU1NjViNjA0MDg2MDE1MTkwOTM1MDkwNTA2MDAxNjAwMTYwNDAxYjAzODExMTE1NjEwNTYxNTc2MDAwODBmZDViNjAwMDgyNTE2MTA1ZWY4MTg0NjAyMDg3MDE2MTA0NzE1NjViOTE5MDkxMDE5MjkxNTA1MDU2NWI4MjgxNTI2MDQwNjAyMDgyMDE1MjYwMDA4MjUxODA2MDQwODQwMTUyNjEwNjFlODE2MDYwODUwMTYwMjA4NzAxNjEwNDcxNTY1YjYwMWYwMTYwMWYxOTE2OTE5MDkxMDE2MDYwMDE5MzkyNTA1MDUwNTY1YjYwMDA2MDIwODI4NDAzMTIxNTYxMDY0NTU3NjAwMDgwZmQ1YjgxNTE2MDAxNjAwMTYwZTAxYjAzMTk4MTE2ODExNDYxMDQwNTU3NjAwMDgwZmQ1YjYzNGU0ODdiNzE2MGUwMWI2MDAwNTI2MDMyNjAwNDUyNjAyNDYwMDBmZGZlNTM2OTY3NmU2MTc0NzU3MjY1NTY2MTZjNjk2NDYxNzQ2ZjcyMjM3MjY1NjM2Zjc2NjU3MjUzNjk2NzZlNjU3Mic7XG5leHBvcnQgY29uc3QgbXVsdGljYWxsM0J5dGVjb2RlID0gJzB4NjA4MDYwNDA1MjM0ODAxNTYxMDAxMDU3NjAwMDgwZmQ1YjUwNjExNWI5ODA2MTAwMjA2MDAwMzk2MDAwZjNmZTYwODA2MDQwNTI2MDA0MzYxMDYxMDBmMzU3NjAwMDM1NjBlMDFjODA2MzRkMjMwMWNjMTE2MTAwOGE1NzgwNjNhOGIwNTc0ZTExNjEwMDU5NTc4MDYzYThiMDU3NGUxNDYxMDMyNTU3ODA2M2JjZTM4YmQ3MTQ2MTAzNTA1NzgwNjNjMzA3N2ZhOTE0NjEwMzgwNTc4MDYzZWU4MmFjNWUxNDYxMDNiMjU3NjEwMGYzNTY1YjgwNjM0ZDIzMDFjYzE0NjEwMjYyNTc4MDYzNzI0MjVkOWQxNDYxMDI5ZjU3ODA2MzgyYWQ1NmNiMTQ2MTAyY2E1NzgwNjM4NmQ1MTZlODE0NjEwMmZhNTc2MTAwZjM1NjViODA2MzM0MDhlNDcwMTE2MTAwYzY1NzgwNjMzNDA4ZTQ3MDE0NjEwMWFmNTc4MDYzMzk5NTQyZTkxNDYxMDFkYTU3ODA2MzNlNjRhNjk2MTQ2MTAyMGM1NzgwNjM0MmNiYjE1YzE0NjEwMjM3NTc2MTAwZjM1NjViODA2MzBmMjhjOTdkMTQ2MTAwZjg1NzgwNjMxNzRkZWE3MTE0NjEwMTIzNTc4MDYzMjUyZGJhNDIxNDYxMDE1MzU3ODA2MzI3ZTg2ZDZlMTQ2MTAxODQ1NzViNjAwMDgwZmQ1YjM0ODAxNTYxMDEwNDU3NjAwMDgwZmQ1YjUwNjEwMTBkNjEwM2VmNTY1YjYwNDA1MTYxMDExYTkxOTA2MTBjMGE1NjViNjA0MDUxODA5MTAzOTBmMzViNjEwMTNkNjAwNDgwMzYwMzgxMDE5MDYxMDEzODkxOTA2MTBjOTQ1NjViNjEwM2Y3NTY1YjYwNDA1MTYxMDE0YTkxOTA2MTBlOTQ1NjViNjA0MDUxODA5MTAzOTBmMzViNjEwMTZkNjAwNDgwMzYwMzgxMDE5MDYxMDE2ODkxOTA2MTBmMGM1NjViNjEwNjE1NTY1YjYwNDA1MTYxMDE3YjkyOTE5MDYxMTAxYjU2NWI2MDQwNTE4MDkxMDM5MGYzNWIzNDgwMTU2MTAxOTA1NzYwMDA4MGZkNWI1MDYxMDE5OTYxMDdhYjU2NWI2MDQwNTE2MTAxYTY5MTkwNjExMDY0NTY1YjYwNDA1MTgwOTEwMzkwZjM1YjM0ODAxNTYxMDFiYjU3NjAwMDgwZmQ1YjUwNjEwMWM0NjEwN2I3NTY1YjYwNDA1MTYxMDFkMTkxOTA2MTBjMGE1NjViNjA0MDUxODA5MTAzOTBmMzViNjEwMWY0NjAwNDgwMzYwMzgxMDE5MDYxMDFlZjkxOTA2MTEwYWI1NjViNjEwN2JmNTY1YjYwNDA1MTYxMDIwMzkzOTI5MTkwNjExMTBiNTY1YjYwNDA1MTgwOTEwMzkwZjM1YjM0ODAxNTYxMDIxODU3NjAwMDgwZmQ1YjUwNjEwMjIxNjEwN2UxNTY1YjYwNDA1MTYxMDIyZTkxOTA2MTBjMGE1NjViNjA0MDUxODA5MTAzOTBmMzViMzQ4MDE1NjEwMjQzNTc2MDAwODBmZDViNTA2MTAyNGM2MTA3ZTk1NjViNjA0MDUxNjEwMjU5OTE5MDYxMGMwYTU2NWI2MDQwNTE4MDkxMDM5MGYzNWIzNDgwMTU2MTAyNmU1NzYwMDA4MGZkNWI1MDYxMDI4OTYwMDQ4MDM2MDM4MTAxOTA2MTAyODQ5MTkwNjExMWE3NTY1YjYxMDdmMTU2NWI2MDQwNTE2MTAyOTY5MTkwNjEwYzBhNTY1YjYwNDA1MTgwOTEwMzkwZjM1YjM0ODAxNTYxMDJhYjU3NjAwMDgwZmQ1YjUwNjEwMmI0NjEwODEyNTY1YjYwNDA1MTYxMDJjMTkxOTA2MTBjMGE1NjViNjA0MDUxODA5MTAzOTBmMzViNjEwMmU0NjAwNDgwMzYwMzgxMDE5MDYxMDJkZjkxOTA2MTEyMmE1NjViNjEwODFhNTY1YjYwNDA1MTYxMDJmMTkxOTA2MTBlOTQ1NjViNjA0MDUxODA5MTAzOTBmMzViMzQ4MDE1NjEwMzA2NTc2MDAwODBmZDViNTA2MTAzMGY2MTA5ZTQ1NjViNjA0MDUxNjEwMzFjOTE5MDYxMGMwYTU2NWI2MDQwNTE4MDkxMDM5MGYzNWIzNDgwMTU2MTAzMzE1NzYwMDA4MGZkNWI1MDYxMDMzYTYxMDllYzU2NWI2MDQwNTE2MTAzNDc5MTkwNjExMjg2NTY1YjYwNDA1MTgwOTEwMzkwZjM1YjYxMDM2YTYwMDQ4MDM2MDM4MTAxOTA2MTAzNjU5MTkwNjExMGFiNTY1YjYxMDlmNDU2NWI2MDQwNTE2MTAzNzc5MTkwNjEwZTk0NTY1YjYwNDA1MTgwOTEwMzkwZjM1YjYxMDM5YTYwMDQ4MDM2MDM4MTAxOTA2MTAzOTU5MTkwNjEwZjBjNTY1YjYxMGJhNjU2NWI2MDQwNTE2MTAzYTk5MzkyOTE5MDYxMTEwYjU2NWI2MDQwNTE4MDkxMDM5MGYzNWIzNDgwMTU2MTAzYmU1NzYwMDA4MGZkNWI1MDYxMDNkOTYwMDQ4MDM2MDM4MTAxOTA2MTAzZDQ5MTkwNjExMmNkNTY1YjYxMGJjYTU2NWI2MDQwNTE2MTAzZTY5MTkwNjExMDY0NTY1YjYwNDA1MTgwOTEwMzkwZjM1YjYwMDA0MjkwNTA5MDU2NWI2MDYwNjAwMDgwODQ4NDkwNTA5MDUwODA2N2ZmZmZmZmZmZmZmZmZmZmY4MTExMTU2MTA0MWM1NzYxMDQxYjYxMTJmYTU2NWI1YjYwNDA1MTkwODA4MjUyODA2MDIwMDI2MDIwMDE4MjAxNjA0MDUyODAxNTYxMDQ1NTU3ODE2MDIwMDE1YjYxMDQ0MjYxMGJkNTU2NWI4MTUyNjAyMDAxOTA2MDAxOTAwMzkwODE2MTA0M2E1NzkwNTA1YjUwOTI1MDM2NjAwMDViODI4MTEwMTU2MTA1Yzk1NzYwMDA4NTgyODE1MTgxMTA2MTA0Nzk1NzYxMDQ3ODYxMTMyOTU2NWI1YjYwMjAwMjYwMjAwMTAxNTE5MDUwODc4NzgzODE4MTEwNjEwNDk2NTc2MTA0OTU2MTEzMjk1NjViNWI5MDUwNjAyMDAyODEwMTkwNjEwNGE4OTE5MDYxMTM2NzU2NWI5MjUwNjAwMDgzNjA0MDAxMzU5MDUwODA4NjAxOTU1MDgzNjAwMDAxNjAyMDgxMDE5MDYxMDRjYjkxOTA2MTExYTc1NjViNzNmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmMTY4MTg1ODA2MDYwMDE5MDYxMDRmMjkxOTA2MTEzOGY1NjViNjA0MDUxNjEwNTAwOTI5MTkwNjExNDMxNTY1YjYwMDA2MDQwNTE4MDgzMDM4MTg1ODc1YWYxOTI1MDUwNTAzZDgwNjAwMDgxMTQ2MTA1M2Q1NzYwNDA1MTkxNTA2MDFmMTk2MDNmM2QwMTE2ODIwMTYwNDA1MjNkODI1MjNkNjAwMDYwMjA4NDAxM2U2MTA1NDI1NjViNjA2MDkxNTA1YjUwODM2MDAwMDE4NDYwMjAwMTgyOTA1MjgyMTUxNTE1MTU4MTUyNTA1MDUwODE1MTYwMjA4NTAxMzUxNzYxMDViYzU3N2YwOGMzNzlhMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwNjAwMDUyNjAyMDYwMDQ1MjYwMTc2MDI0NTI3ZjRkNzU2Yzc0Njk2MzYxNmM2YzMzM2EyMDYzNjE2YzZjMjA2NjYxNjk2YzY1NjQwMDAwMDAwMDAwMDAwMDAwMDA2MDQ0NTI2MDg0NjAwMGZkNWI4MjYwMDEwMTkyNTA1MDUwNjEwNDVjNTY1YjUwODIzNDE0NjEwNjBjNTc2MDQwNTE3ZjA4YzM3OWEwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDA4MTUyNjAwNDAxNjEwNjAzOTA2MTE0YTc1NjViNjA0MDUxODA5MTAzOTBmZDViNTA1MDUwOTI5MTUwNTA1NjViNjAwMDYwNjA0MzkxNTA2MDAwODQ4NDkwNTA5MDUwODA2N2ZmZmZmZmZmZmZmZmZmZmY4MTExMTU2MTA2M2U1NzYxMDYzZDYxMTJmYTU2NWI1YjYwNDA1MTkwODA4MjUyODA2MDIwMDI2MDIwMDE4MjAxNjA0MDUyODAxNTYxMDY3MTU3ODE2MDIwMDE1YjYwNjA4MTUyNjAyMDAxOTA2MDAxOTAwMzkwODE2MTA2NWM1NzkwNTA1YjUwOTE1MDM2NjAwMDViODI4MTEwMTU2MTA3YTE1NzYwMDA4Nzg3ODM4MTgxMTA2MTA2OTU1NzYxMDY5NDYxMTMyOTU2NWI1YjkwNTA2MDIwMDI4MTAxOTA2MTA2YTc5MTkwNjExNGM3NTY1YjkyNTA4MjYwMDAwMTYwMjA4MTAxOTA2MTA2YmM5MTkwNjExMWE3NTY1YjczZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZjE2ODM4MDYwMjAwMTkwNjEwNmUyOTE5MDYxMTM4ZjU2NWI2MDQwNTE2MTA2ZjA5MjkxOTA2MTE0MzE1NjViNjAwMDYwNDA1MTgwODMwMzgxNjAwMDg2NWFmMTkxNTA1MDNkODA2MDAwODExNDYxMDcyZDU3NjA0MDUxOTE1MDYwMWYxOTYwM2YzZDAxMTY4MjAxNjA0MDUyM2Q4MjUyM2Q2MDAwNjAyMDg0MDEzZTYxMDczMjU2NWI2MDYwOTE1MDViNTA4Njg0ODE1MTgxMTA2MTA3NDY1NzYxMDc0NTYxMTMyOTU2NWI1YjYwMjAwMjYwMjAwMTAxODE5MDUyODE5MjUwNTA1MDgwNjEwNzk1NTc2MDQwNTE3ZjA4YzM3OWEwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDA4MTUyNjAwNDAxNjEwNzhjOTA2MTE1M2I1NjViNjA0MDUxODA5MTAzOTBmZDViODE2MDAxMDE5MTUwNTA2MTA2Nzg1NjViNTA1MDUwOTI1MDkyOTA1MDU2NWI2MDAwNjAwMTQzMDM0MDkwNTA5MDU2NWI2MDAwNDY5MDUwOTA1NjViNjAwMDgwNjA2MDQzOTI1MDQzNDA5MTUwNjEwN2Q2ODY4Njg2NjEwOWY0NTY1YjkwNTA5MzUwOTM1MDkzOTA1MDU2NWI2MDAwNDg5MDUwOTA1NjViNjAwMDQzOTA1MDkwNTY1YjYwMDA4MTczZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZjE2MzE5MDUwOTE5MDUwNTY1YjYwMDA0NDkwNTA5MDU2NWI2MDYwNjAwMDgzODM5MDUwOTA1MDgwNjdmZmZmZmZmZmZmZmZmZmZmODExMTE1NjEwODNlNTc2MTA4M2Q2MTEyZmE1NjViNWI2MDQwNTE5MDgwODI1MjgwNjAyMDAyNjAyMDAxODIwMTYwNDA1MjgwMTU2MTA4Nzc1NzgxNjAyMDAxNWI2MTA4NjQ2MTBiZDU1NjViODE1MjYwMjAwMTkwNjAwMTkwMDM5MDgxNjEwODVjNTc5MDUwNWI1MDkxNTAzNjYwMDA1YjgyODExMDE1NjEwOWRiNTc2MDAwODQ4MjgxNTE4MTEwNjEwODliNTc2MTA4OWE2MTEzMjk1NjViNWI2MDIwMDI2MDIwMDEwMTUxOTA1MDg2ODY4MzgxODExMDYxMDhiODU3NjEwOGI3NjExMzI5NTY1YjViOTA1MDYwMjAwMjgxMDE5MDYxMDhjYTkxOTA2MTE1NWI1NjViOTI1MDgyNjAwMDAxNjAyMDgxMDE5MDYxMDhkZjkxOTA2MTExYTc1NjViNzNmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmMTY4MzgwNjA0MDAxOTA2MTA5MDU5MTkwNjExMzhmNTY1YjYwNDA1MTYxMDkxMzkyOTE5MDYxMTQzMTU2NWI2MDAwNjA0MDUxODA4MzAzODE2MDAwODY1YWYxOTE1MDUwM2Q4MDYwMDA4MTE0NjEwOTUwNTc2MDQwNTE5MTUwNjAxZjE5NjAzZjNkMDExNjgyMDE2MDQwNTIzZDgyNTIzZDYwMDA2MDIwODQwMTNlNjEwOTU1NTY1YjYwNjA5MTUwNWI1MDgyNjAwMDAxODM2MDIwMDE4MjkwNTI4MjE1MTUxNTE1ODE1MjUwNTA1MDgwNTE2MDIwODQwMTM1MTc2MTA5Y2Y1NzdmMDhjMzc5YTAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDYwMDA1MjYwMjA2MDA0NTI2MDE3NjAyNDUyN2Y0ZDc1NmM3NDY5NjM2MTZjNmMzMzNhMjA2MzYxNmM2YzIwNjY2MTY5NmM2NTY0MDAwMDAwMDAwMDAwMDAwMDAwNjA0NDUyNjA2NDYwMDBmZDViODE2MDAxMDE5MTUwNTA2MTA4N2U1NjViNTA1MDUwOTI5MTUwNTA1NjViNjAwMDQ1OTA1MDkwNTY1YjYwMDA0MTkwNTA5MDU2NWI2MDYwNjAwMDgzODM5MDUwOTA1MDgwNjdmZmZmZmZmZmZmZmZmZmZmODExMTE1NjEwYTE4NTc2MTBhMTc2MTEyZmE1NjViNWI2MDQwNTE5MDgwODI1MjgwNjAyMDAyNjAyMDAxODIwMTYwNDA1MjgwMTU2MTBhNTE1NzgxNjAyMDAxNWI2MTBhM2U2MTBiZDU1NjViODE1MjYwMjAwMTkwNjAwMTkwMDM5MDgxNjEwYTM2NTc5MDUwNWI1MDkxNTAzNjYwMDA1YjgyODExMDE1NjEwYjljNTc2MDAwODQ4MjgxNTE4MTEwNjEwYTc1NTc2MTBhNzQ2MTEzMjk1NjViNWI2MDIwMDI2MDIwMDEwMTUxOTA1MDg2ODY4MzgxODExMDYxMGE5MjU3NjEwYTkxNjExMzI5NTY1YjViOTA1MDYwMjAwMjgxMDE5MDYxMGFhNDkxOTA2MTE0Yzc1NjViOTI1MDgyNjAwMDAxNjAyMDgxMDE5MDYxMGFiOTkxOTA2MTExYTc1NjViNzNmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmMTY4MzgwNjAyMDAxOTA2MTBhZGY5MTkwNjExMzhmNTY1YjYwNDA1MTYxMGFlZDkyOTE5MDYxMTQzMTU2NWI2MDAwNjA0MDUxODA4MzAzODE2MDAwODY1YWYxOTE1MDUwM2Q4MDYwMDA4MTE0NjEwYjJhNTc2MDQwNTE5MTUwNjAxZjE5NjAzZjNkMDExNjgyMDE2MDQwNTIzZDgyNTIzZDYwMDA2MDIwODQwMTNlNjEwYjJmNTY1YjYwNjA5MTUwNWI1MDgyNjAwMDAxODM2MDIwMDE4MjkwNTI4MjE1MTUxNTE1ODE1MjUwNTA1MDg3MTU2MTBiOTA1NzgwNjAwMDAxNTE2MTBiOGY1NzYwNDA1MTdmMDhjMzc5YTAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDgxNTI2MDA0MDE2MTBiODY5MDYxMTUzYjU2NWI2MDQwNTE4MDkxMDM5MGZkNWI1YjgxNjAwMTAxOTE1MDUwNjEwYTU4NTY1YjUwNTA1MDkzOTI1MDUwNTA1NjViNjAwMDgwNjA2MDYxMGJiNzYwMDE4Njg2NjEwN2JmNTY1YjgwOTM1MDgxOTQ1MDgyOTU1MDUwNTA1MDkyNTA5MjUwOTI1NjViNjAwMDgxNDA5MDUwOTE5MDUwNTY1YjYwNDA1MTgwNjA0MDAxNjA0MDUyODA2MDAwMTUxNTgxNTI2MDIwMDE2MDYwODE1MjUwOTA1NjViNjAwMDgxOTA1MDkxOTA1MDU2NWI2MTBjMDQ4MTYxMGJmMTU2NWI4MjUyNTA1MDU2NWI2MDAwNjAyMDgyMDE5MDUwNjEwYzFmNjAwMDgzMDE4NDYxMGJmYjU2NWI5MjkxNTA1MDU2NWI2MDAwODBmZDViNjAwMDgwZmQ1YjYwMDA4MGZkNWI2MDAwODBmZDViNjAwMDgwZmQ1YjYwMDA4MDgzNjAxZjg0MDExMjYxMGM1NDU3NjEwYzUzNjEwYzJmNTY1YjViODIzNTkwNTA2N2ZmZmZmZmZmZmZmZmZmZmY4MTExMTU2MTBjNzE1NzYxMGM3MDYxMGMzNDU2NWI1YjYwMjA4MzAxOTE1MDgzNjAyMDgyMDI4MzAxMTExNTYxMGM4ZDU3NjEwYzhjNjEwYzM5NTY1YjViOTI1MDkyOTA1MDU2NWI2MDAwODA2MDIwODM4NTAzMTIxNTYxMGNhYjU3NjEwY2FhNjEwYzI1NTY1YjViNjAwMDgzMDEzNTY3ZmZmZmZmZmZmZmZmZmZmZjgxMTExNTYxMGNjOTU3NjEwY2M4NjEwYzJhNTY1YjViNjEwY2Q1ODU4Mjg2MDE2MTBjM2U1NjViOTI1MDkyNTA1MDkyNTA5MjkwNTA1NjViNjAwMDgxNTE5MDUwOTE5MDUwNTY1YjYwMDA4MjgyNTI2MDIwODIwMTkwNTA5MjkxNTA1MDU2NWI2MDAwODE5MDUwNjAyMDgyMDE5MDUwOTE5MDUwNTY1YjYwMDA4MTE1MTU5MDUwOTE5MDUwNTY1YjYxMGQyMjgxNjEwZDBkNTY1YjgyNTI1MDUwNTY1YjYwMDA4MTUxOTA1MDkxOTA1MDU2NWI2MDAwODI4MjUyNjAyMDgyMDE5MDUwOTI5MTUwNTA1NjViNjAwMDViODM4MTEwMTU2MTBkNjI1NzgwODIwMTUxODE4NDAxNTI2MDIwODEwMTkwNTA2MTBkNDc1NjViODM4MTExMTU2MTBkNzE1NzYwMDA4NDg0MDE1MjViNTA1MDUwNTA1NjViNjAwMDYwMWYxOTYwMWY4MzAxMTY5MDUwOTE5MDUwNTY1YjYwMDA2MTBkOTM4MjYxMGQyODU2NWI2MTBkOWQ4MTg1NjEwZDMzNTY1YjkzNTA2MTBkYWQ4MTg1NjAyMDg2MDE2MTBkNDQ1NjViNjEwZGI2ODE2MTBkNzc1NjViODQwMTkxNTA1MDkyOTE1MDUwNTY1YjYwMDA2MDQwODMwMTYwMDA4MzAxNTE2MTBkZDk2MDAwODYwMTgyNjEwZDE5NTY1YjUwNjAyMDgzMDE1MTg0ODIwMzYwMjA4NjAxNTI2MTBkZjE4MjgyNjEwZDg4NTY1YjkxNTA1MDgwOTE1MDUwOTI5MTUwNTA1NjViNjAwMDYxMGUwYTgzODM2MTBkYzE1NjViOTA1MDkyOTE1MDUwNTY1YjYwMDA2MDIwODIwMTkwNTA5MTkwNTA1NjViNjAwMDYxMGUyYTgyNjEwY2UxNTY1YjYxMGUzNDgxODU2MTBjZWM1NjViOTM1MDgzNjAyMDgyMDI4NTAxNjEwZTQ2ODU2MTBjZmQ1NjViODA2MDAwNWI4NTgxMTAxNTYxMGU4MjU3ODQ4NDAzODk1MjgxNTE2MTBlNjM4NTgyNjEwZGZlNTY1Yjk0NTA2MTBlNmU4MzYxMGUxMjU2NWI5MjUwNjAyMDhhMDE5OTUwNTA2MDAxODEwMTkwNTA2MTBlNGE1NjViNTA4Mjk3NTA4Nzk1NTA1MDUwNTA1MDUwOTI5MTUwNTA1NjViNjAwMDYwMjA4MjAxOTA1MDgxODEwMzYwMDA4MzAxNTI2MTBlYWU4MTg0NjEwZTFmNTY1YjkwNTA5MjkxNTA1MDU2NWI2MDAwODA4MzYwMWY4NDAxMTI2MTBlY2M1NzYxMGVjYjYxMGMyZjU2NWI1YjgyMzU5MDUwNjdmZmZmZmZmZmZmZmZmZmZmODExMTE1NjEwZWU5NTc2MTBlZTg2MTBjMzQ1NjViNWI2MDIwODMwMTkxNTA4MzYwMjA4MjAyODMwMTExMTU2MTBmMDU1NzYxMGYwNDYxMGMzOTU2NWI1YjkyNTA5MjkwNTA1NjViNjAwMDgwNjAyMDgzODUwMzEyMTU2MTBmMjM1NzYxMGYyMjYxMGMyNTU2NWI1YjYwMDA4MzAxMzU2N2ZmZmZmZmZmZmZmZmZmZmY4MTExMTU2MTBmNDE1NzYxMGY0MDYxMGMyYTU2NWI1YjYxMGY0ZDg1ODI4NjAxNjEwZWI2NTY1YjkyNTA5MjUwNTA5MjUwOTI5MDUwNTY1YjYwMDA4MTUxOTA1MDkxOTA1MDU2NWI2MDAwODI4MjUyNjAyMDgyMDE5MDUwOTI5MTUwNTA1NjViNjAwMDgxOTA1MDYwMjA4MjAxOTA1MDkxOTA1MDU2NWI2MDAwNjEwZjkxODM4MzYxMGQ4ODU2NWI5MDUwOTI5MTUwNTA1NjViNjAwMDYwMjA4MjAxOTA1MDkxOTA1MDU2NWI2MDAwNjEwZmIxODI2MTBmNTk1NjViNjEwZmJiODE4NTYxMGY2NDU2NWI5MzUwODM2MDIwODIwMjg1MDE2MTBmY2Q4NTYxMGY3NTU2NWI4MDYwMDA1Yjg1ODExMDE1NjExMDA5NTc4NDg0MDM4OTUyODE1MTYxMGZlYTg1ODI2MTBmODU1NjViOTQ1MDYxMGZmNTgzNjEwZjk5NTY1YjkyNTA2MDIwOGEwMTk5NTA1MDYwMDE4MTAxOTA1MDYxMGZkMTU2NWI1MDgyOTc1MDg3OTU1MDUwNTA1MDUwNTA5MjkxNTA1MDU2NWI2MDAwNjA0MDgyMDE5MDUwNjExMDMwNjAwMDgzMDE4NTYxMGJmYjU2NWI4MTgxMDM2MDIwODMwMTUyNjExMDQyODE4NDYxMGZhNjU2NWI5MDUwOTM5MjUwNTA1MDU2NWI2MDAwODE5MDUwOTE5MDUwNTY1YjYxMTA1ZTgxNjExMDRiNTY1YjgyNTI1MDUwNTY1YjYwMDA2MDIwODIwMTkwNTA2MTEwNzk2MDAwODMwMTg0NjExMDU1NTY1YjkyOTE1MDUwNTY1YjYxMTA4ODgxNjEwZDBkNTY1YjgxMTQ2MTEwOTM1NzYwMDA4MGZkNWI1MDU2NWI2MDAwODEzNTkwNTA2MTEwYTU4MTYxMTA3ZjU2NWI5MjkxNTA1MDU2NWI2MDAwODA2MDAwNjA0MDg0ODYwMzEyMTU2MTEwYzQ1NzYxMTBjMzYxMGMyNTU2NWI1YjYwMDA2MTEwZDI4NjgyODcwMTYxMTA5NjU2NWI5MzUwNTA2MDIwODQwMTM1NjdmZmZmZmZmZmZmZmZmZmZmODExMTE1NjExMGYzNTc2MTEwZjI2MTBjMmE1NjViNWI2MTEwZmY4NjgyODcwMTYxMGViNjU2NWI5MjUwOTI1MDUwOTI1MDkyNTA5MjU2NWI2MDAwNjA2MDgyMDE5MDUwNjExMTIwNjAwMDgzMDE4NjYxMGJmYjU2NWI2MTExMmQ2MDIwODMwMTg1NjExMDU1NTY1YjgxODEwMzYwNDA4MzAxNTI2MTExM2Y4MTg0NjEwZTFmNTY1YjkwNTA5NDkzNTA1MDUwNTA1NjViNjAwMDczZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZjgyMTY5MDUwOTE5MDUwNTY1YjYwMDA2MTExNzQ4MjYxMTE0OTU2NWI5MDUwOTE5MDUwNTY1YjYxMTE4NDgxNjExMTY5NTY1YjgxMTQ2MTExOGY1NzYwMDA4MGZkNWI1MDU2NWI2MDAwODEzNTkwNTA2MTExYTE4MTYxMTE3YjU2NWI5MjkxNTA1MDU2NWI2MDAwNjAyMDgyODQwMzEyMTU2MTExYmQ1NzYxMTFiYzYxMGMyNTU2NWI1YjYwMDA2MTExY2I4NDgyODUwMTYxMTE5MjU2NWI5MTUwNTA5MjkxNTA1MDU2NWI2MDAwODA4MzYwMWY4NDAxMTI2MTExZWE1NzYxMTFlOTYxMGMyZjU2NWI1YjgyMzU5MDUwNjdmZmZmZmZmZmZmZmZmZmZmODExMTE1NjExMjA3NTc2MTEyMDY2MTBjMzQ1NjViNWI2MDIwODMwMTkxNTA4MzYwMjA4MjAyODMwMTExMTU2MTEyMjM1NzYxMTIyMjYxMGMzOTU2NWI1YjkyNTA5MjkwNTA1NjViNjAwMDgwNjAyMDgzODUwMzEyMTU2MTEyNDE1NzYxMTI0MDYxMGMyNTU2NWI1YjYwMDA4MzAxMzU2N2ZmZmZmZmZmZmZmZmZmZmY4MTExMTU2MTEyNWY1NzYxMTI1ZTYxMGMyYTU2NWI1YjYxMTI2Yjg1ODI4NjAxNjExMWQ0NTY1YjkyNTA5MjUwNTA5MjUwOTI5MDUwNTY1YjYxMTI4MDgxNjExMTY5NTY1YjgyNTI1MDUwNTY1YjYwMDA2MDIwODIwMTkwNTA2MTEyOWI2MDAwODMwMTg0NjExMjc3NTY1YjkyOTE1MDUwNTY1YjYxMTJhYTgxNjEwYmYxNTY1YjgxMTQ2MTEyYjU1NzYwMDA4MGZkNWI1MDU2NWI2MDAwODEzNTkwNTA2MTEyYzc4MTYxMTJhMTU2NWI5MjkxNTA1MDU2NWI2MDAwNjAyMDgyODQwMzEyMTU2MTEyZTM1NzYxMTJlMjYxMGMyNTU2NWI1YjYwMDA2MTEyZjE4NDgyODUwMTYxMTJiODU2NWI5MTUwNTA5MjkxNTA1MDU2NWI3ZjRlNDg3YjcxMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDA2MDAwNTI2MDQxNjAwNDUyNjAyNDYwMDBmZDViN2Y0ZTQ4N2I3MTAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwNjAwMDUyNjAzMjYwMDQ1MjYwMjQ2MDAwZmQ1YjYwMDA4MGZkNWI2MDAwODBmZDViNjAwMDgwZmQ1YjYwMDA4MjM1NjAwMTYwODAwMzgzMzYwMzAzODExMjYxMTM4MzU3NjExMzgyNjExMzU4NTY1YjViODA4MzAxOTE1MDUwOTI5MTUwNTA1NjViNjAwMDgwODMzNTYwMDE2MDIwMDM4NDM2MDMwMzgxMTI2MTEzYWM1NzYxMTNhYjYxMTM1ODU2NWI1YjgwODQwMTkyNTA4MjM1OTE1MDY3ZmZmZmZmZmZmZmZmZmZmZjgyMTExNTYxMTNjZTU3NjExM2NkNjExMzVkNTY1YjViNjAyMDgzMDE5MjUwNjAwMTgyMDIzNjAzODMxMzE1NjExM2VhNTc2MTEzZTk2MTEzNjI1NjViNWI1MDkyNTA5MjkwNTA1NjViNjAwMDgxOTA1MDkyOTE1MDUwNTY1YjgyODE4MzM3NjAwMDgzODMwMTUyNTA1MDUwNTY1YjYwMDA2MTE0MTg4Mzg1NjExM2YyNTY1YjkzNTA2MTE0MjU4Mzg1ODQ2MTEzZmQ1NjViODI4NDAxOTA1MDkzOTI1MDUwNTA1NjViNjAwMDYxMTQzZTgyODQ4NjYxMTQwYzU2NWI5MTUwODE5MDUwOTM5MjUwNTA1MDU2NWI2MDAwODI4MjUyNjAyMDgyMDE5MDUwOTI5MTUwNTA1NjViN2Y0ZDc1NmM3NDY5NjM2MTZjNmMzMzNhMjA3NjYxNmM3NTY1MjA2ZDY5NzM2ZDYxNzQ2MzY4MDAwMDAwMDAwMDAwNjAwMDgyMDE1MjUwNTY1YjYwMDA2MTE0OTE2MDFhODM2MTE0NGE1NjViOTE1MDYxMTQ5YzgyNjExNDViNTY1YjYwMjA4MjAxOTA1MDkxOTA1MDU2NWI2MDAwNjAyMDgyMDE5MDUwODE4MTAzNjAwMDgzMDE1MjYxMTRjMDgxNjExNDg0NTY1YjkwNTA5MTkwNTA1NjViNjAwMDgyMzU2MDAxNjA0MDAzODMzNjAzMDM4MTEyNjExNGUzNTc2MTE0ZTI2MTEzNTg1NjViNWI4MDgzMDE5MTUwNTA5MjkxNTA1MDU2NWI3ZjRkNzU2Yzc0Njk2MzYxNmM2YzMzM2EyMDYzNjE2YzZjMjA2NjYxNjk2YzY1NjQwMDAwMDAwMDAwMDAwMDAwMDA2MDAwODIwMTUyNTA1NjViNjAwMDYxMTUyNTYwMTc4MzYxMTQ0YTU2NWI5MTUwNjExNTMwODI2MTE0ZWY1NjViNjAyMDgyMDE5MDUwOTE5MDUwNTY1YjYwMDA2MDIwODIwMTkwNTA4MTgxMDM2MDAwODMwMTUyNjExNTU0ODE2MTE1MTg1NjViOTA1MDkxOTA1MDU2NWI2MDAwODIzNTYwMDE2MDYwMDM4MzM2MDMwMzgxMTI2MTE1Nzc1NzYxMTU3NjYxMTM1ODU2NWI1YjgwODMwMTkxNTA1MDkyOTE1MDUwNTZmZWEyNjQ2OTcwNjY3MzU4MjIxMjIwMjBjMWJjOWFhY2Y4ZTRhNjUwNzE5MzQzMmE4OTVhOGU3NzA5NGY0NWExMzk1NTgzZjA3YjI0ZTg2MGVmMDZjZDY0NzM2ZjZjNjM0MzAwMDgwYzAwMzMnO1xuLy8jIHNvdXJjZU1hcHBpbmdVUkw9Y29udHJhY3RzLmpzLm1hcCIsCiAgICAiZXhwb3J0IGNvbnN0IHZlcnNpb24gPSAnMi40My4zJztcbi8vIyBzb3VyY2VNYXBwaW5nVVJMPXZlcnNpb24uanMubWFwIiwKICAgICJpbXBvcnQgeyB2ZXJzaW9uIH0gZnJvbSAnLi92ZXJzaW9uLmpzJztcbmxldCBlcnJvckNvbmZpZyA9IHtcbiAgICBnZXREb2NzVXJsOiAoeyBkb2NzQmFzZVVybCwgZG9jc1BhdGggPSAnJywgZG9jc1NsdWcsIH0pID0+IGRvY3NQYXRoXG4gICAgICAgID8gYCR7ZG9jc0Jhc2VVcmwgPz8gJ2h0dHBzOi8vdmllbS5zaCd9JHtkb2NzUGF0aH0ke2RvY3NTbHVnID8gYCMke2RvY3NTbHVnfWAgOiAnJ31gXG4gICAgICAgIDogdW5kZWZpbmVkLFxuICAgIHZlcnNpb246IGB2aWVtQCR7dmVyc2lvbn1gLFxufTtcbmV4cG9ydCBmdW5jdGlvbiBzZXRFcnJvckNvbmZpZyhjb25maWcpIHtcbiAgICBlcnJvckNvbmZpZyA9IGNvbmZpZztcbn1cbmV4cG9ydCBjbGFzcyBCYXNlRXJyb3IgZXh0ZW5kcyBFcnJvciB7XG4gICAgY29uc3RydWN0b3Ioc2hvcnRNZXNzYWdlLCBhcmdzID0ge30pIHtcbiAgICAgICAgY29uc3QgZGV0YWlscyA9ICgoKSA9PiB7XG4gICAgICAgICAgICBpZiAoYXJncy5jYXVzZSBpbnN0YW5jZW9mIEJhc2VFcnJvcilcbiAgICAgICAgICAgICAgICByZXR1cm4gYXJncy5jYXVzZS5kZXRhaWxzO1xuICAgICAgICAgICAgaWYgKGFyZ3MuY2F1c2U/Lm1lc3NhZ2UpXG4gICAgICAgICAgICAgICAgcmV0dXJuIGFyZ3MuY2F1c2UubWVzc2FnZTtcbiAgICAgICAgICAgIHJldHVybiBhcmdzLmRldGFpbHM7XG4gICAgICAgIH0pKCk7XG4gICAgICAgIGNvbnN0IGRvY3NQYXRoID0gKCgpID0+IHtcbiAgICAgICAgICAgIGlmIChhcmdzLmNhdXNlIGluc3RhbmNlb2YgQmFzZUVycm9yKVxuICAgICAgICAgICAgICAgIHJldHVybiBhcmdzLmNhdXNlLmRvY3NQYXRoIHx8IGFyZ3MuZG9jc1BhdGg7XG4gICAgICAgICAgICByZXR1cm4gYXJncy5kb2NzUGF0aDtcbiAgICAgICAgfSkoKTtcbiAgICAgICAgY29uc3QgZG9jc1VybCA9IGVycm9yQ29uZmlnLmdldERvY3NVcmw/Lih7IC4uLmFyZ3MsIGRvY3NQYXRoIH0pO1xuICAgICAgICBjb25zdCBtZXNzYWdlID0gW1xuICAgICAgICAgICAgc2hvcnRNZXNzYWdlIHx8ICdBbiBlcnJvciBvY2N1cnJlZC4nLFxuICAgICAgICAgICAgJycsXG4gICAgICAgICAgICAuLi4oYXJncy5tZXRhTWVzc2FnZXMgPyBbLi4uYXJncy5tZXRhTWVzc2FnZXMsICcnXSA6IFtdKSxcbiAgICAgICAgICAgIC4uLihkb2NzVXJsID8gW2BEb2NzOiAke2RvY3NVcmx9YF0gOiBbXSksXG4gICAgICAgICAgICAuLi4oZGV0YWlscyA/IFtgRGV0YWlsczogJHtkZXRhaWxzfWBdIDogW10pLFxuICAgICAgICAgICAgLi4uKGVycm9yQ29uZmlnLnZlcnNpb24gPyBbYFZlcnNpb246ICR7ZXJyb3JDb25maWcudmVyc2lvbn1gXSA6IFtdKSxcbiAgICAgICAgXS5qb2luKCdcXG4nKTtcbiAgICAgICAgc3VwZXIobWVzc2FnZSwgYXJncy5jYXVzZSA/IHsgY2F1c2U6IGFyZ3MuY2F1c2UgfSA6IHVuZGVmaW5lZCk7XG4gICAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0aGlzLCBcImRldGFpbHNcIiwge1xuICAgICAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICAgICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgICAgICAgICAgIHdyaXRhYmxlOiB0cnVlLFxuICAgICAgICAgICAgdmFsdWU6IHZvaWQgMFxuICAgICAgICB9KTtcbiAgICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRoaXMsIFwiZG9jc1BhdGhcIiwge1xuICAgICAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICAgICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgICAgICAgICAgIHdyaXRhYmxlOiB0cnVlLFxuICAgICAgICAgICAgdmFsdWU6IHZvaWQgMFxuICAgICAgICB9KTtcbiAgICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRoaXMsIFwibWV0YU1lc3NhZ2VzXCIsIHtcbiAgICAgICAgICAgIGVudW1lcmFibGU6IHRydWUsXG4gICAgICAgICAgICBjb25maWd1cmFibGU6IHRydWUsXG4gICAgICAgICAgICB3cml0YWJsZTogdHJ1ZSxcbiAgICAgICAgICAgIHZhbHVlOiB2b2lkIDBcbiAgICAgICAgfSk7XG4gICAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0aGlzLCBcInNob3J0TWVzc2FnZVwiLCB7XG4gICAgICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlLFxuICAgICAgICAgICAgd3JpdGFibGU6IHRydWUsXG4gICAgICAgICAgICB2YWx1ZTogdm9pZCAwXG4gICAgICAgIH0pO1xuICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkodGhpcywgXCJ2ZXJzaW9uXCIsIHtcbiAgICAgICAgICAgIGVudW1lcmFibGU6IHRydWUsXG4gICAgICAgICAgICBjb25maWd1cmFibGU6IHRydWUsXG4gICAgICAgICAgICB3cml0YWJsZTogdHJ1ZSxcbiAgICAgICAgICAgIHZhbHVlOiB2b2lkIDBcbiAgICAgICAgfSk7XG4gICAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0aGlzLCBcIm5hbWVcIiwge1xuICAgICAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICAgICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgICAgICAgICAgIHdyaXRhYmxlOiB0cnVlLFxuICAgICAgICAgICAgdmFsdWU6ICdCYXNlRXJyb3InXG4gICAgICAgIH0pO1xuICAgICAgICB0aGlzLmRldGFpbHMgPSBkZXRhaWxzO1xuICAgICAgICB0aGlzLmRvY3NQYXRoID0gZG9jc1BhdGg7XG4gICAgICAgIHRoaXMubWV0YU1lc3NhZ2VzID0gYXJncy5tZXRhTWVzc2FnZXM7XG4gICAgICAgIHRoaXMubmFtZSA9IGFyZ3MubmFtZSA/PyB0aGlzLm5hbWU7XG4gICAgICAgIHRoaXMuc2hvcnRNZXNzYWdlID0gc2hvcnRNZXNzYWdlO1xuICAgICAgICB0aGlzLnZlcnNpb24gPSB2ZXJzaW9uO1xuICAgIH1cbiAgICB3YWxrKGZuKSB7XG4gICAgICAgIHJldHVybiB3YWxrKHRoaXMsIGZuKTtcbiAgICB9XG59XG5mdW5jdGlvbiB3YWxrKGVyciwgZm4pIHtcbiAgICBpZiAoZm4/LihlcnIpKVxuICAgICAgICByZXR1cm4gZXJyO1xuICAgIGlmIChlcnIgJiZcbiAgICAgICAgdHlwZW9mIGVyciA9PT0gJ29iamVjdCcgJiZcbiAgICAgICAgJ2NhdXNlJyBpbiBlcnIgJiZcbiAgICAgICAgZXJyLmNhdXNlICE9PSB1bmRlZmluZWQpXG4gICAgICAgIHJldHVybiB3YWxrKGVyci5jYXVzZSwgZm4pO1xuICAgIHJldHVybiBmbiA/IG51bGwgOiBlcnI7XG59XG4vLyMgc291cmNlTWFwcGluZ1VSTD1iYXNlLmpzLm1hcCIsCiAgICAiaW1wb3J0IHsgQmFzZUVycm9yIH0gZnJvbSAnLi9iYXNlLmpzJztcbmV4cG9ydCBjbGFzcyBDaGFpbkRvZXNOb3RTdXBwb3J0Q29udHJhY3QgZXh0ZW5kcyBCYXNlRXJyb3Ige1xuICAgIGNvbnN0cnVjdG9yKHsgYmxvY2tOdW1iZXIsIGNoYWluLCBjb250cmFjdCwgfSkge1xuICAgICAgICBzdXBlcihgQ2hhaW4gXCIke2NoYWluLm5hbWV9XCIgZG9lcyBub3Qgc3VwcG9ydCBjb250cmFjdCBcIiR7Y29udHJhY3QubmFtZX1cIi5gLCB7XG4gICAgICAgICAgICBtZXRhTWVzc2FnZXM6IFtcbiAgICAgICAgICAgICAgICAnVGhpcyBjb3VsZCBiZSBkdWUgdG8gYW55IG9mIHRoZSBmb2xsb3dpbmc6JyxcbiAgICAgICAgICAgICAgICAuLi4oYmxvY2tOdW1iZXIgJiZcbiAgICAgICAgICAgICAgICAgICAgY29udHJhY3QuYmxvY2tDcmVhdGVkICYmXG4gICAgICAgICAgICAgICAgICAgIGNvbnRyYWN0LmJsb2NrQ3JlYXRlZCA+IGJsb2NrTnVtYmVyXG4gICAgICAgICAgICAgICAgICAgID8gW1xuICAgICAgICAgICAgICAgICAgICAgICAgYC0gVGhlIGNvbnRyYWN0IFwiJHtjb250cmFjdC5uYW1lfVwiIHdhcyBub3QgZGVwbG95ZWQgdW50aWwgYmxvY2sgJHtjb250cmFjdC5ibG9ja0NyZWF0ZWR9IChjdXJyZW50IGJsb2NrICR7YmxvY2tOdW1iZXJ9KS5gLFxuICAgICAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgICAgICAgIDogW1xuICAgICAgICAgICAgICAgICAgICAgICAgYC0gVGhlIGNoYWluIGRvZXMgbm90IGhhdmUgdGhlIGNvbnRyYWN0IFwiJHtjb250cmFjdC5uYW1lfVwiIGNvbmZpZ3VyZWQuYCxcbiAgICAgICAgICAgICAgICAgICAgXSksXG4gICAgICAgICAgICBdLFxuICAgICAgICAgICAgbmFtZTogJ0NoYWluRG9lc05vdFN1cHBvcnRDb250cmFjdCcsXG4gICAgICAgIH0pO1xuICAgIH1cbn1cbmV4cG9ydCBjbGFzcyBDaGFpbk1pc21hdGNoRXJyb3IgZXh0ZW5kcyBCYXNlRXJyb3Ige1xuICAgIGNvbnN0cnVjdG9yKHsgY2hhaW4sIGN1cnJlbnRDaGFpbklkLCB9KSB7XG4gICAgICAgIHN1cGVyKGBUaGUgY3VycmVudCBjaGFpbiBvZiB0aGUgd2FsbGV0IChpZDogJHtjdXJyZW50Q2hhaW5JZH0pIGRvZXMgbm90IG1hdGNoIHRoZSB0YXJnZXQgY2hhaW4gZm9yIHRoZSB0cmFuc2FjdGlvbiAoaWQ6ICR7Y2hhaW4uaWR9IOKAkyAke2NoYWluLm5hbWV9KS5gLCB7XG4gICAgICAgICAgICBtZXRhTWVzc2FnZXM6IFtcbiAgICAgICAgICAgICAgICBgQ3VycmVudCBDaGFpbiBJRDogICR7Y3VycmVudENoYWluSWR9YCxcbiAgICAgICAgICAgICAgICBgRXhwZWN0ZWQgQ2hhaW4gSUQ6ICR7Y2hhaW4uaWR9IOKAkyAke2NoYWluLm5hbWV9YCxcbiAgICAgICAgICAgIF0sXG4gICAgICAgICAgICBuYW1lOiAnQ2hhaW5NaXNtYXRjaEVycm9yJyxcbiAgICAgICAgfSk7XG4gICAgfVxufVxuZXhwb3J0IGNsYXNzIENoYWluTm90Rm91bmRFcnJvciBleHRlbmRzIEJhc2VFcnJvciB7XG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHN1cGVyKFtcbiAgICAgICAgICAgICdObyBjaGFpbiB3YXMgcHJvdmlkZWQgdG8gdGhlIHJlcXVlc3QuJyxcbiAgICAgICAgICAgICdQbGVhc2UgcHJvdmlkZSBhIGNoYWluIHdpdGggdGhlIGBjaGFpbmAgYXJndW1lbnQgb24gdGhlIEFjdGlvbiwgb3IgYnkgc3VwcGx5aW5nIGEgYGNoYWluYCB0byBXYWxsZXRDbGllbnQuJyxcbiAgICAgICAgXS5qb2luKCdcXG4nKSwge1xuICAgICAgICAgICAgbmFtZTogJ0NoYWluTm90Rm91bmRFcnJvcicsXG4gICAgICAgIH0pO1xuICAgIH1cbn1cbmV4cG9ydCBjbGFzcyBDbGllbnRDaGFpbk5vdENvbmZpZ3VyZWRFcnJvciBleHRlbmRzIEJhc2VFcnJvciB7XG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHN1cGVyKCdObyBjaGFpbiB3YXMgcHJvdmlkZWQgdG8gdGhlIENsaWVudC4nLCB7XG4gICAgICAgICAgICBuYW1lOiAnQ2xpZW50Q2hhaW5Ob3RDb25maWd1cmVkRXJyb3InLFxuICAgICAgICB9KTtcbiAgICB9XG59XG5leHBvcnQgY2xhc3MgSW52YWxpZENoYWluSWRFcnJvciBleHRlbmRzIEJhc2VFcnJvciB7XG4gICAgY29uc3RydWN0b3IoeyBjaGFpbklkIH0pIHtcbiAgICAgICAgc3VwZXIodHlwZW9mIGNoYWluSWQgPT09ICdudW1iZXInXG4gICAgICAgICAgICA/IGBDaGFpbiBJRCBcIiR7Y2hhaW5JZH1cIiBpcyBpbnZhbGlkLmBcbiAgICAgICAgICAgIDogJ0NoYWluIElEIGlzIGludmFsaWQuJywgeyBuYW1lOiAnSW52YWxpZENoYWluSWRFcnJvcicgfSk7XG4gICAgfVxufVxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9Y2hhaW4uanMubWFwIiwKICAgICIvLyBodHRwczovL2RvY3Muc29saWRpdHlsYW5nLm9yZy9lbi92MC44LjE2L2NvbnRyb2wtc3RydWN0dXJlcy5odG1sI3BhbmljLXZpYS1hc3NlcnQtYW5kLWVycm9yLXZpYS1yZXF1aXJlXG5leHBvcnQgY29uc3QgcGFuaWNSZWFzb25zID0ge1xuICAgIDE6ICdBbiBgYXNzZXJ0YCBjb25kaXRpb24gZmFpbGVkLicsXG4gICAgMTc6ICdBcml0aG1ldGljIG9wZXJhdGlvbiByZXN1bHRlZCBpbiB1bmRlcmZsb3cgb3Igb3ZlcmZsb3cuJyxcbiAgICAxODogJ0RpdmlzaW9uIG9yIG1vZHVsbyBieSB6ZXJvIChlLmcuIGA1IC8gMGAgb3IgYDIzICUgMGApLicsXG4gICAgMzM6ICdBdHRlbXB0ZWQgdG8gY29udmVydCB0byBhbiBpbnZhbGlkIHR5cGUuJyxcbiAgICAzNDogJ0F0dGVtcHRlZCB0byBhY2Nlc3MgYSBzdG9yYWdlIGJ5dGUgYXJyYXkgdGhhdCBpcyBpbmNvcnJlY3RseSBlbmNvZGVkLicsXG4gICAgNDk6ICdQZXJmb3JtZWQgYC5wb3AoKWAgb24gYW4gZW1wdHkgYXJyYXknLFxuICAgIDUwOiAnQXJyYXkgaW5kZXggaXMgb3V0IG9mIGJvdW5kcy4nLFxuICAgIDY1OiAnQWxsb2NhdGVkIHRvbyBtdWNoIG1lbW9yeSBvciBjcmVhdGVkIGFuIGFycmF5IHdoaWNoIGlzIHRvbyBsYXJnZS4nLFxuICAgIDgxOiAnQXR0ZW1wdGVkIHRvIGNhbGwgYSB6ZXJvLWluaXRpYWxpemVkIHZhcmlhYmxlIG9mIGludGVybmFsIGZ1bmN0aW9uIHR5cGUuJyxcbn07XG5leHBvcnQgY29uc3Qgc29saWRpdHlFcnJvciA9IHtcbiAgICBpbnB1dHM6IFtcbiAgICAgICAge1xuICAgICAgICAgICAgbmFtZTogJ21lc3NhZ2UnLFxuICAgICAgICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgICAgIH0sXG4gICAgXSxcbiAgICBuYW1lOiAnRXJyb3InLFxuICAgIHR5cGU6ICdlcnJvcicsXG59O1xuZXhwb3J0IGNvbnN0IHNvbGlkaXR5UGFuaWMgPSB7XG4gICAgaW5wdXRzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICAgIG5hbWU6ICdyZWFzb24nLFxuICAgICAgICAgICAgdHlwZTogJ3VpbnQyNTYnLFxuICAgICAgICB9LFxuICAgIF0sXG4gICAgbmFtZTogJ1BhbmljJyxcbiAgICB0eXBlOiAnZXJyb3InLFxufTtcbi8vIyBzb3VyY2VNYXBwaW5nVVJMPXNvbGlkaXR5LmpzLm1hcCIsCiAgICAiaW1wb3J0IHsgSW52YWxpZERlZmluaXRpb25UeXBlRXJyb3IsIH0gZnJvbSAnLi4vLi4vZXJyb3JzL2FiaS5qcyc7XG5leHBvcnQgZnVuY3Rpb24gZm9ybWF0QWJpSXRlbShhYmlJdGVtLCB7IGluY2x1ZGVOYW1lID0gZmFsc2UgfSA9IHt9KSB7XG4gICAgaWYgKGFiaUl0ZW0udHlwZSAhPT0gJ2Z1bmN0aW9uJyAmJlxuICAgICAgICBhYmlJdGVtLnR5cGUgIT09ICdldmVudCcgJiZcbiAgICAgICAgYWJpSXRlbS50eXBlICE9PSAnZXJyb3InKVxuICAgICAgICB0aHJvdyBuZXcgSW52YWxpZERlZmluaXRpb25UeXBlRXJyb3IoYWJpSXRlbS50eXBlKTtcbiAgICByZXR1cm4gYCR7YWJpSXRlbS5uYW1lfSgke2Zvcm1hdEFiaVBhcmFtcyhhYmlJdGVtLmlucHV0cywgeyBpbmNsdWRlTmFtZSB9KX0pYDtcbn1cbmV4cG9ydCBmdW5jdGlvbiBmb3JtYXRBYmlQYXJhbXMocGFyYW1zLCB7IGluY2x1ZGVOYW1lID0gZmFsc2UgfSA9IHt9KSB7XG4gICAgaWYgKCFwYXJhbXMpXG4gICAgICAgIHJldHVybiAnJztcbiAgICByZXR1cm4gcGFyYW1zXG4gICAgICAgIC5tYXAoKHBhcmFtKSA9PiBmb3JtYXRBYmlQYXJhbShwYXJhbSwgeyBpbmNsdWRlTmFtZSB9KSlcbiAgICAgICAgLmpvaW4oaW5jbHVkZU5hbWUgPyAnLCAnIDogJywnKTtcbn1cbmZ1bmN0aW9uIGZvcm1hdEFiaVBhcmFtKHBhcmFtLCB7IGluY2x1ZGVOYW1lIH0pIHtcbiAgICBpZiAocGFyYW0udHlwZS5zdGFydHNXaXRoKCd0dXBsZScpKSB7XG4gICAgICAgIHJldHVybiBgKCR7Zm9ybWF0QWJpUGFyYW1zKHBhcmFtLmNvbXBvbmVudHMsIHsgaW5jbHVkZU5hbWUgfSl9KSR7cGFyYW0udHlwZS5zbGljZSgndHVwbGUnLmxlbmd0aCl9YDtcbiAgICB9XG4gICAgcmV0dXJuIHBhcmFtLnR5cGUgKyAoaW5jbHVkZU5hbWUgJiYgcGFyYW0ubmFtZSA/IGAgJHtwYXJhbS5uYW1lfWAgOiAnJyk7XG59XG4vLyMgc291cmNlTWFwcGluZ1VSTD1mb3JtYXRBYmlJdGVtLmpzLm1hcCIsCiAgICAiZXhwb3J0IGZ1bmN0aW9uIGlzSGV4KHZhbHVlLCB7IHN0cmljdCA9IHRydWUgfSA9IHt9KSB7XG4gICAgaWYgKCF2YWx1ZSlcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIGlmICh0eXBlb2YgdmFsdWUgIT09ICdzdHJpbmcnKVxuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgcmV0dXJuIHN0cmljdCA/IC9eMHhbMC05YS1mQS1GXSokLy50ZXN0KHZhbHVlKSA6IHZhbHVlLnN0YXJ0c1dpdGgoJzB4Jyk7XG59XG4vLyMgc291cmNlTWFwcGluZ1VSTD1pc0hleC5qcy5tYXAiLAogICAgImltcG9ydCB7IGlzSGV4IH0gZnJvbSAnLi9pc0hleC5qcyc7XG4vKipcbiAqIEBkZXNjcmlwdGlvbiBSZXRyaWV2ZXMgdGhlIHNpemUgb2YgdGhlIHZhbHVlIChpbiBieXRlcykuXG4gKlxuICogQHBhcmFtIHZhbHVlIFRoZSB2YWx1ZSAoaGV4IG9yIGJ5dGUgYXJyYXkpIHRvIHJldHJpZXZlIHRoZSBzaXplIG9mLlxuICogQHJldHVybnMgVGhlIHNpemUgb2YgdGhlIHZhbHVlIChpbiBieXRlcykuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBzaXplKHZhbHVlKSB7XG4gICAgaWYgKGlzSGV4KHZhbHVlLCB7IHN0cmljdDogZmFsc2UgfSkpXG4gICAgICAgIHJldHVybiBNYXRoLmNlaWwoKHZhbHVlLmxlbmd0aCAtIDIpIC8gMik7XG4gICAgcmV0dXJuIHZhbHVlLmxlbmd0aDtcbn1cbi8vIyBzb3VyY2VNYXBwaW5nVVJMPXNpemUuanMubWFwIiwKICAgICJpbXBvcnQgeyBmb3JtYXRBYmlJdGVtLCBmb3JtYXRBYmlQYXJhbXMgfSBmcm9tICcuLi91dGlscy9hYmkvZm9ybWF0QWJpSXRlbS5qcyc7XG5pbXBvcnQgeyBzaXplIH0gZnJvbSAnLi4vdXRpbHMvZGF0YS9zaXplLmpzJztcbmltcG9ydCB7IEJhc2VFcnJvciB9IGZyb20gJy4vYmFzZS5qcyc7XG5leHBvcnQgY2xhc3MgQWJpQ29uc3RydWN0b3JOb3RGb3VuZEVycm9yIGV4dGVuZHMgQmFzZUVycm9yIHtcbiAgICBjb25zdHJ1Y3Rvcih7IGRvY3NQYXRoIH0pIHtcbiAgICAgICAgc3VwZXIoW1xuICAgICAgICAgICAgJ0EgY29uc3RydWN0b3Igd2FzIG5vdCBmb3VuZCBvbiB0aGUgQUJJLicsXG4gICAgICAgICAgICAnTWFrZSBzdXJlIHlvdSBhcmUgdXNpbmcgdGhlIGNvcnJlY3QgQUJJIGFuZCB0aGF0IHRoZSBjb25zdHJ1Y3RvciBleGlzdHMgb24gaXQuJyxcbiAgICAgICAgXS5qb2luKCdcXG4nKSwge1xuICAgICAgICAgICAgZG9jc1BhdGgsXG4gICAgICAgICAgICBuYW1lOiAnQWJpQ29uc3RydWN0b3JOb3RGb3VuZEVycm9yJyxcbiAgICAgICAgfSk7XG4gICAgfVxufVxuZXhwb3J0IGNsYXNzIEFiaUNvbnN0cnVjdG9yUGFyYW1zTm90Rm91bmRFcnJvciBleHRlbmRzIEJhc2VFcnJvciB7XG4gICAgY29uc3RydWN0b3IoeyBkb2NzUGF0aCB9KSB7XG4gICAgICAgIHN1cGVyKFtcbiAgICAgICAgICAgICdDb25zdHJ1Y3RvciBhcmd1bWVudHMgd2VyZSBwcm92aWRlZCAoYGFyZ3NgKSwgYnV0IGEgY29uc3RydWN0b3IgcGFyYW1ldGVycyAoYGlucHV0c2ApIHdlcmUgbm90IGZvdW5kIG9uIHRoZSBBQkkuJyxcbiAgICAgICAgICAgICdNYWtlIHN1cmUgeW91IGFyZSB1c2luZyB0aGUgY29ycmVjdCBBQkksIGFuZCB0aGF0IHRoZSBgaW5wdXRzYCBhdHRyaWJ1dGUgb24gdGhlIGNvbnN0cnVjdG9yIGV4aXN0cy4nLFxuICAgICAgICBdLmpvaW4oJ1xcbicpLCB7XG4gICAgICAgICAgICBkb2NzUGF0aCxcbiAgICAgICAgICAgIG5hbWU6ICdBYmlDb25zdHJ1Y3RvclBhcmFtc05vdEZvdW5kRXJyb3InLFxuICAgICAgICB9KTtcbiAgICB9XG59XG5leHBvcnQgY2xhc3MgQWJpRGVjb2RpbmdEYXRhU2l6ZUludmFsaWRFcnJvciBleHRlbmRzIEJhc2VFcnJvciB7XG4gICAgY29uc3RydWN0b3IoeyBkYXRhLCBzaXplIH0pIHtcbiAgICAgICAgc3VwZXIoW1xuICAgICAgICAgICAgYERhdGEgc2l6ZSBvZiAke3NpemV9IGJ5dGVzIGlzIGludmFsaWQuYCxcbiAgICAgICAgICAgICdTaXplIG11c3QgYmUgaW4gaW5jcmVtZW50cyBvZiAzMiBieXRlcyAoc2l6ZSAlIDMyID09PSAwKS4nLFxuICAgICAgICBdLmpvaW4oJ1xcbicpLCB7XG4gICAgICAgICAgICBtZXRhTWVzc2FnZXM6IFtgRGF0YTogJHtkYXRhfSAoJHtzaXplfSBieXRlcylgXSxcbiAgICAgICAgICAgIG5hbWU6ICdBYmlEZWNvZGluZ0RhdGFTaXplSW52YWxpZEVycm9yJyxcbiAgICAgICAgfSk7XG4gICAgfVxufVxuZXhwb3J0IGNsYXNzIEFiaURlY29kaW5nRGF0YVNpemVUb29TbWFsbEVycm9yIGV4dGVuZHMgQmFzZUVycm9yIHtcbiAgICBjb25zdHJ1Y3Rvcih7IGRhdGEsIHBhcmFtcywgc2l6ZSwgfSkge1xuICAgICAgICBzdXBlcihbYERhdGEgc2l6ZSBvZiAke3NpemV9IGJ5dGVzIGlzIHRvbyBzbWFsbCBmb3IgZ2l2ZW4gcGFyYW1ldGVycy5gXS5qb2luKCdcXG4nKSwge1xuICAgICAgICAgICAgbWV0YU1lc3NhZ2VzOiBbXG4gICAgICAgICAgICAgICAgYFBhcmFtczogKCR7Zm9ybWF0QWJpUGFyYW1zKHBhcmFtcywgeyBpbmNsdWRlTmFtZTogdHJ1ZSB9KX0pYCxcbiAgICAgICAgICAgICAgICBgRGF0YTogICAke2RhdGF9ICgke3NpemV9IGJ5dGVzKWAsXG4gICAgICAgICAgICBdLFxuICAgICAgICAgICAgbmFtZTogJ0FiaURlY29kaW5nRGF0YVNpemVUb29TbWFsbEVycm9yJyxcbiAgICAgICAgfSk7XG4gICAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0aGlzLCBcImRhdGFcIiwge1xuICAgICAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICAgICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgICAgICAgICAgIHdyaXRhYmxlOiB0cnVlLFxuICAgICAgICAgICAgdmFsdWU6IHZvaWQgMFxuICAgICAgICB9KTtcbiAgICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRoaXMsIFwicGFyYW1zXCIsIHtcbiAgICAgICAgICAgIGVudW1lcmFibGU6IHRydWUsXG4gICAgICAgICAgICBjb25maWd1cmFibGU6IHRydWUsXG4gICAgICAgICAgICB3cml0YWJsZTogdHJ1ZSxcbiAgICAgICAgICAgIHZhbHVlOiB2b2lkIDBcbiAgICAgICAgfSk7XG4gICAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0aGlzLCBcInNpemVcIiwge1xuICAgICAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICAgICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgICAgICAgICAgIHdyaXRhYmxlOiB0cnVlLFxuICAgICAgICAgICAgdmFsdWU6IHZvaWQgMFxuICAgICAgICB9KTtcbiAgICAgICAgdGhpcy5kYXRhID0gZGF0YTtcbiAgICAgICAgdGhpcy5wYXJhbXMgPSBwYXJhbXM7XG4gICAgICAgIHRoaXMuc2l6ZSA9IHNpemU7XG4gICAgfVxufVxuZXhwb3J0IGNsYXNzIEFiaURlY29kaW5nWmVyb0RhdGFFcnJvciBleHRlbmRzIEJhc2VFcnJvciB7XG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHN1cGVyKCdDYW5ub3QgZGVjb2RlIHplcm8gZGF0YSAoXCIweFwiKSB3aXRoIEFCSSBwYXJhbWV0ZXJzLicsIHtcbiAgICAgICAgICAgIG5hbWU6ICdBYmlEZWNvZGluZ1plcm9EYXRhRXJyb3InLFxuICAgICAgICB9KTtcbiAgICB9XG59XG5leHBvcnQgY2xhc3MgQWJpRW5jb2RpbmdBcnJheUxlbmd0aE1pc21hdGNoRXJyb3IgZXh0ZW5kcyBCYXNlRXJyb3Ige1xuICAgIGNvbnN0cnVjdG9yKHsgZXhwZWN0ZWRMZW5ndGgsIGdpdmVuTGVuZ3RoLCB0eXBlLCB9KSB7XG4gICAgICAgIHN1cGVyKFtcbiAgICAgICAgICAgIGBBQkkgZW5jb2RpbmcgYXJyYXkgbGVuZ3RoIG1pc21hdGNoIGZvciB0eXBlICR7dHlwZX0uYCxcbiAgICAgICAgICAgIGBFeHBlY3RlZCBsZW5ndGg6ICR7ZXhwZWN0ZWRMZW5ndGh9YCxcbiAgICAgICAgICAgIGBHaXZlbiBsZW5ndGg6ICR7Z2l2ZW5MZW5ndGh9YCxcbiAgICAgICAgXS5qb2luKCdcXG4nKSwgeyBuYW1lOiAnQWJpRW5jb2RpbmdBcnJheUxlbmd0aE1pc21hdGNoRXJyb3InIH0pO1xuICAgIH1cbn1cbmV4cG9ydCBjbGFzcyBBYmlFbmNvZGluZ0J5dGVzU2l6ZU1pc21hdGNoRXJyb3IgZXh0ZW5kcyBCYXNlRXJyb3Ige1xuICAgIGNvbnN0cnVjdG9yKHsgZXhwZWN0ZWRTaXplLCB2YWx1ZSB9KSB7XG4gICAgICAgIHN1cGVyKGBTaXplIG9mIGJ5dGVzIFwiJHt2YWx1ZX1cIiAoYnl0ZXMke3NpemUodmFsdWUpfSkgZG9lcyBub3QgbWF0Y2ggZXhwZWN0ZWQgc2l6ZSAoYnl0ZXMke2V4cGVjdGVkU2l6ZX0pLmAsIHsgbmFtZTogJ0FiaUVuY29kaW5nQnl0ZXNTaXplTWlzbWF0Y2hFcnJvcicgfSk7XG4gICAgfVxufVxuZXhwb3J0IGNsYXNzIEFiaUVuY29kaW5nTGVuZ3RoTWlzbWF0Y2hFcnJvciBleHRlbmRzIEJhc2VFcnJvciB7XG4gICAgY29uc3RydWN0b3IoeyBleHBlY3RlZExlbmd0aCwgZ2l2ZW5MZW5ndGgsIH0pIHtcbiAgICAgICAgc3VwZXIoW1xuICAgICAgICAgICAgJ0FCSSBlbmNvZGluZyBwYXJhbXMvdmFsdWVzIGxlbmd0aCBtaXNtYXRjaC4nLFxuICAgICAgICAgICAgYEV4cGVjdGVkIGxlbmd0aCAocGFyYW1zKTogJHtleHBlY3RlZExlbmd0aH1gLFxuICAgICAgICAgICAgYEdpdmVuIGxlbmd0aCAodmFsdWVzKTogJHtnaXZlbkxlbmd0aH1gLFxuICAgICAgICBdLmpvaW4oJ1xcbicpLCB7IG5hbWU6ICdBYmlFbmNvZGluZ0xlbmd0aE1pc21hdGNoRXJyb3InIH0pO1xuICAgIH1cbn1cbmV4cG9ydCBjbGFzcyBBYmlFcnJvcklucHV0c05vdEZvdW5kRXJyb3IgZXh0ZW5kcyBCYXNlRXJyb3Ige1xuICAgIGNvbnN0cnVjdG9yKGVycm9yTmFtZSwgeyBkb2NzUGF0aCB9KSB7XG4gICAgICAgIHN1cGVyKFtcbiAgICAgICAgICAgIGBBcmd1bWVudHMgKFxcYGFyZ3NcXGApIHdlcmUgcHJvdmlkZWQgdG8gXCIke2Vycm9yTmFtZX1cIiwgYnV0IFwiJHtlcnJvck5hbWV9XCIgb24gdGhlIEFCSSBkb2VzIG5vdCBjb250YWluIGFueSBwYXJhbWV0ZXJzIChcXGBpbnB1dHNcXGApLmAsXG4gICAgICAgICAgICAnQ2Fubm90IGVuY29kZSBlcnJvciByZXN1bHQgd2l0aG91dCBrbm93aW5nIHdoYXQgdGhlIHBhcmFtZXRlciB0eXBlcyBhcmUuJyxcbiAgICAgICAgICAgICdNYWtlIHN1cmUgeW91IGFyZSB1c2luZyB0aGUgY29ycmVjdCBBQkkgYW5kIHRoYXQgdGhlIGlucHV0cyBleGlzdCBvbiBpdC4nLFxuICAgICAgICBdLmpvaW4oJ1xcbicpLCB7XG4gICAgICAgICAgICBkb2NzUGF0aCxcbiAgICAgICAgICAgIG5hbWU6ICdBYmlFcnJvcklucHV0c05vdEZvdW5kRXJyb3InLFxuICAgICAgICB9KTtcbiAgICB9XG59XG5leHBvcnQgY2xhc3MgQWJpRXJyb3JOb3RGb3VuZEVycm9yIGV4dGVuZHMgQmFzZUVycm9yIHtcbiAgICBjb25zdHJ1Y3RvcihlcnJvck5hbWUsIHsgZG9jc1BhdGggfSA9IHt9KSB7XG4gICAgICAgIHN1cGVyKFtcbiAgICAgICAgICAgIGBFcnJvciAke2Vycm9yTmFtZSA/IGBcIiR7ZXJyb3JOYW1lfVwiIGAgOiAnJ31ub3QgZm91bmQgb24gQUJJLmAsXG4gICAgICAgICAgICAnTWFrZSBzdXJlIHlvdSBhcmUgdXNpbmcgdGhlIGNvcnJlY3QgQUJJIGFuZCB0aGF0IHRoZSBlcnJvciBleGlzdHMgb24gaXQuJyxcbiAgICAgICAgXS5qb2luKCdcXG4nKSwge1xuICAgICAgICAgICAgZG9jc1BhdGgsXG4gICAgICAgICAgICBuYW1lOiAnQWJpRXJyb3JOb3RGb3VuZEVycm9yJyxcbiAgICAgICAgfSk7XG4gICAgfVxufVxuZXhwb3J0IGNsYXNzIEFiaUVycm9yU2lnbmF0dXJlTm90Rm91bmRFcnJvciBleHRlbmRzIEJhc2VFcnJvciB7XG4gICAgY29uc3RydWN0b3Ioc2lnbmF0dXJlLCB7IGRvY3NQYXRoIH0pIHtcbiAgICAgICAgc3VwZXIoW1xuICAgICAgICAgICAgYEVuY29kZWQgZXJyb3Igc2lnbmF0dXJlIFwiJHtzaWduYXR1cmV9XCIgbm90IGZvdW5kIG9uIEFCSS5gLFxuICAgICAgICAgICAgJ01ha2Ugc3VyZSB5b3UgYXJlIHVzaW5nIHRoZSBjb3JyZWN0IEFCSSBhbmQgdGhhdCB0aGUgZXJyb3IgZXhpc3RzIG9uIGl0LicsXG4gICAgICAgICAgICBgWW91IGNhbiBsb29rIHVwIHRoZSBkZWNvZGVkIHNpZ25hdHVyZSBoZXJlOiBodHRwczovL29wZW5jaGFpbi54eXovc2lnbmF0dXJlcz9xdWVyeT0ke3NpZ25hdHVyZX0uYCxcbiAgICAgICAgXS5qb2luKCdcXG4nKSwge1xuICAgICAgICAgICAgZG9jc1BhdGgsXG4gICAgICAgICAgICBuYW1lOiAnQWJpRXJyb3JTaWduYXR1cmVOb3RGb3VuZEVycm9yJyxcbiAgICAgICAgfSk7XG4gICAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0aGlzLCBcInNpZ25hdHVyZVwiLCB7XG4gICAgICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlLFxuICAgICAgICAgICAgd3JpdGFibGU6IHRydWUsXG4gICAgICAgICAgICB2YWx1ZTogdm9pZCAwXG4gICAgICAgIH0pO1xuICAgICAgICB0aGlzLnNpZ25hdHVyZSA9IHNpZ25hdHVyZTtcbiAgICB9XG59XG5leHBvcnQgY2xhc3MgQWJpRXZlbnRTaWduYXR1cmVFbXB0eVRvcGljc0Vycm9yIGV4dGVuZHMgQmFzZUVycm9yIHtcbiAgICBjb25zdHJ1Y3Rvcih7IGRvY3NQYXRoIH0pIHtcbiAgICAgICAgc3VwZXIoJ0Nhbm5vdCBleHRyYWN0IGV2ZW50IHNpZ25hdHVyZSBmcm9tIGVtcHR5IHRvcGljcy4nLCB7XG4gICAgICAgICAgICBkb2NzUGF0aCxcbiAgICAgICAgICAgIG5hbWU6ICdBYmlFdmVudFNpZ25hdHVyZUVtcHR5VG9waWNzRXJyb3InLFxuICAgICAgICB9KTtcbiAgICB9XG59XG5leHBvcnQgY2xhc3MgQWJpRXZlbnRTaWduYXR1cmVOb3RGb3VuZEVycm9yIGV4dGVuZHMgQmFzZUVycm9yIHtcbiAgICBjb25zdHJ1Y3RvcihzaWduYXR1cmUsIHsgZG9jc1BhdGggfSkge1xuICAgICAgICBzdXBlcihbXG4gICAgICAgICAgICBgRW5jb2RlZCBldmVudCBzaWduYXR1cmUgXCIke3NpZ25hdHVyZX1cIiBub3QgZm91bmQgb24gQUJJLmAsXG4gICAgICAgICAgICAnTWFrZSBzdXJlIHlvdSBhcmUgdXNpbmcgdGhlIGNvcnJlY3QgQUJJIGFuZCB0aGF0IHRoZSBldmVudCBleGlzdHMgb24gaXQuJyxcbiAgICAgICAgICAgIGBZb3UgY2FuIGxvb2sgdXAgdGhlIHNpZ25hdHVyZSBoZXJlOiBodHRwczovL29wZW5jaGFpbi54eXovc2lnbmF0dXJlcz9xdWVyeT0ke3NpZ25hdHVyZX0uYCxcbiAgICAgICAgXS5qb2luKCdcXG4nKSwge1xuICAgICAgICAgICAgZG9jc1BhdGgsXG4gICAgICAgICAgICBuYW1lOiAnQWJpRXZlbnRTaWduYXR1cmVOb3RGb3VuZEVycm9yJyxcbiAgICAgICAgfSk7XG4gICAgfVxufVxuZXhwb3J0IGNsYXNzIEFiaUV2ZW50Tm90Rm91bmRFcnJvciBleHRlbmRzIEJhc2VFcnJvciB7XG4gICAgY29uc3RydWN0b3IoZXZlbnROYW1lLCB7IGRvY3NQYXRoIH0gPSB7fSkge1xuICAgICAgICBzdXBlcihbXG4gICAgICAgICAgICBgRXZlbnQgJHtldmVudE5hbWUgPyBgXCIke2V2ZW50TmFtZX1cIiBgIDogJyd9bm90IGZvdW5kIG9uIEFCSS5gLFxuICAgICAgICAgICAgJ01ha2Ugc3VyZSB5b3UgYXJlIHVzaW5nIHRoZSBjb3JyZWN0IEFCSSBhbmQgdGhhdCB0aGUgZXZlbnQgZXhpc3RzIG9uIGl0LicsXG4gICAgICAgIF0uam9pbignXFxuJyksIHtcbiAgICAgICAgICAgIGRvY3NQYXRoLFxuICAgICAgICAgICAgbmFtZTogJ0FiaUV2ZW50Tm90Rm91bmRFcnJvcicsXG4gICAgICAgIH0pO1xuICAgIH1cbn1cbmV4cG9ydCBjbGFzcyBBYmlGdW5jdGlvbk5vdEZvdW5kRXJyb3IgZXh0ZW5kcyBCYXNlRXJyb3Ige1xuICAgIGNvbnN0cnVjdG9yKGZ1bmN0aW9uTmFtZSwgeyBkb2NzUGF0aCB9ID0ge30pIHtcbiAgICAgICAgc3VwZXIoW1xuICAgICAgICAgICAgYEZ1bmN0aW9uICR7ZnVuY3Rpb25OYW1lID8gYFwiJHtmdW5jdGlvbk5hbWV9XCIgYCA6ICcnfW5vdCBmb3VuZCBvbiBBQkkuYCxcbiAgICAgICAgICAgICdNYWtlIHN1cmUgeW91IGFyZSB1c2luZyB0aGUgY29ycmVjdCBBQkkgYW5kIHRoYXQgdGhlIGZ1bmN0aW9uIGV4aXN0cyBvbiBpdC4nLFxuICAgICAgICBdLmpvaW4oJ1xcbicpLCB7XG4gICAgICAgICAgICBkb2NzUGF0aCxcbiAgICAgICAgICAgIG5hbWU6ICdBYmlGdW5jdGlvbk5vdEZvdW5kRXJyb3InLFxuICAgICAgICB9KTtcbiAgICB9XG59XG5leHBvcnQgY2xhc3MgQWJpRnVuY3Rpb25PdXRwdXRzTm90Rm91bmRFcnJvciBleHRlbmRzIEJhc2VFcnJvciB7XG4gICAgY29uc3RydWN0b3IoZnVuY3Rpb25OYW1lLCB7IGRvY3NQYXRoIH0pIHtcbiAgICAgICAgc3VwZXIoW1xuICAgICAgICAgICAgYEZ1bmN0aW9uIFwiJHtmdW5jdGlvbk5hbWV9XCIgZG9lcyBub3QgY29udGFpbiBhbnkgXFxgb3V0cHV0c1xcYCBvbiBBQkkuYCxcbiAgICAgICAgICAgICdDYW5ub3QgZGVjb2RlIGZ1bmN0aW9uIHJlc3VsdCB3aXRob3V0IGtub3dpbmcgd2hhdCB0aGUgcGFyYW1ldGVyIHR5cGVzIGFyZS4nLFxuICAgICAgICAgICAgJ01ha2Ugc3VyZSB5b3UgYXJlIHVzaW5nIHRoZSBjb3JyZWN0IEFCSSBhbmQgdGhhdCB0aGUgZnVuY3Rpb24gZXhpc3RzIG9uIGl0LicsXG4gICAgICAgIF0uam9pbignXFxuJyksIHtcbiAgICAgICAgICAgIGRvY3NQYXRoLFxuICAgICAgICAgICAgbmFtZTogJ0FiaUZ1bmN0aW9uT3V0cHV0c05vdEZvdW5kRXJyb3InLFxuICAgICAgICB9KTtcbiAgICB9XG59XG5leHBvcnQgY2xhc3MgQWJpRnVuY3Rpb25TaWduYXR1cmVOb3RGb3VuZEVycm9yIGV4dGVuZHMgQmFzZUVycm9yIHtcbiAgICBjb25zdHJ1Y3RvcihzaWduYXR1cmUsIHsgZG9jc1BhdGggfSkge1xuICAgICAgICBzdXBlcihbXG4gICAgICAgICAgICBgRW5jb2RlZCBmdW5jdGlvbiBzaWduYXR1cmUgXCIke3NpZ25hdHVyZX1cIiBub3QgZm91bmQgb24gQUJJLmAsXG4gICAgICAgICAgICAnTWFrZSBzdXJlIHlvdSBhcmUgdXNpbmcgdGhlIGNvcnJlY3QgQUJJIGFuZCB0aGF0IHRoZSBmdW5jdGlvbiBleGlzdHMgb24gaXQuJyxcbiAgICAgICAgICAgIGBZb3UgY2FuIGxvb2sgdXAgdGhlIHNpZ25hdHVyZSBoZXJlOiBodHRwczovL29wZW5jaGFpbi54eXovc2lnbmF0dXJlcz9xdWVyeT0ke3NpZ25hdHVyZX0uYCxcbiAgICAgICAgXS5qb2luKCdcXG4nKSwge1xuICAgICAgICAgICAgZG9jc1BhdGgsXG4gICAgICAgICAgICBuYW1lOiAnQWJpRnVuY3Rpb25TaWduYXR1cmVOb3RGb3VuZEVycm9yJyxcbiAgICAgICAgfSk7XG4gICAgfVxufVxuZXhwb3J0IGNsYXNzIEFiaUl0ZW1BbWJpZ3VpdHlFcnJvciBleHRlbmRzIEJhc2VFcnJvciB7XG4gICAgY29uc3RydWN0b3IoeCwgeSkge1xuICAgICAgICBzdXBlcignRm91bmQgYW1iaWd1b3VzIHR5cGVzIGluIG92ZXJsb2FkZWQgQUJJIGl0ZW1zLicsIHtcbiAgICAgICAgICAgIG1ldGFNZXNzYWdlczogW1xuICAgICAgICAgICAgICAgIGBcXGAke3gudHlwZX1cXGAgaW4gXFxgJHtmb3JtYXRBYmlJdGVtKHguYWJpSXRlbSl9XFxgLCBhbmRgLFxuICAgICAgICAgICAgICAgIGBcXGAke3kudHlwZX1cXGAgaW4gXFxgJHtmb3JtYXRBYmlJdGVtKHkuYWJpSXRlbSl9XFxgYCxcbiAgICAgICAgICAgICAgICAnJyxcbiAgICAgICAgICAgICAgICAnVGhlc2UgdHlwZXMgZW5jb2RlIGRpZmZlcmVudGx5IGFuZCBjYW5ub3QgYmUgZGlzdGluZ3Vpc2hlZCBhdCBydW50aW1lLicsXG4gICAgICAgICAgICAgICAgJ1JlbW92ZSBvbmUgb2YgdGhlIGFtYmlndW91cyBpdGVtcyBpbiB0aGUgQUJJLicsXG4gICAgICAgICAgICBdLFxuICAgICAgICAgICAgbmFtZTogJ0FiaUl0ZW1BbWJpZ3VpdHlFcnJvcicsXG4gICAgICAgIH0pO1xuICAgIH1cbn1cbmV4cG9ydCBjbGFzcyBCeXRlc1NpemVNaXNtYXRjaEVycm9yIGV4dGVuZHMgQmFzZUVycm9yIHtcbiAgICBjb25zdHJ1Y3Rvcih7IGV4cGVjdGVkU2l6ZSwgZ2l2ZW5TaXplLCB9KSB7XG4gICAgICAgIHN1cGVyKGBFeHBlY3RlZCBieXRlcyR7ZXhwZWN0ZWRTaXplfSwgZ290IGJ5dGVzJHtnaXZlblNpemV9LmAsIHtcbiAgICAgICAgICAgIG5hbWU6ICdCeXRlc1NpemVNaXNtYXRjaEVycm9yJyxcbiAgICAgICAgfSk7XG4gICAgfVxufVxuZXhwb3J0IGNsYXNzIERlY29kZUxvZ0RhdGFNaXNtYXRjaCBleHRlbmRzIEJhc2VFcnJvciB7XG4gICAgY29uc3RydWN0b3IoeyBhYmlJdGVtLCBkYXRhLCBwYXJhbXMsIHNpemUsIH0pIHtcbiAgICAgICAgc3VwZXIoW1xuICAgICAgICAgICAgYERhdGEgc2l6ZSBvZiAke3NpemV9IGJ5dGVzIGlzIHRvbyBzbWFsbCBmb3Igbm9uLWluZGV4ZWQgZXZlbnQgcGFyYW1ldGVycy5gLFxuICAgICAgICBdLmpvaW4oJ1xcbicpLCB7XG4gICAgICAgICAgICBtZXRhTWVzc2FnZXM6IFtcbiAgICAgICAgICAgICAgICBgUGFyYW1zOiAoJHtmb3JtYXRBYmlQYXJhbXMocGFyYW1zLCB7IGluY2x1ZGVOYW1lOiB0cnVlIH0pfSlgLFxuICAgICAgICAgICAgICAgIGBEYXRhOiAgICR7ZGF0YX0gKCR7c2l6ZX0gYnl0ZXMpYCxcbiAgICAgICAgICAgIF0sXG4gICAgICAgICAgICBuYW1lOiAnRGVjb2RlTG9nRGF0YU1pc21hdGNoJyxcbiAgICAgICAgfSk7XG4gICAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0aGlzLCBcImFiaUl0ZW1cIiwge1xuICAgICAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICAgICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgICAgICAgICAgIHdyaXRhYmxlOiB0cnVlLFxuICAgICAgICAgICAgdmFsdWU6IHZvaWQgMFxuICAgICAgICB9KTtcbiAgICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRoaXMsIFwiZGF0YVwiLCB7XG4gICAgICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlLFxuICAgICAgICAgICAgd3JpdGFibGU6IHRydWUsXG4gICAgICAgICAgICB2YWx1ZTogdm9pZCAwXG4gICAgICAgIH0pO1xuICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkodGhpcywgXCJwYXJhbXNcIiwge1xuICAgICAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICAgICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgICAgICAgICAgIHdyaXRhYmxlOiB0cnVlLFxuICAgICAgICAgICAgdmFsdWU6IHZvaWQgMFxuICAgICAgICB9KTtcbiAgICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRoaXMsIFwic2l6ZVwiLCB7XG4gICAgICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlLFxuICAgICAgICAgICAgd3JpdGFibGU6IHRydWUsXG4gICAgICAgICAgICB2YWx1ZTogdm9pZCAwXG4gICAgICAgIH0pO1xuICAgICAgICB0aGlzLmFiaUl0ZW0gPSBhYmlJdGVtO1xuICAgICAgICB0aGlzLmRhdGEgPSBkYXRhO1xuICAgICAgICB0aGlzLnBhcmFtcyA9IHBhcmFtcztcbiAgICAgICAgdGhpcy5zaXplID0gc2l6ZTtcbiAgICB9XG59XG5leHBvcnQgY2xhc3MgRGVjb2RlTG9nVG9waWNzTWlzbWF0Y2ggZXh0ZW5kcyBCYXNlRXJyb3Ige1xuICAgIGNvbnN0cnVjdG9yKHsgYWJpSXRlbSwgcGFyYW0sIH0pIHtcbiAgICAgICAgc3VwZXIoW1xuICAgICAgICAgICAgYEV4cGVjdGVkIGEgdG9waWMgZm9yIGluZGV4ZWQgZXZlbnQgcGFyYW1ldGVyJHtwYXJhbS5uYW1lID8gYCBcIiR7cGFyYW0ubmFtZX1cImAgOiAnJ30gb24gZXZlbnQgXCIke2Zvcm1hdEFiaUl0ZW0oYWJpSXRlbSwgeyBpbmNsdWRlTmFtZTogdHJ1ZSB9KX1cIi5gLFxuICAgICAgICBdLmpvaW4oJ1xcbicpLCB7IG5hbWU6ICdEZWNvZGVMb2dUb3BpY3NNaXNtYXRjaCcgfSk7XG4gICAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0aGlzLCBcImFiaUl0ZW1cIiwge1xuICAgICAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICAgICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgICAgICAgICAgIHdyaXRhYmxlOiB0cnVlLFxuICAgICAgICAgICAgdmFsdWU6IHZvaWQgMFxuICAgICAgICB9KTtcbiAgICAgICAgdGhpcy5hYmlJdGVtID0gYWJpSXRlbTtcbiAgICB9XG59XG5leHBvcnQgY2xhc3MgSW52YWxpZEFiaUVuY29kaW5nVHlwZUVycm9yIGV4dGVuZHMgQmFzZUVycm9yIHtcbiAgICBjb25zdHJ1Y3Rvcih0eXBlLCB7IGRvY3NQYXRoIH0pIHtcbiAgICAgICAgc3VwZXIoW1xuICAgICAgICAgICAgYFR5cGUgXCIke3R5cGV9XCIgaXMgbm90IGEgdmFsaWQgZW5jb2RpbmcgdHlwZS5gLFxuICAgICAgICAgICAgJ1BsZWFzZSBwcm92aWRlIGEgdmFsaWQgQUJJIHR5cGUuJyxcbiAgICAgICAgXS5qb2luKCdcXG4nKSwgeyBkb2NzUGF0aCwgbmFtZTogJ0ludmFsaWRBYmlFbmNvZGluZ1R5cGUnIH0pO1xuICAgIH1cbn1cbmV4cG9ydCBjbGFzcyBJbnZhbGlkQWJpRGVjb2RpbmdUeXBlRXJyb3IgZXh0ZW5kcyBCYXNlRXJyb3Ige1xuICAgIGNvbnN0cnVjdG9yKHR5cGUsIHsgZG9jc1BhdGggfSkge1xuICAgICAgICBzdXBlcihbXG4gICAgICAgICAgICBgVHlwZSBcIiR7dHlwZX1cIiBpcyBub3QgYSB2YWxpZCBkZWNvZGluZyB0eXBlLmAsXG4gICAgICAgICAgICAnUGxlYXNlIHByb3ZpZGUgYSB2YWxpZCBBQkkgdHlwZS4nLFxuICAgICAgICBdLmpvaW4oJ1xcbicpLCB7IGRvY3NQYXRoLCBuYW1lOiAnSW52YWxpZEFiaURlY29kaW5nVHlwZScgfSk7XG4gICAgfVxufVxuZXhwb3J0IGNsYXNzIEludmFsaWRBcnJheUVycm9yIGV4dGVuZHMgQmFzZUVycm9yIHtcbiAgICBjb25zdHJ1Y3Rvcih2YWx1ZSkge1xuICAgICAgICBzdXBlcihbYFZhbHVlIFwiJHt2YWx1ZX1cIiBpcyBub3QgYSB2YWxpZCBhcnJheS5gXS5qb2luKCdcXG4nKSwge1xuICAgICAgICAgICAgbmFtZTogJ0ludmFsaWRBcnJheUVycm9yJyxcbiAgICAgICAgfSk7XG4gICAgfVxufVxuZXhwb3J0IGNsYXNzIEludmFsaWREZWZpbml0aW9uVHlwZUVycm9yIGV4dGVuZHMgQmFzZUVycm9yIHtcbiAgICBjb25zdHJ1Y3Rvcih0eXBlKSB7XG4gICAgICAgIHN1cGVyKFtcbiAgICAgICAgICAgIGBcIiR7dHlwZX1cIiBpcyBub3QgYSB2YWxpZCBkZWZpbml0aW9uIHR5cGUuYCxcbiAgICAgICAgICAgICdWYWxpZCB0eXBlczogXCJmdW5jdGlvblwiLCBcImV2ZW50XCIsIFwiZXJyb3JcIicsXG4gICAgICAgIF0uam9pbignXFxuJyksIHsgbmFtZTogJ0ludmFsaWREZWZpbml0aW9uVHlwZUVycm9yJyB9KTtcbiAgICB9XG59XG5leHBvcnQgY2xhc3MgVW5zdXBwb3J0ZWRQYWNrZWRBYmlUeXBlIGV4dGVuZHMgQmFzZUVycm9yIHtcbiAgICBjb25zdHJ1Y3Rvcih0eXBlKSB7XG4gICAgICAgIHN1cGVyKGBUeXBlIFwiJHt0eXBlfVwiIGlzIG5vdCBzdXBwb3J0ZWQgZm9yIHBhY2tlZCBlbmNvZGluZy5gLCB7XG4gICAgICAgICAgICBuYW1lOiAnVW5zdXBwb3J0ZWRQYWNrZWRBYmlUeXBlJyxcbiAgICAgICAgfSk7XG4gICAgfVxufVxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9YWJpLmpzLm1hcCIsCiAgICAiaW1wb3J0IHsgQmFzZUVycm9yIH0gZnJvbSAnLi9iYXNlLmpzJztcbmV4cG9ydCBjbGFzcyBTbGljZU9mZnNldE91dE9mQm91bmRzRXJyb3IgZXh0ZW5kcyBCYXNlRXJyb3Ige1xuICAgIGNvbnN0cnVjdG9yKHsgb2Zmc2V0LCBwb3NpdGlvbiwgc2l6ZSwgfSkge1xuICAgICAgICBzdXBlcihgU2xpY2UgJHtwb3NpdGlvbiA9PT0gJ3N0YXJ0JyA/ICdzdGFydGluZycgOiAnZW5kaW5nJ30gYXQgb2Zmc2V0IFwiJHtvZmZzZXR9XCIgaXMgb3V0LW9mLWJvdW5kcyAoc2l6ZTogJHtzaXplfSkuYCwgeyBuYW1lOiAnU2xpY2VPZmZzZXRPdXRPZkJvdW5kc0Vycm9yJyB9KTtcbiAgICB9XG59XG5leHBvcnQgY2xhc3MgU2l6ZUV4Y2VlZHNQYWRkaW5nU2l6ZUVycm9yIGV4dGVuZHMgQmFzZUVycm9yIHtcbiAgICBjb25zdHJ1Y3Rvcih7IHNpemUsIHRhcmdldFNpemUsIHR5cGUsIH0pIHtcbiAgICAgICAgc3VwZXIoYCR7dHlwZS5jaGFyQXQoMCkudG9VcHBlckNhc2UoKX0ke3R5cGVcbiAgICAgICAgICAgIC5zbGljZSgxKVxuICAgICAgICAgICAgLnRvTG93ZXJDYXNlKCl9IHNpemUgKCR7c2l6ZX0pIGV4Y2VlZHMgcGFkZGluZyBzaXplICgke3RhcmdldFNpemV9KS5gLCB7IG5hbWU6ICdTaXplRXhjZWVkc1BhZGRpbmdTaXplRXJyb3InIH0pO1xuICAgIH1cbn1cbmV4cG9ydCBjbGFzcyBJbnZhbGlkQnl0ZXNMZW5ndGhFcnJvciBleHRlbmRzIEJhc2VFcnJvciB7XG4gICAgY29uc3RydWN0b3IoeyBzaXplLCB0YXJnZXRTaXplLCB0eXBlLCB9KSB7XG4gICAgICAgIHN1cGVyKGAke3R5cGUuY2hhckF0KDApLnRvVXBwZXJDYXNlKCl9JHt0eXBlXG4gICAgICAgICAgICAuc2xpY2UoMSlcbiAgICAgICAgICAgIC50b0xvd2VyQ2FzZSgpfSBpcyBleHBlY3RlZCB0byBiZSAke3RhcmdldFNpemV9ICR7dHlwZX0gbG9uZywgYnV0IGlzICR7c2l6ZX0gJHt0eXBlfSBsb25nLmAsIHsgbmFtZTogJ0ludmFsaWRCeXRlc0xlbmd0aEVycm9yJyB9KTtcbiAgICB9XG59XG4vLyMgc291cmNlTWFwcGluZ1VSTD1kYXRhLmpzLm1hcCIsCiAgICAiaW1wb3J0IHsgU2xpY2VPZmZzZXRPdXRPZkJvdW5kc0Vycm9yLCB9IGZyb20gJy4uLy4uL2Vycm9ycy9kYXRhLmpzJztcbmltcG9ydCB7IGlzSGV4IH0gZnJvbSAnLi9pc0hleC5qcyc7XG5pbXBvcnQgeyBzaXplIH0gZnJvbSAnLi9zaXplLmpzJztcbi8qKlxuICogQGRlc2NyaXB0aW9uIFJldHVybnMgYSBzZWN0aW9uIG9mIHRoZSBoZXggb3IgYnl0ZSBhcnJheSBnaXZlbiBhIHN0YXJ0L2VuZCBieXRlcyBvZmZzZXQuXG4gKlxuICogQHBhcmFtIHZhbHVlIFRoZSBoZXggb3IgYnl0ZSBhcnJheSB0byBzbGljZS5cbiAqIEBwYXJhbSBzdGFydCBUaGUgc3RhcnQgb2Zmc2V0IChpbiBieXRlcykuXG4gKiBAcGFyYW0gZW5kIFRoZSBlbmQgb2Zmc2V0IChpbiBieXRlcykuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBzbGljZSh2YWx1ZSwgc3RhcnQsIGVuZCwgeyBzdHJpY3QgfSA9IHt9KSB7XG4gICAgaWYgKGlzSGV4KHZhbHVlLCB7IHN0cmljdDogZmFsc2UgfSkpXG4gICAgICAgIHJldHVybiBzbGljZUhleCh2YWx1ZSwgc3RhcnQsIGVuZCwge1xuICAgICAgICAgICAgc3RyaWN0LFxuICAgICAgICB9KTtcbiAgICByZXR1cm4gc2xpY2VCeXRlcyh2YWx1ZSwgc3RhcnQsIGVuZCwge1xuICAgICAgICBzdHJpY3QsXG4gICAgfSk7XG59XG5mdW5jdGlvbiBhc3NlcnRTdGFydE9mZnNldCh2YWx1ZSwgc3RhcnQpIHtcbiAgICBpZiAodHlwZW9mIHN0YXJ0ID09PSAnbnVtYmVyJyAmJiBzdGFydCA+IDAgJiYgc3RhcnQgPiBzaXplKHZhbHVlKSAtIDEpXG4gICAgICAgIHRocm93IG5ldyBTbGljZU9mZnNldE91dE9mQm91bmRzRXJyb3Ioe1xuICAgICAgICAgICAgb2Zmc2V0OiBzdGFydCxcbiAgICAgICAgICAgIHBvc2l0aW9uOiAnc3RhcnQnLFxuICAgICAgICAgICAgc2l6ZTogc2l6ZSh2YWx1ZSksXG4gICAgICAgIH0pO1xufVxuZnVuY3Rpb24gYXNzZXJ0RW5kT2Zmc2V0KHZhbHVlLCBzdGFydCwgZW5kKSB7XG4gICAgaWYgKHR5cGVvZiBzdGFydCA9PT0gJ251bWJlcicgJiZcbiAgICAgICAgdHlwZW9mIGVuZCA9PT0gJ251bWJlcicgJiZcbiAgICAgICAgc2l6ZSh2YWx1ZSkgIT09IGVuZCAtIHN0YXJ0KSB7XG4gICAgICAgIHRocm93IG5ldyBTbGljZU9mZnNldE91dE9mQm91bmRzRXJyb3Ioe1xuICAgICAgICAgICAgb2Zmc2V0OiBlbmQsXG4gICAgICAgICAgICBwb3NpdGlvbjogJ2VuZCcsXG4gICAgICAgICAgICBzaXplOiBzaXplKHZhbHVlKSxcbiAgICAgICAgfSk7XG4gICAgfVxufVxuLyoqXG4gKiBAZGVzY3JpcHRpb24gUmV0dXJucyBhIHNlY3Rpb24gb2YgdGhlIGJ5dGUgYXJyYXkgZ2l2ZW4gYSBzdGFydC9lbmQgYnl0ZXMgb2Zmc2V0LlxuICpcbiAqIEBwYXJhbSB2YWx1ZSBUaGUgYnl0ZSBhcnJheSB0byBzbGljZS5cbiAqIEBwYXJhbSBzdGFydCBUaGUgc3RhcnQgb2Zmc2V0IChpbiBieXRlcykuXG4gKiBAcGFyYW0gZW5kIFRoZSBlbmQgb2Zmc2V0IChpbiBieXRlcykuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBzbGljZUJ5dGVzKHZhbHVlXywgc3RhcnQsIGVuZCwgeyBzdHJpY3QgfSA9IHt9KSB7XG4gICAgYXNzZXJ0U3RhcnRPZmZzZXQodmFsdWVfLCBzdGFydCk7XG4gICAgY29uc3QgdmFsdWUgPSB2YWx1ZV8uc2xpY2Uoc3RhcnQsIGVuZCk7XG4gICAgaWYgKHN0cmljdClcbiAgICAgICAgYXNzZXJ0RW5kT2Zmc2V0KHZhbHVlLCBzdGFydCwgZW5kKTtcbiAgICByZXR1cm4gdmFsdWU7XG59XG4vKipcbiAqIEBkZXNjcmlwdGlvbiBSZXR1cm5zIGEgc2VjdGlvbiBvZiB0aGUgaGV4IHZhbHVlIGdpdmVuIGEgc3RhcnQvZW5kIGJ5dGVzIG9mZnNldC5cbiAqXG4gKiBAcGFyYW0gdmFsdWUgVGhlIGhleCB2YWx1ZSB0byBzbGljZS5cbiAqIEBwYXJhbSBzdGFydCBUaGUgc3RhcnQgb2Zmc2V0IChpbiBieXRlcykuXG4gKiBAcGFyYW0gZW5kIFRoZSBlbmQgb2Zmc2V0IChpbiBieXRlcykuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBzbGljZUhleCh2YWx1ZV8sIHN0YXJ0LCBlbmQsIHsgc3RyaWN0IH0gPSB7fSkge1xuICAgIGFzc2VydFN0YXJ0T2Zmc2V0KHZhbHVlXywgc3RhcnQpO1xuICAgIGNvbnN0IHZhbHVlID0gYDB4JHt2YWx1ZV9cbiAgICAgICAgLnJlcGxhY2UoJzB4JywgJycpXG4gICAgICAgIC5zbGljZSgoc3RhcnQgPz8gMCkgKiAyLCAoZW5kID8/IHZhbHVlXy5sZW5ndGgpICogMil9YDtcbiAgICBpZiAoc3RyaWN0KVxuICAgICAgICBhc3NlcnRFbmRPZmZzZXQodmFsdWUsIHN0YXJ0LCBlbmQpO1xuICAgIHJldHVybiB2YWx1ZTtcbn1cbi8vIyBzb3VyY2VNYXBwaW5nVVJMPXNsaWNlLmpzLm1hcCIsCiAgICAiaW1wb3J0IHsgU2l6ZUV4Y2VlZHNQYWRkaW5nU2l6ZUVycm9yLCB9IGZyb20gJy4uLy4uL2Vycm9ycy9kYXRhLmpzJztcbmV4cG9ydCBmdW5jdGlvbiBwYWQoaGV4T3JCeXRlcywgeyBkaXIsIHNpemUgPSAzMiB9ID0ge30pIHtcbiAgICBpZiAodHlwZW9mIGhleE9yQnl0ZXMgPT09ICdzdHJpbmcnKVxuICAgICAgICByZXR1cm4gcGFkSGV4KGhleE9yQnl0ZXMsIHsgZGlyLCBzaXplIH0pO1xuICAgIHJldHVybiBwYWRCeXRlcyhoZXhPckJ5dGVzLCB7IGRpciwgc2l6ZSB9KTtcbn1cbmV4cG9ydCBmdW5jdGlvbiBwYWRIZXgoaGV4XywgeyBkaXIsIHNpemUgPSAzMiB9ID0ge30pIHtcbiAgICBpZiAoc2l6ZSA9PT0gbnVsbClcbiAgICAgICAgcmV0dXJuIGhleF87XG4gICAgY29uc3QgaGV4ID0gaGV4Xy5yZXBsYWNlKCcweCcsICcnKTtcbiAgICBpZiAoaGV4Lmxlbmd0aCA+IHNpemUgKiAyKVxuICAgICAgICB0aHJvdyBuZXcgU2l6ZUV4Y2VlZHNQYWRkaW5nU2l6ZUVycm9yKHtcbiAgICAgICAgICAgIHNpemU6IE1hdGguY2VpbChoZXgubGVuZ3RoIC8gMiksXG4gICAgICAgICAgICB0YXJnZXRTaXplOiBzaXplLFxuICAgICAgICAgICAgdHlwZTogJ2hleCcsXG4gICAgICAgIH0pO1xuICAgIHJldHVybiBgMHgke2hleFtkaXIgPT09ICdyaWdodCcgPyAncGFkRW5kJyA6ICdwYWRTdGFydCddKHNpemUgKiAyLCAnMCcpfWA7XG59XG5leHBvcnQgZnVuY3Rpb24gcGFkQnl0ZXMoYnl0ZXMsIHsgZGlyLCBzaXplID0gMzIgfSA9IHt9KSB7XG4gICAgaWYgKHNpemUgPT09IG51bGwpXG4gICAgICAgIHJldHVybiBieXRlcztcbiAgICBpZiAoYnl0ZXMubGVuZ3RoID4gc2l6ZSlcbiAgICAgICAgdGhyb3cgbmV3IFNpemVFeGNlZWRzUGFkZGluZ1NpemVFcnJvcih7XG4gICAgICAgICAgICBzaXplOiBieXRlcy5sZW5ndGgsXG4gICAgICAgICAgICB0YXJnZXRTaXplOiBzaXplLFxuICAgICAgICAgICAgdHlwZTogJ2J5dGVzJyxcbiAgICAgICAgfSk7XG4gICAgY29uc3QgcGFkZGVkQnl0ZXMgPSBuZXcgVWludDhBcnJheShzaXplKTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHNpemU7IGkrKykge1xuICAgICAgICBjb25zdCBwYWRFbmQgPSBkaXIgPT09ICdyaWdodCc7XG4gICAgICAgIHBhZGRlZEJ5dGVzW3BhZEVuZCA/IGkgOiBzaXplIC0gaSAtIDFdID1cbiAgICAgICAgICAgIGJ5dGVzW3BhZEVuZCA/IGkgOiBieXRlcy5sZW5ndGggLSBpIC0gMV07XG4gICAgfVxuICAgIHJldHVybiBwYWRkZWRCeXRlcztcbn1cbi8vIyBzb3VyY2VNYXBwaW5nVVJMPXBhZC5qcy5tYXAiLAogICAgImltcG9ydCB7IEJhc2VFcnJvciB9IGZyb20gJy4vYmFzZS5qcyc7XG5leHBvcnQgY2xhc3MgSW50ZWdlck91dE9mUmFuZ2VFcnJvciBleHRlbmRzIEJhc2VFcnJvciB7XG4gICAgY29uc3RydWN0b3IoeyBtYXgsIG1pbiwgc2lnbmVkLCBzaXplLCB2YWx1ZSwgfSkge1xuICAgICAgICBzdXBlcihgTnVtYmVyIFwiJHt2YWx1ZX1cIiBpcyBub3QgaW4gc2FmZSAke3NpemUgPyBgJHtzaXplICogOH0tYml0ICR7c2lnbmVkID8gJ3NpZ25lZCcgOiAndW5zaWduZWQnfSBgIDogJyd9aW50ZWdlciByYW5nZSAke21heCA/IGAoJHttaW59IHRvICR7bWF4fSlgIDogYChhYm92ZSAke21pbn0pYH1gLCB7IG5hbWU6ICdJbnRlZ2VyT3V0T2ZSYW5nZUVycm9yJyB9KTtcbiAgICB9XG59XG5leHBvcnQgY2xhc3MgSW52YWxpZEJ5dGVzQm9vbGVhbkVycm9yIGV4dGVuZHMgQmFzZUVycm9yIHtcbiAgICBjb25zdHJ1Y3RvcihieXRlcykge1xuICAgICAgICBzdXBlcihgQnl0ZXMgdmFsdWUgXCIke2J5dGVzfVwiIGlzIG5vdCBhIHZhbGlkIGJvb2xlYW4uIFRoZSBieXRlcyBhcnJheSBtdXN0IGNvbnRhaW4gYSBzaW5nbGUgYnl0ZSBvZiBlaXRoZXIgYSAwIG9yIDEgdmFsdWUuYCwge1xuICAgICAgICAgICAgbmFtZTogJ0ludmFsaWRCeXRlc0Jvb2xlYW5FcnJvcicsXG4gICAgICAgIH0pO1xuICAgIH1cbn1cbmV4cG9ydCBjbGFzcyBJbnZhbGlkSGV4Qm9vbGVhbkVycm9yIGV4dGVuZHMgQmFzZUVycm9yIHtcbiAgICBjb25zdHJ1Y3RvcihoZXgpIHtcbiAgICAgICAgc3VwZXIoYEhleCB2YWx1ZSBcIiR7aGV4fVwiIGlzIG5vdCBhIHZhbGlkIGJvb2xlYW4uIFRoZSBoZXggdmFsdWUgbXVzdCBiZSBcIjB4MFwiIChmYWxzZSkgb3IgXCIweDFcIiAodHJ1ZSkuYCwgeyBuYW1lOiAnSW52YWxpZEhleEJvb2xlYW5FcnJvcicgfSk7XG4gICAgfVxufVxuZXhwb3J0IGNsYXNzIEludmFsaWRIZXhWYWx1ZUVycm9yIGV4dGVuZHMgQmFzZUVycm9yIHtcbiAgICBjb25zdHJ1Y3Rvcih2YWx1ZSkge1xuICAgICAgICBzdXBlcihgSGV4IHZhbHVlIFwiJHt2YWx1ZX1cIiBpcyBhbiBvZGQgbGVuZ3RoICgke3ZhbHVlLmxlbmd0aH0pLiBJdCBtdXN0IGJlIGFuIGV2ZW4gbGVuZ3RoLmAsIHsgbmFtZTogJ0ludmFsaWRIZXhWYWx1ZUVycm9yJyB9KTtcbiAgICB9XG59XG5leHBvcnQgY2xhc3MgU2l6ZU92ZXJmbG93RXJyb3IgZXh0ZW5kcyBCYXNlRXJyb3Ige1xuICAgIGNvbnN0cnVjdG9yKHsgZ2l2ZW5TaXplLCBtYXhTaXplIH0pIHtcbiAgICAgICAgc3VwZXIoYFNpemUgY2Fubm90IGV4Y2VlZCAke21heFNpemV9IGJ5dGVzLiBHaXZlbiBzaXplOiAke2dpdmVuU2l6ZX0gYnl0ZXMuYCwgeyBuYW1lOiAnU2l6ZU92ZXJmbG93RXJyb3InIH0pO1xuICAgIH1cbn1cbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWVuY29kaW5nLmpzLm1hcCIsCiAgICAiZXhwb3J0IGZ1bmN0aW9uIHRyaW0oaGV4T3JCeXRlcywgeyBkaXIgPSAnbGVmdCcgfSA9IHt9KSB7XG4gICAgbGV0IGRhdGEgPSB0eXBlb2YgaGV4T3JCeXRlcyA9PT0gJ3N0cmluZycgPyBoZXhPckJ5dGVzLnJlcGxhY2UoJzB4JywgJycpIDogaGV4T3JCeXRlcztcbiAgICBsZXQgc2xpY2VMZW5ndGggPSAwO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZGF0YS5sZW5ndGggLSAxOyBpKyspIHtcbiAgICAgICAgaWYgKGRhdGFbZGlyID09PSAnbGVmdCcgPyBpIDogZGF0YS5sZW5ndGggLSBpIC0gMV0udG9TdHJpbmcoKSA9PT0gJzAnKVxuICAgICAgICAgICAgc2xpY2VMZW5ndGgrKztcbiAgICAgICAgZWxzZVxuICAgICAgICAgICAgYnJlYWs7XG4gICAgfVxuICAgIGRhdGEgPVxuICAgICAgICBkaXIgPT09ICdsZWZ0J1xuICAgICAgICAgICAgPyBkYXRhLnNsaWNlKHNsaWNlTGVuZ3RoKVxuICAgICAgICAgICAgOiBkYXRhLnNsaWNlKDAsIGRhdGEubGVuZ3RoIC0gc2xpY2VMZW5ndGgpO1xuICAgIGlmICh0eXBlb2YgaGV4T3JCeXRlcyA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgaWYgKGRhdGEubGVuZ3RoID09PSAxICYmIGRpciA9PT0gJ3JpZ2h0JylcbiAgICAgICAgICAgIGRhdGEgPSBgJHtkYXRhfTBgO1xuICAgICAgICByZXR1cm4gYDB4JHtkYXRhLmxlbmd0aCAlIDIgPT09IDEgPyBgMCR7ZGF0YX1gIDogZGF0YX1gO1xuICAgIH1cbiAgICByZXR1cm4gZGF0YTtcbn1cbi8vIyBzb3VyY2VNYXBwaW5nVVJMPXRyaW0uanMubWFwIiwKICAgICJpbXBvcnQgeyBJbnZhbGlkSGV4Qm9vbGVhbkVycm9yLCBTaXplT3ZlcmZsb3dFcnJvciwgfSBmcm9tICcuLi8uLi9lcnJvcnMvZW5jb2RpbmcuanMnO1xuaW1wb3J0IHsgc2l6ZSBhcyBzaXplXyB9IGZyb20gJy4uL2RhdGEvc2l6ZS5qcyc7XG5pbXBvcnQgeyB0cmltIH0gZnJvbSAnLi4vZGF0YS90cmltLmpzJztcbmltcG9ydCB7IGhleFRvQnl0ZXMgfSBmcm9tICcuL3RvQnl0ZXMuanMnO1xuZXhwb3J0IGZ1bmN0aW9uIGFzc2VydFNpemUoaGV4T3JCeXRlcywgeyBzaXplIH0pIHtcbiAgICBpZiAoc2l6ZV8oaGV4T3JCeXRlcykgPiBzaXplKVxuICAgICAgICB0aHJvdyBuZXcgU2l6ZU92ZXJmbG93RXJyb3Ioe1xuICAgICAgICAgICAgZ2l2ZW5TaXplOiBzaXplXyhoZXhPckJ5dGVzKSxcbiAgICAgICAgICAgIG1heFNpemU6IHNpemUsXG4gICAgICAgIH0pO1xufVxuLyoqXG4gKiBEZWNvZGVzIGEgaGV4IHN0cmluZyBpbnRvIGEgc3RyaW5nLCBudW1iZXIsIGJpZ2ludCwgYm9vbGVhbiwgb3IgYnl0ZSBhcnJheS5cbiAqXG4gKiAtIERvY3M6IGh0dHBzOi8vdmllbS5zaC9kb2NzL3V0aWxpdGllcy9mcm9tSGV4XG4gKiAtIEV4YW1wbGU6IGh0dHBzOi8vdmllbS5zaC9kb2NzL3V0aWxpdGllcy9mcm9tSGV4I3VzYWdlXG4gKlxuICogQHBhcmFtIGhleCBIZXggc3RyaW5nIHRvIGRlY29kZS5cbiAqIEBwYXJhbSB0b09yT3B0cyBUeXBlIHRvIGNvbnZlcnQgdG8gb3Igb3B0aW9ucy5cbiAqIEByZXR1cm5zIERlY29kZWQgdmFsdWUuXG4gKlxuICogQGV4YW1wbGVcbiAqIGltcG9ydCB7IGZyb21IZXggfSBmcm9tICd2aWVtJ1xuICogY29uc3QgZGF0YSA9IGZyb21IZXgoJzB4MWE0JywgJ251bWJlcicpXG4gKiAvLyA0MjBcbiAqXG4gKiBAZXhhbXBsZVxuICogaW1wb3J0IHsgZnJvbUhleCB9IGZyb20gJ3ZpZW0nXG4gKiBjb25zdCBkYXRhID0gZnJvbUhleCgnMHg0ODY1NmM2YzZmMjA1NzZmNzI2YzY0MjEnLCAnc3RyaW5nJylcbiAqIC8vICdIZWxsbyB3b3JsZCdcbiAqXG4gKiBAZXhhbXBsZVxuICogaW1wb3J0IHsgZnJvbUhleCB9IGZyb20gJ3ZpZW0nXG4gKiBjb25zdCBkYXRhID0gZnJvbUhleCgnMHg0ODY1NmM2YzZmMjA1NzZmNzI2YzY0MjEwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwJywge1xuICogICBzaXplOiAzMixcbiAqICAgdG86ICdzdHJpbmcnXG4gKiB9KVxuICogLy8gJ0hlbGxvIHdvcmxkJ1xuICovXG5leHBvcnQgZnVuY3Rpb24gZnJvbUhleChoZXgsIHRvT3JPcHRzKSB7XG4gICAgY29uc3Qgb3B0cyA9IHR5cGVvZiB0b09yT3B0cyA9PT0gJ3N0cmluZycgPyB7IHRvOiB0b09yT3B0cyB9IDogdG9Pck9wdHM7XG4gICAgY29uc3QgdG8gPSBvcHRzLnRvO1xuICAgIGlmICh0byA9PT0gJ251bWJlcicpXG4gICAgICAgIHJldHVybiBoZXhUb051bWJlcihoZXgsIG9wdHMpO1xuICAgIGlmICh0byA9PT0gJ2JpZ2ludCcpXG4gICAgICAgIHJldHVybiBoZXhUb0JpZ0ludChoZXgsIG9wdHMpO1xuICAgIGlmICh0byA9PT0gJ3N0cmluZycpXG4gICAgICAgIHJldHVybiBoZXhUb1N0cmluZyhoZXgsIG9wdHMpO1xuICAgIGlmICh0byA9PT0gJ2Jvb2xlYW4nKVxuICAgICAgICByZXR1cm4gaGV4VG9Cb29sKGhleCwgb3B0cyk7XG4gICAgcmV0dXJuIGhleFRvQnl0ZXMoaGV4LCBvcHRzKTtcbn1cbi8qKlxuICogRGVjb2RlcyBhIGhleCB2YWx1ZSBpbnRvIGEgYmlnaW50LlxuICpcbiAqIC0gRG9jczogaHR0cHM6Ly92aWVtLnNoL2RvY3MvdXRpbGl0aWVzL2Zyb21IZXgjaGV4dG9iaWdpbnRcbiAqXG4gKiBAcGFyYW0gaGV4IEhleCB2YWx1ZSB0byBkZWNvZGUuXG4gKiBAcGFyYW0gb3B0cyBPcHRpb25zLlxuICogQHJldHVybnMgQmlnSW50IHZhbHVlLlxuICpcbiAqIEBleGFtcGxlXG4gKiBpbXBvcnQgeyBoZXhUb0JpZ0ludCB9IGZyb20gJ3ZpZW0nXG4gKiBjb25zdCBkYXRhID0gaGV4VG9CaWdJbnQoJzB4MWE0JywgeyBzaWduZWQ6IHRydWUgfSlcbiAqIC8vIDQyMG5cbiAqXG4gKiBAZXhhbXBsZVxuICogaW1wb3J0IHsgaGV4VG9CaWdJbnQgfSBmcm9tICd2aWVtJ1xuICogY29uc3QgZGF0YSA9IGhleFRvQmlnSW50KCcweDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAxYTQnLCB7IHNpemU6IDMyIH0pXG4gKiAvLyA0MjBuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBoZXhUb0JpZ0ludChoZXgsIG9wdHMgPSB7fSkge1xuICAgIGNvbnN0IHsgc2lnbmVkIH0gPSBvcHRzO1xuICAgIGlmIChvcHRzLnNpemUpXG4gICAgICAgIGFzc2VydFNpemUoaGV4LCB7IHNpemU6IG9wdHMuc2l6ZSB9KTtcbiAgICBjb25zdCB2YWx1ZSA9IEJpZ0ludChoZXgpO1xuICAgIGlmICghc2lnbmVkKVxuICAgICAgICByZXR1cm4gdmFsdWU7XG4gICAgY29uc3Qgc2l6ZSA9IChoZXgubGVuZ3RoIC0gMikgLyAyO1xuICAgIGNvbnN0IG1heCA9ICgxbiA8PCAoQmlnSW50KHNpemUpICogOG4gLSAxbikpIC0gMW47XG4gICAgaWYgKHZhbHVlIDw9IG1heClcbiAgICAgICAgcmV0dXJuIHZhbHVlO1xuICAgIHJldHVybiB2YWx1ZSAtIEJpZ0ludChgMHgkeydmJy5wYWRTdGFydChzaXplICogMiwgJ2YnKX1gKSAtIDFuO1xufVxuLyoqXG4gKiBEZWNvZGVzIGEgaGV4IHZhbHVlIGludG8gYSBib29sZWFuLlxuICpcbiAqIC0gRG9jczogaHR0cHM6Ly92aWVtLnNoL2RvY3MvdXRpbGl0aWVzL2Zyb21IZXgjaGV4dG9ib29sXG4gKlxuICogQHBhcmFtIGhleCBIZXggdmFsdWUgdG8gZGVjb2RlLlxuICogQHBhcmFtIG9wdHMgT3B0aW9ucy5cbiAqIEByZXR1cm5zIEJvb2xlYW4gdmFsdWUuXG4gKlxuICogQGV4YW1wbGVcbiAqIGltcG9ydCB7IGhleFRvQm9vbCB9IGZyb20gJ3ZpZW0nXG4gKiBjb25zdCBkYXRhID0gaGV4VG9Cb29sKCcweDAxJylcbiAqIC8vIHRydWVcbiAqXG4gKiBAZXhhbXBsZVxuICogaW1wb3J0IHsgaGV4VG9Cb29sIH0gZnJvbSAndmllbSdcbiAqIGNvbnN0IGRhdGEgPSBoZXhUb0Jvb2woJzB4MDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMScsIHsgc2l6ZTogMzIgfSlcbiAqIC8vIHRydWVcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGhleFRvQm9vbChoZXhfLCBvcHRzID0ge30pIHtcbiAgICBsZXQgaGV4ID0gaGV4XztcbiAgICBpZiAob3B0cy5zaXplKSB7XG4gICAgICAgIGFzc2VydFNpemUoaGV4LCB7IHNpemU6IG9wdHMuc2l6ZSB9KTtcbiAgICAgICAgaGV4ID0gdHJpbShoZXgpO1xuICAgIH1cbiAgICBpZiAodHJpbShoZXgpID09PSAnMHgwMCcpXG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICBpZiAodHJpbShoZXgpID09PSAnMHgwMScpXG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIHRocm93IG5ldyBJbnZhbGlkSGV4Qm9vbGVhbkVycm9yKGhleCk7XG59XG4vKipcbiAqIERlY29kZXMgYSBoZXggc3RyaW5nIGludG8gYSBudW1iZXIuXG4gKlxuICogLSBEb2NzOiBodHRwczovL3ZpZW0uc2gvZG9jcy91dGlsaXRpZXMvZnJvbUhleCNoZXh0b251bWJlclxuICpcbiAqIEBwYXJhbSBoZXggSGV4IHZhbHVlIHRvIGRlY29kZS5cbiAqIEBwYXJhbSBvcHRzIE9wdGlvbnMuXG4gKiBAcmV0dXJucyBOdW1iZXIgdmFsdWUuXG4gKlxuICogQGV4YW1wbGVcbiAqIGltcG9ydCB7IGhleFRvTnVtYmVyIH0gZnJvbSAndmllbSdcbiAqIGNvbnN0IGRhdGEgPSBoZXhUb051bWJlcignMHgxYTQnKVxuICogLy8gNDIwXG4gKlxuICogQGV4YW1wbGVcbiAqIGltcG9ydCB7IGhleFRvTnVtYmVyIH0gZnJvbSAndmllbSdcbiAqIGNvbnN0IGRhdGEgPSBoZXhUb0JpZ0ludCgnMHgwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMWE0JywgeyBzaXplOiAzMiB9KVxuICogLy8gNDIwXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBoZXhUb051bWJlcihoZXgsIG9wdHMgPSB7fSkge1xuICAgIHJldHVybiBOdW1iZXIoaGV4VG9CaWdJbnQoaGV4LCBvcHRzKSk7XG59XG4vKipcbiAqIERlY29kZXMgYSBoZXggdmFsdWUgaW50byBhIFVURi04IHN0cmluZy5cbiAqXG4gKiAtIERvY3M6IGh0dHBzOi8vdmllbS5zaC9kb2NzL3V0aWxpdGllcy9mcm9tSGV4I2hleHRvc3RyaW5nXG4gKlxuICogQHBhcmFtIGhleCBIZXggdmFsdWUgdG8gZGVjb2RlLlxuICogQHBhcmFtIG9wdHMgT3B0aW9ucy5cbiAqIEByZXR1cm5zIFN0cmluZyB2YWx1ZS5cbiAqXG4gKiBAZXhhbXBsZVxuICogaW1wb3J0IHsgaGV4VG9TdHJpbmcgfSBmcm9tICd2aWVtJ1xuICogY29uc3QgZGF0YSA9IGhleFRvU3RyaW5nKCcweDQ4NjU2YzZjNmYyMDU3NmY3MjZjNjQyMScpXG4gKiAvLyAnSGVsbG8gd29ybGQhJ1xuICpcbiAqIEBleGFtcGxlXG4gKiBpbXBvcnQgeyBoZXhUb1N0cmluZyB9IGZyb20gJ3ZpZW0nXG4gKiBjb25zdCBkYXRhID0gaGV4VG9TdHJpbmcoJzB4NDg2NTZjNmM2ZjIwNTc2ZjcyNmM2NDIxMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMCcsIHtcbiAqICBzaXplOiAzMixcbiAqIH0pXG4gKiAvLyAnSGVsbG8gd29ybGQnXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBoZXhUb1N0cmluZyhoZXgsIG9wdHMgPSB7fSkge1xuICAgIGxldCBieXRlcyA9IGhleFRvQnl0ZXMoaGV4KTtcbiAgICBpZiAob3B0cy5zaXplKSB7XG4gICAgICAgIGFzc2VydFNpemUoYnl0ZXMsIHsgc2l6ZTogb3B0cy5zaXplIH0pO1xuICAgICAgICBieXRlcyA9IHRyaW0oYnl0ZXMsIHsgZGlyOiAncmlnaHQnIH0pO1xuICAgIH1cbiAgICByZXR1cm4gbmV3IFRleHREZWNvZGVyKCkuZGVjb2RlKGJ5dGVzKTtcbn1cbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWZyb21IZXguanMubWFwIiwKICAgICJpbXBvcnQgeyBJbnRlZ2VyT3V0T2ZSYW5nZUVycm9yLCB9IGZyb20gJy4uLy4uL2Vycm9ycy9lbmNvZGluZy5qcyc7XG5pbXBvcnQgeyBwYWQgfSBmcm9tICcuLi9kYXRhL3BhZC5qcyc7XG5pbXBvcnQgeyBhc3NlcnRTaXplIH0gZnJvbSAnLi9mcm9tSGV4LmpzJztcbmNvbnN0IGhleGVzID0gLyojX19QVVJFX18qLyBBcnJheS5mcm9tKHsgbGVuZ3RoOiAyNTYgfSwgKF92LCBpKSA9PiBpLnRvU3RyaW5nKDE2KS5wYWRTdGFydCgyLCAnMCcpKTtcbi8qKlxuICogRW5jb2RlcyBhIHN0cmluZywgbnVtYmVyLCBiaWdpbnQsIG9yIEJ5dGVBcnJheSBpbnRvIGEgaGV4IHN0cmluZ1xuICpcbiAqIC0gRG9jczogaHR0cHM6Ly92aWVtLnNoL2RvY3MvdXRpbGl0aWVzL3RvSGV4XG4gKiAtIEV4YW1wbGU6IGh0dHBzOi8vdmllbS5zaC9kb2NzL3V0aWxpdGllcy90b0hleCN1c2FnZVxuICpcbiAqIEBwYXJhbSB2YWx1ZSBWYWx1ZSB0byBlbmNvZGUuXG4gKiBAcGFyYW0gb3B0cyBPcHRpb25zLlxuICogQHJldHVybnMgSGV4IHZhbHVlLlxuICpcbiAqIEBleGFtcGxlXG4gKiBpbXBvcnQgeyB0b0hleCB9IGZyb20gJ3ZpZW0nXG4gKiBjb25zdCBkYXRhID0gdG9IZXgoJ0hlbGxvIHdvcmxkJylcbiAqIC8vICcweDQ4NjU2YzZjNmYyMDc3NmY3MjZjNjQyMSdcbiAqXG4gKiBAZXhhbXBsZVxuICogaW1wb3J0IHsgdG9IZXggfSBmcm9tICd2aWVtJ1xuICogY29uc3QgZGF0YSA9IHRvSGV4KDQyMClcbiAqIC8vICcweDFhNCdcbiAqXG4gKiBAZXhhbXBsZVxuICogaW1wb3J0IHsgdG9IZXggfSBmcm9tICd2aWVtJ1xuICogY29uc3QgZGF0YSA9IHRvSGV4KCdIZWxsbyB3b3JsZCcsIHsgc2l6ZTogMzIgfSlcbiAqIC8vICcweDQ4NjU2YzZjNmYyMDc3NmY3MjZjNjQyMTAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAnXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiB0b0hleCh2YWx1ZSwgb3B0cyA9IHt9KSB7XG4gICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ251bWJlcicgfHwgdHlwZW9mIHZhbHVlID09PSAnYmlnaW50JylcbiAgICAgICAgcmV0dXJuIG51bWJlclRvSGV4KHZhbHVlLCBvcHRzKTtcbiAgICBpZiAodHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJykge1xuICAgICAgICByZXR1cm4gc3RyaW5nVG9IZXgodmFsdWUsIG9wdHMpO1xuICAgIH1cbiAgICBpZiAodHlwZW9mIHZhbHVlID09PSAnYm9vbGVhbicpXG4gICAgICAgIHJldHVybiBib29sVG9IZXgodmFsdWUsIG9wdHMpO1xuICAgIHJldHVybiBieXRlc1RvSGV4KHZhbHVlLCBvcHRzKTtcbn1cbi8qKlxuICogRW5jb2RlcyBhIGJvb2xlYW4gaW50byBhIGhleCBzdHJpbmdcbiAqXG4gKiAtIERvY3M6IGh0dHBzOi8vdmllbS5zaC9kb2NzL3V0aWxpdGllcy90b0hleCNib29sdG9oZXhcbiAqXG4gKiBAcGFyYW0gdmFsdWUgVmFsdWUgdG8gZW5jb2RlLlxuICogQHBhcmFtIG9wdHMgT3B0aW9ucy5cbiAqIEByZXR1cm5zIEhleCB2YWx1ZS5cbiAqXG4gKiBAZXhhbXBsZVxuICogaW1wb3J0IHsgYm9vbFRvSGV4IH0gZnJvbSAndmllbSdcbiAqIGNvbnN0IGRhdGEgPSBib29sVG9IZXgodHJ1ZSlcbiAqIC8vICcweDEnXG4gKlxuICogQGV4YW1wbGVcbiAqIGltcG9ydCB7IGJvb2xUb0hleCB9IGZyb20gJ3ZpZW0nXG4gKiBjb25zdCBkYXRhID0gYm9vbFRvSGV4KGZhbHNlKVxuICogLy8gJzB4MCdcbiAqXG4gKiBAZXhhbXBsZVxuICogaW1wb3J0IHsgYm9vbFRvSGV4IH0gZnJvbSAndmllbSdcbiAqIGNvbnN0IGRhdGEgPSBib29sVG9IZXgodHJ1ZSwgeyBzaXplOiAzMiB9KVxuICogLy8gJzB4MDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMSdcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGJvb2xUb0hleCh2YWx1ZSwgb3B0cyA9IHt9KSB7XG4gICAgY29uc3QgaGV4ID0gYDB4JHtOdW1iZXIodmFsdWUpfWA7XG4gICAgaWYgKHR5cGVvZiBvcHRzLnNpemUgPT09ICdudW1iZXInKSB7XG4gICAgICAgIGFzc2VydFNpemUoaGV4LCB7IHNpemU6IG9wdHMuc2l6ZSB9KTtcbiAgICAgICAgcmV0dXJuIHBhZChoZXgsIHsgc2l6ZTogb3B0cy5zaXplIH0pO1xuICAgIH1cbiAgICByZXR1cm4gaGV4O1xufVxuLyoqXG4gKiBFbmNvZGVzIGEgYnl0ZXMgYXJyYXkgaW50byBhIGhleCBzdHJpbmdcbiAqXG4gKiAtIERvY3M6IGh0dHBzOi8vdmllbS5zaC9kb2NzL3V0aWxpdGllcy90b0hleCNieXRlc3RvaGV4XG4gKlxuICogQHBhcmFtIHZhbHVlIFZhbHVlIHRvIGVuY29kZS5cbiAqIEBwYXJhbSBvcHRzIE9wdGlvbnMuXG4gKiBAcmV0dXJucyBIZXggdmFsdWUuXG4gKlxuICogQGV4YW1wbGVcbiAqIGltcG9ydCB7IGJ5dGVzVG9IZXggfSBmcm9tICd2aWVtJ1xuICogY29uc3QgZGF0YSA9IGJ5dGVzVG9IZXgoVWludDhBcnJheS5mcm9tKFs3MiwgMTAxLCAxMDgsIDEwOCwgMTExLCAzMiwgODcsIDExMSwgMTE0LCAxMDgsIDEwMCwgMzNdKVxuICogLy8gJzB4NDg2NTZjNmM2ZjIwNTc2ZjcyNmM2NDIxJ1xuICpcbiAqIEBleGFtcGxlXG4gKiBpbXBvcnQgeyBieXRlc1RvSGV4IH0gZnJvbSAndmllbSdcbiAqIGNvbnN0IGRhdGEgPSBieXRlc1RvSGV4KFVpbnQ4QXJyYXkuZnJvbShbNzIsIDEwMSwgMTA4LCAxMDgsIDExMSwgMzIsIDg3LCAxMTEsIDExNCwgMTA4LCAxMDAsIDMzXSksIHsgc2l6ZTogMzIgfSlcbiAqIC8vICcweDQ4NjU2YzZjNmYyMDU3NmY3MjZjNjQyMTAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAnXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBieXRlc1RvSGV4KHZhbHVlLCBvcHRzID0ge30pIHtcbiAgICBsZXQgc3RyaW5nID0gJyc7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCB2YWx1ZS5sZW5ndGg7IGkrKykge1xuICAgICAgICBzdHJpbmcgKz0gaGV4ZXNbdmFsdWVbaV1dO1xuICAgIH1cbiAgICBjb25zdCBoZXggPSBgMHgke3N0cmluZ31gO1xuICAgIGlmICh0eXBlb2Ygb3B0cy5zaXplID09PSAnbnVtYmVyJykge1xuICAgICAgICBhc3NlcnRTaXplKGhleCwgeyBzaXplOiBvcHRzLnNpemUgfSk7XG4gICAgICAgIHJldHVybiBwYWQoaGV4LCB7IGRpcjogJ3JpZ2h0Jywgc2l6ZTogb3B0cy5zaXplIH0pO1xuICAgIH1cbiAgICByZXR1cm4gaGV4O1xufVxuLyoqXG4gKiBFbmNvZGVzIGEgbnVtYmVyIG9yIGJpZ2ludCBpbnRvIGEgaGV4IHN0cmluZ1xuICpcbiAqIC0gRG9jczogaHR0cHM6Ly92aWVtLnNoL2RvY3MvdXRpbGl0aWVzL3RvSGV4I251bWJlcnRvaGV4XG4gKlxuICogQHBhcmFtIHZhbHVlIFZhbHVlIHRvIGVuY29kZS5cbiAqIEBwYXJhbSBvcHRzIE9wdGlvbnMuXG4gKiBAcmV0dXJucyBIZXggdmFsdWUuXG4gKlxuICogQGV4YW1wbGVcbiAqIGltcG9ydCB7IG51bWJlclRvSGV4IH0gZnJvbSAndmllbSdcbiAqIGNvbnN0IGRhdGEgPSBudW1iZXJUb0hleCg0MjApXG4gKiAvLyAnMHgxYTQnXG4gKlxuICogQGV4YW1wbGVcbiAqIGltcG9ydCB7IG51bWJlclRvSGV4IH0gZnJvbSAndmllbSdcbiAqIGNvbnN0IGRhdGEgPSBudW1iZXJUb0hleCg0MjAsIHsgc2l6ZTogMzIgfSlcbiAqIC8vICcweDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAxYTQnXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBudW1iZXJUb0hleCh2YWx1ZV8sIG9wdHMgPSB7fSkge1xuICAgIGNvbnN0IHsgc2lnbmVkLCBzaXplIH0gPSBvcHRzO1xuICAgIGNvbnN0IHZhbHVlID0gQmlnSW50KHZhbHVlXyk7XG4gICAgbGV0IG1heFZhbHVlO1xuICAgIGlmIChzaXplKSB7XG4gICAgICAgIGlmIChzaWduZWQpXG4gICAgICAgICAgICBtYXhWYWx1ZSA9ICgxbiA8PCAoQmlnSW50KHNpemUpICogOG4gLSAxbikpIC0gMW47XG4gICAgICAgIGVsc2VcbiAgICAgICAgICAgIG1heFZhbHVlID0gMm4gKiogKEJpZ0ludChzaXplKSAqIDhuKSAtIDFuO1xuICAgIH1cbiAgICBlbHNlIGlmICh0eXBlb2YgdmFsdWVfID09PSAnbnVtYmVyJykge1xuICAgICAgICBtYXhWYWx1ZSA9IEJpZ0ludChOdW1iZXIuTUFYX1NBRkVfSU5URUdFUik7XG4gICAgfVxuICAgIGNvbnN0IG1pblZhbHVlID0gdHlwZW9mIG1heFZhbHVlID09PSAnYmlnaW50JyAmJiBzaWduZWQgPyAtbWF4VmFsdWUgLSAxbiA6IDA7XG4gICAgaWYgKChtYXhWYWx1ZSAmJiB2YWx1ZSA+IG1heFZhbHVlKSB8fCB2YWx1ZSA8IG1pblZhbHVlKSB7XG4gICAgICAgIGNvbnN0IHN1ZmZpeCA9IHR5cGVvZiB2YWx1ZV8gPT09ICdiaWdpbnQnID8gJ24nIDogJyc7XG4gICAgICAgIHRocm93IG5ldyBJbnRlZ2VyT3V0T2ZSYW5nZUVycm9yKHtcbiAgICAgICAgICAgIG1heDogbWF4VmFsdWUgPyBgJHttYXhWYWx1ZX0ke3N1ZmZpeH1gIDogdW5kZWZpbmVkLFxuICAgICAgICAgICAgbWluOiBgJHttaW5WYWx1ZX0ke3N1ZmZpeH1gLFxuICAgICAgICAgICAgc2lnbmVkLFxuICAgICAgICAgICAgc2l6ZSxcbiAgICAgICAgICAgIHZhbHVlOiBgJHt2YWx1ZV99JHtzdWZmaXh9YCxcbiAgICAgICAgfSk7XG4gICAgfVxuICAgIGNvbnN0IGhleCA9IGAweCR7KHNpZ25lZCAmJiB2YWx1ZSA8IDAgPyAoMW4gPDwgQmlnSW50KHNpemUgKiA4KSkgKyBCaWdJbnQodmFsdWUpIDogdmFsdWUpLnRvU3RyaW5nKDE2KX1gO1xuICAgIGlmIChzaXplKVxuICAgICAgICByZXR1cm4gcGFkKGhleCwgeyBzaXplIH0pO1xuICAgIHJldHVybiBoZXg7XG59XG5jb25zdCBlbmNvZGVyID0gLyojX19QVVJFX18qLyBuZXcgVGV4dEVuY29kZXIoKTtcbi8qKlxuICogRW5jb2RlcyBhIFVURi04IHN0cmluZyBpbnRvIGEgaGV4IHN0cmluZ1xuICpcbiAqIC0gRG9jczogaHR0cHM6Ly92aWVtLnNoL2RvY3MvdXRpbGl0aWVzL3RvSGV4I3N0cmluZ3RvaGV4XG4gKlxuICogQHBhcmFtIHZhbHVlIFZhbHVlIHRvIGVuY29kZS5cbiAqIEBwYXJhbSBvcHRzIE9wdGlvbnMuXG4gKiBAcmV0dXJucyBIZXggdmFsdWUuXG4gKlxuICogQGV4YW1wbGVcbiAqIGltcG9ydCB7IHN0cmluZ1RvSGV4IH0gZnJvbSAndmllbSdcbiAqIGNvbnN0IGRhdGEgPSBzdHJpbmdUb0hleCgnSGVsbG8gV29ybGQhJylcbiAqIC8vICcweDQ4NjU2YzZjNmYyMDU3NmY3MjZjNjQyMSdcbiAqXG4gKiBAZXhhbXBsZVxuICogaW1wb3J0IHsgc3RyaW5nVG9IZXggfSBmcm9tICd2aWVtJ1xuICogY29uc3QgZGF0YSA9IHN0cmluZ1RvSGV4KCdIZWxsbyBXb3JsZCEnLCB7IHNpemU6IDMyIH0pXG4gKiAvLyAnMHg0ODY1NmM2YzZmMjA1NzZmNzI2YzY0MjEwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwJ1xuICovXG5leHBvcnQgZnVuY3Rpb24gc3RyaW5nVG9IZXgodmFsdWVfLCBvcHRzID0ge30pIHtcbiAgICBjb25zdCB2YWx1ZSA9IGVuY29kZXIuZW5jb2RlKHZhbHVlXyk7XG4gICAgcmV0dXJuIGJ5dGVzVG9IZXgodmFsdWUsIG9wdHMpO1xufVxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9dG9IZXguanMubWFwIiwKICAgICJpbXBvcnQgeyBCYXNlRXJyb3IgfSBmcm9tICcuLi8uLi9lcnJvcnMvYmFzZS5qcyc7XG5pbXBvcnQgeyBpc0hleCB9IGZyb20gJy4uL2RhdGEvaXNIZXguanMnO1xuaW1wb3J0IHsgcGFkIH0gZnJvbSAnLi4vZGF0YS9wYWQuanMnO1xuaW1wb3J0IHsgYXNzZXJ0U2l6ZSB9IGZyb20gJy4vZnJvbUhleC5qcyc7XG5pbXBvcnQgeyBudW1iZXJUb0hleCwgfSBmcm9tICcuL3RvSGV4LmpzJztcbmNvbnN0IGVuY29kZXIgPSAvKiNfX1BVUkVfXyovIG5ldyBUZXh0RW5jb2RlcigpO1xuLyoqXG4gKiBFbmNvZGVzIGEgVVRGLTggc3RyaW5nLCBoZXggdmFsdWUsIGJpZ2ludCwgbnVtYmVyIG9yIGJvb2xlYW4gdG8gYSBieXRlIGFycmF5LlxuICpcbiAqIC0gRG9jczogaHR0cHM6Ly92aWVtLnNoL2RvY3MvdXRpbGl0aWVzL3RvQnl0ZXNcbiAqIC0gRXhhbXBsZTogaHR0cHM6Ly92aWVtLnNoL2RvY3MvdXRpbGl0aWVzL3RvQnl0ZXMjdXNhZ2VcbiAqXG4gKiBAcGFyYW0gdmFsdWUgVmFsdWUgdG8gZW5jb2RlLlxuICogQHBhcmFtIG9wdHMgT3B0aW9ucy5cbiAqIEByZXR1cm5zIEJ5dGUgYXJyYXkgdmFsdWUuXG4gKlxuICogQGV4YW1wbGVcbiAqIGltcG9ydCB7IHRvQnl0ZXMgfSBmcm9tICd2aWVtJ1xuICogY29uc3QgZGF0YSA9IHRvQnl0ZXMoJ0hlbGxvIHdvcmxkJylcbiAqIC8vIFVpbnQ4QXJyYXkoWzcyLCAxMDEsIDEwOCwgMTA4LCAxMTEsIDMyLCA4NywgMTExLCAxMTQsIDEwOCwgMTAwLCAzM10pXG4gKlxuICogQGV4YW1wbGVcbiAqIGltcG9ydCB7IHRvQnl0ZXMgfSBmcm9tICd2aWVtJ1xuICogY29uc3QgZGF0YSA9IHRvQnl0ZXMoNDIwKVxuICogLy8gVWludDhBcnJheShbMSwgMTY0XSlcbiAqXG4gKiBAZXhhbXBsZVxuICogaW1wb3J0IHsgdG9CeXRlcyB9IGZyb20gJ3ZpZW0nXG4gKiBjb25zdCBkYXRhID0gdG9CeXRlcyg0MjAsIHsgc2l6ZTogNCB9KVxuICogLy8gVWludDhBcnJheShbMCwgMCwgMSwgMTY0XSlcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHRvQnl0ZXModmFsdWUsIG9wdHMgPSB7fSkge1xuICAgIGlmICh0eXBlb2YgdmFsdWUgPT09ICdudW1iZXInIHx8IHR5cGVvZiB2YWx1ZSA9PT0gJ2JpZ2ludCcpXG4gICAgICAgIHJldHVybiBudW1iZXJUb0J5dGVzKHZhbHVlLCBvcHRzKTtcbiAgICBpZiAodHlwZW9mIHZhbHVlID09PSAnYm9vbGVhbicpXG4gICAgICAgIHJldHVybiBib29sVG9CeXRlcyh2YWx1ZSwgb3B0cyk7XG4gICAgaWYgKGlzSGV4KHZhbHVlKSlcbiAgICAgICAgcmV0dXJuIGhleFRvQnl0ZXModmFsdWUsIG9wdHMpO1xuICAgIHJldHVybiBzdHJpbmdUb0J5dGVzKHZhbHVlLCBvcHRzKTtcbn1cbi8qKlxuICogRW5jb2RlcyBhIGJvb2xlYW4gaW50byBhIGJ5dGUgYXJyYXkuXG4gKlxuICogLSBEb2NzOiBodHRwczovL3ZpZW0uc2gvZG9jcy91dGlsaXRpZXMvdG9CeXRlcyNib29sdG9ieXRlc1xuICpcbiAqIEBwYXJhbSB2YWx1ZSBCb29sZWFuIHZhbHVlIHRvIGVuY29kZS5cbiAqIEBwYXJhbSBvcHRzIE9wdGlvbnMuXG4gKiBAcmV0dXJucyBCeXRlIGFycmF5IHZhbHVlLlxuICpcbiAqIEBleGFtcGxlXG4gKiBpbXBvcnQgeyBib29sVG9CeXRlcyB9IGZyb20gJ3ZpZW0nXG4gKiBjb25zdCBkYXRhID0gYm9vbFRvQnl0ZXModHJ1ZSlcbiAqIC8vIFVpbnQ4QXJyYXkoWzFdKVxuICpcbiAqIEBleGFtcGxlXG4gKiBpbXBvcnQgeyBib29sVG9CeXRlcyB9IGZyb20gJ3ZpZW0nXG4gKiBjb25zdCBkYXRhID0gYm9vbFRvQnl0ZXModHJ1ZSwgeyBzaXplOiAzMiB9KVxuICogLy8gVWludDhBcnJheShbMCwgMCwgMCwgMCwgMCwgMCwgMCwgMCwgMCwgMCwgMCwgMCwgMCwgMCwgMCwgMCwgMCwgMCwgMCwgMCwgMCwgMCwgMCwgMCwgMCwgMCwgMV0pXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBib29sVG9CeXRlcyh2YWx1ZSwgb3B0cyA9IHt9KSB7XG4gICAgY29uc3QgYnl0ZXMgPSBuZXcgVWludDhBcnJheSgxKTtcbiAgICBieXRlc1swXSA9IE51bWJlcih2YWx1ZSk7XG4gICAgaWYgKHR5cGVvZiBvcHRzLnNpemUgPT09ICdudW1iZXInKSB7XG4gICAgICAgIGFzc2VydFNpemUoYnl0ZXMsIHsgc2l6ZTogb3B0cy5zaXplIH0pO1xuICAgICAgICByZXR1cm4gcGFkKGJ5dGVzLCB7IHNpemU6IG9wdHMuc2l6ZSB9KTtcbiAgICB9XG4gICAgcmV0dXJuIGJ5dGVzO1xufVxuLy8gV2UgdXNlIHZlcnkgb3B0aW1pemVkIHRlY2huaXF1ZSB0byBjb252ZXJ0IGhleCBzdHJpbmcgdG8gYnl0ZSBhcnJheVxuY29uc3QgY2hhckNvZGVNYXAgPSB7XG4gICAgemVybzogNDgsXG4gICAgbmluZTogNTcsXG4gICAgQTogNjUsXG4gICAgRjogNzAsXG4gICAgYTogOTcsXG4gICAgZjogMTAyLFxufTtcbmZ1bmN0aW9uIGNoYXJDb2RlVG9CYXNlMTYoY2hhcikge1xuICAgIGlmIChjaGFyID49IGNoYXJDb2RlTWFwLnplcm8gJiYgY2hhciA8PSBjaGFyQ29kZU1hcC5uaW5lKVxuICAgICAgICByZXR1cm4gY2hhciAtIGNoYXJDb2RlTWFwLnplcm87XG4gICAgaWYgKGNoYXIgPj0gY2hhckNvZGVNYXAuQSAmJiBjaGFyIDw9IGNoYXJDb2RlTWFwLkYpXG4gICAgICAgIHJldHVybiBjaGFyIC0gKGNoYXJDb2RlTWFwLkEgLSAxMCk7XG4gICAgaWYgKGNoYXIgPj0gY2hhckNvZGVNYXAuYSAmJiBjaGFyIDw9IGNoYXJDb2RlTWFwLmYpXG4gICAgICAgIHJldHVybiBjaGFyIC0gKGNoYXJDb2RlTWFwLmEgLSAxMCk7XG4gICAgcmV0dXJuIHVuZGVmaW5lZDtcbn1cbi8qKlxuICogRW5jb2RlcyBhIGhleCBzdHJpbmcgaW50byBhIGJ5dGUgYXJyYXkuXG4gKlxuICogLSBEb2NzOiBodHRwczovL3ZpZW0uc2gvZG9jcy91dGlsaXRpZXMvdG9CeXRlcyNoZXh0b2J5dGVzXG4gKlxuICogQHBhcmFtIGhleCBIZXggc3RyaW5nIHRvIGVuY29kZS5cbiAqIEBwYXJhbSBvcHRzIE9wdGlvbnMuXG4gKiBAcmV0dXJucyBCeXRlIGFycmF5IHZhbHVlLlxuICpcbiAqIEBleGFtcGxlXG4gKiBpbXBvcnQgeyBoZXhUb0J5dGVzIH0gZnJvbSAndmllbSdcbiAqIGNvbnN0IGRhdGEgPSBoZXhUb0J5dGVzKCcweDQ4NjU2YzZjNmYyMDc3NmY3MjZjNjQyMScpXG4gKiAvLyBVaW50OEFycmF5KFs3MiwgMTAxLCAxMDgsIDEwOCwgMTExLCAzMiwgODcsIDExMSwgMTE0LCAxMDgsIDEwMCwgMzNdKVxuICpcbiAqIEBleGFtcGxlXG4gKiBpbXBvcnQgeyBoZXhUb0J5dGVzIH0gZnJvbSAndmllbSdcbiAqIGNvbnN0IGRhdGEgPSBoZXhUb0J5dGVzKCcweDQ4NjU2YzZjNmYyMDc3NmY3MjZjNjQyMScsIHsgc2l6ZTogMzIgfSlcbiAqIC8vIFVpbnQ4QXJyYXkoWzcyLCAxMDEsIDEwOCwgMTA4LCAxMTEsIDMyLCA4NywgMTExLCAxMTQsIDEwOCwgMTAwLCAzMywgMCwgMCwgMCwgMCwgMCwgMCwgMCwgMCwgMCwgMCwgMCwgMCwgMCwgMCwgMCwgMCwgMCwgMCwgMCwgMF0pXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBoZXhUb0J5dGVzKGhleF8sIG9wdHMgPSB7fSkge1xuICAgIGxldCBoZXggPSBoZXhfO1xuICAgIGlmIChvcHRzLnNpemUpIHtcbiAgICAgICAgYXNzZXJ0U2l6ZShoZXgsIHsgc2l6ZTogb3B0cy5zaXplIH0pO1xuICAgICAgICBoZXggPSBwYWQoaGV4LCB7IGRpcjogJ3JpZ2h0Jywgc2l6ZTogb3B0cy5zaXplIH0pO1xuICAgIH1cbiAgICBsZXQgaGV4U3RyaW5nID0gaGV4LnNsaWNlKDIpO1xuICAgIGlmIChoZXhTdHJpbmcubGVuZ3RoICUgMilcbiAgICAgICAgaGV4U3RyaW5nID0gYDAke2hleFN0cmluZ31gO1xuICAgIGNvbnN0IGxlbmd0aCA9IGhleFN0cmluZy5sZW5ndGggLyAyO1xuICAgIGNvbnN0IGJ5dGVzID0gbmV3IFVpbnQ4QXJyYXkobGVuZ3RoKTtcbiAgICBmb3IgKGxldCBpbmRleCA9IDAsIGogPSAwOyBpbmRleCA8IGxlbmd0aDsgaW5kZXgrKykge1xuICAgICAgICBjb25zdCBuaWJibGVMZWZ0ID0gY2hhckNvZGVUb0Jhc2UxNihoZXhTdHJpbmcuY2hhckNvZGVBdChqKyspKTtcbiAgICAgICAgY29uc3QgbmliYmxlUmlnaHQgPSBjaGFyQ29kZVRvQmFzZTE2KGhleFN0cmluZy5jaGFyQ29kZUF0KGorKykpO1xuICAgICAgICBpZiAobmliYmxlTGVmdCA9PT0gdW5kZWZpbmVkIHx8IG5pYmJsZVJpZ2h0ID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBCYXNlRXJyb3IoYEludmFsaWQgYnl0ZSBzZXF1ZW5jZSAoXCIke2hleFN0cmluZ1tqIC0gMl19JHtoZXhTdHJpbmdbaiAtIDFdfVwiIGluIFwiJHtoZXhTdHJpbmd9XCIpLmApO1xuICAgICAgICB9XG4gICAgICAgIGJ5dGVzW2luZGV4XSA9IG5pYmJsZUxlZnQgKiAxNiArIG5pYmJsZVJpZ2h0O1xuICAgIH1cbiAgICByZXR1cm4gYnl0ZXM7XG59XG4vKipcbiAqIEVuY29kZXMgYSBudW1iZXIgaW50byBhIGJ5dGUgYXJyYXkuXG4gKlxuICogLSBEb2NzOiBodHRwczovL3ZpZW0uc2gvZG9jcy91dGlsaXRpZXMvdG9CeXRlcyNudW1iZXJ0b2J5dGVzXG4gKlxuICogQHBhcmFtIHZhbHVlIE51bWJlciB0byBlbmNvZGUuXG4gKiBAcGFyYW0gb3B0cyBPcHRpb25zLlxuICogQHJldHVybnMgQnl0ZSBhcnJheSB2YWx1ZS5cbiAqXG4gKiBAZXhhbXBsZVxuICogaW1wb3J0IHsgbnVtYmVyVG9CeXRlcyB9IGZyb20gJ3ZpZW0nXG4gKiBjb25zdCBkYXRhID0gbnVtYmVyVG9CeXRlcyg0MjApXG4gKiAvLyBVaW50OEFycmF5KFsxLCAxNjRdKVxuICpcbiAqIEBleGFtcGxlXG4gKiBpbXBvcnQgeyBudW1iZXJUb0J5dGVzIH0gZnJvbSAndmllbSdcbiAqIGNvbnN0IGRhdGEgPSBudW1iZXJUb0J5dGVzKDQyMCwgeyBzaXplOiA0IH0pXG4gKiAvLyBVaW50OEFycmF5KFswLCAwLCAxLCAxNjRdKVxuICovXG5leHBvcnQgZnVuY3Rpb24gbnVtYmVyVG9CeXRlcyh2YWx1ZSwgb3B0cykge1xuICAgIGNvbnN0IGhleCA9IG51bWJlclRvSGV4KHZhbHVlLCBvcHRzKTtcbiAgICByZXR1cm4gaGV4VG9CeXRlcyhoZXgpO1xufVxuLyoqXG4gKiBFbmNvZGVzIGEgVVRGLTggc3RyaW5nIGludG8gYSBieXRlIGFycmF5LlxuICpcbiAqIC0gRG9jczogaHR0cHM6Ly92aWVtLnNoL2RvY3MvdXRpbGl0aWVzL3RvQnl0ZXMjc3RyaW5ndG9ieXRlc1xuICpcbiAqIEBwYXJhbSB2YWx1ZSBTdHJpbmcgdG8gZW5jb2RlLlxuICogQHBhcmFtIG9wdHMgT3B0aW9ucy5cbiAqIEByZXR1cm5zIEJ5dGUgYXJyYXkgdmFsdWUuXG4gKlxuICogQGV4YW1wbGVcbiAqIGltcG9ydCB7IHN0cmluZ1RvQnl0ZXMgfSBmcm9tICd2aWVtJ1xuICogY29uc3QgZGF0YSA9IHN0cmluZ1RvQnl0ZXMoJ0hlbGxvIHdvcmxkIScpXG4gKiAvLyBVaW50OEFycmF5KFs3MiwgMTAxLCAxMDgsIDEwOCwgMTExLCAzMiwgMTE5LCAxMTEsIDExNCwgMTA4LCAxMDAsIDMzXSlcbiAqXG4gKiBAZXhhbXBsZVxuICogaW1wb3J0IHsgc3RyaW5nVG9CeXRlcyB9IGZyb20gJ3ZpZW0nXG4gKiBjb25zdCBkYXRhID0gc3RyaW5nVG9CeXRlcygnSGVsbG8gd29ybGQhJywgeyBzaXplOiAzMiB9KVxuICogLy8gVWludDhBcnJheShbNzIsIDEwMSwgMTA4LCAxMDgsIDExMSwgMzIsIDg3LCAxMTEsIDExNCwgMTA4LCAxMDAsIDMzLCAwLCAwLCAwLCAwLCAwLCAwLCAwLCAwLCAwLCAwLCAwLCAwLCAwLCAwLCAwLCAwLCAwLCAwLCAwLCAwXSlcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHN0cmluZ1RvQnl0ZXModmFsdWUsIG9wdHMgPSB7fSkge1xuICAgIGNvbnN0IGJ5dGVzID0gZW5jb2Rlci5lbmNvZGUodmFsdWUpO1xuICAgIGlmICh0eXBlb2Ygb3B0cy5zaXplID09PSAnbnVtYmVyJykge1xuICAgICAgICBhc3NlcnRTaXplKGJ5dGVzLCB7IHNpemU6IG9wdHMuc2l6ZSB9KTtcbiAgICAgICAgcmV0dXJuIHBhZChieXRlcywgeyBkaXI6ICdyaWdodCcsIHNpemU6IG9wdHMuc2l6ZSB9KTtcbiAgICB9XG4gICAgcmV0dXJuIGJ5dGVzO1xufVxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9dG9CeXRlcy5qcy5tYXAiLAogICAgIi8qKlxuICogU0hBMyAoa2VjY2FrKSBoYXNoIGZ1bmN0aW9uLCBiYXNlZCBvbiBhIG5ldyBcIlNwb25nZSBmdW5jdGlvblwiIGRlc2lnbi5cbiAqIERpZmZlcmVudCBmcm9tIG9sZGVyIGhhc2hlcywgdGhlIGludGVybmFsIHN0YXRlIGlzIGJpZ2dlciB0aGFuIG91dHB1dCBzaXplLlxuICpcbiAqIENoZWNrIG91dCBbRklQUy0yMDJdKGh0dHBzOi8vbnZscHVicy5uaXN0Lmdvdi9uaXN0cHVicy9GSVBTL05JU1QuRklQUy4yMDIucGRmKSxcbiAqIFtXZWJzaXRlXShodHRwczovL2tlY2Nhay50ZWFtL2tlY2Nhay5odG1sKSxcbiAqIFt0aGUgZGlmZmVyZW5jZXMgYmV0d2VlbiBTSEEtMyBhbmQgS2VjY2FrXShodHRwczovL2NyeXB0by5zdGFja2V4Y2hhbmdlLmNvbS9xdWVzdGlvbnMvMTU3Mjcvd2hhdC1hcmUtdGhlLWtleS1kaWZmZXJlbmNlcy1iZXR3ZWVuLXRoZS1kcmFmdC1zaGEtMy1zdGFuZGFyZC1hbmQtdGhlLWtlY2Nhay1zdWIpLlxuICpcbiAqIENoZWNrIG91dCBgc2hhMy1hZGRvbnNgIG1vZHVsZSBmb3IgY1NIQUtFLCBrMTIsIGFuZCBvdGhlcnMuXG4gKiBAbW9kdWxlXG4gKi9cbmltcG9ydCB7IHJvdGxCSCwgcm90bEJMLCByb3RsU0gsIHJvdGxTTCwgc3BsaXQgfSBmcm9tIFwiLi9fdTY0LmpzXCI7XG4vLyBwcmV0dGllci1pZ25vcmVcbmltcG9ydCB7IGFieXRlcywgYWV4aXN0cywgYW51bWJlciwgYW91dHB1dCwgY2xlYW4sIGNyZWF0ZUhhc2hlciwgY3JlYXRlWE9GZXIsIEhhc2gsIHN3YXAzMklmQkUsIHRvQnl0ZXMsIHUzMiB9IGZyb20gXCIuL3V0aWxzLmpzXCI7XG4vLyBObyBfX1BVUkVfXyBhbm5vdGF0aW9ucyBpbiBzaGEzIGhlYWRlcjpcbi8vIEVWRVJZVEhJTkcgaXMgaW4gZmFjdCB1c2VkIG9uIGV2ZXJ5IGV4cG9ydC5cbi8vIFZhcmlvdXMgcGVyIHJvdW5kIGNvbnN0YW50cyBjYWxjdWxhdGlvbnNcbmNvbnN0IF8wbiA9IEJpZ0ludCgwKTtcbmNvbnN0IF8xbiA9IEJpZ0ludCgxKTtcbmNvbnN0IF8ybiA9IEJpZ0ludCgyKTtcbmNvbnN0IF83biA9IEJpZ0ludCg3KTtcbmNvbnN0IF8yNTZuID0gQmlnSW50KDI1Nik7XG5jb25zdCBfMHg3MW4gPSBCaWdJbnQoMHg3MSk7XG5jb25zdCBTSEEzX1BJID0gW107XG5jb25zdCBTSEEzX1JPVEwgPSBbXTtcbmNvbnN0IF9TSEEzX0lPVEEgPSBbXTtcbmZvciAobGV0IHJvdW5kID0gMCwgUiA9IF8xbiwgeCA9IDEsIHkgPSAwOyByb3VuZCA8IDI0OyByb3VuZCsrKSB7XG4gICAgLy8gUGlcbiAgICBbeCwgeV0gPSBbeSwgKDIgKiB4ICsgMyAqIHkpICUgNV07XG4gICAgU0hBM19QSS5wdXNoKDIgKiAoNSAqIHkgKyB4KSk7XG4gICAgLy8gUm90YXRpb25hbFxuICAgIFNIQTNfUk9UTC5wdXNoKCgoKHJvdW5kICsgMSkgKiAocm91bmQgKyAyKSkgLyAyKSAlIDY0KTtcbiAgICAvLyBJb3RhXG4gICAgbGV0IHQgPSBfMG47XG4gICAgZm9yIChsZXQgaiA9IDA7IGogPCA3OyBqKyspIHtcbiAgICAgICAgUiA9ICgoUiA8PCBfMW4pIF4gKChSID4+IF83bikgKiBfMHg3MW4pKSAlIF8yNTZuO1xuICAgICAgICBpZiAoUiAmIF8ybilcbiAgICAgICAgICAgIHQgXj0gXzFuIDw8ICgoXzFuIDw8IC8qIEBfX1BVUkVfXyAqLyBCaWdJbnQoaikpIC0gXzFuKTtcbiAgICB9XG4gICAgX1NIQTNfSU9UQS5wdXNoKHQpO1xufVxuY29uc3QgSU9UQVMgPSBzcGxpdChfU0hBM19JT1RBLCB0cnVlKTtcbmNvbnN0IFNIQTNfSU9UQV9IID0gSU9UQVNbMF07XG5jb25zdCBTSEEzX0lPVEFfTCA9IElPVEFTWzFdO1xuLy8gTGVmdCByb3RhdGlvbiAod2l0aG91dCAwLCAzMiwgNjQpXG5jb25zdCByb3RsSCA9IChoLCBsLCBzKSA9PiAocyA+IDMyID8gcm90bEJIKGgsIGwsIHMpIDogcm90bFNIKGgsIGwsIHMpKTtcbmNvbnN0IHJvdGxMID0gKGgsIGwsIHMpID0+IChzID4gMzIgPyByb3RsQkwoaCwgbCwgcykgOiByb3RsU0woaCwgbCwgcykpO1xuLyoqIGBrZWNjYWtmMTYwMGAgaW50ZXJuYWwgZnVuY3Rpb24sIGFkZGl0aW9uYWxseSBhbGxvd3MgdG8gYWRqdXN0IHJvdW5kIGNvdW50LiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGtlY2Nha1Aocywgcm91bmRzID0gMjQpIHtcbiAgICBjb25zdCBCID0gbmV3IFVpbnQzMkFycmF5KDUgKiAyKTtcbiAgICAvLyBOT1RFOiBhbGwgaW5kaWNlcyBhcmUgeDIgc2luY2Ugd2Ugc3RvcmUgc3RhdGUgYXMgdTMyIGluc3RlYWQgb2YgdTY0IChiaWdpbnRzIHRvIHNsb3cgaW4ganMpXG4gICAgZm9yIChsZXQgcm91bmQgPSAyNCAtIHJvdW5kczsgcm91bmQgPCAyNDsgcm91bmQrKykge1xuICAgICAgICAvLyBUaGV0YSDOuFxuICAgICAgICBmb3IgKGxldCB4ID0gMDsgeCA8IDEwOyB4KyspXG4gICAgICAgICAgICBCW3hdID0gc1t4XSBeIHNbeCArIDEwXSBeIHNbeCArIDIwXSBeIHNbeCArIDMwXSBeIHNbeCArIDQwXTtcbiAgICAgICAgZm9yIChsZXQgeCA9IDA7IHggPCAxMDsgeCArPSAyKSB7XG4gICAgICAgICAgICBjb25zdCBpZHgxID0gKHggKyA4KSAlIDEwO1xuICAgICAgICAgICAgY29uc3QgaWR4MCA9ICh4ICsgMikgJSAxMDtcbiAgICAgICAgICAgIGNvbnN0IEIwID0gQltpZHgwXTtcbiAgICAgICAgICAgIGNvbnN0IEIxID0gQltpZHgwICsgMV07XG4gICAgICAgICAgICBjb25zdCBUaCA9IHJvdGxIKEIwLCBCMSwgMSkgXiBCW2lkeDFdO1xuICAgICAgICAgICAgY29uc3QgVGwgPSByb3RsTChCMCwgQjEsIDEpIF4gQltpZHgxICsgMV07XG4gICAgICAgICAgICBmb3IgKGxldCB5ID0gMDsgeSA8IDUwOyB5ICs9IDEwKSB7XG4gICAgICAgICAgICAgICAgc1t4ICsgeV0gXj0gVGg7XG4gICAgICAgICAgICAgICAgc1t4ICsgeSArIDFdIF49IFRsO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIC8vIFJobyAoz4EpIGFuZCBQaSAoz4ApXG4gICAgICAgIGxldCBjdXJIID0gc1syXTtcbiAgICAgICAgbGV0IGN1ckwgPSBzWzNdO1xuICAgICAgICBmb3IgKGxldCB0ID0gMDsgdCA8IDI0OyB0KyspIHtcbiAgICAgICAgICAgIGNvbnN0IHNoaWZ0ID0gU0hBM19ST1RMW3RdO1xuICAgICAgICAgICAgY29uc3QgVGggPSByb3RsSChjdXJILCBjdXJMLCBzaGlmdCk7XG4gICAgICAgICAgICBjb25zdCBUbCA9IHJvdGxMKGN1ckgsIGN1ckwsIHNoaWZ0KTtcbiAgICAgICAgICAgIGNvbnN0IFBJID0gU0hBM19QSVt0XTtcbiAgICAgICAgICAgIGN1ckggPSBzW1BJXTtcbiAgICAgICAgICAgIGN1ckwgPSBzW1BJICsgMV07XG4gICAgICAgICAgICBzW1BJXSA9IFRoO1xuICAgICAgICAgICAgc1tQSSArIDFdID0gVGw7XG4gICAgICAgIH1cbiAgICAgICAgLy8gQ2hpICjPhylcbiAgICAgICAgZm9yIChsZXQgeSA9IDA7IHkgPCA1MDsgeSArPSAxMCkge1xuICAgICAgICAgICAgZm9yIChsZXQgeCA9IDA7IHggPCAxMDsgeCsrKVxuICAgICAgICAgICAgICAgIEJbeF0gPSBzW3kgKyB4XTtcbiAgICAgICAgICAgIGZvciAobGV0IHggPSAwOyB4IDwgMTA7IHgrKylcbiAgICAgICAgICAgICAgICBzW3kgKyB4XSBePSB+QlsoeCArIDIpICUgMTBdICYgQlsoeCArIDQpICUgMTBdO1xuICAgICAgICB9XG4gICAgICAgIC8vIElvdGEgKM65KVxuICAgICAgICBzWzBdIF49IFNIQTNfSU9UQV9IW3JvdW5kXTtcbiAgICAgICAgc1sxXSBePSBTSEEzX0lPVEFfTFtyb3VuZF07XG4gICAgfVxuICAgIGNsZWFuKEIpO1xufVxuLyoqIEtlY2NhayBzcG9uZ2UgZnVuY3Rpb24uICovXG5leHBvcnQgY2xhc3MgS2VjY2FrIGV4dGVuZHMgSGFzaCB7XG4gICAgLy8gTk9URTogd2UgYWNjZXB0IGFyZ3VtZW50cyBpbiBieXRlcyBpbnN0ZWFkIG9mIGJpdHMgaGVyZS5cbiAgICBjb25zdHJ1Y3RvcihibG9ja0xlbiwgc3VmZml4LCBvdXRwdXRMZW4sIGVuYWJsZVhPRiA9IGZhbHNlLCByb3VuZHMgPSAyNCkge1xuICAgICAgICBzdXBlcigpO1xuICAgICAgICB0aGlzLnBvcyA9IDA7XG4gICAgICAgIHRoaXMucG9zT3V0ID0gMDtcbiAgICAgICAgdGhpcy5maW5pc2hlZCA9IGZhbHNlO1xuICAgICAgICB0aGlzLmRlc3Ryb3llZCA9IGZhbHNlO1xuICAgICAgICB0aGlzLmVuYWJsZVhPRiA9IGZhbHNlO1xuICAgICAgICB0aGlzLmJsb2NrTGVuID0gYmxvY2tMZW47XG4gICAgICAgIHRoaXMuc3VmZml4ID0gc3VmZml4O1xuICAgICAgICB0aGlzLm91dHB1dExlbiA9IG91dHB1dExlbjtcbiAgICAgICAgdGhpcy5lbmFibGVYT0YgPSBlbmFibGVYT0Y7XG4gICAgICAgIHRoaXMucm91bmRzID0gcm91bmRzO1xuICAgICAgICAvLyBDYW4gYmUgcGFzc2VkIGZyb20gdXNlciBhcyBka0xlblxuICAgICAgICBhbnVtYmVyKG91dHB1dExlbik7XG4gICAgICAgIC8vIDE2MDAgPSA1eDUgbWF0cml4IG9mIDY0Yml0LiAgMTYwMCBiaXRzID09PSAyMDAgYnl0ZXNcbiAgICAgICAgLy8gMCA8IGJsb2NrTGVuIDwgMjAwXG4gICAgICAgIGlmICghKDAgPCBibG9ja0xlbiAmJiBibG9ja0xlbiA8IDIwMCkpXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ29ubHkga2VjY2FrLWYxNjAwIGZ1bmN0aW9uIGlzIHN1cHBvcnRlZCcpO1xuICAgICAgICB0aGlzLnN0YXRlID0gbmV3IFVpbnQ4QXJyYXkoMjAwKTtcbiAgICAgICAgdGhpcy5zdGF0ZTMyID0gdTMyKHRoaXMuc3RhdGUpO1xuICAgIH1cbiAgICBjbG9uZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2Nsb25lSW50bygpO1xuICAgIH1cbiAgICBrZWNjYWsoKSB7XG4gICAgICAgIHN3YXAzMklmQkUodGhpcy5zdGF0ZTMyKTtcbiAgICAgICAga2VjY2FrUCh0aGlzLnN0YXRlMzIsIHRoaXMucm91bmRzKTtcbiAgICAgICAgc3dhcDMySWZCRSh0aGlzLnN0YXRlMzIpO1xuICAgICAgICB0aGlzLnBvc091dCA9IDA7XG4gICAgICAgIHRoaXMucG9zID0gMDtcbiAgICB9XG4gICAgdXBkYXRlKGRhdGEpIHtcbiAgICAgICAgYWV4aXN0cyh0aGlzKTtcbiAgICAgICAgZGF0YSA9IHRvQnl0ZXMoZGF0YSk7XG4gICAgICAgIGFieXRlcyhkYXRhKTtcbiAgICAgICAgY29uc3QgeyBibG9ja0xlbiwgc3RhdGUgfSA9IHRoaXM7XG4gICAgICAgIGNvbnN0IGxlbiA9IGRhdGEubGVuZ3RoO1xuICAgICAgICBmb3IgKGxldCBwb3MgPSAwOyBwb3MgPCBsZW47KSB7XG4gICAgICAgICAgICBjb25zdCB0YWtlID0gTWF0aC5taW4oYmxvY2tMZW4gLSB0aGlzLnBvcywgbGVuIC0gcG9zKTtcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGFrZTsgaSsrKVxuICAgICAgICAgICAgICAgIHN0YXRlW3RoaXMucG9zKytdIF49IGRhdGFbcG9zKytdO1xuICAgICAgICAgICAgaWYgKHRoaXMucG9zID09PSBibG9ja0xlbilcbiAgICAgICAgICAgICAgICB0aGlzLmtlY2NhaygpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cbiAgICBmaW5pc2goKSB7XG4gICAgICAgIGlmICh0aGlzLmZpbmlzaGVkKVxuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB0aGlzLmZpbmlzaGVkID0gdHJ1ZTtcbiAgICAgICAgY29uc3QgeyBzdGF0ZSwgc3VmZml4LCBwb3MsIGJsb2NrTGVuIH0gPSB0aGlzO1xuICAgICAgICAvLyBEbyB0aGUgcGFkZGluZ1xuICAgICAgICBzdGF0ZVtwb3NdIF49IHN1ZmZpeDtcbiAgICAgICAgaWYgKChzdWZmaXggJiAweDgwKSAhPT0gMCAmJiBwb3MgPT09IGJsb2NrTGVuIC0gMSlcbiAgICAgICAgICAgIHRoaXMua2VjY2FrKCk7XG4gICAgICAgIHN0YXRlW2Jsb2NrTGVuIC0gMV0gXj0gMHg4MDtcbiAgICAgICAgdGhpcy5rZWNjYWsoKTtcbiAgICB9XG4gICAgd3JpdGVJbnRvKG91dCkge1xuICAgICAgICBhZXhpc3RzKHRoaXMsIGZhbHNlKTtcbiAgICAgICAgYWJ5dGVzKG91dCk7XG4gICAgICAgIHRoaXMuZmluaXNoKCk7XG4gICAgICAgIGNvbnN0IGJ1ZmZlck91dCA9IHRoaXMuc3RhdGU7XG4gICAgICAgIGNvbnN0IHsgYmxvY2tMZW4gfSA9IHRoaXM7XG4gICAgICAgIGZvciAobGV0IHBvcyA9IDAsIGxlbiA9IG91dC5sZW5ndGg7IHBvcyA8IGxlbjspIHtcbiAgICAgICAgICAgIGlmICh0aGlzLnBvc091dCA+PSBibG9ja0xlbilcbiAgICAgICAgICAgICAgICB0aGlzLmtlY2NhaygpO1xuICAgICAgICAgICAgY29uc3QgdGFrZSA9IE1hdGgubWluKGJsb2NrTGVuIC0gdGhpcy5wb3NPdXQsIGxlbiAtIHBvcyk7XG4gICAgICAgICAgICBvdXQuc2V0KGJ1ZmZlck91dC5zdWJhcnJheSh0aGlzLnBvc091dCwgdGhpcy5wb3NPdXQgKyB0YWtlKSwgcG9zKTtcbiAgICAgICAgICAgIHRoaXMucG9zT3V0ICs9IHRha2U7XG4gICAgICAgICAgICBwb3MgKz0gdGFrZTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gb3V0O1xuICAgIH1cbiAgICB4b2ZJbnRvKG91dCkge1xuICAgICAgICAvLyBTaGEzL0tlY2NhayB1c2FnZSB3aXRoIFhPRiBpcyBwcm9iYWJseSBtaXN0YWtlLCBvbmx5IFNIQUtFIGluc3RhbmNlcyBjYW4gZG8gWE9GXG4gICAgICAgIGlmICghdGhpcy5lbmFibGVYT0YpXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1hPRiBpcyBub3QgcG9zc2libGUgZm9yIHRoaXMgaW5zdGFuY2UnKTtcbiAgICAgICAgcmV0dXJuIHRoaXMud3JpdGVJbnRvKG91dCk7XG4gICAgfVxuICAgIHhvZihieXRlcykge1xuICAgICAgICBhbnVtYmVyKGJ5dGVzKTtcbiAgICAgICAgcmV0dXJuIHRoaXMueG9mSW50byhuZXcgVWludDhBcnJheShieXRlcykpO1xuICAgIH1cbiAgICBkaWdlc3RJbnRvKG91dCkge1xuICAgICAgICBhb3V0cHV0KG91dCwgdGhpcyk7XG4gICAgICAgIGlmICh0aGlzLmZpbmlzaGVkKVxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdkaWdlc3QoKSB3YXMgYWxyZWFkeSBjYWxsZWQnKTtcbiAgICAgICAgdGhpcy53cml0ZUludG8ob3V0KTtcbiAgICAgICAgdGhpcy5kZXN0cm95KCk7XG4gICAgICAgIHJldHVybiBvdXQ7XG4gICAgfVxuICAgIGRpZ2VzdCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuZGlnZXN0SW50byhuZXcgVWludDhBcnJheSh0aGlzLm91dHB1dExlbikpO1xuICAgIH1cbiAgICBkZXN0cm95KCkge1xuICAgICAgICB0aGlzLmRlc3Ryb3llZCA9IHRydWU7XG4gICAgICAgIGNsZWFuKHRoaXMuc3RhdGUpO1xuICAgIH1cbiAgICBfY2xvbmVJbnRvKHRvKSB7XG4gICAgICAgIGNvbnN0IHsgYmxvY2tMZW4sIHN1ZmZpeCwgb3V0cHV0TGVuLCByb3VuZHMsIGVuYWJsZVhPRiB9ID0gdGhpcztcbiAgICAgICAgdG8gfHwgKHRvID0gbmV3IEtlY2NhayhibG9ja0xlbiwgc3VmZml4LCBvdXRwdXRMZW4sIGVuYWJsZVhPRiwgcm91bmRzKSk7XG4gICAgICAgIHRvLnN0YXRlMzIuc2V0KHRoaXMuc3RhdGUzMik7XG4gICAgICAgIHRvLnBvcyA9IHRoaXMucG9zO1xuICAgICAgICB0by5wb3NPdXQgPSB0aGlzLnBvc091dDtcbiAgICAgICAgdG8uZmluaXNoZWQgPSB0aGlzLmZpbmlzaGVkO1xuICAgICAgICB0by5yb3VuZHMgPSByb3VuZHM7XG4gICAgICAgIC8vIFN1ZmZpeCBjYW4gY2hhbmdlIGluIGNTSEFLRVxuICAgICAgICB0by5zdWZmaXggPSBzdWZmaXg7XG4gICAgICAgIHRvLm91dHB1dExlbiA9IG91dHB1dExlbjtcbiAgICAgICAgdG8uZW5hYmxlWE9GID0gZW5hYmxlWE9GO1xuICAgICAgICB0by5kZXN0cm95ZWQgPSB0aGlzLmRlc3Ryb3llZDtcbiAgICAgICAgcmV0dXJuIHRvO1xuICAgIH1cbn1cbmNvbnN0IGdlbiA9IChzdWZmaXgsIGJsb2NrTGVuLCBvdXRwdXRMZW4pID0+IGNyZWF0ZUhhc2hlcigoKSA9PiBuZXcgS2VjY2FrKGJsb2NrTGVuLCBzdWZmaXgsIG91dHB1dExlbikpO1xuLyoqIFNIQTMtMjI0IGhhc2ggZnVuY3Rpb24uICovXG5leHBvcnQgY29uc3Qgc2hhM18yMjQgPSAvKiBAX19QVVJFX18gKi8gKCgpID0+IGdlbigweDA2LCAxNDQsIDIyNCAvIDgpKSgpO1xuLyoqIFNIQTMtMjU2IGhhc2ggZnVuY3Rpb24uIERpZmZlcmVudCBmcm9tIGtlY2Nhay0yNTYuICovXG5leHBvcnQgY29uc3Qgc2hhM18yNTYgPSAvKiBAX19QVVJFX18gKi8gKCgpID0+IGdlbigweDA2LCAxMzYsIDI1NiAvIDgpKSgpO1xuLyoqIFNIQTMtMzg0IGhhc2ggZnVuY3Rpb24uICovXG5leHBvcnQgY29uc3Qgc2hhM18zODQgPSAvKiBAX19QVVJFX18gKi8gKCgpID0+IGdlbigweDA2LCAxMDQsIDM4NCAvIDgpKSgpO1xuLyoqIFNIQTMtNTEyIGhhc2ggZnVuY3Rpb24uICovXG5leHBvcnQgY29uc3Qgc2hhM181MTIgPSAvKiBAX19QVVJFX18gKi8gKCgpID0+IGdlbigweDA2LCA3MiwgNTEyIC8gOCkpKCk7XG4vKioga2VjY2FrLTIyNCBoYXNoIGZ1bmN0aW9uLiAqL1xuZXhwb3J0IGNvbnN0IGtlY2Nha18yMjQgPSAvKiBAX19QVVJFX18gKi8gKCgpID0+IGdlbigweDAxLCAxNDQsIDIyNCAvIDgpKSgpO1xuLyoqIGtlY2Nhay0yNTYgaGFzaCBmdW5jdGlvbi4gRGlmZmVyZW50IGZyb20gU0hBMy0yNTYuICovXG5leHBvcnQgY29uc3Qga2VjY2FrXzI1NiA9IC8qIEBfX1BVUkVfXyAqLyAoKCkgPT4gZ2VuKDB4MDEsIDEzNiwgMjU2IC8gOCkpKCk7XG4vKioga2VjY2FrLTM4NCBoYXNoIGZ1bmN0aW9uLiAqL1xuZXhwb3J0IGNvbnN0IGtlY2Nha18zODQgPSAvKiBAX19QVVJFX18gKi8gKCgpID0+IGdlbigweDAxLCAxMDQsIDM4NCAvIDgpKSgpO1xuLyoqIGtlY2Nhay01MTIgaGFzaCBmdW5jdGlvbi4gKi9cbmV4cG9ydCBjb25zdCBrZWNjYWtfNTEyID0gLyogQF9fUFVSRV9fICovICgoKSA9PiBnZW4oMHgwMSwgNzIsIDUxMiAvIDgpKSgpO1xuY29uc3QgZ2VuU2hha2UgPSAoc3VmZml4LCBibG9ja0xlbiwgb3V0cHV0TGVuKSA9PiBjcmVhdGVYT0Zlcigob3B0cyA9IHt9KSA9PiBuZXcgS2VjY2FrKGJsb2NrTGVuLCBzdWZmaXgsIG9wdHMuZGtMZW4gPT09IHVuZGVmaW5lZCA/IG91dHB1dExlbiA6IG9wdHMuZGtMZW4sIHRydWUpKTtcbi8qKiBTSEFLRTEyOCBYT0Ygd2l0aCAxMjgtYml0IHNlY3VyaXR5LiAqL1xuZXhwb3J0IGNvbnN0IHNoYWtlMTI4ID0gLyogQF9fUFVSRV9fICovICgoKSA9PiBnZW5TaGFrZSgweDFmLCAxNjgsIDEyOCAvIDgpKSgpO1xuLyoqIFNIQUtFMjU2IFhPRiB3aXRoIDI1Ni1iaXQgc2VjdXJpdHkuICovXG5leHBvcnQgY29uc3Qgc2hha2UyNTYgPSAvKiBAX19QVVJFX18gKi8gKCgpID0+IGdlblNoYWtlKDB4MWYsIDEzNiwgMjU2IC8gOCkpKCk7XG4vLyMgc291cmNlTWFwcGluZ1VSTD1zaGEzLmpzLm1hcCIsCiAgICAiaW1wb3J0IHsga2VjY2FrXzI1NiB9IGZyb20gJ0Bub2JsZS9oYXNoZXMvc2hhMyc7XG5pbXBvcnQgeyBpc0hleCB9IGZyb20gJy4uL2RhdGEvaXNIZXguanMnO1xuaW1wb3J0IHsgdG9CeXRlcyB9IGZyb20gJy4uL2VuY29kaW5nL3RvQnl0ZXMuanMnO1xuaW1wb3J0IHsgdG9IZXggfSBmcm9tICcuLi9lbmNvZGluZy90b0hleC5qcyc7XG5leHBvcnQgZnVuY3Rpb24ga2VjY2FrMjU2KHZhbHVlLCB0b18pIHtcbiAgICBjb25zdCB0byA9IHRvXyB8fCAnaGV4JztcbiAgICBjb25zdCBieXRlcyA9IGtlY2Nha18yNTYoaXNIZXgodmFsdWUsIHsgc3RyaWN0OiBmYWxzZSB9KSA/IHRvQnl0ZXModmFsdWUpIDogdmFsdWUpO1xuICAgIGlmICh0byA9PT0gJ2J5dGVzJylcbiAgICAgICAgcmV0dXJuIGJ5dGVzO1xuICAgIHJldHVybiB0b0hleChieXRlcyk7XG59XG4vLyMgc291cmNlTWFwcGluZ1VSTD1rZWNjYWsyNTYuanMubWFwIiwKICAgICJpbXBvcnQgeyB0b0J5dGVzIH0gZnJvbSAnLi4vZW5jb2RpbmcvdG9CeXRlcy5qcyc7XG5pbXBvcnQgeyBrZWNjYWsyNTYgfSBmcm9tICcuL2tlY2NhazI1Ni5qcyc7XG5jb25zdCBoYXNoID0gKHZhbHVlKSA9PiBrZWNjYWsyNTYodG9CeXRlcyh2YWx1ZSkpO1xuZXhwb3J0IGZ1bmN0aW9uIGhhc2hTaWduYXR1cmUoc2lnKSB7XG4gICAgcmV0dXJuIGhhc2goc2lnKTtcbn1cbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWhhc2hTaWduYXR1cmUuanMubWFwIiwKICAgICJpbXBvcnQgeyBCYXNlRXJyb3IgfSBmcm9tICcuLi8uLi9lcnJvcnMvYmFzZS5qcyc7XG5leHBvcnQgZnVuY3Rpb24gbm9ybWFsaXplU2lnbmF0dXJlKHNpZ25hdHVyZSkge1xuICAgIGxldCBhY3RpdmUgPSB0cnVlO1xuICAgIGxldCBjdXJyZW50ID0gJyc7XG4gICAgbGV0IGxldmVsID0gMDtcbiAgICBsZXQgcmVzdWx0ID0gJyc7XG4gICAgbGV0IHZhbGlkID0gZmFsc2U7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBzaWduYXR1cmUubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgY29uc3QgY2hhciA9IHNpZ25hdHVyZVtpXTtcbiAgICAgICAgLy8gSWYgdGhlIGNoYXJhY3RlciBpcyBhIHNlcGFyYXRvciwgd2Ugd2FudCB0byByZWFjdGl2YXRlLlxuICAgICAgICBpZiAoWycoJywgJyknLCAnLCddLmluY2x1ZGVzKGNoYXIpKVxuICAgICAgICAgICAgYWN0aXZlID0gdHJ1ZTtcbiAgICAgICAgLy8gSWYgdGhlIGNoYXJhY3RlciBpcyBhIFwibGV2ZWxcIiB0b2tlbiwgd2Ugd2FudCB0byBpbmNyZW1lbnQvZGVjcmVtZW50LlxuICAgICAgICBpZiAoY2hhciA9PT0gJygnKVxuICAgICAgICAgICAgbGV2ZWwrKztcbiAgICAgICAgaWYgKGNoYXIgPT09ICcpJylcbiAgICAgICAgICAgIGxldmVsLS07XG4gICAgICAgIC8vIElmIHdlIGFyZW4ndCBhY3RpdmUsIHdlIGRvbid0IHdhbnQgdG8gbXV0YXRlIHRoZSByZXN1bHQuXG4gICAgICAgIGlmICghYWN0aXZlKVxuICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgIC8vIElmIGxldmVsID09PSAwLCB3ZSBhcmUgYXQgdGhlIGRlZmluaXRpb24gbGV2ZWwuXG4gICAgICAgIGlmIChsZXZlbCA9PT0gMCkge1xuICAgICAgICAgICAgaWYgKGNoYXIgPT09ICcgJyAmJiBbJ2V2ZW50JywgJ2Z1bmN0aW9uJywgJyddLmluY2x1ZGVzKHJlc3VsdCkpXG4gICAgICAgICAgICAgICAgcmVzdWx0ID0gJyc7XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICByZXN1bHQgKz0gY2hhcjtcbiAgICAgICAgICAgICAgICAvLyBJZiB3ZSBhcmUgYXQgdGhlIGVuZCBvZiB0aGUgZGVmaW5pdGlvbiwgd2UgbXVzdCBiZSBmaW5pc2hlZC5cbiAgICAgICAgICAgICAgICBpZiAoY2hhciA9PT0gJyknKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhbGlkID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgICAgLy8gSWdub3JlIHNwYWNlc1xuICAgICAgICBpZiAoY2hhciA9PT0gJyAnKSB7XG4gICAgICAgICAgICAvLyBJZiB0aGUgcHJldmlvdXMgY2hhcmFjdGVyIGlzIGEgc2VwYXJhdG9yLCBhbmQgdGhlIGN1cnJlbnQgc2VjdGlvbiBpc24ndCBlbXB0eSwgd2Ugd2FudCB0byBkZWFjdGl2YXRlLlxuICAgICAgICAgICAgaWYgKHNpZ25hdHVyZVtpIC0gMV0gIT09ICcsJyAmJiBjdXJyZW50ICE9PSAnLCcgJiYgY3VycmVudCAhPT0gJywoJykge1xuICAgICAgICAgICAgICAgIGN1cnJlbnQgPSAnJztcbiAgICAgICAgICAgICAgICBhY3RpdmUgPSBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG4gICAgICAgIHJlc3VsdCArPSBjaGFyO1xuICAgICAgICBjdXJyZW50ICs9IGNoYXI7XG4gICAgfVxuICAgIGlmICghdmFsaWQpXG4gICAgICAgIHRocm93IG5ldyBCYXNlRXJyb3IoJ1VuYWJsZSB0byBub3JtYWxpemUgc2lnbmF0dXJlLicpO1xuICAgIHJldHVybiByZXN1bHQ7XG59XG4vLyMgc291cmNlTWFwcGluZ1VSTD1ub3JtYWxpemVTaWduYXR1cmUuanMubWFwIiwKICAgICJpbXBvcnQgeyBmb3JtYXRBYmlJdGVtIH0gZnJvbSAnYWJpdHlwZSc7XG5pbXBvcnQgeyBub3JtYWxpemVTaWduYXR1cmUsIH0gZnJvbSAnLi9ub3JtYWxpemVTaWduYXR1cmUuanMnO1xuLyoqXG4gKiBSZXR1cm5zIHRoZSBzaWduYXR1cmUgZm9yIGEgZ2l2ZW4gZnVuY3Rpb24gb3IgZXZlbnQgZGVmaW5pdGlvbi5cbiAqXG4gKiBAZXhhbXBsZVxuICogY29uc3Qgc2lnbmF0dXJlID0gdG9TaWduYXR1cmUoJ2Z1bmN0aW9uIG93bmVyT2YodWludDI1NiB0b2tlbklkKScpXG4gKiAvLyAnb3duZXJPZih1aW50MjU2KSdcbiAqXG4gKiBAZXhhbXBsZVxuICogY29uc3Qgc2lnbmF0dXJlXzMgPSB0b1NpZ25hdHVyZSh7XG4gKiAgIG5hbWU6ICdvd25lck9mJyxcbiAqICAgdHlwZTogJ2Z1bmN0aW9uJyxcbiAqICAgaW5wdXRzOiBbeyBuYW1lOiAndG9rZW5JZCcsIHR5cGU6ICd1aW50MjU2JyB9XSxcbiAqICAgb3V0cHV0czogW10sXG4gKiAgIHN0YXRlTXV0YWJpbGl0eTogJ3ZpZXcnLFxuICogfSlcbiAqIC8vICdvd25lck9mKHVpbnQyNTYpJ1xuICovXG5leHBvcnQgY29uc3QgdG9TaWduYXR1cmUgPSAoZGVmKSA9PiB7XG4gICAgY29uc3QgZGVmXyA9ICgoKSA9PiB7XG4gICAgICAgIGlmICh0eXBlb2YgZGVmID09PSAnc3RyaW5nJylcbiAgICAgICAgICAgIHJldHVybiBkZWY7XG4gICAgICAgIHJldHVybiBmb3JtYXRBYmlJdGVtKGRlZik7XG4gICAgfSkoKTtcbiAgICByZXR1cm4gbm9ybWFsaXplU2lnbmF0dXJlKGRlZl8pO1xufTtcbi8vIyBzb3VyY2VNYXBwaW5nVVJMPXRvU2lnbmF0dXJlLmpzLm1hcCIsCiAgICAiaW1wb3J0IHsgaGFzaFNpZ25hdHVyZSB9IGZyb20gJy4vaGFzaFNpZ25hdHVyZS5qcyc7XG5pbXBvcnQgeyB0b1NpZ25hdHVyZSB9IGZyb20gJy4vdG9TaWduYXR1cmUuanMnO1xuLyoqXG4gKiBSZXR1cm5zIHRoZSBoYXNoIChvZiB0aGUgZnVuY3Rpb24vZXZlbnQgc2lnbmF0dXJlKSBmb3IgYSBnaXZlbiBldmVudCBvciBmdW5jdGlvbiBkZWZpbml0aW9uLlxuICovXG5leHBvcnQgZnVuY3Rpb24gdG9TaWduYXR1cmVIYXNoKGZuKSB7XG4gICAgcmV0dXJuIGhhc2hTaWduYXR1cmUodG9TaWduYXR1cmUoZm4pKTtcbn1cbi8vIyBzb3VyY2VNYXBwaW5nVVJMPXRvU2lnbmF0dXJlSGFzaC5qcy5tYXAiLAogICAgImltcG9ydCB7IHNsaWNlIH0gZnJvbSAnLi4vZGF0YS9zbGljZS5qcyc7XG5pbXBvcnQgeyB0b1NpZ25hdHVyZUhhc2gsIH0gZnJvbSAnLi90b1NpZ25hdHVyZUhhc2guanMnO1xuLyoqXG4gKiBSZXR1cm5zIHRoZSBmdW5jdGlvbiBzZWxlY3RvciBmb3IgYSBnaXZlbiBmdW5jdGlvbiBkZWZpbml0aW9uLlxuICpcbiAqIEBleGFtcGxlXG4gKiBjb25zdCBzZWxlY3RvciA9IHRvRnVuY3Rpb25TZWxlY3RvcignZnVuY3Rpb24gb3duZXJPZih1aW50MjU2IHRva2VuSWQpJylcbiAqIC8vIDB4NjM1MjIxMWVcbiAqL1xuZXhwb3J0IGNvbnN0IHRvRnVuY3Rpb25TZWxlY3RvciA9IChmbikgPT4gc2xpY2UodG9TaWduYXR1cmVIYXNoKGZuKSwgMCwgNCk7XG4vLyMgc291cmNlTWFwcGluZ1VSTD10b0Z1bmN0aW9uU2VsZWN0b3IuanMubWFwIiwKICAgICJpbXBvcnQgeyBCYXNlRXJyb3IgfSBmcm9tICcuL2Jhc2UuanMnO1xuZXhwb3J0IGNsYXNzIEludmFsaWRBZGRyZXNzRXJyb3IgZXh0ZW5kcyBCYXNlRXJyb3Ige1xuICAgIGNvbnN0cnVjdG9yKHsgYWRkcmVzcyB9KSB7XG4gICAgICAgIHN1cGVyKGBBZGRyZXNzIFwiJHthZGRyZXNzfVwiIGlzIGludmFsaWQuYCwge1xuICAgICAgICAgICAgbWV0YU1lc3NhZ2VzOiBbXG4gICAgICAgICAgICAgICAgJy0gQWRkcmVzcyBtdXN0IGJlIGEgaGV4IHZhbHVlIG9mIDIwIGJ5dGVzICg0MCBoZXggY2hhcmFjdGVycykuJyxcbiAgICAgICAgICAgICAgICAnLSBBZGRyZXNzIG11c3QgbWF0Y2ggaXRzIGNoZWNrc3VtIGNvdW50ZXJwYXJ0LicsXG4gICAgICAgICAgICBdLFxuICAgICAgICAgICAgbmFtZTogJ0ludmFsaWRBZGRyZXNzRXJyb3InLFxuICAgICAgICB9KTtcbiAgICB9XG59XG4vLyMgc291cmNlTWFwcGluZ1VSTD1hZGRyZXNzLmpzLm1hcCIsCiAgICAiLyoqXG4gKiBNYXAgd2l0aCBhIExSVSAoTGVhc3QgcmVjZW50bHkgdXNlZCkgcG9saWN5LlxuICpcbiAqIEBsaW5rIGh0dHBzOi8vZW4ud2lraXBlZGlhLm9yZy93aWtpL0NhY2hlX3JlcGxhY2VtZW50X3BvbGljaWVzI0xSVVxuICovXG5leHBvcnQgY2xhc3MgTHJ1TWFwIGV4dGVuZHMgTWFwIHtcbiAgICBjb25zdHJ1Y3RvcihzaXplKSB7XG4gICAgICAgIHN1cGVyKCk7XG4gICAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0aGlzLCBcIm1heFNpemVcIiwge1xuICAgICAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICAgICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgICAgICAgICAgIHdyaXRhYmxlOiB0cnVlLFxuICAgICAgICAgICAgdmFsdWU6IHZvaWQgMFxuICAgICAgICB9KTtcbiAgICAgICAgdGhpcy5tYXhTaXplID0gc2l6ZTtcbiAgICB9XG4gICAgZ2V0KGtleSkge1xuICAgICAgICBjb25zdCB2YWx1ZSA9IHN1cGVyLmdldChrZXkpO1xuICAgICAgICBpZiAoc3VwZXIuaGFzKGtleSkgJiYgdmFsdWUgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgdGhpcy5kZWxldGUoa2V5KTtcbiAgICAgICAgICAgIHN1cGVyLnNldChrZXksIHZhbHVlKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdmFsdWU7XG4gICAgfVxuICAgIHNldChrZXksIHZhbHVlKSB7XG4gICAgICAgIHN1cGVyLnNldChrZXksIHZhbHVlKTtcbiAgICAgICAgaWYgKHRoaXMubWF4U2l6ZSAmJiB0aGlzLnNpemUgPiB0aGlzLm1heFNpemUpIHtcbiAgICAgICAgICAgIGNvbnN0IGZpcnN0S2V5ID0gdGhpcy5rZXlzKCkubmV4dCgpLnZhbHVlO1xuICAgICAgICAgICAgaWYgKGZpcnN0S2V5KVxuICAgICAgICAgICAgICAgIHRoaXMuZGVsZXRlKGZpcnN0S2V5KTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG59XG4vLyMgc291cmNlTWFwcGluZ1VSTD1scnUuanMubWFwIiwKICAgICJpbXBvcnQgeyBMcnVNYXAgfSBmcm9tICcuLi9scnUuanMnO1xuaW1wb3J0IHsgY2hlY2tzdW1BZGRyZXNzIH0gZnJvbSAnLi9nZXRBZGRyZXNzLmpzJztcbmNvbnN0IGFkZHJlc3NSZWdleCA9IC9eMHhbYS1mQS1GMC05XXs0MH0kLztcbi8qKiBAaW50ZXJuYWwgKi9cbmV4cG9ydCBjb25zdCBpc0FkZHJlc3NDYWNoZSA9IC8qI19fUFVSRV9fKi8gbmV3IExydU1hcCg4MTkyKTtcbmV4cG9ydCBmdW5jdGlvbiBpc0FkZHJlc3MoYWRkcmVzcywgb3B0aW9ucykge1xuICAgIGNvbnN0IHsgc3RyaWN0ID0gdHJ1ZSB9ID0gb3B0aW9ucyA/PyB7fTtcbiAgICBjb25zdCBjYWNoZUtleSA9IGAke2FkZHJlc3N9LiR7c3RyaWN0fWA7XG4gICAgaWYgKGlzQWRkcmVzc0NhY2hlLmhhcyhjYWNoZUtleSkpXG4gICAgICAgIHJldHVybiBpc0FkZHJlc3NDYWNoZS5nZXQoY2FjaGVLZXkpO1xuICAgIGNvbnN0IHJlc3VsdCA9ICgoKSA9PiB7XG4gICAgICAgIGlmICghYWRkcmVzc1JlZ2V4LnRlc3QoYWRkcmVzcykpXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIGlmIChhZGRyZXNzLnRvTG93ZXJDYXNlKCkgPT09IGFkZHJlc3MpXG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgaWYgKHN0cmljdClcbiAgICAgICAgICAgIHJldHVybiBjaGVja3N1bUFkZHJlc3MoYWRkcmVzcykgPT09IGFkZHJlc3M7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH0pKCk7XG4gICAgaXNBZGRyZXNzQ2FjaGUuc2V0KGNhY2hlS2V5LCByZXN1bHQpO1xuICAgIHJldHVybiByZXN1bHQ7XG59XG4vLyMgc291cmNlTWFwcGluZ1VSTD1pc0FkZHJlc3MuanMubWFwIiwKICAgICJpbXBvcnQgeyBJbnZhbGlkQWRkcmVzc0Vycm9yIH0gZnJvbSAnLi4vLi4vZXJyb3JzL2FkZHJlc3MuanMnO1xuaW1wb3J0IHsgc3RyaW5nVG9CeXRlcywgfSBmcm9tICcuLi9lbmNvZGluZy90b0J5dGVzLmpzJztcbmltcG9ydCB7IGtlY2NhazI1NiB9IGZyb20gJy4uL2hhc2gva2VjY2FrMjU2LmpzJztcbmltcG9ydCB7IExydU1hcCB9IGZyb20gJy4uL2xydS5qcyc7XG5pbXBvcnQgeyBpc0FkZHJlc3MgfSBmcm9tICcuL2lzQWRkcmVzcy5qcyc7XG5jb25zdCBjaGVja3N1bUFkZHJlc3NDYWNoZSA9IC8qI19fUFVSRV9fKi8gbmV3IExydU1hcCg4MTkyKTtcbmV4cG9ydCBmdW5jdGlvbiBjaGVja3N1bUFkZHJlc3MoYWRkcmVzc18sIFxuLyoqXG4gKiBXYXJuaW5nOiBFSVAtMTE5MSBjaGVja3N1bSBhZGRyZXNzZXMgYXJlIGdlbmVyYWxseSBub3QgYmFja3dhcmRzIGNvbXBhdGlibGUgd2l0aCB0aGVcbiAqIHdpZGVyIEV0aGVyZXVtIGVjb3N5c3RlbSwgbWVhbmluZyBpdCB3aWxsIGJyZWFrIHdoZW4gdmFsaWRhdGVkIGFnYWluc3QgYW4gYXBwbGljYXRpb24vdG9vbFxuICogdGhhdCByZWxpZXMgb24gRUlQLTU1IGNoZWNrc3VtIGVuY29kaW5nIChjaGVja3N1bSB3aXRob3V0IGNoYWluSWQpLlxuICpcbiAqIEl0IGlzIGhpZ2hseSByZWNvbW1lbmRlZCB0byBub3QgdXNlIHRoaXMgZmVhdHVyZSB1bmxlc3MgeW91XG4gKiBrbm93IHdoYXQgeW91IGFyZSBkb2luZy5cbiAqXG4gKiBTZWUgbW9yZTogaHR0cHM6Ly9naXRodWIuY29tL2V0aGVyZXVtL0VJUHMvaXNzdWVzLzExMjFcbiAqL1xuY2hhaW5JZCkge1xuICAgIGlmIChjaGVja3N1bUFkZHJlc3NDYWNoZS5oYXMoYCR7YWRkcmVzc199LiR7Y2hhaW5JZH1gKSlcbiAgICAgICAgcmV0dXJuIGNoZWNrc3VtQWRkcmVzc0NhY2hlLmdldChgJHthZGRyZXNzX30uJHtjaGFpbklkfWApO1xuICAgIGNvbnN0IGhleEFkZHJlc3MgPSBjaGFpbklkXG4gICAgICAgID8gYCR7Y2hhaW5JZH0ke2FkZHJlc3NfLnRvTG93ZXJDYXNlKCl9YFxuICAgICAgICA6IGFkZHJlc3NfLnN1YnN0cmluZygyKS50b0xvd2VyQ2FzZSgpO1xuICAgIGNvbnN0IGhhc2ggPSBrZWNjYWsyNTYoc3RyaW5nVG9CeXRlcyhoZXhBZGRyZXNzKSwgJ2J5dGVzJyk7XG4gICAgY29uc3QgYWRkcmVzcyA9IChjaGFpbklkID8gaGV4QWRkcmVzcy5zdWJzdHJpbmcoYCR7Y2hhaW5JZH0weGAubGVuZ3RoKSA6IGhleEFkZHJlc3MpLnNwbGl0KCcnKTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IDQwOyBpICs9IDIpIHtcbiAgICAgICAgaWYgKGhhc2hbaSA+PiAxXSA+PiA0ID49IDggJiYgYWRkcmVzc1tpXSkge1xuICAgICAgICAgICAgYWRkcmVzc1tpXSA9IGFkZHJlc3NbaV0udG9VcHBlckNhc2UoKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoKGhhc2hbaSA+PiAxXSAmIDB4MGYpID49IDggJiYgYWRkcmVzc1tpICsgMV0pIHtcbiAgICAgICAgICAgIGFkZHJlc3NbaSArIDFdID0gYWRkcmVzc1tpICsgMV0udG9VcHBlckNhc2UoKTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBjb25zdCByZXN1bHQgPSBgMHgke2FkZHJlc3Muam9pbignJyl9YDtcbiAgICBjaGVja3N1bUFkZHJlc3NDYWNoZS5zZXQoYCR7YWRkcmVzc199LiR7Y2hhaW5JZH1gLCByZXN1bHQpO1xuICAgIHJldHVybiByZXN1bHQ7XG59XG5leHBvcnQgZnVuY3Rpb24gZ2V0QWRkcmVzcyhhZGRyZXNzLCBcbi8qKlxuICogV2FybmluZzogRUlQLTExOTEgY2hlY2tzdW0gYWRkcmVzc2VzIGFyZSBnZW5lcmFsbHkgbm90IGJhY2t3YXJkcyBjb21wYXRpYmxlIHdpdGggdGhlXG4gKiB3aWRlciBFdGhlcmV1bSBlY29zeXN0ZW0sIG1lYW5pbmcgaXQgd2lsbCBicmVhayB3aGVuIHZhbGlkYXRlZCBhZ2FpbnN0IGFuIGFwcGxpY2F0aW9uL3Rvb2xcbiAqIHRoYXQgcmVsaWVzIG9uIEVJUC01NSBjaGVja3N1bSBlbmNvZGluZyAoY2hlY2tzdW0gd2l0aG91dCBjaGFpbklkKS5cbiAqXG4gKiBJdCBpcyBoaWdobHkgcmVjb21tZW5kZWQgdG8gbm90IHVzZSB0aGlzIGZlYXR1cmUgdW5sZXNzIHlvdVxuICoga25vdyB3aGF0IHlvdSBhcmUgZG9pbmcuXG4gKlxuICogU2VlIG1vcmU6IGh0dHBzOi8vZ2l0aHViLmNvbS9ldGhlcmV1bS9FSVBzL2lzc3Vlcy8xMTIxXG4gKi9cbmNoYWluSWQpIHtcbiAgICBpZiAoIWlzQWRkcmVzcyhhZGRyZXNzLCB7IHN0cmljdDogZmFsc2UgfSkpXG4gICAgICAgIHRocm93IG5ldyBJbnZhbGlkQWRkcmVzc0Vycm9yKHsgYWRkcmVzcyB9KTtcbiAgICByZXR1cm4gY2hlY2tzdW1BZGRyZXNzKGFkZHJlc3MsIGNoYWluSWQpO1xufVxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9Z2V0QWRkcmVzcy5qcy5tYXAiLAogICAgImltcG9ydCB7IEJhc2VFcnJvciB9IGZyb20gJy4vYmFzZS5qcyc7XG5leHBvcnQgY2xhc3MgTmVnYXRpdmVPZmZzZXRFcnJvciBleHRlbmRzIEJhc2VFcnJvciB7XG4gICAgY29uc3RydWN0b3IoeyBvZmZzZXQgfSkge1xuICAgICAgICBzdXBlcihgT2Zmc2V0IFxcYCR7b2Zmc2V0fVxcYCBjYW5ub3QgYmUgbmVnYXRpdmUuYCwge1xuICAgICAgICAgICAgbmFtZTogJ05lZ2F0aXZlT2Zmc2V0RXJyb3InLFxuICAgICAgICB9KTtcbiAgICB9XG59XG5leHBvcnQgY2xhc3MgUG9zaXRpb25PdXRPZkJvdW5kc0Vycm9yIGV4dGVuZHMgQmFzZUVycm9yIHtcbiAgICBjb25zdHJ1Y3Rvcih7IGxlbmd0aCwgcG9zaXRpb24gfSkge1xuICAgICAgICBzdXBlcihgUG9zaXRpb24gXFxgJHtwb3NpdGlvbn1cXGAgaXMgb3V0IG9mIGJvdW5kcyAoXFxgMCA8IHBvc2l0aW9uIDwgJHtsZW5ndGh9XFxgKS5gLCB7IG5hbWU6ICdQb3NpdGlvbk91dE9mQm91bmRzRXJyb3InIH0pO1xuICAgIH1cbn1cbmV4cG9ydCBjbGFzcyBSZWN1cnNpdmVSZWFkTGltaXRFeGNlZWRlZEVycm9yIGV4dGVuZHMgQmFzZUVycm9yIHtcbiAgICBjb25zdHJ1Y3Rvcih7IGNvdW50LCBsaW1pdCB9KSB7XG4gICAgICAgIHN1cGVyKGBSZWN1cnNpdmUgcmVhZCBsaW1pdCBvZiBcXGAke2xpbWl0fVxcYCBleGNlZWRlZCAocmVjdXJzaXZlIHJlYWQgY291bnQ6IFxcYCR7Y291bnR9XFxgKS5gLCB7IG5hbWU6ICdSZWN1cnNpdmVSZWFkTGltaXRFeGNlZWRlZEVycm9yJyB9KTtcbiAgICB9XG59XG4vLyMgc291cmNlTWFwcGluZ1VSTD1jdXJzb3IuanMubWFwIiwKICAgICJpbXBvcnQgeyBOZWdhdGl2ZU9mZnNldEVycm9yLCBQb3NpdGlvbk91dE9mQm91bmRzRXJyb3IsIFJlY3Vyc2l2ZVJlYWRMaW1pdEV4Y2VlZGVkRXJyb3IsIH0gZnJvbSAnLi4vZXJyb3JzL2N1cnNvci5qcyc7XG5jb25zdCBzdGF0aWNDdXJzb3IgPSB7XG4gICAgYnl0ZXM6IG5ldyBVaW50OEFycmF5KCksXG4gICAgZGF0YVZpZXc6IG5ldyBEYXRhVmlldyhuZXcgQXJyYXlCdWZmZXIoMCkpLFxuICAgIHBvc2l0aW9uOiAwLFxuICAgIHBvc2l0aW9uUmVhZENvdW50OiBuZXcgTWFwKCksXG4gICAgcmVjdXJzaXZlUmVhZENvdW50OiAwLFxuICAgIHJlY3Vyc2l2ZVJlYWRMaW1pdDogTnVtYmVyLlBPU0lUSVZFX0lORklOSVRZLFxuICAgIGFzc2VydFJlYWRMaW1pdCgpIHtcbiAgICAgICAgaWYgKHRoaXMucmVjdXJzaXZlUmVhZENvdW50ID49IHRoaXMucmVjdXJzaXZlUmVhZExpbWl0KVxuICAgICAgICAgICAgdGhyb3cgbmV3IFJlY3Vyc2l2ZVJlYWRMaW1pdEV4Y2VlZGVkRXJyb3Ioe1xuICAgICAgICAgICAgICAgIGNvdW50OiB0aGlzLnJlY3Vyc2l2ZVJlYWRDb3VudCArIDEsXG4gICAgICAgICAgICAgICAgbGltaXQ6IHRoaXMucmVjdXJzaXZlUmVhZExpbWl0LFxuICAgICAgICAgICAgfSk7XG4gICAgfSxcbiAgICBhc3NlcnRQb3NpdGlvbihwb3NpdGlvbikge1xuICAgICAgICBpZiAocG9zaXRpb24gPCAwIHx8IHBvc2l0aW9uID4gdGhpcy5ieXRlcy5sZW5ndGggLSAxKVxuICAgICAgICAgICAgdGhyb3cgbmV3IFBvc2l0aW9uT3V0T2ZCb3VuZHNFcnJvcih7XG4gICAgICAgICAgICAgICAgbGVuZ3RoOiB0aGlzLmJ5dGVzLmxlbmd0aCxcbiAgICAgICAgICAgICAgICBwb3NpdGlvbixcbiAgICAgICAgICAgIH0pO1xuICAgIH0sXG4gICAgZGVjcmVtZW50UG9zaXRpb24ob2Zmc2V0KSB7XG4gICAgICAgIGlmIChvZmZzZXQgPCAwKVxuICAgICAgICAgICAgdGhyb3cgbmV3IE5lZ2F0aXZlT2Zmc2V0RXJyb3IoeyBvZmZzZXQgfSk7XG4gICAgICAgIGNvbnN0IHBvc2l0aW9uID0gdGhpcy5wb3NpdGlvbiAtIG9mZnNldDtcbiAgICAgICAgdGhpcy5hc3NlcnRQb3NpdGlvbihwb3NpdGlvbik7XG4gICAgICAgIHRoaXMucG9zaXRpb24gPSBwb3NpdGlvbjtcbiAgICB9LFxuICAgIGdldFJlYWRDb3VudChwb3NpdGlvbikge1xuICAgICAgICByZXR1cm4gdGhpcy5wb3NpdGlvblJlYWRDb3VudC5nZXQocG9zaXRpb24gfHwgdGhpcy5wb3NpdGlvbikgfHwgMDtcbiAgICB9LFxuICAgIGluY3JlbWVudFBvc2l0aW9uKG9mZnNldCkge1xuICAgICAgICBpZiAob2Zmc2V0IDwgMClcbiAgICAgICAgICAgIHRocm93IG5ldyBOZWdhdGl2ZU9mZnNldEVycm9yKHsgb2Zmc2V0IH0pO1xuICAgICAgICBjb25zdCBwb3NpdGlvbiA9IHRoaXMucG9zaXRpb24gKyBvZmZzZXQ7XG4gICAgICAgIHRoaXMuYXNzZXJ0UG9zaXRpb24ocG9zaXRpb24pO1xuICAgICAgICB0aGlzLnBvc2l0aW9uID0gcG9zaXRpb247XG4gICAgfSxcbiAgICBpbnNwZWN0Qnl0ZShwb3NpdGlvbl8pIHtcbiAgICAgICAgY29uc3QgcG9zaXRpb24gPSBwb3NpdGlvbl8gPz8gdGhpcy5wb3NpdGlvbjtcbiAgICAgICAgdGhpcy5hc3NlcnRQb3NpdGlvbihwb3NpdGlvbik7XG4gICAgICAgIHJldHVybiB0aGlzLmJ5dGVzW3Bvc2l0aW9uXTtcbiAgICB9LFxuICAgIGluc3BlY3RCeXRlcyhsZW5ndGgsIHBvc2l0aW9uXykge1xuICAgICAgICBjb25zdCBwb3NpdGlvbiA9IHBvc2l0aW9uXyA/PyB0aGlzLnBvc2l0aW9uO1xuICAgICAgICB0aGlzLmFzc2VydFBvc2l0aW9uKHBvc2l0aW9uICsgbGVuZ3RoIC0gMSk7XG4gICAgICAgIHJldHVybiB0aGlzLmJ5dGVzLnN1YmFycmF5KHBvc2l0aW9uLCBwb3NpdGlvbiArIGxlbmd0aCk7XG4gICAgfSxcbiAgICBpbnNwZWN0VWludDgocG9zaXRpb25fKSB7XG4gICAgICAgIGNvbnN0IHBvc2l0aW9uID0gcG9zaXRpb25fID8/IHRoaXMucG9zaXRpb247XG4gICAgICAgIHRoaXMuYXNzZXJ0UG9zaXRpb24ocG9zaXRpb24pO1xuICAgICAgICByZXR1cm4gdGhpcy5ieXRlc1twb3NpdGlvbl07XG4gICAgfSxcbiAgICBpbnNwZWN0VWludDE2KHBvc2l0aW9uXykge1xuICAgICAgICBjb25zdCBwb3NpdGlvbiA9IHBvc2l0aW9uXyA/PyB0aGlzLnBvc2l0aW9uO1xuICAgICAgICB0aGlzLmFzc2VydFBvc2l0aW9uKHBvc2l0aW9uICsgMSk7XG4gICAgICAgIHJldHVybiB0aGlzLmRhdGFWaWV3LmdldFVpbnQxNihwb3NpdGlvbik7XG4gICAgfSxcbiAgICBpbnNwZWN0VWludDI0KHBvc2l0aW9uXykge1xuICAgICAgICBjb25zdCBwb3NpdGlvbiA9IHBvc2l0aW9uXyA/PyB0aGlzLnBvc2l0aW9uO1xuICAgICAgICB0aGlzLmFzc2VydFBvc2l0aW9uKHBvc2l0aW9uICsgMik7XG4gICAgICAgIHJldHVybiAoKHRoaXMuZGF0YVZpZXcuZ2V0VWludDE2KHBvc2l0aW9uKSA8PCA4KSArXG4gICAgICAgICAgICB0aGlzLmRhdGFWaWV3LmdldFVpbnQ4KHBvc2l0aW9uICsgMikpO1xuICAgIH0sXG4gICAgaW5zcGVjdFVpbnQzMihwb3NpdGlvbl8pIHtcbiAgICAgICAgY29uc3QgcG9zaXRpb24gPSBwb3NpdGlvbl8gPz8gdGhpcy5wb3NpdGlvbjtcbiAgICAgICAgdGhpcy5hc3NlcnRQb3NpdGlvbihwb3NpdGlvbiArIDMpO1xuICAgICAgICByZXR1cm4gdGhpcy5kYXRhVmlldy5nZXRVaW50MzIocG9zaXRpb24pO1xuICAgIH0sXG4gICAgcHVzaEJ5dGUoYnl0ZSkge1xuICAgICAgICB0aGlzLmFzc2VydFBvc2l0aW9uKHRoaXMucG9zaXRpb24pO1xuICAgICAgICB0aGlzLmJ5dGVzW3RoaXMucG9zaXRpb25dID0gYnl0ZTtcbiAgICAgICAgdGhpcy5wb3NpdGlvbisrO1xuICAgIH0sXG4gICAgcHVzaEJ5dGVzKGJ5dGVzKSB7XG4gICAgICAgIHRoaXMuYXNzZXJ0UG9zaXRpb24odGhpcy5wb3NpdGlvbiArIGJ5dGVzLmxlbmd0aCAtIDEpO1xuICAgICAgICB0aGlzLmJ5dGVzLnNldChieXRlcywgdGhpcy5wb3NpdGlvbik7XG4gICAgICAgIHRoaXMucG9zaXRpb24gKz0gYnl0ZXMubGVuZ3RoO1xuICAgIH0sXG4gICAgcHVzaFVpbnQ4KHZhbHVlKSB7XG4gICAgICAgIHRoaXMuYXNzZXJ0UG9zaXRpb24odGhpcy5wb3NpdGlvbik7XG4gICAgICAgIHRoaXMuYnl0ZXNbdGhpcy5wb3NpdGlvbl0gPSB2YWx1ZTtcbiAgICAgICAgdGhpcy5wb3NpdGlvbisrO1xuICAgIH0sXG4gICAgcHVzaFVpbnQxNih2YWx1ZSkge1xuICAgICAgICB0aGlzLmFzc2VydFBvc2l0aW9uKHRoaXMucG9zaXRpb24gKyAxKTtcbiAgICAgICAgdGhpcy5kYXRhVmlldy5zZXRVaW50MTYodGhpcy5wb3NpdGlvbiwgdmFsdWUpO1xuICAgICAgICB0aGlzLnBvc2l0aW9uICs9IDI7XG4gICAgfSxcbiAgICBwdXNoVWludDI0KHZhbHVlKSB7XG4gICAgICAgIHRoaXMuYXNzZXJ0UG9zaXRpb24odGhpcy5wb3NpdGlvbiArIDIpO1xuICAgICAgICB0aGlzLmRhdGFWaWV3LnNldFVpbnQxNih0aGlzLnBvc2l0aW9uLCB2YWx1ZSA+PiA4KTtcbiAgICAgICAgdGhpcy5kYXRhVmlldy5zZXRVaW50OCh0aGlzLnBvc2l0aW9uICsgMiwgdmFsdWUgJiB+NDI5NDk2NzA0MCk7XG4gICAgICAgIHRoaXMucG9zaXRpb24gKz0gMztcbiAgICB9LFxuICAgIHB1c2hVaW50MzIodmFsdWUpIHtcbiAgICAgICAgdGhpcy5hc3NlcnRQb3NpdGlvbih0aGlzLnBvc2l0aW9uICsgMyk7XG4gICAgICAgIHRoaXMuZGF0YVZpZXcuc2V0VWludDMyKHRoaXMucG9zaXRpb24sIHZhbHVlKTtcbiAgICAgICAgdGhpcy5wb3NpdGlvbiArPSA0O1xuICAgIH0sXG4gICAgcmVhZEJ5dGUoKSB7XG4gICAgICAgIHRoaXMuYXNzZXJ0UmVhZExpbWl0KCk7XG4gICAgICAgIHRoaXMuX3RvdWNoKCk7XG4gICAgICAgIGNvbnN0IHZhbHVlID0gdGhpcy5pbnNwZWN0Qnl0ZSgpO1xuICAgICAgICB0aGlzLnBvc2l0aW9uKys7XG4gICAgICAgIHJldHVybiB2YWx1ZTtcbiAgICB9LFxuICAgIHJlYWRCeXRlcyhsZW5ndGgsIHNpemUpIHtcbiAgICAgICAgdGhpcy5hc3NlcnRSZWFkTGltaXQoKTtcbiAgICAgICAgdGhpcy5fdG91Y2goKTtcbiAgICAgICAgY29uc3QgdmFsdWUgPSB0aGlzLmluc3BlY3RCeXRlcyhsZW5ndGgpO1xuICAgICAgICB0aGlzLnBvc2l0aW9uICs9IHNpemUgPz8gbGVuZ3RoO1xuICAgICAgICByZXR1cm4gdmFsdWU7XG4gICAgfSxcbiAgICByZWFkVWludDgoKSB7XG4gICAgICAgIHRoaXMuYXNzZXJ0UmVhZExpbWl0KCk7XG4gICAgICAgIHRoaXMuX3RvdWNoKCk7XG4gICAgICAgIGNvbnN0IHZhbHVlID0gdGhpcy5pbnNwZWN0VWludDgoKTtcbiAgICAgICAgdGhpcy5wb3NpdGlvbiArPSAxO1xuICAgICAgICByZXR1cm4gdmFsdWU7XG4gICAgfSxcbiAgICByZWFkVWludDE2KCkge1xuICAgICAgICB0aGlzLmFzc2VydFJlYWRMaW1pdCgpO1xuICAgICAgICB0aGlzLl90b3VjaCgpO1xuICAgICAgICBjb25zdCB2YWx1ZSA9IHRoaXMuaW5zcGVjdFVpbnQxNigpO1xuICAgICAgICB0aGlzLnBvc2l0aW9uICs9IDI7XG4gICAgICAgIHJldHVybiB2YWx1ZTtcbiAgICB9LFxuICAgIHJlYWRVaW50MjQoKSB7XG4gICAgICAgIHRoaXMuYXNzZXJ0UmVhZExpbWl0KCk7XG4gICAgICAgIHRoaXMuX3RvdWNoKCk7XG4gICAgICAgIGNvbnN0IHZhbHVlID0gdGhpcy5pbnNwZWN0VWludDI0KCk7XG4gICAgICAgIHRoaXMucG9zaXRpb24gKz0gMztcbiAgICAgICAgcmV0dXJuIHZhbHVlO1xuICAgIH0sXG4gICAgcmVhZFVpbnQzMigpIHtcbiAgICAgICAgdGhpcy5hc3NlcnRSZWFkTGltaXQoKTtcbiAgICAgICAgdGhpcy5fdG91Y2goKTtcbiAgICAgICAgY29uc3QgdmFsdWUgPSB0aGlzLmluc3BlY3RVaW50MzIoKTtcbiAgICAgICAgdGhpcy5wb3NpdGlvbiArPSA0O1xuICAgICAgICByZXR1cm4gdmFsdWU7XG4gICAgfSxcbiAgICBnZXQgcmVtYWluaW5nKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5ieXRlcy5sZW5ndGggLSB0aGlzLnBvc2l0aW9uO1xuICAgIH0sXG4gICAgc2V0UG9zaXRpb24ocG9zaXRpb24pIHtcbiAgICAgICAgY29uc3Qgb2xkUG9zaXRpb24gPSB0aGlzLnBvc2l0aW9uO1xuICAgICAgICB0aGlzLmFzc2VydFBvc2l0aW9uKHBvc2l0aW9uKTtcbiAgICAgICAgdGhpcy5wb3NpdGlvbiA9IHBvc2l0aW9uO1xuICAgICAgICByZXR1cm4gKCkgPT4gKHRoaXMucG9zaXRpb24gPSBvbGRQb3NpdGlvbik7XG4gICAgfSxcbiAgICBfdG91Y2goKSB7XG4gICAgICAgIGlmICh0aGlzLnJlY3Vyc2l2ZVJlYWRMaW1pdCA9PT0gTnVtYmVyLlBPU0lUSVZFX0lORklOSVRZKVxuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICBjb25zdCBjb3VudCA9IHRoaXMuZ2V0UmVhZENvdW50KCk7XG4gICAgICAgIHRoaXMucG9zaXRpb25SZWFkQ291bnQuc2V0KHRoaXMucG9zaXRpb24sIGNvdW50ICsgMSk7XG4gICAgICAgIGlmIChjb3VudCA+IDApXG4gICAgICAgICAgICB0aGlzLnJlY3Vyc2l2ZVJlYWRDb3VudCsrO1xuICAgIH0sXG59O1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUN1cnNvcihieXRlcywgeyByZWN1cnNpdmVSZWFkTGltaXQgPSA4XzE5MiB9ID0ge30pIHtcbiAgICBjb25zdCBjdXJzb3IgPSBPYmplY3QuY3JlYXRlKHN0YXRpY0N1cnNvcik7XG4gICAgY3Vyc29yLmJ5dGVzID0gYnl0ZXM7XG4gICAgY3Vyc29yLmRhdGFWaWV3ID0gbmV3IERhdGFWaWV3KGJ5dGVzLmJ1ZmZlciA/PyBieXRlcywgYnl0ZXMuYnl0ZU9mZnNldCwgYnl0ZXMuYnl0ZUxlbmd0aCk7XG4gICAgY3Vyc29yLnBvc2l0aW9uUmVhZENvdW50ID0gbmV3IE1hcCgpO1xuICAgIGN1cnNvci5yZWN1cnNpdmVSZWFkTGltaXQgPSByZWN1cnNpdmVSZWFkTGltaXQ7XG4gICAgcmV0dXJuIGN1cnNvcjtcbn1cbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWN1cnNvci5qcy5tYXAiLAogICAgImltcG9ydCB7IEludmFsaWRCeXRlc0Jvb2xlYW5FcnJvciB9IGZyb20gJy4uLy4uL2Vycm9ycy9lbmNvZGluZy5qcyc7XG5pbXBvcnQgeyB0cmltIH0gZnJvbSAnLi4vZGF0YS90cmltLmpzJztcbmltcG9ydCB7IGFzc2VydFNpemUsIGhleFRvQmlnSW50LCBoZXhUb051bWJlciwgfSBmcm9tICcuL2Zyb21IZXguanMnO1xuaW1wb3J0IHsgYnl0ZXNUb0hleCB9IGZyb20gJy4vdG9IZXguanMnO1xuLyoqXG4gKiBEZWNvZGVzIGEgYnl0ZSBhcnJheSBpbnRvIGEgVVRGLTggc3RyaW5nLCBoZXggdmFsdWUsIG51bWJlciwgYmlnaW50IG9yIGJvb2xlYW4uXG4gKlxuICogLSBEb2NzOiBodHRwczovL3ZpZW0uc2gvZG9jcy91dGlsaXRpZXMvZnJvbUJ5dGVzXG4gKiAtIEV4YW1wbGU6IGh0dHBzOi8vdmllbS5zaC9kb2NzL3V0aWxpdGllcy9mcm9tQnl0ZXMjdXNhZ2VcbiAqXG4gKiBAcGFyYW0gYnl0ZXMgQnl0ZSBhcnJheSB0byBkZWNvZGUuXG4gKiBAcGFyYW0gdG9Pck9wdHMgVHlwZSB0byBjb252ZXJ0IHRvIG9yIG9wdGlvbnMuXG4gKiBAcmV0dXJucyBEZWNvZGVkIHZhbHVlLlxuICpcbiAqIEBleGFtcGxlXG4gKiBpbXBvcnQgeyBmcm9tQnl0ZXMgfSBmcm9tICd2aWVtJ1xuICogY29uc3QgZGF0YSA9IGZyb21CeXRlcyhuZXcgVWludDhBcnJheShbMSwgMTY0XSksICdudW1iZXInKVxuICogLy8gNDIwXG4gKlxuICogQGV4YW1wbGVcbiAqIGltcG9ydCB7IGZyb21CeXRlcyB9IGZyb20gJ3ZpZW0nXG4gKiBjb25zdCBkYXRhID0gZnJvbUJ5dGVzKFxuICogICBuZXcgVWludDhBcnJheShbNzIsIDEwMSwgMTA4LCAxMDgsIDExMSwgMzIsIDg3LCAxMTEsIDExNCwgMTA4LCAxMDAsIDMzXSksXG4gKiAgICdzdHJpbmcnXG4gKiApXG4gKiAvLyAnSGVsbG8gd29ybGQnXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBmcm9tQnl0ZXMoYnl0ZXMsIHRvT3JPcHRzKSB7XG4gICAgY29uc3Qgb3B0cyA9IHR5cGVvZiB0b09yT3B0cyA9PT0gJ3N0cmluZycgPyB7IHRvOiB0b09yT3B0cyB9IDogdG9Pck9wdHM7XG4gICAgY29uc3QgdG8gPSBvcHRzLnRvO1xuICAgIGlmICh0byA9PT0gJ251bWJlcicpXG4gICAgICAgIHJldHVybiBieXRlc1RvTnVtYmVyKGJ5dGVzLCBvcHRzKTtcbiAgICBpZiAodG8gPT09ICdiaWdpbnQnKVxuICAgICAgICByZXR1cm4gYnl0ZXNUb0JpZ0ludChieXRlcywgb3B0cyk7XG4gICAgaWYgKHRvID09PSAnYm9vbGVhbicpXG4gICAgICAgIHJldHVybiBieXRlc1RvQm9vbChieXRlcywgb3B0cyk7XG4gICAgaWYgKHRvID09PSAnc3RyaW5nJylcbiAgICAgICAgcmV0dXJuIGJ5dGVzVG9TdHJpbmcoYnl0ZXMsIG9wdHMpO1xuICAgIHJldHVybiBieXRlc1RvSGV4KGJ5dGVzLCBvcHRzKTtcbn1cbi8qKlxuICogRGVjb2RlcyBhIGJ5dGUgYXJyYXkgaW50byBhIGJpZ2ludC5cbiAqXG4gKiAtIERvY3M6IGh0dHBzOi8vdmllbS5zaC9kb2NzL3V0aWxpdGllcy9mcm9tQnl0ZXMjYnl0ZXN0b2JpZ2ludFxuICpcbiAqIEBwYXJhbSBieXRlcyBCeXRlIGFycmF5IHRvIGRlY29kZS5cbiAqIEBwYXJhbSBvcHRzIE9wdGlvbnMuXG4gKiBAcmV0dXJucyBCaWdJbnQgdmFsdWUuXG4gKlxuICogQGV4YW1wbGVcbiAqIGltcG9ydCB7IGJ5dGVzVG9CaWdJbnQgfSBmcm9tICd2aWVtJ1xuICogY29uc3QgZGF0YSA9IGJ5dGVzVG9CaWdJbnQobmV3IFVpbnQ4QXJyYXkoWzEsIDE2NF0pKVxuICogLy8gNDIwblxuICovXG5leHBvcnQgZnVuY3Rpb24gYnl0ZXNUb0JpZ0ludChieXRlcywgb3B0cyA9IHt9KSB7XG4gICAgaWYgKHR5cGVvZiBvcHRzLnNpemUgIT09ICd1bmRlZmluZWQnKVxuICAgICAgICBhc3NlcnRTaXplKGJ5dGVzLCB7IHNpemU6IG9wdHMuc2l6ZSB9KTtcbiAgICBjb25zdCBoZXggPSBieXRlc1RvSGV4KGJ5dGVzLCBvcHRzKTtcbiAgICByZXR1cm4gaGV4VG9CaWdJbnQoaGV4LCBvcHRzKTtcbn1cbi8qKlxuICogRGVjb2RlcyBhIGJ5dGUgYXJyYXkgaW50byBhIGJvb2xlYW4uXG4gKlxuICogLSBEb2NzOiBodHRwczovL3ZpZW0uc2gvZG9jcy91dGlsaXRpZXMvZnJvbUJ5dGVzI2J5dGVzdG9ib29sXG4gKlxuICogQHBhcmFtIGJ5dGVzIEJ5dGUgYXJyYXkgdG8gZGVjb2RlLlxuICogQHBhcmFtIG9wdHMgT3B0aW9ucy5cbiAqIEByZXR1cm5zIEJvb2xlYW4gdmFsdWUuXG4gKlxuICogQGV4YW1wbGVcbiAqIGltcG9ydCB7IGJ5dGVzVG9Cb29sIH0gZnJvbSAndmllbSdcbiAqIGNvbnN0IGRhdGEgPSBieXRlc1RvQm9vbChuZXcgVWludDhBcnJheShbMV0pKVxuICogLy8gdHJ1ZVxuICovXG5leHBvcnQgZnVuY3Rpb24gYnl0ZXNUb0Jvb2woYnl0ZXNfLCBvcHRzID0ge30pIHtcbiAgICBsZXQgYnl0ZXMgPSBieXRlc187XG4gICAgaWYgKHR5cGVvZiBvcHRzLnNpemUgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgIGFzc2VydFNpemUoYnl0ZXMsIHsgc2l6ZTogb3B0cy5zaXplIH0pO1xuICAgICAgICBieXRlcyA9IHRyaW0oYnl0ZXMpO1xuICAgIH1cbiAgICBpZiAoYnl0ZXMubGVuZ3RoID4gMSB8fCBieXRlc1swXSA+IDEpXG4gICAgICAgIHRocm93IG5ldyBJbnZhbGlkQnl0ZXNCb29sZWFuRXJyb3IoYnl0ZXMpO1xuICAgIHJldHVybiBCb29sZWFuKGJ5dGVzWzBdKTtcbn1cbi8qKlxuICogRGVjb2RlcyBhIGJ5dGUgYXJyYXkgaW50byBhIG51bWJlci5cbiAqXG4gKiAtIERvY3M6IGh0dHBzOi8vdmllbS5zaC9kb2NzL3V0aWxpdGllcy9mcm9tQnl0ZXMjYnl0ZXN0b251bWJlclxuICpcbiAqIEBwYXJhbSBieXRlcyBCeXRlIGFycmF5IHRvIGRlY29kZS5cbiAqIEBwYXJhbSBvcHRzIE9wdGlvbnMuXG4gKiBAcmV0dXJucyBOdW1iZXIgdmFsdWUuXG4gKlxuICogQGV4YW1wbGVcbiAqIGltcG9ydCB7IGJ5dGVzVG9OdW1iZXIgfSBmcm9tICd2aWVtJ1xuICogY29uc3QgZGF0YSA9IGJ5dGVzVG9OdW1iZXIobmV3IFVpbnQ4QXJyYXkoWzEsIDE2NF0pKVxuICogLy8gNDIwXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBieXRlc1RvTnVtYmVyKGJ5dGVzLCBvcHRzID0ge30pIHtcbiAgICBpZiAodHlwZW9mIG9wdHMuc2l6ZSAhPT0gJ3VuZGVmaW5lZCcpXG4gICAgICAgIGFzc2VydFNpemUoYnl0ZXMsIHsgc2l6ZTogb3B0cy5zaXplIH0pO1xuICAgIGNvbnN0IGhleCA9IGJ5dGVzVG9IZXgoYnl0ZXMsIG9wdHMpO1xuICAgIHJldHVybiBoZXhUb051bWJlcihoZXgsIG9wdHMpO1xufVxuLyoqXG4gKiBEZWNvZGVzIGEgYnl0ZSBhcnJheSBpbnRvIGEgVVRGLTggc3RyaW5nLlxuICpcbiAqIC0gRG9jczogaHR0cHM6Ly92aWVtLnNoL2RvY3MvdXRpbGl0aWVzL2Zyb21CeXRlcyNieXRlc3Rvc3RyaW5nXG4gKlxuICogQHBhcmFtIGJ5dGVzIEJ5dGUgYXJyYXkgdG8gZGVjb2RlLlxuICogQHBhcmFtIG9wdHMgT3B0aW9ucy5cbiAqIEByZXR1cm5zIFN0cmluZyB2YWx1ZS5cbiAqXG4gKiBAZXhhbXBsZVxuICogaW1wb3J0IHsgYnl0ZXNUb1N0cmluZyB9IGZyb20gJ3ZpZW0nXG4gKiBjb25zdCBkYXRhID0gYnl0ZXNUb1N0cmluZyhuZXcgVWludDhBcnJheShbNzIsIDEwMSwgMTA4LCAxMDgsIDExMSwgMzIsIDg3LCAxMTEsIDExNCwgMTA4LCAxMDAsIDMzXSkpXG4gKiAvLyAnSGVsbG8gd29ybGQnXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBieXRlc1RvU3RyaW5nKGJ5dGVzXywgb3B0cyA9IHt9KSB7XG4gICAgbGV0IGJ5dGVzID0gYnl0ZXNfO1xuICAgIGlmICh0eXBlb2Ygb3B0cy5zaXplICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICBhc3NlcnRTaXplKGJ5dGVzLCB7IHNpemU6IG9wdHMuc2l6ZSB9KTtcbiAgICAgICAgYnl0ZXMgPSB0cmltKGJ5dGVzLCB7IGRpcjogJ3JpZ2h0JyB9KTtcbiAgICB9XG4gICAgcmV0dXJuIG5ldyBUZXh0RGVjb2RlcigpLmRlY29kZShieXRlcyk7XG59XG4vLyMgc291cmNlTWFwcGluZ1VSTD1mcm9tQnl0ZXMuanMubWFwIiwKICAgICJleHBvcnQgZnVuY3Rpb24gY29uY2F0KHZhbHVlcykge1xuICAgIGlmICh0eXBlb2YgdmFsdWVzWzBdID09PSAnc3RyaW5nJylcbiAgICAgICAgcmV0dXJuIGNvbmNhdEhleCh2YWx1ZXMpO1xuICAgIHJldHVybiBjb25jYXRCeXRlcyh2YWx1ZXMpO1xufVxuZXhwb3J0IGZ1bmN0aW9uIGNvbmNhdEJ5dGVzKHZhbHVlcykge1xuICAgIGxldCBsZW5ndGggPSAwO1xuICAgIGZvciAoY29uc3QgYXJyIG9mIHZhbHVlcykge1xuICAgICAgICBsZW5ndGggKz0gYXJyLmxlbmd0aDtcbiAgICB9XG4gICAgY29uc3QgcmVzdWx0ID0gbmV3IFVpbnQ4QXJyYXkobGVuZ3RoKTtcbiAgICBsZXQgb2Zmc2V0ID0gMDtcbiAgICBmb3IgKGNvbnN0IGFyciBvZiB2YWx1ZXMpIHtcbiAgICAgICAgcmVzdWx0LnNldChhcnIsIG9mZnNldCk7XG4gICAgICAgIG9mZnNldCArPSBhcnIubGVuZ3RoO1xuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xufVxuZXhwb3J0IGZ1bmN0aW9uIGNvbmNhdEhleCh2YWx1ZXMpIHtcbiAgICByZXR1cm4gYDB4JHt2YWx1ZXMucmVkdWNlKChhY2MsIHgpID0+IGFjYyArIHgucmVwbGFjZSgnMHgnLCAnJyksICcnKX1gO1xufVxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9Y29uY2F0LmpzLm1hcCIsCiAgICAiZXhwb3J0IGNvbnN0IGFycmF5UmVnZXggPSAvXiguKilcXFsoWzAtOV0qKVxcXSQvO1xuLy8gYGJ5dGVzPE0+YDogYmluYXJ5IHR5cGUgb2YgYE1gIGJ5dGVzLCBgMCA8IE0gPD0gMzJgXG4vLyBodHRwczovL3JlZ2V4ci5jb20vNnZhNTVcbmV4cG9ydCBjb25zdCBieXRlc1JlZ2V4ID0gL15ieXRlcyhbMS05XXwxWzAtOV18MlswLTldfDNbMC0yXSk/JC87XG4vLyBgKHUpaW50PE0+YDogKHVuKXNpZ25lZCBpbnRlZ2VyIHR5cGUgb2YgYE1gIGJpdHMsIGAwIDwgTSA8PSAyNTZgLCBgTSAlIDggPT0gMGBcbi8vIGh0dHBzOi8vcmVnZXhyLmNvbS82djhocFxuZXhwb3J0IGNvbnN0IGludGVnZXJSZWdleCA9IC9eKHU/aW50KSg4fDE2fDI0fDMyfDQwfDQ4fDU2fDY0fDcyfDgwfDg4fDk2fDEwNHwxMTJ8MTIwfDEyOHwxMzZ8MTQ0fDE1MnwxNjB8MTY4fDE3NnwxODR8MTkyfDIwMHwyMDh8MjE2fDIyNHwyMzJ8MjQwfDI0OHwyNTYpPyQvO1xuLy8jIHNvdXJjZU1hcHBpbmdVUkw9cmVnZXguanMubWFwIiwKICAgICJpbXBvcnQgeyBBYmlFbmNvZGluZ0FycmF5TGVuZ3RoTWlzbWF0Y2hFcnJvciwgQWJpRW5jb2RpbmdCeXRlc1NpemVNaXNtYXRjaEVycm9yLCBBYmlFbmNvZGluZ0xlbmd0aE1pc21hdGNoRXJyb3IsIEludmFsaWRBYmlFbmNvZGluZ1R5cGVFcnJvciwgSW52YWxpZEFycmF5RXJyb3IsIH0gZnJvbSAnLi4vLi4vZXJyb3JzL2FiaS5qcyc7XG5pbXBvcnQgeyBJbnZhbGlkQWRkcmVzc0Vycm9yLCB9IGZyb20gJy4uLy4uL2Vycm9ycy9hZGRyZXNzLmpzJztcbmltcG9ydCB7IEJhc2VFcnJvciB9IGZyb20gJy4uLy4uL2Vycm9ycy9iYXNlLmpzJztcbmltcG9ydCB7IEludGVnZXJPdXRPZlJhbmdlRXJyb3IgfSBmcm9tICcuLi8uLi9lcnJvcnMvZW5jb2RpbmcuanMnO1xuaW1wb3J0IHsgaXNBZGRyZXNzIH0gZnJvbSAnLi4vYWRkcmVzcy9pc0FkZHJlc3MuanMnO1xuaW1wb3J0IHsgY29uY2F0IH0gZnJvbSAnLi4vZGF0YS9jb25jYXQuanMnO1xuaW1wb3J0IHsgcGFkSGV4IH0gZnJvbSAnLi4vZGF0YS9wYWQuanMnO1xuaW1wb3J0IHsgc2l6ZSB9IGZyb20gJy4uL2RhdGEvc2l6ZS5qcyc7XG5pbXBvcnQgeyBzbGljZSB9IGZyb20gJy4uL2RhdGEvc2xpY2UuanMnO1xuaW1wb3J0IHsgYm9vbFRvSGV4LCBudW1iZXJUb0hleCwgc3RyaW5nVG9IZXgsIH0gZnJvbSAnLi4vZW5jb2RpbmcvdG9IZXguanMnO1xuaW1wb3J0IHsgaW50ZWdlclJlZ2V4IH0gZnJvbSAnLi4vcmVnZXguanMnO1xuLyoqXG4gKiBAZGVzY3JpcHRpb24gRW5jb2RlcyBhIGxpc3Qgb2YgcHJpbWl0aXZlIHZhbHVlcyBpbnRvIGFuIEFCSS1lbmNvZGVkIGhleCB2YWx1ZS5cbiAqXG4gKiAtIERvY3M6IGh0dHBzOi8vdmllbS5zaC9kb2NzL2FiaS9lbmNvZGVBYmlQYXJhbWV0ZXJzI2VuY29kZWFiaXBhcmFtZXRlcnNcbiAqXG4gKiAgIEdlbmVyYXRlcyBBQkkgZW5jb2RlZCBkYXRhIHVzaW5nIHRoZSBbQUJJIHNwZWNpZmljYXRpb25dKGh0dHBzOi8vZG9jcy5zb2xpZGl0eWxhbmcub3JnL2VuL2xhdGVzdC9hYmktc3BlYyksIGdpdmVuIGEgc2V0IG9mIEFCSSBwYXJhbWV0ZXJzIChpbnB1dHMvb3V0cHV0cykgYW5kIHRoZWlyIGNvcnJlc3BvbmRpbmcgdmFsdWVzLlxuICpcbiAqIEBwYXJhbSBwYXJhbXMgLSBhIHNldCBvZiBBQkkgUGFyYW1ldGVycyAocGFyYW1zKSwgdGhhdCBjYW4gYmUgaW4gdGhlIHNoYXBlIG9mIHRoZSBpbnB1dHMgb3Igb3V0cHV0cyBhdHRyaWJ1dGUgb2YgYW4gQUJJIEl0ZW0uXG4gKiBAcGFyYW0gdmFsdWVzIC0gYSBzZXQgb2YgdmFsdWVzICh2YWx1ZXMpIHRoYXQgY29ycmVzcG9uZCB0byB0aGUgZ2l2ZW4gcGFyYW1zLlxuICogQGV4YW1wbGVcbiAqIGBgYHR5cGVzY3JpcHRcbiAqIGltcG9ydCB7IGVuY29kZUFiaVBhcmFtZXRlcnMgfSBmcm9tICd2aWVtJ1xuICpcbiAqIGNvbnN0IGVuY29kZWREYXRhID0gZW5jb2RlQWJpUGFyYW1ldGVycyhcbiAqICAgW1xuICogICAgIHsgbmFtZTogJ3gnLCB0eXBlOiAnc3RyaW5nJyB9LFxuICogICAgIHsgbmFtZTogJ3knLCB0eXBlOiAndWludCcgfSxcbiAqICAgICB7IG5hbWU6ICd6JywgdHlwZTogJ2Jvb2wnIH1cbiAqICAgXSxcbiAqICAgWyd3YWdtaScsIDQyMG4sIHRydWVdXG4gKiApXG4gKiBgYGBcbiAqXG4gKiBZb3UgY2FuIGFsc28gcGFzcyBpbiBIdW1hbiBSZWFkYWJsZSBwYXJhbWV0ZXJzIHdpdGggdGhlIHBhcnNlQWJpUGFyYW1ldGVycyB1dGlsaXR5LlxuICpcbiAqIEBleGFtcGxlXG4gKiBgYGB0eXBlc2NyaXB0XG4gKiBpbXBvcnQgeyBlbmNvZGVBYmlQYXJhbWV0ZXJzLCBwYXJzZUFiaVBhcmFtZXRlcnMgfSBmcm9tICd2aWVtJ1xuICpcbiAqIGNvbnN0IGVuY29kZWREYXRhID0gZW5jb2RlQWJpUGFyYW1ldGVycyhcbiAqICAgcGFyc2VBYmlQYXJhbWV0ZXJzKCdzdHJpbmcgeCwgdWludCB5LCBib29sIHonKSxcbiAqICAgWyd3YWdtaScsIDQyMG4sIHRydWVdXG4gKiApXG4gKiBgYGBcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGVuY29kZUFiaVBhcmFtZXRlcnMocGFyYW1zLCB2YWx1ZXMpIHtcbiAgICBpZiAocGFyYW1zLmxlbmd0aCAhPT0gdmFsdWVzLmxlbmd0aClcbiAgICAgICAgdGhyb3cgbmV3IEFiaUVuY29kaW5nTGVuZ3RoTWlzbWF0Y2hFcnJvcih7XG4gICAgICAgICAgICBleHBlY3RlZExlbmd0aDogcGFyYW1zLmxlbmd0aCxcbiAgICAgICAgICAgIGdpdmVuTGVuZ3RoOiB2YWx1ZXMubGVuZ3RoLFxuICAgICAgICB9KTtcbiAgICAvLyBQcmVwYXJlIHRoZSBwYXJhbWV0ZXJzIHRvIGRldGVybWluZSBkeW5hbWljIHR5cGVzIHRvIGVuY29kZS5cbiAgICBjb25zdCBwcmVwYXJlZFBhcmFtcyA9IHByZXBhcmVQYXJhbXMoe1xuICAgICAgICBwYXJhbXM6IHBhcmFtcyxcbiAgICAgICAgdmFsdWVzOiB2YWx1ZXMsXG4gICAgfSk7XG4gICAgY29uc3QgZGF0YSA9IGVuY29kZVBhcmFtcyhwcmVwYXJlZFBhcmFtcyk7XG4gICAgaWYgKGRhdGEubGVuZ3RoID09PSAwKVxuICAgICAgICByZXR1cm4gJzB4JztcbiAgICByZXR1cm4gZGF0YTtcbn1cbmZ1bmN0aW9uIHByZXBhcmVQYXJhbXMoeyBwYXJhbXMsIHZhbHVlcywgfSkge1xuICAgIGNvbnN0IHByZXBhcmVkUGFyYW1zID0gW107XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBwYXJhbXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgcHJlcGFyZWRQYXJhbXMucHVzaChwcmVwYXJlUGFyYW0oeyBwYXJhbTogcGFyYW1zW2ldLCB2YWx1ZTogdmFsdWVzW2ldIH0pKTtcbiAgICB9XG4gICAgcmV0dXJuIHByZXBhcmVkUGFyYW1zO1xufVxuZnVuY3Rpb24gcHJlcGFyZVBhcmFtKHsgcGFyYW0sIHZhbHVlLCB9KSB7XG4gICAgY29uc3QgYXJyYXlDb21wb25lbnRzID0gZ2V0QXJyYXlDb21wb25lbnRzKHBhcmFtLnR5cGUpO1xuICAgIGlmIChhcnJheUNvbXBvbmVudHMpIHtcbiAgICAgICAgY29uc3QgW2xlbmd0aCwgdHlwZV0gPSBhcnJheUNvbXBvbmVudHM7XG4gICAgICAgIHJldHVybiBlbmNvZGVBcnJheSh2YWx1ZSwgeyBsZW5ndGgsIHBhcmFtOiB7IC4uLnBhcmFtLCB0eXBlIH0gfSk7XG4gICAgfVxuICAgIGlmIChwYXJhbS50eXBlID09PSAndHVwbGUnKSB7XG4gICAgICAgIHJldHVybiBlbmNvZGVUdXBsZSh2YWx1ZSwge1xuICAgICAgICAgICAgcGFyYW06IHBhcmFtLFxuICAgICAgICB9KTtcbiAgICB9XG4gICAgaWYgKHBhcmFtLnR5cGUgPT09ICdhZGRyZXNzJykge1xuICAgICAgICByZXR1cm4gZW5jb2RlQWRkcmVzcyh2YWx1ZSk7XG4gICAgfVxuICAgIGlmIChwYXJhbS50eXBlID09PSAnYm9vbCcpIHtcbiAgICAgICAgcmV0dXJuIGVuY29kZUJvb2wodmFsdWUpO1xuICAgIH1cbiAgICBpZiAocGFyYW0udHlwZS5zdGFydHNXaXRoKCd1aW50JykgfHwgcGFyYW0udHlwZS5zdGFydHNXaXRoKCdpbnQnKSkge1xuICAgICAgICBjb25zdCBzaWduZWQgPSBwYXJhbS50eXBlLnN0YXJ0c1dpdGgoJ2ludCcpO1xuICAgICAgICBjb25zdCBbLCAsIHNpemUgPSAnMjU2J10gPSBpbnRlZ2VyUmVnZXguZXhlYyhwYXJhbS50eXBlKSA/PyBbXTtcbiAgICAgICAgcmV0dXJuIGVuY29kZU51bWJlcih2YWx1ZSwge1xuICAgICAgICAgICAgc2lnbmVkLFxuICAgICAgICAgICAgc2l6ZTogTnVtYmVyKHNpemUpLFxuICAgICAgICB9KTtcbiAgICB9XG4gICAgaWYgKHBhcmFtLnR5cGUuc3RhcnRzV2l0aCgnYnl0ZXMnKSkge1xuICAgICAgICByZXR1cm4gZW5jb2RlQnl0ZXModmFsdWUsIHsgcGFyYW0gfSk7XG4gICAgfVxuICAgIGlmIChwYXJhbS50eXBlID09PSAnc3RyaW5nJykge1xuICAgICAgICByZXR1cm4gZW5jb2RlU3RyaW5nKHZhbHVlKTtcbiAgICB9XG4gICAgdGhyb3cgbmV3IEludmFsaWRBYmlFbmNvZGluZ1R5cGVFcnJvcihwYXJhbS50eXBlLCB7XG4gICAgICAgIGRvY3NQYXRoOiAnL2RvY3MvY29udHJhY3QvZW5jb2RlQWJpUGFyYW1ldGVycycsXG4gICAgfSk7XG59XG5mdW5jdGlvbiBlbmNvZGVQYXJhbXMocHJlcGFyZWRQYXJhbXMpIHtcbiAgICAvLyAxLiBDb21wdXRlIHRoZSBzaXplIG9mIHRoZSBzdGF0aWMgcGFydCBvZiB0aGUgcGFyYW1ldGVycy5cbiAgICBsZXQgc3RhdGljU2l6ZSA9IDA7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBwcmVwYXJlZFBhcmFtcy5sZW5ndGg7IGkrKykge1xuICAgICAgICBjb25zdCB7IGR5bmFtaWMsIGVuY29kZWQgfSA9IHByZXBhcmVkUGFyYW1zW2ldO1xuICAgICAgICBpZiAoZHluYW1pYylcbiAgICAgICAgICAgIHN0YXRpY1NpemUgKz0gMzI7XG4gICAgICAgIGVsc2VcbiAgICAgICAgICAgIHN0YXRpY1NpemUgKz0gc2l6ZShlbmNvZGVkKTtcbiAgICB9XG4gICAgLy8gMi4gU3BsaXQgdGhlIHBhcmFtZXRlcnMgaW50byBzdGF0aWMgYW5kIGR5bmFtaWMgcGFydHMuXG4gICAgY29uc3Qgc3RhdGljUGFyYW1zID0gW107XG4gICAgY29uc3QgZHluYW1pY1BhcmFtcyA9IFtdO1xuICAgIGxldCBkeW5hbWljU2l6ZSA9IDA7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBwcmVwYXJlZFBhcmFtcy5sZW5ndGg7IGkrKykge1xuICAgICAgICBjb25zdCB7IGR5bmFtaWMsIGVuY29kZWQgfSA9IHByZXBhcmVkUGFyYW1zW2ldO1xuICAgICAgICBpZiAoZHluYW1pYykge1xuICAgICAgICAgICAgc3RhdGljUGFyYW1zLnB1c2gobnVtYmVyVG9IZXgoc3RhdGljU2l6ZSArIGR5bmFtaWNTaXplLCB7IHNpemU6IDMyIH0pKTtcbiAgICAgICAgICAgIGR5bmFtaWNQYXJhbXMucHVzaChlbmNvZGVkKTtcbiAgICAgICAgICAgIGR5bmFtaWNTaXplICs9IHNpemUoZW5jb2RlZCk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBzdGF0aWNQYXJhbXMucHVzaChlbmNvZGVkKTtcbiAgICAgICAgfVxuICAgIH1cbiAgICAvLyAzLiBDb25jYXRlbmF0ZSBzdGF0aWMgYW5kIGR5bmFtaWMgcGFydHMuXG4gICAgcmV0dXJuIGNvbmNhdChbLi4uc3RhdGljUGFyYW1zLCAuLi5keW5hbWljUGFyYW1zXSk7XG59XG5mdW5jdGlvbiBlbmNvZGVBZGRyZXNzKHZhbHVlKSB7XG4gICAgaWYgKCFpc0FkZHJlc3ModmFsdWUpKVxuICAgICAgICB0aHJvdyBuZXcgSW52YWxpZEFkZHJlc3NFcnJvcih7IGFkZHJlc3M6IHZhbHVlIH0pO1xuICAgIHJldHVybiB7IGR5bmFtaWM6IGZhbHNlLCBlbmNvZGVkOiBwYWRIZXgodmFsdWUudG9Mb3dlckNhc2UoKSkgfTtcbn1cbmZ1bmN0aW9uIGVuY29kZUFycmF5KHZhbHVlLCB7IGxlbmd0aCwgcGFyYW0sIH0pIHtcbiAgICBjb25zdCBkeW5hbWljID0gbGVuZ3RoID09PSBudWxsO1xuICAgIGlmICghQXJyYXkuaXNBcnJheSh2YWx1ZSkpXG4gICAgICAgIHRocm93IG5ldyBJbnZhbGlkQXJyYXlFcnJvcih2YWx1ZSk7XG4gICAgaWYgKCFkeW5hbWljICYmIHZhbHVlLmxlbmd0aCAhPT0gbGVuZ3RoKVxuICAgICAgICB0aHJvdyBuZXcgQWJpRW5jb2RpbmdBcnJheUxlbmd0aE1pc21hdGNoRXJyb3Ioe1xuICAgICAgICAgICAgZXhwZWN0ZWRMZW5ndGg6IGxlbmd0aCxcbiAgICAgICAgICAgIGdpdmVuTGVuZ3RoOiB2YWx1ZS5sZW5ndGgsXG4gICAgICAgICAgICB0eXBlOiBgJHtwYXJhbS50eXBlfVske2xlbmd0aH1dYCxcbiAgICAgICAgfSk7XG4gICAgbGV0IGR5bmFtaWNDaGlsZCA9IGZhbHNlO1xuICAgIGNvbnN0IHByZXBhcmVkUGFyYW1zID0gW107XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCB2YWx1ZS5sZW5ndGg7IGkrKykge1xuICAgICAgICBjb25zdCBwcmVwYXJlZFBhcmFtID0gcHJlcGFyZVBhcmFtKHsgcGFyYW0sIHZhbHVlOiB2YWx1ZVtpXSB9KTtcbiAgICAgICAgaWYgKHByZXBhcmVkUGFyYW0uZHluYW1pYylcbiAgICAgICAgICAgIGR5bmFtaWNDaGlsZCA9IHRydWU7XG4gICAgICAgIHByZXBhcmVkUGFyYW1zLnB1c2gocHJlcGFyZWRQYXJhbSk7XG4gICAgfVxuICAgIGlmIChkeW5hbWljIHx8IGR5bmFtaWNDaGlsZCkge1xuICAgICAgICBjb25zdCBkYXRhID0gZW5jb2RlUGFyYW1zKHByZXBhcmVkUGFyYW1zKTtcbiAgICAgICAgaWYgKGR5bmFtaWMpIHtcbiAgICAgICAgICAgIGNvbnN0IGxlbmd0aCA9IG51bWJlclRvSGV4KHByZXBhcmVkUGFyYW1zLmxlbmd0aCwgeyBzaXplOiAzMiB9KTtcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgZHluYW1pYzogdHJ1ZSxcbiAgICAgICAgICAgICAgICBlbmNvZGVkOiBwcmVwYXJlZFBhcmFtcy5sZW5ndGggPiAwID8gY29uY2F0KFtsZW5ndGgsIGRhdGFdKSA6IGxlbmd0aCxcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGR5bmFtaWNDaGlsZClcbiAgICAgICAgICAgIHJldHVybiB7IGR5bmFtaWM6IHRydWUsIGVuY29kZWQ6IGRhdGEgfTtcbiAgICB9XG4gICAgcmV0dXJuIHtcbiAgICAgICAgZHluYW1pYzogZmFsc2UsXG4gICAgICAgIGVuY29kZWQ6IGNvbmNhdChwcmVwYXJlZFBhcmFtcy5tYXAoKHsgZW5jb2RlZCB9KSA9PiBlbmNvZGVkKSksXG4gICAgfTtcbn1cbmZ1bmN0aW9uIGVuY29kZUJ5dGVzKHZhbHVlLCB7IHBhcmFtIH0pIHtcbiAgICBjb25zdCBbLCBwYXJhbVNpemVdID0gcGFyYW0udHlwZS5zcGxpdCgnYnl0ZXMnKTtcbiAgICBjb25zdCBieXRlc1NpemUgPSBzaXplKHZhbHVlKTtcbiAgICBpZiAoIXBhcmFtU2l6ZSkge1xuICAgICAgICBsZXQgdmFsdWVfID0gdmFsdWU7XG4gICAgICAgIC8vIElmIHRoZSBzaXplIGlzIG5vdCBkaXZpc2libGUgYnkgMzIgYnl0ZXMsIHBhZCB0aGUgZW5kXG4gICAgICAgIC8vIHdpdGggZW1wdHkgYnl0ZXMgdG8gdGhlIGNlaWxpbmcgMzIgYnl0ZXMuXG4gICAgICAgIGlmIChieXRlc1NpemUgJSAzMiAhPT0gMClcbiAgICAgICAgICAgIHZhbHVlXyA9IHBhZEhleCh2YWx1ZV8sIHtcbiAgICAgICAgICAgICAgICBkaXI6ICdyaWdodCcsXG4gICAgICAgICAgICAgICAgc2l6ZTogTWF0aC5jZWlsKCh2YWx1ZS5sZW5ndGggLSAyKSAvIDIgLyAzMikgKiAzMixcbiAgICAgICAgICAgIH0pO1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgZHluYW1pYzogdHJ1ZSxcbiAgICAgICAgICAgIGVuY29kZWQ6IGNvbmNhdChbcGFkSGV4KG51bWJlclRvSGV4KGJ5dGVzU2l6ZSwgeyBzaXplOiAzMiB9KSksIHZhbHVlX10pLFxuICAgICAgICB9O1xuICAgIH1cbiAgICBpZiAoYnl0ZXNTaXplICE9PSBOdW1iZXIucGFyc2VJbnQocGFyYW1TaXplLCAxMCkpXG4gICAgICAgIHRocm93IG5ldyBBYmlFbmNvZGluZ0J5dGVzU2l6ZU1pc21hdGNoRXJyb3Ioe1xuICAgICAgICAgICAgZXhwZWN0ZWRTaXplOiBOdW1iZXIucGFyc2VJbnQocGFyYW1TaXplLCAxMCksXG4gICAgICAgICAgICB2YWx1ZSxcbiAgICAgICAgfSk7XG4gICAgcmV0dXJuIHsgZHluYW1pYzogZmFsc2UsIGVuY29kZWQ6IHBhZEhleCh2YWx1ZSwgeyBkaXI6ICdyaWdodCcgfSkgfTtcbn1cbmZ1bmN0aW9uIGVuY29kZUJvb2wodmFsdWUpIHtcbiAgICBpZiAodHlwZW9mIHZhbHVlICE9PSAnYm9vbGVhbicpXG4gICAgICAgIHRocm93IG5ldyBCYXNlRXJyb3IoYEludmFsaWQgYm9vbGVhbiB2YWx1ZTogXCIke3ZhbHVlfVwiICh0eXBlOiAke3R5cGVvZiB2YWx1ZX0pLiBFeHBlY3RlZDogXFxgdHJ1ZVxcYCBvciBcXGBmYWxzZVxcYC5gKTtcbiAgICByZXR1cm4geyBkeW5hbWljOiBmYWxzZSwgZW5jb2RlZDogcGFkSGV4KGJvb2xUb0hleCh2YWx1ZSkpIH07XG59XG5mdW5jdGlvbiBlbmNvZGVOdW1iZXIodmFsdWUsIHsgc2lnbmVkLCBzaXplID0gMjU2IH0pIHtcbiAgICBpZiAodHlwZW9mIHNpemUgPT09ICdudW1iZXInKSB7XG4gICAgICAgIGNvbnN0IG1heCA9IDJuICoqIChCaWdJbnQoc2l6ZSkgLSAoc2lnbmVkID8gMW4gOiAwbikpIC0gMW47XG4gICAgICAgIGNvbnN0IG1pbiA9IHNpZ25lZCA/IC1tYXggLSAxbiA6IDBuO1xuICAgICAgICBpZiAodmFsdWUgPiBtYXggfHwgdmFsdWUgPCBtaW4pXG4gICAgICAgICAgICB0aHJvdyBuZXcgSW50ZWdlck91dE9mUmFuZ2VFcnJvcih7XG4gICAgICAgICAgICAgICAgbWF4OiBtYXgudG9TdHJpbmcoKSxcbiAgICAgICAgICAgICAgICBtaW46IG1pbi50b1N0cmluZygpLFxuICAgICAgICAgICAgICAgIHNpZ25lZCxcbiAgICAgICAgICAgICAgICBzaXplOiBzaXplIC8gOCxcbiAgICAgICAgICAgICAgICB2YWx1ZTogdmFsdWUudG9TdHJpbmcoKSxcbiAgICAgICAgICAgIH0pO1xuICAgIH1cbiAgICByZXR1cm4ge1xuICAgICAgICBkeW5hbWljOiBmYWxzZSxcbiAgICAgICAgZW5jb2RlZDogbnVtYmVyVG9IZXgodmFsdWUsIHtcbiAgICAgICAgICAgIHNpemU6IDMyLFxuICAgICAgICAgICAgc2lnbmVkLFxuICAgICAgICB9KSxcbiAgICB9O1xufVxuZnVuY3Rpb24gZW5jb2RlU3RyaW5nKHZhbHVlKSB7XG4gICAgY29uc3QgaGV4VmFsdWUgPSBzdHJpbmdUb0hleCh2YWx1ZSk7XG4gICAgY29uc3QgcGFydHNMZW5ndGggPSBNYXRoLmNlaWwoc2l6ZShoZXhWYWx1ZSkgLyAzMik7XG4gICAgY29uc3QgcGFydHMgPSBbXTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHBhcnRzTGVuZ3RoOyBpKyspIHtcbiAgICAgICAgcGFydHMucHVzaChwYWRIZXgoc2xpY2UoaGV4VmFsdWUsIGkgKiAzMiwgKGkgKyAxKSAqIDMyKSwge1xuICAgICAgICAgICAgZGlyOiAncmlnaHQnLFxuICAgICAgICB9KSk7XG4gICAgfVxuICAgIHJldHVybiB7XG4gICAgICAgIGR5bmFtaWM6IHRydWUsXG4gICAgICAgIGVuY29kZWQ6IGNvbmNhdChbXG4gICAgICAgICAgICBwYWRIZXgobnVtYmVyVG9IZXgoc2l6ZShoZXhWYWx1ZSksIHsgc2l6ZTogMzIgfSkpLFxuICAgICAgICAgICAgLi4ucGFydHMsXG4gICAgICAgIF0pLFxuICAgIH07XG59XG5mdW5jdGlvbiBlbmNvZGVUdXBsZSh2YWx1ZSwgeyBwYXJhbSB9KSB7XG4gICAgbGV0IGR5bmFtaWMgPSBmYWxzZTtcbiAgICBjb25zdCBwcmVwYXJlZFBhcmFtcyA9IFtdO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgcGFyYW0uY29tcG9uZW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgICBjb25zdCBwYXJhbV8gPSBwYXJhbS5jb21wb25lbnRzW2ldO1xuICAgICAgICBjb25zdCBpbmRleCA9IEFycmF5LmlzQXJyYXkodmFsdWUpID8gaSA6IHBhcmFtXy5uYW1lO1xuICAgICAgICBjb25zdCBwcmVwYXJlZFBhcmFtID0gcHJlcGFyZVBhcmFtKHtcbiAgICAgICAgICAgIHBhcmFtOiBwYXJhbV8sXG4gICAgICAgICAgICB2YWx1ZTogdmFsdWVbaW5kZXhdLFxuICAgICAgICB9KTtcbiAgICAgICAgcHJlcGFyZWRQYXJhbXMucHVzaChwcmVwYXJlZFBhcmFtKTtcbiAgICAgICAgaWYgKHByZXBhcmVkUGFyYW0uZHluYW1pYylcbiAgICAgICAgICAgIGR5bmFtaWMgPSB0cnVlO1xuICAgIH1cbiAgICByZXR1cm4ge1xuICAgICAgICBkeW5hbWljLFxuICAgICAgICBlbmNvZGVkOiBkeW5hbWljXG4gICAgICAgICAgICA/IGVuY29kZVBhcmFtcyhwcmVwYXJlZFBhcmFtcylcbiAgICAgICAgICAgIDogY29uY2F0KHByZXBhcmVkUGFyYW1zLm1hcCgoeyBlbmNvZGVkIH0pID0+IGVuY29kZWQpKSxcbiAgICB9O1xufVxuZXhwb3J0IGZ1bmN0aW9uIGdldEFycmF5Q29tcG9uZW50cyh0eXBlKSB7XG4gICAgY29uc3QgbWF0Y2hlcyA9IHR5cGUubWF0Y2goL14oLiopXFxbKFxcZCspP1xcXSQvKTtcbiAgICByZXR1cm4gbWF0Y2hlc1xuICAgICAgICA/IC8vIFJldHVybiBgbnVsbGAgaWYgdGhlIGFycmF5IGlzIGR5bmFtaWMuXG4gICAgICAgICAgICBbbWF0Y2hlc1syXSA/IE51bWJlcihtYXRjaGVzWzJdKSA6IG51bGwsIG1hdGNoZXNbMV1dXG4gICAgICAgIDogdW5kZWZpbmVkO1xufVxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9ZW5jb2RlQWJpUGFyYW1ldGVycy5qcy5tYXAiLAogICAgImltcG9ydCB7IEFiaURlY29kaW5nRGF0YVNpemVUb29TbWFsbEVycm9yLCBBYmlEZWNvZGluZ1plcm9EYXRhRXJyb3IsIEludmFsaWRBYmlEZWNvZGluZ1R5cGVFcnJvciwgfSBmcm9tICcuLi8uLi9lcnJvcnMvYWJpLmpzJztcbmltcG9ydCB7IGNoZWNrc3VtQWRkcmVzcywgfSBmcm9tICcuLi9hZGRyZXNzL2dldEFkZHJlc3MuanMnO1xuaW1wb3J0IHsgY3JlYXRlQ3Vyc29yLCB9IGZyb20gJy4uL2N1cnNvci5qcyc7XG5pbXBvcnQgeyBzaXplIH0gZnJvbSAnLi4vZGF0YS9zaXplLmpzJztcbmltcG9ydCB7IHNsaWNlQnl0ZXMgfSBmcm9tICcuLi9kYXRhL3NsaWNlLmpzJztcbmltcG9ydCB7IHRyaW0gfSBmcm9tICcuLi9kYXRhL3RyaW0uanMnO1xuaW1wb3J0IHsgYnl0ZXNUb0JpZ0ludCwgYnl0ZXNUb0Jvb2wsIGJ5dGVzVG9OdW1iZXIsIGJ5dGVzVG9TdHJpbmcsIH0gZnJvbSAnLi4vZW5jb2RpbmcvZnJvbUJ5dGVzLmpzJztcbmltcG9ydCB7IGhleFRvQnl0ZXMgfSBmcm9tICcuLi9lbmNvZGluZy90b0J5dGVzLmpzJztcbmltcG9ydCB7IGJ5dGVzVG9IZXggfSBmcm9tICcuLi9lbmNvZGluZy90b0hleC5qcyc7XG5pbXBvcnQgeyBnZXRBcnJheUNvbXBvbmVudHMgfSBmcm9tICcuL2VuY29kZUFiaVBhcmFtZXRlcnMuanMnO1xuZXhwb3J0IGZ1bmN0aW9uIGRlY29kZUFiaVBhcmFtZXRlcnMocGFyYW1zLCBkYXRhKSB7XG4gICAgY29uc3QgYnl0ZXMgPSB0eXBlb2YgZGF0YSA9PT0gJ3N0cmluZycgPyBoZXhUb0J5dGVzKGRhdGEpIDogZGF0YTtcbiAgICBjb25zdCBjdXJzb3IgPSBjcmVhdGVDdXJzb3IoYnl0ZXMpO1xuICAgIGlmIChzaXplKGJ5dGVzKSA9PT0gMCAmJiBwYXJhbXMubGVuZ3RoID4gMClcbiAgICAgICAgdGhyb3cgbmV3IEFiaURlY29kaW5nWmVyb0RhdGFFcnJvcigpO1xuICAgIGlmIChzaXplKGRhdGEpICYmIHNpemUoZGF0YSkgPCAzMilcbiAgICAgICAgdGhyb3cgbmV3IEFiaURlY29kaW5nRGF0YVNpemVUb29TbWFsbEVycm9yKHtcbiAgICAgICAgICAgIGRhdGE6IHR5cGVvZiBkYXRhID09PSAnc3RyaW5nJyA/IGRhdGEgOiBieXRlc1RvSGV4KGRhdGEpLFxuICAgICAgICAgICAgcGFyYW1zOiBwYXJhbXMsXG4gICAgICAgICAgICBzaXplOiBzaXplKGRhdGEpLFxuICAgICAgICB9KTtcbiAgICBsZXQgY29uc3VtZWQgPSAwO1xuICAgIGNvbnN0IHZhbHVlcyA9IFtdO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgcGFyYW1zLmxlbmd0aDsgKytpKSB7XG4gICAgICAgIGNvbnN0IHBhcmFtID0gcGFyYW1zW2ldO1xuICAgICAgICBjdXJzb3Iuc2V0UG9zaXRpb24oY29uc3VtZWQpO1xuICAgICAgICBjb25zdCBbZGF0YSwgY29uc3VtZWRfXSA9IGRlY29kZVBhcmFtZXRlcihjdXJzb3IsIHBhcmFtLCB7XG4gICAgICAgICAgICBzdGF0aWNQb3NpdGlvbjogMCxcbiAgICAgICAgfSk7XG4gICAgICAgIGNvbnN1bWVkICs9IGNvbnN1bWVkXztcbiAgICAgICAgdmFsdWVzLnB1c2goZGF0YSk7XG4gICAgfVxuICAgIHJldHVybiB2YWx1ZXM7XG59XG5mdW5jdGlvbiBkZWNvZGVQYXJhbWV0ZXIoY3Vyc29yLCBwYXJhbSwgeyBzdGF0aWNQb3NpdGlvbiB9KSB7XG4gICAgY29uc3QgYXJyYXlDb21wb25lbnRzID0gZ2V0QXJyYXlDb21wb25lbnRzKHBhcmFtLnR5cGUpO1xuICAgIGlmIChhcnJheUNvbXBvbmVudHMpIHtcbiAgICAgICAgY29uc3QgW2xlbmd0aCwgdHlwZV0gPSBhcnJheUNvbXBvbmVudHM7XG4gICAgICAgIHJldHVybiBkZWNvZGVBcnJheShjdXJzb3IsIHsgLi4ucGFyYW0sIHR5cGUgfSwgeyBsZW5ndGgsIHN0YXRpY1Bvc2l0aW9uIH0pO1xuICAgIH1cbiAgICBpZiAocGFyYW0udHlwZSA9PT0gJ3R1cGxlJylcbiAgICAgICAgcmV0dXJuIGRlY29kZVR1cGxlKGN1cnNvciwgcGFyYW0sIHsgc3RhdGljUG9zaXRpb24gfSk7XG4gICAgaWYgKHBhcmFtLnR5cGUgPT09ICdhZGRyZXNzJylcbiAgICAgICAgcmV0dXJuIGRlY29kZUFkZHJlc3MoY3Vyc29yKTtcbiAgICBpZiAocGFyYW0udHlwZSA9PT0gJ2Jvb2wnKVxuICAgICAgICByZXR1cm4gZGVjb2RlQm9vbChjdXJzb3IpO1xuICAgIGlmIChwYXJhbS50eXBlLnN0YXJ0c1dpdGgoJ2J5dGVzJykpXG4gICAgICAgIHJldHVybiBkZWNvZGVCeXRlcyhjdXJzb3IsIHBhcmFtLCB7IHN0YXRpY1Bvc2l0aW9uIH0pO1xuICAgIGlmIChwYXJhbS50eXBlLnN0YXJ0c1dpdGgoJ3VpbnQnKSB8fCBwYXJhbS50eXBlLnN0YXJ0c1dpdGgoJ2ludCcpKVxuICAgICAgICByZXR1cm4gZGVjb2RlTnVtYmVyKGN1cnNvciwgcGFyYW0pO1xuICAgIGlmIChwYXJhbS50eXBlID09PSAnc3RyaW5nJylcbiAgICAgICAgcmV0dXJuIGRlY29kZVN0cmluZyhjdXJzb3IsIHsgc3RhdGljUG9zaXRpb24gfSk7XG4gICAgdGhyb3cgbmV3IEludmFsaWRBYmlEZWNvZGluZ1R5cGVFcnJvcihwYXJhbS50eXBlLCB7XG4gICAgICAgIGRvY3NQYXRoOiAnL2RvY3MvY29udHJhY3QvZGVjb2RlQWJpUGFyYW1ldGVycycsXG4gICAgfSk7XG59XG4vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vL1xuLy8gVHlwZSBEZWNvZGVyc1xuY29uc3Qgc2l6ZU9mTGVuZ3RoID0gMzI7XG5jb25zdCBzaXplT2ZPZmZzZXQgPSAzMjtcbmZ1bmN0aW9uIGRlY29kZUFkZHJlc3MoY3Vyc29yKSB7XG4gICAgY29uc3QgdmFsdWUgPSBjdXJzb3IucmVhZEJ5dGVzKDMyKTtcbiAgICByZXR1cm4gW2NoZWNrc3VtQWRkcmVzcyhieXRlc1RvSGV4KHNsaWNlQnl0ZXModmFsdWUsIC0yMCkpKSwgMzJdO1xufVxuZnVuY3Rpb24gZGVjb2RlQXJyYXkoY3Vyc29yLCBwYXJhbSwgeyBsZW5ndGgsIHN0YXRpY1Bvc2l0aW9uIH0pIHtcbiAgICAvLyBJZiB0aGUgbGVuZ3RoIG9mIHRoZSBhcnJheSBpcyBub3Qga25vd24gaW4gYWR2YW5jZSAoZHluYW1pYyBhcnJheSksXG4gICAgLy8gdGhpcyBtZWFucyB3ZSB3aWxsIG5lZWQgdG8gd29uZGVyIG9mZiB0byB0aGUgcG9pbnRlciBhbmQgZGVjb2RlLlxuICAgIGlmICghbGVuZ3RoKSB7XG4gICAgICAgIC8vIERlYWxpbmcgd2l0aCBhIGR5bmFtaWMgdHlwZSwgc28gZ2V0IHRoZSBvZmZzZXQgb2YgdGhlIGFycmF5IGRhdGEuXG4gICAgICAgIGNvbnN0IG9mZnNldCA9IGJ5dGVzVG9OdW1iZXIoY3Vyc29yLnJlYWRCeXRlcyhzaXplT2ZPZmZzZXQpKTtcbiAgICAgICAgLy8gU3RhcnQgaXMgdGhlIHN0YXRpYyBwb3NpdGlvbiBvZiBjdXJyZW50IHNsb3QgKyBvZmZzZXQuXG4gICAgICAgIGNvbnN0IHN0YXJ0ID0gc3RhdGljUG9zaXRpb24gKyBvZmZzZXQ7XG4gICAgICAgIGNvbnN0IHN0YXJ0T2ZEYXRhID0gc3RhcnQgKyBzaXplT2ZMZW5ndGg7XG4gICAgICAgIC8vIEdldCB0aGUgbGVuZ3RoIG9mIHRoZSBhcnJheSBmcm9tIHRoZSBvZmZzZXQuXG4gICAgICAgIGN1cnNvci5zZXRQb3NpdGlvbihzdGFydCk7XG4gICAgICAgIGNvbnN0IGxlbmd0aCA9IGJ5dGVzVG9OdW1iZXIoY3Vyc29yLnJlYWRCeXRlcyhzaXplT2ZMZW5ndGgpKTtcbiAgICAgICAgLy8gQ2hlY2sgaWYgdGhlIGFycmF5IGhhcyBhbnkgZHluYW1pYyBjaGlsZHJlbi5cbiAgICAgICAgY29uc3QgZHluYW1pY0NoaWxkID0gaGFzRHluYW1pY0NoaWxkKHBhcmFtKTtcbiAgICAgICAgbGV0IGNvbnN1bWVkID0gMDtcbiAgICAgICAgY29uc3QgdmFsdWUgPSBbXTtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsZW5ndGg7ICsraSkge1xuICAgICAgICAgICAgLy8gSWYgYW55IG9mIHRoZSBjaGlsZHJlbiBpcyBkeW5hbWljLCB0aGVuIGFsbCBlbGVtZW50cyB3aWxsIGJlIG9mZnNldCBwb2ludGVyLCB0aHVzIHNpemUgb2Ygb25lIHNsb3QgKDMyIGJ5dGVzKS5cbiAgICAgICAgICAgIC8vIE90aGVyd2lzZSwgZWxlbWVudHMgd2lsbCBiZSB0aGUgc2l6ZSBvZiB0aGVpciBlbmNvZGluZyAoY29uc3VtZWQgYnl0ZXMpLlxuICAgICAgICAgICAgY3Vyc29yLnNldFBvc2l0aW9uKHN0YXJ0T2ZEYXRhICsgKGR5bmFtaWNDaGlsZCA/IGkgKiAzMiA6IGNvbnN1bWVkKSk7XG4gICAgICAgICAgICBjb25zdCBbZGF0YSwgY29uc3VtZWRfXSA9IGRlY29kZVBhcmFtZXRlcihjdXJzb3IsIHBhcmFtLCB7XG4gICAgICAgICAgICAgICAgc3RhdGljUG9zaXRpb246IHN0YXJ0T2ZEYXRhLFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBjb25zdW1lZCArPSBjb25zdW1lZF87XG4gICAgICAgICAgICB2YWx1ZS5wdXNoKGRhdGEpO1xuICAgICAgICB9XG4gICAgICAgIC8vIEFzIHdlIGhhdmUgZ29uZSB3b25kZXJpbmcsIHJlc3RvcmUgdG8gdGhlIG9yaWdpbmFsIHBvc2l0aW9uICsgbmV4dCBzbG90LlxuICAgICAgICBjdXJzb3Iuc2V0UG9zaXRpb24oc3RhdGljUG9zaXRpb24gKyAzMik7XG4gICAgICAgIHJldHVybiBbdmFsdWUsIDMyXTtcbiAgICB9XG4gICAgLy8gSWYgdGhlIGxlbmd0aCBvZiB0aGUgYXJyYXkgaXMga25vd24gaW4gYWR2YW5jZSxcbiAgICAvLyBhbmQgdGhlIGxlbmd0aCBvZiBhbiBlbGVtZW50IGRlZXBseSBuZXN0ZWQgaW4gdGhlIGFycmF5IGlzIG5vdCBrbm93bixcbiAgICAvLyB3ZSBuZWVkIHRvIGRlY29kZSB0aGUgb2Zmc2V0IG9mIHRoZSBhcnJheSBkYXRhLlxuICAgIGlmIChoYXNEeW5hbWljQ2hpbGQocGFyYW0pKSB7XG4gICAgICAgIC8vIERlYWxpbmcgd2l0aCBkeW5hbWljIHR5cGVzLCBzbyBnZXQgdGhlIG9mZnNldCBvZiB0aGUgYXJyYXkgZGF0YS5cbiAgICAgICAgY29uc3Qgb2Zmc2V0ID0gYnl0ZXNUb051bWJlcihjdXJzb3IucmVhZEJ5dGVzKHNpemVPZk9mZnNldCkpO1xuICAgICAgICAvLyBTdGFydCBpcyB0aGUgc3RhdGljIHBvc2l0aW9uIG9mIGN1cnJlbnQgc2xvdCArIG9mZnNldC5cbiAgICAgICAgY29uc3Qgc3RhcnQgPSBzdGF0aWNQb3NpdGlvbiArIG9mZnNldDtcbiAgICAgICAgY29uc3QgdmFsdWUgPSBbXTtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsZW5ndGg7ICsraSkge1xuICAgICAgICAgICAgLy8gTW92ZSBjdXJzb3IgYWxvbmcgdG8gdGhlIG5leHQgc2xvdCAobmV4dCBvZmZzZXQgcG9pbnRlcikuXG4gICAgICAgICAgICBjdXJzb3Iuc2V0UG9zaXRpb24oc3RhcnQgKyBpICogMzIpO1xuICAgICAgICAgICAgY29uc3QgW2RhdGFdID0gZGVjb2RlUGFyYW1ldGVyKGN1cnNvciwgcGFyYW0sIHtcbiAgICAgICAgICAgICAgICBzdGF0aWNQb3NpdGlvbjogc3RhcnQsXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHZhbHVlLnB1c2goZGF0YSk7XG4gICAgICAgIH1cbiAgICAgICAgLy8gQXMgd2UgaGF2ZSBnb25lIHdvbmRlcmluZywgcmVzdG9yZSB0byB0aGUgb3JpZ2luYWwgcG9zaXRpb24gKyBuZXh0IHNsb3QuXG4gICAgICAgIGN1cnNvci5zZXRQb3NpdGlvbihzdGF0aWNQb3NpdGlvbiArIDMyKTtcbiAgICAgICAgcmV0dXJuIFt2YWx1ZSwgMzJdO1xuICAgIH1cbiAgICAvLyBJZiB0aGUgbGVuZ3RoIG9mIHRoZSBhcnJheSBpcyBrbm93biBpbiBhZHZhbmNlIGFuZCB0aGUgYXJyYXkgaXMgZGVlcGx5IHN0YXRpYyxcbiAgICAvLyB0aGVuIHdlIGNhbiBqdXN0IGRlY29kZSBlYWNoIGVsZW1lbnQgaW4gc2VxdWVuY2UuXG4gICAgbGV0IGNvbnN1bWVkID0gMDtcbiAgICBjb25zdCB2YWx1ZSA9IFtdO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbGVuZ3RoOyArK2kpIHtcbiAgICAgICAgY29uc3QgW2RhdGEsIGNvbnN1bWVkX10gPSBkZWNvZGVQYXJhbWV0ZXIoY3Vyc29yLCBwYXJhbSwge1xuICAgICAgICAgICAgc3RhdGljUG9zaXRpb246IHN0YXRpY1Bvc2l0aW9uICsgY29uc3VtZWQsXG4gICAgICAgIH0pO1xuICAgICAgICBjb25zdW1lZCArPSBjb25zdW1lZF87XG4gICAgICAgIHZhbHVlLnB1c2goZGF0YSk7XG4gICAgfVxuICAgIHJldHVybiBbdmFsdWUsIGNvbnN1bWVkXTtcbn1cbmZ1bmN0aW9uIGRlY29kZUJvb2woY3Vyc29yKSB7XG4gICAgcmV0dXJuIFtieXRlc1RvQm9vbChjdXJzb3IucmVhZEJ5dGVzKDMyKSwgeyBzaXplOiAzMiB9KSwgMzJdO1xufVxuZnVuY3Rpb24gZGVjb2RlQnl0ZXMoY3Vyc29yLCBwYXJhbSwgeyBzdGF0aWNQb3NpdGlvbiB9KSB7XG4gICAgY29uc3QgW18sIHNpemVdID0gcGFyYW0udHlwZS5zcGxpdCgnYnl0ZXMnKTtcbiAgICBpZiAoIXNpemUpIHtcbiAgICAgICAgLy8gRGVhbGluZyB3aXRoIGR5bmFtaWMgdHlwZXMsIHNvIGdldCB0aGUgb2Zmc2V0IG9mIHRoZSBieXRlcyBkYXRhLlxuICAgICAgICBjb25zdCBvZmZzZXQgPSBieXRlc1RvTnVtYmVyKGN1cnNvci5yZWFkQnl0ZXMoMzIpKTtcbiAgICAgICAgLy8gU2V0IHBvc2l0aW9uIG9mIHRoZSBjdXJzb3IgdG8gc3RhcnQgb2YgYnl0ZXMgZGF0YS5cbiAgICAgICAgY3Vyc29yLnNldFBvc2l0aW9uKHN0YXRpY1Bvc2l0aW9uICsgb2Zmc2V0KTtcbiAgICAgICAgY29uc3QgbGVuZ3RoID0gYnl0ZXNUb051bWJlcihjdXJzb3IucmVhZEJ5dGVzKDMyKSk7XG4gICAgICAgIC8vIElmIHRoZXJlIGlzIG5vIGxlbmd0aCwgd2UgaGF2ZSB6ZXJvIGRhdGEuXG4gICAgICAgIGlmIChsZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgIC8vIEFzIHdlIGhhdmUgZ29uZSB3b25kZXJpbmcsIHJlc3RvcmUgdG8gdGhlIG9yaWdpbmFsIHBvc2l0aW9uICsgbmV4dCBzbG90LlxuICAgICAgICAgICAgY3Vyc29yLnNldFBvc2l0aW9uKHN0YXRpY1Bvc2l0aW9uICsgMzIpO1xuICAgICAgICAgICAgcmV0dXJuIFsnMHgnLCAzMl07XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgZGF0YSA9IGN1cnNvci5yZWFkQnl0ZXMobGVuZ3RoKTtcbiAgICAgICAgLy8gQXMgd2UgaGF2ZSBnb25lIHdvbmRlcmluZywgcmVzdG9yZSB0byB0aGUgb3JpZ2luYWwgcG9zaXRpb24gKyBuZXh0IHNsb3QuXG4gICAgICAgIGN1cnNvci5zZXRQb3NpdGlvbihzdGF0aWNQb3NpdGlvbiArIDMyKTtcbiAgICAgICAgcmV0dXJuIFtieXRlc1RvSGV4KGRhdGEpLCAzMl07XG4gICAgfVxuICAgIGNvbnN0IHZhbHVlID0gYnl0ZXNUb0hleChjdXJzb3IucmVhZEJ5dGVzKE51bWJlci5wYXJzZUludChzaXplLCAxMCksIDMyKSk7XG4gICAgcmV0dXJuIFt2YWx1ZSwgMzJdO1xufVxuZnVuY3Rpb24gZGVjb2RlTnVtYmVyKGN1cnNvciwgcGFyYW0pIHtcbiAgICBjb25zdCBzaWduZWQgPSBwYXJhbS50eXBlLnN0YXJ0c1dpdGgoJ2ludCcpO1xuICAgIGNvbnN0IHNpemUgPSBOdW1iZXIucGFyc2VJbnQocGFyYW0udHlwZS5zcGxpdCgnaW50JylbMV0gfHwgJzI1NicsIDEwKTtcbiAgICBjb25zdCB2YWx1ZSA9IGN1cnNvci5yZWFkQnl0ZXMoMzIpO1xuICAgIHJldHVybiBbXG4gICAgICAgIHNpemUgPiA0OFxuICAgICAgICAgICAgPyBieXRlc1RvQmlnSW50KHZhbHVlLCB7IHNpZ25lZCB9KVxuICAgICAgICAgICAgOiBieXRlc1RvTnVtYmVyKHZhbHVlLCB7IHNpZ25lZCB9KSxcbiAgICAgICAgMzIsXG4gICAgXTtcbn1cbmZ1bmN0aW9uIGRlY29kZVR1cGxlKGN1cnNvciwgcGFyYW0sIHsgc3RhdGljUG9zaXRpb24gfSkge1xuICAgIC8vIFR1cGxlcyBjYW4gaGF2ZSB1bm5hbWVkIGNvbXBvbmVudHMgKGkuZS4gdGhleSBhcmUgYXJyYXlzKSwgc28gd2UgbXVzdFxuICAgIC8vIGRldGVybWluZSB3aGV0aGVyIHRoZSB0dXBsZSBpcyBuYW1lZCBvciB1bm5hbWVkLiBJbiB0aGUgY2FzZSBvZiBhIG5hbWVkXG4gICAgLy8gdHVwbGUsIHRoZSB2YWx1ZSB3aWxsIGJlIGFuIG9iamVjdCB3aGVyZSBlYWNoIHByb3BlcnR5IGlzIHRoZSBuYW1lIG9mIHRoZVxuICAgIC8vIGNvbXBvbmVudC4gSW4gdGhlIGNhc2Ugb2YgYW4gdW5uYW1lZCB0dXBsZSwgdGhlIHZhbHVlIHdpbGwgYmUgYW4gYXJyYXkuXG4gICAgY29uc3QgaGFzVW5uYW1lZENoaWxkID0gcGFyYW0uY29tcG9uZW50cy5sZW5ndGggPT09IDAgfHwgcGFyYW0uY29tcG9uZW50cy5zb21lKCh7IG5hbWUgfSkgPT4gIW5hbWUpO1xuICAgIC8vIEluaXRpYWxpemUgdGhlIHZhbHVlIHRvIGFuIG9iamVjdCBvciBhbiBhcnJheSwgZGVwZW5kaW5nIG9uIHdoZXRoZXIgdGhlXG4gICAgLy8gdHVwbGUgaXMgbmFtZWQgb3IgdW5uYW1lZC5cbiAgICBjb25zdCB2YWx1ZSA9IGhhc1VubmFtZWRDaGlsZCA/IFtdIDoge307XG4gICAgbGV0IGNvbnN1bWVkID0gMDtcbiAgICAvLyBJZiB0aGUgdHVwbGUgaGFzIGEgZHluYW1pYyBjaGlsZCwgd2UgbXVzdCBmaXJzdCBkZWNvZGUgdGhlIG9mZnNldCB0byB0aGVcbiAgICAvLyB0dXBsZSBkYXRhLlxuICAgIGlmIChoYXNEeW5hbWljQ2hpbGQocGFyYW0pKSB7XG4gICAgICAgIC8vIERlYWxpbmcgd2l0aCBkeW5hbWljIHR5cGVzLCBzbyBnZXQgdGhlIG9mZnNldCBvZiB0aGUgdHVwbGUgZGF0YS5cbiAgICAgICAgY29uc3Qgb2Zmc2V0ID0gYnl0ZXNUb051bWJlcihjdXJzb3IucmVhZEJ5dGVzKHNpemVPZk9mZnNldCkpO1xuICAgICAgICAvLyBTdGFydCBpcyB0aGUgc3RhdGljIHBvc2l0aW9uIG9mIHJlZmVyZW5jaW5nIHNsb3QgKyBvZmZzZXQuXG4gICAgICAgIGNvbnN0IHN0YXJ0ID0gc3RhdGljUG9zaXRpb24gKyBvZmZzZXQ7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgcGFyYW0uY29tcG9uZW50cy5sZW5ndGg7ICsraSkge1xuICAgICAgICAgICAgY29uc3QgY29tcG9uZW50ID0gcGFyYW0uY29tcG9uZW50c1tpXTtcbiAgICAgICAgICAgIGN1cnNvci5zZXRQb3NpdGlvbihzdGFydCArIGNvbnN1bWVkKTtcbiAgICAgICAgICAgIGNvbnN0IFtkYXRhLCBjb25zdW1lZF9dID0gZGVjb2RlUGFyYW1ldGVyKGN1cnNvciwgY29tcG9uZW50LCB7XG4gICAgICAgICAgICAgICAgc3RhdGljUG9zaXRpb246IHN0YXJ0LFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBjb25zdW1lZCArPSBjb25zdW1lZF87XG4gICAgICAgICAgICB2YWx1ZVtoYXNVbm5hbWVkQ2hpbGQgPyBpIDogY29tcG9uZW50Py5uYW1lXSA9IGRhdGE7XG4gICAgICAgIH1cbiAgICAgICAgLy8gQXMgd2UgaGF2ZSBnb25lIHdvbmRlcmluZywgcmVzdG9yZSB0byB0aGUgb3JpZ2luYWwgcG9zaXRpb24gKyBuZXh0IHNsb3QuXG4gICAgICAgIGN1cnNvci5zZXRQb3NpdGlvbihzdGF0aWNQb3NpdGlvbiArIDMyKTtcbiAgICAgICAgcmV0dXJuIFt2YWx1ZSwgMzJdO1xuICAgIH1cbiAgICAvLyBJZiB0aGUgdHVwbGUgaGFzIHN0YXRpYyBjaGlsZHJlbiwgd2UgY2FuIGp1c3QgZGVjb2RlIGVhY2ggY29tcG9uZW50XG4gICAgLy8gaW4gc2VxdWVuY2UuXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBwYXJhbS5jb21wb25lbnRzLmxlbmd0aDsgKytpKSB7XG4gICAgICAgIGNvbnN0IGNvbXBvbmVudCA9IHBhcmFtLmNvbXBvbmVudHNbaV07XG4gICAgICAgIGNvbnN0IFtkYXRhLCBjb25zdW1lZF9dID0gZGVjb2RlUGFyYW1ldGVyKGN1cnNvciwgY29tcG9uZW50LCB7XG4gICAgICAgICAgICBzdGF0aWNQb3NpdGlvbixcbiAgICAgICAgfSk7XG4gICAgICAgIHZhbHVlW2hhc1VubmFtZWRDaGlsZCA/IGkgOiBjb21wb25lbnQ/Lm5hbWVdID0gZGF0YTtcbiAgICAgICAgY29uc3VtZWQgKz0gY29uc3VtZWRfO1xuICAgIH1cbiAgICByZXR1cm4gW3ZhbHVlLCBjb25zdW1lZF07XG59XG5mdW5jdGlvbiBkZWNvZGVTdHJpbmcoY3Vyc29yLCB7IHN0YXRpY1Bvc2l0aW9uIH0pIHtcbiAgICAvLyBHZXQgb2Zmc2V0IHRvIHN0YXJ0IG9mIHN0cmluZyBkYXRhLlxuICAgIGNvbnN0IG9mZnNldCA9IGJ5dGVzVG9OdW1iZXIoY3Vyc29yLnJlYWRCeXRlcygzMikpO1xuICAgIC8vIFN0YXJ0IGlzIHRoZSBzdGF0aWMgcG9zaXRpb24gb2YgY3VycmVudCBzbG90ICsgb2Zmc2V0LlxuICAgIGNvbnN0IHN0YXJ0ID0gc3RhdGljUG9zaXRpb24gKyBvZmZzZXQ7XG4gICAgY3Vyc29yLnNldFBvc2l0aW9uKHN0YXJ0KTtcbiAgICBjb25zdCBsZW5ndGggPSBieXRlc1RvTnVtYmVyKGN1cnNvci5yZWFkQnl0ZXMoMzIpKTtcbiAgICAvLyBJZiB0aGVyZSBpcyBubyBsZW5ndGgsIHdlIGhhdmUgemVybyBkYXRhIChlbXB0eSBzdHJpbmcpLlxuICAgIGlmIChsZW5ndGggPT09IDApIHtcbiAgICAgICAgY3Vyc29yLnNldFBvc2l0aW9uKHN0YXRpY1Bvc2l0aW9uICsgMzIpO1xuICAgICAgICByZXR1cm4gWycnLCAzMl07XG4gICAgfVxuICAgIGNvbnN0IGRhdGEgPSBjdXJzb3IucmVhZEJ5dGVzKGxlbmd0aCwgMzIpO1xuICAgIGNvbnN0IHZhbHVlID0gYnl0ZXNUb1N0cmluZyh0cmltKGRhdGEpKTtcbiAgICAvLyBBcyB3ZSBoYXZlIGdvbmUgd29uZGVyaW5nLCByZXN0b3JlIHRvIHRoZSBvcmlnaW5hbCBwb3NpdGlvbiArIG5leHQgc2xvdC5cbiAgICBjdXJzb3Iuc2V0UG9zaXRpb24oc3RhdGljUG9zaXRpb24gKyAzMik7XG4gICAgcmV0dXJuIFt2YWx1ZSwgMzJdO1xufVxuZnVuY3Rpb24gaGFzRHluYW1pY0NoaWxkKHBhcmFtKSB7XG4gICAgY29uc3QgeyB0eXBlIH0gPSBwYXJhbTtcbiAgICBpZiAodHlwZSA9PT0gJ3N0cmluZycpXG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIGlmICh0eXBlID09PSAnYnl0ZXMnKVxuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICBpZiAodHlwZS5lbmRzV2l0aCgnW10nKSlcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgaWYgKHR5cGUgPT09ICd0dXBsZScpXG4gICAgICAgIHJldHVybiBwYXJhbS5jb21wb25lbnRzPy5zb21lKGhhc0R5bmFtaWNDaGlsZCk7XG4gICAgY29uc3QgYXJyYXlDb21wb25lbnRzID0gZ2V0QXJyYXlDb21wb25lbnRzKHBhcmFtLnR5cGUpO1xuICAgIGlmIChhcnJheUNvbXBvbmVudHMgJiZcbiAgICAgICAgaGFzRHluYW1pY0NoaWxkKHsgLi4ucGFyYW0sIHR5cGU6IGFycmF5Q29tcG9uZW50c1sxXSB9KSlcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgcmV0dXJuIGZhbHNlO1xufVxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9ZGVjb2RlQWJpUGFyYW1ldGVycy5qcy5tYXAiLAogICAgImltcG9ydCB7IHNvbGlkaXR5RXJyb3IsIHNvbGlkaXR5UGFuaWMgfSBmcm9tICcuLi8uLi9jb25zdGFudHMvc29saWRpdHkuanMnO1xuaW1wb3J0IHsgQWJpRGVjb2RpbmdaZXJvRGF0YUVycm9yLCBBYmlFcnJvclNpZ25hdHVyZU5vdEZvdW5kRXJyb3IsIH0gZnJvbSAnLi4vLi4vZXJyb3JzL2FiaS5qcyc7XG5pbXBvcnQgeyBzbGljZSB9IGZyb20gJy4uL2RhdGEvc2xpY2UuanMnO1xuaW1wb3J0IHsgdG9GdW5jdGlvblNlbGVjdG9yLCB9IGZyb20gJy4uL2hhc2gvdG9GdW5jdGlvblNlbGVjdG9yLmpzJztcbmltcG9ydCB7IGRlY29kZUFiaVBhcmFtZXRlcnMsIH0gZnJvbSAnLi9kZWNvZGVBYmlQYXJhbWV0ZXJzLmpzJztcbmltcG9ydCB7IGZvcm1hdEFiaUl0ZW0gfSBmcm9tICcuL2Zvcm1hdEFiaUl0ZW0uanMnO1xuZXhwb3J0IGZ1bmN0aW9uIGRlY29kZUVycm9yUmVzdWx0KHBhcmFtZXRlcnMpIHtcbiAgICBjb25zdCB7IGFiaSwgZGF0YSB9ID0gcGFyYW1ldGVycztcbiAgICBjb25zdCBzaWduYXR1cmUgPSBzbGljZShkYXRhLCAwLCA0KTtcbiAgICBpZiAoc2lnbmF0dXJlID09PSAnMHgnKVxuICAgICAgICB0aHJvdyBuZXcgQWJpRGVjb2RpbmdaZXJvRGF0YUVycm9yKCk7XG4gICAgY29uc3QgYWJpXyA9IFsuLi4oYWJpIHx8IFtdKSwgc29saWRpdHlFcnJvciwgc29saWRpdHlQYW5pY107XG4gICAgY29uc3QgYWJpSXRlbSA9IGFiaV8uZmluZCgoeCkgPT4geC50eXBlID09PSAnZXJyb3InICYmIHNpZ25hdHVyZSA9PT0gdG9GdW5jdGlvblNlbGVjdG9yKGZvcm1hdEFiaUl0ZW0oeCkpKTtcbiAgICBpZiAoIWFiaUl0ZW0pXG4gICAgICAgIHRocm93IG5ldyBBYmlFcnJvclNpZ25hdHVyZU5vdEZvdW5kRXJyb3Ioc2lnbmF0dXJlLCB7XG4gICAgICAgICAgICBkb2NzUGF0aDogJy9kb2NzL2NvbnRyYWN0L2RlY29kZUVycm9yUmVzdWx0JyxcbiAgICAgICAgfSk7XG4gICAgcmV0dXJuIHtcbiAgICAgICAgYWJpSXRlbSxcbiAgICAgICAgYXJnczogJ2lucHV0cycgaW4gYWJpSXRlbSAmJiBhYmlJdGVtLmlucHV0cyAmJiBhYmlJdGVtLmlucHV0cy5sZW5ndGggPiAwXG4gICAgICAgICAgICA/IGRlY29kZUFiaVBhcmFtZXRlcnMoYWJpSXRlbS5pbnB1dHMsIHNsaWNlKGRhdGEsIDQpKVxuICAgICAgICAgICAgOiB1bmRlZmluZWQsXG4gICAgICAgIGVycm9yTmFtZTogYWJpSXRlbS5uYW1lLFxuICAgIH07XG59XG4vLyMgc291cmNlTWFwcGluZ1VSTD1kZWNvZGVFcnJvclJlc3VsdC5qcy5tYXAiLAogICAgImV4cG9ydCBjb25zdCBzdHJpbmdpZnkgPSAodmFsdWUsIHJlcGxhY2VyLCBzcGFjZSkgPT4gSlNPTi5zdHJpbmdpZnkodmFsdWUsIChrZXksIHZhbHVlXykgPT4ge1xuICAgIGNvbnN0IHZhbHVlID0gdHlwZW9mIHZhbHVlXyA9PT0gJ2JpZ2ludCcgPyB2YWx1ZV8udG9TdHJpbmcoKSA6IHZhbHVlXztcbiAgICByZXR1cm4gdHlwZW9mIHJlcGxhY2VyID09PSAnZnVuY3Rpb24nID8gcmVwbGFjZXIoa2V5LCB2YWx1ZSkgOiB2YWx1ZTtcbn0sIHNwYWNlKTtcbi8vIyBzb3VyY2VNYXBwaW5nVVJMPXN0cmluZ2lmeS5qcy5tYXAiLAogICAgImltcG9ydCB7IHN0cmluZ2lmeSB9IGZyb20gJy4uL3N0cmluZ2lmeS5qcyc7XG5leHBvcnQgZnVuY3Rpb24gZm9ybWF0QWJpSXRlbVdpdGhBcmdzKHsgYWJpSXRlbSwgYXJncywgaW5jbHVkZUZ1bmN0aW9uTmFtZSA9IHRydWUsIGluY2x1ZGVOYW1lID0gZmFsc2UsIH0pIHtcbiAgICBpZiAoISgnbmFtZScgaW4gYWJpSXRlbSkpXG4gICAgICAgIHJldHVybjtcbiAgICBpZiAoISgnaW5wdXRzJyBpbiBhYmlJdGVtKSlcbiAgICAgICAgcmV0dXJuO1xuICAgIGlmICghYWJpSXRlbS5pbnB1dHMpXG4gICAgICAgIHJldHVybjtcbiAgICByZXR1cm4gYCR7aW5jbHVkZUZ1bmN0aW9uTmFtZSA/IGFiaUl0ZW0ubmFtZSA6ICcnfSgke2FiaUl0ZW0uaW5wdXRzXG4gICAgICAgIC5tYXAoKGlucHV0LCBpKSA9PiBgJHtpbmNsdWRlTmFtZSAmJiBpbnB1dC5uYW1lID8gYCR7aW5wdXQubmFtZX06IGAgOiAnJ30ke3R5cGVvZiBhcmdzW2ldID09PSAnb2JqZWN0JyA/IHN0cmluZ2lmeShhcmdzW2ldKSA6IGFyZ3NbaV19YClcbiAgICAgICAgLmpvaW4oJywgJyl9KWA7XG59XG4vLyMgc291cmNlTWFwcGluZ1VSTD1mb3JtYXRBYmlJdGVtV2l0aEFyZ3MuanMubWFwIiwKICAgICJpbXBvcnQgeyB0b1NpZ25hdHVyZUhhc2gsIH0gZnJvbSAnLi90b1NpZ25hdHVyZUhhc2guanMnO1xuLyoqXG4gKiBSZXR1cm5zIHRoZSBldmVudCBzZWxlY3RvciBmb3IgYSBnaXZlbiBldmVudCBkZWZpbml0aW9uLlxuICpcbiAqIEBleGFtcGxlXG4gKiBjb25zdCBzZWxlY3RvciA9IHRvRXZlbnRTZWxlY3RvcignVHJhbnNmZXIoYWRkcmVzcyBpbmRleGVkIGZyb20sIGFkZHJlc3MgaW5kZXhlZCB0bywgdWludDI1NiBhbW91bnQpJylcbiAqIC8vIDB4ZGRmMjUyYWQxYmUyYzg5YjY5YzJiMDY4ZmMzNzhkYWE5NTJiYTdmMTYzYzRhMTE2MjhmNTVhNGRmNTIzYjNlZlxuICovXG5leHBvcnQgY29uc3QgdG9FdmVudFNlbGVjdG9yID0gdG9TaWduYXR1cmVIYXNoO1xuLy8jIHNvdXJjZU1hcHBpbmdVUkw9dG9FdmVudFNlbGVjdG9yLmpzLm1hcCIsCiAgICAiaW1wb3J0IHsgQWJpSXRlbUFtYmlndWl0eUVycm9yLCB9IGZyb20gJy4uLy4uL2Vycm9ycy9hYmkuanMnO1xuaW1wb3J0IHsgaXNIZXggfSBmcm9tICcuLi8uLi91dGlscy9kYXRhL2lzSGV4LmpzJztcbmltcG9ydCB7IGlzQWRkcmVzcyB9IGZyb20gJy4uL2FkZHJlc3MvaXNBZGRyZXNzLmpzJztcbmltcG9ydCB7IHRvRXZlbnRTZWxlY3RvciB9IGZyb20gJy4uL2hhc2gvdG9FdmVudFNlbGVjdG9yLmpzJztcbmltcG9ydCB7IHRvRnVuY3Rpb25TZWxlY3RvciwgfSBmcm9tICcuLi9oYXNoL3RvRnVuY3Rpb25TZWxlY3Rvci5qcyc7XG5leHBvcnQgZnVuY3Rpb24gZ2V0QWJpSXRlbShwYXJhbWV0ZXJzKSB7XG4gICAgY29uc3QgeyBhYmksIGFyZ3MgPSBbXSwgbmFtZSB9ID0gcGFyYW1ldGVycztcbiAgICBjb25zdCBpc1NlbGVjdG9yID0gaXNIZXgobmFtZSwgeyBzdHJpY3Q6IGZhbHNlIH0pO1xuICAgIGNvbnN0IGFiaUl0ZW1zID0gYWJpLmZpbHRlcigoYWJpSXRlbSkgPT4ge1xuICAgICAgICBpZiAoaXNTZWxlY3Rvcikge1xuICAgICAgICAgICAgaWYgKGFiaUl0ZW0udHlwZSA9PT0gJ2Z1bmN0aW9uJylcbiAgICAgICAgICAgICAgICByZXR1cm4gdG9GdW5jdGlvblNlbGVjdG9yKGFiaUl0ZW0pID09PSBuYW1lO1xuICAgICAgICAgICAgaWYgKGFiaUl0ZW0udHlwZSA9PT0gJ2V2ZW50JylcbiAgICAgICAgICAgICAgICByZXR1cm4gdG9FdmVudFNlbGVjdG9yKGFiaUl0ZW0pID09PSBuYW1lO1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiAnbmFtZScgaW4gYWJpSXRlbSAmJiBhYmlJdGVtLm5hbWUgPT09IG5hbWU7XG4gICAgfSk7XG4gICAgaWYgKGFiaUl0ZW1zLmxlbmd0aCA9PT0gMClcbiAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICBpZiAoYWJpSXRlbXMubGVuZ3RoID09PSAxKVxuICAgICAgICByZXR1cm4gYWJpSXRlbXNbMF07XG4gICAgbGV0IG1hdGNoZWRBYmlJdGVtO1xuICAgIGZvciAoY29uc3QgYWJpSXRlbSBvZiBhYmlJdGVtcykge1xuICAgICAgICBpZiAoISgnaW5wdXRzJyBpbiBhYmlJdGVtKSlcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICBpZiAoIWFyZ3MgfHwgYXJncy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgIGlmICghYWJpSXRlbS5pbnB1dHMgfHwgYWJpSXRlbS5pbnB1dHMubGVuZ3RoID09PSAwKVxuICAgICAgICAgICAgICAgIHJldHVybiBhYmlJdGVtO1xuICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCFhYmlJdGVtLmlucHV0cylcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICBpZiAoYWJpSXRlbS5pbnB1dHMubGVuZ3RoID09PSAwKVxuICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgIGlmIChhYmlJdGVtLmlucHV0cy5sZW5ndGggIT09IGFyZ3MubGVuZ3RoKVxuICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgIGNvbnN0IG1hdGNoZWQgPSBhcmdzLmV2ZXJ5KChhcmcsIGluZGV4KSA9PiB7XG4gICAgICAgICAgICBjb25zdCBhYmlQYXJhbWV0ZXIgPSAnaW5wdXRzJyBpbiBhYmlJdGVtICYmIGFiaUl0ZW0uaW5wdXRzW2luZGV4XTtcbiAgICAgICAgICAgIGlmICghYWJpUGFyYW1ldGVyKVxuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIHJldHVybiBpc0FyZ09mVHlwZShhcmcsIGFiaVBhcmFtZXRlcik7XG4gICAgICAgIH0pO1xuICAgICAgICBpZiAobWF0Y2hlZCkge1xuICAgICAgICAgICAgLy8gQ2hlY2sgZm9yIGFtYmlndWl0eSBhZ2FpbnN0IGFscmVhZHkgbWF0Y2hlZCBwYXJhbWV0ZXJzIChlLmcuIGBhZGRyZXNzYCB2cyBgYnl0ZXMyMGApLlxuICAgICAgICAgICAgaWYgKG1hdGNoZWRBYmlJdGVtICYmXG4gICAgICAgICAgICAgICAgJ2lucHV0cycgaW4gbWF0Y2hlZEFiaUl0ZW0gJiZcbiAgICAgICAgICAgICAgICBtYXRjaGVkQWJpSXRlbS5pbnB1dHMpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBhbWJpZ3VvdXNUeXBlcyA9IGdldEFtYmlndW91c1R5cGVzKGFiaUl0ZW0uaW5wdXRzLCBtYXRjaGVkQWJpSXRlbS5pbnB1dHMsIGFyZ3MpO1xuICAgICAgICAgICAgICAgIGlmIChhbWJpZ3VvdXNUeXBlcylcbiAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IEFiaUl0ZW1BbWJpZ3VpdHlFcnJvcih7XG4gICAgICAgICAgICAgICAgICAgICAgICBhYmlJdGVtLFxuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogYW1iaWd1b3VzVHlwZXNbMF0sXG4gICAgICAgICAgICAgICAgICAgIH0sIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGFiaUl0ZW06IG1hdGNoZWRBYmlJdGVtLFxuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogYW1iaWd1b3VzVHlwZXNbMV0sXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgbWF0Y2hlZEFiaUl0ZW0gPSBhYmlJdGVtO1xuICAgICAgICB9XG4gICAgfVxuICAgIGlmIChtYXRjaGVkQWJpSXRlbSlcbiAgICAgICAgcmV0dXJuIG1hdGNoZWRBYmlJdGVtO1xuICAgIHJldHVybiBhYmlJdGVtc1swXTtcbn1cbi8qKiBAaW50ZXJuYWwgKi9cbmV4cG9ydCBmdW5jdGlvbiBpc0FyZ09mVHlwZShhcmcsIGFiaVBhcmFtZXRlcikge1xuICAgIGNvbnN0IGFyZ1R5cGUgPSB0eXBlb2YgYXJnO1xuICAgIGNvbnN0IGFiaVBhcmFtZXRlclR5cGUgPSBhYmlQYXJhbWV0ZXIudHlwZTtcbiAgICBzd2l0Y2ggKGFiaVBhcmFtZXRlclR5cGUpIHtcbiAgICAgICAgY2FzZSAnYWRkcmVzcyc6XG4gICAgICAgICAgICByZXR1cm4gaXNBZGRyZXNzKGFyZywgeyBzdHJpY3Q6IGZhbHNlIH0pO1xuICAgICAgICBjYXNlICdib29sJzpcbiAgICAgICAgICAgIHJldHVybiBhcmdUeXBlID09PSAnYm9vbGVhbic7XG4gICAgICAgIGNhc2UgJ2Z1bmN0aW9uJzpcbiAgICAgICAgICAgIHJldHVybiBhcmdUeXBlID09PSAnc3RyaW5nJztcbiAgICAgICAgY2FzZSAnc3RyaW5nJzpcbiAgICAgICAgICAgIHJldHVybiBhcmdUeXBlID09PSAnc3RyaW5nJztcbiAgICAgICAgZGVmYXVsdDoge1xuICAgICAgICAgICAgaWYgKGFiaVBhcmFtZXRlclR5cGUgPT09ICd0dXBsZScgJiYgJ2NvbXBvbmVudHMnIGluIGFiaVBhcmFtZXRlcilcbiAgICAgICAgICAgICAgICByZXR1cm4gT2JqZWN0LnZhbHVlcyhhYmlQYXJhbWV0ZXIuY29tcG9uZW50cykuZXZlcnkoKGNvbXBvbmVudCwgaW5kZXgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGlzQXJnT2ZUeXBlKE9iamVjdC52YWx1ZXMoYXJnKVtpbmRleF0sIGNvbXBvbmVudCk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAvLyBgKHUpaW50PE0+YDogKHVuKXNpZ25lZCBpbnRlZ2VyIHR5cGUgb2YgYE1gIGJpdHMsIGAwIDwgTSA8PSAyNTZgLCBgTSAlIDggPT0gMGBcbiAgICAgICAgICAgIC8vIGh0dHBzOi8vcmVnZXhyLmNvbS82djhocFxuICAgICAgICAgICAgaWYgKC9edT9pbnQoOHwxNnwyNHwzMnw0MHw0OHw1Nnw2NHw3Mnw4MHw4OHw5NnwxMDR8MTEyfDEyMHwxMjh8MTM2fDE0NHwxNTJ8MTYwfDE2OHwxNzZ8MTg0fDE5MnwyMDB8MjA4fDIxNnwyMjR8MjMyfDI0MHwyNDh8MjU2KT8kLy50ZXN0KGFiaVBhcmFtZXRlclR5cGUpKVxuICAgICAgICAgICAgICAgIHJldHVybiBhcmdUeXBlID09PSAnbnVtYmVyJyB8fCBhcmdUeXBlID09PSAnYmlnaW50JztcbiAgICAgICAgICAgIC8vIGBieXRlczxNPmA6IGJpbmFyeSB0eXBlIG9mIGBNYCBieXRlcywgYDAgPCBNIDw9IDMyYFxuICAgICAgICAgICAgLy8gaHR0cHM6Ly9yZWdleHIuY29tLzZ2YTU1XG4gICAgICAgICAgICBpZiAoL15ieXRlcyhbMS05XXwxWzAtOV18MlswLTldfDNbMC0yXSk/JC8udGVzdChhYmlQYXJhbWV0ZXJUeXBlKSlcbiAgICAgICAgICAgICAgICByZXR1cm4gYXJnVHlwZSA9PT0gJ3N0cmluZycgfHwgYXJnIGluc3RhbmNlb2YgVWludDhBcnJheTtcbiAgICAgICAgICAgIC8vIGZpeGVkLWxlbmd0aCAoYDx0eXBlPltNXWApIGFuZCBkeW5hbWljIChgPHR5cGU+W11gKSBhcnJheXNcbiAgICAgICAgICAgIC8vIGh0dHBzOi8vcmVnZXhyLmNvbS82dmE2aVxuICAgICAgICAgICAgaWYgKC9bYS16XStbMS05XXswLDN9KFxcW1swLTldezAsfVxcXSkrJC8udGVzdChhYmlQYXJhbWV0ZXJUeXBlKSkge1xuICAgICAgICAgICAgICAgIHJldHVybiAoQXJyYXkuaXNBcnJheShhcmcpICYmXG4gICAgICAgICAgICAgICAgICAgIGFyZy5ldmVyeSgoeCkgPT4gaXNBcmdPZlR5cGUoeCwge1xuICAgICAgICAgICAgICAgICAgICAgICAgLi4uYWJpUGFyYW1ldGVyLFxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gUG9wIG9mZiBgW11gIG9yIGBbTV1gIGZyb20gZW5kIG9mIHR5cGVcbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU6IGFiaVBhcmFtZXRlclR5cGUucmVwbGFjZSgvKFxcW1swLTldezAsfVxcXSkkLywgJycpLFxuICAgICAgICAgICAgICAgICAgICB9KSkpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgfVxufVxuLyoqIEBpbnRlcm5hbCAqL1xuZXhwb3J0IGZ1bmN0aW9uIGdldEFtYmlndW91c1R5cGVzKHNvdXJjZVBhcmFtZXRlcnMsIHRhcmdldFBhcmFtZXRlcnMsIGFyZ3MpIHtcbiAgICBmb3IgKGNvbnN0IHBhcmFtZXRlckluZGV4IGluIHNvdXJjZVBhcmFtZXRlcnMpIHtcbiAgICAgICAgY29uc3Qgc291cmNlUGFyYW1ldGVyID0gc291cmNlUGFyYW1ldGVyc1twYXJhbWV0ZXJJbmRleF07XG4gICAgICAgIGNvbnN0IHRhcmdldFBhcmFtZXRlciA9IHRhcmdldFBhcmFtZXRlcnNbcGFyYW1ldGVySW5kZXhdO1xuICAgICAgICBpZiAoc291cmNlUGFyYW1ldGVyLnR5cGUgPT09ICd0dXBsZScgJiZcbiAgICAgICAgICAgIHRhcmdldFBhcmFtZXRlci50eXBlID09PSAndHVwbGUnICYmXG4gICAgICAgICAgICAnY29tcG9uZW50cycgaW4gc291cmNlUGFyYW1ldGVyICYmXG4gICAgICAgICAgICAnY29tcG9uZW50cycgaW4gdGFyZ2V0UGFyYW1ldGVyKVxuICAgICAgICAgICAgcmV0dXJuIGdldEFtYmlndW91c1R5cGVzKHNvdXJjZVBhcmFtZXRlci5jb21wb25lbnRzLCB0YXJnZXRQYXJhbWV0ZXIuY29tcG9uZW50cywgYXJnc1twYXJhbWV0ZXJJbmRleF0pO1xuICAgICAgICBjb25zdCB0eXBlcyA9IFtzb3VyY2VQYXJhbWV0ZXIudHlwZSwgdGFyZ2V0UGFyYW1ldGVyLnR5cGVdO1xuICAgICAgICBjb25zdCBhbWJpZ3VvdXMgPSAoKCkgPT4ge1xuICAgICAgICAgICAgaWYgKHR5cGVzLmluY2x1ZGVzKCdhZGRyZXNzJykgJiYgdHlwZXMuaW5jbHVkZXMoJ2J5dGVzMjAnKSlcbiAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgIGlmICh0eXBlcy5pbmNsdWRlcygnYWRkcmVzcycpICYmIHR5cGVzLmluY2x1ZGVzKCdzdHJpbmcnKSlcbiAgICAgICAgICAgICAgICByZXR1cm4gaXNBZGRyZXNzKGFyZ3NbcGFyYW1ldGVySW5kZXhdLCB7IHN0cmljdDogZmFsc2UgfSk7XG4gICAgICAgICAgICBpZiAodHlwZXMuaW5jbHVkZXMoJ2FkZHJlc3MnKSAmJiB0eXBlcy5pbmNsdWRlcygnYnl0ZXMnKSlcbiAgICAgICAgICAgICAgICByZXR1cm4gaXNBZGRyZXNzKGFyZ3NbcGFyYW1ldGVySW5kZXhdLCB7IHN0cmljdDogZmFsc2UgfSk7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH0pKCk7XG4gICAgICAgIGlmIChhbWJpZ3VvdXMpXG4gICAgICAgICAgICByZXR1cm4gdHlwZXM7XG4gICAgfVxuICAgIHJldHVybjtcbn1cbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWdldEFiaUl0ZW0uanMubWFwIiwKICAgICJleHBvcnQgY29uc3QgZXRoZXJVbml0cyA9IHtcbiAgICBnd2VpOiA5LFxuICAgIHdlaTogMTgsXG59O1xuZXhwb3J0IGNvbnN0IGd3ZWlVbml0cyA9IHtcbiAgICBldGhlcjogLTksXG4gICAgd2VpOiA5LFxufTtcbmV4cG9ydCBjb25zdCB3ZWlVbml0cyA9IHtcbiAgICBldGhlcjogLTE4LFxuICAgIGd3ZWk6IC05LFxufTtcbi8vIyBzb3VyY2VNYXBwaW5nVVJMPXVuaXQuanMubWFwIiwKICAgICIvKipcbiAqICBEaXZpZGVzIGEgbnVtYmVyIGJ5IGEgZ2l2ZW4gZXhwb25lbnQgb2YgYmFzZSAxMCAoMTBleHBvbmVudCksIGFuZCBmb3JtYXRzIGl0IGludG8gYSBzdHJpbmcgcmVwcmVzZW50YXRpb24gb2YgdGhlIG51bWJlci4uXG4gKlxuICogLSBEb2NzOiBodHRwczovL3ZpZW0uc2gvZG9jcy91dGlsaXRpZXMvZm9ybWF0VW5pdHNcbiAqXG4gKiBAZXhhbXBsZVxuICogaW1wb3J0IHsgZm9ybWF0VW5pdHMgfSBmcm9tICd2aWVtJ1xuICpcbiAqIGZvcm1hdFVuaXRzKDQyMDAwMDAwMDAwMG4sIDkpXG4gKiAvLyAnNDIwJ1xuICovXG5leHBvcnQgZnVuY3Rpb24gZm9ybWF0VW5pdHModmFsdWUsIGRlY2ltYWxzKSB7XG4gICAgbGV0IGRpc3BsYXkgPSB2YWx1ZS50b1N0cmluZygpO1xuICAgIGNvbnN0IG5lZ2F0aXZlID0gZGlzcGxheS5zdGFydHNXaXRoKCctJyk7XG4gICAgaWYgKG5lZ2F0aXZlKVxuICAgICAgICBkaXNwbGF5ID0gZGlzcGxheS5zbGljZSgxKTtcbiAgICBkaXNwbGF5ID0gZGlzcGxheS5wYWRTdGFydChkZWNpbWFscywgJzAnKTtcbiAgICBsZXQgW2ludGVnZXIsIGZyYWN0aW9uXSA9IFtcbiAgICAgICAgZGlzcGxheS5zbGljZSgwLCBkaXNwbGF5Lmxlbmd0aCAtIGRlY2ltYWxzKSxcbiAgICAgICAgZGlzcGxheS5zbGljZShkaXNwbGF5Lmxlbmd0aCAtIGRlY2ltYWxzKSxcbiAgICBdO1xuICAgIGZyYWN0aW9uID0gZnJhY3Rpb24ucmVwbGFjZSgvKDArKSQvLCAnJyk7XG4gICAgcmV0dXJuIGAke25lZ2F0aXZlID8gJy0nIDogJyd9JHtpbnRlZ2VyIHx8ICcwJ30ke2ZyYWN0aW9uID8gYC4ke2ZyYWN0aW9ufWAgOiAnJ31gO1xufVxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9Zm9ybWF0VW5pdHMuanMubWFwIiwKICAgICJpbXBvcnQgeyBldGhlclVuaXRzIH0gZnJvbSAnLi4vLi4vY29uc3RhbnRzL3VuaXQuanMnO1xuaW1wb3J0IHsgZm9ybWF0VW5pdHMgfSBmcm9tICcuL2Zvcm1hdFVuaXRzLmpzJztcbi8qKlxuICogQ29udmVydHMgbnVtZXJpY2FsIHdlaSB0byBhIHN0cmluZyByZXByZXNlbnRhdGlvbiBvZiBldGhlci5cbiAqXG4gKiAtIERvY3M6IGh0dHBzOi8vdmllbS5zaC9kb2NzL3V0aWxpdGllcy9mb3JtYXRFdGhlclxuICpcbiAqIEBleGFtcGxlXG4gKiBpbXBvcnQgeyBmb3JtYXRFdGhlciB9IGZyb20gJ3ZpZW0nXG4gKlxuICogZm9ybWF0RXRoZXIoMTAwMDAwMDAwMDAwMDAwMDAwMG4pXG4gKiAvLyAnMSdcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGZvcm1hdEV0aGVyKHdlaSwgdW5pdCA9ICd3ZWknKSB7XG4gICAgcmV0dXJuIGZvcm1hdFVuaXRzKHdlaSwgZXRoZXJVbml0c1t1bml0XSk7XG59XG4vLyMgc291cmNlTWFwcGluZ1VSTD1mb3JtYXRFdGhlci5qcy5tYXAiLAogICAgImltcG9ydCB7IGd3ZWlVbml0cyB9IGZyb20gJy4uLy4uL2NvbnN0YW50cy91bml0LmpzJztcbmltcG9ydCB7IGZvcm1hdFVuaXRzIH0gZnJvbSAnLi9mb3JtYXRVbml0cy5qcyc7XG4vKipcbiAqIENvbnZlcnRzIG51bWVyaWNhbCB3ZWkgdG8gYSBzdHJpbmcgcmVwcmVzZW50YXRpb24gb2YgZ3dlaS5cbiAqXG4gKiAtIERvY3M6IGh0dHBzOi8vdmllbS5zaC9kb2NzL3V0aWxpdGllcy9mb3JtYXRHd2VpXG4gKlxuICogQGV4YW1wbGVcbiAqIGltcG9ydCB7IGZvcm1hdEd3ZWkgfSBmcm9tICd2aWVtJ1xuICpcbiAqIGZvcm1hdEd3ZWkoMTAwMDAwMDAwMG4pXG4gKiAvLyAnMSdcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGZvcm1hdEd3ZWkod2VpLCB1bml0ID0gJ3dlaScpIHtcbiAgICByZXR1cm4gZm9ybWF0VW5pdHMod2VpLCBnd2VpVW5pdHNbdW5pdF0pO1xufVxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9Zm9ybWF0R3dlaS5qcy5tYXAiLAogICAgImltcG9ydCB7IEJhc2VFcnJvciB9IGZyb20gJy4vYmFzZS5qcyc7XG5leHBvcnQgY2xhc3MgQWNjb3VudFN0YXRlQ29uZmxpY3RFcnJvciBleHRlbmRzIEJhc2VFcnJvciB7XG4gICAgY29uc3RydWN0b3IoeyBhZGRyZXNzIH0pIHtcbiAgICAgICAgc3VwZXIoYFN0YXRlIGZvciBhY2NvdW50IFwiJHthZGRyZXNzfVwiIGlzIHNldCBtdWx0aXBsZSB0aW1lcy5gLCB7XG4gICAgICAgICAgICBuYW1lOiAnQWNjb3VudFN0YXRlQ29uZmxpY3RFcnJvcicsXG4gICAgICAgIH0pO1xuICAgIH1cbn1cbmV4cG9ydCBjbGFzcyBTdGF0ZUFzc2lnbm1lbnRDb25mbGljdEVycm9yIGV4dGVuZHMgQmFzZUVycm9yIHtcbiAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgc3VwZXIoJ3N0YXRlIGFuZCBzdGF0ZURpZmYgYXJlIHNldCBvbiB0aGUgc2FtZSBhY2NvdW50LicsIHtcbiAgICAgICAgICAgIG5hbWU6ICdTdGF0ZUFzc2lnbm1lbnRDb25mbGljdEVycm9yJyxcbiAgICAgICAgfSk7XG4gICAgfVxufVxuLyoqIEBpbnRlcm5hbCAqL1xuZXhwb3J0IGZ1bmN0aW9uIHByZXR0eVN0YXRlTWFwcGluZyhzdGF0ZU1hcHBpbmcpIHtcbiAgICByZXR1cm4gc3RhdGVNYXBwaW5nLnJlZHVjZSgocHJldHR5LCB7IHNsb3QsIHZhbHVlIH0pID0+IHtcbiAgICAgICAgcmV0dXJuIGAke3ByZXR0eX0gICAgICAgICR7c2xvdH06ICR7dmFsdWV9XFxuYDtcbiAgICB9LCAnJyk7XG59XG5leHBvcnQgZnVuY3Rpb24gcHJldHR5U3RhdGVPdmVycmlkZShzdGF0ZU92ZXJyaWRlKSB7XG4gICAgcmV0dXJuIHN0YXRlT3ZlcnJpZGVcbiAgICAgICAgLnJlZHVjZSgocHJldHR5LCB7IGFkZHJlc3MsIC4uLnN0YXRlIH0pID0+IHtcbiAgICAgICAgbGV0IHZhbCA9IGAke3ByZXR0eX0gICAgJHthZGRyZXNzfTpcXG5gO1xuICAgICAgICBpZiAoc3RhdGUubm9uY2UpXG4gICAgICAgICAgICB2YWwgKz0gYCAgICAgIG5vbmNlOiAke3N0YXRlLm5vbmNlfVxcbmA7XG4gICAgICAgIGlmIChzdGF0ZS5iYWxhbmNlKVxuICAgICAgICAgICAgdmFsICs9IGAgICAgICBiYWxhbmNlOiAke3N0YXRlLmJhbGFuY2V9XFxuYDtcbiAgICAgICAgaWYgKHN0YXRlLmNvZGUpXG4gICAgICAgICAgICB2YWwgKz0gYCAgICAgIGNvZGU6ICR7c3RhdGUuY29kZX1cXG5gO1xuICAgICAgICBpZiAoc3RhdGUuc3RhdGUpIHtcbiAgICAgICAgICAgIHZhbCArPSAnICAgICAgc3RhdGU6XFxuJztcbiAgICAgICAgICAgIHZhbCArPSBwcmV0dHlTdGF0ZU1hcHBpbmcoc3RhdGUuc3RhdGUpO1xuICAgICAgICB9XG4gICAgICAgIGlmIChzdGF0ZS5zdGF0ZURpZmYpIHtcbiAgICAgICAgICAgIHZhbCArPSAnICAgICAgc3RhdGVEaWZmOlxcbic7XG4gICAgICAgICAgICB2YWwgKz0gcHJldHR5U3RhdGVNYXBwaW5nKHN0YXRlLnN0YXRlRGlmZik7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHZhbDtcbiAgICB9LCAnICBTdGF0ZSBPdmVycmlkZTpcXG4nKVxuICAgICAgICAuc2xpY2UoMCwgLTEpO1xufVxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9c3RhdGVPdmVycmlkZS5qcy5tYXAiLAogICAgImltcG9ydCB7IGZvcm1hdEV0aGVyIH0gZnJvbSAnLi4vdXRpbHMvdW5pdC9mb3JtYXRFdGhlci5qcyc7XG5pbXBvcnQgeyBmb3JtYXRHd2VpIH0gZnJvbSAnLi4vdXRpbHMvdW5pdC9mb3JtYXRHd2VpLmpzJztcbmltcG9ydCB7IEJhc2VFcnJvciB9IGZyb20gJy4vYmFzZS5qcyc7XG5leHBvcnQgZnVuY3Rpb24gcHJldHR5UHJpbnQoYXJncykge1xuICAgIGNvbnN0IGVudHJpZXMgPSBPYmplY3QuZW50cmllcyhhcmdzKVxuICAgICAgICAubWFwKChba2V5LCB2YWx1ZV0pID0+IHtcbiAgICAgICAgaWYgKHZhbHVlID09PSB1bmRlZmluZWQgfHwgdmFsdWUgPT09IGZhbHNlKVxuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIHJldHVybiBba2V5LCB2YWx1ZV07XG4gICAgfSlcbiAgICAgICAgLmZpbHRlcihCb29sZWFuKTtcbiAgICBjb25zdCBtYXhMZW5ndGggPSBlbnRyaWVzLnJlZHVjZSgoYWNjLCBba2V5XSkgPT4gTWF0aC5tYXgoYWNjLCBrZXkubGVuZ3RoKSwgMCk7XG4gICAgcmV0dXJuIGVudHJpZXNcbiAgICAgICAgLm1hcCgoW2tleSwgdmFsdWVdKSA9PiBgICAke2Ake2tleX06YC5wYWRFbmQobWF4TGVuZ3RoICsgMSl9ICAke3ZhbHVlfWApXG4gICAgICAgIC5qb2luKCdcXG4nKTtcbn1cbmV4cG9ydCBjbGFzcyBGZWVDb25mbGljdEVycm9yIGV4dGVuZHMgQmFzZUVycm9yIHtcbiAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgc3VwZXIoW1xuICAgICAgICAgICAgJ0Nhbm5vdCBzcGVjaWZ5IGJvdGggYSBgZ2FzUHJpY2VgIGFuZCBhIGBtYXhGZWVQZXJHYXNgL2BtYXhQcmlvcml0eUZlZVBlckdhc2AuJyxcbiAgICAgICAgICAgICdVc2UgYG1heEZlZVBlckdhc2AvYG1heFByaW9yaXR5RmVlUGVyR2FzYCBmb3IgRUlQLTE1NTkgY29tcGF0aWJsZSBuZXR3b3JrcywgYW5kIGBnYXNQcmljZWAgZm9yIG90aGVycy4nLFxuICAgICAgICBdLmpvaW4oJ1xcbicpLCB7IG5hbWU6ICdGZWVDb25mbGljdEVycm9yJyB9KTtcbiAgICB9XG59XG5leHBvcnQgY2xhc3MgSW52YWxpZExlZ2FjeVZFcnJvciBleHRlbmRzIEJhc2VFcnJvciB7XG4gICAgY29uc3RydWN0b3IoeyB2IH0pIHtcbiAgICAgICAgc3VwZXIoYEludmFsaWQgXFxgdlxcYCB2YWx1ZSBcIiR7dn1cIi4gRXhwZWN0ZWQgMjcgb3IgMjguYCwge1xuICAgICAgICAgICAgbmFtZTogJ0ludmFsaWRMZWdhY3lWRXJyb3InLFxuICAgICAgICB9KTtcbiAgICB9XG59XG5leHBvcnQgY2xhc3MgSW52YWxpZFNlcmlhbGl6YWJsZVRyYW5zYWN0aW9uRXJyb3IgZXh0ZW5kcyBCYXNlRXJyb3Ige1xuICAgIGNvbnN0cnVjdG9yKHsgdHJhbnNhY3Rpb24gfSkge1xuICAgICAgICBzdXBlcignQ2Fubm90IGluZmVyIGEgdHJhbnNhY3Rpb24gdHlwZSBmcm9tIHByb3ZpZGVkIHRyYW5zYWN0aW9uLicsIHtcbiAgICAgICAgICAgIG1ldGFNZXNzYWdlczogW1xuICAgICAgICAgICAgICAgICdQcm92aWRlZCBUcmFuc2FjdGlvbjonLFxuICAgICAgICAgICAgICAgICd7JyxcbiAgICAgICAgICAgICAgICBwcmV0dHlQcmludCh0cmFuc2FjdGlvbiksXG4gICAgICAgICAgICAgICAgJ30nLFxuICAgICAgICAgICAgICAgICcnLFxuICAgICAgICAgICAgICAgICdUbyBpbmZlciB0aGUgdHlwZSwgZWl0aGVyIHByb3ZpZGU6JyxcbiAgICAgICAgICAgICAgICAnLSBhIGB0eXBlYCB0byB0aGUgVHJhbnNhY3Rpb24sIG9yJyxcbiAgICAgICAgICAgICAgICAnLSBhbiBFSVAtMTU1OSBUcmFuc2FjdGlvbiB3aXRoIGBtYXhGZWVQZXJHYXNgLCBvcicsXG4gICAgICAgICAgICAgICAgJy0gYW4gRUlQLTI5MzAgVHJhbnNhY3Rpb24gd2l0aCBgZ2FzUHJpY2VgICYgYGFjY2Vzc0xpc3RgLCBvcicsXG4gICAgICAgICAgICAgICAgJy0gYW4gRUlQLTQ4NDQgVHJhbnNhY3Rpb24gd2l0aCBgYmxvYnNgLCBgYmxvYlZlcnNpb25lZEhhc2hlc2AsIGBzaWRlY2Fyc2AsIG9yJyxcbiAgICAgICAgICAgICAgICAnLSBhbiBFSVAtNzcwMiBUcmFuc2FjdGlvbiB3aXRoIGBhdXRob3JpemF0aW9uTGlzdGAsIG9yJyxcbiAgICAgICAgICAgICAgICAnLSBhIExlZ2FjeSBUcmFuc2FjdGlvbiB3aXRoIGBnYXNQcmljZWAnLFxuICAgICAgICAgICAgXSxcbiAgICAgICAgICAgIG5hbWU6ICdJbnZhbGlkU2VyaWFsaXphYmxlVHJhbnNhY3Rpb25FcnJvcicsXG4gICAgICAgIH0pO1xuICAgIH1cbn1cbmV4cG9ydCBjbGFzcyBJbnZhbGlkU2VyaWFsaXplZFRyYW5zYWN0aW9uVHlwZUVycm9yIGV4dGVuZHMgQmFzZUVycm9yIHtcbiAgICBjb25zdHJ1Y3Rvcih7IHNlcmlhbGl6ZWRUeXBlIH0pIHtcbiAgICAgICAgc3VwZXIoYFNlcmlhbGl6ZWQgdHJhbnNhY3Rpb24gdHlwZSBcIiR7c2VyaWFsaXplZFR5cGV9XCIgaXMgaW52YWxpZC5gLCB7XG4gICAgICAgICAgICBuYW1lOiAnSW52YWxpZFNlcmlhbGl6ZWRUcmFuc2FjdGlvblR5cGUnLFxuICAgICAgICB9KTtcbiAgICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRoaXMsIFwic2VyaWFsaXplZFR5cGVcIiwge1xuICAgICAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICAgICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgICAgICAgICAgIHdyaXRhYmxlOiB0cnVlLFxuICAgICAgICAgICAgdmFsdWU6IHZvaWQgMFxuICAgICAgICB9KTtcbiAgICAgICAgdGhpcy5zZXJpYWxpemVkVHlwZSA9IHNlcmlhbGl6ZWRUeXBlO1xuICAgIH1cbn1cbmV4cG9ydCBjbGFzcyBJbnZhbGlkU2VyaWFsaXplZFRyYW5zYWN0aW9uRXJyb3IgZXh0ZW5kcyBCYXNlRXJyb3Ige1xuICAgIGNvbnN0cnVjdG9yKHsgYXR0cmlidXRlcywgc2VyaWFsaXplZFRyYW5zYWN0aW9uLCB0eXBlLCB9KSB7XG4gICAgICAgIGNvbnN0IG1pc3NpbmcgPSBPYmplY3QuZW50cmllcyhhdHRyaWJ1dGVzKVxuICAgICAgICAgICAgLm1hcCgoW2tleSwgdmFsdWVdKSA9PiAodHlwZW9mIHZhbHVlID09PSAndW5kZWZpbmVkJyA/IGtleSA6IHVuZGVmaW5lZCkpXG4gICAgICAgICAgICAuZmlsdGVyKEJvb2xlYW4pO1xuICAgICAgICBzdXBlcihgSW52YWxpZCBzZXJpYWxpemVkIHRyYW5zYWN0aW9uIG9mIHR5cGUgXCIke3R5cGV9XCIgd2FzIHByb3ZpZGVkLmAsIHtcbiAgICAgICAgICAgIG1ldGFNZXNzYWdlczogW1xuICAgICAgICAgICAgICAgIGBTZXJpYWxpemVkIFRyYW5zYWN0aW9uOiBcIiR7c2VyaWFsaXplZFRyYW5zYWN0aW9ufVwiYCxcbiAgICAgICAgICAgICAgICBtaXNzaW5nLmxlbmd0aCA+IDAgPyBgTWlzc2luZyBBdHRyaWJ1dGVzOiAke21pc3Npbmcuam9pbignLCAnKX1gIDogJycsXG4gICAgICAgICAgICBdLmZpbHRlcihCb29sZWFuKSxcbiAgICAgICAgICAgIG5hbWU6ICdJbnZhbGlkU2VyaWFsaXplZFRyYW5zYWN0aW9uRXJyb3InLFxuICAgICAgICB9KTtcbiAgICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRoaXMsIFwic2VyaWFsaXplZFRyYW5zYWN0aW9uXCIsIHtcbiAgICAgICAgICAgIGVudW1lcmFibGU6IHRydWUsXG4gICAgICAgICAgICBjb25maWd1cmFibGU6IHRydWUsXG4gICAgICAgICAgICB3cml0YWJsZTogdHJ1ZSxcbiAgICAgICAgICAgIHZhbHVlOiB2b2lkIDBcbiAgICAgICAgfSk7XG4gICAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0aGlzLCBcInR5cGVcIiwge1xuICAgICAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICAgICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgICAgICAgICAgIHdyaXRhYmxlOiB0cnVlLFxuICAgICAgICAgICAgdmFsdWU6IHZvaWQgMFxuICAgICAgICB9KTtcbiAgICAgICAgdGhpcy5zZXJpYWxpemVkVHJhbnNhY3Rpb24gPSBzZXJpYWxpemVkVHJhbnNhY3Rpb247XG4gICAgICAgIHRoaXMudHlwZSA9IHR5cGU7XG4gICAgfVxufVxuZXhwb3J0IGNsYXNzIEludmFsaWRTdG9yYWdlS2V5U2l6ZUVycm9yIGV4dGVuZHMgQmFzZUVycm9yIHtcbiAgICBjb25zdHJ1Y3Rvcih7IHN0b3JhZ2VLZXkgfSkge1xuICAgICAgICBzdXBlcihgU2l6ZSBmb3Igc3RvcmFnZSBrZXkgXCIke3N0b3JhZ2VLZXl9XCIgaXMgaW52YWxpZC4gRXhwZWN0ZWQgMzIgYnl0ZXMuIEdvdCAke01hdGguZmxvb3IoKHN0b3JhZ2VLZXkubGVuZ3RoIC0gMikgLyAyKX0gYnl0ZXMuYCwgeyBuYW1lOiAnSW52YWxpZFN0b3JhZ2VLZXlTaXplRXJyb3InIH0pO1xuICAgIH1cbn1cbmV4cG9ydCBjbGFzcyBUcmFuc2FjdGlvbkV4ZWN1dGlvbkVycm9yIGV4dGVuZHMgQmFzZUVycm9yIHtcbiAgICBjb25zdHJ1Y3RvcihjYXVzZSwgeyBhY2NvdW50LCBkb2NzUGF0aCwgY2hhaW4sIGRhdGEsIGdhcywgZ2FzUHJpY2UsIG1heEZlZVBlckdhcywgbWF4UHJpb3JpdHlGZWVQZXJHYXMsIG5vbmNlLCB0bywgdmFsdWUsIH0pIHtcbiAgICAgICAgY29uc3QgcHJldHR5QXJncyA9IHByZXR0eVByaW50KHtcbiAgICAgICAgICAgIGNoYWluOiBjaGFpbiAmJiBgJHtjaGFpbj8ubmFtZX0gKGlkOiAke2NoYWluPy5pZH0pYCxcbiAgICAgICAgICAgIGZyb206IGFjY291bnQ/LmFkZHJlc3MsXG4gICAgICAgICAgICB0byxcbiAgICAgICAgICAgIHZhbHVlOiB0eXBlb2YgdmFsdWUgIT09ICd1bmRlZmluZWQnICYmXG4gICAgICAgICAgICAgICAgYCR7Zm9ybWF0RXRoZXIodmFsdWUpfSAke2NoYWluPy5uYXRpdmVDdXJyZW5jeT8uc3ltYm9sIHx8ICdFVEgnfWAsXG4gICAgICAgICAgICBkYXRhLFxuICAgICAgICAgICAgZ2FzLFxuICAgICAgICAgICAgZ2FzUHJpY2U6IHR5cGVvZiBnYXNQcmljZSAhPT0gJ3VuZGVmaW5lZCcgJiYgYCR7Zm9ybWF0R3dlaShnYXNQcmljZSl9IGd3ZWlgLFxuICAgICAgICAgICAgbWF4RmVlUGVyR2FzOiB0eXBlb2YgbWF4RmVlUGVyR2FzICE9PSAndW5kZWZpbmVkJyAmJlxuICAgICAgICAgICAgICAgIGAke2Zvcm1hdEd3ZWkobWF4RmVlUGVyR2FzKX0gZ3dlaWAsXG4gICAgICAgICAgICBtYXhQcmlvcml0eUZlZVBlckdhczogdHlwZW9mIG1heFByaW9yaXR5RmVlUGVyR2FzICE9PSAndW5kZWZpbmVkJyAmJlxuICAgICAgICAgICAgICAgIGAke2Zvcm1hdEd3ZWkobWF4UHJpb3JpdHlGZWVQZXJHYXMpfSBnd2VpYCxcbiAgICAgICAgICAgIG5vbmNlLFxuICAgICAgICB9KTtcbiAgICAgICAgc3VwZXIoY2F1c2Uuc2hvcnRNZXNzYWdlLCB7XG4gICAgICAgICAgICBjYXVzZSxcbiAgICAgICAgICAgIGRvY3NQYXRoLFxuICAgICAgICAgICAgbWV0YU1lc3NhZ2VzOiBbXG4gICAgICAgICAgICAgICAgLi4uKGNhdXNlLm1ldGFNZXNzYWdlcyA/IFsuLi5jYXVzZS5tZXRhTWVzc2FnZXMsICcgJ10gOiBbXSksXG4gICAgICAgICAgICAgICAgJ1JlcXVlc3QgQXJndW1lbnRzOicsXG4gICAgICAgICAgICAgICAgcHJldHR5QXJncyxcbiAgICAgICAgICAgIF0uZmlsdGVyKEJvb2xlYW4pLFxuICAgICAgICAgICAgbmFtZTogJ1RyYW5zYWN0aW9uRXhlY3V0aW9uRXJyb3InLFxuICAgICAgICB9KTtcbiAgICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRoaXMsIFwiY2F1c2VcIiwge1xuICAgICAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICAgICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgICAgICAgICAgIHdyaXRhYmxlOiB0cnVlLFxuICAgICAgICAgICAgdmFsdWU6IHZvaWQgMFxuICAgICAgICB9KTtcbiAgICAgICAgdGhpcy5jYXVzZSA9IGNhdXNlO1xuICAgIH1cbn1cbmV4cG9ydCBjbGFzcyBUcmFuc2FjdGlvbk5vdEZvdW5kRXJyb3IgZXh0ZW5kcyBCYXNlRXJyb3Ige1xuICAgIGNvbnN0cnVjdG9yKHsgYmxvY2tIYXNoLCBibG9ja051bWJlciwgYmxvY2tUYWcsIGhhc2gsIGluZGV4LCB9KSB7XG4gICAgICAgIGxldCBpZGVudGlmaWVyID0gJ1RyYW5zYWN0aW9uJztcbiAgICAgICAgaWYgKGJsb2NrVGFnICYmIGluZGV4ICE9PSB1bmRlZmluZWQpXG4gICAgICAgICAgICBpZGVudGlmaWVyID0gYFRyYW5zYWN0aW9uIGF0IGJsb2NrIHRpbWUgXCIke2Jsb2NrVGFnfVwiIGF0IGluZGV4IFwiJHtpbmRleH1cImA7XG4gICAgICAgIGlmIChibG9ja0hhc2ggJiYgaW5kZXggIT09IHVuZGVmaW5lZClcbiAgICAgICAgICAgIGlkZW50aWZpZXIgPSBgVHJhbnNhY3Rpb24gYXQgYmxvY2sgaGFzaCBcIiR7YmxvY2tIYXNofVwiIGF0IGluZGV4IFwiJHtpbmRleH1cImA7XG4gICAgICAgIGlmIChibG9ja051bWJlciAmJiBpbmRleCAhPT0gdW5kZWZpbmVkKVxuICAgICAgICAgICAgaWRlbnRpZmllciA9IGBUcmFuc2FjdGlvbiBhdCBibG9jayBudW1iZXIgXCIke2Jsb2NrTnVtYmVyfVwiIGF0IGluZGV4IFwiJHtpbmRleH1cImA7XG4gICAgICAgIGlmIChoYXNoKVxuICAgICAgICAgICAgaWRlbnRpZmllciA9IGBUcmFuc2FjdGlvbiB3aXRoIGhhc2ggXCIke2hhc2h9XCJgO1xuICAgICAgICBzdXBlcihgJHtpZGVudGlmaWVyfSBjb3VsZCBub3QgYmUgZm91bmQuYCwge1xuICAgICAgICAgICAgbmFtZTogJ1RyYW5zYWN0aW9uTm90Rm91bmRFcnJvcicsXG4gICAgICAgIH0pO1xuICAgIH1cbn1cbmV4cG9ydCBjbGFzcyBUcmFuc2FjdGlvblJlY2VpcHROb3RGb3VuZEVycm9yIGV4dGVuZHMgQmFzZUVycm9yIHtcbiAgICBjb25zdHJ1Y3Rvcih7IGhhc2ggfSkge1xuICAgICAgICBzdXBlcihgVHJhbnNhY3Rpb24gcmVjZWlwdCB3aXRoIGhhc2ggXCIke2hhc2h9XCIgY291bGQgbm90IGJlIGZvdW5kLiBUaGUgVHJhbnNhY3Rpb24gbWF5IG5vdCBiZSBwcm9jZXNzZWQgb24gYSBibG9jayB5ZXQuYCwge1xuICAgICAgICAgICAgbmFtZTogJ1RyYW5zYWN0aW9uUmVjZWlwdE5vdEZvdW5kRXJyb3InLFxuICAgICAgICB9KTtcbiAgICB9XG59XG5leHBvcnQgY2xhc3MgVHJhbnNhY3Rpb25SZWNlaXB0UmV2ZXJ0ZWRFcnJvciBleHRlbmRzIEJhc2VFcnJvciB7XG4gICAgY29uc3RydWN0b3IoeyByZWNlaXB0IH0pIHtcbiAgICAgICAgc3VwZXIoYFRyYW5zYWN0aW9uIHdpdGggaGFzaCBcIiR7cmVjZWlwdC50cmFuc2FjdGlvbkhhc2h9XCIgcmV2ZXJ0ZWQuYCwge1xuICAgICAgICAgICAgbWV0YU1lc3NhZ2VzOiBbXG4gICAgICAgICAgICAgICAgJ1RoZSByZWNlaXB0IG1hcmtlZCB0aGUgdHJhbnNhY3Rpb24gYXMgXCJyZXZlcnRlZFwiLiBUaGlzIGNvdWxkIG1lYW4gdGhhdCB0aGUgZnVuY3Rpb24gb24gdGhlIGNvbnRyYWN0IHlvdSBhcmUgdHJ5aW5nIHRvIGNhbGwgdGhyZXcgYW4gZXJyb3IuJyxcbiAgICAgICAgICAgICAgICAnICcsXG4gICAgICAgICAgICAgICAgJ1lvdSBjYW4gYXR0ZW1wdCB0byBleHRyYWN0IHRoZSByZXZlcnQgcmVhc29uIGJ5OicsXG4gICAgICAgICAgICAgICAgJy0gY2FsbGluZyB0aGUgYHNpbXVsYXRlQ29udHJhY3RgIG9yIGBzaW11bGF0ZUNhbGxzYCBBY3Rpb24gd2l0aCB0aGUgYGFiaWAgYW5kIGBmdW5jdGlvbk5hbWVgIG9mIHRoZSBjb250cmFjdCcsXG4gICAgICAgICAgICAgICAgJy0gdXNpbmcgdGhlIGBjYWxsYCBBY3Rpb24gd2l0aCByYXcgYGRhdGFgJyxcbiAgICAgICAgICAgIF0sXG4gICAgICAgICAgICBuYW1lOiAnVHJhbnNhY3Rpb25SZWNlaXB0UmV2ZXJ0ZWRFcnJvcicsXG4gICAgICAgIH0pO1xuICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkodGhpcywgXCJyZWNlaXB0XCIsIHtcbiAgICAgICAgICAgIGVudW1lcmFibGU6IHRydWUsXG4gICAgICAgICAgICBjb25maWd1cmFibGU6IHRydWUsXG4gICAgICAgICAgICB3cml0YWJsZTogdHJ1ZSxcbiAgICAgICAgICAgIHZhbHVlOiB2b2lkIDBcbiAgICAgICAgfSk7XG4gICAgICAgIHRoaXMucmVjZWlwdCA9IHJlY2VpcHQ7XG4gICAgfVxufVxuZXhwb3J0IGNsYXNzIFdhaXRGb3JUcmFuc2FjdGlvblJlY2VpcHRUaW1lb3V0RXJyb3IgZXh0ZW5kcyBCYXNlRXJyb3Ige1xuICAgIGNvbnN0cnVjdG9yKHsgaGFzaCB9KSB7XG4gICAgICAgIHN1cGVyKGBUaW1lZCBvdXQgd2hpbGUgd2FpdGluZyBmb3IgdHJhbnNhY3Rpb24gd2l0aCBoYXNoIFwiJHtoYXNofVwiIHRvIGJlIGNvbmZpcm1lZC5gLCB7IG5hbWU6ICdXYWl0Rm9yVHJhbnNhY3Rpb25SZWNlaXB0VGltZW91dEVycm9yJyB9KTtcbiAgICB9XG59XG4vLyMgc291cmNlTWFwcGluZ1VSTD10cmFuc2FjdGlvbi5qcy5tYXAiLAogICAgImV4cG9ydCBjb25zdCBnZXRDb250cmFjdEFkZHJlc3MgPSAoYWRkcmVzcykgPT4gYWRkcmVzcztcbmV4cG9ydCBjb25zdCBnZXRVcmwgPSAodXJsKSA9PiB1cmw7XG4vLyMgc291cmNlTWFwcGluZ1VSTD11dGlscy5qcy5tYXAiLAogICAgImltcG9ydCB7IHBhcnNlQWNjb3VudCB9IGZyb20gJy4uL2FjY291bnRzL3V0aWxzL3BhcnNlQWNjb3VudC5qcyc7XG5pbXBvcnQgeyBwYW5pY1JlYXNvbnMgfSBmcm9tICcuLi9jb25zdGFudHMvc29saWRpdHkuanMnO1xuaW1wb3J0IHsgZGVjb2RlRXJyb3JSZXN1bHQsIH0gZnJvbSAnLi4vdXRpbHMvYWJpL2RlY29kZUVycm9yUmVzdWx0LmpzJztcbmltcG9ydCB7IGZvcm1hdEFiaUl0ZW0gfSBmcm9tICcuLi91dGlscy9hYmkvZm9ybWF0QWJpSXRlbS5qcyc7XG5pbXBvcnQgeyBmb3JtYXRBYmlJdGVtV2l0aEFyZ3MgfSBmcm9tICcuLi91dGlscy9hYmkvZm9ybWF0QWJpSXRlbVdpdGhBcmdzLmpzJztcbmltcG9ydCB7IGdldEFiaUl0ZW0gfSBmcm9tICcuLi91dGlscy9hYmkvZ2V0QWJpSXRlbS5qcyc7XG5pbXBvcnQgeyBmb3JtYXRFdGhlciB9IGZyb20gJy4uL3V0aWxzL3VuaXQvZm9ybWF0RXRoZXIuanMnO1xuaW1wb3J0IHsgZm9ybWF0R3dlaSB9IGZyb20gJy4uL3V0aWxzL3VuaXQvZm9ybWF0R3dlaS5qcyc7XG5pbXBvcnQgeyBBYmlFcnJvclNpZ25hdHVyZU5vdEZvdW5kRXJyb3IgfSBmcm9tICcuL2FiaS5qcyc7XG5pbXBvcnQgeyBCYXNlRXJyb3IgfSBmcm9tICcuL2Jhc2UuanMnO1xuaW1wb3J0IHsgcHJldHR5U3RhdGVPdmVycmlkZSB9IGZyb20gJy4vc3RhdGVPdmVycmlkZS5qcyc7XG5pbXBvcnQgeyBwcmV0dHlQcmludCB9IGZyb20gJy4vdHJhbnNhY3Rpb24uanMnO1xuaW1wb3J0IHsgZ2V0Q29udHJhY3RBZGRyZXNzIH0gZnJvbSAnLi91dGlscy5qcyc7XG5leHBvcnQgY2xhc3MgQ2FsbEV4ZWN1dGlvbkVycm9yIGV4dGVuZHMgQmFzZUVycm9yIHtcbiAgICBjb25zdHJ1Y3RvcihjYXVzZSwgeyBhY2NvdW50OiBhY2NvdW50XywgZG9jc1BhdGgsIGNoYWluLCBkYXRhLCBnYXMsIGdhc1ByaWNlLCBtYXhGZWVQZXJHYXMsIG1heFByaW9yaXR5RmVlUGVyR2FzLCBub25jZSwgdG8sIHZhbHVlLCBzdGF0ZU92ZXJyaWRlLCB9KSB7XG4gICAgICAgIGNvbnN0IGFjY291bnQgPSBhY2NvdW50XyA/IHBhcnNlQWNjb3VudChhY2NvdW50XykgOiB1bmRlZmluZWQ7XG4gICAgICAgIGxldCBwcmV0dHlBcmdzID0gcHJldHR5UHJpbnQoe1xuICAgICAgICAgICAgZnJvbTogYWNjb3VudD8uYWRkcmVzcyxcbiAgICAgICAgICAgIHRvLFxuICAgICAgICAgICAgdmFsdWU6IHR5cGVvZiB2YWx1ZSAhPT0gJ3VuZGVmaW5lZCcgJiZcbiAgICAgICAgICAgICAgICBgJHtmb3JtYXRFdGhlcih2YWx1ZSl9ICR7Y2hhaW4/Lm5hdGl2ZUN1cnJlbmN5Py5zeW1ib2wgfHwgJ0VUSCd9YCxcbiAgICAgICAgICAgIGRhdGEsXG4gICAgICAgICAgICBnYXMsXG4gICAgICAgICAgICBnYXNQcmljZTogdHlwZW9mIGdhc1ByaWNlICE9PSAndW5kZWZpbmVkJyAmJiBgJHtmb3JtYXRHd2VpKGdhc1ByaWNlKX0gZ3dlaWAsXG4gICAgICAgICAgICBtYXhGZWVQZXJHYXM6IHR5cGVvZiBtYXhGZWVQZXJHYXMgIT09ICd1bmRlZmluZWQnICYmXG4gICAgICAgICAgICAgICAgYCR7Zm9ybWF0R3dlaShtYXhGZWVQZXJHYXMpfSBnd2VpYCxcbiAgICAgICAgICAgIG1heFByaW9yaXR5RmVlUGVyR2FzOiB0eXBlb2YgbWF4UHJpb3JpdHlGZWVQZXJHYXMgIT09ICd1bmRlZmluZWQnICYmXG4gICAgICAgICAgICAgICAgYCR7Zm9ybWF0R3dlaShtYXhQcmlvcml0eUZlZVBlckdhcyl9IGd3ZWlgLFxuICAgICAgICAgICAgbm9uY2UsXG4gICAgICAgIH0pO1xuICAgICAgICBpZiAoc3RhdGVPdmVycmlkZSkge1xuICAgICAgICAgICAgcHJldHR5QXJncyArPSBgXFxuJHtwcmV0dHlTdGF0ZU92ZXJyaWRlKHN0YXRlT3ZlcnJpZGUpfWA7XG4gICAgICAgIH1cbiAgICAgICAgc3VwZXIoY2F1c2Uuc2hvcnRNZXNzYWdlLCB7XG4gICAgICAgICAgICBjYXVzZSxcbiAgICAgICAgICAgIGRvY3NQYXRoLFxuICAgICAgICAgICAgbWV0YU1lc3NhZ2VzOiBbXG4gICAgICAgICAgICAgICAgLi4uKGNhdXNlLm1ldGFNZXNzYWdlcyA/IFsuLi5jYXVzZS5tZXRhTWVzc2FnZXMsICcgJ10gOiBbXSksXG4gICAgICAgICAgICAgICAgJ1JhdyBDYWxsIEFyZ3VtZW50czonLFxuICAgICAgICAgICAgICAgIHByZXR0eUFyZ3MsXG4gICAgICAgICAgICBdLmZpbHRlcihCb29sZWFuKSxcbiAgICAgICAgICAgIG5hbWU6ICdDYWxsRXhlY3V0aW9uRXJyb3InLFxuICAgICAgICB9KTtcbiAgICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRoaXMsIFwiY2F1c2VcIiwge1xuICAgICAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICAgICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgICAgICAgICAgIHdyaXRhYmxlOiB0cnVlLFxuICAgICAgICAgICAgdmFsdWU6IHZvaWQgMFxuICAgICAgICB9KTtcbiAgICAgICAgdGhpcy5jYXVzZSA9IGNhdXNlO1xuICAgIH1cbn1cbmV4cG9ydCBjbGFzcyBDb250cmFjdEZ1bmN0aW9uRXhlY3V0aW9uRXJyb3IgZXh0ZW5kcyBCYXNlRXJyb3Ige1xuICAgIGNvbnN0cnVjdG9yKGNhdXNlLCB7IGFiaSwgYXJncywgY29udHJhY3RBZGRyZXNzLCBkb2NzUGF0aCwgZnVuY3Rpb25OYW1lLCBzZW5kZXIsIH0pIHtcbiAgICAgICAgY29uc3QgYWJpSXRlbSA9IGdldEFiaUl0ZW0oeyBhYmksIGFyZ3MsIG5hbWU6IGZ1bmN0aW9uTmFtZSB9KTtcbiAgICAgICAgY29uc3QgZm9ybWF0dGVkQXJncyA9IGFiaUl0ZW1cbiAgICAgICAgICAgID8gZm9ybWF0QWJpSXRlbVdpdGhBcmdzKHtcbiAgICAgICAgICAgICAgICBhYmlJdGVtLFxuICAgICAgICAgICAgICAgIGFyZ3MsXG4gICAgICAgICAgICAgICAgaW5jbHVkZUZ1bmN0aW9uTmFtZTogZmFsc2UsXG4gICAgICAgICAgICAgICAgaW5jbHVkZU5hbWU6IGZhbHNlLFxuICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIDogdW5kZWZpbmVkO1xuICAgICAgICBjb25zdCBmdW5jdGlvbldpdGhQYXJhbXMgPSBhYmlJdGVtXG4gICAgICAgICAgICA/IGZvcm1hdEFiaUl0ZW0oYWJpSXRlbSwgeyBpbmNsdWRlTmFtZTogdHJ1ZSB9KVxuICAgICAgICAgICAgOiB1bmRlZmluZWQ7XG4gICAgICAgIGNvbnN0IHByZXR0eUFyZ3MgPSBwcmV0dHlQcmludCh7XG4gICAgICAgICAgICBhZGRyZXNzOiBjb250cmFjdEFkZHJlc3MgJiYgZ2V0Q29udHJhY3RBZGRyZXNzKGNvbnRyYWN0QWRkcmVzcyksXG4gICAgICAgICAgICBmdW5jdGlvbjogZnVuY3Rpb25XaXRoUGFyYW1zLFxuICAgICAgICAgICAgYXJnczogZm9ybWF0dGVkQXJncyAmJlxuICAgICAgICAgICAgICAgIGZvcm1hdHRlZEFyZ3MgIT09ICcoKScgJiZcbiAgICAgICAgICAgICAgICBgJHtbLi4uQXJyYXkoZnVuY3Rpb25OYW1lPy5sZW5ndGggPz8gMCkua2V5cygpXVxuICAgICAgICAgICAgICAgICAgICAubWFwKCgpID0+ICcgJylcbiAgICAgICAgICAgICAgICAgICAgLmpvaW4oJycpfSR7Zm9ybWF0dGVkQXJnc31gLFxuICAgICAgICAgICAgc2VuZGVyLFxuICAgICAgICB9KTtcbiAgICAgICAgc3VwZXIoY2F1c2Uuc2hvcnRNZXNzYWdlIHx8XG4gICAgICAgICAgICBgQW4gdW5rbm93biBlcnJvciBvY2N1cnJlZCB3aGlsZSBleGVjdXRpbmcgdGhlIGNvbnRyYWN0IGZ1bmN0aW9uIFwiJHtmdW5jdGlvbk5hbWV9XCIuYCwge1xuICAgICAgICAgICAgY2F1c2UsXG4gICAgICAgICAgICBkb2NzUGF0aCxcbiAgICAgICAgICAgIG1ldGFNZXNzYWdlczogW1xuICAgICAgICAgICAgICAgIC4uLihjYXVzZS5tZXRhTWVzc2FnZXMgPyBbLi4uY2F1c2UubWV0YU1lc3NhZ2VzLCAnICddIDogW10pLFxuICAgICAgICAgICAgICAgIHByZXR0eUFyZ3MgJiYgJ0NvbnRyYWN0IENhbGw6JyxcbiAgICAgICAgICAgICAgICBwcmV0dHlBcmdzLFxuICAgICAgICAgICAgXS5maWx0ZXIoQm9vbGVhbiksXG4gICAgICAgICAgICBuYW1lOiAnQ29udHJhY3RGdW5jdGlvbkV4ZWN1dGlvbkVycm9yJyxcbiAgICAgICAgfSk7XG4gICAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0aGlzLCBcImFiaVwiLCB7XG4gICAgICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlLFxuICAgICAgICAgICAgd3JpdGFibGU6IHRydWUsXG4gICAgICAgICAgICB2YWx1ZTogdm9pZCAwXG4gICAgICAgIH0pO1xuICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkodGhpcywgXCJhcmdzXCIsIHtcbiAgICAgICAgICAgIGVudW1lcmFibGU6IHRydWUsXG4gICAgICAgICAgICBjb25maWd1cmFibGU6IHRydWUsXG4gICAgICAgICAgICB3cml0YWJsZTogdHJ1ZSxcbiAgICAgICAgICAgIHZhbHVlOiB2b2lkIDBcbiAgICAgICAgfSk7XG4gICAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0aGlzLCBcImNhdXNlXCIsIHtcbiAgICAgICAgICAgIGVudW1lcmFibGU6IHRydWUsXG4gICAgICAgICAgICBjb25maWd1cmFibGU6IHRydWUsXG4gICAgICAgICAgICB3cml0YWJsZTogdHJ1ZSxcbiAgICAgICAgICAgIHZhbHVlOiB2b2lkIDBcbiAgICAgICAgfSk7XG4gICAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0aGlzLCBcImNvbnRyYWN0QWRkcmVzc1wiLCB7XG4gICAgICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlLFxuICAgICAgICAgICAgd3JpdGFibGU6IHRydWUsXG4gICAgICAgICAgICB2YWx1ZTogdm9pZCAwXG4gICAgICAgIH0pO1xuICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkodGhpcywgXCJmb3JtYXR0ZWRBcmdzXCIsIHtcbiAgICAgICAgICAgIGVudW1lcmFibGU6IHRydWUsXG4gICAgICAgICAgICBjb25maWd1cmFibGU6IHRydWUsXG4gICAgICAgICAgICB3cml0YWJsZTogdHJ1ZSxcbiAgICAgICAgICAgIHZhbHVlOiB2b2lkIDBcbiAgICAgICAgfSk7XG4gICAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0aGlzLCBcImZ1bmN0aW9uTmFtZVwiLCB7XG4gICAgICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlLFxuICAgICAgICAgICAgd3JpdGFibGU6IHRydWUsXG4gICAgICAgICAgICB2YWx1ZTogdm9pZCAwXG4gICAgICAgIH0pO1xuICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkodGhpcywgXCJzZW5kZXJcIiwge1xuICAgICAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICAgICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgICAgICAgICAgIHdyaXRhYmxlOiB0cnVlLFxuICAgICAgICAgICAgdmFsdWU6IHZvaWQgMFxuICAgICAgICB9KTtcbiAgICAgICAgdGhpcy5hYmkgPSBhYmk7XG4gICAgICAgIHRoaXMuYXJncyA9IGFyZ3M7XG4gICAgICAgIHRoaXMuY2F1c2UgPSBjYXVzZTtcbiAgICAgICAgdGhpcy5jb250cmFjdEFkZHJlc3MgPSBjb250cmFjdEFkZHJlc3M7XG4gICAgICAgIHRoaXMuZnVuY3Rpb25OYW1lID0gZnVuY3Rpb25OYW1lO1xuICAgICAgICB0aGlzLnNlbmRlciA9IHNlbmRlcjtcbiAgICB9XG59XG5leHBvcnQgY2xhc3MgQ29udHJhY3RGdW5jdGlvblJldmVydGVkRXJyb3IgZXh0ZW5kcyBCYXNlRXJyb3Ige1xuICAgIGNvbnN0cnVjdG9yKHsgYWJpLCBkYXRhLCBmdW5jdGlvbk5hbWUsIG1lc3NhZ2UsIH0pIHtcbiAgICAgICAgbGV0IGNhdXNlO1xuICAgICAgICBsZXQgZGVjb2RlZERhdGE7XG4gICAgICAgIGxldCBtZXRhTWVzc2FnZXM7XG4gICAgICAgIGxldCByZWFzb247XG4gICAgICAgIGlmIChkYXRhICYmIGRhdGEgIT09ICcweCcpIHtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgZGVjb2RlZERhdGEgPSBkZWNvZGVFcnJvclJlc3VsdCh7IGFiaSwgZGF0YSB9KTtcbiAgICAgICAgICAgICAgICBjb25zdCB7IGFiaUl0ZW0sIGVycm9yTmFtZSwgYXJnczogZXJyb3JBcmdzIH0gPSBkZWNvZGVkRGF0YTtcbiAgICAgICAgICAgICAgICBpZiAoZXJyb3JOYW1lID09PSAnRXJyb3InKSB7XG4gICAgICAgICAgICAgICAgICAgIHJlYXNvbiA9IGVycm9yQXJnc1swXTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSBpZiAoZXJyb3JOYW1lID09PSAnUGFuaWMnKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IFtmaXJzdEFyZ10gPSBlcnJvckFyZ3M7XG4gICAgICAgICAgICAgICAgICAgIHJlYXNvbiA9IHBhbmljUmVhc29uc1tmaXJzdEFyZ107XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBlcnJvcldpdGhQYXJhbXMgPSBhYmlJdGVtXG4gICAgICAgICAgICAgICAgICAgICAgICA/IGZvcm1hdEFiaUl0ZW0oYWJpSXRlbSwgeyBpbmNsdWRlTmFtZTogdHJ1ZSB9KVxuICAgICAgICAgICAgICAgICAgICAgICAgOiB1bmRlZmluZWQ7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGZvcm1hdHRlZEFyZ3MgPSBhYmlJdGVtICYmIGVycm9yQXJnc1xuICAgICAgICAgICAgICAgICAgICAgICAgPyBmb3JtYXRBYmlJdGVtV2l0aEFyZ3Moe1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFiaUl0ZW0sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgYXJnczogZXJyb3JBcmdzLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGluY2x1ZGVGdW5jdGlvbk5hbWU6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGluY2x1ZGVOYW1lOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgICAgICAgICA6IHVuZGVmaW5lZDtcbiAgICAgICAgICAgICAgICAgICAgbWV0YU1lc3NhZ2VzID0gW1xuICAgICAgICAgICAgICAgICAgICAgICAgZXJyb3JXaXRoUGFyYW1zID8gYEVycm9yOiAke2Vycm9yV2l0aFBhcmFtc31gIDogJycsXG4gICAgICAgICAgICAgICAgICAgICAgICBmb3JtYXR0ZWRBcmdzICYmIGZvcm1hdHRlZEFyZ3MgIT09ICcoKSdcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA/IGAgICAgICAgJHtbLi4uQXJyYXkoZXJyb3JOYW1lPy5sZW5ndGggPz8gMCkua2V5cygpXVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAubWFwKCgpID0+ICcgJylcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLmpvaW4oJycpfSR7Zm9ybWF0dGVkQXJnc31gXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgOiAnJyxcbiAgICAgICAgICAgICAgICAgICAgXTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICAgICAgY2F1c2UgPSBlcnI7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAobWVzc2FnZSlcbiAgICAgICAgICAgIHJlYXNvbiA9IG1lc3NhZ2U7XG4gICAgICAgIGxldCBzaWduYXR1cmU7XG4gICAgICAgIGlmIChjYXVzZSBpbnN0YW5jZW9mIEFiaUVycm9yU2lnbmF0dXJlTm90Rm91bmRFcnJvcikge1xuICAgICAgICAgICAgc2lnbmF0dXJlID0gY2F1c2Uuc2lnbmF0dXJlO1xuICAgICAgICAgICAgbWV0YU1lc3NhZ2VzID0gW1xuICAgICAgICAgICAgICAgIGBVbmFibGUgdG8gZGVjb2RlIHNpZ25hdHVyZSBcIiR7c2lnbmF0dXJlfVwiIGFzIGl0IHdhcyBub3QgZm91bmQgb24gdGhlIHByb3ZpZGVkIEFCSS5gLFxuICAgICAgICAgICAgICAgICdNYWtlIHN1cmUgeW91IGFyZSB1c2luZyB0aGUgY29ycmVjdCBBQkkgYW5kIHRoYXQgdGhlIGVycm9yIGV4aXN0cyBvbiBpdC4nLFxuICAgICAgICAgICAgICAgIGBZb3UgY2FuIGxvb2sgdXAgdGhlIGRlY29kZWQgc2lnbmF0dXJlIGhlcmU6IGh0dHBzOi8vb3BlbmNoYWluLnh5ei9zaWduYXR1cmVzP3F1ZXJ5PSR7c2lnbmF0dXJlfS5gLFxuICAgICAgICAgICAgXTtcbiAgICAgICAgfVxuICAgICAgICBzdXBlcigocmVhc29uICYmIHJlYXNvbiAhPT0gJ2V4ZWN1dGlvbiByZXZlcnRlZCcpIHx8IHNpZ25hdHVyZVxuICAgICAgICAgICAgPyBbXG4gICAgICAgICAgICAgICAgYFRoZSBjb250cmFjdCBmdW5jdGlvbiBcIiR7ZnVuY3Rpb25OYW1lfVwiIHJldmVydGVkIHdpdGggdGhlIGZvbGxvd2luZyAke3NpZ25hdHVyZSA/ICdzaWduYXR1cmUnIDogJ3JlYXNvbid9OmAsXG4gICAgICAgICAgICAgICAgcmVhc29uIHx8IHNpZ25hdHVyZSxcbiAgICAgICAgICAgIF0uam9pbignXFxuJylcbiAgICAgICAgICAgIDogYFRoZSBjb250cmFjdCBmdW5jdGlvbiBcIiR7ZnVuY3Rpb25OYW1lfVwiIHJldmVydGVkLmAsIHtcbiAgICAgICAgICAgIGNhdXNlLFxuICAgICAgICAgICAgbWV0YU1lc3NhZ2VzLFxuICAgICAgICAgICAgbmFtZTogJ0NvbnRyYWN0RnVuY3Rpb25SZXZlcnRlZEVycm9yJyxcbiAgICAgICAgfSk7XG4gICAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0aGlzLCBcImRhdGFcIiwge1xuICAgICAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICAgICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgICAgICAgICAgIHdyaXRhYmxlOiB0cnVlLFxuICAgICAgICAgICAgdmFsdWU6IHZvaWQgMFxuICAgICAgICB9KTtcbiAgICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRoaXMsIFwicmF3XCIsIHtcbiAgICAgICAgICAgIGVudW1lcmFibGU6IHRydWUsXG4gICAgICAgICAgICBjb25maWd1cmFibGU6IHRydWUsXG4gICAgICAgICAgICB3cml0YWJsZTogdHJ1ZSxcbiAgICAgICAgICAgIHZhbHVlOiB2b2lkIDBcbiAgICAgICAgfSk7XG4gICAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0aGlzLCBcInJlYXNvblwiLCB7XG4gICAgICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlLFxuICAgICAgICAgICAgd3JpdGFibGU6IHRydWUsXG4gICAgICAgICAgICB2YWx1ZTogdm9pZCAwXG4gICAgICAgIH0pO1xuICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkodGhpcywgXCJzaWduYXR1cmVcIiwge1xuICAgICAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICAgICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgICAgICAgICAgIHdyaXRhYmxlOiB0cnVlLFxuICAgICAgICAgICAgdmFsdWU6IHZvaWQgMFxuICAgICAgICB9KTtcbiAgICAgICAgdGhpcy5kYXRhID0gZGVjb2RlZERhdGE7XG4gICAgICAgIHRoaXMucmF3ID0gZGF0YTtcbiAgICAgICAgdGhpcy5yZWFzb24gPSByZWFzb247XG4gICAgICAgIHRoaXMuc2lnbmF0dXJlID0gc2lnbmF0dXJlO1xuICAgIH1cbn1cbmV4cG9ydCBjbGFzcyBDb250cmFjdEZ1bmN0aW9uWmVyb0RhdGFFcnJvciBleHRlbmRzIEJhc2VFcnJvciB7XG4gICAgY29uc3RydWN0b3IoeyBmdW5jdGlvbk5hbWUgfSkge1xuICAgICAgICBzdXBlcihgVGhlIGNvbnRyYWN0IGZ1bmN0aW9uIFwiJHtmdW5jdGlvbk5hbWV9XCIgcmV0dXJuZWQgbm8gZGF0YSAoXCIweFwiKS5gLCB7XG4gICAgICAgICAgICBtZXRhTWVzc2FnZXM6IFtcbiAgICAgICAgICAgICAgICAnVGhpcyBjb3VsZCBiZSBkdWUgdG8gYW55IG9mIHRoZSBmb2xsb3dpbmc6JyxcbiAgICAgICAgICAgICAgICBgICAtIFRoZSBjb250cmFjdCBkb2VzIG5vdCBoYXZlIHRoZSBmdW5jdGlvbiBcIiR7ZnVuY3Rpb25OYW1lfVwiLGAsXG4gICAgICAgICAgICAgICAgJyAgLSBUaGUgcGFyYW1ldGVycyBwYXNzZWQgdG8gdGhlIGNvbnRyYWN0IGZ1bmN0aW9uIG1heSBiZSBpbnZhbGlkLCBvcicsXG4gICAgICAgICAgICAgICAgJyAgLSBUaGUgYWRkcmVzcyBpcyBub3QgYSBjb250cmFjdC4nLFxuICAgICAgICAgICAgXSxcbiAgICAgICAgICAgIG5hbWU6ICdDb250cmFjdEZ1bmN0aW9uWmVyb0RhdGFFcnJvcicsXG4gICAgICAgIH0pO1xuICAgIH1cbn1cbmV4cG9ydCBjbGFzcyBDb3VudGVyZmFjdHVhbERlcGxveW1lbnRGYWlsZWRFcnJvciBleHRlbmRzIEJhc2VFcnJvciB7XG4gICAgY29uc3RydWN0b3IoeyBmYWN0b3J5IH0pIHtcbiAgICAgICAgc3VwZXIoYERlcGxveW1lbnQgZm9yIGNvdW50ZXJmYWN0dWFsIGNvbnRyYWN0IGNhbGwgZmFpbGVkJHtmYWN0b3J5ID8gYCBmb3IgZmFjdG9yeSBcIiR7ZmFjdG9yeX1cIi5gIDogJyd9YCwge1xuICAgICAgICAgICAgbWV0YU1lc3NhZ2VzOiBbXG4gICAgICAgICAgICAgICAgJ1BsZWFzZSBlbnN1cmU6JyxcbiAgICAgICAgICAgICAgICAnLSBUaGUgYGZhY3RvcnlgIGlzIGEgdmFsaWQgY29udHJhY3QgZGVwbG95bWVudCBmYWN0b3J5IChpZS4gQ3JlYXRlMiBGYWN0b3J5LCBFUkMtNDMzNyBGYWN0b3J5LCBldGMpLicsXG4gICAgICAgICAgICAgICAgJy0gVGhlIGBmYWN0b3J5RGF0YWAgaXMgYSB2YWxpZCBlbmNvZGVkIGZ1bmN0aW9uIGNhbGwgZm9yIGNvbnRyYWN0IGRlcGxveW1lbnQgZnVuY3Rpb24gb24gdGhlIGZhY3RvcnkuJyxcbiAgICAgICAgICAgIF0sXG4gICAgICAgICAgICBuYW1lOiAnQ291bnRlcmZhY3R1YWxEZXBsb3ltZW50RmFpbGVkRXJyb3InLFxuICAgICAgICB9KTtcbiAgICB9XG59XG5leHBvcnQgY2xhc3MgUmF3Q29udHJhY3RFcnJvciBleHRlbmRzIEJhc2VFcnJvciB7XG4gICAgY29uc3RydWN0b3IoeyBkYXRhLCBtZXNzYWdlLCB9KSB7XG4gICAgICAgIHN1cGVyKG1lc3NhZ2UgfHwgJycsIHsgbmFtZTogJ1Jhd0NvbnRyYWN0RXJyb3InIH0pO1xuICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkodGhpcywgXCJjb2RlXCIsIHtcbiAgICAgICAgICAgIGVudW1lcmFibGU6IHRydWUsXG4gICAgICAgICAgICBjb25maWd1cmFibGU6IHRydWUsXG4gICAgICAgICAgICB3cml0YWJsZTogdHJ1ZSxcbiAgICAgICAgICAgIHZhbHVlOiAzXG4gICAgICAgIH0pO1xuICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkodGhpcywgXCJkYXRhXCIsIHtcbiAgICAgICAgICAgIGVudW1lcmFibGU6IHRydWUsXG4gICAgICAgICAgICBjb25maWd1cmFibGU6IHRydWUsXG4gICAgICAgICAgICB3cml0YWJsZTogdHJ1ZSxcbiAgICAgICAgICAgIHZhbHVlOiB2b2lkIDBcbiAgICAgICAgfSk7XG4gICAgICAgIHRoaXMuZGF0YSA9IGRhdGE7XG4gICAgfVxufVxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9Y29udHJhY3QuanMubWFwIiwKICAgICJpbXBvcnQgeyBBYmlGdW5jdGlvbk5vdEZvdW5kRXJyb3IsIEFiaUZ1bmN0aW9uT3V0cHV0c05vdEZvdW5kRXJyb3IsIH0gZnJvbSAnLi4vLi4vZXJyb3JzL2FiaS5qcyc7XG5pbXBvcnQgeyBkZWNvZGVBYmlQYXJhbWV0ZXJzLCB9IGZyb20gJy4vZGVjb2RlQWJpUGFyYW1ldGVycy5qcyc7XG5pbXBvcnQgeyBnZXRBYmlJdGVtIH0gZnJvbSAnLi9nZXRBYmlJdGVtLmpzJztcbmNvbnN0IGRvY3NQYXRoID0gJy9kb2NzL2NvbnRyYWN0L2RlY29kZUZ1bmN0aW9uUmVzdWx0JztcbmV4cG9ydCBmdW5jdGlvbiBkZWNvZGVGdW5jdGlvblJlc3VsdChwYXJhbWV0ZXJzKSB7XG4gICAgY29uc3QgeyBhYmksIGFyZ3MsIGZ1bmN0aW9uTmFtZSwgZGF0YSB9ID0gcGFyYW1ldGVycztcbiAgICBsZXQgYWJpSXRlbSA9IGFiaVswXTtcbiAgICBpZiAoZnVuY3Rpb25OYW1lKSB7XG4gICAgICAgIGNvbnN0IGl0ZW0gPSBnZXRBYmlJdGVtKHsgYWJpLCBhcmdzLCBuYW1lOiBmdW5jdGlvbk5hbWUgfSk7XG4gICAgICAgIGlmICghaXRlbSlcbiAgICAgICAgICAgIHRocm93IG5ldyBBYmlGdW5jdGlvbk5vdEZvdW5kRXJyb3IoZnVuY3Rpb25OYW1lLCB7IGRvY3NQYXRoIH0pO1xuICAgICAgICBhYmlJdGVtID0gaXRlbTtcbiAgICB9XG4gICAgaWYgKGFiaUl0ZW0udHlwZSAhPT0gJ2Z1bmN0aW9uJylcbiAgICAgICAgdGhyb3cgbmV3IEFiaUZ1bmN0aW9uTm90Rm91bmRFcnJvcih1bmRlZmluZWQsIHsgZG9jc1BhdGggfSk7XG4gICAgaWYgKCFhYmlJdGVtLm91dHB1dHMpXG4gICAgICAgIHRocm93IG5ldyBBYmlGdW5jdGlvbk91dHB1dHNOb3RGb3VuZEVycm9yKGFiaUl0ZW0ubmFtZSwgeyBkb2NzUGF0aCB9KTtcbiAgICBjb25zdCB2YWx1ZXMgPSBkZWNvZGVBYmlQYXJhbWV0ZXJzKGFiaUl0ZW0ub3V0cHV0cywgZGF0YSk7XG4gICAgaWYgKHZhbHVlcyAmJiB2YWx1ZXMubGVuZ3RoID4gMSlcbiAgICAgICAgcmV0dXJuIHZhbHVlcztcbiAgICBpZiAodmFsdWVzICYmIHZhbHVlcy5sZW5ndGggPT09IDEpXG4gICAgICAgIHJldHVybiB2YWx1ZXNbMF07XG4gICAgcmV0dXJuIHVuZGVmaW5lZDtcbn1cbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWRlY29kZUZ1bmN0aW9uUmVzdWx0LmpzLm1hcCIsCiAgICAiaW1wb3J0IHsgQWJpQ29uc3RydWN0b3JOb3RGb3VuZEVycm9yLCBBYmlDb25zdHJ1Y3RvclBhcmFtc05vdEZvdW5kRXJyb3IsIH0gZnJvbSAnLi4vLi4vZXJyb3JzL2FiaS5qcyc7XG5pbXBvcnQgeyBjb25jYXRIZXggfSBmcm9tICcuLi9kYXRhL2NvbmNhdC5qcyc7XG5pbXBvcnQgeyBlbmNvZGVBYmlQYXJhbWV0ZXJzLCB9IGZyb20gJy4vZW5jb2RlQWJpUGFyYW1ldGVycy5qcyc7XG5jb25zdCBkb2NzUGF0aCA9ICcvZG9jcy9jb250cmFjdC9lbmNvZGVEZXBsb3lEYXRhJztcbmV4cG9ydCBmdW5jdGlvbiBlbmNvZGVEZXBsb3lEYXRhKHBhcmFtZXRlcnMpIHtcbiAgICBjb25zdCB7IGFiaSwgYXJncywgYnl0ZWNvZGUgfSA9IHBhcmFtZXRlcnM7XG4gICAgaWYgKCFhcmdzIHx8IGFyZ3MubGVuZ3RoID09PSAwKVxuICAgICAgICByZXR1cm4gYnl0ZWNvZGU7XG4gICAgY29uc3QgZGVzY3JpcHRpb24gPSBhYmkuZmluZCgoeCkgPT4gJ3R5cGUnIGluIHggJiYgeC50eXBlID09PSAnY29uc3RydWN0b3InKTtcbiAgICBpZiAoIWRlc2NyaXB0aW9uKVxuICAgICAgICB0aHJvdyBuZXcgQWJpQ29uc3RydWN0b3JOb3RGb3VuZEVycm9yKHsgZG9jc1BhdGggfSk7XG4gICAgaWYgKCEoJ2lucHV0cycgaW4gZGVzY3JpcHRpb24pKVxuICAgICAgICB0aHJvdyBuZXcgQWJpQ29uc3RydWN0b3JQYXJhbXNOb3RGb3VuZEVycm9yKHsgZG9jc1BhdGggfSk7XG4gICAgaWYgKCFkZXNjcmlwdGlvbi5pbnB1dHMgfHwgZGVzY3JpcHRpb24uaW5wdXRzLmxlbmd0aCA9PT0gMClcbiAgICAgICAgdGhyb3cgbmV3IEFiaUNvbnN0cnVjdG9yUGFyYW1zTm90Rm91bmRFcnJvcih7IGRvY3NQYXRoIH0pO1xuICAgIGNvbnN0IGRhdGEgPSBlbmNvZGVBYmlQYXJhbWV0ZXJzKGRlc2NyaXB0aW9uLmlucHV0cywgYXJncyk7XG4gICAgcmV0dXJuIGNvbmNhdEhleChbYnl0ZWNvZGUsIGRhdGFdKTtcbn1cbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWVuY29kZURlcGxveURhdGEuanMubWFwIiwKICAgICJpbXBvcnQgeyBBYmlGdW5jdGlvbk5vdEZvdW5kRXJyb3IsIH0gZnJvbSAnLi4vLi4vZXJyb3JzL2FiaS5qcyc7XG5pbXBvcnQgeyB0b0Z1bmN0aW9uU2VsZWN0b3IsIH0gZnJvbSAnLi4vaGFzaC90b0Z1bmN0aW9uU2VsZWN0b3IuanMnO1xuaW1wb3J0IHsgZm9ybWF0QWJpSXRlbSB9IGZyb20gJy4vZm9ybWF0QWJpSXRlbS5qcyc7XG5pbXBvcnQgeyBnZXRBYmlJdGVtIH0gZnJvbSAnLi9nZXRBYmlJdGVtLmpzJztcbmNvbnN0IGRvY3NQYXRoID0gJy9kb2NzL2NvbnRyYWN0L2VuY29kZUZ1bmN0aW9uRGF0YSc7XG5leHBvcnQgZnVuY3Rpb24gcHJlcGFyZUVuY29kZUZ1bmN0aW9uRGF0YShwYXJhbWV0ZXJzKSB7XG4gICAgY29uc3QgeyBhYmksIGFyZ3MsIGZ1bmN0aW9uTmFtZSB9ID0gcGFyYW1ldGVycztcbiAgICBsZXQgYWJpSXRlbSA9IGFiaVswXTtcbiAgICBpZiAoZnVuY3Rpb25OYW1lKSB7XG4gICAgICAgIGNvbnN0IGl0ZW0gPSBnZXRBYmlJdGVtKHtcbiAgICAgICAgICAgIGFiaSxcbiAgICAgICAgICAgIGFyZ3MsXG4gICAgICAgICAgICBuYW1lOiBmdW5jdGlvbk5hbWUsXG4gICAgICAgIH0pO1xuICAgICAgICBpZiAoIWl0ZW0pXG4gICAgICAgICAgICB0aHJvdyBuZXcgQWJpRnVuY3Rpb25Ob3RGb3VuZEVycm9yKGZ1bmN0aW9uTmFtZSwgeyBkb2NzUGF0aCB9KTtcbiAgICAgICAgYWJpSXRlbSA9IGl0ZW07XG4gICAgfVxuICAgIGlmIChhYmlJdGVtLnR5cGUgIT09ICdmdW5jdGlvbicpXG4gICAgICAgIHRocm93IG5ldyBBYmlGdW5jdGlvbk5vdEZvdW5kRXJyb3IodW5kZWZpbmVkLCB7IGRvY3NQYXRoIH0pO1xuICAgIHJldHVybiB7XG4gICAgICAgIGFiaTogW2FiaUl0ZW1dLFxuICAgICAgICBmdW5jdGlvbk5hbWU6IHRvRnVuY3Rpb25TZWxlY3Rvcihmb3JtYXRBYmlJdGVtKGFiaUl0ZW0pKSxcbiAgICB9O1xufVxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9cHJlcGFyZUVuY29kZUZ1bmN0aW9uRGF0YS5qcy5tYXAiLAogICAgImltcG9ydCB7IGNvbmNhdEhleCB9IGZyb20gJy4uL2RhdGEvY29uY2F0LmpzJztcbmltcG9ydCB7IGVuY29kZUFiaVBhcmFtZXRlcnMsIH0gZnJvbSAnLi9lbmNvZGVBYmlQYXJhbWV0ZXJzLmpzJztcbmltcG9ydCB7IHByZXBhcmVFbmNvZGVGdW5jdGlvbkRhdGEgfSBmcm9tICcuL3ByZXBhcmVFbmNvZGVGdW5jdGlvbkRhdGEuanMnO1xuZXhwb3J0IGZ1bmN0aW9uIGVuY29kZUZ1bmN0aW9uRGF0YShwYXJhbWV0ZXJzKSB7XG4gICAgY29uc3QgeyBhcmdzIH0gPSBwYXJhbWV0ZXJzO1xuICAgIGNvbnN0IHsgYWJpLCBmdW5jdGlvbk5hbWUgfSA9ICgoKSA9PiB7XG4gICAgICAgIGlmIChwYXJhbWV0ZXJzLmFiaS5sZW5ndGggPT09IDEgJiZcbiAgICAgICAgICAgIHBhcmFtZXRlcnMuZnVuY3Rpb25OYW1lPy5zdGFydHNXaXRoKCcweCcpKVxuICAgICAgICAgICAgcmV0dXJuIHBhcmFtZXRlcnM7XG4gICAgICAgIHJldHVybiBwcmVwYXJlRW5jb2RlRnVuY3Rpb25EYXRhKHBhcmFtZXRlcnMpO1xuICAgIH0pKCk7XG4gICAgY29uc3QgYWJpSXRlbSA9IGFiaVswXTtcbiAgICBjb25zdCBzaWduYXR1cmUgPSBmdW5jdGlvbk5hbWU7XG4gICAgY29uc3QgZGF0YSA9ICdpbnB1dHMnIGluIGFiaUl0ZW0gJiYgYWJpSXRlbS5pbnB1dHNcbiAgICAgICAgPyBlbmNvZGVBYmlQYXJhbWV0ZXJzKGFiaUl0ZW0uaW5wdXRzLCBhcmdzID8/IFtdKVxuICAgICAgICA6IHVuZGVmaW5lZDtcbiAgICByZXR1cm4gY29uY2F0SGV4KFtzaWduYXR1cmUsIGRhdGEgPz8gJzB4J10pO1xufVxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9ZW5jb2RlRnVuY3Rpb25EYXRhLmpzLm1hcCIsCiAgICAiaW1wb3J0IHsgQ2hhaW5Eb2VzTm90U3VwcG9ydENvbnRyYWN0LCB9IGZyb20gJy4uLy4uL2Vycm9ycy9jaGFpbi5qcyc7XG5leHBvcnQgZnVuY3Rpb24gZ2V0Q2hhaW5Db250cmFjdEFkZHJlc3MoeyBibG9ja051bWJlciwgY2hhaW4sIGNvbnRyYWN0OiBuYW1lLCB9KSB7XG4gICAgY29uc3QgY29udHJhY3QgPSBjaGFpbj8uY29udHJhY3RzPy5bbmFtZV07XG4gICAgaWYgKCFjb250cmFjdClcbiAgICAgICAgdGhyb3cgbmV3IENoYWluRG9lc05vdFN1cHBvcnRDb250cmFjdCh7XG4gICAgICAgICAgICBjaGFpbixcbiAgICAgICAgICAgIGNvbnRyYWN0OiB7IG5hbWUgfSxcbiAgICAgICAgfSk7XG4gICAgaWYgKGJsb2NrTnVtYmVyICYmXG4gICAgICAgIGNvbnRyYWN0LmJsb2NrQ3JlYXRlZCAmJlxuICAgICAgICBjb250cmFjdC5ibG9ja0NyZWF0ZWQgPiBibG9ja051bWJlcilcbiAgICAgICAgdGhyb3cgbmV3IENoYWluRG9lc05vdFN1cHBvcnRDb250cmFjdCh7XG4gICAgICAgICAgICBibG9ja051bWJlcixcbiAgICAgICAgICAgIGNoYWluLFxuICAgICAgICAgICAgY29udHJhY3Q6IHtcbiAgICAgICAgICAgICAgICBuYW1lLFxuICAgICAgICAgICAgICAgIGJsb2NrQ3JlYXRlZDogY29udHJhY3QuYmxvY2tDcmVhdGVkLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgfSk7XG4gICAgcmV0dXJuIGNvbnRyYWN0LmFkZHJlc3M7XG59XG4vLyMgc291cmNlTWFwcGluZ1VSTD1nZXRDaGFpbkNvbnRyYWN0QWRkcmVzcy5qcy5tYXAiLAogICAgImltcG9ydCB7IGZvcm1hdEd3ZWkgfSBmcm9tICcuLi91dGlscy91bml0L2Zvcm1hdEd3ZWkuanMnO1xuaW1wb3J0IHsgQmFzZUVycm9yIH0gZnJvbSAnLi9iYXNlLmpzJztcbmV4cG9ydCBjbGFzcyBFeGVjdXRpb25SZXZlcnRlZEVycm9yIGV4dGVuZHMgQmFzZUVycm9yIHtcbiAgICBjb25zdHJ1Y3Rvcih7IGNhdXNlLCBtZXNzYWdlLCB9ID0ge30pIHtcbiAgICAgICAgY29uc3QgcmVhc29uID0gbWVzc2FnZVxuICAgICAgICAgICAgPy5yZXBsYWNlKCdleGVjdXRpb24gcmV2ZXJ0ZWQ6ICcsICcnKVxuICAgICAgICAgICAgPy5yZXBsYWNlKCdleGVjdXRpb24gcmV2ZXJ0ZWQnLCAnJyk7XG4gICAgICAgIHN1cGVyKGBFeGVjdXRpb24gcmV2ZXJ0ZWQgJHtyZWFzb24gPyBgd2l0aCByZWFzb246ICR7cmVhc29ufWAgOiAnZm9yIGFuIHVua25vd24gcmVhc29uJ30uYCwge1xuICAgICAgICAgICAgY2F1c2UsXG4gICAgICAgICAgICBuYW1lOiAnRXhlY3V0aW9uUmV2ZXJ0ZWRFcnJvcicsXG4gICAgICAgIH0pO1xuICAgIH1cbn1cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShFeGVjdXRpb25SZXZlcnRlZEVycm9yLCBcImNvZGVcIiwge1xuICAgIGVudW1lcmFibGU6IHRydWUsXG4gICAgY29uZmlndXJhYmxlOiB0cnVlLFxuICAgIHdyaXRhYmxlOiB0cnVlLFxuICAgIHZhbHVlOiAzXG59KTtcbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShFeGVjdXRpb25SZXZlcnRlZEVycm9yLCBcIm5vZGVNZXNzYWdlXCIsIHtcbiAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgICB3cml0YWJsZTogdHJ1ZSxcbiAgICB2YWx1ZTogL2V4ZWN1dGlvbiByZXZlcnRlZHxnYXMgcmVxdWlyZWQgZXhjZWVkcyBhbGxvd2FuY2UvXG59KTtcbmV4cG9ydCBjbGFzcyBGZWVDYXBUb29IaWdoRXJyb3IgZXh0ZW5kcyBCYXNlRXJyb3Ige1xuICAgIGNvbnN0cnVjdG9yKHsgY2F1c2UsIG1heEZlZVBlckdhcywgfSA9IHt9KSB7XG4gICAgICAgIHN1cGVyKGBUaGUgZmVlIGNhcCAoXFxgbWF4RmVlUGVyR2FzXFxgJHttYXhGZWVQZXJHYXMgPyBgID0gJHtmb3JtYXRHd2VpKG1heEZlZVBlckdhcyl9IGd3ZWlgIDogJyd9KSBjYW5ub3QgYmUgaGlnaGVyIHRoYW4gdGhlIG1heGltdW0gYWxsb3dlZCB2YWx1ZSAoMl4yNTYtMSkuYCwge1xuICAgICAgICAgICAgY2F1c2UsXG4gICAgICAgICAgICBuYW1lOiAnRmVlQ2FwVG9vSGlnaEVycm9yJyxcbiAgICAgICAgfSk7XG4gICAgfVxufVxuT2JqZWN0LmRlZmluZVByb3BlcnR5KEZlZUNhcFRvb0hpZ2hFcnJvciwgXCJub2RlTWVzc2FnZVwiLCB7XG4gICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICBjb25maWd1cmFibGU6IHRydWUsXG4gICAgd3JpdGFibGU6IHRydWUsXG4gICAgdmFsdWU6IC9tYXggZmVlIHBlciBnYXMgaGlnaGVyIHRoYW4gMlxcXjI1Ni0xfGZlZSBjYXAgaGlnaGVyIHRoYW4gMlxcXjI1Ni0xL1xufSk7XG5leHBvcnQgY2xhc3MgRmVlQ2FwVG9vTG93RXJyb3IgZXh0ZW5kcyBCYXNlRXJyb3Ige1xuICAgIGNvbnN0cnVjdG9yKHsgY2F1c2UsIG1heEZlZVBlckdhcywgfSA9IHt9KSB7XG4gICAgICAgIHN1cGVyKGBUaGUgZmVlIGNhcCAoXFxgbWF4RmVlUGVyR2FzXFxgJHttYXhGZWVQZXJHYXMgPyBgID0gJHtmb3JtYXRHd2VpKG1heEZlZVBlckdhcyl9YCA6ICcnfSBnd2VpKSBjYW5ub3QgYmUgbG93ZXIgdGhhbiB0aGUgYmxvY2sgYmFzZSBmZWUuYCwge1xuICAgICAgICAgICAgY2F1c2UsXG4gICAgICAgICAgICBuYW1lOiAnRmVlQ2FwVG9vTG93RXJyb3InLFxuICAgICAgICB9KTtcbiAgICB9XG59XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoRmVlQ2FwVG9vTG93RXJyb3IsIFwibm9kZU1lc3NhZ2VcIiwge1xuICAgIGVudW1lcmFibGU6IHRydWUsXG4gICAgY29uZmlndXJhYmxlOiB0cnVlLFxuICAgIHdyaXRhYmxlOiB0cnVlLFxuICAgIHZhbHVlOiAvbWF4IGZlZSBwZXIgZ2FzIGxlc3MgdGhhbiBibG9jayBiYXNlIGZlZXxmZWUgY2FwIGxlc3MgdGhhbiBibG9jayBiYXNlIGZlZXx0cmFuc2FjdGlvbiBpcyBvdXRkYXRlZC9cbn0pO1xuZXhwb3J0IGNsYXNzIE5vbmNlVG9vSGlnaEVycm9yIGV4dGVuZHMgQmFzZUVycm9yIHtcbiAgICBjb25zdHJ1Y3Rvcih7IGNhdXNlLCBub25jZSwgfSA9IHt9KSB7XG4gICAgICAgIHN1cGVyKGBOb25jZSBwcm92aWRlZCBmb3IgdGhlIHRyYW5zYWN0aW9uICR7bm9uY2UgPyBgKCR7bm9uY2V9KSBgIDogJyd9aXMgaGlnaGVyIHRoYW4gdGhlIG5leHQgb25lIGV4cGVjdGVkLmAsIHsgY2F1c2UsIG5hbWU6ICdOb25jZVRvb0hpZ2hFcnJvcicgfSk7XG4gICAgfVxufVxuT2JqZWN0LmRlZmluZVByb3BlcnR5KE5vbmNlVG9vSGlnaEVycm9yLCBcIm5vZGVNZXNzYWdlXCIsIHtcbiAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgICB3cml0YWJsZTogdHJ1ZSxcbiAgICB2YWx1ZTogL25vbmNlIHRvbyBoaWdoL1xufSk7XG5leHBvcnQgY2xhc3MgTm9uY2VUb29Mb3dFcnJvciBleHRlbmRzIEJhc2VFcnJvciB7XG4gICAgY29uc3RydWN0b3IoeyBjYXVzZSwgbm9uY2UsIH0gPSB7fSkge1xuICAgICAgICBzdXBlcihbXG4gICAgICAgICAgICBgTm9uY2UgcHJvdmlkZWQgZm9yIHRoZSB0cmFuc2FjdGlvbiAke25vbmNlID8gYCgke25vbmNlfSkgYCA6ICcnfWlzIGxvd2VyIHRoYW4gdGhlIGN1cnJlbnQgbm9uY2Ugb2YgdGhlIGFjY291bnQuYCxcbiAgICAgICAgICAgICdUcnkgaW5jcmVhc2luZyB0aGUgbm9uY2Ugb3IgZmluZCB0aGUgbGF0ZXN0IG5vbmNlIHdpdGggYGdldFRyYW5zYWN0aW9uQ291bnRgLicsXG4gICAgICAgIF0uam9pbignXFxuJyksIHsgY2F1c2UsIG5hbWU6ICdOb25jZVRvb0xvd0Vycm9yJyB9KTtcbiAgICB9XG59XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoTm9uY2VUb29Mb3dFcnJvciwgXCJub2RlTWVzc2FnZVwiLCB7XG4gICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICBjb25maWd1cmFibGU6IHRydWUsXG4gICAgd3JpdGFibGU6IHRydWUsXG4gICAgdmFsdWU6IC9ub25jZSB0b28gbG93fHRyYW5zYWN0aW9uIGFscmVhZHkgaW1wb3J0ZWR8YWxyZWFkeSBrbm93bi9cbn0pO1xuZXhwb3J0IGNsYXNzIE5vbmNlTWF4VmFsdWVFcnJvciBleHRlbmRzIEJhc2VFcnJvciB7XG4gICAgY29uc3RydWN0b3IoeyBjYXVzZSwgbm9uY2UsIH0gPSB7fSkge1xuICAgICAgICBzdXBlcihgTm9uY2UgcHJvdmlkZWQgZm9yIHRoZSB0cmFuc2FjdGlvbiAke25vbmNlID8gYCgke25vbmNlfSkgYCA6ICcnfWV4Y2VlZHMgdGhlIG1heGltdW0gYWxsb3dlZCBub25jZS5gLCB7IGNhdXNlLCBuYW1lOiAnTm9uY2VNYXhWYWx1ZUVycm9yJyB9KTtcbiAgICB9XG59XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoTm9uY2VNYXhWYWx1ZUVycm9yLCBcIm5vZGVNZXNzYWdlXCIsIHtcbiAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgICB3cml0YWJsZTogdHJ1ZSxcbiAgICB2YWx1ZTogL25vbmNlIGhhcyBtYXggdmFsdWUvXG59KTtcbmV4cG9ydCBjbGFzcyBJbnN1ZmZpY2llbnRGdW5kc0Vycm9yIGV4dGVuZHMgQmFzZUVycm9yIHtcbiAgICBjb25zdHJ1Y3Rvcih7IGNhdXNlIH0gPSB7fSkge1xuICAgICAgICBzdXBlcihbXG4gICAgICAgICAgICAnVGhlIHRvdGFsIGNvc3QgKGdhcyAqIGdhcyBmZWUgKyB2YWx1ZSkgb2YgZXhlY3V0aW5nIHRoaXMgdHJhbnNhY3Rpb24gZXhjZWVkcyB0aGUgYmFsYW5jZSBvZiB0aGUgYWNjb3VudC4nLFxuICAgICAgICBdLmpvaW4oJ1xcbicpLCB7XG4gICAgICAgICAgICBjYXVzZSxcbiAgICAgICAgICAgIG1ldGFNZXNzYWdlczogW1xuICAgICAgICAgICAgICAgICdUaGlzIGVycm9yIGNvdWxkIGFyaXNlIHdoZW4gdGhlIGFjY291bnQgZG9lcyBub3QgaGF2ZSBlbm91Z2ggZnVuZHMgdG86JyxcbiAgICAgICAgICAgICAgICAnIC0gcGF5IGZvciB0aGUgdG90YWwgZ2FzIGZlZSwnLFxuICAgICAgICAgICAgICAgICcgLSBwYXkgZm9yIHRoZSB2YWx1ZSB0byBzZW5kLicsXG4gICAgICAgICAgICAgICAgJyAnLFxuICAgICAgICAgICAgICAgICdUaGUgY29zdCBvZiB0aGUgdHJhbnNhY3Rpb24gaXMgY2FsY3VsYXRlZCBhcyBgZ2FzICogZ2FzIGZlZSArIHZhbHVlYCwgd2hlcmU6JyxcbiAgICAgICAgICAgICAgICAnIC0gYGdhc2AgaXMgdGhlIGFtb3VudCBvZiBnYXMgbmVlZGVkIGZvciB0cmFuc2FjdGlvbiB0byBleGVjdXRlLCcsXG4gICAgICAgICAgICAgICAgJyAtIGBnYXMgZmVlYCBpcyB0aGUgZ2FzIGZlZSwnLFxuICAgICAgICAgICAgICAgICcgLSBgdmFsdWVgIGlzIHRoZSBhbW91bnQgb2YgZXRoZXIgdG8gc2VuZCB0byB0aGUgcmVjaXBpZW50LicsXG4gICAgICAgICAgICBdLFxuICAgICAgICAgICAgbmFtZTogJ0luc3VmZmljaWVudEZ1bmRzRXJyb3InLFxuICAgICAgICB9KTtcbiAgICB9XG59XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoSW5zdWZmaWNpZW50RnVuZHNFcnJvciwgXCJub2RlTWVzc2FnZVwiLCB7XG4gICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICBjb25maWd1cmFibGU6IHRydWUsXG4gICAgd3JpdGFibGU6IHRydWUsXG4gICAgdmFsdWU6IC9pbnN1ZmZpY2llbnQgZnVuZHN8ZXhjZWVkcyB0cmFuc2FjdGlvbiBzZW5kZXIgYWNjb3VudCBiYWxhbmNlL1xufSk7XG5leHBvcnQgY2xhc3MgSW50cmluc2ljR2FzVG9vSGlnaEVycm9yIGV4dGVuZHMgQmFzZUVycm9yIHtcbiAgICBjb25zdHJ1Y3Rvcih7IGNhdXNlLCBnYXMsIH0gPSB7fSkge1xuICAgICAgICBzdXBlcihgVGhlIGFtb3VudCBvZiBnYXMgJHtnYXMgPyBgKCR7Z2FzfSkgYCA6ICcnfXByb3ZpZGVkIGZvciB0aGUgdHJhbnNhY3Rpb24gZXhjZWVkcyB0aGUgbGltaXQgYWxsb3dlZCBmb3IgdGhlIGJsb2NrLmAsIHtcbiAgICAgICAgICAgIGNhdXNlLFxuICAgICAgICAgICAgbmFtZTogJ0ludHJpbnNpY0dhc1Rvb0hpZ2hFcnJvcicsXG4gICAgICAgIH0pO1xuICAgIH1cbn1cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShJbnRyaW5zaWNHYXNUb29IaWdoRXJyb3IsIFwibm9kZU1lc3NhZ2VcIiwge1xuICAgIGVudW1lcmFibGU6IHRydWUsXG4gICAgY29uZmlndXJhYmxlOiB0cnVlLFxuICAgIHdyaXRhYmxlOiB0cnVlLFxuICAgIHZhbHVlOiAvaW50cmluc2ljIGdhcyB0b28gaGlnaHxnYXMgbGltaXQgcmVhY2hlZC9cbn0pO1xuZXhwb3J0IGNsYXNzIEludHJpbnNpY0dhc1Rvb0xvd0Vycm9yIGV4dGVuZHMgQmFzZUVycm9yIHtcbiAgICBjb25zdHJ1Y3Rvcih7IGNhdXNlLCBnYXMsIH0gPSB7fSkge1xuICAgICAgICBzdXBlcihgVGhlIGFtb3VudCBvZiBnYXMgJHtnYXMgPyBgKCR7Z2FzfSkgYCA6ICcnfXByb3ZpZGVkIGZvciB0aGUgdHJhbnNhY3Rpb24gaXMgdG9vIGxvdy5gLCB7XG4gICAgICAgICAgICBjYXVzZSxcbiAgICAgICAgICAgIG5hbWU6ICdJbnRyaW5zaWNHYXNUb29Mb3dFcnJvcicsXG4gICAgICAgIH0pO1xuICAgIH1cbn1cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShJbnRyaW5zaWNHYXNUb29Mb3dFcnJvciwgXCJub2RlTWVzc2FnZVwiLCB7XG4gICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICBjb25maWd1cmFibGU6IHRydWUsXG4gICAgd3JpdGFibGU6IHRydWUsXG4gICAgdmFsdWU6IC9pbnRyaW5zaWMgZ2FzIHRvbyBsb3cvXG59KTtcbmV4cG9ydCBjbGFzcyBUcmFuc2FjdGlvblR5cGVOb3RTdXBwb3J0ZWRFcnJvciBleHRlbmRzIEJhc2VFcnJvciB7XG4gICAgY29uc3RydWN0b3IoeyBjYXVzZSB9KSB7XG4gICAgICAgIHN1cGVyKCdUaGUgdHJhbnNhY3Rpb24gdHlwZSBpcyBub3Qgc3VwcG9ydGVkIGZvciB0aGlzIGNoYWluLicsIHtcbiAgICAgICAgICAgIGNhdXNlLFxuICAgICAgICAgICAgbmFtZTogJ1RyYW5zYWN0aW9uVHlwZU5vdFN1cHBvcnRlZEVycm9yJyxcbiAgICAgICAgfSk7XG4gICAgfVxufVxuT2JqZWN0LmRlZmluZVByb3BlcnR5KFRyYW5zYWN0aW9uVHlwZU5vdFN1cHBvcnRlZEVycm9yLCBcIm5vZGVNZXNzYWdlXCIsIHtcbiAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgICB3cml0YWJsZTogdHJ1ZSxcbiAgICB2YWx1ZTogL3RyYW5zYWN0aW9uIHR5cGUgbm90IHZhbGlkL1xufSk7XG5leHBvcnQgY2xhc3MgVGlwQWJvdmVGZWVDYXBFcnJvciBleHRlbmRzIEJhc2VFcnJvciB7XG4gICAgY29uc3RydWN0b3IoeyBjYXVzZSwgbWF4UHJpb3JpdHlGZWVQZXJHYXMsIG1heEZlZVBlckdhcywgfSA9IHt9KSB7XG4gICAgICAgIHN1cGVyKFtcbiAgICAgICAgICAgIGBUaGUgcHJvdmlkZWQgdGlwIChcXGBtYXhQcmlvcml0eUZlZVBlckdhc1xcYCR7bWF4UHJpb3JpdHlGZWVQZXJHYXNcbiAgICAgICAgICAgICAgICA/IGAgPSAke2Zvcm1hdEd3ZWkobWF4UHJpb3JpdHlGZWVQZXJHYXMpfSBnd2VpYFxuICAgICAgICAgICAgICAgIDogJyd9KSBjYW5ub3QgYmUgaGlnaGVyIHRoYW4gdGhlIGZlZSBjYXAgKFxcYG1heEZlZVBlckdhc1xcYCR7bWF4RmVlUGVyR2FzID8gYCA9ICR7Zm9ybWF0R3dlaShtYXhGZWVQZXJHYXMpfSBnd2VpYCA6ICcnfSkuYCxcbiAgICAgICAgXS5qb2luKCdcXG4nKSwge1xuICAgICAgICAgICAgY2F1c2UsXG4gICAgICAgICAgICBuYW1lOiAnVGlwQWJvdmVGZWVDYXBFcnJvcicsXG4gICAgICAgIH0pO1xuICAgIH1cbn1cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShUaXBBYm92ZUZlZUNhcEVycm9yLCBcIm5vZGVNZXNzYWdlXCIsIHtcbiAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgICB3cml0YWJsZTogdHJ1ZSxcbiAgICB2YWx1ZTogL21heCBwcmlvcml0eSBmZWUgcGVyIGdhcyBoaWdoZXIgdGhhbiBtYXggZmVlIHBlciBnYXN8dGlwIGhpZ2hlciB0aGFuIGZlZSBjYXAvXG59KTtcbmV4cG9ydCBjbGFzcyBVbmtub3duTm9kZUVycm9yIGV4dGVuZHMgQmFzZUVycm9yIHtcbiAgICBjb25zdHJ1Y3Rvcih7IGNhdXNlIH0pIHtcbiAgICAgICAgc3VwZXIoYEFuIGVycm9yIG9jY3VycmVkIHdoaWxlIGV4ZWN1dGluZzogJHtjYXVzZT8uc2hvcnRNZXNzYWdlfWAsIHtcbiAgICAgICAgICAgIGNhdXNlLFxuICAgICAgICAgICAgbmFtZTogJ1Vua25vd25Ob2RlRXJyb3InLFxuICAgICAgICB9KTtcbiAgICB9XG59XG4vLyMgc291cmNlTWFwcGluZ1VSTD1ub2RlLmpzLm1hcCIsCiAgICAiaW1wb3J0IHsgc3RyaW5naWZ5IH0gZnJvbSAnLi4vdXRpbHMvc3RyaW5naWZ5LmpzJztcbmltcG9ydCB7IEJhc2VFcnJvciB9IGZyb20gJy4vYmFzZS5qcyc7XG5pbXBvcnQgeyBnZXRVcmwgfSBmcm9tICcuL3V0aWxzLmpzJztcbmV4cG9ydCBjbGFzcyBIdHRwUmVxdWVzdEVycm9yIGV4dGVuZHMgQmFzZUVycm9yIHtcbiAgICBjb25zdHJ1Y3Rvcih7IGJvZHksIGNhdXNlLCBkZXRhaWxzLCBoZWFkZXJzLCBzdGF0dXMsIHVybCwgfSkge1xuICAgICAgICBzdXBlcignSFRUUCByZXF1ZXN0IGZhaWxlZC4nLCB7XG4gICAgICAgICAgICBjYXVzZSxcbiAgICAgICAgICAgIGRldGFpbHMsXG4gICAgICAgICAgICBtZXRhTWVzc2FnZXM6IFtcbiAgICAgICAgICAgICAgICBzdGF0dXMgJiYgYFN0YXR1czogJHtzdGF0dXN9YCxcbiAgICAgICAgICAgICAgICBgVVJMOiAke2dldFVybCh1cmwpfWAsXG4gICAgICAgICAgICAgICAgYm9keSAmJiBgUmVxdWVzdCBib2R5OiAke3N0cmluZ2lmeShib2R5KX1gLFxuICAgICAgICAgICAgXS5maWx0ZXIoQm9vbGVhbiksXG4gICAgICAgICAgICBuYW1lOiAnSHR0cFJlcXVlc3RFcnJvcicsXG4gICAgICAgIH0pO1xuICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkodGhpcywgXCJib2R5XCIsIHtcbiAgICAgICAgICAgIGVudW1lcmFibGU6IHRydWUsXG4gICAgICAgICAgICBjb25maWd1cmFibGU6IHRydWUsXG4gICAgICAgICAgICB3cml0YWJsZTogdHJ1ZSxcbiAgICAgICAgICAgIHZhbHVlOiB2b2lkIDBcbiAgICAgICAgfSk7XG4gICAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0aGlzLCBcImhlYWRlcnNcIiwge1xuICAgICAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICAgICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgICAgICAgICAgIHdyaXRhYmxlOiB0cnVlLFxuICAgICAgICAgICAgdmFsdWU6IHZvaWQgMFxuICAgICAgICB9KTtcbiAgICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRoaXMsIFwic3RhdHVzXCIsIHtcbiAgICAgICAgICAgIGVudW1lcmFibGU6IHRydWUsXG4gICAgICAgICAgICBjb25maWd1cmFibGU6IHRydWUsXG4gICAgICAgICAgICB3cml0YWJsZTogdHJ1ZSxcbiAgICAgICAgICAgIHZhbHVlOiB2b2lkIDBcbiAgICAgICAgfSk7XG4gICAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0aGlzLCBcInVybFwiLCB7XG4gICAgICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlLFxuICAgICAgICAgICAgd3JpdGFibGU6IHRydWUsXG4gICAgICAgICAgICB2YWx1ZTogdm9pZCAwXG4gICAgICAgIH0pO1xuICAgICAgICB0aGlzLmJvZHkgPSBib2R5O1xuICAgICAgICB0aGlzLmhlYWRlcnMgPSBoZWFkZXJzO1xuICAgICAgICB0aGlzLnN0YXR1cyA9IHN0YXR1cztcbiAgICAgICAgdGhpcy51cmwgPSB1cmw7XG4gICAgfVxufVxuZXhwb3J0IGNsYXNzIFdlYlNvY2tldFJlcXVlc3RFcnJvciBleHRlbmRzIEJhc2VFcnJvciB7XG4gICAgY29uc3RydWN0b3IoeyBib2R5LCBjYXVzZSwgZGV0YWlscywgdXJsLCB9KSB7XG4gICAgICAgIHN1cGVyKCdXZWJTb2NrZXQgcmVxdWVzdCBmYWlsZWQuJywge1xuICAgICAgICAgICAgY2F1c2UsXG4gICAgICAgICAgICBkZXRhaWxzLFxuICAgICAgICAgICAgbWV0YU1lc3NhZ2VzOiBbXG4gICAgICAgICAgICAgICAgYFVSTDogJHtnZXRVcmwodXJsKX1gLFxuICAgICAgICAgICAgICAgIGJvZHkgJiYgYFJlcXVlc3QgYm9keTogJHtzdHJpbmdpZnkoYm9keSl9YCxcbiAgICAgICAgICAgIF0uZmlsdGVyKEJvb2xlYW4pLFxuICAgICAgICAgICAgbmFtZTogJ1dlYlNvY2tldFJlcXVlc3RFcnJvcicsXG4gICAgICAgIH0pO1xuICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkodGhpcywgXCJ1cmxcIiwge1xuICAgICAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICAgICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgICAgICAgICAgIHdyaXRhYmxlOiB0cnVlLFxuICAgICAgICAgICAgdmFsdWU6IHZvaWQgMFxuICAgICAgICB9KTtcbiAgICAgICAgdGhpcy51cmwgPSB1cmw7XG4gICAgfVxufVxuZXhwb3J0IGNsYXNzIFJwY1JlcXVlc3RFcnJvciBleHRlbmRzIEJhc2VFcnJvciB7XG4gICAgY29uc3RydWN0b3IoeyBib2R5LCBlcnJvciwgdXJsLCB9KSB7XG4gICAgICAgIHN1cGVyKCdSUEMgUmVxdWVzdCBmYWlsZWQuJywge1xuICAgICAgICAgICAgY2F1c2U6IGVycm9yLFxuICAgICAgICAgICAgZGV0YWlsczogZXJyb3IubWVzc2FnZSxcbiAgICAgICAgICAgIG1ldGFNZXNzYWdlczogW2BVUkw6ICR7Z2V0VXJsKHVybCl9YCwgYFJlcXVlc3QgYm9keTogJHtzdHJpbmdpZnkoYm9keSl9YF0sXG4gICAgICAgICAgICBuYW1lOiAnUnBjUmVxdWVzdEVycm9yJyxcbiAgICAgICAgfSk7XG4gICAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0aGlzLCBcImNvZGVcIiwge1xuICAgICAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICAgICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgICAgICAgICAgIHdyaXRhYmxlOiB0cnVlLFxuICAgICAgICAgICAgdmFsdWU6IHZvaWQgMFxuICAgICAgICB9KTtcbiAgICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRoaXMsIFwiZGF0YVwiLCB7XG4gICAgICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlLFxuICAgICAgICAgICAgd3JpdGFibGU6IHRydWUsXG4gICAgICAgICAgICB2YWx1ZTogdm9pZCAwXG4gICAgICAgIH0pO1xuICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkodGhpcywgXCJ1cmxcIiwge1xuICAgICAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICAgICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgICAgICAgICAgIHdyaXRhYmxlOiB0cnVlLFxuICAgICAgICAgICAgdmFsdWU6IHZvaWQgMFxuICAgICAgICB9KTtcbiAgICAgICAgdGhpcy5jb2RlID0gZXJyb3IuY29kZTtcbiAgICAgICAgdGhpcy5kYXRhID0gZXJyb3IuZGF0YTtcbiAgICAgICAgdGhpcy51cmwgPSB1cmw7XG4gICAgfVxufVxuZXhwb3J0IGNsYXNzIFNvY2tldENsb3NlZEVycm9yIGV4dGVuZHMgQmFzZUVycm9yIHtcbiAgICBjb25zdHJ1Y3Rvcih7IHVybCwgfSA9IHt9KSB7XG4gICAgICAgIHN1cGVyKCdUaGUgc29ja2V0IGhhcyBiZWVuIGNsb3NlZC4nLCB7XG4gICAgICAgICAgICBtZXRhTWVzc2FnZXM6IFt1cmwgJiYgYFVSTDogJHtnZXRVcmwodXJsKX1gXS5maWx0ZXIoQm9vbGVhbiksXG4gICAgICAgICAgICBuYW1lOiAnU29ja2V0Q2xvc2VkRXJyb3InLFxuICAgICAgICB9KTtcbiAgICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRoaXMsIFwidXJsXCIsIHtcbiAgICAgICAgICAgIGVudW1lcmFibGU6IHRydWUsXG4gICAgICAgICAgICBjb25maWd1cmFibGU6IHRydWUsXG4gICAgICAgICAgICB3cml0YWJsZTogdHJ1ZSxcbiAgICAgICAgICAgIHZhbHVlOiB2b2lkIDBcbiAgICAgICAgfSk7XG4gICAgICAgIHRoaXMudXJsID0gdXJsO1xuICAgIH1cbn1cbmV4cG9ydCBjbGFzcyBUaW1lb3V0RXJyb3IgZXh0ZW5kcyBCYXNlRXJyb3Ige1xuICAgIGNvbnN0cnVjdG9yKHsgYm9keSwgdXJsLCB9KSB7XG4gICAgICAgIHN1cGVyKCdUaGUgcmVxdWVzdCB0b29rIHRvbyBsb25nIHRvIHJlc3BvbmQuJywge1xuICAgICAgICAgICAgZGV0YWlsczogJ1RoZSByZXF1ZXN0IHRpbWVkIG91dC4nLFxuICAgICAgICAgICAgbWV0YU1lc3NhZ2VzOiBbYFVSTDogJHtnZXRVcmwodXJsKX1gLCBgUmVxdWVzdCBib2R5OiAke3N0cmluZ2lmeShib2R5KX1gXSxcbiAgICAgICAgICAgIG5hbWU6ICdUaW1lb3V0RXJyb3InLFxuICAgICAgICB9KTtcbiAgICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRoaXMsIFwidXJsXCIsIHtcbiAgICAgICAgICAgIGVudW1lcmFibGU6IHRydWUsXG4gICAgICAgICAgICBjb25maWd1cmFibGU6IHRydWUsXG4gICAgICAgICAgICB3cml0YWJsZTogdHJ1ZSxcbiAgICAgICAgICAgIHZhbHVlOiB2b2lkIDBcbiAgICAgICAgfSk7XG4gICAgICAgIHRoaXMudXJsID0gdXJsO1xuICAgIH1cbn1cbi8vIyBzb3VyY2VNYXBwaW5nVVJMPXJlcXVlc3QuanMubWFwIiwKICAgICJpbXBvcnQgeyBCYXNlRXJyb3IgfSBmcm9tICcuL2Jhc2UuanMnO1xuaW1wb3J0IHsgUnBjUmVxdWVzdEVycm9yIH0gZnJvbSAnLi9yZXF1ZXN0LmpzJztcbmNvbnN0IHVua25vd25FcnJvckNvZGUgPSAtMTtcbmV4cG9ydCBjbGFzcyBScGNFcnJvciBleHRlbmRzIEJhc2VFcnJvciB7XG4gICAgY29uc3RydWN0b3IoY2F1c2UsIHsgY29kZSwgZG9jc1BhdGgsIG1ldGFNZXNzYWdlcywgbmFtZSwgc2hvcnRNZXNzYWdlLCB9KSB7XG4gICAgICAgIHN1cGVyKHNob3J0TWVzc2FnZSwge1xuICAgICAgICAgICAgY2F1c2UsXG4gICAgICAgICAgICBkb2NzUGF0aCxcbiAgICAgICAgICAgIG1ldGFNZXNzYWdlczogbWV0YU1lc3NhZ2VzIHx8IGNhdXNlPy5tZXRhTWVzc2FnZXMsXG4gICAgICAgICAgICBuYW1lOiBuYW1lIHx8ICdScGNFcnJvcicsXG4gICAgICAgIH0pO1xuICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkodGhpcywgXCJjb2RlXCIsIHtcbiAgICAgICAgICAgIGVudW1lcmFibGU6IHRydWUsXG4gICAgICAgICAgICBjb25maWd1cmFibGU6IHRydWUsXG4gICAgICAgICAgICB3cml0YWJsZTogdHJ1ZSxcbiAgICAgICAgICAgIHZhbHVlOiB2b2lkIDBcbiAgICAgICAgfSk7XG4gICAgICAgIHRoaXMubmFtZSA9IG5hbWUgfHwgY2F1c2UubmFtZTtcbiAgICAgICAgdGhpcy5jb2RlID0gKGNhdXNlIGluc3RhbmNlb2YgUnBjUmVxdWVzdEVycm9yID8gY2F1c2UuY29kZSA6IChjb2RlID8/IHVua25vd25FcnJvckNvZGUpKTtcbiAgICB9XG59XG5leHBvcnQgY2xhc3MgUHJvdmlkZXJScGNFcnJvciBleHRlbmRzIFJwY0Vycm9yIHtcbiAgICBjb25zdHJ1Y3RvcihjYXVzZSwgb3B0aW9ucykge1xuICAgICAgICBzdXBlcihjYXVzZSwgb3B0aW9ucyk7XG4gICAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0aGlzLCBcImRhdGFcIiwge1xuICAgICAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICAgICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgICAgICAgICAgIHdyaXRhYmxlOiB0cnVlLFxuICAgICAgICAgICAgdmFsdWU6IHZvaWQgMFxuICAgICAgICB9KTtcbiAgICAgICAgdGhpcy5kYXRhID0gb3B0aW9ucy5kYXRhO1xuICAgIH1cbn1cbmV4cG9ydCBjbGFzcyBQYXJzZVJwY0Vycm9yIGV4dGVuZHMgUnBjRXJyb3Ige1xuICAgIGNvbnN0cnVjdG9yKGNhdXNlKSB7XG4gICAgICAgIHN1cGVyKGNhdXNlLCB7XG4gICAgICAgICAgICBjb2RlOiBQYXJzZVJwY0Vycm9yLmNvZGUsXG4gICAgICAgICAgICBuYW1lOiAnUGFyc2VScGNFcnJvcicsXG4gICAgICAgICAgICBzaG9ydE1lc3NhZ2U6ICdJbnZhbGlkIEpTT04gd2FzIHJlY2VpdmVkIGJ5IHRoZSBzZXJ2ZXIuIEFuIGVycm9yIG9jY3VycmVkIG9uIHRoZSBzZXJ2ZXIgd2hpbGUgcGFyc2luZyB0aGUgSlNPTiB0ZXh0LicsXG4gICAgICAgIH0pO1xuICAgIH1cbn1cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShQYXJzZVJwY0Vycm9yLCBcImNvZGVcIiwge1xuICAgIGVudW1lcmFibGU6IHRydWUsXG4gICAgY29uZmlndXJhYmxlOiB0cnVlLFxuICAgIHdyaXRhYmxlOiB0cnVlLFxuICAgIHZhbHVlOiAtMzI3MDBcbn0pO1xuZXhwb3J0IGNsYXNzIEludmFsaWRSZXF1ZXN0UnBjRXJyb3IgZXh0ZW5kcyBScGNFcnJvciB7XG4gICAgY29uc3RydWN0b3IoY2F1c2UpIHtcbiAgICAgICAgc3VwZXIoY2F1c2UsIHtcbiAgICAgICAgICAgIGNvZGU6IEludmFsaWRSZXF1ZXN0UnBjRXJyb3IuY29kZSxcbiAgICAgICAgICAgIG5hbWU6ICdJbnZhbGlkUmVxdWVzdFJwY0Vycm9yJyxcbiAgICAgICAgICAgIHNob3J0TWVzc2FnZTogJ0pTT04gaXMgbm90IGEgdmFsaWQgcmVxdWVzdCBvYmplY3QuJyxcbiAgICAgICAgfSk7XG4gICAgfVxufVxuT2JqZWN0LmRlZmluZVByb3BlcnR5KEludmFsaWRSZXF1ZXN0UnBjRXJyb3IsIFwiY29kZVwiLCB7XG4gICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICBjb25maWd1cmFibGU6IHRydWUsXG4gICAgd3JpdGFibGU6IHRydWUsXG4gICAgdmFsdWU6IC0zMjYwMFxufSk7XG5leHBvcnQgY2xhc3MgTWV0aG9kTm90Rm91bmRScGNFcnJvciBleHRlbmRzIFJwY0Vycm9yIHtcbiAgICBjb25zdHJ1Y3RvcihjYXVzZSwgeyBtZXRob2QgfSA9IHt9KSB7XG4gICAgICAgIHN1cGVyKGNhdXNlLCB7XG4gICAgICAgICAgICBjb2RlOiBNZXRob2ROb3RGb3VuZFJwY0Vycm9yLmNvZGUsXG4gICAgICAgICAgICBuYW1lOiAnTWV0aG9kTm90Rm91bmRScGNFcnJvcicsXG4gICAgICAgICAgICBzaG9ydE1lc3NhZ2U6IGBUaGUgbWV0aG9kJHttZXRob2QgPyBgIFwiJHttZXRob2R9XCJgIDogJyd9IGRvZXMgbm90IGV4aXN0IC8gaXMgbm90IGF2YWlsYWJsZS5gLFxuICAgICAgICB9KTtcbiAgICB9XG59XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoTWV0aG9kTm90Rm91bmRScGNFcnJvciwgXCJjb2RlXCIsIHtcbiAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgICB3cml0YWJsZTogdHJ1ZSxcbiAgICB2YWx1ZTogLTMyNjAxXG59KTtcbmV4cG9ydCBjbGFzcyBJbnZhbGlkUGFyYW1zUnBjRXJyb3IgZXh0ZW5kcyBScGNFcnJvciB7XG4gICAgY29uc3RydWN0b3IoY2F1c2UpIHtcbiAgICAgICAgc3VwZXIoY2F1c2UsIHtcbiAgICAgICAgICAgIGNvZGU6IEludmFsaWRQYXJhbXNScGNFcnJvci5jb2RlLFxuICAgICAgICAgICAgbmFtZTogJ0ludmFsaWRQYXJhbXNScGNFcnJvcicsXG4gICAgICAgICAgICBzaG9ydE1lc3NhZ2U6IFtcbiAgICAgICAgICAgICAgICAnSW52YWxpZCBwYXJhbWV0ZXJzIHdlcmUgcHJvdmlkZWQgdG8gdGhlIFJQQyBtZXRob2QuJyxcbiAgICAgICAgICAgICAgICAnRG91YmxlIGNoZWNrIHlvdSBoYXZlIHByb3ZpZGVkIHRoZSBjb3JyZWN0IHBhcmFtZXRlcnMuJyxcbiAgICAgICAgICAgIF0uam9pbignXFxuJyksXG4gICAgICAgIH0pO1xuICAgIH1cbn1cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShJbnZhbGlkUGFyYW1zUnBjRXJyb3IsIFwiY29kZVwiLCB7XG4gICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICBjb25maWd1cmFibGU6IHRydWUsXG4gICAgd3JpdGFibGU6IHRydWUsXG4gICAgdmFsdWU6IC0zMjYwMlxufSk7XG5leHBvcnQgY2xhc3MgSW50ZXJuYWxScGNFcnJvciBleHRlbmRzIFJwY0Vycm9yIHtcbiAgICBjb25zdHJ1Y3RvcihjYXVzZSkge1xuICAgICAgICBzdXBlcihjYXVzZSwge1xuICAgICAgICAgICAgY29kZTogSW50ZXJuYWxScGNFcnJvci5jb2RlLFxuICAgICAgICAgICAgbmFtZTogJ0ludGVybmFsUnBjRXJyb3InLFxuICAgICAgICAgICAgc2hvcnRNZXNzYWdlOiAnQW4gaW50ZXJuYWwgZXJyb3Igd2FzIHJlY2VpdmVkLicsXG4gICAgICAgIH0pO1xuICAgIH1cbn1cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShJbnRlcm5hbFJwY0Vycm9yLCBcImNvZGVcIiwge1xuICAgIGVudW1lcmFibGU6IHRydWUsXG4gICAgY29uZmlndXJhYmxlOiB0cnVlLFxuICAgIHdyaXRhYmxlOiB0cnVlLFxuICAgIHZhbHVlOiAtMzI2MDNcbn0pO1xuZXhwb3J0IGNsYXNzIEludmFsaWRJbnB1dFJwY0Vycm9yIGV4dGVuZHMgUnBjRXJyb3Ige1xuICAgIGNvbnN0cnVjdG9yKGNhdXNlKSB7XG4gICAgICAgIHN1cGVyKGNhdXNlLCB7XG4gICAgICAgICAgICBjb2RlOiBJbnZhbGlkSW5wdXRScGNFcnJvci5jb2RlLFxuICAgICAgICAgICAgbmFtZTogJ0ludmFsaWRJbnB1dFJwY0Vycm9yJyxcbiAgICAgICAgICAgIHNob3J0TWVzc2FnZTogW1xuICAgICAgICAgICAgICAgICdNaXNzaW5nIG9yIGludmFsaWQgcGFyYW1ldGVycy4nLFxuICAgICAgICAgICAgICAgICdEb3VibGUgY2hlY2sgeW91IGhhdmUgcHJvdmlkZWQgdGhlIGNvcnJlY3QgcGFyYW1ldGVycy4nLFxuICAgICAgICAgICAgXS5qb2luKCdcXG4nKSxcbiAgICAgICAgfSk7XG4gICAgfVxufVxuT2JqZWN0LmRlZmluZVByb3BlcnR5KEludmFsaWRJbnB1dFJwY0Vycm9yLCBcImNvZGVcIiwge1xuICAgIGVudW1lcmFibGU6IHRydWUsXG4gICAgY29uZmlndXJhYmxlOiB0cnVlLFxuICAgIHdyaXRhYmxlOiB0cnVlLFxuICAgIHZhbHVlOiAtMzIwMDBcbn0pO1xuZXhwb3J0IGNsYXNzIFJlc291cmNlTm90Rm91bmRScGNFcnJvciBleHRlbmRzIFJwY0Vycm9yIHtcbiAgICBjb25zdHJ1Y3RvcihjYXVzZSkge1xuICAgICAgICBzdXBlcihjYXVzZSwge1xuICAgICAgICAgICAgY29kZTogUmVzb3VyY2VOb3RGb3VuZFJwY0Vycm9yLmNvZGUsXG4gICAgICAgICAgICBuYW1lOiAnUmVzb3VyY2VOb3RGb3VuZFJwY0Vycm9yJyxcbiAgICAgICAgICAgIHNob3J0TWVzc2FnZTogJ1JlcXVlc3RlZCByZXNvdXJjZSBub3QgZm91bmQuJyxcbiAgICAgICAgfSk7XG4gICAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0aGlzLCBcIm5hbWVcIiwge1xuICAgICAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICAgICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgICAgICAgICAgIHdyaXRhYmxlOiB0cnVlLFxuICAgICAgICAgICAgdmFsdWU6ICdSZXNvdXJjZU5vdEZvdW5kUnBjRXJyb3InXG4gICAgICAgIH0pO1xuICAgIH1cbn1cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShSZXNvdXJjZU5vdEZvdW5kUnBjRXJyb3IsIFwiY29kZVwiLCB7XG4gICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICBjb25maWd1cmFibGU6IHRydWUsXG4gICAgd3JpdGFibGU6IHRydWUsXG4gICAgdmFsdWU6IC0zMjAwMVxufSk7XG5leHBvcnQgY2xhc3MgUmVzb3VyY2VVbmF2YWlsYWJsZVJwY0Vycm9yIGV4dGVuZHMgUnBjRXJyb3Ige1xuICAgIGNvbnN0cnVjdG9yKGNhdXNlKSB7XG4gICAgICAgIHN1cGVyKGNhdXNlLCB7XG4gICAgICAgICAgICBjb2RlOiBSZXNvdXJjZVVuYXZhaWxhYmxlUnBjRXJyb3IuY29kZSxcbiAgICAgICAgICAgIG5hbWU6ICdSZXNvdXJjZVVuYXZhaWxhYmxlUnBjRXJyb3InLFxuICAgICAgICAgICAgc2hvcnRNZXNzYWdlOiAnUmVxdWVzdGVkIHJlc291cmNlIG5vdCBhdmFpbGFibGUuJyxcbiAgICAgICAgfSk7XG4gICAgfVxufVxuT2JqZWN0LmRlZmluZVByb3BlcnR5KFJlc291cmNlVW5hdmFpbGFibGVScGNFcnJvciwgXCJjb2RlXCIsIHtcbiAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgICB3cml0YWJsZTogdHJ1ZSxcbiAgICB2YWx1ZTogLTMyMDAyXG59KTtcbmV4cG9ydCBjbGFzcyBUcmFuc2FjdGlvblJlamVjdGVkUnBjRXJyb3IgZXh0ZW5kcyBScGNFcnJvciB7XG4gICAgY29uc3RydWN0b3IoY2F1c2UpIHtcbiAgICAgICAgc3VwZXIoY2F1c2UsIHtcbiAgICAgICAgICAgIGNvZGU6IFRyYW5zYWN0aW9uUmVqZWN0ZWRScGNFcnJvci5jb2RlLFxuICAgICAgICAgICAgbmFtZTogJ1RyYW5zYWN0aW9uUmVqZWN0ZWRScGNFcnJvcicsXG4gICAgICAgICAgICBzaG9ydE1lc3NhZ2U6ICdUcmFuc2FjdGlvbiBjcmVhdGlvbiBmYWlsZWQuJyxcbiAgICAgICAgfSk7XG4gICAgfVxufVxuT2JqZWN0LmRlZmluZVByb3BlcnR5KFRyYW5zYWN0aW9uUmVqZWN0ZWRScGNFcnJvciwgXCJjb2RlXCIsIHtcbiAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgICB3cml0YWJsZTogdHJ1ZSxcbiAgICB2YWx1ZTogLTMyMDAzXG59KTtcbmV4cG9ydCBjbGFzcyBNZXRob2ROb3RTdXBwb3J0ZWRScGNFcnJvciBleHRlbmRzIFJwY0Vycm9yIHtcbiAgICBjb25zdHJ1Y3RvcihjYXVzZSwgeyBtZXRob2QgfSA9IHt9KSB7XG4gICAgICAgIHN1cGVyKGNhdXNlLCB7XG4gICAgICAgICAgICBjb2RlOiBNZXRob2ROb3RTdXBwb3J0ZWRScGNFcnJvci5jb2RlLFxuICAgICAgICAgICAgbmFtZTogJ01ldGhvZE5vdFN1cHBvcnRlZFJwY0Vycm9yJyxcbiAgICAgICAgICAgIHNob3J0TWVzc2FnZTogYE1ldGhvZCR7bWV0aG9kID8gYCBcIiR7bWV0aG9kfVwiYCA6ICcnfSBpcyBub3Qgc3VwcG9ydGVkLmAsXG4gICAgICAgIH0pO1xuICAgIH1cbn1cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShNZXRob2ROb3RTdXBwb3J0ZWRScGNFcnJvciwgXCJjb2RlXCIsIHtcbiAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgICB3cml0YWJsZTogdHJ1ZSxcbiAgICB2YWx1ZTogLTMyMDA0XG59KTtcbmV4cG9ydCBjbGFzcyBMaW1pdEV4Y2VlZGVkUnBjRXJyb3IgZXh0ZW5kcyBScGNFcnJvciB7XG4gICAgY29uc3RydWN0b3IoY2F1c2UpIHtcbiAgICAgICAgc3VwZXIoY2F1c2UsIHtcbiAgICAgICAgICAgIGNvZGU6IExpbWl0RXhjZWVkZWRScGNFcnJvci5jb2RlLFxuICAgICAgICAgICAgbmFtZTogJ0xpbWl0RXhjZWVkZWRScGNFcnJvcicsXG4gICAgICAgICAgICBzaG9ydE1lc3NhZ2U6ICdSZXF1ZXN0IGV4Y2VlZHMgZGVmaW5lZCBsaW1pdC4nLFxuICAgICAgICB9KTtcbiAgICB9XG59XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoTGltaXRFeGNlZWRlZFJwY0Vycm9yLCBcImNvZGVcIiwge1xuICAgIGVudW1lcmFibGU6IHRydWUsXG4gICAgY29uZmlndXJhYmxlOiB0cnVlLFxuICAgIHdyaXRhYmxlOiB0cnVlLFxuICAgIHZhbHVlOiAtMzIwMDVcbn0pO1xuZXhwb3J0IGNsYXNzIEpzb25ScGNWZXJzaW9uVW5zdXBwb3J0ZWRFcnJvciBleHRlbmRzIFJwY0Vycm9yIHtcbiAgICBjb25zdHJ1Y3RvcihjYXVzZSkge1xuICAgICAgICBzdXBlcihjYXVzZSwge1xuICAgICAgICAgICAgY29kZTogSnNvblJwY1ZlcnNpb25VbnN1cHBvcnRlZEVycm9yLmNvZGUsXG4gICAgICAgICAgICBuYW1lOiAnSnNvblJwY1ZlcnNpb25VbnN1cHBvcnRlZEVycm9yJyxcbiAgICAgICAgICAgIHNob3J0TWVzc2FnZTogJ1ZlcnNpb24gb2YgSlNPTi1SUEMgcHJvdG9jb2wgaXMgbm90IHN1cHBvcnRlZC4nLFxuICAgICAgICB9KTtcbiAgICB9XG59XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoSnNvblJwY1ZlcnNpb25VbnN1cHBvcnRlZEVycm9yLCBcImNvZGVcIiwge1xuICAgIGVudW1lcmFibGU6IHRydWUsXG4gICAgY29uZmlndXJhYmxlOiB0cnVlLFxuICAgIHdyaXRhYmxlOiB0cnVlLFxuICAgIHZhbHVlOiAtMzIwMDZcbn0pO1xuZXhwb3J0IGNsYXNzIFVzZXJSZWplY3RlZFJlcXVlc3RFcnJvciBleHRlbmRzIFByb3ZpZGVyUnBjRXJyb3Ige1xuICAgIGNvbnN0cnVjdG9yKGNhdXNlKSB7XG4gICAgICAgIHN1cGVyKGNhdXNlLCB7XG4gICAgICAgICAgICBjb2RlOiBVc2VyUmVqZWN0ZWRSZXF1ZXN0RXJyb3IuY29kZSxcbiAgICAgICAgICAgIG5hbWU6ICdVc2VyUmVqZWN0ZWRSZXF1ZXN0RXJyb3InLFxuICAgICAgICAgICAgc2hvcnRNZXNzYWdlOiAnVXNlciByZWplY3RlZCB0aGUgcmVxdWVzdC4nLFxuICAgICAgICB9KTtcbiAgICB9XG59XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoVXNlclJlamVjdGVkUmVxdWVzdEVycm9yLCBcImNvZGVcIiwge1xuICAgIGVudW1lcmFibGU6IHRydWUsXG4gICAgY29uZmlndXJhYmxlOiB0cnVlLFxuICAgIHdyaXRhYmxlOiB0cnVlLFxuICAgIHZhbHVlOiA0MDAxXG59KTtcbmV4cG9ydCBjbGFzcyBVbmF1dGhvcml6ZWRQcm92aWRlckVycm9yIGV4dGVuZHMgUHJvdmlkZXJScGNFcnJvciB7XG4gICAgY29uc3RydWN0b3IoY2F1c2UpIHtcbiAgICAgICAgc3VwZXIoY2F1c2UsIHtcbiAgICAgICAgICAgIGNvZGU6IFVuYXV0aG9yaXplZFByb3ZpZGVyRXJyb3IuY29kZSxcbiAgICAgICAgICAgIG5hbWU6ICdVbmF1dGhvcml6ZWRQcm92aWRlckVycm9yJyxcbiAgICAgICAgICAgIHNob3J0TWVzc2FnZTogJ1RoZSByZXF1ZXN0ZWQgbWV0aG9kIGFuZC9vciBhY2NvdW50IGhhcyBub3QgYmVlbiBhdXRob3JpemVkIGJ5IHRoZSB1c2VyLicsXG4gICAgICAgIH0pO1xuICAgIH1cbn1cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShVbmF1dGhvcml6ZWRQcm92aWRlckVycm9yLCBcImNvZGVcIiwge1xuICAgIGVudW1lcmFibGU6IHRydWUsXG4gICAgY29uZmlndXJhYmxlOiB0cnVlLFxuICAgIHdyaXRhYmxlOiB0cnVlLFxuICAgIHZhbHVlOiA0MTAwXG59KTtcbmV4cG9ydCBjbGFzcyBVbnN1cHBvcnRlZFByb3ZpZGVyTWV0aG9kRXJyb3IgZXh0ZW5kcyBQcm92aWRlclJwY0Vycm9yIHtcbiAgICBjb25zdHJ1Y3RvcihjYXVzZSwgeyBtZXRob2QgfSA9IHt9KSB7XG4gICAgICAgIHN1cGVyKGNhdXNlLCB7XG4gICAgICAgICAgICBjb2RlOiBVbnN1cHBvcnRlZFByb3ZpZGVyTWV0aG9kRXJyb3IuY29kZSxcbiAgICAgICAgICAgIG5hbWU6ICdVbnN1cHBvcnRlZFByb3ZpZGVyTWV0aG9kRXJyb3InLFxuICAgICAgICAgICAgc2hvcnRNZXNzYWdlOiBgVGhlIFByb3ZpZGVyIGRvZXMgbm90IHN1cHBvcnQgdGhlIHJlcXVlc3RlZCBtZXRob2Qke21ldGhvZCA/IGAgXCIgJHttZXRob2R9XCJgIDogJyd9LmAsXG4gICAgICAgIH0pO1xuICAgIH1cbn1cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShVbnN1cHBvcnRlZFByb3ZpZGVyTWV0aG9kRXJyb3IsIFwiY29kZVwiLCB7XG4gICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICBjb25maWd1cmFibGU6IHRydWUsXG4gICAgd3JpdGFibGU6IHRydWUsXG4gICAgdmFsdWU6IDQyMDBcbn0pO1xuZXhwb3J0IGNsYXNzIFByb3ZpZGVyRGlzY29ubmVjdGVkRXJyb3IgZXh0ZW5kcyBQcm92aWRlclJwY0Vycm9yIHtcbiAgICBjb25zdHJ1Y3RvcihjYXVzZSkge1xuICAgICAgICBzdXBlcihjYXVzZSwge1xuICAgICAgICAgICAgY29kZTogUHJvdmlkZXJEaXNjb25uZWN0ZWRFcnJvci5jb2RlLFxuICAgICAgICAgICAgbmFtZTogJ1Byb3ZpZGVyRGlzY29ubmVjdGVkRXJyb3InLFxuICAgICAgICAgICAgc2hvcnRNZXNzYWdlOiAnVGhlIFByb3ZpZGVyIGlzIGRpc2Nvbm5lY3RlZCBmcm9tIGFsbCBjaGFpbnMuJyxcbiAgICAgICAgfSk7XG4gICAgfVxufVxuT2JqZWN0LmRlZmluZVByb3BlcnR5KFByb3ZpZGVyRGlzY29ubmVjdGVkRXJyb3IsIFwiY29kZVwiLCB7XG4gICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICBjb25maWd1cmFibGU6IHRydWUsXG4gICAgd3JpdGFibGU6IHRydWUsXG4gICAgdmFsdWU6IDQ5MDBcbn0pO1xuZXhwb3J0IGNsYXNzIENoYWluRGlzY29ubmVjdGVkRXJyb3IgZXh0ZW5kcyBQcm92aWRlclJwY0Vycm9yIHtcbiAgICBjb25zdHJ1Y3RvcihjYXVzZSkge1xuICAgICAgICBzdXBlcihjYXVzZSwge1xuICAgICAgICAgICAgY29kZTogQ2hhaW5EaXNjb25uZWN0ZWRFcnJvci5jb2RlLFxuICAgICAgICAgICAgbmFtZTogJ0NoYWluRGlzY29ubmVjdGVkRXJyb3InLFxuICAgICAgICAgICAgc2hvcnRNZXNzYWdlOiAnVGhlIFByb3ZpZGVyIGlzIG5vdCBjb25uZWN0ZWQgdG8gdGhlIHJlcXVlc3RlZCBjaGFpbi4nLFxuICAgICAgICB9KTtcbiAgICB9XG59XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoQ2hhaW5EaXNjb25uZWN0ZWRFcnJvciwgXCJjb2RlXCIsIHtcbiAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgICB3cml0YWJsZTogdHJ1ZSxcbiAgICB2YWx1ZTogNDkwMVxufSk7XG5leHBvcnQgY2xhc3MgU3dpdGNoQ2hhaW5FcnJvciBleHRlbmRzIFByb3ZpZGVyUnBjRXJyb3Ige1xuICAgIGNvbnN0cnVjdG9yKGNhdXNlKSB7XG4gICAgICAgIHN1cGVyKGNhdXNlLCB7XG4gICAgICAgICAgICBjb2RlOiBTd2l0Y2hDaGFpbkVycm9yLmNvZGUsXG4gICAgICAgICAgICBuYW1lOiAnU3dpdGNoQ2hhaW5FcnJvcicsXG4gICAgICAgICAgICBzaG9ydE1lc3NhZ2U6ICdBbiBlcnJvciBvY2N1cnJlZCB3aGVuIGF0dGVtcHRpbmcgdG8gc3dpdGNoIGNoYWluLicsXG4gICAgICAgIH0pO1xuICAgIH1cbn1cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShTd2l0Y2hDaGFpbkVycm9yLCBcImNvZGVcIiwge1xuICAgIGVudW1lcmFibGU6IHRydWUsXG4gICAgY29uZmlndXJhYmxlOiB0cnVlLFxuICAgIHdyaXRhYmxlOiB0cnVlLFxuICAgIHZhbHVlOiA0OTAyXG59KTtcbmV4cG9ydCBjbGFzcyBVbnN1cHBvcnRlZE5vbk9wdGlvbmFsQ2FwYWJpbGl0eUVycm9yIGV4dGVuZHMgUHJvdmlkZXJScGNFcnJvciB7XG4gICAgY29uc3RydWN0b3IoY2F1c2UpIHtcbiAgICAgICAgc3VwZXIoY2F1c2UsIHtcbiAgICAgICAgICAgIGNvZGU6IFVuc3VwcG9ydGVkTm9uT3B0aW9uYWxDYXBhYmlsaXR5RXJyb3IuY29kZSxcbiAgICAgICAgICAgIG5hbWU6ICdVbnN1cHBvcnRlZE5vbk9wdGlvbmFsQ2FwYWJpbGl0eUVycm9yJyxcbiAgICAgICAgICAgIHNob3J0TWVzc2FnZTogJ1RoaXMgV2FsbGV0IGRvZXMgbm90IHN1cHBvcnQgYSBjYXBhYmlsaXR5IHRoYXQgd2FzIG5vdCBtYXJrZWQgYXMgb3B0aW9uYWwuJyxcbiAgICAgICAgfSk7XG4gICAgfVxufVxuT2JqZWN0LmRlZmluZVByb3BlcnR5KFVuc3VwcG9ydGVkTm9uT3B0aW9uYWxDYXBhYmlsaXR5RXJyb3IsIFwiY29kZVwiLCB7XG4gICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICBjb25maWd1cmFibGU6IHRydWUsXG4gICAgd3JpdGFibGU6IHRydWUsXG4gICAgdmFsdWU6IDU3MDBcbn0pO1xuZXhwb3J0IGNsYXNzIFVuc3VwcG9ydGVkQ2hhaW5JZEVycm9yIGV4dGVuZHMgUHJvdmlkZXJScGNFcnJvciB7XG4gICAgY29uc3RydWN0b3IoY2F1c2UpIHtcbiAgICAgICAgc3VwZXIoY2F1c2UsIHtcbiAgICAgICAgICAgIGNvZGU6IFVuc3VwcG9ydGVkQ2hhaW5JZEVycm9yLmNvZGUsXG4gICAgICAgICAgICBuYW1lOiAnVW5zdXBwb3J0ZWRDaGFpbklkRXJyb3InLFxuICAgICAgICAgICAgc2hvcnRNZXNzYWdlOiAnVGhpcyBXYWxsZXQgZG9lcyBub3Qgc3VwcG9ydCB0aGUgcmVxdWVzdGVkIGNoYWluIElELicsXG4gICAgICAgIH0pO1xuICAgIH1cbn1cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShVbnN1cHBvcnRlZENoYWluSWRFcnJvciwgXCJjb2RlXCIsIHtcbiAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgICB3cml0YWJsZTogdHJ1ZSxcbiAgICB2YWx1ZTogNTcxMFxufSk7XG5leHBvcnQgY2xhc3MgRHVwbGljYXRlSWRFcnJvciBleHRlbmRzIFByb3ZpZGVyUnBjRXJyb3Ige1xuICAgIGNvbnN0cnVjdG9yKGNhdXNlKSB7XG4gICAgICAgIHN1cGVyKGNhdXNlLCB7XG4gICAgICAgICAgICBjb2RlOiBEdXBsaWNhdGVJZEVycm9yLmNvZGUsXG4gICAgICAgICAgICBuYW1lOiAnRHVwbGljYXRlSWRFcnJvcicsXG4gICAgICAgICAgICBzaG9ydE1lc3NhZ2U6ICdUaGVyZSBpcyBhbHJlYWR5IGEgYnVuZGxlIHN1Ym1pdHRlZCB3aXRoIHRoaXMgSUQuJyxcbiAgICAgICAgfSk7XG4gICAgfVxufVxuT2JqZWN0LmRlZmluZVByb3BlcnR5KER1cGxpY2F0ZUlkRXJyb3IsIFwiY29kZVwiLCB7XG4gICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICBjb25maWd1cmFibGU6IHRydWUsXG4gICAgd3JpdGFibGU6IHRydWUsXG4gICAgdmFsdWU6IDU3MjBcbn0pO1xuZXhwb3J0IGNsYXNzIFVua25vd25CdW5kbGVJZEVycm9yIGV4dGVuZHMgUHJvdmlkZXJScGNFcnJvciB7XG4gICAgY29uc3RydWN0b3IoY2F1c2UpIHtcbiAgICAgICAgc3VwZXIoY2F1c2UsIHtcbiAgICAgICAgICAgIGNvZGU6IFVua25vd25CdW5kbGVJZEVycm9yLmNvZGUsXG4gICAgICAgICAgICBuYW1lOiAnVW5rbm93bkJ1bmRsZUlkRXJyb3InLFxuICAgICAgICAgICAgc2hvcnRNZXNzYWdlOiAnVGhpcyBidW5kbGUgaWQgaXMgdW5rbm93biAvIGhhcyBub3QgYmVlbiBzdWJtaXR0ZWQnLFxuICAgICAgICB9KTtcbiAgICB9XG59XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoVW5rbm93bkJ1bmRsZUlkRXJyb3IsIFwiY29kZVwiLCB7XG4gICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICBjb25maWd1cmFibGU6IHRydWUsXG4gICAgd3JpdGFibGU6IHRydWUsXG4gICAgdmFsdWU6IDU3MzBcbn0pO1xuZXhwb3J0IGNsYXNzIEJ1bmRsZVRvb0xhcmdlRXJyb3IgZXh0ZW5kcyBQcm92aWRlclJwY0Vycm9yIHtcbiAgICBjb25zdHJ1Y3RvcihjYXVzZSkge1xuICAgICAgICBzdXBlcihjYXVzZSwge1xuICAgICAgICAgICAgY29kZTogQnVuZGxlVG9vTGFyZ2VFcnJvci5jb2RlLFxuICAgICAgICAgICAgbmFtZTogJ0J1bmRsZVRvb0xhcmdlRXJyb3InLFxuICAgICAgICAgICAgc2hvcnRNZXNzYWdlOiAnVGhlIGNhbGwgYnVuZGxlIGlzIHRvbyBsYXJnZSBmb3IgdGhlIFdhbGxldCB0byBwcm9jZXNzLicsXG4gICAgICAgIH0pO1xuICAgIH1cbn1cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShCdW5kbGVUb29MYXJnZUVycm9yLCBcImNvZGVcIiwge1xuICAgIGVudW1lcmFibGU6IHRydWUsXG4gICAgY29uZmlndXJhYmxlOiB0cnVlLFxuICAgIHdyaXRhYmxlOiB0cnVlLFxuICAgIHZhbHVlOiA1NzQwXG59KTtcbmV4cG9ydCBjbGFzcyBBdG9taWNSZWFkeVdhbGxldFJlamVjdGVkVXBncmFkZUVycm9yIGV4dGVuZHMgUHJvdmlkZXJScGNFcnJvciB7XG4gICAgY29uc3RydWN0b3IoY2F1c2UpIHtcbiAgICAgICAgc3VwZXIoY2F1c2UsIHtcbiAgICAgICAgICAgIGNvZGU6IEF0b21pY1JlYWR5V2FsbGV0UmVqZWN0ZWRVcGdyYWRlRXJyb3IuY29kZSxcbiAgICAgICAgICAgIG5hbWU6ICdBdG9taWNSZWFkeVdhbGxldFJlamVjdGVkVXBncmFkZUVycm9yJyxcbiAgICAgICAgICAgIHNob3J0TWVzc2FnZTogJ1RoZSBXYWxsZXQgY2FuIHN1cHBvcnQgYXRvbWljaXR5IGFmdGVyIGFuIHVwZ3JhZGUsIGJ1dCB0aGUgdXNlciByZWplY3RlZCB0aGUgdXBncmFkZS4nLFxuICAgICAgICB9KTtcbiAgICB9XG59XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoQXRvbWljUmVhZHlXYWxsZXRSZWplY3RlZFVwZ3JhZGVFcnJvciwgXCJjb2RlXCIsIHtcbiAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgICB3cml0YWJsZTogdHJ1ZSxcbiAgICB2YWx1ZTogNTc1MFxufSk7XG5leHBvcnQgY2xhc3MgQXRvbWljaXR5Tm90U3VwcG9ydGVkRXJyb3IgZXh0ZW5kcyBQcm92aWRlclJwY0Vycm9yIHtcbiAgICBjb25zdHJ1Y3RvcihjYXVzZSkge1xuICAgICAgICBzdXBlcihjYXVzZSwge1xuICAgICAgICAgICAgY29kZTogQXRvbWljaXR5Tm90U3VwcG9ydGVkRXJyb3IuY29kZSxcbiAgICAgICAgICAgIG5hbWU6ICdBdG9taWNpdHlOb3RTdXBwb3J0ZWRFcnJvcicsXG4gICAgICAgICAgICBzaG9ydE1lc3NhZ2U6ICdUaGUgd2FsbGV0IGRvZXMgbm90IHN1cHBvcnQgYXRvbWljIGV4ZWN1dGlvbiBidXQgdGhlIHJlcXVlc3QgcmVxdWlyZXMgaXQuJyxcbiAgICAgICAgfSk7XG4gICAgfVxufVxuT2JqZWN0LmRlZmluZVByb3BlcnR5KEF0b21pY2l0eU5vdFN1cHBvcnRlZEVycm9yLCBcImNvZGVcIiwge1xuICAgIGVudW1lcmFibGU6IHRydWUsXG4gICAgY29uZmlndXJhYmxlOiB0cnVlLFxuICAgIHdyaXRhYmxlOiB0cnVlLFxuICAgIHZhbHVlOiA1NzYwXG59KTtcbmV4cG9ydCBjbGFzcyBVbmtub3duUnBjRXJyb3IgZXh0ZW5kcyBScGNFcnJvciB7XG4gICAgY29uc3RydWN0b3IoY2F1c2UpIHtcbiAgICAgICAgc3VwZXIoY2F1c2UsIHtcbiAgICAgICAgICAgIG5hbWU6ICdVbmtub3duUnBjRXJyb3InLFxuICAgICAgICAgICAgc2hvcnRNZXNzYWdlOiAnQW4gdW5rbm93biBSUEMgZXJyb3Igb2NjdXJyZWQuJyxcbiAgICAgICAgfSk7XG4gICAgfVxufVxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9cnBjLmpzLm1hcCIsCiAgICAiaW1wb3J0IHsgQmFzZUVycm9yIH0gZnJvbSAnLi4vLi4vZXJyb3JzL2Jhc2UuanMnO1xuaW1wb3J0IHsgRXhlY3V0aW9uUmV2ZXJ0ZWRFcnJvciwgRmVlQ2FwVG9vSGlnaEVycm9yLCBGZWVDYXBUb29Mb3dFcnJvciwgSW5zdWZmaWNpZW50RnVuZHNFcnJvciwgSW50cmluc2ljR2FzVG9vSGlnaEVycm9yLCBJbnRyaW5zaWNHYXNUb29Mb3dFcnJvciwgTm9uY2VNYXhWYWx1ZUVycm9yLCBOb25jZVRvb0hpZ2hFcnJvciwgTm9uY2VUb29Mb3dFcnJvciwgVGlwQWJvdmVGZWVDYXBFcnJvciwgVHJhbnNhY3Rpb25UeXBlTm90U3VwcG9ydGVkRXJyb3IsIFVua25vd25Ob2RlRXJyb3IsIH0gZnJvbSAnLi4vLi4vZXJyb3JzL25vZGUuanMnO1xuaW1wb3J0IHsgUnBjUmVxdWVzdEVycm9yIH0gZnJvbSAnLi4vLi4vZXJyb3JzL3JlcXVlc3QuanMnO1xuaW1wb3J0IHsgSW52YWxpZElucHV0UnBjRXJyb3IsIFRyYW5zYWN0aW9uUmVqZWN0ZWRScGNFcnJvciwgfSBmcm9tICcuLi8uLi9lcnJvcnMvcnBjLmpzJztcbmV4cG9ydCBmdW5jdGlvbiBjb250YWluc05vZGVFcnJvcihlcnIpIHtcbiAgICByZXR1cm4gKGVyciBpbnN0YW5jZW9mIFRyYW5zYWN0aW9uUmVqZWN0ZWRScGNFcnJvciB8fFxuICAgICAgICBlcnIgaW5zdGFuY2VvZiBJbnZhbGlkSW5wdXRScGNFcnJvciB8fFxuICAgICAgICAoZXJyIGluc3RhbmNlb2YgUnBjUmVxdWVzdEVycm9yICYmIGVyci5jb2RlID09PSBFeGVjdXRpb25SZXZlcnRlZEVycm9yLmNvZGUpKTtcbn1cbmV4cG9ydCBmdW5jdGlvbiBnZXROb2RlRXJyb3IoZXJyLCBhcmdzKSB7XG4gICAgY29uc3QgbWVzc2FnZSA9IChlcnIuZGV0YWlscyB8fCAnJykudG9Mb3dlckNhc2UoKTtcbiAgICBjb25zdCBleGVjdXRpb25SZXZlcnRlZEVycm9yID0gZXJyIGluc3RhbmNlb2YgQmFzZUVycm9yXG4gICAgICAgID8gZXJyLndhbGsoKGUpID0+IGU/LmNvZGUgPT09XG4gICAgICAgICAgICBFeGVjdXRpb25SZXZlcnRlZEVycm9yLmNvZGUpXG4gICAgICAgIDogZXJyO1xuICAgIGlmIChleGVjdXRpb25SZXZlcnRlZEVycm9yIGluc3RhbmNlb2YgQmFzZUVycm9yKVxuICAgICAgICByZXR1cm4gbmV3IEV4ZWN1dGlvblJldmVydGVkRXJyb3Ioe1xuICAgICAgICAgICAgY2F1c2U6IGVycixcbiAgICAgICAgICAgIG1lc3NhZ2U6IGV4ZWN1dGlvblJldmVydGVkRXJyb3IuZGV0YWlscyxcbiAgICAgICAgfSk7XG4gICAgaWYgKEV4ZWN1dGlvblJldmVydGVkRXJyb3Iubm9kZU1lc3NhZ2UudGVzdChtZXNzYWdlKSlcbiAgICAgICAgcmV0dXJuIG5ldyBFeGVjdXRpb25SZXZlcnRlZEVycm9yKHtcbiAgICAgICAgICAgIGNhdXNlOiBlcnIsXG4gICAgICAgICAgICBtZXNzYWdlOiBlcnIuZGV0YWlscyxcbiAgICAgICAgfSk7XG4gICAgaWYgKEZlZUNhcFRvb0hpZ2hFcnJvci5ub2RlTWVzc2FnZS50ZXN0KG1lc3NhZ2UpKVxuICAgICAgICByZXR1cm4gbmV3IEZlZUNhcFRvb0hpZ2hFcnJvcih7XG4gICAgICAgICAgICBjYXVzZTogZXJyLFxuICAgICAgICAgICAgbWF4RmVlUGVyR2FzOiBhcmdzPy5tYXhGZWVQZXJHYXMsXG4gICAgICAgIH0pO1xuICAgIGlmIChGZWVDYXBUb29Mb3dFcnJvci5ub2RlTWVzc2FnZS50ZXN0KG1lc3NhZ2UpKVxuICAgICAgICByZXR1cm4gbmV3IEZlZUNhcFRvb0xvd0Vycm9yKHtcbiAgICAgICAgICAgIGNhdXNlOiBlcnIsXG4gICAgICAgICAgICBtYXhGZWVQZXJHYXM6IGFyZ3M/Lm1heEZlZVBlckdhcyxcbiAgICAgICAgfSk7XG4gICAgaWYgKE5vbmNlVG9vSGlnaEVycm9yLm5vZGVNZXNzYWdlLnRlc3QobWVzc2FnZSkpXG4gICAgICAgIHJldHVybiBuZXcgTm9uY2VUb29IaWdoRXJyb3IoeyBjYXVzZTogZXJyLCBub25jZTogYXJncz8ubm9uY2UgfSk7XG4gICAgaWYgKE5vbmNlVG9vTG93RXJyb3Iubm9kZU1lc3NhZ2UudGVzdChtZXNzYWdlKSlcbiAgICAgICAgcmV0dXJuIG5ldyBOb25jZVRvb0xvd0Vycm9yKHsgY2F1c2U6IGVyciwgbm9uY2U6IGFyZ3M/Lm5vbmNlIH0pO1xuICAgIGlmIChOb25jZU1heFZhbHVlRXJyb3Iubm9kZU1lc3NhZ2UudGVzdChtZXNzYWdlKSlcbiAgICAgICAgcmV0dXJuIG5ldyBOb25jZU1heFZhbHVlRXJyb3IoeyBjYXVzZTogZXJyLCBub25jZTogYXJncz8ubm9uY2UgfSk7XG4gICAgaWYgKEluc3VmZmljaWVudEZ1bmRzRXJyb3Iubm9kZU1lc3NhZ2UudGVzdChtZXNzYWdlKSlcbiAgICAgICAgcmV0dXJuIG5ldyBJbnN1ZmZpY2llbnRGdW5kc0Vycm9yKHsgY2F1c2U6IGVyciB9KTtcbiAgICBpZiAoSW50cmluc2ljR2FzVG9vSGlnaEVycm9yLm5vZGVNZXNzYWdlLnRlc3QobWVzc2FnZSkpXG4gICAgICAgIHJldHVybiBuZXcgSW50cmluc2ljR2FzVG9vSGlnaEVycm9yKHsgY2F1c2U6IGVyciwgZ2FzOiBhcmdzPy5nYXMgfSk7XG4gICAgaWYgKEludHJpbnNpY0dhc1Rvb0xvd0Vycm9yLm5vZGVNZXNzYWdlLnRlc3QobWVzc2FnZSkpXG4gICAgICAgIHJldHVybiBuZXcgSW50cmluc2ljR2FzVG9vTG93RXJyb3IoeyBjYXVzZTogZXJyLCBnYXM6IGFyZ3M/LmdhcyB9KTtcbiAgICBpZiAoVHJhbnNhY3Rpb25UeXBlTm90U3VwcG9ydGVkRXJyb3Iubm9kZU1lc3NhZ2UudGVzdChtZXNzYWdlKSlcbiAgICAgICAgcmV0dXJuIG5ldyBUcmFuc2FjdGlvblR5cGVOb3RTdXBwb3J0ZWRFcnJvcih7IGNhdXNlOiBlcnIgfSk7XG4gICAgaWYgKFRpcEFib3ZlRmVlQ2FwRXJyb3Iubm9kZU1lc3NhZ2UudGVzdChtZXNzYWdlKSlcbiAgICAgICAgcmV0dXJuIG5ldyBUaXBBYm92ZUZlZUNhcEVycm9yKHtcbiAgICAgICAgICAgIGNhdXNlOiBlcnIsXG4gICAgICAgICAgICBtYXhGZWVQZXJHYXM6IGFyZ3M/Lm1heEZlZVBlckdhcyxcbiAgICAgICAgICAgIG1heFByaW9yaXR5RmVlUGVyR2FzOiBhcmdzPy5tYXhQcmlvcml0eUZlZVBlckdhcyxcbiAgICAgICAgfSk7XG4gICAgcmV0dXJuIG5ldyBVbmtub3duTm9kZUVycm9yKHtcbiAgICAgICAgY2F1c2U6IGVycixcbiAgICB9KTtcbn1cbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWdldE5vZGVFcnJvci5qcy5tYXAiLAogICAgImltcG9ydCB7IENhbGxFeGVjdXRpb25FcnJvciwgfSBmcm9tICcuLi8uLi9lcnJvcnMvY29udHJhY3QuanMnO1xuaW1wb3J0IHsgVW5rbm93bk5vZGVFcnJvciB9IGZyb20gJy4uLy4uL2Vycm9ycy9ub2RlLmpzJztcbmltcG9ydCB7IGdldE5vZGVFcnJvciwgfSBmcm9tICcuL2dldE5vZGVFcnJvci5qcyc7XG5leHBvcnQgZnVuY3Rpb24gZ2V0Q2FsbEVycm9yKGVyciwgeyBkb2NzUGF0aCwgLi4uYXJncyB9KSB7XG4gICAgY29uc3QgY2F1c2UgPSAoKCkgPT4ge1xuICAgICAgICBjb25zdCBjYXVzZSA9IGdldE5vZGVFcnJvcihlcnIsIGFyZ3MpO1xuICAgICAgICBpZiAoY2F1c2UgaW5zdGFuY2VvZiBVbmtub3duTm9kZUVycm9yKVxuICAgICAgICAgICAgcmV0dXJuIGVycjtcbiAgICAgICAgcmV0dXJuIGNhdXNlO1xuICAgIH0pKCk7XG4gICAgcmV0dXJuIG5ldyBDYWxsRXhlY3V0aW9uRXJyb3IoY2F1c2UsIHtcbiAgICAgICAgZG9jc1BhdGgsXG4gICAgICAgIC4uLmFyZ3MsXG4gICAgfSk7XG59XG4vLyMgc291cmNlTWFwcGluZ1VSTD1nZXRDYWxsRXJyb3IuanMubWFwIiwKICAgICIvKipcbiAqIEBkZXNjcmlwdGlvbiBQaWNrcyBvdXQgdGhlIGtleXMgZnJvbSBgdmFsdWVgIHRoYXQgZXhpc3QgaW4gdGhlIGZvcm1hdHRlci4uXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBleHRyYWN0KHZhbHVlXywgeyBmb3JtYXQgfSkge1xuICAgIGlmICghZm9ybWF0KVxuICAgICAgICByZXR1cm4ge307XG4gICAgY29uc3QgdmFsdWUgPSB7fTtcbiAgICBmdW5jdGlvbiBleHRyYWN0Xyhmb3JtYXR0ZWQpIHtcbiAgICAgICAgY29uc3Qga2V5cyA9IE9iamVjdC5rZXlzKGZvcm1hdHRlZCk7XG4gICAgICAgIGZvciAoY29uc3Qga2V5IG9mIGtleXMpIHtcbiAgICAgICAgICAgIGlmIChrZXkgaW4gdmFsdWVfKVxuICAgICAgICAgICAgICAgIHZhbHVlW2tleV0gPSB2YWx1ZV9ba2V5XTtcbiAgICAgICAgICAgIGlmIChmb3JtYXR0ZWRba2V5XSAmJlxuICAgICAgICAgICAgICAgIHR5cGVvZiBmb3JtYXR0ZWRba2V5XSA9PT0gJ29iamVjdCcgJiZcbiAgICAgICAgICAgICAgICAhQXJyYXkuaXNBcnJheShmb3JtYXR0ZWRba2V5XSkpXG4gICAgICAgICAgICAgICAgZXh0cmFjdF8oZm9ybWF0dGVkW2tleV0pO1xuICAgICAgICB9XG4gICAgfVxuICAgIGNvbnN0IGZvcm1hdHRlZCA9IGZvcm1hdCh2YWx1ZV8gfHwge30pO1xuICAgIGV4dHJhY3RfKGZvcm1hdHRlZCk7XG4gICAgcmV0dXJuIHZhbHVlO1xufVxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9ZXh0cmFjdC5qcy5tYXAiLAogICAgImV4cG9ydCBmdW5jdGlvbiBkZWZpbmVGb3JtYXR0ZXIodHlwZSwgZm9ybWF0KSB7XG4gICAgcmV0dXJuICh7IGV4Y2x1ZGUsIGZvcm1hdDogb3ZlcnJpZGVzLCB9KSA9PiB7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBleGNsdWRlLFxuICAgICAgICAgICAgZm9ybWF0OiAoYXJncywgYWN0aW9uKSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3QgZm9ybWF0dGVkID0gZm9ybWF0KGFyZ3MsIGFjdGlvbik7XG4gICAgICAgICAgICAgICAgaWYgKGV4Y2x1ZGUpIHtcbiAgICAgICAgICAgICAgICAgICAgZm9yIChjb25zdCBrZXkgb2YgZXhjbHVkZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgZGVsZXRlIGZvcm1hdHRlZFtrZXldO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgICAgIC4uLmZvcm1hdHRlZCxcbiAgICAgICAgICAgICAgICAgICAgLi4ub3ZlcnJpZGVzKGFyZ3MsIGFjdGlvbiksXG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB0eXBlLFxuICAgICAgICB9O1xuICAgIH07XG59XG4vLyMgc291cmNlTWFwcGluZ1VSTD1mb3JtYXR0ZXIuanMubWFwIiwKICAgICJpbXBvcnQgeyBieXRlc1RvSGV4LCBudW1iZXJUb0hleCB9IGZyb20gJy4uL2VuY29kaW5nL3RvSGV4LmpzJztcbmltcG9ydCB7IGRlZmluZUZvcm1hdHRlciB9IGZyb20gJy4vZm9ybWF0dGVyLmpzJztcbmV4cG9ydCBjb25zdCBycGNUcmFuc2FjdGlvblR5cGUgPSB7XG4gICAgbGVnYWN5OiAnMHgwJyxcbiAgICBlaXAyOTMwOiAnMHgxJyxcbiAgICBlaXAxNTU5OiAnMHgyJyxcbiAgICBlaXA0ODQ0OiAnMHgzJyxcbiAgICBlaXA3NzAyOiAnMHg0Jyxcbn07XG5leHBvcnQgZnVuY3Rpb24gZm9ybWF0VHJhbnNhY3Rpb25SZXF1ZXN0KHJlcXVlc3QsIF8pIHtcbiAgICBjb25zdCBycGNSZXF1ZXN0ID0ge307XG4gICAgaWYgKHR5cGVvZiByZXF1ZXN0LmF1dGhvcml6YXRpb25MaXN0ICE9PSAndW5kZWZpbmVkJylcbiAgICAgICAgcnBjUmVxdWVzdC5hdXRob3JpemF0aW9uTGlzdCA9IGZvcm1hdEF1dGhvcml6YXRpb25MaXN0KHJlcXVlc3QuYXV0aG9yaXphdGlvbkxpc3QpO1xuICAgIGlmICh0eXBlb2YgcmVxdWVzdC5hY2Nlc3NMaXN0ICE9PSAndW5kZWZpbmVkJylcbiAgICAgICAgcnBjUmVxdWVzdC5hY2Nlc3NMaXN0ID0gcmVxdWVzdC5hY2Nlc3NMaXN0O1xuICAgIGlmICh0eXBlb2YgcmVxdWVzdC5ibG9iVmVyc2lvbmVkSGFzaGVzICE9PSAndW5kZWZpbmVkJylcbiAgICAgICAgcnBjUmVxdWVzdC5ibG9iVmVyc2lvbmVkSGFzaGVzID0gcmVxdWVzdC5ibG9iVmVyc2lvbmVkSGFzaGVzO1xuICAgIGlmICh0eXBlb2YgcmVxdWVzdC5ibG9icyAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgaWYgKHR5cGVvZiByZXF1ZXN0LmJsb2JzWzBdICE9PSAnc3RyaW5nJylcbiAgICAgICAgICAgIHJwY1JlcXVlc3QuYmxvYnMgPSByZXF1ZXN0LmJsb2JzLm1hcCgoeCkgPT4gYnl0ZXNUb0hleCh4KSk7XG4gICAgICAgIGVsc2VcbiAgICAgICAgICAgIHJwY1JlcXVlc3QuYmxvYnMgPSByZXF1ZXN0LmJsb2JzO1xuICAgIH1cbiAgICBpZiAodHlwZW9mIHJlcXVlc3QuZGF0YSAhPT0gJ3VuZGVmaW5lZCcpXG4gICAgICAgIHJwY1JlcXVlc3QuZGF0YSA9IHJlcXVlc3QuZGF0YTtcbiAgICBpZiAocmVxdWVzdC5hY2NvdW50KVxuICAgICAgICBycGNSZXF1ZXN0LmZyb20gPSByZXF1ZXN0LmFjY291bnQuYWRkcmVzcztcbiAgICBpZiAodHlwZW9mIHJlcXVlc3QuZnJvbSAhPT0gJ3VuZGVmaW5lZCcpXG4gICAgICAgIHJwY1JlcXVlc3QuZnJvbSA9IHJlcXVlc3QuZnJvbTtcbiAgICBpZiAodHlwZW9mIHJlcXVlc3QuZ2FzICE9PSAndW5kZWZpbmVkJylcbiAgICAgICAgcnBjUmVxdWVzdC5nYXMgPSBudW1iZXJUb0hleChyZXF1ZXN0Lmdhcyk7XG4gICAgaWYgKHR5cGVvZiByZXF1ZXN0Lmdhc1ByaWNlICE9PSAndW5kZWZpbmVkJylcbiAgICAgICAgcnBjUmVxdWVzdC5nYXNQcmljZSA9IG51bWJlclRvSGV4KHJlcXVlc3QuZ2FzUHJpY2UpO1xuICAgIGlmICh0eXBlb2YgcmVxdWVzdC5tYXhGZWVQZXJCbG9iR2FzICE9PSAndW5kZWZpbmVkJylcbiAgICAgICAgcnBjUmVxdWVzdC5tYXhGZWVQZXJCbG9iR2FzID0gbnVtYmVyVG9IZXgocmVxdWVzdC5tYXhGZWVQZXJCbG9iR2FzKTtcbiAgICBpZiAodHlwZW9mIHJlcXVlc3QubWF4RmVlUGVyR2FzICE9PSAndW5kZWZpbmVkJylcbiAgICAgICAgcnBjUmVxdWVzdC5tYXhGZWVQZXJHYXMgPSBudW1iZXJUb0hleChyZXF1ZXN0Lm1heEZlZVBlckdhcyk7XG4gICAgaWYgKHR5cGVvZiByZXF1ZXN0Lm1heFByaW9yaXR5RmVlUGVyR2FzICE9PSAndW5kZWZpbmVkJylcbiAgICAgICAgcnBjUmVxdWVzdC5tYXhQcmlvcml0eUZlZVBlckdhcyA9IG51bWJlclRvSGV4KHJlcXVlc3QubWF4UHJpb3JpdHlGZWVQZXJHYXMpO1xuICAgIGlmICh0eXBlb2YgcmVxdWVzdC5ub25jZSAhPT0gJ3VuZGVmaW5lZCcpXG4gICAgICAgIHJwY1JlcXVlc3Qubm9uY2UgPSBudW1iZXJUb0hleChyZXF1ZXN0Lm5vbmNlKTtcbiAgICBpZiAodHlwZW9mIHJlcXVlc3QudG8gIT09ICd1bmRlZmluZWQnKVxuICAgICAgICBycGNSZXF1ZXN0LnRvID0gcmVxdWVzdC50bztcbiAgICBpZiAodHlwZW9mIHJlcXVlc3QudHlwZSAhPT0gJ3VuZGVmaW5lZCcpXG4gICAgICAgIHJwY1JlcXVlc3QudHlwZSA9IHJwY1RyYW5zYWN0aW9uVHlwZVtyZXF1ZXN0LnR5cGVdO1xuICAgIGlmICh0eXBlb2YgcmVxdWVzdC52YWx1ZSAhPT0gJ3VuZGVmaW5lZCcpXG4gICAgICAgIHJwY1JlcXVlc3QudmFsdWUgPSBudW1iZXJUb0hleChyZXF1ZXN0LnZhbHVlKTtcbiAgICByZXR1cm4gcnBjUmVxdWVzdDtcbn1cbmV4cG9ydCBjb25zdCBkZWZpbmVUcmFuc2FjdGlvblJlcXVlc3QgPSAvKiNfX1BVUkVfXyovIGRlZmluZUZvcm1hdHRlcigndHJhbnNhY3Rpb25SZXF1ZXN0JywgZm9ybWF0VHJhbnNhY3Rpb25SZXF1ZXN0KTtcbi8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vL1xuZnVuY3Rpb24gZm9ybWF0QXV0aG9yaXphdGlvbkxpc3QoYXV0aG9yaXphdGlvbkxpc3QpIHtcbiAgICByZXR1cm4gYXV0aG9yaXphdGlvbkxpc3QubWFwKChhdXRob3JpemF0aW9uKSA9PiAoe1xuICAgICAgICBhZGRyZXNzOiBhdXRob3JpemF0aW9uLmFkZHJlc3MsXG4gICAgICAgIHI6IGF1dGhvcml6YXRpb24uclxuICAgICAgICAgICAgPyBudW1iZXJUb0hleChCaWdJbnQoYXV0aG9yaXphdGlvbi5yKSlcbiAgICAgICAgICAgIDogYXV0aG9yaXphdGlvbi5yLFxuICAgICAgICBzOiBhdXRob3JpemF0aW9uLnNcbiAgICAgICAgICAgID8gbnVtYmVyVG9IZXgoQmlnSW50KGF1dGhvcml6YXRpb24ucykpXG4gICAgICAgICAgICA6IGF1dGhvcml6YXRpb24ucyxcbiAgICAgICAgY2hhaW5JZDogbnVtYmVyVG9IZXgoYXV0aG9yaXphdGlvbi5jaGFpbklkKSxcbiAgICAgICAgbm9uY2U6IG51bWJlclRvSGV4KGF1dGhvcml6YXRpb24ubm9uY2UpLFxuICAgICAgICAuLi4odHlwZW9mIGF1dGhvcml6YXRpb24ueVBhcml0eSAhPT0gJ3VuZGVmaW5lZCdcbiAgICAgICAgICAgID8geyB5UGFyaXR5OiBudW1iZXJUb0hleChhdXRob3JpemF0aW9uLnlQYXJpdHkpIH1cbiAgICAgICAgICAgIDoge30pLFxuICAgICAgICAuLi4odHlwZW9mIGF1dGhvcml6YXRpb24udiAhPT0gJ3VuZGVmaW5lZCcgJiZcbiAgICAgICAgICAgIHR5cGVvZiBhdXRob3JpemF0aW9uLnlQYXJpdHkgPT09ICd1bmRlZmluZWQnXG4gICAgICAgICAgICA/IHsgdjogbnVtYmVyVG9IZXgoYXV0aG9yaXphdGlvbi52KSB9XG4gICAgICAgICAgICA6IHt9KSxcbiAgICB9KSk7XG59XG4vLyMgc291cmNlTWFwcGluZ1VSTD10cmFuc2FjdGlvblJlcXVlc3QuanMubWFwIiwKICAgICIvKiogQGludGVybmFsICovXG5leHBvcnQgZnVuY3Rpb24gd2l0aFJlc29sdmVycygpIHtcbiAgICBsZXQgcmVzb2x2ZSA9ICgpID0+IHVuZGVmaW5lZDtcbiAgICBsZXQgcmVqZWN0ID0gKCkgPT4gdW5kZWZpbmVkO1xuICAgIGNvbnN0IHByb21pc2UgPSBuZXcgUHJvbWlzZSgocmVzb2x2ZV8sIHJlamVjdF8pID0+IHtcbiAgICAgICAgcmVzb2x2ZSA9IHJlc29sdmVfO1xuICAgICAgICByZWplY3QgPSByZWplY3RfO1xuICAgIH0pO1xuICAgIHJldHVybiB7IHByb21pc2UsIHJlc29sdmUsIHJlamVjdCB9O1xufVxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9d2l0aFJlc29sdmVycy5qcy5tYXAiLAogICAgImltcG9ydCB7IHdpdGhSZXNvbHZlcnMgfSBmcm9tICcuL3dpdGhSZXNvbHZlcnMuanMnO1xuY29uc3Qgc2NoZWR1bGVyQ2FjaGUgPSAvKiNfX1BVUkVfXyovIG5ldyBNYXAoKTtcbi8qKiBAaW50ZXJuYWwgKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVCYXRjaFNjaGVkdWxlcih7IGZuLCBpZCwgc2hvdWxkU3BsaXRCYXRjaCwgd2FpdCA9IDAsIHNvcnQsIH0pIHtcbiAgICBjb25zdCBleGVjID0gYXN5bmMgKCkgPT4ge1xuICAgICAgICBjb25zdCBzY2hlZHVsZXIgPSBnZXRTY2hlZHVsZXIoKTtcbiAgICAgICAgZmx1c2goKTtcbiAgICAgICAgY29uc3QgYXJncyA9IHNjaGVkdWxlci5tYXAoKHsgYXJncyB9KSA9PiBhcmdzKTtcbiAgICAgICAgaWYgKGFyZ3MubGVuZ3RoID09PSAwKVxuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICBmbihhcmdzKVxuICAgICAgICAgICAgLnRoZW4oKGRhdGEpID0+IHtcbiAgICAgICAgICAgIGlmIChzb3J0ICYmIEFycmF5LmlzQXJyYXkoZGF0YSkpXG4gICAgICAgICAgICAgICAgZGF0YS5zb3J0KHNvcnQpO1xuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBzY2hlZHVsZXIubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICBjb25zdCB7IHJlc29sdmUgfSA9IHNjaGVkdWxlcltpXTtcbiAgICAgICAgICAgICAgICByZXNvbHZlPy4oW2RhdGFbaV0sIGRhdGFdKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSlcbiAgICAgICAgICAgIC5jYXRjaCgoZXJyKSA9PiB7XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHNjaGVkdWxlci5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIGNvbnN0IHsgcmVqZWN0IH0gPSBzY2hlZHVsZXJbaV07XG4gICAgICAgICAgICAgICAgcmVqZWN0Py4oZXJyKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfTtcbiAgICBjb25zdCBmbHVzaCA9ICgpID0+IHNjaGVkdWxlckNhY2hlLmRlbGV0ZShpZCk7XG4gICAgY29uc3QgZ2V0QmF0Y2hlZEFyZ3MgPSAoKSA9PiBnZXRTY2hlZHVsZXIoKS5tYXAoKHsgYXJncyB9KSA9PiBhcmdzKTtcbiAgICBjb25zdCBnZXRTY2hlZHVsZXIgPSAoKSA9PiBzY2hlZHVsZXJDYWNoZS5nZXQoaWQpIHx8IFtdO1xuICAgIGNvbnN0IHNldFNjaGVkdWxlciA9IChpdGVtKSA9PiBzY2hlZHVsZXJDYWNoZS5zZXQoaWQsIFsuLi5nZXRTY2hlZHVsZXIoKSwgaXRlbV0pO1xuICAgIHJldHVybiB7XG4gICAgICAgIGZsdXNoLFxuICAgICAgICBhc3luYyBzY2hlZHVsZShhcmdzKSB7XG4gICAgICAgICAgICBjb25zdCB7IHByb21pc2UsIHJlc29sdmUsIHJlamVjdCB9ID0gd2l0aFJlc29sdmVycygpO1xuICAgICAgICAgICAgY29uc3Qgc3BsaXQgPSBzaG91bGRTcGxpdEJhdGNoPy4oWy4uLmdldEJhdGNoZWRBcmdzKCksIGFyZ3NdKTtcbiAgICAgICAgICAgIGlmIChzcGxpdClcbiAgICAgICAgICAgICAgICBleGVjKCk7XG4gICAgICAgICAgICBjb25zdCBoYXNBY3RpdmVTY2hlZHVsZXIgPSBnZXRTY2hlZHVsZXIoKS5sZW5ndGggPiAwO1xuICAgICAgICAgICAgaWYgKGhhc0FjdGl2ZVNjaGVkdWxlcikge1xuICAgICAgICAgICAgICAgIHNldFNjaGVkdWxlcih7IGFyZ3MsIHJlc29sdmUsIHJlamVjdCB9KTtcbiAgICAgICAgICAgICAgICByZXR1cm4gcHJvbWlzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHNldFNjaGVkdWxlcih7IGFyZ3MsIHJlc29sdmUsIHJlamVjdCB9KTtcbiAgICAgICAgICAgIHNldFRpbWVvdXQoZXhlYywgd2FpdCk7XG4gICAgICAgICAgICByZXR1cm4gcHJvbWlzZTtcbiAgICAgICAgfSxcbiAgICB9O1xufVxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9Y3JlYXRlQmF0Y2hTY2hlZHVsZXIuanMubWFwIiwKICAgICJpbXBvcnQgeyBJbnZhbGlkQWRkcmVzc0Vycm9yLCB9IGZyb20gJy4uL2Vycm9ycy9hZGRyZXNzLmpzJztcbmltcG9ydCB7IEludmFsaWRCeXRlc0xlbmd0aEVycm9yLCB9IGZyb20gJy4uL2Vycm9ycy9kYXRhLmpzJztcbmltcG9ydCB7IEFjY291bnRTdGF0ZUNvbmZsaWN0RXJyb3IsIFN0YXRlQXNzaWdubWVudENvbmZsaWN0RXJyb3IsIH0gZnJvbSAnLi4vZXJyb3JzL3N0YXRlT3ZlcnJpZGUuanMnO1xuaW1wb3J0IHsgaXNBZGRyZXNzIH0gZnJvbSAnLi9hZGRyZXNzL2lzQWRkcmVzcy5qcyc7XG5pbXBvcnQgeyBudW1iZXJUb0hleCB9IGZyb20gJy4vZW5jb2RpbmcvdG9IZXguanMnO1xuLyoqIEBpbnRlcm5hbCAqL1xuZXhwb3J0IGZ1bmN0aW9uIHNlcmlhbGl6ZVN0YXRlTWFwcGluZyhzdGF0ZU1hcHBpbmcpIHtcbiAgICBpZiAoIXN0YXRlTWFwcGluZyB8fCBzdGF0ZU1hcHBpbmcubGVuZ3RoID09PSAwKVxuICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgIHJldHVybiBzdGF0ZU1hcHBpbmcucmVkdWNlKChhY2MsIHsgc2xvdCwgdmFsdWUgfSkgPT4ge1xuICAgICAgICBpZiAoc2xvdC5sZW5ndGggIT09IDY2KVxuICAgICAgICAgICAgdGhyb3cgbmV3IEludmFsaWRCeXRlc0xlbmd0aEVycm9yKHtcbiAgICAgICAgICAgICAgICBzaXplOiBzbG90Lmxlbmd0aCxcbiAgICAgICAgICAgICAgICB0YXJnZXRTaXplOiA2NixcbiAgICAgICAgICAgICAgICB0eXBlOiAnaGV4JyxcbiAgICAgICAgICAgIH0pO1xuICAgICAgICBpZiAodmFsdWUubGVuZ3RoICE9PSA2NilcbiAgICAgICAgICAgIHRocm93IG5ldyBJbnZhbGlkQnl0ZXNMZW5ndGhFcnJvcih7XG4gICAgICAgICAgICAgICAgc2l6ZTogdmFsdWUubGVuZ3RoLFxuICAgICAgICAgICAgICAgIHRhcmdldFNpemU6IDY2LFxuICAgICAgICAgICAgICAgIHR5cGU6ICdoZXgnLFxuICAgICAgICAgICAgfSk7XG4gICAgICAgIGFjY1tzbG90XSA9IHZhbHVlO1xuICAgICAgICByZXR1cm4gYWNjO1xuICAgIH0sIHt9KTtcbn1cbi8qKiBAaW50ZXJuYWwgKi9cbmV4cG9ydCBmdW5jdGlvbiBzZXJpYWxpemVBY2NvdW50U3RhdGVPdmVycmlkZShwYXJhbWV0ZXJzKSB7XG4gICAgY29uc3QgeyBiYWxhbmNlLCBub25jZSwgc3RhdGUsIHN0YXRlRGlmZiwgY29kZSB9ID0gcGFyYW1ldGVycztcbiAgICBjb25zdCBycGNBY2NvdW50U3RhdGVPdmVycmlkZSA9IHt9O1xuICAgIGlmIChjb2RlICE9PSB1bmRlZmluZWQpXG4gICAgICAgIHJwY0FjY291bnRTdGF0ZU92ZXJyaWRlLmNvZGUgPSBjb2RlO1xuICAgIGlmIChiYWxhbmNlICE9PSB1bmRlZmluZWQpXG4gICAgICAgIHJwY0FjY291bnRTdGF0ZU92ZXJyaWRlLmJhbGFuY2UgPSBudW1iZXJUb0hleChiYWxhbmNlKTtcbiAgICBpZiAobm9uY2UgIT09IHVuZGVmaW5lZClcbiAgICAgICAgcnBjQWNjb3VudFN0YXRlT3ZlcnJpZGUubm9uY2UgPSBudW1iZXJUb0hleChub25jZSk7XG4gICAgaWYgKHN0YXRlICE9PSB1bmRlZmluZWQpXG4gICAgICAgIHJwY0FjY291bnRTdGF0ZU92ZXJyaWRlLnN0YXRlID0gc2VyaWFsaXplU3RhdGVNYXBwaW5nKHN0YXRlKTtcbiAgICBpZiAoc3RhdGVEaWZmICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgaWYgKHJwY0FjY291bnRTdGF0ZU92ZXJyaWRlLnN0YXRlKVxuICAgICAgICAgICAgdGhyb3cgbmV3IFN0YXRlQXNzaWdubWVudENvbmZsaWN0RXJyb3IoKTtcbiAgICAgICAgcnBjQWNjb3VudFN0YXRlT3ZlcnJpZGUuc3RhdGVEaWZmID0gc2VyaWFsaXplU3RhdGVNYXBwaW5nKHN0YXRlRGlmZik7XG4gICAgfVxuICAgIHJldHVybiBycGNBY2NvdW50U3RhdGVPdmVycmlkZTtcbn1cbi8qKiBAaW50ZXJuYWwgKi9cbmV4cG9ydCBmdW5jdGlvbiBzZXJpYWxpemVTdGF0ZU92ZXJyaWRlKHBhcmFtZXRlcnMpIHtcbiAgICBpZiAoIXBhcmFtZXRlcnMpXG4gICAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgY29uc3QgcnBjU3RhdGVPdmVycmlkZSA9IHt9O1xuICAgIGZvciAoY29uc3QgeyBhZGRyZXNzLCAuLi5hY2NvdW50U3RhdGUgfSBvZiBwYXJhbWV0ZXJzKSB7XG4gICAgICAgIGlmICghaXNBZGRyZXNzKGFkZHJlc3MsIHsgc3RyaWN0OiBmYWxzZSB9KSlcbiAgICAgICAgICAgIHRocm93IG5ldyBJbnZhbGlkQWRkcmVzc0Vycm9yKHsgYWRkcmVzcyB9KTtcbiAgICAgICAgaWYgKHJwY1N0YXRlT3ZlcnJpZGVbYWRkcmVzc10pXG4gICAgICAgICAgICB0aHJvdyBuZXcgQWNjb3VudFN0YXRlQ29uZmxpY3RFcnJvcih7IGFkZHJlc3M6IGFkZHJlc3MgfSk7XG4gICAgICAgIHJwY1N0YXRlT3ZlcnJpZGVbYWRkcmVzc10gPSBzZXJpYWxpemVBY2NvdW50U3RhdGVPdmVycmlkZShhY2NvdW50U3RhdGUpO1xuICAgIH1cbiAgICByZXR1cm4gcnBjU3RhdGVPdmVycmlkZTtcbn1cbi8vIyBzb3VyY2VNYXBwaW5nVVJMPXN0YXRlT3ZlcnJpZGUuanMubWFwIiwKICAgICJleHBvcnQgY29uc3QgbWF4SW50OCA9IDJuICoqICg4biAtIDFuKSAtIDFuO1xuZXhwb3J0IGNvbnN0IG1heEludDE2ID0gMm4gKiogKDE2biAtIDFuKSAtIDFuO1xuZXhwb3J0IGNvbnN0IG1heEludDI0ID0gMm4gKiogKDI0biAtIDFuKSAtIDFuO1xuZXhwb3J0IGNvbnN0IG1heEludDMyID0gMm4gKiogKDMybiAtIDFuKSAtIDFuO1xuZXhwb3J0IGNvbnN0IG1heEludDQwID0gMm4gKiogKDQwbiAtIDFuKSAtIDFuO1xuZXhwb3J0IGNvbnN0IG1heEludDQ4ID0gMm4gKiogKDQ4biAtIDFuKSAtIDFuO1xuZXhwb3J0IGNvbnN0IG1heEludDU2ID0gMm4gKiogKDU2biAtIDFuKSAtIDFuO1xuZXhwb3J0IGNvbnN0IG1heEludDY0ID0gMm4gKiogKDY0biAtIDFuKSAtIDFuO1xuZXhwb3J0IGNvbnN0IG1heEludDcyID0gMm4gKiogKDcybiAtIDFuKSAtIDFuO1xuZXhwb3J0IGNvbnN0IG1heEludDgwID0gMm4gKiogKDgwbiAtIDFuKSAtIDFuO1xuZXhwb3J0IGNvbnN0IG1heEludDg4ID0gMm4gKiogKDg4biAtIDFuKSAtIDFuO1xuZXhwb3J0IGNvbnN0IG1heEludDk2ID0gMm4gKiogKDk2biAtIDFuKSAtIDFuO1xuZXhwb3J0IGNvbnN0IG1heEludDEwNCA9IDJuICoqICgxMDRuIC0gMW4pIC0gMW47XG5leHBvcnQgY29uc3QgbWF4SW50MTEyID0gMm4gKiogKDExMm4gLSAxbikgLSAxbjtcbmV4cG9ydCBjb25zdCBtYXhJbnQxMjAgPSAybiAqKiAoMTIwbiAtIDFuKSAtIDFuO1xuZXhwb3J0IGNvbnN0IG1heEludDEyOCA9IDJuICoqICgxMjhuIC0gMW4pIC0gMW47XG5leHBvcnQgY29uc3QgbWF4SW50MTM2ID0gMm4gKiogKDEzNm4gLSAxbikgLSAxbjtcbmV4cG9ydCBjb25zdCBtYXhJbnQxNDQgPSAybiAqKiAoMTQ0biAtIDFuKSAtIDFuO1xuZXhwb3J0IGNvbnN0IG1heEludDE1MiA9IDJuICoqICgxNTJuIC0gMW4pIC0gMW47XG5leHBvcnQgY29uc3QgbWF4SW50MTYwID0gMm4gKiogKDE2MG4gLSAxbikgLSAxbjtcbmV4cG9ydCBjb25zdCBtYXhJbnQxNjggPSAybiAqKiAoMTY4biAtIDFuKSAtIDFuO1xuZXhwb3J0IGNvbnN0IG1heEludDE3NiA9IDJuICoqICgxNzZuIC0gMW4pIC0gMW47XG5leHBvcnQgY29uc3QgbWF4SW50MTg0ID0gMm4gKiogKDE4NG4gLSAxbikgLSAxbjtcbmV4cG9ydCBjb25zdCBtYXhJbnQxOTIgPSAybiAqKiAoMTkybiAtIDFuKSAtIDFuO1xuZXhwb3J0IGNvbnN0IG1heEludDIwMCA9IDJuICoqICgyMDBuIC0gMW4pIC0gMW47XG5leHBvcnQgY29uc3QgbWF4SW50MjA4ID0gMm4gKiogKDIwOG4gLSAxbikgLSAxbjtcbmV4cG9ydCBjb25zdCBtYXhJbnQyMTYgPSAybiAqKiAoMjE2biAtIDFuKSAtIDFuO1xuZXhwb3J0IGNvbnN0IG1heEludDIyNCA9IDJuICoqICgyMjRuIC0gMW4pIC0gMW47XG5leHBvcnQgY29uc3QgbWF4SW50MjMyID0gMm4gKiogKDIzMm4gLSAxbikgLSAxbjtcbmV4cG9ydCBjb25zdCBtYXhJbnQyNDAgPSAybiAqKiAoMjQwbiAtIDFuKSAtIDFuO1xuZXhwb3J0IGNvbnN0IG1heEludDI0OCA9IDJuICoqICgyNDhuIC0gMW4pIC0gMW47XG5leHBvcnQgY29uc3QgbWF4SW50MjU2ID0gMm4gKiogKDI1Nm4gLSAxbikgLSAxbjtcbmV4cG9ydCBjb25zdCBtaW5JbnQ4ID0gLSgybiAqKiAoOG4gLSAxbikpO1xuZXhwb3J0IGNvbnN0IG1pbkludDE2ID0gLSgybiAqKiAoMTZuIC0gMW4pKTtcbmV4cG9ydCBjb25zdCBtaW5JbnQyNCA9IC0oMm4gKiogKDI0biAtIDFuKSk7XG5leHBvcnQgY29uc3QgbWluSW50MzIgPSAtKDJuICoqICgzMm4gLSAxbikpO1xuZXhwb3J0IGNvbnN0IG1pbkludDQwID0gLSgybiAqKiAoNDBuIC0gMW4pKTtcbmV4cG9ydCBjb25zdCBtaW5JbnQ0OCA9IC0oMm4gKiogKDQ4biAtIDFuKSk7XG5leHBvcnQgY29uc3QgbWluSW50NTYgPSAtKDJuICoqICg1Nm4gLSAxbikpO1xuZXhwb3J0IGNvbnN0IG1pbkludDY0ID0gLSgybiAqKiAoNjRuIC0gMW4pKTtcbmV4cG9ydCBjb25zdCBtaW5JbnQ3MiA9IC0oMm4gKiogKDcybiAtIDFuKSk7XG5leHBvcnQgY29uc3QgbWluSW50ODAgPSAtKDJuICoqICg4MG4gLSAxbikpO1xuZXhwb3J0IGNvbnN0IG1pbkludDg4ID0gLSgybiAqKiAoODhuIC0gMW4pKTtcbmV4cG9ydCBjb25zdCBtaW5JbnQ5NiA9IC0oMm4gKiogKDk2biAtIDFuKSk7XG5leHBvcnQgY29uc3QgbWluSW50MTA0ID0gLSgybiAqKiAoMTA0biAtIDFuKSk7XG5leHBvcnQgY29uc3QgbWluSW50MTEyID0gLSgybiAqKiAoMTEybiAtIDFuKSk7XG5leHBvcnQgY29uc3QgbWluSW50MTIwID0gLSgybiAqKiAoMTIwbiAtIDFuKSk7XG5leHBvcnQgY29uc3QgbWluSW50MTI4ID0gLSgybiAqKiAoMTI4biAtIDFuKSk7XG5leHBvcnQgY29uc3QgbWluSW50MTM2ID0gLSgybiAqKiAoMTM2biAtIDFuKSk7XG5leHBvcnQgY29uc3QgbWluSW50MTQ0ID0gLSgybiAqKiAoMTQ0biAtIDFuKSk7XG5leHBvcnQgY29uc3QgbWluSW50MTUyID0gLSgybiAqKiAoMTUybiAtIDFuKSk7XG5leHBvcnQgY29uc3QgbWluSW50MTYwID0gLSgybiAqKiAoMTYwbiAtIDFuKSk7XG5leHBvcnQgY29uc3QgbWluSW50MTY4ID0gLSgybiAqKiAoMTY4biAtIDFuKSk7XG5leHBvcnQgY29uc3QgbWluSW50MTc2ID0gLSgybiAqKiAoMTc2biAtIDFuKSk7XG5leHBvcnQgY29uc3QgbWluSW50MTg0ID0gLSgybiAqKiAoMTg0biAtIDFuKSk7XG5leHBvcnQgY29uc3QgbWluSW50MTkyID0gLSgybiAqKiAoMTkybiAtIDFuKSk7XG5leHBvcnQgY29uc3QgbWluSW50MjAwID0gLSgybiAqKiAoMjAwbiAtIDFuKSk7XG5leHBvcnQgY29uc3QgbWluSW50MjA4ID0gLSgybiAqKiAoMjA4biAtIDFuKSk7XG5leHBvcnQgY29uc3QgbWluSW50MjE2ID0gLSgybiAqKiAoMjE2biAtIDFuKSk7XG5leHBvcnQgY29uc3QgbWluSW50MjI0ID0gLSgybiAqKiAoMjI0biAtIDFuKSk7XG5leHBvcnQgY29uc3QgbWluSW50MjMyID0gLSgybiAqKiAoMjMybiAtIDFuKSk7XG5leHBvcnQgY29uc3QgbWluSW50MjQwID0gLSgybiAqKiAoMjQwbiAtIDFuKSk7XG5leHBvcnQgY29uc3QgbWluSW50MjQ4ID0gLSgybiAqKiAoMjQ4biAtIDFuKSk7XG5leHBvcnQgY29uc3QgbWluSW50MjU2ID0gLSgybiAqKiAoMjU2biAtIDFuKSk7XG5leHBvcnQgY29uc3QgbWF4VWludDggPSAybiAqKiA4biAtIDFuO1xuZXhwb3J0IGNvbnN0IG1heFVpbnQxNiA9IDJuICoqIDE2biAtIDFuO1xuZXhwb3J0IGNvbnN0IG1heFVpbnQyNCA9IDJuICoqIDI0biAtIDFuO1xuZXhwb3J0IGNvbnN0IG1heFVpbnQzMiA9IDJuICoqIDMybiAtIDFuO1xuZXhwb3J0IGNvbnN0IG1heFVpbnQ0MCA9IDJuICoqIDQwbiAtIDFuO1xuZXhwb3J0IGNvbnN0IG1heFVpbnQ0OCA9IDJuICoqIDQ4biAtIDFuO1xuZXhwb3J0IGNvbnN0IG1heFVpbnQ1NiA9IDJuICoqIDU2biAtIDFuO1xuZXhwb3J0IGNvbnN0IG1heFVpbnQ2NCA9IDJuICoqIDY0biAtIDFuO1xuZXhwb3J0IGNvbnN0IG1heFVpbnQ3MiA9IDJuICoqIDcybiAtIDFuO1xuZXhwb3J0IGNvbnN0IG1heFVpbnQ4MCA9IDJuICoqIDgwbiAtIDFuO1xuZXhwb3J0IGNvbnN0IG1heFVpbnQ4OCA9IDJuICoqIDg4biAtIDFuO1xuZXhwb3J0IGNvbnN0IG1heFVpbnQ5NiA9IDJuICoqIDk2biAtIDFuO1xuZXhwb3J0IGNvbnN0IG1heFVpbnQxMDQgPSAybiAqKiAxMDRuIC0gMW47XG5leHBvcnQgY29uc3QgbWF4VWludDExMiA9IDJuICoqIDExMm4gLSAxbjtcbmV4cG9ydCBjb25zdCBtYXhVaW50MTIwID0gMm4gKiogMTIwbiAtIDFuO1xuZXhwb3J0IGNvbnN0IG1heFVpbnQxMjggPSAybiAqKiAxMjhuIC0gMW47XG5leHBvcnQgY29uc3QgbWF4VWludDEzNiA9IDJuICoqIDEzNm4gLSAxbjtcbmV4cG9ydCBjb25zdCBtYXhVaW50MTQ0ID0gMm4gKiogMTQ0biAtIDFuO1xuZXhwb3J0IGNvbnN0IG1heFVpbnQxNTIgPSAybiAqKiAxNTJuIC0gMW47XG5leHBvcnQgY29uc3QgbWF4VWludDE2MCA9IDJuICoqIDE2MG4gLSAxbjtcbmV4cG9ydCBjb25zdCBtYXhVaW50MTY4ID0gMm4gKiogMTY4biAtIDFuO1xuZXhwb3J0IGNvbnN0IG1heFVpbnQxNzYgPSAybiAqKiAxNzZuIC0gMW47XG5leHBvcnQgY29uc3QgbWF4VWludDE4NCA9IDJuICoqIDE4NG4gLSAxbjtcbmV4cG9ydCBjb25zdCBtYXhVaW50MTkyID0gMm4gKiogMTkybiAtIDFuO1xuZXhwb3J0IGNvbnN0IG1heFVpbnQyMDAgPSAybiAqKiAyMDBuIC0gMW47XG5leHBvcnQgY29uc3QgbWF4VWludDIwOCA9IDJuICoqIDIwOG4gLSAxbjtcbmV4cG9ydCBjb25zdCBtYXhVaW50MjE2ID0gMm4gKiogMjE2biAtIDFuO1xuZXhwb3J0IGNvbnN0IG1heFVpbnQyMjQgPSAybiAqKiAyMjRuIC0gMW47XG5leHBvcnQgY29uc3QgbWF4VWludDIzMiA9IDJuICoqIDIzMm4gLSAxbjtcbmV4cG9ydCBjb25zdCBtYXhVaW50MjQwID0gMm4gKiogMjQwbiAtIDFuO1xuZXhwb3J0IGNvbnN0IG1heFVpbnQyNDggPSAybiAqKiAyNDhuIC0gMW47XG5leHBvcnQgY29uc3QgbWF4VWludDI1NiA9IDJuICoqIDI1Nm4gLSAxbjtcbi8vIyBzb3VyY2VNYXBwaW5nVVJMPW51bWJlci5qcy5tYXAiLAogICAgImltcG9ydCB7IHBhcnNlQWNjb3VudCwgfSBmcm9tICcuLi8uLi9hY2NvdW50cy91dGlscy9wYXJzZUFjY291bnQuanMnO1xuaW1wb3J0IHsgbWF4VWludDI1NiB9IGZyb20gJy4uLy4uL2NvbnN0YW50cy9udW1iZXIuanMnO1xuaW1wb3J0IHsgSW52YWxpZEFkZHJlc3NFcnJvciwgfSBmcm9tICcuLi8uLi9lcnJvcnMvYWRkcmVzcy5qcyc7XG5pbXBvcnQgeyBGZWVDYXBUb29IaWdoRXJyb3IsIFRpcEFib3ZlRmVlQ2FwRXJyb3IsIH0gZnJvbSAnLi4vLi4vZXJyb3JzL25vZGUuanMnO1xuaW1wb3J0IHsgaXNBZGRyZXNzIH0gZnJvbSAnLi4vYWRkcmVzcy9pc0FkZHJlc3MuanMnO1xuZXhwb3J0IGZ1bmN0aW9uIGFzc2VydFJlcXVlc3QoYXJncykge1xuICAgIGNvbnN0IHsgYWNjb3VudDogYWNjb3VudF8sIG1heEZlZVBlckdhcywgbWF4UHJpb3JpdHlGZWVQZXJHYXMsIHRvIH0gPSBhcmdzO1xuICAgIGNvbnN0IGFjY291bnQgPSBhY2NvdW50XyA/IHBhcnNlQWNjb3VudChhY2NvdW50XykgOiB1bmRlZmluZWQ7XG4gICAgaWYgKGFjY291bnQgJiYgIWlzQWRkcmVzcyhhY2NvdW50LmFkZHJlc3MpKVxuICAgICAgICB0aHJvdyBuZXcgSW52YWxpZEFkZHJlc3NFcnJvcih7IGFkZHJlc3M6IGFjY291bnQuYWRkcmVzcyB9KTtcbiAgICBpZiAodG8gJiYgIWlzQWRkcmVzcyh0bykpXG4gICAgICAgIHRocm93IG5ldyBJbnZhbGlkQWRkcmVzc0Vycm9yKHsgYWRkcmVzczogdG8gfSk7XG4gICAgaWYgKG1heEZlZVBlckdhcyAmJiBtYXhGZWVQZXJHYXMgPiBtYXhVaW50MjU2KVxuICAgICAgICB0aHJvdyBuZXcgRmVlQ2FwVG9vSGlnaEVycm9yKHsgbWF4RmVlUGVyR2FzIH0pO1xuICAgIGlmIChtYXhQcmlvcml0eUZlZVBlckdhcyAmJlxuICAgICAgICBtYXhGZWVQZXJHYXMgJiZcbiAgICAgICAgbWF4UHJpb3JpdHlGZWVQZXJHYXMgPiBtYXhGZWVQZXJHYXMpXG4gICAgICAgIHRocm93IG5ldyBUaXBBYm92ZUZlZUNhcEVycm9yKHsgbWF4RmVlUGVyR2FzLCBtYXhQcmlvcml0eUZlZVBlckdhcyB9KTtcbn1cbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWFzc2VydFJlcXVlc3QuanMubWFwIiwKICAgICJpbXBvcnQgeyBwYXJzZUFiaSB9IGZyb20gJ2FiaXR5cGUnO1xuaW1wb3J0ICogYXMgQmxvY2tPdmVycmlkZXMgZnJvbSAnb3gvQmxvY2tPdmVycmlkZXMnO1xuaW1wb3J0IHsgcGFyc2VBY2NvdW50LCB9IGZyb20gJy4uLy4uL2FjY291bnRzL3V0aWxzL3BhcnNlQWNjb3VudC5qcyc7XG5pbXBvcnQgeyBtdWx0aWNhbGwzQWJpIH0gZnJvbSAnLi4vLi4vY29uc3RhbnRzL2FiaXMuanMnO1xuaW1wb3J0IHsgYWdncmVnYXRlM1NpZ25hdHVyZSB9IGZyb20gJy4uLy4uL2NvbnN0YW50cy9jb250cmFjdC5qcyc7XG5pbXBvcnQgeyBkZXBsb3lsZXNzQ2FsbFZpYUJ5dGVjb2RlQnl0ZWNvZGUsIGRlcGxveWxlc3NDYWxsVmlhRmFjdG9yeUJ5dGVjb2RlLCBtdWx0aWNhbGwzQnl0ZWNvZGUsIH0gZnJvbSAnLi4vLi4vY29uc3RhbnRzL2NvbnRyYWN0cy5qcyc7XG5pbXBvcnQgeyBCYXNlRXJyb3IgfSBmcm9tICcuLi8uLi9lcnJvcnMvYmFzZS5qcyc7XG5pbXBvcnQgeyBDaGFpbkRvZXNOb3RTdXBwb3J0Q29udHJhY3QsIENsaWVudENoYWluTm90Q29uZmlndXJlZEVycm9yLCB9IGZyb20gJy4uLy4uL2Vycm9ycy9jaGFpbi5qcyc7XG5pbXBvcnQgeyBDb3VudGVyZmFjdHVhbERlcGxveW1lbnRGYWlsZWRFcnJvciwgUmF3Q29udHJhY3RFcnJvciwgfSBmcm9tICcuLi8uLi9lcnJvcnMvY29udHJhY3QuanMnO1xuaW1wb3J0IHsgZGVjb2RlRnVuY3Rpb25SZXN1bHQsIH0gZnJvbSAnLi4vLi4vdXRpbHMvYWJpL2RlY29kZUZ1bmN0aW9uUmVzdWx0LmpzJztcbmltcG9ydCB7IGVuY29kZURlcGxveURhdGEsIH0gZnJvbSAnLi4vLi4vdXRpbHMvYWJpL2VuY29kZURlcGxveURhdGEuanMnO1xuaW1wb3J0IHsgZW5jb2RlRnVuY3Rpb25EYXRhLCB9IGZyb20gJy4uLy4uL3V0aWxzL2FiaS9lbmNvZGVGdW5jdGlvbkRhdGEuanMnO1xuaW1wb3J0IHsgZ2V0Q2hhaW5Db250cmFjdEFkZHJlc3MsIH0gZnJvbSAnLi4vLi4vdXRpbHMvY2hhaW4vZ2V0Q2hhaW5Db250cmFjdEFkZHJlc3MuanMnO1xuaW1wb3J0IHsgbnVtYmVyVG9IZXgsIH0gZnJvbSAnLi4vLi4vdXRpbHMvZW5jb2RpbmcvdG9IZXguanMnO1xuaW1wb3J0IHsgZ2V0Q2FsbEVycm9yLCB9IGZyb20gJy4uLy4uL3V0aWxzL2Vycm9ycy9nZXRDYWxsRXJyb3IuanMnO1xuaW1wb3J0IHsgZXh0cmFjdCB9IGZyb20gJy4uLy4uL3V0aWxzL2Zvcm1hdHRlcnMvZXh0cmFjdC5qcyc7XG5pbXBvcnQgeyBmb3JtYXRUcmFuc2FjdGlvblJlcXVlc3QsIH0gZnJvbSAnLi4vLi4vdXRpbHMvZm9ybWF0dGVycy90cmFuc2FjdGlvblJlcXVlc3QuanMnO1xuaW1wb3J0IHsgY3JlYXRlQmF0Y2hTY2hlZHVsZXIsIH0gZnJvbSAnLi4vLi4vdXRpbHMvcHJvbWlzZS9jcmVhdGVCYXRjaFNjaGVkdWxlci5qcyc7XG5pbXBvcnQgeyBzZXJpYWxpemVTdGF0ZU92ZXJyaWRlLCB9IGZyb20gJy4uLy4uL3V0aWxzL3N0YXRlT3ZlcnJpZGUuanMnO1xuaW1wb3J0IHsgYXNzZXJ0UmVxdWVzdCB9IGZyb20gJy4uLy4uL3V0aWxzL3RyYW5zYWN0aW9uL2Fzc2VydFJlcXVlc3QuanMnO1xuLyoqXG4gKiBFeGVjdXRlcyBhIG5ldyBtZXNzYWdlIGNhbGwgaW1tZWRpYXRlbHkgd2l0aG91dCBzdWJtaXR0aW5nIGEgdHJhbnNhY3Rpb24gdG8gdGhlIG5ldHdvcmsuXG4gKlxuICogLSBEb2NzOiBodHRwczovL3ZpZW0uc2gvZG9jcy9hY3Rpb25zL3B1YmxpYy9jYWxsXG4gKiAtIEpTT04tUlBDIE1ldGhvZHM6IFtgZXRoX2NhbGxgXShodHRwczovL2V0aGVyZXVtLm9yZy9lbi9kZXZlbG9wZXJzL2RvY3MvYXBpcy9qc29uLXJwYy8jZXRoX2NhbGwpXG4gKlxuICogQHBhcmFtIGNsaWVudCAtIENsaWVudCB0byB1c2VcbiAqIEBwYXJhbSBwYXJhbWV0ZXJzIC0ge0BsaW5rIENhbGxQYXJhbWV0ZXJzfVxuICogQHJldHVybnMgVGhlIGNhbGwgZGF0YS4ge0BsaW5rIENhbGxSZXR1cm5UeXBlfVxuICpcbiAqIEBleGFtcGxlXG4gKiBpbXBvcnQgeyBjcmVhdGVQdWJsaWNDbGllbnQsIGh0dHAgfSBmcm9tICd2aWVtJ1xuICogaW1wb3J0IHsgbWFpbm5ldCB9IGZyb20gJ3ZpZW0vY2hhaW5zJ1xuICogaW1wb3J0IHsgY2FsbCB9IGZyb20gJ3ZpZW0vcHVibGljJ1xuICpcbiAqIGNvbnN0IGNsaWVudCA9IGNyZWF0ZVB1YmxpY0NsaWVudCh7XG4gKiAgIGNoYWluOiBtYWlubmV0LFxuICogICB0cmFuc3BvcnQ6IGh0dHAoKSxcbiAqIH0pXG4gKiBjb25zdCBkYXRhID0gYXdhaXQgY2FsbChjbGllbnQsIHtcbiAqICAgYWNjb3VudDogJzB4ZjM5ZmQ2ZTUxYWFkODhmNmY0Y2U2YWI4ODI3Mjc5Y2ZmZmI5MjI2NicsXG4gKiAgIGRhdGE6ICcweGMwMmFhYTM5YjIyM2ZlOGQwYTBlNWM0ZjI3ZWFkOTA4M2M3NTZjYzInLFxuICogICB0bzogJzB4NzA5OTc5NzBjNTE4MTJkYzNhMDEwYzdkMDFiNTBlMGQxN2RjNzljOCcsXG4gKiB9KVxuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gY2FsbChjbGllbnQsIGFyZ3MpIHtcbiAgICBjb25zdCB7IGFjY291bnQ6IGFjY291bnRfID0gY2xpZW50LmFjY291bnQsIGF1dGhvcml6YXRpb25MaXN0LCBiYXRjaCA9IEJvb2xlYW4oY2xpZW50LmJhdGNoPy5tdWx0aWNhbGwpLCBibG9ja051bWJlciwgYmxvY2tUYWcgPSBjbGllbnQuZXhwZXJpbWVudGFsX2Jsb2NrVGFnID8/ICdsYXRlc3QnLCBhY2Nlc3NMaXN0LCBibG9icywgYmxvY2tPdmVycmlkZXMsIGNvZGUsIGRhdGE6IGRhdGFfLCBmYWN0b3J5LCBmYWN0b3J5RGF0YSwgZ2FzLCBnYXNQcmljZSwgbWF4RmVlUGVyQmxvYkdhcywgbWF4RmVlUGVyR2FzLCBtYXhQcmlvcml0eUZlZVBlckdhcywgbm9uY2UsIHRvLCB2YWx1ZSwgc3RhdGVPdmVycmlkZSwgLi4ucmVzdCB9ID0gYXJncztcbiAgICBjb25zdCBhY2NvdW50ID0gYWNjb3VudF8gPyBwYXJzZUFjY291bnQoYWNjb3VudF8pIDogdW5kZWZpbmVkO1xuICAgIGlmIChjb2RlICYmIChmYWN0b3J5IHx8IGZhY3RvcnlEYXRhKSlcbiAgICAgICAgdGhyb3cgbmV3IEJhc2VFcnJvcignQ2Fubm90IHByb3ZpZGUgYm90aCBgY29kZWAgJiBgZmFjdG9yeWAvYGZhY3RvcnlEYXRhYCBhcyBwYXJhbWV0ZXJzLicpO1xuICAgIGlmIChjb2RlICYmIHRvKVxuICAgICAgICB0aHJvdyBuZXcgQmFzZUVycm9yKCdDYW5ub3QgcHJvdmlkZSBib3RoIGBjb2RlYCAmIGB0b2AgYXMgcGFyYW1ldGVycy4nKTtcbiAgICAvLyBDaGVjayBpZiB0aGUgY2FsbCBpcyBkZXBsb3lsZXNzIHZpYSBieXRlY29kZS5cbiAgICBjb25zdCBkZXBsb3lsZXNzQ2FsbFZpYUJ5dGVjb2RlID0gY29kZSAmJiBkYXRhXztcbiAgICAvLyBDaGVjayBpZiB0aGUgY2FsbCBpcyBkZXBsb3lsZXNzIHZpYSBhIGZhY3RvcnkuXG4gICAgY29uc3QgZGVwbG95bGVzc0NhbGxWaWFGYWN0b3J5ID0gZmFjdG9yeSAmJiBmYWN0b3J5RGF0YSAmJiB0byAmJiBkYXRhXztcbiAgICBjb25zdCBkZXBsb3lsZXNzQ2FsbCA9IGRlcGxveWxlc3NDYWxsVmlhQnl0ZWNvZGUgfHwgZGVwbG95bGVzc0NhbGxWaWFGYWN0b3J5O1xuICAgIGNvbnN0IGRhdGEgPSAoKCkgPT4ge1xuICAgICAgICBpZiAoZGVwbG95bGVzc0NhbGxWaWFCeXRlY29kZSlcbiAgICAgICAgICAgIHJldHVybiB0b0RlcGxveWxlc3NDYWxsVmlhQnl0ZWNvZGVEYXRhKHtcbiAgICAgICAgICAgICAgICBjb2RlLFxuICAgICAgICAgICAgICAgIGRhdGE6IGRhdGFfLFxuICAgICAgICAgICAgfSk7XG4gICAgICAgIGlmIChkZXBsb3lsZXNzQ2FsbFZpYUZhY3RvcnkpXG4gICAgICAgICAgICByZXR1cm4gdG9EZXBsb3lsZXNzQ2FsbFZpYUZhY3RvcnlEYXRhKHtcbiAgICAgICAgICAgICAgICBkYXRhOiBkYXRhXyxcbiAgICAgICAgICAgICAgICBmYWN0b3J5LFxuICAgICAgICAgICAgICAgIGZhY3RvcnlEYXRhLFxuICAgICAgICAgICAgICAgIHRvLFxuICAgICAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiBkYXRhXztcbiAgICB9KSgpO1xuICAgIHRyeSB7XG4gICAgICAgIGFzc2VydFJlcXVlc3QoYXJncyk7XG4gICAgICAgIGNvbnN0IGJsb2NrTnVtYmVySGV4ID0gdHlwZW9mIGJsb2NrTnVtYmVyID09PSAnYmlnaW50JyA/IG51bWJlclRvSGV4KGJsb2NrTnVtYmVyKSA6IHVuZGVmaW5lZDtcbiAgICAgICAgY29uc3QgYmxvY2sgPSBibG9ja051bWJlckhleCB8fCBibG9ja1RhZztcbiAgICAgICAgY29uc3QgcnBjQmxvY2tPdmVycmlkZXMgPSBibG9ja092ZXJyaWRlc1xuICAgICAgICAgICAgPyBCbG9ja092ZXJyaWRlcy50b1JwYyhibG9ja092ZXJyaWRlcylcbiAgICAgICAgICAgIDogdW5kZWZpbmVkO1xuICAgICAgICBjb25zdCBycGNTdGF0ZU92ZXJyaWRlID0gc2VyaWFsaXplU3RhdGVPdmVycmlkZShzdGF0ZU92ZXJyaWRlKTtcbiAgICAgICAgY29uc3QgY2hhaW5Gb3JtYXQgPSBjbGllbnQuY2hhaW4/LmZvcm1hdHRlcnM/LnRyYW5zYWN0aW9uUmVxdWVzdD8uZm9ybWF0O1xuICAgICAgICBjb25zdCBmb3JtYXQgPSBjaGFpbkZvcm1hdCB8fCBmb3JtYXRUcmFuc2FjdGlvblJlcXVlc3Q7XG4gICAgICAgIGNvbnN0IHJlcXVlc3QgPSBmb3JtYXQoe1xuICAgICAgICAgICAgLy8gUGljayBvdXQgZXh0cmEgZGF0YSB0aGF0IG1pZ2h0IGV4aXN0IG9uIHRoZSBjaGFpbidzIHRyYW5zYWN0aW9uIHJlcXVlc3QgdHlwZS5cbiAgICAgICAgICAgIC4uLmV4dHJhY3QocmVzdCwgeyBmb3JtYXQ6IGNoYWluRm9ybWF0IH0pLFxuICAgICAgICAgICAgYWNjZXNzTGlzdCxcbiAgICAgICAgICAgIGFjY291bnQsXG4gICAgICAgICAgICBhdXRob3JpemF0aW9uTGlzdCxcbiAgICAgICAgICAgIGJsb2JzLFxuICAgICAgICAgICAgZGF0YSxcbiAgICAgICAgICAgIGdhcyxcbiAgICAgICAgICAgIGdhc1ByaWNlLFxuICAgICAgICAgICAgbWF4RmVlUGVyQmxvYkdhcyxcbiAgICAgICAgICAgIG1heEZlZVBlckdhcyxcbiAgICAgICAgICAgIG1heFByaW9yaXR5RmVlUGVyR2FzLFxuICAgICAgICAgICAgbm9uY2UsXG4gICAgICAgICAgICB0bzogZGVwbG95bGVzc0NhbGwgPyB1bmRlZmluZWQgOiB0byxcbiAgICAgICAgICAgIHZhbHVlLFxuICAgICAgICB9LCAnY2FsbCcpO1xuICAgICAgICBpZiAoYmF0Y2ggJiZcbiAgICAgICAgICAgIHNob3VsZFBlcmZvcm1NdWx0aWNhbGwoeyByZXF1ZXN0IH0pICYmXG4gICAgICAgICAgICAhcnBjU3RhdGVPdmVycmlkZSAmJlxuICAgICAgICAgICAgIXJwY0Jsb2NrT3ZlcnJpZGVzKSB7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIHJldHVybiBhd2FpdCBzY2hlZHVsZU11bHRpY2FsbChjbGllbnQsIHtcbiAgICAgICAgICAgICAgICAgICAgLi4ucmVxdWVzdCxcbiAgICAgICAgICAgICAgICAgICAgYmxvY2tOdW1iZXIsXG4gICAgICAgICAgICAgICAgICAgIGJsb2NrVGFnLFxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgICAgIGlmICghKGVyciBpbnN0YW5jZW9mIENsaWVudENoYWluTm90Q29uZmlndXJlZEVycm9yKSAmJlxuICAgICAgICAgICAgICAgICAgICAhKGVyciBpbnN0YW5jZW9mIENoYWluRG9lc05vdFN1cHBvcnRDb250cmFjdCkpXG4gICAgICAgICAgICAgICAgICAgIHRocm93IGVycjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBjb25zdCBwYXJhbXMgPSAoKCkgPT4ge1xuICAgICAgICAgICAgY29uc3QgYmFzZSA9IFtcbiAgICAgICAgICAgICAgICByZXF1ZXN0LFxuICAgICAgICAgICAgICAgIGJsb2NrLFxuICAgICAgICAgICAgXTtcbiAgICAgICAgICAgIGlmIChycGNTdGF0ZU92ZXJyaWRlICYmIHJwY0Jsb2NrT3ZlcnJpZGVzKVxuICAgICAgICAgICAgICAgIHJldHVybiBbLi4uYmFzZSwgcnBjU3RhdGVPdmVycmlkZSwgcnBjQmxvY2tPdmVycmlkZXNdO1xuICAgICAgICAgICAgaWYgKHJwY1N0YXRlT3ZlcnJpZGUpXG4gICAgICAgICAgICAgICAgcmV0dXJuIFsuLi5iYXNlLCBycGNTdGF0ZU92ZXJyaWRlXTtcbiAgICAgICAgICAgIGlmIChycGNCbG9ja092ZXJyaWRlcylcbiAgICAgICAgICAgICAgICByZXR1cm4gWy4uLmJhc2UsIHt9LCBycGNCbG9ja092ZXJyaWRlc107XG4gICAgICAgICAgICByZXR1cm4gYmFzZTtcbiAgICAgICAgfSkoKTtcbiAgICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBjbGllbnQucmVxdWVzdCh7XG4gICAgICAgICAgICBtZXRob2Q6ICdldGhfY2FsbCcsXG4gICAgICAgICAgICBwYXJhbXMsXG4gICAgICAgIH0pO1xuICAgICAgICBpZiAocmVzcG9uc2UgPT09ICcweCcpXG4gICAgICAgICAgICByZXR1cm4geyBkYXRhOiB1bmRlZmluZWQgfTtcbiAgICAgICAgcmV0dXJuIHsgZGF0YTogcmVzcG9uc2UgfTtcbiAgICB9XG4gICAgY2F0Y2ggKGVycikge1xuICAgICAgICBjb25zdCBkYXRhID0gZ2V0UmV2ZXJ0RXJyb3JEYXRhKGVycik7XG4gICAgICAgIC8vIENoZWNrIGZvciBDQ0lQLVJlYWQgb2ZmY2hhaW4gbG9va3VwIHNpZ25hdHVyZS5cbiAgICAgICAgY29uc3QgeyBvZmZjaGFpbkxvb2t1cCwgb2ZmY2hhaW5Mb29rdXBTaWduYXR1cmUgfSA9IGF3YWl0IGltcG9ydCgnLi4vLi4vdXRpbHMvY2NpcC5qcycpO1xuICAgICAgICBpZiAoY2xpZW50LmNjaXBSZWFkICE9PSBmYWxzZSAmJlxuICAgICAgICAgICAgZGF0YT8uc2xpY2UoMCwgMTApID09PSBvZmZjaGFpbkxvb2t1cFNpZ25hdHVyZSAmJlxuICAgICAgICAgICAgdG8pXG4gICAgICAgICAgICByZXR1cm4geyBkYXRhOiBhd2FpdCBvZmZjaGFpbkxvb2t1cChjbGllbnQsIHsgZGF0YSwgdG8gfSkgfTtcbiAgICAgICAgLy8gQ2hlY2sgZm9yIGNvdW50ZXJmYWN0dWFsIGRlcGxveW1lbnQgZXJyb3IuXG4gICAgICAgIGlmIChkZXBsb3lsZXNzQ2FsbCAmJiBkYXRhPy5zbGljZSgwLCAxMCkgPT09ICcweDEwMWJiOThkJylcbiAgICAgICAgICAgIHRocm93IG5ldyBDb3VudGVyZmFjdHVhbERlcGxveW1lbnRGYWlsZWRFcnJvcih7IGZhY3RvcnkgfSk7XG4gICAgICAgIHRocm93IGdldENhbGxFcnJvcihlcnIsIHtcbiAgICAgICAgICAgIC4uLmFyZ3MsXG4gICAgICAgICAgICBhY2NvdW50LFxuICAgICAgICAgICAgY2hhaW46IGNsaWVudC5jaGFpbixcbiAgICAgICAgfSk7XG4gICAgfVxufVxuLy8gV2Ugb25seSB3YW50IHRvIHBlcmZvcm0gYSBzY2hlZHVsZWQgbXVsdGljYWxsIGlmOlxuLy8gLSBUaGUgcmVxdWVzdCBoYXMgY2FsbGRhdGEsXG4vLyAtIFRoZSByZXF1ZXN0IGhhcyBhIHRhcmdldCBhZGRyZXNzLFxuLy8gLSBUaGUgdGFyZ2V0IGFkZHJlc3MgaXMgbm90IGFscmVhZHkgdGhlIGFnZ3JlZ2F0ZTMgc2lnbmF0dXJlLFxuLy8gLSBUaGUgcmVxdWVzdCBoYXMgbm8gb3RoZXIgcHJvcGVydGllcyAoYG5vbmNlYCwgYGdhc2AsIGV0YyBjYW5ub3QgYmUgc2VudCB3aXRoIGEgbXVsdGljYWxsKS5cbmZ1bmN0aW9uIHNob3VsZFBlcmZvcm1NdWx0aWNhbGwoeyByZXF1ZXN0IH0pIHtcbiAgICBjb25zdCB7IGRhdGEsIHRvLCAuLi5yZXF1ZXN0XyB9ID0gcmVxdWVzdDtcbiAgICBpZiAoIWRhdGEpXG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICBpZiAoZGF0YS5zdGFydHNXaXRoKGFnZ3JlZ2F0ZTNTaWduYXR1cmUpKVxuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgaWYgKCF0bylcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIGlmIChPYmplY3QudmFsdWVzKHJlcXVlc3RfKS5maWx0ZXIoKHgpID0+IHR5cGVvZiB4ICE9PSAndW5kZWZpbmVkJykubGVuZ3RoID4gMClcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIHJldHVybiB0cnVlO1xufVxuYXN5bmMgZnVuY3Rpb24gc2NoZWR1bGVNdWx0aWNhbGwoY2xpZW50LCBhcmdzKSB7XG4gICAgY29uc3QgeyBiYXRjaFNpemUgPSAxMDI0LCBkZXBsb3lsZXNzID0gZmFsc2UsIHdhaXQgPSAwLCB9ID0gdHlwZW9mIGNsaWVudC5iYXRjaD8ubXVsdGljYWxsID09PSAnb2JqZWN0JyA/IGNsaWVudC5iYXRjaC5tdWx0aWNhbGwgOiB7fTtcbiAgICBjb25zdCB7IGJsb2NrTnVtYmVyLCBibG9ja1RhZyA9IGNsaWVudC5leHBlcmltZW50YWxfYmxvY2tUYWcgPz8gJ2xhdGVzdCcsIGRhdGEsIHRvLCB9ID0gYXJncztcbiAgICBjb25zdCBtdWx0aWNhbGxBZGRyZXNzID0gKCgpID0+IHtcbiAgICAgICAgaWYgKGRlcGxveWxlc3MpXG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgaWYgKGFyZ3MubXVsdGljYWxsQWRkcmVzcylcbiAgICAgICAgICAgIHJldHVybiBhcmdzLm11bHRpY2FsbEFkZHJlc3M7XG4gICAgICAgIGlmIChjbGllbnQuY2hhaW4pIHtcbiAgICAgICAgICAgIHJldHVybiBnZXRDaGFpbkNvbnRyYWN0QWRkcmVzcyh7XG4gICAgICAgICAgICAgICAgYmxvY2tOdW1iZXIsXG4gICAgICAgICAgICAgICAgY2hhaW46IGNsaWVudC5jaGFpbixcbiAgICAgICAgICAgICAgICBjb250cmFjdDogJ211bHRpY2FsbDMnLFxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgdGhyb3cgbmV3IENsaWVudENoYWluTm90Q29uZmlndXJlZEVycm9yKCk7XG4gICAgfSkoKTtcbiAgICBjb25zdCBibG9ja051bWJlckhleCA9IHR5cGVvZiBibG9ja051bWJlciA9PT0gJ2JpZ2ludCcgPyBudW1iZXJUb0hleChibG9ja051bWJlcikgOiB1bmRlZmluZWQ7XG4gICAgY29uc3QgYmxvY2sgPSBibG9ja051bWJlckhleCB8fCBibG9ja1RhZztcbiAgICBjb25zdCB7IHNjaGVkdWxlIH0gPSBjcmVhdGVCYXRjaFNjaGVkdWxlcih7XG4gICAgICAgIGlkOiBgJHtjbGllbnQudWlkfS4ke2Jsb2NrfWAsXG4gICAgICAgIHdhaXQsXG4gICAgICAgIHNob3VsZFNwbGl0QmF0Y2goYXJncykge1xuICAgICAgICAgICAgY29uc3Qgc2l6ZSA9IGFyZ3MucmVkdWNlKChzaXplLCB7IGRhdGEgfSkgPT4gc2l6ZSArIChkYXRhLmxlbmd0aCAtIDIpLCAwKTtcbiAgICAgICAgICAgIHJldHVybiBzaXplID4gYmF0Y2hTaXplICogMjtcbiAgICAgICAgfSxcbiAgICAgICAgZm46IGFzeW5jIChyZXF1ZXN0cykgPT4ge1xuICAgICAgICAgICAgY29uc3QgY2FsbHMgPSByZXF1ZXN0cy5tYXAoKHJlcXVlc3QpID0+ICh7XG4gICAgICAgICAgICAgICAgYWxsb3dGYWlsdXJlOiB0cnVlLFxuICAgICAgICAgICAgICAgIGNhbGxEYXRhOiByZXF1ZXN0LmRhdGEsXG4gICAgICAgICAgICAgICAgdGFyZ2V0OiByZXF1ZXN0LnRvLFxuICAgICAgICAgICAgfSkpO1xuICAgICAgICAgICAgY29uc3QgY2FsbGRhdGEgPSBlbmNvZGVGdW5jdGlvbkRhdGEoe1xuICAgICAgICAgICAgICAgIGFiaTogbXVsdGljYWxsM0FiaSxcbiAgICAgICAgICAgICAgICBhcmdzOiBbY2FsbHNdLFxuICAgICAgICAgICAgICAgIGZ1bmN0aW9uTmFtZTogJ2FnZ3JlZ2F0ZTMnLFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBjb25zdCBkYXRhID0gYXdhaXQgY2xpZW50LnJlcXVlc3Qoe1xuICAgICAgICAgICAgICAgIG1ldGhvZDogJ2V0aF9jYWxsJyxcbiAgICAgICAgICAgICAgICBwYXJhbXM6IFtcbiAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICAgLi4uKG11bHRpY2FsbEFkZHJlc3MgPT09IG51bGxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA/IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZGF0YTogdG9EZXBsb3lsZXNzQ2FsbFZpYUJ5dGVjb2RlRGF0YSh7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb2RlOiBtdWx0aWNhbGwzQnl0ZWNvZGUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkYXRhOiBjYWxsZGF0YSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDogeyB0bzogbXVsdGljYWxsQWRkcmVzcywgZGF0YTogY2FsbGRhdGEgfSksXG4gICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgIGJsb2NrLFxuICAgICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHJldHVybiBkZWNvZGVGdW5jdGlvblJlc3VsdCh7XG4gICAgICAgICAgICAgICAgYWJpOiBtdWx0aWNhbGwzQWJpLFxuICAgICAgICAgICAgICAgIGFyZ3M6IFtjYWxsc10sXG4gICAgICAgICAgICAgICAgZnVuY3Rpb25OYW1lOiAnYWdncmVnYXRlMycsXG4gICAgICAgICAgICAgICAgZGF0YTogZGF0YSB8fCAnMHgnLFxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0sXG4gICAgfSk7XG4gICAgY29uc3QgW3sgcmV0dXJuRGF0YSwgc3VjY2VzcyB9XSA9IGF3YWl0IHNjaGVkdWxlKHsgZGF0YSwgdG8gfSk7XG4gICAgaWYgKCFzdWNjZXNzKVxuICAgICAgICB0aHJvdyBuZXcgUmF3Q29udHJhY3RFcnJvcih7IGRhdGE6IHJldHVybkRhdGEgfSk7XG4gICAgaWYgKHJldHVybkRhdGEgPT09ICcweCcpXG4gICAgICAgIHJldHVybiB7IGRhdGE6IHVuZGVmaW5lZCB9O1xuICAgIHJldHVybiB7IGRhdGE6IHJldHVybkRhdGEgfTtcbn1cbmZ1bmN0aW9uIHRvRGVwbG95bGVzc0NhbGxWaWFCeXRlY29kZURhdGEocGFyYW1ldGVycykge1xuICAgIGNvbnN0IHsgY29kZSwgZGF0YSB9ID0gcGFyYW1ldGVycztcbiAgICByZXR1cm4gZW5jb2RlRGVwbG95RGF0YSh7XG4gICAgICAgIGFiaTogcGFyc2VBYmkoWydjb25zdHJ1Y3RvcihieXRlcywgYnl0ZXMpJ10pLFxuICAgICAgICBieXRlY29kZTogZGVwbG95bGVzc0NhbGxWaWFCeXRlY29kZUJ5dGVjb2RlLFxuICAgICAgICBhcmdzOiBbY29kZSwgZGF0YV0sXG4gICAgfSk7XG59XG5mdW5jdGlvbiB0b0RlcGxveWxlc3NDYWxsVmlhRmFjdG9yeURhdGEocGFyYW1ldGVycykge1xuICAgIGNvbnN0IHsgZGF0YSwgZmFjdG9yeSwgZmFjdG9yeURhdGEsIHRvIH0gPSBwYXJhbWV0ZXJzO1xuICAgIHJldHVybiBlbmNvZGVEZXBsb3lEYXRhKHtcbiAgICAgICAgYWJpOiBwYXJzZUFiaShbJ2NvbnN0cnVjdG9yKGFkZHJlc3MsIGJ5dGVzLCBhZGRyZXNzLCBieXRlcyknXSksXG4gICAgICAgIGJ5dGVjb2RlOiBkZXBsb3lsZXNzQ2FsbFZpYUZhY3RvcnlCeXRlY29kZSxcbiAgICAgICAgYXJnczogW3RvLCBkYXRhLCBmYWN0b3J5LCBmYWN0b3J5RGF0YV0sXG4gICAgfSk7XG59XG4vKiogQGludGVybmFsICovXG5leHBvcnQgZnVuY3Rpb24gZ2V0UmV2ZXJ0RXJyb3JEYXRhKGVycikge1xuICAgIGlmICghKGVyciBpbnN0YW5jZW9mIEJhc2VFcnJvcikpXG4gICAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgY29uc3QgZXJyb3IgPSBlcnIud2FsaygpO1xuICAgIHJldHVybiB0eXBlb2YgZXJyb3I/LmRhdGEgPT09ICdvYmplY3QnID8gZXJyb3IuZGF0YT8uZGF0YSA6IGVycm9yLmRhdGE7XG59XG4vLyMgc291cmNlTWFwcGluZ1VSTD1jYWxsLmpzLm1hcCIsCiAgICAiaW1wb3J0IHsgc3RyaW5naWZ5IH0gZnJvbSAnLi4vdXRpbHMvc3RyaW5naWZ5LmpzJztcbmltcG9ydCB7IEJhc2VFcnJvciB9IGZyb20gJy4vYmFzZS5qcyc7XG5pbXBvcnQgeyBnZXRVcmwgfSBmcm9tICcuL3V0aWxzLmpzJztcbmV4cG9ydCBjbGFzcyBPZmZjaGFpbkxvb2t1cEVycm9yIGV4dGVuZHMgQmFzZUVycm9yIHtcbiAgICBjb25zdHJ1Y3Rvcih7IGNhbGxiYWNrU2VsZWN0b3IsIGNhdXNlLCBkYXRhLCBleHRyYURhdGEsIHNlbmRlciwgdXJscywgfSkge1xuICAgICAgICBzdXBlcihjYXVzZS5zaG9ydE1lc3NhZ2UgfHxcbiAgICAgICAgICAgICdBbiBlcnJvciBvY2N1cnJlZCB3aGlsZSBmZXRjaGluZyBmb3IgYW4gb2ZmY2hhaW4gcmVzdWx0LicsIHtcbiAgICAgICAgICAgIGNhdXNlLFxuICAgICAgICAgICAgbWV0YU1lc3NhZ2VzOiBbXG4gICAgICAgICAgICAgICAgLi4uKGNhdXNlLm1ldGFNZXNzYWdlcyB8fCBbXSksXG4gICAgICAgICAgICAgICAgY2F1c2UubWV0YU1lc3NhZ2VzPy5sZW5ndGggPyAnJyA6IFtdLFxuICAgICAgICAgICAgICAgICdPZmZjaGFpbiBHYXRld2F5IENhbGw6JyxcbiAgICAgICAgICAgICAgICB1cmxzICYmIFtcbiAgICAgICAgICAgICAgICAgICAgJyAgR2F0ZXdheSBVUkwocyk6JyxcbiAgICAgICAgICAgICAgICAgICAgLi4udXJscy5tYXAoKHVybCkgPT4gYCAgICAke2dldFVybCh1cmwpfWApLFxuICAgICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICAgICAgYCAgU2VuZGVyOiAke3NlbmRlcn1gLFxuICAgICAgICAgICAgICAgIGAgIERhdGE6ICR7ZGF0YX1gLFxuICAgICAgICAgICAgICAgIGAgIENhbGxiYWNrIHNlbGVjdG9yOiAke2NhbGxiYWNrU2VsZWN0b3J9YCxcbiAgICAgICAgICAgICAgICBgICBFeHRyYSBkYXRhOiAke2V4dHJhRGF0YX1gLFxuICAgICAgICAgICAgXS5mbGF0KCksXG4gICAgICAgICAgICBuYW1lOiAnT2ZmY2hhaW5Mb29rdXBFcnJvcicsXG4gICAgICAgIH0pO1xuICAgIH1cbn1cbmV4cG9ydCBjbGFzcyBPZmZjaGFpbkxvb2t1cFJlc3BvbnNlTWFsZm9ybWVkRXJyb3IgZXh0ZW5kcyBCYXNlRXJyb3Ige1xuICAgIGNvbnN0cnVjdG9yKHsgcmVzdWx0LCB1cmwgfSkge1xuICAgICAgICBzdXBlcignT2ZmY2hhaW4gZ2F0ZXdheSByZXNwb25zZSBpcyBtYWxmb3JtZWQuIFJlc3BvbnNlIGRhdGEgbXVzdCBiZSBhIGhleCB2YWx1ZS4nLCB7XG4gICAgICAgICAgICBtZXRhTWVzc2FnZXM6IFtcbiAgICAgICAgICAgICAgICBgR2F0ZXdheSBVUkw6ICR7Z2V0VXJsKHVybCl9YCxcbiAgICAgICAgICAgICAgICBgUmVzcG9uc2U6ICR7c3RyaW5naWZ5KHJlc3VsdCl9YCxcbiAgICAgICAgICAgIF0sXG4gICAgICAgICAgICBuYW1lOiAnT2ZmY2hhaW5Mb29rdXBSZXNwb25zZU1hbGZvcm1lZEVycm9yJyxcbiAgICAgICAgfSk7XG4gICAgfVxufVxuZXhwb3J0IGNsYXNzIE9mZmNoYWluTG9va3VwU2VuZGVyTWlzbWF0Y2hFcnJvciBleHRlbmRzIEJhc2VFcnJvciB7XG4gICAgY29uc3RydWN0b3IoeyBzZW5kZXIsIHRvIH0pIHtcbiAgICAgICAgc3VwZXIoJ1JldmVydGVkIHNlbmRlciBhZGRyZXNzIGRvZXMgbm90IG1hdGNoIHRhcmdldCBjb250cmFjdCBhZGRyZXNzIChgdG9gKS4nLCB7XG4gICAgICAgICAgICBtZXRhTWVzc2FnZXM6IFtcbiAgICAgICAgICAgICAgICBgQ29udHJhY3QgYWRkcmVzczogJHt0b31gLFxuICAgICAgICAgICAgICAgIGBPZmZjaGFpbkxvb2t1cCBzZW5kZXIgYWRkcmVzczogJHtzZW5kZXJ9YCxcbiAgICAgICAgICAgIF0sXG4gICAgICAgICAgICBuYW1lOiAnT2ZmY2hhaW5Mb29rdXBTZW5kZXJNaXNtYXRjaEVycm9yJyxcbiAgICAgICAgfSk7XG4gICAgfVxufVxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9Y2NpcC5qcy5tYXAiLAogICAgImltcG9ydCB7IEludmFsaWRBZGRyZXNzRXJyb3IsIH0gZnJvbSAnLi4vLi4vZXJyb3JzL2FkZHJlc3MuanMnO1xuaW1wb3J0IHsgaXNBZGRyZXNzIH0gZnJvbSAnLi9pc0FkZHJlc3MuanMnO1xuZXhwb3J0IGZ1bmN0aW9uIGlzQWRkcmVzc0VxdWFsKGEsIGIpIHtcbiAgICBpZiAoIWlzQWRkcmVzcyhhLCB7IHN0cmljdDogZmFsc2UgfSkpXG4gICAgICAgIHRocm93IG5ldyBJbnZhbGlkQWRkcmVzc0Vycm9yKHsgYWRkcmVzczogYSB9KTtcbiAgICBpZiAoIWlzQWRkcmVzcyhiLCB7IHN0cmljdDogZmFsc2UgfSkpXG4gICAgICAgIHRocm93IG5ldyBJbnZhbGlkQWRkcmVzc0Vycm9yKHsgYWRkcmVzczogYiB9KTtcbiAgICByZXR1cm4gYS50b0xvd2VyQ2FzZSgpID09PSBiLnRvTG93ZXJDYXNlKCk7XG59XG4vLyMgc291cmNlTWFwcGluZ1VSTD1pc0FkZHJlc3NFcXVhbC5qcy5tYXAiLAogICAgImltcG9ydCB7IEFiaUZ1bmN0aW9uU2lnbmF0dXJlTm90Rm91bmRFcnJvciB9IGZyb20gJy4uLy4uL2Vycm9ycy9hYmkuanMnO1xuaW1wb3J0IHsgc2xpY2UgfSBmcm9tICcuLi9kYXRhL3NsaWNlLmpzJztcbmltcG9ydCB7IHRvRnVuY3Rpb25TZWxlY3RvciwgfSBmcm9tICcuLi9oYXNoL3RvRnVuY3Rpb25TZWxlY3Rvci5qcyc7XG5pbXBvcnQgeyBkZWNvZGVBYmlQYXJhbWV0ZXJzLCB9IGZyb20gJy4vZGVjb2RlQWJpUGFyYW1ldGVycy5qcyc7XG5pbXBvcnQgeyBmb3JtYXRBYmlJdGVtIH0gZnJvbSAnLi9mb3JtYXRBYmlJdGVtLmpzJztcbmV4cG9ydCBmdW5jdGlvbiBkZWNvZGVGdW5jdGlvbkRhdGEocGFyYW1ldGVycykge1xuICAgIGNvbnN0IHsgYWJpLCBkYXRhIH0gPSBwYXJhbWV0ZXJzO1xuICAgIGNvbnN0IHNpZ25hdHVyZSA9IHNsaWNlKGRhdGEsIDAsIDQpO1xuICAgIGNvbnN0IGRlc2NyaXB0aW9uID0gYWJpLmZpbmQoKHgpID0+IHgudHlwZSA9PT0gJ2Z1bmN0aW9uJyAmJlxuICAgICAgICBzaWduYXR1cmUgPT09IHRvRnVuY3Rpb25TZWxlY3Rvcihmb3JtYXRBYmlJdGVtKHgpKSk7XG4gICAgaWYgKCFkZXNjcmlwdGlvbilcbiAgICAgICAgdGhyb3cgbmV3IEFiaUZ1bmN0aW9uU2lnbmF0dXJlTm90Rm91bmRFcnJvcihzaWduYXR1cmUsIHtcbiAgICAgICAgICAgIGRvY3NQYXRoOiAnL2RvY3MvY29udHJhY3QvZGVjb2RlRnVuY3Rpb25EYXRhJyxcbiAgICAgICAgfSk7XG4gICAgcmV0dXJuIHtcbiAgICAgICAgZnVuY3Rpb25OYW1lOiBkZXNjcmlwdGlvbi5uYW1lLFxuICAgICAgICBhcmdzOiAoJ2lucHV0cycgaW4gZGVzY3JpcHRpb24gJiZcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uLmlucHV0cyAmJlxuICAgICAgICAgICAgZGVzY3JpcHRpb24uaW5wdXRzLmxlbmd0aCA+IDBcbiAgICAgICAgICAgID8gZGVjb2RlQWJpUGFyYW1ldGVycyhkZXNjcmlwdGlvbi5pbnB1dHMsIHNsaWNlKGRhdGEsIDQpKVxuICAgICAgICAgICAgOiB1bmRlZmluZWQpLFxuICAgIH07XG59XG4vLyMgc291cmNlTWFwcGluZ1VSTD1kZWNvZGVGdW5jdGlvbkRhdGEuanMubWFwIiwKICAgICJpbXBvcnQgeyBBYmlFcnJvcklucHV0c05vdEZvdW5kRXJyb3IsIEFiaUVycm9yTm90Rm91bmRFcnJvciwgfSBmcm9tICcuLi8uLi9lcnJvcnMvYWJpLmpzJztcbmltcG9ydCB7IGNvbmNhdEhleCB9IGZyb20gJy4uL2RhdGEvY29uY2F0LmpzJztcbmltcG9ydCB7IHRvRnVuY3Rpb25TZWxlY3RvciwgfSBmcm9tICcuLi9oYXNoL3RvRnVuY3Rpb25TZWxlY3Rvci5qcyc7XG5pbXBvcnQgeyBlbmNvZGVBYmlQYXJhbWV0ZXJzLCB9IGZyb20gJy4vZW5jb2RlQWJpUGFyYW1ldGVycy5qcyc7XG5pbXBvcnQgeyBmb3JtYXRBYmlJdGVtIH0gZnJvbSAnLi9mb3JtYXRBYmlJdGVtLmpzJztcbmltcG9ydCB7IGdldEFiaUl0ZW0gfSBmcm9tICcuL2dldEFiaUl0ZW0uanMnO1xuY29uc3QgZG9jc1BhdGggPSAnL2RvY3MvY29udHJhY3QvZW5jb2RlRXJyb3JSZXN1bHQnO1xuZXhwb3J0IGZ1bmN0aW9uIGVuY29kZUVycm9yUmVzdWx0KHBhcmFtZXRlcnMpIHtcbiAgICBjb25zdCB7IGFiaSwgZXJyb3JOYW1lLCBhcmdzIH0gPSBwYXJhbWV0ZXJzO1xuICAgIGxldCBhYmlJdGVtID0gYWJpWzBdO1xuICAgIGlmIChlcnJvck5hbWUpIHtcbiAgICAgICAgY29uc3QgaXRlbSA9IGdldEFiaUl0ZW0oeyBhYmksIGFyZ3MsIG5hbWU6IGVycm9yTmFtZSB9KTtcbiAgICAgICAgaWYgKCFpdGVtKVxuICAgICAgICAgICAgdGhyb3cgbmV3IEFiaUVycm9yTm90Rm91bmRFcnJvcihlcnJvck5hbWUsIHsgZG9jc1BhdGggfSk7XG4gICAgICAgIGFiaUl0ZW0gPSBpdGVtO1xuICAgIH1cbiAgICBpZiAoYWJpSXRlbS50eXBlICE9PSAnZXJyb3InKVxuICAgICAgICB0aHJvdyBuZXcgQWJpRXJyb3JOb3RGb3VuZEVycm9yKHVuZGVmaW5lZCwgeyBkb2NzUGF0aCB9KTtcbiAgICBjb25zdCBkZWZpbml0aW9uID0gZm9ybWF0QWJpSXRlbShhYmlJdGVtKTtcbiAgICBjb25zdCBzaWduYXR1cmUgPSB0b0Z1bmN0aW9uU2VsZWN0b3IoZGVmaW5pdGlvbik7XG4gICAgbGV0IGRhdGEgPSAnMHgnO1xuICAgIGlmIChhcmdzICYmIGFyZ3MubGVuZ3RoID4gMCkge1xuICAgICAgICBpZiAoIWFiaUl0ZW0uaW5wdXRzKVxuICAgICAgICAgICAgdGhyb3cgbmV3IEFiaUVycm9ySW5wdXRzTm90Rm91bmRFcnJvcihhYmlJdGVtLm5hbWUsIHsgZG9jc1BhdGggfSk7XG4gICAgICAgIGRhdGEgPSBlbmNvZGVBYmlQYXJhbWV0ZXJzKGFiaUl0ZW0uaW5wdXRzLCBhcmdzKTtcbiAgICB9XG4gICAgcmV0dXJuIGNvbmNhdEhleChbc2lnbmF0dXJlLCBkYXRhXSk7XG59XG4vLyMgc291cmNlTWFwcGluZ1VSTD1lbmNvZGVFcnJvclJlc3VsdC5qcy5tYXAiLAogICAgImltcG9ydCB7IEFiaUZ1bmN0aW9uTm90Rm91bmRFcnJvciwgQWJpRnVuY3Rpb25PdXRwdXRzTm90Rm91bmRFcnJvciwgSW52YWxpZEFycmF5RXJyb3IsIH0gZnJvbSAnLi4vLi4vZXJyb3JzL2FiaS5qcyc7XG5pbXBvcnQgeyBlbmNvZGVBYmlQYXJhbWV0ZXJzLCB9IGZyb20gJy4vZW5jb2RlQWJpUGFyYW1ldGVycy5qcyc7XG5pbXBvcnQgeyBnZXRBYmlJdGVtIH0gZnJvbSAnLi9nZXRBYmlJdGVtLmpzJztcbmNvbnN0IGRvY3NQYXRoID0gJy9kb2NzL2NvbnRyYWN0L2VuY29kZUZ1bmN0aW9uUmVzdWx0JztcbmV4cG9ydCBmdW5jdGlvbiBlbmNvZGVGdW5jdGlvblJlc3VsdChwYXJhbWV0ZXJzKSB7XG4gICAgY29uc3QgeyBhYmksIGZ1bmN0aW9uTmFtZSwgcmVzdWx0IH0gPSBwYXJhbWV0ZXJzO1xuICAgIGxldCBhYmlJdGVtID0gYWJpWzBdO1xuICAgIGlmIChmdW5jdGlvbk5hbWUpIHtcbiAgICAgICAgY29uc3QgaXRlbSA9IGdldEFiaUl0ZW0oeyBhYmksIG5hbWU6IGZ1bmN0aW9uTmFtZSB9KTtcbiAgICAgICAgaWYgKCFpdGVtKVxuICAgICAgICAgICAgdGhyb3cgbmV3IEFiaUZ1bmN0aW9uTm90Rm91bmRFcnJvcihmdW5jdGlvbk5hbWUsIHsgZG9jc1BhdGggfSk7XG4gICAgICAgIGFiaUl0ZW0gPSBpdGVtO1xuICAgIH1cbiAgICBpZiAoYWJpSXRlbS50eXBlICE9PSAnZnVuY3Rpb24nKVxuICAgICAgICB0aHJvdyBuZXcgQWJpRnVuY3Rpb25Ob3RGb3VuZEVycm9yKHVuZGVmaW5lZCwgeyBkb2NzUGF0aCB9KTtcbiAgICBpZiAoIWFiaUl0ZW0ub3V0cHV0cylcbiAgICAgICAgdGhyb3cgbmV3IEFiaUZ1bmN0aW9uT3V0cHV0c05vdEZvdW5kRXJyb3IoYWJpSXRlbS5uYW1lLCB7IGRvY3NQYXRoIH0pO1xuICAgIGNvbnN0IHZhbHVlcyA9ICgoKSA9PiB7XG4gICAgICAgIGlmIChhYmlJdGVtLm91dHB1dHMubGVuZ3RoID09PSAwKVxuICAgICAgICAgICAgcmV0dXJuIFtdO1xuICAgICAgICBpZiAoYWJpSXRlbS5vdXRwdXRzLmxlbmd0aCA9PT0gMSlcbiAgICAgICAgICAgIHJldHVybiBbcmVzdWx0XTtcbiAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkocmVzdWx0KSlcbiAgICAgICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICAgIHRocm93IG5ldyBJbnZhbGlkQXJyYXlFcnJvcihyZXN1bHQpO1xuICAgIH0pKCk7XG4gICAgcmV0dXJuIGVuY29kZUFiaVBhcmFtZXRlcnMoYWJpSXRlbS5vdXRwdXRzLCB2YWx1ZXMpO1xufVxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9ZW5jb2RlRnVuY3Rpb25SZXN1bHQuanMubWFwIiwKICAgICJpbXBvcnQgeyBiYXRjaEdhdGV3YXlBYmkgfSBmcm9tICcuLi8uLi9jb25zdGFudHMvYWJpcy5qcyc7XG5pbXBvcnQgeyBzb2xpZGl0eUVycm9yIH0gZnJvbSAnLi4vLi4vY29uc3RhbnRzL3NvbGlkaXR5LmpzJztcbmltcG9ydCB7IGRlY29kZUZ1bmN0aW9uRGF0YSB9IGZyb20gJy4uL2FiaS9kZWNvZGVGdW5jdGlvbkRhdGEuanMnO1xuaW1wb3J0IHsgZW5jb2RlRXJyb3JSZXN1bHQgfSBmcm9tICcuLi9hYmkvZW5jb2RlRXJyb3JSZXN1bHQuanMnO1xuaW1wb3J0IHsgZW5jb2RlRnVuY3Rpb25SZXN1bHQgfSBmcm9tICcuLi9hYmkvZW5jb2RlRnVuY3Rpb25SZXN1bHQuanMnO1xuZXhwb3J0IGNvbnN0IGxvY2FsQmF0Y2hHYXRld2F5VXJsID0gJ3gtYmF0Y2gtZ2F0ZXdheTp0cnVlJztcbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBsb2NhbEJhdGNoR2F0ZXdheVJlcXVlc3QocGFyYW1ldGVycykge1xuICAgIGNvbnN0IHsgZGF0YSwgY2NpcFJlcXVlc3QgfSA9IHBhcmFtZXRlcnM7XG4gICAgY29uc3QgeyBhcmdzOiBbcXVlcmllc10sIH0gPSBkZWNvZGVGdW5jdGlvbkRhdGEoeyBhYmk6IGJhdGNoR2F0ZXdheUFiaSwgZGF0YSB9KTtcbiAgICBjb25zdCBmYWlsdXJlcyA9IFtdO1xuICAgIGNvbnN0IHJlc3BvbnNlcyA9IFtdO1xuICAgIGF3YWl0IFByb21pc2UuYWxsKHF1ZXJpZXMubWFwKGFzeW5jIChxdWVyeSwgaSkgPT4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgcmVzcG9uc2VzW2ldID0gcXVlcnkudXJscy5pbmNsdWRlcyhsb2NhbEJhdGNoR2F0ZXdheVVybClcbiAgICAgICAgICAgICAgICA/IGF3YWl0IGxvY2FsQmF0Y2hHYXRld2F5UmVxdWVzdCh7IGRhdGE6IHF1ZXJ5LmRhdGEsIGNjaXBSZXF1ZXN0IH0pXG4gICAgICAgICAgICAgICAgOiBhd2FpdCBjY2lwUmVxdWVzdChxdWVyeSk7XG4gICAgICAgICAgICBmYWlsdXJlc1tpXSA9IGZhbHNlO1xuICAgICAgICB9XG4gICAgICAgIGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgIGZhaWx1cmVzW2ldID0gdHJ1ZTtcbiAgICAgICAgICAgIHJlc3BvbnNlc1tpXSA9IGVuY29kZUVycm9yKGVycik7XG4gICAgICAgIH1cbiAgICB9KSk7XG4gICAgcmV0dXJuIGVuY29kZUZ1bmN0aW9uUmVzdWx0KHtcbiAgICAgICAgYWJpOiBiYXRjaEdhdGV3YXlBYmksXG4gICAgICAgIGZ1bmN0aW9uTmFtZTogJ3F1ZXJ5JyxcbiAgICAgICAgcmVzdWx0OiBbZmFpbHVyZXMsIHJlc3BvbnNlc10sXG4gICAgfSk7XG59XG5mdW5jdGlvbiBlbmNvZGVFcnJvcihlcnJvcikge1xuICAgIGlmIChlcnJvci5uYW1lID09PSAnSHR0cFJlcXVlc3RFcnJvcicgJiYgZXJyb3Iuc3RhdHVzKVxuICAgICAgICByZXR1cm4gZW5jb2RlRXJyb3JSZXN1bHQoe1xuICAgICAgICAgICAgYWJpOiBiYXRjaEdhdGV3YXlBYmksXG4gICAgICAgICAgICBlcnJvck5hbWU6ICdIdHRwRXJyb3InLFxuICAgICAgICAgICAgYXJnczogW2Vycm9yLnN0YXR1cywgZXJyb3Iuc2hvcnRNZXNzYWdlXSxcbiAgICAgICAgfSk7XG4gICAgcmV0dXJuIGVuY29kZUVycm9yUmVzdWx0KHtcbiAgICAgICAgYWJpOiBbc29saWRpdHlFcnJvcl0sXG4gICAgICAgIGVycm9yTmFtZTogJ0Vycm9yJyxcbiAgICAgICAgYXJnczogWydzaG9ydE1lc3NhZ2UnIGluIGVycm9yID8gZXJyb3Iuc2hvcnRNZXNzYWdlIDogZXJyb3IubWVzc2FnZV0sXG4gICAgfSk7XG59XG4vLyMgc291cmNlTWFwcGluZ1VSTD1sb2NhbEJhdGNoR2F0ZXdheVJlcXVlc3QuanMubWFwIiwKICAgICJpbXBvcnQgeyBjYWxsIH0gZnJvbSAnLi4vYWN0aW9ucy9wdWJsaWMvY2FsbC5qcyc7XG5pbXBvcnQgeyBPZmZjaGFpbkxvb2t1cEVycm9yLCBPZmZjaGFpbkxvb2t1cFJlc3BvbnNlTWFsZm9ybWVkRXJyb3IsIE9mZmNoYWluTG9va3VwU2VuZGVyTWlzbWF0Y2hFcnJvciwgfSBmcm9tICcuLi9lcnJvcnMvY2NpcC5qcyc7XG5pbXBvcnQgeyBIdHRwUmVxdWVzdEVycm9yLCB9IGZyb20gJy4uL2Vycm9ycy9yZXF1ZXN0LmpzJztcbmltcG9ydCB7IGRlY29kZUVycm9yUmVzdWx0IH0gZnJvbSAnLi9hYmkvZGVjb2RlRXJyb3JSZXN1bHQuanMnO1xuaW1wb3J0IHsgZW5jb2RlQWJpUGFyYW1ldGVycyB9IGZyb20gJy4vYWJpL2VuY29kZUFiaVBhcmFtZXRlcnMuanMnO1xuaW1wb3J0IHsgaXNBZGRyZXNzRXF1YWwgfSBmcm9tICcuL2FkZHJlc3MvaXNBZGRyZXNzRXF1YWwuanMnO1xuaW1wb3J0IHsgY29uY2F0IH0gZnJvbSAnLi9kYXRhL2NvbmNhdC5qcyc7XG5pbXBvcnQgeyBpc0hleCB9IGZyb20gJy4vZGF0YS9pc0hleC5qcyc7XG5pbXBvcnQgeyBsb2NhbEJhdGNoR2F0ZXdheVJlcXVlc3QsIGxvY2FsQmF0Y2hHYXRld2F5VXJsLCB9IGZyb20gJy4vZW5zL2xvY2FsQmF0Y2hHYXRld2F5UmVxdWVzdC5qcyc7XG5pbXBvcnQgeyBzdHJpbmdpZnkgfSBmcm9tICcuL3N0cmluZ2lmeS5qcyc7XG5leHBvcnQgY29uc3Qgb2ZmY2hhaW5Mb29rdXBTaWduYXR1cmUgPSAnMHg1NTZmMTgzMCc7XG5leHBvcnQgY29uc3Qgb2ZmY2hhaW5Mb29rdXBBYmlJdGVtID0ge1xuICAgIG5hbWU6ICdPZmZjaGFpbkxvb2t1cCcsXG4gICAgdHlwZTogJ2Vycm9yJyxcbiAgICBpbnB1dHM6IFtcbiAgICAgICAge1xuICAgICAgICAgICAgbmFtZTogJ3NlbmRlcicsXG4gICAgICAgICAgICB0eXBlOiAnYWRkcmVzcycsXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICAgIG5hbWU6ICd1cmxzJyxcbiAgICAgICAgICAgIHR5cGU6ICdzdHJpbmdbXScsXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICAgIG5hbWU6ICdjYWxsRGF0YScsXG4gICAgICAgICAgICB0eXBlOiAnYnl0ZXMnLFxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgICBuYW1lOiAnY2FsbGJhY2tGdW5jdGlvbicsXG4gICAgICAgICAgICB0eXBlOiAnYnl0ZXM0JyxcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgICAgbmFtZTogJ2V4dHJhRGF0YScsXG4gICAgICAgICAgICB0eXBlOiAnYnl0ZXMnLFxuICAgICAgICB9LFxuICAgIF0sXG59O1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIG9mZmNoYWluTG9va3VwKGNsaWVudCwgeyBibG9ja051bWJlciwgYmxvY2tUYWcsIGRhdGEsIHRvLCB9KSB7XG4gICAgY29uc3QgeyBhcmdzIH0gPSBkZWNvZGVFcnJvclJlc3VsdCh7XG4gICAgICAgIGRhdGEsXG4gICAgICAgIGFiaTogW29mZmNoYWluTG9va3VwQWJpSXRlbV0sXG4gICAgfSk7XG4gICAgY29uc3QgW3NlbmRlciwgdXJscywgY2FsbERhdGEsIGNhbGxiYWNrU2VsZWN0b3IsIGV4dHJhRGF0YV0gPSBhcmdzO1xuICAgIGNvbnN0IHsgY2NpcFJlYWQgfSA9IGNsaWVudDtcbiAgICBjb25zdCBjY2lwUmVxdWVzdF8gPSBjY2lwUmVhZCAmJiB0eXBlb2YgY2NpcFJlYWQ/LnJlcXVlc3QgPT09ICdmdW5jdGlvbidcbiAgICAgICAgPyBjY2lwUmVhZC5yZXF1ZXN0XG4gICAgICAgIDogY2NpcFJlcXVlc3Q7XG4gICAgdHJ5IHtcbiAgICAgICAgaWYgKCFpc0FkZHJlc3NFcXVhbCh0bywgc2VuZGVyKSlcbiAgICAgICAgICAgIHRocm93IG5ldyBPZmZjaGFpbkxvb2t1cFNlbmRlck1pc21hdGNoRXJyb3IoeyBzZW5kZXIsIHRvIH0pO1xuICAgICAgICBjb25zdCByZXN1bHQgPSB1cmxzLmluY2x1ZGVzKGxvY2FsQmF0Y2hHYXRld2F5VXJsKVxuICAgICAgICAgICAgPyBhd2FpdCBsb2NhbEJhdGNoR2F0ZXdheVJlcXVlc3Qoe1xuICAgICAgICAgICAgICAgIGRhdGE6IGNhbGxEYXRhLFxuICAgICAgICAgICAgICAgIGNjaXBSZXF1ZXN0OiBjY2lwUmVxdWVzdF8sXG4gICAgICAgICAgICB9KVxuICAgICAgICAgICAgOiBhd2FpdCBjY2lwUmVxdWVzdF8oeyBkYXRhOiBjYWxsRGF0YSwgc2VuZGVyLCB1cmxzIH0pO1xuICAgICAgICBjb25zdCB7IGRhdGE6IGRhdGFfIH0gPSBhd2FpdCBjYWxsKGNsaWVudCwge1xuICAgICAgICAgICAgYmxvY2tOdW1iZXIsXG4gICAgICAgICAgICBibG9ja1RhZyxcbiAgICAgICAgICAgIGRhdGE6IGNvbmNhdChbXG4gICAgICAgICAgICAgICAgY2FsbGJhY2tTZWxlY3RvcixcbiAgICAgICAgICAgICAgICBlbmNvZGVBYmlQYXJhbWV0ZXJzKFt7IHR5cGU6ICdieXRlcycgfSwgeyB0eXBlOiAnYnl0ZXMnIH1dLCBbcmVzdWx0LCBleHRyYURhdGFdKSxcbiAgICAgICAgICAgIF0pLFxuICAgICAgICAgICAgdG8sXG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gZGF0YV87XG4gICAgfVxuICAgIGNhdGNoIChlcnIpIHtcbiAgICAgICAgdGhyb3cgbmV3IE9mZmNoYWluTG9va3VwRXJyb3Ioe1xuICAgICAgICAgICAgY2FsbGJhY2tTZWxlY3RvcixcbiAgICAgICAgICAgIGNhdXNlOiBlcnIsXG4gICAgICAgICAgICBkYXRhLFxuICAgICAgICAgICAgZXh0cmFEYXRhLFxuICAgICAgICAgICAgc2VuZGVyLFxuICAgICAgICAgICAgdXJscyxcbiAgICAgICAgfSk7XG4gICAgfVxufVxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGNjaXBSZXF1ZXN0KHsgZGF0YSwgc2VuZGVyLCB1cmxzLCB9KSB7XG4gICAgbGV0IGVycm9yID0gbmV3IEVycm9yKCdBbiB1bmtub3duIGVycm9yIG9jY3VycmVkLicpO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdXJscy5sZW5ndGg7IGkrKykge1xuICAgICAgICBjb25zdCB1cmwgPSB1cmxzW2ldO1xuICAgICAgICBjb25zdCBtZXRob2QgPSB1cmwuaW5jbHVkZXMoJ3tkYXRhfScpID8gJ0dFVCcgOiAnUE9TVCc7XG4gICAgICAgIGNvbnN0IGJvZHkgPSBtZXRob2QgPT09ICdQT1NUJyA/IHsgZGF0YSwgc2VuZGVyIH0gOiB1bmRlZmluZWQ7XG4gICAgICAgIGNvbnN0IGhlYWRlcnMgPSBtZXRob2QgPT09ICdQT1NUJyA/IHsgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyB9IDoge307XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGZldGNoKHVybC5yZXBsYWNlKCd7c2VuZGVyfScsIHNlbmRlci50b0xvd2VyQ2FzZSgpKS5yZXBsYWNlKCd7ZGF0YX0nLCBkYXRhKSwge1xuICAgICAgICAgICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KGJvZHkpLFxuICAgICAgICAgICAgICAgIGhlYWRlcnMsXG4gICAgICAgICAgICAgICAgbWV0aG9kLFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBsZXQgcmVzdWx0O1xuICAgICAgICAgICAgaWYgKHJlc3BvbnNlLmhlYWRlcnMuZ2V0KCdDb250ZW50LVR5cGUnKT8uc3RhcnRzV2l0aCgnYXBwbGljYXRpb24vanNvbicpKSB7XG4gICAgICAgICAgICAgICAgcmVzdWx0ID0gKGF3YWl0IHJlc3BvbnNlLmpzb24oKSkuZGF0YTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIHJlc3VsdCA9IChhd2FpdCByZXNwb25zZS50ZXh0KCkpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKCFyZXNwb25zZS5vaykge1xuICAgICAgICAgICAgICAgIGVycm9yID0gbmV3IEh0dHBSZXF1ZXN0RXJyb3Ioe1xuICAgICAgICAgICAgICAgICAgICBib2R5LFxuICAgICAgICAgICAgICAgICAgICBkZXRhaWxzOiByZXN1bHQ/LmVycm9yXG4gICAgICAgICAgICAgICAgICAgICAgICA/IHN0cmluZ2lmeShyZXN1bHQuZXJyb3IpXG4gICAgICAgICAgICAgICAgICAgICAgICA6IHJlc3BvbnNlLnN0YXR1c1RleHQsXG4gICAgICAgICAgICAgICAgICAgIGhlYWRlcnM6IHJlc3BvbnNlLmhlYWRlcnMsXG4gICAgICAgICAgICAgICAgICAgIHN0YXR1czogcmVzcG9uc2Uuc3RhdHVzLFxuICAgICAgICAgICAgICAgICAgICB1cmwsXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoIWlzSGV4KHJlc3VsdCkpIHtcbiAgICAgICAgICAgICAgICBlcnJvciA9IG5ldyBPZmZjaGFpbkxvb2t1cFJlc3BvbnNlTWFsZm9ybWVkRXJyb3Ioe1xuICAgICAgICAgICAgICAgICAgICByZXN1bHQsXG4gICAgICAgICAgICAgICAgICAgIHVybCxcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICAgIH1cbiAgICAgICAgY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgZXJyb3IgPSBuZXcgSHR0cFJlcXVlc3RFcnJvcih7XG4gICAgICAgICAgICAgICAgYm9keSxcbiAgICAgICAgICAgICAgICBkZXRhaWxzOiBlcnIubWVzc2FnZSxcbiAgICAgICAgICAgICAgICB1cmwsXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgIH1cbiAgICB0aHJvdyBlcnJvcjtcbn1cbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWNjaXAuanMubWFwIgogIF0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBTyxJQUFNLFVBQVU7OztBQ0NoQixNQUFNLGtCQUFrQixNQUFNO0FBQUEsRUFDakMsV0FBVyxDQUFDLGNBQWMsT0FBTyxDQUFDLEdBQUc7QUFBQSxJQUNqQyxNQUFNLFVBQVUsS0FBSyxpQkFBaUIsWUFDaEMsS0FBSyxNQUFNLFVBQ1gsS0FBSyxPQUFPLFVBQ1IsS0FBSyxNQUFNLFVBQ1gsS0FBSztBQUFBLElBQ2YsTUFBTSxXQUFXLEtBQUssaUJBQWlCLFlBQ2pDLEtBQUssTUFBTSxZQUFZLEtBQUssV0FDNUIsS0FBSztBQUFBLElBQ1gsTUFBTSxVQUFVO0FBQUEsTUFDWixnQkFBZ0I7QUFBQSxNQUNoQjtBQUFBLE1BQ0EsR0FBSSxLQUFLLGVBQWUsQ0FBQyxHQUFHLEtBQUssY0FBYyxFQUFFLElBQUksQ0FBQztBQUFBLE1BQ3RELEdBQUksV0FBVyxDQUFDLDRCQUE0QixVQUFVLElBQUksQ0FBQztBQUFBLE1BQzNELEdBQUksVUFBVSxDQUFDLFlBQVksU0FBUyxJQUFJLENBQUM7QUFBQSxNQUN6QyxvQkFBb0I7QUFBQSxJQUN4QixFQUFFLEtBQUs7QUFBQSxDQUFJO0FBQUEsSUFDWCxNQUFNLE9BQU87QUFBQSxJQUNiLE9BQU8sZUFBZSxNQUFNLFdBQVc7QUFBQSxNQUNuQyxZQUFZO0FBQUEsTUFDWixjQUFjO0FBQUEsTUFDZCxVQUFVO0FBQUEsTUFDVixPQUFZO0FBQUEsSUFDaEIsQ0FBQztBQUFBLElBQ0QsT0FBTyxlQUFlLE1BQU0sWUFBWTtBQUFBLE1BQ3BDLFlBQVk7QUFBQSxNQUNaLGNBQWM7QUFBQSxNQUNkLFVBQVU7QUFBQSxNQUNWLE9BQVk7QUFBQSxJQUNoQixDQUFDO0FBQUEsSUFDRCxPQUFPLGVBQWUsTUFBTSxnQkFBZ0I7QUFBQSxNQUN4QyxZQUFZO0FB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QSxJQUNJLE1BQU07QUFBQSxJQUNOLE1BQU07QUFBQSxJQUNOLGlCQUFpQjtBQUFBLElBQ2pCLFFBQVE7QUFBQSxNQUNKO0FBQUEsUUFDSSxNQUFNO0FBQUEsUUFDTixNQUFNO0FBQUEsUUFDTixZQUFZO0FBQUEsVUFDUjtBQUFBLFlBQ0ksTUFBTTtBQUFBLFlBQ04sTUFBTTtBQUFBLFVBQ1Y7QUFBQSxVQUNBO0FBQUEsWUFDSSxNQUFNO0FBQUEsWUFDTixNQUFNO0FBQUEsVUFDVjtBQUFBLFVBQ0E7QUFBQSxZQUNJLE1BQU07QUFBQSxZQUNOLE1BQU07QUFBQSxVQUNWO0FBQUEsUUFDSjtBQUFBLE1BQ0o7QUFBQSxJQUNKO0FBQUEsSUFDQSxTQUFTO0FBQUEsTUFDTDtBQUFBLFFBQ0ksTUFBTTtBQUFBLFFBQ04sTUFBTTtBQUFBLE1BQ1Y7QUFBQSxNQUNBO0FBQUEsUUFDSSxNQUFNO0FBQUEsUUFDTixNQUFNO0FBQUEsTUFDVjtBQUFBLElBQ0o7QUFBQSxFQUNKO0FBQUEsRUFDQTtBQUFBLElBQ0ksTUFBTTtBQUFBLElBQ04sTUFBTTtBQUFBLElBQ04sUUFBUTtBQUFBLE1BQ0o7QUFBQSxRQUNJLE1BQU07QUFBQSxRQUNOLE1BQU07QUFBQSxNQUNWO0FBQUEsTUFDQTtBQUFBLFFBQ0ksTUFBTTtBQUFBLFFBQ04sTUFBTTtBQUFBLE1BQ1Y7QUFBQSxJQUNKO0FBQUEsRUFDSjtBQUNKO0FBQ0EsSUFBTSwwQkFBMEI7QUFBQSxFQUM1QjtBQUFBLElBQ0ksUUFBUTtBQUFBLE1BQ0o7QUFBQSxRQUNJLE1BQU07QUFBQSxRQUNOLE1BQU07QUFBQSxNQUNWO0FBQUEsSUFDSjtBQUFBLElBQ0EsTUFBTTtBQUFBLElBQ04sTUFBTTtBQUFBLEVBQ1Y7QUFBQSxFQUNBO0FBQUEsSUFDSSxRQUFRO0FBQUEsTUFDSjtBQUFBLFFBQ0ksTUFBTTtBQUFBLFFBQ04sTUFBTTtBQUFBLE1BQ1Y7QUFBQSxJQUNKO0FBQUEsSUFDQSxNQUFNO0FBQUEsSUFDTixNQUFNO0FBQUEsRUFDVjtBQUFBLEVBQ0E7QUFBQSxJQUNJLFFBQVEsQ0FBQztBQUFBLElBQ1QsTUFBTTtBQUFBLElBQ04sTUFBTTtBQUFBLEVBQ1Y7QUFBQSxFQUNBO0FBQUEsSUFDSSxRQUFRO0FBQUEsTUFDSjtBQUFBLFFBQ0ksTUFBTTtBQUFBLFFBQ04sTUFBTTtBQUFBLE1BQ1Y7QUFBQSxNQUNBO0FBQUEsUUFDSSxNQUFNO0FBQUEsUUFDTixNQUFNO0FBQUEsTUFDVjtBQUFBLElBQ0o7QUFBQSxJQUNBLE1BQU07QUFBQSxJQUNOLE1BQU07QUFBQSxFQUNWO0FBQUEsRUFDQTtBQUFBLElBQ0ksUUFBUSxDQUFDO0FBQUEsSUFDVCxNQUFNO0FBQUEsSUFDTixNQUFNO0FBQUEsRUFDVjtBQUFBLEVBQ0E7QUFBQSxJQUNJLFFBQVE7QUFBQSxNQUNKO0FBQUEsUUFDSSxNQUFNO0FBQUEsUUFDTixNQUFNO0FBQUEsTUFDVjtBQUFBLElBQ0o7QUFBQSxJQUNBLE1BQU07QUFBQSxJQUNOLE1BQU07QUFBQSxFQUNWO0FBQUEsRUFDQTtBQUFBLElBQ0ksUUFBUTtBQUFBLE1BQ0o7QUFBQSxRQUNJLE1BQU07QUFBQSxRQUNOLE1BQU07QUFBQSxNQUNWO0FBQUEsTUFDQTtBQUFBLFFBQ0ksTUFBTTtBQUFBLFFBQ04sTUFBTTtBQUFBLE1BQ1Y7QUFBQSxJQUNKO0FBQUEsSUFDQSxNQUFNO0FBQUEsSUFDTixNQUFNO0FBQUEsRUFDVjtBQUFBLEVBQ0E7QUFBQSxJQUNJLFFBQVE7QUFBQSxNQUNKO0FBQUEsUUFDSSxNQUFNO0FBQUEsUUFDTixNQUFNO0FBQUEsTUFDVjtBQUFBLElBQ0o7QUFBQSxJQUNBLE1BQU07QUFBQSxJQUNOLE1BQU07QUFBQSxFQUNWO0FBQUEsRUFDQTtBQUFBLElBQ0ksUUFBUTtBQUFBLE1BQ0o7QUFBQSxRQUNJLE1BQU07QUFBQSxRQUNOLE1BQU07QUFBQSxNQUNWO0FBQUEsTUFDQTtBQUFBLFFBQ0ksTUFBTTtBQUFBLFFBQ04sTUFBTTtBQUFBLE1BQ1Y7QUFBQSxJQUNKO0FBQUEsSUFDQSxNQUFNO0FBQUEsSUFDTixNQUFNO0FBQUEsRUFDVjtBQUFBLEVB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QUNsRCxTQUFTLElBQUksRUFBRyxJQUFJLEtBQUssUUFBUSxLQUFLO0FBQUEsSUFDbEMsTUFBTSxNQUFNLEtBQUs7QUFBQSxJQUNqQixNQUFNLFNBQVMsSUFBSSxTQUFTLFFBQVEsSUFBSSxRQUFRO0FBQUEsSUFDaEQsTUFBTSxPQUFPLFdBQVcsU0FBUyxFQUFFLE1BQU0sT0FBTyxJQUFJO0FBQUEsSUFDcEQsTUFBTSxVQUFVLFdBQVcsU0FBUyxFQUFFLGdCQUFnQixtQkFBbUIsSUFBSSxDQUFDO0FBQUEsSUFDOUUsSUFBSTtBQUFBLE1BQ0EsTUFBTSxXQUFXLE1BQU0sTUFBTSxJQUFJLFFBQVEsWUFBWSxPQUFPLFlBQVksQ0FBQyxFQUFFLFFBQVEsVUFBVSxJQUFJLEdBQUc7QUFBQSxRQUNoRyxNQUFNLEtBQUssVUFBVSxJQUFJO0FBQUEsUUFDekI7QUFBQSxRQUNBO0FBQUEsTUFDSixDQUFDO0FBQUEsTUFDRCxJQUFJO0FBQUEsTUFDSixJQUFJLFNBQVMsUUFBUSxJQUFJLGNBQWMsR0FBRyxXQUFXLGtCQUFrQixHQUFHO0FBQUEsUUFDdEUsVUFBVSxNQUFNLFNBQVMsS0FBSyxHQUFHO0FBQUEsTUFDckMsRUFDSztBQUFBLFFBQ0QsU0FBVSxNQUFNLFNBQVMsS0FBSztBQUFBO0FBQUEsTUFFbEMsSUFBSSxDQUFDLFNBQVMsSUFBSTtBQUFBLFFBQ2QsUUFBUSxJQUFJLGlCQUFpQjtBQUFBLFVBQ3pCO0FBQUEsVUFDQSxTQUFTLFFBQVEsUUFDWCxXQUFVLE9BQU8sS0FBSyxJQUN0QixTQUFTO0FBQUEsVUFDZixTQUFTLFNBQVM7QUFBQSxVQUNsQixRQUFRLFNBQVM7QUFBQSxVQUNqQjtBQUFBLFFBQ0osQ0FBQztBQUFBLFFBQ0Q7QUFBQSxNQUNKO0FBQUEsTUFDQSxJQUFJLENBQUMsTUFBTSxNQUFNLEdBQUc7QUFBQSxRQUNoQixRQUFRLElBQUkscUNBQXFDO0FBQUEsVUFDN0M7QUFBQSxVQUNBO0FBQUEsUUFDSixDQUFDO0FBQUEsUUFDRDtBQUFBLE1BQ0o7QUFBQSxNQUNBLE9BQU87QUFBQSxNQUVYLE9BQU8sS0FBSztBQUFBLE1BQ1IsUUFBUSxJQUFJLGlCQUFpQjtBQUFBLFFBQ3pCO0FBQUEsUUFDQSxTQUFTLElBQUk7QUFBQSxRQUNiO0FBQUEsTUFDSixDQUFDO0FBQUE7QUFBQSxFQUVUO0FBQUEsRUFDQSxNQUFNO0FBQUE7IiwKICAiZGVidWdJZCI6ICJFRTJGMkFBRUFFRkZGMjM3NjQ3NTZFMjE2NDc1NkUyMSIsCiAgIm5hbWVzIjogW10KfQ==

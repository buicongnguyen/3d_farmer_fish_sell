import { VI_REFERENCE } from "./vi-reference.mjs";
import { VI_WILLOWMERE } from "./vi-willowmere.mjs";
export const LANGUAGE_KEY = "willowmere.language.v1";
const vi = Object.assign(/* @__PURE__ */ Object.create(null), VI_REFERENCE, VI_WILLOWMERE);
const folded = new Map(Object.entries(vi).map(([key, value]) => [key.toLowerCase(), value]));
const listeners = /* @__PURE__ */ new Set();
const cache = /* @__PURE__ */ new Map();
function initialLanguage() {
  try {
    const saved = globalThis.localStorage?.getItem(LANGUAGE_KEY);
    if (saved === "en" || saved === "vi") return saved;
  } catch {
  }
  return typeof navigator !== "undefined" && navigator.language?.toLowerCase().startsWith("vi") ? "vi" : "en";
}
let language = initialLanguage();
function documentLanguage() {
  if (typeof document !== "undefined") document.documentElement.lang = language;
}
documentLanguage();
export function getLanguage() {
  return language;
}
export function setLanguage(next) {
  if (next !== "en" && next !== "vi") return;
  try {
    globalThis.localStorage?.setItem(LANGUAGE_KEY, next);
  } catch {
  }
  if (language === next) {
    documentLanguage();
    return;
  }
  language = next;
  cache.clear();
  documentLanguage();
  for (const listener of listeners) listener();
}
export function onLanguageChange(callback) {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}
const interpolate = (value, params) => value.replace(/\{(\w+)\}/g, (token, key) => Object.hasOwn(params, key) ? String(params[key]) : token);
const quoteRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const templates = Object.entries(vi).filter(([key]) => /\{\w+\}/.test(key)).map(([source, target]) => {
  const names = [], parts = [];
  let cursor = 0;
  for (const match of source.matchAll(/\{(\w+)\}/g)) {
    const numeric = /^(amount|count|seconds|minutes|hours|days|level|ratio|cost|price|total|current|max|progress|target|chapter|rank|step|percent|defense|hp|xp|energy|stars|index|empty|beds|caught|all|need|have|gain)$/i.test(match[1]);
    const time = /^(time|interval)$/i.test(match[1]);
    const capture = numeric ? "([+\u2212-]?\\d+(?:[.,]\\d+)*)" : time ? "(\\d+(?:[.,]\\d+)?(?:\\s*(?:h|m|s|p|g|gi\u1EDD|ph\xFAt|gi\xE2y)(?:\\s+\\d+(?:[.,]\\d+)?\\s*(?:h|m|s|p|g|gi\u1EDD|ph\xFAt|gi\xE2y))*)?)" : "(.+?)";
    parts.push(quoteRegex(source.slice(cursor, match.index)), capture);
    names.push(match[1]);
    cursor = match.index + match[0].length;
  }
  parts.push(quoteRegex(source.slice(cursor)));
  return { regex: new RegExp("^" + parts.join("") + "$", "iu"), names, target, specificity: source.replace(/\{\w+\}/g, "").length };
}).filter((rule) => rule.specificity > 2).sort((a, b) => b.specificity - a.specificity);
function translate(source, depth = 0) {
  if (!source || depth > 8) return source;
  const core = source.trim();
  if (!core) return source;
  const prefix = source.slice(0, source.indexOf(core)), suffix = source.slice(source.indexOf(core) + core.length);
  const exact = vi[core] ?? folded.get(core.toLowerCase());
  if (exact !== void 0) return prefix + exact + suffix;
  for (const rule of templates) {
    const match = rule.regex.exec(core);
    if (!match) continue;
    const params = {};
    rule.names.forEach((key, index) => {
      params[key] = /^(name|user|username|owner|player|code)$/i.test(key) ? match[index + 1] : translate(match[index + 1], depth + 1);
    });
    return prefix + interpolate(rule.target, params) + suffix;
  }
  if (/\s[·•]\s/.test(core)) {
    const joined = core.split(/(\s+[·•]\s+)/).map((piece, i) => i % 2 ? piece : translate(piece, depth + 1)).join("");
    if (joined !== core) return prefix + joined + suffix;
  }
  const decorated = core.match(/^([^\p{L}\p{N}]*)(.*?)([^\p{L}\p{N}]*)$/u);
  if (decorated && (decorated[1] || decorated[3]) && decorated[2]) {
    if (decorated[1]) {
      const rest = decorated[2] + decorated[3], changed = translate(rest, depth + 1);
      if (changed !== rest) return prefix + decorated[1] + changed + suffix;
      const gap = decorated[1].search(/\s\S+$/);
      if (gap >= 0) {
        const lead = decorated[1].slice(0, gap + 1), signed = core.slice(lead.length), moved = translate(signed, depth + 1);
        if (moved !== signed) return prefix + lead + moved + suffix;
      }
    }
    if (decorated[3]) {
      const rest = decorated[1] + decorated[2], changed = translate(rest, depth + 1);
      if (changed !== rest) return prefix + changed + decorated[3] + suffix;
    }
    const middle = translate(decorated[2], depth + 1);
    if (middle !== decorated[2]) return prefix + decorated[1] + middle + decorated[3] + suffix;
  }
  const pieces = core.split(/(\s+[·•]\s+|,\s+)/);
  if (pieces.length > 1) return prefix + pieces.map((piece, i) => i % 2 ? piece : translate(piece, depth + 1)).join("") + suffix;
  return source;
}
export function t(source, params) {
  if (language === "en") return params ? interpolate(source, params) : source;
  if (params) return interpolate(vi[source] ?? folded.get(source.toLowerCase()) ?? source, params);
  const cached = cache.get(source);
  if (cached !== void 0) return cached;
  const result = translate(source);
  if (cache.size > 3e3) cache.clear();
  cache.set(source, result);
  return result;
}
const escapeHtml = (text) => text.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);
const decode = (text) => text.replace(/&(?:amp|lt|gt|quot|apos|nbsp|#\d+|#x[\da-f]+);/gi, (entity) => {
  const named = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&apos;": "'", "&nbsp;": "\xA0" };
  if (named[entity.toLowerCase()]) return named[entity.toLowerCase()];
  const hex = entity[2].toLowerCase() === "x", point = parseInt(entity.slice(hex ? 3 : 2, -1), hex ? 16 : 10);
  return Number.isFinite(point) && point > 0 && point <= 1114111 ? String.fromCodePoint(point) : entity;
});
const SKIP_TAGS = /* @__PURE__ */ new Set(["script", "style", "code", "kbd", "textarea"]);
const VOID_TAGS = /* @__PURE__ */ new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"]);
const ATTRIBUTES = ["title", "aria-label", "placeholder", "alt"];
export function localizeHtml(markup) {
  if (language === "en") return markup;
  const stack = [];
  return markup.replace(/<!--[\s\S]*?-->|<(?:[^>"']|"[^"]*"|'[^']*')*>|[^<]+|</g, (token) => {
    if (!token.startsWith("<")) {
      if (stack.at(-1)?.skip) return token;
      const original = decode(token), translated = t(original);
      return translated === original ? token : escapeHtml(translated);
    }
    const close = token.match(/^<\/\s*([\w-]+)/);
    if (close) {
      const tag2 = close[1].toLowerCase();
      for (let i = stack.length - 1; i >= 0; i--) if (stack[i].tag === tag2) {
        stack.length = i;
        break;
      }
      return token;
    }
    const opening = token.match(/^<([\w-]+)/);
    if (!opening) return token;
    const tag = opening[1].toLowerCase(), skip = !!stack.at(-1)?.skip || SKIP_TAGS.has(tag) || /\sdata-i18n-skip(?:[\s=>]|$)|\stranslate\s*=\s*["']no["']/i.test(token);
    if (!VOID_TAGS.has(tag) && !/\/\s*>$/.test(token)) stack.push({ tag, skip });
    if (skip) return token;
    return token.replace(/(\s(?:title|aria-label|placeholder|alt)\s*=\s*)(["'])([\s\S]*?)\2/gi, (all, lead, quote, value) => {
      const original = decode(value), translated = t(original);
      return original === translated ? all : lead + quote + escapeHtml(translated) + quote;
    });
  });
}
export function bindLanguage(root) {
  const entries = [];
  const walk = (node) => {
    if (node.nodeType === 3) {
      if (node.textContent?.trim()) entries.push({ node, source: node.textContent });
      return;
    }
    if (node.nodeType !== 1) return;
    const el = node;
    if (SKIP_TAGS.has(el.tagName.toLowerCase()) || el.hasAttribute("data-i18n-skip") || el.getAttribute("translate") === "no") return;
    for (const attr of ATTRIBUTES) {
      const source = el.getAttribute(attr);
      if (source) entries.push({ node, attr, source });
    }
    for (const child of Array.from(el.childNodes)) walk(child);
  };
  walk(root);
  const refresh = () => {
    for (const entry of entries) if (root.contains(entry.node)) {
      if (entry.attr) entry.node.setAttribute(entry.attr, t(entry.source));
      else entry.node.textContent = t(entry.source);
    }
  };
  refresh();
  return refresh;
}

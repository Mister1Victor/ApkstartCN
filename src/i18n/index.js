'use strict';
/**
 * ApkStart i18n (main process / Node side)
 *
 * Zero-dependency, JSON-based. Supported locales: en, zh-CN.
 * - Locale files: src/i18n/locales/<locale>.json (flat object, dot keys)
 * - Interpolation: {name} placeholders, e.g. t('toast.installed', { name })
 * - Resolution order for a key: current locale -> en -> zh-CN -> the key itself
 *   (en is the fallback so a missing translation never shows a raw key
 *    when an English string exists; zh-CN is the original source locale.)
 *
 * Preference model (stored in settings.language):
 *   'auto'   -> follow the OS / Electron locale (zh* -> zh-CN, otherwise en)
 *   'en'     -> English
 *   'zh-CN'  -> Simplified Chinese
 */
const en = require('./locales/en.json');
const zhCN = require('./locales/zh-CN.json');

const MESSAGES = { en, 'zh-CN': zhCN };
const SUPPORTED = Object.keys(MESSAGES);
const FALLBACK = 'en';

function normalizeLocale(input) {
  const s = String(input || '').trim().replace(/_/g, '-');
  if (!s) return null;
  const lower = s.toLowerCase();
  if (lower === 'zh' || lower.startsWith('zh-') || lower.startsWith('zh_')) return 'zh-CN';
  if (lower === 'en' || lower.startsWith('en-')) return 'en';
  return null;
}

/** Resolve a preference ('auto' | locale) + system locale to a supported locale. */
function resolveLocale(preference, systemLocale) {
  const pref = String(preference || 'auto').trim();
  if (pref !== 'auto') {
    const direct = normalizeLocale(pref);
    if (direct) return direct;
  }
  return normalizeLocale(systemLocale) || FALLBACK;
}

function systemLocale() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale || FALLBACK;
  } catch (_) {
    return FALLBACK;
  }
}

let currentLocale = resolveLocale('auto', systemLocale());
const listeners = new Set();

function interpolate(template, params) {
  if (!params) return template;
  return String(template).replace(/\{(\w+)\}/g, (m, name) =>
    (Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : m));
}

function t(key, params) {
  const dict = MESSAGES[currentLocale] || {};
  const raw = dict[key] != null ? dict[key]
    : (MESSAGES[FALLBACK] && MESSAGES[FALLBACK][key] != null ? MESSAGES[FALLBACK][key]
      : (MESSAGES['zh-CN'] && MESSAGES['zh-CN'][key] != null ? MESSAGES['zh-CN'][key] : key));
  return interpolate(raw, params);
}

function init(preference, sysLocale) {
  currentLocale = resolveLocale(preference, sysLocale != null ? sysLocale : systemLocale());
  return currentLocale;
}

function setLocale(preference, sysLocale) {
  const next = resolveLocale(preference, sysLocale != null ? sysLocale : systemLocale());
  const changed = next !== currentLocale;
  currentLocale = next;
  if (changed) for (const fn of [...listeners]) { try { fn(next); } catch (_) { /* ignore */ } }
  return currentLocale;
}

function getLocale() { return currentLocale; }
function getMessages(locale) { return MESSAGES[locale || currentLocale] || MESSAGES[FALLBACK]; }
function onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }

module.exports = {
  SUPPORTED,
  FALLBACK,
  MESSAGES,
  normalizeLocale,
  resolveLocale,
  systemLocale,
  init,
  setLocale,
  getLocale,
  getMessages,
  onChange,
  t,
};

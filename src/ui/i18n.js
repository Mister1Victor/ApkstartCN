'use strict';
/**
 * ApkStart i18n (renderer side)
 *
 * The main process owns the locale + dictionaries and hands them over via
 * window.apkstart.getI18n() -> { locale, preference, supported, messages }.
 *
 * Static HTML: annotate elements instead of hard-coding text.
 *   data-i18n="settings.title"              -> textContent
 *   data-i18n-html="empty.desc"             -> innerHTML (strings with <br/> etc.)
 *   data-i18n-placeholder="search.placeholder" -> placeholder attribute
 *   data-i18n-title="common.settings"       -> title attribute
 *   data-i18n-alt="settings.aboutQrAlt"     -> alt attribute
 * Dynamic JS: use t('key', { param }) exactly like the main process.
 */
(function () {
  let locale = 'en';
  let messages = {};
  let fallback = {};

  function interpolate(template, params) {
    if (!params) return String(template);
    return String(template).replace(/\{(\w+)\}/g, (m, name) =>
      (Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : m));
  }

  function t(key, params) {
    const raw = messages[key] != null ? messages[key]
      : (fallback[key] != null ? fallback[key] : key);
    return interpolate(raw, params);
  }

  function apply(root) {
    const scope = root || document;
    scope.querySelectorAll('[data-i18n]').forEach((el) => {
      el.textContent = t(el.getAttribute('data-i18n'));
    });
    scope.querySelectorAll('[data-i18n-html]').forEach((el) => {
      el.innerHTML = t(el.getAttribute('data-i18n-html'));
    });
    scope.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
      el.setAttribute('placeholder', t(el.getAttribute('data-i18n-placeholder')));
    });
    scope.querySelectorAll('[data-i18n-title]').forEach((el) => {
      el.setAttribute('title', t(el.getAttribute('data-i18n-title')));
    });
    scope.querySelectorAll('[data-i18n-alt]').forEach((el) => {
      el.setAttribute('alt', t(el.getAttribute('data-i18n-alt')));
    });
  }

  async function init(api) {
    try {
      const data = await api.getI18n();
      if (data) {
        locale = data.locale || locale;
        messages = data.messages || {};
        fallback = data.fallbackMessages || {};
      }
    } catch (_) { /* keep key-as-text fallback; UI still renders */ }
    document.documentElement.lang = locale;
    apply(document);
    return locale;
  }

  /** Re-fetch after the user changes the language preference in Settings. */
  async function refresh(api) {
    const loc = await init(api);
    return loc;
  }

  window.I18n = {
    t,
    apply,
    init,
    refresh,
    get locale() { return locale; },
  };
  // Convenience global matching the main-process name.
  window.t = t;
})();

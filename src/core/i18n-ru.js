'use strict';
/**
 * Словарь автоперевода китайского текста в русский (для main-процесса).
 *
 * Загружает i18n/strings.json (пара: китайский сегмент -> русский перевод),
 * сформированный скриптами scripts/i18n/*.py при реконструкции интерфейса.
 *
 * api:
 *   t(text)            — посегментная замена CJK-кусков на переводы;
 *   translateDeep(obj) — рекурсивно проходит объекты/массивы и переводит строки
 *                        (значения полей title/body/message/label/text и т.д.).
 *
 * Если словарь отсутствует или пуст — функции безопасны (текст не меняется),
 * приложение работает как прежде.
 */
const fs = require('fs');
const path = require('path');

// CJK-идеограммы + специфическая китайская пунктуация
const CJK_RANGE = '\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff00-\uffef\u3000-\u303f';
const HAS_CJK = new RegExp('[' + CJK_RANGE + ']');

let DICT = null;
let BY_LEN = null; // ключи, отсортированные по убыванию длины (длинные матчи раньше)

function loadDict() {
  if (DICT) return DICT;
  DICT = {};
  const candidates = [
    // дев-репозиторий: <root>/i18n/strings.json
    path.join(__dirname, '..', '..', 'i18n', 'strings.json'),
    // собранное приложение: ресурсы electron-builder кладут extraResources рядом
    path.join(process.resourcesPath || '', 'i18n', 'strings.json'),
    // вариант с src в resources/app.asar.unpacked
    path.join(process.resourcesPath || '', 'app.asar.unpacked', 'src', 'core', '..', '..', 'i18n', 'strings.json'),
  ];
  for (const p of candidates) {
    try {
      if (!p || !fs.existsSync(p)) continue;
      const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
      let n = 0;
      for (const [k, v] of Object.entries(raw)) {
        if (typeof v === 'string' && v && k !== v) { DICT[k] = v; n++; }
      }
      if (n > 0) break;
    } catch (_) { /* нет словаря — работаем без перевода */ }
  }
  BY_LEN = Object.keys(DICT).sort((a, b) => b.length - a.length);
  return DICT;
}

/** Кусок текста без CJK оставляем как есть; кусок с CJK пытаемся перевести. */
function translateSegment(seg) {
  if (!HAS_CJK.test(seg)) return seg;
  loadDict();
  // 1) точное совпадение всего куска
  if (DICT[seg]) return DICT[seg];
  // 2) жадное покрытие словарём: ищем самые длинные известные фразы
  let out = '';
  let i = 0;
  outer: while (i < seg.length) {
    if (!HAS_CJK.test(seg[i])) { out += seg[i++]; continue; }
    for (const key of BY_LEN) {
      if (key.length && seg.startsWith(key, i)) {
        out += DICT[key];
        i += key.length;
        continue outer;
      }
    }
    out += seg[i++]; // неизвестный символ — оставляем
  }
  return out;
}

function t(text) {
  if (typeof text !== 'string' || !text || !HAS_CJK.test(text)) return text;
  // разбиваем на «CJK-куски» и «обычный текст», переводим первые
  const re = new RegExp('[' + CJK_RANGE + '][^' + CJK_RANGE + ']*', 'g');
  let out = '';
  let last = 0;
  let m;
  while ((m = re.exec(text))) {
    out += text.slice(last, m.index) + translateSegment(m[0]);
    last = m.index + m[0].length;
  }
  return out + text.slice(last);
}

function translateDeep(v) {
  if (typeof v === 'string') return t(v);
  if (Array.isArray(v)) return v.map(translateDeep);
  if (v && typeof v === 'object') {
    const o = {};
    for (const [k, val] of Object.entries(v)) o[k] = translateDeep(val);
    return o;
  }
  return v;
}

module.exports = { t, translateDeep, hasCJK: (s) => typeof s === 'string' && HAS_CJK.test(s) };

#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Машинный перевод сегментов (китайский -> русский) через публичный эндпоинт
Google Translate gtx (без API-ключа), POST-запросами с батчами.

Читает i18n/strings.json, допереводит только сегменты со значением null/пусто,
сохраняет результат после каждого батча (устойчив к прерываниям).

Использование:
    python3 scripts/i18n/translate.py [limit]
"""
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
STRINGS = os.path.join(ROOT, "i18n", "strings.json")

CJK = re.compile(r"[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]")
URL = "https://translate.googleapis.com/translate_a/single?client=gtx&sl=zh-CN&tl=ru&dt=t"

SEP = "\n@@SEG@@\n"


def needs(s):
    if not s:
        return False
    if CJK.search(s):
        return True
    return bool(re.search(r"[，。；：！？、（）“”‘’《》【】]", s))


def mt_batch(texts):
    """Перевод списка текстов одним запросом; возвращает список переводов."""
    joined = SEP.join(texts)
    data = urllib.parse.urlencode({"q": joined}).encode()
    last = None
    for attempt in range(5):
        try:
            req = urllib.request.Request(
                URL, data=data, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=30) as r:
                d = json.loads(r.read().decode("utf-8"))
            full = "".join(s[0] for s in d[0] if s and isinstance(s[0], str))
            parts = re.split(r"\s*@@ ?SEG ?@@\s*", full)
            if len(parts) != len(texts):
                raise ValueError("batch mismatch %d != %d" % (len(parts), len(texts)))
            return [p.strip() or t for p, t in zip(parts, texts)]
        except Exception as e:
            last = e
            time.sleep(1.5 * (attempt + 1))
    raise RuntimeError("MT batch failed: %s" % last)


def mt_single(text):
    return mt_batch([text])[0]


def save(d):
    tmp = STRINGS + ".tmp"
    with open(tmp, "w", encoding="utf-8") as fh:
        json.dump(d, fh, ensure_ascii=False, indent=1, sort_keys=True)
        fh.flush()
        os.fsync(fh.fileno())
    os.replace(tmp, STRINGS)


def main():
    limit = int(sys.argv[1]) if len(sys.argv) > 1 else 0
    d = json.load(open(STRINGS, encoding="utf-8"))
    todo = [k for k, v in d.items() if (v is None or v == "") and needs(k)]
    if limit:
        todo = todo[:limit]
    print("к переводу: %d" % len(todo), flush=True)
    t0 = time.time()
    done = 0
    BATCH = 20
    MAXCHUNK = 4500
    i = 0
    n = len(todo)
    while i < n:
        batch = []
        size = 0
        j = i
        while j < n and len(batch) < BATCH and size + len(todo[j]) <= MAXCHUNK:
            batch.append(todo[j])
            size += len(todo[j]) + len(SEP)
            j += 1
        try:
            trs = mt_batch(batch)
        except Exception as e:
            trs = []
            for b in batch:
                try:
                    trs.append(mt_single(b))
                except Exception as e2:
                    sys.stderr.write("FAIL %r: %s\n" % (b[:60], e2))
                    trs.append(None)
        for b, t in zip(batch, trs):
            if t:
                d[b] = t
        done += sum(1 for t in trs if t)
        i = j
        save(d)
        if done and (done % 1000 < BATCH or i >= n):
            rate = done / max(time.time() - t0, 1)
            print("%d/%d (%.1f сег/сек)" % (done, n, rate), flush=True)
        time.sleep(0.15)
    save(d)
    print("готово: %d за %.0f сек" % (done, time.time() - t0), flush=True)


if __name__ == "__main__":
    main()

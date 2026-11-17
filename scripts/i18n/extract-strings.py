#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Извлечение уникальных строковых сегментов, содержащих китайские иероглифы (CJK),
из исходного кода проекта ApkStart.

Сегментами считаются:
  - содержимое строковых литералов JS/JSON ("...", '...', `...`) без выражений ${};
  - текстовые узлы HTML;
  - отдельные строки в файлах .css / .ps1 / .nsh / .sh / .yml / .md (без CJK-литералов).

Результат: i18n/strings.json  { "<сегмент>": "<перевод>" }  (значения заполняет переводчик).
"""
import json
import os
import re

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))

CJK = re.compile(r"[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]")

CODE_DIRS = ["src", "test", "build", "scripts", "tools", "engine"]
DOC_FILES = ["README.md", "CONTRIBUTING.md", "package.json", "electron-builder.yml"]
DOC_DIRS = ["docs", ".github"]

SKIP_DIR_PARTS = {"assets", ".git", "node_modules", "platform-tools"}
TEXT_EXTS = {".js", ".html", ".css", ".ps1", ".nsh", ".py", ".sh", ".yml", ".json", ".md", ".txt"}

STR_RE = re.compile(r'"([^"\\\n]*)"|\'([^\'\\\n]*)\'|`([^`$\\]*)`')


def has_cjk(s):
    return bool(CJK.search(s))


def split_long(s, out):
    """Слишком длинные сегменты режем по предложениям для MT."""
    if len(s) <= 900:
        out[s] = None
        return
    parts = re.split(r"(?<=[。！？；：,，.!?;:])\s*|\n+", s)
    buf = ""
    for p in parts:
        if len(buf) + len(p) > 850:
            if buf.strip():
                out[buf.strip()] = None
            buf = p
        else:
            buf += p + "\n"
    if buf.strip():
        out[buf.strip()] = None


def harvest_code(text, out):
    for m in STR_RE.finditer(text):
        s = m.group(1) or m.group(2) or m.group(3) or ""
        if has_cjk(s):
            split_long(s, out)


def harvest_html(text, out):
    for chunk in re.split(r"<[^>]+>", text):
        c = chunk.strip()
        if c and has_cjk(c):
            split_long(c, out)


def harvest_lines(text, out):
    for line in text.splitlines():
        if has_cjk(line):
            split_long(line.rstrip(), out)


def main():
    strings = {}
    seen_files = []

    def add_file(path):
        rel = os.path.relpath(path, ROOT).replace("\\", "/")
        try:
            text = open(path, encoding="utf-8").read()
        except (UnicodeDecodeError, OSError):
            return
        ext = os.path.splitext(path)[1].lower()
        if ext == ".html":
            harvest_html(text, strings)
            harvest_code(text, strings)
        elif ext in (".js", ".json", ".py"):
            harvest_code(text, strings)
            harvest_lines(text, strings)
        else:
            harvest_lines(text, strings)
        seen_files.append(rel)

    for d in CODE_DIRS:
        base = os.path.join(ROOT, d)
        if not os.path.isdir(base):
            continue
        for dirpath, dirs, files in os.walk(base):
            dirs[:] = [x for x in dirs if x not in SKIP_DIR_PARTS]
            for fn in sorted(files):
                if os.path.splitext(fn)[1].lower() in TEXT_EXTS:
                    add_file(os.path.join(dirpath, fn))

    for f in DOC_FILES:
        p = os.path.join(ROOT, f)
        if os.path.isfile(p):
            add_file(p)
    for d in DOC_DIRS:
        base = os.path.join(ROOT, d)
        if not os.path.isdir(base):
            continue
        for dirpath, dirs, files in os.walk(base):
            dirs[:] = [x for x in dirs if x not in SKIP_DIR_PARTS]
            for fn in sorted(files):
                if os.path.splitext(fn)[1].lower() in TEXT_EXTS:
                    add_file(os.path.join(dirpath, fn))

    i18n_dir = os.path.join(ROOT, "i18n")
    os.makedirs(i18n_dir, exist_ok=True)
    out_path = os.path.join(i18n_dir, "strings.json")
    old = {}
    if os.path.isfile(out_path):
        try:
            old = json.load(open(out_path, encoding="utf-8"))
        except Exception:
            old = {}
    merged = {}
    for k in strings:
        merged[k] = old.get(k)  # сохраняем уже готовые переводы
    with open(out_path, "w", encoding="utf-8") as fh:
        json.dump(merged, fh, ensure_ascii=False, indent=1, sort_keys=True)
    print("файлов: %d, уникальных сегментов: %d" % (len(seen_files), len(merged)))
    todo = sum(1 for v in merged.values() if not v)
    print("требуют перевода: %d" % todo)


if __name__ == "__main__":
    main()

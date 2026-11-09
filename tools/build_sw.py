#!/usr/bin/env python3
"""precache.json 만들기 — 서비스 워커(sw.js)가 설치 때 받아 둘 앱 파일 목록.

    python3 tools/build_sw.py        (tools/set_version.py 가 함께 실행합니다)

넣는 것: index.html · manifest · css · js(언어 포함) · hublib · esp32 · img · vendor/blockly · vendor/mpy-cross
빼는 것: vendor/web-llm (AI 튜터를 켤 때만 받음, 약 7 MB) · tests · tools · 문서
"""
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent
ver = re.search(r"version: '([^']*)'", (ROOT / 'js' / 'config.js').read_text(encoding='utf-8')).group(1)

# .gitignore 로 올라가지 않는 파일(__pycache__ 등)은 사이트에 없으므로 빼야 함 → git 이 아는 파일만
import subprocess  # noqa: E402
try:
    tracked = set(subprocess.run(['git', 'ls-files', '--cached', '--others', '--exclude-standard'], cwd=ROOT,
                                 capture_output=True, text=True, check=True).stdout.split('\n'))
except Exception:
    tracked = None

files = ['./', 'index.html', 'manifest.webmanifest']
for d in ['css', 'js', 'hublib', 'esp32', 'img', 'vendor/blockly', 'vendor/mpy-cross']:
    for f in sorted((ROOT / d).rglob('*')):
        if (f.is_file() and not f.name.startswith('.') and f.suffix not in ('.md', '.txt', '.pyc') and f.name != 'LICENSE'
                and '__pycache__' not in f.parts
                and (tracked is None or f.relative_to(ROOT).as_posix() in tracked)):
            files.append(f.relative_to(ROOT).as_posix())

sw = ROOT / 'sw.js'
sw.write_text(re.sub(r"const VERSION = '[^']*';", f"const VERSION = '{ver}';", sw.read_text(encoding='utf-8')), encoding='utf-8')

out = ROOT / 'precache.json'
out.write_text(json.dumps({'version': ver, 'files': files}, ensure_ascii=False, indent=0), encoding='utf-8')
size = sum((ROOT / f).stat().st_size for f in files if (ROOT / f).is_file())
print(f'precache.json: {len(files)}개 파일 · {size / 1024 / 1024:.1f} MB · v{ver}')

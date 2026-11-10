#!/usr/bin/env python3
"""버전을 바꾸고, 모든 파일 주소에 ?v=<버전> 을 붙입니다 (브라우저 캐시 때문에 옛 파일이 섞이지 않도록).

  python3 tools/set_version.py 0.2.1

업데이트를 올리기 전에 한 번 실행하세요. GitHub Pages 는 파일을 10분 동안 캐시합니다.
"""
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
ver = sys.argv[1] if len(sys.argv) > 1 else None
cfg = ROOT / 'js' / 'config.js'
src = cfg.read_text(encoding='utf-8')
if ver:
    src = re.sub(r"version: '[^']*'", f"version: '{ver}'", src)
    cfg.write_text(src, encoding='utf-8')
ver = re.search(r"version: '([^']*)'", src).group(1)
Q = f'?v={ver}'

# 1) JS 모듈의 상대 경로 import:  from './x.js'  /  import('./x.js')  /  import(`./lang/${l}.js`)
imp = re.compile(r"""((?:from\s+|import\s+|import\(\s*)(['"`]))(\.{1,2}/[^'"`?]+?\.js)(?:\?v=[^'"`]*)?(\2)""")
n = 0
for f in sorted((ROOT / 'js').rglob('*.js')):
    s = f.read_text(encoding='utf-8')
    t = imp.sub(lambda m: m.group(1) + m.group(3) + Q + m.group(4), s)
    # fetch / new URL 로 읽는 파일 (허브 라이브러리, Blockly 메시지, wasm)
    t = re.sub(r"(\$\{name\}\.py)(?:\?v=[^`]*)?`", r"\1" + Q + "`", t)
    t = re.sub(r"(msg/\$\{info\.blockly\}\.js)(?:\?v=[^`]*)?`", r"\1" + Q + "`", t)
    t = re.sub(r"(vendor/mpy-cross/mpy-cross-v6\.wasm)(?:\?v=[^']*)?'", r"\1" + Q + "'", t)
    if t != s:
        f.write_text(t, encoding='utf-8')
        n += 1

# 2) index.html 의 로컬 스크립트·스타일
html = ROOT / 'index.html'
s = html.read_text(encoding='utf-8')
t = re.sub(r'((?:src|href)=")((?:js|css|vendor|img)/[^"?]+)(?:\?v=[^"]*)?(")', lambda m: m.group(1) + m.group(2) + Q + m.group(3), s)
html.write_text(t, encoding='utf-8')
print(f'version {ver}: {n} js files updated, index.html updated')

# 3) 오프라인용 파일 목록 (sw.js)
import subprocess  # noqa: E402
subprocess.run([sys.executable, str(ROOT / 'tools' / 'build_sw.py')], check=True)

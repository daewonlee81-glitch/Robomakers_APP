#!/usr/bin/env python3
"""모터 포트 여러 개 고르기 메뉴 글 (7개 언어).  python3 tools/multiport_text.py"""
import json, os, re
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TEXT = {
 'ko': {'mp.port': '모터 {0}', 'mp.hint': '여러 개를 고르면 함께 움직여요', 'mp.all': '모두 고르기', 'mp.one': '하나만'},
 'en': {'mp.port': 'motor {0}', 'mp.hint': 'Pick several to move them together', 'mp.all': 'Select all', 'mp.one': 'Just one'},
 'ja': {'mp.port': 'モーター {0}', 'mp.hint': '複数選ぶといっしょに動きます', 'mp.all': 'すべて選ぶ', 'mp.one': '1つだけ'},
 'zh-CN': {'mp.port': '电机 {0}', 'mp.hint': '选多个会一起动', 'mp.all': '全选', 'mp.one': '只选一个'},
 'zh-TW': {'mp.port': '馬達 {0}', 'mp.hint': '選多個會一起動', 'mp.all': '全選', 'mp.one': '只選一個'},
 'es': {'mp.port': 'motor {0}', 'mp.hint': 'Elige varios para moverlos a la vez', 'mp.all': 'Elegir todos', 'mp.one': 'Solo uno'},
 'th': {'mp.port': 'มอเตอร์ {0}', 'mp.hint': 'เลือกหลายตัวเพื่อให้เคลื่อนพร้อมกัน', 'mp.all': 'เลือกทั้งหมด', 'mp.one': 'ตัวเดียว'},
}
for lang, d in TEXT.items():
    p = os.path.join(ROOT, 'js', 'lang', lang + '.js')
    s = open(p, encoding='utf-8').read()
    s = re.sub(r"\n  ['\"]mp\.[a-z]+['\"]: .*", '', s)
    m = re.search(r"\n};\s*$", s)
    s = s[:m.start()] + ''.join(f'\n  {json.dumps(k)}: {json.dumps(v, ensure_ascii=False)},' for k, v in d.items()) + s[m.start():]
    open(p, 'w', encoding='utf-8').write(s)
print('ok')

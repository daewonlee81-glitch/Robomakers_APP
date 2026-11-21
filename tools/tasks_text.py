#!/usr/bin/env python3
"""「시작」 블록 여러 개 동시 실행 글 — 7개 언어.

    python3 tools/tasks_text.py
"""
import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KEYS_RE = r"(?:b\.rm_start\.tip|gen\.tasks|rule\.tasks(?:Motor|Drive)|ex\.multi)"

TEXT = {
'ko': {
 'b.rm_start.tip': '실행 버튼을 누르면 여기 아래 블록이 순서대로 실행됩니다. 이 블록을 여러 개 꺼내 놓으면 줄기들이 동시에 실행됩니다 (예: 한 줄기는 주행, 다른 줄기는 센서 확인).',
 'gen.tasks': '# 시작 블록 {0}개를 동시에 실행 — 기다리는 동안 다른 줄기가 실행됩니다',
 'rule.tasksMotor': '시작 블록 여러 개가 같은 모터({0})를 움직여요. 동시에 다른 명령을 주면 나중 명령이 앞의 것을 덮어씁니다.',
 'rule.tasksDrive': '주행',
 'ex.multi': '동시 실행: 네모로 달리면서 불빛 깜빡이기 (시작 블록 2개)',
},
'en': {
 'b.rm_start.tip': 'When you press Run, the blocks below run in order. Put out several of these blocks and their stacks run at the same time (for example one drives while another checks a sensor).',
 'gen.tasks': '# {0} start blocks run at the same time — while one waits, the others run',
 'rule.tasksMotor': 'Several start blocks move the same motor ({0}). If they give different commands at once, the later command replaces the earlier one.',
 'rule.tasksDrive': 'driving',
 'ex.multi': 'At the same time: drive a square while blinking the light (2 start blocks)',
},
'ja': {
 'b.rm_start.tip': '実行ボタンを押すと、この下のブロックが順番に実行されます。このブロックをいくつも置くと、それぞれの流れが同時に実行されます(例:1つは走行、もう1つはセンサーの確認)。',
 'gen.tasks': '# スタートブロック {0} 個を同時に実行 — 待っている間にほかの流れが動きます',
 'rule.tasksMotor': '複数のスタートブロックが同じモーター({0})を動かしています。同時に違う命令を出すと、後の命令が前の命令を上書きします。',
 'rule.tasksDrive': '走行',
 'ex.multi': '同時実行:四角く走りながらライトを点滅(スタートブロック2個)',
},
'zh-CN': {
 'b.rm_start.tip': '按下运行后,下面的积木会按顺序执行。放多个这样的积木,各段程序会同时运行(例如一段负责行驶,另一段检查传感器)。',
 'gen.tasks': '# 同时运行 {0} 个开始积木 — 一段等待时其他段继续运行',
 'rule.tasksMotor': '多个开始积木在控制同一个电机({0})。同时给出不同命令时,后面的命令会覆盖前面的。',
 'rule.tasksDrive': '行驶',
 'ex.multi': '同时运行:一边走正方形一边闪灯(2 个开始积木)',
},
'zh-TW': {
 'b.rm_start.tip': '按下執行後,下面的積木會依序執行。放多個這樣的積木,各段程式會同時執行(例如一段負責行駛,另一段檢查感測器)。',
 'gen.tasks': '# 同時執行 {0} 個開始積木 — 一段等待時其他段繼續執行',
 'rule.tasksMotor': '多個開始積木在控制同一個馬達({0})。同時給出不同命令時,後面的命令會覆蓋前面的。',
 'rule.tasksDrive': '行駛',
 'ex.multi': '同時執行:一邊走正方形一邊閃燈(2 個開始積木)',
},
'es': {
 'b.rm_start.tip': 'Al pulsar Ejecutar, los bloques de abajo se ejecutan en orden. Si pones varios de estos bloques, sus pilas se ejecutan a la vez (por ejemplo, una conduce y otra revisa un sensor).',
 'gen.tasks': '# {0} bloques de inicio se ejecutan a la vez — mientras uno espera, los demás siguen',
 'rule.tasksMotor': 'Varios bloques de inicio mueven el mismo motor ({0}). Si dan órdenes distintas a la vez, la última reemplaza a la anterior.',
 'rule.tasksDrive': 'conducción',
 'ex.multi': 'A la vez: recorrer un cuadrado mientras parpadea la luz (2 bloques de inicio)',
},
'th': {
 'b.rm_start.tip': 'เมื่อกดเรียกใช้ บล็อกด้านล่างจะทำงานตามลำดับ ถ้าวางบล็อกนี้หลายอัน แต่ละชุดจะทำงานพร้อมกัน (เช่น ชุดหนึ่งขับเคลื่อน อีกชุดตรวจเซนเซอร์)',
 'gen.tasks': '# บล็อกเริ่ม {0} อันทำงานพร้อมกัน — ระหว่างที่ชุดหนึ่งรอ ชุดอื่นจะทำงานต่อ',
 'rule.tasksMotor': 'บล็อกเริ่มหลายอันสั่งมอเตอร์ตัวเดียวกัน ({0}) ถ้าสั่งต่างกันพร้อมกัน คำสั่งหลังจะทับคำสั่งก่อน',
 'rule.tasksDrive': 'การขับเคลื่อน',
 'ex.multi': 'ทำพร้อมกัน: วิ่งเป็นสี่เหลี่ยมพร้อมไฟกะพริบ (บล็อกเริ่ม 2 อัน)',
},
}


def main():
    keys = list(TEXT['ko'])
    for lang, d in TEXT.items():
        assert list(d) == keys, (lang, set(keys) ^ set(d))
        p = os.path.join(ROOT, 'js', 'lang', lang + '.js')
        s = open(p, encoding='utf-8').read()
        s = re.sub(r"\n  ['\"]" + KEYS_RE + r"['\"]: .*", '', s)
        block = ''.join(f'\n  {json.dumps(k)}: {json.dumps(v, ensure_ascii=False)},' for k, v in d.items())
        m = re.search(r"\n};\s*$", s)
        s = s[:m.start()] + block + s[m.start():]
        open(p, 'w', encoding='utf-8').write(s)
    print(f'{len(TEXT)}개 언어 × {len(keys)}개 키')


if __name__ == '__main__':
    main()

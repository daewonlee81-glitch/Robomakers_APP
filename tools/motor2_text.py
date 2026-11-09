#!/usr/bin/env python3
"""모터 두 개 블록 · 「주행 최고 속도 재기」 예제 글 (7개 언어).

    python3 tools/motor2_text.py
"""
import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

TEXT = {
'ko': {
 'b.rm_motor_pair_run': '모터 %1 을 %2 %, 모터 %3 을 %4 % 속도로 계속 돌리기',
 'b.rm_motor_pair_run.tip': '두 모터를 한 번에 돌립니다. 속도 100% = 초당 1000도. 서로 다른 속도를 주면 로봇이 돕니다.',
 'b.rm_motor_pair_setup': '모터 %1 방향 %2, 모터 %3 방향 %4 로 설정',
 'b.rm_motor_pair_setup.tip': '두 모터가 + 속도일 때 도는 방향을 한 번에 정합니다. 양쪽 바퀴 모터는 보통 서로 반대로 정해야 둘 다 앞으로 갑니다.',
 'ex.speedtest': '측정: 주행 최고 속도 · 회전 최고 속도 재기',
 'ex.speedtest.start': '최고 속도 재기 — 앞이 1 m 이상 비어 있는지 확인하세요',
 'ex.speedtest.v': '직진 최고 속도: ',
 'ex.speedtest.w': '회전 최고 속도: ',
},
'en': {
 'b.rm_motor_pair_run': 'run motor %1 at %2 % and motor %3 at %4 % speed',
 'b.rm_motor_pair_run.tip': 'Runs two motors at once. Speed 100% = 1000 degrees per second. Different speeds make the robot turn.',
 'b.rm_motor_pair_setup': 'set motor %1 direction %2 and motor %3 direction %4',
 'b.rm_motor_pair_setup.tip': 'Sets which way both motors turn for a positive speed. The two wheel motors usually need opposite directions so both drive forward.',
 'ex.speedtest': 'Measure: top driving speed · top turn rate',
 'ex.speedtest.start': 'Measuring top speed — make sure there is at least 1 m of free space ahead',
 'ex.speedtest.v': 'Top straight speed: ',
 'ex.speedtest.w': 'Top turn rate: ',
},
'ja': {
 'b.rm_motor_pair_run': 'モーター %1 を %2 %、モーター %3 を %4 % の速さで回し続ける',
 'b.rm_motor_pair_run.tip': '2つのモーターを同時に回します。速度 100% = 毎秒 1000 度。違う速さにするとロボットが曲がります。',
 'b.rm_motor_pair_setup': 'モーター %1 の向きを %2、モーター %3 の向きを %4 にする',
 'b.rm_motor_pair_setup.tip': '2つのモーターが + の速さで回る向きを一度に決めます。左右の車輪のモーターは、ふつう反対向きにすると両方前に進みます。',
 'ex.speedtest': '測定:走行の最高速度・回転の最高速度',
 'ex.speedtest.start': '最高速度の測定 — 前に1 m 以上あいているか確かめてください',
 'ex.speedtest.v': '直進の最高速度: ',
 'ex.speedtest.w': '回転の最高速度: ',
},
'zh-CN': {
 'b.rm_motor_pair_run': '电机 %1 以 %2 %、电机 %3 以 %4 % 速度持续转动',
 'b.rm_motor_pair_run.tip': '同时转动两个电机。速度 100% = 每秒 1000 度。两个速度不同时机器人会转弯。',
 'b.rm_motor_pair_setup': '设置电机 %1 方向为 %2、电机 %3 方向为 %4',
 'b.rm_motor_pair_setup.tip': '一次设定两个电机正速度时的转动方向。左右轮电机通常要设成相反方向,才能一起前进。',
 'ex.speedtest': '测量:最高行驶速度 · 最高转弯速度',
 'ex.speedtest.start': '测量最高速度 — 请确认前方至少有 1 米空地',
 'ex.speedtest.v': '直行最高速度: ',
 'ex.speedtest.w': '转弯最高速度: ',
},
'zh-TW': {
 'b.rm_motor_pair_run': '馬達 %1 以 %2 %、馬達 %3 以 %4 % 速度持續轉動',
 'b.rm_motor_pair_run.tip': '同時轉動兩個馬達。速度 100% = 每秒 1000 度。兩個速度不同時機器人會轉彎。',
 'b.rm_motor_pair_setup': '設定馬達 %1 方向為 %2、馬達 %3 方向為 %4',
 'b.rm_motor_pair_setup.tip': '一次設定兩個馬達正速度時的轉動方向。左右輪馬達通常要設成相反方向,才能一起前進。',
 'ex.speedtest': '測量:最高行駛速度 · 最高轉彎速度',
 'ex.speedtest.start': '測量最高速度 — 請確認前方至少有 1 公尺空地',
 'ex.speedtest.v': '直行最高速度: ',
 'ex.speedtest.w': '轉彎最高速度: ',
},
'es': {
 'b.rm_motor_pair_run': 'girar motor %1 a %2 % y motor %3 a %4 % de velocidad',
 'b.rm_motor_pair_run.tip': 'Gira dos motores a la vez. Velocidad 100 % = 1000 grados por segundo. Con velocidades distintas el robot gira.',
 'b.rm_motor_pair_setup': 'motor %1 sentido %2 y motor %3 sentido %4',
 'b.rm_motor_pair_setup.tip': 'Fija a la vez hacia dónde giran los dos motores con velocidad positiva. Los motores de las ruedas suelen ir en sentidos opuestos para que ambos avancen.',
 'ex.speedtest': 'Medir: velocidad máxima de avance · de giro',
 'ex.speedtest.start': 'Midiendo la velocidad máxima — deja al menos 1 m libre delante',
 'ex.speedtest.v': 'Velocidad máxima recta: ',
 'ex.speedtest.w': 'Velocidad máxima de giro: ',
},
'th': {
 'b.rm_motor_pair_run': 'หมุนมอเตอร์ %1 ที่ %2 % และมอเตอร์ %3 ที่ %4 % ต่อเนื่อง',
 'b.rm_motor_pair_run.tip': 'หมุนมอเตอร์สองตัวพร้อมกัน ความเร็ว 100% = 1000 องศาต่อวินาที ถ้าความเร็วต่างกันหุ่นยนต์จะเลี้ยว',
 'b.rm_motor_pair_setup': 'ตั้งทิศมอเตอร์ %1 เป็น %2 และมอเตอร์ %3 เป็น %4',
 'b.rm_motor_pair_setup.tip': 'ตั้งทิศที่มอเตอร์ทั้งสองหมุนเมื่อความเร็วเป็นบวกในครั้งเดียว มอเตอร์ล้อซ้ายขวามักต้องตั้งกลับทิศกัน จึงจะเดินหน้าไปด้วยกัน',
 'ex.speedtest': 'วัด: ความเร็วสูงสุดขณะวิ่ง · ขณะหมุน',
 'ex.speedtest.start': 'กำลังวัดความเร็วสูงสุด — ตรวจดูว่าข้างหน้ามีที่ว่างอย่างน้อย 1 เมตร',
 'ex.speedtest.v': 'ความเร็วตรงสูงสุด: ',
 'ex.speedtest.w': 'ความเร็วหมุนสูงสุด: ',
},
}


def main():
    keys = list(TEXT['ko'])
    for lang, d in TEXT.items():
        assert list(d) == keys, lang
        p = os.path.join(ROOT, 'js', 'lang', lang + '.js')
        s = open(p, encoding='utf-8').read()
        s = re.sub(r"\n  ['\"](?:b\.rm_motor_pair_[^'\"]+|ex\.speedtest[^'\"]*)['\"]: .*", '', s)
        block = ''.join(f'\n  {json.dumps(k)}: {json.dumps(v, ensure_ascii=False)},' for k, v in d.items())
        m = re.search(r"\n};\s*$", s)
        s = s[:m.start()] + block + s[m.start():]
        open(p, 'w', encoding='utf-8').write(s)
    print(f'{len(TEXT)}개 언어 × {len(keys)}개 키')


if __name__ == '__main__':
    main()

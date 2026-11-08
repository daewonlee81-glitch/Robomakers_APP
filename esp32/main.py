# main.py — LMS-ESP32 쪽 예제 (로보메이커스 워드블럭 예제 「ESP32(PUPRemote): 채널 값 화면에 보이기」 짝)
#
# 1) 이 파일과 lpf2.py, pupremote.py 를 LMS-ESP32 에 복사합니다 (Thonny 또는 ViperIDE).
#    Pybricks 4.x 허브는 lpf2.py 2.1 이상이 필요합니다. 펌웨어에 든 옛 버전보다 복사한 파일이 먼저 쓰입니다.
# 2) ESP32 를 허브 포트에 꽂고 ESP32 리셋(또는 Ctrl+D) → 2~3초 뒤 허브에서 프로그램을 실행합니다.
#
# 허브의 「ESP32 채널 등록」 블록과 이름·형식·순서가 같아야 합니다.
# power=True 일 때 이름은 5글자 이하(영문)입니다.

import lpf2
from pupremote import PUPRemoteSensor
from time import ticks_ms

print("lpf2", lpf2.__version__)

p = PUPRemoteSensor(power=True)
p.add_channel("line", "hhb")      # 허브: ESP32 채널 line 형식 hhb 등록

while True:
    t = ticks_ms() // 100
    # TODO: 실제 센서 값으로 바꾸세요. 지금은 0.1초마다 1씩 늘어나는 숫자를 보냅니다.
    p.update_channel("line", t % 1000, -(t % 1000), t % 2)
    p.process()

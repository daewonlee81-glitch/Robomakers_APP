# rm_husky.py — HuskyLens (husky_spike_esp32 브리지) 를 Pybricks 에서 읽기
#
# https://github.com/daewonlee81-glitch/husky_spike_esp32
# ESP32 가 SPIKE 색 센서로 위장해서 값을 보냅니다.
#   mode0 (COLOR)  = 감지된 ID  (라인 추적이면 1/0)
#   mode5 (RGB I)  = [v1, v2, v3, v4]
#     블록형(색·물체·얼굴·태그): v1=중심X(0~320) v2=중심Y(0~240) v3=가로폭W
#     화살표형(라인 추적):        v1=시작X      v2=끝X        v3=끝Y
#
# ESP32 펌웨어의 mode5 4번째 값(v4)에 ID 를 넣어 두면(권장)
# 모드 전환 없이 한 번에 읽어 더 빠릅니다. 0 이면 mode0 을 따로 읽습니다.

from pybricks.iodevices import PUPDevice
from pybricks.tools import StopWatch

_lenses = {}


class HuskyLens:
    def __init__(self, port, interval=30):
        self.dev = PUPDevice(port)
        self.interval = interval
        self._clock = StopWatch()
        self._last = -1000
        self._v = (0, 0, 0)
        self._id = 0

    def update(self):
        now = self._clock.time()
        if now - self._last < self.interval:
            return
        self._last = now
        r = self.dev.read(5)
        self._v = (r[0], r[1], r[2])
        if len(r) > 3 and r[3] > 0:
            self._id = r[3]
        else:
            self._id = self.dev.read(0)[0]

    # 블록형
    def id(self):
        self.update()
        return self._id

    def detected(self, target=0):
        """무언가 보이면 True. target 을 주면 그 ID 일 때만 True."""
        i = self.id()
        return i > 0 if target == 0 else i == target

    def x(self):
        self.update()
        return self._v[0]

    def y(self):
        self.update()
        return self._v[1]

    def width(self):
        self.update()
        return self._v[2]

    # 화살표형 (라인 추적)
    def line_start_x(self):
        return self.x()

    def line_end_x(self):
        return self.y()

    def line_end_y(self):
        return self.width()

    def offset(self, center=160):
        """화면 중앙에서 벗어난 정도 (왼쪽 -, 오른쪽 +)."""
        return self.x() - center


def lens(port):
    """포트별로 HuskyLens 를 하나만 만들어 돌려줍니다."""
    k = str(port)
    if k not in _lenses:
        _lenses[k] = HuskyLens(port)
    return _lenses[k]

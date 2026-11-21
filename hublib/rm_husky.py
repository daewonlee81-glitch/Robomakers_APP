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
#
# 새 펌웨어(2026-11~)는 mode7 "HLALL" 이 있어 이것 하나만 읽습니다:
#   [0] 종류(1 블록 · 2 화살표) + 전체 개수×4,  [1..15] 대상 3개 × (ID, a/2, b/2, c/2, d/2)
#   블록 a,b,c,d = 중심X, 중심Y, 가로W, 세로H · 화살표 = 시작X, 시작Y, 끝X, 끝Y
#   → 여러 대상 · 세로 길이 · 보이는 개수를 쓸 수 있고, 모니터는 "@HK2:포트,종류,개수,ID,a,b,c,d,..." 로 그립니다.

#
# 허스키렌즈 모니터: 웹 에디터의 「허스키렌즈」 탭이 열려 있으면(stdin 'M' 프레임)
# 읽은 값을 0.1초마다 "@HK:포트,ID,v1,v2,v3" 줄로 출력합니다. 에디터는 이 줄을 터미널에서 숨기고 그림으로 보여 줍니다.

from pybricks.iodevices import PUPDevice
from pybricks.tools import StopWatch, wait
import rm_link

_lenses = {}


def _connect(port, ms=4000):
    """브리지(ESP32)가 켜지고 허브와 인사할 때까지 최대 ms 기다립니다."""
    sw = StopWatch()
    while True:
        try:
            return PUPDevice(port)
        except OSError:
            if sw.time() >= ms:
                print("HuskyLens?", port)
                raise
        wait(200)


class HuskyLens:
    def __init__(self, port, interval=30):
        self.dev = _connect(port)
        self.port = str(port)[-1]
        self.interval = interval
        self._clock = StopWatch()
        self._last = -1000
        self._mon = -1000
        self._v = (0, 0, 0)
        self._id = 0
        self._h = 0
        self._kind = 0
        self._count = 0
        self._objs = ()
        # 새 펌웨어인지: mode7 을 읽어 봅니다 (옛 펌웨어는 모드가 7개라 ValueError)
        try:
            self.multi = len(self.dev.read(7)) == 16
        except Exception:
            self.multi = False

    def update(self):
        now = self._clock.time()
        if now - self._last < self.interval:
            return
        self._last = now
        if self.multi:
            r = self.dev.read(7)
            self._kind = r[0] & 3
            self._count = (r[0] & 0xFF) >> 2
            objs = []
            for j in (1, 6, 11):
                i = r[j] & 0xFF
                if i:
                    objs.append((i, (r[j + 1] & 0xFF) * 2, (r[j + 2] & 0xFF) * 2, (r[j + 3] & 0xFF) * 2, (r[j + 4] & 0xFF) * 2))
            self._objs = objs
            if objs:
                o = objs[0]
                self._id = o[0]
                # 블록: X, Y, W (세로 H 는 따로) · 화살표: 시작X, 끝X, 끝Y (옛 값과 같은 자리)
                self._v = (o[1], o[2], o[3]) if self._kind == 1 else (o[1], o[3], o[4])
                self._h = o[4] if self._kind == 1 else 0
            else:
                self._id = 0
                self._v = (0, 0, 0)
                self._h = 0
            self.monitor()
            return
        r = self.dev.read(5)
        self._v = (r[0], r[1], r[2])
        if len(r) > 3 and r[3] > 0:
            self._id = r[3]
        else:
            self._id = self.dev.read(0)[0]
        self.monitor()

    def monitor(self, force=False):
        """에디터의 허스키렌즈 탭으로 값 보내기 (탭이 열려 있을 때만, 0.1초마다)."""
        now = self._clock.time()
        if now - self._mon >= 100 and (force or rm_link.fresh("M")):
            self._mon = now
            if self.multi:
                s = "@HK2:%s,%d,%d" % (self.port, self._kind, self._count)
                for o in self._objs:
                    s += ",%d,%d,%d,%d,%d" % o
                print(s)
                return
            v = self._v
            print("@HK:%s,%d,%d,%d,%d" % (self.port, self._id, v[0], v[1], v[2]))

    # 블록형
    def id(self):
        self.update()
        return self._id

    def detected(self, target=0):
        """무언가 보이면 True. target 을 주면 그 ID 일 때만 True."""
        i = self.id()
        if target == 0:
            return i > 0
        if self.multi:  # 보이는 대상 3개 중 하나라도
            for o in self._objs:
                if o[0] == target:
                    return True
            return False
        return i == target

    def x(self):
        self.update()
        return self._v[0]

    def y(self):
        self.update()
        return self._v[1]

    def width(self):
        self.update()
        return self._v[2]

    def height(self):
        """세로 길이 (새 펌웨어만 · 옛 펌웨어는 가로와 같은 값으로 어림)."""
        self.update()
        return self._h if self.multi else self._v[2]

    def count(self):
        """화면에 보이는 대상 수 (옛 펌웨어는 0 또는 1)."""
        self.update()
        if self.multi:
            return self._count
        return 1 if self._id > 0 else 0

    def of_id(self, target, what):
        """ID 가 target 인 대상의 값 (what 0 X · 1 Y · 2 가로 · 3 세로). 없으면 -1.
        새 펌웨어는 앞의 3개 중에서 찾습니다."""
        self.update()
        objs = self._objs if self.multi else ((self._id, self._v[0], self._v[1], self._v[2], self._v[2]),)
        for o in objs:
            if o[0] == target:
                return o[1 + what]
        return -1

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

# rm_esp32.py — 안톤 마인드스톰(Anton's Mindstorms) LMS-ESP32 연결 클래스
#
# PUPRemote(pupremote_hub, GPL · AntonsMindstorms.com) 를 감싸
# 여러 포트에 ESP32 를 붙여 쓸 수 있게 합니다.
#
# ESP32 쪽(MicroPython)에서 정의한 채널/명령과 같은 이름·형식을 허브 쪽에도 등록합니다.
#   ESP32:  pr = PUPRemoteSensor(power=True); pr.add_channel('line', 'hhb')
#   허브:   esp = ESP32(Port.A); esp.add_channel('line', 'hhb'); esp.value('line', 0)

from pybricks.iodevices import PUPDevice
from pybricks.tools import wait, StopWatch
from pupremote_hub import PUPRemoteHub

_boards = {}


def wait_device(port, ms=8000):
    """ESP32 가 허브와 연결(LPF2 인사)될 때까지 기다립니다. ms 안에 안 되면 OSError."""
    sw = StopWatch()
    while True:
        try:
            PUPDevice(port)
            return
        except OSError:
            if sw.time() >= ms:
                print("ESP32?", port)
                raise
        wait(200)


# I/O 명령 (ESP32 쪽 main.py 의 「RoboMakers I/O」 부분과 같은 순서·형식)
IO_CMDS = (
    ("pmode", "", "BB"),    # 핀 모드: 0 출력 1 입력 2 입력+풀업 3 입력+풀다운 4 아날로그 5 PWM 6 서보 / (255,255) 초기화
    ("inp", "8H", ""),      # 입력 핀 8개까지 값 (pmode 로 정한 순서)
    ("dout", "", "BB"),     # 디지털 출력 (핀, 0/1)
    ("pwm", "", "BB"),      # PWM (핀, 0~100%)
    ("servo", "", "BB"),    # 서보 (핀, 0~180도)
    ("npx", "", "6B"),      # 네오픽셀 (명령, a, b, c, d, 보이기)
)
OUT, IN, IN_UP, IN_DOWN, ANALOG, PWM, SERVO = range(7)


class ESP32:
    def __init__(self, port, io=False):
        wait_device(port)
        self.pr = PUPRemoteHub(port)
        self._last = {}
        self._io = io
        if io:
            for name, to_hub, from_hub in IO_CMDS:
                self.pr.add_command(name, to_hub_fmt=to_hub, from_hub_fmt=from_hub)
            self._mode = {}
            self._slot = {}
            self.pr.call("pmode", 255, 255)  # ESP32 쪽 핀·네오픽셀 초기화

    # ---------- I/O 핀 ----------
    def _set_mode(self, pin, mode):
        pin = int(pin)
        if self._mode.get(pin) != mode:
            self.pr.call("pmode", pin, mode)
            self._mode[pin] = mode
            if mode in (IN, IN_UP, IN_DOWN, ANALOG) and pin not in self._slot and len(self._slot) < 8:
                self._slot[pin] = len(self._slot)
        return pin

    def digital_write(self, pin, on):
        pin = self._set_mode(pin, OUT)
        self.pr.call("dout", pin, 1 if on else 0)

    def _read(self, pin, mode):
        pin = self._set_mode(pin, mode)
        s = self._slot.get(pin)
        if s is None:
            return 0
        return self.pr.call("inp")[s]

    def digital_read(self, pin, pull=IN_UP):
        return self._read(pin, pull) > 0

    def analog_read(self, pin):
        return self._read(pin, ANALOG)

    def pwm(self, pin, percent):
        pin = self._set_mode(pin, PWM)
        self.pr.call("pwm", pin, max(0, min(100, int(percent))))

    def servo(self, pin, angle):
        pin = self._set_mode(pin, SERVO)
        self.pr.call("servo", pin, max(0, min(180, int(angle))))

    # ---------- 네오픽셀 (번호는 1부터) ----------
    def neopixel_init(self, pin, count):
        self.pr.call("npx", 0, int(pin), max(1, min(255, int(count))), 0, 0, 1)

    def neopixel_set(self, n, r, g, b, show=True):
        c = lambda v: max(0, min(255, int(v)))
        self.pr.call("npx", 1, max(0, int(n) - 1) & 255, c(r), c(g), c(b), 1 if show else 0)

    def neopixel_fill(self, r, g, b):
        c = lambda v: max(0, min(255, int(v)))
        self.pr.call("npx", 2, c(r), c(g), c(b), 0, 1)

    def neopixel_show(self):
        self.pr.call("npx", 3, 0, 0, 0, 0, 1)

    def add_channel(self, name, fmt):
        """ESP32 → 허브 로 값을 계속 보내는 채널."""
        self.pr.add_channel(name, fmt)

    def add_command(self, name, to_hub="", from_hub=""):
        """허브가 ESP32 의 함수를 호출하는 명령 (to_hub: 돌려받는 형식, from_hub: 보내는 형식)."""
        self.pr.add_command(name, to_hub_fmt=to_hub, from_hub_fmt=from_hub)

    def call(self, name, *args):
        r = self.pr.call(name, *args)
        self._last[name] = r if isinstance(r, tuple) else (r,)
        return r

    def value(self, name, index=0):
        """채널/명령을 읽고 index 번째 값을 돌려줍니다."""
        r = self.call(name)
        if isinstance(r, tuple):
            return r[index] if index < len(r) else 0
        return r if index == 0 else 0


def board(port):
    k = str(port)
    if k not in _boards:
        _boards[k] = ESP32(port)
    return _boards[k]

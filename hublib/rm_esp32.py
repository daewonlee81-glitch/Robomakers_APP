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
import rm_link

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

# I2C 센서·화면 명령 (ESP32 쪽이 이 명령을 알 때만 등록 — 옛 ESP32 main.py 와도 핀 블록은 그대로 동작)
SENS_CMDS = (
    ("sinit", "", "BBB"),   # 장치 켜기 (종류, SDA, SCL · 255 = 보드 Grove 단자)
    ("sget", "7H", ""),     # 값 (빨강, 초록, 파랑, 밝기, 거리mm, 음성 순번<<8|번호, 상태)
    ("sset", "", "BBB"),    # 설정 (종류, 항목, 값)
    ("otxt", "", "BB14s"),  # OLED 글자 (줄|크기-1<<4, 칸, 글자)
)
S_OLED, S_VOICE, S_COLOR, S_TOF, S_OLED32 = 1, 2, 3, 4, 5
# 추가 센서 (ESP32 쪽에 sget2 명령이 있을 때만)
SENS2_CMDS = (("sget2", "8h", ""), ("sget3", "8h", ""))
S_SONAR, S_DHT11, S_DHT22, S_IMU, S_LUX, S_ENV = 6, 7, 8, 9, 10, 11
_S2_NAME = ("ultrasonic sensor", "DHT sensor", "DHT sensor", "MPU6050", "BH1750", "BME280")
_TOF_CHIP = ("?", "VL6180X", "VL53L0X", "VL53L1X")
_S_NAME = ("", "OLED", "voice sensor", "color sensor", "laser distance sensor", "OLED")


class ESP32:
    def __init__(self, port, io=False):
        wait_device(port)
        self.pr = PUPRemoteHub(port)
        self._last = {}
        self._io = io
        self._sens = False
        self._sens2 = False
        self._sarg = {}
        self._v2 = (4000, 0, 0, 0, 0, 0, 0, 0)
        self._v3 = (0,) * 8
        self._t2 = -1000
        self._son = {}
        self._sv = (0,) * 7
        self._st = -1000
        self._vseq = None
        self._vev = 0
        self._vev_t = 0
        self._sw = StopWatch()
        self._pn = str(port)[-1]
        self._mon = -1000
        if io:
            for name, to_hub, from_hub in IO_CMDS:
                self.pr.add_command(name, to_hub_fmt=to_hub, from_hub_fmt=from_hub)
            self._mode = {}
            self._slot = {}
            self._servo_at = {}
            self.pr.call("pmode", 255, 255)  # ESP32 쪽 핀·네오픽셀 초기화
            modes = self.pr.pup_device.info()["modes"]
            n = len(IO_CMDS)
            self._sens = len(modes) > n and modes[n][0].rstrip() == "sinit"
            if self._sens:
                for name, to_hub, from_hub in SENS_CMDS:
                    self.pr.add_command(name, to_hub_fmt=to_hub, from_hub_fmt=from_hub)
                n += len(SENS_CMDS)
                self._sens2 = len(modes) > n and modes[n][0].rstrip() == "sget2"
                if self._sens2:
                    for name, to_hub, from_hub in SENS2_CMDS:
                        self.pr.add_command(name, to_hub_fmt=to_hub, from_hub_fmt=from_hub)

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

    # 서보는 명령만 보내면 바로 다음 줄로 넘어가므로, 움직일 시간만큼 기다립니다.
    # 약 0.2초 / 60° (부하가 있는 SG90 기준). 처음 움직일 때는 위치를 모르니 0.5초.
    # 기다리지 않으려면 servo(핀, 각도, False)
    SERVO_MS_PER_DEG = 10 / 3
    SERVO_FIRST_MS = 500

    def servo(self, pin, angle, wait_move=True):
        pin = self._set_mode(pin, SERVO)
        a = max(0, min(180, int(angle)))
        self.pr.call("servo", pin, a)
        prev = self._servo_at.get(pin)
        self._servo_at[pin] = a
        if wait_move:
            ms = self.SERVO_FIRST_MS if prev is None else int(abs(a - prev) * self.SERVO_MS_PER_DEG)
            if ms > 0:
                wait(ms + 20)

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

    # ---------- I2C 센서·화면 ----------
    def sensor_setup(self, kind, sda=255, scl=255, wait_ready=True):
        """I2C 장치를 켭니다. sda/scl 을 주지 않으면 ESP32 보드의 Grove I2C 단자."""
        if not self._io or not self._sens:
            print("ESP32 main.py is old: download the ESP32 files again for sensor blocks")
            raise OSError("ESP32 main.py has no sensor commands")
        slot = S_OLED if kind == S_OLED32 else S_DHT11 if kind == S_DHT22 else kind
        if kind >= S_SONAR and not self._sens2:
            print("ESP32 main.py is old: download the ESP32 files again for this sensor")
            raise OSError("ESP32 main.py has no sget2 command")
        self.pr.call("sinit", kind, sda & 255, scl & 255)
        self._son[slot] = 0
        if not wait_ready:
            return
        sw = StopWatch()
        if slot >= S_SONAR:
            bit = 1 << (slot - 6)
            while sw.time() < 3000:
                v3 = self._sget2(True)[1]
                if v3[6] & bit:
                    self._son[slot] = 1
                    return
                if v3[7] & bit:
                    break
                wait(20)
            print("ESP32: no", _S2_NAME[slot - 6], "- check wiring and pins")
            raise OSError("ESP32 sensor not found")
        bit, err = 1 << slot, 1 << (slot + 11)
        while sw.time() < 3000:
            st = self._sget(True)[6]
            if st & bit:
                self._son[slot] = 1
                if slot == S_TOF:
                    print("ESP32 ToF:", _TOF_CHIP[(st >> 8) & 3])
                return
            if st & err:
                break
            wait(20)
        print("ESP32: no", _S_NAME[slot], "- check SDA/SCL wiring and power")
        raise OSError("ESP32 I2C device not found")

    def _need(self, kind):
        if kind not in self._son:
            self.sensor_setup(kind)

    def _sget(self, fresh=False):
        # 한 반복 안에서 여러 블록이 값을 읽어도 블루투스·포트를 덜 쓰도록 15 ms 동안은 같은 값
        t = self._sw.time()
        if fresh or t - self._st >= 15:
            self._sv = self.pr.call("sget")
            self._st = t
            self.monitor()
            v = self._sv[5]
            seq = v >> 8
            if self._vseq is None:
                self._vseq = seq  # 프로그램 시작 전에 들은 명령은 무시
            elif seq != self._vseq:
                self._vseq = seq
                self._vev = v & 255
                self._vev_t = t
        return self._sv

    def _sget2(self, fresh=False):
        t = self._sw.time()
        if fresh or t - self._t2 >= 15:
            self._v2 = self.pr.call("sget2")
            self._v3 = self.pr.call("sget3")
            self._t2 = t
            self.monitor()
        return self._v2, self._v3

    def _need2(self, kind, a=255, b=255):
        # 같은 자리에 다른 핀·종류(DHT11 ↔ DHT22)를 쓰면 다시 켭니다
        slot = S_DHT11 if kind == S_DHT22 else kind
        if slot in self._son and (a == 255 or self._sarg.get(slot) == (kind, a, b)):
            return  # I2C 센서(핀 255)는 「센서 켜기」 블록에서 정한 핀을 그대로 씁니다
        self._sarg[slot] = (kind, a, b)
        self.sensor_setup(kind, a, b)

    # 초음파 HC-SR04
    def ultrasonic_cm(self, trig, echo):
        """거리 cm (재지 못하면 400). 에코 핀은 5V 이므로 분압 저항 또는 3.3V 용(HC-SR04P)을 쓰세요."""
        self._need2(S_SONAR, int(trig), int(echo))
        return self._sget2()[0][0] / 10

    # DHT11 / DHT22
    def dht(self, kind, pin, what):
        """what 0 온도 °C · 1 습도 % (2초마다 새 값)"""
        self._need2(int(kind), int(pin), 0)
        return self._sget2()[0][1 + int(what)] / 10

    # MPU6050
    def imu(self, what):
        """what 0 기울기 X° · 1 기울기 Y° · 2 회전 속도 Z °/s · 3 가속도 X g · 4 가속도 Y g · 5 가속도 Z g"""
        self._need2(S_IMU)
        v2, v3 = self._sget2()
        w = int(what)
        if w == 0:
            return v2[3] / 10
        if w == 1:
            return v2[4] / 10
        if w == 2:
            return v2[5]
        return (v3[3], v3[4], v2[7])[w - 3] / 100

    # BH1750
    def lux(self):
        self._need2(S_LUX)
        return self._sget2()[0][6]

    # BME280
    def env(self, what):
        """what 0 온도 °C · 1 습도 % · 2 기압 hPa · 3 고도 m (해수면 1013.25 hPa 기준)"""
        self._need2(S_ENV)
        v3 = self._sget2()[1]
        w = int(what)
        if w == 3:
            p = v3[2] / 10
            return round(44330 * (1 - (p / 1013.25) ** 0.1903), 1) if p > 0 else 0
        return v3[w] / 10

    # 아날로그·디지털 센서 (기존 핀 블록에 이름만 붙인 것)
    def analog_pct(self, pin):
        return round(self.analog_read(pin) * 100 / 4095)

    def detect(self, pin, kind):
        """kind 0 인체 감지(PIR) · 1 터치 · 2 버튼(누르면 GND) · 3 기울기 스위치 · 4 빛 감지(어두우면 1) → 감지되면 True"""
        k = int(kind)
        if k in (2, 3):
            return not self.digital_read(pin, IN_UP)
        return self.digital_read(pin, IN)

    def monitor(self, force=False):
        """웹 에디터 「상태」 탭이 열려 있으면(stdin 'E' 프레임) 0.2초마다 "@ES:포트,빨강,초록,파랑,밝기,거리,음성,상태" 출력"""
        t = self._sw.time()
        if t - self._mon >= 200 and (force or rm_link.fresh("E")):
            self._mon = t
            print("@ES:%s,%d,%d,%d,%d,%d,%d,%d" % ((self._pn,) + tuple(self._sv)))
            if self._sens2 and self._v3[6]:
                print("@ES2:%s,%d,%d,%d,%d,%d,%d,%d,%d,%d,%d,%d,%d,%d,%d,%d,%d" % ((self._pn,) + tuple(self._v2) + tuple(self._v3)))

    # OLED
    def oled_clear(self):
        self._need(S_OLED)
        self.pr.call("sset", S_OLED, 0, 0)

    def oled_text(self, row, text, size=1):
        """row 번째 줄(1부터)에 글자. size 2·3 은 크게 (한 줄에 16/size 자). 영문·숫자만."""
        self._need(S_OLED)
        if isinstance(text, float):
            text = ("%.2f" % text).rstrip("0").rstrip(".")
        s = "".join(c if 32 <= ord(c) < 127 else "?" for c in str(text))
        size = max(1, min(3, int(size)))
        width = 16 // size
        s = (s + " " * width)[:width]  # 줄의 남은 칸은 지움
        row = max(0, min(7, int(row) - 1))
        step = 14 // size
        for i in range(0, width, step):
            part = s[i:i + step]
            self.pr.call("otxt", row | ((size - 1) << 4), i * size, part.encode())

    # 음성 인식
    def voice_id(self):
        """새로 알아들은 명령 번호 (없으면 0). 한 번 읽으면 지워집니다."""
        self._need(S_VOICE)
        self._sget()
        n = self._vev
        self._vev = 0
        return n

    def voice_heard(self, n):
        """명령 n 을 새로 알아들었으면 True (그 명령은 지워짐). 다른 명령은 1초 동안 남겨 둠."""
        self._need(S_VOICE)
        self._sget()
        if self._vev and self._sw.time() - self._vev_t > 1000:
            self._vev = 0
        if self._vev and self._vev == int(n):
            self._vev = 0
            return True
        return False

    def voice_set(self, what, value):
        """what 0 음량(1~7) · 1 음소거(1/0) · 2 깨어 있는 시간(초) · 3 대답 소리 재생(명령 번호)"""
        self._need(S_VOICE)
        self.pr.call("sset", S_VOICE, int(what), max(0, min(255, int(value))))

    # 컬러
    def color_raw(self):
        self._need(S_COLOR)
        return self._sget()[:4]

    def color_rgb(self, i):
        """i 0 빨강 · 1 초록 · 2 파랑 (0~255) · 3 밝기(0~100)"""
        r, g, b, c = self.color_raw()
        if i == 3:
            return min(100, c * 100 // 21504)
        m = max(r, g, b, 1)
        return (r, g, b)[i] * 255 // m if c > 40 else 0

    def color_name(self):
        """'BLACK' 'WHITE' 'RED' 'YELLOW' 'GREEN' 'BLUE' (아무것도 없으면 'NONE')"""
        r, g, b, c = self.color_raw()
        if c < 40:
            return "NONE"
        mx, mn = max(r, g, b), min(r, g, b)
        bright = c * 100 // 21504
        sat = (mx - mn) * 100 // max(mx, 1)
        if sat < 18:
            return "WHITE" if bright > 25 else "BLACK"
        if bright < 4:
            return "BLACK"
        d = mx - mn
        if mx == r:
            h = (60 * (g - b) // d) % 360
        elif mx == g:
            h = 60 * (b - r) // d + 120
        else:
            h = 60 * (r - g) // d + 240
        if h < 25 or h >= 320:
            return "RED"
        if h < 75:
            return "YELLOW"
        if h < 170:
            return "GREEN"
        return "BLUE"

    def color_is(self, name):
        return self.color_name() == name

    # 레이저 거리
    def tof_mm(self):
        """레이저 거리(mm). 아무것도 없으면 칩의 최대 거리 (0.5 m · 2 m · 4 m 형)."""
        self._need(S_TOF)
        return self._sget()[4]

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

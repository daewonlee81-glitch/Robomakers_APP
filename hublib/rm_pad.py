# rm_pad.py — 엑스박스 / PS 계열 조종기 통합 클래스
#
#   Gamepad("xbox")            허브가 Xbox 무선 컨트롤러에 직접 BLE 연결
#                              (SPIKE Prime · Essential, Pybricks XboxController)
#   Gamepad("web")             PC/태블릿에 연결한 Xbox·PS 패드를 웹 에디터가 중계
#                              (모든 허브, EV3 포함 — 에디터가 연결된 동안)
#   Gamepad("esp32", Port.A)   LMS-ESP32 BluePad32 LPF2 펌웨어 (PS4/PS5/Xbox/스위치)
#
# 공통 값
#   stick("LX"|"LY"|"RX"|"RY")  -100 ~ 100  (오른쪽 / 위가 +)
#   trigger("L"|"R")            0 ~ 100
#   pressed("A")                True / False
#     버튼 이름: A B X Y LB RB VIEW MENU LJ RJ UP DOWN LEFT RIGHT
#     PS 패드:   A=✕  B=○  X=□  Y=△  LB=L1  RB=R1  VIEW=SHARE  MENU=OPTIONS

import rm_link

_BITS = {
    "A": 0, "B": 1, "X": 2, "Y": 3, "LB": 4, "RB": 5,
    "VIEW": 6, "MENU": 7, "LJ": 8, "RJ": 9,
    "UP": 10, "DOWN": 11, "LEFT": 12, "RIGHT": 13, "GUIDE": 14,
}

# Pybricks XboxController.dpad(): 0=없음 1=위 2=오른쪽위 ... 8=왼쪽위
_DPAD = {
    "UP": (1, 2, 8), "RIGHT": (2, 3, 4),
    "DOWN": (4, 5, 6), "LEFT": (6, 7, 8),
}


def _clamp(v):
    return -100 if v < -100 else 100 if v > 100 else int(v)


class Gamepad:
    def __init__(self, source="web", port=None):
        self.source = source
        self._xbox = None
        self._bp = None
        if source == "xbox":
            from pybricks.iodevices import XboxController
            self._xbox = XboxController()
            from pybricks.parameters import Button
            self._btn = {
                "A": Button.A, "B": Button.B, "X": Button.X, "Y": Button.Y,
                "LB": Button.LB, "RB": Button.RB, "VIEW": Button.VIEW,
                "MENU": Button.MENU, "LJ": Button.LJ, "RJ": Button.RJ,
                "GUIDE": Button.GUIDE,
            }
        elif source == "esp32":
            from bluepad import BluePad
            from pybricks.iodevices import PUPDevice
            from pybricks.tools import wait, StopWatch
            sw = StopWatch()
            while True:  # ESP32 가 켜지고 허브와 인사할 때까지 최대 4초
                try:
                    PUPDevice(port)
                    break
                except OSError:
                    if sw.time() >= 4000:
                        print("ESP32?", port)
                        raise
                wait(200)
            self._bp = BluePad(port)

    # ---------- 내부: 원시 값 ----------
    def _raw(self):
        """(LX, LY, RX, RY, LT, RT, 버튼비트, 방향키) 를 공통 형식으로."""
        if self._xbox:
            lx, ly = self._xbox.joystick_left()
            rx, ry = self._xbox.joystick_right()
            lt, rt = self._xbox.triggers()
            return (lx, ly, rx, ry, lt, rt, None, self._xbox.dpad())
        if self._bp:
            v = self._bp.gamepad()
            # BluePad32: 축 -128~127 (아래가 +), 버튼 bit0=A bit1=B bit2=X bit3=Y
            # bit4=L1 bit5=R1 bit6=L2 bit7=R2 / 방향키 bit0=위 bit1=아래 bit2=오른쪽 bit3=왼쪽
            btn, dp = v[4], v[5]
            bits = btn & 0x3F
            if dp & 1:
                bits |= 1 << 10
            if dp & 2:
                bits |= 1 << 11
            if dp & 8:
                bits |= 1 << 12
            if dp & 4:
                bits |= 1 << 13
            lt = 100 if btn & 0x40 else 0
            rt = 100 if btn & 0x80 else 0
            return (_clamp(v[0] * 100 // 128), _clamp(-v[1] * 100 // 128),
                    _clamp(v[2] * 100 // 128), _clamp(-v[3] * 100 // 128),
                    lt, rt, bits, 0)
        g = rm_link.values("G")
        if len(g) < 8:
            return (0, 0, 0, 0, 0, 0, 0, 0)
        return tuple(g[:8])

    # ---------- 공통 API ----------
    def connected(self):
        if self._xbox or self._bp:
            return True
        return rm_link.fresh("G")

    def stick(self, axis):
        i = {"LX": 0, "LY": 1, "RX": 2, "RY": 3}[axis]
        return self._raw()[i]

    def trigger(self, side):
        return self._raw()[4 if side == "L" else 5]

    def pressed(self, name):
        if self._xbox:
            if name in _DPAD:
                return self._xbox.dpad() in _DPAD[name]
            return self._btn[name] in self._xbox.buttons.pressed()
        bits = self._raw()[6]
        return bool(bits & (1 << _BITS[name]))

    def rumble(self, power=50, duration=200):
        """Xbox 직접 연결일 때만 진동합니다."""
        if self._xbox:
            self._xbox.rumble(power, duration)

    def tank(self):
        """왼쪽 스틱으로 (왼쪽 바퀴, 오른쪽 바퀴) 속도 -100~100 계산."""
        y = self.stick("LY")
        x = self.stick("LX")
        return (_clamp(y + x), _clamp(y - x))

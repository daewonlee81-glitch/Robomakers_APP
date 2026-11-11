# rm_vl53.py — 레이저 거리 센서(ToF) 드라이버: VL6180X(TOF050C) · VL53L0X(TOF200C) · VL53L1X(TOF400C)
#
# 로보메이커스 워드블럭 「ESP32 레이저 거리」 블록용. LMS-ESP32 에 main.py 와 함께 복사합니다.
# open(i2c) 가 연결된 칩을 알아내 알맞은 드라이버를 돌려줍니다. 모두 「연속 측정」으로 켜 두고
# poll() 이 새 값이 있을 때만 거리(mm)를 돌려줍니다(없으면 None · 기다리지 않음).
#
# Adafruit CircuitPython VL53L0X · VL53L1X · VL6180X 드라이버(MIT, Tony DiCola · Carter Nelson /
# Adafruit Industries; VL53L0X 는 Pololu vl53l0x-arduino 를 옮긴 것)를 MicroPython machine.I2C 용으로 줄여 옮겼습니다.

from time import sleep_ms, ticks_ms, ticks_diff
from micropython import const

ADDR = const(0x29)
NONE, VL6180X, VL53L0X, VL53L1X = 0, 1, 2, 3
MAX_MM = {VL6180X: 255, VL53L0X: 2000, VL53L1X: 4000}  # 아무것도 없을 때 돌려줄 값(칩마다 최대 거리)


class _Bus16:
    """레지스터 주소가 16비트인 칩 (VL6180X · VL53L1X)"""

    def __init__(self, i2c):
        self.i2c = i2c

    def wb(self, reg, data):
        self.i2c.writeto(ADDR, bytes([reg >> 8, reg & 0xFF]) + bytes(data))

    def w8(self, reg, v):
        self.wb(reg, (v & 0xFF,))

    def rb(self, reg, n=1):
        self.i2c.writeto(ADDR, bytes([reg >> 8, reg & 0xFF]))
        return self.i2c.readfrom(ADDR, n)

    def r8(self, reg):
        return self.rb(reg, 1)[0]

    def r16(self, reg):
        b = self.rb(reg, 2)
        return (b[0] << 8) | b[1]


class _Bus8:
    """레지스터 주소가 8비트인 칩 (VL53L0X)"""

    def __init__(self, i2c):
        self.i2c = i2c

    def w8(self, reg, v):
        self.i2c.writeto(ADDR, bytes((reg, v & 0xFF)))

    def w16(self, reg, v):
        self.i2c.writeto(ADDR, bytes((reg, (v >> 8) & 0xFF, v & 0xFF)))

    def wb(self, reg, data):
        self.i2c.writeto(ADDR, bytes([reg]) + bytes(data))

    def rb(self, reg, n=1):
        self.i2c.writeto(ADDR, bytes((reg,)))
        return self.i2c.readfrom(ADDR, n)

    def r8(self, reg):
        return self.rb(reg, 1)[0]

    def r16(self, reg):
        b = self.rb(reg, 2)
        return (b[0] << 8) | b[1]

    def wpairs(self, pairs):
        for r, v in pairs:
            self.w8(r, v)


def _wait(cond, ms=500):
    t = ticks_ms()
    while not cond():
        if ticks_diff(ticks_ms(), t) > ms:
            raise OSError("VL53 timeout")
        sleep_ms(1)


# ───────────────────────── VL6180X (TOF050C · 약 0.5 m까지) ─────────────────────────
_V6_SETTINGS = (
    (0x0207, 0x01), (0x0208, 0x01), (0x0096, 0x00), (0x0097, 0xFD), (0x00E3, 0x00), (0x00E4, 0x04),
    (0x00E5, 0x02), (0x00E6, 0x01), (0x00E7, 0x03), (0x00F5, 0x02), (0x00D9, 0x05), (0x00DB, 0xCE),
    (0x00DC, 0x03), (0x00DD, 0xF8), (0x009F, 0x00), (0x00A3, 0x3C), (0x00B7, 0x00), (0x00BB, 0x3C),
    (0x00B2, 0x09), (0x00CA, 0x09), (0x0198, 0x01), (0x01B0, 0x17), (0x01AD, 0x00), (0x00FF, 0x05),
    (0x0100, 0x05), (0x0199, 0x05), (0x01A6, 0x1B), (0x01AC, 0x3E), (0x01A7, 0x1F), (0x0030, 0x00),
    (0x0011, 0x10), (0x010A, 0x30), (0x003F, 0x46), (0x0031, 0xFF), (0x0040, 0x63), (0x002E, 0x01),
    (0x001B, 0x09), (0x003E, 0x31), (0x0014, 0x24),
)


class _VL6180X:
    chip = VL6180X

    def __init__(self, i2c):
        b = self.b = _Bus16(i2c)
        if b.r8(0x000) != 0xB4:
            raise OSError("not VL6180X")
        for r, v in _V6_SETTINGS:
            b.w8(r, v)
        b.w8(0x016, 0x00)  # FRESH_OUT_OF_RESET
        if b.r8(0x018) & 0x02:  # 이미 연속 측정 중이면 멈춤
            b.w8(0x018, 0x01)
            sleep_ms(100)
        b.w8(0x01B, 50 // 10 - 1)  # 50 ms 마다
        b.w8(0x018, 0x03)  # 연속 측정 시작

    def poll(self):
        b = self.b
        if not b.r8(0x04F) & 0x04:
            return None
        status = b.r8(0x04D) >> 4
        mm = b.r8(0x062)
        b.w8(0x015, 0x07)
        return mm if status == 0 else MAX_MM[VL6180X]


# ───────────────────────── VL53L1X (TOF400C · 약 4 m까지) ─────────────────────────
_L1_INIT = bytes((
    0x00, 0x00, 0x00, 0x01, 0x02, 0x00, 0x02, 0x08, 0x00, 0x08, 0x10, 0x01, 0x01, 0x00, 0x00, 0x00,
    0x00, 0xFF, 0x00, 0x0F, 0x00, 0x00, 0x00, 0x00, 0x00, 0x20, 0x0B, 0x00, 0x00, 0x02, 0x0A, 0x21,
    0x00, 0x00, 0x05, 0x00, 0x00, 0x00, 0x00, 0xC8, 0x00, 0x00, 0x38, 0xFF, 0x01, 0x00, 0x08, 0x00,
    0x00, 0x01, 0xCC, 0x0F, 0x01, 0xF1, 0x0D, 0x01, 0x68, 0x00, 0x80, 0x08, 0xB8, 0x00, 0x00, 0x00,
    0x00, 0x0F, 0x89, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x0F, 0x0D, 0x0E, 0x0E, 0x00,
    0x00, 0x02, 0xC7, 0xFF, 0x9B, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00,
))  # 0x2D ~ 0x87 기본 설정 (ST ULD)


class _VL53L1X:
    chip = VL53L1X

    def __init__(self, i2c):
        b = self.b = _Bus16(i2c)
        if bytes(b.rb(0x010F, 3)) != b"\xea\xcc\x10":
            raise OSError("not VL53L1X")
        b.wb(0x002D, _L1_INIT)
        self._pol = 0 if (b.r8(0x0030) & 0x10) else 1  # 인터럽트 극성
        b.w8(0x0087, 0x40)  # 한 번 재서 내부 보정
        _wait(self._ready)
        b.w8(0x0086, 0x01)
        b.w8(0x0087, 0x00)
        b.w8(0x0008, 0x09)  # VHV_CONFIG__TIMEOUT_MACROP_LOOP_BOUND
        b.w8(0x000B, 0x00)
        # 긴 거리 모드 · 측정 시간 50 ms
        b.wb(0x005E, b"\x00\xad")
        b.wb(0x0061, b"\x00\xc6")
        b.w8(0x0087, 0x40)  # 연속 측정 시작

    def _ready(self):
        return (self.b.r8(0x0031) & 0x01) == self._pol

    def poll(self):
        if not self._ready():
            return None
        b = self.b
        status = b.r8(0x0089)
        mm = b.r16(0x0096)
        b.w8(0x0086, 0x01)
        return min(mm, MAX_MM[VL53L1X]) if status == 0x09 else MAX_MM[VL53L1X]


# ───────────────────────── VL53L0X (TOF200C · 약 2 m까지) ─────────────────────────
def _decode_timeout(v):
    return (v & 0xFF) * (1 << ((v & 0xFF00) >> 8)) + 1


def _encode_timeout(mclks):
    mclks = int(mclks) & 0xFFFF
    if mclks <= 0:
        return 0
    ls, ms = mclks - 1, 0
    while ls > 255:
        ls >>= 1
        ms += 1
    return ((ms << 8) | (ls & 0xFF)) & 0xFFFF


def _mclks_to_us(mclks, vcsel):
    macro_ns = ((2304 * vcsel * 1655) + 500) // 1000
    return ((mclks * macro_ns) + (macro_ns // 2)) // 1000


def _us_to_mclks(us, vcsel):
    macro_ns = ((2304 * vcsel * 1655) + 500) // 1000
    return ((us * 1000) + (macro_ns // 2)) // macro_ns


_L0_TUNING = (
    (0xFF, 0x01), (0x00, 0x00), (0xFF, 0x00), (0x09, 0x00), (0x10, 0x00), (0x11, 0x00), (0x24, 0x01),
    (0x25, 0xFF), (0x75, 0x00), (0xFF, 0x01), (0x4E, 0x2C), (0x48, 0x00), (0x30, 0x20), (0xFF, 0x00),
    (0x30, 0x09), (0x54, 0x00), (0x31, 0x04), (0x32, 0x03), (0x40, 0x83), (0x46, 0x25), (0x60, 0x00),
    (0x27, 0x00), (0x50, 0x06), (0x51, 0x00), (0x52, 0x96), (0x56, 0x08), (0x57, 0x30), (0x61, 0x00),
    (0x62, 0x00), (0x64, 0x00), (0x65, 0x00), (0x66, 0xA0), (0xFF, 0x01), (0x22, 0x32), (0x47, 0x14),
    (0x49, 0xFF), (0x4A, 0x00), (0xFF, 0x00), (0x7A, 0x0A), (0x7B, 0x00), (0x78, 0x21), (0xFF, 0x01),
    (0x23, 0x34), (0x42, 0x00), (0x44, 0xFF), (0x45, 0x26), (0x46, 0x05), (0x40, 0x40), (0x0E, 0x06),
    (0x20, 0x1A), (0x43, 0x40), (0xFF, 0x00), (0x34, 0x03), (0x35, 0x44), (0xFF, 0x01), (0x31, 0x04),
    (0x4B, 0x09), (0x4C, 0x05), (0x4D, 0x04), (0xFF, 0x00), (0x44, 0x00), (0x45, 0x20), (0x47, 0x08),
    (0x48, 0x28), (0x67, 0x00), (0x70, 0x04), (0x71, 0x01), (0x72, 0xFE), (0x76, 0x00), (0x77, 0x00),
    (0xFF, 0x01), (0x0D, 0x01), (0xFF, 0x00), (0x80, 0x01), (0x01, 0xF8), (0xFF, 0x01), (0x8E, 0x01),
    (0x00, 0x01), (0xFF, 0x00), (0x80, 0x00),
)


class _VL53L0X:
    chip = VL53L0X

    def __init__(self, i2c):
        b = self.b = _Bus8(i2c)
        if b.r8(0xC0) != 0xEE or b.r8(0xC1) != 0xAA or b.r8(0xC2) != 0x10:
            raise OSError("not VL53L0X")
        b.wpairs(((0x88, 0x00), (0x80, 0x01), (0xFF, 0x01), (0x00, 0x00)))
        self._stop = b.r8(0x91)
        b.wpairs(((0x00, 0x01), (0xFF, 0x00), (0x80, 0x00)))
        b.w8(0x60, b.r8(0x60) | 0x12)  # MSRC_CONFIG_CONTROL
        b.w16(0x44, int(0.25 * (1 << 7)))  # 신호 세기 하한 0.25 MCPS
        b.w8(0x01, 0xFF)
        count, aperture = self._spad_info()
        spad = bytearray(b.rb(0xB0, 6))
        b.wpairs(((0xFF, 0x01), (0x4F, 0x00), (0x4E, 0x2C), (0xFF, 0x00), (0xB6, 0xB4)))
        first = 12 if aperture else 0
        on = 0
        for i in range(48):
            if i < first or on == count:
                spad[i // 8] &= ~(1 << (i % 8))
            elif (spad[i // 8] >> (i % 8)) & 1:
                on += 1
        b.wb(0xB0, spad)
        b.wpairs(_L0_TUNING)
        b.w8(0x0A, 0x04)  # SYSTEM_INTERRUPT_CONFIG_GPIO: 새 값 준비
        b.w8(0x84, b.r8(0x84) & ~0x10)  # active low
        b.w8(0x0B, 0x01)
        budget = self._budget()
        b.w8(0x01, 0xE8)
        self._set_budget(budget)
        b.w8(0x01, 0x01)
        self._ref_cal(0x40)
        b.w8(0x01, 0x02)
        self._ref_cal(0x00)
        b.w8(0x01, 0xE8)
        # 연속 측정 시작 (back-to-back)
        b.wpairs(((0x80, 0x01), (0xFF, 0x01), (0x00, 0x00), (0x91, self._stop), (0x00, 0x01), (0xFF, 0x00), (0x80, 0x00)))
        b.w8(0x00, 0x02)

    def _spad_info(self):
        b = self.b
        b.wpairs(((0x80, 0x01), (0xFF, 0x01), (0x00, 0x00), (0xFF, 0x06)))
        b.w8(0x83, b.r8(0x83) | 0x04)
        b.wpairs(((0xFF, 0x07), (0x81, 0x01), (0x80, 0x01), (0x94, 0x6B), (0x83, 0x00)))
        _wait(lambda: b.r8(0x83) != 0x00)
        b.w8(0x83, 0x01)
        tmp = b.r8(0x92)
        b.wpairs(((0x81, 0x00), (0xFF, 0x06)))
        b.w8(0x83, b.r8(0x83) & ~0x04)
        b.wpairs(((0xFF, 0x01), (0x00, 0x01), (0xFF, 0x00), (0x80, 0x00)))
        return tmp & 0x7F, bool((tmp >> 7) & 1)

    def _ref_cal(self, vhv):
        b = self.b
        b.w8(0x00, 0x01 | vhv)
        _wait(lambda: b.r8(0x13) & 0x07)
        b.w8(0x0B, 0x01)
        b.w8(0x00, 0x00)

    def _vcsel(self, reg):
        return ((self.b.r8(reg) + 1) & 0xFF) << 1

    def _steps(self):
        c = self.b.r8(0x01)
        return (c >> 4) & 1, (c >> 3) & 1, (c >> 2) & 1, (c >> 6) & 1, (c >> 7) & 1  # tcc dss msrc pre final

    def _timeouts(self, pre):
        b = self.b
        pre_v = self._vcsel(0x50)
        msrc_us = _mclks_to_us((b.r8(0x46) + 1) & 0xFF, pre_v)
        pre_mclks = _decode_timeout(b.r16(0x51))
        pre_us = _mclks_to_us(pre_mclks, pre_v)
        fin_v = self._vcsel(0x70)
        fin_mclks = _decode_timeout(b.r16(0x71))
        if pre:
            fin_mclks -= pre_mclks
        return msrc_us, pre_us, _mclks_to_us(fin_mclks, fin_v), fin_v, pre_mclks

    def _budget(self):
        us = 1910 + 960
        tcc, dss, msrc, pre, fin = self._steps()
        msrc_us, pre_us, fin_us, _, _ = self._timeouts(pre)
        if tcc:
            us += msrc_us + 590
        if dss:
            us += 2 * (msrc_us + 690)
        elif msrc:
            us += msrc_us + 660
        if pre:
            us += pre_us + 660
        if fin:
            us += fin_us + 550
        return us

    def _set_budget(self, budget):
        used = 1320 + 960
        tcc, dss, msrc, pre, fin = self._steps()
        msrc_us, pre_us, _, fin_v, pre_mclks = self._timeouts(pre)
        if tcc:
            used += msrc_us + 590
        if dss:
            used += 2 * (msrc_us + 690)
        elif msrc:
            used += msrc_us + 660
        if pre:
            used += pre_us + 660
        if fin:
            used += 550
            if used > budget:
                return
            mclks = _us_to_mclks(budget - used, fin_v)
            if pre:
                mclks += pre_mclks
            self.b.w16(0x71, _encode_timeout(mclks))

    def poll(self):
        b = self.b
        if not b.r8(0x13) & 0x07:
            return None
        mm = b.r16(0x14 + 10)
        b.w8(0x0B, 0x01)
        return MAX_MM[VL53L0X] if mm >= 8190 or mm > MAX_MM[VL53L0X] else mm


def open(i2c):
    """0x29 에 연결된 레이저 거리 칩을 알아내 드라이버를 돌려줍니다."""
    if ADDR not in i2c.scan():
        raise OSError("no ToF sensor at 0x29")
    # 16비트 주소 칩을 먼저 확인합니다. VL53L0X 에는 이 확인이 레지스터 0x00·0x01 쓰기로 보이지만
    # 두 값 모두 아래 초기화에서 다시 쓰므로 괜찮습니다 (반대 순서면 16비트 칩에 주소 반쪽만 보내게 됨).
    for cls in (_VL53L1X, _VL6180X, _VL53L0X):
        try:
            return cls(i2c)
        except OSError as e:
            if "not " not in str(e):
                raise
    raise OSError("unknown ToF chip at 0x29")

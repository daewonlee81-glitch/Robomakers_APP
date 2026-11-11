# rm_i2cdev.py — I2C 장치 드라이버: OLED 화면(SSD1306) · 오프라인 음성 인식(DFRobot DF2301Q) · 컬러 센서(TCS34725)
#
# 로보메이커스 워드블럭 「ESP32 센서」 블록용. LMS-ESP32 에 main.py 와 함께 복사합니다.
# SSD1306 은 micropython-lib ssd1306.py(MIT), DF2301Q 는 DFRobot_DF2301Q(MIT) 를 바탕으로 줄였습니다.

import framebuf
from time import sleep_ms


# ───────────────────────── OLED SSD1306 (128×64 · 128×32) ─────────────────────────
class OLED(framebuf.FrameBuffer):
    def __init__(self, i2c, height=64):
        found = i2c.scan()
        self.addr = 0x3C if 0x3C in found else 0x3D if 0x3D in found else None
        if self.addr is None:
            raise OSError("no OLED at 0x3C/0x3D")
        self.i2c = i2c
        self.width, self.height = 128, height
        self.pages = height // 8
        self.buf = bytearray(self.pages * 128)
        super().__init__(self.buf, 128, height, framebuf.MONO_VLSB)
        for c in (0xAE, 0x20, 0x00, 0x40, 0xA1, 0xA8, height - 1, 0xC8, 0xD3, 0x00,
                  0xDA, 0x02 if height == 32 else 0x12, 0xD5, 0x80, 0xD9, 0xF1, 0xDB, 0x30,
                  0x81, 0xFF, 0xA4, 0xA6, 0xAD, 0x30, 0x8D, 0x14, 0xAF):
            self.cmd(c)
        self.fill(0)
        self.show()

    def cmd(self, c):
        self.i2c.writeto(self.addr, bytes((0x80, c)))

    def show(self):
        for c in (0x21, 0, 127, 0x22, 0, self.pages - 1):
            self.cmd(c)
        self.i2c.writevto(self.addr, (b"\x40", self.buf))

    def big_text(self, s, x, y, k):
        """글자를 k 배로 크게 (8×8 글꼴을 늘려 그림)"""
        g = bytearray(8)
        fb = framebuf.FrameBuffer(g, 8, 8, framebuf.MONO_VLSB)
        for ch in s:
            fb.fill(0)
            fb.text(ch, 0, 0, 1)
            for cx in range(8):
                col = g[cx]
                for cy in range(8):
                    if (col >> cy) & 1:
                        self.fill_rect(x + cx * k, y + cy * k, k, k, 1)
            x += 8 * k


# ───────────────────────── 오프라인 음성 인식 DF2301Q (I2C 0x64) ─────────────────────────
class Voice:
    ADDR = 0x64

    def __init__(self, i2c):
        if self.ADDR not in i2c.scan():
            raise OSError("no voice sensor at 0x64")
        self.i2c = i2c

    def _w(self, reg, v):
        self.i2c.writeto(self.ADDR, bytes((reg, v & 0xFF)))

    def cmd_id(self):
        """마지막으로 알아들은 명령 번호 (0 = 없음)"""
        self.i2c.writeto(self.ADDR, b"\x02")
        return self.i2c.readfrom(self.ADDR, 1)[0]

    def play(self, n):  # 명령 번호 n 의 대답 소리 (1 = 깨우기)
        self._w(0x03, n)

    def mute(self, on):
        self._w(0x04, 1 if on else 0)

    def volume(self, v):  # 1~7
        self._w(0x05, max(1, min(7, v)))

    def wake_time(self, s):  # 깨어 있는 시간(초) 0~255
        self._w(0x06, s)


# ───────────────────────── 컬러 센서 TCS34725 (I2C 0x29) ─────────────────────────
class Color:
    ADDR = 0x29

    def __init__(self, i2c):
        self.i2c = i2c
        if self._r8(0x12) not in (0x44, 0x4D, 0x10):  # TCS34725 · 34727 · 34721
            raise OSError("no TCS34725 at 0x29")
        self._w8(0x01, 0xEB)  # 적분 시간 (256-0xEB)×2.4 ≈ 50 ms
        self._w8(0x0F, 0x01)  # 이득 ×4
        self._w8(0x00, 0x01)  # 전원
        sleep_ms(3)
        self._w8(0x00, 0x03)  # 전원 + 측정
        self.max = min(65535, (256 - 0xEB) * 1024)

    def _w8(self, reg, v):
        self.i2c.writeto(self.ADDR, bytes((0x80 | reg, v)))

    def _r8(self, reg):
        self.i2c.writeto(self.ADDR, bytes((0x80 | reg,)))
        return self.i2c.readfrom(self.ADDR, 1)[0]

    def gain(self, i):  # 0:×1 1:×4 2:×16 3:×60
        self._w8(0x0F, i & 3)

    def read(self):
        """새 값이 있으면 (빨강, 초록, 파랑, 밝기) 원시 값, 없으면 None"""
        if not self._r8(0x13) & 0x01:
            return None
        self.i2c.writeto(self.ADDR, b"\xb4")  # 0x80|0x20(자동 증가)|0x14 CDATAL
        d = self.i2c.readfrom(self.ADDR, 8)
        c = d[0] | d[1] << 8
        r = d[2] | d[3] << 8
        g = d[4] | d[5] << 8
        b = d[6] | d[7] << 8
        return r, g, b, c

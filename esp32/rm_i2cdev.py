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


# ───────────────────────── 자이로·가속도 MPU6050 (I2C 0x68/0x69) ─────────────────────────
class IMU:
    def __init__(self, i2c):
        found = i2c.scan()
        self.addr = 0x68 if 0x68 in found else 0x69 if 0x69 in found else None
        if self.addr is None:
            raise OSError("no MPU6050 at 0x68/0x69")
        self.i2c = i2c
        self._w(0x6B, 0x00)  # 잠 깨우기
        sleep_ms(5)
        self._w(0x1A, 0x03)  # 저역 필터 약 44 Hz
        self._w(0x1B, 0x00)  # 자이로 ±250 °/s
        self._w(0x1C, 0x00)  # 가속도 ±2 g

    def _w(self, reg, v):
        self.i2c.writeto(self.addr, bytes((reg, v)))

    def read(self):
        """(가속도 x, y, z [g×100], 자이로 x, y, z [°/s]) — 모두 정수"""
        self.i2c.writeto(self.addr, b"\x3b")
        d = self.i2c.readfrom(self.addr, 14)

        def s16(i):
            v = (d[i] << 8) | d[i + 1]
            return v - 65536 if v & 0x8000 else v
        return (s16(0) * 100 // 16384, s16(2) * 100 // 16384, s16(4) * 100 // 16384,
                s16(8) // 131, s16(10) // 131, s16(12) // 131)


# ───────────────────────── 조도 BH1750 (I2C 0x23/0x5C) ─────────────────────────
class Lux:
    def __init__(self, i2c):
        found = i2c.scan()
        self.addr = 0x23 if 0x23 in found else 0x5C if 0x5C in found else None
        if self.addr is None:
            raise OSError("no BH1750 at 0x23/0x5C")
        self.i2c = i2c
        i2c.writeto(self.addr, b"\x01")  # 켜기
        i2c.writeto(self.addr, b"\x10")  # 연속 · 1 lux 단위 (120 ms)

    def read(self):
        d = self.i2c.readfrom(self.addr, 2)
        return ((d[0] << 8) | d[1]) * 10 // 12  # lux


# ───────────────────────── 기압·온습도 BME280 / BMP280 (I2C 0x76/0x77) ─────────────────────────
class Env:
    def __init__(self, i2c):
        found = i2c.scan()
        self.addr = 0x76 if 0x76 in found else 0x77 if 0x77 in found else None
        if self.addr is None:
            raise OSError("no BME280 at 0x76/0x77")
        self.i2c = i2c
        cid = self._r(0xD0, 1)[0]
        if cid not in (0x60, 0x58):  # BME280 · BMP280(습도 없음)
            raise OSError("not BME280/BMP280 (id %x)" % cid)
        self.hum = cid == 0x60
        c = self._r(0x88, 26)

        def u16(i):
            return c[i] | (c[i + 1] << 8)

        def s16(i):
            v = u16(i)
            return v - 65536 if v & 0x8000 else v
        self.T = (u16(0), s16(2), s16(4))
        self.P = (u16(6),) + tuple(s16(8 + 2 * k) for k in range(8))
        if self.hum:
            h1 = c[25]
            e = self._r(0xE1, 7)
            h2 = e[0] | (e[1] << 8)
            h2 = h2 - 65536 if h2 & 0x8000 else h2
            h4 = (e[3] << 4) | (e[4] & 0x0F)
            h4 = h4 - 4096 if h4 & 0x800 else h4
            h5 = (e[5] << 4) | (e[4] >> 4)
            h5 = h5 - 4096 if h5 & 0x800 else h5
            h6 = e[6] - 256 if e[6] & 0x80 else e[6]
            self.H = (h1, h2, e[2], h4, h5, h6)
            self._w(0xF2, 0x01)  # 습도 ×1
        self._w(0xF5, 0xA0)      # 대기 1초 · 필터 끔
        self._w(0xF4, 0x27)      # 온도·기압 ×1 · 계속 측정

    def _w(self, reg, v):
        self.i2c.writeto(self.addr, bytes((reg, v)))

    def _r(self, reg, n):
        self.i2c.writeto(self.addr, bytes((reg,)))
        return self.i2c.readfrom(self.addr, n)

    def read(self):
        """(온도 °C, 습도 %, 기압 hPa) — 실수 (BMP280 은 습도 0)"""
        d = self._r(0xF7, 8)
        adc_p = (d[0] << 12) | (d[1] << 4) | (d[2] >> 4)
        adc_t = (d[3] << 12) | (d[4] << 4) | (d[5] >> 4)
        adc_h = (d[6] << 8) | d[7]
        T1, T2, T3 = self.T
        v1 = (adc_t / 16384.0 - T1 / 1024.0) * T2
        v2 = (adc_t / 131072.0 - T1 / 8192.0) ** 2 * T3
        tf = v1 + v2
        temp = tf / 5120.0
        P1, P2, P3, P4, P5, P6, P7, P8, P9 = self.P
        v1 = tf / 2.0 - 64000.0
        v2 = v1 * v1 * P6 / 32768.0 + v1 * P5 * 2.0
        v2 = v2 / 4.0 + P4 * 65536.0
        v1 = (P3 * v1 * v1 / 524288.0 + P2 * v1) / 524288.0
        v1 = (1.0 + v1 / 32768.0) * P1
        press = 0.0
        if v1:
            p = (1048576.0 - adc_p - v2 / 4096.0) * 6250.0 / v1
            press = (p + (P9 * p * p / 2147483648.0 + p * P8 / 32768.0 + P7) / 16.0) / 100.0
        hum = 0.0
        if self.hum:
            H1, H2, H3, H4, H5, H6 = self.H
            h = tf - 76800.0
            h = (adc_h - (H4 * 64.0 + H5 / 16384.0 * h)) * (H2 / 65536.0 * (1.0 + H6 / 67108864.0 * h * (1.0 + H3 / 67108864.0 * h)))
            h = h * (1.0 - H1 * h / 524288.0)
            hum = max(0.0, min(100.0, h))
        return temp, hum, press


# ───────────────────────── 초음파 HC-SR04 (트리거·에코 핀) ─────────────────────────
class Sonar:
    def __init__(self, trig, echo):
        from machine import Pin
        self.t = Pin(trig, Pin.OUT, value=0)
        self.e = Pin(echo, Pin.IN)

    def read(self):
        """거리 mm (재지 못하면 4000)"""
        from machine import time_pulse_us
        from time import sleep_us
        self.t.value(0)
        sleep_us(2)
        self.t.value(1)
        sleep_us(10)
        self.t.value(0)
        us = time_pulse_us(self.e, 1, 25000)
        if us < 0:
            return 4000
        return min(4000, us * 343 // 2000)  # 소리 343 m/s, 왕복


# ───────────────────────── 온습도 DHT11 / DHT22 ─────────────────────────
class DHT:
    def __init__(self, pin, kind22):
        import dht
        from machine import Pin
        self.d = (dht.DHT22 if kind22 else dht.DHT11)(Pin(pin))
        self.d.measure()  # 연결 확인 (실패하면 OSError)

    def read(self):
        self.d.measure()
        return self.d.temperature(), self.d.humidity()

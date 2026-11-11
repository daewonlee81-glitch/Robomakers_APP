# rm_io.py — 로보메이커스 워드블럭 「ESP32 핀」 블록용 LMS-ESP32 I/O
#
# 허브 블록이 ESP32 의 GPIO 를 직접 다룹니다: 디지털 출력/입력, 아날로그 입력, PWM, 서보, 네오픽셀.
# 에디터의 「ESP32 쪽 파일」 다운로드가 이 코드(맨 위 주석 제외)를 main.py 안에 그대로 넣습니다.
# 따로 복사할 필요는 없습니다. 명령은 허브와 같은 순서로 등록합니다.
#
# 규칙: 서보·네오픽셀처럼 ESP32 I/O 기능을 새로 넣을 때도 전부 이 파일에 함수로 넣어 main.py 하나로 묶습니다.
#   1) 여기 함수 추가  2) hublib/rm_esp32.py 의 IO_CMDS 끝에 (이름, 허브로, 허브에서) 추가 + 메서드
#   3) js/esp32gen.js 의 IO_CMDS 끝에 같은 줄 추가  — 이름 5글자 이하, 기존 순서는 바꾸지 않음
# 현재 명령:
#   p.add_command('pmode', '', 'BB'); p.add_command('inp', '8H', ''); p.add_command('dout', '', 'BB')
#   p.add_command('pwm', '', 'BB');   p.add_command('servo', '', 'BB'); p.add_command('npx', '', '6B')
#   I2C 센서·화면: p.add_command('sinit', '', 'BBB'); p.add_command('sget', '7H', '')
#                  p.add_command('sset', '', 'BBB'); p.add_command('otxt', '', 'BB14s')
#                  p.add_command('sget2', '8h', ''); p.add_command('sget3', '8h', '')
#   main.py 의 while 반복에서 rm_tick() 을 함께 부릅니다 (센서 값을 미리 읽어 둠).
#   드라이버는 따로 복사하는 rm_i2cdev.py · rm_vl53.py (처음 쓸 때 import)

from machine import Pin, PWM, ADC

try:
    from neopixel import NeoPixel
except ImportError:
    NeoPixel = None

try:  # 허브와 통신하는 핀은 건드리지 않습니다
    from lms_esp32 import RX_PIN, TX_PIN
except ImportError:
    RX_PIN, TX_PIN = 18, 19
RESERVED = (RX_PIN, TX_PIN)

OUT, IN, IN_UP, IN_DOWN, ANALOG, PWM_, SERVO = range(7)

_obj = {}      # 핀 → (모드, 객체)
_slots = []    # 입력 핀 순서 (허브와 같은 순서)
_np = None


def _free(pin):
    o = _obj.pop(pin, None)
    if o and o[0] in (PWM_, SERVO):
        try:
            o[1].deinit()
        except Exception:
            pass


def _reset():
    global _np
    for pin in list(_obj):
        _free(pin)
    del _slots[:]
    if _np:
        _np.fill((0, 0, 0))
        _np.write()
    _np = None


def pmode(pin, mode):
    if pin == 255:
        _reset()
        return
    if pin in RESERVED:
        print("rm_io: GPIO", pin, "is used for the hub link")
        return
    _free(pin)
    if mode == OUT:
        o = Pin(pin, Pin.OUT)
    elif mode in (IN, IN_UP, IN_DOWN):
        pull = (None, None, Pin.PULL_UP, Pin.PULL_DOWN)[mode]
        o = Pin(pin, Pin.IN, pull) if pull is not None else Pin(pin, Pin.IN)
    elif mode == ANALOG:
        o = ADC(Pin(pin))
        try:
            o.atten(ADC.ATTN_11DB)  # 0~3.3V
        except Exception:
            pass
    elif mode == PWM_:
        o = PWM(Pin(pin), freq=1000)
    elif mode == SERVO:
        o = PWM(Pin(pin), freq=50)
    else:
        return
    _obj[pin] = (mode, o)
    if mode in (IN, IN_UP, IN_DOWN, ANALOG) and pin not in _slots and len(_slots) < 8:
        _slots.append(pin)


def _value(pin):
    o = _obj.get(pin)
    if not o:
        return 0
    if o[0] == ANALOG:
        a = o[1]
        return a.read() if hasattr(a, "read") else a.read_u16() >> 4  # 0~4095
    if o[0] in (IN, IN_UP, IN_DOWN):
        return o[1].value()
    return 0


def inp():
    v = [_value(p) for p in _slots]
    return tuple(v + [0] * (8 - len(v)))


def dout(pin, on):
    o = _obj.get(pin)
    if o and o[0] == OUT:
        o[1].value(1 if on else 0)


def _duty(p, frac):  # frac 0.0~1.0
    if hasattr(p, "duty_u16"):
        p.duty_u16(int(frac * 65535))
    else:
        p.duty(int(frac * 1023))


def pwm(pin, percent):
    o = _obj.get(pin)
    if o and o[0] == PWM_:
        _duty(o[1], min(100, percent) / 100)


def servo(pin, angle):
    o = _obj.get(pin)
    if o and o[0] == SERVO:
        us = 500 + min(180, angle) * 2000 // 180  # 0.5ms(0°) ~ 2.5ms(180°)
        if hasattr(o[1], "duty_ns"):
            o[1].duty_ns(us * 1000)
        else:
            _duty(o[1], us / 20000)


def npx(op, a, b, c, d, show):
    """0 설정(핀 a, 개수 b) / 1 한 개(번호 a, R b G c B d) / 2 모두(R a G b B c) / 3 보이기"""
    global _np
    if op == 0:
        if NeoPixel is None or a in RESERVED:
            return
        if _np:
            _np.fill((0, 0, 0))
            _np.write()
        _np = NeoPixel(Pin(a), max(1, b))
        _np.fill((0, 0, 0))
    elif _np is None:
        return
    elif op == 1:
        if a < _np.n:
            _np[a] = (b, c, d)
    elif op == 2:
        _np.fill((a, b, c))
    if show and _np is not None:
        _np.write()


# ---------- I2C 센서 · 화면 ----------
# 종류: 1 OLED(128×64) · 2 음성 인식 DF2301Q · 3 컬러 TCS34725 · 4 레이저 거리(VL6180X/VL53L0X/VL53L1X) · 5 OLED(128×32)
# 허브는 sget 하나로 모든 값을 읽습니다: (빨강, 초록, 파랑, 밝기, 거리mm, 음성(순번<<8|번호), 상태)
#   상태 = 준비된 장치 비트(1<<종류) | 레이저 칩 번호<<8 (1 VL6180X · 2 VL53L0X · 3 VL53L1X) | 오류 비트(1<<(종류+11))
from machine import SoftI2C
from time import ticks_ms, ticks_diff

try:  # 보드의 Grove I2C 단자
    from lms_esp32 import SDA_PIN, SCL_PIN
except ImportError:
    SDA_PIN, SCL_PIN = 5, 4

S_OLED, S_VOICE, S_COLOR, S_TOF, S_OLED32 = 1, 2, 3, 4, 5
# 추가 센서: 6 초음파 HC-SR04(트리거, 에코 핀) · 7 DHT11 · 8 DHT22 (핀) · 9 MPU6050 · 10 BH1750 · 11 BME280 (I2C)
#   sget2 (8h): 초음파 mm · DHT 온도×10 · DHT 습도×10 · 기울기X×10 · 기울기Y×10 · 회전Z °/s · 밝기 lux · 가속도Z g×100
#   sget3 (8h): BME 온도×10 · BME 습도×10 · BME 기압 hPa×10 · 가속도X g×100 · 가속도Y g×100 · (예비) · 준비 비트 · 오류 비트 (1<<(종류-6))
S_SONAR, S_DHT11, S_DHT22, S_IMU, S_LUX, S_ENV = 6, 7, 8, 9, 10, 11
_bus = {}
_dev = {}
_sval = [0, 0, 0, 0, 0, 0, 0]
_s2 = [4000, 0, 0, 0, 0, 0, 0, 0]
_s3 = [0, 0, 0, 0, 0, 0, 0, 0]
_spend = []    # 처리할 sinit (종류, sda, scl) — 콜백 밖(rm_tick)에서 천천히 초기화
_s = {"vseq": 0, "vprev": 0, "vt": 0, "ct": 0, "dirty": False, "ot": 0}


def _i2c(sda, scl):
    if sda == 255 or scl == 255:
        sda, scl = SDA_PIN, SCL_PIN
    if sda in RESERVED or scl in RESERVED:
        raise OSError("GPIO %d/%d is used for the hub link" % (sda, scl))
    k = (sda, scl)
    if k not in _bus:
        for p in k:
            _free(p)
        _bus[k] = SoftI2C(sda=Pin(sda), scl=Pin(scl), freq=400000)
    return _bus[k]


def _sopen2(kind, a, b):
    """추가 센서 (종류 6~11). a, b = 핀 (초음파: 트리거·에코 · DHT: 데이터 · I2C: SDA·SCL)"""
    if kind == S_DHT22:
        _dev.pop(S_DHT11, None)
    bit = 1 << (min(kind, S_DHT11 if kind == S_DHT22 else kind) - 6)
    _dev.pop(kind, None)
    _s3[6] &= ~bit
    _s3[7] &= ~bit
    try:
        import rm_i2cdev as D
        if kind == S_SONAR:
            for p in (a, b):
                if p in RESERVED:
                    raise OSError("GPIO %d is used for the hub link" % p)
                _free(p)
            d = D.Sonar(a, b)
        elif kind in (S_DHT11, S_DHT22):
            if a in RESERVED:
                raise OSError("GPIO %d is used for the hub link" % a)
            _free(a)
            d = D.DHT(a, kind == S_DHT22)
            kind = S_DHT11  # 둘 다 같은 자리
        else:
            d = (D.IMU, D.Lux, D.Env)[kind - S_IMU](_i2c(a, b))
        _dev[kind] = d
        # 켜자마자 첫 값을 넣어 둡니다 (DHT 는 2초에 한 번만 잴 수 있어 방금 잰 값을 씀)
        if kind == S_SONAR:
            _s2[0] = d.read()
        elif kind == S_DHT11:
            _s2[1], _s2[2] = _clip(d.d.temperature() * 10), _clip(d.d.humidity() * 10)
            _s["dt"] = ticks_ms()
        elif kind == S_ENV:
            t, h, p = d.read()
            _s3[0], _s3[1], _s3[2] = _clip(t * 10), _clip(h * 10), _clip(p * 10)
        _s3[6] |= bit
        print("rm_io: sensor", kind, "ok")
    except Exception as e:
        _s3[7] |= bit
        print("rm_io: sensor", kind, e)


def sget2():
    return tuple(_s2)


def sget3():
    return tuple(_s3)


def _clip(v):
    return max(-32768, min(32767, int(v)))


def _slow(now):
    """시간이 걸리는 센서(초음파·DHT·BME280)는 한 번에 하나씩"""
    d = _dev.get(S_SONAR)
    if d and ticks_diff(now, _s.get("ut", 0)) >= 60:
        _s["ut"] = now
        _s2[0] = d.read()
        return
    d = _dev.get(S_DHT11)
    if d and ticks_diff(now, _s.get("dt", 0)) >= 2000:
        _s["dt"] = now
        t, h = d.read()
        _s2[1], _s2[2] = _clip(t * 10), _clip(h * 10)
        return
    d = _dev.get(S_ENV)
    if d and ticks_diff(now, _s.get("et", 0)) >= 500:
        _s["et"] = now
        t, h, p = d.read()
        _s3[0], _s3[1], _s3[2] = _clip(t * 10), _clip(h * 10), _clip(p * 10)


def _fast(now):
    d = _dev.get(S_IMU)
    if d and ticks_diff(now, _s.get("it", 0)) >= 20:
        _s["it"] = now
        ax, ay, az, gx, gy, gz = d.read()
        import math
        _s2[3] = _clip(math.degrees(math.atan2(ay, az)) * 10)
        _s2[4] = _clip(math.degrees(math.atan2(-ax, math.sqrt(ay * ay + az * az))) * 10)
        _s2[5] = _clip(gz)
        _s2[7] = _clip(az)
        _s3[3], _s3[4] = _clip(ax), _clip(ay)
    d = _dev.get(S_LUX)
    if d and ticks_diff(now, _s.get("lt", 0)) >= 150:
        _s["lt"] = now
        _s2[6] = _clip(d.read())


def _sopen(kind, sda, scl):
    if kind >= S_SONAR:
        return _sopen2(kind, sda, scl)
    h = 32 if kind == S_OLED32 else 64
    kind = S_OLED if kind == S_OLED32 else kind
    _dev.pop(kind, None)
    _sval[6] &= ~((1 << kind) | (1 << (kind + 11)) | (0xF00 if kind == S_TOF else 0))
    try:
        i2c = _i2c(sda, scl)
        if kind == S_TOF:
            import rm_vl53
            d = rm_vl53.open(i2c)
            _sval[6] |= d.chip << 8
            _sval[4] = rm_vl53.MAX_MM[d.chip]
        else:
            import rm_i2cdev
            d = rm_i2cdev.OLED(i2c, h) if kind == S_OLED else rm_i2cdev.Voice(i2c) if kind == S_VOICE else rm_i2cdev.Color(i2c)
        _dev[kind] = d
        _sval[6] |= 1 << kind
        print("rm_io: I2C", kind, "ok")
    except Exception as e:
        _sval[6] |= 1 << (kind + 11)
        print("rm_io: I2C", kind, e)


def sinit(kind, sda, scl):
    _spend.append((kind, sda, scl))


def sget():
    return tuple(_sval)


def sset(kind, what, v):
    d = _dev.get(kind)
    if d is None:
        return
    try:
        if kind == S_OLED:
            if what == 0:
                d.fill(0)
            elif what == 1:
                d.cmd(0x81)
                d.cmd(v)
            _s["dirty"] = True
        elif kind == S_VOICE:
            (d.volume, d.mute, d.wake_time, d.play)[what](v)
        elif kind == S_COLOR and what == 0:
            d.gain(v)
    except Exception as e:
        print("rm_io: sset", kind, e)


def otxt(row, col, text):
    """OLED 글자: row 0~7 (8 px 줄), 위 4비트 = 크기-1 · col 0~15 · text 최대 14자(영문·숫자)"""
    d = _dev.get(S_OLED)
    if d is None:
        return
    k = (row >> 4) + 1
    y = (row & 15) * 8
    t = bytes(text).split(b"\x00")[0].decode()
    w = len(t) * 8 * k
    d.fill_rect(col * 8, y, w, 8 * k, 0)
    if k == 1:
        d.text(t, col * 8, y, 1)
    else:
        d.big_text(t, col * 8, y, k)
    _s["dirty"] = True


def rm_tick():
    """main.py 의 while 반복에서 부릅니다: 미뤄 둔 초기화 · 센서 값 미리 읽기 · OLED 다시 그리기"""
    if _spend:
        _sopen(*_spend.pop(0))
        return
    now = ticks_ms()
    try:
        d = _dev.get(S_TOF)
        if d:
            mm = d.poll()
            if mm is not None:
                _sval[4] = mm
        d = _dev.get(S_COLOR)
        if d and ticks_diff(now, _s["ct"]) >= 20:
            _s["ct"] = now
            v = d.read()
            if v:
                _sval[0], _sval[1], _sval[2], _sval[3] = v
        d = _dev.get(S_VOICE)
        if d and ticks_diff(now, _s["vt"]) >= 100:  # 음성 모듈은 너무 자주 읽지 않음
            _s["vt"] = now
            n = d.cmd_id()
            if n and n != _s["vprev"]:
                _s["vseq"] = (_s["vseq"] + 1) & 255
                _sval[5] = (_s["vseq"] << 8) | n
            _s["vprev"] = n
        for f in (_fast, _slow):
            try:
                f(now)
            except Exception as e:  # DHT 는 가끔 읽기에 실패합니다 — 다음에 다시
                print("rm_io: sensor", e)
        d = _dev.get(S_OLED)
        if d and _s["dirty"] and ticks_diff(now, _s["ot"]) >= 40:
            _s["ot"] = now
            _s["dirty"] = False
            d.show()
    except Exception as e:
        print("rm_io: I2C", e)


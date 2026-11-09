# rm_io.py — 로보메이커스 워드블럭 「ESP32 핀」 블록용 LMS-ESP32 I/O
#
# 허브 블록이 ESP32 의 GPIO 를 직접 다룹니다: 디지털 출력/입력, 아날로그 입력, PWM, 서보, 네오픽셀.
# 에디터의 「ESP32 쪽 파일」 다운로드가 이 코드(맨 위 주석 제외)를 main.py 안에 그대로 넣습니다.
# 따로 복사할 필요는 없습니다. 명령은 허브와 같은 순서로 등록합니다:
#   p.add_command('pmode', '', 'BB'); p.add_command('inp', '8H', ''); p.add_command('dout', '', 'BB')
#   p.add_command('pwm', '', 'BB');   p.add_command('servo', '', 'BB'); p.add_command('npx', '', '6B')

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

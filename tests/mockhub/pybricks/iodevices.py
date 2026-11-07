import os
from pybricks import log
from pybricks.parameters import _chk
MODE = os.environ.get("MOCK_PUP", "union")
class PUPDevice:
    def __init__(self, port):
        _chk(port, "Port"); self.p = port.name; log("PUPDevice", port, MODE)
    def info(self):
        if MODE == "bluepad": return {"id": 61, "modes": [("BLUEPAD", 8), ("SERVO", 8)]}
        return {"id": 61, "modes": [("line", 5), ("led", 1), ("m2", 1), ("m3", 1), ("m4", 1), ("RGB I", 4)]}
    def read(self, mode):
        if MODE == "bluepad":
            # 축 L=(200,60) R=(128,128) → 오른쪽/위, 버튼 A, 방향키 위
            import struct
            b = bytes([200, 60, 128, 128, 0x01, 0x01, 0, 0] + [0] * 8)
            return list(struct.unpack("8H", b))
        if mode == 5: return [160, 100, 40, 2]
        if mode == 0: return [2, 0, -4, 0, 0][:5]
        if mode == 1: return [7]
        return [0]
    def write(self, mode, data):
        assert isinstance(data, (list, tuple)), data
        log("pup write", mode, list(data))
class XboxController:
    def __init__(self, joystick_deadzone=10, name=None, timeout=10000, connect=True):
        class _B:
            def pressed(s):
                from pybricks.parameters import Button
                return {Button.A}
        self.buttons = _B(); log("Xbox connected")
    def joystick_left(self): return (30, 80)
    def joystick_right(self): return (-20, 0)
    def triggers(self): return (0, 50)
    def dpad(self): return 1
    def rumble(self, power=100, duration=200, count=1, delay=100): log("rumble", power, duration)

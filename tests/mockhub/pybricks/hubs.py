from pybricks import log
from pybricks.parameters import _chk
class _Light:
    def on(self, color): _chk(color, "Color"); log("light", color)
    def off(self): log("light off")
    def blink(self, color, durations): pass
class _Matrix:
    def text(self, text, on=500, off=50): assert isinstance(text, str), "display.text needs str"; log("text", text)
    def number(self, number): float(number); log("number", number)
    def icon(self, icon): _chk(icon, "Icon"); log("icon", icon)
    def pixel(self, row, column, brightness=100): int(row); int(column); log("pixel")
    def off(self): log("display off")
    def char(self, char): pass
class _Screen:
    def print(self, *args, sep=" ", end="\n"): log("screen", *args)
    def clear(self): log("screen clear")
    def draw_text(self, x, y, text, text_color=None, background_color=None): pass
class _Speaker:
    def beep(self, frequency=500, duration=100): float(frequency); float(duration); log("beep", frequency, duration)
class _IMU:
    def heading(self): return 0.0
    def tilt(self): return (0, 0)
    def reset_heading(self, angle): float(angle)
class _Keypad:
    def pressed(self): return set()
class _System:
    def set_stop_button(self, b): pass
class PrimeHub:
    def __init__(self, *a, **k): self.light=_Light(); self.display=_Matrix(); self.speaker=_Speaker(); self.imu=_IMU(); self.buttons=_Keypad(); self.system=_System()
class EssentialHub:
    def __init__(self, *a, **k): self.light=_Light(); self.imu=_IMU(); self.buttons=_Keypad(); self.system=_System()
class EV3Brick:
    def __init__(self, *a, **k): self.light=_Light(); self.screen=_Screen(); self.speaker=_Speaker(); self.buttons=_Keypad(); self.system=_System()

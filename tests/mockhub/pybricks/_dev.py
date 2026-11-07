from pybricks import log
from pybricks.parameters import _chk, Color
class Motor:
    def __init__(self, port, positive_direction=None, gears=None, reset_angle=True, profile=None):
        _chk(port, "Port")
        if positive_direction is not None: _chk(positive_direction, "Direction")
        self.p = port.name; log("Motor", port, positive_direction)
    def run(self, speed): float(speed); log(self.p, "run", speed)
    def dc(self, duty): float(duty); assert -100 <= duty <= 100, duty; log(self.p, "dc", duty)
    def run_angle(self, speed, rotation_angle, then=None, wait=True): float(speed); float(rotation_angle); assert isinstance(wait, bool); log(self.p, "run_angle", speed, rotation_angle, wait)
    def run_time(self, speed, time, then=None, wait=True): float(speed); float(time); assert isinstance(wait, bool); log(self.p, "run_time", speed, time)
    def run_target(self, speed, target_angle, then=None, wait=True): float(speed); float(target_angle); log(self.p, "run_target")
    def stop(self): log(self.p, "stop")
    def brake(self): log(self.p, "brake")
    def hold(self): log(self.p, "hold")
    def angle(self): return 0
    def speed(self, window=100): return 0
    def reset_angle(self, angle=None): log(self.p, "reset_angle", angle)
class _Sensor:
    def __init__(self, port): _chk(port, "Port"); self.p = port.name; log(type(self).__name__, port)
class ColorSensor(_Sensor):
    def color(self, surface=True): return Color.RED
    def reflection(self): return 42
    def ambient(self): return 10
    def hsv(self, surface=True): return (0, 0, 0)
class UltrasonicSensor(_Sensor):
    def distance(self): return 300
    def presence(self): return False
class ForceSensor(_Sensor):
    def force(self): return 1.5
    def pressed(self, force=3): return False
    def touched(self): return False
    def distance(self): return 0
class TouchSensor(_Sensor):
    def pressed(self): return False
class GyroSensor(_Sensor):
    def __init__(self, port, positive_direction=None): super().__init__(port)
    def angle(self): return 0
    def speed(self): return 0
    def reset_angle(self, angle): float(angle)

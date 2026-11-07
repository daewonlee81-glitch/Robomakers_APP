# 가상 허브에는 매트릭스 화면·스피커·IMU·허브 불빛이 없어 그 부분만 기록용으로 대신합니다.
from pybricks.hubs import VirtualHub
class _Rec:
    def __init__(self, name): self._n = name
    def __getattr__(self, m):
        def f(*a, **k):
            print("[" + self._n + "." + m + "]", *a)
            return (0, 0) if m == "tilt" else 0
        return f
class PrimeHub:
    def __init__(self):
        self._v = VirtualHub()
        self.buttons = self._v.buttons
        self.display = _Rec("display"); self.speaker = _Rec("speaker"); self.imu = _Rec("imu"); self.light = _Rec("light")
EssentialHub = PrimeHub

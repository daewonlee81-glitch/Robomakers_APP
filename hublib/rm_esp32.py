# rm_esp32.py — 안톤 마인드스톰(Anton's Mindstorms) LMS-ESP32 연결 클래스
#
# PUPRemote(pupremote_hub, GPL · AntonsMindstorms.com) 를 감싸
# 여러 포트에 ESP32 를 붙여 쓸 수 있게 합니다.
#
# ESP32 쪽(MicroPython)에서 정의한 채널/명령과 같은 이름·형식을 허브 쪽에도 등록합니다.
#   ESP32:  pr = PUPRemoteSensor(power=True); pr.add_channel('line', 'hhb')
#   허브:   esp = ESP32(Port.A); esp.add_channel('line', 'hhb'); esp.value('line', 0)

from pybricks.iodevices import PUPDevice
from pybricks.tools import wait, StopWatch
from pupremote_hub import PUPRemoteHub

_boards = {}


def wait_device(port, ms=4000):
    """ESP32 가 허브와 연결(LPF2 인사)될 때까지 기다립니다. ms 안에 안 되면 OSError."""
    sw = StopWatch()
    while True:
        try:
            PUPDevice(port)
            return
        except OSError:
            if sw.time() >= ms:
                print("ESP32?", port)
                raise
        wait(200)


class ESP32:
    def __init__(self, port):
        wait_device(port)
        self.pr = PUPRemoteHub(port)
        self._last = {}

    def add_channel(self, name, fmt):
        """ESP32 → 허브 로 값을 계속 보내는 채널."""
        self.pr.add_channel(name, fmt)

    def add_command(self, name, to_hub="", from_hub=""):
        """허브가 ESP32 의 함수를 호출하는 명령 (to_hub: 돌려받는 형식, from_hub: 보내는 형식)."""
        self.pr.add_command(name, to_hub_fmt=to_hub, from_hub_fmt=from_hub)

    def call(self, name, *args):
        r = self.pr.call(name, *args)
        self._last[name] = r if isinstance(r, tuple) else (r,)
        return r

    def value(self, name, index=0):
        """채널/명령을 읽고 index 번째 값을 돌려줍니다."""
        r = self.call(name)
        if isinstance(r, tuple):
            return r[index] if index < len(r) else 0
        return r if index == 0 else 0


def board(port):
    k = str(port)
    if k not in _boards:
        _boards[k] = ESP32(port)
    return _boards[k]

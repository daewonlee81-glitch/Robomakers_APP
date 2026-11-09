# rm_status.py — 로봇 상태 확인 (배터리 · 포트마다 연결된 장치 · 방향)
#
# 웹 에디터의 「상태」 탭에서 「▶ 상태 확인」을 누르면 이 모듈을 쓰는 작은 프로그램이 허브에서 돕니다.
# 0.25초마다 한 줄을 출력하고, 에디터는 이 줄을 터미널에서 숨기고 표로 보여 줍니다.
#
#   @ST:<전압 mV>,<전류 mA>,<방향>,<앞뒤 기울기>,<좌우 기울기>|A=<종류>:<값1>:<값2>|B=...
#   종류: m 모터(각도, 속도) · c 색 센서(반사값) · u 거리 센서(mm) · f 힘 센서(힘 0.1N, 눌림)
#         g 자이로(EV3, 각도) · t 터치(EV3, 눌림) · i 적외선(EV3, 거리 %) · d 그 밖의 장치(장치 번호) · - 없음
#
# 빈 포트는 2초마다 하나씩 다시 살펴서, 실행 중에 꽂은 장치도 나타납니다.

from pybricks.parameters import Port
from pybricks.tools import wait


def _pup_probe(port):
    from pybricks.pupdevices import Motor, UltrasonicSensor, ForceSensor
    try:
        return ["m", Motor(port)]
    except Exception:
        pass
    try:
        from pybricks.iodevices import PUPDevice
        d = PUPDevice(port)
        i = d.info()["id"]
    except Exception:
        return ["-", None]
    try:
        if i == 62:
            return ["u", UltrasonicSensor(port)]
        if i == 63:
            return ["f", ForceSensor(port)]
    except Exception:
        pass
    if i == 61:
        # 색 센서 — 허스키렌즈·LMS-ESP32 브리지도 이 번호로 보일 수 있어 PUPDevice 로만 읽음
        return ["c", d]
    return ["d", i]


def _ev3_probe(port, motor_port):
    from pybricks import ev3devices as e
    if motor_port:
        try:
            return ["m", e.Motor(port)]
        except Exception:
            return ["-", None]
    for kind, cls in (("c", e.ColorSensor), ("u", e.UltrasonicSensor), ("g", e.GyroSensor),
                      ("i", e.InfraredSensor), ("t", e.TouchSensor)):
        try:
            return [kind, cls(port)]
        except Exception:
            pass
    return ["-", None]


def _read(kind, dev):
    if kind == "m":
        return dev.angle(), dev.speed()
    if kind == "c":
        try:
            return dev.reflection(), 0          # EV3 ColorSensor
        except AttributeError:
            return dev.read(1)[0], 0            # PUP 색 센서 (mode 1 = 반사값)
    if kind == "u":
        return dev.distance(), 0
    if kind == "f":
        return int(dev.force() * 10), 1 if dev.pressed() else 0
    if kind == "g":
        return dev.angle(), dev.speed()
    if kind == "t":
        return 1 if dev.pressed() else 0, 0
    if kind == "i":
        return dev.distance(), 0
    if kind == "d":
        return dev, 0
    return 0, 0


def run(hub, ev3=False):
    names = ["A", "B", "C", "D", "S1", "S2", "S3", "S4"] if ev3 else ["A", "B", "C", "D", "E", "F"]
    ports = []
    for n in names:
        p = getattr(Port, n, None)
        if p is not None:
            ports.append([n, p, "-", None])

    def probe(item):
        n, p = item[0], item[1]
        k, d = _ev3_probe(p, len(n) == 1) if ev3 else _pup_probe(p)
        item[2], item[3] = k, d

    print("RoboMakers status:", ", ".join(x[0] for x in ports))
    for item in ports:
        print("@ST:SCAN," + item[0])
        probe(item)

    tick = 0
    nxt = 0
    while True:
        try:
            v, c = hub.battery.voltage(), hub.battery.current()
        except Exception:
            v = c = 0
        try:
            h = int(hub.imu.heading())
            pitch, roll = hub.imu.tilt()
        except Exception:
            h = pitch = roll = 0
        parts = ["@ST:%d,%d,%d,%d,%d" % (v, c, h, pitch, roll)]
        for item in ports:
            k = item[2]
            if k != "-":
                try:
                    a, b = _read(k, item[3])
                except Exception:
                    item[2], item[3] = "-", None    # 빠짐
                    k, a, b = "-", 0, 0
            else:
                a = b = 0
            parts.append("%s=%s:%d:%d" % (item[0], k, a, b))
        print("|".join(parts))
        tick += 1
        if tick % 8 == 0:
            # 빈 포트를 하나씩 다시 살펴보기 (2초마다)
            empty = [x for x in ports if x[2] == "-"]
            if empty:
                probe(empty[nxt % len(empty)])
                nxt += 1
        wait(250)

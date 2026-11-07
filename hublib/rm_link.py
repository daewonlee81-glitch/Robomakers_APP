# rm_link.py — 로보메이커스 웹 에디터 ↔ 허브 데이터 링크
#
# 웹 에디터(AI 카메라, 웹 게임패드)가 Pybricks stdin 으로 보내는
# 한 줄짜리 프레임을 읽어 보관합니다.
#
#   프레임 형식:  <키>:<정수>,<정수>,...\n
#     H:  손      [감지, 제스처ID, X, Y, 손가락수]
#     P:  스켈레톤 [감지, 코X, 코Y, 왼손들기, 오른손들기, 몸중심X, 어깨기울기, 양팔벌림]
#     G:  게임패드 [LX, LY, RX, RY, LT, RT, 버튼비트, 방향키]
#
# 값은 읽을 때마다 update() 가 자동 호출되므로 블록에서 따로 부를 필요가 없습니다.

try:
    from sys import stdin
    from select import poll
except ImportError:  # 예전 Pybricks (u- 접두사 모듈)
    from usys import stdin
    from uselect import poll
from pybricks.tools import StopWatch

_poll = poll()
_poll.register(stdin)
_buf = []
_data = {}
_time = {}
_clock = StopWatch()

# 이 시간(ms) 동안 새 프레임이 없으면 값이 끊긴 것으로 봅니다 (느린 PC 의 AI 계산 고려).
TIMEOUT = 1500


def update():
    global _buf
    n = 0
    while n < 256 and _poll.poll(0):
        n += 1
        c = stdin.read(1)
        if c == "\n":
            line = "".join(_buf)
            _buf = []
            if len(line) > 2 and line[1] == ":":
                try:
                    _data[line[0]] = [int(v) for v in line[2:].split(",")]
                    _time[line[0]] = _clock.time()
                except ValueError:
                    pass
        elif c != "\r":
            if len(_buf) < 160:
                _buf.append(c)
            else:
                _buf = []


def fresh(key):
    """해당 키의 프레임이 최근 TIMEOUT 안에 들어왔으면 True."""
    update()
    t = _time.get(key)
    return t is not None and _clock.time() - t < TIMEOUT


def get(key, index, default=0):
    """키의 index 번째 값을 돌려줍니다. 끊겼거나 없으면 default."""
    if not fresh(key):
        return default
    v = _data.get(key)
    if v is None or index >= len(v):
        return default
    return v[index]


def values(key):
    """키의 전체 값 목록 (끊겼으면 빈 목록)."""
    if not fresh(key):
        return []
    return list(_data.get(key, []))

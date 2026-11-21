# 로보메이커스 워드블럭 — 「시작」 블록 여러 개를 동시에(번갈아) 실행
#
# 에디터는 시작 블록 하나를 제너레이터 함수 하나로 만들고, 기다리는 곳마다 yield 로 차례를 넘깁니다.
#   def _start1():
#       while True:
#           yield                                  # 반복 한 바퀴마다
#           motor_A.run_angle(500, 360, wait=False)
#           yield from rm_tasks.done(motor_A)      # 끝날 때까지 (그동안 다른 줄기 실행)
#           yield from rm_tasks.sleep(1000)        # 1초 기다리기
#   rm_tasks.run(_start1(), _start2())
#
# yield 값: 1 = 「기다리는 중」, 없음 = 「계속 일하는 중」.
# 모든 줄기가 기다리는 중일 때만 1 ms 쉬어서, 계산만 하는 반복은 느려지지 않습니다.
# 모든 줄기가 끝나면 프로그램이 끝납니다.

from pybricks.tools import wait, StopWatch

_sw = StopWatch()


def sleep(ms):
    """ms 밀리초 기다리기 (그동안 다른 줄기 실행)."""
    end = _sw.time() + ms
    yield 1
    while _sw.time() < end:
        yield 1


def _done(dev):
    try:
        return dev.done()
    except AttributeError:
        pass
    try:
        return dev.control.done()  # 옛 펌웨어의 모터
    except AttributeError:
        return dev.distance_control.done() and dev.heading_control.done()  # 옛 펌웨어의 주행


def done(dev):
    """모터·주행 동작이 끝날 때까지 (wait=False 로 시작한 다음)."""
    yield 1
    while not _done(dev):
        yield 1


def run(*tasks):
    """줄기들을 돌아가며 한 걸음씩 실행합니다. 모두 끝나면 돌아옵니다."""
    tasks = list(tasks)
    while tasks:
        idle = True
        for g in tasks[:]:
            try:
                if not next(g):
                    idle = False
            except StopIteration:
                tasks.remove(g)
        if idle and tasks:
            wait(1)

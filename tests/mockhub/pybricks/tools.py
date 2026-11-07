import time
from pybricks import log
class StopProgram(Exception): pass
_waits = [0]
MAX_WAITS = 150
def wait(time_ms):
    if not isinstance(time_ms, (int, float)): raise TypeError("wait(ms) needs number")
    _waits[0] += 1
    if _waits[0] > MAX_WAITS: raise StopProgram()
class StopWatch:
    def __init__(self): self.t0 = time.time()
    def time(self): return int((time.time() - self.t0) * 1000)
    def reset(self): self.t0 = time.time()
    def pause(self): pass
    def resume(self): pass
def run_task(*a): return None
def read_input_byte(*a, **k): return None

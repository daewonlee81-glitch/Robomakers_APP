# 가짜 허브에서 프로그램 실행: python3 run.py <program.py>  (stdin = 웹 에디터가 보내는 프레임)
import sys, os, runpy, io
sys.path[:0] = [os.path.dirname(os.path.abspath(__file__)), os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "hublib")]
class RawStdin:  # MicroPython 처럼 버퍼 없는 stdin
    def fileno(self): return 0
    def read(self, n=1): return os.read(0, n).decode()
sys.stdin = RawStdin()
import pybricks
from pybricks.tools import StopProgram
code = "ok"
try:
    runpy.run_path(sys.argv[1], run_name="__main__")
except StopProgram:
    code = "ok(loop)"
except SystemExit:
    code = "ok(exit)"
except Exception as e:
    import traceback; traceback.print_exc(); code = "FAIL " + type(e).__name__ + ": " + str(e)
print("RESULT", code)
print("LOG", " | ".join(pybricks.LOG[:40]))

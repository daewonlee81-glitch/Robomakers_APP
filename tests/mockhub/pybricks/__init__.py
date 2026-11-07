# 엄격한 가짜 Pybricks — 메서드 이름·인자는 pybricks-micropython v4 소스에서 가져옴.
LOG = []
def log(*a):
    LOG.append(" ".join(str(x) for x in a))

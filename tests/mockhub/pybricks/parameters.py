class _Enum:
    def __init__(self, cls, name): self.cls, self.name = cls, name
    def __repr__(self): return f"{self.cls}.{self.name}"
def _mk(cls, names):
    t = type(cls, (), {})
    for n in names.split(): setattr(t, n, _Enum(cls, n))
    return t
Port = _mk("Port", "A B C D E F S1 S2 S3 S4")
Direction = _mk("Direction", "CLOCKWISE COUNTERCLOCKWISE")
Color = _mk("Color", "BLACK BLUE BROWN CYAN GRAY GREEN MAGENTA NONE ORANGE RED VIOLET WHITE YELLOW")
Button = _mk("Button", "A B BEACON BLUETOOTH CENTER DOWN GUIDE LB LEFT LEFT_DOWN LEFT_MINUS LEFT_PLUS LEFT_UP LJ MENU P1 P2 P3 P4 RB RIGHT RIGHT_DOWN RIGHT_MINUS RIGHT_PLUS RIGHT_UP RJ UP UPLOAD VIEW X Y")
Icon = _mk("Icon", "ARROW_DOWN ARROW_LEFT ARROW_LEFT_DOWN ARROW_LEFT_UP ARROW_RIGHT ARROW_RIGHT_DOWN ARROW_RIGHT_UP ARROW_UP CIRCLE CLOCKWISE COUNTERCLOCKWISE DOWN EMPTY EYE_LEFT EYE_RIGHT FALSE FULL HAPPY HEART LEFT PAUSE RIGHT SAD SQUARE TRIANGLE_DOWN TRIANGLE_LEFT TRIANGLE_RIGHT TRIANGLE_UP TRUE UP")
Stop = _mk("Stop", "COAST BRAKE HOLD NONE COAST_SMART")
def _chk(v, cls):
    if not (isinstance(v, _Enum) and v.cls == cls): raise TypeError(f"expected {cls}, got {v!r}")

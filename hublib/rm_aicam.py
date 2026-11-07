# rm_aicam.py — 웹 AI 카메라(손 제스처 · 스켈레톤) 값을 허브에서 읽기
#
# 브라우저의 MediaPipe 가 계산한 결과를 rm_link 로 받습니다.
# 좌표는 화면 기준 0~100 (왼쪽/위가 0) 입니다.

import rm_link

# 제스처 번호 (웹 에디터와 동일하게 유지)
NONE = 0
FIST = 1         # 주먹 (Closed_Fist)
OPEN = 2         # 손바닥 (Open_Palm)
POINT_UP = 3     # 검지 위로 (Pointing_Up)
THUMB_DOWN = 4   # 엄지 아래 (Thumb_Down)
THUMB_UP = 5     # 엄지 위 (Thumb_Up)
VICTORY = 6      # 브이 (Victory)
LOVE = 7         # 사랑해 (ILoveYou)

# ---------- 손 ----------

def hand_detected():
    return rm_link.get("H", 0) == 1


def gesture():
    return rm_link.get("H", 1)


def is_gesture(g):
    return hand_detected() and gesture() == g


def hand_x():
    return rm_link.get("H", 2, 50)


def hand_y():
    return rm_link.get("H", 3, 50)


def finger_count():
    return rm_link.get("H", 4)


# ---------- 스켈레톤(포즈) ----------

def pose_detected():
    return rm_link.get("P", 0) == 1


def nose_x():
    return rm_link.get("P", 1, 50)


def nose_y():
    return rm_link.get("P", 2, 50)


def left_hand_up():
    return rm_link.get("P", 3) == 1


def right_hand_up():
    return rm_link.get("P", 4) == 1


def both_hands_up():
    return left_hand_up() and right_hand_up()


def body_x():
    return rm_link.get("P", 5, 50)


def shoulder_tilt():
    """어깨 기울기(도). 오른쪽으로 기울면 +, 왼쪽이면 -."""
    return rm_link.get("P", 6)


def arms_spread():
    return rm_link.get("P", 7) == 1


# ---------- 사물 인식 (COCO 80종) ----------
# O: [개수, 번호1, X1, Y1, 크기1, 확신도1, 번호2 ..., 번호3 ...]  (확신도 높은 순서, 최대 3개)
# 사물 번호는 웹 에디터의 COCO 목록 순서 + 1 (예: 1 = 사람, 42 = 컵)

def _objects():
    v = rm_link.values("O")
    out = []
    if not v:
        return out
    for i in range(min(v[0], 3)):
        j = 1 + i * 5
        if j + 4 < len(v):
            out.append(v[j:j + 5])
    return out


def object_seen(n=0):
    """사물 n 번이 보이면 True (n=0 이면 아무 사물이나)."""
    for o in _objects():
        if n == 0 or o[0] == n:
            return True
    return False


def object_value(n=0, what=1):
    """사물 n 번의 값 (n=0 이면 가장 확실한 사물). what: 0=번호 1=X 2=Y 3=크기 4=확신도. 안 보이면 0."""
    for o in _objects():
        if n == 0 or o[0] == n:
            return o[what]
    return 0


def object_count():
    return len(_objects())


# ---------- 사물 학습 ----------
# T: [학습한 사물 번호(0=학습 안 함), 확신도]

def taught():
    return rm_link.get("T", 0)


def taught_is(n):
    return taught() == n


def taught_conf():
    return rm_link.get("T", 1)


# ---------- 색 인식 (화면 가운데) ----------
# C: [색 번호, R, G, B]   색 번호: 0 없음 1 빨강 2 주황 3 노랑 4 초록 5 하늘 6 파랑 7 보라 8 자홍 9 흰색 10 검정
NO_COLOR, RED, ORANGE, YELLOW, GREEN, CYAN, BLUE, VIOLET, MAGENTA, WHITE, BLACK = range(11)


def center_color():
    return rm_link.get("C", 0)


def center_color_is(c):
    return center_color() == c


def center_rgb(i):
    """i: 0=R 1=G 2=B (0~255)"""
    return rm_link.get("C", 1 + i)


# ---------- 색 학습 (학습한 색 덩어리 추적, 최대 5가지) ----------
# K: [보임1, X1, Y1, 크기1, 보임2, ...]   크기 = 화면에서 차지하는 비율(%)

def learned_color_seen(n):
    return rm_link.get("K", (n - 1) * 4) == 1


def learned_color_value(n, what):
    """what: 1=X 2=Y 3=크기(%). 안 보이면 X·Y 는 50, 크기는 0."""
    if not learned_color_seen(n):
        return 0 if what == 3 else 50
    return rm_link.get("K", (n - 1) * 4 + what)

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

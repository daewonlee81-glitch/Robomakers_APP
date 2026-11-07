from pybricks import log
class DriveBase:
    def __init__(self, left_motor, right_motor, wheel_diameter, axle_track):
        assert type(left_motor).__name__ == "Motor" and left_motor is not right_motor
        float(wheel_diameter); float(axle_track); log("DriveBase", wheel_diameter, axle_track)
    def straight(self, distance, then=None, wait=True): float(distance); log("straight", distance)
    def turn(self, angle, then=None, wait=True): float(angle); log("turn", angle)
    def drive(self, speed, turn_rate): float(speed); float(turn_rate); log("drive", speed, turn_rate)
    def stop(self): log("db stop")
    def settings(self, straight_speed=None, straight_acceleration=None, turn_rate=None, turn_acceleration=None): log("settings")
    def distance(self): return 0
    def angle(self): return 0
    def reset(self, distance=0, angle=0): pass
    def use_gyro(self, use_gyro): assert isinstance(use_gyro, bool); log("use_gyro", use_gyro)

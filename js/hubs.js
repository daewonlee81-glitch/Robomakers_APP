// hubs.js — 허브별 설정 (포트, 클래스, 연결 방식, 지원 기능)

export const HUBS = {
  prime: {
    label: 'SPIKE Prime',
    cls: 'PrimeHub',
    devices: 'pybricks.pupdevices',
    transport: ['ble', 'usb'],
    motorPorts: ['A', 'B', 'C', 'D', 'E', 'F'],
    sensorPorts: ['A', 'B', 'C', 'D', 'E', 'F'],
    sensors: ['color', 'ultrasonic', 'force'],
    display: 'matrix',
    imu: true,
    speaker: true,
    buttons: [['왼쪽', 'LEFT'], ['오른쪽', 'RIGHT'], ['블루투스', 'BLUETOOTH']],
    xbox: true,
    lpf2: true,
  },
  essential: {
    label: 'SPIKE Essential',
    cls: 'EssentialHub',
    devices: 'pybricks.pupdevices',
    transport: ['ble'],
    motorPorts: ['A', 'B'],
    sensorPorts: ['A', 'B'],
    sensors: ['color', 'ultrasonic', 'force'],
    display: null,
    imu: true,
    speaker: false,
    buttons: [],
    xbox: true,
    lpf2: true,
  },
  ev3: {
    label: 'EV3',
    cls: 'EV3Brick',
    devices: 'pybricks.ev3devices',
    transport: ['usb'],
    motorPorts: ['A', 'B', 'C', 'D'],
    sensorPorts: ['S1', 'S2', 'S3', 'S4'],
    sensors: ['ev3color', 'ev3ultrasonic', 'touch', 'gyro'],
    display: 'screen',
    imu: false,
    speaker: true,
    buttons: [['왼쪽', 'LEFT'], ['오른쪽', 'RIGHT'], ['위', 'UP'], ['아래', 'DOWN']],
    xbox: false,
    lpf2: false,
  },
};

let current = 'prime';

export function getHubKey() {
  return current;
}
export function setHubKey(k) {
  if (HUBS[k]) current = k;
}
export function hub() {
  return HUBS[current];
}

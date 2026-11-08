// blocks.js — 로보메이커스 워드블럭 정의 + 파이썬(Pybricks) 생성기
/* global Blockly, python */

import { hub } from './hubs.js?v=0.3.2';
import { t, cocoLabel } from './i18n.js?v=0.3.2';
import { OBJ_PICK, cocoId, TEACH_CLASSES, COLOR_SLOTS } from './aicam.js?v=0.3.2';

const G = python.pythonGenerator;
const O = python.Order;
G.INDENT = '    ';

// 한글 변수·함수 이름을 그대로 씁니다 (MicroPython 은 유니코드 식별자를 지원).
Blockly.Names.prototype.safeName = function (name) {
  if (!name) return 'unnamed';
  let n = String(name).trim().replace(/[^\p{L}\p{N}_]/gu, '_');
  if (/^\p{N}/u.test(n)) n = 'my_' + n;
  return n;
};

// ───────────────────────── 색 (SPIKE 앱 느낌) ─────────────────────────
export const C = {
  event: '#FFBF00',
  motor: '#0090F5',
  drive: '#FF4CCD',
  sensor: '#2BB5D6',
  hub: '#9966FF',
  sound: '#CF63CF',
  control: '#FFAB19',
  ai: '#00A88F',
  pad: '#4C5866',
  husky: '#E6553A',
  esp: '#3D7A3A',
  text: '#5CB1D6',
};

// ───────────────────────── 드롭다운 옵션 ─────────────────────────
const motorPorts = () => hub().motorPorts.map((p) => [p, p]);
const sensorPorts = () => hub().sensorPorts.map((p) => [p, p]);
const lpfPorts = () => (hub().lpf2 ? hub().sensorPorts : ['A']).map((p) => [p, p]);
const COLOR_KEYS = ['RED', 'ORANGE', 'YELLOW', 'GREEN', 'CYAN', 'BLUE', 'VIOLET', 'MAGENTA', 'WHITE', 'BLACK', 'BROWN', 'NONE'];
const opts = (group, keys) => keys.map((k) => [t(`o.${group}.${k}`), k]);
const COLORS = () => opts('color', COLOR_KEYS);
const ICONS = () => opts('icon', ['HAPPY', 'SAD', 'HEART', 'ARROW_UP', 'ARROW_DOWN', 'ARROW_LEFT', 'ARROW_RIGHT', 'SQUARE', 'CIRCLE', 'TRUE', 'FALSE', 'FULL']);
const hubButtons = () => (hub().buttons.length ? hub().buttons.map((b) => [t('o.btn.' + b[1]), b[1]]) : [[t('o.btn.NONE'), 'NONE']]);
const padSources = () => {
  const o = ['web'];
  if (hub().xbox) o.push('xbox');
  if (hub().lpf2) o.push('esp32');
  return opts('src', o);
};

const dd = (name, options) => ({ type: 'field_dropdown', name, options });
const num = (name, check = 'Number') => ({ type: 'input_value', name, check });

// ───────────────────────── 블록 정의 헬퍼 ─────────────────────────
function def(type, colour, _unused, args0, kind, extra = {}) {
  // 문구는 언어 파일의 'b.<블록>' 키, 도움말은 'b.<블록>.tip' 키에서 가져옵니다.
  const tipKey = `b.${type}.tip`;
  const tip = t(tipKey);
  const json = { type, message0: t('b.' + type), args0, colour, inputsInline: true, ...extra };
  if (tip !== tipKey) json.tooltip = tip;
  else delete json.tooltip;
  if (kind === 'stmt') {
    json.previousStatement = null;
    json.nextStatement = null;
  } else if (kind === 'num') {
    json.output = 'Number';
  } else if (kind === 'bool') {
    json.output = 'Boolean';
  } else if (kind === 'any') {
    json.output = null;
  } else if (kind === 'hat') {
    json.nextStatement = null;
  }
  Blockly.Blocks[type] = {
    init() {
      this.jsonInit(json);
    },
  };
}

// ───────────────────────── 생성기 헬퍼 ─────────────────────────
function imp(mod, name) {
  if (!G.rmImports_.has(mod)) G.rmImports_.set(mod, new Set());
  if (name) G.rmImports_.get(mod).add(name);
}
function impModule(mod) {
  G.rmPlainImports_.add(mod);
}
function setup(key, line, force = false) {
  if (force || !G.rmSetup_.has(key)) G.rmSetup_.set(key, line);
}
function port(p) {
  imp('pybricks.parameters', 'Port');
  return `Port.${p}`;
}
function hubObj() {
  const h = hub();
  imp('pybricks.hubs', h.cls);
  setup('hub', `hub = ${h.cls}()`);
  return 'hub';
}
function waitImp() {
  imp('pybricks.tools', 'wait');
  return 'wait';
}
function motor(p) {
  imp(hub().devices, 'Motor');
  setup('motor_' + p, `motor_${p} = Motor(${port(p)})`);
  return 'motor_' + p;
}
const SENSOR_CLASS = {
  color: ['ColorSensor', 'color'],
  ultrasonic: ['UltrasonicSensor', 'ultra'],
  force: ['ForceSensor', 'force'],
  ev3color: ['ColorSensor', 'color'],
  ev3ultrasonic: ['UltrasonicSensor', 'ultra'],
  touch: ['TouchSensor', 'touch'],
  gyro: ['GyroSensor', 'gyro'],
};
function sensor(kind, p) {
  const [cls, prefix] = SENSOR_CLASS[kind];
  imp(hub().devices, cls);
  const v = `${prefix}_${p}`;
  setup(v, `${v} = ${cls}(${port(p)})`);
  return v;
}
function val(block, name, order = O.NONE, dflt = '0') {
  return G.valueToCode(block, name, order) || dflt;
}
function isNum(code) {
  return /^-?\d+(\.\d+)?$/.test(code);
}
function times(code, k) {
  if (isNum(code)) return String(+(parseFloat(code) * k).toFixed(3));
  return `${code} * ${k}`;
}
function str(s) {
  return G.quote_(String(s));
}
function pad() {
  imp('rm_pad', 'Gamepad');
  setup('pad', 'pad = Gamepad("web")');
  return 'pad';
}

// ════════════════════════ 이벤트 ════════════════════════
def('rm_start', C.event, null, [], 'hat');
G.forBlock['rm_start'] = () => '';

// ════════════════════════ 모터 ════════════════════════
def('rm_motor_setup', C.motor, null,
  [dd('PORT', motorPorts), dd('DIR', () => opts('dir', ['CLOCKWISE', 'COUNTERCLOCKWISE']))], 'stmt');
G.forBlock['rm_motor_setup'] = (b) => {
  const p = b.getFieldValue('PORT');
  imp(hub().devices, 'Motor');
  imp('pybricks.parameters', 'Direction');
  setup('motor_' + p, `motor_${p} = Motor(${port(p)}, Direction.${b.getFieldValue('DIR')})`, true);
  return '';
};

def('rm_motor_run', C.motor, null, [dd('PORT', motorPorts), num('SPEED')], 'stmt');
G.forBlock['rm_motor_run'] = (b) => `${motor(b.getFieldValue('PORT'))}.run(${times(val(b, 'SPEED', O.MULTIPLICATIVE, '50'), 10)})\n`;

def('rm_motor_power', C.motor, null, [dd('PORT', motorPorts), num('POWER')], 'stmt');
G.forBlock['rm_motor_power'] = (b) => `${motor(b.getFieldValue('PORT'))}.dc(${val(b, 'POWER', O.NONE, '50')})\n`;

def('rm_motor_run_for', C.motor, null,
  [dd('PORT', motorPorts), num('SPEED'), num('AMOUNT'),
    dd('UNIT', () => opts('unit', ['deg', 'rot', 'sec'])),
    dd('WAIT', () => opts('wait', ['True', 'False']))], 'stmt');
G.forBlock['rm_motor_run_for'] = (b) => {
  const m = motor(b.getFieldValue('PORT'));
  const s = times(val(b, 'SPEED', O.MULTIPLICATIVE, '50'), 10);
  const a = val(b, 'AMOUNT', O.MULTIPLICATIVE, '360');
  const w = b.getFieldValue('WAIT');
  switch (b.getFieldValue('UNIT')) {
    case 'rot': return `${m}.run_angle(${s}, ${times(a, 360)}, wait=${w})\n`;
    case 'sec': return `${m}.run_time(${s}, ${times(a, 1000)}, wait=${w})\n`;
    default: return `${m}.run_angle(${s}, ${a}, wait=${w})\n`;
  }
};

def('rm_motor_target', C.motor, null, [dd('PORT', motorPorts), num('SPEED'), num('ANGLE')], 'stmt');
G.forBlock['rm_motor_target'] = (b) =>
  `${motor(b.getFieldValue('PORT'))}.run_target(${times(val(b, 'SPEED', O.MULTIPLICATIVE, '50'), 10)}, ${val(b, 'ANGLE', O.NONE, '0')})\n`;

def('rm_motor_stop', C.motor, null, [dd('PORT', motorPorts),
  dd('MODE', () => opts('stop', ['stop', 'brake', 'hold']))], 'stmt');
G.forBlock['rm_motor_stop'] = (b) => `${motor(b.getFieldValue('PORT'))}.${b.getFieldValue('MODE')}()\n`;

def('rm_motor_reset', C.motor, null, [dd('PORT', motorPorts)], 'stmt');
G.forBlock['rm_motor_reset'] = (b) => `${motor(b.getFieldValue('PORT'))}.reset_angle(0)\n`;

def('rm_motor_value', C.motor, null, [dd('PORT', motorPorts), dd('WHAT', () => opts('mval', ['angle', 'speed']))], 'num');
G.forBlock['rm_motor_value'] = (b) => [`${motor(b.getFieldValue('PORT'))}.${b.getFieldValue('WHAT')}()`, O.FUNCTION_CALL];

// ════════════════════════ 주행 (DriveBase) ════════════════════════
def('rm_drive_setup', C.drive, null,
  [dd('L', motorPorts), dd('R', motorPorts), { type: 'field_number', name: 'WD', value: 56, min: 1 },
    { type: 'field_number', name: 'AT', value: 112, min: 1 }, { type: 'field_checkbox', name: 'GYRO', checked: false }], 'stmt');
G.forBlock['rm_drive_setup'] = (b) => {
  const L = b.getFieldValue('L');
  const R = b.getFieldValue('R');
  imp(hub().devices, 'Motor');
  imp('pybricks.parameters', 'Direction');
  imp('pybricks.robotics', 'DriveBase');
  setup('motor_' + L, `motor_${L} = Motor(${port(L)}, Direction.COUNTERCLOCKWISE)`, true);
  setup('motor_' + R, `motor_${R} = Motor(${port(R)}, Direction.CLOCKWISE)`, true);
  setup('drive', `drive_base = DriveBase(motor_${L}, motor_${R}, wheel_diameter=${b.getFieldValue('WD')}, axle_track=${b.getFieldValue('AT')})`, true);
  if (b.getFieldValue('GYRO') === 'TRUE' && hub().imu) return 'drive_base.use_gyro(True)\n';
  return '';
};
const driveBase = () => {
  if (!G.rmSetup_.has('drive')) {
    const ports = hub().motorPorts;
    const L = ports[0];
    const R = ports[1];
    imp(hub().devices, 'Motor');
    imp('pybricks.parameters', 'Direction');
    imp('pybricks.robotics', 'DriveBase');
    setup('motor_' + L, `motor_${L} = Motor(${port(L)}, Direction.COUNTERCLOCKWISE)`, true);
    setup('motor_' + R, `motor_${R} = Motor(${port(R)}, Direction.CLOCKWISE)`, true);
    setup('drive', `drive_base = DriveBase(motor_${L}, motor_${R}, wheel_diameter=56, axle_track=112)`);
  }
  return 'drive_base';
};

def('rm_drive_straight', C.drive, null, [num('DIST')], 'stmt');
G.forBlock['rm_drive_straight'] = (b) => `${driveBase()}.straight(${val(b, 'DIST', O.NONE, '100')})\n`;

def('rm_drive_turn', C.drive, null, [num('ANGLE')], 'stmt');
G.forBlock['rm_drive_turn'] = (b) => `${driveBase()}.turn(${val(b, 'ANGLE', O.NONE, '90')})\n`;

def('rm_drive_drive', C.drive, null, [num('SPEED'), num('TURN')], 'stmt');
G.forBlock['rm_drive_drive'] = (b) => `${driveBase()}.drive(${val(b, 'SPEED', O.NONE, '150')}, ${val(b, 'TURN', O.NONE, '0')})\n`;

def('rm_drive_stop', C.drive, null, [], 'stmt');
G.forBlock['rm_drive_stop'] = () => `${driveBase()}.stop()\n`;

def('rm_drive_settings', C.drive, null, [num('SPEED'), num('TURN')], 'stmt');
G.forBlock['rm_drive_settings'] = (b) =>
  `${driveBase()}.settings(straight_speed=${val(b, 'SPEED', O.NONE, '200')}, turn_rate=${val(b, 'TURN', O.NONE, '150')})\n`;

def('rm_drive_value', C.drive, null, [dd('WHAT', () => opts('dval', ['distance', 'angle']))], 'num');
G.forBlock['rm_drive_value'] = (b) => [`${driveBase()}.${b.getFieldValue('WHAT')}()`, O.FUNCTION_CALL];

def('rm_drive_reset', C.drive, null, [], 'stmt');
G.forBlock['rm_drive_reset'] = () => `${driveBase()}.reset()\n`;

// ════════════════════════ 센서 ════════════════════════
def('rm_color_is', C.sensor, null, [dd('PORT', sensorPorts), dd('COLOR', COLORS)], 'bool');
G.forBlock['rm_color_is'] = (b) => {
  const s = sensor(hub().devices.includes('ev3') ? 'ev3color' : 'color', b.getFieldValue('PORT'));
  imp('pybricks.parameters', 'Color');
  return [`${s}.color() == Color.${b.getFieldValue('COLOR')}`, O.RELATIONAL];
};

def('rm_color_value', C.sensor, null, [dd('PORT', sensorPorts),
  dd('WHAT', () => opts('cval', ['reflection', 'ambient']))], 'num');
G.forBlock['rm_color_value'] = (b) => {
  const s = sensor(hub().devices.includes('ev3') ? 'ev3color' : 'color', b.getFieldValue('PORT'));
  return [`${s}.${b.getFieldValue('WHAT')}()`, O.FUNCTION_CALL];
};

def('rm_ultra_distance', C.sensor, null, [dd('PORT', sensorPorts)], 'num');
G.forBlock['rm_ultra_distance'] = (b) => {
  const s = sensor(hub().devices.includes('ev3') ? 'ev3ultrasonic' : 'ultrasonic', b.getFieldValue('PORT'));
  return [`${s}.distance()`, O.FUNCTION_CALL];
};

def('rm_force_pressed', C.sensor, null, [dd('PORT', sensorPorts)], 'bool');
G.forBlock['rm_force_pressed'] = (b) => [`${sensor('force', b.getFieldValue('PORT'))}.pressed()`, O.FUNCTION_CALL];

def('rm_force_value', C.sensor, null, [dd('PORT', sensorPorts)], 'num');
G.forBlock['rm_force_value'] = (b) => [`${sensor('force', b.getFieldValue('PORT'))}.force()`, O.FUNCTION_CALL];

def('rm_touch_pressed', C.sensor, null, [dd('PORT', sensorPorts)], 'bool');
G.forBlock['rm_touch_pressed'] = (b) => [`${sensor('touch', b.getFieldValue('PORT'))}.pressed()`, O.FUNCTION_CALL];

def('rm_gyro_value', C.sensor, null, [dd('PORT', sensorPorts), dd('WHAT', () => opts('gval', ['angle', 'speed']))], 'num');
G.forBlock['rm_gyro_value'] = (b) => [`${sensor('gyro', b.getFieldValue('PORT'))}.${b.getFieldValue('WHAT')}()`, O.FUNCTION_CALL];

def('rm_gyro_reset', C.sensor, null, [dd('PORT', sensorPorts)], 'stmt');
G.forBlock['rm_gyro_reset'] = (b) => `${sensor('gyro', b.getFieldValue('PORT'))}.reset_angle(0)\n`;

// 허브 IMU
def('rm_imu_value', C.sensor, null, [dd('WHAT', () => opts('imu', ['heading', 'pitch', 'roll']))], 'num');
G.forBlock['rm_imu_value'] = (b) => {
  const h = hubObj();
  const w = b.getFieldValue('WHAT');
  if (w === 'heading') return [`${h}.imu.heading()`, O.FUNCTION_CALL];
  return [`${h}.imu.tilt()[${w === 'pitch' ? 0 : 1}]`, O.MEMBER];
};
def('rm_imu_reset', C.sensor, null, [], 'stmt');
G.forBlock['rm_imu_reset'] = () => `${hubObj()}.imu.reset_heading(0)\n`;

def('rm_hub_button', C.sensor, null, [dd('BTN', hubButtons)], 'bool');
G.forBlock['rm_hub_button'] = (b) => {
  imp('pybricks.parameters', 'Button');
  return [`Button.${b.getFieldValue('BTN')} in ${hubObj()}.buttons.pressed()`, O.RELATIONAL];
};

def('rm_timer_value', C.sensor, null, [], 'num');
G.forBlock['rm_timer_value'] = () => {
  imp('pybricks.tools', 'StopWatch');
  setup('timer', 'timer = StopWatch()');
  return ['timer.time() / 1000', O.MULTIPLICATIVE];
};
def('rm_timer_reset', C.sensor, null, [], 'stmt');
G.forBlock['rm_timer_reset'] = () => {
  imp('pybricks.tools', 'StopWatch');
  setup('timer', 'timer = StopWatch()');
  return 'timer.reset()\n';
};

// ════════════════════════ 허브: 화면 / 빛 / 소리 ════════════════════════
def('rm_display_text', C.hub, null, [{ type: 'input_value', name: 'TEXT' }], 'stmt');
G.forBlock['rm_display_text'] = (b) => {
  const h = hubObj();
  const t = val(b, 'TEXT', O.NONE, '""');
  if (hub().display === 'screen') return `${h}.screen.print(${t})\n`;
  return `${h}.display.text(str(${t}))\n`;
};
def('rm_display_number', C.hub, null, [num('NUM')], 'stmt');
G.forBlock['rm_display_number'] = (b) => {
  const h = hubObj();
  const n = val(b, 'NUM', O.NONE, '0');
  if (hub().display === 'screen') return `${h}.screen.print(${n})\n`;
  return `${h}.display.number(${n})\n`;
};
def('rm_display_icon', C.hub, null, [dd('ICON', ICONS)], 'stmt');
G.forBlock['rm_display_icon'] = (b) => {
  imp('pybricks.parameters', 'Icon');
  return `${hubObj()}.display.icon(Icon.${b.getFieldValue('ICON')})\n`;
};
def('rm_display_pixel', C.hub, null, [num('ROW'), num('COL'), num('BRIGHT')], 'stmt');
G.forBlock['rm_display_pixel'] = (b) =>
  `${hubObj()}.display.pixel(${val(b, 'ROW')}, ${val(b, 'COL')}, ${val(b, 'BRIGHT', O.NONE, '100')})\n`;
def('rm_display_clear', C.hub, null, [], 'stmt');
G.forBlock['rm_display_clear'] = () => {
  const h = hubObj();
  return hub().display === 'screen' ? `${h}.screen.clear()\n` : `${h}.display.off()\n`;
};
def('rm_light', C.hub, null, [dd('COLOR', () => COLORS().filter((c) => !['BLACK', 'BROWN', 'NONE'].includes(c[1])))], 'stmt');
G.forBlock['rm_light'] = (b) => {
  imp('pybricks.parameters', 'Color');
  return `${hubObj()}.light.on(Color.${b.getFieldValue('COLOR')})\n`;
};
def('rm_light_off', C.hub, null, [], 'stmt');
G.forBlock['rm_light_off'] = () => `${hubObj()}.light.off()\n`;
def('rm_beep', C.sound, null, [num('FREQ'), num('SEC')], 'stmt');
G.forBlock['rm_beep'] = (b) => `${hubObj()}.speaker.beep(${val(b, 'FREQ', O.NONE, '500')}, ${times(val(b, 'SEC', O.MULTIPLICATIVE, '0.2'), 1000)})\n`;
def('rm_print', C.text, null, [{ type: 'input_value', name: 'TEXT' }], 'stmt');
G.forBlock['rm_print'] = (b) => `print(${val(b, 'TEXT', O.NONE, '""')})\n`;

// ════════════════════════ 제어 ════════════════════════
def('rm_wait', C.control, null, [num('SEC')], 'stmt');
G.forBlock['rm_wait'] = (b) => `${waitImp()}(${times(val(b, 'SEC', O.MULTIPLICATIVE, '1'), 1000)})\n`;

def('rm_forever', C.control, null, [{ type: 'input_dummy' }, { type: 'input_statement', name: 'DO' }], null,
  { previousStatement: null, inputsInline: false });
G.forBlock['rm_forever'] = (b) => {
  const body = G.statementToCode(b, 'DO') || G.INDENT + 'pass\n';
  return `while True:\n${body}${G.INDENT}${waitImp()}(10)\n`;
};

def('rm_wait_until', C.control, null, [{ type: 'input_value', name: 'COND', check: 'Boolean' }], 'stmt');
G.forBlock['rm_wait_until'] = (b) => `while not (${val(b, 'COND', O.NONE, 'True')}):\n${G.INDENT}${waitImp()}(10)\n`;

def('rm_end', C.control, null, [], null, { previousStatement: null });
G.forBlock['rm_end'] = () => 'raise SystemExit\n';

// ════════════════════════ AI 카메라 ════════════════════════
const GESTURES = () => [['FIST', 1], ['OPEN', 2], ['POINT_UP', 3], ['THUMB_UP', 5], ['THUMB_DOWN', 4], ['VICTORY', 6], ['LOVE', 7]].map(([k, n]) => [t('g.' + n), k]);
def('rm_ai_gesture', C.ai, null, [dd('G', GESTURES)], 'bool');
G.forBlock['rm_ai_gesture'] = (b) => {
  impModule('rm_aicam');
  return [`rm_aicam.is_gesture(rm_aicam.${b.getFieldValue('G')})`, O.FUNCTION_CALL];
};
def('rm_ai_hand_detected', C.ai, null, [], 'bool');
G.forBlock['rm_ai_hand_detected'] = () => {
  impModule('rm_aicam');
  return ['rm_aicam.hand_detected()', O.FUNCTION_CALL];
};
def('rm_ai_hand_value', C.ai, null, [dd('WHAT', () => opts('hand', ['hand_x', 'hand_y', 'finger_count', 'gesture']))], 'num');
G.forBlock['rm_ai_hand_value'] = (b) => {
  impModule('rm_aicam');
  return [`rm_aicam.${b.getFieldValue('WHAT')}()`, O.FUNCTION_CALL];
};
def('rm_ai_pose_bool', C.ai, null, [dd('WHAT', () => opts('poseb', ['pose_detected', 'left_hand_up', 'right_hand_up', 'both_hands_up', 'arms_spread']))], 'bool');
G.forBlock['rm_ai_pose_bool'] = (b) => {
  impModule('rm_aicam');
  return [`rm_aicam.${b.getFieldValue('WHAT')}()`, O.FUNCTION_CALL];
};
def('rm_ai_pose_value', C.ai, null, [dd('WHAT', () => opts('posev', ['body_x', 'nose_x', 'nose_y', 'shoulder_tilt']))], 'num');
G.forBlock['rm_ai_pose_value'] = (b) => {
  impModule('rm_aicam');
  return [`rm_aicam.${b.getFieldValue('WHAT')}()`, O.FUNCTION_CALL];
};

// ── 사물 인식 · 사물 학습 · 색 인식 · 색 학습 ──
const objOptions = () => [[t('coco.any'), '0'], ...OBJ_PICK.map((n) => [cocoLabel(cocoId(n) - 1), String(cocoId(n))])];
export function teachNames() {
  try {
    return JSON.parse(localStorage.getItem('rm-teach-names') || '[]');
  } catch (e) {
    return [];
  }
}
const teachOptions = () => {
  const names = teachNames();
  return Array.from({ length: TEACH_CLASSES }, (_, i) => [names[i] || t('teach.class', i + 1), String(i + 1)]);
};
const colorSlotOptions = () => Array.from({ length: COLOR_SLOTS }, (_, i) => [t('color.slot', i + 1), String(i + 1)]);
const aicam = () => {
  impModule('rm_aicam');
  return 'rm_aicam';
};

def('rm_ai_obj_seen', C.ai, null, [dd('OBJ', objOptions)], 'bool');
G.forBlock['rm_ai_obj_seen'] = (b) => [`${aicam()}.object_seen(${b.getFieldValue('OBJ')})`, O.FUNCTION_CALL];
def('rm_ai_obj_value', C.ai, null, [dd('OBJ', objOptions), dd('WHAT', () => [
  [t('o.objv.x'), '1'], [t('o.objv.y'), '2'], [t('o.objv.size'), '3'], [t('o.objv.score'), '4'], [t('o.objv.id'), '0']])], 'num');
G.forBlock['rm_ai_obj_value'] = (b) => [`${aicam()}.object_value(${b.getFieldValue('OBJ')}, ${b.getFieldValue('WHAT')})`, O.FUNCTION_CALL];

def('rm_ai_teach_is', C.ai, null, [dd('N', teachOptions)], 'bool');
G.forBlock['rm_ai_teach_is'] = (b) => [`${aicam()}.taught_is(${b.getFieldValue('N')})`, O.FUNCTION_CALL];
def('rm_ai_teach_value', C.ai, null, [dd('WHAT', () => opts('teachv', ['taught', 'taught_conf']))], 'num');
G.forBlock['rm_ai_teach_value'] = (b) => [`${aicam()}.${b.getFieldValue('WHAT')}()`, O.FUNCTION_CALL];

def('rm_ai_color_is', C.ai, null, [dd('COLOR', () => opts('color', ['RED', 'ORANGE', 'YELLOW', 'GREEN', 'CYAN', 'BLUE', 'VIOLET', 'MAGENTA', 'WHITE', 'BLACK']))], 'bool');
G.forBlock['rm_ai_color_is'] = (b) => [`${aicam()}.center_color_is(rm_aicam.${b.getFieldValue('COLOR')})`, O.FUNCTION_CALL];
def('rm_ai_color_value', C.ai, null, [dd('WHAT', () => [[t('o.colorv.id'), 'id'], [t('o.colorv.r'), '0'], [t('o.colorv.g'), '1'], [t('o.colorv.b'), '2']])], 'num');
G.forBlock['rm_ai_color_value'] = (b) => {
  const w = b.getFieldValue('WHAT');
  return [w === 'id' ? `${aicam()}.center_color()` : `${aicam()}.center_rgb(${w})`, O.FUNCTION_CALL];
};

def('rm_ai_lcolor_seen', C.ai, null, [dd('N', colorSlotOptions)], 'bool');
G.forBlock['rm_ai_lcolor_seen'] = (b) => [`${aicam()}.learned_color_seen(${b.getFieldValue('N')})`, O.FUNCTION_CALL];
def('rm_ai_lcolor_value', C.ai, null, [dd('N', colorSlotOptions), dd('WHAT', () => [[t('o.objv.x'), '1'], [t('o.objv.y'), '2'], [t('o.lcolv.size'), '3']])], 'num');
G.forBlock['rm_ai_lcolor_value'] = (b) => [`${aicam()}.learned_color_value(${b.getFieldValue('N')}, ${b.getFieldValue('WHAT')})`, O.FUNCTION_CALL];

// ════════════════════════ 게임패드 ════════════════════════
def('rm_pad_setup', C.pad, null, [dd('SRC', padSources), dd('PORT', lpfPorts)], 'stmt');
G.forBlock['rm_pad_setup'] = (b) => {
  imp('rm_pad', 'Gamepad');
  const src = b.getFieldValue('SRC');
  if (src === 'esp32') {
    impModule('bluepad'); // LMS-ESP32 BluePad32 (안톤 마인드스톰)
    setup('pad', `pad = Gamepad("esp32", ${port(b.getFieldValue('PORT'))})`, true);
  }
  else setup('pad', `pad = Gamepad("${src}")`, true);
  return '';
};
def('rm_pad_stick', C.pad, null, [dd('AXIS', () => opts('axis', ['LY', 'LX', 'RY', 'RX']))], 'num');
G.forBlock['rm_pad_stick'] = (b) => [`${pad()}.stick("${b.getFieldValue('AXIS')}")`, O.FUNCTION_CALL];
def('rm_pad_trigger', C.pad, null, [dd('SIDE', () => opts('side', ['L', 'R']))], 'num');
G.forBlock['rm_pad_trigger'] = (b) => [`${pad()}.trigger("${b.getFieldValue('SIDE')}")`, O.FUNCTION_CALL];
def('rm_pad_pressed', C.pad, null, [dd('BTN', () => [['A / ✕', 'A'], ['B / ○', 'B'], ['X / □', 'X'], ['Y / △', 'Y'], ['LB / L1', 'LB'], ['RB / R1', 'RB'],
  ...opts('pbtn', ['UP', 'DOWN', 'LEFT', 'RIGHT']), ['VIEW / SHARE', 'VIEW'], ['MENU / OPTIONS', 'MENU']])], 'bool');
G.forBlock['rm_pad_pressed'] = (b) => [`${pad()}.pressed("${b.getFieldValue('BTN')}")`, O.FUNCTION_CALL];
def('rm_pad_tank', C.pad, null, [dd('L', motorPorts), dd('R', motorPorts)], 'stmt');
G.forBlock['rm_pad_tank'] = (b) => {
  const p = pad();
  const L = motor(b.getFieldValue('L'));
  const R = motor(b.getFieldValue('R'));
  return `left_power, right_power = ${p}.tank()\n${L}.dc(left_power)\n${R}.dc(right_power)\n`;
};
def('rm_pad_connected', C.pad, null, [], 'bool');
G.forBlock['rm_pad_connected'] = () => [`${pad()}.connected()`, O.FUNCTION_CALL];
def('rm_pad_rumble', C.pad, null, [num('POWER'), num('SEC')], 'stmt');
G.forBlock['rm_pad_rumble'] = (b) => `${pad()}.rumble(${val(b, 'POWER', O.NONE, '50')}, ${times(val(b, 'SEC', O.MULTIPLICATIVE, '0.2'), 1000)})\n`;

// ════════════════════════ 허스키렌즈 ════════════════════════
const husky = (p) => {
  imp('rm_husky', 'HuskyLens');
  setup('husky_' + p, `husky_${p} = HuskyLens(${port(p)})`);
  return 'husky_' + p;
};
def('rm_husky_detected', C.husky, null, [dd('PORT', lpfPorts), num('ID')], 'bool');
G.forBlock['rm_husky_detected'] = (b) => [`${husky(b.getFieldValue('PORT'))}.detected(${val(b, 'ID', O.NONE, '0')})`, O.FUNCTION_CALL];
def('rm_husky_value', C.husky, null, [dd('PORT', lpfPorts), dd('WHAT', () => opts('husky', ['id', 'x', 'y', 'width', 'offset']))], 'num');
G.forBlock['rm_husky_value'] = (b) => [`${husky(b.getFieldValue('PORT'))}.${b.getFieldValue('WHAT')}()`, O.FUNCTION_CALL];
def('rm_husky_line', C.husky, null, [dd('PORT', lpfPorts), dd('WHAT', () => opts('line', ['line_start_x', 'line_end_x', 'line_end_y']))], 'num');
G.forBlock['rm_husky_line'] = (b) => [`${husky(b.getFieldValue('PORT'))}.${b.getFieldValue('WHAT')}()`, O.FUNCTION_CALL];

// ════════════════════════ ESP32 (안톤 마인드스톰 PUPRemote) ════════════════════════
const esp = (p) => {
  imp('rm_esp32', 'ESP32');
  setup('esp32_' + p, `esp32_${p} = ESP32(${port(p)}${G.rmEspIo_?.has(p) ? ', io=True' : ''})`);
  return 'esp32_' + p;
};
def('rm_esp_channel', C.esp, null, [dd('PORT', lpfPorts),
  { type: 'field_input', name: 'NAME', text: 'line' }, { type: 'field_input', name: 'FMT', text: 'hhb' }], 'stmt');
G.forBlock['rm_esp_channel'] = (b) => `${esp(b.getFieldValue('PORT'))}.add_channel(${str(b.getFieldValue('NAME'))}, ${str(b.getFieldValue('FMT'))})\n`;
def('rm_esp_command', C.esp, null, [dd('PORT', lpfPorts),
  { type: 'field_input', name: 'NAME', text: 'led' }, { type: 'field_input', name: 'TO', text: 'b' }, { type: 'field_input', name: 'FROM', text: 'b' }], 'stmt');
G.forBlock['rm_esp_command'] = (b) =>
  `${esp(b.getFieldValue('PORT'))}.add_command(${str(b.getFieldValue('NAME'))}, ${str(b.getFieldValue('TO'))}, ${str(b.getFieldValue('FROM'))})\n`;
def('rm_esp_value', C.esp, null, [dd('PORT', lpfPorts), { type: 'field_input', name: 'NAME', text: 'line' }, num('IDX')], 'num');
G.forBlock['rm_esp_value'] = (b) => [`${esp(b.getFieldValue('PORT'))}.value(${str(b.getFieldValue('NAME'))}, ${val(b, 'IDX')})`, O.FUNCTION_CALL];
def('rm_esp_call', C.esp, null, [dd('PORT', lpfPorts), { type: 'field_input', name: 'NAME', text: 'led' }, { type: 'input_value', name: 'ARG' }], 'stmt');
G.forBlock['rm_esp_call'] = (b) => {
  const a = G.valueToCode(b, 'ARG', O.NONE);
  return `${esp(b.getFieldValue('PORT'))}.call(${str(b.getFieldValue('NAME'))}${a ? ', ' + a : ''})\n`;
};

// ── ESP32 핀 (GPIO·PWM·서보·네오픽셀) — ESP32 쪽 rm_io.py 필요 ──
const pinIn = { type: 'input_value', name: 'PIN', check: 'Number' };
const RGB = [num('R'), num('G'), num('B')];
// 네오픽셀 색 (허브 포트 전원을 아끼도록 밝기를 낮춘 값)
const NP_COLORS = { RED: [60, 0, 0], ORANGE: [60, 20, 0], YELLOW: [50, 40, 0], GREEN: [0, 60, 0], CYAN: [0, 45, 45], BLUE: [0, 0, 60], VIOLET: [30, 0, 60], MAGENTA: [60, 0, 35], WHITE: [40, 40, 40], BLACK: [0, 0, 0] };
const npColors = () => Object.keys(NP_COLORS).map((k) => [t('o.color.' + (k === 'BLACK' ? 'OFF' : k)), k]);
export const ESP_IO_BLOCKS = ['rm_eio_dout', 'rm_eio_din', 'rm_eio_ain', 'rm_eio_pwm', 'rm_eio_servo', 'rm_eio_np_init', 'rm_eio_np_set', 'rm_eio_np_setc', 'rm_eio_np_fill', 'rm_eio_np_fillc'];
const pinOf = (b) => val(b, 'PIN', O.NONE, '0');
def('rm_eio_dout', C.esp, null, [dd('PORT', lpfPorts), pinIn, dd('ON', () => opts('onoff', ['1', '0']))], 'stmt');
G.forBlock['rm_eio_dout'] = (b) => `${esp(b.getFieldValue('PORT'))}.digital_write(${pinOf(b)}, ${b.getFieldValue('ON') === '1' ? 'True' : 'False'})\n`;
def('rm_eio_din', C.esp, null, [dd('PORT', lpfPorts), pinIn, dd('PULL', () => opts('pull', ['2', '3', '1']))], 'bool');
G.forBlock['rm_eio_din'] = (b) => [`${esp(b.getFieldValue('PORT'))}.digital_read(${pinOf(b)}, ${b.getFieldValue('PULL')})`, O.FUNCTION_CALL];
def('rm_eio_ain', C.esp, null, [dd('PORT', lpfPorts), pinIn], 'num');
G.forBlock['rm_eio_ain'] = (b) => [`${esp(b.getFieldValue('PORT'))}.analog_read(${pinOf(b)})`, O.FUNCTION_CALL];
def('rm_eio_pwm', C.esp, null, [dd('PORT', lpfPorts), pinIn, num('VAL')], 'stmt');
G.forBlock['rm_eio_pwm'] = (b) => `${esp(b.getFieldValue('PORT'))}.pwm(${pinOf(b)}, ${val(b, 'VAL')})\n`;
def('rm_eio_servo', C.esp, null, [dd('PORT', lpfPorts), pinIn, num('ANGLE')], 'stmt');
G.forBlock['rm_eio_servo'] = (b) => `${esp(b.getFieldValue('PORT'))}.servo(${pinOf(b)}, ${val(b, 'ANGLE')})\n`;
def('rm_eio_np_init', C.esp, null, [dd('PORT', lpfPorts), pinIn, num('COUNT')], 'stmt');
G.forBlock['rm_eio_np_init'] = (b) => `${esp(b.getFieldValue('PORT'))}.neopixel_init(${pinOf(b)}, ${val(b, 'COUNT', O.NONE, '1')})\n`;
def('rm_eio_np_set', C.esp, null, [dd('PORT', lpfPorts), num('N'), ...RGB], 'stmt');
G.forBlock['rm_eio_np_set'] = (b) => `${esp(b.getFieldValue('PORT'))}.neopixel_set(${val(b, 'N', O.NONE, '1')}, ${val(b, 'R')}, ${val(b, 'G')}, ${val(b, 'B')})\n`;
def('rm_eio_np_setc', C.esp, null, [dd('PORT', lpfPorts), num('N'), dd('COLOR', npColors)], 'stmt');
G.forBlock['rm_eio_np_setc'] = (b) => `${esp(b.getFieldValue('PORT'))}.neopixel_set(${val(b, 'N', O.NONE, '1')}, ${NP_COLORS[b.getFieldValue('COLOR')].join(', ')})\n`;
def('rm_eio_np_fill', C.esp, null, [dd('PORT', lpfPorts), ...RGB], 'stmt');
G.forBlock['rm_eio_np_fill'] = (b) => `${esp(b.getFieldValue('PORT'))}.neopixel_fill(${val(b, 'R')}, ${val(b, 'G')}, ${val(b, 'B')})\n`;
def('rm_eio_np_fillc', C.esp, null, [dd('PORT', lpfPorts), dd('COLOR', npColors)], 'stmt');
G.forBlock['rm_eio_np_fillc'] = (b) => `${esp(b.getFieldValue('PORT'))}.neopixel_fill(${NP_COLORS[b.getFieldValue('COLOR')].join(', ')})\n`;

// ════════════════════════ 코드 생성 ════════════════════════

/** 시작 블록 아래와 함수 정의만 파이썬으로 만듭니다. */
export function generatePython(workspace) {
  G.init(workspace);
  G.rmImports_ = new Map();
  G.rmPlainImports_ = new Set();
  G.rmSetup_ = new Map();
  G.rmEspIo_ = new Set(workspace.getAllBlocks(false).filter((b) => ESP_IO_BLOCKS.includes(b.type) && b.isEnabled()).map((b) => b.getFieldValue('PORT')));
  hubObj();

  let main = '';
  let hasStart = false;
  for (const block of workspace.getTopBlocks(true)) {
    if (!block.isEnabled()) continue;
    if (block.type === 'rm_start') {
      hasStart = true;
      main += G.blockToCode(block);
    } else if (block.type.startsWith('procedures_def')) {
      G.blockToCode(block);
    }
  }

  // import 정리
  const lines = [];
  const order = ['pybricks.hubs', 'pybricks.pupdevices', 'pybricks.ev3devices', 'pybricks.parameters', 'pybricks.robotics', 'pybricks.tools'];
  const mods = [...G.rmImports_.keys()].sort((a, b) => {
    const ia = order.indexOf(a), ib = order.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b);
  });
  for (const m of mods) lines.push(`from ${m} import ${[...G.rmImports_.get(m)].sort().join(', ')}`);
  for (const m of G.rmPlainImports_) lines.push(`import ${m}`);

  const header = t('gen.header');
  const setupCode = [...G.rmSetup_.values()].join('\n');

  // Blockly 기본 정의(변수 초기화, 함수)를 꺼내 순서를 정합니다.
  const defs = [];
  let varInit = '';
  for (const [k, v] of Object.entries(G.definitions_)) {
    if (k === 'variables') varInit = v;
    else if (/^(from\s+\S+\s+)?import\s/.test(v)) lines.push(v);
    else defs.push(v);
  }
  G.definitions_ = Object.create(null);
  G.finish('');

  let out = header + '\n\n' + [...new Set(lines)].join('\n') + '\n\n';
  out += t('gen.setup') + '\n' + setupCode + '\n\n';
  if (varInit) out += varInit + '\n\n';
  if (defs.length) out += defs.join('\n\n') + '\n\n';
  out += t('gen.start') + '\n' + (main.trim() ? main : 'pass\n');
  return { code: out.replace(/\n{3,}/g, '\n\n'), hasStart };
}

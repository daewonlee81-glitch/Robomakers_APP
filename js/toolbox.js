// toolbox.js — 허브에 맞는 블록 꾸러미(툴박스)
import { HUBS } from './hubs.js?v=0.3.1';
import { C } from './blocks.js?v=0.3.1';
import { t } from './i18n.js?v=0.3.1';

const n = (v) => ({ shadow: { type: 'math_number', fields: { NUM: v } } });
const txt = (v) => ({ shadow: { type: 'text', fields: { TEXT: v } } });
const b = (type, inputs, fields) => {
  const o = { kind: 'block', type };
  if (inputs) o.inputs = inputs;
  if (fields) o.fields = fields;
  return o;
};
const cat = (name, colour, contents, extra = {}) => ({ kind: 'category', name, colour, contents, ...extra });
const label = (text) => ({ kind: 'label', text });

export function buildToolbox(hubKey) {
  const h = HUBS[hubKey];
  const cats = [];

  cats.push(cat(t('cat.start'), C.event, [b('rm_start')]));

  cats.push(cat(t('cat.motor'), C.motor, [
    b('rm_motor_run_for', { SPEED: n(50), AMOUNT: n(1) }, { UNIT: 'rot' }),
    b('rm_motor_run', { SPEED: n(50) }),
    b('rm_motor_power', { POWER: n(50) }),
    b('rm_motor_target', { SPEED: n(50), ANGLE: n(0) }),
    b('rm_motor_stop'),
    b('rm_motor_value'),
    b('rm_motor_reset'),
    b('rm_motor_setup'),
  ]));

  cats.push(cat(t('cat.drive'), C.drive, [
    b('rm_drive_setup', null, { L: h.motorPorts[0], R: h.motorPorts[1] }),
    b('rm_drive_straight', { DIST: n(200) }),
    b('rm_drive_turn', { ANGLE: n(90) }),
    b('rm_drive_drive', { SPEED: n(150), TURN: n(0) }),
    b('rm_drive_stop'),
    b('rm_drive_settings', { SPEED: n(200), TURN: n(150) }),
    b('rm_drive_value'),
    b('rm_drive_reset'),
  ]));

  const sensors = [];
  if (h.sensors.includes('color') || h.sensors.includes('ev3color')) {
    sensors.push(b('rm_color_is', null, { PORT: h.sensorPorts[h.sensorPorts.length > 2 ? 2 : 0] }), b('rm_color_value'));
  }
  if (h.sensors.includes('ultrasonic') || h.sensors.includes('ev3ultrasonic')) sensors.push(b('rm_ultra_distance'));
  if (h.sensors.includes('force')) sensors.push(b('rm_force_pressed'), b('rm_force_value'));
  if (h.sensors.includes('touch')) sensors.push(b('rm_touch_pressed'));
  if (h.sensors.includes('gyro')) sensors.push(b('rm_gyro_value'), b('rm_gyro_reset'));
  if (h.imu) sensors.push(label(t('tb.hub')), b('rm_imu_value'), b('rm_imu_reset'));
  if (h.buttons.length) sensors.push(b('rm_hub_button'));
  sensors.push(label(t('tb.time')), b('rm_timer_value'), b('rm_timer_reset'));
  cats.push(cat(t('cat.sensor'), C.sensor, sensors));

  const hubBlocks = [];
  if (h.display) {
    hubBlocks.push(b('rm_display_text', { TEXT: txt(t('tb.hello')) }), b('rm_display_number', { NUM: n(7) }));
    if (h.display === 'matrix') hubBlocks.push(b('rm_display_icon'), b('rm_display_pixel', { ROW: n(2), COL: n(2), BRIGHT: n(100) }));
    hubBlocks.push(b('rm_display_clear'));
  }
  hubBlocks.push(b('rm_light'), b('rm_light_off'));
  if (h.speaker) hubBlocks.push(b('rm_beep', { FREQ: n(500), SEC: n(0.2) }));
  hubBlocks.push(b('rm_print', { TEXT: txt('hello') }));
  cats.push(cat(t('cat.hub'), C.hub, hubBlocks));

  cats.push(cat(t('cat.control'), C.control, [
    b('rm_wait', { SEC: n(1) }),
    b('rm_forever'),
    b('controls_repeat_ext', { TIMES: n(10) }),
    b('controls_if'),
    { kind: 'block', type: 'controls_if', extraState: { hasElse: true } },
    b('rm_wait_until'),
    b('controls_whileUntil'),
    b('controls_for', { FROM: n(1), TO: n(10), BY: n(1) }),
    b('controls_flow_statements'),
    b('rm_end'),
  ]));

  cats.push(cat(t('cat.math'), '#59C059', [
    b('math_number'),
    b('math_arithmetic', { A: n(1), B: n(1) }),
    b('math_random_int', { FROM: n(1), TO: n(10) }),
    b('logic_compare', { A: n(0), B: n(50) }),
    b('logic_operation'),
    b('logic_negate'),
    b('logic_boolean'),
    b('math_single', { NUM: n(-5) }, { OP: 'ABS' }),
    b('math_round', { NUM: n(3.5) }),
    b('math_modulo', { DIVIDEND: n(10), DIVISOR: n(3) }),
    b('math_constrain', { VALUE: n(150), LOW: n(-100), HIGH: n(100) }),
    b('math_trig', { NUM: n(45) }),
    b('text'),
    b('text_join'),
  ]));

  cats.push({ kind: 'category', name: t('cat.var'), colour: '#FF8C1A', custom: 'VARIABLE' });
  cats.push({ kind: 'category', name: t('cat.proc'), colour: '#FF6680', custom: 'PROCEDURE' });

  cats.push({ kind: 'sep' });

  cats.push(cat(t('cat.ai'), C.ai, [
    label(t('tb.hand')),
    b('rm_ai_gesture'),
    b('rm_ai_hand_detected'),
    b('rm_ai_hand_value'),
    label(t('tb.pose')),
    b('rm_ai_pose_bool'),
    b('rm_ai_pose_value'),
    label(t('tb.object')),
    b('rm_ai_obj_seen', null, { OBJ: '1' }),
    b('rm_ai_obj_value', null, { OBJ: '1' }),
    label(t('tb.teach')),
    b('rm_ai_teach_is'),
    b('rm_ai_teach_value'),
    label(t('tb.color')),
    b('rm_ai_color_is'),
    b('rm_ai_color_value'),
    label(t('tb.lcolor')),
    b('rm_ai_lcolor_seen'),
    b('rm_ai_lcolor_value'),
  ]));

  cats.push(cat(t('cat.pad'), C.pad, [
    b('rm_pad_setup'),
    b('rm_pad_tank', null, { L: h.motorPorts[0], R: h.motorPorts[1] }),
    b('rm_pad_stick'),
    b('rm_pad_trigger'),
    b('rm_pad_pressed'),
    b('rm_pad_connected'),
    ...(h.xbox ? [b('rm_pad_rumble', { POWER: n(50), SEC: n(0.2) })] : []),
  ]));

  if (h.lpf2) {
    cats.push(cat(t('cat.husky'), C.husky, [
      b('rm_husky_detected', { ID: n(0) }),
      b('rm_husky_value'),
      b('rm_husky_line'),
    ]));
    cats.push(cat(t('cat.esp'), C.esp, [
      b('rm_esp_channel'),
      b('rm_esp_command'),
      b('rm_esp_value', { IDX: n(0) }),
      b('rm_esp_call', { ARG: n(1) }),
    ]));
  }

  return { kind: 'categoryToolbox', contents: cats };
}

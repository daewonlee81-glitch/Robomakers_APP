// examples.js — 예제 프로그램 (Blockly 직렬화 형식으로 조립)

import { t } from './i18n.js?v=0.3.18';

const N = (v) => ({ shadow: { type: 'math_number', fields: { NUM: v } } });
const T = (v) => ({ shadow: { type: 'text', fields: { TEXT: v } } });
const B = (type, fields = {}, inputs = {}) => ({ type, fields, inputs });
const V = (block) => ({ block });

/** 블록 배열을 next 로 이어 붙입니다. */
function chain(list) {
  const blocks = list.map((b) => JSON.parse(JSON.stringify(b)));
  for (let i = blocks.length - 2; i >= 0; i--) blocks[i].next = { block: blocks[i + 1] };
  return blocks[0];
}
const DO = (list) => ({ block: chain(list) });
const forever = (list) => B('rm_forever', {}, { DO: DO(list) });
const ifElse = (cond, yes, no) => ({
  type: 'controls_if',
  extraState: no ? { hasElse: true } : undefined,
  inputs: { IF0: V(cond), DO0: DO(yes), ...(no ? { ELSE: DO(no) } : {}) },
});
const ifElif = (pairs, no) => {
  const inputs = {};
  pairs.forEach(([c, d], i) => {
    inputs['IF' + i] = V(c);
    inputs['DO' + i] = DO(d);
  });
  if (no) inputs.ELSE = DO(no);
  return { type: 'controls_if', extraState: { elseIfCount: pairs.length - 1, hasElse: !!no }, inputs };
};
const start = (list) => ({ ...B('rm_start'), x: 40, y: 40, next: { block: chain(list) } });
const ws = (top) => ({ blocks: { languageVersion: 0, blocks: [top] } });

export const EXAMPLES = {
  basic: {
    title: () => t('ex.basic'),
    hubs: ['prime', 'essential', 'ev3'],
    build: (h) => ws(start([
      B('rm_drive_setup', { L: h.motorPorts[0], R: h.motorPorts[1], WD: 56, AT: 112, GYRO: false }),
      B('rm_light', { COLOR: 'GREEN' }),
      B('rm_drive_straight', {}, { DIST: N(300) }),
      B('rm_drive_turn', {}, { ANGLE: N(180) }),
      B('rm_drive_straight', {}, { DIST: N(300) }),
      B('rm_beep', {}, { FREQ: N(800), SEC: N(0.3) }),
    ].filter((b) => h.speaker || b.type !== 'rm_beep'))),
  },
  hand: {
    title: () => t('ex.hand'),
    hubs: ['prime', 'essential', 'ev3'],
    build: (h) => ws(start([
      B('rm_drive_setup', { L: h.motorPorts[0], R: h.motorPorts[1], WD: 56, AT: 112, GYRO: false }),
      forever([
        ifElif([
          [B('rm_ai_gesture', { G: 'OPEN' }), [B('rm_drive_drive', {}, { SPEED: N(150), TURN: N(0) })]],
          [B('rm_ai_gesture', { G: 'POINT_UP' }), [B('rm_drive_drive', {}, { SPEED: N(0), TURN: N(90) })]],
          [B('rm_ai_gesture', { G: 'VICTORY' }), [B('rm_drive_drive', {}, { SPEED: N(0), TURN: N(-90) })]],
        ], [B('rm_drive_stop')]),
      ]),
    ])),
  },
  pose: {
    title: () => t('ex.pose'),
    hubs: ['prime', 'essential', 'ev3'],
    build: () => ws(start([
      forever([
        ifElif([
          [B('rm_ai_pose_bool', { WHAT: 'both_hands_up' }), [B('rm_light', { COLOR: 'GREEN' })]],
          [B('rm_ai_pose_bool', { WHAT: 'left_hand_up' }), [B('rm_light', { COLOR: 'BLUE' })]],
          [B('rm_ai_pose_bool', { WHAT: 'right_hand_up' }), [B('rm_light', { COLOR: 'RED' })]],
        ], [B('rm_light_off')]),
      ]),
    ])),
  },
  object: {
    title: () => t('ex.object'),
    hubs: ['prime', 'essential', 'ev3'],
    build: (h) => ws(start([
      B('rm_drive_setup', { L: h.motorPorts[0], R: h.motorPorts[1], WD: 56, AT: 112, GYRO: false }),
      forever([
        ifElif([
          [{ type: 'logic_negate', inputs: { BOOL: V(B('rm_ai_obj_seen', { OBJ: '1' })) } }, [B('rm_drive_drive', {}, { SPEED: N(0), TURN: N(60) })]],
          [{ type: 'logic_compare', fields: { OP: 'LT' }, inputs: { A: V(B('rm_ai_obj_value', { OBJ: '1', WHAT: '1' })), B: N(40) } },
            [B('rm_drive_drive', {}, { SPEED: N(0), TURN: N(-45) })]],
          [{ type: 'logic_compare', fields: { OP: 'GT' }, inputs: { A: V(B('rm_ai_obj_value', { OBJ: '1', WHAT: '1' })), B: N(60) } },
            [B('rm_drive_drive', {}, { SPEED: N(0), TURN: N(45) })]],
        ], [B('rm_drive_stop')]),
      ]),
    ])),
  },
  teach: {
    title: () => t('ex.teach'),
    hubs: ['prime', 'essential', 'ev3'],
    build: (h) => ws(start([
      forever([
        ifElif([
          [B('rm_ai_teach_is', { N: '1' }), [h.display ? B('rm_display_number', {}, { NUM: N(1) }) : B('rm_light', { COLOR: 'GREEN' })]],
          [B('rm_ai_teach_is', { N: '2' }), [h.display ? B('rm_display_number', {}, { NUM: N(2) }) : B('rm_light', { COLOR: 'BLUE' })]],
        ], [h.display ? B('rm_display_clear') : B('rm_light_off')]),
      ]),
    ])),
  },
  lcolor: {
    title: () => t('ex.lcolor'),
    hubs: ['prime', 'essential', 'ev3'],
    build: (h) => ws(start([
      B('rm_drive_setup', { L: h.motorPorts[0], R: h.motorPorts[1], WD: 56, AT: 112, GYRO: false }),
      forever([
        ifElse(B('rm_ai_lcolor_seen', { N: '1' }),
          [B('rm_drive_drive', {}, {
            SPEED: N(100),
            TURN: V({ type: 'math_arithmetic', fields: { OP: 'MULTIPLY' }, inputs: {
              A: V({ type: 'math_arithmetic', fields: { OP: 'MINUS' }, inputs: { A: V(B('rm_ai_lcolor_value', { N: '1', WHAT: '1' })), B: N(50) } }),
              B: N(2) } }),
          })],
          [B('rm_drive_stop')]),
      ]),
    ])),
  },
  pad: {
    title: () => t('ex.pad'),
    hubs: ['prime', 'essential', 'ev3'],
    build: (h) => ws(start([
      B('rm_pad_setup', { SRC: 'web', PORT: h.lpf2 ? h.sensorPorts[0] : 'A' }),
      B('rm_motor_setup', { PORT: h.motorPorts[0], DIR: 'COUNTERCLOCKWISE' }),
      forever([
        B('rm_pad_tank', { L: h.motorPorts[0], R: h.motorPorts[1] }),
        ifElse(B('rm_pad_pressed', { BTN: 'A' }), [h.speaker ? B('rm_beep', {}, { FREQ: N(600), SEC: N(0.1) }) : B('rm_light', { COLOR: 'RED' })]),
      ]),
    ])),
  },
  husky: {
    title: () => t('ex.husky'),
    hubs: ['prime'], // Essential 은 포트가 2개라 바퀴 두 개 + 허스키렌즈를 함께 꽂을 수 없음
    build: (h) => {
      const P = h.sensorPorts.length > 2 ? 'C' : 'B';
      return ws(start([
        B('rm_drive_setup', { L: 'A', R: h.sensorPorts.length > 2 ? 'E' : 'B', WD: 56, AT: 112, GYRO: false }),
        forever([
          ifElif([
            [{ type: 'logic_negate', inputs: { BOOL: V(B('rm_husky_detected', { PORT: P }, { ID: N(0) })) } }, [B('rm_drive_stop')]],
            [{ type: 'logic_compare', fields: { OP: 'LT' }, inputs: { A: V(B('rm_husky_value', { PORT: P, WHAT: 'x' })), B: N(120) } },
              [B('rm_drive_drive', {}, { SPEED: N(0), TURN: N(-60) })]],
            [{ type: 'logic_compare', fields: { OP: 'GT' }, inputs: { A: V(B('rm_husky_value', { PORT: P, WHAT: 'x' })), B: N(200) } },
              [B('rm_drive_drive', {}, { SPEED: N(0), TURN: N(60) })]],
          ], [B('rm_drive_stop')]),
        ]),
      ]));
    },
  },
  // SPIKE 앱 워드블럭 예제(허스키렌즈 브리지 라인 따라가기)를 그대로 옮긴 것
  //   SPIKE 앱 「원시 빨강·초록·파랑」 = 화살표 시작 X · 끝 X · 끝 Y,  「색상」 = ID (라인 있으면 1)
  huskyline: {
    title: () => t('ex.huskyline'),
    hubs: ['prime'],
    build: (h) => {
      const P = 'D', L = 'A', R = 'E';
      const v = (k) => ({ type: 'variables_get', fields: { VAR: { id: 'v_' + k } } });
      const set = (k, val) => ({ type: 'variables_set', fields: { VAR: { id: 'v_' + k } }, inputs: { VALUE: V(val) } });
      const num = (n) => ({ type: 'math_number', fields: { NUM: n } });
      const ar = (op, a, b) => ({ type: 'math_arithmetic', fields: { OP: op }, inputs: { A: V(a), B: V(b) } });
      const line = (w) => B('rm_husky_line', { PORT: P, WHAT: w });
      const run2 = (a, b) => B('rm_motor_pair_run', { P1: L, P2: R }, { S1: V(a), S2: V(b) });
      const top = start([
        B('rm_motor_pair_setup', { P1: L, D1: 'COUNTERCLOCKWISE', P2: R, D2: 'CLOCKWISE' }),
        set('Target', num(160)), set('Kp', num(0.05)), set('Speed', num(20)),
        {
          type: 'controls_whileUntil', fields: { MODE: 'UNTIL' },
          inputs: {
            BOOL: V({ type: 'logic_compare', fields: { OP: 'GT' }, inputs: { A: V(line('line_end_x')), B: V(num(180)) } }),
            DO: DO([
              ifElse({ type: 'logic_negate', inputs: { BOOL: V(B('rm_husky_detected', { PORT: P }, { ID: N(0) })) } },
                [run2(num(10), num(-10))],
                [
                  set('Error', ar('MINUS', line('line_start_x'), v('Target'))),
                  set('Correction', ar('MULTIPLY', v('Kp'), v('Error'))),
                  run2(ar('ADD', v('Speed'), v('Correction')), ar('MINUS', v('Speed'), v('Correction'))),
                ]),
              B('rm_wait', {}, { SEC: N(0.01) }),
            ]),
          },
        },
        B('rm_motor_stop', { PORT: L, MODE: 'brake' }),
        B('rm_motor_stop', { PORT: R, MODE: 'brake' }),
      ]);
      return { ...ws(top), variables: ['Target', 'Kp', 'Speed', 'Error', 'Correction'].map((k) => ({ name: k, id: 'v_' + k })) };
    },
  },
  // 주행 최고 속도 재기: 최대로 달리게 한 뒤 (거리 변화 ÷ 시간) 으로 직진 mm/s · 회전 °/s 를 잼
  speedtest: {
    title: () => t('ex.speedtest'),
    hubs: ['prime', 'essential', 'ev3'],
    build: (h) => {
      const v = (k) => ({ type: 'variables_get', fields: { VAR: { id: 'v_' + k } } });
      const set = (k, val) => ({ type: 'variables_set', fields: { VAR: { id: 'v_' + k } }, inputs: { VALUE: V(val) } });
      const num = (n) => ({ type: 'math_number', fields: { NUM: n } });
      const ar = (op, a, b) => ({ type: 'math_arithmetic', fields: { OP: op }, inputs: { A: V(a), B: V(b) } });
      const round = (a) => ({ type: 'math_round', fields: { OP: 'ROUND' }, inputs: { NUM: V(a) } });
      const dv = (w) => B('rm_drive_value', { WHAT: w });
      const timer = () => B('rm_timer_value');
      const say = (label, k, unit) => B('rm_print', {}, { TEXT: V({ type: 'text_join', extraState: { itemCount: 3 },
        inputs: { ADD0: T(label), ADD1: V(round(v(k))), ADD2: T(unit) } }) });
      // 속도 = (지금 값 − 시작 값) ÷ (지금 시간 − 시작 시간)   (타이머는 초 단위)
      const rate = (k, what) => set(k, ar('DIVIDE', ar('MINUS', dv(what), v('Start')), ar('MINUS', timer(), v('T0'))));
      const measure = (k, speed, turn, what) => [
        B('rm_drive_reset'),
        B('rm_drive_drive', {}, { SPEED: N(speed), TURN: N(turn) }),
        B('rm_wait', {}, { SEC: N(0.8) }), // 최고 속도까지 빨라지는 시간
        set('Start', dv(what)), set('T0', timer()),
        B('rm_wait', {}, { SEC: N(1) }),
        rate(k, what),
        B('rm_drive_stop'),
        B('rm_wait', {}, { SEC: N(1) }),
      ];
      const list = [
        B('rm_drive_setup', { L: h.motorPorts[0], R: h.motorPorts[1], WD: 56, AT: 112, GYRO: false }),
        B('rm_print', {}, { TEXT: T(t('ex.speedtest.start')) }),
        ...measure('MaxSpeed', 2000, 0, 'distance'),
        ...measure('MaxTurn', 0, 2000, 'angle'),
        say(t('ex.speedtest.v'), 'MaxSpeed', ' mm/s'),
        say(t('ex.speedtest.w'), 'MaxTurn', ' deg/s'),
      ];
      if (h.display) list.push(B('rm_display_number', {}, { NUM: V(round(v('MaxSpeed'))) }), B('rm_wait', {}, { SEC: N(3) }),
        B('rm_display_number', {}, { NUM: V(round(v('MaxTurn'))) }), B('rm_wait', {}, { SEC: N(3) }));
      return { ...ws(start(list)), variables: ['MaxSpeed', 'MaxTurn', 'Start', 'T0'].map((k) => ({ name: k, id: 'v_' + k })) };
    },
  },
  esp32: {
    title: () => t('ex.esp32'),
    hubs: ['prime'],
    build: () => ws(start([
      B('rm_esp_channel', { PORT: 'A', NAME: 'line', FMT: 'hhb' }),
      forever([
        B('rm_display_number', {}, { NUM: V(B('rm_esp_value', { PORT: 'A', NAME: 'line' }, { IDX: N(0) })) }),
        B('rm_wait', {}, { SEC: N(0.1) }),
      ]),
    ])),
  },
};

// ESP32 핀 예제는 위 EXAMPLES 에 이어 붙입니다.
EXAMPLES.esp32io = {
  title: () => t('ex.esp32io'),
  hubs: ['prime', 'essential'],
  build: () => ws(start([
    B('rm_eio_np_init', { PORT: 'A' }, { PIN: N(12), COUNT: N(8) }),
    forever([
      B('rm_eio_servo', { PORT: 'A' }, { PIN: N(21), ANGLE: N(0) }),
      B('rm_eio_np_fillc', { PORT: 'A', COLOR: 'RED' }),
      B('rm_wait', {}, { SEC: N(1) }),
      B('rm_eio_servo', { PORT: 'A' }, { PIN: N(21), ANGLE: N(180) }),
      B('rm_eio_np_fillc', { PORT: 'A', COLOR: 'BLUE' }),
      B('rm_wait', {}, { SEC: N(1) }),
    ]),
  ])),
};

// ESP32 I2C 센서·화면 예제 (ESP32 는 Grove I2C 단자에 센서, 허브 포트 D 에 ESP32 · 바퀴 A/E)
const esN = (n) => ({ type: 'math_number', fields: { NUM: n } });
const esCmp = (op, a, b) => ({ type: 'logic_compare', fields: { OP: op }, inputs: { A: V(a), B: V(b) } });
const esDrive = () => B('rm_drive_setup', { L: 'A', R: 'E', WD: 56, AT: 112, GYRO: false });
EXAMPLES.estof = {
  title: () => t('ex.estof'),
  hubs: ['prime'],
  build: () => {
    const tof = () => B('rm_es_tof', { PORT: 'D' });
    return ws(start([
      esDrive(),
      B('rm_es_oled_clear', { PORT: 'D' }),
      B('rm_es_oled_text', { PORT: 'D', SIZE: '1' }, { ROW: N(1), TEXT: T(t('ex.es.dist')) }),
      { type: 'controls_whileUntil', fields: { MODE: 'UNTIL' }, inputs: {
        BOOL: V(esCmp('LT', tof(), esN(150))),
        DO: DO([
          B('rm_es_oled_text', { PORT: 'D', SIZE: '3' }, { ROW: N(3), TEXT: V(tof()) }),
          B('rm_drive_drive', {}, { SPEED: N(150), TURN: N(0) }),
          B('rm_wait', {}, { SEC: N(0.05) }),
        ]) } },
      B('rm_drive_stop'),
      B('rm_es_oled_text', { PORT: 'D', SIZE: '3' }, { ROW: N(3), TEXT: T('STOP') }),
    ]));
  },
};
EXAMPLES.esvoice = {
  title: () => t('ex.esvoice'),
  hubs: ['prime'],
  build: () => {
    const heard = (n) => B('rm_es_voice_is', { PORT: 'D' }, { N: N(n) });
    return ws(start([
      esDrive(),
      B('rm_es_voice_set', { PORT: 'D', WHAT: '0' }, { VAL: N(5) }),
      B('rm_es_oled_text', { PORT: 'D', SIZE: '1' }, { ROW: N(1), TEXT: T(t('ex.es.ready')) }),
      forever([
        ifElif([
          [heard(22), [B('rm_drive_straight', {}, { DIST: N(200) })]], // 앞으로
          [heard(23), [B('rm_drive_straight', {}, { DIST: N(-200) })]], // 뒤로
          [heard(25), [B('rm_drive_turn', {}, { ANGLE: N(-90) })]], // 왼쪽으로 90도
          [heard(28), [B('rm_drive_turn', {}, { ANGLE: N(90) })]], // 오른쪽으로 90도
        ]),
        B('rm_wait', {}, { SEC: N(0.05) }),
      ]),
    ]));
  },
};
EXAMPLES.escolor = {
  title: () => t('ex.escolor'),
  hubs: ['prime', 'essential'],
  build: () => {
    const is = (c) => B('rm_es_color_is', { PORT: 'A', COLOR: c });
    const val = (w) => B('rm_es_color', { PORT: 'A', WHAT: w });
    return ws(start([
      B('rm_es_oled_clear', { PORT: 'A' }),
      forever([
        B('rm_es_oled_text', { PORT: 'A', SIZE: '1' }, { ROW: N(1), TEXT: V({ type: 'text_join', extraState: { itemCount: 2 }, inputs: { ADD0: T('R '), ADD1: V(val('0')) } }) }),
        B('rm_es_oled_text', { PORT: 'A', SIZE: '1' }, { ROW: N(2), TEXT: V({ type: 'text_join', extraState: { itemCount: 2 }, inputs: { ADD0: T('G '), ADD1: V(val('1')) } }) }),
        B('rm_es_oled_text', { PORT: 'A', SIZE: '1' }, { ROW: N(3), TEXT: V({ type: 'text_join', extraState: { itemCount: 2 }, inputs: { ADD0: T('B '), ADD1: V(val('2')) } }) }),
        ifElif([
          [is('RED'), [B('rm_light', { COLOR: 'RED' }), B('rm_es_oled_text', { PORT: 'A', SIZE: '2' }, { ROW: N(5), TEXT: T('RED') })]],
          [is('GREEN'), [B('rm_light', { COLOR: 'GREEN' }), B('rm_es_oled_text', { PORT: 'A', SIZE: '2' }, { ROW: N(5), TEXT: T('GREEN') })]],
          [is('BLUE'), [B('rm_light', { COLOR: 'BLUE' }), B('rm_es_oled_text', { PORT: 'A', SIZE: '2' }, { ROW: N(5), TEXT: T('BLUE') })]],
        ], [B('rm_light_off'), B('rm_es_oled_text', { PORT: 'A', SIZE: '2' }, { ROW: N(5), TEXT: T('-') })]),
        B('rm_wait', {}, { SEC: N(0.1) }),
      ]),
    ]));
  },
};

export function emptyProgram() {
  return ws({ ...B('rm_start'), x: 40, y: 40 });
}

export { T };

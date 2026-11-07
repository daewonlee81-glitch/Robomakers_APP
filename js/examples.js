// examples.js — 예제 프로그램 (Blockly 직렬화 형식으로 조립)

import { t } from './i18n.js?v=0.3.0';

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
    hubs: ['prime', 'essential'],
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

export function emptyProgram() {
  return ws({ ...B('rm_start'), x: 40, y: 40 });
}

export { T };

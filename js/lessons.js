// lessons.js — 단계별 배우기 (교육용 스텝 바이 스텝)
//
// 한 수업(lesson)은 여러 단계(step)로 이루어지고, 단계마다 블록 프로그램이 조금씩 늘어납니다.
// 블록마다 고정된 id 를 붙여 두어, 앞 단계에 없던 블록(새로 생긴 블록)을 화면에서 빛나게 표시합니다.
//   글은 언어 파일의 learn.<수업>.<단계>.* 키에 있습니다 (title · idea · change · try).

import { t } from './i18n.js?v=0.3.9';

const N = (v) => ({ shadow: { type: 'math_number', fields: { NUM: v } } });
const B = (id, type, fields = {}, inputs = {}, extra = {}) => ({ id, type, fields, inputs, ...extra });
const V = (block) => ({ block });

function chain(list) {
  const blocks = list.map((b) => JSON.parse(JSON.stringify(b)));
  for (let i = blocks.length - 2; i >= 0; i--) blocks[i].next = { block: blocks[i + 1] };
  return blocks[0];
}
const DO = (list) => ({ block: chain(list) });

// 변수: 이름은 언어마다 다르게 (learn.var.*), id 는 고정
const VARS = ['target', 'kp', 'error', 'steer', 'kd', 'last', 'deriv', 'ki', 'integral',
  'gtarget', 'speed', 'glen', 'traveled', 'remain', 'vmax', 'vmin', 'accel', 'kt', 'tol'];
const vname = (k) => t('learn.var.' + k);
const setv = (id, k, value) => B(id, 'variables_set', { VAR: { id: 'v_' + k } }, { VALUE: V(value) });
const getv = (id, k) => B(id, 'variables_get', { VAR: { id: 'v_' + k } });
const num = (id, v) => B(id, 'math_number', { NUM: v });
const arith = (id, op, a, b) => B(id, 'math_arithmetic', { OP: op }, { A: V(a), B: V(b) });

/** 허브별 포트: 바퀴 두 개 + 컬러 센서 (시뮬레이터 기본 로봇과 같게) */
function ports(h) {
  const ev3 = h.sensorPorts[0] === 'S1';
  return { L: h.motorPorts[0], R: h.motorPorts[1], C: ev3 ? 'S3' : 'C' };
}

const SPEED = 120; // mm/s — 처음에는 천천히

// ───────────── 라인 트레이싱: 1 온오프 → 2 P → 3 PD → 4 PID ─────────────
function lineProgram(h, step) {
  const p = ports(h);
  const refl = (id) => B(id, 'rm_color_value', { PORT: p.C, WHAT: 'reflection' });
  const setup = B('l_setup', 'rm_drive_setup', { L: p.L, R: p.R, WD: 56, AT: 112, GYRO: false });
  const drive = (turn) => B('l_drive', 'rm_drive_drive', {}, { SPEED: N(SPEED), TURN: turn });

  if (step === 1) {
    const cond = B('l_cmp', 'logic_compare', { OP: 'LT' }, { A: V(refl('l_refl')), B: V(num('l_mid', 50)) });
    const body = [{
      id: 'l_if', type: 'controls_if', extraState: { hasElse: true },
      inputs: {
        IF0: V(cond),
        DO0: DO([B('l_left', 'rm_drive_drive', {}, { SPEED: N(SPEED), TURN: N(-60) })]),
        ELSE: DO([B('l_right', 'rm_drive_drive', {}, { SPEED: N(SPEED), TURN: N(60) })]),
      },
    }];
    return { vars: [], top: [setup, B('l_loop', 'rm_forever', {}, { DO: DO(body) })] };
  }

  // 2단계부터: 오차 = 반사값 - 목표값
  const head = [setup, setv('l_set_target', 'target', num('l_target', 50)), setv('l_set_kp', 'kp', num('l_kp', 1.2))];
  const loop = [setv('l_set_error', 'error', arith('l_minus', 'MINUS', refl('l_refl'), getv('l_get_target', 'target')))];
  // 조향 = Kp × 오차 (+ Ki × 적분) (+ Kd × 미분)
  let steer = arith('l_p', 'MULTIPLY', getv('l_get_kp', 'kp'), getv('l_get_error1', 'error'));
  const vars = ['target', 'kp', 'error', 'steer'];

  if (step >= 3) {
    head.push(setv('l_set_kd', 'kd', num('l_kd', 4)), setv('l_set_last0', 'last', num('l_last0', 0)));
    vars.push('kd', 'last', 'deriv');
  }
  if (step >= 4) {
    head.push(setv('l_set_ki', 'ki', num('l_ki', 0.02)), setv('l_set_int0', 'integral', num('l_int0', 0)));
    vars.push('ki', 'integral');
    // 적분 = (적분 + 오차) 를 -1000 ~ 1000 으로 제한 (너무 커지지 않게)
    loop.push(setv('l_set_int', 'integral', B('l_clamp', 'math_constrain', {}, {
      VALUE: V(arith('l_int_add', 'ADD', getv('l_get_int1', 'integral'), getv('l_get_error3', 'error'))),
      LOW: V(num('l_int_lo', -1000)), HIGH: V(num('l_int_hi', 1000)),
    })));
    steer = arith('l_pi', 'ADD', steer, arith('l_i', 'MULTIPLY', getv('l_get_ki', 'ki'), getv('l_get_int2', 'integral')));
  }
  if (step >= 3) {
    // 미분 = 오차 - 이전 오차 (한 번 돌 때마다 오차가 얼마나 바뀌었나)
    loop.push(setv('l_set_deriv', 'deriv', arith('l_d_minus', 'MINUS', getv('l_get_error2', 'error'), getv('l_get_last', 'last'))));
    steer = arith('l_pd', 'ADD', steer, arith('l_d', 'MULTIPLY', getv('l_get_kd', 'kd'), getv('l_get_deriv', 'deriv')));
  }
  loop.push(setv('l_set_steer', 'steer', steer), drive(V(getv('l_get_steer', 'steer'))));
  if (step >= 3) loop.push(setv('l_set_last', 'last', getv('l_get_error4', 'error')));
  return { vars, top: [...head, B('l_loop', 'rm_forever', {}, { DO: DO(loop) })] };
}

// ───────────── 자이로 주행: 방향 재기 → 바퀴만 → P 직진 → PI 직진 → 사다리꼴 속도 → 자이로 돌기 → Pybricks 자이로 ─────────────
// 허브 방향(imu.heading)은 시계 방향이 + (Pybricks 문서), 한 바퀴를 넘어도 계속 쌓입니다 (360, 720 …).
function gyroProgram(h, step) {
  const L = h.motorPorts[0], R = h.motorPorts[1];
  const heading = (id) => B(id, 'rm_imu_value', { WHAT: 'heading' });
  const reset = B('g_reset', 'rm_imu_reset');
  const say = B('g_pr_end', 'rm_print', {}, { TEXT: V(heading('g_h_end')) });
  const wait = (id, sec) => B(id, 'rm_wait', {}, { SEC: N(sec) });
  const setup = (gyro) => B(gyro ? 'g_setup7' : 'g_setup', 'rm_drive_setup', { L, R, WD: 56, AT: 112, GYRO: gyro });

  if (step === 1) {
    const loop = B('g_loop', 'rm_forever', {}, { DO: DO([B('g_pr_loop', 'rm_print', {}, { TEXT: V(heading('g_h_loop')) }), wait('g_w_loop', 0.2)]) });
    return { vars: [], top: [reset, loop] };
  }
  if (step === 2) return { vars: [], top: [setup(false), reset, B('g_s2', 'rm_drive_straight', {}, { DIST: N(600) }), say] };
  if (step === 7) {
    return {
      vars: [],
      top: [setup(true), reset, B('g_set7', 'rm_drive_settings', {}, { SPEED: N(300), TURN: N(150) }),
        B('g_s7', 'rm_drive_straight', {}, { DIST: N(600) }), B('g_t7', 'rm_drive_turn', {}, { ANGLE: N(90) }), say],
    };
  }

  // 3단계부터: 직접 만드는 자이로 직진
  const vars = ['gtarget', 'kp', 'error', 'steer', 'speed'];
  const head = [setup(false), reset, B('g_dreset', 'rm_drive_reset'),
    setv('g_set_tgt', 'gtarget', num('g_tgt', 0)), setv('g_set_kp', 'kp', num('g_kp', 2))];
  if (step < 5) head.push(setv('g_set_spd', 'speed', num('g_spd', 200)));
  const loop = [setv('g_set_err', 'error', arith('g_err', 'MINUS', getv('g_get_tgt', 'gtarget'), heading('g_h_err')))];
  let steer = arith('g_p', 'MULTIPLY', getv('g_get_kp', 'kp'), getv('g_get_err1', 'error'));
  if (step >= 4) {
    vars.push('ki', 'integral');
    head.push(setv('g_set_ki', 'ki', num('g_ki', 0.05)), setv('g_set_int0', 'integral', num('g_int0', 0)));
    loop.push(setv('g_set_int', 'integral', B('g_clamp', 'math_constrain', {}, {
      VALUE: V(arith('g_int_add', 'ADD', getv('g_get_int1', 'integral'), getv('g_get_err2', 'error'))),
      LOW: V(num('g_int_lo', -200)), HIGH: V(num('g_int_hi', 200)),
    })));
    steer = arith('g_pi', 'ADD', steer, arith('g_i', 'MULTIPLY', getv('g_get_ki', 'ki'), getv('g_get_int2', 'integral')));
  }
  let length = num('g_len', 600);
  if (step >= 5) {
    // 사다리꼴: 처음엔 천천히 → 빨라짐 → 끝에 가까우면 다시 천천히. 「더 느린 쪽」을 고릅니다.
    vars.push('glen', 'traveled', 'remain', 'vmax', 'vmin', 'accel');
    head.push(setv('g_set_len', 'glen', num('g_len2', 600)), setv('g_set_vmax', 'vmax', num('g_vmax', 300)),
      setv('g_set_vmin', 'vmin', num('g_vmin', 60)), setv('g_set_acc', 'accel', num('g_acc', 1.5)));
    length = getv('g_get_len1', 'glen');
    const ramp = (id, k, d) => arith(id, 'ADD', getv(id + '_min', 'vmin'), arith(id + '_m', 'MULTIPLY', getv(id + '_a', 'accel'), getv(id + '_d', d)));
    loop.unshift(
      setv('g_set_trav', 'traveled', B('g_dist2', 'rm_drive_value', { WHAT: 'distance' })),
      setv('g_set_rem', 'remain', arith('g_rem', 'MINUS', getv('g_get_len2', 'glen'), getv('g_get_trav1', 'traveled'))),
      setv('g_set_spd2', 'speed', B('g_spd_clamp', 'math_constrain', {}, {
        VALUE: V(ramp('g_up', 'speed', 'traveled')), LOW: V(getv('g_get_vmin1', 'vmin')), HIGH: V(getv('g_get_vmax1', 'vmax')),
      })),
      {
        id: 'g_if_dec', type: 'controls_if',
        inputs: {
          IF0: V(B('g_dec_cmp', 'logic_compare', { OP: 'LT' }, { A: V(ramp('g_down', 'speed', 'remain')), B: V(getv('g_get_spd3', 'speed')) })),
          DO0: DO([setv('g_set_spd3', 'speed', ramp('g_down2', 'speed', 'remain'))]),
        },
      },
    );
  }
  loop.push(setv('g_set_steer', 'steer', steer),
    B('g_drive', 'rm_drive_drive', {}, { SPEED: V(getv('g_get_spd', 'speed')), TURN: V(getv('g_get_steer', 'steer')) }),
    wait('g_w', 0.01));
  const straight = {
    id: 'g_while', type: 'controls_whileUntil', fields: { MODE: 'WHILE' },
    inputs: {
      BOOL: V(B('g_wcmp', 'logic_compare', { OP: 'LT' }, { A: V(B('g_dist', 'rm_drive_value', { WHAT: 'distance' })), B: V(length) })),
      DO: DO(loop),
    },
  };
  const tail = [straight, B('g_stop', 'rm_drive_stop')];
  if (step >= 6) {
    // 자이로 돌기: 목표 방향까지 남은 각도에 비례해서 돌고, 판정(±도) 안에 들면 멈춤
    vars.push('kt', 'tol');
    const err = (id) => setv(id, 'error', arith(id + '_m', 'MINUS', getv(id + '_t', 'gtarget'), heading(id + '_h')));
    tail.push(
      setv('g_set_tgt2', 'gtarget', num('g_tgt2', 90)), setv('g_set_kt', 'kt', num('g_kt', 3)), setv('g_set_tol', 'tol', num('g_tol', 1)),
      err('g_set_err4'),
      {
        id: 'g_until', type: 'controls_whileUntil', fields: { MODE: 'UNTIL' },
        inputs: {
          // −판정 < 오차 그리고 오차 < 판정 (abs 블록은 파이썬 math 모듈이 필요해서 쓰지 않음)
          BOOL: V(B('g_uand', 'logic_operation', { OP: 'AND' }, {
            A: V(B('g_ucmp1', 'logic_compare', { OP: 'LT' }, {
              A: V(B('g_neg', 'math_single', { OP: 'NEG' }, { NUM: V(getv('g_get_tol1', 'tol')) })), B: V(getv('g_get_err5', 'error')),
            })),
            B: V(B('g_ucmp2', 'logic_compare', { OP: 'LT' }, { A: V(getv('g_get_err8', 'error')), B: V(getv('g_get_tol', 'tol')) })),
          })),
          DO: DO([
            B('g_tdrive', 'rm_drive_drive', {}, {
              SPEED: N(0),
              TURN: V(B('g_tclamp', 'math_constrain', {}, {
                VALUE: V(arith('g_tp', 'MULTIPLY', getv('g_get_kt', 'kt'), getv('g_get_err6', 'error'))),
                LOW: V(num('g_t_lo', -200)), HIGH: V(num('g_t_hi', 200)),
              })),
            }),
            wait('g_tw', 0.01),
            err('g_set_err7'),
          ]),
        },
      },
      B('g_stop2', 'rm_drive_stop'), wait('g_settle', 0.3),
    );
  }
  tail.push(say);
  return { vars, top: [...head, ...tail] };
}

export const LESSONS = {
  line: { steps: 4, hubs: ['prime', 'ev3'], program: lineProgram, chart: ['onoff', 'p', 'pd', 'pid'], mat: 'line' },
  gyro: { steps: 7, hubs: ['prime', 'essential'], program: gyroProgram, chart: ['yaw', 'drift', 'gp', 'gpi', 'trap', 'turn', null], mat: 'grid' },
};

/** 단계 프로그램 (Blockly 직렬화 형식) */
export function lessonWorkspace(key, h, step) {
  const { vars, top } = LESSONS[key].program(h, step);
  const start = { ...B('l_start', 'rm_start'), x: 40, y: 40, next: { block: chain(top) } };
  return {
    blocks: { languageVersion: 0, blocks: [start] },
    ...(vars.length ? { variables: vars.map((k) => ({ name: vname(k), id: 'v_' + k })) } : {}),
  };
}

function ids(state) {
  const out = new Set();
  const walk = (b) => {
    if (!b) return;
    out.add(b.id);
    for (const v of Object.values(b.inputs || {})) walk(v.block);
    walk(b.next?.block);
  };
  state.blocks.blocks.forEach(walk);
  return out;
}

/** 앞 단계에 없던 블록 id (1단계는 전부) */
export function newBlockIds(key, h, step) {
  const now = ids(lessonWorkspace(key, h, step));
  if (step <= 1) return [...now];
  const before = ids(lessonWorkspace(key, h, step - 1));
  return [...now].filter((id) => !before.has(id));
}

export { VARS };

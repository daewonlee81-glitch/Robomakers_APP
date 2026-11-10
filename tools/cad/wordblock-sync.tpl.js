// wordblock-sync.js — 로보메이커스 워드블럭 에디터의 새 기능을 시뮬레이터(캐드)에 붙입니다.
//
//   · 사물 인식 · 사물 학습 · 색 인식 · 색 학습 블록 (시뮬레이터에서도 카메라로 동작)
//   · ESP32 핀 블록 (GPIO · PWM · 서보 · 네오픽셀 — 실제 허브에서만 동작)
//   · 허브 라이브러리(rm_aicam · rm_esp32 · rm_husky …)를 에디터와 같은 최신 버전으로 교체
//   · 워드블럭 에디터 ↔ 시뮬레이터 블록 주고받기
//
// 이 파일은 워드블럭 에디터 저장소의 tools/sync_cad.py 가 만듭니다. 직접 고치지 마세요.
// 워드블럭 에디터 버전: @VERSION@
(() => {
  'use strict';
  const EDITOR_VERSION = '@VERSION@';
  const MSGS = /*@MSGS@*/ {};
  const LIBS = /*@LIBS@*/ {};
  const HANDOFF = 'rm-wb-handoff';
  const EDITOR_URL = '../Robomakers_APP/?from=sim';

  const W = window.__wb;
  const Bly = window.Blockly;
  if (!W || !Bly || !W.dg) {
    console.warn('wordblock-sync: 시뮬레이터 앱이 준비되지 않았습니다');
    return;
  }

  // ───────────── 문구 ─────────────
  for (const [lang, d] of Object.entries(MSGS)) {
    W.dg[lang] = W.dg[lang] || {};
    for (const [k, v] of Object.entries(d)) if (!k.startsWith('__')) W.dg[lang][k] = v;
  }
  const t = (k, ...a) => W.Ye(k, ...a);
  const coco = (i) => {
    const l = (MSGS[W.lang()] || MSGS.en).__coco || MSGS.en.__coco;
    return l[i] || MSGS.en.__coco[i] || '?';
  };

  // ───────────── AI 상수 (에디터 aicam.js 와 같게) ─────────────
  const COCO = MSGS.en.__cocoKeys;
  const cocoId = (name) => COCO.indexOf(name) + 1;
  const OBJ_PICK = [
    'person', 'cup', 'bottle', 'sports ball', 'book', 'cell phone', 'scissors', 'teddy bear', 'apple', 'banana',
    'orange', 'chair', 'backpack', 'umbrella', 'laptop', 'keyboard', 'mouse', 'clock', 'cat', 'dog', 'car',
  ];
  const COLOR_IDS = ['NONE', 'RED', 'ORANGE', 'YELLOW', 'GREEN', 'CYAN', 'BLUE', 'VIOLET', 'MAGENTA', 'WHITE', 'BLACK'];
  const TEACH_CLASSES = 5;
  const COLOR_SLOTS = 5;
  const NP_COLORS = { RED: [60, 0, 0], ORANGE: [60, 20, 0], YELLOW: [50, 40, 0], GREEN: [0, 60, 0], CYAN: [0, 45, 45], BLUE: [0, 0, 60], VIOLET: [30, 0, 60], MAGENTA: [60, 0, 35], WHITE: [40, 40, 40], BLACK: [0, 0, 0] };
  const AI_BLOCKS = {
    rm_ai_obj_seen: 'obj', rm_ai_obj_value: 'obj', rm_ai_teach_is: 'teach', rm_ai_teach_value: 'teach',
    rm_ai_color_is: 'color', rm_ai_color_value: 'color', rm_ai_lcolor_seen: 'color', rm_ai_lcolor_value: 'color',
  };
  const ESP_IO_BLOCKS = ['rm_eio_dout', 'rm_eio_din', 'rm_eio_ain', 'rm_eio_pwm', 'rm_eio_servo', 'rm_eio_np_init', 'rm_eio_np_set', 'rm_eio_np_setc', 'rm_eio_np_fill', 'rm_eio_np_fillc'];
  const COL = { ai: '#00A88F', esp: '#3D7A3A', motor: '#0090F5' };

  // ───────────── 블록 정의 (에디터와 같은 이름 · 같은 필드) ─────────────
  const lsJson = (k, d) => {
    try {
      return JSON.parse(localStorage.getItem(k) || 'null') ?? d;
    } catch (e) {
      return d;
    }
  };
  const opts = (group, keys) => keys.map((k) => [t(`o.${group}.${k}`), k]);
  const dd = (name, options) => ({ type: 'field_dropdown', name, options });
  const num = (name) => ({ type: 'input_value', name, check: 'Number' });
  const ports = () => {
    const h = W.hub();
    return (h.lpf2 ? h.sensorPorts : ['A']).map((p) => [p, p]);
  };
  const objOptions = () => [[t('coco.any'), '0'], ...OBJ_PICK.map((n) => [coco(cocoId(n) - 1), String(cocoId(n))])];
  const teachOptions = () => {
    const names = lsJson('rm-teach-names', []);
    return Array.from({ length: TEACH_CLASSES }, (_, i) => [names[i] || t('teach.class', i + 1), String(i + 1)]);
  };
  const slotOptions = () => Array.from({ length: COLOR_SLOTS }, (_, i) => [t('color.slot', i + 1), String(i + 1)]);
  const npColors = () => Object.keys(NP_COLORS).map((k) => [t('o.color.' + (k === 'BLACK' ? 'OFF' : k)), k]);
  const pinIn = { type: 'input_value', name: 'PIN', check: 'Number' };
  const RGB = [num('R'), num('G'), num('B')];

  const def = (type, colour, args, shape) => {
    Bly.Blocks[type] = {
      init() {
        const tipKey = `b.${type}.tip`;
        const tip = t(tipKey);
        const j = { type, message0: t('b.' + type), args0: args, colour, inputsInline: true };
        if (tip !== tipKey) j.tooltip = tip;
        if (shape === 'stmt') {
          j.previousStatement = null;
          j.nextStatement = null;
        } else if (shape === 'num') j.output = 'Number';
        else if (shape === 'bool') j.output = 'Boolean';
        this.jsonInit(j);
      },
    };
  };

  def('rm_ai_obj_seen', COL.ai, [dd('OBJ', objOptions)], 'bool');
  def('rm_ai_obj_value', COL.ai, [dd('OBJ', objOptions), dd('WHAT', () => [
    [t('o.objv.x'), '1'], [t('o.objv.y'), '2'], [t('o.objv.size'), '3'], [t('o.objv.score'), '4'], [t('o.objv.id'), '0']])], 'num');
  def('rm_ai_teach_is', COL.ai, [dd('N', teachOptions)], 'bool');
  def('rm_ai_teach_value', COL.ai, [dd('WHAT', () => opts('teachv', ['taught', 'taught_conf']))], 'num');
  def('rm_ai_color_is', COL.ai, [dd('COLOR', () => opts('color', ['RED', 'ORANGE', 'YELLOW', 'GREEN', 'CYAN', 'BLUE', 'VIOLET', 'MAGENTA', 'WHITE', 'BLACK']))], 'bool');
  def('rm_ai_color_value', COL.ai, [dd('WHAT', () => [[t('o.colorv.id'), 'id'], [t('o.colorv.r'), '0'], [t('o.colorv.g'), '1'], [t('o.colorv.b'), '2']])], 'num');
  def('rm_ai_lcolor_seen', COL.ai, [dd('N', slotOptions)], 'bool');
  def('rm_ai_lcolor_value', COL.ai, [dd('N', slotOptions), dd('WHAT', () => [[t('o.objv.x'), '1'], [t('o.objv.y'), '2'], [t('o.lcolv.size'), '3']])], 'num');

  // 모터 두 개를 한 블록으로
  const mports = () => (W.hub()?.motorPorts || ['A', 'B']).map((p) => [p, p]);
  const dirs = (first) => opts('dir', first === 'CLOCKWISE' ? ['CLOCKWISE', 'COUNTERCLOCKWISE'] : ['COUNTERCLOCKWISE', 'CLOCKWISE']);
  def('rm_motor_pair_run', COL.motor, [dd('P1', mports), num('S1'), dd('P2', mports), num('S2')], 'stmt');
  def('rm_motor_pair_setup', COL.motor, [dd('P1', mports), dd('D1', () => dirs('COUNTERCLOCKWISE')), dd('P2', mports), dd('D2', () => dirs('CLOCKWISE'))], 'stmt');

  def('rm_eio_dout', COL.esp, [dd('PORT', ports), pinIn, dd('ON', () => opts('onoff', ['1', '0']))], 'stmt');
  def('rm_eio_din', COL.esp, [dd('PORT', ports), pinIn, dd('PULL', () => opts('pull', ['2', '3', '1']))], 'bool');
  def('rm_eio_ain', COL.esp, [dd('PORT', ports), pinIn], 'num');
  def('rm_eio_pwm', COL.esp, [dd('PORT', ports), pinIn, num('VAL')], 'stmt');
  def('rm_eio_servo', COL.esp, [dd('PORT', ports), pinIn, num('ANGLE')], 'stmt');
  def('rm_eio_np_init', COL.esp, [dd('PORT', ports), pinIn, num('COUNT')], 'stmt');
  def('rm_eio_np_set', COL.esp, [dd('PORT', ports), num('N'), ...RGB], 'stmt');
  def('rm_eio_np_setc', COL.esp, [dd('PORT', ports), num('N'), dd('COLOR', npColors)], 'stmt');
  def('rm_eio_np_fill', COL.esp, [dd('PORT', ports), ...RGB], 'stmt');
  def('rm_eio_np_fillc', COL.esp, [dd('PORT', ports), dd('COLOR', npColors)], 'stmt');

  // ───────────── 파이썬 (실제 허브로 보낼 코드 — 에디터와 같은 결과) ─────────────
  const PY = window.python?.pythonGenerator;
  const PO = window.python?.Order;
  if (PY) {
    const pv = (b, n, d = '0') => PY.valueToCode(b, n, PO.NONE) || d;
    const aicam = () => (PY.rmPlainImports_.add('rm_aicam'), 'rm_aicam');
    const imp = (m, n) => {
      if (!PY.rmImports_.has(m)) PY.rmImports_.set(m, new Set());
      if (n) PY.rmImports_.get(m).add(n);
    };
    // 핀 블록이 있으면 ESP32 를 io=True 로 만듭니다 (이미 io 없이 만들어졌어도 덮어씀)
    const esp = (p) => {
      imp('rm_esp32', 'ESP32');
      imp('pybricks.parameters', 'Port');
      PY.rmSetup_.set('esp32_' + p, `esp32_${p} = ESP32(Port.${p}, io=True)`);
      return 'esp32_' + p;
    };
    const F = PO.FUNCTION_CALL;
    const g = PY.forBlock;
    // 모터 두 개 블록 → 기존 한 모터 블록의 생성기를 그대로 써서 같은 코드로
    const asOne = (b, map) => new Proxy(b, { get: (o, k) => (k === 'getFieldValue' ? (n) => o.getFieldValue(map[n] || n)
      : k === 'getInput' ? (n) => o.getInput(map[n] || n) : k === 'getInputTargetBlock' ? (n) => o.getInputTargetBlock(map[n] || n)
        : typeof o[k] === 'function' ? o[k].bind(o) : o[k]) });
    const pairGen = (G, one) => (b) => [1, 2].map((i) => G.forBlock[one](asOne(b, one === 'rm_motor_run'
      ? { PORT: 'P' + i, SPEED: 'S' + i } : { PORT: 'P' + i, DIR: 'D' + i }), G)).join('');
    window.__wbPair = pairGen;
    g.rm_motor_pair_run = pairGen(PY, 'rm_motor_run');
    g.rm_motor_pair_setup = pairGen(PY, 'rm_motor_setup');
    g.rm_ai_obj_seen = (b) => [`${aicam()}.object_seen(${b.getFieldValue('OBJ')})`, F];
    g.rm_ai_obj_value = (b) => [`${aicam()}.object_value(${b.getFieldValue('OBJ')}, ${b.getFieldValue('WHAT')})`, F];
    g.rm_ai_teach_is = (b) => [`${aicam()}.taught_is(${b.getFieldValue('N')})`, F];
    g.rm_ai_teach_value = (b) => [`${aicam()}.${b.getFieldValue('WHAT')}()`, F];
    g.rm_ai_color_is = (b) => [`${aicam()}.center_color_is(rm_aicam.${b.getFieldValue('COLOR')})`, F];
    g.rm_ai_color_value = (b) => {
      const w = b.getFieldValue('WHAT');
      return [w === 'id' ? `${aicam()}.center_color()` : `${aicam()}.center_rgb(${w})`, F];
    };
    g.rm_ai_lcolor_seen = (b) => [`${aicam()}.learned_color_seen(${b.getFieldValue('N')})`, F];
    g.rm_ai_lcolor_value = (b) => [`${aicam()}.learned_color_value(${b.getFieldValue('N')}, ${b.getFieldValue('WHAT')})`, F];
    const P = (b) => esp(b.getFieldValue('PORT'));
    g.rm_eio_dout = (b) => `${P(b)}.digital_write(${pv(b, 'PIN')}, ${b.getFieldValue('ON') === '1' ? 'True' : 'False'})\n`;
    g.rm_eio_din = (b) => [`${P(b)}.digital_read(${pv(b, 'PIN')}, ${b.getFieldValue('PULL')})`, F];
    g.rm_eio_ain = (b) => [`${P(b)}.analog_read(${pv(b, 'PIN')})`, F];
    g.rm_eio_pwm = (b) => `${P(b)}.pwm(${pv(b, 'PIN')}, ${pv(b, 'VAL')})\n`;
    g.rm_eio_servo = (b) => `${P(b)}.servo(${pv(b, 'PIN')}, ${pv(b, 'ANGLE')})\n`;
    g.rm_eio_np_init = (b) => `${P(b)}.neopixel_init(${pv(b, 'PIN')}, ${pv(b, 'COUNT', '1')})\n`;
    g.rm_eio_np_set = (b) => `${P(b)}.neopixel_set(${pv(b, 'N', '1')}, ${pv(b, 'R')}, ${pv(b, 'G')}, ${pv(b, 'B')})\n`;
    g.rm_eio_np_setc = (b) => `${P(b)}.neopixel_set(${pv(b, 'N', '1')}, ${NP_COLORS[b.getFieldValue('COLOR')].join(', ')})\n`;
    g.rm_eio_np_fill = (b) => `${P(b)}.neopixel_fill(${pv(b, 'R')}, ${pv(b, 'G')}, ${pv(b, 'B')})\n`;
    g.rm_eio_np_fillc = (b) => `${P(b)}.neopixel_fill(${NP_COLORS[b.getFieldValue('COLOR')].join(', ')})\n`;
  }

  // ───────────── 시뮬레이터 (자바스크립트) ─────────────
  const JG = window.javascript?.javascriptGenerator;
  const JO = window.javascript?.Order;
  if (JG) {
    const jv = (b, n, d = '0') => JG.valueToCode(b, n, JO.NONE) || d;
    const X = 'window.__wbx';
    const F = JO.FUNCTION_CALL;
    const g = JG.forBlock;
    // 실행 중인 블록 밝히기: 문장 블록마다 __wbTrace(블록 id) 를 앞에 넣음
    JG.STATEMENT_PREFIX = '__wbTrace(%1);\n';
    const hs = document.createElement('style');
    hs.textContent = '.rm-run>.blocklyPath{filter:brightness(1.45) drop-shadow(0 0 6px #FFD400)!important;stroke:#FFD400!important;stroke-width:3px!important}';
    document.head.appendChild(hs);
    let runB = null;
    window.__wbTrace = (id) => {
      try {
        const ws = W.ws();
        const b = id && ws ? ws.getBlockById(id) : null;
        if (b === runB) return;
        if (runB && runB.getSvgRoot()) runB.getSvgRoot().classList.remove('rm-run');
        runB = b;
        if (b && b.getSvgRoot()) b.getSvgRoot().classList.add('rm-run');
      } catch (e) { /* 무시 */ }
    };
    const stopBtn = document.querySelector('#simStop');
    if (stopBtn) {
      new MutationObserver(() => {
        if (stopBtn.hidden) setTimeout(() => { window.__wbTrace(null); }, 400);
      }).observe(stopBtn, { attributes: true, attributeFilter: ['hidden'] });
    }
    if (window.__wbPair) {
      g.rm_motor_pair_run = window.__wbPair(JG, 'rm_motor_run');
      g.rm_motor_pair_setup = window.__wbPair(JG, 'rm_motor_setup');
    } else {
      g.rm_motor_pair_run = (b) => ['1', '2'].map((i) => `await api.wbRun(${JSON.stringify(b.getFieldValue('P' + i))}, ${jv(b, 'S' + i, '50')});\n`).join('');
      g.rm_motor_pair_setup = (b) => ['1', '2'].map((i) => `await api.wbMotorDir(${JSON.stringify(b.getFieldValue('P' + i))}, ${JSON.stringify(b.getFieldValue('D' + i))});\n`).join('');
    }
    g.rm_ai_obj_seen = (b) => [`${X}.objSeen(${b.getFieldValue('OBJ')})`, F];
    g.rm_ai_obj_value = (b) => [`${X}.objValue(${b.getFieldValue('OBJ')}, ${b.getFieldValue('WHAT')})`, F];
    g.rm_ai_teach_is = (b) => [`(${X}.get('T', 0, 0) === ${b.getFieldValue('N')})`, JO.EQUALITY];
    g.rm_ai_teach_value = (b) => [`${X}.get('T', ${b.getFieldValue('WHAT') === 'taught' ? 0 : 1}, 0)`, F];
    g.rm_ai_color_is = (b) => [`(${X}.get('C', 0, 0) === ${COLOR_IDS.indexOf(b.getFieldValue('COLOR'))})`, JO.EQUALITY];
    g.rm_ai_color_value = (b) => {
      const w = b.getFieldValue('WHAT');
      return [`${X}.get('C', ${w === 'id' ? 0 : 1 + Number(w)}, 0)`, F];
    };
    g.rm_ai_lcolor_seen = (b) => [`(${X}.get('K', ${(Number(b.getFieldValue('N')) - 1) * 4}, 0) === 1)`, JO.EQUALITY];
    g.rm_ai_lcolor_value = (b) => [`${X}.lcolor(${b.getFieldValue('N')}, ${b.getFieldValue('WHAT')})`, F];
    // ESP32 는 시뮬레이터에 없으므로 값은 0, 출력은 무시 (한 번 안내)
    for (const k of ESP_IO_BLOCKS) {
      g[k] = (b) => {
        // 입력 값 안의 블록도 실행되도록 계산은 해 둡니다
        for (const n of ['PIN', 'VAL', 'ANGLE', 'COUNT', 'N', 'R', 'G', 'B']) if (b.getInput(n)) jv(b, n);
        if (k === 'rm_eio_servo') return `await ${X}.servoWait(api, ${jv(b, 'PIN')}, ${jv(b, 'ANGLE')});\n`;
        if (k === 'rm_eio_din') return [`api.wbNoDev('esp', false)`, F];
        if (k === 'rm_eio_ain') return [`api.wbNoDev('esp', 0)`, F];
        return `api.wbNoDev('esp', 0);\n`;
      };
    }
  }

  // ───────────── 도구 상자 ─────────────
  const blk = (type, inputs, fields) => ({ kind: 'block', type, ...(inputs ? { inputs } : {}), ...(fields ? { fields } : {}) });
  const n = (v) => ({ shadow: { type: 'math_number', fields: { NUM: v } } });
  const label = (text) => ({ kind: 'label', text });
  window.__wbTb = (tb, hub) => {
    try {
      for (const c of tb.contents || []) {
        const items = c.contents || [];
        const mr = items.findIndex((x) => x.type === 'rm_motor_run');
        if (mr >= 0 && !items.some((x) => x.type === 'rm_motor_pair_run')) {
          const mp = hub?.motorPorts || ['A', 'B'];
          items.splice(mr + 1, 0, blk('rm_motor_pair_run', { S1: n(50), S2: n(50) }, { P1: mp[0], P2: mp[1] }));
          const ms = items.findIndex((x) => x.type === 'rm_motor_setup');
          items.splice(ms + 1, 0, blk('rm_motor_pair_setup', null, { P1: mp[0], P2: mp[1] }));
        }
        const at = items.findIndex((x) => x.type === 'rm_ai_pose_value');
        if (at >= 0 && !items.some((x) => x.type === 'rm_ai_obj_seen')) {
          items.splice(at + 1, 0,
            label(t('tb.object')), blk('rm_ai_obj_seen', null, { OBJ: '1' }), blk('rm_ai_obj_value', null, { OBJ: '1' }),
            label(t('tb.teach')), blk('rm_ai_teach_is'), blk('rm_ai_teach_value'),
            label(t('tb.color')), blk('rm_ai_color_is'), blk('rm_ai_color_value'),
            label(t('tb.lcolor')), blk('rm_ai_lcolor_seen'), blk('rm_ai_lcolor_value'));
        }
        if (hub?.lpf2 && items.some((x) => x.type === 'rm_esp_call') && !items.some((x) => x.type === 'rm_eio_dout')) {
          items.push(
            label(t('tb.espio')),
            blk('rm_eio_dout', { PIN: n(2) }), blk('rm_eio_din', { PIN: n(4) }), blk('rm_eio_ain', { PIN: n(34) }),
            blk('rm_eio_pwm', { PIN: n(2), VAL: n(50) }), blk('rm_eio_servo', { PIN: n(21), ANGLE: n(90) }),
            label(t('tb.neopixel')),
            blk('rm_eio_np_init', { PIN: n(12), COUNT: n(8) }), blk('rm_eio_np_setc', { N: n(1) }),
            blk('rm_eio_np_set', { N: n(1), R: n(60), G: n(0), B: n(0) }), blk('rm_eio_np_fillc'),
            blk('rm_eio_np_fill', { R: n(0), G: n(0), B: n(60) }));
        }
      }
    } catch (e) {
      console.warn('wordblock-sync toolbox', e);
    }
    return tb;
  };
  try {
    const ws = W.ws?.();
    if (ws && W.wbToolbox) ws.updateToolbox(window.__wbTb(W.wbToolbox(), W.hub()));
  } catch (e) {
    /* 아직 시뮬레이터 작업 공간이 없음 — 처음 열 때 위 훅이 적용됩니다 */
  }

  // ───────────── 모터 최고 속도 (Pybricks 와 같게: 이보다 빨리 돌지 않음) ─────────────
  //   SPIKE 중형·대형 1000 °/s · SPIKE Essential 소형 620 °/s · EV3 대형 800 °/s (pbio servo_settings.c)
  const MAX_DPS = { PrimeHub: 1000, EssentialHub: 620, EV3Brick: 800 };
  window.__wbClamp = (port, dps) => {
    const v = Number(dps) || 0;
    const m = MAX_DPS[W.hub()?.cls] || 1000;
    return Math.max(-m, Math.min(m, v));
  };

  // ───────────── 허브 라이브러리 (에디터와 같은 최신 버전) ─────────────
  if (W.WB_LIB) Object.assign(W.WB_LIB, LIBS);

  // ───────────── 카메라 값 계산 (에디터 aicam.js 와 같은 방법) ─────────────
  const AI = () => window.__ai?.AI;
  const D = {}; // O · T · C · K 값 배열과 갱신 시각 (Ot …)
  const modes = new Set();
  let servoAt = {};
  let teach = [];
  let colors = [];
  const unpackEmb = (s) => Float32Array.from(atob(s), (c) => ((c.charCodeAt(0) << 24) >> 24) / 127);
  const loadLearned = () => {
    try {
      teach = (lsJson('rm-teach-v1', []) || []).map((c) => (c || []).map(unpackEmb));
    } catch (e) {
      teach = [];
    }
    colors = (lsJson('rm-colors-v1', []) || []).concat(Array(COLOR_SLOTS).fill(null)).slice(0, COLOR_SLOTS);
  };
  window.addEventListener('storage', (e) => {
    if (e.key === 'rm-teach-v1' || e.key === 'rm-colors-v1') loadLearned();
  });

  const pct = (v) => Math.max(0, Math.min(100, Math.round(v * 100)));
  function rgb2hsv(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    let h = 0;
    if (d) {
      if (mx === r) h = ((g - b) / d) % 6;
      else if (mx === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60;
      if (h < 0) h += 360;
    }
    return [h, mx ? d / mx : 0, mx];
  }
  function classifyColor(r, g, b) {
    const [h, s, v] = rgb2hsv(r, g, b);
    if (v < 0.22) return 10;
    if (s < 0.22) return v > 0.7 ? 9 : 0;
    if (h < 12 || h >= 340) return 1;
    if (h < 40) return 2;
    if (h < 70) return 3;
    if (h < 160) return 4;
    if (h < 195) return 5;
    if (h < 255) return 6;
    if (h < 290) return 7;
    return 8;
  }
  const hueDiff = (a, b) => {
    const d = Math.abs(a - b) % 360;
    return d > 180 ? 360 - d : d;
  };

  let lastObj = null;
  let lastEmb = null;
  let sctx = null;
  const now = () => performance.now();

  function objects(a) {
    const v = a.video;
    const Wd = v?.videoWidth || 640, Hd = v?.videoHeight || 480;
    const list = (a.res?.obj || [])
      .map((d) => {
        const id = cocoId(d.name);
        const b = d.bb;
        if (!id || !b) return null;
        return {
          id, score: Math.round(d.score * 100),
          x: pct(1 - (b.originX + b.width / 2) / Wd), y: pct((b.originY + b.height / 2) / Hd),
          size: pct(Math.max(b.width / Wd, b.height / Hd)),
        };
      })
      .filter(Boolean)
      .sort((p, q) => q.score - p.score)
      .slice(0, 3);
    const o = [list.length];
    for (let i = 0; i < 3; i++) {
      const d = list[i];
      o.push(...(d ? [d.id, d.x, d.y, d.size, d.score] : [0, 0, 0, 0, 0]));
    }
    return o;
  }

  function taught(emb) {
    const all = [];
    teach.forEach((list, ci) => list.forEach((s) => all.push([ci, s])));
    if (!all.length) return [0, 0];
    const sims = all.map(([ci, s]) => {
      let d = 0;
      for (let i = 0; i < s.length && i < emb.length; i++) d += s[i] * emb[i];
      return [ci, d];
    });
    sims.sort((p, q) => q[1] - p[1]);
    const k = Math.min(5, sims.length);
    const votes = new Array(TEACH_CLASSES).fill(0);
    for (let i = 0; i < k; i++) votes[sims[i][0]] += 1;
    const best = votes.indexOf(Math.max(...votes));
    return [best + 1, Math.round((votes[best] / k) * 100)];
  }

  function colorScan(video) {
    if (!video || video.readyState < 2) return false;
    if (!sctx) {
      const c = document.createElement('canvas');
      c.width = 80;
      c.height = 60;
      sctx = c.getContext('2d', { willReadFrequently: true });
    }
    sctx.drawImage(video, 0, 0, 80, 60);
    const cd = sctx.getImageData(34, 24, 12, 12).data;
    let r = 0, g = 0, b = 0;
    for (let i = 0; i < cd.length; i += 4) {
      r += cd[i]; g += cd[i + 1]; b += cd[i + 2];
    }
    const cn = cd.length / 4;
    r = Math.round(r / cn); g = Math.round(g / cn); b = Math.round(b / cn);
    D.C = [classifyColor(r, g, b), r, g, b];
    const blobs = Array.from({ length: COLOR_SLOTS }, () => [0, 50, 50, 0]);
    const learned = colors.map((x, i) => [x, i]).filter(([x]) => x);
    if (learned.length) {
      const img = sctx.getImageData(0, 0, 80, 60).data;
      const Wd = 80, Hd = 60, N = Wd * Hd;
      const hsv = new Float32Array(N * 3);
      for (let p = 0; p < N; p++) {
        const [h, s, v] = rgb2hsv(img[p * 4], img[p * 4 + 1], img[p * 4 + 2]);
        hsv[p * 3] = h; hsv[p * 3 + 1] = s; hsv[p * 3 + 2] = v;
      }
      const seen = new Uint8Array(N);
      const stack = new Int32Array(N);
      for (const [ref, slot] of learned) {
        const gray = ref.s < 0.22;
        const mask = new Uint8Array(N);
        for (let p = 0; p < N; p++) {
          const h = hsv[p * 3], s = hsv[p * 3 + 1], v = hsv[p * 3 + 2];
          mask[p] = gray
            ? s < 0.25 && Math.abs(v - ref.v) < 0.18
            : s > 0.25 && hueDiff(h, ref.h) < 16 && Math.abs(s - ref.s) < 0.4 && Math.abs(v - ref.v) < 0.45;
        }
        seen.fill(0);
        let best = null;
        for (let p0 = 0; p0 < N; p0++) {
          if (!mask[p0] || seen[p0]) continue;
          let top = 0, cnt = 0, sx = 0, sy = 0;
          stack[top++] = p0;
          seen[p0] = 1;
          while (top) {
            const p = stack[--top];
            const x = p % Wd, y = (p / Wd) | 0;
            cnt++; sx += x; sy += y;
            for (const q of [p - 1, p + 1, p - Wd, p + Wd]) {
              if (q < 0 || q >= N || seen[q] || !mask[q]) continue;
              if ((q === p - 1 && x === 0) || (q === p + 1 && x === Wd - 1)) continue;
              seen[q] = 1;
              stack[top++] = q;
            }
          }
          if (!best || cnt > best.cnt) best = { cnt, sx, sy };
        }
        if (best && best.cnt >= N * 0.004) {
          blobs[slot] = [1,
            Math.round(100 - ((best.sx / best.cnt + 0.5) / Wd) * 100),
            Math.round(((best.sy / best.cnt + 0.5) / Hd) * 100),
            Math.min(100, Math.round((best.cnt / N) * 100 * 10) / 10)];
        }
      }
    }
    D.K = blobs.flat();
    return true;
  }

  function tick() {
    const a = AI();
    if (!a || !a.on || !modes.size) return;
    const tnow = now();
    if (modes.has('obj') && a.res?.obj && a.res.obj !== lastObj) {
      lastObj = a.res.obj;
      D.O = objects(a);
      D.Ot = tnow;
    }
    if (modes.has('teach') && a.lastEmb && a.lastEmb !== lastEmb) {
      lastEmb = a.lastEmb;
      D.T = taught(a.lastEmb);
      D.Tt = tnow;
    }
    if (modes.has('color') && colorScan(a.video)) D.Ct = D.Kt = tnow;
  }
  setInterval(tick, 80);

  const fresh = (k) => {
    const a = AI();
    return !!(a && a.on && D[k] && now() - (D[k + 't'] || 0) <= 1500);
  };
  const get = (k, i, d) => (fresh(k) ? D[k][i] ?? d : d);
  window.__wbx = {
    get,
    objSeen(id) {
      if (!fresh('O')) return false;
      const v = D.O;
      for (let i = 0; i < Math.min(v[0], 3); i++) if (id === 0 || v[1 + i * 5] === id) return true;
      return false;
    },
    objValue(id, what) {
      if (!fresh('O')) return 0;
      const v = D.O;
      for (let i = 0; i < Math.min(v[0], 3); i++) if (id === 0 || v[1 + i * 5] === id) return v[1 + i * 5 + what];
      return 0;
    },
    lcolor(slot, what) {
      if (get('K', (slot - 1) * 4, 0) !== 1) return what === 3 ? 0 : 50;
      return get('K', (slot - 1) * 4 + what, 0);
    },
    // 허브 rm_esp32.servo 와 같은 시간만큼 기다림 (시뮬레이터에도 같은 박자)
    async servoWait(api, pin, angle) {
      api.wbNoDev('esp', 0);
      const a = Math.max(0, Math.min(180, Math.trunc(Number(angle) || 0)));
      const prev = servoAt[pin];
      servoAt[pin] = a;
      const ms = prev === undefined ? 500 : Math.trunc(Math.abs(a - prev) * 10 / 3);
      if (ms > 0) await api.wait((ms + 20) / 1000);
    },
    modes,
    data: D,
  };

  // 프로그램 시작 시 (시뮬레이터 실행 · 허브로 보내기) 필요한 카메라 기능을 켭니다
  window.__wbKeys = (ws, keys) => {
    modes.clear();
    servoAt = {};
    try {
      for (const b of ws?.getAllBlocks(false) || []) if (b.isEnabled() && AI_BLOCKS[b.type]) modes.add(AI_BLOCKS[b.type]);
    } catch (e) {
      /* 작업 공간 없음 */
    }
    if (modes.size) loadLearned();
    const k = new Set(keys);
    if (modes.has('obj')) k.add('obj.person.v');
    if (modes.has('teach')) k.add('cls.c');
    if (modes.has('color')) k.add('col.red.v');
    return [...k];
  };

  // 실제 허브로 실행할 때 보내는 값 (에디터 aicam.js frame() 과 같은 형식)
  window.__wbFrames = () => {
    let s = '';
    if (modes.has('obj') && fresh('O')) s += 'O:' + D.O.join(',') + '\n';
    if (modes.has('teach') && fresh('T')) s += 'T:' + D.T.join(',') + '\n';
    if (modes.has('color') && fresh('C')) s += 'C:' + D.C.join(',') + '\nK:' + D.K.map((x) => Math.round(x)).join(',') + '\n';
    return s;
  };

  // ───────────── 워드블럭 에디터 ↔ 시뮬레이터 ─────────────
  const HUB_OF = { PrimeHub: 'prime', EssentialHub: 'essential', EV3Brick: 'ev3' };
  const hubKey = () => HUB_OF[W.hub()?.cls] || 'prime';
  const toast = (msg) => {
    let el = document.getElementById('wbToast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'wbToast';
      el.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:#1f2937;color:#fff;padding:10px 16px;border-radius:8px;z-index:99;font:14px sans-serif;box-shadow:0 4px 16px rgba(0,0,0,.25);max-width:90vw';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(el._t);
    el._t = setTimeout(() => (el.hidden = true), 4000);
  };

  function toEditor() {
    const ws = W.ws?.();
    if (!ws) return;
    try {
      localStorage.setItem(HANDOFF, JSON.stringify({ v: 1, from: 'sim', hub: hubKey(), ws: Bly.serialization.workspaces.save(ws), t: Date.now() }));
    } catch (e) {
      toast(String(e.message || e));
      return;
    }
    window.open(EDITOR_URL, 'rm-wordblock');
  }

  function addButton() {
    if (document.getElementById('wbToEditor')) return;
    const anchor = document.getElementById('simReset') || document.getElementById('simStop') || document.getElementById('simRun');
    if (!anchor) return;
    const b = document.createElement('button');
    b.id = 'wbToEditor';
    b.className = 'small';
    b.type = 'button';
    b.onclick = toEditor;
    const set = () => {
      b.textContent = t('wb.toEditor');
      b.title = t('wb.toEditorTitle');
    };
    set();
    anchor.insertAdjacentElement('afterend', b);
    document.getElementById('langSel')?.addEventListener('change', () => setTimeout(set, 0));
  }

  function unknownTypes(state) {
    const out = new Set();
    const walk = (b) => {
      if (!b || typeof b !== 'object') return;
      if (b.type && !Bly.Blocks[b.type]) out.add(b.type);
      for (const v of Object.values(b.inputs || {})) {
        walk(v.block);
        walk(v.shadow);
      }
      walk(b.next?.block);
    };
    for (const b of state?.blocks?.blocks || []) walk(b);
    return [...out];
  }

  function fromEditor() {
    if (!/[?&]from=wordblock\b/.test(location.search)) return;
    history.replaceState(null, '', location.pathname + location.hash);
    const h = lsJson(HANDOFF, null);
    if (!h || h.from !== 'editor' || !h.ws || Date.now() - (h.t || 0) > 10 * 60 * 1000) return;
    localStorage.removeItem(HANDOFF);
    const proj = W.proj();
    proj.sim = proj.sim || {};
    if (h.hub) proj.sim.hub = h.hub;
    proj.program = h.ws;
    W.save?.();
    if (W.simOn()) {
      // 이미 시뮬레이터 화면이면 바로 바꿔 넣기
      const ws = W.ws();
      ws.clear();
      Bly.serialization.workspaces.load(h.ws, ws);
    } else {
      W.enterSim();
    }
    const sel = document.getElementById('simHubKind');
    if (sel && h.hub) {
      sel.value = h.hub;
      sel.dispatchEvent(new Event('change'));
    }
    const mat = document.getElementById('simMat');
    if (mat && h.mat && [...mat.options].some((o) => o.value === h.mat)) {
      mat.value = h.mat;
      mat.dispatchEvent(new Event('change'));
    }
    const unknown = unknownTypes(h.ws);
    toast(unknown.length ? t('wb.unknown', unknown.join(', ')) : t('wb.fromEditor'));
  }

  function whenReady(fn, tries = 0) {
    const loading = document.getElementById('loading');
    if ((loading && !loading.hidden) && tries < 600) return setTimeout(() => whenReady(fn, tries + 1), 100);
    fn();
  }
  addButton();
  whenReady(() => {
    try {
      fromEditor();
    } catch (e) {
      console.warn('wordblock-sync handoff', e);
      toast(String(e.message || e));
    }
  });
  window.__wbSync = { version: EDITOR_VERSION, toEditor, fromEditor };
})();

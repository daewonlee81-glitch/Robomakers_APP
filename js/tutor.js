// tutor.js — AI 튜터 (인터넷 없이, 이 컴퓨터 안에서만)
//
//  블록 → 번호 붙은 글 [L1]… (+ 파이썬) → AI → 「[L4]」 처럼 줄 번호로 답 → 그 블록을 노랗게 표시
//
//  엔진 (한 번 설치하면 인터넷 없이):
//    · Chrome 내장 AI (Prompt API · Gemini Nano) — Chrome 이 모델 관리. 지원 언어 en·ja·es·de·fr
//    · 오픈 모델 (WebLLM) — 가벼움 Qwen2.5-Coder 1.5B · 추천 Qwen3.5 2B · 고성능 Qwen3.5 4B (tutor-bench.js)
//      vendor/web-llm, 모델은 처음 한 번 huggingface 에서 받아 브라우저에 저장
//  규칙 점검은 AI 없이도 항상 동작합니다 (떨어진 블록, 기다리기 없는 반복, 포트 겹침 …).

/* global Blockly */
import { t, getLang } from './i18n.js?v=0.3.18';
import { expectedPorts } from './statusmon.js?v=0.3.18';
import './tutor-bench.js?v=0.3.18'; // window.RMTutorBench — 모델 목록 · 비교 시험 (다른 앱과 공용)

const B = window.RMTutorBench;

const STORE = 'rm-tutor';
const CHROME_LANGS = ['en', 'ja', 'es', 'de', 'fr'];
const LANG_NAME = { ko: 'Korean', en: 'English', ja: 'Japanese', 'zh-CN': 'Simplified Chinese', 'zh-TW': 'Traditional Chinese', es: 'Spanish', th: 'Thai' };
const WEBLLM = '../vendor/web-llm/index.js'; // 버전 고정 (따로 캐시)

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// ───────────── 블록 → 번호 붙은 글 ─────────────
function fieldText(f) {
  try {
    const s = f.getText();
    return s && s.trim() ? s.trim() : '';
  } catch (e) {
    return '';
  }
}
function valueText(b) {
  try {
    return b.toString(80, '?').replace(/\s+/g, ' ');
  } catch (e) {
    return b.type;
  }
}

/** 작업 공간을 줄 단위 글로. lines[i] = { n, id, depth, text } */
export function blocksToText(ws) {
  const lines = [];
  const emit = (b, depth, tokens) => {
    const text = tokens.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
    if (text) lines.push({ n: lines.length + 1, id: b.id, depth, text });
  };
  const walk = (b, depth) => {
    for (; b; b = b.getNextBlock()) {
      if (!b.isEnabled()) continue;
      let tokens = [];
      let first = true;
      for (const input of b.inputList) {
        for (const f of input.fieldRow) tokens.push(fieldText(f));
        if (input.type === Blockly.inputs.inputTypes.STATEMENT) {
          emit(b, first ? depth : depth, tokens);
          tokens = [];
          first = false;
          walk(input.connection?.targetBlock(), depth + 1);
        } else if (input.connection?.targetBlock()) {
          tokens.push('(' + valueText(input.connection.targetBlock()) + ')');
        }
      }
      if (first || tokens.some(Boolean)) emit(b, depth, tokens);
    }
  };
  const tops = ws.getTopBlocks(true).filter((b) => b.type === 'rm_start' || b.type.startsWith('procedures_def'));
  for (const b of tops) walk(b, 0);
  const text = lines.map((l) => `[L${l.n}] ${'  '.repeat(l.depth)}${l.text}`).join('\n');
  return { lines, text };
}

// ───────────── 규칙 점검 (AI 없이) ─────────────
const STMT_WAITS = /^(rm_wait|rm_wait_until|rm_forever|rm_drive_straight|rm_drive_turn|rm_motor_run_for|rm_motor_target|rm_beep|rm_eio_servo|rm_pad_rumble)$/;
export function ruleCheck(ws, code, ctx) {
  const out = [];
  const all = ws.getAllBlocks(false);
  const tops = ws.getTopBlocks(false);
  const starts = tops.filter((b) => b.type === 'rm_start');
  const floating = tops.filter((b) => b.type !== 'rm_start' && !b.type.startsWith('procedures_def') && b.isEnabled());
  if (floating.length) out.push({ level: 'warn', msg: t('rule.floating', floating.length), ids: floating.map((b) => b.id) });
  if (starts.length && starts.every((s) => !s.getNextBlock())) out.push({ level: 'warn', msg: t('rule.empty'), ids: starts.map((b) => b.id) });

  // 기다리기 없는 while/until 반복
  for (const b of all) {
    if (b.type !== 'controls_whileUntil' || !b.isEnabled()) continue;
    const body = b.getInputTargetBlock('DO');
    const inner = body ? body.getDescendants(false) : [];
    if (!inner.some((x) => STMT_WAITS.test(x.type))) out.push({ level: 'info', msg: t('rule.busyLoop'), ids: [b.id] });
  }

  // 한 포트에 서로 다른 장치
  const byPort = {};
  for (const m of code.matchAll(/^\s*\w+\s*=\s*(\w+)\((?:"esp32",\s*)?Port\.(\w+)/gm)) {
    (byPort[m[2]] = byPort[m[2]] || new Set()).add(m[1]);
  }
  for (const [p, set] of Object.entries(byPort)) {
    if (set.size > 1) out.push({ level: 'warn', msg: t('rule.portClash', p, [...set].join(' · ')), ids: blocksOnPort(all, p) });
  }

  // 허스키렌즈: 블록 값과 라인 값을 함께
  const husky = {};
  for (const b of all) {
    if (!b.type.startsWith('rm_husky') || !b.getField('PORT')) continue;
    const p = b.getFieldValue('PORT');
    const k = b.type === 'rm_husky_line' ? 'line' : b.type === 'rm_husky_value' ? 'block' : '';
    if (k) (husky[p] = husky[p] || {})[k] = [...((husky[p] || {})[k] || []), b.id];
  }
  for (const [p, v] of Object.entries(husky)) {
    if (v.line && v.block) out.push({ level: 'warn', msg: t('rule.huskyMix', p), ids: [...v.line, ...v.block] });
  }

  // ESP32 I2C: 컬러 센서와 레이저 거리 센서는 주소가 같음(0x29) — 같은 핀에서 함께 쓰면 안 됨
  const esUse = {};
  for (const b of all) {
    if (!b.isEnabled() || !b.type.startsWith('rm_es_')) continue;
    const p = b.getFieldValue('PORT');
    const u = (esUse[p] = esUse[p] || { color: [], tof: [], pins: {} });
    if (b.type.startsWith('rm_es_color')) u.color.push(b.id);
    if (b.type === 'rm_es_tof') u.tof.push(b.id);
    if (b.type === 'rm_es_setup') u.pins[b.getFieldValue('KIND')] = (b.getInputTargetBlock('SDA')?.getFieldValue('NUM') ?? '') + '/' + (b.getInputTargetBlock('SCL')?.getFieldValue('NUM') ?? '');
  }
  for (const [p, u] of Object.entries(esUse)) {
    const grove = '5/4';
    if (u.color.length && u.tof.length && (u.pins['3'] || grove) === (u.pins['4'] || grove)) {
      out.push({ level: 'warn', msg: t('rule.esclash', p), ids: [...u.color, ...u.tof] });
    }
  }

  // 정하지 않은 변수
  const setIds = new Set(all.filter((b) => b.type === 'variables_set' || b.type === 'math_change').map((b) => b.getFieldValue('VAR')));
  for (const b of all) {
    if (b.type !== 'variables_get') continue;
    const id = b.getFieldValue('VAR');
    if (!setIds.has(id)) {
      const name = ws.getVariableById?.(id)?.name || ws.getVariableMap?.().getVariableById(id)?.name || '?';
      out.push({ level: 'warn', msg: t('rule.varUnset', name), ids: [b.id] });
      setIds.add(id);
    }
  }

  // 상태 탭 결과와 프로그램 비교
  const st = ctx.status?.();
  if (st?.ports) {
    const want = expectedPorts(code);
    for (const p of st.ports) {
      const w = want[p.name];
      if (!w) continue;
      const ok = w.k === 'bridge' ? p.k === 'c' || p.k === 'd' : p.k === w.k;
      if (!ok) out.push({ level: 'warn', msg: t('rule.status', p.name, t('st.mismatch', t('st.k.' + w.k), t('st.k.' + p.k))), ids: blocksOnPort(all, p.name) });
    }
  }

  // 마지막 오류
  const err = ctx.lastError?.();
  if (err) out.push({ level: 'error', msg: t('rule.lastError', err.code || err.line || '?', err.text), ids: [] });
  return out;
}
function blocksOnPort(all, port) {
  return all.filter((b) => ['PORT', 'L', 'R', 'P1', 'P2'].some((f) => b.getField(f) && b.getFieldValue(f) === port)).map((b) => b.id);
}

// ───────────── AI 에 줄 글 ─────────────
const FACTS = `Facts about this platform (trust these):
- LEGO SPIKE Prime / Essential / EV3 hub running Pybricks. Students build programs from word blocks; the listing shows each block as one line [Ln].
- Motor speed blocks use % (x10 = deg/s). Drive speed is mm/s, turn rate deg/s (positive = turn right). Hub heading: clockwise is positive.
- "forever" loops already wait 10 ms. "repeat while/until" loops should contain a short wait (0.01 s) so sensors and camera values can update.
- HuskyLens (through the ESP32 bridge): in BLOCK mode the values are X (0-320), Y (0-240), width W; in LINE (arrow) mode they are start X, end X, end Y. The "line end Y" block returns the width in block mode. ID 0 means "any".
- AI camera values reach the robot only while the program runs with the Run button and the camera is on in the editor.
- Servo blocks wait automatically until the servo has moved.
- ENODEV error = no device, or a different device, on that port. The Status tab shows what is plugged into each port.`;

function systemPrompt(lang) {
  return `You are a friendly, patient coding tutor for children (age 9-15) using the "RoboMakers WordBlock" editor.
Always answer in ${LANG_NAME[lang] || 'English'}.
Rules:
- Be short: at most 5 short sentences or a short bullet list.
- When you talk about a block, cite its line like [L4] (exactly this format).
- Explain WHY, then say which block to change and how, using the block words from the listing.
- Do not write a whole program. Do not invent blocks or functions. If you are not sure, say so.
${FACTS}`;
}

function contextText(ws, code, rules, ctx) {
  const { text } = blocksToText(ws);
  const err = ctx.lastError?.();
  const parts = [
    `Hub: ${ctx.hubLabel()}`,
    `Block program:\n${text || '(empty)'}`,
    `Generated Python (for reference):\n${code.split('\n').filter((l) => l.trim() && !l.startsWith('#')).slice(0, 45).join('\n')}`,
  ];
  if (rules.length) parts.push('Automatic checks found:\n' + rules.map((r) => '- ' + r.msg).join('\n'));
  if (err) parts.push(`Last error from the hub: ${err.text}` + (err.code ? ` — at Python line ${err.line}: ${err.code}` : ''));
  return parts.join('\n\n');
}

// ───────────── 엔진 ─────────────
const Chrome = {
  key: 'chrome',
  async state(lang) {
    if (!('LanguageModel' in self)) return { ok: false, why: 'chromeNo' };
    if (!CHROME_LANGS.includes(lang)) return { ok: false, why: 'chromeNoLang' };
    try {
      const a = await LanguageModel.availability(this.opts(lang));
      return { ok: a !== 'unavailable', installed: a === 'available', a };
    } catch (e) {
      return { ok: false, why: 'chromeNo' };
    }
  },
  opts(lang) {
    return { expectedInputs: [{ type: 'text', languages: ['en', lang] }], expectedOutputs: [{ type: 'text', languages: [lang] }] };
  },
  async load(lang, progress) {
    this.base = await LanguageModel.create({
      ...this.opts(lang),
      initialPrompts: [{ role: 'system', content: systemPrompt(lang) }],
      monitor(m) {
        m.addEventListener('downloadprogress', (e) => progress(Math.round((e.loaded || 0) * 100)));
      },
    });
    this.lang = lang;
  },
  async *ask(user) {
    const s = await this.base.clone();
    let prev = '';
    for await (const chunk of s.promptStreaming(user)) {
      // 예전 구현은 누적 글, 지금은 조각 — 둘 다 처리
      const piece = chunk.startsWith(prev) && prev ? chunk.slice(prev.length) : chunk;
      prev = chunk.startsWith(prev) ? chunk : prev + chunk;
      yield piece;
    }
    s.destroy?.();
  },
};

const Open = {
  key: 'webllm',
  async gpu() {
    if (!navigator.gpu) return null;
    try {
      const a = await navigator.gpu.requestAdapter();
      return a ? { f16: a.features.has('shader-f16') } : null;
    } catch (e) {
      return null;
    }
  },
  async lib() {
    this._lib = this._lib || (await import(WEBLLM));
    return this._lib;
  },
  async modelId(size) {
    const g = await this.gpu();
    return g ? B.modelId(size, g.f16) : null;
  },
  async installed(size) {
    const id = await this.modelId(size);
    if (!id) return false;
    try {
      return await (await this.lib()).hasModelInCache(id);
    } catch (e) {
      return false;
    }
  },
  async load(size, lang, progress) {
    const id = await this.modelId(size);
    const lib = await this.lib();
    if (this.engine && this.id === id) return;
    this.engine?.unload?.();
    this.engine = await lib.CreateMLCEngine(id, {
      initProgressCallback: (r) => progress(Math.round((r.progress || 0) * 100), r.text),
    });
    this.id = id;
    this.size = size;
    this.lang = lang;
  },
  unload() {
    this.engine?.unload?.();
    this.engine = null;
    this.id = null;
  },
  async remove(size) {
    const id = await this.modelId(size);
    if (id) await (await this.lib()).deleteModelAllInfoInCache(id);
    if (this.id === id) {
      this.engine?.unload?.();
      this.engine = null;
      this.id = null;
    }
  },
  async *ask(user, lang) {
    const stream = await this.engine.chat.completions.create({
      messages: [{ role: 'system', content: systemPrompt(lang) }, { role: 'user', content: user }],
      stream: true, temperature: 0.3, max_tokens: 450, ...B.genOpts(this.size),
    });
    for await (const c of stream) yield c.choices?.[0]?.delta?.content || '';
  },
};


// ───────────── 모델 비교 시험 예제 (일부러 틀린 곳 하나씩 · expect = 짚어야 할 줄) ─────────────
const BENCH_CASES = [
  {
    title: '벽 앞에서 멈추기 — 비교 방향이 반대',
    question: 'My robot should drive until it is 10 cm from the wall, but it stops immediately. Check my block program.',
    expect: [3],
    listing: `Hub: SPIKE Prime

Block program:
[L1] ▶ 프로그램 시작할 때
[L2] 주행 설정 왼쪽 A 오른쪽 E 바퀴 56 mm 간격 112 mm 자이로 거짓
[L3] (거리 센서 D 거리(mm) > 100) 다음까지 반복
[L4]   속도 200 mm/초, 회전 0 도/초로 계속 주행
[L5]   0.01 초 기다리기
[L6] 주행 멈추기`,
  },
  {
    title: '포트 오류 ENODEV — 모터가 다른 포트에',
    question: 'My program stopped with the error shown below. Explain in simple words what it means and how to fix it.',
    expect: [2],
    listing: `Hub: SPIKE Prime

Block program:
[L1] ▶ 프로그램 시작할 때
[L2] 모터 B 방향을 시계 방향 로 설정
[L3] 모터 B 을 50 % 속도로 2 초 돌리기 (끝날 때까지 기다림)

Status tab (what is plugged in): A = motor, B = empty, C = color sensor
Last error from the hub: OSError: [Errno 19] ENODEV — at Python line 6: motor_B = Motor(Port.B, Direction.CLOCKWISE)`,
  },
  {
    title: '라인 트레이싱 P 제어 — Kp 를 정하지 않음',
    question: 'My line follower does not work and I do not know why. Check my block program.',
    expect: [6, 3],
    listing: `Hub: SPIKE Prime

Block program:
[L1] ▶ 프로그램 시작할 때
[L2] 주행 설정 왼쪽 A 오른쪽 E 바퀴 56 mm 간격 112 mm 자이로 거짓
[L3] 목표값 를 50 로 설정
[L4] 무한 반복
[L5]   오차 를 ((컬러 센서 C 반사광(%)) - (목표값)) 로 설정
[L6]   보정 을 ((오차) × (Kp)) 로 설정
[L7]   속도 120 mm/초, 회전 (보정) 도/초로 계속 주행`,
  },
  {
    title: '왼쪽으로 돌기 — 회전 부호',
    question: 'My robot should turn LEFT at the corner, but it turns right. Which block is wrong?',
    expect: [4],
    listing: `Hub: SPIKE Essential

Block program:
[L1] ▶ 프로그램 시작할 때
[L2] 주행 설정 왼쪽 A 오른쪽 B 바퀴 56 mm 간격 112 mm 자이로 참
[L3] 300 mm 직진하기
[L4] 90 도 회전하기 (오른쪽 +, 왼쪽 -)
[L5] 300 mm 직진하기`,
  },
  {
    title: '두 모터 방향 — 제자리에서 빙글빙글',
    question: 'Both motors run at 50 % but my robot spins in place instead of going straight. Why?',
    expect: [2],
    listing: `Hub: SPIKE Prime

Block program:
[L1] ▶ 프로그램 시작할 때
[L2] 모터 A 방향 시계 방향, 모터 E 방향 시계 방향 로 설정
[L3] 모터 A 을 50 %, 모터 E 을 50 % 속도로 계속 돌리기
[L4] 2 초 기다리기
[L5] 모터 A 멈추기 (천천히)
[L6] 모터 E 멈추기 (천천히)

Note: the motors are mounted on the left and right side of the robot, facing opposite ways.`,
  },
];

// ───────────── 화면 ─────────────
export function initTutor(ctx) {
  const { workspace } = ctx;
  const drawer = document.getElementById('tutorDrawer');
  const btn = document.getElementById('btnTutor');
  let st = { open: false, engine: '', size: 'rec' };
  try {
    st = { ...st, ...JSON.parse(localStorage.getItem(STORE) || '{}') };
  } catch (e) {
    /* 기본값 */
  }
  st.size = B.key(st.size); // 예전 이름 small/large → light/old
  const keep = () => {
    try {
      localStorage.setItem(STORE, JSON.stringify(st));
    } catch (e) {
      /* 무시 */
    }
  };
  let active = null; // 불러온 엔진
  let busy = false;

  drawer.innerHTML = `
    <div class="tt-head"><b>🤖 ${t('tutor.title')}</b><span class="tt-status"></span><button type="button" class="tt-x" aria-label="${t('tutor.close')}">✕</button></div>
    <div class="tt-setup"></div>
    <div class="tt-actions">
      <button type="button" data-q="check">${t('tutor.check')}</button>
      <button type="button" data-q="error">${t('tutor.error')}</button>
      <button type="button" data-q="hint">${t('tutor.hint')}</button>
    </div>
    <div class="tt-log" aria-live="polite"></div>
    <form class="tt-ask"><input type="text" maxlength="300" placeholder="${esc(t('tutor.ask'))}"><button type="submit" class="primary">${t('tutor.send')}</button></form>
    <p class="tt-note">${t('tutor.privacy')}</p>`;
  const $ = (s) => drawer.querySelector(s);
  const log = $('.tt-log');

  function setOpen(on) {
    st.open = on;
    keep();
    drawer.hidden = !on;
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    if (on) renderSetup();
  }
  btn.addEventListener('click', () => setOpen(drawer.hidden));
  $('.tt-x').addEventListener('click', () => setOpen(false));

  // 블록 강조
  let glowT = 0;
  function glow(ids) {
    clearTimeout(glowT);
    workspace.getAllBlocks(false).forEach((b) => b.getSvgRoot()?.classList.remove('rm-new'));
    const bs = ids.map((id) => workspace.getBlockById(id)).filter(Boolean);
    bs.forEach((b) => b.getSvgRoot()?.classList.add('rm-new'));
    if (bs[0]) workspace.centerOnBlock(bs[0].id);
    glowT = setTimeout(() => bs.forEach((b) => b.getSvgRoot()?.classList.remove('rm-new')), 8000);
  }
  let lineMap = [];
  log.addEventListener('click', (e) => {
    const a = e.target.closest('[data-ids]');
    if (!a) return;
    e.preventDefault();
    glow(a.dataset.ids.split(',').filter(Boolean));
  });
  const linkify = (s) => esc(s).replace(/\[L(\d+)(?:\s*[-–~]\s*L?(\d+))?\]/g, (m, a, b) => {
    const from = +a, to = +(b || a);
    const ids = lineMap.filter((l) => l.n >= from && l.n <= to).map((l) => l.id);
    return ids.length ? `<a href="#" class="tt-ln" data-ids="${ids.join(',')}">${b ? `${a}–${b}` : a}</a>` : m;
  }).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>');

  function addMsg(kind, html) {
    const d = document.createElement('div');
    d.className = 'tt-msg ' + kind;
    d.innerHTML = html;
    log.appendChild(d);
    log.scrollTop = log.scrollHeight;
    return d;
  }

  // 엔진 설정 칸
  async function renderSetup() {
    const box = $('.tt-setup');
    const lang = getLang();
    const chrome = await Chrome.state(lang);
    const gpu = await Open.gpu();
    const inst = {};
    if (gpu) for (const k of ['light', 'rec', 'pro', 'old']) inst[k] = await Open.installed(k);
    const sizes = gpu ? B.rows(inst).map((k) => [k, inst[k]]) : [];
    const name = active ? (active === Chrome ? t('tutor.engine.chrome') : B.label(st.size, getLang())) : '';
    lastInst = inst;
    $('.tt-status').textContent = active ? t('tutor.ready', name) : '';
    box.innerHTML = `
      ${active ? '' : `<p class="tt-none">${t('tutor.engine.none')}</p>`}
      <details class="tt-eng" ${active ? '' : 'open'}>
        <summary>${t('tutor.setup')}</summary>
        <div class="tt-opt">
          <b>${t('tutor.engine.webllm')}</b><small>${t('tutor.engine.webllmDesc')}</small>
          ${gpu ? sizes.map(([k, ok]) => `<div class="tt-row"><span>${esc(B.label(k, getLang()))}${B.desc(k, getLang()) ? `<small>${esc(B.desc(k, getLang()))}</small>` : ''}</span>
            ${ok ? `<em>${t('tutor.installed')}</em><button type="button" data-use="webllm:${k}">${t('tutor.use')}</button><button type="button" data-rm="${k}" title="${t('tutor.remove')}">🗑</button>`
              : `<button type="button" class="primary" data-use="webllm:${k}">${t('tutor.install')}</button>`}</div>`).join('')
            : `<small class="tt-bad">${t('tutor.noGpu')}</small>`}
        </div>
        <div class="tt-opt">
          <b>${t('tutor.engine.chrome')}</b><small>${t('tutor.engine.chromeDesc')}</small>
          ${chrome.ok ? `<div class="tt-row"><span>Gemini Nano</span>${chrome.installed ? `<em>${t('tutor.installed')}</em>` : ''}
            <button type="button" class="${chrome.installed ? '' : 'primary'}" data-use="chrome">${t(chrome.installed ? 'tutor.use' : 'tutor.install')}</button></div>`
            : `<small class="tt-bad">${t('tutor.engine.' + chrome.why, lang)}</small>`}
        </div>
        <div class="tt-prog" hidden><i></i><span></span></div>
        <small>${t('tutor.needNet')}</small>
        ${gpu || chrome.ok ? `<button type="button" class="tt-bench" data-bench="1">${esc(B.text('bench', getLang()))}</button>` : ''}
      </details>`;
  }
  let lastInst = {};
  async function openBench() {
    const lang = getLang();
    const g = await Open.gpu();
    const chrome = await Chrome.state(lang);
    B.open({
      lang,
      cases: BENCH_CASES,
      systemPrompt,
      lib: () => Open.lib(),
      f16: !!g?.f16,
      installed: lastInst,
      chrome: chrome.ok && chrome.installed ? {
        ok: true,
        label: t('tutor.engine.chrome'),
        async *ask(system, user) {
          const s = await LanguageModel.create({ ...Chrome.opts(lang), initialPrompts: [{ role: 'system', content: system }] });
          let prev = '';
          for await (const chunk of s.promptStreaming(user)) {
            const piece = chunk.startsWith(prev) && prev ? chunk.slice(prev.length) : chunk;
            prev = chunk.startsWith(prev) ? chunk : prev + chunk;
            yield piece;
          }
          s.destroy?.();
        },
      } : null,
      // 시험하는 동안 튜터가 쓰던 모델은 내려놓고(그래픽 메모리), 끝나면 다시
      before: () => {
        if (active === Open) active = null;
        Open.unload();
      },
      after: () => restore(),
      onUse: (k) => {
        st.size = k;
        st.engine = 'webllm';
        keep();
        restore();
      },
      toast: (m) => ctx.toast(m, 'ok'),
    });
  }
  $('.tt-setup').addEventListener('click', async (e) => {
    if (e.target.closest('[data-bench]')) return openBench();
    const use = e.target.closest('[data-use]')?.dataset.use;
    const rm = e.target.closest('[data-rm]')?.dataset.rm;
    if (rm) {
      await Open.remove(rm);
      if (active === Open && st.size === rm) active = null;
      return renderSetup();
    }
    if (!use || busy) return;
    const prog = $('.tt-prog');
    const bar = (p, txt) => {
      prog.hidden = false;
      prog.querySelector('i').style.width = p + '%';
      prog.querySelector('span').textContent = t('tutor.installing', p) + (txt ? ' · ' + txt.slice(0, 60) : '');
    };
    busy = true;
    // 큰 모델 파일을 브라우저가 지우지 않도록 「계속 보관」 요청
    navigator.storage?.persist?.().catch(() => {});
    try {
      if (use === 'chrome') {
        await Chrome.load(getLang(), bar);
        active = Chrome;
        st.engine = 'chrome';
      } else {
        st.size = use.split(':')[1];
        await Open.load(st.size, getLang(), bar);
        active = Open;
        st.engine = 'webllm';
      }
      keep();
      ctx.toast(t('tutor.ready', use === 'chrome' ? t('tutor.engine.chrome') : B.label(st.size, getLang())), 'ok');
    } catch (err) {
      addMsg('err', esc(t('tutor.failed', err.message || err)));
    } finally {
      busy = false;
      renderSetup();
    }
  });

  // 이전에 쓰던 엔진을 다시 불러오기 (설치돼 있을 때만 → 인터넷 없이)
  async function restore() {
    try {
      if (st.engine === 'webllm' && (await Open.installed(st.size))) {
        $('.tt-status').textContent = t('tutor.loading');
        await Open.load(st.size, getLang(), () => {});
        active = Open;
      } else if (st.engine === 'chrome' && (await Chrome.state(getLang())).installed) {
        await Chrome.load(getLang(), () => {});
        active = Chrome;
      }
    } catch (e) {
      active = null;
    }
    renderSetup();
  }

  // 질문하기
  const QUESTION = {
    check: 'Check my block program for mistakes. Explain the most important problem first and which block to change.',
    error: 'My program stopped with the error shown below. Explain in simple words what it means and how to fix it.',
    hint: 'Do not solve it for me. Give me one hint about what to try or improve next in my block program.',
  };
  async function ask(kind, free) {
    if (busy) return;
    const code = ctx.code();
    const rules = ruleCheck(workspace, code, ctx);
    lineMap = blocksToText(workspace).lines;
    if (kind) addMsg('me', esc(t('tutor.' + kind)));
    else addMsg('me', esc(free));

    if (kind === 'check' || kind === 'error') {
      const shown = kind === 'error' ? rules.filter((r) => r.level === 'error') : rules;
      if (kind === 'error' && !shown.length) addMsg('rule', esc(t('tutor.noError')));
      else addMsg('rule', `<b>${t('tutor.rules')}</b><br>` + (shown.length
        ? shown.map((r) => `<a href="#" class="tt-rule lv-${r.level}" data-ids="${r.ids.join(',')}">${r.level === 'error' ? '⛔' : r.level === 'warn' ? '⚠' : 'ℹ️'} ${esc(r.msg)}</a>`).join('<br>')
        : esc(t('tutor.noIssue'))));
      if (kind === 'error' && !shown.length) return;
    }
    if (!active) {
      if (!kind || kind === 'hint') addMsg('sys', esc(t('tutor.engine.none')));
      return;
    }
    busy = true;
    const out = addMsg('ai', `<span class="tt-dots">${t('tutor.thinking')}</span>`);
    let txt = '';
    try {
      const user = `${kind ? QUESTION[kind] : 'Question: ' + free}\n\n${contextText(workspace, code, rules, ctx)}`;
      for await (const piece of active.ask(user, getLang())) {
        txt += piece;
        // Qwen 의 생각 표시(<think>…</think>)는 숨김
        out.innerHTML = linkify(txt.replace(/<think>[\s\S]*?(<\/think>|$)/g, '').trim()) || `<span class="tt-dots">${t('tutor.thinking')}</span>`;
        log.scrollTop = log.scrollHeight;
      }
    } catch (err) {
      out.innerHTML = esc(t('tutor.failed', err.message || err));
      out.classList.add('err');
    } finally {
      busy = false;
    }
  }
  drawer.querySelector('.tt-actions').addEventListener('click', (e) => {
    const q = e.target.closest('[data-q]')?.dataset.q;
    if (q) ask(q);
  });
  $('.tt-ask').addEventListener('submit', (e) => {
    e.preventDefault();
    const inp = $('.tt-ask input');
    const q = inp.value.trim();
    if (!q) return;
    inp.value = '';
    ask(null, q);
  });

  drawer.hidden = !st.open;
  btn.setAttribute('aria-pressed', st.open ? 'true' : 'false');
  if (st.engine) restore();
  else if (st.open) renderSetup();
  return { open: () => setOpen(true), ask, ruleCheck: () => ruleCheck(workspace, ctx.code(), ctx), blocksToText: () => blocksToText(workspace) };
}

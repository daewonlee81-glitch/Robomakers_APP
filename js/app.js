// app.js — 로보메이커스 워드블럭 웹 에디터 메인
/* global Blockly */

import { HUBS, getHubKey, setHubKey, hub } from './hubs.js';
import { generatePython } from './blocks.js';
import { buildToolbox } from './toolbox.js';
import { PybricksHub, buildProgram, CompileError } from './pybricks.js';
import { AICamera, GESTURE_KO } from './aicam.js';
import { WebGamepad } from './gamepad.js';
import { EXAMPLES, emptyProgram } from './examples.js';

const $ = (s) => document.querySelector(s);
const STORE = 'rm-wordblock-v1';

// ───────────────────────── Blockly 작업 공간 ─────────────────────────
const theme = Blockly.Theme.defineTheme('robomakers', {
  base: Blockly.Themes.Classic,
  fontStyle: { family: "'Pretendard','Apple SD Gothic Neo','Malgun Gothic','Noto Sans KR',sans-serif", weight: '600', size: 12 },
  componentStyles: {
    workspaceBackgroundColour: '#F7F9FC',
    toolboxBackgroundColour: '#FFFFFF',
    toolboxForegroundColour: '#33415C',
    flyoutBackgroundColour: '#EEF2F8',
    flyoutOpacity: 0.97,
    scrollbarColour: '#C9D3E3',
    insertionMarkerColour: '#000',
  },
  categoryStyles: {
    logic_category: { colour: '#59C059' },
    loop_category: { colour: '#FFAB19' },
    math_category: { colour: '#59C059' },
    text_category: { colour: '#59C059' },
    variable_category: { colour: '#FF8C1A' },
    procedure_category: { colour: '#FF6680' },
  },
  blockStyles: {
    logic_blocks: { colourPrimary: '#59C059' },
    loop_blocks: { colourPrimary: '#FFAB19' },
    math_blocks: { colourPrimary: '#59C059' },
    text_blocks: { colourPrimary: '#59C059' },
    variable_blocks: { colourPrimary: '#FF8C1A' },
    procedure_blocks: { colourPrimary: '#FF6680' },
  },
});

const workspace = Blockly.inject('blocklyDiv', {
  toolbox: buildToolbox(getHubKey()),
  renderer: 'zelos',
  theme,
  trashcan: true,
  zoom: { controls: true, wheel: true, startScale: 0.8, maxScale: 2, minScale: 0.4 },
  grid: { spacing: 28, length: 2, colour: '#DDE3EE', snap: true },
  move: { scrollbars: true, drag: true, wheel: false },
});

// ───────────────────────── 파이썬 보기 ─────────────────────────
const codeView = $('#codeView');
const codeEdit = $('#codeEdit');
const editToggle = $('#editToggle');
let currentCode = '';

function highlight(code) {
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return code
    .split('\n')
    .map((line) => {
      const ci = line.indexOf('#');
      let body = line, comment = '';
      if (ci >= 0 && !/["']/.test(line.slice(0, ci))) {
        body = line.slice(0, ci);
        comment = line.slice(ci);
      }
      body = esc(body)
        .replace(/(&quot;|"[^"]*"|'[^']*')/g, '<span class="s">$1</span>')
        .replace(/\b(from|import|while|if|elif|else|for|in|def|return|global|not|and|or|True|False|None|pass|break|continue|raise|range)\b/g, '<span class="k">$1</span>')
        .replace(/\b(\d+(\.\d+)?)\b/g, '<span class="n">$1</span>');
      return body + (comment ? `<span class="c">${esc(comment)}</span>` : '');
    })
    .join('\n');
}

function refreshCode() {
  try {
    currentCode = generatePython(workspace).code;
  } catch (e) {
    console.error(e);
    currentCode = '# 코드 생성 오류: ' + e.message;
  }
  codeView.innerHTML = highlight(currentCode);
  if (!editToggle.checked) codeEdit.value = currentCode;
}

editToggle.addEventListener('change', () => {
  const on = editToggle.checked;
  codeView.hidden = on;
  codeEdit.hidden = !on;
  $('#editNote').hidden = !on;
  if (!on) refreshCode();
  else codeEdit.value = currentCode;
});

// ───────────────────────── 저장 / 불러오기 ─────────────────────────
function save() {
  try {
    localStorage.setItem(STORE, JSON.stringify({ hub: getHubKey(), ws: Blockly.serialization.workspaces.save(workspace) }));
  } catch (e) {
    /* 저장 공간 없음 */
  }
}

function load(state) {
  workspace.clear();
  Blockly.serialization.workspaces.load(state, workspace);
  refreshCode();
}

function selectHub(key, keepBlocks = true) {
  setHubKey(key);
  $('#hubSelect').value = key;
  workspace.updateToolbox(buildToolbox(key));
  const h = HUBS[key];
  const tSel = $('#transportSelect');
  tSel.innerHTML = h.transport
    .map((t) => `<option value="${t}">${t === 'ble' ? '블루투스' : key === 'prime' ? 'USB (실험적)' : 'USB'}</option>`)
    .join('');
  tSel.disabled = h.transport.length < 2;
  if (!keepBlocks) load(emptyProgram());
  refreshCode();
  renderExamples();
}

workspace.addChangeListener((e) => {
  if (e.isUiEvent) return;
  refreshCode();
  save();
});

$('#hubSelect').addEventListener('change', (e) => {
  if (hubConn.connected) hubConn.disconnect();
  selectHub(e.target.value);
  save();
});

$('#btnNew').addEventListener('click', () => {
  if (confirm('새 프로그램을 만들까요? 지금 블록은 지워집니다.')) load(emptyProgram());
});
$('#btnSave').addEventListener('click', () => {
  const data = JSON.stringify({ app: 'robomakers-wordblock', version: 1, hub: getHubKey(), ws: Blockly.serialization.workspaces.save(workspace) }, null, 1);
  download(new Blob([data], { type: 'application/json' }), `${$('#projectName').value || '내프로젝트'}.rmb.json`);
});
$('#btnOpen').addEventListener('click', () => $('#fileInput').click());
$('#fileInput').addEventListener('change', async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  try {
    const data = JSON.parse(await f.text());
    if (data.hub) selectHub(data.hub);
    load(data.ws);
    $('#projectName').value = f.name.replace(/\.rmb\.json$|\.json$/, '');
  } catch (err) {
    alert('파일을 열 수 없습니다: ' + err.message);
  }
  e.target.value = '';
});
$('#btnExportPy').addEventListener('click', () => {
  download(new Blob([editToggle.checked ? codeEdit.value : currentCode], { type: 'text/x-python' }), `${$('#projectName').value || 'main'}.py`);
});
$('#btnCopyPy').addEventListener('click', async () => {
  await navigator.clipboard.writeText(editToggle.checked ? codeEdit.value : currentCode);
  toast('파이썬 코드를 복사했습니다');
});

function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// 예제
function renderExamples() {
  const menu = $('#exampleMenu');
  menu.innerHTML = '';
  for (const [k, ex] of Object.entries(EXAMPLES)) {
    if (!ex.hubs.includes(getHubKey())) continue;
    const b = document.createElement('button');
    b.textContent = ex.title;
    b.onclick = () => {
      menu.hidden = true;
      load(ex.build(hub()));
    };
    menu.appendChild(b);
  }
}
$('#btnExamples').addEventListener('click', (e) => {
  e.stopPropagation();
  $('#exampleMenu').hidden = !$('#exampleMenu').hidden;
});
document.addEventListener('click', () => ($('#exampleMenu').hidden = true));

// ───────────────────────── 터미널 / 알림 ─────────────────────────
const term = $('#terminal');
function termWrite(text, cls) {
  const span = document.createElement('span');
  if (cls) span.className = cls;
  span.textContent = text;
  term.appendChild(span);
  while (term.childNodes.length > 800) term.removeChild(term.firstChild);
  term.scrollTop = term.scrollHeight;
}
$('#btnClearTerm').addEventListener('click', () => (term.textContent = ''));

let toastTimer;
function toast(msg, kind = '') {
  const t = $('#toast');
  t.textContent = msg;
  t.className = 'show ' + kind;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.className = ''), 3500);
}

// ───────────────────────── 허브 연결 / 실행 ─────────────────────────
const hubConn = new PybricksHub();
const libCache = {};
async function loadLib(name) {
  if (name in libCache) return libCache[name];
  if (!/^(rm_\w+|pupremote_hub|bluepad)$/.test(name)) return (libCache[name] = null);
  const r = await fetch(new URL(`../hublib/${name}.py`, import.meta.url));
  libCache[name] = r.ok ? await r.text() : null;
  return libCache[name];
}

function setConnUi() {
  const c = hubConn.connected;
  $('#btnConnect').textContent = c ? '연결 끊기' : '허브 연결';
  $('#btnConnect').classList.toggle('connected', c);
  $('#btnRun').disabled = !c;
  $('#btnStop').disabled = !c;
  $('#hubStatus').className = 'dot ' + (c ? (hubConn.running ? 'running' : 'on') : '');
  $('#hubName').textContent = c ? `${hubConn.info.name}` : '연결 안 됨';
  $('#hubName').title = c ? `펌웨어 ${hubConn.info.firmware || '?'} · 프로파일 ${hubConn.info.profile}` : '';
}

$('#btnConnect').addEventListener('click', async () => {
  if (hubConn.connected) {
    await hubConn.disconnect();
    setConnUi();
    return;
  }
  const kind = $('#transportSelect').value || hub().transport[0];
  try {
    const info = await hubConn.connect(kind);
    termWrite(`✔ ${info.name} 연결 (펌웨어 ${info.firmware || '?'}, 프로파일 ${info.profile})\n`, 'sys');
    toast(`${info.name} 에 연결했습니다`, 'ok');
  } catch (e) {
    if (e.name !== 'NotFoundError') {
      termWrite('✖ 연결 실패: ' + e.message + '\n', 'err');
      toast('연결 실패: ' + e.message, 'err');
    }
  }
  setConnUi();
});

hubConn.addEventListener('disconnect', () => {
  termWrite('— 허브 연결이 끊어졌습니다\n', 'sys');
  setConnUi();
});
hubConn.addEventListener('status', (e) => {
  setConnUi();
  $('#btnRun').classList.toggle('running', e.detail.running);
});
let stdoutLine = '';
hubConn.addEventListener('stdout', (e) => {
  termWrite(e.detail, /Traceback|Error/.test(stdoutLine + e.detail) ? 'err' : '');
  stdoutLine = e.detail.split('\n').pop();
});

async function run() {
  const src = editToggle.checked ? codeEdit.value : currentCode;
  if (!editToggle.checked && !generatePython(workspace).hasStart) {
    toast('"▶ 프로그램 시작할 때" 블록이 필요합니다', 'err');
    return;
  }
  const bar = $('#progress');
  try {
    $('#btnRun').disabled = true;
    termWrite('\n▶ 컴파일 중…\n', 'sys');
    const prog = await buildProgram(src, loadLib);
    termWrite(`  ${prog.data.length} 바이트 (${prog.modules.join(', ')}) 내려받는 중…\n`, 'sys');
    bar.hidden = false;
    await hubConn.downloadAndRun(prog.data, (p) => (bar.value = p));
    termWrite('▶ 실행\n', 'sys');
  } catch (e) {
    if (e instanceof CompileError) {
      termWrite(`✖ 파이썬 오류 (${e.module === '__main__' ? '내 프로그램' : e.module})\n${e.message}\n`, 'err');
      toast('프로그램에 오류가 있습니다 (터미널 확인)', 'err');
    } else {
      termWrite('✖ ' + e.message + '\n', 'err');
      toast(e.message, 'err');
    }
  } finally {
    bar.hidden = true;
    bar.value = 0;
    setConnUi();
  }
}
$('#btnRun').addEventListener('click', run);
$('#btnStop').addEventListener('click', () => hubConn.stop().catch((e) => toast(e.message, 'err')));
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && hubConn.connected) run();
});

// ───────────────────────── 오른쪽 패널 탭 ─────────────────────────
document.querySelectorAll('.tab').forEach((t) =>
  t.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((x) => x.classList.toggle('active', x === t));
    document.querySelectorAll('.pane').forEach((p) => (p.hidden = p.id !== t.dataset.pane));
    if (t.dataset.pane === 'panePython') refreshCode();
    Blockly.svgResize(workspace);
  }),
);
$('#btnPanel').addEventListener('click', () => {
  document.body.classList.toggle('panel-closed');
  setTimeout(() => Blockly.svgResize(workspace), 220);
});

// ───────────────────────── AI 카메라 ─────────────────────────
const cam = new AICamera($('#camVideo'), $('#camCanvas'));
const camBtn = $('#btnCam');
cam.onUpdate = () => {
  const [hd, g, x, y, f] = cam.hand;
  const [pd, nx, ny, lu, ru, bx, tilt, sp] = cam.body;
  $('#camHand').innerHTML = hd
    ? `<b>${GESTURE_KO[g]}</b> · X ${x} · Y ${y} · 손가락 ${f}`
    : cam.mode === 'pose' ? '—' : '손이 안 보여요';
  $('#camPose').innerHTML = pd
    ? `몸 X ${bx} · 코 ${nx},${ny} · 기울기 ${tilt}° ${lu ? '· 왼손↑' : ''} ${ru ? '· 오른손↑' : ''} ${sp ? '· 양팔 벌림' : ''}`
    : cam.mode === 'hand' ? '—' : '사람이 안 보여요';
};
camBtn.addEventListener('click', async () => {
  if (cam.running) {
    cam.stop();
    camBtn.textContent = '카메라 켜기';
    $('#camHint').hidden = false;
    return;
  }
  camBtn.disabled = true;
  camBtn.textContent = 'AI 모델 불러오는 중…';
  try {
    await cam.start($('#camMode').value);
    camBtn.textContent = '카메라 끄기';
    $('#camHint').hidden = true;
  } catch (e) {
    toast('카메라를 시작할 수 없습니다: ' + e.message, 'err');
    camBtn.textContent = '카메라 켜기';
  }
  camBtn.disabled = false;
});
$('#camMode').addEventListener('change', (e) => cam.setMode(e.target.value));

// ───────────────────────── 게임패드 ─────────────────────────
const gpad = new WebGamepad();
const BTN_NAMES = ['A✕', 'B○', 'X□', 'Y△', 'LB', 'RB', 'VIEW', 'MENU', 'LJ', 'RJ', '↑', '↓', '←', '→', 'HOME'];
function renderPad() {
  const s = gpad.poll();
  const el = $('#padState');
  if (!s) {
    el.innerHTML = '<p class="muted">조종기를 USB 또는 블루투스로 이 컴퓨터에 연결하고 아무 버튼이나 누르세요.</p>';
    $('#padName').textContent = '조종기 없음';
    return;
  }
  $('#padName').textContent = s.id.replace(/\(.*?Vendor.*?\)/, '').trim();
  const [lx, ly, rx, ry, lt, rt, bits] = s.values;
  const stick = (x, y) => `<div class="stick"><i style="left:${50 + x / 2.4}%;top:${50 - y / 2.4}%"></i></div>`;
  el.innerHTML = `
    <div class="sticks">${stick(lx, ly)}${stick(rx, ry)}</div>
    <div class="nums">왼쪽 ${lx}, ${ly} · 오른쪽 ${rx}, ${ry} · LT ${lt} · RT ${rt}</div>
    <div class="btns">${BTN_NAMES.map((n, i) => `<span class="${bits & (1 << i) ? 'on' : ''}">${n}</span>`).join('')}</div>`;
}

// ───────────────────────── 허브로 데이터 보내기 (stdin) ─────────────────────────
// 타이머(80ms)와 AI 카메라 결과가 나올 때마다 보냅니다. 느린 PC 에서 AI 계산이
// 타이머를 막아도 새 결과는 바로 허브로 갑니다.
let sending = false;
let lastSend = 0;
async function pumpSend() {
  if (!hubConn.connected || !hubConn.running || sending) return;
  if (performance.now() - lastSend < 60) return;
  let frame = '';
  if (cam.running) frame += cam.frame();
  if ($('#padRelay').checked) frame += gpad.frame();
  if (!frame) return;
  sending = true;
  lastSend = performance.now();
  try {
    await hubConn.writeStdin(frame);
  } catch (e) {
    /* 다음 주기에 다시 */
  }
  sending = false;
}
setInterval(() => {
  if (!$('#panePad').hidden) renderPad();
  pumpSend();
}, 80);
const camUpdateUi = cam.onUpdate;
cam.onUpdate = (c) => {
  camUpdateUi(c);
  pumpSend();
};

// ───────────────────────── 시작 ─────────────────────────
if (!('bluetooth' in navigator) && !('usb' in navigator)) {
  $('#browserWarn').hidden = false;
}
let saved = null;
try {
  saved = JSON.parse(localStorage.getItem(STORE) || 'null');
} catch (e) {
  saved = null;
}
selectHub(saved?.hub || 'prime');
try {
  load(saved?.ws || emptyProgram());
} catch (e) {
  load(emptyProgram());
}
setConnUi();
window.addEventListener('resize', () => Blockly.svgResize(workspace));

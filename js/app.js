// app.js — 로보메이커스 워드블럭 웹 에디터 메인
/* global Blockly */

import { HUBS, getHubKey, setHubKey, hub } from './hubs.js?v=0.3.3';
import { generatePython, teachNames } from './blocks.js?v=0.3.3';
import { buildToolbox } from './toolbox.js?v=0.3.3';
import { PybricksHub, buildProgram, collectSources, CompileError } from './pybricks.js?v=0.3.3';
import { makeZip } from './zip.js?v=0.3.3';
import { initHelp } from './help.js?v=0.3.3';
import { AICamera, COCO, COLOR_IDS, COLOR_CSS, TEACH_CLASSES, COLOR_SLOTS } from './aicam.js?v=0.3.3';
import { LANGS, getLang, setLang, t, applyDom, cocoLabel } from './i18n.js?v=0.3.3';
import { WebGamepad } from './gamepad.js?v=0.3.3';
import { EXAMPLES, emptyProgram } from './examples.js?v=0.3.3';
import { HuskyMonitor } from './huskymon.js?v=0.3.3';

const $ = (s) => document.querySelector(s);
applyDom();
const projectName = () => ($('#projectName').value || t('top.projectDefault')).replace(/[\\/:*?"<>|]/g, '_');
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
    currentCode = '# ' + e.message;
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
    .map((tr) => `<option value="${tr}">${tr === 'ble' ? t('transport.ble') : t('transport.usb')}</option>`)
    .join('');
  tSel.disabled = h.transport.length < 2;
  if (!keepBlocks) load(emptyProgram());
  refreshCode();
  renderExamples();
  if (typeof initHuskyPane === 'function') initHuskyPane();
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
  $('#fileMenu').hidden = true;
  if (confirm(t('msg.confirmNew'))) load(emptyProgram());
});
$('#btnSave').addEventListener('click', () => {
  const data = JSON.stringify({ app: 'robomakers-wordblock', version: 1, hub: getHubKey(), ws: Blockly.serialization.workspaces.save(workspace) }, null, 1);
  download(new Blob([data], { type: 'application/json' }), `${projectName()}.rmb.json`);
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
    alert(t('msg.openFail', err.message));
  }
  e.target.value = '';
});
// ── 다운로드 메뉴 ──
const pyNow = () => (editToggle.checked ? codeEdit.value : currentCode);
const downloads = {
  py: () => download(new Blob([pyNow()], { type: 'text/x-python' }), `${projectName()}.py`),
  zip: async () => {
    const mods = await collectSources(pyNow(), loadLib);
    const files = mods.map(([name, src]) => ({ name: `${projectName()}/${name === '__main__' ? 'main' : name}.py`, data: src }));
    files.push({ name: `${projectName()}/README.txt`, data: t('dl.readme') + '\n' });
    download(makeZip(files), `${projectName()}.zip`);
  },
  esp32: async () => {
    const { esp32Files } = await import('./esp32gen.js?v=0.3.3');
    download(makeZip(await esp32Files(pyNow(), `${projectName()}-esp32`)), `${projectName()}-esp32.zip`);
  },
  project: () => $('#btnSave').click(),
};
$('#downloadMenu').addEventListener('click', (e) => {
  const item = e.target.closest('[data-dl]');
  if (!item) return;
  $('#downloadMenu').hidden = true;
  downloads[item.dataset.dl]();
});

// ── 언어 선택 (바꾸면 블록을 저장한 뒤 새로 불러옵니다) ──
const langSel = $('#langSelect');
langSel.innerHTML = LANGS.map((l) => `<option value="${l.code}">${l.name}</option>`).join('');
langSel.value = getLang();
langSel.addEventListener('change', () => {
  save();
  setLang(langSel.value);
  const u = new URL(location.href);
  u.searchParams.delete('lang');
  location.href = u.href;
});

$('#btnExportPy').addEventListener('click', () => {
  downloads.py();
});
$('#btnCopyPy').addEventListener('click', async () => {
  await navigator.clipboard.writeText(editToggle.checked ? codeEdit.value : currentCode);
  toast(t('msg.copied'));
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
    b.textContent = ex.title();
    b.onclick = () => {
      menu.hidden = true;
      load(ex.build(hub()));
    };
    menu.appendChild(b);
  }
}
// 위쪽 드롭다운 메뉴 (예제 / 파일 / 다운로드): 버튼을 누르면 열고, 다른 곳을 누르면 닫습니다.
const menus = [...document.querySelectorAll('.menuwrap')];
menus.forEach((w) =>
  w.querySelector(':scope > button').addEventListener('click', (e) => {
    e.stopPropagation();
    const m = w.querySelector('.menu');
    const open = m.hidden;
    menus.forEach((x) => (x.querySelector('.menu').hidden = true));
    m.hidden = !open;
  }),
);
document.addEventListener('click', () => menus.forEach((x) => (x.querySelector('.menu').hidden = true)));

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
  const r = await fetch(new URL(`../hublib/${name}.py?v=0.3.3`, import.meta.url));
  libCache[name] = r.ok ? await r.text() : null;
  return libCache[name];
}

function setConnUi() {
  const c = hubConn.connected;
  $('#btnConnect').textContent = c ? t('top.disconnect') : t('top.connect');
  $('#btnConnect').classList.toggle('connected', c);
  $('#btnRun').disabled = !c;
  $('#btnUpload').disabled = !c;
  $('#btnStop').disabled = !c;
  $('#btnUpload').title = t('top.uploadTitle') + (c && hubConn.slotCount > 1 ? ' — ' + t('msg.slot', hubConn.selectedSlot + 1) : '');
  $('#hubStatus').className = 'dot ' + (c ? (hubConn.running ? 'running' : 'on') : '');
  $('#hubName').textContent = c ? `${hubConn.info.name}` : t('top.notConnected');
  $('#hubName').title = c ? t('msg.fwInfo', hubConn.info.firmware || '?', hubConn.info.profile) : '';
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
    termWrite(t('msg.connected', info.name, info.firmware || '?', info.profile) + '\n', 'sys');
    toast(t('msg.connectedToast', info.name), 'ok');
  } catch (e) {
    if (e.name !== 'NotFoundError') {
      termWrite('✖ ' + t('msg.connectFail', e.message) + '\n', 'err');
      toast(t('msg.connectFail', e.message), 'err');
    }
  }
  setConnUi();
});

hubConn.addEventListener('disconnect', () => {
  termWrite(t('msg.disconnected') + '\n', 'sys');
  setConnUi();
});
let wasRunning = false;
hubConn.addEventListener('status', (e) => {
  if (e.detail.running && !wasRunning) { runOut = ''; hinted = false; }
  if (!e.detail.running && wasRunning) setTimeout(errorHint, 300);
  wasRunning = e.detail.running;
  setConnUi();
  $('#btnRun').classList.toggle('running', e.detail.running);
});
let stdoutLine = '';
let runOut = '';
let hinted = false;
let stdoutHold = '';
hubConn.addEventListener('stdout', (e) => {
  // 허스키렌즈 모니터 줄(@HK:...)은 터미널에 쓰지 않고 모니터로 보냅니다.
  let text = stdoutHold + e.detail;
  stdoutHold = '';
  const lines = text.split('\n');
  let tail = lines.pop();
  if (tail.startsWith('@')) {
    stdoutHold = tail;
    tail = '';
  }
  let out = lines.filter((l) => !huskyMon.line(l.replace(/\r$/, ''))).map((l) => l + '\n').join('') + tail;
  if (!out) return;
  termWrite(out, /Traceback|Error/.test(stdoutLine + out) ? 'err' : '');
  stdoutLine = out.split('\n').pop();
  runOut = (runOut + out).slice(-4000);
});
/** 프로그램이 멈춘 뒤, 자주 나는 오류에 도움말을 붙입니다. */
function errorHint() {
  if (hinted) return;
  const port = (runOut.match(/Port\.([A-F])/) || [])[1] || '?';
  const tb = runOut.slice(runOut.lastIndexOf('Traceback'));
  let key = '';
  if (/ENODEV/.test(tb)) key = /bluepad|rm_pad/.test(tb) ? 'hint.bluepad' : /rm_esp32|pupremote_hub/.test(tb) ? 'hint.esp32' : /rm_husky/.test(tb) ? 'hint.husky' : '';
  else if (/AssertionError/.test(tb) && /pupremote_hub/.test(tb)) key = 'hint.esp32mode';
  if (!key) return;
  hinted = true;
  termWrite('\n' + t(key, port) + '\n', 'sys');
}

/**
 * 컴파일해서 허브로 보냅니다.
 * @param {boolean} andRun true = 내려받고 실행, false = 허브에 저장만 (허브 버튼으로 실행)
 */
async function sendToHub(andRun, override) {
  const src = override || (editToggle.checked ? codeEdit.value : currentCode);
  if (!override && !editToggle.checked && !generatePython(workspace).hasStart) {
    toast(t('msg.needStart'), 'err');
    return;
  }
  const bar = $('#progress');
  try {
    $('#btnRun').disabled = true;
    $('#btnUpload').disabled = true;
    termWrite('\n' + t('msg.compiling') + '\n', 'sys');
    const prog = await buildProgram(src, loadLib);
    termWrite(t('msg.downloading', prog.data.length, prog.modules.join(', ')) + '\n', 'sys');
    bar.hidden = false;
    if (andRun) {
      await hubConn.downloadAndRun(prog.data, (p) => (bar.value = p));
      termWrite(t('msg.running') + '\n', 'sys');
    } else {
      await hubConn.download(prog.data, (p) => (bar.value = p));
      const slot = hubConn.slotCount > 1 ? ' (' + t('msg.slot', hubConn.selectedSlot + 1) + ')' : '';
      termWrite(t('msg.uploaded', slot) + '\n' + t('msg.uploadedHow.' + getHubKey()) + '\n', 'sys');
      toast(t('msg.uploaded', slot), 'ok');
    }
  } catch (e) {
    if (e instanceof CompileError) {
      termWrite(t('msg.pyError', e.module === '__main__' ? t('msg.myProgram') : e.module) + `\n${e.message}\n`, 'err');
      toast(t('msg.pyErrorToast'), 'err');
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
// ───────────────────────── 허스키렌즈 모니터 ─────────────────────────
const huskyMon = new HuskyMonitor($('#huskyCanvas'), $('#huskyReadout'), $('#huskyHint'));
function initHuskyPane() {
  const h = hub();
  $('#tabHusky').hidden = !h.lpf2;
  if (!h.lpf2 && !$('#paneHusky').hidden) document.querySelector('.tab[data-pane="panePython"]').click();
  const sel = $('#huskyPort');
  const ports = h.sensorPorts || [];
  const used = (currentCode.match(/\bhusky_([A-F])\b/) || [])[1];
  const keep = sel.value || used || localStorage.getItem('rm-husky-port') || (ports.includes('C') ? 'C' : ports[0]);
  sel.innerHTML = ports.map((p) => `<option>${p}</option>`).join('');
  sel.value = ports.includes(keep) ? keep : ports[0];
}
$('#huskyPort').addEventListener('change', (e) => localStorage.setItem('rm-husky-port', e.target.value));
$('#huskyKind').value = localStorage.getItem('rm-husky-kind') || 'block';
huskyMon.setKind($('#huskyKind').value);
$('#huskyKind').addEventListener('change', (e) => {
  localStorage.setItem('rm-husky-kind', e.target.value);
  huskyMon.setKind(e.target.value);
});
/** 허스키렌즈 값을 계속 보내는 작은 프로그램 */
function huskyMonitorProgram(p) {
  return [
    '# HuskyLens monitor (RoboMakers WordBlock)',
    'from pybricks.parameters import Port',
    'from pybricks.tools import wait',
    'from rm_husky import HuskyLens',
    '',
    `lens = HuskyLens(Port.${p}, interval=0)`,
    `print("HuskyLens monitor: Port.${p}")`,
    'while True:',
    '    lens.update()',
    '    lens.monitor(True)',
    '    wait(40)',
    '',
  ].join('\n');
}
$('#btnHuskyRun').addEventListener('click', async () => {
  if (!hubConn.connected) return toast(t('husky.needConn'), 'err');
  if (hubConn.running) {
    await hubConn.stop().catch(() => {});
    await new Promise((r) => setTimeout(r, 400));
  }
  sendToHub(true, huskyMonitorProgram($('#huskyPort').value));
});

const run = () => sendToHub(true);
$('#btnRun').addEventListener('click', run);
$('#btnUpload').addEventListener('click', () => sendToHub(false));
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
const CAM_MODES_KEY = 'rm-cam-modes';
const NAMES_KEY = 'rm-teach-names';
cam.labelOf = (name) => cocoLabel(COCO.indexOf(name));
const teachName = (i) => teachNames()[i] || t('teach.class', i + 1);
cam.teachNames = teachName;

function camModes() {
  return [...document.querySelectorAll('#camModes input:checked')].map((x) => x.value);
}
try {
  const saved = JSON.parse(localStorage.getItem(CAM_MODES_KEY) || 'null');
  if (saved) document.querySelectorAll('#camModes input').forEach((x) => (x.checked = saved.includes(x.value)));
} catch (e) {
  /* 무시 */
}
function showPanels() {
  const m = camModes();
  $('#teachPanel').hidden = !m.includes('teach');
  $('#colorPanel').hidden = !m.includes('color');
}

// 읽은 값 표시
function readoutRow(label, html) {
  return `<div><small>${label}</small><span>${html}</span></div>`;
}
cam.onUpdate = () => {
  const m = new Set(camModes());
  const rows = [];
  if (m.has('hand')) {
    const [hd, g, x, y, f] = cam.hand;
    rows.push(readoutRow(t('cam.hand'), hd ? `<b>${t('g.' + g)}</b> · X ${x} · Y ${y} · ${t('cam.fingers')} ${f}` : t('cam.noHand')));
  }
  if (m.has('pose')) {
    const [pd, nx, ny, lu, ru, bx, tilt, sp] = cam.body;
    rows.push(readoutRow(t('cam.pose'), pd
      ? `${t('cam.bodyX')} ${bx} · ${t('cam.nose')} ${nx},${ny} · ${t('cam.tilt')} ${tilt}° ${lu ? '· ' + t('cam.leftUp') : ''} ${ru ? '· ' + t('cam.rightUp') : ''} ${sp ? '· ' + t('cam.spread') : ''}`
      : t('cam.noPerson')));
  }
  if (m.has('object')) {
    rows.push(readoutRow(t('cam.object'), cam.objects.length
      ? cam.objects.map((o) => `<b>${cam.labelOf(o.name)}</b> ${o.score}% (X ${o.x}, Y ${o.y})`).join(' · ')
      : t('cam.noObject')));
  }
  if (m.has('teach')) {
    rows.push(readoutRow(t('cam.teach'), cam.taught.id
      ? `<b>${teachName(cam.taught.id - 1)}</b> · ${t('cam.conf')} ${cam.taught.conf}%`
      : t('cam.notTrained')));
  }
  if (m.has('color')) {
    const c = cam.center;
    const seen = cam.blobs.map((b, i) => (b.seen ? `#${i + 1} (X ${b.x}, Y ${b.y}, ${b.size}%)` : '')).filter(Boolean).join(' · ');
    rows.push(readoutRow(t('cam.color'), `<i class="dot" style="background:${COLOR_CSS[c.id]};border:1px solid #ccd"></i> <b>${t('o.color.' + COLOR_IDS[c.id])}</b> · RGB ${c.r},${c.g},${c.b}`));
    rows.push(readoutRow(t('cam.lcolor'), seen || '—'));
  }
  $('#camReadout').innerHTML = rows.join('');
  if (cam.running) refreshLearnCounts();
};

// 사물 학습 패널
function renderTeach() {
  const names = teachNames();
  $('#teachRows').innerHTML = Array.from({ length: TEACH_CLASSES }, (_, i) => `
    <div class="lrow" data-i="${i}">
      <span class="num">${i + 1}</span>
      <div><input type="text" value="${(names[i] || t('teach.class', i + 1)).replace(/"/g, '&quot;')}" maxlength="20"><div class="bar"><i style="width:0%"></i></div></div>
      <span class="cnt"></span>
      <button class="rec" type="button">${t('teach.hold')}</button>
      <button class="del" type="button" title="${t('teach.clear')}">🗑</button>
    </div>`).join('');
  refreshLearnCounts();
}
function refreshLearnCounts() {
  document.querySelectorAll('#teachRows .lrow').forEach((row) => {
    const i = +row.dataset.i;
    row.querySelector('.cnt').textContent = t('teach.samples', cam.teach[i].length);
    row.classList.toggle('active', cam.taught.id === i + 1);
    row.querySelector('.bar i').style.width = (cam.taught.id === i + 1 ? cam.taught.conf : 0) + '%';
  });
}
$('#teachRows').addEventListener('input', (e) => {
  const names = [...document.querySelectorAll('#teachRows input[type=text]')].map((x) => x.value.trim());
  try {
    localStorage.setItem(NAMES_KEY, JSON.stringify(names));
  } catch (err) {
    /* 무시 */
  }
});
const stopRec = () => {
  if (cam.recording < 0) return;
  cam.finishRecording();
  document.querySelectorAll('#teachRows .rec').forEach((b) => b.classList.remove('on'));
  refreshLearnCounts();
};
$('#teachRows').addEventListener('pointerdown', (e) => {
  const rec = e.target.closest('.rec');
  if (!rec) return;
  if (!cam.running || !cam.models.teach) {
    toast(t('teach.needCam'), 'err');
    return;
  }
  e.preventDefault();
  rec.setPointerCapture?.(e.pointerId);
  rec.classList.add('on');
  cam.recording = +rec.closest('.lrow').dataset.i;
});
['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) => $('#teachRows').addEventListener(ev, stopRec));
$('#teachRows').addEventListener('click', (e) => {
  const del = e.target.closest('.del');
  if (!del) return;
  cam.clearTeach(+del.closest('.lrow').dataset.i);
  refreshLearnCounts();
});
$('#btnTeachClear').addEventListener('click', () => {
  if (!confirm(t('teach.confirmClear'))) return;
  cam.clearTeach();
  refreshLearnCounts();
});
$('#btnTeachExport').addEventListener('click', () => {
  const names = [...document.querySelectorAll('#teachRows input[type=text]')].map((x) => x.value.trim());
  download(new Blob([JSON.stringify(cam.exportData(names))], { type: 'application/json' }), `${projectName()}-ai.json`);
});
$('#btnTeachImport').addEventListener('click', () => $('#teachFile').click());
$('#teachFile').addEventListener('change', async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  try {
    const names = cam.importData(JSON.parse(await f.text()));
    if (names) localStorage.setItem(NAMES_KEY, JSON.stringify(names));
    renderTeach();
    renderColors();
    toast(t('teach.imported'), 'ok');
  } catch (err) {
    toast(t('msg.openFail', err.message), 'err');
  }
  e.target.value = '';
});

// 색 학습 패널
function renderColors() {
  $('#colorRows').innerHTML = Array.from({ length: COLOR_SLOTS }, (_, i) => {
    const c = cam.colors[i];
    return `
    <div class="lrow" data-i="${i}">
      <span class="num">${i + 1}</span>
      <div class="sw ${c ? 'set' : ''}" style="${c ? `background:${c.rgb}` : ''}">${c ? t('color.slot', i + 1) : t('color.empty')}</div>
      <span class="cnt"></span>
      <button class="learnc rec" type="button">${t('color.learn')}</button>
      <button class="del" type="button" title="${t('color.clear')}">🗑</button>
    </div>`;
  }).join('');
}
$('#colorRows').addEventListener('click', (e) => {
  const row = e.target.closest('.lrow');
  if (!row) return;
  const i = +row.dataset.i;
  if (e.target.closest('.learnc')) {
    if (!cam.running) return toast(t('teach.needCam'), 'err');
    if (cam.learnCenterColor(i)) toast(t('color.learned', i + 1), 'ok');
  } else if (e.target.closest('.del')) {
    cam.clearColor(i);
  } else return;
  renderColors();
});

document.querySelectorAll('#camModes input').forEach((x) =>
  x.addEventListener('change', async () => {
    try {
      localStorage.setItem(CAM_MODES_KEY, JSON.stringify(camModes()));
    } catch (e) {
      /* 무시 */
    }
    showPanels();
    if (cam.running) {
      camBtn.disabled = true;
      const old = camBtn.textContent;
      camBtn.textContent = t('cam.loading');
      try {
        await cam.setModes(camModes());
      } catch (e) {
        toast(t('msg.camFail', e.message), 'err');
      }
      camBtn.textContent = old;
      camBtn.disabled = false;
    } else cam.modes = new Set(camModes());
    cam.onUpdate(cam);
  }),
);

camBtn.addEventListener('click', async () => {
  if (cam.running) {
    stopRec();
    cam.stop();
    camBtn.textContent = t('cam.on');
    $('#camHint').hidden = false;
    cam.onUpdate(cam);
    return;
  }
  camBtn.disabled = true;
  camBtn.textContent = t('cam.loading');
  try {
    await cam.setModes(camModes());
    await cam.start();
    camBtn.textContent = t('cam.off');
    $('#camHint').hidden = true;
  } catch (e) {
    toast(t('msg.camFail', e.message), 'err');
    camBtn.textContent = t('cam.on');
  }
  camBtn.disabled = false;
});
showPanels();
renderTeach();
renderColors();
cam.modes = new Set(camModes());
cam.onUpdate(cam);
// 문제 확인·시험용 (브라우저 콘솔에서 rmDebug.cam 등)
window.rmDebug = { cam, hub: hubConn, workspace };

// ───────────────────────── 게임패드 ─────────────────────────
const gpad = new WebGamepad();
const BTN_NAMES = ['A✕', 'B○', 'X□', 'Y△', 'LB', 'RB', 'VIEW', 'MENU', 'LJ', 'RJ', '↑', '↓', '←', '→', 'HOME'];
function renderPad() {
  const s = gpad.poll();
  const el = $('#padState');
  if (!s) {
    el.innerHTML = `<p class="muted">${t('pad.hint')}</p>`;
    $('#padName').textContent = t('pad.none');
    return;
  }
  $('#padName').textContent = s.id.replace(/\(.*?Vendor.*?\)/, '').trim();
  const [lx, ly, rx, ry, lt, rt, bits] = s.values;
  const stick = (x, y) => `<div class="stick"><i style="left:${50 + x / 2.4}%;top:${50 - y / 2.4}%"></i></div>`;
  el.innerHTML = `
    <div class="sticks">${stick(lx, ly)}${stick(rx, ry)}</div>
    <div class="nums">${t('pad.left')} ${lx}, ${ly} · ${t('pad.right')} ${rx}, ${ry} · LT ${lt} · RT ${rt}</div>
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
  if (!$('#paneHusky').hidden) frame += 'M:1\n';
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
  if (!$('#paneHusky').hidden && huskyMon.last) huskyMon.render();
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
initHelp({
  toast,
  code: () => (editToggle.checked ? codeEdit.value : currentCode),
  terminal: () => term.textContent,
  get hubInfo() {
    return hubConn.connected ? hubConn.info : null;
  },
});

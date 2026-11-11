// learn.js — 오른쪽 「배우기」 탭: 단계별 수업 화면
//
// 단계를 고르면 원리 설명 · 그림 · 바뀐 블록 · 해 보기를 보여 주고,
// 「이 단계 블록 불러오기」로 작업 공간을 그 단계 프로그램으로 바꾼 뒤 새로 생긴 블록을 노랗게 빛나게 합니다.

/* global Blockly */
import { t } from './i18n.js?v=0.3.18';
import { LESSONS, lessonWorkspace, newBlockIds } from './lessons.js?v=0.3.18';

const STORE = 'rm-learn';
const GLOW_MS = 10000;

// ───────────── 그림 (SVG) ─────────────
function chart(kind) {
  const W = 360, H = 170, L = 40, R = 12, T = 14, Bm = 30;
  const x = (u) => L + u * (W - L - R); // u: 0~1
  const y = (v) => T + (1 - v) * (H - T - Bm); // v: 0~1
  const axis = (xl, yl, mid = true) => `
    <line x1="${L}" y1="${y(0)}" x2="${W - R}" y2="${y(0)}" class="ax"/>
    <line x1="${L}" y1="${T}" x2="${L}" y2="${y(0)}" class="ax"/>
    ${mid ? `<line x1="${L}" y1="${y(0.5)}" x2="${W - R}" y2="${y(0.5)}" class="zero"/>` : ''}
    <text x="${W - R}" y="${H - 8}" text-anchor="end" class="lb">${xl}</text>
    <text x="${L - 6}" y="${T + 4}" text-anchor="end" class="lb">${yl}</text>`;
  const path = (f, n = 120) => Array.from({ length: n + 1 }, (_, i) => {
    const u = i / n;
    return `${i ? 'L' : 'M'}${x(u).toFixed(1)},${y(f(u)).toFixed(1)}`;
  }).join('');
  const legend = (items, top = T) => items.map(([c, label, dash], i) =>
    `<line x1="${W - 150}" y1="${top + 6 + i * 16}" x2="${W - 128}" y2="${top + 6 + i * 16}" stroke="${c}" stroke-width="3" ${dash ? 'stroke-dasharray="5 4"' : ''}/>` +
    `<text x="${W - 122}" y="${top + 10 + i * 16}" class="lg">${label}</text>`).join('');
  let body = '';
  if (kind === 'onoff' || kind === 'p') {
    // 가로: 반사값 0~100 (가운데 = 목표값 50), 세로: 조향 (왼쪽 − / 오른쪽 +)
    const f = kind === 'onoff' ? (u) => (u < 0.5 ? 0.2 : 0.8) : (u) => 0.5 + (u - 0.5) * 0.9;
    body = axis(t('learn.chart.refl'), t('learn.chart.steer')) +
      `<line x1="${x(0.5)}" y1="${T}" x2="${x(0.5)}" y2="${y(0)}" class="zero"/>
       <text x="${x(0.5)}" y="${H - 8}" text-anchor="middle" class="lb">${t('learn.chart.target')}</text>
       <text x="${x(0.04)}" y="${y(0.04)}" class="lb">${t('learn.chart.black')}</text>
       <text x="${x(0.96)}" y="${y(0.04)}" text-anchor="end" class="lb">${t('learn.chart.white')}</text>
       <text x="${L + 4}" y="${y(0.5) - 5}" class="lg">${t('learn.chart.right')}</text>
       <text x="${L + 4}" y="${y(0.5) + 13}" class="lg">${t('learn.chart.left')}</text>
       <path d="${path(f, kind === 'onoff' ? 400 : 40)}" class="ln a"/>`;
  } else if (kind === 'yaw') {
    // 위에서 본 로봇 방향: 0° 위, 시계 방향 +
    const cx = 120, cy = 86, r = 62;
    const pt = (deg, rr = r) => [cx + rr * Math.sin(deg * Math.PI / 180), cy - rr * Math.cos(deg * Math.PI / 180)];
    const ticks = [0, 90, 180, 270].map((d) => {
      const [x1, y1] = pt(d, r + 14);
      return `<text x="${x1}" y="${y1 + 4}" text-anchor="middle" class="lg">${d === 270 ? '−90' : d === 180 ? '±180' : d}</text>`;
    }).join('');
    const [ax, ay] = pt(60, r - 4);
    body = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#C9D1DD" stroke-width="2"/>${ticks}
      <path d="M${pt(0, r - 4).join(',')} A${r - 4},${r - 4} 0 0 1 ${ax},${ay}" fill="none" stroke="#2E6ABF" stroke-width="4"/>
      <polygon points="${ax},${ay} ${ax - 12},${ay - 3} ${ax - 4},${ay - 13}" fill="#2E6ABF"/>
      <rect x="${cx - 14}" y="${cy - 18}" width="28" height="36" rx="5" fill="#FFC400"/><polygon points="${cx},${cy - 30} ${cx - 8},${cy - 18} ${cx + 8},${cy - 18}" fill="#FFC400"/>
      <text x="${cx + 110}" y="${cy - 30}" class="lg">${t('learn.chart.cw')}</text>
      <text x="${cx + 110}" y="${cy - 10}" class="lb">360 → 720 → …</text>
      <text x="${cx + 110}" y="${cy + 10}" class="lb">${t('learn.chart.keep')}</text>`;
  } else if (kind === 'drift') {
    // 위에서 본 길: 목표(점선) vs 바퀴만(조금씩 휨)
    body = `<line x1="${x(0)}" y1="${y(0.5)}" x2="${x(1)}" y2="${y(0.5)}" stroke="#9AA6BA" stroke-width="3" stroke-dasharray="6 5"/>
      <path d="${path((u) => 0.5 + 0.28 * u * u)}" class="ln a"/>
      <text x="${x(1)}" y="${y(0.5) + 18}" text-anchor="end" class="lb">${t('learn.chart.goal')}</text>
      <text x="${x(0.86)}" y="${y(0.78) - 6}" text-anchor="end" class="lg">${t('learn.chart.wheels')}</text>
      <rect x="${x(0) - 10}" y="${y(0.5) - 9}" width="20" height="18" rx="4" fill="#FFC400"/>`;
  } else if (kind === 'trap') {
    // 가로: 간 거리, 세로: 속도 — 사다리꼴 (점선: 감속을 최고 속도에서 시작해 튀는 잘못된 계획)
    const tr = (u) => Math.min(0.15 + 3 * u, 0.85, 0.15 + 3 * (1 - u));
    body = axis(t('learn.chart.dist'), t('learn.chart.speed'), false) +
      `<path d="${path((u) => (u < 0.62 ? Math.min(0.15 + 0.9 * u, 0.85) : 0.15 + 0.7 * (1 - u) / 0.38))}" class="ln b" stroke-dasharray="5 4"/>
       <path d="${path(tr)}" class="ln a"/>` + legend([['#9AA6BA', t('learn.chart.jump'), true], ['#2E6ABF', t('learn.chart.trap')]], y(0.42));
  } else if (kind === 'turn') {
    // 가로: 시간, 세로: 방향 — 목표 90° 에 가까울수록 천천히, 판정 띠 안에 들면 멈춤
    const f = (u) => 0.08 + 0.74 * (1 - Math.exp(-u * 5));
    body = axis(t('learn.chart.time'), t('learn.chart.heading'), false) +
      `<rect x="${x(0)}" y="${y(0.84)}" width="${x(1) - x(0)}" height="${y(0.8) - y(0.84)}" fill="#FFE8A3"/>
       <line x1="${x(0)}" y1="${y(0.82)}" x2="${x(1)}" y2="${y(0.82)}" class="zero"/>
       <text x="${x(0) + 4}" y="${y(0.84) - 4}" class="lb">90° ± ${t('learn.chart.tol')}</text>
       <path d="${path(f)}" class="ln a"/>`;
  } else {
    // 가로: 시간, 세로: 오차 (가운데 0)
    const P = (u) => 0.5 + 0.38 * Math.cos(u * 22) * Math.exp(-u * 0.6);
    const PD = (u) => 0.5 + 0.12 + 0.26 * Math.exp(-u * 7) * Math.cos(u * 9);
    const PID = (u) => 0.5 + 0.38 * Math.exp(-u * 6) * Math.cos(u * 9);
    body = axis(t('learn.chart.time'), t('learn.chart.error'));
    if (kind === 'gp') {
      body += `<path d="${path(PD)}" class="ln a"/>` + legend([['#2E6ABF', 'P']]);
    } else if (kind === 'gpi') {
      body += `<path d="${path(PD)}" class="ln b" stroke-dasharray="5 4"/><path d="${path(PID)}" class="ln a"/>` +
        legend([['#9AA6BA', 'P', true], ['#2E6ABF', 'PI']]);
    } else if (kind === 'pd') {
      body += `<path d="${path(P)}" class="ln b" stroke-dasharray="5 4"/><path d="${path(PID)}" class="ln a"/>` +
        legend([['#9AA6BA', 'P', true], ['#2E6ABF', 'PD']]);
    } else {
      body += `<path d="${path(PD)}" class="ln b" stroke-dasharray="5 4"/><path d="${path(PID)}" class="ln a"/>` +
        legend([['#9AA6BA', 'PD', true], ['#2E6ABF', 'PID']]);
    }
  }
  return `<svg class="learn-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${t('learn.chart.alt')}">${body}</svg>`;
}

// ───────────── 화면 ─────────────
export function initLearn({ workspace, load, hub, hubKey, toast, openSim }) {
  const pane = document.getElementById('paneLearn');
  let st = { lesson: 'line', step: 1 };
  try {
    st = { ...st, ...JSON.parse(localStorage.getItem(STORE) || '{}') };
  } catch (e) {
    /* 기본값 */
  }
  if (!LESSONS[st.lesson]) st = { lesson: 'line', step: 1 };
  const L = () => LESSONS[st.lesson];
  const keep = () => {
    try {
      localStorage.setItem(STORE, JSON.stringify(st));
    } catch (e) {
      /* 저장 공간 없음 */
    }
  };

  let glowTimer = 0;
  function glow(ids) {
    clearTimeout(glowTimer);
    workspace.getAllBlocks(false).forEach((b) => b.getSvgRoot()?.classList.remove('rm-new'));
    const blocks = ids.map((id) => workspace.getBlockById(id)).filter(Boolean);
    blocks.forEach((b) => b.getSvgRoot()?.classList.add('rm-new'));
    glowTimer = setTimeout(() => blocks.forEach((b) => b.getSvgRoot()?.classList.remove('rm-new')), GLOW_MS);
  }

  function loadStep() {
    load(lessonWorkspace(st.lesson, hub(), st.step));
    glow(newBlockIds(st.lesson, hub(), st.step));
    toast(t('learn.loaded', st.step), 'ok');
  }

  function render() {
    const lesson = L();
    const k = `learn.${st.lesson}`;
    const pick = `<select class="learn-pick" aria-label="${t('learn.pick')}">${Object.keys(LESSONS).map((key) =>
      `<option value="${key}"${key === st.lesson ? ' selected' : ''}>📚 ${t(`learn.${key}.name`)}</option>`).join('')}</select>`;
    if (!lesson.hubs.includes(hubKey())) {
      pane.innerHTML = `${pick}<div class="note warnnote">${t(k + '.noHub')}</div>`;
      return;
    }
    const n = Math.min(st.step, lesson.steps);
    const p = hub().sensorPorts[0] === 'S1' ? ['A', 'B', 'S3'] : [hub().motorPorts[0], hub().motorPorts[1], 'C'];
    const chips = Array.from({ length: lesson.steps }, (_, i) =>
      `<button type="button" class="learn-step${i + 1 === n ? ' on' : ''}" data-step="${i + 1}">${i + 1}. ${t(`${k}.${i + 1}.short`)}</button>`).join('');
    pane.innerHTML = `
      ${pick}
      <p class="learn-intro">${t(k + '.intro', ...p)}</p>
      <div class="learn-steps">${chips}</div>
      <article class="learn-card">
        <h4>${t(`${k}.${n}.title`)}</h4>
        ${lesson.chart[n - 1] ? chart(lesson.chart[n - 1]) : ''}
        <h5>${t('learn.ideaTitle')}</h5>
        <div class="learn-text">${t(`${k}.${n}.idea`)}</div>
        <h5>${t('learn.changeTitle')}</h5>
        <div class="learn-text">${t(`${k}.${n}.change`)}</div>
        <h5>${t('learn.tryTitle')}</h5>
        <div class="learn-text">${t(`${k}.${n}.try`)}</div>
      </article>
      <div class="learn-actions">
        <button type="button" class="primary" data-act="load">${t('learn.load')}</button>
        <button type="button" data-act="show">${t('learn.show')}</button>
        <button type="button" data-act="sim">${t('learn.sim')}</button>
      </div>
      <div class="learn-nav">
        <button type="button" data-act="prev" ${n <= 1 ? 'disabled' : ''}>${t('learn.prev')}</button>
        <button type="button" data-act="next" ${n >= lesson.steps ? 'disabled' : ''}>${t('learn.next')}</button>
      </div>
      <div class="note">${t(k + '.simNote')}</div>`;
  }

  pane.addEventListener('change', (e) => {
    if (!e.target.matches('.learn-pick')) return;
    st = { lesson: e.target.value, step: 1 };
    keep();
    render();
  });
  pane.addEventListener('click', (e) => {
    const s = e.target.closest('[data-step]');
    if (s) {
      st.step = +s.dataset.step;
      keep();
      render();
      pane.scrollTop = 0;
      return;
    }
    const a = e.target.closest('[data-act]')?.dataset.act;
    if (!a) return;
    if (a === 'load') loadStep();
    else if (a === 'show') glow(newBlockIds(st.lesson, hub(), st.step));
    else if (a === 'sim') openSim(L().mat ? { mat: L().mat } : {});
    else if (a === 'prev' || a === 'next') {
      st.step = Math.max(1, Math.min(L().steps, st.step + (a === 'next' ? 1 : -1)));
      keep();
      render();
      pane.scrollTop = 0;
      loadStep();
    }
  });
  render();
  return { render };
}

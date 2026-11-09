// aiguide.js — AI 카메라 탭 안의 「학습 방법 안내」 (사물 학습 · 색 학습)
// 글은 언어 파일의 aiguide.* (tools/aiguide_text.py).

import { t } from './i18n.js?v=0.3.15';

// 「가장 비슷한 사진 5장」 그림: 사물 1(파랑)·사물 2(주황) 학습 사진과 새 사진(★)
function knnSvg() {
  const a = [[60, 50], [82, 70], [48, 82], [95, 40], [70, 100], [110, 88]];
  const b = [[230, 60], [262, 84], [248, 40], [205, 98], [280, 52], [222, 124]];
  const star = [150, 84];
  const all = [...a.map((p) => [...p, 'a']), ...b.map((p) => [...p, 'b'])]
    .map(([x, y, k]) => [x, y, k, Math.hypot(x - star[0], y - star[1])]).sort((p, q) => p[3] - q[3]);
  const r = all[4][3] + 8;
  const dot = ([x, y, k]) => `<circle cx="${x}" cy="${y}" r="9" fill="${k === 'a' ? '#2E6ABF' : '#F08A24'}"/>`;
  const lines = all.slice(0, 5).map(([x, y]) => `<line x1="${star[0]}" y1="${star[1]}" x2="${x}" y2="${y}" stroke="#9AA6BA" stroke-dasharray="4 3"/>`).join('');
  return `<svg viewBox="0 0 330 160" class="aig-svg" role="img" aria-label="${t('aiguide.svgAlt')}">
    <circle cx="${star[0]}" cy="${star[1]}" r="${r}" fill="#FFF4CC" stroke="#F5B400" stroke-dasharray="5 4"/>
    ${lines}${a.map((p) => dot([...p, 'a'])).join('')}${b.map((p) => dot([...p, 'b'])).join('')}
    <text x="${star[0]}" y="${star[1] + 7}" text-anchor="middle" font-size="22">⭐</text>
    <text x="20" y="150" class="lb" fill="#2E6ABF">● ${t('aiguide.svgA')}</text>
    <text x="190" y="150" class="lb" fill="#F08A24">● ${t('aiguide.svgB')}</text>
  </svg>`;
}

export function initAiGuide() {
  // AI 카메라 탭 안의 접는 칸 (#aiGuide). 📖 버튼은 칸을 펼치고 그 부분으로 스크롤합니다.
  const box = document.getElementById('aiGuide');
  const body = box.querySelector('.aig-body');
  const KEY = 'rm-aiguide-open';
  const render = () => {
    body.innerHTML = t('aiguide.html').replace('{svg}', knnSvg());
  };
  render();
  try {
    box.open = localStorage.getItem(KEY) === '1';
  } catch (e) {
    /* 기본: 접힘 */
  }
  box.addEventListener('toggle', () => {
    try {
      localStorage.setItem(KEY, box.open ? '1' : '0');
    } catch (e) {
      /* 무시 */
    }
  });

  function open(section) {
    // AI 카메라 탭이 아니면 먼저 탭을 엶
    document.querySelector('.tab[data-pane="paneCam"]')?.click();
    box.open = true;
    const el = (section && body.querySelector(`#aig-${section}`)) || box;
    requestAnimationFrame(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-aiguide]');
    if (!b) return;
    e.preventDefault();
    open(b.dataset.aiguide);
  });
  return { open, render };
}

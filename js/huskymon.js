// huskymon.js — 허스키렌즈 모니터 (husky_spike_esp32 브리지)
//
// 허브의 rm_husky 가 "@HK:포트,ID,v1,v2,v3" 줄을 보내면 320×240 화면에 그려 줍니다.
//   블록형(색·물체·얼굴·태그): v1 = 중심 X(0~320), v2 = 중심 Y(0~240), v3 = 가로 W
//   화살표형(라인 추적):        v1 = 시작 X,        v2 = 끝 X,          v3 = 끝 Y
// 브리지는 첫 번째 결과 하나만 보내므로 한 개만 그립니다. 세로 길이는 오지 않아 W 로 어림합니다.
import { t } from './i18n.js?v=0.3.14';

const W = 320, H = 240;
const ID_COLORS = ['#94A3B8', '#FF5A5F', '#2E6ABF', '#22A06B', '#F5A524', '#9B5DE5', '#00B8D9', '#E1306C', '#7C8B9C'];
const idColor = (id) => ID_COLORS[id % ID_COLORS.length];

export class HuskyMonitor {
  constructor(canvas, readout, hint) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.readout = readout;
    this.hint = hint;
    this.kind = 'block';
    this.port = 'C';
    this.last = null; // { port, id, v1, v2, v3, t }
    this.times = [];
    this.trail = [];
    this.render();
  }

  /** 터미널 한 줄을 받아 모니터 줄이면 처리하고 true */
  line(s) {
    const m = /^@HK:([A-F]),(-?\d+),(-?\d+),(-?\d+),(-?\d+)\s*$/.exec(s);
    if (!m) return false;
    const [, port, id, v1, v2, v3] = m;
    const now = performance.now();
    this.last = { port, id: +id, v1: +v1, v2: +v2, v3: +v3, t: now };
    this.times.push(now);
    while (this.times.length && now - this.times[0] > 2000) this.times.shift();
    if (+id > 0 && this.kind === 'block') {
      this.trail.push([+v1, +v2]);
      if (this.trail.length > 25) this.trail.shift();
    } else if (+id === 0) this.trail = [];
    this.render();
    return true;
  }

  setKind(k) {
    this.kind = k;
    this.trail = [];
    this.render();
  }

  get alive() {
    return this.last && performance.now() - this.last.t < 1500;
  }

  render() {
    const c = this.ctx, sx = this.canvas.width / W, sy = this.canvas.height / H;
    c.setTransform(sx, 0, 0, sy, 0, 0);
    c.fillStyle = '#10172A';
    c.fillRect(0, 0, W, H);
    // 격자 40px, 가운데 선, 중앙 구역(120~200: 예제의 「가운데」 범위)
    c.fillStyle = 'rgba(46,106,191,.16)';
    c.fillRect(120, 0, 80, H);
    c.strokeStyle = 'rgba(255,255,255,.07)';
    c.lineWidth = 1 / sx;
    c.beginPath();
    for (let x = 40; x < W; x += 40) c.moveTo(x, 0), c.lineTo(x, H);
    for (let y = 40; y < H; y += 40) c.moveTo(0, y), c.lineTo(W, y);
    c.stroke();
    c.strokeStyle = 'rgba(255,255,255,.25)';
    c.setLineDash([4, 4]);
    c.beginPath();
    c.moveTo(160, 0), c.lineTo(160, H), c.moveTo(0, 120), c.lineTo(W, 120);
    c.stroke();
    c.setLineDash([]);
    c.font = '9px system-ui, sans-serif';
    c.fillStyle = 'rgba(255,255,255,.4)';
    for (const x of [0, 80, 120, 160, 200, 240]) c.fillText(String(x), x + 2, H - 3);
    c.fillText('320', W - 18, H - 3);
    for (const y of [40, 80, 120, 160, 200]) c.fillText(String(y), 2, y - 2);

    const d = this.alive ? this.last : null;
    this.hint.hidden = !!d;
    if (d && d.id > 0) {
      const col = idColor(d.id);
      if (this.kind === 'block') {
        // 지나온 자리
        this.trail.forEach(([x, y], i) => {
          c.fillStyle = col;
          c.globalAlpha = (i + 1) / this.trail.length / 2;
          c.beginPath();
          c.arc(x, y, 2.5, 0, 7);
          c.fill();
        });
        c.globalAlpha = 1;
        const w = Math.max(6, d.v3), h = Math.max(6, d.v3);
        c.strokeStyle = col;
        c.lineWidth = 2.5;
        c.strokeRect(d.v1 - w / 2, d.v2 - h / 2, w, h);
        c.beginPath();
        c.moveTo(d.v1 - 5, d.v2), c.lineTo(d.v1 + 5, d.v2), c.moveTo(d.v1, d.v2 - 5), c.lineTo(d.v1, d.v2 + 5);
        c.stroke();
        this._tag(`ID ${d.id}`, d.v1 - w / 2, d.v2 - h / 2, col);
      } else {
        // 화살표: 아래(로봇 앞) 시작 X → 끝 (X, Y)
        const x0 = d.v1, y0 = H - 4, x1 = d.v2, y1 = d.v3;
        c.strokeStyle = col;
        c.fillStyle = col;
        c.lineWidth = 4;
        c.beginPath();
        c.moveTo(x0, y0), c.lineTo(x1, y1);
        c.stroke();
        const a = Math.atan2(y1 - y0, x1 - x0);
        c.beginPath();
        c.moveTo(x1, y1);
        c.lineTo(x1 - 14 * Math.cos(a - 0.45), y1 - 14 * Math.sin(a - 0.45));
        c.lineTo(x1 - 14 * Math.cos(a + 0.45), y1 - 14 * Math.sin(a + 0.45));
        c.fill();
      }
    } else if (d) {
      c.fillStyle = 'rgba(255,255,255,.55)';
      c.font = '14px system-ui, sans-serif';
      c.textAlign = 'center';
      c.fillText(t('husky.none'), W / 2, H / 2 + 5);
      c.textAlign = 'left';
    }
    this._readout(d);
  }

  _tag(text, x, y, col) {
    const c = this.ctx;
    c.font = 'bold 12px system-ui, sans-serif';
    const tw = c.measureText(text).width + 8;
    const ty = y - 16 < 0 ? y + 2 : y - 16;
    c.fillStyle = col;
    c.fillRect(x, ty, tw, 15);
    c.fillStyle = '#fff';
    c.fillText(text, x + 4, ty + 11.5);
  }

  _readout(d) {
    const rate = this.times.length > 1 ? Math.round(((this.times.length - 1) * 1000) / (this.times.at(-1) - this.times[0])) : 0;
    const v = (x) => (d ? String(x) : '–');
    const rows =
      this.kind === 'block'
        ? [
            [t('husky.id'), d ? (d.id > 0 ? String(d.id) : t('husky.noneShort')) : '–', t('husky.blk.color')],
            ['X', v(d?.v1), t('husky.blk.red')],
            ['Y', v(d?.v2), t('husky.blk.green')],
            ['W', v(d?.v3), t('husky.blk.blue')],
          ]
        : [
            [t('husky.line'), d ? (d.id > 0 ? t('husky.yes') : t('husky.noneShort')) : '–', t('husky.blk.color')],
            [t('husky.sx'), v(d?.v1), t('husky.blk.red')],
            [t('husky.ex'), v(d?.v2), t('husky.blk.green')],
            [t('husky.ey'), v(d?.v3), t('husky.blk.blue')],
          ];
    this.readout.innerHTML =
      rows.map(([k, val, blk]) => `<div><small>${k}</small><b>${val}</b><span class="muted">${blk}</span></div>`).join('') +
      `<div class="husky-rate"><small>${t('husky.rateLabel')}</small><span>${d ? t('husky.rate', rate, d.port) : t('husky.waiting')}</span></div>`;
  }
}

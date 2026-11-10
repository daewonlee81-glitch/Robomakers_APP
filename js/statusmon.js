// statusmon.js — 「상태」 탭: 배터리 · 포트마다 연결된 장치 · 허브 방향
//
// 허브에서 rm_status.run() 이 0.25초마다 보내는 「@ST:...」 줄을 읽어 표로 보여 줍니다.
// 지금 프로그램(파이썬 코드)이 포트마다 무엇을 쓰는지도 읽어서, 실제 연결과 다르면 ⚠ 로 알려 줍니다.

import { t } from './i18n.js?v=0.3.17';

const ICON = { m: '⚙️', c: '🎨', u: '📏', f: '✋', g: '🧭', t: '👆', i: '📡', d: '❔', '-': '⬜' };

/** 코드에서 포트마다 기대하는 장치 종류 (m · c · u · f · g · t · i · bridge) */
export function expectedPorts(code) {
  const want = {};
  const rx = /^\s*(\w+)\s*=\s*(Motor|ColorSensor|UltrasonicSensor|ForceSensor|GyroSensor|TouchSensor|InfraredSensor|HuskyLens|ESP32|PUPDevice|Gamepad)\((?:"esp32",\s*)?Port\.(\w+)/gm;
  const kind = { Motor: 'm', ColorSensor: 'c', UltrasonicSensor: 'u', ForceSensor: 'f', GyroSensor: 'g', TouchSensor: 't', InfraredSensor: 'i' };
  let m;
  while ((m = rx.exec(code))) {
    const k = kind[m[2]] || 'bridge'; // 허스키렌즈·ESP32·BluePad 는 색 센서나 다른 장치 번호로 보임
    want[m[3]] = { k, cls: m[2] };
  }
  // DriveBase(motor_A, motor_B …) 는 Motor 줄에서 이미 잡힘
  return want;
}

export class StatusMonitor {
  constructor(root, { hub, code }) {
    this.root = root;
    this.hub = hub;
    this.code = code;
    this.last = null;
    this.scan = '';
    this.lowFlag = false;
  }

  /** 허브 출력 한 줄. 상태 줄이면 true (터미널에 쓰지 않음) */
  line(s) {
    if (!s.startsWith('@ST:')) return false;
    const body = s.slice(4).trim();
    if (body.startsWith('SCAN,')) {
      this.scan = body.slice(5);
      this.render();
      return true;
    }
    const [head, ...rest] = body.split('|');
    const [mv, ma, heading, pitch, roll] = head.split(',').map(Number);
    const ports = rest.map((p) => {
      const [name, val] = p.split('=');
      const [k, a, b] = (val || '-:0:0').split(':');
      return { name, k, a: +a, b: +b };
    });
    this.scan = '';
    this.last = { mv, ma, heading, pitch, roll, ports, t: performance.now() };
    this.render();
    return true;
  }

  setLowFlag(on) {
    if (this.lowFlag === on) return;
    this.lowFlag = on;
    this.render();
  }

  _battery(mv) {
    const ev3 = this.hub().sensorPorts[0] === 'S1';
    // 어림값: SPIKE 충전지(2셀 리튬) 6.8 ~ 8.3 V, EV3 는 건전지 6개 기준 6.5 ~ 9.0 V
    const [lo, hi] = ev3 ? [6500, 9000] : [6800, 8300];
    const pct = Math.max(0, Math.min(100, Math.round(((mv - lo) / (hi - lo)) * 100)));
    const cls = pct < 25 ? 'bad' : pct < 50 ? 'mid' : 'good';
    return { pct, cls };
  }

  _value(p) {
    switch (p.k) {
      case 'm': return t('st.v.motor', p.a, p.b);
      case 'c': return t('st.v.color', p.a);
      case 'u': return p.a >= 2000 || p.a < 0 ? t('st.v.far') : t('st.v.dist', p.a);
      case 'f': return t('st.v.force', (p.a / 10).toFixed(1)) + (p.b ? ' · ' + t('st.v.pressed') : '');
      case 'g': return t('st.v.gyro', p.a);
      case 't': return p.b || p.a ? t('st.v.pressed') : t('st.v.released');
      case 'i': return t('st.v.ir', p.a);
      case 'd': return t('st.v.devid', p.a);
      default: return '';
    }
  }

  render() {
    const r = this.root;
    if (!r) return;
    const want = expectedPorts(this.code());
    const L = this.last;
    const stale = !L || performance.now() - L.t > 1500;
    let html = '';
    if (this.lowFlag) html += `<div class="note warnnote">🔋 ${t('st.lowFlag')}</div>`;
    if (this.scan) html += `<div class="note">${t('st.scanning', this.scan)}</div>`;
    else if (stale) html += `<div class="note">${t(L ? 'st.stale' : 'st.idle')}</div>`;

    // 배터리
    if (L) {
      const b = this._battery(L.mv);
      html += `<div class="st-card st-bat">
        <div class="st-h">🔋 ${t('st.battery')}</div>
        <div class="st-batbar"><i class="${b.cls}" style="width:${b.pct}%"></i></div>
        <div class="st-row"><b>${(L.mv / 1000).toFixed(2)} V</b> · ${t('st.approx', b.pct)} · ${t('st.current', L.ma)}</div>
        ${b.cls === 'bad' ? `<div class="st-warn">${t('st.charge')}</div>` : ''}
      </div>`;
    }

    // 포트
    const names = this.hub().sensorPorts[0] === 'S1'
      ? [...this.hub().motorPorts, ...this.hub().sensorPorts] : this.hub().motorPorts;
    const byName = Object.fromEntries((L?.ports || []).map((p) => [p.name, p]));
    html += `<div class="st-h st-ports-h">🔌 ${t('st.ports')}</div><div class="st-ports">`;
    for (const n of names) {
      const p = byName[n] || { name: n, k: L ? '-' : '?' };
      const w = want[n];
      let warn = '';
      if (L && w) {
        const ok = w.k === 'bridge' ? p.k === 'c' || p.k === 'd' : p.k === w.k;
        if (!ok) warn = t('st.mismatch', t('st.k.' + w.k), p.k === '-' ? t('st.k.-') : t('st.k.' + p.k));
      }
      html += `<div class="st-port ${p.k === '-' ? 'empty' : ''} ${warn ? 'bad' : ''}">
        <div class="st-pn">${n}</div>
        <div class="st-pk">${p.k === '?' ? '…' : `${ICON[p.k] || '❔'} ${t('st.k.' + p.k)}`}</div>
        <div class="st-pv">${L ? this._value(p) : ''}</div>
        ${w ? `<div class="st-pw">${t('st.uses', t('st.k.' + w.k))}</div>` : ''}
        ${warn ? `<div class="st-warn">⚠ ${warn}</div>` : ''}
        ${p.k === 'c' && (!w || w.k === 'bridge') ? `<div class="st-pn2">${t('st.colorNote')}</div>` : ''}
      </div>`;
    }
    html += '</div>';

    // 방향 (SPIKE)
    if (L && this.hub().imu) {
      html += `<div class="st-card"><div class="st-h">🧭 ${t('st.imu')}</div>
        <div class="st-row">${t('st.heading', L.heading)} · ${t('st.pitch', L.pitch)} · ${t('st.roll', L.roll)}</div></div>`;
    }
    r.innerHTML = html;
  }
}

/** 허브에서 돌릴 상태 확인 프로그램 */
export function statusProgram(h) {
  const ev3 = h.sensorPorts[0] === 'S1';
  return [
    '# Robot status (RoboMakers WordBlock)',
    `from pybricks.hubs import ${h.cls}`,
    'import rm_status',
    '',
    `rm_status.run(${h.cls}()${ev3 ? ', ev3=True' : ''})`,
    '',
  ].join('\n');
}

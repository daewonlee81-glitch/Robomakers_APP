// gamepad.js — PC/태블릿에 연결한 Xbox·PS 조종기를 읽어 허브로 중계 (Gamepad API)
//   G: [LX, LY, RX, RY, LT, RT, 버튼비트, 방향키]
//   버튼비트: A0 B1 X2 Y3 LB4 RB5 VIEW6 MENU7 LJ8 RJ9 UP10 DOWN11 LEFT12 RIGHT13 GUIDE14
//   (표준 매핑 기준 — PS 패드: ✕=A ○=B □=X △=Y)

const DEAD = 8;
const STD_TO_BIT = { 0: 0, 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 8: 6, 9: 7, 10: 8, 11: 9, 12: 10, 13: 11, 14: 12, 15: 13, 16: 14 };

const axis = (v) => {
  const n = Math.round((v || 0) * 100);
  return Math.abs(n) < DEAD ? 0 : Math.max(-100, Math.min(100, n));
};

export class WebGamepad {
  constructor() {
    this.index = null;
    this.state = null;
    window.addEventListener('gamepadconnected', (e) => {
      if (this.index == null) this.index = e.gamepad.index;
    });
    window.addEventListener('gamepaddisconnected', (e) => {
      if (this.index === e.gamepad.index) this.index = null;
    });
  }

  poll() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let gp = this.index != null ? pads[this.index] : null;
    if (!gp) {
      gp = [...pads].find((p) => p && p.connected) || null;
      this.index = gp ? gp.index : null;
    }
    if (!gp) {
      this.state = null;
      return null;
    }
    const btn = (i) => gp.buttons[i] && (gp.buttons[i].pressed || gp.buttons[i].value > 0.5);
    let bits = 0;
    for (const [i, bit] of Object.entries(STD_TO_BIT)) if (btn(+i)) bits |= 1 << bit;
    const up = btn(12), down = btn(13), left = btn(14), right = btn(15);
    // Pybricks 방식 방향키 번호: 0 없음, 1 위, 2 오른쪽위 ... 8 왼쪽위
    let dpad = 0;
    if (up && right) dpad = 2; else if (down && right) dpad = 4; else if (down && left) dpad = 6; else if (up && left) dpad = 8;
    else if (up) dpad = 1; else if (right) dpad = 3; else if (down) dpad = 5; else if (left) dpad = 7;
    const trig = (i) => Math.round(((gp.buttons[i] && gp.buttons[i].value) || 0) * 100);
    this.state = {
      id: gp.id,
      values: [axis(gp.axes[0]), -axis(gp.axes[1]), axis(gp.axes[2]), -axis(gp.axes[3]), trig(6), trig(7), bits, dpad],
    };
    return this.state;
  }

  frame() {
    const s = this.poll();
    return s ? 'G:' + s.values.join(',') + '\n' : '';
  }
}

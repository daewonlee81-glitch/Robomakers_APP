// 브라우저 안의 가짜 Pybricks 허브 (BLE + USB). 실제 Pybricks Profile 1.5 처럼 응답합니다.
(() => {
  const enc = new TextEncoder();
  const dv = (bytes) => new DataView(new Uint8Array(bytes).buffer);
  const H = (window.__hub = { ram: new Uint8Array(300000), size: 0, running: false, cmds: [], stdin: '', started: null, notify: null });
  function status() { const b = new Uint8Array(7); b[0] = 0; new DataView(b.buffer).setUint32(1, H.running ? (1 << 6) : 0, true); return b; }
  function handle(b) {
    const c = b[0]; H.cmds.push(c);
    const d = new DataView(b.buffer, b.byteOffset, b.byteLength);
    if (c === 3) H.size = d.getUint32(1, true);
    else if (c === 4) H.ram.set(b.subarray(5), d.getUint32(1, true));
    else if (c === 1) { H.running = true; H.started = { slot: b[1], size: H.size }; setTimeout(() => { H.notify(status()); H.notify(new Uint8Array([1, ...enc.encode('hello from hub\n')])); }, 30); }
    else if (c === 0) { H.running = false; setTimeout(() => H.notify(status()), 20); }
    else if (c === 6) H.stdin += new TextDecoder().decode(b.subarray(1));
  }
  // ── BLE ──
  const listeners = [];
  const cmdChar = {
    async startNotifications() { H.notify = (bytes) => listeners.forEach((f) => f({ target: { value: dv(bytes) } })); setTimeout(() => H.notify(status()), 10); },
    addEventListener(t, f) { listeners.push(f); },
    async writeValueWithResponse(v) { await new Promise((r) => setTimeout(r, 2)); handle(new Uint8Array(v)); },
  };
  const caps = new Uint8Array(11); { const v = new DataView(caps.buffer); v.setUint16(0, 158, true); v.setUint32(2, 7, true); v.setUint32(6, 262144, true); caps[10] = 5; }
  const devListeners = [];
  const device = {
    name: 'Pybricks Hub (가짜)',
    addEventListener(t, f) { devListeners.push(f); },
    gatt: {
      connected: true,
      async connect() { return server; },
      disconnect() { this.connected = false; devListeners.forEach((f) => f()); },
    },
  };
  const text = (s) => ({ async readValue() { return dv([...enc.encode(s)]); } });
  const server = {
    async getPrimaryService(uuid) {
      if (uuid === 'device_information') return { async getCharacteristic(u) { return u === 0x2a26 ? text('v4.0.0') : text('1.5.0'); } };
      return { async getCharacteristic(u) { return u.startsWith('c5f50002') ? cmdChar : { async readValue() { return new DataView(caps.buffer); } }; } };
    },
  };
  Object.defineProperty(navigator, 'bluetooth', { value: { async requestDevice(opts) { H.bleFilter = JSON.stringify(opts); return device; } } });

  // ── USB (EV3) ──
  const inQueue = []; let inWaiter = null;
  const pushIn = (bytes) => { const m = { status: 'ok', data: dv(bytes) }; if (inWaiter) { const w = inWaiter; inWaiter = null; w(m); } else inQueue.push(m); };
  const usbDev = {
    productName: 'LEGO MINDSTORMS EV3 + Pybricks',
    async open() {}, async selectConfiguration() {}, async claimInterface() {}, async releaseInterface() {}, async close() {},
    configuration: { interfaces: [{ interfaceNumber: 0, alternate: { interfaceClass: 0xff, interfaceSubclass: 0xc5, interfaceProtocol: 0xf5,
      endpoints: [{ direction: 'in', type: 'bulk', endpointNumber: 1, packetSize: 512 }, { direction: 'out', type: 'bulk', endpointNumber: 1, packetSize: 512 }] } }] },
    async controlTransferIn(setup, len) {
      const s = { 0x2a26: 'v4.0.0', 0x2a00: 'EV3 (가짜)', 0x2a28: '1.5.0' };
      if (setup.request === 1) return { status: 'ok', data: dv([...enc.encode(s[setup.value])]) };
      const c = new Uint8Array(11); const v = new DataView(c.buffer); v.setUint16(0, 1020, true); v.setUint32(6, 2000000, true); c[10] = 5;
      return { status: 'ok', data: new DataView(c.buffer) };
    },
    async transferOut(ep, data) {
      const b = new Uint8Array(data.buffer || data, data.byteOffset || 0, data.byteLength);
      if (b[0] === 1) { H.usbSubscribed = b[1]; return { status: 'ok' }; }
      handle(b.slice(1));
      setTimeout(() => pushIn([1, 0, 0, 0, 0]), 1);
      return { status: 'ok' };
    },
    transferIn() { return inQueue.length ? Promise.resolve(inQueue.shift()) : new Promise((r) => (inWaiter = r)); },
  };
  Object.defineProperty(navigator, 'usb', { value: { async requestDevice(o) { H.usbFilter = JSON.stringify(o); H.notify = (bytes) => pushIn([2, ...bytes]); return usbDev; }, addEventListener() {} } });

  // ── 게임패드 (PS5 처럼) ──
  const btn = (p) => ({ pressed: p, value: p ? 1 : 0 });
  const pad = { id: 'DualSense Wireless Controller (가짜)', index: 0, connected: true, mapping: 'standard',
    axes: [0.5, -0.8, 0, 0], buttons: Array.from({ length: 17 }, (_, i) => (i === 0 || i === 12 ? btn(true) : i === 7 ? { pressed: true, value: 0.6 } : btn(false))) };
  navigator.getGamepads = () => [pad, null, null, null];
})();

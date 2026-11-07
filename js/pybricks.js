// pybricks.js — Pybricks 허브 연결(BLE / USB), 컴파일, 다운로드, 실행
// 프로토콜 출처: github.com/pybricks/pybricks-code (MIT), Pybricks Profile v1.2 ~ v1.5

/* global MpyCross */

export const PYBRICKS_SERVICE = 'c5f50001-8280-46da-89f4-6d8051e4aeef';
const PYBRICKS_CMD_EVENT = 'c5f50002-8280-46da-89f4-6d8051e4aeef';
const PYBRICKS_HUB_CAPS = 'c5f50003-8280-46da-89f4-6d8051e4aeef';
const DEVICE_INFO = 'device_information';
const FW_REV = 0x2a26;
const SW_REV = 0x2a28;
const DEVICE_NAME = 0x2a00;

const Cmd = { Stop: 0, Start: 1, Repl: 2, Meta: 3, Ram: 4, Stdin: 6, AppData: 7 };
const Evt = { Status: 0, Stdout: 1, AppData: 2 };
export const Status = { UserProgramRunning: 6, PowerButtonPressed: 5, BatteryLow: 0 };

// USB (Pybricks 인터페이스)
const USB_CLASS = 0xff, USB_SUBCLASS = 0xc5, USB_PROTOCOL = 0xf5;
const USB_REQ_GATT = 0x01, USB_REQ_PYBRICKS = 0x02;
const USB_OUT_SUBSCRIBE = 1, USB_OUT_COMMAND = 2;
const USB_IN_RESPONSE = 1, USB_IN_EVENT = 2;

const enc = new TextEncoder();
const dec = new TextDecoder();

function verGte(v, want) {
  const a = String(v).split(/[.\-]/).map((n) => parseInt(n, 10) || 0);
  const b = want.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((a[i] || 0) !== b[i]) return (a[i] || 0) > b[i];
  }
  return true;
}

// ───────────────────────── 컴파일러 ─────────────────────────

let wasmUrl = new URL('../vendor/mpy-cross/mpy-cross-v6.wasm', import.meta.url).href;

/** 파이썬 소스 하나를 .mpy 로 컴파일 */
export function compileMpy(fileName, source) {
  return new Promise((resolve, reject) => {
    try {
      MpyCross({
        arguments: [fileName],
        inputFileContents: source,
        callback: (status, mpy, out, err) => resolve({ status, mpy, out, err }),
        locateFile: (p, dir) => (p === 'mpy-cross-v6.wasm' ? wasmUrl : dir + p),
      });
    } catch (e) {
      reject(e);
    }
  });
}

/**
 * 메인 프로그램 + 필요한 허브 라이브러리를 Pybricks 다중 모듈 형식으로 묶습니다.
 * 형식: [크기 u32 LE][모듈이름\0][mpy] 반복. 첫 모듈이 __main__ 으로 실행됩니다.
 * @param {string} mainSource
 * @param {(name:string)=>Promise<string|null>} loadLib  모듈 이름 → 소스 (없으면 null)
 */
export async function buildProgram(mainSource, loadLib) {
  const modules = [['__main__', mainSource]];
  const seen = new Set(['__main__']);
  const queue = [mainSource];
  while (queue.length) {
    const src = queue.shift();
    for (const name of findImports(src, src !== mainSource)) {
      if (seen.has(name)) continue;
      seen.add(name);
      const lib = await loadLib(name);
      if (lib != null) {
        modules.push([name, lib]);
        queue.push(lib);
      }
    }
  }
  const parts = [];
  for (const [name, src] of modules) {
    const r = await compileMpy(name === '__main__' ? 'main.py' : name + '.py', src);
    if (r.status !== 0 || !r.mpy) {
      const msg = (r.err || []).join('\n') || '컴파일 오류';
      throw new CompileError(name, msg);
    }
    const size = new Uint8Array(4);
    new DataView(size.buffer).setUint32(0, r.mpy.length, true);
    parts.push(size, enc.encode(name + '\0'), r.mpy);
  }
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return { data: out, modules: modules.map((m) => m[0]) };
}

export class CompileError extends Error {
  constructor(module, message) {
    super(message);
    this.module = module;
  }
}

function findImports(src, topLevelOnly = false) {
  // 라이브러리는 맨 앞(들여쓰기 없는) import 만 따라갑니다. 함수 안의 선택적 import 는
  // 메인 프로그램이 필요할 때 직접 import 하도록 코드 생성기가 처리합니다.
  const names = new Set();
  const re = topLevelOnly ? /^(?:from\s+([A-Za-z_][\w]*)\s+import|import\s+([A-Za-z_][\w]*))/gm : /^\s*(?:from\s+([A-Za-z_][\w]*)\s+import|import\s+([A-Za-z_][\w]*))/gm;
  let m;
  while ((m = re.exec(src))) names.add(m[1] || m[2]);
  return [...names];
}

// ───────────────────────── 전송 계층 ─────────────────────────

class BleTransport {
  constructor() {
    this.kind = 'ble';
    this.device = null;
    this.cmdChar = null;
    this.onEvent = () => {};
    this.onDisconnect = () => {};
  }

  async connect() {
    if (!navigator.bluetooth) throw new Error('이 브라우저는 Web Bluetooth 를 지원하지 않습니다. 크롬(데스크톱/안드로이드)을 사용하세요.');
    this.device = await navigator.bluetooth.requestDevice({
      filters: [{ services: [PYBRICKS_SERVICE] }],
      optionalServices: [PYBRICKS_SERVICE, DEVICE_INFO],
    });
    this.device.addEventListener('gattserverdisconnected', () => this.onDisconnect());
    const server = await this.device.gatt.connect();
    const info = {};
    info.name = this.device.name || 'Pybricks Hub';
    try {
      const di = await server.getPrimaryService(DEVICE_INFO);
      info.firmware = dec.decode(await (await di.getCharacteristic(FW_REV)).readValue());
      info.profile = dec.decode(await (await di.getCharacteristic(SW_REV)).readValue());
    } catch (e) {
      info.profile = '1.0.0';
    }
    const svc = await server.getPrimaryService(PYBRICKS_SERVICE);
    this.cmdChar = await svc.getCharacteristic(PYBRICKS_CMD_EVENT);
    info.maxWrite = 20;
    info.maxProgram = 0;
    info.slots = 0;
    if (verGte(info.profile, '1.2.0')) {
      const caps = await (await svc.getCharacteristic(PYBRICKS_HUB_CAPS)).readValue();
      info.maxWrite = caps.getUint16(0, true);
      info.flags = caps.getUint32(2, true);
      info.maxProgram = caps.getUint32(6, true);
      if (caps.byteLength > 10) info.slots = caps.getUint8(10);
    }
    this.cmdChar.addEventListener('characteristicvaluechanged', (e) => this.onEvent(e.target.value));
    await this.cmdChar.startNotifications();
    return info;
  }

  async write(bytes) {
    await this.cmdChar.writeValueWithResponse(bytes);
  }

  async disconnect() {
    if (this.device?.gatt?.connected) this.device.gatt.disconnect();
  }
}

class UsbTransport {
  constructor() {
    this.kind = 'usb';
    this.dev = null;
    this.onEvent = () => {};
    this.onDisconnect = () => {};
    this._pending = null;
    this._closed = false;
  }

  async connect() {
    if (!navigator.usb) throw new Error('이 브라우저는 WebUSB 를 지원하지 않습니다. 크롬을 사용하세요.');
    this.dev = await navigator.usb.requestDevice({
      filters: [{ classCode: USB_CLASS, subclassCode: USB_SUBCLASS, protocolCode: USB_PROTOCOL }],
    });
    const dev = this.dev;
    await dev.open();
    await dev.selectConfiguration(1);
    const iface = dev.configuration.interfaces.find(
      (i) =>
        i.alternate.interfaceClass === USB_CLASS &&
        i.alternate.interfaceSubclass === USB_SUBCLASS &&
        i.alternate.interfaceProtocol === USB_PROTOCOL,
    );
    if (!iface) throw new Error('Pybricks USB 인터페이스를 찾을 수 없습니다. 최신 Pybricks 펌웨어인지 확인하세요.');
    this.ifaceNum = iface.interfaceNumber;
    this.inEp = iface.alternate.endpoints.find((e) => e.direction === 'in' && e.type === 'bulk');
    this.outEp = iface.alternate.endpoints.find((e) => e.direction === 'out' && e.type === 'bulk');
    try {
      await dev.claimInterface(this.ifaceNum);
    } catch (e) {
      throw new Error('USB 장치를 다른 프로그램(Pybricks Code 탭 등)이 사용 중입니다. 그 탭을 닫고 다시 연결하세요.');
    }
    const ctrl = async (req, value) => {
      const r = await dev.controlTransferIn(
        { requestType: 'class', recipient: 'interface', request: req, value, index: this.ifaceNum },
        20,
      );
      if (r.status !== 'ok') throw new Error('USB 요청 실패');
      return r.data;
    };
    const info = {};
    info.firmware = dec.decode(await ctrl(USB_REQ_GATT, FW_REV));
    info.name = dec.decode(await ctrl(USB_REQ_GATT, DEVICE_NAME)) || dev.productName;
    info.profile = dec.decode(await ctrl(USB_REQ_GATT, SW_REV));
    const caps = await ctrl(USB_REQ_PYBRICKS, 0x0003);
    info.maxWrite = caps.getUint16(0, true);
    info.flags = caps.getUint32(2, true);
    info.maxProgram = caps.getUint32(6, true);
    info.slots = caps.byteLength > 10 ? caps.getUint8(10) : 0;

    navigator.usb.addEventListener('disconnect', (e) => {
      if (e.device === dev) {
        this._closed = true;
        this.onDisconnect();
      }
    });
    this._readLoop();
    await dev.transferOut(this.outEp.endpointNumber, new Uint8Array([USB_OUT_SUBSCRIBE, 1]));
    return info;
  }

  async _readLoop() {
    while (!this._closed) {
      let r;
      try {
        r = await this.dev.transferIn(this.inEp.endpointNumber, this.inEp.packetSize);
      } catch (e) {
        if (!this._closed) {
          this._closed = true;
          this.onDisconnect();
        }
        return;
      }
      if (r.status !== 'ok' || !r.data || r.data.byteLength < 1) continue;
      const type = r.data.getUint8(0);
      if (type === USB_IN_RESPONSE) {
        const code = r.data.byteLength >= 5 ? r.data.getUint32(1, true) : 0;
        if (this._pending) {
          const p = this._pending;
          this._pending = null;
          code === 0 ? p.resolve() : p.reject(new Error('허브 명령 실패 (코드 ' + code + ')'));
        }
      } else if (type === USB_IN_EVENT) {
        this.onEvent(new DataView(r.data.buffer.slice(r.data.byteOffset + 1, r.data.byteOffset + r.data.byteLength)));
      }
    }
  }

  async write(bytes) {
    const msg = new Uint8Array(bytes.length + 1);
    msg[0] = USB_OUT_COMMAND;
    msg.set(bytes, 1);
    const done = new Promise((resolve, reject) => {
      this._pending = { resolve, reject };
      setTimeout(() => {
        if (this._pending) {
          this._pending = null;
          reject(new Error('허브 응답 시간 초과'));
        }
      }, 1500);
    });
    await this.dev.transferOut(this.outEp.endpointNumber, msg);
    await done;
  }

  async disconnect() {
    this._closed = true;
    try {
      await this.dev.releaseInterface(this.ifaceNum);
      await this.dev.close();
    } catch (e) {
      /* 무시 */
    }
  }
}

// ───────────────────────── 허브 ─────────────────────────

export class PybricksHub extends EventTarget {
  constructor() {
    super();
    this.transport = null;
    this.info = null;
    this.status = 0;
    this._queue = Promise.resolve();
    this._stdoutBuf = '';
  }

  get connected() {
    return !!this.transport;
  }

  get running() {
    return !!(this.status & (1 << Status.UserProgramRunning));
  }

  /** @param {'ble'|'usb'} kind */
  async connect(kind) {
    const t = kind === 'usb' ? new UsbTransport() : new BleTransport();
    t.onEvent = (dv) => this._handleEvent(dv);
    t.onDisconnect = () => {
      this.transport = null;
      this.status = 0;
      this._emit('disconnect');
    };
    this.info = await t.connect();
    this.transport = t;
    if (!verGte(this.info.profile, '1.2.0')) {
      await this.disconnect();
      throw new Error(`허브 펌웨어가 너무 오래되었습니다 (프로파일 ${this.info.profile}). code.pybricks.com 에서 최신 Pybricks 펌웨어를 설치하세요.`);
    }
    this._emit('connect', this.info);
    return this.info;
  }

  async disconnect() {
    const t = this.transport;
    this.transport = null;
    if (t) await t.disconnect();
  }

  _emit(type, detail) {
    this.dispatchEvent(new CustomEvent(type, { detail }));
  }

  _handleEvent(dv) {
    const type = dv.getUint8(0);
    if (type === Evt.Status) {
      const prev = this.status;
      this.status = dv.getUint32(1, true);
      if (prev !== this.status) this._emit('status', { flags: this.status, running: this.running });
    } else if (type === Evt.Stdout) {
      const text = dec.decode(new Uint8Array(dv.buffer, dv.byteOffset + 1, dv.byteLength - 1));
      this._emit('stdout', text);
    }
  }

  /** 명령을 순서대로 하나씩 보냅니다. */
  _send(bytes) {
    const run = () => {
      if (!this.transport) throw new Error('허브가 연결되어 있지 않습니다.');
      return this.transport.write(bytes);
    };
    const p = this._queue.then(run, run);
    this._queue = p.catch(() => {});
    return p;
  }

  async stop() {
    await this._send(new Uint8Array([Cmd.Stop]));
  }

  /**
   * 컴파일된 프로그램을 내려받고 실행합니다.
   * @param {Uint8Array} program buildProgram() 결과
   * @param {(p:number)=>void} onProgress
   */
  async downloadAndRun(program, onProgress = () => {}) {
    const info = this.info;
    if (info.maxProgram && program.length > info.maxProgram) {
      throw new Error(`프로그램이 너무 큽니다 (${program.length} / 최대 ${info.maxProgram} 바이트).`);
    }
    if (this.running) {
      await this.stop();
      await new Promise((r) => setTimeout(r, 300));
    }
    const meta = (size) => {
      const b = new Uint8Array(5);
      b[0] = Cmd.Meta;
      new DataView(b.buffer).setUint32(1, size, true);
      return b;
    };
    await this._send(meta(0));
    const chunk = Math.max(16, info.maxWrite - 5);
    for (let i = 0; i < program.length; i += chunk) {
      const data = program.subarray(i, i + chunk);
      const b = new Uint8Array(5 + data.length);
      b[0] = Cmd.Ram;
      new DataView(b.buffer).setUint32(1, i, true);
      b.set(data, 5);
      await this._send(b);
      onProgress(Math.min(1, (i + data.length) / program.length));
    }
    await this._send(meta(program.length));
    if (verGte(info.profile, '1.4.0')) {
      await this._send(new Uint8Array([Cmd.Start, 0]));
    } else {
      await this._send(new Uint8Array([Cmd.Start]));
    }
  }

  /** 실행 중인 프로그램의 stdin 으로 문자열을 보냅니다. */
  async writeStdin(text) {
    if (!this.transport) return;
    const data = enc.encode(text);
    const max = Math.max(16, this.info.maxWrite - 1);
    for (let i = 0; i < data.length; i += max) {
      const part = data.subarray(i, i + max);
      const b = new Uint8Array(part.length + 1);
      b[0] = Cmd.Stdin;
      b.set(part, 1);
      await this._send(b);
    }
  }
}

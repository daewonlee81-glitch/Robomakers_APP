// esp32gen.js — 허브 프로그램의 「ESP32 채널/명령 등록」 블록에 맞는 LMS-ESP32 쪽 main.py 를 만듭니다.
// 허브 쪽 PUPRemoteHub 는 모드 순서·이름·크기를 ESP32 쪽과 비교하므로, 같은 순서로 등록해 주는 것이 중요합니다.
import { t } from './i18n.js?v=0.3.11';
import { APP } from './config.js?v=0.3.11';

const RE = /\besp32_([A-F])\.add_(channel|command)\('((?:[^'\\]|\\.)*)', '((?:[^'\\]|\\.)*)'(?:, '((?:[^'\\]|\\.)*)')?\)/g;

/** struct 형식 문자열의 값 개수. 'hhb' → 3, '3b' → 3, '16s' → 1, 'repr' → 1 */
export function fmtCount(fmt) {
  if (!fmt) return 0;
  if (fmt === 'repr') return 1;
  let n = 0;
  for (const [, num, ch] of fmt.replace(/^[<>!=@]/, '').matchAll(/(\d*)([a-zA-Z?])/g)) n += ch === 's' || ch === 'p' ? 1 : num ? +num : 1;
  return n;
}

const zero = (fmt) => (fmt === 'repr' ? "''" : /[fd]/.test(fmt) ? '0.0' : /s/.test(fmt) ? "b''" : '0');
const zeros = (fmt) => {
  const c = fmtCount(fmt);
  if (fmt === 'repr' || c <= 1) return zero(fmt);
  // 형식 문자마다 0 또는 0.0
  const out = [];
  for (const [, num, ch] of fmt.matchAll(/(\d*)([a-zA-Z?])/g)) {
    const k = ch === 's' ? 1 : num ? +num : 1;
    for (let i = 0; i < k; i++) out.push(ch === 's' ? "b''" : 'fd'.includes(ch) ? '0.0' : '0');
  }
  return out.join(', ');
};
const pyId = (s) => /^[A-Za-z_]\w*$/.test(s);

/** 「ESP32 핀」 블록을 쓰는 포트 (허브 코드의 ESP32(Port.X, io=True)) */
export function esp32IoPorts(code) {
  return new Set([...code.matchAll(/\besp32_([A-F]) = ESP32\(Port\.\1, io=True\)/g)].map((m) => m[1]));
}

// 허브 rm_esp32.IO_CMDS 와 같은 순서·형식
const IO_CMDS = [['pmode', '', 'BB'], ['inp', '8H', ''], ['dout', '', 'BB'], ['pwm', '', 'BB'], ['servo', '', 'BB'], ['npx', '', '6B']];

/** 파이썬 코드에서 포트별 등록 목록을 뽑습니다. → { A: [{kind, name, a, b}], ... } */
export function esp32Modes(code) {
  const ports = {};
  for (const p of esp32IoPorts(code)) ports[p] = [];
  for (const m of code.matchAll(RE)) {
    const [, port, kind, name, a, b = ''] = m;
    const list = (ports[port] ||= []);
    if (!list.some((x) => x.name === name)) list.push({ kind, name, a, b });
  }
  return ports;
}

/** rm_io.py 에서 맨 위 설명 주석을 뺀 본문 */
export function ioBody(src) {
  const lines = src.replace(/\r/g, '').split('\n');
  let i = 0;
  while (i < lines.length && (lines[i].startsWith('#') || lines[i].trim() === '')) i++;
  return lines.slice(i).join('\n').trimEnd();
}

/** 포트 하나의 ESP32 main.py */
export function esp32Main(port, modes, io = false, ioSrc = '') {
  const L = [];
  L.push(`# ${t('esp.gen.head', port)}`);
  L.push(`# ${t('esp.gen.copy')}`);
  L.push(`# ${t('esp.gen.reset')}`);
  L.push('');
  L.push('import lpf2');
  L.push('from pupremote import PUPRemoteSensor');
  L.push('');
  if (io) {
    // rm_io.py 를 main.py 안에 그대로 넣습니다 (파일 하나 덜 복사, 명령 함수가 __main__ 에 있어야 eval 로 찾힘)
    L.push('# ' + '-'.repeat(60));
    L.push(`# ${t('esp.gen.ioCode')}`);
    L.push('# ' + '-'.repeat(60));
    L.push(ioBody(ioSrc));
    L.push('# ' + '-'.repeat(60));
    L.push('');
  }
  L.push("print('lpf2', lpf2.__version__)");
  L.push('');
  for (const m of modes.filter((x) => x.kind === 'command')) {
    if (!pyId(m.name)) continue;
    L.push(`def ${m.name}(*args):`);
    if (m.b) L.push(`    # ${t('esp.gen.args', m.b)}`);
    L.push(`    print('${m.name}', args)`);
    if (m.a) {
      L.push(`    # ${t('esp.gen.ret', m.a)}`);
      L.push(`    return ${zeros(m.a)}`);
    }
    L.push('');
  }
  L.push('');
  L.push('p = PUPRemoteSensor(power=True)');
  if (io) {
    L.push(`# ${t('esp.gen.io')}`);
    for (const [n, a, b] of IO_CMDS) L.push(`p.add_command('${n}', '${a}', '${b}')`);
    if (modes.length) L.push('');
  }
  for (const m of modes) {
    if (m.name.length > 5) L.push(`# ${t('esp.gen.long', m.name)}`);
    if (m.kind === 'channel') L.push(`p.add_channel('${m.name}', '${m.a}')`);
    else L.push(`p.add_command('${m.name}', '${m.a}', '${m.b}')`);
  }
  L.push('');
  L.push('while True:');
  const ch = modes.filter((x) => x.kind === 'channel');
  if (ch.length) {
    L.push(`    # ${t('esp.gen.todo')}`);
    for (const m of ch) L.push(`    p.update_channel('${m.name}', ${zeros(m.a)})`);
  }
  L.push('    p.process()');
  return L.join('\n') + '\n';
}

/** zip 에 넣을 파일 목록. 등록 블록이 없으면 기본 예제(esp32/main.py) 를 넣습니다. */
export async function esp32Files(code, folder) {
  const get = async (n) => (await fetch(new URL(`../esp32/${n}?v=${APP.version}`, import.meta.url))).text();
  const [lpf2, pupremote, license, rmio] = await Promise.all([get('lpf2.py'), get('pupremote.py'), get('LICENSE-PUPRemote.txt'), get('rm_io.py')]);
  const ports = esp32Modes(code);
  const io = esp32IoPorts(code);
  const keys = Object.keys(ports).sort();
  const files = [];
  const libs = (dir) => {
    files.push({ name: `${dir}/lpf2.py`, data: lpf2 }, { name: `${dir}/pupremote.py`, data: pupremote }, { name: `${dir}/LICENSE-PUPRemote.txt`, data: license });
  };
  if (!keys.length) {
    files.push({ name: `${folder}/main.py`, data: await get('main.py') });
    libs(folder);
  } else if (keys.length === 1) {
    files.push({ name: `${folder}/main.py`, data: esp32Main(keys[0], ports[keys[0]], io.has(keys[0]), rmio) });
    libs(folder);
  } else {
    for (const k of keys) {
      files.push({ name: `${folder}/port_${k}/main.py`, data: esp32Main(k, ports[k], io.has(k), rmio) });
      libs(`${folder}/port_${k}`);
    }
  }
  files.push({ name: `${folder}/README.txt`, data: t('dl.esp32Readme') + '\n' });
  return files;
}

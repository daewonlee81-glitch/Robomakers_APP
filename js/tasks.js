// 「시작」 블록이 둘 이상이면 줄기를 동시에(번갈아) 실행하는 파이썬을 만듭니다.
//
// 에디터(js/blocks.js)와 RoboMakers CAD(tools/cad → wordblock-sync.js 에 그대로 들어감)가 함께 씁니다.
// 그래서 import 가 없고, Blockly 는 전역에서 찾습니다.
//
// 방식: 줄기 하나 = 파이썬 제너레이터 함수 하나. 기다리는 곳마다 yield 로 차례를 넘기고,
//       허브의 rm_tasks.run() 이 줄기들을 돌아가며 한 걸음씩 실행합니다.
//       (Pybricks 의 async 모드는 쓰지 않습니다 — 그 모드에서는 hublib 안의 wait() 가 기다리지 않기 때문)
//
//   wait(ms)                       → yield from rm_tasks.sleep(ms)
//   모터·주행 「끝날 때까지」       → wait=False 로 시작 + yield from rm_tasks.done(장치)
//   반복 블록                      → 한 바퀴마다 yield (Blockly INFINITE_LOOP_TRAP)
//   내 블록(함수)                  → 제너레이터로 만들고 yield from 으로 부름
//
// 「시작」 블록이 하나면 beginTasks() 가 null 을 돌려주고, 코드는 예전과 똑같습니다.

const BLOCKING = /^(\s*)([A-Za-z_][\w.]*)\.(run_angle|run_time|run_target|straight|turn|curve)\((.*)\)\s*$/;
const WAIT = /^(\s*)wait\((.*)\)\s*$/;

/** 줄 단위로 「기다리는 코드」를 차례를 넘기는 코드로 바꿉니다. */
export function taskify(code) {
  const out = [];
  for (const line of code.split('\n')) {
    let m = WAIT.exec(line);
    if (m) {
      out.push(`${m[1]}yield from rm_tasks.sleep(${m[2]})`);
      continue;
    }
    m = BLOCKING.exec(line);
    if (m && !/,\s*wait=False\s*$/.test(m[4])) {
      const args = m[4].replace(/,\s*wait=True\s*$/, '');
      out.push(`${m[1]}${m[2]}.${m[3]}(${args}, wait=False)`);
      out.push(`${m[1]}yield from rm_tasks.done(${m[2]})`);
      continue;
    }
    out.push(line);
  }
  return out.join('\n');
}

/** 함수 호출 블록: 줄기 모드에서는 yield from 으로 (한 번만 설치) */
export function installTasks(gen) {
  if (gen.rmTasksInstalled_) return;
  gen.rmTasksInstalled_ = true;
  const fb = gen.forBlock;
  const wrap = (type, fn) => {
    let orig = fb[type];
    Object.defineProperty(fb, type, {
      configurable: true,
      enumerable: true,
      get: () => (orig ? function (b, g) { return fn(orig.call(this, b, g)); } : undefined),
      set: (v) => { orig = v; },
    });
  };
  wrap('procedures_callreturn', (r) => (gen.rmTasks_ && Array.isArray(r) ? [`(yield from ${r[0]})`, 0] : r));
  // (Blockly 의 callnoreturn 은 안에서 callreturn 생성기를 부르므로 이미 괄호가 붙어 올 수 있음)
  wrap('procedures_callnoreturn', (r) => {
    if (!gen.rmTasks_ || typeof r !== 'string' || !r.trim()) return r;
    const m = /^(\s*)\(yield from ([\s\S]*)\)(\s*)$/.exec(r);
    return m ? `${m[1]}yield from ${m[2]}${m[3]}` : r.replace(/^(\s*)/, '$1yield from ');
  });
}

/**
 * 코드 생성 시작 때 부릅니다 (gen.init 다음, rmPlainImports_ 를 만든 다음).
 * 켜진 「시작」 블록이 둘 이상이면 { stack, def, main } 을, 아니면 null 을 돌려줍니다.
 *   stack(code)      시작 블록 하나의 코드를 맡김 → '' (본문에 넣지 않음)
 *   def(key, code)   Blockly definitions_ 한 항목 → 바꾼 코드 (함수 정의만 제너레이터로)
 *   main()           맨 아래에 넣을 코드 (줄기 함수들 + rm_tasks.run)
 */
export function beginTasks(gen, ws, opts = {}) {
  installTasks(gen);
  gen.rmTasks_ = false;
  gen.INFINITE_LOOP_TRAP = null;
  const starts = ws.getTopBlocks(true).filter((b) => b.type === 'rm_start' && b.isEnabled());
  if (starts.length < 2) return null;

  gen.rmTasks_ = true;
  gen.INFINITE_LOOP_TRAP = 'yield\n';
  gen.rmPlainImports_.add('rm_tasks');
  const I = gen.INDENT;
  const bodies = [];
  const B = globalThis.Blockly;

  const globals = () => {
    const names = new Set();
    try {
      for (const v of B.Variables.allUsedVarModels(ws) || []) names.add(gen.getVariableName(v.getId ? v.getId() : v.id));
      for (const d of B.Variables.allDeveloperVariables(ws) || []) names.add(gen.nameDB_.getName(d, B.Names.DEVELOPER_VARIABLE_TYPE || 'DEVELOPER_VARIABLE'));
    } catch (e) { /* 아래 대입 찾기로 충분 */ }
    return names;
  };

  const names = globals(); // gen.finish() 가 이름표를 지우기 전에

  return {
    count: starts.length,
    stack(code) {
      const k = bodies.length + 1;
      // 실행 중인 블록 표시: 줄기마다 따로 밝히도록 번호를 붙임
      bodies.push(opts.trace ? code.replace(/_t\('([^']+)'\)/g, `_t('$1', ${k})`) : code);
      return '';
    },
    def(key, code) {
      // Blockly 는 사용자 함수를 '%이름' 으로 넣습니다. 도우미 함수는 그대로.
      // (정의 앞에 설명 주석이 붙을 수 있음)
      const at = /^def .*$/m.exec(code);
      if (key[0] !== '%' || !at) return code;
      const body = taskify(code);
      // Blockly 가 함수 첫 줄에 INFINITE_LOOP_TRAP(yield)을 넣어 주지만, 없으면 제너레이터가 되도록 넣음
      if (/^\s+yield\s*$/m.test(body)) return body;
      const nl = body.indexOf('\n', at.index);
      return body.slice(0, nl + 1) + `${I}yield\n` + body.slice(nl + 1);
    },
    main() {
      const fns = bodies.map((code, i) => {
        const body = taskify(code);
        const mine = new Set(names);
        for (const m of body.matchAll(/^\s*([A-Za-z_]\w*)\s*(?:\*\*|\/\/|[-+*/%])?=(?!=)/gm)) mine.add(m[1]);
        const g = mine.size ? `${I}global ${[...mine].sort().join(', ')}\n` : '';
        const indented = body.trim() ? gen.prefixLines(body, I) : '';
        return `def _start${i + 1}():\n${g}${indented.trimEnd() ? indented.trimEnd() + '\n' : ''}${I}yield\n`;
      });
      gen.rmTasks_ = false;
      gen.INFINITE_LOOP_TRAP = null;
      return fns.join('\n') + `\nrm_tasks.run(${bodies.map((_, i) => `_start${i + 1}()`).join(', ')})\n`;
    },
  };
}

/** 실행 중인 블록 표시(trace) — 줄기마다 따로 */
export const TRACE_DEF_TASKS = (n) => `_tw = StopWatch()
_tl = [-1] * ${n + 1}
_tt = [-100] * ${n + 1}
def _t(n, f=0, k=0):
    if n != _tl[k]:
        m = _tw.time()
        if f or m - _tt[k] > 35:
            _tl[k] = n
            _tt[k] = m
            print("@BK:%d:%d" % (n, k))`;

// multiport.js — 모터 블록에서 포트를 여러 개 고르기 (예: 「모터 A+E 멈추기」)
//
// 모터 블록의 PORT 드롭다운을 체크 상자 메뉴로 바꿉니다. 값은 "A" 또는 "A,E" (허브 포트 순서).
// 코드 생성기는 원래(포트 하나) 생성기를 포트마다 불러 이어 붙입니다.
//   · 「~만큼 돌리기」(끝날 때까지 기다림)·「~각도로 돌리기」는 앞 모터는 기다리지 않고 마지막 모터만 기다려서 동시에 움직입니다.
// 에디터(Python)와 시뮬레이터(JavaScript) 모두 같은 파일을 씁니다 — tools/sync_cad.py 가 시뮬레이터용으로 그대로 넣습니다.

export function installMultiPorts(Blockly, opts) {
  const { ports, label, types, gens } = opts;
  if (Blockly.__rmMultiPorts) return;
  Blockly.__rmMultiPorts = true;

  const css = document.createElement('style');
  css.textContent = `
.rm-mp{padding:6px;display:flex;flex-direction:column;gap:2px;min-width:110px;font:14px sans-serif}
.rm-mp label{display:flex;align-items:center;gap:8px;padding:5px 10px;border-radius:6px;cursor:pointer;color:#fff;font-weight:700}
.rm-mp label:hover{background:rgba(255,255,255,.18)}
.rm-mp input{width:16px;height:16px;margin:0;accent-color:#fff;cursor:pointer}
.rm-mp button{margin-top:4px;padding:5px 8px;border:0;border-radius:6px;background:rgba(255,255,255,.22);color:#fff;font:inherit;font-weight:700;cursor:pointer}
.rm-mp small{color:rgba(255,255,255,.8);padding:2px 10px 4px;font-size:11.5px}`;
  document.head.appendChild(css);

  const list = (v) => String(v || '').split(/[,+\s]+/).filter(Boolean);

  class FieldPorts extends Blockly.FieldDropdown {
    constructor() {
      super(() => ports().map((p) => [p, p]));
    }

    doClassValidation_(v) {
      const want = list(v);
      const all = ports();
      const ok = all.filter((p) => want.includes(p));
      return ok.length && ok.length === new Set(want).size ? ok.join(',') : null;
    }

    getText_() {
      return list(this.getValue()).join('+');
    }

    showEditor_() {
      const block = this.getSourceBlock();
      const DD = Blockly.DropDownDiv;
      DD.clearContent();
      const box = document.createElement('div');
      box.className = 'rm-mp';
      const draw = () => {
        const cur = list(this.getValue());
        box.innerHTML = ports().map((p) => `<label><input type="checkbox" value="${p}" ${cur.includes(p) ? 'checked' : ''}> ${label('port', p)}</label>`).join('') +
          `<small>${label('hint')}</small><button type="button">${label(cur.length === ports().length ? 'one' : 'all')}</button>`;
      };
      draw();
      box.addEventListener('change', (e) => {
        const cb = e.target.closest('input');
        if (!cb) return;
        const cur = list(this.getValue());
        const next = cb.checked ? [...cur, cb.value] : cur.filter((p) => p !== cb.value);
        if (!next.length) {
          cb.checked = true; // 하나는 남겨 둠
          return;
        }
        this.setValue(next.join(','));
        draw();
      });
      box.addEventListener('click', (e) => {
        if (!e.target.closest('button')) return;
        const all = ports();
        this.setValue(list(this.getValue()).length === all.length ? all[0] : all.join(','));
        draw();
      });
      DD.getContentDiv().appendChild(box);
      if (block) DD.setColour(block.getColour(), block.getColourTertiary());
      DD.showPositionedByField(this, () => this.applyColour?.());
      this.applyColour?.();
    }
  }
  Blockly.fieldRegistry?.register?.('field_rm_ports', FieldPorts);

  // 블록: init 뒤에 PORT 드롭다운을 체크 상자 칸으로 바꿈 (나중에 정의되는 블록도)
  const patch = (def) => {
    if (!def || def.__rmMp || typeof def.init !== 'function') return def;
    const init = def.init;
    def.init = function () {
      init.call(this);
      const f = this.getField('PORT');
      if (!f || f instanceof FieldPorts) return;
      const input = f.getParentInput();
      const at = input.fieldRow.indexOf(f);
      const v = f.getValue();
      input.removeField('PORT');
      const nf = new FieldPorts();
      input.insertFieldAt(at, nf, 'PORT');
      nf.setValue(v);
    };
    def.__rmMp = true;
    return def;
  };
  for (const type of types) {
    let cur = patch(Blockly.Blocks[type]);
    Object.defineProperty(Blockly.Blocks, type, {
      configurable: true,
      enumerable: true,
      get: () => cur,
      set: (d) => {
        cur = patch(d);
      },
    });
  }

  // 코드 생성기: 포트마다 원래 생성기를 불러 이어 붙임
  const asPort = (b, map) => new Proxy(b, {
    get(o, k) {
      if (k === 'getFieldValue') return (n) => (n in map ? map[n] : o.getFieldValue(n));
      const v = o[k];
      return typeof v === 'function' ? v.bind(o) : v;
    },
  });
  const wrap = (orig, type, js) => function (b, g) {
    const ps = list(b.getFieldValue('PORT'));
    if (ps.length <= 1) return orig.call(this, b, g);
    const out = [];
    ps.forEach((p, i) => {
      const last = i === ps.length - 1;
      const map = { PORT: p };
      if (type === 'rm_motor_run_for' && !last) map.WAIT = 'False';
      let s = orig.call(this, asPort(b, map), g);
      if (Array.isArray(s)) s = s[0];
      if (type === 'rm_motor_target' && !last) {
        s = js ? s.replace(/^(\s*)await\s+/, '$1') : s.replace(/\)\s*$/, ', wait=False)\n');
      }
      out.push(s);
    });
    return out.join('');
  };
  for (const { gen, js } of gens) {
    if (!gen) continue;
    const fb = gen.forBlock;
    for (const type of types) {
      let cur = fb[type] ? wrap(fb[type], type, js) : undefined;
      // 나중에 다시 넣는 생성기도 감싸도록
      Object.defineProperty(fb, type, {
        configurable: true,
        enumerable: true,
        get: () => cur,
        set: (fn) => {
          cur = fn ? wrap(fn, type, js) : fn;
        },
      });
    }
  }
  return FieldPorts;
}

export const MULTI_PORT_BLOCKS = ['rm_motor_setup', 'rm_motor_run', 'rm_motor_power', 'rm_motor_run_for', 'rm_motor_target', 'rm_motor_stop', 'rm_motor_reset'];

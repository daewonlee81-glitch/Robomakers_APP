/* tutor-bench.js — AI 튜터 모델 목록 + 「모델 비교 시험」 (로보메이커스 앱 공용)
 *
 * 같은 파일을 Robomakers_APP · WeDo Makers · Dynamic Makers 에서 함께 씁니다.
 * import 없이 window.RMTutorBench 에 붙는 보통 스크립트라 ES 모듈·묶음(esbuild)·한 파일 앱 어디에나 넣을 수 있습니다.
 *
 *  모델 (WebLLM 0.2.87 · 한 번 받으면 브라우저에 저장, 인터넷 없이 동작)
 *    light  Qwen2.5-Coder 1.5B   약 1.6 GB  — 그래픽 메모리가 적은 PC
 *    rec    Qwen3.5 2B           약 2.2 GB  — 추천 (다국어·한국어가 좋음)
 *    pro    Qwen3.5 4B           약 3.9 GB  — 성능 좋은 PC
 *    old    Qwen2.5-Coder 3B     (예전 「똑똑한 모델」 — 설치돼 있을 때만 보이고 지우기 권장)
 *
 *  비교 시험: 일부러 틀린 곳을 넣은 예제 5개를 설치된 모델마다 똑같이 묻고
 *    · 틀린 줄을 [L#] 로 맞게 짚었는지 (자동) · 첫 글자까지 / 전체 시간 · 속도(토큰/초)
 *    · 선생님 점수 1~5 (한국어가 자연스럽고 도움이 되는지)
 *  를 표로 보여 줍니다.
 */
(function () {
  'use strict';
  if (typeof window === 'undefined' || window.RMTutorBench) return;

  const MODELS = {
    light: { f16: 'Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC', f32: 'Qwen2.5-Coder-1.5B-Instruct-q4f32_1-MLC', gb: 1.6, think: false },
    rec: { f16: 'Qwen3.5-2B-q4f16_1-MLC', f32: 'Qwen3.5-2B-q4f32_1-MLC', gb: 2.2, think: true },
    pro: { f16: 'Qwen3.5-4B-q4f16_1-MLC', f32: 'Qwen3.5-4B-q4f32_1-MLC', gb: 3.9, think: true },
    old: { f16: 'Qwen2.5-Coder-3B-Instruct-q4f16_1-MLC', f32: 'Qwen2.5-Coder-3B-Instruct-q4f32_1-MLC', gb: 2.5, think: false, legacy: true },
  };
  // 예전에 저장된 이름 → 새 이름
  const ALIAS = { small: 'light', large: 'old' };

  // 언어: ko en ja zh-CN zh-TW es th (없는 언어는 영어)
  const L = ['ko', 'en', 'ja', 'zh-CN', 'zh-TW', 'es', 'th'];
  const norm = (lang) => {
    lang = String(lang || 'en');
    if (L.includes(lang)) return lang;
    if (/^zh[-_](tw|hk|hant)/i.test(lang)) return 'zh-TW';
    if (/^zh/i.test(lang)) return 'zh-CN';
    const b = lang.slice(0, 2).toLowerCase();
    return L.includes(b) ? b : 'en';
  };
  const TX = {
    light: ['가벼운 모델 · Qwen 코더 1.5B (약 1.6 GB)', 'Light · Qwen Coder 1.5B (about 1.6 GB)', '軽量 · Qwen Coder 1.5B（約1.6 GB）', '轻量 · Qwen Coder 1.5B（约 1.6 GB）', '輕量 · Qwen Coder 1.5B（約 1.6 GB）', 'Ligero · Qwen Coder 1.5B (unos 1,6 GB)', 'เบา · Qwen Coder 1.5B (ประมาณ 1.6 GB)'],
    rec: ['추천 · Qwen3.5 2B (약 2.2 GB)', 'Recommended · Qwen3.5 2B (about 2.2 GB)', 'おすすめ · Qwen3.5 2B（約2.2 GB）', '推荐 · Qwen3.5 2B（约 2.2 GB）', '推薦 · Qwen3.5 2B（約 2.2 GB）', 'Recomendado · Qwen3.5 2B (unos 2,2 GB)', 'แนะนำ · Qwen3.5 2B (ประมาณ 2.2 GB)'],
    pro: ['고성능 · Qwen3.5 4B (약 3.9 GB)', 'High-end · Qwen3.5 4B (about 3.9 GB)', '高性能 · Qwen3.5 4B（約3.9 GB）', '高性能 · Qwen3.5 4B（约 3.9 GB）', '高效能 · Qwen3.5 4B（約 3.9 GB）', 'Alto rendimiento · Qwen3.5 4B (unos 3,9 GB)', 'ประสิทธิภาพสูง · Qwen3.5 4B (ประมาณ 3.9 GB)'],
    old: ['예전 모델 · Qwen 코더 3B — 지워도 됩니다', 'Old model · Qwen Coder 3B — safe to delete', '旧モデル · Qwen Coder 3B — 削除してかまいません', '旧模型 · Qwen Coder 3B — 可以删除', '舊模型 · Qwen Coder 3B — 可以刪除', 'Modelo antiguo · Qwen Coder 3B — se puede borrar', 'โมเดลเก่า · Qwen Coder 3B — ลบได้'],
    lightD: ['그래픽 메모리가 적은 PC', 'For PCs with little graphics memory', 'グラフィックメモリが少ないPC向け', '适合显存较少的电脑', '適合顯示記憶體較少的電腦', 'Para PC con poca memoria gráfica', 'สำหรับคอมพิวเตอร์ที่หน่วยความจำกราฟิกน้อย'],
    recD: ['한국어 등 여러 언어 설명이 좋아요', 'Best at explaining in many languages', '多くの言語での説明が得意', '多语言讲解更好', '多語言講解更好', 'Mejor explicando en varios idiomas', 'อธิบายได้ดีหลายภาษา'],
    proD: ['더 정확하지만 그래픽 메모리 4 GB 이상 필요', 'More accurate, needs 4 GB+ graphics memory', 'より正確・グラフィックメモリ4 GB以上が必要', '更准确,需要 4 GB 以上显存', '更準確,需要 4 GB 以上顯示記憶體', 'Más preciso, necesita 4 GB+ de memoria gráfica', 'แม่นยำกว่า ต้องมีหน่วยความจำกราฟิก 4 GB ขึ้นไป'],
    bench: ['🧪 모델 비교 시험 (선생님용)', '🧪 Compare models (for teachers)', '🧪 モデル比較テスト（先生用）', '🧪 模型对比测试(教师用)', '🧪 模型比較測試(教師用)', '🧪 Comparar modelos (docentes)', '🧪 ทดสอบเปรียบเทียบโมเดล (สำหรับครู)'],
    title: ['AI 튜터 모델 비교 시험', 'AI tutor model comparison', 'AIチューター モデル比較テスト', 'AI 导师模型对比测试', 'AI 導師模型比較測試', 'Comparación de modelos del tutor IA', 'ทดสอบเปรียบเทียบโมเดลติวเตอร์ AI'],
    intro: ['일부러 틀린 곳을 넣은 예제 {0}개를 설치된 모델마다 똑같이 묻습니다. 틀린 줄을 맞게 짚었는지와 걸린 시간은 자동으로 재고, 답이 자연스럽고 도움이 되는지는 선생님이 1~5점으로 매겨 주세요. 시험 중에는 인터넷이 필요 없습니다.',
      'Each installed model gets the same {0} example programs with a planted mistake. Line accuracy and time are measured automatically; please rate each answer 1–5 for how natural and helpful it is. No internet is needed while testing.',
      'わざと間違いを入れた例 {0} 個を、インストール済みの各モデルに同じように質問します。間違った行を当てたかと時間は自動で測り、答えが自然で役に立つかは先生が1〜5点で採点してください。テスト中はインターネット不要です。',
      '用 {0} 个故意放了错误的示例,向每个已安装的模型提出同样的问题。是否指出正确的行和用时会自动测量,回答是否自然、有帮助请老师打 1~5 分。测试时不需要网络。',
      '用 {0} 個故意放了錯誤的範例,向每個已安裝的模型提出同樣的問題。是否指出正確的行和用時會自動測量,回答是否自然、有幫助請老師打 1~5 分。測試時不需要網路。',
      'Cada modelo instalado recibe los mismos {0} programas con un error a propósito. La línea acertada y el tiempo se miden solos; puntúa cada respuesta de 1 a 5 según lo natural y útil que sea. No hace falta internet durante la prueba.',
      'ถามตัวอย่าง {0} ข้อที่ใส่จุดผิดไว้ กับทุกโมเดลที่ติดตั้ง เหมือนกันทุกตัว ระบบวัดเองว่าชี้บรรทัดถูกไหมและใช้เวลาเท่าไร ส่วนความเป็นธรรมชาติและประโยชน์ของคำตอบ ให้ครูให้คะแนน 1–5 ระหว่างทดสอบไม่ต้องใช้อินเทอร์เน็ต'],
    pick: ['시험할 모델', 'Models to test', 'テストするモデル', '要测试的模型', '要測試的模型', 'Modelos a probar', 'โมเดลที่จะทดสอบ'],
    none: ['설치된 모델이 없어요. 먼저 AI 튜터에서 모델을 하나 이상 설치해 주세요.', 'No model is installed. Install at least one model in the AI tutor first.', 'インストール済みのモデルがありません。先にAIチューターでモデルを入れてください。', '没有已安装的模型。请先在 AI 导师中安装至少一个模型。', '沒有已安裝的模型。請先在 AI 導師中安裝至少一個模型。', 'No hay modelos instalados. Instala al menos uno en el tutor IA.', 'ยังไม่มีโมเดลที่ติดตั้ง กรุณาติดตั้งอย่างน้อยหนึ่งโมเดลในติวเตอร์ AI ก่อน'],
    start: ['▶ 시험 시작', '▶ Start test', '▶ テスト開始', '▶ 开始测试', '▶ 開始測試', '▶ Empezar', '▶ เริ่มทดสอบ'],
    stop: ['■ 멈추기', '■ Stop', '■ 停止', '■ 停止', '■ 停止', '■ Parar', '■ หยุด'],
    close: ['닫기', 'Close', '閉じる', '关闭', '關閉', 'Cerrar', 'ปิด'],
    loading: ['{0} 불러오는 중… {1}%', 'Loading {0}… {1}%', '{0} を読み込み中… {1}%', '正在加载 {0}… {1}%', '正在載入 {0}… {1}%', 'Cargando {0}… {1} %', 'กำลังโหลด {0}… {1}%'],
    asking: ['{0} · 문제 {1}/{2}', '{0} · case {1}/{2}', '{0} · 問題 {1}/{2}', '{0} · 第 {1}/{2} 题', '{0} · 第 {1}/{2} 題', '{0} · caso {1}/{2}', '{0} · ข้อ {1}/{2}'],
    done: ['시험 끝 — 답을 읽고 점수를 매겨 주세요.', 'Done — read the answers and rate them.', '終了 — 答えを読んで採点してください。', '完成 — 请阅读回答并打分。', '完成 — 請閱讀回答並評分。', 'Terminado: lee las respuestas y puntúalas.', 'เสร็จแล้ว — อ่านคำตอบแล้วให้คะแนน'],
    model: ['모델', 'Model', 'モデル', '模型', '模型', 'Modelo', 'โมเดล'],
    lines: ['줄 맞힘', 'Right line', '行の正解', '指对行', '指對行', 'Línea acertada', 'ชี้บรรทัดถูก'],
    first: ['첫 글자', 'First word', '最初の文字', '首字', '首字', 'Primera palabra', 'คำแรก'],
    total: ['전체 시간', 'Total time', '全体の時間', '总用时', '總用時', 'Tiempo total', 'เวลาทั้งหมด'],
    speed: ['속도', 'Speed', '速度', '速度', '速度', 'Velocidad', 'ความเร็ว'],
    score: ['선생님 점수', 'Teacher score', '先生の点数', '教师评分', '教師評分', 'Nota docente', 'คะแนนครู'],
    tps: ['토큰/초', 'tok/s', 'トークン/秒', 'token/秒', 'token/秒', 'tok/s', 'โทเคน/วินาที'],
    expect: ['정답 줄', 'Expected line', '正解の行', '正确的行', '正確的行', 'Línea esperada', 'บรรทัดที่ถูก'],
    copy: ['📋 결과 복사', '📋 Copy results', '📋 結果をコピー', '📋 复制结果', '📋 複製結果', '📋 Copiar resultados', '📋 คัดลอกผล'],
    copied: ['결과를 복사했습니다.', 'Results copied.', '結果をコピーしました。', '已复制结果。', '已複製結果。', 'Resultados copiados.', 'คัดลอกผลแล้ว'],
    useBest: ['이 모델 쓰기', 'Use this model', 'このモデルを使う', '使用此模型', '使用此模型', 'Usar este modelo', 'ใช้โมเดลนี้'],
    err: ['오류: {0}', 'Error: {0}', 'エラー:{0}', '错误:{0}', '錯誤:{0}', 'Error: {0}', 'ข้อผิดพลาด: {0}'],
    last: ['지난 시험 결과 ({0})', 'Last results ({0})', '前回の結果（{0}）', '上次结果({0})', '上次結果({0})', 'Últimos resultados ({0})', 'ผลครั้งก่อน ({0})'],
    note: ['※ 같은 PC에서 한 번에 한 모델씩 불러와 시험합니다. 큰 모델은 불러오는 데 1분 넘게 걸릴 수 있어요.', '※ Models are loaded one at a time on this PC. Large models can take over a minute to load.', '※ このPCで1つずつ読み込んでテストします。大きいモデルは読み込みに1分以上かかることがあります。', '※ 在这台电脑上一次加载一个模型测试。大模型加载可能超过 1 分钟。', '※ 在這台電腦上一次載入一個模型測試。大模型載入可能超過 1 分鐘。', '※ Los modelos se cargan de uno en uno en este PC. Los grandes pueden tardar más de un minuto.', '※ โหลดทีละโมเดลในเครื่องนี้ โมเดลใหญ่อาจใช้เวลาโหลดเกิน 1 นาที'],
  };
  const tx = (k, lang, ...a) => {
    const row = TX[k];
    if (!row) return k;
    const s = row[L.indexOf(norm(lang))] || row[1];
    return s.replace(/\{(\d)\}/g, (_, i) => (a[i] !== undefined ? a[i] : ''));
  };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

  /* ---------- 모델 ---------- */
  const key = (k) => ALIAS[k] || (MODELS[k] ? k : 'rec');
  const modelId = (k, f16) => {
    const m = MODELS[key(k)];
    return m ? m[f16 ? 'f16' : 'f32'] : null;
  };
  /** WebLLM chat.completions.create 에 덧붙일 옵션 (Qwen3.5 는 「생각 단계」를 꺼서 빠르게) */
  const genOpts = (k) => (MODELS[key(k)]?.think ? { extra_body: { enable_thinking: false } } : {});
  const stripThink = (s) => String(s).replace(/<think>[\s\S]*?(<\/think>|$)/g, '').trim();
  /** 설치 칸에 보일 모델: 기본 3개 + 예전 모델(설치돼 있을 때만) */
  const rows = (installed) => ['light', 'rec', 'pro', 'old'].filter((k) => !MODELS[k].legacy || installed?.[k]);

  /* ---------- 채점 ---------- */
  function citedLines(text) {
    const out = new Set();
    for (const m of String(text).matchAll(/\[\s*L(\d+)(?:\s*[-–~]\s*L?(\d+))?\s*\]/g)) {
      const a = +m[1], b = +(m[2] || m[1]);
      for (let i = Math.min(a, b); i <= Math.max(a, b) && i - a < 30; i++) out.add(i);
    }
    return [...out];
  }
  const hit = (text, expect) => citedLines(text).some((n) => expect.includes(n));

  /* ---------- 비교 시험 화면 ---------- */
  const STORE = 'rm-tutor-bench';
  let css = false;
  function addCss() {
    if (css) return;
    css = true;
    const st = document.createElement('style');
    st.textContent = `
.rmb-back{position:fixed;inset:0;z-index:400;background:rgba(15,23,42,.45);display:flex;align-items:center;justify-content:center;padding:16px}
.rmb{background:#fff;color:#1e293b;border-radius:14px;max-width:960px;width:100%;max-height:92vh;overflow:auto;padding:18px 20px;box-shadow:0 20px 60px rgba(0,0,0,.3);font-size:14px;line-height:1.5}
.rmb h2{margin:0 0 6px;font-size:19px}.rmb p{margin:6px 0}.rmb small{color:#64748b}
.rmb-pick{display:flex;flex-wrap:wrap;gap:8px 16px;margin:8px 0}
.rmb-pick label{display:flex;gap:6px;align-items:center}
.rmb button{height:32px;padding:0 12px;border-radius:8px;border:1px solid #cbd5e1;background:#fff;font:inherit;font-weight:700;cursor:pointer}
.rmb button.primary{background:#6B3FC2;border-color:#6B3FC2;color:#fff}
.rmb button:disabled{opacity:.5;cursor:default}
.rmb-bar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:10px 0}
.rmb-state{flex:1;min-width:200px;color:#475569}
.rmb table{border-collapse:collapse;width:100%;margin:8px 0}
.rmb th,.rmb td{border:1px solid #e2e8f0;padding:6px 8px;text-align:left;vertical-align:top}
.rmb th{background:#f8fafc;font-size:13px}
.rmb td.num{text-align:right;white-space:nowrap}
.rmb-case{border:1px solid #e2e8f0;border-radius:10px;margin:8px 0;padding:8px 10px}
.rmb-case>b{display:block;margin-bottom:4px}
.rmb-case pre{background:#f8fafc;border-radius:8px;padding:6px 8px;white-space:pre-wrap;font-size:12px;margin:4px 0;max-height:160px;overflow:auto}
.rmb-ans{border-top:1px dashed #e2e8f0;padding:6px 0}
.rmb-ans .who{font-weight:700}.rmb-ans .ok{color:#15803d}.rmb-ans .no{color:#b91c1c}
.rmb-ans .txt{white-space:pre-wrap;background:#f5f3ff;border-radius:8px;padding:6px 8px;margin:4px 0}
.rmb-rate button{height:26px;min-width:30px;padding:0 6px;margin-right:2px}
.rmb-rate button.on{background:#6B3FC2;color:#fff;border-color:#6B3FC2}`;
    document.head.appendChild(st);
  }

  /**
   * opts = {
   *   lang, cases: [{ title, listing, question, expect:[줄번호] }],
   *   systemPrompt(lang), lib() → WebLLM 모듈, f16: bool,
   *   installed: { light:true, ... }, chrome?: { ok, label, ask(system,user) async gen },
   *   before(): 튜터가 쓰던 모델을 내려놓기, after(): 튜터 모델 다시, onUse(key): 이 모델 쓰기, toast(msg)
   * }
   */
  function open(opts) {
    addCss();
    const lang = norm(opts.lang);
    const T = (k, ...a) => tx(k, lang, ...a);
    const cases = opts.cases || [];
    const avail = rows(opts.installed).filter((k) => opts.installed?.[k]);
    if (opts.chrome?.ok) avail.push('chrome');
    const label = (k) => (k === 'chrome' ? opts.chrome.label : tx(k, lang));
    let last = null;
    try {
      last = JSON.parse(localStorage.getItem(STORE) || 'null');
    } catch (e) {
      last = null;
    }
    let res = last && last.cases === cases.length ? last : null; // { at, cases, models:{k:{answers:[{text,first,total,tps,hit,score}]}} }
    let stop = false;
    let running = false;

    const back = document.createElement('div');
    back.className = 'rmb-back';
    back.innerHTML = `<div class="rmb" role="dialog" aria-modal="true">
      <h2>${T('title')}</h2>
      <p>${T('intro', cases.length)}</p>
      ${avail.length ? `<div class="rmb-pick"><b>${T('pick')}:</b>${avail.map((k) => `<label><input type="checkbox" value="${k}" checked> ${esc(label(k))}</label>`).join('')}</div>`
        : `<p class="no"><b>${T('none')}</b></p>`}
      <div class="rmb-bar"><button class="primary" data-a="start" ${avail.length ? '' : 'disabled'}>${T('start')}</button>
        <button data-a="stop" hidden>${T('stop')}</button><span class="rmb-state"></span>
        <button data-a="copy">${T('copy')}</button><button data-a="close">${T('close')}</button></div>
      <small>${T('note')}</small>
      <div class="rmb-out"></div></div>`;
    document.body.appendChild(back);
    const $ = (s) => back.querySelector(s);
    const state = (s) => ($('.rmb-state').textContent = s);
    const keep = () => {
      try {
        localStorage.setItem(STORE, JSON.stringify(res));
      } catch (e) {
        /* 무시 */
      }
    };

    function summary(k) {
      const a = (res.models[k]?.answers || []).filter(Boolean);
      const avg = (f) => {
        const v = a.map(f).filter((x) => typeof x === 'number' && isFinite(x));
        return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null;
      };
      return { n: a.length, hits: a.filter((x) => x.hit).length, first: avg((x) => x.first), total: avg((x) => x.total), tps: avg((x) => x.tps), score: avg((x) => x.score) };
    }
    const sec = (ms) => (ms == null ? '–' : (ms / 1000).toFixed(1) + 's');
    function render() {
      const out = $('.rmb-out');
      if (!res) return (out.innerHTML = '');
      const ks = Object.keys(res.models);
      const table = `<table><tr><th>${T('model')}</th><th>${T('lines')}</th><th>${T('first')}</th><th>${T('total')}</th><th>${T('speed')}</th><th>${T('score')}</th><th></th></tr>
        ${ks.map((k) => {
          const s = summary(k);
          return `<tr><td>${esc(label(k) || k)}</td><td class="num">${s.hits}/${s.n}</td><td class="num">${sec(s.first)}</td><td class="num">${sec(s.total)}</td>
            <td class="num">${s.tps == null ? '–' : s.tps.toFixed(1) + ' ' + T('tps')}</td><td class="num">${s.score == null ? '–' : s.score.toFixed(1)}</td>
            <td>${k !== 'chrome' && opts.onUse ? `<button data-use="${k}">${T('useBest')}</button>` : ''}</td></tr>`;
        }).join('')}</table>`;
      const detail = cases.map((c, i) => `<div class="rmb-case"><b>${i + 1}. ${esc(c.title)}</b>
        <small>${T('expect')}: ${c.expect.map((n) => '[L' + n + ']').join(' ')} · ${esc(c.question)}</small>
        <pre>${esc(c.listing)}</pre>
        ${ks.map((k) => {
          const a = res.models[k]?.answers?.[i];
          if (!a) return '';
          return `<div class="rmb-ans"><span class="who">${esc(label(k) || k)}</span> · <span class="${a.hit ? 'ok' : 'no'}">${a.hit ? '✅' : '❌'} ${citedLines(a.text).map((n) => 'L' + n).join(' ') || '—'}</span>
            <small> · ${sec(a.first)} / ${sec(a.total)}</small>
            <div class="txt">${esc(a.text || '')}</div>
            <div class="rmb-rate">${T('score')}: ${[1, 2, 3, 4, 5].map((v) => `<button data-rate="${k}|${i}|${v}" class="${a.score === v ? 'on' : ''}">${v}</button>`).join('')}</div></div>`;
        }).join('')}</div>`).join('');
      out.innerHTML = (last && res === last && res.at ? `<p><small>${T('last', new Date(res.at).toLocaleString())}</small></p>` : '') + table + detail;
    }

    async function run(selected) {
      running = true;
      stop = false;
      $('[data-a=start]').disabled = true;
      $('[data-a=stop]').hidden = false;
      res = { at: Date.now(), cases: cases.length, models: {} };
      last = null;
      const sys = opts.systemPrompt(lang);
      let lib = null;
      let engine = null;
      try {
        await opts.before?.();
        for (const k of selected) {
          if (stop) break;
          res.models[k] = { answers: [] };
          let ask;
          if (k === 'chrome') {
            ask = (user) => opts.chrome.ask(sys, user);
          } else {
            lib = lib || (await opts.lib());
            state(T('loading', label(k), 0));
            engine?.unload?.();
            engine = await lib.CreateMLCEngine(modelId(k, opts.f16), {
              initProgressCallback: (r) => state(T('loading', label(k), Math.round((r.progress || 0) * 100))),
            });
            ask = async function* (user) {
              const stream = await engine.chat.completions.create({
                messages: [{ role: 'system', content: sys }, { role: 'user', content: user }],
                stream: true, stream_options: { include_usage: true }, temperature: 0.3, max_tokens: 450, ...genOpts(k),
              });
              for await (const c of stream) {
                if (c.usage) yield { usage: c.usage };
                const d = c.choices?.[0]?.delta?.content;
                if (d) yield d;
              }
            };
          }
          for (let i = 0; i < cases.length && !stop; i++) {
            state(T('asking', label(k), i + 1, cases.length));
            const c = cases[i];
            const user = `${c.question}\n\n${c.listing}`;
            const t0 = performance.now();
            let first = null;
            let text = '';
            let tps = null;
            try {
              for await (const p of ask(user)) {
                if (stop) break;
                if (typeof p === 'object') {
                  tps = p.usage?.extra?.decode_tokens_per_s ?? null;
                  continue;
                }
                if (first == null && stripThink(text + p)) first = performance.now() - t0;
                text += p;
              }
            } catch (e) {
              text += '\n' + T('err', e.message || e);
            }
            text = stripThink(text);
            res.models[k].answers[i] = { text, first, total: performance.now() - t0, tps, hit: hit(text, c.expect), score: null };
            keep();
            render();
          }
        }
        state(stop ? '' : T('done'));
      } catch (e) {
        state(T('err', e.message || e));
      } finally {
        engine?.unload?.();
        running = false;
        $('[data-a=start]').disabled = false;
        $('[data-a=stop]').hidden = true;
        keep();
        render();
        await opts.after?.();
      }
    }

    back.addEventListener('click', async (e) => {
      const a = e.target.closest('[data-a]')?.dataset.a;
      const rate = e.target.closest('[data-rate]')?.dataset.rate;
      const use = e.target.closest('[data-use]')?.dataset.use;
      if (rate && res) {
        const [k, i, v] = rate.split('|');
        const ans = res.models[k]?.answers?.[+i];
        if (ans) {
          ans.score = ans.score === +v ? null : +v;
          keep();
          render();
        }
        return;
      }
      if (use) {
        back.remove();
        opts.onUse?.(use);
        return;
      }
      if (a === 'start' && !running) {
        const sel = [...back.querySelectorAll('.rmb-pick input:checked')].map((x) => x.value);
        if (sel.length) run(sel);
      } else if (a === 'stop') {
        stop = true;
      } else if (a === 'copy' && res) {
        const lines = [T('title') + ' · ' + new Date(res.at).toLocaleString(), [T('model'), T('lines'), T('first'), T('total'), T('speed'), T('score')].join('\t')];
        for (const k of Object.keys(res.models)) {
          const s = summary(k);
          lines.push([label(k) || k, `${s.hits}/${s.n}`, sec(s.first), sec(s.total), s.tps == null ? '-' : s.tps.toFixed(1), s.score == null ? '-' : s.score.toFixed(1)].join('\t'));
        }
        try {
          await navigator.clipboard.writeText(lines.join('\n'));
          opts.toast?.(T('copied'));
        } catch (err) {
          /* 무시 */
        }
      } else if ((a === 'close' || e.target === back) && !running) {
        back.remove();
      }
    });
    render();
    return back;
  }

  window.RMTutorBench = { MODELS, key, modelId, genOpts, stripThink, rows, label: (k, lang) => tx(key(k), lang), desc: (k, lang) => (TX[key(k) + 'D'] ? tx(key(k) + 'D', lang) : ''), text: tx, citedLines, hit, open };
})();

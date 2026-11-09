// aicam.js — 웹캠 AI 카메라 (MediaPipe)
//   손 제스처 · 스켈레톤 · 사물 인식(COCO 80종) · 사물 학습(이미지 특징 + kNN) · 색 인식 · 색 학습(색 덩어리 추적)
// 계산은 모두 이 컴퓨터(브라우저) 안에서만 하고, 결과 숫자만 허브로 보낼 프레임으로 만듭니다.

const MP_VERSION = '1.2.2';
const MP_BASE = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}`;
const MODELS = 'https://storage.googleapis.com/mediapipe-models';
const GESTURE_MODEL = `${MODELS}/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task`;
const POSE_MODEL = `${MODELS}/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task`;
const OBJECT_MODEL = `${MODELS}/object_detector/efficientdet_lite0/float16/1/efficientdet_lite0.tflite`;
const EMBED_MODEL = `${MODELS}/image_embedder/mobilenet_v3_small/float32/1/mobilenet_v3_small.tflite`;
/** 인터넷 없이 AI 카메라를 쓰려고 미리 받아 둘 파일 (설치 창의 「AI 카메라 모델도 받아 두기」) */
export const OFFLINE_URLS = [
  `${MP_BASE}/vision_bundle.mjs`,
  `${MP_BASE}/wasm/vision_wasm_internal.js`,
  `${MP_BASE}/wasm/vision_wasm_internal.wasm`,
  GESTURE_MODEL, POSE_MODEL, OBJECT_MODEL, EMBED_MODEL,
];

export const GESTURE_IDS = {
  None: 0, Closed_Fist: 1, Open_Palm: 2, Pointing_Up: 3,
  Thumb_Down: 4, Thumb_Up: 5, Victory: 6, ILoveYou: 7,
};

// COCO 80종 (EfficientDet-Lite0 라벨). 허브로 보내는 사물 번호 = 이 목록의 순서 + 1 (0 = 없음)
export const COCO = [
  'person', 'bicycle', 'car', 'motorcycle', 'airplane', 'bus', 'train', 'truck', 'boat', 'traffic light',
  'fire hydrant', 'stop sign', 'parking meter', 'bench', 'bird', 'cat', 'dog', 'horse', 'sheep', 'cow',
  'elephant', 'bear', 'zebra', 'giraffe', 'backpack', 'umbrella', 'handbag', 'tie', 'suitcase', 'frisbee',
  'skis', 'snowboard', 'sports ball', 'kite', 'baseball bat', 'baseball glove', 'skateboard', 'surfboard', 'tennis racket', 'bottle',
  'wine glass', 'cup', 'fork', 'knife', 'spoon', 'bowl', 'banana', 'apple', 'sandwich', 'orange',
  'broccoli', 'carrot', 'hot dog', 'pizza', 'donut', 'cake', 'chair', 'couch', 'potted plant', 'bed',
  'dining table', 'toilet', 'tv', 'laptop', 'mouse', 'remote', 'keyboard', 'cell phone', 'microwave', 'oven',
  'toaster', 'sink', 'refrigerator', 'book', 'clock', 'vase', 'scissors', 'teddy bear', 'hair drier', 'toothbrush',
];
export const cocoId = (name) => COCO.indexOf(name) + 1;
// 블록 목록에 보여 줄 교실에서 흔한 사물 (번역: 언어 파일의 coco.<이름>)
export const OBJ_PICK = [
  'person', 'cup', 'bottle', 'sports ball', 'book', 'cell phone', 'scissors', 'teddy bear', 'apple', 'banana',
  'orange', 'chair', 'backpack', 'umbrella', 'laptop', 'keyboard', 'mouse', 'clock', 'cat', 'dog', 'car',
];

// 색 번호 (허브 rm_aicam 과 같게): 0 없음 1 빨강 2 주황 3 노랑 4 초록 5 하늘 6 파랑 7 보라 8 자홍 9 흰색 10 검정
export const COLOR_IDS = ['NONE', 'RED', 'ORANGE', 'YELLOW', 'GREEN', 'CYAN', 'BLUE', 'VIOLET', 'MAGENTA', 'WHITE', 'BLACK'];
export const COLOR_CSS = ['#888', '#E5484D', '#F76B15', '#FFC53D', '#30A46C', '#05A2C2', '#0090FF', '#8E4EC6', '#D6409F', '#FFFFFF', '#111111'];

export const TEACH_CLASSES = 5;
export const COLOR_SLOTS = 5;
const MAX_SAMPLES = 100;
const TEACH_KEY = 'rm-teach-v1';
const COLOR_KEY = 'rm-colors-v1';
const HEAVY = ['hand', 'pose', 'object', 'teach'];

const pct = (v) => Math.max(0, Math.min(100, Math.round(v * 100)));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

function rgb2hsv(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d) {
    if (mx === r) h = ((g - b) / d) % 6;
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, mx ? d / mx : 0, mx];
}

/** RGB → 색 번호 (COLOR_IDS) */
export function classifyColor(r, g, b) {
  const [h, s, v] = rgb2hsv(r, g, b);
  if (v < 0.22) return 10;
  if (s < 0.22) return v > 0.7 ? 9 : 0;
  if (h < 12 || h >= 340) return 1;
  if (h < 40) return 2;
  if (h < 70) return 3;
  if (h < 160) return 4;
  if (h < 195) return 5;
  if (h < 255) return 6;
  if (h < 290) return 7;
  return 8;
}

const hueDiff = (a, b) => {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
};

// Int8 로 줄여 저장 (L2 정규화된 특징이므로 -1~1)
const packEmb = (f) => {
  const q = Int8Array.from(f, (x) => Math.max(-127, Math.min(127, Math.round(x * 127))));
  return btoa(String.fromCharCode(...new Uint8Array(q.buffer)));
};
const unpackEmb = (s) => Float32Array.from(atob(s), (c) => ((c.charCodeAt(0) << 24) >> 24) / 127);

export class AICamera {
  constructor(video, canvas) {
    this.video = video;
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.modes = new Set(['hand']);
    this.running = false;
    this.models = {};
    this.onUpdate = () => {};
    this._lastTime = -1;
    this._turn = 0;
    this.recording = -1; // 학습 중인 사물 번호(0~4), -1 = 아님
    this.labelOf = (name) => name; // 화면에 쓸 사물 이름 (번역은 app.js 가 넣어 줌)
    this.teachNames = (i) => `#${i + 1}`;
    this._resetResults();
    this.small = document.createElement('canvas');
    this.small.width = 80;
    this.small.height = 60;
    this.sctx = this.small.getContext('2d', { willReadFrequently: true });
    this.teach = Array.from({ length: TEACH_CLASSES }, () => []);
    this.colors = Array(COLOR_SLOTS).fill(null);
    this._loadSaved();
  }

  _resetResults() {
    this.hand = [0, 0, 50, 50, 0];
    this.body = [0, 50, 50, 0, 0, 50, 0, 0];
    this.objects = [];
    this.taught = { id: 0, conf: 0 };
    this.center = { id: 0, r: 0, g: 0, b: 0 };
    this.blobs = Array.from({ length: COLOR_SLOTS }, () => ({ seen: 0, x: 50, y: 50, size: 0 }));
    this._lastHandLm = null;
    this._lastPoseLm = null;
  }

  // ───────────── 저장 / 불러오기 (학습 결과는 이 브라우저에 자동 저장) ─────────────
  _loadSaved() {
    try {
      const t = JSON.parse(localStorage.getItem(TEACH_KEY) || 'null');
      if (t) this.teach = t.map((c) => c.map(unpackEmb)).concat([[], [], [], [], []]).slice(0, TEACH_CLASSES);
      const c = JSON.parse(localStorage.getItem(COLOR_KEY) || 'null');
      if (c) this.colors = c.concat(Array(COLOR_SLOTS).fill(null)).slice(0, COLOR_SLOTS);
    } catch (e) {
      /* 저장된 것이 없거나 손상됨 */
    }
  }

  saveTeach() {
    try {
      localStorage.setItem(TEACH_KEY, JSON.stringify(this.teach.map((c) => c.map(packEmb))));
    } catch (e) {
      /* 저장 공간 부족 */
    }
  }

  saveColors() {
    try {
      localStorage.setItem(COLOR_KEY, JSON.stringify(this.colors));
    } catch (e) {
      /* 무시 */
    }
  }

  /** 학습 결과를 파일로 내보낼 데이터 */
  exportData(names) {
    return { app: 'robomakers-wordblock-ai', version: 1, names, teach: this.teach.map((c) => c.map(packEmb)), colors: this.colors };
  }

  importData(d) {
    if (!d || d.app !== 'robomakers-wordblock-ai') throw new Error('not a RoboMakers AI file');
    this.teach = (d.teach || []).map((c) => c.map(unpackEmb)).concat([[], [], [], [], []]).slice(0, TEACH_CLASSES);
    this.colors = (d.colors || []).concat(Array(COLOR_SLOTS).fill(null)).slice(0, COLOR_SLOTS);
    this.saveTeach();
    this.saveColors();
    return d.names || null;
  }

  clearTeach(i) {
    if (i == null) this.teach = Array.from({ length: TEACH_CLASSES }, () => []);
    else this.teach[i] = [];
    this.saveTeach();
  }

  clearColor(i) {
    this.colors[i] = null;
    this.saveColors();
  }

  /** 화면 가운데 색을 i 번 학습 색으로 저장 */
  learnCenterColor(i) {
    const c = this._centerRGB();
    if (!c) return false;
    const [h, s, v] = rgb2hsv(c.r, c.g, c.b);
    this.colors[i] = { h: Math.round(h), s: +s.toFixed(2), v: +v.toFixed(2), rgb: `rgb(${c.r},${c.g},${c.b})` };
    this.saveColors();
    return true;
  }

  // ───────────── 모델 ─────────────
  async _vision() {
    if (!this.vision) {
      this.vision = await import(`${MP_BASE}/vision_bundle.mjs`);
      this.files = await this.vision.FilesetResolver.forVisionTasks(`${MP_BASE}/wasm`);
      this.draw = new this.vision.DrawingUtils(this.ctx);
    }
    return this.vision;
  }

  async _make(Cls, model, opts) {
    const base = (delegate) => ({ baseOptions: { modelAssetPath: model, delegate }, runningMode: 'VIDEO', ...opts });
    try {
      return await Cls.createFromOptions(this.files, base('GPU'));
    } catch (e) {
      return await Cls.createFromOptions(this.files, base('CPU'));
    }
  }

  async _load() {
    const v = await this._vision();
    const m = this.models;
    if (this.modes.has('hand') && !m.hand) m.hand = await this._make(v.GestureRecognizer, GESTURE_MODEL, { numHands: 1 });
    if (this.modes.has('pose') && !m.pose) m.pose = await this._make(v.PoseLandmarker, POSE_MODEL, { numPoses: 1 });
    if (this.modes.has('object') && !m.object) m.object = await this._make(v.ObjectDetector, OBJECT_MODEL, { scoreThreshold: 0.4, maxResults: 5 });
    if (this.modes.has('teach') && !m.teach) m.teach = await this._make(v.ImageEmbedder, EMBED_MODEL, { l2Normalize: true, quantize: false });
  }

  /** @param {Iterable<string>} modes 'hand' 'pose' 'object' 'teach' 'color' */
  async setModes(modes) {
    this.modes = new Set(modes);
    if (this.running) await this._load();
  }

  async start() {
    if (!this.stream) {
      this.stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: 'user' }, audio: false });
      this.video.srcObject = this.stream;
      await this.video.play();
    }
    await this._load();
    this.running = true;
    this._loop();
  }

  stop() {
    this.running = false;
    this.recording = -1;
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
    this.video.srcObject = null;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this._resetResults();
  }

  // ───────────── 반복 ─────────────
  _loop() {
    if (!this.running) return;
    const v = this.video;
    const now = performance.now();
    // 최대 초당 15회만 계산해 화면·블록 편집이 끊기지 않게 합니다.
    if (v.readyState >= 2 && v.currentTime !== this._lastTime && now - (this._lastRun || 0) >= 66) {
      this._lastTime = v.currentTime;
      this._lastRun = now;
      if (this.canvas.width !== v.videoWidth) {
        this.canvas.width = v.videoWidth;
        this.canvas.height = v.videoHeight;
      }
      try {
        // 무거운 모델은 돌아가며 하나씩 (학습 사진을 모을 때는 학습 모델 우선)
        const heavy = HEAVY.filter((k) => this.modes.has(k) && this.models[k]);
        let pick = heavy.length ? heavy[this._turn++ % heavy.length] : null;
        if (this.recording >= 0 && this.models.teach) pick = 'teach';
        if (pick === 'hand') this._hand(this.models.hand.recognizeForVideo(v, now));
        if (pick === 'pose') this._pose(this.models.pose.detectForVideo(v, now));
        if (pick === 'object') this._object(this.models.object.detectForVideo(v, now));
        if (pick === 'teach') this._teach(this.models.teach.embedForVideo(v, now));
        if (this.modes.has('color')) this._color();
        if (!this.modes.has('hand')) this.hand = [0, 0, 50, 50, 0];
        if (!this.modes.has('pose')) this.body = [0, 50, 50, 0, 0, 50, 0, 0];
        this._render();
      } catch (e) {
        console.warn(e);
      }
      this.onUpdate(this);
    }
    requestAnimationFrame(() => this._loop());
  }

  // ───────────── 손 · 스켈레톤 ─────────────
  _hand(res) {
    const lm = res.landmarks && res.landmarks[0];
    this._lastHandLm = lm || null;
    if (!lm) {
      this.hand = [0, 0, 50, 50, 0];
      return;
    }
    const name = res.gestures?.[0]?.[0]?.categoryName || 'None';
    const g = GESTURE_IDS[name] ?? 0;
    const w = lm[0];
    let fingers = 0;
    for (const [tip, pip] of [[8, 6], [12, 10], [16, 14], [20, 18]]) {
      if (dist(lm[tip], w) > dist(lm[pip], w) * 1.1) fingers++;
    }
    if (dist(lm[4], lm[17]) > dist(lm[3], lm[17]) * 1.08 && dist(lm[4], lm[5]) > dist(lm[2], lm[5]) * 0.9) fingers++;
    const c = lm[9];
    // 화면은 거울처럼 보이므로 X 를 뒤집습니다 (손을 오른쪽으로 → X 증가)
    this.hand = [1, g, pct(1 - c.x), pct(c.y), fingers];
  }

  _pose(res) {
    const lm = res.landmarks && res.landmarks[0];
    this._lastPoseLm = lm || null;
    if (!lm) {
      this.body = [0, 50, 50, 0, 0, 50, 0, 0];
      return;
    }
    const vis = (p) => (p.visibility ?? 1) > 0.5;
    const nose = lm[0], ls = lm[11], rs = lm[12], lw = lm[15], rw = lm[16];
    const shoulderY = (ls.y + rs.y) / 2;
    const sw = Math.abs(ls.x - rs.x) || 0.01;
    const leftUp = vis(lw) && lw.y < Math.min(nose.y, shoulderY - sw * 0.3) ? 1 : 0;
    const rightUp = vis(rw) && rw.y < Math.min(nose.y, shoulderY - sw * 0.3) ? 1 : 0;
    const spread = vis(lw) && vis(rw) && Math.abs(lw.y - ls.y) < sw * 0.6 && Math.abs(rw.y - rs.y) < sw * 0.6 && Math.abs(lw.x - rw.x) > sw * 2.2 ? 1 : 0;
    const tilt = Math.round((Math.atan2(rs.y - ls.y, sw) * 180) / Math.PI);
    this.body = [1, pct(1 - nose.x), pct(nose.y), leftUp, rightUp, pct(1 - (ls.x + rs.x) / 2), tilt, spread];
  }

  // ───────────── 사물 인식 ─────────────
  _object(res) {
    const W = this.canvas.width, Hh = this.canvas.height;
    this.objects = (res.detections || [])
      .map((d) => {
        const c = d.categories?.[0];
        const b = d.boundingBox;
        if (!c || !b) return null;
        const id = cocoId(c.categoryName);
        if (!id) return null;
        return {
          id, name: c.categoryName, score: Math.round(c.score * 100), box: b,
          x: pct(1 - (b.originX + b.width / 2) / W), y: pct((b.originY + b.height / 2) / Hh),
          size: pct(Math.max(b.width / W, b.height / Hh)),
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
  }

  // ───────────── 사물 학습 (특징 + 가장 가까운 이웃) ─────────────
  _teach(res) {
    const e = res.embeddings?.[0]?.floatEmbedding;
    if (!e) return;
    const emb = Float32Array.from(e);
    if (this.recording >= 0) {
      const list = this.teach[this.recording];
      list.push(emb);
      if (list.length > MAX_SAMPLES) list.splice(0, list.length - MAX_SAMPLES);
      this._dirty = true;
    }
    const all = [];
    this.teach.forEach((list, ci) => list.forEach((s) => all.push([ci, s])));
    if (!all.length) {
      this.taught = { id: 0, conf: 0 };
      return;
    }
    const sims = all.map(([ci, s]) => {
      let d = 0;
      for (let i = 0; i < s.length && i < emb.length; i++) d += s[i] * emb[i];
      return [ci, d];
    });
    sims.sort((a, b) => b[1] - a[1]);
    const k = Math.min(5, sims.length);
    const votes = new Array(TEACH_CLASSES).fill(0);
    for (let i = 0; i < k; i++) votes[sims[i][0]] += 1;
    const best = votes.indexOf(Math.max(...votes));
    this.taught = { id: best + 1, conf: Math.round((votes[best] / k) * 100) };
  }

  finishRecording() {
    this.recording = -1;
    if (this._dirty) this.saveTeach();
    this._dirty = false;
  }

  // ───────────── 색 인식 · 색 학습 ─────────────
  _centerRGB() {
    const v = this.video;
    if (v.readyState < 2) return null;
    this.sctx.drawImage(v, 0, 0, 80, 60);
    const d = this.sctx.getImageData(34, 24, 12, 12).data;
    let r = 0, g = 0, b = 0;
    for (let i = 0; i < d.length; i += 4) {
      r += d[i]; g += d[i + 1]; b += d[i + 2];
    }
    const n = d.length / 4;
    return { r: Math.round(r / n), g: Math.round(g / n), b: Math.round(b / n) };
  }

  _color() {
    const c = this._centerRGB();
    if (!c) return;
    this.center = { id: classifyColor(c.r, c.g, c.b), ...c };
    const learned = this.colors.map((x, i) => [x, i]).filter(([x]) => x);
    if (!learned.length) return;
    const img = this.sctx.getImageData(0, 0, 80, 60).data;
    const W = 80, H = 60, N = W * H;
    const hsv = new Float32Array(N * 3);
    for (let p = 0; p < N; p++) {
      const [h, s, v] = rgb2hsv(img[p * 4], img[p * 4 + 1], img[p * 4 + 2]);
      hsv[p * 3] = h; hsv[p * 3 + 1] = s; hsv[p * 3 + 2] = v;
    }
    for (const [ref, slot] of learned) {
      const gray = ref.s < 0.22;
      const mask = new Uint8Array(N);
      for (let p = 0; p < N; p++) {
        const h = hsv[p * 3], s = hsv[p * 3 + 1], v = hsv[p * 3 + 2];
        mask[p] = gray
          ? s < 0.25 && Math.abs(v - ref.v) < 0.18
          : s > 0.25 && hueDiff(h, ref.h) < 16 && Math.abs(s - ref.s) < 0.4 && Math.abs(v - ref.v) < 0.45;
      }
      // 가장 큰 덩어리 찾기
      const seen = new Uint8Array(N);
      let best = null;
      const stack = new Int32Array(N);
      for (let p0 = 0; p0 < N; p0++) {
        if (!mask[p0] || seen[p0]) continue;
        let top = 0, cnt = 0, sx = 0, sy = 0, x0 = W, y0 = H, x1 = 0, y1 = 0;
        stack[top++] = p0;
        seen[p0] = 1;
        while (top) {
          const p = stack[--top];
          const x = p % W, y = (p / W) | 0;
          cnt++; sx += x; sy += y;
          if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
          for (const q of [p - 1, p + 1, p - W, p + W]) {
            if (q < 0 || q >= N || seen[q] || !mask[q]) continue;
            if ((q === p - 1 && x === 0) || (q === p + 1 && x === W - 1)) continue;
            seen[q] = 1;
            stack[top++] = q;
          }
        }
        if (!best || cnt > best.cnt) best = { cnt, sx, sy, x0, y0, x1, y1 };
      }
      const b = this.blobs[slot];
      if (best && best.cnt >= N * 0.004) {
        b.seen = 1;
        b.x = Math.round(100 - ((best.sx / best.cnt + 0.5) / W) * 100);
        b.y = Math.round(((best.sy / best.cnt + 0.5) / H) * 100);
        b.size = Math.min(100, Math.round((best.cnt / N) * 100 * 10) / 10);
        b.box = best;
      } else {
        b.seen = 0;
        b.size = 0;
        b.box = null;
      }
    }
    this.colors.forEach((x, i) => {
      if (!x) this.blobs[i] = { seen: 0, x: 50, y: 50, size: 0 };
    });
  }

  // ───────────── 그리기 (캔버스는 CSS 로 거울처럼 뒤집혀 있음) ─────────────
  _label(text, x, y, bg) {
    const ctx = this.ctx, W = this.canvas.width;
    ctx.save();
    ctx.setTransform(-1, 0, 0, 1, W, 0); // 글자만 다시 뒤집어 바르게 보이게
    ctx.font = 'bold 18px Pretendard, sans-serif';
    const tw = ctx.measureText(text).width;
    const X = W - x;
    ctx.fillStyle = bg;
    ctx.fillRect(X - 2, y - 20, tw + 10, 24);
    ctx.fillStyle = '#fff';
    ctx.fillText(text, X + 3, y - 2);
    ctx.restore();
  }

  _render() {
    const ctx = this.ctx, W = this.canvas.width, H = this.canvas.height;
    ctx.clearRect(0, 0, W, H);
    const V = this.vision;
    if (this.modes.has('hand') && this._lastHandLm && V) {
      this.draw.drawConnectors(this._lastHandLm, V.GestureRecognizer.HAND_CONNECTIONS, { color: '#00E0B0', lineWidth: 4 });
      this.draw.drawLandmarks(this._lastHandLm, { color: '#FFFFFF', fillColor: '#00A88F', radius: 4 });
    }
    if (this.modes.has('pose') && this._lastPoseLm && V) {
      this.draw.drawConnectors(this._lastPoseLm, V.PoseLandmarker.POSE_CONNECTIONS, { color: '#FFBF00', lineWidth: 4 });
      this.draw.drawLandmarks(this._lastPoseLm, { color: '#FFFFFF', fillColor: '#FF4CCD', radius: 3 });
    }
    if (this.modes.has('object')) {
      for (const o of this.objects) {
        ctx.strokeStyle = '#2E6ABF';
        ctx.lineWidth = 4;
        ctx.strokeRect(o.box.originX, o.box.originY, o.box.width, o.box.height);
        this._label(`${this.labelOf(o.name)} ${o.score}%`, o.box.originX + o.box.width, o.box.originY + 2, '#2E6ABF');
      }
    }
    if (this.modes.has('color')) {
      const sx = W / 80, sy = H / 60;
      this.blobs.forEach((b, i) => {
        if (!b.seen || !b.box) return;
        const c = this.colors[i];
        ctx.strokeStyle = c ? c.rgb : '#fff';
        ctx.lineWidth = 5;
        ctx.strokeRect(b.box.x0 * sx, b.box.y0 * sy, (b.box.x1 - b.box.x0 + 1) * sx, (b.box.y1 - b.box.y0 + 1) * sy);
        this._label(`#${i + 1}`, (b.box.x1 + 1) * sx, b.box.y0 * sy + 2, '#1E2A44');
      });
      // 가운데 조준점 (색 인식·색 학습 위치)
      const cx = W / 2, cy = H / 2, r = Math.min(W, H) * 0.1;
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 3;
      ctx.strokeRect(cx - r, cy - r, r * 2, r * 2);
      ctx.strokeStyle = COLOR_CSS[this.center.id] || '#fff';
      ctx.lineWidth = 2;
      ctx.strokeRect(cx - r + 4, cy - r + 4, r * 2 - 8, r * 2 - 8);
    }
    if (this.modes.has('teach') && this.taught.id) {
      this._label(`${this.teachNames(this.taught.id - 1)} ${this.taught.conf}%`, W - 12, 34, '#00A88F');
    }
  }

  // ───────────── 허브로 보낼 프레임 ─────────────
  frame() {
    let s = '';
    if (this.modes.has('hand')) s += 'H:' + this.hand.join(',') + '\n';
    if (this.modes.has('pose')) s += 'P:' + this.body.join(',') + '\n';
    if (this.modes.has('object')) {
      const o = [this.objects.length];
      for (let i = 0; i < 3; i++) {
        const d = this.objects[i];
        o.push(...(d ? [d.id, d.x, d.y, d.size, d.score] : [0, 0, 0, 0, 0]));
      }
      s += 'O:' + o.join(',') + '\n';
    }
    if (this.modes.has('teach')) s += `T:${this.taught.id},${this.taught.conf}\n`;
    if (this.modes.has('color')) {
      s += `C:${this.center.id},${this.center.r},${this.center.g},${this.center.b}\n`;
      s += 'K:' + this.blobs.map((b) => [b.seen, b.x, b.y, Math.round(b.size)].join(',')).join(',') + '\n';
    }
    return s;
  }
}

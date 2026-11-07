// aicam.js — 웹캠 AI 카메라 (MediaPipe 손 제스처 · 스켈레톤)
// 계산 결과를 허브로 보낼 프레임 문자열(H:..., P:...)로 만듭니다.

const MP_VERSION = '1.2.2';
const MP_BASE = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}`;
const GESTURE_MODEL = 'https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task';
const POSE_MODEL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';

export const GESTURE_IDS = {
  None: 0, Closed_Fist: 1, Open_Palm: 2, Pointing_Up: 3,
  Thumb_Down: 4, Thumb_Up: 5, Victory: 6, ILoveYou: 7,
};
// 화면 표시용 이름은 언어 파일의 g.0 ~ g.7

const pct = (v) => Math.max(0, Math.min(100, Math.round(v * 100)));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export class AICamera {
  constructor(video, canvas) {
    this.video = video;
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.mode = 'hand';
    this.running = false;
    this.gesture = null;
    this.pose = null;
    this.hand = [0, 0, 50, 50, 0];
    this.body = [0, 50, 50, 0, 0, 50, 0, 0];
    this.onUpdate = () => {};
    this._lastTime = -1;
    this._flip = 0;
  }

  async _load(mode) {
    const vision = await import(`${MP_BASE}/vision_bundle.mjs`);
    this.vision = vision;
    const files = await vision.FilesetResolver.forVisionTasks(`${MP_BASE}/wasm`);
    const make = async (Cls, model, opts) => {
      try {
        return await Cls.createFromOptions(files, { baseOptions: { modelAssetPath: model, delegate: 'GPU' }, runningMode: 'VIDEO', ...opts });
      } catch (e) {
        return await Cls.createFromOptions(files, { baseOptions: { modelAssetPath: model, delegate: 'CPU' }, runningMode: 'VIDEO', ...opts });
      }
    };
    if ((mode === 'hand' || mode === 'both') && !this.gesture) {
      this.gesture = await make(vision.GestureRecognizer, GESTURE_MODEL, { numHands: 1 });
    }
    if ((mode === 'pose' || mode === 'both') && !this.pose) {
      this.pose = await make(vision.PoseLandmarker, POSE_MODEL, { numPoses: 1 });
    }
    this.draw = new vision.DrawingUtils(this.ctx);
  }

  /** @param {'hand'|'pose'|'both'} mode */
  async start(mode = 'hand') {
    this.mode = mode;
    if (!this.stream) {
      this.stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: 'user' }, audio: false });
      this.video.srcObject = this.stream;
      await this.video.play();
    }
    await this._load(mode);
    this.running = true;
    this._loop();
  }

  setMode(mode) {
    this.mode = mode;
    if (this.running) this._load(mode);
  }

  stop() {
    this.running = false;
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
    this.video.srcObject = null;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.hand = [0, 0, 50, 50, 0];
    this.body = [0, 50, 50, 0, 0, 50, 0, 0];
  }

  _loop() {
    if (!this.running) return;
    const v = this.video;
    const t = performance.now();
    // 최대 초당 15회만 계산해 화면·블록 편집이 끊기지 않게 합니다.
    if (v.readyState >= 2 && v.currentTime !== this._lastTime && t - (this._lastRun || 0) >= 66) {
      this._lastTime = v.currentTime;
      this._lastRun = t;
      if (this.canvas.width !== v.videoWidth) {
        this.canvas.width = v.videoWidth;
        this.canvas.height = v.videoHeight;
      }
      const now = performance.now();
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      // 둘 다 켜면 프레임마다 번갈아 계산해 부담을 줄입니다.
      const doHand = this.gesture && (this.mode === 'hand' || (this.mode === 'both' && this._flip % 2 === 0));
      const doPose = this.pose && (this.mode === 'pose' || (this.mode === 'both' && this._flip % 2 === 1));
      this._flip++;
      try {
        if (doHand) this._hand(this.gesture.recognizeForVideo(v, now));
        else if (this.mode === 'both' && this._lastHandLm) this._drawHand(this._lastHandLm);
        if (doPose) this._pose(this.pose.detectForVideo(v, now));
        else if (this.mode === 'both' && this._lastPoseLm) this._drawPose(this._lastPoseLm);
        if (this.mode === 'pose') this.hand[0] = 0;
        if (this.mode === 'hand') this.body[0] = 0;
      } catch (e) {
        console.warn(e);
      }
      this.onUpdate(this);
    }
    requestAnimationFrame(() => this._loop());
  }

  _drawHand(lm) {
    const H = this.vision.GestureRecognizer.HAND_CONNECTIONS;
    this.draw.drawConnectors(lm, H, { color: '#00E0B0', lineWidth: 4 });
    this.draw.drawLandmarks(lm, { color: '#FFFFFF', fillColor: '#00A88F', radius: 4 });
  }

  _drawPose(lm) {
    const P = this.vision.PoseLandmarker.POSE_CONNECTIONS;
    this.draw.drawConnectors(lm, P, { color: '#FFBF00', lineWidth: 4 });
    this.draw.drawLandmarks(lm, { color: '#FFFFFF', fillColor: '#FF4CCD', radius: 3 });
  }

  _hand(res) {
    const lm = res.landmarks && res.landmarks[0];
    if (!lm) {
      this._lastHandLm = null;
      this.hand = [0, 0, 50, 50, 0];
      return;
    }
    this._lastHandLm = lm;
    this._drawHand(lm);
    const name = res.gestures?.[0]?.[0]?.categoryName || 'None';
    const g = GESTURE_IDS[name] ?? 0;
    // 손가락 펼침: 손끝이 손목에서 PIP 관절보다 멀면 펼친 것
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
    if (!lm) {
      this._lastPoseLm = null;
      this.body = [0, 50, 50, 0, 0, 50, 0, 0];
      return;
    }
    this._lastPoseLm = lm;
    this._drawPose(lm);
    const vis = (p) => (p.visibility ?? 1) > 0.5;
    const nose = lm[0], ls = lm[11], rs = lm[12], lw = lm[15], rw = lm[16];
    const shoulderY = (ls.y + rs.y) / 2;
    const sw = Math.abs(ls.x - rs.x) || 0.01;
    const leftUp = vis(lw) && lw.y < Math.min(nose.y, shoulderY - sw * 0.3) ? 1 : 0;
    const rightUp = vis(rw) && rw.y < Math.min(nose.y, shoulderY - sw * 0.3) ? 1 : 0;
    const spread = vis(lw) && vis(rw) && Math.abs(lw.y - ls.y) < sw * 0.6 && Math.abs(rw.y - rs.y) < sw * 0.6 && Math.abs(lw.x - rw.x) > sw * 2.2 ? 1 : 0;
    const bodyX = pct(1 - (ls.x + rs.x) / 2);
    const tilt = Math.round((Math.atan2(rs.y - ls.y, sw) * 180) / Math.PI);
    this.body = [1, pct(1 - nose.x), pct(nose.y), leftUp, rightUp, bodyX, tilt, spread];
  }

  /** 허브로 보낼 문자열 */
  frame() {
    let s = '';
    if (this.mode === 'hand' || this.mode === 'both') s += 'H:' + this.hand.join(',') + '\n';
    if (this.mode === 'pose' || this.mode === 'both') s += 'P:' + this.body.join(',') + '\n';
    return s;
  }
}

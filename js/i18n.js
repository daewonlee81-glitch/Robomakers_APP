// i18n.js — 다국어 지원
// 새 언어 추가: js/lang/<코드>.js 를 만들고 아래 LANGS 에 한 줄 추가 (vendor/blockly/msg 에 Blockly 기본 메시지도 복사)

export const LANGS = [
  { code: 'ko', name: '한국어', blockly: 'ko', html: 'ko' },
  { code: 'en', name: 'English', blockly: 'en', html: 'en' },
  { code: 'ja', name: '日本語', blockly: 'ja', html: 'ja' },
  { code: 'zh-CN', name: '简体中文', blockly: 'zh-hans', html: 'zh-Hans' },
  { code: 'zh-TW', name: '繁體中文', blockly: 'zh-hant', html: 'zh-Hant' },
  { code: 'es', name: 'Español', blockly: 'es', html: 'es' },
  { code: 'th', name: 'ไทย', blockly: 'th', html: 'th' },
];

import COCO_NAMES from './lang/coco.js?v=0.3.2';

const KEY = 'rm-lang';
let lang = 'ko';
let dict = {};
let fallback = {};

function detect() {
  const params = new URLSearchParams(location.search);
  const want = params.get('lang');
  if (want && LANGS.some((l) => l.code === want)) return want;
  try {
    const saved = localStorage.getItem(KEY);
    if (saved && LANGS.some((l) => l.code === saved)) return saved;
  } catch (e) {
    /* 저장 공간 없음 */
  }
  for (const n of navigator.languages || [navigator.language || 'ko']) {
    const low = n.toLowerCase();
    if (low.startsWith('zh')) return /tw|hk|mo|hant/.test(low) ? 'zh-TW' : 'zh-CN';
    const hit = LANGS.find((l) => low.startsWith(l.code));
    if (hit) return hit.code;
  }
  return 'ko';
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error('load ' + src));
    document.head.appendChild(s);
  });
}

/** 언어를 정하고 번역 파일 + Blockly 기본 메시지를 불러옵니다. 블록 정의 전에 호출. */
export async function initLang() {
  lang = detect();
  const info = LANGS.find((l) => l.code === lang);
  fallback = (await import('./lang/en.js?v=0.3.2')).default;
  dict = lang === 'en' ? fallback : (await import(`./lang/${lang}.js?v=0.3.2`)).default;
  await loadScript(new URL(`../vendor/blockly/msg/${info.blockly}.js?v=0.3.2`, import.meta.url).href);
  document.documentElement.lang = info.html;
  return lang;
}

export function getLang() {
  return lang;
}

export function setLang(code) {
  try {
    localStorage.setItem(KEY, code);
  } catch (e) {
    /* 무시 */
  }
}

/** 번역: t('key', 값0, 값1 …) — 문자열 안의 {0} {1} 을 채웁니다. 없으면 영어, 그래도 없으면 키. */
export function t(key, ...args) {
  let s = dict[key] ?? fallback[key] ?? key;
  args.forEach((a, i) => (s = s.split(`{${i}}`).join(String(a))));
  return s;
}

/** data-i18n(내용, HTML 허용), data-i18n-title, data-i18n-placeholder 를 채웁니다. */
export function applyDom(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((el) => (el.innerHTML = t(el.dataset.i18n)));
  root.querySelectorAll('[data-i18n-title]').forEach((el) => (el.title = t(el.dataset.i18nTitle)));
  root.querySelectorAll('[data-i18n-value]').forEach((el) => (el.value = t(el.dataset.i18nValue)));
  root.querySelectorAll('[data-i18n-alt]').forEach((el) => (el.alt = t(el.dataset.i18nAlt)));
  document.title = t('app.title');
}

/** COCO 사물 이름 (0부터 시작하는 번호) — 현재 언어, 없으면 영어 */
export function cocoLabel(i) {
  const list = COCO_NAMES[lang] || COCO_NAMES.en;
  return list[i] || COCO_NAMES.en[i] || '?';
}

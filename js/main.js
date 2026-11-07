// main.js — 언어를 먼저 정한 뒤 에디터를 불러옵니다 (블록 문구가 언어에 맞게 만들어지도록).
import { initLang } from './i18n.js?v=0.2.2';

await initLang();
await import('./app.js?v=0.2.2');

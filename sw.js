// sw.js — 오프라인 실행을 위한 서비스 워커 (앱 설치 · 인터넷 없이 실행)
//
//  · 설치할 때 precache.json 의 앱 파일을 모두 받아 둡니다 (버전마다 새 캐시).
//  · 같은 사이트 파일: 캐시 먼저 (주소의 ?v= 는 무시) → 없으면 네트워크.
//  · AI 카메라(MediaPipe) · 글꼴 같은 CDN 파일: 처음 쓸 때 저장해 두고 다음부터 캐시에서.
//  · AI 튜터 모델(huggingface · GitHub raw)은 WebLLM 이 직접 저장하므로 여기서는 건드리지 않습니다.
//
// precache.json 은 tools/build_sw.py 가 만듭니다 (tools/set_version.py 가 함께 실행).

const VERSION = '0.3.15'; // tools/build_sw.py 가 바꿉니다 — 이 줄이 바뀌어야 브라우저가 새 버전을 알아챔
const APP_CACHE = 'rm-app-';
const EXT_CACHE = 'rm-ext-v1';
const WLLM_CACHE = 'rm-webllm-0.2.87';
const EXT_HOSTS = ['cdn.jsdelivr.net', 'storage.googleapis.com', 'fonts.gstatic.com'];

/** 앱 파일 저장. onlyMissing = 이미 있는 파일은 건너뜀. 돌려주는 값 = 못 받은 파일 목록 */
async function fillCache(onlyMissing) {
  const res = await fetch('precache.json', { cache: 'no-store' });
  const { files } = await res.json();
  const cache = await caches.open(APP_CACHE + VERSION);
  const failed = [];
  // 하나씩 받아서 일부가 실패해도 나머지는 저장 (실패한 파일은 처음 쓸 때 다시 받음)
  await Promise.all(files.map(async (f) => {
    try {
      if (onlyMissing && (await cache.match(f))) return;
      const r = await fetch(new Request(f, { cache: 'reload' }));
      if (r.ok) await cache.put(f, r);
      else failed.push(f);
    } catch (e) {
      failed.push(f);
    }
  }));
  return failed;
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    await fillCache(false);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const k of await caches.keys()) {
      if (k.startsWith(APP_CACHE) && k !== APP_CACHE + VERSION) await caches.delete(k);
    }
    await self.clients.claim();
  })());
});

const appCache = () => caches.open(APP_CACHE + VERSION);

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
    if (url.pathname.endsWith('/precache.json')) return; // 항상 네트워크
    if (url.pathname.includes('/vendor/web-llm/')) {
      // AI 튜터 엔진 — 버전이 바뀌어도 지우지 않는 따로 캐시 (한 번 받으면 인터넷 없이)
      event.respondWith((async () => {
        const cache = await caches.open(WLLM_CACHE);
        const hit = await cache.match(req, { ignoreSearch: true });
        if (hit) return hit;
        const r = await fetch(req);
        if (r.ok) cache.put(req, r.clone());
        return r;
      })());
      return;
    }
    event.respondWith((async () => {
      const cache = await appCache();
      // 페이지 이동(…/?lang=ko 등)은 index.html 로
      const key = req.mode === 'navigate' ? new URL('index.html', self.registration.scope).href : req;
      const hit = await cache.match(key, { ignoreSearch: true });
      if (hit) return hit;
      try {
        const r = await fetch(req);
        if (r.ok && req.mode !== 'navigate') cache.put(req, r.clone());
        return r;
      } catch (e) {
        const idx = await cache.match(new URL('index.html', self.registration.scope).href);
        if (req.mode === 'navigate' && idx) return idx;
        throw e;
      }
    })());
    return;
  }

  if (EXT_HOSTS.includes(url.hostname)) {
    event.respondWith((async () => {
      const cache = await caches.open(EXT_CACHE);
      const hit = await cache.match(req);
      if (hit) return hit;
      const r = await fetch(req);
      if (r.ok || r.type === 'opaque') cache.put(req, r.clone());
      return r;
    })());
  }
  // 그 밖(huggingface · raw.githubusercontent 등)은 그대로 네트워크 — WebLLM 이 직접 캐시
});

// 페이지에서 「AI 카메라 모델도 받아 두기」 요청
self.addEventListener('message', (event) => {
  const { type, urls } = event.data || {};
  if (type === 'version') return event.source?.postMessage({ type: 'version', version: VERSION });
  if (type === 'recache') {
    return event.waitUntil(fillCache(true).then((failed) => event.source?.postMessage({ type: 'recache-done', failed }),
      () => event.source?.postMessage({ type: 'recache-done', failed: ['precache.json'] })));
  }
  if (type !== 'prefetch' || !Array.isArray(urls)) return;
  event.waitUntil((async () => {
    const cache = await caches.open(EXT_CACHE);
    let done = 0;
    for (const u of urls) {
      try {
        if (!(await cache.match(u))) {
          const r = await fetch(u, { mode: 'cors' });
          if (r.ok) await cache.put(u, r);
        }
      } catch (e) {
        /* 무시 */
      }
      done += 1;
      event.source?.postMessage({ type: 'prefetch-progress', done, total: urls.length });
    }
  })());
});

// pwa.js — PC·태블릿에 앱으로 설치 · 인터넷 없이 실행
//
//  · sw.js(서비스 워커)를 등록 → 앱 파일을 모두 저장해 두고, 다음부터 인터넷 없이 열림
//  · 📲 버튼: 설치 창 (설치 단추 또는 기기별 방법 · 오프라인 준비 상태 · AI 카메라 모델 받아 두기)
//  · 새 버전이 올라오면 「다시 불러오기」 알림

import { t } from './i18n.js?v=0.3.20';
import { APP } from './config.js?v=0.3.20';
import { OFFLINE_URLS } from './aicam.js?v=0.3.20';

const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

function platform() {
  const ua = navigator.userAgent;
  const ipad = /iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  if (/iPhone|iPod/.test(ua) || ipad) return 'ios';
  if (/Android/.test(ua)) return 'android';
  if (/CrOS/.test(ua)) return 'cros';
  if (/Edg\//.test(ua)) return 'edge';
  if (/Chrome\//.test(ua)) return 'chrome';
  if (/Safari\//.test(ua) && /Macintosh/.test(ua)) return 'safari';
  return 'other';
}

async function cacheInfo() {
  const out = { app: 0, total: 0, missing: [], cam: 0, camTotal: OFFLINE_URLS.length };
  if (!('caches' in self)) return out;
  try {
    const app = await caches.open('rm-app-' + APP.version);
    let files = null;
    try {
      files = (await (await fetch('precache.json', { cache: 'no-store' })).json()).files;
    } catch (e) {
      files = null; // 인터넷 없음 — 저장된 개수만
    }
    if (files) {
      out.total = files.length;
      const base = new URL('./', location.href);
      for (const f of files) {
        if (await app.match(new URL(f, base).href, { ignoreSearch: true })) out.app += 1;
        else out.missing.push(f);
      }
    } else {
      out.app = (await app.keys()).length;
    }
    const ext = await caches.open('rm-ext-v1');
    for (const u of OFFLINE_URLS) if (await ext.match(u)) out.cam += 1;
  } catch (e) {
    /* 무시 */
  }
  return out;
}

export function initPwa({ toast }) {
  const btn = document.getElementById('btnInstall');
  const modal = document.getElementById('installModal');
  let deferred = null;
  let swReg = null;

  // 1) 서비스 워커
  const canSw = 'serviceWorker' in navigator && (location.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(location.hostname));
  if (canSw) {
    const hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.register('sw.js').then((reg) => {
      swReg = reg;
      // 1시간마다 새 버전 확인 (오래 켜 두는 교실 PC)
      setInterval(() => reg.update().catch(() => {}), 3600e3);
    }).catch(() => {});
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      // 처음 설치할 때는 조용히, 버전이 바뀌었을 때만 알림
      if (hadController) showUpdate();
    });
    navigator.serviceWorker.addEventListener('message', (e) => {
      if (e.data?.type === 'recache-done') {
        if (e.data.failed?.length) toast(t('pwa.retryFail', e.data.failed.length), 'err');
        render();
      }
      if (e.data?.type === 'prefetch-progress') {
        const el = modal.querySelector('.ins-cam');
        if (el) el.textContent = t('pwa.camProgress', e.data.done, e.data.total);
        if (e.data.done === e.data.total) setTimeout(render, 300);
      }
    });
  }

  function showUpdate() {
    if (document.getElementById('pwaUpdate')) return;
    const bar = document.createElement('div');
    bar.id = 'pwaUpdate';
    bar.className = 'pwa-update';
    bar.innerHTML = `<span>${t('pwa.update')}</span><button type="button" class="primary">${t('pwa.reload')}</button><button type="button" aria-label="✕">✕</button>`;
    bar.querySelector('.primary').addEventListener('click', () => location.reload());
    bar.lastElementChild.addEventListener('click', () => bar.remove());
    document.body.appendChild(bar);
  }

  // 2) 설치 단추 (Chrome · Edge · Android)
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e;
    btn.classList.add('can');
    if (!modal.hidden) render();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    btn.classList.remove('can');
    toast(t('pwa.installed'), 'ok');
    if (!modal.hidden) render();
  });
  if (standalone()) {
    btn.classList.add('inapp');
    navigator.storage?.persist?.().catch(() => {}); // 설치한 앱은 저장 파일을 오래 보관
  }

  // 3) 설치 창
  async function render() {
    const p = platform();
    const info = await cacheInfo();
    const ready = !!navigator.serviceWorker?.controller && info.app > 0 && !info.missing.length;
    const how = standalone() ? `<p class="ins-ok">✅ ${t('pwa.already')}</p>`
      : deferred ? `<button type="button" class="primary big" data-act="install">📲 ${t('pwa.installNow')}</button>`
      : `<p>${t('pwa.how.' + p)}</p>`;
    modal.innerHTML = `
      <div class="help-card ins-card" role="dialog" aria-modal="true" aria-labelledby="insTitle">
        <div class="help-head"><img src="img/icon-192.png" width="40" height="40" alt=""><div><h2 id="insTitle">${t('pwa.title')}</h2><small>${t('help.version', APP.version)}</small></div><button type="button" class="tt-x ins-x" data-act="close" aria-label="${t('tutor.close')}">✕</button></div>
        <p>${t('pwa.intro')}</p>
        ${how}
        <h3>${t('pwa.offline')}</h3>
        <p class="ins-state ${ready ? 'ok' : ''}">${!canSw ? t('pwa.noSw') : ready ? '✅ ' + t('pwa.ready') : '⏳ ' + t('pwa.preparing', info.app, info.total || '?')}
          ${canSw && !ready && navigator.serviceWorker?.controller ? `<button type="button" data-act="retry">⟳ ${t('pwa.retry')}</button>` : ''}</p>
        <h3>${t('pwa.cam')}</h3>
        <p>${t('pwa.camDesc')}</p>
        <p><span class="ins-cam">${info.cam >= info.camTotal ? '✅ ' + t('pwa.camDone') : t('pwa.camProgress', info.cam, info.camTotal)}</span>
          ${info.cam >= info.camTotal || !canSw ? '' : `<button type="button" data-act="cam">⬇ ${t('pwa.camGet')}</button>`}</p>
        <h3>${t('pwa.tutor')}</h3>
        <p>${t('pwa.tutorDesc')}</p>
        <h3>${t('pwa.notes')}</h3>
        <ul>${t('pwa.notesList')}</ul>
      </div>`;
  }
  modal.addEventListener('click', async (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'install' && deferred) {
      deferred.prompt();
      await deferred.userChoice.catch(() => null);
      deferred = null;
      btn.classList.remove('can');
      render();
      return;
    }
    if (act === 'retry') {
      const sw = navigator.serviceWorker.controller || swReg?.active;
      if (!sw) return;
      if (!navigator.onLine) return toast(t('pwa.needNet'), 'err');
      e.target.disabled = true;
      e.target.textContent = '⏳';
      sw.postMessage({ type: 'recache' });
      return;
    }
    if (act === 'cam') {
      const sw = navigator.serviceWorker.controller || swReg?.active;
      if (!sw) return toast(t('pwa.noSw'), 'err');
      if (!navigator.onLine) return toast(t('pwa.needNet'), 'err');
      e.target.disabled = true;
      sw.postMessage({ type: 'prefetch', urls: OFFLINE_URLS });
      return;
    }
    if (act === 'close' || e.target === modal) modal.hidden = true;
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.hidden) modal.hidden = true;
  });
  btn.addEventListener('click', () => {
    modal.hidden = false;
    render();
  });

  // 인터넷이 끊기거나 다시 연결될 때 알림
  window.addEventListener('offline', () => toast(t('pwa.wentOffline')));
  window.addEventListener('online', () => toast(t('pwa.backOnline'), 'ok'));
  return { render };
}

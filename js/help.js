// help.js — 사용 방법 팝업 + 버그 신고
// 팝업은 아무 곳이나 클릭하면 닫힙니다 (링크·버튼·접기 제목은 제외).
import { t, getLang } from './i18n.js?v=0.3.18';
import { APP } from './config.js?v=0.3.18';
import { getHubKey, hub } from './hubs.js?v=0.3.18';

const SEEN = 'rm-help-seen-' + APP.version.split('.').slice(0, 2).join('.');

function osName() {
  const ua = navigator.userAgent;
  if (/CrOS/.test(ua)) return 'ChromeOS';
  if (/Android/.test(ua)) return 'Android';
  if (/Mac OS X/.test(ua)) return 'macOS';
  if (/Windows/.test(ua)) return 'Windows';
  if (/Linux/.test(ua)) return 'Linux';
  return 'unknown';
}

/** 버그 신고에 넣을 정보 (개인 정보 없음: 버전·브라우저·허브·터미널 마지막 줄·코드) */
function report(ctx) {
  const lines = [
    `${APP.name} ${APP.version}`,
    `URL: ${location.origin}${location.pathname}`,
    `OS: ${osName()} · ${navigator.userAgent}`,
    `Language: ${getLang()}`,
    `Hub: ${hub().label} (${getHubKey()})`,
    `Connected: ${ctx.hubInfo ? `${ctx.hubInfo.name} · fw ${ctx.hubInfo.firmware} · profile ${ctx.hubInfo.profile}` : '-'}`,
    `Web Bluetooth: ${'bluetooth' in navigator} · WebUSB: ${'usb' in navigator}`,
    '',
    '--- Terminal (last 30 lines) ---',
    ctx.terminal().split('\n').slice(-30).join('\n'),
    '',
    '--- Python ---',
    ctx.code(),
  ];
  return lines.join('\n');
}

export function initHelp(ctx) {
  const modal = document.getElementById('helpModal');
  const sec = (k, open = false) =>
    `<details${open ? ' open' : ''}><summary>${t(`help.${k}.title`)}</summary><div class="hbody">${t(`help.${k}.body`)}</div></details>`;

  function render() {
    const bugMail = `mailto:${APP.contactEmail}?subject=${encodeURIComponent(t('bug.subject') + APP.version)}&body=${encodeURIComponent(t('bug.intro') + '\n\n' + report(ctx).slice(0, 1200))}`;
    modal.innerHTML = `
      <div class="help-card" role="dialog" aria-modal="true" aria-labelledby="helpTitle">
        <div class="help-head">
          <img src="img/logo.png" width="40" height="40" alt="">
          <div><h2 id="helpTitle">${t('help.title')}</h2><small>${t('help.version', APP.version)}</small></div>
        </div>
        <p class="help-close">${t('help.close')}</p>
        <section class="help-quick"><h3>${t('help.quick.title')}</h3>${t('help.quick.body')}</section>
        <h3>${t('help.fw.title')}</h3>
        ${sec('fw.prime', true)}${sec('fw.essential')}${sec('fw.ev3')}
        <h3>${t('help.env.title')}</h3>
        ${sec('win')}${sec('mac')}${sec('cros')}${sec('linux')}
        <h3>${t('help.use.title')}</h3>
        <div class="hbody">${t('help.use.body')}</div>
        ${sec('ai')}
        ${sec('standalone')}
        ${sec('esp32')}
        ${sec('husky')}
        <section class="help-bug">
          <h3>🐞 ${t('help.bug.title')}</h3>
          <p>${t('help.bug.body', APP.contactName)}</p>
          <div class="bug-actions">
            <a class="btn primary" href="${bugMail}">✉ ${t('help.bug.mail')}</a>
            <button type="button" data-act="copy">📋 ${t('help.bug.copy')}</button>
            ${APP.issuesUrl ? `<a class="btn" href="${APP.issuesUrl}" target="_blank" rel="noopener">GitHub Issues</a>` : ''}
          </div>
          <p class="bug-addr">${APP.contactEmail}</p>
        </section>
      </div>`;
  }

  function open() {
    render();
    modal.hidden = false;
  }
  function close() {
    modal.hidden = true;
    try {
      localStorage.setItem(SEEN, '1');
    } catch (e) {
      /* 무시 */
    }
  }

  modal.addEventListener('click', async (e) => {
    if (e.target.closest('[data-act="copy"]')) {
      try {
        await navigator.clipboard.writeText(`${t('bug.intro')}\n\n${report(ctx)}`);
        ctx.toast(t('help.bug.copied'), 'ok');
      } catch (err) {
        ctx.toast(err.message, 'err');
      }
      return;
    }
    if (e.target.closest('a, summary, button, input, select, textarea')) return;
    close();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.hidden) close();
  });
  document.getElementById('btnHelp').addEventListener('click', (e) => {
    e.stopPropagation();
    open();
  });

  let seen = false;
  try {
    seen = localStorage.getItem(SEEN) === '1';
  } catch (e) {
    seen = false;
  }
  if (!seen && !new URLSearchParams(location.search).has('nohelp')) open();
  return { open, close };
}

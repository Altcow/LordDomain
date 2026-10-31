(function () {
  'use strict';

  if (!('serviceWorker' in navigator)) return;
  if (location.protocol !== 'http:' && location.protocol !== 'https:') return;
  if (!window.isSecureContext) return;

  if (location.search.indexOf('nosw') !== -1) {
    navigator.serviceWorker.getRegistrations()
      .then(regs => Promise.all(regs.map(r => r.unregister())))
      .then(() => caches.keys())
      .then(keys => Promise.all(keys.filter(k => k.indexOf('lorddomain-') === 0).map(k => caches.delete(k))))
      .then(() => console.info('[pwa] service worker disabled (?nosw)'))
      .catch(e => console.warn('[pwa] nosw cleanup failed', e));
    return;
  }

  let userAsked = false, refreshing = false, bar = null;

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (userAsked && !refreshing) {
      refreshing = true;
      location.reload();
    }
  });

  // 強制更新:不依賴 Service Worker 的 waiting 狀態,直接移除 SW 與本遊戲快取後重新載入(存檔在 localStorage,不受影響)
  function hardUpdate() {
    if (typeof saveWorld === 'function') { try { saveWorld(); } catch (e) { console.warn('[pwa] save before update failed', e); } }
    navigator.serviceWorker.getRegistrations()
      .then(regs => Promise.all(regs.map(r => r.unregister())))
      .then(() => caches.keys())
      .then(keys => Promise.all(keys.filter(k => k.indexOf('lorddomain-') === 0).map(k => caches.delete(k))))
      .catch(e => console.warn('[pwa] hard update cleanup failed', e))
      .then(() => { location.href = location.pathname + '?v=' + Date.now(); });
  }
  window.pwaHardUpdate = hardUpdate;

  // 版本檢查(獨立於 SW 更新機制):跑中版本 = 由 SW 快取回傳的 sw.js;最新版本 = 不會被快取的 version.json
  function readVer(text) { const m = /const VERSION = '([^']+)'/.exec(text || ''); return m ? m[1] : ''; }
  function checkVersion() {
    if (navigator.onLine === false) return;
    Promise.all([
      fetch('./sw.js').then(r => r.text()).then(readVer).catch(() => ''),
      fetch('./version.json?t=' + Date.now(), { cache: 'no-store' }).then(r => (r.ok ? r.json() : null)).then(j => (j && j.v) || '').catch(() => '')
    ]).then(vs => {
      if (vs[0] && vs[1] && vs[0] !== vs[1]) showUpdateBar(null, vs[1]);
    });
  }

  function showUpdateBar(reg, newVer) {
    if (bar) return;
    bar = document.createElement('div');
    bar.id = 'updateBar';

    const label = document.createElement('span');
    label.textContent = newVer ? '有新版本 ' + newVer : '有新版本';

    const go = document.createElement('button');
    go.className = 'go';
    go.textContent = '更新';
    go.addEventListener('click', () => {
      userAsked = true;
      if (reg && reg.waiting) {
        if (typeof saveWorld === 'function') saveWorld();
        reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        setTimeout(hardUpdate, 3000);   // 保險:3 秒內沒換成新 SW 就直接強制更新
      } else {
        hardUpdate();
      }
    });

    const later = document.createElement('button');
    later.className = 'later';
    later.textContent = '稍後';
    later.addEventListener('click', () => {
      bar.remove();
      bar = null;
    });

    bar.appendChild(label);
    bar.appendChild(go);
    bar.appendChild(later);
    document.body.appendChild(bar);
  }

  function register() {
    navigator.serviceWorker.register('./sw.js', { scope: './', updateViaCache: 'none' })
      .then(reg => {
        if (reg.waiting && navigator.serviceWorker.controller) showUpdateBar(reg);
        reg.addEventListener('updatefound', () => {
          const nw = reg.installing;
          if (!nw) return;
          nw.addEventListener('statechange', () => {
            if (nw.state === 'installed' && navigator.serviceWorker.controller) showUpdateBar(reg);
          });
        });
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible' && navigator.onLine !== false) {
            reg.update().catch(e => console.warn('[pwa] update check failed', e));
            checkVersion();
          }
        });
        setTimeout(checkVersion, 2500);
      })
      .catch(e => console.warn('[pwa] register failed', e));

    if (navigator.storage && navigator.storage.persist) {
      navigator.storage.persist().catch(e => console.warn('[pwa] persist failed', e));
    }
  }

  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register);
})();

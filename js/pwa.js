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

  function showUpdateBar(reg) {
    if (bar) return;
    bar = document.createElement('div');
    bar.id = 'updateBar';

    const label = document.createElement('span');
    label.textContent = '有新版本';

    const go = document.createElement('button');
    go.className = 'go';
    go.textContent = '更新';
    go.addEventListener('click', () => {
      userAsked = true;
      if (typeof saveWorld === 'function') saveWorld();
      if (reg.waiting) {
        reg.waiting.postMessage({ type: 'SKIP_WAITING' });
      } else {
        location.reload();
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
          }
        });
      })
      .catch(e => console.warn('[pwa] register failed', e));

    if (navigator.storage && navigator.storage.persist) {
      navigator.storage.persist().catch(e => console.warn('[pwa] persist failed', e));
    }
  }

  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register);
})();

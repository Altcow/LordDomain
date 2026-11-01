// orient.js — 畫面方向鎖(PLAN_LAYOUT §3.6)。存檔 key lorddomain.orient.v1:auto / portrait / landscape,預設 auto。
// 固定模式時嘗試 screen.orientation.lock(Android Chrome 全螢幕或已安裝 PWA 有效);失敗或不支援(iPhone)時,
// 方向不符就蓋一層 #orientGuard 請使用者轉回。載入時只宣告;DOM 就緒後由 orientInit() 建提示層並套用設定。

const ORIENT_KEY = 'lorddomain.orient.v1';
const ORIENT_MODES = ['auto', 'portrait', 'landscape'];
const ORIENT_GUARD_TEXT = {
  portrait: ['請把手機轉回直向', '畫面已設為固定直版(設定 → 畫面方向)'],
  landscape: ['請把手機轉回橫向', '畫面已設為固定橫版(設定 → 畫面方向)']
};
let orGuardEl = null;
let orGuardTx = null;
let orGuardSub = null;
let orInited = false;

function orientGet() {
  let v = null;
  try {
    v = localStorage.getItem(ORIENT_KEY);
  } catch (e) {
    console.warn('[orient] read failed', e);
  }
  return ORIENT_MODES.indexOf(v) >= 0 ? v : 'auto';
}

function orientSave(mode) {
  try {
    localStorage.setItem(ORIENT_KEY, mode);
  } catch (e) {
    console.warn('[orient] write failed', e);
  }
}

// 固定模式下,目前視窗方向與鎖定不符
function orientMismatch() {
  const mode = orientGet();
  if (mode === 'auto') return false;
  const w = window.innerWidth;
  const h = window.innerHeight;
  if (!w || !h) return false;
  return mode === 'portrait' ? w > h : h > w;
}

function orientLock(mode) {
  if (typeof screen === 'undefined' || !screen || !screen.orientation) return;
  try {
    if (mode === 'auto') {
      if (typeof screen.orientation.unlock === 'function') screen.orientation.unlock();
      return;
    }
    const p = screen.orientation.lock(mode);
    if (p && typeof p.catch === 'function') p.catch(function (e) { console.warn('[orient] lock failed', e); });
  } catch (e) {
    console.warn('[orient] lock failed', e);
  }
}

function orientGuardRender() {
  if (!orGuardEl) return;
  const mode = orientGet();
  if (orientMismatch()) {
    orGuardTx.textContent = ORIENT_GUARD_TEXT[mode][0];
    orGuardSub.textContent = ORIENT_GUARD_TEXT[mode][1];
    orGuardEl.classList.add('og-show');
  } else {
    orGuardEl.classList.remove('og-show');
  }
}

function orientRefresh() {
  orientGuardRender();
  if (typeof stIsOpen !== 'undefined' && stIsOpen && typeof stRender === 'function') stRender();
}

// 設定頁與提示層的「改回自動」共用入口
function orientSet(mode) {
  if (ORIENT_MODES.indexOf(mode) < 0) return;
  orientSave(mode);
  orientLock(mode);
  orientRefresh();
}

function orientBuild() {
  const root = document.createElement('div');
  root.id = 'orientGuard';
  root.setAttribute('role', 'alertdialog');
  const box = document.createElement('div');
  box.className = 'og-box';
  const icon = document.createElement('div');
  icon.className = 'og-icon';
  icon.textContent = '📱';
  const tx = document.createElement('p');
  tx.className = 'og-tx';
  const sub = document.createElement('p');
  sub.className = 'og-sub';
  const btn = document.createElement('button');
  btn.className = 'og-auto';
  btn.textContent = '改回自動';
  btn.addEventListener('click', function () { orientSet('auto'); });
  box.appendChild(icon);
  box.appendChild(tx);
  box.appendChild(sub);
  box.appendChild(btn);
  root.appendChild(box);
  document.body.appendChild(root);
  orGuardEl = root;
  orGuardTx = tx;
  orGuardSub = sub;
}

function orientInit() {
  if (orInited || typeof document === 'undefined' || !document.body) return;
  orInited = true;
  orientBuild();
  window.addEventListener('resize', orientGuardRender);
  window.addEventListener('orientationchange', orientGuardRender);
  const mode = orientGet();
  if (mode !== 'auto') orientLock(mode);
  orientGuardRender();
}

if (typeof document !== 'undefined' && document.readyState) {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', orientInit);
  else orientInit();
}

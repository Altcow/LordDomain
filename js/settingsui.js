// settingsui.js — ☰ 設定面板 AU0(PLAN_AUDIO §1)。全部由 JS 建立,不改 index.html。
// 載入時只宣告;腳本位於 body 末尾,DOM 就緒後呼叫 initSettingsUI()(建 ☰ 鈕與底部抽屜)。
// 存檔 key lorddomain.settings.v1(聲音與面板偏好);季節 / 時段 / 美術 / 居民仍由各自擁有者的 key 存。

const SETTINGS_KEY = 'lorddomain.settings.v1';
let stCache = null;
let stInited = false;
let stIsOpen = false;
let stDangerOpen = false;
let stRootEl = null;
let stBodyEl = null;
let stVerText = '';
let stVerEl = null;
let stExtraRows = [];   // settingsAddRow 登記的列:{ label, onclick, group }

function stClone(o) {
  return JSON.parse(JSON.stringify(o));
}

// 逐欄合併:缺欄位或型別不符就保留預設
function stMerge(def, src) {
  Object.keys(def).forEach(function (k) {
    if (!Object.prototype.hasOwnProperty.call(src, k)) return;
    const dv = def[k];
    const sv = src[k];
    if (Array.isArray(dv)) {
      if (Array.isArray(sv)) def[k] = sv;
    } else if (dv && typeof dv === 'object') {
      if (sv && typeof sv === 'object' && !Array.isArray(sv)) stMerge(dv, sv);
    } else if (typeof sv === typeof dv) {
      def[k] = sv;
    }
  });
  return def;
}

function settingsGet() {
  if (stCache) return stCache;
  const cfg = stClone(AUDIO_SETTINGS_DEFAULT);
  let raw = null;
  try {
    raw = localStorage.getItem(SETTINGS_KEY);
  } catch (e) {
    console.warn('[au] settings read failed', e);
  }
  if (raw) {
    try {
      const saved = JSON.parse(raw);
      if (saved && typeof saved === 'object') stMerge(cfg, saved);
    } catch (e) {
      console.warn('[au] settings parse failed', e);
    }
  } else {
    // 第一次建立:沿用舊的 lorddomain.mute(ui.js),舊 key 不刪
    try {
      if (localStorage.getItem('lorddomain.mute') === '1') cfg.sfx.on = false;
    } catch (e) {
      console.warn('[au] legacy mute read failed', e);
    }
    stCache = cfg;
    stSave();
  }
  stCache = cfg;
  return stCache;
}

function stSave() {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(stCache));
  } catch (e) {
    console.warn('[au] settings write failed', e);
  }
}

// path 可用點號,例如 'sfx.vol';每次改值即寫入並套用到音訊引擎
function settingsSet(path, value) {
  const cfg = settingsGet();
  const keys = path.split('.');
  let o = cfg;
  for (let i = 0; i < keys.length - 1; i++) o = o[keys[i]];
  o[keys[keys.length - 1]] = value;
  stSave();
  if (typeof AU === 'object' && AU.applySettings) AU.applySettings();
}

function stSeasonFromMonth(m) {
  if (m >= 3 && m <= 5) return 'spring';
  if (m >= 6 && m <= 8) return 'summer';
  if (m >= 9 && m <= 11) return 'autumn';
  return 'winter';
}

// 季節:有頂列 #selSeason 就改它並觸發 change(ui.js 會 setSeason + saveWorld);沒有就直接呼叫
function stApplySeason(name) {
  const sel = document.getElementById('selSeason');
  if (sel) {
    if (sel.value === name) return;
    sel.value = name;
    if (typeof Event === 'function') sel.dispatchEvent(new Event('change'));
    return;
  }
  if (typeof setSeason === 'function') setSeason(name);
  if (typeof saveWorld === 'function') saveWorld();
}

function stApplyAutoSeason() {
  if (settingsGet().seasonMode !== 'auto') return;
  const target = stSeasonFromMonth(new Date().getMonth() + 1);
  if (typeof currentSeason === 'string' && currentSeason === target) return;
  stApplySeason(target);
}

function stReadTodLock() {
  const keys = typeof ART_TOD_KEYS !== 'undefined' ? ART_TOD_KEYS : [];
  const key = typeof ART_KEY !== 'undefined' ? ART_KEY : 'lorddomain.art.v1';
  try {
    const j = JSON.parse(localStorage.getItem(key));
    if (j && keys.indexOf(j.tod) >= 0) return j.tod;
  } catch (e) {
    console.warn('[au] art read failed', e);
  }
  return 'auto';
}

function stInBattle() {
  if (typeof game !== 'undefined' && game && (game.mode === 'attack' || game.mode === 'replay')) return true;
  return !!(document.body && document.body.classList && document.body.classList.contains('sandbox'));
}

function stEl(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

function stSec(title, nodes) {
  const sec = stEl('section', 'st-sec');
  sec.appendChild(stEl('h3', 'st-h', title));
  nodes.forEach(function (n) { sec.appendChild(n); });
  return sec;
}

function stRow(label, control) {
  const row = stEl('div', 'st-row');
  row.appendChild(stEl('span', 'st-lbl', label));
  row.appendChild(control);
  return row;
}

function stSwitch(on, onChange) {
  const btn = stEl('button', 'st-sw' + (on ? ' on' : ''), on ? '開' : '關');
  btn.setAttribute('role', 'switch');
  btn.setAttribute('aria-checked', on ? 'true' : 'false');
  btn.addEventListener('click', function () { onChange(!on); });
  return btn;
}

function stSeg(options, current, onPick) {
  const wrap = stEl('div', 'st-seg');
  options.forEach(function (o) {
    const b = stEl('button', o[0] === current ? 'on' : '', o[1]);
    b.setAttribute('aria-pressed', o[0] === current ? 'true' : 'false');
    b.addEventListener('click', function () { onPick(o[0]); });
    wrap.appendChild(b);
  });
  return wrap;
}

// 開關 + 音量滑桿(音量 0~100,寫入 0~1)
function stVolBlock(label, bus) {
  const cfg = settingsGet()[bus];
  const wrap = stEl('div', 'st-vol');
  wrap.appendChild(stRow(label, stSwitch(cfg.on, function (v) {
    settingsSet(bus + '.on', v);
    stRender();
  })));
  const slide = stEl('div', 'st-row st-slide');
  const range = document.createElement('input');
  range.type = 'range';
  range.min = '0';
  range.max = '100';
  range.step = '5';
  range.className = 'st-range';
  range.value = String(Math.round(cfg.vol * 100));
  const pct = stEl('span', 'st-pct', range.value + '%');
  range.addEventListener('input', function () {
    pct.textContent = range.value + '%';
    settingsSet(bus + '.vol', Number(range.value) / 100);
  });
  slide.appendChild(range);
  slide.appendChild(pct);
  wrap.appendChild(slide);
  return wrap;
}

// 外部模組(如 mymusic.js)登記一列;group 省略為「聲音」。同 group 同 label 不重複登記
function settingsAddRow(label, onclick, group) {
  if (typeof onclick !== 'function') return false;
  const g = group || '聲音';
  if (stExtraRows.some(function (r) { return r.label === label && r.group === g; })) return true;
  stExtraRows.push({ label: label, onclick: onclick, group: g });
  if (stIsOpen) stRender();
  return true;
}

function stExtraNodes(group) {
  return stExtraRows.filter(function (r) { return r.group === group; }).map(function (r) {
    const b = stEl('button', 'st-link', r.label);
    b.addEventListener('click', function () {
      stClosePanel();
      r.onclick();
    });
    return b;
  });
}

function stQuickSec() {
  const grid = stEl('div', 'st-quick');
  const items = [['範本', 'btnDemo'], ['全景', 'btnPano'], ['商店', 'btnShop']];
  items.forEach(function (it) {
    const b = stEl('button', '', it[0]);
    b.addEventListener('click', function () {
      stClosePanel();
      const target = document.getElementById(it[1]);
      if (target) target.click();
    });
    grid.appendChild(b);
  });
  const cfg = settingsGet();
  const seasonNow = cfg.seasonMode === 'auto' ? 'auto' : (typeof currentSeason === 'string' ? currentSeason : 'spring');
  const season = stRow('季節', stSeg([['auto', '自動'], ['spring', '春'], ['summer', '夏'], ['autumn', '秋'], ['winter', '冬']], seasonNow, function (v) {
    if (v === 'auto') {
      settingsSet('seasonMode', 'auto');
      stApplyAutoSeason();
    } else {
      settingsSet('seasonMode', 'manual');
      stApplySeason(v);
    }
    stRender();
  }));
  return stSec('快捷', [grid, season]);
}

function stSoundSec() {
  const cfg = settingsGet();
  const nodes = [
    stRow('安靜模式(只留介面與重點音)', stSwitch(cfg.quiet, function (v) {
      settingsSet('quiet', v);
      stRender();
    })),
    stVolBlock('音樂', 'music'),
    stVolBlock('音效', 'sfx'),
    stVolBlock('環境音', 'amb'),
    stRow('跟隨靜音鍵', stSwitch(cfg.followSilent, function (v) {
      settingsSet('followSilent', v);
      stRender();
    }))
  ];
  return stSec('聲音', nodes.concat(stExtraNodes('聲音')));
}

function stDisplaySec() {
  const nodes = [];
  if (typeof artSetTod === 'function') {
    nodes.push(stRow('時段', stSeg([['auto', '自動'], ['dawn', '晨'], ['noon', '午'], ['dusk', '昏'], ['night', '夜']], stReadTodLock(), function (v) {
      artSetTod(v);
      stRender();
    })));
  }
  if (typeof artSetOn === 'function') {
    const artOn = typeof ART_ON !== 'undefined' ? !!ART_ON : true;
    nodes.push(stRow('新美術與光暈', stSwitch(artOn, function (v) {
      artSetOn(v);
      stRender();
    })));
  }
  if (typeof lifeSetOn === 'function') {
    const lifeOn = typeof lifeGetOn === 'function' ? !!lifeGetOn() : true;
    nodes.push(stRow('路上居民 👥', stSwitch(lifeOn, function (v) {
      lifeSetOn(v);
      stRender();
    })));
  }
  if (typeof lifeSetDensity === 'function' && typeof lifeGetDensity === 'function') {
    nodes.push(stRow('居民密度', stSeg([['off', '關'], ['low', '少'], ['mid', '中'], ['high', '多'], ['crowd', '熱鬧']], lifeGetDensity(), function (v) {
      lifeSetDensity(v);
      stRender();
    })));
  }
  if (typeof uiSetCompact === 'function') {
    nodes.push(stRow('精簡介面', stSwitch(typeof uiGetCompact === 'function' && uiGetCompact(), function (v) {
      uiSetCompact(v);
      stRender();
    })));
  }
  return stSec('畫面', nodes);
}

// 全螢幕說明:瀏覽器列佔空間時的做法;不支援 requestFullscreen 的瀏覽器(如 iPhone Safari)不顯示按鈕
function stFsSupported() {
  const el = document.documentElement;
  return !!(el && typeof el.requestFullscreen === 'function' && document.fullscreenEnabled !== false);
}

function stFsRequest() {
  try {
    const p = document.documentElement.requestFullscreen();
    if (p && typeof p.catch === 'function') p.catch(function (e) { console.warn('[fs] request failed', e); });
  } catch (e) {
    console.warn('[fs] request failed', e);
  }
}

function stHowtoSec() {
  const wrap = stEl('div', 'st-howto');
  wrap.appendChild(stEl('p', '', '網址列與瀏覽器工具列會佔掉螢幕。下列方法可讓遊戲畫面更大:'));
  wrap.appendChild(stEl('p', '', 'iPhone(Safari)'));
  const ios = stEl('ol', '');
  ['點下方「分享」鈕', '選「加入主畫面」', '之後從主畫面的「城主領地」圖示開啟,就不會有瀏覽器列'].forEach(function (t) {
    ios.appendChild(stEl('li', '', t));
  });
  wrap.appendChild(ios);
  wrap.appendChild(stEl('p', '', '或在網址列點「aA」→「隱藏工具列」(每次開啟可能要重做)。'));
  wrap.appendChild(stEl('p', '', 'Android(Chrome)'));
  const and = stEl('ol', '');
  ['點右上角「⋮」選單', '選「加到主畫面」(或「安裝應用程式」)', '之後從主畫面圖示開啟'].forEach(function (t) {
    and.appendChild(stEl('li', '', t));
  });
  wrap.appendChild(and);
  wrap.appendChild(stEl('p', '', '或進入遊戲後向上滑動隱藏網址列。'));
  if (stFsSupported()) {
    const b = stEl('button', 'st-link', '進入全螢幕');
    b.addEventListener('click', stFsRequest);
    wrap.appendChild(b);
  }
  return stSec('如何看更大畫面', [wrap]);
}

// 一次性提示條:手機版且未以主畫面開啟;關閉後記入 localStorage 不再顯示
const FS_TIP_KEY = 'lorddomain.ui.fsTipDismissed';
function stIsStandalone() {
  if (typeof matchMedia === 'function' && matchMedia('(display-mode: standalone)').matches) return true;
  return navigator.standalone === true;
}
function stIsPhone() {
  return window.innerWidth <= 600 || navigator.maxTouchPoints > 0;
}
function stFsTipMaybe() {
  if (!document.body || stIsStandalone() || !stIsPhone()) return;
  try {
    if (localStorage.getItem(FS_TIP_KEY) === '1') return;
  } catch (e) {
    console.warn('[au] fs tip read failed', e);
  }
  const tip = stEl('div', '');
  tip.id = 'fsTip';
  tip.appendChild(stEl('span', 'ftx', '想要更大畫面?加入主畫面後從圖示開啟,即可隱藏瀏覽器列。'));
  const more = stEl('button', '', '說明');
  const x = stEl('button', '', '✕');
  x.setAttribute('aria-label', '關閉提示');
  const dismiss = function () {
    try {
      localStorage.setItem(FS_TIP_KEY, '1');
    } catch (e) {
      console.warn('[au] fs tip write failed', e);
    }
    tip.remove();
  };
  more.addEventListener('click', function () {
    dismiss();
    stOpenPanel();
  });
  x.addEventListener('click', dismiss);
  tip.appendChild(more);
  tip.appendChild(x);
  document.body.appendChild(tip);
}

function stAboutSec() {
  const ver = stEl('p', 'st-ver', '版本 ' + (stVerText || '讀取中…'));
  stVerEl = ver;
  const credit = stEl('p', 'st-credit', '本遊戲美術與音效由程式自行繪製合成,目前未使用第三方素材。');
  return stSec('關於', [ver, credit]);
}

function stDangerSec() {
  const wrap = stEl('div', 'st-danger');
  if (!stDangerOpen) {
    const btn = stEl('button', 'st-btn-danger', '清空領地…');
    btn.addEventListener('click', function () {
      stDangerOpen = true;
      stRender();
    });
    wrap.appendChild(btn);
  } else {
    wrap.appendChild(stEl('p', 'st-ask', '清空領地上的所有建築與地形?資源與科技進度不會改變。'));
    const yes = stEl('button', 'st-btn-danger', '確定清空');
    yes.addEventListener('click', function () {
      stDangerOpen = false;
      stClosePanel();
      const b = document.getElementById('btnClear');
      if (b) b.click();
    });
    const no = stEl('button', '', '取消');
    no.addEventListener('click', function () {
      stDangerOpen = false;
      stRender();
    });
    wrap.appendChild(yes);
    wrap.appendChild(no);
  }
  return stSec('危險區', [wrap]);
}

function stRender() {
  if (!stBodyEl) return;
  stBodyEl.innerHTML = '';
  const battle = stInBattle();
  if (!battle) stBodyEl.appendChild(stQuickSec());
  stBodyEl.appendChild(stSoundSec());
  const builtin = ['快捷', '聲音', '畫面', '關於', '危險區'];
  stExtraRows.forEach(function (r) {
    if (builtin.indexOf(r.group) >= 0) return;
    builtin.push(r.group);
    stBodyEl.appendChild(stSec(r.group, stExtraNodes(r.group)));
  });
  if (battle) return;
  stBodyEl.appendChild(stDisplaySec());
  stBodyEl.appendChild(stHowtoSec());
  stBodyEl.appendChild(stAboutSec());
  stBodyEl.appendChild(stDangerSec());
}

function stOpenPanel() {
  if (!stRootEl) return;
  if (typeof AU === 'object' && AU.unlock) AU.unlock();
  stRender();
  stRootEl.classList.add('st-open');
  stIsOpen = true;
}

function stClosePanel() {
  if (!stRootEl) return;
  stRootEl.classList.remove('st-open');
  stIsOpen = false;
  stDangerOpen = false;
}

function stBuildRoot() {
  const root = stEl('div', '');
  root.id = 'stRoot';
  const mask = stEl('div', 'st-mask');
  mask.addEventListener('click', stClosePanel);
  const drawer = stEl('div', 'st-drawer');
  drawer.setAttribute('role', 'dialog');
  drawer.setAttribute('aria-label', '設定');
  drawer.appendChild(stEl('div', 'st-grip'));
  const head = stEl('div', 'st-head');
  head.appendChild(stEl('span', 'st-title', '設定'));
  const x = stEl('button', 'st-x', '✕');
  x.setAttribute('aria-label', '關閉');
  x.addEventListener('click', stClosePanel);
  head.appendChild(x);
  drawer.appendChild(head);
  stBodyEl = stEl('div', 'st-body');
  drawer.appendChild(stBodyEl);
  const foot = stEl('div', 'st-foot');
  const done = stEl('button', 'st-done', '完成');
  done.addEventListener('click', stClosePanel);
  foot.appendChild(done);
  drawer.appendChild(foot);
  root.appendChild(mask);
  root.appendChild(drawer);
  document.body.appendChild(root);
  stRootEl = root;
}

function stLoadVersion() {
  if (typeof fetch !== 'function') return;
  fetch('sw.js', { cache: 'no-store' })
    .then(function (r) { return r.text(); })
    .then(function (t) {
      const m = /const VERSION = '([^']+)'/.exec(t);
      stVerText = m ? m[1] : '見 sw.js';
    })
    .catch(function () {
      stVerText = '見 sw.js';
    })
    .then(function () {
      if (stVerEl) stVerEl.textContent = '版本 ' + stVerText;
    });
}

function initSettingsUI() {
  if (stInited) return;
  if (typeof document === 'undefined' || !document.getElementById) return;
  stInited = true;
  const bar = document.getElementById('topbar');
  if (bar) {
    const btn = stEl('button', 'st-menu-btn', '⚙');
    btn.id = 'btnMenu';
    btn.title = '設定';
    btn.setAttribute('aria-label', '設定');
    btn.addEventListener('click', stOpenPanel);
    bar.appendChild(btn);
  }
  stBuildRoot();
  document.addEventListener('keydown', function (e) {
    if (stIsOpen && e.key === 'Escape') stClosePanel();
  });
  settingsGet();
  stLoadVersion();
  setTimeout(stApplyAutoSeason, 0);
  setTimeout(stFsTipMaybe, 1200);
  setInterval(stApplyAutoSeason, 3600000);
}

if (typeof document !== 'undefined' && document.readyState) {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initSettingsUI);
  else initSettingsUI();
}

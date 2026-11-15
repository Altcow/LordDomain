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
let stBgmOpen = false;
let stCreditOpen = false;
let stTabBarEl = null;
let stCurTab = '';
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

// tab:此區塊歸屬的分頁 id(見 ST_TABS);cls:額外 class(如 st-danger-sec)
function stSec(title, nodes, tab, cls) {
  const sec = stEl('section', 'st-sec' + (cls ? ' ' + cls : ''));
  sec.setAttribute('data-tab', tab || 'more');
  sec.stTab = tab || 'more';
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

// 一列設定 + 其下一行灰字白話說明
function stAdd(nodes, label, control, hint) {
  nodes.push(stRow(label, control));
  if (hint) nodes.push(stEl('p', 'st-hint st-note', hint));
}

// 分頁:id、名稱、一句話說明
const ST_TABS = [
  { id: 'sound', name: '畫質與聲音' },
  { id: 'more', name: '進階' }
];
const ST_TAB_KEY = 'lorddomain.ui.settingsTab';
// 外部登記的列(settingsAddRow)白話說明
const ST_EXTRA_HINT = {
  '自訂音樂 ›': '用自己的音樂檔取代遊戲內建的背景音樂。',
  '🎬 拍攝錄影': '開啟拍攝錄影面板:把城市錄成影片,或在城裡走一圈拍攝。',
  '📋 範本…': '挑一份現成的版面範本載入到草稿,不會直接蓋掉你正在用的城。',
  '🏘️ 城市風格…': '每點一次換一種城市外觀風格(只換外觀,不影響數值)。'
};

function stTabLoad() {
  try {
    const v = localStorage.getItem(ST_TAB_KEY);
    if (ST_TABS.some(function (t) { return t.id === v; })) return v;
  } catch (e) {
    console.warn('[st] tab read failed', e);
  }
  return 'sound';
}

function stTabSave(id) {
  try {
    localStorage.setItem(ST_TAB_KEY, id);
  } catch (e) {
    console.warn('[st] tab write failed', e);
  }
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
function settingsAddRow(label, onclick, group, show) {
  if (typeof onclick !== 'function') return false;
  const g = group || '聲音';
  if (stExtraRows.some(function (r) { return r.label === label && r.group === g; })) return true;
  stExtraRows.push({ label: label, onclick: onclick, group: g, show: show });
  if (stIsOpen) stRender();
  return true;
}

function stExtraNodes(group) {
  return stExtraRows.filter(function (r) { return r.group === group && (typeof r.show !== 'function' || r.show()); }).map(function (r) {
    const b = stEl('button', 'st-link', r.label);
    b.addEventListener('click', function () {
      stClosePanel();
      r.onclick();
    });
    return b;
  });
}

// 同上,但每列後面附一行灰字說明(有登記的話)
function stExtraNodesH(group) {
  const out = [];
  stExtraRows.filter(function (r) { return r.group === group && (typeof r.show !== 'function' || r.show()); }).forEach(function (r, i) {
    out.push(stExtraNodes(group)[i]);
    if (ST_EXTRA_HINT[r.label]) out.push(stEl('p', 'st-hint st-note', ST_EXTRA_HINT[r.label]));
  });
  return out;
}

// 背景音樂曲目:每個場景一列「選單 + 試聽」,選擇存在 bgm.js 的 localStorage(lorddomain.bgm.pick)
function stBgmRow(g) {
  const key = g[0];
  const aud = bgmAuditing();
  const cur = bgmPickGet(key);
  const tracks = bgmTracks(key);
  const row = stEl('div', 'st-bgm-row');
  row.appendChild(stEl('span', 'st-bgm-l', g[1]));
  const sel = document.createElement('select');
  sel.className = 'st-bgm-s';
  sel.setAttribute('aria-label', g[1] + '曲目');
  const o0 = document.createElement('option');
  o0.value = 'auto';
  o0.textContent = '自動輪播';
  sel.appendChild(o0);
  tracks.forEach(function (t) {
    const o = document.createElement('option');
    o.value = t.id;
    o.textContent = t.name;
    sel.appendChild(o);
  });
  sel.value = cur;
  const playing = !!(aud && aud.group === key);
  const play = stEl('button', 'st-bgm-p' + (playing ? ' on' : ''), playing ? '■' : '▶');
  play.setAttribute('aria-label', playing ? '停止試聽' : '試聽');
  sel.addEventListener('change', function () {
    bgmPickSet(key, sel.value);
    if (playing) bgmAudition(key, sel.value);
    stRender();
  });
  play.addEventListener('click', function () {
    if (playing) {
      bgmAuditionStop();
    } else {
      if (typeof AU === 'object' && AU.unlock) AU.unlock();
      bgmAudition(key, sel.value);
    }
    stRender();
  });
  row.appendChild(sel);
  row.appendChild(play);
  const hit = tracks.filter(function (t) { return t.id === cur; })[0];
  const shown = playing ? tracks.filter(function (t) { return t.id === aud.id; })[0] : hit;
  const desc = shown ? shown.name + ':' + shown.desc + (shown.bpm ? '(' + shown.bpm + ' BPM)' : '') : '每次進入場景依序換一首,共 ' + tracks.length + ' 首';
  const wrap = stEl('div', '');
  wrap.appendChild(row);
  wrap.appendChild(stEl('div', 'st-bgm-d', desc));
  return wrap;
}

function stBgmCard() {
  const body = stEl('div', 'st-bgm');
  if (stBgmOpen) {
    bgmGroups().forEach(function (g) { body.appendChild(stBgmRow(g)); });
    body.appendChild(stEl('p', 'st-bgm-h', '選好的曲目於下次進入該場景時播放;▶ 立即試聽,離開設定自動恢復。若已為該場景指定自訂音樂,以自訂音樂優先。'));
  }
  return stCard('🎼', '背景音樂曲目', '每個場景可選曲目,或自動輪播', 'fold', stBgmOpen, function () { stBgmOpen = !stBgmOpen; stRender(); }, stBgmOpen ? body : null);
}

// 音樂致謝:有標註需求的檔案曲(CC BY 等),檔案存在才列出
function stCreditsCard() {
  const list = typeof bgmCredits === 'function' ? bgmCredits() : [];
  if (!list.length) return null;
  const body = stEl('div', 'st-bgm');
  if (stCreditOpen) {
    list.forEach(function (c) {
      const d = stEl('div', 'st-bgm-d', '「' + c.name + '」 — ' + c.author + ' — ' + c.license + ' — ');
      const a = document.createElement('a');
      a.href = c.url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.textContent = c.url;
      d.appendChild(a);
      body.appendChild(d);
    });
  }
  return stCard('♪', '音樂致謝', '遊戲中使用的第三方音樂與授權', 'fold', stCreditOpen, function () { stCreditOpen = !stCreditOpen; stRender(); }, stCreditOpen ? body : null);
}

let stAcMsg = '';

function stSoundSec() {
  const cfg = settingsGet();
  const nodes = [];
  stAdd(nodes, '安靜模式', stSwitch(cfg.quiet, function (v) {
    settingsSet('quiet', v);
    stRender();
  }), '開了以後只剩按鈕聲和重要提示音,背景音樂與環境音大幅變小,適合在安靜的地方玩。');
  nodes.push(stVolBlock('音樂', 'music'));
  nodes.push(stEl('p', 'st-hint st-note', '背景音樂的開關與音量;關掉就不再播放音樂。'));
  if (typeof bgmGroups === 'function' && typeof bgmAudition === 'function') nodes.push(stBgmCard());
  const stCr = stCreditsCard();
  if (stCr) nodes.push(stCr);
  nodes.push(stVolBlock('音效', 'sfx'));
  nodes.push(stEl('p', 'st-hint st-note', '蓋房子、點按鈕、戰鬥時的聲音;關掉後操作時不會有聲音。'));
  nodes.push(stVolBlock('環境音', 'amb'));
  nodes.push(stEl('p', 'st-hint st-note', '風聲、水聲、鳥鳴這類城市背景聲;嫌吵可以單獨關掉。'));
  stAdd(nodes, '跟隨靜音鍵', stSwitch(cfg.followSilent, function (v) {
    settingsSet('followSilent', v);
    stRender();
  }), '開了以後,手機側邊的靜音開關打開時遊戲也跟著沒聲音。');
  return stSec('聲音', nodes.concat(stExtraNodesH('聲音')), 'sound');
}

function stCityOn() { return typeof isCityOnly === 'function' && isCityOnly(); }

// 拍攝與錄影:入口由 recorder.js 以 settingsAddRow(group '拍攝') 登記;只在出征 / 回放 / 沙盤時放進聲音頁(stRender)
function stShotSec() {
  const nodes = stExtraNodesH('拍攝');
  if (!nodes.length) return null;
  return stSec('拍攝與錄影', nodes, 'sound');
}

// 畫質:低 / 中 / 高 一個開關管全部(實際寫入的偏好鍵見 perf.js qualityApply);自動 = 依裝置判斷
const ST_Q_NAME = { low: '低', mid: '中', high: '高' };
function stQualitySec() {
  if (typeof qualitySet !== 'function' || typeof qualityLevel !== 'function') return null;
  const nodes = [];
  const mode = typeof qualityMode === 'function' ? qualityMode() : 'auto';
  const lv = qualityLevel();
  stAdd(nodes, '畫質', stSeg([['auto', '自動'], ['low', '低'], ['mid', '中'], ['high', '高']], mode, function (v) {
    qualitySet(v);
    stRender();
  }), '自動:依你的手機 / 電腦效能幫你選(目前:' + ST_Q_NAME[lv] + ')。低:最省電、不燙,特效與背景效果較少。中:一般建議。高:最流暢、效果最完整,比較耗電。');
  return stSec('畫質', nodes, 'sound');
}

// 清理快取:清掉下載的圖片 / 音效快取 / 程式快取並重新載入。只動 Cache Storage、Service Worker、音效快取資料庫;
// 不碰 localStorage(lorddomain.* 存檔與偏好)與存檔用的 IndexedDB(lorddomain-saves)
function stCacheClear() {
  const msg = '會清除下載的圖片與音效快取,不會刪除存檔。\n下次會重新下載,需要網路。\n\n要清理嗎?';
  if (typeof confirm !== 'function' || !confirm(msg)) return;
  const hasCaches = typeof caches !== 'undefined' && caches && typeof caches.keys === 'function';
  const hasSw = typeof navigator !== 'undefined' && navigator.serviceWorker && typeof navigator.serviceWorker.getRegistrations === 'function';
  stAcMsg = '清理中…';
  stRender();
  if (typeof saveWorld === 'function') { try { saveWorld(); } catch (e) { console.warn('[st] save before clear failed', e); } }
  const jobs = [];
  if (typeof acClear === 'function') jobs.push(acClear());
  if (hasCaches) jobs.push(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k.indexOf('lorddomain-') === 0; }).map(function (k) { return caches.delete(k); }));
  }));
  if (hasSw) jobs.push(navigator.serviceWorker.getRegistrations().then(function (regs) {
    return Promise.all(regs.map(function (r) { return r.unregister(); }));
  }));
  Promise.all(jobs).then(function () {
    stAcMsg = '已清理,即將重新載入…';
    stRender();
    setTimeout(function () { location.reload(); }, 1000);
  }).catch(function (e) {
    console.warn('[st] clear cache failed', e);
    stAcMsg = '清理失敗,請稍後再試或關閉遊戲重開。存檔沒有受影響。';
    stRender();
  });
}

function stCacheSec() {
  const nodes = [];
  const btn = stEl('button', 'st-sw', '清理快取');
  btn.setAttribute('aria-label', '清理快取');
  btn.addEventListener('click', stCacheClear);
  stAdd(nodes, '清理快取', btn, '畫面或聲音怪怪的、或想釋放手機空間時使用。會清除下載的圖片與音效快取,不會刪除存檔;下次開啟會重新下載,需要網路。');
  if (stAcMsg) nodes.push(stEl('p', 'st-hint st-warn', stAcMsg));
  return stSec('清理快取', nodes, 'more');
}

// 介紹類卡片:有邊框底色、左圖示 + 標題 + 灰色副標、右側「展開 / 開啟」小標籤與箭頭;kind 'fold' 可展開收合(body 內容),'open' 點了開啟別的面板
function stCard(icon, title, sub, kind, isOpen, onClick, bodyNode) {
  const card = stEl('div', 'st-card ' + kind + (isOpen ? ' open' : ''));
  const h = stEl('button', 'st-card-h');
  h.appendChild(stEl('span', 'st-card-ic', icon));
  const tx = stEl('span', 'st-card-tx');
  tx.appendChild(stEl('b', '', title));
  tx.appendChild(stEl('small', '', sub));
  h.appendChild(tx);
  h.appendChild(stEl('span', 'st-card-tag', kind === 'fold' ? (isOpen ? '收起' : '展開') : '開啟'));
  h.appendChild(stEl('span', 'st-card-ar', kind === 'fold' ? '▸' : '›'));
  if (kind === 'fold') h.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  h.addEventListener('click', onClick);
  card.appendChild(h);
  if (bodyNode) {
    const b = stEl('div', 'st-card-b');
    b.appendChild(bodyNode);
    card.appendChild(b);
  }
  return card;
}

// 兵種圖鑑入口(戰鬥中不顯示,與其他畫面設定同規則)
function stDexCard() {
  return stCard('📚', '兵種圖鑑', '查看每種兵種的能力與開放等級', 'open', false, function () {
    stClosePanel();
    if (typeof unitDexOpen === 'function') unitDexOpen();
  });
}

function stHelpSec() {
  let nodes = [];
  if (!stCityOn()) nodes.push(stDexCard());   // 兵種圖鑑:城建專注模式隱藏
  nodes = nodes.concat(stExtraNodes('說明'));
  if (!nodes.length) return null;
  return stSec('圖鑑', nodes, 'more');
}

function stAboutSec() {
  const ver = stEl('p', 'st-ver', '版本 ' + (stVerText || '讀取中…'));
  stVerEl = ver;
  const credit = stEl('p', 'st-credit', '本遊戲美術與音效由程式自行繪製合成,目前未使用第三方素材。');
  return stSec('關於', [ver, credit], 'more');
}

// 危險操作:只留一個「重新開始遊戲」;先問一次(這裡),再走 savesDoAction('all') 的確認與自動備份
function stDangerSec() {
  if (typeof savesDoAction !== 'function') return null;
  const nodes = [stEl('p', 'st-hint st-warn', '下面的按鈕會清掉所有進度。按下後會再確認一次,並先自動備份;聲音、畫質等偏好設定會保留。')];
  const b = stEl('button', 'st-btn-danger', '重新開始遊戲(清除所有進度)…');
  b.style.minHeight = '44px';
  b.style.display = 'block';
  b.style.width = '100%';
  b.style.textAlign = 'left';
  b.addEventListener('click', function () {
    if (typeof confirm !== 'function' || !confirm('真的要重新開始遊戲嗎?\n目前所有進度都會被清掉(聲音、畫質等設定會保留)。\n清除前會自動備份。')) return;
    stClosePanel();
    savesDoAction('all');
  });
  nodes.push(b);
  return stSec('⚠ 危險操作', nodes, 'more', 'st-sec-danger');
}

function stTabOf(sec) {
  return sec.stTab;
}

function stRender() {
  if (!stBodyEl) return;
  const battle = stInBattle();
  const prevTop = stBodyEl.scrollTop || 0;
  const prevTab = stBodyEl.stShown || '';
  if (!stCurTab) stCurTab = stTabLoad();
  stBodyEl.innerHTML = '';
  const secs = [];
  const add = function (sec) { if (sec) secs.push(sec); };
  add(stQualitySec());
  add(stSoundSec());
  const builtin = ['聲音', '畫面', '拍攝', '說明', '關於', '危險區', '世界與重新開始', '目前世界的陣地', '畫質', '清理快取', '圖鑑'];
  stExtraRows.forEach(function (r) {
    if (builtin.indexOf(r.group) >= 0) return;
    const nodes = stExtraNodes(r.group);
    if (!nodes.length) return;
    builtin.push(r.group);
    add(stSec(r.group, nodes, 'more'));
  });
  if (battle) {
    // 出征 / 回放 / 沙盤:只留聲音;外部登記的列(如拍攝)也放在聲音頁
    add(stShotSec());
    secs.forEach(function (sec) { sec.setAttribute('data-tab', 'sound'); sec.stTab = 'sound'; });
  } else {
    add(stHelpSec());
    add(stCacheSec());
    add(stAboutSec());
    add(stDangerSec());
  }
  const order = ST_TABS.map(function (t) { return t.id; });
  const live = battle ? ['sound'] : order.filter(function (id) { return secs.some(function (sc) { return stTabOf(sc) === id; }); });
  if (live.indexOf(stCurTab) < 0) stCurTab = live[0] || 'sound';
  secs.forEach(function (sec) { stBodyEl.appendChild(sec); });
  stBodyEl.stShown = battle ? 'sound' : stCurTab;
  stBodyEl.setAttribute('data-tab', stBodyEl.stShown);
  stRenderTabs(battle ? [] : live);
  if (prevTab === stBodyEl.stShown) stBodyEl.scrollTop = prevTop;
  else stBodyEl.scrollTop = 0;
}

function stRenderTabs(live) {
  if (!stTabBarEl) return;
  stTabBarEl.innerHTML = '';
  stTabBarEl.hidden = !live.length;
  live.forEach(function (id) {
    const t = ST_TABS.filter(function (x) { return x.id === id; })[0];
    const b = stEl('button', 'st-tab' + (id === stCurTab ? ' on' : ''), t.name);
    b.setAttribute('role', 'tab');
    b.setAttribute('data-tab', id);
    b.setAttribute('aria-selected', id === stCurTab ? 'true' : 'false');
    b.addEventListener('click', function () {
      if (id === stCurTab) return;
      stCurTab = id;
      stTabSave(id);
      if (typeof bgmAuditionStop === 'function') bgmAuditionStop();
      stRender();
    });
    stTabBarEl.appendChild(b);
  });
}

function stOpenPanel() {
  if (!stRootEl) return;
  if (typeof AU === 'object' && AU.unlock) AU.unlock();
  stRender();
  stRootEl.classList.add('st-open');
  stIsOpen = true;
  if (typeof panelCoverSet === 'function') panelCoverSet('settings', true);   // 收起建造浮層與浮卡(panelmgr.js)
}

function stClosePanel() {
  if (!stRootEl) return;
  stRootEl.classList.remove('st-open');
  stIsOpen = false;
  if (typeof panelCoverSet === 'function') panelCoverSet('settings', false);
  if (typeof bgmAuditionStop === 'function') bgmAuditionStop();
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
  stTabBarEl = stEl('div', 'st-tabs');
  stTabBarEl.setAttribute('role', 'tablist');
  drawer.appendChild(stTabBarEl);
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
  if (typeof qualityBoot === 'function') { try { qualityBoot(); } catch (e) { console.warn('[st] quality boot failed', e); } }
  stBuildRoot();
  document.addEventListener('keydown', function (e) {
    if (stIsOpen && e.key === 'Escape') stClosePanel();
  });
  settingsGet();
  stLoadVersion();
  setTimeout(stApplyAutoSeason, 0);
  setInterval(stApplyAutoSeason, 3600000);
}

if (typeof document !== 'undefined' && document.readyState) {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initSettingsUI);
  else initSettingsUI();
}

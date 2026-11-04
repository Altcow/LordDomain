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
  { id: 'view', name: '畫面操作' },
  { id: 'sound', name: '聲音' },
  { id: 'world', name: '世界存檔' },
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
  return 'view';
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
  const desc = shown ? shown.name + ':' + shown.desc + '(' + shown.bpm + ' BPM)' : '每次進入場景依序換一首,共 ' + tracks.length + ' 首';
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

// 玩法模式:城建專注(明顯區隔,獨立區塊)
function stPlaySec() {
  const nodes = [];
  if (typeof setCityOnly === 'function') {
    stAdd(nodes, '城建專注模式', stSwitch(stCityOn(), function (v) {
      setCityOnly(v);
      if (typeof buildToolbar === 'function') buildToolbar();
      if (typeof syncSideBar === 'function') syncSideBar();
      if (typeof progUiRefresh === 'function') progUiRefresh();
      stRender();
    }), '隱藏釣魚、仙獸、戰鬥,專心蓋城。升級改靠蓋出新種類建築、擴大城市,不需要材料與首領營;關閉後恢復原本規則(已累積的經驗保留)。');
  }
  if (!nodes.length) return null;
  return stSec('玩法模式', nodes, 'view', 'st-sec-mode');
}

// 畫面與操作:介面模式、提示、範本、城市風格
function stUiSec() {
  const nodes = [];
  if (typeof uiSetMode === 'function') {
    const curMode = typeof uiGetMode === 'function' ? uiGetMode() : 'normal';
    stAdd(nodes, '介面模式', stSeg([['normal', '正常'], ['compact', '精簡']].concat(isUnlocked('feature', 'photo') ? [['photo', '拍照']] : []), curMode, function (v) {
      if (v === 'photo') stClosePanel();
      uiSetMode(v);
      stRender();
    }), '正常:所有按鈕都在。精簡:按鈕縮小、騰出更多地圖空間。' + (isUnlocked('feature', 'photo') ? '拍照:隱藏全部按鈕,方便截圖。' : ''));
  }
  if (typeof nsSetEnabled === 'function') {
    stAdd(nodes, '推薦下一步', stSwitch(nsEnabled(), function (v) {
      nsSetEnabled(v);
      if (typeof nsUiRefresh === 'function') nsUiRefresh(true);
      stRender();
    }), '右上角的小提示,一步步告訴你可以先做什麼;卡上 ✕ 只關掉那一則。關掉後不再出現提示卡。');
  }
  return stSec('畫面', nodes.concat(stExtraNodesH('畫面')), 'view');
}

// 拍攝與錄影:入口由 recorder.js 以 settingsAddRow(group '拍攝') 登記,未開放時整區不顯示
function stShotSec() {
  const nodes = stExtraNodesH('拍攝');
  if (!nodes.length) return null;
  return stSec('拍攝與錄影', nodes, 'view');
}

// 美術與居民
function stArtSec() {
  const nodes = [];
  if (typeof lifeSetOn === 'function') {
    const lifeOn = typeof lifeGetOn === 'function' ? !!lifeGetOn() : true;
    stAdd(nodes, '路上居民 👥', stSwitch(lifeOn, function (v) {
      lifeSetOn(v);
      stRender();
    }), '開了,街上會有小人走來走去,讓城市有生氣;關掉可以更順、更省電,對遊戲內容沒有影響。');
  }
  if (typeof lifeSetDensity === 'function' && typeof lifeGetDensity === 'function') {
    stAdd(nodes, '居民密度', stSeg([['off', '關'], ['low', '少'], ['mid', '中'], ['high', '多'], ['crowd', '熱鬧']], lifeGetDensity(), function (v) {
      lifeSetDensity(v);
      stRender();
    }), '街上同時出現多少小人。越多越熱鬧,但手機會比較燙、比較耗電。');
  }
  if (!nodes.length) return null;
  return stSec('美術與居民', nodes, 'view');
}

// 進階:少人用的設定集中在最後一個分頁(新美術合併開關、外部建築圖、流暢度、繪圖引擎、音效快取、世界小標籤)
// 新美術合併開關:顯示=存在的三項皆開(任一關即顯示關);切換時三個既有偏好鍵一起寫齊(鍵名與讀取邏輯不變)
function stNewArtOn() {
  if (typeof artSetOn === 'function' && !(typeof ART_ON !== 'undefined' ? !!ART_ON : true)) return false;
  if (typeof uiIconsSetOn === 'function' && !uiIconsOn()) return false;
  if (typeof terrainTexSetOn === 'function' && !terrainTexOn()) return false;
  return true;
}

function stNewArtSet(v) {
  if (typeof artSetOn === 'function') artSetOn(v);
  if (typeof uiIconsSetOn === 'function') {
    uiIconsSetOn(v);
    if (typeof advUiRefresh === 'function') advUiRefresh(true);
    if (typeof nsUiRefresh === 'function') nsUiRefresh(true);
  }
  if (typeof terrainTexSetOn === 'function') terrainTexSetOn(v);
}

// 流暢度:對應 perf.js 兩個既有旗標。省電=省電模式開(一律 30 幀);平衡=省電關、操作時 30 幀;流暢=省電關、操作時 60 幀(預設)
function stFluencyGet() {
  if (isPowerSave()) return 'save';
  return perfGetFps() === 60 ? 'smooth' : 'bal';
}

function stFluencySet(v) {
  if (v === 'save') {
    perfSetPowerSave(true);
    perfSetFps(30);
  } else {
    perfSetPowerSave(false);
    perfSetFps(v === 'smooth' ? 60 : 30);
  }
}

function stAdvSec() {
  const nodes = [];
  if (typeof artSetOn === 'function' || typeof uiIconsSetOn === 'function' || typeof terrainTexSetOn === 'function') {
    stAdd(nodes, '新美術', stSwitch(stNewArtOn(), function (v) {
      stNewArtSet(v);
      stRender();
    }), '開了會用新畫的建築、地面貼圖、圖示與日夜光暈;關掉就回到最簡單的舊畫面,比較省電。');
  }
  if (typeof extSpritesSetOn === 'function') {
    stAdd(nodes, '使用外部建築圖(試裝)', stSwitch(extSpritesOn(), function (v) {
      extSpritesSetOn(v);
      stRender();
    }), '試用中的另一套建築圖片;開了部分建築外觀會不同,不影響玩法。看到怪怪的就關掉。');
  }
  if (typeof perfSetFps === 'function') {
    stAdd(nodes, '流暢度', stSeg([['save', '省電'], ['bal', '平衡'], ['smooth', '流暢']], stFluencyGet(), function (v) {
      stFluencySet(v);
      if (v === 'smooth' && typeof showToast === 'function') showToast('操作時用 60 較順;不操作時自動降到 30 省電');
      stRender();
    }), '省電:一律 30 幀、居民少一級且動作較稀、水面靜止、音樂較簡單,最不燙。平衡:操作時 30 幀。流暢:拖曳縮放時 60 幀,看著城市不動時降到 30。只影響動作順不順,不影響畫質。');
  }
  if (typeof renderSetBackend === 'function') {
    stAdd(nodes, '繪圖引擎', stSeg([['c2d', '標準'], ['gl', '加速(實驗)']], renderGetBackend(), function (v) {
      renderSetBackend(v);
      if (v === 'gl' && typeof showToast === 'function') showToast('加速繪圖(實驗):下一個畫面起生效;若無法使用會自動改回標準');
      stRender();
    }), '加速(實驗)用 WebGL 合成建築與居民,地形與介面仍用標準畫法;手機若出現黑畫面或異常請改回標準。錄影與拍照時會自動使用標準繪圖。');
  }
  if (typeof acClear === 'function') {
    const cb = stEl('button', 'st-sw', stAcMsg || '清除');
    cb.setAttribute('aria-label', '清除音效快取');
    cb.addEventListener('click', function () {
      acClear().then(function (ok) {
        stAcMsg = ok ? '已清除' : '清除失敗';
        stRender();
      });
    });
    stAdd(nodes, '音效快取', cb, '遊戲會把合成好的音效存在手機裡加快載入。聲音怪怪的才需要清除,下次啟動會重新合成(不影響存檔)。');
  }
  if (typeof savesUiOpen === 'function' && typeof worldTagOn === 'function') {
    nodes.push(stSaveBtn('世界小標籤:' + (worldTagOn() ? '顯示' : '隱藏'), '頂列的「世 NN」,點它開啟我的世界', function () { try { localStorage.setItem(WORLD_TAG_KEY, worldTagOn() ? '0' : '1'); } catch (e) { /* 略過 */ } if (typeof svTagSync === 'function') svTagSync(); stRender(); }));
    nodes.push(stEl('p', 'st-hint st-note', '決定畫面頂端要不要顯示目前是第幾個世界的小標籤,只影響外觀。'));
  }
  if (!nodes.length) return null;
  return stSec('進階設定', nodes, 'more');
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

function stHowtoBody() {
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
  return wrap;
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

// 頂列圖示說明(點開才列出目前已開放的圖示)
let stIconOpen = false;
let stHowtoOpen = false;
const ST_ICON_LEGEND = [
  { icon: '🔨', name: '草稿布置(右側欄):另開一份草稿來設計,改完 💾 儲存到版面格,不影響正在用的城;平時直接點下方建築蓋即可(即時生效)' },
  { icon: '🏘', city: '版面選擇(右側欄第一個):打開 3 格版面小面板,點一格把整座城換成那一格;「空」= 還沒存,點了可把目前版面存進去;面板不會自動關閉,再點一次該鈕才收起', name: '經營 / 戰鬥(右側欄第一個):打開 3 格版面小面板,點一格把整座城 / 整個戰陣換成那一格;「空」= 還沒存,點了可把目前版面存進去;面板不會自動關閉,再點一次該鈕才收起' },
  { icon: '📋', name: '任務(右側欄):打開全畫面任務清單,並讓左上任務提示條重新顯示(提示條上的 ✕ 可再收起)' },
  { icon: '📋', name: '範本(設定→畫面):選了範本會載入到草稿,不會直接蓋掉你正在用的版面' },
  { icon: '⚔', hideInCity: true, name: '戰鬥選單(左下;內含 📜 戰報／錄影)' },
  { icon: '👁', name: '隱藏建築(整地用,H)' },
  { icon: '↻', name: '旋轉建築:虛影旁的浮動圖示 ↻(電腦可按 R);已蓋建築按住約半秒拿起,拖曳到想要的位置放開即落地,不拖曳放開則出現 ↻ 🗑 ✓ ✕;頂列已無旋轉鈕' },
  { icon: '🎣', name: '釣魚', feat: 'fishing' },
  { icon: '🐲', name: '仙獸苑', feat: 'pet' },
  { icon: '⚙', name: '設定' }
];
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

function stIconCard() {
  const list = stEl('ul', 'st-iconlist');
  if (stIconOpen) {
    ST_ICON_LEGEND.forEach(function (it) {
      if (it.feat && !isUnlocked('feature', it.feat)) return;
      if (it.hideInCity && stCityOn()) return;
      list.appendChild(stEl('li', '', it.icon + '  ' + (it.city && stCityOn() ? it.city : it.name)));
    });
  }
  return stCard('🧭', '頂列圖示說明', '各個圖示按鈕是做什麼的', 'fold', stIconOpen, function () { stIconOpen = !stIconOpen; stRender(); }, stIconOpen ? list : null);
}

// 兵種圖鑑入口(戰鬥中不顯示,與其他畫面設定同規則)
function stDexCard() {
  return stCard('📚', '兵種圖鑑', '查看每種兵種的能力與開放等級', 'open', false, function () {
    stClosePanel();
    if (typeof unitDexOpen === 'function') unitDexOpen();
  });
}

function stGuideCard() {
  return stCard('📖', '功能說明', '所有基本操作的介紹,可重看示範', 'open', false, function () {
    stClosePanel();
    if (typeof guideListOpen === 'function') guideListOpen();
  });
}

function stHowtoCard() {
  return stCard('🖥', '如何看更大畫面', '加入主畫面、隱藏瀏覽器列、全螢幕', 'fold', stHowtoOpen, function () { stHowtoOpen = !stHowtoOpen; stRender(); }, stHowtoBody());
}

function stHelpSec() {
  const nodes = [];
  if (typeof guideListOpen === 'function') nodes.push(stGuideCard());
  nodes.push(stIconCard());
  if (!stCityOn()) nodes.push(stDexCard());   // 兵種圖鑑:城建專注模式隱藏
  nodes.push(stHowtoCard());
  return stSec('說明', nodes.concat(stExtraNodes('說明')), 'more');
}

function stAboutSec() {
  const ver = stEl('p', 'st-ver', '版本 ' + (stVerText || '讀取中…'));
  stVerEl = ver;
  const credit = stEl('p', 'st-credit', '本遊戲美術與音效由程式自行繪製合成,目前未使用第三方素材。');
  return stSec('關於', [ver, credit], 'more');
}

// 世界與重新開始 / 目前世界的陣地:我的世界面板 / 復原上一步 / 重新開始 / 清除陣地 / 清空領地(邏輯在 saveslots.js、savesui.js;每個動作先彈說明確認並自動備份到復原槽)
function stSaveBtn(label, sub, onclick, danger) {
  const b = stEl('button', danger ? 'st-btn-danger' : 'st-link', label + (sub ? ' — ' + sub : ''));
  b.style.minHeight = '44px';
  b.style.display = 'block';
  b.style.width = '100%';
  b.style.textAlign = 'left';
  b.addEventListener('click', onclick);
  return b;
}

// 世界與存檔:一般操作(不會清掉東西)
function stWorldSec() {
  const nodes = [];
  const ok = typeof savesAvailable === 'function' && savesAvailable();
  if (typeof worldTitle === 'function') {
    const w = worldsGet();
    nodes.push(stEl('div', 'st-hint', '目前:' + worldTitle(w.active, w.names[w.active])));
  }
  if (typeof savesUiOpen === 'function') {
    nodes.push(stSaveBtn('我的世界(' + WORLD_COUNT + ')', ok ? '切換 / 重新開始 / 改名 / 回溯點' : '此裝置無法多世界', function () { stClosePanel(); savesUiOpen(); }));
    nodes.push(stEl('p', 'st-hint st-note', '你有好幾個互相獨立的存檔(平行世界),可以在這裡切換、改名,或回到之前的時間點。'));
    nodes.push(stSaveBtn('復原上一步', ok ? '救回剛被重新開始 / 刪除 / 切換前的內容' : '此裝置無法使用', function () { stClosePanel(); savesUiUndo(); }));
    nodes.push(stEl('p', 'st-hint st-note', '不小心按到重新開始或刪除時,按這個可以救回剛才的內容(只救最近一次)。'));
  }
  if (!nodes.length) return null;
  return stSec('世界與存檔', nodes, 'world');
}

// 目前世界的陣地:經營 / 戰陣兩塊地圖板(與平行世界無關),只影響目前這個世界;每個動作先彈說明確認並自動備份到復原槽
function stCampSec() {
  const nodes = [stEl('div', 'st-hint', '只影響目前這個世界;不影響其他世界。')];
  if (typeof savesDoAction === 'function') {
    if (!stCityOn()) nodes.push(stSaveBtn('清除陣地…', '只清目前世界的戰陣板,其餘不動', function () { stClosePanel(); savesDoAction('camp'); }, true));
    nodes.push(stSaveBtn('清空領地…', '只清目前世界的領地建築與地形,資源與科技保留', function () { stClosePanel(); savesDoAction('estate'); }, true));
  }
  return nodes;
}

// 危險操作:醒目紅框獨立區塊;每個動作都會先彈出確認並自動備份,可用「復原上一步」救回
function stDangerSec() {
  if (typeof savesDoAction !== 'function') return null;
  const nodes = [stEl('p', 'st-hint st-warn', '下面的按鈕會清掉內容。按下後會先跳出確認說明並自動備份,按錯了可用上面的「復原上一步」救回。')];
  nodes.push(stSaveBtn('重新開始目前世界…', '只影響目前這個世界,偏好設定保留', function () { stClosePanel(); if (typeof worldWizardOpen === 'function' && worldWizardOpen({ kind: 'restart', n: worldsActive(), from: 'settings' })) return; savesDoAction('all'); }, true));
  return stSec('⚠ 危險操作', nodes.concat(stCampSec()), 'world', 'st-sec-danger');
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
  add(stSoundSec());
  const builtin = ['聲音', '畫面', '拍攝', '說明', '關於', '危險區', '世界與重新開始', '目前世界的陣地'];
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
    add(stPlaySec());
    add(stUiSec());
    add(stShotSec());
    add(stArtSec());
    add(stWorldSec());
    add(stDangerSec());
    add(stHelpSec());
    add(stAboutSec());
    add(stAdvSec());
  }
  const order = ST_TABS.map(function (t) { return t.id; });
  const live = battle ? ['sound'] : order.filter(function (id) { return secs.some(function (sc) { return stTabOf(sc) === id; }); });
  if (live.indexOf(stCurTab) < 0) stCurTab = live[0] || 'view';
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
}

function stClosePanel() {
  if (!stRootEl) return;
  stRootEl.classList.remove('st-open');
  stIsOpen = false;
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

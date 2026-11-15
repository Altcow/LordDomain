// js/title_cover.js — 封面 → 選伺服器 → 開始遊戲(B 包;旗標 shell 之後;流程借鏡 MageSandbox 封面,美術不複製)。
// 掛點:覆寫 saveslots.js 的 worldsStartup。main.js 的 bootWorlds 在 DOMContentLoaded 才以全域名查找,故本檔須在 main.js 之前載入(index.html)。
// worldsStartup 做完存檔遷移 / 切換中斷復原後才進封面;按『開始遊戲』才呼叫 boot(不重複初始化)。
// 旗標 shell 關閉或網址 ?nocover=1:直接 fn(),與 v61 相同。localStorage / IDB 一律 try/catch;讀寫失敗仍可進遊戲。
// 伺服器 S01~S03 = 存檔槽 1~3(平行世界編號);單機階段只是標籤 + 各自獨立存檔。非使用中伺服器的切換走 worldsEnter(既有流程,目前休眠於 multiworld 旗標,會回 dormant)。
// 全域名稱:TC_SERVERS TC_PREF_KEY titleCoverGate tcEnabled
// open:false = 尚未開放(顯示但灰掉、不可點、標『即將開放』);單機階段只開 S01。日後開放伺服世界時改成 open:true。
var TC_SERVERS = [
  { id: 'S01', name: '中原逐鹿', slot: 1, open: true },
  { id: 'S02', name: '江東烽火', slot: 2, open: false },
  { id: 'S03', name: '巴蜀天險', slot: 3, open: false }
];
var TC_PREF_KEY = 'lorddomain.ui.titleServer';   // 上次選的伺服器(偏好鍵,已登錄 saveslots.js SAVE_PREF_KEYS)
var TC_FLASH_MS = 400;
var TC_UNITS = { L: ['spear', 'cav', 'shield'], R: ['bow', 'strat', 'cav'] };   // 兩側各 3 個不同兵種
var TC_FLIP_R = true;   // 右側朝左:素材預設朝右時翻轉(目視確認後調整)
var tcSt = null;

function tcEnabled() {
  try { if (typeof shellOn !== 'function' || !shellOn()) return false; } catch (e) { return false; }
  try { if (/[?&]nocover=1(&|$)/.test(String(window.location.search || ''))) return false; } catch (e2) { /* 略過 */ }
  return true;
}
function tcReduced() {
  try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; }
}
function tcLsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function tcLsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* 略過 */ } }
function tcEl(tag, cls, text) {
  var e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined && text !== null) e.textContent = text;
  return e;
}
function tcBtn(text, cls, fn) {
  var b = tcEl('button', cls, text);
  b.setAttribute('type', 'button');
  if (fn) b.addEventListener('click', fn);
  return b;
}
function tcUrl(id) {
  try { return typeof uiAssetUrl === 'function' ? uiAssetUrl(id) : null; } catch (e) { return null; }
}
function tcServerById(id) {
  for (var i = 0; i < TC_SERVERS.length; i++) if (TC_SERVERS[i].id === id) return TC_SERVERS[i];
  return null;
}
function tcOpen(srv) { return !!srv && srv.open === true; }
function tcFirstOpen() {
  for (var i = 0; i < TC_SERVERS.length; i++) if (tcOpen(TC_SERVERS[i])) return TC_SERVERS[i].id;
  return TC_SERVERS[0].id;
}
function tcPrefSel() { var v = tcLsGet(TC_PREF_KEY), s = tcServerById(v); return tcOpen(s) ? v : tcFirstOpen(); }
function tcCurSrv() { return tcSt ? tcServerById(tcSt.sel) : null; }
function tcSay(msg) { if (tcSt && tcSt.msg) tcSt.msg.textContent = msg || ''; }
function tcConfirm(msg) {
  try { return typeof confirm === 'function' ? !!confirm(msg) : false; } catch (e) { return false; }
}
function tcTime(ts) {
  try { return typeof savesTimeText === 'function' ? savesTimeText(ts) : ''; } catch (e) { return ''; }
}

// 入口(由 worldsStartup 掛點呼叫):fn = boot。旗標關閉 / ?nocover=1 → 直接 fn()
function titleCoverGate(fn) {
  if (!tcEnabled()) { fn(); return; }
  if (tcSt) return;
  tcSt = { fn: fn, root: null, panel: null, started: false, sel: tcPrefSel(), info: null, activeSlot: 1, list: null, hint: null, big: null, newBtn: null, delBtn: null, msg: null, ver: null, sndBtns: [], keyFn: null };
  tcBuild();
}

function tcBuild() {
  var root = tcEl('div'), bg = tcEl('div', 'tc-bg'), shade = tcEl('div', 'tc-shade'), flash = tcEl('div', 'tc-flash');
  var title = tcEl('div', 'tc-title'), logoUrl = tcUrl('home_logo'), logo, press, snd, ver, bgUrl, img;
  root.id = 'titleCover';
  root.className = 'tc-root';
  bgUrl = tcUrl(window.innerHeight >= window.innerWidth ? 'bg_stage_port' : 'bg_stage_land');
  if (bgUrl) {
    img = new Image();
    img.onload = function () { bg.style.backgroundImage = 'url("' + bgUrl + '")'; };
    img.src = bgUrl;
  }
  if (logoUrl) { logo = tcEl('img', 'tc-logo-img'); logo.alt = '東漢Q卡'; logo.src = logoUrl; title.appendChild(logo); }
  else title.appendChild(tcEl('div', 'tc-logo', '東漢Q卡'));
  press = tcEl('div', 'tc-press', '點擊任意處開始');
  snd = tcBtn('', 'tc-snd', function (ev) { if (ev && ev.stopPropagation) ev.stopPropagation(); tcToggleSound(); });
  ver = tcEl('div', 'tc-ver', '');
  root.appendChild(bg);
  root.appendChild(shade);
  root.appendChild(title);
  root.appendChild(tcUnits('L'));
  root.appendChild(tcUnits('R'));
  root.appendChild(press);
  root.appendChild(flash);
  root.appendChild(snd);
  root.appendChild(ver);
  root.appendChild(tcPanelBuild());
  root.addEventListener('click', tcOnTap);
  tcSt.root = root;
  tcSt.sndBtns.unshift(snd);
  tcSt.ver = ver;
  tcSt.keyFn = function (ev) { if (!tcSt || tcSt.started) return; if (ev.key === 'Enter' || ev.key === ' ') tcStart(); };
  document.addEventListener('keydown', tcSt.keyFn);
  document.body.appendChild(root);
  tcSoundLabel();
  try {
    if (typeof savesLoadAppVer === 'function') {
      savesLoadAppVer().then(function (n) { if (tcSt && tcSt.ver && n) tcSt.ver.textContent = 'v' + n; }, function () { /* 略過 */ });
    }
  } catch (e) { /* 略過 */ }
}

// 兩側各 3 位 Q 版路人(pp_* 隨機變體);右側預設翻轉朝左。呼吸動畫交給 CSS
function tcUnits(side) {
  var box = tcEl('div', 'tc-units tc-units-' + side.toLowerCase()), fams = TC_UNITS[side], i, v, url, wrap, img;
  for (i = 0; i < fams.length; i++) {
    v = 1 + Math.floor(Math.random() * 6);
    url = tcUrl('pp_' + fams[i] + '_' + v) || tcUrl('pp_' + fams[i] + '_1');
    if (!url) continue;
    wrap = tcEl('div', 'tc-unit' + (side === 'R' && TC_FLIP_R ? ' tc-flip' : ''));
    wrap.style.animationDelay = (i * 0.45 + (side === 'R' ? 0.2 : 0)).toFixed(2) + 's';
    img = tcEl('img');
    img.alt = '';
    img.src = url;
    wrap.appendChild(img);
    box.appendChild(wrap);
  }
  return box;
}

function tcPanelBuild() {
  var panel = tcEl('div', 'tc-panel'), card = tcEl('div', 'tc-card'), row, setRow, sb;
  panel.hidden = true;
  tcSt.list = tcEl('div', 'tc-srv-list');
  tcSt.hint = tcEl('div', 'tc-hint', '');
  tcSt.big = tcBtn('開始遊戲', 'tc-btn-big', tcStartGame);
  tcSt.newBtn = tcBtn('新遊戲(覆蓋既有存檔)', 'tc-btn tc-btn-danger', tcNewGame);
  tcSt.delBtn = tcBtn('刪除此伺服器存檔', 'tc-btn tc-btn-danger', tcDelete);
  row = tcEl('div', 'tc-row');
  row.appendChild(tcSt.newBtn);
  row.appendChild(tcSt.delBtn);
  sb = tcBtn('設定 · 音效', 'tc-btn', tcToggleSound);
  tcSt.sndBtns.push(sb);
  setRow = tcEl('div', 'tc-row');
  setRow.appendChild(sb);
  tcSt.msg = tcEl('div', 'tc-msg', '');
  card.appendChild(tcEl('div', 'tc-h', '選擇伺服器'));
  card.appendChild(tcSt.list);
  card.appendChild(tcSt.hint);
  card.appendChild(tcSt.big);
  card.appendChild(row);
  card.appendChild(setRow);
  card.appendChild(tcSt.msg);
  panel.appendChild(card);
  tcSt.panel = panel;
  return panel;
}

function tcOnTap() { if (tcSt && !tcSt.started) tcStart(); }

// 點任意處 → 銀白淡閃(0.4 秒;減少動態時略過)→ 選伺服器畫面
function tcStart() {
  if (!tcSt || tcSt.started) return;
  tcSt.started = true;
  if (tcReduced()) { tcToServers(); return; }
  tcSt.root.classList.add('tc-flash-on');
  setTimeout(tcToServers, TC_FLASH_MS);
}

function tcToServers() {
  if (!tcSt) return;
  tcSt.root.classList.remove('tc-flash-on');
  tcSt.root.classList.add('tc-srv-on');
  tcSt.panel.hidden = false;
  tcRenderAll();
  tcRefresh();
}

// 讀各伺服器(槽)摘要:使用中槽從 localStorage 進度鍵;其餘從 saveslots 的 meta(savesListMeta)。讀不到 = null(尚未建立角色)
function tcLoadInfo() {
  var w = { names: {} }, active = 1, main = null, byId = {}, list = Promise.resolve(null);
  try { w = worldsGet(); active = w.active; } catch (e) { w = { names: {} }; }
  try { main = savesLsGet(SAVE_KEY_MAIN); } catch (e2) { main = null; }
  TC_SERVERS.forEach(function (s) { if (s.slot === active) byId[s.id] = tcLocalInfo(main); });
  try {
    if (typeof savesAvailable === 'function' && savesAvailable()) list = savesListMeta().then(function (x) { return x; }, function () { return null; });
  } catch (e3) { list = Promise.resolve(null); }
  return list.then(function (lst) {
    TC_SERVERS.forEach(function (s) {
      if (s.slot === active) return;
      var m = lst && lst[s.slot];
      byId[s.id] = m ? { lv: m.lv || 0, ts: m.ts || 0 } : null;
    });
    return { byId: byId, active: active };
  });
}
function tcLocalInfo(main) {
  var lv = 0, ts = 0, s;
  if (main === null || main === undefined) return null;
  try { s = JSON.parse(main); ts = +s.lastTs || 0; } catch (e) { /* 略過 */ }
  try { lv = savesSummarize(savesCapture(), -1).lv || 0; } catch (e2) { /* 略過 */ }
  return { lv: lv, ts: ts };
}

function tcRefresh() {
  return tcLoadInfo().then(function (info) {
    if (!tcSt) return;
    tcSt.info = info.byId;
    tcSt.activeSlot = info.active;
    tcRenderAll();
  }, function () {
    if (!tcSt) return;
    tcSt.info = {};
    tcRenderAll();
  });
}

function tcInfoText(srv) {
  var inf;
  if (!tcOpen(srv)) return '即將開放';
  if (!tcSt || !tcSt.info) return '讀取中…';
  inf = tcSt.info[srv.id];
  if (!inf) return '尚未建立角色';
  return inf.ts ? '最後遊玩 ' + tcTime(inf.ts) : '已建立角色';
}

function tcRenderAll() {
  var i, srv, btn, inf, cur;
  if (!tcSt || !tcSt.list) return;
  tcSt.list.innerHTML = '';
  for (i = 0; i < TC_SERVERS.length; i++) {
    srv = TC_SERVERS[i];
    btn = tcBtn('', 'tc-srv' + (srv.id === tcSt.sel ? ' tc-sel' : '') + (tcOpen(srv) ? '' : ' tc-srv-off'), tcPickFn(srv.id));
    btn.disabled = !tcOpen(srv);
    btn.appendChild(tcEl('span', 'tc-srv-id', srv.id));
    btn.appendChild(tcEl('span', 'tc-srv-name', srv.name));
    btn.appendChild(tcEl('span', 'tc-srv-info', tcInfoText(srv)));
    tcSt.list.appendChild(btn);
  }
  cur = tcCurSrv();
  inf = cur && tcSt.info ? tcSt.info[cur.id] : null;
  tcSt.newBtn.hidden = !(cur && cur.slot === tcSt.activeSlot && inf);
  tcSt.delBtn.hidden = !(cur && cur.slot !== tcSt.activeSlot && inf);
  tcSt.hint.textContent = !tcSt.info ? '' : (inf ? '有存檔:開始遊戲 = 繼續遊戲' : '無存檔:開始遊戲 = 新遊戲');
}

function tcPickFn(id) {
  return function () {
    if (!tcSt || !tcOpen(tcServerById(id))) return;   // 尚未開放的伺服器不可選、不寫偏好、不顯示訊息
    tcSt.sel = id;
    tcLsSet(TC_PREF_KEY, id);
    tcSay('');
    tcRenderAll();
  };
}

// 開始遊戲:目前使用中的伺服器 → 直接進遊戲;其他伺服器 → 既有 worldsEnter(切換後 reload;目前休眠)
function tcStartGame() {
  var srv = tcCurSrv(), fn;
  if (!tcSt || !srv || !tcOpen(srv)) return;
  if (srv.slot === tcSt.activeSlot) {
    fn = tcSt.fn;
    tcRemove();
    fn();
    return;
  }
  tcSay('切換伺服器中…');
  Promise.resolve().then(function () { return worldsEnter(srv.slot); }).then(function (r) {
    if (r && r.ok) return;
    tcSay(tcSwitchText(r));
  }, function () { tcSay('切換失敗'); });
}
function tcSwitchText(r) {
  var why = r && r.reason;
  if (why === 'dormant') return '切換伺服器暫未開放(多世界功能休眠中),目前仍為使用中的伺服器';
  if (why === 'corrupt') return '該伺服器存檔損毀,未切換';
  if (why === 'idb') return '儲存空間無法使用,未切換';
  return '切換未完成(' + (why || '未知') + ')';
}

// 新遊戲:只針對使用中伺服器(覆蓋既有存檔)。第一次確認由本檔,第二次由 savesDoAction('all') 內建確認;會先備份復原點
function tcNewGame() {
  var srv = tcCurSrv();
  if (!tcSt || !srv || srv.slot !== tcSt.activeSlot) return;
  if (!tcConfirm('覆蓋「' + srv.id + ' ' + srv.name + '」的既有存檔,開始新遊戲?\n目前進度會先備份到復原點(設定 → 復原上一步)。')) { tcSay('已取消'); return; }
  tcSay('處理中…');
  Promise.resolve().then(function () { return savesDoAction('all', { confirm: tcConfirm }); }).then(function (r) {
    if (r && r.ok) return;
    tcSay(r && r.reason === 'declined' ? '已取消' : '新遊戲未完成(' + (r && r.reason) + ')');
  }, function () { tcSay('新遊戲失敗'); });
}

// 刪除非使用中伺服器的存檔:第一次確認由本檔,第二次由 worldsRemove 內建確認(可從復原上一步救回)
function tcDelete() {
  var srv = tcCurSrv();
  if (!tcSt || !srv || srv.slot === tcSt.activeSlot) return;
  if (!tcConfirm('刪除「' + srv.id + ' ' + srv.name + '」的存檔?\n會清掉該伺服器的全部進度(可從設定「復原上一步」救回)。')) { tcSay('已取消'); return; }
  Promise.resolve().then(function () { return worldsRemove(srv.slot, 'delete', { confirm: tcConfirm }); }).then(function (r) {
    tcSay(r && r.ok ? '已刪除 ' + srv.id : '刪除未完成(' + (r && r.reason) + ')');
    return tcRefresh();
  }, function () { tcSay('刪除失敗'); });
}

function tcSoundOn() {
  try { var c = settingsGet(); return !!(c.sfx && c.sfx.on); } catch (e) { return true; }
}
function tcToggleSound() {
  var on = tcSoundOn();
  try { settingsSet('sfx.on', !on); settingsSet('music.on', !on); } catch (e) { /* 略過 */ }
  tcSoundLabel();
}
function tcSoundLabel() {
  var t = '音效:' + (tcSoundOn() ? '開' : '關');
  if (tcSt) tcSt.sndBtns.forEach(function (b) { b.textContent = b === tcSt.sndBtns[0] ? t : '設定 · ' + t; });
}

function tcRemove() {
  if (!tcSt) return;
  try { if (tcSt.root && tcSt.root.parentNode) tcSt.root.parentNode.removeChild(tcSt.root); } catch (e) { /* 略過 */ }
  try { document.removeEventListener('keydown', tcSt.keyFn); } catch (e2) { /* 略過 */ }
  tcSt = null;
}

// 掛點:包住 saveslots.js 的 worldsStartup(存檔遷移 / 切換復原完成後才進封面)
(function tcHookStartup() {
  if (typeof worldsStartup !== 'function') return;
  var orig = worldsStartup;
  worldsStartup = function (fn) { orig(function () { titleCoverGate(fn); }); };
})();

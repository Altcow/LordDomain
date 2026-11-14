// js/shell.js — B 包主畫面外殼 App Shell(S0 骨架 + S1 轉向保存 + 首頁改版,app_shell_design §1/§3/§4/§5;使用者拍板:首頁無戰鬥)。
// 旗標 shell(features.js,預設 false;?shell=1 或 localStorage 覆寫)。旗標關閉時 shellInit 直接返回,DOM 不產生新元素,舊 #sideBar 照常建立。
// 底部 dock 7 顆:卡包 | 出征 | 活動 | 背包 | 工坊 | 戰報 | 設定;有子項者點開浮層(一次一個,點外面關閉),單一功能直接開啟。
// 首頁(主頁):頂列 52(頭像+名稱+Lv、提示晶片、錢/抽數/戰力)+ 風景場景(home_bg_port / home_bg_land,右上基本數據小面板可收合、透明底不擋點擊)+ 底部 dock 52;直立與橫向同一版面。首頁不放舞台、不跑 canvas、不放戰鬥入口。
// 戰役:shellBattleMap 先 bnUiOpen,再直接進副本地圖(bnUiSetPhase('map') + bnMapRender);練兵走 bnUiEntryDo('prac')。戰鬥畫面只在按『開始』後出現(bnUiStart)。
// 出征舞台(shellDraw / shellLoop)保留不刪;目前無掛載 canvas(SHELL.cv 為 null)故不動作,留給戰役分頁的展演(S2)。
// 狀態保存:SHELL.tab / SHELL.scroll 記錄;切分頁關閉上層面板;轉向只重排。
// 全域名稱:SHELL SHELL_DOCK SHELL_MAP SHELL_TOP_ITEMS SHELL_FPS shellOn shellLayout shellInit shellBuild shellDockOpen shellAct shellOpenBattle shellBattleMap shellEvents shellOnResize shellStageActive shellKick shellRefresh shellTeamUnits shellFmtMoney shellIcon
// 不改既有檔案的邏輯;只由 ui.js initUI 呼叫 shellInit。ES2017;不用 ?. ??。
var SHELL = { inited: false, tab: 'home', lo: '', el: null, cv: null, raf: 0, last: 0, cvW: 0, cvH: 0, P: null, vu: {}, team: null, teamT: 0, scroll: {}, btn: {}, txt: {}, ttl: 0, pv: '', ev: '', evEl: null, bgEl: null, bgId: '' };
// 底部單一 dock(7 顆):有 kids 者點開子浮層;kids.soon = 即將開放(灰字);無 kids 者直接執行 act。asset 為 UI_ASSETS 的 id。
var SHELL_DOCK = [
  { id: 'cards', label: '卡包', asset: 'nav_draw', glyph: '🃏', color: '#3d6a8a', kids: [{ k: '卡包', act: 'cards:R' }, { k: '卡冊', act: 'cards:X' }, { k: '傳承', act: 'cards:S' }] },
  { id: 'field', label: '出征', asset: 'nav_march', glyph: '⚔', color: '#8a4b2a', kids: [{ k: '戰役', act: 'battle' }, { k: '地圖', act: 'wm' }] },
  { id: 'event', label: '活動', asset: 'nav_event', glyph: '🎪', color: '#7a3a5a', kids: [{ k: '擂台', act: 'tour' }, { k: '試煉塔', soon: true }, { k: '切磋(對戰碼)', act: 'share' }, { k: '地圖', act: 'wm' }] },
  { id: 'pack', label: '背包', asset: 'nav_pack', glyph: '🎒', color: '#6a4a7a', kids: [{ k: '背包', act: 'goods' }, { k: '裝備', soon: true }] },
  { id: 'workshop', label: '工坊', asset: 'home_熔爐', glyph: '🔨', color: '#8a3a2a', kids: [{ k: '熔爐', act: 'cards:F' }, { k: '鍛造', soon: true }] },
  { id: 'report', label: '戰報', asset: 'short_mail', glyph: '📰', color: '#4a6a7a', act: 'log' },
  { id: 'set', label: '設定', asset: 'short_settings', glyph: '⚙', color: '#555b66', act: 'settings' }
];
// 頂列固定 4 項(§1.1):頭像+等級、錢、抽數、戰力
var SHELL_TOP_ITEMS = [
  { id: 'av', ic: '🏯' },
  { id: 'money', ic: '🪙' },
  { id: 'pulls', ic: '🎴' },
  { id: 'power', ic: '⚔' }
];
// §4 對映表:每一項都要可達;tab 為 dock 的 id,null = 目前沒有入口(待決定去處)。act 由 shellAct 處理。gate 為旗標名(off 時不顯示)。
var SHELL_MAP = [
  { k: '卡片 · 抽卡', tab: 'cards', act: 'cards:D' },
  { k: '卡包(卡片 / 道具)', tab: 'cards', act: 'cards:R' },
  { k: '熔爐', tab: 'workshop', act: 'cards:F' },
  { k: '傳承', tab: 'cards', act: 'cards:S' },
  { k: '大全 / 卡冊(含搜尋)', tab: 'cards', act: 'cards:X' },
  { k: '戰役 · 副本地圖', tab: 'field', act: 'battle' },
  { k: '練兵', tab: null, act: 'prac' },
  { k: '推薦戰隊(即將開放)', tab: null, act: 'soon' },
  { k: '地圖', tab: 'field', act: 'wm' },
  { k: '戰報', tab: 'report', act: 'log' },
  { k: '擂台', tab: 'event', act: 'tour' },
  { k: '切磋(對戰碼)', tab: 'event', act: 'share' },
  { k: '地圖', tab: 'event', act: 'wm' },
  { k: '庫房 / 背包', tab: 'pack', act: 'goods' },
  { k: '設定', tab: 'set', act: 'settings' },
  { k: '說明', tab: null, act: 'help' },
  { k: '拍照', tab: null, act: 'photo' },
  { k: '走鏢', tab: null, act: 'caravan', gate: 'caravan' },
  { k: '釣魚', tab: null, act: 'fish', gate: 'fishing' }
];
var SHELL_TOP_H = { p: 52, l: 44 }, SHELL_DOCK_H = 52, SHELL_FPS = 30, SHELL_TICK = 1000, SHELL_TEAM_MS = 2000, SHELL_EV_MAX = 5;

// 新介面骨架(旗標 ldui,預設關):首頁換成 5 格 dock + 建築木牌 + 隊伍欄 + 圓鈕(js/ld_home.js、css/ld_home.css);關閉時以下所有 ld 分支都不執行。
var SHELL_DOCK_LD = [
  { id: 'cards', label: '卡包', art: 'nav_cards', act: 'cards:R' },
  { id: 'bag', label: '背包', art: 'nav_bag', act: 'ldbag' },   // 新背包頁(裝備 / 材料 / 庫房;js/ld_equip_ui.js);庫房仍是舊的 goods 頁
  { id: 'event', label: '活動', art: 'nav_event', act: 'ldevent' },
  { id: 'report', label: '戰報', art: 'nav_log', act: 'log' },
  { id: 'set', label: '設定', art: 'nav_set', act: 'settings' }
];
function shellOn() { return typeof featureOn === 'function' && featureOn('shell'); }   // @DORMANT shell
function shellLdOn() { return shellOn() && typeof featureOn === 'function' && featureOn('ldui') && typeof ldHomeInit === 'function' && typeof ldArt === 'function'; }   // @DORMANT ldui
function shellDockList() { return SHELL.ld ? SHELL_DOCK_LD : SHELL_DOCK; }
// 純函式:版面數值(測試用)。vw > vh 為橫向,與 CSS orientation 一致。直立與橫向的底部 dock 皆貼底。
function shellLayout(vw, vh) {
  var land = vw > vh;
  return { orient: land ? 'landscape' : 'portrait', topH: land ? SHELL_TOP_H.l : SHELL_TOP_H.p, railW: 0, tabBarH: SHELL_DOCK_H, dock: SHELL_DOCK.length, topItems: SHELL_TOP_ITEMS.length };
}
// 錢的顯示:萬以上縮成『1.2萬』(純函式)
function shellFmtMoney(n) {
  n = Math.floor(+n || 0);
  if (n >= 100000000) return (n / 100000000).toFixed(1) + '億';
  if (n >= 10000) return (n / 10000).toFixed(1) + '萬';
  return String(n);
}
function shellEl(tag, cls, text) {
  var e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}
function shellBtn(text, cls, act, dis) {
  var b = shellEl('button', cls, text);
  b.setAttribute('type', 'button');
  if (act) b.setAttribute('data-act', act);
  if (dis) b.disabled = true;
  return b;
}
// 圖示:底層為色塊 + 字形(占位);若 UI_ASSETS 有檔則疊上 img,載入失敗自動拿掉(之後補圖不必改版面)
function shellIcon(asset, glyph, color, cls) {
  var w = shellEl('span', 'sh-ico' + (cls ? ' ' + cls : ''), glyph || ''), url = (typeof uiAssetUrl === 'function') ? uiAssetUrl(asset) : null, im;
  if (color) w.style.background = color;
  if (url) {
    im = shellEl('img', 'sh-img');
    im.setAttribute('alt', '');
    im.onerror = function () { if (im.parentNode) im.parentNode.removeChild(im); };
    im.src = url;
    w.appendChild(im);
  }
  return w;
}
// ld 頂列:左頭像圓框 44(下方疊等級條)、中間錢 / 抽數 / 戰力 3 槽、右數據鈕 44(切換基本數據面板)
function shellBuildTopLd(top) {
  var i, t, b, lab = { money: '錢', pulls: '抽', power: '戰' };
  for (i = 0; i < SHELL_TOP_ITEMS.length; i++) {
    t = SHELL_TOP_ITEMS[i];
    b = shellBtn('', t.id === 'av' ? 'sh-item sh-lav' : 'sh-item sh-lslot', t.id);
    b.id = 'sh_' + t.id;
    b.setAttribute('aria-label', t.id);
    if (t.id === 'av') b.appendChild(shellEl('span', 'sh-lavc', '城'));
    else b.appendChild(shellEl('span', 'sh-llab', lab[t.id]));
    SHELL.txt[t.id] = shellEl('span', t.id === 'av' ? 'sh-lv' : 'sh-txt', '');
    b.appendChild(SHELL.txt[t.id]);
    top.appendChild(b);
    SHELL.btn[t.id] = b;
  }
  SHELL.stT = shellBtn('數據', 'sh-item sh-lstat', null);
  SHELL.stT.setAttribute('data-stat', 'tog');
  SHELL.stT.setAttribute('aria-label', '基本數據');
  top.appendChild(SHELL.stT);
}
// 建 DOM:頂列(頭像+名稱+Lv、提示晶片、錢、抽數、戰力)/ 首頁(風景場景 + 右上基本數據)/ 底部 dock(7 顆)+ 子浮層 / 還原鈕(拍照)
function shellBuild() {
  var root = shellEl('div'), top, body, main, nav, pg, scene, rows, row, v, i, b, t, d, dk, fl, ld = shellLdOn(), dl;
  SHELL.ld = ld;
  root.id = 'shellRoot';
  root.className = 'sh-root sh-p' + (ld ? ' sh-ld' : '');
  top = shellEl('header', 'sh-top');
  if (ld) shellBuildTopLd(top);
  for (i = 0; !ld && i < SHELL_TOP_ITEMS.length; i++) {
    t = SHELL_TOP_ITEMS[i];
    b = shellBtn('', 'sh-item', t.id);
    b.id = 'sh_' + t.id;
    b.setAttribute('aria-label', t.id);
    if (t.id === 'av') b.appendChild(shellIcon('nav_team', '🏯', '', 'sh-av'));
    SHELL.txt[t.id] = shellEl('span', 'sh-txt', '');
    b.appendChild(SHELL.txt[t.id]);
    top.appendChild(b);
    SHELL.btn[t.id] = b;
    if (t.id === 'av') {   // 提示晶片(新手禮包 / 免費抽 / 擂台)併入頂列,緊接頭像之後
      SHELL.evEl = shellEl('div', 'sh-evt');
      SHELL.evEl.hidden = true;
      top.appendChild(SHELL.evEl);
    }
  }
  root.appendChild(top);
  body = shellEl('div', 'sh-body');
  main = shellEl('main', 'sh-main');
  pg = shellEl('section', 'sh-page sh-home');
  pg.setAttribute('data-page', 'home');
  scene = shellEl('div', 'sh-scene');
  SHELL.bgEl = shellEl('img', 'sh-bg');
  SHELL.bgEl.setAttribute('alt', '');
  SHELL.bgEl.onerror = function () { SHELL.bgEl.hidden = true; };
  scene.appendChild(SHELL.bgEl);
  // 右上基本數據:透明底、只有收合鈕可點,不擋底下建築
  SHELL.stEl = shellEl('div', 'sh-stat');
  SHELL.stEl.id = 'shStat';
  if (!ld) {   // ld:數據鈕在頂列(shellBuildTopLd 已建 SHELL.stT)
    SHELL.stT = shellBtn('', 'sh-stt', null);
    SHELL.stT.setAttribute('data-stat', 'tog');
  }
  SHELL.stB = shellEl('div', 'sh-stb');
  SHELL.stV = {};
  rows = [['lv', '城主等級'], ['troops', '出征兵數'], ['power', '出征戰力'], ['faction', '勢力'], ['fame', '名聲'], ['land', '領地'], ['rsv', '預備兵'], ['res', '木鐵石糧']];
  for (i = 0; i < rows.length; i++) {
    row = shellEl('div', 'sh-str');
    row.appendChild(shellEl('span', 'sh-stk', rows[i][1]));
    v = shellEl('span', 'sh-stv', '--');
    row.appendChild(v);
    SHELL.stB.appendChild(row);
    SHELL.stV[rows[i][0]] = v;
  }
  if (!ld) SHELL.stEl.appendChild(SHELL.stT);
  SHELL.stEl.appendChild(SHELL.stB);
  scene.appendChild(SHELL.stEl);
  pg.appendChild(scene);
  main.appendChild(pg);
  body.appendChild(main);
  // 底部單一 dock(7 顆):有子項者點開浮層;單一功能直接開啟
  nav = shellEl('nav', 'sh-dock');
  nav.id = 'shDock';
  SHELL.dk = {};
  dl = shellDockList();
  for (d = 0; d < dl.length; d++) {
    t = dl[d];
    b = shellBtn('', 'sh-dk', null);
    b.id = 'shd_' + t.id;
    b.setAttribute('data-dock', t.id);
    b.setAttribute('aria-label', t.label);
    b.setAttribute('aria-expanded', 'false');
    b.appendChild(ld ? ldArt(t.art, 'sh-dic ldh-dic') : shellIcon(t.asset, t.glyph, t.color, 'sh-dic'));
    b.appendChild(shellEl('span', 'sh-dl', t.label));
    dk = shellEl('i', 'sh-dkdot');
    dk.hidden = true;
    b.appendChild(dk);
    SHELL.dk[t.id] = { b: b, dot: dk, act: t.act || '' };
    nav.appendChild(b);
  }
  body.appendChild(nav);
  root.appendChild(body);
  fl = shellEl('div', 'sh-float');
  fl.id = 'shFloat';
  fl.hidden = true;
  root.appendChild(fl);
  SHELL.fl = { el: fl, id: '' };
  document.body.appendChild(root);
  SHELL.el = root;
  SHELL.cv = null;   // 首頁無舞台;shellDraw 留給戰役分頁(S2)
  if (ld) ldHomeInit(scene);   // 建築木牌層、隊伍欄、圓鈕(js/ld_home.js)
  b = shellBtn('還原', '', 'restore');
  b.id = 'photoBack';
  b.title = '還原介面';
  b.addEventListener('click', function () { shellAct('restore'); });
  document.body.appendChild(b);
  return root;
}
// 依旗標與版面狀態同步:body class、root class、首頁背景
function shellSyncNav() {
  var root = SHELL.el, bid, url;
  if (!root) return;
  root.className = 'sh-root ' + (SHELL.lo === 'landscape' ? 'sh-l' : 'sh-p') + (SHELL.ld ? ' sh-ld' : '');
  if (document.body && document.body.classList) {
    document.body.classList.add('shell-on');
    document.body.classList.toggle('shell-land', SHELL.lo === 'landscape');
    document.body.classList.toggle('shell-port', SHELL.lo !== 'landscape');
  }
  bid = SHELL.lo === 'landscape' ? 'home_bg_land' : 'home_bg_port';
  if (SHELL.ld && typeof ldArtHas === 'function' && ldArtHas(SHELL.lo === 'landscape' ? 'bg_home2_land' : 'bg_home2_port')) bid = SHELL.lo === 'landscape' ? 'bg_home2_land' : 'bg_home2_port';   // 新首頁背景有圖才用
  if (SHELL.bgEl && SHELL.bgId !== bid) {
    SHELL.bgId = bid;
    url = (bid.indexOf('bg_home2_') === 0) ? ldArtUrl(bid) : ((typeof uiAssetUrl === 'function') ? uiAssetUrl(bid) : null);
    SHELL.bgEl.hidden = !url;
    if (url) SHELL.bgEl.src = url;
  }
}
// 基本數據收合 / 展開:狀態記在 localStorage(讀寫失敗只保留在本次執行)
function shellStatLoad() {
  var v = null;
  try { v = localStorage.getItem('lordShellStat'); } catch (e) { v = null; }
  SHELL.statOpen = SHELL.ld ? v === '1' : v !== '0';   // ld:預設收合
  shellStatApply();
}
function shellStatApply() {
  if (!SHELL.stB || !SHELL.stT) return;
  SHELL.stB.hidden = !SHELL.statOpen;
  if (SHELL.ld) { SHELL.stT.setAttribute('aria-expanded', SHELL.statOpen ? 'true' : 'false'); SHELL.stT.classList.toggle('on', !!SHELL.statOpen); return; }
  SHELL.stT.textContent = SHELL.statOpen ? '基本數據 ▴' : '📊';
  SHELL.stT.setAttribute('aria-expanded', SHELL.statOpen ? 'true' : 'false');
}
function shellStatToggle() {
  SHELL.statOpen = !SHELL.statOpen;
  shellStatApply();
  try { localStorage.setItem('lordShellStat', SHELL.statOpen ? '1' : '0'); } catch (e) { /* 略過:無法寫入時狀態只保留在本次執行 */ }
}
// 基本數據值:城主等級、出征兵數 / 戰力(出征隊伍);勢力 / 名聲 / 領地 目前無資料來源,標 --
function shellStatRender(lv, n, pw) {
  var txt = { lv: 'Lv' + lv, troops: String(n || 0), power: (pw || 0).toLocaleString(), faction: '--', fame: '--', land: '--', rsv: '--', res: '--' }, k, key, t;
  try {   // 名聲 / 預備兵 / 木鐵石糧:模組存在才顯示(fame.js rsv.js res4.js);領地讀地圖
    if (typeof fameGet === 'function') txt.fame = fameGet().toLocaleString();
    if (typeof rsvGet === 'function') { if (typeof rsvSettle === 'function') rsvSettle(Date.now()); txt.rsv = rsvGet().n.toLocaleString() + '/' + rsvCap().toLocaleString(); }
    if (typeof res4All === 'function') { t = res4All(); txt.res = shellFmtMoney(t.wood) + ' / ' + shellFmtMoney(t.iron) + ' / ' + shellFmtMoney(t.stone) + ' / ' + shellFmtMoney(t.grain); }
    if (typeof wdTerritoryOf === 'function' && typeof WDUI !== 'undefined' && WDUI && WDUI.W) txt.land = String(wdTerritoryOf(WDUI.W).total);
  } catch (e) { /* 顯示用,失敗保持 -- */ }
  key = JSON.stringify(txt);
  if (!SHELL.stV || SHELL.sv === key) return;
  SHELL.sv = key;
  for (k in txt) if (SHELL.stV[k]) SHELL.stV[k].textContent = txt[k];
}
// 底部 dock 紅點:新手禮包 / 免費抽 → 卡包;擂台可開新一屆 → 活動(機制沿用活動列的 dot)
function shellDockDots(list) {
  var on = {}, i, id, k, key;
  if (!SHELL.dk) return;
  for (i = 0; i < list.length; i++) {
    if (!list[i].dot) continue;
    id = list[i].id === 'tour' ? 'event' : 'cards';
    on[id] = 1;
  }
  key = JSON.stringify(on);
  if (SHELL.dkey === key) return;
  SHELL.dkey = key;
  for (k in SHELL.dk) SHELL.dk[k].dot.hidden = !on[k];
}
// 子浮層:一次只開一個;關閉時清空項目
function shellFloatClose() {
  var F = SHELL.fl, i;
  if (!F || !F.el || F.el.hidden) return;
  F.el.hidden = true;
  if (SHELL.dk && SHELL.dk[F.id]) SHELL.dk[F.id].b.setAttribute('aria-expanded', 'false');
  F.id = '';
  for (i = F.el.children.length - 1; i >= 0; i--) F.el.removeChild(F.el.children[i]);
}
// 開 dock 鈕:單一功能直接執行;有子項則列出浮層(即將開放的項目顯示灰字,點了只出提示)。同一鈕再點 = 關閉。
function shellDockOpen(id) {
  var F = SHELL.fl, dk = SHELL.dk && SHELL.dk[id], t = null, i, k, b, rect, W, fw, cx, x, dl = shellDockList();
  if (!F || !dk) return false;
  for (i = 0; i < dl.length; i++) if (dl[i].id === id) t = dl[i];
  if (!t) return false;
  if (F.id === id && !F.el.hidden) { shellFloatClose(); return true; }
  shellFloatClose();
  if (t.act) return shellAct(t.act);
  for (i = 0; i < t.kids.length; i++) {
    k = t.kids[i];
    b = shellBtn('', 'sh-fi' + (k.soon ? ' sh-fsoon' : ''), k.soon ? 'soon' : k.act);
    b.appendChild(shellEl('span', 'sh-fl', k.k));
    if (k.soon) b.appendChild(shellEl('span', 'sh-fnote', '即將開放'));
    F.el.appendChild(b);
  }
  F.id = id;
  F.el.hidden = false;
  dk.b.setAttribute('aria-expanded', 'true');
  rect = dk.b.getBoundingClientRect ? dk.b.getBoundingClientRect() : { left: 0, width: 0 };
  W = (typeof window !== 'undefined' && window.innerWidth) || 0;
  fw = F.el.offsetWidth || 180;
  cx = rect.left + (rect.width || 0) / 2;
  x = Math.max(8, Math.min(W - fw - 8, cx - fw / 2));
  F.el.style.left = Math.round(x) + 'px';
  return true;
}
// 戰鬥相關入口:戰鬥層未開則先 bnUiOpen(它自己會提示卡包人數不足),再執行 fn
function shellOpenBattle(fn) {
  var ok = (typeof bnu !== 'undefined' && bnu && bnu.open) ? true : (typeof bnUiOpen === 'function' ? !!bnUiOpen() : false);
  if (!ok) return false;
  if (typeof fn === 'function') fn();
  return true;
}
// 戰役 · 副本:戰鬥層在入口頁時直接進副本地圖(選關 → bnUiToForm 隊伍配置 → bnUiStart 才進戰鬥)。戰鬥中不切換。
function shellBattleMap() {
  return shellOpenBattle(function () {
    if (typeof bnu !== 'undefined' && bnu && bnu.open && bnu.phase !== 'entry') return;
    if (typeof bnUiSetPhase === 'function' && typeof bnMapRender === 'function') { bnUiSetPhase('map'); bnMapRender(); }
    else if (typeof bnUiEntryDo === 'function') bnUiEntryDo('stage');
  });
}
// ld 模式(旗標 ldui):卡包 / 背包 / 設定 / 戰報 / 擂台 / 對戰入口改經頁面堆疊(ld_nav.js 的舊頁登錄),統一返回 / 5 層上限 / 手機返回鍵。回 null = 不處理,走原本分支。
function shellLdRoute(act) {
  var m = { goods: 'goods', money: 'goods', settings: 'settings', log: 'log', tour: 'tour', share: 'share', ldbag: 'bag' };
  if (!SHELL.ld || typeof ldNavPush !== 'function') return null;
  if (act.indexOf('cards:') === 0) return ldNavPush('cards', { tab: act.slice(6) });
  if (m[act]) return ldNavPush(m[act]);
  return null;
}
// 動作分派(對映 act)。未知 act 回 false。
function shellAct(act) {
  var a, t, IUo, r;
  if (!act) return false;
  r = shellLdRoute(act);
  if (r !== null) return r;
  if (act.indexOf('cards:') === 0) {
    t = act.slice(6);
    if (typeof cardsUiOpen === 'function') cardsUiOpen(t);
    return true;
  }
  switch (act) {
    case 'battle': shellBattleMap(); return true;
    case 'prac': shellOpenBattle(function () { if (typeof bnUiEntryDo === 'function') bnUiEntryDo('prac'); }); return true;
    case 'gift': if (typeof IU === 'object' && IU) IU.sub = 'item'; return shellAct('cards:R');   // 新手禮包:卡包的道具頁籤
    case 'tour': shellOpenBattle(function () { if (typeof bnTourOpen === 'function') bnTourOpen(); }); return true;
    case 'wm': if (SHELL.ld && typeof ldNavPush === 'function' && typeof featureOn === 'function' && featureOn('world')) return ldNavPush('map'); shellOpenBattle(function () { if (typeof featureOn === 'function' && featureOn('world') && typeof wdOpen === 'function') wdOpen(); else if (typeof wmOpen === 'function') wmOpen(); }); return true;   // @DORMANT world(旗標開 → 新地圖 wdOpen;關 → 舊外勤 wmOpen)
    case 'ldevent': return typeof ldNavPush === 'function' ? ldNavPush('event') : false;   // 新首頁底列「活動」
    case 'log': shellOpenBattle(function () { if (typeof bnLogOpen === 'function') bnLogOpen(); }); return true;
    case 'share': shellOpenBattle(function () { if (typeof bnsOpen === 'function') bnsOpen('share'); }); return true;
    case 'goods': if (typeof goodsPanelToggle === 'function') goodsPanelToggle(true); return true;
    case 'settings': if (typeof stOpenPanel === 'function') stOpenPanel(); return true;
    case 'help': if (typeof guideListOpen === 'function') guideListOpen(); return true;
    case 'photo': if (typeof uiSetMode === 'function') uiSetMode('photo'); return true;
    case 'restore': if (typeof uiSetMode === 'function') uiSetMode(typeof uiPrevMode !== 'undefined' ? uiPrevMode : 'normal'); return true;
    case 'caravan': a = document.getElementById('btnCaravan'); if (a) a.click(); return true;
    case 'fish': if (typeof fishEnter === 'function') fishEnter('shell'); return true;
    case 'soon': if (typeof showToast === 'function') showToast('即將開放'); return true;
    case 'av': if (typeof showToast === 'function') showToast('城主頭像與等級'); return true;
    case 'money': if (typeof goodsPanelToggle === 'function') goodsPanelToggle(true); return true;
    case 'pulls': return shellAct('cards:D');
    case 'power': return shellDockOpen('field');
  }
  return false;
}

// 頂列數值:錢 = world.res.coin;抽數 = 小池 T + 大池 E;戰力 = 出征隊伍(bnPower 加總);等級 = progLv()
function shellRefresh() {
  var cs = (typeof cardsGet === 'function') ? cardsGet() : null, coin = 0, pulls = 0, lv = '-', txt, now = Date.now(), pw, k;
  if (!SHELL.el) return;
  if (typeof world !== 'undefined' && world && world.res) coin = world.res.coin || 0;
  if (cs && typeof cardsPulls === 'function') pulls = cardsPulls(cs, 'T') + cardsPulls(cs, 'E');
  if (typeof progLv === 'function') { try { lv = progLv(); } catch (e) { lv = '-'; } }
  if (now - SHELL.teamT >= SHELL_TEAM_MS || !SHELL.team) { SHELL.team = shellTeamUnits(); SHELL.teamT = now; }
  pw = SHELL.team ? SHELL.team.power : 0;
  txt = SHELL.ld ? { av: 'Lv' + lv, money: shellFmtMoney(coin), pulls: String(pulls), power: (pw || 0).toLocaleString() }
    : { av: '城主 Lv' + lv, money: '🪙 ' + shellFmtMoney(coin), pulls: '🎴 ' + pulls, power: '⚔ ' + (pw || 0).toLocaleString() };
  if (SHELL.pv !== JSON.stringify(txt)) {
    SHELL.pv = JSON.stringify(txt);
    for (k in txt) if (SHELL.txt[k]) SHELL.txt[k].textContent = txt[k];
  }
  var evs = shellEvents(now);
  shellRenderEvents(evs);
  shellDockDots(evs);
  shellStatRender(lv, SHELL.team ? SHELL.team.units.length : 0, pw);
  if (SHELL.ld && typeof ldNavPrune === 'function') ldNavPrune();   // 舊頁自己關閉後同步堆疊(另有 ld_nav 自己的 250 ms 輪詢)
  if (SHELL.ld && typeof ldHomeRefresh === 'function') ldHomeRefresh();
}
// 活動圖示列:只列有真實內容的項目(最多 5 個)。新手禮包持有中 → 紅點;免費抽 = 小池可抽或已滿待領;擂台 = 可開新一屆 / 冷卻倒數。
function shellEvents(now) {
  var out = [], cs = (typeof cardsGet === 'function') ? cardsGet() : null, n, w, st, cd;
  if (typeof itemCount === 'function' && itemCount('gift_newbie') > 0) out.push({ id: 'gift', label: '新手禮包', asset: 'item_newbie_pack', glyph: '🎁', act: 'gift', dot: true, sub: '點此使用' });
  if (cs && typeof cardsVenueOpen === 'function' && cardsVenueOpen('E') && typeof cardsPulls === 'function') {
    n = cardsPulls(cs, 'E');
    w = !!(cs.pl && cs.pl.E && cs.pl.E.w);
    if (n > 0 || w) out.push({ id: 'draw', label: '免費抽', asset: 'nav_draw', glyph: '🎴', act: 'cards:D', dot: true, sub: n > 0 ? '可抽 ' + n : '已滿 · 待領' });
  }
  if (typeof bnTourLoad === 'function' && typeof bnTourCooldown === 'function') {
    st = bnTourLoad();
    cd = bnTourCooldown(st, now || Date.now());
    out.push({ id: 'tour', label: '擂台', asset: 'short_arena', glyph: '🏟', act: 'tour', dot: !!cd.ok, sub: cd.ok ? '可開新一屆' : (typeof bnTourFmt === 'function' ? bnTourFmt(cd.left) : '') });
  }
  return out.slice(0, SHELL_EV_MAX);
}
function shellRenderEvents(list) {
  var key = JSON.stringify(list), i, e, b, el = SHELL.evEl;
  if (!el || SHELL.ev === key) return;
  SHELL.ev = key;
  for (i = el.children.length - 1; i >= 0; i--) el.removeChild(el.children[i]);
  el.hidden = !list.length;
  for (i = 0; i < list.length; i++) {
    e = list[i];
    b = shellBtn('', 'sh-ev', e.act);
    b.id = 'she_' + e.id;
    b.appendChild(shellIcon(e.asset, e.glyph, '', 'sh-eic'));
    b.appendChild(shellEl('span', 'sh-elb', e.label));
    b.appendChild(shellEl('span', 'sh-esub', e.sub));
    if (e.dot) b.appendChild(shellEl('i', 'sh-dot'));
    el.appendChild(b);
  }
}
// 出征隊伍:依 bnUiLoad 的現行隊伍(cur.slots)→ bnUiSpec → bnBuildTeam;只讀,不改存檔。回 {units, power}。
function shellTeamUnits() {
  var d = (typeof bnUiLoad === 'function') ? bnUiLoad() : null, slots = d && d.cur && d.cur.slots ? d.cur.slots : [], specs = [], i, s, e, team, power = 0, j;
  for (i = 0; i < slots.length; i++) {
    s = slots[i];
    e = (typeof bnUiEntry === 'function') ? bnUiEntry(s.id) : null;
    if (!e) continue;
    specs.push(bnUiSpec(e, { troop: s.troop, row: s.row, col: s.col }));
  }
  if (!specs.length || typeof bnBuildTeam !== 'function') return { units: [], power: 0 };
  team = bnBuildTeam(specs);
  for (j = 0; j < specs.length; j++) power += bnPower(specs[j]);
  for (j = 0; j < team.units.length; j++) if (!team.units[j].side) team.units[j].side = 'A';
  return { units: team.units, power: Math.round(power) };
}

// 舞台(保留給戰役分頁的展演,S2):只在戰役分頁、無面板、戰鬥層未開、頁面可見、且有掛載 canvas 時動作。目前首頁無 canvas,不會動作。
function shellStageActive() {
  if (!shellOn() || !SHELL.cv || SHELL.tab !== 'battle' || !SHELL.el) return false;
  if (typeof document !== 'undefined' && document.hidden) return false;
  if (typeof panelOpenList !== 'undefined' && panelOpenList.length) return false;
  if (typeof bnu !== 'undefined' && bnu && bnu.open) return false;
  return true;
}
function shellKick() {
  if (!SHELL.raf && typeof requestAnimationFrame === 'function' && shellStageActive()) SHELL.raf = requestAnimationFrame(shellLoop);
}
function shellLoop(ts) {
  SHELL.raf = 0;
  if (!shellStageActive()) return;
  if (ts - SHELL.last >= 1000 / SHELL_FPS) { SHELL.last = ts; shellDraw(ts / 1000); }
  SHELL.raf = requestAnimationFrame(shellLoop);
}
// 畫舞台:bndraw stage 版面(home:true)+ 背景 bg_stage_land / port + 站姿待機(bnDrUnit,P.ps = false 才有呼吸)。保留不刪,首頁不呼叫。
function shellDraw(t) {
  var cv = SHELL.cv, ctx, w, h, dpr, L, bg, list, i, u, v, P, port, img;
  if (!cv || !cv.getContext || typeof bnDrLayout !== 'function') return;
  w = cv.clientWidth || 0; h = cv.clientHeight || 0;
  if (w < 2 || h < 2) return;
  dpr = Math.min(1.5, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
  if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
  ctx = cv.getContext('2d');
  port = w < h;
  img = (typeof uiAssetImg === 'function') ? uiAssetImg(port ? 'bg_home_port' : 'bg_home_land') : null;
  L = bnDrLayout(w, h, 0, 0, { style: 'stage', home: true, bgImg: img || null });
  if (!SHELL.team) SHELL.team = shellTeamUnits();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  bg = (typeof bnDrBgFor === 'function') ? bnDrBgFor(L, dpr, true) : null;
  if (bg) ctx.drawImage(bg, 0, 0); else { ctx.fillStyle = '#2d3322'; ctx.fillRect(0, 0, cv.width, cv.height); }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  P = SHELL.P || (SHELL.P = { ps: false, fx: [], vu: {}, nums: [], hooks: {} });
  list = [];
  for (i = 0; i < SHELL.team.units.length; i++) {
    u = SHELL.team.units[i];
    if (!L.pos[u.side] || !L.pos[u.side][u.row] || !L.pos[u.side][u.row][u.col]) continue;
    v = SHELL.vu[u.id] || (SHELL.vu[u.id] = bnPlNewVu(u, L));
    v.px = L.pos[u.side][u.row][u.col].x; v.py = L.pos[u.side][u.row][u.col].y; v.sh = L.sh;
    list.push(v);
  }
  list = bnDrOrder(list, L);
  for (i = 0; i < list.length; i++) bnDrUnit(ctx, P, list[i], t, L);
}

// 轉向 / 縮放:重算版面 class;面板由 panelui.js 的 pfOnResize 還原寬檔與捲動;本函式還原分頁捲動並續跑舞台
function shellOnResize() {
  var lay, keep, pg, vw, vh;
  if (!shellOn() || !SHELL.el) return;
  shellFloatClose();
  vw = (typeof window !== 'undefined' && window.innerWidth) || 0;
  vh = (typeof window !== 'undefined' && window.innerHeight) || 0;
  lay = shellLayout(vw, vh);
  SHELL.lo = lay.orient;
  pg = SHELL.el.querySelector ? SHELL.el.querySelector('.sh-main > .sh-page[data-page="' + SHELL.tab + '"]') : null;
  keep = pg ? (pg.scrollTop | 0) : 0;
  shellSyncNav();
  if (SHELL.ld && typeof ldHomeLayout === 'function') ldHomeLayout();
  if (pg) pg.scrollTop = keep;
  if (typeof setTimeout === 'function') {
    if (SHELL.ld && typeof ldHomeLayout === 'function') setTimeout(ldHomeLayout, 150);   // 轉向後瀏覽器尺寸可能晚一拍才穩定
    setTimeout(function () { if (pg && SHELL.tab) { var p2 = SHELL.el.querySelector('.sh-main > .sh-page[data-page="' + SHELL.tab + '"]'); if (p2) p2.scrollTop = keep; } }, 120);
  }
  shellKick();
}

// 初始化:旗標關閉直接返回(不建 DOM、不綁事件)
// 外殼開啟:舊城市頂列與城市畫布從 DOM 移除(不是隱藏);模組載入時掛在頂列上的按鈕隨之移除。updateResBar / 畫布事件之後皆為空操作。
function shellDropCityChrome() {
  ['topbar', 'game', 'toolbar', 'pendBar', 'modeFloat', 'shop', 'tplMenu', 'techPanel'].forEach(function (id) { var e = document.getElementById(id); if (e && e.parentNode) e.parentNode.removeChild(e); });
}
function shellInit() {
  var vw, vh;
  if (!shellOn() || SHELL.inited || typeof document === 'undefined' || !document.body) return false;
  SHELL.inited = true;
  shellBuild();
  shellDropCityChrome();
  if (typeof gdShowUi === 'function') { try { gdShowUi(false); } catch (e) { /* 略過:舊城市引導收起失敗不影響外殼 */ } }   // 舊城市引導指向已隱藏的城市介面;CSS 另以 body.shell-on 隱藏 #guideRoot(遮罩會擋點擊)
  SHELL.tab = 'home';
  shellStatLoad();
  vw = (typeof window !== 'undefined' && window.innerWidth) || 0;
  vh = (typeof window !== 'undefined' && window.innerHeight) || 0;
  SHELL.lo = shellLayout(vw, vh).orient;
  SHELL.el.addEventListener('click', shellOnClick);
  if (typeof window !== 'undefined' && window.addEventListener) {
    window.addEventListener('resize', shellOnResize);
    window.addEventListener('orientationchange', shellOnResize);
  }
  if (typeof document.addEventListener === 'function') document.addEventListener('visibilitychange', shellKick);
  shellSyncNav();
  if (SHELL.ld && typeof ldHomeLayout === 'function') ldHomeLayout();
  shellRefresh();
  if (typeof setInterval === 'function') SHELL.ttl = setInterval(function () { shellRefresh(); shellKick(); }, SHELL_TICK);
  shellKick();
  return true;
}
// 點擊分派:dock 鈕(單一功能直接執行或開子浮層)、子浮層項目與頂列 / 晶片(data-act)、基本數據收合鈕。點其他地方關閉子浮層。
function shellOnClick(ev) {
  var t = ev && ev.target, id, act;
  while (t && t !== SHELL.el && !(t.getAttribute && (t.getAttribute('data-dock') || t.getAttribute('data-act') || t.getAttribute('data-stat')))) t = t.parentNode;
  if (!t || t === SHELL.el) { shellFloatClose(); return; }
  if (t.getAttribute('data-stat')) { shellFloatClose(); shellStatToggle(); return; }
  id = t.getAttribute('data-dock');
  if (id) { shellDockOpen(id); return; }
  act = t.getAttribute('data-act');
  shellFloatClose();
  shellAct(act);
}

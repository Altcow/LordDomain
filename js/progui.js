// js/progui.js — 城市等級介面(PLAN_PROGRESSION §2.5、§7):頂列 Lv 晶片、升級抽屜、測試工具、鎖頭角標與解鎖紅點、FTUE 泡泡。
// 只讀 prog.js / progdata.js 的函式與常數,數字一律不寫在本檔。DOM 全由本檔建立(index.html 只載入本檔)。
// 外部全域(ui.js、battleui.js 等)一律 typeof 守衛;本檔在載入時建立介面,呼叫端可隨時呼叫 progLockBadge / progSeenMark。
// 全域名稱:initProgUI progUiTick progUiRefresh progUiOpen progUiClose progLockBadge progSeenMark progFtueTick progFtueShow progFtueHide;其餘內部一律 pui / puiXxx。

var pui = {
  inited: false, open: false, toolsOpen: false, timer: 0,
  chip: null, chipLv: null, chipFill: null, chipDot: null,
  drawer: null, headLv: null, list: null, req: null, unl: null,
  toolsBtn: null, tools: null, sel: null, legacyBtn: null,
  why: null, upBtn: null,
  ftue: null, ftueTxt: null, ftueStep: ''
};

var PUI_FEATURE_NAME = {
  estate: '經營', battleDesign: '戰陣布置', npc: '野營', sandbox: '沙盤', tplEstate: '經營範本', tplCamp: '戰陣範本',
  report: '戰報', upgrade: '升級', ghost: '他城', modDraw: '陣圖抽選', visit: '參觀', friend: '朋友戰帖',
  spar: '切磋', random: '隨機對手', research: '科研', photo: '拍照', shop: '商店', deals: '每日特賣',
  auction: '拍賣場', recorder: '錄影', replayFeed: '精采回顧', campSlots: '我的陣圖', fishing: '釣魚', pet: '仙獸苑'
};
var PUI_TERRAIN_NAME = { road: '道路', grass: '草地', erase: '清除', raise: '堆高', lower: '挖低', lake: '湖泊', river: '河流' };
var PUI_SRC_NAME = { boss: '首領營', any3hard: '3★ 難營' };

function puiEl(tag, cls, txt) {
  var e = document.createElement(tag);
  if (cls) e.className = cls;
  if (txt !== undefined && txt !== null) e.textContent = txt;
  return e;
}

function puiBtn(cls, txt, fn) {
  var b = puiEl('button', cls, txt);
  b.addEventListener('click', fn);
  return b;
}

function puiToast(msg) {
  if (typeof showToast === 'function') showToast(msg);
}

function puiRes(k) {
  return (typeof world !== 'undefined' && world && world.res) ? Math.floor(world.res[k] || 0) : 0;
}

function puiHasLegacy() {
  try { return localStorage.getItem(PROG_LEGACY_KEY) !== null; } catch (e) { return false; }
}

// 某等級開放的項目名稱(去重);用於抽屜預覽與升級提示
function puiName(kind, id) {
  var d = null;
  if (kind === 'terrain') return PUI_TERRAIN_NAME[id] || id;
  if (kind === 'feature') return PUI_FEATURE_NAME[id] || id;
  if (kind === 'estate' && typeof OBJECTS !== 'undefined') d = OBJECTS[id];
  else if (kind === 'camp' && typeof CAMP_OBJECTS !== 'undefined') d = CAMP_OBJECTS[id];
  else if (kind === 'unit' && typeof UNITS !== 'undefined') d = UNITS[id];
  else if (kind === 'trap' && typeof STRATAGEMS !== 'undefined') d = STRATAGEMS[id];
  return (d && d.name) || id;
}

function puiUnlockNames(L) {
  var out = [], groups = [
    ['estate', PROG_UNLOCK_ESTATE], ['camp', PROG_UNLOCK_CAMP], ['terrain', PROG_UNLOCK_TERRAIN],
    ['trap', PROG_UNLOCK_TRAP], ['unit', PROG_UNLOCK_UNIT], ['feature', PROG_UNLOCK_FEATURE]
  ];
  groups.forEach(function (g) {
    (g[1][L] || []).forEach(function (id) {
      var nm = puiName(g[0], id);
      if (nm && out.indexOf(nm) < 0) out.push(nm);
    });
  });
  return out;
}

function puiJoin(list, max) {
  if (list.length <= max) return list.join('、');
  return list.slice(0, max).join('、') + '…等 ' + list.length + ' 項';
}

function puiSrcText(from) {
  return from.map(function (f) {
    return PUI_SRC_NAME[f] || (PROG_FACTIONS[f] ? PROG_FACTIONS[f].name : f);
  }).join('、');
}

// 需求列:✓/✗、名稱、現有 / 需要、缺少量;note 另起一行(來源、說明)
function puiReq(ok, label, have, need, note) {
  var row = puiEl('div', ok ? 'pg-row ok' : 'pg-row no'), txt = '';
  row.appendChild(puiEl('span', 'pg-mk', ok ? '✓' : '✗'));
  row.appendChild(puiEl('span', 'pg-lb', label));
  if (need !== null && need !== undefined) {
    txt = have + '/' + need;
    if (!ok) txt += ' 缺' + Math.max(0, need - have);
  }
  row.appendChild(puiEl('span', 'pg-val', txt));
  if (note) row.appendChild(puiEl('div', 'pg-nt', note));
  return row;
}

function puiRenderReq(p, c, lvMax) {
  var R = pui.req, id, k, have, need, ok;
  R.textContent = '';
  if (lvMax || !c) {
    R.appendChild(puiEl('div', 'pg-hint', '已達最高等級,沒有下一級需求。'));
    return;
  }
  R.appendChild(puiEl('div', 'pg-sec', '升到 Lv' + (p.lv + 1) + ' 需要'));
  R.appendChild(puiReq(p.xp >= c.xp, '經驗', p.xp, c.xp));
  for (k in c.res) {
    have = puiRes(k);
    need = c.res[k];
    R.appendChild(puiReq(have >= need, PROG_RES_NAME[k] || k, have, need));
  }
  for (id in c.mats) {
    have = p.mats[id] || 0;
    need = c.mats[id];
    R.appendChild(puiReq(have >= need, PROG_MATS[id].name, have, need, '來源:' + puiSrcText(PROG_MATS[id].from)));
  }
  if (c.boss) {
    ok = (p.bossBest[c.boss] || 0) >= 1;
    R.appendChild(puiReq(ok, '首領營「' + progBossName(c.boss) + '」取得 1★', null, null, ok ? '' : '到首領營打一場'));
  }
  if (c.ftue) {
    ok = !!p.ftue.done[c.ftue];
    R.appendChild(puiReq(ok, '教學:' + PROG_FTUE_TEXT[c.ftue], null, null, ok ? '' : '完成教學後可升級'));
  }
}

function puiRenderUnl(lv) {
  var U = pui.unl, L = lv + 1, names;
  U.textContent = '';
  if (L > PROG_LV_MAX) return;
  names = puiUnlockNames(L);
  U.appendChild(puiEl('div', 'pg-sec', 'Lv' + L + ' 將開放'));
  U.appendChild(puiEl('div', 'pg-unlt', names.length ? names.join('、') : '(本級沒有新開放項目)'));
}

// 依目前狀態重畫抽屜與晶片。升級按鈕只切換 disabled,位置永不變。
function progUiRefresh() {
  var p, lv, lvMax, c, pct, chk;
  if (!pui.inited) return;
  if (typeof progNeedsMigrate === 'function' && progNeedsMigrate()) return;   // 舊存檔尚未遷移前不寫入 prog
  p = progGet();
  lv = p.lv;
  lvMax = lv >= PROG_LV_MAX;
  c = lvMax ? null : progUpgradeCost(lv);
  pct = (lvMax || !c || c.xp <= 0) ? 1 : Math.min(1, p.xp / c.xp);
  pui.chipLv.textContent = 'Lv ' + lv;
  pui.chipFill.style.width = Math.round(pct * 100) + '%';
  pui.chipDot.hidden = !(lv > 1 && !p.seen['lvup:' + lv]);
  if (!pui.open) return;
  pui.headLv.textContent = '目前 Lv ' + lv + ' / ' + PROG_LV_MAX;
  pui.sel.value = String(lv);
  pui.legacyBtn.disabled = !puiHasLegacy();
  puiRenderReq(p, c, lvMax);
  puiRenderUnl(lv);
  chk = progCanUpgrade();
  pui.upBtn.disabled = !chk.ok;
  pui.upBtn.textContent = lvMax ? '已滿級' : '升級';
  pui.why.textContent = lvMax ? '已達最高等級' : (chk.ok ? '條件已達成,可升級到 Lv' + (lv + 1) : chk.reason);
  pui.why.className = (chk.ok || lvMax) ? 'pg-why' : 'pg-why pg-bad';
}

function progUiOpen() {
  if (!pui.inited) return;
  pui.open = true;
  pui.drawer.hidden = false;
  pui.chip.setAttribute('aria-expanded', 'true');
  progUiRefresh();
}

// 關閉時把「升級紅點」記為已看過(prog.seen['lvup:N'])
function progUiClose() {
  var p;
  if (!pui.inited) return;
  pui.open = false;
  pui.drawer.hidden = true;
  pui.chip.setAttribute('aria-expanded', 'false');
  if (typeof progNeedsMigrate === 'function' && progNeedsMigrate()) return;
  p = progGet();
  if (p.lv > 1 && !p.seen['lvup:' + p.lv]) {
    p.seen['lvup:' + p.lv] = true;
    progSave();
  }
  progUiRefresh();
}

function puiToggle() {
  if (pui.open) progUiClose(); else progUiOpen();
}

function puiToggleTools() {
  pui.toolsOpen = !pui.toolsOpen;
  pui.tools.hidden = !pui.toolsOpen;
  pui.toolsBtn.textContent = '🧪 測試工具(僅測試用) ' + (pui.toolsOpen ? '▾' : '▸');
}

// 升級或測試動作之後的共同收尾:地圖重繪、建築選單重建、存檔、介面更新(各呼叫皆為可選)
function puiAfterChange() {
  if (typeof landDrawInvalidate === 'function') landDrawInvalidate();
  if (typeof buildToolbar === 'function') buildToolbar();
  if (typeof saveWorld === 'function') saveWorld();
  progUiRefresh();
}

function puiDoUp() {
  var r, names;
  if (typeof progDoUpgrade !== 'function') return;
  r = progDoUpgrade();
  if (!r || !r.ok) { progUiRefresh(); return; }
  names = puiUnlockNames(r.lv);
  puiToast('升到 Lv' + r.lv + '!開放:' + (names.length ? puiJoin(names, 6) : '本級沒有新開放項目'));
  puiAfterChange();
}

// 測試工具動作:錯誤不吞掉,顯示在提示列並寫入 console
function puiTestAct(fn) {
  try {
    fn();
  } catch (e) {
    console.warn('[progui] 測試動作失敗', e);
    puiToast('測試動作失敗:' + e.message);
  }
  puiAfterChange();
}

function puiRestoreLegacy() {
  var bak = null;
  try { bak = localStorage.getItem(PROG_LEGACY_KEY); } catch (e) { bak = null; }
  if (bak === null) return;
  if (!confirm('把舊存檔備份寫回主存檔並重新整理頁面?目前的存檔會被覆蓋。(僅測試用)')) return;
  try {
    localStorage.setItem(PROG_SAVE_KEY, bak);
  } catch (e) {
    puiToast('寫回舊存檔失敗');
    return;
  }
  if (typeof location !== 'undefined' && location && typeof location.reload === 'function') location.reload();
}

function puiBuildChip(top) {
  var info = document.getElementById('info'), fillWrap;
  pui.chip = puiEl('span', 'pg-chip');
  pui.chip.id = 'progChip';
  pui.chip.setAttribute('role', 'button');
  pui.chip.setAttribute('tabindex', '0');
  pui.chip.setAttribute('title', '城市等級(點開升級)');
  pui.chip.setAttribute('aria-expanded', 'false');
  pui.chipLv = puiEl('b', 'pg-lv', 'Lv 1');
  fillWrap = puiEl('i', 'pg-bar');
  pui.chipFill = puiEl('b', 'pg-fill');
  fillWrap.appendChild(pui.chipFill);
  pui.chipDot = puiEl('i', 'prog-dot');
  pui.chipDot.hidden = true;
  pui.chip.appendChild(pui.chipLv);
  pui.chip.appendChild(fillWrap);
  pui.chip.appendChild(pui.chipDot);
  pui.chip.addEventListener('click', function () { puiToggle(); });
  pui.chip.addEventListener('keydown', function (ev) {
    if (ev.key === 'Enter' || ev.key === ' ') puiToggle();
  });
  if (top) top.insertBefore(pui.chip, info);
  else document.body.appendChild(pui.chip);
}

function puiBuildTools() {
  var t = puiEl('div', 'pg-tools'), row = puiEl('div', 'pg-trow'), i, o;
  pui.tools = t;
  t.hidden = true;
  t.appendChild(puiEl('div', 'pg-tnote', '測試工具:僅測試用,正式遊戲不會出現'));
  t.appendChild(puiBtn('pg-tb', '⬆ 升一級(忽略條件)', function () { puiTestAct(function () { progDebugUp(); }); }));
  pui.sel = puiEl('select', 'pg-sel');
  for (i = 1; i <= PROG_LV_MAX; i++) {
    o = puiEl('option', null, 'Lv ' + i);
    o.value = String(i);
    pui.sel.appendChild(o);
  }
  row.appendChild(pui.sel);
  row.appendChild(puiBtn('pg-tb', '直達', function () { puiTestAct(function () { progDebugSetLv(+pui.sel.value); }); }));
  t.appendChild(row);
  t.appendChild(puiBtn('pg-tb', '📦 補滿資源與材料', function () { puiTestAct(function () { progDebugGrantAll(); }); }));
  pui.legacyBtn = puiBtn('pg-tb', '↩ 恢復舊存檔備份', function () { puiRestoreLegacy(); });
  t.appendChild(pui.legacyBtn);
  return t;
}

function puiBuildDrawer() {
  var head = puiEl('div', 'pg-head'), foot = puiEl('div', 'pg-foot'), toolsWrap;
  pui.drawer = puiEl('div');
  pui.drawer.id = 'progDrawer';
  pui.drawer.setAttribute('role', 'dialog');
  pui.drawer.hidden = true;
  head.appendChild(puiEl('b', 'pg-title', '城市等級'));
  pui.headLv = puiEl('span', 'pg-hlv', '');
  head.appendChild(pui.headLv);
  head.appendChild(puiBtn('pg-x', '✕', function () { progUiClose(); }));
  pui.list = puiEl('div', 'pg-list');
  pui.req = puiEl('div', 'pg-req');
  pui.unl = puiEl('div', 'pg-unl');
  pui.toolsBtn = puiBtn('pg-tt', '🧪 測試工具(僅測試用) ▸', function () { puiToggleTools(); });
  toolsWrap = puiBuildTools();
  pui.list.appendChild(pui.req);
  pui.list.appendChild(pui.unl);
  pui.list.appendChild(pui.toolsBtn);
  pui.list.appendChild(toolsWrap);
  pui.why = puiEl('span', 'pg-why', '');
  pui.upBtn = puiBtn('pg-up', '升級', function () { puiDoUp(); });
  foot.appendChild(pui.why);
  foot.appendChild(pui.upBtn);
  pui.drawer.appendChild(head);
  pui.drawer.appendChild(pui.list);
  pui.drawer.appendChild(foot);
  document.body.appendChild(pui.drawer);
}

function puiBuildFtue() {
  pui.ftue = puiEl('div');
  pui.ftue.id = 'progFtue';
  pui.ftue.setAttribute('role', 'status');
  pui.ftue.hidden = true;
  pui.ftueTxt = puiEl('span', 'pg-ftx', '');
  pui.ftue.appendChild(pui.ftueTxt);
  pui.ftue.appendChild(puiBtn('pg-fx', '✕', function () {
    var p = progGet();
    p.ftue.off = true;
    progSave();
    progFtueHide();
  }));
  document.body.appendChild(pui.ftue);
}

// 載入時呼叫一次(本檔末尾);重複呼叫無效
function initProgUI() {
  var top;
  if (pui.inited) return;
  if (typeof document === 'undefined' || !document.body) return;
  top = document.getElementById('topbar');
  puiBuildChip(top);
  puiBuildDrawer();
  puiBuildFtue();
  pui.inited = true;
  if (typeof setInterval === 'function') pui.timer = setInterval(progUiTick, 1000);
  progUiRefresh();
}

// 每秒一次:晶片與(開啟時)抽屜跟著資源與經驗變化。不寫存檔。
function progUiTick() {
  if (!pui.inited) return;
  progUiRefresh();
}

// 鎖頭角標:未開放回 "🔒LvN",已開放或未知 id 回 ""
function progLockBadge(kind, id) {
  var lv, p;
  if (typeof progUnlockLv !== 'function') return '';
  lv = progUnlockLv(kind, id);
  if (lv === null) return '';
  p = progGet();
  if (lv <= p.lv) return '';
  return '🔒Lv' + lv;
}

// 解鎖紅點:只對「本級剛開放(lv 等於目前等級、且 lv>1)」且未看過的項目回傳紅點 HTML。
// 呼叫 progSeenMark(kind, id) 取得紅點字串(未看過才有);點擊時呼叫 progSeenMark(kind, id, true) 記為已看過並回傳 ""。
function progSeenMark(kind, id, read) {
  var p, key, lv;
  if (typeof progUnlockLv !== 'function') return '';
  p = progGet();
  key = 'u:' + kind + ':' + id;
  if (read) {
    if (!p.seen[key]) { p.seen[key] = true; progSave(); }
    return '';
  }
  lv = progUnlockLv(kind, id);
  if (lv === null || lv <= 1 || lv !== p.lv || p.seen[key]) return '';
  return '<i class="prog-dot"></i>';
}

// 回傳目前應提示的教學步驟 id(依等級 PROG_FTUE_REQ);已完成或已關閉回 ""。不彈出,由呼叫端決定何時 progFtueShow。
function progFtueTick() {
  var p, step;
  p = progGet();
  step = p.ftue.off ? '' : (PROG_FTUE_REQ[p.lv] || '');
  if (step && p.ftue.done[step]) step = '';
  return step;
}

// 顯示教學泡泡(一次一則,新的會取代舊的)。已永久關閉或步驟文字不存在回 false。
function progFtueShow(stepId) {
  var p, txt;
  if (!pui.inited) return false;
  p = progGet();
  txt = PROG_FTUE_TEXT[stepId];
  if (p.ftue.off || !txt) return false;
  pui.ftueStep = stepId;
  pui.ftueTxt.textContent = '提示:' + txt;
  pui.ftue.hidden = false;
  return true;
}

function progFtueHide() {
  pui.ftueStep = '';
  if (pui.ftue) pui.ftue.hidden = true;
}

if (typeof document !== 'undefined' && document.body) initProgUI();

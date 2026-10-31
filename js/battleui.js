// battleui.js — 戰鬥介面與戰報(PLAN_TD_MASTER §6.1)
// M1-05 沙盤推演最小版:只在 game.mode==='battleDesign' 開啟,用戰陣棋盤的副本試打。
// 不存檔、不計戰績、不產生錄影;world 在沙盤中只讀。
// 依賴:map.js(game、world、boardToJSON)、ui.js(setTool、showToast、updateResBar)、
//       render.js(screenToCell)、td.js(battleInit、issueCmd、tdApplyCmds、simTick、runToEnd)

const SAND_REASON = { time: '時間到', allDestroyed: '計分建築全毀', wiped: '兵力全滅', retreat: '鳴金' };
const POP_CAP_OPTS = [50, 100, 200, 400];
const DEPLOY_TOAST = { over: '戰鬥已結束', noUnit: '未知兵種', cell: '此處不可放兵', popcap: '人口已滿,無法再放', cap: '單位已達上限' };
// 兵種圖示(純說明用的 emoji;人口以每隊人口表示)
const UNIT_ICON = { militia: '🧑‍🌾', hunter: '🦌', daodun: '🛡️', gongbing: '🏹', qingqi: '🐎', tuqi: '🐴', chihou: '🧭', changji: '🔱', chuangnu: '🎯', chongche: '🐏', toushi: '🪨' };
const DEFAULT_UNIT = 'daodun';

// 可放兵種(fac 為 han / both),依 UNITS 定義順序
function deployUnitKeys() {
  return Object.keys(UNITS).filter(k => tdDeployable(UNITS[k]));
}
function unitPopOf(u) {
  const d = UNITS[u];
  return d ? d.pop * d.squad : 0;
}

const sand = {
  panel: null,
  btn: null,
  open: false,   // 設定面板開啟中
  popCap: TD_POP_CAP,  // 沙盤出兵人口上限(設定面板可選 50/100/200/400)
  unit: DEFAULT_UNIT,  // 選中的兵種,點地圖放一隊
  dn: null,      // 按下座標,分辨點擊與拖曳
  evSeen: 0,     // 已處理的事件索引
  key: ''        // 戰鬥面板重繪鍵
};

// 人口條 HTML(沙盤與出征共用):used / cap;滿時變紅並顯示「人口已滿」
function popBarHtml(used, cap) {
  const full = used + 1e-9 >= cap;
  const pct = cap > 0 ? Math.min(100, Math.round(used / cap * 100)) : 0;
  return '<div class="apop' + (full ? ' full' : '') + '"><span>人口 <b>' + used + '</b> / ' + cap +
    (full ? ' ・ 人口已滿' : '') + '</span><i><b style="width:' + pct + '%"></b></i></div>';
}

// 兵種列(一行、可橫向捲動;每格圖示+名稱+每隊人口);scope 為按鈕所屬面板,點擊由該面板處理 data-pick
function unitStripHtml(sel) {
  let h = '<div class="ustrip">';
  deployUnitKeys().forEach(u => {
    const d = UNITS[u];
    h += '<button data-pick="' + u + '"' + (sel === u ? ' class="on"' : '') + '><span class="uico">' + UNIT_ICON[u] +
      '</span><span class="uname">' + tdEsc(d.name) + '</span><small>' + unitPopOf(u) + ' 人/隊</small></button>';
  });
  return h + '</div>';
}

// 目前選中的可放兵種:沙盤戰鬥用 sand.unit,出征觀察期 / 進軍用 atk.unit
function uiPickedUnit() {
  if (battle && battle.kind === 'sandbox') return sand.unit;
  if (atk.on) return atk.unit;
  return null;
}

// 放一隊(通過 tdDeployWhy 判定才發指令;即時套用,可連續放)
function uiDeploy(b, u, x, y) {
  const why = tdDeployWhy(b, u, x, y);
  if (why !== true) return why;
  issueCmd(b, { op: 'deploy', u: u, part: 'van', x: x, y: y });
  tdApplyCmds(b);
  if (typeof sfxwarDeploy === 'function') sfxwarDeploy(u, UNITS[u].squad, x + 0.5, y + 0.5);
  return true;
}

// 點擊可部署格或已有單位的格子:已有單位且此處不可放兵 → 顯示單位小標籤;否則嘗試放兵(失敗 toast)
function uiFieldTap(b, u, cx, cy) {
  const why = tdDeployWhy(b, u, cx, cy);
  if (why !== true && tipUnitAt(cx, cy)) return;
  if (why !== true) {
    showToast(DEPLOY_TOAST[why] || '無法放兵');
    return;
  }
  uiDeploy(b, u, cx, cy);
}

function tdEsc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function sandClock(ticks) {
  const s = Math.max(0, Math.round(ticks * SIM_DT));
  const p = n => (n < 10 ? '0' : '') + n;
  return p(Math.floor(s / 60)) + ':' + p(s % 60);
}

// 摧毀率:與 td.js tdCheckEnd 同式
function sandPct(b) {
  let total = 0, destroyed = 0;
  for (let n = 0; n < b.bld.length; n++) {
    const bl = b.bld[n], w = bl.cb.scoreW || 0;
    total += w;
    if (!bl.alive) destroyed += w;
  }
  return total > 0 ? destroyed / total : 1;
}

// 掠奪量:本場已摧毀敵方建築價值的 50%(只顯示與寫入結算,不加入 world.res)。
// 由 bld.alive 狀態逐幀統計,建築不會復活,故不會重複計入。
function lootOf(b) {
  const out = { coin: 0, wood: 0, stone: 0 };
  if (!b || !b.bld) return out;
  for (let n = 0; n < b.bld.length; n++) {
    const bl = b.bld[n], d = OBJECTS[bl.type];
    if (bl.alive || !d) continue;
    const c = d.cost || {};
    if (Object.keys(c).length) {
      for (const k in out) out[k] += (c[k] || 0) * 0.5;
    } else {
      const w = (bl.cb && bl.cb.scoreW) || 0;
      out.coin += (w > 0 ? w * 10 : Math.round((bl.maxHp || 0) / 10)) * 0.5;
    }
  }
  return { coin: Math.floor(out.coin), wood: Math.floor(out.wood), stone: Math.floor(out.stone) };
}

// 戰鬥中(攻擊/沙盤/錄影)頂部資源列改顯示掠奪量;離開後還原為 ui.js 的 updateResBar
let lootShown = false;
function lootMode() {
  return game.mode === 'attack' || game.mode === 'replay' || document.body.classList.contains('sandbox');
}

function lootSync() {
  const el = document.getElementById('resbar');
  if (!el) return;
  if (!lootMode()) {
    if (lootShown) {
      lootShown = false;
      lastResHtml = '';
      updateResBar();
    }
    return;
  }
  lootShown = true;
  const l = lootOf(battle);
  let html = '<span class="res loot"><b>⚔ 掠奪</b>';
  for (const k in RESOURCES) html += ' <span>' + RESOURCES[k].icon + ' ' + l[k].toLocaleString() + '</span>';
  html += '</span>';
  if (el.innerHTML !== html) el.innerHTML = html;
}

function initBattleUI() {
  const top = document.getElementById('topbar');
  if (!top || document.getElementById('btnSandbox')) return;
  const btn = document.createElement('button');
  btn.id = 'btnSandbox';
  btn.title = '沙盤推演（用戰陣試打，不計戰績、不存檔）';
  btn.textContent = '⚔ 沙盤';
  top.insertBefore(btn, document.getElementById('btnHide'));
  btn.addEventListener('click', () => {
    if (sand.open) sandClose();
    else sandOpen();
  });
  sand.btn = btn;

  const panel = document.createElement('div');
  panel.id = 'sandPanel';
  panel.hidden = true;
  document.body.appendChild(panel);
  panel.addEventListener('click', onSandClick);
  sand.panel = panel;

  const canvas = document.getElementById('game');
  canvas.addEventListener('pointerdown', e => { sand.dn = { id: e.pointerId, x: e.clientX, y: e.clientY }; });
  canvas.addEventListener('pointerup', sandTap);
  canvas.addEventListener('pointercancel', () => { sand.dn = null; });
  sandSyncButton();
  initAttackUI();
  initReplayUI();
}

function sandSyncButton() {
  if (sand.btn) sand.btn.hidden = game.mode !== 'battleDesign';
}

// 面板貼齊工具列上方(沙盤中工具列隱藏,貼底)
function sandPlace() {
  const tb = document.getElementById('toolbar');
  const h = document.body.classList.contains('sandbox') || !tb ? 0 : tb.offsetHeight;
  sand.panel.style.bottom = 'calc(' + (h + 8) + 'px + env(safe-area-inset-bottom))';
}

function sandOpen() {
  if (game.mode !== 'battleDesign' || battle) return;
  sand.open = true;
  sandRenderSetup();
  sand.panel.hidden = false;
  sandPlace();
}

function sandClose() {
  sand.open = false;
  if (sand.panel) sand.panel.hidden = true;
}

function sandRenderSetup() {
  let h = '<div class="shd"><b>⚔ 沙盤推演</b><button class="close" data-sact="close">✕</button></div>' +
    '<small>設定出兵人口上限,上限內可連續放兵。不計戰績、不存檔。</small>' +
    '<div class="scap"><span>出兵人口上限</span>';
  POP_CAP_OPTS.forEach(v => {
    h += '<button data-cap="' + v + '"' + (sand.popCap === v ? ' class="on"' : '') + '>' + v + '</button>';
  });
  h += '</div><div class="sact"><button data-sact="start">開始沙盤</button></div>';
  sand.panel.innerHTML = h;
}

function sandStart() {
  if (game.mode !== 'battleDesign' || battle) return;
  setTool(null);
  game.mode = 'attack';
  game.phase = 'march';
  game.simSpeed = 1;
  battle = battleInit({ kind: 'sandbox', seed: 1, map: boardToJSON(world), popCap: sand.popCap });
  sand.unit = sand.unit || DEFAULT_UNIT;
  sand.dn = null;
  sand.evSeen = 0;
  sand.key = '';
  sand.open = false;
  document.body.classList.add('sandbox');
  sandRenderBattle();
  sandHud();
  sandPlace();
  sand.panel.hidden = false;
}

function sandRenderBattle() {
  const b = battle;
  if (!b) return;
  const key = b.popUsed + '|' + sand.unit + '|' + game.simSpeed;
  if (key === sand.key) return;
  sand.key = key;
  const sp = game.simSpeed;
  const spd = (v, label) => '<button data-speed="' + v + '"' + (sp === v ? ' class="on"' : '') + '>' + label + '</button>';
  sand.panel.innerHTML =
    '<div class="shd"><b>⚔ 沙盤推演</b><small>不計戰績・不存檔</small></div>' +
    '<div class="shud"><span id="sandTimer"></span><span id="sandDestroy"></span></div>' +
    popBarHtml(b.popUsed, b.popCap) +
    unitStripHtml(sand.unit) +
    '<div class="sspd">' + spd(1, '1x') + spd(2, '2x') + spd(4, '4x') + spd(0, '⏸ 暫停') +
    '<button data-sact="end">結束</button></div>';
}

function sandHud() {
  if (!battle) return;
  const t = document.getElementById('sandTimer'), d = document.getElementById('sandDestroy');
  if (t) t.textContent = '剩 ' + sandClock(battle.limitTick - battle.tick) + (game.simSpeed === 0 ? '(暫停)' : '');
  if (d) d.textContent = '摧毀 ' + Math.floor(sandPct(battle) * 100) + '%';
}

function onSandClick(e) {
  const b = e.target.closest('button');
  if (!b) return;
  const cap = b.getAttribute('data-cap'), pick = b.getAttribute('data-pick');
  const sp = b.getAttribute('data-speed'), act = b.getAttribute('data-sact');
  if (cap !== null) {
    sand.popCap = +cap;
    sandRenderSetup();
  } else if (act === 'start') {
    sandStart();
  } else if (act === 'close') {
    sandClose();
  } else if (act === 'end') {
    sandRetreat();
  } else if (sp !== null) {
    game.simSpeed = +sp;
    sandRenderBattle();
    sandHud();
  } else if (pick !== null) {
    sand.unit = pick;
    sandRenderBattle();
  }
}

// 點地圖(移動小於 8px 才算點擊)放一隊;指令於當下套用(等同下一個 simTick 第 1 步)
function sandTap(e) {
  const d = sand.dn;
  sand.dn = null;
  if (atk.on || rp.on) return;
  if (!battle || battle.over || !d || d.id !== e.pointerId) return;
  if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 8) return;
  if (tipIsOpen()) { tipHide(); return; }
  const c = screenToCell(e.clientX, e.clientY);
  if (!c) return;
  if (world.occ[idx(c.x, c.y)] > 0) { atkInfo(c.x, c.y); return; }
  uiFieldTap(battle, sand.unit, c.x, c.y);
  sandRenderBattle();
  sandHud();
}

// 鳴金:直接結算(暫停時也能結束,不必等下一個 tick)
function sandRetreat() {
  const b = battle;
  if (!b || b.over) return;
  b.over = true;
  b.result = tdSettle(b, 'retreat', sandPct(b));
  sandFinish();
}

// 結算並回設計模式:battle=null、回 battleDesign、工具列與頂列恢復。不存檔
function sandFinish() {
  const b = battle;
  if (!b) return;
  const r = b.result || tdSettle(b, 'retreat', sandPct(b));
  r.loot = lootOf(b);
  battle = null;
  game.mode = 'battleDesign';
  game.phase = '';
  game.simSpeed = 1;
  document.body.classList.remove('sandbox');
  sand.dn = null;
  sand.key = '';
  if (sand.panel) sand.panel.hidden = true;
  setTool(null);
  updateResBar();
  showToast('沙盤結束(' + SAND_REASON[r.reason] + ')：摧毀率 ' + Math.floor(r.pct * 100) + '%，用時 ' + sandClock(r.tick));
  sandShowResult(b, r);
}

// 沙盤結算面板:沿用出征結算的版型(共用 atk.panel 與其樣式),不計戰績、不存檔
function sandShowResult(b, r) {
  if (!atk.panel) return;
  atk.panel.classList.remove('abar');
  let h = '<div class="shd"><b>⚔ 沙盤推演結果</b><button class="close" data-atk="sdesign">✕</button></div>';
  h += '<small>不計戰績、不存檔</small>';
  h += battleResBody(b, r);
  h += '<div class="sact"><button data-atk="sagain">再試一次</button><button data-atk="sdesign">回設計</button></div>';
  atk.panel.innerHTML = h;
  atk.panel.hidden = false;
  atkPlace();
}

// 每幀由 main.js 呼叫:同步按鈕、處理新事件、偵測結束、更新面板
function battleUiTick(dt) {
  tipTick(dt);
  lootSync();
  sandSyncButton();
  atkTick(dt);
  atkSync();
  rptSync();
  if (rp.on) {
    rpPaint();
    return;
  }
  if (atk.on) return;
  if (!battle) {
    if (sand.open && game.mode !== 'battleDesign') sandClose();
    return;
  }
  const ev = battle.events;
  for (let k = sand.evSeen; k < ev.length; k++) {
    if (ev[k].type === 'deployFail') showToast('無法部署：' + (DEPLOY_TOAST[(ev[k].data || {}).why] || '未知原因'));
  }
  sand.evSeen = ev.length;
  if (battle.over) {
    sandFinish();
    return;
  }
  sandRenderBattle();
  sandHud();
}

// 切到背景時:在戰鬥中則用剩餘時間無輸入快跑完並結算(PLAN_TD_CORE §4.1)
function battleUiHide() {
  if (atk.on) {
    if (battle && !battle.over && game.phase === 'march') {
      runToEnd(battle);
      atkEnd();
    }
    return;
  }
  if (!battle || battle.over) return;
  if (game.mode !== 'attack' || game.phase !== 'march') return;
  runToEnd(battle);
  sandFinish();
}

// ---- M2-06 出征全流程(PLAN_TD_MASTER M2-06;PLAN_TD_CORE §1.4~§1.10) ----
// 出征面板 → 整軍 → 進攻(boardBackup、斥候視野)→ 觀察期(只可放先鋒)→ 放下先鋒開戰 → 進軍 → 結束呼叫 attackFinish(b)。
// 結算與錄影播放器由之後的任務在 attackFinish 內處理;結束時呼叫 atkRestore(false) 回到進攻前模式。
const ATK_SCOUT_SEC = 180;
const ATK_DIFF = { 1: '易', 2: '中', 3: '難' };

const atk = {
  on: false,          // 進攻流程進行中(觀察期或進軍)
  open: false,        // 出征面板開啟中
  view: 'list',       // 'list' | 'muster'
  npc: null,          // 選取的 NPC 據點 id
  unit: DEFAULT_UNIT, // 選中的兵種,點地圖放一隊
  prevMode: 'estate', // 進攻前的 game.mode
  flagArm: false,     // 令旗待選建築
  ended: false,       // 已呼叫過結束流程
  sub: '', subLeft: 0,
  dn: null, lastHtml: '',
  btn: null, panel: null, hud: null, hudClock: null, hudSub: null, hudPop: null, popHtml: '',
  ctl: null, ctlKey: '', pauseMark: null,  // 進軍期控制列(離開/暫停/速度)與「已暫停」字樣
  spd: 1,             // 最近一次的非暫停速度(繼續時套用)
  leaveAsk: false     // 離開鈕的二段確認中
};
// 小標籤(#tdTip)與選取圈(#tdSelRing):同一時間只存在一個,3 秒後淡出;bld 為建築索引(單位為 -1)
const tip = { el: null, ring: null, left: 0, bld: -1, shown: false };

function atkFmt(sec) {
  const s = Math.max(0, Math.ceil(sec));
  return Math.floor(s / 60) + ':' + (s % 60 < 10 ? '0' : '') + (s % 60);
}

function atkStars(n) {
  const k = Math.max(0, Math.min(3, n | 0));
  return '★'.repeat(k) + '☆'.repeat(3 - k);
}

function atkNpc(id) { return NPC_BASES.find(v => v.id === id) || null; }
function atkCanOpen() {
  return !atk.on && !battle && !game.backup && (game.mode === 'estate' || game.mode === 'battleDesign');
}

function initAttackUI() {
  const top = document.getElementById('topbar');
  if (!top || document.getElementById('btnAttack')) return;
  const btn = document.createElement('button');
  btn.id = 'btnAttack';
  btn.className = 'corner corner-atk';
  btn.title = '戰鬥：隨機戰鬥、朋友邀請碼、戰報';
  btn.textContent = '⚔ 戰鬥';
  document.body.appendChild(btn);
  btn.addEventListener('click', () => {
    if (typeof cornerToggleFight === 'function') cornerToggleFight();
  });
  atk.btn = btn;

  const panel = document.createElement('div');
  panel.id = 'atkPanel';
  panel.hidden = true;
  document.body.appendChild(panel);
  panel.addEventListener('click', onAtkClick);
  atk.panel = panel;

  const hud = document.createElement('div');
  hud.id = 'atkHud';
  hud.hidden = true;
  atk.hudClock = document.createElement('b');
  atk.hudSub = document.createElement('span');
  hud.appendChild(atk.hudClock);
  hud.appendChild(atk.hudSub);
  atk.hudPop = document.createElement('div');
  hud.appendChild(atk.hudPop);
  document.body.appendChild(hud);
  atk.hud = hud;

  const ctl = document.createElement('div');
  ctl.id = 'atkCtl';
  ctl.hidden = true;
  ctl.addEventListener('click', onCtlClick);
  document.body.appendChild(ctl);
  atk.ctl = ctl;

  const pauseMark = document.createElement('div');
  pauseMark.id = 'atkPause';
  pauseMark.hidden = true;
  pauseMark.textContent = '已暫停';
  document.body.appendChild(pauseMark);
  atk.pauseMark = pauseMark;

  tip.el = document.createElement('div');
  tip.el.id = 'tdTip';
  tip.el.hidden = true;
  document.body.appendChild(tip.el);
  tip.ring = document.createElement('div');
  tip.ring.id = 'tdSelRing';
  tip.ring.hidden = true;
  document.body.appendChild(tip.ring);

  // ui.js 的 tapObjectAt 會開科研院面板(大面板);進攻/沙盤/錄影中不可開啟任何經營面板
  if (typeof tapObjectAt === 'function') {
    const tapObjectOrig = tapObjectAt;
    tapObjectAt = function (sx, sy) {
      if (lootMode()) return;
      tapObjectOrig(sx, sy);
    };
  }

  const canvas = document.getElementById('game');
  canvas.addEventListener('pointerdown', e => { atk.dn = { id: e.pointerId, x: e.clientX, y: e.clientY }; });
  canvas.addEventListener('pointerup', atkTap);
  canvas.addEventListener('pointercancel', () => { atk.dn = null; });

  // 進攻中不得以 H / R 改動棋盤(建築隱藏、旋轉)
  window.addEventListener('keydown', e => {
    if ((atk.on || rp.on) && (e.key === 'h' || e.key === 'H' || e.key === 'r' || e.key === 'R')) e.stopImmediatePropagation();
  }, true);
  atkSync();
}

function atkSync() {
  if (!atk.btn) return;
  const m = game.mode;
  atk.btn.hidden = atk.on || !!game.backup || (m !== 'estate' && m !== 'battleDesign') || (typeof cornerHidden === 'function' && cornerHidden());
}

// 面板貼齊工具列上方(進攻中工具列隱藏,貼底)
function atkPlace() {
  if (!atk.panel) return;
  const tb = document.getElementById('toolbar');
  const h = document.body.classList.contains('atk-mode') || !tb ? 0 : tb.offsetHeight;
  atk.panel.style.bottom = 'calc(' + (h + 8) + 'px + env(safe-area-inset-bottom))';
}

function atkOpenList() {
  if (!atkCanOpen()) return;
  atk.open = true;
  atk.view = 'list';
  atkRenderSetup();
}

function atkOpenMuster() {
  atk.open = true;
  atk.view = 'muster';
  atkRenderSetup();
}

function atkMusterHtml() {
  const nb = atkNpc(atk.npc);
  const best = nb && world.npcBest ? (world.npcBest[nb.id] | 0) : 0;
  let h = '<div class="shd"><button class="ahd" data-atk="back">‹ 返回</button><b>出征・' + tdEsc(nb ? nb.name : '') +
    '</b><button class="close" data-atk="close">✕</button></div>';
  h += '<small>難度 ' + (nb ? ATK_DIFF[nb.diff] : '—') + ' ・ 最佳 ' + atkStars(best) + '</small>';
  h += '<div class="apopcap">出征人口上限 <b>' + TD_POP_CAP + '</b></div>';
  h += '<small>可帶兵種(每隊人口)</small><div class="ulist">';
  deployUnitKeys().forEach(u => {
    h += '<div class="urow"><span class="uico">' + UNIT_ICON[u] + '</span><span class="uname">' + tdEsc(UNITS[u].name) +
      '</span><small>每隊 ' + unitPopOf(u) + ' 人</small></div>';
  });
  h += '</div>';
  h += '<div class="arule"><small>軍令</small>' +
    '<p>🥁 擂鼓:全軍加速,限用一次。</p>' +
    '<p>🚩 令旗:指定一座可見建築為目標,限用一次。</p>' +
    '<p>🔔 鳴金:收兵結算,隨時可用。</p></div>';
  h += '<div class="sact"><button class="abig" data-atk="go"' + (nb ? '' : ' disabled') + '>進攻</button></div>';
  return h;
}

function onAtkClick(e) {
  const b = e.target.closest('button');
  if (!b) return;
  const pick = b.getAttribute('data-pick');
  const act = b.getAttribute('data-atk');
  if (pick !== null) {
    atkPick(pick);
  } else if (!act) {
    return;
  } else if (act === 'sdesign') {
    atk.panel.hidden = true;
    return;
  } else if (act === 'sagain') {
    atk.panel.hidden = true;
    sandOpen();
    return;
  } else if (act === 'close') {
    atkClosePanel();
    return;
  } else if (act === 'pick') {
    atk.npc = b.getAttribute('data-npc');
    atk.view = 'muster';
    atkRenderSetup();
    return;
  } else if (act === 'back') {
    atk.view = 'list';
    atkRenderSetup();
    return;
  } else if (act === 'go') {
    atkGo();
  } else if (act === 'rwatch') {
    rpWatchFromResult();
  } else if (act === 'again') {
    atkRestore(false);
    atkOpenMuster();
  } else if (act === 'home') {
    atkRestore(false);
  } else if (act === 'drum') {
    atkCmdDrum();
  } else if (act === 'flag') {
    atkCmdFlagArm();
  } else if (act === 'retreat') {
    atkCmdRetreat();
  } else if (act === 'scoutRetreat') {
    atkRetreat();
  }
  if (atk.on) atkPaint();
  else if (atk.open) atkRenderSetup();
}

function atkGo() {
  const nb = atkNpc(atk.npc);
  if (!nb) { showToast('請先選擇據點'); return; }
  atkLaunch(nb);
}

function atkClosePanel() {
  atk.open = false;
  if (!atk.on && atk.panel) atk.panel.hidden = true;
}

function atkRenderSetup() {
  if (!atk.panel) return;
  atk.panel.classList.remove('abar');
  atk.lastHtml = '';
  atk.panel.innerHTML = atk.view === 'muster' ? atkMusterHtml() : atkListHtml();
  atk.panel.hidden = false;
  atkPlace();
}

function atkListHtml() {
  let h = '<div class="shd"><b>⚔ 出征</b><button class="close" data-atk="close">✕</button></div>' +
    '<small>選擇要攻打的 NPC 據點(難度、最佳星)。整軍後進攻,觀察期不耗兵。</small>';
  NPC_BASES.forEach(nb => {
    const best = world.npcBest ? (world.npcBest[nb.id] | 0) : 0;
    h += '<div class="arow"><div class="ainfo"><b>' + tdEsc(nb.name) + '</b> <small>難度 ' + ATK_DIFF[nb.diff] +
      '　最佳 ' + atkStars(best) + '</small><small>' + tdEsc(nb.intro) + '</small></div>' +
      '<button data-atk="pick" data-npc="' + tdEsc(nb.id) + '">選擇</button></div>';
  });
  return h;
}




// 進攻:boardBackup → 載入斥候視野 → 觀察期(180 秒)
function atkLaunch(nb) {
  if (!atkCanOpen()) return;
  const prevMode = game.mode;
  setTool(null);
  hideReset();
  boardBackup();
  game.mode = 'attack';
  const bj = npcLoadIntoWorld(nb.id);
  const snap = bj ? snapSplit(bj, { pid: 'npc:' + nb.id, name: nb.name }) : null;
  const bd = snap ? boardFromJSON(snapScoutView(snap)) : null;
  if (!bd) {
    game.mode = prevMode;
    boardRestore();
    showToast('據點載入失敗');
    atkSync();
    return;
  }
  atkSetBoard(bd);
  atk.prevMode = prevMode;
  atk.npc = nb.id;
  atk.on = true;
  atk.open = false;
  atk.ended = false;
  atk.flagArm = false;
  atk.unit = DEFAULT_UNIT;
  atk.lastHtml = '';
  atk.sub = ''; atk.subLeft = 0;
  game.phase = 'scout';
  game.scoutLeft = ATK_SCOUT_SEC;
  game.sel = -1;
  game.simSpeed = 1;
  atk.spd = 1;
  atk.leaveAsk = false;
  tipHide();
  toggleTechPanel(false);
  game.target = { kind: 'npc', refId: nb.id, snap: snap };
  document.body.classList.add('atk-mode');
  atkSync();
  atkPlace();
  atkSetSub('斥候入境,觀察城防', 3);
  atkPaint();
}

function atkSetBoard(bd) {
  BOARD_KEYS.forEach(k => { world[k] = bd[k]; });
  rebuildOcc();
}

function atkSetSub(text, sec) {
  atk.sub = text;
  atk.subLeft = sec;
}

// 觀察期只可選先鋒卡;進軍期可選仍有隊數且已開放的部
// 選兵種(觀察期與進軍期皆可,任何時間都可放;不可放兵種忽略)
function atkPick(u) {
  if (!UNITS[u] || !tdDeployable(UNITS[u])) return;
  atk.unit = u;
  atk.flagArm = false;
}

// 放下先鋒即開戰:先以完整地圖試建 battle,可部署才切到戰場棋盤(避免觀察期露出陷阱)
// 放下第一隊即開戰:先以完整地圖試建 battle,可部署才切到戰場棋盤(避免觀察期露出陷阱)
function atkStartBattle(x, y) {
  const snap = game.target && game.target.snap;
  if (!snap) return;
  const bd = boardFromJSON(snapFull(snap));
  if (!bd) return;
  const b = battleInit({ kind: 'npc', seed: hashStr(snap.snapHash + ':' + Date.now()) >>> 0, map: battleMapOf(snapFull(snap)), refId: atk.npc });
  const why = tdDeployWhy(b, atk.unit, x, y);
  if (why !== true) {
    showToast(DEPLOY_TOAST[why] || '無法放兵');
    return;
  }
  atkSetBoard(bd);
  battle = b;
  issueCmd(b, { op: 'deploy', u: atk.unit, part: 'van', x: x, y: y });
  tdApplyCmds(b);
  if (typeof sfxwarDeploy === 'function') sfxwarDeploy(atk.unit, UNITS[atk.unit].squad, x + 0.5, y + 0.5);
  game.phase = 'march';
  game.sel = -1;
  atkSetSub('第一通鼓・開戰', 3);
  atkPaint();
}

// 軍令立即套用(暫停中也生效);與 simTick 第 1 步同一 tick 處理,錄影重跑等價
function atkIssue(cmd) {
  issueCmd(battle, cmd);
  tdApplyCmds(battle);
}

function atkCmdDrum() {
  if (!battle || battle.over || game.phase !== 'march' || battle.orders.drum >= 1) return;
  atkIssue({ op: 'drum' });
  atkSetSub('擂鼓・全軍振奮', 3);
}

function atkCmdFlagArm() {
  if (!battle || battle.over || game.phase !== 'march' || battle.orders.flag >= 1) return;
  atk.flagArm = !atk.flagArm;
  atkSetSub(atk.flagArm ? '請點選一座可見建築作為令旗目標' : '', atk.flagArm ? 3 : 0);
}

function atkCmdRetreat() {
  if (!battle || battle.over || game.phase !== 'march' || battle.retreat) return;
  atkIssue({ op: 'retreat' });
  atkSetSub('鳴金・收兵', 3);
}

function atkFlagAt(n) {
  if (!battle || battle.over || game.phase !== 'march') return;
  const bl = n >= 0 ? battle.bld[n] : null;
  if (!bl || !tdLive(bl)) {
    showToast('令旗需指定一座可見且未毀的建築');
    return;
  }
  atkIssue({ op: 'flag', n: n });
  atk.flagArm = false;
  atkSetSub('令旗插下・' + ((OBJECTS[bl.type] || {}).name || bl.type) + '為目標', 3);
  atkPaint();
}

// 小標籤:貼在物件螢幕座標上方,同一時間只一個;3 秒後淡出(tipTick)
function tipShow(text, gx, gy, bld) {
  if (!tip.el) return;
  tipHide();
  const p = atkScreenOf(gx, gy);
  const W = (typeof window !== 'undefined' && window.innerWidth) || 375;
  tip.el.textContent = text;
  tip.el.style.left = Math.max(96, Math.min(W - 96, p[0])) + 'px';
  tip.el.style.top = (p[1] - 14) + 'px';
  tip.el.style.opacity = '1';
  tip.el.hidden = false;
  tip.ring.style.left = p[0] + 'px';
  tip.ring.style.top = p[1] + 'px';
  tip.ring.style.opacity = '1';
  tip.ring.hidden = false;
  tip.left = 3;
  tip.shown = true;
  tip.bld = bld;
  if (bld >= 0 && battle) game.sel = bld;
}

function tipHide() {
  if (!tip.shown) return;
  tip.shown = false;
  tip.el.hidden = true;
  tip.ring.hidden = true;
  if (tip.bld >= 0 && battle && game.sel === tip.bld) game.sel = -1;
  tip.bld = -1;
}

function tipIsOpen() { return tip.shown; }

function tipTick(dt) {
  if (!tip.shown) return;
  tip.left -= dt;
  if (tip.left <= 0) { tipHide(); return; }
  const a = tip.left < 0.5 ? String(Math.max(0, tip.left / 0.5)) : '1';
  tip.el.style.opacity = a;
  tip.ring.style.opacity = a;
}

// 格座標(連續座標)→ 螢幕座標;戰鬥中依戰場地面高度
function atkScreenOf(gx, gy) {
  const h = battle ? tdGroundHz(battle, gx, gy) : (world.height[idx(Math.floor(gx), Math.floor(gy))] || 0) * HL;
  const q = gpt(gx, gy, h);
  return worldToScreen(q[0], q[1]);
}

// 點建築:小標籤顯示名稱 / HP / 射程(戰鬥中用戰場的 HP;隱藏且未揭露者顯示「未知設施」)
function atkInfo(x, y) {
  const n = world.occ[idx(x, y)] - 1;
  if (n < 0) return;
  const o = world.objects[n];
  const bl = battle ? battle.bld[n] : null;
  const d = OBJECTS[o.type] || {};
  const cb = d.cb || {};
  const ax = o.x + (d.w || 1) / 2, ay = o.y + (d.h || 1) / 2;
  if (bl && bl.hidden) { tipShow('未知設施', ax, ay, n); return; }
  let s = d.name || o.type;
  if (bl && bl.maxHp > 0) s += ' ・ HP ' + Math.ceil(bl.hp) + '/' + Math.ceil(bl.maxHp) + (bl.alive ? '' : '(已毀)');
  else if (!bl && cb.hp > 0) s += ' ・ HP ' + cb.hp;
  if (cb.range > 0) s += ' ・ 射程 ' + cb.range;
  tipShow(s, ax, ay, n);
}

// 點單位:同一格內最近的存活單位;回傳是否已處理
function tipUnitAt(cx, cy) {
  if (!battle || !battle.units) return false;
  let best = null, bd = Infinity;
  for (let k = 0; k < battle.units.length; k++) {
    const u = battle.units[k];
    if (!(u.hp > 0) || Math.floor(u.x) !== cx || Math.floor(u.y) !== cy) continue;
    const dd = Math.hypot(u.x - (cx + 0.5), u.y - (cy + 0.5));
    if (dd < bd) { bd = dd; best = u; }
  }
  if (!best) return false;
  const d = UNITS[best.u] || { name: best.u };
  tipShow(d.name + ' ・ HP ' + Math.ceil(best.hp) + '/' + Math.ceil(best.maxHp), best.x, best.y, -1);
  return true;
}

// 點擊(移動小於 8px)地圖:觀察期點可部署格即開戰;進軍期點建築/單位顯示小標籤,點空地放兵或指定令旗目標。
// 小標籤開啟時,任何一次點擊先只關閉小標籤(不放兵、不開新標籤)
// 點擊(移動小於 8px)地圖:觀察期點可部署格即放第一隊開戰;進軍期點建築顯示小標籤,點空地或已有單位的可部署格放一隊(連續放),
// 令旗待選時點建築作為目標。小標籤開啟時,任何一次點擊先只關閉小標籤(不放兵、不開新標籤)
function atkTap(e) {
  const d = atk.dn;
  atk.dn = null;
  if (!atk.on || !d || d.id !== e.pointerId) return;
  if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 8) return;
  if (tipIsOpen()) { tipHide(); return; }
  const c = screenToCell(e.clientX, e.clientY);
  if (!c) return;
  const n = world.occ[idx(c.x, c.y)] - 1;
  if (game.phase === 'scout') {
    if (n >= 0) { atkInfo(c.x, c.y); return; }
    if (deployCells(world, 'front')[c.y * MAP_W + c.x] === 1) atkStartBattle(c.x, c.y);
    else showToast(DEPLOY_TOAST.cell);
    return;
  }
  if (game.phase !== 'march' || !battle || battle.over) return;
  if (atk.flagArm) { atkFlagAt(n); return; }
  if (n >= 0) { atkInfo(c.x, c.y); return; }
  uiFieldTap(battle, atk.unit, c.x, c.y);
  atkPaint();
}

// 離開:以目前狀況結算。等同鳴金後立即推進一步(simTick),由 tdCheckEnd 依摧毀率與星數判定;
// 不要求已放兵,暫停中也可離開;錄影以同一 tick 的 retreat 指令記錄,重播一致
function atkLeave() {
  atk.leaveAsk = false;
  if (!atk.on || game.phase !== 'march' || !battle || battle.over) return;
  if (!battle.retreat) atkIssue({ op: 'retreat' });
  simTick(battle);
  atkSetSub('', 0);
  if (battle.over) atkEnd();
}

function atkSetSpeed(v) {
  atk.spd = v;
  game.simSpeed = v;
}

function atkTogglePause() {
  if (game.simSpeed === 0) game.simSpeed = atk.spd || 1;
  else game.simSpeed = 0;
}

// 進軍期控制列:🚪 離開(二段確認)、⏸ 暫停 / ▶ 繼續、1x / 2x / 4x;暫停時中央顯示「已暫停」
function atkCtlPaint() {
  if (!atk.ctl) return;
  const on = atk.on && game.phase === 'march' && !!battle && !battle.over;
  atk.ctl.hidden = !on;
  atk.pauseMark.hidden = !(on && game.simSpeed === 0);
  if (!on) return;
  const paused = game.simSpeed === 0;
  const key = (atk.leaveAsk ? 'ask' : 'cmd') + (paused ? 'P' : 'R') + atk.spd;
  if (key === atk.ctlKey) return;
  atk.ctlKey = key;
  if (atk.leaveAsk) {
    atk.ctl.innerHTML = '<span class="cq">離開戰鬥並結算?</span>' +
      '<button data-ctl="leaveOk">確定</button><button data-ctl="leaveNo">取消</button>';
    return;
  }
  let h = '<button data-ctl="leave">🚪 離開</button>' +
    '<button data-ctl="pause">' + (paused ? '▶ 繼續' : '⏸ 暫停') + '</button>';
  [1, 2, 4].forEach(v => {
    h += '<button data-ctl="spd" data-s="' + v + '"' + (atk.spd === v ? ' class="on"' : '') + '>' + v + 'x</button>';
  });
  atk.ctl.innerHTML = h;
}

function onCtlClick(e) {
  const b = e.target.closest('button');
  if (!b) return;
  const act = b.getAttribute('data-ctl');
  if (act === 'leave') atk.leaveAsk = true;
  else if (act === 'leaveNo') atk.leaveAsk = false;
  else if (act === 'leaveOk') atkLeave();
  else if (act === 'pause') atkTogglePause();
  else if (act === 'spd') atkSetSpeed(+b.getAttribute('data-s'));
  atkCtlPaint();
}

// 底部列(一列、總高 ≤ 96px):兵種列(可橫向捲動)+ 軍令三鈕(小按鈕一行);觀察期軍令鈕停用,第三鈕為撤退
function atkBattleHtml() {
  const scout = game.phase === 'scout';
  const o = scout ? { drum: 1, flag: 1 } : battle.orders;
  return unitStripHtml(atk.unit) +
    '<div class="acmd">' +
    '<button data-atk="drum"' + (o.drum >= 1 ? ' disabled' : '') + '>🥁 擂鼓</button>' +
    '<button data-atk="flag"' + (o.flag >= 1 ? ' disabled' : '') + (atk.flagArm ? ' class="on"' : '') + '>🚩 令旗</button>' +
    (scout ? '<button data-atk="scoutRetreat">↩ 撤退</button>' : '<button data-atk="retreat"' + (battle.retreat ? ' disabled' : '') + '>🔔 鳴金</button>') +
    '</div>';
}

// 每幀更新 HUD 與戰鬥面板(面板只在內容變動時重繪)
function atkPaint() {
  if (!atk.on || game.phase === 'result' || !atk.hud) return;
  const scout = game.phase === 'scout';
  atk.hud.hidden = false;
  atk.panel.hidden = false;
  atk.panel.classList.add('abar');
  atk.hudClock.textContent = scout ? '斥候 ' + atkFmt(game.scoutLeft) : (battle ? '進軍 ' + atkFmt((battle.limitTick - battle.tick) * SIM_DT) : '');
  atk.hudSub.textContent = atk.subLeft > 0 ? atk.sub : (scout ? '點可部署區放下第一隊即開戰' : '');
  const ph = popBarHtml(battle ? battle.popUsed : 0, battle ? battle.popCap : TD_POP_CAP);
  if (ph !== atk.popHtml) { atk.popHtml = ph; atk.hudPop.innerHTML = ph; }
  atkCtlPaint();
  const html = atkBattleHtml();
  if (html !== atk.lastHtml) {
    atk.lastHtml = html;
    atk.panel.innerHTML = html;
  }
}

function atkTick(dt) {
  if (!atk.on) return;
  if (game.phase === 'scout') {
    if (document.visibilityState === 'visible') game.scoutLeft -= dt;
    if (game.scoutLeft <= 0) {
      showToast('斥候時間到,撤回整軍');
      atkRetreat();
      return;
    }
  } else if (game.phase === 'march' && battle && battle.over && !atk.ended) {
    atkEnd();
    return;
  }
  if (atk.subLeft > 0) atk.subLeft -= dt;
  atkPaint();
}

// 觀察期撤退:回整軍(無懲罰、不計次數)
function atkRetreat() {
  atkRestore(true);
}

// 戰鬥結束:交給 attackFinish(b)(結算任務實作);尚未實作時 toast 後回到進攻前模式
function atkEnd() {
  const b = battle;
  if (!b) return;
  atk.ended = true;
  game.phase = 'result';
  atkHideBattleUI();
  if (typeof attackFinish === 'function') {
    attackFinish(b);
    return;
  }
  showToast('戰鬥結束:星數 ' + mioStarsOf(b) + '、摧毀率 ' + Math.floor(sandPct(b) * 100) + '%');
  atkRestore(false);
}

function atkHideBattleUI() {
  atk.lastHtml = '';
  if (atk.hud) atk.hud.hidden = true;
  if (atk.panel && !atk.open) atk.panel.hidden = true;
  if (atk.ctl) atk.ctl.hidden = true;
  if (atk.pauseMark) atk.pauseMark.hidden = true;
  atk.leaveAsk = false;
  tipHide();
}

// 回到進攻前:棋盤 boardRestore、模式還原、工具列重建。reopen 為 true 時回到整軍面板(觀察期撤退用)
function atkRestore(reopen) {
  battle = null;
  if (game.backup) boardRestore();
  game.mode = atk.prevMode || 'estate';
  game.phase = '';
  game.target = null;
  game.sel = -1;
  game.scoutLeft = 0;
  game.simSpeed = 1;
  atk.spd = 1;
  atk.on = false;
  atk.ended = false;
  atk.flagArm = false;
  atk.dn = null;
  atk.sub = '';
  atk.subLeft = 0;
  atk.open = false;
  atkHideBattleUI();
  document.body.classList.remove('atk-mode');
  buildToolbar();
  setTool(null);
  updateBoardSwitch();
  mapeditUpdateDot();
  updateResBar();
  saveWorld();
  atkSync();
  if (reopen) atkOpenMuster();
}

// ---- M2-06 後半:結算(論功行賞)、錄影播放器、戰報頁(PLAN_TD_MASTER §3.7、§14.4;CORE §4.6) ----
const RP_SPEEDS = [1, 2, 4];
const rp = {
  on: false,        // 錄影播放中(game.mode === 'replay')
  rep: null,        // 播放中的錄影
  prev: 'estate',   // 播放前的 game.mode,關閉時回到此模式
  spd: 1,           // 最近一次非暫停的速度
  bar: null, title: null, time: null, slide: null, pause: null, msg: null, lines: null,
  spdEls: [],
  drag: false,      // 進度條拖曳中:不覆寫滑桿位置
  checked: null     // 重播校驗:null 未判定 / true 一致 / false 不一致
};
const rpt = { open: false, tab: 'mine', detail: null, btn: null, panel: null };

function rpEl(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

function rpPlayable(rep) {
  return !!rep && rep.v === SIM_VER && !!rep.snap && typeof rep.snap === 'object' && Array.isArray(rep.cmds) &&
    rep.army != null && rep.seed != null;
}

function rpNpcName(rep) { return rep.def && rep.def.name ? rep.def.name : '未知對手'; }
function rpGradeName(g) { return (GRADE_TEXT[g] || { name: '—' }).name; }
function rpDateText(ts) {
  const d = new Date(ts || 0);
  return replayDayKey(ts || 0) + ' ' + replayPad(d.getHours()) + ':' + replayPad(d.getMinutes());
}

// 關鍵事件 → 戰報句(REPORT_TEXT 代入 {unit}{bld}{n};drumOrder 對應 drum);最多 12 行
function atkReportLines(b) {
  const out = [];
  (b.events || []).forEach(ev => {
    if (out.length >= 12) return;
    const t = REPORT_TEXT[ev.type === 'drumOrder' ? 'drum' : ev.type];
    if (typeof t !== 'string') return;
    const d = ev.data || {};
    const unitName = d.unit ? ((UNITS[d.unit] || {}).name || d.unit) : '一隊';
    const bldName = d.bld ? ((OBJECTS[d.bld] || {}).name || d.bld) : '';
    out.push(t.replace(/\{(unit|bld|n)\}/g, (m, k) => (k === 'unit' ? unitName : k === 'bld' ? bldName : String(d.n != null ? d.n : ''))));
  });
  return out;
}

// 錄影的文字戰報:首行為結果,其後為 atkReportLines(覆寫 mapio 產生的版本,以取得中文名)
function atkTextLines(b, r) {
  return ['結果 ' + (r.stars | 0) + ' 星,摧毀 ' + Math.floor((r.pct || 0) * 100) + '%'].concat(atkReportLines(b));
}

// 結算(論功行賞):atkEnd 呼叫。battle 保留到 atkRestore 才清
function attackFinish(b) {
  const nb = atkNpc(atk.npc);
  const r = b.result || { reason: 'retreat', pct: sandPct(b), tick: b.tick, stars: 0, merits: [], grade: 'defeat', lost: b.stats.lost, deployedUnits: b.stats.unitsIn };
  const snap = game.target && game.target.snap;
  let made = null, saved = null;
  if (snap) {
    made = replayMake(b, snap, { atk: idGet(), grade: r.grade, ts: Date.now(), refId: atk.npc, kind: 'npc', seed: b.seed });
    made.replay.text = atkTextLines(b, r);
    saved = replayStoreAdd(made.replay, 'atk');
  }
  const st = world.record.atk;
  if ((r.stars | 0) >= 1) st.win++;
  else st.lose++;
  st.stars += r.stars | 0;
  st.merit += (r.merits || []).length;
  if (atk.npc) world.npcBest[atk.npc] = Math.max(world.npcBest[atk.npc] | 0, r.stars | 0);
  saveWorld();
  atk.resId = saved ? saved.id : null;
  atk.resOk = !!(made && made.ok && saved && !saved.textOnly);
  atkShowResult(b, r, nb);
}

// 結算共用版型:大標題(勝/敗色;星 0 為敗)、星、評語、摧毀/損失/投入/用時、功勞、掠奪量、戰報
function battleResBody(b, r) {
  const g = GRADE_TEXT[r.grade] || { name: '—', text: '' };
  const stars = Math.max(0, Math.min(3, r.stars | 0));
  const won = stars >= 1;
  let st = '';
  for (let i = 0; i < 3; i++) st += '<span class="rst' + (i < stars ? ' lit' : '') + '" style="--d:' + i + '">★</span>';
  const merits = r.merits || [];
  let mh = '';
  ['slayer', 'siege', 'sweep'].forEach(k => {
    const m = MERIT_TEXT[k];
    mh += '<span class="rmer' + (merits.indexOf(k) >= 0 ? ' on' : '') + '"><b>' + m.name + '</b><small>' + tdEsc(m.text) + '</small></span>';
  });
  const l = r.loot || lootOf(b);
  const lines = atkTextLines(b, r).slice(1);
  let h = '<div class="rhead ' + (won ? 'win' : 'lose') + '">' + tdEsc(g.name) + '</div>';
  h += '<div class="rstars">' + st + '</div>';
  h += '<div class="rgrade"><small>' + tdEsc(g.text) + '</small></div>';
  h += '<div class="rstat"><span>摧毀 ' + Math.floor((r.pct || 0) * 100) + '%</span><span>損失 ' + (r.lost | 0) +
    ' 人</span><span>投入 ' + (r.deployedUnits | 0) + ' 人</span><span>用時 ' + sandClock(r.tick) + '</span></div>';
  h += '<div class="rmers">' + mh + '</div>';
  h += '<div class="rloot"><b>⚔ 掠奪</b>';
  for (const k in RESOURCES) h += '<span>' + RESOURCES[k].icon + ' ' + l[k].toLocaleString() + '</span>';
  h += '</div>';
  h += '<div class="rlog"><b>戰報</b>' + (lines.length ? lines.map(t => '<p>' + tdEsc(t) + '</p>').join('') : '<small>本場無關鍵事件。</small>') + '</div>';
  return h;
}

function atkShowResult(b, r, nb) {
  atk.panel.classList.remove('abar');
  let h = '<div class="shd"><b>📜 戰果・' + tdEsc(nb ? nb.name : '') + '</b><button class="close" data-atk="home">✕</button></div>';
  h += battleResBody(b, r);
  if (!atk.resOk) h += '<small class="aerr">本場錄影無法保存(僅存文字戰報)</small>';
  const playable = rpPlayable(replayFind(replayStoreLoad(), atk.resId));
  h += '<div class="sact"><button data-atk="rwatch"' + (playable ? '' : ' disabled') + '>看錄影</button>' +
    '<button data-atk="again">再戰</button><button data-atk="home">回城</button></div>';
  atk.panel.innerHTML = h;
  atk.panel.hidden = false;
  atkPlace();
}

function rpWatchFromResult() {
  const rep = replayFind(replayStoreLoad(), atk.resId);
  if (!rpPlayable(rep)) {
    showToast('本場錄影無法播放(僅存文字戰報)');
    return;
  }
  rpPlay(rep);
}

// ---- 錄影播放器:載入 snapFull(replay.snap),依 replay.cmds 在同一 tick 重跑;可從結算畫面或經營模式進入 ----
function rpPlay(rep) {
  if (!rpPlayable(rep)) return false;
  const fromResult = atk.on;
  if (battle && !fromResult) return false;
  if (!fromResult && game.mode !== 'estate' && game.mode !== 'battleDesign') return false;
  const bd = boardFromJSON(snapFull(rep.snap));
  if (!bd) {
    showToast('錄影載入失敗');
    return false;
  }
  rp.prev = fromResult ? atk.prevMode : game.mode;
  if (fromResult) {
    atk.on = false;
    atk.ended = false;
    atk.flagArm = false;
    atk.dn = null;
    atk.open = false;
    atkHideBattleUI();
    atk.panel.hidden = true;
  }
  rptClose();
  setTool(null);
  hideReset();
  boardBackup();
  atkSetBoard(bd);
  atk.prevMode = rp.prev;
  game.mode = 'replay';
  game.phase = '';
  game.target = null;
  game.sel = -1;
  game.scoutLeft = 0;
  game.simSpeed = 1;
  rp.on = true;
  rp.rep = rep;
  rp.spd = 1;
  rp.drag = false;
  rp.checked = null;
  document.body.classList.remove('atk-mode');
  document.body.classList.add('replay-mode');
  rpStart(0);
  rp.title.textContent = (rep.atk && rep.atk.name ? rep.atk.name : '攻方') + ' 攻 ' + rpNpcName(rep) +
    '・' + (rep.result && rep.result.stars ? atkStars(rep.result.stars) : '敗');
  rp.lines.innerHTML = '';
  (rep.text || []).forEach(t => rp.lines.appendChild(rpEl('p', '', t)));
  rp.slide.value = 0;
  rp.bar.hidden = false;
  atkSync();
  rpPaint();
  return true;
}

// 依 replay.cmds 建立戰鬥並快進到 tick(指令已帶 tick,於 simTick 同一 tick 套用,與 runHeadless 等價)
function rpStart(tick) {
  const rep = rp.rep;
  // 錄影的 army 為 { popCap }(人口制);舊格式陣列或缺值一律以預設上限重跑(指令已記錄,不另行解讀兵力)
  const cap = rep.army && typeof rep.army === 'object' && !Array.isArray(rep.army) && rep.army.popCap > 0 ? rep.army.popCap | 0 : TD_POP_CAP;
  const b = battleInit({
    kind: rep.kind || 'npc', seed: rep.seed, refId: rep.refId || null, map: battleMapOf(snapFull(rep.snap)), popCap: cap
  });
  b.cmds = JSON.parse(JSON.stringify(rep.cmds));
  rp.checked = null;
  battle = b;
  const want = Math.max(0, Math.min(BATTLE_TICKS, tick | 0));
  while (b.tick < want && !b.over) simTick(b);
  return b;
}

// 進度條:往後拖直接快進;往回拖從頭重建後快跑到該 tick(不繪製,由 simTick 純邏輯完成)
function rpSeek(tick) {
  if (!rp.on) return;
  const want = Math.max(0, Math.min(BATTLE_TICKS, tick | 0));
  if (battle && want >= battle.tick) {
    while (battle.tick < want && !battle.over) simTick(battle);
  } else {
    rpStart(want);
  }
  rp.drag = false;
  rpPaint();
}

function rpCheck() {
  if (!battle || !battle.over || rp.checked !== null) return;
  rp.checked = mioChecksum(battle) === rp.rep.checksum;
}

function rpSetSpeed(v) {
  game.simSpeed = v;
  if (v > 0) rp.spd = v;
  rpPaint();
}

function rpTogglePause() {
  if (game.simSpeed === 0) game.simSpeed = rp.spd || 1;
  else game.simSpeed = 0;
  rpPaint();
}

function rpPaint() {
  if (!rp.on || !battle || !rp.bar) return;
  rpCheck();
  const b = battle;
  let msg = '';
  if (b.over) msg = rp.checked === true ? '播放完畢 ・ 重播校驗一致 ✔' : (rp.checked === false ? '播放完畢 ・ 重播校驗不一致(錄影可能損毀)' : '播放完畢');
  else if (game.simSpeed === 0) msg = '已暫停';
  if (!rp.drag) {
    rp.time.textContent = sandClock(b.tick) + ' / ' + sandClock(BATTLE_TICKS);
    rp.slide.value = b.tick;
  }
  rp.msg.textContent = msg;
  rp.pause.textContent = game.simSpeed === 0 ? '▶ 續播' : '⏸ 暫停';
  rp.spdEls.forEach(s => s.el.classList.toggle('on', game.simSpeed === s.v));
}

// 關閉:回到播放前的模式(atkRestore 還原自己的棋盤與工具列)
function rpClose() {
  if (!rp.on) return;
  rp.on = false;
  rp.rep = null;
  battle = null;
  rp.bar.hidden = true;
  document.body.classList.remove('replay-mode');
  game.simSpeed = 1;
  atk.prevMode = rp.prev;
  atkRestore(false);
}

function rpBuildBar() {
  const bar = rpEl('div');
  bar.id = 'rpBar';
  bar.hidden = true;
  const head = rpEl('div', 'shd');
  rp.title = rpEl('b', '', '');
  const x = rpEl('button', 'close', '✕ 關閉');
  x.addEventListener('click', rpClose);
  head.appendChild(rp.title);
  head.appendChild(x);
  bar.appendChild(head);

  const prog = rpEl('div', 'rprog');
  rp.time = rpEl('span', 'rtime', '');
  rp.slide = document.createElement('input');
  rp.slide.type = 'range';
  rp.slide.min = 0;
  rp.slide.max = BATTLE_TICKS;
  rp.slide.step = 1;
  rp.slide.addEventListener('input', () => {
    rp.drag = true;
    rp.time.textContent = sandClock(+rp.slide.value) + ' / ' + sandClock(BATTLE_TICKS);
  });
  rp.slide.addEventListener('change', () => rpSeek(+rp.slide.value));
  prog.appendChild(rp.slide);
  prog.appendChild(rp.time);
  bar.appendChild(prog);

  const ctl = rpEl('div', 'rctl');
  rp.spdEls = RP_SPEEDS.map(v => {
    const el = rpEl('button', '', v + 'x');
    el.addEventListener('click', () => rpSetSpeed(v));
    ctl.appendChild(el);
    return { v: v, el: el };
  });
  rp.pause = rpEl('button', '', '⏸ 暫停');
  rp.pause.addEventListener('click', rpTogglePause);
  const again = rpEl('button', '', '↺ 從頭');
  again.addEventListener('click', () => rpSeek(0));
  ctl.appendChild(rp.pause);
  ctl.appendChild(again);
  bar.appendChild(ctl);

  rp.msg = rpEl('div', 'rmsg', '');
  bar.appendChild(rp.msg);
  const det = rpEl('details');
  det.appendChild(rpEl('summary', '', '文字戰報'));
  rp.lines = rpEl('div');
  det.appendChild(rp.lines);
  bar.appendChild(det);
  document.body.appendChild(bar);
  rp.bar = bar;
}

// ---- 戰報頁(頂列 📜;經營與戰鬥布置模式可開;分頁:與我相關 / 他人戰鬥 / 精采) ----
function rptCanOpen() {
  return !rp.on && !atk.on && !battle && !game.backup && (game.mode === 'estate' || game.mode === 'battleDesign');
}

function rptSync() {
  if (!rpt.btn) return;
  const can = rptCanOpen();
  rpt.btn.hidden = !can;
  if (rpt.open && !can) rptClose();
}

function rptOpen() {
  if (!rptCanOpen()) return;
  rpt.open = true;
  rpt.detail = null;
  rptRender();
}

function rptClose() {
  rpt.open = false;
  rpt.detail = null;
  if (rpt.panel) rpt.panel.hidden = true;
}

function rptPlace() {
  const tb = document.getElementById('toolbar');
  const h = document.body.classList.contains('sandbox') || !tb ? 0 : tb.offsetHeight;
  rpt.panel.style.bottom = 'calc(' + (h + 8) + 'px + env(safe-area-inset-bottom))';
}

function rptRender() {
  if (!rpt.panel) return;
  const st = replayStoreLoad();
  let h = '<div class="shd"><b>📜 戰報</b><button class="close" data-rpt="close">✕</button></div>';
  if (rpt.detail) {
    h += rptDetailHtml(st, rpt.detail);
  } else {
    h += '<div class="rtabs">' + [['mine', '與我相關'], ['others', '他人戰鬥'], ['best', '精采']].map(p =>
      '<button data-rpt="tab" data-t="' + p[0] + '"' + (rpt.tab === p[0] ? ' class="on"' : '') + '>' + p[1] + '</button>').join('') + '</div>';
    if (rpt.tab === 'mine') h += rptMineHtml(st);
    else if (rpt.tab === 'others') h += '<small>朋友對戰開放後可看他人錄影。</small>';
    else h += rptBestHtml(st);
  }
  rpt.panel.innerHTML = h;
  rpt.panel.hidden = false;
  rptPlace();
}

function rptItemHtml(rep, nameOf) {
  return '<button class="ritem" data-rpt="item" data-id="' + tdEsc(rep.id) + '"><span class="rn">' + tdEsc(nameOf) + '</span>' +
    '<span class="rs">' + atkStars(rep.result && rep.result.stars) + '</span><small>' + tdEsc(rpGradeName(rep.result && rep.result.grade)) +
    ' ・ ' + rpDateText(rep.ts) + (rpPlayable(rep) ? '' : ' ・ 僅文字') + '</small></button>';
}

function rptMineHtml(st) {
  const list = st.mine.slice().sort((p, q) => (q.ts || 0) - (p.ts || 0));
  if (!list.length) return '<small>尚無戰報。出征結算後會自動保存錄影。</small>';
  return list.map(rep => rptItemHtml(rep, (rep.side === 'def' ? '我守 ・ ' + ((rep.atk && rep.atk.name) || '對手') :
    '我攻 ・ ' + rpNpcName(rep)))).join('');
}

function rptBestHtml(st) {
  let h = '';
  [['day', '本日最精采'], ['week', '本週最精采'], ['month', '本月最精采']].forEach(k => {
    const p = st.best[k[0]];
    const rep = p ? replayFind(st, p.id) : null;
    h += '<div class="rbest"><b>' + k[1] + '</b>' +
      (rep ? rptItemHtml(rep, rpNpcName(rep)) : '<small>尚無(朋友對戰開放後補齊)</small>') + '</div>';
  });
  return h + '<small>朋友對戰開放後可看全服精采戰報。</small>';
}

function rptDetailHtml(st, id) {
  const rep = replayFind(st, id);
  if (!rep) return '<small>找不到此戰報。</small><div class="sact"><button data-rpt="back">‹ 返回</button></div>';
  const lines = (rep.text || []).map(t => '<p>' + tdEsc(t) + '</p>').join('');
  return '<div class="rgrade"><b>' + tdEsc(rep.side === 'def' ? '我守 ・ ' + ((rep.atk && rep.atk.name) || '對手') : rpNpcName(rep)) +
    '</b><small>' + atkStars(rep.result && rep.result.stars) + ' ・ ' + tdEsc(rpGradeName(rep.result && rep.result.grade)) +
    ' ・ ' + rpDateText(rep.ts) + '</small></div>' +
    '<div class="rlog">' + (lines || '<small>無文字戰報。</small>') + '</div>' +
    '<div class="sact"><button data-rpt="back">‹ 返回</button><button data-rpt="watch" data-id="' + tdEsc(rep.id) + '"' +
    (rpPlayable(rep) ? '' : ' disabled') + '>看錄影</button></div>';
}

function onRptClick(e) {
  const b = e.target.closest('button');
  if (!b) return;
  const act = b.getAttribute('data-rpt');
  if (!act) return;
  if (act === 'close') { rptClose(); return; }
  if (act === 'tab') {
    rpt.tab = b.getAttribute('data-t');
    rpt.detail = null;
  } else if (act === 'item') {
    const rep = replayFind(replayStoreLoad(), b.getAttribute('data-id'));
    if (rpPlayable(rep)) { rptClose(); rpPlay(rep); return; }
    rpt.detail = b.getAttribute('data-id');
  } else if (act === 'watch') {
    const rep = replayFind(replayStoreLoad(), b.getAttribute('data-id'));
    if (rpPlayable(rep)) { rptClose(); rpPlay(rep); return; }
    showToast('此錄影僅有文字戰報');
    return;
  } else if (act === 'back') {
    rpt.detail = null;
  }
  rptRender();
}

function initReplayUI() {
  const top = document.getElementById('topbar');
  if (!top || document.getElementById('btnReport')) return;
  const btn = document.createElement('button');
  btn.id = 'btnReport';
  btn.title = '戰報：與我相關的戰鬥錄影與文字戰報';
  btn.textContent = '📜 戰報';
  top.insertBefore(btn, document.getElementById('btnHide'));
  btn.addEventListener('click', () => {
    if (rpt.open) rptClose();
    else rptOpen();
  });
  rpt.btn = btn;

  const panel = document.createElement('div');
  panel.id = 'rptPanel';
  panel.hidden = true;
  document.body.appendChild(panel);
  panel.addEventListener('click', onRptClick);
  rpt.panel = panel;

  rpBuildBar();
  rptSync();
}


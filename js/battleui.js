// battleui.js — 戰鬥介面與戰報(PLAN_TD_MASTER §6.1)
// M1-05 沙盤推演最小版:只在 game.mode==='battleDesign' 開啟,用戰陣棋盤的副本試打。
// 不存檔、不計戰績、不產生錄影;world 在沙盤中只讀。
// 依賴:map.js(game、world、boardToJSON)、ui.js(setTool、showToast、updateResBar)、
//       render.js(screenToCell)、td.js(battleInit、issueCmd、tdApplyCmds、simTick、runToEnd)

const SAND_REASON = { time: '時間到', allDestroyed: '計分建築全毀', wiped: '兵力全滅', retreat: '鳴金' };
const POP_CAP_OPTS = [50, 100, 200, 400];
const DEPLOY_TOAST = { over: '戰鬥已結束', noUnit: '未知兵種', cell: '此處不可放兵', popcap: '人口已滿,無法再放', cap: '單位已達上限', none: '請先選擇兵種' };
// 兵種圖示(純說明用的 emoji;人口以每個單位人口表示)
const UNIT_ICON = { militia: '🧑‍🌾', hunter: '🦌', daodun: '🛡️', gongbing: '🏹', qingqi: '🐎', tuqi: '🐴', chihou: '🧭', changji: '🔱', chuangnu: '🎯', chongche: '🐏', toushi: '🪨' };
const DEFAULT_UNIT = 'daodun';

// 可放兵種(fac 為 han / both),依 UNITS 定義順序
function deployUnitKeys() {
  return Object.keys(UNITS).filter(k => tdDeployable(UNITS[k]));
}
function unitPopOf(u) {
  const d = UNITS[u];
  return d ? d.pop : 0;
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

// 人口區塊 HTML(沙盤與出征共用,貼在兵種列左側):used / cap;滿時整塊變紅,flash 為 true 時閃爍一次
function popBarHtml(used, cap, flash) {
  const full = used + 1e-9 >= cap;
  const pct = cap > 0 ? Math.min(100, Math.round(used / cap * 100)) : 0;
  return '<div class="apop' + (full ? ' full' : '') + (full && flash ? ' flash' : '') + '"><span>👥 <b>' + used + '</b> / ' + cap + '</span>' +
    (full ? '<em>人口已滿</em>' : '') + '<i><b style="width:' + pct + '%"></b></i></div>';
}

// 城市等級:出征人口上限(progPopCap);prog 未載入時維持 TD_POP_CAP
function atkPopCap() {
  return typeof progPopCap === 'function' && typeof progLv === 'function' ? progPopCap(progLv()) : TD_POP_CAP;
}

// 兵種是否已依城市等級開放(progUnlockLv('unit') 回 null 視為開放)
function atkUnitOpen(u) {
  const L = typeof progUnlockLv === 'function' ? progUnlockLv('unit', u) : null;
  return L === null || L <= (typeof progLv === 'function' ? progLv() : 1);
}

// 兵種列(一行、可橫向捲動);每格右上角為人口消耗 ×N;gated 為 true 時(出征)未開放兵種灰階、標 🔒LvN、不可點;
// popLeft 為剩餘人口,放不下的兵種灰階(仍可點,由 tdDeployWhy 給人口已滿提示)
function unitStripHtml(sel, gated, popLeft) {
  let h = '<div class="ustrip">';
  deployUnitKeys().forEach(u => {
    const d = UNITS[u];
    const lock = gated && !atkUnitOpen(u);
    const L = lock ? progUnlockLv('unit', u) : 0;
    const need = unitPopOf(u);
    const short = !lock && popLeft !== undefined && popLeft !== null && need > popLeft + 1e-9;
    const cls = (sel === u ? ' on' : '') + (short ? ' nopop' : '');
    h += '<button data-pick="' + u + '"' + (cls ? ' class="' + cls.trim() + '"' : '') + (lock ? ' disabled style="filter:grayscale(1);opacity:.45"' : '') + '><span class="uico">' + UNIT_ICON[u] +
      '</span><span class="uname">' + tdEsc(d.name) + '</span>' + (lock ? '<small>🔒 Lv' + L + '</small>' : '') +
      '<b class="upop">×' + need + '</b></button>';
  });
  return h + '</div>';
}

// 戰鬥底部列(出征與沙盤共用):左側人口區塊、中間兵種列、右側英雄技能 / 法術預留位(hidden,不占面積、無文字)
function battleBarHtml(b, sel, gated, flash) {
  const used = b ? b.popUsed : 0, cap = b ? b.popCap : atkPopCap();
  return popBarHtml(used, cap, flash) + unitStripHtml(sel, gated, cap - used) +
    '<div id="heroSkillBar" class="bslot" hidden></div><div id="spellBar" class="bslot" hidden></div>';
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
  // 點到單位(己方、敵方、守軍):無法放兵的格子顯示單位小氣泡;可部署的格子照常放兵(連續放)
  if (!u) { if (!tipUnitAt(cx, cy)) showToast(DEPLOY_TOAST.none); return; }
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

// 掠奪量:本場已摧毀敵方建築價值的 50%(僅供戰中顯示;實際資源由 atkProgReward → progOnBattle 結算)。
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
  btn.textContent = '⚔';
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
  panel.addEventListener('pointerdown', lpDown);
  panel.addEventListener('pointermove', lpMove);
  panel.addEventListener('pointerup', lpUp);
  panel.addEventListener('pointercancel', lpUp);
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
  sand.panel.style.bottom = sand.panel.classList.contains('abar') ? '' : 'calc(' + (h + 8) + 'px + env(safe-area-inset-bottom))';
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
  let h = '<div class="ahead"><div class="shd"><b>⚔ 沙盤推演</b><button class="close" data-sact="close">✕</button></div>' +
    '<div class="abtns"><button class="abig" data-sact="start">開始沙盤</button></div></div><div class="abody">' +
    '<small>設定出兵人口上限,上限內可連續放兵。不計戰績、不存檔。</small>' +
    '<div class="scap"><span>出兵人口上限</span>';
  POP_CAP_OPTS.forEach(v => {
    h += '<button data-cap="' + v + '"' + (sand.popCap === v ? ' class="on"' : '') + '>' + v + '</button>';
  });
  h += '</div></div>';
  sand.panel.classList.remove('abar');
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
  const full = b.popUsed + 1e-9 >= b.popCap;
  const flash = full && !sand.wasFull;
  sand.wasFull = full;
  const key = b.popUsed + '|' + sand.unit + '|' + flash;
  if (key === sand.key) return;
  sand.key = key;
  sand.panel.classList.add('abar');
  sand.panel.style.bottom = '';
  barSetHtml(sand.panel, battleBarHtml(b, sand.unit, false, flash));
}

// 沙盤狀態寫入 atkHud(左上角小字):剩餘時間、摧毀率;立即結束計算中顯示進度
function sandHud() {
  if (!battle || !atk.hud) return;
  atk.hud.hidden = false;
  atk.hudClock.textContent = '剩 ' + sandClock(battle.limitTick - battle.tick);
  atk.hudSub.textContent = fastHudText() || ('摧毀 ' + Math.floor(sandPct(battle) * 100) + '%' + (game.simSpeed === 0 ? ' ・ 已暫停' : ''));
}

function onSandClick(e) {
  if (lpSuppress) { lpSuppress = false; return; }
  const b = e.target.closest('button');
  if (!b) return;
  if (b.getAttribute('data-bdex') !== null) { if (typeof unitDexOpen === 'function') unitDexOpen(); return; }
  const cap =b.getAttribute('data-cap'), pick = b.getAttribute('data-pick');
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
  const hd = holdPeek(e);
  const d = sand.dn;
  sand.dn = null;
  if (atk.on || rp.on) return;
  if (!battle || battle.over || !d || d.id !== e.pointerId) return;
  if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 8) return;
  if (tipIsOpen()) { tipHide(); return; }
  const c = screenToCell(e.clientX, e.clientY);
  if (!c) return;
  if (world.occ[idx(c.x, c.y)] > 0) { atkInfo(c.x, c.y); return; }
  if (hd) { holdFailTip(hd, c); sandRenderBattle(); sandHud(); return; }
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
  if (sand.panel) { sand.panel.hidden = true; sand.panel.classList.remove('abar'); }
  if (atk.hud) atk.hud.hidden = true;
  atk.fast = null;
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
  h = '<div class="ahead">' + h.replace('<small>不計戰績、不存檔</small>', '') + '<div class="abtns"><button class="abig" data-atk="sagain">再試一次</button><button data-atk="sdesign">回設計</button></div></div><div class="abody">' + battleResBody(b, r) + '</div>';
  atk.panel.innerHTML = h;
  atk.panel.hidden = false;
  atkPlace();
}

// 每幀由 main.js 呼叫:同步按鈕、處理新事件、偵測結束、更新面板
function battleUiTick(dt) {
  tipTick(dt);
  holdTick(dt);
  lpTick(dt);
  fastStep();
  lootSync();
  sandSyncButton();
  atkTick(dt);
  atkCtlPaint();
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
  npc: null,          // 選取的 NPC 據點 id(打玩家陣地時為 'pool:'+陣地 id)
  ghost: null,        // 目前抽中的玩家陣地(poolDraw 描述),view 'pool' 預覽用
  ghostNb: null,      // 出征中的玩家陣地對手(atkGhostNb),供 atkNpc('pool:…') 取回
  unit: DEFAULT_UNIT, // 選中的兵種,點地圖放一隊
  prevMode: 'estate', // 進攻前的 game.mode
  flagArm: false,     // 令旗待選建築
  ended: false,       // 已呼叫過結束流程
  sub: '', subLeft: 0,
  dn: null, lastHtml: '',
  btn: null, panel: null, hud: null, hudClock: null, hudSub: null, hudPop: null, popHtml: '',
  ctl: null, ctlKey: '', pauseMark: null,  // 進軍期控制列(離開/暫停/速度)與「已暫停」字樣
  spd: 1,             // 最近一次的非暫停速度(繼續時套用)
  leaveAsk: false,    // (已不用,保留欄位)
  fast: null,         // 立即結束:{b, spd, pct} 背景分段計算中
  wasFull: false      // 上一幀人口是否已滿(閃爍一次用)
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

function atkNpc(id) {
  if (atk.ghostNb && atk.ghostNb.id === id) return atk.ghostNb;
  return NPC_BASES.find(v => v.id === id) || null;
}
// 玩家陣地對手(類 NPC_BASES 條目,ghost:true):名稱為「假玩家名・陣地名」
function atkGhostNb(g) {
  return { id: 'pool:' + g.id, name: g.lord + '的陣地', diff: g.diff + 1, ghost: true, g: g };
}
// 首領營的升級里程碑(progdata PROG_BOSS_REQ:哪一級要求該營 1★);非首領營回 0
function atkBossMilestone(id) {
  let L = 0;
  if (typeof PROG_BOSS_REQ !== 'undefined') Object.keys(PROG_BOSS_REQ).forEach(k => { if (PROG_BOSS_REQ[k] === id) L = +k; });
  return L;
}
function atkCanOpen() {
  return !atk.on && !battle && !game.backup && (game.mode === 'estate' || game.mode === 'battleDesign');
}

function initAttackUI() {
  const top = document.getElementById('topbar');
  if (!top || document.getElementById('btnAttack')) return;
  const btn = document.createElement('button');
  btn.id = 'btnAttack';
  btn.className = 'corner corner-atk';
  btn.title = '出征：隨機戰鬥、野營副本、戰報';
  btn.textContent = '⚔ 出征';
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
  panel.addEventListener('pointerdown', lpDown);
  panel.addEventListener('pointermove', lpMove);
  panel.addEventListener('pointerup', lpUp);
  panel.addEventListener('pointercancel', lpUp);
  atk.panel = panel;

  const hud = document.createElement('div');
  hud.id = 'atkHud';
  hud.hidden = true;
  atk.hudClock = document.createElement('b');
  atk.hudSub = document.createElement('span');
  hud.appendChild(atk.hudClock);
  hud.appendChild(atk.hudSub);
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
  canvas.addEventListener('pointerdown', holdDown);
  canvas.addEventListener('pointermove', holdMove);
  canvas.addEventListener('touchstart', battleTouchBlock, { passive: false });
  canvas.addEventListener('touchmove', battleTouchBlock, { passive: false });
  canvas.addEventListener('pointerup', atkTap);
  canvas.addEventListener('pointerup', holdEnd);
  canvas.addEventListener('pointercancel', e => { atk.dn = null; holdEnd(e); });

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
  atk.panel.style.bottom = atk.panel.classList.contains('abar') ? '' : 'calc(' + (h + 8) + 'px + env(safe-area-inset-bottom))';
}

function atkOpenList() {
  if (!atkCanOpen()) return;
  atk.open = true;
  atk.view = 'list';
  atkRenderSetup();
}

// 🎲 隨機戰鬥:抽一個玩家陣地顯示對手預覽(keep = 沿用目前抽中的,例如結算後再戰)
function atkOpenPool(keep) {
  if (!atkCanOpen()) return;
  if (typeof poolDraw !== 'function') { atkOpenList(); return; }
  if (!keep || !atk.ghost) atk.ghost = poolDraw(hashStr('pool:' + Date.now() + ':' + Math.random()), progLv(), null);
  atk.open = true;
  atk.view = 'pool';
  atkRenderSetup();
}

function atkPoolReroll() {
  atk.ghost = poolDraw(hashStr('pool:' + Date.now() + ':' + Math.random()), progLv(), atk.ghost ? atk.ghost.id : null);
}

function atkPoolHtml() {
  const g = atk.ghost;
  let h = '<div class="ahead"><div class="shd"><b>🎲 隨機戰鬥</b><button class="close" data-atk="close">✕</button></div>' +
    '<div class="abtns"><button class="abig" data-atk="poolgo"' + (g ? '' : ' disabled') + '>⚔ 出征</button><button data-atk="reroll">🎲 換一個</button></div></div>';
  h += '<div class="abody">';
  if (g) {
    const st = g.stats;
    h += '<div class="apool"><b>' + tdEsc(g.lord) + '</b><span>' + tdEsc(g.name) + ' ・ 約 Lv' + g.T + '</span></div>';
    h += '<small>難度 ' + ATK_DIFF[g.diff + 1] + ' ・ 物件 ' + st.objs + ' ・ 牆 ' + st.walls + ' ・ 塔 ' + st.towers + '</small><br>';
    h += g.practice ? '<small class="bhint">這是你自己的陣地:只當練習,資源與經驗 ×' + PROG_REWARD.practiceMul + '。</small><br>' : '<small>勝利可得資源與經驗;打玩家不掉材料。</small><br>';
    h += '<div class="apopcap">出征人口上限 <b>' + atkPopCap() + '</b></div>';
  }
  h += '<small>陷阱不顯示,進場後有觀察期。換一個不限次數。</small></div>';
  return h;
}

function atkOpenMuster() {
  atk.open = true;
  atk.view = 'muster';
  atkRenderSetup();
}

function atkMusterHtml() {
  const nb = atkNpc(atk.npc);
  const best = nb && world.npcBest ? (world.npcBest[nb.id] | 0) : 0;
  let h = '<div class="ahead"><div class="shd"><b>出征・' + tdEsc(nb ? nb.name : '') + '</b><button class="close" data-atk="close">✕</button></div>' +
    '<div class="abtns"><button class="abig" data-atk="go"' + (nb ? '' : ' disabled') + '>⚔ 出征</button><button data-atk="back">放棄</button><button data-bdex="1">兵種說明</button></div></div>';
  h += '<div class="abody">';
  h += '<small>難度 ' + (nb ? ATK_DIFF[nb.diff] : '—') + ' ・ 最佳 ' + atkStars(best) + '</small>';
  h += '<div class="apopcap">出征人口上限 <b>' + atkPopCap() + '</b></div>';
  h += '<small>可帶兵種(每次放 1 個單位;🔒 為城市等級未開放;長按兵種可看說明)</small><div class="ulist">';
  deployUnitKeys().forEach(u => {
    const lock = !atkUnitOpen(u);
    h += '<div class="urow"' + (lock ? ' style="filter:grayscale(1);opacity:.45"' : '') + '><span class="uico">' + UNIT_ICON[u] + '</span><span class="uname">' + tdEsc(UNITS[u].name) +
      '</span><small>' + (lock ? '🔒 Lv' + progUnlockLv('unit', u) : '人口 ' + unitPopOf(u)) + '</small></div>';
  });
  h += '</div></div>';
  return h;
}

function onAtkClick(e) {
  if (lpSuppress) { lpSuppress = false; return; }
  const b = e.target.closest('button');
  if (!b) return;
  if (b.getAttribute('data-bdex') !== null) { if (typeof unitDexOpen === 'function') unitDexOpen(); return; }
  const pick =b.getAttribute('data-pick');
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
  } else if (act === 'reroll') {
    atkPoolReroll();
    atkRenderSetup();
    return;
  } else if (act === 'poolgo') {
    if (atk.ghost) atkLaunch(atkGhostNb(atk.ghost));
    return;
  } else if (act === 'go') {
    atkGo();
  } else if (act === 'rwatch') {
    rpWatchFromResult();
  } else if (act === 'again') {
    const wasGhost = !!(atk.ghostNb && atk.npc === atk.ghostNb.id);
    atkRestore(false);
    if (wasGhost) atkOpenPool(true);
    else atkOpenMuster();
  } else if (act === 'home') {
    atkRestore(false);
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
  atk.panel.innerHTML = atk.view === 'muster' ? atkMusterHtml() : atk.view === 'pool' ? atkPoolHtml() : atkListHtml();
  atk.panel.hidden = false;
  atkPlace();
}

function atkListHtml() {
  let h = '<div class="ahead"><div class="shd"><b>⚔ 出征</b><button class="close" data-atk="close">✕</button></div>' +
    '<small>選擇要攻打的 NPC 據點。整軍後進攻,觀察期不耗兵。</small></div><div class="abody">';
  NPC_BASES.forEach(nb => {
    const best = world.npcBest ? (world.npcBest[nb.id] | 0) : 0;
    const ms = atkBossMilestone(nb.id);
    const pb = typeof progGet === 'function' ? (progGet().bossBest[nb.id] | 0) : 0;
    const gate = ms ? '<small class="bhint">升 Lv' + (ms + 1) + ' 需本營 1★ ・ 城主最佳 ' + atkStars(pb) + '</small>' : '';
    h += '<div class="arow"><div class="arowtop"><b>' + tdEsc(nb.name) + '</b><button data-atk="pick" data-npc="' + tdEsc(nb.id) + '">選擇</button></div>' +
      '<div class="ainfo"><small>難度 ' + ATK_DIFF[nb.diff] + '　最佳 ' + atkStars(best) + '</small><small>' + tdEsc(nb.intro) + '</small>' + gate + '</div></div>';
  });
  return h + '</div>';
}

// 進攻:boardBackup → 載入斥候視野 → 觀察期(180 秒)
function atkLaunch(nb) {
  if (!atkCanOpen()) return;
  const prevMode = game.mode;
  setTool(null);
  hideReset();
  boardBackup();
  game.mode = 'attack';
  const bj = nb.ghost ? poolLoadIntoWorld(nb.g.entry) : npcLoadIntoWorld(nb.id);
  const snap = bj ? snapSplit(bj, { pid: nb.ghost ? 'ghost:' + nb.g.id : 'npc:' + nb.id, name: nb.name }) : null;
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
  atk.ghostNb = nb.ghost ? nb : null;
  atk.on = true;
  atk.open = false;
  atk.ended = false;
  atk.flagArm = false;
  atk.wasFull = false;
  atk.fast = null;
  atk.unit = atkUnitOpen(atk.unit) ? atk.unit : DEFAULT_UNIT;
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
  game.target = { kind: nb.ghost ? 'ghost' : 'npc', refId: nb.id, snap: snap };
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
  if (!UNITS[u] || !tdDeployable(UNITS[u]) || !atkUnitOpen(u)) return;
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
  const b = battleInit({ kind: atk.ghostNb && atk.npc === atk.ghostNb.id ? 'ghost' : 'npc', seed: hashStr(snap.snapHash + ':' + Date.now()) >>> 0, map: battleMapOf(snapFull(snap)), refId: atk.npc, popCap: atkPopCap() });
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

// 小標籤:縮成左上角小半透明字(位置由 CSS 固定,不跟隨物件);選取圈仍貼在物件上;同一時間只一個;3 秒後淡出(tipTick)
function tipShow(text, gx, gy, bld) {
  if (!tip.el) return;
  tipHide();
  const p = atkScreenOf(gx, gy);
  tip.el.textContent = text;
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
  const base = typeof unitBubbleText === 'function' ? unitBubbleText(best.u) : (UNITS[best.u] ? UNITS[best.u].name : String(best.u));
  tipShow(base + ' ・ HP ' + Math.ceil(best.hp) + '/' + Math.ceil(best.maxHp), best.x, best.y, -1);
  return true;
}

// 點擊(移動小於 8px)地圖:觀察期點可部署格即開戰;進軍期點建築/單位顯示小標籤,點空地放兵。
// 小標籤開啟時,任何一次點擊先只關閉小標籤(不放兵、不開新標籤)
// 重繪兵種列時保留橫向捲動位置(切換兵種不跳回最左)
function barSetHtml(panel, html) {
  const old = typeof panel.querySelector === 'function' ? panel.querySelector('.ustrip') : null;
  const x = old ? old.scrollLeft : 0;
  panel.innerHTML = html;
  const ns = typeof panel.querySelector === 'function' ? panel.querySelector('.ustrip') : null;
  if (ns) ns.scrollLeft = x;
}

// ---- 兵種長按說明:按住約 450ms(位移 < 10px)在兵種列正上方顯示小氣泡,放開即消失;長按不改選取、不放兵;短按永遠是切換
const LP_MS = 450, LP_MOVE = 10;
let lpSt = null, lpSuppress = false, lpEl = null;
function lpDown(e) {
  lpSuppress = false;
  const btn = e.target && typeof e.target.closest === 'function' ? e.target.closest('[data-pick]') : null;
  if (!btn) { lpSt = null; return; }
  lpSt = { id: e.pointerId, sx: e.clientX, sy: e.clientY, unit: btn.getAttribute('data-pick'), t: 0, shown: false };
}
function lpMove(e) {
  if (!lpSt || lpSt.id !== e.pointerId) return;
  if (Math.hypot(e.clientX - lpSt.sx, e.clientY - lpSt.sy) >= LP_MOVE) { lpHide(); lpSt = null; }
}
function lpUp(e) {
  if (!lpSt || lpSt.id !== e.pointerId) return;
  if (lpSt.shown) { lpSuppress = true; lpHide(); }
  lpSt = null;
}
function lpTick(dt) {
  if (!lpSt || lpSt.shown) return;
  lpSt.t += dt * 1000;
  if (lpSt.t >= LP_MS) { lpSt.shown = true; lpShow(lpSt.unit); }
}
function lpHide() { if (lpEl) lpEl.hidden = true; }
function lpShow(u) {
  if (!lpEl) {
    lpEl = document.createElement('div');
    lpEl.id = 'unitHold';
    lpEl.hidden = true;
    document.body.appendChild(lpEl);
  }
  const I = typeof unitInfo === 'function' ? unitInfo(u) : null;
  const d = UNITS[u] || {};
  const lines = I
    ? [I.name + ' ・ ' + I.nick, I.role + ' ・ 人口 ' + unitPopOf(u), '兵力 ' + d.hp + '　攻 ' + d.atk + '　防 ' + d.def + '　射程 ' + d.range + '　移速 ' + d.spd, '目標:' + String(I.prefText || '')]
    : [String(d.name || u)];
  lpEl.innerHTML = lines.slice(0, 4).map(t => '<div>' + tdEsc(t) + '</div>').join('');
  const pn = atk.on ? atk.panel : sand.panel;
  const top = pn && typeof pn.getBoundingClientRect === 'function' ? pn.getBoundingClientRect().top : 0;
  lpEl.style.bottom = Math.max(0, (window.innerHeight || 0) - top + 6) + 'px';
  lpEl.hidden = false;
}

// ---- 按住連續放兵:按下即放 1 個;按住超過 250ms 且位移 < 12px 時每 140ms 在同格再放 1 個(該格不可放 / 已佔位 / 人口滿則跳過,人口滿 toast 一次並停止);
// 位移 ≥ 12px 為拖曳,沿路經過的每個新可部署格各放 1 個;放開即停。每次放兵都是一個 deploy 命令(確定性,錄影 checksum 不變)
const HOLD_FIRST_MS = 250, HOLD_EVERY_MS = 140, HOLD_DRAG_PX = 12;
let holdSt = null;
function holdLive() {
  return !!battle && !battle.over && game.mode === 'attack' && game.phase === 'march' && (atk.on || battle.kind === 'sandbox');
}
function battleActive() { return atk.on || (!!battle && !battle.over); }
function battleTouchBlock(e) { if (battleActive()) e.preventDefault(); }
function holdPeek(e) { return holdSt && holdSt.id === e.pointerId ? holdSt : null; }
function holdEnd(e) { if (holdSt && holdSt.id === e.pointerId) holdSt = null; }
function holdRepaint() { if (atk.on) atkPaint(); else { sandRenderBattle(); sandHud(); } }
// 在 (cx,cy) 放 1 個;回傳 true 或原因字串(與 tdDeployWhy 相同)
function holdTry(cx, cy) {
  const u = uiPickedUnit();
  if (!battle || !u) return 'noUnit';
  const why = tdDeployWhy(battle, u, cx, cy);
  if (why === true) uiDeploy(battle, u, cx, cy);
  return why;
}
// 人口滿:toast 一次並停止本次按住
function holdApply(h, why) {
  if (why === true) h.fired = true;
  else if (why === 'popcap' && !h.stopped) { h.stopped = true; showToast(DEPLOY_TOAST.popcap); }
}
// 按下即失敗、放開時仍未放成:單位格顯示單位小標籤,否則 toast 原因
function holdFailTip(h, c) {
  if (h.fired || h.drag) return;
  if (!tipUnitAt(c.x, c.y)) showToast(DEPLOY_TOAST[h.why] || '無法放兵');
}
function holdDown(e) {
  holdSt = null;
  if (!holdLive() || tipIsOpen()) return;
  const c = screenToCell(e.clientX, e.clientY);
  if (!c || world.occ[idx(c.x, c.y)] > 0) return;
  const h = { id: e.pointerId, sx: e.clientX, sy: e.clientY, lx: e.clientX, ly: e.clientY, cx: c.x, cy: c.y, held: 0, acc: 0, drag: false, fired: false, stopped: false, why: null };
  holdSt = h;
  const why = holdTry(c.x, c.y);
  h.why = why;
  if (why === true) h.fired = true;
  else if (why === 'popcap') h.stopped = true;
  holdRepaint();
}
function holdMove(e) {
  const h = holdSt;
  if (!h || h.id !== e.pointerId || !holdLive()) return;
  if (!h.drag) {
    if (Math.hypot(e.clientX - h.sx, e.clientY - h.sy) < HOLD_DRAG_PX) return;
    h.drag = true;
  }
  const dx = e.clientX - h.lx, dy = e.clientY - h.ly;
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 3));
  for (let k = 1; k <= steps && !h.stopped; k++) {
    const c = screenToCell(h.lx + dx * k / steps, h.ly + dy * k / steps);
    if (!c || (c.x === h.cx && c.y === h.cy)) continue;
    h.cx = c.x; h.cy = c.y;
    holdApply(h, holdTry(c.x, c.y));
  }
  h.lx = e.clientX; h.ly = e.clientY;
  holdRepaint();
}
function holdTick(dt) {
  const h = holdSt;
  if (!h || h.drag || h.stopped || !holdLive()) return;
  h.held += dt * 1000;
  if (h.held < HOLD_FIRST_MS) return;
  h.acc += dt * 1000;
  let n = 0;
  while (h.acc >= HOLD_EVERY_MS && n < 3 && !h.stopped) {
    h.acc -= HOLD_EVERY_MS; n++;
    holdApply(h, holdTry(h.cx, h.cy));
  }
  if (n) holdRepaint();
}

// 點擊(移動小於 8px)地圖:觀察期點可部署格即放第一隊開戰;進軍期點建築顯示小標籤,點空地或已有單位的可部署格放一隊(連續放),
// 小標籤開啟時,任何一次點擊先只關閉小標籤(不放兵、不開新標籤)
function atkTap(e) {
  const hd = holdPeek(e);
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
  if (n >= 0) { atkInfo(c.x, c.y); return; }
  if (hd) { holdFailTip(hd, c); atkPaint(); return; }
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

// ---- 立即結束:不再下任何命令,由同一套確定性 simTick 在背景分段算完(每幀限時),結束後照常結算 ----
const FAST_SLICE_MS = 24;
// 戰鬥進行中(進軍期、未結束):出征或沙盤
function fastLive() {
  if (!battle || battle.over || game.mode !== 'attack' || game.phase !== 'march') return false;
  return atk.on || battle.kind === 'sandbox';
}
function fastHudText() { return atk.fast ? '計算中… ' + atk.fast.pct + '%' : ''; }
function fastStart() {
  if (atk.fast || !fastLive()) return;
  atk.fast = { b: battle, spd: game.simSpeed === 0 ? (atk.spd || 1) : game.simSpeed, pct: 0 };
  battle.acc = 0;
  game.simSpeed = 0;
  atkSetSub('', 0);
  atkCtlPaint();
}
// 取消:回到原速度繼續戰鬥(已算過的 tick 等同於無命令的時間流逝,錄影仍一致)
function fastCancel() {
  const f = atk.fast;
  if (!f) return;
  atk.fast = null;
  game.simSpeed = f.spd;
  atk.spd = f.spd;
}
// 每幀由 battleUiTick 呼叫:限時跑 simTick;戰鬥結束後由既有流程(atkTick → atkEnd / battleUiTick → sandFinish)結算
function fastStep() {
  const f = atk.fast;
  if (!f) return;
  const b = f.b;
  if (battle !== b) { atk.fast = null; return; }
  if (b.over) { atk.fast = null; game.simSpeed = f.spd; return; }
  const t0 = Date.now();
  while (!b.over && b.tick < b.limitTick && Date.now() - t0 < FAST_SLICE_MS) simTick(b);
  f.pct = Math.min(100, Math.floor(b.tick / b.limitTick * 100));
  if (b.over) { atk.fast = null; game.simSpeed = f.spd; }
}

// 進軍期控制列(右上角一排,貼邊):觀察期為「🚪 放棄」(不計次數、不給獎勵);進軍期為 ⏸ / 1x 2x 4x / ⏭ 立即結束;計算中為進度與取消
function atkCtlPaint() {
  if (!atk.ctl) return;
  const scout = atk.on && game.phase === 'scout';
  const live = (atk.on && game.phase === 'march' && !!battle && !battle.over) || (!atk.on && fastLive());
  const on = scout || live;
  atk.ctl.hidden = !on;
  if (atk.pauseMark) atk.pauseMark.hidden = true;
  if (!on) return;
  let key, h;
  if (scout) {
    key = 'scout';
    h = '<button data-ctl="abandon">🚪 放棄</button>';
  } else if (atk.fast) {
    key = 'fast' + atk.fast.pct;
    h = '<span class="cq">計算中… ' + atk.fast.pct + '%</span><i class="fbar"><b style="width:' + atk.fast.pct + '%"></b></i>' +
      '<button data-ctl="fastCancel">取消</button>';
  } else {
    const paused = game.simSpeed === 0;
    key = 'live' + (paused ? 'P' : 'R') + atk.spd;
    h = '<button data-ctl="pause">' + (paused ? '▶' : '⏸') + '</button>';
    [1, 2, 4].forEach(v => {
      h += '<button data-ctl="spd" data-s="' + v + '"' + (atk.spd === v ? ' class="on"' : '') + '>' + v + 'x</button>';
    });
    h += '<button data-ctl="fast">⏭</button>';
  }
  if (key === atk.ctlKey) return;
  atk.ctlKey = key;
  atk.ctl.innerHTML = h;
}

function onCtlClick(e) {
  const b = e.target.closest('button');
  if (!b) return;
  const act = b.getAttribute('data-ctl');
  if (act === 'abandon') atkRetreat();
  else if (act === 'fast') fastStart();
  else if (act === 'fastCancel') fastCancel();
  else if (act === 'pause') atkTogglePause();
  else if (act === 'spd') atkSetSpeed(+b.getAttribute('data-s'));
  atkCtlPaint();
}

// 底部列只留人口區 + 兵種列(+ 預留位);觀察期與進軍期共用
function atkBattleHtml(flash) {
  const scout = game.phase === 'scout';
  return battleBarHtml(scout ? null : battle, atk.unit, true, flash);
}

// 每幀更新 HUD 與戰鬥面板(面板只在內容變動時重繪);人口由未滿變滿時閃爍一次
function atkPaint() {
  if (!atk.on || game.phase === 'result' || !atk.hud) return;
  const scout = game.phase === 'scout';
  atk.hud.hidden = false;
  atk.panel.hidden = false;
  atk.panel.classList.add('abar');
  atk.panel.style.bottom = '';
  atk.hudClock.textContent = scout ? '斥候 ' + atkFmt(game.scoutLeft) : (battle ? '進軍 ' + atkFmt((battle.limitTick - battle.tick) * SIM_DT) : '');
  atk.hudSub.textContent = fastHudText() || (atk.subLeft > 0 ? atk.sub : (scout ? '點可部署區放下第一個單位即開戰' : (game.simSpeed === 0 ? '已暫停' : '')));
  const full = !!battle && battle.popUsed + 1e-9 >= battle.popCap;
  const flash = full && !atk.wasFull;
  atk.wasFull = full;
  const html = atkBattleHtml(flash);
  if (html !== atk.lastHtml) {
    atk.lastHtml = html;
    barSetHtml(atk.panel, html);
  }
  atkCtlPaint();
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
  atk.fast = null;
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
    const unitName = d.unit ? ((UNITS[d.unit] || {}).name || d.unit) : '一個單位';
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
    made = replayMake(b, snap, { atk: idGet(), grade: r.grade, ts: Date.now(), refId: atk.npc, kind: nb && nb.ghost ? 'ghost' : 'npc', seed: b.seed });
    made.replay.text = atkTextLines(b, r);
    saved = replayStoreAdd(made.replay, 'atk');
  }
  const st = world.record.atk;
  if ((r.stars | 0) >= 1) st.win++;
  else st.lose++;
  st.stars += r.stars | 0;
  st.merit += (r.merits || []).length;
  if (atk.npc && !(nb && nb.ghost)) world.npcBest[atk.npc] = Math.max(world.npcBest[atk.npc] | 0, r.stars | 0);
  const reward = atkProgReward(b, r, nb);
  saveWorld();
  atk.resId = saved ? saved.id : null;
  atk.resOk = !!(made && made.ok && saved && !saved.textOnly);
  atkShowResult(b, r, nb, reward);
}

// 城市等級結算(PLAN_PROGRESSION §3.3):經驗、資源、材料由 progOnBattle 寫入 prog 與 world.res。
// world.res 不在 BOARD_KEYS 內(攻擊中棋盤換成敵方,資源仍是己方),故不必等棋盤還原再記。
// 沙盤、錄影、觀察期撤退都不經過這裡,不計獎勵。
function atkProgReward(b, r, nb) {
  if (!nb || typeof progOnBattle !== 'function' || typeof progCanUpgrade !== 'function') return null;
  if (nb.ghost) {
    const g = nb.g, wasUpG = progCanUpgrade().ok;
    const outG = progOnBattle({
      kind: 'ghost', T: g.T, stars: r.stars | 0, pct: r.pct || 0, grade: r.grade, diff: Math.max(0, Math.min(PROG_DIFF_MAX, g.diff)),
      seed: b.seed, pid: 'ghost:' + g.id, practice: g.practice
    });
    if ((r.stars | 0) >= 1 && !g.practice) atkFtueWin('ghostWin1');
    return { out: outG, up: !wasUpG && progCanUpgrade().ok, ghost: true, practice: g.practice };
  }
  const bd = typeof progBossDef === 'function' ? progBossDef(nb.id) : null;
  const wasUp = progCanUpgrade().ok;
  const out = progOnBattle({
    kind: bd ? 'boss' : 'npc', T: bd ? bd.lv : progLv(), stars: r.stars | 0, pct: r.pct || 0, grade: r.grade,
    diff: Math.max(0, Math.min(PROG_DIFF_MAX, (nb.diff | 0) - 1)), seed: b.seed, pid: 'npc:' + nb.id,
    id: nb.id, fac: bd ? bd.fac : ''
  });
  if ((r.stars | 0) >= 1) atkFtueWin('npcWin1');
  return { out: out, up: !wasUp && progCanUpgrade().ok };
}

// 新手教學:首次達成條件時寫入 ftue.done 並刷新泡泡(progFtueShow 只顯示當前級的步驟)
function atkFtueWin(id) {
  if (typeof progGet !== 'function' || typeof progSave !== 'function') return;
  const p = progGet();
  if (p.ftue.done[id]) return;
  p.ftue.done[id] = true;
  progSave();
  if (typeof progFtueShow === 'function' && typeof progFtueTick === 'function') progFtueShow(progFtueTick());
}

// 結算獎勵一行:經驗 / 資源 / 材料;可升級時加提示(只是提示,升級在 Lv 晶片)
function atkRewardHtml(rw) {
  const o = rw.out;
  const rs = [], ms = [];
  for (const k in o.res) if (o.res[k] > 0) rs.push(((RESOURCES[k] || {}).icon || k) + '+' + o.res[k].toLocaleString());
  for (const id in o.mats) if (o.mats[id] > 0 && PROG_MATS[id]) ms.push(PROG_MATS[id].icon + PROG_MATS[id].name + '×' + o.mats[id]);
  let h = '<div class="rloot rprog"><b>' + (rw.ghost ? (rw.practice ? '練習獲得(×' + PROG_REWARD.practiceMul + ')' : '打玩家獲得') : '獲得') + '</b><span>經驗 +' + o.xp + '</span>';
  if (rs.length) h += '<span>資源 ' + rs.join(' ') + '</span>';
  if (ms.length) h += '<span>材料 ' + tdEsc(ms.join('、')) + '</span>';
  h += '</div>';
  if (rw.up) h += '<div class="rprog"><small>城市可升級了!(點頂列 Lv 晶片升級)</small></div>';
  return h;
}

// 結算共用版型:大標題(勝/敗色;星 0 為敗)、星、評語、摧毀/損失/投入/用時、功勞、掠奪量、戰報
function battleResBody(b, r, reward) {
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
  const lines = atkTextLines(b, r).slice(1);
  let h = '<div class="rhead ' + (won ? 'win' : 'lose') + '">' + tdEsc(g.name) + '</div>';
  h += '<div class="rstars">' + st + '</div>';
  h += '<div class="rgrade"><small>' + tdEsc(g.text) + '</small></div>';
  h += '<div class="rstat"><span>摧毀 ' + Math.floor((r.pct || 0) * 100) + '%</span><span>損失 ' + (r.lost | 0) +
    ' 人</span><span>投入 ' + (r.deployedUnits | 0) + ' 人</span><span>用時 ' + sandClock(r.tick) + '</span></div>';
  h += '<div class="rmers">' + mh + '</div>';
  if (reward) {
    h += atkRewardHtml(reward);
  } else {
    // 沙盤:掠奪量只顯示,不結算
    const l = r.loot || lootOf(b);
    h += '<div class="rloot"><b>⚔ 掠奪</b>';
    for (const k in RESOURCES) h += '<span>' + RESOURCES[k].icon + ' ' + l[k].toLocaleString() + '</span>';
    h += '</div>';
  }
  h += '<div class="rlog"><b>戰報</b>' + (lines.length ? lines.map(t => '<p>' + tdEsc(t) + '</p>').join('') : '<small>本場無關鍵事件。</small>') + '</div>';
  return h;
}

function atkShowResult(b, r, nb, reward) {
  atk.panel.classList.remove('abar');
  const playable = rpPlayable(replayFind(replayStoreLoad(), atk.resId));
  let h = '<div class="ahead"><div class="shd"><b>📜 戰果・' + tdEsc(nb ? nb.name : '') + '</b><button class="close" data-atk="home">✕</button></div>' +
    '<div class="abtns"><button class="abig" data-atk="again">再戰</button><button data-atk="rwatch"' + (playable ? '' : ' disabled') + '>看錄影</button><button data-atk="home">回城</button></div></div>';
  h += '<div class="abody">' + battleResBody(b, r, reward);
  if (!atk.resOk) h += '<small class="aerr">本場錄影無法保存(僅存文字戰報)</small>';
  if (replayIsOldVer(replayFind(replayStoreLoad(), atk.resId))) h += '<small class="aerr">' + REPLAY_OLD_TEXT + '</small>';
  h += '</div>';
  atk.panel.innerHTML = h;
  atk.panel.hidden = false;
  atkPlace();
}

function rpWatchFromResult() {
  const rep = replayFind(replayStoreLoad(), atk.resId);
  if (!rpPlayable(rep)) {
    showToast(replayIsOldVer(rep) ? REPLAY_OLD_TEXT : '本場錄影無法播放(僅存文字戰報)');
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

// ---- 戰報頁(左下 ⚔ 戰鬥選單的「📜 戰報／錄影」;經營與戰鬥布置模式可開;分頁:與我相關 / 他人戰鬥 / 精采) ----
function rptCanOpen() {
  return !rp.on && !atk.on && !battle && !game.backup && (game.mode === 'estate' || game.mode === 'battleDesign');
}

function rptSync() {
  if (rpt.open && !rptCanOpen()) rptClose();
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
    ' ・ ' + rpDateText(rep.ts) + (rpPlayable(rep) ? '' : (replayIsOldVer(rep) ? ' ・ 舊版' : ' ・ 僅文字')) + '</small></button>';
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
    (replayIsOldVer(rep) ? '<small class="aerr">' + REPLAY_OLD_TEXT + '</small>' : '') +
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
    showToast(replayIsOldVer(rep) ? REPLAY_OLD_TEXT : '此錄影僅有文字戰報');
    return;
  } else if (act === 'back') {
    rpt.detail = null;
  }
  rptRender();
}

function initReplayUI() {
  if (document.getElementById('rptPanel')) return;
  const panel = document.createElement('div');
  panel.id = 'rptPanel';
  panel.hidden = true;
  document.body.appendChild(panel);
  panel.addEventListener('click', onRptClick);
  rpt.panel = panel;

  rpBuildBar();
  rptSync();
}


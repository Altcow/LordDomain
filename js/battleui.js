// battleui.js — 戰鬥介面與戰報(PLAN_TD_MASTER §6.1)
// M1-05 沙盤推演最小版:只在 game.mode==='battleDesign' 開啟,用戰陣棋盤的副本試打。
// 不存檔、不計戰績、不產生錄影;world 在沙盤中只讀。
// 依賴:map.js(game、world、boardToJSON)、ui.js(setTool、showToast、updateResBar)、
//       render.js(screenToCell)、td.js(battleInit、issueCmd、tdApplyCmds、simTick、runToEnd)

const SAND_CARDS = ['daodun', 'gongbing', 'qingqi'];
const SAND_MAX = 10;
const SAND_REASON = { time: '時間到', allDestroyed: '計分建築全毀', wiped: '兵力全滅', retreat: '鳴金' };
const SAND_FAIL = { over: '戰鬥已結束', noCard: '此兵種已無剩餘隊數', noUnit: '未知兵種', cell: '此處不可部署', cap: '單位已達上限', locked: '此部尚未開放' };

const sand = {
  panel: null,
  btn: null,
  open: false,   // 設定面板開啟中
  setup: {},     // 兵種 -> 隊數(設定面板)
  card: null,    // 選中的兵種,點地圖放一隊
  dn: null,      // 按下座標,分辨點擊與拖曳
  evSeen: 0,     // 已處理的事件索引
  key: ''        // 戰鬥面板重繪鍵
};

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
    '<small>選擇試打兵力(每種 0~' + SAND_MAX + ' 隊)。不計戰績、不存檔。</small>';
  SAND_CARDS.forEach(u => {
    const n = sand.setup[u] | 0;
    h += '<div class="srow"><span class="sname">' + tdEsc(UNITS[u].name) + ' <small>' + UNITS[u].squad + ' 人/隊</small></span>' +
      '<button data-u="' + u + '" data-step="-1">−</button><b class="scnt">' + n + '</b>' +
      '<button data-u="' + u + '" data-step="1">＋</button></div>';
  });
  h += '<div class="sact"><button data-sact="start">開始沙盤</button></div>';
  sand.panel.innerHTML = h;
}

function sandStart() {
  if (game.mode !== 'battleDesign' || battle) return;
  const army = [];
  SAND_CARDS.forEach(u => {
    const n = sand.setup[u] | 0;
    if (n > 0) army.push({ u: u, n: n, part: 'main' });
  });
  if (!army.length) {
    showToast('請至少選 1 隊');
    return;
  }
  setTool(null);
  game.mode = 'attack';
  game.phase = 'march';
  game.simSpeed = 1;
  battle = battleInit({ kind: 'sandbox', seed: 1, map: boardToJSON(world), army: army });
  sand.card = null;
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
  const key = b.army.map(k => k.u + ':' + k.left).join(',') + '|' + sand.card + '|' + game.simSpeed;
  if (key === sand.key) return;
  sand.key = key;
  let cards = '';
  b.army.forEach(k => {
    cards += '<button data-card="' + tdEsc(k.u) + '"' + (sand.card === k.u ? ' class="on"' : '') +
      (k.left > 0 ? '' : ' disabled') + '>' + tdEsc(UNITS[k.u].name) + '<small>剩 ' + k.left + ' 隊</small></button>';
  });
  const sp = game.simSpeed;
  const spd = (v, label) => '<button data-speed="' + v + '"' + (sp === v ? ' class="on"' : '') + '>' + label + '</button>';
  sand.panel.innerHTML =
    '<div class="shd"><b>⚔ 沙盤推演</b><small>不計戰績・不存檔</small></div>' +
    '<div class="shud"><span id="sandTimer"></span><span id="sandDestroy"></span></div>' +
    '<small>點選兵種後,點地圖部署區放一隊</small>' +
    '<div class="scards">' + cards + '</div>' +
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
  const u = b.getAttribute('data-u'), step = b.getAttribute('data-step');
  const sp = b.getAttribute('data-speed'), card = b.getAttribute('data-card'), act = b.getAttribute('data-sact');
  if (step !== null) {
    sand.setup[u] = Math.max(0, Math.min(SAND_MAX, (sand.setup[u] | 0) + (+step)));
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
  } else if (card !== null) {
    sand.card = sand.card === card ? null : card;
    sandRenderBattle();
  }
}

// 點地圖(移動小於 8px 才算點擊)放一隊;指令於當下套用(等同下一個 simTick 第 1 步)
function sandTap(e) {
  const d = sand.dn;
  sand.dn = null;
  if (!battle || battle.over || !d || d.id !== e.pointerId) return;
  if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 8) return;
  if (!sand.card) {
    showToast('請先點選上方兵種');
    return;
  }
  const card = battle.army.find(k => k.u === sand.card && k.part === 'main');
  if (!card || card.left <= 0) {
    showToast('此兵種已無剩餘隊數');
    return;
  }
  const c = screenToCell(e.clientX, e.clientY);
  if (!c) return;
  issueCmd(battle, { op: 'deploy', u: sand.card, part: 'main', x: c.x, y: c.y });
  tdApplyCmds(battle);
  sandRenderBattle();
  sandHud();
}

// 鳴金:直接結算(暫停時也能結束,不必等下一個 tick)
function sandRetreat() {
  const b = battle;
  if (!b || b.over) return;
  b.over = true;
  b.result = { reason: 'retreat', pct: sandPct(b), tick: b.tick, lost: b.stats.lost, dealt: b.stats.dealt };
  sandFinish();
}

// 結算並回設計模式:battle=null、回 battleDesign、工具列與頂列恢復。不存檔
function sandFinish() {
  const b = battle;
  if (!b) return;
  const r = b.result || { reason: 'retreat', pct: sandPct(b), tick: b.tick };
  battle = null;
  game.mode = 'battleDesign';
  game.phase = '';
  game.simSpeed = 1;
  document.body.classList.remove('sandbox');
  sand.card = null;
  sand.dn = null;
  sand.key = '';
  if (sand.panel) sand.panel.hidden = true;
  setTool(null);
  updateResBar();
  showToast('沙盤結束(' + SAND_REASON[r.reason] + ')：摧毀率 ' + Math.floor(r.pct * 100) + '%，用時 ' + sandClock(r.tick));
}

// 每幀由 main.js 呼叫:同步按鈕、處理新事件、偵測結束、更新面板
function battleUiTick(dt) {
  sandSyncButton();
  if (!battle) {
    if (sand.open && game.mode !== 'battleDesign') sandClose();
    return;
  }
  const ev = battle.events;
  for (let k = sand.evSeen; k < ev.length; k++) {
    if (ev[k].type === 'deployFail') showToast('無法部署：' + (SAND_FAIL[(ev[k].data || {}).why] || '未知原因'));
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
  if (!battle || battle.over) return;
  if (game.mode !== 'attack' || game.phase !== 'march') return;
  runToEnd(battle);
  sandFinish();
}

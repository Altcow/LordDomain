// js/wmap_home.js — 地圖主畫面外殼 UI 調整(2026-11-18,設計_主畫面UI調整_需求.md / 設計_地圖畫面UI調整_需求.md):
//   ① 頂列關閉後的替代:左上〔任務〕鈕 → 任務中心頁(tab:任務 / 活動;活動清單可註冊 wmhomeEventReg)、右上〔數據〕+ 勢力 / 名聲小膠囊
//   ② 最下緣隊伍列:一排 5 格(每格一隊,點進該隊詳細頁);③ 右下小選單鈕(武將 / 戰法 / 背包 / 戰報 / 設定,在〔抽卡〕鈕左邊)
//   ④ 左下兩顆自繪圖示鈕:〔地圖〕開全螢幕縮小版全地圖、〔回歸城池〕把視窗移回主城;⑤ 城主府頁(只看城池基本數據)
//   ⑥ 全螢幕地圖頁 'wmapfull'(ldNav 堆疊頁、只有左上返回):縮小版全地圖,可點建築 / 領地 → 小資訊浮泡;自己的建築有〔移至〕
// 只在地圖主畫面(wmapUiOn)下由 wmapUiInit 尾端呼叫 wmhomeInit();ES2017,不用 ?. ??;UTF-8 + CRLF。全域名稱一律 wmhome* / WMHOME* / wmfull* / WMFULL*。
//
// ───────── 公開 API ─────────
//   wmhomeInit() → bool                 建隊伍列 / 小選單 / 左下鈕 / 左上任務鈕 / 數據群組;已建 = false
//   wmhomeTeamCells(now) → cells[]      5 格資料(純資料,無 DOM):{n, kind:'lock'|'empty'|'team', label, sub, ms, ratio, face}
//   wmhomeEventReg(def)                 註冊活動:{id, title, on(now)→bool, html(A, now)→string, dot(now)→bool};活動 tab 依註冊順序列出 on() 為真的項目
//   wmhomeEventList(now) → defs[]       目前有效的活動
//   wmhomeHubDot(now) → bool            左上〔任務〕鈕紅點(任何活動 dot 或有可領主線)
//   wmfullBuild() → {cv, ms, bytes}     畫全地圖底圖(canvas WMFULL.px 寬);量測用
//   wmfullPick(x, y) → {gi, kind}       畫布像素 → 點到的東西(main / node / own / res / cell)
//   wmfullOpen() / wmfullGoto(gi)       開全地圖 / 移至(關全地圖、主畫面跳到該格)

var WMHOME = { inited: false, strip: null, cells: [], menuBtn: null, menu: null, pair: null, tid: 0, events: [], hubDot: null, tr: null, sig: '' };
var WMHOME_MENU = [['武將', 'cards:R'], ['戰法', 'wmap:skills'], ['背包', 'ldbag'], ['戰報', 'wmap:report'], ['設定', 'settings']];
var WMHOME_STATE = { ready: '待命', go: '行進', fight: '交戰', idle: '駐守', back: '返回', hurt: '重傷' };
var WMHOME_TEAMS = 5;

function wmhomeEl(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt !== undefined && txt !== null) e.textContent = txt; return e; }
function wmhomeSvg(inner) { return '<svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true">' + inner + '</svg>'; }

// ───────── 隊伍列(純資料) ─────────
function wmhomeTeamCells(now) {
  var out = [], rows = {}, c = null, teams = [], i, n, inf, r, o, W = null;
  now = now || (typeof ldNow === 'function' ? ldNow() : Date.now());
  try {
    c = typeof wmapGoUiCtx === 'function' ? wmapGoUiCtx() : null;
    teams = typeof wdTeams === 'function' ? wdTeams() : [];
    if (c && typeof wmapPnlRows === 'function' && typeof WMAP !== 'undefined' && WMAP.WG) {
      W = wmapPnlRows(c.W, c.cs, teams, now, WMAP.WG);
      for (i = 0; i < W.length; i++) rows[W[i].n] = W[i];
    }
  } catch (e) { rows = {}; }
  for (n = 1; n <= WMHOME_TEAMS; n++) {
    inf = typeof ldHomeTeamInfo === 'function' ? ldHomeTeamInfo(n, now) : { locked: false, empty: true };
    o = { n: n, kind: 'team', label: '隊' + n, sub: '', ms: 0, ratio: 1, face: '', key: '' };
    if (inf.locked) { o.kind = 'lock'; o.sub = '鎖'; }
    else if (inf.empty) { o.kind = 'empty'; o.sub = '空'; }
    else {
      r = rows[n];
      o.key = r ? r.key : 'ready';
      o.sub = WMHOME_STATE[o.key] || '待命';
      o.ms = r ? r.ms : 0;
      o.ratio = inf.ratio;
      try { o.face = typeof ldHomeFaceSrc === 'function' ? ldHomeFaceSrc(inf.main) : ''; } catch (e2) { o.face = ''; }
    }
    out.push(o);
  }
  return out;
}

function wmhomeBuildStrip(root) {
  var st = wmhomeEl('nav', 'wmh-strip'), i, b;
  st.id = 'wmTeams';
  st.setAttribute('aria-label', '隊伍');
  for (i = 1; i <= WMHOME_TEAMS; i++) {
    b = wmhomeEl('button', 'wmh-cell');
    b.setAttribute('type', 'button'); b.setAttribute('data-wmt', String(i));
    b.innerHTML = '<span class="wmh-face"></span><span class="wmh-nm"></span><span class="wmh-st"></span><span class="wmh-tm"></span><i class="wmh-bar"><i></i></i>';
    st.appendChild(b);
    WMHOME.cells.push(b);
  }
  st.addEventListener('click', function (ev) {
    var t = ev.target, n;
    while (t && t !== st && !(t.getAttribute && t.getAttribute('data-wmt'))) t = t.parentNode;
    if (!t || t === st) return;
    n = +t.getAttribute('data-wmt');
    wmhomeMenuSet(false);
    if (typeof ldHomeTeamDo === 'function') ldHomeTeamDo(n);
  });
  root.appendChild(st);
  WMHOME.strip = st;
}
function wmhomeRenderStrip() {
  var cells = wmhomeTeamCells(), i, c, el, sig, f, nm, st, tm, bar, dur;
  if (!WMHOME.strip) return;
  dur = typeof wmapPnlDur === 'function' ? wmapPnlDur : function (m) { return String(Math.ceil(m / 1000)); };
  for (i = 0; i < cells.length; i++) {
    c = cells[i]; el = WMHOME.cells[i];
    f = el.firstChild; nm = f.nextSibling; st = nm.nextSibling; tm = st.nextSibling; bar = tm.nextSibling;
    sig = c.kind + '|' + c.sub + '|' + c.face;
    if (el.getAttribute('data-sig') !== sig) {
      el.setAttribute('data-sig', sig);
      el.className = 'wmh-cell k-' + c.kind + (c.key ? ' s-' + c.key : '');
      f.style.backgroundImage = c.face ? 'url("' + c.face + '")' : '';
      el.setAttribute('aria-label', c.label + ' ' + c.sub);
    }
    if (nm.textContent !== c.label) nm.textContent = c.label;
    if (st.textContent !== c.sub) st.textContent = c.sub;
    tm.textContent = c.ms > 0 ? dur(c.ms) : '';
    bar.style.display = c.kind === 'team' ? '' : 'none';
    bar.firstChild.style.width = Math.round(c.ratio * 100) + '%';
  }
}

// ───────── 右下小選單 ─────────
function wmhomeMenuSet(on) {
  if (!WMHOME.menu) return false;
  WMHOME.menu.hidden = !on;
  WMHOME.menuBtn.setAttribute('aria-expanded', on ? 'true' : 'false');
  WMHOME.menuBtn.classList.toggle('on', !!on);
  return true;
}
function wmhomeBuildMenu(root) {
  var b = wmhomeEl('button', 'wmh-mbtn'), m = wmhomeEl('div', 'wmh-menu'), i, it;
  b.setAttribute('type', 'button'); b.setAttribute('aria-label', '選單'); b.setAttribute('aria-expanded', 'false'); b.id = 'wmMenuBtn';
  b.innerHTML = wmhomeSvg('<path d="M6 9h20M6 16h20M6 23h20" stroke="#3b2410" stroke-width="3.4" stroke-linecap="round" fill="none"/>');
  m.id = 'wmMenu'; m.hidden = true;
  for (i = 0; i < WMHOME_MENU.length; i++) {
    it = wmhomeEl('button', 'wmh-mi', WMHOME_MENU[i][0]);
    it.setAttribute('type', 'button'); it.setAttribute('data-wma', WMHOME_MENU[i][1]);
    m.appendChild(it);
  }
  b.addEventListener('click', function (ev) { ev.stopPropagation(); wmhomeMenuSet(m.hidden); });
  m.addEventListener('click', function (ev) {
    var t = ev.target, a;
    while (t && t !== m && !(t.getAttribute && t.getAttribute('data-wma'))) t = t.parentNode;
    if (!t || t === m) return;
    a = t.getAttribute('data-wma');
    wmhomeMenuSet(false);
    if (typeof shellAct === 'function') shellAct(a);
  });
  document.addEventListener('pointerdown', function (ev) {
    if (m.hidden) return;
    if (ev.target === b || (b.contains && b.contains(ev.target)) || (m.contains && m.contains(ev.target))) return;
    wmhomeMenuSet(false);
  }, true);
  root.appendChild(m); root.appendChild(b);
  WMHOME.menu = m; WMHOME.menuBtn = b;
}

// ───────── 左下兩顆圖示鈕 ─────────
function wmhomeBuildPair(root) {
  var p = wmhomeEl('div', 'wmh-pair'), a = wmhomeEl('button', 'wmh-pb'), h = wmhomeEl('button', 'wmh-pb'), s3 = wmhomeEl('button', 'wmh-pb');
  a.setAttribute('type', 'button'); a.setAttribute('data-wmp', 'map'); a.setAttribute('aria-label', '地圖');
  a.innerHTML = wmhomeSvg('<path d="M3 8l8-3 10 3 8-3v19l-8 3-10-3-8 3z" fill="#f6e2b0" stroke="#3b2410" stroke-width="2" stroke-linejoin="round"/><path d="M11 5v19M21 8v19" stroke="#3b2410" stroke-width="1.6" fill="none"/><circle cx="23" cy="14" r="3" fill="#d03a22" stroke="#3b2410" stroke-width="1.4"/>') + '<span>地圖</span>';
  h.setAttribute('type', 'button'); h.setAttribute('data-wmp', 'home'); h.setAttribute('aria-label', '回歸城池');
  h.innerHTML = wmhomeSvg('<path d="M3 16L16 5l13 11" fill="none" stroke="#3b2410" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M7 15v13h18V15" fill="#f6e2b0" stroke="#3b2410" stroke-width="2" stroke-linejoin="round"/><path d="M13 28v-8h6v8" fill="#d03a22" stroke="#3b2410" stroke-width="1.6"/>') + '<span>回歸城池</span>';
  s3.setAttribute('type', 'button'); s3.setAttribute('data-wmp', 'search'); s3.setAttribute('aria-label', '搜尋');   // 第三顆〔搜尋〕(js/wmap_search.js;自繪放大鏡 SVG)
  s3.innerHTML = (typeof wmsearchIcon === 'function' ? wmsearchIcon() : wmhomeSvg('<circle cx="13" cy="13" r="8" fill="#fff3cf" stroke="#3b2410" stroke-width="2.4"/><path d="M19.2 19.2 27 27" stroke="#3b2410" stroke-width="4" stroke-linecap="round"/>')) + '<span>搜尋</span>';
  p.appendChild(a); p.appendChild(h); p.appendChild(s3);
  p.addEventListener('pointerdown', function (ev) { ev.stopPropagation(); });
  p.addEventListener('click', function (ev) {
    var t = ev.target, k;
    while (t && t !== p && !(t.getAttribute && t.getAttribute('data-wmp'))) t = t.parentNode;
    if (!t || t === p) return;
    k = t.getAttribute('data-wmp');
    wmhomeMenuSet(false);
    if (k === 'map') wmfullOpen();
    else if (k === 'search') { if (typeof wmsearchOpen === 'function') wmsearchOpen(); }
    else if (typeof wmapSetCam === 'function' && WMAP.WG) wmapSetCam(WMAP.WG.cx + 0.5, WMAP.WG.cy + 0.5);
  });
  root.appendChild(p);
  WMHOME.pair = p;
}

// ───────── 左上〔任務〕鈕與任務中心頁 ─────────
function wmhomeEventReg(def) {
  var i;
  if (!def || !def.id) return false;
  for (i = 0; i < WMHOME.events.length; i++) if (WMHOME.events[i].id === def.id) { WMHOME.events[i] = def; return true; }
  WMHOME.events.push(def);
  return true;
}
function wmhomeEventList(now) {
  return WMHOME.events.filter(function (d) { try { return !d.on || d.on(now); } catch (e) { return false; } });
}
function wmhomeHubDot(now) {
  var i, d;
  now = now || Date.now();
  for (i = 0; i < WMHOME.events.length; i++) {
    d = WMHOME.events[i];
    try { if ((!d.on || d.on(now)) && d.dot && d.dot(now)) return true; } catch (e) { /* 略過 */ }
  }
  return false;
}
function wmhomeHubQuestHtml(A, now) { return (typeof ldoOn === 'function' && ldoOn() && typeof ldoQuestHtml === 'function') ? ldoQuestHtml(A, now) : '<div class="ldp-empty">任務系統準備中</div>'; }
function wmhomeHubEventsHtml(A, now) {
  var l = wmhomeEventList(now), h = '';
  l.forEach(function (d) { var s = ''; try { s = d.html(A, now); } catch (e) { s = ''; } if (s) h += '<div class="wmh-evsec" data-evid="' + d.id + '"><div class="wmh-evt">' + d.title + '</div>' + s + '</div>'; });
  return h || '<div class="ldp-empty">目前沒有活動</div>';
}
var WMHOME_HUB = { tab: 'quest' };
function wmhomeHubBuild(el, ctx) {
  var box = wmhomeEl('div', 'ldo ldo-page wmh-hub'), draw, tabs = ctx && ctx.tabsEl;
  draw = function () {
    var A = 'data-ldo', now = Date.now(), scroll = el.scrollTop;
    box.innerHTML = WMHOME_HUB.tab === 'event' ? wmhomeHubEventsHtml(A, now) : wmhomeHubQuestHtml(A, now);
    if (tabs) {
      tabs.innerHTML = '<button type="button" class="wmh-tab' + (WMHOME_HUB.tab === 'quest' ? ' on' : '') + '" data-wmtab="quest">任務</button><button type="button" class="wmh-tab' + (WMHOME_HUB.tab === 'event' ? ' on' : '') + '" data-wmtab="event">活動' + (wmhomeHubDot(now) ? '<i class="ldh-dot"></i>' : '') + '</button>';
    }
    el.scrollTop = scroll;
  };
  if (typeof ldoBind === 'function') ldoBind(box, 'ld', draw);
  if (tabs) tabs.onclick = function (ev) { var t = ev.target.closest ? ev.target.closest('[data-wmtab]') : null; if (t) { WMHOME_HUB.tab = t.getAttribute('data-wmtab'); draw(); } };
  el.appendChild(box);
  el.__wmhDraw = draw;
  if (typeof LDO !== 'undefined' && LDO.draws) LDO.draws.hub = draw;
  draw();
}
function wmhomeHubSync() {
  var d = WMHOME.hubDot;
  if (d) d.hidden = !wmhomeHubDot(Date.now());
}
function wmhomeBuildHubBtn() {
  var rg = typeof LDH !== 'undefined' ? LDH.rg : null, d;
  if (!rg) return;
  rg.setAttribute('aria-label', '任務');
  d = wmhomeEl('i', 'ldh-dot'); d.hidden = true;
  rg.appendChild(d);
  WMHOME.hubDot = d;
  rg.onclick = null;
  rg.addEventListener('click', function (ev) { ev.stopImmediatePropagation(); wmhomeMenuSet(false); if (typeof ldNavPush === 'function') ldNavPush('questhub'); }, true);
}

// ───────── 右上數據群組(頂列關閉後:勢力 / 名聲小膠囊 + 數據鈕) ─────────
function wmhomeBuildTr() {
  var st = typeof SHELL !== 'undefined' ? SHELL.stEl : null, row, caps;
  if (!st || !SHELL.stT) return;
  row = wmhomeEl('div', 'wmh-tr');
  caps = typeof WMAPPNL !== 'undefined' ? WMAPPNL.caps : null;
  if (caps) row.appendChild(caps);
  row.appendChild(SHELL.stT);
  st.insertBefore(row, st.firstChild);
  WMHOME.tr = row;
}

// ───────── 任務中心註冊的活動:新手七日 / 限時活動 ─────────
function wmhomeRegisterDefaults() {
  wmhomeEventReg({ id: 'nb7', title: '新手七日',
    on: function () { return typeof evNbList === 'function' && evNbList().some(function (x) { return !x.got; }); },
    dot: function () { return typeof evNbList === 'function' && (evNbList().some(function (x) { return x.can; }) || (typeof evRead === 'function' && evRead().nb.pick === 1)); },
    html: function (A) { return typeof ldoNbHtml === 'function' ? ldoNbHtml(A) : ''; } });
  wmhomeEventReg({ id: 'evt', title: '限時活動',
    on: function () { return typeof ldoOn === 'function' && ldoOn() && typeof ldoEventHtml === 'function'; },
    dot: function (now) { return typeof ldoBossReady === 'function' && ldoBossReady(now); },
    html: function (A, now) { return ldoEventHtml(A, now, true); } });
}

// ───────── 城主府頁:只看城池基本數據 ─────────
var WMHOME_HALL = [['城主等級', 'lv'], ['錢', 'coin'], ['糧', 'res'], ['勢力', 'faction'], ['名聲', 'fame'], ['領地', 'land'], ['預備兵', 'rsv'], ['出征兵數', 'troops'], ['出征戰力', 'power']];
function wmhomeHallRows() {
  var out = [], lv = '-', coin = 0, i, k, v;
  try { if (typeof progLv === 'function') lv = progLv(); } catch (e) { lv = '-'; }
  try { if (typeof world !== 'undefined' && world && world.res) coin = world.res.coin || 0; } catch (e2) { coin = 0; }
  for (i = 0; i < WMHOME_HALL.length; i++) {
    k = WMHOME_HALL[i][1];
    if (k === 'lv') v = String(lv);
    else if (k === 'coin') v = typeof shellFmtMoney === 'function' ? shellFmtMoney(coin) : String(coin);
    else v = (typeof SHELL !== 'undefined' && SHELL.stV && SHELL.stV[k]) ? SHELL.stV[k].textContent : '--';
    out.push([WMHOME_HALL[i][0], v]);
  }
  return out;
}
function wmhomeHallBuild(el) {
  var h = '<div class="wmh-hall"><div class="wmh-hallt">城池基本數據</div>', rows;
  try { if (typeof shellRefresh === 'function') shellRefresh(); } catch (e) { /* 顯示用 */ }
  rows = wmhomeHallRows();
  rows.forEach(function (r) { h += '<div class="wmh-hr"><span>' + r[0] + '</span><b>' + r[1] + '</b></div>'; });
  el.innerHTML = h + '</div>';
}

// ───────── 全螢幕地圖 ─────────
var WMFULL = { px: 1024, cv: null, base: null, ms: 0, bytes: 0, bubble: null, stage: null, sel: -1, wrap: null };
function wmfullBuild() {
  var t0 = performance.now(), WG = WMAP.WG, N = WG.size, px = WMFULL.px, ph, base, cv, g, k, i, q, p;
  if (typeof wmapPnlMiniBase !== 'function') return null;
  base = wmapPnlMiniBase(px);
  if (!base) return null;
  ph = base.height;
  cv = document.createElement('canvas'); cv.width = px; cv.height = ph;
  g = cv.getContext('2d');
  g.drawImage(base, 0, 0);
  function quad(c0, r0, fw, fh) {
    var a = [wmapPnlMiniUV(c0, r0, N, px), wmapPnlMiniUV(c0 + fw, r0, N, px), wmapPnlMiniUV(c0 + fw, r0 + fh, N, px), wmapPnlMiniUV(c0, r0 + fh, N, px)];
    g.beginPath(); g.moveTo(a[0].x, a[0].y); g.lineTo(a[1].x, a[1].y); g.lineTo(a[2].x, a[2].y); g.lineTo(a[3].x, a[3].y); g.closePath();
    return a;
  }
  for (i = 0; i < WG.nodes.length; i++) {
    k = WG.nodes[i]; g.fillStyle = k.type === 'jun' || k.type === 'zhou' ? '#3f5d7a' : (k.type === 'pass' ? '#8f8676' : '#6f7f86');
    quad(k.c0, k.r0, k.fw, k.fh); g.fill(); g.strokeStyle = '#1e2a33'; g.lineWidth = 1.2; g.stroke();
  }
  for (k in (WMAP.own || {})) { p = wmapPnlMiniXY(+k, N, px); g.fillStyle = '#d03a22'; g.fillRect(Math.round(p.x) - 3, Math.round(p.y) - 2, 6, 4); g.strokeStyle = '#3b2410'; g.lineWidth = 1; g.strokeRect(Math.round(p.x) - 3, Math.round(p.y) - 2, 6, 4); }
  g.fillStyle = '#d03a22'; q = quad(WG.cx - 1, WG.cy - 1, 3, 3); g.fill(); g.strokeStyle = '#3b2410'; g.lineWidth = 2; g.stroke();
  if (typeof wmsearchFullDraw === 'function') wmsearchFullDraw(g, N, px);   // 搜尋標示中:同條件的格畫紅色小六邊形外框
  WMFULL.cv = cv; WMFULL.base = base;
  WMFULL.ms = performance.now() - t0; WMFULL.bytes = (px * ph * 4) * 2;
  return { cv: cv, ms: WMFULL.ms, bytes: WMFULL.bytes };
}
// 畫布像素 → 點到的東西:先主城、再城池(縣 / 郡 / 州 / 關,含 1 格容差)、再我的領地、再資源領地、最後一般格
function wmfullPick(x, y) {
  var WG = WMAP.WG, N = WG.size, px = WMFULL.px, raw = wmapPnlMiniRaw(x, y, N, px), c = raw.c, r = raw.r, gi, dc, dr, nd, nc, nr, best = -1, bd = 1e9, d, info;
  if (c < 0 || r < 0 || c >= N || r >= N) return { gi: -1, kind: 'none' };
  gi = r * N + c;
  if (Math.abs(c - WG.cx) <= 2 && Math.abs(r - WG.cy) <= 2) return { gi: WG.c0, kind: 'main' };
  for (dr = -1; dr <= 1; dr++) for (dc = -1; dc <= 1; dc++) {
    nc = c + dc; nr = r + dr;
    if (nc < 0 || nr < 0 || nc >= N || nr >= N) continue;
    nd = wmNodeAt(WG, nr * N + nc);
    if (nd) { d = Math.abs(dc) + Math.abs(dr); if (d < bd) { bd = d; best = nd.gi; } }
  }
  if (best >= 0) return { gi: best, kind: 'node' };
  for (dr = -1; dr <= 1; dr++) for (dc = -1; dc <= 1; dc++) {
    nc = c + dc; nr = r + dr;
    if (nc >= 0 && nr >= 0 && nc < N && nr < N && WMAP.own && WMAP.own[nr * N + nc]) return { gi: nr * N + nc, kind: 'own' };
  }
  info = WMAP.cellInfo ? WMAP.cellInfo(gi) : null;
  if (info) return { gi: gi, kind: 'res' };
  return { gi: gi, kind: 'cell' };
}
function wmfullBubbleHide() { if (WMFULL.bubble) WMFULL.bubble.hidden = true; WMFULL.sel = -1; }
function wmfullBubbleShow(pick, x, y, host) {
  var b = WMFULL.bubble, txt = '', mine = false, N = WMAP.WG.size, c = pick.gi % N, r = (pick.gi - c) / N, hr, bw, left, top, btn;
  if (pick.kind === 'main') { txt = '我的主城(' + WMAP.WG.cx + ',' + WMAP.WG.cy + ')'; mine = true; }
  else if (pick.kind === 'own') { txt = (typeof wmapCellText === 'function' ? wmapCellText(pick.gi) : '(' + c + ',' + r + ')') + ' · 我的領地'; mine = true; }
  else txt = typeof wmapCellText === 'function' ? wmapCellText(pick.gi) : '(' + c + ',' + r + ')';
  b.innerHTML = '';
  b.appendChild(wmhomeEl('div', 'wmh-bt', txt));
  if (mine) {
    btn = wmhomeEl('button', 'wmh-bgo', '移至'); btn.setAttribute('type', 'button'); btn.setAttribute('data-wmgo', String(pick.gi));
    b.appendChild(btn);
  }
  b.hidden = false; WMFULL.sel = pick.gi;
  hr = host.getBoundingClientRect(); bw = b.offsetWidth || 160;
  var sl = WMFULL.wrap ? WMFULL.wrap.scrollLeft : 0, vw = WMFULL.wrap ? WMFULL.wrap.clientWidth : hr.width;   // 浮泡夾在目前可見範圍內(全地圖在窄螢幕可橫向捲動)
  left = Math.max(sl + 6, Math.min(sl + vw - bw - 6, x - bw / 2));
  top = y - (b.offsetHeight || 60) - 14;
  if (top < 6) top = y + 18;
  b.style.left = Math.round(left) + 'px'; b.style.top = Math.round(top) + 'px';
}
function wmfullGoto(gi) {
  var N = WMAP.WG.size, c = gi % N, r = (gi - c) / N;
  if (typeof ldNavBack === 'function') ldNavBack();
  wmapSetCam(c + 0.5, r + 0.5);
  return true;
}
function wmfullOpen() { return typeof ldNavPush === 'function' ? ldNavPush('wmapfull') : false; }
function wmfullPageBuild(el) {
  var wrap = wmhomeEl('div', 'wmh-full'), st = wmhomeEl('div', 'wmh-fst'), cv, shown, b = wmhomeEl('div', 'wmh-bub');
  if (typeof WMAP === 'undefined' || !WMAP.on || !WMAP.WG) { el.textContent = '地圖尚未就緒'; return; }
  shown = wmfullBuild();
  if (!shown) { el.textContent = '地圖無法繪製'; return; }
  cv = shown.cv; cv.className = 'wmh-fcv'; cv.setAttribute('aria-label', '全地圖');
  b.hidden = true; b.addEventListener('pointerdown', function (ev) { ev.stopPropagation(); });
  b.addEventListener('click', function (ev) { var t = ev.target.closest ? ev.target.closest('[data-wmgo]') : null; if (t) wmfullGoto(+t.getAttribute('data-wmgo')); });
  st.appendChild(cv); st.appendChild(b); wrap.appendChild(st); el.appendChild(wrap);
  WMFULL.bubble = b; WMFULL.stage = st; WMFULL.wrap = wrap;
  setTimeout(function () { if (WMFULL.wrap === wrap) wrap.scrollLeft = Math.max(0, (wrap.scrollWidth - wrap.clientWidth) / 2); }, 0);   // 窄螢幕:預設捲到中間
  var dn = null;
  cv.addEventListener('pointerdown', function (e) { dn = { x: e.clientX, y: e.clientY }; });
  cv.addEventListener('pointerup', function (e) {
    var rc, x, y, p, hr;
    if (!dn || Math.abs(e.clientX - dn.x) > 8 || Math.abs(e.clientY - dn.y) > 8) { dn = null; return; }   // 拖曳捲動不算點選
    dn = null; rc = cv.getBoundingClientRect();
    x = (e.clientX - rc.left) / rc.width * cv.width; y = (e.clientY - rc.top) / rc.height * cv.height;
    p = wmfullPick(x, y);
    if (p.gi < 0) { wmfullBubbleHide(); return; }
    hr = st.getBoundingClientRect();
    wmfullBubbleShow(p, e.clientX - hr.left, e.clientY - hr.top, st);
    wmfullMark(cv, x, y);
  });
}
function wmfullMark(cv, x, y) { WMFULL.mk = [x, y]; wmfullRepaint(cv); }   // 點選回饋:在底圖上畫一圈
function wmfullRepaint(cv) {
  var g = cv.getContext('2d'), m = WMFULL.mk;
  g.clearRect(0, 0, cv.width, cv.height);
  g.drawImage(WMFULL.base, 0, 0);
  if (WMFULL.over) g.drawImage(WMFULL.over, 0, 0);
  if (m) { g.strokeStyle = '#fff'; g.lineWidth = 4; g.beginPath(); g.arc(m[0], m[1], 14, 0, 6.2832); g.stroke(); g.strokeStyle = '#d99a12'; g.lineWidth = 2; g.beginPath(); g.arc(m[0], m[1], 14, 0, 6.2832); g.stroke(); }
}

// ───────── 建置 ─────────
function wmhomeTick() {
  if (!WMHOME.inited || (typeof document !== 'undefined' && document.hidden)) return;
  wmhomeRenderStrip();
  wmhomeHubSync();
  try {   // 右側倒數浮條避開上方的數據群組 / 展開的數據面板
    if (WMAP && WMAP.root && SHELL.stEl) WMAP.root.style.setProperty('--wp-top', (SHELL.stEl.offsetHeight + 10) + 'px');
  } catch (e) { /* 顯示用 */ }
}
function wmhomeInit() {
  var root;
  if (WMHOME.inited || typeof document === 'undefined' || typeof SHELL === 'undefined' || !SHELL.el || typeof WMAP === 'undefined' || !WMAP.on) return false;
  root = SHELL.el;
  wmhomeRegisterDefaults();
  wmhomeBuildStrip(root);
  wmhomeBuildMenu(root);
  wmhomeBuildPair(WMAP.root);
  wmhomeBuildHubBtn();
  wmhomeBuildTr();
  WMHOME.inited = true;
  if (typeof setInterval === 'function') WMHOME.tid = setInterval(wmhomeTick, 1000);
  wmhomeTick();
  return true;
}

if (typeof ldNavRegister === 'function') {
  ldNavRegister({ id: 'questhub', title: '任務', build: function (el, ctx) { wmhomeHubBuild(el, ctx); }, onShow: function (el) { if (el && el.__wmhDraw) el.__wmhDraw(); }, noClose: true });
  ldNavRegister({ id: 'hall', title: '城主府', build: function (el) { wmhomeHallBuild(el); }, onShow: function (el) { wmhomeHallBuild(el); }, noClose: true });
  ldNavRegister({ id: 'wmapfull', title: '地圖', build: function (el) { wmfullPageBuild(el); }, onHide: function () { WMFULL.cv = null; WMFULL.base = null; WMFULL.bubble = null; WMFULL.mk = null; }, noClose: true });
}

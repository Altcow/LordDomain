// js/wmap_panels.js — M1 W6 主畫面資訊:部隊面板 / 倒數浮條 / 頂列勢力名聲膠囊 / 地圖格框與「營」徽章 / 迷你地圖(設計_M1視覺原型_實作計畫.md W6 列;外殼規格 5.2、5.4)。
// 純函式(wmapPnl 開頭、node 可測):格式化(wmapPnlFmtNum / wmapPnlDur)、隊伍狀態(wmapPnlState / wmapPnlRows)、倒數清單(wmapPnlCdList)、地圖覆蓋(wmapPnlOverlay)、迷你地圖座標(wmapPnlMiniXY / wmapPnlMiniCell,六邊形菱形投影)。
// UI(wmapPnlInit):掛在 #wmapRoot 裡的小浮條,不跳半視窗;每秒一次計時(頁面隱藏時不跑),倒數只改文字節點、結構(狀態 / 按鈕組合)變了才重建;
//   地圖上的格框與「營」徽章是畫在 WMAP.world 內的 CSS 圖形節點(只動 transform / opacity,呼吸週期 1.6 秒),地圖上沒有任何文字;不碰 wmap_view / wmap_art / wmap_res 的渲染。
// 掛鉤:wmap_ui.js 的 wmapUiInit 尾端呼叫 wmapPnlInit();shell.js 的 shellStatRender 讀 wmapPnlPowerText() 補『勢力』(基本數據面板)。
// 資料來源:沿用 W3 / W5 的 WDUI.W(wmapGoUiCtx)、wmapGoStatus、wmapSettlePower / Cap / Count、fameGet;不開存檔鍵(只記面板收合到 localStorage lorddomain.ui.wmpnl)。
// ES2017,不用 ?. ??;UTF-8 + CRLF。載入順序:wmap_settle_ui.js 之後。全域名一律 wmapPnl* / WMAPPNL*。
//
// ───────── 公開 API ─────────
//   wmapPnlFmtNum(n) → '1,234' | '1.2萬' | '3.5億'            小數值格式化(負數 / 非數字 = 0)
//   wmapPnlDur(ms) → 'mm:ss' | 'h:mm:ss'                        剩餘時間(無條件進位到秒)
//   wmapPnlTargetText(pt, size) → 'Lv3 農田 (12,30)'           行程目標文字(pt = wdPt;沒有 = '')
//   wmapPnlState(trip, st, hurtLeft, now) → {key, label, ms, cmds[{k,t}], cd}    key = ready | go | fight | idle | back | hurt;ms = 該狀態剩餘毫秒(0 = 不顯示倒數);cmds = 可下的指令;cd = 指令冷卻秒
//   wmapPnlRows(W, cs, teams, now, WG) → rows[]                 每隊一列:{n, name, key, label, ms, target, tripId, gi, c, r, cmds, cd}(gi / c / r = 軍隊目前所在格,待命 = 主城)
//   wmapPnlRowSig(row) → string                                 列的結構簽名(不含倒數;簽名不變就只更新文字)
//   wmapPnlCdList(W, now, size, WG) → entries[]                 倒數清單(行軍 / 閒置 / 回程 / 放棄),依剩餘時間由近到遠:{kind, id, label, ms, gi}
//   wmapPnlOverlay(W, now, WG, selId) → {frame:gi|-1, camps:[gi…]}   地圖覆蓋:選取軍隊所屬格 + 閒置軍所在格(徽章)
//   wmapPnlMiniXY(gi, size, px) → {x, y}                        迷你地圖像素(格中心;px = 畫布寬,高 = wmapPnlMiniH(size, px));wmapPnlMiniCell(x, y, size, px) → gi    反查(點迷你地圖 → 格,夾在範圍內);wmapPnlMiniUV(u, v, size, px) 連續座標;wmapPnlMiniRaw 不夾範圍
//   wmapPnlPowerText() → ''|'1,234'                             勢力顯示字串(沒有存檔狀態 = '')
//   wmapPnlInit() → bool        建面板 / 浮條 / 膠囊 / 迷你地圖並起 1 秒計時;旗標 wmap 關 / 地圖未掛 / 已建 = false
//   wmapPnlTick()               更新全部(1 秒呼叫一次)
//   wmapPnlSelect(tripId|null)  面板選取軍隊(畫格框、行軍層選取環);再選同一隊 = 取消
//   wmapPnlFocus(tripId|null)   鏡頭移到軍隊目前位置(null = 主城)
//   WMAPPNL                     狀態

var WMAPPNL = { inited: false, root: null, panel: null, list: null, head: null, cd: null, mini: null, miniCv: null, miniBase: null, miniSig: '', caps: null, capEls: {}, capTx: {}, sel: null, selFrom: '', open: true,
  rowsSig: '', rowEls: {}, cdSig: '', cdEls: [], ovSig: '', frame: null, campEls: [], tid: 0, ticks: 0, binds: [], hooked: false };
var WMAPPNL_CFG = { cdMax: 4, miniPx: 192, miniShow: 72, miniShowWide: 120, key: 'lorddomain.ui.wmpnl', capEvery: 3 };
var WMAPPNL_STATE = { ready: '待命', go: '行軍', fight: '交戰', idle: '閒置', back: '回程', hurt: '重傷' };
var WMAPPNL_CMD = { stop: '停止', resume: '繼續', retreat: '撤退' };

// ───────── 純函式 ─────────
function wmapPnlTrim(s) { return String(s).replace(/\.0$/, ''); }
function wmapPnlFmtNum(n) {
  var s;
  n = typeof n === 'number' && isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
  if (n >= 100000000) return wmapPnlTrim((n / 100000000).toFixed(1)) + '億';
  if (n >= 10000) return wmapPnlTrim((n / 10000).toFixed(1)) + '萬';
  s = String(n);
  return s.replace(/\B(?=(\d{3})+$)/g, ',');
}
function wmapPnlDur(ms) {
  var s = Math.max(0, Math.ceil((+ms || 0) / 1000)), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60, p = function (v) { return (v < 10 ? '0' : '') + v; };
  return h > 0 ? h + ':' + p(m) + ':' + p(x) : p(m) + ':' + p(x);
}
function wmapPnlCoord(gi, size) { var c = gi % size; return '(' + c + ',' + ((gi - c) / size) + ')'; }
function wmapPnlTargetText(pt, size) {
  var gi = -1, s = '';
  if (!pt) return '';
  if (typeof pt.id === 'string' && /^w\d+$/.test(pt.id)) gi = +pt.id.slice(1);
  if (gi >= 0) s = ' ' + wmapPnlCoord(gi, size || 64);
  if (pt.cat === 'res') return 'Lv' + pt.lv + ' ' + pt.ty + s;
  return String(pt.ty || '') + (pt.cat === 'pass' ? '(關口)' : (pt.cat === 'county' ? '(縣城)' : (pt.cat === 'jun' ? '(郡城)' : ''))) + s;
}
// 一隊的狀態:trip = 這隊的行程(沒有 = null);st = wmapGoStatus(trip, now);hurtLeft = 全隊最長重傷剩餘毫秒
function wmapPnlState(trip, st, hurtLeft, now) {
  var o = { key: 'ready', label: WMAPPNL_STATE.ready, ms: 0, cmds: [], cd: 0 }, ph;
  if (trip) {
    ph = st && st.phase ? st.phase : '';
    if (trip.st === 'back' || ph === 'back') { o.key = 'back'; o.ms = Math.max(0, (st && st.phase !== 'none' && st.tHome ? st.tHome : trip.tHome) - now); }
    else if (ph === 'idle') { o.key = 'idle'; o.ms = Math.max(0, st.huLeft); }
    else if (ph === 'fight') { o.key = 'fight'; o.ms = 0; }
    else { o.key = 'go'; o.ms = Math.max(0, (st && st.eta ? st.eta : trip.tArrive) - now); }
    o.label = WMAPPNL_STATE[o.key];
    if (st) {
      if (st.canStop) o.cmds.push({ k: 'stop', t: WMAPPNL_CMD.stop });
      if (st.canResume) o.cmds.push({ k: 'resume', t: WMAPPNL_CMD.resume });
      if (st.canRetreat) o.cmds.push({ k: 'retreat', t: WMAPPNL_CMD.retreat });
      o.cd = Math.ceil((st.cdLeft || 0) / 1000);
    }
    return o;
  }
  if (hurtLeft > 0) { o.key = 'hurt'; o.label = WMAPPNL_STATE.hurt; o.ms = hurtLeft; }
  return o;
}
function wmapPnlRows(W, cs, teams, now, WG) {
  var rows = [], i, j, t, tr, st, hl, s, pt, size = WG ? WG.size : 64, pose, row;
  for (i = 0; i < (teams || []).length; i++) {
    t = teams[i]; tr = wdTeamTrip(W, t.n); st = tr ? wmapGoStatus(tr, now, WG) : null;
    hl = 0;
    for (j = 0; j < t.slots.length; j++) hl = Math.max(hl, wdHurtLeft(W, t.slots[j].id, now));
    s = wmapPnlState(tr, st, hl, now);
    pt = tr ? wdPt(W, tr.pt) : null;
    row = { n: t.n, name: String(t.name || ('隊' + t.n)), key: s.key, label: s.label, ms: s.ms, target: tr ? wmapPnlTargetText(pt, size) : '', tripId: tr ? tr.id : '', gi: -1, c: -1, r: -1, cmds: s.cmds, cd: s.cd };
    if (tr && st && st.lg && typeof wmMarchAt === 'function') {
      pose = wmMarchAt(st.lg, now, size);
      row.gi = pose.gi; row.c = pose.c; row.r = pose.r;
    }
    if (row.gi < 0 && WG) { row.gi = WG.c0; row.c = WG.cx; row.r = WG.cy; }
    rows.push(row);
  }
  return rows;
}
function wmapPnlRowSig(row) {
  return [row.n, row.name, row.key, row.target, row.tripId, row.cmds.map(function (c) { return c.k; }).join('+'), row.cd > 0 ? 1 : 0, row.ms > 0 ? 1 : 0].join('|');
}
function wmapPnlCdList(W, now, size, WG) {
  var out = [], i, tr, st, pt, k, g, own, nm;
  for (i = 0; i < W.trips.length; i++) {
    tr = W.trips[i];
    if (tr.rally) continue;
    st = wmapGoStatus(tr, now, WG);
    pt = wdPt(W, tr.pt);
    nm = String(tr.name || ('隊' + tr.team));
    if (tr.st === 'back' || st.phase === 'back') out.push({ kind: 'back', id: tr.id, label: nm, ms: Math.max(0, (st.phase !== 'none' && st.tHome ? st.tHome : tr.tHome) - now), gi: -1 });
    else if (st.phase === 'idle') out.push({ kind: 'idle', id: tr.id, label: nm, ms: Math.max(0, st.huLeft), gi: st.gi });
    else if (st.phase === 'go' || st.phase === 'wait') out.push({ kind: 'go', id: tr.id, label: nm, ms: Math.max(0, (st.eta ? st.eta : tr.tArrive) - now), gi: -1 });
  }
  own = W.g2 && W.g2.own ? W.g2.own : {};
  for (k in own) {
    g = own[k];
    if (g && g.q > now) out.push({ kind: 'quit', id: 'q' + k, label: wmapPnlCoord(+k, size || 64), ms: g.q - now, gi: +k });
  }
  out.sort(function (a, b) { return a.ms - b.ms; });
  return out;
}
function wmapPnlOverlay(W, now, WG, selId) {
  var o = { frame: -1, camps: [] }, i, tr, st;
  for (i = 0; i < W.trips.length; i++) {
    tr = W.trips[i];
    if (tr.rally) continue;
    st = wmapGoStatus(tr, now, WG);
    if (st.phase === 'idle' && st.gi >= 0 && o.camps.indexOf(st.gi) < 0) o.camps.push(st.gi);
    if (selId && tr.id === selId && st.gi >= 0 && st.phase !== 'done' && st.phase !== 'wait' && st.phase !== 'none') o.frame = st.gi;
  }
  o.camps.sort(function (a, b) { return a - b; });
  return o;
}
// 迷你地圖 = 主畫面同形的六邊形菱形投影縮小版(wmap_proj.js:x = ox + 0.75 W (u − v)、y = oy + 0.5 H (u + v),H = 9/16 W):
// 寬 px = 1.5 W × size 的縮小,所以 x = px / 2 + (u − v) × px / (2 × size)、y = (u + v) × px × ratio / (2 × size),ratio = 0.5 H / 0.75 W = 0.375;畫布高 = px × ratio。
// 與主畫面只差一個均勻縮放 + 平移(測試:隨機格逐格比對 wmapUV2World)。
function wmapPnlMiniRatio() { return 0.5 * (typeof WMHEX_HRATIO === 'number' ? WMHEX_HRATIO : 0.5625) / 0.75; }
function wmapPnlMiniH(size, px) { return Math.ceil(px * wmapPnlMiniRatio()); }
function wmapPnlMiniUV(u, v, size, px) { var a = px / (2 * size); return { x: px / 2 + (u - v) * a, y: (u + v) * a * wmapPnlMiniRatio() }; }
function wmapPnlMiniXY(gi, size, px) { var c = gi % size; return wmapPnlMiniUV(c + 0.5, (gi - c) / size + 0.5, size, px); }
function wmapPnlMiniRaw(x, y, size, px) {   // 迷你地圖像素 → 格(不夾範圍,可能 < 0 或 ≥ size)
  var a = px / (2 * size), X = (x - px / 2) / a, Y = y / (a * wmapPnlMiniRatio()), h = wmHexRound((X + Y) / 2 - 0.5, (Y - X) / 2 - 0.5);
  return { c: h.c, r: h.r };
}
function wmapPnlMiniCell(x, y, size, px) {
  var p = wmapPnlMiniRaw(x, y, size, px), c = Math.max(0, Math.min(size - 1, p.c)), r = Math.max(0, Math.min(size - 1, p.r));
  return r * size + c;
}
function wmapPnlPowerText() {
  var c;
  try {
    if (typeof wmapGoUiCtx !== 'function' || typeof wmapSettlePower !== 'function') return '';
    c = wmapGoUiCtx();
    return c ? wmapPnlFmtNum(wmapSettlePower(c.W, c.cs)) : '';
  } catch (e) { return ''; }
}

// ───────── UI 小工具 ─────────
function wmapPnlEl(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt !== undefined && txt !== null) e.textContent = txt; return e; }
function wmapPnlAdd(el, ev, fn, opt) { el.addEventListener(ev, fn, opt || false); WMAPPNL.binds.push([el, ev, fn, opt || false]); }
function wmapPnlStop(el) { ['pointerdown', 'pointerup'].forEach(function (ev) { el.addEventListener(ev, function (x) { x.stopPropagation(); }); }); }
function wmapPnlCtx() { return typeof wmapGoUiCtx === 'function' ? wmapGoUiCtx() : null; }
function wmapPnlToast(m) { if (typeof wmapGoUiToast === 'function') wmapGoUiToast(m); }
function wmapPnlSetText(el, s) { if (el && el.textContent !== s) el.textContent = s; }
function wmapPnlLs(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { /* 面板收合記不住也沒關係 */ } return null; }

// ───────── 部隊面板 ─────────
function wmapPnlBuildPanel(root) {
  var p = wmapPnlEl('div', 'wp-panel'), h = wmapPnlEl('button', 'wp-head'), l = wmapPnlEl('div', 'wp-list');
  h.setAttribute('type', 'button'); h.setAttribute('aria-label', '部隊面板收合');
  h.appendChild(wmapPnlEl('span', 'wp-ht', '部隊'));
  h.appendChild(wmapPnlEl('span', 'wp-hs', ''));
  h.appendChild(wmapPnlEl('i', 'wp-hc'));
  p.appendChild(h); p.appendChild(l);
  root.appendChild(p);
  wmapPnlStop(p);
  wmapPnlAdd(h, 'click', function () { WMAPPNL.open = !WMAPPNL.open; wmapPnlLs(WMAPPNL_CFG.key, WMAPPNL.open ? '1' : '0'); wmapPnlOpenApply(); });
  wmapPnlAdd(l, 'click', wmapPnlOnListClick);
  WMAPPNL.panel = p; WMAPPNL.head = h; WMAPPNL.list = l;
}
function wmapPnlOpenApply() {
  if (!WMAPPNL.panel) return;
  WMAPPNL.panel.classList.toggle('shut', !WMAPPNL.open);
  WMAPPNL.head.setAttribute('aria-expanded', WMAPPNL.open ? 'true' : 'false');
}
function wmapPnlFaceOf(n, now) {
  var inf, src = '';
  try { inf = typeof ldHomeTeamInfo === 'function' ? ldHomeTeamInfo(n, now) : null; if (inf && inf.main && typeof ldHomeFaceSrc === 'function') src = ldHomeFaceSrc(inf.main); } catch (e) { src = ''; }
  return src;
}
function wmapPnlRowBuild(row, now) {
  var b = wmapPnlEl('div', 'wp-row k-' + row.key + (WMAPPNL.sel && row.tripId === WMAPPNL.sel ? ' sel' : '')), f = wmapPnlEl('span', 'wp-face'), src = wmapPnlFaceOf(row.n, now), im, m, i, bt, t;
  b.setAttribute('data-n', String(row.n));
  if (src) { im = wmapPnlEl('img'); im.setAttribute('alt', ''); im.setAttribute('draggable', 'false'); im.onerror = function () { if (im.parentNode) im.parentNode.removeChild(im); }; im.src = src; f.appendChild(im); }
  b.appendChild(f);
  m = wmapPnlEl('span', 'wp-main');
  t = wmapPnlEl('span', 'wp-l1');
  t.appendChild(wmapPnlEl('b', 'wp-nm', row.name));
  t.appendChild(wmapPnlEl('em', 'wp-tm', ''));
  m.appendChild(t);
  m.appendChild(wmapPnlEl('span', 'wp-l2', row.label + (row.target ? '・' + row.target : '')));
  if (row.cmds.length) {
    t = wmapPnlEl('span', 'wp-cmd');
    for (i = 0; i < row.cmds.length; i++) {
      bt = wmapPnlEl('button', 'wp-cb' + (row.cmds[i].k === 'retreat' ? ' warn' : ''), row.cmds[i].t);
      bt.setAttribute('type', 'button'); bt.setAttribute('data-wpc', row.cmds[i].k); bt.setAttribute('data-id', row.tripId);
      if (row.cd > 0) bt.disabled = true;
      t.appendChild(bt);
    }
    m.appendChild(t);
  }
  b.appendChild(m);
  return b;
}
function wmapPnlRender(c, now) {
  var teams = typeof wdTeams === 'function' ? wdTeams() : [], rows = wmapPnlRows(c.W, c.cs, teams, now, WMAP.WG), sig, i, row, el, out = 0, cap = 5, tm;
  try { if (typeof fameTeamCap === 'function') cap = fameTeamCap(); } catch (e) { cap = 5; }
  rows = rows.filter(function (r) { return r.n <= cap; });
  sig = rows.map(function (r) { return wmapPnlRowSig(r) + (WMAPPNL.sel && r.tripId === WMAPPNL.sel ? 's' : ''); }).join('#');
  if (sig !== WMAPPNL.rowsSig) {
    WMAPPNL.rowsSig = sig; WMAPPNL.rowEls = {};
    WMAPPNL.list.innerHTML = '';
    for (i = 0; i < rows.length; i++) {
      el = wmapPnlRowBuild(rows[i], now);
      el.setAttribute('data-sig', wmapPnlRowSig(rows[i]));
      WMAPPNL.list.appendChild(el);
      WMAPPNL.rowEls[rows[i].n] = el;
    }
    if (!rows.length) WMAPPNL.list.appendChild(wmapPnlEl('div', 'wp-none', '還沒有編好的隊伍'));
  }
  for (i = 0; i < rows.length; i++) {
    row = rows[i]; el = WMAPPNL.rowEls[row.n];
    if (row.tripId) out++;
    if (!el) continue;
    tm = el.querySelector('.wp-tm');
    wmapPnlSetText(tm, row.ms > 0 ? wmapPnlDur(row.ms) : '');
    el.__row = row;
  }
  wmapPnlSetText(WMAPPNL.head.querySelector('.wp-hs'), out ? '外出 ' + out + '/' + rows.length : '全在城');
  WMAPPNL.rows = rows;
}
function wmapPnlOnListClick(ev) {
  var t = ev.target, row = null, id, n, i;
  if (t && t.getAttribute && t.getAttribute('data-wpc')) { wmapPnlCmd(t.getAttribute('data-wpc'), t.getAttribute('data-id')); ev.stopPropagation(); return; }
  while (t && t !== WMAPPNL.list && !(t.getAttribute && t.getAttribute('data-n'))) t = t.parentNode;
  if (!t || t === WMAPPNL.list) return;
  n = +t.getAttribute('data-n');
  for (i = 0; i < (WMAPPNL.rows || []).length; i++) if (WMAPPNL.rows[i].n === n) row = WMAPPNL.rows[i];
  if (!row) return;
  id = row.tripId || null;
  if (id && WMAPPNL.sel === id) { wmapPnlSelect(null); return; }
  wmapPnlFocus(id);
  wmapPnlSelect(id);
}
// 面板下指令:暫時把 WMAPGO.menuId 指到這隊,交給 wmapGoUiCmd(提示 / 入帳 / 存檔 / 重畫都沿用)
function wmapPnlCmd(kind, id) {
  var old, ok = false;
  if (typeof wmapGoUiCmd !== 'function' || typeof WMAPGO === 'undefined' || !id) return false;
  old = WMAPGO.menuId;
  WMAPGO.menuId = id;
  try { ok = wmapGoUiCmd(kind); } finally { if (WMAPGO.menuId === id) WMAPGO.menuId = old; }
  wmapPnlTick();
  return ok;
}
function wmapPnlSelect(id) {
  var L = typeof WMAPGO !== 'undefined' && WMAPGO.att && WMAPGO.att.layer;
  WMAPPNL.sel = id || null;
  WMAPPNL.selFrom = id ? 'panel' : '';
  if (L && !(typeof WMAPGO !== 'undefined' && WMAPGO.menuId)) { L.setSel(id || null); L.redraw(); }
  WMAPPNL.rowsSig = '';   // 選取列換外觀:下一次 render 重建
  wmapPnlTick();
}
function wmapPnlFocus(id) {
  var c = wmapPnlCtx(), now, i, row = null, rows = WMAPPNL.rows || [];
  if (!c || !WMAP.WG) return false;
  now = ldNow();
  for (i = 0; i < rows.length; i++) if (id ? rows[i].tripId === id : !rows[i].tripId) { row = rows[i]; break; }
  if (id && row && row.c >= 0) { wmapSetCam(row.c + 0.5, row.r + 0.5); return true; }
  if (id) return false;
  wmapSetCam(WMAP.WG.cx + 0.5, WMAP.WG.cy + 0.5);
  return true;
}

// ───────── 倒數浮條 ─────────
function wmapPnlBuildCd(root) {
  var e = wmapPnlEl('div', 'wp-cd');
  e.hidden = true;
  e.setAttribute('role', 'status');
  root.appendChild(e);
  wmapPnlStop(e);
  wmapPnlAdd(e, 'click', function (ev) {
    var t = ev.target, gi;
    while (t && t !== e && !(t.getAttribute && t.getAttribute('data-gi'))) t = t.parentNode;
    if (!t || t === e) return;
    gi = +t.getAttribute('data-gi');
    if (gi >= 0 && WMAP.WG) wmapSetCam((gi % WMAP.WG.size) + 0.5, Math.floor(gi / WMAP.WG.size) + 0.5);
  });
  WMAPPNL.cd = e;
}
function wmapPnlCdRender(c, now) {
  var list = wmapPnlCdList(c.W, now, WMAP.WG ? WMAP.WG.size : 64, WMAP.WG), show = list.slice(0, WMAPPNL_CFG.cdMax), more = list.length - show.length, sig, i, chip, k;
  sig = show.map(function (x) { return x.kind + ':' + x.id + ':' + x.label; }).join('#') + '+' + more;
  if (sig !== WMAPPNL.cdSig) {
    WMAPPNL.cdSig = sig; WMAPPNL.cdEls = [];
    WMAPPNL.cd.innerHTML = '';
    for (i = 0; i < show.length; i++) {
      k = show[i];
      chip = wmapPnlEl('span', 'wp-chip k-' + k.kind);
      if (k.gi >= 0) { chip.setAttribute('data-gi', String(k.gi)); chip.classList.add('tap'); }
      chip.appendChild(wmapPnlEl('i', 'wp-ic'));
      chip.appendChild(wmapPnlEl('b', 'wp-cl', k.label));
      chip.appendChild(wmapPnlEl('em', 'wp-ct', ''));
      WMAPPNL.cd.appendChild(chip);
      WMAPPNL.cdEls.push(chip.lastChild);
    }
    if (more > 0) WMAPPNL.cd.appendChild(wmapPnlEl('span', 'wp-more', '+' + more));
  }
  for (i = 0; i < show.length; i++) wmapPnlSetText(WMAPPNL.cdEls[i], wmapPnlDur(show[i].ms));
  WMAPPNL.cd.hidden = !show.length;
}

// ───────── 頂列膠囊 ─────────
function wmapPnlBuildCaps() {
  var av = typeof SHELL !== 'undefined' && SHELL.btn ? SHELL.btn.av : null, top = av ? av.parentNode : null, box, defs = [['power', '勢力'], ['fame', '名聲']], i, b;
  if (!top || WMAPPNL.caps) return false;
  box = wmapPnlEl('div', 'wp-caps');
  for (i = 0; i < defs.length; i++) {
    b = wmapPnlEl('button', 'wp-cap k-' + defs[i][0]);
    b.setAttribute('type', 'button'); b.setAttribute('data-cap', defs[i][0]); b.setAttribute('aria-label', defs[i][1]);
    b.appendChild(wmapPnlEl('i', 'wp-ci'));
    b.appendChild(wmapPnlEl('span', 'wp-cv', '--'));
    box.appendChild(b);
    WMAPPNL.capEls[defs[i][0]] = b.lastChild;
  }
  top.insertBefore(box, av.nextSibling);
  wmapPnlAdd(box, 'click', function (ev) {
    var t = ev.target, k, c, p, used, cap;
    while (t && t !== box && !(t.getAttribute && t.getAttribute('data-cap'))) t = t.parentNode;
    if (!t || t === box) return;
    k = t.getAttribute('data-cap'); c = wmapPnlCtx();
    if (k === 'power') {
      if (!c) { wmapPnlToast('勢力:決定能占領幾塊領地'); return; }
      p = wmapSettlePower(c.W, c.cs); used = wmapSettleCount(c.W); cap = wmapSettleCap(c.W, c.cs);
      wmapPnlToast('勢力 ' + wmapPnlFmtNum(p) + ':決定占領上限(已占 ' + used + ' / 上限 ' + cap + ')');
    } else wmapPnlToast('名聲 ' + (typeof fameGet === 'function' ? wmapPnlFmtNum(fameGet()) : '--') + ':決定建築與功能開放(隊伍數、駐守上限)');
  });
  WMAPPNL.caps = box;
  return true;
}
function wmapPnlCapsRender() {
  var c = wmapPnlCtx(), p = '--', f = '--';
  try { if (c) p = wmapPnlFmtNum(wmapSettlePower(c.W, c.cs)); } catch (e) { p = '--'; }
  try { if (typeof fameGet === 'function') f = wmapPnlFmtNum(fameGet()); } catch (e2) { f = '--'; }
  wmapPnlSetText(WMAPPNL.capEls.power, p);
  wmapPnlSetText(WMAPPNL.capEls.fame, f);
}

// ───────── 地圖覆蓋:格框 / 營徽章(WMAP.world 內的 CSS 節點)─────────
function wmapPnlCellTop(gi) {
  var G = WMAP.G, N = G.size, c = gi % N, r = (gi - c) / N;
  return wmapCellTop(G, c, r);
}
function wmapPnlOvRender(c, now, force) {
  var sel = WMAPGO && WMAPGO.menuId ? WMAPGO.menuId : WMAPPNL.sel, o = wmapPnlOverlay(c.W, now, WMAP.WG, sel), G = WMAP.G, sig = G.s + ':' + o.frame + ':' + o.camps.join(','), t, i, el, w;
  if (sig === WMAPPNL.ovSig && !force) return;
  WMAPPNL.ovSig = sig;
  if (!WMAPPNL.frame) { WMAPPNL.frame = wmapPnlEl('div', 'wp-frame'); WMAPPNL.world.appendChild(WMAPPNL.frame); }
  if (o.frame >= 0) {
    t = wmapPnlCellTop(o.frame);
    WMAPPNL.frame.style.display = '';
    WMAPPNL.frame.style.width = G.W + 'px'; WMAPPNL.frame.style.height = G.H + 'px';
    WMAPPNL.frame.style.transform = 'translate(' + Math.round(t.x - G.W / 2) + 'px,' + Math.round(t.y) + 'px)';
  } else WMAPPNL.frame.style.display = 'none';
  w = Math.round(G.s * 0.62);
  for (i = 0; i < o.camps.length; i++) {
    el = WMAPPNL.campEls[i];
    if (!el) { el = WMAPPNL.campEls[i] = wmapPnlEl('div', 'wp-camp'); el.appendChild(wmapPnlEl('i')); WMAPPNL.world.appendChild(el); }
    t = wmapPnlCellTop(o.camps[i]);
    el.style.display = ''; el.style.width = w + 'px'; el.style.height = w + 'px';
    el.style.transform = 'translate(' + Math.round(t.x - w * 0.95) + 'px,' + Math.round(t.y + G.H * 0.5 - w * 0.92) + 'px)';
  }
  for (; i < WMAPPNL.campEls.length; i++) WMAPPNL.campEls[i].style.display = 'none';
}

// ───────── 迷你地圖 ─────────
function wmapPnlMiniBase() {
  var WG = WMAP.WG, N = WG.size, px = WMAPPNL_CFG.miniPx, ph = wmapPnlMiniH(N, px), cv = document.createElement('canvas'), g, im, d, i, k, p, x, y, col;
  cv.width = px; cv.height = ph;
  g = cv.getContext('2d');
  if (!g) return null;
  im = g.createImageData(px, ph); d = im.data;
  for (y = 0; y < ph; y++) for (x = 0; x < px; x++) {   // 逐像素反查所屬格;菱形外透明
    p = wmapPnlMiniRaw(x + 0.5, y + 0.5, N, px);
    if (p.c < 0 || p.r < 0 || p.c >= N || p.r >= N) continue;
    k = WG.k[p.r * N + p.c];
    col = k === 1 || k === 2 ? [118, 112, 104] : (k === 3 ? [96, 150, 190] : (k === 4 ? [150, 190, 200] : (k === 5 ? [196, 170, 120] : (k === 7 ? [60, 52, 44] : [110, 150, 92]))));
    i = (y * px + x) * 4; d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = 255;
  }
  g.putImageData(im, 0, 0);
  return cv;
}
function wmapPnlBuildMini(root) {
  var e = wmapPnlEl('div', 'wp-mini'), cv = wmapPnlEl('canvas', 'wp-mcv');
  var px = WMAPPNL_CFG.miniPx, ph = wmapPnlMiniH(WMAP.WG.size, px), sw = (root.clientWidth >= 600 ? WMAPPNL_CFG.miniShowWide : WMAPPNL_CFG.miniShow), sh = Math.ceil(sw * ph / px);
  cv.width = px; cv.height = ph;
  cv.style.width = sw + 'px'; cv.style.height = sh + 'px'; e.style.width = (sw + 8) + 'px'; e.style.height = (sh + 8) + 'px';   // 覆蓋 CSS 的 72×72 正方形:菱形約 2.67 : 1;窄螢幕(< 600)維持 72 寬避免壓到「主線」鈕,橫向 120 寬
  cv.setAttribute('aria-label', '迷你地圖');
  e.appendChild(cv); root.appendChild(e);
  wmapPnlStop(e);
  wmapPnlAdd(e, 'click', function (ev) {
    var r = cv.getBoundingClientRect(), gi, N = WMAP.WG.size;
    if (!r.width) return;
    gi = wmapPnlMiniCell((ev.clientX - r.left) / r.width * cv.width, (ev.clientY - r.top) / r.height * cv.height, N, WMAPPNL_CFG.miniPx);
    wmapSetCam((gi % N) + 0.5, Math.floor(gi / N) + 0.5);
    WMAPPNL.miniSig = '';
    wmapPnlMiniRender(wmapPnlCtx(), ldNow());
  });
  WMAPPNL.mini = e; WMAPPNL.miniCv = cv;
  WMAPPNL.miniBase = wmapPnlMiniBase();
}
function wmapPnlMiniRender(c, now) {
  var cv = WMAPPNL.miniCv, g, WG = WMAP.WG, N, px = WMAPPNL_CFG.miniPx, k, p, i, tr, st, sig, cells = [], pose, pts = [], cam;
  if (!cv || !WG || !c) return;
  N = WG.size;
  for (k in (WMAP.own || {})) cells.push(+k);
  for (i = 0; i < c.W.trips.length; i++) {
    tr = c.W.trips[i];
    if (tr.rally) continue;
    st = wmapGoStatus(tr, now, WG);
    if (!st.lg) continue;
    pose = wmMarchAt(st.lg, now, N);
    if (pose.phase === 'done' || pose.phase === 'wait') continue;
    pts.push([Math.floor(pose.c), Math.floor(pose.r), st.phase === 'back' ? 1 : 0, pose.c, pose.r]);
  }
  cam = WMAP.cam;
  sig = cells.join(',') + '|' + pts.join(';') + '|' + Math.round(cam.u) + ',' + Math.round(cam.v);
  if (sig === WMAPPNL.miniSig) return;
  WMAPPNL.miniSig = sig;
  g = cv.getContext('2d');
  if (!g) return;
  g.clearRect(0, 0, cv.width, cv.height);
  if (WMAPPNL.miniBase) g.drawImage(WMAPPNL.miniBase, 0, 0);
  function quad(c0, r0, fw, fh) {   // c×r 矩形占地 → 菱形四角
    var q = [wmapPnlMiniUV(c0, r0, N, px), wmapPnlMiniUV(c0 + fw, r0, N, px), wmapPnlMiniUV(c0 + fw, r0 + fh, N, px), wmapPnlMiniUV(c0, r0 + fh, N, px)];
    g.beginPath(); g.moveTo(q[0].x, q[0].y); g.lineTo(q[1].x, q[1].y); g.lineTo(q[2].x, q[2].y); g.lineTo(q[3].x, q[3].y); g.closePath(); g.fill();
    return q;
  }
  g.fillStyle = '#d03a22';   // 已占領領地
  for (i = 0; i < cells.length; i++) { p = wmapPnlMiniXY(cells[i], N, px); g.fillRect(Math.floor(p.x) - 1, Math.floor(p.y) - 1, 3, 2); }
  for (i = 0; i < WG.nodes.length; i++) {   // 城池占地(縣青灰、郡 / 州黛藍、關灰褐)畫成菱形(c×r 矩形 = 螢幕菱形);不寫字
    k = WG.nodes[i]; g.fillStyle = k.type === 'jun' ? '#3f5d7a' : (k.type === 'pass' ? '#8f8676' : '#6f7f86');
    quad(k.c0, k.r0, k.fw, k.fh);
  }
  g.fillStyle = '#d03a22';   // 主城(外框 3×3 菱形,朱紅,深褐描邊)
  p = quad(WG.cx - 1, WG.cy - 1, 3, 3);
  g.strokeStyle = '#3b2410'; g.lineWidth = 1;
  g.beginPath(); g.moveTo(p[0].x, p[0].y); g.lineTo(p[1].x, p[1].y); g.lineTo(p[2].x, p[2].y); g.lineTo(p[3].x, p[3].y); g.closePath(); g.stroke();
  for (i = 0; i < pts.length; i++) {
    p = wmapPnlMiniUV(pts[i][3] + 0.5, pts[i][4] + 0.5, N, px);
    g.fillStyle = pts[i][2] ? '#9fb7c8' : '#ffffff'; g.fillRect(p.x - 1.5, p.y - 1.5, 3, 3); g.strokeStyle = '#1b1b1b'; g.strokeRect(p.x - 1, p.y - 1, 2, 2);
  }
  g.strokeStyle = '#ffffff'; g.lineWidth = 1;   // 鏡頭位置(十字)
  p = wmapPnlMiniUV(cam.u, cam.v, N, px);
  g.beginPath(); g.moveTo(p.x - 4, p.y); g.lineTo(p.x + 4, p.y); g.moveTo(p.x, p.y - 4); g.lineTo(p.x, p.y + 4); g.stroke();
}

// ───────── 計時 / 建置 ─────────
function wmapPnlTick() {
  var c, now;
  if (!WMAPPNL.inited || (typeof document !== 'undefined' && document.hidden)) return;
  c = wmapPnlCtx();
  if (!c || !WMAP.on || !WMAP.WG) return;
  now = ldNow();
  WMAPPNL.ticks++;
  // 選取同步:地圖上點軍隊旗開的選單(WMAPGO.menuId)也算選取;選的軍隊已回城 / 消失就取消
  if (WMAPPNL.sel && !wmapGoTripOf(c.W, WMAPPNL.sel)) { WMAPPNL.sel = null; WMAPPNL.selFrom = ''; WMAPPNL.rowsSig = ''; }
  wmapPnlRender(c, now);
  wmapPnlCdRender(c, now);
  wmapPnlOvRender(c, now, false);
  wmapPnlMiniRender(c, now);
  if (WMAPPNL.ticks === 1 || WMAPPNL.ticks % WMAPPNL_CFG.capEvery === 0) wmapPnlCapsRender();
}
function wmapPnlInit() {
  var z0, s0, v, col;
  if (WMAPPNL.inited || typeof document === 'undefined' || typeof WMAP === 'undefined' || !WMAP.on || !WMAP.root || !WMAP.WG || typeof WMAPGO === 'undefined' || !WMAPGO.inited) return false;
  WMAPPNL.root = WMAP.root; WMAPPNL.world = WMAP.world;
  v = wmapPnlLs(WMAPPNL_CFG.key);
  WMAPPNL.open = v !== '0';
  col = wmapPnlEl('div', 'wp-col');
  WMAP.root.appendChild(col);
  wmapPnlBuildPanel(col);
  wmapPnlBuildCd(col);
  wmapPnlBuildMini(WMAP.root);
  wmapPnlBuildCaps();
  wmapPnlOpenApply();
  WMAPPNL.inited = true;
  if (!WMAPPNL.hooked) {   // 縮放後格框 / 徽章尺寸要跟著換;點地圖格 = 取消面板選取
    WMAPPNL.hooked = true;
    if (typeof wmapSetZoom === 'function') { z0 = wmapSetZoom; wmapSetZoom = function (i, ax, ay) { z0(i, ax, ay); if (WMAPPNL.inited) { WMAPPNL.ovSig = ''; wmapPnlTick(); } }; }
    if (typeof wmapSelect === 'function') { s0 = wmapSelect; wmapSelect = function (gi) { if (gi >= 0 && WMAPPNL.sel) { WMAPPNL.sel = null; WMAPPNL.selFrom = ''; WMAPPNL.rowsSig = ''; } s0(gi); if (WMAPPNL.inited) wmapPnlTick(); }; }
  }
  wmapPnlAdd(document, 'visibilitychange', function () { if (!document.hidden) wmapPnlTick(); });
  if (typeof setInterval === 'function') WMAPPNL.tid = setInterval(wmapPnlTick, 1000);
  wmapPnlTick();
  return true;
}

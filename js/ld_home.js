// js/ld_home.js — 新首頁(骨架第 1 階段;設計_介面骨架實作計畫.md §3-3、任務卡 1)。前綴 ldHome / LD_BLD / LDH。
// 由 shell.js 在旗標 ldui 開啟時呼叫:ldHomeInit(sceneEl) 建 9 塊建築木牌層、3 格隊伍欄、金 / 綠圓鈕與圓鈕列;ldHomeLayout() 依場景尺寸 / 方向重排;ldHomeRefresh() 每秒更新紅點與隊伍狀態。
// 另登錄兩個堆疊頁:'event'(活動)、'quest'(任務,空頁)。素材走 ld_art.js(has:false → CSS 佔位 + 單一漢字徽章)。ES2017,不用 ?. ??。
// 木牌座標單位:背景圖寬高的百分比;木牌以中心點定位(寬 64、高 60)。舊背景(assets/ui 的 home_bg_*)用 old 座標,新背景(bg_home2_*,has:true)用 new 座標。
var LDH_PLQ_W = 64, LDH_PLQ_H = 60, LDH_MIN_D = 48, LDH_COL_W = 200, LDH_COL_GAP = 8, LDH_DOCK_LAND_H = 60;
// 9 塊建築:act 為 shellAct 字串;fn 為特殊動作;lock 有字 = 灰色 + 小字(點了只出 Toast)。P = 直式、L = 橫式;new 座標 = 2026-11-14 接圖後依 bg_home2_port / bg_home2_land 實際建築中心量的(橫式建築都在圖左 ~70%,右側草地留給隊伍欄)。
var LD_BLD = [
  { id: 'tavern', n: '招賢館', art: 'bld_zhao', act: 'cards:D', P: { old: [17, 26], 'new': [78, 41] }, L: { old: [25, 27], 'new': [37, 50] } },
  { id: 'hall', n: '城主府', art: 'bld_fu', lock: '即將開放', P: { old: [50, 23], 'new': [50, 22] }, L: { old: [50, 24], 'new': [38, 24] } },
  { id: 'acad', n: '書院', art: 'bld_shu', fn: 'study', P: { old: [82, 28], 'new': [10, 25] }, L: { old: [73, 28], 'new': [18, 36] } },
  { id: 'tower', n: '高塔', dorm: 'tower', art: 'bld_ta', fn: 'tower', P: { old: [80, 11], 'new': [85, 23] }, L: { old: [82, 12], 'new': [62, 26] } },
  { id: 'yard', n: '校場', art: 'bld_chang', fn: 'yard', P: { old: [17, 42], 'new': [20, 43] }, L: { old: [22, 47], 'new': [24, 47] } },
  { id: 'camp', n: '軍營', art: 'bld_ying', fn: 'camp', P: { old: [48, 46], 'new': [82, 56] }, L: { old: [50, 51], 'new': [60, 50] } },
  { id: 'forge', n: '鍛造坊', art: 'bld_fang', fn: 'forge', P: { old: [83, 44], 'new': [19, 62] }, L: { old: [80, 47], 'new': [15, 72] } },
  { id: 'arena', n: '擂台', art: 'bld_tai', act: 'tour', P: { old: [76, 57], 'new': [85, 64] }, L: { old: [80, 69], 'new': [61, 72] } },
  { id: 'gate', n: '城門', art: 'bld_men', fn: 'gate', P: { old: [50, 67], 'new': [50, 68] }, L: { old: [50, 80], 'new': [40, 73] } }
];
// 目前有效的建築清單:休眠功能(dorm)關閉時整塊排除(不建木牌、不佔版面;高塔 FEATURES.tower)
function ldHomeBlds() { return LD_BLD.filter(function (b) { return !b.dorm || (typeof featureOn === 'function' && featureOn(b.dorm)); }); }   // @DORMANT tower
var LDH = { scene: null, root: null, layer: null, team: null, band: null, rg: null, rb: null, plq: {}, dot: {}, tm: [], key: '', dkey: '', geo: null, dbg: false };

// ───────── 純函式 ─────────
// 座標換算:背景圖以 cover 縮放鋪滿 vw × vh 的場景(置中裁切),pct = 圖上百分比 [x, y] → 木牌中心點(場景座標)。
// topH / botH = 場景內預留的上 / 下高度(場景本身已在頂列之下則 topH = 0);木牌中心 y 不得小於 topH + 8 + 半高、不得大於 vh - botH - 4 - 半高;x 夾在 [半寬, vw - 半寬]。
function ldHomePlace(vw, vh, topH, iw, ih, pct, botH) {
  var s = Math.max(vw / iw, vh / ih), ox = (vw - iw * s) / 2, oy = (vh - ih * s) / 2, hx = LDH_PLQ_W / 2, hy = LDH_PLQ_H / 2, x, y, lo, hi;
  x = ox + iw * s * pct[0] / 100;
  y = oy + ih * s * pct[1] / 100;
  x = Math.min(vw - hx, Math.max(hx, x));
  lo = (topH || 0) + 8 + hy;
  hi = vh - (botH || 0) - 4 - hy;
  y = Math.max(lo, y);
  if (hi >= lo) y = Math.min(hi, y);
  return { x: Math.round(x), y: Math.round(y) };
}
// 反向:場景座標 → 圖上百分比(?plqdbg=1 用)
function ldHomeUnplace(vw, vh, iw, ih, px, py) {
  var s = Math.max(vw / iw, vh / ih), ox = (vw - iw * s) / 2, oy = (vh - ih * s) / 2;
  return { x: Math.round((px - ox) / (iw * s) * 1000) / 10, y: Math.round((py - oy) / (ih * s) * 1000) / 10 };
}
// 夾到範圍後若兩塊木牌矩形重疊(寬 w + 間隙、高 h + 間隙)或中心太近(< minD),沿重疊較小的軸互相推開(最多 60 輪),再夾回範圍;回新陣列
function ldHomeSpread(pts, minD, box) {
  var out = pts.map(function (p) { return { x: p.x, y: p.y }; }), k, i, j, dx, dy, d, push, a, b, w = LDH_PLQ_W + 2, h = LDH_PLQ_H + 2, ox, oy, m;
  function clamp(p) { p.x = Math.min(box.x1, Math.max(box.x0, p.x)); p.y = Math.min(box.y1, Math.max(box.y0, p.y)); }
  for (k = 0; k < 60; k++) {
    push = false;
    for (i = 0; i < out.length; i++) for (j = i + 1; j < out.length; j++) {
      a = out[i]; b = out[j]; dx = b.x - a.x; dy = b.y - a.y;
      ox = w - Math.abs(dx); oy = h - Math.abs(dy);
      if (ox > 0 && oy > 0) {
        push = true;
        if (ox <= oy) { m = ox / 2 + 0.5; if (dx >= 0) { a.x -= m; b.x += m; } else { a.x += m; b.x -= m; } }
        else { m = oy / 2 + 0.5; if (dy >= 0) { a.y -= m; b.y += m; } else { a.y += m; b.y -= m; } }
        clamp(a); clamp(b);
        continue;
      }
      d = Math.sqrt(dx * dx + dy * dy);
      if (d >= minD) continue;
      push = true;
      if (d < 0.5) { dx = 0; dy = 1; d = 1; }
      a.x -= dx / d * (minD - d) / 2; a.y -= dy / d * (minD - d) / 2;
      b.x += dx / d * (minD - d) / 2; b.y += dy / d * (minD - d) / 2;
      clamp(a); clamp(b);
    }
    if (!push) break;
  }
  return out.map(function (p) { return { x: Math.round(p.x), y: Math.round(p.y) }; });
}
// 橫式分區(場景座標;2026-11-15 橫版首頁外殼):木牌(連同鎖定小字)不得進入這幾塊。晶片(左上)、隊伍欄(右上)、金圓鈕(左下)、底列(底中)。
// 數據面板(隊伍欄左邊)是點「數據」才展開的浮層(soft:true):版面上列出位置,但不拿來排擠木牌(否則高塔 / 軍營會離開自己的建築),展開時蓋在木牌之上
var LDH_CHIP_W = 116, LDH_CHIP_H = 44, LDH_STAT_W = 200, LDH_STAT_H = 146, LDH_STAT_TOP = 56, LDH_ZONE_GAP = 8, LDH_LBL_H = 18;
// o = { chips: 目前晶片數(預設 2), teamRight: 隊伍欄離右緣 px(含安全區,預設 8), rgLeft: 金圓鈕離左緣 px(預設 8) }
function ldHomeZones(W, H, o) {
  var n, tr, rl, tl, sx1, z = [];
  o = o || {};
  n = o.chips === undefined ? 2 : o.chips; tr = o.teamRight === undefined ? 8 : o.teamRight; rl = o.rgLeft === undefined ? 8 : o.rgLeft;
  tl = W - tr - LDH_COL_W; sx1 = tl - 8;
  if (n > 0) z.push({ id: 'chips', x0: 0, y0: 0, x1: 6 + n * LDH_CHIP_W + (n - 1) * 6, y1: 6 + LDH_CHIP_H });
  z.push({ id: 'stat', soft: true, x0: sx1 - LDH_STAT_W, y0: LDH_STAT_TOP, x1: sx1, y1: LDH_STAT_TOP + LDH_STAT_H });
  z.push({ id: 'team', x0: tl, y0: 0, x1: W, y1: 5 + 3 * 64 + 2 * 6 });
  z.push({ id: 'rg', x0: 0, y0: H - 8 - 56, x1: rl + 56, y1: H });
  z.push({ id: 'dock', x0: (W - 440) / 2, y0: H - LDH_DOCK_LAND_H, x1: (W + 440) / 2, y1: H });
  return z;
}
// 木牌佔位矩形(中心 x,y):寬 w(鎖定小字比木牌寬時取字寬)、上 30、下 30 + ex(鎖定小字高)
function ldHomeRect(x, y, it) { return { x0: x - it.w / 2, x1: x + it.w / 2, y0: y - LDH_PLQ_H / 2, y1: y + LDH_PLQ_H / 2 + it.ex }; }
function ldHomeRectHit(a, b, gap) { return a.x0 < b.x1 + gap && a.x1 > b.x0 - gap && a.y0 < b.y1 + gap && a.y1 > b.y0 - gap; }
// 依序把每塊木牌放到「離期望點最近、且不碰分區與已放木牌(間隙 gap)」的位置(4px 格點搜尋);放不下 = 退回期望點。items[i] = { w, ex };box = { x0, x1, y0, y1 }(木牌佔位矩形必須在內)
function ldHomePack(want, items, zones, box, gap) {
  var out = [], placed = [], i, j, it, r, x, y, bx, by, bd, d, ok, lx0, lx1, ly0, ly1, w;
  for (i = 0; i < want.length; i++) {
    it = items[i]; w = want[i];
    lx0 = box.x0 + it.w / 2; lx1 = box.x1 - it.w / 2; ly0 = box.y0 + LDH_PLQ_H / 2; ly1 = box.y1 - LDH_PLQ_H / 2 - it.ex;
    bx = null; bd = 1e12;
    for (y = ly0; y <= ly1 + 0.01; y += 4) for (x = lx0; x <= lx1 + 0.01; x += 4) {
      d = (x - w.x) * (x - w.x) + (y - w.y) * (y - w.y);
      if (d >= bd) continue;
      r = ldHomeRect(x, y, it); ok = true;
      for (j = 0; ok && j < zones.length; j++) if (!zones[j].soft && ldHomeRectHit(r, zones[j], gap)) ok = false;
      for (j = 0; ok && j < placed.length; j++) if (ldHomeRectHit(r, placed[j], gap)) ok = false;
      if (ok) { bd = d; bx = x; by = y; }
    }
    if (bx === null) { bx = Math.min(lx1, Math.max(lx0, w.x)); by = Math.min(Math.max(ly0, ly1), Math.max(ly0, w.y)); }
    out.push({ x: Math.round(bx), y: Math.round(by) });
    placed.push(ldHomeRect(bx, by, it));
  }
  return out;
}
// 場景幾何:W × H = 場景尺寸;land = 橫式;newBg = 新背景已有圖;field = 背景 / 木牌可用寬度(橫式 + 舊背景時讓出右側隊伍欄);opt 見 ldHomeZones(另可帶 labels:{ 木牌id: 鎖定小字字數 })
function ldHomeGeo(W, H, land, newBg, opt) {
  var key = land ? 'bg_home2_land' : 'bg_home2_port', a = (typeof LD_ART !== 'undefined' && LD_ART[key]) || null, iw, ih, g, o = opt || {}, lb = {};
  if (newBg && a) { iw = a.w; ih = a.h; } else if (land) { iw = 1672; ih = 941; } else { iw = 941; ih = 1672; }
  g = { W: W, H: H, land: !!land, newBg: !!newBg, field: (land && !newBg) ? Math.max(120, W - LDH_COL_W - LDH_COL_GAP) : W, iw: iw, ih: ih, botH: land ? LDH_DOCK_LAND_H + 8 : 0, zones: null, labels: null };
  if (land) {
    g.zones = ldHomeZones(W, H, o);
    Object.keys(o.labels || {}).forEach(function (id) { var n = o.labels[id]; if (n > 0) lb[id] = { w: Math.min(100, n * 12 + 12), h: LDH_LBL_H }; });
    g.labels = lb;
  }
  return g;
}
// 回 [{id, x, y}](依 LD_BLD 順序);use = 'old' | 'new'。橫式:先換算期望點,再用 ldHomePack 避開分區(直式維持原本的 ldHomeSpread)
function ldHomeAll(geo, use) {
  var k = geo.land ? 'L' : 'P', pts = [], items = [], i, b, p, l, BL = ldHomeBlds();
  for (i = 0; i < BL.length; i++) { b = BL[i]; p = ldHomePlace(geo.field, geo.H, 0, geo.iw, geo.ih, b[k][use], geo.botH); pts.push(p); }
  if (geo.land && geo.zones) {
    for (i = 0; i < BL.length; i++) { l = geo.labels && geo.labels[BL[i].id]; items.push({ w: Math.max(LDH_PLQ_W, l ? l.w : 0), ex: l ? l.h : 0 }); }
    pts = ldHomePack(pts, items, geo.zones, { x0: 0, x1: geo.field, y0: 8, y1: geo.H - 4 }, LDH_ZONE_GAP);
  } else pts = ldHomeSpread(pts, LDH_MIN_D, { x0: LDH_PLQ_W / 2, x1: geo.field - LDH_PLQ_W / 2, y0: 8 + LDH_PLQ_H / 2, y1: Math.max(8 + LDH_PLQ_H / 2, geo.H - geo.botH - 4 - LDH_PLQ_H / 2) });
  return pts.map(function (p, n) { return { id: BL[n].id, x: p.x, y: p.y }; });
}
// 第 n 隊的顯示資料(全部有防呆:缺模組就用預設)。回 { n, locked, lockText, empty, main, subs, troop, ratio, state, stateText }
function ldHomeTeamInfo(n, now) {
  var o = { n: n, locked: false, lockText: '', empty: true, main: null, subs: [], troop: '', ratio: 1, state: '', stateText: '' }, cap = 3, team = null, list, i, p, slots, m, rest, st, W, cs;
  now = now || Date.now();
  try { if (typeof fameTeamCap === 'function') cap = fameTeamCap(); } catch (e) { cap = 3; }
  if (n > cap) {
    o.locked = true;
    try { o.lockText = typeof fameTeamLockText === 'function' ? fameTeamLockText(n) : ''; } catch (e2) { o.lockText = ''; }
    if (!o.lockText) o.lockText = '名聲不足';
    return o;
  }
  try {
    if (typeof wdTeams === 'function') { list = wdTeams(); for (i = 0; i < list.length; i++) if (list[i].n === n) team = list[i]; }
    if (!team && typeof bnTeamPresetGet === 'function') { p = bnTeamPresetGet(n); if (p && !p.empty && p.slots && p.slots.length) team = { n: n, name: p.name, slots: p.slots }; }
  } catch (e3) { team = null; }
  if (!team || !team.slots || !team.slots.length) return o;
  slots = team.slots.slice();
  m = slots[0];
  for (i = 0; i < slots.length; i++) if (slots[i].row === 2) m = slots[i];
  rest = slots.filter(function (s) { return s !== m; }).sort(function (a, b) { return b.row - a.row; });
  o.empty = false;
  o.main = ldHomeHero(m);
  o.troop = m.troop || '';
  o.subs = rest.slice(0, 2).map(ldHomeHero);
  try {
    W = (typeof WDUI !== 'undefined' && WDUI) ? WDUI.W : null; cs = (typeof WDUI !== 'undefined' && WDUI) ? WDUI.cs : null;
    if (W && cs && typeof wdTeamRatio === 'function') o.ratio = Math.max(0, Math.min(1, wdTeamRatio(W, cs, team.slots, now)));
    if (W && cs && typeof wdUiTeamState === 'function') {
      st = wdUiTeamState(W, cs, team, now);
      o.state = st.k || '';
      if (st.k === 'trip') o.stateText = '行軍';
      else if (st.k === 'hurt') o.stateText = '重傷';
      else if (st.k === 'busy') o.stateText = { garrison: '駐守', field: '外勤', appoint: '委任', lowtrp: '兵少' }[st.reason] || '';
    }
  } catch (e4) { /* 顯示用:失敗保持預設 */ }
  return o;
}
// 一個隊員的顯示資料:{ name, fig, troop };名字取名冊卡,缺則用預設隊伍記的 nm
function ldHomeHero(s) {
  var e = null, cs;
  try {
    if (typeof cardsGet === 'function' && typeof wdCard === 'function') { cs = cardsGet(); e = cs ? wdCard(cs, s.id) : null; }
    if (!e && typeof bnUiEntry === 'function') e = bnUiEntry(s.id);
  } catch (er) { e = null; }
  return { name: (e && e.name) || s.nm || '', fig: (e && e.fig) || '', troop: s.troop || '' };
}
// 頭像圖網址:有 fig 用全身圖,否則兵種圖;都沒有 = ''
function ldHomeFaceSrc(h) {
  if (!h) return '';
  if (h.fig) return 'assets/fullbody/' + h.fig + '.webp';
  if (typeof bnstTroopSrc === 'function' && h.troop) return bnstTroopSrc(h.troop);
  return '';
}
function ldHomeEl(tag, cls, txt) {
  var e = document.createElement(tag);
  if (cls) e.className = cls;
  if (txt !== undefined && txt !== null) e.textContent = txt;
  return e;
}
function ldHomeToast(m) { if (typeof showToast === 'function') { try { showToast(m); } catch (e) { /* 略過 */ } } }

// ───────── 動作 ─────────
// 校場:沿用地圖層的預備兵頁(wdOpen 再 wdUiPush({v:'rsv'});ctx 由 wdUiRsvCtx 提供)。地圖打不開 = Toast
function ldHomeYard() {
  var ok = false;
  if (typeof ldNavPush === 'function' && typeof LDNAV !== 'undefined' && LDNAV.reg.map) {   // 第 6 階段:地圖是堆疊舊頁,sub:'rsv' 直接進預備兵頁
    ok = ldNavPush('map', { sub: 'rsv' });
    if (!ok && ldNavDepth() < LDNAV.max) ldHomeToast('校場暫時無法開啟');
    return ok;
  }
  if (typeof shellOpenBattle === 'function') {
    ok = shellOpenBattle(function () {
      if (typeof wdOpen !== 'function' || wdOpen() === false) { ldHomeToast('校場暫時無法開啟'); return; }
      if (typeof rsvSettle === 'function') rsvSettle(Date.now());
      if (typeof wdUiPush === 'function') wdUiPush({ v: 'rsv' });
    });
  }
  return ok;
}
function ldHomeBldDo(b) {
  if (b.lock) { ldHomeToast(b.n + ':' + b.lock); return false; }
  if (b.fn === 'tower') return (typeof featureOn === 'function' && !featureOn('tower')) ? false : typeof ldNavPush === 'function' ? ldNavPush('tower') : false;   // @DORMANT tower
  if (b.fn === 'camp') return typeof ldNavPush === 'function' ? ldNavPush('team', { n: 1, mode: 'edit' }) : false;
  if (b.fn === 'yard') return ldHomeYard();
  if (b.fn === 'gate') return typeof ldNavPush === 'function' ? ldNavPush('battle') : false;   // 城門 = 新的滿版戰鬥入口頁(副本 / 對戰 / 戰報 / 擂台 / 訓練場 / 地圖)
  if (b.fn === 'study' || b.fn === 'forge') return typeof ldNavPush === 'function' ? ldNavPush(b.fn) : false;   // 書院(尋訪)/ 鍛造坊:js/ld_hunt_ui.js、ld_equip_forge_ui.js 登錄的頁
  if (b.act && typeof shellAct === 'function') return shellAct(b.act);
  return false;
}
function ldHomeTeamDo(n) {
  var i = ldHomeTeamInfo(n);
  if (i.locked) { ldHomeToast('第 ' + n + ' 隊:' + i.lockText); return false; }
  return typeof ldNavPush === 'function' ? ldNavPush('team', { n: n, mode: 'edit' }) : false;
}

// ───────── 建 DOM ─────────
function ldHomeInit(sceneEl) {
  var i, b, btn, root = sceneEl, rg, rb, tm, k, dot;
  if (!sceneEl || LDH.scene === sceneEl) return false;
  while (root && root.parentNode && root.id !== 'shellRoot') root = root.parentNode;
  LDH.scene = sceneEl; LDH.root = root;
  try { LDH.dbg = typeof location !== 'undefined' && /[?&]plqdbg=1/.test(location.search); } catch (e) { LDH.dbg = false; }
  LDH.layer = ldHomeEl('div', 'ldh-plqs');
  var BL = ldHomeBlds();
  for (i = 0; i < BL.length; i++) {
    b = BL[i];
    btn = ldHomeEl('button', 'ldh-plq' + (b.lock ? ' lock' : ''));
    btn.setAttribute('type', 'button');
    btn.setAttribute('data-bld', b.id);
    btn.setAttribute('aria-label', b.n + (b.lock ? '(' + b.lock + ')' : ''));
    btn.appendChild(ldArt(b.art, 'ldh-md'));
    btn.appendChild(ldHomeEl('span', 'ldh-nm', b.n));
    if (b.lock) btn.appendChild(ldHomeEl('span', 'ldh-soon', b.lock));   // 城主府「即將開放」:右上角小標,不蓋名稱
    dot = ldHomeEl('i', 'ldh-dot');
    dot.hidden = true;
    btn.appendChild(dot);
    LDH.dot[b.id] = dot;
    btn.addEventListener('click', ldHomeBldClick(b));
    LDH.layer.appendChild(btn);
    LDH.plq[b.id] = btn;
  }
  sceneEl.appendChild(LDH.layer);
  if (LDH.dbg) sceneEl.addEventListener('click', ldHomeDbgClick);
  // 隊伍欄
  LDH.team = ldHomeEl('div', 'ldh-team');
  LDH.tm = [];
  for (k = 1; k <= 3; k++) {
    tm = ldHomeEl('button', 'ldh-tm');
    tm.setAttribute('type', 'button');
    tm.setAttribute('data-team', String(k));
    tm.addEventListener('click', ldHomeTeamClick(k));
    LDH.team.appendChild(tm);
    LDH.tm.push(tm);
  }
  root.appendChild(LDH.team);
  // 圓鈕列(直式:木條 + 兩顆圓鈕;橫式:只剩兩顆圓鈕在左下 / 右下角)
  LDH.band = ldHomeEl('div', 'ldh-band');
  root.appendChild(LDH.band);
  rg = ldHomeEl('button', 'ldh-rb ldh-rg');
  rg.setAttribute('type', 'button'); rg.setAttribute('aria-label', '任務'); rg.setAttribute('data-rb', 'quest');
  rg.appendChild(ldArt('nav_quest', 'ldh-ric'));
  rg.addEventListener('click', function () { if (typeof ldNavPush === 'function') ldNavPush('quest'); });
  // 右側綠色「招募」圓鈕已移除(開的是舊抽卡畫面):圖示 nav_recruit 改給底列「卡包」,紅點由 shell.js 底列 dock 的卡包紅點顯示
  root.appendChild(rg);
  LDH.rg = rg;
  ldHomeRefresh();
  return true;
}
function ldHomeBldClick(b) { return function () { ldHomeBldDo(b); }; }
function ldHomeTeamClick(n) { return function () { ldHomeTeamDo(n); }; }
function ldHomeDbgClick(ev) {
  var g = LDH.geo, r, p, t = ev && ev.target;
  if (!g || !LDH.scene) return;
  while (t && t !== LDH.scene) { if (t.getAttribute && t.getAttribute('data-bld')) return; t = t.parentNode; }
  r = LDH.scene.getBoundingClientRect ? LDH.scene.getBoundingClientRect() : { left: 0, top: 0 };
  p = ldHomeUnplace(g.field, g.H, g.iw, g.ih, (ev.clientX || 0) - r.left, (ev.clientY || 0) - r.top);
  ldHomeToast((g.land ? '橫' : '直') + ' ' + (g.newBg ? 'new' : 'old') + ' [' + p.x + ', ' + p.y + ']');
}

// ───────── 版面 ─────────
function ldHomeWin() {
  return { w: (typeof window !== 'undefined' && window.innerWidth) || 0, h: (typeof window !== 'undefined' && window.innerHeight) || 0 };
}
// 橫式分區的實際參數:晶片數、隊伍欄離右緣(含安全區)、金圓鈕離左緣、鎖定木牌的小字字數(讀 DOM / 計算樣式;缺 API 時用預設)
function ldHomeZoneOpt() {
  var o = { labels: {} }, cs, v, id, el, lk;
  try {
    if (LDH.scene && LDH.scene.querySelectorAll) o.chips = LDH.scene.querySelectorAll('.ldo-chip').length;
    if (typeof getComputedStyle === 'function') {
      if (LDH.team) { cs = getComputedStyle(LDH.team); v = parseFloat(cs.right); if (v === v) o.teamRight = v; }
      if (LDH.rg) { cs = getComputedStyle(LDH.rg); v = parseFloat(cs.left); if (v === v) o.rgLeft = v; }
    }
    for (id in LDH.plq) {
      el = LDH.plq[id]; lk = el && el.querySelector ? el.querySelector('.ldo-lktx') : null;
      if (lk && !lk.hidden && lk.textContent) o.labels[id] = lk.textContent.length;
    }
  } catch (e) { /* 量測失敗:用預設 */ }
  return o;
}
function ldHomeLayout() {
  var sc = LDH.scene, win = ldHomeWin(), land = win.w > win.h, W, H, newBg, g, pts, i, p, bg;
  if (!sc) return false;
  W = sc.clientWidth || win.w; H = sc.clientHeight || win.h;
  newBg = typeof ldArtHas === 'function' && ldArtHas(land ? 'bg_home2_land' : 'bg_home2_port');
  g = ldHomeGeo(W, H, land, newBg, land ? ldHomeZoneOpt() : null);
  LDH.geo = g;
  bg = (typeof SHELL !== 'undefined' && SHELL) ? SHELL.bgEl : null;
  if (bg && bg.style) bg.style.width = (land && !newBg) ? g.field + 'px' : '';
  LDH.layer.style.width = g.field + 'px';
  pts = ldHomeAll(g, newBg ? 'new' : 'old');
  for (i = 0; i < pts.length; i++) {
    p = LDH.plq[pts[i].id];
    p.style.left = pts[i].x + 'px';
    p.style.top = pts[i].y + 'px';
  }
  return true;
}

// ───────── 刷新(每秒):紅點、隊伍欄(內容有變才重畫) ─────────
function ldHomeRefresh() {
  var evs = [], i, key, dots = { tavern: false, arena: false }, ti = [], now = Date.now(), n;
  if (!LDH.scene) return false;
  try { if (typeof shellEvents === 'function') evs = shellEvents(now); } catch (e) { evs = []; }
  for (i = 0; i < evs.length; i++) {
    if (!evs[i].dot) continue;
    if (evs[i].id === 'tour') dots.arena = true;
    else dots.tavern = true;
  }
  key = JSON.stringify(dots);
  if (key !== LDH.dkey) {
    LDH.dkey = key;
    if (LDH.dot.tavern) LDH.dot.tavern.hidden = !dots.tavern;
    if (LDH.dot.arena) LDH.dot.arena.hidden = !dots.arena;
  }
  for (n = 1; n <= 3; n++) ti.push(ldHomeTeamInfo(n, now));
  key = JSON.stringify(ti.map(function (t) { return [t.locked, t.lockText, t.empty, t.main, t.subs, t.troop, Math.round(t.ratio * 100), t.stateText]; }));
  if (key !== LDH.key) {
    LDH.key = key;
    for (i = 0; i < 3; i++) ldHomeTeamFill(LDH.tm[i], ti[i]);
  }
  return true;
}
function ldHomeHexFace(h, cls) {
  var f = ldHomeEl('span', 'ldh-face ' + cls, h && h.name ? h.name.charAt(0) : ''), src = ldHomeFaceSrc(h), im;
  if (src && typeof Image !== 'undefined') {
    im = new Image();
    im.onload = function () { f.style.backgroundImage = 'url(' + src + ')'; f.classList.add('has'); };
    im.src = src;
  }
  return f;
}
function ldHomeTeamFill(btn, t) {
  var i, hp, tag, fill;
  if (!btn) return;
  btn.innerHTML = '';
  btn.className = 'ldh-tm' + (t.locked ? ' lock' : '') + (t.empty && !t.locked ? ' empty' : '') + (t.state ? ' st-' + t.state : '');
  btn.setAttribute('aria-label', '隊伍 ' + t.n + (t.locked ? ' ' + t.lockText : ''));
  btn.appendChild(ldHomeEl('span', 'ldh-no', String(t.n)));
  if (t.locked) {
    btn.appendChild(ldHomeEl('span', 'ldh-face lockf', '鎖'));
    btn.appendChild(ldHomeEl('span', 'ldh-lkt', t.lockText));
    return;
  }
  if (t.empty) {
    btn.appendChild(ldHomeEl('span', 'ldh-face addf', '＋'));
    btn.appendChild(ldHomeEl('span', 'ldh-lkt', '點此編隊'));
    return;
  }
  btn.appendChild(ldHomeHexFace(t.main, 'main'));
  btn.appendChild(ldHomeEl('span', 'ldh-tr', t.troop || '兵'));
  tag = ldHomeEl('span', 'ldh-tg', t.stateText || '');
  btn.appendChild(tag);
  for (i = 0; i < 2; i++) btn.appendChild(t.subs[i] ? ldHomeHexFace(t.subs[i], 'sub') : ldHomeEl('span', 'ldh-face sub nul', ''));
  hp = ldHomeEl('span', 'ldh-hp' + (t.ratio < 0.34 ? ' lo' : (t.ratio < 0.67 ? ' mid' : '')));
  fill = ldHomeEl('i', '');
  fill.style.width = Math.round(t.ratio * 100) + '%';
  hp.appendChild(fill);
  btn.appendChild(hp);
}

// ───────── 堆疊頁:活動、任務 ─────────
function ldHomeEventRows() {
  var rows = [], evs = [], i;
  try { if (typeof shellEvents === 'function') evs = shellEvents(Date.now()); } catch (e) { evs = []; }
  for (i = 0; i < evs.length; i++) rows.push({ k: evs[i].label, sub: evs[i].sub || '', act: evs[i].act, dot: !!evs[i].dot, art: evs[i].id === 'tour' ? 'bld_tai' : 'nav_cards' });
  rows.push({ k: '切磋(對戰碼)', sub: '用對戰碼和朋友比一場', act: 'share', dot: false, art: 'nav_event' });
  return rows;
}
function ldHomeEventBuild(el) {
  var panel = ldHomeEl('div', 'ldp-panel ldh-list'), rows = ldHomeEventRows(), i, r, b, tx;
  for (i = 0; i < rows.length; i++) {
    r = rows[i];
    b = ldHomeEl('button', 'ldh-row');
    b.setAttribute('type', 'button');
    b.setAttribute('data-act', r.act);
    b.appendChild(ldArt(r.art, 'ldh-rico'));
    tx = ldHomeEl('span', 'ldh-rtx');
    tx.appendChild(ldHomeEl('b', '', r.k));
    if (r.sub) tx.appendChild(ldHomeEl('small', '', r.sub));
    b.appendChild(tx);
    if (r.dot) b.appendChild(ldHomeEl('i', 'ldh-dot on'));
    b.addEventListener('click', ldHomeRowClick(r.act));
    panel.appendChild(b);
  }
  el.appendChild(panel);
}
// 這些動作開的是舊面板:shellAct 在 ld 模式下經 ldNavPush 把舊頁疊在活動頁上面(第 6 階段),× / 返回 / 手機返回鍵回到活動頁
function ldHomeRowClick(act) { return function () { if (typeof shellAct === 'function') shellAct(act); }; }
// ───────── 堆疊頁:戰鬥入口(城門)─────────
// 取代舊戰鬥層的入口選單(bnui 的 bnUiRenderEntry)。每項 = { id, k, sub, art, to, ctx, lock, stat, dot }:to = 堆疊頁 id;lock 有字 = 灰色、點了只出 Toast;stat = 狀態小字;dot = 紅點。
// 副本 / 對戰 / 戰報 / 擂台 / 地圖 都是依戰鬥層開的舊頁(ld_nav.js 的舊頁登錄,滿版、返回 = 退回本頁);訓練場 = 整隊頁(新頁,金鈕 = 練兵出戰)。
function ldHomeBattleRoster() {
  try { return typeof bnUnlocked === 'function' ? bnUnlocked() : true; } catch (e) { return true; }
}
function ldHomeBattleLogCount() {
  var raw = null, o = null;
  try {
    if (typeof BNLOG !== 'undefined' && BNLOG && BNLOG.key && typeof localStorage !== 'undefined') raw = localStorage.getItem(BNLOG.key);
    if (raw) o = JSON.parse(raw);
  } catch (e) { o = null; }
  return o && Array.isArray(o.recent) ? o.recent.length : 0;
}
function ldHomeBattleRows() {
  var rows = [], ok = ldHomeBattleRoster(), need = '卡包至少 ' + (typeof BNUI !== 'undefined' && BNUI.minRoster ? BNUI.minRoster : 3) + ' 人才能出戰', st, br, n, d, tot;
  if (typeof featureOn !== 'function' || featureOn('stages') || featureOn('shell')) {   // @DORMANT stages @DORMANT shell
    st = '';
    try {
      if (typeof bnMapStageStats === 'function' && typeof BN_STAGES !== 'undefined' && typeof bnUiLoad === 'function') { d = bnUiLoad(); tot = BN_STAGES.length; st = '討伐進度 ' + bnMapStageStats(d).cleared + '/' + tot; }
    } catch (e0) { st = ''; }
    rows.push({ id: 'stage', k: '副本', sub: '討伐地圖:選章節與關卡,首通有獎勵,可重複通關', art: 'pos_flag', to: 'stage', lock: ok ? '' : need, stat: st, dot: false });
  }
  rows.push({ id: 'share', k: '對戰', sub: '用對戰碼和朋友比一場(不計進度、不給獎勵)', art: 'nav_event', to: 'share', lock: ok ? '' : need, stat: '', dot: false });
  n = ldHomeBattleLogCount();
  rows.push({ id: 'log', k: '戰報', sub: '最近的戰報,可查看、重播與儲存', art: 'nav_log', to: 'log', lock: ok ? '' : need, stat: n ? '最近 ' + n + ' 場' : '還沒有戰報', dot: false });
  br = null;
  try { if (typeof bnTourBrief === 'function') br = bnTourBrief(Date.now()); } catch (e2) { br = null; }
  rows.push({ id: 'tour', k: '擂台', sub: '每日固定時間開賽,報名用代表隊伍;16 隊單淘汰,系統隊伍補滿', art: 'bld_tai', to: 'tour', lock: ok ? '' : need, stat: br ? br.stat : '', dot: !!(br && br.dot) });   // 擂台入口不鎖名聲(可進去觀看);名聲不足只是不能報名(bnTourLocked)
  rows.push({ id: 'prac', k: '訓練場', sub: '編隊後試打山賊:不計戰績、不給獎勵,敵將依我方戰力縮放', art: 'bld_chang', to: 'team', ctx: { n: 1, mode: 'edit' }, lock: '', stat: '', dot: false });
  if (typeof featureOn !== 'function' || (featureOn('worldmap') && featureOn('world'))) rows.push({ id: 'map', k: '地圖', sub: '派部隊占領資源點、討伐山寨野怪、集結攻城', art: 'bld_men', to: 'map', lock: ok ? '' : need, stat: '', dot: false });   // @DORMANT worldmap @DORMANT world
  return rows;
}
function ldHomeBattleBuild(el) {
  var rows = ldHomeBattleRows(), grid = ldHomeEl('div', 'ldb-grid'), i, r, b, tx;
  for (i = 0; i < rows.length; i++) {
    r = rows[i];
    b = ldHomeEl('button', 'ldb-card' + (r.lock ? ' lock' : ''));
    b.setAttribute('type', 'button');
    b.setAttribute('data-bt', r.id);
    b.setAttribute('aria-label', r.k + (r.lock ? '(' + r.lock + ')' : ''));
    b.appendChild(ldArt(r.art, 'ldb-ico'));
    tx = ldHomeEl('span', 'ldb-tx');
    tx.appendChild(ldHomeEl('b', '', r.k));
    tx.appendChild(ldHomeEl('small', 'ldb-sub', r.sub));
    if (r.lock) tx.appendChild(ldHomeEl('em', 'ldb-lk', '🔒 ' + r.lock));
    else if (r.stat) tx.appendChild(ldHomeEl('em', 'ldb-st', r.stat));
    b.appendChild(tx);
    if (r.dot) b.appendChild(ldHomeEl('i', 'ldh-dot on'));
    b.addEventListener('click', ldHomeBattleClick(r));
    grid.appendChild(b);
  }
  el.appendChild(grid);
}
function ldHomeBattleClick(r) {
  return function () {
    if (r.lock) { ldHomeToast(r.k + ':' + r.lock); return false; }
    return typeof ldNavPush === 'function' ? ldNavPush(r.to, r.ctx ? Object.assign({}, r.ctx) : undefined) : false;
  };
}
function ldHomeQuestBuild(el) {
  var panel = ldHomeEl('div', 'ldp-panel');
  panel.appendChild(ldHomeEl('div', 'ldp-empty', '任務系統準備中'));
  el.appendChild(panel);
}
if (typeof ldNavRegister === 'function') {
  ldNavRegister({ id: 'event', title: '活動', build: ldHomeEventBuild });
  ldNavRegister({ id: 'quest', title: '任務', build: ldHomeQuestBuild });
  ldNavRegister({ id: 'battle', title: '戰鬥', bg: 'sc_gate', build: ldHomeBattleBuild, onShow: function () { if (typeof ldNavRefresh === 'function') ldNavRefresh('battle'); } });
}
if (typeof module !== 'undefined' && module.exports) module.exports = { LD_BLD: LD_BLD, ldHomePlace: ldHomePlace, ldHomeBattleRows: ldHomeBattleRows };

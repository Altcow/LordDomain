// js/wmap_mob_ui.js — TR2 野怪介面(核心在 js/wmap_mob.js,純函式)。
// 做什麼:地圖上畫野怪標記(程式畫的小圖示:黑旗 + 1 / 2 / 3 個小兵表 Lv 段,地圖上沒有任何文字);點野怪格 → 沿用地塊小卡(WMAPGO.card)顯示「野怪 Lv・守軍戰力・去程」+〔剿匪〕(路過野怪不觸發戰鬥,只有按〔剿匪〕才會打);
//       〔剿匪〕→ 滿版頁 wmmob(選隊 + 勝算 + 預估時間)→〔剿匪〕;抵達 / 路過戰的結果走既有快報條(wmap_settle_ui.js 的 wmapSettleUiReports)與戰報頁。
// 每秒 tick 由 wmap_go_ui.js 的 wmapGoUiTick 之後呼叫(掛在 wmapGoUiInit 尾端的計時器之外,本檔自己 1 秒 interval 只刷新標記清單)。標記層是一張 canvas,放在行軍層下面(z-index 4),跟著 wmapFrame 同步。
// 掛鉤:wmap_go_ui.js 的 wmapGoUiInit 尾端呼叫 wmapMobUiInit();wmap_ui 無改動。ES2017,不用 ?. ??;UTF-8 + CRLF。載入順序:wmap_settle_ui.js 之後。全域名一律 wmapMobUi* / WMOBUI。
//
// ───────── 公開 API ─────────
//   wmapMobUiInit() → bool          建標記層 / 接地圖選取 / 小卡〔出征〕/ 1 秒刷新;旗標 wmap 關 / 地圖未掛 / 已建 = false
//   wmapMobUiRefresh()              重抓目前存活的野怪並重畫(出發 / 戰鬥後立刻更新)
//   wmapMobUiDraw()                 畫標記層(wmapFrame 每幀呼叫)
//   wmapMobUiSend(gi, teamN) → bool 直接派一隊打該格野怪
//   ldNav 頁 'wmmob'(ctx.gi = 野怪所在格)
//   WMOBUI                          狀態:{inited, cv, g, list, tid, sig}

var WMOBUI = { inited: false, cv: null, g: null, list: [], tid: 0, sig: '', hooked: false, binds: [] };

function wmapMobUiEl(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt !== undefined && txt !== null) e.textContent = txt; return e; }
function wmapMobUiOn() { return typeof WMAP !== 'undefined' && WMAP.on && !!WMAP.WG && typeof wmapMobAlive === 'function' && typeof wmapGoUiCtx === 'function'; }
function wmapMobUiMobAt(gi) {
  var i;
  for (i = 0; i < WMOBUI.list.length; i++) if (WMOBUI.list[i].gi === gi) return WMOBUI.list[i];
  return null;
}

// ───────── 標記層 ─────────
function wmapMobUiRefresh() {
  var c, list, sig;
  if (!wmapMobUiOn()) return;
  c = wmapGoUiCtx();
  if (!c) return;
  list = wmapMobAlive(c.W, ldNow(), WMAP.WG);
  sig = list.map(function (m) { return m.id + (m.locked ? 'L' : ''); }).join(',');
  WMOBUI.list = list;
  if (sig !== WMOBUI.sig) { WMOBUI.sig = sig; wmapMobUiDraw(); }
}
function wmapMobUiIcon(g, x, y, s, lv, locked) {
  var n = lv <= 3 ? 1 : (lv <= 6 ? 2 : 3), u = s * 0.11, i, ox, oy, k;
  g.save();
  g.globalAlpha = locked ? 0.55 : 1;
  g.fillStyle = 'rgba(0,0,0,.28)'; g.beginPath(); g.ellipse(x, y + u * 0.6, u * (2 + n * 0.9), u * 1.1, 0, 0, Math.PI * 2); g.fill();
  for (i = 0; i < n; i++) {   // 小兵:身 + 頭(由後往前排)
    k = n === 1 ? 0 : (i - (n - 1) / 2) * 2.2; ox = x + k * u; oy = y - Math.abs(k) * u * 0.25;
    g.fillStyle = '#2a2220'; g.fillRect(ox - u * 0.8, oy - u * 2.2, u * 1.6, u * 2.4);
    g.fillStyle = '#d9b48a'; g.beginPath(); g.arc(ox, oy - u * 2.9, u * 0.85, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#4a3a30'; g.fillRect(ox - u * 0.95, oy - u * 3.8, u * 1.9, u * 0.9);
  }
  g.strokeStyle = '#3b2c1c'; g.lineWidth = Math.max(1.5, u * 0.35);   // 旗杆 + 黑旗
  g.beginPath(); g.moveTo(x + u * 2.2 + n * u * 0.4, y); g.lineTo(x + u * 2.2 + n * u * 0.4, y - u * 8); g.stroke();
  g.fillStyle = '#16120f'; g.beginPath(); g.moveTo(x + u * 2.2 + n * u * 0.4, y - u * 8); g.lineTo(x + u * 2.2 + n * u * 0.4 + u * 3.6, y - u * 6.8); g.lineTo(x + u * 2.2 + n * u * 0.4, y - u * 5.4); g.closePath(); g.fill();
  g.fillStyle = '#b3402f'; g.beginPath(); g.arc(x + u * 2.2 + n * u * 0.4 + u * 1.3, y - u * 6.8, u * 0.5, 0, Math.PI * 2); g.fill();
  g.restore();
}
function wmapMobUiDraw() {
  var cv = WMOBUI.cv, g = WMOBUI.g, G, p, dpr, i, m, c, r, pos, N, vw, vh;
  if (!cv || !g || typeof WMAP === 'undefined' || !WMAP.on || !WMAP.G) return;
  G = WMAP.G; vw = WMAP.vw; vh = WMAP.vh; N = WMAP.N;
  dpr = Math.min((typeof window !== 'undefined' && window.devicePixelRatio) || 1, 1.5);
  if (cv.width !== Math.round(vw * dpr) || cv.height !== Math.round(vh * dpr)) { cv.width = Math.round(vw * dpr); cv.height = Math.round(vh * dpr); cv.style.width = vw + 'px'; cv.style.height = vh + 'px'; }
  p = wmapCamPx(G, WMAP.cam, vw, vh);
  g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, vw, vh);
  for (i = 0; i < WMOBUI.list.length; i++) {
    m = WMOBUI.list[i]; c = m.gi % N; r = (m.gi - c) / N;
    pos = wmapArmyProj(c, r, G.s, N);
    if (pos.x - p.px < -80 || pos.x - p.px > vw + 80 || pos.y - p.py < -80 || pos.y - p.py > vh + 80) continue;
    wmapMobUiIcon(g, pos.x - p.px, pos.y - p.py + G.s * 0.1, G.s, m.lv, m.locked);
  }
}

// ───────── 小卡 ─────────
function wmapMobUiCardShow(m) {
  var c = wmapGoUiCtx(), card = WMAPGO.card, now = ldNow(), tg, plan, pt, foe, sub, btns, N = WMAP.WG.size, cx = m.gi % N;
  if (!c || !card) return;
  tg = wmapMobTarget(WMAP.WG, m);
  pt = wdPt(c.W, m.id) || wmapMobMakePt(c.W, m);
  foe = wmapGoFoePower(c.W, pt);
  card.innerHTML = '';
  card.appendChild(wmapGoUiEl('div', 'wgc-t', '(' + cx + ',' + ((m.gi - cx) / N) + ') Lv' + m.lv + ' ' + m.ty));
  if (!tg.ok) sub = '超出行軍範圍';
  else {
    plan = wmapGoPlan(c.W, WMAP.WG, tg, null, now, { fast: wmapGoFast() });
    sub = '守軍戰力 ' + Math.round(foe) + '・去程約 ' + plan.goMins.toFixed(1) + ' 分・掉落 文 ' + wmapMobCoin(m.lv) + ' 糧 ' + wmapMobGrain(m.lv) + '・本批 ' + wmapMobUiHM(wmapMobBatchEnd(m.bk)) + ' 消失';
  }
  if (m.locked) sub = '已有隊伍前往・' + sub;
  card.appendChild(wmapGoUiEl('div', 'wgc-s', sub));
  btns = (m.locked || !tg.ok ? '' : '<button type="button" class="wgc-b pri" data-wgo="mobgo">剿匪</button>') + '<button type="button" class="wgc-b" data-wgo="x" aria-label="關閉">×</button>';
  card.insertAdjacentHTML('beforeend', '<div class="wgc-r">' + btns + '</div>');
  card.hidden = false;
  WMAPGO.cardGi = m.gi;
}
function wmapMobUiHM(t) { var d = new Date(t + 8 * 3600000), p = function (n) { return (n < 10 ? '0' : '') + n; }; return p(d.getUTCHours()) + ':' + p(d.getUTCMinutes()); }
function wmapMobUiOnSelect(gi) {
  var m, c;
  if (!WMOBUI.inited || gi < 0) return;
  c = wmapGoUiCtx();
  if (!c) return;
  m = wmapMobAt(c.W, gi, ldNow());
  if (m) wmapMobUiCardShow(m);
}
function wmapMobUiOnCardClick(ev) {
  var t = ev.target, gi = WMAPGO.cardGi;
  while (t && t !== WMAPGO.card && !(t.getAttribute && t.getAttribute('data-wgo'))) t = t.parentNode;
  if (!t || t === WMAPGO.card) return;
  if (t.getAttribute('data-wgo') === 'mobgo' && gi >= 0 && typeof ldNavPush === 'function') ldNavPush('wmmob', { gi: gi });
}

// ───────── 派兵 ─────────
function wmapMobUiSend(gi, teamN) {
  var c = wmapGoUiCtx(), teams = typeof wdTeams === 'function' ? wdTeams() : [], team = null, i, r, now = ldNow(), m;
  if (!c) return false;
  for (i = 0; i < teams.length; i++) if (teams[i].n === teamN) team = teams[i];
  if (!team) { wmapGoUiToast('沒有這個隊伍'); return false; }
  m = wmapMobAt(c.W, gi, now);
  if (!m) { wmapGoUiToast('這隻野怪已經不在了'); return false; }
  r = wmapMobDispatch(c.W, c.cs, team, m, now, { WG: WMAP.WG, fast: wmapGoFast() });
  if (r.events && r.events.length) wmapGoUiConsume(r.events, false);
  if (!r.ok) { wmapGoUiToast(r.reason === 'gone' ? '這隻野怪已經不在了' : wmapGoUiMsg(r.reason)); wmapGoUiSave(); return false; }
  wmapGoUiSave();
  wmapGoUiToast(team.name + ' 出發剿匪 → Lv' + m.lv + ' ' + m.ty + '(約 ' + (r.plan.goMs / 60000).toFixed(1) + ' 分)');
  if (typeof wmapSelect === 'function') wmapSelect(-1);
  wmapGoUiCardHide();
  wmapGoUiRefresh();
  wmapMobUiRefresh();
  return true;
}
function wmapMobUiPageRender(el, ctx) {
  var c = wmapGoUiCtx(), now = ldNow(), m, tg, teams, pt, foe, h, st, team, plan, od, i, sel = ctx.sel, selOk = false, list, row, b, N, cx, pw;
  el.innerHTML = '';
  if (el.classList) el.classList.add('wgp');
  if (!c || !wmapMobUiOn()) { el.appendChild(wmapGoUiEl('div', 'wgp-msg', '地圖尚未就緒')); return; }
  m = wmapMobAt(c.W, ctx.gi, now);
  if (!m) { el.appendChild(wmapGoUiEl('div', 'wgp-msg', '這隻野怪已經不在了(每天 08:00 / 12:00 / 20:00 換一批)')); return; }
  tg = wmapMobTarget(WMAP.WG, m);
  if (!tg.ok) { el.appendChild(wmapGoUiEl('div', 'wgp-msg', '超出行軍範圍')); return; }
  N = WMAP.WG.size; cx = m.gi % N;
  pt = wdPt(c.W, m.id) || wmapMobMakePt(c.W, m);
  foe = wmapGoFoePower(c.W, pt);
  h = wmapGoUiEl('div', 'wgp-head');
  h.appendChild(wmapGoUiEl('div', 'wgp-title', '(' + cx + ',' + ((m.gi - cx) / N) + ') Lv' + m.lv + ' ' + m.ty));
  h.appendChild(wmapGoUiEl('div', 'wgp-sub', '守軍戰力 ' + Math.round(foe) + '・掉落 文 ' + wmapMobCoin(m.lv) + ' 糧 ' + wmapMobGrain(m.lv) + '・' + wmapMobUiHM(wmapMobBatchEnd(m.bk)) + ' 消失'));
  el.appendChild(h);
  teams = typeof wdTeams === 'function' ? wdTeams() : [];
  list = wmapGoUiEl('div', 'wgp-list');
  if (!teams.length) list.appendChild(wmapGoUiEl('div', 'wgp-msg', '還沒有編好的隊伍,請先到〔部隊〕編隊'));
  for (i = 0; i < teams.length; i++) {
    team = teams[i];
    st = wmapGoUiTeamState(c, team, now);
    plan = wmapGoPlan(c.W, WMAP.WG, tg, team, now, { fast: wmapGoFast() });
    pw = wdTeamPowerR(c.W, c.cs, team.slots, now);
    od = { my: Math.round(pw), tag: foe > 0 && pw / foe >= WD_CFG.autoMul ? '穩勝' : (pw >= foe ? '五五' : '難勝') };
    od.cls = od.tag === '穩勝' ? 'good' : (od.tag === '五五' ? 'mid' : 'bad');
    row = wmapGoUiEl('button', 'wgp-row' + (team.n === sel ? ' sel' : '') + (st.ok ? '' : ' off'));
    row.setAttribute('type', 'button'); row.setAttribute('data-wgp-team', String(team.n));
    if (!st.ok) row.disabled = true;
    row.appendChild(wmapGoUiEl('b', 'wgp-n', team.name));
    row.appendChild(wmapGoUiEl('span', 'wgp-sp'));
    if (st.ok) {
      row.appendChild(wmapGoUiEl('span', 'wgp-pw', '戰力 ' + od.my));
      row.appendChild(wmapGoUiEl('span', 'wgp-od ' + od.cls, od.tag));
      row.appendChild(wmapGoUiEl('span', 'wgp-eta', '去程 ' + (plan.goMs / 60000).toFixed(1) + ' 分・回程 ' + (plan.backMs / 60000).toFixed(1) + ' 分'));
    } else row.appendChild(wmapGoUiEl('span', 'wgp-why', st.k === 'hurt' ? '重傷中' : wmapGoUiMsg(st.reason)));
    if (team.n === sel && st.ok) selOk = true;
    list.appendChild(row);
  }
  el.appendChild(list);
  b = wmapGoUiEl('div', 'wgp-foot');
  row = wmapGoUiEl('button', 'wgp-btn', '調整隊伍'); row.setAttribute('type', 'button'); row.setAttribute('data-wgp', 'edit'); b.appendChild(row);
  row = wmapGoUiEl('button', 'wgp-btn pri', '剿匪'); row.setAttribute('type', 'button'); row.setAttribute('data-wgp', 'go'); if (!selOk) row.disabled = true; b.appendChild(row);
  el.appendChild(b);
  if (!el.__wmbBound) {
    el.__wmbBound = true;
    el.addEventListener('click', function (ev) {
      var t = ev.target, n, a;
      while (t && t !== el && !(t.getAttribute && (t.getAttribute('data-wgp-team') || t.getAttribute('data-wgp')))) t = t.parentNode;
      if (!t || t === el) return;
      n = t.getAttribute('data-wgp-team'); a = t.getAttribute('data-wgp');
      if (n) { ctx.sel = parseInt(n, 10); wmapMobUiPageRender(el, ctx); return; }
      if (a === 'edit') { if (typeof ldNavPush === 'function') ldNavPush('team', { n: ctx.sel || 1, mode: 'edit' }); return; }
      if (a === 'go' && ctx.sel) { if (wmapMobUiSend(ctx.gi, ctx.sel)) { if (typeof ldNavBack === 'function') ldNavBack(); } else wmapMobUiPageRender(el, ctx); }
    });
  }
}

// ───────── 建置 ─────────
function wmapMobUiInit() {
  var t0, f0;
  if (WMOBUI.inited || !wmapMobUiOn() || !WMAP.vp || !WMAPGO.card || typeof document === 'undefined') return false;
  WMOBUI.cv = document.createElement('canvas');
  WMOBUI.cv.className = 'wmap-mob'; WMOBUI.cv.style.cssText = 'position:absolute;left:0;top:0;pointer-events:none;z-index:4';
  WMAP.vp.appendChild(WMOBUI.cv);
  WMOBUI.g = WMOBUI.cv.getContext('2d');
  WMOBUI.inited = true;
  wmapMobBind(WMAP.WG, null);
  WMAPGO.card.addEventListener('click', wmapMobUiOnCardClick);
  t0 = WMAP.onSelect;   // 鏈接:wmap_go_ui 先處理(地塊卡 / 收卡),再看這格有沒有野怪
  WMAP.onSelect = function (gi, node) { if (typeof t0 === 'function') t0(gi, node); wmapMobUiOnSelect(gi); };
  if (!WMOBUI.hooked && typeof wmapFrame === 'function') {
    f0 = wmapFrame;
    wmapFrame = function () { f0(); wmapMobUiDraw(); };
    WMOBUI.hooked = true;
  }
  wmapMobUiRefresh();
  wmapMobUiDraw();
  if (typeof setInterval === 'function') WMOBUI.tid = setInterval(wmapMobUiRefresh, 1000);
  return true;
}

if (typeof ldNavRegister === 'function') {
  ldNavRegister({
    id: 'wmmob', title: '剿匪',
    build: function (el, ctx) { if (ctx.sel === undefined) ctx.sel = 0; wmapMobUiPageRender(el, ctx); },
    onShow: function (el, ctx) { wmapMobUiPageRender(el, ctx); }
  });
}

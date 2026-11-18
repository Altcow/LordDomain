// js/wmap_go_ui.js — M1 W3 派兵介面 + MS2 行軍中指令 + 行軍層接線(設計_M1視覺原型_實作計畫.md W3 / 2.2;設計_行軍停止與相遇_規格.md 2、5)。核心邏輯在 js/wmap_go.js(純函式),本檔只做 DOM、計時、存檔、入帳。
// 流程:點地圖上的目標格(資源格 / 縣城 / 關口)→ 地圖上方浮出小資訊卡(座標 / Lv / 路徑成本 / 去程)→〔出征〕→ 滿版頁 wmgo(選隊 + 勝算 + 預估行軍時間)→〔出發〕寫入 W.trips(帶 lg)。
//       點自己的軍隊旗 → 小浮層選單:停止 / 繼續 / 改目標 / 撤退(5 秒冷卻;閒置 8 小時自動撤退;回程中只顯示資訊);改目標 = 進入選格模式,點新目標 → 卡片顯示新 ETA →〔改去此處〕。
// 存檔 / 推進:沿用舊地圖頁的 W(WDUI.W,存檔鍵 lorddomain.world.v2)。每秒 wmapGoTick:wdAdvance(ldNow())→ 事件交 wdUiConsume(入帳戰利品、戰報、回城)→ 有事件才存檔;
//       開啟 / 回到前景時就是離線追趕(wdRun 依時間推算到達 / 閒置到期 / 回程完成並結算,戰報時刻 = 原定時刻)。時鐘倒退(frozen)時不動作並提示。
// 行軍層:wmapArmyAttach 掛進地圖;每秒把 W.trips(帶 lg 者)以輕量代理物件交給行軍層(避免把 _wp 快取寫進存檔);wmapArmyPose 對 trip.lg 分流到 wmMarchPose。
// 掛鉤:wmap_ui.js 的 wmapUiInit 尾端呼叫 wmapGoUiInit();wmapUiBack 先問 wmapGoUiBack()。ES2017,不用 ?. ??;UTF-8 + CRLF。載入順序:wmap_ui.js 之後。全域名一律 wmapGoUi* / WMAPGO(wmap_go.js 用 wmapGo*)。
//
// ───────── 公開 API ─────────
//   wmapGoUiInit() → bool        建小卡 / 選單 / 提示列、接地圖選取與點軍隊、掛行軍層、起 1 秒計時;旗標 wmap 關 / 地圖未掛 / 已建 = false
//   wmapGoUiBack() → bool        Esc / 返回鍵:先取消改目標模式、再關選單;回 true = 已處理
//   wmapGoUiTick()               推進 + 入帳 + 存檔 + 同步行軍層 + 更新選單文字
//   wmapGoUiMenuOpen(tripId)     開軍隊選單(測試 / 外部也可呼叫)
//   wmapGoUiCmd(kind, o)         對目前選單的行程下指令('stop' 'resume' 'retreat' 或 'redirect' + {gi})
//   wmapGoUiSend(gi, teamN)      直接派一隊(頁面〔出發〕鈕呼叫)
//   (W5 掛鉤,實作在 wmap_settle_ui.js:wmapSettleUiSync / Tick / Reports / CardInfo / CapWarn / Quit / BootText / Init)
//   WMAPGO                       狀態:{inited, att, card, menu, hint, mode, menuId, proxies, tid, boot}

var WMAPGO = { inited: false, att: null, card: null, menu: null, hint: null, mode: null, menuId: null, cardGi: -1, proxies: {}, tid: 0, mtid: 0, boot: null, binds: [], lastOwn: '' };
var WMAPGO_ERR = {
  frozen: '時鐘異常,暫不能下令', notrip: '這支軍隊已不在外', back: '回程中不能下令', nopath: '這支軍隊沒有行軍路線', notmoving: '現在不能這樣做', notidle: '這支軍隊不是閒置中', cooldown: '指令太頻繁,請稍候幾秒',
  expired: '閒置已到期', route: '找不到路', target: '這裡不能當目標', owned: '這個點已經占領了', busy: '已經有隊伍前往這個點', needback: '無法計算回程', bad: '無法執行',
  army: '這隊不在城裡', terrain: '這裡不能出征', unreach: '超出行軍範圍', empty: '這格沒有可出征的目標', size: '隊伍人數不對', dup: '同一張卡不能上兩隊', missing: '有人已不在名冊',
  samefig: '同名名人不可同隊', hurt: '有人重傷中', field: '有人外勤中', appoint: '有人委任中,先解除委任', garrison: '有人駐派中,先撤回駐派', lowtrp: '兵力不足,請到隊伍頁補兵'
};

// ───────── 小工具 ─────────
function wmapGoUiEl(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt !== undefined && txt !== null) e.textContent = txt; return e; }
function wmapGoUiToast(m) { if (typeof showToast === 'function') { try { showToast(m); return; } catch (e) { /* 略過 */ } } if (typeof wdUiToast === 'function') wdUiToast(m); }
function wmapGoUiDur(ms) { return typeof wdUiDur === 'function' ? wdUiDur(ms) : String(Math.ceil(ms / 1000)) + 's'; }
function wmapGoUiMsg(r) { return WMAPGO_ERR[r] || String(r || '無法執行'); }
function wmapGoUiAdd(el, ev, fn, opt) { el.addEventListener(ev, fn, opt || false); WMAPGO.binds.push([el, ev, fn, opt || false]); }
function wmapGoUiOn() { return typeof WMAP !== 'undefined' && WMAP.on && !!WMAP.WG && typeof wdRun === 'function'; }
function wmapGoUiCtx() {   // {W, cs}:沿用舊地圖頁的狀態(第一次用時載入存檔 = 離線追趕一次)
  var cs, r;
  if (typeof WDUI === 'undefined') return null;
  if (!WDUI.W || !WDUI.cs) {
    cs = typeof wdUiCs === 'function' ? wdUiCs() : null;
    if (!cs || typeof wdUiBoot !== 'function') return null;
    r = wdUiBoot(cs, ldNow());
    WMAPGO.boot = typeof wmapGoSummary === 'function' ? wmapGoSummary(r.events) : null;
  }
  if (!WMAPGO.mig && WDUI.W && typeof wmapGoMigrate === 'function' && typeof WMAP !== 'undefined' && WMAP.WG) wmapGoUiMigrate();
  return { W: WDUI.W, cs: WDUI.cs };
}
// 世界版本重排(gv 2 / 3 → 4):先把 world.v2 備份成 .bak_gv<舊版>(gv 3 → .bak_gv3;只寫一次、不覆蓋),再重排並存檔、提示一次
function wmapGoUiMigrate() {
  var m, v, bk, nt;
  WMAPGO.mig = 1;
  if (!wmapGoNeedMigrate(WDUI.W, WMAP.WG)) return;
  bk = '.bak_gv' + (WDUI.W.g2 && WDUI.W.g2.gv > 0 ? WDUI.W.g2.gv : 2);
  try {
    v = localStorage.getItem(WDUI_KEY);
    if (v && localStorage.getItem(WDUI_KEY + bk) === null) localStorage.setItem(WDUI_KEY + bk, v);
  } catch (e) { /* 備份失敗(容量 / 無痕)不影響重排 */ }
  m = wmapGoMigrate(WDUI.W, WDUI.cs, WMAP.WG, ldNow());
  if (m.changed) {
    nt = typeof wmapGoMigNotice === 'function' ? wmapGoMigNotice(WDUI.W) : null;   // gv 6:收回領地提示只顯示一次
    if (nt && typeof wmapGoMigAck === 'function') wmapGoMigAck(WDUI.W);
    wmapGoUiSave();
    wmapGoUiToast(nt ? '地圖資源重排,收回 ' + nt.n + ' 塊領地' + (m.home ? ',出征中的 ' + m.home + ' 隊已回城' : '') : '地圖改版:縣城 / 郡城 / 關口與資源重新排列' + (m.home ? ',出征中的 ' + m.home + ' 隊已回城' : '') + (m.res ? ',' + m.res + ' 塊領地因地形變動失效' : ''));
  }
}
function wmapGoUiSave() { if (typeof wdUiSave === 'function') wdUiSave(); }
function wmapGoUiInfo(gi) { return typeof wmapInfoOf === 'function' ? wmapInfoOf(gi) : null; }
function wmapGoUiCoord(gi) { var N = WMAP.WG.size, c = gi % N; return '(' + c + ',' + ((gi - c) / N) + ')'; }
function wmapGoUiTitle(tg) {
  var W = wmapGoUiCtx(), pt = W ? wdPt(W.W, wmapGoPtId(tg.gi)) : null, nd = tg.node;
  if (tg.kind === 'res') return wmapGoUiCoord(tg.gi) + ' Lv' + tg.lv + ' ' + tg.ty;
  return wmapGoUiCoord(tg.gi) + ' ' + (pt ? pt.ty : (nd && typeof WD_NAMES !== 'undefined' ? WD_NAMES[tg.kind][nd.ti % WD_NAMES[tg.kind].length] : '')) + (tg.kind === 'pass' ? '(關口)' : (tg.kind === 'jun' ? '(郡城)' : '(縣城)'));
}
function wmapGoUiTeamState(c, team, now) {
  if (typeof wdUiTeamState === 'function') return wdUiTeamState(c.W, c.cs, team, now);
  var chk;
  if (wdTeamTrip(c.W, team.n)) return { ok: false, reason: 'army' };
  chk = wdCheckSlots(c.W, c.cs, team.slots, now);
  return { ok: chk.ok, reason: chk.reason };
}

// ───────── 事件入帳 / 同步 ─────────
function wmapGoUiConsume(evs, quiet) {
  var i, n = 0, reps = [], rest = [], sr = null;
  if (!evs || !evs.length) return;
  if (typeof wmapSettleUiSync === 'function') {   // W5:先對帳(占領 / 名額 / 占領獎勵寫進戰報),再依結果做快報條;地圖格的戰報不走舊 toast
    sr = wmapSettleUiSync();
    for (i = 0; i < evs.length; i++) { if (evs[i].k === 'report' && (wmapGoIsPtId(evs[i].pt) || (typeof wmapMobIsPtId === 'function' && wmapMobIsPtId(evs[i].pt)))) reps.push(evs[i]); else rest.push(evs[i]); }
  } else rest = evs;
  if (typeof wdUiConsume === 'function') {
    if (reps.length) wdUiConsume(reps, true);   // 掉落入帳(不跳舊 toast)
    if (rest.length) wdUiConsume(rest, !!quiet);
  }
  if (reps.length) wmapSettleUiReports(reps, !!quiet);
  for (i = 0; i < evs.length; i++) if (evs[i].k === 'idleend') n++;
  if (n && !quiet) wmapGoUiToast('閒置到期,部隊自動撤退');
}
function wmapGoUiSyncTrips() {
  var c = wmapGoUiCtx(), att = WMAPGO.att, list = [], seen = {}, i, t, px, k;
  if (!c || !att || !att.layer) return;
  for (i = 0; i < c.W.trips.length; i++) {
    t = c.W.trips[i];
    if (!t.lg) continue;
    px = WMAPGO.proxies[t.id] || (WMAPGO.proxies[t.id] = { id: t.id, side: 'own', tag: t.team });
    px.lg = t.lg; px.tag = t.team; px.slots = t.slots; seen[t.id] = 1; list.push(px);   // slots → 行軍層判定兵種模型(wmapArmyTroopOf)
  }
  for (k in WMAPGO.proxies) if (!seen[k]) delete WMAPGO.proxies[k];
  att.layer.setTrips(list);
}
function wmapGoUiSyncOwn(c) {
  var own = typeof wmapGoOwnSetAll === 'function' ? wmapGoOwnSetAll(c.W, ldNow()) : wmapGoOwnSet(c.W), key = Object.keys(own).sort().join(',');
  if (key === WMAPGO.lastOwn) return false;
  WMAPGO.lastOwn = key;
  WMAP.own = own;
  if (typeof wmapSchedule === 'function') wmapSchedule();
  return true;
}
function wmapGoUiRefresh() {   // 指令 / 出發後立刻更新(不等 1 秒計時)
  var c = wmapGoUiCtx();
  if (!c) return;
  wmapGoUiSyncTrips();
  wmapGoUiSyncOwn(c);
  if (WMAPGO.att && WMAPGO.att.layer) WMAPGO.att.layer.redraw();
  wmapGoUiMenuRender();
}
function wmapGoUiTick() {
  var c = wmapGoUiCtx(), now, r, ck, es;
  if (!c || !wmapGoUiOn()) return;
  now = ldNow();
  ck = wmapGoClock(c.W, now);
  if (ck.frozen) {
    if (ck.skew && !WMAPGO.skewWarned) { WMAPGO.skewWarned = true; wmapGoUiToast('裝置時鐘比紀錄早,行軍暫停到時間追上為止'); }
    wmapGoUiMenuRender();
    return;
  }
  WMAPGO.skewWarned = false;
  if (typeof rsvSettle === 'function') rsvSettle(now);
  r = wdAdvance(c.W, c.cs, now);
  if (r.events.length) { wmapGoUiConsume(r.events, false); wmapGoUiSave(); }
  if (typeof wmapSettleUiTick === 'function') wmapSettleUiTick();
  if (WMAPGO.cardEm >= 0 && WMAPGO.card && !WMAPGO.card.hidden && typeof wmapSettleEmptyStatus === 'function') {   // 空地小卡:占領倒數 / 完成
    es = wmapSettleEmptyStatus(c.W, WMAPGO.cardEm, now);
    if (es.working || (es.own ? 'own' : 'free') !== WMAPGO.cardEmSt) wmapGoUiCardEmpty(WMAPGO.cardEm, null);
  }
  wmapGoUiSyncTrips();
  wmapGoUiSyncOwn(c);
  wmapGoUiMenuRender();
}

// ───────── 浮動資訊卡(地塊)─────────
function wmapGoUiCardHide() { if (WMAPGO.card) WMAPGO.card.hidden = true; WMAPGO.cardGi = -1; WMAPGO.cardEm = -1; }
function wmapGoUiMmss(ms) { var s = Math.max(0, Math.ceil(ms / 1000)), m = Math.floor(s / 60); s = s % 60; return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s; }
// 空地小卡:作業中 = 「占領中 mm:ss」;已占 = 我的空地;可占 = 〔占領〕(不戰鬥、不占名額、等占領作業時間)
function wmapGoUiCardEmpty(gi, tg) {
  var c = wmapGoUiCtx(), card = WMAPGO.card, now = ldNow(), es, sub, btns = '', plan;
  if (!card || !c) return;
  es = wmapSettleEmptyStatus(c.W, gi, now);
  card.innerHTML = '';
  card.appendChild(wmapGoUiEl('div', 'wgc-t', wmapGoUiCoord(gi) + ' 空地'));
  if (es.working) sub = '占領中 ' + wmapGoUiMmss(es.left);
  else if (es.own) sub = '我的空地';
  else {
    plan = tg ? wmapGoPlan(c.W, WMAP.WG, tg, null, now, { fast: wmapGoFast() }) : null;
    sub = '空地・可直接占領' + (plan ? '・去程約 ' + plan.goMins.toFixed(1) + ' 分' : '') + '・作業 ' + wmapGoUiMmss(wmapSettleOccMs(c.W, now));
    btns = '<button type="button" class="wgc-b pri" data-wgo="occ">占領</button>';
  }
  card.appendChild(wmapGoUiEl('div', 'wgc-s', sub));
  card.insertAdjacentHTML('beforeend', '<div class="wgc-r">' + btns + '<button type="button" class="wgc-b" data-wgo="x" aria-label="關閉">×</button></div>');
  card.hidden = false;
  WMAPGO.cardGi = gi; WMAPGO.cardEm = gi; WMAPGO.cardEmSt = es.working ? 'w' : (es.own ? 'own' : 'free');
}
var WMAPGO_EMERR = { terrain: '這裡不是空地', res: '這是資源格,要出征', owned: '這格已經是你的', adj: '要緊鄰己方領地 / 道路才能占領', mob: '有野怪在這格,先剿滅', enemy: '這格是他人領地' };
function wmapGoUiOccupy(gi) {
  var c = wmapGoUiCtx(), r;
  if (!c || gi < 0) return false;
  r = wmapSettleEmptyStart(c.W, WMAP.WG, gi, ldNow());
  if (!r.ok) { wmapGoUiToast(WMAPGO_EMERR[r.err] || '不能占領這格'); return false; }
  wmapGoUiSave();
  wmapGoUiToast('開始占領 ' + wmapGoUiCoord(gi) + ':約 ' + wmapGoUiMmss(r.ms) + ' 後完成(不戰鬥、不占名額)');
  wmapGoUiCardEmpty(gi, null);
  wmapGoUiRefresh();
  return true;
}
function wmapGoUiCardShow(tg) {
  var c = wmapGoUiCtx(), card = WMAPGO.card, now = ldNow(), pt, tit, sub, btns = '', plan, owned = false, busy = false, rd = WMAPGO.mode, pre, ex = null;
  if (!card || !c) return;
  pt = wdPt(c.W, wmapGoPtId(tg.gi));
  owned = !!(pt && pt.owner);
  busy = !!(pt && wdPtBusy(c.W, pt.id));
  tit = wmapGoUiTitle(tg);
  plan = wmapGoPlan(c.W, WMAP.WG, tg, null, now, { fast: wmapGoFast() });
  sub = '路徑成本 ' + tg.cost.toFixed(1) + '・去程約 ' + plan.goMins.toFixed(1) + ' 分・回程約 ' + plan.backMins.toFixed(1) + ' 分';
  card.innerHTML = '';
  card.appendChild(wmapGoUiEl('div', 'wgc-t', tit));
  if (rd && rd.k === 'redirect') {
    pre = wmapGoPlanRedirect(c.W, WMAP.WG, wmapGoTripOf(c.W, rd.id) || { slots: [] }, tg.gi, wmapGoUiInfo(tg.gi), now, { fast: wmapGoFast() });
    card.appendChild(wmapGoUiEl('div', 'wgc-s', pre.ok ? '改目標:新行程約 ' + pre.goMins.toFixed(1) + ' 分(成本 ' + pre.cost.toFixed(1) + ')' : '不能改去這裡:' + wmapGoUiMsg(pre.err)));
    btns = pre.ok ? '<button type="button" class="wgc-b pri" data-wgo="redirect">改去此處</button>' : '';
    btns += '<button type="button" class="wgc-b" data-wgo="cancel">取消改目標</button>';
  } else {
    if (owned && typeof wmapSettleUiCardInfo === 'function') ex = wmapSettleUiCardInfo(tg.gi, c.W, now);
    if (!owned && !busy && tg.kind === 'res' && typeof wmapSettleUiCapWarn === 'function') sub += wmapSettleUiCapWarn(c.W, c.cs);
    card.appendChild(wmapGoUiEl('div', 'wgc-s', owned ? (ex ? ex.sub : '已占領') : (busy ? '已有隊伍前往・' + sub : sub)));
    btns = (owned || busy) ? (ex ? ex.btns : '') : '<button type="button" class="wgc-b pri" data-wgo="go">出征</button>';
    btns += '<button type="button" class="wgc-b" data-wgo="x" aria-label="關閉">×</button>';
  }
  btns = '<div class="wgc-r">' + btns + '</div>';
  card.insertAdjacentHTML('beforeend', btns);
  card.hidden = false;
  WMAPGO.cardGi = tg.gi;
}
function wmapGoUiOnSelect(gi) {
  var tg, c;
  if (!WMAPGO.inited) return;
  if (WMAPGO.menuId && gi >= 0) wmapGoUiMenuClose();
  if (gi < 0) { wmapGoUiCardHide(); return; }
  c = wmapGoUiCtx();
  if (c && typeof wmapSettleEmptyStatus === 'function' && WMAP.WG.k[gi] === 0 && !wmapGoUiInfo(gi)) {   // 空地:作業中 / 已占 / 可占
    if (wmapSettleEmptyStatus(c.W, gi, ldNow()).own || wmapSettleEmptyStatus(c.W, gi, ldNow()).working) { wmapGoUiCardEmpty(gi, null); return; }
    tg = wmapGoTarget(WMAP.WG, gi, null, WMAP.own, c.W);
    if (tg.ok && tg.kind === 'pave') { wmapGoUiCardEmpty(gi, tg); return; }
  }
  tg = wmapGoTarget(WMAP.WG, gi, wmapGoUiInfo(gi));
  if (!tg.ok) { wmapGoUiCardHide(); return; }
  wmapGoUiCardShow(tg);
}
function wmapGoUiOnCardClick(ev) {
  var t = ev.target, a, gi = WMAPGO.cardGi;
  while (t && t !== WMAPGO.card && !(t.getAttribute && t.getAttribute('data-wgo'))) t = t.parentNode;
  if (!t || t === WMAPGO.card) return;
  a = t.getAttribute('data-wgo');
  if (a === 'x') { if (typeof wmapSelect === 'function') wmapSelect(-1); return; }
  if (a === 'cancel') { wmapGoUiModeSet(null); wmapGoUiCardHide(); return; }
  if (a === 'go') { if (gi >= 0 && typeof ldNavPush === 'function') ldNavPush('wmgo', { gi: gi }); return; }
  if (a === 'occ') { wmapGoUiOccupy(gi); return; }
  if (a === 'redirect') wmapGoUiCmd('redirect', { gi: gi });
  if ((a === 'quit' || a === 'unquit') && gi >= 0 && typeof wmapSettleUiQuit === 'function') wmapSettleUiQuit(gi, a === 'unquit');
}

// ───────── 滿版頁:選隊 + 預估 + 出發 ─────────
function wmapGoUiPageRender(el, ctx) {
  var c = wmapGoUiCtx(), now = ldNow(), tg, teams, pt, foe, h, st, team, plan, od, i, sel = ctx.sel, selOk = false, list, row, b, fast = wmapGoFast();
  el.innerHTML = '';
  if (el.classList) el.classList.add('wgp');
  if (!c) { el.appendChild(wmapGoUiEl('div', 'wgp-msg', '地圖尚未就緒')); return; }
  tg = wmapGoTarget(WMAP.WG, ctx.gi, wmapGoUiInfo(ctx.gi));
  if (!tg.ok) { el.appendChild(wmapGoUiEl('div', 'wgp-msg', '這裡不能出征:' + wmapGoUiMsg(tg.reason))); return; }
  pt = wdPt(c.W, wmapGoPtId(tg.gi)) || wmapGoDraft(c.W, WMAP.WG, tg);
  foe = wmapGoFoePower(c.W, pt);
  h = wmapGoUiEl('div', 'wgp-head');
  h.appendChild(wmapGoUiEl('div', 'wgp-title', wmapGoUiTitle(tg)));
  h.appendChild(wmapGoUiEl('div', 'wgp-sub', '路徑成本 ' + tg.cost.toFixed(1) + '・守軍戰力 ' + Math.round(foe) + (pt.nf > 1 ? '(' + pt.nf + ' 隊)' : '')));
  el.appendChild(h);
  teams = typeof wdTeams === 'function' ? wdTeams() : [];
  list = wmapGoUiEl('div', 'wgp-list');
  if (!teams.length) list.appendChild(wmapGoUiEl('div', 'wgp-msg', '還沒有編好的隊伍,請先到〔部隊〕編隊'));
  for (i = 0; i < teams.length; i++) {
    team = teams[i];
    st = wmapGoUiTeamState(c, team, now);
    plan = wmapGoPlan(c.W, WMAP.WG, tg, team, now, { fast: fast });
    od = wmapGoOdds(c.W, c.cs, team, tg, now);
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
  row = wmapGoUiEl('button', 'wgp-btn pri', '出發'); row.setAttribute('type', 'button'); row.setAttribute('data-wgp', 'go'); if (!selOk) row.disabled = true; b.appendChild(row);
  el.appendChild(b);
  if (!el.__wgpBound) {
    el.__wgpBound = true;
    el.addEventListener('click', function (ev) {
      var t = ev.target, n, a;
      while (t && t !== el && !(t.getAttribute && (t.getAttribute('data-wgp-team') || t.getAttribute('data-wgp')))) t = t.parentNode;
      if (!t || t === el) return;
      n = t.getAttribute('data-wgp-team'); a = t.getAttribute('data-wgp');
      if (n) { ctx.sel = parseInt(n, 10); wmapGoUiPageRender(el, ctx); return; }
      if (a === 'edit') { if (typeof ldNavPush === 'function') ldNavPush('team', { n: ctx.sel || 1, mode: 'edit' }); return; }
      if (a === 'go' && ctx.sel) { if (wmapGoUiSend(ctx.gi, ctx.sel)) { if (typeof ldNavBack === 'function') ldNavBack(); } else wmapGoUiPageRender(el, ctx); }
    });
  }
}
function wmapGoUiSend(gi, teamN) {
  var c = wmapGoUiCtx(), teams = typeof wdTeams === 'function' ? wdTeams() : [], team = null, i, r, now = ldNow();
  if (!c) return false;
  for (i = 0; i < teams.length; i++) if (teams[i].n === teamN) team = teams[i];
  if (!team) { wmapGoUiToast('沒有這個隊伍'); return false; }
  r = wmapGoDispatch(c.W, c.cs, team, gi, now, { WG: WMAP.WG, info: wmapGoUiInfo(gi), fast: wmapGoFast() });
  if (r.events && r.events.length) wmapGoUiConsume(r.events, false);
  if (!r.ok) { wmapGoUiToast(wmapGoUiMsg(r.reason)); wmapGoUiSave(); return false; }
  wmapGoUiSave();
  wmapGoUiToast(team.name + ' 出發 → ' + r.pt.ty + '(約 ' + (r.plan.goMs / 60000).toFixed(1) + ' 分)');
  if (typeof wmapSelect === 'function') wmapSelect(-1);
  wmapGoUiCardHide();
  wmapGoUiRefresh();
  return true;
}

// ───────── 軍隊選單 ─────────
function wmapGoUiMenuClose() {
  WMAPGO.menuId = null;
  if (WMAPGO.menu) WMAPGO.menu.hidden = true;
  if (WMAPGO.att && WMAPGO.att.layer) { WMAPGO.att.layer.setSel(null); WMAPGO.att.layer.redraw(); }
  if (WMAPGO.mtid) { clearInterval(WMAPGO.mtid); WMAPGO.mtid = 0; }
}
function wmapGoUiMenuOpen(id) {
  var c = wmapGoUiCtx();
  if (!c || !WMAPGO.menu || !wmapGoTripOf(c.W, id)) return false;
  WMAPGO.menuId = id;
  if (WMAPGO.att && WMAPGO.att.layer) { WMAPGO.att.layer.setSel(id); WMAPGO.att.layer.redraw(); }
  wmapGoUiMenuRender();
  WMAPGO.menu.hidden = false;
  wmapGoUiMenuPlace();
  if (!WMAPGO.mtid) WMAPGO.mtid = setInterval(wmapGoUiMenuPlace, 250);
  return true;
}
function wmapGoUiMenuPlace() {
  var m = WMAPGO.menu, L = WMAPGO.att && WMAPGO.att.layer, it, i, x, y, mw, mh;
  if (!m || m.hidden || !L || !WMAPGO.menuId) return;
  for (i = 0; i < L.items.length; i++) if (L.items[i].id === WMAPGO.menuId) it = L.items[i];
  if (!it) return;
  mw = m.offsetWidth || 190; mh = m.offsetHeight || 130;
  x = it.x + L.camX - mw / 2; y = it.y + L.camY - mh - it.s * 0.95;
  x = Math.max(6, Math.min(WMAP.vw - mw - 6, x)); y = Math.max(6, Math.min(WMAP.vh - mh - 6, y));
  m.style.left = Math.round(x) + 'px'; m.style.top = Math.round(y) + 'px';
}
function wmapGoUiMenuRender() {
  var m = WMAPGO.menu, c, trip, st, now = ldNow(), pt, h, line, cd, defs, i, b, sig;
  if (!m || !WMAPGO.menuId) return;
  c = wmapGoUiCtx();
  trip = c ? wmapGoTripOf(c.W, WMAPGO.menuId) : null;
  if (!trip) { wmapGoUiMenuClose(); return; }
  st = wmapGoStatus(trip, now, WMAP.WG);
  pt = wdPt(c.W, trip.pt);
  if (st.phase === 'idle') line = '閒置中・剩 ' + wmapGoUiDur(st.huLeft) + ' 自動撤退';
  else if (st.phase === 'go') line = '行軍中・剩 ' + wmapGoUiDur(st.eta - now) + ' 抵達';
  else if (st.phase === 'fight') line = '交戰中';
  else if (st.phase === 'back') line = '回程中・剩 ' + wmapGoUiDur(Math.max(0, st.tHome - now)) + '(不能下令)';
  else line = '待命';
  cd = Math.ceil(st.cdLeft / 1000);
  defs = [];
  if (st.canStop) defs.push(['stop', '停止']);
  if (st.canResume) defs.push(['resume', '繼續']);
  if (st.canRedirect) defs.push(['redirect', '改目標']);
  if (st.canRetreat) defs.push(['retreat', '撤退']);
  sig = [trip.id, line.replace(/\d+:\d+(:\d+)?/g, ''), defs.map(function (d) { return d[0]; }).join(), cd > 0 ? 1 : 0].join('|');
  h = m.__sig === sig;
  if (!h) {
    m.__sig = sig;
    m.innerHTML = '';
    m.appendChild(wmapGoUiEl('div', 'wgm-t', trip.name + '・' + (pt ? (pt.cat === 'res' ? 'Lv' + pt.lv + ' ' : '') + pt.ty : '')));
    m.appendChild(wmapGoUiEl('div', 'wgm-s', line));
    b = wmapGoUiEl('div', 'wgm-r');
    for (i = 0; i < defs.length; i++) { line = wmapGoUiEl('button', 'wgm-b' + (defs[i][0] === 'retreat' ? ' warn' : ''), defs[i][1]); line.setAttribute('type', 'button'); line.setAttribute('data-wgm', defs[i][0]); b.appendChild(line); }
    line = wmapGoUiEl('button', 'wgm-b x', '×'); line.setAttribute('type', 'button'); line.setAttribute('data-wgm', 'x'); line.setAttribute('aria-label', '關閉'); b.appendChild(line);
    m.appendChild(b);
  } else {
    h = m.querySelector('.wgm-s');
    if (h) h.textContent = st.phase === 'idle' ? '閒置中・剩 ' + wmapGoUiDur(st.huLeft) + ' 自動撤退' : (st.phase === 'go' ? '行軍中・剩 ' + wmapGoUiDur(st.eta - now) + ' 抵達' : (st.phase === 'back' ? '回程中・剩 ' + wmapGoUiDur(Math.max(0, st.tHome - now)) + '(不能下令)' : h.textContent));
  }
  b = m.querySelectorAll ? m.querySelectorAll('.wgm-b[data-wgm]') : [];
  for (i = 0; i < b.length; i++) {
    if (b[i].getAttribute('data-wgm') === 'x') continue;
    b[i].disabled = cd > 0;
    b[i].setAttribute('data-cd', cd > 0 ? String(cd) : '');
  }
}
function wmapGoUiOnMenuClick(ev) {
  var t = ev.target, a;
  while (t && t !== WMAPGO.menu && !(t.getAttribute && t.getAttribute('data-wgm'))) t = t.parentNode;
  if (!t || t === WMAPGO.menu) return;
  a = t.getAttribute('data-wgm');
  if (a === 'x') { wmapGoUiMenuClose(); return; }
  if (a === 'redirect') { wmapGoUiModeSet({ k: 'redirect', id: WMAPGO.menuId }); return; }
  wmapGoUiCmd(a);
}
function wmapGoUiCmd(kind, o) {
  var c = wmapGoUiCtx(), id = WMAPGO.menuId || (o && o.id), r, msg;
  if (o && o.gi !== undefined && WMAPGO.mode && WMAPGO.mode.id) id = WMAPGO.mode.id;
  if (!c || !id) return false;
  r = wmapGoCmd(c.W, c.cs, id, kind, ldNow(), { WG: WMAP.WG, fast: wmapGoFast(), gi: o ? o.gi : undefined, info: o && o.gi !== undefined ? wmapGoUiInfo(o.gi) : undefined });
  if (r.events && r.events.length) wmapGoUiConsume(r.events, false);
  if (!r.ok) { wmapGoUiToast(wmapGoUiMsg(r.err)); wmapGoUiSave(); wmapGoUiRefresh(); return false; }
  msg = { stop: '停下來了(閒置中,可隨時繼續)', resume: '繼續前進', retreat: r.cancel ? '取消出征,回城' : '撤退中', redirect: '改變目標' }[kind] || '';
  wmapGoUiSave();
  if (msg) wmapGoUiToast(msg);
  if (kind === 'redirect') { wmapGoUiModeSet(null); wmapGoUiMenuClose(); if (typeof wmapSelect === 'function') wmapSelect(-1); wmapGoUiCardHide(); }
  wmapGoUiRefresh();
  return true;
}
function wmapGoUiModeSet(m) {
  WMAPGO.mode = m;
  if (WMAPGO.hint) {
    WMAPGO.hint.hidden = !m;
    if (m) WMAPGO.hint.textContent = '改目標:請點地圖上的新目標格(點此取消)';
  }
  if (m) { if (WMAPGO.menu) WMAPGO.menu.hidden = true; if (typeof wmapSelect === 'function') wmapSelect(-1); }
  else if (WMAPGO.menuId && WMAPGO.menu) WMAPGO.menu.hidden = false;
}

// ───────── 點地圖:先問軍隊 ─────────
function wmapGoUiOnTap(x, y) {
  var L = WMAPGO.att && WMAPGO.att.layer, ids, c;
  if (!WMAPGO.inited || !L || WMAPGO.mode) return false;
  ids = L.hit(x, y);
  if (!ids.length) { if (WMAPGO.menuId) wmapGoUiMenuClose(); return false; }
  c = wmapGoUiCtx();
  if (!c || !wmapGoTripOf(c.W, ids[0])) return false;
  if (typeof wmapSelect === 'function' && WMAP.sel >= 0) wmapSelect(-1);
  wmapGoUiCardHide();
  wmapGoUiMenuOpen(ids[0]);
  return true;
}
// 縣 / 郡 / 關:wmapHit 先測城池點選形(占地 + 往上拉高的六邊形),點城內任何格 / 關門道都回該座,不必再補判斷
function wmapGoUiBack() {
  if (!WMAPGO.inited) return false;
  if (WMAPGO.mode) { wmapGoUiModeSet(null); wmapGoUiCardHide(); return true; }
  if (WMAPGO.menuId) { wmapGoUiMenuClose(); return true; }
  return false;
}

// ───────── 建置 ─────────
function wmapGoUiInit() {
  var root, ql = 'mid', t0, tap0;
  if (WMAPGO.inited || !wmapGoUiOn() || !WMAP.root || typeof document === 'undefined') return false;
  root = WMAP.root;
  WMAPGO.card = wmapGoUiEl('div', 'wmapgo-card'); WMAPGO.card.hidden = true; root.appendChild(WMAPGO.card);
  WMAPGO.menu = wmapGoUiEl('div', 'wmapgo-menu'); WMAPGO.menu.hidden = true; root.appendChild(WMAPGO.menu);
  WMAPGO.hint = wmapGoUiEl('button', 'wmapgo-hint'); WMAPGO.hint.setAttribute('type', 'button'); WMAPGO.hint.hidden = true; root.appendChild(WMAPGO.hint);
  wmapGoUiAdd(WMAPGO.card, 'click', wmapGoUiOnCardClick);
  wmapGoUiAdd(WMAPGO.menu, 'click', wmapGoUiOnMenuClick);
  wmapGoUiAdd(WMAPGO.hint, 'click', function () { wmapGoUiModeSet(null); wmapGoUiCardHide(); });
  if (typeof wmapSettleUiInit === 'function') wmapSettleUiInit(root);
  ['pointerdown', 'pointerup'].forEach(function (ev) { [WMAPGO.card, WMAPGO.menu, WMAPGO.hint].forEach(function (e) { e.addEventListener(ev, function (x) { x.stopPropagation(); }); }); });
  WMAPGO.inited = true;
  t0 = WMAP.onSelect;   // 鏈接:先交給原本的處理(進城判斷),再顯示地塊卡
  WMAP.onSelect = function (gi, node) { if (typeof t0 === 'function') t0(gi, node); wmapGoUiOnSelect(gi); };
  if (typeof wmapTap === 'function' && !WMAPGO.tapHooked) {   // 點軍隊旗優先於選格(同 W4 包住 wmapFrame 的做法)
    tap0 = wmapTap;
    wmapTap = function (x, y) { if (wmapGoUiOn() && wmapGoUiOnTap(x, y)) return; tap0(x, y); };
    WMAPGO.tapHooked = true;
  }
  try { if (typeof qualityLevel === 'function') ql = qualityLevel(); } catch (e) { ql = 'mid'; }
  if (typeof wmapArmyAttach === 'function') WMAPGO.att = wmapArmyAttach({ q: ql, nowFn: ldNow });
  wmapGoUiCtx();
  wmapGoUiTick();
  wmapGoUiRefresh();
  if (WMAPGO.boot && (WMAPGO.boot.report || WMAPGO.boot.home || WMAPGO.boot.idleend)) {
    wmapGoUiToast('離線期間:' + (WMAPGO.boot.report ? '戰報 ' + WMAPGO.boot.report + ' 場(勝 ' + WMAPGO.boot.win + ')' : '') + (WMAPGO.boot.home ? ' 回城 ' + WMAPGO.boot.home + ' 隊' : '') + (WMAPGO.boot.idleend ? ' 閒置到期撤退 ' + WMAPGO.boot.idleend + ' 隊' : '') + (typeof wmapSettleUiBootText === 'function' ? wmapSettleUiBootText() : ''));
  } else if (typeof wmapSettleUiBootText === 'function' && wmapSettleUiBootText()) wmapGoUiToast('離線期間:' + wmapSettleUiBootText().replace(/^・/, ''));
  if (typeof wmapMobUiInit === 'function') wmapMobUiInit();   // 野怪標記 / 小卡(js/wmap_mob_ui.js)
  if (typeof setInterval === 'function') WMAPGO.tid = setInterval(wmapGoUiTick, 1000);
  wmapGoUiAdd(document, 'visibilitychange', function () { if (!document.hidden) wmapGoUiTick(); });
  return true;
}

if (typeof ldNavRegister === 'function') {
  ldNavRegister({
    id: 'wmgo', title: '出征',
    build: function (el, ctx) { if (ctx.sel === undefined) ctx.sel = 0; wmapGoUiPageRender(el, ctx); },
    onShow: function (el, ctx) { wmapGoUiPageRender(el, ctx); }
  });
}

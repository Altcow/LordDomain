// js/wm_ui.js — 外勤清單 v0 介面(R1b):戰鬥入口第 6 顆『外勤』→ 清單 8 格 + 出外部隊狀態條 + 派遣面板(手機底部浮層 / 寬螢幕右側半版)。
// 規則全在 wm_core.js(wmAdvance / wmQuote / wmDispatch / wmFight / wmRush / wmQueueSet);本檔只組字、接按鈕、入帳、存檔。
// 入口:bnui.js 戰鬥入口 data-t="wm" → wmOpen()(只在 worldmap 旗標開啟時出現鈕;v60 起預設開)。返回鍵:bnUiBack → wmBack()。
// 開發測試:網址加 ?wm=1 會開啟 FEATURES.worldmap(v60 預設已開,此參數無實際作用;保留供測試)。
// 存檔:localStorage 'lorddomain.wm.v1' = wmSave(W) 加 ui 欄位 {lt:[上次隊伍 × 3]}(wmNorm 忽略未知欄位);另呼叫 saveWorld()(卡片 wm 欄位隨世界存)。
// 推進:開啟時 wmAdvance 一次(上次存檔後累積的事件 = 離開期間,超過 1 分鐘才出摘要),開啟期間每秒 wmUiTick;
//   tick 只更新倒數 / 報價數字(data-cd、data-q、data-ah、data-as),事件出現才重畫清單與狀態條。
// 入帳:採集 / 戰勝的 loot.mats → cityGoodsAdd;gold → world.res.coin;碎片只顯示(R5 才發放)。
// 不發聲、不推播。ES2017;不用 ?. ??。
// 全域:WMUI wmOpen wmClose wmIsOpen wmBack wmUiTick wmUiBoot wmUiSave wmUiConsume wmUiDispatch wmUiFight wmUiRush wmUiQCancel
//   wmUiListHtml wmUiArmyHtml wmUiPopItemHtml wmUiQVals wmUiFoe wmUiMine wmUiFill wmUiCss

(function () { try { if (typeof location !== 'undefined' && typeof FEATURES !== 'undefined' && /[?&]wm=1(&|$)/.test(location.search)) FEATURES.worldmap = true; } catch (e) { /* 略過 */ } })();

var WMUI_KEY = 'lorddomain.wm.v1';
var WMUI = { el: null, timer: 0, W: null, cs: null, css: false, sel: -1, popId: '', pop: '', foe: {}, lt: [null, null, null], team: '', opt: { auto: true, qon: false, rf: 30 }, away: null, reps: [] };
var WMUI_ICON = { '林場': '🪵', '礦坑': '⛏️', '獵場': '🦌', '桑園': '🌿', '藥圃': '🌱', '玉坑': '💎', '古祠': '🏛️', '散銀': '🪙', '山賊營': '⚔️', '山寨': '🏰', '黃巾煽動點': '🔥', '名人據點': '👤' };
var WMUI_RC = { '白': '#d8d2c4', '青': '#7fd69a', '藍': '#6fb3ff', '據點': '#f0a040' };
var WMUI_ST = { home: '在家', march: '行軍中', camp: '採集中', ready: '待命', back: '回程中' };
var WMUI_REASON = { noitem: '此格已沒有物件', locked: '此格已有部隊前往', size: '隊伍需 1~5 人', dup: '隊伍有重複人員', missing: '有人已不在名冊', busy: '有人外出中', hp: '有人兵力低於 ' + (WM_CFG.minHpDispatch / 10) + '%', sta: '有人體力低於 ' + WM_CFG.minStaDispatch, army: '沒有空閒部隊', frozen: '時鐘異常,暫不出發', off: '外勤未開啟', state: '部隊目前不能開戰' };
var WMUI_QKEYS = ['dep', 'arr', 'go', 'cms', 'gend', 'cw', 'load', 'left', 'gain', 'ret', 'home', 'sta', 'foe', 'warn'];

// ───────── 小工具 ─────────
function wmUiEsc(s) { return (typeof bnUiEsc === 'function') ? bnUiEsc(s) : String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
function wmUiToast(m) { if (typeof bnUiToast === 'function') bnUiToast(m); }
function wmUiLsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function wmUiLsSet(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }
function wmUiCs() { return (typeof cardsGet === 'function') ? cardsGet() : null; }
function wmUiKm(li) { return Math.max(1, Math.round(li * 0.415)); }
function wmUiHM(ms) { var d = new Date(ms), p = function (n) { return (n < 10 ? '0' : '') + n; }; return p(d.getHours()) + ':' + p(d.getMinutes()); }
function wmUiDur(ms) {
  var s = Math.max(0, Math.ceil(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60, p = function (n) { return (n < 10 ? '0' : '') + n; };
  return h > 0 ? h + ':' + p(m) + ':' + p(x) : p(m) + ':' + p(x);
}
function wmUiGoodsName(id) { return (typeof GOODS !== 'undefined' && GOODS[id]) ? GOODS[id].name : id; }
function wmUiIcon(it) { return WMUI_ICON[it.ty] || '❔'; }
function wmUiRarTxt(it) { return it.cls === 'n' ? '據點' : it.rar; }
// 格子名稱(事件文字用):有物件用類別名,否則第 N 格
function wmUiSlotName(W, si) { var it = wmItemAt(W, si); return it ? it.ty : '第' + (si + 1) + '格'; }
function wmUiQ(id) { return WMUI.el ? WMUI.el.querySelector('#' + id) : null; }
function wmUiIsOpenNow() { return !!(WMUI.el && WMUI.el.parentNode && typeof bnu !== 'undefined' && bnu && bnu.layer && WMUI.el.parentNode === bnu.layer); }

// ───────── 存檔 / 載入 / 推進 ─────────
function wmUiHpSnap(cs) {
  var m = {};
  if (cs && cs.roster) cs.roster.forEach(function (e) { m[e.id] = e.wm && typeof e.wm.h === 'number' ? e.wm.h : WM_CFG.hpMax; });
  return m;
}
function wmUiSave() {
  var o = null;
  if (!WMUI.W) return;
  try { o = JSON.parse(wmSave(WMUI.W)); o.ui = { lt: WMUI.lt }; wmUiLsSet(WMUI_KEY, JSON.stringify(o)); } catch (e) { wmUiToast('外勤存檔失敗'); }
  if (typeof saveWorld === 'function') saveWorld();
}
// 讀檔 + 推進到 now。離開期間(上次存檔時刻 → now)超過 1 分鐘且有事件 → WMUI.away
function wmUiBoot(cs, now) {
  var raw = wmUiLsGet(WMUI_KEY), o = null, prev, pre, r;
  if (raw) { try { o = JSON.parse(raw); } catch (e) { o = null; } }
  WMUI.cs = cs;
  WMUI.W = wmLoad(raw || 'null', now, cs.seed, cs);
  WMUI.lt = (o && o.ui && Array.isArray(o.ui.lt)) ? o.ui.lt.map(function (x) { return Array.isArray(x) ? wmCleanTm(x) : null; }) : [null, null, null];
  prev = WMUI.W.now;
  pre = wmUiHpSnap(cs);
  r = wmAdvance(WMUI.W, cs, now);
  WMUI.away = (now - prev > 60000 && r.events.length) ? r.events : null;
  wmUiConsume(r.events, pre, true);
  wmUiSave();
}
// 處理事件:入帳、戰報、toast。boot = 離線結算(不逐條 toast)
function wmUiConsume(evs, pre, boot) {
  var W = WMUI.W, msgs = [];
  (evs || []).forEach(function (ev) {
    var a, loss, name;
    if (!W) return;
    name = wmUiSlotName(W, ev.si);
    if (ev.k === 'gather') {
      wmUiGrant(ev.loot);
      msgs.push(ev.n + '隊於' + name + '採完 ' + ev.cw + ' 重(' + wmUiLootTxt(ev.loot) + ')');
    } else if (ev.k === 'fight') {
      wmUiGrant(ev.loot);
      a = W.ar[ev.n - 1];
      loss = 0;
      if (pre && a) a.tm.forEach(function (m) { var e = wmCardOf(WMUI.cs, m.id); if (e && typeof pre[m.id] === 'number') loss += Math.max(0, pre[m.id] - (e.wm ? e.wm.h : WM_CFG.hpMax)); });
      WMUI.reps.unshift({ n: ev.n, name: name, win: ev.win, rounds: ev.rounds, loot: ev.loot, loss: Math.round(loss / 10), t: ev.t });
      WMUI.reps = WMUI.reps.slice(0, 10);
      msgs.push(ev.n + '隊' + (ev.win ? '勝' : '敗') + ' ' + name + '(' + ev.rounds + ' 回合)');
    } else if (ev.k === 'arrive') {
      msgs.push(ev.n + '隊抵達' + name);
    } else if (ev.k === 'home') {
      msgs.push(ev.n + '隊回村');
    } else if (ev.k === 'miss') {
      msgs.push(ev.n + '隊抵達時' + name + '已消失,改為回程');
    } else if (ev.k === 'dispatch' && ev.queued) {
      msgs.push(ev.n + '隊自動出征至' + name);
    } else if (ev.k === 'qskip') {
      msgs.push(ev.n + '隊預約跳過(有人已不在名冊)');
    }
  });
  if (!boot && msgs.length) wmUiToast(msgs.slice(0, 3).join(';'));
}
function wmUiGrant(loot) {
  var k;
  if (!loot) return;
  if (loot.mats) for (k in loot.mats) if (loot.mats[k] > 0 && typeof cityGoodsAdd === 'function') cityGoodsAdd(k, loot.mats[k]);
  if (loot.gold > 0 && typeof world !== 'undefined' && world && world.res) world.res.coin = (world.res.coin || 0) + loot.gold;
}
function wmUiLootTxt(loot) {
  var a = [], k;
  if (!loot) return '敗北,無戰利品';
  for (k in loot.mats || {}) a.push(wmUiGoodsName(k) + ' ×' + loot.mats[k]);
  if (loot.gold) a.push(loot.gold + ' 文');
  if (loot.frag && loot.frag.got) a.push('碎片 ' + loot.frag.got + '(R5 發放)');
  return a.length ? a.join('、') : '無';
}
function wmUiAdv(now) {
  var pre = wmUiHpSnap(WMUI.cs), r = wmAdvance(WMUI.W, WMUI.cs, now);
  if (r.events.length) wmUiConsume(r.events, pre, false);
  return r;
}

// ───────── 清單 / 狀態條 / 派遣面板(純字串,供測試) ─────────
function wmUiFoe(W, it) {
  if (!WMUI.foe[it.id]) WMUI.foe[it.id] = wmFoes(W, it);
  return WMUI.foe[it.id];
}
function wmUiMine(W, tm, cs, now) {
  var p = 0;
  tm.forEach(function (s) {
    var e = wmCardOf(cs, s.id), c, sp;
    if (!e) return;
    c = wmCardState(e, W, now);
    sp = bnUiSpec(e, { troop: s.troop, row: s.row, col: s.col });
    p += bnPower(sp) * c.h / WM_CFG.hpMax;
  });
  return Math.round(p);
}
function wmUiListHtml(W, now) {
  var out = '', si;
  for (si = 0; si < W.sl.length; si++) out += wmUiRowHtml(W, si, now);
  return out;
}
function wmUiRowHtml(W, si, now) {
  var sl = W.sl[si], it = sl.it, n, busy = null, st, stock, foe, rc;
  if (!it) {
    return '<div class="wm-row wm-emp"><span class="wm-ic">⌛</span><span class="wm-mid"><span class="wm-nm">空格</span><span class="wm-sm">' +
      (sl.nx > now ? '重新出現 <b data-cd="' + sl.nx + '">' + wmUiDur(sl.nx - now) + '</b>' : '即將出現') + '</span></span></div>';
  }
  for (n = 1; n <= W.ar.length; n++) if (W.ar[n - 1].st !== 'home' && W.ar[n - 1].it === it.id) busy = W.ar[n - 1];
  st = busy ? busy.n + ' 隊' + WMUI_ST[busy.st] : '空閒';
  if (it.cls === 'g') stock = '儲量 ' + it.left + ' 重';
  else { foe = wmUiFoe(W, it); stock = '敵軍戰力 ' + foe.rec; }
  rc = WMUI_RC[wmUiRarTxt(it)] || '#ddd';
  return '<button class="wm-row" data-wm="pick" data-i="' + si + '">' +
    '<span class="wm-ic">' + wmUiIcon(it) + '</span>' +
    '<span class="wm-mid"><span class="wm-nm">' + wmUiEsc(it.ty) + '</span> <i class="wm-rc" style="color:' + rc + '">' + wmUiRarTxt(it) + '</i>' +
    '<span class="wm-sm">' + it.dist + ' 里(約 ' + wmUiKm(it.dist) + ' 公里)· ' + stock + '</span></span>' +
    '<span class="wm-rt"><span class="wm-sm">過期 <b data-cd="' + it.exp + '">' + wmUiDur(it.exp - now) + '</b></span><span class="wm-sm">' + wmUiEsc(st) + '</span></span></button>';
}
// 隊伍成員(出外中用 a.tm;在家用上次隊伍 lt)
function wmUiArmyTeam(W, n) {
  var a = W.ar[n - 1];
  return a.st !== 'home' ? a.tm : (WMUI.lt[n - 1] || []);
}
function wmUiArmySum(W, cs, n, now) {
  var mem = wmUiArmyTeam(W, n).map(function (m) { return wmCardOf(cs, m.id); }).filter(Boolean), hp = 0, sta = 100, out = { n: mem.length, hp: 0, sta: 0, hurt: false, down: 0 };
  mem.forEach(function (e) {
    var c = wmCardState(e, W, now);
    hp += c.h; sta = Math.min(sta, c.s);
    if (c.h < WM_CFG.hpMax) out.hurt = true;
    if (c.h < WM_CFG.minHpDispatch) out.down++;
  });
  out.hp = mem.length ? Math.round(hp / mem.length / 10) : 0;
  out.sta = mem.length ? sta : 0;
  return out;
}
// 急補總價(只算在家且受傷的人)
function wmUiRushPlan(W, cs, n, now) {
  var ids = [], tot = 0;
  wmUiArmyTeam(W, n).forEach(function (m) {
    var q = wmRushQuote(W, cs, m.id, now);
    if (q.ok && q.cost > 0) { ids.push(m.id); tot += q.cost; }
  });
  return { ids: ids, cost: tot };
}
function wmUiArmyHtml(W, cs, now) {
  var out = '', n, a, s, lab, cd = '', btn = '', q, qi, plan;
  for (n = 1; n <= W.ar.length; n++) {
    a = W.ar[n - 1];
    s = wmUiArmySum(W, cs, n, now);
    q = W.q[n - 1];
    lab = WMUI_ST[a.st];
    if (a.st === 'march') cd = '抵達 <b data-cd="' + a.t1 + '">' + wmUiDur(a.t1 - now) + '</b>';
    else if (a.st === 'camp') cd = '採完 <b data-cd="' + a.tE + '">' + wmUiDur(a.tE - now) + '</b>';
    else if (a.st === 'back') cd = '回村 <b data-cd="' + a.t1 + '">' + wmUiDur(a.t1 - now) + '</b>';
    else if (a.st === 'home') cd = s.down ? '<span class="wm-warn">受傷無法出征</span>' : '';
    else cd = '';
    btn = '';
    if (a.st === 'ready') btn += '<button class="pri" data-wm="fight" data-i="' + n + '">開戰</button>';
    if (a.st === 'home' && s.hurt) {
      plan = wmUiRushPlan(W, cs, n, now);
      if (plan.ids.length) btn += '<button data-wm="rush" data-i="' + n + '">急補 ' + plan.cost + ' 文</button>';
    }
    qi = q.cm.length ? wmItemAt(W, q.cm[0].sl) : null;
    if (q.cm.length) btn += '<button data-wm="qcancel" data-i="' + n + '">取消預約</button>';
    out += '<div class="wm-arm"><div class="wm-ah"><b>' + n + ' 隊</b> <span class="wm-st">' + lab + '</span> <span class="wm-cd">' + cd + '</span></div>' +
      '<div class="wm-sm">' + (s.n ? '兵力 <b data-ah="' + n + '">' + s.hp + '</b>% · 體力 <b data-as="' + n + '">' + s.sta + '</b>(' + s.n + ' 人)' : '尚未派遣') +
      (q.cm.length ? ' · 預約:' + wmUiEsc(qi ? qi.ty : '格子已消失') + '(兵力低於 ' + q.cm[0].rf + '% 補給)' : '') + '</div>' +
      (btn ? '<div class="wm-ab">' + btn + '</div>' : '') + '</div>';
  }
  if (WMUI.reps.length) out += '<button data-wm="reps">最近戰報 (' + WMUI.reps.length + ')</button>';
  return out;
}
// 派遣面板:報價純函式。回 {ok, reason, v:{dep,arr,...}}(v 的值皆為字串)
function wmUiQVals(W, cs, tm, si, now) {
  var it = wmItemAt(W, si), q, v = {}, gc, foe, mine, rt;
  if (!it) return { ok: false, reason: 'noitem', v: v };
  q = wmQuote(W, cs, tm, si, now);
  if (!q.ok) return { ok: false, reason: q.reason, v: v };
  v.dep = wmUiHM(now);
  v.arr = wmUiHM(now + q.go * 1000);
  v.go = '行軍 ' + wmUiDur(q.go * 1000);
  v.ret = '回程 ' + wmUiDur(q.rt * 1000);
  if (it.cls === 'g') {
    gc = Math.ceil(q.cms / (WM_CFG.MIN * WM_CFG.gatherStaMin));
    v.cms = q.cms > 0 ? wmUiDur(q.cms) : '—';
    v.gend = wmUiHM(now + q.go * 1000 + q.cms);
    v.home = wmUiHM(now + q.go * 1000 + q.cms + q.rt * 1000);
    v.cw = q.cw + ' 重(負重 ' + q.load + ')';
    v.load = String(q.load);
    v.left = '儲量 ' + it.left;
    v.gain = it.ty === WM_SILVER_KEY ? q.gold + ' 文' : wmUiGoodsName(it.mat) + ' ×' + q.mats + '(' + it.rar + ' 材)';
    v.sta = '行軍 −' + q.sta + ' · 採集 −' + gc + '(每人)';
  } else {
    rt = wmUiHM(now + q.go * 1000 + q.rt * 1000);
    v.cms = '—'; v.gend = '—'; v.cw = '—'; v.load = String(q.load); v.left = '—';
    v.home = '約 ' + rt + '(戰後)';
    v.gain = '戰勝:材料(隨機)·' + (WM_DROP[it.drop] ? WM_DROP[it.drop].gold * it.ch : 0) + ' 文';
    v.sta = '行軍 −' + q.sta + ' · 開戰 −' + WM_CFG.staPerFight + '(敗再 −' + WM_CFG.staLoseExtra + ')';
    foe = wmUiFoe(W, it);
    mine = wmUiMine(W, tm, cs, now);
    v.foe = '敵軍戰力 ' + foe.rec + ' · 我方 ' + mine + ' · ' + bnMapRatioTxt(mine, foe.rec)[0];
  }
  v.warn = q.lowSta ? '體力偏低:行軍 ×1.2、採集 ×0.85' : '';
  return { ok: true, reason: '', v: v };
}
function wmUiTeamOpts() {
  var out = [], i, p;
  for (i = 1; i <= 3; i++) { p = bnTeamPresetGet(i); if (p && !p.empty && p.slots.length) out.push({ key: 'p' + i, name: p.name }); }
  if (typeof bnu !== 'undefined' && bnu && bnu.slots && bnu.slots.length) out.push({ key: 'cur', name: '目前布陣' });
  return out;
}
function wmUiTeamKey() {
  var o = wmUiTeamOpts(), i;
  for (i = 0; i < o.length; i++) if (o[i].key === WMUI.team) return WMUI.team;
  return o.length ? o[0].key : '';
}
function wmUiTeamSlots(key) {
  var p, s = [];
  if (key === 'cur') s = (typeof bnu !== 'undefined' && bnu && bnu.slots) ? bnu.slots : [];
  else if (key) { p = bnTeamPresetGet(+String(key).slice(1)); s = p ? p.slots : []; }
  return s.map(function (x) { return { id: x.id, row: x.row, col: x.col, troop: x.troop || '' }; });
}
function wmUiPopItemHtml(W, si, now) {
  var it = W.sl[si].it, opts = wmUiTeamOpts(), key = wmUiTeamKey(), h = '', i, rf = [10, 30, 50, 70];
  if (!it) return '<p>此格已沒有物件。</p>';
  h += '<div class="wm-ph"><b>' + wmUiIcon(it) + ' ' + wmUiEsc(it.ty) + '</b> <span class="wm-rc" style="color:' + (WMUI_RC[wmUiRarTxt(it)] || '#ddd') + '">' + wmUiRarTxt(it) + '</span>' +
    '<button data-wm="pclose">✕</button></div>' +
    '<div class="wm-sm">' + it.dist + ' 里(約 ' + wmUiKm(it.dist) + ' 公里)· 過期 <b data-cd="' + it.exp + '">' + wmUiDur(it.exp - now) + '</b></div>';
  if (!opts.length) h += '<p class="wm-warn">沒有可派遣的隊伍,請先到布陣存入隊伍。</p>';
  h += '<label class="wm-f">派遣隊伍 <select data-wm="team">' + opts.map(function (o) { return '<option value="' + o.key + '"' + (o.key === key ? ' selected' : '') + '>' + wmUiEsc(o.name) + '</option>'; }).join('') + '</select></label>';
  h += '<button data-wm="edit">進階:隊伍編輯</button>';
  h += '<label class="wm-ck"><input type="checkbox" data-wm="auto"' + (WMUI.opt.auto ? ' checked' : '') + '> 抵達後自動快速戰鬥,敗則回村</label>';
  h += '<label class="wm-ck"><input type="checkbox" data-wm="qon"' + (WMUI.opt.qon ? ' checked' : '') + '> 預約連續出征</label>';
  if (WMUI.opt.qon) {
    h += '<label class="wm-f">兵力低於 <select data-wm="qrf">' + rf.map(function (x) { return '<option value="' + x + '"' + (x === WMUI.opt.rf ? ' selected' : '') + '>' + x + '%</option>'; }).join('') + '</select> 時回城補給到滿再出</label>';
  }
  h += '<div class="wm-q">';
  h += '<div>出發 <b data-q="dep">—</b> → 抵達 <b data-q="arr">—</b> <span data-q="go"></span></div>';
  h += '<div>採集 <span data-q="cms">—</span> · 採完 <b data-q="gend">—</b></div>';
  h += '<div><span data-q="ret"></span> · 回村 <b data-q="home">—</b></div>';
  h += '<div>採集量 <span data-q="cw">—</span> · <span data-q="left">—</span></div>';
  h += '<div>體力 <span data-q="sta">—</span></div>';
  h += '<div>預估收益 <span data-q="gain">—</span></div>';
  h += '<div data-q="foe"></div>';
  h += '<div class="wm-warn" data-q="warn"></div>';
  h += '</div>';
  h += '<button class="pri" id="wmDisp" data-wm="dispatch">' + (WMUI.opt.qon ? '預約' : '派遣') + '</button>';
  return h;
}
function wmUiPopAwayHtml(evs) {
  var W = WMUI.W, rows = evs.filter(function (ev) { return ['arrive', 'gather', 'fight', 'home', 'miss', 'dispatch', 'qskip'].indexOf(ev.k) >= 0; }), show = rows.slice(0, 10), h = '';
  h += '<div class="wm-ph"><b>離開期間</b><button data-wm="pclose">✕</button></div>';
  if (!show.length) h += '<p>這段時間外勤沒有動靜。</p>';
  show.forEach(function (ev) {
    var t = wmUiHM(ev.t), txt = '';
    if (ev.k === 'gather') txt = ev.n + '隊採完 ' + wmUiSlotName(W, ev.si) + ' ' + ev.cw + ' 重(' + wmUiLootTxt(ev.loot) + ')';
    else if (ev.k === 'fight') txt = ev.n + '隊' + (ev.win ? '勝' : '敗') + ' ' + wmUiSlotName(W, ev.si) + '(' + ev.rounds + ' 回合)';
    else if (ev.k === 'arrive') txt = ev.n + '隊抵達 ' + wmUiSlotName(W, ev.si);
    else if (ev.k === 'home') txt = ev.n + '隊回村';
    else if (ev.k === 'miss') txt = ev.n + '隊撲空,改為回程';
    else if (ev.k === 'dispatch') txt = ev.n + '隊自動出征';
    else if (ev.k === 'qskip') txt = ev.n + '隊預約跳過';
    h += '<div class="wm-sm">' + t + ' ' + wmUiEsc(txt) + '</div>';
  });
  if (rows.length > 10) h += '<p class="wm-sm">其餘 ' + (rows.length - 10) + ' 條未列出。</p>';
  h += '<button class="pri" data-wm="pclose">知道了</button>';
  return h;
}
function wmUiPopRepsHtml() {
  var h = '<div class="wm-ph"><b>最近戰報</b><button data-wm="pclose">✕</button></div>';
  if (!WMUI.reps.length) h += '<p>還沒有戰報。</p>';
  WMUI.reps.forEach(function (r) {
    h += '<div class="wm-rep"><b>' + r.n + ' 隊' + (r.win ? '勝' : '敗') + '</b> ' + wmUiEsc(r.name) + ' · ' + r.rounds + ' 回合 · 兵力損失約 ' + r.loss + '%<br><small>' + wmUiEsc(wmUiLootTxt(r.loot)) + '</small></div>';
  });
  h += '<p class="wm-sm">回播未接(R1b 只給摘要)。</p>';
  return h;
}

// ───────── 繪製 / 更新 ─────────
function wmUiRenderAll() {
  var now = Date.now(), l, a;
  if (!WMUI.el) return;
  l = wmUiQ('wmList'); a = wmUiQ('wmArmy');
  if (l) l.innerHTML = wmUiListHtml(WMUI.W, now);
  if (a) a.innerHTML = wmUiArmyHtml(WMUI.W, WMUI.cs, now);
}
function wmUiPopShow(html) {
  var pop = wmUiQ('wmPop');
  if (pop) pop.innerHTML = html;
  if (WMUI.el) WMUI.el.classList.add('pop-on');
}
function wmUiPopOpenItem(si) {
  var now = Date.now();
  if (!wmItemAt(WMUI.W, si)) { wmUiToast('此格已空'); return; }
  WMUI.sel = si; WMUI.popId = WMUI.W.sl[si].it.id; WMUI.pop = 'item';
  wmUiPopShow(wmUiPopItemHtml(WMUI.W, si, now));
  wmUiFill(now);
}
function wmUiPopClose() {
  WMUI.pop = ''; WMUI.sel = -1; WMUI.popId = '';
  if (WMUI.el) WMUI.el.classList.remove('pop-on');
}
// 每秒:倒數 / 報價 / 兵力體力數字;不重畫
function wmUiFill(now) {
  var r, k, node, pop = wmUiQ('wmPop');
  if (!WMUI.el || !pop || WMUI.pop !== 'item') return;
  if (!wmItemAt(WMUI.W, WMUI.sel) || WMUI.W.sl[WMUI.sel].it.id !== WMUI.popId) { wmUiPopClose(); wmUiToast('此格已消失'); return; }
  r = wmUiQVals(WMUI.W, WMUI.cs, wmUiTeamSlots(wmUiTeamKey()), WMUI.sel, now);
  for (k = 0; k < WMUI_QKEYS.length; k++) {
    node = pop.querySelector('[data-q="' + WMUI_QKEYS[k] + '"]');
    if (!node) continue;
    if (WMUI_QKEYS[k] === 'warn') node.textContent = r.ok ? r.v.warn : (WMUI_REASON[r.reason] || '');
    else node.textContent = r.ok ? (r.v[WMUI_QKEYS[k]] || '') : '—';
  }
  node = wmUiQ('wmDisp');
  if (node) node.disabled = !(r.ok || (WMUI.opt.qon && (r.reason === 'busy' || r.reason === 'hp' || r.reason === 'sta')));
}
function wmUiTick() {
  var now = Date.now(), pre, r;
  if (!wmUiIsOpenNow() || !WMUI.W) { wmClose(); return; }
  pre = wmUiHpSnap(WMUI.cs);
  r = wmAdvance(WMUI.W, WMUI.cs, now);
  if (r.events.length) {
    wmUiConsume(r.events, pre, false);
    wmUiSave();
    wmUiRenderAll();
    if (WMUI.pop === 'item' && (!wmItemAt(WMUI.W, WMUI.sel) || WMUI.W.sl[WMUI.sel].it.id !== WMUI.popId)) { wmUiPopClose(); wmUiToast('此格已消失'); }
  }
  wmUiCountdowns(now);
  wmUiFill(now);
}
function wmUiCountdowns(now) {
  var nodes, i, t, s, ns;
  if (!WMUI.el) return;
  nodes = WMUI.el.querySelectorAll('[data-cd]');
  for (i = 0; i < nodes.length; i++) {
    t = +nodes[i].getAttribute('data-cd');
    nodes[i].textContent = wmUiDur(t - now);
  }
  for (i = 1; i <= WMUI.W.ar.length; i++) {
    s = wmUiArmySum(WMUI.W, WMUI.cs, i, now);
    if ((ns = WMUI.el.querySelector('[data-ah="' + i + '"]'))) ns.textContent = String(s.hp);
    if ((ns = WMUI.el.querySelector('[data-as="' + i + '"]'))) ns.textContent = String(s.sta);
  }
}

// ───────── 動作 ─────────
function wmUiPickArmy(queue) {
  var W = WMUI.W, n;
  for (n = 1; n <= W.ar.length; n++) if (W.ar[n - 1].st === 'home' && !W.q[n - 1].cm.length) return n;
  if (queue) for (n = 1; n <= W.ar.length; n++) if (!W.q[n - 1].cm.length) return n;
  return 0;
}
function wmUiDispatch() {
  var now = Date.now(), W = WMUI.W, cs = WMUI.cs, si = WMUI.sel, tm = wmUiTeamSlots(wmUiTeamKey()), r, n, msg;
  if (!wmItemAt(W, si) || W.sl[si].it.id !== WMUI.popId) { wmUiPopClose(); wmUiToast('此格已消失'); return; }
  if (!tm.length) { wmUiToast('沒有可派遣的隊伍'); return; }
  wmUiAdv(now);
  if (WMUI.opt.qon) {
    n = wmUiPickArmy(true);
    if (!n) { wmUiToast('三隊都已有預約'); return; }
    r = wmQueueSet(W, cs, n, tm, [{ sl: si, rf: WMUI.opt.rf }], { auto: WMUI.opt.auto });
    if (!r.ok) { wmUiToast(WMUI_REASON[r.reason] || '無法預約'); return; }
    WMUI.lt[n - 1] = tm;
    msg = n + ' 隊已預約 ' + wmUiSlotName(W, si);
  } else {
    r = wmDispatch(W, cs, tm, si, { now: now, auto: WMUI.opt.auto });
    if (r.events) wmUiConsume(r.events, null, false);
    if (!r.ok) { wmUiToast(WMUI_REASON[r.reason] || '無法派遣'); return; }
    WMUI.lt[r.n - 1] = tm;
    msg = r.n + ' 隊出發前往 ' + wmUiSlotName(W, si);
  }
  wmUiSave();
  wmUiPopClose();
  wmUiToast(msg);
  wmUiRenderAll();
}
function wmUiFight(n) {
  var r = wmFight(WMUI.W, WMUI.cs, n, Date.now());
  if (!r.ok) { wmUiToast(WMUI_REASON[r.reason] || '無法開戰'); return; }
  wmUiConsume(r.events, null, false);
  wmUiSave();
  wmUiRenderAll();
}
function wmUiRush(n) {
  var now = Date.now(), W = WMUI.W, cs = WMUI.cs, plan, coin;
  wmUiAdv(now);
  plan = wmUiRushPlan(W, cs, n, now);
  if (!plan.ids.length) { wmUiToast('沒有需要急補的人'); return; }
  coin = (typeof world !== 'undefined' && world && world.res) ? (world.res.coin || 0) : 0;
  if (coin < plan.cost) { wmUiToast('文不足(急補需 ' + plan.cost + ' 文)'); return; }
  if (typeof confirm === 'function' && !confirm(n + ' 隊 ' + plan.ids.length + ' 人急補兵力,花費 ' + plan.cost + ' 文?')) return;
  world.res.coin = coin - plan.cost;
  plan.ids.forEach(function (id) { wmRush(W, cs, id, now); });
  wmUiSave();
  wmUiToast('急補完成,花費 ' + plan.cost + ' 文');
  wmUiRenderAll();
}
function wmUiQCancel(n) {
  wmQueueSet(WMUI.W, WMUI.cs, n, [], [], {});
  wmUiSave();
  wmUiToast(n + ' 隊已取消預約');
  wmUiRenderAll();
}
function wmUiOnClick(e) {
  var t = e && e.target, b = t && t.closest ? t.closest('[data-wm]') : null, a, i;
  if (!b) return;
  if (e.stopPropagation) e.stopPropagation();
  a = b.getAttribute('data-wm');
  i = +b.getAttribute('data-i') | 0;
  if (a === 'close') { wmClose(); return; }
  if (a === 'pick') { wmUiPopOpenItem(i); return; }
  if (a === 'pclose') { wmUiPopClose(); return; }
  if (a === 'dispatch') { wmUiDispatch(); return; }
  if (a === 'fight') { wmUiFight(i); return; }
  if (a === 'rush') { wmUiRush(i); return; }
  if (a === 'qcancel') { wmUiQCancel(i); return; }
  if (a === 'reps') { WMUI.pop = 'reps'; wmUiPopShow(wmUiPopRepsHtml()); return; }
  if (a === 'edit') { wmClose(); if (typeof bnUiToForm === 'function') bnUiToForm(); return; }
}
function wmUiOnChange(e) {
  var t = e && e.target, a = t && t.getAttribute ? t.getAttribute('data-wm') : null, now = Date.now();
  if (!a) return;
  if (a === 'team') { WMUI.team = t.value; if (WMUI.pop === 'item') { wmUiPopShow(wmUiPopItemHtml(WMUI.W, WMUI.sel, now)); wmUiFill(now); } return; }
  if (a === 'auto') { WMUI.opt.auto = !!t.checked; return; }
  if (a === 'qon') { WMUI.opt.qon = !!t.checked; if (WMUI.pop === 'item') { wmUiPopShow(wmUiPopItemHtml(WMUI.W, WMUI.sel, now)); wmUiFill(now); } return; }
  if (a === 'qrf') { WMUI.opt.rf = +t.value | 0; return; }
}

// ───────── 開 / 關 / 返回 ─────────
function wmIsOpen() { return wmUiIsOpenNow(); }
function wmOpen() {
  var el, cs, now = Date.now();
  if (wmGuardOff()) return false;
  if (typeof bnu === 'undefined' || !bnu || !bnu.open || !bnu.layer) return false;
  if (bnu.phase === 'fight') return false;
  cs = wmUiCs();
  if (!cs) { wmUiToast('請先建立城市'); return false; }
  wmUiCss();
  if (!wmIsOpen()) {
    el = document.createElement('div');
    el.id = 'wmPanel';
    el.innerHTML = '<div id="wmBody"><div class="wm-top"><b class="wm-h">外勤</b><button data-wm="close">← 返回</button></div><p class="wm-sm">清單每格會刷新;離開時也會照算,回來時結算</p>' +
      '<div class="wm-sec">清單(採集 5 格 · 據點 3 格)</div><div id="wmList"></div>' +
      '<div class="wm-sec">出外部隊</div><div id="wmArmy"></div></div><div id="wmPop"></div>';
    el.addEventListener('click', wmUiOnClick);
    el.addEventListener('change', wmUiOnChange);
    bnu.layer.appendChild(el);
    WMUI.el = el;
  }
  wmUiBoot(cs, now);
  wmUiPopClose();
  wmUiRenderAll();
  if (!WMUI.timer && typeof setInterval === 'function') WMUI.timer = setInterval(wmUiTick, 1000);
  if (WMUI.away && WMUI.away.length) { WMUI.pop = 'away'; wmUiPopShow(wmUiPopAwayHtml(WMUI.away)); WMUI.away = null; }
  return true;
}
function wmClose() {
  var el = WMUI.el;
  if (WMUI.timer && typeof clearInterval === 'function') clearInterval(WMUI.timer);
  WMUI.timer = 0;
  if (!el) return false;
  el.removeEventListener('click', wmUiOnClick);
  el.removeEventListener('change', wmUiOnChange);
  if (el.parentNode) el.parentNode.removeChild(el);
  WMUI.el = null;
  WMUI.pop = ''; WMUI.sel = -1; WMUI.popId = '';
  if (WMUI.W && WMUI.cs) wmUiSave();
  if (typeof bnUiRenderEntry === 'function' && typeof bnu !== 'undefined' && bnu && bnu.open) bnUiRenderEntry();
  return true;
}
// 返回鍵:派遣面板 / 戰報 / 離開期間摘要先關;再按關外勤
function wmBack() {
  if (!wmIsOpen()) return false;
  if (WMUI.pop) { wmUiPopClose(); return true; }
  wmClose();
  return true;
}
function wmUiCss() {
  var s;
  if (WMUI.css || typeof document === 'undefined' || !document.createElement || !document.head) return;
  WMUI.css = true;
  s = document.createElement('style');
  s.id = 'wmUiCss';
  s.textContent = '#wmPanel{position:absolute;left:0;top:0;right:0;bottom:0;z-index:9;overflow:hidden;background:#1b150f;color:#f4ead2;font-size:13px;box-sizing:border-box}' +
    '#wmBody{position:absolute;left:0;top:0;right:0;bottom:0;overflow-x:hidden;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:10px calc(12px + env(safe-area-inset-right)) 24px calc(12px + env(safe-area-inset-left));box-sizing:border-box}' +
    '#wmPanel .wm-top{display:flex;align-items:center;justify-content:space-between;gap:8px}#wmPanel .wm-h{font-size:17px;color:#ffd25a}#wmPanel p{margin:4px 0 0}' +
    '#wmPanel .wm-sec{margin:10px 0 4px;font-size:12px;color:#ffd25a}' +
    '#wmPanel button{font:inherit;color:#f4ead2;background:#3a2c1c;border:1px solid #6b5230;border-radius:8px;min-height:44px;min-width:44px;padding:0 10px;margin:2px 4px 2px 0;box-sizing:border-box}' +
    '#wmPanel button.pri{background:#7a5418;border-color:#c9952e}#wmPanel button:disabled{opacity:.45}' +
    '#wmPanel .wm-row{display:flex;align-items:center;gap:8px;width:100%;min-height:56px;box-sizing:border-box;padding:6px 8px;margin:0 0 6px;text-align:left;background:#2a2016;border:1px solid #6b5230;border-radius:8px}' +
    '#wmPanel .wm-row.wm-emp{opacity:.6}#wmPanel .wm-ic{flex:0 0 auto;font-size:22px;width:28px;text-align:center}' +
    '#wmPanel .wm-mid{flex:1 1 auto;min-width:0;display:flex;flex-direction:column}' +
    '#wmPanel .wm-nm{font-weight:bold;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
    '#wmPanel .wm-rc{font-style:normal;font-size:11px;margin-left:4px}' +
    '#wmPanel .wm-sm{font-size:12px;color:#d9ccaa;overflow-wrap:anywhere}#wmPanel .wm-rt{flex:0 0 auto;display:flex;flex-direction:column;align-items:flex-end;text-align:right}' +
    '#wmPanel .wm-arm{background:#2a2016;border:1px solid #6b5230;border-radius:8px;padding:6px 8px;margin:0 0 6px}' +
    '#wmPanel .wm-ah{display:flex;flex-wrap:wrap;gap:6px;align-items:baseline}#wmPanel .wm-st{color:#7fd69a}#wmPanel .wm-cd b{color:#ffd25a}' +
    '#wmPanel .wm-warn{color:#f0a040}#wmPanel .wm-ab{margin-top:4px}' +
    '#wmPop{display:none;position:absolute;left:0;right:0;bottom:0;max-height:76%;overflow-y:auto;-webkit-overflow-scrolling:touch;background:#241b12;border-top:1px solid #c9952e;padding:10px 12px calc(12px + env(safe-area-inset-bottom));box-sizing:border-box;z-index:2}' +
    '#wmPanel.pop-on #wmPop{display:block}#wmPop .wm-ph{display:flex;align-items:center;gap:8px;margin-bottom:4px;font-size:15px}#wmPop .wm-ph button{margin:0 0 0 auto}' +
    '#wmPop .wm-f{display:block;margin:6px 0}#wmPop .wm-ck{display:block;padding:4px 0;min-height:32px}#wmPop select{font:inherit;min-height:36px;margin-left:4px;background:#3a2c1c;color:#f4ead2;border:1px solid #6b5230;border-radius:6px}' +
    '#wmPop .wm-q{margin:8px 0;padding:6px 8px;background:#2a2016;border-radius:8px;line-height:1.7}#wmPop .wm-rep{padding:6px 0;border-bottom:1px solid #3a2c1c}' +
    '@media (min-width:700px) and (orientation:landscape){#wmPop{left:auto;width:50%;max-height:none;top:0;border-top:0;border-left:1px solid #c9952e;padding-bottom:12px}}';
  document.head.appendChild(s);
}

// js/wd_ui.js — 地圖頁(設計線③):上方收成列 + 分頁 + 點的卡片網格 + 下方隊伍狀態列;點詳情 / 選隊 / 集結排序 / 自動派遣確認表 / 戰報。
// 規則全在 wd_core.js;本檔只組字、接按鈕、入帳、存檔。畫面參考 世界玩法設計/地圖頁_預覽.html。沒有任何走動動畫:進行中只用倒數文字與進度條。
// 入口:shell.js 的 case 'wm'(world 旗標開時)→ wdOpen();外框沿用外勤做法(bnu.layer + pfOpen,標題「城門・地圖」)。返回鍵:bnUiBack → wdBack()。
// 存檔:localStorage 'lorddomain.world.v2' = wdSave(W);另呼叫 saveWorld()(卡片 use 欄位隨世界存)。
// 推進:開啟時 wdAdvance 一次,開啟期間每秒 wdUiTick:有事件才整頁重畫(保留捲動位置、按住時不重畫),否則只更新倒數文字 / 進度條。
// 入帳:一鍵收成 → 糧 res4Add(world.res.grain,res4.js)、生鐵 / 獸皮 / 木炭 / 礪石 matGrant(mat.js);戰利 coin → world.res.coin;材料 → matGrant(鍛造材料,存在才用)或 cityGoodsAdd 占位貨物。
// 校場 / 名聲:地圖頁收成列的按鈕開子頁(內容由 rsvui.js 產生);開啟與每秒推進時先 rsvSettle(now) 再 wdAdvance(0.2 結算順序)。
// 對外:wdTerritory() → {res,county,jun,pass,total};wdBadge() → 可收成 / 有未看的回城;wdOpen()。ES2017;不用 ?. ??。不發聲。
// 全域:WDUI wdOpen wdClose wdIsOpen wdBack wdTerritory wdBadge wdUiTick wdUiBoot wdUiSave wdUiConsume wdUiGrant wdUiCollect wdUiMapHtml wdUiPtHtml wdUiPickHtml wdUiAutoHtml wdUiRlistHtml wdUiRptHtml wdUiGuardHtml wdUiCss

var WDUI_KEY = 'lorddomain.world.v2';
var WDUI = { el: null, timer: 0, W: null, cs: null, css: false, cat: 'res', sub: '全部', stack: [], press: false };
var WDUI_REASON = {
  frozen: '時鐘異常,暫不出發', nopt: '這個點已經不在了', cat: '這個點不能這樣用', owned: '這個點已經占領了', cleared: '山寨已討平', busy: '已經有隊伍前往這個點', army: '這隊不在城裡',
  size: '隊伍人數不對', dup: '同一張卡不能上兩隊', missing: '有人已不在名冊', samefig: '同名名人不可同隊', hurt: '有人重傷中', field: '有人外勤中', appoint: '有人委任中(內政官),先解除委任',
  garrison: '有人駐派中,先撤回駐派', rallymax: '集結最多 10 隊', notowned: '這個點還不是你的', guarded: '這個點已經有人駐守', cap: '駐守名額已滿',
  lowtrp: '兵力不足,請到校場補兵'
};
var WDUI_SUBS = [['全部', ''], ['野怪', 'beast'], ['山寨', 'camp'], ['縣郡', 'county'], ['關口', 'pass']];

// ───────── 小工具 ─────────
function wdUiEsc(s) { return (typeof bnUiEsc === 'function') ? bnUiEsc(s) : String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
function wdUiFmt(n) { return Math.floor(+n || 0).toLocaleString(); }
function wdUiResTxt() {
  var a = [['🔩', 'm_iron1'], ['🟫', 'm_hide1'], ['⚫', 'm_coal'], ['🪨', 'm_whet']], s = [];
  if (typeof res4Get !== 'function') return '';
  s.push('🌾 ' + wdUiFmt(res4Get('grain')));
  if (typeof matCount === 'function') a.forEach(function (x) { s.push(x[0] + ' ' + wdUiFmt(matCount(x[1]))); });
  return s.join('  ');
}
function wdUiToast(m) { if (typeof bnUiToast === 'function') bnUiToast(m); }
function wdUiLsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function wdUiLsSet(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }
function wdUiCs() { return (typeof cardsGet === 'function') ? cardsGet() : null; }
function wdUiDur(ms) {
  var s = Math.max(0, Math.ceil(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60, p = function (n) { return (n < 10 ? '0' : '') + n; };
  return h > 0 ? h + ':' + p(m) + ':' + p(x) : p(m) + ':' + p(x);
}
function wdUiHM(ms) { var d = new Date(ms), p = function (n) { return (n < 10 ? '0' : '') + n; }; return p(d.getHours()) + ':' + p(d.getMinutes()); }
function wdUiGoodsName(id) { return (typeof GOODS !== 'undefined' && GOODS[id]) ? GOODS[id].name : id; }
function wdUiQ(sel) { return WDUI.el && WDUI.el.querySelector ? WDUI.el.querySelector(sel) : null; }
function wdUiIsOpenNow() { return !!(WDUI.el && WDUI.el.parentNode && typeof bnu !== 'undefined' && bnu && bnu.layer && WDUI.el.parentNode === bnu.layer); }
function wdUiCircle(n) { return '①②③④⑤⑥⑦⑧⑨⑩'.charAt((n | 0) - 1) || String(n); }
function wdUiIcon(pt) { return pt.cat === 'res' ? (WD_ICON[pt.ty] || '❔') : (WD_ICON[pt.cat] || '❔'); }
function wdUiCardName(cs, id) { var e = wdCard(cs, id); return e ? e.name : id; }
function wdUiLootTxt(loot) {
  var a = [], k;
  if (!loot) return '無';
  for (k in loot.mats || {}) a.push(((typeof MATS !== 'undefined' && MATS[k] && typeof matName === 'function') ? matName(k) : wdUiGoodsName(k)) + ' ×' + loot.mats[k]);
  if (loot.coin) a.push(loot.coin + ' 文');
  return a.length ? a.join('、') : '無';
}

// ───────── 存檔 / 載入 / 推進 / 入帳 ─────────
function wdUiSave() {
  if (!WDUI.W) return;
  if (!wdUiLsSet(WDUI_KEY, wdSave(WDUI.W))) wdUiToast('地圖存檔失敗');
  if (typeof saveWorld === 'function') saveWorld();
}
function wdUiBoot(cs, now) {
  var raw = wdUiLsGet(WDUI_KEY), r;
  WDUI.cs = cs;
  WDUI.W = wdLoad(raw || 'null', now, cs.seed, cs);
  if (typeof evTutEnsure === 'function') evTutEnsure(WDUI.W, now);   // 開場:新存檔補新手寨(js/ld_open_wd.js;ldui)
  if (typeof rsvSettle === 'function') rsvSettle(now);   // 先結算預備兵,回城的隊才補得到
  r = wdAdvance(WDUI.W, cs, now);
  wdUiConsume(r.events, true);
  wdUiSave();
  return r;
}
function wdUiEnsure() {
  var cs;
  if (WDUI.W && WDUI.cs) return true;
  cs = wdUiCs();
  if (!cs) return false;
  wdUiBoot(cs, Date.now());
  return true;
}
function wdUiAdv(now) {
  var r;
  if (typeof rsvSettle === 'function') rsvSettle(now);
  r = wdAdvance(WDUI.W, WDUI.cs, now);
  if (r.events.length) wdUiConsume(r.events, false);
  return r;
}
function wdUiGrant(loot) {
  var k;
  if (!loot) return;
  if (loot.coin > 0 && typeof world !== 'undefined' && world && world.res) world.res.coin = (world.res.coin || 0) + loot.coin;
  if (loot.forge && typeof matGrant === 'function') { matGrant(loot.mats); return; }
  if (typeof cityGoodsAdd === 'function') for (k in loot.mats || {}) if (loot.mats[k] > 0) cityGoodsAdd(k, loot.mats[k]);
}
// 開地圖時顯示征兵完成(收成清單用 rsvTakeDone)
function wdUiRsvNotice() {
  var d, tot = 0;
  if (typeof rsvTakeDone !== 'function' || typeof hvCollect === 'function') return;
  d = rsvTakeDone();
  d.forEach(function (x) { if (x.kind === 'q') tot += x.n; });
  if (tot > 0) wdUiToast('征兵完成 +' + wdUiFmt(tot));
}
function wdUiConsume(evs, boot) {
  var msgs = [];
  (evs || []).forEach(function (ev) {
    if (ev.k === 'report') {
      wdUiGrant(ev.loot);
      msgs.push((ev.win ? '勝 ' : '敗 ') + ev.ptName + (ev.wipe ? '(全滅)' : '') + (ev.fame > 0 ? ' 名聲 +' + ev.fame : ''));
      if (ev.unlocked && ev.unlocked.length) msgs.push('名聲開放:' + ev.unlocked.join('、'));
    } else if (ev.k === 'home') msgs.push(ev.team + ' 隊' + (ev.wiped ? '全滅回城' : '回城'));
    else if (ev.k === 'gend') msgs.push(ev.ptName + ' 駐守到期');
    else if (ev.k === 'autoguard') msgs.push('自動駐守');
    else if (ev.k === 'miss') msgs.push('撲空');
  });
  if (!boot && msgs.length) wdUiToast(msgs.slice(0, 3).join(';'));
}
// 一鍵收成:取整數入既有資源庫
function wdUiCollect() {
  var now = Date.now(), got, txt = [];
  if (!WDUI.W) return null;
  wdUiAdv(now);
  got = wdCollect(WDUI.W, now);
  WD_HARV_KEYS.forEach(function (k) {
    var g = {};
    if (!(got[k] > 0)) return;
    if (WD_HARV_RES4[k]) { g[WD_HARV_RES4[k]] = got[k]; if (typeof res4Add === 'function') res4Add(g); txt.push(k + ' +' + got[k]); }
    else if (WD_HARV_MAT[k]) { g[WD_HARV_MAT[k]] = got[k]; if (typeof matGrant === 'function') matGrant(g); txt.push(k + ' +' + got[k]); }
  });
  if (got.shards > 0 && typeof cardsShardGain === 'function' && wdUiCs()) { cardsShardGain(wdUiCs(), got.shards); txt.push('碎片 +' + got.shards); }   // 寶地碎片
  wdUiSave();
  wdUiToast(txt.length ? '收成:' + txt.join(' ') : '目前沒有可收的');
  wdUiRender();
  return got;
}

// ───────── 對外 ─────────
function wdTerritory() {
  if (!wdUiEnsure()) return { res: 0, county: 0, jun: 0, pass: 0, total: 0 };
  return wdTerritoryOf(WDUI.W);
}
function wdBadge() {
  if (!wdUiEnsure()) return false;
  wdUiAdv(Date.now());
  return wdBadgeOf(WDUI.W, Date.now());
}

// ───────── 隊伍 ─────────
function wdUiTeams() { return wdTeams(); }
function wdUiTeamByN(n) {
  var l = wdUiTeams(), i;
  for (i = 0; i < l.length; i++) if (l[i].n === n) return l[i];
  return null;
}
// 隊伍狀態:{k:'trip'|'hurt'|'busy'|'ok', ...}
function wdUiTeamState(W, cs, team, now) {
  var tr = wdTeamTrip(W, team.n), left = 0, chk;
  if (tr) return { k: 'trip', trip: tr, ok: false, reason: 'army' };
  team.slots.forEach(function (s) { left = Math.max(left, wdHurtLeft(W, s.id, now)); });
  if (left > 0) return { k: 'hurt', left: left, ok: false, reason: 'hurt' };
  chk = wdCheckSlots(W, cs, team.slots, now);
  if (!chk.ok) return { k: 'busy', ok: false, reason: chk.reason };
  return { k: 'ok', ok: true, reason: '' };
}
function wdUiOdds(my, foe) {
  var r = foe > 0 ? my / foe : 9;
  return r >= WD_CFG.autoMul ? ['穩勝', 'good'] : (r >= 1 ? ['五五', 'mid'] : ['難勝', 'bad']);
}
function wdUiFoeTotalPower(W, pt) {
  var s = 0, j;
  for (j = 0; j < pt.nf; j++) s += wdFoeTeam(W, pt, j).power;
  return s;
}
function wdUiTeamCell(W, cs, team, now) {
  var st = wdUiTeamState(W, cs, team, now), tr = st.trip, pt, nm = wdUiCircle(team.n) + ' ' + wdUiEsc(team.name), body = '', pg = '', cls = 'wd-tm';
  if (st.k === 'trip') {
    pt = wdPt(W, tr.pt);
    if (tr.st === 'go') { body = '去 ' + wdUiEsc(pt ? pt.ty : '') + ' <b data-cd="' + tr.tArrive + '">' + wdUiDur(tr.tArrive - now) + '</b>'; pg = '<div class="wd-pg"><div data-pg="1" data-a="' + tr.t0 + '" data-b="' + tr.tArrive + '" style="width:' + wdUiPct(tr.t0, tr.tArrive, now) + '%"></div></div>'; }
    else { body = '回程 <b data-cd="' + tr.tHome + '">' + wdUiDur(tr.tHome - now) + '</b>'; pg = '<div class="wd-pg"><div data-pg="1" data-a="' + tr.tArrive + '" data-b="' + tr.tHome + '" style="width:' + wdUiPct(tr.tArrive, tr.tHome, now) + '%"></div></div>'; }
  } else if (st.k === 'hurt') { body = '重傷 <b data-cd="' + (now + st.left) + '">' + wdUiDur(st.left) + '</b>'; cls += ' hurt'; }
  else body = '在城・戰力 ' + Math.round(wdTeamPowerR(W, cs, team.slots, now)) + (wdTeamRatio(W, cs, team.slots, now) < 0.995 ? '・兵 ' + Math.round(wdTeamRatio(W, cs, team.slots, now) * 100) + '%' : '');
  return '<div class="' + cls + '"><b>' + nm + '</b><div>' + body + '</div>' + pg + '</div>';
}
function wdUiPct(a, b, now) { return Math.max(0, Math.min(100, Math.round((now - a) / Math.max(1, b - a) * 100))); }

// ───────── 點卡片 / 地圖頁 ─────────
function wdUiSubOf(pt) { return pt.cat === 'beast' ? '野怪' : (pt.cat === 'camp' ? '山寨' : (pt.cat === 'pass' ? '關口' : (pt.cat === 'res' ? '' : '縣郡'))); }
function wdUiPtStatus(W, cs, pt, now) {
  var trips = wdTripsTo(W, pt.id), tr = trips[0];
  if (tr) return { c: 'go', h: '前往中 <b data-cd="' + tr.tArrive + '">' + wdUiDur(tr.tArrive - now) + '</b>' + (trips.length > 1 ? '(' + trips.length + '隊)' : '') };
  if (pt.guard) return { c: 'me', h: '駐守:' + wdUiEsc(wdUiCardName(cs, pt.guard.card)) + ' 剩 <b data-cd="' + pt.guard.t1 + '">' + wdUiDur(pt.guard.t1 - now) + '</b>' };
  if (pt.cat === 'res' && pt.owner) return { c: 'me', h: '已占領・待派人駐守' };
  if (pt.owner) return { c: 'me', h: '已攻下' };
  if (pt.cl) return { c: 'done', h: '已討平 補新 <b data-cd="' + pt.rs + '">' + wdUiDur(pt.rs - now) + '</b>' };
  return { c: '', h: pt.cat === 'res' ? '無主' : '守軍駐守中' };
}
function wdUiPtCard(W, cs, pt, now) {
  var s = wdUiPtStatus(W, cs, pt, now), hp = '', ratio, mins = pt.mins + ' 分';
  if (pt.cat !== 'res' && pt.cat !== 'camp' && !pt.owner) {
    ratio = wdFoeRatio(W, pt, now);
    hp = '<div class="wd-hp"><div style="width:' + Math.round(ratio * 100) + '%"></div></div>';
  }
  return '<button class="wd-pt ' + s.c + (pt.cat === 'beast' ? ' beast' : '') + (pt.act ? ' act' : '') + '" data-wd="pt" data-id="' + pt.id + '"><h4><span>' + wdUiIcon(pt) + ' ' + wdUiEsc(pt.ty) + '</span><i>Lv' + pt.lv + '</i></h4>' +
    '<div class="wd-sm">守軍 ' + pt.nf + ' 隊・行軍 ' + mins + (pt.act ? '・活動' : '') + '</div>' + hp + '<div class="wd-st">' + s.h + '</div></button>';
}
function wdUiVisible(W, cat, sub) {
  var l0 = wdUiVisible0(W, cat, sub);
  return typeof ldoWdVisible === 'function' ? ldoWdVisible(W, l0, cat, sub) : l0;   // 開場:未開放的點 / 類別隱藏(js/ld_open_ui.js;ldui)
}
function wdUiVisible0(W, cat, sub) {
  var l;
  if (cat === 'res') return W.pts.filter(function (p) { return p.cat === 'res'; }).sort(function (a, b) { return b.lv - a.lv; });
  l = W.pts.filter(function (p) { return p.cat !== 'res'; });
  if (sub !== '全部') l = l.filter(function (p) { return wdUiSubOf(p) === sub; });
  return l.sort(function (a, b) { return (a.cat < b.cat ? -1 : a.cat > b.cat ? 1 : 0) || b.lv - a.lv; });
}
function wdUiMapHtml(W, cs, now) {
  var h = '', pend = wdHarvPending(W, now), any = false, cap = wdGuardCap(W), used = wdGuardUsed(W), nRes = W.pts.filter(function (p) { return p.cat === 'res'; }).length, teams = wdUiTeams(), list, rsv = null;
  h += '<div class="wd-harv"><span>收成</span>';
  rsv = (typeof rsvGet === 'function') ? rsvGet() : null;
  if (typeof ldoWdForce === 'function') ldoWdForce();   // 開場:資源分頁未開放前停在中立
  WD_HARV_KEYS.forEach(function (k) { var n = Math.floor(pend[k] + 1e-9); if (n > 0) { any = true; h += ' ' + k + ' <b>+' + n + '</b>'; } });
  if (!any) h += '<span class="wd-sm">目前沒有可收的</span>';
  h += '<span class="wd-sp"></span><span class="wd-sm">駐守 ' + used + '/' + cap + '</span> <button class="wd-b g" data-wd="collect"' + (any ? '' : ' disabled') + '>一鍵收成</button> <button class="wd-b" data-wd="rlist">戰報 ' + W.rp.length + '</button></div>';
  if (rsv) h += '<div class="wd-harv"><button class="wd-b" data-wd="rsv">校場 預備兵 ' + wdUiFmt(rsv.n) + '/' + wdUiFmt(rsvCap()) + (rsvBadge() ? ' 🔴' : '') + '</button><button class="wd-b" data-wd="fame">名聲 ' + wdUiFmt(typeof fameGet === 'function' ? fameGet() : 0) + '</button><span class="wd-sm">' + wdUiResTxt() + '</span>' + (rsv.lack.n > 0 ? '<span class="wd-red">隊伍補不滿(缺 ' + wdUiFmt(rsv.lack.n) + ' 兵),請征兵</span>' : '') + '</div>';
  h += '<div class="wd-tabs">' + ((typeof ldoWdTabOk === 'function' && !ldoWdTabOk('res')) ? '' : '<button class="wd-tab' + (WDUI.cat === 'res' ? ' on' : '') + '" data-wd="cat" data-v="res">資源 ' + nRes + '</button>') + '<button class="wd-tab' + (WDUI.cat === 'mid' ? ' on' : '') + '" data-wd="cat" data-v="mid">中立</button><button class="wd-tab lock" data-wd="pvp">玩家🔒</button>';
  if (WDUI.cat === 'mid') WDUI_SUBS.forEach(function (s) { if (typeof ldoWdSubOk === 'function' && !ldoWdSubOk(s[0])) return; h += '<button class="wd-tab sub' + (WDUI.sub === s[0] ? ' on' : '') + '" data-wd="sub" data-v="' + s[0] + '">' + s[0] + '</button>'; });
  if (WDUI.cat === 'res' && !(typeof ldoWdAutoOk === 'function' && !ldoWdAutoOk())) h += '<span class="wd-sp"></span><button class="wd-b" data-wd="auto">自動派遣</button>';
  h += '</div><div class="wd-grid">';
  list = wdUiVisible(W, WDUI.cat, WDUI.sub);
  if (WDUI.cat === 'mid' && (WDUI.sub === '全部' || WDUI.sub === '野怪') && typeof ldoWdBossCard === 'function') h += ldoWdBossCard(now);   // 活動首領卡(團結關)
  list.forEach(function (p) { h += wdUiPtCard(W, cs, p, now); });
  if (!list.length) h += '<div class="wd-sm">目前沒有。</div>';
  h += '</div><div class="wd-teams">';
  teams.forEach(function (t) { h += wdUiTeamCell(W, cs, t, now); });
  if (!teams.length) h += '<div class="wd-sm">還沒有預設隊伍:到布陣存入隊伍後才能出征。</div>';
  return h + '</div>';
}

// ───────── 點詳情 ─────────
function wdUiYieldTxt(pt) {
  var key = WD_RES_KEY[pt.ty], base = (WD_CFG.yield[pt.ty] || 0) * pt.lv;
  if (!key) return '';
  return key + (base >= 10 ? ' 每小時約 ' + base : ' 每天約 ' + Math.round(base * 24 * 10) / 10) + '(駐守卡星階越高、兵種越契合越多)';
}
function wdUiPtHtml(W, cs, id, now) {
  var pt = wdPt(W, id), s, h = '', cat, foeTxt, ratio;
  if (!pt) return '<div class="wd-card">這個點已經不在了。</div>';
  s = wdUiPtStatus(W, cs, pt, now);
  h += '<div class="wd-card"><div class="wd-row"><b class="wd-big">' + wdUiIcon(pt) + ' ' + wdUiEsc(pt.ty) + '</b> Lv' + pt.lv + ' <span class="wd-sm">' + WD_CAT_TXT[pt.cat] + (pt.act ? '・活動' : '') + '</span></div>';
  foeTxt = '守軍 ' + pt.nf + ' 隊 × 3 人,戰力約 ' + wdUiFoeTotalPower(W, pt);
  h += '<div>' + foeTxt + '</div><div>行軍 ' + pt.mins + ' 分鐘(回程 ' + Math.round(pt.mins / WD_CFG.retDiv * 10) / 10 + ' 分鐘)</div>';
  if (pt.cat !== 'res' && pt.cat !== 'camp' && !pt.owner) {
    ratio = wdFoeRatio(W, pt, now);
    h += '<div>剩餘血量 ' + Math.round(ratio * 100) + '%<div class="wd-hp"><div style="width:' + Math.round(ratio * 100) + '%"></div></div></div>';
    if (pt.cat === 'beast') h += '<div class="wd-sm">血很厚,一隊打不完:用「集結」讓多隊輪流打(每隊打到被打死或滿 10 回合換下一隊)。' + (pt.act ? '活動關卡:沒打死血量不回復,可再集結。' : '一般關卡:全部打完沒打死算失敗,血量回滿。') + '</div>';
    else if (pt.cat !== 'camp') h += '<div class="wd-sm">沒攻下:守軍傷勢保留,24 小時內慢慢回滿。</div>';
  }
  if (pt.cat === 'res') h += '<div>產出:' + wdUiYieldTxt(pt) + '</div>';
  h += '<div>狀態:<b>' + s.h + '</b></div></div><div class="wd-row">';
  cat = pt.cat;
  if (cat === 'res' && !pt.owner && !s.c) h += '<button class="wd-b pri" data-wd="send">派兵占領</button>';
  if (cat === 'res' && pt.owner && !pt.guard) h += '<button class="wd-b g" data-wd="guardpick">派 1 人駐守</button><span class="wd-sm">駐守 ' + wdGuardUsed(W) + '/' + wdGuardCap(W) + '・24 小時後自動回城</span>';
  if (cat === 'camp' && !pt.cl && !s.c) h += '<button class="wd-b pri" data-wd="send">派兵討伐</button>';
  if ((cat === 'beast' || cat === 'county' || cat === 'jun' || cat === 'pass') && !pt.owner && !s.c) h += '<button class="wd-b pri" data-wd="rally">集結(最多 ' + WD_CFG.rallyMax + ' 隊)</button>';
  h += '</div>';
  if (typeof ldoWdPtRsv === 'function') h += ldoWdPtRsv(W, pt, now) + (pt.cat === 'beast' || pt.cat === 'county' || pt.cat === 'jun' || pt.cat === 'pass' ? ldoWdRsvLog(W) : '');   // 預約 / 撤回 / 預約紀錄(ldui)
  return h;
}

// ───────── 選隊(單選 / 集結多選排序) ─────────
function wdUiPickHtml(W, cs, top, now) {
  var pt = wdPt(W, top.id), multi = !!top.multi, h = '', foeP;
  if (!pt) return '<div class="wd-card">這個點已經不在了。</div>';
  foeP = wdUiFoeTotalPower(W, pt);
  h += '<div class="wd-sm">' + (multi ? '勾選要上場的隊,點的順序 = 出場順序。單機只有自己的隊;以後玩家一起打時上限 ' + WD_CFG.rallyMax + ' 隊。' : '選一隊出發。去程 ' + pt.mins + ' 分,回程是去程的 1/4。') + '</div>';
  wdUiTeams().forEach(function (t) {
    var st = wdUiTeamState(W, cs, t, now), k = top.sel.indexOf(t.n), pw = Math.round(wdTeamPowerR(W, cs, t.slots, now)), o = wdUiOdds(pw, foeP), side;
    side = st.ok ? '戰力 ' + pw + (multi ? '' : ' <b class="od ' + o[1] + '">' + o[0] + '</b>') : (WDUI_REASON[st.reason] || st.reason);
    h += '<button class="wd-pick' + (k >= 0 ? ' sel' : '') + (st.ok ? '' : ' off') + '" data-wd="tm" data-n="' + t.n + '"' + (st.ok ? '' : ' disabled') + '><span class="n">' + (k >= 0 ? (multi ? k + 1 : '✓') : '') + '</span><b>' + wdUiEsc(t.name) + '</b><span class="wd-sp"></span><span>' + side + '</span></button>';
  });
  if (typeof ldoWdRsvRow === 'function') h += ldoWdRsvRow(top, W, now);   // 預約時段列 + 確認表(ldui)
  h += '<div class="wd-row"><button class="wd-b pri" data-wd="go"' + (top.sel.length ? '' : ' disabled') + '>' + (multi ? (top.tFight ? '確定預約(' : '集結出發(') + top.sel.length + ' 隊)' : '出發') + '</button></div>';
  return h;
}

// ───────── 駐守選卡 ─────────
function wdUiGuardCands(W, cs, pt, now) {
  var teams = wdUiTeams(), inTeam = wdTeamIds(teams), out = [];
  cs.roster.forEach(function (e) {
    var fit, k;
    if (inTeam[e.id] || wdHurtLeft(W, e.id, now) > 0) return;
    if (typeof cardsUseFree === 'function' && !cardsUseFree(e)) return;
    fit = WD_CFG.fit[wdTroopOfCard(e)] === pt.ty ? 1 : 0;
    out.push({ e: e, fit: fit, star: wdStarOf(e), pw: wdTeamPower(cs, [{ id: e.id, row: 0, col: 0, troop: '' }]) });
  });
  out.sort(function (a, b) { return b.fit - a.fit || b.star - a.star || b.pw - a.pw; });
  return out;
}
function wdUiGuardHtml(W, cs, id, now) {
  var pt = wdPt(W, id), h = '', c;
  if (!pt) return '<div class="wd-card">這個點已經不在了。</div>';
  c = wdUiGuardCands(W, cs, pt, now);
  h += '<div class="wd-sm">從閒置的卡裡選 1 張駐守 ' + wdUiEsc(pt.ty) + '(不含隊伍裡的卡、重傷與占用中的卡)。兵種契合 ×' + WD_CFG.fitMul + ';星階越高產量越多。</div>';
  if (!c.length) h += '<div class="wd-card">沒有閒置的卡。</div>';
  c.slice(0, 12).forEach(function (x, i) {
    h += '<button class="wd-pick" data-wd="gcard" data-id="' + wdUiEsc(x.e.id) + '"><b>' + wdUiEsc(x.e.name) + '</b><span class="wd-sp"></span><span>' + wdUiTroopName(x.e) + ' ★' + x.star + (x.fit ? ' 契合' : '') + ' 戰力 ' + x.pw + (i === 0 ? ' <b class="od good">建議</b>' : '') + '</span></button>';
  });
  return h;
}
function wdUiTroopName(e) { return wdTroopOfCard(e) || '—'; }

// ───────── 自動派遣確認表 ─────────
function wdUiAutoHtml(W, cs, plan, now) {
  var h = '<div class="wd-sm">規則:只派「穩勝」(我方戰力 ≥ 守軍 ' + WD_CFG.autoMul + ' 倍)的點;從等級高的點開始,每點派剛好打得贏的最弱一隊,強隊留給野怪和攻城。打下後自動挑 1 張閒置卡駐守(兵種契合優先、其次星階高),不動隊伍裡的卡。</div>';
  if (!plan.length) return h + '<div class="wd-card">目前沒有可以穩勝的點,或沒有閒置的隊伍 / 駐守名額。</div>';
  h += '<div class="wd-card"><table><tr><th>隊伍</th><th>去哪</th><th>勝算</th><th>預計回城</th></tr>';
  plan.forEach(function (x) {
    var o = wdUiOdds(x.myPower, x.foePower), back = x.mins + Math.round(x.mins / WD_CFG.retDiv * 10) / 10;
    h += '<tr><td>' + wdUiEsc(x.team.name) + '</td><td>' + wdUiEsc(x.ptName) + ' Lv' + x.lv + '</td><td class="od ' + o[1] + '">' + o[0] + '</td><td>' + back + ' 分後</td></tr>';
  });
  return h + '</table></div><div class="wd-row"><button class="wd-b pri" data-wd="autogo">確定出發(' + plan.length + ' 隊)</button></div>';
}

// ───────── 戰報 ─────────
function wdUiRpTitle(rp) { return (rp.kind === 'rally' ? '集結 → ' : '出征 → ') + rp.ptName; }
function wdUiRlistHtml(W, now) {
  var h = '';
  if (!W.rp.length) return '<div class="wd-card">還沒有戰報。</div>';
  W.rp.forEach(function (rp) {
    h += '<button class="wd-rp" data-wd="rpt" data-id="' + rp.id + '"><b>' + wdUiEsc(wdUiRpTitle(rp)) + '</b><span class="wd-sp"></span><span class="wd-sm">' + wdUiHM(rp.t) + '</span> <b class="' + (rp.win ? 'okc' : 'ngc') + '">' + (rp.win ? '勝' : '敗') + '</b></button>';
  });
  return h;
}
function wdUiRecOk(W, idx) { var rec = idx ? wdRecOf(W, idx) : null; return !!rec && rec.v === BN_REC_VER; }
function wdUiRptHtml(W, cs, id, now) {
  var rp = null, h = '', i, foeN;
  for (i = 0; i < W.rp.length; i++) if (W.rp[i].id === id) { rp = W.rp[i]; break; }
  if (!rp) return '<div class="wd-card">找不到這份戰報。</div>';
  h += '<div class="wd-card"><b>' + wdUiEsc(wdUiRpTitle(rp)) + '</b>　<b class="' + (rp.win ? 'okc' : 'ngc') + '">' + (rp.win ? '勝利' : '失敗') + '</b><div class="wd-sm">' + wdUiHM(rp.t) + '</div></div>';
  rp.rows.forEach(function (r) {
    var txt;
    if (r.skipped) txt = '守軍已被前面的隊打光,未出手';
    else txt = '打守軍第 ' + (r.foe + 1) + ' 隊 ' + r.rounds + ' 回合,削血 ' + Math.round(r.dmg * 100) + '%,損兵 ' + Math.round(r.loss * 100) + '%' + (r.wiped ? '(全滅,重傷 15 分鐘)' : '') + (r.last ? ' ★最後一刀' : '');
    h += '<div class="wd-rpr"><b>' + wdUiEsc(r.name || ('隊' + r.team)) + '</b><span class="wd-sp">' + wdUiEsc(txt) + '</span>' + (!r.skipped ? (wdUiRecOk(W, r.recIdx) ? '<button class="wd-b" data-wd="replay" data-i="' + r.recIdx + '">重播</button>' : '<span class="wd-sm">只剩文字結果</span>') : '') + '</div>';
  });
  if (rp.loot) {
    h += '<div class="wd-card">獲得:' + wdUiEsc(wdUiLootTxt(rp.loot));
    if (rp.loot.alloc) {
      h += '<div class="wd-sm">按傷害比例分配:' + rp.loot.alloc.map(function (a) { return wdUiEsc(wdUiTeamNameIn(rp, a.team)) + ' ' + a.pct + '%'; }).join('、') + '<br>最後一刀(' + wdUiEsc(wdUiTeamNameIn(rp, rp.loot.extra.team)) + ')額外一份隨機獎勵:' + wdUiEsc(wdUiLootTxt({ mats: rp.loot.extra.mats })) + '</div>';
    }
    h += '</div>';
  } else if (rp.win && rp.cat !== 'res') h += '<div class="wd-card">攻下 ' + wdUiEsc(rp.ptName) + '。</div>';
  else if (rp.win) h += '<div class="wd-card">' + wdUiOccupyTxt(W, cs, rp) + '</div>';
  return h + '<div class="wd-sm">戰報只存雙方快照 + 亂數種子,重播時重算(最近 ' + WD_CFG.rcMax + ' 場)。</div>';
}
// 占領資源點的說明:自動駐守過 → 顯示駐守的人;還在等人 → 可派 1 人駐守;點已換新 / 駐守到期 → 只說占領
function wdUiOccupyTxt(W, cs, rp) {
  var pt = wdPt(W, rp.pt), nm;
  if (pt && pt.guard) { nm = wdUiCardName(cs, pt.guard.card); return '占領 ' + wdUiEsc(rp.ptName) + ',已由 ' + wdUiEsc(nm) + ' 駐守。'; }
  if (rp.guard) return '占領 ' + wdUiEsc(rp.ptName) + ',自動由 ' + wdUiEsc(rp.guardName || wdUiCardName(cs, rp.guard)) + ' 駐守(已到期)。';
  if (pt && pt.owner === 'me') return '占領 ' + wdUiEsc(rp.ptName) + ',可派 1 人駐守。';
  return '占領 ' + wdUiEsc(rp.ptName) + '。';
}
function wdUiTeamNameIn(rp, n) {
  var i;
  for (i = 0; i < rp.rows.length; i++) if (rp.rows[i].team === n) return rp.rows[i].name || ('隊' + n);
  return '隊' + n;
}
function wdUiReplay(idx) {
  var rec = wdRecOf(WDUI.W, idx | 0);
  if (rec && rec.v === BN_REC_VER && typeof bnBattleShow === 'function') bnBattleShow(rec, { mode: 'report', mySide: 'A' });
  else wdUiToast('這場只剩文字結果');
}

// ───────── 繪製 ─────────
function wdUiTop() { return WDUI.stack[WDUI.stack.length - 1] || null; }
function wdUiTitleOf(top) {
  var W = WDUI.W, pt;
  if (top.v === 'pt') { pt = wdPt(W, top.id); return pt ? pt.ty : '點'; }
  if (top.v === 'pick') { pt = wdPt(W, top.id); return (top.multi ? '集結:' : '派兵:') + (pt ? pt.ty : ''); }
  if (top.v === 'guard') return '選 1 人駐守';
  if (top.v === 'auto') return '自動派遣';
  if (top.v === 'rlist') return '戰報';
  if (top.v === 'rsv') return '校場';
  if (top.v === 'fame') return '名聲';
  if (top.v === 'rpt') return '戰報詳情';
  if (top.v === 'evboss') return '團結關';
  return '';
}
function wdUiBodyHtml(now) {
  var top = wdUiTop(), W = WDUI.W, cs = WDUI.cs, h;
  if (!top) return wdUiMapHtml(W, cs, now);
  h = '<div class="wd-sub"><button class="wd-b" data-wd="back">‹ 返回</button><b>' + wdUiEsc(wdUiTitleOf(top)) + '</b><span class="wd-sp"></span>' + (WDUI.stack.length >= 2 ? '<button class="wd-b" data-wd="home">回地圖</button>' : '') + '</div><div class="wd-page">';
  if (top.v === 'pt') h += wdUiPtHtml(W, cs, top.id, now);
  else if (top.v === 'pick') h += wdUiPickHtml(W, cs, top, now);
  else if (top.v === 'guard') h += wdUiGuardHtml(W, cs, top.id, now);
  else if (top.v === 'auto') h += wdUiAutoHtml(W, cs, top.plan, now);
  else if (top.v === 'rlist') h += wdUiRlistHtml(W, now);
  else if (top.v === 'rsv' && typeof rsvUiHtml === 'function') h += rsvUiHtml(wdUiRsvCtx(now));
  else if (top.v === 'fame' && typeof fameUiHtml === 'function') h += fameUiHtml();
  else if (top.v === 'rpt') h += wdUiRptHtml(W, cs, top.id, now);
  else if (top.v === 'evboss' && typeof ldoWdBossHtml === 'function') h += ldoWdBossHtml(now);
  return h + '</div>';
}
function wdUiRender() {
  var body = wdUiQ('#wdBody'), grid, page, gs = 0, ps = 0;
  if (!WDUI.el || !body || !WDUI.W) return;
  grid = wdUiQ('.wd-grid'); page = wdUiQ('.wd-page');
  gs = grid ? (grid.scrollTop | 0) : 0; ps = page ? (page.scrollTop | 0) : 0;
  body.innerHTML = wdUiBodyHtml(Date.now());
  grid = wdUiQ('.wd-grid'); page = wdUiQ('.wd-page');
  if (grid) grid.scrollTop = gs;
  if (page) page.scrollTop = ps;
}
// 校場頁需要的呼叫端資料:在城沒滿兵的卡(兵力比例唯一來源是地圖模組的 trp)
function wdUiRsvCtx(now) {
  return {
    now: now === undefined ? Date.now() : now,
    list: wdTroopList(WDUI.W, WDUI.cs).map(function (x) { return { id: x.id, name: wdUiCardName(WDUI.cs, x.id), r: x.r }; }),
    toast: wdUiToast,
    render: function () { wdUiSave(); wdUiRender(); },
    healAll: function () { return wdHealAll(WDUI.W, WDUI.cs, Date.now(), true); }
  };
}
function wdUiPush(v) { WDUI.stack.push(v); wdUiRender(); }
function wdUiCountdowns(now) {
  var nodes, i, t;
  if (!WDUI.el || !WDUI.el.querySelectorAll) return;
  nodes = WDUI.el.querySelectorAll('[data-cd]');
  for (i = 0; i < nodes.length; i++) { t = +nodes[i].getAttribute('data-cd'); nodes[i].textContent = wdUiDur(t - now); }
  nodes = WDUI.el.querySelectorAll('[data-pg]');
  for (i = 0; i < nodes.length; i++) { nodes[i].style.width = wdUiPct(+nodes[i].getAttribute('data-a'), +nodes[i].getAttribute('data-b'), now) + '%'; }
}
function wdUiTick() {
  var now = Date.now(), r, rs = null;
  if (!wdUiIsOpenNow() || !WDUI.W) { wdClose(); return; }
  if (typeof rsvSettle === 'function') rs = rsvSettle(now);
  r = wdAdvance(WDUI.W, WDUI.cs, now);
  if (r.events.length || (rs && rs.done && rs.done.length)) {
    if (r.events.length) wdUiConsume(r.events, false);
    wdUiSave();
    if (!WDUI.press) wdUiRender();
  }
  wdUiCountdowns(now);
}

// ───────── 動作 ─────────
function wdUiMsg(r) { return WDUI_REASON[r] || '無法執行'; }
function wdUiSend() {
  var top = wdUiTop(), now = Date.now(), team, r, pt;
  if (!top || top.v !== 'pick' || !top.sel.length) return;
  pt = wdPt(WDUI.W, top.id);
  if (top.multi && typeof ldoWdRsvSend === 'function' && ldoWdRsvSend(top)) return;   // 選了預約時段:改建預約
  if (top.multi) {
    r = wdRally(WDUI.W, WDUI.cs, top.sel.map(function (n) { return wdUiTeamByN(n); }).filter(Boolean), top.id, now);
    if (r.events && r.events.length) wdUiConsume(r.events, false);
    if (!r.ok) { wdUiToast(wdUiMsg(r.reason)); return; }
    wdUiToast('集結 ' + top.sel.length + ' 隊出發 → ' + (pt ? pt.ty : ''));
  } else {
    team = wdUiTeamByN(top.sel[0]);
    if (!team) { wdUiToast('沒有這個隊伍'); return; }
    r = wdDispatch(WDUI.W, WDUI.cs, team, top.id, now, {});
    if (r.events && r.events.length) wdUiConsume(r.events, false);
    if (!r.ok) { wdUiToast(wdUiMsg(r.reason)); return; }
    wdUiToast(team.name + ' 出發 → ' + (pt ? pt.ty : ''));
  }
  WDUI.stack = [];
  wdUiSave();
  wdUiRender();
}
function wdUiTeamPick(n) {
  var top = wdUiTop(), i;
  if (!top || top.v !== 'pick') return;
  i = top.sel.indexOf(n);
  if (top.multi) { if (i >= 0) top.sel.splice(i, 1); else if (top.sel.length < WD_CFG.rallyMax) top.sel.push(n); }
  else top.sel = i >= 0 ? [] : [n];
  wdUiRender();
}
function wdUiGuard(cardId) {
  var top = wdUiTop(), r;
  if (!top || top.v !== 'guard') return;
  r = wdGarrison(WDUI.W, WDUI.cs, top.id, cardId, Date.now());
  if (!r.ok) { wdUiToast(wdUiMsg(r.reason)); return; }
  wdUiToast(wdUiCardName(WDUI.cs, cardId) + ' 駐守 24 小時');
  WDUI.stack = [];
  wdUiSave();
  wdUiRender();
}
function wdUiAutoOpen() {
  var now = Date.now();
  wdUiAdv(now);
  wdUiPush({ v: 'auto', plan: wdAutoPlan(WDUI.W, WDUI.cs, now) });
}
function wdUiAutoGo() {
  var top = wdUiTop(), res, ok = 0;
  if (!top || top.v !== 'auto') return;
  res = wdAutoGo(WDUI.W, WDUI.cs, top.plan, Date.now());
  res.forEach(function (x) { if (x.ok) ok++; });
  wdUiToast('自動派遣 ' + ok + ' 隊出發' + (ok < res.length ? '(' + (res.length - ok) + ' 隊無法出發)' : ''));
  WDUI.stack = [];
  wdUiSave();
  wdUiRender();
}
function wdUiOnInput(e) { if (e && e.target && typeof rsvUiInput === 'function') rsvUiInput(e.target, WDUI.el); }
function wdUiOnClick(e) {
  var t = e && e.target, b = t && t.closest ? t.closest('[data-wd],[data-rsv]') : null, a, id, top;
  if (!b) return;
  if (b.getAttribute('data-rsv') && typeof rsvUiAct === 'function') { if (e.stopPropagation) e.stopPropagation(); rsvUiAct(b.getAttribute('data-rsv'), b, wdUiRsvCtx(Date.now())); return; }
  if (e.stopPropagation) e.stopPropagation();
  a = b.getAttribute('data-wd');
  id = b.getAttribute('data-id');
  top = wdUiTop();
  if (a && a.indexOf('ev_') === 0 && typeof ldoWdAct === 'function') { ldoWdAct(a, b); return; }   // 開場 / 活動動作(js/ld_open_ui.js)
  if (a === 'cat') { WDUI.cat = b.getAttribute('data-v'); WDUI.sub = '全部'; wdUiRender(); return; }
  if (a === 'sub') { WDUI.sub = b.getAttribute('data-v'); wdUiRender(); return; }
  if (a === 'pvp') { wdUiToast('玩家對戰之後才開放'); return; }
  if (a === 'collect') { wdUiCollect(); return; }
  if (a === 'pt') { wdUiPush({ v: 'pt', id: id }); return; }
  if (a === 'send') { wdUiPush({ v: 'pick', id: top.id, sel: [], multi: false }); return; }
  if (a === 'rally') { wdUiPush({ v: 'pick', id: top.id, sel: [], multi: true }); return; }
  if (a === 'guardpick') { wdUiPush({ v: 'guard', id: top.id }); return; }
  if (a === 'gcard') { wdUiGuard(id); return; }
  if (a === 'tm') { wdUiTeamPick(+b.getAttribute('data-n')); return; }
  if (a === 'go') { wdUiSend(); return; }
  if (a === 'auto') { wdUiAutoOpen(); return; }
  if (a === 'autogo') { wdUiAutoGo(); return; }
  if (a === 'rlist') { wdUiPush({ v: 'rlist' }); return; }
  if (a === 'rsv') { if (typeof rsvSettle === 'function') rsvSettle(Date.now()); wdUiPush({ v: 'rsv' }); return; }
  if (a === 'fame') { wdUiPush({ v: 'fame' }); return; }
  if (a === 'rpt') { wdUiPush({ v: 'rpt', id: id }); return; }
  if (a === 'replay') { wdUiReplay(+b.getAttribute('data-i')); return; }
  if (a === 'back') { wdBack(); return; }
  if (a === 'home') { WDUI.stack = []; wdUiRender(); return; }
}
function wdUiPress(on) { WDUI.press = !!on; }

// ───────── 開 / 關 / 返回 ─────────
function wdIsOpen() { return wdUiIsOpenNow(); }
function wdOpen() {
  var el, cs, now = Date.now();
  if (typeof featureOn === 'function' && !featureOn('world')) return false;   // @DORMANT world
  if (typeof bnu === 'undefined' || !bnu || !bnu.open || !bnu.layer) return false;
  if (bnu.phase === 'fight') return false;
  cs = wdUiCs();
  if (!cs) { wdUiToast('請先建立城市'); return false; }
  wdUiCss();
  if (!wdIsOpen()) {
    el = document.createElement('div');
    el.id = 'wdPanel';
    el.innerHTML = '<div id="wdBody"></div>';
    el.addEventListener('click', wdUiOnClick);
    el.addEventListener('input', wdUiOnInput);
    el.addEventListener('pointerdown', function () { wdUiPress(true); });
    el.addEventListener('pointerup', function () { setTimeout(function () { wdUiPress(false); }, 0); });
    el.addEventListener('pointercancel', function () { wdUiPress(false); });
    bnu.layer.appendChild(el);
    WDUI.el = el;
    if (typeof pfOpen === 'function') pfOpen({ id: 'wd', layer: 2, title: '城門・地圖', root: el, scrollSel: '#wdBody', onClose: wdTeardown });
  }
  if (WDUI.W && WDUI.cs === cs) { wdUiAdv(now); wdUiSave(); }
  else wdUiBoot(cs, now);
  WDUI.stack = [];
  wdUiRender();
  wdUiRsvNotice();
  WDUI.W.nw = 0;
  wdUiSave();
  if (!WDUI.timer && typeof setInterval === 'function') WDUI.timer = setInterval(wdUiTick, 1000);
  return true;
}
function wdClose() {
  var el = WDUI.el;
  if (WDUI.timer && typeof clearInterval === 'function') clearInterval(WDUI.timer);
  WDUI.timer = 0;
  if (!el) return false;
  if (typeof panelIsOpen === 'function' && panelIsOpen('wd')) return panelClose('wd') ? true : wdTeardown();   // 外框關閉 → onClose 呼叫 wdTeardown
  return wdTeardown();
}
function wdTeardown() {
  var el = WDUI.el;
  if (WDUI.timer && typeof clearInterval === 'function') clearInterval(WDUI.timer);
  WDUI.timer = 0;
  if (!el) return false;
  el.removeEventListener('click', wdUiOnClick);
  el.removeEventListener('input', wdUiOnInput);
  if (el.parentNode) el.parentNode.removeChild(el);
  WDUI.el = null; WDUI.stack = []; WDUI.press = false;
  if (WDUI.W && WDUI.cs) wdUiSave();
  if (typeof bnUiRenderEntry === 'function' && typeof bnu !== 'undefined' && bnu && bnu.open) bnUiRenderEntry();
  return true;
}
// 返回鍵:子頁先退一層;地圖頁再按關閉
function wdBack() {
  if (!wdIsOpen()) return false;
  if (WDUI.stack.length) { WDUI.stack.pop(); wdUiRender(); return true; }
  wdClose();
  return true;
}
function wdUiCss() {
  var s;
  if (WDUI.css || typeof document === 'undefined' || !document.createElement || !document.head) return;
  WDUI.css = true;
  s = document.createElement('style');
  s.id = 'wdUiCss';
  s.textContent = '#wdPanel{overflow:hidden;background:#f6ecd6;color:#2a1a10;font-size:13px;box-sizing:border-box}' +
    '#wdBody{position:absolute;left:0;top:0;right:0;bottom:0;display:flex;flex-direction:column;gap:6px;padding:6px calc(8px + env(safe-area-inset-right)) 6px calc(8px + env(safe-area-inset-left));box-sizing:border-box;overflow:hidden}' +
    '#wdPanel .wd-sm{font-size:12px;color:#7a6040;overflow-wrap:anywhere}#wdPanel .wd-sp{flex:1}#wdPanel .wd-big{font-size:16px}' +
    '#wdPanel button{font:inherit;color:#2a1a10;box-sizing:border-box}' +
    '#wdPanel .wd-b{background:linear-gradient(#ffe39a,#e8a83a);border:2px solid #5a3a22;border-radius:9px;min-height:40px;min-width:44px;padding:2px 12px;font-weight:900;white-space:nowrap}' +
    '#wdPanel .wd-b.g{background:linear-gradient(#bfe8c8,#5fae74)}#wdPanel .wd-b:disabled{filter:grayscale(1);opacity:.5}' +
    '#wdPanel .wd-harv{flex:none;display:flex;flex-wrap:wrap;align-items:center;gap:4px 8px;background:#fff8e6;border:2px solid #d8c08a;border-radius:10px;padding:3px 8px}#wdPanel .wd-harv b{color:#8a4a10}' +
    '#wdPanel .wd-tabs{flex:none;display:flex;gap:4px;align-items:center;flex-wrap:wrap}' +
    '#wdPanel .wd-tab{border:2px solid #c9a868;background:#fff;border-radius:16px;min-height:36px;padding:2px 12px;font-weight:700}#wdPanel .wd-tab.on{background:#5a3a22;color:#fff;border-color:#e8c26a}#wdPanel .wd-tab.lock{opacity:.45}#wdPanel .wd-tab.sub{min-height:32px;padding:1px 10px}' +
    '#wdPanel .wd-grid{flex:1 1 auto;min-height:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:6px;align-content:start;grid-auto-rows:max-content;overflow-y:auto;-webkit-overflow-scrolling:touch}' +
    '#wdPanel .wd-pt{background:#fff;border:2px solid #d8c08a;border-radius:10px;padding:5px 8px;text-align:left;line-height:1.45;min-height:44px}#wdPanel .wd-pt h4{margin:0;font-size:14px;display:flex;justify-content:space-between;gap:4px}#wdPanel .wd-pt h4 i{font-style:normal;font-size:11px;background:#eee;border-radius:6px;padding:0 5px}' +
    '#wdPanel .wd-pt.me{border-color:#2f7a4a;background:#eef8ef}#wdPanel .wd-pt.go{border-color:#2a5a8a;background:#eef3fb}#wdPanel .wd-pt.beast{border-color:#a8321f}#wdPanel .wd-pt.done{opacity:.6}#wdPanel .wd-st{font-weight:700;font-size:12px}' +
    '#wdPanel .wd-hp{height:6px;background:#ddd;border-radius:3px;overflow:hidden;margin-top:2px}#wdPanel .wd-hp div{height:100%;background:#d83a2a}' +
    '#wdPanel .wd-teams{flex:none;display:flex;gap:4px;overflow-x:auto}#wdPanel .wd-tm{flex:1;min-width:120px;background:#fff;border:1px solid #c9a868;border-radius:8px;padding:3px 6px;font-size:12px;line-height:1.35}#wdPanel .wd-tm.hurt{background:#fbe9e6}' +
    '#wdPanel .wd-pg{height:4px;background:#ddd;border-radius:2px;overflow:hidden;margin-top:2px}#wdPanel .wd-pg div{height:100%;background:#2a5a8a}' +
    '#wdPanel .wd-sub{flex:none;display:flex;align-items:center;gap:8px}#wdPanel .wd-page{flex:1 1 auto;min-height:0;overflow-y:auto;-webkit-overflow-scrolling:touch;display:flex;flex-direction:column;gap:6px}' +
    '#wdPanel .wd-card{background:#fff;border:2px solid #d8c08a;border-radius:10px;padding:8px;line-height:1.6;flex:none}#wdPanel .wd-row{display:flex;gap:6px;align-items:center;flex-wrap:wrap;flex:none}' +
    '#wdPanel .wd-pick{display:flex;align-items:center;gap:8px;background:#fff;border:2px solid #d8c08a;border-radius:9px;padding:5px 8px;min-height:44px;text-align:left;flex:none}#wdPanel .wd-pick.sel{border-color:#2f7a4a;background:#eef8ef}#wdPanel .wd-pick.off{opacity:.45}' +
    '#wdPanel .wd-pick .n{width:22px;height:22px;border-radius:50%;background:#5a3a22;color:#fff;display:grid;place-items:center;font-size:12px;font-weight:900;flex:none}' +
    '#wdPanel .wd-red{color:#a8321f;font-weight:700;font-size:12px}#wdPanel .od{font-weight:900}#wdPanel .od.good{color:#2f7a4a}#wdPanel .od.mid{color:#b07a10}#wdPanel .od.bad{color:#a8321f}#wdPanel .okc{color:#2f7a4a}#wdPanel .ngc{color:#a8321f}' +
    '#wdPanel .wd-rp{display:flex;align-items:center;gap:8px;background:#fff;border:1px solid #c9a868;border-radius:8px;padding:5px 8px;min-height:44px;text-align:left;flex:none}#wdPanel .wd-rpr{display:flex;align-items:center;gap:8px;background:#fff;border:1px solid #c9a868;border-radius:8px;padding:5px 8px;flex:none}' +
    '#wdPanel table{border-collapse:collapse;font-size:12px;width:100%}#wdPanel td,#wdPanel th{border-bottom:1px solid #e3d3a8;padding:3px 4px;text-align:left}';
  document.head.appendChild(s);
}

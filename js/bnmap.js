// js/bnmap.js — 戰鬥 A 模式 B3:討伐地圖畫面(章節選單、關卡列表、星數與進度、建議戰力 vs 我方戰力、軍令、每日流寇、獎勵預覽)。PLAN_BATTLE_A §5。
// 掛在 bnui.js 的全螢幕 layer 內(階段 'map',元素 #bnMap);動作由 bnUiDo 轉給 bnMapDo。戰鬥沒有小兵,每個單位都是一位武將;敵方一律稱『敵將』。
// 依賴:bnui.js(bnu BNUI bnUiEsc …)、bn_stages.js。ES2017;不用 ?. ??。
// 全域:BNMAP bnMapRender bnMapDo bnMapMyPower bnMapRewardHtml bnMapStageStats bnMapEnv

var BNMAP = { ch: 1, sel: '', bc: null, env: null };
var BNMAP_SCENE = { plain: '平原', hill: '山地', water: '水域', rain: '雨天' };
function bnMapEnv() { return BNMAP.env || bnStgEnv(BNUI.env); }
function bnMapData() { return bnu.data || bnUiLoad(); }
function bnMapGoodsName(id) { if (typeof goodsName === 'function' && typeof GOODS !== 'undefined' && GOODS[id]) return goodsName(id) || id; return (typeof GOODS !== 'undefined' && GOODS[id] && GOODS[id].name) || id; }
function bnMapSkillName(id) { return (typeof BN_SKILLS !== 'undefined' && BN_SKILLS[id] && BN_SKILLS[id].name) || id; }
// 我方戰力:目前布陣有人用布陣,否則名冊最強 5 人
function bnMapMyPower() {
  var b, list, p = 0, i;
  if (bnu.slots && bnu.slots.length) { b = bnUiBuild(); b.team.units.forEach(function (u) { p += bnPower(u); }); return p; }
  list = bnUiRosterList().map(function (x) { return bnPower(bnUiSpec(x, { troop: bnu.tp[x.id] || bnDefaultTroop(x) })); }).sort(function (a, b2) { return b2 - a; }).slice(0, BNUI.maxUnits);
  for (i = 0; i < list.length; i++) p += list[i];
  return p;
}
function bnMapBestPower() {
  var list = bnUiRosterList().map(function (x) { return bnPower(bnUiSpec(x, { troop: bnDefaultTroop(x) })); }).sort(function (a, b2) { return b2 - a; }).slice(0, BNUI.maxUnits), p = 0, i;
  for (i = 0; i < list.length; i++) p += list[i];
  return p;
}
function bnMapMaxCh(d) {
  var n = 1, k;
  for (k = 1; k <= 6; k++) if ((d.clear[k + '-6'] | 0) >= 1) n = Math.min(6, k + 1);
  return n;
}
// 今日流寇(快取:同日同戰力不重算)
function bnMapBounty(d) {
  var cs = (typeof cardsGet === 'function') ? cardsGet() : null, env = bnMapEnv(), day = bnStgDayNo(env.now()), mp = bnMapBestPower(), seed = (cs && cs.seed) | 0, key = [day, mp, seed, bnMapMaxCh(d)].join(':');
  if (!BNMAP.bc || BNMAP.bc.key !== key) BNMAP.bc = { key: key, def: bnStgBounty(seed, day, mp, bnMapMaxCh(d)) };
  return BNMAP.bc.def;
}
function bnMapStageStats(d) {
  var n = 0, stars = 0, s;
  BN_STAGES.forEach(function (st) { s = d.clear[st.id] | 0; if (s >= 1) { n++; stars += s; } });
  return { cleared: n, stars: stars, total: BN_STAGES.length };
}
function bnMapStars(n) { return '★'.repeat(n) + '☆'.repeat(3 - n); }
function bnMapRewardLine(r) {
  var a = [];
  if (r.gold) a.push('金幣 ' + r.gold);
  (r.goods || []).forEach(function (g) { a.push(bnMapGoodsName(g[0]) + ' ×' + g[1]); });
  if (r.shards) a.push('碎片 ' + r.shards);
  if (r.book) a.push('通用戰法「' + bnMapSkillName(r.book[0]) + '」(兵書:解鎖戰法;已有則轉碎片)');
  if (r.token) a.push('指名券 ×' + r.token);
  if (r.pulls) a.push('抽卡 +' + r.pulls + ' 抽');
  return a.join('、');
}
function bnMapRatioTxt(mine, rec) {
  var k = rec > 0 ? mine / rec : 1;
  if (k >= 1.15) return ['穩勝', 'g'];
  if (k >= 0.95) return ['勢均力敵', 'm'];
  if (k >= 0.8) return ['吃力', 'o'];
  return ['極難', 'b'];
}

// 關卡走線:本章 6 關一個接一個的小旗(已通關 ● 金、目前選取 高亮、未解鎖 ○ 灰),旗與旗之間連線;上方標「第 N 章・第 M 關」與進度點 ●●○○○○
function bnMapRouteHtml(d, env, ch) {
  var list = BN_STAGES.filter(function (s) { return s.ch === ch.n; }), cur = bnStgById(BNMAP.sel), dots = '', h = '', i, s, cl, ok;
  for (i = 0; i < list.length; i++) {
    s = list[i]; cl = d.clear[s.id] | 0; ok = bnStgUnlock(d.clear, s.id, env).ok;
    dots += cl ? '●' : '○';
    h += (i ? '<i class="ln' + (cl || ok ? ' on' : '') + '"></i>' : '') + '<button class="nd' + (cl ? ' clr' : '') + (ok ? '' : ' lock') + (BNMAP.sel === s.id ? ' sel' : '') + '" data-a="stg" data-id="' + s.id + '" aria-label="' + s.id + '">' + (s.boss ? '⚑' : (i + 1)) + '</button>';
  }
  return '<div class="bnm-route"><div class="rt">第 ' + ch.n + ' 章・第 ' + (cur && cur.ch === ch.n ? list.indexOf(cur) + 1 : 1) + ' 關 <span class="dots">' + dots + '</span></div><div class="rp">' + h + '</div></div>';
}
function bnMapRender() {
  var el = bnu.mapEl, d, env, ord, mine, h = '', ch, st, rows = '', k, ui, cn, sel, f, rw, bt, doneB, can, ratio, stats, lock, cl, locked = {}, first;
  if (!el || typeof BN_STAGES === 'undefined') return;
  d = bnMapData(); env = bnMapEnv();
  ord = bnStgOrders(d, env); mine = bnMapMyPower(); stats = bnMapStageStats(d);
  if (!BNMAP.sel || !bnStgById(BNMAP.sel)) {   // 預設選第一個尚未通關且已解鎖的關,否則最後通關關
    BNMAP.sel = '1-1';
    for (k = 0; k < BN_STAGES.length; k++) { if (!bnStgUnlock(d.clear, BN_STAGES[k].id, env).ok) break; BNMAP.sel = BN_STAGES[k].id; if (!(d.clear[BN_STAGES[k].id] | 0)) break; }
    BNMAP.ch = bnStgById(BNMAP.sel).ch;
  }
  h += '<div class="bnm-head"><span>軍令 <b>' + ord.left + '/' + ord.max + '</b></span><span>我方戰力 <b>' + mine + '</b></span><span>進度 <b>' + stats.cleared + '/' + stats.total + '</b> · ★' + stats.stars + '/' + stats.total * 3 + '</span></div>';
  h += '<div class="bnm-chs">';
  BN_CHAPTERS.forEach(function (c) {
    var u = bnStgUnlock(d.clear, c.n + '-1', env);
    h += '<button class="' + (BNMAP.ch === c.n ? 'on' : '') + (u.ok ? '' : ' lock') + '" data-a="mchap" data-i="' + c.n + '">' + c.n + ' ' + bnUiEsc(c.name) + '</button>';
  });
  h += '</div>';
  ch = bnStgChapter(BNMAP.ch);
  h += '<div class="bnm-cols"><div class="c1"><div class="bnm-chn"><b>第 ' + ch.n + ' 章 ' + bnUiEsc(ch.name) + '</b> <small>' + bnUiEsc(ch.sub) + ' · 星 ' + bnStgChapterStars(d.clear, ch.n) + '/18</small></div>' + bnMapRouteHtml(d, env, ch) + '<div class="bnm-list">';
  BN_STAGES.filter(function (s) { return s.ch === ch.n; }).forEach(function (s) {
    f = bnStgFoes(s.id); lock = bnStgUnlock(d.clear, s.id, env); cl = d.clear[s.id] | 0; ratio = bnMapRatioTxt(mine, f.rec);
    h += '<button class="bnm-row' + (BNMAP.sel === s.id ? ' sel' : '') + (lock.ok ? '' : ' lock') + (cl ? ' clr' : '') + (s.boss ? ' boss' : '') + '" data-a="stg" data-id="' + s.id + '"><span class="n">' + s.id + '</span><span class="t">' + bnUiEsc(s.name) + (s.boss ? ' <i>頭目</i>' : '') + '</span><span class="s">' + (cl ? bnMapStars(cl) : (lock.ok ? '未通關' : '🔒')) + '</span><span class="p ' + ratio[1] + '">' + (lock.ok ? '建議 ' + f.rec : bnUiEsc(lock.why)) + '</span></button>';
  });
  h += '</div></div><div class="c2">';
  sel = bnStgById(BNMAP.sel);
  if (sel) {
    f = bnStgFoes(sel.id); can = bnStgCanStart(d, sel.id, env); rw = bnStgRewards(sel.id); ratio = bnMapRatioTxt(mine, f.rec); first = !(((d.got || {})[sel.id] | 0) & 1);
    h += '<div class="bnm-det"><h3>' + sel.id + ' ' + bnUiEsc(sel.name) + (sel.boss ? ' <i>頭目</i>' : '') + '</h3><p>' + bnUiEsc(sel.desc) + '</p><p class="sm">場景:' + (BNMAP_SCENE[sel.scene] || '平原') + (f.bonds.length ? ' · 敵方陣勢:' + f.bonds.map(bnUiEsc).join('、') : '') + '</p>';
    h += '<div class="bnm-foes">' + f.list.map(function (x) { return '<span><small>' + bnUiEsc(x.title) + '</small>' + bnUiEsc(x.name) + ' <u>' + bnUiEsc(x.troop) + '</u></span>'; }).join('') + '</div>';
    h += '<p>建議戰力 <b>' + f.rec + '</b> · 我方 <b>' + mine + '</b> <em class="' + ratio[1] + '">' + ratio[0] + '</em></p>';
    h += '<p class="sm">' + (first ? '首通:' + bnMapRewardLine({ gold: rw.first.gold, goods: rw.first.goods, shards: rw.first.shards, book: rw.first.book, token: rw.first.token, pulls: rw.first.pulls }) + '(首通不耗軍令)' : '首通已領') + '</p>';
    h += '<p class="sm">今日重複獎勵:還剩 <b>' + bnStgRepLeft(d, sel.id, env) + '/' + BN_STG.repPerDay + '</b> 場(金幣 ' + rw.repeat.gold + '、碎片 ' + rw.repeat.shards + '、' + bnMapGoodsName(rw.repeat.goods[0]) + ' 機率 ' + Math.round(rw.repeat.goodsP * 100) + '%、通用戰法「' + bnMapSkillName(rw.repeat.book) + '」機率 ' + Math.round(rw.repeat.bookP * 100) + '%;勝利耗 1 軍令)</p>';
    if (!(((d.got || {})[sel.id] | 0) & 2)) h += '<p class="sm">三星首次:金幣 ' + rw.star3.gold + '、碎片 ' + rw.star3.shards + '(三星:勝利 + 無人陣亡 + 5 回合內全殲)</p>';
    h += '<button class="bnf-go" data-a="fight"' + (can.ok ? '' : ' disabled') + '>' + (can.ok ? '前往布陣' : bnUiEsc(can.why)) + '</button></div>';
  }
  if (typeof bnTeamStripHtml === 'function') h += bnTeamStripHtml({ mini: true, title: '目前隊伍' });   // 戰前準備:整隊武將戰法卡(js/bnteam.js)
  h += '</div></div>';
  bt = bnMapBounty(d); doneB = bnStgBountyDone(d, env);
  h += '<div class="bnm-foot"><div class="bnm-b"><b>每日流寇</b> <small>' + bnUiEsc(BN_CHAPTERS[bt.ch - 1].name) + ' · 建議戰力 ' + bt.rec + ' · 獎勵:金幣 ' + BN_STG.bounty.gold + '、碎片 ' + BN_STG.bounty.shards + '、' + bnMapGoodsName(BN_CHAPTERS[bt.ch - 1].mats[0]) + '(不耗軍令)</small><br>' + bt.list.map(function (x) { return bnUiEsc(x.name); }).join('、') +
    '<button class="bnbtn" data-a="bounty"' + (doneB ? ' disabled' : '') + '>' + (doneB ? '今日已討平' : '出戰流寇') + '</button></div><div class="bnm-b"><b>練兵</b> <small>不計戰績、不給獎勵,敵將依我方戰力縮放,可自由試陣</small><br><button class="bnbtn" data-a="practice">進入練兵</button></div></div>';
  el.innerHTML = (typeof fxText === 'function') ? fxText(h) : h;   // 魔幻世界:軍令 → 號令、每日流寇 → 林間盜匪 …(歷史世界原樣)
  try { var se = el.querySelector && el.querySelector('.bnm-row.sel'); if (se && se.scrollIntoView) se.scrollIntoView({ block: 'nearest' }); } catch (er) { /* 舊瀏覽器略過 */ }   // 聚焦目前(下一)關
}

// 進入階段:地圖 → 布陣
function bnMapEnter(kind, id) {
  var d = bnMapData(), env = bnMapEnv(), can, def;
  if (kind === 'stage') {
    can = bnStgCanStart(d, id, env);
    if (!can.ok) { bnUiToast(can.why); return false; }
    bnu.stg = { kind: 'stage', id: id };
  } else if (kind === 'bounty') {
    if (bnStgBountyDone(d, env)) { bnUiToast('今日流寇已討平'); return false; }
    def = bnMapBounty(d);
    bnu.stg = { kind: 'bounty', id: 'B', def: def };
  } else bnu.stg = { kind: 'practice', id: 'P' };
  BNUI.stage = bnu.stg.id;
  bnu.sel = null;
  bnUiSetPhase('form');
  bnUiRenderForm();
  return true;
}
function bnMapDo(a, id, r, c, t, i) {
  var d, env, u;
  if (a === 'mchap') { BNMAP.ch = i | 0; d = bnMapData(); env = bnMapEnv(); u = bnStgUnlock(d.clear, BNMAP.ch + '-1', env); BNMAP.sel = BNMAP.ch + '-1'; bnMapRender(); return true; }
  if (a === 'stg') { BNMAP.sel = id; bnMapRender(); return true; }
  if (a === 'fight') { bnMapEnter('stage', BNMAP.sel); return true; }
  if (a === 'bounty') { bnMapEnter('bounty'); return true; }
  if (a === 'practice') { bnMapEnter('practice'); return true; }
  if (a === 'tomap') { bnUiToMap(); return true; }
  return false;
}

// 結算面板的獎勵段落
function bnMapRewardHtml(rep) {
  var a = [], h = '';
  if (!rep) return '';
  if (!rep.win) return '';
  if (rep.already) return '<p class="rw">今日流寇已討平,不再給獎勵</p>';
  if (rep.gold) a.push('金幣 +' + rep.gold);
  (rep.goods || []).forEach(function (g) { a.push(bnMapGoodsName(g.id) + ' ×' + g.n); });
  if (rep.shards) a.push('碎片 +' + rep.shards);
  if (rep.books) a.push('通用戰法「' + bnMapSkillName(rep.bookId) + '」' + (rep.bookUnlock === false ? '(兵書:已有,轉碎片)' : '(兵書:解鎖戰法)'));
  if (rep.token) a.push('指名券 ×' + rep.token);
  if (rep.pulls) a.push('抽卡 +' + rep.pulls + ' 抽');
  h += '<p class="rw">' + (rep.first && rep.id !== 'B' ? '首通 · ' : '') + (rep.star3 ? '三星首次 · ' : '') + (a.length ? '獲得:' + a.join('、') : '本次沒有獎勵') + '</p>';
  if (rep.first === false && rep.id !== 'B' && rep.repLeft !== undefined) h += '<p class="sm">' + (rep.repGot ? '' : '今日重複獎勵已領完,本場僅練習。') + '今日重複獎勵剩餘 ' + rep.repLeft + ' 場</p>';
  if (rep.order) h += '<p class="sm">消耗軍令 1</p>';
  return h;
}

if (typeof module !== 'undefined' && module.exports) module.exports = { BNMAP: BNMAP };

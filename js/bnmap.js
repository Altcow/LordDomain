// js/bnmap.js — 戰鬥 A 模式 B3:副本(討伐地圖)畫面:章節選單、關卡列表、關卡簡介(詳細 pop)、流寇目標、我方戰力、首通 / 重複獎勵預覽。PLAN_BATTLE_A §5。
// 掛在 bnui.js 的全螢幕 layer 內(階段 'map',元素 #bnMap);動作由 bnUiDo 轉給 bnMapDo。戰鬥沒有小兵,每個單位都是一位武將;敵方一律稱『敵將』。
// 2026-11-11:入口改為 bnui.js 的『戰鬥入口』(副本 / 對戰 / 戰報 / 練兵);本檔只管副本。出戰鈕在畫面右上(bnui.js 的 #bnBar .mf),依目前選取的關卡 / 流寇出戰;沒選目標時灰掉。
// 依賴:bnui.js(bnu BNUI bnUiEsc …)、bn_stages.js。ES2017;不用 ?. ??。
// 全域:BNMAP bnMapRender bnMapDo bnMapMyPower bnMapRewardHtml bnMapStageStats bnMapEnv bnMapFightState bnMapSyncFight bnMapIsOpen

var BNMAP = { ch: 1, sel: '', bc: null, env: null, bf: 'sanguo', det: false };   // sel = 關卡 id 或 'B'(每日流寇);det = 關卡詳細說明 pop 開著
// 戰場選擇列(頂部預留位置):開放的戰場 ≥ 2 才顯示;目前只有三國討伐,回空字串
function bnMapBfHtml() {
  var on = BN_BATTLEFIELDS.filter(function (b) { return b.open; });
  if (on.length < 2) return '';
  return '<div class="bnm-bf">' + on.map(function (b) { return '<button class="' + (BNMAP.bf === b.id ? 'on' : '') + '" data-a="mbf" data-i="' + b.id + '">' + bnUiEsc(b.name) + '</button>'; }).join('') + '</div>';
}
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

// 出戰目標是否可用:關卡 = 解鎖條件通過;流寇 = 恆可出戰。回 {ok, why}
function bnMapFightState(d, env) {
  var s, can;
  if (BNMAP.sel === 'B') return { ok: true, why: '' };
  s = bnStgById(BNMAP.sel);
  if (!s) return { ok: false, why: '先選一關' };
  can = bnStgCanStart(d, s.id, env);
  return { ok: !!can.ok, why: can.ok ? '' : can.why };
}
// 右上『出戰』鈕(bnui.js 的 #bnBar .mf):依目前目標啟用 / 灰掉
function bnMapSyncFight() {
  var st, b = bnu.btns && bnu.btns.mfight;
  if (!b) return;
  st = bnMapFightState(bnMapData(), bnMapEnv());
  b.disabled = !st.ok;
  b.setAttribute('aria-label', st.ok ? '出戰' : ('出戰:' + st.why));
}
function bnMapIsOpen() { return !!(BNMAP && BNMAP.det); }

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
// 上一章通關後,下一章因官階未達而未開放:說明原因(不改解鎖規則)
function bnMapNextHint(d, env) {   // 只在未開放的章節顯示:通關上一章頭目後開放
  var u = bnStgUnlock(d.clear, BNMAP.ch + '-1', env), ch = bnStgChapter(BNMAP.ch);
  if (u.ok || !ch) return '';
  return '<p class="bnm-hint">第 ' + ch.n + ' 章「' + bnUiEsc(ch.name) + '」尚未開放:' + bnUiEsc(u.why) + '</p>';
}
function bnMapFoesHtml(f) {
  return '<div class="bnm-foes">' + f.list.map(function (x) { return '<span><small>' + bnUiEsc(x.title) + '</small>' + bnUiEsc(x.name) + ' <u>' + bnUiEsc(x.troop) + '</u></span>'; }).join('') + '</div>';
}
// 關卡簡介(預設顯示):章節 / 關卡名、建議戰力、通關狀態、首通獎勵摘要;詳細說明在 pop 內
// 首通摘要(簡介用):金幣 + 第一項材料;其餘在『詳細』
function bnMapRewardShort(fr) {
  var g = fr.goods || [], s = '金幣 ' + fr.gold;
  if (g.length) s += '、' + bnMapGoodsName(g[0][0]) + ' ×' + g[0][1] + (g.length > 1 || fr.book || fr.pulls ? ' 等' : '');
  return s;
}
function bnMapSummaryHtml(d, sel, f, mine, ratio) {
  var cl = d.clear[sel.id] | 0, first = !(((d.got || {})[sel.id] | 0) & 1), rw = bnStgRewards(sel.id);
  return '<div class="bnm-det"><h3>' + sel.id + ' ' + bnUiEsc(sel.name) + (sel.boss ? ' <i>頭目</i>' : '') + '</h3>' +
    '<p>建議戰力 <b>' + f.rec + '</b> · 我方 <b>' + mine + '</b> <em class="' + ratio[1] + '">' + ratio[0] + '</em> · 敵將 ' + f.list.length + ' 人</p>' +
    '<p class="sm">' + (cl ? '已通關 ' + bnMapStars(cl) : '未通關') + ' · ' + (first ? '首通:' + bnMapRewardShort(rw.first) : '首通已領') + '</p>' +
    '<button class="bnm-dbtn" data-a="detail">詳細</button></div>';
}
// 關卡詳細說明(pop):敵將、獎勵、規則、掉落
function bnMapDetailHtml(d, sel, f, mine, ratio) {
  var first = !(((d.got || {})[sel.id] | 0) & 1), rw = bnStgRewards(sel.id);
  return '<div class="bnm-ov"><div class="bnm-dlg"><h3>' + sel.id + ' ' + bnUiEsc(sel.name) + (sel.boss ? ' <i>頭目</i>' : '') + '</h3><p>' + bnUiEsc(sel.desc) + '</p>' +
    '<p class="sm">場景:' + (BNMAP_SCENE[sel.scene] || '平原') + (f.bonds.length ? ' · 敵方陣勢:' + f.bonds.map(bnUiEsc).join('、') : '') + '</p>' +
    '<p class="sm">敵將</p>' + bnMapFoesHtml(f) +
    '<p>建議戰力 <b>' + f.rec + '</b> · 我方 <b>' + mine + '</b> <em class="' + ratio[1] + '">' + ratio[0] + '</em></p>' +
    '<p class="sm">' + (first ? '首通:' + bnMapRewardLine({ gold: rw.first.gold, goods: rw.first.goods, shards: rw.first.shards, book: rw.first.book, pulls: rw.first.pulls }) : '首通已領') + '</p>' +
    '<p class="sm">重複通關(不限次數):金幣 ' + rw.repeat.gold + '、' + bnMapGoodsName(rw.repeat.goods[0]) + ' 機率 ' + Math.round(rw.repeat.goodsP * 100) + '%、通用戰法「' + bnMapSkillName(rw.repeat.book) + '」機率 ' + Math.round(rw.repeat.bookP * 100) + '%(不給碎片與抽卡)</p>' +
    (((d.got || {})[sel.id] | 0) & 2 ? '' : '<p class="sm">三星首次:金幣 ' + rw.star3.gold + '、碎片 ' + rw.star3.shards + '(三星:勝利 + 無人陣亡 + 5 回合內全殲)</p>') +
    '<button class="bnm-dbtn" data-a="dclose">關閉</button></div></div>';
}
// 每日流寇目標(c2 右欄):說明、敵將、建議戰力;勝利每次都有重複獎勵
function bnMapBountyHtml(d, mine) {
  var bt = bnMapBounty(d), ratio = bnMapRatioTxt(mine, bt.rec);
  return '<div class="bnm-det"><h3>每日流寇 <i>' + bnUiEsc(BN_CHAPTERS[bt.ch - 1].name) + '</i></h3><p>' + bnUiEsc(bt.desc || '') + '</p>' +
    '<p>建議戰力 <b>' + bt.rec + '</b> · 我方 <b>' + mine + '</b> <em class="' + ratio[1] + '">' + ratio[0] + '</em></p>' +
    '<div class="bnm-foes">' + bt.list.map(function (x) { return '<span>' + bnUiEsc(x.name) + ' <u>' + bnUiEsc(x.troop) + '</u></span>'; }).join('') + '</div>' +
    '<p class="sm">勝利獎勵(每次都給,不限次數):金幣 ' + BN_STG.bounty.gold + '、' + bnMapGoodsName(BN_CHAPTERS[bt.ch - 1].mats[0]) + ' ×' + BN_STG.bounty.goods + '(不給碎片與抽卡)</p></div>';
}
function bnMapRender() {
  var el = bnu.mapEl, d, env, mine, h = '', ch, rows = '', k, cn, sel, f, bt, ratio, stats, lock, cl;
  if (!el || typeof BN_STAGES === 'undefined') return;
  d = bnMapData(); env = bnMapEnv();
  mine = bnMapMyPower(); stats = bnMapStageStats(d);
  if (!BNMAP.sel || (BNMAP.sel !== 'B' && !bnStgById(BNMAP.sel))) {   // 預設選第一個尚未通關且已解鎖的關,否則最後通關關
    BNMAP.sel = '1-1';
    for (k = 0; k < BN_STAGES.length; k++) { if (!bnStgUnlock(d.clear, BN_STAGES[k].id, env).ok) break; BNMAP.sel = BN_STAGES[k].id; if (!(d.clear[BN_STAGES[k].id] | 0)) break; }
    BNMAP.ch = bnStgById(BNMAP.sel).ch;
  }
  if (BNMAP.sel === 'B') BNMAP.ch = bnMapBounty(d).ch;
  h += bnMapBfHtml();
  h += '<div class="bnm-head"><span>我方戰力 <b>' + mine + '</b></span><span>進度 <b>' + stats.cleared + '/' + stats.total + '</b> · ★' + stats.stars + '/' + stats.total * 3 + '</span></div>';
  h += bnMapNextHint(d, env);
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
  if (BNMAP.sel === 'B') h += bnMapBountyHtml(d, mine);
  else if (sel) {
    f = bnStgFoes(sel.id); ratio = bnMapRatioTxt(mine, f.rec);
    h += bnMapSummaryHtml(d, sel, f, mine, ratio);
    if (BNMAP.det) h += bnMapDetailHtml(d, sel, f, mine, ratio);
  }
  if (typeof bnTeamStripHtml === 'function') h += bnTeamStripHtml({ mini: true, title: '目前隊伍' });   // 戰前準備:整隊武將戰法卡(js/bnteam.js)
  h += '</div></div>';
  bt = bnMapBounty(d);
  h += '<div class="bnm-foot"><button class="bnm-b' + (BNMAP.sel === 'B' ? ' sel' : '') + '" data-a="bsel"><b>每日流寇</b> <small>' + bnUiEsc(BN_CHAPTERS[bt.ch - 1].name) + ' · 建議戰力 ' + bt.rec + ' · 獎勵:金幣 ' + BN_STG.bounty.gold + '、' + bnMapGoodsName(BN_CHAPTERS[bt.ch - 1].mats[0]) + ' ×' + BN_STG.bounty.goods + '(可重複討伐,每次勝利都有重複獎勵)</small><br>' + bt.list.map(function (x) { return bnUiEsc(x.name); }).join('、') + '</button></div>';
  el.innerHTML = (typeof fxText === 'function') ? fxText(h) : h;   // 魔幻世界用語替換(歷史世界原樣)
  bnMapSyncFight();
  try { var se = el.querySelector && el.querySelector('.bnm-row.sel'); if (se && se.scrollIntoView) se.scrollIntoView({ block: 'nearest' }); } catch (er) { /* 舊瀏覽器略過 */ }   // 聚焦目前(下一)關
}

// 進入階段:地圖 → 布陣
function bnMapEnter(kind, id) {
  if (kind !== 'practice' && !featureOn('stages')) return false;   // @DORMANT stages:副本 / 流寇休眠(v60);練兵不受影響
  var d = bnMapData(), env = bnMapEnv(), can, def;
  if (kind === 'stage') {
    can = bnStgCanStart(d, id, env);
    if (!can.ok) { bnUiToast(can.why); return false; }
    bnu.stg = { kind: 'stage', id: id };
  } else if (kind === 'bounty') {
    // 流寇可重複討伐,不再有每日一次的限制
    def = bnMapBounty(d);
    bnu.stg = { kind: 'bounty', id: 'B', def: def };
  } else bnu.stg = { kind: 'practice', id: 'P' };
  BNUI.stage = bnu.stg.id;
  bnu.sel = null;
  bnUiSetPhase('form');
  bnUiRenderForm();
  return true;
}
// 右上出戰:依目前目標進入布陣(沒選或不能打時提示原因)
function bnMapFight() {
  var st = bnMapFightState(bnMapData(), bnMapEnv());
  BNMAP.det = false;
  if (!st.ok) { bnUiToast(st.why); return false; }
  if (BNMAP.sel === 'B') return bnMapEnter('bounty');
  return bnMapEnter('stage', BNMAP.sel);
}
function bnMapDo(a, id, r, c, t, i) {
  if (a === 'mchap') { BNMAP.ch = i | 0; BNMAP.sel = BNMAP.ch + '-1'; BNMAP.det = false; bnMapRender(); return true; }
  if (a === 'mbf') { BNMAP.bf = id; bnMapRender(); return true; }
  if (a === 'stg') { BNMAP.sel = id; BNMAP.det = false; bnMapRender(); return true; }
  if (a === 'bsel') { BNMAP.sel = 'B'; BNMAP.det = false; bnMapRender(); return true; }
  if (a === 'detail') { BNMAP.det = true; bnMapRender(); return true; }
  if (a === 'dclose') { BNMAP.det = false; bnMapRender(); return true; }
  if (a === 'mfight') { bnMapFight(); return true; }
  if (a === 'bounty') { bnMapEnter('bounty'); return true; }
  if (a === 'practice') { bnMapEnter('practice'); return true; }
  if (a === 'tomap') { if (bnu.stg && bnu.stg.kind === 'practice' && typeof bnUiToEntry === 'function') bnUiToEntry(); else bnUiToMap(); return true; }
  return false;
}

// 結算面板的獎勵段落
function bnMapRewardHtml(rep) {
  var a = [], h = '';
  if (!rep) return '';
  if (!rep.win) return '';
  if (rep.gold) a.push('金幣 +' + rep.gold);
  (rep.goods || []).forEach(function (g) { a.push(bnMapGoodsName(g.id) + ' ×' + g.n); });
  if (rep.shards) a.push('碎片 +' + rep.shards);
  if (rep.books) a.push('通用戰法「' + bnMapSkillName(rep.bookId) + '」' + (rep.bookUnlock === false ? '(兵書:已有,轉碎片)' : '(兵書:解鎖戰法)'));
  if (rep.pulls) a.push('抽卡 +' + rep.pulls + ' 抽');
  h += '<p class="rw">' + (rep.first && rep.id !== 'B' ? '首通 · ' : '') + (rep.star3 ? '三星首次 · ' : '') + (a.length ? '獲得:' + a.join('、') : '本次沒有獎勵') + '</p>';
  if (rep.repeat && rep.id !== 'B') h += '<p class="sm">重複通關:不給碎片與抽卡</p>';
  return h;
}

if (typeof module !== 'undefined' && module.exports) module.exports = { BNMAP: BNMAP };

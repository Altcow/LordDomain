// js/npcinteract.js — 人物互動引擎(PLAN_INTERIORS §4 P1~P10):派駐數值(人事乘區)、親近度、請託、台詞、城內 hero 人物、名冊定位、室內人物查詢。
// 資料表在 js/npcdata.js;名冊/存檔在 cards.js(entry 欄位 fav / favDay / gift / since;cs.errand / errDay / errSeq);介面在 js/npcui.js。
// 全部以 typeof 守衛外部模組(world、citylife、goods、cardsui…),缺模組時退化為 1 倍 / 空結果。ES2017(不使用可選串接與空值合併運算子)。
// 全域名稱:npcStaffDirty npcStaffGet npcStaffMul npcTechSpeedMul npcStaffInfo npcPersonValue npcPostOfAt npcSeatsOf npcFitScore npcCanAssign npcSiteInfo
//          npcDayOf npcFavAdd npcFavTick npcFavLabel npcTalkNext npcTalkLine npcErrandTick npcErrandState npcErrandDone npcErrandOf npcTick
//          npcHeroTick npcHeroSpec npcHeroWant npcHeroPlan npcHeroStats npcLocate npcGoto npcInteriorPeople npcCountType

var NPC = { ver: 0, dirty: true, calls: 0, sigR: -1, sigO: -1, table: null, cnt: null, cntSig: -1, cntVer: -1, talkN: {}, tickT: 0, day: -999,
  hero: { t: 0, inTv: {}, specs: {} } };

function npcHashOf() { return (typeof cardHash === 'function') ? cardHash.apply(null, arguments) : (String(Array.prototype.join.call(arguments, '|')).length * 2654435761) >>> 0; }
function npcObjs() { return (typeof world !== 'undefined' && world && Array.isArray(world.objects)) ? world.objects : []; }
// 唯讀取得卡牌狀態(不建立):每幀會被產量結算呼叫,不能因此在沒有招募過的世界產生 cards 存檔欄位
function npcCs() { return (typeof world !== 'undefined' && world && world.city && world.city.cards) ? world.city.cards : null; }
function npcRoster() { var cs = npcCs(); return (cs && cs.roster) || []; }
function npcDayOf(now) {
  var tz = (typeof cardsTz === 'function') ? cardsTz(now) : new Date(now).getTimezoneOffset() * 60000;
  return Math.floor((now - tz) / 86400000);
}
function npcPostById(id) { var i; for (i = 0; i < NPC_POSTS.length; i++) if (NPC_POSTS[i].id === id) return NPC_POSTS[i]; return null; }
function npcStaffDirty() { NPC.dirty = true; NPC.ver++; }

// 建築數量(依 type;以物件清單長度 + ver 快取)
function npcCountType(type) {
  var objs = npcObjs(), i;
  if (!NPC.cnt || NPC.cntSig !== objs.length || NPC.cntVer !== NPC.ver) {
    NPC.cnt = {};
    for (i = 0; i < objs.length; i++) if (objs[i]) NPC.cnt[objs[i].type] = (NPC.cnt[objs[i].type] || 0) + 1;
    NPC.cntSig = objs.length; NPC.cntVer = NPC.ver;
  }
  return NPC.cnt[type] || 0;
}
function npcCountAny(types) { var n = 0, i; for (i = 0; i < types.length; i++) n += npcCountType(types[i]); return n; }
function npcStageOk(job) {
  var g = NPC_STAGE[job], i;
  if (!g) return true;
  for (i = 0; i < g.length; i++) if (npcCountAny(g[i][0]) < g[i][1]) return false;
  return true;
}
function npcPostOfAt(at) {
  var t = String(at || '').split('@')[0];
  return NPC_TYPE_POST[t] ? npcPostById(NPC_TYPE_POST[t]) : null;
}
function npcBldCount(post) { return npcCountAny(post.types); }
function npcSeatsOf(post) {
  var n = npcBldCount(post);
  if (n <= 0) return 0;
  return Math.min(post.seat.max, post.seat.base + Math.floor(n / post.seat.div));
}

// ───────── P1 派駐數值(PLAN_CARDS §4.13.3) ─────────
var NPC_TIER_L = [0, 5, 15, 30, 55];
// 個人值(%):主職業全額、輔職業半額 + 屬性項 + 詞條;不對口只剩屬性項。回 {pct, parts:[{job,t,half,v}], attr, trait}
function npcPersonValue(e, post, seats) {
  var parts = [], sum = 0, id, t, v, half, st, attr, trait = 0, i, tp, ex;
  for (id in (e.ja || {})) {
    half = post.main.indexOf(id) < 0;
    if (half && post.aux.indexOf(id) < 0) continue;
    t = Math.max(1, Math.min(4, e.ja[id] | 0));
    ex = npcStageOk(id);
    if (t >= 4 && !ex) t = 3;                       // 宗師舞台未成 → 以 III 計
    if (t >= 3 && !ex && (seats || 0) < 2) t = 2;   // III 需席位 ≥ 2 或舞台建築已有
    v = NPC_TIER_L[t] * (half ? 0.5 : 1);
    parts.push({ job: id, t: t, half: half, v: v });
    sum += v;
  }
  st = (typeof cardsStats === 'function') ? cardsStats(e) : e.st;
  attr = Math.max(-3, Math.min(4, ((st && st[post.attr]) - 50) / 10));
  if (!isFinite(attr)) attr = 0;
  for (i = 0; i < (e.tr || []).length; i++) {
    tp = NPC_TRAIT_PCT[e.tr[i]];
    if (tp) trait += (tp.all || 0) + (tp[post.id] || 0);
  }
  return { pct: Math.max(0, sum + attr + trait), parts: parts, attr: attr, trait: trait };
}
// 重算全城職司表:{ posts:{id:{post, nBld, seats, people:[{e,pct,pv}], waste, S, mulPct}}, byType:{type:倍率(僅 live 職司)} }
function npcStaffBuild() {
  var T = { posts: {}, byType: {} }, ro = npcRoster();
  NPC_POSTS.forEach(function (p) { T.posts[p.id] = { post: p, nBld: npcBldCount(p), seats: npcSeatsOf(p), people: [], waste: 0, S: 0, mulPct: 0 }; });
  ro.forEach(function (e) {
    var p = e.at ? npcPostOfAt(e.at) : null, P;
    if (!p) return;
    P = T.posts[p.id];
    if (P.nBld <= 0) return;
    P.people.push({ e: e, pv: null });
  });
  NPC_POSTS.forEach(function (p) {
    var P = T.posts[p.id], S = 0, i;
    P.people.forEach(function (x) { x.pv = npcPersonValue(x.e, p, P.seats); x.pct = x.pv.pct; });
    P.people.sort(function (a, b) { return b.pct - a.pct || (a.e.no | 0) - (b.e.no | 0); });
    if (P.people.length > P.seats) { P.waste = P.people.length - P.seats; P.people.length = P.seats; }
    for (i = 0; i < P.people.length; i++) S += (i < 2 ? 1 : 0.5) * P.people[i].pct;
    P.S = Math.min(S, NPC_CFG.postCap);
    P.mulPct = Math.min(P.S, NPC_CFG.mulCap);
    if (p.live && P.mulPct > 0) p.types.forEach(function (t) { T.byType[t] = 1 + P.mulPct / 100; });
  });
  return T;
}
function npcStaffGet() {
  var ro = npcRoster(), objs = npcObjs();
  if (NPC.dirty || !NPC.table || NPC.sigR !== ro.length || NPC.sigO !== objs.length || (++NPC.calls % 240) === 0) {
    NPC.dirty = false; NPC.sigR = ro.length; NPC.sigO = objs.length;
    NPC.table = npcStaffBuild();
  }
  return NPC.table;
}
// 對外:某建築 type 的人事乘區倍率(1 = 無加成)。快速路徑:不屬於任何職司的 type 直接回 1(goods.js goodsLaborMul、map.js productionPerSec 呼叫)
function npcStaffMul(type) {
  if (!NPC_TYPE_POST[type]) return 1;
  return npcStaffGet().byType[type] || 1;
}
// 研究院入住人才 buff(citytech.js techSpeedMul):學官職司 %,上限 2 倍;無研究院 / 無人 = 1
function npcTechSpeedMul() {
  var P = npcStaffGet().posts.study;
  if (!P || P.nBld <= 0 || P.mulPct <= 0) return 1;
  return Math.min(2, 1 + P.mulPct / 100);
}
// UI 用:某建築 type 所屬職司的明細,無 → null。{post, name, pct(夾後), S, cap, seats, used, live, eff, people:[{id,name,pct,detail}], waste}
function npcStaffInfo(type) {
  var pid = NPC_TYPE_POST[type], P;
  if (!pid) return null;
  P = npcStaffGet().posts[pid];
  return {
    post: pid, name: P.post.name, pct: P.mulPct, S: P.S, cap: NPC_CFG.mulCap, seats: P.seats, used: P.people.length, live: P.post.live, eff: P.post.eff, waste: P.waste,
    people: P.people.map(function (x) { return { id: x.e.id, name: x.e.name, pct: x.pct, parts: x.pv.parts, attr: x.pv.attr, trait: x.pv.trait }; })
  };
}
// 該人物放進某職司的個人值(派工建議用)
function npcFitScore(e, postId) {
  var p = npcPostById(postId);
  if (!p) return 0;
  return npcPersonValue(e, p, npcSeatsOf(p)).pct;
}
// 此人能否再派進 site(以職司席位計;原本就在該職司者不增加用量)
function npcCanAssign(e, siteId) {
  var p = npcPostOfAt(siteId), used = 0;
  if (!p) return true;
  npcRoster().forEach(function (x) { if (x !== e && x.at && npcPostOfAt(x.at) === p) used++; });
  return used < npcSeatsOf(p);
}
// 派工頁建築資訊:每棟可派人數
function npcSiteInfo(type) {
  var pid = NPC_TYPE_POST[type], p;
  if (!pid) return null;
  p = npcPostById(pid);
  return { post: p.id, name: p.name, per: p.per };
}

// ───────── P5 親近度 ─────────
// 每人每日最多 +1(對話、派駐年資共用;請託完成 force 不受此限)。回 {gain, fav, gift:{...}|null, unlock:boolean}
function npcFavAdd(cs, e, now, why, force) {
  var day = npcDayOf(now), res = { gain: 0, fav: e.fav | 0, gift: null, unlock: false }, g, row, goods, j;
  if (!cs || !e) return res;
  if (!force && e.favDay === day) return res;
  if ((e.fav | 0) >= NPC_CFG.favMax) { if (!force) e.favDay = day; return res; }
  e.fav = (e.fav | 0) + 1;
  if (!force) e.favDay = day;
  res.gain = 1; res.fav = e.fav; res.unlock = e.fav === NPC_CFG.favPrivate;
  if (e.fav >= NPC_CFG.favGift && !e.gift) {
    e.gift = 1;
    j = CARD_JOB_BY_ID[e.main];
    row = (j && j.row) || '農';
    g = NPC_GIFT[row] || NPC_GIFT['農'];
    if (typeof GOODS !== 'undefined' && GOODS[g.id] && typeof cityGoodsAdd === 'function') { cityGoodsAdd(g.id, g.n); goods = { name: g.name, n: g.n }; }
    else if (typeof world !== 'undefined' && world && world.res) { world.res.coin = (world.res.coin || 0) + 100; goods = { name: '金幣', n: 100 }; }
    res.gift = goods || null;
  }
  return res;
}
// 派駐年資:每滿 passiveEvery 天 +1(與對話共用每日上限)。回新增點數
function npcFavTick(cs, now) {
  var day = npcDayOf(now), n = 0;
  if (!cs) return 0;
  cs.roster.forEach(function (e) {
    var age;
    if (!e.at) { if (e.since !== undefined) e.since = undefined; return; }
    if (e.since === undefined) { e.since = day; return; }
    age = day - e.since;
    if (age > 0 && age % NPC_CFG.passiveEvery === 0 && npcFavAdd(cs, e, now, 'tenure').gain) n++;
  });
  return n;
}
function npcFavLabel(fav) { var s = '', i; fav = fav | 0; for (i = 0; i < NPC_CFG.favMax; i++) s += i < fav ? '♥' : '♡'; return s; }
function npcTenureDays(e, now) { return (e && e.at && e.since !== undefined) ? Math.max(0, npcDayOf(now) - e.since) : 0; }

// ───────── P4 台詞 ─────────
// 取下一句:{ text, priv }。職業句為主;親近 ≥ 3 時每 3 句有 1 句私話;持有特定詞條時偶爾接一句補句。確定性(種子 + 計數)
function npcTalkLine(e, n) {
  var fl = (typeof FAMOUS_LINES !== 'undefined' && e && e.fig) ? FAMOUS_LINES[e.fig] : null; // 名人專屬句(2 句輪替),沒有才退職業句
  if (fl && fl.length) return { text: fl[(n | 0) % fl.length], priv: false };
  var j = CARD_JOB_BY_ID[e.main], pool = (e.main && NPC_TALK_JOB[e.main]) || NPC_TALK_GENERIC, row = (j && j.row) || '農', h = npcHashOf(e.id, e.name, n), text, priv = false, trs = [], i, h2;
  if ((e.fav | 0) >= NPC_CFG.favPrivate && n % 3 === 2 && NPC_TALK_PRIV[row]) {
    pool = NPC_TALK_PRIV[row]; priv = true;
  }
  text = pool[h % pool.length];
  if (!priv) {
    for (i = 0; i < (e.tr || []).length; i++) if (NPC_TALK_TRAIT[e.tr[i]]) trs.push(e.tr[i]);
    h2 = npcHashOf(e.id, 'tr', n);
    if (trs.length && h2 % 2 === 0) text += NPC_TALK_TRAIT[trs[Math.floor(h2 / 2) % trs.length]];
  }
  return { text: text, priv: priv };
}
function npcTalkNext(e) {
  var n = NPC.talkN[e.id] = (NPC.talkN[e.id] | 0) + 1;
  return npcTalkLine(e, n - 1);
}

// ───────── P6 請託(同時最多 2 件,無期限) ─────────
function npcErrandOf(cs, eid) { var l = cs.errand || [], i; for (i = 0; i < l.length; i++) if (l[i].eid === eid) return l[i]; return null; }
function npcErrandState(cs, q) {
  var have = 0, need = 1;
  if (q.kind === 'goods') {
    need = q.n; have = (typeof cityGoodsHave === 'function') ? cityGoodsHave(q.id) : 0;
    return { ok: have >= need, have: Math.min(have, need), need: need };
  }
  have = Math.max(0, npcCountType(q.type) - (q.base | 0));
  return { ok: have >= 1, have: Math.min(have, 1), need: 1 };
}
// 每日(日期變更)發一件:從名冊挑一位沒有請託的人;名冊空 / 已滿 2 件不發。清掉名冊已不存在的人的請託。回新請託或 null
function npcErrandTick(cs, now) {
  var day = npcDayOf(now), list, pool, e, j, row, tpls, t, q, h;
  if (!cs) return null;
  list = cs.errand || (cs.errand = []);
  cs.errand = list = list.filter(function (x) { return cs.roster.some(function (e2) { return e2.id === x.eid; }); });
  if (cs.errDay === day) return null;
  cs.errDay = day;
  if (list.length >= NPC_CFG.errandMax || !cs.roster.length) return null;
  pool = cs.roster.filter(function (x) { return !npcErrandOf(cs, x.id); });
  if (!pool.length) return null;
  h = npcHashOf(cs.seed, 'errand', day);
  e = pool[h % pool.length];
  j = CARD_JOB_BY_ID[e.main]; row = (j && j.row) || '農';
  tpls = NPC_ERRANDS[row] || NPC_ERRANDS['農'];
  t = tpls[Math.floor(h / 7) % tpls.length];
  if (t.kind === 'build' && (typeof OBJECTS === 'undefined' || !OBJECTS[t.type])) t = tpls[0];
  q = { id: 'q' + (cs.errSeq = (cs.errSeq | 0) + 1), eid: e.id, kind: t.kind, text: t.text, day: day };
  if (t.kind === 'goods') { q.goods = t.id; q.n = t.n; } else { q.type = t.type; q.base = npcCountType(t.type); }
  list.push(q);
  if (typeof showToast === 'function') showToast(e.name + ' 有事相求');
  return q;
}
// 交付 / 確認完成:成功 → 扣貨(goods)、發獎(金幣)、親近 +1(不受每日上限)。回 {ok, reason?, reward?, fav?}
function npcErrandDone(cs, qid, now) {
  var l = cs.errand || [], i, q = null, e, st, res;
  for (i = 0; i < l.length; i++) if (l[i].id === qid) { q = l[i]; break; }
  if (!q) return { ok: false, reason: 'none' };
  e = null;
  cs.roster.forEach(function (x) { if (x.id === q.eid) e = x; });
  if (!e) return { ok: false, reason: 'none' };
  st = npcErrandState(cs, { kind: q.kind, id: q.goods, n: q.n, type: q.type, base: q.base });
  if (!st.ok) return { ok: false, reason: 'notyet' };
  if (q.kind === 'goods') {
    if (typeof cityGoodsSpend !== 'function' || !cityGoodsSpend((function () { var o = {}; o[q.goods] = q.n; return o; })())) return { ok: false, reason: 'notyet' };
  }
  l.splice(i, 1);
  if (typeof world !== 'undefined' && world && world.res) world.res.coin = (world.res.coin || 0) + NPC_CFG.errandReward.coin;
  res = npcFavAdd(cs, e, now, 'errand', true);
  return { ok: true, reward: NPC_CFG.errandReward.coin, fav: res.fav, gift: res.gift, name: e.name };
}

// 主迴圈掛點(cards.js cardsNamedTick 每 5 秒呼叫):日期變更時處理派駐年資與發請託
function npcTick(dt) {
  var cs, now;
  NPC.tickT += dt || 0;
  if (NPC.tickT < 5) return 0;
  NPC.tickT = 0;
  try {
    cs = (typeof cardsGet === 'function') ? cardsGet() : null;
    if (!cs) return 0;
    now = Date.now();
    if (NPC.day === npcDayOf(now)) return 0;
    NPC.day = npcDayOf(now);
    npcFavTick(cs, now);
    npcErrandTick(cs, now);
  } catch (e) { /* 略過 */ }
  return 1;
}

// ───────── P10 名冊 → 地圖定位 ─────────
// 回 {kind:'site', x,y,bid,name,type} | {kind:'hero', x,y} | null
function npcLocate(e) {
  var objs = npcObjs(), i, o, a, L, d;
  if (e && e.at) {
    for (i = 0; i < objs.length; i++) {
      o = objs[i];
      if (o && (o.type + '@' + o.x + ',' + o.y) === e.at) { d = (typeof OBJECTS !== 'undefined' && OBJECTS[o.type]) || {}; return { kind: 'site', x: o.x, y: o.y, bid: i + 1, name: d.name || o.type, type: o.type, icon: d.icon || '' }; }
    }
  }
  if (typeof LIFE !== 'undefined' && LIFE && LIFE.npcs) {
    L = LIFE.npcs;
    for (i = 0; i < L.length; i++) if (L[i].role === 'hero' && L[i].hero === e.id && !L[i].dead) return { kind: 'hero', x: Math.floor(L[i].x), y: Math.floor(L[i].y) };
  }
  return null;
}
// 鏡頭移過去並讓建築閃綠光;回 true = 已執行
function npcGoto(e) {
  var loc = npcLocate(e);
  if (!loc) return false;
  if (typeof centerOnCell === 'function') { try { centerOnCell(loc.x, loc.y); if (typeof clampView === 'function') clampView(); } catch (er) { return false; } }
  if (loc.kind === 'site' && typeof talentPatrolPing === 'function') talentPatrolPing(loc.bid);
  return true;
}

// ───────── P9 室內人物查詢(給室內框架用;本檔不畫任何室內場景) ─────────
// kind 'tavern' = 未派駐者(好酒者優先);'workshop' = 派駐在 opts.posts(職司 id 陣列,預設 craft/iron/loom/farm)的人;'council' = 太守 / 賊曹
// 回 [{id, name, gr, fav, job(crowd 職業), mainJob(卡牌職業 id), post, spec(城內外觀 spec 或 null)}],最多 max 位
function npcInteriorPeople(kind, max, opts) {
  var ro = npcRoster().slice(), out = [], posts, o = opts || {};
  max = max || 4;
  function card(e) {
    var p = e.at ? npcPostOfAt(e.at) : null;
    return { id: e.id, name: e.name, gr: e.gr, fav: e.fav | 0, job: NPC_LOOK_JOB[e.main] || 'official', mainJob: e.main, post: p ? p.id : null, spec: npcHeroSpec(e) };
  }
  if (kind === 'tavern') {
    ro = ro.filter(function (e) { return !e.at; });
    ro.sort(function (a, b) { return ((b.tr || []).indexOf('haojiu') >= 0 ? 1 : 0) - ((a.tr || []).indexOf('haojiu') >= 0 ? 1 : 0) || b.gr - a.gr || a.no - b.no; });
  } else {
    posts = kind === 'council' ? ['gov', 'police'] : (o.posts || ['craft', 'iron', 'loom', 'farm']);
    ro = ro.filter(function (e) { var p = e.at ? npcPostOfAt(e.at) : null; return p && posts.indexOf(p.id) >= 0; });
    ro.sort(function (a, b) { return b.gr - a.gr || a.no - b.no; });
  }
  ro.slice(0, max).forEach(function (e) { out.push(card(e)); });
  return out;
}

// ───────── P3 城內 hero 人物 ─────────
// 類型登錄(w = 0,不參與一般抽籤;只由 npcHeroTick 依名冊生成,不占居民額度)
if (typeof LIFE_TYPES !== 'undefined' && !LIFE_TYPES.hero) LIFE_TYPES.hero = { name: '名冊人物', looks: ['man', 'woman'], w: 0, spd: 0.75, to: {} };
function npcLowEnd() { return typeof lifeLowEnd === 'function' && lifeLowEnd(); }
function npcHeroCap() {
  var c = NPC_CFG.heroCap;
  if ((typeof isPowerSave === 'function' && isPowerSave()) || npcLowEnd()) c = Math.max(1, c >> 1);
  return c;
}
// 外觀:依主職業對應 CROWD_JOBS、種子 = 人物 id(同一人恆同),名人套族別;缺 ART / crowdparts 回 null(退回占位小人)
function npcHeroSpec(e) {
  var cj, L, base, id, s, eth, eo;
  if (typeof ART === 'undefined' || !ART || !ART.UNIT || typeof crowdLook !== 'function') return null;
  cj = NPC_LOOK_JOB[e.main] || NPC_LOOK_JOB[Object.keys(e.ja || {})[0]] || 'official';
  if (e.fig && typeof ethnicOfFig === 'function') { try { eo = ethnicOfFig(e.fig); eth = eo && eo.eth; } catch (er) { eth = undefined; } }
  if (e.sex === 'm' && cj === 'woman') cj = 'smith';   // 性別與頭像一致:男性不走「婦人」外觀
  L = crowdLook(cj, npcHashOf(e.id, 'look') % 1000003, eth);
  base = ART.UNIT[cj === 'woman' ? 'woman' : 'man'] || ART.UNIT.man;
  if (!L || !base) return null;
  id = 'hero_' + L.id + (e.sex === 'f' || e.sex === 'm' ? '_' + e.sex : '');
  s = NPC.hero.specs[id];
  if (!s) {
    s = Object.assign({}, base, L, { id: id });
    if (e.sex === 'f') { s.head = 'woman'; s.robe = true; delete s.beard; }   // 女性:女髮型長袍、無鬍
    else if (e.sex === 'm' && s.head === 'woman') s.head = 'bun';
    if (base.draw || base.mount || base.fierce) s = Object.assign({}, base, { id: id });
    NPC.hero.specs[id] = s;
  }
  if (typeof LIFE !== 'undefined' && LIFE && LIFE.variantIds) LIFE.variantIds[id] = true;
  return s;
}
// 應出現的人物(最多 cap 位):派駐者優先;夜間好酒的未派駐者「在酒館裡」不出現
function npcHeroWant(cs, tod) {
  var ro = cs.roster.slice(), cap = npcHeroCap(), inTv = NPC.hero.inTv;
  if (tod === 'dawn' || tod === 'noon') NPC.hero.inTv = inTv = {};
  ro = ro.filter(function (e) { return !inTv[e.id]; });
  ro.sort(function (a, b) {
    return (b.at ? 1 : 0) - (a.at ? 1 : 0) || b.gr - a.gr || (b.fav | 0) - (a.fav | 0) || (a.no | 0) - (b.no | 0);
  });
  return ro.slice(0, cap);
}
function npcFindObjAt(at) {
  var objs = npcObjs(), i, o;
  for (i = 0; i < objs.length; i++) { o = objs[i]; if (o && (o.type + '@' + o.x + ',' + o.y) === at) return o; }
  return null;
}
function npcTavernDoor(R) {
  var objs = npcObjs(), i, o, pick = null, d;
  if (typeof lifeFindDoor !== 'function') return null;
  for (i = 0; i < objs.length; i++) {
    o = objs[i];
    if (o && (o.type === 'tavern' || o.type === 'shop_wine')) { d = lifeFindDoor(o, R.ok); if (d && (!pick || o.type === 'tavern')) pick = d; }
  }
  return pick;
}
// 行程:回 {plan, start, sig, tv}。assigned = 往返 工作站 ↔ 閒逛點;idle = 數個閒逛點循環;好酒者傍晚 → 酒館門口進場
function npcHeroPlan(e, R, tod, seq) {
  var h = npcHashOf(e.id, 'plan', seq | 0), spots = R.spots || [], o, door, plan, a, b, tv, sig;
  if (!e.at && (e.tr || []).indexOf('haojiu') >= 0 && (tod === 'dusk' || tod === 'night')) {
    tv = npcTavernDoor(R);
    if (tv) return { plan: [{ cell: tv.cell, end: 'enter', door: tv }], start: spots.length ? spots[h % spots.length] : tv.cell, sig: 'tv', tv: true };
  }
  if (e.at) {
    o = npcFindObjAt(e.at);
    door = (o && typeof lifeFindDoor === 'function') ? lifeFindDoor(o, R.ok) : null;
    if (door) {
      plan = [{ cell: door.cell, act: 'work', dur: 20 + (h % 25) }];
      if (spots.length) { b = spots[(h >>> 4) % spots.length]; if (b !== door.cell) plan.push({ cell: b, act: 'stand', dur: 4 + ((h >>> 9) % 5) }); }
      return { plan: plan, start: door.cell, sig: 'at:' + e.at, tv: false };
    }
  }
  if (!spots.length) return null;
  a = spots[h % spots.length];
  plan = [{ cell: a, act: 'stand', dur: 6 + ((h >>> 5) % 9) }];
  b = spots[(h >>> 8) % spots.length];
  if (b !== a) plan.push({ cell: b, act: 'stand', dur: 6 + ((h >>> 12) % 9) });
  return { plan: plan, start: a, sig: 'idle', tv: false };
}
function npcHeroSpawn(e, R, tod) {
  var P = npcHeroPlan(e, R, tod, 0), T = (typeof LIFE_TYPES !== 'undefined') ? LIFE_TYPES.hero : null, before, n, sp;
  if (!P || !T || typeof lifeEmit !== 'function') return false;
  before = LIFE.npcs.length;
  if (!lifeEmit(T, 'hero', 1, P.start, P.plan, null, true, { loop: true, lane: 0.12 })) return false;
  n = LIFE.npcs[LIFE.npcs.length - 1];
  if (LIFE.npcs.length === before) return false;
  LIFE.live--;   // lifeEmit 已計入一般居民;人物不占居民額度
  n.ext = true; n.role = 'hero'; n.hero = e.id; n.name = e.name; n.keep = true; n.hsig = P.sig; n.hseq = 0;
  n.col = '#e6b84a';
  sp = npcHeroSpec(e);
  if (sp) n.spec = sp;
  if (P.tv) { n.loop = false; NPC.hero.inTv[e.id] = true; }
  return true;
}
// 重排現有人物行程(派駐變動 / 日夜切換)
function npcHeroReplan(n, e, R, tod) {
  var P = npcHeroPlan(e, R, tod, ++n.hseq);
  if (!P || P.sig === n.hsig) return;
  n.hsig = P.sig;
  n.plan = P.plan; n.pi = 0; n.goal = P.plan[0].cell;
  n.loop = !P.tv; n.st = 'walk'; n.t = 0;
  if (P.tv) NPC.hero.inTv[e.id] = true;
}
// citylife lifeFrame 掛點:每秒一次,增減 / 重排城內人物。dt 秒
function npcHeroTick(dt) {
  var H = NPC.hero, cs, R, tod, want, wantIds = {}, L, i, n, e, made = 0;
  H.t -= dt || 0;
  if (H.t > 0) return;
  H.t = 1;
  if (typeof LIFE === 'undefined' || !LIFE || !LIFE.active || !LIFE.road) return;
  cs = npcCs();
  if (!cs || !LIFE_TYPES.hero) return;
  R = LIFE.road; tod = LIFE.tod || 'noon';
  want = npcHeroWant(cs, tod);
  want.forEach(function (x) { wantIds[x.id] = x; });
  L = LIFE.npcs;
  for (i = 0; i < L.length; i++) {
    n = L[i];
    if (n.role !== 'hero' || n.dead || n.st === 'fade' || n.st === 'enter' || n.st === 'exit') continue;
    e = cs.roster.filter(function (x) { return x.id === n.hero; })[0];
    if (!e || (!wantIds[n.hero] && !H.inTv[n.hero])) { lifeFadeOut(n); continue; }
    n.fid = n.st === 'act';
    if (n.st !== 'chat') npcHeroReplan(n, e, R, tod);
    wantIds[n.hero] = null;
  }
  want.forEach(function (x) {
    if (!wantIds[x.id] || made >= 2) return;
    if (npcHeroSpawn(x, R, tod)) made++;
  });
}
function npcHeroStats() {
  var o = { n: 0, assigned: 0, ids: [] };
  if (typeof LIFE === 'undefined' || !LIFE) return o;
  LIFE.npcs.forEach(function (n) { if (n.role === 'hero' && !n.dead && n.st !== 'fade') { o.n++; o.ids.push(n.hero); } });
  return o;
}

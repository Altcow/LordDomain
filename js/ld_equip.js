// js/ld_equip.js — 裝備核心(設計_裝備與尋訪_定案.md 第二、五節;任務卡 1、3)。前綴 gear。純邏輯,無 DOM。
// 存檔:localStorage 'lorddomain.gear.v1' = {v:1, seed, ctr, seq, list:[{id,slot,q,type,attrs:[[key,值]],traits:[id],lv,fp,owner}], fail:{品質:連敗}}(SAVE_SLOT_KEYS)。
// 所有亂數用 存檔種子 + 計數器 gearRng(st):先把扣材料 / 計數器寫進存檔再回傳結果,重整頁面不會重抽。壞檔 → 正規化,不丟例外。
// 只在旗標 ldui 開啟時才進戰鬥(gearLive()):bn_units.js 以 gearLive() 判斷;函式本身不判斷旗標(測試可直接呼叫)。
// 全域:gearRead gearWrite gearNorm gearList gearOf gearFind gearMake gearAdd gearEquip gearUnequip gearOnCardLeave gearStatsOf gearEnhance gearFeed gearSalvage gearSalvageValue gearLive gearRng gearItemLv gearAttrVal gearAttrText gearIconKey gearTitle。ES2017;不用 ?. ??。

function gearLive() { return typeof featureOn === 'function' && featureOn('ldui'); }   // @DORMANT ldui
function gearHash() {
  var s = Array.prototype.join.call(arguments, '|'), h = 2166136261, i;
  for (i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  h ^= h >>> 15; h = Math.imul(h, 2246822507); h ^= h >>> 13;
  return h >>> 0;
}
function gearRngMake(seed) {
  var a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    var t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// 取亂數產生器並把計數器 +1(呼叫端要自己 gearWrite 存回);同一 (seed, ctr, tag) 結果固定
function gearRng(st, tag) { var r = gearRngMake(gearHash('gear', st.seed, st.ctr, tag || '')); st.ctr++; return r; }
function gearRound2(x) { return Math.round(x * 100) / 100; }
function gearInt(x, lo, hi, d) { x = Math.floor(Number(x)); return isFinite(x) ? Math.max(lo, Math.min(hi, x)) : d; }
function gearHas(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }

// ───────── 存檔 ─────────
// 種子:有卡牌存檔時由卡牌種子推得(同一個世界固定、不必先寫檔);沒有才用亂數(此時第一次 gearWrite 會把它寫進存檔)
function gearSeedInit() {
  var cs = null;
  try { cs = typeof cardsGet === 'function' ? cardsGet() : null; } catch (e) { cs = null; }
  if (cs && typeof cs.seed === 'number' && isFinite(cs.seed)) return gearHash('gearseed', cs.seed);
  return ((Date.now() ^ Math.floor(Math.random() * 4294967296)) >>> 0);
}
function gearNew() { return { v: 1, seed: gearSeedInit(), ctr: 0, seq: 0, list: [], fail: { 0: 0, 1: 0, 2: 0, 3: 0 } }; }
function gearItemNorm(x) {
  var C = GEAR_CFG, it, attrs = [], tr = [], i, a, q, slot, type, seen = {};
  if (!x || typeof x !== 'object' || typeof x.id !== 'string' || x.id.length > 20) return null;
  slot = String(x.slot);
  if (C.slots.indexOf(slot) < 0) return null;
  q = gearInt(x.q, 0, 3, 0);
  type = (typeof x.type === 'string' && C.typesOf[slot].indexOf(x.type) >= 0) ? x.type : C.typesOf[slot][0];
  if (Array.isArray(x.attrs)) for (i = 0; i < x.attrs.length && attrs.length < 3; i++) {
    a = x.attrs[i];
    if (!Array.isArray(a) || typeof a[0] !== 'string' || !gearHas(GEAR_ATTR, a[0]) || seen[a[0]]) continue;   // 屬性 key 不在表內:刪掉
    if (typeof a[1] !== 'number' || !isFinite(a[1]) || a[1] < 0 || a[1] > 1000) continue;
    seen[a[0]] = 1; attrs.push([a[0], a[1]]);
  }
  if (!attrs.length) return null;
  if (q === 3 && Array.isArray(x.traits)) for (i = 0; i < x.traits.length && tr.length < 2; i++) if (typeof x.traits[i] === 'string' && gearTraitDef(x.traits[i]) && tr.indexOf(x.traits[i]) < 0) tr.push(x.traits[i]);   // 未知特性刪掉
  it = { id: x.id, slot: slot, q: q, type: type, attrs: attrs, traits: tr, lv: gearInt(x.lv, 0, GEAR_CFG.lvMax, 0), fp: gearInt(x.fp, 0, 100000, 0), owner: (typeof x.owner === 'string' && x.owner.length <= 20) ? x.owner : '' };
  return it;
}
function gearNorm(v) {
  var o = gearNew(), i, it, k, seenOwn = {};
  if (!v || typeof v !== 'object') return o;
  o.seed = gearInt(v.seed, 0, 4294967295, o.seed);
  o.ctr = gearInt(v.ctr, 0, 1e9, 0);
  o.seq = gearInt(v.seq, 0, 1e9, 0);
  if (Array.isArray(v.list)) for (i = 0; i < v.list.length && i < 2000; i++) {
    it = gearItemNorm(v.list[i]);
    if (!it) continue;
    if (it.owner) { k = it.owner + '|' + it.slot; if (seenOwn[k]) it.owner = ''; else seenOwn[k] = 1; }   // 同人同部位只認第一件
    o.list.push(it);
  }
  if (v.fail && typeof v.fail === 'object') for (i = 0; i < 4; i++) o.fail[i] = gearInt(v.fail[i], 0, 100000, 0);
  return o;
}
// 讀檔後把「owner 指向不存在的卡」改成未穿(名冊讀得到時才檢查)
function gearFixOwners(st) {
  var cs = null, ids = {}, i, n = 0;
  try { cs = typeof cardsGet === 'function' ? cardsGet() : null; } catch (e) { cs = null; }
  if (!cs || !Array.isArray(cs.roster)) return 0;
  for (i = 0; i < cs.roster.length; i++) ids[cs.roster[i].id] = 1;
  for (i = 0; i < st.list.length; i++) if (st.list[i].owner && !ids[st.list[i].owner]) { st.list[i].owner = ''; n++; }
  return n;
}
function gearRead() {
  var s = null, st;
  try { s = localStorage.getItem(GEAR_KEY); } catch (e) { s = null; }
  if (!s) st = gearNew();
  else { try { st = gearNorm(JSON.parse(s)); } catch (e2) { st = gearNew(); } }
  gearFixOwners(st);
  return st;
}
function gearWrite(st) {
  try { localStorage.setItem(GEAR_KEY, JSON.stringify(st)); return true; } catch (e) { return false; }
}
function gearList(filter) {
  var st = gearRead(), f = filter || {};
  return st.list.filter(function (it) {
    if (f.slot && it.slot !== f.slot) return false;
    if (f.q !== undefined && it.q !== f.q) return false;
    if (f.free && it.owner) return false;
    if (f.owner !== undefined && it.owner !== f.owner) return false;
    return true;
  });
}
function gearFind(st, gid) {
  var i;
  for (i = 0; i < st.list.length; i++) if (st.list[i].id === gid) return st.list[i];
  return null;
}
// 某人身上的裝備:{wpn, arm, horse, relic}(沒穿 = null)
function gearOf(entryId) {
  var st = gearRead(), o = { wpn: null, arm: null, horse: null, relic: null }, i;
  if (!entryId) return o;
  for (i = 0; i < st.list.length; i++) if (st.list[i].owner === entryId) o[st.list[i].slot] = st.list[i];
  return o;
}

// ───────── 產生裝備 ─────────
// 只回物件(沒有 id / owner),呼叫端用 gearAdd 入庫。rng = () => [0,1);soul = 鍛造時投了精魄(只影響金裝特性機率)
function gearMake(slot, q, type, rng, soul) {
  var C = GEAR_CFG, main, attrs = [], pool, k, n, i, u, p, tr = [], tp;
  q = gearInt(q, 0, 3, 0);
  if (C.slots.indexOf(slot) < 0) slot = 'wpn';
  if (!type || C.typesOf[slot].indexOf(type) < 0) type = C.typesOf[slot][0];
  main = slot === 'relic' ? C.relicMain[Math.floor(rng() * C.relicMain.length) % C.relicMain.length] : C.mainOf[type];
  attrs.push([main, gearRound2(C.val[main][q] * C.mainMul)]);
  pool = C.sub[slot].filter(function (x) { return x !== main; });
  for (i = 1; i < C.nAttr[q] && pool.length; i++) { k = pool.splice(Math.floor(rng() * pool.length) % pool.length, 1)[0]; attrs.push([k, C.val[k][q]]); }
  if (q === 3) {
    p = soul ? C.traitP.soul : C.traitP.none;
    u = rng();
    n = u < p[1] ? 2 : (u < p[1] + p[0] ? 1 : 0);
    tp = GEAR_TRAITS.filter(function (t) { return t.slot === slot && t.on === 1; });
    while (n > 0 && tp.length) { tr.push(tp.splice(Math.floor(rng() * tp.length) % tp.length, 1)[0].id); n--; }
  }
  return { slot: slot, q: q, type: type, attrs: attrs, traits: tr, lv: 0, fp: 0, owner: '' };
}
function gearMainMatN(it) {
  var C = GEAR_CFG, mid = C.mainMat[it.slot] ? C.mainMat[it.slot][it.q] : '', rec = (typeof MAT_RECIPE !== 'undefined' && MAT_RECIPE[it.q]) ? MAT_RECIPE[it.q][it.slot === 'wpn' ? 'weapon' : 'armor'] : null;
  return { id: mid, n: (rec && rec[mid]) ? rec[mid] : 5 };
}
function gearSalvageValue(it) {
  var C = GEAR_CFG, m, mats = {};
  if (it.slot === 'wpn' || it.slot === 'arm') {
    m = gearMainMatN(it);
    mats[m.id] = Math.max(1, Math.floor(m.n / 2));
    return { mats: mats, shards: 0 };
  }
  return { mats: mats, shards: C.shard[it.q] };
}
function gearPayShards(n) {
  var cs;
  if (!(n > 0)) return 0;
  try { cs = typeof cardsGet === 'function' ? cardsGet() : null; } catch (e) { cs = null; }
  if (!cs) return 0;
  cs.shards = (cs.shards | 0) + n;
  if (typeof saveWorld === 'function') { try { saveWorld(); } catch (e2) { /* 略過 */ } }
  return n;
}
function gearSalvageGive(v) {
  var got = (typeof matGrant === 'function' && Object.keys(v.mats).length) ? matGrant(v.mats) : {};
  return { mats: got, shards: gearPayShards(v.shards) };
}
function gearUnwornCount(st) { var n = 0, i; for (i = 0; i < st.list.length; i++) if (!st.list[i].owner) n++; return n; }
// 入庫:未穿庫存已滿(200)→ 新得的這件自動分解。回 {ok, id, salvaged, gain, item}
function gearAdd(item) {
  var st = gearRead(), it, v, gain;
  it = gearItemNorm(Object.assign({}, item, { id: 'q' + (st.seq + 1), owner: '' }));
  if (!it) return { ok: false, reason: 'bad' };
  st.seq++;
  if (gearUnwornCount(st) >= GEAR_CFG.inv) {
    gearWrite(st);
    v = gearSalvageValue(it); gain = gearSalvageGive(v);
    return { ok: true, id: it.id, salvaged: true, gain: { mats: gain.mats, shards: gain.shards }, item: it };
  }
  st.list.push(it);
  gearWrite(st);
  return { ok: true, id: it.id, salvaged: false, item: it };
}

// ───────── 穿脫 ─────────
function gearCardOf(entryId) {
  var cs = null, f;
  try { cs = typeof cardsGet === 'function' ? cardsGet() : null; } catch (e) { cs = null; }
  if (!cs) return null;
  f = cardsFind(cs, entryId);
  return (f && f.list === 'roster') ? f.e : null;
}
function gearLockOf(e) {
  var k = (typeof cardsUseGet === 'function') ? cardsUseGet(e).k : 'idle';
  return (k === 'field' || k === 'garrison' || k === 'appoint') ? k : '';
}
var GEAR_LOCK_TXT = { field: '外勤', garrison: '駐派', appoint: '委任' };
// 穿上:reason = none(查無此裝備)/ nocard(卡不在名冊)/ star(星數不足,need)/ lock(此卡外勤 / 駐派 / 委任中)/ lockfrom(原主出征中)
function gearEquip(gid, entryId) {
  var st = gearRead(), it = gearFind(st, gid), e, i, old, from;
  if (!it) return { ok: false, reason: 'none' };
  e = gearCardOf(entryId);
  if (!e) return { ok: false, reason: 'nocard' };
  if ((typeof cardsStarLv === 'function' ? cardsStarLv(e) : 0) < GEAR_CFG.needStar[it.q]) return { ok: false, reason: 'star', need: GEAR_CFG.needStar[it.q] };
  if (gearLockOf(e)) return { ok: false, reason: 'lock', k: gearLockOf(e) };
  if (it.owner && it.owner !== entryId) {
    from = gearCardOf(it.owner);
    if (from && gearLockOf(from)) return { ok: false, reason: 'lockfrom', k: gearLockOf(from) };
  }
  for (i = 0; i < st.list.length; i++) if (st.list[i].owner === entryId && st.list[i].slot === it.slot && st.list[i].id !== gid) { old = st.list[i]; old.owner = ''; }
  it.owner = entryId;
  gearWrite(st);
  return { ok: true, replaced: old ? old.id : '', from: from ? from.id : '' };
}
function gearUnequip(gid) {
  var st = gearRead(), it = gearFind(st, gid), e;
  if (!it) return { ok: false, reason: 'none' };
  if (!it.owner) return { ok: false, reason: 'free' };
  e = gearCardOf(it.owner);
  if (e && gearLockOf(e)) return { ok: false, reason: 'lock', k: gearLockOf(e) };
  it.owner = '';
  gearWrite(st);
  return { ok: true };
}
// 卡離開名冊(分解 / 傳承拆解 / 遣散):身上裝備全部退回背包(庫存允許暫時超過 200)。回退回件數
function gearOnCardLeave(entryId) {
  var st, i, n = 0;
  if (!entryId) return 0;
  st = gearRead();
  for (i = 0; i < st.list.length; i++) if (st.list[i].owner === entryId) { st.list[i].owner = ''; n++; }
  if (n) gearWrite(st);
  return n;
}

// ───────── 數值 ─────────
function gearItemLv(it) { return gearInt(it && it.lv, 0, GEAR_CFG.lvMax, 0); }
function gearAttrVal(it, k) {   // 含強化的屬性值(顯示單位 % / 點 / 百分點)
  var i;
  for (i = 0; i < it.attrs.length; i++) if (it.attrs[i][0] === k) return it.attrs[i][1] * (1 + GEAR_CFG.lvGrow * gearItemLv(it));
  return 0;
}
function gearAttrText(k, v) {
  var a = GEAR_ATTR[k], s = String(Math.round(v * 10) / 10);
  if (!a) return k + ' ' + s;
  return a.n + ' +' + s + (a.u === 'pt' ? '' : '%');
}
// 最終數值(已套強化與整身封頂)。atk/mag/def/sres/hp/heal/cdmg 是比例(0.03 = 3%),spd 是點,crit / res 是機率加值(0.015),mods 合併後的特性欄位
function gearStatsOf(entryId) {
  var o = { atk: 0, mag: 0, def: 0, sres: 0, hp: 0, spd: 0, crit: 0, cdmg: 0, heal: 0, res: 0, mods: {}, n: 0 }, sum = {}, w = gearOf(entryId), C = GEAR_CFG, k, i, j, t, tm, key, m = o.mods;
  GEAR_CFG.slots.forEach(function (s) {
    var it = w[s];
    if (!it) return;
    o.n++;
    for (i = 0; i < it.attrs.length; i++) { k = it.attrs[i][0]; sum[k] = (sum[k] || 0) + gearAttrVal(it, k); }
    for (j = 0; j < it.traits.length; j++) {
      t = gearTraitDef(it.traits[j]);
      if (!t) continue;
      for (key in t.mods) {
        if (!gearHas(t.mods, key)) continue;
        tm = t.mods[key];
        if (t.merge === 'lowhp') { if (!m[key] || tm[1] < m[key][1]) m[key] = [tm[0], tm[1]]; }
        else if (t.merge === 'hi') { if (!m[key] || tm[1] > m[key][1]) m[key] = [tm[0], tm[1]]; }
        else m[key] = (m[key] || 0) + tm;
      }
    }
  });
  for (k in C.cap) if (gearHas(C.cap, k) && sum[k] > C.cap[k]) sum[k] = C.cap[k];   // 整身封頂(保險絲)
  ['atk', 'mag', 'def', 'sres', 'hp', 'heal', 'cdmg'].forEach(function (x) { o[x] = (sum[x] || 0) / 100; });
  o.spd = sum.spd || 0;
  o.crit = (sum.crit || 0) / 100;
  o.res = (sum.res || 0) / 100;
  return o;
}

// bn_units.js 用:名冊卡才有裝備,且只在旗標 ldui 開啟時。回 gearStatsOf 結果(沒穿任何裝備回 null);隊伍碼 / 他人卡重建出來的卡(不是本機名冊同一張)回 null
function gearForCard(card) {
  var e, st, i, has = false;
  if (!gearLive() || !card || typeof card.id !== 'string') return null;   // @DORMANT ldui
  e = gearCardOf(card.id);
  if (!e || e.name !== card.name || e.fig !== card.fig || e.gr !== card.gr) return null;
  st = gearRead();
  for (i = 0; i < st.list.length; i++) if (st.list[i].owner === card.id) { has = true; break; }
  return has ? gearStatsOf(card.id) : null;
}

// ───────── 強化(武器 / 防具:礪石;機率先扣後存再回傳)─────────
function gearEnhanceInfo(it) {
  var C = GEAR_CFG, nx = it.lv + 1, m;
  if (it.lv >= C.lvMax) return { max: true };
  m = gearMainMatN(it);
  return { max: false, to: nx, whet: (typeof MAT_WHET !== 'undefined' ? MAT_WHET[nx] : nx), rate: C.enh.rate[nx], brk: C.enh.brk[nx], mainMat: m.id, mainN: m.n };
}
// reason:none / kind(馬寶具請用餵養)/ max / mat(礪石不足,need)。成功回 {ok, success, broke, lv, whet, refund, item, rate}
function gearEnhance(gid) {
  var st = gearRead(), it = gearFind(st, gid), info, r, ok, brk = false, back = {}, mm;
  if (!it) return { ok: false, reason: 'none' };
  if (it.slot !== 'wpn' && it.slot !== 'arm') return { ok: false, reason: 'kind' };
  info = gearEnhanceInfo(it);
  if (info.max) return { ok: false, reason: 'max' };
  if (typeof matHas === 'function' && !matHas({ m_whet: info.whet })) return { ok: false, reason: 'mat', need: info.whet };
  if (typeof matSpend === 'function') matSpend({ m_whet: info.whet });
  r = gearRng(st, 'enh');
  ok = r() < info.rate;
  if (ok) it.lv = info.to;
  else if (info.brk > 0 && r() < info.brk) {
    brk = true;
    st.list.splice(st.list.indexOf(it), 1);   // 損毀:裝備消失(穿在身上也一樣)
    back[info.mainMat] = Math.floor(info.mainN * GEAR_CFG.enh.refund);
    mm = Math.floor(info.whet * GEAR_CFG.enh.refund);
    if (mm > 0) back.m_whet = mm;
    Object.keys(back).forEach(function (k) { if (back[k] <= 0) delete back[k]; });
    if (typeof matGrant === 'function' && Object.keys(back).length) matGrant(back);
  }
  gearWrite(st);
  return { ok: true, success: ok, broke: brk, lv: it.lv, whet: info.whet, refund: back, item: it, rate: info.rate };
}
// ───────── 餵養(馬 / 寶具:餵同部位裝備,必成功、不損毀)─────────
function gearFeedLv(fp) {
  var need = GEAR_CFG.feedNeed, acc = 0, lv = 0, i;
  for (i = 1; i < need.length; i++) { acc += need[i]; if (fp >= acc) lv = i; else break; }
  return lv;
}
function gearFeedTotal() { var a = 0, i; for (i = 1; i < GEAR_CFG.feedNeed.length; i++) a += GEAR_CFG.feedNeed[i]; return a; }
// 到下一級還差幾點(滿級 0)
function gearFeedLeft(it) {
  var acc = 0, k;
  if (it.lv >= GEAR_CFG.lvMax) return 0;
  for (k = 1; k <= it.lv + 1; k++) acc += GEAR_CFG.feedNeed[k];
  return Math.max(0, acc - it.fp);
}
// foodIds:要餵掉的裝備 id(同部位、未穿、不能是自己)。reason:none / kind / max / food(餵料不合格)
function gearFeed(gid, foodIds) {
  var st = gearRead(), it = gearFind(st, gid), foods = [], pts = 0, i, f, seen = {};
  if (!it) return { ok: false, reason: 'none' };
  if (it.slot !== 'horse' && it.slot !== 'relic') return { ok: false, reason: 'kind' };
  if (it.lv >= GEAR_CFG.lvMax) return { ok: false, reason: 'max' };
  for (i = 0; i < (foodIds || []).length; i++) {
    f = gearFind(st, foodIds[i]);
    if (!f || f.id === gid || f.slot !== it.slot || f.owner || seen[f.id]) return { ok: false, reason: 'food' };
    seen[f.id] = 1; foods.push(f); pts += GEAR_CFG.feedPts[f.q];
  }
  if (!foods.length) return { ok: false, reason: 'food' };
  st.list = st.list.filter(function (x) { return !seen[x.id]; });
  it.fp = Math.min(100000, it.fp + pts);
  it.lv = gearFeedLv(it.fp);
  gearWrite(st);
  return { ok: true, pts: pts, n: foods.length, lv: it.lv, fp: it.fp, left: gearFeedLeft(it), item: it };
}
// ───────── 分解 ─────────
// ids:要分解的裝備 id。穿在身上的不能分解(略過,計入 skippedWorn)。回 {ok, n, mats, shards, skippedWorn}
function gearSalvage(ids) {
  var st = gearRead(), drop = {}, mats = {}, shards = 0, n = 0, worn = 0, i, it, v, k;
  for (i = 0; i < (ids || []).length; i++) {
    it = gearFind(st, ids[i]);
    if (!it || drop[it.id]) continue;
    if (it.owner) { worn++; continue; }
    drop[it.id] = 1; n++;
    v = gearSalvageValue(it);
    for (k in v.mats) if (gearHas(v.mats, k)) mats[k] = (mats[k] || 0) + v.mats[k];
    shards += v.shards;
  }
  if (!n) return { ok: false, reason: worn ? 'worn' : 'none', n: 0, mats: {}, shards: 0, skippedWorn: worn };
  st.list = st.list.filter(function (x) { return !drop[x.id]; });
  gearWrite(st);
  if (Object.keys(mats).length && typeof matGrant === 'function') matGrant(mats);
  gearPayShards(shards);
  return { ok: true, n: n, mats: mats, shards: shards, skippedWorn: worn };
}
// 一鍵分解可選的:白 / 藍、未強化、未穿
function gearBulkIds() { return gearRead().list.filter(function (it) { return !it.owner && it.q <= 1 && it.lv === 0 && it.fp === 0; }).map(function (it) { return it.id; }); }

// ───────── 顯示用 ─────────
function gearIconKey(it) {
  if (!it) return '';
  if (it.slot === 'wpn') return it.type === 'wen' ? 'eqi_fan' : 'eqi_blade';
  if (it.slot === 'arm') return it.type === 'robe' ? 'eqi_robe' : 'eqi_armor';
  if (it.slot === 'horse') return 'eqi_horse';
  return { mag: 'eqi_book', heal: 'eqi_gourd', res: 'eqi_bag', sres: 'eqi_mirror' }[it.attrs[0][0]] || 'eqi_book';
}
function gearTitle(it) {
  var C = GEAR_CFG, main = it.attrs[0][0];
  if (it.slot === 'relic') return C.qName[it.q] + '·' + ({ mag: '策略', heal: '藥葫蘆', res: '護身符', sres: '銅鏡' }[main] || '寶具');
  if (it.slot === 'horse') return C.qName[it.q] + '·戰馬';
  return C.qName[it.q] + '·' + ({ wu: '戰刀', wen: '羽扇', heavy: '重甲', robe: '法袍' }[it.type] || C.slotName[it.slot]);
}
if (typeof module !== 'undefined' && module.exports) module.exports = { gearMake: gearMake, gearStatsOf: gearStatsOf };

// js/bn_skcard.js — 戰法傳承與裝備(card_ui_redesign §2 R1~R13;skill_rework §2.3)。
// 傳承 = 拆一張名冊卡 → 該卡可傳承的戰法永久解鎖(R1);金名人 S、紫名人 A、路人 B/C(R5);路人門檻紫以上(R3)。拆卡永遠消耗該卡(名人轉流浪,路人消失),另得碎片 BN_SKC.frag(R4)。
// 裝備:選擇槽白 1、青以上 2(BN_KIT_CFG.selSlots);任何已解鎖戰法都可裝進選擇槽(無適性 / 階級限制;可選 onlyTroops 才限兵種;兵種卡限同基礎兵種);同一戰法同時裝備人數上限 = BN_SKILL_MAXUSE[id](S/A 與名人 / 兵種 = 1,會壞平衡者 = 1,其餘 B 3 / C 5);解鎖後不消耗、不計張數(R7)。
// 兵書(章節掉落)直接解鎖通用戰法;已擁有則回傳碎片 BN_SKC.dupFrag(R12,由呼叫端 bnStgGrant 發碎片)。
// 存檔:世界內 'lorddomain.bnskc.v1'(進度鍵 SAVE_SLOT_KEYS;有值才寫):{v:2, own:{戰法id:解鎖時間}, eq:{entryId:[戰法id|null, 戰法id|null]}}。版本不符 / 壞檔 = 空;解鎖表外的戰法、重複 / 超額裝備在讀入時清掉。
// 對 bn_units.js 提供:bnSkcLearnOf(card)(路人裝備的戰法,沒有回 null;名人不走此路徑,B2 另接)。
// 全域:BNSKC bnskc bnSkcLoad bnSkcSave bnSkcOwned bnSkcTier bnSkcMaxUse bnSkcTroopOk bnSkcHolders bnSkcHolder bnSkcUseCount bnSkcSlots bnSkcCanEquip bnSkcEquip bnSkcUnequip bnSkcOnLeave bnSkcInheritList bnSkcInheritCheck bnSkcInherit bnSkcGrant bnSkcRecommend bnSkcOtherOf bnSkcLearnOf
// 不發聲、不寫 DOM。ES2017;不用 ?. ??。

var BNSKC = { key: 'lorddomain.bnskc.v1', v: 2 };
var bnskc = { raw: null, d: null };

function bnSkcLsGet() { try { return localStorage.getItem(BNSKC.key); } catch (e) { return null; } }
function bnSkcLsSet(v) { try { if (v === null) localStorage.removeItem(BNSKC.key); else localStorage.setItem(BNSKC.key, v); return true; } catch (e) { return false; } }
function bnSkcNew() { return { own: {}, eq: {} }; }
function bnSkcSkill(id) { return (typeof BN_SKILLS !== 'undefined' && BN_SKILLS[id]) || null; }
function bnSkcIsLegion(id) { return !!(typeof BN_LEGION !== 'undefined' && BN_LEGION.cards && BN_LEGION.cards[id]); }
function bnSkcFigGr(fig) { var f = (typeof CARD_FIG_BY_ID !== 'undefined' && fig) ? CARD_FIG_BY_ID[fig] : null; return f ? (f.gr | 0) : 0; }
function bnSkcCs(cs) { return cs || (typeof cardsGet === 'function' ? cardsGet() : null); }
// 名冊內找人(只認 roster;派駐 / 流浪 / 卡包的卡不計)
function bnSkcEntry(cs, id) {
  var c = bnSkcCs(cs), r = c && Array.isArray(c.roster) ? c.roster : [], i;
  if (!id) return null;
  for (i = 0; i < r.length; i++) if (r[i].id === id) return r[i];
  return null;
}

// 戰法階級:名人專屬 = 來源名人品階(金 S、紫 A);兵種卡有來源名人者同;無來源者 / 通用戰法 = BN_SKILL_TIER;通用戰法封頂 B。
// passive / ult 不可傳承,回 null
function bnSkcTier(id) {
  var L = bnSkcIsLegion(id) ? BN_LEGION.cards[id] : null, d = bnSkcSkill(id), gr, t;
  if (L) {
    gr = L.srcFig ? bnSkcFigGr(L.srcFig) : 0;
    if (gr) return BN_SKC.tierByGr[gr] || 'A';
    return (typeof BN_SKILL_TIER !== 'undefined' && BN_SKILL_TIER[id]) || 'C';
  }
  if (!d || d.cat === 'passive' || d.cat === 'ult') return null;
  if (d.fig) { gr = bnSkcFigGr(d.fig); return BN_SKC.tierByGr[gr] || 'A'; }
  t = (typeof BN_SKILL_TIER !== 'undefined' && BN_SKILL_TIER[id]) || 'C';
  if (t === 'S' || t === 'A') t = BN_SKC.genericMaxTier;
  return t;
}
// 同時裝備上限(BN_SKILL_MAXUSE,由 tools/bn_kit_gen.js 產生;缺項 = 1)。S / A 階與名人 / 兵種戰法 = 1
function bnSkcMaxUse(id) {
  var n = typeof BN_SKILL_MAXUSE !== 'undefined' && BN_SKILL_MAXUSE ? BN_SKILL_MAXUSE[id] : 0;
  return n > 0 ? n : 1;
}
// 兵種限制(可選欄位 onlyTroops:沒寫 = 全兵種可裝);兵種卡另由 bnSkcCanEquip 限同基礎兵種
function bnSkcTroopOk(e, id) {
  var d = bnSkcSkill(id), ot = d && d.onlyTroops;
  if (!ot || !ot.length) return true;
  return ot.indexOf(bnDefaultTroop(e)) >= 0;
}

// 讀檔(依 localStorage 原字串快取;切換世界後字串變了就重讀)
function bnSkcLoad() {
  var raw = bnSkcLsGet(), o = null, d = bnSkcNew(), k, j, taken = {}, legionOf = {};
  if (bnskc.d && raw === bnskc.raw) return bnskc.d;
  if (raw) { try { o = JSON.parse(raw); } catch (e) { o = null; } }
  if (o && typeof o === 'object' && o.v === BNSKC.v) {
    if (o.own && typeof o.own === 'object') for (k in o.own) {
      if (bnSkcTier(k)) d.own[String(k).slice(0, 40)] = Math.max(0, Math.floor(+o.own[k]) || 0);
    }
    if (o.eq && typeof o.eq === 'object') for (k in o.eq) {
      var a = o.eq[k], arr = [null, null], key = String(k).slice(0, 40);
      if (!Array.isArray(a)) continue;
      for (j = 0; j < 2; j++) {
        var x = a[j];
        if (typeof x !== 'string' || !d.own.hasOwnProperty(x)) continue;
        if (arr.indexOf(x) >= 0) continue;
        if ((taken[x] || 0) >= bnSkcMaxUse(x)) continue;
        if (bnSkcIsLegion(x) && legionOf[key]) continue;
        arr[j] = x;
        taken[x] = (taken[x] || 0) + 1;
        if (bnSkcIsLegion(x)) legionOf[key] = 1;
      }
      if (arr.some(function (v) { return v; })) d.eq[key] = arr;
    }
  }
  bnskc.raw = raw; bnskc.d = d;
  return d;
}
function bnSkcHas(d) { return Object.keys(d.own).length || Object.keys(d.eq).length; }
// 有值才寫
function bnSkcSave(d) {
  var raw;
  d = d || bnSkcLoad();
  raw = bnSkcHas(d) ? JSON.stringify({ v: BNSKC.v, own: d.own, eq: d.eq }) : null;
  if (raw === null && bnSkcLsGet() === null) { bnskc.raw = null; bnskc.d = d; return true; }
  if (!bnSkcLsSet(raw)) return false;
  bnskc.raw = raw; bnskc.d = d;
  return true;
}

function bnSkcOwned(id) { return bnSkcLoad().own.hasOwnProperty(id); }
// 持有人:回名冊 entry id 或 null(cs 省略時用 cardsGet;只認名冊內的人)
function bnSkcHolders(id, cs) {
  var d = bnSkcLoad(), k, out = [];
  for (k in d.eq) if (d.eq[k].indexOf(id) >= 0 && (!bnSkcCs(cs) || bnSkcEntry(cs, k))) out.push(k);
  return out;
}
function bnSkcHolder(id, cs) {
  var h = bnSkcHolders(id, cs);
  return h.length ? h[0] : null;
}
// 目前使用數(名冊內裝備此戰法的人數)
function bnSkcUseCount(id, cs) { return bnSkcHolders(id, cs).length; }
// 選擇槽數:白 1、青以上 2(BN_KIT_CFG.selSlots 依品階索引)
function bnSkcSlots(e) {
  var n = (typeof BN_KIT_CFG !== 'undefined' && BN_KIT_CFG.selSlots) || [0, 0, 0, 0, 0];
  return e ? (n[e.gr | 0] | 0) : 0;
}
// 能否裝備:回 {ok, reason};reason:none(不在名冊)/ own(未解鎖)/ slot(槽位不存在)/ dup(同人兩槽同戰法)/ legion(兵種卡每人 1 張、限同兵種)/ troop(onlyTroops 不符)/ full(使用數已達 maxUse,holders 為目前裝備者)
// 學養(fit)為軟適性:只影響發動 / 傷害(引擎端),不擋裝備。
function bnSkcCanEquip(cs, e, slot, id) {
  var r = bnSkcEntry(cs, e && e.id), cur, i, hs, n;
  if (!r) return { ok: false, reason: 'none' };
  if (!bnSkcOwned(id)) return { ok: false, reason: 'own' };
  if (!(slot >= 0 && slot < bnSkcSlots(r))) return { ok: false, reason: 'slot' };
  cur = bnSkcLoad().eq[r.id] || [null, null];
  for (i = 0; i < 2; i++) if (i !== slot && cur[i] === id) return { ok: false, reason: 'dup' };
  if (bnSkcIsLegion(id)) {
    if (BN_LEGION.cards[id].troop !== bnDefaultTroop(r)) return { ok: false, reason: 'legion' };
    for (i = 0; i < 2; i++) if (i !== slot && cur[i] && bnSkcIsLegion(cur[i])) return { ok: false, reason: 'legion' };
  } else if (!bnSkcSkill(id)) return { ok: false, reason: 'own' };
  if (!bnSkcTroopOk(r, id)) return { ok: false, reason: 'troop' };
  hs = bnSkcHolders(id, cs).filter(function (k) { return k !== r.id; });
  n = bnSkcMaxUse(id);
  if (hs.length >= n) return { ok: false, reason: 'full', holders: hs, max: n };
  return { ok: true, reason: '' };
}
// 裝備:回 {ok, reason};S/A 不自動搶,要換人須先 bnSkcUnequip
function bnSkcEquip(cs, e, slot, id) {
  var c = bnSkcCanEquip(cs, e, slot, id), r, d, arr;
  if (!c.ok) return c;
  r = bnSkcEntry(cs, e.id); d = bnSkcLoad();
  arr = d.eq[r.id] ? d.eq[r.id].slice() : [null, null];
  arr[slot] = id;
  d.eq[r.id] = arr;
  bnSkcSave(d);
  return { ok: true, reason: '' };
}
// 卸下某槽:回 {ok, reason}
function bnSkcUnequip(entryId, slot) {
  var d = bnSkcLoad(), arr;
  if (!(slot >= 0 && slot < 2)) return { ok: false, reason: 'slot' };
  arr = d.eq[entryId];
  if (!arr) return { ok: true, reason: '' };
  arr = arr.slice(); arr[slot] = null;
  if (arr.some(function (v) { return v; })) d.eq[entryId] = arr; else delete d.eq[entryId];
  bnSkcSave(d);
  return { ok: true, reason: '' };
}
// 人離隊 / 遣散 / 傳承時清掉該人的裝備(解鎖仍保留,R7)
function bnSkcOnLeave(entryId) {
  var d = bnSkcLoad();
  if (d.eq[entryId]) { delete d.eq[entryId]; bnSkcSave(d); }
  return true;
}
// 路人的卡面戰法(固定大招與被動除外;不含學習欄裝備,避免裝備內容反過來變成可傳承)
function bnSkcNatural(e) {
  var troop = bnDefaultTroop(e), nat = bnNativeSkills(e, troop), auto = BN_DATA.slots.autoLearn ? bnAutoLearn(e, troop, nat, bnSlotCount(e)) : [];
  return nat.concat(auto).filter(function (id, i, a) { return a.indexOf(id) === i && bnSkcSkill(id) && bnSkcTier(id); });
}
// 可傳承清單:名人 = BN_KIT_BY.figs[fig].pool(+ legion);路人 = 卡面戰法。回 [{id, tier, owned}]
function bnSkcInheritList(e) {
  var K = (typeof BN_KIT_BY !== 'undefined' && BN_KIT_BY.figs) ? BN_KIT_BY.figs : {}, k, ids = [], out = [];
  if (!e) return out;
  if (e.fig) { k = K[e.fig]; if (!k) return out; ids = (k.pool || []).slice(); if (k.legacy) ids.push(k.legacy); if (k.legion) ids.push(k.legion); }
  else ids = bnSkcNatural(e);
  ids.forEach(function (id) {
    var t = bnSkcTier(id);
    if (t && !out.some(function (x) { return x.id === id; })) out.push({ id: id, tier: t, owned: bnSkcOwned(id) });
  });
  return out;
}
// 傳承前檢查:回 {ok, reason, entry, list, fresh};reason:none / locked(🔒)/ grade(未達紫)/ owned(已全部擁有)
function bnSkcInheritCheck(cs, e) {
  var r = bnSkcEntry(cs, e && e.id), list, fresh = [];
  if (!r) return { ok: false, reason: 'none' };
  if (r.star) return { ok: false, reason: 'locked' };
  if ((r.gr | 0) < BN_SKC.minGr) return { ok: false, reason: 'grade' };
  list = bnSkcInheritList(r);
  if (!list.length) return { ok: false, reason: 'none' };
  list.forEach(function (x) { if (!x.owned) fresh.push(x.id); });
  if (!fresh.length) return { ok: false, reason: 'owned', list: list };
  return { ok: true, reason: '', entry: r, list: list, fresh: fresh };
}
// 碎片:名人金 20 / 紫 10;路人紫 8 / 宗師 12
function bnSkcFrag(r) {
  var F = BN_SKC.frag;
  if (r.fig) return (r.gr | 0) === 4 ? F.figGold : F.figPurple;
  return ((r.gr | 0) === 3 && (r.learn | 0) === 3) ? F.purpleMaster : F.purple;
}
// 傳承(拆卡):解鎖全部可傳承戰法、人離開名冊(名人轉流浪、路人消失)、得碎片。回 {ok, reason, unlocked, shards, wander}
function bnSkcInherit(cs, e) {
  var chk = bnSkcInheritCheck(cs, e), r, rel, frag, d, now, isFig;
  if (!chk.ok) return { ok: false, reason: chk.reason, unlocked: [], shards: 0, wander: false };
  r = chk.entry; isFig = !!r.fig; frag = bnSkcFrag(r);
  rel = cardsRelease(cs, r.id, { unassign: true });
  if (!rel || !rel.ok) return { ok: false, reason: rel ? rel.reason : 'none', unlocked: [], shards: 0, wander: false };
  if (!isFig) { cs.shards -= rel.shards; cs.lastRel = null; }   // 路人傳承不給遣散碎片,改給傳承碎片(不可復原遣散)
  bnSkcOnLeave(r.id);
  d = bnSkcLoad(); now = Date.now();
  chk.fresh.forEach(function (id) { d.own[id] = now; });
  bnSkcSave(d);
  cardsShardGain(cs, frag);
  return { ok: true, reason: '', unlocked: chk.fresh.slice(), shards: frag, wander: isFig };
}
// 兵書 / 戰法卡解鎖(通用戰法):未有 → 解鎖;已有 → dup = BN_SKC.dupFrag(由呼叫端發碎片)。回 {ok, unlocked, dup}
function bnSkcGrant(id) {
  var d, t = bnSkcTier(id), s = bnSkcSkill(id);
  if (!t || !s || s.fig || bnSkcIsLegion(id)) return { ok: false, unlocked: false, dup: 0 };
  if (bnSkcOwned(id)) return { ok: true, unlocked: false, dup: BN_SKC.dupFrag };
  d = bnSkcLoad(); d.own[id] = Date.now(); bnSkcSave(d);
  return { ok: true, unlocked: true, dup: 0 };
}
// 推薦 n 位可裝備 id 的名冊人(第一個空槽;依品階高到低)
function bnSkcRecommend(id, n, cs) {
  var c = bnSkcCs(cs), roster = c && Array.isArray(c.roster) ? c.roster : [], d = bnSkcLoad(), out = [], i, slot, cur;
  roster.forEach(function (r) {
    if (out.length >= (n | 0) && n) return;
    cur = d.eq[r.id] || [null, null];
    for (slot = 0; slot < bnSkcSlots(r); slot++) if (!cur[slot]) break;
    if (slot < bnSkcSlots(r) && bnSkcCanEquip(c, r, slot, id).ok) out.push(r);
  });
  out.sort(function (a, b) { return (b.gr | 0) - (a.gr | 0); });
  return n ? out.slice(0, n) : out;
}
// R10 他人效果:名人專屬戰法裝在『非原主』身上時的效果(BN_SKILL_OTHER;缺項 = BN_KIT_CFG.otherDefaultMul)。原主 / 通用戰法回 null。戰鬥接線屬 B2
function bnSkcOtherOf(id, e) {
  var d = bnSkcSkill(id);
  if (!d || !d.fig || !e || e.fig === d.fig) return null;
  return (typeof BN_SKILL_OTHER !== 'undefined' && BN_SKILL_OTHER[id]) || { mul: (typeof BN_KIT_CFG !== 'undefined' ? BN_KIT_CFG.otherDefaultMul : 0.8) };
}
// bn_units.js 用:路人裝備的戰法(名冊卡才有;名人與無裝備者回 null)
function bnSkcLearnOf(card) {
  var r, eq;
  if (!card || card.fig || !card.id) return null;
  r = bnSkcEntry(null, card.id);
  if (!r || r.name !== card.name) return null;
  eq = bnSkcLoad().eq[card.id];
  return eq && eq.some(function (x) { return x; }) ? eq.slice() : null;
}

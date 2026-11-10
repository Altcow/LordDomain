// js/bn_units.js — 名冊卡 → 戰鬥單位(PLAN_BATTLE_A §2:屬性換算、兵種適性、站位、羈絆、詞條)。純邏輯、無 DOM。
// 依賴(載入順序):carddata.js(CARD_GRADE CARD_JOBS CARD_FIGS CARD_FIG_BY_ID)、bn_data.js、bn_skills_data.js。隨機名冊卡(模擬器用)另需 cards.js。
// 產物 = 「單位規格 spec」(純 JSON),engine 的 rec.teamA/teamB 直接吃 spec。
// spec = {name, fig, fac, gr, troop, row, col, apt:{兵種:'S'|'A'|'B'|'C'}, stats:{hp,atk,mag,def,sres,spd,heal,sh,crit,res}, mods:{...}, skills:[戰法 id], ult:id, tags:[...], jobs:[...], traits:[...]}
// B4 / B6:名人專屬詞條(BN_FIG_TRAIT)併入 mods;名人強度校正(BN_FIG_TUNE);戰法傳承裝備(bnSkcLearnOf → bnLearnMerge)以 typeof 守衛讀 bn_skcard.js;研兵(bnBookDrillOf)以 typeof 守衛讀 bn_book.js。
// 全域:bnEff bnCardStats bnAptOf bnDefaultTroop bnUnitSpec bnSpecRaw bnBuildTeam bnRandomCard bnRandomLearned bnRowOf bnPower bnLearnMerge

// B6 戰法平衡覆寫(bn_data.js BN_SKILL_TUNE):載入時套到 BN_SKILLS(只改記憶體,不改資料檔)
(function () {
  if (typeof BN_SKILL_TUNE === 'undefined' || typeof BN_SKILLS === 'undefined') return;
  Object.keys(BN_SKILL_TUNE).forEach(function (id) { if (BN_SKILLS[id]) Object.assign(BN_SKILLS[id], BN_SKILL_TUNE[id]); });
})();
function bnEff(v) {
  var k = BN_DATA.effKnee, s = BN_DATA.effSlope;
  if (v <= k[0]) return v;
  if (v <= k[1]) return k[0] + (v - k[0]) * s[0];
  return k[0] + (k[1] - k[0]) * s[0] + (v - k[1]) * s[1];
}
function bnCardStats(card) {
  var t = card.tok || 0;
  return card.st.map(function (v) { return bnEff(v + t); });   // [統, 武, 智, 政, 魅]
}
function bnRound(x) { return Math.round(x + 1e-9); }
function bnFormula(f, T, W, Z, P) { return f[0] + f[1] * T + f[2] * W + f[3] * Z + f[4] * P; }

// 適性分(§2.2)
function bnAptScores(S5, ja) {
  var T = S5[0], W = S5[1], Z = S5[2], P = S5[3];
  var sc = { '盾': 0.7 * T + 0.3 * W, '槍': 0.6 * W + 0.4 * T, '騎': 0.6 * W + 0.2 * T + 0.2 * Z, '弓': 0.5 * W + 0.3 * Z + 0.2 * T, '謀': 0.8 * Z + 0.2 * P };
  Object.keys(ja || {}).forEach(function (jid) {
    var pr = BN_JOB_PRESET[jid];
    if (!pr) return;
    var b = BN_DATA.aptJob + (ja[jid] >= 3 ? BN_DATA.aptJobTier : 0);
    BN_DATA.troopList.forEach(function (tp) { if (pr.troop.indexOf(tp) >= 0) sc[tp] += b; });
  });
  return sc;
}
function bnAptGrade(score) {
  var c = BN_DATA.aptCut;
  return score >= c.S ? 'S' : score >= c.A ? 'A' : score >= c.B ? 'B' : 'C';
}
function bnAptOf(card) {
  var S5 = bnCardStats(card), sc = bnAptScores(S5, card.ja), out = {}, fg = card.fig ? BN_FIG_SKILLS[card.fig] : null;
  BN_DATA.troopList.forEach(function (tp) {
    var g = bnAptGrade(sc[tp]);
    if (fg) { if (tp === fg.troop) g = 'S'; else if (g === 'S') g = 'A'; }
    out[tp] = g;
  });
  return { apt: out, scores: sc };
}
function bnDefaultTroop(card) {
  var fg = card.fig ? BN_FIG_SKILLS[card.fig] : null, r, best = null;
  if (fg) return fg.troop;
  r = bnAptOf(card).scores;
  BN_DATA.troopList.forEach(function (tp) { if (best === null || r[tp] > r[best]) best = tp; });
  return best;
}
function bnRowOf(card, troop) {
  var fg = card.fig ? BN_FIG_SKILLS[card.fig] : null;
  if (fg) return fg.row === '前' ? 0 : fg.row === '中' ? 1 : 2;
  return (troop === '盾' || troop === '槍') ? 0 : (troop === '騎' ? 1 : 2);
}
function bnPower(spec) {   // 戰力(§5.2,僅顯示)
  var s = spec.stats;
  return Math.round((s.hp / 10 + s.atk * 2 + s.mag + s.def + s.spd) * (1 + 0.08 * (spec.skills || []).length));
}

// 詞條 → mods / 靜態屬性修正
function bnTraitFold(card, troop) {
  var mods = {}, st = { stT: 0, stW: 0, stZ: 0, atk: 0, hp: 0, def: 0, spd: 0, atkTroop: 0, all: 1 }, ids = card.tr || [], i, tm, k, scene = '', list;
  function add(o, key, v) { o[key] = (o[key] || 0) + v; }
  function addMap(key, src) { mods[key] = mods[key] || {}; Object.keys(src).forEach(function (x) { mods[key][x] = (mods[key][x] || 0) + src[x]; }); }
  list = ids.map(function (id) { return BN_TRAIT_MODS[id]; });
  if (card.fig && typeof BN_FIG_TRAIT !== 'undefined' && BN_FIG_TRAIT[card.fig]) list.push(BN_FIG_TRAIT[card.fig].m);   // 名人專屬詞條(B4)
  for (i = 0; i < list.length; i++) {
    tm = list[i];
    if (!tm) continue;
    if (tm.troop && tm.troop !== troop) continue;
    if (tm.stT) st.stT += tm.stT;
    if (tm.stW) st.stW += tm.stW;
    if (tm.stZ) st.stZ += tm.stZ;
    if (tm.atk) st.atk += tm.atk;
    if (tm.hp) st.hp += tm.hp;
    if (tm.spd) st.spd += tm.spd;
    if (tm.atkTroop && tm.atkTroop[troop]) st.atkTroop += tm.atkTroop[troop];
    if (tm.allMul) st.all *= tm.allMul;
    ['takenPct', 'frontTaken', 'takenRanged', 'critTaken', 'healTaken', 'r1Dmg', 'firstHit', 'vsShield', 'atkMelee', 'early2', 'lateTaken', 'rowTakenFront', 'rowRate', 'rowAtk', 'shieldOut', 'r1Spd', 'reach', 'stratPct', 'takenStrat', 'healOut', 'teamAtk'].forEach(function (key) { if (tm[key]) add(mods, key, tm[key]); });
    ['vsFac', 'vsFig', 'vsTroop', 'teamTroopSpd'].forEach(function (key) { if (tm[key]) addMap(key, tm[key]); });
    if (tm.lowHpTaken) mods.lowHpTaken = tm.lowHpTaken.slice();
    if (tm.teamTakenFac) mods.teamTakenFac = { fac: tm.teamTakenFac.fac, v: tm.teamTakenFac.v };
    if (tm.takenFromTroop) { mods.takenFromTroop = mods.takenFromTroop || {}; Object.keys(tm.takenFromTroop).forEach(function (t) { mods.takenFromTroop[t] = (mods.takenFromTroop[t] || 1) * tm.takenFromTroop[t]; }); }
    if (tm.burnTaken) mods.burnTaken = (mods.burnTaken || 1) * tm.burnTaken;
    if (tm.burnOut) mods.burnOut = (mods.burnOut || 1) * tm.burnOut;
    if (tm.magMul) mods.magMul = (mods.magMul || 1) * tm.magMul;
    if (tm.lowHp) mods.lowHp = tm.lowHp.slice();
    ['undyingOnce', 'gamble', 'noFmt'].forEach(function (key) { if (tm[key]) mods[key] = 1; });
    if (tm.immuneFirst) mods.immuneFirst = (mods.immuneFirst || []).concat(tm.immuneFirst);
    if (tm.opening) mods.opening = tm.opening;
    if (tm.fmt) { mods.fmtTrait = mods.fmtTrait || []; mods.fmtTrait.push(tm.fmt); }
    if (tm.fmtAll) mods.fmtAll = tm.fmtAll;
  }
  return { mods: mods, st: st };
}

// 戰法欄位(§4.8):名人 = json 全部;路人 = 自帶 1 + 學習欄
function bnSlotCount(card) {
  var S = BN_DATA.slots, base = S.learnByGr[card.gr] || 0;
  if (card.learn === 3 || (card.up | 0) >= 2) base += S.learnBonus;
  return Math.min(S.learnCap, base);
}
// 自動學習(BN_DATA.slots.autoLearn):沒有指定 learned 的路人,依卡面雜湊從通用戰法池補滿學習欄。確定性、不改卡
function bnAutoLearn(card, troop, native, n) {
  var pool = BN_GENERIC.skills.filter(function (id) {
    var d = BN_SKILLS[id], f = d.fit || {};
    return d.cat !== 'passive' && native.indexOf(id) < 0 && ((f.troops && f.troops.indexOf(troop) >= 0) || (f.jobs && card.ja && f.jobs.some(function (j) { return card.ja[j]; })));
  }), out = [], h = 2166136261, s = String(card.name) + '|' + (card.no || '') + '|' + (card.main || '') + '|' + card.gr, i, k;
  for (i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  while (out.length < n && pool.length) { k = h % pool.length; out.push(pool[k]); pool.splice(k, 1); h = (Math.imul(h, 1664525) + 1013904223) >>> 0; }
  return out;
}
// 學習欄合併(B4):L = 各欄指定戰法(null / 無效 = 該欄自動);自動欄依 bnAutoLearn 補(避開已指定者)。回傳最多 n 個 id
function bnLearnMerge(card, troop, native, n, L) {
  var out = [], fixed = [], i, auto, k = 0;
  for (i = 0; i < n; i++) { var id = L[i]; fixed.push(id && BN_SKILLS[id] && native.indexOf(id) < 0 && fixed.indexOf(id) < 0 ? id : null); }
  auto = bnAutoLearn(card, troop, native.concat(fixed.filter(function (x) { return x; })), n);
  for (i = 0; i < n; i++) out.push(fixed[i] || auto[k++] || null);
  return out.filter(function (x) { return x; });
}
function bnNativeSkills(card, troop) {
  var ids = Object.keys(card.ja || {}), main = card.main, out = [], pr, j;
  if (main && ids.indexOf(main) > 0) { ids.splice(ids.indexOf(main), 1); ids.unshift(main); }
  for (j = 0; j < ids.length; j++) {
    pr = BN_JOB_PRESET[ids[j]];
    if (!pr) continue;
    out.push(ids[j] === 'bingshi' && (card.ja[ids[j]] || 0) >= 3 ? pr.skill3 : pr.skill);
    break;
  }
  if (!out.length) out.push(BN_CARD_SKILL_MAP.sk_gen);   // 無職業:臨陣應變
  return out;
}
function bnUltFor(card, troop) {
  var k = troop, row;
  if (troop === '謀') {
    var jb = BN_JOB_PRESET, main = card.main, j = main && typeof CARD_JOB_BY_ID !== 'undefined' ? CARD_JOB_BY_ID[main] : null;
    row = j ? j.row : '';
    if (row === '醫') k = '謀醫'; else if (row === '政') k = '謀政'; else if (row === '商') k = '謀商';
  }
  return BN_ULT_BY[k] || BN_ULT_BY['槍'];
}

// ───────── 戰法欄位新制(B2)helper:選擇槽來源 / 他人效果 / 本命 ─────────
// 名冊內名人或路人的裝備槽(bnskc.eq);不在名冊 / 無裝備 = null。名人與路人走同一份 eq(路人另由 bnSkcLearnOf 讀)
function bnKitEq(card) {
  var r, eq;
  if (!card || !card.id || typeof bnSkcEntry !== 'function' || typeof bnSkcLoad !== 'function') return null;
  r = bnSkcEntry(null, card.id);
  if (!r || r.name !== card.name) return null;
  eq = bnSkcLoad().eq[card.id];
  return eq ? eq.slice() : null;
}
// 選擇槽數(BN_KIT_CFG.selSlots 依品階;bn_skcard.js 未載入 = 0,名人僅剩固定 + 被動 + 聯動)
function bnKitN(card) { return typeof bnSkcSlots === 'function' ? bnSkcSlots(card) : 0; }
// 選擇槽內容:o.slots(模擬 / 測試明確指定)優先,否則讀裝備;最多 sl 個,空槽略過(不自動配)
function bnKitSlotIds(card, o, sl) {
  if (o && Array.isArray(o.slots)) return o.slots.filter(function (x) { return !!x; });   // 明確指定(敵將本命池 / 模擬)不截斷
  return (bnKitEq(card) || []).filter(function (x) { return !!x; }).slice(0, sl);
}
// 單一選擇槽戰法的實例參數:原主 = 本命 homeRate;他人 = BN_SKILL_OTHER(bnSkcOtherOf)的 mul / tgtCut / ratePP。通用 / 兵種卡 / 無專屬者回 null
function bnKitInst(card, id) {
  var d = BN_SKILLS[id], out = {}, ot;
  if (!d || !d.fig) return null;
  if (d.fig === card.fig) { out.home = BN_KIT_CFG.homeRate || 0; return out; }
  ot = typeof bnSkcOtherOf === 'function' ? bnSkcOtherOf(id, card) : { mul: BN_KIT_CFG.otherDefaultMul };
  if (!ot) return null;
  if (ot.mul !== undefined) out.mul = ot.mul;
  if (ot.tgtCut) out.tgtCut = ot.tgtCut;
  if (ot.ratePP) out.ratePP = ot.ratePP;
  return out;
}
// 整隊登記:{戰法 id: 實例參數};沒有任何需登記者回 null(spec 不帶 kitInst,路人 / generic 規格不變)
function bnKitMap(card, ids) {
  var out = {}, any = false;
  (ids || []).forEach(function (id) { var k = bnKitInst(card, id); if (k) { out[id] = k; any = true; } });
  return any ? out : null;
}
// 模擬用名人選擇槽:自身專屬池(非被動)以雜湊排序取前 N 個(確定性、不消耗 rng,既有路人亂數順序不變)
function bnSimFigSlots(card) {
  var kf = (typeof BN_KIT_BY !== 'undefined' && BN_KIT_BY.figs && BN_KIT_BY.figs[card.fig]) || null, pool, n = bnKitN(card);
  if (!kf || !kf.pool) return [];
  pool = kf.pool.filter(function (id) { return BN_SKILLS[id] && BN_SKILLS[id].cat !== 'passive'; });
  return pool.map(function (id) { return [bnHash(card.fig, id), id]; }).sort(function (a, b) { return a[0] - b[0]; }).slice(0, n).map(function (x) { return x[1]; });
}

// ───────── B3 兵種卡(精銳軍團)組裝 ─────────
// 選擇槽裝了兵種卡(lg_*)且其兵種 = 單位基礎兵種 → spec.legion(每人最多一張;不符者不生效,組裝端保險)。
// bnLgApply(bnBuildTeam 內)把卡面優點 / 弱點展開成 mods.lg 條目 {k, v, tr?, thr?, mul?, every?, g?, car?, when?},由 bn_engine.js 的 bnLgVal / bnLgOn 逐回合判定。
// 規則:本人 ×1.0;同基礎兵種隊友 ×0.5(優點與弱點皆同比例);每張卡全隊只算第一位裝備者;一名隊友最多受一張分享;裝兵種卡者不受分享。
// 無兵種卡的單位不寫任何 lg 欄(舊戰鬥逐位不變)。
function bnLgIs(id) { return !!(typeof BN_LEGION !== 'undefined' && BN_LEGION.cards && BN_LEGION.cards[id]); }
function bnLgPick(ids, troop) {
  var i;
  for (i = 0; ids && i < ids.length; i++) if (bnLgIs(ids[i]) && BN_LEGION.cards[ids[i]].troop === troop) return ids[i];
  return null;
}
function bnLgLord(fig) { return !!fig && !!BN_DATA.figTags && BN_DATA.figTags.lord.indexOf(fig) >= 0; }
// 卡面條目 → lg 條目。m = 倍率(本人 1、隊友 0.5);x = 接收單位;car = 來源在隊內的 index;when / thr = 分享停擺條件
function bnLgEntries(e, m, x, car, when, thr) {
  var k = e.k, v = e.v, out = [], g = e.gate ? { f: e.gate.from || 1, t: e.gate.to || BN_DATA.maxRound } : null;
  function put(o) {
    var r = { k: o.k || k, v: o.v };
    ['tr', 'mul', 'every', 'thr'].forEach(function (p) { if (o[p] !== undefined) r[p] = o[p]; });
    if (g) r.g = g;
    if (car !== undefined) { r.car = car; r.when = when || 'carAlive'; if (thr !== undefined && when === 'carHpGe') r.thr = thr; }
    else if (when) r.when = when;
    out.push(r);
  }
  switch (k) {
    case 'takenVsTroop': case 'vsTroop': Object.keys(v).forEach(function (t) { put({ tr: t, v: v[t] * m }); }); break;
    case 'vsTag': if (v.lord !== undefined) put({ k: 'vsLord', v: v.lord * m }); break;
    case 'vsLowHp': case 'lowHpAtk': put({ thr: v[0], v: v[1] * m }); break;
    case 'extraBasic': put({ v: 0, mul: v.mul * m, every: v.every || 1 }); break;
    case 'chargeMul': put({ v: BN_DATA.cavCharge + (v - BN_DATA.cavCharge) * m }); break;
    case 'fatigueMul': put({ v: 1 + (v - 1) * m }); break;
    case 'lordTaken': if (bnLgLord(x.fig)) put({ k: 'takenPct', v: v * m }); break;
    // 本人限定:白毦兵替主公承受(戰鬥中由 bn_engine.js bnLgGuardOf 判定)
    case 'lordGuard': if (car === undefined) put({ v: 1 }); break;
    // 結構型(由 bnLgApply 另處理;noStack 由 bnLgApply 寫 mods.lgCardSpd、bnBuildTeam 的騎速羈絆取高)不展開
    case 'shareCap': case 'shareOffBelow': case 'noLordHalf': case 'noStack': case 'needFigElse': case 'onSrcDown': case 'onLordDown': case 'mateAtkNonTroop': case 'hpPerAlly': break;
    default: put({ v: v * m });
  }
  return out;
}
function bnLgPush(u, list) { if (list.length) u.mods.lg = (u.mods.lg || []).concat(list); }
// 黃巾 = fac 3;hpPerAlly.who:'黃巾' = 黃巾陣營隊友;'同兵種或黃巾' = 同兵種或黃巾陣營隊友(不含自己)。static:寫入 hp
function bnLgHpAlly(units, i, e, m) {
  var x = units[i], w = e.v.who, v = e.v.v * m, mx = e.v.max * m, cnt = 0, j;
  for (j = 0; j < units.length; j++) {
    if (j === i) continue;
    if (w === '黃巾' ? units[j].fac === 3 : (units[j].troop === x.troop || units[j].fac === 3)) cnt++;
  }
  x.stats.hp = bnRound(x.stats.hp * (1 + Math.min(mx, v * cnt)));
}
// 寫入兵種卡效果到 units(bnBuildTeam 傳入的深拷貝);不改動 spec 的其他欄位
function bnLgApply(units) {
  var n = units.length, self = [], held = [], owner = {}, cnt = [], lordIn = false, hasFig = {}, i, j, x, c;
  function capOf(j2) { var s = BN_LEGION.cards[self[j2]].cons.filter(function (e) { return e.k === 'shareCap'; })[0]; return s ? Math.min(BN_LEGION_CFG.shareMax, s.v) : BN_LEGION_CFG.shareMax; }
  function hasCon(card, k) { return card.cons.some(function (e) { return e.k === k; }); }
  units.forEach(function (u) { if (u.fig) hasFig[u.fig] = true; if (bnLgLord(u.fig)) lordIn = true; });
  for (i = 0; i < n; i++) {
    x = units[i];
    held[i] = !!bnLgPick([x.legion], x.troop);
    if (!held[i] || owner[x.legion]) continue;
    owner[x.legion] = 1; self[i] = x.legion;   // 同一張卡全隊只算第一位
  }
  // 本人:優點 / 弱點 ×1.0;無主公則優點減半(白毦兵等,整張卡的優點)
  for (i = 0; i < n; i++) {
    if (!self[i]) continue;
    c = BN_LEGION.cards[self[i]];
    var halfP = !lordIn && hasCon(c, 'noLordHalf') ? 0.5 : 1;
    x = units[i];
    c.pros.forEach(function (e) { if (e.k === 'hpPerAlly') bnLgHpAlly(units, i, e, halfP); else bnLgPush(x, bnLgEntries(e, halfP, x)); });
    if (c.noStack) x.mods.lgCardSpd = c.pros.filter(function (e) { return e.k === 'spd'; }).reduce(function (s, e) { return s + e.v * halfP; }, 0);   // 騎速同類加成取高(見 bnBuildTeam)
    c.cons.forEach(function (e) {
      if (e.k === 'onLordDown') { if (lordIn) { if (e.v.atkPct) bnLgPush(x, [{ k: 'atkPct', v: e.v.atkPct, when: 'lordDead' }]); if (e.v.defPct) bnLgPush(x, [{ k: 'defPct', v: e.v.defPct, when: 'lordDead' }]); } return; }
      if (e.k === 'shareOffBelow' || e.k === 'shareCap' || e.k === 'onSrcDown' || e.k === 'needFigElse' || e.k === 'mateAtkNonTroop') return;   // 分享型,見下
      bnLgPush(x, bnLgEntries(e, 1, x));
    });
  }
  // 隊友:每人最多受一張分享(同兵種、卡未重複、裝卡者不受分享);分享上限 shareCap
  function mate(i2, j2) {
    var cc = BN_LEGION.cards[self[j2]], xx = units[i2], halfP = !lordIn && hasCon(cc, 'noLordHalf') ? 0.5 : 1, sb = cc.cons.filter(function (e) { return e.k === 'shareOffBelow'; })[0];
    var wh = sb ? 'carHpGe' : undefined, th = sb ? sb.v : undefined;
    cc.pros.forEach(function (e) { if (e.k === 'hpPerAlly') bnLgHpAlly(units, i2, e, 0.5 * halfP); else bnLgPush(xx, bnLgEntries(e, 0.5 * halfP, xx, j2, wh, th)); });
    if (cc.noStack) xx.mods.lgCardSpd = cc.pros.filter(function (e) { return e.k === 'spd'; }).reduce(function (s, e) { return s + e.v * 0.5 * halfP; }, 0);
    cc.cons.forEach(function (e) {
      if (e.k === 'onSrcDown') { bnLgPush(xx, [{ k: 'atkPct', v: e.v.mateAtk * 0.5, car: j2, when: 'carDead' }]); return; }
      if (e.k === 'needFigElse') { if (!hasFig[e.v.fig]) bnLgPush(xx, [{ k: 'spd', v: e.v.mateSpd * 0.5, car: j2, when: 'carAlive' }]); return; }
      if (e.k === 'shareOffBelow' || e.k === 'shareCap' || e.k === 'noLordHalf' || e.k === 'mateAtkNonTroop' || e.k === 'onLordDown') return;
      bnLgPush(xx, bnLgEntries(e, 0.5, xx, j2, wh, th));
    });
  }
  for (i = 0; i < n; i++) {
    if (self[i] || held[i]) continue;
    for (j = 0; j < n; j++) {
      if (!self[j] || j === i || units[j].troop !== units[i].troop || (cnt[j] || 0) >= capOf(j)) continue;
      cnt[j] = (cnt[j] || 0) + 1;
      mate(i, j);
      break;
    }
  }
  // 侵暴為患(東州兵):我方非同兵種者攻擊 −(全額,不分享)
  for (j = 0; j < n; j++) {
    if (!self[j] || !hasCon(BN_LEGION.cards[self[j]], 'mateAtkNonTroop')) continue;
    var mc = BN_LEGION.cards[self[j]].cons.filter(function (e) { return e.k === 'mateAtkNonTroop'; })[0];
    for (i = 0; i < n; i++) if (i !== j && units[i].troop !== units[j].troop) bnLgPush(units[i], [{ k: 'atkPct', v: mc.v, car: j, when: 'carAlive' }]);
  }
}

// 單位規格。card = 名冊 entry(或 cardGen 結果)。o = {troop, row, col, learned:[id], slots:[id](名人選擇槽,省略則讀裝備), scene, drill(研兵比例,可省略)}
function bnUnitSpec(card, o) {
  o = o || {};
  var S5 = bnCardStats(card), apt = bnAptOf(card), troop = bnTroopNorm(o.troop) || bnDefaultTroop(card), c = BN_DATA.troops[troop], g = BN_DATA.grade[card.gr] || 1;
  if (o.apt) Object.assign(apt.apt, o.apt);   // 測試 / 手動指定適性
  var tf = bnTraitFold(card, troop), a = BN_DATA.apt[apt.apt[troop]] || 1;
  var T = S5[0] + tf.st.stT, W = S5[1] + tf.st.stW, Z = S5[2] + tf.st.stZ, P = S5[3], M = S5[4], F = BN_DATA.f;
  var crit = BN_DATA.critBase + Math.max(0, (troop === '謀' ? Z : W) - BN_DATA.critFrom) * BN_DATA.critPerPt;
  var atkM = 1 + tf.st.atk + tf.st.atkTroop, hpM = 1 + tf.st.hp, spec, fg = card.fig ? BN_FIG_SKILLS[card.fig] : null, skills = [], i, sl, learned;
  spec = {
    name: card.name, fig: card.fig || '', fac: card.fac, gr: card.gr, troop: troop, row: o.row !== undefined ? o.row : bnRowOf(card, troop), col: o.col !== undefined ? o.col : 0,
    apt: apt.apt, sex: card.sex || '', traits: (card.tr || []).slice(), jobs: Object.keys(card.ja || {}), main: card.main || '', learn: card.learn | 0,
    stats: {
      hp: bnRound(bnFormula(F.hp, T, W, Z, P) * c.hp * g * a * hpM * tf.st.all),
      atk: bnRound(bnFormula(F.atk, T, W, Z, P) * c.atk * g * a * atkM * tf.st.all),
      mag: bnRound(bnFormula(F.mag, T, W, Z, P) * g * tf.st.all),
      def: bnRound(bnFormula(F.def, T, W, Z, P) * c.def * a * tf.st.all),
      sres: bnRound(bnFormula(F.sres, T, W, Z, P)),
      spd: bnRound(bnFormula(F.spd, T, W, Z, P) + c.spd + tf.st.spd),
      heal: bnRound(bnFormula(F.heal, T, W, Z, P) * g),
      sh: bnRound(bnFormula(F.sh, T, W, Z, P) * g),
      crit: crit,
      res: bnClamp((P - BN_DATA.resFrom) * BN_DATA.resPer, 0, BN_DATA.resMax)
    },
    mods: tf.mods
  };
  var kitIds = [], km, kit2 = !!fg, lgSrc = null, lgId;   // kit2:名人或有選擇槽裝備者(發動率護欄只套在 kit2;無裝備路人 / generic 維持舊公式);lgSrc:選擇槽內容(找兵種卡用)
  if (fg) {
    if (fg.passive) skills.push(fg.passive);
    var kfb = (typeof BN_KIT_BY !== 'undefined' && BN_KIT_BY.figs && BN_KIT_BY.figs[card.fig]) || null;   // 專屬聯動(bondFix):不占被動 / 選擇槽,隨名人自帶;vs 條件不成立時該技能自行略過
    if (kfb && kfb.bondFix) for (i = 0; i < kfb.bondFix.length; i++) skills.push(kfb.bondFix[i]);
    spec.el = fg.el || '';
    // 戰法欄位新制(B2):名人 = 固定戰法(kit 的 fixed 欄,大招;無大招者 = 第一個主動)+ 被動 + 聯動 + 選擇槽(只認裝備;空槽不自動配、不再帶舊 skills 欄)
    sl = bnKitN(card);
    learned = bnKitSlotIds(card, o, sl);
    lgSrc = learned;
    for (i = 0; i < learned.length; i++) if (BN_SKILLS[learned[i]] && skills.indexOf(learned[i]) < 0) { skills.push(learned[i]); kitIds.push(learned[i]); }
    spec.ult = (kfb && kfb.fixed) ? kfb.fixed : fg.ult;
  } else {
    skills = bnNativeSkills(card, troop);
    learned = o.learned || card.bnLearn;
    sl = bnSlotCount(card);
    if (!learned && typeof bnSkcLearnOf === 'function') { var bl = bnSkcLearnOf(card); if (bl) { lgSrc = bl; sl = bnSkcSlots(card); learned = bnLearnMerge(card, troop, skills, sl - (bnLgPick(bl, troop) ? 1 : 0), bl.filter(function (x) { return x && !bnLgIs(x); })); kit2 = true; } }   // 戰法傳承裝備的戰法(bn_skcard.js;名冊路人才有;選擇槽白 1、青以上 2);兵種卡占一槽、不進學習欄
    if (!lgSrc) lgSrc = learned || null;
    if (!learned) learned = BN_DATA.slots.autoLearn ? bnAutoLearn(card, troop, skills, sl) : [];
    for (i = 0; i < learned.length && i < sl; i++) if (BN_SKILLS[learned[i]] && skills.indexOf(learned[i]) < 0) { skills.push(learned[i]); kitIds.push(learned[i]); }
    spec.ult = bnUltFor(card, troop);
  }
  km = bnKitMap(card, kitIds);
  if (km) spec.kitInst = km;
  if (kit2) spec.kit2 = 1;
  spec.skills = skills;
  lgId = lgSrc ? bnLgPick(lgSrc, troop) : null;
  if (lgId) spec.legion = lgId;   // B3:只在裝了有效兵種卡時才寫入,無兵種卡的 spec 不變
  // 名人強度校正(B6,bn_data.js BN_FIG_TUNE):兵力 / 攻擊 / 謀略 / 治療 / 護盾量同乘一個係數,讓新舊名人勝率落在相近範圍
  var tn = (card.fig && typeof BN_FIG_TUNE !== 'undefined') ? BN_FIG_TUNE[card.fig] : 0;
  if (tn && tn !== 1) {
    ['hp', 'atk', 'mag', 'heal', 'sh'].forEach(function (k) { spec.stats[k] = bnRound(spec.stats[k] * tn); });
    spec.mods.rateBonus = (spec.mods.rateBonus || 0) + (tn - 1) * (BN_DATA.figTuneRate || 0);   // 同一係數也小幅影響戰法發動率(治療 / 控制型不吃數值縮放)
  }
  // 研兵(bn_book.js;只對名冊卡):該兵種兵力 / 攻擊 / 謀略 / 治療 +n%;o.drill = 指定比例(隊伍碼 / 戰報碼重建用,優先於本機兵書)
  var dr = typeof o.drill === 'number' ? o.drill : ((typeof bnBookDrillOf === 'function') ? bnBookDrillOf(card, troop) : 0);
  if (dr > 0) { ['hp', 'atk', 'mag', 'heal'].forEach(function (k) { spec.stats[k] = bnRound(spec.stats[k] * (1 + dr)); }); spec.drill = dr; }
  // 升星加成(卡片熔爐 cardsStarBonus;缺函式 / 缺欄位 = 0)。注意 entry.star 是鎖定旗標,不是星等,不讀
  var sb = (typeof cardsStarBonus === 'function') ? cardsStarBonus(card) : null;
  if (sb && (sb.atk || sb.def || sb.hp)) {
    spec.stats.atk = bnRound(spec.stats.atk * (1 + (sb.atk || 0))); spec.stats.mag = bnRound(spec.stats.mag * (1 + (sb.atk || 0)));
    spec.stats.def = bnRound(spec.stats.def * (1 + (sb.def || 0))); spec.stats.sres = bnRound(spec.stats.sres * (1 + (sb.def || 0)));
    spec.stats.hp = bnRound(spec.stats.hp * (1 + (sb.hp || 0)));
  }
  if (sb && sb.lv) spec.starLv = sb.lv;
  if (sb && sb.skill) spec.mods.skillPlus = BN_DATA.starSkillPlus;   // 3 星起:戰法強化
  if (sb && sb.mark) spec.starMark = true;                            // 5 星:專屬標記(僅供 UI)
  if (card.tok >= 3) spec.mods.rateBonus = (spec.mods.rateBonus || 0) + 0.05;
  if (card.tok >= 5) spec.mods.ultPlus = 0.10;
  if (o.scene) bnApplyScene(spec, o.scene);
  return spec;
}
function bnApplyScene(spec, scene) {
  (spec.traits || []).forEach(function (id) {
    var tm = BN_TRAIT_MODS[id];
    if (!tm || !tm.scene || !tm.scene[scene]) return;
    var m = tm.scene[scene];
    if (m.atk) spec.stats.atk = bnRound(spec.stats.atk * (1 + m.atk));
    if (m.dmgStrat) spec.mods.stratPct = (spec.mods.stratPct || 0) + m.dmgStrat;
  });
}
// 直接指定屬性(敵人樣板、黃金測試用)
function bnSpecRaw(r) {
  var s = {
    name: r.name, fig: r.fig || '', fac: r.fac === undefined ? 4 : r.fac, gr: r.gr || 0, troop: r.troop, row: r.row, col: r.col || 0, apt: {}, traits: r.traits || [], jobs: [], main: '', learn: 0,
    stats: { hp: r.hp, atk: r.atk, mag: r.mag, def: r.def, sres: r.sres, spd: r.spd, heal: r.heal !== undefined ? r.heal : 60, sh: r.sh !== undefined ? r.sh : 100, crit: r.crit !== undefined ? r.crit : 0.05, res: r.res !== undefined ? r.res : 0.04 },
    mods: r.mods || {}, skills: r.skills || [], ult: r.ult || '', el: r.el || ''
  };
  return s;
}

// 隊伍:陣型(§2.7)、陣營 / 標籤 / 特殊羈絆(§2.6)。回傳 {units, bonds, formation}
function bnBuildTeam(specs, o) {
  var units = JSON.parse(JSON.stringify(specs)), bonds = [], fm = [], i, u, cnt = [0, 0, 0], n, facCnt = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], tagCnt = {}, atkB = 0, hpB = 0, tf;
  for (i = 0; i < units.length; i++) { cnt[units[i].row]++; if ((units[i].fac >= 0 && units[i].fac <= 3) || (units[i].fac >= 5 && units[i].fac <= 13)) facCnt[units[i].fac]++; }   // 魏蜀吳黃巾 + 魔幻 9 陣營(5~13);中立不計
  function eachU(fn) { for (var k = 0; k < units.length; k++) fn(units[k]); }
  function mulStat(u, key, m) { u.stats[key] = bnRound(u.stats[key] * m); }
  bnLgApply(units);   // B3 兵種卡:寫入 mods.lg(無兵種卡者不動)
  // 陣營羈絆
  var bestN = 0; facCnt.forEach(function (c) { if (c > bestN) bestN = c; });
  if (bestN >= 3) { var fb = BN_BONDS.fac[Math.min(5, bestN)]; atkB += fb.atk || 0; hpB += fb.hp || 0; bonds.push('陣營 ×' + bestN); }
  // 職業標籤(主職業)
  eachU(function (u) {
    var j = u.main && typeof CARD_JOB_BY_ID !== 'undefined' ? CARD_JOB_BY_ID[u.main] : null;
    if (j) tagCnt[j.tag] = (tagCnt[j.tag] || 0) + 1;
  });
  Object.keys(tagCnt).forEach(function (tg) {
    if (tagCnt[tg] < 2 || !BN_BONDS.tag[tg]) return;
    var e = BN_BONDS.tag[tg];
    bonds.push(tg);
    eachU(function (u) {
      if (e.defFront && u.row === 0) mulStat(u, 'def', 1 + e.defFront);
      if (e.strat) u.mods.stratPct = (u.mods.stratPct || 0) + e.strat;
      if (e.heal) mulStat(u, 'heal', 1 + e.heal);
      if (e.shield) u.mods.shieldOut = (u.mods.shieldOut || 0) + e.shield;
      if (e.hp) hpB += e.hp;
      if (e.res) u.stats.res = Math.min(BN_DATA.resMax + 0.08, u.stats.res + e.res);
      if (e.rate) u.mods.rateBonus = (u.mods.rateBonus || 0) + e.rate;
      if (e.spd) u.stats.spd += e.spd;
    });
  });
  // 特殊組合
  var sp = 0;
  BN_BONDS.special.forEach(function (b) {
    if (sp >= BN_BONDS.maxSpecial) return;
    var present = units.filter(function (u) { return u.fig && b.members.indexOf(u.fig) >= 0; });
    if (present.length < b.need) return;
    sp++; bonds.push(b.name);
    present.forEach(function (u) {
      if (b.rate) u.mods.rateBonus = (u.mods.rateBonus || 0) + b.rate;
      if (b.strat) u.mods.stratPct = (u.mods.stratPct || 0) + b.strat;
      if (b.cdMinus) u.mods.cdMinus = Math.max(u.mods.cdMinus || 0, b.cdMinus);
    });
    if (b.cavSpd) eachU(function (u) { if (u.troop === '騎') u.stats.spd += Math.max(0, b.cavSpd - (u.mods.lgCardSpd || 0)); });   // 兵種卡騎速與羈絆取高不疊加(noStack;無兵種卡 = 原值)
  });
  atkB = Math.min(atkB, BN_BONDS_CAP().atk); hpB = Math.min(hpB, BN_BONDS_CAP().hp);
  // 陣型
  var fmAll = 1; eachU(function (u) { if (u.mods.fmtAll) fmAll = Math.max(fmAll, u.mods.fmtAll); });
  function fmScale(name) { var s = fmAll; units.forEach(function (u) { if ((u.mods.fmtTrait || []).indexOf(name) >= 0) s = Math.max(s, 1.3); }); return s; }
  if (cnt[0] >= 3) { fm.push('鋒矢'); var e1 = BN_DATA.formation.fengshi * fmScale('fengshi'); eachU(function (u) { if (u.row === 0 && !u.mods.noFmt) { mulStat(u, 'atk', 1 + e1); mulStat(u, 'mag', 1 + e1); } }); }
  if (cnt[0] >= 2 && cnt[1] >= 1) { fm.push('圓陣'); var e2 = BN_DATA.formation.yuanzhen * fmScale('yuanzhen'); eachU(function (u) { if (!u.mods.noFmt) mulStat(u, 'def', 1 + e2); }); }
  if (cnt[2] >= 2) { fm.push('雁行'); var e3 = BN_DATA.formation.yanxing * fmScale('yanxing'); eachU(function (u) { if (u.row === 2 && !u.mods.noFmt) { mulStat(u, 'atk', 1 + e3); mulStat(u, 'mag', 1 + e3); } }); }
  eachU(function (u) {
    if (atkB) { mulStat(u, 'atk', 1 + atkB); mulStat(u, 'mag', 1 + atkB); }
    if (hpB) mulStat(u, 'hp', 1 + hpB);
  });
  // 詞條光環:寬厚(同排友軍戰法發動率 +)、鼓舞(同排友軍攻擊 +)
  eachU(function (a) {
    if (a.mods.rowRate) eachU(function (b) { if (b.row === a.row) b.mods.rateBonus = (b.mods.rateBonus || 0) + a.mods.rowRate; });
    if (a.mods.rowAtk) eachU(function (b) { if (b.row === a.row) { mulStat(b, 'atk', 1 + a.mods.rowAtk); mulStat(b, 'mag', 1 + a.mods.rowAtk); } });
  });
  // 名人專屬詞條光環(B4):全隊攻擊、我方某陣營受傷、我方某兵種速度
  eachU(function (a) {
    var tt = a.mods.teamTakenFac, ts = a.mods.teamTroopSpd;
    if (a.mods.teamAtk) eachU(function (b) { mulStat(b, 'atk', 1 + a.mods.teamAtk); mulStat(b, 'mag', 1 + a.mods.teamAtk); });
    if (tt) eachU(function (b) { if (b.fac === tt.fac) b.mods.takenPct = (b.mods.takenPct || 0) + tt.v; });
    if (ts) eachU(function (b) { if (ts[b.troop]) b.stats.spd += ts[b.troop]; });
  });
  return { units: units, bonds: bonds, formation: fm };
}
function BN_BONDS_CAP() { return BN_BONDS.cap || BN_DATA.bondCap; }

// ───────── 模擬器 / 測試用:隨機名冊卡與隊伍 ─────────
function bnRandomCard(rng, gr, figId) {
  var cs, key, card, f;
  if (figId) { f = CARD_FIG_BY_ID[figId]; card = cardFromFig(f, 'G', 0); card.tok = 0; return card; }
  cs = { seed: Math.floor(rng() * 4294967295), fame: { E: 0 } };
  key = 'G:' + Math.floor(rng() * 1000);
  card = cardGen(cs, 'G', key, Math.floor(rng() * 9), gr, 't' + Math.floor(rng() * 1e9), {});
  card.tok = 0; card.up = 0;
  return card;
}
function bnRandomLearned(rng, card, troop) {
  var n = bnSlotCount(card), pool = BN_GENERIC.skills.filter(function (id) {
    var d = BN_SKILLS[id], f = d.fit || {};
    if (d.cat === 'passive') return false;
    return (f.troops && f.troops.indexOf(troop) >= 0) || (f.jobs && card.ja && f.jobs.some(function (j) { return card.ja[j]; }));
  }), out = [], k;
  while (out.length < n && pool.length) { k = Math.floor(rng() * pool.length); out.push(pool[k]); pool.splice(k, 1); }
  return out;
}
// 隨機隊:size 人,grs 為各人品階陣列(或單一值);figs 為名人 id 清單(可空)
function bnRandomTeam(rng, size, grSpec, figs, opt) {
  var specs = [], i, card, spec, gr, used = {}, rows = [0, 0, 0], troop, learned, f;
  opt = opt || {};
  for (i = 0; i < size; i++) {
    if (figs && figs[i]) card = bnRandomCard(rng, 4, figs[i]);
    else {
      gr = Array.isArray(grSpec) ? grSpec[i % grSpec.length] : (typeof grSpec === 'function' ? grSpec(i) : grSpec);
      card = bnRandomCard(rng, gr);
    }
    troop = opt.troops && opt.troops[i] ? opt.troops[i] : bnDefaultTroop(card);
    learned = card.fig ? null : bnRandomLearned(rng, card, troop);
    spec = bnUnitSpec(card, { troop: troop, learned: learned, slots: card.fig ? bnSimFigSlots(card) : undefined });   // 模擬名人:自身專屬池確定性裝滿選擇槽(B2)
    specs.push(spec);
  }
  bnAutoLayout(specs, rng);
  return specs;
}
// 一鍵布陣:依兵種放入 3×3 格(前排 ≤3),最多 5 人
function bnAutoLayout(specs, rng) {
  var taken = {}, i, spec, rows;
  function put(sp, row) {
    var order = [1, 0, 2], j, col;
    for (j = 0; j < 3; j++) { col = order[j]; if (!taken[row + ':' + col]) { taken[row + ':' + col] = 1; sp.row = row; sp.col = col; return true; } }
    return false;
  }
  specs.forEach(function (sp) {
    var want = sp.row, tries = [want, want === 0 ? 1 : (want === 1 ? 0 : 1), want === 2 ? 1 : 2, 0, 1, 2], k;
    for (k = 0; k < tries.length; k++) if (put(sp, tries[k])) return;
  });
  // 至少 1 人在前排
  if (!specs.some(function (s) { return s.row === 0; })) {
    var best = specs[0];
    specs.forEach(function (s) { if (BN_DATA.troops[s.troop].hp * s.stats.hp > BN_DATA.troops[best.troop].hp * best.stats.hp) best = s; });
    var oldKey = best.row + ':' + best.col; delete taken[oldKey];
    put(best, 0);
  }
}

if (typeof module !== 'undefined' && module.exports) module.exports = { bnEff: bnEff };
// 專屬聯動條件化(2026-11-10):下列名人的 bondFix 戰法只在指定武將在場時才存在(ally = 我方在場;其餘 = 敵方在場),不在場整個移除,不再無條件生效
var BN_BOND_GATED = { mifuren: 1, huaxiong: 1, zuoci: 1, elf_baizhou: 1, diaochan: 1 };
function bnBondGate(S) {
  S.units.forEach(function (u) {
    var kfb = (typeof BN_KIT_BY !== 'undefined' && BN_KIT_BY.figs && BN_KIT_BY.figs[u.fig]) || null;   // 專屬聯動條件化只讀 bondFix 清單
    if (!BN_BOND_GATED[u.fig] || !kfb || !kfb.bondFix) return;
    var bf = kfb.bondFix;
    function gateOk(list) {
      return list.filter(function (inst) {
        if (bf.indexOf(inst.def.id) < 0 || !inst.def.vs) return true;
        var ally = inst.def.vs.mode === 'ally';
        return S.units.some(function (x) { return x !== u && (ally ? x.side === u.side : x.side !== u.side) && bnVsMatch(S, inst.def.vs, x); });
      });
    }
    u.act = gateOk(u.act);
    u.pas = gateOk(u.pas);
  });
}

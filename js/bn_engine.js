// js/bn_engine.js — 戰鬥 A 模式核心引擎(純邏輯,PLAN_BATTLE_A §3):確定性種子、交叉出手回合、行動流程、傷害公式、狀態、士氣、勝負、事件日誌。
// 戰法 kind 結算 / 觸發 / 羈絆 / 反應 / 行動佇列在 js/bn_effects.js。不寫 DOM、不讀時間、不用 Math.random。ES2017;不用 ?. ??。
// 載入順序:bn_data.js → bn_skills_data.js → bn_units.js → bn_engine.js → bn_effects.js。全域一律 bn 前綴。
//
// 對外介面:
//   bnInit(rec) → state        rec = {v:1, seed, teamA:[spec], teamB:[spec], opts:{autoUlt:true, events:true, scene:''}}(spec 由 bn_units.js 產生)
//   bnStep(state, input) → events[]   推進一個「行動」(或回合結束);input 可含 {ult: unitId} 手動大招
//   bnRunToEnd(state) → state          跑到結束;bnRun(rec) = bnInit + bnRunToEnd
//   state.over / state.result = {winner:'A'|'B'|'draw', reason:'wipe'|'limit', rounds, hp:{A,B}}
//   確定性:全部亂數取自單一 bnRng(seed),依固定順序抽(每段傷害:先暴擊、再浮動);同 rec 必得同 events。
//
// 事件日誌(state.events;opts.events=false 時不產生,統計 state.stats 仍會累計)。每個事件共通欄位:t 類型、r 回合、a 行動序號、c 連鎖步數(0 = 主行動)、d 深度。單位一律用 id(state.units[id])。
//   init   {units:[{id,side,name,fig,troop,row,col,hp,mx,morale}]}          開場快照(side 'A' 我方 / 'B' 敵方;row 0 前 1 中 2 後;col 0~2)
//   round  {n, fat, first}                                                 回合開始(fat = 疲兵層數,first = 先手方)
//   act    {u, x}                                                          單位行動開始(x=1 追加行動)
//   skip   {u, why}                                                        why: stun fear trap
//   idle   {u}                                                             射程不足,待命
//   skill  {u, id, name, kind, cat, rc, as}                                戰法發動(rc = 第 n 次再放;as = 補刀者)
//   prep   {u, id}                                                         進入準備
//   dmg    {src, tgt, v, abs, ty, crit, hp, via, dot, ctr, basic, rx}      傷害(v = 實際扣血、abs = 護盾吸收、ty phys|strat|dot、via = 援護者 id、ctr = 反擊、rx = 反應 id)
//   evade  {src, tgt}   heal {src, tgt, v, nom, hp, blk}   shield {src, tgt, v, tot}   revive {tgt, hp}
//   status {src, tgt, id, left, val}   unstatus {tgt, id, why}   resist {tgt, id, layers}(被抵禦擋下)   immune {tgt, id}(被免疫擋下)   ccimm {tgt, id}
//   morale {u, v, now, why}    kill {src, tgt}    move {u, row, col}    cd {u, id, cd}
//   react  {id, name, tgt}     bond {id, name}    trigger {u, id, trig}   chain {n, k}(連鎖步 n;k 類型)   chaincap {n}(觸發全局 8 步保險)   ult {u, id}
//   end    {winner, reason, rounds, hp:{A,B}}

// ───────── 亂數 / 雜湊(與 map.js makeRng / cards.js cardRng 同一演算法 mulberry32,同介面) ─────────
function bnHash() {
  var s = Array.prototype.join.call(arguments, '|'), h = 2166136261, i;
  for (i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  h ^= h >>> 15; h = Math.imul(h, 2246822507); h ^= h >>> 13;
  return h >>> 0;
}
function bnRng(seed) {
  var a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    var t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function bnClamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
function bnOpp(s) { return s === 'A' ? 'B' : 'A'; }
function bnPow(p) { return p === 'S' ? 0 : p === 'M' ? 1 : p === 'L' ? 2 : 3; }
function bnKT(kind, p) { var t = BN_DATA.kinds[kind]; return t ? t[bnPow(p)] : 0; }

// ───────── 事件 ─────────
function bnEv(S, t, o) {
  if (!S.log) return;
  o.t = t; o.r = S.round; o.a = S.actNo; o.c = S.chain ? S.chain.step : 0; o.d = S.chain ? S.chain.depth : 0;
  S.events.push(o);
}

// ───────── 單位 / 站位查詢 ─────────
var BN_NEG = {
  stun: 'control', fear: 'control', confuse: 'control', timid: 'control', silence: 'control', ult_lock: 'control',
  atk_down: 'debuff', def_down: 'debuff', spd_down: 'debuff', mark: 'debuff',
  burn: 'dot', poison: 'dot', bleed: 'dot', heal_reduce: 'heal_block'
};
var BN_STRONG = { stun: 1, fear: 1, confuse: 1 };
var BN_ALIAS = { bind: 'timid', heal_block: 'heal_reduce', def_down: 'def_down' };

function bnAlive(S, side) { return S.teams[side].units.filter(function (u) { return u.alive; }); }
function bnEnemies(S, u) { return bnAlive(S, bnOpp(u.side)); }
function bnAllies(S, u, incSelf) { return bnAlive(S, u.side).filter(function (x) { return incSelf || x !== u; }); }
function bnRank(S, u) {   // 有效排號(只數仍有存活者的排),1 起
  var seen = [false, false, false], n = 0, r, list = S.teams[u.side].units, i;
  for (i = 0; i < list.length; i++) if (list[i].alive) seen[list[i].row] = true;
  for (r = 0; r < u.row; r++) if (seen[r]) n++;
  return n + 1;
}
function bnRankMax(S, side) {
  var seen = [false, false, false], n = 0, list = S.teams[side].units, i;
  for (i = 0; i < list.length; i++) if (list[i].alive) seen[list[i].row] = true;
  for (i = 0; i < 3; i++) if (seen[i]) n++;
  return n;
}
function bnReach(S, u) {
  var T = BN_DATA.troops[u.troop];
  return T.R + (u.mods.reach || 0) - bnRank(S, u) + 1;
}
function bnHpPct(u) { return u.hp / u.maxHp; }
function bnHas(u, id) { return !!u.st[BN_ALIAS[id] || id]; }

// 數值(含增減益)
function bnAtkMod(S, u) {
  var m = 0, st = u.st, mo = u.mods;
  if (st.atk_up) m += st.atk_up.val;
  if (st.atk_down) m -= st.atk_down.val;
  m += (u.sc.atk || 0) * BN_DATA.kinds.stat_charge[0] + (u.killStack || 0) * BN_DATA.stackKillAtk;
  if (mo.lowHp && u.hp / u.maxHp < mo.lowHp[0]) m += mo.lowHp[1];
  if (mo.early2 && S.round <= 2) m += mo.early2;
  if (u.st.amp_atk) m += u.st.amp_atk.val;
  return bnClamp(m, BN_DATA.clamp.lo, BN_DATA.clamp.hi);
}
function bnAtk(S, u) { return u.base.atk * (1 + bnAtkMod(S, u)); }
function bnMag(S, u) { return u.base.mag * (1 + bnAtkMod(S, u)); }
function bnDef(S, u) {
  var m = 0;
  if (u.st.def_up) m += u.st.def_up.val;
  if (u.st.def_down) m -= u.st.def_down.val;
  if (u.st.taunt && u.st.taunt.def) m += u.st.taunt.def;
  return u.base.def * (1 + bnClamp(m, BN_DATA.clamp.lo, BN_DATA.clamp.hi));
}
function bnSres(S, u) { return u.base.sres; }
function bnSpd(S, u) {
  var v = u.base.spd;
  if (u.st.spd_up) v += u.st.spd_up.val;
  if (u.st.spd_down) v -= u.st.spd_down.val;
  if (S.round === 1 && u.mods.r1Spd) v += u.mods.r1Spd;
  return Math.max(BN_DATA.spdMin, v);
}
function bnCrit(S, u) { return bnClamp(u.base.crit + (u.st.crit_up ? u.st.crit_up.val : 0) + (u.sc.crit || 0) * BN_DATA.kinds.stat_charge[0], 0, 0.95); }
function bnFatigue(S) { return S.round >= BN_DATA.fatigue.start ? S.round - BN_DATA.fatigue.start + 1 : 0; }

// ───────── 目標選擇(§2.4) ─────────
function bnScore(S, a, t) {
  var s = 0, pr = BN_DATA.prey[a.troop];
  if (pr && pr[t.troop] > 1) s += BN_DATA.pickPrey;
  s += (1 - bnHpPct(t)) * BN_DATA.pickLowHp;
  return s;
}
function bnBetter(S, a, x, y) {   // x 優於 y:分高、前排、col 小、id 小
  var sx = bnScore(S, a, x), sy = bnScore(S, a, y), rx, ry;
  if (sx !== sy) return sx > sy;
  rx = bnRank(S, x); ry = bnRank(S, y);
  if (rx !== ry) return rx < ry;
  if (x.col !== y.col) return x.col < y.col;
  return x.id < y.id;
}
function bnBestOf(S, a, list) {
  var best = null, i;
  for (i = 0; i < list.length; i++) if (!best || bnBetter(S, a, list[i], best)) best = list[i];
  return best;
}
// mode: one(受 reach、嘲諷)front back lowest(最低 HP%)atk(最高攻)deep(無視 reach 的單體);vs: 'single'|kind 用於隱匿
function bnPickEnemy(S, a, mode, vsKind) {
  var en = bnEnemies(S, a), list, i, t, tau, rk;
  if (!en.length) return null;
  if (mode === 'one') { rk = bnReach(S, a); list = en.filter(function (x) { return bnRank(S, x) <= rk; }); }
  else if (mode === 'front') list = en.filter(function (x) { return bnRank(S, x) === 1; });
  else if (mode === 'back') { rk = bnRankMax(S, bnOpp(a.side)); list = en.filter(function (x) { return bnRank(S, x) === rk; }); }
  else list = en;
  if (!list.length) return null;
  // 隱匿:被排除,但全員隱匿時不排除
  var vis = list.filter(function (x) {
    var s = x.st.stealth;
    if (!s) return true;
    if (s.vs === 'single' || s.vs === undefined) return false;
    return !(Array.isArray(s.vs) && vsKind && s.vs.indexOf(vsKind) >= 0);
  });
  if (vis.length) list = vis;
  tau = list.filter(function (x) { return x.st.taunt; });
  if (tau.length && !a.st.confuse) list = tau;
  if (mode === 'lowest') {
    t = null;
    for (i = 0; i < list.length; i++) { if (!t || bnHpPct(list[i]) < bnHpPct(t) || (bnHpPct(list[i]) === bnHpPct(t) && bnBetter(S, a, list[i], t))) t = list[i]; }
    return t;
  }
  if (mode === 'atk') {
    t = null;
    for (i = 0; i < list.length; i++) { if (!t || bnAtk(S, list[i]) > bnAtk(S, t) || (bnAtk(S, list[i]) === bnAtk(S, t) && bnBetter(S, a, list[i], t))) t = list[i]; }
    return t;
  }
  return bnBestOf(S, a, list);
}

// ───────── 士氣(§4.1) ─────────
function bnMorale(S, u, amount, why, raw) {
  var v, before, d;
  if (!u.alive || !amount) return 0;
  if (amount > 0) {
    v = amount;
    if (!raw) v = v * u.mgain;
    v *= (1 + (u.bondMorale || 0));
    if (S.chain && S.chain.dv > 0) {   // 連鎖期間每人每回合獲得士氣上限
      var cap = BN_DATA.morale.chainCapPerRound, used = u.chainMorale || 0;
      v = Math.min(v, Math.max(0, cap - used));
      u.chainMorale = used + v;
    }
  } else {
    v = amount;
  }
  before = u.morale;
  u.morale = bnClamp(u.morale + v, 0, BN_DATA.morale.max);
  d = u.morale - before;
  if (d !== 0) bnEv(S, 'morale', { u: u.id, v: Math.round(d * 10) / 10, now: Math.round(u.morale), why: why });
  return d;
}

// ───────── 狀態 ─────────
function bnGuardType(id) { return BN_NEG[id] || null; }
function bnImmuneHit(S, t, id) {
  var cat = BN_NEG[id], i, im, ok;
  for (i = 0; i < t.immunes.length; i++) {
    im = t.immunes[i];
    ok = im.types.indexOf(id) >= 0 || (cat && im.types.indexOf(cat) >= 0) || (id === 'heal_reduce' && im.types.indexOf('heal_block') >= 0) || (id === 'timid' && im.types.indexOf('bind') >= 0);
    if (!ok) continue;
    if (im.charges !== undefined && im.charges <= 0) continue;
    if (im.firstOnly && im.used) continue;
    if (im.rate !== undefined && S.rng() >= im.rate) continue;
    im.used = true;
    if (im.charges !== undefined) im.charges--;
    return true;
  }
  if (t.mods.immuneFirst && t.mods.immuneFirst.indexOf(id) >= 0 && !t.immuneFirstUsed[id]) { t.immuneFirstUsed[id] = true; return true; }
  return false;
}
// 套用狀態。回傳 true/false(是否上身)。data:{left,val,src,...}。負面狀態會經過 免疫 → 抗控 → 抵禦 → 抵抗 RES。
function bnStatusApply(S, src, t, id, data, o) {
  var cat = BN_NEG[id], old, w, guard, fromHb = (id === 'heal_reduce');
  o = o || {};
  if (!t.alive) return false;
  data = data || {};
  data.id = id; data.src = src ? src.id : -1;
  if (cat) {
    S.stats.negTry++;
    if (fromHb) S.stats.hbTry++;
    if (bnImmuneHit(S, t, id)) { bnEv(S, 'immune', { tgt: t.id, id: id }); S.stats.immuneBlock++; return false; }
    if (BN_STRONG[id] && t.st.ccimm) { bnEv(S, 'ccimm', { tgt: t.id, id: id }); S.stats.ccimmBlock++; return false; }
    w = t.st.ward;
    if (w && w.layers > 0 && (w.guard === 'any' || w.guard === cat)) {
      w.layers--;
      if (w.layers <= 0) delete t.st.ward;
      bnEv(S, 'resist', { tgt: t.id, id: id, layers: w.layers || 0 });
      S.stats.resistBlock++; S.stats.wardUsed++;
      if (fromHb) S.stats.hbBlockedByWard++;
      return false;
    }
    if ((cat === 'debuff' || cat === 'dot') && data.val !== undefined && !data.noRes) data.val *= (1 - t.base.res);
  }
  if (data.left !== undefined && !data.act && t.acted && !o.noExtend && data.left < 900) data.left += 1;   // 本回合已行動者:持續回合 +1,確保真的涵蓋其 N 次行動
  old = t.st[id];
  if (old && !data.force) {
    // 同類不疊加:取強者、刷新持續
    var ov = old.val === undefined ? 0 : old.val, nv = data.val === undefined ? 0 : data.val;
    if (nv > ov) { for (var k in data) if (k !== 'left' && k !== 'n') old[k] = data[k]; }
    if (data.n !== undefined && (old.n === undefined || data.n > old.n)) old.n = data.n;
    if (data.left !== undefined && (old.left === undefined || data.left > old.left)) old.left = data.left;
    data = old;
  } else {
    t.st[id] = data;
    if (id === 'heal_reduce') S.stats.hbOn++;
  }
  if (fromHb) { S.stats.hbApplied++; S.stats.hbTurnsSum += data.left || 0; }
  if (id === 'ward') { S.stats.wardGiven += data.layers || 0; }
  bnEv(S, 'status', { src: src ? src.id : -1, tgt: t.id, id: id, left: data.left, val: data.val === undefined ? undefined : Math.round(data.val * 1000) / 1000 });
  return true;
}
function bnStatusRemove(S, t, id, why) {
  if (t.st[id]) { delete t.st[id]; bnEv(S, 'unstatus', { tgt: t.id, id: id, why: why }); return true; }
  return false;
}

// ───────── 護盾 / 治療 ─────────
function bnShield(S, src, t, nominal, o) {
  var cap, cur, amt;
  if (!t.alive) return 0;
  amt = nominal * (1 + (src && src.mods.shieldOut || 0));
  cap = t.maxHp * BN_DATA.shieldCap;
  amt = Math.min(Math.round(amt), Math.round(cap));
  cur = t.st.shield;
  if (cur && cur.val >= amt) { cur.left = Math.max(cur.left, BN_DATA.shieldDur + (t.acted ? 1 : 0)); return 0; }   // 同人多盾取較大值,不相加
  t.st.shield = { id: 'shield', val: amt, left: (o && o.left) || (BN_DATA.shieldDur + (t.acted ? 1 : 0)), src: src ? src.id : -1 };
  bnEv(S, 'shield', { src: src ? src.id : -1, tgt: t.id, v: amt, tot: amt });
  S.stats.shieldGiven[t.side] += amt;
  return amt;
}
function bnHeal(S, src, t, nominal, o) {
  var hr, ratio = 0, amt, cap, n, lim, fat, nom0, xl = o && o.xl;
  if (!t.alive || nominal <= 0) return 0;
  hr = t.st.heal_reduce;
  if (hr) ratio = hr.val / 100;
  S.stats.healEvents[t.side]++;
  if (ratio > 0) S.stats.healBlockedEvents[t.side]++;
  fat = bnFatigue(S) * BN_DATA.fatigue.heal;
  nom0 = nominal * (1 + (t.mods.healTaken || 0)) * (1 - fat);
  amt = nom0 * (1 - ratio);
  if (t.st.poison) amt *= BN_DATA.poisonHeal;
  cap = t.maxHp * (xl ? BN_DATA.healCap.xl : BN_DATA.healCap.single);
  amt = Math.min(amt, cap);
  n = t.healCnt;
  amt *= n === 0 ? 1 : (n === 1 ? BN_DATA.healCap.second : BN_DATA.healCap.third);
  lim = t.maxHp * BN_DATA.healCap.round - t.healRound;
  amt = Math.min(amt, Math.max(0, lim), t.maxHp - t.hp);
  amt = Math.max(0, Math.round(amt));
  t.healCnt++;
  S.stats.healNom[t.side] += nom0;
  S.stats.healAct[t.side] += amt;
  if (ratio > 0) S.stats.hbLoss[t.side] += nom0 * ratio;
  t.hp += amt; t.healRound += amt;
  bnEv(S, 'heal', { src: src ? src.id : -1, tgt: t.id, v: amt, nom: Math.round(nom0), hp: t.hp, blk: ratio > 0 ? 1 : 0 });
  if (src && src.alive && amt > 0) { src.healDone = (src.healDone || 0) + amt; }
  return amt;
}

// ───────── 傷害(§3.4) ─────────
// h: {ty:'phys'|'strat', mul, kind, sk, basic, pierce, ignoreDef, dot, counter, forceCrit, noGuard, rx(已選反應)}
function bnHit(S, a, t, h) {
  var ty = h.ty, base, defv, prey = 1, outM = 1, tk, r1, r2, crit = false, dmg, absorbed = 0, hpLost = 0, shield, viaId, gdmg, sk = h.sk, mo = a.mods, tm = t.mods, derived = S.chain && S.chain.dv > 0, rk, i, cdm;
  if (!t.alive) return null;
  // 援護:先算對原目標的傷害,再依比例分給援護者
  var guard = t.st.guard, guardian = null;
  if (guard && !h.dot && !h.noGuard && !h.counter) { guardian = S.units[guard.by]; if (!guardian || !guardian.alive || guardian === t || guardian.st.stun) guardian = null; }
  // 規避:確定性,不抽亂數
  if (t.st.evade && !h.dot && !(h.rx && h.rx.ignoreEvade)) {
    if (--t.st.evade.charges <= 0) delete t.st.evade;
    bnEv(S, 'evade', { src: a ? a.id : -1, tgt: t.id });
    S.stats.evaded++;
    return { dmg: 0, evaded: true, t: t };
  }
  if (h.dot) {
    dmg = h.fixed;
    if (h.dot === 'burn') dmg *= (tm.burnTaken || 1) * ((tm.weakness && tm.weakness.burn) || 1);
    tk = 1 + bnTakenPct(S, a, t, h);
    dmg = Math.max(1, Math.round(dmg * tk));
  } else {
    r1 = S.rng(); r2 = S.rng();   // 固定順序:先暴擊、再浮動
    if (ty === 'strat') base = bnMag(S, a) * (mo.magMul || 1); else base = bnAtk(S, a);
    defv = h.ignoreDef ? 0 : (ty === 'strat' ? bnSres(S, t) : bnDef(S, t));
    if (ty === 'phys' && BN_DATA.prey[a.troop] && BN_DATA.prey[a.troop][t.troop]) prey = BN_DATA.prey[a.troop][t.troop];
    // 輸出端加成
    if (S.round === 1 && mo.r1Dmg) outM *= 1 + mo.r1Dmg;
    if (mo.firstHit && !a.firstHitDone && (h.basic || h.sk)) { outM *= 1 + mo.firstHit; a.firstHitDone = true; }
    if (t.troop === '盾' && mo.vsShield) outM *= 1 + mo.vsShield;
    if (ty === 'strat' && mo.stratPct) outM *= 1 + mo.stratPct;
    if (h.basic && mo.atkMelee && BN_DATA.troops[a.troop].R <= 2) outM *= 1 + mo.atkMelee;
    if (a.st.amp && h.sk) { for (i = 0; i < a.st.amp.list.length; i++) { cdm = a.st.amp.list[i]; if (cdm.exp && S.round > cdm.exp) continue; if ((cdm.skill && cdm.skill === h.sk.id) || (cdm.tag && h.sk.tags && h.sk.tags.indexOf(cdm.tag) >= 0)) outM *= cdm.mult; } }
    if (S.chain && S.chain.hits > 0 && S.chain.hits < 99 && S.chain.dv > 0) outM *= 1 + Math.min(BN_DATA.chain.comboHitCap, S.chain.hits * BN_DATA.chain.comboHitBonus);
    if (a.troop === '騎' && h.basic && !a.chargeUsed) { outM *= BN_DATA.cavCharge; a.chargeUsed = true; }
    if (h.rx && h.rx.dmgMult) outM *= h.rx.dmgMult;
    tk = 1 + bnTakenPct(S, a, t, h);
    if (h.sk && h.sk.tags && h.sk.tags.indexOf('fire') >= 0 && tm.burnTaken) tk *= tm.burnTaken;
    if (t.mods.weakness && h.sk && h.sk.tags && h.sk.tags.indexOf('fire') >= 0 && t.mods.weakness.burn) tk *= t.mods.weakness.burn;
    dmg = base * h.mul * 100 / (100 + defv) * prey * outM * tk * BN_DATA.K;
    crit = h.forceCrit || r1 < bnCrit(S, a);
    if (crit) dmg *= BN_DATA.critMul * (1 + (tm.critTaken || 0));
    dmg *= 0.95 + BN_DATA.jitter * r2;
    if (ty === 'phys' && t.troop === '盾' && !h.ignoreBlock) dmg -= Math.floor(BN_DATA.blockPct * bnDef(S, t));
    if (h.basic && t.troop === '弓' && bnRank(S, t) > 1 && BN_DATA.troops[a.troop].R <= 2) dmg *= BN_DATA.archerBackTaken;
    dmg = Math.max(1, Math.round(dmg));
  }
  // 連鎖傷害上限(衍生傷害,§4.11):對單一目標 ≤ 60 % 最大 HP;對敵方全體 ≤ 40 % 總最大 HP
  if (derived && !h.counter && !h.dot) {
    var used = S.chain.dd[t.id] || 0, capT = Math.round(t.maxHp * BN_DATA.chain.targetDmgCapPct), capTeam = Math.round(S.teams[t.side].maxHpSum * BN_DATA.chain.teamDmgCapPct);
    dmg = Math.max(0, Math.min(dmg, capT - used, capTeam - S.chain.dteam));
    S.chain.dd[t.id] = used + dmg; S.chain.dteam += dmg;
    if (dmg <= 0) return { dmg: 0, capped: true, t: t };
  }
  // 援護分攤
  if (guardian) {
    gdmg = Math.round(dmg * guard.val * (100 + (ty === 'strat' ? bnSres(S, t) : bnDef(S, t))) / (100 + (ty === 'strat' ? bnSres(S, guardian) : bnDef(S, guardian))));
    dmg = dmg - Math.round(dmg * guard.val);
    if (gdmg > 0) bnApplyDmg(S, a, guardian, gdmg, h, crit, t.id);
    S.stats.guardShared += gdmg;
  }
  var res = dmg > 0 ? bnApplyDmg(S, a, t, dmg, h, crit, -1) : { dmg: 0, t: t };
  return res;
}
function bnTakenPct(S, a, t, h) {
  var x = 0, tm = t.mods, i, o, list;
  if (t.st.mark) x += t.st.mark.val;
  if (tm.takenPct) x += tm.takenPct;
  if (tm.frontTaken && bnRank(S, t) === 1) x += tm.frontTaken;
  if (a && tm.takenFromTroop && tm.takenFromTroop[a.troop]) x += tm.takenFromTroop[a.troop] - 1;
  if (a && tm.takenRanged && BN_DATA.troops[a.troop].R >= 3 && !h.dot) x += tm.takenRanged;
  if (tm.lateTaken && S.round > 2) x += tm.lateTaken;
  if (tm.rowTaken) x += tm.rowTaken;
  if (t.st.taunt_cut) x -= t.st.taunt_cut.val;
  // 宿衛:同排有前排宿衛者
  list = S.teams[t.side].units;
  for (i = 0; i < list.length; i++) { o = list[i]; if (o.alive && o !== t && o.mods.rowTakenFront && o.row === t.row && bnRank(S, o) === 1) x += o.mods.rowTakenFront; }
  x += bnFatigue(S) * BN_DATA.fatigue.dmg;
  return Math.max(-0.7, x);
}
// 真正扣血(含護盾、不倒、擊殺)
function bnApplyDmg(S, a, t, dmg, h, crit, viaOf) {
  var absorbed = 0, shield = t.st.shield, hpLost, cons, sum = t.team ? t.team.summon : null, i, ign;
  if (shield && h.dot !== 'burn' && dmg > 0) {
    cons = h.pierce ? BN_DATA.pierceShield : 1;
    ign = (h.rx && h.rx.shieldIgnore) ? (1 - h.rx.shieldIgnore) : 1;
    absorbed = Math.min(dmg * ign, shield.val / cons);
    shield.val -= absorbed * cons;
    absorbed = Math.round(absorbed);
    dmg -= absorbed;
    if (shield.val <= 0.5) delete t.st.shield;
  }
  if (sum && sum.pool > 0 && dmg > 0 && !h.dot) {   // 召喚肉盾:吸收一半傷害
    var ab2 = Math.min(sum.pool, Math.round(dmg * 0.5));
    sum.pool -= ab2; dmg -= ab2; absorbed += ab2;
  }
  hpLost = Math.min(dmg, t.hp);
  // 不倒 / 福將:致命傷保留 minHp
  if (t.hp - dmg < 1) {
    var ud = t.st.undying;
    if (ud && !ud.used) {
      if (ud.once) ud.used = true;
      hpLost = Math.max(0, t.hp - (ud.minHp || 1));
      if (ud.once) { delete t.st.undying; if (ud.healAfter) t.pendingHeal = ud.healAfter; }
    } else if (t.mods.undyingOnce && !t.undyingUsed) {
      t.undyingUsed = true; hpLost = Math.max(0, t.hp - 1);
    }
  }
  t.hp -= hpLost;
  if (a) {
    S.stats.dmg[a.side] += hpLost; S.stats.dmgTaken[t.side] += hpLost;
    a.dmgDone = (a.dmgDone || 0) + hpLost;
  } else { S.stats.dmgTaken[t.side] += hpLost; }
  t.dmgRound += hpLost;
  t.dmgTakenTotal = (t.dmgTakenTotal || 0) + hpLost;
  bnEv(S, 'dmg', { src: a ? a.id : -1, tgt: t.id, v: hpLost, abs: absorbed, ty: h.dot ? 'dot' : h.ty, crit: crit ? 1 : 0, hp: t.hp, via: viaOf >= 0 ? viaOf : undefined, dot: h.dot || undefined, ctr: h.counter ? 1 : undefined, basic: h.basic ? 1 : undefined, rx: h.rx ? h.rx.id : undefined });
  if (S.chain) S.chain.hits++;
  var killed = false;
  if (t.hp <= 0) {
    t.hp = 0;
    if (t.reviveOnce && !t.reviveOnceUsed) { t.reviveOnceUsed = true; t.hp = Math.max(1, Math.round(t.maxHp * t.reviveOnce)); bnEv(S, 'revive', { tgt: t.id, hp: t.hp }); S.stats.revives++; }
    else { killed = true; bnKill(S, a, t, h); }
  }
  // 受擊士氣、反擊、被動
  if (t.alive && hpLost >= 0 && !h.dot) {
    bnMorale(S, t, BN_DATA.morale.hit, 'hit');
    bnOnHit(S, a, t, h, hpLost);
  }
  if (a && a.alive && a.st.lifesteal && hpLost > 0 && !h.dot) {
    bnHeal(S, a, a, hpLost * a.st.lifesteal.val * (h.rx && h.rx.lifestealMult ? h.rx.lifestealMult : 1), {});
  }
  return { dmg: hpLost, absorbed: absorbed, crit: crit, killed: killed, t: t };
}
// 擊倒處理
function bnKill(S, a, t, h) {
  var ally, i, list;
  t.alive = false; t.hp = 0;
  t.team.deadOrder.push(t.id);
  S.stats.kills[t.side === 'A' ? 'B' : 'A']++;
  S.stats.roundKills++;
  if (t.dmgRound >= t.maxHp * 0.999 && t.hpAtRoundStart >= t.maxHp * 0.999) S.stats.oneRoundKills++;
  bnEv(S, 'kill', { src: a ? a.id : -1, tgt: t.id });
  if (a && a.alive) {
    bnMorale(S, a, BN_DATA.morale.kill, 'kill');
    if (S.chain) S.chain.kills.push(t);
  }
  // 友軍倒下士氣 −10
  list = S.teams[t.side].units;
  for (i = 0; i < list.length; i++) {
    ally = list[i];
    if (!ally.alive || ally === t) continue;
    if (ally.mods.immuneAllyDown) continue;
    bnMorale(S, ally, BN_DATA.morale.allyDown * (ally.mods.allyDownMorale || 1), 'allydown', true);
  }
  // 延燒(dot_spread)
  if (t.st.burn && t.st.burn.spread && a) bnSpreadBurn(S, a, t);
  if (typeof bnOnKill === 'function') bnOnKill(S, a, t, h);
  bnCheckEnd(S);
}

// ───────── 勝負 ─────────
function bnCheckEnd(S) {
  if (S.over) return true;
  var ca = bnAlive(S, 'A').length, cb = bnAlive(S, 'B').length;
  if (ca === 0 || cb === 0) { bnFinish(S, 'wipe'); return true; }
  return false;
}
function bnTeamHpPct(S, side) {
  var list = S.teams[side].units, s = 0, i;
  for (i = 0; i < list.length; i++) if (list[i].alive) s += list[i].hp / list[i].maxHp;
  return s / list.length;
}
function bnFinish(S, reason) {
  var ca = bnAlive(S, 'A').length, cb = bnAlive(S, 'B').length, w, ha = bnTeamHpPct(S, 'A'), hb = bnTeamHpPct(S, 'B');
  if (S.over) return;
  if (reason === 'wipe') w = ca > 0 ? 'A' : (cb > 0 ? 'B' : 'draw');
  else w = (ha - hb >= BN_DATA.drawLead) ? 'A' : ((hb - ha >= BN_DATA.drawLead) ? 'B' : 'draw');
  S.over = true;
  S.result = { winner: w, reason: reason, rounds: S.round, hp: { A: Math.round(ha * 1000) / 1000, B: Math.round(hb * 1000) / 1000 }, deadA: S.teams.A.units.length - ca, deadB: S.teams.B.units.length - cb };
  bnEv(S, 'end', Object.assign({}, S.result));
}

// ───────── 建立戰鬥 ─────────
function bnMakeUnit(S, side, spec, idx) {
  var st = spec.stats, u = {
    id: S.units.length, side: side, idx: idx, name: spec.name, fig: spec.fig || '', troop: spec.troop, row: spec.row, col: spec.col, spec: spec, fac: spec.fac,
    maxHp: Math.round(st.hp), hp: Math.round(st.hp), alive: true, morale: Math.round(st.morale0), mgain: st.mgain,
    base: { atk: st.atk, mag: st.mag, def: st.def, sres: st.sres, spd: st.spd, heal: st.heal, sh: st.sh, crit: st.crit, res: st.res },
    mods: JSON.parse(JSON.stringify(spec.mods || {})), st: {}, sc: {}, acted: false, immunes: [], immuneFirstUsed: {},
    healCnt: 0, healRound: 0, dmgRound: 0, hpAtRoundStart: 0, act: [], pas: [], ult: null, bondMorale: spec.bondMorale || 0, killStack: 0,
    chainMorale: 0, counterHit: {}, targetedRound: false
  };
  var ids = (spec.skills || []).slice(), i, d, inst;
  if (spec.ult) ids.push(spec.ult);
  for (i = 0; i < ids.length; i++) {
    d = BN_SKILLS[ids[i]];
    if (!d) { S.warn.push('未知戰法 ' + ids[i]); continue; }
    inst = { def: d, cd: 0, prepLeft: 0, fires: 0, recastRound: -1, recastN: 0, owner: u };
    if (BN_DATA.cd0AllL && d.kind === 'atk_all' && d.cat === 'active' && bnPow(d.power) >= 2) inst.cd = 1;
    if (d.cat === 'ult') u.ult = inst;
    else if (d.cat === 'passive' || d.cat === 'command') u.pas.push(inst);
    else u.act.push(inst);
  }
  if (u.mods.cdMinus) u.act.forEach(function (x) { x.cdMinus = u.mods.cdMinus; });
  return u;
}

function bnInit(rec) {
  var opts = rec.opts || {}, S, side, list, i, u, all;
  S = {
    rec: rec, seed: rec.seed >>> 0, rng: bnRng(rec.seed >>> 0), round: 0, actNo: 0, events: [], units: [], teams: {}, over: false, result: null, warn: [],
    opts: { autoUlt: opts.autoUlt !== false, scene: opts.scene || '' }, log: opts.events !== false, chain: null, manualUlt: {}, turnSide: 'A', needStart: true,
    cnt: null, bcnt: { bond: {}, rx: {} }, extraQ: [], bonds: [], assistList: [],
    stats: bnNewStats()
  };
  S.teams.A = { side: 'A', units: [], deadOrder: [], revived: false, summon: null, trap: null, maxHpSum: 0, bonds: [] };
  S.teams.B = { side: 'B', units: [], deadOrder: [], revived: false, summon: null, trap: null, maxHpSum: 0, bonds: [] };
  ['A', 'B'].forEach(function (sd) {
    list = sd === 'A' ? rec.teamA : rec.teamB;
    for (i = 0; i < list.length; i++) {
      u = bnMakeUnit(S, sd, list[i], i);
      u.team = S.teams[sd];
      S.units.push(u); S.teams[sd].units.push(u);
      S.teams[sd].maxHpSum += u.maxHp;
    }
  });
  S.cnt = bnNewCnt();
  // 賭徒:每場確定性決定
  S.units.forEach(function (x) {
    if (x.mods.gamble) {
      var g = bnHash(S.seed, 'dutu', x.id) % 2 === 0 ? 1.25 : 0.85;
      x.base.atk *= g; x.base.mag *= g;
    }
  });
  bnEv(S, 'init', { units: S.units.map(function (x) { return { id: x.id, side: x.side, name: x.name, fig: x.fig, troop: x.troop, row: x.row, col: x.col, hp: x.hp, mx: x.maxHp, morale: x.morale }; }) });
  bnSetupBattle(S);
  bnCheckEnd(S);
  return S;
}
function bnNewStats() {
  return {
    dmg: { A: 0, B: 0 }, dmgTaken: { A: 0, B: 0 }, healNom: { A: 0, B: 0 }, healAct: { A: 0, B: 0 }, healEvents: { A: 0, B: 0 }, healBlockedEvents: { A: 0, B: 0 }, hbLoss: { A: 0, B: 0 },
    shieldGiven: { A: 0, B: 0 }, kills: { A: 0, B: 0 }, roundKills: 0, killsPerRound: [], oneRoundKills: 0, evaded: 0, revives: 0, guardShared: 0,
    negTry: 0, resistBlock: 0, immuneBlock: 0, ccimmBlock: 0, wardUsed: 0, wardGiven: 0, hbTry: 0, hbApplied: 0, hbOn: 0, hbTurnsSum: 0, hbBlockedByWard: 0,
    hbCasts: 0, skillUse: {}, chainLens: [], chainCap: 0, chainDmgPct: [], actions: 0, ults: 0, recasts: 0, assists: 0, reactions: 0, bondFires: 0, healCasts: { A: 0, B: 0 }, hasHealer: { A: false, B: false }
  };
}
function bnNewCnt() { return { assist: {}, bond: {}, rx: {}, extraUnit: {}, extraTeam: { A: 0, B: 0 }, ctr: {}, rxTeam: { A: 0, B: 0 } }; }

// ───────── 回合 ─────────
function bnNext(S, side) {
  var list = S.teams[side].units, best = null, i, u, sb, su, rb, ru;
  for (i = 0; i < list.length; i++) {
    u = list[i];
    if (!u.alive || u.acted) continue;
    if (!best) { best = u; continue; }
    if (!!u.reorder !== !!best.reorder) { if (u.reorder) best = u; continue; }
    su = bnSpd(S, u); sb = bnSpd(S, best);
    if (su !== sb) { if (su > sb) best = u; continue; }
    ru = bnRank(S, u); rb = bnRank(S, best);
    if (ru !== rb) { if (ru < rb) best = u; continue; }
    if (u.col < best.col) best = u;
  }
  return best;
}
function bnStartRound(S) {
  var i, u, nextA, nextB, first;
  S.round++;
  S.cnt = bnNewCnt();
  S.stats.roundKills = 0;
  S.units.forEach(function (x) {
    x.acted = false; x.healCnt = 0; x.healRound = 0; x.dmgRound = 0; x.hpAtRoundStart = x.hp; x.chainMorale = 0; x.counterHit = {}; x.targetedRound = false;
    if (x.reorderNext) { x.reorder = true; x.reorderNext = false; } else x.reorder = false;
    x.pendingHeal = x.pendingHeal || 0;
  });
  nextA = bnNext(S, 'A'); nextB = bnNext(S, 'B');
  first = (nextB && nextA && bnSpd(S, nextB) > bnSpd(S, nextA)) || (!nextA && nextB) ? 'B' : 'A';
  S.turnSide = first;
  bnEv(S, 'round', { n: S.round, fat: bnFatigue(S), first: first });
  S.units.forEach(function (x) { if (x.alive && x.mods.roundStartRowMorale) S.teams[x.side].units.forEach(function (y) { if (y.alive && y.row === x.row) bnMorale(S, y, x.mods.roundStartRowMorale, 'aura', true); }); });
  bnFire(S, 'turn_start', {});
  bnBondEvent(S, 'round_start', {});
  S.needStart = false;
}
function bnEndRound(S) {
  var i, u, k, st, ids;
  S.stats.killsPerRound.push(S.stats.roundKills);
  S.units.forEach(function (x) {
    if (!x.alive) return;
    // 持續狀態(heal_hot / 摘除到期)
    if (x.st.heal_hot) {
      var hot = x.st.heal_hot;
      bnHeal(S, S.units[hot.src] || null, x, hot.val, {});
    }
    ids = Object.keys(x.st);
    for (i = 0; i < ids.length; i++) {
      k = ids[i]; st = x.st[k];
      if (st.act || st.left === undefined || st.left >= 900) continue;
      st.left -= 1;
      if (st.left <= 0) { delete x.st[k]; bnEv(S, 'unstatus', { tgt: x.id, id: k, why: 'expire' }); }
    }
    for (i = 0; i < x.act.length; i++) if (x.act[i].cd > 0) x.act[i].cd--;
    for (i = 0; i < x.pas.length; i++) if (x.pas[i].cd > 0) x.pas[i].cd--;
    if (x.pendingHeal) { bnHeal(S, null, x, x.base.heal * bnKT('heal_single', x.pendingHeal) * 0.5, {}); x.pendingHeal = 0; }
  });
  bnFire(S, 'turn_end', {});
  ['A', 'B'].forEach(function (sd) { var t = S.teams[sd]; if (t.summon && t.summon.left > 0) { bnSummonTick(S, t); } });
  if (!S.over && S.round >= BN_DATA.maxRound) bnFinish(S, 'limit');
  else S.needStart = true;
}

function bnStep(S, input) {
  var start = S.events.length, u, opp;
  if (S.over) return [];
  if (input && input.ult !== undefined) S.manualUlt[input.ult] = true;
  if (S.needStart) {
    bnStartRound(S);
    if (S.over) return S.events.slice(start);
  }
  u = bnNext(S, S.turnSide) || bnNext(S, bnOpp(S.turnSide));
  if (!u) { bnEndRound(S); return S.events.slice(start); }
  S.turnSide = bnOpp(u.side);
  bnAct(S, u, {});
  return S.events.slice(start);
}
function bnRunToEnd(S) {
  var guard = 0;
  while (!S.over && guard++ < 1000) bnStep(S);
  if (!S.over) bnFinish(S, 'limit');
  return S;
}
function bnRun(rec) { return bnRunToEnd(bnInit(rec)); }
function bnEventHash(S) { return bnHash(JSON.stringify(S.events)); }

// ───────── 單位行動 act(§3.3) ─────────
function bnAct(S, u, o) {
  var i, inst, tgt, hit, acted = false, tr;
  if (!u.alive) return;
  S.actNo++;
  S.chain = { step: 0, depth: 0, dv: 0, queue: [], dd: {}, dteam: 0, hits: 0, kills: [], actor: u.id, ult: false };
  S.stats.actions++;
  bnEv(S, 'act', { u: u.id, x: o.extra ? 1 : undefined });
  S.cnt.ctr = S.cnt.ctr || {};
  if (!o.extra) {
    // 伏兵
    tr = S.teams[u.side].trap;
    if (tr) {
      S.teams[u.side].trap = null;
      bnEv(S, 'skip', { u: u.id, why: 'trap' });
      bnTrapFire(S, tr, u);
    }
    // 1. DoT
    if (!bnTickDots(S, u)) { bnActEnd(S, u); return; }
    // 2. 強控
    if (u.st.stun) {
      delete u.st.stun; bnEv(S, 'unstatus', { tgt: u.id, id: 'stun', why: 'used' });
      bnStatusApply(S, null, u, 'ccimm', { left: 1 + BN_DATA.ccImmRounds, act: false, force: true }, { noExtend: true });
      for (i = 0; i < u.act.length; i++) u.act[i].prepLeft = 0;
      bnEv(S, 'skip', { u: u.id, why: 'stun' });
      bnActEnd(S, u); return;
    }
    if (u.st.fear) {
      var f = u.st.fear, rr = S.rng();
      delete u.st.fear;
      if (rr < f.skip) {
        bnStatusApply(S, null, u, 'ccimm', { left: 1 + BN_DATA.ccImmRounds, force: true }, { noExtend: true });
        bnEv(S, 'skip', { u: u.id, why: 'fear' });
        bnActEnd(S, u); return;
      }
    }
  } else if (u.st.stun) { bnActEnd(S, u); return; }
  if (S.over) { bnActEnd(S, u); return; }
  // 3. 大招
  if (!o.noUlt && u.ult && u.morale >= BN_DATA.morale.max && !u.st.silence && !u.st.ult_lock && (S.opts.autoUlt || S.manualUlt[u.id])) {
    S.manualUlt[u.id] = false;
    var ok = bnCastUlt(S, u);
    if (ok) { bnActEnd(S, u); return; }
  }
  if (!o.normalOnly) {
    // 4. 準備中的戰法
    for (i = 0; i < u.act.length; i++) {
      inst = u.act[i];
      if (inst.prepLeft > 0) {
        if (u.st.silence) { inst.prepLeft = 0; continue; }
        inst.prepLeft--;
        if (inst.prepLeft === 0) {
          if (bnCast(S, u, inst, { prepFire: true })) { bnMorale(S, u, BN_DATA.morale.act, 'act'); bnActEnd(S, u); return; }
        }
      }
    }
    // 5. 主動戰法
    if (!u.st.silence) {
      for (i = 0; i < u.act.length; i++) {
        inst = u.act[i];
        if (inst.def.cat !== 'active' || inst.cd > 0 || inst.prepLeft > 0) continue;
        if (!bnUseful(S, u, inst)) continue;
        var forced = inst.def.params && inst.def.params.firstRoundForce && S.round === 1;
        var rate = bnRateOf(S, u, inst);
        if (forced || S.rng() < rate) {
          if (inst.def.prep > 0) {
            inst.prepLeft = inst.def.prep;
            bnEv(S, 'prep', { u: u.id, id: inst.def.id });
            S.stats.skillUse[inst.def.id] = (S.stats.skillUse[inst.def.id] || 0) + 1;
            acted = true;
            break;   // 準備中仍做普攻
          }
          if (bnCast(S, u, inst, {})) { bnMorale(S, u, BN_DATA.morale.act, 'act'); bnActEnd(S, u); return; }
        }
      }
    }
  }
  // 6. 普攻
  tgt = null;
  if (!u.st.timid) {
    var nrm = bnNormal(S, u);
    if (nrm === 'idle') { bnEv(S, 'idle', { u: u.id }); bnMorale(S, u, BN_DATA.morale.idle, 'idle'); }
    else if (nrm) {
      bnMorale(S, u, BN_DATA.morale.act, 'act');
      // 7. 追擊
      if (!S.over && u.alive) bnTryPursuit(S, u, nrm);
    }
  } else if (acted) {
    bnMorale(S, u, BN_DATA.morale.act, 'act');
  }
  bnActEnd(S, u);
}
function bnActEnd(S, u) {
  var q;
  if (!S.over) bnDrain(S);
  if (S.chain) {
    S.stats.chainLens.push(S.chain.step);
    S.chain.queue = [];
  }
  // 追加行動
  while (!S.over && S.extraQ.length) {
    q = S.extraQ.shift();
    if (!q.u.alive) continue;
    S.stats.actions++;
    bnAct(S, q.u, { extra: true, noUlt: true, normalOnly: !!q.normalOnly });
    if (S.chain) { S.chain.queue = []; }
  }
  u.acted = true;
  if (!S.over) bnCheckEnd(S);
}

// DoT 結算(行動前);回傳 false = 此單位已死
function bnTickDots(S, u) {
  var ids = ['burn', 'poison', 'bleed'], i, d, dmg, src, x;
  for (i = 0; i < ids.length; i++) {
    d = u.st[ids[i]];
    if (!d || !u.alive) continue;
    src = S.units[d.src] || null;
    if (ids[i] === 'burn') dmg = d.val * 100 / (100 + bnSres(S, u)) * BN_DATA.K * BN_DATA.burnTickK;
    else if (ids[i] === 'poison') dmg = u.maxHp * d.val;
    else dmg = d.val * BN_DATA.K;
    bnHit(S, src, u, { ty: 'dot', dot: ids[i], fixed: dmg, mul: 1, noGuard: true, pierce: false });
    if (ids[i] !== 'bleed' || true) { /* DoT 每次行動前結算一次 */ }
    if (u.st[ids[i]]) { d.n -= 1; if (d.n <= 0) delete u.st[ids[i]]; }
    if (!u.alive) return false;
  }
  return u.alive;
}

// 普攻:回傳 'idle' / 目標單位(命中) / null
function bnNormal(S, u) {
  var t, rk = bnReach(S, u), isMage = u.troop === '謀', h, res, en;
  if (u.st.confuse) {
    en = S.units.filter(function (x) { return x.alive && x !== u; });
    delete u.st.confuse;
    if (!en.length) return null;
    t = en[Math.floor(S.rng() * en.length)];
    bnEv(S, 'unstatus', { tgt: u.id, id: 'confuse', why: 'used' });
    h = { ty: isMage ? 'strat' : 'phys', mul: isMage ? BN_DATA.normalMag : 1, basic: true, rxConfusedAlly: t.side === u.side };
    if (t.side === u.side) h.friendly = true;
    res = bnHitWithRx(S, u, t, h);
    return res && !res.evaded ? t : (res ? t : null);
  }
  if (rk <= 0) return 'idle';
  t = bnPickEnemy(S, u, 'one', 'basic');
  if (!t) return 'idle';
  h = { ty: isMage ? 'strat' : 'phys', mul: isMage ? BN_DATA.normalMag : 1, basic: true };
  res = bnHitWithRx(S, u, t, h);
  bnOnAttack(S, u, t, res);
  return t;
}

// 發動率
function bnRateOf(S, u, inst) {
  var d = inst.def, r = d.rate, cat = d.cat === 'pursuit' ? 'pursuit' : 'active';
  if (r === undefined) r = BN_DATA.rate[cat][d.power || 'M'];
  if (d.prep) r += BN_DATA.rate.prepBonus;
  if (u.troop === '謀' && cat === 'active') r += BN_DATA.mageRateBonus;
  r += (u.mods.rateBonus || 0);
  if (u.st.rate_down) r -= u.st.rate_down.val;
  return bnClamp(r, 0, BN_DATA.rate.cap);
}

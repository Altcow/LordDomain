// js/bn_effects.js — 戰鬥 A 模式:戰法 kind 結算、目標解析、反應、被動 / 指揮 / trigger、羈絆(combos partB)、補刀 / 再放 / 行動佇列與連鎖(PLAN_BATTLE_A §3.10、§4.3~§4.5)。
// 純邏輯、無 DOM。與 js/bn_engine.js 共用全域(bn 前綴)。簡化處與未實作的長尾 params 見 tools/bn_balance_report.md「與 PLAN 不一致」。
var BN_ATTACK = { atk_single: 1, atk_front: 1, atk_back: 1, atk_all: 1, atk_pierce: 1, atk_cross: 1, atk_multi: 1, atk_snipe: 1, atk_exec: 1, execute_chain: 1, lifesteal: 1, dot_spread: 1 };
var BN_TEAM_KINDS = { heal_hot: 1, heal_all: 1, buff_all: 1, rate_up: 1, shield_all: 1, cleanse: 1, resist: 1, cd_reduce: 0 };

function bnIsAttack(eff, o) {
  if (!BN_ATTACK[eff.kind]) return false;
  if (o && o.passive && (eff.kind === 'execute_chain' || eff.kind === 'lifesteal')) return false;
  return true;
}
function bnDurOf(eff, o, def) {
  var P = eff.params || {};
  if (o && o.perm) return 999;
  if (typeof P.rounds === 'number') return P.rounds;
  if (typeof P.dur === 'number') return P.dur;
  if (o && typeof o.rounds === 'number') return o.rounds;
  return def !== undefined ? def : (eff.power === 'XL' ? BN_DATA.buffRoundsXL : BN_DATA.buffRounds);
}
function bnFilterSet(list, f) {
  if (!f) return list;
  return list.filter(function (x) {
    if (f.troop && x.troop !== f.troop) return false;
    if (f.fac !== undefined && x.fac !== f.fac) return false;
    if (f.fig && x.fig !== f.fig) return false;
    return true;
  });
}
function bnLowestHp(list) {
  var b = null, i;
  for (i = 0; i < list.length; i++) if (!b || list[i].hp / list[i].maxHp < b.hp / b.maxHp) b = list[i];
  return b;
}
function bnPickAlly(S, u, P, wantUnacted) {
  var al = bnAllies(S, u, true), b = null, i;
  if (wantUnacted) al = al.filter(function (x) { return !x.acted && x !== u; });
  if (!al.length) return null;
  if (P && P.pick === 'atk') { for (i = 0; i < al.length; i++) if (!b || bnAtk(S, al[i]) > bnAtk(S, b)) b = al[i]; return b; }
  return bnLowestHp(al);
}
function bnAreaCross(S, p) {
  var side = p.side;
  return S.teams[side].units.filter(function (x) {
    if (!x.alive) return false;
    return x === p || (x.row === p.row && Math.abs(x.col - p.col) === 1) || (x.col === p.col && Math.abs(x.row - p.row) === 1);
  });
}
function bnPrimaryFor(S, u, eff, o) {
  var tg = eff.target, P = eff.params || {};
  if (o && o.forced && o.forced.alive && o.forced.side !== u.side) return o.forced;
  if (eff.kind === 'atk_snipe' || tg === 'enemy_lowest') return bnPickEnemy(S, u, 'lowest', eff.kind);
  if (tg === 'enemy_highest_atk') return bnPickEnemy(S, u, 'atk', eff.kind);
  if (tg === 'enemy_back' || eff.kind === 'atk_back') return bnPickEnemy(S, u, 'back', eff.kind);
  if (tg === 'enemy_front') return bnPickEnemy(S, u, 'front', eff.kind);
  return bnPickEnemy(S, u, 'one', eff.kind);
}
// 解析目標集合(攻擊型依 kind 決定範圍)
function bnTargetsFor(S, u, eff, res, o) {
  var tg = eff.target, k = eff.kind, P = eff.params || {}, list, p, rk;
  if (tg === 'same') return res && res.main ? res.main : [];
  if (tg === 'primary') return res && res.main && res.main.length ? [res.main[0]] : [];
  if (bnIsAttack(eff, o)) {
    if (k === 'atk_all' || k === 'dot_spread') return bnEnemies(S, u);
    if (k === 'atk_front') {
      if (P.row === 'pick' || tg === 'enemy_one') { p = bnPrimaryFor(S, u, eff, o); if (!p) return []; rk = bnRank(S, p); return bnEnemies(S, u).filter(function (x) { return bnRank(S, x) === rk; }); }
      return bnEnemies(S, u).filter(function (x) { return bnRank(S, x) === 1; });
    }
    p = bnPrimaryFor(S, u, eff, o);
    if (!p) return [];
    if (k === 'atk_pierce') return bnEnemies(S, u).filter(function (x) { return x.col === p.col; });
    if (k === 'atk_cross') return bnAreaCross(S, p);
    return [p];
  }
  switch (tg) {
    case 'self': return [u];
    case 'ally_one': p = bnPickAlly(S, u, P, k === 'reorder'); return p ? [p] : [];
    case 'ally_all': list = bnAllies(S, u, true); break;
    case 'ally_front': list = bnAllies(S, u, true).filter(function (x) { return bnRank(S, x) === 1; }); break;
    case 'ally_back': rk = bnRankMax(S, u.side); list = bnAllies(S, u, true).filter(function (x) { return bnRank(S, x) === rk; }); break;
    case 'ally_lowest': list = bnAllies(S, u, k !== 'guard' && k !== 'swap'); p = bnLowestHp(list); return p ? [p] : [];
    case 'ally_row': list = bnAllies(S, u, true).filter(function (x) { return x.row === u.row; }); break;
    case 'enemy_one': p = bnPickEnemy(S, u, 'one', k); return p ? [p] : [];
    case 'enemy_front': list = bnEnemies(S, u).filter(function (x) { return bnRank(S, x) === 1; }); break;
    case 'enemy_back': rk = bnRankMax(S, bnOpp(u.side)); list = bnEnemies(S, u).filter(function (x) { return bnRank(S, x) === rk; }); break;
    case 'enemy_all': list = bnEnemies(S, u); break;
    case 'enemy_lowest': p = bnPickEnemy(S, u, 'lowest', k); return p ? [p] : [];
    case 'enemy_highest_atk': p = bnPickEnemy(S, u, 'atk', k); return p ? [p] : [];
    case 'enemy_cross': p = bnPickEnemy(S, u, 'one', k); return p ? bnAreaCross(S, p) : [];
    case 'enemy_col': p = bnPickEnemy(S, u, 'one', k); return p ? bnEnemies(S, u).filter(function (x) { return x.col === p.col; }) : [];
    case 'members': return [];
    default: return [];
  }
  return bnFilterSet(list, eff.filter || P.filter);
}

// ───────── 是否值得發動(不抽亂數) ─────────
function bnUseful(S, u, inst) {
  var d = inst.def, P = d.params || {}, k = d.kind, al, i;
  if (P.cond === 'ally_below70') { if (!bnAllies(S, u, true).some(function (x) { return x.hp < x.maxHp * 0.7; })) return false; }
  if (P.cond === 'has_debuff') { if (!bnAllies(S, u, true).some(bnHasNeg)) return false; }
  if (k === 'heal_single' || k === 'heal_all' || k === 'heal_hot') {
    if (!bnAllies(S, u, true).some(function (x) { return x.hp < x.maxHp * 0.98; })) return false;
  } else if (k === 'cleanse') {
    if (!bnAllies(S, u, true).some(bnHasNeg)) return false;
  } else if (k === 'revive') {
    if (u.team.revived || !u.team.deadOrder.length) return false;
  } else if (k === 'reorder') {
    if (!bnPickAlly(S, u, P, true)) return false;
  } else if (k === 'dispel') {
    if (!bnEnemies(S, u).some(function (x) { return x.st.atk_up || x.st.def_up || x.st.spd_up || x.st.crit_up || x.st.shield || x.st.ward; })) return false;
  } else if (k === 'guard') {
    if (bnAllies(S, u, false).length === 0) return false;
  } else if (k === 'swap') {
    if (bnAllies(S, u, false).length === 0 && d.target !== 'enemy_front') return false;
  } else if (k === 'sleep') {   // 敵方全員已沉睡或醒後免疫 → 不發動
    if (!bnEnemies(S, u).some(function (x) { return !x.st.sleep && !(x.sleepImm >= S.round); })) return false;
  } else if (k === 'paralyze') {
    if (!bnEnemies(S, u).some(function (x) { return !x.st.paralyze; })) return false;
  } else if (k === 'buff_steal') {
    if (!bnEnemies(S, u).some(bnHasBuff)) return false;
  } else if (BN_ATTACK[k]) {
    if (!bnEnemies(S, u).length) return false;
  }
  if (P.onlyVs && d.vs && !bnEnemies(S, u).some(function (x) { return bnVsMatch(S, d.vs, x); })) return false;   // 只對特定對象才發動(潘鳳遇布)
  return true;
}
var BN_BUFFS = ['atk_up', 'def_up', 'spd_up', 'crit_up', 'rate_up', 'evade', 'counter', 'ward', 'amp_atk'];
function bnHasBuff(x) { for (var i = 0; i < BN_BUFFS.length; i++) if (x.st[BN_BUFFS[i]] && !(x.st[BN_BUFFS[i]].left >= 900 && BN_BUFFS[i] !== 'ward')) return true; return !!x.st.shield; }
function bnHasNeg(x) { var k; for (k in x.st) if (BN_NEG[k]) return true; return false; }

// ───────── 發動戰法 ─────────
function bnCdOf(inst) {
  var d = inst.def, base = d.cd !== undefined ? d.cd : (d.cat === 'active' ? BN_DATA.cd[d.power] : (d.cat === 'ult' ? BN_DATA.rate.ultCd : 0));
  if (base > 1 && d.cat !== 'ult' && BN_DATA.cdCut) base = Math.max(1, base - BN_DATA.cdCut);   // 戰鬥改版:全機率制下冷卻整體縮短(讓一回合能放出更多戰法)
  if (base > 0 && inst.cdMinus) base = Math.max(1, base - inst.cdMinus);
  return base;
}
function bnCastUlt(S, u, inst, o) {
  var ok;
  inst = inst || u.ult;
  if (!inst) return false;
  bnEv(S, 'ult', { u: u.id, id: inst.def.id });
  S.stats.ults++;
  S.chain.ult = true;
  ok = bnCast(S, u, inst, Object.assign({}, o || {}, { isUlt: true }));
  S.chain.ult = false;
  return ok;
}
function bnCast(S, u, inst, o) {
  var d = inst.def, P = d.params || {}, res = { main: null, kills: [], hits: 0, dmg: 0, targets: [] }, eff, mt, ex, i, e2, loss;
  o = o || {};
  eff = { kind: d.kind, power: d.power, dmg: d.dmg, params: P, target: d.target || 'enemy_one', sk: d };
  if (d.kind === 'revive' && (!u.team.deadOrder.length || u.team.revived)) {
    if (P.fallback) { eff = { kind: P.fallback.kind, power: P.fallback.power, params: {}, target: P.fallback.target, sk: d }; }
    else return false;
  }
  if (u.mods.skillPlus && (d.cat === 'active' || d.cat === 'pursuit' || d.cat === 'ult')) o = Object.assign({}, o, { scale: (o.scale || 1) * (1 + u.mods.skillPlus) });
  if (inst.vsScale) o = Object.assign({}, o, { scale: (o.scale || 1) * inst.vsScale });
  if (inst.vsCrit) o = Object.assign({}, o, { vsCrit: inst.vsCrit });
  if (u.randPow && (d.cat === 'active' || d.cat === 'pursuit' || d.cat === 'ult')) o = Object.assign({}, o, { scale: (o.scale || 1) * (u.randPow[0] + S.rng() * (u.randPow[1] - u.randPow[0])) });   // 對象條件(特定友軍在我方時)效果提升
  if (P.onlyVs && d.vs && !o.forced) o = Object.assign({}, o, { forced: bnEnemies(S, u).filter(function (x) { return bnVsMatch(S, d.vs, x); })[0] });
  mt = bnTargetsFor(S, u, eff, res, o);
  if (!mt.length && eff.kind !== 'revive' && eff.kind !== 'summon' && eff.kind !== 'trap' && eff.kind !== 'extra_turn') return false;
  res.main = mt;
  S.stats.skillUse[d.id] = (S.stats.skillUse[d.id] || 0) + 1;
  bnEv(S, 'skill', { u: u.id, id: d.id, name: d.name, kind: d.kind, cat: d.cat, rc: o.recastN || undefined, as: o.assistBy, th: d.theme || undefined });
  if (P.hpCost && d.kind !== 'self_sacrifice') {
    loss = Math.min(u.hp - 1, Math.round(u.maxHp * P.hpCost));
    if (loss > 0) { u.hp -= loss; bnEv(S, 'dmg', { src: u.id, tgt: u.id, v: loss, abs: 0, ty: 'self', hp: u.hp }); }
  }
  bnApplyEffect(S, u, eff, res, o);
  if (P.extra && !S.over) {
    for (i = 0; i < P.extra.length; i++) {
      ex = P.extra[i];
      if (ex.params && ex.params.trigger) continue;   // 帶 trigger 的附帶效果在開戰時註冊為被動,不在此結算
      e2 = { kind: ex.kind, power: ex.power || d.power, dmg: ex.dmg || d.dmg, params: ex.params || {}, target: ex.target || d.target, filter: ex.filter, sk: d, isExtra: true };
      if (ex.target === d.target && d.target !== 'self') e2.target = 'same';
      bnApplyEffect(S, u, e2, res, o);
    }
  }
  if (!S.over) bnAttachParams(S, u, eff, res, o);
  if (!o.noCd) {
    inst.cd = bnCdOf(inst);
    if (inst.cd > 0) bnEv(S, 'cd', { u: u.id, id: d.id, cd: inst.cd });
  }
  if (!S.over) bnAfterCast(S, u, inst, res, o);
  return true;
}
function bnAfterCast(S, u, inst, res, o) {
  var d = inst.def, rc = d.recast || (d.params && d.params.recast), n, mx, dec;
  if (!o.noAssist && (d.cat === 'active' || d.cat === 'ult') && !o.assistBy) bnQueueAssists(S, u, d, res, o);
  if (!o.assistBy) bnBondEvent(S, 'on_cast', { u: u, sk: d, res: res });
  if (!o.assistBy && d.cat !== 'ult') bnFire(S, 'on_ally_cast', { u: u });
  // 擊殺再放
  if (rc && res.kills.length && BN_ATTACK[d.kind] && u.alive && !u.st.stun) {
    n = (o.recastN || 0) + 1;
    mx = d.cat === 'ult' ? BN_DATA.chain.ultRecastMax : (rc.max !== undefined ? rc.max : BN_DATA.chain.recastDefaultMax);
    dec = d.cat === 'ult' ? BN_DATA.chain.ultRecastDecay : (rc.decay !== undefined ? rc.decay : BN_DATA.chain.recastDefaultDecay);
    if (inst.recastRound !== S.round) { inst.recastRound = S.round; inst.recastN = 0; }
    if (inst.recastN < mx) {
      inst.recastN++;
      S.chain.queue.push({ k: 'recast', u: u, inst: inst, n: n, scale: Math.pow(dec, n), depth: S.chain.depth });
    }
  }
}

// ───────── 結算一個效果 ─────────
function bnPct(kind, eff, sc) { return bnKT(kind, eff.power) * sc; }
function bnAtkMul(S, u, eff, sc, t) {
  var P = eff.params || {}, kind = eff.kind, m, c, n, cfg;
  m = P.mulOverride !== undefined ? P.mulOverride : bnKT(kind, eff.power);
  m *= (P.mulScale || 1) * sc;
  if (P.bonusVsStatus && t && t.st[BN_ALIAS[P.bonusVsStatus.status] || P.bonusVsStatus.status]) m *= 1 + (BN_DATA.bonusVs[P.bonusVsStatus.mult] || 0.4);
  if (P.perFacAlly) {
    cfg = P.perFacAlly; n = bnAllies(S, u, !!cfg.countSelf).filter(function (x) { return x.spec.fac === cfg.fac; }).length;
    m *= 1 + Math.min(n, cfg.max) * (BN_DATA.stepMul[cfg.step] || 0.05);
  }
  if (P.perAlly) {
    cfg = P.perAlly;
    n = bnAllies(S, u, false).filter(function (x) { return cfg.by === 'troop' ? x.troop === cfg.key : (cfg.by === 'fac' ? x.spec.fac === cfg.key : (cfg.by === 'tag' ? bnFigHasTag(x.fig, cfg.key) : x.spec.fac === 4)); }).length;
    m *= 1 + Math.min(n, cfg.max) * (BN_DATA.stepMul[cfg.step] || 0.05);
  }
  if (P.crowd_scale) m *= 1 + Math.min(bnAllies(S, u, true).length, P.crowd_scale.max) * (BN_DATA.stepMul[P.crowd_scale.step] || 0.05);
  if (kind === 'atk_exec' && t) m *= 1 + (1 - t.hp / t.maxHp);
  if (P.scaleBy === 'spd' && kind !== 'atk_multi') m *= 1 + bnClamp((bnSpd(S, u) - 80) / 200, 0, 0.3);   // 看攻速加成
  return m;
}
function bnApplyEffect(S, u, eff, res, o) {
  var P = eff.params || {}, kind = eff.kind, sc = o.scale || 1, targets, t, i, j, v, ty, hits, r, mul, hh, d, left, hp, tmp, cnt, p2, pw = eff.power, prevLs;
  if (S.over) return;
  if (eff.target === 'same' && (!res.main || !res.main.length)) return;
  var prevEff = S.curEff, prevU = S.curEffU;
  S.curEff = eff; S.curEffU = u;
  bnApplyEffect2(S, u, eff, res, o);
  S.curEff = prevEff; S.curEffU = prevU;
}
function bnApplyEffect2(S, u, eff, res, o) {
  var P = eff.params || {}, kind = eff.kind, sc = o.scale || 1, targets, t, i, j, v, ty, hits, r, mul, hh, d, left, hp, tmp, cnt, p2, pw = eff.power, prevLs;
  if (bnIsAttack(eff, o)) {
    targets = bnTargetsFor(S, u, eff, res, o);
    if (!res.main || eff.isExtra !== true) { if (!res.main) res.main = targets; }
    ty = eff.dmg || (u.troop === '謀' ? 'strat' : 'phys');
    hits = kind === 'atk_multi' ? bnHitsOf(S, u, P) : 1;
    var sk = eff.sk, wx = sk && sk.theme === 'wuxing' && u.el ? u.el : '';
    prevLs = u.st.lifesteal;
    if (kind === 'lifesteal') u.st.lifesteal = { id: 'lifesteal', val: bnKT('lifesteal_pct', pw), left: 0, act: true, tmp: true };
    targets = targets.slice();
    for (i = 0; i < targets.length && !S.over; i++) {
      t = targets[i];
      for (j = 0; j < hits; j++) {
        if (!t.alive || S.over) break;
        mul = bnAtkMul(S, u, eff, sc, t);
        hh = { ty: ty, mul: mul, kind: kind, sk: eff.sk, pierce: kind === 'atk_pierce', cat: eff.sk ? eff.sk.cat : '', wx: wx, vsSk: eff.isExtra ? null : (sk && sk.vs) || null, vsCrit: o.vsCrit || 0 };
        r = bnHitWithRx(S, u, t, hh);
        if (r) { res.hits++; res.dmg += r.dmg || 0; if (r.killed) res.kills.push(t); }
      }
      // 附帶:stun 類在傷害之後
      if (wx && t.alive && !t.st.wx_mark) bnStatusApply(S, u, t, 'wx_mark', { el: wx, left: BN_DATA.wx.markRounds, noRes: true }, {});   // 五行印
    }
    if (kind === 'lifesteal') { if (prevLs) u.st.lifesteal = prevLs; else delete u.st.lifesteal; }
    if (kind === 'dot_spread') {
      for (i = 0; i < targets.length; i++) if (targets[i].alive) bnStatusApply(S, u, targets[i], 'burn', { val: bnMag(S, u) * bnKT('dot_burn', 'S') * sc, n: 2, act: true, spread: P.spreadOn === 'on_kill' }, {});
    }
    return;
  }
  targets = bnTargetsFor(S, u, eff, res, o);
  if (!res.main && !eff.isExtra) res.main = targets;
  if (eff.sk && eff.sk.vs && !eff.isExtra) bnVsStrip(S, u, eff.sk.vs, targets);
  switch (kind) {
    case 'heal_single': case 'heal_all':
      for (i = 0; i < targets.length; i++) {
        v = u.base.heal * bnPct(kind, eff, sc) * (1 + (u.mods.healPct || 0)) * (1 + ((P.healPower && P.healPower.troopBonus) || 0));
        S.stats.healCasts[u.side]++;
        bnHeal(S, u, targets[i], v, { xl: pw === 'XL' });
      }
      break;
    case 'heal_hot':
      if (o.instant) {
        for (i = 0; i < targets.length; i++) bnHeal(S, u, targets[i], u.base.heal * bnKT('heal_hot', pw) * sc * (1 + ((P.healPower && P.healPower.troopBonus) || 0)), {});
      } else {
        for (i = 0; i < targets.length; i++) {
          bnStatusApply(S, u, targets[i], 'heal_hot', { val: u.base.heal * bnKT('heal_hot', pw) * sc * (1 + ((P.healPower && P.healPower.troopBonus) || 0)), left: bnDurOf(eff, o, 3), noRes: true }, { });
        }
        S.stats.healCasts[u.side]++;
      }
      break;
    case 'shield_single': case 'shield_all':
      for (i = 0; i < targets.length; i++) {
        v = u.base.sh * bnPct(kind, eff, sc) * (1 + (P.shieldBoost || 0)) * (1 + ((P.healPower && P.healPower.troopBonus) || 0));
        bnShield(S, u, targets[i], v, {});
      }
      break;
    case 'cleanse':
      cnt = bnKT('cleanse', pw);
      for (i = 0; i < targets.length; i++) bnCleanse(S, targets[i], cnt, u);
      if (pw === 'XL') for (i = 0; i < targets.length; i++) bnStatusApply(S, u, targets[i], 'ccimm', { left: 1 + BN_DATA.ccImmRounds, force: true }, { noExtend: true });
      break;
    case 'revive':
      if (u.team.deadOrder.length && !u.team.revived) {
        var vid = u.team.deadOrder.shift();
        var vt = S.units[vid], pctv = bnKT('revive', pw), hr = vt.st.heal_reduce;
        if (hr && hr.val >= 100) { u.team.deadOrder.unshift(vid); break; }
        if (!P.once) u.team.revived = true;
        vt.alive = true; vt.hp = Math.max(1, Math.round(vt.maxHp * pctv * (hr ? 1 - hr.val / 100 : 1)));
        vt.st = {}; vt.acted = true;
        bnEv(S, 'revive', { tgt: vt.id, hp: vt.hp });
        S.stats.revives++;
      }
      break;
    case 'buff_atk': case 'buff_def': case 'buff_spd': case 'buff_crit': {
      var sid = kind === 'buff_atk' ? 'atk_up' : kind === 'buff_def' ? 'def_up' : kind === 'buff_spd' ? 'spd_up' : 'crit_up';
      for (i = 0; i < targets.length; i++) bnStatusApply(S, u, targets[i], sid, { val: bnPct(kind, eff, sc), left: bnDurOf(eff, o) }, {});
      break;
    }
    case 'buff_all':
      for (i = 0; i < targets.length; i++) {
        d = bnDurOf(eff, o);
        bnStatusApply(S, u, targets[i], 'atk_up', { val: bnKT('buff_all', pw) * sc, left: d }, {});
        bnStatusApply(S, u, targets[i], 'def_up', { val: bnKT('buff_all', pw) * sc, left: d }, {});
        bnStatusApply(S, u, targets[i], 'spd_up', { val: bnKT('buff_all_spd', pw) * sc, left: d }, {});
      }
      break;
    case 'rate_up': case 'rate_down': {   // 戰法發動率 ± (取代士氣類)
      var rv = (typeof P.amount === 'number' ? (P.amount > 1 ? P.amount / 100 : P.amount) : bnKT(kind, pw)) * sc * (P.scaleByLostHp ? 1 + (1 - u.hp / u.maxHp) : 1);
      for (i = 0; i < targets.length; i++) bnStatusApply(S, u, targets[i], kind, { val: rv, left: bnDurOf(eff, o) }, {});
      break;
    }
    case 'debuff_hit':
      v = typeof P.val === 'number' ? P.val : bnKT('debuff_hit', pw);   // 落空機率;P.chance = 附上機率
      for (i = 0; i < targets.length; i++) if (bnChance(S, P, targets[i], u)) bnStatusApply(S, u, targets[i], 'debuff_hit', { val: v, left: bnDurOf(eff, o, typeof P.dur === 'number' ? P.dur : 2) }, {});
      break;
    case 'wx_mark':
      for (i = 0; i < targets.length; i++) if (u.el) bnStatusApply(S, u, targets[i], 'wx_mark', { el: u.el, left: BN_DATA.wx.markRounds, noRes: true }, {});
      break;
    case 'buff_steal':
      for (i = 0; i < targets.length; i++) bnBuffSteal(S, u, targets[i], P.count !== undefined ? P.count : bnKT('buff_steal', pw), P.giveTo || 'self', P.prefer, res, o);
      break;
    case 'invert':
      for (i = 0; i < targets.length; i++) bnInvert(S, u, targets[i], P.count !== undefined ? P.count : bnKT('invert', pw), P.dir);
      break;
    case 'debuff_atk': case 'debuff_def': case 'debuff_spd': {
      var did = kind === 'debuff_atk' ? 'atk_down' : kind === 'debuff_def' ? 'def_down' : 'spd_down';
      for (i = 0; i < targets.length; i++) bnStatusApply(S, u, targets[i], did, { val: bnPct(kind, eff, sc), left: bnDurOf(eff, o) }, {});
      break;
    }
    case 'mark':
      for (i = 0; i < targets.length; i++) bnStatusApply(S, u, targets[i], 'mark', { val: bnPct('mark', eff, sc), left: bnDurOf(eff, o, 2), noRes: false }, {});
      break;
    case 'stun':
      for (i = 0; i < targets.length; i++) {
        t = targets[i];
        v = P.dmgMul !== undefined ? P.dmgMul : bnKT('stun', pw);
        if (v > 0 && t.alive) { r = bnHitWithRx(S, u, t, { ty: eff.dmg || (u.troop === '謀' ? 'strat' : 'phys'), mul: v * sc, kind: kind, sk: eff.sk }); if (r && r.killed) res.kills.push(t); }
        if (t.alive && bnChance(S, P, t, u)) bnStatusApply(S, u, t, 'stun', { act: true, left: undefined }, {});
      }
      break;
    case 'silence': case 'timid': case 'bind':
      for (i = 0; i < targets.length; i++) if (bnChance(S, P, targets[i], u)) bnStatusApply(S, u, targets[i], kind === 'silence' ? 'silence' : 'timid', { left: (P.dur || bnKT(kind, pw)) + bnVsDur(S, eff, targets[i]) }, {});
      break;
    case 'fear':
      for (i = 0; i < targets.length; i++) bnStatusApply(S, u, targets[i], 'fear', { act: true, skip: bnKT('fear_skip', pw) }, {});
      break;
    case 'sleep':   // 睡眠:無法行動、不會閃避;受攻擊傷害機率驚醒(bn_engine.js bnApplyDmg / bnWake)
      for (i = 0; i < targets.length; i++) if (targets[i].alive && bnChance(S, P, targets[i], u)) bnStatusApply(S, u, targets[i], 'sleep', { left: (typeof P.dur === 'number' ? P.dur : bnKT('sleep', pw)) + bnVsDur(S, eff, targets[i]) }, {});
      break;
    case 'paralyze':   // 麻痺:每次行動前機率無法行動、速度下降;雷電系傳導給相鄰一名敵人
      for (i = 0; i < targets.length; i++) {
        t = targets[i];
        if (!t.alive || !bnChance(S, P, t, u)) continue;
        if (bnStatusApply(S, u, t, 'paralyze', { left: (typeof P.dur === 'number' ? P.dur : bnKT('paralyze', pw)) + bnVsDur(S, eff, t), val: BN_DATA.paralyze.spd }, {}) && bnPzConducts(eff)) bnPzConduct(S, u, t);
      }
      break;
    case 'confuse':
      for (i = 0; i < targets.length; i++) if (bnChance(S, P, targets[i], u)) bnStatusApply(S, u, targets[i], 'confuse', { act: true, ft: P.forceTarget || undefined }, {});
      break;
    case 'taunt':
      for (i = 0; i < targets.length; i++) bnStatusApply(S, u, targets[i], 'taunt', { left: bnDurOf(eff, o, bnKT('taunt', pw)), def: bnKT('taunt_def', pw) * sc }, {});
      break;
    case 'guard':
      for (i = 0; i < targets.length; i++) {
        if (targets[i] === u) continue;
        bnStatusApply(S, u, targets[i], 'guard', { by: u.id, val: Math.min(0.9, bnKT('guard', pw) * sc), left: bnDurOf(eff, o, 2), force: true }, {});
      }
      break;
    case 'dot_burn':
      for (i = 0; i < targets.length; i++) bnStatusApply(S, u, targets[i], 'burn', { val: bnMag(S, u) * bnKT('dot_burn', pw) * sc * (u.mods.burnOut || 1), n: P.turns || (pw === 'XL' ? BN_DATA.dotRoundsXL : BN_DATA.dotRounds), act: true }, {});
      break;
    case 'dot_poison':
      for (i = 0; i < targets.length; i++) bnStatusApply(S, u, targets[i], 'poison', { val: bnKT('dot_poison', pw) * sc, n: P.turns || BN_DATA.poisonRounds, act: true }, {});
      break;
    case 'dot_bleed':
      for (i = 0; i < targets.length; i++) bnStatusApply(S, u, targets[i], 'bleed', { val: bnAtk(S, u) * bnKT('dot_bleed', pw) * sc, n: P.turns || BN_DATA.dotRounds, act: true }, {});
      break;
    case 'counter':
      for (i = 0; i < targets.length; i++) bnStatusApply(S, u, targets[i], 'counter', { val: bnKT('counter', pw) * sc, left: bnDurOf(eff, o) }, { });
      break;
    case 'reorder':
      for (i = 0; i < targets.length; i++) {
        t = targets[i];
        if (t.acted) t.reorderNext = true; else t.reorder = true;
        var sp = bnKT('reorder_spd', pw);
        if (sp > 0) bnStatusApply(S, u, t, 'spd_up', { val: sp, left: 2 }, {});
        bnEv(S, 'status', { src: u.id, tgt: t.id, id: 'reorder', left: 1 });
      }
      break;
    case 'swap': bnSwap(S, u, eff); break;
    case 'lifesteal':   // 被動吸血(普攻)
      for (i = 0; i < targets.length; i++) bnStatusApply(S, u, targets[i], 'lifesteal', { val: bnKT('lifesteal_pct', pw) * sc, left: bnDurOf(eff, o), act: o.perm ? true : false }, {});
      break;
    case 'execute_chain':   // 被動:擊倒時疊攻擊
      u.killStack = Math.min((P.stackMax || 3) + 0, (u.killStack || 0) + 1);
      break;
    case 'evade':
      for (i = 0; i < targets.length; i++) bnStatusApply(S, u, targets[i], 'evade', { charges: P.charges || bnKT('evade', pw), left: bnDurOf(eff, o, 2) }, { });
      break;
    case 'stealth':
      for (i = 0; i < targets.length; i++) bnStatusApply(S, u, targets[i], 'stealth', { vs: P.vs === undefined ? 'single' : P.vs, left: P.dur === 'battle' ? 999 : bnDurOf(eff, o, bnKT('stealth_dur', pw)), force: true }, { });
      break;
    case 'immune':
      for (i = 0; i < targets.length; i++) targets[i].immunes.push({ types: P.types || [], firstOnly: !!P.firstOnly, charges: P.charges, rate: P.rate !== undefined ? P.rate : undefined });
      break;
    case 'undying':
      for (i = 0; i < targets.length; i++) bnStatusApply(S, u, targets[i], 'undying', { minHp: P.minHp || 1, once: !!P.once, healAfter: P.healAfter, left: o.perm ? 999 : bnDurOf(eff, o, bnKT('undying_dur', pw)), force: true }, { });
      break;
    case 'extra_turn':
      tmp = targets.length ? targets : [u];
      tmp.sort(function (a, b) { return bnSpd(S, b) - bnSpd(S, a); });
      for (i = 0; i < tmp.length; i++) bnQueueExtra(S, tmp[i], !!P.normalOnly, true);
      break;
    case 'heal_reduce':
      for (i = 0; i < targets.length; i++) bnApplyHealBlock(S, u, targets[i], P.ratio || BN_DATA.hb.defaultRatio, P.turns || BN_DATA.hb.defaultTurns);
      break;
    case 'resist':
      for (i = 0; i < targets.length; i++) bnGrantWard(S, u, targets[i], P.layers || 1, P.guard || 'any', P.dur || BN_DATA.ward.dur);
      break;
    case 'dispel':
      for (i = 0; i < targets.length; i++) bnDispel(S, u, targets[i], P.count !== undefined ? P.count : bnKT('dispel', pw), P.prefer, bnKT('dispel_shield', pw));
      break;
    case 'cd_reduce': case 'cd_reset': {
      var amt = typeof P.amount === 'number' ? P.amount : bnKT('cd_reduce', P.amount || pw);
      var scope = P.scope || 'all_skills';
      var tl = targets.length ? targets : [u];
      if (eff.target === 'ally_one' && scope.indexOf('fig:') === 0) tl = bnAllies(S, u, true).filter(function (x) { return x.fig === scope.slice(4); });
      if (scope.indexOf('fig:') === 0 && eff.target === 'self') tl = bnAllies(S, u, true).filter(function (x) { return x.fig === scope.slice(4); });
      for (i = 0; i < tl.length; i++) for (j = 0; j < tl[i].act.length; j++) {
        if (tl[i].act[j].def.cat === 'ult') continue;   // 不可縮短大招
        if (kind === 'cd_reset') tl[i].act[j].cd = 0; else tl[i].act[j].cd = Math.max(0, tl[i].act[j].cd - amt);
      }
      break;
    }
    case 'self_sacrifice': {
      var cost = Math.min(u.hp - 1, Math.round(u.maxHp * (P.hpCost || 0.1)));
      if (cost > 0) { u.hp -= cost; bnEv(S, 'dmg', { src: u.id, tgt: u.id, v: cost, abs: 0, ty: 'self', hp: u.hp }); }
      var lost = 1 - u.hp / u.maxHp, g = P.gain || {};
      var scl = (P.scaleByLostHp ? 1 + lost : 1);
      bnApplyEffect(S, u, { kind: g.kind || 'buff_atk', power: g.power || pw, params: g.params || {}, target: g.target || 'ally_all', sk: eff.sk, isExtra: true }, { main: null, kills: [] }, { scale: scl * (P.trigger === 'hp_below_30' ? 1 : sc) });
      if (eff.sk && eff.sk.vs && eff.sk.vs.mode === 'ally') bnAllies(S, u, false).forEach(function (x) {   // 託付對象(趙雲)大幅強化
        if (!bnVsMatch(S, eff.sk.vs, x)) return;
        bnStatusApply(S, u, x, 'atk_up', { val: bnKT('buff_atk', 'L'), left: 3 }, {});
        bnStatusApply(S, u, x, 'spd_up', { val: bnKT('buff_spd', 'L'), left: 3 }, {});
      });
      if (P.trigger === 'hp_below_30' && u.alive) { bnEv(S, 'skip', { u: u.id, why: 'retreat' }); bnKill(S, null, u, {}); }   // 託孤投井:退場
      break;
    }
    case 'summon':
      bnSummon(S, u, eff, sc);
      break;
    case 'trap':
      u.team.trapOwner = u.id;
      S.teams[bnOpp(u.side)].trap = { effect: P.effect || { kind: 'stun', dur: 1 }, left: P.dur || 2, src: u.id };
      bnEv(S, 'status', { src: u.id, tgt: -1, id: 'trap', left: P.dur || 2 });
      break;
    case 'stack_charge': break;   // 被動註冊(bnSetupBattle)
    case 'stat_mod': break;
    default:
      S.warn.push('未知 kind ' + kind);
  }
}
function bnChance(S, P, t, u) {
  var vc = t && u ? bnVsChanceTo(S, u, t) : 0, c;
  if (P.chance === undefined) return true;
  c = typeof P.chance === 'number' ? (P.chance > 1 ? P.chance / 100 : P.chance) : (BN_DATA.chanceMap[P.chance] || 0.7);
  if (vc > c) c = vc;
  if (c >= 1) return true;
  return S.rng() < c;
}
// 麻痺傳導(雷電系):戰法 theme / tags 為 thunder 或 params.conduct
function bnPzConducts(eff) {
  var sk = eff.sk, P = eff.params || {};
  return !!(P.conduct || (sk && (sk.theme === 'thunder' || (sk.tags && sk.tags.indexOf('thunder') >= 0))));
}
// 傳給目標十字相鄰、尚未麻痺的第一名敵人(確定性,不抽亂數);每目標每回合 1 次;不造成傷害,與感電(傷害傳導)各自獨立
function bnPzConduct(S, u, t) {
  var en = bnAreaCross(S, t).filter(function (z) { return z !== t && !z.st.paralyze && !S.cnt.rx['pz:' + z.id]; }), z;
  if (!en.length) return false;
  z = en[0];
  S.cnt.rx['pz:' + z.id] = 1;
  S.stats.pzConduct++; S.stats.reactions++;
  bnEv(S, 'react', { id: 'rx_pz_conduct', name: '麻痺傳導', tgt: z.id });
  return bnStatusApply(S, u, z, 'paralyze', { left: BN_DATA.paralyze.conductLeft, val: BN_DATA.paralyze.spd }, {});
}
function bnCleanse(S, t, n, src) {
  var order = ['heal_reduce', 'stun', 'sleep', 'paralyze', 'fear', 'confuse', 'timid', 'silence', 'ult_lock', 'burn', 'poison', 'bleed', 'debuff_hit', 'atk_down', 'def_down', 'spd_down', 'rate_down', 'mark', 'wx_mark'], i, c = 0, hadPoison;
  for (i = 0; i < order.length && c < n; i++) {
    if (t.st[order[i]]) {
      hadPoison = order[i] === 'poison' || order[i] === 'bleed';
      if (order[i] === 'sleep') bnWake(S, t, 'cleanse'); else bnStatusRemove(S, t, order[i], 'cleanse');
      c++;
      if (hadPoison && src) { bnHeal(S, src, src, src.base.heal * bnKT('heal_single', 'S') * 0.5, {}); S.stats.reactions++; }
    }
  }
  return c;
}
function bnDispel(S, u, t, n, prefer, stripShield) {
  var buffs = ['atk_up', 'def_up', 'spd_up', 'crit_up', 'rate_up', 'evade', 'counter', 'ward', 'taunt', 'amp_atk'], i, c = 0, id;
  if (prefer === 'buff_atk' && t.st.atk_up && c < n) { bnStatusRemove(S, t, 'atk_up', 'dispel'); c++; }
  for (i = 0; i < buffs.length && c < n; i++) {
    id = buffs[i];
    if (!t.st[id] || (t.st[id].left && t.st[id].left >= 900 && id !== 'ward')) continue;
    if (id === 'ward') { t.st.ward.layers--; S.stats.dispelOnResist++; if (t.st.ward.layers <= 0) bnStatusRemove(S, t, 'ward', 'dispel'); c++; continue; }
    bnStatusRemove(S, t, id, 'dispel'); c++;
  }
  if (stripShield > 0 && t.st.shield) { t.st.shield.val *= (1 - stripShield); if (t.st.shield.val < 1) delete t.st.shield; }
  return c;
}
function bnApplyHealBlock(S, u, t, ratio, turns) {
  var left = turns === 'battle' ? 999 : turns;
  if (ratio >= 100 && turns !== 'battle' && turns > BN_DATA.hb.ratio100Turns && !(u && u.ult && S.chain && S.chain.ult)) left = BN_DATA.hb.ratio100Turns;
  return bnStatusApply(S, u, t, 'heal_reduce', { val: ratio, left: left, noRes: true }, { noExtend: true });
}
function bnGrantWard(S, u, t, layers, guard, dur) {
  var w = t.st.ward;
  if (w) { w.layers = Math.min(BN_DATA.ward.maxLayers, w.layers + layers); w.left = Math.max(w.left, dur); return; }
  t.st.ward = { id: 'ward', layers: Math.min(BN_DATA.ward.maxLayers, layers), guard: guard, left: dur + (t.acted ? 1 : 0) };
  S.stats.wardGiven += layers;
  bnEv(S, 'status', { src: u ? u.id : -1, tgt: t.id, id: 'ward', left: dur, val: layers });
}
function bnSwap(S, u, eff) {
  var P = eff.params || {}, a, b, tmp, en, front, back;
  if (eff.target === 'enemy_front' || P.side === 'enemy') {
    en = bnEnemies(S, u);
    front = en.filter(function (x) { return bnRank(S, x) === 1; })[0];
    var rk = bnRankMax(S, bnOpp(u.side));
    back = en.filter(function (x) { return bnRank(S, x) === rk && x !== front; })[0];
    a = front; b = back;
    if (a && a.mods.immuneFirst && a.mods.immuneFirst.indexOf('swap') >= 0 && !a.immuneFirstUsed.swap) { a.immuneFirstUsed.swap = true; return; }
  } else if (eff.target === 'ally_lowest') {
    a = u; b = bnLowestHp(bnAllies(S, u, false));
  } else {
    a = u;
    var rk2 = bnRankMax(S, u.side);
    b = bnAllies(S, u, false).filter(function (x) { return bnRank(S, x) === rk2; })[0];
  }
  if (!a || !b || a === b) return;
  tmp = a.row; a.row = b.row; b.row = tmp;
  tmp = a.col; a.col = b.col; b.col = tmp;
  bnEv(S, 'move', { u: a.id, row: a.row, col: a.col });
  bnEv(S, 'move', { u: b.id, row: b.row, col: b.col });
}
function bnSummon(S, u, eff, sc) {
  var P = eff.params || {}, pw = eff.power, t = u.team, cnt = P.count || 1, dur = P.dur || 3;
  if (P.mode === 'attacker') {
    t.summon = { pool: 0, left: dur, src: u.id, mul: bnKT('summon_atk', pw) * sc * (0.5 + 0.25 * cnt) };
  } else {
    var pool = Math.round(u.maxHp * bnKT('summon_hp', pw) * sc * (0.6 + 0.4 * cnt));
    t.summon = { pool: Math.max(pool, t.summon ? t.summon.pool : 0), left: dur, src: u.id, mul: 0 };
  }
  bnEv(S, 'status', { src: u.id, tgt: -1, id: 'summon', left: dur, val: t.summon.pool });
}
function bnSummonTick(S, t) {
  var s = t.summon, src = S.units[s.src], en, i, h;
  if (s.mul > 0 && src && src.alive) {
    en = bnAlive(S, bnOpp(t.side));
    for (i = 0; i < en.length && !S.over; i++) bnHit(S, src, en[i], { ty: 'phys', mul: s.mul, kind: 'summon', sk: null, noGuard: false });
  }
  s.left--;
  if (s.left <= 0) t.summon = null;
}
function bnSpreadBurn(S, a, t) {
  var en = bnAlive(S, t.side), i, b = t.st.burn;
  for (i = 0; i < en.length && !S.over; i++) bnHit(S, a, en[i], { ty: 'dot', dot: 'burn', fixed: b.val * 100 / (100 + bnSres(S, en[i])) * BN_DATA.K * 0.5, mul: 1, noGuard: true });
}
function bnTrapFire(S, tr, u) {
  var e = tr.effect || {}, k = e.kind || 'stun', src = S.units[tr.src], eff = { kind: k, power: e.power || 'S', params: { dur: e.dur }, target: 'same', sk: null };
  bnApplyEffect(S, src || u, eff, { main: [u], kills: [] }, {});
}

// 附帶 params:禁療 healBlock、抵禦 resist、自身代價 selfDebuff
function bnAttachParams(S, u, eff, res, o) {
  var P = eff.params || {}, i, t, rate, list, r;
  if (P.healBlock && res.main) {
    rate = (P.healBlock.rate / 100) * BN_DATA.hb.rateScale;
    list = res.main.filter(function (x) { return x.alive && x.side !== u.side; });
    for (i = 0; i < list.length; i++) {
      S.stats.hbCasts++;
      if (S.rng() < rate) { if (bnApplyHealBlock(S, u, list[i], P.healBlock.ratio, P.healBlock.turns)) S.stats.hbRollOK++; }
    }
  }
  if (P.resist) {
    rate = (P.resist.rate / 100) * BN_DATA.ward.rateScale;
    S.stats.resistRolls = (S.stats.resistRolls || 0) + 1;
    if (S.rng() < rate) {
      list = (res.main && res.main.length ? res.main : [u]).filter(function (x) { return x.side === u.side && x.alive; });
      if (!list.length) list = [u];
      for (i = 0; i < list.length; i++) bnGrantWard(S, u, list[i], P.resist.layers || 1, P.resist.guard || 'any', P.resist.dur || BN_DATA.ward.dur);
    }
  }
  if (P.selfDebuff && u.alive && P.selfDebuff.kind === 'heal_reduce') bnApplyHealBlock(S, u, u, P.selfDebuff.ratio || 100, P.selfDebuff.turns || 'battle');
  else if (P.selfDebuff && u.alive) {
    bnStatusApply(S, u, u, P.selfDebuff.stat === 'def' ? 'def_down' : (P.selfDebuff.stat === 'atk' ? 'atk_down' : 'spd_down'), { val: bnKT('debuff_def', P.selfDebuff.power) * 0.5, left: P.selfDebuff.dur || 1, noRes: true }, {});
  }
}

// ───────── 反應(combos partA) ─────────
function bnRxList() {
  if (!bnRxList.c) bnRxList.c = BN_COMBOS.reactions.slice().sort(function (a, b) { return b.priority - a.priority; });
  return bnRxList.c;
}
function bnRxHasStatus(t, id, S) {
  if (id === 'bind') return !!(t.st.timid || t.st.stun && false);
  if (id === 'shield') return !!t.st.shield;
  if (id === 'chill') return !!((t.st.stun && t.st.stun.ice) || (t.st.spd_down && t.st.spd_down.ice));   // 寒凍:寒冰類技能施加的暈眩 / 速度下降
  if (id === 'soaked') return !!(S && t.soakR && S.round - t.soakR <= 1);                               // 浸水:本回合或上回合被水攻類技能命中
  if (id === 'metal') return t.troop === '盾';                                                          // 金屬重甲:盾兵
  return !!t.st[BN_ALIAS[id] || id];
}
function bnRxMatch(rx, a, t, h, S) {
  var tr = rx.trigger || {}, conds = [], req = rx.requires || {}, ok, i, sts, sk = h.sk;
  if (tr.event) return false;
  if (tr.tag) conds.push(!!(sk && sk.tags && sk.tags.indexOf(tr.tag) >= 0));
  if (tr.kind) conds.push(tr.kind.indexOf(h.kind) >= 0);
  if (tr.cat) conds.push(!!(sk && sk.cat === tr.cat));
  if (!conds.length) return false;
  ok = tr.match === 'any' ? conds.some(Boolean) : conds.every(Boolean);
  if (!ok) return false;
  var sub = req.on === 'self' ? a : t;
  sts = req.status || [];
  if (req.match === 'any') ok = sts.some(function (s) { return bnRxHasStatus(sub, s, S); });
  else ok = sts.every(function (s) { return bnRxHasStatus(sub, s, S); });
  return ok;
}
function bnRxFind(S, a, t, h) {
  var list = bnRxList(), i, rx, lim, key;
  if (!h.sk || h.dot || h.counter || h.noRx) return null;
  for (i = 0; i < list.length; i++) {
    rx = list[i];
    if (!bnRxMatch(rx, a, t, h, S)) continue;
    lim = rx.limit || {};
    if (lim.perTargetPerRound && S.cnt.rx[rx.id + ':' + t.id] >= lim.perTargetPerRound) continue;
    if (lim.perTeamPerRound && (S.cnt.rx[rx.id + ':T' + a.side] || 0) >= lim.perTeamPerRound) continue;
    return rx;
  }
  return null;
}
function bnRxPre(S, a, t, h, rx) {
  var e = rx.effect || {}, o = { id: rx.id };
  switch (rx.id) {
    case 'rx_blaze': case 'rx_chain_fire': case 'rx_toxic_flare': o.dmgMult = e.dmgMult || 1; break;
    case 'rx_quench': o.dmgMult = 0.8; break;
    case 'rx_flood_bind': o.dmgMult = 1.4; break;
    case 'rx_marked_shot': o.forceCrit = true; o.ignoreEvade = true; break;
    case 'rx_helpless': o.dmgMult = 1.3; break;
    case 'rx_rend': o.dmgMult = 1 + (e.perSegmentMult || 0.1); break;
    case 'rx_bloodfeast': o.lifestealMult = 1.5; break;
    case 'rx_rout_pursuit': o.dmgMult = 1.3; break;
    case 'rx_shatter': o.shieldIgnore = 0.5; break;
    case 'rx_breach': o.dmgMult = 1.25; break;
    case 'rx_slow_ambush': if (t.acted) return null; o.dmgMult = 1.3; break;
    case 'rx_ice_shatter': o.dmgMult = e.dmgMult || 1; break;
    case 'rx_electrocute': o.dmgMult = e.dmgMult || 1.15; break;
    default: break;
  }
  return o;
}
function bnHitWithRx(S, a, t, h) {
  var rx = null, pre, res, key;
  if (h.friendly) pre = { id: 'rx_friendly_fire', dmgMult: 1.2 };
  else {
    rx = bnRxFind(S, a, t, h);
    if (rx) pre = bnRxPre(S, a, t, h, rx);
    if (!pre) rx = null;
  }
  if (pre) {
    h.rx = pre;
    S.stats.reactions++;
    bnEv(S, 'react', { id: pre.id, name: rx ? rx.name : '擾亂', tgt: t.id });
    if (rx) {
      S.cnt.rx[rx.id + ':' + t.id] = (S.cnt.rx[rx.id + ':' + t.id] || 0) + 1;
      S.cnt.rx[rx.id + ':T' + a.side] = (S.cnt.rx[rx.id + ':T' + a.side] || 0) + 1;
    }
  }
  res = bnHit(S, a, t, h);
  if (pre && res && !res.evaded) bnRxPost(S, a, t, h, pre, res);
  if (res && !res.evaded && t.alive && h.sk && h.sk.tags && h.sk.tags.indexOf('water') >= 0) t.soakR = S.round;   // 浸水(感電用)
  return res;
}
function bnRxPost(S, a, t, h, pre, res) {
  var b, x, i, en, extra;
  switch (pre.id) {
    case 'rx_blaze':
      b = t.st.burn;
      if (b) { extra = b.val * b.n * 0.6 * 100 / (100 + bnSres(S, t)) * BN_DATA.K; delete t.st.burn; if (t.alive) bnHit(S, a, t, { ty: 'dot', dot: 'rx', fixed: extra, mul: 1, noGuard: true }); }
      break;
    case 'rx_chain_fire':
      en = bnEnemies(S, a).filter(function (z) { return z.st.chain; });
      for (i = 0; i < en.length; i++) bnStatusApply(S, a, en[i], 'burn', { val: bnMag(S, a) * BN_DATA.rxBurnDot * 0.6, n: 1, act: true }, {});
      delete t.st.chain;
      break;
    case 'rx_toxic_flare':
      b = t.st.poison;
      if (b) {
        extra = b.val * t.maxHp * b.n * 0.8; delete t.st.poison;
        if (t.alive) bnHit(S, a, t, { ty: 'dot', dot: 'rx', fixed: extra, mul: 1, noGuard: true });
        en = bnAreaCross(S, t).filter(function (z) { return z !== t; });
        for (i = 0; i < en.length; i++) bnHit(S, a, en[i], { ty: 'dot', dot: 'rx', fixed: extra * 0.3, mul: 1, noGuard: true });
      }
      break;
    case 'rx_quench': delete t.st.burn; break;
    case 'rx_flood_bind': if (t.alive) bnStatusApply(S, a, t, 'spd_down', { val: 8, left: 1 }, {}); break;
    case 'rx_marked_shot': delete t.st.mark; break;
    case 'rx_rend': if (t.st.bleed && t.st.bleed.n < 3) t.st.bleed.n++; break;
    case 'rx_rout_pursuit': if (t.alive) bnStatusApply(S, a, t, 'spd_down', { val: 5, left: 1 }, {}); break;
    case 'rx_slow_ambush': if (t.alive) { delete t.st.spd_down; bnStatusApply(S, a, t, 'timid', { left: 1 }, {}); } break;
    case 'rx_ice_shatter':   // 冰裂:追加本次傷害 × 0.4(無視防禦),寒凍消散(寒冰速度下降解除;暈眩照舊但不能再碎一次)
      if (t.st.stun && t.st.stun.ice) delete t.st.stun.ice;
      if (t.st.spd_down && t.st.spd_down.ice) bnStatusRemove(S, t, 'spd_down', 'rx');
      if (t.alive && res.dmg > 0) bnHit(S, a, t, { ty: 'dot', dot: 'rx', fixed: res.dmg * 0.4, mul: 1, noGuard: true });
      break;
    case 'rx_electrocute':   // 感電:電流傳到目標十字相鄰的敵人(本次傷害 × 0.35)
      if (res.dmg > 0) {
        en = bnAreaCross(S, t).filter(function (z) { return z !== t; });
        for (i = 0; i < en.length && !S.over; i++) bnHit(S, a, en[i], { ty: 'dot', dot: 'rx', fixed: res.dmg * 0.35, mul: 1, noGuard: true });
      }
      break;
    case 'rx_friendly_fire': break;
    default: break;
  }
}

// ───────── 事件掛點 ─────────
function bnOnHit(S, a, t, h, hpLost) {
  var ct, cm, rate;
  // 反擊
  if (t.st.counter && !t.st.sleep && a && a.alive && !h.counter && h.ty === 'phys' && BN_DATA.troops[a.troop].R <= 2 && !t.counterHit[a.id] && t.side !== a.side) {
    t.counterHit[a.id] = 1;
    cm = t.st.counter.val * (1 + (t.sc.nin || 0) * 0.1);
    if (t.st.taunt) { cm *= 1.3; S.stats.reactions++; bnEv(S, 'react', { id: 'rx_taunt_counter', name: '嘲諷反擊', tgt: a.id }); }
    bnHit(S, t, a, { ty: 'phys', mul: cm, counter: true, kind: 'counter', sk: null });
  }
  if (!t.alive) return;
  // 蓄力層數(受擊)
  if (t.stackCfg) bnStackGain(S, t, 'on_hit');
  bnFire(S, 'on_hit', { u: a, t: t });
  if (t.alive && t.hp < t.maxHp * 0.3) bnFire(S, 'hp_below_30', { u: a, t: t });
  if (t.alive && a && t.timidVs && t.timidVs[a.fig] && S.rng() < t.timidVs[a.fig]) bnStatusApply(S, null, t, 'timid', { left: 1 }, {});   // 缺陷:遇到剋星腿軟
  bnBondEvent(S, 'on_hit', { u: t, attacker: a });
  if (t.alive && t.hp / t.maxHp < 0.5) bnBondEvent(S, 'hp_below', { u: t, attacker: a });
  t.targetedRound = true;
}
function bnOnAttack(S, u, t, res) {
  if (!u.alive) return;
  bnFire(S, 'on_attack', { u: u, t: t });
  bnBondEvent(S, 'on_attack', { u: u, t: t });
}
function bnOnKill(S, a, t, h) {
  var adj, i, list, p;
  if (a && a.alive) {
    if (a.stackCfg) bnStackGain(S, a, 'on_kill');
    bnFire(S, 'on_kill', { u: a, t: t });
    bnFire(S, 'on_ally_kill', { u: a, t: t });
    bnBondEvent(S, 'on_ko', { u: a, t: t });
  }
  bnFire(S, 'on_ally_down', { u: a, t: t });
  bnFire(S, 'on_death', { u: a, t: t });
  bnBondEvent(S, 'on_ally_ko', { u: t, killer: a });
  // 潰散:威懾蔓延
  if (t.st.fear || (t.hadFear)) {
    list = S.teams[t.side].units.filter(function (x) { return x.alive && x.row === t.row && Math.abs(x.col - t.col) === 1; });
    if (list.length && S.rng() < 0.5) { bnStatusApply(S, a, list[0], 'fear', { act: true, skip: 0.2 }, {}); S.stats.reactions++; }
  }
  // 召喚物不隨死亡
}
function bnStackGain(S, u, evt) {
  var i, c;
  for (i = 0; i < u.stackCfg.length; i++) {
    c = u.stackCfg[i];
    if (c.gainOn !== evt) continue;
    if (c.cond === 'not_targeted' && u.targetedRound) continue;
    u.sc[c.key] = Math.min(c.max, (u.sc[c.key] || 0) + 1);
  }
}

// ───────── 追擊 ─────────
// 每個追擊戰法各自擲骰(可同時觸發多個);回傳發動數
function bnTryPursuit(S, u, target) {
  var i, inst, d, ch = S.chain, n = 0, rate, ok;
  if (!u.alive || S.over) return 0;
  for (i = 0; i < u.act.length && u.alive && !S.over; i++) {
    inst = u.act[i]; d = inst.def;
    if (d.cat !== 'pursuit' || inst.cd > 0) continue;
    if (!bnUseful(S, u, inst)) continue;
    rate = bnRateOf(S, u, inst); ok = S.rng() < rate;
    S.stats.rolls++; if (ok) S.stats.rollOk++;
    bnEv(S, 'roll', { u: u.id, id: d.id, p: Math.round(rate * 100), ok: ok ? 1 : 0 });
    if (!ok) continue;
    if (ch.step >= BN_DATA.chain.stepCap) { S.stats.chainCap++; bnEv(S, 'chaincap', { n: ch.step }); return n; }
    ch.step++; ch.dv++;
    bnEv(S, 'chain', { n: ch.step, k: 'pursuit' });
    var forced = (d.params && d.params.sameTarget && target && target.alive && target.side !== u.side) ? target : null;
    if (bnCast(S, u, inst, { forced: forced, pursuit: true })) n++;
    ch.dv--;
  }
  return n;
}

// ───────── 行動佇列 / 補刀 / 追加行動 ─────────
function bnQueueExtra(S, t, normalOnly, force) {
  if (!t.alive || bnCantAct(t)) return;
  if (!force && ((S.cnt.extraUnit[t.id] || 0) >= BN_DATA.chain.extraActionPerUnit || S.cnt.extraTeam[t.side] >= BN_DATA.chain.extraActionPerTeam)) return;
  if ((S.cnt.extraUnit[t.id] || 0) >= BN_DATA.chain.extraActionPerUnit) return;
  S.cnt.extraUnit[t.id] = (S.cnt.extraUnit[t.id] || 0) + 1;
  S.cnt.extraTeam[t.side]++;
  S.extraQ.push({ u: t, normalOnly: normalOnly });
}
function bnQueueAssists(S, u, sk, res, o) {
  var combos = BN_COMBOS.assist.combos, gd = BN_COMBOS.assist, i, c, list = [], as, tgt, hpOk, rate, ch = S.chain;
  if (ch.depth >= BN_DATA.chain.maxDepth) return;
  tgt = res && res.main ? res.main.filter(function (x) { return x.alive && x.side !== u.side; })[0] : null;
  for (i = 0; i < combos.length; i++) {
    c = combos[i];
    var generic = c.casters[0].indexOf('ally:') === 0;
    if (!generic && c.casters.indexOf(u.fig) < 0) continue;
    if (generic && c.casters[0] !== 'ally:any' && u.troop !== c.casters[0].slice(5)) continue;
    if (c.on && c.on.cast && c.on.cast !== 'active' && c.on.cast !== sk.id) continue;
    if (c.on && c.on.castKind && c.on.castKind.indexOf(sk.kind) < 0) continue;
    if (c.on && c.on.castTag && !(sk.tags && sk.tags.indexOf(c.on.castTag) >= 0)) continue;
    if (c.on && c.on.cast === 'active' && sk.cat !== 'active' && sk.cat !== 'ult') continue;
    as = null;
    if (c.assister && c.assister.fig) as = S.units.filter(function (x) { return x.side === u.side && x.alive && x.fig === c.assister.fig && x !== u; })[0];
    else if (c.assister && (c.assister.hasKind || c.assister.troop)) {
      as = S.units.filter(function (x) {
        if (x.side !== u.side || !x.alive || x === u) return false;
        if (c.assister.troop && x.troop !== c.assister.troop) return false;
        if (c.assister.row === 'same' && x.row !== u.row) return false;
        if (c.assister.hasKind && !x.act.concat(x.pas).some(function (it) { return it.def.kind === c.assister.hasKind; })) return false;
        return true;
      });
      as.sort(function (p, q) { return bnSpd(S, q) - bnSpd(S, p); });
      as = as[0];
    }
    if (!as && c.assister && c.assister.bond) {
      as = S.units.filter(function (x) { return x.side === u.side && x.alive && x !== u && x.fig && c.casters.indexOf(x.fig) >= 0; });
      as.sort(function (p, q) { return bnSpd(S, q) - bnSpd(S, p); });
      as = as[0];
    }
    if (!as) continue;
    list.push({ c: c, as: as });
  }
  list.sort(function (p, q) { return bnSpd(S, q.as) - bnSpd(S, p.as); });
  for (i = 0; i < list.length; i++) {
    c = list[i].c; as = list[i].as;
    if ((S.cnt.assist[as.id] || 0) >= BN_DATA.chain.followUpPerUnit) continue;
    if (bnCantAct(as)) continue;
    if (c.on.targetStatus && tgt) {
      var any = (c.on.match === 'any');
      var okS = any ? c.on.targetStatus.some(function (s) { return bnRxHasStatus(tgt, s); }) : c.on.targetStatus.every(function (s) { return bnRxHasStatus(tgt, s); });
      if (!okS) continue;
    } else if (c.on.targetStatus && !tgt) continue;
    if (c.on.targetHpBelow !== undefined && (!tgt || tgt.hp / tgt.maxHp >= c.on.targetHpBelow)) continue;
    if (c.on.extra) {
      var m = /兵力\s*<\s*(\d+)%/.exec(c.on.extra);
      if (m && u.hp / u.maxHp >= (+m[1]) / 100) continue;
      if (/積怨/.test(c.on.extra) && (u.yuan || 0) >= 2) continue;
    }
    rate = c.rate / 100;
    if (sk.cat === 'ult') rate *= BN_DATA.chain.ultAssistMul;
    if (as.st.fear) rate *= 0.5;
    if (c.action.type === 'basic' && as.st.timid) continue;
    if (c.action.type === 'skill_small' && as.st.silence) continue;
    if (S.rng() < rate) {
      S.cnt.assist[as.id] = (S.cnt.assist[as.id] || 0) + 1;
      ch.queue.push({ k: 'assist', u: as, c: c, by: u, target: tgt, depth: ch.depth + 1, ult: sk.cat === 'ult' });
    }
  }
}
function bnDrain(S) {
  var ch = S.chain, q, p, t, mul, res, inst, fall;
  while (ch.queue.length && !S.over) {
    if (ch.step >= BN_DATA.chain.stepCap) { S.stats.chainCap++; bnEv(S, 'chaincap', { n: ch.step }); ch.queue = []; break; }
    q = ch.queue.shift();
    if (!q.u.alive) continue;
    ch.step++; ch.dv++; ch.depth = q.depth || 0;
    bnEv(S, 'chain', { n: ch.step, k: q.k });
    if (q.k === 'recast') {
      if (!q.u.st.stun) { S.stats.recasts++; bnCast(S, q.u, q.inst, { recastN: q.n, scale: q.scale, noCd: true, noAssist: true }); }
    } else if (q.k === 'assist') {
      S.stats.assists++;
      bnRunAssist(S, q);
    } else if (q.k === 'follow') {
      S.stats.bondFires++;
      t = q.target && q.target.alive ? q.target : null;
      if (!t) { p = bnEnemies(S, q.u); t = bnLowestHp(p.filter(function (x) { return bnRank(S, x) === 1; })) || bnLowestHp(p); }
      if (t) {
        mul = BN_DATA.followMul[q.power] || 0.6;
        bnEv(S, 'skill', { u: q.u.id, id: 'follow', name: '協同追擊', kind: 'follow', cat: 'bond' });
        bnHitWithRx(S, q.u, t, { ty: q.u.troop === '謀' ? 'strat' : 'phys', mul: mul, kind: 'follow', sk: q.tag ? { id: 'follow', cat: 'bond', tags: [q.tag] } : null, basic: false });
      }
    }
    ch.dv--;
    ch.depth = 0;
  }
}
function bnRunAssist(S, q) {
  var u = q.u, c = q.c, t = q.target, p, sk, inst, mul;
  if (!t || !t.alive || t.side === u.side) {
    p = bnEnemies(S, u);
    t = bnLowestHp(p.filter(function (x) { return bnRank(S, x) === 1; })) || bnLowestHp(p);
  }
  if (!t) return;
  if (c.action.type === 'skill_small') {
    inst = null;
    for (var i = 0; i < u.act.length; i++) if (u.act[i].def.id === c.action.skill) inst = u.act[i];
    if (!inst && BN_SKILLS[c.action.skill]) inst = { def: BN_SKILLS[c.action.skill], cd: 0, prepLeft: 0, owner: u };
    if (inst && BN_ATTACK[inst.def.kind]) {
      bnCast(S, u, inst, { assistBy: q.by.id, scale: BN_DATA.chain.assistSmallMul * (q.ult ? BN_DATA.chain.ultAssistMul : 1), noCd: true, noAssist: true, forced: t });
      return;
    }
  }
  mul = BN_DATA.chain.assistBasicMul * (q.ult ? BN_DATA.chain.ultAssistMul : 1);
  bnEv(S, 'skill', { u: u.id, id: c.id, name: c.name, kind: 'assist', cat: 'assist', as: q.by.id });
  var tag = c.action.tag;
  bnHitWithRx(S, u, t, { ty: c.action.dmgType || (u.troop === '謀' ? 'strat' : 'phys'), mul: mul, kind: 'assist', basic: true, sk: tag ? { id: c.id, cat: 'assist', tags: [tag] } : null });
}

// ───────── 觸發(被動 / 指揮 trigger) ─────────
function bnPasTargetEff(S, o, inst, ctx, trig) {
  var d = inst.def, P = d.params || {}, tg = P.target || d.target, kind = d.kind;
  if (!tg) {
    if (kind === 'heal_hot' || kind === 'heal_all' || kind === 'shield_all' || kind === 'buff_all' || kind === 'rate_up') tg = 'ally_all';
    else if (kind === 'mark' || kind === 'debuff_atk' || kind === 'debuff_def' || kind === 'debuff_spd' || kind === 'dot_burn' || kind === 'dot_poison' || kind === 'dot_bleed' || kind === 'silence' || kind === 'stun' || kind === 'fear' || kind === 'rate_down' || kind === 'debuff_hit' || kind === 'sleep' || kind === 'paralyze') tg = 'enemy_one';
    else tg = 'self';
  }
  return { kind: kind, power: d.power, dmg: d.dmg, params: P, target: tg, sk: d };
}
function bnFire(S, trig, ctx) {
  var i, j, o, inst, P, ok, list = S.units, scale, eff, res, tg, other;
  if (S.over) return;
  for (i = 0; i < list.length; i++) {
    o = list[i];
    if (!o.alive && trig !== 'on_death') continue;
    for (j = 0; j < o.pas.length; j++) {
      inst = o.pas[j]; P = inst.def.params || {};
      if (P.trigger !== trig || inst.vsSkip) continue;
      switch (trig) {
        case 'turn_start': case 'turn_end': case 'battle_start': ok = true; break;
        case 'on_attack': ok = ctx.u === o; break;
        case 'on_hit': ok = ctx.t === o && o.alive; break;
        case 'on_kill': ok = ctx.u === o || (inst.def.kind === 'execute_chain' && ctx.u && ctx.u.side === o.side); break;
        case 'on_ally_kill': ok = ctx.u && ctx.u !== o && ctx.u.side === o.side && o.alive && inst.def.kind !== 'execute_chain'; break;
        case 'on_ally_down': ok = ctx.t && ctx.t !== o && ctx.t.side === o.side && o.alive; break;
        case 'on_death': ok = ctx.t === o; break;
        case 'on_ally_cast': ok = ctx.u && ctx.u !== o && ctx.u.side === o.side && o.alive; break;
        case 'hp_below_30': ok = ctx.t === o && o.alive && !inst.hpFired; if (ok) inst.hpFired = true; break;
        default: ok = false;
      }
      if (!ok) continue;
      if (typeof P.rounds === 'number' && inst.def.cat === 'command' && inst.fires >= P.rounds && trig === 'turn_start') continue;
      if (P.perRound && inst.fireRound === S.round && inst.fireCnt >= (typeof P.perRound === 'number' ? P.perRound : 1)) continue;
      if (inst.fireRound !== S.round) { inst.fireRound = S.round; inst.fireCnt = 0; }
      inst.fireCnt++; inst.fires++;
      if (S.chain && S.chain.depth >= BN_DATA.chain.maxDepth && (BN_ATTACK[inst.def.kind])) continue;
      bnRunPassive(S, o, inst, ctx, trig);
      if (S.over) return;
    }
  }
}
function bnRunPassive(S, o, inst, ctx, trig) {
  var d = inst.def, P = d.params || {}, eff, res, sc, kind = d.kind, tg, i, ex;
  bnEv(S, 'trigger', { u: o.id, id: d.id, trig: trig });
  if (kind === 'execute_chain') {
    var killer = ctx.u && ctx.u.alive ? ctx.u : o;
    killer.killStack = Math.min((P.stackMax || 3), (killer.killStack || 0) + 1);
    return;
  }
  if (kind === 'stack_charge') return;
  sc = P.passiveMul !== undefined ? P.passiveMul : (kind === 'heal_hot' ? 1 : (d.cat === 'command' ? BN_DATA.passiveMul : BN_DATA.passiveMul));
  eff = bnPasTargetEff(S, o, inst, ctx, trig);
  res = { main: null, kills: [], hits: 0, dmg: 0 };
  // 敵方目標且有「攻擊者」脈絡 → 打攻擊者
  if (/^enemy_/.test(eff.target) && ctx.u && ctx.u.side !== o.side && ctx.u.alive && (trig === 'on_hit')) { res.main = [ctx.u]; eff.target = 'same'; }
  if (kind === 'heal_hot') { res.instant = true; }
  bnApplyEffect(S, o, eff, res, { scale: sc, passive: true, instant: kind === 'heal_hot', perm: false });
  S.chain && 0;
  if (P.extra) {
    for (i = 0; i < P.extra.length; i++) {
      ex = P.extra[i];
      if (ex.params && ex.params.trigger) continue;
      bnApplyEffect(S, o, { kind: ex.kind, power: ex.power || d.power, params: ex.params || {}, target: ex.target || 'self', sk: d, filter: ex.filter, isExtra: true }, res, { scale: sc, passive: true });
    }
  }
}

// ───────── 對象條件 vs(針對特定對象)/ 五行 / 新 kind 輔助(戰鬥改版 2026-11-06) ─────────
// vs = {mode:'attack'|'defend'|'both'|'ally', fig?, tag?, troop?, fac?, status?, bonus:{stat:'dmg'|'crit'|'rate'|'spd'|'chance'|'dur'|'dmgTaken', mult}}
function bnFigHasTag(fig, tag) {
  var L, f;
  if (!fig) return false;
  L = BN_DATA.figTags[tag];
  if (L) return L.indexOf(fig) >= 0;
  if (tag === 'warrior') { f = typeof CARD_FIG_BY_ID !== 'undefined' ? CARD_FIG_BY_ID[fig] : null; return !!(f && f.st[1] >= 90); }
  return false;
}
function bnVsMatch(S, vs, x) {
  if (!vs || !x) return false;
  if (vs.fig && vs.fig.indexOf(x.fig) >= 0) return true;
  if (vs.tag && vs.tag.some(function (g) { return bnFigHasTag(x.fig, g); })) return true;
  if (vs.troop && vs.troop.indexOf(x.troop) >= 0) return true;
  if (vs.fac && vs.fac.indexOf(x.fac) >= 0) return true;
  if (vs.status && x.st && vs.status.some(function (k) { return !!x.st[BN_ALIAS[k] || k]; })) return true;
  return false;
}
// bonus.mult → 數值:檔位 S/M/L/XL(前綴 - 為減少;減傷取一半)、'+10'(百分點)、'50%'、數字
function bnVsVal(stat, mult) {
  var V = BN_DATA.vs, m = mult, n, neg = false, tb;
  if (typeof m === 'number') return (stat === 'dur' || stat === 'spd') ? m : (m > 1 ? m / 100 : m);
  m = String(m === undefined ? 'M' : m).replace('−', '-');
  if (/^[+-]?\d+(\.\d+)?%?$/.test(m)) { n = parseFloat(m); return (stat === 'dur' || stat === 'spd') ? n : n / 100; }
  if (m.charAt(0) === '-') { neg = true; m = m.slice(1); }
  tb = stat === 'crit' ? V.crit : stat === 'chance' ? V.chance : stat === 'dmgTaken' ? V.taken : stat === 'spd' ? V.spd : stat === 'rate' ? { S: 0.05, M: 0.10, L: 0.15, XL: 0.20 } : stat === 'dur' ? { S: 1, M: 1, L: 2, XL: 2 } : V.dmg;
  n = tb[m] !== undefined ? tb[m] : tb.M;
  return neg ? -n * (stat === 'dmgTaken' ? 0.5 : 1) : n;
}
var BN_VS_ONLY = { buff_atk: 1, buff_def: 1, buff_spd: 1, buff_crit: 1, debuff_atk: 1, debuff_def: 1, rate_up: 1 };   // 被動帶對象條件時,這些 kind 只在條件成立才生效
// 開戰時整理每人的對象條件:單位規則 u.vsRules(攻擊 / 防守時檢查)、戰法實例加成(vsRate / vsScale / vsCrit)、被動是否只在條件成立時生效(vsSkip)
function bnVsSetup(S) {
  S.units.forEach(function (u) {
    u.act.concat(u.pas).forEach(function (inst) {
      var d = inst.def, vs = d.vs, b, val, pas, matched, rule;
      if (!vs || !vs.bonus) return;
      b = vs.bonus; val = bnVsVal(b.stat, b.mult); pas = d.cat === 'passive' || d.cat === 'command';
      if (vs.mode === 'defend' || ((vs.mode === 'attack' || vs.mode === 'both') && pas)) {
        rule = { m: vs.mode === 'defend' ? 'def' : (vs.mode === 'both' ? 'both' : 'atk'), vs: vs, stat: b.stat, val: val, kind: d.kind, pct: /%$/.test(String(b.mult)) };
        (u.vsRules = u.vsRules || []).push(rule);
        if (b.stat === 'spd' && rule.m !== 'def') u.vsSpd = true;
        if (pas && d.cat === 'passive' && BN_VS_ONLY[d.kind]) inst.vsSkip = true;
        return;
      }
      if (vs.mode !== 'ally') return;
      matched = bnAllies(S, u, false).filter(function (x) { return bnVsMatch(S, vs, x); });
      if (!matched.length) { if (d.cat === 'passive' && d.kind !== 'self_sacrifice') inst.vsSkip = true; return; }
      if (d.cat === 'passive' && d.target === 'ally_one') inst.vsTarget = matched[0];
      if (b.stat === 'rate') {
        if (pas) { matched.forEach(function (x) { x.mods.rateBonus = (x.mods.rateBonus || 0) + val; }); if (d.kind === 'rate_up' && d.cat === 'passive') inst.vsSkip = true; }
        else inst.vsRate = val;
      } else if (b.stat === 'dmg') inst.vsScale = 1 + val * (vs.tag || vs.fac ? Math.min(matched.length, 4) * 0.5 : 1);
      else if (b.stat === 'crit') inst.vsCrit = val * Math.min(matched.length, 3);
      else if (b.stat === 'spd') (pas && /^buff_/.test(d.kind) ? [u] : matched).forEach(function (x) { bnStatusApply(S, u, x, 'spd_up', { val: val, left: 999, force: true }, {}); });
    });
  });
}
function bnVsHit(S, a, t, h) {
  var out = 1, crit = 0, taken = 0, i, r, sk = h.vsSk, W = BN_DATA.wx, any = false;
  if (!a || h.dot) return null;
  function add(stat, v) { any = true; if (stat === 'dmg') out *= 1 + v; else if (stat === 'crit') crit += v; }
  if (sk && sk.bonus && (sk.mode === 'attack' || sk.mode === 'both') && bnVsMatch(S, sk, t)) add(sk.bonus.stat, bnVsVal(sk.bonus.stat, sk.bonus.mult));
  if (a.vsRules) for (i = 0; i < a.vsRules.length; i++) { r = a.vsRules[i]; if (r.m !== 'def' && bnVsMatch(S, r.vs, t)) add(r.stat, r.val); }
  if (t.vsRules) for (i = 0; i < t.vsRules.length; i++) {
    r = t.vsRules[i];
    if (r.m === 'atk' || !bnVsMatch(S, r.vs, a)) continue;
    any = true;
    if (r.stat === 'dmgTaken') taken += r.val;
    else if (r.m === 'both') taken -= BN_DATA.vs.bothCut;
  }
  if (h.vsCrit) { any = true; crit += h.vsCrit; }
  if (h.wx) {   // 五行:剋對方屬性加成;目標帶『被我剋』的五行印 → 再加成並消耗
    if (t.el && W.beats[h.wx] === t.el) { any = true; out *= 1 + W.over; }
    if (t.st.wx_mark && W.beats[h.wx] === t.st.wx_mark.el) { any = true; out *= 1 + W.mark; bnStatusRemove(S, t, 'wx_mark', 'wx'); }
  }
  return any ? { out: out, crit: crit, taken: taken } : null;
}
function bnVsSpd(S, u) {
  var v = 0, i, r, en;
  if (!u.vsRules) return 0;
  for (i = 0; i < u.vsRules.length; i++) {
    r = u.vsRules[i];
    if (r.stat !== 'spd' || r.m === 'def') continue;
    en = S.teams[bnOpp(u.side)].units;
    if (en.some(function (x) { return x.alive && bnVsMatch(S, r.vs, x); })) v += r.val;
  }
  return v;
}
// 被特定敵人攻擊時機率閃開(規避 / 隱匿類被動的對象條件)
function bnVsDodge(S, a, t) {
  var i, r, p;
  for (i = 0; i < t.vsRules.length; i++) {
    r = t.vsRules[i];
    if (r.m !== 'def' || r.stat !== 'chance' || (r.kind !== 'evade' && r.kind !== 'stealth') || !bnVsMatch(S, r.vs, a)) continue;
    p = r.pct ? r.val : Math.min(0.6, r.val * 0.5);
    if (S.rng() < p) return true;
  }
  return false;
}
// 特定敵人施加的負面狀態被擋下(抵禦 / 免疫類被動的對象條件)
function bnVsBlock(S, src, t) {
  var i, r;
  for (i = 0; i < t.vsRules.length; i++) {
    r = t.vsRules[i];
    if (r.m !== 'def' || r.stat !== 'chance' || (r.kind !== 'resist' && r.kind !== 'immune') || !bnVsMatch(S, r.vs, src)) continue;
    if (r.val >= 1 || S.rng() < r.val) return true;
  }
  return false;
}
// 施放者對目標的「狀態機率」加成(1 = 必中,無視抵禦 / 抵抗)
function bnVsChanceTo(S, u, t) {
  var v = 0, e = S.curEff, vs, i, r;
  if (!u || !t || u.side === t.side) return 0;
  if (e && S.curEffU === u && e.sk && e.sk.vs) {
    vs = e.sk.vs;
    if (vs.bonus && vs.bonus.stat === 'chance' && (vs.mode === 'attack' || vs.mode === 'both') && bnVsMatch(S, vs, t)) v = Math.max(v, bnVsVal('chance', vs.bonus.mult));
  }
  if (u.vsRules) for (i = 0; i < u.vsRules.length; i++) { r = u.vsRules[i]; if (r.m !== 'def' && r.stat === 'chance' && bnVsMatch(S, r.vs, t)) v = Math.max(v, r.val); }
  return v;
}
function bnVsDur(S, eff, t) {
  var vs = eff.sk && eff.sk.vs;
  if (!vs || !vs.bonus || vs.bonus.stat !== 'dur' || vs.mode !== 'attack' || !bnVsMatch(S, vs, t)) return 0;
  return bnVsVal('dur', vs.bonus.mult);
}
// 對象條件為狀態(隱匿 / 規避)且加成為機率:拆穿並移除該狀態(楊修絕妙好辭)
function bnVsStrip(S, u, vs, targets) {
  var i;
  if (vs.mode !== 'attack' || !vs.status || !vs.bonus || vs.bonus.stat !== 'chance') return;
  for (i = 0; i < targets.length; i++) {
    if (targets[i].side === u.side) continue;
    if (vs.status.indexOf('stealth') >= 0) bnStatusRemove(S, targets[i], 'stealth', 'expose');
    if (vs.status.indexOf('evade') >= 0) bnStatusRemove(S, targets[i], 'evade', 'expose');
  }
}
// 連擊段數:hits = 數字或 '2-4';scaleBy 'spd' = 看攻速(速度每高 20 多 1 段,不超過上限)
function bnHitsOf(S, u, P) {
  var h = P.hits, lo, hi, n;
  if (typeof h === 'string' && /^\d+-\d+$/.test(h)) { lo = +h.split('-')[0]; hi = +h.split('-')[1]; }
  else { lo = typeof h === 'number' ? h : 3; hi = lo + (P.scaleBy === 'spd' ? 1 : 0); }
  if (P.scaleBy !== 'spd') return lo;
  n = lo + Math.floor(Math.max(0, bnSpd(S, u) - 80) / 20);
  return Math.min(hi, n);
}
// 偷取增益:從目標移除最多 n 個增益,轉給 giveTo(self / ally_all …)
function bnBuffSteal(S, u, t, n, giveTo, prefer, res, o) {
  var got = [], list = BN_BUFFS.slice(), i, id, st, recv, d, pid;
  if (prefer) { pid = { buff_atk: 'atk_up', buff_def: 'def_up', buff_spd: 'spd_up', buff_crit: 'crit_up' }[prefer] || prefer; list.sort(function (a, b) { return (a === pid ? -1 : 0) - (b === pid ? -1 : 0); }); }
  for (i = 0; i < list.length && got.length < n; i++) {
    id = list[i]; st = t.st[id];
    if (!st || (st.left >= 900 && id !== 'ward')) continue;
    got.push({ id: id, d: JSON.parse(JSON.stringify(st)) });
    bnStatusRemove(S, t, id, 'steal');
  }
  if (got.length < n && t.st.shield) { got.push({ id: 'shield', d: { val: t.st.shield.val } }); bnStatusRemove(S, t, 'shield', 'steal'); }
  if (!got.length) return 0;
  recv = giveTo === 'self' ? [u] : bnTargetsFor(S, u, { kind: 'x', target: giveTo, params: {} }, res, o);
  if (!recv.length) recv = [u];
  for (i = 0; i < got.length; i++) {
    t = recv[i % recv.length]; d = got[i].d;
    if (got[i].id === 'shield') { bnShield(S, u, t, d.val, {}); continue; }
    if (got[i].id === 'ward') { bnGrantWard(S, u, t, d.layers || 1, d.guard || 'any', BN_DATA.ward.dur); continue; }
    delete d.src; d.left = Math.max(1, Math.min(d.left || 2, 3)); d.force = true;
    bnStatusApply(S, u, t, got[i].id, d, { noExtend: true });
  }
  S.stats.steals = (S.stats.steals || 0) + got.length;
  return got.length;
}
// 陰陽互換:敵方增益 → 同值減益;我方減益 → 同值增益(其餘負面直接解除)
function bnInvert(S, u, t, n, dir) {
  var PAIR = { atk_up: 'atk_down', def_up: 'def_down', spd_up: 'spd_down', rate_up: 'rate_down' }, REV = { atk_down: 'atk_up', def_down: 'def_up', spd_down: 'spd_up', rate_down: 'rate_up' }, map, c = 0, k, st, val, left;
  dir = dir || (t.side !== u.side ? 'enemy_buff_to_debuff' : 'ally_debuff_to_buff');
  map = dir === 'enemy_buff_to_debuff' ? PAIR : REV;
  for (k in map) {
    if (c >= n) break;
    st = t.st[k];
    if (!st || st.left >= 900) continue;
    val = st.val; left = Math.max(1, st.left || 1);
    bnStatusRemove(S, t, k, 'invert');
    bnStatusApply(S, u, t, map[k], { val: val, left: left, noRes: true, force: true }, { noExtend: true });
    c++;
  }
  if (c < n && dir === 'enemy_buff_to_debuff') ['crit_up', 'evade', 'counter'].forEach(function (id) { if (c < n && t.st[id] && !(t.st[id].left >= 900)) { bnStatusRemove(S, t, id, 'invert'); c++; } });
  if (c < n && dir !== 'enemy_buff_to_debuff') c += bnCleanse(S, t, n - c, null);
  if (c > 0) { bnEv(S, 'react', { id: 'rx_invert', name: '陰陽互換', tgt: t.id }); S.stats.reactions++; }
  return c;
}

// ───────── 開戰設定:被動 / 指揮 / 羈絆 ─────────
function bnPasteMods(u, P) {
  if (P.weakness) { u.mods.weakness = u.mods.weakness || {}; P.weakness.forEach(function (w) { if (!w.dur) u.mods.weakness[w.type] = w.mult; }); }
  if (P.flaw) P.flaw.forEach(function (f) { if (f.id === 'late_dmg_taken') u.mods.lateTaken = (u.mods.lateTaken || 0) + 0.1; if (f.id === 'timid_vs' && f.fig) { u.timidVs = u.timidVs || {}; u.timidVs[f.fig] = (f.chance || 50) / 100; }
    if (f.id === 'self_timid') u.selfTimid = (f.chance || 20) / 100;   // 曹植醉臥:每回合開始有機率怯戰
    if (f.id === 'random_power') u.randPow = [f.min !== undefined ? f.min : 0.5, f.max !== undefined ? f.max : 1.5];   // 馬謖言過其實:效果隨機倍率
    if (f.id === 'suspected_by' && f.fig) u.suspect = { fig: f.fig, p: (f.chance || 15) / 100 }; });   // 楊修:主公在我方時每回合可能被猜忌
}
function bnSetupBattle(S) {
  var order = S.units.slice(), i, j, o, inst, d, P, kind, eff, res, cat, trig, tg, pm, ex;
  order.sort(function (a, b) {
    var sa = bnSpd(S, a), sb = bnSpd(S, b);
    if (sa !== sb) return sb - sa;
    if (a.side !== b.side) return a.side === 'A' ? -1 : 1;
    if (a.row !== b.row) return a.row - b.row;
    return a.col - b.col;
  });
  // 偵測治療者
  S.units.forEach(function (x) {
    var all = x.act.concat(x.pas).concat(x.ult ? [x.ult] : []);
    all.forEach(function (it) {
      if (it.def.kind === 'resist' || (it.def.params && (it.def.params.resist || it.def.params.immuneHealBlock))) S.stats.hasWard[x.side] = true; if (it.def.cat !== 'passive' && /^heal_[sah]|^revive/.test(it.def.kind)) S.stats.hasHealer[x.side] = true; if (it.def.kind === 'heal_reduce' || (it.def.params && it.def.params.healBlock)) { S.stats.hasHB[x.side] = true; if (!x.hbCounted) { x.hbCounted = true; S.stats.hbSrc[x.side]++; } } });
  });
  bnSetupBonds(S);
  bnVsSetup(S);
  for (i = 0; i < order.length; i++) {
    o = order[i];
    // 開場陣型 / 詞條:疑兵
    if (o.mods.opening === 'yibing') {
      bnApplyEffect(S, o, { kind: 'debuff_atk', power: 'S', params: { rounds: 1 }, target: 'enemy_all', sk: null }, { main: null, kills: [] }, { rounds: 1 });
    }
    for (j = 0; j < o.pas.length; j++) {
      inst = o.pas[j]; d = inst.def; P = d.params || {}; kind = d.kind; cat = d.cat;
      bnPasteMods(o, P);
      if (inst.vsSkip) continue;   // 對象條件不成立(或只在對特定對象時才生效)
      // 帶 trigger 的附帶效果註冊成獨立被動
      if (P.extra) P.extra.forEach(function (ex2, idx) {
        if (ex2.params && ex2.params.trigger) {
          o.pas.push({ def: { id: d.id + '_x' + idx, name: d.name, cat: 'passive', kind: ex2.kind, power: ex2.power || d.power, target: ex2.target || 'self', params: ex2.params, fig: d.fig }, cd: 0, prepLeft: 0, fires: 0, owner: o });
        }
      });
      if (kind === 'stack_charge') {
        o.stackCfg = o.stackCfg || [];
        o.stackCfg.push({ key: P.stat === 'nin' ? 'nin' : P.stat, gainOn: P.gainOn, cond: P.cond, max: P.max || 3 });
        if (P.stat === 'nin') { o.stackCfg[o.stackCfg.length - 1].key = 'nin'; }
        // 隱忍:反擊層數同時給 atk 加成以表示越忍越強
        if (P.stat === 'nin') o.stackCfg[o.stackCfg.length - 1].key = 'nin';
        if (P.extra) P.extra.forEach(function (ex2) { if (ex2.kind === 'counter') bnApplyEffect(S, o, { kind: 'counter', power: ex2.power || 'S', params: {}, target: 'self', sk: d }, { main: null, kills: [] }, { scale: 1, perm: true }); });
        continue;
      }
      if (kind === 'stat_mod') { pm = P.mod || {}; if (pm.takenPct) o.mods.takenPct = (o.mods.takenPct || 0) + pm.takenPct / 100; continue; }
      if (kind === 'immune') { bnApplyEffect(S, o, { kind: 'immune', power: d.power, params: P, target: 'self', sk: d }, { main: null, kills: [] }, { perm: true }); }
      if (P.trigger && P.trigger !== 'battle_start') {
        if (P.immuneHealBlock) o.immunes.push({ types: ['heal_block'], rate: P.immuneHealBlock.rate / 100, charges: P.immuneHealBlock.charges });
        continue;
      }
      if (P.immuneHealBlock) o.immunes.push({ types: ['heal_block'], rate: P.immuneHealBlock.rate / 100, charges: P.immuneHealBlock.charges });
      if (kind === 'revive' && P.once) { o.reviveOnce = bnKT('revive', d.power) || 0.2; continue; }
      if (kind === 'undying') { bnApplyEffect(S, o, { kind: 'undying', power: d.power, params: P, target: 'self', sk: d }, { main: null, kills: [] }, { perm: true }); if (P.extra) bnSetupExtras(S, o, d, P, true); continue; }
      if (kind === 'execute_chain' || kind === 'immune') continue;
      if (kind === 'guard' && !P.rounds) { bnSetupPassiveGuard(S, o, d, P); continue; }
      if (kind === 'counter' && cat === 'passive') { bnStatusApply(S, o, o, 'counter', { val: bnKT('counter', d.power) * BN_DATA.passiveMul * 2, left: 999, force: true }, {}); continue; }
      if (kind === 'lifesteal') { bnStatusApply(S, o, o, 'lifesteal', { val: bnKT('lifesteal_pct', d.power) * 0.5, left: 999, act: true, force: true }, {}); continue; }
      if (kind === 'stealth') { bnApplyEffect(S, o, { kind: 'stealth', power: d.power, params: P, target: inst.vsTarget ? 'same' : 'self', sk: d }, { main: inst.vsTarget ? [inst.vsTarget] : null, kills: [] }, { perm: false }); if (P.extra) bnSetupExtras(S, o, d, P, cat === 'passive'); continue; }
      if (kind === 'cd_reduce') { bnSetupCdReduce(S, o, d, P); continue; }
      if (kind === 'revive' || kind === 'extra_turn' || kind === 'trap') continue;
      if (P.trigger === 'battle_start') continue;   // 由 bnFire('battle_start') 統一執行
      // 一般:指揮 = 開戰一次(數回合),被動 = 整場(×0.5)
      tg = P.target || d.target;
      eff = bnPasTargetEff(S, o, inst, {}, 'battle_start');
      res = { main: inst.vsTarget ? [inst.vsTarget] : null, kills: [] };
      if (inst.vsTarget) eff.target = 'same';
      var isPerm = cat === 'passive' && !BN_TEAM_INSTANT[kind];
      var oo = { scale: cat === 'passive' ? (P.passiveMul !== undefined ? P.passiveMul : BN_DATA.passiveMul) : 1, perm: isPerm, passive: true, rounds: cat === 'command' ? (typeof P.rounds === 'number' ? P.rounds : BN_DATA.defaultRounds) : undefined };
      if (kind === 'heal_hot' && P.trigger === undefined) oo.perm = false;
      if (BN_ATTACK[kind] && cat !== 'passive') { /* 指揮型攻擊不常見:開戰一次 */ }
      if (inst.vsScale) oo.scale *= inst.vsScale;
      bnApplyEffect(S, o, eff, res, oo);
      if (P.selfDebuff && P.selfDebuff.kind === 'heal_reduce') bnApplyHealBlock(S, o, o, P.selfDebuff.ratio || 100, P.selfDebuff.turns || 'battle');
      if (P.extra) bnSetupExtras(S, o, d, P, isPerm);
      if (kind === 'heal_hot' && cat === 'passive' && !P.trigger) { /* 無 trigger 的 heal_hot 被動:改為每回合末 */ }
    }
  }
  // 開戰指揮完成 → 觸發 battle_start 被動與羈絆
  bnFire(S, 'battle_start', {});
  bnBondEvent(S, 'battle_start', {});
}
var BN_TEAM_INSTANT = { heal_all: 1, shield_single: 1, shield_all: 1, cleanse: 1, revive: 1, heal_single: 1, resist: 1, buff_steal: 1, invert: 1 };
function bnSetupExtras(S, o, d, P, perm) {
  P.extra.forEach(function (ex) {
    if (ex.params && ex.params.trigger) return;
    bnApplyEffect(S, o, { kind: ex.kind, power: ex.power || d.power, params: ex.params || {}, target: ex.target || 'self', sk: d, filter: ex.filter, isExtra: true }, { main: null, kills: [] }, { scale: perm ? BN_DATA.passiveMul : 1, perm: perm, passive: true });
  });
}
function bnSetupPassiveGuard(S, o, d, P) {
  var prot = null, al = bnAllies(S, o, false), gd;
  if (P.protect && /_guards_self$/.test(P.protect)) {   // 由指定名人替自己承傷(甘夫人:趙雲護主)
    gd = al.filter(function (x) { return x.fig === P.protect.replace('_guards_self', ''); })[0];
    if (gd) bnStatusApply(S, gd, o, 'guard', { by: gd.id, val: Math.min(0.5, bnKT('guard', d.power) * BN_DATA.passiveGuardMul), left: 999, force: true }, {});
    return;
  }
  if (P.protect) prot = al.filter(function (x) { return x.fig === P.protect; })[0];
  if (!prot) prot = bnLowestHp(al);
  if (prot) bnStatusApply(S, o, prot, 'guard', { by: o.id, val: Math.min(0.5, bnKT('guard', d.power) * BN_DATA.passiveGuardMul), left: 999, force: true }, {});
}
function bnSetupCdReduce(S, o, d, P) {
  var scope = P.scope || 'all_skills', amt = typeof P.amount === 'number' ? P.amount : bnKT('cd_reduce', P.amount || d.power) * 0.5;
  var tl = [o], fb = P.fallback;
  if (scope.indexOf('fig:') === 0) {
    tl = bnAllies(S, o, false).filter(function (x) { return x.fig === scope.slice(4); });
    if (!tl.length) {
      if (fb) bnApplyEffect(S, o, { kind: fb.kind, power: fb.power, params: fb.params || {}, target: fb.target || 'ally_all', sk: d, filter: (fb.params || {}).filter }, { main: null, kills: [] }, { scale: BN_DATA.passiveMul, perm: true });
      return;
    }
  }
  tl.forEach(function (x) { x.act.forEach(function (it) { it.cdMinus = (it.cdMinus || 0) + Math.max(1, Math.round(amt)); }); });
}

// ───────── 羈絆(combos partB + fac*.json bonds) ─────────
function bnSetupBonds(S) {
  var sides = ['A', 'B'], bonds = BN_COMBOS.bonds, i, b, sd, mine, enemy, figsMine, figsEnemy;
  sides.forEach(function (side) {
    figsMine = S.teams[side].units.filter(function (x) { return x.fig; });
    figsEnemy = S.teams[bnOpp(side)].units.filter(function (x) { return x.fig; });
    var mineSet = {}, enemySet = {};
    figsMine.forEach(function (x) { mineSet[x.fig] = x; });
    figsEnemy.forEach(function (x) { enemySet[x.fig] = x; });
    for (i = 0; i < bonds.length; i++) {
      b = bonds[i];
      var cond = b.condition || {}, present = b.members.filter(function (m) { return mineSet[m]; }), active = false;
      if (cond.side === 'versus') {
        active = (cond.allySide || []).every(function (m) { return mineSet[m]; }) && (cond.enemySide || []).every(function (m) { return enemySet[m]; });
      } else {
        var need = cond.alive === 'all' || cond.alive === undefined ? b.members.length : cond.alive;
        active = present.length >= need && present.length >= 2;
        if (active && cond.required && !cond.required.every(function (m) { return mineSet[m]; })) active = false;
      }
      if (active) S.bonds.push({ b: b, side: side, members: present.map(function (m) { return mineSet[m].id; }), n: present.length });
    }
    // fac*.json 的 bonds → 偽被動(只在條件成立時加入)
    figsMine.forEach(function (x) {
      var fb = BN_FIG_SKILLS[x.fig] && BN_FIG_SKILLS[x.fig].bonds;
      if (!fb) return;
      fb.forEach(function (bd) {
        // 去重:與 combos partB 同成員(或被其涵蓋)的組合以 partB 為準,略過 fac 內 bonds,避免雙重加成
        var setK = bd.members.concat([x.fig]);
        if (BN_COMBOS.bonds.some(function (pb) { return setK.every(function (m) { return pb.members.indexOf(m) >= 0; }); })) return;
        var pres = bd.members.filter(function (m) { return mineSet[m]; }), need = bd.need, okb;
        okb = need === 'all' ? pres.length === bd.members.length : (need === 'any' ? pres.length >= 1 : (need === 'each' ? pres.length >= 1 : pres.length >= need));
        var eff = okb ? bd.effect : bd.fallback;
        if (!eff) return;
        var P = Object.assign({}, eff.params || {});
        if (!P.trigger) P.trigger = 'battle_start';
        x.pas.push({ def: { id: bd.id, name: bd.name, cat: 'passive', kind: eff.kind, power: eff.power || 'S', target: eff.target === 'members' ? 'ally_all' : eff.target, params: P, fig: x.fig }, cd: 0, prepLeft: 0, fires: 0, owner: x });
      });
    });
  });
}
function bnBondTok(S, bd, tok, ctx) {
  var side = bd.side, units = S.teams[side].units, memb = bd.members.map(function (id) { return S.units[id]; }), out = [], t, m;
  if (tok === undefined || tok === null) return [];
  if (Array.isArray(tok)) { tok.forEach(function (k) { out = out.concat(bnBondTok(S, bd, k, ctx)); }); return out; }
  if (typeof tok !== 'string') return [];
  var alive = function (x) { return x && x.alive; };
  if (tok === '其餘存活成員' || tok === '其餘成員') return memb.filter(function (x) { return alive(x) && (!ctx.u || x !== ctx.u); });
  if (tok === '全體成員') return memb.filter(alive);
  if (tok === '該成員') return ctx.u && alive(ctx.u) ? [ctx.u] : [];
  if (tok === '攻擊者') return ctx.attacker && alive(ctx.attacker) ? [ctx.attacker] : [];
  if (tok === '前排成員') return memb.filter(function (x) { return alive(x) && bnRank(S, x) === 1; });
  if (/^另一名/.test(tok)) { t = memb.filter(function (x) { return alive(x) && x !== ctx.u && x !== ctx.killerU; }); return t.length ? [t[0]] : []; }
  if (/^下一位出手/.test(tok)) { t = memb.filter(function (x) { return alive(x) && !x.acted && x !== ctx.u; }); t.sort(function (p, q) { return bnSpd(S, q) - bnSpd(S, p); }); return t.length ? [t[0]] : []; }
  if (/^敵方全體吳/.test(tok)) return bnAlive(S, bnOpp(side)).filter(function (x) { return x.spec.fac === 2; });
  if (tok === '我方任一人' || tok === 'any') return units.filter(alive);
  // fig id(可能夾雜說明文字)
  var ids = tok.match(/[a-z]+/g) || [], cands = [];
  ids.forEach(function (k) { units.forEach(function (x) { if (x.fig === k && alive(x)) cands.push(x); }); });
  if (/較高/.test(tok) && cands.length > 1) { cands.sort(function (p, q) { return q.hp - p.hp; }); return [cands[0]]; }
  return cands;
}
function bnBondEvent(S, when, ctx) {
  var i, j, k, bd, tr, key, lim, subj, mapWhen = when;
  if (S.over || !S.bonds.length) return;
  for (i = 0; i < S.bonds.length; i++) {
    bd = S.bonds[i];
    for (j = 0; j < (bd.b.triggers || []).length; j++) {
      tr = bd.b.triggers[j];
      if (tr.when !== when) continue;
      subj = ctx.u;
      if (when === 'on_cast' || when === 'on_attack' || when === 'on_hit' || when === 'on_ko' || when === 'on_ally_ko' || when === 'hp_below') {
        if (!subj || subj.side !== bd.side) continue;
        if (bd.members.indexOf(subj.id) < 0 && tr.by !== '我方任一人' && tr.by !== 'any') continue;
        if (tr.by && tr.by !== 'any' && tr.by !== '我方任一人') { if (typeof tr.by === 'string' && /^[a-z]+$/.test(tr.by) && subj.fig !== tr.by) continue; }
      }
      if (when === 'hp_below' && tr.threshold !== undefined && subj.hp / subj.maxHp >= tr.threshold) continue;
      if (when === 'hp_below' && tr.threshold === undefined && subj.hp / subj.maxHp >= 0.5) continue;
      if (when === 'on_cast' && tr.skill && (!ctx.sk || ctx.sk.id !== tr.skill)) continue;
      if (when === 'round_start' && tr.extra && /第 1 回合/.test(tr.extra) && S.round !== 1) continue;
      key = bd.b.id + ':' + bd.side + ':' + j;
      lim = tr.limit || {};
      if (lim.perRound && (S.cnt.bond[key] || 0) >= lim.perRound) continue;
      if (lim.perBattle && (S.bcnt.bond[key] || 0) >= lim.perBattle) continue;
      if (lim.perUnitPerBattle && subj && (S.bcnt.bond[key + ':' + subj.id] || 0) >= lim.perUnitPerBattle) continue;
      S.cnt.bond[key] = (S.cnt.bond[key] || 0) + 1;
      S.bcnt.bond[key] = (S.bcnt.bond[key] || 0) + 1;
      if (subj) S.bcnt.bond[key + ':' + subj.id] = (S.bcnt.bond[key + ':' + subj.id] || 0) + 1;
      bnEv(S, 'bond', { id: bd.b.id, name: bd.b.name });
      S.stats.bondFires++;
      for (k = 0; k < tr.effect.length; k++) bnBondOp(S, bd, tr.effect[k], { u: subj, attacker: ctx.attacker, killerU: ctx.killer, t: ctx.t, sk: ctx.sk, res: ctx.res });
      if (S.over) return;
    }
  }
}
function bnBondOp(S, bd, e, ctx) {
  var to = bnBondTok(S, bd, e.to, ctx), by, i, t, v, sid, turns, mul, ch = S.chain;
  switch (e.op) {
    case 'stat_buff':
      turns = e.turns === '全場' || typeof e.turns !== 'number' ? 999 : e.turns;
      for (i = 0; i < to.length; i++) {
        t = to[i];
        if (e.stat === 'atk' || e.stat === 'int') bnStatusApply(S, null, t, 'atk_up', { val: bnKT('buff_atk', e.power || 'S'), left: turns }, {});
        else if (e.stat === 'def') bnStatusApply(S, null, t, 'def_up', { val: bnKT('buff_def', e.power || 'S'), left: turns }, {});
        else if (e.stat === 'spd') bnStatusApply(S, null, t, 'spd_up', { val: bnKT('buff_spd', e.power || 'S'), left: turns }, {});
        else if (e.stat === 'crit') bnStatusApply(S, null, t, 'crit_up', { val: bnKT('buff_crit', e.power || 'S'), left: turns }, {});
      }
      break;
    case 'morale':   // 戰鬥改版:原「士氣 ±」改為戰法發動率 ±(士氣 20 ≈ 發動率 10%,上限 15%),2 回合
      v = Math.min(0.15, Math.abs(e.delta || 0) / 200);
      for (i = 0; i < to.length; i++) if (v > 0) bnStatusApply(S, null, to[i], (e.delta || 0) > 0 ? 'rate_up' : 'rate_down', { val: v, left: 2 }, {});
      break;
    case 'follow_up': {
      by = bnBondTok(S, bd, e.by, ctx)[0] || ctx.u;
      if (!by || !by.alive || bnCantAct(by) || !ch) break;
      if ((S.cnt.assist['f' + by.id] || 0) >= BN_DATA.chain.followUpPerUnit + 0) break;
      if (ch.depth >= BN_DATA.chain.maxDepth) break;
      S.cnt.assist['f' + by.id] = (S.cnt.assist['f' + by.id] || 0) + 1;
      var tgt = null;
      if (e.target === 'attacker') tgt = ctx.attacker; else if (e.target === 'same') tgt = ctx.t; else if (e.target === 'enemy_lowest') tgt = null;
      ch.queue.push({ k: 'follow', u: by, power: e.power || 'S', target: tgt, tag: e.tag, depth: ch.depth + 1 });
      break;
    }
    case 'cd_reduce':
      for (i = 0; i < to.length; i++) to[i].act.forEach(function (it) { if ((!e.skill || it.def.id === e.skill) && it.cd > 0) it.cd = Math.max(0, it.cd - (e.amount || 1)); });
      break;
    case 'skill_amp':
      for (i = 0; i < to.length; i++) {
        t = to[i];
        t.st.amp = t.st.amp || { id: 'amp', list: [], left: 999 };
        t.st.amp.list.push({ skill: e.skill, tag: e.tag, mult: e.mult || 1.2 });
        t.st.amp.left = 999;
        if (typeof e.turns === 'number') { (function (ref, n) { ref.exp = S.round + n; })(t.st.amp.list[t.st.amp.list.length - 1], e.turns); }
      }
      break;
    case 'guard':
      by = bnBondTok(S, bd, e.by, ctx)[0];
      for (i = 0; i < to.length; i++) if (by && by.alive && to[i] !== by) bnStatusApply(S, by, to[i], 'guard', { by: by.id, val: 0.5, left: e.turns || 1, force: true }, {});
      break;
    case 'extra_action':
      by = bnBondTok(S, bd, e.by, ctx)[0];
      if (by) bnQueueExtra(S, by, false, false);
      break;
    case 'apply_status':
      for (i = 0; i < to.length; i++) {
        t = to[i];
        if (e.status === 'shield') bnShield(S, null, t, t.base.sh * bnKT('shield_single', e.power || 'S') * 0.5, {});
        else if (e.status === 'evade') bnStatusApply(S, null, t, 'evade', { charges: 1, left: e.turns || 1 }, {});
      }
      break;
    case 'backlash': {
      var m = /士氣\s*[−-]\s*(\d+)/.exec(e.desc || '');
      for (i = 0; i < to.length; i++) if (m) bnStatusApply(S, null, to[i], 'rate_down', { val: Math.min(0.15, (+m[1]) / 200), left: 2 }, {});
      break;
    }
    case 'cleanse':
      for (i = 0; i < to.length; i++) bnCleanse(S, to[i], e.count || 1, null);
      break;
    default: break;
  }
}

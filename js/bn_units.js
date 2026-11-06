// js/bn_units.js — 名冊卡 → 戰鬥單位(PLAN_BATTLE_A §2:屬性換算、兵種適性、站位、羈絆、詞條)。純邏輯、無 DOM。
// 依賴(載入順序):carddata.js(CARD_GRADE CARD_JOBS CARD_FIGS CARD_FIG_BY_ID)、bn_data.js、bn_skills_data.js。隨機名冊卡(模擬器用)另需 cards.js。
// 產物 = 「單位規格 spec」(純 JSON),engine 的 rec.teamA/teamB 直接吃 spec。
// spec = {name, fig, fac, gr, troop, row, col, apt:{兵種:'S'|'A'|'B'|'C'}, stats:{hp,atk,mag,def,sres,spd,heal,sh,crit,res}, mods:{...}, skills:[戰法 id], ult:id, tags:[...], jobs:[...], traits:[...]}
// 全域:bnEff bnCardStats bnAptOf bnDefaultTroop bnUnitSpec bnSpecRaw bnBuildTeam bnRandomCard bnRandomLearned bnRowOf bnPower

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
  var sc = { '盾': 0.7 * T + 0.3 * W, '步': 0.6 * W + 0.4 * T, '騎': 0.6 * W + 0.2 * T + 0.2 * Z, '弓': 0.5 * W + 0.3 * Z + 0.2 * T, '謀': 0.8 * Z + 0.2 * P };
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
  return (troop === '盾' || troop === '步') ? 0 : (troop === '騎' ? 1 : 2);
}
function bnPower(spec) {   // 戰力(§5.2,僅顯示)
  var s = spec.stats;
  return Math.round((s.hp / 10 + s.atk * 2 + s.mag + s.def + s.spd) * (1 + 0.08 * (spec.skills || []).length));
}

// 詞條 → mods / 靜態屬性修正
function bnTraitFold(card, troop) {
  var mods = {}, st = { stT: 0, stW: 0, stZ: 0, atk: 0, hp: 0, def: 0, spd: 0, atkTroop: 0, all: 1 }, ids = card.tr || [], i, tm, k, scene = '';
  function add(o, key, v) { o[key] = (o[key] || 0) + v; }
  for (i = 0; i < ids.length; i++) {
    tm = BN_TRAIT_MODS[ids[i]];
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
    ['takenPct', 'frontTaken', 'takenRanged', 'critTaken', 'healTaken', 'r1Dmg', 'firstHit', 'vsShield', 'atkMelee', 'early2', 'lateTaken', 'rowTakenFront', 'rowRate', 'rowAtk', 'shieldOut', 'r1Spd', 'reach'].forEach(function (key) { if (tm[key]) add(mods, key, tm[key]); });
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
  return BN_ULT_BY[k] || BN_ULT_BY['步'];
}

// 單位規格。card = 名冊 entry(或 cardGen 結果)。o = {troop, row, col, learned:[id], scene}
function bnUnitSpec(card, o) {
  o = o || {};
  var S5 = bnCardStats(card), apt = bnAptOf(card), troop = o.troop || bnDefaultTroop(card), c = BN_DATA.troops[troop], g = BN_DATA.grade[card.gr] || 1;
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
  if (fg) {
    if (fg.passive) skills.push(fg.passive);
    spec.el = fg.el || '';
    for (i = 0; i < fg.skills.length; i++) skills.push(fg.skills[i]);
    spec.ult = fg.ult;
  } else {
    skills = bnNativeSkills(card, troop);
    learned = o.learned || card.bnLearn;
    sl = bnSlotCount(card);
    if (!learned) learned = BN_DATA.slots.autoLearn ? bnAutoLearn(card, troop, skills, sl) : [];
    for (i = 0; i < learned.length && i < sl; i++) if (BN_SKILLS[learned[i]] && skills.indexOf(learned[i]) < 0) skills.push(learned[i]);
    spec.ult = bnUltFor(card, troop);
  }
  spec.skills = skills;
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
  var units = JSON.parse(JSON.stringify(specs)), bonds = [], fm = [], i, u, cnt = [0, 0, 0], n, facCnt = [0, 0, 0, 0], tagCnt = {}, atkB = 0, hpB = 0, tf;
  for (i = 0; i < units.length; i++) { cnt[units[i].row]++; if (units[i].fac >= 0 && units[i].fac <= 3) facCnt[units[i].fac]++; }
  function eachU(fn) { for (var k = 0; k < units.length; k++) fn(units[k]); }
  function mulStat(u, key, m) { u.stats[key] = bnRound(u.stats[key] * m); }
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
    if (b.cavSpd) eachU(function (u) { if (u.troop === '騎') u.stats.spd += b.cavSpd; });
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
    spec = bnUnitSpec(card, { troop: troop, learned: learned });
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

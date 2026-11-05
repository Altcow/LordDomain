// js/bn_text.js — 戰法與詞條的白話文字(卡面「戰法」區塊、詞條區用)。純邏輯、無 DOM、確定性(同輸入同輸出)。
// 依賴(載入順序):carddata.js、bn_data.js(BN_DATA BN_TRAIT_MODS)、bn_skills_data.js(BN_SKILLS BN_FIG_SKILLS);bn_units.js 的 bnUnitSpec 以 typeof 守衛(唯讀取得實際戰法清單)。
// 數值取自 BN_DATA.kinds 等表(隨平衡調整自動同步);PLACEHOLDER 字樣不顯示給玩家。ES2017;不用 ?. ??。
// 全域:bnSkillText bnSkillParts bnSkillHead bnTraitText bnXTraitText bnCardSkillIds bnCardSkillRows bnSkillShort bnSkillInfo bnSkillsBlockHtml bnSkillCatName BN_TEXT_CATS

var BN_TEXT_CATS = { command: '指揮', active: '主動', pursuit: '追擊', passive: '被動', ult: '大招' };
var BNT_PW = { S: 0, M: 1, L: 2, XL: 3 };
var BNT_PWN = { S: '少量', M: '適量', L: '大量', XL: '極大量' };
var BNT_PWD = { S: '小幅', M: '中幅', L: '大幅', XL: '極大幅' };
var BNT_TG = {
  self: '自身', ally_one: '我方單體', ally_all: '我方全隊', ally_front: '我方前排', ally_back: '我方後排', ally_lowest: '兵力最低的友軍', ally_row: '我方同排友軍',
  enemy_one: '敵方單體', enemy_front: '敵方前排', enemy_back: '敵方後排', enemy_all: '敵方全隊', enemy_lowest: '兵力最低的敵人', enemy_highest_atk: '攻擊最高的敵人',
  enemy_cross: '敵方十字範圍', enemy_col: '敵方同一縱列', members: '羈絆夥伴'
};
var BNT_TRIG = {
  battle_start: '開戰時', turn_start: '每回合開始時', turn_end: '每回合結束時', on_attack: '普通攻擊後', on_hit: '受到攻擊時', on_kill: '擊倒敵人時',
  on_ally_kill: '我方擊倒敵人時', on_ally_down: '友軍倒下時', on_death: '自身倒下時', on_ally_cast: '我方施放戰法時', enemy_next_action: '敵人下次行動時'
};
var BNT_ST = {
  burn: '燃燒', poison: '中毒', bleed: '流血', stun: '暈眩', bind: '定身', silence: '沉默', fear: '威懾', taunt: '嘲諷', mark: '標記', timid: '怯戰', confuse: '擾亂',
  morale_down: '士氣下降', atk_down: '攻擊下降', def_down: '防禦下降', spd_down: '速度下降', heal_block: '禁療', heal_reduce: '治療降低', reorder: '插隊', swap: '換位', control: '控制類狀態', debuff: '減益類狀態', dot: '持續傷害類狀態', any: '任何負面狀態'
};
var BNT_FLAW = {
  no_inspire: '不受友方鼓舞類增益', forced_taunt_target: '被嘲諷時必定攻擊嘲諷者', act_last: '總是最後出手', late_dmg_taken: '戰鬥後期受傷增加', friendly_fire: '偶爾誤傷友軍',
  no_ally_morale: '不為友軍提供士氣', slow_on_ally_down: '友軍倒下時速度下降'
};
var BNT_MODKEY = { takenPct: '受到傷害', atk: '攻擊', def: '防禦', spd: '速度', hp: '兵力上限', crit: '暴擊率', heal: '受到治療' };

function bntS(v, d) { return (v === undefined || v === null || v !== v) ? (d === undefined ? '' : d) : String(v); }
function bntPct(x) { return Math.round(x * 100 + 1e-9) + '%'; }
function bntSgn(x, pct) { return (x < 0 ? '−' : '+') + (pct ? bntPct(Math.abs(x)) : Math.round(Math.abs(x) * 100) / 100); }
function bntKT(kind, power, sc) {
  var t = BN_DATA.kinds[kind], i = BNT_PW[power], v;
  if (!t) return 0;
  v = t[i === undefined ? 1 : i];
  return v * (sc === undefined ? 1 : sc);
}
function bntTg(tg, def) { return BNT_TG[tg] || BNT_TG[def] || '目標'; }
function bntFigName(id) { return (typeof CARD_FIG_BY_ID !== 'undefined' && CARD_FIG_BY_ID[id]) ? CARD_FIG_BY_ID[id].name : id; }
function bntStName(s) { return BNT_ST[s] || '特定狀態'; }
function bntList(a, f) { return (a || []).map(f || bntStName).join('、'); }
function bntFacName(f) { return (typeof CARD_FAC !== 'undefined' && CARD_FAC[f]) ? CARD_FAC[f] : '同陣營'; }
function bntChance(P) { return P.chance && BN_DATA.chanceMap[P.chance] !== undefined ? BN_DATA.chanceMap[P.chance] : (typeof P.chance === 'number' ? P.chance : 0); }

// 持續回合說明:被動 = 全程;指揮 = 預設 defaultRounds;其餘 = buffRounds(大招 buffRoundsXL)
function bntDur(d, P, power) {
  var r;
  if (d.cat === 'passive') return '';
  r = typeof P.rounds === 'number' ? P.rounds : (typeof P.dur === 'number' ? P.dur : (d.cat === 'command' ? BN_DATA.defaultRounds : (power === 'XL' ? BN_DATA.buffRoundsXL : BN_DATA.buffRounds)));
  return ',持續 ' + r + ' 回合';
}
function bntScale(d, kind, P) {
  if (d.cat !== 'passive') return 1;
  if (P.passiveMul !== undefined) return P.passiveMul;
  return kind === 'heal_hot' ? 1 : BN_DATA.passiveMul;
}
function bntDmgName(d) { return d.dmg === 'strat' ? '謀略傷害' : '攻擊傷害'; }

// 單一效果的白話子句(不含類別抬頭)。kind/target/power/P 為該效果(主效果或 extra),d 為戰法本體
function bntClause(kind, target, power, P, d, isExtra) {
  var sc = bntScale(d, kind, P), pw = power || d.power || 'M', v, T, dur = bntDur(d, P, pw), c, s, n, i;
  P = P || {};
  function atkLine(tg, def, mulKind, extra) {
    v = bntKT(mulKind || kind, pw);
    return '對' + bntTg(tg, def) + '造成 ' + bntPct(v) + ' ' + bntDmgName(d) + (extra || '');
  }
  switch (kind) {
    case 'atk_single': return atkLine(target, 'enemy_one');
    case 'atk_front': return atkLine(target === 'enemy_one' || !target ? 'enemy_front' : target, 'enemy_front').replace('敵方單體', '敵方前排');
    case 'atk_back': return atkLine('enemy_back', 'enemy_back');
    case 'atk_all': return atkLine('enemy_all', 'enemy_all');
    case 'atk_pierce': return '貫穿' + bntTg(target, 'enemy_col') + ',每人造成 ' + bntPct(bntKT(kind, pw)) + ' ' + bntDmgName(d);
    case 'atk_cross': return '攻擊目標與其上下左右相鄰的敵人,各造成 ' + bntPct(bntKT(kind, pw)) + ' ' + bntDmgName(d);
    case 'atk_multi': return '對' + bntTg(target, 'enemy_one') + '連續多段攻擊' + (P.hits ? '(' + P.hits + ' 段)' : '') + ',每段 ' + bntPct(bntKT(kind, pw)) + ' ' + bntDmgName(d);
    case 'atk_snipe': return '狙擊' + bntTg(target, 'enemy_lowest') + ',造成 ' + bntPct(bntKT(kind, pw)) + ' ' + bntDmgName(d) + (target === 'enemy_lowest' || !target ? '' : '');
    case 'atk_exec': return atkLine(target, 'enemy_one') + ',目標兵力越低傷害越高(斬殺)';
    case 'execute_chain':
      if (d.cat === 'passive' || d.cat === 'command') return '出手者攻擊 +' + bntPct(bntKT('execute_chain_stack', pw)) + (P.stackMax ? '(最多疊 ' + P.stackMax + ' 層)' : '(可疊加)') + ',並為我方增加士氣';
      return atkLine(target, 'enemy_one', 'execute_chain') + ';若擊倒目標,連動再攻擊下一名敵人';
    case 'lifesteal': return atkLine(target, 'enemy_one') + ',並回復傷害量的 ' + bntPct(bntKT('lifesteal_pct', pw));
    case 'dot_spread': return atkLine(target, 'enemy_all') + ',並使' + bntStName(P.status || 'burn') + (P.spreadOn === 'on_kill' ? '在擊倒敵人時蔓延至相鄰敵人' : '每回合蔓延至相鄰敵人');
    case 'dot_burn': return '使' + bntTg(target, 'enemy_one') + '燃燒 ' + (pw === 'XL' ? BN_DATA.dotRoundsXL : BN_DATA.dotRounds) + ' 回合,每回合受到約 ' + bntPct(bntKT(kind, pw)) + ' 攻擊力的傷害';
    case 'dot_bleed': return '使' + bntTg(target, 'enemy_one') + '流血 ' + (pw === 'XL' ? BN_DATA.dotRoundsXL : BN_DATA.dotRounds) + ' 回合,每回合受到約 ' + bntPct(bntKT(kind, pw)) + ' 攻擊力的傷害';
    case 'dot_poison': return '使' + bntTg(target, 'enemy_one') + '中毒 ' + BN_DATA.poisonRounds + ' 回合,每回合損失 ' + bntPct(bntKT(kind, pw)) + ' 最大兵力,且中毒期間受到的治療減半';
    case 'stun': return '使' + bntTg(target, 'enemy_one') + '暈眩 ' + bntS(P.dur, 1) + ' 回合(無法行動)';
    case 'silence': return '使' + bntTg(target, 'enemy_one') + '沉默 ' + bntS(P.dur, bntKT(kind, pw)) + ' 回合(無法發動主動戰法)';
    case 'timid': return '使' + bntTg(target, 'enemy_one') + '怯戰 ' + bntS(P.dur, bntKT(kind, pw)) + ' 回合(無法普通攻擊,仍可發動戰法)';
    case 'bind': return '使' + bntTg(target, 'enemy_one') + '定身 ' + bntS(P.dur, bntKT(kind, pw)) + ' 回合(無法普通攻擊,仍可發動戰法)';
    case 'confuse': c = bntChance(P); return '使' + bntTg(target, 'enemy_one') + (c ? '有 ' + bntPct(c) + ' 機率' : '') + '陷入擾亂 ' + bntS(P.dur, bntKT(kind, pw)) + ' 回合(攻擊隨機目標,可能誤傷友軍)';
    case 'taunt': return '嘲諷' + bntTg(target === 'self' ? 'enemy_all' : target, 'enemy_all') + ' ' + bntKT(kind, pw) + ' 回合(強制其攻擊自己)' + (bntKT('taunt_def', pw) ? ',期間自身受傷 −' + bntPct(bntKT('taunt_def', pw)) : '');
    case 'fear': return '威懾' + bntTg(target, 'enemy_one') + ':士氣 −' + bntKT(kind, pw) + ',並有 ' + bntPct(bntKT('fear_skip', pw)) + ' 機率本回合不敢行動';
    case 'mark': return '標記' + bntTg(target, 'enemy_one') + ',使其受到的傷害 +' + bntPct(bntKT(kind, pw)) + dur;
    case 'debuff_atk': return bntTg(target, 'enemy_one') + '攻擊 −' + bntPct(bntKT(kind, pw)) + dur;
    case 'debuff_def': return bntTg(target, 'enemy_one') + '防禦 −' + bntPct(bntKT(kind, pw)) + dur;
    case 'debuff_spd': return bntTg(target, 'enemy_one') + '速度 −' + Math.round(bntKT(kind, pw)) + dur;
    case 'morale_down': return '削減' + bntTg(target, 'enemy_one') + '士氣 ' + Math.round(bntKT(kind, pw));
    case 'morale_steal': return '削減' + bntTg(target, 'enemy_one') + '士氣 ' + Math.round(bntKT('morale_down', pw)) + ',並將其中 ' + bntPct(P.ratio !== undefined ? P.ratio : 0.5) + ' 轉為' + bntTg(P.shareTo, 'ally_all') + '的士氣';
    case 'buff_atk': return bntTg(target, 'self') + '攻擊 +' + bntPct(bntKT(kind, pw, sc)) + dur;
    case 'buff_def': return bntTg(target, 'self') + '防禦 +' + bntPct(bntKT(kind, pw, sc)) + dur;
    case 'buff_spd': return bntTg(target, 'self') + '速度 +' + Math.round(bntKT(kind, pw, sc)) + dur;
    case 'buff_crit': return bntTg(target, 'self') + '暴擊率 +' + bntPct(bntKT(kind, pw, sc)) + dur;
    case 'buff_all': return bntTg(target, 'ally_all') + '攻擊與防禦 +' + bntPct(bntKT(kind, pw, sc)) + '、速度 +' + Math.round(bntKT('buff_all_spd', pw, sc)) + dur;
    case 'morale_up': return bntTg(target, 'ally_all') + '士氣 +' + Math.round(bntKT(kind, pw, sc));
    case 'inspire': return '鼓舞' + bntTg(target, 'ally_all') + ':士氣 +' + Math.round(bntKT(kind, pw, sc)) + ',攻擊 +' + bntPct(bntKT('inspire_atk', pw, sc)) + dur;
    case 'heal_single': return '回復' + bntTg(target, 'ally_lowest') + '的兵力(' + BNT_PWN[pw] + ')';
    case 'heal_all': return '回復' + bntTg(target, 'ally_all') + '的兵力(' + BNT_PWN[pw] + ')';
    case 'heal_hot': return bntTg(target, 'ally_all') + (P.trigger === 'turn_start' && d.cat === 'passive' ? '' : '每回合') + '回復兵力(' + BNT_PWN[pw] + ')' + dur;
    case 'shield_single': return '為' + bntTg(target, 'self') + '加上護盾(' + BNT_PWN[pw] + '),持續 ' + BN_DATA.shieldDur + ' 回合';
    case 'shield_all': return '為' + bntTg(target, 'ally_all') + '加上護盾(' + BNT_PWN[pw] + '),持續 ' + BN_DATA.shieldDur + ' 回合';
    case 'cleanse': n = bntKT(kind, pw); return '解除' + bntTg(target, 'ally_all') + (n >= 99 ? '全部負面狀態' : '各 ' + n + ' 個負面狀態');
    case 'revive': return '復活一名倒下的友軍,恢復 ' + bntPct(bntKT(kind, pw)) + ' 兵力' + (P.once ? '(每場一次)' : '');
    case 'dispel': n = bntKT(kind, pw); return '驅散' + bntTg(target, 'enemy_one') + (n >= 99 ? '全部增益' : ' ' + n + ' 個增益') + (P.prefer && BNT_ST[P.prefer] ? '(優先' + BNT_ST[P.prefer] + ')' : '');
    case 'counter': return d.cat === 'passive' ? '受到攻擊時有機會反擊,傷害為 ' + bntPct(bntKT(kind, pw)) + ',兵力越低越強' : '本回合受到攻擊時立即反擊,傷害為 ' + bntPct(bntKT(kind, pw));
    case 'guard': return '替' + (P.protect ? bntFigName(P.protect) + '或' : '') + bntTg(target === 'self' || !target ? 'ally_lowest' : target, 'ally_lowest') + '承受 ' + bntPct(Math.min(1, bntKT(kind, pw) * (d.cat === 'passive' ? BN_DATA.passiveGuardMul : 1))) + ' 的傷害' + (d.cat === 'passive' ? '' : ',持續 1 回合');
    case 'reorder': return target === 'self' || !target ? '自身下一次行動插隊最先出手(速度 +' + Math.round(bntKT('reorder_spd', pw)) + ')' : '令' + bntTg(target, 'ally_one') + '立即插隊出手';
    case 'swap': return target === 'enemy_front' ? '使敵方前排一人與後排一人互換站位' : (target === 'ally_lowest' ? '與兵力最低的友軍交換站位,替其頂上火線' : '與我方一名後排交換站位');
    case 'evade': return bntTg(target, 'self') + '規避接下來 ' + bntS(P.charges, bntKT(kind, pw)) + ' 次攻擊(完全不受傷)' + (typeof P.dur === 'number' ? ',限 ' + P.dur + ' 回合內' : '');
    case 'stealth': return bntTg(target, 'self') + '進入隱匿' + (P.dur === 'battle' ? '(全程)' : ' ' + bntS(P.dur, bntKT('stealth_dur', pw)) + ' 回合') + ':不會被敵方' + (P.vs === 'single' ? '單體' : (Array.isArray(P.vs) ? '狙擊' : '單體')) + '技能選為目標(範圍技仍會命中)';
    case 'immune': s = bntList(P.types); return bntTg(target, 'self') + '免疫' + (s || '指定狀態') + (P.firstOnly ? '(僅首次)' : '');
    case 'resist': return '獲得 ' + bntS(P.layers, 1) + ' 層抵禦(可擋下下一次' + (P.guard ? bntStName(P.guard) : '負面效果') + '),持續 ' + bntS(P.dur, BN_DATA.ward.dur) + ' 回合';
    case 'heal_reduce': return '使' + bntTg(target, 'enemy_one') + (P.ratio >= 100 ? '完全無法被治療(禁療)' : '受到的治療 −' + bntS(P.ratio, 50) + '%') + (P.turns === 'battle' ? '(全程)' : ' ' + bntS(P.turns, BN_DATA.hb.defaultTurns) + ' 回合');
    case 'cd_reduce': return '縮短' + (target && target !== 'self' ? bntTg(target) : '自身') + '技能冷卻 ' + (typeof P.amount === 'number' ? P.amount : bntKT(kind, pw)) + ' 回合';
    case 'cd_reset': return '使' + bntTg(target, 'ally_all') + '的技能冷卻全部歸零';
    case 'extra_turn': return bntTg(target, 'ally_all') + '立即額外行動一次' + (P.normalOnly ? '(僅普通攻擊)' : '');
    case 'self_sacrifice': return '自損 ' + bntPct(P.hpCost || 0.1) + ' 兵力,換取:' + (P.gain && P.gain.kind ? bntClause(P.gain.kind, P.gain.target || target, P.gain.power || pw, P.gain.params || {}, d, true) : '額外效果');
    case 'summon': n = P.count || 1; return '召來 ' + n + ' 名' + bntS(P.unit, '援兵') + (P.mode === 'attacker' ? '助戰,每回合攻擊敵方' : '擋在前方承受傷害') + ',持續 ' + bntS(P.dur, 2) + ' 回合';
    case 'trap': return '布下伏兵:' + bntTg(target, 'enemy_all') + '中下一個行動的敵人遭伏擊,' + (P.effect && P.effect.kind ? bntClause(P.effect.kind, 'enemy_one', pw, P.effect, d, true).replace(/^使敵方單體/, '') : '受到打擊');
    case 'stack_charge': return (P.gainOn && BNT_TRIG[P.gainOn] ? BNT_TRIG[P.gainOn] : '條件達成時') + '累積層數(最多 ' + bntS(P.max, 3) + ' 層),層數越多效果越強(每層約 +' + bntPct(bntKT('stat_charge', pw)) + ')';
    case 'undying': return '兵力不會降到 ' + bntS(P.minHp, 1) + ' 點以下' + (P.once ? '(首次致命傷時觸發,每場一次)' : '(持續 ' + bntS(P.dur, bntKT('undying_dur', pw)) + ' 回合)');
    case 'stat_mod':
      s = []; if (P.mod) Object.keys(P.mod).forEach(function (k) { s.push((BNT_MODKEY[k] || '能力') + ' ' + (P.mod[k] < 0 ? '−' : '+') + Math.abs(P.mod[k]) + '%'); });
      return s.join('、') || '微幅調整自身能力';
    default: return bntS(d.desc);
  }
}

// 附帶說明(extra / 禁療 / 抵禦 / 加成 / 缺陷 …)
function bntNotes(d, P) {
  var out = [], i, ex, hb, r, b, pf, rk;
  P = P || {};
  if (d.recast && d.recast.max) out.push('擊倒目標後可再發動(最多 ' + d.recast.max + ' 次,每次威力遞減)');
  if (P.extra && P.extra.length) {
    for (i = 0; i < P.extra.length; i++) {
      ex = P.extra[i];
      out.push('同時' + bntClause(ex.kind, ex.target === 'same' ? d.target : ex.target, ex.power || d.power, ex.params || {}, d, true));
    }
  }
  if (P.hpCost && d.kind !== 'self_sacrifice') out.push('代價:自損 ' + bntPct(P.hpCost) + ' 兵力');
  if (P.healBlock) {
    hb = P.healBlock; r = Math.min(1, ((hb.rate || 30) / 100) * BN_DATA.hb.rateScale);
    out.push('有 ' + bntPct(r) + ' 機率令目標' + (hb.ratio >= 100 ? '完全無法被治療' : '受到的治療 −' + bntS(hb.ratio, 50) + '%') + (hb.turns === 'battle' ? '(全程)' : ' ' + bntS(hb.turns, BN_DATA.hb.defaultTurns) + ' 回合'));
  }
  if (P.resist && d.kind !== 'resist') {
    rk = P.resist; out.push('有 ' + bntPct(Math.min(1, ((rk.rate || 25) / 100) * BN_DATA.ward.rateScale)) + ' 機率獲得 ' + bntS(rk.layers, 1) + ' 層抵禦,擋下下一次' + bntStName(rk.guard || 'any') + ',持續 ' + bntS(rk.dur, BN_DATA.ward.dur) + ' 回合');
  }
  if (P.immuneHealBlock) out.push('有限次數免疫禁療');
  if (P.bonusVsStatus) { b = P.bonusVsStatus; out.push('目標處於' + bntStName(b.status) + '時,傷害額外 +' + bntPct(BN_DATA.bonusVs[b.mult] || 0.4)); }
  if (P.perFacAlly) { pf = P.perFacAlly; out.push('隊中每有 1 名' + (pf.fac !== undefined ? bntFacName(pf.fac) : '同陣營') + '友軍,效果再提升 ' + bntPct(BN_DATA.stepMul[pf.step] || 0.08) + '(最多 ' + bntS(pf.max, 4) + ' 層)'); }
  if (P.perAlly) { pf = P.perAlly; out.push('隊中每有 1 名同' + (pf.by === 'troop' ? '兵種(' + bntS(pf.key) + ')' : '類型') + '友軍,效果再提升 ' + bntPct(BN_DATA.stepMul[pf.step] || 0.08)); }
  if (P.crowd_scale) out.push('我方存活人數越多,傷害越高');
  if (P.weakness && P.weakness.length) out.push('自身對' + bntList(P.weakness, function (w) { return bntStName(w.type); }) + '的傷害承受提高');
  if (P.selfDebuff) out.push('代價:自身' + (P.selfDebuff.stat === 'def' ? '防禦' : '能力') + '下降 ' + bntS(P.selfDebuff.dur, 1) + ' 回合');
  if (P.flaw && P.flaw.length) out.push('缺點:' + bntList(P.flaw, function (f) { return BNT_FLAW[f.id] || '性格缺陷'; }));
  return out;
}

function bnSkillResolve(sk) {
  if (typeof sk === 'string') return (typeof BN_SKILLS !== 'undefined') ? BN_SKILLS[sk] : null;
  return sk || null;
}
function bnSkillCatName(sk) { var d = bnSkillResolve(sk); return d ? (BN_TEXT_CATS[d.cat] || '戰法') : ''; }
// 發動率:同 bn_engine.js bnRateOf 的基礎部分(不含兵種 / 星數等個別加成)
function bntRate(d) {
  var cat = d.cat === 'pursuit' ? 'pursuit' : 'active', r = d.rate;
  if (r === undefined) r = BN_DATA.rate[cat][d.power || 'M'];
  if (d.prep) r += BN_DATA.rate.prepBonus;
  if (cat === 'active' && /^heal_[sah]/.test(d.kind)) r += BN_DATA.rate.healBoost || 0;
  return Math.max(0, Math.min(BN_DATA.rate.cap, r));
}
// 抬頭:類別(發動條件)
function bnSkillHead(sk) {
  var d = bnSkillResolve(sk), P, a = [], cat, t;
  if (!d) return '';
  P = d.params || {}; cat = BN_TEXT_CATS[d.cat] || '戰法';
  if (d.cat === 'active') { a.push('發動率 ' + bntPct(bntRate(d))); if (d.prep) a.push('準備 ' + d.prep + ' 回合'); }
  else if (d.cat === 'pursuit') a.push('普攻後 ' + bntPct(bntRate(d)) + ' 機率發動');
  else if (d.cat === 'command') a.push('開戰生效');
  else if (d.cat === 'ult') a.push('士氣滿時施放');
  else if (d.cat === 'passive' && !(P.trigger && BNT_TRIG[P.trigger])) a.push('全程');
  if ((d.cat === 'active' || d.cat === 'pursuit') && d.cd) a.push('冷卻 ' + d.cd + ' 回合');
  return cat + (a.length ? '(' + a.join('、') + ')' : '');
}
// 內文(不含抬頭)
function bnSkillBody(sk) {
  var d = bnSkillResolve(sk), P, s, notes, trig = '';
  if (!d) return '';
  P = d.params || {};
  s = bntClause(d.kind, d.target, d.power, P, d, false);
  if (d.cat === 'passive' && P.trigger && BNT_TRIG[P.trigger]) trig = BNT_TRIG[P.trigger] + ',';
  notes = bntNotes(d, P);
  return trig + s + (notes.length ? ';' + notes.join(';') : '') + '。';
}
function bnSkillParts(sk) {
  var d = bnSkillResolve(sk);
  if (!d) return null;
  return { head: bnSkillHead(d), body: bnSkillBody(d), cat: d.cat, name: d.name, id: d.id, desc: d.desc || '' };
}
// 完整一句:『主動(發動率 30%、冷卻 2 回合):對敵方後排造成 120% 謀略傷害。』
function bnSkillText(sk) {
  var p = bnSkillParts(sk);
  return p ? p.head + ':' + p.body : '';
}

// ---------- 詞條 ----------
var BNT_SCENE = { rain: '雨天戰場', water: '水邊戰場', hill: '山地戰場' };
var BNT_OPENING = { yibing: '開戰時使敵方全隊攻擊下降(疑兵)' };
function bntModsText(m, id) {
  var o = [], k, s;
  if (m.atk) o.push('攻擊 ' + bntSgn(m.atk, 1));
  if (m.hp) o.push('兵力上限 ' + bntSgn(m.hp, 1));
  if (m.stT) o.push('統 +' + m.stT);
  if (m.stW) o.push('武 +' + m.stW);
  if (m.stZ) o.push('智 +' + m.stZ);
  if (m.spd) o.push('速度 ' + bntSgn(m.spd));
  if (m.allMul) o.push('所有能力 ' + bntSgn(m.allMul - 1, 1));
  if (m.atkTroop) Object.keys(m.atkTroop).forEach(function (t) { o.push(t + '兵攻擊 ' + bntSgn(m.atkTroop[t], 1)); });
  if (m.reach) o.push('射程 +' + m.reach);
  if (m.atkMelee) o.push('近戰普攻 ' + bntSgn(m.atkMelee, 1));
  if (m.magMul) o.push('謀略傷害 ' + bntSgn(m.magMul - 1, 1));
  if (m.r1Dmg) o.push('第 1 回合傷害 ' + bntSgn(m.r1Dmg, 1));
  if (m.r1Spd) o.push('第 1 回合速度 +' + m.r1Spd);
  if (m.firstHit) o.push('第一次出手傷害 ' + bntSgn(m.firstHit, 1));
  if (m.vsShield) o.push('對盾兵傷害 ' + bntSgn(m.vsShield, 1));
  if (m.early2) o.push('前 2 回合傷害 ' + bntSgn(m.early2, 1));
  if (m.lateTaken) o.push('第 3 回合起受到傷害 ' + bntSgn(m.lateTaken, 1));
  if (m.lowHp) o.push('兵力低於 ' + bntPct(m.lowHp[0]) + ' 時攻擊 ' + bntSgn(m.lowHp[1], 1));
  if (m.burnOut) o.push('燃燒傷害 ' + bntSgn(m.burnOut - 1, 1));
  if (m.shieldOut) o.push('施放的護盾量 ' + bntSgn(m.shieldOut, 1));
  if (m.frontTaken) o.push('位於最前方時受到傷害 ' + bntSgn(m.frontTaken, 1));
  if (m.rowTakenFront) o.push('同排最前方的友軍受到傷害 ' + bntSgn(m.rowTakenFront, 1));
  if (m.takenRanged) o.push('受到遠程攻擊傷害 ' + bntSgn(m.takenRanged, 1));
  if (m.takenFromTroop) Object.keys(m.takenFromTroop).forEach(function (t) { o.push('受到' + t + '兵攻擊傷害 ' + bntSgn(m.takenFromTroop[t] - 1, 1)); });
  if (m.critTaken) o.push('受到暴擊的傷害 ' + bntSgn(m.critTaken, 1));
  if (m.burnTaken) o.push('受到燃燒與火攻傷害 ' + bntSgn(m.burnTaken - 1, 1));
  if (m.healTaken) o.push('受到的治療 ' + bntSgn(m.healTaken, 1));
  if (m.allyDownMorale) o.push('友軍倒下時士氣損失 ' + bntSgn(m.allyDownMorale - 1, 1));
  if (m.immuneAllyDown) o.push('友軍倒下時士氣不受影響');
  if (m.roundStartRowMorale) o.push('每回合開始同排友軍士氣 +' + m.roundStartRowMorale);
  if (m.rowMoraleGain) o.push('同排友軍士氣獲得 ' + bntSgn(m.rowMoraleGain, 1));
  if (m.immuneFirst) o.push('首次被' + m.immuneFirst.map(function (x) { return bntStName(x); }).join('、') + '時免疫');
  if (m.undyingOnce) o.push('首次致命傷時保留 1 點兵力(每場一次)');
  if (m.gamble) o.push('每場開戰攻擊 ×1.25 或 ×0.85(每場固定)');
  if (m.noFmt) o.push('不吃陣型加成');
  if (m.opening && BNT_OPENING[m.opening]) o.push(BNT_OPENING[m.opening]);
  if (m.fmt) o.push((m.fmt === 'fengshi' ? '鋒矢陣' : m.fmt === 'yuanzhen' ? '圓陣' : '雁行陣') + '加成 ×1.3');
  if (m.fmtAll) o.push('所有陣型加成 ' + bntSgn(m.fmtAll - 1, 1));
  if (m.scene) Object.keys(m.scene).forEach(function (sn) {
    var e = m.scene[sn], p = [];
    if (e.atk) p.push('攻擊 ' + bntSgn(e.atk, 1));
    if (e.dmgStrat) p.push('謀略傷害 ' + bntSgn(e.dmgStrat, 1));
    if (p.length) o.push((BNT_SCENE[sn] || '特定戰場') + p.join('、'));
  });
  return o;
}
// 詞條在『城市經濟 / 人物』面向的白話說明(戰鬥面另算)。key = 詞條 id。沒列者直接用 CARD_TRAITS.d
var BNT_CITY = {
  yanfa: '派駐產出 −5%', shusheng: '學職產出 +5%', yishu2: '轉換職業時送醫術 I', fanfu: '無法結義', gaoao: '擔任太守、掌櫃時職務無效', baonue: '偶爾誤傷身邊人',
  jiuxian: '好酒', tianzhen: '城內孩童圍觀', haoxue: '經驗 +20%', yeli: '鐵錠產出 +1(已併入冶鐵 I)', xiangma: '牲口棚與馬場產出略增(已併入畜牧 I)',
  jiren: '每次城市升級 +2 酒令', mingwang: '「掌櫃」職:名人機率再 ×1.1', fengdian: '智 +10、魅 −20;不能擔任太守和掌櫃'
};
// 舊戰鬥系統專屬、新戰鬥沒有對應的詞條(無戰鬥修正且非城市詞條 → 不顯示)由規則判定:不在 BN_TRAIT_MODS(或修正為空)且未標 city
function bnTraitHasBattle(traitId) {
  var m = (typeof BN_TRAIT_MODS !== 'undefined') ? BN_TRAIT_MODS[traitId] : null;
  return !!m && Object.keys(m).length > 0;
}
// 回傳白話說明字串;null = 不顯示。opt.battleOnly 時只回戰鬥面
function bnTraitText(traitId, gr) {
  var t = (typeof CARD_TRAIT_BY_ID !== 'undefined') ? CARD_TRAIT_BY_ID[traitId] : null, parts = [], city;
  if (!t) return null;
  if (bnTraitHasBattle(traitId)) {
    parts = bntModsText(BN_TRAIT_MODS[traitId], traitId);
    if (t.id === 'qishe' && parts.length) parts[0] = '騎兵' + parts[0];
    if (t.city && BNT_CITY[traitId]) parts.push(BNT_CITY[traitId]);
    return parts.length ? '戰鬥中:' + parts.join(';') : (t.city ? bnCityTraitText(t) : null);
  }
  if (t.city) return bnCityTraitText(t);
  return null;
}
function bnCityTraitText(t) {
  var s = BNT_CITY[t.id] || t.d;
  return s;
}
// 名人專屬 / 個人詞條(tr = [名稱, 專屬, 說明]):說明含舊戰鬥用語者回傳 null(只顯示詞條名)
var BNT_OLDWAR = /陣法|陣型|部隊|守方|攻方|放行|潰退|帥帳|偵察|伏兵|出征|糧草|守城|橋格|格內|混亂|胡騎|步兵移速|移速|支敵軍|兵力上限|器材|敵軍數|本軍|接戰|軍攻擊|攻擊 ?[+−]|傷害 ?[+−]|受傷/;
function bnXTraitText(desc) {
  var s = bntS(desc);
  if (!s) return null;
  return BNT_OLDWAR.test(s) ? null : s;
}

// ---------- 卡 → 戰法清單 ----------
// 回傳 [{id, role:'passive'|'skill'|'ult'|'native'|'learned'}],依顯示順序;無法取得時回 []
function bnCardSkillIds(card) {
  var spec, out = [], i, fg, nat;
  if (!card || typeof bnUnitSpec !== 'function') return out;
  try { spec = bnUnitSpec(card, {}); } catch (e) { return out; }
  fg = card.fig && typeof BN_FIG_SKILLS !== 'undefined' ? BN_FIG_SKILLS[card.fig] : null;
  for (i = 0; i < spec.skills.length; i++) {
    out.push({ id: spec.skills[i], role: fg ? (i === 0 ? 'passive' : 'skill') : (i === 0 ? 'native' : 'learned') });
  }
  if (spec.ult) out.push({ id: spec.ult, role: 'ult' });
  return out.filter(function (x) { return !!(typeof BN_SKILLS !== 'undefined' && BN_SKILLS[x.id]); });
}
function bnCardSkillRows(card) {
  return bnCardSkillIds(card).map(function (x) {
    var p = bnSkillParts(x.id), d = BN_SKILLS[x.id];
    return { id: x.id, role: x.role, cat: d.cat, name: d.name, head: p.head, body: p.body, desc: p.desc, cd: d.cd || 0, rate: d.rate, fig: d.fig || '', flavor: (typeof BN_FLAVOR !== 'undefined' && BN_FLAVOR[x.id]) || '' };
  });
}
// ---------- 卡面「戰法」區塊:名稱連結 + 類別小標 + 一行短說明;完整說明在彈窗(cardsui 說明浮層 kind=bnskill,bnSkillInfo) ----------
var BNT_ROLE = { native: '職業預設', learned: '學習' };
var BNT_TS = { self: '自身', ally_one: '我單體', ally_all: '我全隊', ally_front: '我前排', ally_back: '我後排', ally_lowest: '我最弱', ally_row: '我同排', enemy_one: '敵單體', enemy_front: '敵前排', enemy_back: '敵後排',
  enemy_all: '敵全隊', enemy_lowest: '敵最弱', enemy_highest_atk: '敵最強', enemy_cross: '敵十字', enemy_col: '敵縱列', members: '夥伴' };
var BNT_KS = {
  heal_single: '回復兵力', heal_all: '回復兵力', heal_hot: '持續回復', shield_single: '加護盾', shield_all: '加護盾', cleanse: '解除負面', revive: '復活', dispel: '驅散增益', counter: '反擊', guard: '承傷', reorder: '插隊出手',
  swap: '換位', evade: '規避攻擊', stealth: '隱匿', immune: '免疫控制', resist: '獲得抵禦', heal_reduce: '治療降低', cd_reduce: '縮短冷卻', cd_reset: '冷卻歸零', extra_turn: '額外行動', self_sacrifice: '自損換資源',
  summon: '召喚援兵', trap: '布下伏兵', stack_charge: '累積層數', undying: '死戰不倒', stat_mod: '微調能力', execute_chain: '擊倒連動', stun: '暈眩', silence: '沉默', timid: '怯戰', bind: '定身', confuse: '擾亂',
  taunt: '嘲諷', fear: '威懾', mark: '標記易傷', dot_burn: '燃燒', dot_poison: '中毒', dot_bleed: '流血', dot_spread: '火勢蔓延', morale_steal: '奪取士氣', morale_down: '削減士氣', morale_up: '增加士氣', inspire: '鼓舞士氣'
};
function bntShortCut(t) { var a = Array.from(t); return a.length > 16 ? a.slice(0, 16).join('') : t; }
// 一行短效果(≤16 字)
function bnSkillShort(sk) {
  var d = bnSkillResolve(sk), k, pw, sc, T, o;
  if (!d) return '';
  k = d.kind; pw = d.power || 'M'; sc = bntScale(d, k, d.params || {});
  T = BNT_TS[d.target] || (/^(atk|dot|execute|lifesteal|stun|silence|timid|bind|confuse|fear|mark|debuff|morale_down|morale_steal|dispel|heal_reduce)/.test(k) ? '敵單體' : '自身');
  if (/^atk_|^lifesteal$|^execute_chain$/.test(k) && d.cat !== 'passive') o = T + ' ' + bntPct(bntKT(k, pw)) + (d.dmg === 'strat' ? ' 謀略傷' : ' 傷害');
  else if (k === 'buff_atk' || k === 'buff_def' || k === 'buff_crit') o = T + (k === 'buff_atk' ? '攻擊' : k === 'buff_def' ? '防禦' : '暴擊') + ' +' + bntPct(bntKT(k, pw, sc));
  else if (k === 'buff_spd') o = T + '速度 +' + Math.round(bntKT(k, pw, sc));
  else if (k === 'buff_all') o = T + '攻防速 +' + bntPct(bntKT(k, pw, sc));
  else if (k === 'debuff_atk' || k === 'debuff_def') o = T + (k === 'debuff_atk' ? '攻擊' : '防禦') + ' −' + bntPct(bntKT(k, pw));
  else if (k === 'debuff_spd') o = T + '速度 −' + Math.round(bntKT(k, pw));
  else if (k === 'morale_up') o = T + '士氣 +' + Math.round(bntKT(k, pw, sc));
  else if (k === 'morale_down') o = T + '士氣 −' + Math.round(bntKT(k, pw));
  else o = T + (BNT_KS[k] || '特殊效果');
  return bntShortCut(o);
}
function bnSkillTags(d) {
  var t = [BN_TEXT_CATS[d.cat] || '戰法'];
  if (d.generic || !d.fig) t.push('通用戰法'); else t.push(d.learn ? '可學習' : '名人專屬');
  return t;
}
function bntFitText(d) {
  var f = d.fit || {}, a = [];
  if (f.troops && f.troops.length) a.push(f.troops.join('、') + '兵種');
  if (f.jobs && f.jobs.length) a.push(f.jobs.map(function (j) { return (typeof CARD_JOB_BY_ID !== 'undefined' && CARD_JOB_BY_ID[j]) ? CARD_JOB_BY_ID[j].name : j; }).join('、') + '出身');
  return a.join(';') || '各兵種皆可';
}
// 彈窗內容(給 cardsui 說明浮層):{title, tags, tagCls, lines:[[標題, 內文]]};查無回 null
function bnSkillInfo(id) {
  var d = bnSkillResolve(id), p, fl, lines = [];
  if (!d) return null;
  p = bnSkillParts(d);
  lines.push(['發動', p.head]);
  lines.push(['效果', p.body]);
  if (p.desc) lines.push(['補充', p.desc]);
  fl = (typeof BN_FLAVOR !== 'undefined' && BN_FLAVOR[d.id]) || '';
  if (d.fig) lines.push(['事蹟 / 典故', fl || '依人物經歷與個性設計(史料較少者為推想)。']);
  else { lines.push(['用法', d.cat === 'ult' ? '士氣滿時自動施放,依兵種而定。' : '依發動率自動施放,不需操作。']); lines.push(['適合搭配', bntFitText(d)]); }
  return { title: d.name, tags: bnSkillTags(d), tagCls: ['bnt-' + d.cat], lines: lines };
}
function bntEsc(x) { return String(x).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
// mini = 縮小版卡面:名稱只是文字,不做連結
function bnSkillsBlockHtml(card, mini) {
  var rows = bnCardSkillRows(card), h = '';
  if (!rows.length) return '';
  rows.forEach(function (r) {
    var nm = mini ? '<b>' + bntEsc(r.name) + '</b>' : '<a class="bnlink" role="button" data-a="info" data-k="bnskill" data-key="' + bntEsc(r.id) + '">' + bntEsc(r.name) + '</a>';
    h += '<div class="bnsk"><i class="bntag bnt-' + r.cat + '">' + BN_TEXT_CATS[r.cat] + '</i>' + nm + (BNT_ROLE[r.role] ? '<em class="bnrole">' + BNT_ROLE[r.role] + '</em>' : '') + '<span class="bnskm">' + bntEsc(bnSkillShort(r.id)) + '</span></div>';
  });
  return '<div class="cusec bnsec">戰法</div><div class="bnskl">' + h + '</div>';
}
var BN_TEXT_CSS = '#cardsPanel .bnsec{margin-top:6px;font-size:13px}#cardsPanel .bnsk{display:flex;align-items:center;flex-wrap:wrap;gap:2px 6px;margin:2px 0;font-size:13px;min-height:28px}#cardsPanel .bnsk b{overflow-wrap:anywhere}' +
  '#cardsPanel .bnlink{display:inline-flex;align-items:center;min-height:36px;font-weight:bold;color:#1c5fb0;text-decoration:underline;cursor:pointer;overflow-wrap:anywhere}' +
  '@media (prefers-color-scheme:dark){:root:not([data-theme="light"]) #cardsPanel .bnlink{color:#8fbcf5}}:root[data-theme="dark"] #cardsPanel .bnlink{color:#8fbcf5}' +
  '#cardsPanel .bntag{font-style:normal;font-size:11px;padding:0 5px;border-radius:3px;color:#fff;background:#666}#cardsPanel .bnt-command{background:#7a4aa0}#cardsPanel .bnt-active{background:#2f6fb5}#cardsPanel .bnt-pursuit{background:#b8571f}#cardsPanel .bnt-passive{background:#3b8a5a}#cardsPanel .bnt-ult{background:#b8902a}' +
  '#cardsPanel .cuit.bnt-command,#cardsPanel .cuit.bnt-active,#cardsPanel .cuit.bnt-pursuit,#cardsPanel .cuit.bnt-passive,#cardsPanel .cuit.bnt-ult{color:#fff;border-color:transparent}' +
  '#cardsPanel .bnrole{font-style:normal;font-size:10px;opacity:.7}#cardsPanel .bnskm{font-size:12px;opacity:.8;overflow-wrap:anywhere}' +
  '#cardsPanel .cutd{display:flex;flex-wrap:wrap;align-items:center;gap:2px 4px}#cardsPanel .cutx{font-size:11.5px;opacity:.85;overflow-wrap:anywhere;flex:1 1 140px;min-width:0}';


if (typeof module !== 'undefined' && module.exports) module.exports = { bnSkillText: bnSkillText, bnTraitText: bnTraitText };

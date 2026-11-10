// js/bn_text.js — 戰法與詞條的白話文字(卡面「戰法」區塊、詞條區用)。純邏輯、無 DOM、確定性(同輸入同輸出)。
// 依賴(載入順序):carddata.js、bn_data.js(BN_DATA BN_TRAIT_MODS)、bn_skills_data.js(BN_SKILLS BN_FIG_SKILLS);bn_units.js 的 bnUnitSpec 以 typeof 守衛(唯讀取得實際戰法清單)。
// 數值取自 BN_DATA.kinds 等表(隨平衡調整自動同步);PLACEHOLDER 字樣不顯示給玩家。ES2017;不用 ?. ??。
// 戰鬥改版(2026-11-06):沒有士氣;大招 = 低機率戰法;對象條件 vs 一律寫成「對 XXX 時…」「被 XXX 攻擊時…」「XXX 在我方時…」。
// B4:名人專屬詞條戰鬥面(BN_FIG_TRAIT)由 bnXTraitText / bnXTraitInfoFix 顯示。
// 全域:bnSkillText bnSkillParts bnSkillHead bnTraitText bnXTraitText bnXTraitInfoFix bnFigTraitOf bnFigTraitText bnCardSkillIds bnCardSkillRows bnSkillShort bnSkillInfo bnSkillsBlockHtml bnSkillCatName BN_TEXT_CATS

var BN_TEXT_CATS = { command: '指揮', active: '主動', pursuit: '追擊', passive: '被動', ult: '大招' };
var BNT_PW = { S: 0, M: 1, L: 2, XL: 3 };
var BNT_PWN = { S: '少量', M: '適量', L: '大量', XL: '極大量' };
var BNT_PWD = { S: '小幅', M: '中幅', L: '大幅', XL: '極大幅' };
var BNT_TG = {
  self: '自身', ally_one: '我方單體', ally_all: '我方全隊', ally_front: '我方前排', ally_back: '我方後排', ally_lowest: '兵力最低的友軍', ally_row: '我方同排友軍',
  enemy_one: '敵方單體', enemy_front: '敵方前排', enemy_back: '敵方後排', enemy_all: '敵方全隊', enemy_lowest: '兵力最低的敵人', enemy_highest_atk: '攻擊最高的敵人',
  enemy_cross: '敵方十字範圍', enemy_col: '敵方同一縱列', members: '羈絆夥伴',
  enemy_hpmax: '兵力最多的敵人', enemy_fastest: '速度最快的敵人', enemy_prey: '剋制我方兵種的敵人', enemy_troop: '指定兵種的敵人', enemy_row: '敵方同排', enemy_rand: '隨機敵人'
};
var BNT_TRIG = {
  hp_below_30: '自身兵力低於 30% 時', battle_start: '開戰時', turn_start: '每回合開始時', turn_end: '每回合結束時', on_attack: '普通攻擊後', on_hit: '受到攻擊時', on_kill: '擊倒敵人時',
  on_ally_kill: '我方擊倒敵人時', on_ally_down: '友軍倒下時', on_death: '自身倒下時', on_ally_cast: '我方施放戰法時', enemy_next_action: '敵人下次行動時'
};
var BNT_ST = {
  burn: '燃燒', poison: '中毒', bleed: '流血', stun: '暈眩', sleep: '睡眠', paralyze: '麻痺', bind: '定身', silence: '沉默', fear: '威懾', taunt: '嘲諷', mark: '標記', timid: '怯戰', confuse: '擾亂',
  atk_down: '攻擊下降', def_down: '防禦下降', spd_down: '速度下降', rate_down: '發動率下降', rate_up: '發動率提升', debuff_hit: '命中下降', wx_mark: '五行印', invert: '陰陽互換',
  atk_up: '攻擊提升', def_up: '防禦提升', spd_up: '速度提升', crit_up: '暴擊提升', stealth: '隱匿', evade: '規避', dodge_rate: '閃避', shield: '護盾', ward: '抵禦', undying: '不倒', guard: '援護', counter: '反擊', heal_block: '禁療', heal_reduce: '治療降低', reorder: '插隊', swap: '換位', control: '控制類狀態', debuff: '減益類狀態', dot: '持續傷害類狀態', any: '任何負面狀態'
};
BNT_ST.critdmg_up = '暴擊傷害提升'; BNT_ST.thorns = '荊棘'; BNT_ST.fuse = '引信'; BNT_ST.lag = '遲滯';
var BNT_FLAW = {
  no_inspire: '不受友方鼓舞類增益', forced_taunt_target: '被嘲諷時必定攻擊嘲諷者', act_last: '總是最後出手', late_dmg_taken: '戰鬥後期受傷增加', friendly_fire: '偶爾誤傷友軍',
  no_ally_morale: '不易受友軍增益影響', slow_on_ally_down: '友軍倒下時速度下降', timid_vs: '遇到剋星時可能怯戰', weak_vs: '遇到剋星時受傷大增', revoke_book: '張角兵力過低時收回天書',
  self_timid: '每回合開始有機率喝醉怯戰(不能普攻)', random_power: '每次效果隨機變成 0.5~1.5 倍', suspected_by: '主公在我方時每回合可能被猜忌,受到的傷害增加'
};
function bntFlawTxt(f) {
  var t = BNT_FLAW[f.id] || '性格缺陷', nm = f.fig ? bntFigName(f.fig) : '';
  if (f.id === 'timid_vs' && nm) return '被' + nm + '攻擊時有 ' + (f.chance || 50) + '% 機率怯戰';
  if (f.id === 'weak_vs' && nm) return '被' + nm + '攻擊時受傷大增';
  if (f.id === 'suspected_by' && nm) return nm + '在我方時每回合有 ' + (f.chance || 15) + '% 機率被猜忌,受到的傷害增加';
  if (f.id === 'self_timid') return '每回合開始有 ' + (f.chance || 20) + '% 機率喝醉怯戰(不能普攻)';
  if (f.id === 'revoke_book' && nm) return nm + '兵力過低時收回天書';
  return t;
}
var BNT_TAG = { lord: '一方之主', mystic: '方士', sun_clan: '孫氏一門', taoyuan: '桃園兄弟', liu_family: '劉備家眷', warrior: '猛將' };
var BNT_THEME = { herb: '草藥', wuxing: '五行', yinyang: '陰陽', fireox: '火牛', ink: '書生文墨', bagua: '八卦', talisman: '符籙', drum: '鼓角', banner: '旌旗', crossbow: '弩機', charm: '魅惑', thunder: '落雷' };
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
function bntChance(P) { return P.chance && BN_DATA.chanceMap[P.chance] !== undefined ? BN_DATA.chanceMap[P.chance] : (typeof P.chance === 'number' ? (P.chance > 1 ? P.chance / 100 : P.chance) : 0); }
function bntChanceTxt(P) { var c = bntChance(P); return c && c < 1 ? '有 ' + bntPct(c) + ' 機率' : ''; }
// 對象條件 vs 的數值(與 bn_effects.js bnVsVal 同規則)
function bntVsVal(stat, mult) {
  var V = BN_DATA.vs, m = mult, n, neg = false, tb;
  if (typeof m === 'number') return (stat === 'dur' || stat === 'spd') ? m : (m > 1 ? m / 100 : m);
  m = String(m === undefined ? 'M' : m).replace('−', '-');
  if (/^[+-]?\d+(\.\d+)?%?$/.test(m)) { n = parseFloat(m); return (stat === 'dur' || stat === 'spd') ? n : n / 100; }
  if (m.charAt(0) === '-') { neg = true; m = m.slice(1); }
  tb = stat === 'crit' ? V.crit : stat === 'chance' ? V.chance : stat === 'dmgTaken' ? V.taken : stat === 'spd' ? V.spd : stat === 'rate' ? { S: 0.05, M: 0.10, L: 0.15, XL: 0.20 } : stat === 'dur' ? { S: 1, M: 1, L: 2, XL: 2 } : V.dmg;
  n = tb[m] !== undefined ? tb[m] : tb.M;
  return neg ? -n * (stat === 'dmgTaken' ? 0.5 : 1) : n;
}
function bntVsWho(vs) {
  var a = [];
  if (vs.fig) a.push(vs.fig.map(bntFigName).join('、'));
  if (vs.tag) a.push(vs.tag.map(function (t) { return BNT_TAG[t] || '特定名人'; }).join('、'));
  if (vs.troop) a.push(vs.troop.join('、') + '兵');
  if (vs.fac) a.push(vs.fac.map(function (x) { return bntFacName(x) + '陣營'; }).join('、'));
  if (vs.status) a.push('處於' + vs.status.map(bntStName).join('、') + '的' + (vs.mode === 'ally' ? '友軍' : '敵人'));
  return a.join('或') || '特定對象';
}
// 『對 XXX 時…』『被 XXX 攻擊時…』『XXX 在我方時…』
function bntVsText(d) {
  var vs = d.vs, b, who, v, e, pas;
  if (!vs || !vs.bonus) return '';
  b = vs.bonus; who = bntVsWho(vs); v = bntVsVal(b.stat, b.mult); pas = d.cat === 'passive' || d.cat === 'command';
  switch (b.stat) {
    case 'dmg': e = (vs.mode === 'ally' ? '效果' : '傷害') + ' +' + bntPct(v); break;
    case 'crit': e = v >= 1 ? '必定暴擊' : '暴擊率 +' + bntPct(v); break;
    case 'chance':
      if (vs.mode === 'defend' && (d.kind === 'evade' || d.kind === 'stealth')) e = '有 ' + bntPct(/%$/.test(String(b.mult)) ? v : Math.min(0.6, v * 0.5)) + ' 機率閃開其攻擊';
      else if (vs.mode === 'defend' && (d.kind === 'resist' || d.kind === 'immune')) e = (v >= 1 ? '必定擋下' : '有 ' + bntPct(v) + ' 機率擋下') + '其施加的負面狀態';
      else if (vs.mode === 'defend') return '';   // 其他(例如缺陷型)由 flaw 說明
      else e = v >= 1 ? '效果必定命中(無視抵禦與抵抗)' : '效果機率提高到 ' + bntPct(v);
      break;
    case 'dmgTaken': e = '受到的傷害 ' + (v >= 0 ? '+' : '−') + bntPct(Math.abs(v)); break;
    case 'spd': e = (vs.mode === 'ally' && !(pas && /^buff_/.test(d.kind)) ? who + '速度 +' : '速度 +') + Math.round(v); break;
    case 'rate': e = (vs.mode === 'ally' && pas ? who + '的戰法發動率 +' : '發動率 +') + bntPct(v); break;
    case 'dur': e = '持續回合 +' + Math.round(v); break;
    default: e = '效果提升';
  }
  if (vs.mode === 'attack') return '對' + who + '時,' + e;
  if (vs.mode === 'defend') return '被' + who + '攻擊時,' + e;
  if (vs.mode === 'both') return b.stat === 'dmgTaken' ? '被' + who + '攻擊時,' + e : '對' + who + '時,' + e + ';被其攻擊時受傷 −' + bntPct(BN_DATA.vs.bothCut);
  return who + '在我方時,' + e;
}
var BNT_VS_ONLY = { buff_atk: 1, buff_def: 1, buff_spd: 1, buff_crit: 1, debuff_atk: 1, debuff_def: 1, rate_up: 1 };

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
    case 'atk_multi': return '對' + bntTg(target, 'enemy_one') + '連續多段攻擊' + (P.hits ? '(' + P.hits + ' 段' + (P.scaleBy === 'spd' ? ',速度越快段數越多' : '') + ')' : '') + ',每段 ' + bntPct(bntKT(kind, pw)) + ' ' + bntDmgName(d);
    case 'atk_snipe': return '狙擊' + bntTg(target, 'enemy_lowest') + ',造成 ' + bntPct(bntKT(kind, pw)) + ' ' + bntDmgName(d) + (target === 'enemy_lowest' || !target ? '' : '');
    case 'atk_exec': return atkLine(target, 'enemy_one') + ',目標兵力越低傷害越高(斬殺)';
    case 'execute_chain':
      if (d.cat === 'passive' || d.cat === 'command') return '出手者攻擊 +' + bntPct(bntKT('execute_chain_stack', pw)) + (P.stackMax ? '(最多疊 ' + P.stackMax + ' 層)' : '(可疊加)');
      return atkLine(target, 'enemy_one', 'execute_chain') + ';若擊倒目標,連動再攻擊下一名敵人';
    case 'lifesteal': return atkLine(target, 'enemy_one') + ',並回復傷害量的 ' + bntPct(bntKT('lifesteal_pct', pw));
    case 'dot_spread': return atkLine(target, 'enemy_all') + ',並使' + bntStName(P.status || 'burn') + (P.spreadOn === 'on_kill' ? '在擊倒敵人時蔓延至相鄰敵人' : '每回合蔓延至相鄰敵人');
    case 'dot_burn': return '使' + bntTg(target, 'enemy_one') + '燃燒 ' + (pw === 'XL' ? BN_DATA.dotRoundsXL : BN_DATA.dotRounds) + ' 回合,每回合受到約 ' + bntPct(bntKT(kind, pw)) + ' 攻擊力的傷害';
    case 'dot_bleed': return '使' + bntTg(target, 'enemy_one') + '流血 ' + (pw === 'XL' ? BN_DATA.dotRoundsXL : BN_DATA.dotRounds) + ' 回合,每回合受到約 ' + bntPct(bntKT(kind, pw)) + ' 攻擊力的傷害';
    case 'dot_poison': return '使' + bntTg(target, 'enemy_one') + '中毒 ' + BN_DATA.poisonRounds + ' 回合,每回合損失 ' + bntPct(bntKT(kind, pw)) + ' 最大兵力,且中毒期間受到的治療減半';
    case 'stun': return '使' + bntTg(target, 'enemy_one') + bntChanceTxt(P) + '暈眩 ' + bntS(P.dur, 1) + ' 回合(無法行動)';
    case 'sleep': return '使' + bntTg(target, 'enemy_one') + bntChanceTxt(P) + '沉睡 ' + bntS(P.dur, bntKT(kind, pw)) + ' 回合(無法行動、不會閃避),受到攻擊時有 ' + bntPct(BN_DATA.sleep.wake) + ' 機率驚醒;醒來後 ' + BN_DATA.sleep.immRounds + ' 回合內不會再被催眠';
    case 'paralyze': return '使' + bntTg(target, 'enemy_one') + bntChanceTxt(P) + '麻痺 ' + bntS(P.dur, bntKT(kind, pw)) + ' 回合:每次行動有 ' + bntPct(BN_DATA.paralyze.skip) + ' 機率無法行動,速度 −' + bntPct(BN_DATA.paralyze.spd) +
      (P.conduct || d.theme === 'thunder' || (d.tags && d.tags.indexOf('thunder') >= 0) ? ';雷電會傳導給相鄰一名敵人,使其麻痺 ' + BN_DATA.paralyze.conductLeft + ' 回合(每人每回合最多被傳導 1 次)' : '');
    case 'silence': return '使' + bntTg(target, 'enemy_one') + bntChanceTxt(P) + '沉默 ' + bntS(P.dur, bntKT(kind, pw)) + ' 回合(無法發動主動戰法)';
    case 'timid': return '使' + bntTg(target, 'enemy_one') + bntChanceTxt(P) + '怯戰 ' + bntS(P.dur, bntKT(kind, pw)) + ' 回合(無法普通攻擊,仍可發動戰法)';
    case 'bind': return '使' + bntTg(target, 'enemy_one') + bntChanceTxt(P) + '定身 ' + bntS(P.dur, bntKT(kind, pw)) + ' 回合(無法普通攻擊,仍可發動戰法)';
    case 'confuse': c = bntChance(P); return '使' + bntTg(target, 'enemy_one') + (c ? '有 ' + bntPct(c) + ' 機率' : '') + '陷入擾亂 ' + bntS(P.dur, bntKT(kind, pw)) + ' 回合(攻擊隨機目標,可能誤傷友軍)' + (P.forceTarget ? ';' + Object.keys(P.forceTarget).map(function (k) { return bntFigName(k) + '被擾亂時優先攻擊' + bntFigName(P.forceTarget[k]); }).join('、') : '');
    case 'taunt': return '嘲諷' + bntTg(target === 'self' ? 'enemy_all' : target, 'enemy_all') + ' ' + bntKT(kind, pw) + ' 回合(強制其攻擊自己)' + (bntKT('taunt_def', pw) ? ',期間自身受傷 −' + bntPct(bntKT('taunt_def', pw)) : '');
    case 'fear': return '威懾' + bntTg(target, 'enemy_one') + ':有 ' + bntPct(bntKT('fear_skip', pw)) + ' 機率下次行動不敢出手';
    case 'mark': return '標記' + bntTg(target, 'enemy_one') + ',使其受到的傷害 +' + bntPct(bntKT(kind, pw)) + dur;
    case 'debuff_atk': return bntTg(target, 'enemy_one') + '攻擊 −' + bntPct(bntKT(kind, pw)) + dur;
    case 'debuff_def': return bntTg(target, 'enemy_one') + '防禦 −' + bntPct(bntKT(kind, pw)) + dur;
    case 'debuff_spd': return bntTg(target, 'enemy_one') + '速度 −' + Math.round(bntKT(kind, pw)) + dur;
    case 'rate_up': return bntTg(target, 'ally_all') + '戰法發動率 +' + bntPct(typeof P.amount === 'number' ? (P.amount > 1 ? P.amount / 100 : P.amount) : bntKT(kind, pw, sc)) + (P.scaleByLostHp ? '(自身兵力越低提升越多)' : '') + dur;
    case 'rate_down': return bntTg(target, 'enemy_one') + '戰法發動率 −' + bntPct(typeof P.amount === 'number' ? (P.amount > 1 ? P.amount / 100 : P.amount) : bntKT(kind, pw, sc)) + dur;
    case 'debuff_hit': return '使' + bntTg(target, 'enemy_one') + bntChanceTxt(P) + '命中下降:攻擊有 ' + bntPct(typeof P.val === 'number' ? P.val : bntKT(kind, pw)) + ' 機率落空' + (typeof P.dur === 'number' ? ',持續 ' + P.dur + ' 回合' : dur);
    case 'buff_steal': n = P.count !== undefined ? P.count : bntKT(kind, pw); return '偷走' + bntTg(target, 'enemy_one') + (target === 'enemy_all' ? '每人' : '') + ' ' + n + ' 個增益(攻防速、暴擊、發動率、規避、護盾等),轉給' + (P.giveTo && P.giveTo !== 'self' ? bntTg(P.giveTo, 'ally_all') : '自己');
    case 'invert': n = P.count !== undefined ? P.count : bntKT(kind, pw); return (P.dir === 'ally_debuff_to_buff' || (target && target.indexOf('ally') === 0) ? '把' + bntTg(target, 'ally_all') + '身上最多 ' + n + ' 個減益陰陽互換成同等增益' : '把' + bntTg(target, 'enemy_one') + '身上最多 ' + n + ' 個增益陰陽互換成同等減益');
    case 'wx_mark': return '在' + bntTg(target, 'enemy_one') + '身上留下五行印:被剋屬性的五行戰法命中時傷害 +' + bntPct(BN_DATA.wx.mark) + '(消耗印記)';
    case 'buff_atk': return bntTg(target, 'self') + '攻擊 +' + bntPct(bntKT(kind, pw, sc)) + dur;
    case 'buff_def': return bntTg(target, 'self') + '防禦 +' + bntPct(bntKT(kind, pw, sc)) + dur;
    case 'buff_spd': return bntTg(target, 'self') + '速度 +' + Math.round(bntKT(kind, pw, sc)) + dur;
    case 'buff_crit': return bntTg(target, 'self') + '暴擊率 +' + bntPct(bntKT(kind, pw, sc)) + dur;
    case 'buff_all': return bntTg(target, 'ally_all') + '攻擊與防禦 +' + bntPct(bntKT(kind, pw, sc)) + '、速度 +' + Math.round(bntKT('buff_all_spd', pw, sc)) + dur;
    case 'heal_single': return '回復' + bntTg(target, 'ally_lowest') + '的兵力(' + BNT_PWN[pw] + ')';
    case 'heal_all': return '回復' + bntTg(target, 'ally_all') + '的兵力(' + BNT_PWN[pw] + ')';
    case 'heal_hot': return bntTg(target, 'ally_all') + (P.trigger === 'turn_start' && d.cat === 'passive' ? '' : '每回合') + '回復兵力(' + BNT_PWN[pw] + ')' + dur;
    case 'shield_single': return '為' + bntTg(target, 'self') + '加上護盾(' + BNT_PWN[pw] + '),持續 ' + BN_DATA.shieldDur + ' 回合';
    case 'shield_all': return '為' + bntTg(target, 'ally_all') + '加上護盾(' + BNT_PWN[pw] + '),持續 ' + BN_DATA.shieldDur + ' 回合';
    case 'cleanse': n = bntKT(kind, pw); return '解除' + bntTg(target, 'ally_all') + (n >= 99 ? '全部負面狀態' : '各 ' + n + ' 個負面狀態');
    case 'revive': return '復活一名倒下的友軍,恢復 ' + bntPct(bntKT(kind, pw)) + ' 兵力' + (P.once ? '(每場一次)' : '');
    case 'dispel': n = bntKT(kind, pw); return '驅散' + bntTg(target, 'enemy_one') + (n >= 99 ? '全部增益' : ' ' + n + ' 個增益') + (P.prefer && BNT_ST[P.prefer] ? '(優先' + BNT_ST[P.prefer] + ')' : '');
    case 'counter': return d.cat === 'passive' ? '受到攻擊時有機會反擊,傷害為 ' + bntPct(bntKT(kind, pw)) + ',兵力越低越強' : '本回合受到攻擊時立即反擊,傷害為 ' + bntPct(bntKT(kind, pw));
    case 'guard': if (P.protect && /_guards_self$/.test(P.protect)) return bntFigName(P.protect.replace('_guards_self', '')) + '替自己承受 ' + bntPct(Math.min(1, bntKT(kind, pw) * BN_DATA.passiveGuardMul)) + ' 的傷害';
      return '替' + (P.protect ? bntFigName(P.protect) + '或' : '') + bntTg(target === 'self' || !target ? 'ally_lowest' : target, 'ally_lowest') + '承受 ' + bntPct(Math.min(1, bntKT(kind, pw) * (d.cat === 'passive' ? BN_DATA.passiveGuardMul : 1))) + ' 的傷害' + (d.cat === 'passive' ? '' : ',持續 1 回合');
    case 'reorder': return target === 'self' || !target ? '自身下一次行動插隊最先出手(速度 +' + Math.round(bntKT('reorder_spd', pw)) + ')' : '令' + bntTg(target, 'ally_one') + '立即插隊出手';
    case 'swap': return target === 'enemy_front' ? '使敵方前排一人與後排一人互換站位' : (target === 'ally_lowest' ? '與兵力最低的友軍交換站位,替其頂上火線' : '與我方一名後排交換站位');
    case 'evade': return bntTg(target, 'self') + '規避接下來 ' + bntS(P.charges, bntKT(kind, pw)) + ' 次攻擊(完全不受傷)' + (typeof P.dur === 'number' ? ',限 ' + P.dur + ' 回合內' : '');
    case 'dodge_rate': return bntTg(target, 'self') + '獲得閃避:被攻擊時有 ' + bntPct(typeof P.val === 'number' ? P.val : bntKT(kind, pw)) + ' 機率閃開(持續傷害與反擊除外;沉睡中無效;「無視規避」與揭穿可破解)' + (typeof P.dur === 'number' ? ',持續 ' + P.dur + ' 回合' : dur);
    case 'stealth': return bntTg(target, 'self') + '進入隱匿' + (P.dur === 'battle' ? '(全程)' : ' ' + bntS(P.dur, bntKT('stealth_dur', pw)) + ' 回合') + ':不會被敵方' + (P.vs === 'single' ? '單體' : (Array.isArray(P.vs) ? '狙擊' : '單體')) + '技能選為目標(範圍技仍會命中)';
    case 'immune': s = bntList(P.types); return bntTg(target, 'self') + '免疫' + (s || '指定狀態') + (P.firstOnly ? '(僅首次)' : '');
    case 'resist': return '獲得 ' + bntS(P.layers, 1) + ' 層抵禦(可擋下下一次' + (P.guard ? bntStName(P.guard) : '負面效果') + '),持續 ' + bntS(P.dur, BN_DATA.ward.dur) + ' 回合';
    case 'heal_reduce': return '使' + bntTg(target, 'enemy_one') + (P.ratio >= 100 ? '完全無法被治療(禁療)' : '受到的治療 −' + bntS(P.ratio, 50) + '%') + (P.turns === 'battle' ? '(全程)' : ' ' + bntS(P.turns, BN_DATA.hb.defaultTurns) + ' 回合');
    case 'cd_reduce': return '縮短' + (target && target !== 'self' ? bntTg(target) : '自身') + '技能冷卻 ' + (typeof P.amount === 'number' ? P.amount : bntKT(kind, pw)) + ' 回合';
    case 'cd_reset': return '使' + bntTg(target, 'ally_all') + '的技能冷卻全部歸零';
    case 'extra_turn': return bntTg(target, 'ally_all') + '立即額外行動一次' + (P.normalOnly ? '(僅普通攻擊)' : '');
    case 'self_sacrifice': if (P.trigger === 'hp_below_30') return '立刻退場,把剩下的兵力化為:' + (P.gain && P.gain.kind ? bntClause(P.gain.kind, P.gain.target || 'ally_all', P.gain.power || pw, P.gain.params || {}, d, true) : '額外效果');
      return '自損 ' + bntPct(P.hpCost || 0.1) + ' 兵力,換取:' + (P.gain && P.gain.kind ? bntClause(P.gain.kind, P.gain.target || target, P.gain.power || pw, P.gain.params || {}, d, true) : '額外效果');
    case 'summon': n = P.count || 1; return '召來 ' + n + ' 名' + bntS(P.unit, '援兵') + (P.mode === 'attacker' ? '助戰,每回合攻擊敵方' : '擋在前方承受傷害') + ',持續 ' + bntS(P.dur, 2) + ' 回合';
    case 'trap': return '布下伏兵:' + bntTg(target, 'enemy_all') + '中下一個行動的敵人遭伏擊,' + (P.effect && P.effect.kind ? bntClause(P.effect.kind, 'enemy_one', pw, P.effect, d, true).replace(/^使敵方單體/, '') : '受到打擊');
    case 'stack_charge': return (P.gainOn && BNT_TRIG[P.gainOn] ? BNT_TRIG[P.gainOn] : '條件達成時') + '累積層數(最多 ' + bntS(P.max, 3) + ' 層),層數越多效果越強(每層約 +' + bntPct(bntKT('stat_charge', pw)) + ')';
    case 'undying': return '兵力不會降到 ' + bntS(P.minHp, 1) + ' 點以下' + (P.once ? '(首次致命傷時觸發,每場一次)' : '(持續 ' + bntS(P.dur, bntKT('undying_dur', pw)) + ' 回合)');
    case 'debuff_multi':
      s = []; (P.list || []).forEach(function (it) { s.push(bntStName(it.st) + bntPct(it.chance || 0)); });
      return '使' + bntTg(target, 'enemy_one') + '各自有機率承受:' + s.join('、') + '(每項獨立判定)';
    case 'reflect': return bntTg(target, 'self') + '受到傷害時反彈 ' + bntPct(bntKT(kind, pw)) + ' 的傷害給攻擊者(每擊上限 8% 攻擊者兵力)' + dur;
    case 'buff_critdmg': return bntTg(target, 'self') + '暴擊傷害 +' + bntPct(bntKT(kind, pw, sc)) + dur;
    case 'delay_burst': return '埋下引信:' + (P.after || 2) + ' 回合後爆發,對' + bntTg(target, 'enemy_one') + '造成 ' + bntPct(bntKT(kind, pw)) + ' 攻擊 / 謀略傷害(單次上限 ' + bntPct(bntKT('burst_cap', pw)) + ' 兵力)';
    case 'delay_act': return bntTg(target, 'enemy_one') + bntChanceTxt(P) + '本回合排到最後行動(已行動者延到下回合)';
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
  if (P.leech) out.push('造成傷害的 ' + bntPct(P.leech) + ' 回復自身兵力');
  if (P.critAdd) out.push('本戰法暴擊率 +' + bntPct(P.critAdd));
  if (P.critDmg) out.push('本戰法暴擊傷害 +' + bntPct(P.critDmg));
  if (P.forceCrit) out.push('必定暴擊');
  if (P.bounce) out.push('第 2 段起改打隨機敵人(彈射)');
  if (P.n) out.push('隨機選 ' + P.n + ' 名不同的敵人');
  if (P.phase) out.push('第 ' + (P.phase.from || 1) + (P.phase.to ? '~' + P.phase.to : '') + ' 回合才會發動');
  if (P.selfHpBelow) out.push('自身兵力低於 ' + bntPct(P.selfHpBelow) + ' 時才會發動');
  if (P.needStatus) out.push('只會打' + bntStName(P.needStatus) + '的敵人,沒有則不發動');
  if (P.perShield) out.push('每解除 1 個負面狀態,獲得相當於自身護盾基數 ' + bntPct(P.perShield) + ' 的小護盾');
  if (P.flaw && P.flaw.length) out.push('缺點:' + bntList(P.flaw, bntFlawTxt));
  if (P.onlyVs && d.vs) out.push('只有敵方有' + bntVsWho(d.vs) + '時才會發動,並鎖定其為目標');
  if (d.vs && !bntVsOnly(d) && bntVsText(d)) out.push(bntVsText(d));
  if (d.tags && d.tags.indexOf('ice') >= 0) out.push(BNT_RX.ice);
  if (d.tags && d.tags.indexOf('thunder') >= 0) out.push(BNT_RX.thunder);
  return out;
}
// 魔幻組合技(combos rx_ice_shatter / rx_electrocute)白話
var BNT_RX = {
  ice: '寒冰:造成的暈眩 / 速度下降會讓目標「寒凍」;寒凍的敵人被單體重擊時觸發「冰裂」,追加該次傷害 40%(無視防禦)並解除寒冰減速',
  thunder: '雷擊:打中寒凍、剛被水攻或盾兵(金屬甲)的敵人時觸發「感電」,傷害 +15%,電流再傳給相鄰敵人(該次傷害 35%)'
};

function bnSkillResolve(sk) {
  if (typeof sk === 'string') return (typeof BN_SKILLS !== 'undefined') ? BN_SKILLS[sk] : null;
  return sk || null;
}
function bnSkillCatName(sk) { var d = bnSkillResolve(sk); return d ? (BN_TEXT_CATS[d.cat] || '戰法') : ''; }
// 被動帶 attack / defend / both 條件且為 buff_* 等:只在條件成立時生效 → 內文直接寫條件句
function bntVsOnly(d) { return !!(d.vs && d.vs.bonus && d.cat === 'passive' && d.vs.mode !== 'ally' && BNT_VS_ONLY[d.kind]); }
// 發動率:同 bn_engine.js bnRateOf 的基礎部分(不含兵種 / 星數等個別加成)
function bntRate(d) {
  var cat = d.cat === 'pursuit' ? 'pursuit' : 'active', r = d.rate;
  if (d.cat === 'ult') return Math.max(0, Math.min(BN_DATA.rate.ultCap, r === undefined ? BN_DATA.rate.ult : r));
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
  else if (d.cat === 'ult') { a.push('發動率 ' + bntPct(bntRate(d))); a.push('第 ' + BN_DATA.rate.ultFrom + ' 回合起'); if (d.prep) a.push('準備 ' + d.prep + ' 回合'); a.push('冷卻 ' + (typeof d.cd === 'number' ? d.cd : BN_DATA.rate.ultCd) + ' 回合'); }
  else if (d.cat === 'passive' && !(P.trigger && BNT_TRIG[P.trigger])) a.push('全程');
  if ((d.cat === 'active' || d.cat === 'pursuit') && d.cd) a.push('冷卻 ' + d.cd + ' 回合');
  return cat + (a.length ? '(' + a.join('、') + ')' : '');
}
// 內文(不含抬頭)
function bnSkillBody(sk) {
  var d = bnSkillResolve(sk), P, s, notes, trig = '';
  if (!d) return '';
  P = d.params || {};
  s = bntVsOnly(d) ? bntVsText(d) : bntClause(d.kind, d.target || P.target, d.power, P, d, false);
  if (d.vs && d.vs.mode === 'ally' && d.cat === 'passive' && d.kind !== 'self_sacrifice') s = bntVsWho(d.vs) + '在我方時:' + s;
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
  if (m.stT) o.push('統 ' + bntSgn(m.stT));
  if (m.stW) o.push('武 ' + bntSgn(m.stW));
  if (m.stZ) o.push('智 ' + bntSgn(m.stZ));
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
  if (m.takenPct) o.push('受到傷害 ' + bntSgn(m.takenPct, 1));
  if (m.rowAtk) o.push('同排友軍攻擊 ' + bntSgn(m.rowAtk, 1));
  if (m.rowRate) o.push('同排友軍戰法發動率 ' + bntSgn(m.rowRate, 1));
  if (m.immuneFirst) o.push('首次被' + m.immuneFirst.map(function (x) { return bntStName(x); }).join('、') + '時免疫');
  if (m.undyingOnce) o.push('首次致命傷時保留 1 點兵力(每場一次)');
  if (m.gamble) o.push('每場開戰攻擊 ×1.25 或 ×0.85(每場固定)');
  if (m.noFmt) o.push('不吃陣型加成');
  if (m.opening && BNT_OPENING[m.opening]) o.push(BNT_OPENING[m.opening]);
  if (m.fmt) o.push((m.fmt === 'fengshi' ? '鋒矢陣' : m.fmt === 'yuanzhen' ? '圓陣' : '雁行陣') + '加成 ×1.3');
  if (m.fmtAll) o.push('所有陣型加成 ' + bntSgn(m.fmtAll - 1, 1));
  if (m.stratPct) o.push('謀略傷害 ' + bntSgn(m.stratPct, 1));
  if (m.vsFac) Object.keys(m.vsFac).forEach(function (f) { o.push('對' + bntFacName(+f) + '陣營傷害 ' + bntSgn(m.vsFac[f], 1)); });
  if (m.vsFig) o.push('對' + Object.keys(m.vsFig).map(function (f) { return (typeof CARD_FIG_BY_ID !== 'undefined' && CARD_FIG_BY_ID[f]) ? CARD_FIG_BY_ID[f].name : f; }).join('、') + '傷害 ' + bntSgn(m.vsFig[Object.keys(m.vsFig)[0]], 1));
  if (m.vsTroop) Object.keys(m.vsTroop).forEach(function (t) { o.push('對' + t + '兵傷害 ' + bntSgn(m.vsTroop[t], 1)); });
  if (m.takenStrat) o.push('受到謀略傷害 ' + bntSgn(m.takenStrat, 1));
  if (m.lowHpTaken) o.push('兵力低於 ' + bntPct(m.lowHpTaken[0]) + ' 時受到傷害 ' + bntSgn(m.lowHpTaken[1], 1));
  if (m.healOut) o.push('施放的治療量 ' + bntSgn(m.healOut, 1));
  if (m.teamAtk) o.push('我方全隊攻擊 ' + bntSgn(m.teamAtk, 1));
  if (m.teamTakenFac) o.push('我方' + bntFacName(m.teamTakenFac.fac) + '陣營受到傷害 ' + bntSgn(m.teamTakenFac.v, 1));
  if (m.teamTroopSpd) Object.keys(m.teamTroopSpd).forEach(function (t) { o.push('我方' + t + '兵速度 ' + bntSgn(m.teamTroopSpd[t])); });
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
  jiren: '每次城市升級 +10 碎片', mingwang: '「掌櫃」職:名人機率再 ×1.1', fengdian: '智 +10、魅 −20;不能擔任太守和掌櫃'
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
  var s = bntS(desc), ft;
  if (!s) return null;
  ft = bnFigTraitByDesc(s);
  if (ft) return bnFigTraitText(ft);
  return BNT_OLDWAR.test(s) ? null : s;
}
// 名人專屬詞條的戰鬥面(js/bn_data.js BN_FIG_TRAIT)。卡面只傳說明字串,故以「說明 → 名人」反查(說明在 CARD_FIGS 內唯一,test_bn_data 檢查)
var BNT_FT_DESC = null;
function bnFigTraitByDesc(s) {
  if (typeof BN_FIG_TRAIT === 'undefined' || typeof CARD_FIG_BY_ID === 'undefined') return null;
  if (!BNT_FT_DESC) {
    BNT_FT_DESC = {};
    Object.keys(BN_FIG_TRAIT).forEach(function (fid) { var f = CARD_FIG_BY_ID[fid], e = BN_FIG_TRAIT[fid], t = f && f.tr[e.i]; if (t && t[2]) BNT_FT_DESC[String(t[2]).slice(0, 60)] = fid; });
  }
  s = s.slice(0, 60);
  return BNT_FT_DESC[s] ? BN_FIG_TRAIT[BNT_FT_DESC[s]] : null;
}
function bnFigTraitOf(figId, idx) { var e = (typeof BN_FIG_TRAIT !== 'undefined') ? BN_FIG_TRAIT[figId] : null; return e && e.i === (idx | 0) ? e : null; }
function bnFigTraitText(e) {
  var p = bntModsText(e.m);
  return p.length ? '戰鬥中:' + (e.m.troop ? '擔任' + e.m.troop + '兵時' : '') + p.join(';') : null;
}
// cardsui 名人詞條說明浮層的戰鬥面補充(cardsUiInfo kind=xtrait 呼叫;有戰鬥修正者改標「戰事」與討伐生效)
function bnXTraitInfoFix(o, figId, idx) {
  var e = bnFigTraitOf(figId, idx), i;
  if (!e || !o) return o;
  for (i = 0; i < o.tags.length; i++) if (o.tags[i] === '城建') o.tags[i] = '戰事';
  for (i = 0; i < o.lines.length; i++) {
    if (o.lines[i][0] === '效果') o.lines[i][1] = bnFigTraitText(e) || o.lines[i][1];
    if (o.lines[i][0] === '適用職司') o.lines[i][1] = '上陣討伐時';
    if (o.lines[i][0] === '目前生效') o.lines[i][1] = '討伐戰鬥中生效(人物天生特質,上陣即計入)';
  }
  if (e.note) o.lines.splice(1, 0, ['典故', e.note]);
  return o;
}

// ---------- 卡 → 戰法清單 ----------
// 回傳 [{id, role:'passive'|'skill'|'ult'|'native'|'learned'}],依顯示順序;無法取得時回 []
function bnCardSkillIds(card, o) {   // o 可選 {troop}:布陣時依所選兵種(路人大招 / 自動學習隨兵種)
  var spec, out = [], i, fg, nat;
  if (!card || typeof bnUnitSpec !== 'function') return out;
  try { spec = bnUnitSpec(card, o && o.troop ? { troop: o.troop } : {}); } catch (e) { return out; }
  fg = card.fig && typeof BN_FIG_SKILLS !== 'undefined' ? BN_FIG_SKILLS[card.fig] : null;
  var bf = fg && typeof BN_KIT_BY !== 'undefined' && BN_KIT_BY.figs[card.fig] ? (BN_KIT_BY.figs[card.fig].bondFix || []) : [];   // 專屬聯動:不占被動 / 選擇槽
  for (i = 0; i < spec.skills.length; i++) {
    out.push({ id: spec.skills[i], role: fg ? (i === 0 && fg.passive ? 'passive' : (bf.indexOf(spec.skills[i]) >= 0 ? 'bond' : 'slot')) : (i === 0 ? 'native' : 'learned') });   // 名人:被動 / 聯動 / 選擇槽(固定戰法見下方 ult)
  }
  if (spec.ult) out.push({ id: spec.ult, role: 'ult' });
  return out.filter(function (x) { return !!(typeof BN_SKILLS !== 'undefined' && BN_SKILLS[x.id]); });
}
function bnCardSkillRows(card, o) {
  return bnCardSkillIds(card, o).map(function (x) {
    var p = bnSkillParts(x.id), d = BN_SKILLS[x.id];
    return { id: x.id, role: x.role, cat: d.cat, name: d.name, head: p.head, body: p.body, desc: p.desc, cd: d.cd || 0, rate: d.rate, fig: d.fig || '', flavor: (typeof BN_FLAVOR !== 'undefined' && BN_FLAVOR[x.id]) || '' };
  });
}
// ---------- 卡面「戰法」區塊:名稱連結 + 類別小標 + 一行短說明;完整說明在彈窗(cardsui 說明浮層 kind=bnskill,bnSkillInfo) ----------
var BNT_ROLE = { native: '職業預設', learned: '選擇槽', bond: '專屬聯動', slot: '選擇槽', passive: '被動', ult: '固定' };
var BNT_TS = { self: '自身', ally_one: '我單體', ally_all: '我全隊', ally_front: '我前排', ally_back: '我後排', ally_lowest: '我最弱', ally_row: '我同排', enemy_one: '敵單體', enemy_front: '敵前排', enemy_back: '敵後排',
  enemy_all: '敵全隊', enemy_lowest: '敵最弱', enemy_highest_atk: '敵最強', enemy_cross: '敵十字', enemy_col: '敵縱列', members: '夥伴' };
var BNT_KS = {
  heal_single: '回復兵力', heal_all: '回復兵力', heal_hot: '持續回復', shield_single: '加護盾', shield_all: '加護盾', cleanse: '解除負面', revive: '復活', dispel: '驅散增益', counter: '反擊', guard: '承傷', reorder: '插隊出手',
  swap: '換位', rate_up: '發動率提升', rate_down: '發動率下降', buff_steal: '偷取增益', debuff_hit: '命中下降', invert: '陰陽互換', wx_mark: '五行印', evade: '規避攻擊', dodge_rate: '機率閃避', stealth: '隱匿', immune: '免疫控制', resist: '獲得抵禦', heal_reduce: '治療降低', cd_reduce: '縮短冷卻', cd_reset: '冷卻歸零', extra_turn: '額外行動', self_sacrifice: '自損換資源',
  summon: '召喚援兵', trap: '布下伏兵', stack_charge: '累積層數', undying: '死戰不倒', stat_mod: '微調能力', execute_chain: '擊倒連動', stun: '暈眩', sleep: '沉睡', paralyze: '麻痺', silence: '沉默', timid: '怯戰', bind: '定身', confuse: '擾亂',
  taunt: '嘲諷', fear: '威懾', mark: '標記易傷', dot_burn: '燃燒', dot_poison: '中毒', dot_bleed: '流血', dot_spread: '火勢蔓延'
};
function bntShortCut(t) { var a = Array.from(t); return a.length > 16 ? a.slice(0, 16).join('') : t; }
// 一行短效果(≤16 字)
function bnSkillShort(sk) {
  var d = bnSkillResolve(sk), k, pw, sc, T, o;
  if (!d) return '';
  k = d.kind; pw = d.power || 'M'; sc = bntScale(d, k, d.params || {});
  T = BNT_TS[d.target] || (/^(atk|dot|execute|lifesteal|stun|sleep|paralyze|silence|timid|bind|confuse|fear|mark|debuff|rate_down|buff_steal|invert|wx_mark|dispel|heal_reduce)/.test(k) ? '敵單體' : '自身');
  if (/^atk_|^lifesteal$|^execute_chain$/.test(k) && d.cat !== 'passive') o = T + ' ' + bntPct(bntKT(k, pw)) + (d.dmg === 'strat' ? ' 謀略傷' : ' 傷害');
  else if (k === 'buff_atk' || k === 'buff_def' || k === 'buff_crit') o = T + (k === 'buff_atk' ? '攻擊' : k === 'buff_def' ? '防禦' : '暴擊') + ' +' + bntPct(bntKT(k, pw, sc));
  else if (k === 'buff_spd') o = T + '速度 +' + Math.round(bntKT(k, pw, sc));
  else if (k === 'buff_all') o = T + '攻防速 +' + bntPct(bntKT(k, pw, sc));
  else if (k === 'debuff_atk' || k === 'debuff_def') o = T + (k === 'debuff_atk' ? '攻擊' : '防禦') + ' −' + bntPct(bntKT(k, pw));
  else if (k === 'debuff_spd') o = T + '速度 −' + Math.round(bntKT(k, pw));
  else if (k === 'rate_up') o = T + '發動率 +' + bntPct(bntKT(k, pw, sc));
  else if (k === 'rate_down') o = T + '發動率 −' + bntPct(bntKT(k, pw));
  else o = T + (BNT_KS[k] || '特殊效果');
  if (bntVsOnly(d)) o = (d.vs.mode === 'defend' ? '被' : '對') + bntVsWho(d.vs) + '時強化';
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
  else { lines.push(['用法', d.cat === 'ult' ? '大招式戰法:發動率低、威力大,第 ' + BN_DATA.rate.ultFrom + ' 回合起每次行動擲骰,依兵種而定。' : '依發動率自動施放,不需操作。']); lines.push(['適合搭配', bntFitText(d)]); }
  if (d.vs && bntVsText(d)) lines.splice(2, 0, ['對象條件', bntVsText(d)]);
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

// ───────── 兵種克制(資料取自 BN_DATA.prey;戰前布陣 / 圖鑑 / 戰報共用)─────────
// a 打 d 的關係:1 = a 克制 d(a 傷害 ×prey>1)、−1 = a 被 d 克制(a 傷害 ×prey<1,或 d 克制 a)、0 = 無。未知兵種 = 0
function bnPreyRel(a, d) {
  var P = BN_DATA.prey, x = P[a] && P[a][d], y = P[d] && P[d][a];
  if (x > 1) return 1;
  if (x < 1 || y > 1) return -1;
  return 0;
}
// troop 對一串兵種(敵方單位的兵種陣列)的克制數:{up: 克制幾個, down: 被幾個克制}
function bnPreyCounts(troop, others) {
  var o = { up: 0, down: 0 };
  (others || []).forEach(function (t) { var r = bnPreyRel(troop, t); if (r > 0) o.up++; else if (r < 0) o.down++; });
  return o;
}
// 克制關係白話:『槍克騎、騎克盾、騎克謀、盾克弓、弓克槍』(順序依 troopList)
function bnPreyText() {
  var P = BN_DATA.prey, out = [];
  BN_DATA.troopList.forEach(function (a) { BN_DATA.troopList.forEach(function (d) { if (P[a] && P[a][d] > 1) out.push(a + '克' + d); }); });
  return out.join('、');
}
// 倍率說明:『克制方物理傷害 +25%、被克制方 −20%;謀略(法術)傷害不吃兵種克制』
function bnPreyRule() {
  var P = BN_DATA.prey, hi = 1, lo = 1;
  Object.keys(P).forEach(function (a) { Object.keys(P[a]).forEach(function (d) { if (P[a][d] > hi) hi = P[a][d]; if (P[a][d] < lo) lo = P[a][d]; }); });
  return '克制方的物理傷害 +' + Math.round((hi - 1) * 100) + '%、被克制方 −' + Math.round((1 - lo) * 100) + '%;謀略(法術)傷害不吃兵種克制';
}
// 各兵種的克制表:[{t, beats:[克制哪些兵種], beaten:[被哪些兵種克制]}](順序依 troopList)
function bnPreyRows() {
  return BN_DATA.troopList.map(function (t) {
    var b = [], c = [];
    BN_DATA.troopList.forEach(function (d) { var r = bnPreyRel(t, d); if (r > 0) b.push(d); else if (r < 0) c.push(d); });
    return { t: t, beats: b, beaten: c };
  });
}
// B3 兵種卡說明:優點 / 弱點白話 + 倍率(本人 ×1.0、同兵種隊友 ×0.5)。來源 BN_LEGION.cards[id](無資料回 null)
function bnLegionText(id) {
  var L = (typeof BN_LEGION !== 'undefined' && BN_LEGION.cards && BN_LEGION.cards[id]) || null;
  if (!L) return null;
  return {
    name: L.name, troop: L.troop,
    pros: L.proText || '', cons: L.conText || '',
    share: '裝備者本人 ×1.0;同兵種隊友 ×0.5(優點與弱點同比例)',
    note: L.provisional ? '原型卡,名稱與數值暫定' : ''
  };
}

if (typeof module !== 'undefined' && module.exports) module.exports = { bnSkillText: bnSkillText, bnTraitText: bnTraitText, bnPreyRel: bnPreyRel, bnPreyText: bnPreyText, bnPreyRows: bnPreyRows, bnPreyRule: bnPreyRule, bnPreyCounts: bnPreyCounts, bnLegionText: bnLegionText };

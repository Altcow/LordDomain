// js/bn_data.js — 戰鬥 A 模式(討伐戰)參數與係數(PLAN_BATTLE_A §2、§3.4、§4.1~§4.3、§4.11)。
// 全部數字皆 PLACEHOLDER,集中在這一個檔;調參只改此檔(tools/bn_sim.js --tune 的建議對象)。不寫 DOM、不讀時間。ES2017,不用 ?. ??。
// 全域:BN_DATA(係數)BN_TRAIT_MODS(詞條 → 戰鬥修正)BN_BONDS(陣營 / 職業標籤 / 特殊組合羈絆)。B1 範圍:僅純邏輯。
var BN_DATA = {
  v: 1,
  K: 1.6,                      // 傷害總係數(§3.4)
  maxRound: 8,                 // 回合上限
  critMul: 1.5,
  jitter: 0.10,                // 浮動 ±5 %:0.95 + 0.10 × r
  grade: [1.00, 1.04, 1.08, 1.12, 1.16],          // 品階係數 g(§2.1)
  apt: { S: 1.10, A: 1.00, B: 0.90, C: 0.80 },    // 兵種適性係數 a
  aptCut: { S: 85, A: 70, B: 55 },                // 適性分門檻
  aptJob: 12, aptJobTier: 6,                      // 職業加權 / 職業階 III 以上再加
  effKnee: [80, 100], effSlope: [0.5, 0.25],      // 五維遞減(≤80 線性;81~100 斜率 0.5;>100 斜率 0.25)
  // 屬性公式係數 [常數, 統, 武, 智, 政](§2.1)
  f: {
    hp: [150, 4, 2, 0, 0], atk: [30, 0.2, 1, 0, 0], mag: [30, 0, 0, 1, 0.2], def: [10, 0.5, 0.1, 0, 0],
    sres: [10, 0, 0, 0.4, 0.2], spd: [50, 0, 0.3, 0.2, 0], heal: [20, 0, 0, 0.6, 0.8], sh: [40, 1.5, 0, 0, 0.5]
  },
  critBase: 0.05, critPerPt: 0.0015, critFrom: 50,  // 暴擊率 5 % + (主屬 − 50) × 0.15 %
  resPer: 0.004, resFrom: 40, resMax: 0.25,        // 減益抵抗 RES
  moraleStart: [15, 0.3], moraleGainBase: 0.8, moraleGainPerM: 1 / 250,
  // 兵種(§2.2)
  troops: {
    '盾': { hp: 1.30, atk: 0.80, def: 1.40, spd: -10, R: 1 },
    '步': { hp: 1.10, atk: 1.05, def: 1.00, spd: 0, R: 1 },
    '騎': { hp: 1.00, atk: 1.15, def: 0.85, spd: 20, R: 2 },
    '弓': { hp: 0.85, atk: 1.05, def: 0.75, spd: 8, R: 3 },
    '謀': { hp: 0.80, atk: 0.70, def: 0.70, spd: 5, R: 3 }
  },
  troopList: ['盾', '步', '騎', '弓', '謀'],
  normalMag: 0.8,              // 謀兵種普攻 strat 0.8 × MAG
  prey: { '盾': { '步': 0.8, '騎': 1.25 }, '步': { '盾': 1.25, '弓': 0.8 }, '騎': { '盾': 0.8, '弓': 1.25, '謀': 1.25 }, '弓': { '步': 1.25, '騎': 0.8 } },
  blockPct: 0.15,              // 盾兵格擋 = floor(0.15 × DEF)(每段 phys)
  cavCharge: 1.2,              // 騎兵每場第一次普攻
  archerBackTaken: 0.9,        // 弓站後排受近戰普攻
  mageRateBonus: 0.05,         // 謀兵種主動戰法發動率 +5 pp
  // 士氣(§4.1)
  morale: { max: 100, act: 15, hit: 8, kill: 20, allyDown: -10, idle: 15, chainCapPerRound: 30 },
  // 目標選擇
  pickPrey: 100, pickLowHp: 50,
  // 戰法發動率 / 冷卻預設(§4.2)
  rate: { active: { S: 0.50, M: 0.40, L: 0.35, XL: 0.35 }, pursuit: { S: 0.40, M: 0.35, L: 0.30, XL: 0.30 }, prepBonus: 0.10, cap: 0.70 },
  cd: { S: 1, M: 2, L: 3, XL: 3 },
  passiveMul: 0.5,             // 被動 / 持續指揮的數值 = 主動同 power × 0.5
  defaultRounds: 3,            // 指揮戰法預設持續
  buffRounds: 2, buffRoundsXL: 3,
  clamp: { lo: -0.5, hi: 0.6 }, spdMin: 30,
  // kind 倍率表 [S, M, L, XL](§4.3)
  kinds: {
    atk_single: [1.3, 1.7, 2.2, 2.8], atk_front: [0.6, 0.8, 1.0, 1.3], atk_back: [1.0, 1.3, 1.7, 2.2], atk_all: [0.4, 0.55, 0.7, 0.9],
    atk_pierce: [0.6, 0.8, 1.0, 1.3], atk_cross: [0.5, 0.7, 0.9, 1.1], atk_multi: [0.45, 0.55, 0.7, 0.85], atk_snipe: [1.1, 1.4, 1.8, 2.3],
    atk_exec: [1.0, 1.3, 1.6, 2.0], execute_chain: [1.0, 1.35, 1.75, 2.2], lifesteal: [1.3, 1.7, 2.2, 2.8], dot_spread: [0.4, 0.55, 0.7, 0.9],
    stun: [0, 0.5, 0.8, 1.0],
    heal_single: [1.0, 1.4, 1.8, 2.4], heal_all: [0.4, 0.55, 0.7, 1.0], heal_hot: [0.2, 0.3, 0.4, 0.5],
    shield_single: [1.0, 1.5, 2.0, 2.5], shield_all: [0.4, 0.6, 0.8, 1.1],
    cleanse: [1, 2, 99, 99], revive: [0.2, 0.3, 0.4, 0.5],
    buff_atk: [0.10, 0.15, 0.20, 0.30], buff_def: [0.10, 0.15, 0.20, 0.30], buff_spd: [8, 12, 16, 22], buff_crit: [0.08, 0.12, 0.16, 0.24], buff_all: [0.05, 0.08, 0.10, 0.15], buff_all_spd: [5, 8, 10, 15],
    morale_up: [15, 25, 35, 50], inspire: [10, 15, 20, 30], inspire_atk: [0.06, 0.08, 0.10, 0.15],
    debuff_atk: [0.10, 0.15, 0.20, 0.30], debuff_def: [0.10, 0.15, 0.20, 0.30], debuff_spd: [8, 12, 16, 22], morale_down: [15, 25, 35, 50], mark: [0.10, 0.15, 0.20, 0.30],
    silence: [1, 1, 2, 2], taunt: [1, 2, 2, 3], taunt_def: [0, 0.10, 0.20, 0.30], fear: [15, 20, 25, 35], fear_skip: [0.20, 0.30, 0.40, 0.50], bind: [1, 1, 1, 2],
    dot_burn: [0.15, 0.20, 0.25, 0.30], dot_poison: [0.03, 0.04, 0.05, 0.06], dot_bleed: [0.15, 0.20, 0.25, 0.30],
    counter: [0.4, 0.5, 0.6, 0.8], reorder_spd: [0, 5, 10, 15], guard: [0.3, 0.5, 0.7, 1.0], lifesteal_pct: [0.2, 0.3, 0.4, 0.5],
    evade: [1, 1, 2, 2], confuse: [1, 1, 2, 2], timid: [1, 1, 1, 2], dispel: [1, 2, 99, 99], dispel_shield: [0, 0.5, 1, 1],
    cd_reduce: [1, 1, 2, 2], summon_hp: [0.15, 0.25, 0.35, 0.5], summon_atk: [0.4, 0.55, 0.7, 0.9],
    stat_charge: [0.03, 0.04, 0.05, 0.06],      // stack_charge 每層加成
    execute_chain_stack: [0.05, 0.08, 0.10, 0.15], undying_dur: [1, 2, 2, 3], stealth_dur: [1, 1, 2, 2], immune_dur: [2, 2, 3, 3]
  },
  dotRounds: 2, dotRoundsXL: 3, poisonRounds: 3, poisonHeal: 0.5,
  burnTickK: 1,
  healCap: { single: 0.35, xl: 0.50, round: 0.40, second: 0.7, third: 0.5 },
  shieldDur: 2, shieldCap: 0.40, pierceShield: 1.5,
  // 禁療 / 抵禦(§4.11、SCHEMA C):發動率與持續集中在 skills json 的 params.healBlock / params.resist;此處只放引擎參數
  hb: { rateScale: 1.0, defaultRatio: 50, defaultTurns: 3, ratio100Turns: 2 },
  ward: { maxLayers: 2, dur: 3, rateScale: 1.0 },
  ccImmRounds: 1,              // 強控後抗控
  // 疲兵(§4.11):第 5 回合起 受傷 +10 %/回合、受療 −10 %/回合,累加
  fatigue: { start: 5, dmg: 0.10, heal: 0.10 },
  // 連鎖(§3.10、combos partC)
  chain: { stepCap: 8, maxDepth: 3, followUpPerUnit: 1, extraActionPerUnit: 1, extraActionPerTeam: 2, comboHitBonus: 0.05, comboHitCap: 0.25, targetDmgCapPct: 0.60, teamDmgCapPct: 0.40, assistKillRecast: false, ultAssistMul: 0.5, assistBasicMul: 1.0, assistSmallMul: 0.7, recastDefaultMax: 2, recastDefaultDecay: 0.7, ultRecastMax: 2, ultRecastDecay: 0.7 },
  counterPerAttacker: 1,
  // 第 1 回合限制:atk_all 且 power ≥ L 的非大招戰法起手冷卻 1(§4.9)
  cd0AllL: true,
  // 召喚 / 伏兵等雜項
  summonMax: 2,
  stackKillAtk: 0.05,
  bonusVs: { S: 0.2, M: 0.4, L: 0.7, XL: 1.0 },       // params.bonusVsStatus.mult 檔位 → 加成
  stepMul: { S: 0.05, M: 0.08, L: 0.12, XL: 0.15 },   // perFacAlly / perAlly / crowd_scale 每階加成
  chanceMap: { S: 0.5, M: 0.7, L: 0.9, XL: 1.0 },     // 控制類 params.chance 檔位 → 機率
  followMul: { S: 0.6, M: 0.9, L: 1.2, XL: 1.6 },     // 羈絆 follow_up 的普攻倍率
  passiveGuardMul: 0.8,                                // 被動援護比例 = guard 表 × 此值(上限 0.5)
  rxBurnDot: 0.15,                                     // 連環延燒給的燃燒倍率
  // 羈絆累計上限(§2.6)
  bondCap: { atk: 0.20, hp: 0.10 },
  // 疲兵之外的平手判定(§3.7)
  drawLead: 0.15,
  // 站位陣型(§2.7):前排 ≥3 鋒矢 / 前2中≥1 圓陣 / 後排≥2 雁行
  formation: { fengshi: 0.08, yuanzhen: 0.08, yanxing: 0.08 }
};

// 詞條 → 戰鬥修正(§2.7;只列戰鬥面;未列者無戰鬥效果)。欄位語意見 bn_engine.js 的 u.mods
var BN_TRAIT_MODS = {
  shanshe: { atkTroop: { '弓': 0.06 } },
  shenshe: { atkTroop: { '弓': 0.12 }, reach: 1 },
  xianzhen: { r1Dmg: 0.15 },
  xiandeng: { vsShield: 0.15 },
  pocheng: { vsShield: 0.10 },
  qishe: { takenRanged: -0.10, troop: '騎' },
  tuji: { firstHit: 0.15 },
  jianshou: { frontTaken: -0.08 },
  liyong: { stW: 5 },
  wanren: { atk: 0.10 },
  kangqi: { takenFromTroop: { '騎': 0.8 } },
  busheshe: { atkTroop: { '弓': -0.08 }, atkMelee: 0.03 },
  zhijun: { allyDownMorale: 0.85 },
  tixu: { lowHp: [0.3, 0.10] },
  fengshi: { fmt: 'fengshi' },
  yuanzhen: { fmt: 'yuanzhen' },
  yanxing: { fmt: 'yanxing' },
  bazhen: { fmtAll: 1.15 },
  chengbing: { hp: 0.08 },
  guwu: { roundStartRowMorale: 5 },
  suwei: { rowTakenFront: -0.10 },
  yanfa: { allyDownMorale: 0.75 },
  huogong: { burnOut: 1.5 },
  guantian: { r1Spd: 10 },
  ditinq: { immuneFirst: ['reorder', 'swap'] },
  shibing: { immuneFirst: ['stun'] },
  maifu: { firstHit: 0.20 },
  gongjiang: { shieldOut: 0.15 },
  yishu: { opening: 'yibing' },
  suanwu: { magMul: 1.15 },
  shuigong: { scene: { water: { dmgStrat: 0.10 } } },
  duomou: { stZ: 8, spd: -8 },
  jinshen: { critTaken: -0.15, spd: -3 },
  lumang: { atk: 0.06, critTaken: 0.20 },
  zhongyi: { immuneAllyDown: 1 },
  fanfu: { atk: 0.08 },
  gaoao: { stT: 4 },
  baonue: { atk: 0.08 },
  weihuo: { burnTaken: 1.4 },
  qingdi: { early2: 0.10, lateTaken: 0.05 },
  kuanhou: { rowMoraleGain: 0.10 },
  dutu: { gamble: 1 },
  jiuxian: { atk: 0.12, noFmt: 1 },
  fujiang: { undyingOnce: 1, atk: -0.05 },
  qihuo: { lowHp: [0.5, 0.15] },
  shusheng: { atk: -0.05 },
  yishu2: { healTaken: 0.10 },
  shunhua: {},
  chengyu: { scene: { rain: { atk: 0.10 } } },
  shuoke: {}, zhoushi: { scene: { water: { atk: 0.08 } } }, shanzhan: { scene: { hill: { atk: 0.10 } } },
  tianzhen: { allMul: 0.9 }
};

// 羈絆(§2.6;PLACEHOLDER)。陣營 / 職業標籤由 bn_units.js bnBondsOf 計算;特殊組合另走 combos.json partB(BN_COMBOS.bonds)
var BN_BONDS = {
  fac: { 3: { atk: 0.05 }, 4: { atk: 0.08 }, 5: { atk: 0.10, hp: 0.05 } },     // 魏蜀吳黃巾;中立不計
  tag: {                                                                       // 同標籤 2 人生效
    '將門': { defFront: 0.08 }, '士人': { strat: 0.08 }, '醫者': { heal: 0.15 }, '工匠': { shield: 0.12 }, '農家': { hp: 0.06 },
    '官僚': { res: 0.08 }, '方士': { morale0: 15 }, '商賈': { gold: 0.10 }, '水軍': { spd: 5 }
  },
  special: [   // 名人組合(戰前算好,戰中只查表)
    { id: 'sp_enruo', name: '恩若兄弟', members: ['liubei', 'guanyu', 'zhangfei'], need: 3, moraleGain: 0.20 },
    { id: 'sp_tiangong', name: '天公地公人公', members: ['zhangjiao', 'zhangbao', 'zhangliang'], need: 3, strat: 0.12 },
    { id: 'sp_yingchuan', name: '潁川之士', members: ['xunyu', 'xunyou', 'guojia', 'zhongyao'], need: 2, cdMinus: 1 },
    { id: 'sp_baima', name: '白馬義從', members: ['gongsunzan', 'zhaoyun'], need: 2, cavSpd: 8 }
  ],
  maxSpecial: 3
};

if (typeof module !== 'undefined' && module.exports) module.exports = { BN_DATA: BN_DATA, BN_TRAIT_MODS: BN_TRAIT_MODS, BN_BONDS: BN_BONDS };

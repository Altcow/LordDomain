// js/bn_data.js — 戰鬥 A 模式(討伐戰)參數與係數(PLAN_BATTLE_A §2、§3.4、§4.1~§4.3、§4.11)。
// 戰鬥改版(2026-11-06):拿掉士氣 / 氣力;所有戰法(含大招)每回合各自擲發動率;新增對象條件 vs、五行、發動率增減等。
// 全部數字皆 PLACEHOLDER,集中在這一個檔;調參只改此檔(tools/bn_sim.js --tune 的建議對象)。不寫 DOM、不讀時間。ES2017,不用 ?. ??。
// 全域:BN_DATA(係數)BN_TRAIT_MODS(詞條 → 戰鬥修正)BN_FIG_TRAIT(名人專屬詞條 → 戰鬥修正,B4)BN_FIG_TUNE(名人強度校正,B6)BN_BONDS(陣營 / 職業標籤 / 特殊組合羈絆)。僅純邏輯。
var BN_DATA = {
  v: 1,
  K: 1.0,                      // 傷害總係數(§3.4);B1 調參 1.6 → 1.73;戰鬥改版(多戰法同時發動 + 放完戰法仍普攻 + cdCut)1.73 → 1.0,維持 5~7 回合
  maxRound: 10,                // 回合上限(單一來源;2026-11-09 使用者決議 50 → 10:讓慢熱 / 爆發型戰法節奏都有空間;到上限依剩餘兵力比例判定,較高者勝)
  roundPhase: { earlyTo: 3, lateFrom: 7 },   // 節奏分段(前期 1~3、中期 4~6、後期 7~maxRound);之後加『第 N 回合起 / 前 N 回合』效果請走 bnRoundPhase / bnRoundIn
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
  // 兵種(§2.2)
  troops: {
    // 2026-11-09 兵種克制改版:原『步』更名『槍』並與其他兵種一起依 tools/bn_troop_matrix.js 矩陣重調(槍 hp / atk / def 上調、騎 atk / spd 下調、盾 hp / def 略降 atk 上調、弓 hp / atk 上調、謀 hp / def 上調)
    '槍': { hp: 1.15, atk: 1.12, def: 1.05, spd: 0, R: 1 },
    '騎': { hp: 1.00, atk: 1.08, def: 0.85, spd: 16, R: 2 },
    '盾': { hp: 1.20, atk: 0.88, def: 1.25, spd: -10, R: 1 },
    '弓': { hp: 1.00, atk: 1.12, def: 0.75, spd: 8, R: 3 },
    '謀': { hp: 1.05, atk: 0.70, def: 0.80, spd: 5, R: 3 }
  },
  troopList: ['槍', '騎', '盾', '弓', '謀'],   // 順序 = 克制循環 槍 > 騎 > 盾 > 弓 > 槍(謀不在循環內)
  troopAlias: { '步': '槍' },                    // 舊存檔 / 舊隊伍碼的兵種名正規化(bnTroopNorm)
  normalMag: 0.8,              // 謀兵種普攻 strat 0.8 × MAG
  // 兵種克制(物理傷害 phys;謀略 strat 不吃):prey[攻方][守方] = 傷害倍率。循環 槍 > 騎 > 盾 > 弓 > 槍(克制 ×1.3、被克 ×0.8);騎另克謀 ×1.3
  prey: { '槍': { '騎': 1.3, '弓': 0.8 }, '騎': { '盾': 1.3, '槍': 0.8, '謀': 1.3 }, '盾': { '弓': 1.3, '騎': 0.8 }, '弓': { '槍': 1.3, '盾': 0.8 } },
  blockPct: 0.15,              // 盾兵格擋 = floor(0.15 × DEF)(每段 phys)
  cavCharge: 1.2,              // 騎兵每場第一次普攻
  archerBackTaken: 0.9,        // 弓站後排受近戰普攻
  mageRateBonus: 0.05,         // 謀兵種主動戰法發動率 +5 pp
  // 目標選擇
  pickPrey: 100, pickLowHp: 50,
  // 戰法發動率 / 冷卻預設(§4.2)。每次行動:每個主動戰法與大招各自擲骰(可同時放好幾個),普攻後每個追擊戰法各自擲骰。
  // ult = 大招(大招式戰法)預設發動率(json 有 rate 者以 json 為準);ultCap = 大招發動率上限;ultFrom = 第幾回合起可發動;ultCd = 大招發動後冷卻回合
  rate: { active: { S: 0.50, M: 0.40, L: 0.35, XL: 0.35 }, pursuit: { S: 0.40, M: 0.35, L: 0.30, XL: 0.30 }, ult: 0.15, ultCap: 0.45, ultFrom: 2, ultCd: 3, prepBonus: 0.10, cap: 0.70, healBoost: 0.25 },   // healBoost:主動治療戰法的發動率加成(調參用)
  cd: { S: 1, M: 2, L: 3, XL: 3 },
  cdCut: 1,                    // 戰鬥改版:主動 / 追擊戰法冷卻一律 −1(最少 1;大招不受影響)
  passiveMul: 0.5,             // 被動 / 持續指揮的數值 = 主動同 power × 0.5
  defaultRounds: 3,            // 指揮戰法預設持續
  buffRounds: 2, buffRoundsXL: 3,
  clamp: { lo: -0.5, hi: 0.6 }, spdMin: 30,
  // kind 倍率表 [S, M, L, XL](§4.3)
  kinds: {
    atk_single: [1.3, 1.7, 2.2, 2.38], atk_front: [0.6, 0.8, 1.0, 1.1], atk_back: [1.0, 1.3, 1.7, 1.87], atk_all: [0.4, 0.55, 0.7, 0.77],
    atk_pierce: [0.6, 0.8, 1.0, 1.1], atk_cross: [0.5, 0.7, 0.9, 0.94], atk_multi: [0.45, 0.55, 0.7, 0.72], atk_snipe: [1.1, 1.4, 1.8, 1.96],
    atk_exec: [1.0, 1.3, 1.6, 1.7],   // 攻擊類 XL 檔(大招)B1 調參 ×0.85
    execute_chain: [1.0, 1.35, 1.75, 2.2], lifesteal: [1.3, 1.7, 2.2, 2.8], dot_spread: [0.4, 0.55, 0.7, 0.9],
    stun: [0, 0.5, 0.8, 1.0],
    heal_single: [4.0, 5.6, 7.2, 9.6], heal_all: [1.6, 2.2, 2.8, 4.0], heal_hot: [0.8, 1.2, 1.6, 2.0],   // B1 調參 ×4(實際多半被單次 35% 上限截斷)
    shield_single: [1.0, 1.5, 2.0, 2.5], shield_all: [0.4, 0.6, 0.8, 0.9],   // shield_all XL 1.1 → 0.9(金城湯池過強)
    cleanse: [1, 2, 99, 99], revive: [0.2, 0.3, 0.4, 0.5],
    buff_atk: [0.10, 0.15, 0.20, 0.30], buff_def: [0.10, 0.15, 0.20, 0.30], buff_spd: [8, 12, 16, 22], buff_crit: [0.08, 0.12, 0.16, 0.24], buff_all: [0.05, 0.08, 0.10, 0.15], buff_all_spd: [5, 8, 10, 15],
    rate_up: [0.05, 0.10, 0.15, 0.20], rate_down: [0.05, 0.10, 0.15, 0.20],   // 戰法發動率 ± 百分點(取代士氣類)
    debuff_atk: [0.10, 0.15, 0.20, 0.30], debuff_def: [0.10, 0.15, 0.20, 0.30], debuff_spd: [8, 12, 16, 22], debuff_hit: [0.15, 0.25, 0.35, 0.45], mark: [0.10, 0.15, 0.20, 0.30],
    silence: [1, 1, 2, 2], taunt: [1, 2, 2, 3], taunt_def: [0, 0.10, 0.20, 0.30], fear_skip: [0.20, 0.30, 0.40, 0.50], bind: [1, 1, 1, 2],
    dot_burn: [0.15, 0.20, 0.25, 0.30], dot_poison: [0.03, 0.04, 0.05, 0.06], dot_bleed: [0.15, 0.20, 0.25, 0.30],
    counter: [0.4, 0.5, 0.6, 0.8], reorder_spd: [0, 5, 10, 15], guard: [0.3, 0.5, 0.7, 1.0], lifesteal_pct: [0.2, 0.3, 0.4, 0.5],
    dodge_rate: [0.20, 0.25, 0.35, 0.45],   // 機率閃避(2026-11-09):被攻擊時閃開的機率;技能 params.val 可覆寫
    evade: [1, 1, 2, 2], confuse: [1, 1, 2, 2], timid: [1, 1, 1, 2], dispel: [1, 2, 99, 99], dispel_shield: [0, 0.5, 1, 1], buff_steal: [1, 1, 2, 3], invert: [1, 1, 2, 3],
    cd_reduce: [1, 1, 2, 2], summon_hp: [0.15, 0.25, 0.35, 0.5], summon_atk: [0.4, 0.55, 0.7, 0.9],
    stat_charge: [0.03, 0.04, 0.05, 0.06],      // stack_charge 每層加成
    execute_chain_stack: [0.05, 0.08, 0.10, 0.15], undying_dur: [1, 2, 2, 3], stealth_dur: [1, 1, 2, 2], immune_dur: [2, 2, 3, 3],
    sleep: [2, 2, 3, 3], paralyze: [1, 1, 2, 2]   // 睡眠 / 麻痺持續回合(2026-11-09 新增)
  },
  // 睡眠(sleep):期間無法行動、不會閃避;受攻擊傷害(不含持續傷害)時 wake 機率被喚醒;醒來(到期 / 驚醒 / 淨化)後 immRounds 回合內免疫睡眠
  sleep: { wake: 0.45, immRounds: 2 },
  // 麻痺(paralyze):每次行動前 skip 機率無法行動、速度 ×(1 − spd);雷電系戰法施加時傳導給目標十字相鄰一名敵人(conductLeft 回合,每目標每回合 1 次)
  paralyze: { skip: 0.5, spd: 0.15, conductLeft: 1 },
  dotRounds: 2, dotRoundsXL: 3, poisonRounds: 3, poisonHeal: 0.5,
  burnTickK: 1,
  healCap: { single: 0.35, xl: 0.50, round: 0.40, second: 0.7, third: 0.5 },
  shieldDur: 2, shieldCap: 0.40, pierceShield: 1.5,
  // 禁療 / 抵禦(§4.11、SCHEMA C):發動率與持續集中在 skills json 的 params.healBlock / params.resist;此處只放引擎參數
  hb: { rateScale: 2.0, defaultRatio: 50, defaultTurns: 3, ratio100Turns: 2 },   // rateScale B1 調參 1 → 2(讓覆蓋率進入 20% 附近)
  ward: { maxLayers: 2, dur: 3, rateScale: 5.0 },   // B1 調參 1 → 5(抵禦來源稀少,否則擋下率 < 2%)
  ccImmRounds: 1,              // 強控後抗控
  // 疲兵(§4.11):第 5 回合起 受傷 +10 %/回合、受療 −10 %/回合,累加
  fatigue: { start: 5, dmg: 0.10, heal: 0.10 },   // 回合上限 10(2026-11-09):疲兵第 5 回合起累加,至第 10 回合受傷 +60 %、受療 −60 %
  // 連鎖(§3.10、combos partC)
  chain: { stepCap: 8, maxDepth: 3, followUpPerUnit: 1, extraActionPerUnit: 1, extraActionPerTeam: 2, comboHitBonus: 0.05, comboHitCap: 0.25, targetDmgCapPct: 0.60, teamDmgCapPct: 0.40, assistKillRecast: false, ultAssistMul: 0.5, assistBasicMul: 1.0, assistSmallMul: 0.7, recastDefaultMax: 2, recastDefaultDecay: 0.7, ultRecastMax: 2, ultRecastDecay: 0.7 },
  counterPerAttacker: 1,
  // 第 1 回合限制:atk_all 且 power ≥ L 的非大招戰法起手冷卻 1(§4.9)
  cd0AllL: true,
  // 召喚 / 伏兵等雜項
  summonMax: 2,
  starSkillPlus: 0.05,         // 升星 3 星起「戰法強化」:主動 / 追擊 / 大招效果檔位視為 +5 %(PLACEHOLDER)
  stackKillAtk: 0.05,
  bonusVs: { S: 0.2, M: 0.4, L: 0.7, XL: 1.0 },       // params.bonusVsStatus.mult 檔位 → 加成
  stepMul: { S: 0.05, M: 0.08, L: 0.12, XL: 0.15 },   // perFacAlly / perAlly / crowd_scale 每階加成
  chanceMap: { S: 0.5, M: 0.7, L: 0.9, XL: 1.0 },     // 控制類 params.chance 檔位 → 機率
  followMul: { S: 0.6, M: 0.9, L: 1.2, XL: 1.6 },     // 羈絆 follow_up 的普攻倍率
  passiveGuardMul: 0.8,                                // 被動援護比例 = guard 表 × 此值(上限 0.5)
  rxBurnDot: 0.15,                                     // 連環延燒給的燃燒倍率
  // 對象條件 vs(new_heroes_draft §一.1):bonus.mult 檔位 → 數值。dmg = 傷害 / 效果倍率加成;crit = 暴擊率加成(XL = 必定暴擊);chance = 控制 / 狀態機率(XL = 必中,無視規避、抵禦);
  //   taken = 受到傷害加成(負號為減傷,減傷取一半);spd = 速度;bothCut = mode both 時防守端的減傷
  vs: { dmg: { S: 0.2, M: 0.4, L: 0.7, XL: 1.0 }, crit: { S: 0.10, M: 0.20, L: 0.35, XL: 1 }, chance: { S: 0.5, M: 0.7, L: 0.9, XL: 1 }, taken: { S: 0.2, M: 0.4, L: 0.7, XL: 1.0 }, spd: { S: 8, M: 12, L: 16, XL: 22 }, bothCut: 0.2 },
  // 五行(theme = wuxing 的戰法):剋 = 金剋木、木剋土、土剋水、水剋火、火剋金。剋對方屬性 +over;目標帶『被我剋』的五行印 → +mark 並消耗;命中後留下自己屬性的五行印
  wx: { beats: { '金': '木', '木': '土', '土': '水', '水': '火', '火': '金' }, over: 0.3, mark: 0.7, markRounds: 2 },
  // 名人標籤(vs.tag 用;warrior = 武 ≥ 90 由 CARD_FIGS 自動判定)
  figTags: { lord: ['caocao', 'liubei', 'sunquan', 'zhangjiao', 'dongzhuo', 'yuanshao', 'yuanshu'], mystic: ['zhangjiao', 'zhangbao', 'yuji', 'zhanglu', 'zuoci', 'nanhua'], sun_clan: ['sunjian', 'sunce', 'sunquan', 'sunshangxiang'], taoyuan: ['liubei', 'guanyu', 'zhangfei'], liu_family: ['ganfuren', 'mifuren', 'sunshangxiang'] },
  // 羈絆累計上限(§2.6)
  bondCap: { atk: 0.20, hp: 0.10 },
  // 逾時判定(2026-11-09):剩餘兵力比例較高者勝;差距不足 drawLead(0.1 個百分點,即四捨五入後完全相等)才算平手
  drawLead: 0.001,
  // 站位陣型(§2.7):前排 ≥3 鋒矢 / 前2中≥1 圓陣 / 後排≥2 雁行
  formation: { fengshi: 0.08, yuanzhen: 0.08, yanxing: 0.08 },
  // 路人戰法欄(§4.8;PLACEHOLDER):自帶 1(職業預設)+ 學習欄。learnByGr = 各品階(白青藍紫金)的基本學習欄;learnBonus = 通才 / 升階 2 次再加;learnCap = 學習欄上限(總戰法數上限 1 + learnCap = 3)。
  // autoLearn:名冊卡沒有指定學習戰法時,依卡面雜湊從通用戰法池自動補滿(確定性),使白 1 / 青 2 / 藍 2 / 紫 3 / 金 3 皆有合理戰法欄
  slots: { learnByGr: [0, 1, 1, 2, 2], learnBonus: 1, learnCap: 2, autoLearn: true },
  figTuneRate: 0.4             // BN_FIG_TUNE 係數對戰法發動率的連動:(係數 − 1) × 此值(例:0.9 → 發動率 −4 pp)
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
  zhijun: { takenPct: -0.03 },
  tixu: { lowHp: [0.3, 0.10] },
  fengshi: { fmt: 'fengshi' },
  yuanzhen: { fmt: 'yuanzhen' },
  yanxing: { fmt: 'yanxing' },
  bazhen: { fmtAll: 1.15 },
  chengbing: { hp: 0.08 },
  guwu: { rowAtk: 0.04 },
  suwei: { rowTakenFront: -0.10 },
  yanfa: { takenPct: -0.04 },
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
  zhongyi: { immuneFirst: ['fear', 'timid'] },
  fanfu: { atk: 0.08 },
  gaoao: { stT: 4 },
  baonue: { atk: 0.08 },
  weihuo: { burnTaken: 1.4 },
  qingdi: { early2: 0.10, lateTaken: 0.05 },
  kuanhou: { rowRate: 0.02 },
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

// 名人專屬詞條 → 戰鬥修正(§2.7 最後一點;B4)。key = 名人 id;i = CARD_FIGS[].tr 的序號(卡面那一條詞條);m = 修正(欄位同 BN_TRAIT_MODS,另加:
//   vsFac {陣營: +%} / vsFig {名人: +%} / vsTroop {兵種: +%} 對特定對象傷害;takenStrat 受謀略傷害;lowHpTaken [兵力比, 受傷 ±];healOut 施放的治療量;
//   teamAtk 全隊攻擊(光環);teamTakenFac {fac, v} 我方某陣營受傷;teamTroopSpd {兵種: 點} 我方某兵種速度);note = 典故(說明浮層用)。
// 原則:舊即時戰用語依 §2.7 換算;與該名人 fac*.json 被動同一典故者改取另一面(個性 / 史事),不與其戰法重複;數值偏小(強者給有代價或對象條件的)。
var BN_FIG_TRAIT = {
  caocao: { i: 2, m: { fmtAll: 1.1 }, note: '注《孫子》,善用陣法' },
  simayi: { i: 2, m: { takenPct: -0.05 }, note: '堅守不戰,隱忍待時' },
  zhangliao: { i: 2, m: { vsFac: { 2: 0.08 } }, note: '合肥八百破孫權,江東小兒不敢夜啼' },
  xuchu: { i: 1, m: { stW: 3, stZ: -5 }, note: '力如虎而癡' },
  caoren: { i: 1, m: { takenStrat: -0.08 }, note: '江陵拒周瑜經年,不為計謀所動' },
  xiahouyuan: { i: 0, m: { spd: 5 }, note: '三日五百,六日一千' },
  xuhuang: { i: 1, m: { vsShield: 0.08 }, note: '樊城長驅直入,破關羽十重鹿角' },
  liubei: { i: 2, m: { lowHpTaken: [0.3, -0.10] }, note: '屢敗而不撓,越到絕境越難擊倒' },
  zhangfei: { i: 1, m: { frontTaken: -0.08 }, note: '長坂據水斷橋,瞋目橫矛' },
  zhaoyun: { i: 0, m: { undyingOnce: 1 }, note: '長坂單騎,一身都是膽' },
  machao: { i: 2, m: { vsFac: { 0: 0.08 } }, note: '渭南殺得曹操割鬚棄袍' },
  weiyan: { i: 2, m: { r1Spd: 8 }, note: '鎮漢中、獻子午谷奇謀,出兵求快' },
  maliang: { i: 1, m: { rowRate: 0.02 }, note: '白眉最良,說和五溪,同列皆受其益' },
  sunce: { i: 1, m: { spd: 4, troop: '騎' }, note: '轉鬥千里,所向皆破' },
  zhouyu: { i: 2, m: { immuneFirst: ['confuse'] }, note: '曲有誤,周郎顧:心神不亂' },
  ganning: { i: 1, m: { vsFac: { 0: 0.06 } }, note: '百騎夜劫曹營' },
  luxun: { i: 2, m: { vsFac: { 1: 0.08 } }, note: '夷陵火燒劉備連營' },
  lvmeng: { i: 2, m: { firstHit: 0.12 }, note: '白衣渡江,襲取荊州於不備' },
  huanggai: { i: 1, m: { lowHp: [0.5, 0.10] }, note: '苦肉詐降,傷得越重越拚命' },
  chengpu: { i: 1, m: { rowTakenFront: -0.06 }, note: '三世老將,諸將皆稱程公' },
  zhangjiao: { i: 2, m: { teamAtk: 0.03, takenPct: 0.05 }, note: '蒼天已死,黃天當立:眾人狂熱,自身也成眾矢之的' },
  zhangbao: { i: 2, m: { stratPct: 0.06 }, note: '作法興雲布霧' },
  zhangliang: { i: 2, m: { vsFig: { huangfusong: 0.15, zhujun: 0.15 } }, note: '廣宗與皇甫嵩死戰' },
  zhangmancheng: { i: 2, m: { teamTakenFac: { fac: 3, v: -0.03 } }, note: '神上使號令南陽黃巾' },
  mayuanyi: { i: 2, m: { firstHit: 0.10 }, note: '大方渠帥,潛入洛陽為內應' },
  guotai: { i: 2, m: { takenRanged: -0.08 }, note: '據白波谷,依山谷掩蔽' },
  zhangyan: { i: 0, m: { hp: 0.05 }, note: '黑山眾號百萬' },
  lvbu: { i: 0, m: { r1Spd: 6 }, note: '飛將,馳馬最快' },
  huangfusong: { i: 1, m: { vsFac: { 3: 0.08 } }, note: '平定黃巾的主帥' },
  gongsunzan: { i: 0, m: { vsTroop: { '騎': 0.06 } }, note: '白馬義從專與胡騎爭鋒' },
  zhujun: { i: 2, m: { vsShield: 0.08 }, note: '圍宛城、破堅壘' },
  mateng: { i: 2, m: { teamTroopSpd: { '騎': 3 } }, note: '涼州豪帥,麾下多騎' },
  huatuo: { i: 1, m: { healOut: 0.08 }, note: '五禽戲養生,醫術更精' },
  youtu: { i: 1, m: { hp: 0.08 }, note: '丹陽宗帥,宗部人多' },
  yufuluo: { i: 1, m: { teamTroopSpd: { '騎': 3 } }, note: '南匈奴單于,胡騎來去如風' }
};

// 名人強度校正(B6;tools/bn_fig_tune.js 解出,--apply 只改下面標記之間的一行):名人 id → 兵力 / 攻擊 / 謀略 / 治療 / 護盾量係數(未列 = 1)。
// 目的:三國 100 位名人(全名人隊隨機對打)勝率落在約 45~58%、新舊兩批平均相近;魔幻 42 位同法校正。卡面五維不變,只影響討伐戰鬥數值。
// BN_FIG_TUNE-BEGIN
var BN_FIG_TUNE = { caocao: 0.93, xunyu: 0.7, guojia: 1.2, jiaxu: 0.93, simayi: 1.03, dianwei: 1.09, xiahoudun: 0.84, zhangliao: 0.76, xunyou: 0.88, xuchu: 1.12, caoren: 0.84, xiahouyuan: 0.81, xuhuang: 0.93, zhongyao: 0.89, liubei: 0.94, guanyu: 0.8, zhangfei: 0.86, zhaoyun: 0.94, zhugeliang: 0.7, machao: 0.95, pangtong: 1.05, fazheng: 0.88, weiyan: 0.83, huangzhong: 0.78, mizhu: 0.99, maliang: 1.25, xushu: 1.25, shamoke: 1.21, sunjian: 0.94, sunce: 0.82, zhouyu: 0.84, lusu: 0.7, ganning: 0.75, sunquan: 1.02, lvmeng: 1.01, zhangzhao: 1.25, taishici: 0.78, huanggai: 1.23, zhoutai: 1.2, chengpu: 1.07, shixie: 0.84, zhangjiao: 0.7, zhangbao: 0.9, zhangliang: 0.87, zhangniujiao: 0.91, zhangmancheng: 0.8, mayuanyi: 1.25, guanhai: 0.79, zhanglu: 0.85, guotai: 0.87, boca: 1.07, zhangyan: 1.25, liupi: 1.08, yudu: 1.25, yuji: 0.94, dongzhuo: 0.83, lvbu: 0.83, yuanshao: 0.91, huangfusong: 1.04, luzhi: 1.25, gongsunzan: 0.82, zhujun: 0.8, zhengxuan: 1.25, mateng: 0.89, xurong: 1.2, huatuo: 0.7, caiyong: 1.07, youtu: 1.25, yufuluo: 0.96, zhenji: 1.03, caiyan: 0.91, caozhi: 1.25, yangxiu: 1.25, pangde: 0.98, zhanghe: 0.89, ganfuren: 1.25, mifuren: 1.13, masu: 1.19, huangyueying: 1.17, zhoucang: 1.07, sunshangxiang: 0.8, lingtong: 0.97, daqiao: 1.15, xiaoqiao: 1.25, dingfeng: 0.98, kanze: 1.25, nanhua: 0.83, chengyuanzhi: 1.1, dengmao: 1.2, peiyuanshao: 1.2, heyi: 1.17, zhangkai: 1.22, diaochan: 1.25, zuoci: 1.11, panfeng: 1.15, caoxing: 0.88, huaxiong: 1.12, yuanshu: 1.25, elf_changqing: 0.85, elf_qinglan: 0.85, elf_baizhou: 0.92, elf_jiyu: 0.85, elf_tengluo: 1.15, elf_liguo: 1.15, elf_yueyao: 0.85, elf_shuanghua: 0.85, elf_luming: 0.85, elf_chenlu: 0.85, elf_hengzhi: 1.15, elf_xingchen: 0.85, elf_liuying: 1.15, elf_yedi: 1.15, dw_panshan: 0.85, dw_zhongyue: 0.91, dw_zaotian: 0.85, dw_heiyao: 0.85, dw_dengxin: 1.15, dw_qianchui: 0.93, dw_yinxu: 1.05, dw_duanlei: 0.9, dw_maoding: 1.15, dw_jincheng: 1.15, dw_lielu: 0.89, dw_kuangfu: 0.85, dw_rongxin: 0.85, dw_maiya: 1.1, kd_zhaoming: 0.85, kd_lingfeng: 0.85, kd_shoucheng: 0.89, kd_chuanyang: 0.87, kd_chenxing: 1.15, kd_wenyuan: 0.94, kd_xuandeng: 0.85, kd_suxin: 0.85, kd_jinghu: 1.15, kd_yushu: 1.15, kd_fengnian: 0.85, kd_wantong: 1.15, kd_heijing: 0.84, kd_xinghua: 1.08 };
// BN_FIG_TUNE-END

// 戰法平衡覆寫(B6):戰法 id → 要覆寫的欄位(rate 發動率 / power 檔位)。載入時由 bn_units.js 套到 BN_SKILLS(戰鬥與卡面文字一致);
// 來源 json 與 js/bn_skills_data.js 不改(存檔相容、重新產生逐位不變)。對象:強度校正係數壓不下來的治療型 / 拉不上來的純輔助型。
var BN_SKILL_TUNE = {
  p_zhangjiao: { power: 'S' }, s_zhangjiao_1: { rate: 0.2 }, s_zhangjiao_vs1: { rate: 0.16 }, u_zhangjiao: { rate: 0.08 }, s_zhangjiao_2: { rate: 0.28 }, s_zhangjiao_3: { rate: 0.22 }, s_zhugeliang_2: { rate: 0.25 }, s_zhugeliang_3: { rate: 0.3 },   // 張角:三個全隊治療太穩
  s_guanyu_1: { rate: 0.3 }, s_guanyu_vs1: { rate: 0.25 },
  p_lusu: { power: 'S' }, s_lusu_1: { rate: 0.3 }, p_zhangmancheng: { power: 'S' },
  s_lvbu_1: { rate: 0.38 }, s_zhangliao_2: { rate: 0.3 }, s_zhangliao_3: { rate: 0.3 },
  s_peiyuanshao_1: { rate: 0.5 }, s_yuanshu_2: { rate: 0.45 }, s_zhengxuan_2: { rate: 0.45 }, s_zhengxuan_3: { rate: 0.4 },
  s_kanze_3: { rate: 0.45 }, s_caozhi_1: { rate: 0.5 }, u_caozhi: { rate: 0.2 }, s_zhangzhao_3: { rate: 0.4 }, s_maliang_2: { rate: 0.5 },
  s_dw_jincheng_1: { rate: 0.5 }, s_elf_liguo_1: { rate: 0.5 }, s_elf_liguo_2: { rate: 0.4 },
  s_dw_dengxin_1: { rate: 0.45 }, s_dw_dengxin_2: { rate: 0.45 }, s_elf_yedi_1: { rate: 0.5 }, s_elf_yedi_2: { rate: 0.5, power: 'M' },
  s_elf_tengluo_1: { rate: 0.45 }, s_elf_tengluo_2: { rate: 0.4 },
  p_elf_yueyao: { power: 'S' }, s_elf_yueyao_1: { rate: 0.3 }, u_elf_yueyao: { rate: 0.1 }, s_dw_rongxin_1: { rate: 0.3 }, s_dw_jincheng_2: { rate: 0.5 }, p_dw_rongxin: { power: 'S' }, p_kd_fengnian: { power: 'S' }, s_kd_lingfeng_1: { rate: 0.34 }
};

// 羈絆(§2.6;PLACEHOLDER)。陣營 / 職業標籤由 bn_units.js bnBondsOf 計算;特殊組合另走 combos.json partB(BN_COMBOS.bonds)
var BN_BONDS = {
  fac: { 3: { atk: 0.05 }, 4: { atk: 0.08 }, 5: { atk: 0.10, hp: 0.05 } },     // 魏蜀吳黃巾;中立不計
  tag: {                                                                       // 同標籤 2 人生效
    '將門': { defFront: 0.08 }, '士人': { strat: 0.08 }, '醫者': { heal: 0.15 }, '工匠': { shield: 0.12 }, '農家': { hp: 0.06 },
    '官僚': { res: 0.08 }, '方士': { rate: 0.05 }, '商賈': { gold: 0.10 }, '水軍': { spd: 5 }
  },
  special: [   // 名人組合(戰前算好,戰中只查表)
    { id: 'sp_enruo', name: '桃園結義', members: ['liubei', 'guanyu', 'zhangfei'], need: 3, rate: 0.05 },
    { id: 'sp_tiangong', name: '天公地公人公', members: ['zhangjiao', 'zhangbao', 'zhangliang'], need: 3, strat: 0.12 },
    { id: 'sp_yingchuan', name: '潁川之士', members: ['xunyu', 'xunyou', 'guojia', 'zhongyao'], need: 2, cdMinus: 1 },
    { id: 'sp_baima', name: '白馬義從', members: ['gongsunzan', 'zhaoyun'], need: 2, cavSpd: 8 }
  ],
  maxSpecial: 3
};

// 兵種名正規化:舊存檔 / 舊隊伍碼的『步』→『槍』;不認得的回空字串(呼叫端改用預設兵種)。永遠不丟例外
function bnTroopNorm(t) {
  if (typeof t !== 'string') return '';
  if (BN_DATA.troopAlias[t]) t = BN_DATA.troopAlias[t];
  return BN_DATA.troops[t] ? t : '';
}

if (typeof module !== 'undefined' && module.exports) module.exports = { bnTroopNorm: bnTroopNorm, BN_DATA: BN_DATA, BN_TRAIT_MODS: BN_TRAIT_MODS, BN_BONDS: BN_BONDS, BN_FIG_TRAIT: BN_FIG_TRAIT };

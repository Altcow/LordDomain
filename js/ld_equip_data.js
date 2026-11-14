// js/ld_equip_data.js — 裝備與尋訪 資料表(設計_裝備與尋訪_定案.md 第二、三、四節)。前綴 GEAR_ / gear。數值全部 PLACEHOLDER,集中在這裡,最後統一調。
// 純資料,不碰存檔、不碰 DOM。全域:GEAR_KEY GEAR_CFG GEAR_TRAITS GEAR_ATTR gearTraitDef gearTraitBy。ES2017;不用 ?. ??。
// @DORMANT ldui:資料本身無副作用;戰鬥數值與介面只在旗標 ldui 開啟時生效(見 ld_equip.js gearLive)。
var GEAR_KEY = 'lorddomain.gear.v1';
var GEAR_CFG = {
  mainMul: 1.5,                       // 主屬性倍率(強度超標時改 1.3)
  inv: 200,                           // 未穿裝備庫存上限
  lvMax: 10,
  lvGrow: 0.06,                       // 每 +1,所有屬性 +6%
  slots: ['wpn', 'arm', 'horse', 'relic'],
  slotName: { wpn: '武器', arm: '防具', horse: '馬', relic: '寶具' },
  slotIdx: ['wpn', 'arm', 'horse', 'relic'],   // 武將詳情 4 格順序
  qName: ['白', '藍', '紫', '金'],
  nAttr: [1, 1, 2, 3],                // 各品質屬性條數(含主屬性)
  needStar: [0, 0, 1, 2],             // 穿戴星數門檻(只看星數)
  // 副屬性值(主屬性再 × mainMul);spd 是點數,crit / res 是百分點,其餘是 %
  val: {
    atk: [1.5, 2.0, 2.5, 3.0], mag: [1.5, 2.0, 2.5, 3.0], def: [2.0, 2.5, 3.0, 3.5], sres: [2.0, 2.5, 3.0, 3.5], hp: [1.5, 2.0, 2.5, 3.0],
    spd: [1, 2, 2.5, 3], crit: [0.8, 1.0, 1.3, 1.5], cdmg: [4, 5, 6, 8], heal: [3, 4, 5, 6], res: [1.0, 1.5, 2.0, 2.5]
  },
  // 型 → 主屬性;relic 主屬性隨機(relicMain)
  mainOf: { wu: 'atk', wen: 'mag', heavy: 'def', robe: 'sres', horse: 'spd' },
  typesOf: { wpn: ['wu', 'wen'], arm: ['heavy', 'robe'], horse: ['horse'], relic: ['relic'] },
  typeName: { wu: '武型', wen: '文型', heavy: '重甲', robe: '法袍', horse: '馬', relic: '寶具' },
  relicMain: ['mag', 'heal', 'res', 'sres'],
  sub: { wpn: ['atk', 'mag', 'crit', 'cdmg'], arm: ['def', 'sres', 'hp'], horse: ['hp', 'atk', 'def'], relic: ['mag', 'sres', 'heal', 'res'] },
  // 整身封頂(4 件加總;% / 點 / 百分點)
  cap: { atk: 12, mag: 12, def: 12, sres: 15, hp: 12, spd: 8, crit: 3, res: 6 },
  // 強化:武器防具(礪石數照 mat.js MAT_WHET;成功率 / 損毀率 +1~+10)
  enh: {
    rate: [0, 1.0, 0.9, 0.8, 0.6, 0.5, 0.4, 0.3, 0.2, 0.15, 0.10],
    brk: [0, 0, 0, 0, 0.05, 0.08, 0.12, 0.16, 0.20, 0.25, 0.30],
    refund: 0.3
  },
  // 馬 / 寶具:餵同部位裝備(點數依被餵者品質;+1~+10 各要 need 點)
  feedPts: [1, 2, 4, 8],
  feedNeed: [0, 2, 3, 4, 6, 8, 10, 13, 16, 20, 25],
  shard: [1, 2, 5, 10],               // 馬 / 寶具分解碎片
  // 主材:武器 / 防具各品質的主材 id(退回量以 MAT_RECIPE 該材料數量為準)
  mainMat: { wpn: ['m_iron1', 'm_iron2', 'm_iron3', 'm_iron4'], arm: ['m_hide1', 'm_hide2', 'm_hide3', 'm_hide4'] },
  // 特性機率(金裝):不投精魄 / 投 1 精魄 → [得 1 個, 得 2 個]
  traitP: { none: [0.30, 0.05], soul: [0.50, 0.15] },
  // 鍛造
  forge: { rate: [1.0, 0.85, 0.65, 0.50], pity: 20, openFame: 500, kinds: ['wpn', 'arm'] }
};
// 屬性顯示:unit 'pct' = % / 'pt' = 點 / 'pp' = 百分點
var GEAR_ATTR = {
  atk: { n: '攻擊', u: 'pct' }, mag: { n: '謀略', u: 'pct' }, def: { n: '防禦', u: 'pct' }, sres: { n: '謀防', u: 'pct' }, hp: { n: '兵力', u: 'pct' },
  spd: { n: '速度', u: 'pt' }, crit: { n: '暴擊率', u: 'pp' }, cdmg: { n: '暴擊傷害', u: 'pct' }, heal: { n: '治療', u: 'pct' }, res: { n: '抵抗', u: 'pp' }
};
// 特性(只有金裝;on:1 = 可被抽到;第二批 11 條引擎掛鉤已於 2026-11-14 做完並 on:1,數值全 PLACEHOLDER)。mods 欄是 bn_engine 的 mods 鍵值;merge:'add' 加總 / 'lowhp' 取受傷減免較好者 / 'hi' 取較大者
var GEAR_TRAITS = [
  { id: 'early2', no: 4, slot: 'wpn', n: '先登', d: '第 1~2 回合傷害 +8%', on: 1, mods: { early2: 0.08 }, ico: 'tr_1' },
  { id: 'lowhp', no: 6, slot: 'arm', n: '堅韌', d: '兵力低於 40% 時受傷 -8%', on: 1, mods: { lowHpTaken: [0.4, -0.08] }, merge: 'lowhp', ico: 'tr_2' },
  { id: 'critres', no: 7, slot: 'arm', n: '抗暴', d: '受暴擊時暴擊傷害 -20%', on: 1, mods: { critTaken: -0.20 }, ico: 'tr_3' },
  { id: 'antistrat', no: 10, slot: 'arm', n: '辟邪', d: '受謀略傷害 -6%', on: 1, mods: { takenStrat: -0.06 }, ico: 'tr_4' },
  { id: 'r1spd', no: 11, slot: 'horse', n: '疾風', d: '第 1 回合速度 +10', on: 1, mods: { r1Spd: 10 }, ico: 'tr_5' },
  { id: 'calm', no: 16, slot: 'relic', n: '靜心', d: '開戰時得 1 層抵禦', on: 1, mods: { startWard: 1 }, ico: 'tr_6' },
  { id: 'deft', no: 17, slot: 'relic', n: '妙手', d: '治療量與護盾量 +8%', on: 1, mods: { healOut: 0.08, shieldOut: 0.08 }, ico: 'tr_7' },
  { id: 'defign', no: 1, slot: 'wpn', n: '破甲', d: '物理傷害無視目標 8% 防禦', on: 1, mods: { defIgn: 0.08 }, ico: 'tr_defign' },
  { id: 'sresign', no: 2, slot: 'wpn', n: '文心', d: '謀略傷害無視目標 8% 謀防', on: 1, mods: { sresIgn: 0.08 }, ico: 'tr_sresign' },
  { id: 'lowkill', no: 3, slot: 'wpn', n: '斬將', d: '對兵力低於 30% 目標傷害 +10%', on: 1, mods: { lowHpDmg: [0.3, 0.10] }, merge: 'hi', ico: 'tr_lowkill' },
  { id: 'leech', no: 5, slot: 'wpn', n: '嗜血', d: '普攻傷害 5% 回復自身', on: 1, mods: { basicLeech: 0.05 }, ico: 'tr_leech' },
  { id: 'thorns', no: 8, slot: 'arm', n: '反甲', d: '受普攻反彈 6%', on: 1, mods: { basicThorns: 0.06 }, ico: 'tr_thorns' },
  { id: 'laststand', no: 9, slot: 'arm', n: '不屈', d: '每場 1 次:兵力首次低於 25% 得 10% 兵力護盾', on: 1, mods: { lastStand: 1 }, ico: 'tr_laststand' },
  { id: 'fathalf', no: 12, slot: 'horse', n: '長驅', d: '第 5 回合起疲兵受傷加成減半', on: 1, mods: { fatHalf: 1 }, ico: 'tr_fathalf' },
  { id: 'vsslow', no: 13, slot: 'horse', n: '追風', d: '打速度比自己低的目標傷害 +5%', on: 1, mods: { vsSlow: 0.05 }, ico: 'tr_vsslow' },
  { id: 'breakfree', no: 14, slot: 'horse', n: '脫韁', d: '每場 1 次:被暈眩或睡眠時立刻解除', on: 1, mods: { breakFree: 1 }, ico: 'tr_breakfree' },
  { id: 'regen', no: 15, slot: 'relic', n: '回春', d: '每回合開始回 2% 最大兵力', on: 1, mods: { regen: 0.02 }, ico: 'tr_regen' },
  { id: 'dotout', no: 18, slot: 'relic', n: '鎮魂', d: '自己的燃燒、中毒、流血傷害 +10%', on: 1, mods: { dotOut: 0.10 }, ico: 'tr_dotout' }
];
function gearTraitDef(id) {
  var i;
  for (i = 0; i < GEAR_TRAITS.length; i++) if (GEAR_TRAITS[i].id === id) return GEAR_TRAITS[i];
  return null;
}
if (typeof module !== 'undefined' && module.exports) module.exports = { GEAR_CFG: GEAR_CFG, GEAR_TRAITS: GEAR_TRAITS };

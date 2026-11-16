// js/ld_equip_data.js — 裝備與尋訪 資料表(設計_裝備與尋訪_定案.md 第二、三、四節)。前綴 GEAR_ / gear。數值全部 PLACEHOLDER,集中在這裡,最後統一調。
// 純資料,不碰存檔、不碰 DOM。全域:GEAR_KEY GEAR_CFG GEAR_TRAITS GEAR_ATTR gearTraitDef gearTraitBy GEAR_RARE_ON GEAR_CAT_NAME GEAR_SETS GEAR_ZW GEAR_BREEDS gearZwDef gearSetDef。ES2017;不用 ?. ??。
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
// ===== 賽季末商店(設計_賽季末商店_規格.md 第 2.4~2.9、6.1 節;SS1 只加資料,不接行為)=====
// 旗標:false = 新機率 / 屬性浮動 / 專武 / 套裝全部不生效(現行行為不變)。SS4 接線後與 SSHOP_ON 一起開。數值全 PLACEHOLDER。
var GEAR_RARE_ON = false;
GEAR_CFG.roll = [0.85, 1.20];          // 自鍛 / 尋訪 / 券:每條屬性 × 隨機浮動(取到 0.1)
GEAR_CFG.zwMul = 1.08;                 // 專武 / 名駒:每條屬性 × 固定倍率
GEAR_CFG.zwExtraTr = 0.05;             // 名駒:第 2 條特性機率
GEAR_CFG.forge.qRoll = { 2: [[1, 0.92], [2, 0.08]], 3: [[1, 0.70], [2, 0.25], [3, 0.05]] };   // 精鍛(紫配方)/ 神鍛(金配方)成功後再擲品質:[[實際品質, 機率]…]
GEAR_CFG.enh.brkZw = [0, 0, 0, 0, 0, 0, 0.04, 0.06, 0.08, 0.10, 0.12];   // 專武(武器 / 防具)強化失敗爆裝率(+6 起)
// 寶具分類:主屬性 → 分類名(策略 = 謀略;「策略」是分類,物品用具體名稱)
var GEAR_CAT_NAME = { mag: '策略', heal: '治療', res: '抵抗', sres: '謀防' };
// 套裝(只有專武):mem = [武器, 防具, 寶具] 的 GEAR_ZW id;b2 = 2 件加成 {k 屬性, v};b3 = 3 件加成 {tr 特性 id(全強度), k, v(約 2 件的一半)};grp = 輪替組;tag = CSS 色票名(--set-<tag>)
var GEAR_SETS = [
  { id: 'huben', n: '虎賁', grp: 'A', mem: ['huben_w', 'huben_a', 'huben_r'], b2: { k: 'def', v: 5 }, b3: { tr: 'lowhp', k: 'def', v: 2.5 }, tag: 'huben', d: '前排坦、盾兵、防禦流' },
  { id: 'qinglong', n: '青龍', grp: 'B', mem: ['qinglong_w', 'qinglong_a', 'qinglong_r'], b2: { k: 'atk', v: 3 }, b3: { tr: 'early2', k: 'atk', v: 1.5 }, tag: 'qinglong', d: '物理突擊、先手爆發、騎兵' },
  { id: 'baima', n: '白馬', grp: 'B', mem: ['baima_w', 'baima_a', 'baima_r'], b2: { k: 'crit', v: 5 }, b3: { tr: 'lowkill', k: 'crit', v: 2.5 }, tag: 'baima', d: '暴擊收割、弓騎' },
  { id: 'youxia', n: '遊俠', grp: 'A', mem: ['youxia_w', 'youxia_a', 'youxia_r'], b2: { k: 'cdmg', v: 16 }, b3: { tr: 'leech', k: 'cdmg', v: 8 }, tag: 'youxia', d: '普攻流、單挑續航' },
  { id: 'xinglin', n: '杏林', grp: 'A', mem: ['xinglin_w', 'xinglin_a', 'xinglin_r'], b2: { k: 'heal', v: 5 }, b3: { tr: 'deft', k: 'heal', v: 2.5 }, tag: 'xinglin', d: '補師、護盾輔助' },
  { id: 'guigu', n: '鬼谷', grp: 'B', mem: ['guigu_w', 'guigu_a', 'guigu_r'], b2: { k: 'mag', v: 2.5 }, b3: { tr: 'sresign', k: 'mag', v: 1.3 }, tag: 'guigu', d: '謀略輸出' },
  { id: 'xiyuan', n: '西園', grp: 'B', mem: ['xiyuan_w', 'xiyuan_a', 'xiyuan_r'], b2: { k: 'sres', v: 5 }, b3: { tr: 'antistrat', k: 'sres', v: 2.5 }, tag: 'xiyuan', d: '抗謀略前排、謀士坦' },
  { id: 'huangtian', n: '黃天', grp: 'A', mem: ['huangtian_w', 'huangtian_a', 'huangtian_r'], b2: { k: 'hp', v: 3 }, b3: { tr: 'regen', k: 'hp', v: 1.5 }, tag: 'huangtian', d: '持續傷害(燒、毒)、耐久消耗' }
];
// 專武(8 套 × 3 件)+ 名駒 2 匹:一律金(q 3);fz_<id> = 該件殘片。slot / type 同 GEAR_CFG;main = 主屬性;sub = 2 條副屬性;tr = 固定特性 id;set = 套 id(名駒 null);xtr = 1 表示另有 GEAR_CFG.zwExtraTr 機率的第 2 條特性(名駒);ico = 圖示鍵(沒圖用分類底圖 + 名稱前 2 字占位)
var GEAR_ZW = [
  { id: 'huben_w', n: '虎賁刀', set: 'huben', slot: 'wpn', type: 'wu', main: 'atk', sub: ['crit', 'cdmg'], tr: 'leech', ico: 'zw_huben_w' },
  { id: 'huben_a', n: '明光鎧', set: 'huben', slot: 'arm', type: 'heavy', main: 'def', sub: ['sres', 'hp'], tr: 'laststand', ico: 'zw_huben_a' },
  { id: 'huben_r', n: '鎮軍虎符', set: 'huben', slot: 'relic', type: 'relic', main: 'res', sub: ['sres', 'heal'], tr: 'calm', ico: 'zw_huben_r' },
  { id: 'qinglong_w', n: '青龍偃月刀', set: 'qinglong', slot: 'wpn', type: 'wu', main: 'atk', sub: ['crit', 'cdmg'], tr: 'defign', ico: 'zw_qinglong_w' },
  { id: 'qinglong_a', n: '青龍鎧', set: 'qinglong', slot: 'arm', type: 'heavy', main: 'def', sub: ['sres', 'hp'], tr: 'critres', ico: 'zw_qinglong_a' },
  { id: 'qinglong_r', n: '八卦鏡', set: 'qinglong', slot: 'relic', type: 'relic', main: 'sres', sub: ['res', 'mag'], tr: 'regen', ico: 'zw_qinglong_r' },
  { id: 'baima_w', n: '白馬銀槍', set: 'baima', slot: 'wpn', type: 'wu', main: 'atk', sub: ['crit', 'cdmg'], tr: 'early2', ico: 'zw_baima_w' },
  { id: 'baima_a', n: '白馬戰袍', set: 'baima', slot: 'arm', type: 'robe', main: 'sres', sub: ['def', 'hp'], tr: 'antistrat', ico: 'zw_baima_a' },
  { id: 'baima_r', n: '玉龍珮', set: 'baima', slot: 'relic', type: 'relic', main: 'res', sub: ['mag', 'sres'], tr: 'calm', ico: 'zw_baima_r' },
  { id: 'youxia_w', n: '古錠刀', set: 'youxia', slot: 'wpn', type: 'wu', main: 'atk', sub: ['crit', 'cdmg'], tr: 'lowkill', ico: 'zw_youxia_w' },
  { id: 'youxia_a', n: '遊俠衫', set: 'youxia', slot: 'arm', type: 'robe', main: 'sres', sub: ['def', 'hp'], tr: 'critres', ico: 'zw_youxia_a' },
  { id: 'youxia_r', n: '續命錦囊', set: 'youxia', slot: 'relic', type: 'relic', main: 'heal', sub: ['res', 'sres'], tr: 'regen', ico: 'zw_youxia_r' },
  { id: 'xinglin_w', n: '杏林羽扇', set: 'xinglin', slot: 'wpn', type: 'wen', main: 'mag', sub: ['crit', 'cdmg'], tr: 'sresign', ico: 'zw_xinglin_w' },
  { id: 'xinglin_a', n: '鶴氅', set: 'xinglin', slot: 'arm', type: 'robe', main: 'sres', sub: ['def', 'hp'], tr: 'antistrat', ico: 'zw_xinglin_a' },
  { id: 'xinglin_r', n: '華佗青囊', set: 'xinglin', slot: 'relic', type: 'relic', main: 'heal', sub: ['mag', 'res'], tr: 'regen', ico: 'zw_xinglin_r' },
  { id: 'guigu_w', n: '七星刀', set: 'guigu', slot: 'wpn', type: 'wen', main: 'mag', sub: ['crit', 'cdmg'], tr: 'early2', ico: 'zw_guigu_w' },
  { id: 'guigu_a', n: '鬼谷玄袍', set: 'guigu', slot: 'arm', type: 'robe', main: 'sres', sub: ['def', 'hp'], tr: 'critres', ico: 'zw_guigu_a' },
  { id: 'guigu_r', n: '遁甲天書', set: 'guigu', slot: 'relic', type: 'relic', main: 'mag', sub: ['sres', 'res'], tr: 'calm', ico: 'zw_guigu_r' },
  { id: 'xiyuan_w', n: '西園令扇', set: 'xiyuan', slot: 'wpn', type: 'wen', main: 'mag', sub: ['crit', 'cdmg'], tr: 'sresign', ico: 'zw_xiyuan_w' },
  { id: 'xiyuan_a', n: '西園校尉鎧', set: 'xiyuan', slot: 'arm', type: 'heavy', main: 'def', sub: ['sres', 'hp'], tr: 'thorns', ico: 'zw_xiyuan_a' },
  { id: 'xiyuan_r', n: '照妖鏡', set: 'xiyuan', slot: 'relic', type: 'relic', main: 'sres', sub: ['res', 'heal'], tr: 'calm', ico: 'zw_xiyuan_r' },
  { id: 'huangtian_w', n: '黃天九節杖', set: 'huangtian', slot: 'wpn', type: 'wen', main: 'mag', sub: ['crit', 'cdmg'], tr: 'sresign', ico: 'zw_huangtian_w' },
  { id: 'huangtian_a', n: '黃天力士甲', set: 'huangtian', slot: 'arm', type: 'heavy', main: 'def', sub: ['sres', 'hp'], tr: 'lowhp', ico: 'zw_huangtian_a' },
  { id: 'huangtian_r', n: '太平要術', set: 'huangtian', slot: 'relic', type: 'relic', main: 'mag', sub: ['heal', 'res'], tr: 'dotout', ico: 'zw_huangtian_r' },
  // 名駒(殘片 4 片合成;本季限定,奇數期絕影、偶數期的盧)。副屬性 PLACEHOLDER:絕影走突擊、的盧走穩陣(待決)
  { id: 'jueying', n: '絕影', set: null, slot: 'horse', type: 'horse', main: 'spd', sub: ['atk', 'hp'], tr: 'r1spd', xtr: 1, ico: 'zw_jueying' },
  { id: 'dilu', n: '的盧', set: null, slot: 'horse', type: 'horse', main: 'spd', sub: ['def', 'hp'], tr: 'breakfree', xtr: 1, ico: 'zw_dilu' }
];
// 馬品種:src 'hunt' = 尋訪金馬(浮動、無特性);'ticket' = 名駒券特殊馬(×zwMul 固定、必帶 1 條,tr = 候選特性);副屬性固定(品種的意思)
var GEAR_BREEDS = [
  { id: 'xiliang', n: '西涼馬', q: 3, src: 'hunt', sub: ['atk', 'hp'], tr: [], d: '突擊:騎兵、物理輸出' },
  { id: 'wuhuan', n: '烏桓馬', q: 3, src: 'hunt', sub: ['def', 'hp'], tr: [], d: '穩陣:坦、輔助' },
  { id: 'hanxue', n: '汗血馬', q: 3, src: 'ticket', sub: ['atk', 'hp'], tr: ['r1spd', 'vsslow'], d: '搶先手、打慢的' },
  { id: 'wusun', n: '烏孫馬', q: 3, src: 'ticket', sub: ['def', 'hp'], tr: ['fathalf', 'breakfree'], d: '長期戰、防控' }
];
function gearZwDef(id) {
  var i;
  for (i = 0; i < GEAR_ZW.length; i++) if (GEAR_ZW[i].id === id) return GEAR_ZW[i];
  return null;
}
function gearSetDef(id) {
  var i;
  for (i = 0; i < GEAR_SETS.length; i++) if (GEAR_SETS[i].id === id) return GEAR_SETS[i];
  return null;
}
if (typeof module !== 'undefined' && module.exports) module.exports = { GEAR_CFG: GEAR_CFG, GEAR_TRAITS: GEAR_TRAITS, GEAR_SETS: GEAR_SETS, GEAR_ZW: GEAR_ZW, GEAR_BREEDS: GEAR_BREEDS, GEAR_CAT_NAME: GEAR_CAT_NAME };

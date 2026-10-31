// units.js — 兵種與戰陣建築資料(PLAN_TD_MASTER §6.1;數值出處 PLAN_TD_UNITS §1、§3、§5、§7.1)

const CLS_ORDER = ['shield', 'archer', 'cavalry', 'siege'];
const CLS_NAME = { shield: '盾兵', archer: '弓兵', cavalry: '騎兵', siege: '器械' };
const COUNTER = { shield: ['cavalry'], cavalry: ['archer', 'siege'], archer: ['shield'], siege: ['shield'] };
// 裝備外觀(§1.6):title 稱號, emoji 圖示, col 主色, col2 副色, cloth 衣料色, equip 戰報用描述, gear 繪圖用結構
const TROOP_LOOK = {
  shield1:  { title: '鄉勇', emoji: '🪓', col: '#8a7a5a', col2: '#6b8e4e', cloth: '#c9b48a', equip: '粗麻短褐·柳條盾·竹矛',
              gear: { body: 'none', head: 'none', shield: 'wicker', weapon: 'bambooSpear', banner: 'none' } },
  shield2:  { title: '什長', emoji: '🛡️', col: '#4a3b2f', col2: '#b8322c', cloth: '#8a7a5a', equip: '黑漆皮甲·藤牌·環首刀',
              gear: { body: 'leather', head: 'cap', shield: 'rattan', weapon: 'ringSword', banner: 'none' } },
  shield3:  { title: '戟士', emoji: '🔱', col: '#6b6e78', col2: '#b8322c', cloth: '#7a5738', equip: '半身札甲·朱漆木盾·長戟',
              gear: { body: 'lamellarHalf', head: 'cap', shield: 'woodRed', weapon: 'halberd', banner: 'none' } },
  shield4:  { title: '衛士', emoji: '⚔️', col: '#4e525c', col2: '#c58a2d', cloth: '#5d6f8c', equip: '鐵札甲·鐵兜鍪·銅釘鐵盾·鐵戟',
              gear: { body: 'lamellarFull', head: 'ironHelm', shield: 'ironStud', weapon: 'ironHalberd', banner: 'smallBlack' } },
  shield5:  { title: '虎賁', emoji: '🐯', col: '#1f1c1c', col2: '#e6b84a', cloth: '#b8322c', equip: '玄鐵重札甲·獸面兜鍪·虎紋錦袍·鎏金虎首巨盾·丈八長鈹·赤金大纛',
              gear: { body: 'blackIronGold', head: 'beastHelm', shield: 'giltTigerLarge', weapon: 'longPi', banner: 'redGoldLarge' } },
  archer1:  { title: '獵戶', emoji: '🏹', col: '#7d8a5a', col2: '#a47a4c', cloth: '#c9b48a', equip: '獸皮短衣·短獵弓·葫蘆箭囊',
              gear: { body: 'hide', head: 'none', weapon: 'shortBow', quiver: 'gourd', banner: 'none' } },
  archer2:  { title: '射手', emoji: '🏹', col: '#6a7f3a', col2: '#8b5e3c', cloth: '#8a7a5a', equip: '皮甲·角弓·皮箭箙',
              gear: { body: 'leather', head: 'cap', weapon: 'hornBow', quiver: 'leather', banner: 'none' } },
  archer3:  { title: '弩士', emoji: '🎯', col: '#4f5f6f', col2: '#9ea3ab', cloth: '#7a5738', equip: '半身札甲·蹶張弩·鐵鏃箭',
              gear: { body: 'lamellarHalf', head: 'cap', weapon: 'footCrossbow', quiver: 'leather', banner: 'none' } },
  archer4:  { title: '材官', emoji: '🎯', col: '#3f4f70', col2: '#c58a2d', cloth: '#5d6f8c', equip: '鐵甲·鐵兜鍪·大黃弩·漆箙',
              gear: { body: 'lamellarFull', head: 'ironHelm', weapon: 'daHuangCrossbow', quiver: 'lacquer', banner: 'smallBlack' } },
  archer5:  { title: '射聲', emoji: '🦅', col: '#1b3f66', col2: '#e6b84a', cloth: '#3b6fa3', equip: '玄甲錦衣·鷹羽兜鍪·鎏金十石神弩·雕翎破甲箭·青羅披風·青金大纛',
              gear: { body: 'ironBrocade', head: 'plumeHelm', weapon: 'giltHeavyCrossbow', quiver: 'gilt', cape: 'teal', banner: 'tealGoldLarge' } },
  cavalry1: { title: '騎卒', emoji: '🐴', col: '#9a7b5a', col2: '#6e4a30', cloth: '#c9b48a', equip: '短褐·草鞍土馬·短矛',
              gear: { body: 'none', head: 'none', mount: 'pony', weapon: 'shortSpear', banner: 'none' } },
  cavalry2: { title: '驍騎', emoji: '🐎', col: '#8b5e3c', col2: '#b8322c', cloth: '#8a7a5a', equip: '皮甲·皮鞍·長矛·環首刀',
              gear: { body: 'leather', head: 'cap', mount: 'horse', weapon: 'spear', banner: 'none' } },
  cavalry3: { title: '突騎', emoji: '🏇', col: '#7a3b32', col2: '#d8b04a', cloth: '#7a5738', equip: '札甲·鐵兜鍪·馬矟·赤纓河西馬',
              gear: { body: 'lamellarFull', head: 'ironHelm', mount: 'warhorse', weapon: 'lance', banner: 'none' } },
  cavalry4: { title: '屯騎', emoji: '🏇', col: '#4e525c', col2: '#b8322c', cloth: '#5d6f8c', equip: '鐵甲·皮馬當胸·鐵矟·黑旗',
              gear: { body: 'lamellarFull', head: 'ironHelm', mount: 'barded', weapon: 'ironLance', banner: 'blackRed' } },
  cavalry5: { title: '羽林', emoji: '🐲', col: '#2a2238', col2: '#f4efe4', cloth: '#b8322c', equip: '玄甲鎏金·鐵馬具裝·白羽兜鍪·丈二馬矟·赤底白羽大纛',
              gear: { body: 'blackIronGold', head: 'plumeHelm', mount: 'ironBardedFull', weapon: 'longLance', banner: 'redWhiteLarge' } },
  siege1:   { title: '匠作', emoji: '🪵', col: '#a47a4c', col2: '#8a7a5a', cloth: '', equip: '粗木車架·麻繩絞弦·木矢',
              gear: { frame: 'rawWood', string: 'hemp', ammo: 'woodBolt', wheels: 2, banner: 'none' } },
  siege2:   { title: '弩匠', emoji: '🏹', col: '#8a6a3c', col2: '#6b6e78', cloth: '', equip: '硬木車架·牛筋弦·鐵鏃巨矢',
              gear: { frame: 'hardWood', string: 'sinew', ammo: 'ironBolt', wheels: 2, banner: 'none' } },
  siege3:   { title: '機巧', emoji: '⚙️', col: '#5a4a3a', col2: '#c58a2d', cloth: '', equip: '鐵包角·銅弩機·十矢箭匣·黑漆',
              gear: { frame: 'ironBound', trigger: 'bronze', ammo: 'boltMagazine', wheels: 4, banner: 'none' } },
  siege4:   { title: '石砲', emoji: '🪨', col: '#4a3a30', col2: '#b8322c', cloth: '', equip: '巨木拋桿·銅軸·石彈·赤漆車身',
              gear: { frame: 'redLacquer', arm: 'log', axle: 'bronze', ammo: 'stone', wheels: 4, banner: 'smallBlack' } },
  siege5:   { title: '霹靂', emoji: '⚡', col: '#2b2320', col2: '#e6b84a', cloth: '', equip: '包鐵雙拋桿·鎏金獸首軸·朱漆描金·火油雷石·黑底赤電大纛',
              gear: { frame: 'redGoldLacquer', arm: 'ironBoundDouble', axle: 'giltBeast', ammo: 'fireStone', wheels: 6, banner: 'blackRedLarge' } }
};

const TD_COMBAT = {
  counterUp: 0.5, counterDown: 0.5,
  hStep: 0.15, hRange: 1, mulMin: 0.4, mulMax: 2.0,
  bldMul: { shield: 1.2, archer: 1.2, cavalry: 0.5, siege: 3.0 },
  meleeReach: 1.5, sight: 6, cellCap: 2
};

const TARGET_CLASSES = ['core', 'defense', 'resource', 'storage', 'barracks', 'house', 'wall', 'trap', 'unit', 'any'];
const TERRAIN_TAGS = ['plain', 'road', 'slope', 'hill', 'high', 'wall', 'forest', 'gorge', 'shore', 'shallow', 'deep'];
const ZONES = { 1: 'plain', 2: 'forest', 3: 'gorge', 4: 'hill', 5: 'shore' };

// atk = 造成傷害 %、dmgIn = 受到傷害 %、spd = 移速 %(小數);lowOnly = 僅對較低目標
const TERRAIN_BONUS = {
  shield: {
    plain: {}, road: { spd: 0.25 }, slope: { dmgIn: -0.15 }, hill: { atk: 0.10, dmgIn: -0.15 },
    high: { dmgIn: -0.10 }, wall: { dmgIn: -0.30 }, forest: { dmgIn: -0.10 }, gorge: {}, shore: {},
    shallow: { atk: -0.20, dmgIn: 0.20, spd: -0.50 }
  },
  archer: {
    plain: { dmgIn: 0.10 }, road: { spd: 0.25 }, slope: {}, hill: {}, high: { atk: 0.20 },
    wall: { atk: 0.20, dmgIn: -0.25 }, forest: { dmgIn: -0.25 }, gorge: {}, shore: {},
    shallow: { atk: -0.30, dmgIn: 0.20, spd: -0.50 }
  },
  cavalry: {
    plain: { atk: 0.25, spd: 0.10 }, road: { atk: 0.10, spd: 0.25 }, slope: { atk: 0.20, lowOnly: true },
    hill: { atk: -0.25, spd: -0.25 }, high: { atk: -0.15, spd: -0.15 }, wall: {},
    forest: { atk: -0.30, spd: -0.30 }, gorge: { atk: -0.20 }, shore: { spd: -0.15 },
    shallow: { atk: -0.30, dmgIn: 0.25, spd: -0.60 }
  },
  siege: {
    plain: {}, road: { spd: 0.30 }, slope: {}, hill: { spd: -0.30 }, high: { atk: 0.10 }, wall: {},
    forest: { spd: -0.40 }, gorge: {}, shore: {}, shallow: { dmgIn: 0.25, spd: -0.70 }
  }
};

// fac: han 我軍 | both 雙方 | yellow 黃巾 | bandit 山賊 | hu 胡 | pirate 水賊 | npc 具名/通用
// camp: 由哪座戰陣營放出(null = 非營放出); look: TROOP_LOOK key(敵軍無對應, 暫 null)
const UNITS = {
  militia:  { name: '民兵', fac: 'han', cls: 'shield', profile: 'foot', hp: 60, atk: 6, def: 4, range: 1, spd: 1.0, cd: 1.0, pop: 1, squad: 8, value: 12, targetPrefs: ['any'], camp: null, look: 'shield1', habitText: null, cautious: true },
  hunter:   { name: '獵戶', fac: 'han', cls: 'archer', profile: 'foot', hp: 35, atk: 7, def: 1, range: 4, spd: 1.0, cd: 1.2, pop: 1, squad: 6, value: 12, targetPrefs: ['unit', 'any'], camp: null, look: 'archer1', habitText: null, cautious: true },
  daodun:   { name: '刀盾兵', fac: 'han', cls: 'shield', profile: 'foot', hp: 100, atk: 8, def: 7, range: 1, spd: 0.9, cd: 1.0, pop: 1, squad: 8, value: 18, targetPrefs: ['wall', 'any'], camp: 'shield', look: 'shield2', habitText: '先登破牆' },
  gongbing: { name: '弓兵', fac: 'han', cls: 'archer', profile: 'foot', hp: 50, atk: 10, def: 2, range: 4, spd: 1.0, cd: 1.2, pop: 1, squad: 6, value: 20, targetPrefs: ['defense', 'any'], camp: 'archer', look: 'archer2', habitText: '專射箭樓' },
  qingqi:   { name: '輕騎', fac: 'han', cls: 'cavalry', profile: 'horse', hp: 150, atk: 13, def: 5, range: 1, spd: 2.0, cd: 1.1, pop: 2, squad: 4, value: 36, targetPrefs: ['resource', 'storage', 'any'], camp: 'cavalry', look: 'cavalry2', habitText: '劫掠輜重' },
  tuqi:     { name: '突騎', fac: 'han', cls: 'cavalry', profile: 'horse', hp: 200, atk: 18, def: 7, range: 1, spd: 2.2, cd: 1.0, pop: 3, squad: 3, value: 65, targetPrefs: ['barracks', 'storage', 'any'], charge: 1.5, camp: 'cavalry', look: 'cavalry3', habitText: '直搗營壘' },
  chihou:   { name: '斥候', fac: 'han', cls: 'cavalry', profile: 'horse', hp: 70, atk: 4, def: 2, range: 1, spd: 2.6, cd: 1.2, pop: 1, squad: 2, value: 15, targetPrefs: ['defense', 'any'], scout: 3, trapTaken: 0.5, camp: 'cavalry', look: 'cavalry1', habitText: '探路破陷' },
  changji:  { name: '長戟兵', fac: 'han', cls: 'shield', profile: 'foot', hp: 150, atk: 12, def: 10, range: 1.5, spd: 0.9, cd: 1.0, pop: 2, squad: 4, value: 40, targetPrefs: ['wall', 'defense', 'any'], camp: 'shield', look: 'shield3', habitText: null },
  chuangnu: { name: '床弩', fac: 'han', cls: 'siege', profile: 'heavy', hp: 120, atk: 28, def: 3, range: 5, spd: 0.5, cd: 3.0, pop: 3, squad: 1, value: 60, targetPrefs: ['defense', 'wall', 'any'], minRange: 2, aoe: 0.8, aoeMax: 3, splash: 0.5, camp: 'siege', look: 'siege2', habitText: '拔塔破門' },

  hjzong:   { name: '黃巾賊眾', fac: 'yellow', cls: 'shield', profile: 'foot', hp: 55, atk: 6, def: 3, range: 1, spd: 1.0, cd: 1.0, pop: 1, squad: 10, value: 11, targetPrefs: ['house', 'storage', 'any'], camp: null, look: null, habitText: '見營帳就搶', cautious: true },
  hjlishi:  { name: '黃巾力士', fac: 'yellow', cls: 'shield', profile: 'foot', hp: 220, atk: 10, def: 8, range: 1, spd: 0.7, cd: 1.2, pop: 2, squad: 3, value: 30, targetPrefs: ['defense', 'any'], camp: null, look: null, habitText: '專撲箭樓' },
  szdao:    { name: '山賊刀手', fac: 'bandit', cls: 'shield', profile: 'foot', hp: 95, atk: 9, def: 6, range: 1, spd: 1.0, cd: 1.0, pop: 1, squad: 8, value: 20, targetPrefs: ['resource', 'house', 'storage', 'any'], camp: null, look: null, habitText: '先劫輜重' },
  szgong:   { name: '山賊弓手', fac: 'bandit', cls: 'archer', profile: 'foot', hp: 45, atk: 10, def: 2, range: 4, spd: 1.0, cd: 1.2, pop: 1, squad: 6, value: 18, targetPrefs: ['unit', 'defense', 'any'], camp: null, look: null, habitText: '冷箭射兵' },
  huqi:     { name: '胡騎', fac: 'hu', cls: 'cavalry', profile: 'horse', hp: 140, atk: 12, def: 5, range: 1, spd: 2.2, cd: 1.1, pop: 2, squad: 4, value: 33, targetPrefs: ['resource', 'storage', 'barracks', 'any'], camp: null, look: null, habitText: '掠糧車、燒營' },
  hushe:    { name: '胡騎射手', fac: 'hu', cls: 'cavalry', profile: 'horse', hp: 120, atk: 10, def: 3, range: 3, spd: 2.0, cd: 1.3, pop: 2, squad: 4, value: 30, targetPrefs: ['unit', 'house', 'any'], camp: null, look: null, habitText: '騎射獵兵' },
  shuizei:  { name: '水賊', fac: 'pirate', cls: 'shield', profile: 'foot', hp: 70, atk: 7, def: 4, range: 1, spd: 1.0, cd: 1.0, pop: 1, squad: 8, value: 14, targetPrefs: ['resource', 'house', 'storage', 'any'], swim: true, camp: null, look: null, habitText: '從水路摸上岸' },
  chongche: { name: '衝車', fac: 'both', cls: 'siege', profile: 'heavy', hp: 380, atk: 30, def: 14, range: 1, spd: 0.5, cd: 2.5, pop: 5, squad: 1, value: 60, targetPrefs: ['wall', 'core'], ignoreTroops: true, bldOther: 0.4, camp: 'siege', look: null, habitText: '只撞城門' },
  toushi:   { name: '投石車', fac: 'both', cls: 'siege', profile: 'heavy', hp: 180, atk: 40, def: 4, range: 7, spd: 0.5, cd: 4.0, pop: 4, squad: 1, value: 70, targetPrefs: ['defense', 'wall', 'any'], minRange: 2, aoe: 1, aoeMax: 3, splash: 0.5, camp: 'siege', look: null, habitText: '拔箭樓' },
  zeishuai: { name: '賊帥', fac: 'npc', cls: 'shield', profile: 'foot', hp: 900, atk: 20, def: 14, range: 1, spd: 0.8, cd: 1.2, pop: 6, squad: 1, value: 150, targetPrefs: ['core', 'any'], aura: { r: 3, atk: 0.15 }, boss: true, char: null, camp: null, look: null, habitText: null }
};

const CAMP_POP = { shield: 16, archer: 12, cavalry: 16, siege: 6 };
const LEVY_MAX = 8;
const CAMP_LV = 3;

// 軍令增益(§4.4):drum 擂鼓(全軍);ambush 伏兵(§1.5)
const UNIT_BUFFS = {
  drum: { aps: 0.3, spd: 0.2, dur: 10 },
  ambush: { atk: 0.3, dur: 8, lowPri: true }
};

// 戰鬥陣建築戰鬥屬性(§3.1、§3.2);無攻擊的建築省略 atk 等欄位。scoreW 為摧毀度權重(pts)
const BUILD_COMBAT = {
  hq:      { cat: 'core', hp: 2400, def: 15, scoreW: 30, mat: 'wood', scout: true, cp: 0, garrison: { daodun: 3, gongbing: 3, qingqi: 2, chuangnu: 1 }, trig: 'hit', alert: 6, leash: 10 },
  tower:   { cat: 'defense', hp: 450, def: 10, atk: 12, cd: 1.0, range: 5, mode: 'single', scoreW: 5, mat: 'wood', scout: true, cp: 2 },
  qtower:  { cat: 'defense', hp: 250, def: 6, atk: 7, cd: 0.6, range: 4.5, mode: 'single', scoreW: 2, mat: 'wood', scout: true, cp: 1 },
  ztower:  { cat: 'defense', hp: 650, def: 12, atk: 26, cd: 2.2, range: 5.5, mode: 'single', scoreW: 6, mat: 'wood', scout: true, cp: 3 },
  lianu:   { cat: 'defense', hp: 450, def: 10, atk: 8, cd: 1.2, range: 5, mode: 'multi', multi: 3, scoreW: 6, mat: 'wood', scout: true, cp: 3 },
  huojian: { cat: 'defense', hp: 400, def: 8, atk: 10, cd: 2.0, range: 4.5, mode: 'aoe', aoe: 1.0, aoeMax: 3, splash: 0.6, burn: { dps: 4, dur: 3, vs: { archer: 1.5, siege: 1.5, shield: 0.8 } }, vs: { siege: 1.5 }, scoreW: 6, mat: 'wood', scout: true, cp: 3 },
  xunyan:  { cat: 'defense', hp: 400, def: 8, atk: 4, cd: 2.0, range: 3.5, mode: 'aoe', aoe: 1.5, aoeMax: 6, splash: 1.0, burn: { dps: 3, dur: 4 }, slow: { mul: 0.6, dur: 2 }, scoreW: 5, mat: 'earth', scout: true, cp: 3 },
  nutai:   { cat: 'defense', hp: 400, def: 10, atk: 22, cd: 2.5, range: 6, mode: 'pierce', pierce: [1, 0.7, 0.5], vs: { cavalry: 1.5 }, scoreW: 6, mat: 'wood', scout: true, cp: 3 },
  chuangtai: { cat: 'defense', hp: 500, def: 10, atk: 40, cd: 4.0, range: 9, minRange: 2, mode: 'single', vs: { siege: 1.5 }, scoreW: 7, mat: 'wood', scout: true, cp: 4 },
  shitai:  { cat: 'defense', hp: 500, def: 12, atk: 30, cd: 4.0, range: 7, minRange: 2, mode: 'aoe', aoe: 1.2, aoeMax: 4, splash: 0.6, vs: { shield: 1.25 }, scoreW: 7, mat: 'stone', scout: true, cp: 4 },
  pili:    { cat: 'defense', hp: 900, def: 14, atk: 45, cd: 5.0, range: 9, minRange: 3, mode: 'aoe', aoe: 1.5, aoeMax: 6, splash: 0.6, vs: { shield: 1.25, siege: 1.25 }, scoreW: 10, mat: 'wood', scout: true, cp: 6 },
  gutai:   { cat: 'defense', hp: 450, def: 10, aura: { r: 6, aps: 0.2 }, scoreW: 4, mat: 'wood', scout: true, cp: 3 },
  fengsui: { cat: 'defense', hp: 300, def: 8, alarm: { r: 8, aps: 0.15, dur: 20, mark: 0.1 }, scoreW: 3, mat: 'earth', scout: true, cp: 2 },
  wanglou: { cat: 'defense', hp: 300, def: 8, atk: 8, cd: 1.2, range: 7, mode: 'single', vs: { archer: 1.3 }, reveal: 8, scoreW: 3, mat: 'wood', scout: true, cp: 1 },
  qiangzhen: { cat: 'defense', hp: 600, def: 14, atk: 18, cd: 1.5, range: 2, mode: 'aoe', aoe: 1.2, aoeMax: 4, splash: 0.8, vs: { cavalry: 2.0, shield: 0.6 }, scoreW: 4, mat: 'wood', scout: true, cp: 2 },
  ponu:    { cat: 'defense', hp: 400, def: 10, atk: 20, cd: 2.0, range: 6, mode: 'single', ap: 0.7, vs: { shield: 1.5 }, scoreW: 5, mat: 'wood', scout: true, cp: 3 },
  dilou:   { cat: 'defense', hp: 1000, def: 16, atk: 14, cd: 1.0, range: 5, mode: 'single', scoreW: 7, mat: 'stone', scout: true, cp: 4 },
  zhalou:  { cat: 'wall', hp: 900, def: 20, atk: 10, cd: 1.2, range: 4, mode: 'single', scoreW: 0, mat: 'wood', scout: true, cp: 3 },
  lujiao:  { cat: 'wall', hp: 120, def: 8, scoreW: 0, mat: 'wood', scout: true, cp: 0 },
  jianzhuang: { cat: 'trap', scoreW: 0, mat: 'wood', scout: true, slow: { foot: 0.8, horse: 0.5, heavy: 0.5 }, cp: 1 },
  tent:    { cat: 'house', hp: 200, def: 6, scoreW: 3, mat: 'wood', scout: true, trig: 'range', alert: 6, cp: 1 },
  wagon:   { cat: 'resource', hp: 300, def: 6, scoreW: 4, mat: 'wood', scout: true, cp: 1 },
  granary: { cat: 'storage', hp: 450, def: 8, scoreW: 5, mat: 'earth', scout: true, cp: 1 },
  muster:  { cat: 'barracks', hp: 600, def: 10, scoreW: 6, mat: 'wood', scout: true, garrison: { daodun: 2, gongbing: 2 }, trigger: 7, leash: 10, trig: 'range', alert: 8, cp: 4 },
  banner:  { cat: 'barracks', hp: 250, def: 6, scoreW: 4, mat: 'wood', scout: true, garrison: { hunter: 2 }, trigger: 5, leash: 7, trig: 'range', alert: 5, cp: 1 },
  fakecamp: { cat: 'house', hp: 80, def: 0, scoreW: 0, mat: 'wood', scout: true, looksAs: 'tent', cp: 1 },
  wall:    { cat: 'wall', hp: 200, def: 15, scoreW: 0, mat: 'stone', scout: true },
  gate:    { cat: 'wall', hp: 600, def: 18, scoreW: 0, mat: 'wood', scout: true },
  palace:  { cat: 'core', hp: 2400, def: 15, scoreW: 30, garrison: { daodun: 3, changji: 2, gongbing: 3, qingqi: 2, chuangnu: 1 }, trig: 'hit' },
  house:   { cat: 'house', hp: 200, def: 6, scoreW: 3, garrison: { militia: 1 }, trig: 'range', alert: 4 },
  market:  { cat: 'resource', hp: 300, def: 6, scoreW: 4 },
  lumber:  { cat: 'resource', hp: 300, def: 6, scoreW: 4, garrison: { hunter: 1 }, trig: 'range', alert: 7 },
  quarry:  { cat: 'resource', hp: 300, def: 6, scoreW: 4 },
  research: { cat: 'house', hp: 500, def: 8, scoreW: 4 },
  archer:  { cat: 'barracks', hp: 600, def: 10, scoreW: 6, garrison: { gongbing: 3 }, trig: 'range', alert: 7 },
  shield:  { cat: 'barracks', hp: 600, def: 10, scoreW: 6, garrison: { daodun: 3 }, trig: 'range', alert: 7 },
  cavalry: { cat: 'barracks', hp: 600, def: 10, scoreW: 6, garrison: { qingqi: 3 }, trig: 'range', alert: 7 },
  siege:   { cat: 'barracks', hp: 600, def: 10, scoreW: 6, garrison: { chuangnu: 3 }, trig: 'range', alert: 7 },
  hospital: { cat: 'barracks', hp: 300, def: 6, scoreW: 3 },
  // 不可攻擊(障礙 / 通行)
  tree: {},
  stone: {},
  stairs: {},
  bridge: {}
};

// 陣地容量點(PLAN_DEFENSE §B.4):索引 = CAMP_LV − 1。CAMP_CP 為各等級的總點數上限;單一 type 上限 = floor(CAMP_CP × CAMP_CP_PCT)
// 每種物件的點數見 BUILD_COMBAT[type].cp
const CAMP_CP = [40, 60, 100, 120, 140];
const CAMP_CP_PCT = 0.3;
// 只剩格數 / 唯一 / 強力建築的硬上限(牆、鹿角以格數計,其餘以座數計)
const CAMP_CAPS = {
  hq:        [1, 1, 1, 1, 1],
  wall:      [60, 110, 160, 190, 220],
  lujiao:    [20, 40, 60, 70, 80],
  gate:      [1, 2, 3, 3, 4],
  zhalou:    [0, 1, 2, 2, 2],
  pili:      [0, 0, 1, 1, 2],
  fengsui:   [0, 1, 1, 1, 1],
  gutai:     [0, 1, 2, 2, 3],
  dilou:     [0, 2, 4, 4, 4],
  muster:    [1, 2, 3, 3, 4],
  banner:    [1, 2, 3, 3, 4],
  fakecamp:  [1, 1, 2, 2, 3]
};
// 戰陣等級:prog 載入後由 progCampTier / progCampCp 決定(PLAN_PROGRESSION §2.1);未載入退回 CAMP_LV / CAMP_CP
function campTierNow() {
  return typeof prog !== 'undefined' && prog && typeof progCampTier === 'function' ? progCampTier(prog.lv) : CAMP_LV;
}
function campCpNow() {
  return typeof prog !== 'undefined' && prog && typeof progCampCp === 'function' ? progCampCp(prog.lv) : CAMP_CP[CAMP_LV - 1];
}
// 目前等級的硬上限;沒有硬上限的 key 回傳 null(舊的 tower / nutai / shitai / support 已改由 CP 管)
function campCap(key) {
  const a = CAMP_CAPS[key];
  return a ? a[campTierNow() - 1] : null;
}

// 戰陣物件(§6.1、規格 M0-03 第 3 點);side 'camp' 只在戰鬥陣
const CAMP_OBJECTS = {
  hq:       { name: '帥帳', icon: '🏕️', w: 4, h: 4, max: 1, on: [T_GRASS, T_ROAD], cost: {}, side: 'camp' },
  tower:    { name: '箭樓', icon: '🗼', w: 2, h: 2, on: [T_GRASS, T_ROAD], cost: {}, side: 'camp' },
  nutai:    { name: '弩台', icon: '🎯', w: 2, h: 2, on: [T_GRASS, T_ROAD], cost: {}, side: 'camp' },
  shitai:   { name: '投石台', icon: '☄️', w: 2, h: 2, on: [T_GRASS, T_ROAD], cost: {}, side: 'camp' },
  tent:     { name: '營帳', icon: '⛺', w: 2, h: 2, on: [T_GRASS, T_ROAD], cost: {}, side: 'camp' },
  wagon:    { name: '輜重車', icon: '🛒', w: 2, h: 2, on: [T_GRASS, T_ROAD], cost: {}, side: 'camp' },
  granary:  { name: '糧囤', icon: '🌾', w: 2, h: 2, on: [T_GRASS, T_ROAD], cost: {}, side: 'camp' },
  muster:   { name: '屯兵營', icon: '⚔️', w: 2, h: 2, on: [T_GRASS, T_ROAD], cost: {}, side: 'camp' },
  banner:   { name: '將旗', icon: '🚩', w: 1, h: 1, on: [T_GRASS, T_ROAD], cost: {}, side: 'camp' },
  fakecamp: { name: '疑營', icon: '⛺', w: 2, h: 2, on: [T_GRASS, T_ROAD], cost: {}, side: 'camp' },
  qtower:   { name: '輕箭樓', icon: '🏹', w: 1, h: 1, on: [T_GRASS, T_ROAD], cost: {}, side: 'camp' },
  ztower:   { name: '重箭樓', icon: '🗼', w: 2, h: 2, on: [T_GRASS, T_ROAD], cost: {}, side: 'camp' },
  lianu:    { name: '連弩樓', icon: '🎯', w: 2, h: 2, on: [T_GRASS, T_ROAD], cost: {}, side: 'camp' },
  huojian:  { name: '火箭樓', icon: '🔥', w: 2, h: 2, on: [T_GRASS, T_ROAD], cost: {}, side: 'camp' },
  xunyan:   { name: '熏煙台', icon: '💨', w: 2, h: 2, on: [T_GRASS, T_ROAD], cost: {}, side: 'camp' },
  chuangtai: { name: '床弩台', icon: '🏹', w: 2, h: 2, on: [T_GRASS, T_ROAD], cost: {}, side: 'camp' },
  pili:     { name: '霹靂車', icon: '☄️', w: 3, h: 3, max: 1, on: [T_GRASS, T_ROAD], cost: {}, side: 'camp' },
  gutai:    { name: '擂鼓台', icon: '🥁', w: 2, h: 2, on: [T_GRASS, T_ROAD], cost: {}, side: 'camp' },
  fengsui:  { name: '烽燧台', icon: '🔥', w: 1, h: 1, on: [T_GRASS, T_ROAD], cost: {}, side: 'camp' },
  wanglou:  { name: '望樓', icon: '👁️', w: 1, h: 1, on: [T_GRASS, T_ROAD], cost: {}, side: 'camp' },
  qiangzhen: { name: '拒馬槍陣', icon: '🔱', w: 2, h: 2, on: [T_GRASS, T_ROAD], cost: {}, side: 'camp' },
  ponu:     { name: '破甲弩', icon: '🎯', w: 2, h: 2, on: [T_GRASS, T_ROAD], cost: {}, side: 'camp' },
  dilou:    { name: '敵樓', icon: '🏯', w: 2, h: 2, on: [T_GRASS, T_ROAD], cost: {}, side: 'camp' },
  zhalou:   { name: '閘樓', icon: '🚪', w: 3, h: 1, swap: true, on: [T_GRASS, T_ROAD], cost: {}, side: 'camp' },
  lujiao:   { name: '鹿角', icon: '🪵', w: 1, h: 1, drag: true, on: [T_GRASS, T_ROAD], cost: {}, side: 'camp' },
  jianzhuang: { name: '尖樁陣', icon: '📍', w: 2, h: 2, on: [T_GRASS, T_ROAD], cost: {}, side: 'camp' }
};
Object.assign(OBJECTS, CAMP_OBJECTS);

// 既有物件的 side(§3.1、§3.2)
['tree', 'stone', 'wall', 'gate', 'stairs', 'bridge'].forEach(function (k) { OBJECTS[k].side = 'both'; });
['lumber', 'quarry', 'research', 'archer', 'shield', 'cavalry', 'siege', 'hospital'].forEach(function (k) { OBJECTS[k].side = 'estate'; });
// 洛陽城範本用到的經營建築(戰鬥布置棋盤也要能放);戰鬥工具列不列出它們(buildCampToolbar 只列 CAMP_GROUPS 明列的項目)
['house', 'market', 'palace'].forEach(function (k) { OBJECTS[k].side = 'both'; });

// 把 BUILD_COMBAT 轉成 OBJECTS[type].cb;未列的欄位為 null
const CB_KEYS = ['hp', 'def', 'cat', 'block', 'scoreW', 'atk', 'cd', 'range', 'minRange', 'mode', 'aoe', 'aoeMax', 'splash', 'pierce', 'vs', 'garrison', 'trigger', 'leash', 'trig', 'alert', 'mat', 'scout', 'looksAs', 'multi', 'burn', 'slow', 'ap', 'aura', 'alarm', 'reveal', 'cp'];
const BLOCK_OF = { tree: 'obstacle', stone: 'obstacle', stairs: 'none', bridge: 'none', wall: 'wall', gate: 'wall', lujiao: 'wall', zhalou: 'wall', jianzhuang: 'none' };
Object.keys(BUILD_COMBAT).forEach(function (type) {
  const src = BUILD_COMBAT[type], cb = {};
  CB_KEYS.forEach(function (k) { cb[k] = src[k] !== undefined ? src[k] : null; });
  cb.block = BLOCK_OF[type] || 'solid';
  OBJECTS[type].cb = cb;
});

// ---- 純函式(一):克制、高度、單次傷害、選目標(B §2.3、§5.3、§7.2;全部確定性,不用 Math.random / Date.now)----
function counterMul(aCls, tCls) {
  var m = 1;
  if (!aCls || !tCls) return m;
  if ((COUNTER[aCls] || []).indexOf(tCls) >= 0) m *= 1 + TD_COMBAT.counterUp;
  if ((COUNTER[tCls] || []).indexOf(aCls) >= 0) m *= 1 - TD_COMBAT.counterDown;
  return m;
}
function heightMul(attackerH, targetH) {
  var d = Math.max(-2, Math.min(2, attackerH - targetH));
  return 1 + TD_COMBAT.hStep * d;
}
// 回傳 { atk, dmgIn, range, spd }:atk / dmgIn / spd 為倍率(1 = 無加成),range 為格數加成(上限 hRange)
function unitBonus(unit, terrainTag, heightDelta) {
  var b = (TERRAIN_BONUS[unit.cls] || {})[terrainTag] || {};
  var hd = heightDelta || 0;
  var ranged = unit.range > TD_COMBAT.meleeReach;
  var terrAtk = (b.lowOnly && hd <= 0) ? 0 : (b.atk || 0);
  return {
    atk: (1 + terrAtk) * heightMul(hd, 0),
    dmgIn: 1 + (b.dmgIn || 0),
    range: Math.min(TD_COMBAT.hRange, (b.range || 0) + (ranged && hd > 0 ? TD_COMBAT.hRange : 0)),
    spd: Math.max(0.2, 1 + (b.spd || 0))
  };
}
// 單次命中傷害。att / tgt: { cls, atk, def, vs? };attBonus / tgtBonus 為 unitBonus 結果或 null
function hitDamage(att, tgt, attBonus, tgtBonus, isBld) {
  var mul = counterMul(att.cls, tgt.cls);
  if (attBonus) mul *= attBonus.atk;
  if (tgtBonus) mul *= tgtBonus.dmgIn;
  if (att.vs && tgt.cls && att.vs[tgt.cls]) mul *= att.vs[tgt.cls];
  if (isBld && att.cls) mul *= TD_COMBAT.bldMul[att.cls] || 1;
  mul = Math.max(TD_COMBAT.mulMin, Math.min(TD_COMBAT.mulMax, mul));
  return att.atk * att.atk / (att.atk + tgt.def) * mul;
}
// 選目標(§2.3)。candidates: [{ id, kind:'bld'|'unit', tc, cls, hp, dist, distB, via, blocking }]
// opts: { engagedBy, sight }。回傳 { goal, hit } 或 null
function pickTarget(unit, candidates, opts) {
  opts = opts || {};
  var sight = opts.sight || TD_COMBAT.sight;
  var byId = {}, i, j, c, best, eng;
  for (j = 0; j < candidates.length; j++) byId[candidates[j].id] = candidates[j];
  function effDist(x) { return isFinite(x.dist) ? x.dist : (x.distB == null ? Infinity : x.distB); }
  function usable(x) {
    if (!(x.hp > 0) || !isFinite(effDist(x))) return false;
    return x.kind !== 'unit' || x.dist <= sight;
  }
  function better(x, b) {
    return !b || effDist(x) < effDist(b) || (effDist(x) === effDist(b) && x.id < b.id);
  }
  function matches(p, x) {
    if (p === 'any') return x.kind === 'bld' && x.tc !== 'wall' && x.tc !== 'trap';
    if (p === 'wall') return x.kind === 'bld' && x.tc === 'wall' && !!x.blocking;
    if (p === 'unit') return x.kind === 'unit';
    return x.kind === 'bld' && x.tc === p;
  }
  function result(x) {
    if (isFinite(x.dist) || x.via == null) return { goal: x, hit: x };
    return { goal: x, hit: byId[x.via] || x };
  }
  // 1. 接觸覆寫:被守軍貼身攔截(ignoreTroops 例外)
  if (!unit.ignoreTroops && opts.engagedBy != null) {
    eng = byId[opts.engagedBy];
    if (eng && eng.hp > 0) return { goal: eng, hit: eng };
  }
  // 2. 依 targetPrefs 順序,取第一個有合格候選的類別
  var prefs = unit.targetPrefs || [];
  for (i = 0; i < prefs.length; i++) {
    best = null;
    for (j = 0; j < candidates.length; j++) {
      c = candidates[j];
      if (usable(c) && matches(prefs[i], c) && better(c, best)) best = c;
    }
    if (best) return result(best);
  }
  // 3. 退而求其次:最近非牆建築 → 警戒內守軍 → 最近的牆
  var tiers = [
    function (x) { return x.kind === 'bld' && x.tc !== 'wall' && x.tc !== 'trap'; },
    function (x) { return x.kind === 'unit'; },
    function (x) { return x.kind === 'bld' && x.tc === 'wall'; }
  ];
  for (i = 0; i < tiers.length; i++) {
    best = null;
    for (j = 0; j < candidates.length; j++) {
      c = candidates[j];
      if (usable(c) && tiers[i](c) && better(c, best)) best = c;
    }
    if (best) return result(best);
  }
  return null;
}

// ---- 純函式(二):防禦建築選敵、駐軍釋放與守軍啟動 / 選敵(B §2.5、§2.6;全部確定性,不用 Math.random / Date.now)----
// team:0 攻擊方(我方放兵)、1 守方(守軍);bld / u 為 td.js 的建築與單位物件
function udDistBld(bl, x, y) {
  const dx = Math.max(bl.x - x, 0, x - (bl.x + bl.w));
  const dy = Math.max(bl.y - y, 0, y - (bl.y + bl.h));
  return Math.sqrt(dx * dx + dy * dy);
}
function udHeightAt(b, x, y) {
  const cx = Math.min(MAP_W - 1, Math.max(0, Math.floor(x)));
  const cy = Math.min(MAP_H - 1, Math.max(0, Math.floor(y)));
  return b.map.height[cy * MAP_W + cx];
}
// 防禦建築選敵(§2.6):射程內最近(同距比 id 小)、黏住直到死亡或出射程;minRange 內不打;高處建築射程 +1
// enemies 為攻擊方單位陣列;回傳單位或 null;黏住目標存於 bld.btgt(由 td.js 寫入)
function buildingTarget(bld, enemies, b) {
  const cb = bld.cb || {};
  if (!(cb.atk > 0) || !(cb.range > 0)) return null;
  const hB = udHeightAt(b, bld.x, bld.y);
  function inRange(u) {
    if (!(u.hp > 0)) return false;
    const d = udDistBld(bld, u.x, u.y);
    const reach = cb.range + 0.5 + (hB > udHeightAt(b, u.x, u.y) ? 1 : 0);
    if (d > reach) return false;
    return !(cb.minRange && d < cb.minRange);
  }
  const cur = bld.btgt;
  if (cur && inRange(cur)) return cur;
  let best = null, bd = Infinity;
  for (let k = 0; k < enemies.length; k++) {
    const e = enemies[k];
    if (!inRange(e)) continue;
    const d = udDistBld(bld, e.x, e.y);
    if (best === null || d < bd || (d === bd && e.id < best.id)) { best = e; bd = d; }
  }
  return best;
}
// 駐軍釋放(§2.5、§3.1):依 bld.cb.garrison({兵種: 人數})配置,只回傳結果、不修改 b。
// 每人回傳 { u, x, y, hx, hy, leash, alert, trig }:
//   (x,y) 建築外圈可通行格中心;(hx,hy) 守備點(12 格內最近集結點,否則建築中心)
//   leash 未啟動前的待命半徑;alert 警戒範圍半徑(cb.trigger,預設 7);trig 'range'(敵入警戒即啟動)或 'hit'(僅被攻擊啟動)
function garrisonRelease(bld, b) {
  const g = (bld.cb || {}).garrison;
  if (!g) return [];
  const leash = bld.cb.leash || 10, alert = bld.cb.alert || bld.cb.trigger || 7, trig = bld.cb.trig || 'range';
  const cx = bld.x + bld.w / 2, cy = bld.y + bld.h / 2;
  let hx = cx, hy = cy, bestD = Infinity;
  const rl = (b.map && b.map.marks && b.map.marks.rally) || [];
  for (let k = 0; k < rl.length; k++) {
    const p = rl[k];
    const d = Math.sqrt((p.x + 0.5 - cx) * (p.x + 0.5 - cx) + (p.y + 0.5 - cy) * (p.y + 0.5 - cy));
    if (d <= 12 && d < bestD) { bestD = d; hx = p.x + 0.5; hy = p.y + 0.5; }
  }
  const ring = [];
  for (let yy = bld.y - 1; yy <= bld.y + bld.h; yy++)
    for (let xx = bld.x - 1; xx <= bld.x + bld.w; xx++) {
      if (xx >= bld.x && xx < bld.x + bld.w && yy >= bld.y && yy < bld.y + bld.h) continue;
      if (xx < 0 || yy < 0 || xx >= MAP_W || yy >= MAP_H) continue;
      ring.push(yy * MAP_W + xx);
    }
  const out = [];
  Object.keys(g).forEach(function (u) {
    const n = g[u] | 0, def = UNITS[u];
    if (!def || n <= 0) return;
    const P = getPass(b, def.profile);
    const cells = ring.filter(function (i) {
      if (P.cost[i] === PATH_UNREACH) return false;
      const gi = b.bldGrid[i];
      const bl = gi ? b.bld[gi - 1] : null;
      return !(bl && bl.alive && bl.cb.block === 'wall');
    });
    for (let k = 0; k < n; k++) {
      let x, y;
      if (cells.length) { const i = cells[k % cells.length]; x = (i % MAP_W) + 0.5; y = Math.floor(i / MAP_W) + 0.5; }
      else { x = cx; y = cy; }
      out.push({ u: u, x: x, y: y, hx: hx, hy: hy, leash: leash, alert: alert, trig: trig });
    }
  });
  return out;
}
// 守軍啟動判定:自己被攻擊(unit.hurt)即啟動;trig 'range' 時敵人進入 home 警戒範圍(home.alert)亦啟動。
// 一旦啟動由 td.js 設 active,之後不再回到待命
function garrisonWake(unit, enemies, home) {
  if (unit.hurt) return true;
  if (home.trig === 'hit') return false;
  for (let k = 0; k < enemies.length; k++) {
    const e = enemies[k];
    if (!(e.hp > 0)) continue;
    const dx = e.x - home.x, dy = e.y - home.y;
    if (Math.sqrt(dx * dx + dy * dy) <= home.alert) return true;
  }
  return false;
}
// 啟動後守軍選敵:黏住 unit.utgt 直到死亡;否則警戒範圍(自 home 算)內最近(距自身)→ 否則全圖最近;同距比 id 小
// 戰場無存活敵人時回傳 null。home: { x, y, leash, alert, trig }
function garrisonTarget(unit, enemies, home) {
  const cur = unit.utgt;
  if (cur && cur.hp > 0) return cur;
  let best = null, bestIn = false, bd = Infinity;
  for (let k = 0; k < enemies.length; k++) {
    const e = enemies[k];
    if (!(e.hp > 0)) continue;
    const hx = e.x - home.x, hy = e.y - home.y;
    const inA = Math.sqrt(hx * hx + hy * hy) <= home.alert;
    const dx = e.x - unit.x, dy = e.y - unit.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (best === null || (inA && !bestIn) || (inA === bestIn && (d < bd || (d === bd && e.id < best.id)))) {
      best = e; bestIn = inA; bd = d;
    }
  }
  return best;
}

// ---- 純函式(三):出征容量與兵種卡驗證(PLAN_TD_UNITS §4.2、§7.2;全部確定性,科技倍率 MVP = 1.0)----
// 【舊制,不再用於出征】出征改為人口上限 TD_POP_CAP(td.js),不再依各科容量 / 鄉勇與卡片驗證;以下函式保留供舊測試與參考。
// estateObjs:經營基地物件陣列(取 o.type);回傳 { byCls: {shield, archer, cavalry, siege}, levy, total }
function marchCapacity(estateObjs) {
  const cnt = { shield: 0, archer: 0, cavalry: 0, siege: 0 };
  const objs = estateObjs || [];
  for (let k = 0; k < objs.length; k++) {
    const t = objs[k] && objs[k].type;
    if (cnt.hasOwnProperty(t)) cnt[t]++;
  }
  const byCls = {};
  let sum = 0;
  CLS_ORDER.forEach(function (c) { byCls[c] = cnt[c] * CAMP_POP[c]; sum += byCls[c]; });
  const levy = LEVY_MAX;
  return { byCls: byCls, levy: levy, total: sum + levy };
}
// 一張卡的人口 = UNITS[u].pop × UNITS[u].squad × n(§4.2)。【舊制,不再用於出征】
function cardPop(card) {
  const def = UNITS[card.u];
  if (!def) return 0;
  return def.pop * def.squad * (card.n | 0);
}
// 只能用鄉勇容量的兵種(民兵、獵戶)
const LEVY_UNITS = { militia: true, hunter: true };
const CARD_PARTS = ['van', 'main', 'rear', 'ambush'];
// 【舊制,不再用於出征】驗證一組卡(§4.1、§4.2、§7.2):≤5 張;每張為有效兵種且 n ≥ 1;至少 1 張先鋒('van');
// 各科人口合計 ≤ cap.byCls[cls];民兵 / 獵戶合計 ≤ cap.levy。回傳 { ok, err }(err 為繁體中文,ok 時 err 為 null)
function validateCards(cards, cap) {
  const fail = function (msg) { return { ok: false, err: msg }; };
  if (!cards || !cards.length) return fail('至少需要 1 張卡');
  if (cards.length > 5) return fail('最多 5 張卡,目前 ' + cards.length + ' 張');
  let hasVan = false;
  const used = {};
  let levyUsed = 0;
  for (let k = 0; k < cards.length; k++) {
    const c = cards[k];
    const def = c && UNITS[c.u];
    if (!def) return fail('第 ' + (k + 1) + ' 張卡的兵種不存在');
    if (!(c.n >= 1) || c.n !== (c.n | 0)) return fail('第 ' + (k + 1) + ' 張卡為空卡(人數須為 1 以上整數)');
    if (CARD_PARTS.indexOf(c.part) < 0) return fail('第 ' + (k + 1) + ' 張卡的部別不正確');
    if (c.part === 'van') hasVan = true;
    const pop = cardPop(c);
    if (LEVY_UNITS[c.u]) levyUsed += pop;
    else used[def.cls] = (used[def.cls] || 0) + pop;
  }
  if (!hasVan) return fail('至少需要 1 張先鋒卡');
  if (levyUsed > cap.levy) return fail('鄉勇人口超過容量(' + levyUsed + ' / ' + cap.levy + ')');
  const over = CLS_ORDER.filter(function (c) { return (used[c] || 0) > cap.byCls[c]; });
  if (over.length) {
    const c = over[0];
    return fail(CLS_NAME[c] + '人口超過容量(' + used[c] + ' / ' + cap.byCls[c] + ')');
  }
  return { ok: true, err: null };
}

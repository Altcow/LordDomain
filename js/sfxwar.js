// sfxwar.js — 戰鬥音效(PLAN_AUDIO §5)。每 100 ms 輪詢 battle.shots / battle.events / 建築 alive,
// 聚合後以預渲染 AudioBuffer 播放。只讀 battle,不進模擬;battle 為 null、音效關閉或安靜模式時不發聲。
// 播放自己走 AU.buses.sfx 並登記進 AU.voices(共用 16 聲上限);不經 auSfx,因為需要聲像與 zoom 閘門。

const SFXW_SR = 22050;
const SFXW_STEP_MS = 100;
const SFXW_MIN_GAP = 0.25;   // 同種最短間隔 → 每種每秒最多 4 聲

const SFXW = {
  built: false,
  bufs: {},
  battle: null,
  lastSeq: 0,
  lastEv: 0,
  alive: null,
  muted: false,
  lastPlay: {},
  voices: [],
  stats: { req: {}, played: {}, dropped: {} },
  timer: null
};

// 戰鬥種類表:pri 0 最高(P0 絕不被擠掉)、gap 同種最短間隔(秒)、conc 同種同時上限、gain 基準增益、rec 配方
const SFXW_KINDS = {
  arrow:     { pri: 2, gap: 0.25, conc: 3, gain: 0.5,  rec: 'arrow' },
  bolt:      { pri: 2, gap: 0.3,  conc: 2, gain: 0.55, rec: 'bolt' },
  melee:     { pri: 2, gap: 0.25, conc: 3, gain: 0.45, rec: 'melee' },
  stone:     { pri: 1, gap: 0.4,  conc: 2, gain: 0.6,  rec: 'stone' },
  drum:      { pri: 0, gap: 0.5,  conc: 1, gain: 0.9,  rec: 'drum' },
  flag:      { pri: 0, gap: 1.0,  conc: 1, gain: 0.8,  rec: 'flag' },
  retreat:   { pri: 0, gap: 1.0,  conc: 1, gain: 0.8,  rec: 'retreat' },
  breach:    { pri: 0, gap: 0.5,  conc: 1, gain: 0.7,  rec: 'breach' },
  gate:      { pri: 0, gap: 0.5,  conc: 1, gain: 0.8,  rec: 'gate' },
  collapse:  { pri: 0, gap: 0.4,  conc: 2, gain: 0.8,  rec: 'collapse' },
  coreHurt:  { pri: 0, gap: 2.0,  conc: 1, gain: 0.7,  rec: 'corehurt' },
  coreFall:  { pri: 0, gap: 2.0,  conc: 1, gain: 0.8,  rec: 'corefall' },
  trap:      { pri: 0, gap: 0.3,  conc: 2, gain: 0.6,  rec: 'trap' },
  ambush:    { pri: 1, gap: 1.0,  conc: 1, gain: 0.6,  rec: 'gong' },
  partOpen:  { pri: 1, gap: 1.0,  conc: 1, gain: 0.6,  rec: 'gong2' },
  win:       { pri: 0, gap: 5.0,  conc: 1, gain: 0.7,  rec: 'win' },
  lose:      { pri: 0, gap: 5.0,  conc: 1, gain: 0.7,  rec: 'lose' },
  // 兵種變體(sfxwVariant 依 shot 的發射者 su 選用)
  blade:     { pri: 2, gap: 0.25, conc: 3, gain: 0.45, rec: 'blade' },
  spear:     { pri: 2, gap: 0.25, conc: 3, gain: 0.45, rec: 'spear' },
  stick:     { pri: 2, gap: 0.25, conc: 3, gain: 0.4,  rec: 'stick' },
  hoofL:     { pri: 2, gap: 0.25, conc: 3, gain: 0.4,  rec: 'hoofL' },
  hoofH:     { pri: 2, gap: 0.3,  conc: 2, gain: 0.55, rec: 'hoofH' },
  ram:       { pri: 1, gap: 0.6,  conc: 1, gain: 0.8,  rec: 'ram' },
  woodCrack: { pri: 2, gap: 0.3,  conc: 2, gain: 0.45, rec: 'woodCrack' },
  stoneChip: { pri: 2, gap: 0.3,  conc: 2, gain: 0.45, rec: 'stoneChip' },
  grunt:     { pri: 2, gap: 3.0,  conc: 1, gain: 0.45, rec: 'grunt' },
  shieldHit: { pri: 2, gap: 3.0,  conc: 1, gain: 0.45, rec: 'shieldHit' },
  // 放兵音(sfxwarDeploy):floor 為本種最短間隔下限(秒),覆寫 SFXW_MIN_GAP,讓連續放兵可到 90 ms
  deployShout:      { pri: 1, gap: 0.09, floor: 0.09, conc: 4, gain: 0.5,  rec: 'shout' },
  deployShoutSharp: { pri: 1, gap: 0.09, floor: 0.09, conc: 4, gain: 0.5,  rec: 'shoutSharp' },
  deployCall:       { pri: 1, gap: 0.09, floor: 0.09, conc: 4, gain: 0.45, rec: 'lightCall' },
  deployHorse:      { pri: 1, gap: 0.09, floor: 0.09, conc: 3, gain: 0.55, rec: 'horse' },
  deploySiege:      { pri: 1, gap: 0.09, floor: 0.09, conc: 2, gain: 0.7,  rec: 'siegeDrop' }
};

// 發射者 su → 音效變體(刀盾兵刀劈與盾擊、長戟矛刺、民兵木棍輕擊、輕騎/斥候輕蹄、突騎重蹄、衝車重木撞擊)
const SFXW_SU = { daodun: 'blade', changji: 'spear', militia: 'stick', qingqi: 'hoofL', chihou: 'hoofL', tuqi: 'hoofH', chongche: 'ram' };
// 機率與冷卻:被擊中的悶哼 / 盾碎只偶爾出現(見 sfxwTick)
const SFXW_HURT_P = 0.15;

// 合成配方:layer = { w: sine|tri|square|noise, t 起點, d 長度, f0/f1 頻率(f1 省略同 f0),
// a 振幅, tau 衰減時間常數, hp 雜訊高通截止(Hz), lp / lp1 雜訊低通截止起 / 迄(Hz,指數掃頻) }
const SFXW_REC = {
  arrow: [
    { w: 'sine', t: 0, d: 0.07, f0: 220, f1: 110, a: 0.3, tau: 0.025 },
    { w: 'noise', t: 0.02, d: 0.2, a: 0.22, tau: 0.07, hp: 1500, lp: 6000, lp1: 1800 }
  ],
  bolt: [
    { w: 'noise', t: 0, d: 0.012, a: 0.35, tau: 0.004, hp: 2000, lp: 8000 },
    { w: 'sine', t: 0.01, d: 0.3, f0: 110, f1: 92, a: 0.35, tau: 0.1 },
    { w: 'noise', t: 0.01, d: 0.3, a: 0.1, tau: 0.12, lp: 400 }
  ],
  melee: [
    { w: 'sine', t: 0, d: 0.09, f0: 1800, f1: 1500, a: 0.32, tau: 0.02 },
    { w: 'sine', t: 0, d: 0.06, f0: 2750, a: 0.18, tau: 0.012 },
    { w: 'noise', t: 0, d: 0.025, a: 0.25, tau: 0.005, hp: 3000, lp: 9000 }
  ],
  stone: [
    { w: 'sine', t: 0, d: 0.3, f0: 900, f1: 500, a: 0.1, tau: 0.15 },
    { w: 'noise', t: 0.05, d: 0.25, a: 0.12, tau: 0.1, lp: 1500 },
    { w: 'sine', t: 0.25, d: 0.25, f0: 90, f1: 45, a: 0.45, tau: 0.1 },
    { w: 'noise', t: 0.25, d: 0.18, a: 0.25, tau: 0.05, lp: 500 }
  ],
  stone_aoe: [
    { w: 'sine', t: 0, d: 0.3, f0: 900, f1: 500, a: 0.1, tau: 0.15 },
    { w: 'noise', t: 0.05, d: 0.25, a: 0.12, tau: 0.1, lp: 1500 },
    { w: 'sine', t: 0.25, d: 0.45, f0: 80, f1: 38, a: 0.7, tau: 0.16 },
    { w: 'noise', t: 0.25, d: 0.35, a: 0.4, tau: 0.1, lp: 600 }
  ],
  drum: [
    { w: 'sine', t: 0.00, d: 0.35, f0: 120, f1: 50, a: 0.8, tau: 0.12 },
    { w: 'sine', t: 0.22, d: 0.35, f0: 120, f1: 50, a: 0.7, tau: 0.12 },
    { w: 'sine', t: 0.44, d: 0.4, f0: 120, f1: 50, a: 0.7, tau: 0.13 },
    { w: 'noise', t: 0.00, d: 0.5, a: 0.12, tau: 0.03, lp: 300 }
  ],
  flag: [
    { w: 'sine', t: 0, d: 1.1, f0: 392, a: 0.35, tau: 0.45 },
    { w: 'sine', t: 0, d: 0.7, f0: 784, a: 0.08, tau: 0.25 },
    { w: 'noise', t: 0.08, d: 0.35, a: 0.14, tau: 0.12, hp: 1200, lp: 4000, lp1: 1200 },
    { w: 'tri', t: 0.12, d: 0.3, f0: 660, f1: 880, a: 0.12, tau: 0.12 }
  ],
  retreat: [
    { w: 'sine', t: 0.00, d: 0.5, f0: 300, a: 0.4, tau: 0.14 },
    { w: 'sine', t: 0.00, d: 0.4, f0: 444, a: 0.18, tau: 0.12 },
    { w: 'sine', t: 0.18, d: 0.5, f0: 300, a: 0.4, tau: 0.14 },
    { w: 'sine', t: 0.18, d: 0.4, f0: 444, a: 0.18, tau: 0.12 },
    { w: 'sine', t: 0.36, d: 0.5, f0: 300, a: 0.4, tau: 0.14 },
    { w: 'sine', t: 0.36, d: 0.4, f0: 444, a: 0.18, tau: 0.12 }
  ],
  breach: [
    { w: 'sine', t: 0, d: 0.4, f0: 260, a: 0.25, tau: 0.15 },
    { w: 'noise', t: 0, d: 0.15, a: 0.2, tau: 0.05, hp: 1500, lp: 6000 },
    { w: 'sine', t: 0.12, d: 0.3, f0: 390, a: 0.15, tau: 0.12 }
  ],
  gate: [
    { w: 'noise', t: 0, d: 0.35, a: 0.45, tau: 0.09, hp: 800, lp: 4000 },
    { w: 'sine', t: 0, d: 0.2, f0: 160, f1: 70, a: 0.5, tau: 0.05 },
    { w: 'noise', t: 0.08, d: 0.05, a: 0.3, tau: 0.015, hp: 2500, lp: 8000 },
    { w: 'noise', t: 0.13, d: 0.05, a: 0.3, tau: 0.015, hp: 2500, lp: 8000 },
    { w: 'noise', t: 0.2, d: 0.08, a: 0.3, tau: 0.03, hp: 2500, lp: 8000 }
  ],
  collapse: [
    { w: 'noise', t: 0, d: 1.6, a: 0.55, tau: 0.7, lp: 220 },
    { w: 'sine', t: 0, d: 1.4, f0: 45, f1: 30, a: 0.4, tau: 0.6 },
    { w: 'noise', t: 0.2, d: 0.05, a: 0.25, tau: 0.012, hp: 2000, lp: 7000 },
    { w: 'noise', t: 0.5, d: 0.05, a: 0.25, tau: 0.012, hp: 2000, lp: 7000 },
    { w: 'noise', t: 0.8, d: 0.06, a: 0.22, tau: 0.012, hp: 2000, lp: 7000 },
    { w: 'noise', t: 1.1, d: 0.05, a: 0.2, tau: 0.012, hp: 2000, lp: 7000 }
  ],
  corehurt: [
    { w: 'tri', t: 0, d: 1.0, f0: 110, f1: 98, a: 0.4, tau: 0.6 },
    { w: 'tri', t: 0, d: 0.9, f0: 165, a: 0.2, tau: 0.5 },
    { w: 'sine', t: 0, d: 1.0, f0: 55, a: 0.2, tau: 0.6 }
  ],
  corefall: [
    { w: 'square', t: 0, d: 1.6, f0: 220, f1: 110, a: 0.12, tau: 0.9 },
    { w: 'sine', t: 0, d: 1.6, f0: 110, f1: 55, a: 0.35, tau: 0.8 },
    { w: 'sine', t: 0, d: 0.5, f0: 90, f1: 40, a: 0.5, tau: 0.18 },
    { w: 'noise', t: 0, d: 0.3, a: 0.2, tau: 0.08, lp: 600 }
  ],
  trap: [
    { w: 'sine', t: 0, d: 0.15, f0: 1200, f1: 600, a: 0.3, tau: 0.03 },
    { w: 'noise', t: 0, d: 0.03, a: 0.25, tau: 0.008, hp: 3000, lp: 9000 },
    { w: 'sine', t: 0.08, d: 0.2, f0: 880, a: 0.2, tau: 0.06 }
  ],
  gong: [
    { w: 'sine', t: 0, d: 0.7, f0: 330, a: 0.3, tau: 0.25 },
    { w: 'sine', t: 0, d: 0.5, f0: 495, a: 0.12, tau: 0.2 }
  ],
  gong2: [
    { w: 'sine', t: 0, d: 0.8, f0: 392, a: 0.3, tau: 0.3 },
    { w: 'sine', t: 0, d: 0.6, f0: 588, a: 0.1, tau: 0.22 }
  ],
  win: [
    { w: 'tri', t: 0.00, d: 0.3, f0: 392, a: 0.25, tau: 0.2 },
    { w: 'tri', t: 0.25, d: 0.3, f0: 523.25, a: 0.25, tau: 0.2 },
    { w: 'tri', t: 0.50, d: 0.7, f0: 659.25, a: 0.28, tau: 0.45 },
    { w: 'sine', t: 0.50, d: 0.7, f0: 1318.5, a: 0.05, tau: 0.3 },
    { w: 'sine', t: 0.00, d: 0.8, f0: 98, a: 0.2, tau: 0.4 }
  ],
  blade: [
    { w: 'noise', t: 0, d: 0.05, a: 0.35, tau: 0.012, hp: 3500, lp: 10000 },
    { w: 'sine', t: 0, d: 0.1, f0: 2400, f1: 1400, a: 0.14, tau: 0.03 },
    { w: 'sine', t: 0.07, d: 0.14, f0: 180, f1: 120, a: 0.4, tau: 0.04 },
    { w: 'noise', t: 0.07, d: 0.05, a: 0.2, tau: 0.012, lp: 1200 }
  ],
  spear: [
    { w: 'noise', t: 0, d: 0.14, a: 0.22, tau: 0.06, hp: 2500, lp: 9000, lp1: 3000 },
    { w: 'sine', t: 0.04, d: 0.12, f0: 2600, f1: 1900, a: 0.2, tau: 0.03 },
    { w: 'noise', t: 0.12, d: 0.06, a: 0.3, tau: 0.02, hp: 1500, lp: 2500 },
    { w: 'sine', t: 0.12, d: 0.1, f0: 300, f1: 200, a: 0.2, tau: 0.03 }
  ],
  stick: [
    { w: 'sine', t: 0, d: 0.06, f0: 720, f1: 520, a: 0.35, tau: 0.015 },
    { w: 'noise', t: 0, d: 0.03, a: 0.2, tau: 0.006, hp: 2000, lp: 5000 },
    { w: 'sine', t: 0.07, d: 0.05, f0: 640, f1: 460, a: 0.25, tau: 0.014 }
  ],
  hoofL: [
    { w: 'sine', t: 0, d: 0.1, f0: 110, f1: 70, a: 0.3, tau: 0.035 },
    { w: 'noise', t: 0, d: 0.04, a: 0.12, tau: 0.01, hp: 1200, lp: 3000 },
    { w: 'sine', t: 0.13, d: 0.1, f0: 110, f1: 70, a: 0.28, tau: 0.035 },
    { w: 'noise', t: 0.13, d: 0.04, a: 0.12, tau: 0.01, hp: 1200, lp: 3000 }
  ],
  hoofH: [
    { w: 'sine', t: 0, d: 0.14, f0: 90, f1: 50, a: 0.45, tau: 0.05 },
    { w: 'noise', t: 0, d: 0.06, a: 0.22, tau: 0.015, hp: 900, lp: 2500 },
    { w: 'sine', t: 0.12, d: 0.14, f0: 90, f1: 50, a: 0.42, tau: 0.05 },
    { w: 'noise', t: 0.12, d: 0.06, a: 0.22, tau: 0.015, hp: 900, lp: 2500 },
    { w: 'noise', t: 0.05, d: 0.14, a: 0.25, tau: 0.04, hp: 1800, lp: 5000 }
  ],
  ram: [
    { w: 'sine', t: 0, d: 0.6, f0: 70, f1: 38, a: 0.6, tau: 0.18 },
    { w: 'noise', t: 0, d: 0.45, a: 0.35, tau: 0.12, lp: 350 },
    { w: 'noise', t: 0.02, d: 0.1, a: 0.2, tau: 0.02, hp: 700, lp: 2000 },
    { w: 'sine', t: 0.3, d: 0.25, f0: 60, f1: 40, a: 0.35, tau: 0.08 }
  ],
  woodCrack: [
    { w: 'noise', t: 0, d: 0.08, a: 0.3, tau: 0.02, hp: 1500, lp: 5000 },
    { w: 'sine', t: 0, d: 0.07, f0: 330, f1: 200, a: 0.18, tau: 0.02 }
  ],
  stoneChip: [
    { w: 'noise', t: 0, d: 0.06, a: 0.3, tau: 0.012, hp: 2000, lp: 7000 },
    { w: 'sine', t: 0, d: 0.05, f0: 500, f1: 300, a: 0.15, tau: 0.01 },
    { w: 'noise', t: 0.03, d: 0.05, a: 0.15, tau: 0.01, hp: 3000, lp: 9000 }
  ],
  grunt: [
    { w: 'sine', t: 0, d: 0.14, f0: 230, f1: 150, a: 0.2, tau: 0.05 },
    { w: 'noise', t: 0, d: 0.06, a: 0.1, tau: 0.02, lp: 800 }
  ],
  shieldHit: [
    { w: 'sine', t: 0, d: 0.12, f0: 900, f1: 600, a: 0.2, tau: 0.03 },
    { w: 'noise', t: 0, d: 0.05, a: 0.25, tau: 0.01, hp: 2500, lp: 7000 },
    { w: 'noise', t: 0.05, d: 0.08, a: 0.12, tau: 0.03, hp: 1200, lp: 3000 }
  ],
  lose: [
    { w: 'sine', t: 0.00, d: 0.6, f0: 90, f1: 50, a: 0.7, tau: 0.22 },
    { w: 'sine', t: 0.65, d: 0.7, f0: 80, f1: 42, a: 0.6, tau: 0.25 },
    { w: 'tri', t: 0.35, d: 0.9, f0: 196, f1: 185, a: 0.12, tau: 0.4 }
  ],
  // 放兵:步兵吶喊(低頻共振 + 帶噪氣聲)、槍兵較尖的吶喊、弓手號令、騎兵馬嘶 + 蹄聲、器械木響 + 重落地
  shout: [
    { w: 'sine', t: 0, d: 0.3, f0: 170, f1: 120, a: 0.3, tau: 0.1 },
    { w: 'tri', t: 0, d: 0.26, f0: 340, f1: 260, a: 0.12, tau: 0.09 },
    { w: 'noise', t: 0, d: 0.28, a: 0.18, tau: 0.09, hp: 400, lp: 1800 }
  ],
  shoutSharp: [
    { w: 'sine', t: 0, d: 0.26, f0: 260, f1: 190, a: 0.25, tau: 0.09 },
    { w: 'tri', t: 0, d: 0.24, f0: 520, f1: 420, a: 0.14, tau: 0.08 },
    { w: 'noise', t: 0, d: 0.24, a: 0.18, tau: 0.08, hp: 800, lp: 2800 },
    { w: 'sine', t: 0.02, d: 0.06, f0: 1400, a: 0.05, tau: 0.02 }
  ],
  lightCall: [
    { w: 'sine', t: 0, d: 0.24, f0: 440, f1: 330, a: 0.2, tau: 0.09 },
    { w: 'tri', t: 0, d: 0.2, f0: 660, f1: 520, a: 0.08, tau: 0.08 },
    { w: 'noise', t: 0, d: 0.16, a: 0.07, tau: 0.06, hp: 1500, lp: 4000 }
  ],
  horse: [
    { w: 'sine', t: 0, d: 0.42, f0: 680, f1: 1050, a: 0.14, tau: 0.2 },
    { w: 'tri', t: 0, d: 0.4, f0: 1360, f1: 1900, a: 0.04, tau: 0.18 },
    { w: 'noise', t: 0, d: 0.4, a: 0.07, tau: 0.18, hp: 1500, lp: 4500, lp1: 2500 },
    { w: 'sine', t: 0.5, d: 0.12, f0: 110, f1: 70, a: 0.3, tau: 0.035 },
    { w: 'noise', t: 0.5, d: 0.04, a: 0.12, tau: 0.01, hp: 1200, lp: 3000 },
    { w: 'sine', t: 0.64, d: 0.12, f0: 110, f1: 70, a: 0.28, tau: 0.035 },
    { w: 'noise', t: 0.64, d: 0.04, a: 0.12, tau: 0.01, hp: 1200, lp: 3000 }
  ],
  siegeDrop: [
    { w: 'noise', t: 0, d: 0.5, a: 0.16, tau: 0.2, hp: 300, lp: 1400, lp1: 700 },
    { w: 'sine', t: 0, d: 0.35, f0: 150, f1: 95, a: 0.08, tau: 0.18 },
    { w: 'sine', t: 0.45, d: 0.35, f0: 80, f1: 38, a: 0.55, tau: 0.12 },
    { w: 'noise', t: 0.45, d: 0.3, a: 0.3, tau: 0.09, lp: 350 }
  ]
};

function sfxwNow() {
  if (typeof performance !== 'undefined' && performance.now) return performance.now() / 1000;
  return Date.now() / 1000;
}

function sfxwClamp(v, lo, hi) {
  if (!(v >= lo)) return lo;
  return v > hi ? hi : v;
}

function sfxwDrop(kind) {
  SFXW.stats.dropped[kind] = (SFXW.stats.dropped[kind] || 0) + 1;
  return false;
}

// 單聲道離線渲染(與 audio.js 的 auRenderLayer 同一包絡,另支援高通與低通掃頻)
function sfxwRenderLayer(out, L) {
  const n = Math.floor(L.d * SFXW_SR);
  const s0 = Math.floor((L.t || 0) * SFXW_SR);
  const f0 = L.f0 || 0;
  const f1 = L.f1 != null ? L.f1 : f0;
  const tau = L.tau || L.d;
  const kHp = L.hp ? 1 - Math.exp(-2 * Math.PI * L.hp / SFXW_SR) : 0;
  const lpA = L.lp || 0;
  const lpB = L.lp1 != null ? L.lp1 : lpA;
  let ph = 0, y = 0, z = 0;
  for (let i = 0; i < n; i++) {
    const idx = s0 + i;
    if (idx >= out.length) break;
    const t = i / SFXW_SR;
    const env = Math.min(1, t / 0.003) * Math.exp(-t / tau) * Math.min(1, (L.d - t) / 0.005);
    let v;
    if (L.w === 'noise') {
      const r = Math.random() * 2 - 1;
      z += kHp * (r - z);
      const hpOut = r - z;
      const cut = lpA > 0 ? lpA * Math.pow(lpB / lpA, i / Math.max(1, n)) : 0;
      const k = cut > 0 ? 1 - Math.exp(-2 * Math.PI * cut / SFXW_SR) : 1;
      y += k * (hpOut - y);
      v = y;
    } else {
      const f = n > 1 && f0 > 0 ? f0 * Math.pow(f1 / f0, i / n) : f0;
      ph += 2 * Math.PI * f / SFXW_SR;
      if (L.w === 'square') v = Math.sin(ph) >= 0 ? 1 : -1;
      else if (L.w === 'tri') v = 2 / Math.PI * Math.asin(Math.sin(ph));
      else v = Math.sin(ph);
    }
    out[idx] += (L.a || 0) * env * v;
  }
}

function sfxwRenderRec(layers) {
  let len = 0;
  layers.forEach(function (L) { len = Math.max(len, (L.t || 0) + L.d); });
  const out = new Float32Array(Math.ceil(len * SFXW_SR) + 1);
  layers.forEach(function (L) { sfxwRenderLayer(out, L); });
  for (let i = 0; i < out.length; i++) out[i] = sfxwClamp(out[i], -0.95, 0.95);
  return out;
}

// 只在 AU.ctx 存在後建立一次;之前的呼叫直接略過
function sfxwarInit() {
  if (SFXW.built) return true;
  if (!AU || !AU.ctx || !AU.ctx.createBuffer) return false;
  try {
    const c = AU.ctx;
    for (const name in SFXW_REC) {
      const pcm = sfxwRenderRec(SFXW_REC[name]);
      const buf = c.createBuffer(1, pcm.length, SFXW_SR);
      buf.getChannelData(0).set(pcm);
      SFXW.bufs[name] = buf;
    }
    SFXW.built = true;
    return true;
  } catch (e) {
    console.warn('[sfxwar] build failed', e);
    return false;
  }
}

function sfxwCfg() {
  const s = typeof settingsGet === 'function' ? settingsGet() : null;
  return {
    sfxOn: !s || !s.sfx || s.sfx.on !== false,
    quiet: !!(s && s.quiet),
    density: s && s.density ? s.density : 'normal'
  };
}

// 螢幕位置(格座標 → 螢幕)。取不到 view / viewport(例如無視窗)回 null,呼叫端改用全域音量
function sfxwPos(gx, gy) {
  if (typeof worldToScreen !== 'function' || typeof isoX !== 'function' || typeof isoY !== 'function') return null;
  if (typeof viewport !== 'object' || !(viewport.w > 0) || !(viewport.h > 0)) return null;
  const w = isoX(gx, gy);
  const h = isoY(gx, gy, 0);
  const p = worldToScreen(w, h);
  const W = viewport.w, H = viewport.h;
  const dx = (p[0] - W / 2) / (W / 2);
  const dy = (p[1] - H / 2) / (H / 2);
  const inView = p[0] > -0.15 * W && p[0] < 1.15 * W && p[1] > -0.15 * H && p[1] < 1.15 * H;
  return { dx: dx, dy: dy, inView: inView, gain: 1 - 0.6 * sfxwClamp(Math.sqrt(dx * dx + dy * dy) / Math.SQRT2, 0, 1) };
}

// 把位置換成 { gain, pan, inView };無位置或取不到螢幕時 gain 1、pan 0、inView true
function sfxwSpatial(gx, gy) {
  if (gx == null || gy == null) return { gain: 1, pan: 0, inView: true, has: false };
  const p = sfxwPos(gx, gy);
  if (!p) return { gain: 1, pan: 0, inView: true, has: false };
  return { gain: p.gain, pan: sfxwClamp(p.dx, -0.8, 0.8), inView: p.inView, has: true };
}

// 播放一聲;回傳是否實際發聲。所有閘門在這裡:開關、安靜、zoom、同種間隔、同種同時上限、全域 16 聲
function sfxwPlay(kind, opt) {
  opt = opt || {};
  const def = SFXW_KINDS[kind];
  if (!def) return false;
  SFXW.stats.req[kind] = (SFXW.stats.req[kind] || 0) + 1;
  if (SFXW.muted) return sfxwDrop(kind);
  const cfg = sfxwCfg();
  if (!cfg.sfxOn || cfg.quiet) return sfxwDrop(kind);
  if (!AU || !AU.ctx || !AU.master || !AU.buses || !AU.buses.sfx) return sfxwDrop(kind);
  if (!SFXW.built && !sfxwarInit()) return sfxwDrop(kind);
  if (opt.zoomLow && def.pri >= 2) return sfxwDrop(kind);

  const densMul = cfg.density === 'low' ? 0.5 : (cfg.density === 'high' ? 1.5 : 1);
  const mul = densMul * (opt.speedMul || 1);
  const now = sfxwNow();
  const gap = Math.max(def.floor != null ? def.floor : SFXW_MIN_GAP, def.gap / mul);
  const last = SFXW.lastPlay[kind];
  if (last !== undefined && now - last < gap) return sfxwDrop(kind);

  SFXW.voices = SFXW.voices.filter(function (v) { return v.end > now; });
  AU.voices = AU.voices.filter(function (v) { return v.end > now; });
  const conc = Math.max(1, Math.round(def.conc * mul));
  if (SFXW.voices.filter(function (v) { return v.k === kind; }).length >= conc) return sfxwDrop(kind);

  if (AU.voices.length >= (AU.maxVoices || 16)) {
    if (def.pri > 1) return sfxwDrop(kind);
    const victim = AU.voices.find(function (v) { return v.pri > 1; });
    if (!victim) return sfxwDrop(kind);
    try { victim.src.stop(); } catch (e) { /* 已停止 */ }
    AU.voices = AU.voices.filter(function (v) { return v !== victim; });
    SFXW.voices = SFXW.voices.filter(function (v) { return v !== victim; });
  }

  const recName = opt.rec || def.rec;
  const buf = SFXW.bufs[recName];
  if (!buf) return sfxwDrop(kind);
  try {
    const c = AU.ctx;
    const rate = (opt.rate || 1) * (1 + (Math.random() * 2 - 1) * 0.04);
    const src = c.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate;
    const g = c.createGain();
    const db = (Math.random() * 2 - 1) * 1.5;
    g.gain.value = def.gain * (opt.gain == null ? 1 : opt.gain) * Math.pow(10, db / 20);
    src.connect(g);
    if (opt.pan != null && typeof c.createStereoPanner === 'function') {
      const pn = c.createStereoPanner();
      pn.pan.value = sfxwClamp(opt.pan, -0.8, 0.8);
      g.connect(pn);
      pn.connect(AU.buses.sfx);
    } else {
      g.connect(AU.buses.sfx);
    }
    src.start(0);
    const end = now + buf.duration / rate + 0.02;
    const entry = { id: 'sw_' + kind, k: kind, pri: def.pri, end: end, src: src };
    SFXW.voices.push(entry);
    AU.voices.push(entry);
    SFXW.lastPlay[kind] = now;
    SFXW.stats.played[kind] = (SFXW.stats.played[kind] || 0) + 1;
    AU.stats.played['sw_' + kind] = (AU.stats.played['sw_' + kind] || 0) + 1;
    AU.stats.peakVoices = Math.max(AU.stats.peakVoices || 0, AU.voices.length);
    return true;
  } catch (e) {
    console.warn('[sfxwar] play failed', e);
    return sfxwDrop(kind);
  }
}

// 事件 → 種類與位置(bld 索引取格座標);回 null 表示此事件不發聲
function sfxwEventKind(b, e) {
  const bl = (e.n != null && b.bld && b.bld[e.n]) ? b.bld[e.n] : null;
  const bx = bl ? bl.x + (bl.w || 1) / 2 : null;
  const by = bl ? bl.y + (bl.h || 1) / 2 : null;
  switch (e.type) {
    case 'drumOrder': return { kind: 'drum' };
    case 'flagOrder': return { kind: 'flag', gx: bx, gy: by };
    case 'retreat': return { kind: 'retreat' };
    case 'breach': return { kind: 'breach', gx: bx, gy: by };
    case 'gateBreak': return { kind: 'gate', gx: bx, gy: by };
    case 'slayer': return { kind: 'coreFall', gx: bx, gy: by };
    case 'coreHurt': return { kind: 'coreHurt', gx: bx, gy: by };
    case 'ambush': return { kind: 'ambush' };
    case 'trapSeen': return { kind: 'trap', gx: bx, gy: by };
    case 'partOpen': return { kind: 'partOpen' };
    default: return null;
  }
}

// 攻擊音變體:依發射者 su 取兵種變體,否則沿用 shot 的 k(arrow / bolt / stone / melee)
function sfxwVariant(r) {
  if (r.su && SFXW_SU[r.su]) return SFXW_SU[r.su];
  return r.k;
}

// 目標格上的建築(bldGrid 存 n+1);無建築回 null
function sfxwTargetBld(b, r) {
  const x = Math.floor(r.tx), y = Math.floor(r.ty);
  if (!b.bldGrid || x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) return null;
  const v = b.bldGrid[y * MAP_W + x];
  return v > 0 && b.bld[v - 1] ? b.bld[v - 1] : null;
}

// 目標格上的存活單位(只在需要區分盾兵與其他兵種時查詢)
function sfxwTargetUnit(b, r) {
  const cx = Math.floor(r.tx), cy = Math.floor(r.ty);
  const us = b.units || [];
  for (let k = 0; k < us.length; k++) {
    const u = us[k];
    if (u.hp > 0 && Math.floor(u.x) === cx && Math.floor(u.y) === cy) return u;
  }
  return null;
}

// 建築由 alive true → false 即倒塌
function sfxwAliveSnap(b) {
  const out = [];
  for (let i = 0; i < (b.bld || []).length; i++) out.push(!!b.bld[i].alive);
  return out;
}

function sfxwTick() {
  try {
    const b = typeof battle !== 'undefined' ? battle : null;
    if (!b) { SFXW.battle = null; return; }
    if (b !== SFXW.battle) {
      SFXW.battle = b;
      SFXW.lastSeq = b.shotSeq || 0;
      SFXW.lastEv = (b.events || []).length;
      SFXW.alive = sfxwAliveSnap(b);
    }
    sfxwarInit();

    const speedMul = b.speed >= 4 ? 0.5 : (b.speed >= 2 ? 0.7 : 1);
    const zoomLow = typeof view === 'object' && view && view.zoom < 0.35;
    const cap = typeof TD_SHOT_MAX === 'number' ? TD_SHOT_MAX : 256;

    // 新攻擊事件(依 seq,重複不重播)
    const seq = b.shotSeq || 0;
    if (seq < SFXW.lastSeq) SFXW.lastSeq = seq;
    const shots = [];
    for (let s = SFXW.lastSeq; s < seq; s++) {
      const r = b.shots[s % cap];
      if (r && r.seq === s) shots.push(r);
    }
    SFXW.lastSeq = seq;

    // 新事件與建築倒塌
    const evs = b.events || [];
    if (evs.length < SFXW.lastEv) SFXW.lastEv = 0;
    const newEv = evs.slice(SFXW.lastEv);
    SFXW.lastEv = evs.length;

    const alive = sfxwAliveSnap(b);
    const collapsed = [];
    if (SFXW.alive && SFXW.alive.length === alive.length) {
      for (let i = 0; i < alive.length; i++) {
        if (SFXW.alive[i] && !alive[i]) collapsed.push(b.bld[i]);
      }
    }
    SFXW.alive = alive;

    // 事件音:同一種類一批只留第一個(sfxwPlay 的閘門會擋其餘)
    const speedOpt = { speedMul: speedMul, zoomLow: zoomLow };
    newEv.forEach(function (e) {
      if (e.type === 'end') {
        if (typeof bgmScene === 'function' || !b.result) return;
        sfxwPlay(b.result.stars >= 1 ? 'win' : 'lose', speedOpt);
        return;
      }
      const m = sfxwEventKind(b, e);
      if (!m) return;
      const sp = sfxwSpatial(m.gx, m.gy);
      sfxwPlay(m.kind, { gain: sp.inView ? sp.gain : 0.2, pan: sp.has ? sp.pan : null, zoomLow: zoomLow, speedMul: speedMul });
    });
    collapsed.forEach(function (bl) {
      const sp = sfxwSpatial(bl.x + (bl.w || 1) / 2, bl.y + (bl.h || 1) / 2);
      sfxwPlay('collapse', { gain: sp.inView ? sp.gain : 0.2, pan: sp.has ? sp.pan : null, zoomLow: zoomLow, speedMul: speedMul });
    });

    // 攻擊:每種每批只播一聲,音量依批量;視窗外 P2/P3 丟棄、P1 降為 0.2
    const groups = {};
    function addG(kind, r) {
      if (!groups[kind]) groups[kind] = { n: 0, rep: null, repD: Infinity, aoe: false, team: r.team };
      const g = groups[kind];
      g.n++;
      if (r.aoe) g.aoe = true;
      const sp = sfxwSpatial(r.tx, r.ty);
      if (sp.inView && (1 - sp.gain) < g.repD) { g.repD = 1 - sp.gain; g.rep = sp; g.team = r.team; }
    }
    shots.forEach(function (r) {
      if (r.k === 'fire') return;
      const vk = sfxwVariant(r);
      if (SFXW_KINDS[vk]) addG(vk, r);
      // 目標為建築:依材質播木裂或石屑;目標為單位:偶爾悶哼或盾擊(機率低,冷卻長)
      const tb = sfxwTargetBld(b, r);
      if (tb) {
        const mat = tb.cb && tb.cb.mat;
        if (mat === 'stone') addG('stoneChip', r);
        else if (mat === 'wood') addG('woodCrack', r);
      } else if (Math.random() < SFXW_HURT_P) {
        const tu = sfxwTargetUnit(b, r);
        if (tu) addG(UNITS[tu.u] && UNITS[tu.u].cls === 'shield' ? 'shieldHit' : 'grunt', r);
      }
    });
    Object.keys(groups).forEach(function (k) {
      const g = groups[k];
      const def = SFXW_KINDS[k];
      let sp = g.rep;
      if (!sp) {
        if (def.pri >= 2) return;
        sp = { gain: 0.2, pan: null, has: false };
      }
      const agg = Math.min(1, 0.45 + 0.18 * Math.log(g.n) / Math.LN2);
      const opt = Object.assign({ gain: agg * sp.gain, pan: sp.has ? sp.pan : null, zoomLow: zoomLow, speedMul: speedMul });
      if (k === 'melee') opt.rate = g.team === 1 ? 0.92 : 1.04;
      if (k === 'stone' && g.aoe) opt.rec = 'stone_aoe';
      sfxwPlay(k, opt);
    });
  } catch (e) {
    console.warn('[sfxwar] tick failed', e);
  }
}

// 錄影快轉 / 拖曳時呼叫(battleui 可選掛點);on = true 時不發聲但仍推進指標
function sfxwarSeek(on) {
  SFXW.muted = !!on;
}

// 兵種 id → 放兵音種類(槍兵獨立音色;其餘依 cls / profile:器械、騎兵、弓手,其他為步兵吶喊)
const SFXW_DEPLOY_OVR = { changji: 'deployShoutSharp' };
function sfxwDeployKind(u) {
  const def = typeof UNITS === 'object' && UNITS ? UNITS[u] : null;
  if (!def) return null;
  if (SFXW_DEPLOY_OVR[u]) return SFXW_DEPLOY_OVR[u];
  if (def.cls === 'siege') return 'deploySiege';
  if (def.cls === 'cavalry' || def.profile === 'horse') return 'deployHorse';
  if (def.cls === 'archer') return 'deployCall';
  return 'deployShout';
}

// 放兵成功時呼叫(一隊只響一聲)。count 為該隊人數(squad),音量隨人數略增且上限 1.25 倍;
// gx / gy 為格座標(可省略,省略時不做聲像)。連續放兵最短 90 ms;回傳是否實際發聲
function sfxwarDeploy(unitId, count, gx, gy) {
  try {
    const kind = sfxwDeployKind(unitId);
    if (!kind) return false;
    const now = sfxwNow();
    if (SFXW.lastDeploy !== undefined && now - SFXW.lastDeploy < 0.09) return false;
    const gain = Math.min(1.25, 1 + 0.08 * Math.log2(Math.max(1, count | 0)));
    const sp = sfxwSpatial(gx, gy);
    const ok = sfxwPlay(kind, { gain: gain * sp.gain, pan: sp.has ? sp.pan : null });
    if (ok) SFXW.lastDeploy = now;
    return ok;
  } catch (e) {
    console.warn('[sfxwar] deploy failed', e);
    return false;
  }
}

if (typeof setInterval === 'function') {
  SFXW.timer = setInterval(sfxwTick, SFXW_STEP_MS);
}

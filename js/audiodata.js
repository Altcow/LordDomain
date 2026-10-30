// audiodata.js — 音訊純資料(PLAN_AUDIO §4.4、§10.2)。只宣告,不碰 DOM。
// AU0:設定預設值、6 個合成 UI 音的頻率控制表與配方;AU1 預備欄位(AUDIO_SYNTH_AU1)留空。

// settings.v1 的預設值(§1.3);settingsui.js 讀寫時逐欄與此合併
const AUDIO_SETTINGS_DEFAULT = {
  v: 1,
  quiet: false,
  music: { on: true, vol: 0.5 },
  sfx: { on: true, vol: 0.8 },
  amb: { on: true, vol: 0.4 },
  density: 'normal',
  followSilent: true,
  seasonMode: 'manual',
  hand: 'right',
  weatherFx: true,
  custom: { on: false, mode: 'replace', shuffle: true, estate: [], battle: [], fishing: [] }
};

// 呼叫端使用的別名 → 正式 id(auPlay('click') 等)
const AUDIO_ALIAS = { click: 'ui_tap', done: 'build_done' };

// 戰鬥項目 maxN 的密度乘數(§1.3 density)
const AUDIO_DENSITY_MUL = { low: 0.5, normal: 1, high: 1.5 };

// 同類冷卻(秒);AU0 尚無使用者,AU3 以後才會掛 grp
const AUDIO_GROUP_GAP = { nature: 6, animal: 15, music: 25, work: 6, water: 8, religion: 30, trade: 8, bell: 10 };

// 頻率控制表(§4.4):gap 最短間隔(秒)、jit 抖動(±%)、maxN 同 id 同時上限、
// pri 優先(0 最高;0/1 可偷聲)、cat 'ui' 在安靜模式仍播、gain 基準增益、recipe 配方 key
const AUDIO_DEFS = {
  ui_tap:     { pri: 1, gap: 0.08, jit: 0,  maxN: 1, cat: 'ui', gain: 0.5,  recipe: 'click' },
  place:      { pri: 1, gap: 0.12, jit: 0,  maxN: 2, cat: 'ui', gain: 0.6,  recipe: 'place' },
  remove:     { pri: 1, gap: 0.12, jit: 0,  maxN: 2, cat: 'ui', gain: 0.5,  recipe: 'remove' },
  error:      { pri: 1, gap: 0.4,  jit: 0,  maxN: 1, cat: 'ui', gain: 0.4,  recipe: 'error' },
  coin:       { pri: 2, gap: 0.25, jit: 0,  maxN: 1, cat: 'ev', gain: 0.5,  recipe: 'coin' },
  build_done: { pri: 0, gap: 1.0,  jit: 0,  maxN: 1, cat: 'ui', gain: 0.6,  recipe: 'done' }
};

// 合成配方:每層 { w: 'sine'|'square'|'tri'|'noise', t 起點秒, d 長度秒, f0/f1 頻率(Hz,f1 省略同 f0),
// a 振幅, tau 指數衰減時間常數(秒), lp 雜訊低通截止(Hz) }
const AUDIO_SYNTH = {
  click: [
    { w: 'sine', t: 0, d: 0.05, f0: 1500, f1: 900, a: 0.5, tau: 0.012 }
  ],
  place: [
    { w: 'sine', t: 0, d: 0.14, f0: 220, f1: 120, a: 0.6, tau: 0.05 },
    { w: 'noise', t: 0, d: 0.012, a: 0.25, tau: 0.004, lp: 3000 }
  ],
  remove: [
    { w: 'noise', t: 0, d: 0.12, a: 0.4, tau: 0.04, lp: 1200 },
    { w: 'sine', t: 0, d: 0.12, f0: 180, f1: 90, a: 0.35, tau: 0.05 }
  ],
  error: [
    { w: 'square', t: 0, d: 0.12, f0: 220, f1: 200, a: 0.22, tau: 0.06 },
    { w: 'square', t: 0.13, d: 0.14, f0: 165, f1: 150, a: 0.22, tau: 0.07 }
  ],
  coin: [
    { w: 'sine', t: 0, d: 0.3, f0: 1568, a: 0.4, tau: 0.09 },
    { w: 'sine', t: 0.07, d: 0.3, f0: 2093, a: 0.35, tau: 0.1 },
    { w: 'noise', t: 0, d: 0.01, a: 0.15, tau: 0.003, lp: 6000 }
  ],
  // 宮商角徵羽(C D E G A)琶音,收尾
  done: [
    { w: 'sine', t: 0.00, d: 0.5, f0: 523.25, a: 0.35, tau: 0.22 },
    { w: 'sine', t: 0.10, d: 0.5, f0: 587.33, a: 0.35, tau: 0.22 },
    { w: 'sine', t: 0.20, d: 0.5, f0: 659.25, a: 0.35, tau: 0.22 },
    { w: 'sine', t: 0.30, d: 0.5, f0: 783.99, a: 0.35, tau: 0.22 },
    { w: 'sine', t: 0.42, d: 0.6, f0: 880.00, a: 0.4, tau: 0.3 },
    { w: 'sine', t: 0.42, d: 0.4, f0: 1760.0, a: 0.06, tau: 0.12 }
  ]
};

// AU1 預備:擂鼓、鑼、鐘等合成配方待 AU1-01 填入(格式同 AUDIO_SYNTH)
const AUDIO_SYNTH_AU1 = {};

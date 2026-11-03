// bgm.js — 程序化古風背景音樂與場景切換(PLAN_AUDIO §7.3、§7.4;AU1-02)。
// 零音檔:音色在 JS 內算成 PCM,預渲染成 AudioBuffer 快取;排程以 AudioContext 時間做 lookahead。
// 依賴 audio.js 的 AU(ctx、master、buses.music、ready)、auCfg()、auNow();game / battle / ART_TOD / currentSeason 只讀。
// 外部 API:bgmStart / bgmStop / bgmScene / bgmSetScene / bgmSetEnabled / bgmStats。檔案載入時自動 bgmStart,音訊解鎖後才出聲。
// 曲目庫:BG_TRACKS[場景群組] = 多首可選曲目(只新增排程資料,音色共用快取);選曲 API:bgmGroups / bgmTracks / bgmPickGet / bgmPickSet / bgmAudition / bgmAuditionStop。
// 曲目全由調式、速度、音色組合、節奏型、鼓型、和聲進行變化產生,無外部音檔、無第三方旋律。

const BG_LOOK = 0.25;
const BG_TICK_MS = 100;
const BG_POLL_MS = 500;
const BG_WAIT_MS = 1000;
const BG_DEBOUNCE = 1.2;
const BG_MIN_DWELL = 8;
const BG_FADE = 1.5;
const BG_FADE_HARD = 0.6;
const BG_MAX_VOICES = 8;
const BG_MAX_VOICES_LITE = 4;
// 省電模式(perf.js isPowerSave)避開的重音色曲目(預渲染樣本多、聲部密);只在選曲時換掉,不改玩家存的選曲設定
const BG_HEAVY = { pozhen: 1, tieqi: 1, gongcheng: 1, fenghuo: 1, juezhan: 1, yexi: 1 };
const BG_PHRASE = 32;
const BG_TRACK_GAIN = 0.8;
const BG_WARM_MS = 6;
const BG_WARM_MAX = 8; // 快取命中很快,另限每 tick 建立的 AudioBuffer 張數
const BG_FADE_OUT_QUICK = 0.05;
const BG_PICK_KEY = 'lorddomain.bgm.pick';
const BG_ROT_KEY = 'lorddomain.bgm.rot';

const BG_MODES = {
  gong: [0, 2, 4, 7, 9],
  shang: [0, 2, 5, 7, 10],
  jue: [0, 3, 5, 8, 10],
  zhi: [0, 2, 5, 7, 9],
  yu: [0, 3, 5, 7, 10]
};

const BG_GAIN = {
  guz: 0.55, flute: 0.4, erhu: 0.4, pipa: 0.5, horn: 0.35, taiko: 0.7, wood: 0.5, gong: 0.45, chime: 0.35,
  taikoL: 0.7, taikoH: 0.5, woodL: 0.5, woodH: 0.4, gongH: 0.4, gongL: 0.45
};
const BG_DUR = { taiko: 0.7, wood: 0.12, gong: 2.6, chime: 2.2, taikoL: 0.45, taikoH: 0.2, woodL: 0.12, woodH: 0.1, gongH: 1.6, gongL: 3 };
// 打擊樂變音:共用同一份預渲染樣本,只改播放速率(不增加渲染量)
const BG_ALIAS = { taikoL: ['taiko', 0.62], taikoH: ['taiko', 1.6], woodL: ['wood', 0.66], woodH: ['wood', 1.4], gongH: ['gong', 1.45], gongL: ['gong', 0.75] };
// 動機節奏型:可選的音符長度(格數);重複的值等於加權
const BG_RHY = {
  slow: [2, 4, 4, 6, 8], fast: [2, 2, 4], steady: [2, 2, 4, 4], flow: [1, 2, 2, 3, 4], long: [4, 6, 8, 8],
  gallop: [1, 1, 2, 3, 3], drive: [1, 2, 2, 2, 4], syncop: [1, 1, 3, 6, 8]
};
const BG_BUF_DUR = { guz: 1.4, flute: 1.6, erhu: 1.6, pipa: 0.9, horn: 1.2 };
const BG_PITCHED = { guz: 1, flute: 1, erhu: 1, pipa: 1, horn: 1 };

// 場景表。percA / percB:A 段、B 段的鼓型樣式(每小節 16 格;X 重、x 中、o 輕、. 無)
// pad:持續音音量(0 = 不播);stream:流水底音量;woodEvery:隨機梆子間隔秒(觀察期)
const BG_SCENES = {
  estate_day: {
    bpm: 84, mode: 'gong', tonics: [60, 62, 65, 67], mel: [['guz', 0.6], ['flute', 0.4]],
    dens: 0.55, rhythm: 'slow', pad: 0.12, horn: 0,
    percA: { taiko: 'o.......o.......', wood: '....x.......x...' },
    percB: { taiko: 'o.......o.......', wood: '....x.......x...' }
  },
  design: {
    bpm: 66, mode: 'yu', tonics: [50, 52, 55], mel: [['guz', 1]], dens: 0.3, rhythm: 'slow', pad: 0.3, horn: 0,
    percA: { taiko: 'x.......o.......' }, percB: { taiko: 'x.......o.......' }
  },
  scout: {
    bpm: 60, mode: 'yu', tonics: [48, 50], mel: [], dens: 0, rhythm: 'slow', pad: 0.3, horn: 0,
    percA: {}, percB: {}, woodEvery: [6, 12]
  },
  battle: {
    bpm: 132, mode: 'yu', tonics: [57, 59, 62], mel: [['pipa', 1]], dens: 0.9, rhythm: 'fast', pad: 0.2, horn: 0.5,
    percA: { taiko: 'X.o.x.o.X.o.x.o.' },
    percB: { taiko: 'X.x.X.x.X.x.X.x.', wood: '..x...x...x...x.' }
  },
  fishing: {
    bpm: 76, mode: 'zhi', tonics: [62, 64, 67], mel: [['flute', 1]], dens: 0.5, rhythm: 'slow', pad: 0.12, horn: 0,
    percA: { wood: '..x.....x.......' }, percB: { wood: '..x.....x.......' }, stream: 0.25
  }
};

// 各場景會用到的音色(預渲染佇列依此排)
const BG_SCENE_INST = {
  estate_day: ['guz', 'flute', 'taiko', 'wood', 'pad'],
  design: ['guz', 'taiko', 'pad'],
  scout: ['pad', 'wood'],
  battle: ['pipa', 'horn', 'taiko', 'wood', 'pad'],
  fishing: ['flute', 'wood', 'pad', 'stream'],
  win: ['horn', 'guz', 'chime', 'gong'],
  lose: ['pipa', 'erhu', 'horn', 'gong']
};

// ---- 曲目庫 ----
// 每首欄位沿用 BG_SCENES,另有:id / name / desc;modeB、modeC(B / C 段調式轉位);prog(每句的主音位移半音,循環);
// dbl:[音色, 度數位移, 最短格數](旋律加疊一聲部);hornGap / fanfare(號角間隔句數 / 號角動機 [起格, 度數, 格數]);
// swell(漸強週期句數);climax / cLift(第 9~12 句為高潮 C 段,可升八度);drumDur(鼓點最長秒數,控制聲部占用);
// legacy:true = 原版曲(場景表原樣,含季節 / 時段微調)。群組 estate_night = 經營夜間(場景仍是 estate_day)。
function bgClassic(scene, name, desc) {
  return Object.assign({ id: 'classic', name: name, desc: desc, legacy: true }, BG_SCENES[scene]);
}

const BG_TRACKS = {
  estate_day: [
    bgClassic('estate_day', '庭園閒步', '原版經營曲,隨季節與時段微調'),
    {
      id: 'dawn', name: '田園清晨', desc: '薄霧中的長笛,舒緩開闊', bpm: 72, mode: 'gong', tonics: [60, 62, 67],
      mel: [['flute', 0.7], ['guz', 0.3]], dens: 0.5, rhythm: 'long', pad: 0.15, horn: 0, prog: [0, 0, 5, 7],
      percA: { wood: '........x.......' }, percB: { wood: '....x.......x...' }
    },
    {
      id: 'market', name: '市集熱鬧', desc: '琵琶與古箏輕快對答,梆子打著拍子', bpm: 108, mode: 'zhi', tonics: [62, 67],
      mel: [['pipa', 0.5], ['guz', 0.5]], dens: 0.8, rhythm: 'steady', pad: 0.1, horn: 0, prog: [0, 0, 7, 5],
      percA: { wood: 'x.x.x.x.x.x.x.x.', taikoH: 'o.......o.......' },
      percB: { wood: 'x.x.x.x.xxx.x.x.', woodH: '..o...o...o...o.' }
    },
    {
      id: 'jiangnan', name: '江南小調', desc: '二胡與笛的婉轉小曲,帶水鄉韻味', bpm: 80, mode: 'gong', modeB: 'zhi', tonics: [57, 59],
      mel: [['erhu', 0.5], ['flute', 0.5]], dens: 0.75, rhythm: 'flow', pad: 0.12, horn: 0, prog: [0, 5, 7, 0],
      percA: { woodL: '..x.....x.......' }, percB: { woodL: '..x...x...x...x.' }
    },
    {
      id: 'summit', name: '登高遠眺', desc: '遠方號角與二胡,視野遼闊', bpm: 66, mode: 'shang', tonics: [55, 57],
      mel: [['erhu', 0.7], ['flute', 0.3]], dens: 0.45, rhythm: 'long', pad: 0.28, horn: 0.6, hornGap: 4, prog: [0, 7, 5, 0],
      percA: { taikoL: 'o...............' }, percB: { taikoL: 'o.......o.......', gongL: 'o...............' }
    }
  ],
  estate_night: [
    bgClassic('estate_day', '夜色庭園', '原版夜間經營曲,極簡稀疏'),
    {
      id: 'moon', name: '月下撫琴', desc: '單一古箏,稀疏安靜', bpm: 54, mode: 'yu', tonics: [50, 53],
      mel: [['guz', 1]], dens: 0.3, rhythm: 'long', pad: 0.22, horn: 0, percA: {}, percB: {}
    },
    {
      id: 'watch', name: '更鼓夜深', desc: '遠處更梆與低笛,夜深人靜', bpm: 58, mode: 'jue', tonics: [48, 51],
      mel: [['flute', 1]], dens: 0.22, rhythm: 'long', pad: 0.25, horn: 0, percA: {}, percB: {}, woodEvery: [7, 13]
    }
  ],
  design: [
    bgClassic('design', '運籌', '原版布置曲'),
    {
      id: 'plan', name: '運籌帷幄', desc: '古箏與長笛,沉穩思考', bpm: 72, mode: 'zhi', tonics: [52, 55],
      mel: [['guz', 0.6], ['flute', 0.4]], dens: 0.4, rhythm: 'slow', pad: 0.25, horn: 0, prog: [0, 5, 0, 7],
      percA: { taikoL: 'o.......o.......' }, percB: { taikoL: 'o.......o.......' }
    },
    {
      id: 'camp', name: '營壘畫策', desc: '琵琶獨奏,低鼓如腳步', bpm: 62, mode: 'shang', tonics: [50, 53],
      mel: [['pipa', 1]], dens: 0.35, rhythm: 'steady', pad: 0.3, horn: 0, prog: [0, 0, 7, 5],
      percA: { taikoL: 'x...o...x...o...' }, percB: { taikoL: 'x...o...x...o...' }
    }
  ],
  scout: [
    bgClassic('scout', '潛行', '原版觀察期曲,低音墊與隨機梆子'),
    {
      id: 'mist', name: '霧中窺探', desc: '稀疏長笛飄在低音墊上', bpm: 56, mode: 'jue', tonics: [46, 48],
      mel: [['flute', 1]], dens: 0.12, rhythm: 'long', pad: 0.3, horn: 0, percA: {}, percB: {}, woodEvery: [7, 13]
    },
    {
      id: 'sentinel', name: '伏兵靜待', desc: '低沉單鼓與梆子,屏息等待', bpm: 64, mode: 'yu', tonics: [45, 48],
      mel: [], dens: 0, rhythm: 'slow', pad: 0.35, horn: 0,
      percA: { taikoL: 'o...............' }, percB: { taikoL: 'o.......o.......' }, woodEvery: [5, 10]
    }
  ],
  fishing: [
    bgClassic('fishing', '垂釣', '原版釣魚曲,長笛與流水'),
    {
      id: 'creek', name: '溪邊垂釣', desc: '笛與箏,流水潺潺', bpm: 70, mode: 'gong', tonics: [60, 62], mel: [['flute', 0.6], ['guz', 0.4]],
      dens: 0.45, rhythm: 'flow', pad: 0.12, horn: 0, percA: { wood: '....x...........' }, percB: { wood: '....x.......x...' }, stream: 0.25
    },
    {
      id: 'dusk', name: '暮江寒釣', desc: '二胡低吟,黃昏江面', bpm: 62, mode: 'shang', tonics: [55, 57], mel: [['erhu', 1]],
      dens: 0.35, rhythm: 'long', pad: 0.18, horn: 0, percA: {}, percB: {}, stream: 0.3
    },
    {
      id: 'rain', name: '蓑笠聽雨', desc: '柔音古箏,雨中靜坐', bpm: 68, mode: 'jue', tonics: [57, 60], mel: [['guz', 1]],
      dens: 0.4, rhythm: 'flow', pad: 0.15, horn: 0, percA: { woodH: '..o.....o.......' }, percB: { woodH: '..o.....o...o...' }, stream: 0.35
    }
  ],
  battle: [
    bgClassic('battle', '行軍', '原版戰鬥曲,琵琶與穩定鼓點'),
    {
      id: 'pozhen', name: '破陣', desc: '急促大鼓與號角,滿格打擊,一路衝鋒', bpm: 146, mode: 'yu', tonics: [57, 59, 62],
      mel: [['pipa', 1]], dens: 0.95, rhythm: 'drive', pad: 0.2, horn: 0.9, hornGap: 2, fanfare: [[0, 0, 4], [4, 2, 4], [8, 4, 6]],
      drumDur: 0.26,
      percA: { taiko: 'X.X.X.X.X.X.X.X.', taikoH: '.o.o.o.o.o.o.o.o' },
      percB: { taiko: 'X.X.X.X.X.X.XXXX', taikoH: '.x.x.x.x.x.x....', woodH: '..x...x...x...x.' }
    },
    {
      id: 'tieqi', name: '鐵騎', desc: '馬蹄切分節奏,琵琶疾彈並疊低八度', bpm: 138, mode: 'shang', tonics: [55, 57],
      mel: [['pipa', 1]], dens: 1, rhythm: 'gallop', pad: 0.15, horn: 0.4, hornGap: 4, dbl: ['pipa', -5, 2], drumDur: 0.22,
      percA: { taikoH: 'x.xxx.xxx.xxx.xx', taikoL: 'X.......X.......' },
      percB: { taikoH: 'xxx.xxx.xxx.xxx.', taikoL: 'X...X...X...X...', woodH: '..x...x...x...x.' }
    },
    {
      id: 'gongcheng', name: '攻城', desc: '沉重鼓點、銅鑼與號角長音,逐句漸強', bpm: 96, mode: 'yu', tonics: [50, 53],
      mel: [['horn', 0.5], ['erhu', 0.5]], dens: 0.6, rhythm: 'long', pad: 0.4, horn: 1, hornGap: 1, fanfare: [[0, 0, 14]],
      swell: 6, drumDur: 0.5,
      percA: { taikoL: 'X.o.X.o.X.o.X.o.', gongL: 'X...............' },
      percB: { taikoL: 'X.xxX.xxX.xxX.xx', gongL: 'X.......X.......' }
    },
    {
      id: 'fenghuo', name: '烽火', desc: '高音笛與二胡的激昂旋律,節奏明快', bpm: 128, mode: 'gong', modeB: 'shang', tonics: [57, 60],
      mel: [['erhu', 0.6], ['flute', 0.4]], dens: 0.9, rhythm: 'drive', pad: 0.2, horn: 0.5, hornGap: 4, prog: [0, 5, 7, 0],
      dbl: ['flute', 5, 2], drumDur: 0.3,
      percA: { taiko: 'X...x...X...x...', woodH: 'x.x.x.x.x.x.x.x.' },
      percB: { taiko: 'X.x.X.x.X.x.X.xx', taikoH: '..o...o...o...o.', woodH: 'x.x.x.x.x.x.x.x.' }
    },
    {
      id: 'juezhan', name: '決戰', desc: '全樂器密集,段落由低沉轉激昂再衝上高潮', bpm: 150, mode: 'yu', modeB: 'jue', modeC: 'gong', tonics: [57, 59],
      mel: [['pipa', 0.5], ['erhu', 0.5]], dens: 0.95, rhythm: 'drive', pad: 0.25, horn: 1, hornGap: 1, fanfare: [[0, 0, 6], [8, 4, 8]],
      prog: [0, 0, 5, 7], dbl: ['horn', -5, 4], climax: true, cLift: 12, drumDur: 0.2,
      percA: { taiko: 'X.X.x.X.X.X.x.XX', taikoH: '.o.o.o.o.o.o.o..' },
      percB: { taiko: 'X.x.X.x.X.x.X.xx', taikoH: '.x.x.x.x.x.x.x.x', woodH: 'x.x.x.x.x.x.x.x.' },
      percC: { taiko: 'XxXxXxXxXxXxXxXx', taikoH: 'oooooooooooooooo', gong: 'X.......X.......', woodH: 'x.x.x.x.x.x.x.x.' }
    },
    {
      id: 'yexi', name: '夜襲', desc: '低沉緊張,快慢交錯的切分,段尾鼓點疾滾', bpm: 112, mode: 'jue', tonics: [45, 48],
      mel: [['erhu', 0.5], ['guz', 0.5]], dens: 0.6, rhythm: 'syncop', pad: 0.4, horn: 0.3, hornGap: 4, drumDur: 0.4,
      percA: { taikoL: 'X.......X.o.o.o.', woodL: '....x.......x.x.' },
      percB: { taikoL: 'X.o.X.o.X.xxxxxx', woodH: '.x..x..x..x..x..' }
    }
  ]
};

const BG_GROUPS = [
  ['estate_day', '經營白天'], ['estate_night', '經營夜間'], ['design', '戰鬥布置'],
  ['scout', '斥候觀察'], ['fishing', '釣魚'], ['battle', '戰鬥']
];

// 戰況強度層(只加疊鼓,不改旋律):1 = 低鼓四拍,2 = 低鼓密集 + 高鼓 + 每句號角
const BG_INTENS = [
  null,
  { taikoL: 'X...x...X...x...' },
  { taikoL: 'X.x.X.x.X.x.X.x.', taikoH: '.o.o.o.o.o.o.o.o' }
];
// 首領營預設用「決戰」(玩家未指定曲目時)
const BG_BOSS_IDS = { hulao: 1, luoyang: 1, chanyu: 1 };

const BG = {
  want: false,
  enabled: true,
  running: false,
  forced: null,
  scene: null,
  sceneStart: 0,
  pending: null,
  cur: null,
  tracks: [],
  live: [],
  bufs: {},
  queue: [],
  queued: {},
  seq: 0,
  returnScene: 'estate_day',
  resultSeen: null,
  stingerEnd: 0,
  stats: { played: {}, dropped: {}, peak: 0 },
  pick: null,
  rot: null,
  audi: null,
  audiPrev: true,
  intensity: 0,
  pollTimer: null,
  pollMs: 0,
  schedTimer: null
};

function bgRng(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function bgHz(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function bgIsScene(name) {
  return Object.prototype.hasOwnProperty.call(BG_SCENES, name);
}

function bgMidiOf(tonic, mode, d) {
  const n = BG_MODES[mode];
  const oct = Math.floor(d / 5);
  return tonic + 12 * oct + n[d - oct * 5];
}

// 依時段 / 季節微調 estate_day;其他場景照表。tid 指定曲目(缺省 = 原版曲);group 為曲目群組(estate_night 時強制夜間)
function bgStyleFor(scene, tid, group) {
  const g = group || scene;
  const tk = tid ? bgTrackById(g, tid) : null;
  const legacy = !tk || tk.legacy === true;
  const base = legacy ? BG_SCENES[scene] : tk;
  const st = Object.assign({}, base);
  st.stream = base.stream || 0;
  st.woodEvery = base.woodEvery || null;
  if (legacy && scene === 'estate_day') st.seasonal = true;
  const season = typeof currentSeason === 'string' ? currentSeason : 'spring';
  const tod = g === 'estate_night' ? 'night' : (typeof ART_TOD === 'string' ? ART_TOD : 'noon');
  if (scene === 'estate_day' && legacy) {
    if (season === 'spring') { st.bpm += 6; st.dens += 0.1; }
    else if (season === 'summer') { st.bpm -= 4; st.mode = 'shang'; }
    else if (season === 'autumn') { st.bpm -= 6; st.mode = 'yu'; st.dens *= 0.7; }
    else if (season === 'winter') { st.bpm -= 12; st.dens = 0.3; st.pad = 0.25; st.mode = 'yu'; st.mel = [['guz', 1]]; }
    if (tod === 'dusk') { st.bpm -= 4; st.mode = 'jue'; }
    if (tod === 'night') {
      st.bpm = 60; st.dens = 0.22; st.mode = 'yu'; st.pad = 0.2; st.mel = [['guz', 1]];
      st.percA = {}; st.percB = {};
    }
  } else if (g === 'estate_day' && !legacy) {
    // 新白天曲只微調速度,保留各自的調式與樂器
    st.bpm += { spring: 4, summer: -2, autumn: -4, winter: -8 }[season] || 0;
    if (tod === 'dusk') st.bpm -= 3;
  }
  return st;
}

// 4 拍一小節(16 格)的動機:音符長度(格數)加總 = 16
function bgMotif(rng, rhythm) {
  const sizes = BG_RHY[rhythm] || BG_RHY.slow;
  const steps = [];
  let left = 16;
  while (left > 0) {
    const cand = sizes.filter(function (x) { return x <= left; });
    const pick = cand[Math.floor(rng() * cand.length)];
    steps.push(pick);
    left -= pick;
  }
  const out = [];
  let d = Math.floor(rng() * 3);
  for (let i = 0; i < steps.length; i++) {
    if (i > 0) d += [-2, -1, -1, 1, 1, 2, 3][Math.floor(rng() * 7)];
    d = Math.max(-3, Math.min(5, d));
    out.push({ d: d, n: steps[i] });
  }
  return out;
}

// 變形:模進、倒影、降一度或原樣(長度不變)
function bgVary(m, rng) {
  const op = Math.floor(rng() * 4);
  const d0 = m[0].d;
  return m.map(function (it) {
    let d = it.d;
    if (op === 0) d += 1;
    else if (op === 1) d = 2 * d0 - it.d;
    else if (op === 2) d -= 1;
    return { d: Math.max(-3, Math.min(5, d)), n: it.n };
  });
}

function bgPickMel(mel, rng) {
  if (!mel || !mel.length) return null;
  let total = 0;
  mel.forEach(function (x) { total += x[1]; });
  let r = rng() * total;
  for (let i = 0; i < mel.length; i++) {
    r -= mel[i][1];
    if (r <= 0) return mel[i][0];
  }
  return mel[mel.length - 1][0];
}

// 一句 = 2 小節(32 格)。A-B-A:每 12 句一輪,第 4~7 句為 B 段(移到屬);climax 曲第 8~11 句為高潮 C 段。
function bgMakePhrase(tr, pi) {
  const rng = tr.rng;
  const st = bgStyleFor(tr.scene, tr.tid, tr.group);
  tr.style = st;
  if (pi % 12 === 0 || !tr.motifs) {
    tr.tonic = st.tonics[Math.floor(rng() * st.tonics.length)];
    tr.motifs = { A: bgMotif(rng, st.rhythm), B: bgMotif(rng, st.rhythm) };
  }
  const k = pi % 12;
  const sec = st.climax && k >= 8 ? 'C' : (k >= 4 && k < 8 ? 'B' : 'A');
  const root = tr.tonic + (st.prog ? st.prog[pi % st.prog.length] : 0);
  const tonic = sec === 'B' ? root + 7 : root;
  const mode = sec === 'B' ? (st.modeB || st.mode) : (sec === 'C' ? (st.modeC || st.modeB || st.mode) : st.mode);
  const lift = sec === 'C' ? (st.cLift || 0) : 0;
  const dens = sec === 'C' ? 1 : st.dens;
  const motif = sec === 'B' ? tr.motifs.B : tr.motifs.A;
  const bars = [motif, bgVary(motif, rng)];
  const mel = bgPickMel(st.mel, rng);
  const byStep = {};
  if (mel) {
    for (let b = 0; b < 2; b++) {
      const seq = bars[b];
      let s = b * 16;
      for (let i = 0; i < seq.length; i++) {
        const it = seq[i];
        const last = b === 1 && i === seq.length - 1;
        if (i === 0 || last || rng() < dens) {
          const n = last ? BG_PHRASE - s : it.n;
          const d = last ? 0 : it.d;
          const v = 0.6 + 0.4 * rng();
          (byStep[s] = byStep[s] || []).push({ inst: mel, midi: bgMidiOf(tonic, mode, d) + lift, n: n, v: v });
          if (st.dbl && n >= (st.dbl[2] || 0)) {
            (byStep[s] = byStep[s] || []).push({ inst: st.dbl[0], midi: bgMidiOf(tonic, mode, d + st.dbl[1]) + lift, n: n, v: v * 0.8 });
          }
        }
        s += it.n;
      }
    }
  }
  if (st.horn > 0 && (sec === 'A' || sec === 'C') && pi % (st.hornGap || 4) === 0 && rng() < st.horn) {
    if (st.fanfare) {
      st.fanfare.forEach(function (f) {
        (byStep[f[0]] = byStep[f[0]] || []).push({ inst: 'horn', midi: bgMidiOf(tonic, mode, f[1]), n: f[2], v: 0.85 });
      });
    } else {
      (byStep[0] = byStep[0] || []).push({ inst: 'horn', midi: tonic, n: 12, v: 0.8 });
    }
  }
  return { sec: sec, byStep: byStep, pads: [root - 12, root - 12 + (sec === 'B' ? 7 : 5)], tonic: root };
}

// 結算短曲(固定譜,不循環):win 約 7.8 秒、lose 約 7.1 秒
function bgStingerScore(kind) {
  const score = {};
  const win = kind === 'win';
  const tonic = win ? 62 : 57;
  const mode = win ? 'gong' : 'yu';
  function add(s, inst, d, n, v) {
    (score[s] = score[s] || []).push({ inst: inst, midi: bgMidiOf(tonic, mode, d), n: n, v: v });
  }
  if (win) {
    add(0, 'horn', 0, 6, 0.9); add(6, 'horn', 2, 4, 0.9); add(12, 'horn', 4, 8, 0.9);
    [0, 2, 4, 5, 4, 2].forEach(function (d, i) { add(20 + 2 * i, 'guz', d, 2, 0.8); });
    add(32, 'guz', 0, 16, 0.9); add(32, 'chime', 0, 1, 0.5); add(36, 'gong', 0, 1, 0.8);
  } else {
    add(0, 'pipa', 4, 2, 0.8); add(2, 'pipa', 3, 2, 0.8); add(4, 'pipa', 2, 2, 0.75);
    add(6, 'pipa', 1, 4, 0.7); add(10, 'pipa', 0, 4, 0.7);
    add(14, 'erhu', 0, 10, 0.7); add(24, 'erhu', -1, 8, 0.6); add(34, 'gong', 0, 1, 0.8);
  }
  return { score: score, len: win ? 52 : 42, stepSec: win ? 60 / 100 / 4 : 60 / 84 / 4 };
}

function bgBuf(key) {
  if (BG.bufs[key]) return BG.bufs[key];
  const pcm = auCached('bg:' + key, AU_SR, function () { return bgRender(key); }, key + JSON.stringify(BG_BUF_DUR));
  const buf = AU.ctx.createBuffer(1, pcm.length, AU_SR);
  buf.getChannelData(0).set(pcm);
  BG.bufs[key] = buf;
  return buf;
}

function bgRender(key) {
  const p = key.split(':');
  const inst = p[0];
  if (inst === 'guz') return bgKS(bgHz(+p[2]), BG_BUF_DUR.guz, p[1] === 's');
  if (inst === 'flute') return bgFlute(bgHz(+p[1]), BG_BUF_DUR.flute);
  if (inst === 'erhu') return bgErhu(bgHz(+p[1]), BG_BUF_DUR.erhu);
  if (inst === 'pipa') return bgPipa(bgHz(+p[1]), BG_BUF_DUR.pipa);
  if (inst === 'horn') return bgHorn(bgHz(+p[1]), BG_BUF_DUR.horn);
  if (inst === 'taiko') return bgTaiko();
  if (inst === 'wood') return bgWood();
  if (inst === 'gong') return bgGong();
  if (inst === 'chime') return bgChime();
  if (inst === 'pad') return bgPad();
  if (inst === 'stream') return bgStream();
  return new Float32Array(1);
}

function bgNorm(out, peak) {
  let m = 0;
  for (let i = 0; i < out.length; i++) {
    const a = Math.abs(out[i]);
    if (a > m) m = a;
  }
  if (m > 0) {
    const k = peak / m;
    for (let i = 0; i < out.length; i++) out[i] *= k;
  }
  return out;
}

// Karplus-Strong 撥弦(箏);soft 為較多平滑、音色較暗
function bgKS(f, dur, soft) {
  const N = Math.max(2, Math.round(AU_SR / f));
  const n = Math.floor(dur * AU_SR);
  const out = new Float32Array(n);
  const d = new Float32Array(N);
  const rnd = bgRng(N * 31 + (soft ? 7 : 3));
  for (let i = 0; i < N; i++) d[i] = rnd() * 2 - 1;
  const passes = soft ? 6 : 1;
  for (let p = 0; p < passes; p++) {
    for (let i = 0; i < N; i++) d[i] = 0.5 * (d[i] + d[(i + 1) % N]);
  }
  const decay = Math.pow(10, -2.5 / Math.max(0.5, f * dur));
  let p = 0;
  for (let i = 0; i < n; i++) {
    const a = d[p];
    out[i] = a;
    const q = p + 1 < N ? p + 1 : 0;
    d[p] = decay * 0.5 * (a + d[q]);
    p = q;
  }
  const fadeN = Math.floor(0.03 * AU_SR);
  for (let i = 0; i < fadeN && i < n; i++) out[n - 1 - i] *= i / fadeN;
  return bgNorm(out, 0.9);
}

function bgFlute(f, dur) {
  const n = Math.floor(dur * AU_SR);
  const out = new Float32Array(n);
  const rnd = bgRng(Math.round(f * 10) + 3);
  let ph = 0;
  let lp = 0;
  for (let i = 0; i < n; i++) {
    const t = i / AU_SR;
    const vib = 1 + 0.006 * Math.min(1, t / 0.4) * Math.sin(2 * Math.PI * 5.2 * t);
    ph += 2 * Math.PI * f * vib / AU_SR;
    const x = rnd() * 2 - 1;
    lp += 0.5 * (x - lp);
    const body = Math.sin(ph) + 0.22 * Math.sin(2 * ph) + 0.07 * Math.sin(3 * ph);
    out[i] = Math.min(1, t / 0.09) * (body * 0.75 + 0.05 * (x - lp));
  }
  return bgNorm(out, 0.9);
}

// 二胡:鋸齒波(諧波 1/k)+ 漸入顫音
function bgErhu(f, dur) {
  const n = Math.floor(dur * AU_SR);
  const out = new Float32Array(n);
  const K = Math.max(1, Math.min(12, Math.floor(2600 / f)));
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / AU_SR;
    const depth = 0.012 * Math.min(1, Math.max(0, (t - 0.15) / 0.5));
    ph += 2 * Math.PI * f * (1 + depth * Math.sin(2 * Math.PI * 5.8 * t)) / AU_SR;
    let s = 0;
    for (let k = 1; k <= K; k++) s += Math.sin(k * ph) / k;
    out[i] = s * Math.min(1, t / 0.06);
  }
  return bgNorm(out, 0.9);
}

// 琵琶:鋸齒波諧波,高次諧波衰減較快(撥弦感)
function bgPipa(f, dur) {
  const n = Math.floor(dur * AU_SR);
  const out = new Float32Array(n);
  const K = Math.max(1, Math.min(8, Math.floor(2600 / f)));
  const dk = [];
  for (let k = 1; k <= K; k++) dk.push((1 + 1.2 * k) / 0.45);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / AU_SR;
    ph += 2 * Math.PI * f / AU_SR;
    let s = 0;
    for (let k = 1; k <= K; k++) s += Math.exp(-t * dk[k - 1]) * Math.sin(k * ph) / k;
    out[i] = Math.min(1, t / 0.004) * s;
  }
  return bgNorm(out, 0.9);
}

// 號角:鋸齒波諧波 + 漸入顫音(合成號角,作為戰鬥 / 結算的號聲)
function bgHorn(f, dur) {
  const n = Math.floor(dur * AU_SR);
  const out = new Float32Array(n);
  const K = Math.max(1, Math.min(10, Math.floor(2400 / f)));
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / AU_SR;
    const vib = 1 + 0.008 * Math.min(1, Math.max(0, (t - 0.25) / 0.4)) * Math.sin(2 * Math.PI * 5.5 * t);
    ph += 2 * Math.PI * f * vib / AU_SR;
    let s = 0;
    for (let k = 1; k <= K; k++) s += Math.sin(k * ph) / k;
    out[i] = s * Math.min(1, t / 0.07);
  }
  return bgNorm(out, 0.9);
}

function bgTaiko() {
  const n = Math.floor(0.7 * AU_SR);
  const out = new Float32Array(n);
  const rnd = bgRng(101);
  let ph = 0;
  let lp = 0;
  for (let i = 0; i < n; i++) {
    const t = i / AU_SR;
    ph += 2 * Math.PI * (55 + 80 * Math.exp(-t / 0.025)) / AU_SR;
    const x = rnd() * 2 - 1;
    lp += 0.3 * (x - lp);
    out[i] = Math.sin(ph) * Math.exp(-t / 0.2) + 0.4 * lp * Math.exp(-t / 0.012);
  }
  return bgNorm(out, 0.9);
}

function bgWood() {
  const n = Math.floor(0.12 * AU_SR);
  const out = new Float32Array(n);
  const rnd = bgRng(202);
  for (let i = 0; i < n; i++) {
    const t = i / AU_SR;
    const x = rnd() * 2 - 1;
    out[i] = Math.sin(2 * Math.PI * 1250 * t) * Math.exp(-t / 0.012)
      + 0.4 * Math.sin(2 * Math.PI * 2600 * t) * Math.exp(-t / 0.006)
      + 0.2 * x * Math.exp(-t / 0.004);
  }
  return bgNorm(out, 0.9);
}

function bgGong() {
  const n = Math.floor(2.6 * AU_SR);
  const out = new Float32Array(n);
  const rnd = bgRng(303);
  const R = [1, 1.48, 1.93, 2.53, 3.1, 4.2];
  const A = [1, 0.6, 0.5, 0.35, 0.22, 0.12];
  for (let i = 0; i < n; i++) {
    const t = i / AU_SR;
    let s = 0;
    for (let j = 0; j < R.length; j++) s += A[j] * Math.sin(2 * Math.PI * 110 * R[j] * t);
    out[i] = s * Math.exp(-t / 1.5) + 0.25 * (rnd() * 2 - 1) * Math.exp(-t / 0.01);
  }
  return bgNorm(out, 0.9);
}

function bgChime() {
  const n = Math.floor(2.2 * AU_SR);
  const out = new Float32Array(n);
  const R = [1, 2.76, 5.4, 8.93];
  const A = [1, 0.5, 0.25, 0.12];
  const T = [0.9, 0.5, 0.25, 0.15];
  for (let i = 0; i < n; i++) {
    const t = i / AU_SR;
    let s = 0;
    for (let j = 0; j < R.length; j++) s += A[j] * Math.exp(-t / T[j]) * Math.sin(2 * Math.PI * 660 * R[j] * t);
    out[i] = s;
  }
  return bgNorm(out, 0.9);
}

// 持續音(低音墊):全部分音為 110 Hz 的整數倍、包絡週期 4 秒,故 4 秒循環無縫
function bgPad() {
  const n = 4 * AU_SR;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / AU_SR;
    const env = 0.75 + 0.25 * Math.sin(2 * Math.PI * t / 4);
    out[i] = env * (0.6 * Math.sin(2 * Math.PI * 110 * t) + 0.3 * Math.sin(2 * Math.PI * 165 * t) + 0.15 * Math.sin(2 * Math.PI * 220 * t));
  }
  return bgNorm(out, 0.9);
}

// 流水底:環狀平滑的白噪音(循環無縫)+ 慢起伏 + 偶發水泡
function bgStream() {
  const n = 4 * AU_SR;
  const rnd = bgRng(404);
  let src = new Float32Array(n);
  for (let i = 0; i < n; i++) src[i] = rnd() * 2 - 1;
  for (let pass = 0; pass < 2; pass++) {
    const dst = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      let s = 0;
      for (let k = -3; k <= 3; k++) s += src[(i + k + n) % n];
      dst[i] = s / 7;
    }
    src = dst;
  }
  for (let i = 0; i < n; i++) src[i] *= 1 + 0.5 * Math.sin(2 * Math.PI * i / n);
  const bl = Math.floor(0.12 * AU_SR);
  for (let k = 0; k < 8; k++) {
    const st = Math.floor(rnd() * n);
    const f = 500 + rnd() * 900;
    for (let j = 0; j < bl; j++) {
      const idx = (st + j) % n;
      src[idx] += 0.6 * Math.sin(2 * Math.PI * f * j / AU_SR) * Math.exp(-j / (0.03 * AU_SR));
    }
  }
  return bgNorm(src, 0.9);
}

// 音色規格:箏 / 笛 / 二胡 / 琵琶 以 60~71 的 12 個音預渲染,其餘音以 playbackRate 移八度
function bgSpec(inst, midi, vel) {
  const al = BG_ALIAS[inst];
  if (al) return { buf: bgBuf(al[0]), rate: al[1] };
  if (inst === 'horn') return { buf: bgBuf('horn:62'), rate: Math.pow(2, (midi - 62) / 12) };
  if (BG_PITCHED[inst] !== 1) return { buf: bgBuf(inst), rate: 1 };
  const base = 60 + (((midi - 60) % 12) + 12) % 12;
  const key = inst === 'guz' ? 'guz:' + (vel < 0.8 ? 's' : 'h') + ':' + base : inst + ':' + base;
  return { buf: bgBuf(key), rate: Math.pow(2, (midi - base) / 12) };
}

function bgVoices(t) {
  let n = 0;
  for (let i = 0; i < BG.live.length; i++) {
    if (BG.live[i].end > t) n++;
  }
  return n;
}

// 單發音:先過聲部上限(旋律留一格給鼓),再建 BufferSource + 包絡增益
function bgPlay(tr, t, inst, midi, vel, dur) {
  const melodic = BG_PITCHED[inst] === 1;
  const maxV = bgMaxVoices();
  if (bgVoices(t) >= (melodic ? maxV - 1 : maxV)) {
    BG.stats.dropped[inst] = (BG.stats.dropped[inst] || 0) + 1;
    return false;
  }
  const sp = bgSpec(inst, midi, vel);
  const ctx = AU.ctx;
  const src = ctx.createBufferSource();
  src.buffer = sp.buf;
  const jig = BG_PITCHED[inst] !== 1 ? 1 + (tr.rng() * 2 - 1) * 0.02 : 1;
  src.playbackRate.setValueAtTime(sp.rate * jig, t);
  let end = t + (dur != null ? dur : (BG_DUR[inst] || 1));
  end = Math.min(end, t + sp.buf.duration / (sp.rate * jig));
  if (end - t < 0.05) end = t + 0.05;
  const peak = BG_GAIN[inst] * vel;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(peak, t + 0.008);
  g.gain.setValueAtTime(peak, Math.max(t + 0.01, end - 0.06));
  g.gain.linearRampToValueAtTime(0, end);
  src.connect(g);
  g.connect(tr.gain);
  src.start(t);
  src.stop(end + 0.02);
  BG.live.push({ start: t, end: end, src: src, tr: tr });
  BG.stats.played[inst] = (BG.stats.played[inst] || 0) + 1;
  const v = bgVoices(t);
  if (v > BG.stats.peak) BG.stats.peak = v;
  return true;
}

// 循環音(持續音墊 / 流水底):只建一次,之後用 playbackRate 改音高
function bgStartLoop(tr, inst, level, t) {
  const ctx = AU.ctx;
  const src = ctx.createBufferSource();
  src.buffer = bgBuf(inst);
  src.loop = true;
  src.loopStart = 0;
  src.loopEnd = src.buffer.duration;
  const g = ctx.createGain();
  g.gain.setValueAtTime(level, t);
  src.connect(g);
  g.connect(tr.gain);
  src.start(t);
  BG.live.push({ start: t, end: Infinity, src: src, tr: tr });
  return src;
}

function bgPadAt(tr, t, midi) {
  if (!tr.pad) tr.pad = bgStartLoop(tr, 'pad', tr.style.pad, t);
  tr.pad.playbackRate.setValueAtTime(Math.pow(2, (midi - 45) / 12), t);
}

function bgStingerStep(tr, t, s) {
  if (s >= tr.len) {
    tr.done = true;
    tr.endT = t + 2.6;
    return;
  }
  const list = tr.score[s];
  if (list) list.forEach(function (ev) { bgPlay(tr, t, ev.inst, ev.midi, ev.v, ev.n * tr.stepSec * 1.2); });
}

// 一個 16 分音格:鼓型樣式、句首音墊、隨機梆子、旋律音
function bgStep(tr, t) {
  if (tr.stinger) {
    bgStingerStep(tr, t, tr.step);
    return;
  }
  const s = tr.step;
  const sp = s % BG_PHRASE;
  if (sp === 0) {
    tr.phrase = bgMakePhrase(tr, tr.pi);
    tr.pi++;
    tr.stepSec = 60 / tr.style.bpm / 4;
  }
  const ph = tr.phrase;
  const st = tr.style;
  const bar = s % 16;
  if (bar === 0 && st.pad > 0) bgPadAt(tr, t, ph.pads[sp >= 16 ? 1 : 0]);
  const pat = (ph.sec === 'B' ? st.percB : (ph.sec === 'C' ? (st.percC || st.percB) : st.percA)) || {};
  let vm = 1;
  if (st.swell > 0) vm = 0.5 + 0.5 * Math.min(1, ((tr.pi - 1) % st.swell) / Math.max(1, st.swell - 1));
  const lay = tr.group === 'battle' && BG.intensity > 0 ? BG_INTENS[BG.intensity] : null;
  const drum = function (name, ch) {
    const dd = st.drumDur && name.indexOf('taiko') === 0 ? st.drumDur : undefined;
    if (ch === 'X') bgPlay(tr, t, name, 0, vm, dd);
    else if (ch === 'x') bgPlay(tr, t, name, 0, 0.75 * vm, dd);
    else if (ch === 'o') bgPlay(tr, t, name, 0, 0.45 * vm, dd);
  };
  for (const name in pat) drum(name, pat[name].charAt(bar));
  if (lay) {
    for (const name in lay) drum(name, lay[name].charAt(bar));
    if (sp === 0 && (BG.intensity >= 2 || tr.pi % 2 === 0)) bgPlay(tr, t, 'horn', ph.tonic, 0.8, 16 * tr.stepSec);
  }
  if (st.woodEvery && t >= tr.nextWood) {
    const w = st.woodEvery;
    bgPlay(tr, t, 'wood', 0, 0.6);
    tr.nextWood = t + w[0] + (w[1] - w[0]) * tr.rng();
  }
  const list = ph.byStep[sp];
  if (list) {
    list.forEach(function (ev) {
      bgPlay(tr, t, ev.inst, ev.midi, ev.v, ev.n * tr.stepSec * (ev.inst === 'guz' ? 1.6 : 1));
    });
  }
}

function bgTrackById(group, id) {
  const list = BG_TRACKS[group];
  if (!list || !id) return null;
  for (let i = 0; i < list.length; i++) {
    if (list[i].id === id) return list[i];
  }
  return null;
}

// 場景 → 曲目群組:經營白天遇夜間時段用 estate_night
function bgGroupOf(scene) {
  if (scene === 'estate_day' && typeof ART_TOD === 'string' && ART_TOD === 'night') return 'estate_night';
  return scene;
}

function bgLoadJson(key) {
  let o = null;
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
    if (raw) o = JSON.parse(raw);
  } catch (e) {
    console.warn('[au] bgm storage read failed', e);
  }
  return o && typeof o === 'object' && !Array.isArray(o) ? o : {};
}

function bgSaveJson(key, o) {
  try {
    localStorage.setItem(key, JSON.stringify(o));
  } catch (e) {
    console.warn('[au] bgm storage write failed', e);
  }
}

function bgPicks() {
  if (!BG.pick) BG.pick = bgLoadJson(BG_PICK_KEY);
  return BG.pick;
}

// 玩家選的曲目 id;未選 / 已不存在的 id 一律視為 'auto'(自動輪播)
function bgmPickGet(group) {
  const id = bgPicks()[group];
  return bgTrackById(group, id) ? id : 'auto';
}

function bgmPickSet(group, id) {
  if (!BG_TRACKS[group]) return false;
  const p = bgPicks();
  if (id && id !== 'auto' && bgTrackById(group, id)) p[group] = id;
  else delete p[group];
  bgSaveJson(BG_PICK_KEY, p);
  return true;
}

function bgmGroups() {
  return BG_GROUPS.map(function (g) { return [g[0], g[1]]; });
}

function bgmTracks(group) {
  return (BG_TRACKS[group] || []).map(function (t) {
    return { id: t.id, name: t.name, desc: t.desc, bpm: t.bpm, mode: t.mode };
  });
}

function bgBossId() {
  try {
    const b = bgCurBattle();
    let id = b && b.refId ? b.refId : null;
    if (!id && typeof game === 'object' && game && game.target) id = game.target.refId;
    return id || null;
  } catch (e) {
    return null;
  }
}

function bgLite() {
  return typeof isPowerSave === 'function' && isPowerSave();
}

function bgMaxVoices() {
  return bgLite() ? BG_MAX_VOICES_LITE : BG_MAX_VOICES;
}

// 省電模式下把重音色曲目換成該群組的 classic(沒有就第一首非重音色曲)
function bgLiteTrack(group, id) {
  if (!bgLite() || !BG_HEAVY[id]) return id;
  if (bgTrackById(group, 'classic')) return 'classic';
  const list = BG_TRACKS[group] || [];
  for (let i = 0; i < list.length; i++) if (!BG_HEAVY[list[i].id]) return list[i].id;
  return id;
}

// 該群組這次進場景要播哪一首:指定曲目 > 首領營預設 > 自動輪播(依序往下一首,不會連兩次同一首)
function bgChooseTrack(group) {
  const list = BG_TRACKS[group];
  if (!list) return null;
  const pick = bgmPickGet(group);
  if (pick !== 'auto') return bgLiteTrack(group, pick);
  if (group === 'battle') {
    const boss = bgBossId();
    if (boss && BG_BOSS_IDS[boss] && bgTrackById(group, 'juezhan')) return bgLiteTrack(group, 'juezhan');
  }
  if (!BG.rot) BG.rot = bgLoadJson(BG_ROT_KEY);
  const last = typeof BG.rot[group] === 'number' ? BG.rot[group] : -1;
  let idx = (((last + 1) % list.length) + list.length) % list.length;
  if (bgLite()) for (let k = 0; k < list.length && BG_HEAVY[list[idx].id]; k++) idx = (idx + 1) % list.length;
  BG.rot[group] = idx;
  bgSaveJson(BG_ROT_KEY, BG.rot);
  return list[idx].id;
}

function bgSelect(scene) {
  if (BG.audi && BG.audi.scene === scene) return { group: BG.audi.group, tid: BG.audi.id };
  const g = bgGroupOf(scene);
  return { group: g, tid: bgChooseTrack(g) };
}

// 試聽:立即播指定群組的曲目(id 為 auto / 未知 = 依輪播挑一首);回傳實際曲目 id 或 false
function bgmAudition(group, id) {
  if (!BG_TRACKS[group]) return false;
  const tid = id && id !== 'auto' && bgTrackById(group, id) ? id : bgChooseTrack(group);
  const scene = group === 'estate_night' ? 'estate_day' : group;
  if (!BG.audi) BG.audiPrev = BG.enabled;
  BG.enabled = true;
  BG.audi = { scene: scene, group: group, id: tid };
  BG.forced = scene;
  if (bgAudioReady() && bgMusicOn()) {
    BG.running = true;
    bgSwitch(scene, BG_FADE_HARD, bgNow());
  }
  return tid;
}

// 結束試聽:回到自動判定的場景(會依目前選曲重新挑曲)
function bgmAuditionStop() {
  if (!BG.audi) return;
  BG.audi = null;
  BG.forced = null;
  BG.enabled = BG.audiPrev !== false;
  if (!bgAudioReady()) return;
  const now = bgNow();
  if (!BG.enabled) {
    if (BG.running) bgHalt(now);
    return;
  }
  if (BG.running && bgMusicOn()) {
    const want = bgDesired();
    if (want) bgSwitch(want, BG_FADE, now);
  }
}

function bgmAuditing() {
  return BG.audi ? { group: BG.audi.group, id: BG.audi.id } : null;
}

// 戰況強度 0~2:剩餘時間 < 60 秒、兵力懸殊(任一方 ≥ 6 且另一方 ≤ 一半)、帥帳受襲警報各加 1;只影響音樂,不進模擬
function bgUpdateIntensity() {
  let lv = 0;
  if (BG.cur && BG.cur.group === 'battle' && !BG.audi) {
    try {
      const b = bgCurBattle();
      if (b && !b.over) {
        if (typeof b.limitTick === 'number' && typeof b.tick === 'number' && (b.limitTick - b.tick) / 10 < 60) lv++;
        const a = b.atkList ? b.atkList.length : 0;
        const d = b.defList ? b.defList.length : 0;
        if (a > 0 && d > 0 && Math.max(a, d) >= 6 && Math.max(a, d) >= 2 * Math.min(a, d)) lv++;
        if (b.alarm && typeof b.alarm.until === 'number' && b.alarm.until > b.tick) lv++;
      }
    } catch (e) {
      lv = 0;
    }
  }
  BG.intensity = Math.min(2, lv);
}

function bgNewTrack(scene, now, fade, sel) {
  BG.seq++;
  const gain = AU.ctx.createGain();
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(BG_TRACK_GAIN, now + fade);
  gain.connect(AU.buses.music);
  const tr = {
    scene: scene, gain: gain, rng: bgRng(918273 + BG.seq * 7919), style: null, tonic: 62, motifs: null,
    phrase: null, pi: 0, step: 0, stepSec: 0.2, nextT: now + 0.05, out: false, done: false, fadeEnd: 0,
    endT: 0, pad: null, nextWood: now + 3, stinger: false, score: null, len: 0, group: scene, tid: null
  };
  if (scene === 'win' || scene === 'lose') {
    const sc = bgStingerScore(scene);
    tr.stinger = true;
    tr.score = sc.score;
    tr.len = sc.len;
    tr.stepSec = sc.stepSec;
  } else {
    const pick = sel || bgSelect(scene);
    tr.group = pick.group;
    tr.tid = pick.tid;
    tr.style = bgStyleFor(scene, tr.tid, tr.group);
    tr.stepSec = 60 / tr.style.bpm / 4;
    if (tr.style.stream > 0) bgStartLoop(tr, 'stream', tr.style.stream, now);
  }
  return tr;
}

// 淡出:從目前音量線性降到 0;循環音在淡出結束時停止
function bgFadeOut(tr, now, sec) {
  const g = tr.gain.gain;
  const cur = typeof g.value === 'number' ? g.value : 0;
  try {
    g.cancelScheduledValues(now);
    g.setValueAtTime(cur, now);
    g.linearRampToValueAtTime(0, now + sec);
  } catch (e) {
    g.value = 0;
  }
  tr.out = true;
  tr.fadeEnd = now + sec + 0.05;
  BG.live.forEach(function (e) {
    if (e.tr === tr && e.end === Infinity) {
      e.end = tr.fadeEnd;
      try { e.src.stop(tr.fadeEnd); } catch (err) { /* 已停止 */ }
    }
  });
}

function bgPrune(now) {
  BG.tracks = BG.tracks.filter(function (tr) {
    const dead = (tr.out && now > tr.fadeEnd) || (tr.done && now > tr.endT + 0.3);
    if (dead) {
      try { tr.gain.disconnect(); } catch (e) { /* 已斷開 */ }
    }
    return !dead;
  });
  BG.live = BG.live.filter(function (e) { return e.end > now - 0.5; });
}

function bgHalt(now) {
  BG.tracks.forEach(function (tr) {
    if (!tr.out) bgFadeOut(tr, now, 0.3);
  });
  BG.cur = null;
  BG.running = false;
  BG.scene = null;
  BG.pending = null;
}

// 曲子可能用到的音高集合(0~11):各主音 × 位移(prog / 屬音 +7)× 調式的音;會隨季節換調的經營原版曲回傳 null = 全部 12 個
function bgPcs(st) {
  if (!st || st.seasonal) return null;
  const set = {};
  const shifts = [];
  (st.prog || [0]).forEach(function (p) { shifts.push(p, p + 7); });
  [st.mode, st.modeB, st.modeC].forEach(function (m) {
    if (!BG_MODES[m]) return;
    st.tonics.forEach(function (t) {
      shifts.forEach(function (s) {
        BG_MODES[m].forEach(function (iv) { set[(((t + s + iv) % 12) + 12) % 12] = true; });
      });
    });
  });
  return set;
}

function bgQueueScene(scene, st, group) {
  let insts = BG_SCENE_INST[scene] || [];
  if (st) {
    const set = {};
    const add = function (n) { set[BG_ALIAS[n] ? BG_ALIAS[n][0] : n] = true; };
    (st.mel || []).forEach(function (m) { add(m[0]); });
    if (st.dbl) add(st.dbl[0]);
    if (st.horn > 0 || st.fanfare || group === 'battle') add('horn');
    if (group === 'battle') add('taiko');
    [st.percA, st.percB, st.percC].forEach(function (p) {
      if (p) Object.keys(p).forEach(add);
    });
    if (st.woodEvery) add('wood');
    if (st.pad > 0) add('pad');
    if (st.stream > 0) add('stream');
    insts = Object.keys(set);
  }
  const pcs = bgPcs(st);
  insts.forEach(function (inst) {
    bgKeysOf(inst, pcs).forEach(function (k) {
      if (!BG.bufs[k] && !BG.queued[k]) {
        BG.queued[k] = true;
        BG.queue.unshift(k);
      }
    });
  });
}

function bgKeysOf(inst, pcs) {
  const out = [];
  if (inst === 'guz') {
    for (let m = 60; m < 72; m++) {
      if (pcs && !pcs[m % 12]) continue;
      out.push('guz:s:' + m);
      out.push('guz:h:' + m);
    }
  } else if (inst === 'flute' || inst === 'erhu' || inst === 'pipa') {
    for (let m = 60; m < 72; m++) {
      if (pcs && !pcs[m % 12]) continue;
      out.push(inst + ':' + m);
    }
  } else if (inst === 'horn') {
    out.push('horn:62');
  } else {
    out.push(inst);
  }
  return out;
}

// 預渲染佇列:每個 tick 最多用 ms 毫秒,避免一次渲染造成卡頓
function bgWarm(ms) {
  const t0 = auNow();
  let nBuf = 0;
  while (BG.queue.length && nBuf++ < BG_WARM_MAX && auNow() - t0 < ms / 1000) {
    const k = BG.queue.shift();
    BG.queued[k] = false;
    if (!BG.bufs[k]) bgBuf(k);
  }
}

// 切換場景:舊場景淡出、新場景淡入;同時最多 2 條音樂(淡出中的先硬停)
function bgSwitch(scene, fade, now) {
  if (!bgIsScene(scene) && scene !== 'win' && scene !== 'lose') return;
  BG.tracks.forEach(function (t) {
    if (t.out) bgFadeOut(t, now, BG_FADE_OUT_QUICK);
  });
  if (BG.cur && !BG.cur.out) bgFadeOut(BG.cur, now, fade);
  const tr = bgNewTrack(scene, now, fade);
  BG.tracks.push(tr);
  BG.cur = tr;
  BG.scene = scene;
  BG.sceneStart = now;
  BG.pending = null;
  if (scene === 'win' || scene === 'lose') {
    BG.resultSeen = bgCurBattle();
    BG.stingerEnd = now + tr.len * tr.stepSec;
  }
  bgQueueScene(scene, tr.style, tr.group);
}

// 目標場景 → 是否切換(去抖動 1.2 s、最短停留 8 s;進戰鬥與結算硬切 0.6 s)
function bgRequest(want, now) {
  if (want === BG.scene) {
    BG.pending = null;
    return;
  }
  if (!BG.scene) { bgSwitch(want, BG_FADE_HARD, now); return; }
  if (want === 'win' || want === 'lose' || want === 'battle') { bgSwitch(want, BG_FADE_HARD, now); return; }
  if ((BG.scene === 'win' || BG.scene === 'lose') && now < BG.stingerEnd) return;
  if (!BG.pending || BG.pending.scene !== want) {
    BG.pending = { scene: want, since: now };
    return;
  }
  if (now - BG.pending.since < BG_DEBOUNCE) return;
  if (now - BG.sceneStart < BG_MIN_DWELL) return;
  bgSwitch(want, BG_FADE, now);
}

function bgSceneFor(mode, phase, sandbox) {
  if (mode === 'estate' || mode === 'visit') return 'estate_day';
  if (mode === 'battleDesign') return 'design';
  if (mode === 'attack') {
    if (phase === 'scout') return 'scout';
    if (phase === 'march') return 'battle';
    if (sandbox) return 'battle';
    return null;
  }
  if (mode === 'replay') return 'battle';
  if (mode === 'fishing') return 'fishing';
  return null;
}

function bgStarsOf(b) {
  if (b && b.result && typeof b.result.stars === 'number') return b.result.stars | 0;
  if (b && typeof mioStarsOf === 'function') return mioStarsOf(b) | 0;
  return 0;
}

function bgCurBattle() {
  return typeof battle !== 'undefined' ? battle : null;
}

function bgSandbox() {
  return typeof document !== 'undefined' && !!document.body && !!document.body.classList &&
    document.body.classList.contains('sandbox');
}

// 依遊戲狀態決定目標場景;戰鬥結束時先播結算短曲,之後回到 returnScene
function bgDesired() {
  if (BG.forced) return BG.forced;
  if (typeof game !== 'object' || !game) return null;
  const b = bgCurBattle();
  if (b && game.mode !== 'replay' && (b.over || game.phase === 'result')) {
    if (BG.resultSeen !== b) return bgStarsOf(b) >= 1 ? 'win' : 'lose';
    return BG.returnScene;
  }
  const s = bgSceneFor(game.mode, game.phase, bgSandbox());
  if (s === 'estate_day' || s === 'design' || s === 'fishing') BG.returnScene = s;
  return s;
}

function bgNow() {
  if (AU.ctx && typeof AU.ctx.currentTime === 'number') return AU.ctx.currentTime;
  return auNow();
}

function bgAudioReady() {
  return typeof AU === 'object' && !!AU && !!AU.ready && !!AU.ctx && !!AU.master && !!AU.buses && !!AU.buses.music;
}

function bgMusicOn() {
  if (!BG.enabled || typeof auCfg !== 'function') return false;
  const cfg = auCfg();
  return !!(cfg && cfg.music && cfg.music.on);
}

function bgSetPollMs(ms) {
  if (BG.pollTimer && BG.pollMs === ms) return;
  if (BG.pollTimer) clearInterval(BG.pollTimer);
  BG.pollTimer = setInterval(bgmPoll, ms);
  BG.pollMs = ms;
}

function bgmPoll() {
  if (!BG.want) return;
  if (!bgAudioReady()) {
    bgSetPollMs(BG_WAIT_MS);
    return;
  }
  bgSetPollMs(BG_POLL_MS);
  const now = bgNow();
  if (!bgMusicOn()) {
    if (BG.running) bgHalt(now);
    return;
  }
  BG.running = true;
  const want = bgDesired();
  if (want) bgRequest(want, now);
  // 經營白天 ↔ 夜間:曲目群組改變時換曲(尊重最短停留)
  if (want === 'estate_day' && BG.scene === 'estate_day' && BG.cur && !BG.cur.out && !BG.audi &&
      bgGroupOf('estate_day') !== BG.cur.group && now - BG.sceneStart >= BG_MIN_DWELL) {
    bgSwitch('estate_day', BG_FADE, now);
  }
  bgUpdateIntensity();
}

// 排程:每 100 ms 把 0.25 s 內的格子排進 AudioContext 時間軸
function bgmTick() {
  if (!BG.want || !bgAudioReady()) return;
  const now = bgNow();
  bgPrune(now);
  bgWarm(BG_WARM_MS);
  if (!BG.running) return;
  if (typeof document !== 'undefined' && document.hidden) return;
  BG.tracks.forEach(function (tr) {
    if (tr.out || tr.done) return;
    if (tr.nextT < now) tr.nextT = now + 0.02;
    let guard = 0;
    while (tr.nextT < now + BG_LOOK && !tr.done && guard < 64) {
      bgStep(tr, tr.nextT);
      tr.nextT += tr.stepSec;
      tr.step++;
      guard++;
    }
  });
}

function bgmStart() {
  BG.want = true;
  if (!BG.schedTimer && typeof setInterval === 'function') BG.schedTimer = setInterval(bgmTick, BG_TICK_MS);
  bgSetPollMs(BG_WAIT_MS);
  bgmPoll();
}

function bgmStop() {
  BG.want = false;
  if (BG.tracks.length && bgAudioReady()) bgHalt(bgNow());
  BG.running = false;
  BG.scene = null;
  BG.pending = null;
  if (BG.pollTimer) clearInterval(BG.pollTimer);
  if (BG.schedTimer) clearInterval(BG.schedTimer);
  BG.pollTimer = null;
  BG.schedTimer = null;
  BG.pollMs = 0;
}

// 手動指定場景(測試 / 試聽);傳 null 回到自動判定
function bgmSetScene(name) {
  if (!name) {
    BG.forced = null;
    BG.pending = null;
    return;
  }
  if (!bgIsScene(name) && name !== 'win' && name !== 'lose') return;
  BG.forced = name;
  if (bgAudioReady() && bgMusicOn() && name !== BG.scene) {
    BG.running = true;
    bgSwitch(name, BG_FADE, bgNow());
  }
}

function bgmScene() {
  return BG.scene;
}

// 面板或其他模組要求暫停程序化 BGM(例:自訂音樂替換模式)
function bgmSetEnabled(on) {
  if (BG.audi) {
    BG.audiPrev = !!on;
    return;
  }
  BG.enabled = !!on;
  if (!BG.enabled && BG.running && bgAudioReady()) bgHalt(bgNow());
}

function bgmStats() {
  const now = bgNow();
  let lead = 0;
  BG.tracks.forEach(function (tr) {
    if (!tr.out && !tr.done) lead = Math.max(lead, tr.nextT - now);
  });
  return {
    scene: BG.scene,
    running: BG.running,
    forced: BG.forced,
    group: BG.cur ? BG.cur.group : null,
    track: BG.cur ? BG.cur.tid : null,
    intensity: BG.intensity,
    tracks: BG.tracks.length,
    voices: bgVoices(now),
    peakVoices: BG.stats.peak,
    lead: lead,
    played: Object.assign({}, BG.stats.played),
    dropped: Object.assign({}, BG.stats.dropped),
    warmLeft: BG.queue.length,
    buffers: Object.keys(BG.bufs).length
  };
}

// 切到背景:停掉 100 ms 排程與 500 ms 輪詢計時器(AudioContext 的 suspend 由 audio.js 負責);回前景再恢復
function bgmOnVisibility() {
  if (typeof document === 'undefined') return;
  if (document.hidden) {
    if (BG.pollTimer) clearInterval(BG.pollTimer);
    if (BG.schedTimer) clearInterval(BG.schedTimer);
    BG.pollTimer = null;
    BG.schedTimer = null;
    BG.pollMs = 0;
  } else if (BG.want) {
    if (!BG.schedTimer && typeof setInterval === 'function') BG.schedTimer = setInterval(bgmTick, BG_TICK_MS);
    bgSetPollMs(BG_WAIT_MS);
    bgmPoll();
  }
}
if (typeof document !== 'undefined' && document.addEventListener) document.addEventListener('visibilitychange', bgmOnVisibility, false);

// 載入即啟動等待:音訊解鎖(第一次觸控)後,輪詢會自動開始播放
bgmStart();

// fishdata.js — 釣魚資料(PLAN_FISHING F0:單一釣場、三深度層各一種魚、均衡釣具)
// 欄位與數值出自 PLAN_FISHING §2、§3;F0 只啟用 鰷 / 鯉 / 鯰、竹竿、均衡組合(中繩 / 中鉤 / 重墜)。
// 季節、早晚、水域與地區欄位保留在資料中,F0 的生成器暫不讀取(見回報)。

const FISH = [
  { id:'minnow', name:'鰷', rar:'common', min:8, max:18, reg:['home','north','central','jing','yang','jiao'], w:['r','l'],
    sea:['spring','summer','autumn'], tod:['day'], bait:['worm','dough'],
    depth:1, crawl:false, spd:5, diff:1, mod:'', shy:true, legend:null,
    tpl:'fish', look:{ body:[1, 0.22], head:0.3, tail:'fork', dorsal:'short', barbel:0,
      c:['#9fd8e8','#f4fbff','#bfe6f0'], pat:'hband', patC:'#4a8fb0', glow:false, wing:false },
    desc:'《莊子·秋水》濠梁之辯:「儵魚出遊從容。」儵即鰷。成群游動,速度很快。',
    aq:{ school:true } },
  { id:'carp', name:'鯉', rar:'common', min:20, max:80, reg:['home','north','central','jing','yang'], w:['r','l'],
    sea:['spring','summer','autumn','winter'], tod:['day','dusk','night'], bait:['worm','dough'],
    depth:2, crawl:false, spd:2, diff:2, mod:'', shy:false, legend:null,
    tpl:'fish', look:{ body:[1, 0.42], head:0.3, tail:'fork', dorsal:'long', barbel:2,
      c:['#d9a441','#f7e7b0','#c97a2a'], pat:'scale', patC:'#8a5a1d', glow:false, wing:false },
    desc:'《詩經·陳風·衡門》:「豈其食魚,必河之鯉。」自古就是上等魚。據《孔子家語》,孔子之子因魯君所賜之鯉而取名為「鯉」。',
    aq:{ school:false } },
  { id:'catfish', name:'鯰', rar:'common', min:25, max:90, reg:['home','north','central','jing','yang'], w:['r','l'],
    sea:['summer','autumn'], tod:['dusk','night'], bait:['worm','minnow'],
    depth:3, crawl:false, spd:1, diff:2, mod:'pull+', shy:false, legend:null,
    tpl:'fish', look:{ body:[1, 0.28], head:0.3, tail:'round', dorsal:'short', barbel:2,
      c:['#5b5a4e','#cfc7a6','#3e3d35'], pat:'mottle', patC:'#2e2d26', glow:false, wing:false },
    desc:'《詩經·小雅·魚麗》:「魚麗于罶,鰋鯉。」鰋即鯰(推定通說)。有鬚,夜裡出來覓食。',
    aq:{ school:false } }
];

const FISH_RARITY = {
  common:    { name:'常見', w:60, c:'#9ea3ab' },
  uncommon:  { name:'少見', w:25, c:'#5ab4d8' },
  rare:      { name:'稀有', w:10, c:'#b07ce8' },
  legendary: { name:'傳說', w:2,  c:'#e6b84a' }
};

const FISH_SPD = [0, 0.06, 0.10, 0.15, 0.21, 0.28];

const FISH_DIFF = {
  1: { fight:false, tap:0, decay:0, thrash:0 },
  2: { fight:true, tap:8, decay:10, thrash:0 },
  3: { fight:true, tap:6, decay:14, thrash:[2, 3.5] }
};

// 1~3 = 深度層的上下界(邏輯 y);floor = 水底;surf = 水面線。
// W、H 為邏輯畫面;ui 為操作鈕與角度盤的版面(fishui.js 與 fishdraw.js 共用)。
const FISH_LAYER = {
  1: [42, 260], 2: [260, 480], 3: [480, 690], floor: 690, surf: 42, W: 390, H: 844,
  ui: { dialX: 200, dialY: 736, dialR: 62, mainX: 334, mainY: 774, mainR: 38, angX: 16, angY: 752 }
};

const FISH_RODS = {
  bamboo: { name:'竹竿', ang:45, cap:3, reel:1.0, note:'無特殊能力,預設' }
};

const FISH_LINES = {
  fast: { name:'快繩', vh:420, ang:30 },
  mid:  { name:'中繩', vh:300, ang:45 },
  slow: { name:'慢繩', vh:220, ang:60 }
};

const FISH_HOOKS = {
  small: { name:'小鉤', hr:5,  mult:1.1 },
  mid:   { name:'中鉤', hr:10, mult:1.0 },
  big:   { name:'大鉤', hr:18, mult:0.8 }
};

const FISH_SINKS = {
  shallow: { name:'輕墜', y:260 },
  mid:     { name:'中墜', y:480 },
  deep:    { name:'重墜', y:690 }
};

const FISH_PRESETS = {
  balanced: { name:'均衡', rod:'bamboo', line:'mid', hook:'mid', sink:'deep' }
};

const FISH_BAITS = {
  worm: { name:'蚯蚓' }
};

const FISH_REGIONS = {
  home: { name:'自家水域', on:true }
};

const FISH_KEY = 'lorddomain.fish.v1';

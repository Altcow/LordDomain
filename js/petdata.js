// petdata.js — 仙獸苑純資料(PLAN_PET §0~§9)。只宣告,不碰 DOM,不用 Math.random。
// 陣列索引即圖鑑序號(PETS 只能尾端新增)。機率 / 數值以 PLAN_PET 為準。

// 五行:name 名稱、color 主色、gen 生我者(相生:誰生它)
const PET_EL = {
  wood:  { name: '木', color: '#4caf50', gen: 'water' },
  fire:  { name: '火', color: '#f2603c', gen: 'wood' },
  earth: { name: '土', color: '#e3b23c', gen: 'fire' },
  metal: { name: '金', color: '#c9ced6', gen: 'earth' },
  water: { name: '水', color: '#3e7fd6', gen: 'metal' }
};
const PET_EL_LIST = ['wood', 'fire', 'earth', 'metal', 'water'];

// 品質:from 為最低掉落層
const PET_Q = {
  b: { name: '藍', frame: '#3f86e8', bg: '#d9e9ff', from: 1 },
  c: { name: '青', frame: '#1fb5a3', bg: '#d2f5ef', from: 3 },
  p: { name: '紫', frame: '#9b59e6', bg: '#eadcff', from: 7 }
};

// 稀有度:base 基礎捕獲率、inc 每次失敗加的誠意、cap 上限(§5.1)
const PET_RARITY = {
  ling: { name: '靈', color: '#5ab4d8', base: 0.70, inc: 0.10, cap: 0.95 },
  rui:  { name: '瑞', color: '#b07ce8', base: 0.45, inc: 0.12, cap: 0.95 },
  shen: { name: '神', color: '#e6b84a', base: 0.25, inc: 0.15, cap: 0.95 },
  yin:  { name: '隱', color: 'rainbow', base: 0.20, inc: 0.15, cap: 0.95 }
};

// 材料 15 種(§2.2);id = <五行>_<品質>
const PET_MATS = [
  { id: 'wood_b', name: '嫩竹筍', el: 'wood', q: 'b', icon: '綠色尖錐+三片筍殼', desc: '春天竹林裡隨處可以挖到。' },
  { id: 'wood_c', name: '靈芝', el: 'wood', q: 'c', icon: '褐紅傘蓋,有雲紋同心圈', desc: '《神農本草經》列入上品,有青、赤、黃、白、黑、紫「六芝」。' },
  { id: 'wood_p', name: '建木果', el: 'wood', q: 'p', icon: '發光的綠色葫蘆形果實,上有葉', desc: '《山海經·海內南經》記載的天梯神木「建木」所結的果(果實為自編)。' },
  { id: 'fire_b', name: '赤菽', el: 'fire', q: 'b', icon: '三顆紅豆', desc: '菽是豆類的總稱;紅豆色赤,屬火。' },
  { id: 'fire_c', name: '丹砂', el: 'fire', q: 'c', icon: '朱紅色多稜結晶', desc: '《神農本草經》上品,方士煉丹的主料。' },
  { id: 'fire_p', name: '扶桑火實', el: 'fire', q: 'p', icon: '金紅色帶火苗的圓果', desc: '《山海經·海外東經》:「湯谷上有扶桑,十日所浴。」太陽升起的神木,果實為自編。' },
  { id: 'earth_b', name: '黃粱', el: 'earth', q: 'b', icon: '一束金黃的小米穗', desc: '黃色穀物,五行屬土。' },
  { id: 'earth_c', name: '黃精', el: 'earth', q: 'c', icon: '黃褐色節狀根莖', desc: '後世本草列為補中益氣的藥材(漢代記載推定)。' },
  { id: 'earth_p', name: '息壤', el: 'earth', q: 'p', icon: '一小團會自己長高的金色土塊,周圍有光點', desc: '《山海經·海內經》:「鯀竊帝之息壤以堙洪水。」會自己生長的神土。' },
  { id: 'metal_b', name: '白芥子', el: 'metal', q: 'b', icon: '一小撮白色圓籽', desc: '色白味辛,五行屬金(古籍名稱推定)。' },
  { id: 'metal_c', name: '白石英', el: 'metal', q: 'c', icon: '白色六稜柱水晶', desc: '《神農本草經》上品。' },
  { id: 'metal_p', name: '崑崙玉膏', el: 'metal', q: 'p', icon: '白玉小碗,碗中有乳白色發光膏', desc: '《山海經·西山經》峚山:「其中多白玉,是有玉膏……黃帝是食是饗。」' },
  { id: 'water_b', name: '芰實(菱角)', el: 'water', q: 'b', icon: '深紫褐色元寶形菱角', desc: '芰就是菱,水生植物,屬水。' },
  { id: 'water_c', name: '寒泉藻', el: 'water', q: 'c', icon: '一叢藍綠色細長水藻,有水珠', desc: '自編:生長在寒泉裡的水藻。' },
  { id: 'water_p', name: '北冥玄珠', el: 'water', q: 'p', icon: '深藍色發光圓珠,有漩渦紋', desc: '「北冥」出自《莊子·逍遙遊》,「玄珠」出自《莊子·天地》(黃帝遺失玄珠);兩者合稱為自編。' }
];

// 仙獸 16 隻(§2.3、§9.2)。look:tpl 模板、c [主色, 腹色, 點綴]、horn 角、ear 耳、tail 尾、legs 腳數、pat 花紋、glow 光暈、extra 其他造型標記
// 稀有度 rare 對應 PET_RARITY;bait 對應 PET_BAITS;hidden 為隱藏仙獸
const PETS = [
  { id: 'xingxing', name: '狌狌', el: 'wood', rare: 'ling', bait: 'bait_xingxing',
    look: { tpl: 'ape', c: ['#b98a5a', '#f4e2c4', '#ffffff'], horn: null, ear: 'big-white', tail: 'long', legs: null, pat: null, glow: false, extra: ['hold-bamboo'] },
    desc: '《山海經·南山經》招搖之山:「有獸焉,其狀如禺而白耳……其名曰狌狌,食之善走。」(本作只摸不吃)' },
  { id: 'lushu', name: '鹿蜀', el: 'wood', rare: 'rui', bait: 'bait_lushu',
    look: { tpl: 'quad', c: ['#e8b04a', '#fff3dc', '#d23a2c'], horn: null, ear: null, tail: 'red', legs: 4, pat: 'tiger-stripes', glow: false, extra: ['white-head', 'sing-notes'] },
    desc: '《山海經·南山經》杻陽之山:「其狀如馬而白首,其文如虎而赤尾,其音如謠。」' },
  { id: 'jiuwei', name: '九尾狐', el: 'wood', rare: 'shen', bait: 'bait_jiuwei',
    look: { tpl: 'quad', c: ['#fff1e0', '#ffffff', '#4caf50'], horn: null, ear: null, tail: 'fan9', legs: 4, pat: null, glow: true, extra: ['tail-tip-green', 'forehead-flower'] },
    desc: '《山海經·南山經》青丘之山:「有獸焉,其狀如狐而九尾。」漢代畫像石中常和西王母一起出現,是瑞獸。' },
  { id: 'huoshu', name: '火鼠', el: 'fire', rare: 'ling', bait: 'bait_huoshu',
    look: { tpl: 'quad', c: ['#f25c3c', '#ffd9b8', '#ffcf3a'], horn: null, ear: 'round-big', tail: 'fireball', legs: 4, pat: 'flame-back', glow: false, extra: [] },
    desc: '《神異經》(舊題東方朔,成書推定漢魏)記載南荒火山中的火鼠,毛可以織成火浣布。' },
  { id: 'bifang', name: '畢方', el: 'fire', rare: 'rui', bait: 'bait_bifang',
    look: { tpl: 'bird', c: ['#4a8fc0', '#ffffff', '#d23a2c'], horn: null, ear: null, tail: 'plume', legs: 1, pat: 'red-lines', glow: false, extra: ['fire-at-feet', 'hop'] },
    desc: '《山海經·西山經》章莪之山:「有鳥焉,其狀如鶴,一足,赤文青質而白喙,名曰畢方。」' },
  { id: 'huoqilin', name: '火麒麟', el: 'fire', rare: 'shen', bait: 'bait_huoqilin',
    look: { tpl: 'quad', c: ['#f25c3c', '#ffe3a0', '#ffcf3a'], horn: 'gold-single', ear: null, tail: 'flame', legs: 4, pat: 'gold-scales', glow: true, extra: ['flame-mane', 'gold-hooves'] },
    desc: '麒麟是漢代最重要的瑞獸(《史記》載漢武帝「獲白麟」);「火麒麟」是後世民間說法。' },
  { id: 'dangkang', name: '當康', el: 'earth', rare: 'ling', bait: 'bait_dangkang',
    look: { tpl: 'quad', c: ['#f2b8a8', '#ffe6dc', '#ffffff'], horn: 'tusk-white', ear: null, tail: 'curl', legs: 4, pat: null, glow: false, extra: ['back-millet', 'speech-bubble'] },
    desc: '《山海經·東山經》欽山:「其狀如豚而有牙,其名曰當康,其鳴自叫,見則天下大穰。」看到牠就是豐收年。' },
  { id: 'pixiu', name: '貔貅', el: 'earth', rare: 'rui', bait: 'bait_pixiu',
    look: { tpl: 'quad', c: ['#e3b23c', '#fff0c8', '#8a5a1d'], horn: 'short', ear: null, tail: 'curl', legs: 4, pat: 'mane', glow: false, extra: ['small-wings', 'coin-5zhu'] },
    desc: '《史記·五帝本紀》:「教熊羆貔貅貙虎。」「只進不出、招財」是後世的說法。' },
  { id: 'huanglong', name: '黃龍', el: 'earth', rare: 'shen', bait: 'bait_huanglong',
    look: { tpl: 'dragon', c: ['#f2c23c', '#fff3c0', '#c97a2a'], horn: 'deer-antler', ear: null, tail: null, legs: null, pat: 'belly-stripes', glow: true, extra: ['beard', 'earth-pearl'] },
    desc: '《淮南子·天文訓》:「中央土也……其獸黃龍。」五方神獸中坐鎮中央。' },
  { id: 'jiao', name: '狡', el: 'metal', rare: 'ling', bait: 'bait_jiao',
    look: { tpl: 'quad', c: ['#d8d2c4', '#fbf6e8', '#6f5a3a'], horn: 'cow-curved', ear: null, tail: 'wag', legs: 4, pat: 'leopard', glow: false, extra: [] },
    desc: '《山海經·西山經》玉山:「其狀如犬而豹文,其角如牛,其名曰狡……見則其國大穰。」' },
  { id: 'tiangou', name: '天狗', el: 'metal', rare: 'rui', bait: 'bait_tiangou',
    look: { tpl: 'quad', c: ['#c98a4a', '#fbf6e8', '#ffffff'], horn: null, ear: null, tail: 'ringed', legs: 4, pat: 'white-head', glow: false, extra: ['guardian'] },
    desc: '《山海經·西山經》陰山:「其狀如狸而白首,名曰天狗……可以禦凶。」(山海經裡的天狗是守護獸,不是吃月亮的那隻)' },
  { id: 'baize', name: '白澤', el: 'metal', rare: 'shen', bait: 'bait_baize',
    look: { tpl: 'quad', c: ['#f4f6fa', '#ffffff', '#7fb0d8'], horn: 'small', ear: null, tail: null, legs: 4, pat: 'cloud-blue', glow: true, extra: ['goatee', 'bamboo-scroll'] },
    desc: '傳說黃帝巡狩時遇到白澤,白澤能說出天下所有鬼神精怪(見後世《軒轅本紀》等,成書年代推定)。' },
  { id: 'xuangui', name: '旋龜', el: 'water', rare: 'ling', bait: 'bait_xuangui',
    look: { tpl: 'turtle', c: ['#6a8f4a', '#e8d9a8', '#d23a2c'], horn: null, ear: null, tail: 'snake', legs: 4, pat: 'hex-shell', glow: false, extra: ['bird-head', 'orange-beak', 'voice-ka'] },
    desc: '《山海經·南山經》杻陽之山怪水:「其狀如龜而鳥首虺尾,其名曰旋龜,其音如判木。」' },
  { id: 'kui', name: '夔', el: 'water', rare: 'rui', bait: 'bait_kui',
    look: { tpl: 'quad', c: ['#5f86a8', '#c8d8e8', '#ffd23a'], horn: null, ear: null, tail: null, legs: 1, pat: null, glow: false, extra: ['thunder-cloud', 'lightning-symbol'] },
    desc: '《山海經·大荒東經》流波山:「其狀如牛,蒼身而無角,一足,出入水則必風雨。」' },
  { id: 'xuanwu', name: '玄武', el: 'water', rare: 'shen', bait: 'bait_xuanwu',
    look: { tpl: 'turtle', c: ['#2f4f6f', '#a8c8d8', '#4caf50'], horn: null, ear: null, tail: 'short', legs: 4, pat: 'hex-shell', glow: true, extra: ['green-snake-on-shell'] },
    desc: '四神之一,鎮守北方;漢代「四神瓦當」上的龜蛇合體。' },
  { id: 'fenghuang', name: '鳳凰', el: 'all', rare: 'yin', bait: 'bait_fenghuang', hidden: true,
    look: { tpl: 'bird', c: ['#d23a2c', '#ffd23a', 'five'], horn: null, ear: null, tail: 'five-color', legs: 2, pat: 'crest3', glow: 'rainbow', extra: ['five-element-tail'] },
    desc: '《莊子·秋水》:鵷鶵「非梧桐不止,非練實不食,非醴泉不飲」。五彩神鳥。' }
];

// 捕獸餌 16 個(§2.4 展開表);mats 為材料 id → 數量,tier 為等級(靈 / 瑞 / 神 / 隱)
const PET_BAITS = [
  { id: 'bait_xingxing', name: '青筍菱團', el: 'wood', tier: 'ling', mats: { wood_p: 1, wood_c: 1, water_c: 1, wood_b: 2, water_b: 2 }, src: '竹筍 + 菱角揉成的團子(水生木)' },
  { id: 'bait_lushu', name: '芝藻青芻', el: 'wood', tier: 'rui', mats: { wood_p: 2, wood_c: 2, water_c: 1, wood_b: 3, water_b: 2 }, src: '「芻」是草料,鹿蜀長得像馬' },
  { id: 'bait_jiuwei', name: '建木青丘糕', el: 'wood', tier: 'shen', mats: { wood_p: 2, water_p: 1, wood_c: 2, water_c: 2, wood_b: 3, water_b: 3 }, src: '九尾狐住在青丘' },
  { id: 'bait_huoshu', name: '赤菽筍丸', el: 'fire', tier: 'ling', mats: { fire_p: 1, fire_c: 1, wood_c: 1, fire_b: 2, wood_b: 2 }, src: '紅豆 + 竹筍(木生火)' },
  { id: 'bait_bifang', name: '丹芝焰餅', el: 'fire', tier: 'rui', mats: { fire_p: 2, fire_c: 2, wood_c: 1, fire_b: 3, wood_b: 2 }, src: '丹砂 + 靈芝烤成的餅' },
  { id: 'bait_huoqilin', name: '扶桑烈焰糧', el: 'fire', tier: 'shen', mats: { fire_p: 2, wood_p: 1, fire_c: 2, wood_c: 2, fire_b: 3, wood_b: 3 }, src: '火系飼料:扶桑火實為主,建木助燃' },
  { id: 'bait_dangkang', name: '黃粱赤菽粥', el: 'earth', tier: 'ling', mats: { earth_p: 1, earth_c: 1, fire_c: 1, earth_b: 2, fire_b: 2 }, src: '當康是豬,吃粥最合理(火生土)' },
  { id: 'bait_pixiu', name: '黃精丹砂餅', el: 'earth', tier: 'rui', mats: { earth_p: 2, earth_c: 2, fire_c: 1, earth_b: 3, fire_b: 2 }, src: '' },
  { id: 'bait_huanglong', name: '息壤扶桑丹', el: 'earth', tier: 'shen', mats: { earth_p: 2, fire_p: 1, earth_c: 2, fire_c: 2, earth_b: 3, fire_b: 3 }, src: '煉成丹丸' },
  { id: 'bait_jiao', name: '白芥黃粱丸', el: 'metal', tier: 'ling', mats: { metal_p: 1, metal_c: 1, earth_c: 1, metal_b: 2, earth_b: 2 }, src: '(土生金)' },
  { id: 'bait_tiangou', name: '石英精脯', el: 'metal', tier: 'rui', mats: { metal_p: 2, metal_c: 2, earth_c: 1, metal_b: 3, earth_b: 2 }, src: '天狗像狸,給牠肉脯形狀的餌' },
  { id: 'bait_baize', name: '崑崙玉膏糕', el: 'metal', tier: 'shen', mats: { metal_p: 2, earth_p: 1, metal_c: 2, earth_c: 2, metal_b: 3, earth_b: 3 }, src: '黃帝吃的玉膏,配白澤遇黃帝的典故' },
  { id: 'bait_xuangui', name: '芰實芥子團', el: 'water', tier: 'ling', mats: { water_p: 1, water_c: 1, metal_c: 1, water_b: 2, metal_b: 2 }, src: '(金生水)' },
  { id: 'bait_kui', name: '寒藻石英羹', el: 'water', tier: 'rui', mats: { water_p: 2, water_c: 2, metal_c: 1, water_b: 3, metal_b: 2 }, src: '' },
  { id: 'bait_xuanwu', name: '北冥玄珠羹', el: 'water', tier: 'shen', mats: { water_p: 2, metal_p: 1, water_c: 2, metal_c: 2, water_b: 3, metal_b: 3 }, src: '玄武鎮北方,用北冥之珠' },
  { id: 'bait_fenghuang', name: '練實醴泉露', el: 'all', tier: 'yin', mats: { wood_p: 1, fire_p: 1, earth_p: 1, metal_p: 1, water_p: 1, wood_c: 1, fire_c: 1, earth_c: 1, metal_c: 1, water_c: 1, wood_b: 2, fire_b: 2, earth_b: 2, metal_b: 2, water_b: 2 }, src: '鳳凰只吃練實、只喝醴泉' }
];

// 雲階掉落表 0~20 層(§3)。b/c 為均勻整數區間 [lo, hi];p 紫出現機率(0~1);pn 紫數量區間 [lo, hi](不掉落為 [0, 0])
const PET_FLOORS = [
  { zone: '山腳',   b: [1, 1], c: [0, 0], p: 0,    pn: [0, 0] },
  { zone: '青石階', b: [1, 2], c: [0, 0], p: 0,    pn: [0, 0] },
  { zone: '青石階', b: [1, 3], c: [0, 0], p: 0,    pn: [0, 0] },
  { zone: '青石階', b: [2, 3], c: [0, 1], p: 0,    pn: [0, 0] },
  { zone: '青石階', b: [2, 4], c: [0, 1], p: 0,    pn: [0, 0] },
  { zone: '白玉階', b: [2, 4], c: [1, 1], p: 0,    pn: [0, 0] },
  { zone: '白玉階', b: [3, 4], c: [1, 2], p: 0,    pn: [0, 0] },
  { zone: '白玉階', b: [3, 5], c: [1, 2], p: 0.05, pn: [1, 1] },
  { zone: '白玉階', b: [3, 5], c: [1, 2], p: 0.10, pn: [1, 1] },
  { zone: '白玉階', b: [3, 5], c: [1, 3], p: 0.15, pn: [1, 1] },
  { zone: '雲階',   b: [4, 6], c: [2, 3], p: 0.25, pn: [1, 1] },
  { zone: '雲階',   b: [4, 6], c: [2, 3], p: 0.30, pn: [1, 1] },
  { zone: '雲階',   b: [4, 6], c: [2, 4], p: 0.40, pn: [1, 1] },
  { zone: '雲階',   b: [5, 7], c: [2, 4], p: 0.50, pn: [1, 1] },
  { zone: '雲階',   b: [5, 7], c: [3, 4], p: 0.60, pn: [1, 1] },
  { zone: '金階',   b: [5, 8], c: [3, 5], p: 0.75, pn: [1, 1] },
  { zone: '金階',   b: [6, 8], c: [3, 5], p: 0.85, pn: [1, 2] },
  { zone: '金階',   b: [6, 9], c: [4, 5], p: 1.00, pn: [1, 2] },
  { zone: '金階',   b: [6, 9], c: [4, 6], p: 1.00, pn: [1, 2] },
  { zone: '金階',   b: [7, 10], c: [4, 6], p: 1.00, pn: [2, 2] },
  { zone: '天門',   b: [8, 10], c: [5, 6], p: 1.00, pn: [2, 3] }
];

// 天門寶匣(第 20 層登頂時額外發放,數量依祈願五行 el = 'focus')
const PET_TOP_CHEST = { el: 'focus', p: 3, c: 4, b: 6 };

// 機率段(§4.2):layers 以抽籤前所在層判定;w 為 PET_ROLL 七種結果的權重(順序相同),每段合計 100
const PET_BANDS = [
  { name: 'A', from: 0,  to: 4,  color: '#9fb7a8', w: [10, 25, 40, 15, 7, 3, 0] },
  { name: 'B', from: 5,  to: 9,  color: '#eef2f0', w: [8, 24, 38, 12, 11, 5, 2] },
  { name: 'C', from: 10, to: 14, color: '#d9cff5', w: [6, 20, 34, 12, 15, 9, 4] },
  { name: 'D', from: 15, to: 19, color: '#f2cf6b', w: [5, 16, 31, 12, 17, 12, 7] }
];

// 攀登結果七種(§4.1):d 為層數變化;reset 為墜回 0 層(d 用 -99 當哨兵值,實際落點 0);charmName/charmD 為平安符護身時的改寫
const PET_ROLL = [
  { k: 'p3', d: 3,   name: '上上籤・青雲直上', color: '#ffcf3a' },
  { k: 'p2', d: 2,   name: '上籤・步步高昇', color: '#ff9a3a' },
  { k: 'p1', d: 1,   name: '中籤・穩步向前', color: '#4caf50' },
  { k: 'z',  d: 0,   name: '平籤・原地踏步', color: '#9ea3ab' },
  { k: 'm1', d: -1,  name: '下籤・一步踏空', color: '#6f7e8c' },
  { k: 'm2', d: -2,  name: '下籤・腳底打滑', color: '#6a5a8c' },
  { k: 'r',  d: -99, name: '下下籤・墜入雲淵', color: '#c4121a', reset: true, charmName: '平安符護身・腳底打滑', charmD: -2 }
];

const PET_CLIMB_COST = 100;   // 每次攀登花費靈貝
const PET_COIN_RATE = 20;     // 金幣 : 靈貝 = 20 : 1
const PET_COIN_LOT = 100;     // 金幣兌換一次得到的靈貝(即 2000 金幣)
const PET_CONVERT = 3;        // 轉化:N 個同品質 → 1 個同品質指定五行
const PET_ADD_MAX = 2;        // 加料最多個數
const PET_ADD_BONUS = 0.10;   // 每個加料紫材料的捕獲率加成

// 稱號(登頂次數累計達門檻即獲得)
const PET_TITLES = [
  { tops: 1,  name: '青雲客' },
  { tops: 5,  name: '步雲使' },
  { tops: 20, name: '天門仙官' }
];

// 仙獸苑音效定義(§6.6),格式同 audiodata.js 的 AUDIO_DEFS / AUDIO_SYNTH
const PET_AUDIO_DEFS = {
  pet_shake:     { pri: 2, gap: 0.15, jit: 0, maxN: 1, cat: 'ev', gain: 0.5, recipe: 'pet_shake' },
  pet_step_up:   { pri: 2, gap: 0.08, jit: 0, maxN: 2, cat: 'ev', gain: 0.45, recipe: 'pet_step_up' },
  pet_step_down: { pri: 2, gap: 0.08, jit: 0, maxN: 2, cat: 'ev', gain: 0.4, recipe: 'pet_step_down' },
  pet_fall:      { pri: 1, gap: 0.5, jit: 0, maxN: 1, cat: 'ev', gain: 0.55, recipe: 'pet_fall' },
  pet_charm:     { pri: 1, gap: 0.5, jit: 0, maxN: 1, cat: 'ev', gain: 0.5, recipe: 'pet_charm' },
  pet_craft:     { pri: 2, gap: 0.2, jit: 0, maxN: 1, cat: 'ev', gain: 0.5, recipe: 'pet_craft' },
  pet_summon:    { pri: 1, gap: 0.5, jit: 0, maxN: 1, cat: 'ev', gain: 0.5, recipe: 'pet_summon' },
  pet_throw:     { pri: 1, gap: 0.3, jit: 0, maxN: 1, cat: 'ev', gain: 0.5, recipe: 'pet_throw' },
  pet_absorb:    { pri: 1, gap: 0.3, jit: 0, maxN: 1, cat: 'ev', gain: 0.5, recipe: 'pet_absorb' },
  pet_lock:      { pri: 1, gap: 0.2, jit: 0, maxN: 1, cat: 'ev', gain: 0.6, recipe: 'pet_lock' },
  pet_success:   { pri: 0, gap: 1.0, jit: 0, maxN: 1, cat: 'ev', gain: 0.6, recipe: 'pet_success' },
  pet_crack:     { pri: 1, gap: 0.3, jit: 0, maxN: 1, cat: 'ev', gain: 0.5, recipe: 'pet_crack' },
  pet_open:      { pri: 1, gap: 0.3, jit: 0, maxN: 1, cat: 'ev', gain: 0.55, recipe: 'pet_open' },
  pet_fail:      { pri: 0, gap: 1.0, jit: 0, maxN: 1, cat: 'ev', gain: 0.6, recipe: 'pet_fail' },
  pet_pat:       { pri: 2, gap: 0.2, jit: 0, maxN: 1, cat: 'ev', gain: 0.45, recipe: 'pet_pat' }
};
const PET_AUDIO_SYNTH = {
  pet_shake: [ { w: 'noise', t: 0, d: 0.06, a: 0.4, tau: 0.02, lp: 2500 }, { w: 'noise', t: 0.09, d: 0.06, a: 0.35, tau: 0.02, lp: 2200 } ],
  pet_step_up: [ { w: 'sine', t: 0, d: 0.12, f0: 660, f1: 990, a: 0.35, tau: 0.05 } ],
  pet_step_down: [ { w: 'sine', t: 0, d: 0.12, f0: 520, f1: 330, a: 0.3, tau: 0.05 } ],
  pet_fall: [ { w: 'sine', t: 0, d: 0.7, f0: 880, f1: 110, a: 0.4, tau: 0.3 }, { w: 'noise', t: 0.55, d: 0.2, a: 0.4, tau: 0.06, lp: 600 } ],
  pet_charm: [ { w: 'noise', t: 0, d: 0.35, a: 0.25, tau: 0.15, lp: 4000 }, { w: 'sine', t: 0.1, d: 0.4, f0: 1046.5, a: 0.3, tau: 0.15 } ],
  pet_craft: [ { w: 'sine', t: 0, d: 0.08, f0: 300, f1: 500, a: 0.3, tau: 0.03 }, { w: 'sine', t: 0.1, d: 0.08, f0: 350, f1: 600, a: 0.3, tau: 0.03 }, { w: 'sine', t: 0.2, d: 0.08, f0: 420, f1: 700, a: 0.3, tau: 0.03 } ],
  pet_summon: [ { w: 'sine', t: 0, d: 0.4, f0: 392, a: 0.3, tau: 0.2 }, { w: 'sine', t: 0.15, d: 0.4, f0: 523.25, a: 0.3, tau: 0.2 }, { w: 'sine', t: 0.3, d: 0.5, f0: 659.25, a: 0.3, tau: 0.25 }, { w: 'tri', t: 0.45, d: 0.6, f0: 783.99, a: 0.25, tau: 0.3 } ],
  pet_throw: [ { w: 'noise', t: 0, d: 0.35, a: 0.35, tau: 0.15, lp: 1800 } ],
  pet_absorb: [ { w: 'sine', t: 0, d: 0.35, f0: 300, f1: 1400, a: 0.35, tau: 0.15 } ],
  pet_lock: [ { w: 'square', t: 0, d: 0.04, f0: 1800, a: 0.2, tau: 0.01 }, { w: 'noise', t: 0, d: 0.03, a: 0.3, tau: 0.008, lp: 5000 } ],
  pet_success: [ { w: 'sine', t: 0, d: 0.5, f0: 523.25, a: 0.35, tau: 0.22 }, { w: 'sine', t: 0.1, d: 0.5, f0: 659.25, a: 0.35, tau: 0.22 },
    { w: 'sine', t: 0.2, d: 0.5, f0: 783.99, a: 0.35, tau: 0.22 }, { w: 'sine', t: 0.32, d: 0.9, f0: 1046.5, a: 0.4, tau: 0.4 }, { w: 'sine', t: 0.32, d: 0.6, f0: 2093, a: 0.08, tau: 0.2 } ],
  pet_crack: [ { w: 'noise', t: 0, d: 0.05, a: 0.45, tau: 0.01, lp: 6000 }, { w: 'noise', t: 0.08, d: 0.05, a: 0.4, tau: 0.01, lp: 5000 }, { w: 'noise', t: 0.15, d: 0.06, a: 0.45, tau: 0.015, lp: 4000 } ],
  pet_open: [ { w: 'noise', t: 0, d: 0.15, a: 0.45, tau: 0.05, lp: 3000 }, { w: 'sine', t: 0.05, d: 0.5, f0: 1200, f1: 2400, a: 0.2, tau: 0.25 } ],
  pet_fail: [ { w: 'square', t: 0, d: 1.6, f0: 55, a: 0.22, tau: 0.9 }, { w: 'square', t: 0, d: 1.6, f0: 58.3, a: 0.18, tau: 0.9 },
    { w: 'sine', t: 0.1, d: 1.2, f0: 233, f1: 110, a: 0.3, tau: 0.6 }, { w: 'sine', t: 0.1, d: 1.2, f0: 247, f1: 116, a: 0.2, tau: 0.6 }, { w: 'noise', t: 0, d: 1.0, a: 0.12, tau: 0.6, lp: 300 } ],
  pet_pat: [ { w: 'sine', t: 0, d: 0.1, f0: 1200, f1: 1600, a: 0.3, tau: 0.04 }, { w: 'sine', t: 0.11, d: 0.12, f0: 1500, f1: 2000, a: 0.25, tau: 0.05 } ]
};

// 存檔 key(§7.1)
const PET_KEY = 'lorddomain.pet.v1';

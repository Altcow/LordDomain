// gatherdata.js — 城市聚集資料(PLAN_CITYLIFE_GATHER.md §4):聚集種類、物件 → 聚集點對照、時段 / 季節倍率、等級上限、台詞、小卡文字。
// 只放資料,不含執行邏輯;執行期在 js/citygather.js。已接:下棋(chess)、路邊休息(rest)、告示 / 看戲 / 叫賣(notice、show、market,P3 / P4)、P5 夜市 / 亭卒 / 叫好 / 名人加入參數。
// 全域名稱:GATHER_KINDS GATHER_OBJ GATHER_TOD GATHER_SEASON GATHER_CAP GATHER_LINES GATHER_CARD GATHER_SHOW_PROG GATHER_NOTICE GATHER_NIGHT GATHER_BAIL GATHER_CHEER GATHER_FAM GATHER_NIGHT_STALL gatherObjInfo。ES2017;不用 ?. ??;不發聲。

const GATHER_KINDS = {
  chess:  { name: '下棋', dur: [90, 240], cool: [30, 90], stay: [20, 60], move: [4, 8], finale: 8, game: 1 },
  rest:   { name: '路邊休息', stay: [20, 90], nap: [40, 120] },
  notice: { name: '告示', dur: [60, 150], cool: [20, 60], stay: [20, 60], finale: 6, game: 1 },
  show:   { name: '看戲', dur: [120, 180], cool: [30, 90], stay: [20, 60], finale: 8, game: 1 },
  market: { name: '叫賣', dur: [60, 120], cool: [30, 60], stay: [20, 50], finale: 4, game: 1 }
};

// 時段倍率(artTodKey 四段);棋局另乘 0.7 的開局機率(排程見 citygather.js)
// 告示:清晨張貼多(1.2),白天圍看(0.8),傍晚少(0.4),夜間無;看戲:清晨無,白天 0.6,傍晚 1(夜戲只在有燈時,見 citygather.js);叫賣:早市 1.3,夜間無(本城尚無夜市攤)
const GATHER_TOD = {
  chess:  { dawn: 0.5, noon: 1, dusk: 0.8, night: 0 },
  rest:   { dawn: 0.8, noon: 1, dusk: 1, night: 0.2 },
  notice: { dawn: 1.2, noon: 0.8, dusk: 0.4, night: 0 },
  show:   { dawn: 0, noon: 0.6, dusk: 1, night: 0.3 },
  market: { dawn: 1.3, noon: 1, dusk: 0.8, night: 0 }
};
// 季節倍率:下棋夏 ×1.2、冬 ×0.6;休息夏 ×1(樹蔭另 ×1.5)、冬 ×0.5(井邊、茶座不減);看戲冬 ×0.7;叫賣冬 ×0.8;告示不分季
const GATHER_SEASON = {
  chess:  { spring: 1, summer: 1.2, autumn: 1, winter: 0.6 },
  rest:   { spring: 1, summer: 1, autumn: 1, winter: 0.5 },
  notice: { spring: 1, summer: 1, autumn: 1, winter: 1 },
  show:   { spring: 1, summer: 1, autumn: 1, winter: 0.7 },
  market: { spring: 1, summer: 1, autumn: 1, winter: 0.8 }
};

// 等級上限(PLAN §4.3):groups 同時聚集組數、members 聚集成員總數、per 單組上限、pose 額外動作幀的外觀數上限、watch 圍觀人數上限
const GATHER_CAP = {
  high: { groups: 6, members: 48, per: 20, pose: 24, watch: 6 },
  mid:  { groups: 4, members: 32, per: 16, pose: 16, watch: 4 },
  low:  { groups: 3, members: 18, per: 10, pose: 10, watch: 2 },
  save: { groups: 2, members: 12, per: 8,  pose: 8,  watch: 1 },
  few:  { groups: 2, members: 6,  per: 4,  pose: 6,  watch: 2 }
};
const GATHER_SPOT_MAX = 12;       // 每種聚集點最多幾個(超過依雜湊等距抽樣)
const GATHER_MEMBER_RATIO = { high: 0.8, mid: 0.8, low: 0.55, save: 0.55, few: 0.55 }; // 聚集成員 ≤ 目前居民數 × 比例(高 / 一般 80%,小城也熱鬧;低階 / 省電 / 少 維持 55%)
const GATHER_MEMBER_BASE = { high: 8, mid: 8, low: 6, save: 6, few: 6 };  // 居民數保底(小城居民不足時以此計,仍受 GATHER_CAP.members 與 ≤ 居民數 約束)

// 物件 → 聚集點。k = 種類;seats = 座位數(人坐在物件上);gz = 坐下時身體抬高(px);bz = 棋盤面高度(px,畫棋子用)
//   shade = 樹蔭(站在四周乘涼)、well = 井邊站著聊、tea = 茶座(站著喝茶)、cargo = 港口貨堆(苦力歇腳)
//   notice:front = 正面朝最近道路,讀者站在半圓上、宣讀者站在正前方
//   show:pair = 兩名表演者(擊鼓、跳丸),big = 表演者站在台上 / 圈內;story = 說書人坐在台上長案後(單人)
//   market:crier = 叫賣者站在攤位正前方(vendor_platform 站在台上)
const GATHER_OBJ = {
  stone_table:  { k: 'chess', w: 1, bz: 20 },
  tbl_chess:    { k: 'chess', w: 1, bz: 15 },
  tbl_stone:    { k: 'chess', w: 0.5, bz: 14 },
  yi_zuo:       { k: 'chess', w: 1.2, bz: 15, seatObj: 1 },
  bench_wood:   { k: 'rest', seats: 2, gz: 7 },
  stone_stool:  { k: 'rest', seats: 1, gz: 8 },
  stools_pair:  { k: 'rest', seats: 2, gz: 6 },
  hu_chuang:    { k: 'rest', seats: 1, gz: 7 },
  chair_bamboo: { k: 'rest', seats: 1, gz: 8 },
  stool_wood:   { k: 'rest', seats: 1, gz: 7 },
  low_table_cushion: { k: 'rest', seats: 1, gz: 3 },
  huai_shade:   { k: 'rest', seats: 3, gz: 6, shade: 1, big: 1 },
  liang_peng:   { k: 'rest', seats: 4, gz: 7, tea: 1, big: 1 },
  well:         { k: 'rest', well: 1 }, well_old: { k: 'rest', well: 1 }, well_sweep: { k: 'rest', well: 1 },
  stall_tea:    { k: 'rest', tea: 1 }, tbl_tea: { k: 'rest', tea: 1 }, shop_tea: { k: 'rest', tea: 1 },
  notice_board: { k: 'notice', w: 1, front: 1 },
  bian_shu:     { k: 'notice', w: 1, front: 1 },
  xian_ya:      { k: 'notice', w: 0.6, front: 1 },
  perform_ring: { k: 'show', w: 1, front: 1, pair: 1, big: 1 },
  wu_tai:       { k: 'show', w: 1, front: 1, pair: 1, big: 1 },
  storyteller:  { k: 'show', w: 0.7, front: 1, story: 1 },
  vendor_platform: { k: 'market', w: 1.5, front: 1, crier: 1, big: 1 },
  san_gai:      { k: 'market', w: 0.8, front: 1, crier: 1 },
  market:       { k: 'market', w: 0.6, front: 1 }
};

// 樹(tree、tree_pine…)與港口貨堆(cargo_*)以前綴規則對到聚集點;夜市攤(lifeNightStall,citytraffic.js)只在夜間開場
function gatherObjInfo(type) {
  if (GATHER_OBJ[type]) return GATHER_OBJ[type];
  if (type === 'tree' || type.indexOf('tree_') === 0) return GATHER_TREE;
  if (type.indexOf('cargo_') === 0) return GATHER_CARGO;
  if (typeof lifeNightStall === 'function' && lifeNightStall(type)) return GATHER_NIGHT_STALL;
  return null;
}
const GATHER_TREE = { k: 'rest', shade: 1 };
const GATHER_CARGO = { k: 'rest', seats: 1, gz: 6, cargo: 1 };
const GATHER_NIGHT_STALL = { k: 'market', w: 0.6, front: 1, nolead: 1, nstall: 1 };   // 夜市:攤主是街景叫賣者(citytraffic),這裡只排圍觀者

// 夜間設定(PLAN_CITYLIFE_GATHER §4.4):燈籠光暈半徑與透明度、夜市聚集點上限、夜戲所需燈的距離(格)、夜市 / 夜戲的倍率
const GATHER_NIGHT = { lampR: 4, glowA: 0.2, stallMax: 6, lampMul: 0.3, showMul: 0.3 };
// 亭卒(衙役,ext 角色,不占居民額度):清晨張貼機率 / 白天機率、停留秒數、張貼階段(gt 秒內)才會來
const GATHER_BAIL = { job: 'guard', pDawn: 0.7, pDay: 0.3, stay: 25, phase: 8 };
// 看戲「叫好」:每場 1 次、每日上限(PLACEHOLDER);morale = 民心微幅加成(PLACEHOLDER,目前未接數據:零數據影響鐵則,預設 0)
const GATHER_CHEER = { dayMax: 3, sec: 3, morale: 0 };
// 在野名人 / 名冊人物行程中「站著停點」時,8 格內有進行中聚集者,有機率改當觀眾停留
const GATHER_FAM = { radius: 8, pVisitor: 0.5, pHero: 0.4, stay: [15, 30] };

// 台詞(只寫東漢可用的口語;下棋稱「弈」「圍棋」,不寫象棋;不寫唐宋以後的俗語)
const GATHER_LINES = {
  chess: {
    player: ['這一手……容我想想。', '觀棋不語,觀棋不語!', '該你落子了。', '好棋!這一著妙。', '再讓你一子如何?', '此局勝負未分。', '老夫這一角,可不能丟。'],
    watch: ['下這裡!', '哎呀,這步走岔了。', '別急,看他怎麼應。', '嘿,這一局有看頭。', '我賭黑子贏。', '觀棋不語真君子。', '這棋路,是跟誰學的?']
  },
  rest: {
    sit: ['腿痠了,歇會兒。', '今年雨水可好?', '坐下喝口水吧。', '聽說西邊的集市又開了。', '家裡的活兒還沒忙完呢。', '歇一歇,晚些再趕路。'],
    nap: ['呼……讓我瞇一會兒。', '嗯……別吵,再睡一刻。'],
    shade: ['這樹蔭底下涼快。', '老樹有些年頭了,夏天最愛在這兒歇。', '日頭毒,躲一躲。'],
    well: ['井水甜,打一桶?', '聽說東街那家添了孫子。', '輪到我打水了。'],
    tea: ['一碗粗茶,解解乏。', '這茶葉是新采的。', '來,添一碗。'],
    porter: ['這包可真沉,歇口氣。', '碼頭風大,坐這兒涼快。', '歇夠了還得搬呢。']
  },
  notice: {
    speak: ['上頭寫的是……勸課農桑。', '諸位聽好,今春開渠,人人有份。', '縣裡有令:禁夜行,違者笞。', '這一則說的是賑貸,糧出官倉。', '都聽明白了?有事到亭裡問。'],
    read: ['我不識字,先生給念念?', '嘿,這告示貼得真醒目。', '這一條跟咱們莊稼人有關哩。', '官府又出新令了?', '看完了,回去告訴街坊。']
  },
  show: {
    perf: ['好!再來一個!', '跳丸跳得真俐落。', '鼓點打得真快!', '這一段看得過癮!'],
    story: ['且聽下回分解。', '說到這兒,真叫人捏把汗。', '哈哈,這個段子有趣。'],
    audience: ['好!再來一個!', '跳丸跳得真俐落。', '鼓點打得真快!', '這一段看得過癮!', '看完這場,明日還來。'],
    cheer: ['多謝諸位捧場!', '諸位鼓掌,小人再獻一段!'],
    cheerWatch: ['好!叫得痛快!', '來,再來一個!']
  },
  market: {
    crier: ['新收的胡餅,又香又脆!', '鮮果鮮果,剛下的貨!', '布匹便宜賣啦,來來來,瞧一瞧!', '陶罐、陶碗,一文一個!'],
    watch: ['這胡餅幾個錢?', '再便宜些我就買了。', '這布成色不錯。', '先看看,價錢還沒談妥呢。'],
    trade: ['成交!', '好,就這麼說定了。'],
    night: ['燈籠一亮,攤子前就熱鬧了。', '夜裡的胡餅最香,來一個?', '收了攤再走,不耽誤。']
  }
};

// 聚集提示小卡:標題 / 說明({n} = 目前人數、{w} = 圍觀人數、{p} = 今日節目)
const GATHER_CARD = {
  chess:  { title: '大伙兒在看棋', desc: '兩位街坊正在對弈(圍棋),旁邊圍著 {w} 位看熱鬧的人。' },
  rest:   { title: '街坊在這兒歇腳', desc: '{n} 位街坊坐下來聊天、打盹。' },
  shade:  { title: '街坊在樹下乘涼', desc: '{n} 位街坊在樹蔭底下閒話家常。' },
  well:   { title: '井邊閒話', desc: '{n} 位街坊在井邊聊天。' },
  tea:    { title: '街坊在喝茶', desc: '{n} 位街坊在茶座旁歇腳。' },
  cargo:  { title: '苦力歇腳', desc: '{n} 位苦力坐在貨堆上喘口氣。' },
  notice: { title: '城中新貼了告示', desc: '{n} 位街坊圍著告示看,有人在唸給大家聽。' },
  show:   { title: '大伙兒在看百戲', desc: '{n} 位觀眾圍著看百戲,今日節目:{p}。' },
  story:  { title: '大伙兒在聽說書', desc: '{n} 位街坊圍著說書台,聽得入神。' },
  market: { title: '大伙兒在攤前挑貨', desc: '{n} 人在叫賣處圍看,有人討價還價。' }
};

// 百戲節目(依演出段落輪流;小卡顯示目前一段)
const GATHER_SHOW_PROG = ['跳丸', '擊鼓說唱', '吹簫', '俳優戲語'];
// 告示一行(沒有生效政令時依種子挑一則;有政令時改顯示「城主令:{政令名}」)
const GATHER_NOTICE = ['勸課農桑,春耕及時。', '賑貸貧民,糧出官倉。', '禁夜行,違者笞。', '修繕道路,里中出力。', '徵發徭役,限期到縣。', '捕盜安民,告發有賞。', '市令平價,不許抬價。', '疫病流行,煮湯飲用。', '開渠引水,抗旱保苗。', '鄉亭宣教,孝悌力田。'];

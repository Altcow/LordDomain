// gatherdata.js — 城市聚集資料(PLAN_CITYLIFE_GATHER.md §4):聚集種類、物件 → 聚集點對照、時段 / 季節倍率、等級上限、台詞、小卡文字。
// 只放資料,不含執行邏輯;執行期在 js/citygather.js。P2 範圍:下棋(chess)與路邊休息(rest);公告 / 叫賣 / 看戲(P3、P4)尚未接,物件 bian_shu / wu_tai / san_gai 為靜態擺設。
// 全域名稱:GATHER_KINDS GATHER_OBJ GATHER_TOD GATHER_SEASON GATHER_CAP GATHER_LINES GATHER_CARD gatherObjInfo。ES2017;不用 ?. ??;不發聲。

const GATHER_KINDS = {
  chess: { name: '下棋', gameDur: [90, 240], cool: [30, 90], stay: [20, 60], move: [4, 8], finale: 8 },
  rest:  { name: '路邊休息', stay: [20, 90], nap: [40, 120] }
};

// 時段倍率(artTodKey 四段);棋局另乘 0.7 的開局機率(排程見 citygather.js)
const GATHER_TOD = {
  chess: { dawn: 0.5, noon: 1, dusk: 0.8, night: 0 },
  rest:  { dawn: 0.8, noon: 1, dusk: 1, night: 0.2 }
};
// 季節倍率:下棋夏 ×1.2、冬 ×0.6;休息夏 ×1(樹蔭另 ×1.5)、冬 ×0.5(井邊、茶座不減)
const GATHER_SEASON = {
  chess: { spring: 1, summer: 1.2, autumn: 1, winter: 0.6 },
  rest:  { spring: 1, summer: 1, autumn: 1, winter: 0.5 }
};

// 等級上限(PLAN §4.3):groups 同時聚集組數、members 聚集成員總數、per 單組上限、pose 額外動作幀的外觀數上限、watch 下棋圍觀人數上限
const GATHER_CAP = {
  high: { groups: 6, members: 48, per: 20, pose: 24, watch: 6 },
  mid:  { groups: 4, members: 32, per: 16, pose: 16, watch: 4 },
  low:  { groups: 3, members: 18, per: 10, pose: 10, watch: 2 },
  save: { groups: 2, members: 12, per: 8,  pose: 8,  watch: 1 },
  few:  { groups: 2, members: 6,  per: 4,  pose: 6,  watch: 2 }
};
const GATHER_SPOT_MAX = 12;       // 每種聚集點最多幾個(超過依雜湊等距抽樣)
const GATHER_MEMBER_RATIO = 0.55; // 聚集成員 ≤ 目前居民數 × 55%(保留一半以上的人在路上走)

// 物件 → 聚集點。k = 種類;seats = 座位數(人坐在物件上);gz = 坐下時身體抬高(px);bz = 棋盤面高度(px,畫棋子用)
//   shade = 樹蔭(站在四周乘涼)、well = 井邊站著聊、tea = 茶座(站著喝茶)、cargo = 港口貨堆(苦力歇腳)
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
  stall_tea:    { k: 'rest', tea: 1 }, tbl_tea: { k: 'rest', tea: 1 }, shop_tea: { k: 'rest', tea: 1 }
};

// 樹(tree、tree_pine…)與港口貨堆(cargo_*)以前綴規則對到聚集點
function gatherObjInfo(type) {
  if (GATHER_OBJ[type]) return GATHER_OBJ[type];
  if (type === 'tree' || type.indexOf('tree_') === 0) return GATHER_TREE;
  if (type.indexOf('cargo_') === 0) return GATHER_CARGO;
  return null;
}
const GATHER_TREE = { k: 'rest', shade: 1 };
const GATHER_CARGO = { k: 'rest', seats: 1, gz: 6, cargo: 1 };

// 台詞(只寫東漢可用的口語;下棋稱「弈」「圍棋」,不寫象棋)
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
  }
};

// 聚集提示小卡:標題 / 說明({n} = 目前人數)
const GATHER_CARD = {
  chess: { title: '大伙兒在看棋', desc: '兩位街坊正在對弈(圍棋),旁邊圍著 {w} 位看熱鬧的人。' },
  rest:  { title: '街坊在這兒歇腳', desc: '{n} 位街坊坐下來聊天、打盹。' },
  shade: { title: '街坊在樹下乘涼', desc: '{n} 位街坊在樹蔭底下閒話家常。' },
  well:  { title: '井邊閒話', desc: '{n} 位街坊在井邊聊天。' },
  tea:   { title: '街坊在喝茶', desc: '{n} 位街坊在茶座旁歇腳。' },
  cargo: { title: '苦力歇腳', desc: '{n} 位苦力坐在貨堆上喘口氣。' }
};

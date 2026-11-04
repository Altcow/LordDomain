// js/tavern_data.js — 酒館室內場景資料(PLAN_INTERIORS §1;I0):掌櫃台詞庫、五種城市風格色票、房間 / 家具 / 座位 / 燈火點位、客座參數。純資料,不碰 DOM / world。
// 場景引擎在 interior.js,酒館邏輯在 tavern_scene.js。風格 id 同 theme_skin.js(han 漢 / bei 北方 / xiyu 西域 / nanman 南方 / qiang 羌氐);缺色票退回 han。
// 全域名稱:TAVERN_LINES TAVERN_PALS TAVERN_TABLES TAVERN_CFG TAVERN_GUEST_JOBS tavernLayoutBuild

// 掌櫃頭上泡泡台詞(10 句,輪播;每句 ≤ 20 字)
var TAVERN_LINES = [
  '客官,招人嗎?', '大人裡邊請,樓上包間都收拾好了。', '今兒來的客人,個個身懷絕技。', '招賢納士,小店最在行。',
  '酒要溫著喝,人要親自挑。', '聽說近日有名士路過。', '名帖都備好了,大人請過目。', '坐坐坐,先喝杯熱茶。',
  '天下英雄,都愛來小店歇腳。', '大人要找哪一路的人才?'
];

// 色票:wall 牆 floorA/floorB 地板 floorEdge 地板側面 beam/beamDk 屋樑 wood/woodDk/woodLt 木作 cloth/clothDk 旗簾 accent 金飾 paper 紙 inkWash 水墨 jarA/jarB 酒罈 cupC 杯 door 門 sign/signInk 匾 sky 窗
var TAVERN_PALS = {
  han: { wall: '#e6d3a8', floorA: '#c9a06a', floorB: '#bd9460', floorEdge: '#8a6238', beam: '#8a4e2a', beamDk: '#5e3418', wood: '#b5753a', woodDk: '#7a4a24', woodLt: '#d9a566',
    cloth: '#b8332a', clothDk: '#8c2a22', accent: '#e3b95c', paper: '#f4ead2', inkWash: '#4a4238', jarA: '#a8692f', jarB: '#7a5a3a', cupC: '#f4ead2', door: '#8a5a32', sign: '#3a2a1c', signInk: '#f1d27a', sky: '#9ec7d8' },
  bei: { wall: '#cfc8b8', floorA: '#a88660', floorB: '#9a7a56', floorEdge: '#6e4f30', beam: '#7a5430', beamDk: '#523a22', wood: '#9a6e3e', woodDk: '#6a4a2a', woodLt: '#c29a62',
    cloth: '#a8542c', clothDk: '#7e3e20', accent: '#d9b23c', paper: '#ece4d0', inkWash: '#4a4238', jarA: '#8a6a3a', jarB: '#6a4a2a', cupC: '#ece4d0', door: '#6a4a2a', sign: '#523a22', signInk: '#ecdca0', sky: '#b4cad2' },
  xiyu: { wall: '#c8a878', floorA: '#b9a07a', floorB: '#ac946e', floorEdge: '#7e6a48', beam: '#2f7a8a', beamDk: '#1f5260', wood: '#a8692f', woodDk: '#6e4220', woodLt: '#d29a58',
    cloth: '#2f4f8a', clothDk: '#1f3a6a', accent: '#e3b95c', paper: '#f1ead8', inkWash: '#3a3a4a', jarA: '#2f7a8a', jarB: '#b0603a', cupC: '#f1ead8', door: '#2f5a6a', sign: '#1f3a6a', signInk: '#f1ead8', sky: '#9ed0da' },
  nanman: { wall: '#b8a060', floorA: '#9a7a4a', floorB: '#8c6e42', floorEdge: '#5e4828', beam: '#6a4a2a', beamDk: '#46301a', wood: '#a88a4a', woodDk: '#6e5630', woodLt: '#cdb06a',
    cloth: '#3f8a5a', clothDk: '#2c6a42', accent: '#e3b95c', paper: '#e8dcb0', inkWash: '#3a3a30', jarA: '#8a6a3a', jarB: '#3f8a5a', cupC: '#e8dcb0', door: '#6a5030', sign: '#46301a', signInk: '#e8dcb0', sky: '#a4d0c0' },
  qiang: { wall: '#a09a8c', floorA: '#8f8f84', floorB: '#84847a', floorEdge: '#5c5c54', beam: '#2a2623', beamDk: '#1a1714', wood: '#7a6a52', woodDk: '#4a3e2e', woodLt: '#a89678',
    cloth: '#cfc8b8', clothDk: '#2a2623', accent: '#9a4a32', paper: '#e4dccb', inkWash: '#2a2623', jarA: '#7a7a72', jarB: '#4a3a2a', cupC: '#e4dccb', door: '#4a3a2a', sign: '#2a2623', signInk: '#cfc8b8', sky: '#a8bcc8' }
};

// 客座
var TAVERN_CFG = {
  guestMin: 3, guestMax: 10, bucketMs: 600000,           // 客人每 10 分鐘(本機時間桶)換一批;同桶同種子同客人
  occ: { day: [0.4, 0.7], dusk: [0.6, 0.9], night: [0.5, 0.8] },   // 占用率區間(占座位比例)
  hours: { dayFrom: 6, duskFrom: 17, nightFrom: 20 },
  anim: { period: [3.2, 5.6], kinds: 3 },                // 待機動畫:0 舉杯 1 點頭 2 靜坐微晃
  bubbleOn: 5.5, bubbleCycle: 8                          // 掌櫃泡泡:每 8 秒顯示 5.5 秒
};
// 酒客職業池(crowdparts.js CROWD_JOBS 的 key)
var TAVERN_GUEST_JOBS = ['farmer', 'vendor', 'scholar', 'guard', 'smith', 'woodcut', 'fisher', 'official', 'noble', 'artist', 'porter', 'escort', 'elder', 'woman', 'doctor'];

// 一樓桌位(左上格);每桌 2 個後側座位:(c-1,r) 面向 SE(face 3)、(c,r-1) 面向 SW(face 0)
var TAVERN_TABLES = [[3, 3], [6, 3], [3, 5], [6, 5], [1, 5], [1, 3]];

function tavernLayoutBuild() {
  var props = [], seats = [];
  props.push({ id: 'counter', floor: '1F', kind: 'counter', at: [1, 1], size: [3, 1], dyn: true });
  props.push({ id: 'jars', floor: '1F', kind: 'jars', at: [5, 0], size: [2, 1] });
  props.push({ id: 'kitchen', floor: '1F', kind: 'kitchen', at: [7, 0], size: [1, 1] });
  props.push({ id: 'stairs1', floor: '1F', kind: 'stairs', at: [0, 1], size: [1, 2] });
  props.push({ id: 'screen', floor: '1F', kind: 'screen', at: [4, 0], size: [1, 1], dyn: true });
  props.push({ id: 'plant1', floor: '1F', kind: 'plant', at: [7, 1], size: [1, 1] });
  props.push({ id: 'plant2', floor: '1F', kind: 'plant', at: [7, 5], size: [1, 1] });
  props.push({ id: 'sign1', floor: '1F', kind: 'sign', at: [1.6, 0], size: [2.4, 1], axis: 'x', label: '招賢酒肆', free: true });
  props.push({ id: 'win1', floor: '1F', kind: 'window', at: [0, 3], size: [2, 1], axis: 'y', free: true });
  props.push({ id: 'banner1', floor: '1F', kind: 'banner', at: [0.3, 0.3], size: [1, 1], label: '酒', free: true });
  TAVERN_TABLES.forEach(function (t, i) {
    props.push({ id: 'tbl' + i, floor: '1F', kind: 'table', at: [t[0], t[1]], size: [1, 1], dyn: true });
    seats.push({ floor: '1F', at: [t[0] - 1, t[1]], face: 3, prop: 'tbl' + i });
    seats.push({ floor: '1F', at: [t[0], t[1] - 1], face: 0, prop: 'tbl' + i });
  });
  // 二樓:2 間占位包間門(I0 不可互動;I1 起依 world.city.tavern.lv 增加)、樓梯口、地毯、欄杆
  props.push({ id: 'rug2', floor: '2F', kind: 'rug', at: [1.5, 1.6], size: [5, 1.6], free: true });
  props.push({ id: 'door2a', floor: '2F', kind: 'door', at: [1, 0], size: [2, 1], label: '甲' });
  props.push({ id: 'door2b', floor: '2F', kind: 'door', at: [3, 0], size: [2, 1], label: '乙' });
  props.push({ id: 'win2', floor: '2F', kind: 'window', at: [5, 0], size: [3, 1], axis: 'x', free: true });
  props.push({ id: 'stairs2', floor: '2F', kind: 'stairs', at: [0, 1], size: [1, 2] });
  props.push({ id: 'plant3', floor: '2F', kind: 'plant', at: [7, 1], size: [1, 1] });
  props.push({ id: 'rail2', floor: '2F', kind: 'railing', at: [0, 0], size: [1, 1], free: true });
  return {
    floors: [{ id: '1F', label: '一樓', grid: [8, 6] }, { id: '2F', label: '二樓', grid: [8, 4] }],
    props: props, seats: seats,
    npcs: [{ id: 'keeper', floor: '1F', at: [2, 0], act: 'recruit' }],
    lights: [{ floor: '1F', at: [1, 0.05], z: 50 }, { floor: '1F', at: [4.5, 0.05], z: 50 }, { floor: '1F', at: [0.05, 3.5], z: 50 }, { floor: '1F', at: [0.05, 5.5], z: 50 },
      { floor: '2F', at: [2.5, 0.05], z: 50 }, { floor: '2F', at: [6, 0.05], z: 50 }]
  };
}

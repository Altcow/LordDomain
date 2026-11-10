// js/tavern_data.js — 酒館室內場景資料(PLAN_INTERIORS §1;I0):掌櫃台詞庫、五種城市風格色票、房間 / 家具 / 座位 / 燈火點位、客座參數。純資料,不碰 DOM / world。
// 場景引擎在 interior.js,酒館邏輯在 tavern_scene.js。風格 id 同 theme_skin.js(han 漢 / bei 北方 / xiyu 西域 / nanman 南方 / qiang 羌氐);缺色票退回 han。
// I1 追加:TAVERN_ECON(包間 / 客座收益、掌櫃加成、事件日上限,全 PLACEHOLDER;v58-C 起酒館無升級,一開始即最高級 lv 5)、TAVERN_EVENTS(客座小事件文案)、TAVERN_JOB_NAMES、tavernRoomProps(依包間數排二樓門)。
// 全域名稱:TAVERN_LINES TAVERN_PALS TAVERN_TABLES TAVERN_CFG TAVERN_GUEST_JOBS TAVERN_ECON TAVERN_EVENTS TAVERN_JOB_NAMES tavernRoomProps tavernLayoutBuild

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

// ───────── I1:收益與事件(數值全 PLACEHOLDER,平衡最後統一做)─────────
var TAVERN_ECON = {
  hourSec: 120,                          // 1 遊戲小時 = 真實秒(同 goodsdata GOODS_HOUR_SEC)
  gapSec: 300,                           // 距上次結算超過此秒數視為離線:套用 offlineCapSec() 上限與 offlineRate() 倍率
  capSecDefault: 8 * 3600, rateDefault: 0.5,   // 缺 tech.js / data.js 時的離線上限 / 倍率
  roomsByLv: [2, 3, 4, 5, 6],            // 酒館 Lv1~5 的包間數
  seatBase: 3, seatPerLv: 0.5,           // 客座消費:每位在座客人每遊戲小時 = seatBase + seatPerLv × 酒館 lv(文)
  roomOcc: { day: 0.45, dusk: 0.7, night: 0.6 }, roomOccPerLv: 0.03,   // 包間入住機率(時段)與每級加成
  roomFee: [5, 9, 14, 21, 30],           // 包間費(每次入住每遊戲小時,依包間 lv 1~5)
  roomEat: [3, 5, 8, 12, 18],            // 包間內客人消費
  capHour: [50, 100, 160, 230, 320],     // 每遊戲小時基礎收入上限(依酒館 lv,掌櫃加成之前)
  keepCap: 0.3, keepScale: 0.5,          // 掌櫃職司加成:min(keepCap, 人事乘區% /100 × keepScale + 詞條)
  keepTraits: { haojiu: 0.05, mingwang: 0.05, juxian: 0.03 },
  evChance: { day: 0.35, dusk: 0.5, night: 0.45 },   // 每 10 分鐘一批,該批出現小事件的機率
  evDayMax: 3,                                         // 每日(本機日)可處理的小事件上限
  offerMs: 1500                                        // 進場後小事件標記延遲(僅演出)
};
var TAVERN_JOB_NAMES = { farmer: '農夫', vendor: '商販', scholar: '書生', guard: '軍士', smith: '匠人', woodcut: '樵夫', fisher: '漁夫', official: '小吏', noble: '士紳', artist: '藝人', porter: '腳夫', escort: '鏢客', elder: '老丈', woman: '婦人', doctor: '郎中' };
// 小事件:opts[i] = { t 按鈕, res 結果文, rw 獎勵 {coin:[lo,hi], goods:{id:[lo,hi]}, fav:1} }或賭運氣 { t, win:{res,rw}, lose:{res,rw} };w 抽選權重;{job} 代入客人職業名
var TAVERN_EVENTS = [
  { id: 'brag', w: 3, name: '醉客吹牛', intro: '一位{job}喝得微醺,拍著桌子說:「想當年我隨軍出塞,一口氣追敵三十里!」同桌的人只是笑。',
    opts: [{ t: '笑著附和他', res: '客人眉開眼笑,硬塞了幾文酒錢過來。', rw: { coin: [14, 26] } },
      { t: '遞上一碗醒酒湯', res: '客人喝了湯,清醒了幾分,連聲道謝。', rw: { coin: [8, 16], fav: 1 } }] },
  { id: 'story', w: 3, name: '說書叫好', intro: '角落的說書人講到「單騎闖陣」,滿堂客人齊聲叫好,連隔桌都探過頭來。',
    opts: [{ t: '帶頭鼓掌', res: '掌聲四起,客人興致高昂,又多點了幾壺酒。', rw: { coin: [16, 30] } },
      { t: '請他再說一段', res: '說書人謝過賞,把壓箱底的故事又講了一段。', rw: { coin: [8, 14], fav: 1 } }] },
  { id: 'huaquan', w: 2, name: '划拳助興', intro: '兩位客人划起拳來,你一聲「五魁首」,我一聲「六六順」,旁人都在起鬨,問你押哪一邊。',
    opts: [{ t: '押左邊那位', win: { res: '左邊那位贏了!輸家笑著認罰,酒錢多給了些。', rw: { coin: [22, 36] } }, lose: { res: '右邊那位贏了,左邊的客人拱手笑道:「改日再戰!」', rw: { coin: [6, 10] } } },
      { t: '押右邊那位', win: { res: '右邊那位贏了!輸家笑著認罰,酒錢多給了些。', rw: { coin: [22, 36] } }, lose: { res: '左邊那位贏了,右邊的客人拱手笑道:「改日再戰!」', rw: { coin: [6, 10] } } }] },
  { id: 'brawl', w: 2, name: '酒後爭執', intro: '兩位客人為了酒錢爭得面紅耳赤,眼看就要動手,其他客人紛紛側目。',
    opts: [{ t: '請掌櫃上前勸解', res: '掌櫃三言兩語,兩人便和好如初,各自賠了桌椅的小錢。', rw: { coin: [12, 22], fav: 1 } },
      { t: '自己上前調停', res: '兩人見城主出面,連忙作揖,留下一小包糧食作謝禮。', rw: { goods: { g_liang: [3, 5] } } }] },
  { id: 'traveler', w: 2, name: '旅人問路', intro: '一位風塵僕僕的旅人打聽附近的路況與集市,想知道哪條路最好走。',
    opts: [{ t: '指點近路', res: '旅人謝了又謝,留下兩片木板當謝禮。', rw: { goods: { g_muban: [1, 2] } } },
      { t: '說說城中風物', res: '旅人聽得入神,臨走多留了些酒錢。', rw: { coin: [12, 24] } }] },
  { id: 'gift', w: 2, name: '老客贈禮', intro: '一位常來的老客人笑著說:「多謝酒肆照應,這是自家種的一點心意。」',
    opts: [{ t: '收下並道謝', res: '老客人欣慰而去,說下回還來。', rw: { goods: { g_liang: [4, 7] }, fav: 1 } }] },
  { id: 'poem', w: 1, name: '書生題壁', intro: '一位書生酒興大發,提筆在牆角題了兩句詩,字跡倒也端正。',
    opts: [{ t: '誇他筆力好', res: '書生大喜,堅持要回敬你一杯。', rw: { coin: [10, 20] } },
      { t: '請他寫在紙上留念', res: '書生欣然落墨,留下一幅字,說是答謝。', rw: { coin: [6, 12], fav: 1 } }] }
];

// 二樓包間門 / 窗:n 間(2~6);n ≤ 3 門寬 2,n ≥ 4 門寬 1。回 props 陣列(門 id door2a… 窗 id win2)
function tavernRoomProps(n) {
  var out = [], w = n <= 3 ? 2 : 1, i, c = 1, left;
  n = Math.max(1, Math.min(6, n | 0));
  for (i = 0; i < n; i++) { out.push({ id: 'door2' + 'abcdef'.charAt(i), floor: '2F', kind: 'rdoor', at: [c, 0], size: [w, 1], label: '甲乙丙丁戊己'.charAt(i), room: i }); c += w; }
  left = 8 - c;
  if (left >= 1) out.push({ id: 'win2', floor: '2F', kind: 'window', at: [c, 0], size: [left, 1], axis: 'x', free: true });
  return out;
}

function tavernLayoutBuild(nRooms) {
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
  // 二樓:包間門(I1:依 world.city.tavern.lv 的包間數,進場時由 tavern_scene.js 重排)、樓梯口、地毯、欄杆
  props.push({ id: 'rug2', floor: '2F', kind: 'rug', at: [1.5, 1.6], size: [5, 1.6], free: true });
  tavernRoomProps(nRooms || 2).forEach(function (p) { if (p.kind === 'rdoor' && typeof INTERIOR_KINDS !== 'undefined' && !INTERIOR_KINDS.rdoor) p.kind = 'door'; props.push(p); });
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

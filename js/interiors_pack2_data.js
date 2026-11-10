// js/interiors_pack2_data.js — 室內空間第二批資料(PLAN_INTERIORS §5.1 第 2、6、8、9、10、14 項):學宮 / 倉廩 / 醫署藥肆 / 市集大堂 / 驛站 / 觀星臺,共 6 個場景。純資料,不碰 DOM / world。
// 格式沿用第一批 IP_SCENES(interiors_pack1_data.js,須先載入;用到 ipP / ipSlot / ipDeskRows / IP_LINES_PERSON);本檔場景另帶 p2:true。
//   act 新增:{t:'panel', id:'roster'|'caravan'}(開名冊 / 走鏢面板)、{t:'info2', fn:'stock'|'hour'}(庫存摘要 / 此刻時辰)
// 全域名稱:IP2_SCENES IP2_BLD IP2_IDS
// 風格色票沿用 tavern_data.js 的 TAVERN_PALS + IP_EXTRA(缺則退回內建最小色票)。

var IP2_OK = (typeof ipP === 'function' && typeof ipSlot === 'function' && typeof ipDeskRows === 'function');   // 缺第一批資料檔時整批略過(不丟例外)
var IP2_SCENES = {};
var IP2_BLD = {
  xue_she: { id: 'academy' }, xue_gong: { id: 'academy' },
  cao_cang: { id: 'granary' }, changping_cang: { id: 'granary' },
  tai_yi_shu: { id: 'clinic' }, shop_herb: { id: 'clinic' },
  market: { id: 'bazaar' }, shi_lou: { id: 'bazaar' },
  post_station: { id: 'station' },
  hun_tian: { id: 'observatory' }, di_dong: { id: 'observatory' }
};

// 追加名冊人物台詞(依職司 id)
if (typeof IP_LINES_PERSON !== 'undefined') {
  IP_LINES_PERSON.student = ['先生教的這一課,還得多讀幾遍。', '學成之後,願為大人效力。', '筆墨未乾,不敢分心。', '同窗們都很用功。'];
  IP_LINES_PERSON.study = IP_LINES_PERSON.study || ['書卷未盡,不敢懈怠。'];
}

// ── 學宮(xue_she / xue_gong):講席、祭酒(開名冊,送人進修)、學官授課、進修中的名冊人物伏案 ──
if (IP2_OK) (function () {
  var rows = ipDeskRows('a');
  IP2_SCENES.academy = {
    id: 'academy', name: '學宮', title: '學宮', bld: ['xue_she', 'xue_gong'], subKind: 'academy', p2: true,
    floors: [{ id: '1F', label: '講堂', grid: [8, 6] }, { id: '2F', label: '書房', grid: [8, 4] }],
    pal: { wall: '#e6dcc0', floorA: '#b8a98a', floorB: '#ac9d7e', floorEdge: '#76694f', beam: '#5a3f2c', beamDk: '#35241a', cloth: '#2f5a7a' },
    props: rows.props.concat([
      ipP('shelfA', '1F', 'shelf', [0, 0], [3, 1], { items: 'books', free: true }), ipP('shelfB', '1F', 'shelf', [5, 0], [3, 1], { items: 'scrolls', free: true }),
      ipP('lectern', '1F', 'blk2', [3, 1], [2, 1], { dyn: true, col: 'woodDk', h: 12, deco: 'books' }),
      ipP('longtbl', '1F', 'table', [3, 5], [2, 1], { dyn: true }),
      ipP('rug', '1F', 'rug', [2, 1.6], [4, 2], { free: true }), ipP('plant1', '1F', 'plant', [7, 1]), ipP('plant2', '1F', 'plant', [0, 5]),
      ipP('sign1', '1F', 'sign', [3, 0], [2, 1], { axis: 'x', label: '學宮', free: true }), ipP('win1', '1F', 'window', [0, 3], [2, 1], { axis: 'y', free: true }),
      ipP('banner1', '1F', 'banner', [0.3, 0.3], [1, 1], { label: '學', free: true }), ipP('stairs1', '1F', 'stairs', [0, 1], [1, 2]),
      ipP('shelf2', '2F', 'shelf', [1, 0], [6, 1], { items: 'books', free: true }), ipP('desk2', '2F', 'blk2', [2, 1], [2, 1], { dyn: true, col: 'wood', h: 10, deco: 'books' }),
      ipP('desk3', '2F', 'blk2', [5, 2], [2, 1], { dyn: true, col: 'wood', h: 10, deco: 'paper' }), ipP('rug2', '2F', 'rug', [1.5, 2], [5, 1.6], { free: true }),
      ipP('stairs2', '2F', 'stairs', [0, 1], [1, 2]), ipP('rail2', '2F', 'railing', [0, 0], [1, 1], { free: true }), ipP('plant3', '2F', 'plant', [7, 1])
    ]),
    slots: [
      ipSlot('1F', [2, 1], 0, 'p'), ipSlot('1F', [5, 1], 3, 'p'),                                             // 學官(站)
      ipSlot('1F', [1, 2], 0, 'p', { sit: true }), ipSlot('1F', [6, 2], 0, 'p', { sit: true }), ipSlot('1F', [1, 4], 0, 'p', { sit: true }),
      ipSlot('1F', [6, 4], 0, 'p', { sit: true }), ipSlot('1F', [3, 4], 0, 'p', { sit: true }), ipSlot('1F', [4, 4], 0, 'p', { sit: true }),   // 進修生(坐)
      ipSlot('1F', [4, 3], 3, 'v'), ipSlot('1F', [2, 5], 0, 'v'), ipSlot('1F', [5, 5], 3, 'v'),
      ipSlot('2F', [2, 0], 0, 'v', { sit: true }), ipSlot('2F', [3, 0], 0, 'v', { sit: true }), ipSlot('2F', [4, 3], 0, 'v')
    ],
    keeper: { name: '祭酒', floor: '1F', at: [3, 2], look: { job: 'scholar', key: 17, head: 'hat', headCol: '#2f4a6a', tunic: '#3f5f8f', trim: '#e3b95c' }, act: { t: 'panel', id: 'roster' },
      lines: ['有教無類,因材施教。', '想送誰進修?名冊裡挑人便是。', '名冊人物都在這裡,想看誰?', '學成之後,辦起事來自然得心應手。'] },
    hotspots: [{ id: 'lectern', floor: '1F', at: [3, 1], act: { t: 'panel', id: 'roster' }, label: '講席' }, { id: 'desk2', floor: '2F', at: [2, 1], act: { t: 'talk', line: '典籍按經史子集,分門別類。' }, label: '書案' }],
    people: { kind: 'workshop', max: 2, opts: { posts: ['study'] } }, visitors: { n: [1, 3], jobs: ['scholar', 'elder', 'official', 'farmer'] },
    lines: ['聽說學宮收學生了?', '家裡孩子若能讀書就好了。', '讀書人的聲音,聽著舒服。'],
    lights: [{ floor: '1F', at: [1.5, 0.05], z: 50 }, { floor: '1F', at: [6, 0.05], z: 50 }, { floor: '1F', at: [0.05, 4.5], z: 50 }, { floor: '2F', at: [2.5, 0.05], z: 50 }, { floor: '2F', at: [6, 0.05], z: 50 }]
  };
})();

// ── 倉廩(cao_cang / changping_cang):糧袋堆量隨庫存增減、倉曹(開庫房)、大秤(庫存摘要)、貨堆(鏈條圖) ──
if (IP2_OK) (function () {
  IP2_SCENES.granary = {
    id: 'granary', name: '倉廩', title: '倉廩', bld: ['cao_cang', 'changping_cang'], subKind: 'granary', p2: true,
    floors: [{ id: '1F', label: '糧倉', grid: [8, 6] }, { id: '2F', label: '儲糧樓', grid: [8, 4] }],
    pal: { wall: '#d9c9a2', floorA: '#9a8b70', floorB: '#8e8066', floorEdge: '#5e5240', beam: '#5a4030', beamDk: '#3a2818' },
    props: [
      ipP('shelf1', '1F', 'shelf', [0, 0], [3, 1], { items: 'goods', free: true }), ipP('sacksA', '1F', 'blk2', [3, 0], [2, 1], { dyn: true, col: 'wood', h: 4, deco: 'sacks' }),
      ipP('sacksB', '1F', 'blk2', [6, 0], [2, 1], { dyn: true, col: 'wood', h: 4, deco: 'sacks' }), ipP('crateC', '1F', 'block', [1, 3], [1, 1], { dyn: true, col: 'wood', h: 13, deco: 'crate' }),
      ipP('scale', '1F', 'blk2', [5, 3], [1, 1], { dyn: true, col: 'woodDk', h: 5, deco: 'scale' }), ipP('bench', '1F', 'block', [3, 4], [2, 1], { dyn: true, col: 'woodDk', h: 9, deco: 'paper' }),
      ipP('rug', '1F', 'rug', [2, 1.6], [4, 1.8], { free: true }), ipP('plant1', '1F', 'plant', [7, 2]), ipP('plant2', '1F', 'plant', [0, 5]),
      ipP('sign1', '1F', 'sign', [3, 0], [2, 1], { axis: 'x', label: '倉廩', free: true }), ipP('win1', '1F', 'window', [0, 3], [2, 1], { axis: 'y', free: true }), ipP('stairs1', '1F', 'stairs', [0, 1], [1, 2]),
      ipP('shelf2', '2F', 'shelf', [1, 0], [7, 1], { items: 'goods', free: true }), ipP('stock1', '2F', 'blk2', [1, 1], [2, 1], { dyn: true, col: 'wood', h: 4, deco: 'sacks' }),
      ipP('stock2', '2F', 'blk2', [5, 1], [2, 1], { dyn: true, col: 'wood', h: 4, deco: 'sacks' }),
      ipP('stairs2', '2F', 'stairs', [0, 1], [1, 2]), ipP('rail2', '2F', 'railing', [0, 0], [1, 1], { free: true }), ipP('plant3', '2F', 'plant', [7, 3])
    ],
    slots: [ipSlot('1F', [2, 3], 0, 'p'), ipSlot('1F', [5, 2], 3, 'p'), ipSlot('1F', [6, 4], 0, 'p'),
      ipSlot('1F', [4, 3], 0, 'v'), ipSlot('1F', [1, 5], 0, 'v'), ipSlot('1F', [6, 5], 3, 'v'), ipSlot('1F', [2, 4], 3, 'v'), ipSlot('2F', [3, 2], 0, 'v'), ipSlot('2F', [6, 3], 3, 'v')],
    keeper: { name: '倉曹', floor: '1F', at: [3, 2], look: { job: 'official', key: 23, head: 'hat', headCol: '#5a4a2a', tunic: '#6a5a3a', trim: '#e8dcb0' }, act: { t: 'panel', id: 'goods' },
      lines: ['糧袋堆得滿滿的,心裡才踏實。', '進出倉的帳,一筆都不會錯。', '要看存了什麼,請去庫房。', '防潮防鼠,是倉裡頭等大事。'] },
    hotspots: [{ id: 'sacksA', floor: '1F', at: [3, 0], act: { t: 'panel', id: 'chain' }, label: '糧堆' }, { id: 'scale', floor: '1F', at: [5, 3], act: { t: 'info2', fn: 'stock' }, label: '大秤' },
      { id: 'stock1', floor: '2F', at: [1, 1], act: { t: 'panel', id: 'goods' }, label: '庫存' }],
    people: { kind: 'workshop', max: 3, opts: { posts: ['farm', 'craft'] } }, visitors: { n: [1, 3], jobs: ['porter', 'farmer', 'vendor', 'guard'] },
    lines: ['這批糧要運去哪?', '倉裡的糧,夠吃一冬了吧。', '搬貨搬得腰都酸了。'],
    lights: [{ floor: '1F', at: [1.5, 0.05], z: 50 }, { floor: '1F', at: [6.5, 0.05], z: 50 }, { floor: '1F', at: [0.05, 4.5], z: 50 }, { floor: '2F', at: [3, 0.05], z: 50 }, { floor: '2F', at: [6, 0.05], z: 50 }]
  };
})();

// ── 醫署藥肆(tai_yi_shu / shop_herb):百子藥櫃、藥爐、診榻、郎中(診療小案例與建議) ──
if (IP2_OK) (function () {
  IP2_SCENES.clinic = {
    id: 'clinic', name: '醫署藥肆', title: '醫署藥肆', bld: ['tai_yi_shu', 'shop_herb'], subKind: 'clinic', p2: true,
    floors: [{ id: '1F', label: '診堂', grid: [8, 6] }, { id: '2F', label: '藥庫', grid: [8, 4] }],
    pal: { wall: '#e4ead2', floorA: '#b4b496', floorB: '#a8a88a', floorEdge: '#6c6c52', beam: '#4a5a3a', beamDk: '#2c3a22', cloth: '#3f7a4a' },
    props: [
      ipP('shelfA', '1F', 'shelf', [0, 0], [4, 1], { items: 'pots', free: true }), ipP('stove', '1F', 'blk2', [6, 0], [1, 1], { dyn: true, col: 'stone', h: 8, deco: 'cauldron' }),
      ipP('herbtbl', '1F', 'blk2', [4, 1], [2, 1], { dyn: true, col: 'wood', h: 10, deco: 'herb' }), ipP('bedA', '1F', 'blk2', [1, 4], [2, 1], { dyn: true, col: 'wood', h: 6, deco: 'bed' }),
      ipP('bedB', '1F', 'blk2', [6, 4], [2, 1], { dyn: true, col: 'wood', h: 6, deco: 'bed' }),
      ipP('rug', '1F', 'rug', [2.4, 2.4], [3.2, 1.6], { free: true }), ipP('plant1', '1F', 'plant', [7, 2]), ipP('plant2', '1F', 'plant', [0, 5]),
      ipP('sign1', '1F', 'sign', [4, 0], [1.6, 1], { axis: 'x', label: '杏林', free: true }), ipP('win1', '1F', 'window', [0, 3], [2, 1], { axis: 'y', free: true }),
      ipP('banner1', '1F', 'banner', [0.3, 0.3], [1, 1], { label: '醫', free: true }), ipP('stairs1', '1F', 'stairs', [0, 1], [1, 2]),
      ipP('shelf2', '2F', 'shelf', [1, 0], [7, 1], { items: 'pots', free: true }), ipP('herbA', '2F', 'blk2', [2, 1], [2, 1], { dyn: true, col: 'wood', h: 10, deco: 'herb' }),
      ipP('herbB', '2F', 'blk2', [5, 2], [2, 1], { dyn: true, col: 'wood', h: 10, deco: 'herb' }), ipP('rug2', '2F', 'rug', [1.5, 2.2], [5, 1.2], { free: true }),
      ipP('stairs2', '2F', 'stairs', [0, 1], [1, 2]), ipP('rail2', '2F', 'railing', [0, 0], [1, 1], { free: true }), ipP('plant3', '2F', 'plant', [7, 1])
    ],
    slots: [ipSlot('1F', [2, 2], 0, 'p'), ipSlot('1F', [5, 2], 3, 'p'), ipSlot('1F', [6, 3], 3, 'p'),
      ipSlot('1F', [3, 4], 3, 'v'), ipSlot('1F', [4, 3], 0, 'v', { sit: true }), ipSlot('1F', [5, 4], 0, 'v'), ipSlot('1F', [7, 5], 3, 'v'), ipSlot('2F', [3, 3], 0, 'v'), ipSlot('2F', [6, 1], 3, 'v')],
    keeper: { name: '郎中', floor: '1F', at: [3, 2], look: { job: 'doctor', key: 29, head: 'scarf', headCol: '#e8e0c8', tunic: '#5a7a5a', trim: '#f4ead2' }, act: { t: 'case' },
      lines: ['來,伸手,我給您把把脈。', '對症下藥,方能見效。', '防病勝於治病,入秋要多留意。', '藥爐上的湯藥,快好了。'] },
    hotspots: [{ id: 'stove', floor: '1F', at: [6, 0], act: { t: 'talk', line: '藥罐咕嘟咕嘟,藥香滿屋。' }, label: '藥爐' }, { id: 'herbA', floor: '2F', at: [2, 1], act: { t: 'talk', line: '曬乾的藥材,按性味分格收好。' }, label: '藥材' }],
    people: { kind: 'workshop', max: 3, opts: { posts: ['med'] } }, visitors: { n: [2, 4], jobs: ['elder', 'woman', 'farmer', 'vendor'] },
    lines: ['最近老是咳嗽,來抓幾帖藥。', '郎中的藥,靈得很。', '人吃五穀雜糧,哪有不生病的。'],
    cases: ['老農咳嗽三日。郎中建議:「生薑紅棗煮湯,多歇息,莫受風寒。」', '孩童夜裡燥熱。郎中建議:「少食油膩,煎些綠豆湯降火。」', '匠人腰背痠痛。郎中建議:「熱敷針灸,每日活動筋骨。」',
      '近日有人腹瀉。郎中建議:「井水要煮沸再飲,公告鄰里。」'],
    lights: [{ floor: '1F', at: [1.5, 0.05], z: 50 }, { floor: '1F', at: [6.5, 0.05], z: 50 }, { floor: '1F', at: [0.05, 4.5], z: 50 }, { floor: '2F', at: [3, 0.05], z: 50 }, { floor: '2F', at: [6, 0.05], z: 50 }]
  };
})();

// ── 市集大堂(market / shi_lou):五個彩棚攤位、市令(開庫房,買賣貨品)、公平秤、二樓茶座 ──
if (IP2_OK) (function () {
  var props = [
    ipP('stall1', '1F', 'blk2', [1, 0], [2, 1], { dyn: true, col: 'wood', h: 9, deco: 'stall', awn: 0 }), ipP('stall2', '1F', 'blk2', [3, 0], [2, 1], { dyn: true, col: 'wood', h: 9, deco: 'stall', awn: 1 }),
    ipP('stall3', '1F', 'blk2', [5, 0], [2, 1], { dyn: true, col: 'wood', h: 9, deco: 'stall', awn: 2 }), ipP('stall4', '1F', 'blk2', [6, 2], [2, 1], { dyn: true, col: 'wood', h: 9, deco: 'stall', awn: 3 }),
    ipP('stall5', '1F', 'blk2', [1, 4], [2, 1], { dyn: true, col: 'wood', h: 9, deco: 'stall', awn: 4 }), ipP('scale', '1F', 'blk2', [4, 4], [1, 1], { dyn: true, col: 'woodDk', h: 5, deco: 'scale' }),
    ipP('plant1', '1F', 'plant', [7, 5]), ipP('plant2', '1F', 'plant', [0, 5]), ipP('win1', '1F', 'window', [0, 3], [2, 1], { axis: 'y', free: true }),
    ipP('banner1', '1F', 'banner', [0.3, 0.3], [1, 1], { label: '市', free: true }), ipP('rug', '1F', 'rug', [2.4, 2.2], [3.2, 1.6], { free: true }), ipP('stairs1', '1F', 'stairs', [0, 1], [1, 2]),
    ipP('rug2', '2F', 'rug', [1.5, 1.6], [5, 1.6], { free: true }), ipP('stairs2', '2F', 'stairs', [0, 1], [1, 2]), ipP('rail2', '2F', 'railing', [0, 0], [1, 1], { free: true }), ipP('plant3', '2F', 'plant', [7, 1]),
    ipP('shelf2', '2F', 'shelf', [1, 0], [6, 1], { items: 'goods', free: true })
  ], slots = [ipSlot('1F', [5, 2], 3, 'p'), ipSlot('1F', [2, 2], 0, 'p')];
  [[3, 2], [6, 2]].forEach(function (t, i) {
    props.push(ipP('tbl' + i, '2F', 'table', [t[0], t[1]], [1, 1], { dyn: true }));
    slots.push(ipSlot('2F', [t[0] - 1, t[1]], 3, 'v', { sit: true }), ipSlot('2F', [t[0], t[1] - 1], 0, 'v', { sit: true }));
  });
  [[2, 1], [4, 1], [6, 1], [3, 3], [5, 3], [4, 5], [6, 4], [2, 5]].forEach(function (a, i) { slots.push(ipSlot('1F', a, i % 2 ? 3 : 0, 'v')); });
  IP2_SCENES.bazaar = {
    id: 'bazaar', name: '市集大堂', title: '市集大堂', bld: ['market', 'shi_lou'], subKind: 'bazaar', p2: true,
    floors: [{ id: '1F', label: '市場', grid: [8, 6] }, { id: '2F', label: '茶座', grid: [8, 4] }],
    pal: { wall: '#ecdcb6', floorA: '#c2a676', floorB: '#b69a6c', floorEdge: '#7a6642', awn: ['#b8332a', '#2f6a8a', '#d9a53a', '#4a8a5a', '#8a4a8a'] },
    props: props, slots: slots,
    keeper: { name: '市令', floor: '1F', at: [3, 2], look: { job: 'vendor', key: 31, head: 'hat', headCol: '#3a3a5a', tunic: '#4a4a7a', trim: '#d9b23c' }, act: { t: 'panel', id: 'goods' },
      lines: ['買賣公平,童叟無欺。', '大人的貨要賣要存,請看庫房。', '今天的行情不錯。', '各地商販都愛來此做買賣。'] },
    hotspots: [{ id: 'stall1', floor: '1F', at: [1, 0], act: { t: 'panel', id: 'goods' }, label: '攤位' }, { id: 'scale', floor: '1F', at: [4, 4], act: { t: 'talk', line: '公平秤,斤兩不差分毫。' }, label: '公平秤' }],
    people: { kind: 'workshop', max: 2, opts: { posts: ['trade'] } }, visitors: { n: [5, 8], jobs: ['vendor', 'farmer', 'woman', 'noble', 'elder', 'porter'] },
    lines: ['這匹布賣得便宜!', '來碗熱湯,再買些菜回去。', '今日生意可真熱鬧。'],
    lights: [{ floor: '1F', at: [1, 0.05], z: 50 }, { floor: '1F', at: [6.5, 0.05], z: 50 }, { floor: '1F', at: [0.05, 4.5], z: 50 }, { floor: '2F', at: [2.5, 0.05], z: 50 }, { floor: '2F', at: [6, 0.05], z: 50 }]
  };
})();

// ── 驛站(post_station):信函格、驛丞(開走鏢面板)、鏢車、馬槽;二樓驛房 ──
if (IP2_OK) (function () {
  IP2_SCENES.station = {
    id: 'station', name: '驛站', title: '驛站', bld: ['post_station'], subKind: 'station', p2: true,
    floors: [{ id: '1F', label: '驛廳', grid: [8, 6] }, { id: '2F', label: '驛房', grid: [8, 4] }],
    pal: { wall: '#e0d0aa', floorA: '#b09870', floorB: '#a28c64', floorEdge: '#6a5a3c', beam: '#5a4030', beamDk: '#3a2818', cloth: '#2f5a4a' },
    props: [
      ipP('mail1', '1F', 'shelf', [0, 0], [4, 1], { items: 'scrolls', free: true }), ipP('counter', '1F', 'counter', [4, 1], [3, 1], { dyn: true }),
      ipP('cart', '1F', 'blk2', [1, 3], [2, 2], { dyn: true, col: 'woodLt', h: 8, deco: 'cart' }), ipP('trough', '1F', 'blk2', [5, 4], [2, 1], { dyn: true, col: 'wood', h: 6, deco: 'trough' }),
      ipP('rug', '1F', 'rug', [3, 2.4], [3, 1.4], { free: true }), ipP('plant1', '1F', 'plant', [7, 1]), ipP('plant2', '1F', 'plant', [7, 5]),
      ipP('sign1', '1F', 'sign', [4, 0], [3, 1], { axis: 'x', label: '驛站', free: true }), ipP('win1', '1F', 'window', [0, 3], [2, 1], { axis: 'y', free: true }),
      ipP('banner1', '1F', 'banner', [0.3, 0.3], [1, 1], { label: '驛', free: true }), ipP('stairs1', '1F', 'stairs', [0, 1], [1, 2]),
      ipP('shelf2', '2F', 'shelf', [1, 0], [6, 1], { items: 'scrolls', free: true }), ipP('bedA', '2F', 'blk2', [1, 1], [2, 1], { dyn: true, col: 'wood', h: 6, deco: 'bed' }),
      ipP('bedB', '2F', 'blk2', [4, 1], [2, 1], { dyn: true, col: 'wood', h: 6, deco: 'bed' }), ipP('mailbox', '2F', 'blk2', [7, 1], [1, 1], { dyn: true, col: 'woodDk', h: 26, deco: 'mail' }),
      ipP('rug2', '2F', 'rug', [1.5, 2.2], [5, 1.2], { free: true }), ipP('stairs2', '2F', 'stairs', [0, 1], [1, 2]), ipP('rail2', '2F', 'railing', [0, 0], [1, 1], { free: true }), ipP('plant3', '2F', 'plant', [7, 3])
    ],
    slots: [ipSlot('1F', [4, 2], 0, 'p'), ipSlot('1F', [6, 3], 3, 'p'),
      ipSlot('1F', [3, 2], 3, 'v'), ipSlot('1F', [3, 5], 0, 'v'), ipSlot('1F', [4, 3], 0, 'v'), ipSlot('1F', [7, 3], 3, 'v'), ipSlot('1F', [4, 5], 0, 'v'), ipSlot('1F', [2, 2], 0, 'v'),
      ipSlot('2F', [3, 3], 0, 'v'), ipSlot('2F', [6, 3], 3, 'v'), ipSlot('2F', [4, 2], 0, 'v')],
    keeper: { name: '驛丞', floor: '1F', at: [5, 0], look: { job: 'official', key: 37, head: 'hat', headCol: '#2f3a2a', tunic: '#4a5a3a', trim: '#e3b95c' }, act: { t: 'panel', id: 'caravan' },
      lines: ['公文、信函、貨物,驛站一手包辦。', '想走鏢?鏢師與馬車都在這兒調度。', '馬匹餵足了,隨時可以上路。', '道路平安,商旅才會多。'] },
    hotspots: [{ id: 'cart', floor: '1F', at: [1, 3], act: { t: 'panel', id: 'caravan' }, label: '鏢車' }, { id: 'mailbox', floor: '2F', at: [7, 1], act: { t: 'talk', line: '各地送來的信函,按郡縣分格存放。' }, label: '信函格' }],
    people: { kind: 'workshop', max: 2, opts: { posts: ['trade'] } }, visitors: { n: [3, 6], jobs: ['escort', 'porter', 'vendor', 'guard', 'farmer', 'official'] },
    lines: ['這趟鏢要走多遠?', '一路上不太平,得多帶幾個人。', '馬累了,歇一晚再上路。'],
    lights: [{ floor: '1F', at: [1.5, 0.05], z: 50 }, { floor: '1F', at: [6.5, 0.05], z: 50 }, { floor: '1F', at: [0.05, 4.5], z: 50 }, { floor: '2F', at: [3, 0.05], z: 50 }, { floor: '2F', at: [6, 0.05], z: 50 }]
  };
})();

// ── 觀星臺(hun_tian / di_dong):渾天儀、天球、日晷、星圖案,太史令(開科技樹),日晷報時辰 ──
if (IP2_OK) (function () {
  IP2_SCENES.observatory = {
    id: 'observatory', name: '觀星臺', title: '觀星臺', bld: ['hun_tian', 'di_dong'], subKind: 'obs', p2: true,
    floors: [{ id: '1F', label: '靈台', grid: [8, 6] }, { id: '2F', label: '候氣閣', grid: [8, 4] }],
    pal: { wall: '#c9cbd6', floorA: '#80849a', floorB: '#767a90', floorEdge: '#4a4e64', beam: '#3a3e5a', beamDk: '#222640', cloth: '#2f3f8a', accent: '#e3c45c' },
    props: [
      ipP('shelfA', '1F', 'shelf', [0, 0], [3, 1], { items: 'scrolls', free: true }), ipP('shelfB', '1F', 'shelf', [5, 0], [2, 1], { items: 'books', free: true }),
      ipP('armil', '1F', 'block', [3, 1], [2, 2], { dyn: true, col: 'woodDk', h: 8, deco: 'ring' }), ipP('globe', '1F', 'blk2', [6, 1], [1, 1], { dyn: true, col: 'woodDk', h: 6, deco: 'globe' }),
      ipP('sundial', '1F', 'blk2', [6, 3], [1, 1], { dyn: true, col: 'stone', h: 5, deco: 'sundial' }), ipP('chart', '1F', 'blk2', [1, 3], [2, 1], { dyn: true, col: 'woodDk', h: 10, deco: 'chart' }),
      ipP('rug', '1F', 'rug', [2, 3], [4, 2.6], { free: true }), ipP('plant1', '1F', 'plant', [7, 1]), ipP('plant2', '1F', 'plant', [0, 5]),
      ipP('sign1', '1F', 'sign', [3, 0], [2, 1], { axis: 'x', label: '觀星臺', free: true }), ipP('win1', '1F', 'window', [0, 3], [2, 1], { axis: 'y', free: true }), ipP('stairs1', '1F', 'stairs', [0, 1], [1, 2]),
      ipP('shelf2', '2F', 'shelf', [1, 0], [6, 1], { items: 'scrolls', free: true }), ipP('chart2', '2F', 'blk2', [2, 1], [2, 1], { dyn: true, col: 'woodDk', h: 10, deco: 'chart' }),
      ipP('chart3', '2F', 'blk2', [5, 2], [2, 1], { dyn: true, col: 'woodDk', h: 10, deco: 'chart' }), ipP('rug2', '2F', 'rug', [1.5, 2], [5, 1.4], { free: true }),
      ipP('stairs2', '2F', 'stairs', [0, 1], [1, 2]), ipP('rail2', '2F', 'railing', [0, 0], [1, 1], { free: true }), ipP('plant3', '2F', 'plant', [7, 1])
    ],
    slots: [ipSlot('1F', [2, 2], 0, 'p'), ipSlot('1F', [5, 2], 3, 'p'), ipSlot('1F', [1, 5], 0, 'p'),
      ipSlot('1F', [4, 4], 0, 'v'), ipSlot('1F', [6, 5], 3, 'v'), ipSlot('1F', [2, 4], 0, 'v'), ipSlot('2F', [2, 0], 0, 'v', { sit: true }), ipSlot('2F', [3, 0], 0, 'v', { sit: true }), ipSlot('2F', [4, 3], 0, 'v')],
    keeper: { name: '太史令', floor: '1F', at: [3, 3], look: { job: 'scholar', key: 41, head: 'scarf', headCol: '#d8d4e8', tunic: '#2f3f7a', trim: '#e3c45c' }, act: { t: 'panel', id: 'tech' },
      lines: ['天象有變,下官已記入星曆。', '仰觀天文,俯察地理。', '研發的序列,可在此調整。', '日月星辰運行有序,預知方能防患。'] },
    hotspots: [{ id: 'armil', floor: '1F', at: [3, 1], act: { t: 'info', fn: 'tech' }, label: '渾天儀' }, { id: 'sundial', floor: '1F', at: [6, 3], act: { t: 'info2', fn: 'hour' }, label: '日晷' },
      { id: 'chart2', floor: '2F', at: [2, 1], act: { t: 'talk', line: '星圖上的每顆星,都有名字與方位。' }, label: '星圖' }],
    people: { kind: 'workshop', max: 3, opts: { posts: ['study'] } }, visitors: { n: [1, 3], jobs: ['scholar', 'elder', 'official'] },
    lines: ['今晚的星象好清楚。', '據說彗星出現,是有大事將至。', '天上的事,我是看不太懂。'],
    lights: [{ floor: '1F', at: [1.5, 0.05], z: 50 }, { floor: '1F', at: [6, 0.05], z: 50 }, { floor: '1F', at: [0.05, 4], z: 50 }, { floor: '2F', at: [2.5, 0.05], z: 50 }, { floor: '2F', at: [6, 0.05], z: 50 }]
  };
})();

var IP2_IDS = Object.keys(IP2_SCENES);

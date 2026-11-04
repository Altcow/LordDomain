// js/interiors_pack1_data.js — 室內空間第一批資料(PLAN_INTERIORS §5.1 第 3~7 項):議事廳 / 研究院 / 工坊(鐵 / 織 / 窯)/ 客棧 / 縣衙大堂。純資料,不碰 DOM / world。
// 場景引擎在 interior.js,第一批邏輯(人物、熱點、進入掛點)在 interiors_pack1.js。每個場景皆兩層(直版上下疊、橫版左右並排)。
// 格式:{ id, name, bld:[建築 type], floors, props, slots, keeper, hotspots, people:{kind,max,opts}, visitors:{n:[min,max],jobs}, lines, subKind, pal, lights }
//   slots:人物站位 {floor,at,face,role:'p'(名冊人物)|'v'(路人),sit:bool,z?}  sit 的站位會自動生成椅凳(seats);
//   act:{t:'panel',id:'lordhall'|'tech'|'goods'|'chain',arg?} | {t:'info',fn} | {t:'story'} | {t:'talk',line}
// 全域名稱:IP_EXTRA IP_SCENES IP_BLD IP_LINES_PERSON IP_CFG
// 風格色票沿用 tavern_data.js 的 TAVERN_PALS(缺則退回內建最小色票)。

var IP_CFG = { bucketMs: 600000, bubbleOn: 5.5, bubbleCycle: 9, tapBubbleSec: 2.6, maxDyn: 15, hours: { dayFrom: 6, duskFrom: 17, nightFrom: 20 } };

// 各場景共用的額外色(書、布、金屬、火)
var IP_EXTRA = {
  stone: '#8f8a7c', metal: '#4a4c52', metalLt: '#8a8e96', fire: '#ff8a3a', fireLt: '#ffd36a', clay: '#b0603a',
  books: ['#7a3a2a', '#2f5a7a', '#3f6a3a', '#b88a2a', '#5a3a6a', '#8a4a3a'], silk: ['#b8332a', '#2f6a8a', '#d9a53a', '#4a8a5a', '#8a4a8a', '#e8e0c8'],
  pots: ['#a8692f', '#7a5a3a', '#b0603a', '#8a7a62'], goods: ['#b5753a', '#8a5a2a', '#d9a566', '#7a4a24']
};

// 建築 type → 場景 id(mod = 附帶參數)
var IP_BLD = {
  palace: { id: 'council' }, research: { id: 'research' }, inn: { id: 'inn' }, xian_ya: { id: 'court' },
  smith_awning: { id: 'work_smith' }, smithy: { id: 'work_smith' }, shui_pai: { id: 'work_smith' },
  loom_shop: { id: 'work_loom' }, shop_cloth: { id: 'work_loom' }, jin_fang: { id: 'work_loom' },
  pottery: { id: 'work_kiln' }, ci_yao: { id: 'work_kiln' }
};

// 名冊人物被點到時的台詞(依職司 id;缺則用 _)。{n} = 人物姓名
var IP_LINES_PERSON = {
  gov: ['城中大小事,都在下官案上。', '大人,近來政務一切順遂。'], police: ['城內治安無虞,大人放心。', '宵小之輩,下官絕不輕縱。'],
  study: ['書卷未盡,不敢懈怠。', '近日讀到好句,頗有所得。'], iron: ['火候最要緊,差一分都不行。', '這批鐵器,保管耐用。'],
  loom: ['這匹布的紋樣,是新學的。', '梭來梭往,日子也就織過去了。'], craft: ['木石各有脾性,得順著來。', '這活兒,急不得。'],
  farm: ['今年的收成,看來不差。'], trade: ['買賣和氣生財。'], med: ['對症下藥,方能見效。'], _: ['大人安好。', '有事請吩咐。']
};

function ipP(id, floor, kind, at, size, ex) { var o = { id: id, floor: floor, kind: kind, at: at, size: size || [1, 1] }, k; if (ex) for (k in ex) o[k] = ex[k]; return o; }
function ipSlot(floor, at, face, role, ex) { var o = { floor: floor, at: at, face: face, role: role }, k; if (ex) for (k in ex) o[k] = ex[k]; return o; }

// 通用「雙排案席」大堂(議事廳 / 研究院 / 縣衙共用骨架):四張側案 + 四個案前座位
function ipDeskRows(prefix) {
  return {
    props: [ipP(prefix + 'd1', '1F', 'block', [1, 3], [1, 1], { dyn: true, col: 'woodDk', h: 11, deco: 'paper' }), ipP(prefix + 'd2', '1F', 'block', [6, 3], [1, 1], { dyn: true, col: 'woodDk', h: 11, deco: 'paper' }),
      ipP(prefix + 'd3', '1F', 'block', [1, 5], [1, 1], { dyn: true, col: 'woodDk', h: 11, deco: 'books' }), ipP(prefix + 'd4', '1F', 'block', [6, 5], [1, 1], { dyn: true, col: 'woodDk', h: 11, deco: 'books' })],
    slots: [ipSlot('1F', [1, 2], 0, 'p', { sit: true }), ipSlot('1F', [6, 2], 0, 'p', { sit: true }), ipSlot('1F', [1, 4], 0, 'p', { sit: true }), ipSlot('1F', [6, 4], 0, 'p', { sit: true })]
  };
}
function ipMerge(base, extra) { return { props: base.props.concat(extra.props), slots: base.slots.concat(extra.slots) }; }

var IP_SCENES = {};

// ── 議事廳(城主府 palace):太守高台、四曹席、縣丞(開城主府面板)、公文櫃(派工) ──
(function () {
  var rows = ipDeskRows('c');
  IP_SCENES.council = {
    id: 'council', name: '議事廳', title: '城主府議事廳', bld: ['palace'], subKind: 'council',
    floors: [{ id: '1F', label: '正堂', grid: [8, 6] }, { id: '2F', label: '文書房', grid: [8, 4] }],
    pal: { wall: '#e3d5b0', floorA: '#b9b2a2', floorB: '#aaa392', floorEdge: '#756e60', cloth: '#8c2a22' },
    props: rows.props.concat([
      ipP('rug', '1F', 'rug', [2, 1.6], [4, 4.2], { free: true }), ipP('dais', '1F', 'block', [2, 0], [4, 1], { col: 'woodLt', h: 5 }),
      ipP('bench', '1F', 'block', [3, 1], [2, 1], { dyn: true, col: 'woodDk', h: 10, deco: 'seal' }),
      ipP('files', '1F', 'block', [6, 0], [1, 1], { dyn: true, col: 'woodDk', h: 26, deco: 'books' }),
      ipP('plant1', '1F', 'plant', [7, 1]), ipP('plant2', '1F', 'plant', [0, 5]), ipP('plant3', '1F', 'plant', [7, 4]),
      ipP('sign1', '1F', 'sign', [1.4, 0], [3, 1], { axis: 'x', label: '議事廳', free: true }), ipP('win1', '1F', 'window', [0, 2], [2, 1], { axis: 'y', free: true }),
      ipP('banner1', '1F', 'banner', [0.3, 0.3], [1, 1], { label: '政', free: true }),
      ipP('shelfA', '2F', 'shelf', [1, 0], [3, 1], { items: 'scrolls', free: true }), ipP('shelfB', '2F', 'shelf', [5, 0], [2, 1], { items: 'books', free: true }),
      ipP('desk2', '2F', 'block', [2, 1], [3, 1], { dyn: true, col: 'woodDk', h: 10, deco: 'paper' }), ipP('arch', '2F', 'block', [6, 2], [1, 1], { dyn: true, col: 'wood', h: 14, deco: 'crate' }),
      ipP('rug2', '2F', 'rug', [1.5, 2], [5, 1.6], { free: true }), ipP('stairs2', '2F', 'stairs', [0, 1], [1, 2]), ipP('stairs1', '1F', 'stairs', [0, 1], [1, 2]),
      ipP('plant4', '2F', 'plant', [7, 1]), ipP('rail2', '2F', 'railing', [0, 0], [1, 1], { free: true })
    ]),
    slots: rows.slots.concat([
      ipSlot('1F', [3, 0], 0, 'g', { z: 5, gov: true }),                                                   // 太守:站高台(有太守名冊人物才出現)
      ipSlot('1F', [4, 4], 3, 'v'), ipSlot('1F', [3, 5], 0, 'v'), ipSlot('1F', [5, 4], 0, 'v'),
      ipSlot('2F', [2, 0], 0, 'v', { sit: true }), ipSlot('2F', [3, 0], 0, 'v', { sit: true })
    ]),
    keeper: { name: '縣丞', floor: '1F', at: [3, 3], look: { job: 'official', key: 7, head: 'hat', headCol: '#2f4a6a', tunic: '#3a5a8a', trim: '#f4ead2' }, act: { t: 'panel', id: 'lordhall', arg: 'job' },
      lines: ['大人,今日待辦各曹都已列好。', '派工的事,交給下官便是。', '各曹席位,誰在其位一目了然。', '城中官階與人口,下官隨時稟報。'] },
    hotspots: [{ id: 'files', floor: '1F', at: [6, 0], act: { t: 'panel', id: 'lordhall', arg: 'ov' }, label: '公文櫃' }, { id: 'arch', floor: '2F', at: [6, 2], act: { t: 'talk', line: '歷年簿冊分門別類,都收在此。' }, label: '檔案箱' }],
    people: { kind: 'council', max: 5 }, visitors: { n: [2, 4], jobs: ['farmer', 'vendor', 'scholar', 'elder', 'official'] },
    lines: ['大人,小民有事稟報。', '聽說今年賦稅有調整?', '求大人做主。'],
    lights: [{ floor: '1F', at: [1, 0.05], z: 50 }, { floor: '1F', at: [6.5, 0.05], z: 50 }, { floor: '1F', at: [0.05, 4], z: 50 }, { floor: '2F', at: [2.5, 0.05], z: 50 }, { floor: '2F', at: [6, 0.05], z: 50 }]
  };
})();

// ── 研究院(research):渾天儀、書架、學官案席、主事(開科技樹) ──
(function () {
  var rows = ipDeskRows('r');
  IP_SCENES.research = {
    id: 'research', name: '研究院', title: '研究院', bld: ['research'], subKind: 'research',
    floors: [{ id: '1F', label: '觀象閣', grid: [8, 6] }, { id: '2F', label: '藏書樓', grid: [8, 4] }],
    pal: { wall: '#d6d0bc', floorA: '#8e8c96', floorB: '#82808c', floorEdge: '#5a5864', beam: '#4a4458', beamDk: '#2f2b3a', cloth: '#2f4f8a' },
    props: rows.props.concat([
      ipP('armil', '1F', 'block', [3, 1], [2, 2], { dyn: true, col: 'woodDk', h: 8, deco: 'ring' }), ipP('shelfA', '1F', 'shelf', [0, 0], [3, 1], { items: 'books', free: true }), ipP('shelfB', '1F', 'shelf', [5, 0], [3, 1], { items: 'scrolls', free: true }),
      ipP('rug', '1F', 'rug', [2, 3], [4, 2.8], { free: true }), ipP('plant1', '1F', 'plant', [0, 5]), ipP('plant2', '1F', 'plant', [7, 1]),
      ipP('sign1', '1F', 'sign', [3.4, 0], [1.4, 1], { axis: 'x', label: '研究院', free: true }), ipP('win1', '1F', 'window', [0, 2], [2, 1], { axis: 'y', free: true }),
      ipP('stairs1', '1F', 'stairs', [0, 1], [1, 2]),
      ipP('shelf2', '2F', 'shelf', [1, 0], [6, 1], { items: 'books', free: true }), ipP('tbl2a', '2F', 'block', [2, 1], [2, 1], { dyn: true, col: 'wood', h: 10, deco: 'books' }), ipP('tbl2b', '2F', 'block', [5, 2], [2, 1], { dyn: true, col: 'wood', h: 10, deco: 'paper' }),
      ipP('stairs2', '2F', 'stairs', [0, 1], [1, 2]), ipP('rail2', '2F', 'railing', [0, 0], [1, 1], { free: true }), ipP('plant3', '2F', 'plant', [7, 1])
    ]),
    slots: rows.slots.concat([ipSlot('1F', [2, 4], 3, 'v'), ipSlot('1F', [5, 4], 0, 'v'), ipSlot('2F', [2, 0], 0, 'v', { sit: true }), ipSlot('2F', [3, 0], 0, 'v', { sit: true }), ipSlot('2F', [5, 1], 0, 'v', { sit: true })]),
    keeper: { name: '主事學者', floor: '1F', at: [3, 3], look: { job: 'scholar', key: 11, head: 'scarf', headCol: '#e8e0c8', tunic: '#2f4a7a', trim: '#e3b95c' }, act: { t: 'panel', id: 'tech' },
      lines: ['研發的序列,可隨時調整。', '渾天儀轉一圈,又多算出幾分天機。', '大人要看哪一路的學問?', '人才派進研究院,研發自然快些。'] },
    hotspots: [{ id: 'armil', floor: '1F', at: [3, 1], act: { t: 'info', fn: 'tech' }, label: '渾天儀' }],
    people: { kind: 'workshop', max: 4, opts: { posts: ['study'] } }, visitors: { n: [2, 4], jobs: ['scholar', 'scholar', 'official', 'elder'] },
    lines: ['這道算題困了我三日。', '書中自有黃金屋。', '再給我些學識,能研的更多。'],
    lights: [{ floor: '1F', at: [1.5, 0.05], z: 50 }, { floor: '1F', at: [6, 0.05], z: 50 }, { floor: '1F', at: [0.05, 4], z: 50 }, { floor: '2F', at: [2.5, 0.05], z: 50 }, { floor: '2F', at: [6, 0.05], z: 50 }]
  };
})();

// ── 工坊(鐵 / 織 / 窯):共用骨架,換工具與色票;坊主開庫房鏈條,貨堆開庫房 ──
(function () {
  function mk(id, name, bld, main, side, shelf, wall, floor, keeperLook, lines, posts, jobs) {
    IP_SCENES[id] = {
      id: id, name: name, title: name, bld: bld, subKind: 'work',
      floors: [{ id: '1F', label: '工坊', grid: [8, 6] }, { id: '2F', label: '貨樓', grid: [8, 4] }],
      pal: { wall: wall, floorA: floor[0], floorB: floor[1], floorEdge: '#5e5648', beam: '#5a4030', beamDk: '#3a2818' },
      props: [
        ipP('shelf1', '1F', 'shelf', [0, 0], [3, 1], { items: shelf, free: true }), ipP('main', '1F', 'block', [4, 0], [2, 1], { dyn: true, col: main[0], h: main[1], deco: main[2] }),
        ipP('side', '1F', 'block', [1, 2], [1, 1], { dyn: true, col: side[0], h: side[1], deco: side[2] }), ipP('crates', '1F', 'block', [6, 2], [1, 1], { dyn: true, col: 'wood', h: 13, deco: 'crate' }),
        ipP('bench2', '1F', 'block', [4, 4], [2, 1], { dyn: true, col: 'woodDk', h: 9, deco: 'paper' }),
        ipP('rug', '1F', 'rug', [2.4, 2.6], [3.2, 2.6], { free: true }), ipP('plant1', '1F', 'plant', [7, 1]), ipP('plant2', '1F', 'plant', [0, 5]),
        ipP('sign1', '1F', 'sign', [3, 0], [1, 1], { axis: 'x', label: name.slice(0, 2), free: true }), ipP('win1', '1F', 'window', [0, 3], [2, 1], { axis: 'y', free: true }),
        ipP('stairs1', '1F', 'stairs', [0, 1], [1, 1]),
        ipP('shelf2', '2F', 'shelf', [1, 0], [7, 1], { items: 'goods', free: true }), ipP('stock1', '2F', 'block', [1, 1], [2, 1], { dyn: true, col: 'wood', h: 14, deco: 'crate' }), ipP('stock2', '2F', 'block', [5, 1], [2, 1], { dyn: true, col: 'wood', h: 14, deco: 'crate' }),
        ipP('stairs2', '2F', 'stairs', [0, 1], [1, 1]), ipP('rail2', '2F', 'railing', [0, 0], [1, 1], { free: true }), ipP('plant3', '2F', 'plant', [7, 3])
      ],
      slots: [ipSlot('1F', [4, 1], 0, 'p'), ipSlot('1F', [5, 1], 3, 'p'), ipSlot('1F', [2, 2], 3, 'p'), ipSlot('1F', [5, 3], 0, 'p'),
        ipSlot('1F', [7, 4], 0, 'v'), ipSlot('1F', [2, 5], 3, 'v'), ipSlot('2F', [3, 2], 0, 'v')],
      keeper: { name: '坊主', floor: '1F', at: [3, 3], look: keeperLook, act: { t: 'panel', id: 'chain' }, lines: lines },
      hotspots: [{ id: 'crates', floor: '1F', at: [6, 2], act: { t: 'panel', id: 'goods' }, label: '貨堆' }, { id: 'stock1', floor: '2F', at: [1, 1], act: { t: 'panel', id: 'goods' }, label: '庫存' }],
      people: { kind: 'workshop', max: 4, opts: { posts: posts } }, visitors: { n: [1, 3], jobs: jobs },
      lines: ['這批貨,什麼時候交?', '聽說這裡的手藝是一絕。', '東西結實,價錢也公道。'],
      lights: [{ floor: '1F', at: [1.5, 0.05], z: 50 }, { floor: '1F', at: [6.5, 0.05], z: 50 }, { floor: '1F', at: [0.05, 4.5], z: 50 }, { floor: '2F', at: [3, 0.05], z: 50 }, { floor: '2F', at: [6, 0.05], z: 50 }]
    };
  }
  mk('work_smith', '冶鐵坊', ['smith_awning', 'smithy', 'shui_pai'], ['stone', 18, 'fire'], ['metal', 9, 'anvil'], 'tools', '#cdbfa6', ['#8c8478', '#7e776c'],
    { job: 'smith', key: 5, head: 'scarf', headCol: '#5a4a3a', tunic: '#6a4a3a', trim: '#d9d2c0' }, ['火要旺,鐵要勤打。', '大人要的鐵器,快好了。', '缺了礦料,爐子也只能乾燒。', '要看原料夠不夠,請去庫房。'], ['iron', 'craft'], ['porter', 'farmer', 'guard', 'vendor']);
  mk('work_loom', '織坊', ['loom_shop', 'shop_cloth', 'jin_fang'], ['wood', 22, 'loom'], ['wood', 14, 'loom'], 'bolts', '#e6d6b8', ['#c9a878', '#bd9c6c'],
    { job: 'woman', key: 9, head: 'woman', headCol: '#6a3a4a', tunic: '#a8454a', trim: '#f4ead2' }, ['梭來梭往,一天能織一丈。', '麻要先績,布才細密。', '大人要的衣料,正在趕工。', '缺了麻,織機也停不得。'], ['loom', 'craft'], ['woman', 'vendor', 'noble', 'elder']);
  mk('work_kiln', '陶窯', ['pottery', 'ci_yao'], ['clay', 20, 'kiln'], ['clay', 8, 'wheel'], 'pots', '#d9c4a0', ['#b09a78', '#a48e6c'],
    { job: 'artist', key: 3, head: 'hat', headCol: '#8a6a3a', tunic: '#8a6a4a', trim: '#e8dcb0' }, ['火候差一分,整窯就廢。', '這批陶罐,都是現燒的。', '黏土要揉透,才不裂。', '要看原料夠不夠,請去庫房。'], ['craft'], ['vendor', 'farmer', 'porter', 'elder']);
})();

// ── 客棧(inn):大堂旅人、掌櫃(聽路人故事)、二樓客房 ──
(function () {
  var props = [
    ipP('counter', '1F', 'counter', [1, 1], [3, 1], { dyn: true }), ipP('jars', '1F', 'jars', [5, 0], [2, 1]), ipP('kitchen', '1F', 'kitchen', [7, 0], [1, 1]), ipP('stairs1', '1F', 'stairs', [0, 1], [1, 2]),
    ipP('plant1', '1F', 'plant', [7, 1]), ipP('plant2', '1F', 'plant', [7, 5]), ipP('sign1', '1F', 'sign', [1.6, 0], [2.4, 1], { axis: 'x', label: '悅來客棧', free: true }),
    ipP('win1', '1F', 'window', [0, 3], [2, 1], { axis: 'y', free: true }), ipP('banner1', '1F', 'banner', [0.3, 0.3], [1, 1], { label: '宿', free: true }),
    ipP('rug2', '2F', 'rug', [1.5, 1.6], [5, 1.6], { free: true }), ipP('doorA', '2F', 'door', [1, 0], [2, 1], { label: '天' }), ipP('doorB', '2F', 'door', [3, 0], [2, 1], { label: '地' }), ipP('doorC', '2F', 'door', [5, 0], [2, 1], { label: '人' }),
    ipP('stairs2', '2F', 'stairs', [0, 1], [1, 2]), ipP('plant3', '2F', 'plant', [7, 1]), ipP('rail2', '2F', 'railing', [0, 0], [1, 1], { free: true })
  ], slots = [], tb = [[3, 3], [6, 3], [3, 5], [6, 5]];
  tb.forEach(function (t, i) {
    props.push(ipP('tbl' + i, '1F', 'table', [t[0], t[1]], [1, 1], { dyn: true }));
    slots.push(ipSlot('1F', [t[0] - 1, t[1]], 3, i < 2 ? 'p' : 'v', { sit: true }), ipSlot('1F', [t[0], t[1] - 1], 0, 'v', { sit: true }));
  });
  slots.push(ipSlot('2F', [2, 2], 0, 'v'), ipSlot('2F', [5, 2], 3, 'v'));
  IP_SCENES.inn = {
    id: 'inn', name: '悅來客棧', title: '悅來客棧', bld: ['inn'], subKind: 'inn',
    floors: [{ id: '1F', label: '大堂', grid: [8, 6] }, { id: '2F', label: '客房', grid: [8, 4] }],
    pal: { wall: '#ead9b4', floorA: '#c4a070', floorB: '#b89466' },
    props: props, slots: slots,
    keeper: { name: '店家', floor: '1F', at: [2, 0], look: { job: 'vendor', key: 21, head: 'hat', headCol: '#6a4a2a', tunic: '#8a5a2a', trim: '#f4ead2' }, act: { t: 'story' },
      lines: ['客官住店?上房還有空。', '路上的新鮮事,小店最清楚。', '來碗熱湯,歇歇腳。', '商旅來來往往,都愛在此落腳。'] },
    hotspots: [{ id: 'doorA', floor: '2F', at: [2, 1], act: { t: 'talk', line: '房內的旅人睡得正沉。' }, label: '客房' }],
    people: { kind: 'tavern', max: 3 }, visitors: { n: [4, 8], jobs: ['vendor', 'porter', 'escort', 'farmer', 'scholar', 'artist', 'guard', 'doctor', 'woman'] },
    lines: ['一路風塵,終於有個落腳處。', '聽說前面路不太平。', '這裡的熱湯真不錯。'],
    stories: ['旅人說:「北邊路上遇到一支商隊,駱駝多得數不清。」', '行腳商說:「聽說西邊新開了一座集市,貨色很全。」', '老客說:「前陣子山道落石,繞了三天才到。」',
      '書生說:「我在路上聽人傳唱一首新曲,調子很特別。」', '鏢師說:「近來道上平靜,許多客人都敢走夜路了。」', '郎中說:「入秋後天乾,可得提防疫病。」'],
    lights: [{ floor: '1F', at: [1, 0.05], z: 50 }, { floor: '1F', at: [4.5, 0.05], z: 50 }, { floor: '1F', at: [0.05, 3.5], z: 50 }, { floor: '2F', at: [2.5, 0.05], z: 50 }, { floor: '2F', at: [6, 0.05], z: 50 }]
  };
})();

// ── 縣衙大堂(xian_ya):高台、公案、衙役、鳴冤鼓、賊曹側案、主簿(審案台詞) ──
(function () {
  var rows = ipDeskRows('x');
  IP_SCENES.court = {
    id: 'court', name: '縣衙大堂', title: '縣衙大堂', bld: ['xian_ya'], subKind: 'court',
    floors: [{ id: '1F', label: '大堂', grid: [8, 6] }, { id: '2F', label: '卷宗庫', grid: [8, 4] }],
    pal: { wall: '#d8cdb4', floorA: '#9c9a92', floorB: '#8e8c84', floorEdge: '#6a685f', beam: '#3a3028', beamDk: '#241c16', cloth: '#2a2623', accent: '#d9b23c' },
    props: rows.props.concat([
      ipP('dais', '1F', 'block', [2, 0], [4, 1], { col: 'woodLt', h: 6 }), ipP('bench', '1F', 'block', [3, 1], [2, 1], { dyn: true, col: 'woodDk', h: 12, deco: 'seal' }),
      ipP('drum', '1F', 'block', [7, 1], [1, 1], { dyn: true, col: 'woodDk', h: 6, deco: 'drum' }), ipP('rug', '1F', 'rug', [2.6, 2.4], [2.8, 3.4], { free: true }),
      ipP('plant1', '1F', 'plant', [0, 5]), ipP('plant2', '1F', 'plant', [7, 5]),
      ipP('sign1', '1F', 'sign', [2.2, 0], [3.6, 1], { axis: 'x', label: '明鏡高懸', free: true }), ipP('banner1', '1F', 'banner', [0.3, 0.3], [1, 1], { label: '衙', free: true }),
      ipP('stairs1', '1F', 'stairs', [0, 1], [1, 2]),
      ipP('shelf2', '2F', 'shelf', [1, 0], [6, 1], { items: 'scrolls', free: true }), ipP('desk2', '2F', 'block', [2, 1], [3, 1], { dyn: true, col: 'woodDk', h: 10, deco: 'paper' }), ipP('arch', '2F', 'block', [6, 2], [1, 1], { dyn: true, col: 'wood', h: 14, deco: 'crate' }),
      ipP('stairs2', '2F', 'stairs', [0, 1], [1, 2]), ipP('rail2', '2F', 'railing', [0, 0], [1, 1], { free: true }), ipP('plant3', '2F', 'plant', [7, 1])
    ]),
    slots: rows.slots.concat([
      ipSlot('1F', [2, 2], 0, 'v', { job: 'guard' }), ipSlot('1F', [5, 1], 3, 'v', { job: 'guard' }), ipSlot('1F', [3, 4], 0, 'v', { job: 'farmer', kneel: true }), ipSlot('1F', [4, 5], 3, 'v', { job: 'vendor' }),
      ipSlot('2F', [2, 0], 0, 'v', { sit: true, job: 'official' }), ipSlot('2F', [3, 0], 0, 'v', { sit: true, job: 'scholar' })
    ]),
    keeper: { name: '主簿', floor: '1F', at: [4, 2], look: { job: 'official', key: 13, head: 'hat', headCol: '#2a2623', tunic: '#2f3a5a', trim: '#d9b23c' }, act: { t: 'case' },
      lines: ['升堂!帶人犯。', '依律斷案,不枉不縱。', '大人,今日有兩件小案待決。', '鳴冤鼓一響,必有人伸冤。'] },
    hotspots: [{ id: 'drum', floor: '1F', at: [7, 1], act: { t: 'talk', line: '鼓聲咚咚,百姓有冤皆可擊鼓。' }, label: '鳴冤鼓' }, { id: 'arch', floor: '2F', at: [6, 2], act: { t: 'talk', line: '卷宗按年份編號,查案一翻便得。' }, label: '卷宗' }],
    people: { kind: 'workshop', max: 4, opts: { posts: ['police'] } }, visitors: { n: [2, 4], jobs: ['farmer', 'vendor', 'guard'] },
    lines: ['大人明察!', '小民冤枉啊。', '這案子拖了好些日子。'],
    cases: ['兩戶鄰人爭一條田埂,各執一詞。主簿建議:「各讓三尺,立界石為記。」', '商販被指短斤少兩。主簿建議:「當堂校秤,若實,罰錢三百。」', '失物招領:一頭走失的耕牛已尋回。主簿建議:「公告三日,無人認領則歸還原主。」',
      '兩村為灌溉輪序爭執。主簿建議:「按田畝比例輪灌,立木牌公示。」'],
    lights: [{ floor: '1F', at: [1, 0.05], z: 50 }, { floor: '1F', at: [6.5, 0.05], z: 50 }, { floor: '1F', at: [0.05, 4], z: 50 }, { floor: '2F', at: [2.5, 0.05], z: 50 }, { floor: '2F', at: [6, 0.05], z: 50 }]
  };
})();

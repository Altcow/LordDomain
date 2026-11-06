// worldpacks.js — 「世界風格」資料與旗幟繪製(建立新世界 / 重新開始精靈 js/worldwizard.js 用;PLAN_WORLDS §4 的 pack = {id, ver:1})。
// 一個風格 = 一個城市風格主題 id(theme_skin.js 的 THEME_SKINS,純外觀、不改數值);順序與 THEME_ORDER 一致。
// 欄位:id / name / sub(副標)/ intro(世界簡介 ≤ 90 字,古風口語,守 PLAN_ETHNIC §0.2:不使用貶抑稱呼)/ buildings(代表建築的 EXT_SPRITES id,圖 = assets/buildings/<id>_L.webp)
//   / buildingsPending(true = 尚無該風格專屬外部圖,以相近建築加風格色票代替,待補圖)/ people([{id, name, src}],src 為頭像路徑,缺圖回退剪影)
//   / flag({shape, pat, c: 旗色列表(不得有文字)})/ feats(3 條:起手建築、特色或限制、適合玩法)/ tpl(建議起手範本 id,可為 '')。
// 旗幟:flagPixels 逐像素確定性計算(同輸入同輸出,可在 node 測試);flagDraw 只負責貼到 canvas。靜態飄動波形,不做動畫。ES2017;不用 ?. ??
var WORLD_PACK_VER = 1;
var WORLD_PACK_DEFAULT = 'han';
var WORLD_PACKS = [
  { id: 'han', name: '東漢 · 中原', sub: '夯土 · 青瓦 · 市井人家',
    intro: '洛陽城外阡陌縱橫,夯土為牆、青瓦蓋頂,市井裡人聲熱鬧。從一座小村落起家,修路築倉、開市設學,慢慢把日子過成天下人都想來的樣子。',
    buildings: ['house_tile', 'xian_ya', 'inn', 'tavern'], buildingsPending: false,
    people: [{ id: 'caocao', name: '曹操', src: 'assets/portraits/caocao.webp' }, { id: 'guanyu', name: '關羽', src: 'assets/portraits/guanyu.webp' }, { id: 'zhugeliang', name: '諸葛亮', src: 'assets/portraits/zhugeliang.webp' }],
    flag: { shape: 'rect', pat: 'ring', c: ['#a8342a', '#e3b95c'] },
    feats: ['起手建築:瓦頂民房、縣衙、客棧、酒肆', '特色:預設外觀,各類建築與科技樣式最完整', '適合:穩紮穩打、重經濟與城市規劃的玩法'], tpl: '' },
  { id: 'bei', name: '塞北 · 氈帳草原', sub: '氈帳 · 土坯 · 馬背牧場',
    intro: '并涼幽邊郡風大草長,氈帳、土坯屋與塢堡錯落,牧馬人與漢戶互市往來。這裡的日子隨水草轉,視野開闊,別有一番自在。',
    buildings: ['s5_yurt', 's5_adobe', 's5_wubao'], buildingsPending: false,
    people: [{ id: 'yufuluo', name: '於夫羅', src: 'assets/portraits/yufuluo.webp' }, { id: 'gongsunzan', name: '公孫瓚', src: 'assets/portraits/gongsunzan.webp' }],
    flag: { shape: 'swallow', pat: 'arrow3', c: ['#a8542c', '#c89a4a'] },
    feats: ['起手建築:氈帳、土坯屋、塢堡', '特色:純外觀風格,部分民房換成氈帳與土坯樣式,數值不變', '適合:喜歡邊塞氣氛、牧場與馬匹佈局的玩法'], tpl: '' },
  { id: 'xiyu', name: '西域 · 綠洲絲路', sub: '土坯平頂 · 藍綠釉 · 駝隊商旅',
    intro: '沙海邊上的綠洲,土坯平頂配藍綠釉瓦,駝隊載著絲綢與香料來去。商旅與樂人聚在市集,買賣與歌舞是這裡最熱鬧的光景。',
    buildings: ['s7_adobe_flat', 's7_vault', 's7_camel_yard', 's7_merchant_mansion'], buildingsPending: false,
    people: [{ id: 'shangcai_a', name: '商旅', src: 'assets/portraits/generic/shangcai_a.webp' }, { id: 'yuewu_a', name: '樂舞人', src: 'assets/portraits/generic/yuewu_a.webp' }],
    flag: { shape: 'pennant', pat: 'grape_diamond', c: ['#2f4f8a', '#f1ead8', '#e3b95c'] },
    feats: ['起手建築:土坯平頂屋、拱頂屋、駝站大院、商賈大宅', '特色:純外觀風格,數值不變;另有穹頂小廟、坎兒井口與市集拱廊大院', '適合:偏好商路與貿易氣氛的玩法'], tpl: '' },
  { id: 'nanman', name: '南國 · 水鄉澤國', sub: '竹木 · 高腳屋 · 茅頂水榭',
    intro: '溪水縱橫、竹木成林,高腳屋沿水而立,茅頂遮雨又通風。魚米豐足,與山外鹽布往來不斷,日子溫潤而安穩。',
    buildings: ['s3_stilt', 's3_tile', 's3_shuixie', 's3_riverside'], buildingsPending: false,
    people: [{ id: 'shamoke', name: '沙摩柯', src: 'assets/portraits/shamoke.webp' }, { id: 'shixie', name: '士燮', src: 'assets/portraits/shixie.webp' }, { id: 'youtu', name: '尤突', src: 'assets/portraits/youtu.webp' }],
    flag: { shape: 'rect', pat: 'stripe5', c: ['#c8452f', '#e3b95c', '#3f8a5a', '#2f6fa3', '#f4ead2'] },
    feats: ['起手建築:高腳屋、瓦頂水榭、臨水屋', '特色:純外觀風格,竹木茅頂樣式,數值不變', '適合:喜歡臨水佈局、綠意與漁米氣氛的玩法'], tpl: '' },
  { id: 'qiang', name: '羌氐 · 高原碉寨', sub: '石砌碉房 · 白氈黑邊 · 山谷牧耕',
    intro: '高原山谷間,石砌碉房依山而築,白氈與黑邊是族人愛用的記號。人們逐水草、種麥養羊、織布換糧,與涼州鄰里往來不絕。',
    buildings: ['s2_stone_house', 's2_felt_tent', 's2_stone_tower', 's2_zhai_manor'], buildingsPending: false,
    people: [{ id: 'mateng', name: '馬騰', src: 'assets/portraits/mateng.webp' }, { id: 'xumu_a', name: '牧人', src: 'assets/portraits/generic/xumu_a.webp' }, { id: 'nongshi_a', name: '農人', src: 'assets/portraits/generic/nongshi_a.webp' }],
    flag: { shape: 'rect', pat: 'felt_diamond', c: ['#cfc8b8', '#2a2623', '#9a4a32'] },
    feats: ['起手建築:石砌碉房、白氈黑邊帳、石砌碉樓、寨堡大宅', '特色:純外觀風格,數值不變;另有依山梯屋、石院、牲畜圍欄與白氈大帳院', '適合:喜歡山地、石砌與牧耕氣氛的玩法'], tpl: '' },
  // 魔幻三族(PLAN_FANTASY;外觀 + 科技樹 / 解鎖(PLAN_FANTASY_B B-1)+ 42 位傳說英雄(B-3,people = 各族三位英雄頭像 assets/portraits/fx/);事件文案待 B-4;與歷史風格互相隔離)
  { id: 'elf', name: '精靈 · 世界樹森林', sub: '活樹 · 白石 · 葉冠與藤橋', fantasy: true, tag: '魔幻世界',
    intro: '古老巨樹撐起整片森林,精靈把家蓋在樹幹、樹根與枝冠之間,只拾倒木、不砍活樹。林主長青守著世界樹,守林人、月光祭司與星歌詩人都會來你的酒館坐坐。',
    buildings: ['s8_treehouse', 's8_canopy_hall', 's8_moon_manor', 's8_world_tree'], buildingsPending: false,
    people: [{ id: 'elf_changqing', name: '長青', src: 'assets/portraits/fx/elf_changqing.webp' }, { id: 'elf_qinglan', name: '青嵐', src: 'assets/portraits/fx/elf_qinglan.webp' }, { id: 'elf_yueyao', name: '月瑤', src: 'assets/portraits/fx/elf_yueyao.webp' }],
    flag: { shape: 'rect', pat: 'leaf_arc', c: ['#5f9a4a', '#ece6d6', '#e4ef9a'] },
    feats: ['起手:樹屋、清泉石盆,研發到樹冠宅院、月光大宅與世界樹(地標限 1 座)', '特色:精靈科技樹(萌芽紀 → 世界樹紀)與 14 位傳說英雄;不可與歷史風格互換', '適合:森林、治療與謀略、有機曲線佈局'], tpl: 'tpl_elfgrove' },
  { id: 'dwarf', name: '矮人 · 鋼鐵礦城', sub: '方石 · 鋼鐵與銅 · 熔爐火光', fantasy: true, tag: '魔幻世界',
    intro: '山腹裡的工匠氏族沿著階梯礦坑往下挖,石牆守著山門,熔爐日夜不熄。山王磐山每天第一件事是去礦坑口數人,工匠、礦工與爐火祭司都在等你點名。',
    buildings: ['s9_rock_house', 's9_smelter', 's9_hall_manor', 's9_great_forge'], buildingsPending: false,
    people: [{ id: 'dw_panshan', name: '磐山', src: 'assets/portraits/fx/dw_panshan.webp' }, { id: 'dw_qianchui', name: '千錘', src: 'assets/portraits/fx/dw_qianchui.webp' }, { id: 'dw_maiya', name: '麥芽', src: 'assets/portraits/fx/dw_maiya.webp' }],
    flag: { shape: 'rect', pat: 'forge_chevron', c: ['#8a2e24', '#6f7880', '#c89a48'] },
    feats: ['起手:嵌岩石屋,研發到冶煉爐、氏族石院、山廳大宅與大熔爐殿(地標限 1 座)', '特色:矮人科技樹(星火紀 → 山心紀)與 14 位傳說英雄;不可與歷史風格互換', '適合:礦坑、工坊鏈與鐵壁防守'], tpl: 'tpl_dwarfhold' },
  { id: 'kingdom', name: '人類 · 王國城堡', sub: '石砌城堡 · 木骨白牆 · 紅藍旗', fantasy: true, tag: '魔幻世界',
    intro: '河谷高地上的石砌城堡守著一座城牆小鎮,年輕的國王昭明喜歡微服逛市集。騎士在營裡操練,白塔學士夜裡點燈,城外是風車、麥田與總是客滿的杏花酒館。',
    buildings: ['s10_cottage', 's10_market_row', 's10_manor', 's10_castle_keep'], buildingsPending: false,
    people: [{ id: 'kd_zhaoming', name: '昭明', src: 'assets/portraits/fx/kd_zhaoming.webp' }, { id: 'kd_lingfeng', name: '凌鋒', src: 'assets/portraits/fx/kd_lingfeng.webp' }, { id: 'kd_xinghua', name: '杏花', src: 'assets/portraits/fx/kd_xinghua.webp' }],
    flag: { shape: 'rect', pat: 'crown_quarter', c: ['#b23a32', '#2f5a9a', '#e3b95c'] },
    feats: ['起手:茅頂木骨屋,研發到市集街廊、騎士營、騎士莊園與王國城堡主堡(地標限 1 座)', '特色:王國科技樹(拓荒紀 → 傳說紀)與 14 位傳說英雄;不可與歷史風格互換', '適合:城牆、市集與騎士團、平衡發展'], tpl: 'tpl_kingdom' }
];

function worldPackIds() { return WORLD_PACKS.map(function (p) { return p.id; }); }
function worldPackHas(id) { return typeof id === 'string' && WORLD_PACKS.some(function (p) { return p.id === id; }); }
// 取風格資料;未知 id / 空值一律回漢
function worldPackGet(id) {
  var i;
  for (i = 0; i < WORLD_PACKS.length; i++) if (WORLD_PACKS[i].id === id) return WORLD_PACKS[i];
  return WORLD_PACKS[0];
}

// 建築縮圖路徑:優先用 EXT_SPRITES 登錄表,沒有登錄回 ''(呼叫端改畫回退圖示)
function worldPackBuildingSrc(id) {
  var e = (typeof EXT_SPRITES !== 'undefined' && EXT_SPRITES) ? EXT_SPRITES[id] : null;
  return e && e.L ? e.L : '';
}

// ───────── 旗幟(確定性逐像素,無外部圖、無文字) ─────────
var FLAG_POLE = '#5a3a22';
function flagHex(h) { var n = parseInt(String(h).slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function flagFrac(x) { return x - Math.floor(x); }

// 旗面 (X = 橫向以高為單位, Y = 0..1) 的顏色;回十六進位字串
function flagColorAt(f, X, Y, A) {
  var c = f.c, edge = Math.min(X, A - X, Y, 1 - Y), fx, fy, d, dc;
  if (f.pat === 'ring') {            // 漢:赤紅底、金邊、中央日輪
    dc = Math.sqrt((X - A / 2) * (X - A / 2) + (Y - 0.5) * (Y - 0.5));
    if (edge < 0.08) return c[1];
    if (dc < 0.1) return c[0];
    if (dc < 0.24) return c[1];
    return c[0];
  }
  if (f.pat === 'arrow3') {          // 北方:赭紅底 + 土黃三道箭羽狀橫條
    d = flagFrac((Y + 0.28 * Math.abs(X - A / 2) / A) * 3.2);
    return d > 0.3 && d < 0.62 ? c[1] : c[0];
  }
  if (f.pat === 'grape_diamond') {   // 西域:靛藍底、米白菱格、金色葡萄點
    fx = flagFrac(X / 0.5); fy = flagFrac(Y / 0.5);
    d = Math.abs(fx - 0.5) + Math.abs(fy - 0.5);
    if (d < 0.11) return c[2];
    if (Math.abs(d - 0.36) < 0.045) return c[1];
    return c[0];
  }
  if (f.pat === 'stripe5') {         // 南方:五色橫條
    return c[Math.min(c.length - 1, Math.floor(Y * c.length))];
  }
  if (f.pat === 'leaf_arc') {        // 精靈:葉綠底、白色同心弧形葉脈、嫩黃綠點
    d = Math.sqrt(X * X + (Y - 1) * (Y - 1)) / 0.42;
    fx = flagFrac(d);
    if (fx < 0.07) return c[2];
    if (Math.abs(fx - 0.55) < 0.07) return c[1];
    return c[0];
  }
  if (f.pat === 'forge_chevron') {   // 矮人:深紅底、鋼灰山形折線、銅點
    d = flagFrac((Y + 0.9 * Math.abs(X - A / 2)) * 3);
    if (d > 0.62 && d < 0.72) return c[2];
    return d > 0.18 && d < 0.5 ? c[1] : c[0];
  }
  if (f.pat === 'crown_quarter') {   // 人類:紅藍四分格、金色細邊(無紋章與文字)
    if (edge < 0.05 || Math.abs(X - A / 2) < 0.03 || Math.abs(Y - 0.5) < 0.03) return c[2];
    return ((X < A / 2) === (Y < 0.5)) ? c[0] : c[1];
  }
  // felt_diamond 羌氐:灰白氈底、黑邊、黑菱形連紋與赭點
  if (edge < 0.1) return c[1];
  fx = flagFrac(X / 0.5); fy = flagFrac(Y / 0.5);
  d = Math.abs(fx - 0.5) + Math.abs(fy - 0.5);
  if (d < 0.1) return c[2];
  if (d > 0.22 && d < 0.34) return c[1];
  return c[0];
}

// 回 RGBA Uint8ClampedArray(w*h*4);旗桿在左,旗面隨 x 有固定的波形位移與明暗,旗面外透明
function flagPixels(packId, w, h) {
  var p = worldPackGet(packId), f = p.flag, out = new Uint8ClampedArray(w * h * 4);
  var pole = Math.max(2, Math.round(w * 0.06)), amp = Math.max(1, h * 0.07), m = Math.ceil(amp) + 1;
  var fw = w - pole, fh = h - 2 * m, A = fw / fh, pc = flagHex(FLAG_POLE);
  var x, y, u, v, dy, sh, col, i, ph, notch, hv;
  if (fw < 4 || fh < 4) return out;
  for (x = 0; x < w; x++) {
    for (y = 0; y < h; y++) {
      i = (y * w + x) * 4;
      if (x < pole) { out[i] = pc[0]; out[i + 1] = pc[1]; out[i + 2] = pc[2]; out[i + 3] = 255; continue; }
      u = (x - pole + 0.5) / fw;
      ph = u * 5.2 + 0.4;
      dy = amp * Math.sin(ph) * (0.25 + 0.75 * u);
      v = (y + 0.5 - m - dy) / fh;
      if (v < 0 || v >= 1) continue;
      hv = Math.abs(2 * v - 1);
      if (f.shape === 'swallow') { notch = 1 - 0.28 * (1 - hv); if (u > notch) continue; }
      else if (f.shape === 'pennant') { if (hv > 1 - 0.9 * u) continue; }
      col = flagHex(flagColorAt(f, u * A, v, A));
      sh = 1 + 0.12 * Math.cos(ph);
      out[i] = Math.min(255, Math.round(col[0] * sh));
      out[i + 1] = Math.min(255, Math.round(col[1] * sh));
      out[i + 2] = Math.min(255, Math.round(col[2] * sh));
      out[i + 3] = 255;
    }
  }
  return out;
}

// 把旗幟畫到 canvas;不支援 2D / ImageData 時回 false(呼叫端略過即可)
function flagDraw(canvas, packId, w, h) {
  var ctx, img, px;
  w = Math.max(8, Math.floor(w) || 96); h = Math.max(8, Math.floor(h) || 64);
  if (!canvas || typeof canvas.getContext !== 'function') return false;
  ctx = canvas.getContext('2d');
  if (!ctx || typeof ctx.createImageData !== 'function' || typeof ctx.putImageData !== 'function') return false;
  canvas.width = w; canvas.height = h;
  px = flagPixels(packId, w, h);
  img = ctx.createImageData(w, h);
  img.data.set(px);
  ctx.putImageData(img, 0, 0);
  return true;
}

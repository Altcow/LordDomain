// combos.js — 組合模組(prefab):選一個「組合」工具,點一下放下一整組物件(桌、椅、茶、樹…),方便不用一個個慢慢放。
// 純經營側(side:'estate');組合本身不是物件、不進存檔,放下後各件都是獨立物件(可個別移動 / 拆除)。
// 新增組合只需在 COMBO_SETS 加一筆資料。座標為組合局部格 (dx,dy),rot 0 = 各件朝向如資料;整組旋轉 90°(順時針)時各件座標與朝向一併轉。
// 規則:組合內各件不得重疊;解鎖等級 = 組內最高解鎖等級;含不能轉向的長方形物件(攤位)的組合只能 180° 旋轉(comboRotStep)。
// 流程沿用 ui.js 的草稿(draft)機制:draft.type = 'combo:<id>'、draft.combo = <id>;整組一起拖、旋轉、✓ 放下、✕ 取消(一個單位)。

const COMBO_PREFIX = 'combo:';
// 顯示順序與分組名(選單依此排序;組合只出現在「組合」這一個小分類)
const COMBO_GROUPS = [
  { id: 'dine', name: '用餐茶座' },
  { id: 'home', name: '居家庭院' },
  { id: 'farm', name: '農牧' },
  { id: 'market', name: '市集商鋪' },
  { id: 'port', name: '驛站碼頭' },
  { id: 'garden', name: '庭園禮制' },
  { id: 'camp', name: '營地' }
];

// 簡寫:comboT(type, dx, dy, rot)
function comboT(type, dx, dy, rot) { return { type: type, dx: dx, dy: dy, rot: rot || 0 }; }

const COMBO_SETS = {
  // ── 用餐茶座 ──
  tea_lo: { name: '庭院石桌座', icon: '🪨', w: 3, h: 3, side: 'estate', group: 'dine', items: [
    comboT('tbl_stone', 1, 1), comboT('stone_stool', 1, 0), comboT('stone_stool', 0, 1), comboT('stone_stool', 2, 1), comboT('stone_stool', 1, 2),
    comboT('tree', 0, 0), comboT('flower_bed', 2, 0), comboT('deco_bush', 0, 2), comboT('flower_bed', 2, 2)] },
  tea_yard: { name: '庭院茶座', icon: '🫖', w: 3, h: 3, side: 'estate', group: 'dine', items: [
    comboT('tbl_tea', 1, 1), comboT('stone_stool', 1, 0), comboT('stone_stool', 0, 1), comboT('stone_stool', 2, 1), comboT('stone_stool', 1, 2),
    comboT('tree_pine', 0, 0), comboT('tree_willow', 2, 0), comboT('deco_bush', 0, 2), comboT('flower_bed', 2, 2)] },
  bamboo_tea: { name: '竹椅茶席', icon: '🎋', w: 3, h: 2, side: 'estate', group: 'dine', items: [
    comboT('deco_bamboo', 0, 0), comboT('deco_bamboo', 1, 0), comboT('deco_bamboo', 2, 0),
    comboT('chair_bamboo', 0, 1, 3), comboT('tbl_tea', 1, 1), comboT('chair_bamboo', 2, 1, 1)] },
  feast_row: { name: '飲宴席', icon: '🍶', w: 4, h: 3, side: 'estate', group: 'dine', items: [
    comboT('lantern_post', 0, 0), comboT('lantern_post', 3, 0), comboT('mat', 1, 0, 2), comboT('mat', 2, 0, 2),
    comboT('winejar', 0, 1), comboT('tbl_meal_long', 1, 1), comboT('winejar_big', 3, 1), comboT('mat', 1, 2), comboT('mat', 2, 2)] },
  banquet: { name: '大宴圓桌', icon: '🍲', w: 4, h: 4, side: 'estate', group: 'dine', items: [
    comboT('tbl_feast', 1, 1),
    comboT('stool_wood', 1, 0), comboT('stool_wood', 2, 0), comboT('stool_wood', 1, 3), comboT('stool_wood', 2, 3),
    comboT('stool_wood', 0, 1), comboT('stool_wood', 0, 2), comboT('stool_wood', 3, 1), comboT('stool_wood', 3, 2)] },
  banquet_sq: { name: '方桌宴席', icon: '🍖', w: 4, h: 4, side: 'estate', group: 'dine', items: [
    comboT('tbl_banquet', 1, 1),
    comboT('chair_wood', 1, 0, 0), comboT('chair_wood', 2, 0, 0), comboT('chair_wood', 1, 3, 2), comboT('chair_wood', 2, 3, 2),
    comboT('chair_wood', 0, 1, 3), comboT('chair_wood', 0, 2, 3), comboT('chair_wood', 3, 1, 1), comboT('chair_wood', 3, 2, 1)] },
  low_dine: { name: '席地小宴', icon: '🥢', w: 3, h: 3, side: 'estate', group: 'dine', items: [
    comboT('flower_bed', 0, 0), comboT('mat', 1, 0), comboT('flower_bed', 2, 0), comboT('mat', 0, 1), comboT('tbl_low_meal', 1, 1), comboT('mat', 2, 1),
    comboT('deco_bush', 0, 2), comboT('mat', 1, 2), comboT('deco_bush', 2, 2)] },
  study: { name: '書齋一角', icon: '📚', w: 3, h: 3, side: 'estate', group: 'dine', items: [
    comboT('bookshelf', 0, 0), comboT('bookshelf', 1, 0), comboT('deco_bamboo', 2, 0), comboT('tbl_study', 0, 1), comboT('lamp_stand', 2, 1),
    comboT('chair_wood', 0, 2, 2), comboT('stool_wood', 1, 2)] },
  pavilion: { name: '涼亭小憩', icon: '⛱️', w: 4, h: 4, side: 'estate', group: 'dine', items: [
    comboT('tree_willow', 0, 0), comboT('bench_wood', 1, 0), comboT('tree_pine', 3, 0), comboT('deco_bush', 0, 1), comboT('table_set', 1, 1),
    comboT('flower_bed', 0, 3), comboT('bench_wood', 1, 3, 2), comboT('flower_bed', 3, 3)] },
  tea_stall: { name: '茶攤與座', icon: '🍵', w: 4, h: 2, side: 'estate', group: 'dine', items: [
    comboT('stall_tea', 0, 0), comboT('tbl_tea', 2, 0), comboT('stool_wood', 3, 0),
    comboT('stool_wood', 0, 1), comboT('stool_wood', 1, 1), comboT('tbl_tea', 2, 1), comboT('stool_wood', 3, 1)] },
  // ── 居家庭院 ──
  well_yard: { name: '井台群', icon: '🪣', w: 3, h: 3, side: 'estate', group: 'home', items: [
    comboT('woodpile', 0, 0), comboT('water_vat', 1, 0), comboT('chicken', 2, 0), comboT('barrel_water', 0, 1), comboT('well', 1, 1), comboT('barrel_water', 2, 1),
    comboT('rack_cloth', 0, 2), comboT('basket', 2, 2)] },
  coop: { name: '雞舍院', icon: '🐔', w: 3, h: 3, side: 'estate', group: 'home', items: [
    comboT('shack_lean', 0, 0), comboT('chicken', 1, 0), comboT('chicken', 2, 0), comboT('haystack', 0, 1), comboT('chicken', 1, 1), comboT('duck', 2, 1),
    comboT('fence_wood', 0, 2), comboT('fence_wood', 1, 2), comboT('fence_wood', 2, 2)] },
  farmyard: { name: '農家小院', icon: '🏡', w: 4, h: 4, side: 'estate', group: 'home', items: [
    comboT('hut_mud', 0, 0), comboT('woodpile', 2, 0), comboT('haystack', 3, 0), comboT('chicken', 2, 1), comboT('dog', 3, 1),
    comboT('well', 0, 2), comboT('junk_pile', 1, 2), comboT('rack_cloth', 2, 2),
    comboT('fence_wood', 0, 3), comboT('gate_wicker', 1, 3), comboT('fence_wood', 2, 3), comboT('fence_wood', 3, 3)] },
  slum: { name: '貧民院落', icon: '🏚️', w: 3, h: 3, side: 'estate', group: 'home', items: [
    comboT('hut_ruin', 0, 0), comboT('tree_dead', 2, 0), comboT('junk_pile', 2, 1),
    comboT('fence_broken', 0, 2), comboT('fence_broken', 1, 2), comboT('wall_ruin', 2, 2)] },
  mansion: { name: '豪宅前庭', icon: '🏯', w: 4, h: 2, side: 'estate', group: 'home', items: [
    comboT('tree_pine', 0, 0), comboT('spirit_wall', 1, 0), comboT('tree_pine', 3, 0),
    comboT('stone_lion', 0, 1), comboT('gate_courtyard', 1, 1), comboT('stone_lion', 3, 1)] },
  // ── 農牧 ──
  threshing: { name: '曬場', icon: '🌾', w: 4, h: 3, side: 'estate', group: 'farm', items: [
    comboT('grain_drying', 0, 0), comboT('grain_drying', 2, 0), comboT('grain_drying', 0, 1), comboT('grain_drying', 2, 1),
    comboT('grain_sacks', 0, 2), comboT('grain_sacks', 1, 2), comboT('haystack', 2, 2), comboT('chicken', 3, 2)] },
  veg_plots: { name: '菜圃組', icon: '🥬', w: 4, h: 3, side: 'estate', group: 'farm', items: [
    comboT('vegetable_plot', 0, 0), comboT('vegetable_plot', 2, 0), comboT('vegetable_plot', 0, 1), comboT('vegetable_plot', 2, 1),
    comboT('fence_wood', 0, 2), comboT('fence_wood', 1, 2), comboT('gate_wicker', 2, 2), comboT('fence_wood', 3, 2)] },
  livestock: { name: '牲口院', icon: '🐂', w: 4, h: 3, side: 'estate', group: 'farm', items: [
    comboT('shed_livestock', 0, 0), comboT('trough', 2, 0), comboT('fodder', 3, 0), comboT('ox', 0, 1), comboT('pig', 1, 1), comboT('sheep', 2, 1), comboT('haystack', 3, 1),
    comboT('fence_wood', 0, 2), comboT('fence_wood', 1, 2), comboT('fence_wood', 2, 2), comboT('fence_wood', 3, 2)] },
  orchard_corner: { name: '果園一角', icon: '🍎', w: 3, h: 3, side: 'estate', group: 'farm', items: [
    comboT('orchard', 0, 0), comboT('tree', 2, 0), comboT('tree', 2, 1), comboT('basket', 0, 2), comboT('grain_sacks', 1, 2), comboT('fence_wood', 2, 2)] },
  // ── 市集商鋪 ──
  market_lo: { name: '小市集攤位組', icon: '🧺', w: 6, h: 2, side: 'estate', group: 'market', items: [
    comboT('stall_veg', 0, 0), comboT('stall_fruit', 2, 0), comboT('handcart', 4, 0), comboT('wheelbarrow', 5, 0),
    comboT('hawker_carrier', 0, 1), comboT('ground_goods', 1, 1), comboT('ground_bamboo', 2, 1), comboT('water_vat', 3, 1), comboT('food_noodle', 4, 1), comboT('cat', 5, 1)] },
  market3: { name: '市集三攤並排', icon: '🏪', w: 6, h: 2, side: 'estate', group: 'market', items: [
    comboT('stall_rice', 0, 0), comboT('stall_meat', 2, 0), comboT('stall_wine', 4, 0),
    comboT('banner_wine', 0, 1), comboT('ground_cloth', 1, 1), comboT('food_hubing', 2, 1), comboT('food_table', 3, 1), comboT('banner_cloth', 4, 1), comboT('winejar', 5, 1)] },
  wine_front: { name: '酒肆門前', icon: '🍶', w: 4, h: 3, side: 'estate', group: 'market', items: [
    comboT('shop_wine', 0, 0), comboT('banner_wine', 2, 0), comboT('winejar_big', 3, 0), comboT('tbl_wine', 2, 1), comboT('stool_wood', 3, 1),
    comboT('winejar', 0, 2), comboT('winejar', 1, 2), comboT('stool_wood', 2, 2)] },
  lantern_corner: { name: '燈籠街角', icon: '🏮', w: 3, h: 3, side: 'estate', group: 'market', items: [
    comboT('lantern_post', 0, 0), comboT('lantern_post', 2, 0), comboT('deco_bush', 0, 1), comboT('deco_bush', 2, 1), comboT('bench_wood', 0, 2), comboT('flower_bed', 2, 2)] },
  // ── 驛站碼頭 ──
  post_yard: { name: '驛站前院', icon: '🐎', w: 5, h: 3, side: 'estate', group: 'port', items: [
    comboT('hitching_post', 0, 0), comboT('cart_goods', 2, 0), comboT('horse', 3, 0), comboT('donkey', 4, 0),
    comboT('haystack', 0, 1), comboT('trough', 3, 1), comboT('fodder', 4, 1),
    comboT('notice_board', 0, 2), comboT('fence_wood', 2, 2), comboT('fence_wood', 3, 2), comboT('fence_wood', 4, 2)] },
  dock_lo: { name: '碼頭貨堆(小)', icon: '📦', w: 3, h: 3, side: 'estate', group: 'port', items: [
    comboT('cargo_sacks', 0, 0), comboT('cargo_sacks', 1, 0), comboT('cargo_sacks', 2, 0), comboT('cargo_crates', 0, 1), comboT('cargo_crates', 1, 1), comboT('cart_hay', 2, 1),
    comboT('mooring_post', 0, 2), comboT('cargo_sacks', 1, 2)] },
  dock: { name: '碼頭貨堆組', icon: '⚓', w: 4, h: 3, side: 'estate', group: 'port', items: [
    comboT('cargo_jars', 0, 0), comboT('cargo_jars', 1, 0), comboT('cargo_salt', 2, 0), comboT('cargo_sacks', 3, 0),
    comboT('cargo_crates', 0, 1), comboT('cargo_crates', 1, 1), comboT('cart_goods', 2, 1), comboT('port_lamp', 3, 1),
    comboT('cargo_crates', 0, 2), comboT('cargo_crates', 1, 2), comboT('mooring_post', 3, 2)] },
  // ── 庭園禮制 ──
  garden_lo: { name: '花園景', icon: '🌷', w: 3, h: 3, side: 'estate', group: 'garden', items: [
    comboT('flower_bed', 0, 0), comboT('tree_willow', 1, 0), comboT('flower_bed', 2, 0), comboT('deco_rocks', 0, 1), comboT('flower_bed', 2, 1),
    comboT('deco_bush', 0, 2), comboT('bench_wood', 1, 2)] },
  garden_hi: { name: '雅致庭園', icon: '🪴', w: 4, h: 3, side: 'estate', group: 'garden', items: [
    comboT('tree_cypress', 0, 0), comboT('potted_plant', 1, 0), comboT('potted_plant', 2, 0), comboT('stone_lamp', 3, 0),
    comboT('flower_bed', 0, 1), comboT('deco_rocks', 1, 1), comboT('potted_plant', 2, 1), comboT('flower_bed', 3, 1),
    comboT('stone_lamp', 0, 2), comboT('bench_wood', 1, 2), comboT('stone_lamp', 3, 2)] },
  shrine_lo: { name: '祭祀小角', icon: '🕯️', w: 3, h: 3, side: 'estate', group: 'garden', items: [
    comboT('deco_bamboo', 0, 0), comboT('stele', 1, 0), comboT('deco_bamboo', 2, 0), comboT('lamp_stand', 0, 1), comboT('mat', 1, 1), comboT('lamp_stand', 2, 1),
    comboT('flower_bed', 0, 2), comboT('flower_bed', 1, 2), comboT('flower_bed', 2, 2)] },
  shrine: { name: '祭祀角', icon: '🏺', w: 3, h: 3, side: 'estate', group: 'garden', items: [
    comboT('tree_cypress', 0, 0), comboT('stele', 1, 0), comboT('tree_cypress', 2, 0), comboT('stone_lamp', 0, 1), comboT('incense_burner', 1, 1), comboT('stone_lamp', 2, 1),
    comboT('flower_bed', 0, 2), comboT('stone_stool', 1, 2), comboT('flower_bed', 2, 2)] },
  // ── 營地 ──
  camp_gate: { name: '營門崗哨', icon: '🚩', w: 4, h: 3, side: 'estate', group: 'camp', items: [
    comboT('flag_army', 0, 0), comboT('deco_weaponrack', 1, 0), comboT('deco_target', 2, 0), comboT('flag_army', 3, 0),
    comboT('tent_small', 0, 1), comboT('training_dummy', 2, 1), comboT('training_dummy', 3, 1), comboT('deco_weaponrack', 2, 2), comboT('deco_target', 3, 2)] },
  camp_front: { name: '營前鹿角拒馬', icon: '🏕️', w: 4, h: 3, side: 'estate', group: 'camp', items: [
    comboT('flag_army', 0, 0), comboT('deco_jumaa', 1, 0), comboT('deco_jumaa', 2, 0), comboT('flag_army', 3, 0),
    comboT('tent_small', 0, 1), comboT('deco_campfire', 2, 1), comboT('deco_lujiao', 3, 1), comboT('deco_weaponrack', 2, 2), comboT('deco_lujiao', 3, 2)] }
};

// ───────── 查詢 ─────────
function comboIs(t) { return typeof t === 'string' && t.indexOf(COMBO_PREFIX) === 0 && Object.prototype.hasOwnProperty.call(COMBO_SETS, t.slice(COMBO_PREFIX.length)); }
function comboId(t) { return t.slice(COMBO_PREFIX.length); }
function comboKey(id) { return COMBO_PREFIX + id; }
// 工具列 / 草稿列顯示用的定義(形狀同 OBJECTS 的 name / icon / w / h)
function comboDef(t) {
  const id = comboIs(t) ? comboId(t) : t, s = COMBO_SETS[id];
  return s ? { name: s.name, icon: s.icon, w: s.w, h: s.h, swap: true, cells: s.w * s.h, step: comboRotStep(id) } : null;
}
function comboFootprint(id, rot) {
  const s = COMBO_SETS[id];
  return rot % 2 === 1 ? [s.h, s.w] : [s.w, s.h];
}
// 含「不能轉向的長方形物件」(如攤位:非正方形且無 swap)的組合只能 180° 旋轉,否則該件占格會對不上
function comboFixed(id) {
  return COMBO_SETS[id].items.some(it => { const o = OBJECTS[it.type]; return o.w !== o.h && !o.swap; });
}
function comboRotStep(id) { return comboFixed(id) ? 2 : 1; }

// 組合內各件旋轉後的相對位置:順時針 R 步,(x,y,w,h) -> (H - y - h, x, h, w);各件 rot 一併 +R
function comboLocal(id, rot) {
  const s = COMBO_SETS[id], R = ((rot % 4) + 4) % 4;
  return s.items.map(it => {
    let W = s.w, H = s.h;
    const f0 = footprint(it.type, it.rot);
    let x = it.dx, y = it.dy, w = f0[0], h = f0[1];
    for (let k = 0; k < R; k++) {
      const nx = H - y - h, ny = x;
      x = nx; y = ny;
      const t = w; w = h; h = t;
      const tw = W; W = H; H = tw;
    }
    return { type: it.type, x: x, y: y, w: w, h: h, rot: (it.rot + R) & 3, skin: it.skin || '' };
  });
}
// 放在 (x,y) 時各件的絕對位置 [{ type, x, y, rot, w, h, skin }]
function comboItemsAt(id, x, y, rot) {
  return comboLocal(id, rot).map(it => ({ type: it.type, x: x + it.x, y: y + it.y, rot: it.rot, w: it.w, h: it.h, skin: it.skin }));
}
// 解鎖等級 = 組內最高解鎖等級(沒有等級資料的件視為 1)
function comboUnlockLv(id) {
  let lv = 1;
  COMBO_SETS[id].items.forEach(it => {
    const L = typeof progUnlockLv === 'function' ? progUnlockLv('estate', it.type) : null;
    if (L !== null && L !== undefined && L > lv) lv = L;
  });
  return lv;
}
// NL2:組合件成員節點聯集,全研完才可用(未登記於科技對照者沿用舊等級判定)
function comboUnlockNodes(id) {
  const out = [];
  COMBO_SETS[id].items.forEach(it => {
    const n = typeof nlObjTech === 'function' ? nlObjTech(it.type) : undefined;
    if (n && n !== 'start' && out.indexOf(n) < 0 && !(typeof NL_START_OBJS !== 'undefined' && NL_START_OBJS.indexOf(it.type) >= 0)) out.push(n);
  });
  return out;
}
function comboUnlocked(id) {
  if (typeof nlUnlocked === 'function' && typeof NL_OBJ_TECH !== 'undefined' && COMBO_SETS[id].items.every(it => nlUnlocked(it.type) !== null)) {
    return COMBO_SETS[id].items.every(it => nlUnlocked(it.type) === true);
  }
  if (typeof prog === 'undefined' || !prog) return true;
  return prog.lv >= comboUnlockLv(id);
}
function comboOrder() {
  const gi = {};
  COMBO_GROUPS.forEach((g, i) => { gi[g.id] = i; });
  return Object.keys(COMBO_SETS).sort((a, b) => {
    const A = COMBO_SETS[a], B = COMBO_SETS[b];
    return (gi[A.group] - gi[B.group]) || (comboUnlockLv(a) - comboUnlockLv(b)) || (A.w * A.h - B.w * B.h) || (a < b ? -1 : 1);
  });
}
// 選單用(工具 id = 'combo:<id>'):已開放者 / 全部
function comboMenuIds() { return comboOrder().filter(comboUnlocked).map(comboKey); }
function comboAllIds() { return comboOrder().map(comboKey); }
function comboGroupName(id) {
  const g = COMBO_GROUPS.find(x => x.id === COMBO_SETS[id].group);
  return g ? g.name : '';
}

// ───────── 合法性 ─────────
// 整組檢查:每件各自走待購規則(canPlacePending),結果 { items:[{...item, ok, reason}], nOk, nBad, placeable, reason }
// skip = 真:略過不合法件,只要至少一件合法就可放;否則任一件不合法整組不可放
function comboCheck(id, x, y, rot, skip) {
  const items = comboItemsAt(id, x, y, rot).map(it => {
    const ok = canPlacePending(it.type, it.x, it.y, it.rot, -1);
    it.ok = ok;
    it.reason = ok ? '' : (typeof pendFailReason === 'function' ? pendFailReason(it.type, it.x, it.y, it.rot, -1) : '不可放置');
    return it;
  });
  const bad = items.filter(it => !it.ok), nOk = items.length - bad.length;
  const res = { items: items, nOk: nOk, nBad: bad.length, placeable: true, reason: '' };
  if (bad.length) {
    const names = bad.slice(0, 3).map(it => OBJECTS[it.type].name + '(' + it.reason + ')').join('、') + (bad.length > 3 ? '…' : '');
    if (skip && nOk > 0) res.reason = '';
    else {
      res.placeable = false;
      res.reason = bad.length + '/' + items.length + ' 件不合法:' + names;
    }
  }
  if (res.placeable && typeof pendMax === 'function' && pend.list.length + nOk > pendMax()) {
    res.placeable = false;
    res.reason = '待購最多 ' + pendMax() + ' 件,請先購買或取消';
  }
  return res;
}
// 略過模式下的提示(可放但有被略過的件)
function comboSkipNote(res) {
  return res.nBad ? '將略過 ' + res.nBad + ' 件不合法:' + res.items.filter(it => !it.ok).slice(0, 3).map(it => OBJECTS[it.type].name + '(' + it.reason + ')').join('、') : '';
}

// ───────── 放下 / 撤銷 ─────────
// 最近一次放下的組合(供整組撤銷):{ id, objs:[物件參考], free }
let comboLast = null;
// 放下整組:合法件逐一加入待購;免費建造時一次轉為正式物件(同一次存檔)。回傳 { ok, n, skipped, reason }
function comboPlace(id, x, y, rot, skip) {
  const res = comboCheck(id, x, y, rot, skip);
  if (!res.placeable) return { ok: false, n: 0, skipped: 0, reason: res.reason };
  const good = res.items.filter(it => it.ok);
  const free = typeof progFreeBuild === 'function' && progFreeBuild();
  const before = world.objects.length;
  const added = [];
  good.forEach(it => {
    pendAdd(it.type, it.x, it.y, it.rot, it.skin);
    added.push(pend.list[pend.list.length - 1]);
  });
  let objs = added;
  if (free) {
    if (typeof commitPending === 'function' ? !commitPending() : !pendCommit().ok) {
      pendClear();
      return { ok: false, n: 0, skipped: 0, reason: '放置失敗' };
    }
    objs = world.objects.slice(before);
  }
  comboLast = { id: id, objs: objs, free: free };
  return { ok: true, n: good.length, skipped: res.nBad, reason: '' };
}
// 撤銷上一組(整組一起):已蓋的拆除(退款規則同拆除)、待購的移出待購。回傳撤銷件數
function comboUndoLast() {
  const L = comboLast;
  if (!L) return 0;
  let n = 0;
  L.objs.forEach(o => {
    const wi = world.objects.indexOf(o);
    if (wi >= 0) {
      removeObjectAt(o.x, o.y, true);
      n++;
    } else {
      const pi = pend.list.indexOf(o);
      if (pi >= 0) { pendRemove(pi); n++; }
    }
  });
  comboLast = null;
  if (typeof objPost === 'function') objPost();
  else if (typeof saveWorld === 'function') saveWorld();
  return n;
}
function comboLastInfo() { return comboLast ? { id: comboLast.id, n: comboLast.objs.length } : null; }

// ───────── 繪製(虛影) ─────────
// 整組虛影:每件各自半透明本體 + 綠 / 紅格底(不合法件紅),外框依整組可放與否;res 為 comboCheck 結果
function drawComboGhost(ctx, id, x, y, rot, res) {
  const items = res ? res.items : comboItemsAt(id, x, y, rot).map(it => { it.ok = true; return it; });
  const sorted = items.slice().sort((a, b) => (a.x + a.w + a.y + a.h) - (b.x + b.w + b.y + b.h));
  sorted.forEach(it => {
    const fill = it.ok ? 'rgba(80,220,120,.30)' : 'rgba(230,70,70,.40)';
    for (let yy = it.y; yy < it.y + it.h; yy++)
      for (let xx = it.x; xx < it.x + it.w; xx++)
        if (inBounds(xx, yy)) poly(ctx, topPts(xx, yy, world.height[idx(xx, yy)], 0), fill);
  });
  sorted.forEach(it => {
    if (!inBounds(it.x, it.y) || !inBounds(it.x + it.w - 1, it.y + it.h - 1)) return;
    drawObject(ctx, { type: it.type, x: it.x, y: it.y, rot: it.rot, skin: it.skin }, it.ok ? 0.55 : 0.35);
  });
  const fp = comboFootprint(id, rot);
  const bh = inBounds(x, y) ? world.height[idx(x, y)] * HL : 0;
  const pts = [gpt(x, y, bh), gpt(x + fp[0], y, bh), gpt(x + fp[0], y + fp[1], bh), gpt(x, y + fp[1], bh)];
  const good = !res || res.placeable;
  ctx.save();
  ctx.setLineDash([6, 4]);
  outline(ctx, pts, good ? (res && res.nBad ? '#ffd65a' : '#5fe08a') : '#ff5a4a', 2);
  ctx.restore();
}

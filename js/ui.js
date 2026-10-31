// 經營模式建築分類(工具列上方的分類標籤)。item 為 OBJECTS 的 key;未列入者自動歸「其他」(buildCatIds)
const BUILD_FAVS = ['house', 'market', 'wall', 'gate', 'tree', 'stone', 'well', 'lumber', 'quarry', 'field_sprout', 'shop_wine', 'stairs'];
const BUILD_GROUPS = [
  { id: 'live', name: '居住與生活', items: ['house', 'palace', 'well', 'well_sweep', 'privy', 'woodpile', 'barrel_water', 'barrel_empty', 'basket', 'food_table', 'couch', 'mat', 'screen', 'chest', 'bookshelf', 'lamp_stand', 'broom', 'winejar', 'winejar_big', 'winejar_stack', 'winejar_mix', 'deco_brazier', 'dog', 'cat'] },
  { id: 'shop', name: '商鋪與市集', items: ['market', 'inn', 'post_station', 'shop_wine', 'shop_book', 'shop_cloth', 'shop_rice', 'shop_rouge', 'shop_gamble', 'shop_brothel', 'shop_herb', 'shop_tea', 'shop_pawn', 'stall_veg', 'stall_fruit', 'stall_cloth', 'stall_pottery', 'stall_rice', 'stall_book', 'stall_rouge', 'stall_meat', 'stall_wine', 'stall_tea', 'stall_toy', 'handcart', 'cart_hay', 'cart_goods', 'cart_empty', 'oxcart', 'deco_oxcart', 'wheelbarrow', 'carriage'] },
  { id: 'farm', name: '農牧', items: ['field_millet', 'field_sprout', 'field_wheat', 'mulberry_grove', 'orchard', 'vegetable_plot', 'herb_garden', 'tea_garden', 'beehive', 'plow', 'hoe', 'millstone', 'waterwheel', 'winnower', 'ox', 'horse', 'donkey', 'chicken', 'duck', 'goose', 'sheep', 'pig', 'stable', 'sheepfold', 'ranch_fence', 'trough', 'fodder', 'haystack', 'grain_sacks', 'granary_round', 'salt_pile', 'saltfield', 'fish_rack', 'fishery'] },
  { id: 'ind', name: '產業', items: ['lumber', 'deco_lumberyard', 'sawbench', 'lograft', 'quarry', 'mine_entrance', 'minecart', 'ore_iron', 'ore_copper', 'ore_stone', 'smithy', 'shop_smith', 'dock', 'bank'] },
  { id: 'mil', name: '軍事與營地', items: ['army_camp', 'parade_ground', 'drill_ground', 'archer', 'shield', 'cavalry', 'siege', 'hospital', 'tent_group', 'tent_general', 'flag_army', 'flag_great', 'drum_tower', 'beacon', 'deco_watchtower', 'deco_stable', 'deco_weaponrack', 'deco_target', 'training_dummy', 'deco_jumaa', 'deco_campfire', 'deco_lujiao', 'war_chariot', 'cloud_ladder', 'ram', 'trebuchet', 'jinglan', 'warship'] },
  { id: 'garden', name: '庭園與景觀', items: ['tree', 'stone', 'tree_pine', 'tree_willow', 'tree_sakura', 'tree_maple', 'tree_mulberry', 'tree_peach', 'tree_cypress', 'deco_bamboo', 'deco_bush', 'flower_bed', 'deco_rocks', 'rockery', 'stone_lamp', 'lantern_line', 'deco_pond', 'lotus', 'reeds', 'potted_plant', 'small_bridge'] },
  { id: 'rite', name: '祭祀與禮制', items: ['paifang', 'she_altar', 'incense_burner', 'censer', 'stele'] },
  { id: 'road', name: '城牆與道路', items: ['wall', 'gate', 'stairs', 'ramp', 'bridge', 'wall_courtyard', 'gate_courtyard', 'fence_wood', 'fence_bamboo', 'road_stone', 'toll_gate', 'ferry', 'boat_small'] }
];

const TERRAIN_TOOLS = {
  road:  { name: '道路', icon: '🛤️', drag: true },
  grass: { name: '草地', icon: '🌱', drag: true },
  lake:  { name: '湖',   icon: '💧', drag: true },
  river: { name: '河流', icon: '🌊', drag: true },
  raise: { name: '升高', icon: '⬆️', drag: true },
  lower: { name: '降低', icon: '⬇️', drag: true },
  erase: { name: '拆除', icon: '🧹', drag: true }
};

const ui = { tool: null, rot: 0, shopOpen: false, dealDay: '', tplOpen: false, techOpen: false, techTab: 'eco', buildCat: '常用', objSel: null, objMove: null };

const TERRAIN_OF = { road: T_ROAD, grass: T_GRASS, lake: T_LAKE, river: T_RIVER };
const TERRAIN_NAME = ['草地', '湖', '河', '道路'];

// 指標手勢狀態: mode = null | pan | tool | pending | paint | pinch
const gs = { ptrs: new Map(), mode: null, primary: null, pinch: null, timer: 0, op: null, last: null };
let toastEl = null, toastTimer = 0;
let lastResHtml = '', lastShopHtml = '', lastPendHtml = '', lastTechHtml = '', lastObjHtml = '';

function initUI(canvas) {
  toastEl = document.createElement('div');
  toastEl.id = 'toast';
  document.body.appendChild(toastEl);
  buildToolbar();
  initFoldUI();
  setTool(null);
  document.getElementById('btnRot').textContent = DIR_ARROWS[ui.rot];
  bindEvents(canvas);
  syncSeasonSelect();
  updateResBar();
  if (typeof initMapEdit === 'function') initMapEdit();
}

// 收合鈕與精簡介面:頂列 / 底部建築列可收成一顆小圓鈕。收合鈕位置由 CSS 固定(直向/橫向各一套),展開與否都不移動
const UI_PREF = { tp: 'lorddomain.ui.tpFold', tb: 'lorddomain.ui.tbFold', compact: 'lorddomain.ui.compact' };
function uiPrefGet(key) {
  try {
    return localStorage.getItem(key) === '1';
  } catch (e) {
    console.warn('[ui] pref read failed', e);
    return false;
  }
}
function uiPrefSet(key, on) {
  try {
    localStorage.setItem(key, on ? '1' : '0');
  } catch (e) {
    console.warn('[ui] pref write failed', e);
  }
}
function uiFoldLabel(btn, collapsed, top) {
  // 頂列展開為 ▲(收起)、收合為 ▼(展開);底部列相反
  const up = top ? !collapsed : collapsed;
  btn.textContent = up ? '▲' : '▼';
  const label = (top ? '頂列' : '建築列') + (collapsed ? '展開' : '收合');
  btn.title = label;
  btn.setAttribute('aria-label', label);
}
function uiApplyPrefs() {
  const b = document.body;
  if (!b) return;
  b.classList.toggle('tp-fold', uiPrefGet(UI_PREF.tp));
  b.classList.toggle('tb-fold', uiPrefGet(UI_PREF.tb));
  b.classList.toggle('ui-compact', uiPrefGet(UI_PREF.compact));
  const tp = document.getElementById('tpFold');
  const tb = document.getElementById('tbFold');
  if (tp) uiFoldLabel(tp, b.classList.contains('tp-fold'), true);
  if (tb) uiFoldLabel(tb, b.classList.contains('tb-fold'), false);
}
function uiToggleFold(which) {
  const key = which === 'top' ? UI_PREF.tp : UI_PREF.tb;
  uiPrefSet(key, !uiPrefGet(key));
  uiApplyPrefs();
  if (which !== 'top') buildCatBar();
}
function initFoldUI() {
  [['tpFold', 'top'], ['tbFold', 'bottom']].forEach(p => {
    const btn = document.createElement('button');
    btn.id = p[0];
    btn.className = 'fold-btn';
    btn.addEventListener('click', () => uiToggleFold(p[1]));
    document.body.appendChild(btn);
  });
  uiApplyPrefs();
}
function uiGetCompact() {
  return uiPrefGet(UI_PREF.compact);
}
// 精簡介面:按鈕縮小;開啟時預設收合底部建築列
function uiSetCompact(on) {
  uiPrefSet(UI_PREF.compact, on);
  if (on) uiPrefSet(UI_PREF.tb, true);
  uiApplyPrefs();
  buildCatBar();
}

function bindEvents(canvas) {
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerEnd);
  canvas.addEventListener('pointercancel', onPointerEnd);
  canvas.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') preview.visible = false; });
  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.1 : 1 / 1.1);
  }, { passive: false });

  const shop = document.getElementById('shop');
  shop.addEventListener('pointerdown', e => e.stopPropagation());
  shop.addEventListener('click', onShopClick);

  const tplMenu = document.getElementById('tplMenu');
  tplMenu.addEventListener('pointerdown', e => e.stopPropagation());
  tplMenu.addEventListener('click', onTplClick);
  document.getElementById('techPanel').addEventListener('click', onTechClick);
  const pendBar = document.getElementById('pendBar');
  pendBar.addEventListener('pointerdown', e => e.stopPropagation());
  pendBar.addEventListener('click', onPendClick);
  const objBar = document.createElement('div');
  objBar.id = 'objBar';
  objBar.hidden = true;
  document.body.appendChild(objBar);
  objBar.addEventListener('pointerdown', e => e.stopPropagation());
  objBar.addEventListener('click', onObjClick);

  document.getElementById('btnShop').addEventListener('click', () => toggleShop());
  document.getElementById('btnRot').addEventListener('click', () => rotate());
  document.getElementById('btnHide').addEventListener('click', () => toggleHide());
  document.getElementById('selSeason').addEventListener('change', e => {
    setSeason(e.target.value);
    saveWorld();
  });
  document.getElementById('btnDemo').addEventListener('click', () => toggleTplMenu());
  document.getElementById('btnPano').addEventListener('click', () => openPanorama());
  document.getElementById('panoClose').addEventListener('click', () => closePanorama());
  document.getElementById('panoSave').addEventListener('click', () => savePanorama());
  document.getElementById('btnClear').addEventListener('click', () => {
    if (game.mode === 'battleDesign') {
      mapeditClear();
      return;
    }
    if (!confirm('清空領地上的所有建築與地形？資源與科技進度不會改變。' + pendWarnText())) return;
    pendClear();
    hideReset();
    clearWorld();
    saveWorld();
    updateResBar();
  });
  document.addEventListener('keydown', e => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (pano.open) {
      if (e.key === 'Escape') closePanorama();
      return;
    }
    if (e.key === 'h' || e.key === 'H') {
      if (document.activeElement && document.activeElement.tagName === 'SELECT') return;
      toggleHide();
      return;
    }
    if (e.key === 'r' || e.key === 'R') {
      if (document.activeElement && document.activeElement.tagName === 'SELECT') return;
      rotate();
    } else if (e.key === 'Escape') {
      if (pend.sel >= 0 || pend.moving) {
        pend.sel = -1;
        pend.moving = false;
        preview.visible = false;
        updatePendBar();
        return;
      }
      if (ui.objSel) {
        ui.objSel = null;
        ui.objMove = null;
        preview.visible = false;
        updatePendBar();
        return;
      }
      setTool(null);
      toggleShop(false);
      toggleTplMenu(false);
      toggleTechPanel(false);
    }
  });
}

function buildToolbar() {
  const bar = document.getElementById('toolbar');
  bar.innerHTML = '';
  if (game.mode === 'battleDesign' && typeof buildCampToolbar === 'function') {
    buildCampToolbar(bar);
  } else {
    addToolButton(bar, null, '✋', '瀏覽', null);
    for (const id in TERRAIN_TOOLS) addToolButton(bar, id, TERRAIN_TOOLS[id].icon, TERRAIN_TOOLS[id].name, null);
    const sep = document.createElement('span');
    sep.className = 'sep';
    sep.textContent = '｜';
    bar.appendChild(sep);
    if (ui.buildCat !== '常用' && !buildCatIds(ui.buildCat).length) ui.buildCat = '常用';
    buildCatIds(ui.buildCat).forEach(id => addToolButton(bar, id, OBJECTS[id].icon, OBJECTS[id].name, OBJECTS[id]));
  }
  syncToolActive();
  buildCatBar();
}

// 分類內容:常用 / 各分類(依 BUILD_GROUPS)/ misc(其他 = 不在任何分類的可見建築)。只回傳 sideOk 為真者
function buildCatIds(catId) {
  if (catId === '常用') return BUILD_FAVS.filter(k => OBJECTS[k] && sideOk(k));
  if (catId === 'misc') {
    const listed = {};
    BUILD_GROUPS.forEach(g => g.items.forEach(k => { listed[k] = true; }));
    return Object.keys(OBJECTS).filter(k => !listed[k] && sideOk(k));
  }
  const g = BUILD_GROUPS.find(x => x.id === catId);
  return g ? g.items.filter(k => OBJECTS[k] && sideOk(k)) : [];
}

function buildCatList() {
  const out = [{ id: '常用', name: '常用', n: buildCatIds('常用').length }];
  BUILD_GROUPS.forEach(g => out.push({ id: g.id, name: g.name, n: buildCatIds(g.id).length }));
  const misc = buildCatIds('misc').length;
  if (misc) out.push({ id: 'misc', name: '其他', n: misc });
  return out;
}

// 工具列上方的分類標籤列(橫向可捲動);戰鬥布置不顯示
function buildCatBar() {
  let box = document.getElementById('catbar');
  if (!box) {
    box = document.createElement('div');
    box.id = 'catbar';
    document.body.appendChild(box);
    box.addEventListener('click', onCatClick);
  }
  const on = game.mode !== 'battleDesign';
  box.hidden = !on;
  document.body.classList.toggle('has-catbar', on);
  if (!on) return;
  const tb = document.getElementById('toolbar');
  box.style.bottom = (tb ? tb.offsetHeight : 0) + 'px';
  box.textContent = '';
  buildCatList().forEach(c => {
    const b = document.createElement('button');
    b.setAttribute('data-cat', c.id);
    if (c.id === ui.buildCat) b.classList.add('on');
    b.innerHTML = c.name + ' <small>' + c.n + '</small>';
    box.appendChild(b);
  });
}

function onCatClick(e) {
  const b = e.target.closest('button');
  if (!b || !b.getAttribute('data-cat')) return;
  ui.buildCat = b.getAttribute('data-cat');
  buildToolbar();
  updateResBar();
}

function syncToolActive() {
  const key = ui.tool === null ? '' : ui.tool;
  document.querySelectorAll('#toolbar button').forEach(b => {
    b.classList.toggle('active', b.getAttribute('data-tool') === key);
  });
}

// 底部疊放高度:工具列 + 分類列(顯示時),待購條與提示以此定位
function bottomStackPx() {
  const tb = document.getElementById('toolbar');
  const cb = document.getElementById('catbar');
  return (tb ? tb.offsetHeight : 0) + (cb && !cb.hidden ? cb.offsetHeight : 0);
}

function addToolButton(bar, id, icon, name, def) {
  const btn = document.createElement('button');
  btn.setAttribute('data-tool', id === null ? '' : id);
  let html = '<span class="ic">' + icon + '</span><span>' + name + '</span>';
  let title = name;
  if (def) {
    html += '<span class="cost">' + costText(objCost(id)) + '</span>';
    title += ' ' + costText(objCost(id));
    if (def.prod) title += ' 產出 ' + prodText(def.prod);
    if (def.max) title += ' (上限 ' + def.max + ' 座)';
    if (def.unit && CAMP_POP[def.unit]) title += ' 出征容量 +' + CAMP_POP[def.unit];
  }
  btn.innerHTML = html;
  btn.title = title;
  btn.addEventListener('click', () => {
    if (isCampTool(id) && CAMP_TOOLS[id].act) {
      CAMP_TOOLS[id].act();
      return;
    }
    setTool(ui.tool === id ? null : id);
    const hl = ui.tool === id ? toolHelpLine(id) : '';
    if (hl) showToast(hl);
  });
  bar.appendChild(btn);
  return btn;
}

function isCampTool(t) {
  return t !== null && typeof CAMP_TOOLS !== 'undefined' && Object.prototype.hasOwnProperty.call(CAMP_TOOLS, t);
}

function setTool(id) {
  if (hide.on && id !== null && OBJECTS[id] && !toggleHide(false)) return;
  ui.tool = id;
  const key = id === null ? '' : id;
  document.querySelectorAll('#toolbar button').forEach(b => {
    b.classList.toggle('active', b.getAttribute('data-tool') === key);
  });
  preview.tool = id;
  preview.visible = false;
  document.getElementById('info').textContent = toolInfo();
  pend.sel = -1;
  pend.moving = false;
  ui.objSel = null;
  ui.objMove = null;
  updatePendBar();
}

function toolInfo() {
  const t = ui.tool;
  if (t === null) return ui.objMove ? '移動中：點選新位置放下（再按 ✥ 或 Esc 取消）' : '瀏覽模式：拖曳移動、滾輪／雙指縮放';
  const hl = toolHelpLine(t);
  if (hl) return hl;
  if (isCampTool(t)) return CAMP_TOOLS[t].name;
  if (OBJECTS[t]) {
    const d = OBJECTS[t];
    let s = d.name + '　成本 ' + costText(objCost(t));
    if (d.prod) s += '　產出 ' + prodText(d.prod);
    if (d.unit && CAMP_POP[d.unit]) s += '　出征容量 +' + CAMP_POP[d.unit];
    return s;
  }
  return TERRAIN_TOOLS[t].name;
}

function rotate() {
  if (pend.sel >= 0) {
    pendRotateSel();
    updatePendBar();
    return;
  }
  if (objSelIndex() >= 0) {
    objRotate();
    updatePendBar();
    return;
  }
  ui.rot = (ui.rot + 1) % 4;
  document.getElementById('btnRot').textContent = DIR_ARROWS[ui.rot];
  preview.rot = ui.rot;
  if (gs.last) updatePreviewAt(gs.last.x, gs.last.y);
}

function isDraggable(t) {
  if (pend.moving) return false;
  if (t === null) return false;
  return !!((OBJECTS[t] && OBJECTS[t].drag) || (TERRAIN_TOOLS[t] && TERRAIN_TOOLS[t].drag) || (isCampTool(t) && CAMP_TOOLS[t].drag));
}

function previewOk(t, x, y) {
  const i = idx(x, y);
  if (hide.on) return previewOkHidden(t, x, y, i);
  if (OBJECTS[t]) return canPlacePending(t, x, y, ui.rot, -1) && canAfford(addCost(pendTotal(), objCost(t)));
  if (t === 'raise') return !world.occ[i] && !pend.occ[i] && world.height[i] < MAX_H;
  if (t === 'lower') return !world.occ[i] && !pend.occ[i] && world.height[i] > 0;
  if (t === 'erase') return !!world.occ[i] || !!pend.occ[i] || world.terrain[i] === T_ROAD;
  return !world.occ[i] && !pend.occ[i];
}

function updatePreviewAt(sx, sy) {
  const c = screenToCell(sx, sy);
  const info = document.getElementById('info');
  if (!c) {
    preview.visible = false;
    info.textContent = toolInfo();
    return;
  }
  const i = idx(c.x, c.y);
  preview.x = c.x;
  preview.y = c.y;
  if (pend.moving && pend.sel >= 0) {
    const o = pend.list[pend.sel];
    preview.tool = o.type;
    preview.rot = o.rot;
    preview.visible = true;
    preview.ok = canPlacePending(o.type, c.x, c.y, o.rot, pend.sel);
  } else if (ui.objMove && objSelIndex() >= 0) {
    const o = ui.objMove;
    preview.tool = o.type;
    preview.rot = o.rot;
    preview.visible = true;
    preview.ok = objFitAt(objSelIndex(), c.x, c.y, o.rot);
  } else {
    preview.tool = ui.tool;
    preview.rot = ui.rot;
    preview.visible = ui.tool !== null && !isCampTool(ui.tool);
    preview.ok = ui.tool === null || previewOk(ui.tool, c.x, c.y);
  }
  info.textContent = toolInfo() + '　(' + c.x + ',' + c.y + ') ' + TERRAIN_NAME[world.terrain[i]] + ' 高度' + world.height[i];
}

function placeFailReason(type, x, y, rot) {
  if (OBJECTS[type].max && countObjects(type) >= OBJECTS[type].max) return OBJECTS[type].name + '最多只能蓋 ' + OBJECTS[type].max + ' 座';
  const [w, h] = footprint(type, rot);
  if (x < 0 || y < 0 || x + w > MAP_W || y + h > MAP_H) return '超出邊界';
  const h0 = world.height[idx(x, y)];
  for (let yy = y; yy < y + h; yy++) {
    for (let xx = x; xx < x + w; xx++) {
      const i = idx(xx, yy);
      if (world.occ[i]) return '已有物件';
      if (world.height[i] !== h0) return '高度不一致';
      if (OBJECTS[type].on.indexOf(world.terrain[i]) < 0) return '地形不符';
    }
  }
  return '未知原因';
}

function pendFailReason(type, x, y, rot, skip) {
  const d = OBJECTS[type];
  if (d.max && countObjects(type) + pendCount(type, skip) >= d.max) return d.name + '最多只能蓋 ' + d.max + ' 座（含待購）';
  if (canPlace(type, x, y, rot)) return '與待購建築重疊';
  return placeFailReason(type, x, y, rot);
}

function pendWarnText() {
  return pend.list.length ? '\n（目前 ' + pend.list.length + ' 件待購建築也會一併取消）' : '';
}

function toolActive() {
  return ui.tool !== null || pend.moving || !!ui.objMove;
}

// 費用不足：一次操作（含拖曳）只響一次、提示一次
function denyCost(need) {
  if (gs.op) {
    if (gs.op.poor) return;
    gs.op.poor = true;
  }
  beep();
  showToast('資源不足：缺 ' + costText(missingOf(need)));
}

function selectPending(n) {
  pend.sel = pend.sel === n ? -1 : n;
  pend.moving = false;
  if (gs.op) gs.op.selectOnly = true;
  updatePendBar();
}

function pendMoveTo(x, y) {
  const o = pend.list[pend.sel];
  if (!canPlacePending(o.type, x, y, o.rot, pend.sel)) {
    showToast('無法移到此處：' + pendFailReason(o.type, x, y, o.rot, pend.sel));
    return;
  }
  o.x = x;
  o.y = y;
  pend.moving = false;
  pendRebuild();
  preview.visible = false;
  updatePendBar();
}

function pendRotateSel() {
  const o = pend.list[pend.sel];
  for (let k = 1; k <= 3; k++) {
    const r = (o.rot + k) % 4;
    if (canPlacePending(o.type, o.x, o.y, r, pend.sel)) {
      o.rot = r;
      pendRebuild();
      return true;
    }
  }
  showToast('此處空間不足，無法旋轉');
  return false;
}

// 隱藏建築（PLAN 12.17）。on 省略 = 切換。回傳是否已切到目標狀態（關閉時使用者取消 confirm → false）
function toggleHide(on) {
  on = on === undefined ? !hide.on : !!on;
  if (on === hide.on) return true;
  if (on) {
    pend.sel = -1;
    pend.moving = false;
    hide.on = true;
    if (ui.tool !== null && OBJECTS[ui.tool]) setTool(null);
    const n = hideAudit();
    showToast(n ? '建築已隱藏；' + n + ' 件位置不合法（紅框）' : '建築已隱藏：可整地，不能布置或拆除建築');
  } else {
    const n = hideAudit();
    if (n && !confirm('有 ' + n + ' 件建築位置不合法（紅框），顯示後會維持原樣。仍要顯示建築？')) return false;
    hide.on = false;
    showToast('已顯示建築');
  }
  syncHideBtn();
  preview.visible = false;
  updatePendBar();
  return true;
}

function syncHideBtn() {
  const b = document.getElementById('btnHide');
  b.classList.toggle('on', hide.on);
  b.querySelector('.ic').textContent = hide.on ? '🙈' : '👁';
  b.querySelector('.lbl').textContent = hide.on ? '隱藏中' : '建築';
  document.body.classList.toggle('hideobj', hide.on);
}

// 套用範本／清空時：世界整個換掉，直接恢復顯示（不驗證、不 confirm）
function hideReset() {
  hide.on = false;
  hide.bad = [];
  hide.badCell.fill(0);
  syncHideBtn();
}

// 隱藏中的工具套用：只允許不會讓已建物件不合法的修改（PLAN 12.17.3）
function applyHidden(t, x, y, i, pn) {
  if (OBJECTS[t]) {
    warnOnce('隱藏建築中無法布置，請先按 👁 顯示建築');
    return false;
  }
  if (pn) {
    warnOnce('該格有待購建築');
    return false;
  }
  const n = world.occ[i];
  if (t in TERRAIN_OF) {
    const target = TERRAIN_OF[t];
    if (world.terrain[i] === target && (target !== T_RIVER || world.flow[i] === ui.rot)) return false;
    if (!terrainOkUnder(x, y, target)) {
      warnOnce(OBJECTS[world.objects[n - 1].type].name + '不能在' + TERRAIN_NAME[target] + '上，此格不可改');
      return false;
    }
    paintTerrainKeep(x, y, target, ui.rot);
    return true;
  }
  if (t === 'raise' || t === 'lower') {
    const delta = t === 'raise' ? 1 : -1;
    if (!n) return changeHeight(x, y, delta);
    if (gs.op) {
      if (gs.op.blocks.has(n)) return false;
      gs.op.blocks.add(n);
    }
    const why = changeHeightBlock(n - 1, delta);
    if (why) {
      warnOnce(why);
      return false;
    }
    return true;
  }
  if (n) {
    warnOnce('隱藏建築中無法拆除，請先按 👁 顯示建築');
    return false;
  }
  if (world.terrain[i] === T_ROAD) {
    paintTerrainKeep(x, y, T_GRASS, 0);
    return true;
  }
  return false;
}

function previewOkHidden(t, x, y, i) {
  if (OBJECTS[t] || pend.occ[i]) return false;
  const n = world.occ[i];
  if (t in TERRAIN_OF) return terrainOkUnder(x, y, TERRAIN_OF[t]);
  if (t === 'raise' || t === 'lower') {
    const o = n ? world.objects[n - 1] : null;
    const h = world.height[o ? idx(o.x, o.y) : i];
    return t === 'raise' ? h < MAX_H : h > 0;
  }
  return !n && world.terrain[i] === T_ROAD;
}

function missingOf(cost) {
  const m = {};
  for (const k in cost) {
    const need = cost[k] - (world.res[k] || 0);
    if (need > 0) m[k] = need;
  }
  return m;
}

function refundOf(type) {
  const r = {}, c = objCost(type);
  for (const k in c) r[k] = Math.floor(c[k] * REFUND_RATE);
  return r;
}

function warnOnce(msg) {
  if (gs.op) {
    if (gs.op.warned) return;
    gs.op.warned = true;
  }
  showToast(msg);
}

function applyToolAt(x, y) {
  const ok = applyOne(x, y);
  if (ok && hide.on) hideAudit();
  if (ok) updateResBar();
  return ok;
}

function applyOne(x, y) {
  if (pend.moving && pend.sel >= 0) {
    pendMoveTo(x, y);
    return false;
  }
  if (ui.objMove) {
    objMoveTo(x, y);
    return false;
  }
  const t = ui.tool;
  if (t === null) return false;
  if (isCampTool(t)) return mapeditApply(t, x, y, 'down');
  const i = idx(x, y);
  const pn = pend.occ[i];
  if (hide.on) return applyHidden(t, x, y, i, pn);
  if (OBJECTS[t]) {
    if (pn) {
      if (!gs.op || gs.op.applied.size === 1) selectPending(pn - 1);
      return false;
    }
    if (gs.op && gs.op.selectOnly) return false;
    if (pend.list.length >= pendMax()) {
      warnOnce('待購最多 ' + pendMax() + ' 件，請先購買或取消');
      return false;
    }
    if (!canPlacePending(t, x, y, ui.rot, -1)) {
      showToast('無法放置：' + pendFailReason(t, x, y, ui.rot, -1));
      return false;
    }
    const need = addCost(pendTotal(), objCost(t));
    if (!canAfford(need)) {
      denyCost(need);
      return false;
    }
    pendAdd(t, x, y, ui.rot);
    updateResBar();
    return false;
  }
  if (pn) {
    if (t === 'erase') {
      const name = OBJECTS[pend.list[pn - 1].type].name;
      pendRemove(pn - 1);
      updateResBar();
      showToast('已取消待購 ' + name);
    } else {
      warnOnce('該格有待購建築');
    }
    return false;
  }
  if (t in TERRAIN_OF) {
    if (world.occ[i]) {
      warnOnce('請先拆除該格物件');
      return false;
    }
    const target = TERRAIN_OF[t];
    if (world.terrain[i] === target && (target !== T_RIVER || world.flow[i] === ui.rot)) return false;
    paintTerrain(x, y, target, ui.rot);
    return true;
  }
  if (t === 'raise' || t === 'lower') {
    if (changeHeight(x, y, t === 'raise' ? 1 : -1)) return true;
    if (world.occ[i]) warnOnce('該格有物件，無法改變高度');
    return false;
  }
  if (world.occ[i]) {
    const o = world.objects[world.occ[i] - 1];
    const refund = refundOf(o.type);
    removeObjectAt(x, y, true);
    if (typeof auPlay === 'function') auPlay('remove');
    if (o.type === LAB_TYPE && world.tech.cur) showToast('已拆除 科研院，退還 ' + costText(refund) + '；研發暫停，重建後繼續');
    else showToast('已拆除 ' + OBJECTS[o.type].name + '，退還 ' + costText(refund));
    return true;
  }
  if (world.terrain[i] === T_ROAD) {
    paintTerrain(x, y, T_GRASS, 0);
    return true;
  }
  return false;
}

function beginOp() {
  gs.op = { applied: new Set(), changed: false, warned: false, poor: false, selectOnly: false, blocks: new Set() };
}

function endOp() {
  if (gs.op && gs.op.changed) saveWorld();
  gs.op = null;
  mapeditRefresh();
}

// 矩形類戰陣工具:放開時的格(按下格已由 applyOne 記下)
function applyUpAt(sx, sy) {
  if (!gs.op || !isCampTool(ui.tool)) return;
  const c = screenToCell(sx, sy);
  if (c && mapeditApply(ui.tool, c.x, c.y, 'up')) gs.op.changed = true;
}

function applyCellAt(sx, sy) {
  const c = screenToCell(sx, sy);
  if (!c || !gs.op) return;
  const k = c.x + ',' + c.y;
  if (gs.op.applied.has(k)) return;
  gs.op.applied.add(k);
  if (applyToolAt(c.x, c.y)) gs.op.changed = true;
}

function pinchState() {
  const arr = Array.from(gs.ptrs.values());
  const a = arr[0], b = arr[1];
  return { dist: Math.hypot(a.x - b.x, a.y - b.y) || 1, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
}

function startPinch() {
  clearTimeout(gs.timer);
  gs.mode = 'pinch';
  gs.pinch = pinchState();
}

function pinchMove() {
  if (!gs.pinch) return;
  const s = pinchState();
  zoomAt(s.mx, s.my, s.dist / gs.pinch.dist);
  panBy(s.mx - gs.pinch.mx, s.my - gs.pinch.my);
  gs.pinch = s;
}

function onPointerDown(e) {
  audioUnlock();
  const x = e.clientX, y = e.clientY;
  e.currentTarget.setPointerCapture(e.pointerId);
  gs.ptrs.set(e.pointerId, { x: x, y: y, x0: x, y0: y, t0: performance.now() });
  gs.last = { x: x, y: y };
  tdDropDown(x, y, gs.ptrs.size);
  if (gs.ptrs.size >= 2) {
    startPinch();
    return;
  }
  if (e.pointerType === 'mouse') {
    if (e.button === 0 && toolActive()) {
      gs.mode = 'tool';
      beginOp();
      applyCellAt(x, y);
    } else {
      gs.mode = 'pan';
    }
    return;
  }
  if (!toolActive()) {
    gs.mode = 'pan';
    return;
  }
  gs.mode = 'pending';
  gs.primary = e.pointerId;
  updatePreviewAt(x, y);
  clearTimeout(gs.timer);
  gs.timer = setTimeout(() => {
    const p = gs.ptrs.get(gs.primary);
    if (gs.mode !== 'pending' || !p) return;
    gs.mode = 'paint';
    beginOp();
    applyCellAt(p.x, p.y);
  }, 250);
}

function onPointerMove(e) {
  gs.last = { x: e.clientX, y: e.clientY };
  const p = gs.ptrs.get(e.pointerId);
  if (!p) {
    if (e.pointerType === 'mouse') updatePreviewAt(e.clientX, e.clientY);
    return;
  }
  const dx = e.clientX - p.x, dy = e.clientY - p.y;
  p.x = e.clientX;
  p.y = e.clientY;
  if (gs.ptrs.size === 1) tdDropMove(p.x, p.y);
  if (gs.mode === 'pinch') {
    if (gs.ptrs.size >= 2) pinchMove();
    else panBy(dx, dy);
  } else if (gs.mode === 'pan') {
    panBy(dx, dy);
  } else if (gs.mode === 'pending') {
    if (Math.hypot(p.x - p.x0, p.y - p.y0) > 8) {
      clearTimeout(gs.timer);
      gs.mode = 'pan';
      panBy(p.x - p.x0, p.y - p.y0);
      p.x0 = p.x;
      p.y0 = p.y;
    }
    updatePreviewAt(p.x, p.y);
  } else if (gs.mode === 'tool' || gs.mode === 'paint') {
    updatePreviewAt(p.x, p.y);
    if (isDraggable(ui.tool)) applyCellAt(p.x, p.y);
  }
}

function onPointerEnd(e) {
  audioUnlock();
  const p = gs.ptrs.get(e.pointerId);
  if (!p) return;
  if (e.type === 'pointerup' && gs.mode === 'pan' && gs.ptrs.size === 1 && ui.tool === null && !hide.on &&
      Math.hypot(p.x - p.x0, p.y - p.y0) < 8 && performance.now() - p.t0 < 400) tapObjectAt(p.x, p.y);
  gs.ptrs.delete(e.pointerId);
  if (gs.ptrs.size === 0) tdDropUp();
  if (e.type === 'pointerup' && gs.mode === 'pending' && e.pointerId === gs.primary) {
    clearTimeout(gs.timer);
    gs.mode = null;
    beginOp();
    applyCellAt(p.x, p.y);
    applyUpAt(e.clientX, e.clientY);
    endOp();
  }
  if (gs.ptrs.size === 0) {
    if (e.type === 'pointerup' && (gs.mode === 'tool' || gs.mode === 'paint')) applyUpAt(e.clientX, e.clientY);
    clearTimeout(gs.timer);
    endOp();
    gs.mode = null;
    gs.pinch = null;
  }
}

// 瀏覽模式點一下建築（目前只有科研院有反應）
function tapObjectAt(sx, sy) {
  if (typeof lifeTap === 'function' && lifeTap(sx, sy)) return;
  const c = screenToCell(sx, sy);
  if (!c) return;
  const n = world.occ[idx(c.x, c.y)];
  if (!n) {
    if (ui.objSel) {
      ui.objSel = null;
      ui.objMove = null;
      updatePendBar();
    }
    return;
  }
  const o = world.objects[n - 1];
  if (o.type === LAB_TYPE) {
    toggleTechPanel(true);
    return;
  }
  if (objBarEligible()) {
    ui.objSel = o;
    ui.objMove = null;
    updatePendBar();
  }
}

function onShopClick(e) {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.classList.contains('close')) {
    toggleShop(false);
    return;
  }
  const slot = b.getAttribute('data-deal');
  if (slot !== null) {
    const r = buyDeal(+slot, b.getAttribute('data-day'));
    if (r === 'ok') { updateResBar(); updateShop(); saveWorld(); showToast('購得 ' + b.getAttribute('data-name')); }
    else showToast({ coin: '金幣不足', soldout: '已售罄', expired: '特賣已刷新，請重新選擇' }[r] || '無法購買');
    if (r === 'expired') updateShop();
    return;
  }
  const kind = b.getAttribute('data-kind');
  if (!kind) return;
  const mode = b.getAttribute('data-mode');
  if (shopTrade(kind, mode)) {
    updateResBar();
    updateShop();
    saveWorld();
  } else {
    showToast(mode === 'buy' ? '金幣不足' : RESOURCES[kind].name + ' 不足 ' + SHOP_LOT + ' 個');
  }
}

function updateResBar() {
  const p = productionPerSec();
  let html = '';
  for (const k in RESOURCES) {
    html += '<span class="res">' + RESOURCES[k].icon + ' ' + Math.floor(world.res[k] || 0).toLocaleString();
    if (p[k]) html += ' <small>+' + p[k].toFixed(1) + '/s</small>';
    html += '</span>';
  }
  if (html !== lastResHtml) {
    lastResHtml = html;
    document.getElementById('resbar').innerHTML = html;
  }
  const base = pendTotal();
  document.querySelectorAll('#toolbar button[data-tool]').forEach(b => {
    const d = OBJECTS[b.getAttribute('data-tool')];
    if (d) b.classList.toggle('poor', !canAfford(addCost(base, objCost(b.getAttribute('data-tool')))));
  });
  if (ui.shopOpen) updateShop();
  if (ui.techOpen) updateTechPanel();
  updatePendBar();
}

function updateShop() {
  const list = ensureDeals();
  if (ui.dealDay && ui.dealDay !== world.deals.day) showToast('每日特賣已刷新');
  ui.dealDay = world.deals.day;
  let html = '<div class="head"><b>商店</b><button class="close">✕</button></div>';
  for (const k in SHOP) {
    const s = SHOP[k], r = RESOURCES[k], have = world.res[k] || 0;
    const buyCost = shopPrice(k, 'buy'), sellGain = shopPrice(k, 'sell');
    html += '<div class="row"><span>' + r.icon + ' ' + r.name + ' 持有 ' + Math.floor(have).toLocaleString() + '</span>' +
      '<button data-kind="' + k + '" data-mode="buy"' + (canAfford({ coin: buyCost }) ? '' : ' disabled') + '>買 ' + SHOP_LOT + '（🪙 ' + buyCost + '）</button>' +
      '<button data-kind="' + k + '" data-mode="sell"' + (have >= SHOP_LOT ? '' : ' disabled') + '>賣 ' + SHOP_LOT + '（得 🪙 ' + sellGain + '）</button></div>';
  }
  html += '<div class="dhead"><b>每日特賣</b><span id="dealTimer"></span></div>';
  for (const d of list) {
    const left = dealLeft(d);
    const dis = (left === 0 || !canAfford({ coin: d.price })) ? ' disabled' : '';
    html += '<div class="row deal' + (left === 0 ? ' out' : '') + '" style="border-left-color:' + DEAL_RARITY[d.rarity].color + '">' +
      '<span class="dinfo"><span>' + d.icon + ' ' + d.name + '</span><small>' + DEAL_RARITY[d.rarity].name + ' · ' + costText(d.give) + ' · 剩 ' + left + '/' + d.limit + '</small></span>' +
      '<span class="dprice"><s>🪙' + d.base + '</s><br>🪙' + d.price + ' <em>' + d.pct + '折</em></span>' +
      '<button data-deal="' + d.slot + '" data-day="' + world.deals.day + '" data-name="' + d.name + '"' + dis + '>' + (left === 0 ? '售罄' : '買') + '</button></div>';
  }
  if (html !== lastShopHtml) {
    lastShopHtml = html;
    document.getElementById('shop').innerHTML = html;
  }
  updateDealTimer();
}

function updateDealTimer() {
  const el = document.getElementById('dealTimer');
  if (!el) return;
  const ms = msToNextDeals();
  if (ms < 0) {
    el.textContent = '系統時間異常，暫停刷新';
    return;
  }
  const s = Math.ceil(ms / 1000);
  const p = n => (n < 10 ? '0' : '') + n;
  el.textContent = '⏳ ' + p(Math.floor(s / 3600)) + ':' + p(Math.floor(s % 3600 / 60)) + ':' + p(s % 60) + ' 後刷新';
}

function toggleShop(open) {
  ui.shopOpen = open === undefined ? !ui.shopOpen : !!open;
  document.getElementById('shop').hidden = !ui.shopOpen;
  if (ui.shopOpen) {
    toggleTplMenu(false);
    toggleTechPanel(false);
    updateShop();
  }
}

function toggleTplMenu(open) {
  ui.tplOpen = open === undefined ? !ui.tplOpen : !!open;
  document.getElementById('tplMenu').hidden = !ui.tplOpen;
  if (ui.tplOpen) {
    toggleShop(false);
    toggleTechPanel(false);
    buildTplMenu();
  }
}

function buildTplMenu() {
  const menu = document.getElementById('tplMenu');
  menu.textContent = '';
  const head = document.createElement('b');
  head.textContent = '範本';
  menu.appendChild(head);
  const close = document.createElement('button');
  close.className = 'close';
  close.textContent = '✕';
  menu.appendChild(close);
  const dflt = defaultTemplate(world.board);
  const restore = document.createElement('button');
  restore.className = 'tpl';
  restore.setAttribute('data-default', '');
  restore.textContent = '恢復預設';
  const rs = document.createElement('small');
  rs.textContent = dflt ? '套用本布置的預設範本：' + dflt.name : '此布置沒有預設範本';
  restore.appendChild(rs);
  restore.disabled = !dflt;
  menu.appendChild(restore);
  const list = TEMPLATES.filter(t => (t.kind || 'estate') === world.board);
  const ordered = list.filter(t => t.isDefault).concat(list.filter(t => !t.isDefault));
  for (const t of ordered) {
    const btn = document.createElement('button');
    btn.className = 'tpl';
    btn.setAttribute('data-tpl', t.id);
    btn.textContent = t.name + (t.isDefault ? ' ★預設' : '');
    const small = document.createElement('small');
    small.textContent = t.desc + '　' + t.w + '×' + t.h;
    btn.appendChild(small);
    btn.disabled = t.w > MAP_W || t.h > MAP_H;
    menu.appendChild(btn);
  }
}

function onTplClick(e) {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.classList.contains('close')) {
    toggleTplMenu(false);
    return;
  }
  const isDef = b.hasAttribute('data-default');
  const t = isDef ? defaultTemplate(world.board) : TEMPLATES.find(tp => tp.id === b.getAttribute('data-tpl'));
  if (!t) return;
  if (!confirm('套用範本「' + t.name + '」？目前的布置會被覆蓋,資源與科技不會改變。' + pendWarnText())) return;
  pendClear();
  hideReset();
  const r = isDef ? applyDefaultTemplate(world.board) : applyTemplate(t.id);
  if (!r) {
    showToast('範本無法套用');
    return;
  }
  saveWorld();
  centerOnCell(r.ox + t.focus[0], r.oy + t.focus[1]);
  mapeditRefresh();
  updateResBar();
  toggleTplMenu(false);
  showToast('已套用 ' + t.name + (r.failed ? '（' + r.failed + ' 件無法放置）' : ''));
}

// 科研院面板（PLAN_TECH §5）：研發中卡片＋軍事／經濟頁籤，依階分組
function toggleTechPanel(open) {
  ui.techOpen = open === undefined ? !ui.techOpen : !!open;
  document.getElementById('techPanel').hidden = !ui.techOpen;
  if (ui.techOpen) {
    toggleShop(false);
    toggleTplMenu(false);
    lastTechHtml = '';
    updateTechPanel();
  }
}

function techTimeText(sec) {
  const m = Math.ceil(sec / 60), h = Math.floor(m / 60), r = m % 60;
  return h > 0 ? h + ' 時' + (r ? ' ' + r + ' 分' : '') : m + ' 分';
}

function techNodeHtml(id) {
  const T = TECHS[id];
  const name = T.icon + ' ' + T.name;
  if (techHas(id)) return '<div class="node done"><div class="ninfo"><span>✅ ' + name + '</span><small>' + T.desc + '</small></div></div>';
  if (world.tech.cur && world.tech.cur.id === id) return '<div class="node"><div class="ninfo"><span>⏳ ' + name + '</span><small>研發中</small></div></div>';
  if (!techAvailable(id)) {
    const miss = T.req.filter(r => !techHas(r)).map(r => TECHS[r].name).join('、');
    return '<div class="node lock"><div class="ninfo"><span>' + name + '</span><small>需先研發 ' + miss + '</small></div><span>🔒</span></div>';
  }
  const why = canResearch(id);
  let extra = '';
  if (why === '資源不足') extra = '<small class="lack">缺 ' + costText(missingOf(techCost(id))) + '</small>';
  else if (why && why.indexOf('正在研發') !== 0) extra = '<small>' + why + '</small>';
  return '<div class="node"><div class="ninfo"><span>' + name + '</span><small>' + T.desc + '</small><small>' +
    costText(techCost(id)) + ' · ' + techTimeText(techTime(id)) + '</small>' + extra + '</div>' +
    '<button data-tech="' + id + '"' + (why ? ' disabled' : '') + '>研發</button></div>';
}

function updateTechPanel() {
  const c = world.tech.cur;
  let html = '<b>📜 科研院</b><button class="close">✕</button>';
  if (c) {
    const T = TECHS[c.id];
    html += '<div class="tcur"><div><b>⏳ ' + T.icon + ' ' + T.name + '</b> ' + T.desc + '</div>';
    if (!labBuilt()) html += '<div>科研院已拆除：研發暫停</div>';
    html += '<div class="tbar"><i id="techBarFill"></i></div><span id="techTimer"></span> <button data-tact="cancel">取消</button></div>';
  } else {
    html += '<div class="tier">尚未研發，選一項開始</div>';
  }
  html += '<div class="ttabs">';
  for (const tr in TECH_TREES) {
    if (tr === 'mil') continue;   // M2-01：軍事分頁隱藏（tech.js 軍事資料保留）
    let n = 0, all = 0;
    for (const id in TECHS) {
      if (TECHS[id].tree !== tr) continue;
      all++;
      if (techHas(id)) n++;
    }
    html += '<button data-ttab="' + tr + '"' + (ui.techTab === tr ? ' class="on"' : '') + '>' + (tr === 'mil' ? '⚔️' : '🌾') + ' ' + TECH_TREES[tr] + ' ' + n + '/' + all + '</button>';
  }
  html += '</div>';
  for (let t = 1; t <= 5; t++) {
    const ids = Object.keys(TECHS).filter(id => TECHS[id].tree === ui.techTab && TECHS[id].tier === t);
    if (!ids.length) continue;
    html += '<div class="tier">' + TECH_TIER[t].name + ' · ' + techTimeText(techTime(ids[0])) + '</div>';
    ids.forEach(id => { html += techNodeHtml(id); });
  }
  if (html !== lastTechHtml) {
    lastTechHtml = html;
    document.getElementById('techPanel').innerHTML = html;
  }
  updateTechTimer();
}

function updateTechTimer() {
  const c = world.tech.cur;
  if (!c) return;
  const s = Math.max(0, Math.ceil(c.left));
  const p = n => (n < 10 ? '0' : '') + n;
  const el = document.getElementById('techTimer');
  const fill = document.getElementById('techBarFill');
  if (el) el.textContent = !labBuilt() ? '暫停' : (s >= 3600 ? Math.floor(s / 3600) + ':' : '') + p(Math.floor(s % 3600 / 60)) + ':' + p(s % 60);
  if (fill) fill.style.width = ((1 - c.left / c.total) * 100).toFixed(1) + '%';
}

function onTechClick(e) {
  const b = e.target.closest('button');
  if (!b) return;
  audioUnlock();
  if (b.classList.contains('close')) {
    toggleTechPanel(false);
    return;
  }
  const tab = b.getAttribute('data-ttab');
  if (tab !== null) {
    ui.techTab = tab;
    updateTechPanel();
    return;
  }
  const tid = b.getAttribute('data-tech');
  if (tid !== null) {
    const r = startResearch(tid);
    if (r === '') {
      saveWorld();
      updateResBar();
      showToast('開始研發 ' + TECHS[tid].name + '，需 ' + techTimeText(techTime(tid)));
    } else {
      beep();
      showToast(r);
    }
    return;
  }
  if (b.getAttribute('data-tact') === 'cancel') {
    const c = world.tech.cur;
    if (!c) return;
    if (c.total - c.left >= 60 && !confirm('取消研發「' + TECHS[c.id].name + '」？進度會消失，資源全額退還。')) return;
    const cid = c.id;
    cancelResearch();
    saveWorld();
    updateResBar();
    showToast('已取消研發，退還 ' + costText(techCost(cid)));
  }
}

function onTechDone(id, delayed) {
  const T = TECHS[id];
  saveWorld();
  lastShopHtml = '';
  if (T.fx.some(f => f.key === 'build.cost')) {
    buildToolbar();
    const key = ui.tool === null ? '' : ui.tool;
    document.querySelectorAll('#toolbar button').forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-tool') === key);
    });
  }
  updateResBar();
  const msg = '📜 研發完成：' + T.icon + ' ' + T.name;
  if (delayed) setTimeout(() => showToast(msg), 2200);
  else showToast(msg);
}

function flushTechDone() {
  if (techOfflineDone) {
    const id = techOfflineDone;
    techOfflineDone = '';
    onTechDone(id, true);
  }
}

// 短促低音（PLAN 12.6）：WebAudio 即時合成，不用音檔；任何失敗只 warn，不影響遊戲
const MUTE_KEY = 'lorddomain.mute';
let audioCtx = null;

// 需在使用者手勢內呼叫（pointerdown/pointerup/click），iOS 才允許建立／恢復 AudioContext
function audioUnlock() {
  if (typeof AU !== 'undefined' && AU && AU.unlock) {
    AU.unlock();
    return null;
  }
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!audioCtx) audioCtx = new AC();
    if (audioCtx.state === 'suspended') {
      const p = audioCtx.resume();
      if (p && p.catch) p.catch(e => console.warn('[beep] resume failed', e));
    }
    return audioCtx;
  } catch (e) {
    console.warn('[beep] init failed', e);
    return null;
  }
}

function isMuted() {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch (e) {
    console.warn('[beep] storage unavailable', e);
    return false;
  }
}

function beep() {
  if (typeof auPlay === 'function') {
    auPlay('error');
    return;
  }
  if (isMuted()) return;
  const ac = audioUnlock();
  if (!ac) return;
  try {
    const t = ac.currentTime;
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.exponentialRampToValueAtTime(150, t + 0.12);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.05, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
    osc.connect(g);
    g.connect(ac.destination);
    osc.start(t);
    osc.stop(t + 0.14);
  } catch (e) {
    console.warn('[beep] play failed', e);
  }
}

function updatePendBar() {
  const bar = document.getElementById('pendBar');
  const n = pend.list.length;
  document.body.classList.toggle('pending', n > 0);
  document.body.classList.toggle('psel', n > 0 && pend.sel >= 0);
  if (!n) {
    bar.hidden = true;
    lastPendHtml = '';
    updateObjBar();
    return;
  }
  const total = pendTotal();
  let html = '<div class="prow"><b>待購 ' + n + ' 件</b><span class="pcost">';
  for (const k in RESOURCES) {
    if (!total[k]) continue;
    html += '<span' + ((world.res[k] || 0) < total[k] ? ' class="lack"' : '') + '>' + RESOURCES[k].icon + total[k].toLocaleString() + '</span>';
  }
  html += '</span><button class="pno" data-pact="cancel" title="全部取消">✕</button><button class="pok" data-pact="buy" title="全部購買">✓</button></div>';
  if (pend.sel >= 0) {
    const d = OBJECTS[pend.list[pend.sel].type];
    html += '<div class="prow sel"><span class="pname">' + d.icon + ' ' + d.name + '</span>' +
      '<button data-pact="rot">↻ 旋轉</button>' +
      '<button data-pact="move"' + (pend.moving ? ' class="on"' : '') + '>✥ 移動</button>' +
      '<button data-pact="del">🗑 移除</button>' +
      '<button data-pact="done">完成</button></div>';
  }
  if (html !== lastPendHtml) {
    lastPendHtml = html;
    bar.innerHTML = html;
  }
  bar.hidden = false;
  bar.style.bottom = (bottomStackPx() + 6) + 'px';
  updateObjBar();
}

// 經營布置瀏覽模式點選已蓋建築:底部操作列(旋轉 / 移動 / 拆除 / 完成)。位於待購條上方(若有)
function objBarEligible() {
  return game.mode === 'estate' && ui.tool === null && !hide.on && !game.backup;
}
function objSelIndex() {
  return ui.objSel ? world.objects.indexOf(ui.objSel) : -1;
}
function objFailReason(n, x, y, rot) {
  const o = world.objects[n], d = OBJECTS[o.type];
  const [w, h] = footprint(o.type, rot);
  if (x < 0 || y < 0 || x + w > MAP_W || y + h > MAP_H) return '超出邊界';
  const h0 = world.height[idx(x, y)];
  for (let yy = y; yy < y + h; yy++) {
    for (let xx = x; xx < x + w; xx++) {
      const i = idx(xx, yy);
      if (pend.occ[i]) return '與待購建築重疊';
      if (world.occ[i] && world.occ[i] !== n + 1) return '已有物件';
      if (world.height[i] !== h0) return '高度不一致';
      if (d.on.indexOf(world.terrain[i]) < 0) return '地形不符';
    }
  }
  return '未知原因';
}
function objPost() {
  rebuildOcc();
  saveWorld();
  updateResBar();
  mapeditRefresh();
}
function objRotate() {
  const n = objSelIndex();
  if (n < 0) return false;
  const o = world.objects[n];
  for (let k = 1; k <= 3; k++) {
    const r = (o.rot + k) % 4;
    if (objFitAt(n, o.x, o.y, r)) {
      o.rot = r;
      o.facing = r;
      objPost();
      return true;
    }
  }
  showToast('此處空間不足，無法旋轉');
  return false;
}
function objMoveTo(x, y) {
  const n = objSelIndex();
  if (n < 0) {
    ui.objMove = null;
    return false;
  }
  const o = world.objects[n];
  if (!objFitAt(n, x, y, o.rot)) {
    showToast('無法移到此處：' + objFailReason(n, x, y, o.rot));
    return false;
  }
  o.x = x;
  o.y = y;
  ui.objMove = null;
  preview.visible = false;
  objPost();
  showToast('已移動 ' + OBJECTS[o.type].name);
  return true;
}
function objDemolish() {
  const n = objSelIndex();
  if (n < 0) return;
  const o = world.objects[n];
  const name = OBJECTS[o.type].name;
  const refund = refundOf(o.type);
  const labBusy = o.type === LAB_TYPE && world.tech.cur;
  if (!confirm('拆除「' + name + '」？退還 ' + costText(refund) + '（依拆除規則，約為造價的一半）。' +
    (labBusy ? '\n科研院研發將暫停，重建後繼續。' : ''))) return;
  removeObjectAt(o.x, o.y, true);
  ui.objSel = null;
  ui.objMove = null;
  preview.visible = false;
  if (typeof auPlay === 'function') auPlay('remove');
  showToast('已拆除 ' + name + '，退還 ' + costText(refund));
  objPost();
}
function updateObjBar() {
  const bar = document.getElementById('objBar');
  if (!bar) return;
  let n = objSelIndex();
  if (ui.objSel && (n < 0 || !objBarEligible())) {
    ui.objSel = null;
    ui.objMove = null;
    n = -1;
  }
  if (n < 0) {
    bar.hidden = true;
    lastObjHtml = '';
    return;
  }
  const o = world.objects[n], d = OBJECTS[o.type];
  const mv = ui.objMove === o;
  const html = '<div class="prow"><span class="pname">' + d.icon + ' ' + d.name + (mv ? '（點選新位置放下）' : '') + '</span>' +
    '<button data-oact="rot">↻ 旋轉</button>' +
    '<button data-oact="move"' + (mv ? ' class="on"' : '') + '>✥ 移動</button>' +
    '<button data-oact="del" class="del">🗑 拆除</button>' +
    '<button data-oact="done">完成</button></div>';
  if (html !== lastObjHtml) {
    lastObjHtml = html;
    bar.innerHTML = html;
  }
  bar.hidden = false;
  if (document.body.classList.contains('tb-fold')) {
    bar.style.bottom = '';
  } else {
    const pb = document.getElementById('pendBar');
    const up = pb && !pb.hidden ? pb.offsetHeight + 6 : 0;
    bar.style.bottom = 'calc(' + (bottomStackPx() + 6 + up) + 'px + env(safe-area-inset-bottom))';
  }
}
function onObjClick(e) {
  const b = e.target.closest('button');
  if (!b) return;
  audioUnlock();
  const n = objSelIndex();
  if (n < 0) return;
  const act = b.getAttribute('data-oact');
  const o = world.objects[n];
  if (act === 'rot') objRotate();
  else if (act === 'move') ui.objMove = ui.objMove === o ? null : o;
  else if (act === 'del') objDemolish();
  else if (act === 'done') {
    ui.objSel = null;
    ui.objMove = null;
  }
  preview.visible = false;
  updateResBar();
}

function onPendClick(e) {
  const b = e.target.closest('button');
  if (!b) return;
  audioUnlock();
  const act = b.getAttribute('data-pact');
  if (act === 'buy') {
    commitPending();
  } else if (act === 'cancel') {
    const n = pend.list.length;
    if (n >= 5 && !confirm('取消全部 ' + n + ' 件待購建築？')) return;
    pendClear();
    showToast('已取消 ' + n + ' 件待購');
  } else if (pend.sel < 0) {
    return;
  } else if (act === 'rot') {
    pendRotateSel();
  } else if (act === 'move') {
    pend.moving = !pend.moving;
  } else if (act === 'del') {
    const name = OBJECTS[pend.list[pend.sel].type].name;
    pendRemove(pend.sel);
    showToast('已移除待購 ' + name);
  } else if (act === 'done') {
    pend.sel = -1;
    pend.moving = false;
  }
  preview.visible = false;
  updateResBar();
}

function commitPending() {
  const total = pendTotal();
  const hadLab = labBuilt();
  const r = pendCommit();
  if (r.ok) {
    saveWorld();
    if (typeof auPlay === 'function') auPlay('place');
    showToast('已建造 ' + r.n + ' 件，花費 ' + costText(r.cost));
    if (!hadLab && labBuilt()) showToast('科研院落成！切到 ✋ 瀏覽，點一下科研院即可研發');
  } else if (r.why === 'res') {
    beep();
    showToast('資源不足：缺 ' + costText(missingOf(total)));
  } else {
    pend.sel = r.i;
    pend.moving = false;
    showToast('第 ' + (r.i + 1) + ' 件已無法放置，請移動或移除');
  }
  mapeditRefresh();
}

function showToast(msg) {
  if (!toastEl) return;
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2000);
}

function syncSeasonSelect() {
  document.getElementById('selSeason').value = currentSeason;
}

function costText(cost) {
  return Object.keys(cost).filter(k => cost[k] > 0).map(k => RESOURCES[k].icon + cost[k]).join(' ');
}

function prodText(p) {
  return Object.keys(p).map(k => RESOURCES[k].icon + p[k]).join(' ') + '/秒';
}

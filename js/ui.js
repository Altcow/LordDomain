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

// 頂層分類(底部列最左的選擇器):瀏覽 / 地形 / 一般建築 / 軍事建築。BUILD_TOP:BUILD_GROUPS 群組 id → 建築頂層(misc = 不在任何群組者);
// 軍事建築 = 軍事與營地(mil);城牆、城門、階梯、斜坡等雖有防禦用途,留在「城牆與道路」(一般建築),不重複放。
const BUILD_TOP = { live: 'gen', shop: 'gen', farm: 'gen', ind: 'gen', mil: 'mil', garden: 'gen', rite: 'gen', road: 'gen', misc: 'gen' };
const TOP_LIST = [
  { id: 'browse', icon: '✋', name: '瀏覽', short: '瀏覽' },
  { id: 'terrain', icon: '⛰', name: '地形', short: '地形' },
  { id: 'gen', icon: '🏠', name: '一般建築', short: '一般' },
  { id: 'mil', icon: '⚔', name: '軍事建築', short: '軍事' }
];
// 地形頂層內容(不含拆除:拆除只在建築頂層出現)
const TERRAIN_MENU = ['road', 'grass', 'lake', 'river', 'raise', 'lower'];
// 變體群組:群組第一個為代表(選單只顯示代表),其餘變體在選到代表後以小圖示列選擇;變體仍是合法物件 id(舊存檔與範本照常)
const VARIANT_GROUPS = {
  tree: ['tree', 'tree_pine', 'tree_willow', 'tree_sakura', 'tree_maple', 'tree_mulberry', 'tree_peach', 'tree_cypress']
};
const UI_TOP_KEY = 'lorddomain.ui.top';
const UI_CAT_KEY = 'lorddomain.ui.cat';
const UI_VAR_KEY = 'lorddomain.ui.variant';

const ui = { tool: null, editing: false, rot: 0, shopOpen: false, dealDay: '', tplOpen: false, techOpen: false, techTab: 'eco', buildCat: 'all', top: 'gen', variant: {}, objSel: null };
let topMenuOpen = false;

// 單一物件草稿(虛影):{ type, x, y, rot, orig, ok, reason }。orig 為「移動已蓋建築」時的原建築物件(仍在 world.objects、由 objHold 暫時排除)。
// 草稿不占 world.occ / pend.occ、不計價、不進存檔;✓ 才轉為待購項(新建)或放回新位置(移動)。
let draft = null;
let draftGrab = null;
let fxHi = null;   // 輕點高亮 / 落地光圈(render.js drawFx)
let draftFloatKey = '', lastFloatHtml = '';
let lastDraftHtml = '', lastSettleHtml = '';

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
  uiInitMode();
  uiMenuLoad();
  buildToolbar();
  initSideUI();
  setTool(null);
  bindEvents(canvas);
  syncSeasonSelect();
  updateResBar();
  if (typeof initMapEdit === 'function') initMapEdit();
  if (typeof settingsAddRow === 'function') settingsAddRow('📋 範本…', openTemplatesFromSettings, '畫面');
}

// 介面模式(lorddomain.ui.mode):normal 正常 / compact 精簡 / photo 拍照。
// 位置與尺寸由 CSS 依模式與直橫向固定,切換模式不移動按鈕。舊 key lorddomain.ui.compact==='1' 首次載入視為精簡。
const UI_MODE_KEY = 'lorddomain.ui.mode';
const UI_PREV_KEY = 'lorddomain.ui.prevMode';
const UI_LEGACY_COMPACT = 'lorddomain.ui.compact';
const UI_MODES = ['normal', 'compact', 'photo'];
let uiMode = 'normal';
let uiPrevMode = 'normal';
let uiCatOpen = false;
function uiStorageGet(key) {
  try {
    return localStorage.getItem(key);
  } catch (e) {
    console.warn('[ui] pref read failed', e);
    return null;
  }
}
function uiStorageSet(key, v) {
  try {
    localStorage.setItem(key, v);
  } catch (e) {
    console.warn('[ui] pref write failed', e);
  }
}
function uiValidMode(m, fallback) {
  return UI_MODES.indexOf(m) >= 0 ? m : fallback;
}
function uiLoadMode() {
  const saved = uiStorageGet(UI_MODE_KEY);
  if (saved === null && uiStorageGet(UI_LEGACY_COMPACT) === '1') {
    uiStorageSet(UI_MODE_KEY, 'compact');
    return 'compact';
  }
  return uiValidMode(saved, 'normal');
}
function uiGetMode() { return uiMode; }
function uiIsCompact() { return uiMode === 'compact'; }
function uiIsPhoto() { return uiMode === 'photo'; }

function uiInitMode() {
  uiMode = uiLoadMode();
  uiPrevMode = uiValidMode(uiStorageGet(UI_PREV_KEY), 'normal');
  if (uiPrevMode === 'photo') uiPrevMode = 'normal';
  uiApplyMode();
}
function uiApplyMode() {
  const b = document.body;
  if (!b) return;
  b.classList.toggle('ui-compact', uiMode === 'compact');
  b.classList.toggle('photo-mode', uiMode === 'photo');
  syncSideBar();
}
// 切換介面模式。進入拍照前記下原模式,還原鈕回到該模式
function uiSetMode(m) {
  m = uiValidMode(m, '');
  if (!m || m === uiMode) return;
  if (m === 'photo' && ui.editing) {
    editGuard(() => uiSetMode('photo'));
    return;
  }
  if (m === 'photo') {
    uiPrevMode = uiMode;
    uiStorageSet(UI_PREV_KEY, uiPrevMode);
    setTool(null);
  }
  uiMode = m;
  uiStorageSet(UI_MODE_KEY, m);
  uiCatOpen = false;
  uiApplyMode();
  buildToolbar();
  updateResBar();
}

// 右側邊欄與頂列收進來的功能。top:true 的項目在正常模式留在頂列(原按鈕),精簡模式改由邊欄展開。
// target 為既有按鈕 id,點擊時代為 click(原按鈕與其監聽不變);scope 限定經營(estate)或戰鬥布置(camp)
const UI_SIDE_ITEMS = [
  { key: 'edit', icon: '🔨', label: '布置', title: '草稿布置(單一草稿,存到版面格)', scope: 'all', special: 'edit' },
  { key: 'hide', icon: '👁', label: '建築', title: '隱藏建築（整地用，H）', top: true, scope: 'all', target: 'btnHide' },
  { key: 'fish', icon: '🎣', label: '釣魚', title: '釣魚', top: true, scope: 'estate', target: 'btnFish', gate: 'fishing' },
  { key: 'pet', icon: '🐲', label: '仙獸', title: '仙獸苑', top: true, scope: 'estate', target: 'btnPet', gate: 'pet' },
  { key: 'sandbox', icon: '⚔', label: '沙盤', title: '沙盤推演', top: true, scope: 'camp', target: 'btnSandbox' },
  { key: 'shop', icon: '🏪', label: '商店', title: '商店', scope: 'estate', target: 'btnShop', gate: 'shop' },
  { key: 'save', icon: '💾', label: '存檔', title: '布置存檔', scope: 'estate', target: 'btnLayoutSave' },
  { key: 'season', icon: '🌤', label: '季節', title: '季節與時段', scope: 'estate', target: 'seasonBtn' },
  { key: 'help', icon: '❓', label: '說明', title: '戰鬥布置工具說明', scope: 'camp', target: 'btnToolHelp' },
  { key: 'labels', icon: '🏷', label: '標籤', title: '顯示或隱藏範本的區域標籤', scope: 'camp', target: 'btnTplLabels' },
  { key: 'mode', icon: '⊞', label: '精簡', title: '切換正常 / 精簡介面', scope: 'all', special: 'mode' },
  { key: 'photo', icon: '📷', label: '拍照', title: '拍照模式(隱藏介面,只留還原鈕)', scope: 'all', special: 'photo', gate: 'photo' }
];

function initSideUI() {
  const side = document.createElement('div');
  side.id = 'sideBar';
  const more = document.createElement('button');
  more.id = 'sideMore';
  more.className = 'side-more';
  more.textContent = '⋯';
  more.title = '更多功能';
  more.setAttribute('aria-label', '更多功能');
  more.addEventListener('click', () => side.classList.toggle('open'));
  side.appendChild(more);
  const list = document.createElement('div');
  list.className = 'side-list';
  UI_SIDE_ITEMS.forEach(it => {
    const b = document.createElement('button');
    b.className = 'side-btn';
    b.setAttribute('data-px', it.key);
    b.setAttribute('data-scope', it.scope);
    b.setAttribute('data-top', it.top ? '1' : '0');
    b.title = it.title;
    b.setAttribute('aria-label', it.title);
    const ic = document.createElement('span');
    ic.className = 'ic';
    const lb = document.createElement('span');
    lb.className = 'lb';
    b.appendChild(ic);
    b.appendChild(lb);
    b.addEventListener('click', () => uiSideAct(it.key));
    list.appendChild(b);
  });
  side.appendChild(list);
  document.body.appendChild(side);
  document.addEventListener('pointerdown', e => {
    if (side.classList.contains('open') && !e.target.closest('#sideBar')) side.classList.remove('open');
    if (uiCatOpen && !e.target.closest('#catbar, #catMenuBtn')) {
      uiCatOpen = false;
      buildCatBar();
      buildVarBar();
    }
    if (topMenuOpen && !e.target.closest('#topMenu, #topSel')) {
      topMenuOpen = false;
      buildTopMenu();
    }
  });
  const back = document.createElement('button');
  back.id = 'photoBack';
  back.textContent = '還原';
  back.title = '還原介面';
  back.setAttribute('aria-label', '還原介面');
  back.addEventListener('click', () => uiSetMode(uiPrevMode));
  document.body.appendChild(back);
  syncSideBar();
  setInterval(syncSideBar, 300);
}

function uiSideAct(key) {
  const it = UI_SIDE_ITEMS.find(x => x.key === key);
  if (!it) return;
  if (it.special === 'mode') uiSetMode(uiMode === 'compact' ? 'normal' : 'compact');
  else if (it.special === 'edit') editSideAct();
  else if (it.special === 'photo') uiSetMode('photo');
  else {
    const t = document.getElementById(it.target);
    if (t) t.click();
  }
  const side = document.getElementById('sideBar');
  if (side) side.classList.remove('open');
}

// 邊欄按鈕跟隨原按鈕的隱藏與狀態(定時同步;行為仍由原按鈕負責)
function syncSideBar() {
  syncFeatureGate();
  editSyncUi();
  const side = document.getElementById('sideBar');
  if (!side) return;
  side.querySelectorAll('.side-btn').forEach(b => {
    const it = UI_SIDE_ITEMS.find(x => x.key === b.getAttribute('data-px'));
    if (!it) return;
    const orig = it.target ? document.getElementById(it.target) : null;
    let icon = it.icon;
    let label = it.label;
    if (it.special === 'mode') {
      icon = uiMode === 'compact' ? '⊟' : '⊞';
      label = uiMode === 'compact' ? '正常' : '精簡';
    } else if (it.key === 'hide') {
      icon = hide.on ? '🙈' : '👁';
      label = hide.on ? '隱藏中' : '建築';
    }
    let hid = it.target ? (!orig || !!orig.hidden) : false;
    if (it.gate && !isUnlocked('feature', it.gate)) hid = true;
    b.hidden = hid;
    b.classList.toggle('on', it.special === 'edit' ? !!ui.editing : !!(orig && orig.classList.contains('on')));
    b.querySelector('.ic').textContent = icon;
    b.querySelector('.lb').textContent = label;
  });
}

// 功能開放閘門(progdata PROG_UNLOCK_FEATURE):未開放的頂列鈕與邊欄項目完全不顯示(data-feat-locked,CSS 隱藏)。
// 本級剛開放時延後 2.2 秒 toast(避開升級提示),並在入口加解鎖紅點(progSeenMark)
const FEAT_GATE = [
  { id: 'fishing', name: '釣魚', btn: 'btnFish' },
  { id: 'pet', name: '仙獸苑', btn: 'btnPet' },
  { id: 'shop', name: '商店', btn: 'btnShop' },
  { id: 'photo', name: '拍照', btn: null }
];
const featOpenPrev = {};
let featSynced = false;
function featNameOf(id) {
  const f = FEAT_GATE.find(x => x.id === id);
  return f ? f.name : id;
}
// 入口防呆:未開放回 false 並 toast
function featGuard(id) {
  if (isUnlocked('feature', id)) return true;
  showToast('城市 ' + progUnlockLv('feature', id) + ' 級才開放' + featNameOf(id));
  return false;
}
function featDot(f, b) {
  const want = typeof progSeenMark === 'function' && !!progSeenMark('feature', f.id);
  if (want && !b.featDotEl) {
    const d = document.createElement('i');
    d.className = 'prog-dot';
    b.appendChild(d);
    b.featDotEl = d;
    b.style.position = 'relative';
  } else if (!want && b.featDotEl) {
    b.featDotEl.remove();
    b.featDotEl = null;
  }
  if (!b.featSeenBound) {
    b.featSeenBound = true;
    b.addEventListener('click', () => { if (typeof progSeenMark === 'function') progSeenMark('feature', f.id, true); });
  }
}
function syncFeatureGate() {
  FEAT_GATE.forEach(function (f) {
    const open = isUnlocked('feature', f.id);
    if (featSynced && open && featOpenPrev[f.id] === false) {
      const lv = progUnlockLv('feature', f.id);
      setTimeout(() => showToast('城市 ' + lv + ' 級開放:' + f.name), 2200);
    }
    featOpenPrev[f.id] = open;
    const b = f.btn ? document.getElementById(f.btn) : null;
    if (!b) return;
    if (open) b.removeAttribute('data-feat-locked'); else b.setAttribute('data-feat-locked', '1');
    featDot(f, b);
  });
  featSynced = true;
}

function bindEvents(canvas) {
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  canvas.addEventListener('pointerdown', onPointerDown);
  // 資訊面板(商店 / 範本 / 科研 / 說明):點畫布空白處收起,不必找 ✕
  canvas.addEventListener('pointerdown', () => {
    if (ui.shopOpen) toggleShop(false);
    if (ui.tplOpen) toggleTplMenu(false);
    if (ui.techOpen) toggleTechPanel(false);
    const th = document.getElementById('toolHelp');
    if (th && !th.hidden && typeof toggleToolHelp === 'function') toggleToolHelp(false);
  });
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerEnd);
  canvas.addEventListener('pointercancel', onPointerEnd);
  canvas.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') preview.visible = false; });
  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.1 : 1 / 1.1);
  }, { passive: false });

  // 布置中按下釣魚 / 仙獸 / 出征 / 沙盤:有未存變更先跳 #leaveDlg 三選一,沒有則靜默離開布置(capture 階段攔截)
  document.addEventListener('click', e => {
    if (!ui.editing || editBypass) return;
    const t = e.target;
    if (!t || !t.closest) return;
    const el = t.closest('#btnFish, #btnPet, #btnAttack, #btnSandbox');
    if (!el) return;
    if (!editDirty()) {
      editLeave();
      return;
    }
    if (e.preventDefault) e.preventDefault();
    if (e.stopImmediatePropagation) e.stopImmediatePropagation();
    editLeaveDlgOpen(() => {
      editBypass = true;
      try { el.click(); } finally { editBypass = false; }
    });
  }, true);
  // 進入釣魚 / 仙獸 / 出征 / 重播前收起城市等級抽屜(progui.js 未載入時略過)
  document.addEventListener('click', e => {
    const t = e.target;
    if (typeof progUiClose !== 'function' || !t || !t.closest) return;
    if (['#btnFish', '#btnPet', '#btnAttack'].some(s => t.closest(s))) progUiClose();
  }, true);
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
  const draftFloat = document.createElement('div');
  draftFloat.id = 'draftFloat';
  draftFloat.hidden = true;
  document.body.appendChild(draftFloat);
  draftFloat.addEventListener('pointerdown', e => e.stopPropagation());
  draftFloat.addEventListener('click', onFloatClick);
  const draftBar = document.createElement('div');
  draftBar.id = 'draftBar';
  draftBar.hidden = true;
  document.body.appendChild(draftBar);
  draftBar.addEventListener('pointerdown', e => e.stopPropagation());
  const settle = document.createElement('div');
  settle.id = 'settleDlg';
  settle.hidden = true;
  document.body.appendChild(settle);
  settle.addEventListener('pointerdown', e => e.stopPropagation());
  settle.addEventListener('click', onSettleClick);
  const leaveDlg = document.createElement('div');
  leaveDlg.id = 'leaveDlg';
  leaveDlg.hidden = true;
  document.body.appendChild(leaveDlg);
  leaveDlg.addEventListener('pointerdown', e => e.stopPropagation());
  leaveDlg.addEventListener('click', onLeaveClick);
  const layoutBtn = document.getElementById('btnLayoutSave');
  if (layoutBtn) layoutBtn.addEventListener('click', () => layoutSave());

  document.getElementById('btnShop').addEventListener('click', () => toggleShop());
  document.getElementById('btnHide').addEventListener('click', () => toggleHide());
  document.getElementById('selSeason').addEventListener('change', e => {
    setSeason(e.target.value);
    saveWorld();
  });
  document.getElementById('btnClear').addEventListener('click', () => {
    if (game.mode === 'battleDesign') {
      mapeditClear();
      return;
    }
    if (!confirm('清空領地上的所有建築與地形？資源與科技進度不會改變。' + pendWarnText())) return;
    draftDiscard();
    pendClear();
    hideReset();
    clearWorld();
    saveWorld();
    updateResBar();
  });
  document.addEventListener('keydown', e => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (uiIsPhoto()) return;
    if (e.key === 'Escape' && editLeaveDlgIsOpen()) {
      editLeaveDlgClose();
      return;
    }
    if (e.key === 'Escape' && settleOpen()) {
      closeSettle();
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
      if (draft) {
        draftCancel();
        return;
      }
      if (pend.sel >= 0 || pend.moving) {
        pend.sel = -1;
        pend.moving = false;
        preview.visible = false;
        updatePendBar();
        return;
      }
      if (ui.objSel) {
        ui.objSel = null;
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
  } else if (game.mode === 'estate') {
    buildTopToolbar(bar);
  } else {
    addToolButton(bar, null, '✋', '瀏覽', null);
    for (const id in TERRAIN_TOOLS) addToolButton(bar, id, TERRAIN_TOOLS[id].icon, TERRAIN_TOOLS[id].name, null);
  }
  syncToolActive();
  buildCatBar();
  buildTopMenu();
  buildVarBar();
}

// ---- 頂層分類 / 小分類 / 變體 ----
function uiMenuLoad() {
  const t = uiStorageGet(UI_TOP_KEY);
  if (TOP_LIST.some(x => x.id === t)) ui.top = t;
  const c = uiStorageGet(UI_CAT_KEY);
  if (c) ui.buildCat = c;
  const raw = uiStorageGet(UI_VAR_KEY);
  if (raw) {
    try {
      const v = JSON.parse(raw);
      if (v && typeof v === 'object') {
        for (const k in VARIANT_GROUPS) {
          if (typeof v[k] === 'string' && VARIANT_GROUPS[k].indexOf(v[k]) >= 0) ui.variant[k] = v[k];
        }
      }
    } catch (e) {
      console.warn('[ui] variant pref parse failed', e);
    }
  }
}
function uiMenuSave() {
  uiStorageSet(UI_TOP_KEY, ui.top);
  uiStorageSet(UI_CAT_KEY, ui.buildCat);
  uiStorageSet(UI_VAR_KEY, JSON.stringify(ui.variant));
}
function topIsBuild(top) { return top === 'gen' || top === 'mil'; }

// 變體:代表(群組第一個)與其餘變體;t 為 null 時原樣回傳
function varLeader(t) {
  if (t === null || t === undefined) return t;
  for (const k in VARIANT_GROUPS) {
    if (VARIANT_GROUPS[k].indexOf(t) >= 0) return k;
  }
  return t;
}
function varIsFollower(t) { return varLeader(t) !== t; }
// 目前模式已開放的變體(含代表)
function varList(leader) {
  const g = VARIANT_GROUPS[leader];
  return g ? g.filter(k => hasType(k) && sideOk(k)) : [];
}
// 選到代表時實際使用的物件 id(經營模式、且記住的變體仍開放);其餘情況為代表本身
function varResolve(leader) {
  if (game.mode !== 'estate' || !VARIANT_GROUPS[leader]) return leader;
  const want = ui.variant[leader];
  return want && varList(leader).indexOf(want) >= 0 ? want : leader;
}

// 物件所屬建築頂層(未列入任何群組者視為 misc)
let topOfMap = null;
function topOfItem(k) {
  if (!topOfMap) {
    topOfMap = {};
    BUILD_GROUPS.forEach(g => g.items.forEach(i => { topOfMap[i] = BUILD_TOP[g.id] || 'gen'; }));
  }
  return topOfMap[k] || BUILD_TOP.misc;
}
function topOfGroup(gid) { return BUILD_TOP[gid] || 'gen'; }

// 分類內容(sideOk 為真、變體只留代表):
// all = 該頂層全部(群組合併、不重複)/ 常用 / 各群組 / misc(不在任何群組者)。top 省略時用目前頂層
function buildCatIds(catId, top) {
  const ok = k => !!OBJECTS[k] && sideOk(k) && !varIsFollower(k);
  const t = top || (topIsBuild(ui.top) ? ui.top : null);
  if (catId === 'all') {
    const seen = {}, out = [];
    const add = k => { if (!seen[k] && ok(k)) { seen[k] = true; out.push(k); } };
    BUILD_GROUPS.forEach(g => { if (topOfGroup(g.id) === t) g.items.forEach(add); });
    if (BUILD_TOP.misc === t) buildCatIds('misc').forEach(add);
    return out;
  }
  if (catId === '常用') return BUILD_FAVS.filter(k => ok(k) && (!t || topOfItem(k) === t));
  if (catId === 'misc') {
    const listed = {};
    BUILD_GROUPS.forEach(g => g.items.forEach(k => { listed[k] = true; }));
    return Object.keys(OBJECTS).filter(k => !listed[k] && ok(k));
  }
  const g = BUILD_GROUPS.find(x => x.id === catId);
  return g ? g.items.filter(ok) : [];
}

// 經營建築分類的完整清單(不看等級開放,供鎖頭提示計數);經營側判定同 sideOk
function buildCatAllIds(catId, top) {
  const ok = k => hasType(k) && !OBJECTS[k].retired && (sideOf(k) === 'estate' || sideOf(k) === 'both') && !varIsFollower(k);
  const t = top || (topIsBuild(ui.top) ? ui.top : null);
  if (catId === 'all') {
    const seen = {}, out = [];
    const add = k => { if (!seen[k] && ok(k)) { seen[k] = true; out.push(k); } };
    BUILD_GROUPS.forEach(g => { if (topOfGroup(g.id) === t) g.items.forEach(add); });
    if (BUILD_TOP.misc === t) buildCatAllIds('misc').forEach(add);
    return out;
  }
  if (catId === '常用') return BUILD_FAVS.filter(k => ok(k) && (!t || topOfItem(k) === t));
  if (catId === 'misc') {
    const listed = {};
    BUILD_GROUPS.forEach(g => g.items.forEach(k => { listed[k] = true; }));
    return Object.keys(OBJECTS).filter(k => !listed[k] && ok(k));
  }
  const g = BUILD_GROUPS.find(x => x.id === catId);
  return g ? g.items.filter(ok) : [];
}

// 底部列:[頂層選擇器] + 對應內容(瀏覽=提示、地形=地形工具、建築=小分類內容 + 鎖頭提示 + 拆除固定在最右)
function buildTopToolbar(bar) {
  const cur = TOP_LIST.find(t => t.id === ui.top) || TOP_LIST[2];
  ui.top = cur.id;
  const sel = document.createElement('button');
  sel.id = 'topSel';
  sel.className = 'topsel';
  sel.setAttribute('data-topsel', cur.id);
  sel.innerHTML = '<span class="ic">' + cur.icon + '</span><span>' + cur.short + ' ▾</span>';
  sel.title = '分類：' + cur.name;
  sel.setAttribute('aria-label', sel.title);
  sel.addEventListener('click', () => {
    topMenuOpen = !topMenuOpen;
    buildTopMenu();
  });
  bar.appendChild(sel);
  if (cur.id === 'browse') {
    const hint = document.createElement('span');
    hint.className = 'tophint';
    hint.textContent = '平移縮放；按住建築可移動';
    bar.appendChild(hint);
    return;
  }
  if (cur.id === 'terrain') {
    TERRAIN_MENU.forEach(id => addToolButton(bar, id, TERRAIN_TOOLS[id].icon, TERRAIN_TOOLS[id].name, null));
    return;
  }
  if (uiIsCompact()) addCatMenuBtn(bar);
  if (!buildCatList(cur.id).some(c => c.id === ui.buildCat)) ui.buildCat = 'all';
  buildCatIds(ui.buildCat, cur.id).forEach(id => markNewBuild(addToolButton(bar, id, OBJECTS[id].icon, OBJECTS[id].name, OBJECTS[id]), id));
  addLockHintButton(bar, buildLockHint(ui.buildCat));
  const er = addToolButton(bar, 'erase', TERRAIN_TOOLS.erase.icon, TERRAIN_TOOLS.erase.name, null);
  er.classList.add('erasefix');
}

// 工具 t 是否屬於頂層 top 的內容(切換頂層時,不屬於者取消工具)
function topOwnsTool(t, top) {
  if (t === null || t === undefined) return true;
  if (top === 'terrain') return TERRAIN_MENU.indexOf(t) >= 0;
  if (topIsBuild(top)) return t === 'erase' || (!!OBJECTS[t] && topOfItem(varLeader(t)) === top);
  return false;
}
function topSet(top) {
  if (!TOP_LIST.some(x => x.id === top)) return;
  ui.top = top;
  ui.buildCat = 'all';
  topMenuOpen = false;
  uiCatOpen = false;
  uiMenuSave();
  if (!topOwnsTool(ui.tool, top)) setTool(null);
  buildToolbar();
  updateResBar();
}

function buildTopMenu() {
  let box = document.getElementById('topMenu');
  if (!box) {
    box = document.createElement('div');
    box.id = 'topMenu';
    document.body.appendChild(box);
    box.addEventListener('click', e => {
      const b = e.target.closest('button');
      if (b && b.getAttribute('data-top')) topSet(b.getAttribute('data-top'));
    });
  }
  box.hidden = !(topMenuOpen && game.mode === 'estate');
  box.textContent = '';
  TOP_LIST.forEach(t => {
    const b = document.createElement('button');
    b.setAttribute('data-top', t.id);
    if (t.id === ui.top) b.classList.add('on');
    b.innerHTML = '<span class="ic">' + t.icon + '</span><span>' + t.name + '</span>';
    box.appendChild(b);
  });
}

// 變體列(樹種):選到有變體的代表工具時,在底部列上方列出已開放變體;選哪個就用哪個放置
function buildVarBar() {
  let box = document.getElementById('varbar');
  if (!box) {
    box = document.createElement('div');
    box.id = 'varbar';
    document.body.appendChild(box);
    box.addEventListener('click', onVarClick);
  }
  const leader = game.mode === 'estate' && ui.tool !== null ? varLeader(ui.tool) : null;
  const list = leader && VARIANT_GROUPS[leader] ? varList(leader) : [];
  const show = list.length > 0 && !uiIsPhoto() && !(uiIsCompact() && uiCatOpen);
  box.hidden = !show;
  document.body.classList.toggle('has-varbar', show);
  box.textContent = '';
  if (!show) return;
  const lab = document.createElement('span');
  lab.className = 'vlabel';
  lab.textContent = '樹種';
  box.appendChild(lab);
  list.forEach(id => {
    const b = document.createElement('button');
    b.setAttribute('data-var', id);
    b.title = OBJECTS[id].name + ' ' + costText(objCost(id));
    if (id === ui.tool) b.classList.add('on');
    b.innerHTML = '<span class="ic">' + OBJECTS[id].icon + '</span><span>' + OBJECTS[id].name + '</span>';
    markNewBuild(b, id);
    box.appendChild(b);
  });
  const tb = document.getElementById('toolbar');
  const cb = document.getElementById('catbar');
  box.style.bottom = (tb ? tb.offsetHeight : 0) + (cb && !cb.hidden && !cb.classList.contains('pop') ? cb.offsetHeight : 0) + 'px';
}
function onVarClick(e) {
  const b = e.target.closest('button');
  const id = b && b.getAttribute('data-var');
  if (!id || !OBJECTS[id]) return;
  const leader = varLeader(id);
  ui.variant[leader] = id;
  uiMenuSave();
  if (typeof progSeenMark === 'function') progSeenMark('estate', id, true);
  setTool(id);
  showToast(OBJECTS[id].name);
}

// 鎖頭提示:分類內下一個要開放的等級(lv)與該級建築名稱(names);僅經營模式且有未開放者才有,否則 null
function buildLockHint(catId, top) {
  if (game.mode !== 'estate' || typeof progUnlockLv !== 'function' || typeof prog === 'undefined' || !prog) return null;
  let lv = null, names = [];
  buildCatAllIds(catId, top).forEach(k => {
    const L = progUnlockLv('estate', k);
    if (L === null || L <= prog.lv) return;
    if (lv === null || L < lv) { lv = L; names = []; }
    if (L === lv) names.push(OBJECTS[k].name);
  });
  return lv === null ? null : { lv: lv, names: names };
}

// 灰階「🔒 +n 於 Lv X」提示鈕(無 data-tool,不參與工具選取);點了 toast 列出該級開放的建築
function addLockHintButton(bar, hint) {
  if (!hint) return;
  const b = document.createElement('button');
  b.className = 'lockhint';
  b.textContent = '🔒 +' + hint.names.length + ' 於 Lv' + hint.lv;
  b.title = '城市 ' + hint.lv + ' 級開放';
  b.style.filter = 'grayscale(1)';
  b.style.opacity = '0.6';
  b.addEventListener('click', () => {
    const more = hint.names.length > 4 ? '…等 ' + hint.names.length + ' 項' : '';
    showToast('城市 ' + hint.lv + ' 級開放:' + hint.names.slice(0, 4).join('、') + more);
  });
  bar.appendChild(b);
}

// 已開放但本級才開放的建築:加解鎖紅點(progSeenMark);點擊即記為已看過並移除紅點
function markNewBuild(btn, id) {
  if (!btn || game.mode !== 'estate' || typeof progSeenMark !== 'function' || !progSeenMark('estate', id)) return btn;
  const dot = document.createElement('i');
  dot.className = 'prog-dot';
  btn.style.position = 'relative';
  btn.appendChild(dot);
  btn.addEventListener('click', () => {
    progSeenMark('estate', id, true);
    if (dot.parentNode) dot.remove();
  });
  return btn;
}

// 城市等級擋法:未開放回「城市 N 級才開放」,否則 ''(非經營/戰陣布置或未載入 prog 時恆為 '')
function progLockText(type) {
  const kind = game.mode === 'battleDesign' ? 'camp' : 'estate';
  if (!progRulesOn() || isUnlocked(kind, type)) return '';
  return '城市 ' + progUnlockLv(kind, type) + ' 級才開放';
}

// 經營布置免費(PLAN_PROGRESSION §2.6)時,費用與退款的顯示文字
function progFreeBuild() { return typeof PROG_FREE_BUILD !== 'undefined' && !!PROG_FREE_BUILD; }
function feeText(cost) { return costText(cost) || '免費'; }
function refundText(r) { return costText(r) || '免費建造,不退款'; }

// 小分類 chips(僅建築頂層):全部 N 第一顆、常用(該頂層內有已開放者才列)其後、再來該頂層的各群組與其他
function buildCatList(top) {
  top = top || ui.top;
  const out = [{ id: 'all', name: '全部', n: buildCatIds('all', top).length }];
  const fav = buildCatIds('常用', top).length;
  if (fav) out.push({ id: '常用', name: '常用', n: fav });
  BUILD_GROUPS.forEach(g => { if (topOfGroup(g.id) === top) out.push({ id: g.id, name: g.name, n: buildCatIds(g.id).length }); });
  if (BUILD_TOP.misc === top) {
    const misc = buildCatIds('misc').length;
    if (misc) out.push({ id: 'misc', name: '其他', n: misc });
  }
  return out;
}

// 工具列上方的小分類標籤列(橫向可捲動);只在經營模式的建築頂層顯示
function buildCatBar() {
  let box = document.getElementById('catbar');
  if (!box) {
    box = document.createElement('div');
    box.id = 'catbar';
    document.body.appendChild(box);
    box.addEventListener('click', onCatClick);
  }
  const on = game.mode === 'estate' && topIsBuild(ui.top);
  const pop = uiIsCompact();
  box.hidden = !(on && (!pop || uiCatOpen));
  box.classList.toggle('pop', pop);
  document.body.classList.toggle('has-catbar', on && !pop);
  if (!on) return;
  const tb = document.getElementById('toolbar');
  box.style.bottom = (tb ? tb.offsetHeight : 0) + (pop ? 6 : 0) + 'px';
  box.textContent = '';
  buildCatList(ui.top).forEach(c => {
    const b = document.createElement('button');
    b.setAttribute('data-cat', c.id);
    if (c.id === ui.buildCat) b.classList.add('on');
    b.innerHTML = c.name + ' <small>' + c.n + '</small>';
    box.appendChild(b);
  });
}

function addCatMenuBtn(bar) {
  const b = document.createElement('button');
  b.id = 'catMenuBtn';
  b.className = 'catmenu';
  const cur = buildCatList(ui.top).find(c => c.id === ui.buildCat);
  b.textContent = '☰';
  b.title = '建築分類：' + (cur ? cur.name : '全部');
  b.setAttribute('aria-label', b.title);
  b.addEventListener('click', () => {
    uiCatOpen = !uiCatOpen;
    buildCatBar();
  });
  bar.appendChild(b);
}

function onCatClick(e) {
  const b = e.target.closest('button');
  if (!b || !b.getAttribute('data-cat')) return;
  ui.buildCat = b.getAttribute('data-cat');
  uiCatOpen = false;
  uiMenuSave();
  buildToolbar();
  updateResBar();
}

function syncToolActive() {
  const key = ui.tool === null ? '' : varLeader(ui.tool);
  document.querySelectorAll('#toolbar button').forEach(b => {
    b.classList.toggle('active', b.getAttribute('data-tool') === key);
  });
}

// 底部疊放高度:工具列 + 分類列(顯示時),待購條與提示以此定位
function bottomStackPx() {
  const tb = document.getElementById('toolbar');
  const cb = document.getElementById('catbar');
  const vb = document.getElementById('varbar');
  return (tb ? tb.offsetHeight : 0) + (cb && !cb.hidden ? cb.offsetHeight : 0) + (vb && !vb.hidden ? vb.offsetHeight : 0);
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
    const on = ui.tool !== null && varLeader(ui.tool) === id;
    setTool(on ? null : varResolve(id));
    const hl = ui.tool === null ? '' : toolHelpLine(ui.tool);
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
  draftDiscard();
  closeSettle();
  ui.tool = id;
  const key = id === null ? '' : varLeader(id);
  document.querySelectorAll('#toolbar button').forEach(b => {
    b.classList.toggle('active', b.getAttribute('data-tool') === key);
  });
  preview.tool = id;
  preview.visible = false;
  document.getElementById('info').textContent = toolInfo();
  pend.sel = -1;
  pend.moving = false;
  ui.objSel = null;
  buildVarBar();
  updatePendBar();
}

function toolInfo() {
  const t = ui.tool;
  if (t === null) return '瀏覽模式：拖曳移動、滾輪／雙指縮放';
  if (draft) return '草稿：' + OBJECTS[draft.type].name + '　拖到想要的位置，按 ✓ 放下（✕ 或 Esc 取消）';
  const hl = toolHelpLine(t);
  if (hl) return hl;
  if (isCampTool(t)) return CAMP_TOOLS[t].name;
  if (OBJECTS[t]) {
    const d = OBJECTS[t];
    let s = d.name + '　成本 ' + feeText(objCost(t));
    if (d.prod) s += '　產出 ' + prodText(d.prod);
    if (d.unit && CAMP_POP[d.unit]) s += '　出征容量 +' + CAMP_POP[d.unit];
    return s;
  }
  return TERRAIN_TOOLS[t].name;
}

function rotate() {
  if (draft) {
    draftRotate();
    return;
  }
  if (pend.sel >= 0) {
    pendRotateSel();
    updatePendBar();
    return;
  }
  ui.rot = (ui.rot + 1) % 4;
  preview.rot = ui.rot;
  if (gs.last) updatePreviewAt(gs.last.x, gs.last.y);
}

function isDraggable(t) {
  if (pend.moving || draft) return false;
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
  if (draft) {
    preview.visible = false;
  } else if (pend.moving && pend.sel >= 0) {
    const o = pend.list[pend.sel];
    preview.tool = o.type;
    preview.rot = o.rot;
    preview.visible = true;
    preview.ok = canPlacePending(o.type, c.x, c.y, o.rot, pend.sel);
  } else {
    preview.tool = ui.tool;
    preview.rot = ui.rot;
    preview.visible = ui.tool !== null && !isCampTool(ui.tool);
    preview.ok = ui.tool === null || previewOk(ui.tool, c.x, c.y);
  }
  info.textContent = toolInfo() + '　(' + c.x + ',' + c.y + ') ' + TERRAIN_NAME[world.terrain[i]] + ' 高度' + world.height[i];
}

function placeFailReason(type, x, y, rot) {
  const lk = progLockText(type);
  if (lk) return lk;
  const cap = capOf(type);
  if (cap !== null && countObjects(type) >= cap) return OBJECTS[type].name + '最多只能蓋 ' + cap + ' 座';
  const [w, h] = footprint(type, rot);
  if (x < 0 || y < 0 || x + w > MAP_W || y + h > MAP_H) return '超出邊界';
  if (!landFits(x, y, w, h)) return '超出城市土地範圍';
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
  const lk = progLockText(type);
  if (lk) return lk;
  const cap = capOf(type);
  if (cap !== null && countObjects(type) + pendCount(type, skip) >= cap) return d.name + '最多只能蓋 ' + cap + ' 座（含待購）';
  const [w, h] = footprint(type, rot);
  if (x < 0 || y < 0 || x + w > MAP_W || y + h > MAP_H) return '超出邊界';
  if (!landFits(x, y, w, h)) return '超出城市土地範圍';
  for (let yy = y; yy < y + h; yy++)
    for (let xx = x; xx < x + w; xx++) {
      const n = pend.occ[idx(xx, yy)];
      if (n && n - 1 !== skip) return '與待購建築重疊';
    }
  return placeFailReason(type, x, y, rot);
}

function pendWarnText() {
  return pend.list.length ? '\n（目前 ' + pend.list.length + ' 件待購建築也會一併取消）' : '';
}

function toolActive() {
  if (uiIsPhoto()) return false;
  return ui.tool !== null || pend.moving;
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
    if (!paintTerrainKeep(x, y, target, ui.rot)) {
      warnOnce('超出城市土地範圍');
      return false;
    }
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
    if (!paintTerrainKeep(x, y, T_GRASS, 0)) {
      warnOnce('超出城市土地範圍');
      return false;
    }
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
  const t = ui.tool;
  if (t === null) return false;
  if (isCampTool(t)) return mapeditApply(t, x, y, 'down');
  const i = idx(x, y);
  const pn = pend.occ[i];
  if (hide.on) return applyHidden(t, x, y, i, pn);
  if (OBJECTS[t]) {
    if (!OBJECTS[t].drag) {
      if (draft) draftMoveTo(x, y);
      else if (pn) {
        if (!gs.op || gs.op.applied.size === 1) selectPending(pn - 1);
      } else if (!(gs.op && gs.op.selectOnly)) draftStart(t, x, y, ui.rot);
      return false;
    }
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
    if (progFreeBuild() && !commitPending()) pendClear();
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
    if (!paintTerrain(x, y, target, ui.rot)) {
      warnOnce('超出城市土地範圍');
      return false;
    }
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
    if (o.type === LAB_TYPE && world.tech.cur) showToast('已拆除 科研院，退還 ' + refundText(refund) + '；研發暫停，重建後繼續');
    else showToast('已拆除 ' + OBJECTS[o.type].name + '，退還 ' + refundText(refund));
    return true;
  }
  if (world.terrain[i] === T_ROAD) {
    if (!paintTerrain(x, y, T_GRASS, 0)) {
      warnOnce('超出城市土地範圍');
      return false;
    }
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
  if (uiIsPhoto()) {
    gs.mode = 'pan';
    return;
  }
  // 彈回動畫中不接受操作,視同平移
  if (draft && draft.bounce) {
    gs.mode = 'pan';
    return;
  }
  // 草稿:按住草稿本身拖曳移動;草稿外的點按視同點地圖移動草稿,拖曳則平移地圖
  if (draft && (e.pointerType !== 'mouse' || e.button === 0) && draftHit(x, y)) {
    gs.mode = 'draftdrag';
    gs.primary = e.pointerId;
    const c = screenToCell(x, y);
    draftGrab = { ox: c.x - draft.x, oy: c.y - draft.y, sx: draft.x, sy: draft.y, srot: draft.rot, edit: !!draft.edit, moved: false };
    return;
  }
  // 編輯狀態下點虛影以外的空白處:放開時完成(合法)或彈回(不合法);拖曳則平移地圖
  if (draft && draft.orig && draft.edit) {
    gs.mode = 'editout';
    gs.primary = e.pointerId;
    return;
  }
  // 已蓋建築:按住 HOLD_MS(位移 < HOLD_MOVE_PX)拿起;位移超過門檻改為平移
  if (!draft && holdEligible() && (e.pointerType !== 'mouse' || e.button === 0)) {
    const hc = screenToCell(x, y);
    const hn = hc ? world.occ[idx(hc.x, hc.y)] : 0;
    if (hn && world.objects[hn - 1]) {
      gs.mode = 'holdwait';
      gs.primary = e.pointerId;
      gs.holdObj = world.objects[hn - 1];
      clearTimeout(gs.timer);
      gs.timer = setTimeout(holdFire, HOLD_MS);
      return;
    }
  }
  if (e.pointerType === 'mouse') {
    if (e.button === 0 && toolActive() && !draft) {
      gs.mode = 'tool';
      beginOp();
      applyCellAt(x, y);
      return;
    }
    if (e.button !== 0 || !toolActive()) {
      gs.mode = 'pan';
      return;
    }
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
  } else if (gs.mode === 'holdwait' || gs.mode === 'editout') {
    if (Math.hypot(p.x - p.x0, p.y - p.y0) >= HOLD_MOVE_PX) {
      clearTimeout(gs.timer);
      gs.holdObj = null;
      gs.mode = 'pan';
      panBy(p.x - p.x0, p.y - p.y0);
      p.x0 = p.x;
      p.y0 = p.y;
    }
  } else if (gs.mode === 'draftdrag') {
    if (draftGrab && !draftGrab.moved && Math.hypot(p.x - p.x0, p.y - p.y0) >= HOLD_MOVE_PX) {
      draftGrab.moved = true;
      draftFloatKey = '';
    }
    if (draftGrab && (draftGrab.moved || !(draft && draft.orig))) draftDragTo(p.x, p.y);
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
  const up = e.type === 'pointerup';
  if (up && (gs.mode === 'pan' || gs.mode === 'holdwait') && gs.ptrs.size === 1 && ui.tool === null && !hide.on &&
      Math.hypot(p.x - p.x0, p.y - p.y0) < 8 && performance.now() - p.t0 < 400 && !uiIsPhoto()) tapObjectAt(p.x, p.y);
  if (e.pointerId === gs.primary) {
    if (gs.mode === 'holdwait') {
      clearTimeout(gs.timer);
      gs.holdObj = null;
    } else if (gs.mode === 'editout') {
      if (up && gs.ptrs.size === 1 && Math.hypot(p.x - p.x0, p.y - p.y0) < HOLD_MOVE_PX) {
        gs.mode = null;
        draftFinish();
      }
    } else if (gs.mode === 'draftdrag') {
      draftRelease(up, Math.hypot(p.x - p.x0, p.y - p.y0) < HOLD_MOVE_PX);
    }
  }
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
    gs.holdObj = null;
    draftGrab = null;
  }
}

// 瀏覽模式輕點建築:科研院開科研面板;其他只做輕微高亮(不開任何選單)。居民點擊(lifeTap)優先
function tapObjectAt(sx, sy) {
  if (typeof lifeTap === 'function' && lifeTap(sx, sy)) return;
  const c = screenToCell(sx, sy);
  if (!c) return;
  const n = world.occ[idx(c.x, c.y)];
  if (!n) return;
  const o = world.objects[n - 1];
  if (o.type === LAB_TYPE) {
    toggleTechPanel(true);
    return;
  }
  fxMark(o, 'tap');
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
  head.textContent = ui.editing ? '範本(套用到草稿)' : '範本(載入到草稿)';
  menu.appendChild(head);
  const close = document.createElement('button');
  close.className = 'close';
  close.textContent = '✕';
  menu.appendChild(close);
  const dflt = defaultTemplate(world.board);
  const restore = document.createElement('button');
  restore.className = 'tpl';
  restore.setAttribute('data-default', '');
  restore.textContent = ui.editing ? '預設範本' : '載入預設到草稿';
  const rs = document.createElement('small');
  rs.textContent = dflt ? (ui.editing ? '套用到草稿:' : '以草稿開啟:') + dflt.name : '此布置沒有預設範本';
  restore.appendChild(rs);
  restore.disabled = !dflt;
  menu.appendChild(restore);
  const list = TEMPLATES.filter(t => (t.kind || 'estate') === world.board && !t.hidden);
  const ordered = list.filter(t => t.isDefault).concat(list.filter(t => !t.isDefault));
  let grp = null;
  for (const t of ordered) {
    if (t.group && t.group !== grp) {
      grp = t.group;
      const gh = document.createElement('small');
      gh.textContent = '── ' + grp + ' ──';
      menu.appendChild(gh);
    }
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
  if (!ui.editing) {
    // 草稿外:範本一律載入到草稿,不動使用中的版面
    toggleTplMenu(false);
    if (typeof draftStartOpen === 'function') draftStartOpen({ type: t.kind || 'estate', tpl: t.id });
    else showToast('草稿布置尚未載入');
    return;
  }
  if (!confirm('套用範本「' + t.name + '」到草稿？草稿目前的內容會被覆蓋,使用中的版面不受影響。' + pendWarnText())) return;
  draftDiscard();
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
  updateDraftBar();
  document.body.classList.toggle('pending', n > 0);
  document.body.classList.toggle('psel', n > 0 && pend.sel >= 0);
  if (!n || draft || progFreeBuild()) {
    bar.hidden = true;
    lastPendHtml = '';
    return;
  }
  const total = pendTotal();
  let html = '<div class="prow"><b>待購 ' + n + ' 件</b><span class="pcost">' + (costText(total) ? '' : (progFreeBuild() ? '免費' : ''));
  for (const k in RESOURCES) {
    if (!total[k]) continue;
    html += '<span' + ((world.res[k] || 0) < total[k] ? ' class="lack"' : '') + '>' + RESOURCES[k].icon + total[k].toLocaleString() + '</span>';
  }
  html += '</span><button class="pno" data-pact="cancel" title="全部取消">✕ 全部取消</button>' +
    '<button class="pok psave" data-pact="save" title="布置存檔：免費直接存檔；有費用則先結算">💾 布置存檔</button></div>';
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
}

// ── 已蓋建築:按住拿起 → 拖曳 → 放開(合法=落地、不合法=彈回原位 + toast);不拖曳放開 = 編輯狀態 ──
// 草稿虛影(新建與移動共用)旁的浮動圖示 #draftFloat:新建 ↻ ✓ ✕;編輯已蓋建築 ↻ 🗑 ✓ ✕
const HOLD_MS = 450, HOLD_MOVE_PX = 10, BOUNCE_MS = 250;
const FLOAT_CELL = 42;   // 每顆圖示鈕 42px(含透明 padding 的點擊範圍),2×2 排列
function holdEligible() {
  return (game.mode === 'estate' || game.mode === 'battleDesign') && ui.tool === null && !hide.on && !uiIsPhoto() &&
    (!game.backup || !!game.backup.draft);
}
function objFailReason(n, x, y, rot) {
  const o = world.objects[n], d = OBJECTS[o.type];
  const [w, h] = footprint(o.type, rot);
  if (x < 0 || y < 0 || x + w > MAP_W || y + h > MAP_H) return '超出土地範圍';
  if (!landFits(x, y, w, h)) return '超出土地範圍';
  const h0 = world.height[idx(x, y)];
  for (let yy = y; yy < y + h; yy++) {
    for (let xx = x; xx < x + w; xx++) {
      const i = idx(xx, yy);
      if (pend.occ[i]) return '與待購建築重疊';
      if (world.occ[i] && world.occ[i] !== n + 1) return '此處已有建築';
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
// 輕點高亮 / 落地光圈(render.js drawFx 繪製):kind = 'tap'(0.6 秒)或 'land'(0.35 秒)
function fxMark(o, kind) {
  const fp = footprint(o.type, o.rot);
  fxHi = { x: o.x, y: o.y, w: fp[0], h: fp[1], t0: performance.now(), dur: kind === 'land' ? 350 : 600, kind: kind };
}
// 按住滿 HOLD_MS:拿起(原位置暫時移除,以半透明虛影跟手指)
function holdFire() {
  const p = gs.ptrs.get(gs.primary);
  if (gs.mode !== 'holdwait' || !p || gs.ptrs.size !== 1) return;
  const o = gs.holdObj;
  gs.holdObj = null;
  if (!o || world.objects.indexOf(o) < 0 || !holdEligible() || draft) {
    gs.mode = 'pan';
    return;
  }
  draftFromObj(o);
  const c = screenToCell(p.x, p.y) || { x: o.x, y: o.y };
  draftGrab = { ox: c.x - draft.x, oy: c.y - draft.y, sx: draft.x, sy: draft.y, srot: draft.rot, edit: false, moved: false };
  gs.mode = 'draftdrag';
  if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(15);
}
// ── 草稿(虛影):新建與移動已蓋建築共用 ──
// 草稿是否可放:新建 = 待購規則(含待購數量上限);移動 = 已蓋建築規則(排除自己的舊佔格,不計數量上限)
function draftCheck(d) {
  if (d.orig) {
    const n = world.objects.indexOf(d.orig);
    if (n < 0) return '建築已不存在';
    return objFitAt(n, d.x, d.y, d.rot) ? '' : objFailReason(n, d.x, d.y, d.rot);
  }
  if (pend.list.length >= pendMax()) return '待購最多 ' + pendMax() + ' 件，請先購買或取消';
  return canPlacePending(d.type, d.x, d.y, d.rot, -1) ? '' : pendFailReason(d.type, d.x, d.y, d.rot, -1);
}
function draftSync() {
  if (!draft) return;
  draft.reason = draftCheck(draft);
  draft.ok = !draft.reason;
  updatePendBar();
}
function draftStart(type, x, y, rot) {
  pend.sel = -1;
  pend.moving = false;
  draft = { type: type, x: x, y: y, rot: rot, orig: null, ok: false, reason: '' };
  preview.visible = false;
  draftSync();
}
// 移動已蓋建築:原建築暫時排除於佔格與繪製(objHold),仍留在 world.objects 以保留存檔原位
function draftFromObj(o) {
  if (draft) draftDiscard();
  ui.objSel = null;
  objHold = o;
  rebuildOcc();
  draft = { type: o.type, x: o.x, y: o.y, rot: o.rot, orig: o, ok: false, reason: '', edit: false, bounce: null };
  preview.visible = false;
  draftSync();
}
function draftMoveTo(x, y) {
  if (!draft) return;
  draft.x = x;
  draft.y = y;
  draftSync();
}
function draftDragTo(sx, sy) {
  if (!draft || !draftGrab) return;
  const c = screenToCell(sx, sy);
  if (!c) return;
  const nx = c.x - draftGrab.ox, ny = c.y - draftGrab.oy;
  if (nx === draft.x && ny === draft.y) return;
  draftMoveTo(nx, ny);
}
function draftHit(sx, sy) {
  if (!draft) return false;
  const c = screenToCell(sx, sy);
  if (!c) return false;
  const fp = footprint(draft.type, draft.rot);
  return c.x >= draft.x && c.x < draft.x + fp[0] && c.y >= draft.y && c.y < draft.y + fp[1];
}
function draftRotate() {
  if (!draft || draft.bounce) return false;
  for (let k = 1; k <= 3; k++) {
    const r = (draft.rot + k) % 4;
    const probe = { type: draft.type, x: draft.x, y: draft.y, rot: r, orig: draft.orig };
    if (draftCheck(probe)) continue;
    draft.rot = r;
    if (!draft.orig) {
      ui.rot = r;
    }
    draftSync();
    return true;
  }
  showToast('此處空間不足，無法旋轉');
  return false;
}
// 捨棄草稿:新建者直接消失;移動者原建築回到原位(未曾改動 x/y/rot)
function draftDiscard() {
  if (!draft) return;
  const orig = draft.orig;
  draft = null;
  if (orig) {
    objHold = null;
    rebuildOcc();
  }
  preview.visible = false;
  updatePendBar();
  return orig;
}
function draftCancel() {
  draftDiscard();
  updatePendBar();
}
// ✓ 確定位置:新建 → 免費建造時直接成為正式建築並存檔,否則轉為待購項(工具維持選取);移動 → 放回新位置並存檔(位置與方向都沒變則什麼都不存)
function draftConfirm() {
  if (!draft) return;
  const why = draftCheck(draft);
  if (why) {
    showToast(why);
    return;
  }
  const d = draft;
  preview.visible = false;
  if (d.orig) {
    const o = d.orig;
    if (d.x === o.x && d.y === o.y && d.rot === o.rot) {
      draftDiscard();
      fxMark(o, 'tap');
      return;
    }
    draft = null;
    objHold = null;
    o.x = d.x;
    o.y = d.y;
    o.rot = d.rot;
    o.facing = d.rot;
    fxMark(o, 'land');
    if (typeof auPlay === 'function') auPlay('place');
    objPost();
    showToast('已移動 ' + OBJECTS[o.type].name);
  } else {
    draft = null;
    pendAdd(d.type, d.x, d.y, d.rot);
    if (progFreeBuild()) {
      if (!commitPending()) pendClear();
    } else {
      showToast('已加入待購：' + OBJECTS[d.type].name + '（工具仍選取，可繼續放置）');
    }
  }
  updateResBar();
}
// 完成(浮動 ✓ / 點空白處):合法 → 落地;不合法(已蓋建築)→ 彈回原位並離開編輯狀態;新建不合法 → 提示原因
function draftFinish() {
  if (!draft || draft.bounce) return;
  if (draft.orig && !draft.ok) {
    const o = draft.orig;
    draftBounce({ sx: o.x, sy: o.y, srot: o.rot, edit: false });
    return;
  }
  draftConfirm();
}
// 彈回:虛影以 BOUNCE_MS 動畫回到 g.sx/sy/srot;原因以 toast 顯示;g.edit 為真則回到編輯狀態,否則結束草稿(建築回原位)
function draftBounce(g) {
  const d = draft;
  if (!d || d.bounce) return;
  if (d.reason) showToast(d.reason);
  d.bounce = { fx: d.x, fy: d.y, t0: performance.now(), dur: BOUNCE_MS };
  d.x = g.sx;
  d.y = g.sy;
  d.rot = g.srot;
  d.edit = false;
  draftSync();
  setTimeout(() => {
    if (draft !== d) return;
    d.bounce = null;
    if (g.edit) d.edit = true;
    else draftDiscard();
    draftFloatKey = '';
    updatePendBar();
  }, BOUNCE_MS);
}
// 按住虛影的手指放開:新建草稿不動作;已蓋建築 → 沒拖曳 = 編輯狀態;拖曳 → 合法落地 / 不合法彈回
function draftRelease(up, quiet) {
  const g = draftGrab;
  draftGrab = null;
  draftFloatKey = '';
  if (!draft || !g || !draft.orig) {
    updatePendBar();
    return;
  }
  if (!up) {
    draft.x = g.sx;
    draft.y = g.sy;
    draft.rot = g.srot;
    if (g.edit) {
      draftSync();
      draft.edit = true;
    } else draftDiscard();
    updatePendBar();
    return;
  }
  const same = draft.x === g.sx && draft.y === g.sy && draft.rot === g.srot;
  if ((quiet && !g.moved) || same) {
    draft.edit = true;
    updatePendBar();
    return;
  }
  if (draft.ok) draftConfirm();
  else draftBounce(g);
}
function draftDemolish() {
  if (!draft || !draft.orig || draft.bounce) return;
  const o = draft.orig, name = OBJECTS[o.type].name;
  const refund = refundOf(o.type);
  const labBusy = o.type === LAB_TYPE && world.tech.cur;
  const msg = (costText(refund) ? '退還 ' + costText(refund) + '（依拆除規則，約為造價的一半）。' : '免費建造，不退款。') +
    (labBusy ? '科研院研發將暫停，重建後繼續。' : '');
  const doIt = function () {
    if (draft && draft.orig === o) draftDiscard();
    if (world.objects.indexOf(o) < 0) return;
    removeObjectAt(o.x, o.y, true);
    preview.visible = false;
    if (typeof auPlay === 'function') auPlay('remove');
    showToast('已拆除 ' + name + '，退還 ' + refundText(refund));
    objPost();
  };
  if (typeof ldConfirm !== 'function') {
    if (confirm('是否拆除「' + name + '」？' + msg)) doIt();
    return;
  }
  ldConfirm('是否拆除「' + name + '」？', msg, '是，拆除', doIt);
  const dlg = document.getElementById('ldConfirm');
  const nb = dlg && dlg.querySelector('button[data-ld="no"]');
  if (nb) {
    nb.textContent = '否';
    if (nb.focus) nb.focus();
  }
}
function onFloatClick(e) {
  const b = e.target.closest('button');
  if (!b || !draft) return;
  audioUnlock();
  const act = b.getAttribute('data-fact');
  if (act === 'rot') draftRotate();
  else if (act === 'del') draftDemolish();
  else if (act === 'ok') draftFinish();
  else if (act === 'cancel') draftCancel();
  updatePendBar();
}
// 底部草稿列:只顯示建築名、費用(免費)或失敗原因 / 提示,不放按鈕(按鈕在虛影旁的 #draftFloat)
function updateDraftBar() {
  const bar = document.getElementById('draftBar');
  if (!bar) return;
  if (!draft) {
    bar.hidden = true;
    lastDraftHtml = '';
    draftFloatSync();
    return;
  }
  const d = OBJECTS[draft.type];
  const mv = !!draft.orig;
  const hint = mv ? (draft.edit ? '編輯中：↻ 旋轉　🗑 拆除　✓ 完成　✕ 取消' : '拖到想要的位置，放開即放下') : '拖到想要的位置，按 ✓ 放下';
  const msg = draft.reason ? '✕ ' + draft.reason : hint;
  const cost = mv ? '' : '　' + (costText(objCost(draft.type)) || '免費');
  const html = '<div class="drow top"><span class="dname">' + d.icon + ' ' + d.name + (mv ? '（移動）' : cost) + '</span>' +
    '<small class="dmsg' + (draft.reason ? ' bad' : '') + '">' + msg + '</small></div>';
  if (html !== lastDraftHtml) {
    lastDraftHtml = html;
    bar.innerHTML = html;
  }
  bar.hidden = false;
  bar.style.bottom = (bottomStackPx() + 8) + 'px';
  draftFloatKey = '';
  draftFloatSync();
}
// ── 浮動圖示 #draftFloat:貼著虛影螢幕包圍盒的右上角,靠邊自動換邊,避開頂列 / 底列 / 側欄 / 左側欄 ──
function draftFloatVisible() {
  if (!draft || draft.bounce) return false;
  if (draft.orig && !draft.edit) return false;
  if (uiIsPhoto() || (typeof pano !== 'undefined' && pano && pano.open)) return false;
  if (gs.mode === 'draftdrag' && draftGrab && draftGrab.moved) return false;
  return true;
}
function elRect(id) {
  const e = document.getElementById(id);
  if (!e || e.hidden || !e.getBoundingClientRect) return null;
  const r = e.getBoundingClientRect();
  return r && (r.width > 0 || r.height > 0) ? { l: r.left, t: r.top, r: r.right, b: r.bottom } : null;
}
function rectHit(a, b) { return a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t; }
// 草稿虛影的螢幕包圍盒(含建築本體高度的粗估)
function draftBox() {
  const d = draft, fp = footprint(d.type, d.rot);
  const bh = world.height[idx(d.x, d.y)] * HL;
  let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity;
  [[d.x, d.y], [d.x + fp[0], d.y], [d.x + fp[0], d.y + fp[1]], [d.x, d.y + fp[1]]].forEach(c => {
    const g = gpt(c[0], c[1], bh);
    const s = worldToScreen(g[0], g[1]);
    l = Math.min(l, s[0]); r = Math.max(r, s[0]);
    t = Math.min(t, s[1]); b = Math.max(b, s[1]);
  });
  return { l: l, t: t - 40 * view.zoom, r: r, b: b };
}
function draftFloatPlace(el) {
  const vw = viewport.w || window.innerWidth || 0, vh = viewport.h || window.innerHeight || 0;
  const W = FLOAT_CELL * 2, H = FLOAT_CELL * 2, gap = 4;
  const bb = draftBox();
  const key = [Math.round(bb.l), Math.round(bb.t), Math.round(bb.r), Math.round(bb.b), vw, vh].join(',');
  if (key === draftFloatKey) return;
  draftFloatKey = key;
  const obs = [];
  ['topbar', 'toolbar', 'catbar', 'varbar', 'pendBar', 'draftBar', 'editBar', 'slotPick', 'sideBar', 'modeBtn', 'btnAttack', 'progFtue']
    .forEach(id => { const r = elRect(id); if (r) obs.push(r); });
  const tb = elRect('topbar');
  const minT = tb ? tb.b + 2 : 4;
  const clampPos = (l, t) => [Math.max(4, Math.min(vw - W - 4, l)), Math.max(minT, Math.min(vh - H - 4, t))];
  const mid = (bb.t + bb.b) / 2 - H / 2;
  const cands = [
    [bb.r + gap, bb.t], [bb.r + gap, mid], [bb.r + gap, bb.b - H],
    [bb.l - W - gap, bb.t], [bb.l - W - gap, mid], [bb.l - W - gap, bb.b - H],
    [bb.r - W, bb.t - H - gap], [bb.l, bb.t - H - gap], [bb.r - W, bb.b + gap], [bb.l, bb.b + gap]
  ];
  let best = null, bestScore = Infinity;
  cands.forEach((c, i) => {
    const p = clampPos(c[0], c[1]);
    const box = { l: p[0], t: p[1], r: p[0] + W, b: p[1] + H };
    const score = obs.filter(o => rectHit(box, o)).length * 100 + (rectHit(box, bb) ? 20 : 0) + i;
    if (score < bestScore) { bestScore = score; best = p; }
  });
  el.style.left = Math.round(best[0]) + 'px';
  el.style.top = Math.round(best[1]) + 'px';
}
// 每個 draw 後呼叫(render.js)與草稿狀態改變時呼叫;位置沒變就不重算
function draftFloatSync() {
  const el = document.getElementById('draftFloat');
  if (!el) return;
  if (!draftFloatVisible()) {
    if (!el.hidden) el.hidden = true;
    draftFloatKey = '';
    return;
  }
  const edit = !!(draft.orig && draft.edit);
  const html = '<button data-fact="rot" title="旋轉"><i>↻</i></button>' +
    (edit ? '<button data-fact="del" title="拆除"><i>🗑</i></button>' : '') +
    '<button data-fact="ok" class="pok' + (draft.ok ? '' : ' dim') + '" title="完成"><i>✓</i></button>' +
    '<button data-fact="cancel" class="pno" title="取消"><i>✕</i></button>';
  if (html !== lastFloatHtml) {
    lastFloatHtml = html;
    el.innerHTML = html;
    draftFloatKey = '';
  }
  el.hidden = false;
  draftFloatPlace(el);
}

function onPendClick(e) {
  const b = e.target.closest('button');
  if (!b) return;
  audioUnlock();
  const act = b.getAttribute('data-pact');
  if (act === 'save') {
    layoutSave();
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
    showToast('已建造 ' + r.n + ' 件，花費 ' + feeText(r.cost));
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
  return !!r.ok;
}

// ── 布置草稿骨架(A 批:停用,供 B 批草稿布置重新接線;ui.editing 目前恆為 false,以下函式不會被觸發) ──
// 經營模式(PLAN_LAYOUT §1)進遊戲就能蓋 / 拆 / 移動 / 整地,不再有「預設瀏覽」。
// 進入時記下棋盤快照;存檔並離開 = layoutSave 後離開;取消布置 = 還原快照(res / lastTs / tech / deals… 沿用目前值,不動 map.js)。
// 離開的所有路徑若有未存變更,先跳 #leaveDlg 三選一(存檔 / 放棄 / 繼續布置)。
let editSnap = null;
let editBypass = false;
let editAfterSettle = null;
let editLeaveCont = null;
let editUnsaved = false;   // 繼續上次草稿:基準未知,視為有未存變更,直到存到某個格子


function editSnapshot() {
  return {
    terrain: world.terrain.slice(), height: world.height.slice(), flow: world.flow.slice(),
    block: world.block.slice(), zone: world.zone.slice(),
    objects: JSON.stringify(world.objects.map(o => objSave(o, true))),
    marks: JSON.stringify(world.marks)
  };
}
function editSameArr(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}
function editBoardChanged() {
  if (!editSnap) return false;
  if (editUnsaved) return true;
  if (!editSameArr(world.terrain, editSnap.terrain) || !editSameArr(world.height, editSnap.height) || !editSameArr(world.flow, editSnap.flow)) return true;
  if (editSnap.block && (!editSameArr(world.block, editSnap.block) || !editSameArr(world.zone, editSnap.zone))) return true;
  if (editSnap.marks !== undefined && JSON.stringify(world.marks) !== editSnap.marks) return true;
  return JSON.stringify(world.objects.map(o => objSave(o, true))) !== editSnap.objects;
}
// 未存變更:待購項、草稿、棋盤與進入布置時的快照不同
function editDirty() {
  if (!ui.editing) return false;
  return !!draft || pend.list.length > 0 || editBoardChanged();
}
function editDirtyText() {
  const parts = [];
  if (pend.list.length) parts.push('待購 ' + pend.list.length + ' 件');
  if (draft) parts.push('草稿尚未確定');
  if (editUnsaved) parts.push('草稿尚未存到版面格');
  else if (editBoardChanged()) parts.push('地形或建築已修改');
  return parts.join('、');
}
// 草稿是否值得暫存(map.js draftPersist 用):有未存變更才存,沒有變更就清掉暫存
function editWorthKeeping() {
  return ui.editing && editBoardChanged();
}

// 草稿棋盤已載入 world(game.backup.draft 已建立,見 mapedit.js draftBegin)後呼叫;unsaved:繼續上次草稿
function editEnter(unsaved) {
  if (ui.editing || !(game.backup && game.backup.draft)) return false;
  editSnap = editSnapshot();
  editUnsaved = !!unsaved;
  ui.editing = true;
  editAfterSettle = null;
  editSyncUi();
  buildToolbar();
  setTool(null);
  updateResBar();
  syncSideBar();
  showToast('草稿布置(' + (game.backup.draft.type === 'camp' ? '戰鬥' : '經營') + '):改完按 💾 儲存到版面格,使用中的版面不受影響');
  return true;
}
// 直接離開(不檢查、不還原):呼叫端負責先存檔或還原
function editLeave() {
  if (!ui.editing) return;
  ui.editing = false;
  editUnsaved = false;
  editAfterSettle = null;
  closeSettle();
  editLeaveDlgClose();
  draftDiscard();
  if (pend.list.length) pendClear();
  hideReset();
  toggleTplMenu(false);
  editSnap = null;
  objHold = null;
  draftStoreClear();
  if (typeof draftEnvLeave === 'function') draftEnvLeave();
  setTool(null);
  ui.objSel = null;
  editSyncUi();
  buildToolbar();
  updateResBar();
  syncSideBar();
}
// 以快照覆寫棋盤欄位,其餘(res、lastTs、tech、deals…)不動;之後存檔使存檔與畫面一致
function editRestore() {
  if (!editSnap) return;
  draftDiscard();
  if (pend.list.length) pendClear();
  hideReset();
  world.terrain.set(editSnap.terrain);
  world.height.set(editSnap.height);
  world.flow.set(editSnap.flow);
  if (editSnap.block) { world.block.set(editSnap.block); world.zone.set(editSnap.zone); }
  if (editSnap.marks !== undefined) world.marks = normMarks(JSON.parse(editSnap.marks));
  world.objects = JSON.parse(editSnap.objects).map(o => Object.assign(o, { facing: objFacing(o) }));
  ui.objSel = null;
  objHold = null;
  rebuildOcc();
  saveWorld();
  mapeditRefresh();
}
function editGuard(cont) {
  if (!ui.editing) {
    if (cont) cont();
    return;
  }
  if (!editDirty()) {
    editLeave();
    if (cont) cont();
    return;
  }
  editLeaveDlgOpen(cont);
}
// 💾 存檔並離開布置;cont 為離開後要接著做的事(離開對話框的路徑用)
function editSaveAndLeave(cont) {
  if (draft) {
    showToast('請先按 ✓ 確定位置或 ✕ 取消草稿');
    return;
  }
  if (typeof saveSlotDlgOpen !== 'function') return;
  saveSlotDlgOpen(() => {
    editLeave();
    if (cont) cont();
  });
}
function editCancel() {
  if (!ui.editing) return;
  if (editDirty() && !confirm('放棄草稿?尚未存到版面格的內容會丟棄,使用中的版面不受影響。')) return;
  editLeave();
  showToast('已放棄草稿');
}
// 側欄 🔨 布置:打開「草稿起點選擇」(mapedit.js draftStartOpen)
function editSideAct() {
  if (ui.editing) {
    showToast('已在草稿布置中');
    return;
  }
  if (typeof draftStartOpen === 'function') draftStartOpen();
  else showToast('草稿布置尚未載入');
}
// 設定「範本」列:打開範本選單;選了範本 → 載入到草稿(不直接蓋掉使用中的版面)
function openTemplatesFromSettings() {
  if (game.mode !== 'estate' && game.mode !== 'battleDesign') {
    showToast('目前無法使用範本');
    return;
  }
  toggleTplMenu(true);
}

function editLeaveDlgIsOpen() {
  const d = document.getElementById('leaveDlg');
  return !!d && !d.hidden;
}
function editLeaveDlgOpen(cont) {
  const d = document.getElementById('leaveDlg');
  if (!d) return;
  editLeaveCont = cont || null;
  d.textContent = '';
  const box = document.createElement('div');
  box.className = 'ld-box';
  const head = document.createElement('b');
  head.className = 'ld-head';
  head.textContent = '草稿尚有未儲存的變更';
  const msg = document.createElement('div');
  msg.className = 'ld-msg';
  msg.textContent = editDirtyText() || '布置有變更';
  const foot = document.createElement('div');
  foot.className = 'ld-foot';
  [['save', '💾 儲存…', 'pok'], ['drop', '放棄', 'pno'], ['stay', '繼續編輯', '']].forEach(a => {
    const b = document.createElement('button');
    b.setAttribute('data-lact', a[0]);
    if (a[2]) b.className = a[2];
    b.textContent = a[1];
    foot.appendChild(b);
  });
  box.appendChild(head);
  box.appendChild(msg);
  box.appendChild(foot);
  d.appendChild(box);
  d.hidden = false;
}
function editLeaveDlgClose() {
  const d = document.getElementById('leaveDlg');
  if (d) d.hidden = true;
  editLeaveCont = null;
}
function onLeaveClick(e) {
  const b = e.target.closest('button');
  if (!b) return;
  audioUnlock();
  const act = b.getAttribute('data-lact');
  const cont = editLeaveCont;
  if (act === 'stay') {
    editLeaveDlgClose();
  } else if (act === 'drop') {
    editLeaveDlgClose();
    editRestore();
    editLeave();
    showToast('已放棄草稿');
    if (cont) cont();
  } else if (act === 'save') {
    editLeaveDlgClose();
    editSaveAndLeave(cont);
  }
}

// 每 300ms 隨 syncSideBar 呼叫:草稿骨架離開經營即離開;免費建造時沒有待購 / 存檔流程,隱藏 💾 布置存檔鈕
function editSyncUi() {
  if (ui.editing && !(game.backup && game.backup.draft)) editLeave();
  const lb = document.getElementById('btnLayoutSave');
  if (lb) lb.hidden = progFreeBuild() && !ui.editing;
  if (typeof draftPersist === 'function') draftPersist();
  if (typeof editBarSync === 'function') editBarSync();
}

// 💾 布置存檔:草稿中不存;待購總費用為 0(或無待購)直接存檔;有費用則開結算對話框
// 回傳 'saved' 已存檔 / 'settle' 已開結算對話框(待確定) / 'blocked' 未存(草稿或放置失敗)
function layoutSave() {
  if (ui.editing) {
    if (draft) {
      showToast('請先按 ✓ 確定位置或 ✕ 取消草稿');
      return 'blocked';
    }
    if (typeof saveSlotDlgOpen === 'function') saveSlotDlgOpen(null);
    return 'dialog';
  }
  if (draft) {
    showToast('請先按 ✓ 確定位置或 ✕ 取消草稿');
    return 'blocked';
  }
  if (!pend.list.length) {
    saveWorld();
    showToast('布置已儲存');
    return 'saved';
  }
  const total = pendTotal();
  if (!Object.keys(total).some(k => total[k] > 0)) {
    const ok = commitPending();
    if (ok) showToast('布置已儲存');
    updateResBar();
    return ok ? 'saved' : 'blocked';
  }
  openSettle();
  return 'settle';
}

function settleOpen() {
  const dlg = document.getElementById('settleDlg');
  return !!dlg && !dlg.hidden;
}
function openSettle() {
  const dlg = document.getElementById('settleDlg');
  if (!dlg) return;
  dlg.hidden = false;
  renderSettle();
}
function closeSettle() {
  const dlg = document.getElementById('settleDlg');
  if (dlg) dlg.hidden = true;
  lastSettleHtml = '';
  editAfterSettle = null;
}
// 結算內容:每種待購 × 數量與小計、材料與金幣合計、持有與結算後餘額;資源不足列缺口並停用確定
function renderSettle() {
  const dlg = document.getElementById('settleDlg');
  if (!dlg || dlg.hidden) return;
  const counts = {}, order = [];
  pend.list.forEach(o => {
    if (!counts[o.type]) { counts[o.type] = 0; order.push(o.type); }
    counts[o.type]++;
  });
  const total = pendTotal();
  const ok = canAfford(total);
  let html = '<div class="sd-head"><b>布置結算</b><span>待購 ' + pend.list.length + ' 件</span></div><div class="sd-list">';
  order.forEach(t => {
    const sub = {}, c = objCost(t);
    for (const k in c) sub[k] = c[k] * counts[t];
    html += '<div class="sd-row"><span>' + OBJECTS[t].icon + ' ' + OBJECTS[t].name + ' × ' + counts[t] + '</span><span>' + (costText(sub) || '免費') + '</span></div>';
  });
  html += '</div><div class="sd-sum">';
  html += '<div class="sd-row"><b>材料與金幣合計</b><span>' + (costText(total) || '免費') + '</span></div>';
  for (const k in RESOURCES) {
    if (!total[k]) continue;
    const have = Math.floor(world.res[k] || 0), after = have - total[k];
    html += '<div class="sd-row"><span>' + RESOURCES[k].icon + ' ' + RESOURCES[k].name + ' 持有 ' + have.toLocaleString() + '</span>' +
      '<span>' + (after >= 0 ? '結算後 ' + after.toLocaleString() : '<b class="lack">缺 ' + (-after).toLocaleString() + '</b>') + '</span></div>';
  }
  html += '</div>';
  html += '<div class="sd-msg' + (ok ? '' : ' lack') + '">' + (ok ? '確認後將扣款並存檔。' : '資源不足，無法確定；請返回修改（移除待購或先取得資源）。') + '</div>';
  html += '<div class="sd-foot"><button data-sact="back">返回修改</button><button data-sact="ok" class="pok"' + (ok ? '' : ' disabled') + '>確定結算並儲存</button></div>';
  if (html !== lastSettleHtml) {
    lastSettleHtml = html;
    dlg.innerHTML = html;
  }
}
function onSettleClick(e) {
  const b = e.target.closest('button');
  if (!b) return;
  audioUnlock();
  const act = b.getAttribute('data-sact');
  if (act === 'back') {
    closeSettle();
  } else if (act === 'ok') {
    if (!canAfford(pendTotal())) return;
    const after = editAfterSettle;
    closeSettle();
    const ok = commitPending();
    updateResBar();
    if (ok && after && ui.editing) {
      editLeave();
      after();
    }
  }
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

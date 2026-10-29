const TERRAIN_TOOLS = {
  road:  { name: '道路', icon: '🛤️', drag: true },
  grass: { name: '草地', icon: '🌱', drag: true },
  lake:  { name: '湖',   icon: '💧', drag: true },
  river: { name: '河流', icon: '🌊', drag: true },
  raise: { name: '升高', icon: '⬆️', drag: true },
  lower: { name: '降低', icon: '⬇️', drag: true },
  erase: { name: '拆除', icon: '🧹', drag: true }
};

const ui = { tool: null, rot: 0, shopOpen: false, dealDay: '', tplOpen: false };

const TERRAIN_OF = { road: T_ROAD, grass: T_GRASS, lake: T_LAKE, river: T_RIVER };
const TERRAIN_NAME = ['草地', '湖', '河', '道路'];

// 指標手勢狀態: mode = null | pan | tool | pending | paint | pinch
const gs = { ptrs: new Map(), mode: null, primary: null, pinch: null, timer: 0, op: null, last: null };
let toastEl = null, toastTimer = 0;
let lastResHtml = '', lastShopHtml = '';

function initUI(canvas) {
  toastEl = document.createElement('div');
  toastEl.id = 'toast';
  document.body.appendChild(toastEl);
  buildToolbar();
  setTool(null);
  document.getElementById('btnRot').textContent = DIR_ARROWS[ui.rot];
  bindEvents(canvas);
  syncSeasonSelect();
  updateResBar();
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

  document.getElementById('btnShop').addEventListener('click', () => toggleShop());
  document.getElementById('btnRot').addEventListener('click', () => rotate());
  document.getElementById('selSeason').addEventListener('change', e => {
    setSeason(e.target.value);
    saveWorld();
  });
  document.getElementById('btnDemo').addEventListener('click', () => toggleTplMenu());
  document.getElementById('btnPano').addEventListener('click', () => openPanorama());
  document.getElementById('panoClose').addEventListener('click', () => closePanorama());
  document.getElementById('panoSave').addEventListener('click', () => savePanorama());
  document.getElementById('btnClear').addEventListener('click', () => {
    if (!confirm('清空整個領地？資源會重設。')) return;
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
    if (e.key === 'r' || e.key === 'R') {
      if (document.activeElement && document.activeElement.tagName === 'SELECT') return;
      rotate();
    } else if (e.key === 'Escape') {
      setTool(null);
      toggleShop(false);
      toggleTplMenu(false);
    }
  });
}

function buildToolbar() {
  const bar = document.getElementById('toolbar');
  bar.innerHTML = '';
  addToolButton(bar, null, '✋', '瀏覽', null);
  for (const id in TERRAIN_TOOLS) addToolButton(bar, id, TERRAIN_TOOLS[id].icon, TERRAIN_TOOLS[id].name, null);
  const sep = document.createElement('span');
  sep.className = 'sep';
  sep.textContent = '｜';
  bar.appendChild(sep);
  for (const id in OBJECTS) addToolButton(bar, id, OBJECTS[id].icon, OBJECTS[id].name, OBJECTS[id]);
}

function addToolButton(bar, id, icon, name, def) {
  const btn = document.createElement('button');
  btn.setAttribute('data-tool', id === null ? '' : id);
  let html = '<span class="ic">' + icon + '</span><span>' + name + '</span>';
  let title = name;
  if (def) {
    html += '<span class="cost">' + costText(def.cost) + '</span>';
    title += ' ' + costText(def.cost);
    if (def.prod) title += ' 產出 ' + prodText(def.prod);
    if (def.max) title += ' (上限 ' + def.max + ' 座)';
  }
  btn.innerHTML = html;
  btn.title = title;
  btn.addEventListener('click', () => setTool(ui.tool === id ? null : id));
  bar.appendChild(btn);
}

function setTool(id) {
  ui.tool = id;
  const key = id === null ? '' : id;
  document.querySelectorAll('#toolbar button').forEach(b => {
    b.classList.toggle('active', b.getAttribute('data-tool') === key);
  });
  preview.tool = id;
  preview.visible = false;
  document.getElementById('info').textContent = toolInfo();
}

function toolInfo() {
  const t = ui.tool;
  if (t === null) return '瀏覽模式：拖曳移動、滾輪／雙指縮放';
  if (OBJECTS[t]) {
    const d = OBJECTS[t];
    let s = d.name + '　成本 ' + costText(d.cost);
    if (d.prod) s += '　產出 ' + prodText(d.prod);
    return s;
  }
  return TERRAIN_TOOLS[t].name;
}

function rotate() {
  ui.rot = (ui.rot + 1) % 4;
  document.getElementById('btnRot').textContent = DIR_ARROWS[ui.rot];
  preview.rot = ui.rot;
  if (gs.last) updatePreviewAt(gs.last.x, gs.last.y);
}

function isDraggable(t) {
  if (t === null) return false;
  return !!((OBJECTS[t] && OBJECTS[t].drag) || (TERRAIN_TOOLS[t] && TERRAIN_TOOLS[t].drag));
}

function previewOk(t, x, y) {
  const i = idx(x, y);
  if (OBJECTS[t]) return canPlace(t, x, y, ui.rot) && canAfford(OBJECTS[t].cost);
  if (t === 'raise') return !world.occ[i] && world.height[i] < MAX_H;
  if (t === 'lower') return !world.occ[i] && world.height[i] > 0;
  if (t === 'erase') return !!world.occ[i] || world.terrain[i] === T_ROAD;
  return !world.occ[i];
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
  preview.tool = ui.tool;
  preview.rot = ui.rot;
  preview.visible = ui.tool !== null;
  preview.ok = ui.tool === null || previewOk(ui.tool, c.x, c.y);
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

function missingOf(cost) {
  const m = {};
  for (const k in cost) {
    const need = cost[k] - (world.res[k] || 0);
    if (need > 0) m[k] = need;
  }
  return m;
}

function refundOf(type) {
  const r = {}, c = OBJECTS[type].cost;
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
  if (ok) updateResBar();
  return ok;
}

function applyOne(x, y) {
  const t = ui.tool;
  if (t === null) return false;
  const i = idx(x, y);
  if (OBJECTS[t]) {
    const d = OBJECTS[t];
    if (!canPlace(t, x, y, ui.rot)) {
      showToast('無法放置：' + placeFailReason(t, x, y, ui.rot));
      return false;
    }
    if (!canAfford(d.cost)) {
      showToast('資源不足：缺 ' + costText(missingOf(d.cost)));
      return false;
    }
    spend(d.cost);
    place(t, x, y, ui.rot);
    return true;
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
    showToast('已拆除 ' + OBJECTS[o.type].name + '，退還 ' + costText(refund));
    return true;
  }
  if (world.terrain[i] === T_ROAD) {
    paintTerrain(x, y, T_GRASS, 0);
    return true;
  }
  return false;
}

function beginOp() {
  gs.op = { applied: new Set(), changed: false, warned: false };
}

function endOp() {
  if (gs.op && gs.op.changed) saveWorld();
  gs.op = null;
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
  const x = e.clientX, y = e.clientY;
  e.currentTarget.setPointerCapture(e.pointerId);
  gs.ptrs.set(e.pointerId, { x: x, y: y, x0: x, y0: y });
  gs.last = { x: x, y: y };
  if (gs.ptrs.size >= 2) {
    startPinch();
    return;
  }
  if (e.pointerType === 'mouse') {
    if (e.button === 0 && ui.tool !== null) {
      gs.mode = 'tool';
      beginOp();
      applyCellAt(x, y);
    } else {
      gs.mode = 'pan';
    }
    return;
  }
  if (ui.tool === null) {
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
  const p = gs.ptrs.get(e.pointerId);
  if (!p) return;
  gs.ptrs.delete(e.pointerId);
  if (e.type === 'pointerup' && gs.mode === 'pending' && e.pointerId === gs.primary) {
    clearTimeout(gs.timer);
    gs.mode = null;
    beginOp();
    applyCellAt(p.x, p.y);
    endOp();
  }
  if (gs.ptrs.size === 0) {
    clearTimeout(gs.timer);
    endOp();
    gs.mode = null;
    gs.pinch = null;
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
  document.querySelectorAll('#toolbar button[data-tool]').forEach(b => {
    const d = OBJECTS[b.getAttribute('data-tool')];
    if (d) b.classList.toggle('poor', !canAfford(d.cost));
  });
  if (ui.shopOpen) updateShop();
}

function updateShop() {
  const list = ensureDeals();
  if (ui.dealDay && ui.dealDay !== world.deals.day) showToast('每日特賣已刷新');
  ui.dealDay = world.deals.day;
  let html = '<div class="head"><b>商店</b><button class="close">✕</button></div>';
  for (const k in SHOP) {
    const s = SHOP[k], r = RESOURCES[k], have = world.res[k] || 0;
    const buyCost = s.buy * SHOP_LOT, sellGain = s.sell * SHOP_LOT;
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
    updateShop();
  }
}

function toggleTplMenu(open) {
  ui.tplOpen = open === undefined ? !ui.tplOpen : !!open;
  document.getElementById('tplMenu').hidden = !ui.tplOpen;
  if (ui.tplOpen) {
    toggleShop(false);
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
  for (const t of TEMPLATES) {
    const btn = document.createElement('button');
    btn.className = 'tpl';
    btn.setAttribute('data-tpl', t.id);
    btn.textContent = t.name;
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
  const t = TEMPLATES.find(tp => tp.id === b.getAttribute('data-tpl'));
  if (!t) return;
  if (!confirm('套用範本「' + t.name + '」？目前的領地會被覆蓋' + (TEMPLATE_KEEP_RES ? '。' : '，資源重設為初始值。'))) return;
  const r = applyTemplate(t.id);
  if (!r) {
    showToast('範本無法套用');
    return;
  }
  saveWorld();
  centerOnCell(r.ox + t.focus[0], r.oy + t.focus[1]);
  updateResBar();
  toggleTplMenu(false);
  showToast('已套用 ' + t.name + (r.failed ? '（' + r.failed + ' 件無法放置）' : ''));
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

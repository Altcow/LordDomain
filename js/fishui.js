// fishui.js — 釣魚覆蓋層(F0):頂列 🎣 鈕、全螢幕場景、指標輸入、圖鑑面板、進出流程。內部函式皆以 fu 開頭。
var fuLayer = null, fuStage = null, fuCv = null, fuCtx = null, fuMain = null, fuDex = null, fuDexRows = [],
  fuRaf = 0, fuLast = 0, fuPaused = false, fuDrag = null, fuLabel = '', fuTopTimer = 0;

function fuMkBtn(parent, text, cls, x, y, w, h, onDown) {
  var b = document.createElement('button');
  b.className = 'fu-btn ' + cls;
  b.setAttribute('data-ui', '1');
  b.textContent = text;
  b.style.left = x + 'px'; b.style.top = y + 'px'; b.style.width = w + 'px'; b.style.height = h + 'px';
  b.addEventListener('pointerdown', function (e) { e.preventDefault(); e.stopPropagation(); onDown(); });
  parent.appendChild(b);
  return b;
}

function fuMainUp() { fs.holding = false; }

function fuMainDown() {
  if (fs.phase === 'aim') fishCast(fs.angle);
  else if (fs.phase === 'sink') fs.abort = true;
  else if (fs.phase === 'fight') { fs.pending += 1; fs.holding = true; }
  else if (fs.phase === 'result' && fs.card && fs.card.hold) fs.dismiss = true;
}

function fuNudge(d) {
  var mx;
  if (fs.phase !== 'aim') return;
  mx = fishGear().angMax;
  fs.angle = Math.max(-mx, Math.min(mx, fs.angle + d));
}

function fuDialTo(p) {
  var u = FISH_LAYER.ui, dx = p[0] - u.dialX, dy = p[1] - u.dialY, th, mx = fishGear().angMax;
  th = Math.atan2(dx, Math.max(dy, 0.5)) * 180 / Math.PI;
  fs.angle = Math.max(-mx, Math.min(mx, th));
}

function fuLogical(e) {
  var r = fuCv.getBoundingClientRect();
  return [(e.clientX - r.left) * FISH_LAYER.W / r.width, (e.clientY - r.top) * FISH_LAYER.H / r.height];
}

function fuDown(e) {
  var n, p, U, dd, mx;
  if (!fuLayer || fuPaused || fuDrag || fs.phase !== 'aim') return;
  for (n = e.target; n; n = n.parentNode) if (n.getAttribute && n.getAttribute('data-ui')) return;
  p = fuLogical(e);
  U = FISH_LAYER.ui;
  dd = Math.sqrt((p[0] - U.dialX) * (p[0] - U.dialX) + (p[1] - U.dialY) * (p[1] - U.dialY));
  if (dd < U.dialR + 18 && p[1] > U.dialY - 6) { fuDrag = { k: 'dial' }; fuDialTo(p); }
  else if (p[1] < FISH_LAYER[2][0]) fuDrag = { k: 'boat', x0: p[0], b0: fs.boatX };
  else if (p[1] < 700) fuDrag = { k: 'ang', x0: p[0], a0: fs.angle };
  if (fuDrag && fuDrag.k === 'ang') { mx = fishGear().angMax; fuDrag.mx = mx; }
}

function fuMove(e) {
  var p, mx;
  if (!fuDrag || fs.phase !== 'aim') return;
  p = fuLogical(e);
  if (fuDrag.k === 'boat') {
    fs.boatX = Math.max(60, Math.min(330, fuDrag.b0 + p[0] - fuDrag.x0));
  } else if (fuDrag.k === 'ang') {
    mx = fuDrag.mx;
    fs.angle = Math.max(-mx, Math.min(mx, fuDrag.a0 + (p[0] - fuDrag.x0) * 0.5));
  } else if (fuDrag.k === 'dial') {
    fuDialTo(p);
  }
}

function fuUp() { fuDrag = null; }

function fuSyncUI() {
  var lab = fs.phase === 'aim' ? '拋' : fs.phase === 'sink' ? '收' : fs.phase === 'fight' ? '拉' : '…';
  if (lab !== fuLabel && fuMain) { fuLabel = lab; fuMain.textContent = lab; }
}

function fuRenderDex() {
  var i, def, e, known, row, cv, ctx2, cap;
  // cap 為每列的說明文字
  for (i = 0; i < fuDexRows.length; i++) {
    row = fuDexRows[i];
    def = FISH[i];
    e = fs.save.dex[def.id];
    known = !!(e && e.n > 0);
    cv = row.cv;
    ctx2 = cv.getContext('2d');
    ctx2.clearRect(0, 0, 64, 36);
    ctx2.drawImage(fishSprite(i, !known), 0, 0, 64, 36);
    row.name.textContent = known ? def.name : '???';
    cap = FISH_RARITY[def.rar].name + '  ' + (known ? '最大 ' + e.best + ' cm  ×' + e.n : '未收錄');
    row.info.textContent = cap;
  }
}

function fuToggleDex() {
  if (!fuDex) return;
  if (fuDex.style.display === 'block') { fuDex.style.display = 'none'; return; }
  fuRenderDex();
  fuDex.style.display = 'block';
}

function fuBuild() {
  var U = FISH_LAYER.ui, layer, stage, panel, title, close, i, row, rowEl, cvEl, nameEl, infoEl, txt;
  layer = document.createElement('div');
  layer.id = 'fishLayer';
  stage = document.createElement('div');
  stage.id = 'fishStage';
  fuCv = document.createElement('canvas');
  fuCv.id = 'fishCv';
  fuCtx = fuCv.getContext('2d');
  stage.appendChild(fuCv);
  fuMkBtn(stage, '↩', 'fu-exit', 8, 6, 36, 36, function () { fishExit(); });
  fuMkBtn(stage, '📖', 'fu-dexbtn', 346, 6, 36, 36, function () { fuToggleDex(); });
  fuMain = fuMkBtn(stage, '拋', 'fu-main', U.mainX - U.mainR, U.mainY - U.mainR, U.mainR * 2, U.mainR * 2, fuMainDown);
  fuMain.addEventListener('pointerup', fuMainUp);
  fuMain.addEventListener('pointercancel', fuMainUp);
  fuMain.addEventListener('pointerleave', fuMainUp);
  fuMkBtn(stage, '◀', 'fu-ang', U.angX, U.angY, 44, 44, function () { fuNudge(-5); });
  fuMkBtn(stage, '▶', 'fu-ang', U.angX + 54, U.angY, 44, 44, function () { fuNudge(5); });
  panel = document.createElement('div');
  panel.id = 'fishDex';
  panel.setAttribute('data-ui', '1');
  panel.style.display = 'none';
  title = document.createElement('div');
  title.setAttribute('data-ui', '1');
  title.textContent = '魚類圖鑑';
  title.style.fontWeight = '700'; title.style.marginBottom = '6px';
  panel.appendChild(title);
  fuDexRows = [];
  for (i = 0; i < FISH.length; i++) {
    rowEl = document.createElement('div');
    rowEl.className = 'fu-row';
    rowEl.setAttribute('data-ui', '1');
    cvEl = document.createElement('canvas');
    cvEl.width = 64; cvEl.height = 36;
    cvEl.setAttribute('data-ui', '1');
    nameEl = document.createElement('span');
    nameEl.setAttribute('data-ui', '1');
    nameEl.style.fontWeight = '700';
    infoEl = document.createElement('span');
    infoEl.setAttribute('data-ui', '1');
    infoEl.style.fontSize = '12px';
    infoEl.style.display = 'block';
    txt = document.createElement('div');
    txt.setAttribute('data-ui', '1');
    txt.appendChild(nameEl);
    txt.appendChild(infoEl);
    rowEl.appendChild(cvEl);
    rowEl.appendChild(txt);
    panel.appendChild(rowEl);
    fuDexRows.push({ cv: cvEl, name: nameEl, info: infoEl });
  }
  close = document.createElement('button');
  close.className = 'fu-btn';
  close.setAttribute('data-ui', '1');
  close.textContent = '✕ 關閉';
  close.style.position = 'static';
  close.addEventListener('pointerdown', function (e) { e.preventDefault(); e.stopPropagation(); fuToggleDex(); });
  panel.appendChild(close);
  stage.appendChild(panel);
  fuDex = panel;
  layer.appendChild(stage);
  document.body.appendChild(layer);
  fuLayer = layer;
  fuStage = stage;
  layer.addEventListener('pointerdown', fuDown);
  layer.addEventListener('pointermove', fuMove);
  layer.addEventListener('pointerup', fuUp);
  layer.addEventListener('pointercancel', fuUp);
  fuLabel = '';
}

function fuResize() {
  var W, H, s, dpr, ox, oy;
  if (!fuLayer) return;
  W = window.innerWidth || 390;
  H = window.innerHeight || 844;
  s = Math.min(W / FISH_LAYER.W, H / FISH_LAYER.H);
  dpr = window.devicePixelRatio || 1;
  ox = (W - FISH_LAYER.W * s) / 2;
  oy = (H - FISH_LAYER.H * s) / 2;
  fuStage.style.transform = 'translate(' + ox + 'px,' + oy + 'px) scale(' + s + ')';
  fuCv.width = Math.round(FISH_LAYER.W * s * dpr);
  fuCv.height = Math.round(FISH_LAYER.H * s * dpr);
  fuCtx.setTransform(fuCv.width / FISH_LAYER.W, 0, 0, fuCv.height / FISH_LAYER.H, 0, 0);
}

function fuFrame(now) {
  var dt;
  fuRaf = 0;
  if (!fuLayer || fuPaused) return;
  dt = Math.min(1 / 30, Math.max(0, (now - fuLast) / 1000));
  fuLast = now;
  fishStep(dt);
  fishDrawFrame(fuCtx, fs.t);
  fuSyncUI();
  fuRaf = requestAnimationFrame(fuFrame);
}

// 切出 App 時整個場景暫停並存檔;回來時從原狀繼續。
function fuOnVis() {
  if (!fuLayer) return;
  if (document.visibilityState === 'hidden') {
    fuPaused = true;
    cancelAnimationFrame(fuRaf);
    fuRaf = 0;
    fishSave();
  } else if (fuPaused) {
    fuPaused = false;
    fuLast = performance.now();
    fuRaf = requestAnimationFrame(fuFrame);
  }
}

// 進入釣魚場景。src 為入口名稱(目前只有 'top')。只能從經營模式進入。
function fishEnter(src) {
  if (fuLayer || typeof game === 'undefined' || game.mode !== 'estate') return false;
  fishLoad();
  fishReset();
  fuBuild();
  game.mode = 'fishing';
  fuPaused = false;
  fuDrag = null;
  fuLast = performance.now();
  document.addEventListener('visibilitychange', fuOnVis);
  window.addEventListener('resize', fuResize);
  fuResize();
  fuRaf = requestAnimationFrame(fuFrame);
  return true;
}

// 離開釣魚場景:存檔、取消動畫、移除覆蓋層、回到經營模式。不動經營存檔。
function fishExit() {
  var ok;
  if (!fuLayer) return false;
  ok = fishSave();
  cancelAnimationFrame(fuRaf);
  fuRaf = 0;
  fuPaused = false;
  fuDrag = null;
  document.removeEventListener('visibilitychange', fuOnVis);
  window.removeEventListener('resize', fuResize);
  fuLayer.parentNode.removeChild(fuLayer);
  fuLayer = null; fuStage = null; fuCv = null; fuCtx = null; fuMain = null; fuDex = null; fuDexRows = [];
  fuLabel = '';
  game.mode = 'estate';
  if (!ok && typeof showToast === 'function') showToast('儲存空間不足,釣魚紀錄可能未保存');
  return true;
}

function fuSyncTop() {
  var b = document.getElementById('btnFish');
  if (!b || typeof game === 'undefined') return;
  b.hidden = game.mode !== 'estate';
}

// 頂列 🎣 鈕:只在經營模式顯示。
function fuMountButton() {
  var top = document.getElementById('topbar'), btn;
  if (!top || document.getElementById('btnFish')) return;
  btn = document.createElement('button');
  btn.id = 'btnFish';
  btn.title = '釣魚';
  btn.textContent = '🎣 釣魚';
  btn.addEventListener('click', function () { fishEnter('top'); });
  top.insertBefore(btn, document.getElementById('btnClear'));
  fuTopTimer = setInterval(fuSyncTop, 300);
  fuSyncTop();
}

fuMountButton();

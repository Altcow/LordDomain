// fishui.js — 釣魚覆蓋層(F0 + 彩頭):頂列 🎣 鈕、全螢幕場景、指標輸入、安全區頂列(↩ 📖)、左上 HUD、面板(開始 / 結算 / 清單 / 排行榜)、進出流程。內部函式皆以 fu 開頭。
var fuLayer = null, fuStage = null, fuCv = null, fuCtx = null, fuMain = null, fuDex = null, fuDexRows = [], fuDexTitles = null,
  fuTop = null, fuHud = null, fuHudEls = null, fuHudKey = '', fuSheet = null, fuSheetBody = null, fuSheetKind = '', fuSel = null,
  fuRaf = 0, fuLast = 0, fuPaused = false, fuDrag = null, fuLabel = '', fuTopTimer = 0, fuResShown = false, fuBoardFrom = 'start';

function fuMkBtn(parent, text, cls, x, y, w, h, onDown) {
  var b = fuBtn(parent, text, cls, onDown);
  b.style.left = x + 'px'; b.style.top = y + 'px'; b.style.width = w + 'px'; b.style.height = h + 'px';
  return b;
}

// 不定位的按鈕(頂列、HUD、面板用);按下時阻止事件冒泡到覆蓋層的拖曳處理。
function fuBtn(parent, text, cls, onDown) {
  var b = document.createElement('button');
  b.className = 'fu-btn ' + cls;
  b.setAttribute('data-ui', '1');
  b.textContent = text;
  b.addEventListener('pointerdown', function (e) { e.preventDefault(); e.stopPropagation(); onDown(); });
  parent.appendChild(b);
  return b;
}

function fuEl(parent, tag, cls, text) {
  var el = document.createElement(tag);
  if (cls) el.className = cls;
  el.setAttribute('data-ui', '1');
  if (text !== undefined) el.textContent = text;
  parent.appendChild(el);
  return el;
}

function fuClear(el) {
  while (el.children && el.children.length) el.removeChild(el.children[0]);
}

function fuThumb(parent, sp, w, h) {
  var cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  cv.setAttribute('data-ui', '1');
  cv.getContext('2d').drawImage(fishSprite(sp, false), 0, 0, w, h);
  parent.appendChild(cv);
  return cv;
}

function fuMmss(sec) {
  var c = Math.max(0, Math.ceil(sec)), m = Math.floor(c / 60), s = c % 60;
  return m + ':' + (s < 10 ? '0' : '') + s;
}

function fuDate(ts) {
  var d = new Date(ts);
  return (d.getMonth() + 1) + '/' + d.getDate();
}

function fuTitleNow() {
  var t = fishTitleOf(fs.save ? fs.save.pb : 0);
  return t ? t.name : '';
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
  else if (p[1] < FISH_LAYER[1][1]) fuDrag = { k: 'boat', x0: p[0], b0: fs.boatX };
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

// 左上 HUD:分數、時間(挑戰)、連擊、本局尾數、最近 6 種魚(小圖 + 數量)、「全部 ›」、最近一次釣獲的短提示(2 秒淡出)。
function fuSyncHud() {
  var s, st, key, i, it, sp, def, age, tl, cnt;
  if (!fuHudEls || !fs.sess || !fs.save) return;
  s = fs.sess; st = fs.save.stats;
  key = [s.score, fs.mode, Math.ceil(fs.left), st.combo, s.catches.length, s.recent.join(',')].join('|');
  if (key !== fuHudKey) {
    fuHudKey = key;
    fuHudEls.score.textContent = String(s.score);
    if (fs.mode === 'challenge') {
      fuHudEls.time.textContent = '剩 ' + fuMmss(fs.left);
      fuHudEls.time.style.color = fs.left < 10 ? '#ff8a7a' : '#ffffff';
    } else {
      fuHudEls.time.textContent = '悠閒釣';
      fuHudEls.time.style.color = '#ffffff';
    }
    fuHudEls.combo.textContent = st.combo > 0 ? '連 ×' + st.combo : '';
    fuHudEls.count.textContent = s.catches.length ? s.catches.length + ' 尾' : '';
    fuClear(fuHudEls.strip);
    for (i = 0; i < s.recent.length; i++) {
      sp = s.recent[i]; def = FISH[sp];
      it = fuEl(fuHudEls.strip, 'span', 'fu-hud-item');
      fuThumb(it, sp, 36, 20);
      cnt = s.counts[def.id] || 0;
      fuEl(it, 'span', '', '×' + cnt);
    }
    fuHudEls.more.style.display = s.catches.length ? '' : 'none';
  }
  if (fs.toast) {
    age = fs.t - fs.toast.t0;
    if (age < 2) {
      tl = FISH[fs.toast.sp].name + '  ' + fs.toast.cm + ' cm  +' + fs.toast.pts + ' 分';
      if (fs.toast.title) tl += '\n🎖 解鎖稱號:' + fs.toast.title;
      fuHudEls.toast.textContent = tl;
      fuHudEls.toast.style.display = '';
      fuHudEls.toast.style.opacity = age < 1.2 ? '1' : String(Math.max(0, (2 - age) / 0.8));
    } else {
      fuHudEls.toast.style.display = 'none';
    }
  }
}

function fuRenderDex() {
  var i, def, e, known, row, cv, ctx2, cap, pb = fs.save ? fs.save.pb : 0, t, got, lines = [];
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
  for (i = 0; i < FISH_TITLES.length; i++) {
    t = FISH_TITLES[i];
    got = !!fs.save.titles[t.name];
    lines.push((got ? '✔ ' : '🔒 ') + t.name + '(' + t.min + ' 分)');
  }
  fuDexTitles.textContent = '稱號(本機最高 ' + pb + ' 分)\n' + lines.join('\n');
}

function fuToggleDex() {
  if (!fuDex) return;
  if (fuDex.style.display === 'block') { fuDex.style.display = 'none'; return; }
  fuRenderDex();
  fuDex.style.display = 'block';
}

// ---- 面板(覆蓋在場景上,整個 #fishSheet 吃掉指標事件)----
function fuSheetClose() {
  if (!fuSheet) return;
  fuSheet.style.display = 'none';
  fuSheetKind = '';
}

function fuSheetOpen(kind) {
  if (!fuSheet) return;
  fuSheetKind = kind;
  fuClear(fuSheetBody);
  if (kind === 'start') fuBuildStart();
  else if (kind === 'result') fuBuildResult();
  else if (kind === 'list') fuBuildList();
  else if (kind === 'board') fuBuildBoard();
  fuSheet.style.display = 'flex';
}

function fuChipRow(parent) {
  return fuEl(parent, 'div', 'fu-chips');
}

function fuBuildStart() {
  var b = fuSheetBody, row, i, key, ok, sk, lim;
  fuEl(b, 'div', 'fu-h', '釣魚');
  fuEl(b, 'div', 'fu-sub', '本機最高 ' + (fs.save.pb || 0) + ' 分' + (fuTitleNow() ? ' · 稱號:' + fuTitleNow() : ''));
  fuEl(b, 'div', 'fu-sec', '模式');
  row = fuChipRow(b);
  fuBtn(row, '悠閒釣', 'fu-chip' + (fuSel.mode === 'leisure' ? ' on' : ''), function () { fuSel.mode = 'leisure'; fuSheetOpen('start'); });
  fuBtn(row, '限時挑戰', 'fu-chip' + (fuSel.mode === 'challenge' ? ' on' : ''), function () { fuSel.mode = 'challenge'; fuSheetOpen('start'); });
  if (fuSel.mode === 'leisure') {
    fuEl(b, 'div', 'fu-note', '無時限。累計分數與圖鑑,不給金幣。');
  } else {
    fuEl(b, 'div', 'fu-note', '時間到自動結算:分數 ÷ 20 換金幣,並計入本機排行榜。');
    fuEl(b, 'div', 'fu-sec', '時限');
    row = fuChipRow(b);
    for (i = 0; i < FISH_TIME_OPTS.length; i++) {
      lim = FISH_TIME_OPTS[i];
      fuBtn(row, lim + ' 秒', 'fu-chip' + (fuSel.limit === lim ? ' on' : ''), (function (v) {
        return function () { fuSel.limit = v; fuSheetOpen('start'); };
      })(lim));
    }
  }
  fuEl(b, 'div', 'fu-sec', '船(純外觀)');
  row = fuChipRow(b);
  for (key in FISH_SKINS) {
    sk = FISH_SKINS[key];
    ok = fishSkinOk(key);
    fuBtn(row, sk.name + (ok ? '' : ' 🔒'), 'fu-chip' + (fuSel.skin === key ? ' on' : '') + (ok ? '' : ' lock'), (function (k, locked) {
      return function () {
        if (locked) { fuSel.note = '需先解鎖稱號「' + FISH_SKINS[k].need + '」'; } else { fuSel.skin = k; fuSel.note = ''; }
        fuSheetOpen('start');
      };
    })(key, !ok));
  }
  if (fuSel.note) fuEl(b, 'div', 'fu-note', fuSel.note);
  row = fuChipRow(b);
  fuBtn(row, '開始', 'fu-go', function () {
    if (fishSkinOk(fuSel.skin)) fishSkinSet(fuSel.skin);
    fishStart(fuSel.mode, fuSel.limit);
    fuSel.note = '';
    fuSheetClose();
  });
  fuBtn(row, '排行榜', 'fu-chip', function () { fuBoardFrom = 'start'; fuSheetOpen('board'); });
  fuBtn(row, '離開', 'fu-chip', function () { fishExit(); });
}

function fuBuildResult() {
  var b = fuSheetBody, sm = fs.summary, row, i, c, r, n;
  if (!sm) return;
  fuEl(b, 'div', 'fu-h', '挑戰結束');
  fuEl(b, 'div', 'fu-big', sm.score + ' 分');
  fuEl(b, 'div', 'fu-sub', '尾數 ' + sm.count + ' · 最高連擊 ' + sm.bestCombo + ' · 時限 ' + sm.limit + ' 秒');
  if (sm.newRecord) fuEl(b, 'div', 'fu-hit', '🏆 破個人紀錄');
  if (sm.rank) fuEl(b, 'div', 'fu-sub', '排行榜第 ' + sm.rank + ' 名');
  fuEl(b, 'div', 'fu-sub', '本局稱號:' + (sm.title || '尚未達 100 分'));
  for (i = 0; i < sm.newTitles.length; i++) fuEl(b, 'div', 'fu-hit', '🎖 解鎖稱號:' + sm.newTitles[i]);
  fuEl(b, 'div', 'fu-hit', sm.gold > 0 ? '+' + sm.gold + ' 🪙' : '未達 20 分,沒有金幣');
  if (sm.catches.length) {
    fuEl(b, 'div', 'fu-sec', '釣到的魚');
    r = fuEl(b, 'div', 'fu-list');
    for (i = sm.catches.length - 1; i >= 0; i--) {
      c = sm.catches[i];
      n = fuEl(r, 'div', 'fu-lrow');
      fuThumb(n, c.sp, 40, 22);
      fuEl(n, 'span', 'fu-lname', FISH[c.sp].name);
      fuEl(n, 'span', 'fu-lcm', c.cm + ' cm');
      fuEl(n, 'span', 'fu-lpts', '+' + c.pts);
    }
  }
  row = fuChipRow(b);
  fuBtn(row, '再來一局', 'fu-go', function () {
    fishReset();
    fuSel.mode = 'challenge';
    fuSel.limit = fs.save.last.limit;
    fuHudKey = '';
    fuResShown = false;
    fuSheetOpen('start');
  });
  fuBtn(row, '排行榜', 'fu-chip', function () { fuBoardFrom = 'result'; fuSheetOpen('board'); });
  fuBtn(row, '離開', 'fu-chip', function () { fishExit(); });
}

function fuBuildList() {
  var b = fuSheetBody, s = fs.sess, r, i, c, n;
  fuEl(b, 'div', 'fu-h', '本局釣獲(' + s.catches.length + ' 尾)');
  if (!s.catches.length) fuEl(b, 'div', 'fu-note', '還沒有釣到魚');
  r = fuEl(b, 'div', 'fu-list');
  for (i = s.catches.length - 1; i >= 0; i--) {
    c = s.catches[i];
    n = fuEl(r, 'div', 'fu-lrow');
    fuThumb(n, c.sp, 40, 22);
    fuEl(n, 'span', 'fu-lname', FISH[c.sp].name);
    fuEl(n, 'span', 'fu-lcm', c.cm + ' cm');
    fuEl(n, 'span', 'fu-lpts', '+' + c.pts);
  }
  fuBtn(b, '關閉', 'fu-chip', function () { fuSheetClose(); });
}

function fuBuildBoard() {
  var b = fuSheetBody, bd = fs.save.board, i, n, row;
  fuEl(b, 'div', 'fu-h', '排行榜(挑戰前 ' + FISH_BOARD_N + ' 名)');
  if (!bd.length) fuEl(b, 'div', 'fu-note', '尚無紀錄');
  row = fuEl(b, 'div', 'fu-list');
  for (i = 0; i < bd.length; i++) {
    n = fuEl(row, 'div', 'fu-lrow');
    fuEl(n, 'span', 'fu-lname', (i + 1) + '.  ' + bd[i].score + ' 分');
    fuEl(n, 'span', 'fu-lcm', fuDate(bd[i].ts) + ' · ' + bd[i].dur + ' 秒');
    fuEl(n, 'span', 'fu-lpts', bd[i].title || '');
  }
  fuBtn(b, '返回', 'fu-chip', function () { fuSheetOpen(fuBoardFrom || 'start'); });
}

function fuBuild() {
  var U = FISH_LAYER.ui, layer, stage, top, panel, title, close, i, rowEl, cvEl, nameEl, infoEl, txt, hud, row, sheet, dexList;
  layer = document.createElement('div');
  layer.id = 'fishLayer';
  stage = document.createElement('div');
  stage.id = 'fishStage';
  fuCv = document.createElement('canvas');
  fuCv.id = 'fishCv';
  fuCtx = fuCv.getContext('2d');
  stage.appendChild(fuCv);
  fuMain = fuMkBtn(stage, '拋', 'fu-main', U.mainX - U.mainR, U.mainY - U.mainR, U.mainR * 2, U.mainR * 2, fuMainDown);
  fuMain.addEventListener('pointerup', fuMainUp);
  fuMain.addEventListener('pointercancel', fuMainUp);
  fuMain.addEventListener('pointerleave', fuMainUp);
  fuMkBtn(stage, '◀', 'fu-ang', U.angX, U.angY, 44, 44, function () { fuNudge(-5); });
  fuMkBtn(stage, '▶', 'fu-ang', U.angX + 54, U.angY, 44, 44, function () { fuNudge(5); });
  layer.appendChild(stage);

  // 頂列:安全區(瀏海 / 動態島)之下,至少 44 px;只有按鈕吃指標事件
  top = document.createElement('div');
  top.id = 'fishTop';
  fuBtn(top, '↩', 'fu-exit', function () { fishExit(); });
  fuBtn(top, '📖', 'fu-dexbtn', function () { fuToggleDex(); });
  layer.appendChild(top);
  fuTop = top;

  // 左上 HUD(頂列之下)
  hud = document.createElement('div');
  hud.id = 'fishHud';
  hud.setAttribute('data-ui', '1');
  row = fuEl(hud, 'div', 'fu-hud-row');
  fuHudEls = { score: fuEl(row, 'span', 'fu-hud-score', '0'), time: fuEl(row, 'span', 'fu-hud-time', '') };
  row = fuEl(hud, 'div', 'fu-hud-row');
  fuHudEls.combo = fuEl(row, 'span', 'fu-hud-combo', '');
  fuHudEls.count = fuEl(row, 'span', 'fu-hud-count', '');
  row = fuEl(hud, 'div', 'fu-hud-row');
  fuHudEls.strip = fuEl(row, 'div', 'fu-hud-strip');
  fuHudEls.more = fuBtn(row, '全部 ›', 'fu-more', function () { fuSheetOpen('list'); });
  fuHudEls.toast = fuEl(hud, 'div', 'fu-toast', '');
  fuHudEls.toast.style.display = 'none';
  layer.appendChild(hud);
  fuHud = hud;
  fuHudKey = '';

  // 圖鑑面板
  panel = document.createElement('div');
  panel.id = 'fishDex';
  panel.setAttribute('data-ui', '1');
  panel.style.display = 'none';
  title = document.createElement('div');
  title.setAttribute('data-ui', '1');
  title.textContent = '魚類圖鑑';
  title.style.fontWeight = '700'; title.style.marginBottom = '6px';
  panel.appendChild(title);
  dexList = document.createElement('div');
  dexList.setAttribute('data-ui', '1');
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
    dexList.appendChild(rowEl);
    fuDexRows.push({ cv: cvEl, name: nameEl, info: infoEl });
  }
  panel.appendChild(dexList);
  fuDexTitles = document.createElement('div');
  fuDexTitles.className = 'fu-dex-titles';
  fuDexTitles.setAttribute('data-ui', '1');
  panel.appendChild(fuDexTitles);
  close = document.createElement('button');
  close.className = 'fu-btn';
  close.setAttribute('data-ui', '1');
  close.textContent = '✕ 關閉';
  close.style.position = 'static';
  close.addEventListener('pointerdown', function (e) { e.preventDefault(); e.stopPropagation(); fuToggleDex(); });
  panel.appendChild(close);
  layer.appendChild(panel);
  fuDex = panel;

  // 面板層(開始 / 結算 / 清單 / 排行榜)
  sheet = document.createElement('div');
  sheet.id = 'fishSheet';
  sheet.setAttribute('data-ui', '1');
  sheet.style.display = 'none';
  fuSheetBody = document.createElement('div');
  fuSheetBody.className = 'fu-panel';
  fuSheetBody.setAttribute('data-ui', '1');
  sheet.appendChild(fuSheetBody);
  layer.appendChild(sheet);
  fuSheet = sheet;
  fuSheetKind = '';

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
  fuSyncHud();
  if (fs.summary && !fuResShown) { fuResShown = true; fuSheetOpen('result'); }
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

// 進入釣魚場景。src 為入口名稱(目前只有 'top')。只能從經營模式進入。進入後先開「開始」面板。
function fishEnter(src) {
  if (fuLayer || typeof game === 'undefined' || game.mode !== 'estate') return false;
  fishLoad();
  fishReset();
  fuSel = { mode: fs.mode, limit: fs.limit, skin: fs.save.opt.skin, note: '' };
  fuResShown = false;
  fuBuild();
  game.mode = 'fishing';
  fuPaused = false;
  fuDrag = null;
  fuLast = performance.now();
  document.addEventListener('visibilitychange', fuOnVis);
  window.addEventListener('resize', fuResize);
  fuSheetOpen('start');
  fuResize();
  fuRaf = requestAnimationFrame(fuFrame);
  return true;
}

// 離開釣魚場景:限時挑戰中途離開會直接結算;存檔、取消動畫、移除覆蓋層、回到經營模式。不動經營存檔以外的資料。
function fishExit() {
  var ok;
  if (!fuLayer) return false;
  if (fs.mode === 'challenge' && fs.live && !fs.over) fishSettle();
  ok = fishSave();
  cancelAnimationFrame(fuRaf);
  fuRaf = 0;
  fuPaused = false;
  fuDrag = null;
  document.removeEventListener('visibilitychange', fuOnVis);
  window.removeEventListener('resize', fuResize);
  fuLayer.parentNode.removeChild(fuLayer);
  fuLayer = null; fuStage = null; fuCv = null; fuCtx = null; fuMain = null; fuDex = null; fuDexRows = [];
  fuTop = null; fuHud = null; fuHudEls = null; fuHudKey = ''; fuSheet = null; fuSheetBody = null; fuSheetKind = ''; fuDexTitles = null;
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

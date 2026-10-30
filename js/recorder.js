// recorder.js — 拍攝模式與錄影(☰ 設定 → 拍攝 → 🎬 拍攝錄影)。
// 錄的是主畫布 #game(captureStream)加上 AU.master 分流的聲音(AU.recordTap);影片只存記憶體 Blob。
// 拍攝中 body 掛 class shooting,CSS 隱藏畫布以外的 DOM;自動運鏡包在 draw 外層,結束後還原鏡頭與解析度。

const REC_MAX_MS = 120000;
const REC_FPS = 30;
const REC_LONG_SIDE = 1280;
const REC_ORBIT_SEC = 30;
const REC_ZOOM_LO = 0.9;
const REC_ZOOM_HI = 1.3;
const REC_GRACE_MS = 800;
const REC_FINISH_FALLBACK_MS = 3000;
const REC_MIME_ORDER = [
  'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
  'video/mp4',
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm'
];
const REC_LEN_OPTS = [[15, '15 秒'], [30, '30 秒'], [60, '60 秒'], [0, '手動停止']];
const REC_QUAL_OPTS = [['std', '標準 720p'], ['hi', '高畫質']];
const REC_CAM_OPTS = [['auto', '自動運鏡'], ['fixed', '固定鏡頭']];

const REC = {
  inited: false,
  state: 'idle',       // idle | recording | stopping | review
  mime: '',
  opts: { len: 30, sound: true, quality: 'std', auto: true, hud: true },
  recorder: null,
  chunks: [],
  tracks: [],
  tapped: false,
  timer: 0,
  hudTimer: 0,
  startMs: 0,
  limitMs: 0,
  graceUntil: 0,
  saved: null,
  cam: null,
  blob: null,
  url: '',
  ui: null
};

function recNowMs() {
  if (typeof performance !== 'undefined' && performance.now) return performance.now();
  return Date.now();
}

// 依序試 REC_MIME_ORDER,回傳第一個支援的 mimeType;都不支援或無 isTypeSupported 回傳 ''
function recPickMime(isSupported) {
  if (typeof isSupported !== 'function') return '';
  for (let i = 0; i < REC_MIME_ORDER.length; i++) {
    let ok = false;
    try { ok = !!isSupported(REC_MIME_ORDER[i]); } catch (e) { ok = false; }
    if (ok) return REC_MIME_ORDER[i];
  }
  return '';
}

function recSupport() {
  if (typeof MediaRecorder === 'undefined' || typeof MediaStream === 'undefined') return '';
  const canvas = document.getElementById('game');
  if (!canvas || typeof canvas.captureStream !== 'function') return '';
  return recPickMime(function (m) { return MediaRecorder.isTypeSupported(m); });
}

function recModeError() {
  if (typeof game === 'undefined' || !game) return '目前無法拍攝';
  if (game.mode === 'attack' || game.mode === 'replay') return '戰鬥中無法拍攝';
  if (game.mode !== 'estate' && game.mode !== 'visit') return '拍攝只能在經營或參觀模式使用';
  if (typeof pano !== 'undefined' && pano.open) return '全景預覽中無法拍攝';
  if (typeof lootMode === 'function' && lootMode()) return '戰鬥或沙盤中無法拍攝';
  return '';
}

function recFmt(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m + ':' + (s < 10 ? '0' : '') + s;
}

function recBaseMime(m) {
  return String(m || '').split(';')[0];
}

function recStamp() {
  return new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
}

// 自動運鏡的圓心:城主府(與 main.js boot 置中相同),沒有就地圖中央
function recOrbitCenter() {
  let gx = MAP_W >> 1, gy = MAP_H >> 1;
  const palace = world.objects ? world.objects.find(function (o) { return o.type === 'palace'; }) : null;
  if (palace) { gx = palace.x + 2; gy = palace.y + 2; }
  const h = world.height ? (world.height[idx(gx, gy)] || 0) : 0;
  return { x: isoX(gx + 0.5, gy + 0.5), y: isoY(gx + 0.5, gy + 0.5, h) };
}

// 縮放解析度:標準 = 長邊不超過 REC_LONG_SIDE;高畫質 = 螢幕 dpr。畫布 backing store 與 viewport.dpr 一起改,繪圖倍率才會對
function recApplyRes(quality) {
  const canvas = document.getElementById('game');
  if (!canvas) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const long = Math.max(viewport.w, viewport.h, 1);
  const s = quality === 'hi' ? dpr : Math.min(dpr, REC_LONG_SIDE / long);
  canvas.width = Math.max(1, Math.round(viewport.w * s));
  canvas.height = Math.max(1, Math.round(viewport.h * s));
  viewport.dpr = s;
}

// 自動運鏡:繞城主府緩慢一圈(REC_ORBIT_SEC),zoom 在 0.9~1.3 間緩慢呼吸;每幀朝目標插值
function recCamTick(time) {
  const cam = REC.cam;
  if (REC.state !== 'recording' || !cam) return;
  if (cam.t0 === null) { cam.t0 = time; cam.last = time; }
  const t = time - cam.t0;
  const dt = Math.min(0.1, Math.max(0, time - cam.last));
  cam.last = time;
  const a = 2 * Math.PI * t / REC_ORBIT_SEC;
  const rad = TW * 2.5;
  const tx = cam.center.x + rad * Math.cos(a);
  const ty = cam.center.y + rad * 0.5 * Math.sin(a);
  let tz = 1.1 + 0.2 * Math.sin(2 * Math.PI * t / 20);
  tz = Math.min(REC_ZOOM_HI, Math.max(REC_ZOOM_LO, tz));
  tz = Math.min(ZOOM_MAX, Math.max(zoomMin, tz));
  const k = 1 - Math.exp(-1.5 * dt);
  view.x += (tx - view.x) * k;
  view.y += (ty - view.y) * k;
  view.zoom += (tz - view.zoom) * k;
  clampView();
}

function recShowRoot(mode) {
  const root = REC.ui && REC.ui.root;
  if (!root) return;
  ['rec-show-panel', 'rec-show-hud', 'rec-show-review'].forEach(function (c) { root.classList.remove(c); });
  if (mode === 'none') { root.classList.remove('rec-on'); return; }
  root.classList.add('rec-on');
  root.classList.add('rec-show-' + mode);
}

function recSetMsg(text) {
  if (REC.ui) REC.ui.msg.textContent = text || '';
}

function recSetHudOff(off) {
  if (!REC.ui) return;
  if (off) REC.ui.hud.classList.add('off');
  else REC.ui.hud.classList.remove('off');
}

function recHudTick() {
  const R = REC;
  if (!R.ui || R.state !== 'recording') return;
  const el = Math.max(0, (recNowMs() - R.startMs) / 1000);
  const sec = R.opts.len > 0 ? Math.max(0, Math.ceil(R.opts.len - el)) : Math.floor(el);
  R.ui.time.textContent = recFmt(sec);
}

// 取得聲音軌:AU 不存在或分流失敗回傳 null(改為只錄畫面)
function recTapAudio() {
  if (typeof AU !== 'object' || !AU || typeof AU.recordTap !== 'function') return null;
  const s = AU.recordTap();
  if (!s || !s.getAudioTracks) return null;
  const list = s.getAudioTracks();
  return list && list.length ? list[0] : null;
}

function recStart() {
  const R = REC;
  if (R.state !== 'idle') return;
  const err = recModeError();
  if (err) { recSetMsg(err); return; }
  if (!R.mime) { recSetMsg('此瀏覽器不支援錄影'); return; }
  if (typeof AU === 'object' && AU && AU.unlock) AU.unlock();

  const canvas = document.getElementById('game');
  let canvasStream = null;
  try { canvasStream = canvas.captureStream(REC_FPS); } catch (e) { console.warn('[rec] captureStream failed', e); }
  if (!canvasStream) { recSetMsg('此瀏覽器不支援錄影'); return; }

  const tracks = canvasStream.getVideoTracks().slice();
  let tapped = false;
  if (R.opts.sound) {
    const at = recTapAudio();
    if (at) { tracks.push(at); tapped = true; }
    else showToast('無法錄到聲音,改為只錄畫面');
  }

  let rec = null;
  try {
    rec = new MediaRecorder(new MediaStream(tracks), { mimeType: R.mime });
    rec.start(1000);
  } catch (e) {
    console.warn('[rec] start failed', e);
    if (tapped) AU.recordUntap();
    recSetMsg('錄影啟動失敗,請再試一次');
    return;
  }

  R.tracks = tracks;
  R.tapped = tapped;
  R.chunks = [];
  R.recorder = rec;
  rec.ondataavailable = function (e) { if (e && e.data && e.data.size > 0) R.chunks.push(e.data); };
  rec.onstop = recFinish;
  rec.onerror = function (e) { console.warn('[rec] error', e); recStop(); };

  R.saved = { x: view.x, y: view.y, zoom: view.zoom };
  R.cam = R.opts.auto ? { center: recOrbitCenter(), t0: null, last: null } : null;
  recApplyRes(R.opts.quality);
  R.limitMs = R.opts.len > 0 ? R.opts.len * 1000 : REC_MAX_MS;
  R.startMs = recNowMs();
  R.graceUntil = R.startMs + REC_GRACE_MS;
  R.state = 'recording';
  R.timer = setTimeout(recStop, R.limitMs);
  R.hudTimer = setInterval(recHudTick, 250);
  recSetHudOff(!R.opts.hud);
  document.body.classList.add('shooting');
  recShowRoot('hud');
  recHudTick();
}

// 結束錄製:停止 MediaRecorder,實際收尾在 recFinish(onstop)。保險計時避免 onstop 沒來時卡在 stopping
function recStop() {
  const R = REC;
  if (R.state !== 'recording') return;
  R.state = 'stopping';
  if (R.timer) clearTimeout(R.timer);
  if (R.hudTimer) clearInterval(R.hudTimer);
  R.hudTimer = 0;
  const rec = R.recorder;
  R.timer = setTimeout(function () { if (REC.state === 'stopping') recFinish(); }, REC_FINISH_FALLBACK_MS);
  if (rec && rec.state !== 'inactive') {
    try { rec.stop(); return; } catch (e) { console.warn('[rec] stop failed', e); }
  }
  recFinish();
}

function recFinish() {
  const R = REC;
  if (R.state !== 'stopping') return;
  if (R.timer) clearTimeout(R.timer);
  R.timer = 0;
  if (R.tapped && typeof AU === 'object' && AU && AU.recordUntap) AU.recordUntap();
  R.tapped = false;
  R.tracks.forEach(function (t) { try { t.stop(); } catch (e) { /* 已停止 */ } });
  R.tracks = [];
  resizeCanvas(document.getElementById('game'));
  if (R.saved) {
    view.x = R.saved.x;
    view.y = R.saved.y;
    view.zoom = R.saved.zoom;
    clampView();
  }
  R.saved = null;
  R.cam = null;
  R.recorder = null;
  document.body.classList.remove('shooting');

  const chunks = R.chunks;
  R.chunks = [];
  const blob = chunks.length ? new Blob(chunks, { type: recBaseMime(R.mime) }) : null;
  if (!blob || blob.size === 0) {
    R.state = 'idle';
    recShowRoot('panel');
    recSetMsg('沒有錄到畫面,請再試一次');
    return;
  }
  R.blob = blob;
  R.url = URL.createObjectURL(blob);
  R.ui.video.src = R.url;
  R.state = 'review';
  recShowRoot('review');
}

function recRelease() {
  const R = REC;
  if (R.url) {
    try { URL.revokeObjectURL(R.url); } catch (e) { console.warn('[rec] revoke failed', e); }
  }
  R.url = '';
  R.blob = null;
  if (R.ui) R.ui.video.src = '';
}

// 🗑 刪除重錄:丟掉影片,回到設定面板
function recDiscard() {
  recRelease();
  REC.state = 'idle';
  recSetMsg('');
  recRenderPanel();
  recShowRoot('panel');
}

// ✕ 關閉:丟掉影片並關閉面板
function recClose() {
  recRelease();
  REC.state = 'idle';
  recShowRoot('none');
}

function recDownload(name) {
  const a = document.createElement('a');
  a.href = REC.url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// 💾 儲存/分享:優先 navigator.share({files}),iOS 會出現分享選單可「儲存影片」;不支援或無法分享檔案時改用下載
function recSave() {
  const R = REC;
  if (!R.blob) return;
  const ext = R.mime.indexOf('mp4') >= 0 ? 'mp4' : 'webm';
  const name = 'lorddomain-' + recStamp() + '.' + ext;
  let file = null;
  try { file = new File([R.blob], name, { type: recBaseMime(R.mime) }); } catch (e) { file = null; }
  const nav = typeof navigator !== 'undefined' ? navigator : null;
  let canShare = false;
  if (file && nav && typeof nav.share === 'function') {
    try { canShare = typeof nav.canShare !== 'function' || !!nav.canShare({ files: [file] }); } catch (e) { canShare = false; }
  }
  if (canShare) {
    let p = null;
    try { p = nav.share({ files: [file], title: '城主領地' }); } catch (e) { p = null; }
    if (p && p.catch) {
      p.catch(function (e) { if (!e || e.name !== 'AbortError') recDownload(name); });
    }
    return;
  }
  recDownload(name);
}

function recOnTap(e) {
  if (e && e.stopPropagation) e.stopPropagation();
  if (REC.state !== 'recording') return;
  if (recNowMs() < REC.graceUntil) return;
  recStop();
}

function recOnResize() {
  if (REC.state === 'recording') recApplyRes(REC.opts.quality);
}

function recOnVisibility() {
  if (typeof document !== 'undefined' && document.hidden) recStop();
}

function recEl(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

function recToggle(el, on) {
  if (on) el.classList.add('on');
  else el.classList.remove('on');
}

function recRow(label, control) {
  const row = recEl('div', 'rec-row');
  row.appendChild(recEl('span', 'rec-lbl', label));
  row.appendChild(control);
  return row;
}

function recSeg(options, onPick) {
  const wrap = recEl('div', 'rec-seg');
  const items = options.map(function (o) {
    const b = recEl('button', '', o[1]);
    b.addEventListener('click', function () { onPick(o[0]); });
    wrap.appendChild(b);
    return { key: o[0], el: b };
  });
  return { el: wrap, items: items };
}

function recSegSet(seg, key) {
  seg.items.forEach(function (it) { recToggle(it.el, it.key === key); });
}

// 開關按鈕:點擊切換 REC.opts[key](key 為 'sound' 或 'hud')
function recSwitch(key) {
  const b = recEl('button', 'rec-sw', '關');
  b.setAttribute('role', 'switch');
  b.addEventListener('click', function () {
    REC.opts[key] = !REC.opts[key];
    recRenderPanel();
  });
  return b;
}

function recSwSet(btn, on) {
  btn.textContent = on ? '開' : '關';
  recToggle(btn, on);
  btn.setAttribute('aria-checked', on ? 'true' : 'false');
}

function recRenderPanel() {
  const R = REC;
  if (!R.ui) return;
  const o = R.opts;
  recSegSet(R.ui.segLen, o.len);
  recSegSet(R.ui.segQual, o.quality);
  recSegSet(R.ui.segCam, o.auto ? 'auto' : 'fixed');
  recSwSet(R.ui.swSound, o.sound);
  recSwSet(R.ui.swHud, o.hud);
}

function recOpen() {
  if (!REC.ui) return;
  if (typeof AU === 'object' && AU && AU.unlock) AU.unlock();
  if (!REC.mime) { showToast('此瀏覽器不支援錄影'); return; }
  recRenderPanel();
  recSetMsg(recModeError());
  recShowRoot('panel');
}

function recBuild() {
  const R = REC;
  const root = recEl('div', '');
  root.id = 'recRoot';

  const panel = recEl('div', 'rec-panel');
  panel.appendChild(recEl('h3', 'rec-title', '🎬 拍攝錄影'));
  panel.appendChild(recEl('p', 'rec-desc', '拍攝時會隱藏所有介面,點畫面任意處即可結束。'));
  const segLen = recSeg(REC_LEN_OPTS, function (v) { R.opts.len = v; recRenderPanel(); });
  const segQual = recSeg(REC_QUAL_OPTS, function (v) { R.opts.quality = v; recRenderPanel(); });
  const segCam = recSeg(REC_CAM_OPTS, function (v) { R.opts.auto = v === 'auto'; recRenderPanel(); });
  const swSound = recSwitch('sound');
  const swHud = recSwitch('hud');
  panel.appendChild(recRow('長度', segLen.el));
  panel.appendChild(recRow('錄聲音', swSound));
  panel.appendChild(recRow('畫質', segQual.el));
  panel.appendChild(recEl('p', 'rec-hint', '標準約 720p / 30fps,較省電;高畫質依螢幕解析度,較耗效能。'));
  panel.appendChild(recRow('鏡頭', segCam.el));
  panel.appendChild(recRow('顯示紅點與倒數', swHud));
  const msg = recEl('p', 'rec-msg', '');
  panel.appendChild(msg);
  const actions = recEl('div', 'rec-actions');
  const start = recEl('button', 'rec-primary', '● 開始拍攝');
  start.addEventListener('click', recStart);
  const close = recEl('button', '', '✕ 關閉');
  close.addEventListener('click', recClose);
  actions.appendChild(close);
  actions.appendChild(start);
  panel.appendChild(actions);

  const hud = recEl('div', 'rec-hud');
  const dot = recEl('span', 'rec-dot', '');
  const time = recEl('span', 'rec-time', '0:00');
  const stopBtn = recEl('button', 'rec-hud-btn', '⏹');
  stopBtn.setAttribute('aria-label', '停止拍攝');
  stopBtn.addEventListener('click', function (e) { if (e && e.stopPropagation) e.stopPropagation(); recStop(); });
  const hideBtn = recEl('button', 'rec-hud-btn', '✕');
  hideBtn.setAttribute('aria-label', '隱藏指示');
  hideBtn.addEventListener('click', function (e) { if (e && e.stopPropagation) e.stopPropagation(); recSetHudOff(true); });
  hud.appendChild(dot);
  hud.appendChild(time);
  hud.appendChild(stopBtn);
  hud.appendChild(hideBtn);

  const catchLayer = recEl('div', 'rec-catch');
  catchLayer.addEventListener('click', recOnTap);

  const review = recEl('div', 'rec-review');
  const video = document.createElement('video');
  video.controls = true;
  video.setAttribute('playsinline', '');
  video.className = 'rec-video';
  review.appendChild(video);
  const rActions = recEl('div', 'rec-actions');
  const save = recEl('button', 'rec-primary', '💾 儲存/分享');
  save.addEventListener('click', recSave);
  const discard = recEl('button', '', '🗑 刪除重錄');
  discard.addEventListener('click', recDiscard);
  const closeR = recEl('button', '', '✕ 關閉');
  closeR.addEventListener('click', recClose);
  rActions.appendChild(discard);
  rActions.appendChild(closeR);
  rActions.appendChild(save);
  review.appendChild(rActions);

  root.appendChild(panel);
  root.appendChild(catchLayer);
  root.appendChild(hud);
  root.appendChild(review);
  document.body.appendChild(root);

  R.ui = {
    root: root, panel: panel, hud: hud, catchLayer: catchLayer, time: time, msg: msg, video: video,
    segLen: segLen, segQual: segQual, segCam: segCam, swSound: swSound, swHud: swHud
  };
}

function recInit() {
  const R = REC;
  if (R.inited) return;
  R.inited = true;
  if (typeof document === 'undefined' || !document.getElementById) return;
  R.mime = recSupport();
  recBuild();
  if (R.mime && typeof settingsAddRow === 'function') {
    try { settingsAddRow('🎬 拍攝錄影', recOpen, '拍攝'); } catch (e) { console.warn('[rec] settingsAddRow failed', e); }
  }
  if (typeof draw === 'function') {
    const baseDraw = draw;
    draw = function (ctx, time) {
      recCamTick(time);
      return baseDraw(ctx, time);
    };
  }
  if (typeof showToast === 'function') {
    const baseToast = showToast;
    showToast = function (msg) {
      if (REC.state === 'recording' || REC.state === 'stopping') return;
      return baseToast(msg);
    };
  }
  recRenderPanel();
  window.addEventListener('resize', recOnResize);
  document.addEventListener('visibilitychange', recOnVisibility);
  window.addEventListener('pagehide', function () { recStop(); });
}

if (typeof document !== 'undefined' && document.readyState) {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', recInit);
  else recInit();
}

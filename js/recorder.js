// recorder.js — 拍攝模式與錄影(☰ 設定 → 拍攝 → 🎬 拍攝錄影)。
// 錄的是主畫布 #game(captureStream)加上 AU.master 分流的聲音(AU.recordTap);影片只存記憶體 Blob。
// 拍攝中 body 掛 class shooting,CSS 隱藏畫布以外的 DOM;自動運鏡包在 draw 外層,結束後還原鏡頭與解析度。
// 鏡頭四種:自動運鏡(繞城主府)/ 固定 / 手動運鏡(自己拖曳,鏡頭濾波器限速+緩動)/ 路徑導覽(依路點飛行)。
// 限速只在錄影中套用:錄影中手勢由本檔在 window capture 階段接手,改寫「目標視角」,實際鏡頭用指數平滑追隨並限制最大速度。
// 固定比例(16:9 / 9:16 / 1:1)或時間戳時,每幀把 #game 中央裁切複製到錄影專用畫布再錄。

const REC_MAX_MS = 600000;
const REC_IOS_MAX_MS = 120000;
const REC_FPS = 30;
const REC_LONG_SIDE = 1280;
const REC_ORBIT_SEC = 30;
const REC_ZOOM_LO = 0.9;
const REC_ZOOM_HI = 1.3;
const REC_GRACE_MS = 800;
const REC_FINISH_FALLBACK_MS = 3000;
const REC_SAFE_BYTES = 150e6;
const REC_HARD_BYTES = 200e6;
const REC_AUDIO_BPS = 128000;
const REC_MIN_BPS = 600000;
const REC_BPP = 0.09;
const REC_SPEED_VAL = { slow: 0.2, mid: 0.35, fast: 0.6 };
const REC_SMOOTH_K = { low: 8, mid: 4, high: 2 };
const REC_ZOOM_PER_PAN = 1.2;
const REC_BACKLOG = 1;
const REC_TOUR_EASE = 1.8;
const REC_WAY_KEY = 'lorddomain.rec.waypoints';
const REC_WAY_MAX = 30;
const REC_MIME_ORDER = [
  'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
  'video/mp4',
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm'
];
const REC_LEN_OPTS = [[15, '15 秒'], [30, '30 秒'], [60, '60 秒'], [120, '2 分'], [300, '5 分'], [600, '10 分'], [0, '手動停止']];
const REC_QUAL_OPTS = [['std', '標準 720p'], ['hi', '高畫質']];
const REC_CAM_OPTS = [['auto', '自動運鏡'], ['fixed', '固定鏡頭'], ['manual', '手動運鏡'], ['tour', '路徑導覽']];
const REC_MODE_OPTS = [['game', '遊戲內錄影'], ['cam', '運鏡模式(搭配系統螢幕錄影)']];
const REC_SPEED_OPTS = [['slow', '慢'], ['mid', '中'], ['fast', '快'], ['custom', '自訂']];
const REC_SMOOTH_OPTS = [['low', '低'], ['mid', '中'], ['high', '高']];
const REC_ASPECT_OPTS = [['auto', '依視窗'], ['16:9', '16:9'], ['9:16', '9:16 直式'], ['1:1', '1:1']];
const REC_FPS_OPTS = [[30, '30'], [60, '60']];
const REC_CD_OPTS = [[0, '關'], [3, '3 秒']];
const REC_HOLD_OPTS = [[1, '1 秒'], [2, '2 秒'], [4, '4 秒'], [8, '8 秒']];
const REC_TIPS = [
  '先把介面收好、把想拍的區域大致擺好,再按開始。',
  '運鏡速度選「慢」最不容易暈,手滑太快時狀態列會變紅提醒。',
  '大地圖建議先「標記路點」,或按「全城一覽」自動產生,再用路徑導覽。',
  '手機請橫放並保持螢幕常亮;錄影中不要切到別的 App(iPhone 切走會中斷)。',
  '影片只存在記憶體,錄完請盡快按「儲存/分享」;重新整理頁面就會消失。',
  '時間越長、畫質越高,檔案越大;預估超過 150 MB 會自動降畫質。'
];

const REC = {
  inited: false,
  state: 'idle',       // idle | plan | countdown | recording | stopping | review
  mime: '',
  opts: {
    len: 30, sound: true, quality: 'std', auto: true, hud: true,
    cam: 'auto', speed: 'mid', speedCustom: 0.35, smooth: 'mid',
    aspect: 'auto', fps: 30, camOnly: false, countdown: 0, clean: false, stamp: false, hold: 2, tourStop: false
  },
  recorder: null,
  chunks: [],
  tracks: [],
  tapped: false,
  timer: 0,
  hudTimer: 0,
  cdTimer: 0,
  cd: 0,
  startMs: 0,
  limitMs: 0,
  graceUntil: 0,
  paused: false,
  pauseAt: 0,
  pausedMs: 0,
  canPause: false,
  bytes: 0,
  note: '',
  plan: null,
  copy: null,
  way: [],
  saved: null,
  cam: null,
  blob: null,
  url: '',
  ui: null
};

const recGs = { ptrs: {}, n: 0, pinch: null, bound: false };

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

function recIsIOS() {
  const n = typeof navigator !== 'undefined' ? navigator : null;
  if (!n) return false;
  if (/iPhone|iPad|iPod/.test(String(n.userAgent || ''))) return true;
  return String(n.platform || '') === 'MacIntel' && (n.maxTouchPoints || 0) > 1;
}

function recMaxMs() {
  return recIsIOS() ? REC_IOS_MAX_MS : REC_MAX_MS;
}

// 設定的長度(秒;0 = 手動停止)換成實際上限毫秒,受 recMaxMs 保護
function recLenMs(len) {
  const max = recMaxMs();
  return len > 0 ? Math.min(len * 1000, max) : max;
}

function recIsStandalone() {
  try {
    if (typeof navigator !== 'undefined' && navigator && navigator.standalone === true) return true;
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') return !!window.matchMedia('(display-mode: standalone)').matches;
  } catch (e) { /* 無法偵測就當作瀏覽器分頁 */ }
  return false;
}

function recUnsupportedText() {
  return '此瀏覽器不支援遊戲內錄影。請改用「運鏡模式」搭配系統螢幕錄影(iPhone:控制中心的錄製鈕),運鏡限速與路徑導覽照樣可用。';
}

function recIosText() {
  return 'iPhone / iPad 的遊戲內錄影限制較多:最長 2 分鐘、切到別的 App 會中斷、記憶體不足可能失敗。' +
    (recIsStandalone() ? '你是從主畫面開啟的 App,' : '') + '最穩的做法是選「運鏡模式」,再用系統螢幕錄影(可錄到整個畫面與系統聲音)。';
}

function recModeText() {
  return '遊戲內錄影:只錄畫布,可含遊戲聲音,檔案存在記憶體,iOS 切走 App 會中斷。運鏡模式:不錄影,只套用運鏡限速與路徑導覽並隱藏介面,請用系統螢幕錄影錄下整個畫面(最穩)。';
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

function recClamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

function recSetStyle(el, k, v) {
  if (el && el.style) el.style[k] = v;
}

// ---------- 畫面規格 / 檔案大小預估 ----------

// 固定比例時,視窗內居中的取景框(CSS px);auto 為整個視窗
function recCropRect(vw, vh, aspect) {
  const r = aspect === '16:9' ? 16 / 9 : aspect === '9:16' ? 9 / 16 : aspect === '1:1' ? 1 : 0;
  if (!r) return { x: 0, y: 0, w: vw, h: vh };
  let w = vw, h = vw / r;
  if (h > vh) { h = vh; w = vh * r; }
  return { x: (vw - w) / 2, y: (vh - h) / 2, w: w, h: h };
}

// 輸出尺寸:auto = 主畫布縮放後的 backing store;固定比例 = 標準短邊 720、高畫質短邊 1080
function recOutDims(aspect, quality) {
  if (aspect === 'auto' || !aspect) {
    const dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
    const long = Math.max(viewport.w, viewport.h, 1);
    const s = quality === 'hi' ? dpr : Math.min(dpr, REC_LONG_SIDE / long);
    return { w: Math.max(1, Math.round(viewport.w * s)), h: Math.max(1, Math.round(viewport.h * s)), s: s };
  }
  const sh = quality === 'hi' ? 1080 : 720;
  const lg = Math.round(sh * 16 / 9);
  if (aspect === '16:9') return { w: lg, h: sh, s: 0 };
  if (aspect === '9:16') return { w: sh, h: lg, s: 0 };
  return { w: sh, h: sh, s: 0 };
}

function recBitrate(d, fps) {
  return recClamp(Math.round(d.w * d.h * fps * REC_BPP), 1200000, 12000000);
}

// 預估:依設定算輸出尺寸、位元率與檔案大小;超過安全值先把高畫質降為標準,仍超過就下調位元率
function recEstimate(o) {
  o = o || REC.opts;
  const sec = recLenMs(o.len) / 1000;
  const fps = o.fps === 60 ? 60 : 30;
  const audio = o.sound ? REC_AUDIO_BPS : 0;
  let q = o.quality === 'hi' ? 'hi' : 'std';
  let d = recOutDims(o.aspect, q);
  let br = recBitrate(d, fps);
  let bytes = (br + audio) * sec / 8;
  let downgraded = false, capped = false;
  if (bytes > REC_SAFE_BYTES && q === 'hi') {
    q = 'std';
    downgraded = true;
    d = recOutDims(o.aspect, q);
    br = recBitrate(d, fps);
    bytes = (br + audio) * sec / 8;
  }
  if (bytes > REC_SAFE_BYTES) {
    br = Math.max(REC_MIN_BPS, Math.floor(REC_SAFE_BYTES * 8 / sec - audio));
    capped = true;
    bytes = (br + audio) * sec / 8;
  }
  return { w: d.w, h: d.h, fps: fps, sec: sec, quality: q, bitrate: br, bytes: bytes, mb: bytes / 1e6, downgraded: downgraded, capped: capped };
}

// 縮放解析度:標準 = 長邊不超過 REC_LONG_SIDE;高畫質 = 螢幕 dpr。畫布 backing store 與 viewport.dpr 一起改,繪圖倍率才會對
// 固定比例時,backing store 夠大讓取景框能裁出輸出尺寸(上限 dpr 2、長邊 2880)
function recApplyRes(quality) {
  const canvas = document.getElementById('game');
  if (!canvas) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const long = Math.max(viewport.w, viewport.h, 1);
  let s;
  if (REC.opts.aspect === 'auto' || !REC.opts.aspect) {
    s = quality === 'hi' ? dpr : Math.min(dpr, REC_LONG_SIDE / long);
  } else {
    const crop = recCropRect(viewport.w, viewport.h, REC.opts.aspect);
    const out = recOutDims(REC.opts.aspect, quality);
    s = Math.min(2, out.w / Math.max(1, crop.w), 2880 / long);
    s = Math.max(0.5, s);
  }
  canvas.width = Math.max(1, Math.round(viewport.w * s));
  canvas.height = Math.max(1, Math.round(viewport.h * s));
  viewport.dpr = s;
}

// ---------- 鏡頭:自動運鏡 ----------

// 自動運鏡的圓心:城主府(與 main.js boot 置中相同),沒有就地圖中央
function recOrbitCenter() {
  let gx = boardW() >> 1, gy = boardH() >> 1;
  const palace = world.objects ? world.objects.find(function (o) { return o.type === 'palace'; }) : null;
  if (palace) { gx = palace.x + 2; gy = palace.y + 2; }
  const h = world.height ? (world.height[idx(gx, gy)] || 0) : 0;
  return { x: isoX(gx + 0.5, gy + 0.5), y: isoY(gx + 0.5, gy + 0.5, h) };
}

function recCamMode() {
  const o = REC.opts;
  if (o.cam === 'manual' || o.cam === 'tour') return o.cam;
  return o.auto ? 'auto' : 'fixed';
}

// 運鏡速度:每秒幾個螢幕寬
function recSpeed() {
  const o = REC.opts;
  if (o.speed === 'custom') return recClamp(Number(o.speedCustom) || 0.35, 0.05, 1.5);
  return REC_SPEED_VAL[o.speed] || REC_SPEED_VAL.mid;
}

function recSmoothK() {
  return REC_SMOOTH_K[REC.opts.smooth] || REC_SMOOTH_K.mid;
}

// 自動運鏡:繞城主府緩慢一圈(REC_ORBIT_SEC),zoom 在 0.9~1.3 間緩慢呼吸;每幀朝目標插值
function recAutoTick(time) {
  const cam = REC.cam;
  if (cam.t0 === null) { cam.t0 = time; cam.last = time; }
  const dt = Math.min(0.1, Math.max(0, time - cam.last));
  if (REC.paused) { cam.t0 += dt; cam.last = time; return; }
  const t = time - cam.t0;
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

// ---------- 鏡頭:濾波器(手動運鏡 / 路徑導覽) ----------

// 一步濾波:指數平滑朝目標走,再把平移(螢幕寬/秒)與縮放(ln/秒)限在上限內。ratio = 想走的速度 / 上限(>1 表示被限速)
function recFilterStep(cur, tgt, dt, speed, k) {
  const f = 1 - Math.exp(-k * dt);
  const maxZ = speed * REC_ZOOM_PER_PAN * dt;
  let dz = Math.log(tgt.zoom / cur.zoom) * f;
  const rz = maxZ > 0 ? Math.abs(dz) / maxZ : 0;
  if (Math.abs(dz) > maxZ) dz = dz > 0 ? maxZ : -maxZ;
  const nz = cur.zoom * Math.exp(dz);
  const maxP = speed * viewport.w / nz * dt;
  let dx = (tgt.x - cur.x) * f, dy = (tgt.y - cur.y) * f;
  const d = Math.hypot(dx, dy);
  const rp = maxP > 0 ? d / maxP : 0;
  if (d > maxP && d > 0) { dx *= maxP / d; dy *= maxP / d; }
  return { x: cur.x + dx, y: cur.y + dy, zoom: nz, ratio: Math.max(rp, rz) };
}

function recClampTgt(t) {
  const sx = view.x, sy = view.y, sz = view.zoom;
  t.zoom = recClamp(t.zoom, zoomMin, ZOOM_MAX);
  view.x = t.x; view.y = t.y; view.zoom = t.zoom;
  clampView();
  t.x = view.x; t.y = view.y;
  view.x = sx; view.y = sy; view.zoom = sz;
}

// 目標離實際鏡頭太遠(猛甩)時拉回,放手後不會繼續滑很久
function recLimitBacklog(cam) {
  const t = cam.tgt;
  const bw = REC_BACKLOG * viewport.w / view.zoom;
  const dd = Math.hypot(t.x - view.x, t.y - view.y);
  if (dd > bw && dd > 0) {
    t.x = view.x + (t.x - view.x) * bw / dd;
    t.y = view.y + (t.y - view.y) * bw / dd;
  }
  const dz = Math.log(t.zoom / view.zoom);
  if (Math.abs(dz) > REC_BACKLOG) t.zoom = view.zoom * Math.exp(dz > 0 ? REC_BACKLOG : -REC_BACKLOG);
}

function recManualTick(time) {
  const cam = REC.cam;
  if (cam.last === null) { cam.last = time; return; }
  const dt = Math.min(0.1, Math.max(0, time - cam.last));
  cam.last = time;
  if (dt <= 0) return;
  if (Math.abs(view.x - cam.ax) > 0.5 || Math.abs(view.y - cam.ay) > 0.5 || Math.abs(view.zoom - cam.az) > 1e-4) {
    cam.tgt = { x: view.x, y: view.y, zoom: view.zoom };
    if (cam.tour) cam.tour = null;
  }
  if (cam.tour && !cam.tour.done) recTourStep(cam, dt);
  else recLimitBacklog(cam);
  const r = recFilterStep(view, cam.tgt, dt, recSpeed(), recSmoothK());
  view.x = r.x; view.y = r.y; view.zoom = r.zoom;
  clampView();
  cam.ax = view.x; cam.ay = view.y; cam.az = view.zoom;
  if (!REC.paused) {
    cam.frames++;
    cam.ratio = r.ratio;
    if (r.ratio > 1) cam.over += dt;
    if (r.ratio > cam.maxRatio) cam.maxRatio = r.ratio;
  }
  cam.disp = Math.max(r.ratio, cam.disp * Math.exp(-4 * dt));
  recUpdateSpeedBar(cam.disp);
  if (cam.tour && cam.tour.done && !cam.tour.fin) {
    cam.tour.fin = true;
    recUpdateTourBtn();
    if (REC.opts.tourStop) recStop();
  }
}

function recCamTick(time) {
  const cam = REC.cam;
  if (REC.state !== 'recording' || !cam) return;
  if (cam.mode === 'manual') recManualTick(time);
  else recAutoTick(time);
}

// 乾淨地圖:錄影相關狀態下隱藏放置預覽(游標高亮)
function recCleanActive() {
  const s = REC.state;
  return !!REC.opts.clean && (s === 'recording' || s === 'countdown' || s === 'plan');
}

function recCleanTick() {
  if (recCleanActive() && typeof preview === 'object' && preview) preview.visible = false;
}

// ---------- 路點 ----------

function recWayClean(list) {
  const out = [];
  if (!Array.isArray(list)) return out;
  for (let i = 0; i < list.length && out.length < REC_WAY_MAX; i++) {
    const w = list[i];
    if (!w || !isFinite(w.x) || !isFinite(w.y) || !isFinite(w.zoom) || w.zoom <= 0) continue;
    const hold = isFinite(w.hold) ? recClamp(w.hold, 0, 30) : 2;
    out.push({ x: Number(w.x), y: Number(w.y), zoom: Number(w.zoom), hold: hold });
  }
  return out;
}

function recWayLoad() {
  try {
    if (typeof localStorage === 'undefined' || !localStorage) return [];
    const raw = localStorage.getItem(REC_WAY_KEY);
    return raw ? recWayClean(JSON.parse(raw)) : [];
  } catch (e) {
    console.warn('[rec] waypoints load failed', e);
    return [];
  }
}

function recWaySave() {
  try {
    if (typeof localStorage === 'undefined' || !localStorage) return;
    localStorage.setItem(REC_WAY_KEY, JSON.stringify(REC.way));
  } catch (e) {
    console.warn('[rec] waypoints save failed', e);
  }
}

function recWayChanged() {
  recWaySave();
  if (REC.ui) {
    recRenderWay();
    recUpdateMarkBtns();
    recRenderHint();
  }
}

function recMarkHere() {
  const R = REC;
  if (R.way.length >= REC_WAY_MAX) { recSetMsg('路點最多 ' + REC_WAY_MAX + ' 個'); return false; }
  R.way.push({ x: Math.round(view.x * 10) / 10, y: Math.round(view.y * 10) / 10, zoom: Math.round(view.zoom * 1000) / 1000, hold: R.opts.hold });
  recWayChanged();
  return true;
}

function recWayRemove(i) {
  if (i < 0 || i >= REC.way.length) return;
  REC.way.splice(i, 1);
  recWayChanged();
}

function recWayMove(i, dir) {
  const j = i + dir;
  if (i < 0 || j < 0 || i >= REC.way.length || j >= REC.way.length) return;
  const t = REC.way[i];
  REC.way[i] = REC.way[j];
  REC.way[j] = t;
  recWayChanged();
}

function recWayHold(i, delta) {
  const w = REC.way[i];
  if (!w) return;
  w.hold = recClamp(w.hold + delta, 0, 30);
  recWayChanged();
}

function recWayClear() {
  REC.way = [];
  recWayChanged();
}

// 全城一覽:依物件包圍盒產生「遠景 → 城主府 → 各象限 → 遠景」幾個關鍵點
function recOverviewPoints() {
  const pts = [];
  const objs = world.objects || [];
  objs.forEach(function (o) {
    const h = world.height ? (world.height[idx(o.x, o.y)] || 0) : 0;
    pts.push({ x: isoX(o.x + 0.5, o.y + 0.5), y: isoY(o.x + 0.5, o.y + 0.5, h), palace: o.type === 'palace' });
  });
  if (!pts.length) {
    pts.push({ x: isoX(0, boardH()), y: isoY(0, 0, 0) }, { x: isoX(boardW(), 0), y: isoY(boardW(), boardH(), 0) });
  }
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  pts.forEach(function (p) {
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
  });
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  const bw = maxX - minX + TW * 4, bh = maxY - minY + TH * 8;
  const zFit = recClamp(Math.min(viewport.w / bw, viewport.h / bh), zoomMin, ZOOM_MAX);
  const zNear = recClamp(Math.max(zFit * 2, 0.8), zFit, REC_ZOOM_HI);
  const r1 = function (v) { return Math.round(v * 10) / 10; };
  const r3 = function (v) { return Math.round(v * 1000) / 1000; };
  const far = { x: r1(cx), y: r1(cy), zoom: r3(zFit), hold: 2 };
  const out = [far];
  const palace = pts.find(function (p) { return p.palace; });
  if (palace) out.push({ x: r1(palace.x), y: r1(palace.y), zoom: r3(recClamp(1.1, zFit, ZOOM_MAX)), hold: 3 });
  const quads = [[], [], [], []];
  pts.forEach(function (p) {
    if (p.palace) return;
    quads[(p.x < cx ? 0 : 1) + (p.y < cy ? 0 : 2)].push(p);
  });
  [0, 1, 3, 2].forEach(function (q) {
    const list = quads[q];
    if (!list.length) return;
    let sx = 0, sy = 0;
    list.forEach(function (p) { sx += p.x; sy += p.y; });
    out.push({ x: r1(sx / list.length), y: r1(sy / list.length), zoom: r3(zNear), hold: 3 });
  });
  out.push({ x: far.x, y: far.y, zoom: far.zoom, hold: 2 });
  return recWayClean(out);
}

function recWayOverview() {
  REC.way = recOverviewPoints();
  recWayChanged();
}

// ---------- 路徑導覽 ----------

// 一段飛行秒數:平移、縮放各算下限,取較大者(至少 0.8 秒)再乘緩入緩出係數,讓峰值速度也不超過運鏡速度
function recSegDur(a, b, speed) {
  const dist = Math.hypot(b.x - a.x, b.y - a.y);
  const zm = Math.sqrt(a.zoom * b.zoom);
  const tp = dist / Math.max(1e-6, speed * viewport.w / zm);
  const tz = Math.abs(Math.log(b.zoom / a.zoom)) / Math.max(1e-6, speed * REC_ZOOM_PER_PAN);
  return Math.max(0.8, tp, tz) * REC_TOUR_EASE;
}

// 導覽總秒數估計(含停留);withStart 為起點(省略則從第一個路點起算)
function recTourTotal(way, speed, start) {
  let total = 0;
  let prev = start || null;
  for (let i = 0; i < way.length; i++) {
    if (prev) total += recSegDur(prev, way[i], speed);
    total += way[i].hold;
    prev = way[i];
  }
  return total;
}

function recCatmull(p0, p1, p2, p3, t) {
  const t2 = t * t, t3 = t2 * t;
  return 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}

function recTourPoint(tour, e) {
  const pts = tour.pts, i = tour.seg, n = pts.length;
  const p0 = pts[Math.max(i - 1, 0)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(i + 2, n - 1)];
  return {
    x: recCatmull(p0.x, p1.x, p2.x, p3.x, e),
    y: recCatmull(p0.y, p1.y, p2.y, p3.y, e),
    zoom: Math.exp(recCatmull(Math.log(p0.zoom), Math.log(p1.zoom), Math.log(p2.zoom), Math.log(p3.zoom), e))
  };
}

function recTourStart() {
  const cam = REC.cam;
  if (!cam || cam.mode !== 'manual' || !REC.way.length) return false;
  const pts = [{ x: view.x, y: view.y, zoom: view.zoom, hold: 0 }];
  REC.way.forEach(function (w) { pts.push({ x: w.x, y: w.y, zoom: recClamp(w.zoom, zoomMin, ZOOM_MAX), hold: w.hold }); });
  const speed = recSpeed();
  const p0 = pts[0], p1 = pts[1];
  let tour;
  if (Math.hypot(p1.x - p0.x, p1.y - p0.y) < 2 && Math.abs(Math.log(p1.zoom / p0.zoom)) < 0.01) {
    // 起點就在第一個路點:略過零長度的飛行段(Catmull-Rom 會先反向凹一下),直接從該點停留開始
    pts.shift();
    tour = { pts: pts, seg: 0, phase: 'hold', t: 0, dur: 0, done: false, fin: false };
  } else {
    tour = { pts: pts, seg: 0, phase: 'fly', t: 0, dur: recSegDur(p0, p1, speed), done: false, fin: false };
  }
  cam.tour = tour;
  recUpdateTourBtn();
  return true;
}

function recTourStop() {
  const cam = REC.cam;
  if (!cam || !cam.tour) return;
  cam.tour = null;
  cam.tgt = { x: view.x, y: view.y, zoom: view.zoom };
  recUpdateTourBtn();
}

function recTourStep(cam, dt) {
  const tour = cam.tour;
  const pts = tour.pts;
  tour.t += dt;
  if (tour.phase === 'hold') {
    if (tour.t >= pts[tour.seg].hold) {
      if (tour.seg >= pts.length - 1) { tour.done = true; return; }
      tour.phase = 'fly';
      tour.t = 0;
      tour.dur = recSegDur(pts[tour.seg], pts[tour.seg + 1], recSpeed());
    }
    return;
  }
  const u = Math.min(1, tour.t / tour.dur);
  const e = u * u * (3 - 2 * u);
  const p = recTourPoint(tour, e);
  cam.tgt = { x: p.x, y: p.y, zoom: p.zoom };
  recClampTgt(cam.tgt);
  if (u >= 1) {
    tour.seg++;
    tour.phase = 'hold';
    tour.t = 0;
    if (pts[tour.seg].hold <= 0 && tour.seg >= pts.length - 1) tour.done = true;
  }
}

function recToggleTour() {
  const cam = REC.cam;
  if (REC.state !== 'recording' || !cam || cam.mode !== 'manual') return;
  if (cam.tour && !cam.tour.done) recTourStop();
  else if (!recTourStart()) recSetMsg('還沒有路點');
}

// ---------- 手勢(手動運鏡 / 路徑設定 / 倒數期間) ----------

function recManualActive() {
  return REC.state === 'recording' && !!REC.cam && REC.cam.mode === 'manual';
}

function recGestureOn() {
  const s = REC.state;
  return s === 'plan' || s === 'countdown' || recManualActive();
}

function recPan(dx, dy) {
  if (recManualActive()) {
    recTourStop();
    const t = REC.cam.tgt;
    t.x -= dx / t.zoom;
    t.y -= dy / t.zoom;
    recClampTgt(t);
  } else {
    panBy(dx, dy);
  }
}

function recZoom(sx, sy, f) {
  if (recManualActive()) {
    recTourStop();
    const t = REC.cam.tgt;
    const wx = (sx - viewport.w / 2) / t.zoom + t.x;
    const wy = (sy - viewport.h / 2) / t.zoom + t.y;
    t.zoom = recClamp(t.zoom * f, zoomMin, ZOOM_MAX);
    t.x = wx - (sx - viewport.w / 2) / t.zoom;
    t.y = wy - (sy - viewport.h / 2) / t.zoom;
    recClampTgt(t);
  } else {
    zoomAt(sx, sy, f);
  }
}

function recGsReset() {
  recGs.ptrs = {};
  recGs.n = 0;
  recGs.pinch = null;
}

function recPinchState() {
  const ids = Object.keys(recGs.ptrs);
  const a = recGs.ptrs[ids[0]], b = recGs.ptrs[ids[1]];
  return { dist: Math.hypot(a.x - b.x, a.y - b.y) || 1, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
}

function recSwallow(e) {
  if (e.stopImmediatePropagation) e.stopImmediatePropagation();
  if (e.stopPropagation) e.stopPropagation();
  if (e.preventDefault) e.preventDefault();
}

function recPtrDown(e) {
  if (!recGestureOn() || !e || !e.target || e.target.id !== 'game') return;
  recSwallow(e);
  if (!recGs.ptrs[e.pointerId]) recGs.n++;
  recGs.ptrs[e.pointerId] = { x: e.clientX, y: e.clientY };
  recGs.pinch = recGs.n >= 2 ? recPinchState() : null;
}

function recPtrMove(e) {
  if (!e || !recGs.ptrs[e.pointerId]) return;
  if (!recGestureOn()) { recGsReset(); return; }
  recSwallow(e);
  const p = recGs.ptrs[e.pointerId];
  const dx = e.clientX - p.x, dy = e.clientY - p.y;
  p.x = e.clientX;
  p.y = e.clientY;
  if (recGs.n >= 2 && recGs.pinch) {
    const s = recPinchState();
    recZoom(s.mx, s.my, s.dist / recGs.pinch.dist);
    recPan(s.mx - recGs.pinch.mx, s.my - recGs.pinch.my);
    recGs.pinch = s;
  } else if (recGs.n === 1) {
    recPan(dx, dy);
  }
}

function recPtrUp(e) {
  if (!e || !recGs.ptrs[e.pointerId]) return;
  recSwallow(e);
  delete recGs.ptrs[e.pointerId];
  recGs.n = Math.max(0, recGs.n - 1);
  recGs.pinch = recGs.n >= 2 ? recPinchState() : null;
}

function recWheel(e) {
  if (!recGestureOn() || !e || !e.target || e.target.id !== 'game') return;
  recSwallow(e);
  recZoom(e.clientX, e.clientY, e.deltaY < 0 ? 1.1 : 1 / 1.1);
}

// ---------- 取景複製 / 時間戳 ----------

function recDrawStamp(c, w, h) {
  const R = REC;
  const el = Math.floor(recElapsed());
  const text = recFmt(el);
  const fs = Math.max(12, Math.round(h * 0.035));
  c.save();
  c.font = 'bold ' + fs + 'px sans-serif';
  c.textAlign = 'right';
  c.textBaseline = 'bottom';
  c.lineWidth = Math.max(2, fs * 0.15);
  c.strokeStyle = 'rgba(0,0,0,0.7)';
  c.fillStyle = '#ffffff';
  c.strokeText(text, w - fs * 0.6, h - fs * 0.5);
  c.fillText(text, w - fs * 0.6, h - fs * 0.5);
  c.restore();
  void R;
}

function recCopyFrame() {
  const R = REC, c = R.copy;
  if (!c || R.state !== 'recording' || R.paused) return;
  const src = document.getElementById('game');
  if (!src) return;
  const k = src.width / Math.max(1, viewport.w);
  const crop = recCropRect(viewport.w, viewport.h, R.opts.aspect);
  try {
    c.ctx.drawImage(src, crop.x * k, crop.y * k, crop.w * k, crop.h * k, 0, 0, c.canvas.width, c.canvas.height);
    if (R.opts.stamp) recDrawStamp(c.ctx, c.canvas.width, c.canvas.height);
  } catch (e) {
    console.warn('[rec] copy failed', e);
  }
}

// ---------- 介面顯示 ----------

function recShowRoot(mode) {
  const root = REC.ui && REC.ui.root;
  if (!root) return;
  ['rec-show-panel', 'rec-show-hud', 'rec-show-review', 'rec-show-plan', 'rec-show-count', 'rec-pass'].forEach(function (c) { root.classList.remove(c); });
  if (mode === 'none') { root.classList.remove('rec-on'); recUpdateFrame(false); return; }
  root.classList.add('rec-on');
  root.classList.add('rec-show-' + mode);
  if (mode === 'plan' || mode === 'count' || (mode === 'hud' && REC.cam && REC.cam.mode === 'manual')) root.classList.add('rec-pass');
  recUpdateFrame(mode === 'plan' || mode === 'count' || mode === 'hud');
}

function recUpdateFrame(show) {
  const f = REC.ui && REC.ui.frame;
  if (!f) return;
  const asp = REC.opts.aspect;
  if (!show || REC.opts.camOnly || !asp || asp === 'auto') { f.classList.remove('on'); return; }
  const c = recCropRect(viewport.w, viewport.h, asp);
  recSetStyle(f, 'left', Math.round(c.x) + 'px');
  recSetStyle(f, 'top', Math.round(c.y) + 'px');
  recSetStyle(f, 'width', Math.round(c.w) + 'px');
  recSetStyle(f, 'height', Math.round(c.h) + 'px');
  f.classList.add('on');
}

function recSetMsg(text) {
  if (REC.ui) REC.ui.msg.textContent = text || '';
}

function recSetHudOff(off) {
  if (!REC.ui) return;
  if (off) REC.ui.hud.classList.add('off');
  else REC.ui.hud.classList.remove('off');
}

function recElapsed() {
  const R = REC;
  const now = R.paused ? R.pauseAt : recNowMs();
  return Math.max(0, (now - R.startMs - R.pausedMs) / 1000);
}

function recHudTick() {
  const R = REC;
  if (!R.ui || R.state !== 'recording') return;
  const el = recElapsed();
  if (R.camOnlyRun) {
    R.ui.time.textContent = recFmt(Math.floor(el));
    R.ui.left.textContent = '運鏡中';
    return;
  }
  const sec = R.opts.len > 0 ? Math.max(0, Math.ceil(R.opts.len - el)) : Math.floor(el);
  R.ui.time.textContent = recFmt(sec);
  const total = R.limitMs / 1000;
  R.ui.left.textContent = R.paused ? '已暫停' : (R.opts.len > 0 ? '/ ' + recFmt(Math.round(total)) : '剩 ' + recFmt(Math.max(0, Math.ceil(total - el))));
}

function recUpdateSpeedBar(ratio) {
  const u = REC.ui;
  if (!u) return;
  const pct = Math.round(recClamp(ratio, 0, 1) * 100);
  if (pct !== REC.spdPct) {
    REC.spdPct = pct;
    recSetStyle(u.spdFill, 'width', pct + '%');
  }
  const hot = ratio > 1;
  recToggle(u.spd, hot, 'hot');
  u.spdTxt.textContent = hot ? '手別滑太快' : '';
}

function recUpdateTourBtn() {
  const u = REC.ui;
  if (!u) return;
  const cam = REC.cam;
  recToggle(u.tourBtn, !!(cam && cam.tour && !cam.tour.done));
}

function recUpdateMarkBtns() {
  const u = REC.ui;
  if (!u) return;
  const n = REC.way.length;
  u.markBtn.textContent = '📍' + n;
  u.planCount.textContent = '路點 ' + n;
}

// 取得聲音軌:AU 不存在或分流失敗回傳 null(改為只錄畫面)
function recTapAudio() {
  if (typeof AU !== 'object' || !AU || typeof AU.recordTap !== 'function') return null;
  const s = AU.recordTap();
  if (!s || !s.getAudioTracks) return null;
  const list = s.getAudioTracks();
  return list && list.length ? list[0] : null;
}

// ---------- 開始 / 倒數 / 暫停 / 停止 ----------

function recMakeCam(mode) {
  if (mode === 'auto') return { mode: 'auto', center: recOrbitCenter(), t0: null, last: null };
  if (mode === 'manual' || mode === 'tour') {
    return {
      mode: 'manual', tgt: { x: view.x, y: view.y, zoom: view.zoom }, last: null,
      ax: view.x, ay: view.y, az: view.zoom, tour: null,
      frames: 0, over: 0, maxRatio: 0, ratio: 0, disp: 0
    };
  }
  return null;
}

// 進入拍攝畫面(隱藏 UI、套解析度、記下鏡頭);失敗要用 recUnprepare 還原
function recPrepare() {
  const R = REC;
  R.plan = recEstimate(R.opts);
  R.saved = { x: view.x, y: view.y, zoom: view.zoom };
  R.cam = recMakeCam(recCamMode());
  R.note = '';
  R.spdPct = -1;
  if (!R.opts.camOnly) recApplyRes(R.plan.quality);
  document.body.classList.add('shooting'); if (typeof updateZoomMin === 'function') updateZoomMin(true);
}

function recUnprepare() {
  const R = REC;
  resizeCanvas(document.getElementById('game'));
  if (R.saved) {
    view.x = R.saved.x;
    view.y = R.saved.y;
    view.zoom = R.saved.zoom;
    clampView();
  }
  R.saved = null;
  R.cam = null;
  R.copy = null;
  recGsReset();
  document.body.classList.remove('shooting');
}

function recStart() {
  const R = REC;
  if (R.state !== 'idle') return;
  const err = recModeError();
  if (err) { recSetMsg(err); return; }
  if (!R.mime && !R.opts.camOnly) { recSetMsg('此瀏覽器不支援遊戲內錄影,請改選「運鏡模式」'); return; }
  if (recCamMode() === 'tour' && !R.way.length) { recSetMsg('路徑導覽需要先標記路點,或按「全城一覽」自動產生'); return; }
  if (typeof AU === 'object' && AU && AU.unlock) AU.unlock();
  recPrepare();
  if (R.opts.countdown > 0) {
    R.state = 'countdown';
    R.cd = R.opts.countdown;
    R.ui.count.textContent = String(R.cd);
    recShowRoot('count');
    R.cdTimer = setInterval(recCountTick, 1000);
    return;
  }
  recGo();
}

function recCountTick() {
  const R = REC;
  if (R.state !== 'countdown') return;
  R.cd--;
  if (R.cd > 0) { R.ui.count.textContent = String(R.cd); return; }
  clearInterval(R.cdTimer);
  R.cdTimer = 0;
  recGo();
}

function recCancelCount() {
  const R = REC;
  if (R.state !== 'countdown') return;
  if (R.cdTimer) clearInterval(R.cdTimer);
  R.cdTimer = 0;
  R.state = 'idle';
  recUnprepare();
  recRenderPanel();
  recShowRoot('panel');
}

function recFailStart(text) {
  const R = REC;
  R.state = 'idle';
  recUnprepare();
  recRenderPanel();
  recShowRoot('panel');
  recSetMsg(text);
}

// 建立 MediaRecorder:先帶位元率,失敗再退回只帶 mimeType
function recMakeRecorder(stream) {
  const R = REC;
  const base = { mimeType: R.mime };
  try {
    const o = { mimeType: R.mime, videoBitsPerSecond: R.plan.bitrate };
    if (R.opts.sound) o.audioBitsPerSecond = REC_AUDIO_BPS;
    return new MediaRecorder(stream, o);
  } catch (e) {
    return new MediaRecorder(stream, base);
  }
}

// 進入錄影/運鏡狀態的共同尾段(hud、鏡頭、計時顯示)
function recEnterRun(camOnly) {
  const R = REC;
  R.camOnlyRun = camOnly;
  R.startMs = recNowMs();
  R.graceUntil = R.startMs + REC_GRACE_MS;
  R.paused = false;
  R.pausedMs = 0;
  R.pauseAt = 0;
  R.state = 'recording';
  R.hudTimer = setInterval(recHudTick, 250);
  const manual = !!(R.cam && R.cam.mode === 'manual');
  recToggle(R.ui.hud, manual, 'rec-m');
  recToggle(R.ui.hud, camOnly, 'rec-co');
  R.ui.stopBtn.textContent = camOnly ? '⏹ 結束運鏡' : '⏹';
  R.ui.pauseBtn.textContent = '⏸';
  recSetStyle(R.ui.pauseBtn, 'display', R.canPause ? '' : 'none');
  if (manual) {
    R.cam.tgt = { x: view.x, y: view.y, zoom: view.zoom };
    R.cam.ax = view.x; R.cam.ay = view.y; R.cam.az = view.zoom;
    if (recCamMode() === 'tour') recTourStart();
  }
  recUpdateTourBtn();
  recUpdateMarkBtns();
  recUpdateSpeedBar(0);
  recSetHudOff(!R.opts.hud);
  document.body.classList.add('shooting'); if (typeof updateZoomMin === 'function') updateZoomMin(true);
  recShowRoot('hud');
  recHudTick();
}

// 運鏡模式:不建立 MediaRecorder,不設時間上限,交給系統螢幕錄影
function recGoCam() {
  const R = REC;
  R.recorder = null;
  R.chunks = [];
  R.tracks = [];
  R.tapped = false;
  R.canPause = false;
  R.bytes = 0;
  R.copy = null;
  R.limitMs = 0;
  recEnterRun(true);
}

function recGo() {
  const R = REC;
  if (R.opts.camOnly) { recGoCam(); return; }
  const canvas = document.getElementById('game');
  let src = canvas;
  R.copy = null;
  if (R.opts.aspect !== 'auto' || R.opts.stamp) {
    let cc = null, c2 = null;
    try {
      cc = document.createElement('canvas');
      c2 = cc.getContext ? cc.getContext('2d') : null;
    } catch (e) { c2 = null; }
    if (c2) {
      cc.width = R.plan.w;
      cc.height = R.plan.h;
      if (typeof cc.captureStream === 'function') { R.copy = { canvas: cc, ctx: c2 }; src = cc; }
    }
    if (!R.copy && R.opts.aspect !== 'auto') { recFailStart('此瀏覽器無法錄固定比例,請改用「依視窗」'); return; }
  }
  let canvasStream = null;
  try { canvasStream = src.captureStream(R.plan.fps); } catch (e) { console.warn('[rec] captureStream failed', e); }
  if (!canvasStream) { recFailStart('此瀏覽器不支援錄影'); return; }

  const tracks = canvasStream.getVideoTracks().slice();
  let tapped = false;
  if (R.opts.sound) {
    const at = recTapAudio();
    if (at) { tracks.push(at); tapped = true; }
    else showToast('無法錄到聲音,改為只錄畫面');
  }

  let rec = null;
  try {
    rec = recMakeRecorder(new MediaStream(tracks));
    rec.start(1000);
  } catch (e) {
    console.warn('[rec] start failed', e);
    if (tapped) AU.recordUntap();
    recFailStart('錄影啟動失敗,請再試一次');
    return;
  }

  R.tracks = tracks;
  R.tapped = tapped;
  R.chunks = [];
  R.bytes = 0;
  R.recorder = rec;
  R.canPause = typeof rec.pause === 'function' && typeof rec.resume === 'function';
  rec.ondataavailable = function (e) {
    if (!e || !e.data || e.data.size <= 0) return;
    R.chunks.push(e.data);
    R.bytes += e.data.size;
    if (R.bytes > REC_HARD_BYTES && R.state === 'recording') {
      R.note = '檔案已達記憶體保護上限,自動結束錄影';
      recStop();
    }
  };
  rec.onstop = recFinish;
  rec.onerror = function (e) { console.warn('[rec] error', e); recStop(); };

  R.limitMs = recLenMs(R.opts.len);
  recEnterRun(false);
  R.timer = setTimeout(recStop, R.limitMs);
}

function recPause() {
  const R = REC;
  if (R.state !== 'recording' || R.paused || !R.canPause || !R.recorder) return false;
  try { R.recorder.pause(); } catch (e) { console.warn('[rec] pause failed', e); return false; }
  R.paused = true;
  R.pauseAt = recNowMs();
  if (R.timer) clearTimeout(R.timer);
  R.timer = 0;
  R.ui.pauseBtn.textContent = '▶';
  recHudTick();
  return true;
}

function recResume() {
  const R = REC;
  if (R.state !== 'recording' || !R.paused || !R.recorder) return false;
  try { R.recorder.resume(); } catch (e) { console.warn('[rec] resume failed', e); return false; }
  const now = recNowMs();
  R.pausedMs += now - R.pauseAt;
  R.paused = false;
  R.graceUntil = now + REC_GRACE_MS;
  const left = Math.max(0, R.limitMs - (now - R.startMs - R.pausedMs));
  R.timer = setTimeout(recStop, left);
  R.ui.pauseBtn.textContent = '⏸';
  recHudTick();
  return true;
}

function recTogglePause() {
  if (REC.paused) recResume();
  else recPause();
}

// 結束錄製:停止 MediaRecorder,實際收尾在 recFinish(onstop)。保險計時避免 onstop 沒來時卡在 stopping
function recStop() {
  const R = REC;
  if (R.state === 'countdown') { recCancelCount(); return; }
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

// 錄後穩定化提示:手動運鏡被限速的秒數
function recReviewText() {
  const R = REC;
  const parts = [];
  if (R.note) parts.push(R.note);
  if (R.plan && R.plan.downgraded) parts.push('為控制檔案大小,已自動降為標準畫質。');
  if (R.plan && R.plan.capped) parts.push('時間較長,位元率已下調以控制在 150 MB 內。');
  const st = R.stats;
  if (st) {
    if (st.over >= 1) parts.push('運鏡有約 ' + Math.round(st.over) + ' 秒手勢過快、被限速壓住,畫面可能有拖尾感;下次手勢放慢,或把運鏡速度調慢。');
    else if (st.frames > 0) parts.push('運鏡平穩,沒有被限速。');
  }
  return parts.join(' ');
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
  R.stats = R.cam && R.cam.mode === 'manual' ? { frames: R.cam.frames, over: R.cam.over, maxRatio: R.cam.maxRatio } : null;
  R.paused = false;
  R.recorder = null;
  recUnprepare();

  if (R.camOnlyRun) {
    R.camOnlyRun = false;
    R.state = 'idle';
    recRenderPanel();
    recShowRoot('panel');
    recSetMsg('運鏡已結束。' + recReviewText());
    return;
  }
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
  R.ui.rmsg.textContent = recReviewText();
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

// ---------- 路點設定模式(錄影前,移動畫面標記路點) ----------

function recPlanOpen() {
  const R = REC;
  if (R.state !== 'idle') return;
  const err = recModeError();
  if (err) { recSetMsg(err); return; }
  R.saved = { x: view.x, y: view.y, zoom: view.zoom };
  R.state = 'plan';
  document.body.classList.add('shooting'); if (typeof updateZoomMin === 'function') updateZoomMin(true);
  recUpdateMarkBtns();
  recShowRoot('plan');
}

function recPlanDone() {
  const R = REC;
  if (R.state !== 'plan') return;
  R.state = 'idle';
  recGsReset();
  if (R.saved) {
    view.x = R.saved.x;
    view.y = R.saved.y;
    view.zoom = R.saved.zoom;
    clampView();
  }
  R.saved = null;
  document.body.classList.remove('shooting');
  recRenderPanel();
  recShowRoot('panel');
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
      p.catch(function (e) {
        if (e && e.name === 'AbortError') return;
        recSaveNote('分享表開啟失敗,已改用下載連結' + (recIsIOS() ? '(主畫面 App 下可能無效,請改用系統螢幕錄影)' : ''));
        recDownload(name);
      });
      return;
    }
    if (p) return;
  }
  if (recIsIOS()) recSaveNote('此環境無法開啟系統分享表,改用下載連結;iPhone 主畫面 App 下下載常常無效,建議改用「運鏡模式」+ 系統螢幕錄影。');
  recDownload(name);
}

function recSaveNote(text) {
  if (REC.ui) REC.ui.rmsg.textContent = text;
}

function recOnTap(e) {
  if (e && e.stopPropagation) e.stopPropagation();
  if (REC.state !== 'recording') return;
  if (recNowMs() < REC.graceUntil) return;
  recStop();
}

function recOnResize() {
  if ((REC.state === 'recording' || REC.state === 'countdown') && !REC.opts.camOnly) recApplyRes(REC.plan ? REC.plan.quality : REC.opts.quality);
  if (REC.state === 'recording' || REC.state === 'countdown' || REC.state === 'plan') recUpdateFrame(true);
}

function recOnVisibility() {
  if (typeof document !== 'undefined' && document.hidden) {
    if (REC.state === 'recording' && !REC.camOnlyRun) REC.note = '錄影中切到背景,已自動結束(手機請勿在錄影中切換 App)';
    recStop();
  }
}

// ---------- 面板 UI ----------

function recEl(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

function recToggle(el, on, cls) {
  const c = cls || 'on';
  if (on) el.classList.add(c);
  else el.classList.remove(c);
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

// 開關按鈕:點擊切換 REC.opts[key]
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

function recClearKids(el) {
  while (el.children.length) el.removeChild(el.children[el.children.length - 1]);
}

function recSmallBtn(text, label, fn) {
  const b = recEl('button', 'rec-mini', text);
  b.setAttribute('aria-label', label);
  b.addEventListener('click', fn);
  return b;
}

function recRenderWay() {
  const box = REC.ui && REC.ui.wayList;
  if (!box) return;
  recClearKids(box);
  if (!REC.way.length) {
    box.appendChild(recEl('p', 'rec-hint', '還沒有路點。按「標記路點」到畫面上移動並標記,或按「全城一覽」自動產生。'));
    return;
  }
  REC.way.forEach(function (w, i) {
    const row = recEl('div', 'rec-wp');
    row.appendChild(recEl('span', 'rec-wp-t', (i + 1) + '. 縮放 ' + w.zoom.toFixed(2) + ' · 停 ' + w.hold + ' 秒'));
    const btns = recEl('span', 'rec-wp-b');
    btns.appendChild(recSmallBtn('−', '停留減 1 秒', function () { recWayHold(i, -1); }));
    btns.appendChild(recSmallBtn('+', '停留加 1 秒', function () { recWayHold(i, 1); }));
    btns.appendChild(recSmallBtn('▲', '上移', function () { recWayMove(i, -1); }));
    btns.appendChild(recSmallBtn('▼', '下移', function () { recWayMove(i, 1); }));
    btns.appendChild(recSmallBtn('🗑', '刪除路點', function () { recWayRemove(i); }));
    row.appendChild(btns);
    box.appendChild(row);
  });
}

// 規格說明:輸出尺寸、幀率、位元率、預估大小;導覽時間
function recRenderHint() {
  const R = REC;
  if (!R.ui) return;
  const e = recEstimate(R.opts);
  let t = '輸出 ' + e.w + '×' + e.h + ' · ' + e.fps + ' fps · 約 ' + (e.bitrate / 1e6).toFixed(1) + ' Mbps · 預估 ' + (e.mb < 10 ? e.mb.toFixed(1) : Math.round(e.mb)) + ' MB';
  if (e.downgraded) t += '(超過 150 MB,已自動降為標準畫質)';
  else if (e.capped) t += '(時間長,位元率已下調以控制在 150 MB 內)';
  R.ui.specHint.textContent = t;
  const mode = recCamMode();
  let tour = '';
  if (mode === 'tour' || mode === 'manual') {
    const sp = recSpeed();
    tour = '運鏡速度約每秒 ' + sp.toFixed(2) + ' 個螢幕寬。';
    if (R.way.length) {
      const total = Math.round(recTourTotal(R.way, sp, null));
      tour += '路徑導覽約 ' + total + ' 秒';
      if (R.opts.len > 0 && total > R.opts.len) tour += ',比錄影長度長,會被截斷,建議加長錄影長度';
      tour += '。';
    }
  }
  R.ui.tourHint.textContent = tour;
  let warn = '';
  if (!R.mime) warn = recUnsupportedText();
  else if (recIsIOS()) warn = recIosText();
  R.ui.warn.textContent = warn;
}

function recRenderPanel() {
  const R = REC;
  if (!R.ui) return;
  const o = R.opts, u = R.ui;
  const mode = recCamMode();
  recSegSet(u.segMode, o.camOnly ? 'cam' : 'game');
  recToggle(u.gameBox, !!o.camOnly, 'rec-hide');
  recSegSet(u.segLen, o.len);
  recSegSet(u.segQual, o.quality);
  recSegSet(u.segCam, mode);
  recSegSet(u.segSpeed, o.speed);
  recSegSet(u.segSmooth, o.smooth);
  recSegSet(u.segAspect, o.aspect);
  recSegSet(u.segFps, o.fps);
  recSegSet(u.segCd, o.countdown);
  recSegSet(u.segHold, o.hold);
  recSwSet(u.swSound, o.sound);
  recSwSet(u.swHud, o.hud);
  recSwSet(u.swClean, o.clean);
  recSwSet(u.swStamp, o.stamp);
  recSwSet(u.swTourStop, o.tourStop);
  if (recIsIOS()) {
    u.segLen.items.forEach(function (it) { recToggle(it.el, recMaxMs() < (it.key > 0 ? it.key * 1000 : 0), 'rec-dis'); });
  }
  const moving = mode === 'manual' || mode === 'tour';
  recToggle(u.camBox, !moving, 'rec-hide');
  recToggle(u.customRow, moving && o.speed === 'custom' ? false : true, 'rec-hide');
  u.customVal.textContent = recSpeed().toFixed(2);
  if (u.customRange.value !== String(o.speedCustom)) u.customRange.value = String(o.speedCustom);
  recToggle(u.start, !R.mime && !o.camOnly, 'rec-dis');
  recRenderWay();
  recUpdateMarkBtns();
  recRenderHint();
}

function recOpen() {
  if (!REC.ui) return;
  if (typeof featGuard === 'function' && !featGuard('recorder')) return;
  if (typeof AU === 'object' && AU && AU.unlock) AU.unlock();
  if (!REC.mime) showToast('此瀏覽器不支援錄影');
  if (!REC.mime) REC.opts.camOnly = true;
  recRenderPanel();
  recSetMsg(REC.mime ? recModeError() : recUnsupportedText());
  recShowRoot('panel');
}

function recBuild() {
  const R = REC;
  const root = recEl('div', '');
  root.id = 'recRoot';

  const panel = recEl('div', 'rec-panel');
  panel.appendChild(recEl('h3', 'rec-title', '🎬 拍攝錄影'));
  panel.appendChild(recEl('p', 'rec-desc', '拍攝時會隱藏所有介面,點畫面任意處即可結束(手動運鏡與路徑導覽請按左上角 ⏹)。'));
  const warn = recEl('p', 'rec-warn', '');
  panel.appendChild(warn);

  const segMode = recSeg(REC_MODE_OPTS, function (v) { R.opts.camOnly = v === 'cam'; recRenderPanel(); });
  const segLen = recSeg(REC_LEN_OPTS, function (v) { R.opts.len = v; recRenderPanel(); });
  const segQual = recSeg(REC_QUAL_OPTS, function (v) { R.opts.quality = v; recRenderPanel(); });
  const segCam = recSeg(REC_CAM_OPTS, function (v) {
    R.opts.auto = v === 'auto';
    R.opts.cam = v;
    recRenderPanel();
  });
  const segSpeed = recSeg(REC_SPEED_OPTS, function (v) { R.opts.speed = v; recRenderPanel(); });
  const segSmooth = recSeg(REC_SMOOTH_OPTS, function (v) { R.opts.smooth = v; recRenderPanel(); });
  const segAspect = recSeg(REC_ASPECT_OPTS, function (v) { R.opts.aspect = v; recRenderPanel(); });
  const segFps = recSeg(REC_FPS_OPTS, function (v) { R.opts.fps = v; recRenderPanel(); });
  const segCd = recSeg(REC_CD_OPTS, function (v) { R.opts.countdown = v; recRenderPanel(); });
  const segHold = recSeg(REC_HOLD_OPTS, function (v) { R.opts.hold = v; recRenderPanel(); });
  const swSound = recSwitch('sound');
  const swHud = recSwitch('hud');
  const swClean = recSwitch('clean');
  const swStamp = recSwitch('stamp');
  const swTourStop = recSwitch('tourStop');

  panel.appendChild(recRow('錄法', segMode.el));
  panel.appendChild(recEl('p', 'rec-hint', recModeText()));
  const gameBox = recEl('div', 'rec-gamebox');
  panel.appendChild(gameBox);
  gameBox.appendChild(recRow('長度', segLen.el));
  gameBox.appendChild(recRow('錄聲音', swSound));
  gameBox.appendChild(recRow('畫質', segQual.el));
  gameBox.appendChild(recRow('比例', segAspect.el));
  gameBox.appendChild(recRow('幀率', segFps.el));
  const specHint = recEl('p', 'rec-hint', '');
  gameBox.appendChild(specHint);
  panel.appendChild(recRow('鏡頭', segCam.el));

  const camBox = recEl('div', 'rec-cambox');
  camBox.appendChild(recRow('運鏡速度', segSpeed.el));
  const customRow = recEl('div', 'rec-row');
  customRow.appendChild(recEl('span', 'rec-lbl', '自訂(螢幕寬/秒)'));
  const customRange = document.createElement('input');
  customRange.type = 'range';
  customRange.setAttribute('min', '0.1');
  customRange.setAttribute('max', '1');
  customRange.setAttribute('step', '0.05');
  customRange.value = String(R.opts.speedCustom);
  const customVal = recEl('span', 'rec-val', '');
  customRange.addEventListener('input', function () {
    R.opts.speedCustom = recClamp(Number(customRange.value) || 0.35, 0.05, 1.5);
    R.opts.speed = 'custom';
    recRenderPanel();
  });
  customRow.appendChild(customRange);
  customRow.appendChild(customVal);
  camBox.appendChild(customRow);
  camBox.appendChild(recRow('平滑度', segSmooth.el));
  const tourHint = recEl('p', 'rec-hint', '');
  camBox.appendChild(tourHint);

  const wayHead = recEl('div', 'rec-row');
  wayHead.appendChild(recEl('span', 'rec-lbl', '📍 路點'));
  const wayBtns = recEl('span', 'rec-wp-b');
  const bMark = recEl('button', 'rec-mini2', '標記路點');
  bMark.addEventListener('click', recPlanOpen);
  const bOv = recEl('button', 'rec-mini2', '全城一覽');
  bOv.addEventListener('click', recWayOverview);
  const bClr = recEl('button', 'rec-mini2', '清空');
  bClr.addEventListener('click', recWayClear);
  wayBtns.appendChild(bMark);
  wayBtns.appendChild(bOv);
  wayBtns.appendChild(bClr);
  wayHead.appendChild(wayBtns);
  camBox.appendChild(wayHead);
  const wayList = recEl('div', 'rec-waylist');
  camBox.appendChild(wayList);
  camBox.appendChild(recRow('新路點停留', segHold.el));
  camBox.appendChild(recRow('導覽結束自動停止', swTourStop));
  panel.appendChild(camBox);

  panel.appendChild(recRow('開始前倒數', segCd.el));
  panel.appendChild(recRow('顯示紅點與倒數', swHud));
  panel.appendChild(recRow('乾淨地圖(隱藏泡泡與游標)', swClean));
  gameBox.appendChild(recRow('影片疊加時間戳', swStamp));

  const tipsBtn = recEl('button', 'rec-tipsbtn', '💡 錄影小撇步');
  const tips = recEl('ul', 'rec-tips rec-hide');
  REC_TIPS.forEach(function (t) { tips.appendChild(recEl('li', '', t)); });
  tipsBtn.addEventListener('click', function () { recToggle(tips, !tips.classList.contains('rec-hide'), 'rec-hide'); });
  panel.appendChild(tipsBtn);
  panel.appendChild(tips);

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
  const left = recEl('span', 'rec-left', '');
  const pauseBtn = recEl('button', 'rec-hud-btn', '⏸');
  pauseBtn.setAttribute('aria-label', '暫停或繼續');
  pauseBtn.addEventListener('click', function (e) { if (e && e.stopPropagation) e.stopPropagation(); recTogglePause(); });
  const markBtn = recEl('button', 'rec-hud-btn rec-mo', '📍0');
  markBtn.setAttribute('aria-label', '標記路點');
  markBtn.addEventListener('click', function (e) { if (e && e.stopPropagation) e.stopPropagation(); recMarkHere(); });
  const tourBtn = recEl('button', 'rec-hud-btn rec-mo', '🧭');
  tourBtn.setAttribute('aria-label', '路徑導覽開關');
  tourBtn.addEventListener('click', function (e) { if (e && e.stopPropagation) e.stopPropagation(); recToggleTour(); });
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
  hud.appendChild(left);
  hud.appendChild(pauseBtn);
  hud.appendChild(markBtn);
  hud.appendChild(tourBtn);
  const spd = recEl('div', 'rec-spd rec-mo');
  const spdBar = recEl('span', 'rec-spdbar');
  const spdFill = recEl('i', '');
  spdBar.appendChild(spdFill);
  const spdTxt = recEl('span', 'rec-spdtxt', '');
  spd.appendChild(spdBar);
  spd.appendChild(spdTxt);
  hud.appendChild(spd);

  const catchLayer = recEl('div', 'rec-catch');
  catchLayer.addEventListener('click', recOnTap);

  const plan = recEl('div', 'rec-plan');
  const planCount = recEl('span', 'rec-plan-n', '路點 0');
  const planMark = recEl('button', 'rec-primary', '📍 標記此處');
  planMark.addEventListener('click', recMarkHere);
  const planDone = recEl('button', '', '✓ 完成');
  planDone.addEventListener('click', recPlanDone);
  plan.appendChild(planCount);
  plan.appendChild(planMark);
  plan.appendChild(planDone);

  const count = recEl('div', 'rec-count', '3');
  const countBox = recEl('div', 'rec-countbox');
  countBox.appendChild(count);
  const cdCancel = recEl('button', '', '✕ 取消');
  cdCancel.addEventListener('click', recCancelCount);
  countBox.appendChild(cdCancel);

  const frame = recEl('div', 'rec-frame');

  const review = recEl('div', 'rec-review');
  const video = document.createElement('video');
  video.controls = true;
  video.setAttribute('playsinline', '');
  video.className = 'rec-video';
  review.appendChild(video);
  const rmsg = recEl('p', 'rec-rmsg', '');
  review.appendChild(rmsg);
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

  root.appendChild(frame);
  root.appendChild(panel);
  root.appendChild(catchLayer);
  root.appendChild(hud);
  root.appendChild(plan);
  root.appendChild(countBox);
  root.appendChild(review);
  document.body.appendChild(root);

  R.ui = {
    gameBox: gameBox, segMode: segMode, stopBtn: stopBtn, root: root, panel: panel, hud: hud, catchLayer: catchLayer, time: time, left: left, msg: msg, video: video, rmsg: rmsg,
    segLen: segLen, segQual: segQual, segCam: segCam, segSpeed: segSpeed, segSmooth: segSmooth, segAspect: segAspect,
    segFps: segFps, segCd: segCd, segHold: segHold,
    swSound: swSound, swHud: swHud, swClean: swClean, swStamp: swStamp, swTourStop: swTourStop,
    camBox: camBox, customRow: customRow, customRange: customRange, customVal: customVal,
    specHint: specHint, tourHint: tourHint, warn: warn, wayList: wayList, start: start,
    pauseBtn: pauseBtn, markBtn: markBtn, tourBtn: tourBtn, spd: spd, spdFill: spdFill, spdTxt: spdTxt,
    plan: plan, planCount: planCount, count: count, frame: frame
  };
}

// 設定列顯示條件:錄影功能已開放(PROG_UNLOCK_FEATURE 的 recorder,預設 Lv10)
function recShowEntry() {
  return typeof isUnlocked !== 'function' || isUnlocked('feature', 'recorder');
}

// 乾淨地圖:錄影期間讓泡泡貼圖變成 1×1 透明
function recHookBubbles() {
  if (typeof ART !== 'object' || !ART || typeof ART.bubbleSprite !== 'function') return;
  const base = ART.bubbleSprite;
  let blank = null;
  ART.bubbleSprite = function () {
    if (!recCleanActive()) return base.apply(this, arguments);
    if (!blank) {
      const cv = document.createElement('canvas');
      cv.width = 1;
      cv.height = 1;
      blank = { cv: cv, l: 0, t: 0, res: 1 };
    }
    return blank;
  };
}

function recInit() {
  const R = REC;
  if (R.inited) return;
  R.inited = true;
  if (typeof document === 'undefined' || !document.getElementById) return;
  R.mime = recSupport();
  R.way = recWayLoad();
  R.opts.camOnly = !R.mime || recIsIOS();
  recBuild();
  if (typeof settingsAddRow === 'function') {
    try { settingsAddRow('🎬 拍攝錄影', recOpen, '拍攝', recShowEntry); } catch (e) { console.warn('[rec] settingsAddRow failed', e); }
  }
  if (typeof draw === 'function') {
    const baseDraw = draw;
    draw = function (ctx, time) {
      recCamTick(time);
      recCleanTick();
      const r = baseDraw(ctx, time);
      recCopyFrame();
      return r;
    };
  }
  if (typeof showToast === 'function') {
    const baseToast = showToast;
    showToast = function (msg) {
      if (REC.state === 'recording' || REC.state === 'stopping') return;
      return baseToast(msg);
    };
  }
  recHookBubbles();
  recRenderPanel();
  window.addEventListener('resize', recOnResize);
  document.addEventListener('visibilitychange', recOnVisibility);
  window.addEventListener('pagehide', function () { recStop(); });
  window.addEventListener('pointerdown', recPtrDown, true);
  window.addEventListener('pointermove', recPtrMove, true);
  window.addEventListener('pointerup', recPtrUp, true);
  window.addEventListener('pointercancel', recPtrUp, true);
  window.addEventListener('wheel', recWheel, { capture: true, passive: false });
}

if (typeof document !== 'undefined' && document.readyState) {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', recInit);
  else recInit();
}

// perf.js — 幀率上限與省電模式(耗電/發燙對策)。只存兩個 localStorage 旗標,不碰存檔、不碰戰鬥模擬。
// 幀率只決定「畫幾次」:模擬 / 資源 tick 仍每個 rAF 以實際時間累積(main.js frame),不受影響。
// isPowerSave() 供 citylife / render / bgm 各自讀取同一個旗標;讀寫失敗(私密模式等)一律回退預設(30 fps、省電關)。

const PERF_FPS_KEY = 'lorddomain.fps';
const PERF_PS_KEY = 'lorddomain.powersave';
const PERF_FPS_OPTS = [30, 60];
const PERF = { fps: 30, ps: false, loaded: false };

function perfLoad() {
  if (PERF.loaded) return;
  PERF.loaded = true;
  try {
    const f = parseInt(localStorage.getItem(PERF_FPS_KEY), 10);
    if (PERF_FPS_OPTS.indexOf(f) >= 0) PERF.fps = f;
    PERF.ps = localStorage.getItem(PERF_PS_KEY) === '1';
  } catch (e) {
    PERF.fps = 30;
    PERF.ps = false;
  }
}

function perfGetFps() {
  perfLoad();
  return PERF.fps;
}

function perfSetFps(v) {
  perfLoad();
  v = parseInt(v, 10);
  if (PERF_FPS_OPTS.indexOf(v) < 0) return false;
  PERF.fps = v;
  try { localStorage.setItem(PERF_FPS_KEY, String(v)); } catch (e) { console.warn('[perf] fps write failed', e); }
  return true;
}

function isPowerSave() {
  perfLoad();
  return PERF.ps;
}

function perfSetPowerSave(on) {
  perfLoad();
  PERF.ps = !!on;
  try { localStorage.setItem(PERF_PS_KEY, PERF.ps ? '1' : '0'); } catch (e) { console.warn('[perf] powersave write failed', e); }
}

// 實際繪製幀率:省電固定 30;錄影 60 fps 時為了讓 captureStream 有足夠新畫面而提高到 60
function perfEffFps() {
  let f = isPowerSave() ? 30 : perfGetFps();
  if (typeof REC !== 'undefined' && REC && REC.state === 'recording' && REC.plan && REC.plan.fps > f) f = REC.plan.fps;
  return f;
}

// 幀率閘:以 rAF 時間戳(ms)判斷這一幀要不要畫。對齊理想節拍(next += 間隔),並留 25% 容差,
// 讓 60 / 120 Hz(ProMotion)螢幕的時間戳抖動不會漏幀或掉到一半;停頓過久(> 1 個間隔)就重新對齊。
function perfGateNew() {
  return { next: -1 };
}

function perfGateOk(g, nowMs) {
  const iv = 1000 / perfEffFps();
  if (g.next < 0 || nowMs - g.next > iv) { g.next = nowMs + iv; return true; }
  if (nowMs < g.next - iv * 0.25) return false;
  g.next += iv;
  if (g.next < nowMs) g.next = nowMs + iv;
  return true;
}

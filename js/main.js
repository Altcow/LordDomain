let canvas, ctx;
let lastFrameMs = 0;
let resBarTimer = 0;
let saveTimer = 0;

function boot() {
  canvas = document.getElementById('game');
  ctx = canvas.getContext('2d');
  resizeCanvas(canvas);
  window.addEventListener('resize', () => resizeCanvas(canvas));
  if (!loadWorld()) applyTemplate(DEFAULT_TEMPLATE);
  initUI(canvas);
  const before = Object.assign({}, world.res);
  const sec = applyOfflineGains();
  if (sec > 0) reportOffline(sec, before);
  updateResBar();
  const palace = world.objects.find(o => o.type === 'palace');
  if (palace) centerOnCell(palace.x + 2, palace.y + 2);
  else centerOnCell(MAP_W >> 1, MAP_H >> 1);
  saveWorld();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') saveWorld();
    else handleResume();
  });
  window.addEventListener('pagehide', () => saveWorld());
  lastFrameMs = performance.now();
  requestAnimationFrame(frame);
}

function frame(nowMs) {
  const dt = Math.min(0.25, Math.max(0, (nowMs - lastFrameMs) / 1000));
  lastFrameMs = nowMs;
  tickResources(dt);
  resBarTimer += dt;
  if (resBarTimer >= 0.25) {
    resBarTimer = 0;
    updateResBar();
  }
  saveTimer += dt;
  if (saveTimer >= 10) {
    saveTimer = 0;
    saveWorld();
  }
  if (!pano.open) draw(ctx, nowMs / 1000);
  requestAnimationFrame(frame);
}

function handleResume() {
  const before = Object.assign({}, world.res);
  const sec = applyOfflineGains();
  if (sec > 0) reportOffline(sec, before);
  updateResBar();
  lastFrameMs = performance.now();
}

function reportOffline(sec, before) {
  if (sec < 60) return;
  const gained = [];
  for (const k in RESOURCES) {
    const d = Math.floor(world.res[k] || 0) - Math.floor(before[k] || 0);
    if (d > 0) gained.push(RESOURCES[k].icon + d);
  }
  if (!gained.length) return;
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
  showToast('離線 ' + (h > 0 ? h + ' 小時 ' : '') + m + ' 分，獲得 ' + gained.join(' '));
}

if (document.readyState !== 'loading') boot();
else document.addEventListener('DOMContentLoaded', boot);

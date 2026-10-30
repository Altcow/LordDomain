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
  if (typeof initBattleUI === 'function') initBattleUI();
  const before = Object.assign({}, world.res);
  const sec = applyOfflineGains();
  if (sec > 0) reportOffline(sec, before);
  flushTechDone();
  updateResBar();
  const palace = world.objects.find(o => o.type === 'palace');
  if (palace) centerOnCell(palace.x + 2, palace.y + 2);
  else centerOnCell(MAP_W >> 1, MAP_H >> 1);
  saveWorld();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      if (typeof battleUiHide === 'function') battleUiHide();
      saveWorld();
    } else {
      handleResume();
    }
  });
  window.addEventListener('pagehide', () => saveWorld());
  lastFrameMs = performance.now();
  requestAnimationFrame(frame);
}

function frame(nowMs) {
  const dt = Math.min(0.25, Math.max(0, (nowMs - lastFrameMs) / 1000));
  lastFrameMs = nowMs;
  // 攻擊/沙盤/錄影期間不累積經濟(資源列改顯示掠奪);同步 lastTs 避免離線結算把戰鬥時間算進去
  if (typeof lootMode === 'function' && lootMode()) world.lastTs = Date.now();
  else tickResources(dt);
  const td = tickResearch(dt);
  if (td) onTechDone(td, false);
  if (battle && ((game.mode === 'attack' && game.phase === 'march') || game.mode === 'replay')) {
    const sp = typeof game.simSpeed === 'number' ? game.simSpeed : 1;
    battle.acc += dt * sp;
    let n = 0;
    while (battle.acc >= SIM_DT && n < 8) {
      simTick(battle);
      battle.acc -= SIM_DT;
      n++;
    }
    if (n === 8) battle.acc = 0;
  }
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
  if (typeof battleUiTick === 'function') battleUiTick(dt);
  if (typeof game !== 'undefined' && game.mode === 'fishing') { requestAnimationFrame(frame); return; }
  if (!pano.open) draw(ctx, nowMs / 1000);
  requestAnimationFrame(frame);
}

function handleResume() {
  const before = Object.assign({}, world.res);
  const sec = applyOfflineGains();
  if (sec > 0) reportOffline(sec, before);
  flushTechDone();
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

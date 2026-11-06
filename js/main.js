let canvas, ctx;
let lastFrameMs = 0;
let resBarTimer = 0;
let saveTimer = 0;
let drawGate = null; // 幀率上限閘(perf.js);只管 draw,模擬 / 資源 tick 每個 rAF 照跑

// 城市等級存檔與舊存檔遷移(PLAN_PROGRESSION §8.2):必須在 loadWorld / saveWorld 之前
function progBoot() {
  progLoad();
  return progMigrateReset();
}

function boot() {
  canvas = document.getElementById('game');
  ctx = canvas.getContext('2d');
  resizeCanvas(canvas);
  window.addEventListener('resize', () => resizeCanvas(canvas));
  // iOS 直版轉橫版後視窗尺寸與安全區常延遲更新:轉向後再補量兩次,並強制重排固定定位的邊欄/頂列
  window.addEventListener('orientationchange', () => { [120, 450].forEach(ms => setTimeout(() => { resizeCanvas(canvas); const sb = document.getElementById('sideBar'); if (sb) { sb.style.display = 'none'; void sb.offsetWidth; sb.style.display = ''; } }, ms)); });
  const migr = progBoot();
  const freshWorld = !loadWorld();
  if (freshWorld) applyTemplate(DEFAULT_TEMPLATE);
  if (freshWorld && typeof tutStartNew === 'function') { if (world && !world.city) world.city = {}; tutStartNew(); }   // 全新世界才開新手教學(舊存檔沒有 tut = 已畢業)
  if (typeof worldWizardBoot === 'function') worldWizardBoot(freshWorld);   // 精靈選的世界風格 / 起手範本(只在全新世界套用一次)
  initUI(canvas);
  if (migr.migrated && typeof showToast === 'function') showToast('舊領地已備份,從 1 級重新開始(設定可還原備份)');
  if (typeof initBattleUI === 'function') initBattleUI();
  const before = Object.assign({}, world.res);
  const sec = applyOfflineGains();
  if (!(typeof worldsArrivalToast === 'function' && worldsArrivalToast(sec, before)) && sec > 0) reportOffline(sec, before);   // 切換世界後:優先顯示「平行世界 NN 離開多久、補發了什麼」
  flushTechDone();
  updateResBar();
  applyStartZoom();
  const palace = world.objects.find(o => o.type === 'palace');
  if (palace) centerOnCell(palace.x + 2, palace.y + 2);
  else centerOnCell(boardW() >> 1, boardH() >> 1);
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
  else { tickResources(dt); if (typeof techTick === 'function') techTick(dt); }
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
  if (typeof cardsNamedTick === 'function') cardsNamedTick(dt);   // 指名券:官階晉升檢查(cards.js,每 5 秒)
  if (typeof tavernTick === 'function') tavernTick(dt);   // 酒館包間收益結算(tavern_i1.js,每 5 秒檢查、每遊戲小時入帳)
  if (typeof game !== 'undefined' && game.mode === 'bn') { requestAnimationFrame(frame); return; }   // 戰鬥 A(js/bnui.js):全螢幕戰鬥畫面自己畫,不重畫城市
  if (typeof game !== 'undefined' && (game.mode === 'fishing' || game.mode === 'interior')) { requestAnimationFrame(frame); return; }   // 釣魚 / 室內:全螢幕子畫面自己畫,不重畫城市
  // 繪製幀率上限(動態:操作中用設定值 60/30,閒置 30;省電固定 30);未達間隔的 rAF 只跑上面的模擬 / tick,不畫
  if (!pano.open && (typeof perfGateOk !== 'function' || perfGateOk(drawGate || (drawGate = perfGateNew()), nowMs))) draw(ctx, nowMs / 1000);
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

// 啟動入口:先讓 saveslots.js 處理被打斷的世界切換(pending)再開機
function bootWorlds() { if (typeof worldsStartup === 'function') worldsStartup(boot); else boot(); }
if (document.readyState !== 'loading') bootWorlds();
else document.addEventListener('DOMContentLoaded', bootWorlds);

// 關閉瀏覽器原生行為(長按選字/選單/翻譯提示/拖曳/iOS 捏合縮放),讓畫面像原生遊戲
(function lockBrowserUi() {
  const editable = t => !!(t && t.closest && t.closest('input, textarea, [contenteditable]'));
  document.addEventListener('contextmenu', e => { if (!editable(e.target)) e.preventDefault(); });
  document.addEventListener('selectstart', e => { if (!editable(e.target)) e.preventDefault(); });
  document.addEventListener('dragstart', e => e.preventDefault());
  ['gesturestart', 'gesturechange', 'gestureend'].forEach(n => document.addEventListener(n, e => e.preventDefault()));
})();

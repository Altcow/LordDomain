// mapedit.js — 雙基地切換與戰鬥布置工具(PLAN_TD_MASTER §6.1)
// 依賴 ui.js(ui、gs、buildToolbar、setTool、showToast、hideReset、pendWarnText、updateResBar)與 map.js、mapio.js。

// 戰鬥布置工具列(只在 game.mode === 'battleDesign' 顯示)
// drag:可拖曳刷;rect:按下與放開兩點畫矩形;act:按鈕動作(不成為繪製工具)
const CAMP_TOOLS = {
  blk1:   { name: '不可通行', icon: '🚧', drag: true },
  blk2:   { name: '禁建', icon: '🚫', drag: true },
  zone1:  { name: '平原', icon: '🟨', drag: true },
  zone2:  { name: '森林', icon: '🌲', drag: true },
  zone3:  { name: '峽谷', icon: '🟫', drag: true },
  zone4:  { name: '山地', icon: '⛰️', drag: true },
  zone5:  { name: '河灘', icon: '🏖️', drag: true },
  depF:   { name: '部署區(正面)', icon: '🟩', rect: true },
  depS:   { name: '部署區(側翼)', icon: '🟪', rect: true },
  rally:  { name: '集結點', icon: '🚩' },
  aient:  { name: 'AI 入口', icon: '🟧', rect: true },
  mErase: { name: '標記橡皮擦', icon: '🧽', drag: true },
  valid:  { name: '驗證', icon: '✅', act: function () { mapeditValidate(); } },
  copyE:  { name: '複製經營地形', icon: '📋', act: function () { mapeditCopyEstate(); } },
  tplC:   { name: '戰陣範本', icon: '📜', act: function () { toggleTplMenu(true); } }
};

const CAMP_RALLY_MAX = 6;
let mapeditRect = { t: null, x: 0, y: 0 };   // 矩形工具的按下格
let mapeditDotTimer = 0;

function initMapEdit() {
  const top = document.getElementById('topbar');
  if (!top || document.getElementById('boardSwitch')) return;
  const wrap = document.createElement('span');
  wrap.id = 'boardSwitch';
  wrap.innerHTML =
    '<button data-board="estate" title="經營布置(領地、生產、美觀)"><span class="ic">🏘</span><span class="lbl">經營布置</span></button>' +
    '<button data-board="camp" title="戰鬥布置(被攻打時的戰陣)"><span class="ic">⚔</span><span class="lbl">戰鬥布置</span></button>' +
    '<i id="campDot" class="vdot none"></i>';
  const title = document.getElementById('title');
  top.insertBefore(wrap, title ? title.nextSibling : top.firstChild);
  wrap.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (b) setBoardMode(b.getAttribute('data-board'));
  });

  const pick = document.createElement('div');
  pick.id = 'campPick';
  pick.hidden = true;
  pick.innerHTML =
    '<div class="box"><b>建立戰鬥布置</b><p>戰鬥布置尚未建立，請選擇起點：</p>' +
    '<button data-cpick="def">★ 套用預設戰鬥陣(方城陣)<small>直接套用預設戰鬥範本並進入戰鬥布置</small></button>' +
    '<button data-cpick="copy">複製經營地形<small>地形與高度照抄經營基地；只帶可共用的建築(城牆、城門、階梯、橋、樹、石)</small></button>' +
    '<button data-cpick="tpl">戰陣範本<small>進入後從戰陣範本挑一個套用</small></button>' +
    '<button data-cpick="blank">空白草地<small>從零開始</small></button>' +
    '<button data-cpick="cancel">取消</button></div>';
  document.body.appendChild(pick);
  pick.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (b) pickCampStart(b.getAttribute('data-cpick'));
  });

  updateBoardSwitch();
  mapeditUpdateDot();
}

function updateBoardSwitch() {
  const cur = game.mode === 'battleDesign' ? 'camp' : 'estate';
  document.querySelectorAll('#boardSwitch button').forEach(b => {
    b.classList.toggle('on', b.getAttribute('data-board') === cur);
  });
}

// 切換棋盤名與模式。戰鬥陣尚未建立(campBoard() 為 null)時先開三選一
function setBoardMode(to) {
  if (game.backup || (game.mode !== 'estate' && game.mode !== 'battleDesign')) return;
  if (to !== 'estate' && to !== 'camp') return;
  if (to === 'camp' && game.mode === 'battleDesign') return;
  if (to === 'estate' && game.mode === 'estate') return;
  if (to === 'camp' && campBoard() === null) {
    document.getElementById('campPick').hidden = false;
    return;
  }
  enterBoard(to);
}

function enterBoard(to) {
  if (world.board !== to) switchBoard(to);
  game.mode = to === 'camp' ? 'battleDesign' : 'estate';
  hideReset();
  toggleTplMenu(false);
  document.body.classList.toggle('camp-mode', to === 'camp');
  buildToolbar();
  setTool(null);
  updateResBar();
  updateBoardSwitch();
  mapeditUpdateDot();
  saveWorld();
}

function pickCampStart(k) {
  document.getElementById('campPick').hidden = true;
  if (k !== 'def' && k !== 'copy' && k !== 'tpl' && k !== 'blank') return;
  enterBoard('camp');
  if (k === 'def') {
    const r = applyDefaultTemplate('camp');
    if (!r) showToast('預設戰鬥陣無法套用');
    else { mapeditUpdateDot(); saveWorld(); updateResBar(); showToast('已套用預設戰鬥陣'); }
  }
  if (k === 'copy') mapeditDoCopy();
  if (k === 'tpl') toggleTplMenu(true);
}

function mapeditDoCopy() {
  hideReset();
  if (!copyEstateToCamp()) return;
  saveWorld();
  mapeditUpdateDot();
  showToast('已複製經營地形');
}

function mapeditCopyEstate() {
  if (game.mode !== 'battleDesign') return;
  if (!confirm('以經營地形覆蓋目前戰陣？\n地形與高度會複製；只保留可共用的建築；block、zone 與標記會清空。' + pendWarnText())) return;
  pendClear();
  mapeditDoCopy();
  updateResBar();
}

// 戰陣模式的清空:只清戰陣棋盤,不動資源、科技與兵力
function mapeditClear() {
  if (!confirm('清空戰鬥陣？' + pendWarnText())) return;
  pendClear();
  hideReset();
  clearBoard();
  saveWorld();
  updateResBar();
  mapeditUpdateDot();
}

// 驗證鈕:toast 顯示錯誤數與第一條
function mapeditValidate() {
  const r = mapeditUpdateDot();
  if (!r) {
    showToast('尚未建立戰鬥陣');
    return;
  }
  if (r.errors.length) showToast('驗證失敗 ' + r.errors.length + ' 項：' + r.errors[0]);
  else showToast('驗證通過' + (r.warnings.length ? '(提醒 ' + r.warnings.length + ' 項：' + r.warnings[0] + ')' : ''));
}

// 更新切換鈕的紅/綠點;戰陣不存在時隱藏。回傳 validateCamp 結果或 null
function mapeditUpdateDot() {
  const dot = document.getElementById('campDot');
  const cb = campBoard();
  let r = null;
  if (cb) {
    try {
      r = validateCamp(cb);
    } catch (e) {
      console.warn('[mapedit] validate failed', e);
    }
  }
  if (dot) {
    if (!r) {
      dot.className = 'vdot none';
      dot.title = '';
    } else {
      dot.className = 'vdot ' + (r.errors.length ? 'bad' : 'ok');
      dot.title = r.errors.length ? '戰陣驗證:' + r.errors.length + ' 項錯誤' : '戰陣驗證通過';
    }
  }
  return r;
}

// 編輯後節流 1 秒重算紅綠點(只在戰鬥布置模式)
function mapeditRefresh() {
  if (game.mode !== 'battleDesign' || mapeditDotTimer) return;
  mapeditDotTimer = setTimeout(() => {
    mapeditDotTimer = 0;
    mapeditUpdateDot();
  }, 1000);
}

// 戰陣工具的單格動作。phase:'down' 按下 / 單格;'up' 放開(矩形類才完成)。回傳是否改動
function mapeditApply(t, x, y, phase) {
  if (game.mode !== 'battleDesign' || !CAMP_TOOLS[t]) return false;
  const i = idx(x, y);
  const m = world.marks;
  if (t === 'blk1' || t === 'blk2') {
    const v = t === 'blk1' ? 1 : 2;
    if (world.block[i] === v) return false;
    world.block[i] = v;
    return true;
  }
  if (t.indexOf('zone') === 0) {
    const v = +t.charAt(4);
    if (world.zone[i] === v) return false;
    world.zone[i] = v;
    return true;
  }
  if (t === 'mErase') return mapeditErase(x, y);
  if (t === 'rally') return mapeditRally(x, y);
  if (t === 'depF' || t === 'depS' || t === 'aient') {
    if (phase === 'down') {
      mapeditRect = { t: t, x: x, y: y };
      return false;
    }
    const s = mapeditRect;
    mapeditRect = { t: null, x: 0, y: 0 };
    if (phase !== 'up' || s.t !== t) return false;
    const r = [Math.min(s.x, x), Math.min(s.y, y), Math.abs(s.x - x) + 1, Math.abs(s.y - y) + 1];
    if (t === 'aient') m.aiEntry.push({ r: r, name: '入口' + (m.aiEntry.length + 1) });
    else m.deploy.push({ r: r, kind: t === 'depF' ? 'front' : 'flank' });
    return true;
  }
  return false;
}

// 橡皮擦:清該格 block / zone,並刪除含該格的部署區、AI 入口與同格集結點
function mapeditErase(x, y) {
  const i = idx(x, y);
  const m = world.marks;
  let ch = false;
  if (world.block[i]) { world.block[i] = 0; ch = true; }
  if (world.zone[i]) { world.zone[i] = 0; ch = true; }
  const inRect = r => x >= r[0] && x < r[0] + r[2] && y >= r[1] && y < r[1] + r[3];
  ['deploy', 'aiEntry'].forEach(k => {
    const n = m[k].length;
    m[k] = m[k].filter(a => !inRect(a.r));
    if (m[k].length !== n) ch = true;
  });
  const nr = m.rally.length;
  m.rally = m.rally.filter(p => p.x !== x || p.y !== y);
  if (m.rally.length !== nr) ch = true;
  return ch;
}

// 集結點:點既有則刪除,否則新增(最多 6 個,id r1…)
function mapeditRally(x, y) {
  const m = world.marks;
  const k = m.rally.findIndex(p => p.x === x && p.y === y);
  if (k >= 0) {
    m.rally.splice(k, 1);
    return true;
  }
  if (m.rally.length >= CAMP_RALLY_MAX) {
    showToast('集結點最多 ' + CAMP_RALLY_MAX + ' 個');
    return false;
  }
  let n = 1;
  while (m.rally.some(p => p.id === 'r' + n)) n++;
  m.rally.push({ id: 'r' + n, x: x, y: y, name: '集結點' + n });
  return true;
}

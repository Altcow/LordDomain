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
  rally:  { name: '集結點', icon: '🚩' },
  aient:  { name: 'AI 入口', icon: '🟧', rect: true },
  mErase: { name: '標記橡皮擦', icon: '🧽', drag: true },
  valid:  { name: '驗證', icon: '✅', act: function () { mapeditValidate(); } },
  copyE:  { name: '複製經營地形', icon: '📋', act: function () { mapeditCopyEstate(); } },
  tplC:   { name: '戰陣範本', icon: '📜', act: function () { toggleTplMenu(true); } },
  sandbox: { name: '沙盤', icon: '⚔️', act: function () { const b = document.getElementById('btnSandbox'); if (b) b.click(); } },
  clear:  { name: '清空', icon: '🗑️', act: function () { mapeditClear(); } }
};

// 工具列分組(§戰鬥布置說明):建築未列出的戰陣物件(之後新增的塔等)自動併入「建築」
const CAMP_GROUPS = [
  { id: 'build', name: '建築', items: ['hq', 'tower', 'nutai', 'shitai', 'tent', 'wagon', 'granary', 'muster', 'banner', 'fakecamp'] },
  { id: 'wall', name: '城牆與通道', items: ['wall', 'gate', 'stairs', 'ramp', 'bridge'] },
  { id: 'terr', name: '地形', items: ['raise', 'lower', 'road', 'grass', 'lake', 'river', 'erase', 'tree', 'stone'] },
  { id: 'mark', name: '標記', items: ['blk1', 'blk2', 'zone1', 'zone2', 'zone3', 'zone4', 'zone5', 'rally', 'aient', 'mErase'] },
  { id: 'func', name: '功能', items: ['valid', 'copyE', 'tplC', 'sandbox', 'clear'] }
];

// 白話說明:key 為工具 / 物件 id(涵蓋 CAMP_TOOLS 與 CAMP_OBJECTS 全部 key,及地形與道路工具)
const TOOL_HELP = {
  hq: '核心建築,全場只能 1 座;被摧毀可得 1 星,自身會以射程 4 還擊。',
  tower: '自動射擊射程 5 內的敵人(單體);站在高處時射程增加,是防守主力。',
  nutai: '射程 6,箭矢穿透直線上最多 3 個目標(威力依序 100/70/50%),對騎兵 ×1.5。',
  shitai: '射程 7、2 格內打不到,範圍轟擊最多 4 個目標,對盾兵 ×1.25。',
  tent: '不攻擊;被打或敵人靠近時放出民兵 1 人,是消耗敵軍的靶。',
  wagon: '不攻擊;敵方騎兵會優先來劫掠,被毀只計摧毀度,不扣經營資源。',
  granary: '不攻擊的儲糧靶(血量 450),被毀只計摧毀度,不影響經營資源。',
  muster: '不攻擊;裡面藏刀盾兵 3、弓兵 2,被打或敵人靠近到觸發距離時全數出動。',
  banner: '不攻擊;裡面藏獵戶 2,被打或敵人靠近時出動;旗倒時周圍守軍減攻的效果目前尚未實作。',
  fakecamp: '外觀像營帳的假營,用來誘敵;戰鬥中的誘引與現形效果目前尚未實作,僅供擺放與標示。',
  qtower: '輕箭樓(1×1),快速單體射擊,對弓兵效果好、對盾兵較弱;佔 1 點陣地容量。',
  ztower: '重箭樓(2×2),單發威力大、血厚的單體射手,對盾兵與高血單位有效,對群兵容易浪費;佔 3 點。',
  lianu: '連弩樓(2×2),一次射中射程內最近的 3 名敵人,適合對付民兵與黃巾群,高防禦的盾兵效果差;佔 3 點。',
  huojian: '火箭樓(2×2),範圍射擊,命中者會燃燒數秒持續掉血,對器械與弓兵較強、對盾兵較弱;佔 3 點。',
  xunyan: '熏煙台(2×2),範圍放煙,煙中的敵人持續掉血並減速,適合隘口與密集敵群,對單一強兵效果有限;佔 3 點。',
  chuangtai: '床弩台(2×2),射程 9 的長程重弩,對器械有加成;2 格內打不到,貼身的敵人無法攻擊;佔 4 點。',
  pili: '霹靂車(3×3),大範圍重擊,一次最多波及 6 人,對盾陣與器械群有效;3 格內打不到,全陣最多 1 座;佔 6 點。',
  gutai: '擂鼓台(2×2),不攻擊;射程 6 內的防禦建築射速提高 20%,擂鼓台被打倒後效果即消失;佔 3 點。',
  fengsui: '烽燧台(1×1),不攻擊;第一名攻方進入 8 格內時,全陣防禦建築射速提高 15%(持續 20 秒),進入者受傷增加 10%;佔 2 點。',
  wanglou: '望樓(1×1),遠程單體射擊(射程 7),對弓兵有加成;8 格內的伏兵會被看穿、失去奇襲優先;佔 1 點。',
  qiangzhen: '拒馬槍陣(2×2),近距離範圍攻擊(射程 2),對騎兵特別有效、對盾兵較弱;適合放在騎兵必經的谷口或門前;佔 2 點。',
  ponu: '破甲弩(2×2),射程 6 的單體弩,攻擊時無視目標七成防禦,對盾兵、長戟、力士與衝車特別有效,對低防禦的群兵效果浪費;佔 3 點。',
  dilou: '敵樓(2×2),血厚防禦高的單體射手,能吸收器械的火力,沒有特別的剋制對象;佔 4 點。',
  zhalou: '閘樓(3×1),同時是營門:守軍可通行,攻方視為牆須打破,本身會射箭,衝車專撞門、對它效果好;佔 3 點。',
  lujiao: '鹿角(1×1,可拖曳排成一列),矮木柵擋住通行,攻方視為牆須打破,血量低、容易拆除;不佔陣地容量點,改以格數計。',
  jianzhuang: '尖樁陣(2×2),不可攻擊也不擋路,踩入其中的步兵速度降為八成、騎兵與重甲減為一半;佔 1 點。',
  wall: '實心的牆,擋住敵人去路,敵軍要繞行或打破;牆周圍 3 格內不能放兵。',
  gate: '3 格寬的城門,守軍可以通過,攻方視為牆要打破;周圍 3 格內也不能放兵。',
  stairs: '單格的台階,單位只能在這格上下不同高度;高度不同的格子之間要靠它或斜坡連接。',
  ramp: '1×2 的坡道,和階梯一樣可連接不同高度,是高台的主要入口。',
  bridge: '蓋在湖或河上,讓單位跨過水面;沒有橋的水格不能通行。',
  raise: '把這格的地形抬高一級(最高 2 級);高度不同的格子之間只能經由階梯或斜坡。',
  lower: '把這格的地形降低一級(最低 0 級),高度規則同升高。',
  road: '平坦的路面,可蓋建築與城門;戰鬥的地形加成目前按平原計算。',
  grass: '一般地面,大部分建築都蓋在這裡。',
  lake: '水面,不能通行也不能蓋建築,除非架橋。',
  river: '水面,同湖,不能通行,架橋後才能過。',
  erase: '點一下移除該格的建築或樹石等物件。',
  tree: '障礙物,單位不能穿過,也不能在上面蓋建築。',
  stone: '障礙物,單位不能穿過,只能種在草地上。',
  blk1: '這格敵人與我方都不能走,用來引導路線(會實際擋路)。',
  blk2: '只作標示,提醒這格不要蓋建築;目前程式還不會擋下放置。',
  zone1: '區域-平原:僅作顏色標示(平坦開闊),目前戰鬥不讀取區域值。',
  zone2: '區域-森林:僅作顏色標示(林地),目前戰鬥不讀取區域值。',
  zone3: '區域-峽谷:僅作顏色標示(狹谷),目前戰鬥不讀取區域值。',
  zone4: '區域-山地:僅作顏色標示(山地),目前戰鬥不讀取區域值。',
  zone5: '區域-河灘:僅作顏色標示(河岸淺灘),目前戰鬥不讀取區域值。',
  rally: '標記一個集結位置(最多 6 個),再點一下同一格即可刪除。',
  aient: '框出一塊區域作為 AI 襲擊部隊的入口記號,拖曳矩形後放開即建立。',
  mErase: '清除該格的不可通行與區域標記,並刪掉含該格的入口與集結點。',
  valid: '檢查戰陣是否合法(核心數、可部署格、數量上限等),結果顯示在紅綠點與提示中。',
  copyE: '把經營基地的地形與高度照抄過來,只保留可共用的建築;會覆蓋目前戰陣。',
  tplC: '從現成範本挑一個套用,會覆蓋目前戰陣。',
  sandbox: '用目前戰陣試打一場,不計戰績、不存檔。',
  clear: '清掉整個戰鬥陣的建築與地形標記,不影響資源與科技。'
};

const CAMP_RALLY_MAX = 6;
let mapeditRect = { t: null, x: 0, y: 0 };   // 矩形工具的按下格
let mapeditDotTimer = 0;
let campGroupCollapsed = {};                 // 分組 id -> true 表示收合(只存在記憶體)

// 某分組實際包含的工具 id(工具列與說明面板共用)
function campGroupIds(g) {
  const ids = g.items.slice();
  if (g.id === 'build') {
    Object.keys(OBJECTS).forEach(k => {
      if (OBJECTS[k].side === 'camp' && ids.indexOf(k) < 0) ids.push(k);
    });
  }
  return ids;
}

// 戰鬥布置工具列:由 buildToolbar 呼叫(只在 game.mode === 'battleDesign')
function buildCampToolbar(bar) {
  addToolButton(bar, null, '✋', '瀏覽', null);
  CAMP_GROUPS.forEach(g => {
    const off = !!campGroupCollapsed[g.id];
    const head = document.createElement('span');
    head.className = 'tgh';
    head.setAttribute('data-grp', g.id);
    head.textContent = (off ? '▸ ' : '▾ ') + g.name;
    head.addEventListener('click', () => campGroupToggle(g.id));
    bar.appendChild(head);
    campGroupIds(g).forEach(id => {
      let btn = null;
      if (CAMP_TOOLS[id]) btn = addToolButton(bar, id, CAMP_TOOLS[id].icon, CAMP_TOOLS[id].name, null);
      else if (TERRAIN_TOOLS[id]) btn = addToolButton(bar, id, TERRAIN_TOOLS[id].icon, TERRAIN_TOOLS[id].name, null);
      else if (OBJECTS[id] && sideOk(id)) btn = addToolButton(bar, id, OBJECTS[id].icon, OBJECTS[id].name, OBJECTS[id]);
      if (!btn) return;
      btn.setAttribute('data-grp', g.id);
      if (off) btn.classList.add('tg-off');
    });
  });
}

function campGroupToggle(id) {
  campGroupCollapsed[id] = !campGroupCollapsed[id];
  const off = !!campGroupCollapsed[id];
  const g = CAMP_GROUPS.find(x => x.id === id);
  document.querySelectorAll('#toolbar [data-grp="' + id + '"]').forEach(el => {
    if (el.tagName === 'SPAN') el.textContent = (off ? '▸ ' : '▾ ') + (g ? g.name : '');
    else el.classList.toggle('tg-off', off);
  });
}

// 工具的白話說明列(「名稱：說明」);沒有說明或不在戰陣模式回 ''
function toolHelpLine(t) {
  if (!t || game.mode !== 'battleDesign' || !TOOL_HELP[t]) return '';
  const d = CAMP_TOOLS[t] || TERRAIN_TOOLS[t] || OBJECTS[t];
  return (d ? d.name : t) + '：' + TOOL_HELP[t];
}

// 說明面板(❓ 說明):條列全部工具,分組同工具列
function toggleToolHelp(open) {
  const p = document.getElementById('toolHelp');
  if (!p) return;
  const show = open === undefined ? p.hidden : !!open;
  if (show) buildToolHelp(p);
  p.hidden = !show;
}

function buildToolHelp(p) {
  const parts = ['<div class="thd"><b>戰鬥布置工具說明</b><button class="close" data-thclose>✕</button></div>'];
  CAMP_GROUPS.forEach(g => {
    parts.push('<div class="thg">' + g.name + '</div>');
    campGroupIds(g).forEach(id => {
      const d = CAMP_TOOLS[id] || TERRAIN_TOOLS[id] || OBJECTS[id];
      if (!d || !TOOL_HELP[id]) return;
      parts.push('<div class="thr"><span class="ic">' + d.icon + '</span><b>' + d.name + '</b><span>' + TOOL_HELP[id] + '</span></div>');
    });
  });
  p.innerHTML = parts.join('');
}

// 範本標籤(templates 的 labels):套用後以 DOM 浮動小標籤顯示在格子上方;切換模式或套用其他範本時移除
let mapeditLabels = null;      // { list: [{ x, y, el }] } 或 null
let mapeditLabelRun = false;   // 標籤位置更新迴圈是否執行中
function mapeditLabelsClear() {
  mapeditLabels = null;
  const box = document.getElementById('tplLabels');
  if (box) {
    box.textContent = '';
    box.classList.remove('off');
  }
  document.body.classList.remove('tpl-labels');
  const b = document.getElementById('btnTplLabels');
  if (b) b.textContent = '✕ 隱藏標籤';
}

function mapeditLabelsShow(list, ox, oy) {
  const box = document.getElementById('tplLabels');
  if (!box || !list || !list.length) return;
  mapeditLabels = {
    list: list.map(l => {
      const el = document.createElement('div');
      el.className = 'tlb';
      el.textContent = l.text;
      box.appendChild(el);
      return { x: ox + l.x, y: oy + l.y, el: el };
    })
  };
  document.body.classList.add('tpl-labels');
  if (!mapeditLabelRun) {
    mapeditLabelRun = true;
    requestAnimationFrame(mapeditLabelsTick);
  }
}

// 每幀依目前平移 / 縮放把標籤放到格子上方;離開戰陣模式即移除
function mapeditLabelsTick() {
  if (!mapeditLabels) {
    mapeditLabelRun = false;
    return;
  }
  if (game.mode !== 'battleDesign') {
    mapeditLabelsClear();
    mapeditLabelRun = false;
    return;
  }
  mapeditLabels.list.forEach(l => {
    if (!inBounds(l.x, l.y)) return;
    const gx = l.x + 0.5, gy = l.y + 0.5;
    const s = worldToScreen(isoX(gx, gy), isoY(gx, gy, world.height[idx(l.x, l.y)]));
    l.el.style.transform = 'translate(' + Math.round(s[0]) + 'px,' + Math.round(s[1]) + 'px) translate(-50%,-50%)';
  });
  requestAnimationFrame(mapeditLabelsTick);
}

// 包一層 applyTemplate:map.js 不認得 labels,這裡在套用成功後另外顯示標籤
const mapeditApplyTemplateBase = applyTemplate;
applyTemplate = function (id) {
  const r = mapeditApplyTemplateBase(id);
  mapeditLabelsClear();
  const t = TEMPLATES.find(v => v.id === id);
  if (r && t && t.labels && game.mode === 'battleDesign') mapeditLabelsShow(t.labels, r.ox, r.oy);
  return r;
};

function initMapEdit() {
  const top = document.getElementById('topbar');
  if (!top || document.getElementById('modeBtn')) return;
  cornerBuild();

  const btnHelp = document.createElement('button');
  btnHelp.id = 'btnToolHelp';
  btnHelp.title = '戰鬥布置工具說明';
  btnHelp.textContent = '❓ 說明';
  top.insertBefore(btnHelp, document.getElementById('btnHide'));
  btnHelp.addEventListener('click', () => toggleToolHelp());

  const btnLbl = document.createElement('button');
  btnLbl.id = 'btnTplLabels';
  btnLbl.title = '顯示或隱藏範本的區域標籤';
  btnLbl.textContent = '✕ 隱藏標籤';
  top.insertBefore(btnLbl, document.getElementById('btnHide'));
  btnLbl.addEventListener('click', () => {
    const box = document.getElementById('tplLabels');
    if (!box) return;
    const off = box.classList.toggle('off');
    btnLbl.textContent = off ? '🏷 顯示標籤' : '✕ 隱藏標籤';
  });

  const cap = document.createElement('div');
  cap.id = 'campCap';
  cap.hidden = true;
  document.body.appendChild(cap);

  const help = document.createElement('div');
  help.id = 'toolHelp';
  help.hidden = true;
  document.body.appendChild(help);
  help.addEventListener('pointerdown', e => e.stopPropagation());
  help.addEventListener('click', e => {
    if (e.target.closest('[data-thclose]')) toggleToolHelp(false);
  });

  const labels = document.createElement('div');
  labels.id = 'tplLabels';
  document.body.appendChild(labels);

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

// 角落操作群(A'):左下 經營/戰鬥布置鈕 + 其正上方 ⚔ 戰鬥鈕與選單;右下 🌤 季節時段浮層。位置全部由 CSS 固定
function cornerBuild() {
  if (document.getElementById('modeBtn')) return;
  const mode = document.createElement('button');
  mode.id = 'modeBtn';
  mode.className = 'corner';
  mode.title = '切換經營布置 / 戰鬥布置';
  mode.icEl = document.createElement('span');
  mode.icEl.className = 'ic';
  mode.nmEl = document.createElement('span');
  mode.nmEl.className = 'nm';
  mode.appendChild(mode.icEl);
  mode.appendChild(mode.nmEl);
  const dot = document.createElement('i');
  dot.id = 'campDot';
  dot.className = 'vdot none';
  mode.appendChild(dot);
  mode.addEventListener('click', () => setBoardMode(game.mode === 'battleDesign' ? 'estate' : 'camp'));
  document.body.appendChild(mode);

  const menu = document.createElement('div');
  menu.id = 'fightMenu';
  menu.hidden = true;
  menu.addEventListener('pointerdown', e => e.stopPropagation());
  menu.addEventListener('click', onFightMenuClick);
  document.body.appendChild(menu);

  const pop = document.createElement('div');
  pop.id = 'seasonPop';
  pop.hidden = true;
  pop.addEventListener('pointerdown', e => e.stopPropagation());
  pop.addEventListener('click', onSeasonPopClick);
  document.body.appendChild(pop);
  const sbtn = document.createElement('button');
  sbtn.id = 'seasonBtn';
  sbtn.className = 'corner';
  sbtn.title = '季節與時段';
  sbtn.textContent = '🌤';
  sbtn.addEventListener('click', () => cornerSeasonToggle());
  document.body.appendChild(sbtn);

  document.addEventListener('pointerdown', e => {
    if (!menu.hidden && !e.target.closest('#fightMenu, #btnAttack')) cornerFightClose();
    if (!pop.hidden && !e.target.closest('#seasonPop, #seasonBtn, #sideBar')) cornerSeasonClose();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { cornerFightClose(); cornerSeasonClose(); }
  });
  if (typeof setInterval === 'function') setInterval(cornerSync, 300);
  cornerSync();
}

// 飛行模式 / 進攻 / 回放 / 沙盤 / 釣魚時隱藏角落群(atkSync 另外處理 ⚔ 鈕的 atk 狀態)
function cornerHidden() {
  const b = document.body;
  const cls = b && b.classList && (b.classList.contains('atk-mode') || b.classList.contains('replay-mode') || b.classList.contains('sandbox'));
  return !!cls || (typeof game !== 'undefined' && (game.mode === 'fishing' || game.mode === 'attack' || game.mode === 'replay'));
}

function cornerSync() {
  const off = cornerHidden();
  ['modeBtn', 'seasonBtn'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.hidden = off;
  });
  if (off) {
    cornerFightClose();
    cornerSeasonClose();
  }
  if (typeof atkSync === 'function') atkSync();
  updateBoardSwitch();
}

function updateBoardSwitch() {
  const b = document.getElementById('modeBtn');
  if (!b || !b.icEl) return;
  const camp = game.mode === 'battleDesign';
  b.classList.toggle('camp', camp);
  b.icEl.textContent = camp ? '⚔' : '🏘';
  b.nmEl.textContent = camp ? '戰鬥布置' : '經營';
}

function cornerFightOpen() {
  const menu = document.getElementById('fightMenu');
  if (!menu) return;
  menu.textContent = '';
  menu.appendChild(cornerMenuBtn('rand', '🎲 隨機戰鬥'));
  menu.appendChild(cornerMenuBtn('friend', '🤝 朋友邀請碼'));
  const row = document.createElement('div');
  row.id = 'fmFriend';
  row.className = 'fm-friend';
  row.hidden = true;
  const input = document.createElement('input');
  input.id = 'fmCode';
  input.placeholder = '輸入邀請碼';
  input.maxLength = 32;
  input.setAttribute('autocomplete', 'off');
  row.appendChild(input);
  row.appendChild(cornerMenuBtn('paste', '貼上'));
  row.appendChild(cornerMenuBtn('send', '送出'));
  menu.appendChild(row);
  const rb = document.getElementById('btnReport');
  if (rb && !rb.hidden) menu.appendChild(cornerMenuBtn('report', '📜 戰報／錄影'));
  menu.hidden = false;
}

function cornerMenuBtn(act, label) {
  const b = document.createElement('button');
  b.setAttribute('data-fm', act);
  b.textContent = label;
  return b;
}

function cornerFightClose() {
  const menu = document.getElementById('fightMenu');
  if (menu) menu.hidden = true;
}

function cornerToggleFight() {
  const menu = document.getElementById('fightMenu');
  if (!menu) return;
  if (menu.hidden) cornerFightOpen();
  else cornerFightClose();
}

function onFightMenuClick(e) {
  const b = e.target.closest('button');
  if (!b) return;
  const act = b.getAttribute('data-fm');
  if (act === 'rand') {
    cornerFightClose();
    if (typeof atk !== 'undefined' && atk.open && typeof atkClosePanel === 'function') atkClosePanel();
    else if (typeof atkOpenList === 'function') atkOpenList();
  } else if (act === 'friend') {
    const row = document.getElementById('fmFriend');
    if (row) row.hidden = !row.hidden;
  } else if (act === 'paste') {
    const input = document.getElementById('fmCode');
    try {
      navigator.clipboard.readText().then(t => { if (input) input.value = String(t).trim(); })
        .catch(() => showToast('無法讀取剪貼簿，請手動輸入'));
    } catch (err) {
      showToast('無法讀取剪貼簿，請手動輸入');
    }
  } else if (act === 'send') {
    const input = document.getElementById('fmCode');
    if (!input || !input.value.trim()) {
      showToast('請先輸入邀請碼');
      return;
    }
    showToast('朋友對戰即將開放');
  } else if (act === 'report') {
    cornerFightClose();
    const rb = document.getElementById('btnReport');
    if (rb) rb.click();
  }
}

// 🌤 季節與時段浮層:半透明、貼右下角、非全螢幕遮罩;季節沿用 stApplySeason(ui 的 selSeason change),時段沿用 ART_TOD 設定
const CORNER_SEASONS = [['auto', '自動'], ['spring', '春'], ['summer', '夏'], ['autumn', '秋'], ['winter', '冬']];
const CORNER_TODS = [['auto', '自動'], ['dawn', '早'], ['noon', '日'], ['dusk', '昏'], ['night', '夜']];

function cornerSeasonRender() {
  const pop = document.getElementById('seasonPop');
  if (!pop) return;
  pop.textContent = '';
  const tod = typeof stReadTodLock === 'function' ? stReadTodLock() : 'auto';
  const rowOf = (list, cur, kind) => {
    const row = document.createElement('div');
    row.className = 'sp-row';
    list.forEach(it => {
      const b = document.createElement('button');
      b.setAttribute('data-' + kind, it[0]);
      b.textContent = it[1];
      if (it[0] === cur) b.className = 'on';
      row.appendChild(b);
    });
    return row;
  };
  const seasonCur = (typeof settingsGet === 'function' && settingsGet().seasonMode === 'auto') ? 'auto' : (typeof currentSeason === 'string' ? currentSeason : '');
  pop.appendChild(rowOf(CORNER_SEASONS, seasonCur, 'season'));
  pop.appendChild(rowOf(CORNER_TODS, tod, 'tod'));
}

function onSeasonPopClick(e) {
  const b = e.target.closest('button');
  if (!b) return;
  const s = b.getAttribute('data-season');
  const t = b.getAttribute('data-tod');
  if (s === 'auto') {
    if (typeof settingsSet === 'function') settingsSet('seasonMode', 'auto');
    if (typeof stApplyAutoSeason === 'function') stApplyAutoSeason();
  } else if (s !== null) {
    if (typeof settingsSet === 'function') settingsSet('seasonMode', 'manual');
    if (typeof stApplySeason === 'function') stApplySeason(s);
  } else if (t !== null) {
    ART_TOD = t;
  }
  cornerSeasonRender();
}

function cornerSeasonOpen() {
  const pop = document.getElementById('seasonPop');
  if (!pop) return;
  cornerSeasonRender();
  pop.hidden = false;
}

function cornerSeasonClose() {
  const pop = document.getElementById('seasonPop');
  if (pop) pop.hidden = true;
}

function cornerSeasonToggle() {
  const pop = document.getElementById('seasonPop');
  if (!pop) return;
  if (pop.hidden) cornerSeasonOpen();
  else cornerSeasonClose();
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
  mapeditLabelsClear();
  toggleToolHelp(false);
  document.body.classList.toggle('camp-mode', to === 'camp');
  buildToolbar();
  setTool(null);
  updateResBar();
  updateBoardSwitch();
  mapeditUpdateDot();
  saveWorld();
  showToast('已切到' + (to === 'camp' ? '戰鬥布置' : '經營布置'));
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
  mapeditUpdateCap(cb);
  return r;
}

// 戰鬥陣所有建築的 BUILD_COMBAT cp(OBJECTS[type].cb.cp)加總
function campCpTotal(bd) {
  let sum = 0;
  ((bd && bd.objects) || []).forEach(o => {
    const d = OBJECTS[o.type];
    sum += (d && d.cb && d.cb.cp) || 0;
  });
  return sum;
}

// 陣地容量點:「陣地 N / 100」顯示在工具列上方;超過上限紅字。只在戰鬥布置模式顯示
function mapeditUpdateCap(cb) {
  const el = document.getElementById('campCap');
  if (!el) return;
  el.hidden = !(game.mode === 'battleDesign' && cb);
  if (el.hidden) return;
  const sum = campCpTotal(cb), max = CAMP_CP[CAMP_LV - 1];
  el.textContent = '陣地 ' + sum + ' / ' + max;
  el.classList.toggle('over', sum > max);
  el.style.bottom = (bottomStackPx() + 4) + 'px';
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
  if (t === 'aient') {
    if (phase === 'down') {
      mapeditRect = { t: t, x: x, y: y };
      return false;
    }
    const s = mapeditRect;
    mapeditRect = { t: null, x: 0, y: 0 };
    if (phase !== 'up' || s.t !== t) return false;
    const r = [Math.min(s.x, x), Math.min(s.y, y), Math.abs(s.x - x) + 1, Math.abs(s.y - y) + 1];
    m.aiEntry.push({ r: r, name: '入口' + (m.aiEntry.length + 1) });
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

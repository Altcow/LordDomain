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

// 戰鬥布置的頂層分類(底部列最左 #topSel):與經營共用 ui.js 的 buildTopToolbar / buildTopMenu / buildCatBar,資料來源為 CAMP_MENU。
// 頂層 → CAMP_GROUPS 群組:地形 = terr;戰陣建築 = build + wall;標記與部署 = mark;功能 = func。
// eraser:固定在最右、不計入清單的橡皮擦;exclude:不列入該頂層的項目;lock:顯示下一批解鎖的鎖頭提示
const CAMP_TOP_LIST = [
  { id: 'browse', kind: 'browse', icon: '✋', name: '瀏覽', short: '瀏覽' },
  { id: 'cterrain', kind: 'terrain', icon: '⛰', name: '地形', short: '地形', groups: ['terr'], exclude: ['erase'] },
  { id: 'cbuild', kind: 'build', icon: '🏯', name: '戰陣建築', short: '戰陣', groups: ['build', 'wall'], eraser: 'erase', lock: true },
  { id: 'cmark', kind: 'build', icon: '🚩', name: '標記與部署', short: '標記', groups: ['mark'], eraser: 'mErase' },
  { id: 'cfunc', kind: 'build', icon: '🛠', name: '功能', short: '功能', groups: ['func'] }
];

function campTopEntry(id) { return CAMP_TOP_LIST.find(t => t.id === id) || null; }

// 項目目前是否可列出(工具與地形工具恆可;物件須本級已開放且戰陣可放)
function campItemOk(id) {
  return !!(CAMP_TOOLS[id] || TERRAIN_TOOLS[id] || (OBJECTS[id] && sideOk(id)));
}

// 頂層 topId 在小分類 cat('all' 或群組 id)下的項目 id(不重複、不含固定橡皮擦)
function campMenuIds(cat, topId) {
  const top = campTopEntry(topId);
  if (!top || !top.groups) return [];
  const seen = {}, out = [];
  CAMP_GROUPS.forEach(g => {
    if (top.groups.indexOf(g.id) < 0 || (cat !== 'all' && cat !== g.id)) return;
    campGroupIds(g).forEach(id => {
      if (seen[id] || id === top.eraser || (top.exclude && top.exclude.indexOf(id) >= 0) || !campItemOk(id)) return;
      seen[id] = true;
      out.push(id);
    });
  });
  return out;
}

// 小分類 chips:全部 N 第一顆;頂層含多個群組時其後列各群組
function campCatList(topId) {
  const top = campTopEntry(topId);
  const out = [{ id: 'all', name: '全部', n: campMenuIds('all', topId).length }];
  if (top && top.groups && top.groups.length > 1) {
    top.groups.forEach(gid => {
      const g = CAMP_GROUPS.find(x => x.id === gid);
      if (g) out.push({ id: g.id, name: g.name, n: campMenuIds(g.id, topId).length });
    });
  }
  return out;
}

function campMenuAddItem(bar, id) {
  let btn = null;
  if (CAMP_TOOLS[id]) btn = addToolButton(bar, id, CAMP_TOOLS[id].icon, CAMP_TOOLS[id].name, null);
  else if (TERRAIN_TOOLS[id]) btn = addToolButton(bar, id, TERRAIN_TOOLS[id].icon, TERRAIN_TOOLS[id].name, null);
  else if (OBJECTS[id] && sideOk(id)) btn = addToolButton(bar, id, OBJECTS[id].icon, OBJECTS[id].name, OBJECTS[id]);
  if (btn && mapeditProgOn() && OBJECTS[id] && progSeenMark('camp', id)) mapeditNewDot(btn, id);
  return btn;
}

const CAMP_MENU = {
  list: CAMP_TOP_LIST,
  defTop: 'cbuild',
  getTop: function () { return ui.campTop; },
  setTop: function (v) { ui.campTop = v; },
  getCat: function () { return ui.campCat; },
  setCat: function (v) { ui.campCat = v; },
  catList: campCatList,
  ids: campMenuIds,
  terrainIds: function () { return campMenuIds('all', 'cterrain'); },
  addTerrain: campMenuAddItem,
  addItem: campMenuAddItem,
  lockHint: function (bar) {
    const t = campTopEntry(ui.campTop);
    if (t && t.lock && mapeditProgOn()) mapeditLockHint(bar);
  },
  eraser: function (topId) { const t = campTopEntry(topId); return t && t.eraser ? t.eraser : null; },
  owns: function (t, topId) {
    if (t === null || t === undefined) return true;
    const top = campTopEntry(topId);
    if (!top || !top.groups) return false;
    return top.eraser === t || campMenuIds('all', topId).indexOf(t) >= 0;
  }
};

// 戰鬥布置工具列:由 buildToolbar 呼叫(只在 game.mode === 'battleDesign');頂層選擇器與內容由 ui.js buildTopToolbar 以 CAMP_MENU 建出
function buildCampToolbar(bar) {
  buildTopToolbar(bar);
  mapeditUpdateCap(mapeditCampView());
}

// 草稿中的戰鬥草稿棋盤(world 載入的就是草稿);平常取使用中的戰陣
function mapeditCampView() {
  if (game.backup && game.backup.draft) return game.mode === 'battleDesign' ? liveBoard() : null;
  return campBoard();
}

// 城市等級未載入時不做任何解鎖相關的顯示(維持舊行為)
function mapeditProgOn() {
  return typeof prog !== 'undefined' && !!prog && typeof progUnlockLv === 'function' && typeof progSeenMark === 'function';
}

// 本級新開放的工具加紅點;點擊後記為已看過並移除紅點
function mapeditNewDot(btn, id) {
  const d = document.createElement('i');
  d.className = 'prog-dot';
  btn.appendChild(d);
  btn.addEventListener('click', () => {
    progSeenMark('camp', id, true);
    d.remove();
  });
}

// 下一個尚未開放的戰陣物件等級與其項目(只算戰陣用、未退役的物件);沒有則回 null
function mapeditNextLock() {
  let best = null, ids = [];
  Object.keys(PROG_UNLOCK_CAMP).forEach(k => {
    const lv = +k;
    if (lv <= prog.lv) return;
    const list = PROG_UNLOCK_CAMP[k].filter(id => OBJECTS[id] && !OBJECTS[id].retired && (sideOf(id) === 'camp' || sideOf(id) === 'both'));
    if (!list.length) return;
    if (best === null || lv < best) { best = lv; ids = list; }
  });
  return best === null ? null : { lv: best, ids: ids };
}

// 工具列尾端的灰階鎖頭提示鈕「🔒 +n 於 LvX」;點了以 toast 說明本級會開放什麼
function mapeditLockHint(bar) {
  const nx = mapeditNextLock();
  if (!nx) return;
  const names = nx.ids.map(id => OBJECTS[id].name).join('、');
  const b = document.createElement('button');
  b.className = 'tg-lock';
  b.title = '下一批解鎖:' + names;
  b.innerHTML = '<span class="ic">🔒</span> <span>+' + nx.ids.length + ' 於 Lv' + nx.lv + '</span>';
  b.style.opacity = '0.5';
  b.style.filter = 'grayscale(1)';
  b.addEventListener('click', () => {
    showToast('Lv' + nx.lv + ' 開放:' + names + '(升級後出現在工具列)');
  });
  bar.appendChild(b);
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

// 戰鬥布置的土地遮罩:放置(含多格建築的整個佔格)與地形 / 高度工具在土地外時,統一提示「超出城市土地範圍」,同一次拖曳只提示一次
const mapeditApplyToolBase = applyToolAt;
applyToolAt = function (x, y) {
  if (game.mode === 'battleDesign' && !pend.moving && mapeditOutsideLand(x, y)) {
    if (!gs.op || !gs.op.landWarn) {
      if (gs.op) gs.op.landWarn = true;
      showToast('超出城市土地範圍');
    }
    return false;
  }
  return mapeditApplyToolBase(x, y);
};

// 目前工具套在 (x,y) 時是否會超出土地(只看會受遮罩影響的工具:建築、道路 / 草地 / 湖 / 河、堆高 / 挖低)
function mapeditOutsideLand(x, y) {
  const t = ui.tool;
  if (t === null || t === 'erase' || isCampTool(t) || !progRulesOn()) return false;
  let w = 1, h = 1;
  if (OBJECTS[t]) {
    const f = footprint(t, ui.rot);
    w = f[0];
    h = f[1];
  } else if (!(t in TERRAIN_OF) && t !== 'raise' && t !== 'lower') {
    return false;
  }
  return !inLandRect(x, y, w, h);
}

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

  editBarBuild();
  slotPickBuild();
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && ldAnyOpen()) { ldCloseAll(); saveCtx = null; }
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
  mode.subEl = document.createElement('span');
  mode.subEl.className = 'sub';
  mode.appendChild(mode.icEl);
  mode.appendChild(mode.nmEl);
  mode.appendChild(mode.subEl);
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
    if (el) el.hidden = off || (id === 'modeBtn' && !!ui.editing);   // 草稿中不能切經營 / 戰鬥畫面
  });
  layoutPickSync();
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
  b.nmEl.textContent = camp ? '戰鬥' : '經營';
  if (b.subEl) b.subEl.textContent = '布置';
}

function cornerFightOpen() {
  const menu = document.getElementById('fightMenu');
  if (!menu) return;
  menu.textContent = '';
  menu.appendChild(cornerMenuBtn('rand', '🎲 隨機戰鬥', '打玩家:資源與經驗'));
  menu.appendChild(cornerMenuBtn('camp', '🏕 野營副本', '打野營:材料與經驗'));
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
  if (typeof rptCanOpen === 'function' && rptCanOpen()) menu.appendChild(cornerMenuBtn('report', '📜 戰報／錄影'));
  menu.hidden = false;
}

function cornerMenuBtn(act, label, sub) {
  const b = document.createElement('button');
  b.setAttribute('data-fm', act);
  b.textContent = label;
  if (sub) {
    const s = document.createElement('small');
    s.textContent = sub;
    b.appendChild(s);
  }
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
    if (typeof atk !== 'undefined' && atk.open && atk.view === 'pool' && typeof atkClosePanel === 'function') atkClosePanel();
    else if (typeof atkOpenPool === 'function') atkOpenPool();
    else if (typeof atkOpenList === 'function') atkOpenList();
  } else if (act === 'camp') {
    cornerFightClose();
    if (typeof atk !== 'undefined' && atk.open && atk.view === 'list' && typeof atkClosePanel === 'function') atkClosePanel();
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
    if (typeof rptOpen === 'function') rptOpen();
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
  if (to === 'camp' && typeof ui !== 'undefined' && ui.editing) {
    editGuard(() => setBoardMode(to));
    return;
  }
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
  const cb = mapeditCampView();
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
  const sum = campCpTotal(cb), max = campCpNow();
  const why = mapeditProgOn() && sum > max ? '(Lv' + prog.lv + ' 上限 ' + max + '，超出 ' + (sum - max) + ')' : '';
  let nWall = 0, nFence = 0;
  ((cb && cb.objects) || []).forEach(o => {
    if (o.type !== 'wall' && o.type !== 'lujiao') return;
    const fp = mioFp(o), n = fp[0] * fp[1];
    if (o.type === 'wall') nWall += n; else nFence += n;
  });
  const wMax = campCap('wall'), fMax = campCap('lujiao');
  const narrow = typeof window !== 'undefined' && window.innerWidth < 480;
  const wf = narrow ? '牆 ' + nWall + '/' + wMax + ' 柵 ' + nFence + '/' + fMax : '牆 ' + nWall + '/' + wMax + '・柵 ' + nFence + '/' + fMax;
  el.textContent = '陣地 ' + sum + ' / ' + max + why + (narrow ? ' ' : '  ') + wf;
  el.classList.toggle('over', sum > max || nWall > wMax || nFence > fMax);
  el.style.bottom = '';   // 位置由 CSS 的 top 決定;同時設 bottom 會把標籤拉成貫穿畫面的長條
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

// ═════ 草稿布置與版面存檔格(PLAN_LAYOUT §1~§2;資料函式見 map.js,草稿生命週期的 editEnter/editLeave 見 ui.js) ═════
// 草稿進行中:game.backup = 自己的兩個棋盤(使用中版面),且 game.backup.draft = { type, from, prevMode };world 載入的是草稿棋盤。
// 因此 saveWorld / 生產 / 教學簽名取到的都是使用中版面,草稿不會被寫進主存檔。

// ── 通用對話框(中央疊層,按鈕以 data-ld 註冊動作;內容一律 textContent) ──
function ldNew(id, title) {
  let d = document.getElementById(id);
  if (!d) {
    d = document.createElement('div');
    d.id = id;
    d.className = 'ldlg';
    d.hidden = true;
    document.body.appendChild(d);
    d.addEventListener('pointerdown', e => e.stopPropagation());
    d.addEventListener('click', e => {
      const b = e.target.closest('button');
      if (!b || b.disabled) return;
      const f = d._acts && d._acts[b.getAttribute('data-ld')];
      if (f) f();
    });
  }
  d._acts = {};
  d.textContent = '';
  const box = document.createElement('div');
  box.className = 'ld-box';
  const head = document.createElement('b');
  head.className = 'ld-head';
  head.textContent = title;
  box.appendChild(head);
  d.appendChild(box);
  d.hidden = false;
  return { d: d, box: box };
}
function ldMsg(h, text, cls) {
  const m = document.createElement('div');
  m.className = 'ld-msg' + (cls ? ' ' + cls : '');
  m.textContent = text;
  (h.body || h.box).appendChild(m);
  return m;
}
// 可捲動內容區:之後的 ldMsg / ldRow 都放進去,ld-foot / ld-opt 列固定在對話框底部
function ldBody(h) {
  const b = document.createElement('div');
  b.className = 'ld-body';
  h.box.appendChild(b);
  h.body = b;
  return b;
}
function ldRow(h, cls) {
  const r = document.createElement('div');
  r.className = 'ld-row' + (cls ? ' ' + cls : '');
  const fixed = /(^|\s)ld-(foot|opt)(\s|$)/.test(cls || '');
  (fixed ? h.box : (h.body || h.box)).appendChild(r);
  return r;
}
function ldBtn(h, parent, key, label, fn, cls, disabled, sub) {
  const b = document.createElement('button');
  b.setAttribute('data-ld', key);
  if (cls) b.className = cls;
  b.textContent = label;
  if (sub) {
    const s = document.createElement('small');
    s.textContent = sub;
    b.appendChild(s);
  }
  if (disabled) b.disabled = true;
  h.d._acts[key] = fn;
  parent.appendChild(b);
  return b;
}
function ldClose(id) {
  const d = document.getElementById(id);
  if (d) { d.hidden = true; d._acts = {}; }
}
function ldCloseAll() {
  ['draftStartDlg', 'saveSlotDlg', 'slotAskDlg', 'ldConfirm'].forEach(ldClose);
}
function ldOpen(id) {
  const d = document.getElementById(id);
  return !!d && !d.hidden;
}
function ldAnyOpen() {
  return ['draftStartDlg', 'saveSlotDlg', 'slotAskDlg', 'ldConfirm'].some(ldOpen);
}
function ldConfirm(title, msg, okLabel, onOk) {
  const h = ldNew('ldConfirm', title);
  ldMsg(h, msg);
  const foot = ldRow(h, 'ld-foot');
  ldBtn(h, foot, 'ok', okLabel || '確定', () => { ldClose('ldConfirm'); if (onOk) onOk(); }, 'pok');
  ldBtn(h, foot, 'no', '取消', () => ldClose('ldConfirm'), '');
}

function layoutTimeText(ts) {
  if (!ts) return '';
  const d = new Date(ts), p = n => (n < 10 ? '0' : '') + n;
  return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
}
function layoutSlotText(type, n) {
  const s = layoutSlot(type, n);
  if (!s) return '空';
  return layoutObjCount(s.board) + ' 件 · ' + layoutTimeText(s.savedAt);
}

// ── 草稿環境:進入 / 離開 ──
function draftIsOn() { return !!(game.backup && game.backup.draft); }

function draftEnvApply() {
  document.body.classList.toggle('camp-mode', game.mode === 'battleDesign');
  hideReset();
  toggleTplMenu(false);
  mapeditLabelsClear();
  toggleToolHelp(false);
  ui.objSel = null;
  objHold = null;
  mapeditUpdateDot();
  updateBoardSwitch();
}

// 離開草稿:收回使用中的棋盤、還原進入前的模式(editLeave 呼叫;沒有草稿環境時什麼都不做)
function draftEnvLeave() {
  const bk = game.backup;
  if (!bk || !bk.draft) return;
  const prev = bk.draft.prevMode;
  objHold = null;
  boardRestore();
  game.mode = prev === 'battleDesign' ? 'battleDesign' : 'estate';
  document.body.classList.toggle('camp-mode', game.mode === 'battleDesign');
  ui.objSel = null;
  pendClear();
  hideReset();
  mapeditLabelsClear();
  toggleToolHelp(false);
  buildToolbar();
  setTool(null);
  updateBoardSwitch();
  mapeditUpdateDot();
  updateResBar();
  if (typeof lifeReset === 'function') lifeReset();
  layoutPickSync(true);
}

// 開始草稿。src:已複製好的棋盤(來自使用中 / 格);tplId:範本;皆無 = 空白。unsaved:繼續上次草稿(視為有未存變更)
function draftBegin(type, from, src, tplId, unsaved) {
  if (type !== 'estate' && type !== 'camp') return false;
  if (ui.editing || game.backup) { showToast('目前無法進入草稿布置'); return false; }
  if (game.mode !== 'estate' && game.mode !== 'battleDesign') { showToast('目前無法進入草稿布置'); return false; }
  ldCloseAll();
  const prevMode = game.mode;
  draftDiscard();
  pendClear();
  hideReset();
  boardBackup();
  game.backup.draft = { type: type, from: from, prevMode: prevMode };
  world.board = type;
  game.mode = type === 'camp' ? 'battleDesign' : 'estate';
  let ok = true, tpl = null, r = null;
  if (src) {
    BOARD_KEYS.forEach(k => { world[k] = src[k]; });
    rebuildOcc();
  } else if (tplId) {
    tpl = TEMPLATES.find(t => t.id === tplId) || null;
    r = tpl ? applyTemplate(tplId) : null;
    ok = !!r;
  }
  if (!ok) {
    draftEnvLeave();
    showToast('範本無法載入到草稿');
    return false;
  }
  draftEnvApply();
  editEnter(!!unsaved);
  if (tpl && r && tpl.focus) centerOnCell(r.ox + tpl.focus[0], r.oy + tpl.focus[1]);
  mapeditRefresh();
  return true;
}

// from:'active' | 'slot:N' | 'tpl:id' | 'blank'
function draftBeginFrom(type, from) {
  let src = null;
  if (from === 'active') {
    src = layoutCopyBoard(layoutActiveBoard(type));
    if (!src) { showToast('沒有使用中的' + layoutTypeName(type) + '版面可載入'); return false; }
  } else if (from.indexOf('slot:') === 0) {
    const s = layoutSlot(type, +from.slice(5));
    src = s ? boardFromJSON(s.board) : null;
    if (!src) { showToast('該格是空的'); return false; }
  } else if (from.indexOf('tpl:') === 0) {
    const id = from.slice(4);
    const t = TEMPLATES.find(v => v.id === id);
    if (!t) { showToast('找不到範本'); return false; }
    return draftBegin(t.kind || 'estate', from, null, id, false);
  }
  return draftBegin(type, from, src, null, false);
}

function draftResume(saved) {
  const src = boardFromJSON(saved.board);
  if (!src) { draftStoreClear(); showToast('草稿暫存損壞,已清除'); return false; }
  return draftBegin(saved.type, saved.from, src, null, true);
}

// 側欄 🔨 / 範本載入入口。opt: { type, tpl }
function draftStartOpen(opt) {
  opt = opt || {};
  if (ui.editing) { showToast('已在草稿布置中'); return; }
  if (game.backup || (game.mode !== 'estate' && game.mode !== 'battleDesign')) { showToast('目前無法進入草稿布置'); return; }
  const st = { type: opt.type || (game.mode === 'battleDesign' ? 'camp' : 'estate'), tpl: opt.tpl || null, view: 'main' };
  const saved = draftRead();
  if (saved) draftResumeAsk(st, saved);
  else draftStartNext(st);
}

function draftStartNext(st) {
  if (st.tpl) draftBeginFrom(st.type, 'tpl:' + st.tpl);
  else draftStartRender(st);
}

function draftResumeAsk(st, saved) {
  const h = ldNew('draftStartDlg', '發現上次的草稿');
  ldMsg(h, layoutTypeName(saved.type) + '草稿 · ' + layoutObjCount(saved.board) + ' 件 · ' + layoutTimeText(saved.savedAt) + '。要繼續,還是重新開始?');
  const foot = ldRow(h, 'ld-foot ld-col');
  ldBtn(h, foot, 'resume', '繼續上次草稿', () => draftResume(saved), 'pok');
  ldBtn(h, foot, 'fresh', '重新開始', () => { draftStoreClear(); draftStartNext(st); }, 'pno');
  ldBtn(h, foot, 'cancel', '取消', () => ldClose('draftStartDlg'), '');
}

function draftStartRender(st) {
  const type = st.type;
  if (st.view === 'tpl') return draftTplRender(st);
  if (st.view === 'draw') return draftDrawRender(st);
  const h = ldNew('draftStartDlg', '📂 草稿從哪裡開始?');
  ldBody(h);
  const trow = ldRow(h, 'ld-seg ld-type');
  const tlab = document.createElement('span');
  tlab.className = 'ld-lab';
  tlab.textContent = '要設計:';
  trow.appendChild(tlab);
  [['estate', '🏘 經營'], ['camp', '⚔ 戰鬥']].forEach(a => {
    ldBtn(h, trow, 'type:' + a[0], a[1], () => { st.type = a[0]; draftStartRender(st); }, type === a[0] ? 'on' : '');
  });
  ldMsg(h, '選一份當起點,之後可以隨意修改,不會動到使用中的版面');
  const act = layoutActiveBoard(type);
  const col = ldRow(h, 'ld-col');
  ldBtn(h, col, 'active', '目前使用中的版面', () => draftBeginFrom(type, 'active'), '', !act,
    act ? (layoutObjCount(boardToJSON(act)) + ' 件' + (world.layoutActive[type] !== null ? '(格 ' + (world.layoutActive[type] + 1) + ')' : '')) : '尚未建立');
  ldMsg(h, '已存的版面 ▸', 'ld-sub');
  const slots = ldRow(h, 'ld-seg');
  for (let n = 0; n < LAYOUT_SLOTS; n++) {
    const s = layoutSlot(type, n);
    ldBtn(h, slots, 'slot:' + n, '格 ' + (n + 1), () => draftBeginFrom(type, 'slot:' + n), s ? '' : 'empty', !s, s ? layoutObjCount(s.board) + ' 件' : '空');
  }
  const more = ldRow(h, 'ld-seg');
  ldBtn(h, more, 'tpl', type === 'camp' ? '範本 / 推薦陣地…' : '範本…', () => { st.view = 'tpl'; draftStartRender(st); }, '');
  ldBtn(h, more, 'blank', '空白', () => draftBegin(type, 'blank', null, null, false), '');
  if (type === 'camp' && typeof progModDraw === 'function' && typeof PROGMOD_ARCH !== 'undefined') {
    ldBtn(h, ldRow(h, 'ld-seg'), 'draw', '🎴 抽 3 張推薦陣地', () => { st.view = 'draw'; st.drawN = 0; st.drawSeed = (Math.random() * 4294967296) >>> 0; draftStartRender(st); }, '');
  }
  const foot = ldRow(h, 'ld-foot');
  ldBtn(h, foot, 'cancel', '取消', () => ldClose('draftStartDlg'), '');
}

// 🎴 陣圖抽選卡(PLAN_PROGRESSION §5.2):依玩家等級從戰陣模塊庫(js/progmod.js)抽 3 張,選一張載入草稿;「換一批」無限次
const DRAFT_DIFF_NAMES = ['易', '中', '難'];
function draftDrawRender(st) {
  const lv = typeof progLv === 'function' ? progLv() : 1;
  const h = ldNew('draftStartDlg', '🎴 推薦陣地(Lv ' + lv + ')');
  ldBody(h);
  ldMsg(h, '依你的等級抽 3 張陣圖,選一張當草稿起點;不滿意可以無限次換一批。高於你等級的陣圖會以你的等級布置。');
  const col = ldRow(h, 'ld-col');
  progModDraw(lv, (st.drawSeed + st.drawN) >>> 0, 3).forEach(m => {
    const c = progModCard(m, lv);
    const tag = c.atLv < c.lv ? '(Lv ' + c.lv + ' 陣圖・以 Lv ' + c.atLv + ' 布置)' : '(Lv ' + c.lv + ')';
    ldBtn(h, col, 'mod:' + m.id, c.name + ' ・難度' + DRAFT_DIFF_NAMES[c.diff] + ' ' + tag, () => draftBeginMod(m, lv), '', false,
      c.desc + ' CP ' + c.cp + '/' + c.cap + ' ・ 塔 ' + c.towers + ' 座');
  });
  const foot = ldRow(h, 'ld-foot');
  ldBtn(h, foot, 'reroll', '🎴 換一批', () => { st.drawN++; draftStartRender(st); }, '');
  ldBtn(h, foot, 'back', '返回', () => { st.view = 'main'; draftStartRender(st); }, '');
}
function draftBeginMod(rec, lv) {
  const j = progModBoard(rec, progModAtLv(rec, lv));
  const src = j ? boardFromJSON(j) : null;
  if (!src) { showToast('這張陣圖無法載入'); return false; }
  return draftBegin('camp', 'mod:' + rec.id, src, null, false);
}

function draftTplRender(st) {
  const type = st.type;
  const h = ldNew('draftStartDlg', (type === 'camp' ? '推薦陣地 / 戰陣範本' : '經營範本') + '(載入到草稿)');
  const city = typeof tplCityLists === 'function' ? tplCityLists(type) : { my: 0, open: [], locked: [] };
  const cityAll = city.open.concat(city.locked);
  const cityIds = {};
  cityAll.forEach(t => { cityIds[t.id] = 1; });
  const list = TEMPLATES.filter(t => (t.kind || 'estate') === type && !t.hidden && !cityIds[t.id]);
  const ordered = list.filter(t => t.isDefault).concat(list.filter(t => !t.isDefault));
  const col = ldRow(h, 'ld-col ld-scroll');
  cityAll.forEach(t => {
    const lock = tplCityLv(t) > city.my;
    ldBtn(h, col, 'tpl:' + t.id, lock ? '🔒 Lv ' + tplCityLv(t) : t.name + (t.isDefault ? ' ★預設' : ''), () => draftBeginFrom(type, 'tpl:' + t.id), lock ? 'empty locked' : '', lock || t.w > MAP_W || t.h > MAP_H,
      lock ? '升到 Lv ' + tplCityLv(t) + ' 後可載入 ' + t.w + '×' + t.h : (t.desc || '') + ' ' + t.w + '×' + t.h);
  });
  ordered.forEach(t => {
    ldBtn(h, col, 'tpl:' + t.id, t.name + (t.isDefault ? ' ★預設' : ''), () => draftBeginFrom(type, 'tpl:' + t.id), '', t.w > MAP_W || t.h > MAP_H, (t.desc || '') + ' ' + t.w + '×' + t.h);
  });
  const foot = ldRow(h, 'ld-foot');
  ldBtn(h, foot, 'back', '返回', () => { st.view = 'main'; draftStartRender(st); }, '');
}

// ── #editBar:草稿進行中固定在左緣的直欄(💾 儲存 / 🗑 清空 / ↩ 放棄 / ✕ 離開) ──
function editBarBuild() {
  if (document.getElementById('editBar')) return;
  const bar = document.createElement('div');
  bar.id = 'editBar';
  bar.hidden = true;
  const tag = document.createElement('span');
  tag.className = 'eb-tag';
  bar.appendChild(tag);
  bar.tagEl = tag;
  [['save', '💾', '儲存'], ['clear', '🗑', '清空'], ['discard', '↩', '放棄'], ['leave', '✕', '離開']].forEach(a => {
    const b = document.createElement('button');
    b.setAttribute('data-eact', a[0]);
    b.setAttribute('aria-label', a[2]);
    b.title = a[2];
    const ic = document.createElement('span');
    ic.className = 'ic';
    ic.textContent = a[1];
    const lb = document.createElement('span');
    lb.className = 'lb';
    lb.textContent = a[2];
    b.appendChild(ic);
    b.appendChild(lb);
    bar.appendChild(b);
  });
  document.body.appendChild(bar);
  bar.addEventListener('pointerdown', e => e.stopPropagation());
  bar.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (b) editBarAct(b.getAttribute('data-eact'));
  });
}
function editBarAct(act) {
  if (!ui.editing) return;
  if (act === 'save') layoutSave();
  else if (act === 'clear') draftClearBoard();
  else if (act === 'discard') editCancel();
  else if (act === 'leave') {
    editGuard(null);
    if (!ui.editing) showToast('已離開草稿布置');
  }
}
function editBarSync() {
  const bar = document.getElementById('editBar');
  if (!bar) return;
  bar.hidden = !ui.editing;
  if (ui.editing && bar.tagEl && game.backup && game.backup.draft) {
    const t = '草稿·' + layoutTypeName(game.backup.draft.type);
    if (bar.tagEl.textContent !== t) bar.tagEl.textContent = t;
  }
}
// 🗑 清空草稿:只清草稿棋盤,不動使用中的版面、資源與科技
function draftClearBoard() {
  if (!ui.editing) return false;
  if (!confirm('清空草稿?草稿目前的內容會被清掉(使用中的版面與已存的格子不受影響)。' + pendWarnText())) return false;
  draftDiscard();
  pendClear();
  hideReset();
  clearBoard();
  ui.objSel = null;
  mapeditRefresh();
  mapeditUpdateDot();
  updateResBar();
  draftPersist(true);
  showToast('已清空草稿');
  return true;
}

// ── 儲存對話框 #saveSlotDlg ──
let saveCtx = null;
function saveSlotDlgOpen(after) {
  if (!ui.editing || !draftIsOn()) return false;
  saveCtx = { after: after || null, setActive: false, pick: -1 };
  saveSlotRender();
  return true;
}
function saveSlotRender() {
  const type = game.backup.draft.type;
  const h = ldNew('saveSlotDlg', '💾 儲存到哪一格?');
  ldBody(h);
  ldMsg(h, '覆蓋所選格子的內容(這份草稿是「' + layoutTypeName(type) + '」)');
  if (saveCtx.pick >= 0) {
    const n = saveCtx.pick, s = layoutSlot(type, n);
    ldMsg(h, '覆蓋「' + layoutTypeName(type) + ' ' + (n + 1) + '」?格內目前是「' + (s ? s.name : '') + '」(' + layoutSlotText(type, n) + '),覆蓋後無法復原。', 'warn');
    const foot = ldRow(h, 'ld-foot');
    ldBtn(h, foot, 'overwrite', '覆蓋', () => saveSlotCommit(n), 'pok');
    ldBtn(h, foot, 'back', '返回', () => { saveCtx.pick = -1; saveSlotRender(); }, '');
    return;
  }
  const t = type;
  for (let n = 0; n < LAYOUT_SLOTS; n++) {
    const row = ldRow(h, '');
    const act = world.layoutActive[t] === n;
    ldBtn(h, row, 'slot:' + t + ':' + n, layoutTypeName(t) + ' ' + (n + 1) + (act ? ' ★使用中' : ''), () => saveSlotPick(n), 'slot' + (layoutSlot(t, n) ? '' : ' empty'), false,
      layoutSlotText(t, n));
  }
  const forced = world.layoutActive[type] !== null && saveCtx.pick < 0;
  const tg = ldRow(h, 'ld-col ld-opt');
  ldBtn(h, tg, 'active', (saveCtx.setActive ? '☑' : '☐') + ' 同時設為使用中', () => { saveCtx.setActive = !saveCtx.setActive; saveSlotRender(); }, saveCtx.setActive ? 'on' : '', false,
    type === 'camp' ? '戰鬥版面會先驗證,不合格不會設為使用中' : (forced ? '存到使用中那一格時一律同步套用' : ''));
  const why = document.createElement('div');
  why.className = 'ld-msg ld-note';
  why.textContent = '設為使用中=' + (type === 'camp' ? '整個戰陣' : '整座城') + '立刻換成這份';
  tg.appendChild(why);
  const foot = ldRow(h, 'ld-foot');
  ldBtn(h, foot, 'cancel', '取消', () => { saveCtx = null; ldClose('saveSlotDlg'); }, '');
}
function saveSlotPick(n) {
  if (!saveCtx || !draftIsOn()) return;
  const type = game.backup.draft.type;
  if (layoutSlot(type, n)) { saveCtx.pick = n; saveSlotRender(); }
  else saveSlotCommit(n);
}
// 實際寫入第 n 格(同類型);回傳 { ok, activated, why }
function saveSlotCommit(n) {
  if (!saveCtx || !draftIsOn()) return null;
  const type = game.backup.draft.type;
  const want = saveCtx.setActive || world.layoutActive[type] === n;
  const bj = boardToJSON(liveBoard());
  let why = '';
  const copy = want ? layoutCopyBoard(liveBoard()) : null;
  if (want && type === 'camp') why = layoutCampCheck(copy);
  const res = { ok: true, activated: false, why: why };
  const fin = () => {
    layoutSlotWrite(type, n, bj);
    let msg = '已儲存到' + layoutTypeName(type) + ' ' + (n + 1);
    if (want && !why) {
      if (world.layoutActive[type] !== n) layoutWriteBack(type);
      layoutInstall(type, copy);
      world.layoutActive[type] = n;
      res.activated = true;
      msg += ',並設為使用中';
    } else if (want && why) {
      msg += ',但未設為使用中:' + why;
    } else if (type === 'camp' && world.layoutActive[type] === null) {
      msg += '(未設為使用中)';
    }
    editSnap = editSnapshot();
    editUnsaved = false;
    saveWorld();
    const after = saveCtx ? saveCtx.after : null;
    saveCtx = null;
    ldClose('saveSlotDlg');
    mapeditUpdateDot();
    layoutPickSync(true);
    showToast(msg);
    if (after) after();
  };
  if (want && !why && world.layoutActive[type] === null && world.layoutActive[type] !== n && boardHasContent(layoutActiveBoard(type))) {
    slotAskOpen(type, ok => { if (ok) fin(); });
  } else {
    fin();
  }
  return res;
}

// ── 目前使用中版面不屬於任何格時:問「存到哪一格 / 不存直接切換」 ──
function slotAskOpen(type, cb) {
  const h = ldNew('slotAskDlg', '目前的' + layoutTypeName(type) + '版面還沒存到格子');
  ldMsg(h, '要先把它存到哪一格?(切換後這份版面就會被換掉)');
  const col = ldRow(h, 'ld-col');
  for (let n = 0; n < LAYOUT_SLOTS; n++) {
    const s = layoutSlot(type, n);
    ldBtn(h, col, 'home:' + n, '存到 ' + layoutTypeName(type) + ' ' + (n + 1) + (s ? '(覆蓋)' : '(空)'), () => {
      const bd = layoutActiveBoard(type);
      if (bd) layoutSlotWrite(type, n, boardToJSON(bd));
      world.layoutActive[type] = n;
      ldClose('slotAskDlg');
      cb(true);
    }, 'slot' + (s ? '' : ' empty'), false, s ? layoutSlotText(type, n) : '');
  }
  const foot = ldRow(h, 'ld-foot');
  ldBtn(h, foot, 'skip', '不存,直接切換', () => { ldClose('slotAskDlg'); cb(true); }, 'pno');
  ldBtn(h, foot, 'cancel', '取消', () => { ldClose('slotAskDlg'); cb(false); }, '');
}

// ── 版面選擇小面板 #slotPop(右側邊欄第一個鈕「經營 / 戰鬥」開關;貼在邊欄左邊,切換格子後不自動關閉,只能再點該鈕關) ──
let slotPickSig = '';
let slotPopOn = false;
function slotPickType() { return game.mode === 'battleDesign' ? 'camp' : 'estate'; }
function slotPopIsOpen() { return slotPopOn; }
// 此畫面能不能用版面格(側欄按鈕是否顯示)
function slotPopAvail() {
  return !(cornerHidden() || (game.backup && !ui.editing) || (game.mode !== 'estate' && game.mode !== 'battleDesign'));
}
function slotPopToggle() {
  if (!slotPopAvail()) { slotPopOn = false; layoutPickSync(true); return false; }
  slotPopOn = !slotPopOn;
  layoutPickSync(true);
  if (typeof syncSideBar === 'function') syncSideBar();
  return slotPopOn;
}
function slotPickBuild() {
  if (document.getElementById('slotPop')) return;
  const box = document.createElement('div');
  box.id = 'slotPop';
  box.hidden = true;
  const note = document.createElement('div');
  note.className = 'sp-note';
  note.hidden = true;
  note.textContent = '草稿編輯中,離開後再切換';
  box.appendChild(note);
  box.noteEl = note;
  for (let n = 0; n < LAYOUT_SLOTS; n++) {
    const b = document.createElement('button');
    b.setAttribute('data-slot', String(n));
    b.className = 'sp-btn';
    const a = document.createElement('span');
    a.className = 'sp-a';
    const c = document.createElement('span');
    c.className = 'sp-b';
    b.appendChild(a);
    b.appendChild(c);
    box.appendChild(b);
  }
  document.body.appendChild(box);
  box.addEventListener('pointerdown', e => e.stopPropagation());
  box.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (b) layoutPickClick(+b.getAttribute('data-slot'));
  });
}
function layoutPickSync(force) {
  const box = document.getElementById('slotPop');
  if (!box) return;
  if (!slotPopAvail()) slotPopOn = false;
  const off = !slotPopOn;
  if (box.hidden !== off) box.hidden = off;
  if (off) return;
  const type = slotPickType();
  const act = world.layoutActive[type];
  const lock = !!ui.editing;
  const sig = type + '|' + act + '|' + (lock ? 1 : 0) + '|' + [0, 1, 2].map(n => { const s = layoutSlot(type, n); return s ? s.name + ':' + layoutObjCount(s.board) : ''; }).join(',');
  if (sig === slotPickSig && !force) return;
  slotPickSig = sig;
  box.setAttribute('data-type', type);
  box.classList.toggle('locked', lock);
  box.noteEl.hidden = !lock;
  box.querySelectorAll('button').forEach(b => {
    const n = +b.getAttribute('data-slot'), s = layoutSlot(type, n);
    b.querySelector('.sp-a').textContent = (n + 1) + ' ' + (s ? (s.name || '版面') : '空');
    b.querySelector('.sp-b').textContent = s ? layoutObjCount(s.board) + ' 件' + (act === n ? ' · 使用中' : '') : '空格';
    b.classList.toggle('on', act === n);
    b.classList.toggle('empty', !s);
    b.classList.toggle('off', lock);
    b.setAttribute('aria-disabled', lock ? 'true' : 'false');
    b.title = layoutTypeName(type) + '格 ' + (n + 1) + (s ? '(' + layoutSlotText(type, n) + ')' : '(空)') + (act === n ? ' 使用中' : '');
    b.setAttribute('aria-label', b.title);
  });
}

function layoutAfterSwitch(type, n) {
  draftDiscard();
  pendClear();
  hideReset();
  ui.objSel = null;
  objHold = null;
  if (typeof lifeReset === 'function') lifeReset();
  mapeditRefresh();
  mapeditUpdateDot();
  updateResBar();
  layoutPickSync(true);
  showToast('已切換到' + layoutTypeName(type) + '格 ' + (n + 1));
}

// 點選擇器第 n 格:使用中 = 提示;空格 = 問是否把目前版面存到該格;有內容 = 切換(必要時先問存到哪一格)
function layoutPickClick(n) {
  if (ui.editing) { showToast('草稿編輯中,離開後再切換'); return null; }
  if (game.backup) return null;
  if (game.mode !== 'estate' && game.mode !== 'battleDesign') return null;
  const type = slotPickType();
  const act = world.layoutActive[type];
  if (act === n) { showToast('目前使用中:' + layoutTypeName(type) + '格 ' + (n + 1)); return null; }
  const s = layoutSlot(type, n);
  if (!s) {
    ldConfirm('格 ' + (n + 1) + ' 是空的', '要把目前的' + layoutTypeName(type) + '版面存到這一格嗎?(存完這一格就是使用中)', '存到這一格', () => layoutPickFill(type, n));
    return 'empty';
  }
  if (type === 'camp') {
    const bd = boardFromJSON(s.board);
    const why = bd ? layoutCampCheck(bd) : '資料損壞';
    if (why) { showToast('無法設為使用中:' + why); return 'blocked'; }
  }
  slotEnsureHome(type, () => {
    const r = layoutActivate(type, n);
    if (!r.ok) showToast('無法切換:' + r.reason);
    else layoutAfterSwitch(type, n);
  });
  return 'switch';
}
function layoutPickFill(type, n) {
  if (world.layoutActive[type] !== null) layoutWriteBack(type);
  const bd = layoutActiveBoard(type);
  if (!bd) { showToast('目前沒有可存的版面'); return; }
  layoutSlotWrite(type, n, boardToJSON(bd));
  world.layoutActive[type] = n;
  saveWorld();
  layoutPickSync(true);
  showToast('已把目前版面存到' + layoutTypeName(type) + '格 ' + (n + 1));
}
function slotEnsureHome(type, cont) {
  const cur = layoutActiveBoard(type);
  if (world.layoutActive[type] !== null || !boardHasContent(cur)) { cont(); return; }
  slotAskOpen(type, ok => { if (ok) cont(); });
}

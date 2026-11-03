// js/guide.js — 新手指引教學:功能第一次開放(或第一次進到該畫面)時,以聚光孔 + 說明氣泡「引導一次」。
// 與新手任務(progui.js 的任務條 / 任務清單)是不同系統,互不影響;狀態存 localStorage 'lorddomain.guide.v1' = {seen:{主題id:1}, off:0/1}。
// 主題一律寫在下面 GUIDE_TOPICS(日後新增功能的教學只要加一項)。開放等級不寫死:feat 對應 PROG_UNLOCK_FEATURE,等級由 progUnlockLv 取。
// 全域名稱:GUIDE_TOPICS guidePlay guideQueue guideTick guideSkip guideActive guideOff guideSetOff guideReset guideListOpen guideListClose guideTopicLv;其餘內部一律 gd / gdXxx。
// UI 層檔案,可使用 Date.now / setInterval(不碰模擬層)。

var GUIDE_KEY = 'lorddomain.guide.v1';
var GUIDE_DELAY_MS = 1200;   // 啟動後等待畫面穩定再開始自動引導
var GUIDE_AUTO_MAX = 2;      // 同一等級、同一畫面下最多自動播幾個主題(升級或換畫面會重新計)
var GUIDE_TICK_MS = 1000;

// target:CSS 選擇器、選擇器陣列(取第一個看得到的)、或函式(回傳元素);null = 沒有特定目標(整個畫面,氣泡避開中央)。
// text:字串或函式。mode:'estate' 經營 | 'camp' 戰鬥布置 | 'any' 兩者皆可 | 'attack' 出征戰鬥中。feat:對應 isUnlocked('feature', feat),null = 一開始就有。
var GUIDE_TOPICS = [
  { id: 'welcome', title: '歡迎,城主', feat: null, mode: 'any', steps: [
    { target: '#progChip', text: '這是城市等級。點它可以看升級要什麼,升級後會開放新建築和新玩法。' },
    { target: '#resbar', text: '這排是你的資源。蓋建築要花資源,有些建築會自己生產。' }
  ] },
  { id: 'build', title: '蓋建築', feat: null, mode: 'estate', steps: [
    { target: '#topSel', text: '先在這裡選分類,決定要蓋哪一類東西。' },
    { target: '#toolbar', text: '再點下面的圖示選一棟建築。' },
    { target: null, text: '然後在地圖空地點一下,會出現半透明虛影;可以拖到想要的位置,按 ✓ 才真的蓋下去,按 ✕ 取消。' }
  ] },
  { id: 'moveedit', title: '移動與編輯建築', feat: null, mode: 'estate', steps: [
    { target: null, text: '要移動蓋好的建築:在它身上按住不放約半秒,它會被拿起來,拖到新位置放開就落地。' },
    { target: null, text: '按住後不拖、直接放開,會出現 ↻ 旋轉、🗑 拆除、✓ 確定 的小按鈕。' },
    { target: null, text: '拖曳空地可以平移地圖,兩指捏合可以縮放。' }
  ] },
  { id: 'sidebar', title: '右側按鈕列', feat: null, mode: 'estate', steps: [
    { target: ['#sideBar [data-px="slots"]', '#sideMore'], text: '這顆是版面選擇:可以存 3 份經營布置,點一格就換成那份。' },
    { target: '#sideBar [data-px="quest"]', text: '任務:打開任務清單,看現在該做什麼。' },
    { target: '#sideBar [data-px="edit"]', text: '布置:另開一份草稿慢慢設計,不影響正在用的城。' },
    { target: '#sideBar [data-px="shop"]', text: '商店:在這裡買東西。' },
    { target: '#sideBar [data-px="mode"]', text: '精簡:把介面縮小,讓畫面更大。' }
  ] },
  { id: 'draft', title: '布置草稿與存檔', feat: null, mode: 'estate', steps: [
    { target: '#sideBar [data-px="edit"]', text: '點 🔨 布置進入草稿:在草稿裡隨便改,正在用的城不會變。' },
    { target: '#sideBar [data-px="save"]', text: function () { return gdCity() ? '改好按 💾 存檔,選一格存進去。經營布置有 3 格,存好的版面可隨時切換。' : '改好按 💾 存檔,選一格存進去。經營和戰鬥布置各有 3 格,存好的版面可隨時切換。'; } }
  ] },
  { id: 'camp', title: '戰鬥布置', feat: 'battleDesign', mode: 'camp', steps: [
    { target: '#modeBtn', text: '左下這顆可以切換「經營布置」和「戰鬥布置」。你現在在戰鬥布置,這裡設計的是被攻打時的防守陣。' },
    { target: '#topSel', text: '戰鬥布置要用的東西從這一排分類選。' },
    { target: '#campCap', text: '上面這個標籤是戰陣容量,放太多會變紅,要拆掉一些才行。' }
  ] },
  { id: 'attack', title: '出征', feat: 'npc', mode: 'any', steps: [
    { target: '#btnAttack', text: '左下的 ⚔ 出征:點開可以打野營副本。' },
    { target: '#btnAttack', text: function () { return '隨機戰鬥是跟別人的領地對打' + gdLvText('random') + ';野營副本是固定關卡,打贏可以累積升級用的材料。'; } }
  ] },
  { id: 'battle', title: '戰鬥中的操作', feat: null, mode: 'attack', steps: [
    { target: '.ustrip', text: '下面是兵種列:點一個選兵種;長按兵種可以看它的說明。' },
    { target: null, text: '選好後在地圖上點一下就放兵,按住不放可以連續放。' },
    { target: '#atkCtl', text: '上面可以暫停、調整速度,也可以提早結束戰鬥。' }
  ] },
  { id: 'upgrade', title: '升級與材料', feat: 'upgrade', mode: 'any', steps: [
    { target: '#progChip', text: '點 Lv 晶片打開升級抽屜,會列出升級需要的資源、材料與經驗。' },
    { target: '#progChip', text: function () { return gdCity() ? '經驗靠蓋出新種類的建築、擴大城市規模累積;資源與經驗都夠就能按升級。' : '部分材料要打野營副本(首領營、難營)才拿得到;條件都達成才能按升級。'; } }
  ] },
  { id: 'photo', title: '拍照模式', feat: 'photo', mode: 'estate', steps: [
    { target: ['#sideBar [data-px="photo"]', '#sideMore'], text: '拍照模式會隱藏所有介面方便截圖,畫面上只留一顆還原鈕。' }
  ] },
  { id: 'recorder', title: '錄影', feat: 'recorder', mode: 'estate', steps: [
    { target: '#btnMenu', text: '想把領地錄下來:點 ⚙ 設定,在「拍攝」區找「🎬 拍攝錄影」。' },
    { target: '#btnMenu', text: '錄影面板可選運鏡:手動運鏡自己拖曳(速度會自動限制,不會滑太快)、路徑導覽照路點飛行。iPhone 建議選「運鏡模式」,再用系統螢幕錄影來錄。' }
  ] },
  { id: 'shop', title: '商店', feat: 'shop', mode: 'estate', steps: [
    { target: ['#sideBar [data-px="shop"]', '#btnShop', '#sideMore'], text: '商店開放了:可以買建築與道具,每日特賣會換品項。' }
  ] },
  { id: 'fishing', title: '釣魚', feat: 'fishing', mode: 'estate', steps: [
    { target: ['#sideBar [data-px="fish"]', '#btnFish', '#sideMore'], text: '釣魚開放了:點這裡進入釣魚小遊戲。' }
  ] },
  { id: 'pet', title: '仙獸苑', feat: 'pet', mode: 'estate', steps: [
    { target: ['#sideBar [data-px="pet"]', '#btnPet', '#sideMore'], text: '仙獸苑開放了:點這裡去看你的仙獸。' }
  ] },
  { id: 'friend', title: '友人對戰', feat: 'friend', mode: 'any', steps: [
    { target: '#btnAttack', text: '朋友戰帖開放了:點 ⚔ 出征,在選單裡輸入朋友的代碼就能對戰。' }
  ] }
];

var gd = {
  st: null, t0: 0, timer: 0, active: null, auto: 0, key: '',
  root: null, hole: null, bubble: null, head: null, prog: null, txt: null, nextBtn: null, skip: null,
  list: null, listBody: null, listFoot: null
};

function gdEl(tag, cls, txt) {
  var e = document.createElement(tag);
  if (cls) e.className = cls;
  if (txt !== undefined && txt !== null) e.textContent = txt;
  return e;
}

function gdToast(m) { if (typeof showToast === 'function') showToast(m); }

// ───────── 狀態(localStorage 失敗時只留記憶體) ─────────
function gdLoad() {
  var raw = null, j;
  if (gd.st) return gd.st;
  gd.st = { seen: {}, off: 0 };
  try { raw = localStorage.getItem(GUIDE_KEY); } catch (e) { raw = null; }
  if (raw) {
    try {
      j = JSON.parse(raw);
      if (j && typeof j === 'object') {
        if (j.seen && typeof j.seen === 'object') Object.keys(j.seen).forEach(function (k) { if (j.seen[k]) gd.st.seen[k] = 1; });
        gd.st.off = j.off ? 1 : 0;
      }
    } catch (e2) { gd.st = { seen: {}, off: 0 }; }
  }
  return gd.st;
}

function gdSave() {
  try { localStorage.setItem(GUIDE_KEY, JSON.stringify(gd.st)); } catch (e) { /* 寫入失敗:本次 session 靠記憶體 */ }
}

function guideOff() { return !!gdLoad().off; }

function guideSetOff(v) {
  gdLoad().off = v ? 1 : 0;
  gdSave();
}

function guideReset() {
  var s = gdLoad();
  s.seen = {};
  s.off = 0;
  gdSave();
  gd.auto = 0;
}

// 測試用:丟掉記憶體狀態,下次重新從 localStorage 讀
function guideReload() { gd.st = null; return gdLoad(); }

function gdTopic(id) {
  var i;
  for (i = 0; i < GUIDE_TOPICS.length; i++) if (GUIDE_TOPICS[i].id === id) return GUIDE_TOPICS[i];
  return null;
}

function gdCity() { return typeof isCityOnly === 'function' && isCityOnly(); }

// 城建專注模式下隱藏的主題:戰鬥布置畫面、出征戰鬥中,以及 feat 被 cityOnlyHides 隱藏者(camp / attack / battle / friend / fishing / pet 等)
function gdCityHidden(t) {
  if (!gdCity()) return false;
  if (t.mode === 'camp' || t.mode === 'attack') return true;
  return !!t.feat && typeof cityOnlyHides === 'function' && cityOnlyHides(t.feat);
}

function gdFeatOpen(feat) {
  if (!feat) return true;
  if (typeof isUnlocked !== 'function') return true;
  return !!isUnlocked('feature', feat);
}

// 主題的開放等級(feat 為 null 回 1;查不到回 null)
function guideTopicLv(t) {
  var L;
  if (typeof t === 'string') t = gdTopic(t);
  if (!t) return null;
  if (!t.feat) return 1;
  if (typeof progUnlockLv !== 'function') return 1;
  L = progUnlockLv('feature', t.feat);
  return L === null || L === undefined ? 1 : L;
}

function gdLvText(feat) {
  var L = typeof progUnlockLv === 'function' ? progUnlockLv('feature', feat) : null;
  return L ? '(Lv' + L + ' 開放)' : '';
}

function gdModeOk(mode) {
  var m = (typeof game !== 'undefined' && game) ? game.mode : 'estate';
  if (mode === 'estate') return m === 'estate';
  if (mode === 'camp') return m === 'battleDesign';
  if (mode === 'attack') return m === 'attack';
  return m === 'estate' || m === 'battleDesign';
}

// 目前畫面「已開放、未看過」的主題 id(依 GUIDE_TOPICS 順序)
function guideQueue() {
  var s = gdLoad(), out = [];
  GUIDE_TOPICS.forEach(function (t) {
    if (s.seen[t.id]) return;
    if (!gdFeatOpen(t.feat) || !gdModeOk(t.mode) || gdCityHidden(t)) return;
    out.push(t.id);
  });
  return out;
}

// ───────── 目標解析 ─────────
function gdQuery(sel) {
  try { return document.querySelector ? document.querySelector(sel) : null; } catch (e) { return null; }
}

function gdVisRect(el) {
  var r, vw, vh;
  if (!el || el.hidden || typeof el.getBoundingClientRect !== 'function') return null;
  r = el.getBoundingClientRect();
  if (!r || !(r.width > 0) || !(r.height > 0)) return null;
  vw = gdVw(); vh = gdVh();
  if (r.right <= 0 || r.bottom <= 0 || r.left >= vw || r.top >= vh) return null;
  return r;
}

function gdVw() { return (typeof innerWidth === 'number' && innerWidth) || 375; }
function gdVh() { return (typeof innerHeight === 'number' && innerHeight) || 812; }

// 回傳 {found:bool, rect:r|null}:target 為 null 視為找到(無聚光孔)
function gdResolve(step) {
  var t = step.target, list, i, el, r;
  if (t === null || t === undefined) return { found: true, rect: null };
  if (typeof t === 'function') {
    try { el = t(); } catch (e) { el = null; }
    r = gdVisRect(el);
    return r ? { found: true, rect: r } : { found: false, rect: null };
  }
  list = Array.isArray(t) ? t : [t];
  for (i = 0; i < list.length; i++) {
    r = gdVisRect(gdQuery(list[i]));
    if (r) return { found: true, rect: r };
  }
  return { found: false, rect: null };
}

// ───────── 氣泡位置 ─────────
function gdOverlap(a, b) {
  var w = Math.min(a.r, b.r) - Math.max(a.l, b.l), h = Math.min(a.b, b.b) - Math.max(a.t, b.t);
  return w > 0 && h > 0 ? w * h : 0;
}

// 在 viewport 內挑一個不蓋中央(25–75% × 20–80%)、不蓋目標、不蓋跳過鈕的位置;可選三種寬度
function guideLayout(vw, vh, bh, rect, widths) {
  var center = { l: vw * 0.25, r: vw * 0.75, t: vh * 0.2, b: vh * 0.8 };
  var skip = { l: vw / 2 - 70, r: vw / 2 + 70, t: vh - 76, b: vh };
  var tgt = rect ? { l: rect.left - 6, r: rect.right + 6, t: rect.top - 6, b: rect.bottom + 6 } : null;
  var best = null, m = 6;
  widths.forEach(function (w, wi) {
    var h = bh(w), xs = [m, (vw - w) / 2, vw - w - m], ys = [m, (vh - h) / 2, vh - h - 80], cands = [], tcx, tcy;
    xs.forEach(function (x) { ys.forEach(function (y) { cands.push([x, y]); }); });
    if (rect) {
      tcx = (rect.left + rect.right) / 2 - w / 2;
      tcy = (rect.top + rect.bottom) / 2 - h / 2;
      cands.push([tcx, rect.top - h - 12], [tcx, rect.bottom + 12], [rect.left - w - 12, tcy], [rect.right + 12, tcy]);
    }
    cands.forEach(function (c) {
      var x = Math.max(m, Math.min(vw - w - m, c[0])), y = Math.max(m, Math.min(vh - h - m, c[1]));
      var box = { l: x, r: x + w, t: y, b: y + h };
      var score = gdOverlap(box, center) * 4 + gdOverlap(box, skip) * 8 + (tgt ? gdOverlap(box, tgt) * 8 : 0) + wi * 200;
      if (tgt) score += (Math.abs(x + w / 2 - (rect.left + rect.right) / 2) + Math.abs(y + h / 2 - (rect.top + rect.bottom) / 2)) * 0.02;
      if (!best || score < best.score) best = { x: x, y: y, w: w, h: h, score: score };
    });
  });
  return best;
}

// ───────── DOM ─────────
function gdBuild() {
  if (gd.root || typeof document === 'undefined' || !document.body) return;
  gd.root = gdEl('div');
  gd.root.id = 'guideRoot';
  gd.root.hidden = true;
  gd.hole = gdEl('div');
  gd.hole.id = 'guideHole';
  gd.bubble = gdEl('div');
  gd.bubble.id = 'guideBubble';
  gd.bubble.setAttribute('role', 'dialog');
  gd.head = gdEl('b', 'gd-title', '');
  gd.prog = gdEl('span', 'gd-prog', '');
  gd.txt = gdEl('div', 'gd-text', '');
  gd.nextBtn = gdEl('button', 'gd-next', '下一步');
  gd.nextBtn.addEventListener('click', function (ev) { if (ev && ev.stopPropagation) ev.stopPropagation(); gdNext(); });
  var top = gdEl('div', 'gd-top');
  top.appendChild(gd.head);
  top.appendChild(gd.prog);
  gd.prog.style.flex = '1';
  top.appendChild(gd.nextBtn);
  gd.bubble.appendChild(top);
  gd.bubble.appendChild(gd.txt);
  gd.bubble.addEventListener('click', function (ev) { if (ev && ev.stopPropagation) ev.stopPropagation(); });
  gd.root.appendChild(gd.hole);
  gd.root.appendChild(gd.bubble);
  gd.root.addEventListener('click', function () { gdNext(); });
  document.body.appendChild(gd.root);
  gd.skip = gdEl('button', '', '跳過引導');
  gd.skip.id = 'guideSkip';
  gd.skip.hidden = true;
  gd.skip.addEventListener('click', function (ev) { if (ev && ev.stopPropagation) ev.stopPropagation(); guideSkip(); });
  document.body.appendChild(gd.skip);
  if (typeof window !== 'undefined' && window.addEventListener) window.addEventListener('resize', function () { if (gd.active) gdRender(); });
}

function guideActive() { return gd.active ? gd.active.id : ''; }

function gdShowUi(on) {
  gdBuild();
  if (!gd.root) return;
  gd.root.hidden = !on;
  gd.skip.hidden = !on;
  if (document.body && document.body.classList) document.body.classList.toggle('guide-on', !!on);
}

function gdStepText(step) {
  var s = step.text;
  if (typeof s === 'function') { try { s = s(); } catch (e) { s = ''; } }
  return String(s || '');
}

// 從 idx 起找第一個看得到目標的步驟;沒有回 -1
function gdFindFrom(idx) {
  var a = gd.active, i, r;
  for (i = idx; i < a.topic.steps.length; i++) {
    r = gdResolve(a.topic.steps[i]);
    if (r.found) { a.rect = r.rect; return i; }
  }
  return -1;
}

function gdRender() {
  var a = gd.active, step, vw, vh, pos, n, last, hr, w;
  if (!a) return;
  n = gdFindFrom(a.idx);
  if (n < 0) { gdFinish(true); return; }
  a.idx = n;
  step = a.topic.steps[n];
  last = gdFindFrom(n + 1) < 0;
  gd.active.rect = gdResolve(step).rect;
  gd.head.textContent = a.topic.title;
  gd.prog.textContent = (n + 1) + '/' + a.topic.steps.length;
  gd.txt.textContent = gdStepText(step);
  gd.nextBtn.textContent = last ? '知道了' : '下一步';
  vw = gdVw(); vh = gdVh();
  hr = a.rect;
  if (hr) {
    gd.hole.hidden = false;
    gd.hole.style.left = (hr.left - 4) + 'px';
    gd.hole.style.top = (hr.top - 4) + 'px';
    gd.hole.style.width = (hr.width + 8) + 'px';
    gd.hole.style.height = (hr.height + 8) + 'px';
    gd.root.classList.remove('nohole');
  } else {
    gd.hole.hidden = true;
    gd.root.classList.add('nohole');
  }
  pos = guideLayout(vw, vh, function (ww) {
    var h;
    gd.bubble.style.width = ww + 'px';
    h = gd.bubble.offsetHeight;
    return h > 0 ? h : 60 + Math.ceil(gd.txt.textContent.length * 13 / Math.max(60, ww - 24)) * 19;
  }, hr, [Math.min(300, vw - 16), Math.min(240, vw - 16), Math.min(190, vw - 16)]);
  w = pos.w;
  gd.bubble.style.width = w + 'px';
  gd.bubble.style.left = Math.round(pos.x) + 'px';
  gd.bubble.style.top = Math.round(pos.y) + 'px';
}

function gdNext() {
  var a = gd.active, n;
  if (!a) return;
  n = gdFindFrom(a.idx + 1);
  if (n < 0) { gdFinish(false); return; }
  a.idx = n;
  gdRender();
}

// 關閉引導;自動播的主題結束(含全找不到)才標 seen,手動重看不改狀態
function gdFinish(silent) {
  var a = gd.active;
  gd.active = null;
  gdShowUi(false);
  if (a && !a.manual) {
    gdLoad().seen[a.topic.id] = 1;
    gdSave();
  }
  return silent;
}

function gdStart(t, manual) {
  var n;
  gdBuild();
  if (!gd.root || gd.active) return false;
  gd.active = { id: t.id, topic: t, idx: 0, manual: !!manual, rect: null };
  n = gdFindFrom(0);
  if (n < 0) { gd.active = null; return false; }
  gdShowUi(true);
  gd.active.idx = n;
  gdRender();
  return true;
}

// 手動播放(設定→功能說明的「示範」);不看 seen / off,也不改它們
function guidePlay(id) {
  var t = gdTopic(id);
  if (!t) return false;
  if (gd.active) gdFinish(true);
  return gdStart(t, true);
}

// 跳過鈕:自動引導 → 寫 off=1 並把全部主題標已看;手動示範 → 只關閉
function guideSkip() {
  var a = gd.active, s;
  if (!a) return;
  if (a.manual) { gd.active = null; gdShowUi(false); return; }
  s = gdLoad();
  s.off = 1;
  GUIDE_TOPICS.forEach(function (t) { s.seen[t.id] = 1; });
  gdSave();
  gd.active = null;
  gdShowUi(false);
  gdToast('已跳過引導。想再看可到 ⚙ 設定 → 功能說明');
}

// ───────── 自動觸發 ─────────
function gdVisId(id) {
  var el = document.getElementById ? document.getElementById(id) : null;
  return !!el && !el.hidden;
}

// 有對話框 / 面板開著、或拍照 / 沙盤中,先不要插播
function gdBusy() {
  var b = document.body, st, inAtk = typeof game !== 'undefined' && game && game.mode === 'attack';
  if (b && b.classList && (b.classList.contains('photo-mode') || b.classList.contains('sandbox'))) return true;
  st = document.getElementById ? document.getElementById('stRoot') : null;
  if (st && st.classList && st.classList.contains('st-open')) return true;
  return ['progDrawer', 'questList', 'shop', 'tplMenu', 'techPanel', 'unitDex', 'unitCard', 'settleDlg', 'leaveDlg', 'fightMenu', 'slotPop', 'guideList']
    .concat(inAtk ? [] : ['atkPanel']).some(gdVisId);
}

function gdReady() {
  if (typeof prog === 'undefined' || !prog || typeof progLv !== 'function') return false;
  if (typeof progNeedsMigrate === 'function' && progNeedsMigrate()) return false;
  if (typeof game === 'undefined' || !game) return false;
  if (typeof battle !== 'undefined' && battle && game.mode !== 'attack') return false;
  if (typeof game.backup !== 'undefined' && game.backup && game.mode !== 'attack') return false;
  if (game.mode === 'attack' && !(game.phase === 'scout' || game.phase === 'march')) return false;
  return true;
}

function guideTick() {
  var key, q, i, t, now = Date.now();
  if (gd.active || guideOff() || !gdReady()) return;
  if (!gd.t0) gd.t0 = now;
  if (now - gd.t0 < GUIDE_DELAY_MS) return;
  if (gdBusy()) return;
  key = progLv() + '|' + game.mode;
  if (key !== gd.key) { gd.key = key; gd.auto = 0; }
  if (gd.auto >= GUIDE_AUTO_MAX) return;
  q = guideQueue();
  for (i = 0; i < q.length; i++) {
    t = gdTopic(q[i]);
    if (gdStart(t, false)) { gd.auto++; return; }
    gdLoad().seen[t.id] = 1;   // 這個畫面完全找不到目標:略過並記為看過
    gdSave();
  }
}

// ───────── 功能說明面板(設定→功能說明) ─────────
function guideListClose() {
  if (gd.list) gd.list.hidden = true;
}

function gdListRender() {
  var s = gdLoad(), body = gd.listBody;
  body.textContent = '';
  GUIDE_TOPICS.forEach(function (t) {
    var open = gdFeatOpen(t.feat), card = gdEl('div', 'gl-item' + (open ? '' : ' lock')), head = gdEl('div', 'gl-head'), ol = gdEl('ol', 'gl-steps'), btn;
    if (gdCityHidden(t)) return;   // 城建專注模式:戰鬥 / 釣魚 / 仙獸主題不列出
    head.appendChild(gdEl('b', 'gl-t', t.title));
    if (!open) head.appendChild(gdEl('span', 'gl-tag', 'Lv ' + guideTopicLv(t) + ' 開放'));
    else if (t.mode !== 'attack') {
      btn = gdEl('button', 'gl-demo', '▶ 示範');
      btn.addEventListener('click', function () { gdDemo(t); });
      head.appendChild(btn);
    } else head.appendChild(gdEl('span', 'gl-tag', '戰鬥中自動介紹'));
    card.appendChild(head);
    t.steps.forEach(function (st) { ol.appendChild(gdEl('li', '', gdStepText(st))); });
    card.appendChild(ol);
    body.appendChild(card);
  });
  gd.offBtn.textContent = s.off ? '開啟引導' : '關閉引導';
  gd.offBtn.className = 'gl-off' + (s.off ? ' on' : '');
  gd.offNote.textContent = s.off ? '目前:引導已關閉,不會自動跳出' : '目前:新功能開放時會自動介紹一次';
}

function gdDemo(t) {
  var wantCamp = t.mode === 'camp', ok;
  guideListClose();
  if (typeof stClosePanel === 'function') stClosePanel();
  if (typeof setBoardMode === 'function' && typeof game !== 'undefined') {
    if (wantCamp && game.mode !== 'battleDesign') setBoardMode('camp');
    else if ((t.mode === 'estate') && game.mode === 'battleDesign') setBoardMode('estate');
  }
  setTimeout(function () {
    ok = guidePlay(t.id);
    if (!ok) gdToast('這個畫面看不到示範的位置,請換到對應畫面再試');
  }, 250);
}

function guideListOpen() {
  if (!gd.list) {
    var panel = gdEl('div', 'gl-panel'), head = gdEl('div', 'gl-top'), foot = gdEl('div', 'gl-foot'), reset;
    gd.list = gdEl('div');
    gd.list.id = 'guideList';
    gd.list.setAttribute('role', 'dialog');
    gd.list.hidden = true;
    var xb = gdEl('button', 'gl-x', '✕'), cb = gdEl('button', 'gl-close', '關閉');
    head.appendChild(gdEl('b', '', '📖 功能說明'));
    xb.addEventListener('click', guideListClose);
    head.appendChild(xb);
    gd.listBody = gdEl('div', 'gl-body');
    reset = gdEl('button', 'gl-reset', '重置引導(下次重新介紹)');
    reset.addEventListener('click', function () { guideReset(); gdToast('已重置,新功能開放時會再介紹一次'); gdListRender(); });
    gd.offBtn = gdEl('button', 'gl-off', '關閉引導');
    gd.offBtn.addEventListener('click', function () { guideSetOff(!guideOff()); gdListRender(); });
    gd.offNote = gdEl('div', 'gl-note', '');
    foot.appendChild(gd.offNote);
    foot.appendChild(reset);
    foot.appendChild(gd.offBtn);
    cb.addEventListener('click', guideListClose);
    foot.appendChild(cb);
    panel.appendChild(head);
    panel.appendChild(gd.listBody);
    panel.appendChild(foot);
    gd.list.appendChild(panel);
    document.body.appendChild(gd.list);
  }
  gdListRender();
  gd.list.hidden = false;
}

function initGuide() {
  if (gd.timer || typeof document === 'undefined' || !document.body) return;
  gdLoad();
  gdBuild();
  if (typeof setInterval === 'function') gd.timer = setInterval(guideTick, GUIDE_TICK_MS) || 1;
}

if (typeof document !== 'undefined' && document.readyState) {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initGuide);
  else initGuide();
}

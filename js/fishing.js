// fishing.js — 釣魚玩法(F0):狀態、存讀檔、魚的生成、鉤子推進與連續碰撞、拉扯。不碰 DOM。
// 全域名稱只用 PLAN_FISHING §8.6 所列者;內部輔助函式都包在使用它的函式裡。
var fs = {
  save: null, phase: 'aim', boatX: 195, angle: 0, hook: null, fishes: [], obs: [],
  spawnT: [0, 0, 0, 0], fight: null, reelFish: null, reelWhy: '', card: null,
  t: 0, pending: 0, holding: false, abort: false, dismiss: false, bub: [], bubT: 0,
  mode: 'challenge', limit: 90, left: 90, live: false, over: false, summary: null, toast: null,
  sess: null
};

function fishIdxOf(id) {
  for (var i = 0; i < FISH.length; i++) if (FISH[i].id === id) return i;
  return -1;
}

function fishLoad() {
  function blank() {
    return {
      v: 1, dex: {}, junk: {},
      stats: { casts: 0, catches: 0, empty: 0, escape: 0, combo: 0, bestCombo: 0, night: 0, deep: 0, angle: 0, hard: 0, multi3: 0, rodUsed: {}, baitUsed: {}, seaKinds: [], totalScore: 0 },
      ach: {}, log: [],
      tackle: { rod: 'bamboo', line: 'mid', hook: 'mid', sink: 'deep', bait: 'worm', preset: 'balanced', angle: 0 },
      seen: { gear: false }, opt: { hand: 'R', skin: 'raft' }, last: { reg: 'home', season: '', tod: '', water: '', wx: '', mode: 'challenge', limit: 90 },
      friends: [], aq: null,
      titles: {}, board: [], pb: 0
    };
  }
  var b = blank(), d = null, raw = null, k, id, e, dx = {}, bad = false, titles = {}, board = [];
  try { raw = localStorage.getItem(FISH_KEY); } catch (err) { raw = null; }
  if (raw) { try { d = JSON.parse(raw); } catch (err2) { d = null; } }
  if (!d || typeof d !== 'object' || d.v !== 1) { d = b; bad = true; }
  for (k in b) if (d[k] === undefined || d[k] === null) d[k] = b[k];
  ['stats', 'tackle', 'seen', 'opt', 'last'].forEach(function (key) {
    if (!d[key] || typeof d[key] !== 'object') { d[key] = b[key]; return; }
    for (var j in b[key]) if (typeof d[key][j] !== typeof b[key][j]) d[key][j] = b[key][j];
  });
  if (!Array.isArray(d.log)) d.log = [];
  if (!d.dex || typeof d.dex !== 'object') d.dex = {};
  for (id in d.dex) {
    e = d.dex[id];
    if (fishIdxOf(id) < 0 || !e || typeof e !== 'object') continue;
    dx[id] = { n: Math.max(0, Math.floor(Number(e.n) || 0)), best: Math.max(0, Number(e.best) || 0),
      first: Number(e.first) || 0, bestTs: Number(e.bestTs) || 0, gold: !!e.gold };
  }
  d.dex = dx;
  if (d.titles && typeof d.titles === 'object') {
    FISH_TITLES.forEach(function (t) { if (d.titles[t.name]) titles[t.name] = Number(d.titles[t.name]) || 1; });
  }
  d.titles = titles;
  if (Array.isArray(d.board)) {
    d.board.forEach(function (x) {
      if (x && typeof x === 'object' && Number(x.score) > 0) {
        board.push({ score: Math.floor(Number(x.score)), ts: Number(x.ts) || 0, dur: Number(x.dur) || 0, title: String(x.title || '') });
      }
    });
  }
  board.sort(function (p, q) { return q.score - p.score || p.ts - q.ts; });
  d.board = board.slice(0, FISH_BOARD_N);
  d.pb = Math.max(0, Number(d.pb) || 0);
  if (!FISH_SKINS[d.opt.skin]) d.opt.skin = 'raft';
  if (d.last.mode !== 'leisure' && d.last.mode !== 'challenge') d.last.mode = 'challenge';
  if (FISH_TIME_OPTS.indexOf(d.last.limit) < 0) d.last.limit = 90;
  fs.save = d;
  fs.angle = d.tackle.angle || 0;
  fs.mode = d.last.mode;
  fs.limit = d.last.limit;
  return bad ? null : d;
}

function fishSave() {
  if (!fs.save) return true;
  fs.save.tackle.angle = Math.round(fs.angle);
  try {
    localStorage.setItem(FISH_KEY, JSON.stringify(fs.save));
    return true;
  } catch (e) {
    console.warn('釣魚存檔失敗', e);
    return false;
  }
}

// 版面改變(旋轉 / 視窗尺寸)時換算所有實體座標;相位、計時、拉扯、結算等狀態不動,挑戰不中斷。
// 版面相同時等同 no-op。v 為 fishLayoutCalc 的結果。
function fishRelayout(v) {
  var nl = fishLayerOf(v.W, v.H, v.orient === 'portrait'), ow = FISH_LAYER.W, osurf = FISH_LAYER.surf, ofl = FISH_LAYER.floor,
    kx = ow ? v.W / ow : 1, ky = (ofl - osurf) ? (nl.floor - nl.surf) / (ofl - osurf) : 1, i, j, f, o, p;
  function ym(y) { return nl.surf + (y - osurf) * ky; }
  fishLayerSet(v);
  fs.boatX = Math.max(60, Math.min(v.W - 60, fs.boatX * kx));
  for (i = 0; i < fs.fishes.length; i++) {
    f = fs.fishes[i]; f.x *= kx; f.y0 = ym(f.y0); f.v *= kx;
  }
  for (i = 0; i < fs.obs.length; i++) {
    o = fs.obs[i]; o.x *= kx; o.w *= kx; o.y = ym(o.y); o.h *= ky;
  }
  for (i = 0; i < fs.bub.length; i++) fs.bub[i].x *= kx;
  if (fs.hook) {
    p = fs.hook;
    p.pos[0] *= kx; p.pos[1] = ym(p.pos[1]); p.v[0] *= kx; p.v[1] *= ky;
    for (j = 0; j < p.path.length; j++) { p.path[j][0] *= kx; p.path[j][1] = ym(p.path[j][1]); }
  }
}

// 一次出航的狀態重設(存檔不動)。會先快轉 15 秒,讓畫面上一開始就有魚。
function fishReset() {
  var W = FISH_LAYER.W, fl = FISH_LAYER.floor, i, n, x;
  fs.phase = 'aim'; fs.boatX = W / 2; fs.hook = null; fs.fishes = []; fs.obs = [];
  fs.spawnT = [0, Math.random() * 0.5, Math.random() * 0.5, Math.random() * 0.5];
  fs.fight = null; fs.reelFish = null; fs.reelWhy = ''; fs.card = null;
  fs.pending = 0; fs.holding = false; fs.abort = false; fs.dismiss = false; fs.bub = []; fs.bubT = 0;
  fs.angle = fs.save ? (fs.save.tackle.angle || 0) : 0;
  fs.sess = { score: 0, catches: [], counts: {}, recent: [], best: 0, titles: [] };
  fs.left = fs.limit; fs.live = false; fs.over = false; fs.summary = null; fs.toast = null;
  if (fs.save) fs.save.stats.combo = 0;
  n = 2 + Math.floor(Math.random() * 2);
  for (i = 0; i < n; i++) {
    x = 30 + Math.random() * (W - 110);
    fs.obs.push({ x: x, y: fl - 12, w: 22 + Math.random() * 16, h: 12, weed: false, ph: 0 });
  }
  n = 1 + Math.floor(Math.random() * 2);
  for (i = 0; i < n; i++) {
    fs.obs.push({ x: 40 + Math.random() * (W - 120), y: fl - 90, w: 26, h: 90, weed: true, ph: Math.random() * 6 });
  }
  for (i = 0; i < 60; i++) fishStep(0.25);
  fs.t = 0;
  fs.bub = [];
}

// 依深度層挑魚種。F0 每層只有一種候選,季節 / 早晚 / 水域篩選尚未啟用。
function fishRoll(ctx) {
  var cand = [], tot = 0, i, r, w;
  for (i = 0; i < FISH.length; i++) {
    if (FISH[i].depth !== ctx.layer) continue;
    w = FISH_RARITY[FISH[i].rar].w;
    cand.push([i, w]);
    tot += w;
  }
  if (!cand.length) return -1;
  r = Math.random() * tot;
  for (i = 0; i < cand.length; i++) {
    r -= cand[i][1];
    if (r < 0) return cand[i][0];
  }
  return cand[cand.length - 1][0];
}

// 生成器:每層一條上限(L1 3、L2 3、L3 2),低於上限時隨機等 0.5~2 秒再生成;魚從畫面外進場、直線游、離開即移除。
function fishSpawnTick(dt) {
  var W = FISH_LAYER.W, cap = { 1: 3, 2: 3, 3: 2 }, L, n, i, fi, f0, cm, len, lo, hi, dir;
  fs.fishes = fs.fishes.filter(function (f) {
    return f.attached || (f.x > -f.len - 30 && f.x < W + f.len + 30);
  });
  for (L = 1; L <= 3; L++) {
    fs.spawnT[L] -= dt;
    if (fs.spawnT[L] > 0) continue;
    n = 0;
    for (i = 0; i < fs.fishes.length; i++) if (fs.fishes[i].layer === L) n++;
    if (n >= cap[L]) { fs.spawnT[L] = 0.5; continue; }
    fs.spawnT[L] = 0.5 + Math.random() * 1.5;
    fi = fishRoll({ layer: L });
    if (fi < 0) continue;
    f0 = FISH[fi];
    cm = (f0.min + Math.random() * (f0.max - f0.min) + f0.min + Math.random() * (f0.max - f0.min)) / 2;
    len = Math.min(150, Math.max(16, 16 + cm * 0.55));
    dir = Math.random() < 0.5 ? 1 : -1;
    lo = FISH_LAYER[L][0] + 20;
    hi = FISH_LAYER[L][1] - 20;
    fs.fishes.push({
      sp: fi, layer: L, cm: cm, len: len, sz: cm < 15 ? 1 : cm < 40 ? 2 : cm < 90 ? 3 : 4,
      x: dir > 0 ? -len : W + len, y0: lo + Math.random() * (hi - lo), dir: dir,
      v: FISH_SPD[f0.spd] * W, phi: Math.random() * 6.283, alive: true, attached: false
    });
  }
}

// 竿尖與水面的關係:竿尖在水面上方 8 px(F0 為 y=34,水面 42)。水面下移後跟著移動。
function fishTipY() { return FISH_LAYER.surf - 8; }

// 尺寸係數:cm / 該魚上限 = 0 → 0.6,= 1 → 1.5(線性)。
function fishSizeF(cm, def) {
  var r = cm / def.max;
  return Math.max(0.6, Math.min(1.5, 0.6 + 0.9 * r));
}

// 連擊倍率:1.0 + 0.1 × min(combo, 10)。
function fishComboMul(combo) {
  return 1 + 0.1 * Math.min(Math.max(0, combo), 10);
}

// 單次得分。kind:'fish'(預設)、'junk' 雜物(固定 −5)、'odd' 奇物(固定 +40)。
function fishScoreOf(kind, sp, cm, combo) {
  var def;
  if (kind === 'junk') return FISH_JUNK_PTS;
  if (kind === 'odd') return FISH_ODD_PTS;
  def = FISH[sp];
  return Math.round(FISH_RAR_PTS[def.rar] * fishSizeF(cm, def) * fishComboMul(combo));
}

// 分數對應的最高稱號(未達 100 分回傳 null)。
function fishTitleOf(score) {
  var best = null, i;
  for (i = 0; i < FISH_TITLES.length; i++) if (score >= FISH_TITLES[i].min) best = FISH_TITLES[i];
  return best;
}

// 達到門檻即永久解鎖;回傳這次新解鎖的稱號名稱陣列。
function fishUnlockTitles(score) {
  var out = [], i, t;
  if (!fs.save) return out;
  for (i = 0; i < FISH_TITLES.length; i++) {
    t = FISH_TITLES[i];
    if (score >= t.min && !fs.save.titles[t.name]) {
      fs.save.titles[t.name] = Date.now();
      out.push(t.name);
    }
  }
  return out;
}

// 船皮膚是否可用(need 為空字串 = 預設可用;否則需已解鎖對應稱號)。
function fishSkinOk(key) {
  var s = FISH_SKINS[key];
  if (!s || !fs.save) return false;
  if (!s.need) return true;
  return !!fs.save.titles[s.need];
}

function fishSkinSet(key) {
  if (!fishSkinOk(key)) return false;
  fs.save.opt.skin = key;
  return true;
}

// 排行榜:只收 score > 0,依分數高到低(同分先到先排),最多 FISH_BOARD_N 筆。回傳名次(1 起算),未入榜回傳 0。
function fishBoardAdd(entry) {
  var b, i, rank = 0;
  if (!fs.save || !(entry.score > 0)) return 0;
  b = fs.save.board;
  b.push(entry);
  b.sort(function (p, q) { return q.score - p.score || p.ts - q.ts; });
  if (b.length > FISH_BOARD_N) b.length = FISH_BOARD_N;
  for (i = 0; i < b.length; i++) if (b[i] === entry) { rank = i + 1; break; }
  return rank;
}

// 開始一局:mode 'leisure'(無時限、不給金幣)或 'challenge'(限時,limit 秒)。
function fishStart(mode, limit) {
  if (!fs.save || fs.over) return false;
  fs.mode = mode === 'challenge' ? 'challenge' : 'leisure';
  fs.limit = FISH_TIME_OPTS.indexOf(limit) >= 0 ? limit : 90;
  fs.left = fs.limit;
  fs.live = true;
  fs.save.last.mode = fs.mode;
  fs.save.last.limit = fs.limit;
  fishSave();
  return true;
}

// 結算(限時挑戰專用,只會執行一次):停止出竿、移除正在拉的魚、金幣 floor(分數/20) 寫入 world.res.coin、
// 寫入排行榜與個人紀錄、存檔。回傳 summary;悠閒釣或已結算過則回傳既有值(悠閒釣為 null)。
function fishSettle() {
  var sess, score, pb0, newRec, gold = 0, ttl, rank, sm;
  if (fs.summary) return fs.summary;
  if (fs.mode !== 'challenge' || !fs.save || !fs.sess) return null;
  sess = fs.sess;
  fs.over = true; fs.live = false; fs.phase = 'over';
  fs.hook = null; fs.fight = null; fs.card = null; fs.reelFish = null; fs.reelWhy = '';
  fs.fishes = fs.fishes.filter(function (f) { if (f.attached) { f.alive = false; return false; } return true; });
  score = sess.score;
  pb0 = fs.save.pb || 0;
  newRec = score > 0 && score > pb0;
  if (score > pb0) fs.save.pb = score;
  gold = Math.floor(score / FISH_GOLD_DIV);
  if (gold > 0) {
    try {
      if (typeof world !== 'undefined' && world && world.res) {
        world.res.coin = (world.res.coin || 0) + gold;
        if (typeof saveWorld === 'function') saveWorld();
      }
    } catch (e) { console.warn('釣魚金幣寫入失敗', e); }
  }
  ttl = fishTitleOf(score);
  rank = fishBoardAdd({ score: score, ts: Date.now(), dur: fs.limit, title: ttl ? ttl.name : '' });
  sm = { score: score, count: sess.catches.length, bestCombo: sess.best, catches: sess.catches.slice(),
    gold: gold, title: ttl ? ttl.name : '', newTitles: sess.titles.slice(), newRecord: newRec, rank: rank, limit: fs.limit };
  fs.summary = sm;
  fishSave();
  return sm;
}

// 目前這一竿的裝備數值(F0 固定為均衡組合;讀存檔的 tackle,方便之後接裝備面板)。
function fishGear() {
  var t = fs.save.tackle, rod = FISH_RODS[t.rod] || FISH_RODS.bamboo, line = FISH_LINES[t.line] || FISH_LINES.mid,
    hook = FISH_HOOKS[t.hook] || FISH_HOOKS.mid, sink = FISH_SINKS[t.sink] || FISH_SINKS.deep;
  return { rod: rod, line: line, hook: hook, vh: line.vh * hook.mult, hr: hook.hr,
    angMax: Math.min(rod.ang, line.ang), sinkY: sink.y, cap: rod.cap, reel: rod.reel };
}

// 拋出:角度單位為度,0 = 正下方,正值 = 往右。竿尖在船的左右 14 px、水面上方 34 px。
function fishCast(angle) {
  var g, a, rad, tipX;
  if (fs.phase !== 'aim' || !fs.save) return false;
  g = fishGear();
  a = Math.max(-g.angMax, Math.min(g.angMax, angle));
  fs.angle = a;
  rad = a * Math.PI / 180;
  tipX = fs.boatX + (a < 0 ? -14 : 14);
  fs.hook = { pos: [tipX, fishTipY()], v: [Math.sin(rad) * g.vh, Math.cos(rad) * g.vh], hr: g.hr, path: [[tipX, fishTipY()]] };
  fs.phase = 'sink';
  fs.abort = false;
  fs.save.stats.casts++;
  return true;
}

// 連續碰撞:鉤子以 ≤6 px 的子步前進,每個子步對每條魚換到魚座標系測線段(A → B − 魚位移),取 t 最小者。
// hook 為 null 時只推進魚。回傳 null 或 {type:'fish'|'obs'|'bottom'|'bounds', fish?}。
function fishSweep(hook, fishes, obs, dt) {
  var W = FISH_LAYER.W, floor = FISH_LAYER.floor;
  function adv(d) {
    for (var j = 0; j < fishes.length; j++) if (!fishes[j].attached) fishes[j].x += fishes[j].dir * fishes[j].v * d;
  }
  if (!hook) { adv(dt); return null; }
  var sp = Math.sqrt(hook.v[0] * hook.v[0] + hook.v[1] * hook.v[1]);
  var n = Math.max(1, Math.ceil(sp * dt / 6)), h = dt / n, s, i, j, k, ax, ay, bx, by, mx, my;
  var best, ev, pt, t, f, o, def, len, hh, rx, ry, rw, rh, dxf, lp, dist;
  for (s = 0; s < n; s++) {
    ax = hook.pos[0]; ay = hook.pos[1];
    mx = ax + hook.v[0] * h * 0.5; my = ay + hook.v[1] * h * 0.5;
    k = 1;
    for (i = 0; i < obs.length; i++) {
      o = obs[i];
      if (o.weed && mx >= o.x && mx <= o.x + o.w && my >= o.y && my <= o.y + o.h) k = 0.5;
    }
    bx = ax + hook.v[0] * h * k; by = ay + hook.v[1] * h * k;
    best = 2; ev = null; pt = null;
    for (j = 0; j < fishes.length; j++) {
      f = fishes[j];
      if (f.attached || !f.alive) continue;
      def = FISH[f.sp]; len = f.len; hh = len * def.look.body[1];
      rx = f.x - len * 0.4 - hook.hr; ry = f.y0 - hh * 0.375 - hook.hr;
      rw = len * 0.8 + 2 * hook.hr; rh = hh * 0.75 + 2 * hook.hr;
      dxf = f.dir * f.v * h;
      t = fishSegRect(ax, ay, bx - dxf, by, rx, ry, rw, rh);
      if (t >= 0 && t < best) { best = t; ev = { type: 'fish', fish: f }; pt = [ax + (bx - dxf - ax) * t, ay + (by - ay) * t]; }
    }
    for (j = 0; j < obs.length; j++) {
      o = obs[j];
      if (o.weed) continue;
      t = fishSegRect(ax, ay, bx, by, o.x, o.y, o.w, o.h);
      if (t >= 0 && t < best) { best = t; ev = { type: 'obs' }; pt = [ax + (bx - ax) * t, ay + (by - ay) * t]; }
    }
    if (by >= floor && ay < floor) {
      t = (floor - ay) / (by - ay);
      if (t < best) { best = t; ev = { type: 'bottom' }; pt = [ax + (bx - ax) * t, floor]; }
    }
    if ((bx < 0 || bx > W) && bx !== ax) {
      t = (bx < 0 ? -ax : W - ax) / (bx - ax);
      if (t >= 0 && t < best) { best = t; ev = { type: 'bounds' }; pt = [ax + (bx - ax) * t, ay + (by - ay) * t]; }
    }
    var end = ev ? pt : [bx, by];
    lp = hook.path[hook.path.length - 1];
    dist = Math.sqrt((end[0] - lp[0]) * (end[0] - lp[0]) + (end[1] - lp[1]) * (end[1] - lp[1]));
    if (dist >= 8 || (ev && dist > 0.01)) hook.path.push([end[0], end[1]]);
    hook.pos = [end[0], end[1]];
    if (ev) { adv(h * best); return ev; }
    adv(h);
  }
  return null;
}

// 線段對軸平行矩形(Liang–Barsky)。回傳進入點的 t ∈ [0,1],沒有交點回傳 -1。
function fishSegRect(x0, y0, x1, y1, rx, ry, rw, rh) {
  var dx = x1 - x0, dy = y1 - y0, t0 = 0, t1 = 1, P = [-dx, dx, -dy, dy],
    Q = [x0 - rx, rx + rw - x0, y0 - ry, ry + rh - y0], i, r;
  for (i = 0; i < 4; i++) {
    if (P[i] === 0) {
      if (Q[i] < 0) return -1;
    } else {
      r = Q[i] / P[i];
      if (P[i] < 0) {
        if (r > t1) return -1;
        if (r > t0) t0 = r;
      } else {
        if (r < t0) return -1;
        if (r < t1) t1 = r;
      }
    }
  }
  return t0;
}

// 拉扯:input.taps 為這一幀的點擊數(可為小數,按住時每秒 5 下)。回傳 'win' | 'lose' | null。
function fishFightStep(f, input, dt) {
  var fi = f.fish, def = FISH[fi.sp], d = FISH_DIFF[def.diff], decay = d.decay, cap = fishGear().cap;
  if (def.mod.indexOf('pull+') >= 0) decay *= 1.2;
  if (fi.sz > cap) decay *= 1.5;
  f.tension = Math.max(0, Math.min(100, f.tension + input.taps * d.tap - decay * dt));
  if (f.tension >= 100) return 'win';
  if (f.tension <= 0) return 'lose';
  return null;
}

// 預測虛線:同一套 fishSweep 公式,只看障礙物、不看魚。回傳 {pts, end, pos}。
function fishPredict(angle) {
  var g = fishGear(), side = angle < 0 ? -1 : 1, rad = angle * Math.PI / 180, steps = 0, ev = null, h;
  h = { pos: [fs.boatX + side * 14, fishTipY()], v: [Math.sin(rad) * g.vh, Math.cos(rad) * g.vh], hr: g.hr, path: [] };
  h.path.push([h.pos[0], h.pos[1]]);
  while (steps < 800) {
    ev = fishSweep(h, [], fs.obs, 1 / 120);
    if (ev) break;
    steps++;
  }
  return { pts: h.path, end: ev ? ev.type : 'none', pos: h.pos };
}

// 一幀的遊戲邏輯。畫面與輸入不在這裡處理。
function fishStep(dt) {
  if (!fs.save) return;
  var taps, r, ev, f;

  function beginReel(f, why) {
    fs.phase = 'reel'; fs.reelFish = f; fs.reelWhy = why || '';
    if (f) f.attached = true;
  }
  function hookFish(f) {
    f.attached = true; f.v = 0; f.x = fs.hook.pos[0]; f.y0 = fs.hook.pos[1];
    if (FISH[f.sp].diff === 1) beginReel(f, '');
    else { fs.fight = { fish: f, tension: 40 }; fs.phase = 'fight'; }
  }
  function catchFish(f, ts) {
    var def = FISH[f.sp], st = fs.save.stats, e = fs.save.dex[def.id], isNew, gold, cm = Math.round(f.cm), pts, sess = fs.sess, nt, rc;
    if (!e) e = fs.save.dex[def.id] = { n: 0, best: 0, first: 0, bestTs: 0, gold: false };
    isNew = e.n === 0;
    e.n++;
    if (f.cm > e.best) { e.best = Math.round(f.cm * 10) / 10; e.bestTs = ts; }
    if (!e.first) e.first = ts;
    gold = f.cm >= def.max * 0.9;
    if (gold) e.gold = true;
    st.catches++; st.combo++;
    if (st.combo > st.bestCombo) st.bestCombo = st.combo;
    pts = fishScoreOf('fish', f.sp, cm, st.combo);
    sess.score = Math.max(0, sess.score + pts);
    sess.catches.push({ sp: f.sp, cm: cm, pts: pts });
    if (sess.catches.length > 300) sess.catches.splice(0, sess.catches.length - 300);
    sess.counts[def.id] = (sess.counts[def.id] || 0) + 1;
    sess.recent = sess.recent.filter(function (x) { return x !== f.sp; });
    sess.recent.unshift(f.sp);
    if (sess.recent.length > 6) sess.recent.length = 6;
    if (st.combo > sess.best) sess.best = st.combo;
    st.totalScore += pts;
    nt = fishUnlockTitles(sess.score);
    sess.titles = sess.titles.concat(nt);
    fs.save.log.push([f.sp, cm, ts, 0]);
    if (fs.save.log.length > 30) fs.save.log.splice(0, fs.save.log.length - 30);
    fs.toast = { sp: f.sp, cm: cm, pts: pts, t0: fs.t, title: nt.length ? nt[nt.length - 1] : '' };
    rc = { kind: 'catch', fi: f.sp, cm: cm, isNew: isNew, gold: gold, pts: pts, t: 0, hold: isNew || gold };
    return rc;
  }
  function finish() {
    var f = fs.reelFish, why = fs.reelWhy, st = fs.save.stats, card;
    if (f) {
      fs.fishes = fs.fishes.filter(function (x) { return x !== f; });
      f.alive = false;
      card = catchFish(f, Date.now());
    } else {
      st.combo = 0;
      if (why === 'escape') st.escape++; else st.empty++;
      card = { kind: why === 'escape' ? 'escape' : 'empty', why: why, fi: -1, t: 0, hold: false };
    }
    fs.hook = null; fs.reelFish = null; fs.reelWhy = '';
    fs.phase = 'result'; fs.card = card; fs.dismiss = false;
    fishSave();
  }
  function reelStep(d0) {
    var h = fs.hook, g = fishGear(), f = fs.reelFish, vr = 520 * g.reel, d, last, prev, seg, rr;
    if (f) vr *= (1 - 0.08 * f.sz);
    d = vr * d0;
    while (d > 0 && h.path.length > 1) {
      last = h.path[h.path.length - 1];
      prev = h.path[h.path.length - 2];
      seg = Math.sqrt((last[0] - prev[0]) * (last[0] - prev[0]) + (last[1] - prev[1]) * (last[1] - prev[1]));
      if (seg <= d) { d -= seg; h.path.pop(); }
      else {
        rr = (seg - d) / seg;
        h.path[h.path.length - 1] = [prev[0] + (last[0] - prev[0]) * rr, prev[1] + (last[1] - prev[1]) * rr];
        d = 0;
      }
    }
    h.pos = [h.path[h.path.length - 1][0], h.path[h.path.length - 1][1]];
    if (f) { f.x = h.pos[0]; f.y0 = h.pos[1]; }
    if (h.path.length <= 1) finish();
  }

  fs.t += dt;
  if (fs.mode === 'challenge' && fs.live && !fs.over) {
    fs.left -= dt;
    if (fs.left <= 0) { fs.left = 0; fishSettle(); }
  }
  fishSpawnTick(dt);
  fs.bubT -= dt;
  if (fs.bubT <= 0 && fs.bub.length < 30) {
    fs.bubT = 0.4 + Math.random() * 0.8;
    fs.bub.push({ x: Math.random() * FISH_LAYER.W, y: FISH_LAYER.floor, r: 1 + Math.random() * 2 });
  }
  fs.bub = fs.bub.filter(function (b) { b.y -= 26 * dt; return b.y > FISH_LAYER.surf; });

  if (fs.phase === 'aim') {
    fishSweep(null, fs.fishes, fs.obs, dt);
  } else if (fs.phase === 'sink') {
    if (fs.abort) { fs.abort = false; beginReel(null, 'abort'); }
    else {
      ev = fishSweep(fs.hook, fs.fishes, fs.obs, dt);
      if (ev) {
        if (ev.type === 'fish') hookFish(ev.fish);
        else beginReel(null, ev.type);
      }
    }
  } else if (fs.phase === 'fight') {
    fishSweep(null, fs.fishes, fs.obs, dt);
    taps = fs.pending + (fs.holding ? 5 * dt : 0);
    fs.pending = 0;
    r = fishFightStep(fs.fight, { taps: taps }, dt);
    if (r === 'win') {
      f = fs.fight.fish; fs.fight = null; beginReel(f, '');
    } else if (r === 'lose') {
      f = fs.fight.fish; fs.fight = null;
      fs.fishes = fs.fishes.filter(function (x) { return x !== f; });
      f.alive = false;
      beginReel(null, 'escape');
    }
  } else if (fs.phase === 'reel') {
    fishSweep(null, fs.fishes, fs.obs, dt);
    reelStep(dt);
  } else if (fs.phase === 'result') {
    fishSweep(null, fs.fishes, fs.obs, dt);
    fs.card.t += dt;
    if (fs.dismiss || (!fs.card.hold && fs.card.t >= 1.2)) { fs.phase = 'aim'; fs.card = null; fs.dismiss = false; }
  } else if (fs.phase === 'over') {
    fishSweep(null, fs.fishes, fs.obs, dt);
  }
  if (fs.phase !== 'fight') fs.pending = 0;
}

// pet.js — 仙獸苑純邏輯(PLAN_PET §4、§5、§7、§8.1)。不碰 DOM、不畫圖。
// 會改狀態的函式在回傳前已 petSave。依賴 fishdata.js(FISH_KEY)與 petdata.js(PET_*、PETS)。
// 金幣兌換只讀寫 world.res.coin(寫法照 fishing.js 的 fishSettle)。

var ps = { save: null };
var petSeed = null;    // null = 使用 Math.random;設定後改用 mulberry32
var petFresh = false;  // 本次 petLoad 為新建立的存檔,尚未與釣魚分數同步

// 可注入固定種子(測試 / 模擬用);傳 null 或 undefined 恢復 Math.random
function petSetSeed(seed) {
  petSeed = (seed === null || seed === undefined) ? null : (Number(seed) | 0);
}

function petRand() {
  var t;
  if (petSeed === null) return Math.random();
  petSeed = (petSeed + 0x6D2B79F5) | 0;
  t = petSeed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function petInt(x, lo, hi) {
  var n = Math.floor(Number(x));
  if (!isFinite(n)) n = 0;
  return Math.max(lo, Math.min(hi, n));
}

function petFind(id) {
  for (var i = 0; i < PETS.length; i++) if (PETS[i].id === id) return PETS[i];
  return null;
}

function petBaitFind(id) {
  for (var i = 0; i < PET_BAITS.length; i++) if (PET_BAITS[i].id === id) return PET_BAITS[i];
  return null;
}

function petFindByBait(baitId) {
  for (var i = 0; i < PETS.length; i++) if (PETS[i].bait === baitId) return PETS[i];
  return null;
}

function petBlank() {
  var b = {
    v: 1, shell: 0, fishSeen: 0, coinEx: 0, gift: false, floor: 0, bad: 0, charm: 0, focus: 'fire',
    tops: 0, climbs: 0, resets: 0, mat: {}, bait: {}, pets: {}, pity: {}, log: [],
    opt: { fast: false }, seen: { tut: false, failTip: false }
  };
  PET_MATS.forEach(function (m) { b.mat[m.id] = 0; });
  PET_BAITS.forEach(function (x) { b.bait[x.id] = 0; });
  return b;
}

// 讀檔防呆:壞 JSON / 錯版本 → 空白存檔(並標記為新建立);欄位逐一夾住或重設。不回寫 localStorage。
function petLoad() {
  var raw = null, d = null, ok = false, s, i, e, id, v;
  try { raw = localStorage.getItem(PET_KEY); } catch (err) { raw = null; }
  if (raw) { try { d = JSON.parse(raw); } catch (err2) { d = null; } }
  if (d && typeof d === 'object' && d.v === 1) ok = true;
  petFresh = !ok;
  s = petBlank();
  if (ok) {
    ['shell', 'fishSeen', 'coinEx', 'tops', 'climbs', 'resets'].forEach(function (k) { s[k] = petInt(d[k], 0, 1e12); });
    s.floor = petInt(d.floor, 0, 20);
    s.bad = petInt(d.bad, 0, 3);
    s.charm = petInt(d.charm, 0, 1);
    s.gift = d.gift === true;
    s.focus = PET_EL_LIST.indexOf(d.focus) >= 0 ? d.focus : 'fire';
    PET_MATS.forEach(function (m) { s.mat[m.id] = petInt(d.mat && d.mat[m.id], 0, 1e9); });
    PET_BAITS.forEach(function (x) { s.bait[x.id] = petInt(d.bait && d.bait[x.id], 0, 1e9); });
    if (d.pets && typeof d.pets === 'object') {
      PETS.forEach(function (p) {
        e = d.pets[p.id];
        if (e && typeof e === 'object') s.pets[p.id] = { n: petInt(e.n, 1, 1e9), star: petInt(e.star, 1, 5), first: Number(e.first) || 0 };
      });
    }
    if (d.pity && typeof d.pity === 'object') {
      PETS.forEach(function (p) {
        v = petInt(d.pity[p.id], 0, 1e9);
        if (v > 0) s.pity[p.id] = v;
      });
    }
    if (Array.isArray(d.log)) {
      s.log = d.log.filter(function (x) { return Array.isArray(x) && x.length === 4; }).slice(-20).map(function (x) {
        return [Number(x[0]) || 0, petInt(x[1], 0, 20), petInt(x[2], 0, 20), Number(x[3]) || 0];
      });
    }
    s.opt.fast = !!(d.opt && d.opt.fast);
    s.seen.tut = !!(d.seen && d.seen.tut);
    s.seen.failTip = !!(d.seen && d.seen.failTip);
  }
  ps.save = s;
  return s;
}

// 寫檔失敗回傳 false 並 console.warn,不拋例外
function petSave() {
  if (!ps.save) return true;
  try {
    localStorage.setItem(PET_KEY, JSON.stringify(ps.save));
    return true;
  } catch (e) {
    console.warn('仙獸苑存檔失敗', e);
    return false;
  }
}

function petEnsure() {
  if (!ps.save) petLoad();
  return ps.save;
}

// §7.2:把釣魚累計分數差額入帳為靈貝。回傳本次入帳數(0 表示沒有新增)。
function petSyncFish() {
  var s = petEnsure(), cur = 0, raw, fd, d;
  try {
    if (typeof fs !== 'undefined' && fs && fs.save && fs.save.stats) {
      cur = fs.save.stats.totalScore;
    } else {
      raw = localStorage.getItem(FISH_KEY);
      fd = raw ? JSON.parse(raw) : null;
      cur = fd && fd.stats ? fd.stats.totalScore : 0;
    }
  } catch (e) {
    return 0;
  }
  cur = petInt(cur, 0, 1e12);
  if (petFresh) {
    petFresh = false;
    s.fishSeen = cur;
    petSave();
    return 0;
  }
  d = cur - s.fishSeen;
  if (d > 0) {
    s.shell += d;
    s.fishSeen = cur;
    petSave();
    return d;
  }
  if (d < 0) {
    s.fishSeen = cur;
    petSave();
  }
  return 0;
}

// §7.4:金幣兌換靈貝。金幣不足回傳 false 且不變動任何狀態。
function petExchangeCoin() {
  var s = petEnsure(), cost = PET_COIN_RATE * PET_COIN_LOT;
  try {
    if (typeof world === 'undefined' || !world || !world.res || (world.res.coin || 0) < cost) return false;
    world.res.coin -= cost;
  } catch (e) {
    console.warn('金幣兌換失敗', e);
    return false;
  }
  try {
    if (typeof saveWorld === 'function') saveWorld();
  } catch (e2) {
    console.warn('金幣兌換存檔失敗', e2);
  }
  s.shell += PET_COIN_LOT;
  s.coinEx += PET_COIN_LOT;
  petSave();
  return true;
}

// §7.3:開園禮。只能領一次;送該五行靈級餌的全部材料 + 300 靈貝,並設定祈願五行。
function petGift(el) {
  var s = petEnsure(), bait = null, id, i;
  if (s.gift || PET_EL_LIST.indexOf(el) < 0) return false;
  for (i = 0; i < PET_BAITS.length; i++) {
    if (PET_BAITS[i].el === el && PET_BAITS[i].tier === 'ling') { bait = PET_BAITS[i]; break; }
  }
  if (!bait) return false;
  for (id in bait.mats) s.mat[id] = (s.mat[id] || 0) + bait.mats[id];
  s.shell += 300;
  s.focus = el;
  s.gift = true;
  petSave();
  return true;
}

// §4.2:依所在層取機率段(層數夾在 0~19)
function petBandOf(floor) {
  var f = petInt(floor, 0, 19), i;
  for (i = 0; i < PET_BANDS.length; i++) {
    if (f >= PET_BANDS[i].from && f <= PET_BANDS[i].to) return PET_BANDS[i];
  }
  return PET_BANDS[PET_BANDS.length - 1];
}

// 依權重擲出索引(只看前 n 個權重)
function petPick(w, n) {
  var total = 0, i, x;
  for (i = 0; i < n; i++) total += w[i];
  x = petRand() * total;
  for (i = 0; i < n; i++) {
    x -= w[i];
    if (x < 0) return i;
  }
  return n - 1;
}

// §4.3:只擲結果,回傳 PET_ROLL 索引(0~6)。不改狀態。否極泰來 bad >= 3 時只從前三種(正數)抽。
function petClimbRoll() {
  var s = petEnsure();
  return petPick(petBandOf(s.floor).w, s.bad >= 3 ? 3 : 7);
}

// 某層的掉落:回傳 { matId: 數量 }。不改狀態。五行 50% 祈願、50% 均勻抽;紫依機率出現。
function petLootOf(floor) {
  var s = petEnsure(), f = PET_FLOORS[petInt(floor, 0, PET_FLOORS.length - 1)], out = {}, i, n, el, id;
  function roll(lo, hi) { return lo + Math.floor(petRand() * (hi - lo + 1)); }
  function add(q, count) {
    for (i = 0; i < count; i++) {
      el = petRand() < 0.5 ? s.focus : PET_EL_LIST[Math.floor(petRand() * PET_EL_LIST.length)];
      id = el + '_' + q;
      out[id] = (out[id] || 0) + 1;
    }
  }
  add('b', roll(f.b[0], f.b[1]));
  add('c', roll(f.c[0], f.c[1]));
  if (f.p > 0 && petRand() < f.p) {
    n = roll(f.pn[0], f.pn[1]);
    add('p', n);
  }
  return out;
}

// §8.1 攀登:扣 100 靈貝,擲籤、套用平安符 / 否極泰來 / 夾住 / 登頂,發放落點掉落並存檔。
// 不足回傳 null 且狀態不變。回傳 { idx, d, from, to, charmUsed, pityForced, loot, top }。
// d 為實際層數變化(真的歸零為 -99,平安符護身為 -2);登頂時 to 為 20、之後 floor 歸 0。
function petClimb() {
  var s = petEnsure(), pityForced, idx, roll, from, to, d, charmUsed = false, reset = false, loot, top = false, q;
  if (s.shell < PET_CLIMB_COST) return null;
  pityForced = s.bad >= 3;
  idx = petClimbRoll();
  roll = PET_ROLL[idx];
  from = s.floor;
  d = roll.d;
  s.shell -= PET_CLIMB_COST;
  if (roll.reset) {
    if (s.charm > 0) {
      s.charm = 0;
      charmUsed = true;
      d = roll.charmD;
    } else {
      reset = true;
    }
  }
  if (reset) {
    to = 0;
    s.resets += 1;
    s.charm = 1;
  } else {
    to = Math.max(0, Math.min(20, from + d));
  }
  s.bad = d > 0 ? 0 : Math.min(3, s.bad + 1);
  s.climbs += 1;
  s.floor = to;
  if (to >= 20) {
    top = true;
    loot = petLootOf(20);
    ['b', 'c', 'p'].forEach(function (k) {
      var id = s.focus + '_' + k;
      loot[id] = (loot[id] || 0) + PET_TOP_CHEST[k];
    });
    s.floor = 0;
    s.bad = 0;
    s.tops += 1;
  } else {
    loot = petLootOf(to);
  }
  for (q in loot) s.mat[q] = (s.mat[q] || 0) + loot[q];
  s.log.push([d, from, to, Date.now()]);
  if (s.log.length > 20) s.log = s.log.slice(-20);
  petSave();
  return { idx: idx, d: d, from: from, to: to, charmUsed: charmUsed, pityForced: pityForced, loot: loot, top: top };
}

// §8.1 煉製:收齊 15 隻(非隱藏)才能煉鳳凰的餌;材料不足回傳 false。
function petCanCraft(baitId) {
  var s = petEnsure(), bait = petBaitFind(baitId), owned = 0, need = 0, i, id;
  if (!bait) return false;
  if (bait.tier === 'yin') {
    for (i = 0; i < PETS.length; i++) {
      if (PETS[i].hidden) continue;
      need++;
      if (s.pets[PETS[i].id]) owned++;
    }
    if (owned < need) return false;
  }
  for (id in bait.mats) if ((s.mat[id] || 0) < bait.mats[id]) return false;
  return true;
}

function petCraft(baitId) {
  var s = petEnsure(), bait = petBaitFind(baitId), id;
  if (!petCanCraft(baitId)) return false;
  for (id in bait.mats) s.mat[id] -= bait.mats[id];
  s.bait[baitId] = (s.bait[baitId] || 0) + 1;
  petSave();
  return true;
}

// §8.1 轉化:N 個同品質 fromEl → 1 個同品質 toEl;材料不足或五行相同回傳 false
function petConvert(q, fromEl, toEl) {
  var s = petEnsure(), from, to;
  if (!Object.prototype.hasOwnProperty.call(PET_Q, q)) return false;
  if (PET_EL_LIST.indexOf(fromEl) < 0 || PET_EL_LIST.indexOf(toEl) < 0 || fromEl === toEl) return false;
  from = fromEl + '_' + q;
  to = toEl + '_' + q;
  if ((s.mat[from] || 0) < PET_CONVERT) return false;
  s.mat[from] -= PET_CONVERT;
  s.mat[to] = (s.mat[to] || 0) + 1;
  petSave();
  return true;
}

// §5.1 捕獲率;add 為加料紫數量(夾在 0~PET_ADD_MAX)。只讀。
function petCatchRate(petId, add) {
  var s = petEnsure(), pet = petFind(petId), r, pity, a;
  if (!pet) return 0;
  r = PET_RARITY[pet.rare];
  pity = s.pity[petId] || 0;
  a = petInt(add, 0, PET_ADD_MAX);
  return Math.min(r.cap, r.base + r.inc * pity + PET_ADD_BONUS * a);
}

// §5 丟球:扣 1 餌與加料紫(不論成敗),擲捕獲結果並立即寫入存檔。
// 餌不存在或加料紫不足回傳 null 且狀態不變。
// 回傳 { ok, rate, shakes, isNew, star, refund, add };refund 為 5 星重複捕獲退還的 { mat, n },否則 null。
// 五星後再抓到:退還本系青 ×2(五行為「鳳凰 all」時改用祈願五行)。
function petThrow(baitId, add) {
  var s = petEnsure(), bait = petBaitFind(baitId), pet, el, a, rate, ok, shakes, isNew = false, refund = null, pid, rf, star;
  if (!bait || (s.bait[baitId] || 0) < 1) return null;
  pet = petFindByBait(baitId);
  if (!pet) return null;
  el = bait.el;
  a = el === 'all' ? 0 : petInt(add, 0, PET_ADD_MAX);
  if (a > 0 && (s.mat[el + '_p'] || 0) < a) return null;
  pid = pet.id;
  rate = petCatchRate(pid, a);
  s.bait[baitId] -= 1;
  if (a > 0) s.mat[el + '_p'] -= a;
  ok = petRand() < rate;
  if (ok) {
    s.pity[pid] = 0;
    shakes = 2;
    if (!s.pets[pid]) {
      isNew = true;
      s.pets[pid] = { n: 1, star: 1, first: Date.now() };
    } else {
      s.pets[pid].n += 1;
      if (s.pets[pid].star < 5) {
        s.pets[pid].star += 1;
      } else {
        rf = el === 'all' ? s.focus : el;
        refund = { mat: rf + '_c', n: 2 };
        s.mat[refund.mat] = (s.mat[refund.mat] || 0) + 2;
      }
    }
  } else {
    s.pity[pid] = (s.pity[pid] || 0) + 1;
    shakes = petRand() < 0.5 ? 2 : 1;
  }
  star = s.pets[pid] ? s.pets[pid].star : 0;
  petSave();
  return { ok: ok, rate: rate, shakes: shakes, isNew: isNew, star: star, refund: refund, add: a };
}

function petIsHidden(petId) {
  var pet = petFind(petId);
  return !!(pet && pet.hidden);
}

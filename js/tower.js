// js/tower.js — 百層塔純邏輯(不碰 DOM)。前綴 tw / TOWER_CFG。ES2017,不用 ?. ??。
// 存檔:localStorage 'lorddomain.tower.v1' = {v:1, top: 已通關最高層 0..max, st:{層(1..top): 星數 1~3}}(進度鍵,SAVE_SLOT_KEYS;隨世界 / 回溯點切換)。
//   壞檔 / 沒有此鍵(舊存檔)= 初值 {top:0, st:{}};缺星數的已通關層讀入時補 1 星;超出 1..top 的星數紀錄丟棄。讀寫都 try/catch,不丟例外。
// 每層敵人 = bn_stages 的關卡樣板(一般層循環取非頭目關、頭目層取頭目關)用 bnStgFoes(關卡, v) 以強度 v 重新生成。
// 【暫定】TOWER_CFG.pow(各層敵將基準 v)、bossK 皆為 PLACEHOLDER,只保證流程;最後統一調平衡(戰鬥模擬依規則先問場數)。
// 對外:TOWER_CFG TOWER_KEY twRead twWrite twFloor twPowerV twFoes twStars twSettle twWindow twFameKind twRewardText twNextBoss
var TOWER_KEY = 'lorddomain.tower.v1';
var TOWER_CFG = {
  max: 100, bossEvery: 10, show: 6,
  // 【暫定】強度錨點 [層, 敵將基準 v],層與層之間線性內插(bn_stages 36 關的 v 約 31~86;末層 138 遠高於現有關卡)
  pow: [[1, 34], [10, 50], [30, 72], [60, 100], [100, 138]],
  bossK: 1.08, topK: 1.15   // 【暫定】頭目層 v 倍率;第 100 層倍率
};

function twInt(x, lo, hi, d) { x = Math.floor(Number(x)); return isFinite(x) ? Math.max(lo, Math.min(hi, x)) : d; }
function twDefault() { return { v: 1, top: 0, st: {} }; }
function twNorm(raw) {
  var o = twDefault(), k, n, s;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return o;
  o.top = twInt(raw.top, 0, TOWER_CFG.max, 0);
  s = (raw.st && typeof raw.st === 'object' && !Array.isArray(raw.st)) ? raw.st : {};
  for (n = 1; n <= o.top; n++) { k = String(n); o.st[k] = twInt(s[k], 1, 3, 1); }
  return o;
}
function twRead() {
  var raw = null;
  try { raw = JSON.parse(localStorage.getItem(TOWER_KEY)); } catch (e) { raw = null; }
  return twNorm(raw);
}
function twWrite(st) { try { localStorage.setItem(TOWER_KEY, JSON.stringify(st)); return true; } catch (e) { return false; } }

// 樓層資料:{n, boss, label}
function twFloor(n) {
  n = twInt(n, 1, TOWER_CFG.max, 1);
  var boss = n % TOWER_CFG.bossEvery === 0;
  return { n: n, boss: boss, label: '第 ' + n + ' 層' + (boss ? '(頭目)' : '') };
}
// 某層的敵將基準 v(依 pow 錨點內插,頭目層 × bossK,第 max 層 × topK)
function twPowerV(n) {
  var p = TOWER_CFG.pow, i, a, b, v;
  n = twInt(n, 1, TOWER_CFG.max, 1);
  if (n <= p[0][0]) v = p[0][1];
  else if (n >= p[p.length - 1][0]) v = p[p.length - 1][1];
  else for (i = 1; i < p.length; i++) {
    if (n <= p[i][0]) { a = p[i - 1]; b = p[i]; v = a[1] + (b[1] - a[1]) * (n - a[0]) / (b[0] - a[0]); break; }
  }
  if (n === TOWER_CFG.max) v *= TOWER_CFG.topK;
  else if (n % TOWER_CFG.bossEvery === 0) v *= TOWER_CFG.bossK;
  return Math.round(v * 10) / 10;
}
// 這一層用哪個 bn_stages 關卡 id(一般層:30 個非頭目關循環;頭目層:6 個頭目關循環)
function twStageId(n) {
  var f = twFloor(n), list;
  if (typeof BN_STAGES === 'undefined' || !BN_STAGES.length) return null;
  list = BN_STAGES.filter(function (s) { return !!s.boss === f.boss; });
  if (!list.length) list = BN_STAGES;
  return list[(f.boss ? f.n / TOWER_CFG.bossEvery - 1 : f.n - 1 - Math.floor((f.n - 1) / TOWER_CFG.bossEvery)) % list.length].id;
}
// 對手:回傳格式同 bnUiCurFoes 的其他分支 { specs, scale, power, label, kind, boss, list }
function twFoes(n) {
  var f = twFloor(n), id = twStageId(n), r;
  if (!id || typeof bnStgFoes !== 'function') return null;
  r = bnStgFoes(id, twPowerV(f.n));
  if (!r) return null;
  return { specs: r.units, scale: 1, power: r.rec, label: '百層塔 ' + f.label, kind: 'custom', boss: f.boss, list: r.list };
}
// 星數:我方無陣亡 3 星、陣亡 1 人 2 星、其他勝 1 星;沒贏 0。S = 戰鬥狀態(S.result.winner / deadA)或 { winner, deadA }
function twStars(S) {
  var r = S && (S.result || S), dead;
  if (!r || r.winner !== 'A') return 0;
  dead = twInt(r.deadA, 0, 99, 99);
  return dead === 0 ? 3 : (dead === 1 ? 2 : 1);
}
function twFameKind(n) { return n >= TOWER_CFG.max ? 'towerTop' : (n % TOWER_CFG.bossEvery === 0 ? 'towerBoss' : 'tower'); }
function twRewardText(n) {
  var k = twFameKind(n), g = (typeof fameFor === 'function') ? fameFor(k) : 0;
  return g ? '首通獎勵:名聲 +' + g : '';
}
// 結算。n = 挑戰的層;win = 我方勝;S = 戰鬥狀態。回 { n, win, first, stars, fame, top }
//   勝且 n === top + 1 → 首通:top = n、記星、給名聲;勝且 n <= top → 重打,只在星數更高時更新、不給名聲;n > top + 1 或敗 = 不變
function twSettle(n, win, S) {
  var st = twRead(), res = { n: n, win: !!win, first: false, stars: 0, fame: 0, top: st.top }, stars, k, key, r;
  if (!featureOn('tower')) return res;   // @DORMANT tower(休眠:不記層數、不給名聲)
  n = twInt(n, 1, TOWER_CFG.max, 0);
  if (!win || n < 1 || n > st.top + 1) return res;
  stars = Math.max(1, twStars(S) || 1);
  res.stars = stars; key = String(n);
  if (n === st.top + 1) {
    st.top = n; st.st[key] = stars; res.first = true; res.top = n;
    k = twFameKind(n);
    if (typeof fameAdd === 'function' && typeof fameFor === 'function') {
      res.fame = fameFor(k);
      try { r = fameAdd(res.fame, '百層塔 第 ' + n + ' 層'); res.unlocked = r && r.unlocked ? r.unlocked : []; } catch (e) { res.fame = 0; }
    }
  } else if (stars > (st.st[key] | 0)) st.st[key] = stars;
  twWrite(st);
  return res;
}
// 下一個頭目層(>= 下一個要打的層 top + 1);超過 max 回 max
function twNextBoss(top) {
  var e = TOWER_CFG.bossEvery, c = Math.ceil((twInt(top, 0, TOWER_CFG.max, 0) + 1) / e) * e;
  return Math.min(TOWER_CFG.max, c);
}
// 要畫的樓層範圍 { from:1, to, cur 目前要打的層(top+1,封頂 max), done 全部通關 }
//   to = min(max, max(top + 1 + show, 下一個頭目層))
function twWindow(top) {
  top = twInt(top, 0, TOWER_CFG.max, 0);
  return { from: 1, to: Math.min(TOWER_CFG.max, Math.max(top + 1 + TOWER_CFG.show, twNextBoss(top))), cur: Math.min(TOWER_CFG.max, top + 1), done: top >= TOWER_CFG.max };
}

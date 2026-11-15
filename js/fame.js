// js/fame.js — 名聲(補兵・名聲・鍛造材料 設計 第 2 節;純邏輯,無 DOM)。數值全部 PLACEHOLDER,集中在 FAME_CFG。
// 名聲 = 單一累計整數,只增不減,只用來「開放功能」(第 3~5 隊、駐守上限 4~8),不能花。來源只有地圖戰鬥勝利(擂台不給)。不設每日上限;賽季重置不歸零(◇ 待拍板)。
// 存檔:localStorage 'lorddomain.fame.v1' = {v:1, n 累計, got:[已提示過的門檻], lt 舊存檔第一次載入時記下的隊伍數(2~5;新檔 2), tw:{休眠舊欄位:只讀不寫}, log:[{t,n,why}] 最近 30 筆}(SAVE_SLOT_KEYS)。
// 舊存檔相容:第一次載入時(沒有存檔鍵)以 bnteam 已有內容的最高隊號記 lt;fameTeamCap() = max(門檻隊數, lt),已在用的隊不被鎖。
// 讀寫失敗 / 壞檔 → 正規化,不丟例外。全域:FAME_CFG FAME_KEY fameGet fameFor fameAdd fameGuardCap fameTeamCap fameNext fameSteps fameTakeUnlocked fameTeamLockText fameNorm。ES2017;不用 ?. ??。

var FAME_KEY = 'lorddomain.fame.v1';
var FAME_CFG = {
  startTeam: 2, startGuard: 3, teamMax: 5, guardMax: 8, logMax: 30, nMax: 1e9,
  // 來源:per = 每級給多少(× 等級),flat = 固定
  src: {
    res: { per: 2 }, camp: { per: 15 }, beast: { per: 40 },
    county: { flat: 300 }, pass: { flat: 400 }, jun: { flat: 600 },
    tower: { flat: 10 }, towerBoss: { flat: 50 }, towerTop: { flat: 300 }   // @DORMANT tower:塔系來源休眠(FEATURES.tower=false 時沒有任何呼叫端),保留供日後改作別的塔使用
  },
  // 門檻(由低到高,一階一個獎勵):team = 開放到第幾隊、guard = 駐守上限
  steps: [
    { at: 0, team: 2, guard: 3 },
    { at: 300, guard: 4 },
    { at: 800, team: 3 },
    { at: 1500, guard: 5 },
    { at: 2500, team: 4 },
    { at: 4000, guard: 6 },
    { at: 6000, team: 5 },
    { at: 8500, guard: 7 },
    { at: 12000, guard: 8 }
  ]
};

function fameInt(x, lo, hi, d) {
  x = typeof x === 'number' && isFinite(x) ? Math.floor(x) : d;
  return Math.max(lo, Math.min(hi, x));
}
function fameStepLabel(s) { return s.team ? '第 ' + s.team + ' 隊' : '駐守上限 ' + s.guard; }
// 舊存檔已在用的隊伍數:bnteam 預設隊伍有內容的最高隊號(2~5)。沒有 bnteam 時 = 起始值
function fameLtInit() {
  var lt = FAME_CFG.startTeam, d, i, raw, o;
  try {
    if (typeof bnTeamData === 'function') {
      d = bnTeamData();
      for (i = 0; i < d.p.length; i++) if (d.p[i] && d.p[i].slots && d.p[i].slots.length) lt = Math.max(lt, i + 1);
    } else {
      raw = localStorage.getItem('lorddomain.bnteam.v1');
      o = raw ? JSON.parse(raw) : null;
      if (o && Array.isArray(o.p)) for (i = 0; i < o.p.length; i++) if (o.p[i] && o.p[i].slots && o.p[i].slots.length) lt = Math.max(lt, i + 1);
    }
  } catch (e) { lt = FAME_CFG.startTeam; }
  return Math.max(FAME_CFG.startTeam, Math.min(FAME_CFG.teamMax, lt));
}
function fameDefault(lt) { return { v: 1, n: 0, got: [], lt: lt, tw: {}, log: [] }; }
// 正規化:壞檔 → 預設(lt 重算);n 夾 0..nMax;lt 夾 2..5
function fameNorm(raw, lt) {
  var o;
  if (!raw || typeof raw !== 'object' || raw.v !== 1) return fameDefault(lt);
  o = fameDefault(fameInt(raw.lt, FAME_CFG.startTeam, FAME_CFG.teamMax, lt));
  o.n = fameInt(raw.n, 0, FAME_CFG.nMax, 0);
  o.got = (Array.isArray(raw.got) ? raw.got : []).filter(function (x) { return typeof x === 'number' && isFinite(x) && x > 0; }).map(Math.floor).slice(0, 50);
  if (raw.tw && typeof raw.tw === 'object' && !Array.isArray(raw.tw)) Object.keys(raw.tw).slice(0, 200).forEach(function (k) { if (raw.tw[k]) o.tw[k] = 1; });
  o.log = (Array.isArray(raw.log) ? raw.log : []).filter(function (x) { return x && typeof x === 'object'; }).slice(0, FAME_CFG.logMax).map(function (x) {
    return { t: fameInt(x.t, 0, 1e15, 0), n: fameInt(x.n, 0, FAME_CFG.nMax, 0), why: String(x.why || '').slice(0, 40) };
  });
  return o;
}
function fameRead() {
  var s = null, o = null, r;
  try { s = localStorage.getItem(FAME_KEY); } catch (e) { return fameDefault(FAME_CFG.startTeam); }
  if (s) { try { o = JSON.parse(s); } catch (e2) { o = null; } }
  if (!o || typeof o !== 'object' || o.v !== 1) { r = fameDefault(fameLtInit()); fameWrite(r); return r; }   // 第一次載入(或壞檔):記下舊存檔已有的隊伍數
  return fameNorm(o, FAME_CFG.startTeam);
}
function fameWrite(st) {
  try { localStorage.setItem(FAME_KEY, JSON.stringify(st)); return true; } catch (e) { return false; }
}

// ───────── 對外 ─────────
function fameGet() { return fameRead().n; }
// 該來源給多少(查 FAME_CFG.src);未知來源 0
function fameFor(kind, lv) {
  var s = (typeof kind === 'string' && Object.prototype.hasOwnProperty.call(FAME_CFG.src, kind)) ? FAME_CFG.src[kind] : null;
  if (!s) return 0;
  if (s.flat) return s.flat;
  lv = fameInt(lv, 1, 99, 1);
  return s.per * lv;
}
function fameTeamOf(n, lt) {
  var t = FAME_CFG.startTeam;
  FAME_CFG.steps.forEach(function (s) { if (s.team && s.at <= n && s.team > t) t = s.team; });
  return Math.max(t, lt || 0);
}
function fameGuardOf(n) {
  var g = FAME_CFG.startGuard;
  FAME_CFG.steps.forEach(function (s) { if (s.guard && s.at <= n && s.guard > g) g = s.guard; });
  return g;
}
// 加名聲。n ≤ 0 或非數字 → 不動;回 {n: 新總數, unlocked:[{at, what, label}]}(這一次剛跨過的門檻)
function fameAdd(n, why) {
  var st, old, unlocked = [];
  st = fameRead();
  if (typeof n !== 'number' || !isFinite(n) || n < 1) return { n: st.n, unlocked: unlocked };
  old = st.n;
  st.n = Math.min(FAME_CFG.nMax, st.n + Math.floor(n));
  FAME_CFG.steps.forEach(function (s) {
    if (s.at > old && s.at <= st.n) unlocked.push({ at: s.at, what: s.team ? 'team' : 'guard', label: fameStepLabel(s) });
  });
  st.log.unshift({ t: Date.now(), n: Math.floor(n), why: String(why || '').slice(0, 40) });
  if (st.log.length > FAME_CFG.logMax) st.log.length = FAME_CFG.logMax;
  fameWrite(st);
  if (typeof ldOpenNote === 'function') ldOpenNote('fame', { t: Date.now() });   // 開場解鎖:名聲跨門檻 → 開放功能(js/ld_open_ev.js;ldui)
  return { n: st.n, unlocked: unlocked };
}
function fameGuardCap() { return Math.max(FAME_CFG.startGuard, Math.min(FAME_CFG.guardMax, fameGuardOf(fameRead().n))); }
function fameTeamCap() { var st = fameRead(); return Math.max(FAME_CFG.startTeam, Math.min(FAME_CFG.teamMax, fameTeamOf(st.n, st.lt))); }
// 下一階:{need, at, label} 或 null(全開)。已被舊存檔相容(lt)涵蓋的隊伍階略過
function fameNext() {
  var st = fameRead(), tc = fameTeamOf(st.n, st.lt), i, s;
  for (i = 0; i < FAME_CFG.steps.length; i++) {
    s = FAME_CFG.steps[i];
    if (s.at <= st.n || (s.team && s.team <= tc)) continue;
    return { need: s.at - st.n, at: s.at, label: fameStepLabel(s) };
  }
  return null;
}
// 門檻表 + 是否已達成(畫面用)
function fameSteps() {
  var st = fameRead(), tc = fameTeamOf(st.n, st.lt);
  return FAME_CFG.steps.map(function (s) {
    return { at: s.at, team: s.team || 0, guard: s.guard || 0, label: s.at === 0 ? '起始:隊伍 ' + s.team + '、駐守 ' + s.guard : fameStepLabel(s), done: s.at <= st.n || !!(s.team && s.team <= tc) };
  });
}
// 取走「新開放、尚未提示」的項目(提示一次後寫入 got)
function fameTakeUnlocked() {
  var st = fameRead(), out = [];
  FAME_CFG.steps.forEach(function (s) {
    if (s.at > 0 && s.at <= st.n && st.got.indexOf(s.at) < 0) { out.push({ at: s.at, what: s.team ? 'team' : 'guard', label: fameStepLabel(s) }); st.got.push(s.at); }
  });
  if (out.length) fameWrite(st);
  return out;
}
// 第 n 隊未開放時的鎖頭文字,例「名聲 800 開放」;已開放 / 找不到 → ''
function fameTeamLockText(n) {
  var i, s;
  if (n <= fameTeamCap()) return '';
  for (i = 0; i < FAME_CFG.steps.length; i++) { s = FAME_CFG.steps[i]; if (s.team === n) return '名聲 ' + s.at.toLocaleString() + ' 開放'; }
  return '';
}

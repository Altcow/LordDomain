// js/ld_team_tips.js — 布陣建議核心(設計_站位目標與布陣教學.md W2;純邏輯,不讀 DOM、不存檔)。前綴 ldTips / LDTIPS。ES2017;不用 ?. ??。
// 站位:前鋒 row 0、中衛 row 1、主將 row 2。射程 = max(1, 兵種 R − 排號 + 1)(排號 = row + 1,三人都活著時;bn_engine.js bnReach),能打到對面排號 ≤ 射程的人。
// ldTipsReach(troop, row) → 打得到的「對面位置」陣列(0 前鋒、1 中衛、2 主將);ldTipsReachText → 「前鋒」「前鋒、中衛」「全部」。
// ldTipsAdvice(slots) → {lv:'ok'|'info'|'warn', color:'g'|'y'|'r', code, text}(slots = [{row, troop}];只回最嚴重的一條)。
// ldTipsAfter(S, side, o) → {code, text} | null(戰後一句建議,只在輸時;o = {myPower, foePower});ldTipsHitShare(S, side) → [前鋒%, 中衛%, 主將%](敵方造成的傷害含護盾吸收,三格加總約 100)。
// 全域:LDTIPS ldTipsReach ldTipsReachText ldTipsAdvice ldTipsAfter ldTipsHitShare LDTIPS_PAGE
var LDTIPS = { rowTxt: ['前鋒', '中衛', '主將'], R: { '槍': 1, '盾': 1, '騎': 2, '弓': 3, '謀': 3 }, reachMin: 1 };
var LDTIPS_TEXT = {
  empty: '還有空位,三個人都放滿比較穩',
  softFront: '前鋒最先挨打,弓、謀太脆,換盾或槍來站',
  tankBack: '把盾 / 槍兵移到前鋒,勝率通常高很多',
  cavFront: '騎兵當前鋒容易先倒,有盾 / 槍兵的話放前鋒更穩',
  rangedBack: '弓謀站主將安全,但只打得到對面前鋒',
  ok: '站位合理:前鋒耐打,主將在後'
};
// 「布陣要訣」頁內容(t:'h' 標題、'p' 段落、'li' 條列;**粗體** 由畫面轉 <b>)。文字與 設計_站位目標與布陣教學.md 2.3 ① 一致(「主將倒下整場就輸」在主將陣亡即輸上線前先寫成「隊伍最難翻盤」)
var LDTIPS_PAGE = [
  { t: 'h', s: '一隊三人:前鋒、中衛、主將' },
  { t: 'li', s: '**前鋒**:站最前面,**最先挨打**。我們實測,前鋒平均吃掉全隊快一半的傷害,十場有九場第一個倒下的是他。→ 放**盾兵、槍兵**這種血厚、防禦高的人。' },
  { t: 'li', s: '**中衛**:前鋒倒下後,他就變成新的前鋒。→ 放**騎兵**,或會**治療、護盾**的人。' },
  { t: 'li', s: '**主將**:站最後面,最晚挨打。**主將倒下,隊伍最難翻盤。**→ 放隊上最重要的人(主力、羈絆核心、謀士)。' },
  { t: 'h', s: '打得到誰?(不能指定目標,普攻會在打得到的人裡隨機挑)' },
  { t: 'li', s: '槍、盾:不管站哪,只打得到對面最前面那位。' },
  { t: 'li', s: '騎:站前鋒能打到對面前兩位;站後面只打得到最前面那位。' },
  { t: 'li', s: '弓、謀:站前鋒打得到全部;站中衛打到前兩位;**站主將只打得到最前面那位**。' },
  { t: 'li', s: '站越後面,越安全,但打得越近。前面的人倒下,後面的人會往前補。' },
  { t: 'p', s: '**兵種相剋**:槍剋騎、騎剋盾、盾剋弓、弓剋槍(多打 30%,被剋少打 20%);騎兵另外剋謀士。謀士的法術傷害不吃相剋。' },
  { t: 'p', s: '**不會排?**按「推薦戰隊」,它會照這些原則幫你挑人。' }
];

function ldTipsRange(troop) {
  var R = (typeof BN_DATA !== 'undefined' && BN_DATA.troops && BN_DATA.troops[troop]) ? BN_DATA.troops[troop].R : LDTIPS.R[troop];
  return (typeof R === 'number') ? R : 1;
}
function ldTipsReach(troop, row) {
  var reach = Math.max((typeof BN_DATA !== 'undefined' && BN_DATA.reachMin) || LDTIPS.reachMin, ldTipsRange(troop) - (row | 0)), out = [], i;   // R − 排號 + 1 = R − row
  for (i = 0; i < 3 && i < reach; i++) out.push(i);
  return out;
}
function ldTipsReachText(troop, row) {
  var r = ldTipsReach(troop, row);
  if (r.length >= 3) return '全部';
  return r.map(function (i) { return LDTIPS.rowTxt[i]; }).join('、');
}
function ldTipsIsTank(t) { return t === '盾' || t === '槍'; }
function ldTipsIsSoft(t) { return t === '弓' || t === '謀'; }
function ldTipsMake(code, lv, color) { return { lv: lv, color: color, code: code, text: LDTIPS_TEXT[code] }; }
function ldTipsAdvice(slots) {
  var by = {}, i, front, main, tankElse = false, anyTank = false;
  slots = slots || [];
  for (i = 0; i < slots.length; i++) by[slots[i].row] = slots[i].troop || '';
  if (slots.length < 3) return ldTipsMake('empty', 'warn', 'y');
  front = by[0]; main = by[2];
  if (ldTipsIsSoft(front)) return ldTipsMake('softFront', 'warn', 'r');
  for (i = 0; i < slots.length; i++) if (ldTipsIsTank(slots[i].troop)) { anyTank = true; if (slots[i].row !== 0) tankElse = true; }
  if (tankElse && !ldTipsIsTank(front)) return ldTipsMake('tankBack', 'warn', 'y');
  if (front === '騎' && !anyTank) return ldTipsMake('cavFront', 'info', 'y');
  if (ldTipsIsSoft(main)) return ldTipsMake('rangedBack', 'info', 'i');
  return ldTipsMake('ok', 'ok', 'g');
}

// ───────── 戰鬥結果相關(W5 戰後建議會用;事件需 opts.events)─────────
function ldTipsOpp(side) { return side === 'A' ? 'B' : 'A'; }
function ldTipsUnits(S, side) { return (S.units || []).filter(function (u) { return u && u.side === side; }); }
// 三格承傷占比(%,四捨五入到 0.1);沒有敵方傷害 → 全 0
function ldTipsHitShare(S, side) {
  var tot = [0, 0, 0], sum = 0, evs = (S && S.events) || [], i, e, t, a;
  for (i = 0; i < evs.length; i++) {
    e = evs[i];
    if (e.t !== 'dmg') continue;
    t = S.units[e.tgt]; a = e.src >= 0 ? S.units[e.src] : null;
    if (!t || t.side !== side || !a || a.side === side) continue;
    tot[t.row] += (e.v || 0) + (e.abs || 0); sum += (e.v || 0) + (e.abs || 0);
  }
  return tot.map(function (v) { return sum > 0 ? Math.round(v / sum * 1000) / 10 : 0; });
}
function ldTipsPreyRel(a, b) { return (typeof bnPreyRel === 'function') ? bnPreyRel(a, b) : 0; }
// 戰後一句建議(只取第一個成立的;贏 / 和 / 無原因 → null)
function ldTipsAfter(S, side, o) {
  var r = S && S.result, mine, foe, up = 0, down = 0, firstKill = null, i, e, u;
  o = o || {};
  if (!r || r.winner === side || r.winner === 'draw') return null;
  mine = ldTipsUnits(S, side); foe = ldTipsUnits(S, ldTipsOpp(side));
  if (r.reason === 'lord') return { code: 'lordFell', text: '主將先倒了。把耐打的人放前鋒,主將放後面' };
  for (i = 0; i < (S.events || []).length && !firstKill; i++) { e = S.events[i]; if (e.t === 'kill' && S.units[e.tgt] && S.units[e.tgt].side === side) firstKill = S.units[e.tgt]; }
  if (firstKill && firstKill.row === 0 && ldTipsIsSoft(firstKill.troop)) return { code: 'softFrontDied', text: '前鋒太脆、第一個倒。換盾或槍站前鋒' };
  mine.forEach(function (m) { foe.forEach(function (f) { var x = ldTipsPreyRel(m.troop, f.troop); if (x > 0) up++; else if (x < 0) down++; }); });
  if (down > up) return { code: 'preyDown', text: '對面兵種剋你。看隊伍頁的 ▲▼,換一個剋他的兵種' };
  if (o.myPower > 0 && o.foePower > 0 && o.myPower < o.foePower * 0.85) return { code: 'weaker', text: (featureOn('tower') ? '戰力差太多。先去高塔或練兵練一練' : '戰力差太多。先去練兵練一練') }   // @DORMANT tower;
  return null;
}

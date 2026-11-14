// js/bnreport.js — 戰鬥戰報畫面(規格 文字戰鬥_規格.md 二):結果頁(勝敗、兵力、卡片、戰法統計)+ 詳情(逐回合文字,1~10 回合可收合)。
// 純函式 bnRptBuild / bnRptSampleRec 不碰 DOM(node 可測);DOM:bnRptOpen / bnRptClose。
// 資料:rec 用 bnRun 重跑(opts.events 強制 true)取得 events / result;逐回合句子沿用 bnlog.js 的 bnLogBuild + bnLogItems(不另寫一套)。
// 句子裡「我 / 敵」沿用 bnlog 慣例:teamA = 我方。mySide 只影響結果頁勝敗與結果頁卡片位置。
// rec.opts.stars(可省略):teamA 各位星階(與 bnLogBuild 的 stars 同義),敵方不顯示星階。
// 戰法統計:發動 = skill 事件(普攻 = 普攻命中次數);殺敵 = 造成的傷害 dmg.v(不含自傷);救援 = heal.v(治療量)。
// 傷害 / 治療歸屬:普攻或反擊 → 普攻列;持續傷害 → 持續傷害列;反應 → 該反應列;其餘依施放者最近一次發動的戰法;無歸屬 → 其他。
// ES2017;不用 ?. ??;不用 canvas;全域 bnRpt 前綴。

var BNRPT = { el: null, rec: null, data: null, opts: {}, view: 'result', tab: 'stats', rd: 1 };
var BNRPT_GRC = ['#5b5b5b', '#2e7d4f', '#2f5fa8', '#7a3fa0', '#b8860b'];
// 戰報可否重播:rec.v 須 ≥ BN_REC_VER(普攻改射程內隨機後,舊戰報重算結果可能不同)。舊版只顯示結果頁,不給重播。
function bnRptReplayable(rec) { return !!rec && (rec.v | 0) >= BN_REC_VER; }

function bnRptEsc(s) { return String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

// 單位的戰法列(含普攻);static 列一律顯示,動態列(持續傷害 / 其他 / 反應 / 額外發動)只在有數字時顯示
function bnRptRowsOf(rowsAll, uid) { return rowsAll[uid] || []; }
function bnRptRowGet(rowsAll, uid, key, name, cat, pw, fixed) {
  var list = rowsAll[uid] || (rowsAll[uid] = []), i;
  for (i = 0; i < list.length; i++) if (list[i].id === key) return list[i];
  list.push({ id: key, name: name, cat: cat, pw: pw || '', cnt: 0, dmg: 0, heal: 0, fixed: !!fixed });
  return list[list.length - 1];
}

// 純資料:回 {mySide, enemySide, win, mine, enemy, endTxt, rounds:[{n, a:{left,open}, b:{left,open}, items:[{c,txt}]}], seed, ...}
// mine / enemy = {side, units:[{id,name,fig,troop,gr,grTxt,star,pos,row,hp,hpOpen,max,dead,sk:[{id,name,cat,pw,cnt,dmg,heal}]}], open, left, wounded, pct}
function bnRptBuild(rec, mySide) {
  var me = mySide === 'B' ? 'B' : 'A', en = bnOpp(me), stars = (rec.opts && rec.opts.stars) || [], rc, S, res, hp = {}, mx = {}, open = {}, snap = {}, cur = {}, rowsAll = {}, initEv, i, e, bk, rep, items, byR = {}, endTxt = '', maxN, rounds = [], w, lastSnap, n, k, g, uOut;
  rc = JSON.parse(JSON.stringify(rec));
  rc.opts = Object.assign({}, rec.opts || {}, { events: true });
  S = bnRun(rc);
  res = S.result || { winner: 'draw', reason: 'limit', rounds: S.round, hp: { A: 0, B: 0 } };
  w = res.winner;
  initEv = S.events.filter(function (x) { return x.t === 'init'; })[0];
  initEv.units.forEach(function (x) { hp[x.id] = x.hp; mx[x.id] = x.mx; open[x.id] = x.hp; });
  function sums() { var r = { A: 0, B: 0 }; S.units.forEach(function (u) { r[u.side] += Math.max(0, hp[u.id] || 0); }); return r; }
  snap[0] = sums();
  // 固定戰法列:普攻 + 名冊戰法(被動、主動、大招)
  S.units.forEach(function (u) {
    var sp = u.spec, ids = (sp.skills || []).slice();
    if (sp.ult) ids.push(sp.ult);
    bnRptRowGet(rowsAll, u.id, '__basic', '普攻', 'basic', '', true);
    ids.forEach(function (id) {
      var d = BN_SKILLS[id];
      if (d) bnRptRowGet(rowsAll, u.id, id, d.name, d.cat, d.power, true);
    });
  });
  function bucket(ev) {
    if (ev.basic || ev.ctr) return ['__basic', '普攻', 'basic', ''];
    if (ev.dot) return ['__dot', '持續傷害', 'dot', ''];
    if (ev.rx) { var rd = BN_SKILLS[ev.rx]; return [ev.rx, rd ? rd.name : ev.rx, 'react', rd ? rd.power : '']; }
    if (cur[ev.src]) return cur[ev.src];
    return ['__misc', '其他', 'misc', ''];
  }
  for (i = 0; i < S.events.length; i++) {
    e = S.events[i];
    if (e.t === 'dmg' || e.t === 'heal' || e.t === 'revive') { hp[e.tgt] = e.hp; snap[e.r] = sums(); }
    if (e.t === 'skill') { cur[e.u] = [e.id, e.name, e.cat, (BN_SKILLS[e.id] || {}).power || '']; bnRptRowGet(rowsAll, e.u, e.id, e.name, e.cat, (BN_SKILLS[e.id] || {}).power, false).cnt++; }
    else if (e.t === 'act') { cur[e.u] = null; }
    else if (e.t === 'dmg') {
      if (e.src >= 0 && e.src !== e.tgt) {
        bk = bucket(e);
        bnRptRowGet(rowsAll, e.src, bk[0], bk[1], bk[2], bk[3], false).dmg += e.v;
        if (e.basic) bnRptRowGet(rowsAll, e.src, '__basic', '普攻', 'basic', '', true).cnt++;
      }
    }
    else if (e.t === 'heal') {
      if (e.src >= 0) {
        bk = cur[e.src] ? cur[e.src] : ['__misc', '其他', 'misc', ''];
        bnRptRowGet(rowsAll, e.src, bk[0], bk[1], bk[2], bk[3], false).heal += e.v;
      }
    }
  }
  // 逐回合句子:bnlog 既有轉句(bnLogBuild → bnLogItems)
  rep = bnLogBuild(S, rc, { res: { w: w, why: res.reason === 'wipe' ? 'wipe' : 'limit', r: res.rounds | 0, st: 0 }, stars: stars });
  items = bnLogItems(rep);
  for (i = 0; i < items.length; i++) {
    g = items[i];
    if (g.c === 'rd') continue;
    if (g.c === 'end' && g.txt.indexOf('══ 戰鬥結束') === 0) { endTxt = g.txt.replace(/^══ /, ''); continue; }
    (byR[g.r] = byR[g.r] || []).push({ c: g.c, txt: g.txt });
  }
  maxN = res.rounds | 0;
  lastSnap = snap[0];
  for (n = 0; n <= maxN; n++) {
    if (snap[n]) lastSnap = snap[n];
    rounds.push({ n: n, a: { left: Math.round(lastSnap.A) }, b: { left: Math.round(lastSnap.B) }, items: byR[n] || [] });
  }
  function sideOut(sd) {
    var list = S.units.filter(function (u) { return u.side === sd; }), sOpen = 0, sLeft = 0;
    list.sort(function (x, y) { var d = sd === me ? y.row - x.row : x.row - y.row; return d || x.idx - y.idx; });
    list.forEach(function (u) { sOpen += open[u.id] || 0; sLeft += Math.max(0, u.hp); });
    return {
      side: sd, open: Math.round(sOpen), left: Math.round(sLeft), wounded: Math.max(0, Math.round(sOpen - sLeft)), pct: sOpen > 0 ? Math.max(0, Math.min(1, sLeft / sOpen)) : 0,
      units: list.map(function (u) {
        var sp = u.spec, rows = bnRptRowsOf(rowsAll, u.id).filter(function (r) { return r.fixed || r.cnt > 0 || r.dmg > 0 || r.heal > 0; });
        return {
          id: u.id, name: sp.name, fig: sp.fig || '', fac: sp.fac, sex: sp.sex || '', main: sp.main || '', traits: (sp.traits || []).slice(), troop: sp.troop, gr: sp.gr | 0, grTxt: BNLOG_GR[sp.gr | 0] || '',
          star: sd === 'A' ? (stars[u.idx] | 0) : 0, pos: u.row === 2 ? '主將' : '副將', row: u.row,
          hp: Math.max(0, Math.round(u.hp)), hpOpen: Math.round(open[u.id] || 0), max: Math.round(mx[u.id] || u.maxHp), dead: !u.alive,
          sk: rows.map(function (r) { return { id: r.id, name: r.name, cat: r.cat, pw: r.pw, cnt: r.cnt, dmg: Math.round(r.dmg), heal: Math.round(r.heal) }; })
        };
      })
    };
  }
  uOut = { mine: sideOut(me), enemy: sideOut(en) };
  return {
    mySide: me, enemySide: en, win: w,
    mineRes: w === me ? '勝' : (w === 'draw' ? '平' : '敗'), enemyRes: w === en ? '勝' : (w === 'draw' ? '平' : '敗'),
    reason: res.reason, reasonTxt: BNLOG_WHY[res.reason] || String(res.reason || ''), rounds: rounds, maxRound: res.rounds | 0, endTxt: endTxt, seed: rec.seed >>> 0,
    mine: uOut.mine, enemy: uOut.enemy, hpRes: res.hp
  };
}

// 範例戰鬥(?rpt=1 與測試用):我方 劉備(主將) / 關羽 / 張飛(副將);敵方 曹操 / 夏侯惇 / 呂布 —— 以名冊名人組 3v3,固定種子
function bnRptSampleRec() {
  var A = [['liubei', 2], ['guanyu', 1], ['zhangfei', 0]], B = [['lvbu', 2], ['caocao', 1], ['zhaoyun', 0]];
  function team(list) { return list.map(function (p) { return bnUnitSpec(bnRandomCard(null, 4, p[0]), { row: p[1], col: 0 }); }); }
  return { v: BN_REC_VER, seed: 20261112,teamA: bnBuildTeam(team(A)).units, teamB: bnBuildTeam(team(B)).units, opts: { events: true, stars: [3, 2, 2] } };
}

// ───────── DOM ─────────
// 主持人吐槽:勝 / 敗 / 平 各 4 句,依 rec.seed 取一句(可重現)
var BNRPT_HOST = {
  '勝': ['這仗打得漂亮!', '敵軍表示:好痛啊~', '收兵回營吃大餐!', '對手連跑都來不及!'],
  '敗': ['下次記得多帶點兵…', '別氣餒,明天再來!', '剛剛是戰術撤退啦…', '先回去補補兵力吧!'],
  '平': ['打到雙方都累啦~', '這算誰贏呢?', '平手!下次再分高下', '大家握握手吧!']
};
var BNRPT_RIB = { '勝': '大勝', '敗': '敗北', '平': '平手' };
function bnRptHostLine(res, seed) { var a = BNRPT_HOST[res] || BNRPT_HOST['平']; return a[(seed >>> 0) % a.length]; }
function bnRptQc(gr) { var g = gr | 0; return g >= 4 ? 'var(--q4)' : (g === 3 ? 'var(--q3)' : (g === 2 ? 'var(--q2)' : 'var(--q1)')); }
function bnRptFigSrc(u) {
  if (u.fig) return 'assets/fullbody/' + u.fig + '.webp';
  return typeof bnstTroopSrc === 'function' ? bnstTroopSrc(u.troop) : 'assets/fullbody/bn_body_inf.webp';
}
function bnRptImg(u) {
  var fb = typeof bnstTroopSrc === 'function' ? bnstTroopSrc(u.troop) : 'assets/fullbody/bn_body_inf.webp';
  return '<img src="' + bnRptEsc(bnRptFigSrc(u)) + '" alt="" draggable="false" onerror="this.onerror=null;this.src=\'' + fb + '\'">';
}
function bnRptPortrait(u) {
  var c, h = '', fb = Array.from(String(u.name || '?'))[0] || '?';
  if (typeof cuPortraitImg === 'function') {
    c = { fig: u.fig, gr: u.gr, name: u.name, sex: u.sex, main: u.main, tr: u.traits, ja: {}, fac: u.fac };
    h = cuPortraitImg(c, true) || '';
  }
  if (h) return '<span class="bnr-pt">' + h + '</span>';
  return '<span class="bnr-pt bnr-pt-fb" style="background:' + BNRPT_GRC[u.gr | 0] + '">' + bnRptEsc(fb) + '</span>';
}
// 單位的戰法列:普攻 + 殺敵 / 救援最高的 2 個戰法(其餘在詳情)
function bnRptTopRows(u) {
  var basic = u.sk.filter(function (r) { return r.id === '__basic'; }), rest = u.sk.filter(function (r) { return r.id !== '__basic'; });
  rest.sort(function (a, b) { return (b.dmg + b.heal) - (a.dmg + a.heal); });
  return basic.concat(rest.slice(0, 2));
}
function bnRptRowHtml(r) {
  var g = /^[SAB]$/.test(String(r.pw || '')) ? '<i class="g ' + r.pw + '">' + r.pw + '</i>' : '', num = r.dmg ? '殺 <em>' + r.dmg + '</em>' : (r.heal ? '救 <em>' + r.heal + '</em>' : r.cnt + ' 次');
  return '<div class="bnr-row"><span>' + g + bnRptEsc(r.name) + '</span><span>' + num + '</span></div>';
}
function bnRptWho(u, side, cls) {
  var flag = u.row === 2 ? '<span class="bnr-flag" style="background:' + (side === 'mine' ? '#1f7f92' : '#c2321f') + '">帥</span>' : '';
  return '<div class="bnr-who' + (u.dead ? ' dead' : '') + '" style="--qc:' + bnRptQc(u.gr) + '">' + flag + bnRptImg(u) + '<span class="bnr-ring"></span>' + (u.dead ? '<span class="ld-stamp">潰</span>' : '') + '</div>';
}
function bnRptFace(u) { return u.fig ? '<span class="bnr-face">' + bnRptImg(u) + '</span>' : '<span class="bnr-face">' + bnRptPortrait(u) + '</span>'; }
// 全場殺敵最多者(MVP);沒有人造成傷害則回 null
function bnRptMvp(d) {
  var top = 0, mvp = null;
  d.mine.units.concat(d.enemy.units).forEach(function (u) { var k = u.sk.reduce(function (s, x) { return s + x.dmg; }, 0); if (k > top) { top = k; mvp = u; } });
  return mvp;
}
function bnRptCardHtml(u, side, isMvp) {
  var rows = bnRptTopRows(u), face = bnRptFace(u);
  return '<div class="bnr-cd ld-panel' + (side === 'en' ? ' en' : '') + (u.dead ? ' dead' : '') + '" style="--qc:' + bnRptQc(u.gr) + '">' + face + (isMvp ? '<span class="bnr-mvp">MVP</span>' : '') +
    '<b>' + bnRptEsc(u.name) + '</b>' + rows.map(bnRptRowHtml).join('') + '</div>';
}
function bnRptSideHtml(s, key, label) {   // 舊版相容(不再使用):簡單兵力摘要
  return '<section class="bnr-side ' + key + '"><b>' + label + '</b> 兵力 ' + s.left + ' / ' + s.open + ' · 傷兵 ' + s.wounded + '</section>';
}
function bnRptLootHtml(loot) {
  var list = Array.isArray(loot) ? loot : (loot ? [loot] : []), parts = [];
  list.forEach(function (x) {
    if (typeof x === 'object' && x) parts.push(bnRptEsc(x.name || '') + (x.v !== undefined ? ' ' + bnRptEsc(x.v) : ''));
    else if (x !== undefined && x !== null && x !== '') parts.push(bnRptEsc(x));
  });
  return '<div class="bnr-loot">戰果' + (parts.length ? parts.map(function (p) { return '<span>' + p + '</span>'; }).join('') : '<span>—</span>') + '</div>';
}
function bnRptConfetti(seed) {
  var cs = ['#f5c542', '#d9452b', '#3fb4c9', '#fbf1dc', '#b46cff'], s = (seed >>> 0) || 1, h = '', i;
  function rnd() { s = (s * 1103515245 + 12345) >>> 0; return (s >>> 8) / 16777216; }
  for (i = 0; i < 18; i++) h += '<i class="bnr-conf" style="left:' + Math.round(150 + rnd() * 680) + 'px;background:' + cs[i % 5] + ';animation-delay:' + (rnd() * 2.6).toFixed(2) + 's;animation-duration:' + (2.2 + rnd() * 1.4).toFixed(2) + 's"></i>';
  return h;
}
var BNRPT_TABS = [['result', '結果'], ['stats', '戰法統計'], ['rounds', '逐回合']];
// 頂列:左上木牌(‹ 戰報)+ 右側頁籤(結果 / 戰法統計 / 逐回合);active = 目前頁籤 key,backAct = ‹ 的動作
function bnRptHeadHtml(d, active, backAct) {
  return '<div class="bnr-hd"><span class="ld-plaque"><span class="bnr-back" data-act="' + backAct + '">‹</span><b>戰報</b><small>第 ' + d.maxRound + ' 回合 · ' + bnRptEsc(d.reasonTxt) + '</small></span><span class="bnr-tabs">' +
    BNRPT_TABS.map(function (t) { return '<span class="ld-tab' + (t[0] === active ? ' on' : '') + '" data-act="t-' + t[0] + '">' + t[1] + '</span>'; }).join('') + '</span></div>';
}
// 場景背景:同 bnstage 的場景找圖規則(rec.opts.scene → bnstScenePath),載入成功才換上,否則維持 CSS 預設圖
function bnRptScene() {
  var bg = BNRPT.el && BNRPT.el.querySelector ? BNRPT.el.querySelector('.bnr-bg') : null, sc = BNRPT.rec && BNRPT.rec.opts ? BNRPT.rec.opts.scene : '', src, im;
  if (!bg || !sc || typeof bnstScenePath !== 'function' || typeof Image === 'undefined') return;
  src = bnstScenePath(sc);
  im = new Image();
  im.onload = function () { if (bg.parentNode) bg.style.backgroundImage = 'url(' + src + ')'; };
  im.src = src;
}
function bnRptReplayHtml() {
  if (!BNRPT.rec) return '';
  return bnRptReplayable(BNRPT.rec) ? '<button type="button" class="ld-btn" data-act="replay">重播</button>' : '<small class="bnr-norep">舊版戰報,無法重播</small>';
}
function bnRptResultHtml(d) {
  var o = BNRPT.opts || {}, res = d.mineRes, win = res === '勝', lose = res === '敗', mvp = bnRptMvp(d), tot = d.mine.left + d.enemy.left, pct = tot > 0 ? Math.round(d.mine.left / tot * 100) : 50, bm, be, enSide = d.enemyRes === '勝';
  bm = (d.mine.units.filter(function (u) { return u.row === 2; })[0] || { name: '?' }).name;
  be = (d.enemy.units.filter(function (u) { return u.row === 2; })[0] || { name: '?' }).name;
  return '<div class="bnr-pg"><div class="bnr-bg"></div>' + bnRptHeadHtml(d, 'result', 'close') +
    '<div class="bnr-host"><div class="ld-bubble">' + bnRptEsc(bnRptHostLine(res, d.seed)) + '</div><img src="assets/fullbody/caiyong.webp" alt="" draggable="false"></div>' +
    '<div class="bnr-ban">' + (win ? '<div class="bnr-rays"></div>' : '') + '<div class="bnr-ribbon' + (lose ? ' lose' : (res === '平' ? ' draw' : '')) + '"><span class="ld-outline">' + BNRPT_RIB[res] + '</span></div><small>我方 ' + bnRptEsc(bm) + ' vs 敵方 ' + bnRptEsc(be) + '</small></div>' +
    '<div class="bnr-tug"><span>我 ' + d.mine.left + '</span><div class="bar"><i style="--w:' + pct + '%"></i></div><span>敵 ' + d.enemy.left + '</span></div>' +
    '<div class="bnr-field"><div class="bnr-team mine' + (win ? ' win' : '') + (lose ? ' lose' : '') + '">' + d.mine.units.map(function (u) { return bnRptWho(u, 'mine'); }).join('') + '</div><div class="bnr-vs ld-outline">VS</div>' +
    '<div class="bnr-team foe' + (enSide ? ' win' : '') + '">' + d.enemy.units.map(function (u) { return bnRptWho(u, 'foe'); }).join('') + '</div></div>' +
    '<div class="bnr-cards">' + d.mine.units.map(function (u) { return bnRptCardHtml(u, 'mine', u === mvp); }).join('') + d.enemy.units.map(function (u) { return bnRptCardHtml(u, 'en', u === mvp); }).join('') + '</div>' +
    (o.loot !== undefined ? bnRptLootHtml(o.loot) : '') +
    '<div class="bnr-btns">' + bnRptReplayHtml() + (BNRPT.opts && BNRPT.opts.logId && typeof bnLogOpen === 'function' ? '<button type="button" class="ld-btn sub" data-act="txt">文字戰報</button>' : '') + '<button type="button" class="ld-btn sub" data-act="detail">詳情</button><button type="button" class="ld-btn sub" data-act="close">離開</button></div>' +
    (win ? bnRptConfetti(d.seed) : '') + '</div>';
}
// 句子高亮(純函式,回 HTML):先跳脫,再把「戰法名」變金黃膠囊、傷害數字朱紅粗體、治療 / 護盾數字綠色粗體、暴擊加火花
function bnRptHl(txt, c) {
  var h = bnRptEsc(txt);
  h = h.replace(/「([^」]*)」/g, '<span class="ld-pill gold">$1</span>');
  h = h.replace(/(傷害 )(\d+)/g, '$1<b class="bnr-nd">$2</b>');
  if (c === 'heal') h = h.replace(/(\+)(\d+)/, '$1<b class="bnr-nh">$2</b>');
  h = h.replace(/暴擊/g, '<span class="bnr-crit">✦暴擊</span>');
  return h;
}
// 句首「我·名」「敵·名」(可帶「✖ 」或【…】前綴)→ {u, side:'mine'|'enemy'};找不到回 null。「我」= 戰報 teamA,依 d.mySide 對應我方 / 敵方
function bnRptWhoOf(d, txt) {
  var m = /^(?:✖ |【[^】]*】)?(我|敵)·(\S+)/.exec(String(txt || '')), side, list, i;
  if (!m) return null;
  side = (m[1] === '我') === (d.mySide === 'A') ? 'mine' : 'enemy';
  list = d[side].units;
  for (i = 0; i < list.length; i++) if (list[i].name === m[2]) return { u: list[i], side: side };
  return null;
}
function bnRptLineHtml(it, d) {
  var t = String(it.txt || ''), w = d ? bnRptWhoOf(d, t) : null, side = w ? (w.side === 'mine' ? ' me' : ' foe') : '';
  return '<div class="bnr-ln c-' + bnRptEsc(it.c) + side + '">' + (w ? '<span class="bnr-mini" style="--qc:' + bnRptQc(w.u.gr) + '">' + bnRptFace(w.u) + '</span>' : '') + '<span class="bnr-tx">' + bnRptHl(t, it.c) + '</span></div>';
}
// 某回合結束時的雙方兵力(我方 / 敵方視角)
function bnRptRoundLR(d, g) { return d.mySide === 'A' ? { m: g.a.left, e: g.b.left } : { m: g.b.left, e: g.a.left }; }
var BNRPT_POS = { 2: '主將', 1: '中衛', 0: '前鋒' };
function bnRptBar(kind, label, v, max) {
  if (!(v > 0)) return '<span class="bb ' + kind + ' z"><em>' + label + '</em><b>—</b></span>';
  return '<span class="bb ' + kind + '"><em>' + label + '</em><u><i style="width:' + Math.max(4, Math.round(v / (max || 1) * 100)) + '%"></i></u><b>' + v + '</b></span>';
}
function bnRptSkHtml(r, maxD, maxH) {
  var g = /^[SAB]$/.test(String(r.pw || '')) ? '<i class="g ' + r.pw + '">' + r.pw + '</i>' : '';
  return '<div class="bnr-sk"><div class="t">' + g + '<span class="nm">' + bnRptEsc(r.name) + '</span><i class="ld-pill">' + r.cnt + ' 次</i></div><div class="bs">' + bnRptBar('k', '殺', r.dmg, maxD) + bnRptBar('h', '救', r.heal, maxH) + '</div></div>';
}
function bnRptStatCardHtml(u, side, isMvp, maxD, maxH) {
  return '<div class="bnr-sc ld-panel' + (side === 'enemy' ? ' en' : '') + (u.dead ? ' dead' : '') + '" style="--qc:' + bnRptQc(u.gr) + '"><div class="hh">' + bnRptFace(u) + (u.dead ? '<span class="ld-stamp">潰</span>' : '') + (isMvp ? '<span class="bnr-mvp">MVP</span>' : '') +
    '<b>' + bnRptEsc(u.name) + '</b><small>' + (BNRPT_POS[u.row] || u.pos) + '</small></div>' + u.sk.map(function (r) { return bnRptSkHtml(r, maxD, maxH); }).join('') + '</div>';
}
// 戰法統計頁籤:上排我方 3 張、下排敵方 3 張(皆主將、中衛、前鋒);橫條長度以全場最大值為 100%(殺敵、救援各自的最大值)
function bnRptStatsHtml(d) {
  var all = d.mine.units.concat(d.enemy.units), maxD = 0, maxH = 0, mvp = bnRptMvp(d);
  function ord(list) { return list.slice().sort(function (x, y) { return y.row - x.row; }); }
  all.forEach(function (u) { u.sk.forEach(function (r) { if (r.dmg > maxD) maxD = r.dmg; if (r.heal > maxH) maxH = r.heal; }); });
  return '<div class="bnr-stats">' + ord(d.mine.units).map(function (u) { return bnRptStatCardHtml(u, 'mine', u === mvp, maxD, maxH); }).join('') + ord(d.enemy.units).map(function (u) { return bnRptStatCardHtml(u, 'enemy', u === mvp, maxD, maxH); }).join('') + '</div>';
}
function bnRptTimelineHtml(d, sel) {
  return '<div class="bnr-tl">' + d.rounds.map(function (g) {
    var lr = bnRptRoundLR(d, g), tot = lr.m + lr.e, p = tot > 0 ? Math.round(lr.m / tot * 100) : 50;
    return '<div class="bnr-tp ld-tab' + (g.n === sel ? ' on' : '') + '" data-act="rd" data-r="' + g.n + '"><span>' + (g.n === 0 ? '開戰前' : g.n) + '</span><i class="tb"><s style="width:' + p + '%"></s></i></div>';
  }).join('') + '</div>';
}
function bnRptRoundBodyHtml(d, n) {
  var g = d.rounds[n], lr, h;
  if (!g) return '';
  lr = bnRptRoundLR(d, g);
  h = '<div class="bnr-rh"><b>' + (n === 0 ? '開戰前' : '第 ' + n + ' 回合') + ' · 我 ' + lr.m + ' / 敵 ' + lr.e + '</b>' +
    (n > 0 && bnRptReplayable(BNRPT.rec) ? '<button type="button" class="ld-btn" data-act="from" data-r="' + n + '">從這回合重播</button>' : '') + '</div><div class="bnr-lns">' +
    (g.items.length ? g.items.map(function (it) { return bnRptLineHtml(it, d); }).join('') : '<div class="bnr-ln"><span class="bnr-tx">(本回合無事件)</span></div>');
  if (n === d.maxRound && d.endTxt) h += '<div class="bnr-fin">' + bnRptEsc(d.endTxt) + '</div>';
  return h + '</div>';
}
function bnRptRoundsHtml(d, sel) {
  return '<div class="bnr-rds">' + bnRptTimelineHtml(d, sel) + '<div class="bnr-rb ld-panel">' + bnRptRoundBodyHtml(d, sel) + '</div></div>';
}
// 詳情頁:tab = 'stats'(預設)| 'rounds';rd = 逐回合選中的回合(預設 1)
function bnRptDetailHtml(d, tab, rd) {
  var rounds = tab === 'rounds', sel = Math.max(0, Math.min(d.maxRound, (rd === undefined ? 1 : rd) | 0));
  if (rounds && d.maxRound < 1) sel = 0;
  return '<div class="bnr-pg"><div class="bnr-bg"></div>' + bnRptHeadHtml(d, rounds ? 'rounds' : 'stats', 'back') +
    '<div class="bnr-det' + (rounds ? ' rds' : '') + '">' + (rounds ? bnRptRoundsHtml(d, sel) : bnRptStatsHtml(d)) + '</div></div>';
}
// 結果頁:844×390 基準等比縮放置中(同戰鬥舞台);數字從 0 跳上去
function bnRptFit() {
  var el = BNRPT.el, pg, W, H, s;
  if (!el || !el.querySelector) return;
  pg = el.querySelector('.bnr-pg');
  if (!pg) return;
  W = (typeof window !== 'undefined' && window.innerWidth) || 844; H = (typeof window !== 'undefined' && window.innerHeight) || 390;
  s = Math.min(W / 844, H / 390);
  pg.style.transform = 'translate(-50%,-50%) scale(' + (s > 0 ? s : 1) + ')';
}
function bnRptCountUp() {
  var el = BNRPT.el, list, t0, i;
  if (!el || !el.querySelectorAll || typeof requestAnimationFrame !== 'function') return;
  list = el.querySelectorAll('.bnr-row em');
  if (!list || !list.length) return;
  for (i = 0; i < list.length; i++) { list[i].setAttribute('data-n', list[i].textContent); list[i].textContent = '0'; }
  t0 = Date.now() + 500;
  (function tick() {
    var p = Math.min(1, Math.max(0, (Date.now() - t0) / 900)), k;
    if (BNRPT.el !== el) return;
    for (k = 0; k < list.length; k++) list[k].textContent = String(Math.round(+list[k].getAttribute('data-n') * p));
    if (p < 1) requestAnimationFrame(tick);
  })();
}
function bnRptRender() {
  var el = BNRPT.el, d = BNRPT.data;
  if (!el || !d) return;
  el.innerHTML = BNRPT.view === 'detail' ? bnRptDetailHtml(d, BNRPT.tab, BNRPT.rd) : bnRptResultHtml(d);
  el.className = 'ld-noselect ' + (BNRPT.view === 'detail' ? 'bnr-v-detail' : 'bnr-v-result');
  bnRptFit(); bnRptScene();
  if (BNRPT.view !== 'detail') bnRptCountUp();
}
function bnRptOnClick(e) {
  var t = e && e.target, b = t && t.closest ? t.closest('[data-act]') : null, a;
  if (!b) return;
  a = b.getAttribute('data-act');
  if (a === 'close') { bnRptClose(); return; }
  if (a === 'txt') { bnRptTxt(); return; }
  if (a === 'replay') {
    if (!bnRptReplayable(BNRPT.rec) || typeof bnBattleShow !== 'function') return;
    var rp = BNRPT.rec, side = BNRPT.opts && BNRPT.opts.mySide === 'B' ? 'B' : 'A';
    bnRptClose(); bnBattleShow(rp, { mode: 'play', mySide: side });
    return;
  }
  if (a === 'from') {   // 從第 N 回合重播:bnBattleShow → bncbOpen(fromRound) → bncbFrom
    var fr = +b.getAttribute('data-r'), rp2 = BNRPT.rec, side2 = BNRPT.opts && BNRPT.opts.mySide === 'B' ? 'B' : 'A';
    if (!(fr > 0) || !bnRptReplayable(rp2) || typeof bnBattleShow !== 'function') return;
    bnRptClose(); bnBattleShow(rp2, { mode: 'play', mySide: side2, fromRound: fr });
    return;
  }
  if (a === 'rd') {
    var tl0 = BNRPT.el.querySelector ? BNRPT.el.querySelector('.bnr-tl') : null, st = tl0 ? [tl0.scrollTop, tl0.scrollLeft] : null, tl1;
    BNRPT.rd = +b.getAttribute('data-r') | 0; bnRptRender();
    tl1 = st && BNRPT.el.querySelector ? BNRPT.el.querySelector('.bnr-tl') : null;
    if (tl1) { tl1.scrollTop = st[0]; tl1.scrollLeft = st[1]; }
    return;
  }
  if (a === 't-result' || a === 'back') { BNRPT.view = 'result'; bnRptRender(); return; }
  if (a === 'detail' || a === 't-stats') { BNRPT.view = 'detail'; BNRPT.tab = 'stats'; bnRptRender(); return; }
  if (a === 't-rounds') { BNRPT.view = 'detail'; BNRPT.tab = 'rounds'; bnRptRender(); }
}
// 開全螢幕覆蓋層。opts = {mySide:'A'|'B', loot(可省略;字串或陣列,放中間戰果欄), view:'result'|'detail'}
// 文字戰報(舊逐步面板,含分享戰報碼):關掉結果頁,開該場 bnlog 檢視
function bnRptTxt() {
  var lid = BNRPT.opts && BNRPT.opts.logId;
  bnRptClose();
  if (lid && typeof bnLogOpen === 'function') { bnLogOpen('recent', lid); return true; }
  return false;
}
function bnRptOpen(rec, opts) {
  var el, o = opts || {};
  if (typeof document === 'undefined' || !document.body) return false;
  if (BNRPT.el) bnRptClose();
  BNRPT.rec = rec; BNRPT.opts = o; BNRPT.data = bnRptBuild(rec, o.mySide === 'B' ? 'B' : 'A'); BNRPT.view = o.view === 'detail' ? 'detail' : 'result'; BNRPT.tab = o.tab === 'rounds' ? 'rounds' : 'stats'; BNRPT.rd = 1;
  el =document.createElement('div');
  el.id = 'bnRpt'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', '戰報');
  el.className = 'ld-noselect';
  el.addEventListener('click', bnRptOnClick);
  if (typeof window !== 'undefined' && window.addEventListener) window.addEventListener('resize', bnRptFit);
  document.body.appendChild(el);
  BNRPT.el = el;
  bnRptRender();
  return true;
}
function bnRptClose() {
  var el = BNRPT.el;
  if (!el) return false;
  el.removeEventListener('click', bnRptOnClick);
  if (typeof window !== 'undefined' && window.removeEventListener) window.removeEventListener('resize', bnRptFit);
  if (el.parentNode) el.parentNode.removeChild(el);
  BNRPT.el = null; BNRPT.data = null; BNRPT.rec = null; BNRPT.view = 'result';
  return true;
}
function bnRptIsOpen() { return !!(BNRPT.el && BNRPT.el.parentNode); }

// 測試入口:網址 ?rpt=1 時自動開範例戰報(正式流程接線不在本批)
if (typeof window !== 'undefined' && typeof document !== 'undefined' && window.location && /[?&]rpt=1(&|$)/.test(String(window.location.search || ''))) {
  window.addEventListener('load', function () { bnRptOpen(bnRptSampleRec(), { mySide: 'A' }); });
}

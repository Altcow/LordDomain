// js/bnreport.js — 戰鬥結果戰報畫面(規格 文字戰鬥_規格.md 二;2026-11-15 戰報改版):戰鬥結束後唯一的「戰報」頁。
// 內容:勝敗(縮小置頂)+ 雙方剩餘兵力條 + 每位武將一張卡(每個戰法的 發動次數 / 傷害 / 治療、武將總傷害與總治療、剩餘兵力)+ 隊伍總傷害 / 總治療 / 剩餘兵力。
// 沒有「結果 / 戰法統計 / 逐回合」頁籤,也沒有詳情頁;逐回合文字在「文字戰報」(bnlog.js,含同樣的戰法統計)。
// 底部按鈕列(戰報外的功能都在這):重播、儲存戰報、(對戰)分享戰報碼、文字戰報、離開。離開 / 返回鍵 = opts.onLeave(關卡選擇或入口),沒給就只關閉。
// 純函式 bnRptBuild / bnRptSampleRec / bnRptResultHtml 不碰 DOM(node 可測);DOM:bnRptOpen / bnRptClose / bnRptLeave / bnRptHide。
// 資料:rec 用 bnRun 重跑(opts.events 強制 true)取得 events / result。
// rec.opts.stars(可省略):teamA 各位星階,敵方不顯示星階。
// 戰法統計:發動 = skill 事件(普攻 = 普攻命中次數);傷害 = 造成的傷害 dmg.v(不含自傷);治療 = heal.v。一個戰法可同時有傷害與治療,兩欄都列。
// 傷害 / 治療歸屬:普攻或反擊 → 普攻列;持續傷害 → 持續傷害列;反應 → 該反應列;其餘依施放者最近一次發動的戰法;無歸屬 → 其他。
// 武將明細(2026-11-17):units[].det = {acts,kills,taken,healIn,shield,self, basic/skill/follow/ctr/ult:{n,ph,st}, dot:{n,v}};sk[] 另帶 ph / st(物理 / 策略傷害)。
//   分類:反擊 → ctr;持續傷害(ty dot)→ dot;普攻 / 援護 → basic;協同追擊 / 追擊類戰法 → follow;大招 → ult;其餘(含反應)→ skill。ph / st 依 dmg 事件 ty(phys / strat)。
//   bnRptDtlHtml(u) / bnRptPanelHtml(d) 為共用明細元件(戰報頁、地圖戰報頁 wmgrp 共用);bnRptDetailToggle(btn) 展開 / 收合。
// 版面:不做 844×390 等比縮放,直向 / 橫向都用真實尺寸排版(手機優先,按鈕 ≥ 44px)。
// ES2017;不用 ?. ??;不用 canvas;全域 bnRpt 前綴。

var BNRPT = { el: null, rec: null, data: null, opts: {}, hidden: false, saved: false };
var BNRPT_GRC = ['#5b5b5b', '#2e7d4f', '#2f5fa8', '#7a3fa0', '#b8860b'];
// 戰報可否重播:rec.v 須 ≥ BN_REC_VER(普攻改射程內隨機後,舊戰報重算結果可能不同)。舊版只顯示結果,不給重播。
function bnRptReplayable(rec) { return !!rec && (rec.v | 0) >= BN_REC_VER; }

function bnRptEsc(s) { return String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

// 單位的戰法列(含普攻);static 列一律顯示,動態列(持續傷害 / 其他 / 反應 / 額外發動)只在有數字時顯示
function bnRptRowsOf(rowsAll, uid) { return rowsAll[uid] || []; }
function bnRptRowGet(rowsAll, uid, key, name, cat, pw, fixed) {
  var list = rowsAll[uid] || (rowsAll[uid] = []), i;
  for (i = 0; i < list.length; i++) if (list[i].id === key) return list[i];
  list.push({ id: key, name: name, cat: cat, pw: pw || '', cnt: 0, dmg: 0, ph: 0, st: 0, heal: 0, fixed: !!fixed });
  return list[list.length - 1];
}

function bnRptDetRound(d) {
  var o = { acts: d.acts | 0, kills: d.kills | 0, taken: Math.round(d.taken), healIn: Math.round(d.healIn), shield: Math.round(d.shield), self: Math.round(d.self), ultCast: d.ultCast | 0 };
  ['basic', 'skill', 'follow', 'ctr', 'ult'].forEach(function (k) { o[k] = { n: d[k].n, ph: Math.round(d[k].ph), st: Math.round(d[k].st) }; });
  o.dot = { n: d.dot.n, v: Math.round(d.dot.v) };
  return o;
}

// 純資料:回 {mySide, enemySide, win, mineRes, enemyRes, reason, reasonTxt, maxRound, seed, mine, enemy, hpRes}
// mine / enemy = {side, open, left, wounded, pct, dmg, heal, units:[{id,name,fig,troop,gr,grTxt,star,pos,row,hp,hpOpen,max,dead,dmg,heal,sk:[{id,name,cat,pw,cnt,dmg,heal}]}]}
// units[].dmg / heal = 該武將各戰法列加總;side.dmg / heal = 該隊各武將加總
function bnRptBuild(rec, mySide) {
  var me = mySide === 'B' ? 'B' : 'A', en = bnOpp(me), stars = (rec.opts && rec.opts.stars) || [], rc, S, res, hp = {}, mx = {}, open = {}, cur = {}, rowsAll = {}, rw, dk, dd, dets = {}, initEv, i, e, bk, w, uOut;
  rc = JSON.parse(JSON.stringify(rec));
  rc.opts = Object.assign({}, rec.opts || {}, { events: true });
  S = bnRun(rc);
  res = S.result || { winner: 'draw', reason: 'limit', rounds: S.round, hp: { A: 0, B: 0 } };
  w = res.winner;
  initEv = S.events.filter(function (x) { return x.t === 'init'; })[0];
  initEv.units.forEach(function (x) { hp[x.id] = x.hp; mx[x.id] = x.mx; open[x.id] = x.hp; });
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
  function detOf(uid) { return dets[uid] || (dets[uid] = { acts: 0, kills: 0, taken: 0, healIn: 0, shield: 0, self: 0, basic: { n: 0, ph: 0, st: 0 }, skill: { n: 0, ph: 0, st: 0 }, follow: { n: 0, ph: 0, st: 0 }, ctr: { n: 0, ph: 0, st: 0 }, ult: { n: 0, ph: 0, st: 0 }, dot: { n: 0, v: 0 }, ultCast: 0 }); }
  function kindOf(ev) {
    var c;
    if (ev.ctr) return 'ctr';
    if (ev.dot || ev.ty === 'dot') return 'dot';
    if (ev.basic) return 'basic';
    if (ev.rx) return 'skill';
    c = cur[ev.src];
    if (c && (c[0] === 'follow' || c[2] === 'pursuit')) return 'follow';
    if (c && c[2] === 'ult') return 'ult';
    return 'skill';
  }
  function bucket(ev) {
    if (ev.basic || ev.ctr) return ['__basic', '普攻', 'basic', ''];
    if (ev.dot) return ['__dot', '持續傷害', 'dot', ''];
    if (ev.rx) { var rd = BN_SKILLS[ev.rx]; return [ev.rx, rd ? rd.name : ev.rx, 'react', rd ? rd.power : '']; }
    if (cur[ev.src]) return cur[ev.src];
    return ['__misc', '其他', 'misc', ''];
  }
  for (i = 0; i < S.events.length; i++) {
    e = S.events[i];
    if (e.t === 'dmg' || e.t === 'heal' || e.t === 'revive') hp[e.tgt] = e.hp;
    if (e.t === 'skill') { cur[e.u] = [e.id, e.name, e.cat, (BN_SKILLS[e.id] || {}).power || '']; bnRptRowGet(rowsAll, e.u, e.id, e.name, e.cat, (BN_SKILLS[e.id] || {}).power, false).cnt++; }
    else if (e.t === 'act') { cur[e.u] = null; detOf(e.u).acts++; }
    else if (e.t === 'ult') { detOf(e.u).ultCast++; }
    else if (e.t === 'kill') { if (e.src >= 0) detOf(e.src).kills++; }
    else if (e.t === 'shield') { if (e.src >= 0) detOf(e.src).shield += e.v; }
    else if (e.t === 'dmg') {
      detOf(e.tgt).taken += e.v;
      if (e.src >= 0 && e.src === e.tgt) detOf(e.tgt).self += e.v;
      if (e.src >= 0 && e.src !== e.tgt) {
        bk = bucket(e);
        rw = bnRptRowGet(rowsAll, e.src, bk[0], bk[1], bk[2], bk[3], false);
        rw.dmg += e.v;
        dk = kindOf(e); dd = detOf(e.src)[dk]; dd.n++;
        if (dk === 'dot') dd.v += e.v;
        else if (e.ty === 'strat') { dd.st += e.v; rw.st += e.v; } else { dd.ph += e.v; rw.ph += e.v; }
        if (e.basic) bnRptRowGet(rowsAll, e.src, '__basic', '普攻', 'basic', '', true).cnt++;
      }
    }
    else if (e.t === 'heal') {
      detOf(e.tgt).healIn += e.v;
      if (e.src >= 0) {
        bk = cur[e.src] ? cur[e.src] : ['__misc', '其他', 'misc', ''];
        bnRptRowGet(rowsAll, e.src, bk[0], bk[1], bk[2], bk[3], false).heal += e.v;
      }
    }
  }
  function sideOut(sd) {
    var list = S.units.filter(function (u) { return u.side === sd; }), sOpen = 0, sLeft = 0, sD = 0, sH = 0, units;
    list.sort(function (x, y) { var d = sd === me ? y.row - x.row : x.row - y.row; return d || x.idx - y.idx; });
    list.forEach(function (u) { sOpen += open[u.id] || 0; sLeft += Math.max(0, u.hp); });
    units = list.map(function (u) {
      var sp = u.spec, rows = bnRptRowsOf(rowsAll, u.id).filter(function (r) { return r.fixed || r.cnt > 0 || r.dmg > 0 || r.heal > 0; }), sk, tD = 0, tH = 0, dt = detOf(u.id), det;
      sk = rows.map(function (r) { var o = { id: r.id, name: r.name, cat: r.cat, pw: r.pw, cnt: r.cnt, dmg: Math.round(r.dmg), heal: Math.round(r.heal), ph: Math.round(r.ph), st: Math.round(r.st) }; tD += o.dmg; tH += o.heal; return o; });
      sD += tD; sH += tH;
      det = bnRptDetRound(dt);
      return {
        id: u.id, name: sp.name, fig: sp.fig || '', fac: sp.fac, sex: sp.sex || '', main: sp.main || '', traits: (sp.traits || []).slice(), troop: sp.troop, gr: sp.gr | 0, grTxt: BNLOG_GR[sp.gr | 0] || '',
        star: sd === 'A' ? (stars[u.idx] | 0) : 0, pos: u.row === 2 ? '主將' : '副將', row: u.row,
        hp: Math.max(0, Math.round(u.hp)), hpOpen: Math.round(open[u.id] || 0), max: Math.round(mx[u.id] || u.maxHp), dead: !u.alive, dmg: tD, heal: tH, sk: sk, det: det
      };
    });
    return { side: sd, open: Math.round(sOpen), left: Math.round(sLeft), wounded: Math.max(0, Math.round(sOpen - sLeft)), pct: sOpen > 0 ? Math.max(0, Math.min(1, sLeft / sOpen)) : 0, dmg: sD, heal: sH, units: units };
  }
  uOut = { mine: sideOut(me), enemy: sideOut(en) };
  return {
    mySide: me, enemySide: en, win: w,
    mineRes: w === me ? '勝' : (w === 'draw' ? '平' : '敗'), enemyRes: w === en ? '勝' : (w === 'draw' ? '平' : '敗'),
    reason: res.reason, reasonTxt: BNLOG_WHY[res.reason] || String(res.reason || ''), maxRound: res.rounds | 0, seed: rec.seed >>> 0,
    mine: uOut.mine, enemy: uOut.enemy, hpRes: res.hp
  };
}

// 範例戰鬥(?rpt=1 與測試用):我方 劉備(主將) / 關羽 / 張飛(副將);敵方 曹操 / 夏侯惇 / 呂布 —— 以名冊名人組 3v3,固定種子
function bnRptSampleRec() {
  var A = [['liubei', 2], ['guanyu', 1], ['zhangfei', 0]], B = [['lvbu', 2], ['caocao', 1], ['zhaoyun', 0]];
  function team(list) { return list.map(function (p) { return bnUnitSpec(bnRandomCard(null, 4, p[0]), { row: p[1], col: 0 }); }); }
  return { v: BN_REC_VER, seed: 20261112, teamA: bnBuildTeam(team(A)).units, teamB: bnBuildTeam(team(B)).units, opts: { events: true, stars: [3, 2, 2] } };
}

// ───────── DOM ─────────
var BNRPT_RIB = { '勝': '大勝', '敗': '敗北', '平': '平手' };
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
// 全場傷害最多者(MVP);沒有人造成傷害則回 null
function bnRptMvp(d) {
  var top = 0, mvp = null;
  d.mine.units.concat(d.enemy.units).forEach(function (u) { if (u.dmg > top) { top = u.dmg; mvp = u; } });
  return mvp;
}
// 數字格:有值才顯示數字,0 顯示淡色「—」(傷害與治療同時有也都列出)
function bnRptNum(v) { return v > 0 ? '<b>' + v + '</b>' : '<i>—</i>'; }
function bnRptCell(cls, v) { return '<span class="' + cls + '">' + bnRptNum(v) + '</span>'; }
function bnRptSkRow(r) {
  var g = /^[SAB]$/.test(String(r.pw || '')) ? '<i class="g ' + r.pw + '">' + r.pw + '</i>' : '';
  return '<div class="bnr-sk' + (r.dmg || r.heal ? '' : ' z') + '"><span class="n">' + g + '<span class="nm">' + bnRptEsc(r.name) + '</span></span><span class="c">' + r.cnt + '</span><span class="k">' + bnRptNum(r.dmg) + '</span><span class="h">' + bnRptNum(r.heal) + '</span></div>';
}
var BNRPT_KINDS = [['basic', '普攻'], ['skill', '戰法'], ['follow', '追擊'], ['ctr', '反擊'], ['ult', '大招']];
// 共用明細元件(戰報頁 / 地圖戰報頁):一列一筆。上:出手 / 擊倒 / 承受 / 受治療 / 護盾;中:類別表(普攻 戰法 追擊 反擊 大招 持續與反應;次 / 物理 / 策略 / 持續);下:各戰法表(戰法 / 次 / 傷害 / 治療,與文字戰報同欄位)
function bnRptDtlHtml(u) {
  var d = u.det, h, tp = 0, ts = 0;
  if (!d) return '';
  h = '<div class="bnr-dtl"><div class="bd-st"><span>出手 <b>' + d.acts + '</b></span><span>擊倒 <b>' + d.kills + '</b></span><span>承受傷害 <b class="t">' + d.taken + '</b></span><span>受治療 <b class="h">' + d.healIn + '</b></span>' + (d.shield ? '<span>護盾 <b>' + d.shield + '</b></span>' : '') + '</div>';
  h += '<div class="bd-t"><div class="bd-h"><span>類別</span><span>次</span><span>物理</span><span>策略</span><span>持續</span></div>';
  BNRPT_KINDS.forEach(function (k) {
    var x = d[k[0]];
    tp += x.ph; ts += x.st;
    h += '<div class="bd-r' + (x.n ? '' : ' z') + '"><span class="n">' + k[1] + '</span><span class="c">' + x.n + '</span>' + bnRptCell('p', x.ph) + bnRptCell('s', x.st) + '<span class="o"><i>—</i></span></div>';
  });
  h += '<div class="bd-r' + (d.dot.n ? '' : ' z') + '"><span class="n">持續與反應</span><span class="c">' + d.dot.n + '</span><span class="p"><i>—</i></span><span class="s"><i>—</i></span>' + bnRptCell('o', d.dot.v) + '</div>';
  h += '<div class="bd-r sum"><span class="n">合計</span><span class="c"></span>' + bnRptCell('p', tp) + bnRptCell('s', ts) + bnRptCell('o', d.dot.v) + '</div></div>';
  h += '<div class="bd-t sk"><div class="bnr-sh"><span>戰法</span><span>次</span><span>傷害</span><span>治療</span></div>' + u.sk.map(bnRptSkRow).join('') + '</div></div>';
  return h;
}
function bnRptWho(u, side) {
  var flag = u.row === 2 ? '<span class="bnr-flag" style="background:' + (side === 'mine' ? '#1f7f92' : '#c2321f') + '">帥</span>' : '';
  return '<div class="bnr-who' + (u.dead ? ' dead' : '') + '" style="--qc:' + bnRptQc(u.gr) + '">' + flag + bnRptImg(u) + '<span class="bnr-ring"></span>' + (u.dead ? '<span class="ld-stamp">潰</span>' : '') + '</div>';
}
function bnRptFace(u) { return u.fig ? '<span class="bnr-face">' + bnRptImg(u) + '</span>' : '<span class="bnr-face">' + bnRptPortrait(u) + '</span>'; }
function bnRptPhSt(u) { var d = u.det, p = 0, q = 0; if (d) BNRPT_KINDS.forEach(function (k) { p += d[k[0]].ph; q += d[k[0]].st; }); return [p, q]; }
// 單位卡:頭(點了展開 / 收合明細:人像、名字、站位、兵力條、總傷害(物理 / 策略)/ 總治療)+ 明細(.bnr-dtl,預設收起)
function bnRptCardHtml(u, side, isMvp) {
  var pct = u.hpOpen > 0 ? Math.max(0, Math.min(100, Math.round(u.hp / u.hpOpen * 100))) : 0, ps = bnRptPhSt(u);
  return '<div class="bnr-cd ld-panel' + (side === 'enemy' ? ' en' : '') + (u.dead ? ' dead' : '') + '" style="--qc:' + bnRptQc(u.gr) + '">' +
    '<div class="bnr-uh" data-act="tg" role="button" tabindex="0" aria-expanded="false">' + bnRptWho(u, side) + '<div class="bnr-un"><div class="bnr-nm"><b>' + bnRptEsc(u.name) + '</b><small>' + u.pos + (u.star ? ' · ' + u.star + '星' : '') + '</small>' + (isMvp ? '<span class="bnr-mvp">MVP</span>' : '') + '<em class="bnr-chev">明細</em></div>' +
    '<div class="bnr-hp"><u><i style="width:' + pct + '%"></i></u><em>' + (u.dead ? '潰滅' : '兵力 ' + u.hp + ' / ' + u.hpOpen) + '</em></div>' +
    '<div class="bnr-tot"><span>總傷害 <b class="k">' + u.dmg + '</b></span><span>總治療 <b class="h">' + u.heal + '</b></span></div>' +
    '<div class="bnr-tot2"><span>物理 <b class="p">' + ps[0] + '</b></span><span>策略 <b class="s">' + ps[1] + '</b></span></div></div></div>' +
    bnRptDtlHtml(u) + '</div>';
}
// 展開 / 收合:btn = 卡片頭(或其內元素);回 true = 已展開
function bnRptDetailToggle(btn) {
  var cd = btn && btn.closest ? btn.closest('.bnr-cd') : null, on, hd;
  if (!cd) return false;
  on = !(cd.classList && cd.classList.contains('open'));
  if (cd.classList) { if (on) cd.classList.add('open'); else cd.classList.remove('open'); }
  hd = cd.querySelector ? cd.querySelector('.bnr-uh') : null;
  if (hd && hd.setAttribute) hd.setAttribute('aria-expanded', on ? 'true' : 'false');
  return on;
}
// 嵌入用面板(地圖戰報頁 wmgrp):雙方隊伍合計 + 六張可展開的單位卡;d = bnRptBuild 結果
function bnRptPanelHtml(d) {
  var mvp = bnRptMvp(d);
  return '<div class="bnr-emb">' + bnRptSideHtml(d.mine, 'mine', '我方', mvp) + bnRptSideHtml(d.enemy, 'enemy', '敵方', mvp) + '</div>';
}
// 一隊:隊頭(隊伍總傷害 / 總治療 / 剩餘兵力與百分比)+ 3 張單位卡
function bnRptSideHtml(s, key, label, mvp) {
  return '<section class="bnr-side ' + key + '"><div class="bnr-sdh"><b>' + label + '</b>' +
    '<span>隊伍總傷害 <b class="k">' + s.dmg + '</b></span><span>隊伍總治療 <b class="h">' + s.heal + '</b></span>' +
    '<span>剩餘兵力 <b>' + s.left + '</b> / ' + s.open + '(' + Math.round(s.pct * 100) + '%)</span></div>' +
    '<div class="bnr-cards">' + s.units.map(function (u) { return bnRptCardHtml(u, key, u === mvp); }).join('') + '</div></section>';
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
  for (i = 0; i < 14; i++) h += '<i class="bnr-conf" style="left:' + Math.round(rnd() * 96) + '%;background:' + cs[i % 5] + ';animation-delay:' + (rnd() * 2.6).toFixed(2) + 's;animation-duration:' + (2.2 + rnd() * 1.4).toFixed(2) + 's"></i>';
  return h;
}
// 場景背景:同 bnstage 的場景找圖規則(rec.opts.scene → bnstScenePath),載入成功才換上,否則維持 CSS 預設圖
function bnRptScene() {
  var bg = BNRPT.el && BNRPT.el.querySelector ? BNRPT.el.querySelector('.bnr-bg') : null, sc = BNRPT.rec && BNRPT.rec.opts ? BNRPT.rec.opts.scene : '', src, im;
  if (!bg || typeof bnstScenePath !== 'function' || typeof Image === 'undefined') return;
  src = bnstScenePath(sc);
  im = new Image();
  im.onload = function () { if (bg.parentNode) bg.style.backgroundImage = 'url(' + src + ')'; };
  im.src = src;
}
function bnRptReplayHtml() {
  if (!BNRPT.rec) return '';
  return bnRptReplayable(BNRPT.rec) ? '<button type="button" class="ld-btn sub" data-act="replay">重播</button>' : '<small class="bnr-norep">舊版戰報,無法重播</small>';
}
// 對戰練習(duel)剛打完的那場才有「分享戰報碼」
function bnRptShareOk(lid) {
  var r;
  if (!lid || typeof BNS === 'undefined' || !BNS || !BNS.last || typeof bnu === 'undefined' || !bnu || lid !== bnu.logId || typeof bnLogGet !== 'function') return false;
  r = bnLogGet(lid);
  return !!r && r.kind === 'duel';
}
// 底部按鈕列:重播、儲存戰報、(對戰)分享戰報碼、文字戰報、離開(只有有 logId 的戰報才有儲存 / 文字戰報)
function bnRptBtnsHtml() {
  var o = BNRPT.opts || {}, lid = o.logId, h = bnRptReplayHtml();
  if (lid && typeof bnLogSave === 'function') h += '<button type="button" class="ld-btn sub' + (BNRPT.saved ? ' off' : '') + '" data-act="save">' + (BNRPT.saved ? '已儲存' : '儲存戰報') + '</button>';
  if (lid && typeof bnLogOpen === 'function') h += '<button type="button" class="ld-btn sub" data-act="txt">文字戰報</button>';
  if (o.share !== undefined ? o.share : bnRptShareOk(lid)) h += '<button type="button" class="ld-btn sub" data-act="share">分享戰報碼</button>';
  return h + '<button type="button" class="ld-btn" data-act="leave">離開</button>';
}
// 戰鬥結果戰報(整頁):上方窄條 = 小緞帶 + 雙方兵力條 + 回合 / 原因;中間可捲動 = 我方隊 / 敵方隊;下方 = 戰果 + 按鈕列
function bnRptResultHtml(d) {
  var o = BNRPT.opts || {}, res = d.mineRes, win = res === '勝', lose = res === '敗', mvp = bnRptMvp(d), tot = d.mine.left + d.enemy.left, pct = tot > 0 ? Math.round(d.mine.left / tot * 100) : 50;
  return '<div class="bnr-pg"><div class="bnr-bg"></div>' +
    '<div class="bnr-top"><div class="bnr-ribbon' + (lose ? ' lose' : (res === '平' ? ' draw' : '')) + '"><span class="ld-outline">' + BNRPT_RIB[res] + '</span></div>' +
    '<div class="bnr-tug"><span>我 ' + d.mine.left + '</span><div class="bar"><i style="--w:' + pct + '%"></i></div><span>敵 ' + d.enemy.left + '</span></div>' +
    '<small class="bnr-meta">第 ' + d.maxRound + ' 回合 · ' + bnRptEsc(d.reasonTxt) + '</small></div>' +
    '<div class="bnr-main">' + bnRptSideHtml(d.mine, 'mine', '我方', mvp) + bnRptSideHtml(d.enemy, 'enemy', '敵方', mvp) + '</div>' +
    '<div class="bnr-foot">' + (o.loot !== undefined ? bnRptLootHtml(o.loot) : '') + '<div class="bnr-btns">' + bnRptBtnsHtml() + '</div></div>' +
    (win ? bnRptConfetti(d.seed) : '') + '</div>';
}
function bnRptRender() {
  var el = BNRPT.el, d = BNRPT.data;
  if (!el || !d) return;
  el.innerHTML = bnRptResultHtml(d);
  el.className = 'ld-noselect bnr-v-result';
  bnRptScene();
}
function bnRptToast(m) { if (typeof showToast === 'function') { try { showToast(m); } catch (e) { /* 略過 */ } } }
function bnRptOnClick(e) {
  var t = e && e.target, b = t && t.closest ? t.closest('[data-act]') : null, a, o = BNRPT.opts || {}, rp = BNRPT.rec, side = o.mySide === 'B' ? 'B' : 'A', r;
  if (!b) return;
  a = b.getAttribute('data-act');
  if (a === 'tg') { bnRptDetailToggle(b); return; }
  if (a === 'leave' || a === 'close') { bnRptLeave(); return; }
  if (a === 'txt') { bnRptTxt(); return; }
  if (a === 'replay') {   // 重播:關掉戰報開戲台;戲台「離開」或播完會回到這份戰報(帶同樣的戰果 / 儲存 / 離開動作)
    if (!bnRptReplayable(rp) || typeof bnBattleShow !== 'function') return;
    bnRptClose(); bnBattleShow(rp, { mode: 'play', mySide: side, loot: o.loot, logId: o.logId, onLeave: o.onLeave, share: o.share });
    return;
  }
  if (a === 'save') {
    if (!o.logId || typeof bnLogSave !== 'function' || BNRPT.saved) return;
    r = bnLogSave(o.logId);
    if (r.ok || /已儲存過/.test(r.why || '')) { BNRPT.saved = true; b.textContent = '已儲存'; b.className = 'ld-btn sub off'; }
    bnRptToast(r.ok ? '已儲存戰報' : r.why);
    return;
  }
  if (a === 'share') {   // 對戰練習的分享戰報碼:關掉戰報後開分享面板
    if (typeof bnsDo === 'function') { bnRptClose(); bnsDo('rcode'); }
  }
}
// 文字戰報(bnlog.js 檢視):戰報先藏起來,文字戰報按返回時再顯示,不跳到「最近 / 已儲存」清單
function bnRptTxt() {
  var lid = BNRPT.opts && BNRPT.opts.logId, ok;
  if (!lid || typeof bnLogOpen !== 'function') return false;
  bnRptHide(true);
  ok = bnLogOpen('recent', lid, function () { bnRptHide(false); });
  if (!ok) bnRptHide(false);
  return !!ok;
}
function bnRptHide(on) {
  BNRPT.hidden = !!on;
  if (BNRPT.el && BNRPT.el.style) BNRPT.el.style.display = on ? 'none' : '';
}
// 離開 / 返回鍵:關掉戰報,再做 opts.onLeave(例:回關卡選擇 / 入口)
function bnRptLeave() {
  var f = BNRPT.opts && BNRPT.opts.onLeave;
  if (!bnRptClose()) return false;
  if (typeof f === 'function') f();
  return true;
}
// 開全螢幕覆蓋層。opts = {mySide:'A'|'B', loot(字串或陣列,放底部戰果欄), logId(有的話才有儲存 / 文字戰報鈕), onLeave(離開時呼叫), share(顯示分享戰報碼鈕)}
function bnRptOpen(rec, opts) {
  var el, o = opts || {};
  if (typeof document === 'undefined' || !document.body) return false;
  if (BNRPT.el) bnRptClose();
  BNRPT.rec = rec; BNRPT.opts = o; BNRPT.data = bnRptBuild(rec, o.mySide === 'B' ? 'B' : 'A'); BNRPT.hidden = false; BNRPT.saved = false;
  el = document.createElement('div');
  el.id = 'bnRpt'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', '戰報');
  el.className = 'ld-noselect';
  el.addEventListener('click', bnRptOnClick);
  document.body.appendChild(el);
  BNRPT.el = el;
  bnRptRender();
  return true;
}
function bnRptClose() {
  var el = BNRPT.el;
  if (!el) return false;
  el.removeEventListener('click', bnRptOnClick);
  if (el.parentNode) el.parentNode.removeChild(el);
  BNRPT.el = null; BNRPT.data = null; BNRPT.rec = null; BNRPT.hidden = false; BNRPT.saved = false;
  return true;
}
function bnRptIsOpen() { return !!(BNRPT.el && BNRPT.el.parentNode); }

// 測試入口:網址 ?rpt=1 時自動開範例戰報(正式流程接線不在本批)
if (typeof window !== 'undefined' && typeof document !== 'undefined' && window.location && /[?&]rpt=1(&|$)/.test(String(window.location.search || ''))) {
  window.addEventListener('load', function () { bnRptOpen(bnRptSampleRec(), { mySide: 'A', loot: ['評價 ★★☆', '金幣 +300'] }); });
}

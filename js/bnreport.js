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

var BNRPT = { el: null, rec: null, data: null, opts: {}, hidden: false, saved: false, view: 'ov', prevView: 'ov', round: 1, brief: true, unit: null, rounds: null, conf: false };
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
    if (ev.cb && cur[ev.src]) { c = cur[ev.src]; return (c[0] === 'follow' || c[2] === 'pursuit') ? 'follow' : (c[2] === 'ult' ? 'ult' : 'skill'); }   // 條件加成(det / hit)的追加傷害算回原戰法
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
    if (ev.cb && cur[ev.src]) return cur[ev.src];
    if (ev.dot) return ['__dot', '持續傷害', 'dot', ''];
    if (ev.rx) { var rd = BN_SKILLS[ev.rx], rxN = ''; if (!rd && typeof BN_COMBOS !== 'undefined') BN_COMBOS.reactions.forEach(function (x) { if (x.id === ev.rx) rxN = x.name; }); return [ev.rx, rd ? rd.name : (rxN || ev.rx), 'react', rd ? rd.power : '']; }   // 反應列顯示中文名(rx_breach → 陷陣破堅等),不外露代碼
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
        else if (e.ty === 'strat' || e.cb === 2) { dd.st += e.v; rw.st += e.v; } else { dd.ph += e.v; rw.ph += e.v; }
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
  var outD = {
    mySide: me, enemySide: en, win: w,
    mineRes: w === me ? '勝' : (w === 'draw' ? '平' : '敗'), enemyRes: w === en ? '勝' : (w === 'draw' ? '平' : '敗'),
    reason: res.reason, reasonTxt: BNLOG_WHY[res.reason] || String(res.reason || ''), maxRound: res.rounds | 0, seed: rec.seed >>> 0,
    mine: uOut.mine, enemy: uOut.enemy, hpRes: res.hp
  };
  Object.defineProperty(outD, '_S', { value: S, enumerable: false });   // 逐回合(bnRptRounds)用;不進 JSON
  return outD;
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
  var bg = BNRPT.el && BNRPT.el.querySelector ? BNRPT.el.querySelector('.rp-bg') : null, sc = BNRPT.rec && BNRPT.rec.opts ? BNRPT.rec.opts.scene : '', src, im;
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
// ───────── 戰報版面重設計(2026-11-18;設計_戰報版面重設計_規格.md):一個滿版頁、三個分頁〔總覽〕〔統計〕〔逐回合〕+ 滿版子頁〔武將明細〕 ─────────
// 狀態 BNRPT.view = 'ov'|'st'|'rd'|'unit';BNRPT.round(0 = 開戰前);BNRPT.brief(簡略,預設 true);BNRPT.prevView(明細返回哪個分頁);BNRPT.unit(明細的單位 id)。
// 純函式(node 可測):bnRptRounds / bnRptRoundHtml / bnRptOverviewHtml / bnRptStatsHtml / bnRptUnitPageHtml / bnRptPageHtml。bnRptBuild 把重跑的狀態放在 d._S(不可列舉,不進 JSON)。
// 顏色(決 3):傷害依類型 物理橘 / 策略紫 / 持續金;治療綠;條件加成(戰法 cb)追加傷害加 〔條件加成〕 小標。
var BNRPT_POS = ['前鋒', '中衛', '主將'];
var BNRPT_DOT = { burn: '燃燒', poison: '中毒', bleed: '流血', thorns: '荊棘', rx: '反應' };
function bnRptSideOf(d, S, id) { return S.units[id] && S.units[id].side === d.mySide ? 'mine' : 'enemy'; }
function bnRptNm(d, S, id) { var u = S.units[id]; if (!u) return '?'; return '<b class="' + (u.side === d.mySide ? 'nM' : 'nF') + '">' + bnRptEsc(u.spec.name) + '</b>'; }
function bnRptSkName(id, fb) { return (BN_SKILLS[id] && BN_SKILLS[id].name) || fb || String(id || ''); }
function bnRptStN(id) { return typeof bnLogStName === 'function' ? bnLogStName(id) : String(id || ''); }
function bnRptFmt(v) { return String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
// 事件 → 回合結構:{ prep:[{title,lines}], rounds:[{r, first:'mine'|'enemy', acts:[行動段]}], end:{text,win} };
// 行動段 = { u, side, ord, extra, hpAt(行動開始時兵力), dmgSum / healSum(開戰至該段結束的累計), lines:[{lv:1|2, k, v(true = 簡略模式隱藏), src, tgt, val, html}] };u = -1 為回合開頭的系統段(疲兵等)
// k:skill basic kill skip trig(lv1);dmg heal shield evade cb rx roll st(lv2)。每個 dmg 事件(src ≠ tgt)恰好一列;各武將傷害 / 治療列加總 = u.dmg / u.heal。
function bnRptRounds(S, d) {
  var ev = S.events || [], hp = {}, cumD = {}, cumH = {}, rounds = [], prep = { sk: [], bond: [], st: [] }, cur = null, act = null, ord = 0, pendUlt = false, i, e, j, endTxt = '', endWin = d.win;
  function nm(id) { return bnRptNm(d, S, id); }
  function closeAct() { if (act && act.u >= 0) { act.dmgSum = cumD[act.u] | 0; act.healSum = cumH[act.u] | 0; } act = null; }
  function ensure() { if (!act) { act = { u: -1, side: '', ord: 0, lines: [] }; if (cur) cur.acts.push(act); } return act; }
  function add(lv, k, v, html, o) { var ln = { lv: lv, k: k, v: !!v, html: html }, key; if (o) for (key in o) ln[key] = o[key]; if (!cur) return ln; ensure().lines.push(ln); return ln; }
  for (i = 0; i < ev.length; i++) {
    e = ev[i];
    if (e.t === 'init') { for (j = 0; j < e.units.length; j++) hp[e.units[j].id] = e.units[j].hp; continue; }
    if (e.t === 'round') { closeAct(); cur = { r: e.n, first: e.first === d.mySide ? 'mine' : 'enemy', fat: e.fat || 0, acts: [] }; rounds.push(cur); ord = 0; continue; }
    if (e.t === 'end') { closeAct(); continue; }
    if (e.t === 'act') { closeAct(); act = { u: e.u, side: bnRptSideOf(d, S, e.u), ord: ++ord, extra: !!e.x, hpAt: Math.round(hp[e.u] || 0), lines: [] }; if (cur) cur.acts.push(act); continue; }
    if (!cur) {   // 開戰前:被動 / 羈絆 / 加成
      if (e.t === 'trigger') prep.sk.push({ lv: 2, k: 'trig', v: false, html: nm(e.u) + ' 的【' + bnRptEsc(bnRptSkName(e.id)) + '】' + ((typeof BNT_TRIG !== 'undefined' && BNT_TRIG[e.trig]) ? '(' + BNT_TRIG[e.trig] + ')' : '') });
      else if (e.t === 'bond') prep.bond.push({ lv: 2, k: 'bond', v: false, html: '羈絆「' + bnRptEsc(e.name || e.id) + '」生效' });
      else if (e.t === 'status' && e.tgt >= 0) prep.st.push({ lv: 2, k: 'st', v: false, html: nm(e.tgt) + ' 獲得〔' + bnRptEsc(bnRptStN(e.id)) + '〕' + (e.left ? ' ' + e.left + ' 回合' : '') });
      continue;
    }
    switch (e.t) {
      case 'ult': pendUlt = true; break;
      case 'skill': add(1, 'skill', false, nm(e.u) + (pendUlt ? ' 施放大招' : ' 發動戰法') + '<span class="skn">【' + bnRptEsc(e.name || bnRptSkName(e.id)) + '】</span>' + (e.rc ? '(第 ' + e.rc + ' 次再放)' : '') + (e.as !== undefined ? '(' + nm(e.as) + ' 補刀)' : '')); pendUlt = false; break;
      case 'prep': add(1, 'skill', false, nm(e.u) + ' 蓄力準備<span class="skn">【' + bnRptEsc(bnRptSkName(e.id)) + '】</span>'); break;
      case 'trigger': add(1, 'trig', false, nm(e.u) + ' 觸發<span class="skn">【' + bnRptEsc(bnRptSkName(e.id)) + '】</span>' + ((typeof BNT_TRIG !== 'undefined' && BNT_TRIG[e.trig]) ? '(' + BNT_TRIG[e.trig] + ')' : '')); break;
      case 'dmg': {
        var cls, tx;
        hp[e.tgt] = e.hp;
        if (e.src >= 0 && e.src !== e.tgt) cumD[e.src] = (cumD[e.src] || 0) + e.v;
        if (e.basic && !e.ctr && !e.via && e.src >= 0) add(1, 'basic', false, nm(e.src) + ' 對 ' + nm(e.tgt) + ' 普攻');
        else if (e.ctr && e.src >= 0) add(1, 'basic', false, nm(e.src) + ' 反擊 ' + nm(e.tgt));
        cls = e.cb ? (e.cb === 2 ? 'st' : 'ph') : (e.ty === 'strat' ? 'st' : (e.ty === 'phys' ? 'ph' : 'dt'));
        if (e.ty === 'self') tx = nm(e.tgt) + ' 損失兵力 <b class="dt">' + bnRptFmt(e.v) + '</b>(自損)';
        else if (e.dot && !e.cb) tx = nm(e.tgt) + ' 受〔' + (BNRPT_DOT[e.dot] || '持續') + '〕損失兵力 <b class="dt">' + bnRptFmt(e.v) + '</b>';
        else tx = nm(e.tgt) + ' 損失兵力 <b class="' + cls + '">' + bnRptFmt(e.v) + '</b>' + (e.cb ? ' <em class="cbm">條件加成</em>' : '') + (e.crit ? ' <em class="crit">暴擊</em>' : '') + (e.pv > 0 ? ' <em class="pv">克制</em>' : (e.pv < 0 ? ' <em class="pv x">被克</em>' : '')) + (e.abs ? ' <span class="rm">(護盾吸收 ' + bnRptFmt(e.abs) + ')</span>' : '') + (e.via !== undefined ? ' <span class="rm">(' + nm(e.via) + ' 援護代受)</span>' : '');
        add(2, 'dmg', false, tx + ' <span class="rm">(剩 ' + bnRptFmt(e.hp) + ')</span>', { src: e.src, tgt: e.tgt, val: e.v, ty: e.ty, cb: e.cb ? 1 : 0 });
        break;
      }
      case 'heal': hp[e.tgt] = e.hp; if (e.src >= 0) cumH[e.src] = (cumH[e.src] || 0) + e.v; add(2, 'heal', false, nm(e.tgt) + ' 恢復兵力 <b class="hl">+' + bnRptFmt(e.v) + '</b> <span class="rm">(剩 ' + bnRptFmt(e.hp) + ')</span>', { src: e.src, tgt: e.tgt, val: e.v }); break;
      case 'shield': add(2, 'shield', false, nm(e.tgt) + ' 獲得護盾 <b class="hl">+' + bnRptFmt(e.v) + '</b>', { src: e.src, tgt: e.tgt, val: e.v }); break;
      case 'revive': hp[e.tgt] = e.hp; add(2, 'heal', false, nm(e.tgt) + ' 復活,兵力 <b class="hl">' + bnRptFmt(e.hp) + '</b>'); break;
      case 'kill': add(1, 'kill', false, '<i class="rp-x">✖</i>' + nm(e.tgt) + ' 潰滅,無法再戰', { tgt: e.tgt }); break;
      case 'skip': add(1, 'skip', false, nm(e.u) + ' 無法行動(' + bnRptEsc(BNLOG_WHY[e.why] || e.why || '') + ')'); break;
      case 'evade': add(2, 'evade', false, e.miss ? nm(e.src) + ' 致盲,攻擊落空' : (e.dr ? nm(e.tgt) + ' 機率閃避,閃開了 ' + nm(e.src) + ' 的攻擊' : nm(e.tgt) + ' 閃避了 ' + (e.src >= 0 ? nm(e.src) + ' 的' : '') + '攻擊')); break;
      case 'cb': add(2, 'cb', false, '<span class="cbt">【條件加成】</span>' + nm(e.u) + '「' + bnRptEsc(bnRptSkName(e.id)) + '」' + bnRptEsc(typeof bntCbEvText === 'function' ? bntCbEvText(e.st, e.k) : e.st + ' → ' + e.k) + ' <span class="rm">(' + nm(e.tgt) + ')</span>'); break;
      case 'react': add(2, 'rx', true, '反應「' + bnRptEsc(e.name || e.id) + '」'); break;
      case 'roll': add(2, 'roll', true, nm(e.u) + '「' + bnRptEsc(bnRptSkName(e.id)) + '」發動率 ' + (e.p | 0) + '% → ' + (e.ok ? '發動' : '未發動') + (e.pity ? '(保底)' : '')); break;
      case 'status': add(2, 'st', true, (e.tgt >= 0 ? nm(e.tgt) : '全場') + ' 獲得〔' + bnRptEsc(bnRptStN(e.id)) + '〕' + (e.left ? ' ' + e.left + ' 回合' : '')); break;
      case 'unstatus': add(2, 'st', true, nm(e.tgt) + ' 的〔' + bnRptEsc(bnRptStN(e.id)) + '〕解除'); break;
      case 'resist': case 'immune': case 'ccimm': add(2, 'st', true, nm(e.tgt) + (e.t === 'resist' ? ' 抵禦了〔' : (e.t === 'ccimm' ? ' 抗控擋下〔' : ' 免疫〔')) + bnRptEsc(bnRptStN(e.id)) + '〕'); break;
      case 'move': add(2, 'st', true, nm(e.u) + ' 移位'); break;
      case 'chain': case 'chaincap': add(2, 'st', true, '連鎖'); break;
      default: break;
    }
  }
  closeAct();
  if (S.result) endTxt = S.result.reason === 'wipe' ? ((S.result.winner === 'draw' ? '雙方' : (S.result.winner === d.mySide ? '敵方' : '我方')) + '全軍潰滅') : bnRptEsc(d.reasonTxt || '回合上限');
  return {
    prep: [{ title: '戰法', lines: prep.sk }, { title: '羈絆', lines: prep.bond }, { title: '開戰加成', lines: prep.st }].filter(function (s) { return s.lines.length; }),
    rounds: rounds,
    end: { win: endWin, text: endTxt + ' · ' + (d.mineRes === '勝' ? '我方勝利' : (d.mineRes === '敗' ? '我方戰敗' : '平手')) + '(第 ' + d.maxRound + ' 回合)' }
  };
}
// 單一回合條列(r = 0 開戰前;簡略時 v = true 的列完全不輸出)
function bnRptRoundHtml(R, r, brief, o) {
  var h = '', rd, i, j, a, ln, lines, ind;
  o = o || {};
  if (r === 0) {
    if (!R.prep.length) return '<p class="rp-none">開戰前沒有被動、羈絆或加成</p>';
    R.prep.forEach(function (s) { h += '<div class="rp-psec"><h5>' + s.title + '</h5>' + s.lines.map(function (l) { return '<p class="rp-l2">' + l.html + '</p>'; }).join('') + '</div>'; });
    return h;
  }
  rd = R.rounds[r - 1];
  if (!rd) return '';
  h = '<div class="rp-rsep">第 ' + rd.r + ' 回合 · ' + (rd.first === 'mine' ? '我方' : '敵方') + '先手' + (rd.fat ? ' · 疲兵 ' + rd.fat + ' 層' : '') + '</div>';
  for (i = 0; i < rd.acts.length; i++) {
    a = rd.acts[i];
    lines = a.lines.filter(function (l) { return !(brief && l.v); });
    if (!lines.length && a.u < 0) continue;
    h += '<div class="rp-act ' + (a.side === 'mine' ? 'me' : (a.side === 'enemy' ? 'foe' : 'sys')) + '"' + (a.u >= 0 ? ' data-u="' + a.u + '"' : '') + '>';
    if (a.u >= 0 && o.units && o.units[a.u]) h += '<div class="rp-ah">' + bnRptFace(o.units[a.u]) + '<b class="' + (a.side === 'mine' ? 'nM' : 'nF') + '">' + bnRptEsc(o.units[a.u].name) + '</b><span class="ord">' + (a.extra ? '追加行動' : '第 ' + a.ord + ' 手') + '</span><span class="ast">兵 <b>' + bnRptFmt(a.hpAt) + '</b> · 傷 <b class="k">' + bnRptFmt(a.dmgSum || 0) + '</b> · 療 <b class="h">' + bnRptFmt(a.healSum || 0) + '</b></span></div>';
    for (j = 0; j < lines.length; j++) {
      ln = lines[j];
      if (ln.lv === 1) h += '<p class="rp-l1' + (ln.k === 'kill' ? ' kill' : '') + '">' + (ln.k === 'kill' ? '' : '<i class="rp-ic ' + (ln.k === 'basic' ? 'ar' : 'sk') + '"></i>') + ln.html + '</p>';
      else h += '<p class="rp-l2' + (ln.v ? ' v' : '') + (ln.k === 'cb' ? ' cb' : '') + '">' + ln.html + '</p>';
    }
    h += '</div>';
  }
  return h;
}
// 卡片上的 3 個戰法列:大招 > 主動 > 追擊 > 指揮 > 被動,不足 3 個補普攻
function bnRptSk3(u) {
  var ord = { ult: 0, active: 1, pursuit: 2, command: 3, passive: 4 }, rows = u.sk.filter(function (r) { return r.id.indexOf('__') !== 0 && r.cat !== 'react' && r.cat !== 'misc'; }).sort(function (a, b) { return (ord[a.cat] === undefined ? 9 : ord[a.cat]) - (ord[b.cat] === undefined ? 9 : ord[b.cat]); }).slice(0, 3);
  if (rows.length < 3) rows.push({ id: '__basic', name: '普攻', pw: 'N' });
  return rows.slice(0, 3);
}
// 戰法品階徽章:BN_SKILL_TIER(S 紅 / A 紫 / B 藍 / C 綠);普攻 = 灰「普」
function bnRptTier(id) { return (typeof BN_SKILL_TIER !== 'undefined' && BN_SKILL_TIER[id]) || ''; }
function bnRptG(id) { var t = bnRptTier(id); return '<i class="rp-g ' + (/^[SABC]$/.test(t) ? t : 'N') + '">' + (/^[SABC]$/.test(t) ? t : '普') + '</i>'; }
function bnRptCardV2(u, side, isMvp, maxDmg) {
  var pct = u.hpOpen > 0 ? Math.max(0, Math.min(100, Math.round(u.hp / u.hpOpen * 100))) : 0, ps = bnRptPhSt(u), tot = Math.max(1, ps[0] + ps[1]), wd = maxDmg > 0 ? Math.round(u.dmg / maxDmg * 100) : 0;
  return '<div class="rp-cd' + (u.dead ? ' dead' : '') + '" data-act="unit" data-u="' + u.id + '" role="button" tabindex="0"><span class="rp-pos">' + (BNRPT_POS[u.row] || u.pos) + '</span>' +
    '<span class="rp-fig g' + (u.gr | 0) + '">' + bnRptImg(u) + '<i class="rp-tp">' + bnRptEsc(String(u.troop || '').charAt(0)) + '</i>' + (u.star && side === 'mine' ? '<i class="rp-star">' + '★'.repeat(Math.min(3, u.star)) + '</i>' : '') + (isMvp ? '<i class="rp-mvp">MVP</i>' : '') + (u.dead ? '<i class="rp-ko">潰</i>' : '') + '<b class="rp-nm">' + bnRptEsc(u.name) + '</b></span>' +
    '<span class="rp-hp"><u><i style="width:' + pct + '%"></i></u><em>' + (u.dead ? '潰' : bnRptFmt(u.hp)) + '</em></span>' +
    '<span class="rp-dm"><u><i class="p" style="width:' + Math.round(wd * ps[0] / tot) + '%"></i><i class="s" style="width:' + Math.round(wd * ps[1] / tot) + '%"></i></u><em>傷 <b>' + bnRptFmt(u.dmg) + '</b></em></span>' +
    '<span class="rp-sks">' + bnRptSk3(u).map(function (r) { return '<span class="rp-sk">' + bnRptG(r.id) + '<span>' + bnRptEsc(r.name) + '</span></span>'; }).join('') + '</span></div>';
}
function bnRptTeamV2(s, key, label, mvp, maxDmg) {
  return '<div class="rp-team ' + (key === 'mine' ? 'me' : 'foe') + '"><div class="rp-band"><b>' + label + '</b><span>總傷害 <b class="n">' + bnRptFmt(s.dmg) + '</b></span><span>治療 <b class="hl">' + bnRptFmt(s.heal) + '</b></span></div><div class="rp-cards">' + s.units.map(function (u) { return bnRptCardV2(u, key, u === mvp, maxDmg); }).join('') + '</div></div>';
}
function bnRptBarV2(key, label, s) {
  var pct = s.open > 0 ? Math.round(s.left / s.open * 100) : 0;
  return '<div class="rp-bar ' + (key === 'mine' ? 'me' : 'foe') + '"><span class="lb">' + label + '</span><u><i style="width:' + pct + '%"></i><s>傷兵 ' + bnRptFmt(s.wounded) + '</s></u><span class="nv">' + bnRptFmt(s.left) + '<small>/' + bnRptFmt(s.open) + '</small></span></div>';
}
// 總覽:結果頭(印章 + 雙方兵力條 + 回合 / 原因)+ 我方帶 / 3 卡 + 戰果條 + 敵方帶 / 3 卡
function bnRptOverviewHtml(d, loot) {
  var res = d.mineRes, mvp = bnRptMvp(d), maxD = Math.max(d.mine.units.concat(d.enemy.units).reduce(function (m, u) { return Math.max(m, u.dmg); }, 0), 1), cl = res === '勝' ? 'win' : (res === '敗' ? 'lose' : 'draw'), el = bnRptLootCheck(loot);
  return '<section class="rp-v rp-ov"><div class="rp-res"><div class="rp-stamp ' + cl + '">' + res + '</div><div class="rp-bars">' + bnRptBarV2('mine', '我方', d.mine) + bnRptBarV2('enemy', '敵方', d.enemy) + '<div class="rp-meta">第 <b>' + d.maxRound + '</b> 回合 · ' + bnRptEsc(d.reasonTxt) + '</div></div><div class="rp-stamp sl ' + (res === '勝' ? 'lose' : (res === '敗' ? 'win' : 'draw')) + '">' + (res === '勝' ? '敗' : (res === '敗' ? '勝' : '平')) + '</div></div>' +
    '<div class="rp-teams">' + bnRptTeamV2(d.mine, 'mine', '我方', mvp, maxD) + (el ? '<div class="rp-loot"><b>戰果</b>' + el + '</div>' : '') + bnRptTeamV2(d.enemy, 'enemy', '敵方', mvp, maxD) + '</div></section>';
}
function bnRptLootCheck(loot) {
  var list = Array.isArray(loot) ? loot : (loot ? [loot] : []), parts = [];
  list.forEach(function (x) {
    if (typeof x === 'object' && x) parts.push(bnRptEsc(x.name || '') + (x.v !== undefined ? ' ' + bnRptEsc(x.v) : ''));
    else if (x !== undefined && x !== null && x !== '') parts.push(bnRptEsc(x));
  });
  return parts.map(function (p) { return '<span>' + p + '</span>'; }).join('');
}
// 統計:兩隊各一組;總傷害欄 = 數字 + 物理 / 策略雙段條(長度 = 占全場最高者比例);點列 → 武將明細
function bnRptStatsHtml(d) {
  var maxD = Math.max(d.mine.units.concat(d.enemy.units).reduce(function (m, u) { return Math.max(m, u.dmg); }, 0), 1);
  function nz(v, c) { return v > 0 ? '<span class="rp-td ' + (c || '') + '">' + bnRptFmt(v) + '</span>' : '<span class="rp-td ' + (c === 'lx' ? 'lx' : '') + '"><span class="z">—</span></span>'; }
  function row(u, key) {
    var ps = bnRptPhSt(u), tot = Math.max(1, ps[0] + ps[1]), wd = Math.round(u.dmg / maxD * 100), dd = u.det || {};
    return '<div class="rp-tr' + (u.dead ? ' dead' : '') + '" data-act="unit" data-u="' + u.id + '" role="button" tabindex="0"><span></span><span class="rp-who"><span class="rp-av g' + (u.gr | 0) + '">' + bnRptFace(u) + '</span><span><b>' + bnRptEsc(u.name) + '</b><small>' + (BNRPT_POS[u.row] || u.pos) + (u.dead ? ' · 潰' : '') + '</small></span></span>' +
      '<span class="rp-td k">' + (u.dmg > 0 ? bnRptFmt(u.dmg) : '<span class="z">—</span>') + '<u><i class="p" style="width:' + Math.round(wd * ps[0] / tot) + '%"></i><i class="s" style="width:' + Math.round(wd * ps[1] / tot) + '%"></i></u></span>' +
      '<span class="rp-td lx">' + (dd.acts | 0) + '</span>' + nz(ps[0], 'lx') + nz(ps[1], 'lx') + nz(u.heal, 'h') + nz(dd.taken | 0, 't') + nz(dd.kills | 0, '') + '</div>';
  }
  function grp(s, key) {
    var ac = 0, ph = 0, st = 0, tk = 0, kl = 0;
    s.units.forEach(function (u) { var p = bnRptPhSt(u), dd = u.det || {}; ac += dd.acts | 0; ph += p[0]; st += p[1]; tk += dd.taken | 0; kl += dd.kills | 0; });
    return '<div class="rp-grp ' + (key === 'mine' ? 'me' : 'foe') + '"><i class="rp-wm">' + ((key === 'mine') === (d.mineRes === '勝') && d.mineRes !== '平' ? '勝' : (d.mineRes === '平' ? '平' : '敗')) + '</i>' + s.units.map(function (u) { return row(u, key); }).join('') +
      '<div class="rp-tr sum"><span></span><span class="rp-who">隊伍合計</span><span class="rp-td">' + bnRptFmt(s.dmg) + '</span><span class="rp-td lx">' + ac + '</span>' + nz(ph, 'lx') + nz(st, 'lx') + nz(s.heal, 'h') + nz(tk, 't') + nz(kl, '') + '</div></div>';
  }
  return '<section class="rp-v rp-st"><div class="rp-tbl"><div class="rp-tr rp-th"><span></span><span>武將</span><span>總傷害</span><span class="lx">出手</span><span class="lx">物理</span><span class="lx">策略</span><span>治療</span><span>承受</span><span>擊倒</span></div>' + grp(d.mine, 'mine') + grp(d.enemy, 'enemy') + '<div class="rp-hint">點任一列看該武將明細 · 長條 = 物理(橘)+ 策略(紫)占全場最高傷害比例</div></div></section>';
}
// 武將明細子頁(滿版):英雄卡 + 傷害來源表 + 戰法表(沿用 bnRptDtlHtml)
function bnRptUnitPageHtml(d, uid) {
  var u = null, side = 'mine', ps, tot, d0;
  d.mine.units.forEach(function (x) { if (x.id === uid) { u = x; side = 'mine'; } });
  d.enemy.units.forEach(function (x) { if (x.id === uid) { u = x; side = 'enemy'; } });
  if (!u) return '';
  ps = bnRptPhSt(u); tot = Math.max(1, ps[0] + ps[1]); d0 = u.det || {};
  return '<section class="rp-v rp-un"><div class="rp-hero"><span class="rp-fig g' + (u.gr | 0) + '">' + bnRptImg(u) + '<i class="rp-tp">' + bnRptEsc(String(u.troop || '').charAt(0)) + '</i></span><div><h3>' + bnRptEsc(u.name) + '<small>' + (BNRPT_POS[u.row] || u.pos) + (u.star && side === 'mine' ? ' · ' + u.star + '星' : '') + ' · ' + bnRptEsc(u.troop || '') + (u.dead ? ' · 潰滅' : '') + '</small></h3>' +
    '<div class="rp-hhp"><u><i style="width:' + (u.hpOpen > 0 ? Math.round(u.hp / u.hpOpen * 100) : 0) + '%"></i></u><span>兵力 ' + bnRptFmt(u.hp) + ' / ' + bnRptFmt(u.hpOpen) + '</span></div>' +
    '<div class="rp-chips"><span>出手 <b>' + (d0.acts | 0) + '</b></span><span>擊倒 <b>' + (d0.kills | 0) + '</b></span><span>承受 <b class="t">' + bnRptFmt(d0.taken | 0) + '</b></span><span>受治療 <b class="h">' + bnRptFmt(d0.healIn | 0) + '</b></span>' + (d0.shield ? '<span>護盾 <b>' + bnRptFmt(d0.shield) + '</b></span>' : '') + '</div>' +
    '<div class="rp-stack"><i style="flex:' + ps[0] + ';background:#ffb066"></i><i style="flex:' + ps[1] + ';background:#c79bff"></i></div><div class="rp-chips"><span>總傷害 <b>' + bnRptFmt(u.dmg) + '</b></span><span class="p">物理 ' + bnRptFmt(ps[0]) + '</span><span class="s">策略 ' + bnRptFmt(ps[1]) + '</span><span>治療 <b class="h">' + bnRptFmt(u.heal) + '</b></span></div></div></div>' +
    '<div class="bnr-dtl rp-dtl">' + bnRptDtlHtml(u).replace(/^<div class="bnr-dtl">/, '').replace(/<\/div>$/, '') + '</div></section>';
}
// 逐回合頁:回合列 + 條列 + 武將軌(直式:回合列在上、武將軌在下;橫式:左右側欄)
function bnRptRdPageHtml(d, R, brief, r, rec) {
  var units = {}, h = '', i, o = d.mine.units.concat(d.enemy.units), used = {}, nR = R.rounds.length;
  o.forEach(function (u) { units[u.id] = u; });
  if (r > 0 && R.rounds[r - 1]) R.rounds[r - 1].acts.forEach(function (a) { if (a.u >= 0) used[a.u] = 1; });
  h += '<section class="rp-v rp-rd"><div class="rp-rds"><span class="rp-rc' + (r === 0 ? ' on' : '') + '" data-act="round" data-r="0">開戰前</span>';
  for (i = 1; i <= nR; i++) h += '<span class="rp-rc' + (r === i ? ' on' : '') + '" data-act="round" data-r="' + i + '">' + i + '</span>';
  h += '<span class="rp-brief' + (brief ? ' on' : '') + '" data-act="brief">' + (brief ? '簡略' : '完整') + '</span></div><div class="rp-lw"><div class="rp-log">' +
    (rec && !bnRptReplayable(rec) ? '<p class="rp-old">舊版戰報,逐回合為重算結果,可能與當時不同</p>' : '') + bnRptRoundHtml(R, r, brief, { units: units });
  if (r === nR && nR > 0) h += '<div class="rp-endl">' + R.end.text + '</div>';
  h += '</div><div class="rp-dock">';
  d.mine.units.forEach(function (u) { h += '<span class="rp-av me g' + (u.gr | 0) + (used[u.id] || r === 0 ? '' : ' idle') + '" data-act="dock" data-u="' + u.id + '">' + bnRptFace(u) + '</span>'; });
  h += '<i class="rp-dsep"></i>';
  d.enemy.units.forEach(function (u) { h += '<span class="rp-av foe g' + (u.gr | 0) + (used[u.id] || r === 0 ? '' : ' idle') + '" data-act="dock" data-u="' + u.id + '">' + bnRptFace(u) + '</span>'; });
  return h + '</div></div></section>';
}
function bnRptTabsHtml(cls) {
  var t = [['ov', '總覽'], ['st', '統計'], ['rd', '逐回合']], v = BNRPT.view === 'unit' ? BNRPT.prevView : BNRPT.view;
  return t.map(function (x) { return '<span class="rp-tb' + (v === x[0] ? ' on' : '') + '" data-act="tab" data-v="' + x[0] + '" role="button" tabindex="0">' + x[1] + '</span>'; }).join('');
}
// 整頁:頂欄(左上返回 / 標題 / 橫式頁籤 / 右側動作圖示)+ 內容 + 底部分頁列(直式)
function bnRptPageHtml(d) {
  var o = BNRPT.opts || {}, lid = o.logId, v = BNRPT.view, unit = null, acts = '', h, body, title = '戰報', nav = '';
  if (v === 'unit') {
    d.mine.units.concat(d.enemy.units).forEach(function (x) { if (x.id === BNRPT.unit) unit = x; });
    title = (unit ? unit.name : '') + ' · 明細';
    nav = '<span class="rp-nav2"><span class="rp-ib" data-act="unav" data-d="-1" role="button" aria-label="上一位"><i>‹</i></span><span class="rp-ib" data-act="unav" data-d="1" role="button" aria-label="下一位"><i>›</i></span></span>';
  } else {
    if (bnRptReplayable(BNRPT.rec)) acts += '<span class="rp-ib" data-act="replay" role="button" aria-label="重播"><i><span class="rp-play"></span></i></span>';
    if (lid && typeof bnLogSave === 'function') acts += '<span class="rp-ib' + (BNRPT.saved ? ' off' : '') + '" data-act="save" role="button" aria-label="儲存戰報"><i>' + (BNRPT.saved ? '★' : '☆') + '</i></span>';
    if (o.share !== undefined ? o.share : bnRptShareOk(lid)) acts += '<span class="rp-ib" data-act="share" role="button" aria-label="分享戰報碼"><i><svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="3.5" cy="8" r="2"/><circle cx="12.5" cy="3.5" r="2"/><circle cx="12.5" cy="12.5" r="2"/><path d="M5.3 7l5.4-2.6M5.3 9l5.4 2.6"/></svg></i></span>';
    acts = '<span class="rp-acts">' + acts + '</span>';
  }
  if (v === 'ov') body = bnRptOverviewHtml(d, o.loot);
  else if (v === 'st') body = bnRptStatsHtml(d);
  else if (v === 'rd') body = bnRptRdPageHtml(d, BNRPT.rounds || (BNRPT.rounds = bnRptRounds(d._S, d)), BNRPT.brief, BNRPT.round, BNRPT.rec);
  else body = bnRptUnitPageHtml(d, BNRPT.unit);
  h = '<div class="rp rpv-' + v + '"><div class="rp-bg"></div><div class="rp-top"><span class="rp-back" data-act="' + (v === 'unit' ? 'uback' : 'leave') + '" role="button" tabindex="0" aria-label="返回"><span>返回</span></span><b class="rp-ttl">' + bnRptEsc(title) + '</b>' + (v === 'unit' ? '' : '<nav class="rp-ttabs">' + bnRptTabsHtml() + '</nav>') + (v === 'unit' ? nav : acts) + '</div>' +
    '<main class="rp-views">' + body + '</main>' + (v === 'unit' ? '' : '<nav class="rp-btabs">' + bnRptTabsHtml() + '</nav>') + (v === 'ov' && d.mineRes === '勝' && !BNRPT.conf ? bnRptConfetti(d.seed) : '') + '</div>';
  return h;
}
function bnRptRender() {
  var el = BNRPT.el, d = BNRPT.data;
  if (!el || !d) return;
  el.innerHTML = bnRptPageHtml(d);
  el.className = 'ld-noselect bnr-v-' + BNRPT.view;
  BNRPT.conf = true;   // 勝利彩帶只在第一次進總覽播
  bnRptScene();
}
// 明細頁 ‹ ›:依 我方 3 位 + 敵方 3 位 的順序循環
function bnRptUnitStep(dir) {
  var d = BNRPT.data, list, i;
  if (!d) return;
  list = d.mine.units.concat(d.enemy.units).map(function (u) { return u.id; });
  i = list.indexOf(BNRPT.unit);
  BNRPT.unit = list[(Math.max(0, i) + dir + list.length) % list.length];
  bnRptRender();
}
// 逐回合頁底部武將軌:點頭像 → 捲到該武將本回合的行動段並金框標示
function bnRptDockJump(uid) {
  var el = BNRPT.el, box, t, old, i;
  if (!el || !el.querySelector) return;
  old = el.querySelectorAll ? el.querySelectorAll('.rp-act.cur') : [];
  for (i = 0; i < old.length; i++) old[i].classList.remove('cur');
  t = el.querySelector('.rp-act[data-u="' + uid + '"]');
  if (!t) return;
  t.classList.add('cur');
  box = el.querySelector('.rp-log');
  if (box) { try { box.scrollTop = Math.max(0, t.offsetTop - box.offsetTop - 4); } catch (e) { /* 略過 */ } }
}
function bnRptToast(m) { if (typeof showToast === 'function') { try { showToast(m); } catch (e) { /* 略過 */ } } }
function bnRptOnClick(e) {
  var t = e && e.target, b = t && t.closest ? t.closest('[data-act]') : null, a, o = BNRPT.opts || {}, rp = BNRPT.rec, side = o.mySide === 'B' ? 'B' : 'A', r;
  if (!b) return;
  a = b.getAttribute('data-act');
  if (a === 'tg') { bnRptDetailToggle(b); return; }
  if (a === 'tab') { BNRPT.view = b.getAttribute('data-v') || 'ov'; bnRptRender(); return; }
  if (a === 'unit') { BNRPT.prevView = BNRPT.view === 'unit' ? BNRPT.prevView : BNRPT.view; BNRPT.view = 'unit'; BNRPT.unit = +b.getAttribute('data-u'); bnRptRender(); return; }
  if (a === 'uback') { BNRPT.view = BNRPT.prevView || 'ov'; bnRptRender(); return; }
  if (a === 'unav') { bnRptUnitStep(+b.getAttribute('data-d') || 1); return; }
  if (a === 'round') { BNRPT.round = +b.getAttribute('data-r') || 0; bnRptRender(); return; }
  if (a === 'brief') { BNRPT.brief = !BNRPT.brief; bnRptRender(); return; }
  if (a === 'dock') { bnRptDockJump(+b.getAttribute('data-u')); return; }
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
  if (BNRPT.el && BNRPT.view === 'unit') { BNRPT.view = BNRPT.prevView || 'ov'; bnRptRender(); return true; }   // 武將明細 → 回進來的分頁
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
  BNRPT.view = 'ov'; BNRPT.prevView = 'ov'; BNRPT.round = 1; BNRPT.brief = true; BNRPT.unit = null; BNRPT.rounds = null; BNRPT.conf = false;
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
  BNRPT.el = null; BNRPT.data = null; BNRPT.rec = null; BNRPT.hidden = false; BNRPT.saved = false; BNRPT.rounds = null;
  return true;
}
function bnRptIsOpen() { return !!(BNRPT.el && BNRPT.el.parentNode); }

// 測試入口:網址 ?rpt=1 時自動開範例戰報(正式流程接線不在本批)
if (typeof window !== 'undefined' && typeof document !== 'undefined' && window.location && /[?&]rpt=1(&|$)/.test(String(window.location.search || ''))) {
  window.addEventListener('load', function () { bnRptOpen(bnRptSampleRec(), { mySide: 'A', loot: ['評價 ★★☆', '金幣 +300'] }); });
}

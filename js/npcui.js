// js/npcui.js — 人物互動介面(PLAN_INTERIORS §4):城內名冊人物小卡(頭像 + 台詞 + 親近 + 請託)、名冊詳情的「親近 / 所在 / 請託 / 升階」區塊、點建築顯示人事加成。
// 掛點:citylife.js lifeCardShow / lifeCardHide(npcHeroCardShow / npcHeroCardHide)、cardsui.js cuDetailHtml / cuClick(cuNpcDetailHtml / cuNpcClick)、ui.js tapObjectAt(npcTapBuilding)。
// 全部 typeof 守衛;不發聲。ES2017(不使用可選串接與空值合併運算子)。
// 全域名稱:npcHeroCardShow npcHeroCardHide npcHeroCardRender npcTapBuilding cuNpcDetailHtml cuNpcClick

var npcCard = { box: null, nid: null, line: null, msg: '' };

function npcEsc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
function npcSave() { if (typeof saveWorld === 'function') { try { saveWorld(); } catch (e) { /* 略過 */ } } }
function npcToast(s) { if (s && typeof showToast === 'function') { try { showToast(s); } catch (e) { /* 略過 */ } } }
function npcJobTitle(e) {
  var j = (typeof CARD_JOB_BY_ID !== 'undefined') ? CARD_JOB_BY_ID[e.main] : null;
  return j ? j.t[Math.max(0, (e.ja[e.main] || 1) - 1)] : '';
}
function npcPortraitSrc(e) {
  var pj;
  if (e.fig) return 'assets/portraits/' + e.fig + '.webp';
  if (typeof cardsUiPortraitJob === 'function' && typeof cardsUiAvatarVar === 'function' && (pj = cardsUiPortraitJob(e))) return 'assets/portraits/generic/' + pj + '_' + cardsUiAvatarVar(e) + '.webp';
  return '';
}
// 結果訊息(升/降親近、小禮)
function npcFavMsg(r, name) {
  var m = [];
  if (r.gain) m.push(name + ' 親近 +1');
  if (r.unlock) m.push('解鎖私話');
  if (r.gift) m.push('收到小禮:' + r.gift.name + ' ×' + r.gift.n);
  return m.join(',');
}

// ───────── 城內人物小卡 ─────────
function npcHeroCardMake() {
  var box;
  if (npcCard.box) return npcCard.box;
  if (typeof document === 'undefined' || !document.createElement || !document.body) return null;
  box = document.createElement('div');
  box.id = 'heroCard';
  box.style.cssText = 'position:fixed;left:50%;bottom:18px;transform:translateX(-50%);width:min(320px,calc(100vw - 32px));box-sizing:border-box;padding:10px 12px;border-radius:10px;border:1px solid #6fc08a;background:rgba(34,32,26,0.95);color:#f4ead2;font:14px/1.5 sans-serif;z-index:60;display:none';
  if (box.addEventListener) box.addEventListener('click', npcHeroCardClick);
  document.body.appendChild(box);
  npcCard.box = box;
  return box;
}
function npcHeroEntry(n) {
  var cs = (typeof cardsGet === 'function') ? cardsGet() : null, e = null;
  if (!cs || !n) return null;
  cs.roster.forEach(function (x) { if (x.id === n.hero) e = x; });
  return e ? { cs: cs, e: e } : null;
}
function npcWhereText(e) {
  var loc = (typeof npcLocate === 'function') ? npcLocate(e) : null, info, s;
  if (e.at && loc && loc.kind === 'site') {
    info = (typeof npcStaffInfo === 'function') ? npcStaffInfo(e.at.split('@')[0]) : null;
    s = '派駐 ' + npcEsc(loc.name);
    if (info) s += ' · ' + npcEsc(info.name) + ' 人事 +' + Math.round(info.pct) + ' %' + (info.live ? '' : '(效果接入中)');
    return s;
  }
  return e.at ? '派駐中' : '閒逛中';
}
function npcHeroCardRender() {
  var box = npcCard.box, n = (typeof LIFE !== 'undefined') ? LIFE.cardFor : null, r = n ? npcHeroEntry(n) : null, e, cs, g, src, q, st, h;
  if (!box || !r) return;
  e = r.e; cs = r.cs;
  g = CARD_GRADE[e.gr];
  src = npcPortraitSrc(e);
  h = '<div style="display:flex;gap:8px;align-items:center">' +
    '<div style="width:44px;height:44px;border-radius:6px;border:2px solid #6fc08a;background:rgba(128,128,128,.2);overflow:hidden;flex:none">' + (src ? '<img alt="" src="' + npcEsc(src) + '" style="width:100%;height:100%;object-fit:cover" onerror="this.remove()">' : '') + '</div>' +
    '<div style="flex:1;min-width:0"><b>' + npcEsc(e.name) + '</b> <span style="color:#c9b98f;font-size:12px">' + g.ch + ' · ' + npcEsc(npcJobTitle(e)) + '</span>' +
    '<div style="font-size:12px;color:#c9b98f">' + npcEsc(npcFavLabel(e.fav)) + ' 親近 ' + (e.fav | 0) + '/' + NPC_CFG.favMax + ' · ' + npcWhereText(e) + '</div></div>' +
    '<span data-a="x" style="cursor:pointer;padding:0 4px">✕</span></div>';
  h += '<div style="margin:8px 0;min-height:1.5em">「' + npcEsc(npcCard.line ? npcCard.line.text : '') + '」' + (npcCard.line && npcCard.line.priv ? ' <span style="color:#e6b84a;font-size:12px">(私話)</span>' : '') + '</div>';
  q = (typeof npcErrandOf === 'function') ? npcErrandOf(cs, e.id) : null;
  if (q) {
    st = npcErrandState(cs, { kind: q.kind, id: q.goods, n: q.n, type: q.type, base: q.base });
    h += '<div style="border-top:1px solid rgba(255,255,255,.15);padding-top:6px;margin-bottom:6px;font-size:13px"><b style="color:#e6b84a">請託</b> ' + npcEsc(q.text) +
      (q.kind === 'goods' ? ' <span style="opacity:.7">(' + st.have + '/' + st.need + ')</span>' : '') +
      ' <span data-a="err" data-q="' + npcEsc(q.id) + '" style="cursor:pointer;color:' + (st.ok ? '#7dff8a' : '#888') + ';white-space:nowrap">' + (q.kind === 'goods' ? '[交付]' : '[已完成?]') + '</span></div>';
  }
  if (npcCard.msg) h += '<div style="font-size:12px;color:#f0a060;margin-bottom:4px">' + npcEsc(npcCard.msg) + '</div>';
  h += '<span data-a="next" style="cursor:pointer;color:#e6b84a;font-size:13px;margin-right:14px">換一句 ↻</span><span data-a="detail" style="cursor:pointer;color:#e6b84a;font-size:13px">📋 詳情</span>';
  box.innerHTML = h;
}
// 回 true = 已顯示人物卡(lifeCardShow 掛點);第一次點(每日)給親近 +1
function npcHeroCardShow(n) {
  var box = npcHeroCardMake(), r = npcHeroEntry(n), fr, m;
  if (!box || !r) return false;
  if (typeof LIFE !== 'undefined' && LIFE.card && LIFE.card.box) LIFE.card.box.style.display = 'none';
  LIFE.cardFor = n;
  fr = npcFavAdd(r.cs, r.e, Date.now(), 'talk');
  m = npcFavMsg(fr, r.e.name);
  if (m) { npcToast(m); npcSave(); }
  npcCard.msg = ''; npcCard.line = npcTalkNext(r.e);
  box.style.display = 'block';
  npcHeroCardRender();
  return true;
}
function npcHeroCardHide() {
  if (npcCard.box && npcCard.box.style.display !== 'none') npcCard.box.style.display = 'none';
}
function npcHeroCardClick(ev) {
  var b = ev.target, a, n = (typeof LIFE !== 'undefined') ? LIFE.cardFor : null, r = n ? npcHeroEntry(n) : null, d, qid;
  while (b && b !== npcCard.box && !(b.getAttribute && b.getAttribute('data-a'))) b = b.parentNode;
  if (!b || b === npcCard.box || !r) return;
  a = b.getAttribute('data-a');
  if (a === 'x') { if (typeof lifeCardHide === 'function') lifeCardHide(); return; }
  if (a === 'next') { npcCard.line = npcTalkNext(r.e); npcCard.msg = ''; }
  else if (a === 'detail') {
    if (typeof cardsUiOpen === 'function') {
      cardsUiOpen('R');
      if (typeof cu !== 'undefined') cu.detail = r.e.id;
      if (typeof cardsUiRender === 'function') cardsUiRender();
    }
    return;
  }
  else if (a === 'err') {
    qid = b.getAttribute('data-q');
    d = npcErrandDone(r.cs, qid, Date.now());
    if (d.ok) { npcCard.msg = ''; npcToast('完成請託,得金幣 ' + d.reward + (d.fav ? ',' + npcFavMsg({ gain: 1, unlock: d.fav === NPC_CFG.favPrivate, gift: d.gift }, d.name) : '')); npcSave(); }
    else npcCard.msg = d.reason === 'notyet' ? '條件還沒達成' : '無法完成';
  }
  npcHeroCardRender();
}

// ───────── 點建築:顯示人事加成(ui.js tapObjectAt 掛點;只在名冊有人時提示) ─────────
function npcTapBuilding(o) {
  var info, parts;
  if (!o || typeof NPC_TYPE_POST === 'undefined' || !NPC_TYPE_POST[o.type] || typeof npcStaffInfo !== 'function') return false;
  if (!npcRoster().length) return false;
  info = npcStaffInfo(o.type);
  if (!info) return false;
  parts = info.people.map(function (p) { return p.name + ' ' + (typeof lhPartText === 'function' ? lhPartText(p) : '') + ' +' + Math.round(p.pct) + '%'; });
  npcToast(info.name + ' 人事 +' + Math.round(info.pct) + '%(' + info.used + '/' + info.seats + ' 席)' + (parts.length ? ':' + parts.join('、') : ':尚未派駐') + (info.live ? '' : ' · 效果接入中'));
  return true;
}

// ───────── 名冊詳情區塊(cardsui.js cuDetailHtml 掛點) ─────────
function cuNpcDetailHtml(cs, e, f) {
  var h = '', loc, q, st, chk, now = Date.now(), ten;
  if (f && f.list !== 'roster') return '';
  ten = npcTenureDays(e, now);
  h += '<div class="cusec">親近與年資</div><div class="cusub" style="opacity:1">' + npcFavLabel(e.fav) + ' ' + (e.fav | 0) + '/' + NPC_CFG.favMax +
    (e.at ? ' · 派駐年資 ' + ten + ' 天' : ' · 未派駐') + '<br>滿 ' + NPC_CFG.favPrivate + ' 解鎖私話,滿 ' + NPC_CFG.favGift + ' 得一次小禮' + (e.gift ? '(已領)' : '') + ';每人每日至多 +1,不影響任何數值。</div>';
  loc = npcLocate(e);
  h += '<div class="cusec">所在</div><div class="cusub" style="opacity:1">';
  if (loc && loc.kind === 'site') h += '派駐於 ' + (loc.icon ? npcEsc(loc.icon) + ' ' : '') + npcEsc(loc.name) + ' @' + loc.x + ',' + loc.y + ' <button class="cub" data-a="npcgoto" data-id="' + e.id + '">前往</button>';
  else if (loc && loc.kind === 'hero') h += '在城內閒逛 <button class="cub" data-a="npcgoto" data-id="' + e.id + '">前往</button>';
  else h += e.at ? '派駐中(建築已不在原位?)' : '目前不在城內畫面(或居民人流已關閉)';
  h += '</div>';
  q = npcErrandOf(cs, e.id);
  if (q) {
    st = npcErrandState(cs, { kind: q.kind, id: q.goods, n: q.n, type: q.type, base: q.base });
    h += '<div class="cusec">請託</div><div class="cusub" style="opacity:1">' + npcEsc(q.text) + (q.kind === 'goods' ? '(' + st.have + '/' + st.need + ')' : '') +
      '<br><button class="cub" data-a="npcerr" data-id="' + e.id + '" data-q="' + npcEsc(q.id) + '"' + (st.ok ? '' : ' disabled') + '>' + (q.kind === 'goods' ? '交付' : '確認完成') + '</button></div>';
  }
  chk = (typeof cardsUpgradeCheck === 'function' && typeof cardsUiCtx === 'function') ? cardsUpgradeCheck(e, cardsUiCtx()) : null;
  if (chk && chk.ok) h += '<div class="cusec">升階</div><button class="cub" data-a="npcup" data-id="' + e.id + '">執行升階(學識 ' + chk.cost.xue + '、金幣 ' + chk.cost.coin + ')</button>';
  return h;
}
function cuNpcClick(a, b, cs) {
  var id = b.getAttribute('data-id'), f = id ? cardsFind(cs, id) : null, d, chk, res, ctx;
  if (a === 'npcgoto') {
    if (f && npcGoto(f.e)) { if (typeof cardsUiClose === 'function') cardsUiClose(); } else if (typeof cu !== 'undefined') cu.msg = '找不到目標';
    return true;
  }
  if (a === 'npcerr') {
    d = npcErrandDone(cs, b.getAttribute('data-q'), Date.now());
    if (d.ok) { npcToast('完成請託,得金幣 ' + d.reward + (d.fav ? ',' + npcFavMsg({ gain: 1, unlock: d.fav === NPC_CFG.favPrivate, gift: d.gift }, d.name) : '')); npcSave(); }
    else if (typeof cu !== 'undefined') cu.msg = '條件還沒達成';
    return true;
  }
  if (a === 'npcup') {
    if (!f) return true;
    ctx = cardsUiCtx();
    chk = cardsUpgradeCheck(f.e, ctx);
    if (!chk.ok) { if (typeof cu !== 'undefined') cu.msg = '條件未達'; return true; }
    res = (typeof world !== 'undefined' && world && world.res) ? world.res : null;
    if (!res || (res.coin || 0) < chk.cost.coin || (res.xue || 0) < chk.cost.xue) { if (typeof cu !== 'undefined') cu.msg = '資源不足'; return true; }
    res.coin -= chk.cost.coin; res.xue -= chk.cost.xue;
    cardsUpgrade(f.e, ctx);
    if (typeof npcStaffDirty === 'function') npcStaffDirty();
    npcSave();
    return true;
  }
  return false;
}

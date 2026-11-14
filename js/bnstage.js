// js/bnstage.js — 卡牌戰鬥舞台(設計 戰鬥畫面設計/戰鬥畫面_設計.md):戲台風格 3v3 Q 版全身小人,DOM + CSS transform/opacity(不用 canvas),844×390 基準等比縮放置中。
// 由 js/bncardbattle.js 開啟;掛鉤 BNST.hooks 由本檔實作,播放器(bncbPlay)依事件順序呼叫:
//   onAct(u)              出手者開始(聚光燈)
//   onSkill(u, x)         戰法發動(x = 戰法 pre 項目:id、name、th、kind);回傳名牌時長
//   onHit(src, tgt, kind, cat, x)   命中(kind basic = 普攻 / 反擊;skill / react = 戰法);回傳毫秒(播放器等待)
//   onPassive(u, label)   被動小圓牌(反擊 / 閃避 / 免控 / 免疫 / 反應 / 被動名前兩字)
//   onPrep(u, id)         大招準備(prep 事件,t==='prep',bn_engine.js 約 861 行):橘色脈動光圈 + 「蓄勢 · 下回合 ○○」;該單位下次發出同 id 戰法/大招時移除
//   onMove(moves)         換位(move 事件,moves = [{u, row}]):單位走到新排的站位,回傳 300
//   onUltShow(fig, id, u) 有畫格的大招(BNST_ANIM 有 ult):舞台變暗、中央播 12 格、大字戰法名;回傳到命中格的毫秒
//   onUltCard(u, id)      沒有畫格的大招:原地放大 1.3 倍 + 光 + 戰法名牌 + 共用特效
//   onEnd(plan, instant)  結束:帥旗倒 → 停 → 幕布合上 → 勝 / 敗 / 平 牌(instant = 跳過,直接顯示)
// 掛鉤回傳的毫秒是 1× 基準值,播放器自行 ÷ 速度;掛鉤內部的計時也以 BNST.spd() 換算,並用 BNST.tok 防止取消後仍動。
// 命中數字:bncbSteps 的 nums 若對應到 hit 項目(nm.hooked),由 onHit 在命中格顯示,render 不重複顯示。
// 大招後的命中項目(x.big = 1)由大招掛鉤已等到命中格,onHit 直接在當下顯示、回傳 0。
// 速度:BNST.simple() 為 3× 簡化(不打聚光燈、不出普攻與戰法名牌、不播共用特效;大招照播)。
// 純函式(bnstQc / bnstWan / bnstFxFor / bnstFigSrc 等)不碰 DOM,node 可測。
// 音效:本批不發聲;BNST.sfx 留空掛鉤(之後加鑼鼓音效時接上)。
// 全域前綴 bnst / BNST。ES2017;不用 ?. ??;不用 canvas;含中文的字串一律 UTF-8。

// 動畫登錄表(每位武將一筆;欄位見 設計_戰鬥碰撞與命中表現分析.md 第三章第 4 節):foot = 畫格腳底線(格高比例,預設 BNST_FOOT = 0.78,與所有新美術文案一致);w = 身體寬度、reach = 武器尖端到身體中心距離(衝刺停點用,缺省由兵種 / 騎乘推算)
// 關羽舊畫格實測腳底 86%(guanyu_a1 為 0.858),登記 foot: 0.86 讓舊素材維持踩在地線上
var BNST_ANIM = { guanyu: { atk: 'guanyu_a', atkN: 8, atkHit: 6, ult: 'guanyu_c', ultN: 12, ultHit: 10, ranged: false, foot: 0.86 } };
var BNST_FOOT = 0.78, BNST_ANIM_H = 131, BNST_BODY_H = 122;
// 站位(844 寬基準,我方朝右、敵方翻面朝左):row 0 前鋒 / 1 中衛 / 2 主將;前鋒 / 中衛 1 倍、主將 1.3 倍(主將位於後排故 y 較高,放大後仍須低於頂列),腳底 y 與基本 z 依排號
var BNST_Y = [322, 312, 302], BNST_SC = [1, 1, 1.3], BNST_ZB = [13, 12, 11];
// 動態 z:受擊中 16、出手中(衝刺到跑回)18、陣亡 9(暗場 20 之下)
var BNST_Z_HIT = 16, BNST_Z_ACT = 18, BNST_Z_DEAD = 9;
// 衝刺停點用的預設身體寬(步行 / 騎乘)與武器尖端距離(依兵種)
var BNST_W_DEF = 71, BNST_W_MOUNT = 95, BNST_REACH = { '槍': 45, '騎': 40, '盾': 30, '弓': 30, '謀': 30 };
var BNST_TROOP_IMG = { '槍': 'inf', '騎': 'cav', '盾': 'shield', '弓': 'arc', '謀': 'str' };
// 品階 gr → 品質色:0 白、1 青(併入白)、2 藍、3 紫、4 金(5 階以上視同金)
var BNST_QC = ['w', 'w', 'b', 'p', 'g'];
var BNST_QN = { w: '白', b: '藍', p: '紫', g: '金' };
var BNST_QCOL = { w: '#d9d9d9', b: '#4aa3ff', p: '#b46cff', g: '#ffc940' };
var BNST_QWORD = { w: '白', b: '藍', p: '紫', g: '金' };
// 戰法文化主題 th → 共用特效(bnfx 現有圖;與 bndraw.js BN_FX 同源,取 cast / hit 圖)
var BNST_FX_TH = { thunder: 'fxc_thunder_strike', fireox: 'fxc_fireox_trail', talisman: 'fxc_talisman_burn', ink: 'fxc_ink_splash', wuxing: 'fxc_wx_disc', yinyang: 'fxc_yy_flip', crossbow: 'fxc_crossbow_volley', drum: 'fxc_drum_wave', banner: 'fxc_banner', charm: 'fxc_mirage', bagua: 'fxc_bagua_disc' };
// 無 th 時依 kind:治療 / 護盾 / 持續傷害 / 復活
var BNST_FX_KIND = { heal_single: 'fx_heal_motes', heal_all: 'fx_heal_motes', heal_hot: 'fx_heal_motes', revive: 'fx_heal_pillar', shield_single: 'fx_shield_dome', shield_all: 'fx_shield_dome', dot_burn: 'fx_fire_s', dot_poison: 'fx_poison_mist', dot_bleed: 'fx_slash_h', atk_multi: 'fx_spark' };
var BNST_FX_DEF = 'fx_slash_d', BNST_FX_RING = 'fx_impact_ring', BNST_FX_BASIC = 'fx_slash_d';
var BNST_PAS_LABEL = { ctr: '反擊', evade: '閃避', ccimm: '免控', immune: '免疫', react: '反應' };
var BNST_X_POS = { mine: [360, 235, 110], foe: [484, 609, 734] };   // row 0 前鋒 / 1 中衛 / 2 主將
var BNST = {
  root: null, w: null, plan: null, U: {}, tok: 0, paused: false, spd: function () { return 1; }, simple: false, skFx: {}, sfx: null, inited: false
};
BNST.simple = false;

// ───────── 純函式(node 可測) ─────────
// 品質鍵 'w'|'b'|'p'|'g'
function bnstQc(gr) { var g = gr | 0; return g >= 4 ? 'g' : (BNST_QC[g < 0 ? 0 : g] || 'w'); }
// 兵力格式:≥1 萬寫「1.05萬」(取兩位小數),以下整數
function bnstWan(v) {
  var n = Math.max(0, Math.round(+v || 0));
  return n >= 10000 ? parseFloat((n / 10000).toFixed(2)) + '萬' : String(n);
}
// 兵種 → 站姿後備圖檔(assets/fullbody/bn_body_<key>.webp);無對應回 inf
function bnstTroopSrc(troop) { var k = BNST_TROOP_IMG[troop] || 'inf'; return 'assets/fullbody/bn_body_' + k + '.webp'; }
// 角色圖:有 fig 用 assets/fullbody/<fig>.webp,否則兵種圖
function bnstFigSrc(u) { return u && u.fig ? 'assets/fullbody/' + u.fig + '.webp' : bnstTroopSrc(u ? u.troop : ''); }
// 畫格路徑:assets/fullbody/anim/<prefix><n>.webp,n 從 1 起
function bnstFrames(prefix, n) { var r = [], i; for (i = 1; i <= n; i++) r.push('assets/fullbody/anim/' + prefix + i + '.webp'); return r; }
// 有畫格註冊才回傳
function bnstAnimOf(fig) { return fig && Object.prototype.hasOwnProperty.call(BNST_ANIM, fig) ? BNST_ANIM[fig] : null; }
// 戰法特效檔名(不含路徑與副檔名):th 優先,其次 kind,最後斬擊
function bnstFxFor(th, kind) {
  if (th && Object.prototype.hasOwnProperty.call(BNST_FX_TH, th)) return BNST_FX_TH[th];
  if (kind && Object.prototype.hasOwnProperty.call(BNST_FX_KIND, kind)) return BNST_FX_KIND[kind];
  return BNST_FX_DEF;
}
// 位置:我方 / 敵方 × 排號 → x 座標(基準 844 寬)
function bnstX(isMine, row) { var a = isMine ? BNST_X_POS.mine : BNST_X_POS.foe; return a[row | 0] !== undefined ? a[row | 0] : a[0]; }
// 站位:排號 → {x, y, sc(縮放), z(基本層級)}
function bnstPose(isMine, row) { var r = row | 0; if (r < 0 || r > 2) r = 0; return { x: bnstX(isMine, r), y: BNST_Y[r], sc: BNST_SC[r], z: BNST_ZB[r] }; }
// 畫格腳底:img bottom 偏移(px)= -(1 - 腳底比例) × 畫格顯示高;an.foot 缺省 0.78
function bnstFootBottom(an, sc) { var f = an && typeof an.foot === 'number' ? an.foot : BNST_FOOT; return -(1 - f) * BNST_ANIM_H * (sc > 0 ? sc : 1); }
function bnstBodyW(u, an) { if (an && an.w > 0) return an.w; return (an && an.mount) || (u && u.troop === '騎') ? BNST_W_MOUNT : BNST_W_DEF; }
function bnstReach(u, an) { if (an && an.reach > 0) return an.reach; return (u && BNST_REACH[u.troop]) || 30; }
// 衝刺停點(絕對 x):目標 x - dir × (目標寬 / 2 + reach),不越過目標 x - dir × 20、不往回退;
// 若停點與前面擋路的活人(blockers = [{x, w}],位於出手者與目標之間)太近(< 擋路者半寬 + 自己半寬 - 15),改停在擋路者與目標正中間
function bnstDashStop(sx, tx, dir, wS, wT, reach, blockers) {
  var stop = tx - dir * (wT / 2 + reach), lim = tx - dir * 20, i, b;
  if (dir > 0 ? stop > lim : stop < lim) stop = lim;
  if ((stop - sx) * dir < 0) stop = sx;
  for (i = 0; i < (blockers || []).length; i++) {
    b = blockers[i];
    if ((b.x - sx) * dir > 0 && (tx - b.x) * dir > 0 && Math.abs(stop - b.x) < b.w / 2 + wS / 2 - 15) { stop = (b.x + tx) / 2; break; }
  }
  if ((stop - sx) * dir < 0) stop = sx;
  return stop;
}
// 大招中央演出的圖心 x:我方由 300 每格右移 14;敵方鏡射(起點 544、每格左移 14,圖另外翻面)
function bnstUltX(isMine, k) { return isMine ? 300 + k * 14 : 544 - k * 14; }
// 大招的中央演出是否要顯示台詞(資料欄位先留空:沒有台詞就不出)
var BNST_ULT_LINE = {};
function bnstUltLine(fig) { return Object.prototype.hasOwnProperty.call(BNST_ULT_LINE, fig) ? BNST_ULT_LINE[fig] : ''; }
// 本場需要預載的圖檔清單(角色圖、兵種後備、畫格、共用特效)
function bnstPreloadList(plan) {
  var out = [], seen = {};
  function add(s) { if (s && !seen[s]) { seen[s] = 1; out.push(s); } }
  (plan.mine || []).concat(plan.enemy || []).forEach(function (u) {
    add(bnstFigSrc(u)); add(bnstTroopSrc(u.troop));
    var an = bnstAnimOf(u.fig);
    if (an) { bnstFrames(an.atk, an.atkN).forEach(add); bnstFrames(an.ult, an.ultN).forEach(add); }
  });
  ['fx_slash_d', 'fx_slash_h', 'fx_slash_x', 'fx_impact_ring', 'fx_heal_motes', 'fx_fire_s', 'fx_spark'].forEach(function (f) { add('assets/bnfx/' + f + '.webp'); });
  return out;
}
// 戰法名牌 / 大招名的品質色邊
function bnstQcColor(qc) { return BNST_QCOL[qc] || BNST_QCOL.w; }

// ───────── DOM ─────────
function bnstEsc(s) { return typeof bnRptEsc === 'function' ? bnRptEsc(s) : String(s === undefined || s === null ? '' : s); }
function bnstQ(sel) { return BNST.w ? BNST.w.querySelector(sel) : null; }
// 可暫停計時器:暫停時凍結剩餘毫秒,繼續時接著跑(舞台所有延遲動作都走這裡)
var BNST_TQ = [];
function bnstArm(e) { e.t0 = Date.now(); e.h = setTimeout(function () { var i = BNST_TQ.indexOf(e); if (i >= 0) BNST_TQ.splice(i, 1); e.h = 0; e.fn(); }, e.left); }
function bnstTimer(fn, ms) { var e = { fn: fn, left: Math.max(0, ms), t0: 0, h: 0 }; BNST_TQ.push(e); if (!BNST.paused) bnstArm(e); return e; }
function bnstCancel(e) { var i; if (!e) return; if (e.h) clearTimeout(e.h); e.h = 0; i = BNST_TQ.indexOf(e); if (i >= 0) BNST_TQ.splice(i, 1); }
function bnstPause(on) {
  var i, e, q;
  on = !!on;
  if (on === !!BNST.paused) return;
  BNST.paused = on;
  if (BNST.root && BNST.root.classList) BNST.root.classList.toggle('bst-paused', on);
  q = BNST_TQ.slice();
  for (i = 0; i < q.length; i++) {
    e = q[i];
    if (on) { if (e.h) { clearTimeout(e.h); e.h = 0; e.left = Math.max(0, e.left - (Date.now() - e.t0)); } }
    else if (!e.h) bnstArm(e);
  }
}
function bnstLater(ms, fn) {
  var t = BNST.tok, s = BNST.spd() || 1;
  bnstTimer(function () { if (t === BNST.tok && fn) fn(); }, Math.max(0, ms) / s);
}
function bnstDur(ms) { return Math.max(0, ms) / (BNST.spd() || 1); }
function bnstRestart(el, cls) { if (!el) return; el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }

// 舞台靜態骨架(放進 bncardbattle 的 overlay 內)
function bnstStageHtml() {
  return '<div class="bst-world">' +
    '<div class="bst-scene"></div><div class="bst-backdrop"></div><div class="bst-floor"></div>' +
    '<div class="bst-spot"></div><div class="bst-units"></div>' +
    '<div class="bst-dim"></div><div class="bst-show"><img alt=""></div>' +
    '<div class="bst-ultname"></div><div class="bst-ultline"></div>' +
    '<div class="bst-valance"></div><div class="bst-curtain l"></div><div class="bst-curtain r"></div>' +
    '<div class="bst-round ld-plaque">開鑼</div>' +
    '<div class="bst-banner"><b class="ld-outline"></b><div></div></div>' +
    '<div class="bst-endbtns"><button type="button" class="ld-btn" data-act="replay">重播</button><button type="button" class="ld-btn sub" data-act="report">看戰報</button><button type="button" class="ld-btn sub" data-act="close">關閉</button></div>' +
    '</div>';
}

// 場景背景:預設 assets/ui/bg_home_land.webp(CSS);rec.opts.scene('field'|'city'|'camp'|'arena',預設 field)→ assets/ui/bnbg_<scene>.webp,載入成功才換上,找不到維持預設
var BNST_SCENES = ['field', 'city', 'camp', 'arena'];
function bnstSceneName(scene) { return BNST_SCENES.indexOf(scene) >= 0 ? scene : 'field'; }
function bnstScenePath(scene) { return 'assets/ui/bnbg_' + bnstSceneName(scene) + '.webp'; }
function bnstScene(root, plan) {
  var el = root && root.querySelector ? root.querySelector('.bst-scene') : null, src, im;
  if (!el || typeof Image === 'undefined') return;
  src = bnstScenePath(plan && plan.scene);
  im = new Image();
  im.onload = function () { el.style.backgroundImage = 'url(' + src + ')'; };
  im.src = src;
}
// 掛載:建單位 DOM(依 plan.mine / plan.enemy),記下 root 與速度函式
function bnstMount(root, plan, spdFn) {
  var box, mine = plan.mine || [], foe = plan.enemy || [];
  BNST.tok++;
  BNST_TQ.forEach(function (e) { if (e.h) clearTimeout(e.h); }); BNST_TQ.length = 0; BNST.paused = false;
  BNST.root = root; BNST.w = root.querySelector('.bst-world'); BNST.plan = plan; BNST.U = {}; BNST.skFx = {};
  BNST.spd = spdFn || function () { return 1; };
  bnstScene(root, plan);
  box = root.querySelector('.bst-units');
  if (box) box.innerHTML = '';
  foe.forEach(function (u) { bnstBuildUnit(u, false, box); });   // 先加敵方再加我方:同層級時我方在上
  mine.forEach(function (u) { bnstBuildUnit(u, true, box); });
  BNST.inited = true;
}
function bnstBuildUnit(u, isMine, box) {
  var qc = bnstQc(u.gr), x = bnstX(isMine, u.row), el = document.createElement('div'), rec, body, anim, fb, fbCh;
  el.className = 'bst-u ' + (isMine ? 'mine' : 'foe') + (u.boss ? ' boss' : '');
  el.style.setProperty('--qc', bnstQcColor(qc));
  el.setAttribute('data-id', String(u.id));
  el.innerHTML = '<div class="bst-act">' +
    '<div class="bst-ring' + (qc === 'g' ? ' gold' : '') + '"></div>' +
    (u.boss ? '<div class="bst-flag" style="--fc:' + (isMine ? '#1f7f92' : '#a3261c') + '"><span>帥</span></div>' : '') +
    '<img class="bst-body" alt="">' + '<img class="bst-anim" alt="">' +
    '<div class="bst-fb"></div>' +
    '</div>' +
    '<div class="bst-plate ld-paper"><b>' + bnstEsc(u.name) + '<span class="bst-pos">' + BNST_QN[qc] + '·' + bnstEsc(u.pos) + '</span></b><div class="bst-bar"><i></i></div><div class="bst-hpt"></div></div>' +
    '<div class="bst-tag"></div>';
  box.appendChild(el);
  body = el.querySelector('.bst-body'); anim = el.querySelector('.bst-anim'); fb = el.querySelector('.bst-fb');
  fbCh = Array.from(String(u.name || '?'))[0] || '?';
  fb.textContent = fbCh; fb.style.background = bnstQcColor(qc);
  body.src = bnstFigSrc(u);
  body.onerror = function () {
    if (body.getAttribute('data-fb') !== '1') { body.setAttribute('data-fb', '1'); body.src = bnstTroopSrc(u.troop); }
    else { body.style.display = 'none'; fb.style.display = 'flex'; }
  };
  rec = { u: u, id: u.id, el: el, act: el.querySelector('.bst-act'), body: body, anim: anim, fb: fb, bar: el.querySelector('.bst-bar i'), hpt: el.querySelector('.bst-hpt'), tag: el.querySelector('.bst-tag'), x: x, isMine: isMine, qc: qc, prepId: null, prep: false, mx: u.mx || 1, hp: u.hp0 !== undefined ? u.hp0 : (u.mx || 1), row: u.row | 0, zb: 13, dead: false, actN: 0, hitN: 0 };
  BNST.U[u.id] = rec;
  bnstPlace(rec, u.row, 0);
  el.style.opacity = '0';
  rec.act.style.transform = 'translateX(' + (isMine ? -40 : 40) + 'px)';
}
// 單位 z:陣亡 9 > 出手中 18 > 受擊中 16 > 排號基本層
function bnstZUpd(rec) { rec.el.classList.toggle('acting', rec.actN > 0 && !rec.dead); rec.el.style.zIndex = String(rec.dead ? BNST_Z_DEAD : (rec.actN > 0 ? BNST_Z_ACT : (rec.hitN > 0 ? BNST_Z_HIT : rec.zb))); }
// 擺到某排(換位 / 初始 / 狀態還原):ms = 走過去的時間(已換算速度),0 = 瞬間
function bnstPlace(rec, row, ms) {
  var P = bnstPose(rec.isMine, row), an = bnstAnimOf(rec.u && rec.u.fig);
  rec.row = row | 0; rec.x = P.x; rec.zb = P.z; rec.sc = P.sc;
  rec.el.style.transition = ms > 0 ? 'opacity .25s,left ' + ms + 'ms ease-in-out,top ' + ms + 'ms ease-in-out' : 'opacity .25s';
  rec.el.style.left = P.x + 'px'; rec.el.style.top = P.y + 'px';
  rec.el.style.setProperty('--sc', String(P.sc));
  if (an) rec.anim.style.bottom = bnstFootBottom(an, P.sc) + 'px';
  bnstZUpd(rec);
}
// 命中者暫時提到 16(閃白看得到)
function bnstHitZ(rec) { rec.hitN++; bnstZUpd(rec); bnstLater(300, function () { rec.hitN = Math.max(0, rec.hitN - 1); bnstZUpd(rec); }); }
// 致命一下:停 200 ms 後倒下(z 降到 9);期間若兵力又回來(復活)就不倒
function bnstDie(rec) {
  bnstLater(200, function () { if (rec.hp > 0) return; rec.dead = true; rec.el.classList.add('dead'); bnstZUpd(rec); });
}
// 每位單位的 act 位移(dx,dy 為舞台像素),依速度換算時長
function bnstMove(rec, dx, dy, ms) {
  rec.act.style.transitionDuration = bnstDur(ms) + 'ms';
  rec.act.style.transform = 'translate(' + dx + 'px,' + (dy || 0) + 'px)';
}
function bnstSpot(x, on) {
  var s = bnstQ('.bst-spot');
  if (!s) return;
  if (on) { s.style.left = x + 'px'; s.classList.add('on'); } else s.classList.remove('on');
}
function bnstSetBar(rec, hp) {
  var pct = rec.mx > 0 ? Math.max(0, Math.min(100, Math.round(hp / rec.mx * 100))) : 0;
  rec.hp = hp;
  rec.bar.style.width = pct + '%';
  rec.hpt.textContent = hp > 0 ? '兵力 ' + bnstWan(hp) : '潰滅';
}
// 命中(數字、閃白、抖動、共用特效、大招震動)
function bnstApplyHit(tgtId, x, fxFile) {
  var T = BNST.U[tgtId], n;
  if (!T) return;
  if (x && x.hp !== undefined) bnstSetBar(T, x.hp);
  bnstRestart(T.body, 'bst-flash');
  bnstRestart(T.act, 'bst-shake');
  bnstHitZ(T);
  if (x && x.kill) bnstDie(T);
  if (!BNST.simple && fxFile) bnstFx(T.x, 130, fxFile, 110);
  if (x && x.nv > 0) bnstNum(T, x.nv, x.crit ? 'crit' : '');
  if (x && x.big) bnstQuake();
}
function bnstNum(T, v, cls) {
  var n = document.createElement('div');
  n.className = 'bst-num ld-outline ' + (cls || '');
  n.textContent = '-' + v;
  n.style.left = (T.x + (Math.random() * 30 - 15)) + 'px';
  BNST.w.appendChild(n);
  bnstTimer(function () { if (n.parentNode) n.parentNode.removeChild(n); }, bnstDur(950) + 50);
}
function bnstHealNum(tgtId, v) {
  var T = BNST.U[tgtId], n;
  if (!T || !BNST.w) return;
  n = document.createElement('div');
  n.className = 'bst-num ld-outline heal';
  n.textContent = '+' + v;
  n.style.left = T.x + 'px';
  BNST.w.appendChild(n);
  bnstTimer(function () { if (n.parentNode) n.parentNode.removeChild(n); }, bnstDur(950) + 50);
}
function bnstFx(x, y, file, size) {
  var i;
  if (!BNST.w || !file) return;
  i = document.createElement('img');
  i.className = 'bst-fx';
  i.alt = '';
  i.src = 'assets/bnfx/' + file + '.webp';
  i.style.left = x + 'px'; i.style.top = y + 'px'; i.style.width = (size || 110) + 'px';
  i.style.animationDuration = bnstDur(450) + 'ms';
  BNST.w.appendChild(i);
  bnstTimer(function () { if (i.parentNode) i.parentNode.removeChild(i); }, bnstDur(500) + 50);
}
function bnstQuake() { bnstRestart(BNST.w, 'bst-quake'); }
// 戰法名牌(品質色邊)
function bnstSkillPlate(rec, name) {
  var s = document.createElement('div');
  s.className = 'bst-skill ld-outline';
  s.textContent = name;
  s.style.left = rec.x + 'px';
  s.style.setProperty('--qc', bnstQcColor(rec.qc));
  BNST.w.appendChild(s);
  void s.offsetWidth; s.classList.add('on');
  bnstTimer(function () { s.classList.remove('on'); bnstTimer(function () { if (s.parentNode) s.parentNode.removeChild(s); }, bnstDur(200)); }, bnstDur(380));
}
function bnstPrepSet(rec, id) {
  rec.prep = true; rec.prepId = id;
  rec.el.classList.add('prep');
  rec.tag.textContent = '蓄勢 · 下回合 ' + (typeof bnLogSkName === 'function' ? bnLogSkName(id) : String(id));
  rec.tag.classList.add('on');
}
function bnstPrepClear(rec) {
  rec.prep = false; rec.prepId = null;
  rec.el.classList.remove('prep');
  rec.tag.classList.remove('on');
}
// 衝刺位移(相對原位):停點依雙方寬度、reach、擋路者;目標以原位計
function bnstDashDx(S, T) {
  var dir = S.isMine ? 1 : -1, id, B, bl = [], stop, sS = S.sc > 0 ? S.sc : 1, sT = T.sc > 0 ? T.sc : 1;   // 身寬與武器長度依各自縮放(主將 1.3 倍)
  for (id in BNST.U) {
    B = BNST.U[id];
    if (B !== S && B !== T && B.isMine === T.isMine && !B.dead) bl.push({ x: B.x, w: bnstBodyW(B.u, bnstAnimOf(B.u && B.u.fig)) * (B.sc > 0 ? B.sc : 1) });
  }
  stop = bnstDashStop(S.x, T.x, dir, bnstBodyW(S.u, bnstAnimOf(S.u && S.u.fig)) * sS, bnstBodyW(T.u, bnstAnimOf(T.u && T.u.fig)) * sT, bnstReach(S.u, bnstAnimOf(S.u && S.u.fig)) * sS, bl);
  return stop - S.x;
}
// 普攻:有畫格(bnstAnimOf)→ 衝刺 + 逐格 + 第 atkHit 格命中 + 跑回;否則彈跳衝撞;弓 / 謀(ranged)原地前傾 + 特效飛到目標。回傳命中時刻(ms)
function bnstBasic(src, tgt, x) {
  var S = BNST.U[src.id], T = BNST.U[tgt.id], an, dx, hitMs, i, sh = BNST.simple;
  if (!T) return 0;
  if (!S) { bnstApplyHit(tgt.id, x, BNST_FX_BASIC); return 0; }
  an = bnstAnimOf(src.fig);
  dx = bnstDashDx(S, T);
  function actOn() { S.actN++; bnstZUpd(S); }
  function actOff() { S.actN = Math.max(0, S.actN - 1); bnstZUpd(S); }
  if (an && an.atk) {
    actOn();
    if (!sh) bnstSpot(S.x, true);
    S.el.classList.add('anim-on');
    S.anim.src = 'assets/fullbody/anim/' + an.atk + '1.webp';
    bnstMove(S, dx, 0, 260);
    for (i = 2; i <= an.atkN; i++) {
      (function (k) { bnstLater(260 + (k - 1) * 65, function () { S.anim.src = 'assets/fullbody/anim/' + an.atk + k + '.webp'; if (k === an.atkHit) bnstApplyHit(tgt.id, x, BNST_FX_BASIC); }); })(i);
    }
    hitMs = 260 + (an.atkHit - 1) * 65;
    bnstLater(260 + (an.atkN - 1) * 65 + 65, function () { S.el.classList.remove('anim-on'); S.el.classList.add('back'); bnstMove(S, 0, 0, 220); });
    bnstLater(260 + (an.atkN - 1) * 65 + 65 + 220, function () { S.el.classList.remove('back'); bnstSpot(S.x, false); actOff(); });
    return hitMs;
  }
  if (src.ranged || (src.troop === '弓' || src.troop === '謀')) {
    bnstMove(S, (S.isMine ? 14 : -14), 0, 150);
    bnstLater(0, function () { bnstFx(S.x, 250, BNST_FX_BASIC, 90); });
    bnstLater(300, function () { bnstApplyHit(tgt.id, x, BNST_FX_BASIC); });
    bnstLater(380, function () { bnstMove(S, 0, 0, 180); });
    return 300;
  }
  if (!sh) bnstSpot(S.x, true);
  actOn();
  bnstMove(S, dx * 0.15, -14, 120);
  bnstLater(120, function () { bnstMove(S, dx, 0, 160); });
  bnstLater(280, function () { bnstApplyHit(tgt.id, x, BNST_FX_BASIC); });
  bnstLater(280 + 40, function () { bnstMove(S, 0, 0, 220); });
  bnstLater(280 + 260, function () { bnstSpot(S.x, false); actOff(); });
  return 280;
}
// 有畫格的大招:暗場 → 中央播 ult 格 → 大字名 → 命中格回傳(播放器等到這裡,之後的命中項目即時顯示)
function bnstUlt(u, id, frames) {
  var S = BNST.U[u.id], an, name, t0 = 450, impact, fr;
  if (!S) return 0;
  if (S.prep && S.prepId === id) bnstPrepClear(S);
  name = typeof bnLogSkName === 'function' ? bnLogSkName(id) : String(id);
  BNST.skFx[u.id] = BNST_FX_RING;
  if (frames) {
    an = bnstAnimOf(u.fig);
    fr = bnstFrames(an.ult, an.ultN);
    impact = t0 + (an.ultHit - 1) * 90;
    bnstSpot(0, false);
    bnstQ('.bst-dim') && bnstQ('.bst-dim').classList.add('on');
    S.el.style.visibility = 'hidden';
    var sh = bnstQ('.bst-show'), im = sh ? sh.querySelector('img') : null;
    if (sh && im) {
      sh.classList.toggle('foe', !S.isMine);   // 敵方:圖翻面、起點 544、往左移
      sh.style.display = 'block'; sh.style.left = bnstUltX(S.isMine, 0) + 'px'; im.src = fr[0];
      fr.forEach(function (src, k) {
        bnstLater(t0 + k * 90, function () { im.src = src; sh.style.left = bnstUltX(S.isMine, k) + 'px'; if (k === an.ultHit - 1) { bnstQ('.bst-dim') && bnstQ('.bst-dim').classList.remove('on'); bnstQuake(); } });
      });
      bnstLater(t0 - 60, function () { var n = bnstQ('.bst-ultname'), l = bnstQ('.bst-ultline'), line = bnstUltLine(u.fig); if (n) { n.textContent = name; n.classList.add('on'); } if (l && line) { l.textContent = '「' + line + '」'; l.classList.add('on'); } });
      bnstLater(t0 + fr.length * 90 + 200, function () {
        var n = bnstQ('.bst-ultname'), l = bnstQ('.bst-ultline');
        if (n) n.classList.remove('on'); if (l) l.classList.remove('on');
        sh.style.display = 'none'; S.el.style.visibility = ''; bnstQ('.bst-dim') && bnstQ('.bst-dim').classList.remove('on');
      });
    }
    return impact;
  }
  // 無畫格:原地放大 1.3 倍 + 身後品質色光 + 戰法名牌 + 共用特效
  S.el.classList.add('ult-big');
  bnstSkillPlate(S, name);
  if (!BNST.simple) bnstFx(S.x, 150, BNST_FX_RING, 140);
  bnstLater(500, function () { S.el.classList.remove('ult-big'); });
  return 500;
}

// 開場:預載由呼叫端完成;幕布拉開 0.8 s → 主將→中衛→前鋒 淡入 → 「戰」字牌 0.7 s → cb
function bnstIntro(plan, cb) {
  var k, boss = function (list) { return (list.filter(function (u) { return u.boss; })[0] || { name: '?' }).name; };
  bnstLater(0, function () { if (BNST.w) BNST.w.classList.add('open'); });
  for (k = 0; k < 3; k++) {
    (function (row) {
      bnstLater(800 + (2 - row) * 220, function () {
        (plan.mine || []).concat(plan.enemy || []).forEach(function (u) {
          var r = BNST.U[u.id];
          if (r && u.row === row) { r.el.style.opacity = '1'; r.act.style.transform = 'translateX(0)'; }
        });
      });
    })(2 - k);
  }
  bnstLater(800 + 3 * 220, function () {
    var b = bnstQ('.bst-banner');
    if (b) { b.querySelector('b').textContent = '戰'; b.querySelector('div').textContent = '我方 ' + boss(plan.mine || []) + ' vs 敵方 ' + boss(plan.enemy || []); b.classList.add('on'); }
  });
  bnstLater(800 + 3 * 220 + 700, function () { var b = bnstQ('.bst-banner'); if (b) b.classList.remove('on'); if (cb) cb(); });
}
// 直接顯示全部單位(從某回合重播、或跳過時不演亮相)
function bnstRevealAll() {
  var id;
  for (id in BNST.U) { BNST.U[id].el.style.opacity = '1'; BNST.U[id].act.style.transitionDuration = '0ms'; BNST.U[id].act.style.transform = 'translateX(0)'; }
  if (BNST.w) BNST.w.classList.add('open');
}
// 狀態同步:兵力條、潰滅
// rows(可省略)= {id: 排號}:還原換位後的站位(瞬間)
function bnstSetState(hp, dead, rows) {
  var id;
  for (id in BNST.U) {
    var R = BNST.U[id], h = hp ? hp[id] : undefined, d = dead ? !!dead[id] : false;
    if (h === undefined) h = R.mx;
    bnstSetBar(R, Math.max(0, Math.round(h || 0)));
    R.el.classList.toggle('dead', d);
    R.dead = d; R.actN = 0; R.hitN = 0;
    if (rows && rows[id] !== undefined && (rows[id] | 0) !== R.row) bnstPlace(R, rows[id], 0); else bnstZUpd(R);
  }
}
function bnstSetRound(text) { var r = bnstQ('.bst-round'); if (!r) return; r.textContent = text; bnstRestart(r, 'drop'); }
// 結束:停 0.9 → 幕布合上 → 勝 / 敗 / 平 牌 → 按鈕;instant = 跳過(直接顯示)
function bnstEnd(plan, instant) {
  var b = bnstQ('.bst-banner'), btn = bnstQ('.bst-endbtns'), res = plan.win === plan.mySide ? '勝' : (plan.win === 'draw' ? '平' : '敗');
  function show() { if (b) { b.className = 'bst-banner' + (res === '敗' ? ' lose' : (res === '平' ? ' draw' : '')); b.querySelector('b').textContent = res === '勝' ? '大勝' : (res === '敗' ? '敗北' : '平手'); b.querySelector('div').textContent = plan.endTxt || ''; b.classList.add('on'); } if (btn) btn.style.display = 'block'; }
  bnstSpot(0, false);
  if (instant) { if (BNST.w) BNST.w.classList.remove('open'); show(); return; }
  bnstLater(900, function () { if (BNST.w) BNST.w.classList.remove('open'); });
  bnstLater(900 + 850, show);
}
function bnstEndHide() {
  var b = bnstQ('.bst-banner'), btn = bnstQ('.bst-endbtns');
  if (b) { b.classList.remove('on'); b.classList.remove('lose'); b.classList.remove('draw'); }
  if (btn) btn.style.display = 'none';
}
// 舞台縮放:844×390 等比置中
function bnstFit(stageEl) {
  var s, W = window.innerWidth || 844, H = window.innerHeight || 390;
  if (!stageEl) return;
  s = Math.min(W / 844, H / 390);
  stageEl.style.transform = 'translate(-50%,-50%) scale(' + (s > 0 ? s : 1) + ')';
}

// 掛鉤(播放器呼叫)
BNST.hooks = {
  onAct: function (u) {
    var S = BNST.U[u.id];
    if (S && !BNST.simple) bnstSpot(S.x, true);
    return 0;
  },
  onSkill: function (u, x) {
    var S = BNST.U[u.id];
    if (!S) return 0;
    BNST.skFx[u.id] = bnstFxFor(x.th, x.kind);
    if (S.prep && S.prepId === x.id) bnstPrepClear(S);
    if (BNST.simple) return 0;
    bnstSkillPlate(S, x.name || '');
    return 380;
  },
  onHit: function (src, tgt, kind, cat, x) {
    var fx;
    if (!tgt || !BNST.U[tgt.id]) return 0;
    if (x && x.big) { bnstApplyHit(tgt.id, x, BNST.skFx[src && src.id] || BNST_FX_RING); return 0; }
    if (kind === 'basic') return bnstBasic(src, tgt, x);
    fx = kind === 'react' ? BNST_FX_RING : (BNST.skFx[src && src.id] || BNST_FX_DEF);
    bnstApplyHit(tgt.id, x, fx);
    return 170;
  },
  onPassive: function (u, label) {
    var S = BNST.U[u.id], p;
    if (!S || BNST.simple) return 0;
    p = document.createElement('div');
    p.className = 'bst-pas';
    p.textContent = label;
    p.style.left = S.x + 'px';
    BNST.w.appendChild(p);
    bnstTimer(function () { if (p.parentNode) p.parentNode.removeChild(p); }, bnstDur(650));
    return 250;
  },
  onPrep: function (u, id) {
    var S = BNST.U[u.id];
    if (S) bnstPrepSet(S, id);
    return 0;
  },
  onMove: function (moves) {
    (moves || []).forEach(function (m) { var R = BNST.U[m.u]; if (R) bnstPlace(R, m.row, bnstDur(300)); });
    return 300;
  },
  onUltShow: function (fig, id, uu) {
    var u = uu || null, list = BNST.plan ? (BNST.plan.mine || []).concat(BNST.plan.enemy || []) : [], i;   // 優先用單位本身(鏡像對戰時 fig 會對到錯人)
    if (!u) for (i = 0; i < list.length; i++) if (list[i].fig === fig) { u = list[i]; break; }
    return u ? bnstUlt(u, id, true) : 0;
  },
  onUltCard: function (u, id) {
    return bnstUlt(u, id, false);
  },
  onEnd: function (plan, instant) { bnstEnd(plan, instant); }
};

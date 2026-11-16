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
// 呂布 / 趙雲 / 張飛:2026-11 以現有 GPT 成品接入(tools/art/anim_cut.py 切格,320×261、腳底 224px = 0.86);畫風較舊,日後重畫再換。
// 趙雲普攻用「連刺 12 格」(沒有 8 格普攻圖),atkN 12;命中格:呂布普攻 8 = 長戟全力前刺、大招 10 = 爆裂;趙雲普攻 6 = 螺旋突刺頂點、大招 11 = 白光爆發;張飛普攻 6 = 蛇矛光束、大招 10 = 矛尖砸地
// 大招畫格結構(2026-11-16 使用者決議,見 設計_戰鬥美術與程式動畫規格.md):前段 1~3 格跑位 → cutAt 接觸格(凍結 + 暗場 + 立繪 cut-in)→ 後段 5~11 格演出 → 12 收招 → 畫格水平翻轉跑回
// ku = 大招畫格顯示倍率(同 k);cutAt = 接觸格序;dur = 每格毫秒(1×)陣列;back = 跑回用畫格序(缺省 cutAt - 1,水平翻轉)
// 接觸格凍結 = 戰法演出幕(bnstScrPlan:1× 1100 ms、2× 550、3× 首次 500、3× 之後不凍結),取代舊的 暗場 160 + cut-in 滑入 260 / 停留 500 / 淡出 200
function BNST_ULT_DUR(hit) { var a = [110, 100, 100, 130], i; for (i = 5; i <= 12; i++) a.push(i < hit ? 150 : i === hit ? 240 : i === 12 ? 220 : 160); return a; }
// k = 普攻畫格顯示倍率(畫格顯示高 131px × k):依畫格內人物頭高(guanyu 60 / lvbu 47 / zhaoyun 54 / zhangfei 62 px,畫格高 261)換成與站立頭高 BNST_HEAD_PX(37)一致;大招中央演出另放大 1.6 倍(css .bst-show img)
var BNST_ANIM = { guanyu: { atk: 'guanyu_a', atkN: 8, atkHit: 6, ult: 'guanyu_c', ultN: 12, ultHit: 10, ranged: false, foot: 0.86, k: 1.23, ku: 1.6, cutAt: 4, dur: BNST_ULT_DUR(10),
    seq: ['guanyu_c1', 'guanyu_c2', 'guanyu_c3', 'guanyu_c4', 'guanyu_b1', 'guanyu_b2', 'guanyu_b3', 'guanyu_b4', 'guanyu_b5', 'guanyu_b6', 'guanyu_c11', 'guanyu_c12'] },   // 2026-11-16 大招:c1~c3 跑位 → c4 接觸(凍結 + 演出幕)→ b1~b6 青龍特效格(第 10 格 b6 青龍衝擊 = 命中)→ c11 / c12 收招;缺的 c5~c10 不再使用
  lvbu: { atk: 'lvbu_a', atkN: 8, atkHit: 8, ult: 'lvbu_c', ultN: 12, ultHit: 10, ranged: false, foot: 0.86, mount: true, reach: 45, k: 1.55, ku: 1.4, cutAt: 4, dur: BNST_ULT_DUR(10) },
  zhaoyun: { atk: 'zhaoyun_a', atkN: 12, atkHit: 6, ult: 'zhaoyun_c', ultN: 12, ultHit: 11, ranged: false, foot: 0.86, mount: true, reach: 45, k: 1.37, ku: 1.5, cutAt: 4, dur: BNST_ULT_DUR(11) },
  zhangfei: { atk: 'zhangfei_a', atkN: 8, atkHit: 6, ult: 'zhangfei_c', ultN: 12, ultHit: 10, ranged: false, foot: 0.86, reach: 45, k: 1.19, ku: 1.6, cutAt: 4, dur: BNST_ULT_DUR(10) } };
var BNST_FOOT = 0.78, BNST_ANIM_H = 131, BNST_BODY_H = 122;
// 站位(844 寬基準,我方朝右、敵方翻面朝左):row 0 前鋒 / 1 中衛 / 2 主將;三排縮放一律 1(主將不放大,以帥旗與底座圈區分),腳底 y 與基本 z 依排號
// WP1 戰場假 3D(設計_戰場假3D立體化.md 2.3):depth = 縮小置中 + 縱深斜向 V 字(G = 0.84);center = 只縮小置中(平行站位,截圖對比用);old = 舊版。row 語意不變
// zb(z-index)由腳底 y 推算:zb = 11 + round((y - 276) / 25),前排蓋後排
function bnstZb(y) { return 11 + Math.round((y - 276) / 25); }
var BNST_LAYOUTS = {
  depth: { x: { mine: [372, 282, 192], foe: [472, 562, 652] }, y: [326, 300, 276], sc: [0.84, 0.78, 0.73], zb: [bnstZb(326), bnstZb(300), bnstZb(276)] },
  center: { x: { mine: [372, 282, 192], foe: [472, 562, 652] }, y: [322, 322, 322], sc: [0.84, 0.84, 0.84], zb: [13, 12, 11] },
  old: { x: { mine: [360, 235, 110], foe: [484, 609, 734] }, y: [322, 312, 302], sc: [1, 1, 1], zb: [13, 12, 11] }
};
var BNST_Y, BNST_SC, BNST_ZB, BNST_X_POS;   // row 0 前鋒 / 1 中衛 / 2 主將
function bnstSetLayout(name) { var L = BNST_LAYOUTS[name] || BNST_LAYOUTS.depth; BNST_Y = L.y; BNST_SC = L.sc; BNST_ZB = L.zb; BNST_X_POS = L.x; }
bnstSetLayout('depth');
// 名人頭高表:fig → 該圖「頭頂到下巴」佔整張圖高度的比例(新 Q 版 assets/fullbody 目測量;騎乘者量騎士的頭,帽 / 髮髻 / 羽飾只計一部分)。
// 顯示高度 = 目標頭高 / 比例,使所有名人頭部一致(騎乘 / 持長物者圖雖高或寬,頭仍一樣大);不在表內者(兵種後備圖等)用 BNST_BODY_H
var BNST_HEAD_PX = 37, BNST_BODY_MIN = 100, BNST_BODY_MAX = 170;
var BNST_HEAD = {
  boca: .32, caiyan: .29, caiyong: .33, caocao: .26, caochun: .25, caohong: .26, caoren: .32, caoxing: .25, caozhi: .29, chendao: .26, chengpu: .27, chengyu: .20,
  chengyuanzhi: .27, daqiao: .24, dengmao: .25, dianwei: .26, diaochan: .24, dingfeng: .26, dongzhuo: .25, fazheng: .27, ganfuren: .31, ganning: .31, gaoshun: .28, gongsunzan: .27,
  guanhai: .38, guanyu: .27, guojia: .24, guosi: .25, guotai: .32, handang: .29, hanhao: .25, heyi: .25, huangfusong: .28, huanggai: .29, huangyueying: .31, huangzhong: .29,
  huatuo: .29, huaxiong: .34, jianyong: .38, jiaxu: .23, kanze: .26, liaohua: .22, lijue: .31, lingtong: .26, liru: .30, liubei: .26, liupi: .25, liuzhang: .26,
  lusu: .31, luxun: .25, luzhi: .26, lvbu: .22, lvfan: .25, lvmeng: .24, machao: .29, maliang: .25, masu: .29, mateng: .31, mayuanyi: .27, mifang: .35,
  mifuren: .34, mizhu: .31, nanhua: .25, panfeng: .27, pangde: .25, pangtong: .30, peiyuanshao: .24, quyi: .28, renjun: .40, shamoke: .30, shihuan: .23, shixie: .27,
  simayi: .24, sunben: .25, sunce: .23, sunjian: .27, sunjing: .29, sunqian: .31, sunquan: .26, sunshangxiang: .24, taishici: .28, taoqian: .27, tianyu: .26, wangping: .25,
  weiyan: .33, weizi: .29, wujing: .28, xiahoudun: .29, xiahouyuan: .24, xiaoqiao: .26, xuchu: .33, xuhuang: .29, xunyou: .25, xunyu: .28, xurong: .36, xushu: .24,
  yangxiu: .26, yanyan: .30, youtu: .33, yuanshao: .24, yuanshu: .28, yudu: .30, yufuluo: .33, yuji: .26, zhangbao: .27, zhangfei: .32, zhanghe: .27, zhanghong: .34,
  zhangjiao: .34, zhangkai: .25, zhangliang: .27, zhangliao: .28, zhanglu: .32, zhangmancheng: .26, zhangniujiao: .34, zhangyan: .36, zhangzhao: .26, zhaoyun: .22, zhengxuan: .24, zhenji: .29,
  zhongyao: .25, zhoucang: .34, zhoutai: .30, zhouyu: .27, zhugeliang: .28, zhujun: .27, zhuzhi: .37, zumao: .36, zuoci: .24
};
function bnstBodyH(fig) {
  var r = fig && Object.prototype.hasOwnProperty.call(BNST_HEAD, fig) ? BNST_HEAD[fig] : 0;
  if (!(r > 0)) return BNST_BODY_H;
  return Math.max(BNST_BODY_MIN, Math.min(BNST_BODY_MAX, Math.round(BNST_HEAD_PX / r)));
}
// 動態 z:受擊中 16、出手中(衝刺到跑回)18、陣亡 9(暗場 20 之下)
var BNST_Z_HIT = 16, BNST_Z_ACT = 18, BNST_Z_DEAD = 9;
// 衝刺停點用的預設身體寬(步行 / 騎乘)與武器尖端距離(依兵種)
var BNST_W_DEF = 71, BNST_W_MOUNT = 95, BNST_REACH = { '槍': 45, '騎': 40, '盾': 30, '弓': 30, '械': 30, '謀': 30 };
// 兵種 → 站姿後備圖;謀略型(dt:'strat')一律用 str(謀士);械:器械專屬圖尚缺(assets/fullbody/bn_body_siege.webp),暫用 inf
var BNST_TROOP_IMG = { '槍': 'inf', '騎': 'cav', '盾': 'shield', '弓': 'arc', '械': 'inf', '謀': 'str' };
// 品階 gr → 品質色:0 白、1 青(併入白)、2 藍、3 紫、4 金(5 階以上視同金)
var BNST_QC = ['w', 'w', 'b', 'p', 'g'];
var BNST_QN = { w: '白', b: '藍', p: '紫', g: '金' };
var BNST_QCOL = { w: '#d9d9d9', b: '#4aa3ff', p: '#b46cff', g: '#ffc940' };
var BNST_QWORD = { w: '白', b: '藍', p: '紫', g: '金' };
// 戰法文化主題 th → 共用特效(bnfx 現有圖;與 bndraw.js BN_FX 同源,取 cast / hit 圖)
var BNST_FX_TH = { thunder: 'fxc_thunder_strike', fireox: 'fxc_fireox_trail', talisman: 'fxc_talisman_burn', ink: 'fxc_ink_splash', wuxing: 'fxc_wx_disc', yinyang: 'fxc_yy_flip', crossbow: 'fxc_crossbow_volley', drum: 'fxc_drum_wave', banner: 'fxc_banner', charm: 'fxc_mirage', bagua: 'fxc_bagua_disc' };
// 無 th 時依 kind:治療 / 護盾 / 持續傷害 / 復活
var BNST_FX_KIND = { heal_single: 'fx_heal_motes', heal_all: 'fx_heal_motes', heal_hot: 'fx_heal_motes', revive: 'fx_heal_pillar', shield_single: 'fx_shield_dome', shield_all: 'fx_shield_dome', dot_burn: 'fx_fire_s', dot_poison: 'fx_poison_mist', dot_bleed: 'fx_slash_h', atk_multi: 'fx_spark' };
var BNST_FX_DEF = 'fx_slash_d', BNST_FX_RING = 'fx_impact_ring', BNST_FX_BASIC = 'fx_slash_d', BNST_FX_STRAT = 'fx_spark';   // 謀略型普攻:火花(非刀光)
var BNST_PAS_LABEL = { ctr: '反擊', evade: '閃避', ccimm: '免控', immune: '免疫', react: '反應' };
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
function bnstTroopSrc(troop, dt) { var k = dt === 'strat' ? BNST_TROOP_IMG['謀'] : (BNST_TROOP_IMG[troop] || 'inf'); return 'assets/fullbody/bn_body_' + k + '.webp'; }
// 角色圖:有 fig 用 assets/fullbody/<fig>.webp,否則兵種圖
function bnstFigSrc(u) { return u && u.fig ? 'assets/fullbody/' + u.fig + '.webp' : bnstTroopSrc(u ? u.troop : '', u ? u.dt : ''); }
// 謀略型(dt:'strat')或遠程兵種(弓 / 械 / 舊『謀』):普攻原地施放、不衝刺
function bnstIsStrat(u) { return !!u && (u.dt === 'strat' || u.troop === '謀'); }
function bnstIsRanged(u) { return !!u && (u.ranged || u.troop === '弓' || u.troop === '械' || bnstIsStrat(u)); }
// 畫格路徑:assets/fullbody/anim/<prefix><n>.webp,n 從 1 起
function bnstFrames(prefix, n) { var r = [], i; for (i = 1; i <= n; i++) r.push('assets/fullbody/anim/' + prefix + i + '.webp'); return r; }
// 大招畫格路徑:an.seq(畫格檔名陣列,不含副檔名,可混用 c / b 系列)優先,否則 ult 前綴 + 1..ultN
function bnstUltFrames(an) { return an.seq && an.seq.length ? an.seq.map(function (n) { return 'assets/fullbody/anim/' + n + '.webp'; }) : bnstFrames(an.ult, an.ultN); }
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
function bnstFootBottom(an, sc) { var f = an && typeof an.foot === 'number' ? an.foot : BNST_FOOT; return -(1 - f) * BNST_ANIM_H * (an && an.k > 0 ? an.k : 1) * (sc > 0 ? sc : 1); }
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

// ───────── 戰法演出幕(設計_戰法演出幕.md S1~S3;S4 短版 / S5 選圖預載 / S6 換真圖尚未做)─────────
// 圖層 .bst-scr 在 .bst-world 內、鏡頭層 .bst-cam 外(不吃鏡頭推近與震動):L0 雙層模糊戰場 / L1 筆刷色帶 + 墨點 / L2 效果圖(目前:類別色漸層) / L3 立繪(可多格) / L4 金色戰法名
// 時序表 BNST_SCR_BASE 單位 = 「規劃毫秒」(1× 實際毫秒);實際毫秒 = 規劃毫秒 × plan.k(1× → 1、2× → 0.5、3× 首次 → 固定 500 ms 總長)
var BNST_SCR_BASE = { l0In: 140, pan: 40, panIn: 180, fig: 80, figIn: 220, ttl: 220, ttlIn: 120, nm: 240, nmIn: 160, shake: 340, shakeD: 80, out: 900, outD: 160, l0out: 940, l0outD: 160, end: 1100 };
var BNST_SCR_FAST_MS = 500;   // 3× 首次:固定實際毫秒
var BNST_SCR_FRAME_MS = 270, BNST_SCR_FRAME_MAX = 3, BNST_SCR_SW = ['cut', 'fade', 'flash', 'slide'];
// 動態立繪多格(預留介面):BNST_SCR_POSE[fig] = { frames: [ 圖路徑 | { src: 路徑, ms: 這一格停留毫秒(1×), sw: 切入方式 }, ... 最多 3 格 ], ms: 預設每格毫秒, sw: 預設切入方式 }
//   sw:cut 直接換 / fade 淡入 / flash 白閃後換 / slide 由側邊滑入;第 1 格一律隨立繪窗滑入(sw 忽略)。各格 ms 總和 > 820(基準立繪停留)時,演出幕自動延長;沒登記 = 單張立繪(原本流程)。
//   使用者要的「側面動畫 → 正面立繪連續格 → 回到側面接大招」:側面動畫 = 接觸格以前的畫格,連續格 = 這裡,之後畫格續播(由 bnstUltCut 的凍結 / 接續流程負責)
// 關羽:舉刀 12 格翻頁(以前翻漫畫格子的手繪翻頁感):硬切、不補間,±2px / ±0.5° 確定性抖動;圖源 = 12 格拼版圖集(4 欄 × 3 列,tools/art/unmult_white.py 去白底後存 assets/cutin/guanyu_cutin_sheet.webp)。
//   reg:true = 圖集登記到 BNST_SCR_FILES 後才使用(避免對不存在的檔打 404),未登記 / 缺檔 → 單張立繪 guanyu 原圖。改成多個單格檔:把 sheet 換成 files:['assets/cutin/guanyu_cutin_1.webp', …];節奏 / 重複格 / 抖動開關見 bnstScrFrames 說明
var BNST_SCR_POSE = { guanyu: { reg: true, flip: true, jitter: true, sheet: { src: 'assets/cutin/guanyu_cutin_sheet.webp', cols: 4, rows: 3 } } };
var BNST_SCR_FILES = { 'assets/cutin/guanyu_cutin_sheet.webp': 1 };   // 關羽圖集為透明底(含 alpha,程式手繪線稿直接合成);翻頁模式立繪窗有米色紙底(css);其他立繪格檔到齊後在此登記(或由 js/bnst_scr_list.js 填)
var BNST_SCR_CUTIN = {};   // 已有 assets/cutin/<fig>.webp 的名單(fig → 1);登記後立繪優先用它,避免對不存在的檔打 404
// 效果插畫登記:key → 路徑(1536×544 成品);未登記 / 載入失敗 = 類別色漸層。S6 換真圖時填
var BNST_SCR_ART = {};
// 效果類別主色(設計 L2 表):缺插畫時用 linear-gradient(100deg,#1a1012,<主色> 55%,#1a1012)
var BNST_SCR_COLOR = { slash: '#FFE9A8', fire: '#FF7A1A', strat: '#7E5BEF', spear: '#DDE6F0', arrow: '#FFC24A', cavalry: '#E0A040', shield: '#F2C14E', thunder: '#C9B8FF', heal: '#7CE07A', debuff: '#6A3FA0', drum: '#D8432A', water: '#2F8FD8', siege: '#E8892A' };
var BNST_SCR_TH = { fireox: 'fire', thunder: 'thunder', talisman: 'strat', bagua: 'strat', wuxing: 'strat', yinyang: 'strat', ink: 'strat', charm: 'strat', crossbow: 'arrow', drum: 'drum', banner: 'drum' };
var BNST_SCR_TROOP = { '槍': 'spear', '弓': 'arrow', '騎': 'cavalry', '械': 'siege' };
// 選效果類別:文化主題 th → 效果 kind → 傷害型 ty → 兵種 troop → 斬擊(同 bnstFxFor 順序)。tags 含 water 先歸水攻(僅配色)
function bnstScrKey(th, kind, ty, troop, tags) {
  var has = Object.prototype.hasOwnProperty;
  if (th && has.call(BNST_SCR_TH, th)) return BNST_SCR_TH[th];
  if (kind === 'dot_burn') return 'fire';
  if (kind && /^shield_/.test(kind)) return 'shield';
  if (kind && (/^heal_/.test(kind) || kind === 'revive')) return 'heal';
  if (kind && /^(stun|bind|sleep|silence|confuse|taunt|timid|debuff)/.test(kind)) return 'debuff';
  if (tags && tags.indexOf && tags.indexOf('water') >= 0) return 'water';
  if (ty === 'strat') return 'strat';
  if (troop && has.call(BNST_SCR_TROOP, troop)) return BNST_SCR_TROOP[troop];
  return 'slash';
}
// 立繪候選圖(依序退化):cutin(有登記才用)→ 半身 / 頭像 portraits → Q 版全身 fullbody
function bnstScrChain(fig) {
  var r = [];
  if (!fig) return r;
  if (Object.prototype.hasOwnProperty.call(BNST_SCR_CUTIN, fig)) r.push('assets/cutin/' + fig + '.webp');
  r.push('assets/portraits/' + fig + '.webp'); r.push('assets/fullbody/' + fig + '.webp');
  return r;
}
// 立繪格序列:回 [{c: 候選路徑陣列, ms, sw, k: 圖槽序, cell, j}];沒登記 = 一格(ms 0 = 停到演出結束)
// 三種來源:① 預設單張(chain 退路);② pose.frames 多個單格檔(最多 3 格,各格 ms / sw);③ 翻頁模式 pose.flip:pose.sheet = {src, cols, rows}(單張圖集 + 格座標,格序由左到右、由上到下,從 1 起)
//   或 pose.files = [單格檔路徑…](最多 12 個,%d 範本亦可由呼叫端展開);pose.order = 播放格序(可重複同一格,缺省 1..N);pose.ms = 每格毫秒(數字或陣列,陣列不足沿用最後一個,節奏可不均);
//   pose.jitter = false 可關閉抖動(預設開);翻頁模式一律硬切(sw 'flip'),不補間、不淡入淡出
// 翻頁預設節奏(使用者決議):前 8 格 70 ms、第 9~11 格 100 ms、第 12 格 180 ms,合計 1040 ms
var BNST_SCR_FLIP_MS = [70, 70, 70, 70, 70, 70, 70, 70, 100, 100, 100, 180], BNST_SCR_FLIP_MAX = 24, BNST_SCR_SLOTS = 12;
// 翻頁抖動(確定性):以(格序 i、種子)算 ±2px 位移與 ±0.5° 旋轉;同一大招每次播放相同
function bnstScrJitter(i, seed) {
  var s = (Math.imul((i | 0) + 1, 2654435761) ^ Math.imul((seed | 0) + 97, 40503)) >>> 0;
  function rnd() { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return ((s >>> 8) / 16777216) * 2 - 1; }
  return { dx: Math.round(rnd() * 20) / 10, dy: Math.round(rnd() * 20) / 10, rot: Math.round(rnd() * 5) / 10 };
}
function bnstScrSeed(fig) { var h = 7, i, s = String(fig || ''); for (i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) >>> 0; return h; }
function bnstScrFrames(fig, pose) {
  var p = pose || (fig && Object.prototype.hasOwnProperty.call(BNST_SCR_POSE, fig) ? BNST_SCR_POSE[fig] : null), list = p && p.frames && p.frames.length ? p.frames.slice(0, BNST_SCR_FRAME_MAX) : null, out = [], dMs = p && p.ms > 0 ? p.ms : BNST_SCR_FRAME_MS, dSw = p && BNST_SCR_SW.indexOf(p.sw) >= 0 ? p.sw : 'fade',
    sh = p && p.flip && p.sheet && p.sheet.src ? p.sheet : null, fl = p && p.flip && !sh && p.files && p.files.length ? p.files.slice(0, BNST_SCR_SLOTS) : null, n, order, ms, i, seed = bnstScrSeed(fig), need;
  if (p && p.reg) {   // 要求登記:圖檔(圖集 / 全部單格)必須已列入 BNST_SCR_FILES,否則退回單張立繪(缺檔不打 404)
    need = sh ? [sh.src] : (fl ? fl : (list || []).map(function (f) { return typeof f === 'string' ? f : f && f.src; }));
    if (!need.length || !need.every(function (s) { return BNST_SCR_FILES[s]; })) { sh = null; fl = null; list = null; }
  }
  if (sh || fl) {
    n = sh ? Math.max(1, (sh.cols | 0) * (sh.rows | 0)) : fl.length;
    order = p.order && p.order.length ? p.order.slice(0, BNST_SCR_FLIP_MAX) : Array.apply(null, Array(n)).map(function (_, q) { return q + 1; });
    ms = p.ms !== undefined ? p.ms : BNST_SCR_FLIP_MS;
    order.forEach(function (cell, q) {
      var c = Math.max(1, Math.min(n, cell | 0)), m = Array.isArray(ms) ? (ms[q] > 0 ? ms[q] : ms[ms.length - 1]) : (ms > 0 ? ms : 100);
      out.push({ c: sh ? [sh.src] : [fl[c - 1]], ms: Math.max(30, Math.min(1500, m)), sw: 'flip', k: sh ? 0 : c - 1, cell: sh ? { src: sh.src, col: (c - 1) % sh.cols, row: Math.floor((c - 1) / sh.cols), cols: sh.cols, rows: sh.rows } : null, j: p.jitter === false ? null : bnstScrJitter(q, seed) });
    });
    return out;
  }
  if (!list) return [{ c: bnstScrChain(fig), ms: 0, sw: 'cut', k: 0, cell: null, j: null }];
  list.forEach(function (f, q) {
    var src = typeof f === 'string' ? f : (f && f.src) || '', ms2 = f && f.ms > 0 ? f.ms : dMs, sw = f && BNST_SCR_SW.indexOf(f.sw) >= 0 ? f.sw : dSw;
    out.push({ c: src ? [src].concat(q === 0 ? bnstScrChain(fig) : []) : bnstScrChain(fig), ms: Math.max(60, Math.min(1500, ms2)), sw: q === 0 ? 'cut' : sw, k: q, cell: null, j: null });
  });
  return out;
}
// 時序規劃(純函式):spd = 目前倍速,first = 該單位本場第一次放大招,frames = bnstScrFrames 結果
// 回 {play, fast, k, total(規劃 ms), real(實際 ms), pause1x(給舞台凍結用的 1× 毫秒,bnstLater 會再 ÷ 速度), ext(多格延長), t, fr:[{at, ms, sw}]};3× 非首次 play = false
function bnstScrPlan(spd, first, frames) {
  var s = spd > 0 ? spd : 1, B = BNST_SCR_BASE, F = 0, fr = [], at, i, ext, total, k, fast = s >= 3, t;
  (frames || []).forEach(function (f) { F += f.ms > 0 ? f.ms : 0; });
  ext = Math.max(0, Math.round(F - (B.out - B.fig)));
  total = B.end + ext;
  if (fast && !first) return { play: false, fast: true, k: 0, total: 0, real: 0, pause1x: 0, ext: 0, t: null, fr: [] };
  k = (fast ? BNST_SCR_FAST_MS / total : 1 / s) * (typeof BNST !== 'undefined' && BNST.scrSlow > 0 ? BNST.scrSlow : 1);   // scrSlow:截圖 / 除錯用慢速倍率(預設 1)
  at = B.fig;
  for (i = 0; i < (frames || []).length; i++) { fr.push({ at: at, ms: frames[i].ms, sw: frames[i].sw }); at += frames[i].ms; }
  t = { pan: B.pan, panIn: B.panIn, fig: B.fig, figIn: B.figIn, ttl: B.ttl, ttlIn: B.ttlIn, nm: B.nm, nmIn: B.nmIn, shake: fast ? -1 : B.shake, shakeD: B.shakeD, out: B.out + ext, outD: B.outD, l0out: B.l0out + ext, l0outD: B.l0outD, end: total };
  return { play: true, fast: fast, k: k, total: total, real: Math.round(total * k), pause1x: Math.round(total * k * s), ext: ext, t: t, fr: fr };
}
// 戰法名字級:n ≤ 5 → 64;更長 min(64, 340 / n)
function bnstScrTitlePx(n) { return Math.max(24, Math.min(64, Math.floor(340 / Math.max(1, n)))); }
// 筆刷橫幅的鋸齒 clip-path(固定種子,每次同形):上下邊各 18 點、左右各 6 點,邊緣吃進 8~14%(高)/ 0~3%(寬)
function bnstScrClip(seed) {
  var s = (seed | 0) || 7, i, a = [], b = [], l = [], r = [];
  function rnd() { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return (s >>> 8) / 16777216; }
  function f(v) { return String(Math.round(v * 10) / 10); }
  for (i = 0; i < 18; i++) { a.push(f(i * 100 / 17) + '% ' + f(1 + rnd() * 11) + '%'); b.push(f(100 - i * 100 / 17) + '% ' + f(99 - rnd() * 12) + '%'); }
  for (i = 1; i < 6; i++) { r.push(f(100 - rnd() * 3) + '% ' + f(12 + i * 15) + '%'); l.push(f(rnd() * 3) + '% ' + f(88 - i * 15) + '%'); }
  return 'polygon(' + a.concat(r, b, l).join(',') + ')';
}
var BNST_SCR_CLIP = bnstScrClip(7);
var BNST_SCR_INK = [[2, 30, 22, 0], [5, 56, 14, 1], [0, 74, 28, 2], [9, 88, 10, 3], [14, 12, 8, 1], [93, 24, 24, 2], [97, 52, 12, 0], [90, 70, 30, 3], [95, 90, 10, 1], [84, 96, 16, 2], [50, 98, 12, 3], [30, 4, 10, 0]];   // [left%, top%, 直徑 px, 形狀]
var BNST_SCR_RAD = ['46% 54% 38% 62%/58% 42% 58% 42%', '60% 40% 55% 45%/40% 60% 40% 60%', '38% 62% 60% 40%/52% 38% 62% 48%', '50% 50% 42% 58%/62% 50% 50% 38%'];
// 演出幕 DOM(開戰建一次,之後只切 class):L0 雙層快照 canvas、L1 面板 + 墨點、L3 立繪窗(最多 3 張疊放)、名牌、L4 戰法名
function bnstScrHtml() {
  var ink = BNST_SCR_INK.map(function (d) { return '<i style="left:' + d[0] + '%;top:' + d[1] + '%;width:' + d[2] + 'px;height:' + d[2] + 'px;border-radius:' + BNST_SCR_RAD[d[3]] + '"></i>'; }).join('');
  return '<div class="bst-scr" aria-hidden="true"><div class="scr-l0"><canvas class="a" width="106" height="49"></canvas><canvas class="b" width="40" height="18"></canvas><div class="scr-l0c"></div></div>' +
    '<div class="scr-ink">' + ink + '</div>' +
    '<div class="scr-pan" style="clip-path:' + BNST_SCR_CLIP + '"><div class="scr-art"></div><div class="scr-edge"></div></div>' +
    '<div class="scr-fig"><div class="stk">' + new Array(BNST_SCR_SLOTS + 1).join('<img alt="">') + '<div class="scr-sheet"></div></div><div class="scr-fl"></div></div>' +
    '<div class="scr-nm"><b></b></div>' +
    '<div class="scr-ttl"><i class="br"></i><span class="t" data-t=""></span></div></div>';
}
function bnstScrEl() { return bnstQ('.bst-scr'); }
function bnstScrQL() { if (BNST.ql) return BNST.ql; try { return typeof qualityLevel === 'function' ? qualityLevel() : 'high'; } catch (e) { return 'high'; } }
// BG1 縮圖快取(212×98):每場第一次演出時建一次;場景圖載入前 / 失敗回 null(L0 退成純暗底)
function bnstScrBg() {
  var im = BNST.bgImg, cv, g, iw, ih, s;
  if (BNST.bgCache) return BNST.bgCache;
  if (!im || !(im.naturalWidth > 0) || typeof document === 'undefined' || !document.createElement) return null;
  try {
    cv = document.createElement('canvas'); cv.width = 212; cv.height = 98; g = cv.getContext('2d');
    iw = im.naturalWidth; ih = im.naturalHeight; s = Math.max(868 / iw, 414 / ih);   // 與 .bst-scene 同:left/top -12、868×414、cover
    g.drawImage(im, ((868 - iw * s) / 2 - 12) * 0.2512, ((414 - ih * s) / 2 - 12) * 0.2512, iw * s * 0.2512, ih * s * 0.2512);
    BNST.bgCache = cv;
  } catch (e) { BNST.bgCache = null; }
  return BNST.bgCache;
}
// 快照:L0a(106×49)= BG 縮圖 + 活著單位目前的圖(取畫面實際矩形,含假 3D 與衝刺位移);L0b(40×18)= L0a 再縮。成功回 true;任何例外回 false(退成靜態暗底)
function bnstScrSnap(el, ql) {
  var a = el.querySelector('canvas.a'), b = el.querySelector('canvas.b'), t0 = typeof performance !== 'undefined' && performance.now ? performance.now() : 0, g, bg, wr, k, list = [], id, R, im, r, flip, i, f = 106 / 844;
  if (!a || typeof a.getContext !== 'function' || !BNST.w || typeof BNST.w.getBoundingClientRect !== 'function') return false;
  try {
    g = a.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, 106, 49);
    bg = bnstScrBg();
    if (bg) g.drawImage(bg, 0, 0, 106, 49); else { g.fillStyle = '#1a0f12'; g.fillRect(0, 0, 106, 49); }
    wr = BNST.w.getBoundingClientRect(); k = wr.width > 0 ? wr.width / 844 : 1;
    for (id in BNST.U) { R = BNST.U[id]; if (!R.dead) list.push(R); }
    list.sort(function (p, q) { return p.y - q.y; });
    for (i = 0; i < list.length; i++) {
      R = list[i];
      im = R.el.classList.contains('anim-on') ? R.anim : R.body;
      if (!im || !im.complete || !(im.naturalWidth > 0)) continue;
      r = im.getBoundingClientRect();
      flip = im === R.anim ? (!R.isMine) !== R.el.classList.contains('ult-back') : !R.isMine;
      g.save();
      if (flip) { g.translate(((r.left - wr.left) / k + r.width / k) * f, 0); g.scale(-1, 1); g.drawImage(im, 0, (r.top - wr.top) / k * f, r.width / k * f, r.height / k * f); }
      else g.drawImage(im, (r.left - wr.left) / k * f, (r.top - wr.top) / k * f, r.width / k * f, r.height / k * f);
      g.restore();
    }
    if (ql === 'high' && b && typeof b.getContext === 'function') { g = b.getContext('2d'); g.clearRect(0, 0, 40, 18); g.drawImage(a, 0, 0, 40, 18); }
    BNST.scrStat = { snapMs: (typeof performance !== 'undefined' && performance.now ? performance.now() : 0) - t0, units: list.length };
    return true;
  } catch (e) { return false; }
}
function bnstScrAt(plan, ms, fn) {
  var tk = BNST.tok, e = bnstTimer(function () { if (tk === BNST.tok) fn(); }, Math.max(0, ms) * plan.k);
  (BNST.scrT = BNST.scrT || []).push(e);
}
// 立繪格載入:依候選路徑逐一退化(onerror → 下一個),全失敗 → 該格隱藏
function bnstScrLoad(im, cands) {
  var i = 0, key = cands.join('|');
  if (!im) return;
  if (im.getAttribute && im.getAttribute('data-c') === key) { im.style.display = im.getAttribute('data-bad') === '1' ? 'none' : ''; return; }
  if (im.setAttribute) { im.setAttribute('data-c', key); im.setAttribute('data-bad', '0'); }
  im.style.display = '';
  im.onerror = function () { i++; if (i < cands.length) im.src = cands[i]; else { im.style.display = 'none'; if (im.setAttribute) im.setAttribute('data-bad', '1'); } };
  if (cands.length) im.src = cands[0]; else im.style.display = 'none';
}
// 圖集格:div 背景圖 + 位置(格顯示 432×384;窗 360 寬,左右各裁 36)
function bnstScrSheetSet(sh, cell) {
  var W = 432, H = 384;
  if (!sh || !cell) return;
  if (sh.getAttribute && sh.getAttribute('data-s') !== cell.src) { if (sh.setAttribute) sh.setAttribute('data-s', cell.src); sh.style.backgroundImage = 'url(' + cell.src + ')'; sh.style.backgroundSize = (cell.cols * W) + 'px ' + (cell.rows * H) + 'px'; }
  sh.style.backgroundPosition = (-cell.col * W) + 'px ' + (-cell.row * H) + 'px';
}
// 顯示第 i 格立繪:一般格依 sw 切入(前面的格在淡入 / 滑入完成後移除,立繪有透明邊不能疊著);翻頁格(sw flip)硬切:只留這一格,不補間,套用抖動(--jx / --jy / --jr)
function bnstScrFrameOn(el, plan, frames, i) {
  var ims = el.querySelectorAll('.scr-fig img'), sheet = el.querySelector('.scr-sheet'), f = frames[i], cur = f.cell ? sheet : ims[f.k], j, sw = i === 0 && !f.cell && f.sw !== 'flip' ? 'cut' : f.sw, jt = f.j || { dx: 0, dy: 0, rot: 0 };
  if (!cur) return;
  if (sw === 'flip') {
    for (j = 0; j < ims.length; j++) if (ims[j] !== cur) ims[j].classList.remove('on');
    if (sheet && sheet !== cur) sheet.classList.remove('on');
    if (f.cell) bnstScrSheetSet(sheet, f.cell);
    cur.style.setProperty('--jx', jt.dx + 'px'); cur.style.setProperty('--jy', jt.dy + 'px'); cur.style.setProperty('--jr', jt.rot + 'deg');
    cur.classList.add('on');
    return;
  }
  BNST_SCR_SW.forEach(function (c) { cur.classList.remove('sw-' + c); });
  cur.classList.add('sw-' + sw); void cur.offsetWidth; cur.classList.add('on');
  if (sw === 'flash') bnstRestart(el.querySelector('.scr-fl'), 'go');
  for (j = 0; j < ims.length; j++) if (ims[j] !== cur) (function (p) { if (!p.classList.contains('on')) return; if (sw === 'cut' || sw === 'flash') p.classList.remove('on'); else bnstScrAt(plan, plan.fr[i].at + 130, function () { p.classList.remove('on'); }); })(ims[j]);
}
// 清除演出幕:取消計時器、移除全部狀態 class(圖片 src 保留供下次重用);被 bnstMount / bnstSetState / bncbStop 呼叫,中斷(跳過 / 離開 / 重播)後不殘留
function bnstScrClear() {
  var el = BNST.root && BNST.root.querySelector ? BNST.root.querySelector('.bst-scr') : null, i, ims;
  (BNST.scrT || []).forEach(function (e) { bnstCancel(e); });
  BNST.scrT = [];
  if (!el) return;
  el.className = 'bst-scr';
  ims = el.querySelectorAll ? el.querySelectorAll('.scr-fig img, .scr-sheet') : [];
  for (i = 0; i < ims.length; i++) ims[i].classList.remove('on');
}
// 播演出幕:S = 出手單位 rec,u = 單位資料,id = 戰法 id,plan = bnstScrPlan 結果(play 為 true)。取代舊的 暗場 / cut-in / 大字戰法名
function bnstScrShow(S, u, id, name, plan) {
  var el = bnstScrEl(), B = plan.t, ql = bnstScrQL(), sk = (typeof BN_SKILLS !== 'undefined' && BN_SKILLS && id && BN_SKILLS[id]) || {}, key, col, art, ttl, nm, ims, sheet, frames, i, ok, tt = String(name || ''), slots = {}, flip, noj = BNST.noJitter || ql === 'low';
  if (!el || !plan.play) return false;
  bnstScrClear();
  key = bnstScrKey(sk.theme || sk.th || '', sk.kind || '', u && u.dt === 'strat' ? 'strat' : sk.dmg, u ? u.troop : '', sk.tags);
  col = BNST_SCR_COLOR[key] || BNST_SCR_COLOR.slash;
  frames = bnstScrFrames(u ? u.fig : '');
  flip = frames[0].sw === 'flip';
  if (noj) frames.forEach(function (f) { f.j = null; });
  ok = ql === 'low' ? false : bnstScrSnap(el, ql);
  el.className = 'bst-scr ql-' + ql + (S.isMine ? '' : ' foe') + (plan.fast ? ' fast' : '') + (ok ? '' : ' nosnap') + (flip ? ' flip' : '');
  el.style.setProperty('--k', String(plan.k));
  el.style.setProperty('--pn', String(B.out - B.pan));
  el.style.setProperty('--dn', String(B.out - B.fig));
  if (el.setAttribute) el.setAttribute('data-key', key);
  art = el.querySelector('.scr-art');
  if (art) {
    art.style.background = 'linear-gradient(100deg,#1a1012 0%,' + col + ' 55%,#1a1012 100%)';
    if (BNST_SCR_ART[key]) { art.style.backgroundImage = 'url(' + BNST_SCR_ART[key] + ')'; art.style.backgroundSize = 'cover'; art.style.backgroundPosition = '50% 50%'; }
  }
  ttl = el.querySelector('.scr-ttl .t');
  if (ttl) { ttl.textContent = tt; if (ttl.setAttribute) ttl.setAttribute('data-t', tt); ttl.style.fontSize = bnstScrTitlePx(Array.from(tt).length) + 'px'; }
  nm = el.querySelector('.scr-nm b'); if (nm) nm.textContent = u ? String(u.name || '') : '';
  ims = el.querySelectorAll('.scr-fig img'); sheet = el.querySelector('.scr-sheet');
  frames.forEach(function (f) { if (!f.cell) slots[f.k] = f.c; });
  for (i = 0; i < ims.length; i++) { if (slots[i]) bnstScrLoad(ims[i], slots[i]); else ims[i].style.display = 'none'; ims[i].style.zIndex = String(i + 1); }
  if (sheet) { sheet.style.display = frames[0].cell ? '' : 'none'; if (frames[0].cell) bnstScrSheetSet(sheet, frames[0].cell); }
  void el.offsetWidth; el.classList.add('on');
  bnstScrAt(plan, 0, function () { el.classList.add('s-l0'); });
  bnstScrAt(plan, B.pan, function () { el.classList.add('s-pan'); });
  bnstScrAt(plan, B.fig, function () { el.classList.add('s-fig'); bnstScrFrameOn(el, plan, frames, 0); });
  for (i = 1; i < frames.length; i++) (function (k) { bnstScrAt(plan, plan.fr[k].at, function () { bnstScrFrameOn(el, plan, frames, k); }); })(i);
  bnstScrAt(plan, B.ttl, function () { el.classList.add('s-ttl'); });
  bnstScrAt(plan, B.nm, function () { el.classList.add('s-nm'); });
  if (B.shake >= 0) bnstScrAt(plan, B.shake, function () { bnstRestart(el, 's-shake'); });
  bnstScrAt(plan, B.out, function () { el.classList.add('s-out'); });
  bnstScrAt(plan, B.l0out, function () { el.classList.add('s-end'); });
  bnstScrAt(plan, B.end, function () { el.classList.remove('on'); });
  return true;
}

// 本場需要預載的圖檔清單(角色圖、兵種後備、畫格、共用特效)
function bnstPreloadList(plan) {
  var out = [], seen = {};
  function add(s) { if (s && !seen[s]) { seen[s] = 1; out.push(s); } }
  (plan.mine || []).concat(plan.enemy || []).forEach(function (u) {
    add(bnstFigSrc(u)); add(bnstTroopSrc(u.troop, u.dt));
    if (u.fig) bnstScrFrames(u.fig).forEach(function (f) { f.c.forEach(function (s, i) { if (i === 0 || f.c.length === 1) add(s); }); });   // 演出幕立繪(每格取第一候選,避免對不存在的檔打 404)
    var an = bnstAnimOf(u.fig);
    if (an) { bnstFrames(an.atk, an.atkN).forEach(add); bnstUltFrames(an).forEach(add); }
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
  return '<div class="bst-world"><div class="bst-cam">' +
    '<div class="bst-scene"></div><div class="bst-tone"></div><div class="bst-glow"></div><div class="bst-smoke"></div><div class="bst-band"></div><div class="bst-backdrop"></div><div class="bst-floor"></div>' +
    '<i class="bst-prop pa"></i><i class="bst-prop pb"></i><i class="bst-prop pc l"></i><i class="bst-prop pc r"></i><div class="bst-ember e1"></div><div class="bst-ember e2"></div>' +
    '<div class="bst-spot"></div><div class="bst-units"></div></div>' +
    '<div class="bst-dim"></div><div class="bst-show"><img alt=""></div>' + bnstScrHtml() +
    '<div class="bst-ultname"></div><div class="bst-ultline"></div>' +
    '<div class="bst-valance"></div><div class="bst-curtain l"></div><div class="bst-curtain r"></div>' +
    '<div class="bst-round ld-plaque">開鑼</div>' +
    '<div class="bst-banner"><b class="ld-outline"></b><div></div></div>' +
    '<div class="bst-endbtns"><button type="button" class="ld-btn" data-act="replay">重播</button><button type="button" class="ld-btn" data-act="report">看戰報</button></div>' +
    '</div>';
}

// 場景背景:預設 CSS 暗底;rec.opts.scene('field'|'city'|'camp'|'arena',預設 field)→ assets/ui/bnbg_<scene>.webp,載入成功才換上,找不到維持預設
var BNST_SCENES = ['field', 'city', 'camp', 'arena'];
var BNST_IRON_KINDS = ['tourney', 'duel', 'practice'];
function bnstSceneName(scene) { return BNST_SCENES.indexOf(scene) >= 0 ? scene : 'field'; }
function bnstScenePath(scene) { return 'assets/ui/bnbg_' + bnstSceneName(scene) + '.webp'; }
function bnstScene(root, plan) {
  var el = root && root.querySelector ? root.querySelector('.bst-scene') : null, src, im, wd = root && root.querySelector ? root.querySelector('.bst-world') : null;
  if (wd && wd.classList) wd.classList.toggle('tone-iron', BNST_IRON_KINDS.indexOf(plan && plan.kind) >= 0);   // 擂台 / 切磋 / 訓練場:冷鐵色調、關餘燼
  if (!el || typeof Image === 'undefined') return;
  src = bnstScenePath(plan && plan.scene);
  im = new Image();
  im.onload = function () { el.style.backgroundImage = 'url(' + src + ')'; BNST.bgImg = im; BNST.bgCache = null; bnstScrBg(); };   // 載入後立刻建 BG 縮圖快取(一次性),演出觸發時只剩單位繪製
  im.src = src;
}
// 掛載:建單位 DOM(依 plan.mine / plan.enemy),記下 root 與速度函式
function bnstMount(root, plan, spdFn) {
  var box, mine = plan.mine || [], foe = plan.enemy || [];
  BNST.tok++;
  BNST_TQ.forEach(function (e) { if (e.h) clearTimeout(e.h); }); BNST_TQ.length = 0; BNST.paused = false;
  BNST.root = root; BNST.w = root.querySelector('.bst-world'); BNST.cam = root.querySelector('.bst-cam'); BNST.plan = plan; BNST.U = {}; BNST.skFx = {}; BNST.scrSeen = {}; BNST.scrT = []; BNST.bgImg = null; BNST.bgCache = null;
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
  el.className = 'bst-u ' + (isMine ? 'mine' : 'foe') + (u.boss ? ' boss' : '') + (bnstIsStrat(u) ? ' strat' : '');
  el.style.setProperty('--qc', bnstQcColor(qc));
  el.setAttribute('data-id', String(u.id));
  el.innerHTML = '<div class="bst-act">' +
    '<div class="bst-shd"></div>' +
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
    if (body.getAttribute('data-fb') !== '1') { body.setAttribute('data-fb', '1'); body.src = bnstTroopSrc(u.troop, u.dt); }
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
  rec.row = row | 0; rec.x = P.x; rec.y = P.y; rec.zb = P.z; rec.sc = P.sc;
  rec.el.style.transition = ms > 0 ? 'opacity .25s,left ' + ms + 'ms ease-in-out,top ' + ms + 'ms ease-in-out' : 'opacity .25s';
  rec.el.style.left = P.x + 'px'; rec.el.style.top = P.y + 'px';
  rec.el.style.setProperty('--sc', String(P.sc));
  rec.bh = bnstBodyH(rec.u && rec.u.fig) * P.sc; rec.el.style.setProperty('--bh', rec.bh + 'px');
  if (an) { rec.anim.style.bottom = bnstFootBottom(an, P.sc) + 'px'; rec.anim.style.height = (BNST_ANIM_H * (an.k > 0 ? an.k : 1) * P.sc) + 'px'; }
  bnstZUpd(rec);
}
// 命中者暫時提到 16(閃白看得到)
function bnstHitZ(rec) { rec.hitN++; bnstZUpd(rec); bnstLater(300, function () { rec.hitN = Math.max(0, rec.hitN - 1); bnstZUpd(rec); }); }
// 致命一下:停 200 ms 後倒下(z 降到 9);期間若兵力又回來(復活)就不倒
function bnstDie(rec) {
  bnstLater(200, function () { if (rec.hp > 0) return; rec.dead = true; rec.el.classList.add('dead'); bnstZUpd(rec); });
}
// 每位單位的 act 位移(dx,dy 為舞台像素),依速度換算時長
// s = 縮放(衝刺到目標那排的縱深:目標 sc / 自己 sc;原點 = 腳底,CSS .bst-act transform-origin 0 0)
function bnstMove(rec, dx, dy, ms, s) {
  rec.act.style.transitionDuration = bnstDur(ms) + 'ms';
  rec.act.style.transform = 'translate(' + dx + 'px,' + (dy || 0) + 'px)' + (s > 0 && s !== 1 ? ' scale(' + s + ')' : '');
}
// 衝刺縱深:dy = 目標腳底 y − 自己腳底 y + 4(停在目標前面一點),scale = 目標 sc / 自己 sc
function bnstDashDy(S, T) { return (T.y - S.y) + 4; }
function bnstDashSc(S, T) { return (T.sc > 0 ? T.sc : 1) / (S.sc > 0 ? S.sc : 1); }
function bnstCam() { return BNST.cam || BNST.w; }
function bnstSpot(x, on, y) {
  var s = bnstQ('.bst-spot');
  if (!s) return;
  if (on) { s.style.left = x + 'px'; if (y > 0) s.style.height = (y + 18) + 'px'; s.classList.add('on'); } else s.classList.remove('on');
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
  if (!BNST.simple && fxFile) bnstFx(T.x, T.y - T.bh * 0.5, fxFile, 110 * (T.sc > 0 ? T.sc : 1));
  if (x && x.nv > 0) bnstNum(T, x.nv, x.crit ? 'crit' : '');
  if (x && x.big) bnstQuake();
}
function bnstNum(T, v, cls) {
  var n = document.createElement('div');
  n.className = 'bst-num ld-outline ' + (cls || '');
  n.textContent = '-' + v;
  n.style.left = (T.x + (Math.random() * 30 - 15)) + 'px'; n.style.top = (T.y - T.bh - 10) + 'px';
  bnstCam().appendChild(n);
  bnstTimer(function () { if (n.parentNode) n.parentNode.removeChild(n); }, bnstDur(950) + 50);
}
function bnstHealNum(tgtId, v) {
  var T = BNST.U[tgtId], n;
  if (!T || !BNST.w) return;
  n = document.createElement('div');
  n.className = 'bst-num ld-outline heal';
  n.textContent = '+' + v;
  n.style.left = T.x + 'px'; n.style.top = (T.y - T.bh - 10) + 'px';
  bnstCam().appendChild(n);
  bnstTimer(function () { if (n.parentNode) n.parentNode.removeChild(n); }, bnstDur(950) + 50);
}
function bnstFx(x, y, file, size) {
  var i;
  if (!BNST.w || !file) return;
  if (typeof qualityShareFx === 'function' && !qualityShareFx()) return;   // 畫質低:不播共用特效
  if (typeof qualityFxCap === 'function' && BNST.w.querySelectorAll('.bst-fx').length >= qualityFxCap()) return;   // 依畫質限制同時特效數(不影響戰鬥結果)
  i = document.createElement('img');
  i.className = 'bst-fx';
  i.alt = '';
  i.src = 'assets/bnfx/' + file + '.webp';
  i.style.left = x + 'px'; i.style.top = y + 'px'; i.style.width = (size || 110) + 'px';
  i.style.animationDuration = bnstDur(450) + 'ms';
  bnstCam().appendChild(i);
  bnstTimer(function () { if (i.parentNode) i.parentNode.removeChild(i); }, bnstDur(500) + 50);
}
function bnstQuake() { bnstRestart(bnstCam(), 'bst-quake'); }   // 震動掛在鏡頭層:cut-in 與大字(鏡頭層外)不震
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
  var dir = S.isMine ? 1 : -1, id, B, bl = [], stop, sS = S.sc > 0 ? S.sc : 1, sT = T.sc > 0 ? T.sc : 1;   // 身寬與武器長度依各自縮放(主將不放大)
  for (id in BNST.U) {
    B = BNST.U[id];
    if (B !== S && B !== T && B.isMine === T.isMine && !B.dead && Math.abs(B.y - T.y) <= 15) bl.push({ x: B.x, w: bnstBodyW(B.u, bnstAnimOf(B.u && B.u.fig)) * (B.sc > 0 ? B.sc : 1) });
  }
  stop = bnstDashStop(S.x, T.x, dir, bnstBodyW(S.u, bnstAnimOf(S.u && S.u.fig)) * sS, bnstBodyW(T.u, bnstAnimOf(T.u && T.u.fig)) * sT, bnstReach(S.u, bnstAnimOf(S.u && S.u.fig)) * sS, bl);
  return stop - S.x;
}
// 普攻:有畫格(bnstAnimOf)→ 衝刺 + 逐格 + 第 atkHit 格命中 + 跑回;否則彈跳衝撞;弓 / 械 / 謀略型(dt strat)原地前傾 + 特效飛到目標。回傳命中時刻(ms)
function bnstBasic(src, tgt, x) {
  var S = BNST.U[src.id], T = BNST.U[tgt.id], an, dx, dy, ds, hitMs, i, sh = BNST.simple;
  if (!T) return 0;
  if (!S) { bnstApplyHit(tgt.id, x, BNST_FX_BASIC); return 0; }
  an = bnstAnimOf(src.fig);
  dx = bnstDashDx(S, T); dy = bnstDashDy(S, T); ds = bnstDashSc(S, T);
  function actOn() { S.actN++; bnstZUpd(S); }
  function actOff() { S.actN = Math.max(0, S.actN - 1); bnstZUpd(S); }
  if (an && an.atk) {
    actOn();
    if (!sh) bnstSpot(S.x, true, S.y);
    S.el.classList.add('anim-on');
    S.anim.src = 'assets/fullbody/anim/' + an.atk + '1.webp';
    bnstMove(S, dx, dy, 260, ds);
    for (i = 2; i <= an.atkN; i++) {
      (function (k) { bnstLater(260 + (k - 1) * 65, function () { S.anim.src = 'assets/fullbody/anim/' + an.atk + k + '.webp'; if (k === an.atkHit) bnstApplyHit(tgt.id, x, BNST_FX_BASIC); }); })(i);
    }
    hitMs = 260 + (an.atkHit - 1) * 65;
    bnstLater(260 + (an.atkN - 1) * 65 + 65, function () { S.el.classList.remove('anim-on'); S.el.classList.add('back'); bnstMove(S, 0, 0, 220); });
    bnstLater(260 + (an.atkN - 1) * 65 + 65 + 220, function () { S.el.classList.remove('back'); bnstSpot(S.x, false); actOff(); });
    return hitMs;
  }
  if (bnstIsRanged(src)) {
    bnstMove(S, (S.isMine ? 14 : -14), 0, 150);
    bnstLater(0, function () { bnstFx(S.x, S.y - S.bh * 0.5, bnstIsStrat(src) ? BNST_FX_STRAT : BNST_FX_BASIC, 90 * (S.sc > 0 ? S.sc : 1)); });
    bnstLater(300, function () { bnstApplyHit(tgt.id, x, bnstIsStrat(src) ? BNST_FX_STRAT : BNST_FX_BASIC); });
    bnstLater(380, function () { bnstMove(S, 0, 0, 180); });
    return 300;
  }
  if (!sh) bnstSpot(S.x, true, S.y);
  actOn();
  bnstMove(S, dx * 0.15, dy * 0.15 - 14, 120);
  bnstLater(120, function () { bnstMove(S, dx, dy, 160, ds); });
  bnstLater(280, function () { bnstApplyHit(tgt.id, x, BNST_FX_BASIC); });
  bnstLater(280 + 40, function () { bnstMove(S, 0, 0, 220); });
  bnstLater(280 + 260, function () { bnstSpot(S.x, false); actOff(); });
  return 280;
}
// 有畫格的大招:暗場 → 中央播 ult 格 → 大字名 → 命中格回傳(播放器等到這裡,之後的命中項目即時顯示)
// 名人逐格大招:衝向敵人 → 接觸格凍結、暗場、立繪 cut-in + 大字戰法名 → 繼續播後段畫格(ultHit 回傳給播放器顯示命中)→ 畫格翻面跑回原位
function bnstAnimSize(S, an, k) { var h = BNST_ANIM_H * k * (S.sc > 0 ? S.sc : 1); S.anim.style.height = h + 'px'; S.anim.style.bottom = bnstFootBottom({ foot: an.foot, k: k }, S.sc) + 'px'; }
function bnstUltCut(S, u, an, name, id) {
  var fr = bnstUltFrames(an), dur = an.dur || [], d = function (i) { return dur[i] > 0 ? dur[i] : 100; }, cut = an.cutAt, hit = an.ultHit, st = [], t = 0, i, bid, B, T = null, best = 1e9, dx = 0, dy = 0, ds = 1, cam = bnstCam(),
    sp = BNST.spd() || 1, scr = bnstScrPlan(sp, !BNST.scrSeen[u.id], bnstScrFrames(u.fig)), pause = scr.play ? scr.pause1x : 0, ku = an.ku > 0 ? an.ku : 1.3, bk = an.back > 0 ? an.back : cut - 1,
    tc, tend;
  if (scr.play) BNST.scrSeen[u.id] = 1;
  for (i = 0; i < fr.length; i++) { st.push(t + (i >= cut ? pause : 0)); t += d(i); }
  for (bid in BNST.U) { B = BNST.U[bid]; if (B.isMine !== S.isMine && !B.dead && Math.abs(B.x - S.x) < best) { best = Math.abs(B.x - S.x); T = B; } }
  if (T) { dx = bnstDashDx(S, T); dy = bnstDashDy(S, T); ds = bnstDashSc(S, T); }
  tc = st[cut - 1]; tend = st[fr.length - 1] + d(fr.length - 1);
  S.actN++; bnstZUpd(S);
  if (!BNST.simple) bnstSpot(S.x, true, S.y);
  S.el.classList.add('anim-on'); bnstAnimSize(S, an, ku); S.anim.src = fr[0];
  bnstMove(S, dx, dy, tc, ds);
  fr.forEach(function (src, k) {
    if (k === 0) return;
    bnstLater(st[k], function () { S.anim.src = src; if (k === hit - 1) bnstQuake(); });
  });
  bnstLater(tc, function () {
    if (!scr.play) return;   // 3× 非首次:不凍結、不出演出幕,畫格直接接下去
    bnstScrShow(S, u, id, name, scr);   // 先拍 L0 快照(此刻單位在接觸格位置)再推鏡頭;演出幕在鏡頭層外,不受推近影響
    if (cam) { cam.style.transformOrigin = (S.x + dx) + 'px ' + (S.y + dy - 60) + 'px'; cam.classList.add('zoom'); }   // 鏡頭推近 1.15×
  });
  bnstLater(tc + pause, function () { if (cam) cam.classList.remove('zoom'); });
  bnstLater(tend, function () { S.el.classList.add('ult-back', 'back'); S.anim.src = fr[bk - 1]; S.act.style.transitionTimingFunction = 'ease-out'; bnstMove(S, 0, 0, 420); });
  bnstLater(tend + 420 + 40, function () {
    S.el.classList.remove('anim-on', 'ult-back', 'back'); S.act.style.transitionTimingFunction = ''; bnstAnimSize(S, an, an.k > 0 ? an.k : 1);
    bnstSpot(S.x, false); S.actN = Math.max(0, S.actN - 1); bnstZUpd(S);
  });
  return st[hit - 1];
}
function bnstUlt(u, id, frames) {
  var S = BNST.U[u.id], an, name, t0 = 450, impact, fr, scr, pause = 0;
  if (!S) return 0;
  if (S.prep && S.prepId === id) bnstPrepClear(S);
  name = typeof bnLogSkName === 'function' ? bnLogSkName(id) : String(id);
  BNST.skFx[u.id] = BNST_FX_RING;
  if (frames) {
    an = bnstAnimOf(u.fig);
    if (an.cutAt > 0) return bnstUltCut(S, u, an, name, id);
    fr = bnstUltFrames(an);
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
  // 無畫格:有 fig 先播完整版演出幕(3× 非首次略過),再接 原地放大 1.3 倍 + 身後品質色光 + 戰法名牌 + 共用特效;沒 fig(一般兵)維持原樣
  scr = u.fig ? bnstScrPlan(BNST.spd() || 1, !BNST.scrSeen[u.id], bnstScrFrames(u.fig)) : null;
  if (scr && scr.play && bnstScrShow(S, u, id, name, scr)) { BNST.scrSeen[u.id] = 1; pause = scr.pause1x; }
  function big() {
    S.el.classList.add('ult-big');
    bnstSkillPlate(S, name);
    if (!BNST.simple) bnstFx(S.x, 150, BNST_FX_RING, 140);
    bnstLater(500, function () { S.el.classList.remove('ult-big'); });
  }
  if (pause > 0) bnstLater(pause, big); else big();
  return pause + 500;
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
  bnstScrClear();
  for (id in BNST.U) { BNST.U[id].el.style.opacity = '1'; BNST.U[id].act.style.transitionDuration = '0ms'; BNST.U[id].act.style.transform = 'translateX(0)'; }
  if (BNST.w) BNST.w.classList.add('open');
}
// 狀態同步:兵力條、潰滅
// rows(可省略)= {id: 排號}:還原換位後的站位(瞬間)
function bnstSetState(hp, dead, rows) {
  var id, cam = bnstCam();
  bnstScrClear();   // 跳轉 / 重播:演出幕與鏡頭推近不殘留
  if (cam && cam.classList) cam.classList.remove('zoom');
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
    if (S && !BNST.simple) bnstSpot(S.x, true, S.y);
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
    p.style.left = S.x + 'px'; p.style.top = (S.y - S.bh * 0.6) + 'px';
    bnstCam().appendChild(p);
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

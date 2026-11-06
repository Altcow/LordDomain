// js/fx_cards.js — 魔幻世界的名人卡(PLAN_FANTASY_B B-3):42 位傳說英雄接進卡池 / 名冊 / 戰鬥。資料在 fx_cards_data.js(tools/gen_fx_cards.js 產生)。
// 隔離:fxPack() 為 null(東漢與歷史風格世界)時,所有查詢回 null,cards.js / npcvisit.js 照舊只用 CARD_FIGS;魔幻世界只抽 FX_FIGS(本族 ×1、他族 ×0.3「遠客」)。
// 陣營:9 個魔幻陣營接在 CARD_FAC 後面(全域序號 5~13),卡上的 fac 直接是這個序號,CARD_FAC[c.fac] / bntFacName 照常可用。
// 英雄也登錄進 CARD_FIG_BY_ID(查名字 / 存檔驗證 / 戰鬥 vs 名稱用),但不進 CARD_FIGS(歷史世界的卡池、在野名人只看 CARD_FIGS)。
// 載入順序:carddata.js、cards.js、famous_lines.js 之後(index.html)。ES2017;不用 ?. ??。不發聲。
// 全域:FX_FIG_BY_ID FX_FAC_RACE FX_OTHER_RACE_W fxFigIs fxFigSrc fxFigRaceMul fxFacList fxFacGen fxFigImg fxFacColInstall
var FX_FIG_BY_ID = {};
var FX_FAC_RACE = {};          // 全域 fac 序號 → 族(elf / dwarf / kingdom);族 id 與 fxPack() 的世界 id 相同
var FX_OTHER_RACE_W = 0.3;     // 他族英雄(遠客)抽取權重倍率(PLAN_FANTASY_B Q11)

(function () {
  if (typeof FX_FIGS === 'undefined' || typeof FX_FAC_LIST === 'undefined') return;
  FX_FAC_LIST.forEach(function (f) {
    FX_FAC_RACE[f.fac] = f.race;
    if (typeof CARD_FAC !== 'undefined') CARD_FAC[f.fac] = f.name;
  });
  FX_FIGS.forEach(function (f) {
    var jb, ja = {}, n = 1;
    FX_FIG_BY_ID[f.id] = f;
    if (typeof CARD_FIG_BY_ID !== 'undefined') CARD_FIG_BY_ID[f.id] = f;
    if (typeof CARD_FIG_WEIGHT !== 'undefined' && typeof FX_FIG_WEIGHT !== 'undefined' && FX_FIG_WEIGHT[f.id]) CARD_FIG_WEIGHT[f.id] = FX_FIG_WEIGHT[f.id];
    // 職業:主職業依 heroes.json(job),其餘 1~2 個依五維推導(cards.js cardFigJobs 的規則),寫進覆寫表
    if (typeof CARD_FIG_JOB_OVERRIDE !== 'undefined' && !CARD_FIG_JOB_OVERRIDE[f.id]) {
      ja[f.job] = f.gr === 4 ? 4 : 3;
      if (typeof cardFigJobs === 'function') { jb = cardFigJobs(f); Object.keys(jb.ja).forEach(function (k) { if (!ja[k] && n < 3) { ja[k] = 1; n++; } }); }
      CARD_FIG_JOB_OVERRIDE[f.id] = { ja: ja, main: f.job };
    }
    if (typeof FAMOUS_LINES !== 'undefined' && f.lines && f.lines.length === 2 && !FAMOUS_LINES[f.id]) FAMOUS_LINES[f.id] = f.lines.slice();
  });
})();

function fxCardPack() { return (typeof fxPack === 'function') ? fxPack() : null; }
function fxFigIs(id) { return !!(id && FX_FIG_BY_ID[id]); }
// 目前世界的名人來源:魔幻世界 = FX_FIGS;歷史世界回 null(呼叫端用 CARD_FIGS)
function fxFigSrc() { return (fxCardPack() && typeof FX_FIGS !== 'undefined') ? FX_FIGS : null; }
// 抽取權重倍率:魔幻世界的他族英雄 ×0.3;其餘 1
function fxFigRaceMul(f) { var p = fxCardPack(); return (p && f && f.race && f.race !== p) ? FX_OTHER_RACE_W : 1; }
// 指名 / 殿試主題可選的陣營:本族 3 個在前,他族 6 個在後;歷史世界回 null(= 0~4)
function fxFacList() {
  var p = fxCardPack(), own = [], other = [];
  if (!p || typeof FX_FAC_LIST === 'undefined') return null;
  FX_FAC_LIST.forEach(function (f) { (f.race === p ? own : other).push(f.fac); });
  return own.concat(other);
}
// 路人卡的陣營:本族 3 個;歷史世界回 null
function fxFacGen() {
  var p = fxCardPack();
  if (!p || typeof FX_FAC_LIST === 'undefined') return null;
  return FX_FAC_LIST.filter(function (f) { return f.race === p; }).map(function (f) { return f.fac; });
}
// 魔幻英雄圖檔:kind 'portrait'(頭像)/ 'fullbody'(全身);非魔幻英雄回 null(呼叫端用 assets/portraits/<id>.webp)
function fxFigImg(id, kind) { return fxFigIs(id) ? 'assets/' + (kind === 'fullbody' ? 'fullbody' : 'portraits') + '/fx/' + id + '.webp' : null; }
// 戰鬥技能標籤的陣營色(bndraw.js BN_FAC_COL 依 CARD_FAC 序;補上 5~13)
function fxFacColInstall() {
  if (typeof BN_FAC_COL === 'undefined' || typeof FX_FAC_LIST === 'undefined') return false;
  FX_FAC_LIST.forEach(function (f) { if (!BN_FAC_COL[f.fac]) BN_FAC_COL[f.fac] = f.col; });
  return true;
}
if (typeof window !== 'undefined' && window && typeof window.addEventListener === 'function') window.addEventListener('DOMContentLoaded', fxFacColInstall);

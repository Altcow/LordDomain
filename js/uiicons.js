// js/uiicons.js — UI 圖示圖片(assets/ui/*.webp,128×128 透明):民情指標 12 個 + 科技分支 12 個,取代 emoji。
// 只做顯示:uiIconHtml(key,px,fb) 回傳 <img> 字串;uiIconNode(key,px,fb) 回傳 DOM 節點。載入失敗自動退回 fallback emoji(不留破圖);
// 偏好 lorddomain.uiicons('0' = 關,關閉時全部回 emoji;偏好鍵,不進世界存檔)。不發聲。ES2017;不用 ?. ??。
// 全域名稱:UI_ICON_DIR UI_ICONS UI_BRANCH_ICONS UI_ICON_NAMES uiIconsOn uiIconsSetOn uiIconFile uiIconName uiIconHtml uiIconNode uiIconFail

var UI_ICONS_KEY = 'lorddomain.uiicons';
var UI_ICON_DIR = 'assets/ui/';
var UI_ICONS = {
  food: 'food.webp', sani: 'sani.webp', mood: 'mood.webp', water: 'water.webp', store: 'store.webp', tech: 'tech.webp',
  house: 'house.webp', order: 'order.webp', road: 'road.webp', plague: 'plague.webp', fame: 'fame.webp', edu: 'edu.webp'
};
var UI_BRANCH_ICONS = {
  ag: 'br_ag.webp', wa: 'br_wa.webp', cr: 'br_cr.webp', wr: 'br_wr.webp', md: 'br_md.webp', bd: 'br_bd.webp',
  tr: 'br_tr.webp', ed: 'br_ed.webp', df: 'br_df.webp', rl: 'br_rl.webp', st: 'br_st.webp', mg: 'br_mg.webp'
};
var UI_ICON_NAMES = {
  food: '糧食', sani: '衛生', mood: '民心', water: '飲水', store: '庫房', tech: '研發', house: '住房', order: '治安', road: '道路', plague: '疫病', fame: '名望', edu: '教化',
  ag: '農業', wa: '水利', cr: '工藝冶鐵', wr: '造紙文書', md: '醫衛', bd: '建築市政', tr: '商貿運輸', ed: '教化制度', df: '守城', rl: '方術宗教', st: '營造風格', mg: '里程碑'
};
var uiIconSt = { on: null };

function uiIconsOn() {
  if (uiIconSt.on === null) {
    uiIconSt.on = true;
    try { if (typeof localStorage !== 'undefined' && localStorage.getItem(UI_ICONS_KEY) === '0') uiIconSt.on = false; } catch (e) { /* 讀不到用預設(開) */ }
  }
  return uiIconSt.on;
}
function uiIconsSetOn(v) {
  uiIconSt.on = !!v;
  try { if (typeof localStorage !== 'undefined') localStorage.setItem(UI_ICONS_KEY, uiIconSt.on ? '1' : '0'); } catch (e) { /* 存不了只影響下次記憶 */ }
}
function uiIconFile(key) { return UI_ICONS[key] || UI_BRANCH_ICONS[key] || ''; }
function uiIconName(key) { return UI_ICON_NAMES[key] || ''; }
function uiIconEsc(s) { return String(s === undefined || s === null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

// 載入失敗:換回 fallback 文字(data-fb);沒有 fallback 就移除
function uiIconFail(img) {
  var fb, p, t;
  if (!img || img.__uiFailed) return;
  img.__uiFailed = true;
  fb = img.getAttribute ? img.getAttribute('data-fb') : '';
  p = img.parentNode;
  if (!p) return;
  if (fb && typeof document !== 'undefined' && document.createElement) {
    t = document.createElement('span'); t.className = 'ui-icfb'; t.textContent = fb;
    if (p.replaceChild) { p.replaceChild(t, img); return; }
  }
  if (p.removeChild) p.removeChild(img);
}

function uiIconHtml(key, sizePx, fallbackEmoji) {
  var f = uiIconFile(key), px = Math.round(sizePx || 24), fb = fallbackEmoji || '';
  if (!f || !uiIconsOn()) return uiIconEsc(fb);
  return '<img class="ui-ic" src="' + UI_ICON_DIR + f + '" alt="' + uiIconEsc(uiIconName(key)) + '" width="' + px + '" height="' + px +
    '" loading="lazy" decoding="async" draggable="false" data-fb="' + uiIconEsc(fb) + '" style="width:' + px + 'px;height:' + px +
    'px;pointer-events:none;vertical-align:middle;flex:0 0 auto" onerror="uiIconFail(this)">';
}

// DOM 版:開啟且有圖 → <img>;否則有 fallback → <span>fallback</span>;皆無 → null
function uiIconNode(key, sizePx, fallbackEmoji) {
  var f = uiIconFile(key), px = Math.round(sizePx || 24), fb = fallbackEmoji || '', im, sp;
  if (typeof document === 'undefined' || !document || !document.createElement) return null;
  if (f && uiIconsOn()) {
    im = document.createElement('img');
    im.className = 'ui-ic'; im.src = UI_ICON_DIR + f; im.alt = uiIconName(key); im.width = px; im.height = px;
    im.draggable = false; im.setAttribute('loading', 'lazy'); im.setAttribute('decoding', 'async'); im.setAttribute('data-fb', fb);
    im.style.width = px + 'px'; im.style.height = px + 'px'; im.style.pointerEvents = 'none'; im.style.verticalAlign = 'middle'; im.style.flex = '0 0 auto';
    im.onerror = function () { uiIconFail(im); };
    return im;
  }
  if (!fb) return null;
  sp = document.createElement('span'); sp.className = 'ui-icfb'; sp.textContent = fb;
  return sp;
}

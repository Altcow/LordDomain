// js/cardsui_named.js — 指名池已刪除(2026-11-11 v59):本檔只保留頭目首通贈抽任務資料(BN_STAGES 各章第 6 關),供 cardsui_draw.js 的 cuBossHtml 使用。
// 全域名稱:cuBossList cuBossNext。不發聲、不推播。ES2017;不用 ?. ??。

// 頭目首通贈抽任務(bn_stages.js 各章第 6 關):cuBossHtml 取用
function cuBossList() { return (typeof BN_STAGES !== 'undefined') ? BN_STAGES.filter(function (st) { return st.boss; }) : []; }
function cuBossNext(cs) { var l = cuBossList(), i; for (i = 0; i < l.length; i++) if (!(cs.boss && cs.boss[l[i].id])) return l[i]; return null; }

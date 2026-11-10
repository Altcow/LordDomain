// js/cardsui_starter.js — 新手禮包的資料與點擊邏輯(引擎 js/cards_starter.js、數值 carddata.js CARD_STARTER)、保底與抽卡節奏的說明資料(cardsUiInfo kind pity / draw)。UI 組字在 cardsui_draw.js。
// 禮包可領時的說明卡與總覽入口(cuStarterPop / cuStarterBanner)、新手期與保底列(cuNbLine / cuPityLine)都在 cardsui_draw.js。掛在 cardsui.js(typeof 守衛呼叫)。不發聲、不推播。ES2017;不用 ?. ??。
// 2026-11-09 酒令與『任用』已移除:cuDrawInfo(說明浮層 kind 'draw':抽卡節奏與升級科技,由 CARD_DRAW 即時組出)。
// 全域名稱:cuStarterOpen cuStarterClick cuStarterPityInfo cuGrName cuGrPct cuPityN cuDrawInfo cuTechName cuGoTech

function cuGrName(g) { return CARD_GRADE[g] ? CARD_GRADE[g].name : ''; }
function cuGrPct(p) { return p.map(function (v, i) { return v > 0 ? cuGrName(i) + ' ' + v + ' %' : ''; }).filter(function (s) { return s; }).join('、'); }
function cuPityN(v) { return v === 'G' ? CARD_CFG.pityBatches : CARD_DRAW.pity; }   // 酒館 / 縣試池:連續幾『張』沒出上等 → 下一張保底;指名池:連續幾『次』
// 開禮包的下一批:開批 → 抽卡特效 → 入卡包(不自動熔爐)
function cuStarterOpen(cs) {
  var r = cardsStarterStage(cs);
  if (!r.ok) { cu.msg = CU_OPEN_MSG[r.reason] || '無法開批'; if (typeof showToast === 'function') showToast(cu.msg); return; }
  cuSave();
  cuRevealThen(r.cards, function () {
    cuJoinToast(cuFinishBatch('G', '新手禮包 第 ' + r.no + '/' + r.of + ' 批', true, 'O'));
    if (cu.open) cardsUiRender();
  });
}
function cuStarterClick(a, b, cs) {
  var r;
  if (a === 'stlater') { cu.stLater = true; cu.stShow = false; return true; }
  if (a === 'stshow') { cu.stShow = true; return true; }
  if (a === 'stclaim') {
    cu.stShow = false;
    r = cardsStarterClaim(cs, cuNow());
    if (!r.ok) { cu.msg = r.reason === 'na' ? '這個存檔不適用新手禮包' : '新手禮包已領過'; return true; }
    if (typeof showToast === 'function') showToast('領到新手禮包:' + r.pulls + ' 抽、指名券 +' + r.named);
    cu.tab = 'O';
    cuSave();
    return true;
  }
  if (a === 'stopen') { cu.tab = 'O'; cuStarterOpen(cs); return true; }
  if (a === 'gotech') { cuGoTech(); return true; }
  return false;
}
// ───────── 抽卡節奏說明(取代原「酒令從哪來」;名冊列 cuRosterLine / 下一批列 cuDrawHtml / 入冊提示 cuJoinToast 在 cardsui.js)─────────
function cuTechName(id) {
  var n = (typeof techNode === 'function') ? techNode(id) : null;
  return n ? ((typeof techLabelOf === 'function') ? techLabelOf(n) : n.name) : id;
}
// 說明浮層:抽卡節奏(全由 CARD_DRAW 即時組出)
function cuDrawInfo() {
  var cs = (typeof cardsGet === 'function') ? cardsGet() : null, D = CARD_DRAW, T = cardsDrawTier(), o = { title: '抽卡次數', tags: [CARD_VENUES.T.name, CARD_VENUES.E.name], lines: [] };
  o.lines.push(['怎麼抽', '抽卡次數兩個卡池共用:每抽 1 次出 1 張,可單抽,也可連抽 ' + D.maxOne + ' 次;抽到的人直接加入名冊,不用另外花費。次數隨時間累積,離線也照算,最多存 ' + D.cap + ' 次(存滿就不再增加,先抽才會繼續累積)。']);
  o.lines.push(['現在', '每 ' + T.h + ' 小時補充 ' + T.n + ' 抽。']);
  o.lines.push(['每次補充', D.size.map(function (x) { return x.tech ? '研發〈' + cuTechName(x.tech) + '〉→ ' + x.n + ' 抽' : '一開始 ' + x.n + ' 抽'; }).join(';') + '。']);
  o.lines.push(['間隔', D.gap.map(function (x) { return x.tech ? '研發〈' + cuTechName(x.tech) + '〉→ 每 ' + x.h + ' 小時' : '一開始每 ' + x.h + ' 小時'; }).join(';') + '。']);
  o.lines.push(['額外贈抽', '新手禮包 ' + CARD_STARTER.pulls + ' 抽;每章頭目關首次通關各 +' + CARD_BOSS.pulls + ' 抽(任務清單可看)。贈抽不受上限 ' + D.cap + ' 截斷。']);
  o.lines.push(['名冊滿了', '名冊固定 ' + cardsCap() + ' 格,不隨官階。名冊滿了就停止抽卡(次數保留、不扣);遣散或熔鍊騰出空位後才能再抽。自動熔爐可在名冊頁設定(預設關),設到藍時白 / 青 / 藍的路人抽到就直接熔成碎片(名人不熔)。']);
  o.lines.push(['碎片', '遣散路人、卡片熔爐都會得到碎片;碎片可升星、換指名券,也可花 ' + CARD_RECALL_COST + ' 碎請回流浪的名人。']);
  if (cs) o.lines.push(['你的狀況', '可抽 ' + cardsPulls(cs) + ' 次,名冊 ' + cs.roster.length + '/' + cardsCap() + '(剩 ' + cardsRosterRoom(cs) + ' 格),碎片 ' + (cs.shards | 0) + '。']);
  return o;
}
// 前往研發:關招賢面板、開科技樹
function cuGoTech() {
  if (typeof techPanelOpen !== 'function' && typeof toggleTechPanel !== 'function') return;
  cardsUiClose();
  if (typeof techPanelOpen === 'function') techPanelOpen(); else toggleTechPanel(true);
}
// 保底說明浮層內容
function cuStarterPityInfo() {
  var cs = (typeof cardsGet === 'function') ? cardsGet() : null, o = { title: '抽卡機率與保底', tags: ['招賢'], lines: [] }, T = CARD_VENUES.T, E = CARD_VENUES.E, G = CARD_VENUES.G, P = CARD_CFG.pityBatches, PD = CARD_DRAW.pity, S = CARD_STARTER, st, nb, n = cardsDrawSize();
  o.lines.push([T.name, '每張機率:' + cuGrPct(T.gr) + '。連抽 ' + CARD_DRAW.floorMin + ' 張以上時至少 1 張' + cuGrName(T.floor) + '卡以上;連續 ' + PD + ' 抽沒有' + cuGrName(T.upper.gr) + '卡以上,第 ' + (PD + 1) + ' 抽必出 1 張(單抽也算)。']);
  o.lines.push([E.name, '每張機率:' + cuGrPct(E.gr) + '。連抽 ' + CARD_DRAW.floorMin + ' 張以上時至少 1 張' + cuGrName(E.floor) + '卡以上;連續 ' + PD + ' 抽沒有' + cuGrName(E.upper.gr) + '卡以上,第 ' + (PD + 1) + ' 抽必出 1 張。']);
  o.lines.push(['指名', '每張機率:' + cuGrPct(G.gr) + '(金卡都是名人;選職業分類時金卡改出紫卡)。每次至少 1 張藍卡以上;連續 ' + P + ' 次沒有紫卡以上,第 ' + (P + 1) + ' 次必出 1 張。']);
  o.lines.push(['新手期', '領新手禮包後的前 ' + S.nbCards + ' 張' + T.name + '、' + E.name + '卡改用:' + T.name + ' ' + cuGrPct(S.nbGr.T) + ';' + E.name + ' ' + cuGrPct(S.nbGr.E) + '。另外每 ' + S.nbPurple + ' 張內必有紫卡以上、每 ' + S.nbGold + ' 張內必有金卡。新手期結束後回到上面的一般機率。']);
  if (cs) {
    nb = cs.starter && cs.starter.nb;
    if (typeof cardsNbLeft === 'function' && cardsNbLeft(cs) > 0 && nb) o.lines.push(['你的新手期', '還剩 ' + cardsNbLeft(cs) + ' 張;最多再 ' + Math.max(1, S.nbPurple - (nb.p | 0)) + ' 張必出紫卡以上,最多再 ' + Math.max(1, S.nbGold - (nb.g | 0)) + ' 張必出金卡。']);
    o.lines.push(['保底進度', T.name + ' ' + Math.min(cs.pity.T, PD) + '/' + PD + '、' + E.name + ' ' + Math.min(cs.pity.E, PD) + '/' + PD + '、指名 ' + Math.min(cs.pity.G, P) + '/' + P + '(數字 = 連續沒出保底品階的抽數(指名池為次數),到上限時下一抽必出)。']);
    st = (typeof cardsStarterState === 'function') ? cardsStarterState(cs) : 'na';
    o.lines.push(['新手禮包', st === 'ready' ? '還沒領取,可在總覽頂端領取 ' + S.pulls + ' 抽。' : st === 'open' ? '已領取,舊版禮包還有 ' + (cs.starter.left | 0) + ' 批沒開(總覽頂端)。' : st === 'done' ? '已領取' + (cs.starter.at ? '(' + new Date(cs.starter.at).toLocaleDateString() + ')' : '') + '。' : '不適用:這個存檔在新手禮包推出前就已開始(已有人才或已畢業教學),不補發。']);
  }
  return o;
}

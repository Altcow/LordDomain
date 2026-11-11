// js/cardsui_starter.js — 抽卡機率 / 保底 / 新手期 / 抽卡節奏的說明資料(cardsUiInfo kind pity / draw)與共用小工具(cuGrName / cuGrPct / cuPityN)。UI 組字在 cardsui_draw.js。
// 2026-11-11(v59):新手禮包領取流程已刪除(禮包為道具,見 cards_starter.js cardsGiftCheck 與 items.js);指名池已刪除。
// 全域名稱:cuGrName cuGrPct cuPityN cuTechName cuDrawInfo cuStarterPityInfo
// 不發聲、不推播。ES2017;不用 ?. ??。

function cuGrName(g) { return CARD_GRADE[g] ? CARD_GRADE[g].name : ''; }
function cuGrPct(p) { return p.map(function (v, i) { return v > 0 ? cuGrName(i) + ' ' + v + ' %' : ''; }).filter(function (s) { return s; }).join('、'); }
function cuPityN(v) { return CARD_DRAW.pity; }   // 小池 / 大池:連續幾『張』沒出上等 → 下一張保底
function cuTechName(id) {
  var n = (typeof techNode === 'function') ? techNode(id) : null;
  return n ? ((typeof techLabelOf === 'function') ? techLabelOf(n) : n.name) : id;
}
// 說明浮層:抽卡節奏(全由 CARD_DRAW 即時組出)
function cuDrawInfo() {
  var cs = (typeof cardsGet === 'function') ? cardsGet() : null, D = CARD_DRAW, T = cardsDrawTier(), o = { title: '抽卡次數', tags: [CARD_VENUES.T.name, CARD_VENUES.E.name], lines: [] };
  o.lines.push(['怎麼抽', '小池與大池各自有一個抽卡次數(不共用)。每抽 1 次出 1 張,可單抽、連抽 ' + D.maxOne + ' 次,或全抽(只抽目前選的池);抽到的人直接加入卡包,不用另外花費。次數隨時間累積,離線也照算,各自最多存 ' + D.cap + ' 次(存滿就不再增加,先抽才會繼續累積)。']);
  o.lines.push(['現在', '每 ' + T.h + ' 小時,小池與大池各補充 ' + T.n + ' 抽。']);
  o.lines.push(['每次補充', D.size.map(function (x) { return x.tech ? '研發〈' + cuTechName(x.tech) + '〉→ ' + x.n + ' 抽' : '一開始 ' + x.n + ' 抽'; }).join(';') + '。']);
  o.lines.push(['間隔', '大池每 ' + D.gap.E + ' 小時、小池每 ' + D.gap.T + ' 小時,各 +' + D.size[0].n + ' 抽(間隔固定,不受科技影響)。']);
  o.lines.push(['額外贈抽', '新手禮包(道具)內含 ' + CARD_GIFT.pulls + ' 抽,到卡包的道具頁籤使用(入大池,不受上限截斷);每章頭目關首次通關各 +' + CARD_BOSS.pulls + ' 抽(大池)。贈抽不受上限 ' + D.cap + ' 截斷。']);
  o.lines.push(['卡包滿了', '卡包固定 ' + cardsCap() + ' 格,不隨官階。卡包滿了就停止抽卡(次數保留、不扣);遣散或熔鍊騰出空位後才能再抽。自動熔爐可在卡包頁設定(預設關),設到藍時白 / 青 / 藍的路人抽到就直接熔成碎片(名人不熔)。']);
  o.lines.push(['碎片', '遣散路人、卡片熔爐都會得到碎片;碎片可升星,也可花 ' + CARD_RECALL_COST + ' 碎請回流浪的名人。']);
  if (cs) o.lines.push(['你的狀況', '小池可抽 ' + cardsPulls(cs, 'T') + ' 次、大池可抽 ' + cardsPulls(cs, 'E') + ' 次;卡包 ' + cs.roster.length + '/' + cardsCap() + '(剩 ' + cardsRosterRoom(cs) + ' 格),碎片 ' + (cs.shards | 0) + '。']);
  return o;
}
// 保底說明浮層內容
function cuStarterPityInfo() {
  var cs = (typeof cardsGet === 'function') ? cardsGet() : null, o = { title: '抽卡機率與保底', tags: ['招賢'], lines: [] }, T = CARD_VENUES.T, E = CARD_VENUES.E, PD = CARD_DRAW.pity, S = CARD_STARTER, nb;
  o.lines.push([T.name, '每張機率:' + cuGrPct(T.gr) + '(不出金卡)。連抽 ' + CARD_DRAW.floorMin + ' 張以上時至少 1 張' + cuGrName(T.floor) + '卡以上;連續 ' + PD + ' 抽沒有' + cuGrName(T.upper.gr) + '卡以上,第 ' + (PD + 1) + ' 抽必出 1 張(單抽也算)。']);
  o.lines.push([E.name, '每張機率:' + cuGrPct(E.gr) + '。連抽 ' + CARD_DRAW.floorMin + ' 張以上時至少 1 張' + cuGrName(E.floor) + '卡以上;連續 ' + PD + ' 抽沒有' + cuGrName(E.upper.gr) + '卡以上,第 ' + (PD + 1) + ' 抽必出 1 張。金卡皆為名人。']);
  o.lines.push(['新手期', '開局或重啟後的前 ' + S.nbCards + ' 張' + T.name + '、' + E.name + '卡改用:' + T.name + ' ' + cuGrPct(S.nbGr.T) + ';' + E.name + ' ' + cuGrPct(S.nbGr.E) + '。每 ' + S.nbPurple + ' 張內必有紫卡以上;大池每 ' + S.nbGold + ' 張內必有金卡。新手期結束後回到上面的一般機率。']);
  if (cs) {
    nb = cs.starter && cs.starter.nb;
    if (typeof cardsNbLeft === 'function' && cardsNbLeft(cs) > 0 && nb) o.lines.push(['你的新手期', '還剩 ' + cardsNbLeft(cs) + ' 張;最多再 ' + Math.max(1, S.nbPurple - (nb.p | 0)) + ' 張必出紫卡以上,大池最多再 ' + Math.max(1, S.nbGold - (nb.g | 0)) + ' 張必出金卡。']);
    o.lines.push(['保底進度', T.name + ' ' + Math.min(cs.pity.T, PD) + '/' + PD + '、' + E.name + ' ' + Math.min(cs.pity.E, PD) + '/' + PD + '(數字 = 連續沒出保底品階的抽數,到上限時下一抽必出)。']);
  }
  return o;
}

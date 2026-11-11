// js/tutorial_data.js — 新手教學 T0~T11 的文案與前往動作(純資料,無 DOM)。引擎 tutorial.js,卡片介面 nextstepui.js。
// 每步:icon、text(主句 ≤30 字)、why(≤40 字)、go(前往動作,同 nextstep 的 go;另加 {kind:'tut', id:'start'|'grad'} 給 T0 開始 / T11 好)。
// 完成條件與修復提示在 tutorial.js(tutDone / tutRepair),以免資料與條件分散兩處。
// 2026-11-09 卡片為主體、建設為輔:T0 之後先教卡片 C1~C4(領新手抽 → 開卡 → 看角色 / 戰法 → 組第一隊),再接建築 T1~T11。
// 進度顯示 n/15:T0 = 0/15(到任),C1~C4 = 1~4/15,T1~T10 = 5~14/15,T11 = 15/15(畢業卡)。
// 全域名稱:TUT_IDS TUT_TEXT TUT_TOTAL
var TUT_IDS = ['T0', 'C1', 'C2', 'C3', 'C4', 'T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11'];
var TUT_TOTAL = 15;
var TUT_TEXT = {
  T0: { icon: '🏡', text: '大人到任啦!這是您的小村。', why: '先認識卡片:領新手抽、抽角色、組第一隊;再學蓋房子與研發。約 8 分鐘。', go: { kind: 'tut', id: 'start' } },
  C1: { icon: '🃏', text: '打開右側欄的〈卡片〉,到卡包的『道具』頁籤使用新手禮包(內含大池 2000 抽)。', why: '開局與重啟後會發一個新手禮包(道具),點『使用』才入大池 2000 抽;前幾抽保底有紫卡和金卡。', go: { kind: 'cards', tab: 'O' } },
  C2: { icon: '🃏', text: '在〈卡片〉的抽卡頁按「10 抽」,抽出你的第一批角色。', why: '抽到的人直接進卡包;次數會隨時間累積,通關頭目關還有贈抽。', go: { kind: 'cards', tab: 'T' } },
  C3: { icon: '📇', text: '打開〈卡片〉的卡包,點一張卡看角色的五維與戰法。', why: '戰法決定上陣怎麼打,名人還有專屬詞條。', go: { kind: 'cards', tab: 'R' } },
  C4: { icon: '⚔', text: '到側欄〈戰鬥〉挑 5 人,組成第一隊。', why: '卡包至少 5 人就能出戰;人數不夠可以先記著,抽滿再組。', go: { kind: 'bn' } },
  T1: { icon: '💧', text: '民房離水井太遠,百姓喝不到水。在民房旁鑿一口井吧。', why: '每口井只顧得到 6 格內的人家,點前往幫您選位置。', go: { kind: 'build', type: 'well' } },
  T2: { icon: '🏠', text: '城裡已有一口井供水,再蓋一間民房,讓新住戶搬進來。', why: '民房會自己產金幣,是研發的本錢。', go: { kind: 'build', type: 'house' } },
  T3: { icon: '📜', text: '蓋一座研究院,學新本事才能蓋新建築。', why: '茅廁、市集這些新建築,都要先在研究院研發。', go: { kind: 'build', type: 'research' } },
  T4: { icon: '📜', text: '打開科技,研發〈圊溷(茅廁)〉。', why: '人一多街坊就髒,茅廁是第一道防線。', go: { kind: 'tech', id: 'md_cesuo' } },
  T5: { icon: '🧭', text: '研發中…約 30 秒。先看看「衛生」這根長條。', why: '綠色是乾淨,黃色要注意,紅色要馬上處理。', go: { kind: 'bars' } },
  T6: { icon: '🚻', text: '蓋一座茅廁,放在民房 5 格內。', why: '茅廁只顧得到附近的人家,離太遠就沒用。', go: { kind: 'build', type: 'privy' } },
  T7: { icon: '🌾', text: '人變多了要吃飯,在民房旁再開一塊田。', why: '一塊田大約養得活 3 戶。', go: { kind: 'build', type: 'field_sprout' } },
  T8: { icon: '🏠', text: '把民房擴到 4 棟(400 戶),讓糧、水、衛生都保持綠色。', why: '蓋房之前,先看三根長條還綠不綠。', go: { kind: 'build', type: 'house' } },
  T9: { icon: '📜', text: '再研一項:〈市令(市集)〉,研成就能開市集。', why: '研發要學識。研究院每分鐘產 1 點學識。', go: { kind: 'tech', id: 'e_shiling' } },
  T10: { icon: '🏪', text: '〈市令(市集)〉研成了,可以蓋市集了。', why: '市集開張後,商店才開得起來。', go: { kind: 'tech', id: 'e_shiling' } },
  T11: { icon: '🎓', text: '教學完成!之後遇到黃色或紅色長條,點右上的建議就會帶你去處理。', why: '', go: { kind: 'tut', id: 'grad' } }
};
// 簡化城市模式(js/citysimple.js CITY_SIMPLE)的教學:只教「蓋建築 → 研科技 → 解鎖新建築」。{t1}{b1}{t2}{b2} 由 tutorial.js 依 TECH_SIMPLE.tut 代入科技 / 建築名。
var TUT_TEXT_SIMPLE = {
  T0: { icon: '🏡', text: '大人到任啦!這是您的小村。', why: '先認識卡片:領新手抽、抽角色、組第一隊;再走一遍蓋房子、研科技、解鎖新建築。約 8 分鐘。', go: { kind: 'tut', id: 'start' } },
  C1: { icon: '🃏', text: '打開右側欄的〈卡片〉,到卡包的『道具』頁籤使用新手禮包(內含大池 2000 抽)。', why: '開局與重啟後會發一個新手禮包(道具),點『使用』才入大池 2000 抽;前幾抽保底有紫卡和金卡。', go: { kind: 'cards', tab: 'O' } },
  C2: { icon: '🃏', text: '在〈卡片〉的抽卡頁按「10 抽」,抽出你的第一批角色。', why: '抽到的人直接進卡包;次數會隨時間累積,通關頭目關還有贈抽。', go: { kind: 'cards', tab: 'T' } },
  C3: { icon: '📇', text: '打開〈卡片〉的卡包,點一張卡看角色的五維與戰法。', why: '戰法決定上陣怎麼打,名人還有專屬詞條。', go: { kind: 'cards', tab: 'R' } },
  C4: { icon: '⚔', text: '到側欄〈戰鬥〉挑 5 人,組成第一隊。', why: '卡包至少 5 人就能出戰;人數不夠可以先記著,抽滿再組。', go: { kind: 'bn' } },
  T1: { icon: '🏠', text: '先蓋一間民房,讓百姓住下來。', why: '民房會產金幣,人口越多,官階升得越快。', go: { kind: 'build', type: 'house' } },
  T2: { icon: '📜', text: '蓋一座研究院,才能研發科技。', why: '新建築都要先研發對應的科技才能蓋。', go: { kind: 'build', type: 'research' } },
  T3: { icon: '📜', text: '打開科技,研發〈{t1}〉。', why: '研成就能蓋{b1}。這一項教學期間免費、30 秒研完。', go: { kind: 'tech', id: '{t1}' } },
  T4: { icon: '⏳', text: '〈{t1}〉研發中…點科技看看「研成可蓋」寫了什麼。', why: '每項科技都寫著:要先蓋什麼、研成能蓋什麼。', go: { kind: 'tech', id: '{t1}' } },
  T5: { icon: '🏪', text: '〈{t1}〉研成了!蓋一座{b1}吧。', why: '研成的科技會解鎖新建築,建造選單裡就找得到。', go: { kind: 'build', type: '{b1}' } },
  T6: { icon: '📜', text: '再研發〈{t2}〉。它的前置建築是{b1},您已經蓋好了。', why: '有些科技要先蓋好某座建築才能研,科技卡上會寫「先蓋 XX」。', go: { kind: 'tech', id: '{t2}' } },
  T7: { icon: '⏳', text: '〈{t2}〉研發中,研成後可以蓋{b2}。', why: '研發中可以先去做別的事。', go: { kind: 'tech', id: '{t2}' } },
  T8: { icon: '📜', text: '〈{t2}〉研成了!蓋一座{b2}。', why: '蓋建築 → 解鎖科技 → 再蓋新建築,城就這樣長大。', go: { kind: 'build', type: '{b2}' } },
  T9: { icon: '🏠', text: '把民房擴到 4 棟(400 戶)。', why: '人口和建築越多,繁榮度越高,官階就升得上去。', go: { kind: 'build', type: 'house' } },
  T10: { icon: '🔍', text: '打開科技,挑下一項來研。', why: '灰色寫「先蓋 XX」的,點「前往」就帶您去蓋。', go: { kind: 'panel', id: 'tech' } },
  T11: { icon: '🎓', text: '教學完成!之後右上的卡片會提示:有哪些科技可研、哪些建築已解鎖還沒蓋。', why: '', go: { kind: 'tut', id: 'grad' } }
};

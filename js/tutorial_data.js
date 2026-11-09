// js/tutorial_data.js — 新手教學 T0~T11 的文案與前往動作(純資料,無 DOM)。引擎 tutorial.js,卡片介面 nextstepui.js。
// 每步:icon、text(主句 ≤30 字)、why(≤40 字)、go(前往動作,同 nextstep 的 go;另加 {kind:'tut', id:'start'|'grad'} 給 T0 開始 / T11 好)。
// 完成條件與修復提示在 tutorial.js(tutDone / tutRepair),以免資料與條件分散兩處。
// 進度顯示 n/11:T0 = 0/11(到任),T1~T10 = 1~10/11,T11 = 11/11(畢業卡)。
// 全域名稱:TUT_IDS TUT_TEXT TUT_TOTAL
var TUT_IDS = ['T0', 'T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11'];
var TUT_TOTAL = 11;
var TUT_TEXT = {
  T0: { icon: '🏡', text: '大人到任啦!這是您的小村。', why: '先帶您做幾件事:讓百姓有水喝、住得乾淨,再學會研發。約 5 分鐘。', go: { kind: 'tut', id: 'start' } },
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
  T0: { icon: '🏡', text: '大人到任啦!這是您的小村。', why: '先帶您走一遍:蓋房子、蓋研究院、研科技、解鎖新建築。約 5 分鐘。', go: { kind: 'tut', id: 'start' } },
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

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
  T2: { icon: '🏠', text: '有水了,再蓋一間民房,讓新住戶搬進來。', why: '民房會自己產金幣,是研發的本錢。', go: { kind: 'build', type: 'house' } },
  T3: { icon: '📜', text: '蓋一座研究院,學新本事才能蓋新建築。', why: '茅廁、市集這些新建築,都要先在研究院研發。', go: { kind: 'build', type: 'research' } },
  T4: { icon: '📜', text: '打開科技,研發〈圊溷(茅廁)〉。', why: '人一多街坊就髒,茅廁是第一道防線。', go: { kind: 'tech', id: 'md_cesuo' } },
  T5: { icon: '🧭', text: '研發中…約 30 秒。先看看「衛生」這根長條。', why: '綠色是乾淨,黃色要注意,紅色要馬上處理。', go: { kind: 'bars' } },
  T6: { icon: '🚻', text: '蓋一座茅廁,放在民房 5 格內。', why: '茅廁只顧得到附近的人家,離太遠就沒用。', go: { kind: 'build', type: 'privy' } },
  T7: { icon: '🌾', text: '人變多了要吃飯,在民房旁再開一塊田。', why: '一塊田大約養得活 3 戶。', go: { kind: 'build', type: 'field_sprout' } },
  T8: { icon: '🏠', text: '把民房擴到 4 間(城裡最多 4 戶),讓糧、水、衛生都保持綠色。', why: '蓋房之前,先看三根長條還綠不綠。', go: { kind: 'build', type: 'house' } },
  T9: { icon: '📜', text: '再研一項:〈市令(市集)〉,研成就能開市集。', why: '研發要學識。研究院每分鐘產 1 點學識。', go: { kind: 'tech', id: 'e_shiling' } },
  T10: { icon: '🏪', text: '〈市令(市集)〉研成了。市集目前還沒有名額,之後城裡發展了才能蓋。', why: '市集開張後,商店才開得起來。', go: { kind: 'tech', id: 'e_shiling' } },
  T11: { icon: '🎓', text: '教學完成!之後遇到黃色或紅色長條,點右上的建議就會帶你去處理。', why: '', go: { kind: 'tut', id: 'grad' } }
};

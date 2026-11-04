// js/cityadvisor_data.js — 顧問系統資料(PLAN_NOLEVEL §4 §5 §6 NL3b/NL3c 最小版):指標辭典 STAT_HELP、長條定義 BAR_ITEMS、顧問條目 ADVICE。
// 純資料,無 DOM。引擎在 cityadvisor.js,介面在 cityadvisorui.js。文案以古風口語為準;數字門檻皆為 PLACEHOLDER,由平衡階段調整。
// 全域名稱:ADV_TIER ADV_TIER_MARK ADV_TIER_NAME ADV_XUN_SEC ADV_MAX_EXPAND ADV_THROTTLE_MS STAT_HELP BAR_ITEMS ADVICE ADV_CONFLICT
var ADV_TIER = { R: 0, Y: 1, B: 2 };                       // 排序用:危急 < 警示 < 建議
var ADV_TIER_MARK = { R: '■', Y: '▲', B: '●' };            // 符號不只靠顏色
var ADV_TIER_NAME = { R: '危急', Y: '警示', B: '建議' };
var ADV_XUN_SEC = 90;                                      // 1 旬 = 90 秒遊玩時間(PLACEHOLDER)
var ADV_MAX_EXPAND = 5;
var ADV_THROTTLE_MS = 1500;

// 長條定義。g/y = 綠 / 黃門檻(值 ≥ g 為正常 ●,≥ y 為警示 ▲,其餘危急 ■);max = 長條滿高對應的值;reveal = 逐步揭露條件鍵(見 cityadvisor.js ADV_REVEAL)
var BAR_ITEMS = [
  { id: 'food',   name: '糧食', short: '糧', icon: '🌾', max: 150, g: 100, y: 85, unit: '%', reveal: 'start' },
  { id: 'sani',   name: '衛生', short: '衛', icon: '🧹', max: 100, g: 60,  y: 45, unit: '',  reveal: 'start' },
  { id: 'mood',   name: '民心', short: '心', icon: '😊', max: 100, g: 50,  y: 40, unit: '',  reveal: 'start' },
  { id: 'water',  name: '飲水', short: '水', icon: '💧', max: 120, g: 80,  y: 60, unit: '%', reveal: 'water' },
  { id: 'store',  name: '庫房', short: '庫', icon: '📦', max: 100, g: 60,  y: 30, unit: '',  reveal: 'workshop' },
  { id: 'tech',   name: '研發', short: '研', icon: '📜', max: 100, g: 100, y: 50, unit: '',  reveal: 'tech' },
  { id: 'house',  name: '住房', short: '房', icon: '🏠', max: 100, g: 60,  y: 0,  unit: '%', reveal: 'house', custom: true },
  { id: 'order',  name: '治安', short: '安', icon: '🛡', max: 100, g: 50,  y: 40, unit: '',  reveal: 'order' },
  { id: 'road',   name: '道路', short: '路', icon: '🛤', max: 100, g: 80,  y: 60, unit: '%', reveal: 'road' },
  { id: 'plague', name: '疫病', short: '疫', icon: '☣', max: 100, g: 60,  y: 40, unit: '',  reveal: 'plague' },
  { id: 'fame',   name: '名望', short: '望', icon: '🏮', max: 100, g: 40,  y: 20, unit: '',  reveal: 'era2' },
  { id: 'edu',    name: '教化', short: '化', icon: '📖', max: 100, g: 40,  y: 25, unit: '',  reveal: 'era2' }
];

// 指標辭典。欄位:id name icon brief(2 句) briefNovice detail[] range causes[{id,kind}] redResult fix[3] techs[] links[{stat,text}]
var STAT_HELP = {
  food: {
    id: 'food', name: '糧食', icon: '🌾',
    brief: '百姓每天要吃的糧,由田地供給。糧不夠,人會挨餓、民心大跌。',
    briefNovice: '田越多,大家越吃得飽;紅了就多蓋田。',
    detail: ['糧食指標是「全城糧食供給 ÷ 全城糧食需求」的滿足度。每位居民每時耗糧約 0.25 件,人口越多耗得越多。', '田、粟田、麥田、菜圃、魚場都產糧;田離民居太遠,挑糧的路上耗損,效果會打折。'],
    range: '滿足度 %:≥100 正常(●)、85~99 警示(▲)、<85 危急(■);<70 為危機。',
    causes: [{ id: 'field_sprout', kind: 'obj' }, { id: 'field_millet', kind: 'obj' }, { id: 'field_wheat', kind: 'obj' }, { id: 'vegetable_plot', kind: 'obj' }, { id: 'fishery', kind: 'obj' }],
    redResult: '民心下降、人口外移;嚴重時發生餓殍事件(新手保護期內不發生)。',
    fix: ['在民居旁加蓋 2 塊田', '研發增產的農具與屯田之術', '糧多了再蓋糧倉,別讓收成爛在田裡'],
    techs: ['ag_lei', 'e_tuntian'],
    links: [{ stat: 'mood', text: '糧低會拉低民心' }]
  },
  water: {
    id: 'water', name: '飲水', icon: '💧',
    brief: '民居附近要有井或水源,百姓才有乾淨的水喝。離水源太遠的人家算「未供水」。',
    briefNovice: '每片住宅附近鑿口井,就不缺水了。',
    detail: ['飲水指標是「有水源覆蓋的民居比例」。水井、桔槔、水車各有覆蓋半徑與供水量,超過供水量的人口不算被供到。', '河邊可以架桔槔,供水量比水井大。'],
    range: '覆蓋率 %:≥80 正常、60~79 警示、<60 危急。',
    causes: [{ id: 'well', kind: 'obj' }, { id: 'well_sweep', kind: 'obj' }, { id: 'waterwheel', kind: 'obj' }],
    redResult: '衛生變差、疫病風險上升、民心下降。',
    fix: ['在沒覆蓋到的坊鑿一口井', '河邊研發並架設桔槔', '井不夠大時再補一口,別擠在同一處'],
    techs: ['wa_jiegao'],
    links: [{ stat: 'sani', text: '缺水會拖累衛生' }, { stat: 'plague', text: '喝髒水容易鬧疫病' }]
  },
  sani: {
    id: 'sani', name: '衛生', icon: '🧹',
    brief: '街坊乾不乾淨,取決於茅廁、水井和人口密度。太髒就容易鬧疫病。',
    briefNovice: '人多的地方蓋茅廁,別讓污水橫流。',
    detail: ['衛生以坊(12×12 格)為單位算平均,再得全城值。茅廁、醫館、藥圃、理髮攤等會加分;人口越密,基本分越低。', '路面鋪石板、少堆雜物也有幫助。'],
    range: '分數:≥60 正常、45~59 警示、<45 危急;<30 為危機。',
    causes: [{ id: 'privy', kind: 'obj' }, { id: 'well', kind: 'obj' }, { id: 'hospital', kind: 'obj' }, { id: 'herb_garden', kind: 'obj' }],
    redResult: '疫病風險升高、民心下降;路上行人變慢。',
    fix: ['在人口密集的坊蓋茅廁', '補井,讓污水有出路', '蓋醫館或藥圃壓低疫病'],
    techs: [],
    links: [{ stat: 'plague', text: '衛生差,疫病風險就高' }]
  },
  plague: {
    id: 'plague', name: '疫病風險', icon: '☣',
    brief: '疫病隨髒亂與擁擠而來。風險高時,隨時可能有人病倒、工作停擺。',
    briefNovice: '衛生顧好、蓋醫館,疫病就不敢來。',
    detail: ['長條顯示「100 − 風險」,越高越安全。風險由衛生不足、人口過密、缺水推高,由醫館、藥舖、藥圃壓低。'],
    range: '安全度:≥60 正常、40~59 警示、<40 危急。',
    causes: [{ id: 'hospital', kind: 'obj' }, { id: 'shop_herb', kind: 'obj' }, { id: 'herb_garden', kind: 'obj' }],
    redResult: '居民生病、民心大降,嚴重時人口減少。',
    fix: ['先把衛生拉回綠色', '在人口最多的坊蓋醫館', '種藥圃、開藥舖作輔助'],
    techs: [],
    links: [{ stat: 'sani', text: '先補衛生' }]
  },
  order: {
    id: 'order', name: '治安', icon: '🛡',
    brief: '街上太亂,百姓會不安。告示牌、望樓、城門和兵營能維持秩序。',
    briefNovice: '人多了,放幾座告示牌或望樓。',
    detail: ['治安 = 基本值 50 + 守衛類建築加成 + 教化 × 0.2 − 人口密度項。人口越多越需要治安建築。'],
    range: '分數:≥50 正常、40~49 警示、<40 危急。',
    causes: [{ id: 'notice_board', kind: 'obj' }, { id: 'deco_watchtower', kind: 'obj' }, { id: 'gate', kind: 'obj' }, { id: 'drum_tower', kind: 'obj' }],
    redResult: '民心下降、偶有偷竊與鬥毆事件。',
    fix: ['人口多的坊立告示牌', '主要路口蓋望樓或鼓樓', '提升教化也會間接加分'],
    techs: [],
    links: [{ stat: 'edu', text: '教化高,治安也高' }]
  },
  mood: {
    id: 'mood', name: '民心', icon: '😊',
    brief: '百姓開不開心。吃飽、有水、乾淨、安全,再加上娛樂,民心就高。',
    briefNovice: '前面幾項顧好,民心自然好;想更高就蓋茶館、說書台。',
    detail: ['民心 = 基本值 + 糧、水、衛、安四項需求的滿足加成(最多 +20)+ 娛樂宗教建築 + 政令。', '民心太低會影響人口成長與稅收。'],
    range: '分數:≥50 正常、40~49 警示、<40 危急。',
    causes: [{ id: 'storyteller', kind: 'obj' }, { id: 'shop_tea', kind: 'obj' }, { id: 'she_altar', kind: 'obj' }, { id: 'market', kind: 'obj' }],
    redResult: '人口外移、生產效率下降、可能出現民變徵兆。',
    fix: ['先看哪一項基本需求紅了,先補它', '蓋茶館、說書台、里社添樂子', '頒布合適的政令安撫'],
    techs: [],
    links: [{ stat: 'food', text: '糧食是民心的底' }, { stat: 'water', text: '飲水也算一項' }]
  },
  fame: {
    id: 'fame', name: '名望', icon: '🏮',
    brief: '城的名聲。牌坊、石碑、文教建築會累積名望,吸引外來人才與商旅。',
    briefNovice: '蓋牌坊和石碑,讓外人聽說你的城。',
    detail: ['名望為長期累積值,不會很快下降。立縣之後才揭露。'],
    range: '分數:≥40 正常、20~39 警示、<20 偏低。',
    causes: [{ id: 'paifang', kind: 'obj' }, { id: 'stele', kind: 'obj' }],
    redResult: '來訪商旅與人才減少,不會直接造成損失。',
    fix: ['立一座牌坊', '多蓋石碑與書肆', '完成大工程里程碑'],
    techs: [],
    links: [{ stat: 'edu', text: '教化帶動名望' }]
  },
  edu: {
    id: 'edu', name: '教化', icon: '📖',
    brief: '百姓識字明禮的程度。書肆、書院、石碑會提高教化,連帶治安和學識。',
    briefNovice: '蓋書肆、書院,城裡的人會更守規矩。',
    detail: ['教化 = 20 + 文教建築加成。教化會以 0.2 倍加進治安,也影響研發速度。'],
    range: '分數:≥40 正常、25~39 警示、<25 偏低。',
    causes: [{ id: 'shop_book', kind: 'obj' }, { id: 'research', kind: 'obj' }, { id: 'stele', kind: 'obj' }],
    redResult: '治安略降、研發較慢;不會直接造成災害。',
    fix: ['蓋一間書肆', '蓋研究院(也是科技必備)', '立石碑'],
    techs: [],
    links: [{ stat: 'order', text: '教化會加進治安' }]
  },
  house: {
    id: 'house', name: '住房入住率', icon: '🏠',
    brief: '住宅的入住比例。太滿代表有人沒房住,太空代表蓋太多卻沒人來。',
    briefNovice: '六到九成滿最舒服;全滿就再蓋房。',
    detail: ['入住率 = 人口 ÷ 住宅容量。60~92% 屬健康;92~98% 偏緊;98% 以上且有流民則危急。', '空屋太多(低於 60%)通常是民生不足,讓人不想來。'],
    range: '入住率:60~92% 正常、92~98% 或 <60% 警示、≥98% 且有流民 危急。',
    causes: [{ id: 'house', kind: 'obj' }, { id: 'hut_plank', kind: 'obj' }, { id: 'house_tile', kind: 'obj' }],
    redResult: '流民無處可住,人口停止成長。',
    fix: ['在水井與道路旁加蓋民居', '升級舊屋(換瓦房)', '若空屋多,先補糧、水、衛生'],
    techs: [],
    links: [{ stat: 'mood', text: '民心高才有人想住' }]
  },
  road: {
    id: 'road', name: '道路暢通', icon: '🛤',
    brief: '民居旁兩格內有路的比例。路不通,貨運與出行都變慢。',
    briefNovice: '每戶人家門口都要接上路。',
    detail: ['道路暢通 = 兩格內接路的民居比例 × 路速。石板路與橋樑比土路快。工坊沒接路時產能會打折。'],
    range: '比例 %:≥80 正常、60~79 警示、<60 危急。',
    causes: [{ id: 'road_stone', kind: 'obj' }, { id: 'bridge', kind: 'obj' }],
    redResult: '工坊產能下降、行人繞路、居民滿意下降。',
    fix: ['沿民居外圍補一圈路', '主幹道鋪石板路', '河面架橋接通兩岸'],
    techs: [],
    links: [{ stat: 'store', text: '工坊要接路才運轉順暢' }]
  },
  store: {
    id: 'store', name: '庫房', icon: '📦',
    brief: '看貨品庫存的健康度:工坊缺料停工,或貨品放滿庫房,都算不健康。',
    briefNovice: '工坊停了,看是缺料還是滿倉;缺料就補原料點。',
    detail: ['庫房長條 = 100 − 最差貨品的問題程度。缺料的貨品要找它的生產建築;滿倉的貨品要賣掉或擴倉。', '開啟「庫房」面板可以看到每座工坊的狀態。'],
    range: '健康度:≥60 正常、30~59 警示、<30 危急。',
    causes: [{ id: 'granary_round', kind: 'obj' }, { id: 'market', kind: 'obj' }],
    redResult: '工坊停工、產出中斷;溢出的貨品自動賤賣。',
    fix: ['打開庫房面板,看停工原因', '缺料就加蓋原料點', '滿倉就開市集或擴建倉房'],
    techs: [],
    links: [{ stat: 'road', text: '工坊未接路產能打折' }]
  },
  tech: {
    id: 'tech', name: '研發 / 學識', icon: '📜',
    brief: '科技樹研發的進度。有研究院、有可研項目、付得起成本,長條才是綠色。',
    briefNovice: '蓋研究院,打開科技挑一項研。',
    detail: ['研發分三種狀態:可研且付得起(●)、差學識或貨品(▲)、研究院閒置超過 4 旬(▲ 閃爍)。研發不會變成危急。', '新科技解鎖新建築與增產,常是解決紅色指標的關鍵。'],
    range: '狀態:綠 = 可研且付得起;黃 = 差學識 / 貨品或閒置。',
    causes: [{ id: 'research', kind: 'obj' }, { id: 'shop_book', kind: 'obj' }],
    redResult: '不會出現危急;只是錯過新建築與增產。',
    fix: ['沒有研究院就先蓋一座', '打開科技樹,挑能解決紅色指標的項目', '缺貨品就讓對應工坊開工'],
    techs: [],
    links: [{ stat: 'edu', text: '教化高研發更快' }]
  }
};

// 顧問條目。tier R/Y/B、pri 0~100、cond = ADV_COND 的鍵(cityadvisor.js)、stat = 所屬指標(同 stat 只留最高 pri)、
// text 為陣列時依 id+旬 選句;{x} 由條件函式代入、go = 前往動作、cd = 冷卻(旬,按「知道了」後 ×3)、once = 完成後不再出現
var ADVICE = [
  { id: 'a_start_welcome', tier: 'B', pri: 92, stat: 'house', cond: 'startWelcome', once: true, cd: 6, text: '大人到任啦!先讓百姓有房住、有飯吃,從蓋幾戶民居開始吧。', go: { kind: 'build', type: 'house' } },
  { id: 'a_start_field', tier: 'B', pri: 88, stat: 'food', cond: 'startField', cd: 6, text: '民居有了,下一步種幾塊田,別讓百姓餓肚子。', go: { kind: 'build', type: 'field_sprout' } },
  { id: 'a_well_first', tier: 'B', pri: 66, stat: 'water', cond: 'wellFirst', cd: 6, text: '人家漸多,鑿一口井讓大夥有乾淨的水喝。', go: { kind: 'build', type: 'well' } },

  { id: 'a_food_crit', tier: 'R', pri: 95, stat: 'food', cond: 'foodCrit', cd: 0, text: ['大人,糧食只夠 {pct}% 的人吃,再不開田百姓要餓肚子啦!', '倉裡的糧快見底了({pct}%),快添田!'], go: { kind: 'build', type: 'field_sprout', near: 'worst' } },
  { id: 'a_food_warn', tier: 'Y', pri: 70, stat: 'food', cond: 'foodWarn', cd: 3, text: '糧食有點緊({pct}%),添幾塊田吧。', go: { kind: 'build', type: 'field_sprout', near: 'worst' } },
  { id: 'a_food_far', tier: 'Y', pri: 60, stat: 'food', cond: 'foodFar', cd: 3, text: '{area}離田太遠,挑擔子的走斷了腿,就近種幾塊田如何?', go: { kind: 'camera', target: 'worst' } },
  { id: 'a_food_winter', tier: 'Y', pri: 55, stat: 'food', cond: 'foodWinter', cd: 6, text: '入冬田裡少收,先多囤些糧再說。', go: { kind: 'build', type: 'field_sprout' } },
  { id: 'a_food_millet', tier: 'B', pri: 40, stat: 'food', cond: 'foodMillet', cd: 6, text: '粟田收成比一般田多,換種粟田試試?', go: { kind: 'build', type: 'field_millet' } },
  { id: 'a_food_tech', tier: 'B', pri: 35, stat: 'food', cond: 'foodTech', cd: 6, text: '研〈屯田〉就能種粟田,收成多一截。', go: { kind: 'tech', id: 'e_tuntian' } },
  { id: 'a_food_surplus', tier: 'B', pri: 20, stat: 'food', cond: 'foodSurplus', cd: 6, text: '糧多到倉裡放不下,開個市集賣掉換錢吧。', go: { kind: 'build', type: 'market' } },

  { id: 'a_water_crit', tier: 'R', pri: 90, stat: 'water', cond: 'waterCrit', cd: 0, text: '{area}一口井都沒有,百姓只能喝溝水,快鑿井!', go: { kind: 'build', type: 'well', near: 'worst' } },
  { id: 'a_water_warn', tier: 'Y', pri: 65, stat: 'water', cond: 'waterWarn', cd: 3, text: '井水不太夠用({pct}%),再鑿一口。', go: { kind: 'build', type: 'well', near: 'worst' } },
  { id: 'a_water_tech', tier: 'B', pri: 30, stat: 'water', cond: 'waterTech', cd: 6, text: '研〈桔槔〉,河邊就能汲水,比井更大。', go: { kind: 'tech', id: 'wa_jiegao' } },

  { id: 'a_sani_crit', tier: 'R', pri: 85, stat: 'sani', cond: 'saniCrit', cd: 0, text: '街上污水橫流,衛生只剩 {v},趕緊蓋茅廁!', go: { kind: 'build', type: 'privy', near: 'worst' } },
  { id: 'a_sani_warn', tier: 'Y', pri: 60, stat: 'sani', cond: 'saniWarn', cd: 3, text: '衛生 {v}(警示線 45~60),人多的地方補座茅廁吧。', go: { kind: 'build', type: 'privy', near: 'worst' } },
  { id: 'a_sani_density', tier: 'Y', pri: 50, stat: 'sani', cond: 'saniDensity', cd: 6, text: '住戶已有 {n} 戶卻沒半座茅廁,趁早蓋一座。', go: { kind: 'build', type: 'privy' } },
  { id: 'a_plague_crit', tier: 'R', pri: 88, stat: 'plague', cond: 'plagueCrit', cd: 0, text: '髒亂成疾,疫病就在眼前!快蓋醫館!', go: { kind: 'build', type: 'hospital', near: 'worst' } },
  { id: 'a_plague_warn', tier: 'Y', pri: 58, stat: 'plague', cond: 'plagueWarn', cd: 3, text: '衛生不佳易生疫病,種個藥圃或開間藥舖當保險。', go: { kind: 'build', type: 'herb_garden' } },

  { id: 'a_mood_crit', tier: 'R', pri: 80, stat: 'mood', cond: 'moodCrit', cd: 0, text: '百姓怨聲載道(民心 {v}),先看哪一項紅了,再蓋說書台安撫。', go: { kind: 'build', type: 'storyteller', near: 'worst' } },
  { id: 'a_mood_warn', tier: 'Y', pri: 55, stat: 'mood', cond: 'moodWarn', cd: 3, text: '民心 {v} 有點低,添座茶館讓大夥鬆口氣。', go: { kind: 'build', type: 'shop_tea' } },
  { id: 'a_mood_fun', tier: 'B', pri: 25, stat: 'mood', cond: 'moodFun', cd: 6, text: '日子過得平淡,蓋座里社或說書台,添點樂子。', go: { kind: 'build', type: 'she_altar' } },

  { id: 'a_order_crit', tier: 'R', pri: 78, stat: 'order', cond: 'orderCrit', cd: 0, text: '街頭鬧事的多了(治安 {v}),立個告示牌、設座望樓!', go: { kind: 'build', type: 'notice_board', near: 'worst' } },
  { id: 'a_order_warn', tier: 'Y', pri: 52, stat: 'order', cond: 'orderWarn', cd: 3, text: '治安 {v} 有些吃緊,人多的坊立座告示牌。', go: { kind: 'build', type: 'notice_board', near: 'worst' } },
  { id: 'a_order_pop', tier: 'B', pri: 28, stat: 'order', cond: 'orderPop', cd: 6, text: '人口已近 {n},早些蓋座望樓防患未然。', go: { kind: 'build', type: 'deco_watchtower' } },

  { id: 'a_house_full', tier: 'R', pri: 82, stat: 'house', cond: 'houseFull', cd: 0, text: '流民無處落腳,住房全滿了,快加蓋民居!', go: { kind: 'build', type: 'house' } },
  { id: 'a_house_tight', tier: 'Y', pri: 63, stat: 'house', cond: 'houseTight', cd: 3, text: '房子快住滿了({pct}%),再添幾戶。', go: { kind: 'build', type: 'house' } },
  { id: 'a_house_empty', tier: 'Y', pri: 45, stat: 'house', cond: 'houseEmpty', cd: 6, text: '空屋不少(入住 {pct}%),先把糧、水、衛生顧好,人才肯來。', go: { kind: 'help', stat: 'house' } },

  { id: 'a_store_blocked', tier: 'R', pri: 75, stat: 'store', cond: 'storeBlocked', cd: 0, text: '有 {n} 座工坊斷料停工,多半缺「{miss}」,到庫房看看。', go: { kind: 'panel', id: 'goods' } },
  { id: 'a_store_noroad', tier: 'Y', pri: 59, stat: 'road', cond: 'storeNoRoad', cd: 3, text: '有 {n} 座工坊沒接上通往城主府的路,產量只剩一半,補段路吧。', go: { kind: 'camera', target: 'worst' } },
  { id: 'a_store_loom', tier: 'B', pri: 31, stat: 'store', cond: 'storeLoom', cd: 6, text: '麻田種出來的麻沒處用,蓋第一座織坊把它織成麻布。', go: { kind: 'build', type: 'loom_shop' } },
  { id: 'a_store_full', tier: 'Y', pri: 58, stat: 'store', cond: 'storeFull', cd: 3, text: '有 {n} 項貨品快滿倉,開市集賣一些,別白白溢出。', go: { kind: 'build', type: 'market' } },
  { id: 'a_store_first', tier: 'B', pri: 32, stat: 'store', cond: 'storeFirst', cd: 6, text: '人家不少了,蓋座工坊把原料變成好東西。', go: { kind: 'build', type: 'lumber' } },

  { id: 'a_road_warn', tier: 'Y', pri: 57, stat: 'road', cond: 'roadWarn', cd: 3, text: '不少人家門前沒路(通達 {pct}%),補一圈路吧。', go: { kind: 'camera', target: 'worst' } },
  { id: 'a_road_stone', tier: 'B', pri: 34, stat: 'road', cond: 'roadStone', cd: 6, text: '主幹道改鋪石板路,人和貨都跑得更快。', go: { kind: 'build', type: 'road_stone' } },

  { id: 'a_lab_none', tier: 'Y', pri: 54, stat: 'tech', cond: 'labNone', cd: 6, text: '城裡還沒有研究院,想學新本事得先蓋一座。', go: { kind: 'build', type: 'research' } },
  { id: 'a_tech_idle', tier: 'Y', pri: 48, stat: 'tech', cond: 'techIdle', cd: 4, text: '研究院閒著好一陣了,挑一項新學問來研吧。', go: { kind: 'panel', id: 'tech' } },
  { id: 'a_tech_afford', tier: 'B', pri: 38, stat: 'tech', cond: 'techAfford', cd: 6, text: '有學問可研而且付得起,打開科技看看。', go: { kind: 'panel', id: 'tech' } },
  { id: 'a_tech_gap', tier: 'B', pri: 26, stat: 'tech', cond: 'techGap', cd: 6, text: '想研的項目還差些學識或貨品,先備齊再來。', go: { kind: 'panel', id: 'goods' } },

  { id: 'a_market_first', tier: 'B', pri: 33, stat: 'store', cond: 'marketFirst', cd: 6, text: '戶數漸多,開座市集讓百姓買賣,稅收也跟著來。', go: { kind: 'build', type: 'market' } },
  { id: 'a_deco', tier: 'B', pri: 24, stat: 'mood', cond: 'decoFew', cd: 6, text: '城裡太素了,擺幾件裝飾添點氣象。', go: { kind: 'camera', target: 'center' } },
  { id: 'a_fame_first', tier: 'B', pri: 22, stat: 'fame', cond: 'fameFirst', cd: 6, text: '城漸有規模,立座牌坊揚名四方。', go: { kind: 'build', type: 'paifang' } },
  { id: 'a_edu_first', tier: 'B', pri: 21, stat: 'edu', cond: 'eduFirst', cd: 6, text: '教化還淺,蓋間書肆讓百姓識字明禮。', go: { kind: 'build', type: 'shop_book' } },
  { id: 'a_idle_none', tier: 'B', pri: 1, stat: 'idle', cond: 'always', cd: 0, core: true, text: ['城中安穩,大人可添幾件裝飾、擴建新坊。', '諸事順遂,不妨拓展新區,或翻翻科技找新點子。'], go: { kind: 'camera', target: 'center' } }
];

// 互相矛盾的條目對:同一次輸出不可同時出現(引擎在壓制階段移除 pri 較低者;測試以模糊狀態驗證)
var ADV_CONFLICT = [
  ['a_food_surplus', 'a_food_crit'], ['a_food_surplus', 'a_food_warn'], ['a_house_empty', 'a_house_full'],
  ['a_house_empty', 'a_house_tight'], ['a_house_empty', 'a_start_welcome'], ['a_store_full', 'a_store_blocked'],
  ['a_mood_fun', 'a_mood_crit'], ['a_start_welcome', 'a_house_tight'], ['a_idle_none', 'a_food_crit']
];

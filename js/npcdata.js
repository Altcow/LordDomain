// js/npcdata.js — 人物互動資料(PLAN_INTERIORS §4:派駐職司表、台詞、親近、請託、城內外觀對照)。純資料,不寫 DOM、不讀時間。
// 數字多為 PLACEHOLDER;職司表 = PLAN_CARDS §7.1(MVP 先開 田曹/工曹/市令/學官/醫署/賊曹/太守,另開 冶坊/織坊 兩個已有產出的職司;酒館 I1 加開 掌櫃 keep:收入與客座事件獎勵,由 tavern_i1.js 讀取)。
// 全域名稱:NPC_CFG NPC_POSTS NPC_TYPE_POST NPC_STAGE NPC_TRAIT_PCT NPC_TALK_JOB NPC_TALK_TRAIT NPC_TALK_GENERIC NPC_TALK_PRIV NPC_GIFT NPC_ERRANDS NPC_LOOK_JOB
// ES2017(不使用可選串接與空值合併運算子)。

var NPC_CFG = {
  mulCap: 60,        // 人事乘區上限(%)——PLAN_INTERIORS P1;PLAN_CARDS 原式的職司合計夾 90,這裡先收斂為 60
  postCap: 90,       // 職司值夾(公式內)
  heroCap: 6,        // 城內同時出現的名冊人物上限(PLAN_CARDS §7.2)
  favMax: 5,         // 親近 0~5
  favPrivate: 3,     // 滿 3 解鎖私話
  favGift: 5,        // 滿 5 一次性小禮
  passiveEvery: 3,   // 派駐年資每滿 N 天親近 +1
  errandMax: 2,      // 同時請託上限
  errandReward: { coin: 60 }
};

// 職司表:types = 對口建築 type;main = 主職業(全額);aux = 輔職業(半額);attr = 主屬性在 CARD_STATS 的序(0 統 1 武 2 智 3 政 4 魅);
// seat = { base, div, max }:席位 = min(max, base + floor(建築數 / div));per = 每棟建築可派駐人數;live = 目前是否已接上產出數值(false = 只計入顯示,效果待接)
var NPC_POSTS = [
  { id: 'farm',   name: '田曹', types: ['field_sprout', 'field_millet', 'field_wheat', 'field_hemp', 'vegetable_plot', 'orchard', 'mulberry_grove'], main: ['nongshi'], aux: ['zhishui', 'jiqiao'], attr: 3, seat: { base: 1, div: 4, max: 4 }, per: 1, live: true, eff: '田類糧產' },
  { id: 'craft',  name: '工曹', types: ['lumber', 'quarry', 'sawbench'], main: ['linmu', 'caishi'], aux: ['yingzao'], attr: 1, seat: { base: 1, div: 1, max: 4 }, per: 1, live: true, eff: '管伐木場、採石場(木、石、木板產出)' },
  { id: 'iron',   name: '冶坊', types: ['smith_awning', 'smithy', 'shui_pai', 'mine_entrance'], main: ['yetie'], aux: ['jiqiao'], attr: 1, seat: { base: 0, div: 1, max: 3 }, per: 1, live: true, eff: '鐵錠、農具產出' },
  { id: 'loom',   name: '織坊', types: ['loom_shop', 'shop_cloth', 'jin_fang'], main: ['fangzhi'], aux: ['shangcai'], attr: 3, seat: { base: 0, div: 1, max: 2 }, per: 1, live: true, eff: '麻布、衣物產出' },
  { id: 'trade',  name: '市令', types: ['market', 'shi_lou'], main: ['shangcai'], aux: ['jisuan', 'ciling'], attr: 4, seat: { base: 1, div: 1, max: 4 }, per: 2, live: true, eff: '市集金幣產出' },
  { id: 'study',  name: '學官', types: ['research', 'xue_she', 'xue_gong', 'jingshe', 'shop_book'], main: ['wenshu', 'jiaohua'], aux: ['tianwen'], attr: 2, seat: { base: 1, div: 1, max: 6 }, per: 3, live: true, eff: '科研速度' },
  { id: 'med',    name: '醫署', types: ['herb_garden', 'shop_herb', 'tai_yi_shu', 'yu_tang'], main: ['yishu'], aux: ['paochu'], attr: 2, seat: { base: 1, div: 1, max: 3 }, per: 1, live: false, eff: '疫病風險 −' },
  { id: 'police', name: '賊曹', types: ['xian_ya', 'notice_board', 'li_men', 'deco_watchtower', 'gate'], main: ['lvfa'], aux: ['bingshi'], attr: 0, seat: { base: 1, div: 2, max: 3 }, per: 1, live: false, eff: '治安' },
  { id: 'gov',    name: '太守', types: ['palace'], main: ['lizhi'], aux: ['jisuan'], attr: 3, seat: { base: 1, div: 99, max: 1 }, per: 1, live: false, eff: '城市升級資源 −' },
  { id: 'keep',   name: '掌櫃', types: ['tavern'], main: ['ciling'], aux: ['niangzao'], attr: 4, seat: { base: 1, div: 99, max: 1 }, per: 1, live: true, eff: '酒館收入與事件獎勵' }
];
var NPC_TYPE_POST = {};
NPC_POSTS.forEach(function (p) { p.types.forEach(function (t) { if (!NPC_TYPE_POST[t]) NPC_TYPE_POST[t] = p.id; }); });

// 宗師舞台(第 IV 階全額生效所需;PLAN_CARDS §4.13.2):每職業 = [ [建築 type 陣列(任一), 至少幾棟], … ],全部群組成立才算。無條目 = 永遠成立
var NPC_STAGE = {
  nongshi: [[['lou_che_fang', 'changping_cang'], 1]], xumu: [[['stable', 'deco_stable'], 1]], yulie: [[['fishery'], 1], [['fish_rack'], 1]],
  linmu: [[['lumber'], 3]], zhishui: [[['fan_che', 'jing_qu'], 1]], yingzao: [[['xian_ya'], 1]], yetie: [[['shui_pai'], 1]], taoci: [[['ci_yao'], 2]],
  fangzhi: [[['jin_fang'], 1]], niangzao: [[['tavern', 'shop_wine'], 1], [['shop_tea'], 1]], jiqiao: [[['fan_che'], 1]], caishi: [[['quarry'], 3]],
  zaozhi: [[['zao_zhi'], 1], [['shop_book'], 1]], shangcai: [[['shi_lou'], 1]], jisuan: [[['bank'], 1]], zhouche: [[['dock', 'post_station'], 1]],
  ciling: [[['post_station'], 1]], wenshu: [[['jingshe', 'xue_gong'], 1]], jiaohua: [[['xue_gong'], 1]], yuewu: [[['perform_ring', 'storyteller'], 1]],
  tianwen: [[['she_altar', 'hun_tian'], 1]], lvfa: [[['xian_ya'], 1]], yishu: [[['hospital', 'tai_yi_shu'], 1]], paochu: [[['shop_rice'], 1], [['tavern', 'shop_wine'], 1]],
  lizhi: [[['xian_ya'], 1]], bingshi: [[['army_camp'], 2]]
};

// 一般詞條對人事值的修正(%;PLAN_CARDS §4.4):all = 任何職司;其餘為職司 id
var NPC_TRAIT_PCT = {
  qinzheng: { all: 3 }, shusheng: { study: 5 }, tanlan: { trade: 10 }, yanfa: { all: -5 }
};

// 城內外觀:卡牌職業 id → crowdparts 的 CROWD_JOBS key
var NPC_LOOK_JOB = {
  nongshi: 'farmer', xumu: 'farmer', yulie: 'fisher', linmu: 'woodcut', zhishui: 'farmer', yingzao: 'smith', yetie: 'smith', taoci: 'smith',
  fangzhi: 'woman', niangzao: 'smith', jiqiao: 'smith', caishi: 'smith', zaozhi: 'scholar', shangcai: 'vendor', jisuan: 'official', zhouche: 'porter',
  ciling: 'official', wenshu: 'scholar', jiaohua: 'scholar', yuewu: 'artist', tianwen: 'monk', lvfa: 'guard', yishu: 'doctor', paochu: 'vendor',
  lizhi: 'official', bingshi: 'guard'
};

// ---- 台詞(職業句 26 × 3;名人專屬句尚未寫,見 PLAN_INTERIORS P4)----
var NPC_TALK_JOB = {
  nongshi: ['今年的墒情不錯,秋後有指望。', '城主,田埂邊的水渠該疏一疏了。', '種地不能急,節氣到了,苗自然長。'],
  xumu: ['牲口最認人,待牠好,牠就肯出力。', '馬房的草料夠不夠,我天天都數。', '這頭小駒日後是匹好馬。'],
  yulie: ['魚汛一到,網都不夠用。', '水邊風大,城主披件衣裳。', '今天的魚鮮,送一尾給您下酒。'],
  linmu: ['這批木料乾透了,耐用。', '砍樹要留種,山才養得起人。', '木頭的紋路會說話,順著它剖就省力。'],
  zhishui: ['渠通了,田就不怕旱。', '汛期前得把堤再夯一遍。', '井水要常淘,不然會發苦。'],
  yingzao: ['蓋房子先看地基,急不得。', '榫卯對得準,百年不鬆。', '城主要加蓋什麼,小人先量一量。'],
  yetie: ['火候差一分,鐵就脆一分。', '這爐鐵水成色真好。', '農具打得結實,農人才肯用。'],
  taoci: ['窯火不能斷,一斷就裂。', '這批陶罐釉色勻,能賣個好價。', '泥要踩熟,燒出來才不開片。'],
  fangzhi: ['這匹布經緯勻稱,您摸摸。', '蠶月忙,織機一天沒停過。', '染得好不好,日頭一曬就知道。'],
  niangzao: ['酒要養,急著喝是糟蹋了糧食。', '新釀的酒,城主嚐一口?', '水好酒才好,我們這井水正合適。'],
  jiqiao: ['翻車這東西,多一個齒輪就省兩個人。', '我再琢磨琢磨,能不能更省力。', '機巧不在花哨,在好用。'],
  caishi: ['石頭要順著層理鑿,不費力。', '這塊料子,夠砌半面牆。', '採石的人,最怕碎石滾落。'],
  zaozhi: ['紙漿要抄得勻,寫字才不洇。', '麻頭、破布,都能變成紙。', '一張好紙,比錦還難得。'],
  shangcai: ['買賣講的是信用,貨真價實。', '城主,今天的行情有點意思。', '薄利多銷,細水長流。'],
  jisuan: ['帳目我再核一遍,一文錢也不能差。', '倉裡的數字對得上,我才睡得著。', '收支要見底,心裡才有數。'],
  zhouche: ['路好走,車才跑得快。', '商隊的車軸得常上油。', '貨送得準時,客人才再來。'],
  ciling: ['話要說到對方心坎上。', '兩家的事,坐下來談總有轉圜。', '出門在外,先備三分禮數。'],
  wenshu: ['公文要寫得明白,不叫人誤會。', '這卷文書我已抄錄存檔。', '字寫端正,是對看的人的尊重。'],
  jiaohua: ['孩子肯讀書,是一城之福。', '禮義不是背的,是做的。', '今天講的這段,城主可有興趣聽聽?'],
  yuewu: ['琴要常彈,手才不生。', '新排了一支曲,想請城主指教。', '樂聲一起,人心就靜下來了。'],
  tianwen: ['昨夜星象平穩,近日無大災。', '看天吃飯,總得有人替大家看天。', '日影量過了,節氣不會錯。'],
  lvfa: ['法度立得住,百姓才安心。', '昨夜街上無事,城主放心。', '斷案要查證,不能憑一面之詞。'],
  yishu: ['天氣轉涼,多備些薑湯。', '有病早治,別拖成大病。', '這幾味藥材,庫裡還要再補。'],
  paochu: ['火不能旺,旺了菜就老。', '今天的羹,城主嚐嚐鹹淡。', '糧食要省著用,可也不能委屈了人。'],
  lizhi: ['政令傳下去,還得有人盯著辦。', '城主,這批公務我已分派下去。', '為官一任,賬要清,心要正。'],
  bingshi: ['守城先要人心齊。', '城牆今日巡了一遍,沒有鬆動。', '兵不在多,在於令行禁止。']
};
// 詞條補句:有此詞條時,台詞後面可能接一句(機率 50%,確定性由種子決定)
var NPC_TALK_TRAIT = {
  haojiu: '(說著嗅了嗅,似乎聞到哪裡有酒香。)', shanyue: '(哼起一段小調。)', haoxue: '(手裡還捏著一卷書。)', zhongyi: '(拍了拍胸口)城主有事,吩咐便是。',
  kuanhou: '(笑呵呵地看著你。)', jinshen: '(左右看了看)小心駛得萬年船。', lumang: '(嗓門大)乾就是了,想那麼多做什麼!', tanlan: '(搓了搓手)不知這活兒有沒有賞錢?',
  shusheng: '(推了推衣袖)之乎者也,小人又囉嗦了。', qinzheng: '(擦了擦汗)今日的事,我先做完再說。', fengdian: '(忽然大笑)人生得意須盡歡!',
  jiuxian: '(晃了晃酒葫蘆)來一口?', tianzhen: '(眨眨眼)城主今天心情好嗎?', chuyi: '(揚了揚手裡的勺)下回給您做拿手的。', yufu: '(望著水面)這時候最宜垂釣。'
};
var NPC_TALK_GENERIC = ['城主安好。', '今日天氣不錯。', '有事儘管吩咐。', '能為城主效力,是小人的福氣。', '城裡近來熱鬧了不少。', '小人這就去忙。'];
// 私話(親近 ≥ 3):依職業行(農/工/商/文/醫/政/武)
var NPC_TALK_PRIV = {
  '農': ['說句心裡話,跟著城主,我家那幾畝地才算種踏實了。', '要是遇上荒年,我想城主一定會想辦法的。'],
  '工': ['其實我有個老手藝,一直沒機會施展,等城裡再大些,想請城主看看。', '做工的人沒什麼大志向,就想把活兒做得讓人挑不出毛病。'],
  '商': ['做買賣的,最怕的是世道亂。城主把這裡經營得穩,我才敢進貨。', '您別看我精打細算,其實有些賬,我是願意讓著城裡人的。'],
  '文': ['不瞞城主,我少年時也想過遠遊,看遍天下的書,後來覺得守在這裡,也能寫一點東西。', '字是死的,人是活的,但能把事記下來,後人才知道我們活過。'],
  '醫': ['看了這麼多病人,才明白最難治的是窮。城主能讓大家吃飽,勝過我開十劑藥。', '我藥箱裡有張老方子,從沒給外人看過,今天讓您瞧一眼。'],
  '政': ['做官的最怕被人說閒話,可城主這裡,我敢挺直腰桿辦事。', '說實話,我原本只想混口飯吃,現在卻真想把這裡的事辦好。'],
  '武': ['我這把刀,許久沒出鞘了。能這樣平平安安,是好事。', '若有一日戰起,小人願為城主先登。']
};
// 親近滿 5 的一次性小禮(該職業行相關貨品;貨品 id 不存在時改發金幣)
var NPC_GIFT = {
  '農': { id: 'g_liang', n: 20, name: '糧食' }, '工': { id: 'g_muban', n: 6, name: '木板' }, '商': { id: 'g_yifu', n: 3, name: '衣物' },
  '文': { id: 'g_zhi', n: 3, name: '紙' }, '醫': { id: 'g_ma', n: 6, name: '麻' }, '政': { id: 'g_nongju', n: 1, name: '農具' }, '武': { id: 'mat_tieding', n: 2, name: '鐵錠' }
};

// 請託:kind 'goods' = 交出貨品;kind 'build' = 蓋出(多蓋一座)某建築。依人物主職業行選;文案 {n} 為人名
var NPC_ERRANDS = {
  '農': [{ kind: 'goods', id: 'g_liang', n: 15, text: '家裡缺糧,能勻我 15 單位糧食嗎?' }, { kind: 'build', type: 'well', text: '村口想添一口水井,能蓋一座嗎?' }],
  '工': [{ kind: 'goods', id: 'g_muban', n: 8, text: '手頭缺料,能給我 8 塊木板嗎?' }, { kind: 'build', type: 'lantern_post', text: '工坊外黑漆漆的,想請城主立一根燈籠柱。' }],
  '商': [{ kind: 'goods', id: 'g_yifu', n: 4, text: '有位客人要 4 件衣物,城裡能湊嗎?' }, { kind: 'build', type: 'stall_cloth', text: '想在市集多擺一個布攤,可以嗎?' }],
  '文': [{ kind: 'goods', id: 'g_zhi', n: 4, text: '抄書的紙用完了,可否撥我 4 張?' }, { kind: 'build', type: 'bookshelf', text: '藏書沒處放,想要一座書架。' }],
  '醫': [{ kind: 'goods', id: 'g_ma', n: 6, text: '包紮用的麻布不夠,能給 6 份麻嗎?' }, { kind: 'build', type: 'herb_garden', text: '想闢一小塊藥圃,自己種藥。' }],
  '政': [{ kind: 'goods', id: 'g_nongju', n: 1, text: '鄉里想要一件農具作示範,能撥一件嗎?' }, { kind: 'build', type: 'notice_board', text: '政令貼不出去,想立一塊告示牌。' }],
  '武': [{ kind: 'goods', id: 'mat_tieding', n: 2, text: '兵器該修了,能給 2 錠鐵嗎?' }, { kind: 'build', type: 'deco_weaponrack', text: '想添一座兵器架,讓大夥兒有地方擱傢伙。' }]
};

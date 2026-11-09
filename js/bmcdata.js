// js/bmcdata.js — 建築材料成本(BMC)資料。由 tools/gen_bmc.js 依 tools/_bmcmodel.js 的規則產生,請勿手改 BMC_COST;手動調整寫在 BMC_OVERRIDE。
// 設計:木石底價(依占地)+ 依解鎖時代疊加的貨品(木板 / 類別主料 / 類別高階料);金幣維持免費(PROG_FREE_BUILD);
// 免費(不在表內):擺設品、拖曳鋪設類、起手建築、教學必蓋、原料點只收木石。數值全部 PLACEHOLDER(數值平衡最後統一做)。
// 驗證:node tools/bmc_lint.js(四條保護規則 + 新存檔可達性)。執行層在 js/bmc.js。
// 全域名稱:BMC_ON BMC_COST BMC_OVERRIDE
var BMC_ON = true;   // 總開關;false = 完全免費(行為與沒有本功能時相同)
var BMC_COST = {   // id → { 貨品id: 數量 };木 / 石用 GOODS 的 res 貨品 id(wood / stone);表中沒有 = 免費
  archer: { wood: 30, stone: 20, mat_tieding: 2 },   // 弓箭營 B2
  army_camp: { wood: 50, stone: 40, mat_tieding: 5 },   // 軍營 B3 退階 漆器→鐵錠
  bamboo_house: { wood: 15, stone: 10, g_muban: 1 },   // 竹樓 B1
  bank: { wood: 15, stone: 10, g_muban: 1 },   // 錢莊 B2
  beacon: { wood: 15, stone: 10, mat_tieding: 1 },   // 烽燧 B2
  beehive: { wood: 5 },   // 蜂房 B2
  brewery: { wood: 15, stone: 10, g_ciqi: 1, g_muban: 1 },   // 釀酒坊 B4
  bridge: { wood: 5 },   // 橋梁 B1
  cao_cang: { wood: 15, stone: 10, g_muban: 2 },   // 漕倉 B3 退階 瓷器→木板
  cavalry: { wood: 30, stone: 20, mat_tieding: 2 },   // 騎兵營 B2
  cave_dwelling: { wood: 5 },   // 窯洞 B2
  censer: { wood: 5 },   // 博山爐 B2
  changping_cang: { wood: 15, stone: 10, g_muban: 1 },   // 常平倉 B2
  ci_yao: { wood: 15, stone: 10, g_muban: 1, mat_tieding: 1 },   // 瓷窯 B3
  cloud_ladder: { wood: 15, stone: 10, g_qiqi: 1, mat_tieding: 1 },   // 雲梯 B4
  deco_lumberyard: { wood: 15, stone: 10, g_muban: 1 },   // 伐木場(林場) B1
  deco_stable: { wood: 15, stone: 10, mat_tieding: 1 },   // 馬廄營 B2
  deco_watchtower: { wood: 15, stone: 10, g_qiqi: 1, mat_tieding: 1 },   // 望樓 B3
  di_dong: { wood: 5 },   // 地動儀 B2
  dian_shi_tai: { wood: 15, stone: 10, g_muban: 1 },   // 殿試台 B2
  dock: { wood: 5 },   // 碼頭 B1
  drill_ground: { wood: 50, stone: 40, mat_tieding: 3 },   // 練兵場 B2
  drum_tower: { wood: 15, stone: 10, g_qiqi: 1, mat_tieding: 1 },   // 鼓台 B3
  fan_che: { wood: 5 },   // 翻車 B2
  ferry: { wood: 5 },   // 渡口 B3
  field_millet: { wood: 15, stone: 10 },   // 粟田 B1
  field_wheat: { wood: 15, stone: 10 },   // 麥田(熟) B2
  fish_market: { wood: 5 },   // 魚市攤 B2
  fish_rack: { wood: 5 },   // 曬魚架 B1
  fishery: { wood: 15, stone: 10, g_muban: 1 },   // 魚場(漁棚) B1
  furnace_card: { wood: 30, stone: 20, mat_tieding: 2 },   // 卡片熔爐 B2
  gate: { wood: 15, stone: 10, g_muban: 1 },   // 城門 B1
  gate_courtyard: { wood: 5 },   // 院門 B2
  gong_men: { wood: 15, stone: 10, mat_tieding: 1 },   // 宮門 B4
  grain_drying: { wood: 5 },   // 曬穀場 B1
  granary_round: { wood: 5 },   // 陶倉 B2
  herb_garden: { wood: 5 },   // 藥圃 B2
  hitching_post: { wood: 5 },   // 拴馬樁與馬槽 B1
  house_gentry: { wood: 30, stone: 20, g_muban: 2 },   // 鄉紳宅 B2
  house_tile: { wood: 15, stone: 10, g_muban: 1 },   // 瓦頂人家 B2
  hun_tian: { wood: 15, stone: 10, g_muban: 1 },   // 渾天儀臺 B2
  hut_plank: { wood: 15, stone: 10, g_muban: 1 },   // 木板民居 B1
  incense_burner: { wood: 5 },   // 香爐 B2
  inn: { wood: 15, stone: 10, g_muban: 1 },   // 客棧 B2
  jiang_zuo: { wood: 15, stone: 10, g_qiqi: 1, mat_tieding: 1 },   // 將作監 B3
  jin_fang: { wood: 15, stone: 10, g_muban: 1, mat_tieding: 1 },   // 錦坊 B3
  jing_qu: { wood: 15, stone: 10, mat_tieding: 1 },   // 井渠 B2
  jinglan: { wood: 15, stone: 10, g_qiqi: 1, mat_tieding: 1 },   // 井闌 B4
  jingshe: { wood: 15, stone: 10, g_muban: 1 },   // 精舍 B2
  kao_chang: { wood: 30, stone: 20, g_muban: 2 },   // 考場 B2
  lantern_line: { wood: 5 },   // 燈籠串 B4
  li_men: { wood: 5 },   // 里門 B1
  livestock_pen: { wood: 15, stone: 10, g_muban: 1 },   // 牲畜交易圍欄 B2
  lograft: { wood: 5 },   // 流送木排 B1
  loom_shop: { wood: 5 },   // 織坊 B1
  lou_che_fang: { wood: 15, stone: 10, mat_tieding: 1 },   // 耬車作坊 B2
  ma_mian: { wood: 15, stone: 10, mat_tieding: 1 },   // 馬面 B3
  manor_estate: { wood: 50, stone: 40, g_ciqi: 3, g_muban: 3 },   // 莊園 B4
  mansion_clan: { wood: 50, stone: 40, g_ciqi: 3, g_muban: 3 },   // 世家宅邸 B4
  mansion_great: { wood: 50, stone: 40, g_muban: 5 },   // 豪門大院 B3 退階 瓷器→木板
  millstone: { wood: 5 },   // 石磨 B1
  mine_entrance: { wood: 15, stone: 10 },   // 礦坑口 B1
  minecart: { wood: 5 },   // 礦車 B2
  mulberry_grove: { wood: 15, stone: 10 },   // 桑園 B2
  orchard: { wood: 15, stone: 10, g_muban: 1 },   // 果園 B2
  paifang: { wood: 15, stone: 10, g_muban: 1 },   // 牌坊 B2
  parade_ground: { wood: 50, stone: 40, g_muban: 3 },   // 校場 B2 退階 鐵錠→木板
  perform_ring: { wood: 30, stone: 20, g_muban: 2 },   // 藝人圈地 B2
  plaza_center: { wood: 15, stone: 10, g_muban: 1 },   // 廣場旗杆石碑 B2
  post_station: { wood: 15, stone: 10, g_muban: 1 },   // 驛站 B2
  qi_qi_fang: { wood: 15, stone: 10, g_muban: 1, mat_tieding: 1 },   // 漆器坊 B3
  ram: { wood: 5 },   // 衝車 B4
  ramp: { wood: 5 },   // 斜坡 B1
  road_stone: { wood: 5 },   // 石板路 B1
  saltfield: { wood: 15, stone: 10, g_muban: 1 },   // 鹽田 B2
  she_altar: { wood: 15, stone: 10, g_muban: 1 },   // 里社 B1
  shed_livestock: { wood: 5 },   // 牲口棚 B1
  sheepfold: { wood: 15, stone: 10, g_muban: 1 },   // 羊圈(牧場) B2
  shi_gong_qiao: { wood: 5 },   // 石拱橋 B3
  shi_lou: { wood: 15, stone: 10, g_muban: 1 },   // 市樓 B2
  shield: { wood: 30, stone: 20, g_muban: 2 },   // 盾兵營 B1
  shipyard: { wood: 30, stone: 20, g_muban: 2 },   // 船塢(造船架) B2 退階 鐵錠→木板
  shop_book: { wood: 15, stone: 10, g_muban: 1 },   // 書肆 B2
  shop_brothel: { wood: 15, stone: 10, g_ciqi: 1, g_muban: 1 },   // 倡樓 B4
  shop_cloth: { wood: 15, stone: 10, g_muban: 1 },   // 布莊 B1
  shop_gamble: { wood: 15, stone: 10, g_muban: 2 },   // 博戲坊 B3 退階 瓷器→木板
  shop_herb: { wood: 15, stone: 10, g_muban: 1 },   // 藥舖 B2
  shop_pawn: { wood: 15, stone: 10, g_muban: 1 },   // 當鋪 B2
  shop_rice: { wood: 15, stone: 10, g_muban: 1 },   // 米舖 B2
  shop_rouge: { wood: 15, stone: 10, mat_mabu: 1 },   // 胭脂店 B2
  shop_smith: { wood: 15, stone: 10, g_qiqi: 1, mat_tieding: 1 },   // 鍛鐵鋪 B3
  shop_tea: { wood: 15, stone: 10, g_muban: 2 },   // 茶館 B3 退階 瓷器→木板
  shop_wine: { wood: 15, stone: 10, g_muban: 1 },   // 酒肆 B2
  shui_pai: { wood: 15, stone: 10, g_qiqi: 1, mat_tieding: 1 },   // 冶鐵坊(水排) B3
  siege: { wood: 30, stone: 20, g_qiqi: 1, mat_tieding: 2 },   // 器械營 B3
  small_bridge: { wood: 5 },   // 池上小橋 B1
  smith_awning: { wood: 15, stone: 10, g_muban: 1 },   // 打鐵鋪棚 B1
  smithy: { wood: 15, stone: 10, mat_tieding: 1 },   // 鐵匠營 B2
  stable: { wood: 15, stone: 10, g_muban: 1 },   // 馬房 B2
  stairs: { wood: 5 },   // 階梯 B1
  stall_book: { wood: 5 },   // 書簡攤 B1
  stall_cloth: { wood: 5 },   // 布攤 B1
  stall_fruit: { wood: 5 },   // 果攤 B1
  stall_meat: { wood: 5 },   // 肉攤 B1
  stall_pottery: { wood: 5 },   // 陶器攤 B1
  stall_rice: { wood: 5 },   // 米糧攤 B1
  stall_rouge: { wood: 5 },   // 胭脂攤 B2
  stall_tea: { wood: 5 },   // 茶水攤 B3
  stall_toy: { wood: 5 },   // 雜貨攤 B2
  stall_veg: { wood: 5 },   // 菜攤 B1
  stall_wine: { wood: 5 },   // 酒攤 B2
  storyteller: { wood: 5 },   // 說書台 B2
  tai_yi_shu: { wood: 15, stone: 10, g_muban: 1 },   // 太醫署 B2
  tavern: { wood: 15, stone: 10, g_muban: 1 },   // 招賢館 B2
  tea_garden: { wood: 15, stone: 10, g_muban: 1, g_nongju: 1 },   // 茶園 B3
  tent_general: { wood: 50, stone: 40, g_qiqi: 2, mat_tieding: 3 },   // 帥帳 B3
  tent_group: { wood: 50, stone: 40, g_qiqi: 2, mat_tieding: 3 },   // 營帳群 B3
  tent_small: { wood: 15, stone: 10, g_muban: 1 },   // 營帳(小) B1
  ting_she: { wood: 15, stone: 10, g_muban: 1 },   // 亭舍 B1
  toll_gate: { wood: 15, stone: 10, mat_tieding: 1 },   // 關津稅卡 B3
  trebuchet: { wood: 15, stone: 10, g_qiqi: 1, mat_tieding: 1 },   // 投石車 B4
  vendor_platform: { wood: 5 },   // 叫賣台 B2
  wanghuo_lou: { wood: 5 },   // 望火樓 B3
  war_chariot: { wood: 15, stone: 10, g_qiqi: 1, mat_tieding: 1 },   // 戰車 B4
  warehouse_port: { wood: 15, stone: 10, g_muban: 2 },   // 碼頭倉(貨棧) B3 退階 漆器→木板
  warship: { wood: 15, stone: 10, g_qiqi: 1, mat_tieding: 1 },   // 戰船 B4
  waterwheel: { wood: 5 },   // 水車 B2
  well_sweep: { wood: 5 },   // 桔槔 B1
  wen_shi: { wood: 15, stone: 10, g_muban: 1, g_nongju: 1 },   // 溫室菜窖 B3
  winnower: { wood: 5 },   // 風扇車 B2
  xian_ya: { wood: 30, stone: 20, g_muban: 2 },   // 縣衙 B2
  xue_gong: { wood: 30, stone: 20, g_muban: 2, g_zhi: 2 },   // 學宮 B4
  xue_she: { wood: 15, stone: 10, g_muban: 1 },   // 學舍 B2
  yin_lou: { wood: 15, stone: 10, g_muban: 2 },   // 銀樓 B3 退階 瓷器→木板
  yu_qi_fang: { wood: 15, stone: 10, g_muban: 1, mat_tieding: 1 },   // 玉器坊 B3
  yu_tang: { wood: 15, stone: 10, g_muban: 1 },   // 公共浴堂 B2
  zao_zhi: { wood: 15, stone: 10, g_muban: 1 },   // 造紙坊 B2
};
var BMC_OVERRIDE = {};   // 手動調整:{ id: { 貨品: 數量 } } 或 { id: null }(改免費);bmc.js 讀取時合併

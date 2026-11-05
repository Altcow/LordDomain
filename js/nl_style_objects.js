// nl_style_objects.js — 風格件(PLAN_ETHNIC §4:S5 塞北土坯 4 件 + S3 水鄉 5 件 + S7 西域 8 件 + S2 羌氐 8 件,共 25 件;PLAN_FANTASY 魔幻三族 S8 精靈 s8_ / S9 矮人 s9_ / S10 人類王國 s10_ 各 16 件,共 73 件)。美術用外部圖 assets/buildings/<id>_L.webp(js/ext_sprites.js 登錄);
// 缺圖 / 關閉外部圖時用「既有民居外形換色」的程式佔位(art 定義在本檔尾端,沿用 art_theme.js 的色票置換手法)。
// pack 欄位 = 城市風格主題 id(theme_skin.js:'bei' = S5 北方、'nanman' = S3 南方、'xiyu' = S7 西域、'qiang' = S2 羌氐、'elf' = S8 精靈、'dwarf' = S9 矮人、'kingdom' = S10 人類王國):只有 world.city.theme 等於 pack 時才出現在建造選單且可建;
//   其他風格(含預設漢)不顯示、不可建;已放置者不受影響(繪製與存檔都不看 pack)。解鎖:風格相符 = 起手開放(nlUnlocked 回 true)。
// 功能參數比照既有物件、成本 +10%,全部 PLACEHOLDER:小型住宅比照 民房 house;3×3 院落比照 鄉紳宅 house_gentry;4×4 大宅比照 世家宅邸 mansion_clan;白牆比照 院牆 wall_courtyard。
// 全域名稱:STYLE_OBJECTS HOUSE_LIKE houseKindOf isHouseLike objPackOk objPackThemes。外部全域一律 typeof 守衛。ES2017;不用 ?. ??

var STYLE_OBJECTS = {
  s5_yurt:       { name: '穹廬',     icon: '⛺', w: 2, h: 2, pack: 'bei',    group: 'town', like: 'house',         tpl: 'house',        tint: 'cloth1', cost: { wood: 28, stone: 11 }, prod: { coin: 0.12 }, tier: 1 },
  s5_adobe:      { name: '土坯屋',   icon: '🏚️', w: 2, h: 2, pack: 'bei',    group: 'town', like: 'house',         tpl: 'house',        tint: 'wall',   cost: { wood: 28, stone: 11 }, prod: { coin: 0.12 }, tier: 1 },
  s5_adobe_yard: { name: '土坯院',   icon: '🏡', w: 3, h: 3, pack: 'bei',    group: 'town', like: 'house_gentry',  tpl: 'house_gentry', tint: 'wall',   cost: { coin: 418 }, tier: 3 },
  s5_wubao:      { name: '塢堡大宅', icon: '🏰', w: 4, h: 4, pack: 'bei',    group: 'town', like: 'mansion_clan',  tpl: 'mansion_clan', tint: 'wall',   cost: { coin: 1650 }, tier: 4 },
  s3_stilt:      { name: '水上棚屋', icon: '🛖', w: 2, h: 2, pack: 'nanman', group: 'town', like: 'house',         tpl: 'house',        tint: 'roof',   cost: { wood: 28, stone: 11 }, prod: { coin: 0.12 }, tier: 1 },
  s3_tile:       { name: '水鄉瓦屋', icon: '🏘️', w: 2, h: 2, pack: 'nanman', group: 'town', like: 'house',         tpl: 'house',        tint: 'cloth1', cost: { wood: 28, stone: 11 }, prod: { coin: 0.12 }, tier: 1 },
  s3_riverside:  { name: '臨水宅院', icon: '🏡', w: 3, h: 3, pack: 'nanman', group: 'town', like: 'house_gentry',  tpl: 'house_gentry', tint: 'cloth1', cost: { coin: 418 }, tier: 3 },
  s3_shuixie:    { name: '水榭大宅', icon: '🏞️', w: 4, h: 4, pack: 'nanman', group: 'town', like: 'mansion_clan',  tpl: 'mansion_clan', tint: 'cloth1', cost: { coin: 1650 }, tier: 4 },
  s3_wall:       { name: '白牆',     icon: '🧱', w: 1, h: 1, pack: 'nanman', group: 'road', like: 'wall_courtyard', tpl: 'wall_courtyard', tint: 'cloth1', cost: { coin: 11 }, drag: true },
  // 西域(xiyu = S7 胡市,圖 s7_*)8 件:3 民居(2×2)+ 穹頂小廟 + 駝站大院 + 坎兒井口 + 商賈大宅 + 市集拱廊大院。功能參數 PLACEHOLDER
  s7_adobe_flat: { name: '土坯平頂屋', icon: '🏠', w: 2, h: 2, pack: 'xiyu', group: 'town', like: 'house',        tpl: 'house',        tint: 'wall',   cost: { wood: 28, stone: 11 }, prod: { coin: 0.12 }, tier: 1 },
  s7_vault:      { name: '拱頂屋',   icon: '🏚️', w: 2, h: 2, pack: 'xiyu', group: 'town', like: 'house',        tpl: 'house',        tint: 'trim',   cost: { wood: 28, stone: 11 }, prod: { coin: 0.12 }, tier: 1 },
  s7_oasis_tent: { name: '綠洲彩帳', icon: '⛺', w: 2, h: 2, pack: 'xiyu', group: 'town', like: 'house',        tpl: 'house',        tint: 'cloth2', cost: { wood: 28, stone: 11 }, prod: { coin: 0.12 }, tier: 1 },
  s7_dome_shrine: { name: '穹頂小廟', icon: '🕌', w: 2, h: 2, pack: 'xiyu', group: 'rite', tpl: 'ting_she',     tint: 'cloth1', cost: { coin: 150 } },
  s7_camel_yard: { name: '駝站大院', icon: '🐪', w: 3, h: 3, pack: 'xiyu', group: 'shop', tpl: 'house_gentry', tint: 'wall',   cost: { coin: 330 }, prod: { coin: 0.35 } },
  s7_karez:      { name: '坎兒井口', icon: '💧', w: 2, h: 2, pack: 'xiyu', group: 'farm', tpl: 'ting_she',     tint: 'wall',   cost: { coin: 160 } },
  s7_merchant_mansion: { name: '綠洲商賈大宅', icon: '🏛️', w: 4, h: 4, pack: 'xiyu', group: 'town', like: 'mansion_clan', tpl: 'mansion_clan', tint: 'cloth1', cost: { coin: 1650 }, tier: 4 },
  s7_bazaar_arcade: { name: '市集拱廊大院', icon: '🛍️', w: 4, h: 4, pack: 'xiyu', group: 'shop', tpl: 'mansion_clan', tint: 'wall', cost: { coin: 1300 }, prod: { coin: 0.9 } },
  // 羌氐(qiang = S2 石砌,圖 s2_*)8 件:3 民居(2×2)+ 石砌碉樓 + 石院 + 牲畜圍欄 + 寨堡大宅 + 白氈大帳院。功能參數 PLACEHOLDER
  s2_stone_house: { name: '石砌碉房', icon: '🪨', w: 2, h: 2, pack: 'qiang', group: 'town', like: 'house',       tpl: 'house',        tint: 'wall',   cost: { wood: 28, stone: 11 }, prod: { coin: 0.12 }, tier: 1 },
  s2_felt_tent:  { name: '白氈黑邊帳', icon: '⛺', w: 2, h: 2, pack: 'qiang', group: 'town', like: 'house',       tpl: 'house',        tint: 'cloth1', cost: { wood: 28, stone: 11 }, prod: { coin: 0.12 }, tier: 1 },
  s2_terrace:    { name: '依山梯屋', icon: '🏔️', w: 2, h: 2, pack: 'qiang', group: 'town', like: 'house',       tpl: 'house',        tint: 'leather', cost: { wood: 28, stone: 11 }, prod: { coin: 0.12 }, tier: 1 },
  s2_stone_tower: { name: '石砌碉樓', icon: '🗼', w: 2, h: 2, pack: 'qiang', group: 'town', tpl: 'ting_she',     tint: 'wall',   cost: { coin: 140 } },
  s2_stone_yard: { name: '石院',     icon: '🏡', w: 3, h: 3, pack: 'qiang', group: 'town', like: 'house_gentry', tpl: 'house_gentry', tint: 'wall',   cost: { coin: 418 }, tier: 3 },
  s2_pen:        { name: '牲畜圍欄', icon: '🐑', w: 2, h: 2, pack: 'qiang', group: 'farm', tpl: 'sheepfold',    tint: 'wall',   cost: { coin: 90 } },
  s2_zhai_manor: { name: '寨堡大宅', icon: '🏰', w: 4, h: 4, pack: 'qiang', group: 'town', like: 'mansion_clan', tpl: 'mansion_clan', tint: 'wall',   cost: { coin: 1650 }, tier: 4 },
  s2_felt_camp:  { name: '白氈大帳院', icon: '🏕️', w: 4, h: 4, pack: 'qiang', group: 'shop', tpl: 'mansion_clan', tint: 'cloth1', cost: { coin: 1000 }, prod: { coin: 0.7 } },
  // 魔幻三族(PLAN_FANTASY,圖 s8_/s9_/s10_,pack = elf / dwarf / kingdom)各 16 件:住宅 4(HOUSE_LIKE)+ 公共 / 經濟 / 生產 / 軍事 + 大型地標 1(5×5,max 1)。功能參數 PLACEHOLDER;cat = 手動歸類(未寫走自動判定)
  // 精靈 · 世界樹森林 s8_(pack elf)
  s8_treehouse: { name: '樹屋', icon: '🌳', w: 2, h: 2, pack: 'elf', group: 'town', like: 'house', tpl: 'house', tint: 'cloth1', cost: { wood: 28, stone: 11 }, prod: { coin: 0.12 }, tier: 1 },
  s8_rootden: { name: '根穴屋', icon: '🪵', w: 2, h: 2, pack: 'elf', group: 'town', like: 'house', tpl: 'house', tint: 'leather', cost: { wood: 28, stone: 11 }, prod: { coin: 0.12 }, tier: 1 },
  s8_spring_well: { name: '清泉石盆', icon: '⛲', w: 2, h: 2, pack: 'elf', group: 'live', tpl: 'ting_she', tint: 'cloth2', cost: { coin: 120 }, cat: 'eco' },
  s8_song_pavilion: { name: '歌者亭', icon: '🎶', w: 2, h: 2, pack: 'elf', group: 'rite', tpl: 'ting_she', tint: 'cloth1', cost: { coin: 150 }, cat: 'eco' },
  s8_archer_platform: { name: '守林人哨台', icon: '🏹', w: 2, h: 2, pack: 'elf', group: 'mil', tpl: 'ting_she', tint: 'wall', cost: { coin: 220 }, cat: 'eco' },
  s8_seed_store: { name: '種子倉', icon: '🌰', w: 2, h: 2, pack: 'elf', group: 'ind', tpl: 'ting_she', tint: 'trim', cost: { coin: 160 }, cat: 'eco' },
  s8_herb_garden: { name: '藥草圃屋', icon: '🌿', w: 2, h: 2, pack: 'elf', group: 'farm', tpl: 'ting_she', tint: 'cloth1', cost: { coin: 180 }, prod: { coin: 0.2 } },
  s8_woodcraft: { name: '倒木工坊', icon: '🪓', w: 2, h: 2, pack: 'elf', group: 'ind', tpl: 'house', tint: 'leather', cost: { coin: 66, stone: 17 }, prod: { wood: 0.1 } },
  s8_canopy_hall: { name: '樹冠宅院', icon: '🏡', w: 3, h: 3, pack: 'elf', group: 'town', like: 'house_gentry', tpl: 'house_gentry', tint: 'cloth1', cost: { coin: 418 }, tier: 3 },
  s8_loom_bower: { name: '藤架織坊', icon: '🧵', w: 3, h: 3, pack: 'elf', group: 'ind', tpl: 'house_gentry', tint: 'cloth2', cost: { coin: 330 }, prod: { coin: 0.35 } },
  s8_bark_market: { name: '樹蔭市集', icon: '🛍️', w: 3, h: 3, pack: 'elf', group: 'shop', tpl: 'house_gentry', tint: 'cloth1', cost: { coin: 330 }, prod: { coin: 0.35 } },
  s8_lore_hall: { name: '林語書閣', icon: '📚', w: 3, h: 3, pack: 'elf', group: 'rite', tpl: 'house_gentry', tint: 'wall', cost: { coin: 400 }, cat: 'eco' },
  s8_moon_manor: { name: '月光大宅', icon: '🌙', w: 4, h: 4, pack: 'elf', group: 'town', like: 'mansion_clan', tpl: 'mansion_clan', tint: 'wall', cost: { coin: 1650 }, tier: 4 },
  s8_council_ring: { name: '長老議環', icon: '⭕', w: 4, h: 4, pack: 'elf', group: 'town', tpl: 'mansion_clan', tint: 'trim', cost: { coin: 1000 }, cat: 'eco' },
  s8_world_tree: { name: '世界樹', icon: '🌲', w: 5, h: 5, pack: 'elf', group: 'town', tpl: 'manor_estate', tint: 'cloth1', cost: { coin: 4000 }, max: 1, cat: 'eco' },
  s8_moon_shrine: { name: '月光聖壇', icon: '🌙', w: 4, h: 4, pack: 'elf', group: 'rite', tpl: 'mansion_clan', tint: 'cloth2', cost: { coin: 1000 }, cat: 'eco' },
  // 矮人 · 鋼鐵礦城 s9_(pack dwarf)
  s9_rock_house: { name: '嵌岩石屋', icon: '🪨', w: 2, h: 2, pack: 'dwarf', group: 'town', like: 'house', tpl: 'house', tint: 'wall', cost: { wood: 28, stone: 11 }, prod: { coin: 0.12 }, tier: 1 },
  s9_chimney_house: { name: '煙囪石屋', icon: '🏠', w: 2, h: 2, pack: 'dwarf', group: 'town', like: 'house', tpl: 'house', tint: 'trim', cost: { wood: 28, stone: 11 }, prod: { coin: 0.12 }, tier: 1 },
  s9_mine_shaft: { name: '礦坑井架', icon: '⛏️', w: 2, h: 2, pack: 'dwarf', group: 'ind', tpl: 'ting_she', tint: 'leather', cost: { coin: 220 }, prod: { stone: 0.1 } },
  s9_anvil_smithy: { name: '鐵砧工坊', icon: '🔨', w: 2, h: 2, pack: 'dwarf', group: 'ind', tpl: 'house', tint: 'cloth2', cost: { coin: 220 }, prod: { coin: 0.2 } },
  s9_mushroom_cellar: { name: '蘑菇窖田', icon: '🍄', w: 2, h: 2, pack: 'dwarf', group: 'farm', tpl: 'ting_she', tint: 'cloth1', cost: { coin: 180 }, prod: { coin: 0.12 } },
  s9_brewery: { name: '麥酒坊', icon: '🍺', w: 2, h: 2, pack: 'dwarf', group: 'shop', tpl: 'house', tint: 'trim', cost: { coin: 220 }, prod: { coin: 0.2 } },
  s9_stone_guard: { name: '石衛哨塔', icon: '🗼', w: 2, h: 2, pack: 'dwarf', group: 'mil', tpl: 'ting_she', tint: 'wall', cost: { coin: 220 }, cat: 'eco' },
  s9_gear_mill: { name: '齒輪碾坊', icon: '⚙️', w: 2, h: 2, pack: 'dwarf', group: 'ind', tpl: 'house', tint: 'cloth2', cost: { coin: 200 }, prod: { coin: 0.15 } },
  s9_clan_yard: { name: '氏族石院', icon: '🏡', w: 3, h: 3, pack: 'dwarf', group: 'town', like: 'house_gentry', tpl: 'house_gentry', tint: 'wall', cost: { coin: 418 }, tier: 3 },
  s9_smelter: { name: '冶煉爐', icon: '🔥', w: 3, h: 3, pack: 'dwarf', group: 'ind', tpl: 'house_gentry', tint: 'trim', cost: { coin: 330 }, prod: { coin: 0.35 } },
  s9_vault_store: { name: '石窖倉庫', icon: '📦', w: 3, h: 3, pack: 'dwarf', group: 'ind', tpl: 'house_gentry', tint: 'leather', cost: { coin: 330 }, cat: 'eco' },
  s9_trade_hall: { name: '石廊交易所', icon: '⚖️', w: 3, h: 3, pack: 'dwarf', group: 'shop', tpl: 'house_gentry', tint: 'wall', cost: { coin: 330 }, prod: { coin: 0.35 } },
  s9_hall_manor: { name: '山廳大宅', icon: '🏛️', w: 4, h: 4, pack: 'dwarf', group: 'town', like: 'mansion_clan', tpl: 'mansion_clan', tint: 'wall', cost: { coin: 1650 }, tier: 4 },
  s9_gate_keep: { name: '鐵閘山門堡', icon: '🏰', w: 4, h: 4, pack: 'dwarf', group: 'mil', tpl: 'mansion_clan', tint: 'cloth2', cost: { coin: 1300 }, cat: 'eco' },
  s9_great_forge: { name: '大熔爐殿', icon: '🔥', w: 5, h: 5, pack: 'dwarf', group: 'town', tpl: 'manor_estate', tint: 'trim', cost: { coin: 4000 }, max: 1, cat: 'eco' },
  s9_ancestor_hall: { name: '先祖石廳', icon: '🏛️', w: 4, h: 4, pack: 'dwarf', group: 'rite', tpl: 'mansion_clan', tint: 'leather', cost: { coin: 1000 }, cat: 'eco' },
  // 人類 · 王國城堡 s10_(pack kingdom;前綴判斷一律寫完整 /^s10_/,不可用 /^s1/)
  s10_cottage: { name: '茅頂木骨屋', icon: '🛖', w: 2, h: 2, pack: 'kingdom', group: 'town', like: 'house', tpl: 'house', tint: 'cloth1', cost: { wood: 28, stone: 11 }, prod: { coin: 0.12 }, tier: 1 },
  s10_townhouse: { name: '石底木樓', icon: '🏘️', w: 2, h: 2, pack: 'kingdom', group: 'town', like: 'house', tpl: 'house', tint: 'roof', cost: { wood: 28, stone: 11 }, prod: { coin: 0.12 }, tier: 1 },
  s10_windmill: { name: '風車磨坊', icon: '🌾', w: 2, h: 2, pack: 'kingdom', group: 'farm', tpl: 'ting_she', tint: 'cloth1', cost: { coin: 200 }, prod: { coin: 0.12 } },
  s10_blacksmith: { name: '鐵匠鋪', icon: '🔨', w: 2, h: 2, pack: 'kingdom', group: 'ind', tpl: 'house', tint: 'leather', cost: { coin: 220 }, prod: { coin: 0.2 } },
  s10_tavern: { name: '旅店酒館', icon: '🍺', w: 2, h: 2, pack: 'kingdom', group: 'shop', tpl: 'house', tint: 'trim', cost: { coin: 220 }, prod: { coin: 0.2 } },
  s10_watchtower: { name: '圓塔哨樓', icon: '🗼', w: 2, h: 2, pack: 'kingdom', group: 'mil', tpl: 'ting_she', tint: 'wall', cost: { coin: 220 }, cat: 'eco' },
  s10_granary: { name: '石穀倉', icon: '🌾', w: 2, h: 2, pack: 'kingdom', group: 'ind', tpl: 'house', tint: 'wall', cost: { coin: 160 }, cat: 'eco' },
  s10_banner_stand: { name: '王國旗台', icon: '🚩', w: 2, h: 2, pack: 'kingdom', group: 'garden', tpl: 'ting_she', tint: 'cloth2', cost: { coin: 60 }, cat: 'deco' },
  s10_guild_house: { name: '商人宅院', icon: '🏡', w: 3, h: 3, pack: 'kingdom', group: 'town', like: 'house_gentry', tpl: 'house_gentry', tint: 'cloth1', cost: { coin: 418 }, tier: 3 },
  s10_market_row: { name: '市集街廊', icon: '🛍️', w: 3, h: 3, pack: 'kingdom', group: 'shop', tpl: 'house_gentry', tint: 'cloth2', cost: { coin: 330 }, prod: { coin: 0.35 } },
  s10_knight_barracks: { name: '騎士營', icon: '🐎', w: 3, h: 3, pack: 'kingdom', group: 'mil', tpl: 'house_gentry', tint: 'roof', cost: { coin: 600 }, cat: 'eco' },
  s10_gatehouse: { name: '吊橋門樓', icon: '🏰', w: 3, h: 3, pack: 'kingdom', group: 'mil', tpl: 'house_gentry', tint: 'wall', cost: { coin: 500 }, cat: 'eco' },
  s10_manor: { name: '騎士莊園', icon: '🏛️', w: 4, h: 4, pack: 'kingdom', group: 'town', like: 'mansion_clan', tpl: 'mansion_clan', tint: 'roof', cost: { coin: 1650 }, tier: 4 },
  s10_town_hall: { name: '鎮議事廳', icon: '🏛️', w: 4, h: 4, pack: 'kingdom', group: 'town', tpl: 'mansion_clan', tint: 'cloth2', cost: { coin: 1000 }, cat: 'eco' },
  s10_castle_keep: { name: '王國城堡主堡', icon: '🏰', w: 5, h: 5, pack: 'kingdom', group: 'town', tpl: 'manor_estate', tint: 'wall', cost: { coin: 4000 }, max: 1, cat: 'eco' },
  s10_chapel: { name: '大聖堂', icon: '⛪', w: 4, h: 4, pack: 'kingdom', group: 'rite', tpl: 'mansion_clan', tint: 'roof', cost: { coin: 1000 }, cat: 'eco' }
};

// 風格住宅 → 既有住宅的對照(單一來源):居民目的地 / 住房容量 / 入住率 / 民房數量上限 / 繁榮度住房項 / 引導鏈民居數 都經此視同對應住宅。
// 2×2 小宅視同 house(民房);3×3 院落視同 house_gentry(鄉紳宅);4×4 大宅視同 mansion_clan(世家宅邸)。西域 / 羌氐的功能件(小廟、駝站、坎兒井、碉樓、圍欄、拱廊大院、氈帳院)不在此表。其餘 type 一律回傳自己。
var HOUSE_LIKE = {
  s5_yurt: 'house', s5_adobe: 'house', s3_stilt: 'house', s3_tile: 'house',
  s5_adobe_yard: 'house_gentry', s3_riverside: 'house_gentry',
  s5_wubao: 'mansion_clan', s3_shuixie: 'mansion_clan',
  s7_adobe_flat: 'house', s7_vault: 'house', s7_oasis_tent: 'house', s2_stone_house: 'house', s2_felt_tent: 'house', s2_terrace: 'house',
  s2_stone_yard: 'house_gentry',
  s7_merchant_mansion: 'mansion_clan', s2_zhai_manor: 'mansion_clan',
  // 魔幻三族:每族 2 小宅 + 1 院落 + 1 大宅
  s8_treehouse: 'house', s8_rootden: 'house', s8_canopy_hall: 'house_gentry', s8_moon_manor: 'mansion_clan',
  s9_rock_house: 'house', s9_chimney_house: 'house', s9_clan_yard: 'house_gentry', s9_hall_manor: 'mansion_clan',
  s10_cottage: 'house', s10_townhouse: 'house', s10_guild_house: 'house_gentry', s10_manor: 'mansion_clan'
};
function houseKindOf(type) { return Object.prototype.hasOwnProperty.call(HOUSE_LIKE, type) ? HOUSE_LIKE[type] : type; }
// 是否視同民房 house(含 house 本身);原本只認 type === 'house' 的判斷都改用這個
function isHouseLike(type) { return houseKindOf(type) === 'house'; }
// 民居戶數表(cityfx_data.js 的 CITYFX_HOUSES,供 cityfx / 顧問 / 引導鏈共用):風格住宅沿用對應住宅的權重
if (typeof CITYFX_HOUSES !== 'undefined') {
  Object.keys(HOUSE_LIKE).forEach(function (id) { if (CITYFX_HOUSES[HOUSE_LIKE[id]] && !CITYFX_HOUSES[id]) CITYFX_HOUSES[id] = CITYFX_HOUSES[HOUSE_LIKE[id]]; });
}

// 物件是否符合目前城市風格:無 pack 的一律 true;有 pack 者須 themeGet() === pack。theme_skin.js 未載入時視為漢風格(不符)。
function objPackOk(type) {
  var d = (typeof OBJECTS !== 'undefined') ? OBJECTS[type] : null;
  if (!d || !d.pack) return true;
  return (typeof themeGet === 'function' ? themeGet() : 'han') === d.pack;
}
function objPackThemes() {
  var out = {}, k;
  for (k in STYLE_OBJECTS) out[STYLE_OBJECTS[k].pack] = true;
  return Object.keys(out);
}

(function () {
  if (typeof OBJECTS === 'undefined') return;
  Object.keys(STYLE_OBJECTS).forEach(function (id) {
    var s = STYLE_OBJECTS[id], o;
    if (OBJECTS[id]) return;
    o = { name: s.name, icon: s.icon, w: s.w, h: s.h, cost: s.cost, side: 'estate', nl: true, pack: s.pack, on: [T_GRASS] };
    if (s.drag) { o.drag = true; o.on = [T_GRASS, T_ROAD]; }
    if (s.prod) o.prod = s.prod;
    if (s.tier !== undefined) o.tier = s.tier;
    if (s.max) o.max = s.max;   // 地標限 1 座(魔幻三族 5×5)
    if (s.w !== s.h) o.swap = true;
    OBJECTS[id] = o;
  });
  if (typeof BUILD_GROUPS !== 'undefined') {
    Object.keys(STYLE_OBJECTS).forEach(function (id) {
      var g = BUILD_GROUPS.find(function (x) { return x.id === STYLE_OBJECTS[id].group; });
      if (g && g.items.indexOf(id) < 0) g.items.push(id);
    });
  }
  if (typeof OBJ_CAT_OVERRIDE !== 'undefined') {
    OBJ_CAT_OVERRIDE.s3_wall = 'deco';   // 純外觀白牆 → 擺設品(住宅類由 tier 自動歸經濟建築)
    OBJ_CAT_OVERRIDE.s2_pen = 'deco';    // 牲畜圍欄:景觀擺設
    Object.keys(STYLE_OBJECTS).forEach(function (id) { if (STYLE_OBJECTS[id].cat) OBJ_CAT_OVERRIDE[id] = STYLE_OBJECTS[id].cat; });   // 魔幻三族公共 / 軍事 / 地標歸 eco,旗台歸 deco
    OBJ_CAT_OVERRIDE.s7_dome_shrine = OBJ_CAT_OVERRIDE.s7_karez = OBJ_CAT_OVERRIDE.s2_stone_tower = 'eco';   // 公共設施(同亭舍 / 望火樓,尚未登錄 CITY_FX,先人工歸類)
  }
})();

// 程式佔位美術:複製既有外形(同佔地)並以風格色票偏色;外部圖載入後由 ext_sprites.js 取代
(function (A) {
  if (!A || !A.OBJ || typeof THEME_SKINS === 'undefined') return;
  Object.keys(STYLE_OBJECTS).forEach(function (id) {
    var s = STYLE_OBJECTS[id], base = A.OBJ[s.tpl], spec = {}, p, pal;
    if (!base || typeof base.build !== 'function' || A.OBJ[id]) return;
    pal = THEME_SKINS[s.pack].pal;
    for (p in base) if (Object.prototype.hasOwnProperty.call(base, p)) spec[p] = base[p];
    spec.build = function (m, v) {
      base.build(m, v);
      m.custom(0, 0, base.w, base.d, 0, function (ctx) {
        ctx.save(); ctx.globalCompositeOperation = 'source-atop'; ctx.globalAlpha = 0.4;
        ctx.fillStyle = pal[s.tint] || pal.wall; ctx.fillRect(-400, -400, 800, 800); ctx.restore();
      }, 999);
    };
    A.def(id, spec);
  });
})(typeof ART !== 'undefined' ? ART : null);
if (typeof module !== 'undefined' && module.exports) module.exports = { STYLE_OBJECTS, HOUSE_LIKE, houseKindOf, isHouseLike };

// js/ld_art.js — 新介面骨架素材登記檔(設計_介面骨架實作計畫.md §4)。前綴 ldArt / LD_ART。
// 素材放 assets/ui2/(webp);圖到之後:檔案丟進 assets/ui2/,把該筆 has:false 改 true(一個字)。2026-11-14 接圖:已畫的鍵 has:true,圖集欄列 / 實際尺寸以現檔為準;nav_* / eq_* 已接(eq_* 為暫用剪影)。has:false 時不發任何網路請求,只畫 CSS 佔位(漢字徽章)。
// 條目:{ f:檔名, w, h:原圖尺寸, has:是否已有圖, ph:佔位漢字, cell?:[欄,列,總欄,總列], ar?:一格寬高比 };有 cell = 圖集(sprite sheet)中的一格。
// 純資料 + 建元素函式;不碰存檔。ES2017,不用 ?. ??。
var LD_ART_DIR = 'assets/ui2/';
var LD_ART = {
  // 背景(已接圖;w、h 為實際檔案尺寸)
  bg_home2_port: { f: 'bg_home2_port.webp', w: 941, h: 1672, has: true, ph: '' },
  bg_home2_land: { f: 'bg_home2_land.webp', w: 1672, h: 941, has: true, ph: '' },
  bg_tower: { f: 'bg_tower.webp', w: 1024, h: 683, has: true, ph: '塔' },
  bg_team_port: { f: 'bg_team_port.webp', w: 720, h: 1279, has: true, ph: '' },
  bg_team_land: { f: 'bg_team_land.webp', w: 1024, h: 572, has: true, ph: '' },
  // 場景(他家 AI 場景,已裁成 3:2;給建築室內 / 活動頁用,目前尚無頁面讀取)
  sc_tavern: { f: 'sc_tavern.webp', w: 1024, h: 683, has: true, ph: '' },
  sc_camp: { f: 'sc_camp.webp', w: 1024, h: 683, has: true, ph: '' },
  sc_gate: { f: 'sc_gate.webp', w: 1024, h: 683, has: true, ph: '' },
  sc_yard: { f: 'sc_yard.webp', w: 1024, h: 683, has: true, ph: '' },
  // 九宮格 / 零件單檔;nine = 九宮格四邊 inset [上,右,下,左](單位:該檔像素),CSS border-image-slice 要與此一致
  u3_plaque: { f: 'u3_plaque.webp', w: 480, h: 225, has: true, ph: '', nine: [44,40,42,40] },
  u3_namecard: { f: 'u3_namecard.webp', w: 512, h: 196, has: true, ph: '' },
  u3_tip: { f: 'u3_tip.webp', w: 512, h: 195, has: true, ph: '', nine: [40,90,45,70] },
  u3_quest: { f: 'u3_quest.webp', w: 640, h: 294, has: true, ph: '', nine: [70,76,56,76] },
  u3_dock: { f: 'u3_dock.webp', w: 640, h: 133, has: true, ph: '' },
  // U2 補圖(2x2 圖集):吊牌、紅章框 2 款、紅點
  u2_tag: { f: 'u2_parts.webp', w: 512, h: 512, has: true, ph: '', cell: [0, 0, 2, 2] },
  u2_frame1: { f: 'u2_parts.webp', w: 512, h: 512, has: true, ph: '', cell: [1, 0, 2, 2] },
  u2_frame2: { f: 'u2_parts.webp', w: 512, h: 512, has: true, ph: '', cell: [0, 1, 2, 2] },
  u2_dot: { f: 'u2_parts.webp', w: 512, h: 512, has: true, ph: '', cell: [1, 1, 2, 2] },
  // 百層塔樓層零件(單檔)
  tw_floor: { f: 'tw_floor.webp', w: 512, h: 143, has: true, ph: '塔' },
  tw_boss: { f: 'tw_boss.webp', w: 512, h: 149, has: true, ph: '塔' },
  tw_top: { f: 'tw_top.webp', w: 256, h: 177, has: true, ph: '塔' },
  tw_base: { f: 'tw_base.webp', w: 384, h: 105, has: true, ph: '塔' },
  tw_check: { f: 'tw_check.webp', w: 128, h: 105, has: true, ph: '塔' },
  // ic_bld(4x4 圖集,192/格):9 座建築 + 站位 + 招募 + 數據
  bld_shu: { f: 'ic_bld.webp', w: 768, h: 768, has: true, ph: '書', cell: [0, 0, 4, 4] },
  bld_fu: { f: 'ic_bld.webp', w: 768, h: 768, has: true, ph: '府', cell: [1, 0, 4, 4] },
  bld_ta: { f: 'ic_bld.webp', w: 768, h: 768, has: true, ph: '塔', cell: [2, 0, 4, 4] },
  bld_tai: { f: 'ic_bld.webp', w: 768, h: 768, has: true, ph: '台', cell: [3, 0, 4, 4] },
  bld_zhao: { f: 'ic_bld.webp', w: 768, h: 768, has: true, ph: '館', cell: [0, 1, 4, 4] },
  bld_ying: { f: 'ic_bld.webp', w: 768, h: 768, has: true, ph: '營', cell: [1, 1, 4, 4] },
  bld_fang: { f: 'ic_bld.webp', w: 768, h: 768, has: true, ph: '坊', cell: [2, 1, 4, 4] },
  bld_chang: { f: 'ic_bld.webp', w: 768, h: 768, has: true, ph: '場', cell: [3, 1, 4, 4] },
  bld_men: { f: 'ic_bld.webp', w: 768, h: 768, has: true, ph: '門', cell: [0, 2, 4, 4] },
  pos_van: { f: 'ic_bld.webp', w: 768, h: 768, has: true, ph: '鋒', cell: [1, 2, 4, 4] },
  pos_mid: { f: 'ic_bld.webp', w: 768, h: 768, has: true, ph: '中', cell: [2, 2, 4, 4] },
  pos_camp: { f: 'ic_bld.webp', w: 768, h: 768, has: true, ph: '營', cell: [3, 2, 4, 4] },
  pos_flag: { f: 'ic_bld.webp', w: 768, h: 768, has: true, ph: '帥', cell: [3, 2, 4, 4] },
  nav_recruit: { f: 'ic_bld.webp', w: 768, h: 768, has: true, ph: '募', cell: [0, 3, 4, 4] },
  ic_data: { f: 'ic_bld.webp', w: 768, h: 768, has: true, ph: '數', cell: [1, 3, 4, 4] },
  // 底列 + 任務 + 活動(圖還沒畫,仍用 CSS 佔位)
  nav_cards: { f: 'ic_nav.webp', w: 768, h: 768, has: true, ph: '卡', cell: [0, 0, 4, 4] },
  nav_bag: { f: 'ic_nav.webp', w: 768, h: 768, has: true, ph: '包', cell: [1, 0, 4, 4] },
  nav_event: { f: 'ic_nav.webp', w: 768, h: 768, has: true, ph: '活', cell: [2, 1, 4, 4] },
  nav_log: { f: 'ic_nav.webp', w: 768, h: 768, has: true, ph: '報', cell: [3, 0, 4, 4] },
  nav_set: { f: 'ic_nav.webp', w: 768, h: 768, has: true, ph: '設', cell: [0, 1, 4, 4] },
  nav_quest: { f: 'ic_nav.webp', w: 768, h: 768, has: true, ph: '任', cell: [2, 0, 4, 4] },
  // U4 圓鈕 / 六角鈕 / 技能槽(3x2 圖集,192/格)
  btn_gold: { f: 'u4_btn.webp', w: 576, h: 384, has: true, ph: '', cell: [0, 0, 3, 2] },
  btn_green: { f: 'u4_btn.webp', w: 576, h: 384, has: true, ph: '', cell: [1, 0, 3, 2] },
  btn_close: { f: 'u4_btn.webp', w: 576, h: 384, has: true, ph: '', cell: [2, 0, 3, 2] },
  hex_gold: { f: 'u4_btn.webp', w: 576, h: 384, has: true, ph: '', cell: [0, 1, 3, 2] },
  hex_bronze: { f: 'u4_btn.webp', w: 576, h: 384, has: true, ph: '', cell: [1, 1, 3, 2] },
  slot_frame: { f: 'u4_btn.webp', w: 576, h: 384, has: true, ph: '', cell: [2, 1, 3, 2] },
  // ic_stat(4x4 圖集,192/格):6 數值 + 4 書籤(屬性/戰法/傳記/傳承)+ 排序 / 篩選 / 羈絆 / 相剋 / 升星
  st_tong: { f: 'ic_stat.webp', w: 768, h: 768, has: true, ph: '統', cell: [0, 0, 4, 4] },
  st_wu: { f: 'ic_stat.webp', w: 768, h: 768, has: true, ph: '武', cell: [1, 0, 4, 4] },
  st_zhi: { f: 'ic_stat.webp', w: 768, h: 768, has: true, ph: '智', cell: [2, 0, 4, 4] },
  st_zheng: { f: 'ic_stat.webp', w: 768, h: 768, has: true, ph: '政', cell: [3, 0, 4, 4] },
  st_mei: { f: 'ic_stat.webp', w: 768, h: 768, has: true, ph: '魅', cell: [0, 1, 4, 4] },
  st_pow: { f: 'ic_stat.webp', w: 768, h: 768, has: true, ph: '戰', cell: [1, 1, 4, 4] },
  hd_attr: { f: 'ic_stat.webp', w: 768, h: 768, has: true, ph: '屬', cell: [2, 1, 4, 4] },
  hd_skill: { f: 'ic_stat.webp', w: 768, h: 768, has: true, ph: '法', cell: [3, 1, 4, 4] },
  hd_bio: { f: 'ic_stat.webp', w: 768, h: 768, has: true, ph: '傳', cell: [0, 2, 4, 4] },
  hd_inh: { f: 'ic_stat.webp', w: 768, h: 768, has: true, ph: '承', cell: [1, 2, 4, 4] },
  ic_sort: { f: 'ic_stat.webp', w: 768, h: 768, has: true, ph: '序', cell: [2, 2, 4, 4] },
  ic_troop: { f: 'ic_stat.webp', w: 768, h: 768, has: true, ph: '兵', cell: [3, 2, 4, 4] },
  ic_fac: { f: 'ic_stat.webp', w: 768, h: 768, has: true, ph: '陣', cell: [0, 3, 4, 4] },
  ic_bond: { f: 'ic_stat.webp', w: 768, h: 768, has: true, ph: '羈', cell: [1, 3, 4, 4] },
  ic_counter: { f: 'ic_stat.webp', w: 768, h: 768, has: true, ph: '剋', cell: [2, 3, 4, 4] },
  ic_starup: { f: 'ic_stat.webp', w: 768, h: 768, has: true, ph: '星', cell: [3, 3, 4, 4] },
  // 裝備空格輪廓(圖還沒畫;eqi_* 是 I3 的裝備物品圖,不是空格輪廓,未接到 eq_*)
  eq_weapon: { f: 'eq_slot.webp', w: 768, h: 192, has: true, ph: '武', cell: [0, 0, 4, 1] },
  eq_armor: { f: 'eq_slot.webp', w: 768, h: 192, has: true, ph: '甲', cell: [1, 0, 4, 1] },
  eq_horse: { f: 'eq_slot.webp', w: 768, h: 192, has: true, ph: '馬', cell: [2, 0, 4, 1] },
  eq_treasure: { f: 'eq_slot.webp', w: 768, h: 192, has: true, ph: '寶', cell: [3, 0, 4, 1] },
  // 裝備 / 尋訪 演出素材(js/ld_equip_ui.js、ld_hunt_ui.js;圖未畫,has:false 走 CSS 佔位;圖到後只改 has):馬亮相 4 匹(白藍紫金,1x4 橫排)、鍛造坊 / 書院場景、鐵匠(正常 / 哭)、書院主持人、馬場柵門(關 / 撞開)
  eqh_1: { f: 'eq_horses.webp', w: 1024, h: 256, has: true, ph: '馬', cell: [0, 0, 4, 1] },
  eqh_2: { f: 'eq_horses.webp', w: 1024, h: 256, has: true, ph: '馬', cell: [1, 0, 4, 1] },
  eqh_3: { f: 'eq_horses.webp', w: 1024, h: 256, has: true, ph: '馬', cell: [2, 0, 4, 1] },
  eqh_4: { f: 'eq_horses.webp', w: 1024, h: 256, has: true, ph: '馬', cell: [3, 0, 4, 1] },
  sc_forge: { f: 'sc_forge.webp', w: 1024, h: 683, has: true, ph: '坊' },
  sc_study: { f: 'sc_study.webp', w: 1024, h: 683, has: true, ph: '院' },
  fg_smith: { f: 'host_h6.webp', w: 1191, h: 560, has: true, ph: '匠', cell: [0, 0, 3, 1], ar: 0.7089 },
  fg_smith_cry: { f: 'host_h6.webp', w: 1191, h: 560, has: true, ph: '哭', cell: [2, 0, 3, 1], ar: 0.7089 },
  st_host: { f: 'host_h2.webp', w: 999, h: 560, has: true, ph: '師', cell: [0, 0, 3, 1], ar: 0.5946 },
  hs_gate_closed: { f: 'hs_gate.webp', w: 1350, h: 621, has: true, ph: '柵', cell: [0, 0, 3, 1], ar: 0.7246 },
  hs_gate_open: { f: 'hs_gate.webp', w: 1350, h: 621, has: true, ph: '開', cell: [2, 0, 3, 1], ar: 0.7246 },
  // 裝備物品 9 格(eq_items,3x3):刀、羽扇、鎧、袍、馬(已水平翻成朝右)、書、葫蘆、錦囊、鏡
  eqi_blade: { f: 'eq_items.webp', w: 576, h: 576, has: true, ph: '刀', cell: [0, 0, 3, 3] },
  eqi_fan: { f: 'eq_items.webp', w: 576, h: 576, has: true, ph: '扇', cell: [1, 0, 3, 3] },
  eqi_armor: { f: 'eq_items.webp', w: 576, h: 576, has: true, ph: '鎧', cell: [2, 0, 3, 3] },
  eqi_robe: { f: 'eq_items.webp', w: 576, h: 576, has: true, ph: '袍', cell: [0, 1, 3, 3] },
  eqi_horse: { f: 'eq_items.webp', w: 576, h: 576, has: true, ph: '馬', cell: [1, 1, 3, 3] },
  eqi_book: { f: 'eq_items.webp', w: 576, h: 576, has: true, ph: '書', cell: [2, 1, 3, 3] },
  eqi_gourd: { f: 'eq_items.webp', w: 576, h: 576, has: true, ph: '葫', cell: [0, 2, 3, 3] },
  eqi_bag: { f: 'eq_items.webp', w: 576, h: 576, has: true, ph: '囊', cell: [1, 2, 3, 3] },
  eqi_mirror: { f: 'eq_items.webp', w: 576, h: 576, has: true, ph: '鏡', cell: [2, 2, 3, 3] },
  // 鍛造材料 11 格(mat_icons,4x3),key = js/mat.js 的材料 id,順序與 mat.js 一致
  m_iron1: { f: 'mat_icons.webp', w: 768, h: 576, has: true, ph: '鐵', cell: [0, 0, 4, 3] },
  m_iron2: { f: 'mat_icons.webp', w: 768, h: 576, has: true, ph: '鐵', cell: [1, 0, 4, 3] },
  m_iron3: { f: 'mat_icons.webp', w: 768, h: 576, has: true, ph: '鋼', cell: [2, 0, 4, 3] },
  m_iron4: { f: 'mat_icons.webp', w: 768, h: 576, has: true, ph: '玄', cell: [3, 0, 4, 3] },
  m_hide1: { f: 'mat_icons.webp', w: 768, h: 576, has: true, ph: '皮', cell: [0, 1, 4, 3] },
  m_hide2: { f: 'mat_icons.webp', w: 768, h: 576, has: true, ph: '皮', cell: [1, 1, 4, 3] },
  m_hide3: { f: 'mat_icons.webp', w: 768, h: 576, has: true, ph: '皮', cell: [2, 1, 4, 3] },
  m_hide4: { f: 'mat_icons.webp', w: 768, h: 576, has: true, ph: '龜', cell: [3, 1, 4, 3] },
  m_coal: { f: 'mat_icons.webp', w: 768, h: 576, has: true, ph: '炭', cell: [0, 2, 4, 3] },
  m_whet: { f: 'mat_icons.webp', w: 768, h: 576, has: true, ph: '礪', cell: [1, 2, 4, 3] },
  m_soul: { f: 'mat_icons.webp', w: 768, h: 576, has: true, ph: '魄', cell: [2, 2, 4, 3] },
  // 尋訪小圖示 6 格(xf_icons,3x2):信封、閃電、斷刀、馬廄、草鞋、斗笠
  xf_1: { f: 'xf_icons.webp', w: 576, h: 384, has: true, ph: '', cell: [0, 0, 3, 2] },
  xf_2: { f: 'xf_icons.webp', w: 576, h: 384, has: true, ph: '', cell: [1, 0, 3, 2] },
  xf_3: { f: 'xf_icons.webp', w: 576, h: 384, has: true, ph: '', cell: [2, 0, 3, 2] },
  xf_4: { f: 'xf_icons.webp', w: 576, h: 384, has: true, ph: '', cell: [0, 1, 3, 2] },
  xf_5: { f: 'xf_icons.webp', w: 576, h: 384, has: true, ph: '', cell: [1, 1, 3, 2] },
  xf_6: { f: 'xf_icons.webp', w: 576, h: 384, has: true, ph: '', cell: [2, 1, 3, 2] },
  // 金裝特性第一批 7 格(trait_icons,4x2):雲梯、心盾、破盾、劍氣、馬蹄、蓮花、葉針
  tr_1: { f: 'trait_icons.webp', w: 768, h: 384, has: true, ph: '', cell: [0, 0, 4, 2] },
  tr_2: { f: 'trait_icons.webp', w: 768, h: 384, has: true, ph: '', cell: [1, 0, 4, 2] },
  tr_3: { f: 'trait_icons.webp', w: 768, h: 384, has: true, ph: '', cell: [2, 0, 4, 2] },
  tr_4: { f: 'trait_icons.webp', w: 768, h: 384, has: true, ph: '', cell: [3, 0, 4, 2] },
  tr_5: { f: 'trait_icons.webp', w: 768, h: 384, has: true, ph: '', cell: [0, 1, 4, 2] },
  tr_6: { f: 'trait_icons.webp', w: 768, h: 384, has: true, ph: '', cell: [1, 1, 4, 2] },
  tr_7: { f: 'trait_icons.webp', w: 768, h: 384, has: true, ph: '', cell: [2, 1, 4, 2] },
  // 開場 / 活動(尚無頁面讀取)
  ev_boss: { f: 'ev_boss.webp', w: 640, h: 810, has: true, ph: '' },
  ev_open: { f: 'ev_open.webp', w: 640, h: 372, has: true, ph: '' },
  ev_week: { f: 'ev_week.webp', w: 768, h: 447, has: true, ph: '' },
  ev_group_bg: { f: 'ev_group_bg.webp', w: 1280, h: 853, has: true, ph: '' },
  evi_lock: { f: 'ev_icons.webp', w: 576, h: 576, has: true, ph: '', cell: [0, 0, 3, 3] },
  evi_unlock: { f: 'ev_icons.webp', w: 576, h: 576, has: true, ph: '', cell: [1, 0, 3, 3] },
  evi_clock: { f: 'ev_icons.webp', w: 576, h: 576, has: true, ph: '', cell: [2, 0, 3, 3] },
  evi_medal: { f: 'ev_icons.webp', w: 576, h: 576, has: true, ph: '', cell: [0, 1, 3, 3] },
  evi_ribbon: { f: 'ev_icons.webp', w: 576, h: 576, has: true, ph: '', cell: [1, 1, 3, 3] },
  evi_book: { f: 'ev_icons.webp', w: 576, h: 576, has: true, ph: '', cell: [2, 1, 3, 3] },
  evi_cards: { f: 'ev_icons.webp', w: 576, h: 576, has: true, ph: '', cell: [0, 2, 3, 3] },
  evi_flag: { f: 'ev_icons.webp', w: 576, h: 576, has: true, ph: '', cell: [1, 2, 3, 3] },
  evi_gift: { f: 'ev_icons.webp', w: 576, h: 576, has: true, ph: '', cell: [2, 2, 3, 3] },
  evc_1: { f: 'ev_chest.webp', w: 576, h: 576, has: true, ph: '', cell: [0, 0, 3, 3] },
  evc_2: { f: 'ev_chest.webp', w: 576, h: 576, has: true, ph: '', cell: [1, 0, 3, 3] },
  evc_3: { f: 'ev_chest.webp', w: 576, h: 576, has: true, ph: '', cell: [2, 0, 3, 3] },
  evc_4: { f: 'ev_chest.webp', w: 576, h: 576, has: true, ph: '', cell: [0, 1, 3, 3] },
  evc_5: { f: 'ev_chest.webp', w: 576, h: 576, has: true, ph: '', cell: [1, 1, 3, 3] },
  evc_6: { f: 'ev_chest.webp', w: 576, h: 576, has: true, ph: '', cell: [2, 1, 3, 3] },
  evc_7: { f: 'ev_chest.webp', w: 576, h: 576, has: true, ph: '', cell: [0, 2, 3, 3] },
  evc_8: { f: 'ev_chest.webp', w: 576, h: 576, has: true, ph: '', cell: [1, 2, 3, 3] },
  evc_9: { f: 'ev_chest.webp', w: 576, h: 576, has: true, ph: '', cell: [2, 2, 3, 3] },
  evs_1: { f: 'ev_sign.webp', w: 768, h: 512, has: true, ph: '', cell: [0, 0, 3, 2] },
  evs_2: { f: 'ev_sign.webp', w: 768, h: 512, has: true, ph: '', cell: [1, 0, 3, 2] },
  evs_3: { f: 'ev_sign.webp', w: 768, h: 512, has: true, ph: '', cell: [2, 0, 3, 2] },
  evs_4: { f: 'ev_sign.webp', w: 768, h: 512, has: true, ph: '', cell: [0, 1, 3, 2] },
  evs_5: { f: 'ev_sign.webp', w: 768, h: 512, has: true, ph: '', cell: [1, 1, 3, 2] },
  evs_6: { f: 'ev_sign.webp', w: 768, h: 512, has: true, ph: '', cell: [2, 1, 3, 2] },
  // u3_stat(345:數據面板底,640x412):九宮格 [上,右,下,左];上緣圓筒含木軸頭固定,中間米色平塗拉伸,下角圓弧
  u3_stat: { f: 'u3_stat.webp', w: 640, h: 412, has: true, ph: '', nine: [125,90,55,90] },
  // ic_res(4x4 圖集,192/格,346):資源 / 貨幣圖示;第 13、14 格(石+銅錢、一盆沙)多餘備用不登記
  ic_wood: { f: 'ic_res.webp', w: 768, h: 768, has: true, ph: '木', cell: [0, 0, 4, 4] },
  ic_iron: { f: 'ic_res.webp', w: 768, h: 768, has: true, ph: '鐵', cell: [1, 0, 4, 4] },
  ic_stone: { f: 'ic_res.webp', w: 768, h: 768, has: true, ph: '石', cell: [2, 0, 4, 4] },
  ic_food: { f: 'ic_res.webp', w: 768, h: 768, has: true, ph: '糧', cell: [3, 0, 4, 4] },
  ic_coin: { f: 'ic_res.webp', w: 768, h: 768, has: true, ph: '錢', cell: [0, 1, 4, 4] },
  ic_stamina: { f: 'ic_res.webp', w: 768, h: 768, has: true, ph: '體', cell: [1, 1, 4, 4] },
  ic_token: { f: 'ic_res.webp', w: 768, h: 768, has: true, ph: '令', cell: [2, 1, 4, 4] },
  ic_helm: { f: 'ic_res.webp', w: 768, h: 768, has: true, ph: '兵', cell: [3, 1, 4, 4] },
  ic_fame: { f: 'ic_res.webp', w: 768, h: 768, has: true, ph: '名', cell: [0, 2, 4, 4] },
  ic_land: { f: 'ic_res.webp', w: 768, h: 768, has: true, ph: '領', cell: [1, 2, 4, 4] },
  ic_force: { f: 'ic_res.webp', w: 768, h: 768, has: true, ph: '勢', cell: [2, 2, 4, 4] },
  ic_army: { f: 'ic_res.webp', w: 768, h: 768, has: true, ph: '總', cell: [3, 2, 4, 4] },
  ic_mat: { f: 'ic_res.webp', w: 768, h: 768, has: true, ph: '材', cell: [2, 3, 4, 4] },
  ic_lantern: { f: 'ic_res.webp', w: 768, h: 768, has: true, ph: '燈', cell: [3, 3, 4, 4] },
  // ic_nav(348:底列 / 提示圖示 4x4,192/格)與 ic_tab(347:裝備分頁 / 地圖圖示 4x4);eq_*(裝備空格)暫用 eq_slot.webp = ic_tab 前 4 格去色變暗半透明的剪影佔位,正式空格剪影到了再換
  ic_gift: { f: 'ic_nav.webp', w: 768, h: 768, has: true, ph: '禮', cell: [1, 1, 4, 4] },
  ic_mainq: { f: 'ic_nav.webp', w: 768, h: 768, has: true, ph: '主', cell: [3, 1, 4, 4] },
  ic_harvest: { f: 'ic_nav.webp', w: 768, h: 768, has: true, ph: '收', cell: [0, 2, 4, 4] },
  ic_lord: { f: 'ic_nav.webp', w: 768, h: 768, has: true, ph: '主', cell: [1, 2, 4, 4] },
  ic_t_weapon: { f: 'ic_tab.webp', w: 768, h: 768, has: true, ph: '武', cell: [0, 0, 4, 4] },
  ic_t_armor: { f: 'ic_tab.webp', w: 768, h: 768, has: true, ph: '甲', cell: [1, 0, 4, 4] },
  ic_t_horse: { f: 'ic_tab.webp', w: 768, h: 768, has: true, ph: '馬', cell: [2, 0, 4, 4] },
  ic_t_treasure: { f: 'ic_tab.webp', w: 768, h: 768, has: true, ph: '寶', cell: [3, 0, 4, 4] },
  tab_equip: { f: 'ic_tab.webp', w: 768, h: 768, has: true, ph: '裝', cell: [0, 1, 4, 4] },
  tab_mat: { f: 'ic_tab.webp', w: 768, h: 768, has: true, ph: '材', cell: [1, 1, 4, 4] },
  tab_item: { f: 'ic_tab.webp', w: 768, h: 768, has: true, ph: '道', cell: [2, 1, 4, 4] },
  ic_map: { f: 'ic_tab.webp', w: 768, h: 768, has: true, ph: '圖', cell: [3, 1, 4, 4] },
  ic_tower: { f: 'ic_tab.webp', w: 768, h: 768, has: true, ph: '塔', cell: [0, 2, 4, 4] },
  ic_arena: { f: 'ic_tab.webp', w: 768, h: 768, has: true, ph: '擂', cell: [1, 2, 4, 4] },
  ic_node: { f: 'ic_tab.webp', w: 768, h: 768, has: true, ph: '資', cell: [2, 2, 4, 4] },
  ic_neutral: { f: 'ic_tab.webp', w: 768, h: 768, has: true, ph: '中', cell: [3, 2, 4, 4] },
  ic_player: { f: 'ic_tab.webp', w: 768, h: 768, has: true, ph: '玩', cell: [0, 3, 4, 4] },
  // ===== 2026-11-14 接圖4(tools/art/b5_*.py):ar = 圖集一格的寬高比(ldArt 以它設 aspect-ratio,格圖才不被拉伸);pivot / rooms / paper = 量測座標(皆為該圖的 0~1 比例)=====
  // 主持人 14 組(3 格橫排:平常 / 說話 / 特殊;3 格同裁切框)。鍵 host_h<組>_<0|1|2>;st_host = H2 平常、fg_smith / fg_smith_cry = H6 平常 / 哭
  host_h1_0: { f: 'host_h1.webp', w: 1029, h: 560, has: true, ph: '', cell: [0, 0, 3, 1], ar: 0.6125 },
  host_h1_1: { f: 'host_h1.webp', w: 1029, h: 560, has: true, ph: '', cell: [1, 0, 3, 1], ar: 0.6125 },
  host_h1_2: { f: 'host_h1.webp', w: 1029, h: 560, has: true, ph: '', cell: [2, 0, 3, 1], ar: 0.6125 },
  host_h2_0: { f: 'host_h2.webp', w: 999, h: 560, has: true, ph: '', cell: [0, 0, 3, 1], ar: 0.5946 },
  host_h2_1: { f: 'host_h2.webp', w: 999, h: 560, has: true, ph: '', cell: [1, 0, 3, 1], ar: 0.5946 },
  host_h2_2: { f: 'host_h2.webp', w: 999, h: 560, has: true, ph: '', cell: [2, 0, 3, 1], ar: 0.5946 },
  host_h3_0: { f: 'host_h3.webp', w: 1041, h: 560, has: true, ph: '', cell: [0, 0, 3, 1], ar: 0.6196 },
  host_h3_1: { f: 'host_h3.webp', w: 1041, h: 560, has: true, ph: '', cell: [1, 0, 3, 1], ar: 0.6196 },
  host_h3_2: { f: 'host_h3.webp', w: 1041, h: 560, has: true, ph: '', cell: [2, 0, 3, 1], ar: 0.6196 },
  host_h4_0: { f: 'host_h4.webp', w: 1146, h: 560, has: true, ph: '', cell: [0, 0, 3, 1], ar: 0.6821 },
  host_h4_1: { f: 'host_h4.webp', w: 1146, h: 560, has: true, ph: '', cell: [1, 0, 3, 1], ar: 0.6821 },
  host_h4_2: { f: 'host_h4.webp', w: 1146, h: 560, has: true, ph: '', cell: [2, 0, 3, 1], ar: 0.6821 },
  host_h5_0: { f: 'host_h5.webp', w: 1317, h: 560, has: true, ph: '', cell: [0, 0, 3, 1], ar: 0.7839 },
  host_h5_1: { f: 'host_h5.webp', w: 1317, h: 560, has: true, ph: '', cell: [1, 0, 3, 1], ar: 0.7839 },
  host_h5_2: { f: 'host_h5.webp', w: 1317, h: 560, has: true, ph: '', cell: [2, 0, 3, 1], ar: 0.7839 },
  host_h6_0: { f: 'host_h6.webp', w: 1191, h: 560, has: true, ph: '', cell: [0, 0, 3, 1], ar: 0.7089 },
  host_h6_1: { f: 'host_h6.webp', w: 1191, h: 560, has: true, ph: '', cell: [1, 0, 3, 1], ar: 0.7089 },
  host_h6_2: { f: 'host_h6.webp', w: 1191, h: 560, has: true, ph: '', cell: [2, 0, 3, 1], ar: 0.7089 },
  host_h7_0: { f: 'host_h7.webp', w: 996, h: 560, has: true, ph: '', cell: [0, 0, 3, 1], ar: 0.5929 },
  host_h7_1: { f: 'host_h7.webp', w: 996, h: 560, has: true, ph: '', cell: [1, 0, 3, 1], ar: 0.5929 },
  host_h7_2: { f: 'host_h7.webp', w: 996, h: 560, has: true, ph: '', cell: [2, 0, 3, 1], ar: 0.5929 },
  host_h8_0: { f: 'host_h8.webp', w: 999, h: 560, has: true, ph: '', cell: [0, 0, 3, 1], ar: 0.5946 },
  host_h8_1: { f: 'host_h8.webp', w: 999, h: 560, has: true, ph: '', cell: [1, 0, 3, 1], ar: 0.5946 },
  host_h8_2: { f: 'host_h8.webp', w: 999, h: 560, has: true, ph: '', cell: [2, 0, 3, 1], ar: 0.5946 },
  host_h9_0: { f: 'host_h9.webp', w: 1110, h: 560, has: true, ph: '', cell: [0, 0, 3, 1], ar: 0.6607 },
  host_h9_1: { f: 'host_h9.webp', w: 1110, h: 560, has: true, ph: '', cell: [1, 0, 3, 1], ar: 0.6607 },
  host_h9_2: { f: 'host_h9.webp', w: 1110, h: 560, has: true, ph: '', cell: [2, 0, 3, 1], ar: 0.6607 },
  host_h10_0: { f: 'host_h10.webp', w: 1332, h: 560, has: true, ph: '', cell: [0, 0, 3, 1], ar: 0.7929 },
  host_h10_1: { f: 'host_h10.webp', w: 1332, h: 560, has: true, ph: '', cell: [1, 0, 3, 1], ar: 0.7929 },
  host_h10_2: { f: 'host_h10.webp', w: 1332, h: 560, has: true, ph: '', cell: [2, 0, 3, 1], ar: 0.7929 },
  host_h11_0: { f: 'host_h11.webp', w: 1029, h: 560, has: true, ph: '', cell: [0, 0, 3, 1], ar: 0.6125 },
  host_h11_1: { f: 'host_h11.webp', w: 1029, h: 560, has: true, ph: '', cell: [1, 0, 3, 1], ar: 0.6125 },
  host_h11_2: { f: 'host_h11.webp', w: 1029, h: 560, has: true, ph: '', cell: [2, 0, 3, 1], ar: 0.6125 },
  host_h12_0: { f: 'host_h12.webp', w: 843, h: 560, has: true, ph: '', cell: [0, 0, 3, 1], ar: 0.5018 },
  host_h12_1: { f: 'host_h12.webp', w: 843, h: 560, has: true, ph: '', cell: [1, 0, 3, 1], ar: 0.5018 },
  host_h12_2: { f: 'host_h12.webp', w: 843, h: 560, has: true, ph: '', cell: [2, 0, 3, 1], ar: 0.5018 },
  host_h13_0: { f: 'host_h13.webp', w: 855, h: 560, has: true, ph: '', cell: [0, 0, 3, 1], ar: 0.5089 },
  host_h13_1: { f: 'host_h13.webp', w: 855, h: 560, has: true, ph: '', cell: [1, 0, 3, 1], ar: 0.5089 },
  host_h13_2: { f: 'host_h13.webp', w: 855, h: 560, has: true, ph: '', cell: [2, 0, 3, 1], ar: 0.5089 },
  host_h14_0: { f: 'host_h14.webp', w: 951, h: 560, has: true, ph: '', cell: [0, 0, 3, 1], ar: 0.5661 },
  host_h14_1: { f: 'host_h14.webp', w: 951, h: 560, has: true, ph: '', cell: [1, 0, 3, 1], ar: 0.5661 },
  host_h14_2: { f: 'host_h14.webp', w: 951, h: 560, has: true, ph: '', cell: [2, 0, 3, 1], ar: 0.5661 },
  // P1 羅盤:底盤 / 指針同尺寸方形,中心孔都在正中央(疊在一起轉指針即可);捲軸收 / 展
  p1_dial: { f: 'p1_dial.webp', w: 502, h: 502, has: true, ph: '', pivot: [0.5, 0.5] },
  p1_needle: { f: 'p1_needle.webp', w: 502, h: 502, has: true, ph: '', pivot: [0.5, 0.5] },
  p1_scroll_c: { f: 'p1_scroll_c.webp', w: 480, h: 173, has: true, ph: '' },
  p1_scroll_o: { f: 'p1_scroll_o.webp', w: 560, h: 368, has: true, ph: '' },
  // P2 柵門第 2 格(撞到凸出);hs_gate_closed / hs_gate_open 為同一圖集第 1 / 3 格
  hs_gate_bump: { f: 'hs_gate.webp', w: 1350, h: 621, has: true, ph: '凸', cell: [1, 0, 3, 1], ar: 0.7246 },
  // P3 鐵砧 / 鐵鎚(pivot = 握把末端旋轉軸)/ 斷劍
  p3_anvil: { f: 'p3_anvil.webp', w: 480, h: 501, has: true, ph: '' },
  p3_hammer: { f: 'p3_hammer.webp', w: 420, h: 193, has: true, ph: '', pivot: [0.0141, 0.557] },
  p3_sword: { f: 'p3_sword.webp', w: 420, h: 459, has: true, ph: '' },
  // P4 塔剖面(rooms = 8 個房間 [中心x, 中心y, 可用寬, 可用高] 比例,由上到下)/ 吊籃 / 塔門 3 格(關 / 縫 / 開)
  p4_tower: { f: 'p4_tower.webp', w: 480, h: 972, has: true, ph: '', rooms: [[0.5, 0.1965, 0.40, 0.085], [0.5, 0.3035, 0.40, 0.085], [0.5, 0.4126, 0.40, 0.085], [0.5, 0.5216, 0.40, 0.085], [0.5, 0.6296, 0.40, 0.085], [0.5, 0.7377, 0.40, 0.085], [0.5, 0.8477, 0.40, 0.085], [0.5, 0.9444, 0.40, 0.085]] },
  p4_basket: { f: 'p4_basket.webp', w: 300, h: 364, has: true, ph: '' },
  p4_gate_closed: { f: 'p4_gate.webp', w: 1200, h: 370, has: true, ph: '', cell: [0, 0, 3, 1], ar: 1.0811 },
  p4_gate_crack: { f: 'p4_gate.webp', w: 1200, h: 370, has: true, ph: '', cell: [1, 0, 3, 1], ar: 1.0811 },
  p4_gate_open: { f: 'p4_gate.webp', w: 1200, h: 370, has: true, ph: '', cell: [2, 0, 3, 1], ar: 1.0811 },
  // P5 募兵大鼓 / 告示板(paper = 米紙內框 [左, 上, 右, 下] 比例)
  p5_drum: { f: 'p5_drum.webp', w: 480, h: 661, has: true, ph: '' },
  p5_board: { f: 'p5_board.webp', w: 480, h: 604, has: true, ph: '', paper: [0.1947, 0.2782, 0.8079, 0.705] },
  // P6 沙盤桌 / 帥旗 / 三座土台(3 格)
  p6_table: { f: 'p6_table.webp', w: 480, h: 305, has: true, ph: '' },
  p6_flag: { f: 'p6_flag.webp', w: 267, h: 520, has: true, ph: '' },
  p6_mound_0: { f: 'p6_mounds.webp', w: 480, h: 236, has: true, ph: '', cell: [0, 0, 3, 1], ar: 0.6780 },
  p6_mound_1: { f: 'p6_mounds.webp', w: 480, h: 236, has: true, ph: '', cell: [1, 0, 3, 1], ar: 0.6780 },
  p6_mound_2: { f: 'p6_mounds.webp', w: 480, h: 236, has: true, ph: '', cell: [2, 0, 3, 1], ar: 0.6780 },
  // P7 銅鑼 / 布幕(合起、左片、右片;深藍黑底去背)
  p7_gong: { f: 'p7_gong.webp', w: 480, h: 432, has: true, ph: '' },
  p7_curtain: { f: 'p7_curtain.webp', w: 480, h: 365, has: true, ph: '' },
  p7_curtain_l: { f: 'p7_curtain_l.webp', w: 400, h: 456, has: true, ph: '' },
  p7_curtain_r: { f: 'p7_curtain_r.webp', w: 400, h: 456, has: true, ph: '' },
  // P8 地圖捲軸左右軸 + 3 圖釘(紅 / 黃 / 青)
  p8_axis_l: { f: 'p8_axis_l.webp', w: 113, h: 520, has: true, ph: '' },
  p8_axis_r: { f: 'p8_axis_r.webp', w: 111, h: 520, has: true, ph: '' },
  p8_pin_0: { f: 'p8_pins.webp', w: 420, h: 327, has: true, ph: '', cell: [0, 0, 3, 1], ar: 0.4281 },
  p8_pin_1: { f: 'p8_pins.webp', w: 420, h: 327, has: true, ph: '', cell: [1, 0, 3, 1], ar: 0.4281 },
  p8_pin_2: { f: 'p8_pins.webp', w: 420, h: 327, has: true, ph: '', cell: [2, 0, 3, 1], ar: 0.4281 },
  // P9 牛車步伐 A / B(同裁切框,底緣 = 觸地線)+ 戰利品堆
  p9_cart_a: { f: 'p9_cart.webp', w: 1200, h: 267, has: true, ph: '', cell: [0, 0, 2, 1], ar: 2.2472 },
  p9_cart_b: { f: 'p9_cart.webp', w: 1200, h: 267, has: true, ph: '', cell: [1, 0, 2, 1], ar: 2.2472 },
  p9_loot: { f: 'p9_loot.webp', w: 360, h: 476, has: true, ph: '' },
  // 招賢大鼎 D1 四表情(2x2:睏 / 開心 / 星星眼 / 打嗝)與光效 6 格(3x2:藍 / 紫 / 金光柱;小 / 中 / 大煙團,深藍底已去背)
  ding_sleepy: { f: 'd1_ding.webp', w: 714, h: 840, has: true, ph: '', cell: [0, 0, 2, 2], ar: 0.8500 },
  ding_happy: { f: 'd1_ding.webp', w: 714, h: 840, has: true, ph: '', cell: [1, 0, 2, 2], ar: 0.8500 },
  ding_wow: { f: 'd1_ding.webp', w: 714, h: 840, has: true, ph: '', cell: [0, 1, 2, 2], ar: 0.8500 },
  ding_burp: { f: 'd1_ding.webp', w: 714, h: 840, has: true, ph: '', cell: [1, 1, 2, 2], ar: 0.8500 },
  ding_beam_blue: { f: 'd2_fx.webp', w: 1152, h: 768, has: true, ph: '', cell: [0, 0, 3, 2], ar: 1 },
  ding_beam_purple: { f: 'd2_fx.webp', w: 1152, h: 768, has: true, ph: '', cell: [1, 0, 3, 2], ar: 1 },
  ding_beam_gold: { f: 'd2_fx.webp', w: 1152, h: 768, has: true, ph: '', cell: [2, 0, 3, 2], ar: 1 },
  ding_puff_s: { f: 'd2_fx.webp', w: 1152, h: 768, has: true, ph: '', cell: [0, 1, 3, 2], ar: 1 },
  ding_puff_m: { f: 'd2_fx.webp', w: 1152, h: 768, has: true, ph: '', cell: [1, 1, 3, 2], ar: 1 },
  ding_puff_l: { f: 'd2_fx.webp', w: 1152, h: 768, has: true, ph: '', cell: [2, 1, 3, 2], ar: 1 },
  // 首領 3 格(受擊 / 逃跑 / 倒下)
  ev_boss_hit: { f: 'ev_boss3.webp', w: 1116, h: 560, has: true, ph: '', cell: [0, 0, 3, 1], ar: 0.6643 },
  ev_boss_flee: { f: 'ev_boss3.webp', w: 1116, h: 560, has: true, ph: '', cell: [1, 0, 3, 1], ar: 0.6643 },
  ev_boss_down: { f: 'ev_boss3.webp', w: 1116, h: 560, has: true, ph: '', cell: [2, 0, 3, 1], ar: 0.6643 },
  // 活動橫幅 3 條(寬 720;左側米色空白帶留給程式寫字)
  ev_bn_boss: { f: 'ev_bn_boss.webp', w: 720, h: 220, has: true, ph: '' },
  ev_bn_treasure: { f: 'ev_bn_treasure.webp', w: 720, h: 217, has: true, ph: '' },
  ev_bn_sign: { f: 'ev_bn_sign.webp', w: 720, h: 220, has: true, ph: '' },
  // U5 隊伍格框 6 件:1 木牌長條、2 金六角、3 青灰六角鎖、4 圓框(首頁隊伍欄 1~4);5 紙卡框、6 加號卡框(整隊頁站位格 5~6)
  u5_1: { f: 'u5_1.webp', w: 464, h: 216, has: true, ph: '' },
  u5_2: { f: 'u5_2.webp', w: 480, h: 378, has: true, ph: '' },
  u5_3: { f: 'u5_3.webp', w: 480, h: 381, has: true, ph: '' },
  u5_4: { f: 'u5_4.webp', w: 348, h: 352, has: true, ph: '' },
  u5_5: { f: 'u5_5.webp', w: 356, h: 432, has: true, ph: '' },
  u5_6: { f: 'u5_6.webp', w: 356, h: 432, has: true, ph: '' },
  // 金裝特性第二批 11 格(trait_icons2,4x3,96/格;鍵 tr_<GEAR_TRAITS 的 id>)
  tr_defign: { f: 'trait_icons2.webp', w: 384, h: 288, has: true, ph: '', cell: [0, 0, 4, 3], ar: 1 },
  tr_sresign: { f: 'trait_icons2.webp', w: 384, h: 288, has: true, ph: '', cell: [1, 0, 4, 3], ar: 1 },
  tr_lowkill: { f: 'trait_icons2.webp', w: 384, h: 288, has: true, ph: '', cell: [2, 0, 4, 3], ar: 1 },
  tr_leech: { f: 'trait_icons2.webp', w: 384, h: 288, has: true, ph: '', cell: [3, 0, 4, 3], ar: 1 },
  tr_thorns: { f: 'trait_icons2.webp', w: 384, h: 288, has: true, ph: '', cell: [0, 1, 4, 3], ar: 1 },
  tr_laststand: { f: 'trait_icons2.webp', w: 384, h: 288, has: true, ph: '', cell: [1, 1, 4, 3], ar: 1 },
  tr_fathalf: { f: 'trait_icons2.webp', w: 384, h: 288, has: true, ph: '', cell: [2, 1, 4, 3], ar: 1 },
  tr_vsslow: { f: 'trait_icons2.webp', w: 384, h: 288, has: true, ph: '', cell: [3, 1, 4, 3], ar: 1 },
  tr_breakfree: { f: 'trait_icons2.webp', w: 384, h: 288, has: true, ph: '', cell: [0, 2, 4, 3], ar: 1 },
  tr_regen: { f: 'trait_icons2.webp', w: 384, h: 288, has: true, ph: '', cell: [1, 2, 4, 3], ar: 1 },
  tr_dotout: { f: 'trait_icons2.webp', w: 384, h: 288, has: true, ph: '', cell: [2, 2, 4, 3], ar: 1 },
  // 戰法特效 3 張(黑底白灰、不去背;3x3 各 3 格 = 出現 / 最亮 / 消散,每列一種效果;使用時用加亮混合 lighten / 'lighter' 疊上;檔在 assets/bnfx/)。鍵 fxs_<效果>_<0|1|2>,add:true = 要加亮混合
  fxs_phys_0: { f: '../bnfx/fxs_a.webp', w: 1152, h: 1152, has: true, ph: '', cell: [0, 0, 3, 3], ar: 1, add: true },
  fxs_phys_1: { f: '../bnfx/fxs_a.webp', w: 1152, h: 1152, has: true, ph: '', cell: [1, 0, 3, 3], ar: 1, add: true },
  fxs_phys_2: { f: '../bnfx/fxs_a.webp', w: 1152, h: 1152, has: true, ph: '', cell: [2, 0, 3, 3], ar: 1, add: true },
  fxs_spell_0: { f: '../bnfx/fxs_a.webp', w: 1152, h: 1152, has: true, ph: '', cell: [0, 1, 3, 3], ar: 1, add: true },
  fxs_spell_1: { f: '../bnfx/fxs_a.webp', w: 1152, h: 1152, has: true, ph: '', cell: [1, 1, 3, 3], ar: 1, add: true },
  fxs_spell_2: { f: '../bnfx/fxs_a.webp', w: 1152, h: 1152, has: true, ph: '', cell: [2, 1, 3, 3], ar: 1, add: true },
  fxs_crit_0: { f: '../bnfx/fxs_a.webp', w: 1152, h: 1152, has: true, ph: '', cell: [0, 2, 3, 3], ar: 1, add: true },
  fxs_crit_1: { f: '../bnfx/fxs_a.webp', w: 1152, h: 1152, has: true, ph: '', cell: [1, 2, 3, 3], ar: 1, add: true },
  fxs_crit_2: { f: '../bnfx/fxs_a.webp', w: 1152, h: 1152, has: true, ph: '', cell: [2, 2, 3, 3], ar: 1, add: true },
  fxs_buff_0: { f: '../bnfx/fxs_b.webp', w: 1152, h: 1152, has: true, ph: '', cell: [0, 0, 3, 3], ar: 1, add: true },
  fxs_buff_1: { f: '../bnfx/fxs_b.webp', w: 1152, h: 1152, has: true, ph: '', cell: [1, 0, 3, 3], ar: 1, add: true },
  fxs_buff_2: { f: '../bnfx/fxs_b.webp', w: 1152, h: 1152, has: true, ph: '', cell: [2, 0, 3, 3], ar: 1, add: true },
  fxs_debuff_0: { f: '../bnfx/fxs_b.webp', w: 1152, h: 1152, has: true, ph: '', cell: [0, 1, 3, 3], ar: 1, add: true },
  fxs_debuff_1: { f: '../bnfx/fxs_b.webp', w: 1152, h: 1152, has: true, ph: '', cell: [1, 1, 3, 3], ar: 1, add: true },
  fxs_debuff_2: { f: '../bnfx/fxs_b.webp', w: 1152, h: 1152, has: true, ph: '', cell: [2, 1, 3, 3], ar: 1, add: true },
  fxs_ctrl_0: { f: '../bnfx/fxs_b.webp', w: 1152, h: 1152, has: true, ph: '', cell: [0, 2, 3, 3], ar: 1, add: true },
  fxs_ctrl_1: { f: '../bnfx/fxs_b.webp', w: 1152, h: 1152, has: true, ph: '', cell: [1, 2, 3, 3], ar: 1, add: true },
  fxs_ctrl_2: { f: '../bnfx/fxs_b.webp', w: 1152, h: 1152, has: true, ph: '', cell: [2, 2, 3, 3], ar: 1, add: true },
  fxs_heal_0: { f: '../bnfx/fxs_c.webp', w: 1152, h: 1152, has: true, ph: '', cell: [0, 0, 3, 3], ar: 1, add: true },
  fxs_heal_1: { f: '../bnfx/fxs_c.webp', w: 1152, h: 1152, has: true, ph: '', cell: [1, 0, 3, 3], ar: 1, add: true },
  fxs_heal_2: { f: '../bnfx/fxs_c.webp', w: 1152, h: 1152, has: true, ph: '', cell: [2, 0, 3, 3], ar: 1, add: true },
  fxs_guard_0: { f: '../bnfx/fxs_c.webp', w: 1152, h: 1152, has: true, ph: '', cell: [0, 1, 3, 3], ar: 1, add: true },
  fxs_guard_1: { f: '../bnfx/fxs_c.webp', w: 1152, h: 1152, has: true, ph: '', cell: [1, 1, 3, 3], ar: 1, add: true },
  fxs_guard_2: { f: '../bnfx/fxs_c.webp', w: 1152, h: 1152, has: true, ph: '', cell: [2, 1, 3, 3], ar: 1, add: true },
  fxs_dodge_0: { f: '../bnfx/fxs_c.webp', w: 1152, h: 1152, has: true, ph: '', cell: [0, 2, 3, 3], ar: 1, add: true },
  fxs_dodge_1: { f: '../bnfx/fxs_c.webp', w: 1152, h: 1152, has: true, ph: '', cell: [1, 2, 3, 3], ar: 1, add: true },
  fxs_dodge_2: { f: '../bnfx/fxs_c.webp', w: 1152, h: 1152, has: true, ph: '', cell: [2, 2, 3, 3], ar: 1, add: true }
};
// 圖片網址;沒有圖(has:false)或鍵不存在 = null(呼叫端不可據此發請求)
function ldArtUrl(key) {
  var a = LD_ART[key];
  if (!a || !a.has) return null;
  return LD_ART_DIR + a.f;
}
function ldArtHas(key) { return !!ldArtUrl(key); }
function ldArtPh(key) { var a = LD_ART[key]; return a ? a.ph : ''; }
// 建元素:先畫 CSS 佔位(.ld-ph + 漢字);has:true 才疊圖。整圖用 <img>(載入失敗自動移除,露出佔位);圖集格用背景圖定位。
function ldArt(key, cls) {
  var a = LD_ART[key], w = document.createElement('span'), url = ldArtUrl(key), im, c;
  w.className = 'ld-ph' + (cls ? ' ' + cls : '');
  w.setAttribute('data-art', key);
  w.textContent = a ? a.ph : '';
  if (!url) return w;
  if (a.ar) { w.style.width = 'auto'; w.style.aspectRatio = String(a.ar); }   // 圖集格不是正方形:以寬高比定寬(高度仍由 CSS 決定)
  if (a.cell) {
    c = a.cell;
    im = document.createElement('i');
    im.className = 'ld-ph-cell';
    im.style.backgroundImage = 'url(' + url + ')';
    im.style.backgroundSize = (c[2] * 100) + '% ' + (c[3] * 100) + '%';
    im.style.backgroundPosition = (c[2] > 1 ? (c[0] / (c[2] - 1) * 100) : 0) + '% ' + (c[3] > 1 ? (c[1] / (c[3] - 1) * 100) : 0) + '%';
    w.appendChild(im);
    return w;
  }
  im = document.createElement('img');
  im.setAttribute('alt', '');
  im.onerror = function () { if (im.parentNode) im.parentNode.removeChild(im); };
  im.src = url;
  w.appendChild(im);
  return w;
}
if (typeof module !== 'undefined' && module.exports) module.exports = { LD_ART: LD_ART, ldArtUrl: ldArtUrl };

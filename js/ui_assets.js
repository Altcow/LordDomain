// js/ui_assets.js — 卡牌版新畫面素材清單(純資料 + 取圖小工具)。由 tools/slice_cardui.py 產生,勿手改(重跑腳本會覆寫)。
// UI_ASSETS.files:檔名鍵 → [寬, 高](實體檔 assets/ui/<鍵>.webp);nav/short/item/bg:id → 檔名鍵;troop:兵種 → {label, ids, foot}(foot 為腳底位置比例 [x, y])。
var UI_ASSETS = {
  "base": "assets/ui/",
  "files": {
    "nav_march": [
      128,
      128
    ],
    "nav_team": [
      128,
      128
    ],
    "nav_pack": [
      128,
      128
    ],
    "nav_draw": [
      128,
      128
    ],
    "nav_event": [
      128,
      128
    ],
    "nav_more": [
      128,
      128
    ],
    "short_field": [
      128,
      128
    ],
    "short_arena": [
      128,
      128
    ],
    "short_tower": [
      128,
      128
    ],
    "short_quest": [
      128,
      128
    ],
    "short_mail": [
      128,
      128
    ],
    "short_settings": [
      128,
      128
    ],
    "item_newbie_pack": [
      128,
      128
    ],
    "item_quest_token": [
      128,
      128
    ],
    "item_event_ticket": [
      128,
      128
    ],
    "item_supply_pack": [
      128,
      128
    ],
    "item_forge_charm": [
      128,
      128
    ],
    "item_pass": [
      128,
      128
    ],
    "pp_spear_1": [
      265,
      360
    ],
    "pp_spear_2": [
      197,
      360
    ],
    "pp_spear_3": [
      188,
      360
    ],
    "pp_spear_4": [
      221,
      360
    ],
    "pp_spear_5": [
      201,
      360
    ],
    "pp_spear_6": [
      224,
      360
    ],
    "pp_cav_1": [
      228,
      360
    ],
    "pp_cav_2": [
      246,
      360
    ],
    "pp_cav_3": [
      222,
      360
    ],
    "pp_cav_4": [
      243,
      360
    ],
    "pp_cav_5": [
      235,
      360
    ],
    "pp_cav_6": [
      230,
      360
    ],
    "pp_shield_1": [
      232,
      360
    ],
    "pp_shield_2": [
      232,
      360
    ],
    "pp_shield_3": [
      219,
      360
    ],
    "pp_shield_4": [
      253,
      360
    ],
    "pp_shield_5": [
      216,
      360
    ],
    "pp_shield_6": [
      230,
      360
    ],
    "pp_bow_1": [
      220,
      360
    ],
    "pp_bow_2": [
      231,
      360
    ],
    "pp_bow_3": [
      231,
      360
    ],
    "pp_bow_4": [
      219,
      360
    ],
    "pp_bow_5": [
      242,
      360
    ],
    "pp_bow_6": [
      236,
      360
    ],
    "pp_strat_1": [
      188,
      360
    ],
    "pp_strat_2": [
      175,
      360
    ],
    "pp_strat_3": [
      216,
      360
    ],
    "pp_strat_4": [
      202,
      360
    ],
    "pp_strat_5": [
      173,
      360
    ],
    "pp_strat_6": [
      168,
      360
    ],
    "bg_stage_land": [
      1280,
      720
    ],
    "bg_stage_port": [
      720,
      1280
    ],
    "bigmap": [
      1448,
      1086
    ],
    "bg_home_port": [
      941,
      1672
    ],
    "bg_home_land": [
      1672,
      941
    ]
  },
  "nav": {
    "march": "nav_march",
    "team": "nav_team",
    "pack": "nav_pack",
    "draw": "nav_draw",
    "event": "nav_event",
    "more": "nav_more"
  },
  "short": {
    "field": "short_field",
    "arena": "short_arena",
    "tower": "short_tower",
    "quest": "short_quest",
    "mail": "short_mail",
    "settings": "short_settings"
  },
  "item": {
    "newbie_pack": "item_newbie_pack",
    "quest_token": "item_quest_token",
    "event_ticket": "item_event_ticket",
    "supply_pack": "item_supply_pack",
    "forge_charm": "item_forge_charm",
    "pass": "item_pass"
  },
  "bg": {
    "land": "bg_stage_land",
    "port": "bg_stage_port",
    "bigmap": "bigmap",
    "home_bg_port": "bg_home_port",
    "home_bg_land": "bg_home_land",
    "home_卡冊": null,
    "home_傳承": null,
    "home_熔爐": null,
    "home_裝備": null
  },
  "troop": {
    "spear": {
      "label": "槍兵",
      "ids": [
        "pp_spear_1",
        "pp_spear_2",
        "pp_spear_3",
        "pp_spear_4",
        "pp_spear_5",
        "pp_spear_6"
      ],
      "foot": [
        [
          0.615,
          0.994
        ],
        [
          0.619,
          0.994
        ],
        [
          0.722,
          0.992
        ],
        [
          0.715,
          0.994
        ],
        [
          0.785,
          0.994
        ],
        [
          0.736,
          0.994
        ]
      ]
    },
    "cav": {
      "label": "騎兵",
      "ids": [
        "pp_cav_1",
        "pp_cav_2",
        "pp_cav_3",
        "pp_cav_4",
        "pp_cav_5",
        "pp_cav_6"
      ],
      "foot": [
        [
          0.5,
          0.994
        ],
        [
          0.483,
          0.992
        ],
        [
          0.462,
          0.994
        ],
        [
          0.438,
          0.994
        ],
        [
          0.471,
          0.994
        ],
        [
          0.461,
          0.994
        ]
      ]
    },
    "shield": {
      "label": "盾兵",
      "ids": [
        "pp_shield_1",
        "pp_shield_2",
        "pp_shield_3",
        "pp_shield_4",
        "pp_shield_5",
        "pp_shield_6"
      ],
      "foot": [
        [
          0.683,
          0.994
        ],
        [
          0.626,
          0.992
        ],
        [
          0.709,
          0.994
        ],
        [
          0.629,
          0.994
        ],
        [
          0.75,
          0.994
        ],
        [
          0.772,
          0.994
        ]
      ]
    },
    "bow": {
      "label": "弓兵",
      "ids": [
        "pp_bow_1",
        "pp_bow_2",
        "pp_bow_3",
        "pp_bow_4",
        "pp_bow_5",
        "pp_bow_6"
      ],
      "foot": [
        [
          0.586,
          0.994
        ],
        [
          0.562,
          0.994
        ],
        [
          0.656,
          0.994
        ],
        [
          0.668,
          0.994
        ],
        [
          0.637,
          0.994
        ],
        [
          0.576,
          0.992
        ]
      ]
    },
    "strat": {
      "label": "謀士",
      "ids": [
        "pp_strat_1",
        "pp_strat_2",
        "pp_strat_3",
        "pp_strat_4",
        "pp_strat_5",
        "pp_strat_6"
      ],
      "foot": [
        [
          0.599,
          0.994
        ],
        [
          0.602,
          0.994
        ],
        [
          0.534,
          0.994
        ],
        [
          0.516,
          0.994
        ],
        [
          0.607,
          0.994
        ],
        [
          0.593,
          0.994
        ]
      ]
    }
  }
};

var __uiImgCache = {};
function uiAssetUrl(id) {
  if (!id || typeof id !== 'string') return null;
  var key = id;
  if (!UI_ASSETS.files[key]) {
    var groups = ['nav', 'short', 'item', 'bg'];
    for (var i = 0; i < groups.length; i++) {
      var g = UI_ASSETS[groups[i]];
      if (g && g.hasOwnProperty(id)) { key = g[id]; break; }
    }
  }
  if (!UI_ASSETS.files[key]) return null;
  return UI_ASSETS.base + key + '.webp';
}
function uiAssetImg(id) {
  var url = uiAssetUrl(id);
  if (!url || typeof Image === 'undefined') return null;
  var c = __uiImgCache[url];
  if (!c) {
    c = new Image();
    c.__failed = false;
    c.onerror = function () { c.__failed = true; };
    c.src = url;
    __uiImgCache[url] = c;
  }
  if (c.__failed) return null;
  return (c.complete && c.naturalWidth > 0) ? c : null;
}

const VERSION = 'v33';               // 每次發佈新版都要遞增：v1 → v2 → v3 …
const CACHE_PREFIX = 'lorddomain-';
const CACHE_NAME = CACHE_PREFIX + VERSION;
const PRECACHE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/style.css',
  './js/data.js',
  './js/units.js',
  './js/unitinfo.js',
  './js/wallskin.js',
  './js/theme_skin.js',
  './js/progdata.js',
  './js/cityonly.js',
  './js/cityscore_data.js',
  './js/cityscore.js',
  './js/goodsdata.js',
  './js/goods.js',
  './js/techtree_data.js',
  './js/nolevel_data.js',
  './js/citytech.js',
  './js/stratagems.js',
  './js/fishdata.js',
  './js/map.js',
  './js/mapio.js',
  './js/prog.js',
  './js/tech.js',
  './js/templates.js',
  './js/npc.js',
  './js/playerpool.js',
  './js/progmod_arch.js',
  './js/progmod.js',
  './js/path.js',
  './js/hazards.js',
  './js/td.js',
  './js/perf.js',
  './js/art.js',
  './js/glr.js',
  './js/art_objects.js',
  './js/art_units.js',
  './js/art_deco1.js',
  './js/art_deco2.js',
  './js/art_deco3.js',
  './js/art_deco4.js',
  './js/art_deco5.js',
  './js/art_nl.js',
  './js/art_port.js',
  './js/art_town.js',
  './js/art_set.js',
  './js/combos.js',
  './js/art_traffic.js',
  './js/art_wallskin.js',
  './js/art_theme.js',
  './js/render.js',
  './js/tddraw.js',
  './js/fishdraw.js',
  './js/fishing.js',
  './js/lifedata.js',
  './js/roster_data.js',
  './js/citylife.js',
  './js/ethnic_data.js',
  './js/crowdparts.js',
  './js/citytraffic.js',
  './js/talentpatrol.js',
  './js/cityfx_data.js',
  './js/cityfx.js',
  './js/objcat.js',
  './js/cityadvisor_data.js',
  './js/cityadvisor.js',
  './js/panorama.js',
  './js/audiodata.js',
  './js/audio.js',
  './js/audiocache.js',
  './js/bgm.js',
  './js/sfxwar.js',
  './js/ambient.js',
  './js/mymusic.js',
  './js/recorder.js',
  './js/ui.js',
  './js/nl_objects.js',
  './js/art_card.js',
  './js/panelmgr.js',
  './js/buildpreview.js',
  './js/techui.js',
  './js/saveslots.js',
  './js/savesui.js',
  './js/settingsui.js',
  './js/progui.js',
  './js/lordhallui.js',
  './js/carddata.js',
  './js/cards.js',
  './js/cardsui.js',
  './js/cityscoreui.js',
  './js/cityadvisorui.js',
  './js/guide.js',
  './js/mapedit.js',
  './js/battleui.js',
  './js/fishui.js',
  './js/petdata.js',
  './js/pet.js',
  './js/petdraw.js',
  './js/petui.js',
  './js/main.js',
  './js/pwa.js',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(PRECACHE.map((url) => new Request(url, { cache: 'reload' })))
    )
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k.startsWith(CACHE_PREFIX) && k !== CACHE_NAME).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        cache.match(req, { ignoreSearch: true }).then((hit) =>
          hit || fetch(req).catch(() => cache.match('./index.html'))
        )
      )
    );
    return;
  }
  event.respondWith(
    caches.open(CACHE_NAME).then((cache) =>
      cache.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req))
    )
  );
});

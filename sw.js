const VERSION = 'v14';               // 每次發佈新版都要遞增：v1 → v2 → v3 …
const CACHE_PREFIX = 'lorddomain-';
const CACHE_NAME = CACHE_PREFIX + VERSION;
const PRECACHE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/style.css',
  './js/data.js',
  './js/units.js',
  './js/progdata.js',
  './js/stratagems.js',
  './js/fishdata.js',
  './js/map.js',
  './js/mapio.js',
  './js/prog.js',
  './js/tech.js',
  './js/templates.js',
  './js/npc.js',
  './js/path.js',
  './js/hazards.js',
  './js/td.js',
  './js/art.js',
  './js/art_objects.js',
  './js/art_units.js',
  './js/art_deco1.js',
  './js/art_deco2.js',
  './js/art_deco3.js',
  './js/art_deco4.js',
  './js/render.js',
  './js/tddraw.js',
  './js/fishdraw.js',
  './js/fishing.js',
  './js/lifedata.js',
  './js/roster_data.js',
  './js/citylife.js',
  './js/panorama.js',
  './js/audiodata.js',
  './js/audio.js',
  './js/bgm.js',
  './js/sfxwar.js',
  './js/ambient.js',
  './js/mymusic.js',
  './js/recorder.js',
  './js/ui.js',
  './js/settingsui.js',
  './js/progui.js',
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

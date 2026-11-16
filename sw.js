// Offline support. App files (pages, styles, scripts, data) are fetched fresh whenever there is a connection, so every
// visit gets one consistent version; the saved copy is only used offline or when the network is too slow.
// Large files that never change (engine, piece art, icons) are served from the saved copy first.
// Bump the version when you upload changed files so installed copies drop their old cache.
const CACHE = 'game-review-v5';
const FILES = ['./', 'index.html', 'training.html', 'style.css', 'appearance.js', 'board.js', 'training.js', 'openings.json', 'puzzles.json', 'chess.js',
  'stockfish-19-lite-single.js', 'stockfish-19-lite-single.wasm', 'stockfish.js', 'manifest.webmanifest',
  'icon-180.png', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png',
  // the default piece set; other sets are saved the first time they are chosen
  ...['wK', 'wQ', 'wR', 'wB', 'wN', 'wP', 'bK', 'bQ', 'bR', 'bB', 'bN', 'bP'].map((p) => 'pieces/cburnett/' + p + '.svg')];
const STATIC = /(\.wasm|\.png|\.svg|\/stockfish[^/]*\.js)$/;

self.addEventListener('install', (e) => {
  // cache: 'reload' skips the browser's own HTTP cache, so a new version never saves a stale file
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES.map((f) => new Request(f, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return; // chess.com and fonts go straight to the network
  e.respondWith(caches.open(CACHE).then((c) => c.match(e.request, { ignoreSearch: true }).then((hit) => {
    const keep = (r) => { if (r.ok) c.put(e.request, r.clone()); return r; };
    if (STATIC.test(url.pathname)) return hit || fetch(e.request).then(keep);
    const fresh = fetch(e.request.url, { cache: 'no-cache' }).then(keep);
    if (!hit) return fresh;
    const slow = new Promise((res) => setTimeout(() => res(hit), 4000));
    return Promise.race([fresh.catch(() => hit), slow]);
  })));
});

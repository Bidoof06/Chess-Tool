// Offline support: keeps a copy of the app files, serves them instantly, and refreshes them in the background.
// Bump the version when you upload changed files so installed copies pick them up.
const CACHE = 'game-review-v4';
const FILES = ['./', 'index.html', 'training.html', 'style.css', 'appearance.js', 'board.js', 'training.js', 'openings.json', 'puzzles.json', 'chess.js', 'stockfish-19-lite-single.js', 'stockfish-19-lite-single.wasm',
  'stockfish.js', 'manifest.webmanifest', 'icon-180.png', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png',
  // the default piece set; other sets are cached the first time they are chosen
  ...['wK', 'wQ', 'wR', 'wB', 'wN', 'wP', 'bK', 'bQ', 'bR', 'bB', 'bN', 'bP'].map((p) => 'pieces/cburnett/' + p + '.svg')];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
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
    const fresh = fetch(e.request).then((r) => { if (r.ok) c.put(e.request, r.clone()); return r; }).catch(() => hit);
    return hit || fresh;
  })));
});

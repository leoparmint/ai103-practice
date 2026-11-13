/* Offline copy of both study sites: AI-103 at the top, Korean under korean/.

   Network first. With a connection, every request goes to the network exactly as it did before, so a new lesson or
   an edit shows up on the next load, and the copy saved here is refreshed along the way. The saved copy is used only
   when the network fails, answers with a server error, or takes longer than SLOW.

   Nothing here needs a version bump when content changes. Change VERSION only to throw the saved copies away. */
const VERSION = 'v1';
const PREFIX = 'ai103-practice-';   // leoparmint.github.io is shared with other project sites: only touch our own caches
const PAGES = PREFIX + 'pages-' + VERSION;
const FONTS = PREFIX + 'fonts-' + VERSION;
const SLOW = 4000;
const SLOW_MEMORY = 10000;
let slowAt = 0;   // when the network last took longer than SLOW
const SCOPE = self.registration.scope;
const abs = path => new URL(path, SCOPE).href;

// Each list is one site's content. Loading any page of a site refreshes the rest of its list, so the pages you
// didn't open are still from the same lesson when you next go offline.
const SITES = [
  ['./'],
  ['korean/', 'korean/deck.json', 'korean/notes.html'],
].map(site => site.map(abs));
// The Anki deck reader: saved once, since these files don't change
const FIXED = ['korean/vendor/jszip.min.js', 'korean/vendor/sql-wasm.js', 'korean/vendor/fzstd.js', 'korean/vendor/sql-wasm.wasm'].map(abs);
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

// One missing file must not stop everything else from being saved
const add = (cache, url) => cache.add(url).catch(() => {});

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(PAGES);
    await Promise.all([
      ...SITES.flat().map(url => add(cache, url)),
      ...FIXED.map(async url => (await cache.match(url, {ignoreVary: true})) || add(cache, url)),
    ]);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) {
      if (name.startsWith(PREFIX) && name !== PAGES && name !== FONTS) await caches.delete(name);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET' || req.headers.has('range')) return;
  const url = new URL(req.url);
  if (url.origin === location.origin) {
    if (req.url.startsWith(SCOPE)) event.respondWith(networkFirst(event));
  } else if (FONT_HOSTS.includes(url.hostname)) {
    event.respondWith(font(event, url));
  }
});

// A page can be asked for as its folder or as index.html, and opened with or without a query: all one saved copy
function savedAs(url, nav) {
  const u = new URL(url);
  u.hash = '';
  if (nav) u.search = '';
  u.pathname = u.pathname.replace(/\/index\.html$/, '/');
  return u.href;
}

async function networkFirst(event) {
  const req = event.request, nav = req.mode === 'navigate';
  const key = savedAs(req.url, nav);
  const cache = await caches.open(PAGES);
  const saved = await cache.match(key, {ignoreVary: true});
  const fresh = fetch(req).then(res => {
    if (res.status === 200 && res.type === 'basic' && !res.redirected) {
      const copy = res.clone();
      event.waitUntil(cache.put(key, copy).then(() => nav && refreshSite(cache, key)).catch(() => {}));
    }
    return res;
  });
  if (!saved) return fresh;
  // If the saved copy answers first, let the network finish anyway so the copy is current next time
  event.waitUntil(fresh.catch(() => {}));
  // The page just waited out a stalled network: don't make the deck it asks for next wait all over again
  if (Date.now() - slowAt < SLOW_MEMORY) return saved;
  return new Promise(done => {
    const timer = setTimeout(() => { slowAt = Date.now(); done(saved); }, SLOW);
    fresh.then(res => res.status >= 500 ? saved : res, () => saved).then(res => { clearTimeout(timer); done(res); });
  });
}

function refreshSite(cache, pageUrl) {
  const site = SITES.find(urls => urls.includes(pageUrl));
  return site ? Promise.all(site.filter(url => url !== pageUrl).map(url => add(cache, url))) : null;
}

/* Google Fonts. The page asks for the stylesheet without CORS, which could only be saved as an opaque copy that
   can't be checked; asking again with CORS (Google allows it) gives a normal response. */
async function font(event, url) {
  const cache = await caches.open(FONTS);
  const saved = await cache.match(url.href);
  const fresh = () => fetch(url.href, {mode: 'cors', credentials: 'omit'}).then(res => {
    if (res.status === 200) { const copy = res.clone(); event.waitUntil(cache.put(url.href, copy).catch(() => {})); }
    return res;
  });
  if (!saved) return fresh();
  // A font file never changes at its address. The stylesheet can, so use the saved one now and refresh it for next time.
  if (url.hostname === 'fonts.googleapis.com') event.waitUntil(fresh().catch(() => {}));
  return saved;
}

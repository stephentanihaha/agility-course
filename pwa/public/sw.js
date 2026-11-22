// Service worker: simpan aplikasi supaya bisa dibuka tanpa internet.
// Ganti VERSION setiap kali file aplikasi diperbarui.
const VERSION = 'v66';
const APP = 'course-agility-' + VERSION;
const FONTS = 'course-agility-fonts';
const SHELL = ['./', './index.html', './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png', './icons/maskable-512.png', './icons/apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(APP).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(k => k !== APP && k !== FONTS).map(k => caches.delete(k))
  )).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Font Google: simpan setelah pertama kali dimuat
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(caches.open(FONTS).then(async c => {
      const hit = await c.match(req);
      if (hit) return hit;
      try { const res = await fetch(req); if (res.ok || res.type === 'opaque') c.put(req, res.clone()); return res; }
      catch (err) { return new Response('', { status: 504 }); }
    }));
    return;
  }
  if (url.origin !== location.origin) return;
  // Halaman aplikasi: ambil versi terbaru dulu kalau ada internet, pakai salinan tersimpan kalau offline
  if (req.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('.html')) {
    e.respondWith(caches.open(APP).then(async c => {
      try { const res = await fetch(req, { cache: 'no-store' }); if (res.ok) { c.put('./index.html', res.clone()); } return res; }
      catch (err) { return (await c.match(req, { ignoreSearch: true })) || (await c.match('./index.html')) || new Response('Offline', { status: 503 }); }
    }));
    return;
  }
  // File lain (ikon, manifest): tampilkan versi tersimpan dulu, perbarui di belakang
  e.respondWith(caches.open(APP).then(async c => {
    const hit = await c.match(req, { ignoreSearch: true }) || (req.mode === 'navigate' ? await c.match('./index.html') : null);
    const net = fetch(req).then(res => { if (res.ok) c.put(req, res.clone()); return res; }).catch(() => null);
    return hit || (await net) || new Response('Offline', { status: 503 });
  }));
});

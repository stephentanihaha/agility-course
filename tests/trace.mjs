// Tes fitur jiplak gambar: upload gambar, cocokkan 2 pojok (mouse dan sentuh), cek posisi gambar di arena.
// Pakai: node scripts/build.mjs && node tests/trace.mjs
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');

const dist = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.webmanifest': 'application/manifest+json', '.png': 'image/png' };
const server = createServer((req, res) => {
  const p = join(dist, decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/\/$/, '/index.html'));
  if (!p.startsWith(dist) || !existsSync(p)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': TYPES[extname(p)] || 'application/octet-stream' }); res.end(readFileSync(p));
}).listen(0);
const url = `http://127.0.0.1:${server.address().port}/`;
const H = readFileSync(join(dist, 'index.html'), 'utf8').match(/var H='([0-9a-f]{64})'/)[1];

// Gambar uji 1000×800: arena 40×30 m digambar dari piksel (100,150) sampai (900,750), 20 px per meter.
const IMG = { w: 1000, h: 800, a: [100, 150], b: [900, 750] };
let fail = 0;
const check = (ok, label, extra = '') => { console.log(`${ok ? 'ok   ' : 'GAGAL'} ${label}${extra ? ' ' + extra : ''}`); if (!ok) fail++; };

async function run(name, ctxOpts, tap) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext(ctxOpts);
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(h => { try { localStorage.setItem('agility-unlock', h); } catch (e) {} }, H);
  await page.goto(url); await page.waitForSelector('html.unlocked');
  await page.evaluate(() => { course.w = 40; course.h = 30; commit(); });
  const png = await page.evaluate(({ w, h, a, b }) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
    x.fillStyle = '#fff'; x.fillRect(0, 0, w, h); x.strokeStyle = '#000'; x.lineWidth = 3; x.strokeRect(a[0], a[1], b[0] - a[0], b[1] - a[1]);
    x.fillStyle = '#d00'; x.beginPath(); x.arc(a[0] + 200, a[1] + 200, 8, 0, 7); x.fill(); return c.toDataURL('image/png').split(',')[1];
  }, IMG);
  await page.setInputFiles('#traceFile', { name: 'course.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
  await page.waitForFunction(() => !document.querySelector('#traceBanner').hidden);
  check(true, `${name}: upload membuka mode atur pojok`);
  await page.waitForTimeout(700); // tunggu scroll halus ke peta

  // posisi layar dari piksel gambar, lewat elemen <image> yang sedang tampil
  const screenOf = ([px, py]) => page.evaluate(([px, py]) => {
    const im = document.querySelector('#trace image'), s = document.querySelector('#arena');
    const x = +im.getAttribute('x') + px / trace.iw * +im.getAttribute('width'), y = +im.getAttribute('y') + py / trace.ih * +im.getAttribute('height');
    const p = s.createSVGPoint(); p.x = x; p.y = y; const q = p.matrixTransform(s.getScreenCTM()); return [q.x, q.y];
  }, [px, py]);
  for (const corner of [IMG.a, IMG.b]) {
    const [sx, sy] = await screenOf(corner);
    if (tap) await page.touchscreen.tap(sx, sy); else await page.mouse.click(sx, sy);
    await page.waitForTimeout(50);
  }
  const t = await page.evaluate(() => ({ calib: !!calib, x0: trace.x0, y0: trace.y0, x1: trace.x1, y1: trace.y1, msg: document.querySelector('#traceMsg').textContent, stored: !!localStorage.getItem('agility-trace') }));
  const err = Math.max(Math.abs(t.x0 - IMG.a[0]), Math.abs(t.y0 - IMG.a[1]), Math.abs(t.x1 - IMG.b[0]), Math.abs(t.y1 - IMG.b[1]));
  check(!t.calib && err < 6, `${name}: pojok tercocokkan`, `(selisih maks ${err.toFixed(1)} px gambar)`);
  check(/dicocokkan/.test(t.msg) && !/Perbandingan/.test(t.msg), `${name}: tanpa peringatan perbandingan sisi`);
  check(t.stored, `${name}: gambar tersimpan di localStorage`);
  // titik merah di (10,10) m harus jatuh di (10,10) m arena
  const red = await page.evaluate(() => { const im = document.querySelector('#trace image');
    return [+im.getAttribute('x') + 300 / trace.iw * +im.getAttribute('width'), +im.getAttribute('y') + 350 / trace.ih * +im.getAttribute('height')]; });
  check(Math.hypot(red[0] - 10, red[1] - 10) < 0.3, `${name}: titik uji di (10,10) m`, `(${red.map(v => v.toFixed(2)).join(', ')})`);
  // kode course dan ekspor tidak membawa gambar
  const leak = await page.evaluate(() => JSON.stringify(course).includes('data:image') || 'trace' in course);
  check(!leak, `${name}: course JSON bersih dari gambar`);
  // taruh rintangan di atas gambar masih bisa
  const before = await page.evaluate(() => course.items.length);
  await page.evaluate(() => setPlacing('jump'));
  const [px, py] = await screenOf([500, 450]);
  if (tap) await page.touchscreen.tap(px, py); else await page.mouse.click(px, py);
  await page.waitForTimeout(50);
  check(await page.evaluate(() => course.items.length) === before + 1, `${name}: taruh rintangan di atas gambar`);
  // muat ulang: gambar dan pojok tetap ada
  await page.reload(); await page.waitForSelector('html.unlocked');
  const again = await page.evaluate(() => !!document.querySelector('#trace image') && Math.abs(trace.x0 - 100) < 6 && !document.querySelector('#traceChip').hidden);
  check(again, `${name}: tetap ada setelah muat ulang`);
  check(!errors.length, `${name}: tanpa error JS`, errors.join(' | '));
  await browser.close();
}

await run('desktop', { viewport: { width: 1400, height: 900 } }, false);
await run('iPhone 13', { ...devices['iPhone 13'] }, true);
server.close();
console.log(fail ? `\n${fail} cek gagal.` : '\nSemua tes jiplak lolos.');
process.exit(fail ? 1 : 0);

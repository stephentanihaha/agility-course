// Tes regresi: contoh A1/A3/CH/HUB harus bersih di Cek FCI, dan generator harus menghasilkan course bersih.
// Pakai: node scripts/build.mjs && node tests/regression.mjs [jumlahGenerator=30]
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const dist = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
if (!existsSync(join(dist, 'index.html'))) { console.error('Jalankan dulu: node scripts/build.mjs'); process.exit(1); }
const GEN_RUNS = +process.argv[2] || 30;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.webmanifest': 'application/manifest+json', '.png': 'image/png' };
const server = createServer((req, res) => {
  const p = join(dist, decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/\/$/, '/index.html'));
  if (!p.startsWith(dist) || !existsSync(p)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': TYPES[extname(p)] || 'application/octet-stream' });
  res.end(readFileSync(p));
}).listen(0);
const url = `http://127.0.0.1:${server.address().port}/`;

// Hash passcode dibaca dari index.html supaya tes tidak perlu tahu passcode-nya.
const H = readFileSync(join(dist, 'index.html'), 'utf8').match(/var H='([0-9a-f]{64})'/)[1];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.addInitScript(h => { try { localStorage.setItem('agility-unlock', h); } catch (e) {} }, H);
await page.goto(url);
await page.waitForSelector('html.unlocked');

const badChecks = () => page.$$eval('#checks li.bad', els => els.map(e => e.textContent.trim()));
const tab = t => page.click(`.tabs [data-tab="${t}"]`);
let fail = 0;

for (const t of ['a1', 'a3', 'ch', 'hub']) {
  await tab('tpl'); await page.click(`.tplcard[data-tpl="${t}"]`); await tab('fci');
  const bad = await badChecks();
  console.log(`${bad.length ? 'GAGAL' : 'ok   '} contoh ${t}${bad.length ? ': ' + bad.join(' | ') : ''}`);
  if (bad.length) fail++;
}

// tombol Baru: arena kosong, ukuran tetap, Undo mengembalikan course lama
{
  await tab('tpl'); await page.click('.tplcard[data-tpl="ch"]');
  const before = await page.evaluate(() => ({ n: course.items.length, w: course.w, h: course.h, size: course.size }));
  await page.click('#newTop');
  const after = await page.evaluate(() => ({ n: course.items.length, s: course.seq.length, w: course.w, h: course.h, size: course.size, name: course.name }));
  await page.click('#undo');
  const back = await page.evaluate(() => course.items.length);
  const ok = after.n === 0 && after.s === 0 && after.w === before.w && after.h === before.h && after.size === before.size && after.name === 'Course baru' && back === before.n;
  console.log(`${ok ? 'ok   ' : 'GAGAL'} tombol Baru + Undo`); if (!ok) fail++;
}

let genBad = 0;
for (let i = 0; i < GEN_RUNS; i++) {
  await tab('gen');
  await page.click('#genBtn');
  await page.waitForFunction(() => !document.querySelector('#genBtn').disabled && document.querySelector('#genOut').textContent.trim(), null, { timeout: 60000 });
  await tab('fci');
  const bad = await badChecks();
  const weave = await page.evaluate(() => course.seq.some(s => (course.items.find(i => i.id === s.id) || {}).type === 'weave'));
  if (bad.length || !weave) { genBad++; console.log(`GAGAL generator #${i + 1}: ${weave ? '' : 'tanpa weave; '}${bad.join(' | ')}`); }
}
console.log(`${genBad ? 'GAGAL' : 'ok   '} generator ${GEN_RUNS - genBad}/${GEN_RUNS} bersih`);
if (genBad) fail++;

if (errors.length) { fail++; console.log('GAGAL error JS:\n  ' + [...new Set(errors)].join('\n  ')); }
await browser.close(); server.close();
console.log(fail ? `\n${fail} kelompok tes gagal.` : '\nSemua tes lolos.');
process.exit(fail ? 1 : 0);

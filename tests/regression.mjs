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

// Table sudah tidak ada di palet dan generator
{
  const t = await page.evaluate(() => !!document.querySelector('#palette [data-add="table"]') || !!document.querySelector('#genUse [data-u="table"]'));
  console.log(`${t ? 'GAGAL' : 'ok   '} table tidak ada di palet/generator`); if (t) fail++;
}

// Backside & Wrap: jalur memutari wing (tidak menembus), tombol berputar: aktif → sisi lain → mati
{
  const setC = c => page.evaluate(c => { course = migrate({ name: 'bs', w: 24, h: 30, speed: 4, mctSpeed: 2.5, size: 'M', cls: { level: 3, type: 'agility' }, ...c }); sel = null; commit(); }, c);
  // ukur ruas jalur ke step i: titik terjauh di belakang bidang jump, sisi wing, dan jarak terdekat ke tiang wing
  const probe = (i, wrapOut) => page.evaluate(([i, wrapOut]) => {
    const R = lastRoute, nd = R.nodes.find(n => n.kind === 'step' && n.n === i + 1), it = nd.it, c = nd.g.cp || [it.x, it.y];
    const a = wrapOut ? nd.g.tOut : nd.g.tIn, bar = rotv(rad(it), [1, 0]);
    const g = wrapOut ? R.segs.find(s => s.from === nd) : R.segs.find(s => s.to === nd);
    const posts = [add(c, bar, 1.05), add(c, bar, -1.05)];
    let far = 0, lat = 0, minPost = 9;
    for (const q of g.conn) { const v = sub(q, c), d = dot(v, a) * (wrapOut ? 1 : -1); if (d > far) { far = d; lat = dot(v, bar); }
      if (dist(q, wrapOut ? nd.g.exit : nd.g.entry) > 0.6) for (const p of posts) minPost = Math.min(minPost, dist(q, p)); }
    return { far, side: Math.sign(lat), minPost, coll: pathCollisions(R).length, st: course.seq[i] };
  }, [i, wrapOut]);
  let ok = true; const why = [];
  await setC({ items: [{ id: 'j1', type: 'jump', x: 7, y: 26, rot: 0 }, { id: 'j2', type: 'jump', x: 10, y: 19, rot: 0 }, { id: 'j3', type: 'jump', x: 16, y: 24, rot: 60 }],
    seq: [{ id: 'j1', dir: -1 }, { id: 'j2', dir: 0 }, { id: 'j3', dir: 0 }] });
  await page.evaluate(() => { sel = 'j2'; render(); });
  await page.click('#selbar [data-bs="1"]');
  const b1 = await probe(1, false);
  if (!(b1.st.bs === 1 && b1.st.dir && b1.far > 1.5 && b1.minPost > 0.7 && !b1.coll)) { ok = false; why.push('backside ' + JSON.stringify(b1)); }
  await page.click('#selbar [data-bs="1"]');
  const b2 = await probe(1, false);
  if (!(b2.st.bs === 2 && b2.side === -b1.side && b2.minPost > 0.7 && !b2.coll)) { ok = false; why.push('backside sisi lain ' + JSON.stringify(b2)); }
  await page.click('#selbar [data-bs="1"]');
  const b3 = await page.evaluate(() => course.seq[1]);
  if (b3.bs || b3.dir) { ok = false; why.push('backside mati ' + JSON.stringify(b3)); }
  await setC({ items: [{ id: 'j1', type: 'jump', x: 6, y: 20, rot: 90 }, { id: 'j2', type: 'jump', x: 13, y: 20, rot: 0 }, { id: 'j3', type: 'jump', x: 13, y: 26, rot: 0 }],
    seq: [{ id: 'j1', dir: 0 }, { id: 'j2', dir: -1 }, { id: 'j3', dir: 0 }] });
  await page.evaluate(() => { sel = 'j2'; render(); });
  await page.click('#selbar [data-wr="1"]');
  const w1 = await probe(1, true);
  if (!(w1.st.wr === 1 && w1.far > 1.5 && w1.minPost > 0.7 && !w1.coll)) { ok = false; why.push('wrap ' + JSON.stringify(w1)); }
  console.log(`${ok ? 'ok   ' : 'GAGAL'} backside & wrap${ok ? '' : ': ' + why.join(' | ')}`); if (!ok) fail++;
  await tab('tpl'); await page.click('.tplcard[data-tpl="a1"]'); // kembalikan arena normal untuk generator
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

// Bentuk versi PWA (dist/) dari satu sumber: src/app.html.
// Pakai: node scripts/build.mjs
// - src/app.html          = kode yang sama persis dengan artifact claude.ai
// - pwa/parts/head.html   = <head> PWA (manifest, ikon, meta)
// - pwa/parts/lock.html   = layar passcode (CSS + markup + skrip kunci)
// - pwa/parts/extra.js    = fitur khusus PWA (file .json, bagikan PNG, install, service worker)
// - pwa/public/           = sw.js, manifest, icons (disalin apa adanya)
import { readFileSync, writeFileSync, mkdirSync, cpSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = p => readFileSync(join(root, p), 'utf8');

let html = rd('src/app.html');
const head = rd('pwa/parts/head.html');
const lock = rd('pwa/parts/lock.html');
const extra = rd('pwa/parts/extra.js');

// Ganti satu potongan teks; gagal keras kalau jangkarnya tidak ketemu tepat sekali.
function swap(label, from, to) {
  const n = html.split(from).length - 1;
  if (n !== 1) throw new Error(`Jangkar "${label}" ditemukan ${n}x (harus 1x). Cek src/app.html.`);
  html = html.replace(from, () => to);
}

const REDUCE = '@media (prefers-reduced-motion:reduce){*{transition:none!important}}\n';
swap('akhir <style> utama + layar passcode', REDUCE + '</style>\n', REDUCE + lock);

swap('tombol install',
  '<div class="actions">\n      \n',
  '<div class="actions">\n      <div class="install" id="installBox" hidden><button class="btn primary" id="installBtn">Pasang aplikasi</button></div>\n');

swap('catatan simpan',
  '<p class="note">Tersimpan di browser ini saja.</p>',
  '<p class="note">Tersimpan di HP/komputer ini saja. Untuk pindah perangkat atau berbagi, pakai Unduh file course.</p>');

swap('tombol file .json',
  '<button class="btn" id="copyJson">Salin kode</button></div>\n          \n',
  '<button class="btn" id="copyJson">Salin kode</button></div>\n'
  + '          <div class="btngrid"><button class="btn" id="fileDl">Unduh file (.json)</button><label class="btn" for="fileIn" style="cursor:pointer;color:var(--fg);font-size:14px">Buka file</label></div>\n'
  + '          <button class="btn block" id="fileShare" hidden>Kirim file course…</button>\n'
  + '          <input type="file" id="fileIn" accept=".json,application/json" hidden>\n');

swap('tombol unduh/bagikan gambar',
  '<p class="note">Tekan lama gambar (HP) atau klik kanan (komputer) lalu pilih simpan gambar.</p>',
  '<div class="tools"><button class="btn primary" id="pngDl">Unduh gambar</button><button class="btn" id="pngShare" hidden>Bagikan…</button></div>');

swap('simpan blob PNG',
  "$('#ovImg').src=c.toDataURL('image/png');$('#ov').hidden=false;",
  "$('#ovImg').src=c.toDataURL('image/png');c.toBlob(b=>{pngBlob=b;});$('#ov').hidden=false;");

if (!html.endsWith('render();\n</script>\n')) throw new Error('src/app.html harus diakhiri "render();\\n</script>\\n".');
html = head + html.slice(0, -'</script>\n'.length) + '\n' + extra + '</script>\n</body>\n</html>\n';

// Cek versi: label di tab File harus sama dengan VERSION di sw.js.
const label = (html.match(/Versi aplikasi: (\d+)/) || [])[1];
const sw = (rd('pwa/public/sw.js').match(/const VERSION = 'v(\d+)'/) || [])[1];
if (!label || label !== sw) throw new Error(`Versi tidak cocok: label "Versi aplikasi: ${label}" vs sw.js VERSION 'v${sw}'.`);

const out = join(root, 'dist');
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
cpSync(join(root, 'pwa/public'), out, { recursive: true });
writeFileSync(join(out, 'index.html'), html);
console.log(`dist/ siap (versi ${label}, index.html ${Buffer.byteLength(html)} byte).`);

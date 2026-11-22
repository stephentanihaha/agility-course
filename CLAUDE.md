# Desainer Course Agility

Aplikasi web untuk mendesain course dog agility gaya Smarter Agility dengan aturan FCI.
Pemilik: Stephen (klub dog agility, calon juri FCI). Bahasa komunikasi: Indonesia santai ("gue/lo").
Teks di aplikasi juga berbahasa Indonesia.

## Struktur repo

```
src/app.html          SATU-SATUNYA sumber kode aplikasi (= isi artifact claude.ai, tanpa <head> PWA)
pwa/parts/head.html   <head> PWA: manifest, ikon, meta
pwa/parts/lock.html   layar passcode (CSS + markup + skrip kunci)
pwa/parts/extra.js    fitur khusus PWA: Unduh/Buka/Kirim file .json, unduh/bagikan PNG, tombol install, service worker
pwa/public/           sw.js, manifest.webmanifest, icons/ (disalin apa adanya ke dist/)
scripts/build.mjs     bentuk dist/ (PWA) dari src/app.html + pwa/
tests/regression.mjs  tes regresi Playwright
vercel.json           Vercel menjalankan build lalu menyajikan dist/
```

- `dist/` adalah hasil build, tidak di-commit.
- HTML + CSS + JS polos, tanpa framework, tanpa dependensi. Peta digambar dengan SVG dalam satuan meter.
- `build.mjs` menyisipkan bagian PWA lewat jangkar teks di `src/app.html`. Kalau jangkarnya berubah, build gagal dan menyebut jangkar mana yang hilang. Kalau mengubah teks di sekitar jangkar itu (akhir `<style>` utama, `<div class="actions">`, catatan "Tersimpan di browser ini saja.", tombol `#copyJson`, catatan simpan gambar di `#ov`, baris `toDataURL` di ekspor PNG, baris terakhir `render();</script>`), sesuaikan `build.mjs`.

## Perintah

```bash
node scripts/build.mjs              # bentuk dist/
node tests/regression.mjs           # tes (butuh dist/; generator 30x)
node tests/regression.mjs 5         # tes cepat, generator 5x
```

Playwright + Chromium sudah terpasang di container Claude Code. Di laptop: `npm i -D playwright && npx playwright install chromium`.

## Rilis

1. Ubah `src/app.html` (dan `pwa/` kalau perlu).
2. Naikkan label `Versi aplikasi: NN` di `src/app.html` **dan** `const VERSION = 'vNN'` di `pwa/public/sw.js`. Build menolak kalau keduanya beda.
3. `node scripts/build.mjs && node tests/regression.mjs`.
4. Deploy PWA: push ke GitHub (kalau project Vercel sudah tersambung ke repo ini), atau `npx vercel --prod` dari root repo.
5. Artifact claude.ai: publish `src/app.html` ke https://claude.ai/artifact/8GPuBTMCyEGWi9kMZ6gNdj (baca dulu versi live-nya, lalu publish dengan `url` itu).

- Vercel: project `agility-course`, team `timmy-zeus-team`, domain `agility-course.vercel.app`.
- `sw.js` memakai network-first untuk HTML. Kalau HP masih menampilkan versi lama, cek label versi di tab File.

## Passcode (hanya PWA)

- Ada di `pwa/parts/lock.html`. Yang disimpan hanya `H` = SHA-256 dari `'agility-course|' + passcode`. Passcode-nya ada di catatan pemilik, jangan ditulis di repo.
- Perangkat yang sudah benar diingat lewat `localStorage['agility-unlock'] = H`. Tes mengisi nilai ini sendiri.
- Ini kunci sisi klien, cukup untuk menahan orang umum, bukan keamanan sungguhan.

## Model data course (JSON)

```json
{
  "name": "...", "designer": "...", "w": 40, "h": 30,
  "speed": 3.5, "mctSpeed": 2.5, "size": "M",
  "cls": {"level": 1, "type": "agility"},
  "items": [{"id": "j1", "type": "jump", "x": 5, "y": 6, "rot": 325}],
  "seq": [{"id": "j1", "dir": 0, "wp": [[x, y]], "h": {"a": 0, "in": 1, "out": 1, "off": 0}}],
  "finWp": [[x, y]]
}
```

- `size` S/M/I/L. `cls.level` 1–3, `cls.type` agility/jumping. `migrate()` memperbarui format lama.
- Jenis (`DEFS`): start, finish, jump, spread, tire, wall, longjump, tunnel (`len` 3/4), ctunnel (`len` 5/6, `b1`/`b2` derajat lengkung; bentuk C/J saja, tidak boleh S), weave, aframe, dogwalk, teeter, table.
- `rot` (derajat), posisi saat `rot` 0:
  - jump: palang sepanjang sumbu x.
  - tunnel lurus, weave, dogwalk, aframe, teeter: memanjang sepanjang sumbu y.
  - ctunnel: tali busur sepanjang sumbu x.
  - longjump: papan horizontal (anjing bergerak sepanjang y).
- `seq` (rintangan boleh dipakai lebih dari sekali): `dir` 0 = otomatis, ±1 = searah/berlawanan sumbu. `wp` = titik belok. `h` = pegangan Bezier.
- Contoh bawaan: `A1`, `A3`, `CH`, `HUB` di `TEMPLATES` (+ `klub` dari `sample()`).

## Peta kode (`src/app.html`)

- **Jalur**:
  - `route()` menghasilkan `nodes`, `segs` (`conn`, `gap`, `straight`), `pts`, `pieces`, `len`, dan `count`.
  - `geom()` membentuk geometri tiap rintangan.
  - `cubic()` membentuk sambungan Hermite, radius belok `TURN={S:1.0,M:1.3,I:1.45,L:1.6}`.
  - `buildConn` mengurus titik belok dan menghindari wing. `clampCone` membatasi sudut lewat jump.
  - `NOLINE` = weave, tunnel, ctunnel, dogwalk, aframe, teeter, longjump (garis jalur tidak digambar di dalamnya).
- **Cek FCI**:
  - `renderChecks` menampilkan daftar cek.
  - `segBad` menandai jarak di luar 5–9 m atau lurus lebih dari 7 m.
  - `pathCollisions(R)` / `insideObs` mendeteksi tabrakan.
  - `handlerSides(R)` mengembalikan `steps` dan `sides` (Ki/Ka).
- **Perbaiki otomatis** (`#fixBtn`): `fixProblems`, `fixMoves`, `autoFix`.
- **Generator**: `genInventory`, `genBuild`, `genScore`, `genRepair`, `genRun` (async lewat `setTimeout`; `#genBtn` disabled selama jalan). Course hanya diterima kalau bersih dan berisi weave.
- **Gambar**: `DEFS[type].draw`, `itemsMarkup`, `pathMarkup`, `badgesMarkup`, `handMarkup`, `zonesMarkup`, `guideMarkup`, `bar()`.
- **Skema warna**: `SCHEMES` (kertas = "Default", rumput, bw, hard, flashy). `applyScheme()` mengisi `C` dan `F`.
- **Simulasi** (▶): `buildSim`, `simAt`, `simDraw`, `simLoop`.
  - Anjing: `vmax = max(3, speed×1,25)`, melambat di belokan dan di rintangan (`SIMF`), menunggu di teeter/table (`SIMWAIT`), meliuk di weave (`weavePts`).
  - Handler: `min(5,5 m/dtk, 90% vmax)`, akselerasi 4 m/dtk², menuju `spot` di sisi Ki/Ka, pindah target saat anjing 2,5 m dari rintangan.
- **Ukuran & sentuhan**:
  - `sizeSvg()` membuat peta pas satu layar. `HS`/`HSv` memperbesar pegangan di layar sentuh (`COARSE`).
  - `pinchStart`/`pinchEnd` mengurus pinch. `revealMap()` dan `focusStage()` memastikan peta kelihatan penuh.
- **HP & tablet**:
  - `html.sheetmode` aktif saat lebar < 760 atau layar sentuh < 1400. Panel muncul lewat `#mnav`.
  - Menu "Tampilan" muncul lewat container query `.stage` ≤ 735px.
- **localStorage**:
  - `agility-current`, `agility-saved`, `agility-scheme` (lama: `agility-field`), `agility-theme`, `agility-tab`, `agility-designer`, `agility-hidepath`, `agility-simhand`, `agility-hint-off`.
  - Khusus PWA: `agility-unlock`.

## Cara ngetes

- `tests/regression.mjs` menguji contoh A1/A3/CH/HUB tanpa `#checks li.bad`, generator N kali bersih dan berisi weave, dan tidak ada error JS.
- Manual / tambahan:
  - **Perbaiki otomatis**: acak beberapa rintangan, klik `#fixBtn`, lalu cek masalahnya hilang.
  - **HP**: emulasi iPhone 13 / iPad. Uji pinch dengan CDP `Input.dispatchTouchEvent`.
  - **Simulasi**: saat anjing 1,6 m sebelum masuk tiap rintangan, handler harus ada di sisi Ki/Ka yang benar.

## Ide berikutnya

- Fitur jiplak gambar: latar samar, cocokkan dua titik pojok, lalu taruh rintangan di atasnya.
- Database online (mis. Supabase) untuk sinkron antar perangkat dan dibagikan ke klub.
- Simulasi: split time per rintangan, dan gaya handling (front/rear/blind cross).
- Ekspor PDF peta kompetisi (A4/A3) dengan daftar rintangan.

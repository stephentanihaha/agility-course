# Desainer Course Agility

Aplikasi web untuk mendesain course dog agility gaya Smarter Agility dengan aturan FCI.
Pemilik: Stephen (klub dog agility, calon juri FCI). Bahasa komunikasi: Indonesia santai ("gue/lo").
Teks di kode ditulis dalam bahasa Indonesia; aplikasi punya pilihan bahasa ID/EN (lihat "Dua bahasa" di bawah).

## Struktur repo

```
src/app.html          SATU-SATUNYA sumber kode aplikasi (= isi artifact claude.ai, tanpa <head> PWA)
pwa/parts/head.html   <head> PWA: manifest, ikon, meta
pwa/parts/lock.html   layar passcode (CSS + markup + skrip kunci)
pwa/parts/extra.js    fitur khusus PWA: Unduh/Buka/Kirim file .json, unduh/bagikan PNG, tombol install, service worker
pwa/public/           sw.js, manifest.webmanifest, icons/ (disalin apa adanya ke dist/)
scripts/build.mjs     bentuk dist/ (PWA) dari src/app.html + pwa/
tests/regression.mjs  tes regresi Playwright
tests/trace.mjs       tes fitur jiplak gambar (desktop + iPhone 13)
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
node tests/trace.mjs                # tes jiplak gambar
```

Playwright + Chromium sudah terpasang di container Claude Code. Di laptop: `npm i -D playwright && npx playwright install chromium`.

## Rilis

1. Ubah `src/app.html` (dan `pwa/` kalau perlu).
2. Naikkan label `Versi aplikasi: NN` (`#verLabel`, tab File) di `src/app.html` **dan** `const VERSION = 'vNN'` di `pwa/public/sw.js`. Build menolak kalau keduanya beda.
3. `node scripts/build.mjs && node tests/regression.mjs && node tests/trace.mjs`.
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
- Jenis (`DEFS`): start, finish, jump, spread, tire, wall, longjump, tunnel (`len` 3/4), ctunnel (`len` 5/6, `b1`/`b2` derajat lengkung; bentuk C/J saja, tidak boleh S), weave, aframe, dogwalk, teeter, table. Table sudah dihapus dari palet dan generator (v59); `DEFS.table` tetap ada supaya course lama masih terbuka.
- `rot` (derajat), posisi saat `rot` 0:
  - jump: palang sepanjang sumbu x.
  - tunnel lurus, weave, dogwalk, aframe, teeter: memanjang sepanjang sumbu y.
  - ctunnel: tali busur sepanjang sumbu x.
  - longjump: papan horizontal (anjing bergerak sepanjang y).
- `seq` (rintangan boleh dipakai lebih dari sekali): `dir` 0 = otomatis, ±1 = searah/berlawanan sumbu. `wp` = titik belok. `h` = pegangan Bezier. `bs` = backside, `wr` = wrap (1 = sisi wing otomatis, 2 = sisi lain; hanya jump/spread/wall/tire).
- Contoh bawaan: `A1`, `A3`, `CH`, `HUB` di `TEMPLATES` (+ `klub` dari `sample()`).

## Peta kode (`src/app.html`)

- **Jalur**:
  - `route()` menghasilkan `nodes`, `segs` (`conn`, `gap`, `straight`), `pts`, `pieces`, `len`, dan `count`.
  - `geom()` membentuk geometri tiap rintangan.
  - `cubic()` membentuk sambungan Hermite, radius belok `TURN={S:1.0,M:1.3,I:1.45,L:1.6}`.
  - `buildConn` mengurus titik belok dan menghindari wing. `clampCone` membatasi sudut lewat jump.
  - **Backside/Wrap** (tombol di bar rintangan, v59): `autoWrap(A,B)` memberi titik bantu tak tersimpan di lingkaran sekitar tiang wing (jari-jari `max(1.1, TURN−0.1)` sejak v61, kerangka arah lari, pusat digeser ≥0,6 m ke sisi tolakan/mendarat). Backside: garis lurus menyinggung lingkaran → busur → keluar tepat di garis palang. Wrap: mendarat di garis palang → busur → lepas menyinggung ke rintangan berikutnya. Titik busur tiap ≤45°, disambung dengan pegangan busur persis (4/3·tan(Δ/4)·r) (v60). Rintangan sebelum backside diarahkan ke sisi luar wing. Aktif kalau `step.bs`/`step.wr` dipilih, **atau otomatis (v65)** kalau jalur bawaan menembus bidang jump-nya sendiri di dalam lebar palang+wing (`crossesOwn`), karena jalur seperti itu mustahil dilari. Sisi wing dipilih yang jalurnya terpendek dan tanpa tabrakan (`buildConn` mencoba kedua sisi); nilai 2 memaksa sisi sebaliknya. Jalur yang cuma menyerempet ujung wing tidak diubah. Sejak v66: garis menyinggung lingkaran dari titik bidik searah arah lari (`p0 + t0·L` untuk backside, `p1 − t1·L` untuk wrap, L ≤ 2,2 m) supaya lurus lalu masuk mulus; dan di `route()` jump berarah otomatis yang sambungannya butuh putaran dibandingkan dengan arah sebaliknya memakai sambungan sungguhan (`connCost`: panjang + belokan), jadi tidak memilih arah yang butuh backside lalu wrap berturut-turut. Contoh HUB digeser sedikit (jump #12, A-frame #16) supaya tetap bersih dengan aturan ini. `toggleBackside(i)` memaksa `dir` supaya anjing datang dari belakang palang. Kalau garis jalur ditarik, titik bantu disalin ke `wp` supaya bentuknya tidak loncat.
  - `NOLINE` = weave, tunnel, ctunnel, dogwalk, aframe, teeter, longjump (garis jalur tidak digambar di dalamnya).
- **Cek FCI**:
  - `renderChecks` menampilkan daftar cek.
  - `segBad` menandai jarak di luar 5–9 m atau lurus lebih dari 7 m. Ini sesuai *FCI Agility Judging Guidelines*: minimal 5 m di jalur anjing, maksimal 7 m garis lurus dan 9 m di jalur anjing (diukur dari titik keluar ke titik masuk).
  - **Jarak antar rintangan minimal 1 m** (v70, FCI Judging Guidelines; pengecualian tunnel di bawah dog walk/A-frame): `closePairs()` memodelkan tiap rintangan sebagai kapsul (`shapeOf`: titik + jari-jari) dan mengukur jarak bersih semua pasangan (`segSeg`). Ditandai garis merah putus-putus di peta (`closeMarkup`).
  - **Contact dimasuki dan ditinggalkan lurus** (v70; FCI: arah datang & kecepatan ke contact harus diperhitungkan): `contactCrooked(R)` — arah garis 1,5 m sebelum masuk maks 30° dari papan, 1,5 m sesudah keluar maks 45°. `buildConn` memberi pegangan minimal 2,2 m di ujung contact (`ko/ki` negatif di `cubic()` = panjang minimal).
  - Perbaiki otomatis (`fixProblems`/`fixMoves`) dan generator (`genScore`, `genRepair`: putar contact ±10–30°, dorong rintangan yang berdempetan; satu putaran tambahan kalau belum bersih; kalau tetap belum bersih, `autoFix` dijalankan) ikut kedua aturan ini. Contoh A1/CH/HUB disesuaikan sedikit supaya tetap bersih.
  - `pathCollisions(R)` / `insideObs` mendeteksi tabrakan.
  - `handlerSides(R)` mengembalikan `steps` dan `sides` (Ki/Ka).
- **Perbaiki otomatis** (`#fixBtn`): `fixProblems`, `fixMoves`, `autoFix`.
- **Generator**: `genInventory`, `genBuild`, `genScore`, `genRepair`, `genRun` (async lewat `setTimeout`; `#genBtn` disabled selama jalan). Course hanya diterima kalau bersih dan berisi weave.
- **Gambar**: `DEFS[type].draw`, `itemsMarkup`, `pathMarkup`, `badgesMarkup`, `handMarkup`, `zonesMarkup`, `guideMarkup`, `bar()`.
- **Skema warna**: `SCHEMES` (kertas = "Default", rumput, bw, hard, flashy). `applyScheme()` mengisi `C` dan `F`.
- **Simulasi** (▶): `buildSim`, `simAt`, `simDraw`, `simLoop`.
  - Anjing: `vmax = max(3, speed×1,25)`, melambat di belokan dan di rintangan (`SIMF`), menunggu di teeter/table (`SIMWAIT`), meliuk di weave (`weavePts`).
  - Handler: `min(5,5 m/dtk, 90% vmax)`, akselerasi 4 m/dtk², menuju `spot` di sisi Ki/Ka, pindah target saat anjing 2,5 m dari rintangan.
- **Penampil error** (v69): `showErr()` menampilkan error JS yang tidak tertangkap (`error`, `unhandledrejection`) sebagai kotak merah `#errToast` di bawah layar (ketuk untuk tutup), supaya bug khusus HP/Safari bisa dilaporkan lewat screenshot. Tombol ▶ (`#simBtn`) mengabaikan ketukan kedua dalam 450 ms (di Safari iPhone satu ketukan bisa terbaca dua kali → simulasi buka lalu langsung tutup) dan menangkap error `simOpen()`.
- **Ukuran & sentuhan**:
  - `sizeSvg()` membuat peta pas satu layar. `HS`/`HSv` memperbesar pegangan di layar sentuh (`COARSE`).
  - `pinchStart`/`pinchEnd` mengurus pinch. `revealMap()` dan `focusStage()` memastikan peta kelihatan penuh.
- **Ruang peta di layar lebar** (bukan `sheetmode`, ≥760 px; v64):
  - Header, bar alat, dan jarak antar-panel dirapatkan; palet satu kolom (96 px); panel kanan 330 px.
  - `#panelBtn` menyembunyikan panel kanan (≥1180 px, `html.panel-off`, disimpan di `agility-panel-off`).
  - `html.sidetools`: kalau ruang kosong di kiri-kanan peta setinggi penuh ≥92 px per sisi, `.stagebar` jadi kolom tipis melayang (Susun/Jalur di kiri; Tampilan, ▶, 👁, panel di kanan) supaya peta memakai seluruh tinggi. Diputuskan di `sizeSvg()`.
  - `#selbar` (bar rintangan terpilih) tidak menutupi peta (v67): `sizeSvg()` memindahkannya ke dalam `.stagebar` (`html.selinbar`). Bar alat di atas: satu baris bersama bar alat (geser ke samping kalau panjang), chip tampilan masuk menu Tampilan. Bar alat di samping (`sidetools`): tombol vertikal di kolom kiri di bawah Susun/Jalur. Di HP/tablet (`sheetmode`) `#selbar` kembali di bawah peta. Disembunyikan kalau tidak ada yang dipilih.
  - `.stage` memakai `grid-template-columns:minmax(0,1fr)` supaya isinya tidak melebarkan kotak peta.
- **HP & tablet**:
  - `html.sheetmode` aktif saat lebar < 760 atau layar sentuh < 1400. Panel muncul lewat `#mnav`.
  - Menu "Tampilan" muncul lewat container query `.stage` ≤ 735px.
- **Course baru**: `newCourse()` dipakai tombol `#newTop` (bar atas) dan `#newC` (tab File). Ukuran arena, kecepatan, kelas, dan ukuran anjing ikut course sebelumnya; course lama kembali lewat Undo. Di HP tegak, `#newTop`/`#undo`/`#pngTop` tampil sebagai ikon saja.
- **Jiplak gambar** (tab Course → "Jiplak gambar"):
  - Data di `agility-trace` (terpisah dari course, tidak ikut undo/kode/ekspor): `{src (dataURL JPEG, maks 2000 px), iw, ih, x0, y0, x1, y1, op, on}`. `(x0,y0)`/`(x1,y1)` = piksel gambar untuk pojok arena (0,0) dan (w,h); gambar diregangkan per sumbu, jadi ikut kalau ukuran arena diubah.
  - `traceDraw()` mengisi `<g id="trace">` (di antara `#field` dan `#layer`, `pointer-events="none"`) tanpa membangun ulang `<image>` tiap render.
  - Mode atur pojok: `calib` (`calibStart`, `calibTapAt`, `calibStop`), banner `#traceBanner`, `html.calib` memindah tombol zoom ke kiri supaya pojok kanan bawah bisa diketuk. Ketuk dua pojok berurutan; sesudahnya muncul peringatan kalau perbandingan sisi di gambar beda dari ukuran arena.
  - Lapisan SVG `#arena`: `#field` (lapangan + grid) → `#trace` → `#layer` (rintangan, jalur, pegangan) → `#ghost` → `#sim`.
- **Nomor versi**: badge `#appVer` di header (sebelah nama aplikasi) diisi dari `#verLabel` di tab File, jadi cukup ubah label itu.
- **Bar rintangan**: jump/spread/wall/tire tidak punya ⇄ Arah (arah diatur lewat Backside); Wrap hanya muncul kalau rintangan berikutnya ada di belakang jump (`wrapUseful`) atau Wrap sedang aktif. Tunnel/contact tetap punya ⇄ Arah. Tombol F membalik arah step pertama kalau ⇄ Arah tidak ada.
- **Dua bahasa (ID/EN)**, v62:
  - Pilihan di header (`.eyerow [data-lang]`) dan di tab File; disimpan di `agility-lang`. `setLang()` mengatur `<html lang>` dan judul halaman.
  - Kode tetap bahasa Indonesia. Saat EN, `MutationObserver` menerjemahkan semua teks yang tampil + `title`/`aria-label`/`placeholder` lewat `tr()`: kamus `I18N` (kunci = teks dengan angka diganti `¤`, angka diisi kembali berurutan, koma desimal → titik) lalu pola `I18N_RE` untuk teks yang panjangnya berubah (daftar nomor). Teks asli disimpan per node (`trMemo`) supaya balik ke ID tanpa muat ulang.
  - Elemen ber-`translate="no"` (nama course tersimpan) tidak diterjemahkan. Nilai input (nama course) tidak disentuh.
  - Teks di luar DOM yang ikut diterjemahkan: SVG ekspor gambar (`tr()` pada teks di markup), nama course dari generator dan tombol Baru.
  - **Teks UI baru wajib ditambahkan ke `I18N`** (atau `I18N_RE`). Cara cek: jalankan app dengan `localStorage['agility-lang']='"en"'` dan cari kata Indonesia yang tersisa.
- **localStorage**:
  - `agility-current`, `agility-saved`, `agility-scheme` (lama: `agility-field`), `agility-theme`, `agility-tab`, `agility-designer`, `agility-hidepath`, `agility-simhand`, `agility-hint-off`, `agility-trace`, `agility-lang`, `agility-panel-off`.
  - Khusus PWA: `agility-unlock`.

## Cara ngetes

- `tests/trace.mjs` menguji upload gambar, atur pojok dengan mouse dan ketuk (iPhone 13), posisi gambar, rintangan bisa ditaruh di atasnya, dan gambar tetap ada setelah muat ulang.
- `tests/regression.mjs` menguji contoh A1/A3/CH/HUB tanpa `#checks li.bad`, dua bahasa (EN menerjemahkan UI/peta, ID mengembalikan), bar rintangan (Arah/Backside/Wrap), tombol Baru + Undo, table hilang dari palet, Backside/Wrap memutari wing (jarak ke tiang > 0,45 m, tanpa tabrakan, siklus sisi lain lalu mati), wrap otomatis saat jalur balik menembus jump, jarak minimal 1 m & contact lurus, generator N kali bersih dan berisi weave, dan tidak ada error JS.
- Manual / tambahan:
  - **Perbaiki otomatis**: acak beberapa rintangan, klik `#fixBtn`, lalu cek masalahnya hilang.
  - **HP**: emulasi iPhone 13 / iPad. Uji pinch dengan CDP `Input.dispatchTouchEvent`.
  - **Simulasi**: saat anjing 1,6 m sebelum masuk tiap rintangan, handler harus ada di sisi Ki/Ka yang benar.

## Ide berikutnya

- Database online (mis. Supabase) untuk sinkron antar perangkat dan dibagikan ke klub.
- Simulasi: split time per rintangan, dan gaya handling (front/rear/blind cross).
- Ekspor PDF peta kompetisi (A4/A3) dengan daftar rintangan.

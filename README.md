# Landing page — falusa.web.id

Company profile / landing page statis. Tanpa build step, tanpa dependency, tanpa CDN.

## Struktur

```text
site/
├─ index.html
├─ bms.html
├─ campfire/           # subdomain campfire.falusa.web.id (document root: public_html/campfire)
│  ├─ index.html
│  ├─ play.html        # prototipe game survival (canvas 2D)
│  ├─ robots.txt
│  ├─ sitemap.xml
│  ├─ .htaccess        # no indexes, HTTPS redirect, security headers
│  └─ assets/
│     ├─ css/campfire.css
│     ├─ css/play.css
│     ├─ js/campfire.js
│     ├─ js/play.js
│     └─ img/favicon.svg
├─ assets/
│  ├─ css/style.css
│  ├─ css/bms.css
│  ├─ js/main.js
│  └─ img/
│     ├─ favicon.svg
│     └─ bms/*.webp
├─ .cpanel.yml        # task deploy cPanel Git Version Control
├─ .gitignore
└─ README.md
```

## Campfire (subdomain)

`campfire/` di-deploy ke `public_html/campfire` oleh `.cpanel.yml`, sehingga tersaji di
`https://campfire.falusa.web.id`.

- `index.html` — halaman produk: konsep game, penjelasan token, roadmap, FAQ.
- `play.html` — prototipe playable: canvas 2D, tanpa library, tanpa server.
  Kontrol: WASD/panah, Spasi untuk memotong/beri kayu/serang; tombol sentuh muncul di mobile.
  Rekor malam disimpan di `localStorage` (`campfire-best`).
- Belum ada wallet, token, maupun backend. Semua progres hanya di browser.

Pratinjau lokal: `http://localhost:8080/campfire/` dan `.../campfire/play.html`.

## Pratinjau lokal

Buka `index.html` langsung di browser, atau:

```bash
cd site
python -m http.server 8080
```

Lalu buka `http://localhost:8080`.

## Deploy via cPanel Git Version Control

Remote: `https://github.com/faridlukmans/falusa-web.git`

### Sekali saja (setup)

1. cPanel → **Files → Git Version Control** → **Create**.
2. Pilih **Clone a Repository**.
3. Isi:
   - **Clone URL**: `https://github.com/faridlukmans/falusa-web.git`
   - **Repository Path**: `/home/<USER_CPANEL>/repos/falusa-web` (di luar `public_html`)
   - **Repository Name**: `falusa-web`
4. Klik **Create**.
5. Buka **Manage** → tab **Pull or Deploy** → **Update from Remote**, lalu **Deploy HEAD Commit**.

`.cpanel.yml` akan menyalin `index.html`, `bms.html`, `assets/`, dan folder `campfire/`
ke `public_html`.

> Subdomain `campfire.falusa.web.id` harus dibuat lebih dulu di cPanel dengan document
> root `public_html/campfire`. Tanpa itu, folder tetap ter-deploy tetapi hanya bisa
> diakses lewat `https://falusa.web.id/campfire/`.

> Jika deploy gagal karena path tidak terbaca, ganti baris pertama `.cpanel.yml` menjadi:
> `export DEPLOYPATH="/home/<USER_CPANEL>/public_html"`, commit, push, lalu pull + deploy lagi.

### Deploy berikutnya

1. Edit file di folder `site/`.
2. `git add . && git commit -m "..." && git push`
3. cPanel → Git Version Control → **Manage** → **Update from Remote** → **Deploy HEAD Commit**.

## Fallback: File Manager

Jika Git belum siap: upload `index.html` + folder `assets/` ke `public_html`, timpa file lama.

## Catatan

- Semua aset lokal; tidak ada request ke CDN.
- Tema gelap default, tombol terang/gelap disimpan di `localStorage`.
- Tidak ada form/server-side; kontak memakai `mailto:`.
- Force HTTPS sudah aktif di server (HTTP → 301 HTTPS).
- Jangan commit kredensial/token. Untuk repo private, gunakan PAT read-only di cPanel.

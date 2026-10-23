# Landing page — falusa.web.id

Company profile / landing page statis. Tanpa build step, tanpa dependency, tanpa CDN.

## Struktur

```text
site/
├─ index.html
├─ bms.html
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

`.cpanel.yml` akan menyalin `index.html` dan `assets/` ke `public_html`.

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

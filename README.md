# Reviewwflow V4 — NFC Tap-to-Review SaaS

Mobile-first admin app + customer tap page + Cloudflare Worker backend.

## What's in this zip

| File | What it is |
|---|---|
| `index.html` | **Admin app** — Home · Clients · Cards · Sectors · 📦 Packs |
| `app.js` | Admin app logic |
| `packs.js` | Embedded business packs (S001 Bandra West, 85 stops) |
| `tap.html` | **Customer tap page** (NFC card opens this) |
| `template-generator.js` | Local AI review writer (Groq is only a background polisher) |
| `sw.js` / `manifest.json` / `icon-*.png` | PWA install support |
| `worker.js` | Cloudflare Worker backend (hardened V4) |
| `wrangler.toml` | Worker config |
| `sector-data/*.json` | Offline fallback data |

## Deploy — GitHub Pages (frontend)

1. Upload **all files except `worker.js` / `wrangler.toml`** to the `REVIEWFLOWW` repo root (same way V3 was uploaded).
2. Wait ~1 min → open `https://phemotrix.github.io/REVIEWFLOWW/` on the phone.
3. If the phone cached the old version: close the tab fully and reopen (the V4 service worker auto-clears old caches on update).

## Deploy — Cloudflare Worker (backend, REQUIRED for V4 security)

The V4 worker strips the old debug info leak and adds rate limiting + input validation. Deploy it:

1. `npx wrangler login` (one time)
2. `npx wrangler deploy` from this folder
3. Set secrets (never in files):
   - `npx wrangler secret put ADMIN_KEY` → your admin password
   - `npx wrangler secret put GROQ_KEY` → your Groq API key
4. Create KV namespace `BUSINESS_CONFIGS` and bind it in `wrangler.toml` if starting fresh.

## First run on the phone

1. Open the app → **Home** → paste Worker URL + admin password → **Test connection** (must show green).
2. **Sectors** → open any sector → paste the day's pack (from Muse) → **📥 Load pack** → **🧭 Build route order**.
3. Or use the **📦 Packs** tab: paste once, **Save pack**, then **▶ Open route** any day.

## Daily workflow

1. Tell Muse the area: sector id (e.g. `S042`), "next area", or any Mumbai locality.
2. Muse researches 70–80 high-end businesses (100–1000 Google reviews) and sends a pack block.
3. Paste it in the **📦 Packs** tab → Save → Open route → pitch.

## Security notes

- Admin actions need `X-Admin-Key`; wrong keys get generic errors (no info leak).
- Rate limits: 90 config/min, 10 reviews/10 min, 30 admin/min per IP (in-memory — for heavy use, add Cloudflare dashboard rate limiting).
- Secrets live only in Cloudflare, never in these files.
- Admin password: keep it strong and unique.

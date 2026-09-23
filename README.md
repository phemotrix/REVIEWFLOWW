# VORTRIX — NFC Tap-to-Review System v2

Two sides, two pages. Deploy the whole folder to GitHub Pages (or any static host).

## YOUR SIDE — `index.html` (the admin tool, mobile-first)

Open this on your phone. Bottom nav: **Home · Clients · Cards · Map**.

- **Home** — stats (clients, cards issued, pitched, bought, conversion %, monthly recurring), tap-system connection (Worker URL + admin password), backup export/import.
- **Clients** — add/edit clients (name, category, phone, address, Google review link, monthly fee). Call / WhatsApp straight from the card. **Publish** pushes the client's review page live to your Cloudflare Worker. The link button copies the tap link to program on the NFC card.
- **Cards** — NFC card inventory: code (VRTX-001…), assigned client, status (in stock / issued / lost). Copy the tap link per card when programming it.
- **Map** — Mumbai split into 9 pitch zones (South Mumbai, Bandra·Khar, Andheri West, Powai·Andheri East, Dadar·Central, Ghatkopar·Vikhroli, Malad·Borivali, Thane·Mulund, Navi Mumbai). Flow per zone:
  1. Open the zone → **Research businesses** — pulls real restaurants, cafes, salons, clinics, gyms, hotels & shops from OpenStreetMap around the zone. Tick the ones worth pitching (aim 50–70) → Add.
  2. **Build route order** — uses your GPS as the start, optimizes the stop order (real road distances via OSRM, 2-opt) → stops numbered 1, 2, 3…
  3. Work the route: per stop → Pitched / Bought / No + 1-line note, navigate button opens Google Maps to that stop. The Maps button opens the next 9 unvisited stops as one Google Maps route.
  4. Progress bar + stats feed back to Home.
- **Sectors** — Mumbai split into **100 micro-sectors** (T1 premium first, then T2, then T3; one sector = one pitch day). Flow per sector:
  1. Open a sector → **🔍 Find businesses** — pulls real businesses from **live OSM data** (via Overpass, ~2 km radius). Tick the good ones → Add selected.
  2. **🧭 Build route order** — GPS start, NN + 2-opt over OSRM road distances → stops numbered 1, 2, 3…
  3. A **live 3D map** (MapLibre GL, pitched 3D buildings) shows every stop in route order with the route line. Same per-stop workflow: Pitched / Bought / No + note, per-stop Google Maps navigation, Maps button for the next 9 stops.
  4. Honest by design: OSM has no Google review counts and coverage varies — the UI says so. Nothing is fabricated.

All admin data lives in your browser's localStorage — use **Export** on Home for backups.

## CUSTOMER SIDE — `tap.html` (NFC tap page)

This is what opens when a customer taps a programmed NFC card. You never need to open it yourself. It reads `?biz=<client-slug>` → loads the business config from your Cloudflare Worker → 4 quick questions → AI-drafted review → copy & open Google reviews.

## Backend — `worker.js`

Cloudflare Worker (unchanged from v1): serves business configs from KV, generates reviews via Groq with offline fallback. Deploy per the old instructions, bind KV `BUSINESS_CONFIGS`, set secrets `GROQ_API_KEY` + `ADMIN_PASSWORD`, then paste the Worker URL into the admin app on Home.

## Files

| File | What |
|---|---|
| `index.html` + `app.js` | Your admin tool (open this) |
| `tap.html` + `template-generator.js` | Customer tap page (NFC cards point here) |
| `worker.js` + `wrangler.toml` | Cloudflare backend |
| `manifest.json`, `icon.svg`, `sw.js` | PWA bits for the tap page |
| `_legacy/` | Old v1 admin + sales map (superseded, not deployed) |

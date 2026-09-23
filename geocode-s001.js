// Geocode S001 businesses via Nominatim, then NN + 2-opt route ordering.
// Run: node geocode-s001.js
const fs = require("fs");
const path = require("path");
const DIR = __dirname;
const raw = JSON.parse(fs.readFileSync(path.join(DIR, "S001-raw.json"), "utf8"));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const UA = "VORTRIX-sales-research/1.0 (contact: sales-research)";

async function geocode(query) {
  const url =
    "https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=in" +
    "&viewbox=72.79,19.10,72.87,19.02" +
    "&q=" + encodeURIComponent(query);
  const r = await fetch(url, { headers: { "User-Agent": UA } });
  if (!r.ok) return null;
  const j = await r.json();
  if (j && j.length) return { lat: +j[0].lat, lon: +j[0].lon };
  return null;
}

function hav(a, b) {
  const R = 6371, dLa = ((b.lat - a.lat) * Math.PI) / 180;
  const dLo = ((b.lon - a.lon) * Math.PI) / 180;
  const s =
    Math.sin(dLa / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLo / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

(async () => {
  const out = [];
  let approx = 0;
  for (let i = 0; i < raw.length; i++) {
    const b = raw[i];
    let g = await geocode(`${b.name}, ${b.area}, Bandra West, Mumbai, Maharashtra, India`);
    await sleep(1100);
    let method = "name";
    if (!g) {
      g = await geocode(`${b.area}, Bandra West, Mumbai, Maharashtra, India`);
      await sleep(1100);
      method = "area";
    }
    if (!g) {
      g = { lat: 19.0596, lon: 72.8295 };
      method = "sector-center";
      approx++;
    }
    out.push({ ...b, lat: +g.lat.toFixed(6), lon: +g.lon.toFixed(6), geo: method });
    console.log(`${i + 1}/${raw.length} ${b.name} -> ${g.lat.toFixed(4)},${g.lon.toFixed(4)} [${method}]`);
  }

  // Nearest-neighbour from Bandra Station West, then 2-opt
  const start = { lat: 19.0603, lon: 72.8413 };
  const rem = out.slice(), order = [];
  let cur = start;
  while (rem.length) {
    let bi = 0, bd = Infinity;
    for (let i = 0; i < rem.length; i++) {
      const d = hav(cur, rem[i]);
      if (d < bd) { bd = d; bi = i; }
    }
    order.push(rem.splice(bi, 1)[0]);
    cur = order[order.length - 1];
  }
  // 2-opt
  const dist = (o) => {
    let d = hav(start, o[0]);
    for (let i = 0; i < o.length - 1; i++) d += hav(o[i], o[i + 1]);
    return d;
  };
  let improved = true, guard = 0;
  while (improved && guard++ < 40) {
    improved = false;
    for (let i = 0; i < order.length - 1 && !improved; i++) {
      for (let j = i + 1; j < order.length && !improved; j++) {
        const c = order.slice();
        for (let a = i, b2 = j; a < b2; a++, b2--) { const t = c[a]; c[a] = c[b2]; c[b2] = t; }
        if (dist(c) < dist(order) - 1e-9) { order.splice(0, order.length, ...c); improved = true; }
      }
    }
  }

  const totalKm = dist(order);
  console.log(`\nOptimized route: ${order.length} stops, ${totalKm.toFixed(1)} km, ${approx} approx-geocoded`);

  const stops = order.map((s, i) => ({
    stop: i + 1, name: s.name, cat: s.cat, rating: s.rating,
    reviews: s.reviews, area: s.area, lat: s.lat, lon: s.lon,
    status: "todo", note: ""
  }));
  fs.writeFileSync(
    path.join(DIR, "S001-bandra-west.json"),
    JSON.stringify({ sector: "S001", name: "Bandra West", updated: "2026-09-24",
      start: { name: "Bandra Station (W)", lat: start.lat, lon: start.lon },
      count: stops.length, totalKm: +totalKm.toFixed(1), stops }, null, 1)
  );
  const md = ["# S001 · Bandra West — pitch route (85 stops, " + totalKm.toFixed(1) + " km)",
    "", "Start: Bandra Station (W). Order optimized NN + 2-opt.", "",
    "| # | Business | Category | ★ | Reviews | Area |",
    "|---|---|---|---|---|---|"]
    .concat(stops.map((s) => `| ${s.stop} | ${s.name} | ${s.cat} | ${s.rating} | ${s.reviews} | ${s.area} |`))
    .join("\n");
  fs.writeFileSync(path.join(DIR, "S001-bandra-west-route.md"), md);
  console.log("WROTE S001-bandra-west.json + S001-bandra-west-route.md");
})().catch((e) => { console.error("FATAL", e); process.exit(1); });

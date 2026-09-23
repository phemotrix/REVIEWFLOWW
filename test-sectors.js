/* Sectors feature logic test (Overpass is proxy-blocked in this sandbox,
   so this validates: (1) the generated QL for S001, (2) the exact response
   transform used by sectorResearch() against a canned Overpass-style fixture,
   (3) the route optimizer on sample points). */
const fs = require("fs");
const vm = require("vm");

// ---- stub browser globals so app.js can load in Node ----
const store = {};
global.localStorage = { getItem: k => store[k] || null, setItem: (k, v) => { store[k] = v; } };
global.document = {
  addEventListener() {}, getElementById() { return null; },
  querySelectorAll() { return []; }, createElement() { return {}; }, body: {}
};
global.window = {}; global.navigator = {};
global.location = { href: "http://localhost/index.html" };
global.fetch = async () => { throw new Error("no network in test"); };

const src = fs.readFileSync(__dirname + "/../app.js", "utf8");
vm.runInThisContext(src, { filename: "app.js" });

let fails = 0;
function check(name, cond) {
  console.log((cond ? "PASS" : "FAIL") + " — " + name);
  if (!cond) fails++;
}

// 1. QL generation for S001 (Bandra West centre)
const S001 = { lat: 19.0596, lon: 72.8295 };
const ql = sectorOverpassQL(S001);
console.log("--- generated QL for S001 ---\n" + ql + "\n---");
check("QL contains around:2000,19.0596,72.8295", ql.includes("around:2000,19.0596,72.8295"));
check("QL uses nwr (nodes+ways+relations)", ql.includes('nwr["shop"'));
check("QL requests centers for ways/relations", ql.includes("out center 150"));
check("QL covers required tags", ["amenity", "leisure", "tourism", "office"].every(t => ql.includes(t)));

// 2. Transform a canned Overpass response (mirrors sectorResearch() parsing)
const fixture = { elements: [
  { type: "node", id: 11, lat: 19.0600, lon: 72.8300, tags: { name: "Cafe Test", amenity: "cafe", "addr:street": "Linking Rd" } },
  { type: "way", id: 22, center: { lat: 19.06005, lon: 72.83004 }, tags: { name: "Cafe Test", shop: "bakery" } }, // dupe by name+proximity
  { type: "way", id: 23, center: { lat: 19.0750, lon: 72.8450 }, tags: { name: "Cafe Test", shop: "bakery" } }, // same name, far -> kept
  { type: "relation", id: 24, center: { lat: 19.0620, lon: 72.8320 }, tags: { name: "  Hotel  Grand  ", tourism: "hotel" } },
  { type: "node", id: 25, lat: 19.0630, lon: 72.8330, tags: { amenity: "cafe" } }, // no name -> dropped
  { type: "node", id: 26, lat: 19.0640, lon: 72.8340, tags: { name: "Gym One", leisure: "fitness_centre" } },
  { type: "node", id: 27, lat: 19.0650, lon: 72.8350, tags: { name: "Law Associates", office: "lawyer" } }
]};
// --- verbatim transform from sectorResearch() in app.js ---
const seen = {};
const results = [];
const s = S001, have = {};
fixture.elements.forEach(function (e) {
  if (!e.tags || !e.tags.name) return;
  const lat = e.lat || (e.center && e.center.lat);
  const lon = e.lon || (e.center && e.center.lon);
  if (!lat || !lon) return;
  const oid = "sec" + e.type[0] + e.id;
  if (have[oid]) return;
  const norm = e.tags.name.toLowerCase().trim().replace(/\s+/g, " ");
  const key = norm + "|" + lat.toFixed(3) + "," + lon.toFixed(3);
  if (seen[key]) return;
  seen[key] = 1;
  results.push({
    oid: oid, name: e.tags.name, cat: catLabel(e.tags),
    lat: lat, lon: lon, addr: addrOf(e.tags),
    dist: hav({ lat: s.lat, lon: s.lon }, { lat: lat, lon: lon })
  });
});
results.sort(function (a, b) { return a.dist - b.dist; });
// --- end verbatim ---
check("dedupe: 7 elements -> 5 results (1 dupe merged, 1 nameless dropped)", results.length === 5);
check("way center fallback works", results.some(r => r.oid === "secw23"));
check("catLabel: cafe", results.find(r => r.oid === "secn11").cat === "Cafe");
check("catLabel: office", results.find(r => r.oid === "secn27").cat === "Lawyer office");
check("addrOf picks street", results.find(r => r.oid === "secn11").addr === "Linking Rd");
check("results sorted by distance ascending", results.every((r, i) => i === 0 || results[i - 1].dist <= r.dist));
check("oid prefixes encode element type", ["secn11", "secw23", "secr24"].every(id => results.some(r => r.oid === id)));

// 3. Route optimizer on 6 sample Bandra points (pure JS, no network)
const pts = [
  { lat: 19.0600, lon: 72.8300 }, { lat: 19.0650, lon: 72.8280 },
  { lat: 19.0550, lon: 72.8350 }, { lat: 19.0700, lon: 72.8320 },
  { lat: 19.0520, lon: 72.8250 }, { lat: 19.0620, lon: 72.8380 }
];
const order = routeOrder(null, { lat: 19.0596, lon: 72.8295 }, pts);
check("optimizer returns all 6 indices exactly once",
  order.length === 6 && new Set(order).size === 6);
let tourLen = 0, prev = { lat: 19.0596, lon: 72.8295 };
order.forEach(i => { tourLen += hav(prev, pts[i]); prev = pts[i]; });
console.log("optimized tour length from sector center: " + tourLen.toFixed(2) + " km");
check("tour length sane (< 15 km for 6 Bandra stops)", tourLen < 15);

// 4. sectors.json sanity (built earlier)
const sectors = JSON.parse(fs.readFileSync(__dirname + "/sectors.json", "utf8"));
check("sectors.json has 100 entries", sectors.length === 100);
check("all 100 have numeric lat/lon",
  sectors.every(x => typeof x.lat === "number" && typeof x.lon === "number"));
check("all within Mumbai bbox",
  sectors.every(x => x.lat > 18.85 && x.lat < 19.35 && x.lon > 72.75 && x.lon < 73.15));
check("S001 = known Bandra West coords",
  sectors[0].id === "S001" && sectors[0].lat === 19.0596 && sectors[0].lon === 72.8295);

console.log(fails ? "\n" + fails + " FAILURES" : "\nALL CHECKS PASSED");
process.exit(fails ? 1 : 0);

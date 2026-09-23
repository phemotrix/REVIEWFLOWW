// Test harness for the v3 sector safeguards (thin-result retry, widen,
// manual-add normalization, curated loader). Loads real app.js in a vm sandbox.
const fs = require("fs");
const vm = require("vm");
const path = require("path");

const src = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
const s001raw = fs.readFileSync(path.join(__dirname, "S001-bandra-west.json"), "utf8");
const sectorsRaw = fs.readFileSync(path.join(__dirname, "sectors.json"), "utf8");

// ---- minimal browser stubs ----
const el = () => ({ style:{}, classList:{add(){},remove(){}}, textContent:"", innerHTML:"", value:"",
  onclick:null, scrollTop:0, appendChild(){}, querySelectorAll(){return[];} });
const documentStub = {
  getElementById: () => el(),
  querySelectorAll: () => [],
  createElement: () => el(),
  body: { style:{} },
  addEventListener: () => {},
};
const fetchStub = async (url) => {
  const u = String(url);
  if (u.includes("S001-bandra-west.json"))
    return { ok:true, json: async () => JSON.parse(s001raw) };
  if (u.includes("sectors.json"))
    return { ok:true, json: async () => JSON.parse(sectorsRaw) };
  return { ok:false, status:404, json: async () => ({}) };
};
const sandbox = {
  console, setTimeout, clearTimeout, Promise, JSON, Date, Math, encodeURIComponent,
  document: documentStub,
  window: {},
  localStorage: { getItem:()=>null, setItem(){}, removeItem(){} },
  fetch: fetchStub,
  navigator: {},
  openModal: () => {}, closeModal: () => {}, toast: () => {},
  save: () => {},
};
vm.createContext(sandbox);
vm.runInContext(src, sandbox, { filename: "app.js" });

let pass = 0, fail = 0;
function check(name, cond, extra){
  if (cond) { pass++; console.log("PASS", name); }
  else { fail++; console.log("FAIL", name, extra||""); }
}

(async () => {
  await sandbox.loadSectors();
  vm.runInContext('currentSector = "S001"', sandbox);
  const s = sandbox.sectorById("S001");
  check("sectorById S001 found", !!s && s.id === "S001");

  // 1. curated loader accepts S001-bandra-west.json shape
  const cur = await sandbox.sectorCuratedData(s);
  check("curated S001 parsed 85 entries", cur.length === 85, "got "+cur.length);
  check("curated keeps rating/reviews", cur[0].rating && cur[0].reviews,
    JSON.stringify(cur[0]));
  check("curated keeps lat/lon", cur.every(c => c.lat && c.lon));
  check("curated addr from area", cur[0].addr && cur[0].addr.length > 0, cur[0].addr);
  check("curated flagged", cur.every(c => c.curated === true));

  // 2. sectorLoadCurated adds stops + idempotent dedupe
  await sandbox.sectorLoadCurated();
  const stops = sandbox.sectorStops("S001");
  check("loadCurated added 85 stops", stops.length === 85, "got "+stops.length);
  await sandbox.sectorLoadCurated();
  check("loadCurated dedupes (still 85)", sandbox.sectorStops("S001").length === 85,
    "got "+sandbox.sectorStops("S001").length);

  // 3. collectSectorProspects: fixture Overpass response, excludes existing stops
  const fixture = { elements: [
    { type:"node", id:111, lat:19.06, lon:72.83,
      tags:{ name:"Bespoke Salon", shop:"beauty" } },       // already in stops -> excluded
    { type:"node", id:222, lat:19.061, lon:72.831,
      tags:{ name:"New Fake Cafe", amenity:"cafe", "addr:street":"Hill Rd" } },
    { type:"node", id:333, tags:{ name:"No Coords Place", amenity:"cafe" } }, // no lat/lon -> dropped
    { type:"node", id:444, lat:19.062, lon:72.832, tags:{ amenity:"cafe" } }, // no name -> dropped
    { type:"way", id:555, center:{lat:19.063, lon:72.833},
      tags:{ name:"Way Spa", leisure:"spa" } },
  ]};
  const pros = sandbox.collectSectorProspects(s, fixture);
  check("collect excludes existing+drops bad rows", pros.length === 2,
    "got "+pros.length+": "+pros.map(p=>p.name).join(","));
  check("collect keeps cat/addr", pros.some(p=>p.cat) , JSON.stringify(pros[0]));

  // 4. mergeProspects dedupes by oid and sorts by dist
  const base = [{oid:"a", dist:2}, {oid:"b", dist:1}];
  const merged = sandbox.mergeProspects(base.slice(), [{oid:"b", dist:0.5}, {oid:"c", dist:1.5}]);
  check("merge dedupes+sorts", merged.length===3 && merged[0].oid==="b" && merged[2].oid==="a",
    JSON.stringify(merged.map(m=>m.oid)));

  // 5. overpassQL radius param
  const q2 = sandbox.sectorOverpassQL(s);
  const q5 = sandbox.sectorOverpassQL(s, 5000);
  check("QL default radius 2000", q2.indexOf("around:2000,")>=0);
  check("QL custom radius 5000", q5.indexOf("around:5000,")>=0);

  // 6. manual confirm adds a stop with manual tag (no network needed)
  vm.runInContext('sectorManualCands = ' + JSON.stringify(
    [{name:"Test Manual Shop", cat:"Salon", lat:19.07, lon:72.84, addr:"Hill Rd", full:"Test"}]), sandbox);
  sandbox.sectorConfirmManual(0);
  const man = sandbox.sectorStops("S001").find(p => p.manual);
  check("manual add works with manual tag", !!man && man.name==="Test Manual Shop");

  console.log("\n"+pass+" passed, "+fail+" failed");
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error("HARNESS ERROR", e); process.exit(2); });

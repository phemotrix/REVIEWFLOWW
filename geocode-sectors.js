/* Build-time geocoder: turns the 100 VORTRIX sector center landmarks into
   sector-data/sectors.json (id, name, parent, landmarks, tier, lat, lon).
   Polite Nominatim usage: identifying User-Agent, ~1 req/sec, Mumbai viewbox.
   S001 uses the already-verified Bandra West coords. Run: node geocode-sectors.js */
const fs = require("fs");

// [id, name, parent zone, landmarks, center landmark (geocode query), tier]
const SECTORS = [
["S001","Bandra West","Bandra/Khar","Linking Rd, Pali Hill, Carter Rd, Bandstand, Waterfield Rd","Elco, Linking Road, Bandra West",1],
["S002","Khar West","Bandra/Khar","Khar Danda Rd, 14th/15th/16th Rd, Linking Rd ext","15th Road, Khar West, Mumbai",1],
["S003","Santacruz West","Bandra/Khar","Juhu Tara Rd, Linking Rd (Santacruz), SV Rd","Santacruz railway station West",1],
["S004","Bandra East · BKC","Bandra/Khar","BKC, Kalanagar, Income Tax, MMRDA grounds","Jio World Centre, BKC",1],
["S005","Bandra Station West","Bandra/Khar","Hill Rd, Bazaar Rd, St. Peter's, Station Rd","Hill Road, Bandra West",1],
["S006","Juhu","Andheri West","Juhu Beach, JVPD, ISKCON, Juhu Koliwada","ISKCON Temple, Juhu",1],
["S007","Veera Desai · Oshiwara","Andheri West","Veera Desai Rd, Oshiwara Garden, Andheri Sports Complex","Veera Desai Road, Andheri West",1],
["S008","Lokhandwala","Andheri West","Lokhandwala Complex, Back Rd, Green Acres","Lokhandwala Circle, Andheri West",1],
["S009","Fort · Kala Ghoda","South Mumbai","Horniman Circle, Kala Ghoda, DN Rd, Fountain","Horniman Circle, Fort, Mumbai",1],
["S010","Ballard Estate","South Mumbai","Ballard Pier, Custom House, Fort south","Ballard Estate, Mumbai",1],
["S011","Colaba","South Mumbai","Colaba Causeway, Gateway, Regal Circle, Colaba Market","Colaba Causeway, Mumbai",1],
["S012","Cuffe Parade","South Mumbai","Nariman Point, NCPA, Maker Chambers","NCPA, Nariman Point, Mumbai",1],
["S013","Churchgate","South Mumbai","Marine Drive, Eros Cinema, Churchgate station","Churchgate railway station, Mumbai",1],
["S014","Malabar Hill","South Mumbai","Walkeshwar, Banganga, Teen Batti, Ridge Rd","Banganga Tank, Walkeshwar, Mumbai",1],
["S015","Altamount Rd","South Mumbai","Altamount Rd, Carmichael Rd, Pedder Rd, Hughes Rd","Pedder Road, Mumbai",1],
["S016","Breach Candy","South Mumbai","Warden Rd, Mahalaxmi Temple, Amarsons, Bhulabhai Desai Rd","Breach Candy, Mumbai",1],
["S017","Dadar West","Dadar/Central","Ranade Rd, Shivaji Park, Plaza, NC Kelkar Rd","Shivaji Park, Dadar, Mumbai",1],
["S018","Prabhadevi","Dadar/Central","Siddhivinayak, Sayani Rd, Ravindra Natya Mandir","Siddhivinayak Temple, Prabhadevi",1],
["S019","Worli","Dadar/Central","Worli Sea Face, Worli Village, Dr. Annie Besant Rd","Worli Sea Face, Mumbai",1],
["S020","Lower Parel","Dadar/Central","Phoenix Mills, High Street Phoenix, Mathuradas Mill","High Street Phoenix, Lower Parel",1],
["S021","Powai","Powai/Andheri East","Hiranandani, Galleria, JVLR, IIT Main Gate","Galleria, Powai, Mumbai",1],
["S022","Vile Parle West","Bandra/Khar","Market Rd, Bajaj Rd, Sathaye College, station W","Vile Parle railway station West",1],
["S023","Mahalaxmi","South Mumbai","Racecourse, Haji Ali, Saat Rasta, Dr. E Moses Rd","Mahalaxmi Racecourse, Mumbai",2],
["S024","Tardeo","South Mumbai","Opera House, Kennedy Bridge, Tardeo Rd","Tardeo Road, Mumbai",2],
["S025","Kalbadevi","South Mumbai","Zaveri Bazaar, Crawford Market, Bhuleshwar, Abdul Rehman St","Zaveri Bazaar, Mumbai",2],
["S026","Dadar East","Dadar/Central","Hindu Colony, Tilak Bridge, station E","Hindu Colony, Dadar East, Mumbai",2],
["S027","Parel","Dadar/Central","Lalbaug, Currey Rd, KEM, Parel station","Parel railway station, Mumbai",2],
["S028","Matunga","Dadar/Central","King's Circle, Five Gardens, Matunga station","Five Gardens, Matunga, Mumbai",2],
["S029","Mahim","Dadar/Central","Mori Rd, Mahim Causeway, Hinduja Hospital","Mahim railway station, Mumbai",2],
["S030","Santacruz East · Kalina","Bandra/Khar","Kalina, Mumbai University, BKC fringe, CST Rd","University of Mumbai, Kalina",2],
["S031","DN Nagar","Andheri West","Azad Nagar, JP Rd, DN Nagar metro, Sports Complex","DN Nagar metro station, Andheri West",2],
["S032","Four Bungalows","Andheri West","Manish Nagar, RTO, Four Bungalows signal","Four Bungalows, Andheri West, Mumbai",2],
["S033","Versova","Andheri West","Yari Rd, Versova Village, jetty, beach","Versova Beach, Mumbai",2],
["S034","Vile Parle East","Bandra/Khar","Sahar Rd, Nehru Rd, Parle Tilak, station E","Vile Parle railway station East",2],
["S035","Chandivali","Powai/Andheri East","Nahar Amrit Shakti, Chandivali Farm Rd","Chandivali, Andheri East, Mumbai",2],
["S036","Chakala","Powai/Andheri East","JB Nagar, Andheri-Kurla Rd, WEH, Chakala metro","Chakala metro station, Andheri East",2],
["S037","Sakinaka","Powai/Andheri East","90 Feet Rd, Khairani Rd, Sakinaka metro","Sakinaka metro station, Mumbai",2],
["S038","Marol","Powai/Andheri East","Military Rd, Marol Naka, Marol Church","Marol Naka, Andheri East, Mumbai",2],
["S039","Andheri East Town","Powai/Andheri East","Telli Galli, Pump House, Gundavali, station E","Andheri railway station East",2],
["S040","Ghatkopar West","Ghatkopar/Vikhroli","MG Rd, station W, R City Mall","R City Mall, Ghatkopar West",2],
["S041","Ghatkopar East","Ghatkopar/Vikhroli","Pant Nagar, Vikrant Circle, Tilak Rd","Pant Nagar, Ghatkopar East, Mumbai",2],
["S042","Malad West · Link Rd","Malad/Borivali","Link Rd, Inorbit, Mindspace","Inorbit Mall, Malad West, Mumbai",2],
["S043","Orlem · Evershine","Malad/Borivali","Orlem, Evershine Nagar, Mith Chowki","Orlem, Malad West, Mumbai",2],
["S044","Kandivali West","Malad/Borivali","MG Rd, station W, Shimpoli","Kandivali railway station West",2],
["S045","Thakur Village","Malad/Borivali","Thakur Village, Thakur Complex, Lokhandwala Township","Thakur Village, Kandivali East, Mumbai",2],
["S046","Borivali West","Malad/Borivali","Chandawarkar Ln, station W, IC Colony","Chandavarkar Lane, Borivali West",2],
["S047","Thane West · Naupada","Thane/Mulund","Naupada, station, Teen Hath Naka","Teen Hath Naka, Thane West",2],
["S048","Ghodbunder Rd","Thane/Mulund","Ghodbunder Rd, Hypercity, Waghbil","HyperCITY, Ghodbunder Road, Thane",2],
["S049","Hiranandani Estate","Thane/Mulund","Hiranandani Estate, Patlipada","Hiranandani Estate, Thane",2],
["S050","Majiwada","Thane/Mulund","Viviana Mall, Jupiter Hospital, Eastern Express Hwy","Viviana Mall, Thane West",2],
["S051","Mulund West","Thane/Mulund","MG Rd, R Mall, station W","R Mall, Mulund West",2],
["S052","Vashi","Navi Mumbai","Sec 17 market, Inorbit Vashi, Palm Beach Rd","Inorbit Mall, Vashi, Navi Mumbai",2],
["S053","Nerul","Navi Mumbai","Sec 21, Seawoods Grand Central, Palm Beach","Seawoods Grand Central, Nerul",2],
["S054","Seawoods · Belapur CBD","Navi Mumbai","CBD Belapur, Sec 11, Seawoods station","Seawoods railway station, Navi Mumbai",2],
["S055","Kharghar","Navi Mumbai","Golf Course, Central Park, Sec 12","Central Park, Kharghar, Navi Mumbai",2],
["S056","Chembur West","Dadar/Central","Station W, Diamond Garden, Chembur Naka","Diamond Garden, Chembur, Mumbai",2],
["S057","Kurla West","Dadar/Central","Station W, LBS Marg, Kamani","Kurla railway station West",2],
["S058","Jogeshwari West","Andheri West","Oshiwara station, Behram Baug, JVLR","Jogeshwari railway station West",2],
["S059","Goregaon West","Malad/Borivali","MG Rd, Bangur Nagar, station W, Aarey Rd","Goregaon railway station West",2],
["S060","Goregaon East","Malad/Borivali","Oberoi Mall, Commerz, Nirlon, JVLR","Oberoi Mall, Goregaon East, Mumbai",2],
["S061","Chembur East","Dadar/Central","Sindhi Camp, Trombay Rd, station E","Chembur railway station East",2],
["S062","Airoli","Navi Mumbai","Sec 19, Mindspace, station, Thane-Belapur Rd","Mindspace, Airoli, Navi Mumbai",2],
["S063","Mumbai Central","South Mumbai","Agripada, Madanpura, Maratha Mandir, station","Mumbai Central railway station",3],
["S064","Byculla","South Mumbai","Mazgaon, Dockyard Rd, Gloria Church, station","Byculla railway station, Mumbai",3],
["S065","Dongri","South Mumbai","Bhendi Bazaar, Umerkhadi","Bhendi Bazaar, Mumbai",3],
["S066","Sion","Dadar/Central","GTB Nagar, Sion Circle, Sion Hospital","Sion Circle, Mumbai",3],
["S067","Wadala","Dadar/Central","Bhakti Park, IMAX, Wadala station","Wadala Road railway station, Mumbai",3],
["S068","Kurla East","Dadar/Central","Nehru Nagar, station E","Nehru Nagar, Kurla East, Mumbai",3],
["S069","Govandi","Dadar/Central","Deonar, Baiganwadi, station","Govandi railway station, Mumbai",3],
["S070","Tilak Nagar","Dadar/Central","Tilak Nagar station, Pestom Sagar, Chembur border","Tilak Nagar railway station, Mumbai",3],
["S071","Khar East · Vakola","Bandra/Khar","Khar East, Vakola, Prabhat Colony","Vakola, Santacruz East, Mumbai",3],
["S072","Jogeshwari East","Powai/Andheri East","JVLR, Majas, station E, WEH","Jogeshwari railway station East",3],
["S073","MIDC · Seepz","Powai/Andheri East","Seepz Gate, MIDC Central Rd","SEEPZ, Andheri East, Mumbai",3],
["S074","Kanjurmarg West","Powai/Andheri East","LBS Marg, IIT boundary, station W","Kanjurmarg railway station West",3],
["S075","Vikhroli East","Ghatkopar/Vikhroli","Kannamwar Nagar, Tagore Nagar, station E","Kannamwar Nagar, Vikhroli East, Mumbai",3],
["S076","Vikhroli West","Ghatkopar/Vikhroli","Godrej, station W, LBS Marg","Vikhroli railway station West",3],
["S077","Bhandup West","Ghatkopar/Vikhroli","LBS Marg, station W, Dreams Mall","Dreams Mall, Bhandup West, Mumbai",3],
["S078","Bhandup East · Nahur","Ghatkopar/Vikhroli","Nahur station, Tank Rd","Nahur railway station, Mumbai",3],
["S079","Kanjurmarg East","Ghatkopar/Vikhroli","Station E, LBS Marg","Kanjurmarg railway station East",3],
["S080","Asalpha · Saki Vihar","Ghatkopar/Vikhroli","Asalpha, Saki Vihar Rd","Asalpha, Ghatkopar West, Mumbai",3],
["S081","Malad East · Kurar","Malad/Borivali","Kurar, Dindoshi, Pathanwadi","Kurar Village, Malad East, Mumbai",3],
["S082","Charkop","Malad/Borivali","Charkop market, Sector 8","Charkop Market, Kandivali West, Mumbai",3],
["S083","Borivali East","Malad/Borivali","Station E, SGNP Rd, Kastur Park","Borivali railway station East",3],
["S084","Eksar · Mandpeshwar","Malad/Borivali","Eksar, Mandpeshwar, Yogi Nagar","Mandpeshwar, Borivali West, Mumbai",3],
["S085","Dahisar West","Malad/Borivali","Station W, Anand Nagar, SV Rd","Dahisar railway station West",3],
["S086","Dahisar East","Malad/Borivali","SV Rd, Rawal Pada, station E","Dahisar railway station East",3],
["S087","Mira Rd West","Malad/Borivali","Station W, Silver Park, Shanti Nagar","Mira Road railway station West",3],
["S088","Mira Rd East","Malad/Borivali","Vinay Nagar, Shanti Park, station E","Mira Road railway station East",3],
["S089","Bhayandar West","Malad/Borivali","Station W, Jesal Park","Bhayandar railway station West",3],
["S090","Bhayandar East","Malad/Borivali","Goddev, Fatak Rd, station E","Bhayandar railway station East",3],
["S091","Wagle Estate","Thane/Mulund","Wagle Estate, Kopri, Thane East","Wagle Estate, Thane",3],
["S092","Vartak Nagar","Thane/Mulund","Pokhran Rd, Vartak Nagar","Vartak Nagar, Thane West",3],
["S093","Kolshet Rd","Thane/Mulund","Kolshet, Dhokali","Kolshet Road, Thane",3],
["S094","Kasarvadavali","Thane/Mulund","Ghodbunder far, Kasarvadavali naka","Kasarvadavali, Thane",3],
["S095","Mulund East","Thane/Mulund","Station E, Nahur border, LBS Marg","Mulund railway station East",3],
["S096","Koparkhairane","Navi Mumbai","Sec 11, station, Thane-Belapur Rd","Koparkhairane railway station, Navi Mumbai",3],
["S097","Ghansoli","Navi Mumbai","Talavali, station","Ghansoli railway station, Navi Mumbai",3],
["S098","Sanpada · Juinagar","Navi Mumbai","Sanpada station, Juinagar, Palm Beach","Sanpada railway station, Navi Mumbai",3],
["S099","Panvel","Navi Mumbai","Station, Old Panvel, ST stand","Panvel railway station, Navi Mumbai",3],
["S100","Kamothe · Kalamboli","Navi Mumbai","Kamothe, Kalamboli, Sion-Panvel Hwy","Kamothe, Navi Mumbai",3]
];

// S001 = already-verified Bandra West centre (Linking Rd / Elco)
const KNOWN = { S001: { lat: 19.0596, lon: 72.8295 } };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function geocode(q, bounded) {
  const p = new URLSearchParams({ format: "json", q, limit: "1", countrycodes: "in" });
  if (bounded) { p.set("viewbox", "72.75,19.35,73.10,18.85"); p.set("bounded", "1"); }
  const r = await fetch("https://nominatim.openstreetmap.org/search?" + p, {
    headers: { "User-Agent": "VORTRIX-SectorBuilder/1.0 (Mumbai pitch mapping tool)" }
  });
  if (!r.ok) throw new Error("nominatim " + r.status);
  const d = await r.json();
  return d[0] || null;
}

(async () => {
  const out = [];
  for (const [id, name, parent, landmarks, center, tier] of SECTORS) {
    if (KNOWN[id]) {
      out.push({ id, name, parent, landmarks, tier, lat: KNOWN[id].lat, lon: KNOWN[id].lon, src: "known" });
      console.log(id, "KNOWN");
      continue;
    }
    const parentShort = parent.split("/")[0].trim();
    const queries = [
      center + ", Maharashtra, India",
      name + ", Mumbai, Maharashtra, India",
      parentShort + ", Mumbai, Maharashtra, India"
    ];
    let hit = null, used = "";
    for (const q of queries) {
      try {
        hit = await geocode(q, true);
        if (!hit) hit = await geocode(q, false);
        if (hit) { used = q; break; }
      } catch (e) { /* keep polite pace anyway */ }
      await sleep(1150);
    }
    if (hit) {
      out.push({ id, name, parent, landmarks, tier, lat: +hit.lat, lon: +hit.lon, src: "nominatim" });
      console.log(id, "OK", (+hit.lat).toFixed(4), (+hit.lon).toFixed(4), "←", used.slice(0, 46));
    } else {
      out.push({ id, name, parent, landmarks, tier, lat: null, lon: null, src: "failed" });
      console.log(id, "FAIL");
    }
    await sleep(200);
  }
  fs.writeFileSync(__dirname + "/sectors.json", JSON.stringify(out, null, 1));
  const ok = out.filter((s) => typeof s.lat === "number").length;
  const fails = out.filter((s) => typeof s.lat !== "number").map((s) => s.id);
  console.log("DONE " + ok + "/100 with coords" + (fails.length ? " — FAILED: " + fails.join(",") : ""));
})();

/* ============================================================
   VORTRIX ADMIN — your side only.
   Clients, cards, and the Mumbai pitch-route map.
   (Customer tap page is tap.html — only opens on an NFC tap.)
   ============================================================ */
"use strict";

/* ---------------- Mumbai pitch zones ---------------- */
const ZONES = [
  { id:"s001",     name:"S001 · Bandra West",  area:"Linking Rd · Pali Hill · Carter Rd · Bandstand · Waterfield Rd", lat:19.0596, lon:72.8295, r:2500 },
  { id:"south",    name:"South Mumbai",        area:"Colaba · Fort · Churchgate · Worli",   lat:18.9154, lon:72.8259, r:4500 },
  { id:"bandra",   name:"Bandra · Khar",       area:"Bandra West · Khar · Santacruz West",   lat:19.0559, lon:72.8297, r:3500 },
  { id:"andheriw", name:"Andheri West",        area:"Andheri West · Juhu · Versova",         lat:19.1293, lon:72.8314, r:4000 },
  { id:"powai",    name:"Powai · Andheri East",area:"Powai · Andheri East · Sakinaka",       lat:19.1232, lon:72.9093, r:4000 },
  { id:"dadar",    name:"Dadar · Central",     area:"Dadar · Parel · Sion · Chembur",        lat:19.0201, lon:72.8409, r:4500 },
  { id:"ghatkopar",name:"Ghatkopar · Vikhroli",area:"Ghatkopar · Vikhroli · Kanjurmarg",    lat:19.0915, lon:72.9112, r:4000 },
  { id:"borivali", name:"Malad · Borivali",    area:"Malad · Kandivali · Borivali · Dahisar",lat:19.2350, lon:72.8551, r:5000 },
  { id:"thane",    name:"Thane · Mulund",      area:"Thane West · Mulund · Ghodbunder Rd",   lat:19.2763, lon:72.9590, r:4500 },
  { id:"vashi",    name:"Navi Mumbai",         area:"Vashi · Sanpada · Nerul · Kharghar",    lat:19.0801, lon:72.9986, r:5000 },
];

const CATS = ["Restaurant","Cafe","Salon","Clinic","Gym","Retail","Hotel","Other"];

/* ---------------- store ---------------- */
const DB_KEY = "vortrix_v2";
let db = { settings:{workerUrl:"",adminKey:""}, clients:[], cards:[], pitch:{}, sectors:{}, sectorMeta:{} };
try {
  const raw = localStorage.getItem(DB_KEY);
  if (raw) db = Object.assign(db, JSON.parse(raw));
} catch(e){}
function save(){ try{ localStorage.setItem(DB_KEY, JSON.stringify(db)); }catch(e){} }

function uid(){ return "x"+Math.random().toString(36).slice(2,10); }
function slugify(s){
  return (s||"").toLowerCase().trim().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,36) || "biz";
}
function esc(s){
  return String(s==null?"":s).replace(/[&<>"']/g, function(c){
    return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];
  });
}
function toast(msg){
  const t = document.getElementById("toast");
  t.textContent = msg; t.style.display = "block";
  clearTimeout(t._h); t._h = setTimeout(function(){ t.style.display="none"; }, 2600);
}

/* ---------------- tabs & modal ---------------- */
function switchTab(name){
  document.querySelectorAll(".tab").forEach(function(s){ s.classList.remove("active"); });
  document.getElementById("tab-"+name).classList.add("active");
  document.querySelectorAll("#bottomnav button").forEach(function(b){
    b.classList.toggle("on", b.dataset.tab===name);
  });
  window.scrollTo(0,0);
}
function openModal(html){
  document.getElementById("modal").innerHTML = html;
  document.getElementById("modal-root").classList.add("open");
}
function closeModal(){ document.getElementById("modal-root").classList.remove("open"); }
function toggleField(id, label, checked){
  return '<div class="togglerow"><span>'+label+'</span>'+
    '<label class="switch"><input type="checkbox" id="'+id+'"'+(checked?' checked':'')+'>'+
    '<span class="slider"></span></label></div>';
}

/* ---------------- home ---------------- */
function pitchAll(){
  const out = [];
  Object.keys(db.pitch||{}).forEach(function(z){
    (db.pitch[z]||[]).forEach(function(p){ out.push(p); });
  });
  Object.keys(db.sectors||{}).forEach(function(z){
    (db.sectors[z]||[]).forEach(function(p){ out.push(p); });
  });
  return out;
}
function renderHome(){
  const all = pitchAll();
  const pitched = all.filter(function(p){return p.status==="pitched";}).length;
  const bought  = all.filter(function(p){return p.status==="bought";}).length;
  const no      = all.filter(function(p){return p.status==="no";}).length;
  const done = pitched+bought+no;
  document.getElementById("st-clients").textContent = db.clients.length;
  document.getElementById("st-cards").textContent = db.cards.filter(function(c){return c.status==="issued";}).length;
  document.getElementById("st-pitched").textContent = pitched;
  document.getElementById("st-bought").textContent = bought;
  document.getElementById("st-conv").textContent = done? Math.round(bought/done*100)+"%" : "0%";
  const mrr = db.clients.filter(function(c){return c.monthly;})
    .reduce(function(s,c){ return s + (parseInt(c.fee,10)||400); }, 0);
  document.getElementById("st-mrr").textContent = "₹"+mrr.toLocaleString("en-IN");
  document.getElementById("set-worker").value = db.settings.workerUrl||"";
  document.getElementById("set-key").value = db.settings.adminKey||"";
  document.getElementById("set-status").textContent =
    db.settings.workerUrl ? "Connected ✓ — publishing works." : "";
}
function saveSettings(){
  db.settings.workerUrl = document.getElementById("set-worker").value.trim().replace(/\/+$/,"");
  db.settings.adminKey = document.getElementById("set-key").value;
  save(); renderHome(); toast("Connection saved");
}
function exportData(){
  const blob = new Blob([JSON.stringify(db,null,2)],{type:"application/json"});
  const a = document.createElement("a");
  const d = new Date();
  a.href = URL.createObjectURL(blob);
  a.download = "vortrix-backup-"+d.getFullYear()+("0"+(d.getMonth()+1)).slice(-2)+("0"+d.getDate()).slice(-2)+".json";
  a.click(); setTimeout(function(){ URL.revokeObjectURL(a.href); }, 2000);
  toast("Backup downloaded");
}
function importData(input){
  const f = input.files && input.files[0];
  if(!f) return;
  const r = new FileReader();
  r.onload = function(){
    try{
      const d = JSON.parse(r.result);
      if(!d || !Array.isArray(d.clients)) throw new Error("bad file");
      db = Object.assign({settings:{workerUrl:"",adminKey:""},clients:[],cards:[],pitch:{},sectors:{},sectorMeta:{}}, d);
      save(); renderAll(); toast("Backup restored");
    }catch(e){ toast("That file didn't look like a backup"); }
    input.value = "";
  };
  r.readAsText(f);
}

/* ---------------- clients ---------------- */
function tapUrl(slug){
  const base = location.href.split("?")[0].replace(/[^\/]*$/, "");
  return base + "tap.html?biz=" + slug;
}
function copyText(t, msg){
  function done(){ toast(msg||"Copied"); }
  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(t).then(done, function(){ fallback(); });
  } else fallback();
  function fallback(){
    const ta=document.createElement("textarea"); ta.value=t;
    document.body.appendChild(ta); ta.select();
    try{ document.execCommand("copy"); done(); }catch(e){ toast("Copy failed — long-press the link"); }
    ta.remove();
  }
}
function renderClients(){
  const q = (document.getElementById("client-search").value||"").toLowerCase();
  const list = document.getElementById("client-list");
  const items = db.clients.filter(function(c){
    return !q || (c.name+" "+(c.category||"")+" "+(c.phone||"")).toLowerCase().indexOf(q)>=0;
  });
  document.getElementById("client-count").textContent = "· "+db.clients.length;
  if(!items.length){
    list.innerHTML = '<div class="empty">No clients yet.<br>Tap + to add your first paying business.</div>';
    return;
  }
  list.innerHTML = items.map(function(c){
    const pills = [];
    if(c.published) pills.push('<span class="pill green">live</span>');
    if(c.setupPaid) pills.push('<span class="pill">setup ✓</span>');
    if(c.monthly) pills.push('<span class="pill">₹'+(parseInt(c.fee,10)||400)+'/mo</span>');
    return '<div class="card">'+
      '<div class="row"><div class="grow"><div class="name">'+esc(c.name)+'</div>'+
      '<div class="sub2">'+esc(c.category||"")+(c.phone? " · "+esc(c.phone):"")+'</div></div></div>'+
      (pills.length? '<div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap">'+pills.join("")+'</div>':"")+
      '<div class="btnrow">'+
        (c.phone? '<button class="btn ghost small" onclick="location.href=\'tel:'+esc(c.phone.replace(/\s/g,""))+'\'">📞</button>':"")+
        (c.phone? '<button class="btn ghost small" onclick="window.open(\'https://wa.me/91'+esc(c.phone.replace(/\D/g,"").slice(-10))+'\',\'_blank\')">💬</button>':"")+
        '<button class="btn ghost small" onclick="copyText(tapUrl(\''+c.slug+'\'),\'Tap link copied\')">🔗</button>'+
        '<button class="btn small" onclick="publishClient(\''+c.id+'\')">⬆ Publish</button>'+
        '<button class="btn ghost small" onclick="openClientModal(\''+c.id+'\')">✏️</button>'+
      '</div></div>';
  }).join("");
}
function openClientModal(id){
  const c = id? db.clients.find(function(x){return x.id===id;}) : null;
  openModal(
    '<h3>'+(c?"Edit client":"New client")+'</h3>'+
    '<div class="field"><label>Business name</label><input id="f-name" value="'+esc(c?c.name:"")+'" placeholder="e.g. Sharma Sweets"></div>'+
    '<div class="field"><label>Category</label><select id="f-cat">'+
      CATS.map(function(k){return '<option'+(c&&c.category===k?" selected":"")+'>'+k+'</option>';}).join("")+'</select></div>'+
    '<div class="field"><label>Phone</label><input id="f-phone" inputmode="tel" value="'+esc(c?c.phone:"")+'" placeholder="98765 43210"></div>'+
    '<div class="field"><label>Address</label><input id="f-addr" value="'+esc(c?c.address:"")+'" placeholder="Shop 4, Linking Road, Bandra"></div>'+
    '<div class="field"><label>Google review link</label><input id="f-gmaps" value="'+esc(c?c.gmaps:"")+'" placeholder="https://g.page/… or maps link"></div>'+
    '<div class="field"><label>Monthly fee ₹</label><input id="f-fee" inputmode="numeric" value="'+esc(c?(c.fee||400):400)+'"></div>'+
    '<div class="field"><label>Notes</label><textarea id="f-notes" placeholder="Owner name, timing, anything…">'+esc(c?c.notes:"")+'</textarea></div>'+
    toggleField("f-setup","Setup fee paid", c&&c.setupPaid)+
    toggleField("f-monthly","Monthly plan active", c?c.monthly:true)+
    '<div class="btnrow"><button class="btn" onclick="saveClient(\''+(c?c.id:"")+'\')">Save</button>'+
    (c? '<button class="btn danger" onclick="deleteClient(\''+c.id+'\')">Delete</button>':"")+'</div>'
  );
}
function saveClient(id){
  const name = document.getElementById("f-name").value.trim();
  if(!name){ toast("Name is required"); return; }
  let c = id? db.clients.find(function(x){return x.id===id;}) : null;
  if(!c){
    const slug = slugify(name);
    if(db.clients.some(function(x){return x.slug===slug;})){ toast("A client with that name exists"); return; }
    c = { id:uid(), slug:slug, published:false, created:Date.now() };
    db.clients.push(c);
  }
  c.name = name;
  c.category = document.getElementById("f-cat").value;
  c.phone = document.getElementById("f-phone").value.trim();
  c.address = document.getElementById("f-addr").value.trim();
  c.gmaps = document.getElementById("f-gmaps").value.trim();
  c.fee = parseInt(document.getElementById("f-fee").value,10)||400;
  c.notes = document.getElementById("f-notes").value.trim();
  c.setupPaid = document.getElementById("f-setup").checked;
  c.monthly = document.getElementById("f-monthly").checked;
  save(); closeModal(); renderAll();
  toast("Client saved");
}
function deleteClient(id){
  if(!confirm("Delete this client? Their cards stay in inventory.")) return;
  db.clients = db.clients.filter(function(x){return x.id!==id;});
  save(); closeModal(); renderAll(); toast("Deleted");
}

function defaultQuestions(cat){
  // v3: one universal 8-question psychological flow for every niche.
  // (Niche-specific option packs can extend this later.)
  if (typeof v3DefaultQuestions === "function") return v3DefaultQuestions();
  const loved = ["Taste / quality","Ambience","Service","Value for money","Hygiene"];
  if(cat==="Salon") loved.push("Haircut / styling");
  const q = {
    Restaurant:[["How was the food?","rating"],["How was the service?","rating"],["What did you love most?","chips"],["How likely are you to visit again?","rating"]],
    Cafe:[["How was the coffee & food?","rating"],["How was the service?","rating"],["What did you love most?","chips"],["How likely are you to visit again?","rating"]],
    Salon:[["How was the service?","rating"],["How were the staff?","rating"],["What did you love most?","chips"],["Would you recommend us?","rating"]],
    Clinic:[["How was the care?","rating"],["How were the staff?","rating"],["What did you love most?","chips"],["Would you recommend us?","rating"]],
    Gym:[["How are the facilities?","rating"],["How are the trainers?","rating"],["What did you love most?","chips"],["Would you recommend us?","rating"]],
  }[cat] || [["How was your experience?","rating"],["How were the staff?","rating"],["What did you love most?","chips"],["Would you recommend us?","rating"]];
  return q.map(function(x,i){
    const o = { id:"q"+(i+1), text:x[0], type:x[1] };
    if(x[1]==="chips"){ o.multi = true; o.options = loved; }
    return o;
  });
}
async function publishClient(id){
  const c = db.clients.find(function(x){return x.id===id;});
  if(!c) return;
  const w = db.settings.workerUrl, k = db.settings.adminKey;
  if(!w || !k){ toast("Set Worker URL + password on Home first"); switchTab("home"); return; }
  toast("Publishing…");
  const config = {
    name: c.name,
    color: "#d8a94e",
    welcome: "Thanks for visiting "+c.name+"! Tap through — it takes about 30 seconds.",
    google_link: c.gmaps || "",
    questions: defaultQuestions(c.category)
  };
  try{
    const r = await fetch(w+"/admin/save", {
      method:"POST",
      headers:{ "Content-Type":"application/json", "X-Admin-Key":k },
      body: JSON.stringify({ id:c.slug, config:config })
    });
    const d = await r.json();
    if(d && d.ok){
      c.published = true; save(); renderAll();
      copyText(tapUrl(c.slug), "Live! Tap link copied — program it on the NFC card");
    } else toast("Publish failed: "+((d&&d.error)||r.status));
  }catch(e){ toast("Publish failed — check Worker URL"); }
}

/* ---------------- cards ---------------- */
function nextCardCode(){
  let n = 1;
  db.cards.forEach(function(c){
    const m = /^VRTX-(\d+)$/.exec(c.code||"");
    if(m) n = Math.max(n, parseInt(m[1],10)+1);
  });
  return "VRTX-"+("00"+n).slice(-3);
}
function renderCards(){
  const list = document.getElementById("card-list");
  document.getElementById("card-count").textContent = "· "+db.cards.length;
  if(!db.cards.length){
    list.innerHTML = '<div class="empty">No cards yet.<br>Tap + when a new NFC card arrives.</div>';
    return;
  }
  const pill = { ready:'<span class="pill grey">in stock</span>',
                 issued:'<span class="pill green">issued</span>',
                 lost:'<span class="pill red">lost</span>' };
  list.innerHTML = db.cards.map(function(cd){
    const cl = db.cards && db.clients.find(function(x){return x.id===cd.clientId;});
    return '<div class="card"><div class="row"><div class="grow">'+
      '<div class="name kv" style="font-size:15px">'+esc(cd.code)+'</div>'+
      '<div class="sub2">'+(cl? esc(cl.name) : "Not assigned")+(cd.issuedAt? " · "+new Date(cd.issuedAt).toLocaleDateString("en-IN"):"")+'</div></div>'+
      (pill[cd.status]||"")+'</div>'+
      (cd.note? '<div class="sub2" style="margin-top:6px">'+esc(cd.note)+'</div>':"")+
      '<div class="btnrow">'+
        (cl? '<button class="btn ghost small" onclick="copyText(tapUrl(\''+cl.slug+'\'),\'Tap link copied — program this on the card\')">🔗 Copy tap link</button>':"")+
        '<button class="btn ghost small" onclick="openCardModal(\''+cd.code+'\')">✏️</button>'+
      '</div></div>';
  }).join("");
}
function openCardModal(code){
  const cd = code? db.cards.find(function(x){return x.code===code;}) : null;
  openModal(
    '<h3>'+(cd?"Edit card":"New card")+'</h3>'+
    '<div class="field"><label>Card code</label><input id="c-code" class="kv" value="'+esc(cd?cd.code:nextCardCode())+'"></div>'+
    '<div class="field"><label>Assigned to client</label><select id="c-client"><option value="">— not assigned —</option>'+
      db.clients.map(function(c){return '<option value="'+c.id+'"'+(cd&&cd.clientId===c.id?" selected":"")+'>'+esc(c.name)+'</option>';}).join("")+'</select></div>'+
    '<div class="field"><label>Status</label><select id="c-status">'+
      ["ready","issued","lost"].map(function(s){return '<option value="'+s+'"'+(cd&&cd.status===s?" selected":"")+'>'+s+'</option>';}).join("")+'</select></div>'+
    '<div class="field"><label>Note</label><input id="c-note" value="'+esc(cd?cd.note:"")+'" placeholder="e.g. black card, batch 2"></div>'+
    '<div class="btnrow"><button class="btn" onclick="saveCard(\''+(cd?esc(cd.code):"")+'\')">Save</button>'+
    (cd? '<button class="btn danger" onclick="deleteCard(\''+esc(cd.code)+'\')">Delete</button>':"")+'</div>'
  );
}
function saveCard(oldCode){
  const code = document.getElementById("c-code").value.trim().toUpperCase();
  if(!code){ toast("Card code is required"); return; }
  let cd = oldCode? db.cards.find(function(x){return x.code===oldCode;}) : null;
  if(!cd){
    if(db.cards.some(function(x){return x.code===code;})){ toast("That code already exists"); return; }
    cd = {}; db.cards.push(cd);
  }
  cd.code = code;
  cd.clientId = document.getElementById("c-client").value || null;
  cd.status = document.getElementById("c-status").value;
  cd.note = document.getElementById("c-note").value.trim();
  if(cd.status==="issued" && !cd.issuedAt) cd.issuedAt = Date.now();
  save(); closeModal(); renderAll(); toast("Card saved");
}
function deleteCard(code){
  if(!confirm("Delete card "+code+"?")) return;
  db.cards = db.cards.filter(function(x){return x.code!==code;});
  save(); closeModal(); renderAll(); toast("Deleted");
}

function renderAll(){ renderHome(); renderClients(); renderCards(); renderZones(); renderSectors(); }
document.addEventListener("DOMContentLoaded", function(){ renderAll(); loadSectors(); });

/* ================= ZONES & PITCH MAP ================= */
let currentZone = null;
let zmap = null, zlayer = null, zline = null;
let researchResults = [];

function zoneById(id){ return ZONES.find(function(z){return z.id===id;}); }
function currentZoneObj(){ return zoneById(currentZone); }
function pitchOf(zid){ return db.pitch[zid] || (db.pitch[zid] = []); }

function renderZones(){
  const el = document.getElementById("zone-list");
  el.innerHTML = ZONES.map(function(z){
    const list = db.pitch[z.id]||[];
    const done = list.filter(function(p){return p.status!=="new";}).length;
    const bought = list.filter(function(p){return p.status==="bought";}).length;
    return '<div class="card" onclick="openZone(\''+z.id+'\')" style="cursor:pointer">'+
      '<div class="row"><div class="grow"><div class="name">🗺 '+esc(z.name)+'</div>'+
      '<div class="sub2">'+esc(z.area)+'</div></div>'+
      '<span style="color:var(--muted);font-size:20px">›</span></div>'+
      '<div style="margin-top:10px;display:flex;gap:6px;flex-wrap:wrap">'+
        '<span class="pill">'+list.length+' businesses</span>'+
        (done? '<span class="pill">✓ '+done+' done</span>':"")+
        (bought? '<span class="pill green">💰 '+bought+' bought</span>':"")+
      '</div></div>';
  }).join("");
}

function openZone(id){
  currentZone = id;
  const z = currentZoneObj();
  document.getElementById("zv-name").textContent = z.name;
  document.getElementById("zv-sub").textContent = z.area;
  document.getElementById("zoneview").classList.add("open");
  document.body.style.overflow = "hidden";
  renderZoneDetail();
  initZMap(z);
  drawMarkers();
  document.getElementById("sector-load-btn").style.display = (id==="s001") ? "" : "none";
  document.getElementById("zoneview").scrollTop = 0;
}
function closeZone(){
  document.getElementById("zoneview").classList.remove("open");
  document.body.style.overflow = "";
  if(zmap){ zmap.remove(); zmap = null; zlayer = null; zline = null; }
  currentZone = null;
  renderZones(); renderHome();
}

function renderZoneDetail(){
  const z = currentZoneObj(); if(!z) return;
  const list = pitchOf(z.id).slice().sort(function(a,b){
    return (a.order||9999)-(b.order||9999);
  });
  const done = list.filter(function(p){return p.status!=="new";}).length;
  document.getElementById("zv-count").textContent = "· "+list.length;
  document.getElementById("zv-progress-label").textContent =
    list.length? done+" of "+list.length+" visited" : "No businesses yet — hit Research";
  document.getElementById("zv-progress").style.width =
    list.length? Math.round(done/list.length*100)+"%" : "0%";

  const box = document.getElementById("zv-list");
  if(!list.length){
    box.innerHTML = '<div class="empty">Nothing here yet.<br>Tap <b>🔍 Research businesses</b> to find 50–70 pitchable spots in '+esc(z.name)+'.</div>';
    return;
  }
  box.innerHTML = list.map(function(p){
    const nb = p.order? '<div class="num'+(p.status!=="new"?" done":"")+'">'+p.order+'</div>'
                      : '<div class="num">•</div>';
    const nb2 = p.status==="bought"? '<div class="num bought">'+(p.order||"💰")+'</div>' : nb;
    function sb(s,label){
      return '<button class="sbtn'+(p.status===s?" on-"+s:"")+'" onclick="setPitchStatus(\''+p.oid+'\',\''+s+'\')">'+label+'</button>';
    }
    return '<div class="card"><div class="row">'+nb2+'<div class="grow">'+
      '<div class="name" style="font-size:15px">'+esc(p.name)+'</div>'+
      '<div class="sub2">'+esc(p.cat||"")+(p.addr? " · "+esc(p.addr):"")+'</div></div>'+
      '<button class="iconbtn" onclick="window.open(\'https://www.google.com/maps/dir/?api=1&destination='+p.lat+','+p.lon+'\',\'_blank\')">🧭</button></div>'+
      '<div class="statusbtns">'+sb("pitched","✓ Pitched")+sb("bought","💰 Bought")+sb("no","✗ No")+'</div>'+
      '<input class="notein" placeholder="1-line note…" value="'+esc(p.note||"")+'" onchange="setPitchNote(\''+p.oid+'\',this.value)">'+
      '</div>';
  }).join("");
}

function setPitchStatus(oid, s){
  const list = pitchOf(currentZone);
  const p = list.find(function(x){return x.oid===oid;});
  if(!p) return;
  p.status = (p.status===s)? "new" : s;
  save(); renderZoneDetail(); drawMarkers();
}
function setPitchNote(oid, v){
  const list = pitchOf(currentZone);
  const p = list.find(function(x){return x.oid===oid;});
  if(p){ p.note = v; save(); }
}

function initZMap(z){
  if(zmap){ zmap.remove(); zmap = null; }
  zmap = L.map("zmap").setView([z.lat, z.lon], 13);
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png",{
    maxZoom:19, attribution:"© OpenStreetMap contributors"
  }).addTo(zmap);
  L.circle([z.lat, z.lon], {radius: z.r, color:"#d8a94e", weight:1, opacity:.5, fillOpacity:.04}).addTo(zmap);
  zlayer = L.layerGroup().addTo(zmap);
  setTimeout(function(){ if(zmap) zmap.invalidateSize(); }, 350);
}
function drawMarkers(){
  const z = currentZoneObj();
  if(!zmap || !z || !zlayer) return;
  zlayer.clearLayers();
  if(zline){ zmap.removeLayer(zline); zline = null; }
  const list = (db.pitch[z.id]||[]).filter(function(p){return p.lat && p.lon;});
  const ordered = list.filter(function(p){return p.order;}).sort(function(a,b){return a.order-b.order;});
  list.forEach(function(p){
    const dim = (p.status==="bought" || p.status==="no");
    const icon = L.divIcon({
      className:"",
      html:'<div class="leaflet-divnum'+(dim?" dim":"")+'" style="width:28px;height:28px">'+(p.order||"•")+'</div>',
      iconSize:[28,28], iconAnchor:[14,14]
    });
    L.marker([p.lat, p.lon], {icon:icon}).addTo(zlayer)
      .bindPopup("<b>"+esc(p.name)+"</b><br>"+esc(p.cat||""));
  });
  if(ordered.length > 1){
    zline = L.polyline(ordered.map(function(p){return [p.lat,p.lon];}),
      {color:"#d8a94e", weight:3, opacity:.75}).addTo(zmap);
    zmap.fitBounds(zline.getBounds().pad(0.15));
  } else if(list.length){
    zmap.fitBounds(L.latLngBounds(list.map(function(p){return [p.lat,p.lon];})).pad(0.2));
  } else {
    zmap.setView([z.lat, z.lon], 13);
  }
}

/* ---------------- curated sector lists ---------------- */
async function loadSectorStops(){
  const z = currentZoneObj(); if(!z) return;
  if(!confirm("Load the curated S001 · Bandra West list (85 researched stops)? This replaces the current pitch list for this zone.")) return;
  openModal('<h3>📥 Loading sector list…</h3><p class="hintline">Fetching the researched stops.</p>');
  try{
    const r = await fetch("./sector-data/S001-bandra-west.json");
    if(!r.ok) throw new Error("HTTP "+r.status);
    const d = await r.json();
    const tag = Date.now().toString(36);
    db.pitch[z.id] = (d.stops||[]).map(function(s,i){
      return { oid:"s001_"+tag+"_"+i, name:s.name, cat:s.cat, lat:s.lat, lon:s.lon,
               addr:s.area, order:s.stop, status:"new", note:"" };
    });
    save(); closeModal(); renderZoneDetail(); drawMarkers();
    toast("Loaded "+db.pitch[z.id].length+" sector stops ✓");
  }catch(e){
    openModal('<h3>Couldn\'t load the sector list</h3>'+
      '<p class="hintline">'+esc(String((e&&e.message)||e))+' — make sure the <b>sector-data</b> folder was uploaded to GitHub next to index.html.</p>'+
      '<div class="btnrow"><button class="btn" onclick="closeModal()">OK</button></div>');
  }
}

/* ---------------- research (OpenStreetMap) ---------------- */
function catLabel(t){
  function pretty(s){ return s.replace(/_/g," ").replace(/\b\w/g,function(c){return c.toUpperCase();}); }
  if(t.shop) return pretty(t.shop);
  if(t.amenity) return pretty(t.amenity);
  if(t.leisure) return pretty(t.leisure);
  if(t.tourism) return pretty(t.tourism);
  if(t.office) return pretty(t.office)+" office";
  return "Business";
}
function addrOf(t){
  const parts = [];
  if(t["addr:housenumber"]) parts.push(t["addr:housenumber"]);
  if(t["addr:street"]) parts.push(t["addr:street"]);
  if(t["addr:suburb"]) parts.push(t["addr:suburb"]);
  return parts.join(", ");
}
function overpassQL(z){
  return "[out:json][timeout:30];("+
    'node["shop"~"^(bakery|beauty|clothes|shoes|jewelry|gift|florist|optician|mobile_phone|electronics|furniture|cosmetics|hairdresser|massage|pastry|confectionery)$"](around:'+z.r+","+z.lat+","+z.lon+");"+
    'node["amenity"~"^(restaurant|cafe|fast_food|ice_cream|bar|pub|dentist|clinic|doctors|pharmacy)$"](around:'+z.r+","+z.lat+","+z.lon+");"+
    'node["leisure"="fitness_centre"](around:'+z.r+","+z.lat+","+z.lon+");"+
    'node["tourism"~"^(hotel|guest_house)$"](around:'+z.r+","+z.lat+","+z.lon+");"+
    ");out 90;";
}
async function researchZone(){
  const z = currentZoneObj();
  openModal('<h3>🔍 Researching '+esc(z.name)+'</h3>'+
    '<p class="hintline">Scanning OpenStreetMap for restaurants, cafes, salons, clinics, gyms, hotels & shops…</p>');
  try{
    const r = await fetch("https://overpass-api.de/api/interpreter", {
      method:"POST",
      headers:{ "Content-Type":"application/x-www-form-urlencoded" },
      body:"data="+encodeURIComponent(overpassQL(z))
    });
    if(!r.ok) throw new Error("overpass "+r.status);
    const d = await r.json();
    const have = {};
    (db.pitch[z.id]||[]).forEach(function(p){ have[p.oid]=1; });
    researchResults = (d.elements||[])
      .filter(function(e){ return e.tags && e.tags.name && !have["n"+e.id]; })
      .slice(0,90)
      .map(function(e){
        return { oid:"n"+e.id, name:e.tags.name, cat:catLabel(e.tags),
                 lat:e.lat, lon:e.lon, addr:addrOf(e.tags) };
      });
    if(!researchResults.length){
      openModal('<h3>No new spots found</h3>'+
        '<p class="hintline">Everything found here is already in your list, or the area scan came up empty. Try another zone.</p>'+
        '<button class="btn" onclick="closeModal()">Close</button>');
      return;
    }
    showResearchModal(z);
  }catch(e){
    openModal('<h3>Research failed</h3>'+
      '<p class="hintline">Network hiccup talking to OpenStreetMap. Check your connection and try again.</p>'+
      '<div class="btnrow"><button class="btn" onclick="closeModal()">Close</button>'+
      '<button class="btn ghost" onclick="researchZone()">Retry</button></div>');
  }
}
function showResearchModal(z){
  const rows = researchResults.map(function(c,i){
    return '<label class="resrow"><input type="checkbox" data-i="'+i+'" checked>'+
      '<span class="grow"><b>'+esc(c.name)+'</b><br>'+
      '<span class="sub2">'+esc(c.cat)+(c.addr?" · "+esc(c.addr):"")+'</span></span></label>';
  }).join("");
  openModal(
    '<h3>'+researchResults.length+' found in '+esc(z.name)+'</h3>'+
    '<p class="hintline">Tick the ones worth pitching, then add them. Aim for 50–70.</p>'+
    '<div class="btnrow" style="margin-bottom:8px">'+
      '<button class="btn ghost small" onclick="researchCheckAll(true)">Select all</button>'+
      '<button class="btn ghost small" onclick="researchCheckAll(false)">Clear</button></div>'+
    '<div style="max-height:46vh;overflow-y:auto">'+rows+'</div>'+
    '<div class="btnrow"><button class="btn" id="res-add" onclick="addResearch()">Add selected</button></div>'
  );
  updateResCount();
  document.querySelectorAll('#modal input[type=checkbox]').forEach(function(cb){
    cb.addEventListener("change", updateResCount);
  });
}
function researchCheckAll(v){
  document.querySelectorAll('#modal input[type=checkbox]').forEach(function(cb){ cb.checked=v; });
  updateResCount();
}
function updateResCount(){
  const n = document.querySelectorAll('#modal input[type=checkbox]:checked').length;
  const b = document.getElementById("res-add");
  if(b) b.textContent = "Add selected ("+n+")";
}
function addResearch(){
  const z = currentZoneObj();
  const list = pitchOf(z.id);
  let added = 0;
  document.querySelectorAll('#modal input[type=checkbox]:checked').forEach(function(cb){
    const c = researchResults[parseInt(cb.dataset.i,10)];
    if(c && !list.some(function(p){return p.oid===c.oid;})){
      list.push({ oid:c.oid, name:c.name, cat:c.cat, lat:c.lat, lon:c.lon,
                  addr:c.addr, status:"new", note:"", order:null });
      added++;
    }
  });
  save(); closeModal();
  renderZoneDetail(); drawMarkers();
  toast(added+" added — now build the route 🧭");
}

/* ---------------- route optimizer ---------------- */
function hav(a,b){
  const R=6371, dLa=(b.lat-a.lat)*Math.PI/180, dLo=(b.lon-a.lon)*Math.PI/180;
  const s=Math.sin(dLa/2)*Math.sin(dLa/2)+
    Math.cos(a.lat*Math.PI/180)*Math.cos(b.lat*Math.PI/180)*
    Math.sin(dLo/2)*Math.sin(dLo/2);
  return 2*R*Math.asin(Math.sqrt(s));
}
function getPos(ms){
  return new Promise(function(res, rej){
    if(!navigator.geolocation) return rej(new Error("no gps"));
    const to = setTimeout(function(){ rej(new Error("timeout")); }, ms||9000);
    navigator.geolocation.getCurrentPosition(
      function(p){ clearTimeout(to); res({lat:p.coords.latitude, lon:p.coords.longitude}); },
      function(e){ clearTimeout(to); rej(e); },
      {enableHighAccuracy:true, timeout:ms||9000, maximumAge:60000}
    );
  });
}
async function osrmTable(start, pts){
  try{
    const coords = [start].concat(pts).map(function(p){return p.lon+","+p.lat;}).join(";");
    const r = await fetch("https://router.project-osrm.org/table/v1/driving/"+
      coords+"?annotations=distance");
    const d = await r.json();
    if(d && d.code==="Ok" && d.distances) return d.distances;
  }catch(e){}
  return null;
}
function routeOrder(matrix, start, pts){
  const n = pts.length;
  function dist(i,j){ // 0 = start, 1..n = points
    if(matrix && matrix[i] && matrix[i][j]!=null) return matrix[i][j];
    const a = i===0? start : pts[i-1], b = j===0? start : pts[j-1];
    return hav(a,b)*1000;
  }
  const unv=[]; for(let i=1;i<=n;i++) unv.push(i);
  const tour=[0]; let cur=0;
  while(unv.length){
    let bi=0, bd=Infinity;
    for(let k=0;k<unv.length;k++){ const d=dist(cur,unv[k]); if(d<bd){bd=d;bi=k;} }
    cur=unv.splice(bi,1)[0]; tour.push(cur);
  }
  let improved=true, guard=0;
  while(improved && guard++<40){
    improved=false;
    for(let i=1;i<tour.length-1;i++){
      for(let k=i+1;k<tour.length;k++){
        const a=tour[i-1], b=tour[i], c=tour[k], d=tour[k+1];
        const before=dist(a,b)+(d===undefined?0:dist(c,d));
        const after=dist(a,c)+(d===undefined?0:dist(b,d));
        if(after<before-1){
          const seg=tour.slice(i,k+1).reverse();
          for(let t=0;t<seg.length;t++) tour[i+t]=seg[t];
          improved=true;
        }
      }
    }
  }
  return tour.slice(1).map(function(x){return x-1;});
}
async function buildRoute(){
  const z = currentZoneObj();
  const list = pitchOf(z.id);
  if(!list.length){ toast("Research businesses first"); return; }
  toast("Getting your location…");
  let start;
  try{ start = await getPos(9000); }
  catch(e){ start = {lat:z.lat, lon:z.lon}; toast("GPS off — starting from zone center"); }
  toast("Optimizing "+list.length+" stops…");
  const pts = list.map(function(p){return {lat:p.lat, lon:p.lon};});
  const matrix = pts.length<=100 ? await osrmTable(start, pts) : null;
  const order = routeOrder(matrix, start, pts);
  order.forEach(function(pi,i){ list[pi].order = i+1; });
  list.sort(function(a,b){return (a.order||9999)-(b.order||9999);});
  try{
    db.pitchMeta = db.pitchMeta||{};
    db.pitchMeta[z.id] = {startLat:start.lat, startLon:start.lon};
  }catch(e){}
  save(); renderZoneDetail(); drawMarkers();
  toast("Route ready — stop 1 → stop "+list.length+" 🧭");
}
function openMapsChunk(){
  const z = currentZoneObj();
  const list = (db.pitch[z.id]||[]).filter(function(p){return p.order && p.status!=="bought" && p.status!=="no";})
    .sort(function(a,b){return a.order-b.order;}).slice(0,9);
  if(!list.length){ toast("Nothing left to visit here 🎉"); return; }
  const meta = (db.pitchMeta&&db.pitchMeta[z.id]) || {startLat:z.lat, startLon:z.lon};
  const origin = meta.startLat+","+meta.startLon;
  const dest = list[list.length-1].lat+","+list[list.length-1].lon;
  const wp = list.slice(0,-1).map(function(p){return p.lat+","+p.lon;}).join("|");
  let url = "https://www.google.com/maps/dir/?api=1&origin="+origin+"&destination="+dest+"&travelmode=driving";
  if(wp) url += "&waypoints="+encodeURIComponent(wp);
  window.open(url,"_blank");
}

/* ============================================================
   SECTORS — 100-sector Mumbai pitch map.
   Tap sector → live OSM business discovery (Overpass) → select →
   ordered route (GPS start, NN + 2-opt over OSRM) → live 3D map.
   HONESTY: OSM has no Google review counts and coverage varies —
   the UI says so. Nothing is fabricated.
   Stops live in db.sectors (localStorage). Old zone tab untouched.
   ============================================================ */
let SECTORS100 = [];
let currentSector = null;
let secmap = null;
let secMarkers = [];
let sectorResearchResults = [];

function sectorById(id){ return SECTORS100.find(function(s){return s.id===id;}); }
function sectorStops(sid){ return db.sectors[sid] || (db.sectors[sid] = []); }

async function loadSectors(){
  try{
    const r = await fetch("./sector-data/sectors.json");
    if(r.ok) SECTORS100 = await r.json();
  }catch(e){}
  renderSectors();
}
function tierPill(tier){
  const label = tier===1? "T1 · Premium" : tier===2? "T2 · Mid" : "T3";
  return '<span class="pill t'+tier+'">'+label+'</span>';
}
function renderSectors(){
  const el = document.getElementById("sector-list");
  if(!el) return;
  const q = (document.getElementById("sector-search").value||"").toLowerCase();
  if(!SECTORS100.length){
    el.innerHTML = '<div class="empty">Sector data not loaded yet.<br>Check your connection and reopen the app.</div>';
    return;
  }
  const items = SECTORS100.filter(function(s){
    return !q || (s.id+" "+s.name+" "+s.landmarks+" "+s.parent).toLowerCase().indexOf(q)>=0;
  });
  if(!items.length){
    el.innerHTML = '<div class="empty">No sectors match that search.</div>';
    return;
  }
  el.innerHTML = items.map(function(s){
    const list = db.sectors[s.id]||[];
    const done = list.filter(function(p){return p.status!=="new";}).length;
    const bought = list.filter(function(p){return p.status==="bought";}).length;
    return '<div class="card" onclick="openSector(\''+s.id+'\')" style="cursor:pointer">'+
      '<div class="row"><div class="grow"><div class="name">📌 '+s.id+' · '+esc(s.name)+'</div>'+
      '<div class="sub2">'+esc(s.landmarks)+'</div></div>'+
      '<span style="color:var(--muted);font-size:20px">›</span></div>'+
      '<div style="margin-top:10px;display:flex;gap:6px;flex-wrap:wrap">'+
        tierPill(s.tier)+
        '<span class="pill">'+list.length+' stops</span>'+
        (done? '<span class="pill">✓ '+done+' done</span>':"")+
        (bought? '<span class="pill green">💰 '+bought+' bought</span>':"")+
      '</div></div>';
  }).join("");
}

function openSector(id){
  const s = sectorById(id);
  if(!s || typeof s.lat!=="number"){ toast("Sector data not loaded yet"); return; }
  currentSector = id;
  document.getElementById("sec-name").textContent = s.id+" · "+s.name;
  document.getElementById("sec-sub").textContent = s.landmarks;
  document.getElementById("sec-tier").innerHTML = tierPill(s.tier);
  document.getElementById("sectorview").classList.add("open");
  document.body.style.overflow = "hidden";
  renderSectorDetail();
  sectorCuratedProbe();
  initSecMap(s);
  document.getElementById("sectorview").scrollTop = 0;
}
function closeSector(){
  destroySecMap();
  document.getElementById("sectorview").classList.remove("open");
  document.body.style.overflow = "";
  currentSector = null;
  renderSectors(); renderHome();
}

function renderSectorDetail(){
  const s = sectorById(currentSector); if(!s) return;
  const list = sectorStops(s.id).slice().sort(function(a,b){
    return (a.order||9999)-(b.order||9999);
  });
  const done = list.filter(function(p){return p.status!=="new";}).length;
  document.getElementById("sec-count").textContent = "· "+list.length;
  document.getElementById("sec-progress-label").textContent =
    list.length? done+" of "+list.length+" visited" : "No stops yet — hit Find businesses";
  document.getElementById("sec-progress").style.width =
    list.length? Math.round(done/list.length*100)+"%" : "0%";
  const box = document.getElementById("sec-list");
  if(!list.length){
    box.innerHTML = '<div class="empty">Few businesses mapped here yet — widen the search or add manually.</div>'+
      '<div class="btnrow" style="margin-bottom:8px"><button class="btn" onclick="sectorResearch()">🔍 Find businesses</button></div>'+
      '<div class="btnrow"><button class="btn ghost" onclick="sectorWidenSearch()">🌐 Widen search</button>'+
      '<button class="btn ghost" onclick="sectorAddManual()">➕ Add manually</button></div>';
    return;
  }
  box.innerHTML = list.map(function(p){
    const nb = p.status==="bought"
      ? '<div class="num bought">'+(p.order||"💰")+'</div>'
      : '<div class="num'+(p.status!=="new"?" done":"")+'">'+(p.order||"•")+'</div>';
    function sb(st,label){
      return '<button class="sbtn'+(p.status===st?" on-"+st:"")+'" onclick="sectorSetStatus(\''+p.oid+'\',\''+st+'\')">'+label+'</button>';
    }
    return '<div class="card"><div class="row">'+nb+'<div class="grow">'+
      '<div class="name" style="font-size:15px">'+esc(p.name)+'</div>'+
      ((p.rating&&p.reviews)? '<div class="sub2">★ '+esc(String(p.rating))+' · '+esc(String(p.reviews))+' Google reviews</div>':"")+
      '<div class="sub2">'+esc(p.cat||"")+(p.addr? " · "+esc(p.addr):"")+
        ((p.manual||p.curated)? " · "+(p.manual?"✋ manual":"📂 curated"):"")+'</div></div>'+
      '<button class="iconbtn" onclick="window.open(\'https://www.google.com/maps/dir/?api=1&destination='+p.lat+','+p.lon+'\',\'_blank\')">🧭</button></div>'+
      '<div class="statusbtns">'+sb("pitched","✓ Pitched")+sb("bought","💰 Bought")+sb("no","✗ No")+'</div>'+
      '<input class="notein" placeholder="1-line note…" value="'+esc(p.note||"")+'" onchange="sectorSetNote(\''+p.oid+'\',this.value)">'+
      '</div>';
  }).join("");
}
function sectorSetStatus(oid, s){
  const list = sectorStops(currentSector);
  const p = list.find(function(x){return x.oid===oid;});
  if(!p) return;
  p.status = (p.status===s)? "new" : s;
  save(); renderSectorDetail(); drawSectorMarkers();
}
function sectorSetNote(oid, v){
  const list = sectorStops(currentSector);
  const p = list.find(function(x){return x.oid===oid;});
  if(p){ p.note = v; save(); }
}

/* ---------------- live 3D map (MapLibre GL) ---------------- */
function destroySecMap(){
  try{ secMarkers.forEach(function(m){ m.remove(); }); }catch(e){}
  secMarkers = [];
  if(secmap){ try{ secmap.remove(); }catch(e){} secmap = null; }
}
function initSecMap(s){
  destroySecMap();
  if(!window.maplibregl){
    document.getElementById("secmap").innerHTML =
      '<div class="empty">3D map needs the MapLibre library (internet).<br>The stop list below still works.</div>';
    return;
  }
  try{
    secmap = new maplibregl.Map({
      container:"secmap",
      style:"https://tiles.openfreemap.org/styles/positron",
      center:[s.lon, s.lat],
      zoom:14.2, pitch:60, bearing:-15
    });
    secmap.addControl(new maplibregl.NavigationControl(), "top-right");
    secmap.on("load", function(){
      try{
        if(!secmap.getLayer("vortrix-3d")){
          secmap.addLayer({
            id:"vortrix-3d",
            source:"openmaptiles",
            "source-layer":"building",
            type:"fill-extrusion",
            minzoom:13.5,
            paint:{
              "fill-extrusion-color":"#c9a35a",
              "fill-extrusion-height":["interpolate",["linear"],["zoom"],13.5,0,15,["coalesce",["get","render_height"],12]],
              "fill-extrusion-base":["coalesce",["get","render_min_height"],0],
              "fill-extrusion-opacity":0.55
            }
          });
        }
      }catch(e){}
      drawSectorMarkers();
    });
  }catch(e){
    document.getElementById("secmap").innerHTML =
      '<div class="empty">3D map failed to start.<br>The stop list below still works.</div>';
    secmap = null;
  }
  setTimeout(function(){ if(secmap) secmap.resize(); }, 400);
  drawSectorMarkers();
}
function drawSectorMarkers(){
  if(!secmap || !window.maplibregl) return;
  const s = sectorById(currentSector); if(!s) return;
  try{ secMarkers.forEach(function(m){ m.remove(); }); }catch(e){}
  secMarkers = [];
  const list = (db.sectors[s.id]||[]).filter(function(p){return p.lat && p.lon;});
  const ordered = list.filter(function(p){return p.order;}).sort(function(a,b){return a.order-b.order;});
  list.forEach(function(p){
    const el = document.createElement("div");
    el.className = "ml-num"+((p.status==="bought"||p.status==="no")?" dim":"");
    el.textContent = p.order||"•";
    const mk = new maplibregl.Marker({element:el})
      .setLngLat([p.lon, p.lat])
      .setPopup(new maplibregl.Popup({offset:25})
        .setHTML("<b>"+esc(p.name)+"</b><br>"+esc(p.cat||"")))
      .addTo(secmap);
    secMarkers.push(mk);
  });
  if(secmap.isStyleLoaded()){
    try{
      const pts = ordered.length>1? ordered : list;
      const data = {type:"FeatureCollection", features: pts.length? [{
        type:"Feature",
        geometry:{type:"LineString", coordinates:pts.map(function(p){return [p.lon,p.lat];})},
        properties:{}
      }] : []};
      if(secmap.getSource("sec-route")){
        secmap.getSource("sec-route").setData(data);
      } else if(ordered.length>1){
        secmap.addSource("sec-route", {type:"geojson", data:data});
        secmap.addLayer({
          id:"sec-route-line", type:"line", source:"sec-route",
          paint:{"line-color":"#d8a94e","line-width":4,"line-opacity":0.85}
        });
      }
    }catch(e){}
  }
  try{
    if(list.length){
      const b = new maplibregl.LngLatBounds();
      list.forEach(function(p){ b.extend([p.lon,p.lat]); });
      secmap.fitBounds(b, {padding:50, pitch:60, duration:800});
    } else {
      secmap.flyTo({center:[s.lon,s.lat], zoom:14.2, pitch:60});
    }
  }catch(e){}
}

/* ---------------- live business discovery (Overpass) ---------------- */
function sectorOverpassQL(s, radius){
  radius = radius || 2000;
  const r = radius+","+s.lat+","+s.lon;
  return "[out:json][timeout:35];("+
    'nwr["shop"~"^(clothes|shoes|jewelry|beauty|cosmetics|hairdresser|massage|bakery|pastry|confectionery|florist|gift|optician|mobile_phone|electronics|furniture|books|bicycle|car|motorcycle|travel_agency|department_store|supermarket|mall)$"](around:'+r+");"+
    'nwr["amenity"~"^(restaurant|cafe|fast_food|bar|ice_cream|beauty|dentist|doctors|clinic|pharmacy|gym|spa)$"](around:'+r+");"+
    'nwr["leisure"="fitness_centre"](around:'+r+");"+
    'nwr["tourism"="hotel"](around:'+r+");"+
    'nwr["office"](around:'+r+");"+
    ");out center 150;";
}
async function overpassFetch(ql){
  const urls = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter"
  ];
  let lastErr = null;
  for(let a=0; a<4; a++){
    const url = urls[a % urls.length];
    try{
      const r = await fetch(url, {
        method:"POST",
        headers:{ "Content-Type":"application/x-www-form-urlencoded" },
        body:"data="+encodeURIComponent(ql)
      });
      if(r.status===429 || r.status===502 || r.status===504 || r.status===503){
        lastErr = new Error("Overpass busy ("+r.status+") — retrying…");
      } else if(!r.ok){
        lastErr = new Error("Overpass error "+r.status);
      } else {
        return await r.json();
      }
    }catch(e){
      if(!lastErr || /busy/.test(String(lastErr))) lastErr = e;
    }
    await new Promise(function(res){ setTimeout(res, 2000*(a+1)); });
  }
  throw lastErr || new Error("Overpass failed");
}
/* Extract prospects from an Overpass response, excluding stops already in the sector list. */
function collectSectorProspects(s, d){
  const list = sectorStops(s.id);
  const have = {};
  const haveName = {};
  list.forEach(function(p){
    have[p.oid]=1;
    haveName[(p.name||"").toLowerCase().trim().replace(/\s+/g," ")]=1;
  });
  const seen = {};
  const out = [];
  (d.elements||[]).forEach(function(e){
    if(!e.tags || !e.tags.name) return;
    const lat = e.lat || (e.center && e.center.lat);
    const lon = e.lon || (e.center && e.center.lon);
    if(!lat || !lon) return;
    const oid = "sec"+e.type[0]+e.id;
    const norm = e.tags.name.toLowerCase().trim().replace(/\s+/g," ");
    if(have[oid] || haveName[norm]) return;
    const key = norm+"|"+lat.toFixed(3)+","+lon.toFixed(3);
    if(seen[key]) return;
    seen[key] = 1;
    out.push({
      oid:oid, name:e.tags.name, cat:catLabel(e.tags),
      lat:lat, lon:lon, addr:addrOf(e.tags),
      dist:hav({lat:s.lat,lon:s.lon},{lat:lat,lon:lon})
    });
  });
  out.sort(function(a,b){ return a.dist-b.dist; });
  return out.slice(0,150);
}
/* Merge two prospect arrays, deduped by oid, sorted by distance, capped at 150. */
function mergeProspects(base, extra){
  const seen = {};
  base.forEach(function(c){ seen[c.oid]=1; });
  extra.forEach(function(c){ if(!seen[c.oid]){ seen[c.oid]=1; base.push(c); } });
  base.sort(function(a,b){ return a.dist-b.dist; });
  return base.slice(0,150);
}
async function sectorResearch(){
  const s = sectorById(currentSector); if(!s) return;
  openModal('<h3>🔍 Finding businesses in '+esc(s.name)+'</h3>'+
    '<p class="hintline">Scanning <b>live OSM data</b> within ~2 km — restaurants, cafes, salons, clinics, gyms, hotels & shops…<br>'+
    '<b>No review counts</b> — OSM doesn\'t have them. Coverage varies by area.</p>');
  try{
    let results = collectSectorProspects(s, await overpassFetch(sectorOverpassQL(s)));
    let radiusNote = "~2 km";
    if(results.length < 20){
      // thin coverage — auto-retry once with a wider radius, then merge
      try{
        const d2 = await overpassFetch(sectorOverpassQL(s, 3500));
        results = mergeProspects(results, collectSectorProspects(s, d2));
        radiusNote = "few spots nearby — auto-widened to ~3.5 km";
      }catch(e2){ /* keep first-pass results */ }
    }
    sectorResearchResults = results;
    if(!sectorResearchResults.length){
      openModal('<h3>Nothing found here yet</h3>'+
        '<p class="hintline">Few businesses mapped here yet — widen the search or add manually.</p>'+
        '<div class="btnrow"><button class="btn" onclick="sectorWidenSearch()">🌐 Widen search (5 km)</button>'+
        '<button class="btn ghost" onclick="sectorAddManual()">➕ Add manually</button></div>'+
        '<div class="btnrow"><button class="btn ghost" onclick="closeModal()">Close</button></div>');
      return;
    }
    showSectorResearchModal(s, radiusNote);
  }catch(e){
    openModal('<h3>Search failed</h3>'+
      '<p class="hintline">'+esc(String((e&&e.message)||e))+'<br>Overpass (the OSM server) can be slow or rate-limited. Check your connection and retry.</p>'+
      '<div class="btnrow"><button class="btn" onclick="closeModal()">Close</button>'+
      '<button class="btn ghost" onclick="sectorResearch()">↻ Retry</button></div>');
  }
}
/* Manual "widen search" — re-run discovery at 5 km and merge anything new. */
async function sectorWidenSearch(){
  const s = sectorById(currentSector); if(!s) return;
  openModal('<h3>🌐 Widening search…</h3>'+
    '<p class="hintline">Pulling live OSM data within ~5 km of '+esc(s.name)+'.</p>');
  try{
    const fresh = collectSectorProspects(s, await overpassFetch(sectorOverpassQL(s, 5000)));
    sectorResearchResults = mergeProspects(sectorResearchResults, fresh);
    if(!sectorResearchResults.length){
      openModal('<h3>Still nothing mapped here</h3>'+
        '<p class="hintline">Few businesses mapped here yet — add them manually as you walk the sector.</p>'+
        '<div class="btnrow"><button class="btn" onclick="sectorAddManual()">➕ Add manually</button>'+
        '<button class="btn ghost" onclick="closeModal()">Close</button></div>');
      return;
    }
    showSectorResearchModal(s, "widened to ~5 km");
  }catch(e){
    openModal('<h3>Widen failed</h3>'+
      '<p class="hintline">'+esc(String((e&&e.message)||e))+'<br>Overpass can be slow or rate-limited. Retry in a bit.</p>'+
      '<div class="btnrow"><button class="btn" onclick="closeModal()">Close</button>'+
      '<button class="btn ghost" onclick="sectorWidenSearch()">↻ Retry</button></div>');
  }
}
function showSectorResearchModal(s, radiusNote){
  const rows = sectorResearchResults.map(function(c,i){
    return '<label class="resrow"><input type="checkbox" data-i="'+i+'" checked>'+
      '<span class="grow"><b>'+esc(c.name)+'</b><br>'+
      '<span class="sub2">'+esc(c.cat)+(c.addr?" · "+esc(c.addr):"")+' · '+c.dist.toFixed(1)+' km</span></span></label>';
  }).join("");
  openModal(
    '<h3>'+sectorResearchResults.length+' found in '+esc(s.name)+'</h3>'+
    '<p class="sub2" style="margin:-6px 0 8px">live OSM data · '+(radiusNote||"~2 km")+'</p>'+
    '<p class="hintline">Live OSM data — no review counts, coverage varies. Tick the good ones worth pitching (aim 50–70).</p>'+
    '<div class="btnrow" style="margin-bottom:8px">'+
      '<button class="btn ghost small" onclick="sectorCheckAll(true)">Select all</button>'+
      '<button class="btn ghost small" onclick="sectorCheckAll(false)">Clear</button>'+
      '<button class="btn ghost small" onclick="sectorWidenSearch()">🌐 Widen (5 km)</button></div>'+
    '<div style="max-height:46vh;overflow-y:auto">'+rows+'</div>'+
    '<div class="btnrow"><button class="btn" id="secres-add" onclick="sectorAddResearch()">Add selected</button></div>'
  );
  sectorUpdateResCount();
  document.querySelectorAll('#modal input[type=checkbox]').forEach(function(cb){
    cb.addEventListener("change", sectorUpdateResCount);
  });
}
function sectorCheckAll(v){
  document.querySelectorAll('#modal input[type=checkbox]').forEach(function(cb){ cb.checked=v; });
  sectorUpdateResCount();
}
function sectorUpdateResCount(){
  const n = document.querySelectorAll('#modal input[type=checkbox]:checked').length;
  const b = document.getElementById("secres-add");
  if(b) b.textContent = "Add selected ("+n+")";
}
function sectorAddResearch(){
  const s = sectorById(currentSector); if(!s) return;
  const list = sectorStops(s.id);
  let added = 0;
  document.querySelectorAll('#modal input[type=checkbox]:checked').forEach(function(cb){
    const c = sectorResearchResults[parseInt(cb.dataset.i,10)];
    if(c && !list.some(function(p){return p.oid===c.oid;})){
      list.push({ oid:c.oid, name:c.name, cat:c.cat, lat:c.lat, lon:c.lon,
                  addr:c.addr, status:"new", note:"", order:null });
      added++;
    }
  });
  save(); closeModal();
  renderSectorDetail(); drawSectorMarkers();
  toast(added+" added — now build the route 🧭");
}

/* ---------------- manual add (Nominatim geocode + pin confirm) ---------------- */
let sectorManualCands = [];
async function sectorAddManual(){
  const s = sectorById(currentSector); if(!s) return;
  openModal('<h3>➕ Add business manually</h3>'+
    '<p class="hintline">Type the business name as it appears on its board or on Google. We\'ll find it on the map and you confirm the pin.</p>'+
    '<input id="man-name" class="notein" placeholder="Business name…" style="margin-bottom:8px">'+
    '<input id="man-cat" class="notein" placeholder="Category (optional) e.g. Salon">'+
    '<div class="btnrow"><button class="btn" onclick="sectorManualGeocode()">📍 Find on map</button>'+
    '<button class="btn ghost" onclick="closeModal()">Cancel</button></div>');
  setTimeout(function(){ const i=document.getElementById("man-name"); if(i) i.focus(); }, 100);
}
async function sectorManualGeocode(){
  const s = sectorById(currentSector); if(!s) return;
  const name = (document.getElementById("man-name").value||"").trim();
  const cat = (document.getElementById("man-cat").value||"").trim();
  if(!name){ toast("Type a business name first"); return; }
  openModal('<h3>Searching…</h3><p class="hintline">Looking up "'+esc(name)+'" near '+esc(s.name)+'.</p>');
  try{
    const q = name+" "+s.name+" Mumbai India";
    const r = await fetch("https://nominatim.openstreetmap.org/search?format=json&limit=5&addressdetails=1&q="+encodeURIComponent(q),
      { headers:{ "Accept":"application/json" } });
    if(!r.ok) throw new Error("nominatim "+r.status);
    const res = await r.json();
    if(!res.length){
      openModal('<h3>No match found</h3>'+
        '<p class="hintline">Nothing found for "'+esc(name)+'". Try a more specific name — add the road or landmark, e.g. "'+esc(name)+' Linking Road".</p>'+
        '<div class="btnrow"><button class="btn ghost" onclick="sectorAddManual()">← Back</button>'+
        '<button class="btn ghost" onclick="closeModal()">Cancel</button></div>');
      return;
    }
    sectorManualCands = res.map(function(p){
      return { name:name, cat:cat,
        lat:parseFloat(p.lat), lon:parseFloat(p.lon),
        addr:(p.display_name||"").split(",").slice(0,2).join(","), full:p.display_name||"" };
    });
    const rows = sectorManualCands.map(function(c,i){
      return '<div class="card" style="margin-bottom:8px"><div class="row"><div class="grow">'+
        '<div class="name" style="font-size:15px">'+esc(c.full.split(",").slice(0,2).join(","))+'</div>'+
        '<div class="sub2">'+esc(c.full)+'</div></div>'+
        '<button class="btn small" onclick="sectorConfirmManual('+i+')">Use this</button></div></div>';
    }).join("");
    openModal('<h3>Confirm the pin</h3><p class="hintline">Pick the right location for <b>'+esc(name)+'</b>:</p>'+
      '<div style="max-height:46vh;overflow-y:auto">'+rows+'</div>'+
      '<div class="btnrow"><button class="btn ghost" onclick="sectorAddManual()">← Back</button></div>');
  }catch(e){
    openModal('<h3>Lookup failed</h3>'+
      '<p class="hintline">'+esc(String((e&&e.message)||e))+'<br>Check your connection and retry.</p>'+
      '<div class="btnrow"><button class="btn ghost" onclick="sectorAddManual()">← Back</button></div>');
  }
}
function sectorConfirmManual(i){
  const s = sectorById(currentSector); if(!s) return;
  const c = sectorManualCands[i]; if(!c) return;
  const list = sectorStops(s.id);
  const norm = c.name.toLowerCase().trim();
  if(list.some(function(p){ return (p.name||"").toLowerCase().trim()===norm; })){
    toast("Already in your stops"); closeModal(); renderSectorDetail(); return;
  }
  list.push({ oid:"man"+Date.now(), name:c.name, cat:c.cat||"Business",
    lat:c.lat, lon:c.lon, addr:c.addr, status:"new", note:"", order:null, manual:true });
  save(); closeModal(); renderSectorDetail(); drawSectorMarkers();
  toast("Added — check the pin on the map ✋");
}

/* ---------------- curated lists (./sector-data/<ID>-curated.json) ----------------
   Accepts either a plain array or an object with a .stops array (like
   S001-bandra-west.json), and either {name,cat,…} or {name,category,…} fields.
   Rating/review counts are kept and shown when present. */
let sectorCuratedCache = {};
async function sectorCuratedData(s){
  if(sectorCuratedCache[s.id] !== undefined) return sectorCuratedCache[s.id];
  let raw = null;
  const urls = ["./sector-data/"+s.id+"-curated.json"];
  if(s.id==="S001") urls.push("./sector-data/S001-bandra-west.json");
  for(let u=0; u<urls.length; u++){
    try{
      const r = await fetch(urls[u]);
      if(r.ok){ raw = await r.json(); break; }
    }catch(e){}
  }
  let arr = [];
  if(raw){
    const items = Array.isArray(raw) ? raw : (raw.stops || []);
    arr = items.map(function(it){
      if(!it || !it.name) return null;
      const lat = parseFloat(it.lat), lon = parseFloat(it.lon);
      if(!(lat && lon)) return null;
      return {
        oid:"cur-"+String(it.name).toLowerCase().trim().replace(/[^a-z0-9]+/g,"-").slice(0,40),
        name:it.name, cat:it.cat||it.category||"Business",
        addr:it.addr||it.area||it.address||"",
        lat:lat, lon:lon,
        rating:it.rating||null, reviews:it.reviews||null,
        curated:true
      };
    }).filter(Boolean);
  }
  sectorCuratedCache[s.id] = arr;
  return arr;
}
function sectorCuratedProbe(){
  const s = sectorById(currentSector); if(!s) return;
  sectorCuratedData(s).then(function(arr){
    const b = document.getElementById("sec-curated-btn");
    if(b) b.style.display = arr.length? "" : "none";
  });
}
async function sectorLoadCurated(){
  const s = sectorById(currentSector); if(!s) return;
  const arr = await sectorCuratedData(s);
  if(!arr.length){ toast("No curated list for this sector"); return; }
  const list = sectorStops(s.id);
  let added = 0;
  arr.forEach(function(c){
    const norm = c.name.toLowerCase().trim();
    const dup = list.some(function(p){
      return p.oid===c.oid || (p.name||"").toLowerCase().trim()===norm;
    });
    if(!dup){
      list.push({ oid:c.oid, name:c.name, cat:c.cat, lat:c.lat, lon:c.lon,
        addr:c.addr, rating:c.rating, reviews:c.reviews,
        status:"new", note:"", order:null, curated:true });
      added++;
    }
  });
  save(); renderSectorDetail(); drawSectorMarkers();
  toast(added? added+" curated spots added 📂" : "Curated list already loaded ✓");
}

/* ---------------- sector route ---------------- */
async function sectorBuildRoute(){
  const s = sectorById(currentSector); if(!s) return;
  const list = sectorStops(s.id);
  if(!list.length){ toast("Find businesses first"); return; }
  toast("Getting your location…");
  let start;
  try{ start = await getPos(9000); }
  catch(e){ start = {lat:s.lat, lon:s.lon}; toast("GPS off — starting from sector center"); }
  toast("Optimizing "+list.length+" stops…");
  const pts = list.map(function(p){return {lat:p.lat, lon:p.lon};});
  const matrix = pts.length<=100 ? await osrmTable(start, pts) : null;
  const order = routeOrder(matrix, start, pts);
  order.forEach(function(pi,i){ list[pi].order = i+1; });
  list.sort(function(a,b){return (a.order||9999)-(b.order||9999);});
  db.sectorMeta = db.sectorMeta||{};
  db.sectorMeta[s.id] = {startLat:start.lat, startLon:start.lon};
  save(); renderSectorDetail(); drawSectorMarkers();
  toast("Route ready — stop 1 → stop "+list.length+" 🧭");
}
function sectorOpenMapsChunk(){
  const s = sectorById(currentSector); if(!s) return;
  const list = (db.sectors[s.id]||[]).filter(function(p){return p.order && p.status!=="bought" && p.status!=="no";})
    .sort(function(a,b){return a.order-b.order;}).slice(0,9);
  if(!list.length){ toast("Nothing left to visit here 🎉"); return; }
  const meta = (db.sectorMeta&&db.sectorMeta[s.id]) || {startLat:s.lat, startLon:s.lon};
  const origin = meta.startLat+","+meta.startLon;
  const dest = list[list.length-1].lat+","+list[list.length-1].lon;
  const wp = list.slice(0,-1).map(function(p){return p.lat+","+p.lon;}).join("|");
  let url = "https://www.google.com/maps/dir/?api=1&origin="+origin+"&destination="+dest+"&travelmode=driving";
  if(wp) url += "&waypoints="+encodeURIComponent(wp);
  window.open(url,"_blank");
}

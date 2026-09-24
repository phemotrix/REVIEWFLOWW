/* ============================================================
   Reviewwflow — your side only.
   Clients, cards, and the 100-sector Mumbai pitch map.
   (Customer tap page is tap.html — only opens on an NFC tap.)
   ============================================================ */
"use strict";

/* ---------------- Mumbai pitch zones ---------------- */

const CATS = ["Restaurant","Cafe","Salon","Clinic","Gym","Retail","Hotel","Other"];

/* ---------------- store ---------------- */
const DB_KEY = "vortrix_v2";
let db = { settings:{workerUrl:"",adminKey:""}, clients:[], cards:[], pitch:{}, sectors:{}, sectorMeta:{} };
try {
  const raw = localStorage.getItem(DB_KEY);
  if (raw) db = Object.assign(db, JSON.parse(raw));
} catch(e){}
if(!db.manual || typeof db.manual !== "object") db.manual = {clients:0,cards:0,pitched:0,bought:0};
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
  const m = db.manual || {clients:0,cards:0,pitched:0,bought:0};
  const nClients = Math.max(0, db.clients.length + (m.clients||0));
  const nCards   = Math.max(0, db.cards.filter(function(c){return c.status==="issued";}).length + (m.cards||0));
  const pitched  = Math.max(0, all.filter(function(p){return p.status==="pitched";}).length + (m.pitched||0));
  const bought   = Math.max(0, all.filter(function(p){return p.status==="bought";}).length + (m.bought||0));
  const no      = all.filter(function(p){return p.status==="no";}).length;
  const done = pitched+bought+no;
  document.getElementById("st-clients").textContent = nClients;
  document.getElementById("st-cards").textContent = nCards;
  document.getElementById("st-pitched").textContent = pitched;
  document.getElementById("st-bought").textContent = bought;
  document.getElementById("st-conv").textContent = done? Math.round(bought/done*100)+"%" : "0%";
  const mrr = db.clients.filter(function(c){return c.monthly;})
    .reduce(function(s,c){ return s + (parseInt(c.fee,10)||400); }, 0);
  document.getElementById("st-mrr").textContent = "₹"+mrr.toLocaleString("en-IN");
  document.getElementById("set-worker").value = db.settings.workerUrl||"";
  document.getElementById("set-key").value = db.settings.adminKey||"";
  if(db.settings.workerUrl && db.settings.adminKey) testConnection();
  else document.getElementById("set-status").innerHTML = "";
}
/* manual +/- steppers on the home stat cards */
function statBase(key){
  const all = pitchAll();
  if(key==="clients") return db.clients.length;
  if(key==="cards") return db.cards.filter(function(c){return c.status==="issued";}).length;
  if(key==="pitched") return all.filter(function(p){return p.status==="pitched";}).length;
  if(key==="bought") return all.filter(function(p){return p.status==="bought";}).length;
  return 0;
}
function nudgeStat(key, d){
  if(!db.manual || typeof db.manual !== "object") db.manual = {clients:0,cards:0,pitched:0,bought:0};
  const next = (db.manual[key]||0) + d;
  if(statBase(key) + next < 0) return; /* never below zero */
  db.manual[key] = next;
  save(); renderHome();
}
async function testConnection(){
  const url = (db.settings.workerUrl||"").replace(/\/+$/,"");
  const key = db.settings.adminKey||"";
  const st = document.getElementById("set-status");
  if(!url || !key){ st.innerHTML = '<span class="pill grey">Enter Worker URL + password first</span>'; return; }
  st.innerHTML = '<span class="pill grey">Testing…</span>';
  try{
    const ctrl = new AbortController();
    const to = setTimeout(function(){ ctrl.abort(); }, 9000);
    const r = await fetch(url+"/admin/list", { headers:{ "X-Admin-Key": key }, signal: ctrl.signal });
    clearTimeout(to);
    if(r.ok) st.innerHTML = '<span class="pill green">Connected ✓ — you\'re in</span>';
    else if(r.status===401) st.innerHTML = '<span class="pill red">Wrong password</span>';
    else st.innerHTML = '<span class="pill red">Worker error ('+r.status+')</span>';
  }catch(e){
    st.innerHTML = '<span class="pill red">Can\'t reach worker — check URL/connection</span>';
  }
}
function saveSettings(){
  db.settings.workerUrl = document.getElementById("set-worker").value.trim().replace(/\/+$/,"");
  db.settings.adminKey = document.getElementById("set-key").value;
  save(); renderHome(); testConnection(); toast("Connection saved");
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
  let u = base + "tap.html?biz=" + slug;
  // carry the worker URL in the link — the customer's phone has no settings saved
  const w = (db.settings.workerUrl||"").replace(/\/+$/,"");
  if(w) u += "&w=" + encodeURIComponent(w);
  return u;
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

function renderAll(){ renderHome(); renderClients(); renderCards(); renderSectors(); renderPacks(); }
document.addEventListener("DOMContentLoaded", function(){ renderAll(); loadSectors(); });


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
async function osrmTable(start, pts, profile){
  try{
    const coords = [start].concat(pts).map(function(p){return p.lon+","+p.lat;}).join(";");
    const r = await fetch("https://router.project-osrm.org/table/v1/"+(profile||"driving")+"/"+
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

/* ============================================================
   SECTORS — 100-sector Mumbai pitch map.
   Tap sector → live OSM business discovery (Overpass) → select →
   ordered route (GPS start, NN + 2-opt over OSRM) → live 3D map.
   HONESTY: OSM has no Google review counts and coverage varies —
   the UI says so. Nothing is fabricated.
   Stops live in db.sectors (localStorage). Sector data also ships embedded
   in this file as a fallback if the sector-data/ folder is missing.
   ============================================================ */
let SECTORS100 = [];

/* ===== EMBEDDED sector data (fallback if ./sector-data/*.json fetch fails) ===== */
const SECTORS_EMBEDDED = [{"id":"S001","name":"Bandra West","parent":"Bandra/Khar","landmarks":"Linking Rd, Pali Hill, Carter Rd, Bandstand, Waterfield Rd","tier":1,"lat":19.0596,"lon":72.8295,"src":"known"},{"id":"S002","name":"Khar West","parent":"Bandra/Khar","landmarks":"Khar Danda Rd, 14th/15th/16th Rd, Linking Rd ext","tier":1,"lat":19.0788759,"lon":72.8320646,"src":"nominatim"},{"id":"S003","name":"Santacruz West","parent":"Bandra/Khar","landmarks":"Juhu Tara Rd, Linking Rd (Santacruz), SV Rd","tier":1,"lat":19.0844004,"lon":72.8372899,"src":"nominatim"},{"id":"S004","name":"Bandra East \u00b7 BKC","parent":"Bandra/Khar","landmarks":"BKC, Kalanagar, Income Tax, MMRDA grounds","tier":1,"lat":19.0638693,"lon":72.8666148,"src":"nominatim"},{"id":"S005","name":"Bandra Station West","parent":"Bandra/Khar","landmarks":"Hill Rd, Bazaar Rd, St. Peter's, Station Rd","tier":1,"lat":19.0552109,"lon":72.8304474,"src":"nominatim"},{"id":"S006","name":"Juhu","parent":"Andheri West","landmarks":"Juhu Beach, JVPD, ISKCON, Juhu Koliwada","tier":1,"lat":19.1130692,"lon":72.8266734,"src":"nominatim"},{"id":"S007","name":"Veera Desai \u00b7 Oshiwara","parent":"Andheri West","landmarks":"Veera Desai Rd, Oshiwara Garden, Andheri Sports Complex","tier":1,"lat":19.1344232,"lon":72.8353783,"src":"nominatim"},{"id":"S008","name":"Lokhandwala","parent":"Andheri West","landmarks":"Lokhandwala Complex, Back Rd, Green Acres","tier":1,"lat":19.1430985,"lon":72.8246055,"src":"nominatim"},{"id":"S009","name":"Fort \u00b7 Kala Ghoda","parent":"South Mumbai","landmarks":"Horniman Circle, Kala Ghoda, DN Rd, Fountain","tier":1,"lat":18.9320095,"lon":72.8350198,"src":"nominatim"},{"id":"S010","name":"Ballard Estate","parent":"South Mumbai","landmarks":"Ballard Pier, Custom House, Fort south","tier":1,"lat":18.9366512,"lon":72.8391325,"src":"nominatim"},{"id":"S011","name":"Colaba","parent":"South Mumbai","landmarks":"Colaba Causeway, Gateway, Regal Circle, Colaba Market","tier":1,"lat":18.9230531,"lon":72.8316969,"src":"nominatim"},{"id":"S012","name":"Cuffe Parade","parent":"South Mumbai","landmarks":"Nariman Point, NCPA, Maker Chambers","tier":1,"lat":18.9251593,"lon":72.8205615,"src":"nominatim"},{"id":"S013","name":"Churchgate","parent":"South Mumbai","landmarks":"Marine Drive, Eros Cinema, Churchgate station","tier":1,"lat":18.9337168,"lon":72.8274613,"src":"nominatim"},{"id":"S014","name":"Malabar Hill","parent":"South Mumbai","landmarks":"Walkeshwar, Banganga, Teen Batti, Ridge Rd","tier":1,"lat":18.9581616,"lon":72.8033665,"src":"nominatim"},{"id":"S015","name":"Altamount Rd","parent":"South Mumbai","landmarks":"Altamount Rd, Carmichael Rd, Pedder Rd, Hughes Rd","tier":1,"lat":18.9730483,"lon":72.8101437,"src":"nominatim"},{"id":"S016","name":"Breach Candy","parent":"South Mumbai","landmarks":"Warden Rd, Mahalaxmi Temple, Amarsons, Bhulabhai Desai Rd","tier":1,"lat":18.9714363,"lon":72.8051492,"src":"nominatim"},{"id":"S017","name":"Dadar West","parent":"Dadar/Central","landmarks":"Ranade Rd, Shivaji Park, Plaza, NC Kelkar Rd","tier":1,"lat":19.0272788,"lon":72.8383977,"src":"nominatim"},{"id":"S018","name":"Prabhadevi","parent":"Dadar/Central","landmarks":"Siddhivinayak, Sayani Rd, Ravindra Natya Mandir","tier":1,"lat":19.0148811,"lon":72.8279556,"src":"nominatim"},{"id":"S019","name":"Worli","parent":"Dadar/Central","landmarks":"Worli Sea Face, Worli Village, Dr. Annie Besant Rd","tier":1,"lat":19.0086197,"lon":72.8146698,"src":"nominatim"},{"id":"S020","name":"Lower Parel","parent":"Dadar/Central","landmarks":"Phoenix Mills, High Street Phoenix, Mathuradas Mill","tier":1,"lat":18.9946688,"lon":72.8243102,"src":"nominatim"},{"id":"S021","name":"Powai","parent":"Powai/Andheri East","landmarks":"Hiranandani, Galleria, JVLR, IIT Main Gate","tier":1,"lat":19.1193993,"lon":72.9116357,"src":"nominatim"},{"id":"S022","name":"Vile Parle West","parent":"Bandra/Khar","landmarks":"Market Rd, Bajaj Rd, Sathaye College, station W","tier":1,"lat":19.0999098,"lon":72.8440038,"src":"nominatim"},{"id":"S023","name":"Mahalaxmi","parent":"South Mumbai","landmarks":"Racecourse, Haji Ali, Saat Rasta, Dr. E Moses Rd","tier":2,"lat":18.9852045,"lon":72.8205984,"src":"nominatim"},{"id":"S024","name":"Tardeo","parent":"South Mumbai","landmarks":"Opera House, Kennedy Bridge, Tardeo Rd","tier":2,"lat":18.9628835,"lon":72.813514,"src":"nominatim"},{"id":"S025","name":"Kalbadevi","parent":"South Mumbai","landmarks":"Zaveri Bazaar, Crawford Market, Bhuleshwar, Abdul Rehman St","tier":2,"lat":18.9492575,"lon":72.8279382,"src":"nominatim"},{"id":"S026","name":"Dadar East","parent":"Dadar/Central","landmarks":"Hindu Colony, Tilak Bridge, station E","tier":2,"lat":19.0199623,"lon":72.8478929,"src":"nominatim"},{"id":"S027","name":"Parel","parent":"Dadar/Central","landmarks":"Lalbaug, Currey Rd, KEM, Parel station","tier":2,"lat":19.0094817,"lon":72.8376614,"src":"nominatim"},{"id":"S028","name":"Matunga","parent":"Dadar/Central","landmarks":"King's Circle, Five Gardens, Matunga station","tier":2,"lat":19.0195374,"lon":72.8537881,"src":"nominatim"},{"id":"S029","name":"Mahim","parent":"Dadar/Central","landmarks":"Mori Rd, Mahim Causeway, Hinduja Hospital","tier":2,"lat":19.0406634,"lon":72.8466038,"src":"nominatim"},{"id":"S030","name":"Santacruz East \u00b7 Kalina","parent":"Bandra/Khar","landmarks":"Kalina, Mumbai University, BKC fringe, CST Rd","tier":2,"lat":19.0734267,"lon":72.854825,"src":"nominatim"},{"id":"S031","name":"DN Nagar","parent":"Andheri West","landmarks":"Azad Nagar, JP Rd, DN Nagar metro, Sports Complex","tier":2,"lat":19.1278285,"lon":72.8308602,"src":"nominatim"},{"id":"S032","name":"Four Bungalows","parent":"Andheri West","landmarks":"Manish Nagar, RTO, Four Bungalows signal","tier":2,"lat":19.1287942,"lon":72.8255543,"src":"nominatim"},{"id":"S033","name":"Versova","parent":"Andheri West","landmarks":"Yari Rd, Versova Village, jetty, beach","tier":2,"lat":19.1300123,"lon":72.8133251,"src":"nominatim"},{"id":"S034","name":"Vile Parle East","parent":"Bandra/Khar","landmarks":"Sahar Rd, Nehru Rd, Parle Tilak, station E","tier":2,"lat":19.1097455,"lon":72.8365427,"src":"nominatim"},{"id":"S035","name":"Chandivali","parent":"Powai/Andheri East","landmarks":"Nahar Amrit Shakti, Chandivali Farm Rd","tier":2,"lat":19.1091482,"lon":72.8945793,"src":"nominatim"},{"id":"S036","name":"Chakala","parent":"Powai/Andheri East","landmarks":"JB Nagar, Andheri-Kurla Rd, WEH, Chakala metro","tier":2,"lat":19.1152873,"lon":72.8618085,"src":"nominatim"},{"id":"S037","name":"Sakinaka","parent":"Powai/Andheri East","landmarks":"90 Feet Rd, Khairani Rd, Sakinaka metro","tier":2,"lat":19.1006236,"lon":72.8805461,"src":"nominatim"},{"id":"S038","name":"Marol","parent":"Powai/Andheri East","landmarks":"Military Rd, Marol Naka, Marol Church","tier":2,"lat":19.1097535,"lon":72.8759757,"src":"nominatim"},{"id":"S039","name":"Andheri East Town","parent":"Powai/Andheri East","landmarks":"Telli Galli, Pump House, Gundavali, station E","tier":2,"lat":19.1205638,"lon":72.8488433,"src":"nominatim"},{"id":"S040","name":"Ghatkopar West","parent":"Ghatkopar/Vikhroli","landmarks":"MG Rd, station W, R City Mall","tier":2,"lat":19.0997411,"lon":72.915661,"src":"nominatim"},{"id":"S041","name":"Ghatkopar East","parent":"Ghatkopar/Vikhroli","landmarks":"Pant Nagar, Vikrant Circle, Tilak Rd","tier":2,"lat":19.0833305,"lon":72.9115042,"src":"nominatim"},{"id":"S042","name":"Malad West \u00b7 Link Rd","parent":"Malad/Borivali","landmarks":"Link Rd, Inorbit, Mindspace","tier":2,"lat":19.1852851,"lon":72.8358611,"src":"nominatim"},{"id":"S043","name":"Orlem \u00b7 Evershine","parent":"Malad/Borivali","landmarks":"Orlem, Evershine Nagar, Mith Chowki","tier":2,"lat":19.1823,"lon":72.8406,"src":"manual-fix"},{"id":"S044","name":"Kandivali West","parent":"Malad/Borivali","landmarks":"MG Rd, station W, Shimpoli","tier":2,"lat":19.2041136,"lon":72.8517376,"src":"nominatim"},{"id":"S045","name":"Thakur Village","parent":"Malad/Borivali","landmarks":"Thakur Village, Thakur Complex, Lokhandwala Township","tier":2,"lat":19.2119479,"lon":72.8694449,"src":"nominatim"},{"id":"S046","name":"Borivali West","parent":"Malad/Borivali","landmarks":"Chandawarkar Ln, station W, IC Colony","tier":2,"lat":19.2298129,"lon":72.8471376,"src":"nominatim"},{"id":"S047","name":"Thane West \u00b7 Naupada","parent":"Thane/Mulund","landmarks":"Naupada, station, Teen Hath Naka","tier":2,"lat":19.1888027,"lon":72.9633143,"src":"nominatim"},{"id":"S048","name":"Ghodbunder Rd","parent":"Thane/Mulund","landmarks":"Ghodbunder Rd, Hypercity, Waghbil","tier":2,"lat":19.2681,"lon":72.9677,"src":"manual-fix"},{"id":"S049","name":"Hiranandani Estate","parent":"Thane/Mulund","landmarks":"Hiranandani Estate, Patlipada","tier":2,"lat":19.2549288,"lon":72.9820704,"src":"nominatim"},{"id":"S050","name":"Majiwada","parent":"Thane/Mulund","landmarks":"Viviana Mall, Jupiter Hospital, Eastern Express Hwy","tier":2,"lat":19.2089,"lon":72.9716,"src":"manual-fix"},{"id":"S051","name":"Mulund West","parent":"Thane/Mulund","landmarks":"MG Rd, R Mall, station W","tier":2,"lat":19.1839747,"lon":72.9515934,"src":"nominatim"},{"id":"S052","name":"Vashi","parent":"Navi Mumbai","landmarks":"Sec 17 market, Inorbit Vashi, Palm Beach Rd","tier":2,"lat":19.0654352,"lon":73.0012477,"src":"nominatim"},{"id":"S053","name":"Nerul","parent":"Navi Mumbai","landmarks":"Sec 21, Seawoods Grand Central, Palm Beach","tier":2,"lat":19.0335938,"lon":73.018164,"src":"nominatim"},{"id":"S054","name":"Seawoods \u00b7 Belapur CBD","parent":"Navi Mumbai","landmarks":"CBD Belapur, Sec 11, Seawoods station","tier":2,"lat":19.0205616,"lon":73.0180886,"src":"nominatim"},{"id":"S055","name":"Kharghar","parent":"Navi Mumbai","landmarks":"Golf Course, Central Park, Sec 12","tier":2,"lat":19.025773,"lon":73.0591845,"src":"nominatim"},{"id":"S056","name":"Chembur West","parent":"Dadar/Central","landmarks":"Station W, Diamond Garden, Chembur Naka","tier":2,"lat":19.0531279,"lon":72.9004824,"src":"nominatim"},{"id":"S057","name":"Kurla West","parent":"Dadar/Central","landmarks":"Station W, LBS Marg, Kamani","tier":2,"lat":19.0652797,"lon":72.8793805,"src":"nominatim"},{"id":"S058","name":"Jogeshwari West","parent":"Andheri West","landmarks":"Oshiwara station, Behram Baug, JVLR","tier":2,"lat":19.135,"lon":72.845,"src":"manual-fix"},{"id":"S059","name":"Goregaon West","parent":"Malad/Borivali","landmarks":"MG Rd, Bangur Nagar, station W, Aarey Rd","tier":2,"lat":19.1648688,"lon":72.8495492,"src":"nominatim"},{"id":"S060","name":"Goregaon East","parent":"Malad/Borivali","landmarks":"Oberoi Mall, Commerz, Nirlon, JVLR","tier":2,"lat":19.1737223,"lon":72.8606297,"src":"nominatim"},{"id":"S061","name":"Chembur East","parent":"Dadar/Central","landmarks":"Sindhi Camp, Trombay Rd, station E","tier":2,"lat":19.0734855,"lon":72.8823214,"src":"nominatim"},{"id":"S062","name":"Airoli","parent":"Navi Mumbai","landmarks":"Sec 19, Mindspace, station, Thane-Belapur Rd","tier":2,"lat":19.161493,"lon":73.0021466,"src":"nominatim"},{"id":"S063","name":"Mumbai Central","parent":"South Mumbai","landmarks":"Agripada, Madanpura, Maratha Mandir, station","tier":3,"lat":18.9695855,"lon":72.8193152,"src":"nominatim"},{"id":"S064","name":"Byculla","parent":"South Mumbai","landmarks":"Mazgaon, Dockyard Rd, Gloria Church, station","tier":3,"lat":18.9764065,"lon":72.8327044,"src":"nominatim"},{"id":"S065","name":"Dongri","parent":"South Mumbai","landmarks":"Bhendi Bazaar, Umerkhadi","tier":3,"lat":18.9579427,"lon":72.8317816,"src":"nominatim"},{"id":"S066","name":"Sion","parent":"Dadar/Central","landmarks":"GTB Nagar, Sion Circle, Sion Hospital","tier":3,"lat":19.0427327,"lon":72.863491,"src":"nominatim"},{"id":"S067","name":"Wadala","parent":"Dadar/Central","landmarks":"Bhakti Park, IMAX, Wadala station","tier":3,"lat":19.0269192,"lon":72.8759337,"src":"nominatim"},{"id":"S068","name":"Kurla East","parent":"Dadar/Central","landmarks":"Nehru Nagar, station E","tier":3,"lat":19.061,"lon":72.881,"src":"nominatim"},{"id":"S069","name":"Govandi","parent":"Dadar/Central","landmarks":"Deonar, Baiganwadi, station","tier":3,"lat":19.0553688,"lon":72.9150702,"src":"nominatim"},{"id":"S070","name":"Tilak Nagar","parent":"Dadar/Central","landmarks":"Tilak Nagar station, Pestom Sagar, Chembur border","tier":3,"lat":19.0657855,"lon":72.8904702,"src":"nominatim"},{"id":"S071","name":"Khar East \u00b7 Vakola","parent":"Bandra/Khar","landmarks":"Khar East, Vakola, Prabhat Colony","tier":3,"lat":19.0833,"lon":72.845,"src":"manual-fix"},{"id":"S072","name":"Jogeshwari East","parent":"Powai/Andheri East","landmarks":"JVLR, Majas, station E, WEH","tier":3,"lat":19.135,"lon":72.867,"src":"manual-fix"},{"id":"S073","name":"MIDC \u00b7 Seepz","parent":"Powai/Andheri East","landmarks":"Seepz Gate, MIDC Central Rd","tier":3,"lat":19.1056,"lon":72.8623,"src":"manual-fix"},{"id":"S074","name":"Kanjurmarg West","parent":"Powai/Andheri East","landmarks":"LBS Marg, IIT boundary, station W","tier":3,"lat":19.1253912,"lon":72.9252519,"src":"nominatim"},{"id":"S075","name":"Vikhroli East","parent":"Ghatkopar/Vikhroli","landmarks":"Kannamwar Nagar, Tagore Nagar, station E","tier":3,"lat":19.1164674,"lon":72.9356821,"src":"nominatim"},{"id":"S076","name":"Vikhroli West","parent":"Ghatkopar/Vikhroli","landmarks":"Godrej, station W, LBS Marg","tier":3,"lat":19.1114795,"lon":72.928021,"src":"nominatim"},{"id":"S077","name":"Bhandup West","parent":"Ghatkopar/Vikhroli","landmarks":"LBS Marg, station W, Dreams Mall","tier":3,"lat":19.145916,"lon":72.9366395,"src":"nominatim"},{"id":"S078","name":"Bhandup East \u00b7 Nahur","parent":"Ghatkopar/Vikhroli","landmarks":"Nahur station, Tank Rd","tier":3,"lat":19.1546144,"lon":72.9467761,"src":"nominatim"},{"id":"S079","name":"Kanjurmarg East","parent":"Ghatkopar/Vikhroli","landmarks":"Station E, LBS Marg","tier":3,"lat":19.124102,"lon":72.9385562,"src":"nominatim"},{"id":"S080","name":"Asalpha \u00b7 Saki Vihar","parent":"Ghatkopar/Vikhroli","landmarks":"Asalpha, Saki Vihar Rd","tier":3,"lat":19.1028484,"lon":72.8862483,"src":"nominatim"},{"id":"S081","name":"Malad East \u00b7 Kurar","parent":"Malad/Borivali","landmarks":"Kurar, Dindoshi, Pathanwadi","tier":3,"lat":19.1867,"lon":72.8611,"src":"manual-fix"},{"id":"S082","name":"Charkop","parent":"Malad/Borivali","landmarks":"Charkop market, Sector 8","tier":3,"lat":19.2141193,"lon":72.8258652,"src":"nominatim"},{"id":"S083","name":"Borivali East","parent":"Malad/Borivali","landmarks":"Station E, SGNP Rd, Kastur Park","tier":3,"lat":19.229068,"lon":72.8573628,"src":"nominatim"},{"id":"S084","name":"Eksar \u00b7 Mandpeshwar","parent":"Malad/Borivali","landmarks":"Eksar, Mandpeshwar, Yogi Nagar","tier":3,"lat":19.2307,"lon":72.8448,"src":"manual-fix"},{"id":"S085","name":"Dahisar West","parent":"Malad/Borivali","landmarks":"Station W, Anand Nagar, SV Rd","tier":3,"lat":19.248875,"lon":72.852959,"src":"nominatim"},{"id":"S086","name":"Dahisar East","parent":"Malad/Borivali","landmarks":"SV Rd, Rawal Pada, station E","tier":3,"lat":19.2493572,"lon":72.8596302,"src":"nominatim"},{"id":"S087","name":"Mira Rd West","parent":"Malad/Borivali","landmarks":"Station W, Silver Park, Shanti Nagar","tier":3,"lat":19.2791,"lon":72.851,"src":"manual-fix"},{"id":"S088","name":"Mira Rd East","parent":"Malad/Borivali","landmarks":"Vinay Nagar, Shanti Park, station E","tier":3,"lat":19.2791,"lon":72.862,"src":"manual-fix"},{"id":"S089","name":"Bhayandar West","parent":"Malad/Borivali","landmarks":"Station W, Jesal Park","tier":3,"lat":19.2952,"lon":72.849,"src":"manual-fix"},{"id":"S090","name":"Bhayandar East","parent":"Malad/Borivali","landmarks":"Goddev, Fatak Rd, station E","tier":3,"lat":19.2952,"lon":72.86,"src":"manual-fix"},{"id":"S091","name":"Wagle Estate","parent":"Thane/Mulund","landmarks":"Wagle Estate, Kopri, Thane East","tier":3,"lat":19.1985175,"lon":72.9509778,"src":"nominatim"},{"id":"S092","name":"Vartak Nagar","parent":"Thane/Mulund","landmarks":"Pokhran Rd, Vartak Nagar","tier":3,"lat":19.2115972,"lon":72.9616225,"src":"nominatim"},{"id":"S093","name":"Kolshet Rd","parent":"Thane/Mulund","landmarks":"Kolshet, Dhokali","tier":3,"lat":19.2290562,"lon":72.9836731,"src":"nominatim"},{"id":"S094","name":"Kasarvadavali","parent":"Thane/Mulund","landmarks":"Ghodbunder far, Kasarvadavali naka","tier":3,"lat":19.2704158,"lon":72.969082,"src":"nominatim"},{"id":"S095","name":"Mulund East","parent":"Thane/Mulund","landmarks":"Station E, Nahur border, LBS Marg","tier":3,"lat":19.1721366,"lon":72.9566971,"src":"nominatim"},{"id":"S096","name":"Koparkhairane","parent":"Navi Mumbai","landmarks":"Sec 11, station, Thane-Belapur Rd","tier":3,"lat":19.1055907,"lon":72.9982312,"src":"nominatim"},{"id":"S097","name":"Ghansoli","parent":"Navi Mumbai","landmarks":"Talavali, station","tier":3,"lat":19.1165736,"lon":73.0050498,"src":"nominatim"},{"id":"S098","name":"Sanpada \u00b7 Juinagar","parent":"Navi Mumbai","landmarks":"Sanpada station, Juinagar, Palm Beach","tier":3,"lat":19.0669987,"lon":73.0092292,"src":"nominatim"},{"id":"S099","name":"Panvel","parent":"Navi Mumbai","landmarks":"Station, Old Panvel, ST stand","tier":3,"lat":18.9986,"lon":73.1114,"src":"manual-fix"},{"id":"S100","name":"Kamothe \u00b7 Kalamboli","parent":"Navi Mumbai","landmarks":"Kamothe, Kalamboli, Sion-Panvel Hwy","tier":3,"lat":19.0164338,"lon":73.0806552,"src":"nominatim"}];
let currentSector = null;
let secmap = null;
let secMarkers = [];
let sectorResearchResults = [];

function sectorById(id){ return SECTORS100.find(function(s){return s.id===id;}); }
function sectorStops(sid){ return db.sectors[sid] || (db.sectors[sid] = []); }

/* ---------------- transport mode (Walk / Two-wheeler / Car) ----------------
   Stored in db.transportMode. Affects OSRM routing profile (walking/driving)
   and Google Maps travelmode (walking/driving — Google has no two-wheeler
   mode, so two-wheelers use driving). */
function transportMode(){ return db.transportMode || "twowheeler"; }
function setTransportMode(m){
  db.transportMode = m; save();
  renderTransportPicker();
  toast(m==="walk" ? "🚶 Walking mode" : m==="car" ? "🚗 Car mode" : "🛵 Two-wheeler mode");
}
function renderTransportPicker(){
  const box = document.getElementById("sec-transport"); if(!box) return;
  const cur = transportMode();
  box.querySelectorAll("[data-tm]").forEach(function(b){
    if(b.getAttribute("data-tm")===cur) b.classList.add("sel");
    else b.classList.remove("sel");
  });
}
function osrmProfile(){ return transportMode()==="walk" ? "walking" : "driving"; }
function gmapsTravelMode(){ return transportMode()==="walk" ? "walking" : "driving"; }

async function loadSectors(){
  try{
    const r = await fetch("./sector-data/sectors.json");
    if(r.ok) SECTORS100 = await r.json();
  }catch(e){}
  // Bulletproof fallback: embedded copy (uploaded root files may miss sector-data/)
  if(!SECTORS100.length && typeof SECTORS_EMBEDDED!=="undefined" && SECTORS_EMBEDDED.length){
    SECTORS100 = SECTORS_EMBEDDED;
  }
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
        (hasPack(s.id)? '<span class="pill" style="border-color:var(--brand);color:var(--brand)">📦 pack ready</span>':"")+
        '<span class="pill">'+list.length+' stops</span>'+
        (done? '<span class="pill">✓ '+done+' done</span>':"")+
        (bought? '<span class="pill green">💰 '+bought+' bought</span>':"")+
      '</div></div>';
  }).join("");
}

function openSector(id, autoLoad){
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
  if(autoLoad) sectorLoadCurated();
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
  renderTransportPicker();
  renderDayPlan();
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
      '<button class="iconbtn" onclick="sectorNavigateStop(\''+p.oid+'\')">🧭</button></div>'+
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
/* Per-stop navigation, respecting the chosen transport mode. */
function sectorNavigateStop(oid){
  const list = sectorStops(currentSector);
  const p = list.find(function(x){return x.oid===oid;});
  if(!p) return;
  window.open("https://www.google.com/maps/dir/?api=1&destination="+p.lat+","+p.lon+
    "&travelmode="+gmapsTravelMode(),"_blank");
}
/* "Take me to the sector": Google Maps transit (train/bus) directions from
   your location to stop 1 of the route, or the sector center if no route
   is built yet. GPS failure falls back to the route's start point. */
async function sectorTakeMeThere(){
  const s = sectorById(currentSector); if(!s) return;
  toast("Getting your location…");
  let origin = null;
  try{
    const p = await getPos(9000);
    origin = p.lat+","+p.lon;
  }catch(e){
    const meta = db.sectorMeta && db.sectorMeta[s.id];
    if(meta && meta.startLat) origin = meta.startLat+","+meta.startLon;
  }
  const ordered = (db.sectors[s.id]||[]).filter(function(p){return p.order;})
    .sort(function(a,b){return a.order-b.order;});
  let destLat, destLon, destLabel, note="";
  if(ordered.length){
    destLat = ordered[0].lat; destLon = ordered[0].lon; destLabel = ordered[0].name;
  } else {
    destLat = s.lat; destLon = s.lon; destLabel = s.name+" center";
    note = " — build your route first for stop-to-stop navigation";
  }
  let url = "https://www.google.com/maps/dir/?api=1";
  if(origin) url += "&origin="+origin;
  url += "&destination="+destLat+","+destLon+"&travelmode=transit";
  toast("Opening train/bus directions to "+destLabel+note);
  window.open(url,"_blank");
}
/* Day-plan header: total distance, stop count, first stop name. */
function renderDayPlan(){
  const s = sectorById(currentSector); if(!s) return;
  const el = document.getElementById("sec-dayplan"); if(!el) return;
  const meta = db.sectorMeta && db.sectorMeta[s.id];
  if(meta && meta.dayStops){
    el.innerHTML = "📋 Day plan: <b>"+meta.dayStops+" stops</b> · <b>"+meta.dayDistKm+
      " km</b> · starts at <b>"+esc(meta.dayFirst||"")+"</b>";
  } else {
    const n = (db.sectors[s.id]||[]).length;
    el.innerHTML = n ? "Build the route to get your day plan 🧭" : "";
  }
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
      style:"https://tiles.openfreemap.org/styles/dark",
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
              "fill-extrusion-color":"#d8a94e",
              "fill-extrusion-height":["interpolate",["linear"],["zoom"],13.5,0,15,["coalesce",["get","render_height"],12]],
              "fill-extrusion-base":["coalesce",["get","render_min_height"],0],
              "fill-extrusion-opacity":0.6
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
async function overpassFetch(ql, onStage){
  const urls = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.private.coffee/api/interpreter"
  ];
  let lastErr = null;
  const tries = urls.length * 2;
  for(let a=0; a<tries; a++){
    const url = urls[a % urls.length];
    if(onStage) onStage(a, url);
    const ctrl = new AbortController();
    const timer = setTimeout(function(){ ctrl.abort(); }, 45000);
    try{
      const r = await fetch(url, {
        method:"POST",
        headers:{ "Content-Type":"application/x-www-form-urlencoded" },
        body:"data="+encodeURIComponent(ql),
        signal: ctrl.signal
      });
      clearTimeout(timer);
      if(r.status===429 || r.status===502 || r.status===504 || r.status===503){
        lastErr = new Error("Map server busy — trying another…");
      } else if(!r.ok){
        lastErr = new Error("Map server error "+r.status+" — trying another…");
      } else {
        return await r.json();
      }
    }catch(e){
      clearTimeout(timer);
      lastErr = (e && e.name==="AbortError")
        ? new Error("Map server timed out (45s) — trying another…")
        : e;
    }
    await new Promise(function(res){ setTimeout(res, 1200); });
  }
  throw lastErr || new Error("Map servers not responding");
}
/* Staged loading box for OSM searches — returns a stage updater. */
function osmLoadingBox(title, sub){
  openModal('<h3>'+title+'</h3><div class="osmbox"><div class="spin">🌀</div>'+
    '<p id="osmstage">Contacting map server…</p>'+
    '<p class="hintline">'+(sub||"Live business data — can take 20–40 seconds on slow networks.")+'</p></div>');
  const stageEl = function(){ return document.getElementById("osmstage"); };
  const slowTimer = setTimeout(function(){
    const el = stageEl();
    if(el) el.textContent = "Still working — big area, hang tight…";
  }, 18000);
  return {
    attempt:function(a){
      const el = stageEl();
      if(el) el.textContent = a===0 ? "Contacting map server…" : "Trying backup map server… (attempt "+(a+1)+")";
    },
    done:function(){ clearTimeout(slowTimer); }
  };
}
/* "Established-looking" heuristic — OSM has no ratings, but a listed phone/website is a decent proxy. */
function hasContact(t){
  return !!(t["phone"]||t["contact:phone"]||t["mobile"]||t["contact:mobile"]||t["website"]||t["contact:website"]||t["url"]);
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
      dist:hav({lat:s.lat,lon:s.lon},{lat:lat,lon:lon}),
      contact:hasContact(e.tags)
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
  const box = osmLoadingBox('🔍 Finding businesses in '+esc(s.name),
    'Scanning <b>live OSM data</b> within ~2 km — restaurants, cafes, salons, clinics, gyms, hotels & shops…<br>'+
    '<b>No review counts</b> — OSM doesn\'t have them. Coverage varies by area.');
  try{
    let results = collectSectorProspects(s, await overpassFetch(sectorOverpassQL(s), function(a){ box.attempt(a); }));
    let radiusNote = "~2 km";
    if(results.length < 20){
      // thin coverage — auto-retry once with a wider radius, then merge
      const el = document.getElementById("osmstage");
      if(el) el.textContent = "Few spots nearby — auto-widening to ~3.5 km…";
      try{
        const d2 = await overpassFetch(sectorOverpassQL(s, 3500), function(a){ box.attempt(a); });
        results = mergeProspects(results, collectSectorProspects(s, d2));
        radiusNote = "few spots nearby — auto-widened to ~3.5 km";
      }catch(e2){ /* keep first-pass results */ }
    }
    box.done();
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
    box.done();
    openModal('<h3>Search failed</h3>'+
      '<p class="hintline">'+esc(String((e&&e.message)||e))+'<br>Overpass (the OSM server) can be slow or rate-limited. Check your connection and retry.</p>'+
      '<div class="btnrow"><button class="btn" onclick="closeModal()">Close</button>'+
      '<button class="btn ghost" onclick="sectorResearch()">↻ Retry</button></div>');
  }
}
/* Manual "widen search" — re-run discovery at 5 km and merge anything new. */
async function sectorWidenSearch(){
  const s = sectorById(currentSector); if(!s) return;
  const box = osmLoadingBox('🌐 Widening search…',
    'Pulling live OSM data within ~5 km of '+esc(s.name)+'. Bigger area = slower.');
  try{
    const fresh = collectSectorProspects(s, await overpassFetch(sectorOverpassQL(s, 5000), function(a){ box.attempt(a); }));
    box.done();
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
    box.done();
    openModal('<h3>Widen failed</h3>'+
      '<p class="hintline">'+esc(String((e&&e.message)||e))+'<br>Overpass can be slow or rate-limited. Retry in a bit.</p>'+
      '<div class="btnrow"><button class="btn" onclick="closeModal()">Close</button>'+
      '<button class="btn ghost" onclick="sectorWidenSearch()">↻ Retry</button></div>');
  }
}
function showSectorResearchModal(s, radiusNote){
  const rows = sectorResearchResults.map(function(c,i){
    return '<label class="resrow" data-contact="'+(c.contact?"1":"0")+'"><input type="checkbox" data-i="'+i+'" checked>'+
      '<span class="grow"><b>'+esc(c.name)+'</b>'+(c.contact?' <span title="Phone/website listed">📞</span>':"")+'<br>'+
      '<span class="sub2">'+esc(c.cat)+(c.addr?" · "+esc(c.addr):"")+' · '+c.dist.toFixed(1)+' km</span></span></label>';
  }).join("");
  const nContact = sectorResearchResults.filter(function(c){return c.contact;}).length;
  openModal(
    '<h3>'+sectorResearchResults.length+' found in '+esc(s.name)+'</h3>'+
    '<p class="sub2" style="margin:-6px 0 8px">live OSM data · '+(radiusNote||"~2 km")+'</p>'+
    '<p class="hintline">Live OSM data — no review counts, coverage varies. Tick the good ones worth pitching (aim 50–70).</p>'+
    '<label class="filterrow"><input type="checkbox" id="flt-contact" onchange="filterResearchRows()">'+
    '<span>📞 <b>Established only</b> — phone/website listed ('+nContact+')</span></label>'+
    '<div class="btnrow" style="margin-bottom:8px">'+
      '<button class="btn ghost small" onclick="sectorCheckAll(true)">Select all</button>'+
      '<button class="btn ghost small" onclick="sectorCheckAll(false)">Clear</button>'+
      '<button class="btn ghost small" onclick="sectorWidenSearch()">🌐 Widen (5 km)</button></div>'+
    '<div style="max-height:46vh;overflow-y:auto">'+rows+'</div>'+
    '<div class="btnrow"><button class="btn" id="secres-add" onclick="sectorAddResearch()">Add selected</button></div>'
  );
  sectorUpdateResCount();
  document.querySelectorAll('#modal .resrow input[type=checkbox]').forEach(function(cb){
    cb.addEventListener("change", sectorUpdateResCount);
  });
}
function filterResearchRows(){
  const on = document.getElementById("flt-contact").checked;
  document.querySelectorAll('#modal .resrow').forEach(function(row){
    row.style.display = (on && row.dataset.contact!=="1") ? "none" : "";
  });
  sectorUpdateResCount();
}
function sectorCheckAll(v){
  document.querySelectorAll('#modal .resrow input[type=checkbox]').forEach(function(cb){ cb.checked=v; });
  sectorUpdateResCount();
}
function sectorUpdateResCount(){
  const n = document.querySelectorAll('#modal .resrow input[type=checkbox]:checked').length;
  const b = document.getElementById("secres-add");
  if(b) b.textContent = "Add selected ("+n+")";
}
function sectorAddResearch(){
  const s = sectorById(currentSector); if(!s) return;
  const list = sectorStops(s.id);
  let added = 0;
  document.querySelectorAll('#modal .resrow input[type=checkbox]:checked').forEach(function(cb){
    const c = sectorResearchResults[parseInt(cb.dataset.i,10)];
    if(c && !list.some(function(p){return p.oid===c.oid;})){
      list.push({ oid:c.oid, name:c.name, cat:c.cat, lat:c.lat, lon:c.lon,
                  addr:c.addr, status:"new", note:"", order:null, contact:!!c.contact });
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
/* ---------------- sector packs (V4) ----------------
   Priority: embedded SECTOR_PACKS (packs.js, instant) → pasted db.packs
   (localStorage) → ./sector-data/<ID>-curated.json file → S001 fallback.
   Packs may be a plain array or {sector, stops:[...]}; stops may use
   compact keys {n,c,r,v,a,lat,lon} or full keys {name,cat,rating,...}. */
function normalizePackStops(raw){
  if(!raw) return [];
  const items = Array.isArray(raw) ? raw : (raw.stops || []);
  return items.map(function(it){
    if(!it) return null;
    const name = it.name || it.n;
    if(!name) return null;
    const lat = parseFloat(it.lat), lon = parseFloat(it.lon);
    if(!(lat && lon)) return null;
    return {
      oid:"cur-"+String(name).toLowerCase().trim().replace(/[^a-z0-9]+/g,"-").slice(0,40),
      name:name, cat:it.cat||it.c||it.category||"Business",
      addr:it.addr||it.a||it.area||it.address||"",
      lat:lat, lon:lon,
      rating:it.rating||it.r||null, reviews:it.reviews||it.v||null,
      curated:true
    };
  }).filter(Boolean);
}
function hasPack(id){
  if(typeof SECTOR_PACKS !== "undefined" && SECTOR_PACKS && SECTOR_PACKS[id] &&
     normalizePackStops(SECTOR_PACKS[id]).length) return true;
  if(db.packs && db.packs[id] && normalizePackStops(db.packs[id]).length) return true;
  return false;
}
/* Paste today's pack (from chat) into this sector — 10 seconds, no upload. */
function sectorPastePack(){
  const s = sectorById(currentSector); if(!s) return;
  openModal('<h3>📦 Paste today\'s pack</h3>'+
    '<p class="hintline">Paste the pack block for <b>'+esc(s.id)+' · '+esc(s.name)+'</b> (copied from chat). It saves on this phone — instant, offline.</p>'+
    '<textarea id="pack-paste" class="notein" rows="6" placeholder=\'{"sector":"'+s.id+'","stops":[...]}\' style="font-family:monospace;font-size:11px"></textarea>'+
    '<div class="btnrow"><button class="btn" onclick="sectorSavePack()">Save pack</button>'+
    '<button class="btn ghost" onclick="closeModal()">Cancel</button></div>');
  setTimeout(function(){ const t=document.getElementById("pack-paste"); if(t) t.focus(); }, 100);
}
function sectorSavePack(){
  const s = sectorById(currentSector); if(!s) return;
  const raw = (document.getElementById("pack-paste").value||"").trim();
  if(!raw){ toast("Paste the pack first"); return; }
  let parsed = null;
  try{ parsed = JSON.parse(raw); }
  catch(e){ toast("That doesn't look like a pack — copy the full block"); return; }
  const v = validatePack(parsed);
  if(!v.ok){ toast(v.error); return; }
  if(v.sector !== s.id){ toast("This pack is for "+v.sector+" — open that sector to save it"); return; }
  db.packs = db.packs || {};
  parsed._savedAt = Date.now();
  db.packs[s.id] = parsed;
  sectorCuratedCache[s.id] = undefined; /* drop stale cache so the new pack loads now */
  save(); closeModal();
  renderSectorDetail(); sectorCuratedProbe(); renderPacks();
  toast("📦 Pack saved — "+v.stops.length+" businesses ready");
}
/* Shared pack validation: shape, sector id, size, Mumbai coordinate bounds. */
function validatePack(parsed){
  if(!parsed || typeof parsed!=="object" || Array.isArray(parsed))
    return {ok:false, error:"That doesn't look like a pack"};
  const sector = String(parsed.sector||"").toUpperCase().trim();
  if(!/^S\d{3}$/.test(sector)) return {ok:false, error:"Pack is missing a valid sector id (e.g. S042)"};
  if(!sectorById(sector)) return {ok:false, error:"Unknown sector "+sector};
  const stops = normalizePackStops(parsed);
  if(!stops.length) return {ok:false, error:"No valid businesses in that pack"};
  if(stops.length > 150) return {ok:false, error:"Pack too big ("+stops.length+" — max 150)"};
  for(const p of stops){
    if(typeof p.lat!=="number" || typeof p.lon!=="number" ||
       p.lat < 18.5 || p.lat > 19.6 || p.lon < 72.5 || p.lon > 73.3)
      return {ok:false, error:"A stop has coordinates outside Mumbai — wrong pack?"};
  }
  return {ok:true, sector:sector, stops:stops};
}
/* ---------------- packs tab ---------------- */
function renderPacks(){
  const box = document.getElementById("pack-list"); if(!box) return;
  const ids = Object.keys(db.packs||{});
  if(!ids.length){
    box.innerHTML = '<div class="empty">No packs yet. Ask Muse for today\'s area — e.g. "S042" or "Malad West" — and paste the pack above.</div>';
    return;
  }
  box.innerHTML = ids.map(function(id){
    const s = sectorById(id);
    const stops = normalizePackStops(db.packs[id]);
    const sv = db.packs[id] && db.packs[id]._savedAt;
    const when = sv ? new Date(sv).toLocaleDateString("en-IN",{day:"numeric",month:"short"}) : "";
    return '<div class="card"><div class="row"><div class="grow">'+
      '<div class="name">📦 '+esc(id)+(s? " · "+esc(s.name):"")+'</div>'+
      '<div class="sub2">'+stops.length+' businesses'+(when? " · saved "+when:"")+'</div></div></div>'+
      '<div class="btnrow"><button class="btn" onclick="packOpen(\''+id+'\')">▶ Open route</button>'+
      '<button class="btn ghost" onclick="packDelete(\''+id+'\')">🗑</button></div></div>';
  }).join("");
}
function packSaveFromTab(){
  const raw = (document.getElementById("pack-tab-paste").value||"").trim();
  if(!raw){ toast("Paste the pack first"); return; }
  let parsed = null;
  try{ parsed = JSON.parse(raw); }
  catch(e){ toast("That doesn't look like a pack — copy the full block"); return; }
  const v = validatePack(parsed);
  if(!v.ok){ toast(v.error); return; }
  db.packs = db.packs || {};
  parsed._savedAt = Date.now();
  db.packs[v.sector] = parsed;
  sectorCuratedCache[v.sector] = undefined;
  save();
  document.getElementById("pack-tab-paste").value = "";
  renderPacks(); renderSectors();
  toast("📦 Pack saved — "+v.sector+" · "+v.stops.length+" businesses");
}
function packOpen(id){
  if(!sectorById(id)){ toast("Unknown sector"); return; }
  switchTab("sectors");
  openSector(id, true);
}
function packDelete(id){
  if(!confirm("Delete the "+id+" pack?")) return;
  delete db.packs[id];
  sectorCuratedCache[id] = undefined;
  save(); renderPacks(); renderSectors();
  toast("Pack deleted");
}
let sectorCuratedCache = {};
async function sectorCuratedData(s){
  if(sectorCuratedCache[s.id] !== undefined) return sectorCuratedCache[s.id];
  let raw = null;
  // 1) pasted pack (this phone) — fresh daily research wins over embedded
  if(db.packs && db.packs[s.id]) raw = db.packs[s.id];
  // 2) embedded packs.js (instant, offline)
  if(!raw && typeof SECTOR_PACKS !== "undefined" && SECTOR_PACKS && SECTOR_PACKS[s.id]){
    raw = SECTOR_PACKS[s.id];
  }
  // 3) file fallback
  if(!raw){
    const urls = ["./sector-data/"+s.id+"-curated.json"];
    if(s.id==="S001") urls.push("./sector-data/S001-bandra-west.json");
    for(let u=0; u<urls.length; u++){
      try{
        const r = await fetch(urls[u]);
        if(r.ok){ raw = await r.json(); break; }
      }catch(e){}
    }
  }
  // 4) bulletproof fallback: embedded S001 copy
  if(!raw && s.id==="S001" && typeof S001_EMBEDDED!=="undefined" && S001_EMBEDDED){
    raw = S001_EMBEDDED;
  }
  const arr = normalizePackStops(raw);
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
  const matrix = pts.length<=100 ? await osrmTable(start, pts, osrmProfile()) : null;
  const order = routeOrder(matrix, start, pts);
  order.forEach(function(pi,i){ list[pi].order = i+1; });
  list.sort(function(a,b){return (a.order||9999)-(b.order||9999);});
  // total day distance along the ordered route (OSRM meters, else haversine)
  let totalM = 0, prev = 0;
  order.forEach(function(pi){
    const mi = pi+1;
    let d;
    if(matrix && matrix[prev] && matrix[prev][mi]!=null) d = matrix[prev][mi];
    else d = hav(prev===0?start:pts[prev-1], pts[pi])*1000;
    totalM += d; prev = mi;
  });
  db.sectorMeta = db.sectorMeta||{};
  db.sectorMeta[s.id] = { startLat:start.lat, startLon:start.lon,
    dayDistKm: Math.round(totalM/100)/10, dayStops: list.length,
    dayFirst: list[0] ? list[0].name : "" };
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
  let url = "https://www.google.com/maps/dir/?api=1&origin="+origin+"&destination="+dest+"&travelmode="+gmapsTravelMode();
  if(wp) url += "&waypoints="+encodeURIComponent(wp);
  window.open(url,"_blank");
}

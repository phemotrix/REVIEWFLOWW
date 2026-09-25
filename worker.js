/* Reviewwflow Cloudflare Worker — V4 hardened
   Public endpoints:
     GET  /config?biz=<slug>        → business config (public, needed by tap page)
     POST /generate-review          → local-template review + optional Groq polish
   Admin endpoints (X-Admin-Key required):
     POST /admin/save               → publish business config
     POST /admin/get                → fetch business config
     GET  /admin/list               → list businesses
   No debug endpoints. No stack traces. Rate limited per IP. */

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

/* ---------------- security: rate limiting (in-memory sliding window) ---- */
const RL = new Map(); // key -> array of request timestamps (ms)
function rateLimited(key, max, windowMs){
  const now = Date.now();
  let arr = RL.get(key) || [];
  arr = arr.filter(function(t){ return now - t < windowMs; });
  if(arr.length >= max){ RL.set(key, arr); return true; }
  arr.push(now);
  RL.set(key, arr);
  if(RL.size > 4000){ RL.delete(RL.keys().next().value); } // opportunistic cleanup
  return false;
}
function clientIp(req){
  return req.headers.get("CF-Connecting-IP") ||
         (req.headers.get("X-Forwarded-For")||"").split(",")[0].trim() ||
         "unknown";
}
// Limits: config 90/min, generate-review 10/10min, admin 30/min per IP
const LIMITS = {
  config:   { max: 90, windowMs: 60 * 1000 },
  generate: { max: 10, windowMs: 10 * 60 * 1000 },
  admin:    { max: 30, windowMs: 60 * 1000 }
};

/* ---------------- security: input validation ---------------------------- */
const BIZ_RE = /^[a-z0-9][a-z0-9-]{1,39}$/;
function validBiz(b){ return typeof b === "string" && BIZ_RE.test(b); }
function validGenerateBody(b){
  if(!b || typeof b !== "object" || Array.isArray(b)) return false;
  if(typeof b.business_name !== "string" || !b.business_name.trim() ||
     b.business_name.length > 80) return false;
  if(b.business_category !== undefined &&
     (typeof b.business_category !== "string" || b.business_category.length > 40)) return false;
  if(b.answers !== undefined){
    if(!b.answers || typeof b.answers !== "object" || Array.isArray(b.answers)) return false;
    const keys = Object.keys(b.answers);
    if(keys.length > 12) return false;
    for(const k of keys){
      const v = b.answers[k];
      if(typeof v !== "string" || v.length > 500) return false;
    }
  }
  if(b.questions !== undefined){
    if(!Array.isArray(b.questions) || b.questions.length > 15) return false;
    for(const q of b.questions){
      if(typeof q !== "string" || q.length > 200) return false;
    }
  }
  return true;
}

/* ---------------- security: timing-safe secret compare ------------------ */
function safeEqual(a, b){
  a = String(a || ""); b = String(b || "");
  if(a.length !== b.length) return false;
  let d = 0;
  for(let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

/* ---------------- response helpers -------------------------------------- */
function json(data, status){
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "X-Content-Type-Options": "nosniff"
    }
  });
}
function tooMany(){ return json({ ok:false, error:"Too many requests — slow down." }, 429); }

function corsPreflight(){
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-Admin-Key",
      "Access-Control-Max-Age": "86400"
    }
  });
}

/* ---------------- local review template (offline-safe core) -------------- */
function localReview(d){
  const name = (d.business_name || "this place").trim();
  const cat = (d.business_category || "").trim();
  const a = d.answers || {};
  const pick = function(){
    const vals = [];
    for(const k in a){ if(a[k] && String(a[k]).trim()) vals.push(String(a[k]).trim()); }
    return vals;
  };
  const bits = pick();
  const catBit = cat ? (" " + cat.toLowerCase()) : "";
  let text = "Had a great experience at " + name + ".";
  if(bits.length){
    text += " " + bits.slice(0, 4).join(" ");
  } else {
    text += " Good service, clean" + catBit + ", and a genuinely pleasant visit overall.";
  }
  text += " Staff were courteous and everything felt well managed.";
  text += " Would happily recommend" + (cat ? " this " + cat.toLowerCase() : " it") + " to anyone nearby.";
  return text;
}

/* ---------------- Groq polish (best-effort, bounded) ---------------------- */
async function groqPolish(env, draft, d){
  if(!env.GROQ_API_KEY) return draft;
  const ctrl = new AbortController();
  const timer = setTimeout(function(){ ctrl.abort(); }, 12000);
  try{
    const r = await fetch(GROQ_URL, {
      method: "POST",
      signal: ctrl.signal,
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + env.GROQ_API_KEY
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        temperature: 0.7,
        max_tokens: 220,
        messages: [
          { role: "system",
            content: "Rewrite the draft as a natural, human Google review (40-90 words). " +
                     "First person, specific, warm, no emojis, no hashtags, no fake claims. " +
                     "Return ONLY the review text." },
          { role: "user",
            content: "Business: " + (d.business_name||"") +
                     (d.business_category ? " (" + d.business_category + ")" : "") +
                     "\nDraft: " + draft }
        ]
      })
    });
    clearTimeout(timer);
    if(!r.ok) return draft;
    const j = await r.json();
    const out = j && j.choices && j.choices[0] && j.choices[0].message &&
                j.choices[0].message.content;
    return (out && out.trim()) ? out.trim().slice(0, 1200) : draft;
  }catch(e){
    clearTimeout(timer);
    return draft;
  }
}

/* ---------------- main ---------------------------------------------------- */
export default {
  async fetch(req, env){
    const url = new URL(req.url);
    const path = url.pathname;
    const ip = clientIp(req);

    if(req.method === "OPTIONS") return corsPreflight();

    /* ---- public: business config ----
       Returns the stored config FLAT (top level), exactly as the admin app
       saved it — tap.html reads config.questions / config.name directly. */
    if(path === "/config" && req.method === "GET"){
      if(rateLimited("cfg:" + ip, LIMITS.config.max, LIMITS.config.windowMs)) return tooMany();
      const biz = url.searchParams.get("biz") || "";
      if(!validBiz(biz)) return json({ ok:false, error:"Unknown business." }, 404);
      try{
        const cfg = await env.BUSINESS_CONFIGS.get("biz:" + biz, "json");
        if(!cfg) return json({ ok:false, error:"Unknown business." }, 404);
        return json(cfg);
      }catch(e){
        return json({ ok:false, error:"Temporarily unavailable." }, 503);
      }
    }

    /* ---- public: review generation ---- */
    if(path === "/generate-review" && req.method === "POST"){
      if(rateLimited("gen:" + ip, LIMITS.generate.max, LIMITS.generate.windowMs)) return tooMany();
      let body = null;
      try{ body = await req.json(); }catch(e){ return json({ ok:false, error:"Bad request." }, 400); }
      if(!validGenerateBody(body)) return json({ ok:false, error:"Bad request." }, 400);
      const draft = localReview(body);
      const polished = await groqPolish(env, draft, body);
      return json({ ok:true, review: polished, polished: polished !== draft });
    }

    /* ---- admin: auth gate ---- */
    const isAdmin = path === "/admin/save" || path === "/admin/get" || path === "/admin/list";
    if(isAdmin){
      if(rateLimited("adm:" + ip, LIMITS.admin.max, LIMITS.admin.windowMs)) return tooMany();
      const key = req.headers.get("X-Admin-Key") || "";
      if(!env.ADMIN_PASSWORD || !safeEqual(key, env.ADMIN_PASSWORD)){
        return json({ ok:false, error:"Unauthorized." }, 401);
      }
    }

    if(path === "/admin/save" && req.method === "POST"){
      let body = null;
      try{ body = await req.json(); }catch(e){ return json({ ok:false, error:"Bad request." }, 400); }
      const biz = body && (body.biz || body.id); /* admin app sends { id, config } */
      const cfg = body && body.config;
      if(!validBiz(biz) || !cfg || typeof cfg !== "object"){
        return json({ ok:false, error:"Bad request." }, 400);
      }
      /* Preserve the fields the admin app + tap page actually use. */
      const clean = {
        name: String(cfg.name || cfg.business_name || "").slice(0, 80),
        color: String(cfg.color || "#d8a94e").slice(0, 20),
        welcome: String(cfg.welcome || "").slice(0, 300),
        google_link: String(cfg.google_link || cfg.google_review_url || "").slice(0, 500),
        questions: Array.isArray(cfg.questions)
          ? cfg.questions.filter(function(q){ return typeof q === "string"; })
              .map(function(q){ return q.slice(0, 200); }).slice(0, 15)
          : []
      };
      if(!clean.name.trim()) return json({ ok:false, error:"Bad request." }, 400);
      try{
        await env.BUSINESS_CONFIGS.put("biz:" + biz, JSON.stringify(clean));
        return json({ ok:true });
      }catch(e){
        return json({ ok:false, error:"Temporarily unavailable." }, 503);
      }
    }

    if(path === "/admin/get" && req.method === "POST"){
      let body = null;
      try{ body = await req.json(); }catch(e){ return json({ ok:false, error:"Bad request." }, 400); }
      const biz = body && (body.biz || body.id);
      if(!validBiz(biz)) return json({ ok:false, error:"Bad request." }, 400);
      try{
        const cfg = await env.BUSINESS_CONFIGS.get("biz:" + biz, "json");
        return json({ ok:true, config: cfg || null });
      }catch(e){
        return json({ ok:false, error:"Temporarily unavailable." }, 503);
      }
    }

    if(path === "/admin/list" && req.method === "GET"){
      try{
        const listed = await env.BUSINESS_CONFIGS.list({ prefix: "biz:" });
        return json({ ok:true,
          businesses: (listed.keys || []).map(function(k){ return k.name.slice(4); }) });
      }catch(e){
        return json({ ok:false, error:"Temporarily unavailable." }, 503);
      }
    }

    return json({ ok:false, error:"Not found." }, 404);
  }
};

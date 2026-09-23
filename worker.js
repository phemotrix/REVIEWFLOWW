// ============================================================
// NFC REVIEW TOOL — Cloudflare Worker backend
// Deploy: paste this entire file into a new Cloudflare Worker,
// bind a KV namespace called BUSINESS_CONFIGS, and set the
// secrets GROQ_API_KEY and ADMIN_PASSWORD.
// ============================================================

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.1-8b-instant"; // fast + free tier

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Admin-Key",
};

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: Object.assign({ "Content-Type": "application/json" }, cors),
  });
}

function buildPrompt(businessName, questions, answers) {
  const qmap = {};
  questions.forEach(function (q) { qmap[q.id] = q; });
  const lines = Object.keys(answers)
    .map(function (id) {
      const q = qmap[id];
      if (!q) return null;
      const a = answers[id];
      let val = a;
      if (q.type === "rating") val = a + " out of 5";
      else if (Array.isArray(a)) val = a.join(", ");
      return '- "' + q.text + '" → ' + val;
    })
    .filter(Boolean)
    .join("\n");

  return (
    'Write a short, natural Google review in first person for a customer of "' +
    businessName +
    '".\n\nWhat the customer told us:\n' +
    lines +
    "\n\nRules:\n" +
    "- 2 to 4 sentences, casual and genuine, like a real person wrote it on their phone.\n" +
    "- Mention the business name once, naturally.\n" +
    "- Base it ONLY on the answers above. Do not invent details that are not there.\n" +
    "- Vary your wording; never repeat the same phrasing twice.\n" +
    "- No emojis, no hashtags, no quotation marks around the review.\n" +
    "- Output ONLY the review text, nothing else."
  );
}

async function callGroq(env, prompt) {
  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + env.GROQ_API_KEY,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      temperature: 0.9,
      max_tokens: 220,
      messages: [
        {
          role: "system",
          content: "You write short, genuine customer reviews. Output only the review text.",
        },
        { role: "user", content: prompt },
      ],
    }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  const text =
    data && data.choices && data.choices[0] && data.choices[0].message
      ? (data.choices[0].message.content || "").trim()
      : "";
  return text || null;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: cors });
    }

    // ---- GET /config?biz={id} : public, used by the frontend ----
    if (url.pathname === "/config" && request.method === "GET") {
      const biz = url.searchParams.get("biz");
      if (!biz) return json({ error: "missing biz" }, 400);
      const cfg = await env.BUSINESS_CONFIGS.get(biz, "json");
      if (!cfg) return json({ error: "business not found" }, 404);
      return json(cfg);
    }

    // ---- POST /generate-review : AI draft, with graceful fallback ----
    if (url.pathname === "/generate-review" && request.method === "POST") {
      let body;
      try {
        body = await request.json();
      } catch (e) {
        return json({ error: "bad json" }, 400);
      }
      const business_name = body.business_name;
      const questions = body.questions;
      const answers = body.answers;
      if (!business_name || !questions || !answers) {
        return json({ error: "missing fields" }, 400);
      }
      try {
        const review = await callGroq(
          env,
          buildPrompt(business_name, questions, answers)
        );
        if (review) return json({ review: review });
      } catch (e) {
        // fall through to fallback flag
      }
      return json({ use_fallback: true });
    }

    // ---- admin auth ----
    const adminKey = request.headers.get("X-Admin-Key");
    const authed =
      adminKey && env.ADMIN_PASSWORD && adminKey === env.ADMIN_PASSWORD;

    // ---- POST /admin/save : create / update a business ----
    if (url.pathname === "/admin/save" && request.method === "POST") {
      if (!authed) return json({ error: "unauthorized" }, 401);
      let body;
      try {
        body = await request.json();
      } catch (e) {
        return json({ error: "bad json" }, 400);
      }
      const id = body.id;
      const config = body.config;
      if (!id || !/^[a-z0-9-]{2,40}$/.test(id)) {
        return json(
          { error: "bad id — use lowercase letters, numbers, dashes" },
          400
        );
      }
      if (!config || !config.name) {
        return json({ error: "config.name is required" }, 400);
      }
      await env.BUSINESS_CONFIGS.put(id, JSON.stringify(config));
      return json({ ok: true, id: id });
    }

    // ---- GET /admin/list : list all businesses ----
    if (url.pathname === "/admin/list" && request.method === "GET") {
      if (!authed) return json({ error: "unauthorized" }, 401);
      const list = await env.BUSINESS_CONFIGS.list();
      const items = [];
      for (const k of list.keys) {
        const cfg = await env.BUSINESS_CONFIGS.get(k.name, "json");
        items.push({ id: k.name, name: (cfg && cfg.name) || k.name });
      }
      return json({ businesses: items });
    }

    // ---- POST /admin/delete : remove a business ----
    if (url.pathname === "/admin/delete" && request.method === "POST") {
      if (!authed) return json({ error: "unauthorized" }, 401);
      let body;
      try {
        body = await request.json();
      } catch (e) {
        return json({ error: "bad json" }, 400);
      }
      if (!body.id) return json({ error: "missing id" }, 400);
      await env.BUSINESS_CONFIGS.delete(body.id);
      return json({ ok: true });
    }

    return json({ error: "not found" }, 404);
  },
};

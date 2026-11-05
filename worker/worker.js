/* Up Next's Claude helper, a Cloudflare Worker. Up Next sends a prompt with Joey's Firebase sign-in token; the Worker
   checks the token really is Joey's, asks Claude, and sends back the JSON Claude wrote. The Anthropic key lives only
   in Cloudflare (a secret named ANTHROPIC_API_KEY) and never reaches the page.

   Settings in Cloudflare (Worker → Settings → Variables and Secrets):
     ANTHROPIC_API_KEY   secret   from console.anthropic.com → API Keys
     FIREBASE_PROJECT_ID text     the Firebase project id, e.g. up-next-1a2b3
     ALLOWED_UID         text     your user ID, from Up Next → Your data → Copy user ID
     ALLOWED_ORIGIN      text     https://josephprestley.github.io
     MODEL               text     optional; default claude-sonnet-5-5 */

const JWKS_URL = "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";
let jwksCache = { keys: null, until: 0 };

export default {
  async fetch(req, env) {
    const allowed = env.ALLOWED_ORIGIN || "https://josephprestley.github.io";
    const origin = req.headers.get("Origin") || "";
    const cors = { "Access-Control-Allow-Origin": allowed, "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Authorization, Content-Type", "Access-Control-Max-Age": "86400", Vary: "Origin" };
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (req.method !== "POST" || origin !== allowed) return reply({ error: "forbidden" }, 403, cors);
    if (!env.ANTHROPIC_API_KEY || !env.FIREBASE_PROJECT_ID || !env.ALLOWED_UID) return reply({ error: "not_set_up" }, 500, cors);

    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    let claims = null;
    try { claims = await verifyFirebaseToken(token, env.FIREBASE_PROJECT_ID); } catch (e) { claims = null; }
    if (!claims || claims.sub !== env.ALLOWED_UID) return reply({ error: "unauthorized" }, 401, cors);

    const body = await req.json().catch(() => null);
    const prompt = body && typeof body.prompt === "string" ? body.prompt.slice(0, 8000) : "";
    if (!prompt) return reply({ error: "bad_request" }, 400, cors);

    let r;
    try {
      r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({ model: env.MODEL || "claude-sonnet-5-5", max_tokens: 1500, messages: [{ role: "user", content: prompt + "\n\nReply with only the JSON, no other text." }] }),
      });
    } catch (e) { return reply({ error: "upstream" }, 502, cors); }
    if (r.status === 429 || r.status === 529) return reply({ error: "rate_limited" }, 429, cors);
    if (!r.ok) return reply({ error: "upstream", status: r.status }, 502, cors);
    const m = await r.json().catch(() => null);
    const text = ((m && m.content) || []).filter((b) => b.type === "text").map((b) => b.text).join("");
    const json = firstJson(text);
    if (json === undefined) return reply({ error: "not_json" }, 502, cors);
    return reply({ json }, 200, cors);
  },
};

function reply(obj, status, headers) {
  return new Response(JSON.stringify(obj), { status, headers: Object.assign({ "content-type": "application/json" }, headers) });
}

// the first JSON object or array in Claude's text (it sometimes wraps it in a code fence)
export function firstJson(text) {
  const t = String(text || "").replace(/```(?:json)?/gi, "");
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (c !== "{" && c !== "[") continue;
    let depth = 0, inStr = false, esc = false;
    for (let j = i; j < t.length; j++) {
      const d = t[j];
      if (inStr) { if (esc) esc = false; else if (d === "\\") esc = true; else if (d === '"') inStr = false; continue; }
      if (d === '"') inStr = true;
      else if (d === "{" || d === "[") depth++;
      else if (d === "}" || d === "]") { depth--; if (depth === 0) { try { return JSON.parse(t.slice(i, j + 1)); } catch (e) { break; } } }
    }
  }
  return undefined;
}

// a Firebase ID token: signed by Google (RS256, key from the published set), for this project, not expired
const b64url = (s) => { s = s.replace(/-/g, "+").replace(/_/g, "/"); while (s.length % 4) s += "="; return Uint8Array.from(atob(s), (c) => c.charCodeAt(0)); };
const jsonPart = (s) => JSON.parse(new TextDecoder().decode(b64url(s)));
export async function verifyFirebaseToken(token, projectId, opts = {}) {
  const parts = String(token || "").split(".");
  if (parts.length !== 3) throw new Error("malformed");
  const header = jsonPart(parts[0]), payload = jsonPart(parts[1]);
  if (header.alg !== "RS256" || !header.kid) throw new Error("alg");
  const keys = opts.keys || (await googleKeys());
  const jwk = keys.find((k) => k.kid === header.kid);
  if (!jwk) throw new Error("kid");
  const key = await crypto.subtle.importKey("jwk", { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: "RS256", ext: true }, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, b64url(parts[2]), new TextEncoder().encode(parts[0] + "." + parts[1]));
  if (!ok) throw new Error("signature");
  const now = Math.floor((opts.now || Date.now()) / 1000);
  if (payload.aud !== projectId || payload.iss !== "https://securetoken.google.com/" + projectId) throw new Error("audience");
  if (!(payload.exp > now) || payload.iat > now + 300 || !payload.sub) throw new Error("expired");
  return payload;
}
async function googleKeys() {
  if (jwksCache.keys && Date.now() < jwksCache.until) return jwksCache.keys;
  const r = await fetch(JWKS_URL);
  const j = await r.json();
  const m = /max-age=(\d+)/.exec(r.headers.get("cache-control") || "");
  jwksCache = { keys: j.keys || [], until: Date.now() + (m ? +m[1] * 1000 : 3600000) };
  return jwksCache.keys;
}

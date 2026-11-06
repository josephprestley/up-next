/* Up Next's helper, a Cloudflare Worker. Two jobs, both only for Joey's own signed-in requests:
   1. Claude: Up Next sends a prompt with Joey's Firebase sign-in token; the Worker checks the token really is Joey's,
      asks Claude, and sends back the JSON Claude wrote. The Anthropic key lives only in Cloudflare.
   2. Episode alerts: the app registers each device for phone notifications and keeps the Worker's copy of Joey's show
      list current; every hour the Worker asks TVmaze what has just aired and sends an alert for each new episode
      (quiet 10 PM to 8 AM Central; those wait for the 8 AM check). Its alert keys are made here and never leave.

   Settings in Cloudflare (Worker → Settings → Variables and Secrets):
     ANTHROPIC_API_KEY   secret   from the Claude Console → API Keys
     FIREBASE_PROJECT_ID text     the Firebase project id, e.g. up-next-1a2b3
     ALLOWED_UID         text     your user ID, from Up Next → Your data → Copy user ID
     ALLOWED_ORIGIN      text     https://josephprestley.github.io
     MODEL               text     optional; default claude-sonnet-5-5
     TRELLO_KEY          secret   Daily Spin: the Trello Power-Up's API key
     TRELLO_TOKEN        secret   Daily Spin: a read-only token (authorize with scope=read)
     TRELLO_IDS          text     Daily Spin: the board, list and card ids it may read (see trelloRoute)
   Bindings (Worker → Settings → Bindings): a KV namespace named PUSH.
   Triggers (Worker → Settings → Triggers → Cron Triggers): 0 * * * * (every hour). */

const JWKS_URL = "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";
const APP_URL = "https://josephprestley.github.io/up-next/";
const TZ = "America/Chicago", QUIET_FROM = 22, QUIET_UNTIL = 8;   // no alerts 10 PM to 8 AM
const FRESH_MS = 36 * 3600 * 1000;                                // an episode counts as new for 36 hours
const PER_RUN = 35;                                               // shows checked per hour (Cloudflare allows 50 requests)
let jwksCache = { keys: null, until: 0 };

export default {
  async fetch(req, env) {
    const allowed = env.ALLOWED_ORIGIN || "https://josephprestley.github.io";
    const origin = req.headers.get("Origin") || "";
    const cors = { "Access-Control-Allow-Origin": allowed, "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Authorization, Content-Type", "Access-Control-Max-Age": "86400", Vary: "Origin" };
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (req.method !== "POST" || origin !== allowed) return reply({ error: "forbidden" }, 403, cors);
    if (!env.FIREBASE_PROJECT_ID || !env.ALLOWED_UID) return reply({ error: "not_set_up" }, 500, cors);

    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    let claims = null;
    try { claims = await verifyFirebaseToken(token, env.FIREBASE_PROJECT_ID); } catch (e) { claims = null; }
    if (!claims || claims.sub !== env.ALLOWED_UID) return reply({ error: "unauthorized" }, 401, cors);

    const body = await req.json().catch(() => null);
    if (body && typeof body.trello === "string") {
      try {
        const out = await trelloRoute(body, env);
        return reply(out, out.error ? (out.status || 400) : 200, cors);
      } catch (e) { return reply({ error: "trello_failed" }, 502, cors); }
    }
    if (body && typeof body.push === "string") {
      try {
        const out = await pushRoute(body, env, claims.sub);
        return reply(out, out.error ? 400 : 200, cors);
      } catch (e) { return reply({ error: "push_failed", detail: String((e && e.message) || e).slice(0, 200) }, 500, cors); }
    }

    if (!env.ANTHROPIC_API_KEY) return reply({ error: "not_set_up" }, 500, cors);
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

  // the hourly check (Cron Trigger)
  async scheduled(event, env, ctx) {
    ctx.waitUntil(checkEpisodes(env, { now: event.scheduledTime || Date.now() }).catch(() => {}));
  },
};

function reply(obj, status, headers) {
  return new Response(JSON.stringify(obj), { status, headers: Object.assign({ "content-type": "application/json" }, headers) });
}

// ------------------------------------------------------------------ Trello, read only (Daily Spin)
/* Daily Spin asks for a few named things; the board, list and card ids live in the TRELLO_IDS setting, not in the page,
   and the key and a read-only token are secrets (TRELLO_KEY, TRELLO_TOKEN). Replies carry only the fields the game
   reads, in the shapes it already knows, and Chief of Staff lists come back with Personal-labeled cards only.
   TRELLO_IDS (text): {"personalBoard","personalToday","personalDone","cosBoard","cosToday","cosDone","healthCard"} */
const TRELLO = "https://api.trello.com/1/";
const LISTS = ["personalToday", "personalDone", "cosToday", "cosDone"];
const HEX24 = /^[0-9a-f]{24}$/;
const KEEP_DAYS = 60;   // cards whose last activity is older than this can't pay any more
const rate = { minute: 0, n: 0 };
export async function trelloRoute(body, env, now = Date.now()) {
  if (!env.TRELLO_KEY || !env.TRELLO_TOKEN || !env.TRELLO_IDS) return { error: "trello_not_set_up", status: 500 };
  let ids;
  try { ids = typeof env.TRELLO_IDS === "string" ? JSON.parse(env.TRELLO_IDS) : env.TRELLO_IDS; } catch (e) { return { error: "trello_not_set_up", status: 500 }; }
  const m = Math.floor(now / 60000);
  if (rate.minute !== m) { rate.minute = m; rate.n = 0; }
  if (++rate.n > 120) return { error: "rate_limited", status: 429 };
  const get = async (path, params) => {
    const q = new URLSearchParams(Object.assign({}, params, { key: env.TRELLO_KEY, token: env.TRELLO_TOKEN }));
    const r = await fetch(TRELLO + path + "?" + q.toString(), { headers: { Accept: "application/json" } });
    if (r.status === 401) throw Object.assign(new Error("auth"), { code: "trello_auth" });
    if (r.status === 404) throw Object.assign(new Error("gone"), { code: "not_found" });
    if (r.status === 429) throw Object.assign(new Error("busy"), { code: "rate_limited" });
    if (!r.ok) throw Object.assign(new Error("trello " + r.status), { code: "upstream" });
    return r.json();
  };
  try {
    switch (body.trello) {
      case "cards": {
        if (!LISTS.includes(body.list) || !HEX24.test(String(ids[body.list] || ""))) return { error: "bad_request" };
        const raw = await get("lists/" + ids[body.list] + "/cards", { filter: body.filter === "all" ? "all" : "open", fields: "name,labels,due,dueComplete,closed,dateLastActivity,url,idList", limit: "1000" });
        const cos = body.list.startsWith("cos");
        const floor = now - KEEP_DAYS * 86400000;
        const listName = /done/i.test(body.list) ? "Done" : "Today";
        const nodes = (Array.isArray(raw) ? raw : [])
          .filter((c) => c && HEX24.test(String(c.id)) && (!cos || (c.labels || []).some((l) => /^personal$/i.test(String(l.name || "")))))
          .filter((c) => body.filter !== "all" || !c.dateLastActivity || Date.parse(c.dateLastActivity) >= floor)
          .map((c) => ({ id: c.id, name: String(c.name || "").slice(0, 200), labels: (c.labels || []).map((l) => ({ name: String(l.name || "") })), due: c.due || null, dueComplete: !!c.dueComplete, complete: !!c.dueComplete, closed: !!c.closed, lastActivityAt: c.dateLastActivity || null, webUrl: c.url || "", list: { name: listName } }));
        return { cards: { nodes, pageInfo: { hasNextPage: false, endCursor: null } } };
      }
      case "activity": {
        const id = String(body.card || "").split("/").pop();
        if (!HEX24.test(id)) return { error: "bad_request" };
        const card = await get("cards/" + id, { fields: "idBoard" });
        if (!card || ![ids.personalBoard, ids.cosBoard].includes(card.idBoard)) return { error: "forbidden", status: 403 };
        const acts = await get("cards/" + id + "/actions", { filter: "updateCard:idList,updateCard:closed,updateCard:dueComplete,createCard,copyCard,moveCardToBoard,convertToCardFromCheckItem", display: "true", limit: "25" });
        const list = (Array.isArray(acts) ? acts : []).map((a) => {
          const d = a.data || {}, key = (a.display && a.display.translationKey) || a.type || "";
          const out = { id: a.id, type: a.type, displayKey: key, date: a.date };
          if (d.listBefore) out.listBefore = { name: String(d.listBefore.name || "") };
          if (d.listAfter) out.listAfter = { name: String(d.listAfter.name || "") };
          if (!d.listAfter && d.list && /create|copy|convert|moveCardToBoard/i.test(a.type)) out.listAfter = { name: String(d.list.name || "") };
          return out;
        });
        return { activity: list, pageInfo: { hasNextPage: list.length >= 25, endCursor: null } };
      }
      case "health": {
        if (!HEX24.test(String(ids.healthCard || ""))) return { error: "trello_not_set_up", status: 500 };
        const acts = await get("cards/" + ids.healthCard + "/actions", { filter: "commentCard", limit: "5" });
        const comments = (Array.isArray(acts) ? acts : []).map((a) => ({ id: a.id, text: String((a.data && a.data.text) || "").slice(0, 2000), createdAt: a.date, lastEditedAt: (a.data && a.data.dateLastEdited) || null }));
        return { comments };
      }
      default: return { error: "bad_request" };
    }
  } catch (e) {
    const code = (e && e.code) || "upstream";
    return { error: code, status: code === "trello_auth" ? 502 : code === "rate_limited" ? 429 : code === "not_found" ? 404 : 502 };
  }
}

// ------------------------------------------------------------------ episode alerts
const kvGet = async (env, key, fallback) => { const v = await env.PUSH.get(key, "json"); return v == null ? fallback : v; };
const kvPut = (env, key, value) => env.PUSH.put(key, JSON.stringify(value));

export async function pushRoute(body, env, uid) {
  if (!env.PUSH) return { error: "no_storage" };
  const a = body.push;
  if (a === "key") return { key: (await vapidKeys(env)).pub };
  if (a === "subscribe") {
    const s = body.sub || {}, k = s.keys || {};
    if (!/^https:\/\//.test(s.endpoint || "") || !k.p256dh || !k.auth) return { error: "bad_subscription" };
    const subs = (await kvGet(env, "subs:" + uid, [])).filter((x) => x.endpoint !== s.endpoint);
    subs.push({ endpoint: s.endpoint, p256dh: k.p256dh, auth: k.auth, added: Date.now(), device: String(body.device || "").slice(0, 60) });
    await kvPut(env, "subs:" + uid, subs.slice(-10));
    if (Array.isArray(body.shows)) await saveShows(env, uid, body.shows);
    return { ok: true, devices: Math.min(subs.length, 10) };
  }
  if (a === "unsubscribe") {
    const subs = await kvGet(env, "subs:" + uid, []);
    const left = subs.filter((x) => x.endpoint !== body.endpoint);
    if (left.length !== subs.length) await kvPut(env, "subs:" + uid, left);
    return { ok: true, devices: left.length };
  }
  if (a === "shows") return { ok: true, changed: await saveShows(env, uid, body.shows) };
  if (a === "status") {
    const subs = await kvGet(env, "subs:" + uid, []), shows = await kvGet(env, "shows:" + uid, []);
    return { on: subs.some((x) => x.endpoint === body.endpoint), devices: subs.length, shows: shows.length };
  }
  if (a === "test") {
    const subs = (await kvGet(env, "subs:" + uid, [])).filter((x) => !body.endpoint || x.endpoint === body.endpoint);
    const out = await deliver(env, uid, subs, { title: "Up Next", body: "Episode alerts are on. New episodes of your shows will show up here.", tag: "up-next-test", url: "./" });
    return Object.assign({ ok: true }, out);
  }
  if (a === "check") return checkEpisodes(env, { dry: !!body.dry, ignoreQuiet: true });
  return { error: "unknown_action" };
}

async function saveShows(env, uid, list) {
  const clean = (Array.isArray(list) ? list : []).slice(0, 300)
    .map((s) => ({ tv: parseInt(s && s.tv, 10), t: String((s && s.t) || "").slice(0, 80), id: String((s && s.id) || "").slice(0, 80) }))
    .filter((s) => s.tv > 0 && s.t);
  const cur = await kvGet(env, "shows:" + uid, []);
  if (JSON.stringify(cur) === JSON.stringify(clean)) return false;
  await kvPut(env, "shows:" + uid, clean);
  return true;
}

function centralHour(now) {
  return parseInt(new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "2-digit", hourCycle: "h23" }).format(new Date(now)), 10) % 24;
}
const pad = (n) => String(n).padStart(2, "0");

// what aired in the last 36 hours that hasn't been announced yet; send it (unless dry)
export async function checkEpisodes(env, opts = {}) {
  const now = opts.now || Date.now(), uid = env.ALLOWED_UID;
  if (!env.PUSH || !uid) return { error: "not_set_up" };
  const subs = await kvGet(env, "subs:" + uid, []);
  if (!subs.length && !opts.dry) return { devices: 0 };
  const h = centralHour(now);
  if (!opts.ignoreQuiet && (h >= QUIET_FROM || h < QUIET_UNTIL)) return { quiet: true };
  const shows = await kvGet(env, "shows:" + uid, []);
  let batch = shows, cursor = 0;
  if (shows.length > PER_RUN) {
    cursor = (await kvGet(env, "cursor:" + uid, 0)) % shows.length;
    batch = shows.slice(cursor, cursor + PER_RUN).concat(shows.slice(0, Math.max(0, cursor + PER_RUN - shows.length)));
  }
  const sent = await kvGet(env, "sent:" + uid, {});
  const due = [];
  for (const s of batch) {
    let j = null;
    try {
      const r = await fetch("https://api.tvmaze.com/shows/" + s.tv + "?embed=previousepisode", { headers: { "User-Agent": "up-next-alerts (" + APP_URL + ")" } });
      if (r.ok) j = await r.json();
    } catch (e) { j = null; }
    const ep = j && j._embedded && j._embedded.previousepisode;
    const t = ep && Date.parse(ep.airstamp || "");
    if (!ep || !t || t > now || now - t > FRESH_MS || sent[ep.id]) continue;
    due.push({ s, ep });
  }
  if (shows.length > PER_RUN && !opts.dry) await kvPut(env, "cursor:" + uid, (cursor + PER_RUN) % shows.length);
  const msgs = due.map(({ s, ep }) => ({
    id: ep.id,
    title: s.t,
    body: (ep.number ? "S" + pad(ep.season) + "E" + pad(ep.number) + (ep.name && !/^(episode \d+|tba)$/i.test(ep.name) ? " “" + ep.name + "”" : "") : "A special" + (ep.name ? " (“" + ep.name + "”)" : "")) + " is out.",
    tag: "ep-" + s.tv,
    url: "./#next",
  }));
  if (opts.dry) return { due: msgs.map((m) => m.title + ": " + m.body), checked: batch.length };
  let delivered = 0, gone = 0;
  for (const m of msgs) {
    const out = await deliver(env, uid, subs, m);
    delivered += out.sent; gone += out.gone;
    sent[m.id] = now;
  }
  if (msgs.length) {
    for (const k of Object.keys(sent)) if (now - sent[k] > 14 * 86400000) delete sent[k];
    await kvPut(env, "sent:" + uid, sent);
  }
  return { checked: batch.length, due: msgs.length, sent: delivered, gone };
}

// send one alert to each device; forget devices the push service says are gone
async function deliver(env, uid, subs, msg) {
  let sent = 0;
  const dead = [];
  for (const sub of subs) {
    let status = 0;
    try { status = await sendPush(env, sub, JSON.stringify({ title: msg.title, body: msg.body, tag: msg.tag, url: msg.url })); } catch (e) { status = 0; }
    if (status >= 200 && status < 300) sent++;
    else if (status === 404 || status === 410) dead.push(sub.endpoint);
  }
  if (dead.length) {
    const all = await kvGet(env, "subs:" + uid, []);
    await kvPut(env, "subs:" + uid, all.filter((x) => !dead.includes(x.endpoint)));
  }
  return { sent, gone: dead.length };
}

// ---- Web Push: VAPID (RFC 8292) and message encryption (RFC 8291, aes128gcm)
const enc = new TextEncoder();
const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64u = (s) => { s = String(s).replace(/-/g, "+").replace(/_/g, "/"); while (s.length % 4) s += "="; return Uint8Array.from(atob(s), (c) => c.charCodeAt(0)); };
const concat = (...parts) => { const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0)); let i = 0; for (const p of parts) { out.set(p, i); i += p.length; } return out; };
let vapidCache = null;

export async function vapidKeys(env) {
  if (vapidCache) return vapidCache;
  let v = await env.PUSH.get("vapid", "json");
  if (!v) {
    const kp = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
    v = { jwk: await crypto.subtle.exportKey("jwk", kp.privateKey), pub: b64u(await crypto.subtle.exportKey("raw", kp.publicKey)) };
    await env.PUSH.put("vapid", JSON.stringify(v));
  }
  const key = await crypto.subtle.importKey("jwk", v.jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  vapidCache = { pub: v.pub, key };
  return vapidCache;
}

export async function vapidJwt(v, audience, now = Date.now()) {
  const head = b64u(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const claims = b64u(enc.encode(JSON.stringify({ aud: audience, exp: Math.floor(now / 1000) + 12 * 3600, sub: APP_URL })));
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, v.key, enc.encode(head + "." + claims));
  return head + "." + claims + "." + b64u(sig);
}

const hkdf = async (salt, ikm, info, bits) => new Uint8Array(await crypto.subtle.deriveBits(
  { name: "HKDF", hash: "SHA-256", salt, info }, await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]), bits));

// the encrypted body for one device: salt | record size | key id length | sender public key | ciphertext
export async function encryptPayload(text, p256dh, auth, fixed = {}) {
  const uaPub = unb64u(p256dh), secret = unb64u(auth);
  const kp = fixed.keyPair || await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const asPub = new Uint8Array(await crypto.subtle.exportKey("raw", kp.publicKey));
  const uaKey = await crypto.subtle.importKey("raw", uaPub, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey }, kp.privateKey, 256));
  const ikm = await hkdf(secret, shared, concat(enc.encode("WebPush: info\0"), uaPub, asPub), 256);
  const salt = fixed.salt || crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, enc.encode("Content-Encoding: aes128gcm\0"), 128);
  const nonce = await hkdf(salt, ikm, enc.encode("Content-Encoding: nonce\0"), 96);
  const key = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, key, concat(enc.encode(text), new Uint8Array([2]))));
  const rs = new Uint8Array([0, 0, 16, 0]);   // 4096
  return concat(salt, rs, new Uint8Array([asPub.length]), asPub, ct);
}

async function sendPush(env, sub, text) {
  const v = await vapidKeys(env);
  const jwt = await vapidJwt(v, new URL(sub.endpoint).origin);
  const body = await encryptPayload(text, sub.p256dh, sub.auth);
  const r = await fetch(sub.endpoint, {
    method: "POST",
    headers: { TTL: "86400", Urgency: "normal", "Content-Encoding": "aes128gcm", "Content-Type": "application/octet-stream", Authorization: "vapid t=" + jwt + ", k=" + v.pub },
    body,
  });
  return r.status;
}

// ------------------------------------------------------------------ helpers
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

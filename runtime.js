/* Up Next, standalone: the pieces claude.ai used to provide, rebuilt on Joey's own services.
   - db: Firebase Firestore, the same paths as before (data/users/<uid>/<show id>), kept on the device for offline use
   - user: Firebase sign-in with email and password (works inside a home-screen app on an iPhone)
   - sample: the Claude features, through Joey's Cloudflare Worker, which keeps the Anthropic key off this page
   - assets: show photos, stored right in the show as a small JPEG
   - downloads: an ordinary file download
   Up Next's page asks for these through window.__wc.use(name), exactly as it did on claude.ai. */
import {
  initializeApp, getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  sendPasswordResetEmail, signOut, setPersistence, indexedDBLocalPersistence, browserLocalPersistence,
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager, memoryLocalCache,
  collection, doc, getDoc, getDocs, setDoc, deleteDoc, onSnapshot,
} from "./firebase.js";
import CONFIG from "./config.js";

const gate = document.getElementById("hb-gate");
const $g = (sel) => gate.querySelector(sel);
const err = (code, message) => Object.assign(new Error(message || code), { code });

// ------------------------------------------------------------------ sign-in screen
let mode = "in";   // "in" = sign in, "up" = make an account
function showGate(state, note) {
  document.documentElement.classList.add("hb-gated");
  gate.hidden = false;
  $g("[data-state]").dataset.state = state;
  $g("#hb-note").textContent = note || "";
  if (state === "form") { paintMode(); setTimeout(() => { try { $g("#hb-email").focus(); } catch (e) {} }, 50); }
}
function hideGate() { gate.hidden = true; document.documentElement.classList.remove("hb-gated"); }
function paintMode() {
  $g("#hb-title").textContent = mode === "up" ? "Make your Up Next sign-in" : "Sign in to Up Next";
  $g("#hb-go").textContent = mode === "up" ? "Create my sign-in" : "Sign in";
  $g("#hb-switch").textContent = mode === "up" ? "I already have one" : "First time? Make your sign-in";
  $g("#hb-pass").autocomplete = mode === "up" ? "new-password" : "current-password";
  $g("#hb-forgot").hidden = mode === "up";
}
const AUTH_MSG = {
  "auth/invalid-credential": "That email and password don't match. Try again, or reset your password.",
  "auth/invalid-login-credentials": "That email and password don't match. Try again, or reset your password.",
  "auth/wrong-password": "That password isn't right.",
  "auth/user-not-found": "There's no sign-in for that email yet. Make one with \"First time?\".",
  "auth/email-already-in-use": "There's already a sign-in for that email. Choose \"I already have one\".",
  "auth/weak-password": "Use at least 6 characters.",
  "auth/invalid-email": "That doesn't look like an email address.",
  "auth/too-many-requests": "Too many tries. Wait a few minutes and try again.",
  "auth/network-request-failed": "No connection. Check the Wi-Fi and try again.",
  "auth/operation-not-allowed": "Email sign-in isn't turned on in Firebase yet (Authentication → Sign-in method).",
  "auth/admin-restricted-operation": "New sign-ins are turned off for this app.",
};

// ------------------------------------------------------------------ the runtime
const rt = { ready: false };
let resolveRt;
const rtReady = new Promise((r) => (resolveRt = r));
window.__hbRuntime.attach(rtReady);

function localOnly(note) {
  // without the database Up Next still works, saved in this browser only
  resolveRt({ use: async () => null });
  showGate("local", note);
}

if (!CONFIG || !CONFIG.firebase || !CONFIG.firebase.apiKey) {
  localOnly("Up Next isn't connected to its database yet. Claude adds that once Firebase is set up.");
} else {
  start();
}

function start() {
  const app = initializeApp(CONFIG.firebase);
  const auth = getAuth(app);
  setPersistence(auth, indexedDBLocalPersistence).catch(() => setPersistence(auth, browserLocalPersistence).catch(() => {}));
  let fs;
  try { fs = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) }); }
  catch (e) { fs = initializeFirestore(app, { localCache: memoryLocalCache() }); }

  let resolveUser;
  const signedIn = new Promise((r) => (resolveUser = r));
  let current = null;

  // ---- db: the same calls Up Next made on claude.ai
  const docSnap = (s) => ({ id: s.id, exists: s.exists(), data: () => s.data(), metadata: s.metadata });
  const querySnap = (q) => ({ docs: q.docs.map(docSnap), size: q.size, empty: q.empty, metadata: q.metadata });
  const docRef = (path) => {
    const r = doc(fs, path);
    return {
      id: r.id, path,
      get: async () => docSnap(await getDoc(r)),
      set: (data) => setDoc(r, JSON.parse(JSON.stringify(data))),
      delete: () => deleteDoc(r),
      onSnapshot: (cb, onErr) => onSnapshot(r, { includeMetadataChanges: true }, (s) => cb(docSnap(s)), onErr),
    };
  };
  const colRef = (path) => {
    const c = collection(fs, path);
    return {
      path,
      doc: (id) => docRef(path + "/" + id),
      get: async () => querySnap(await getDocs(c)),
      onSnapshot: (cb, onErr) => onSnapshot(c, { includeMetadataChanges: true }, (q) => cb(querySnap(q)), onErr),
    };
  };
  const db = { collection: colRef, doc: docRef };

  // ---- user
  const user = { id: async () => (await signedIn).uid, email: async () => (await signedIn).email || "" };

  // ---- sample: Claude through the Worker
  const sample = CONFIG.workerUrl ? {
    json: async (prompt, opts) => {
      const u = await signedIn;
      let token;
      try { token = await u.getIdToken(); } catch (e) { throw err("auth"); }
      let res;
      try {
        res = await fetch(CONFIG.workerUrl, { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token }, body: JSON.stringify({ prompt: String(prompt), tier: (opts && opts.modelTier) || "default" }) });
      } catch (e) { throw err("network"); }
      if (res.status === 429) throw err("rate_limited");
      if (res.status === 401 || res.status === 403) throw err("not_granted");
      const body = await res.json().catch(() => null);
      if (!res.ok || !body || !("json" in body)) throw err((body && body.error) || "failed");
      return body.json;
    },
  } : null;

  // ---- assets: a photo goes into the show itself as a small JPEG (no separate storage to pay for)
  const assets = {
    upload: async (blob) => {
      const url = await toJpeg(blob, 520, 0.78);
      if (url.length > 600000) throw err("quota_exceeded");
      return { id: "img-" + Date.now().toString(36), url };
    },
    delete: async () => {},
  };

  // ---- downloads
  const downloads = {
    save: async ({ filename, data, mimeType }) => {
      const blob = data instanceof Blob ? data : new Blob([data], { type: mimeType || "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob); a.download = filename || "download";
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    },
  };

  const caps = { db, user, sample, assets, downloads };
  resolveRt({ use: async (name) => caps[name] || null });

  // ---- account details for Up Next's "Your data" panel
  window.__hbAccount = {
    get email() { return current ? current.email || "" : ""; },
    get uid() { return current ? current.uid : ""; },
    get claude() { return !!sample; },
    signOut: async () => { await signOut(auth); location.reload(); },
  };

  // ---- the sign-in screen
  $g("#hb-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = $g("#hb-email").value.trim(), pass = $g("#hb-pass").value;
    if (!email || !pass) { $g("#hb-msg").textContent = "Enter your email and a password."; return; }
    $g("#hb-go").disabled = true; $g("#hb-msg").textContent = mode === "up" ? "Making your sign-in…" : "Signing in…";
    try {
      if (mode === "up") await createUserWithEmailAndPassword(auth, email, pass);
      else await signInWithEmailAndPassword(auth, email, pass);
      $g("#hb-msg").textContent = "";
    } catch (ex) {
      $g("#hb-msg").textContent = AUTH_MSG[ex && ex.code] || "That didn't work (" + ((ex && ex.code) || "unknown") + "). Try again.";
    } finally { $g("#hb-go").disabled = false; }
  });
  $g("#hb-switch").addEventListener("click", () => { mode = mode === "up" ? "in" : "up"; $g("#hb-msg").textContent = ""; paintMode(); });
  $g("#hb-forgot").addEventListener("click", async () => {
    const email = $g("#hb-email").value.trim();
    if (!email) { $g("#hb-msg").textContent = "Type your email first, then tap \"Forgot password\"."; return; }
    try { await sendPasswordResetEmail(auth, email); $g("#hb-msg").textContent = "A reset link is on its way to " + email + "."; }
    catch (ex) { $g("#hb-msg").textContent = AUTH_MSG[ex && ex.code] || "Couldn't send the reset email."; }
  });

  onAuthStateChanged(auth, (u) => {
    if (u) {
      const switched = current && current.uid !== u.uid;
      current = u; hideGate(); resolveUser(u);
      if (switched) location.reload();
    } else if (current) { location.reload(); }
    else showGate("form");
  });
}

// a photo as a JPEG data URL, longest side at most `max` pixels
function toJpeg(blob, max, q) {
  return new Promise((resolve, reject) => {
    const img = new Image(), url = URL.createObjectURL(blob);
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(img.naturalWidth * k)); c.height = Math.max(1, Math.round(img.naturalHeight * k));
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL("image/jpeg", q));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(err("format")); };
    img.src = url;
  });
}

// the "use it on this device only" button on the not-set-up screen
gate.addEventListener("click", (e) => { if (e.target.closest("#hb-local")) hideGate(); });

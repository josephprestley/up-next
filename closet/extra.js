/* My Closet app layer, part 2: the menu, backup and restore, and Add several. Loaded after the closet page's own script,
   so it can use the page's own pieces (S, openModal, putDoc, ASSETS, SAMPLE, TYPES, ...). */
(function () {
  'use strict';
  const use = n => (window.__wc && window.__wc.use ? window.__wc.use(n).catch(() => null) : Promise.resolve(null));
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const FIT_SHORT = {tooLoose: 'Too loose', loose: 'Loose', right: 'Just right', tight: 'Tight', tooTight: 'Too tight'};
  // keep in step with the style lists in the page (Fill in from photo) when a new drawing style is added
  const STYLES = ['crew', 'raglan', 'sneaker', 'high', 'dress', 'boot', 'western', 'sandal', 'necktie', 'bolo', 'bow', 'blazer', 'trucker', 'track', 'rain', 'overcoat', 'bomber', 'trouser', 'sweat', 'cap', 'beanie', 'docker'];
  const CONDS = ['New with tags', 'Like new', 'Good', 'Fair', 'Worn out'];
  const MAX_BATCH = 36;

  // ------------------------------------------------------------------ the menu
  // the page's sheets wire their own Close buttons; these do it for every [data-close] inside
  function openSheet(html, mount, opts) {
    openModal(html, sheet => { sheet.addEventListener('click', e => { if (e.target.closest('[data-close]')) closeModal(); }); if (mount) mount(sheet); }, opts);
  }
  function menuBtn() {
    const wrap = document.querySelector('.chero-wrap'); if (!wrap || document.getElementById('menuBtn')) return;
    const b = document.createElement('button');
    b.className = 'menu-btn'; b.id = 'menuBtn'; b.type = 'button'; b.setAttribute('aria-label', 'Your closet: add several, download, restore, sign out');
    b.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><circle cx="5" cy="12" r="1.8" fill="currentColor"/><circle cx="12" cy="12" r="1.8" fill="currentColor"/><circle cx="19" cy="12" r="1.8" fill="currentColor"/></svg>';
    b.addEventListener('click', openMenu);
    wrap.append(b);
  }
  function openMenu() {
    const email = (window.__hbAccount && window.__hbAccount.email) || '';
    const html = `<header><h2>Your closet</h2><button class="x" data-close aria-label="Close">&times;</button></header>
      <div class="menu-list">${email ? `<p class="who">Signed in as ${esc(email)}</p>` : ''}
        <button class="menu-item" data-m="several"><b>Add several pieces</b><span>Pick photos from your camera roll. Claude sorts them into pieces and fills each one in.</span></button>
        <button class="menu-item" data-m="download"><b>Download my closet</b><span>One file with every piece, photo and planned week.</span></button>
        <button class="menu-item" data-m="restore"><b>Restore from file</b><span>Bring in a closet file, such as the copy from Home Base. It keeps what is already here unless you say otherwise.</span></button>
        ${window.__hbAccount ? `<button class="menu-item" data-m="signout"><b>Sign out</b></button>` : ''}
      </div>`;
    openSheet(html, sheet => {
      sheet.addEventListener('click', e => {
        const b = e.target.closest('[data-m]'); if (!b) return;
        const m = b.dataset.m;
        if (m === 'several') pickPhotos();          // must start inside this tap so the phone allows the photo picker
        else if (m === 'download') downloadCloset();
        else if (m === 'restore') pickRestore();
        else if (m === 'signout') window.__hbAccount.signOut();
      });
    }, {cls: 'narrow', label: 'Your closet'});
  }
  function addMenu() {
    const html = `<header><h2>Add to your closet</h2><button class="x" data-close aria-label="Close">&times;</button></header>
      <div class="menu-list">
        <button class="menu-item" data-m="one"><b>One piece</b><span>Take or pick a photo, then check the details.</span></button>
        <button class="menu-item" data-m="several"${SAMPLE && S.caps.images ? '' : ' disabled'}><b>Several at once</b><span>${SAMPLE && S.caps.images ? 'Pick a batch of photos. Shoot each piece, then its tag, and Claude does the rest.' : 'Needs Claude, which isn’t connected right now.'}</span></button>
      </div>`;
    openSheet(html, sheet => {
      sheet.addEventListener('click', e => {
        const b = e.target.closest('[data-m]'); if (!b || b.disabled) return;
        if (b.dataset.m === 'one') { closeModal(); openEditor(null); }
        else pickPhotos();
      });
    }, {cls: 'narrow', label: 'Add to your closet'});
  }

  // ------------------------------------------------------------------ backup
  const fmtN = (n, one, many) => n + ' ' + (n === 1 ? one : many);
  function progressSheet(title) {
    openSheet(`<header><h2>${esc(title)}</h2><button class="x" data-close aria-label="Close">&times;</button></header><p class="bk-msg" id="bkMsg" role="status" aria-live="polite">Starting…</p><div class="bk-bar"><i id="bkBar"></i></div><div id="bkOut"></div>`, null, {cls: 'narrow', label: title});
    const q = s => document.querySelector('.overlay ' + s);
    return {
      say: (t, frac) => { const m = q('#bkMsg'); if (m) m.textContent = t; if (frac != null) { const b = q('#bkBar'); if (b) b.style.width = Math.round(frac * 100) + '%'; } },
      out: html => { const o = q('#bkOut'); if (o) o.innerHTML = html; },
    };
  }
  async function downloadCloset() {
    const backup = await use('backup'), downloads = await use('downloads');
    if (!backup) { toast('Backup isn’t available here.'); return; }
    const p = progressSheet('Download my closet');
    try {
      const data = await backup.exportAll(t => p.say(t));
      const name = 'my-closet-' + dkey(new Date()) + '.json';
      const blob = new Blob([JSON.stringify(data)], {type: 'application/json'});
      const n = Object.keys(data.items).length, ph = Object.keys(data.photos).length;
      p.say('Ready: ' + fmtN(n, 'piece', 'pieces') + ' and ' + fmtN(ph, 'photo', 'photos') + ' (' + (blob.size / 1048576).toFixed(1) + ' MB).', 1);
      p.out(`<div class="bk-actions"><button class="btn primary" id="bkSave">Save the file</button><button class="btn ghost" data-close>Close</button></div>`);
      document.querySelector('.overlay #bkSave').addEventListener('click', async () => {
        // on an iPhone the share sheet can put it in Files; elsewhere it is an ordinary download
        try {
          const f = new File([blob], name, {type: 'application/json'});
          if (/iP(hone|ad)/.test(navigator.userAgent) && navigator.canShare && navigator.canShare({files: [f]})) { await navigator.share({files: [f]}); return; }
        } catch (e) { if (e && e.name === 'AbortError') return; }
        await downloads.save({filename: name, data: blob, mimeType: 'application/json'});
      });
    } catch (e) { p.say('That didn’t work. Check your connection and try again.'); }
  }
  function pickRestore() {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'application/json,.json';
    inp.addEventListener('change', async () => {
      const f = inp.files && inp.files[0]; if (!f) return;
      let file;
      try { file = JSON.parse(await f.text()); } catch (e) { toast('That file isn’t a closet file.'); return; }
      if (!file || file.format !== 'my-closet' || !file.items) { toast('That file isn’t a closet file.'); return; }
      restoreSheet(file);
    });
    inp.click();
  }
  function restoreSheet(file) {
    const c = {items: Object.keys(file.items || {}).length, outfits: Object.keys(file.outfits || {}).length, weeks: Object.keys(file.weeks || {}).length, photos: Object.keys(file.photos || {}).length};
    const when = file.exportedAt ? new Date(file.exportedAt).toLocaleString() : 'unknown time';
    openSheet(`<header><h2>Restore from file</h2><button class="x" data-close aria-label="Close">&times;</button></header>
      <p class="bk-msg">The file (saved ${esc(when)}) has ${fmtN(c.items, 'piece', 'pieces')}, ${fmtN(c.outfits, 'outfit', 'outfits')}, ${fmtN(c.weeks, 'planned week', 'planned weeks')} and ${fmtN(c.photos, 'photo', 'photos')}. Here now: ${fmtN(S.items.size, 'piece', 'pieces')}.</p>
      <div class="menu-list">
        <button class="menu-item" data-r="missing"><b>Add what’s missing</b><span>Brings in anything that isn’t here yet and leaves everything already here alone. Safe to run again.</span></button>
        <button class="menu-item" data-r="all"><b>Replace with the file’s copy</b><span>Pieces in both places take the file’s version, so changes made here since are lost.</span></button>
      </div>`, sheet => {
      sheet.addEventListener('click', e => { const b = e.target.closest('[data-r]'); if (b) runRestore(file, b.dataset.r === 'all'); });
    }, {cls: 'narrow', label: 'Restore from file'});
  }
  async function runRestore(file, overwrite) {
    const backup = await use('backup'); if (!backup) return;
    const p = progressSheet('Restoring');
    try {
      const res = await backup.restore(file, {overwrite}, pr => {
        if (pr.phase === 'writing') p.say('Copying… ' + pr.done + ' of ' + pr.total, pr.total ? pr.done / pr.total : 1);
        else p.say('Checking everything arrived…', 1);
      });
      const c = res.counts;
      const line = res.ok
        ? `Done. All ${fmtN(c.items, 'piece', 'pieces')}, ${fmtN(c.outfits, 'outfit', 'outfits')}, ${fmtN(c.weeks, 'week', 'weeks')} and ${fmtN(c.photos, 'photo', 'photos')} are here (${res.wrote} written this time).`
        : 'Finished, but something is off. See below, and run it again to fill in what is missing.';
      p.say(line, 1);
      const bad = [...res.failed.map(x => 'Didn’t save: ' + x.kind + ' ' + x.id), ...res.missing.map(x => 'Missing: ' + x), ...res.badPhotos.map(x => 'Photo not found: ' + x)];
      p.out((bad.length ? `<ul class="bk-list">${bad.slice(0, 12).map(x => `<li>${esc(x)}</li>`).join('')}${bad.length > 12 ? `<li>…and ${bad.length - 12} more</li>` : ''}</ul>` : '') + `<div class="bk-actions"><button class="btn primary" data-close>Close</button></div>`);
    } catch (e) { p.say(e && e.code === 'not_a_closet_file' ? 'That file isn’t a closet file.' : 'That didn’t finish. Check your connection and run it again; nothing is lost.'); }
  }

  // ------------------------------------------------------------------ Add several
  const bits = {
    shrink: async (file, max, q) => {
      let bmp;
      try { bmp = await createImageBitmap(file, {imageOrientation: 'from-image'}); }
      catch (e) { bmp = await new Promise((res, rej) => { const i = new Image(), u = URL.createObjectURL(file); i.onload = () => { URL.revokeObjectURL(u); res(i); }; i.onerror = () => rej(new Error('format')); i.src = u; }); }
      const w = bmp.width || bmp.naturalWidth, h = bmp.height || bmp.naturalHeight, k = Math.min(1, max / Math.max(w, h));
      const cv = document.createElement('canvas'); cv.width = Math.max(1, Math.round(w * k)); cv.height = Math.max(1, Math.round(h * k));
      const g = cv.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(bmp, 0, 0, cv.width, cv.height);
      if (bmp.close) try { bmp.close(); } catch (e) {}
      return new Promise(res => cv.toBlob(b => res(b || file), 'image/jpeg', q));
    },
    dataUrl: blob => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(blob); }),
  };
  let BATCH = null;   // {id, rows:[...], phase, err, last}

  function pickPhotos() {
    if (!SAMPLE || !S.caps.images) { toast('Add several needs Claude, which isn’t connected right now.'); return; }
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*'; inp.multiple = true;
    inp.addEventListener('change', () => { const fl = [...(inp.files || [])]; if (fl.length) startBatch(fl); });
    inp.click();
  }
  const rid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);

  async function startBatch(files) {
    if (files.length > MAX_BATCH) { toast('Pick up to ' + MAX_BATCH + ' photos at a time. Do the rest in a second batch.'); files = files.slice(0, MAX_BATCH); }
    // camera order: when every photo carries its own time, that is the order they were taken in
    const lm = files.map(f => f.lastModified);
    if (new Set(lm).size === files.length) files = files.map((f, i) => [f, i]).sort((a, b) => a[0].lastModified - b[0].lastModified || a[1] - b[1]).map(x => x[0]);
    BATCH = {id: rid(), rows: [], phase: 'prep', err: '', msg: 'Getting the photos ready…', last: null};
    paint();
    try {
      const blobs = [];
      for (let i = 0; i < files.length; i++) { BATCH.msg = 'Getting the photos ready… ' + (i + 1) + ' of ' + files.length; paint(); blobs.push(await bits.shrink(files[i], 1000, .8)); }
      BATCH.phase = 'sort'; BATCH.msg = 'Claude is sorting ' + blobs.length + ' photos into pieces…'; paint();
      const groups = await sortPhotos(blobs);
      BATCH.rows = groups.map(g => ({id: rid(), blobs: g.photos.map(i => blobs[i]), tagIdx: g.tags.map(i => g.photos.indexOf(i)).filter(i => i > 0), fields: null, fit: null, state: 'working', note: '', dup: ''}));
      BATCH.phase = 'review'; paint();
      await fillRows();
    } catch (e) { BATCH.phase = 'error'; BATCH.err = sampleErr(e); paint(); }
  }
  async function sortPhotos(blobs) {
    const n = blobs.length;
    if (n === 1) return [{photos: [0], tags: []}];
    const res = await SAMPLE.json(`These ${n} photos were taken in order and are numbered 0 to ${n - 1}. They show clothing from one person's closet. Usually each piece is photographed first, then a close-up of its tag or label follows, sometimes with a second angle of the same piece.\nGroup them into pieces. Reply with only a JSON array in photo order: [{"photos": [the numbers of every photo of this piece, its main photo first], "tags": [the numbers, from that list, of the close-ups of a tag, label or care tag]}]. Every number from 0 to ${n - 1} must appear in exactly one piece. A photo that is blurry or doesn't show clothing still gets its own entry.`, {images: blobs, imageSide: 420, maxTokens: 3000, feature: 'addSeveralSort'});
    const list = Array.isArray(res) ? res : (res && Array.isArray(res.pieces) ? res.pieces : []);
    const seen = new Set(), out = [];
    for (const g of list) {
      const ph = (Array.isArray(g.photos) ? g.photos : []).map(Number).filter(i => Number.isInteger(i) && i >= 0 && i < n && !seen.has(i));
      if (!ph.length) continue;
      ph.forEach(i => seen.add(i));
      const tg = (Array.isArray(g.tags) ? g.tags : []).map(Number).filter(i => ph.includes(i) && i !== ph[0]);
      out.push({photos: ph, tags: tg});
    }
    for (let i = 0; i < n; i++) if (!seen.has(i)) out.push({photos: [i], tags: []});   // anything Claude left out still gets a card
    return out;
  }

  function piecePrompt(hasTags) {
    return `This is one clothing item from a person's closet. The first photo shows the item${hasTags ? '; the other photos are close-ups of its tag or label, or other angles. Read the tag for brand, size and fabric' : ''}.\nReply with only a JSON object: {"type": one of ${JSON.stringify(Object.keys(TYPES))} (tee = t-shirt, henley = collarless knit shirt with a short button placket, dress = button-up dress shirt, vest = suit vest or waistcoat, overshirt = button-up shirt worn open as an outer layer, sweatshirt = fleece crewneck pullover, tie = necktie or bolo tie, jacket = jacket, blazer or coat), "sleeve": "short" or "long", "style": for shoes "sneaker", "high" (high-tops), "dress" (leather lace-ups, loafers, other dress shoes), "boot" (lace-up boots), "western" (pull-on cowboy or roper boots) or "sandal", for tees "crew" or "raglan" (baseball tee: sleeves a different color from the body), for ties "necktie", "bolo" or "bow", for jackets "blazer", "trucker" (denim), "track" (zip-up track jacket), "rain" (hooded rain jacket or parka), "overcoat" (wool overcoat or topcoat) or "bomber", for pants "trouser" or "sweat" (sweatpants, joggers), for hats "cap", "beanie" or "docker", otherwise null, "name": a short plain description without the brand, at most 5 words, "brand": the brand if a tag or logo clearly shows it, otherwise null, "size": the size printed on the tag exactly as written ("XXL", "34x32", "12", "L Tall"), or null if you can't read one, "fabric": the fabric content from the tag, or a few words describing the fabric, "color": the main color as #RRGGBB, "color2": the secondary color as #RRGGBB or null, "pattern": one of ${JSON.stringify([...PATTERNS.map(p => p[0]), 'photo'])} ("photo" = a busy print or graphic that can't be drawn simply), "seasons": array from ["spring","summer","fall","winter"] (all four for year-round basics), "formality": 1 to 5 (1 lounge, 2 casual, 3 smart casual, 4 business, 5 dressy; halves allowed), "condition": one of ${JSON.stringify(CONDS)}, "notes": one or two plain sentences with anything worth knowing (cut, where it was made, flaws, new with tags)}`;
  }
  function cleanFields(res, hasTags) {
    const f = {name: '', brand: '', type: 'tee', size: '', fabric: '', notes: '', color: '#888888', color2: '', pattern: 'solid', seasons: [], condition: 'Good', acquired: '', paid: ''};
    if (!res || typeof res !== 'object') return f;
    if (TYPES[res.type]) f.type = res.type;
    if (res.sleeve === 'short' || res.sleeve === 'long') f.sleeve = res.sleeve;
    if (STYLES.includes(res.style)) f.style = res.style;
    f.name = String(res.name || '').slice(0, 60); f.brand = String(res.brand || '').slice(0, 40);
    f.size = String(res.size || '').slice(0, 14); f.fabric = String(res.fabric || '').slice(0, 120); f.notes = String(res.notes || '').slice(0, 400);
    if (/^#[0-9a-f]{6}$/i.test(res.color || '')) f.color = res.color;
    if (/^#[0-9a-f]{6}$/i.test(res.color2 || '')) f.color2 = res.color2;
    if (res.pattern === 'photo' || PATTERNS.some(p => p[0] === res.pattern)) f.pattern = res.pattern;
    if (Array.isArray(res.seasons)) { const ss = SEASONS.map(x => x[0]).filter(k => res.seasons.includes(k)); f.seasons = ss.length === 4 ? [] : ss; }
    const fm = Number(res.formality); if (fm >= 1 && fm <= 5) f.formality = Math.round(fm * 2) / 2;
    if (CONDS.includes(res.condition)) f.condition = res.condition;
    return f;
  }
  async function fillRow(r) {
    r.state = 'working'; r.note = ''; paintRow(r);
    try {
      // the piece, its tags, then an extra angle if there's room (four photos at most)
      const order = [0, ...r.tagIdx, ...r.blobs.map((_, i) => i).filter(i => i && !r.tagIdx.includes(i))].filter((v, i, a) => a.indexOf(v) === i).slice(0, 4);
      const res = await SAMPLE.json(piecePrompt(r.blobs.length > 1), {images: order.map(i => r.blobs[i]), imageSide: 900, maxTokens: 900, feature: 'addSeveralPiece'});
      r.fields = cleanFields(res, r.blobs.length > 1);
      r.state = 'ready'; r.dup = dupOf(r);
      saveDraft(r);
    } catch (e) { r.state = 'error'; r.note = sampleErr(e); }
    paintRow(r); paintHead();
  }
  async function fillRows() {
    const queue = BATCH.rows.filter(r => r.state === 'working');
    let i = 0; const run = async () => { while (i < queue.length) { const r = queue[i++]; await fillRow(r); } };
    await Promise.all([run(), run(), run()]);
  }
  // a possible duplicate: same kind of piece, same brand and a close color
  function dupOf(r) {
    const f = r.fields; if (!f) return '';
    const [r1, g1, b1] = hexRgb(f.color);
    for (const [, it] of S.items) {
      if (it.type !== f.type || (it.status || 'closet') === 'gone') continue;
      const brandSame = f.brand && it.brand && f.brand.toLowerCase() === String(it.brand).toLowerCase();
      const [r2, g2, b2] = hexRgb(it.color); const d = Math.hypot(r1 - r2, g1 - g2, b1 - b2);
      const words = new Set(String(f.name).toLowerCase().split(/\W+/).filter(w => w.length > 3)); const common = String(it.name || '').toLowerCase().split(/\W+/).filter(w => words.has(w)).length;
      if ((brandSame && d < 60) || (d < 35 && common >= 2)) return itemTitle(it);
    }
    return '';
  }

  // drafts: each piece is saved as it is read, so closing the app or losing signal doesn't lose the batch
  async function saveDraft(r) {
    if (!DB || S.mode !== 'live') return;
    try {
      let photos = await Promise.all(r.blobs.map(bits.dataUrl));
      if (photos.reduce((n, x) => n + x.length, 0) > 800000) photos = await Promise.all(r.blobs.map(async b => bits.dataUrl(await bits.shrink(b, 640, .7))));
      await DB.doc('drafts/' + r.id).set({batch: BATCH.id, photos, tagIdx: r.tagIdx, fields: r.fields, fit: r.fit || null, createdAt: new Date().toISOString()});
    } catch (e) { /* a draft that doesn't save only means this piece can't be resumed */ }
  }
  async function dropDraft(r) { if (DB && S.mode === 'live') try { await DB.doc('drafts/' + r.id).delete(); } catch (e) {} }
  async function resumeDrafts() {
    if (!DB || S.mode !== 'live') return;
    let snap; try { snap = await DB.collection('drafts').get(); } catch (e) { return; }
    if (!snap.docs.length) return;
    const rows = [];
    for (const d of snap.docs) {
      const x = d.data(); if (!x || !Array.isArray(x.photos) || !x.fields) continue;
      rows.push({id: d.id, blobs: await Promise.all(x.photos.map(async u => (await fetch(u)).blob())), tagIdx: x.tagIdx || [], fields: x.fields, fit: x.fit || null, state: 'ready', note: '', dup: ''});
    }
    if (!rows.length) return;
    rows.forEach(r => { r.dup = dupOf(r); });
    BATCH = {id: rid(), rows, phase: 'review', err: '', msg: '', last: null};
    paint();
  }
  function draftBanner(n) {
    const host = document.getElementById('banner'); if (!host || !n) return;
    let b = document.getElementById('draftNote'); if (!b) { b = document.createElement('div'); b.id = 'draftNote'; b.className = 'banner'; host.after(b); }
    b.innerHTML = `${fmtN(n, 'piece is', 'pieces are')} waiting from an earlier batch. <button class="tl-go" id="resumeBtn" type="button">Continue</button>`; b.hidden = false;
    document.getElementById('resumeBtn').addEventListener('click', () => { b.hidden = true; resumeDrafts(); });
  }

  // ---- the sheet
  const rowById = id => BATCH && BATCH.rows.find(r => r.id === id);
  const live = () => BATCH ? BATCH.rows.filter(r => !['hung', 'binned', 'skipped'].includes(r.state)) : [];
  function counts() {
    const c = {hung: 0, binned: 0, skipped: 0, waiting: 0};
    for (const r of BATCH.rows) { if (r.state === 'hung') c.hung++; else if (r.state === 'binned') c.binned++; else if (r.state === 'skipped') c.skipped++; else c.waiting++; }
    return c;
  }
  function paint() {
    if (!BATCH) return;
    if (!S.modal || !S.modal.ov.querySelector('[data-as]')) {
      openSheet(`<header data-as><h2>Add several</h2><button class="x" data-close aria-label="Close">&times;</button></header><div id="asBody"></div>`, sheet => {
        sheet.addEventListener('click', onClick); sheet.addEventListener('input', onInput);
      }, {label: 'Add several', onClose: () => { if (BATCH) BATCH.rows.forEach(r => { if (r.url) { URL.revokeObjectURL(r.url); r.url = null; } }); }});
    }
    const body = document.getElementById('asBody'); if (!body) return;
    if (BATCH.phase === 'prep' || BATCH.phase === 'sort') { body.innerHTML = `<div class="as-work"><b>One moment</b>${esc(BATCH.msg)}</div>`; return; }
    if (BATCH.phase === 'error') { body.innerHTML = `<div class="as-work"><b>That stopped</b>${esc(BATCH.err)}</div><div class="bk-actions"><button class="btn" data-close>Close</button></div>`; return; }
    body.innerHTML = `<p class="as-tip">Set the fit on each piece (a photo can’t show that), fix anything Claude got wrong, then hang it. Pieces you skip aren’t saved.</p>
      <div class="as-head" id="asHead"></div><div class="as-list" id="asList">${BATCH.rows.map(rowHTML).join('')}</div><div class="as-end" id="asEnd"></div>`;
    paintHead();
  }
  function paintHead() {
    const h = document.getElementById('asHead'); if (!h || !BATCH) return;
    const c = counts(), all = live().filter(r => r.state === 'ready'), ready = all.filter(r => !r.dup), flagged = all.length - ready.length, unset = ready.filter(r => !r.fit).length, working = live().filter(r => r.state === 'working').length;
    h.innerHTML = `<span class="as-count">${c.hung} hung · ${c.binned} to the bin · ${c.waiting} waiting${working ? ' · Claude is reading ' + working : ''}</span><span class="grow"></span>` +
      (BATCH.last ? `<button class="btn ghost" data-a="undo">Undo</button>` : '') +
      `<button class="btn primary" data-a="hang-rest"${ready.length && !unset && !working ? '' : ' disabled'}>Hang the rest</button>`;
    const end = document.getElementById('asEnd');
    if (end) end.innerHTML = !c.waiting && BATCH.rows.length ? `<b>Done.</b> Hung ${c.hung} · ${c.binned} to the bin · ${c.skipped} skipped. <button class="btn" data-close>Close</button>` : [unset ? `${unset} still need a fit` : '', flagged ? `${fmtN(flagged, 'piece looks', 'pieces look')} like one you already have: decide those yourself` : ''].filter(Boolean).map(t => `<span class="as-count">${t}</span>`).join(' · ');
  }
  function rowHTML(r) {
    const f = r.fields, url = (r.url = r.url || URL.createObjectURL(r.blobs[0]));
    const pic = `<div class="as-pic"><img src="${url}" alt="">${r.blobs.length > 1 ? `<span class="n">${r.blobs.length}</span>` : ''}</div>`;
    if (r.state === 'working') return `<div class="as-row" data-r="${r.id}">${pic}<div class="as-main"><span class="as-count">Claude is reading this one…</span></div></div>`;
    if (r.state === 'error') return `<div class="as-row" data-r="${r.id}">${pic}<div class="as-main"><span class="as-note warn">${esc(r.note)}</span></div><div class="as-acts"><button class="btn" data-a="retry">Try again</button><button class="btn ghost" data-a="skip">Skip</button></div></div>`;
    if (['hung', 'binned', 'skipped'].includes(r.state)) return `<div class="as-row done" data-r="${r.id}">${pic}<div class="as-main"><b>${esc(f ? (f.brand ? f.brand + ' ' : '') + (f.name || 'Piece') : 'Piece')}</b><span class="as-count">${r.state === 'hung' ? 'Hung in your closet' : r.state === 'binned' ? 'In the for-sale bin' : 'Skipped'}</span></div></div>`;
    const tOpts = Object.entries(TYPES).map(([k, v]) => `<option value="${k}"${f.type === k ? ' selected' : ''}>${esc(v.label)}</option>`).join('');
    const chips = Object.keys(FIT_SHORT).map(k => `<button class="chip" type="button" data-a="fit" data-v="${k}" aria-pressed="${r.fit === k}">${FIT_SHORT[k]}</button>`).join('');
    const saving = r.state === 'saving';
    return `<div class="as-row${r.dup ? ' flag' : ''}" data-r="${r.id}">${pic}
      <div class="as-main"><input data-f="name" value="${esc(f.name)}" placeholder="Name" aria-label="Name">
        <div class="as-line"><input data-f="brand" value="${esc(f.brand)}" placeholder="Brand" aria-label="Brand"><input data-f="size" value="${esc(f.size)}" placeholder="Size" aria-label="Size"></div></div>
      <select class="as-kind" data-f="type" aria-label="Kind of piece">${tOpts}</select>
      <div class="as-fit" role="group" aria-label="Fit">${chips}</div>
      <div class="as-acts"><button class="btn primary" data-a="hang"${saving ? ' disabled' : ''}>${saving ? 'Saving…' : 'Hang it'}</button><button class="btn" data-a="bin"${saving ? ' disabled' : ''}>For-sale bin</button><button class="btn ghost" data-a="skip"${saving ? ' disabled' : ''}>Skip</button></div>
      ${r.dup ? `<p class="as-note warn">Looks like your ${esc(r.dup)}. Skip it if it’s the same piece.</p>` : ''}${r.note ? `<p class="as-note warn">${esc(r.note)}</p>` : ''}</div>`;
  }
  function paintRow(r) {
    const el = document.querySelector('.as-row[data-r="' + r.id + '"]'); if (!el) return;
    const t = document.createElement('div'); t.innerHTML = rowHTML(r); el.replaceWith(t.firstElementChild);
  }
  function onInput(e) {
    const t = e.target.closest('[data-f]'); if (!t) return;
    const r = rowById(t.closest('[data-r]').dataset.r); if (!r || !r.fields) return;
    r.fields[t.dataset.f] = t.value;
    if (t.dataset.f === 'type') delete r.fields.style;   // a style belongs to one kind of piece
  }
  async function onClick(e) {
    const b = e.target.closest('[data-a]'); if (!b || b.disabled) return;
    const a = b.dataset.a, row = b.closest('[data-r]'), r = row && rowById(row.dataset.r);
    if (a === 'fit' && r) { r.fit = r.fit === b.dataset.v ? null : b.dataset.v; paintRow(r); paintHead(); saveDraft(r); }
    else if (a === 'retry' && r) fillRow(r);
    else if (a === 'skip' && r) { r.state = 'skipped'; dropDraft(r); paintRow(r); paintHead(); }
    else if ((a === 'hang' || a === 'bin') && r) {
      if (!r.fit) { r.note = 'Pick a fit first.'; paintRow(r); return; }
      await place(r, a === 'bin');
    }
    else if (a === 'hang-rest') { for (const x of live().filter(x => x.state === 'ready' && x.fit && !x.dup)) await place(x, false); }
    else if (a === 'undo') await undo();
  }
  // save one piece: its photos, then the piece itself (if the piece can't be saved the photos go again)
  async function place(r, bin) {
    r.state = 'saving'; r.note = ''; paintRow(r);
    const made = [];
    try {
      for (const blob of r.blobs) made.push((await ASSETS.upload(blob)).id);
      const now = new Date().toISOString(), f = {...r.fields};
      const doc = {...f, fit: r.fit, status: bin ? 'sale' : 'closet', photoId: made[0], tagPhotoIds: r.tagIdx.map(i => made[i]).filter(Boolean), extraPhotoIds: made.filter((_, i) => i && !r.tagIdx.includes(i)), createdAt: now, updatedAt: now};
      if (bin) doc.saleStage = 'deciding';
      if (!doc.tagPhotoIds.length) delete doc.tagPhotoIds; if (!doc.extraPhotoIds.length) delete doc.extraPhotoIds;
      const id = newId('items');
      if (!(await putDoc('items', id, doc))) throw new Error('save');
      r.state = bin ? 'binned' : 'hung'; r.itemId = id; r.assetIds = made; BATCH.last = r.id;
      dropDraft(r);
    } catch (e) {
      for (const pid of made) { try { await ASSETS.delete(pid); } catch (x) {} }
      r.state = 'ready'; r.note = 'That one didn’t save. Try again.';
    }
    paintRow(r); paintHead();
  }
  async function undo() {
    const r = BATCH && rowById(BATCH.last); if (!r || !r.itemId) return;
    BATCH.last = null;
    if (await delDoc('items', r.itemId)) {
      for (const pid of r.assetIds || []) { try { await ASSETS.delete(pid); } catch (x) {} }
      r.state = 'ready'; r.itemId = null; r.assetIds = null; saveDraft(r);
    }
    paintRow(r); paintHead();
  }

  // ------------------------------------------------------------------ start up
  menuBtn();
  document.addEventListener('closet:write-failed', () => toast('A change couldn’t be saved. Check your connection.'));
  const poll = setInterval(async () => {
    if (!S.loaded || S.mode !== 'live' || !DB) return;
    clearInterval(poll);
    try { const snap = await DB.collection('drafts').get(); draftBanner(snap.docs.length); } catch (e) {}
  }, 600);
  setTimeout(() => clearInterval(poll), 20000);
  window.ClosetApp = {addMenu, openMenu, startBatch, sortPhotos, cleanFields, get batch() { return BATCH; }};
})();

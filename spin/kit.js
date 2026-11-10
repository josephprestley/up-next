/* Daily Spin · "Lakeshore Midway" kit v2 (visual artist, round 3). Round 1 art plus skies, machine, HUD, tray and moments. Vanilla JS that returns SVG strings,
   the same pattern as the app's GOB_ART and LAKE_ART, so any piece can move into spin/ as is.
   House rules, in code:
   - One ink, #3a2a22, for every outline (the goblins and reel icons already use it).
   - Outline weight falls off with distance: foreground 2.4, mid 1.6, far none (sky-tinted instead).
   - Light from the top left: one flat shade on the lower right, one white highlight stroke on the upper left.
   - Gloss only on things you can tap and on rewards; scenery is matte.
   Every drawing has its origin at its base centre, y up is negative, so a scene just translates and scales. */
(function () {
  const INK = '#3a2a22';
  const r1 = (n) => Math.round(n * 10) / 10;
  const K = (w) => `stroke="${INK}" stroke-width="${w == null ? 2.4 : w}" stroke-linejoin="round" stroke-linecap="round"`;
  /* an outlined thick line: ink underneath, colour on top (same trick as the goblins' fries) */
  const tube = (d, col, w, ow, cap) => `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${r1(w + 2 * (ow == null ? 2.2 : ow))}" stroke-linecap="${cap || 'round'}" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="${cap || 'round'}" stroke-linejoin="round"/>`;
  const shadow = (rx, ry, y) => `<ellipse cx="0" cy="${y || 0}" rx="${rx}" ry="${ry}" fill="rgba(43,26,16,.2)"/>`;
  const C = {
    red: '#d9675c', red2: '#c34e51', cream: '#f5e6c4', cream2: '#e8d4ab', gold: '#e3be54', gold2: '#dda132', goldhi: '#efe2a0',
    lake: '#57a5ca', lake2: '#4287b8', lakehi: '#a0d4e6', go: '#7dc05d', grape: '#9976d4', grape2: '#8264bb',
    navy: '#405981', win: '#475773', white: '#ede7d7', roof: '#56a57a', roof2: '#478c67', lawn: '#95c46d', lawn2: '#71ab58',
    pine: '#548b66', pine2: '#467756', trunk: '#977150', sand: '#e4cb9a', plank: '#d1a678', plank2: '#b78a61'
  };
  const bulbs = (pts, lit, r) => pts.map(([x, y]) => lit ? `<g class="bulb"><circle cx="${r1(x)}" cy="${r1(y)}" r="${r1((r || 2) * 3)}" fill="#ebd687" opacity=".6"/><circle cx="${r1(x)}" cy="${r1(y)}" r="${r || 2}" fill="#f5ecc3" stroke="${INK}" stroke-width="1"/></g>`
    : `<circle cx="${r1(x)}" cy="${r1(y)}" r="${r || 2}" fill="#e6d7b4" stroke="${INK}" stroke-width="1"/>`).join('');

  /* ---------------- landmarks ---------------- */
  /* The Big Wheel (2019, 100 ft): white trussed rim, blue A-frame, red gondolas. */
  function bigWheel(o) {
    o = o || {}; const R = o.R || 100, hy = -(R + 30), N = 24, lit = !!o.lit;
    let s = shadow(R * 0.9, 6, 0);
    // back legs (darker, a step right)
    const legs = (dx, col, w) => tube(`M${dx} ${hy} L${r1(dx - R * 0.6)} 0 M${dx} ${hy} L${r1(dx + R * 0.6)} 0`, col, w, 2);
    s += legs(7, '#46719f', 5);
    // rim, truss, spokes
    let spokes = '', truss = '';
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2, x = Math.cos(a), y = Math.sin(a);
      spokes += `M${r1(Math.cos(a + 1.2) * 4)} ${r1(hy + Math.sin(a + 1.2) * 4)}L${r1(x * R * 0.9)} ${r1(hy + y * R * 0.9)}`;
      const a2 = ((i + 0.5) / N) * Math.PI * 2;
      truss += `M${r1(x * R * 0.9)} ${r1(hy + y * R * 0.9)}L${r1(Math.cos(a2) * R)} ${r1(hy + Math.sin(a2) * R)}L${r1(Math.cos(a + Math.PI * 2 / N) * R * 0.9)} ${r1(hy + Math.sin(a + Math.PI * 2 / N) * R * 0.9)}`;
    }
    s += `<g class="bw-rim">`;
    s += `<path d="${spokes}" stroke="#fff" stroke-width="1.3" opacity=".95"/>`;
    s += `<circle cx="0" cy="${hy}" r="${R}" fill="none" stroke="${INK}" stroke-width="6.5"/><circle cx="0" cy="${hy}" r="${R}" fill="none" stroke="#fff" stroke-width="3"/>`;
    s += `<circle cx="0" cy="${hy}" r="${r1(R * 0.9)}" fill="none" stroke="${INK}" stroke-width="4"/><circle cx="0" cy="${hy}" r="${r1(R * 0.9)}" fill="none" stroke="#fff" stroke-width="1.6"/>`;
    s += `<path d="${truss}" fill="none" stroke="#fff" stroke-width="1.1"/>`;
    { const S = o.strings == null ? (lit ? 9 : 0) : o.strings; for (let k = 0; k < 9; k++) { let p = []; for (let j = 0; j < 6; j++) { const a = -Math.PI / 2 + ((k * 6 + j + 0.5) / 54) * Math.PI * 2; p.push([Math.cos(a) * R, hy + Math.sin(a) * R]); } s += bulbs(p, k < S, 1.5); } }
    s += `</g>`;
    // gondolas hang below their pins
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2, x = r1(Math.cos(a) * R), y = r1(hy + Math.sin(a) * R);
      s += `<g transform="translate(${x} ${y})"><path d="M0 0V4" stroke="${INK}" stroke-width="1.4"/><rect x="-5" y="3.5" width="10" height="10" rx="3" fill="${C.red}" ${K(1.5)}/><rect x="-3.4" y="5.6" width="6.8" height="3.4" rx="1" fill="${C.lakehi}" stroke="none"/></g>`;
    }
    // front legs + brace, hub
    s += legs(0, '#5d81b9', 6);
    s += tube(`M${r1(-R * 0.36)} ${r1(hy * 0.42)}H${r1(R * 0.36)}`, '#5d81b9', 3.4, 1.6);
    s += `<circle cx="0" cy="${hy}" r="9" fill="${C.gold}" ${K(2.4)}/><circle cx="0" cy="${hy}" r="3.4" fill="${INK}"/>`;
    s += `<rect x="${r1(-R * 0.75)}" y="-7" width="${r1(R * 1.5)}" height="7" rx="2" fill="${C.cream2}" ${K(2)}/>`;
    return s;
  }

  /* The 1909 pavilion: white classical block, pediment with a fanlight, green hip roofs, cupola and flag,
     green-and-white window awnings (as in Joey's photos), long one-storey wings. */
  function pavilion(o) {
    o = o || {};
    const W = C.white, WS = '#d9d3c4';
    let s = shadow(130, 6, 0);
    const winRow = (x0, n, gap, y, w, h) => { let t = ''; for (let i = 0; i < n; i++) { const x = x0 + i * gap; t += `<path d="M${x} ${y + h}V${y + w / 2}A${w / 2} ${w / 2} 0 0 1 ${x + w} ${y + w / 2}V${y + h}Z" fill="${C.win}" ${K(1.5)}/><path d="M${x + w / 2} ${y + 2}V${y + h}M${x} ${y + h * 0.55}H${x + w}" stroke="${C.cream}" stroke-width="1.1"/>`; } return t; };
    const awning = (x, y, w) => { let t = `<path d="M${x - 1} ${y}H${x + w + 1}L${x + w + 2.5} ${y + 5}H${x - 2.5}Z" fill="${C.cream}" ${K(1.2)}/>`; const n = 4, sw = (w + 5) / n; for (let i = 0; i < n; i += 2) t += `<path d="M${r1(x - 2.5 + i * sw)} ${y + 5}L${r1(x - 1 + i * sw * (w + 2) / (w + 5))} ${y}H${r1(x - 1 + (i + 1) * sw * (w + 2) / (w + 5))}L${r1(x - 2.5 + (i + 1) * sw)} ${y + 5}Z" fill="${C.roof}"/>`; let sc = ''; for (let i = 0; i < n; i++) sc += `<path d="M${r1(x - 2.5 + i * sw)} ${y + 5}a${r1(sw / 2)} ${r1(sw / 2.4)} 0 0 0 ${r1(sw)} 0" fill="${i % 2 ? C.cream : C.roof}" ${K(1)}/>`; return t + sc; };
    // wings
    for (const sgn of [-1, 1]) {
      const x0 = sgn < 0 ? -124 : 50, x1 = sgn < 0 ? -50 : 124;
      s += `<path d="M${x0 - 4} -34L${x0 + 8} -52H${x1 - 8}L${x1 + 4} -34Z" fill="${C.roof}" ${K(2.2)}/><path d="M${x0 - 1} -38H${x1 + 1}" stroke="${C.roof2}" stroke-width="3"/>`;
      s += `<rect x="${x0}" y="-35" width="${x1 - x0}" height="35" fill="${W}" ${K(2.2)}/><rect x="${sgn < 0 ? x0 : x1 - 8}" y="-33.5" width="8" height="32" fill="${WS}"/>`;
      s += winRow(x0 + 7, 5, 13.4, -28, 8, 18);
    }
    // centre block: hip roof behind, cupola, pediment
    s += `<path d="M-60 -66L-40 -86H40L60 -66Z" fill="${C.roof}" ${K(2.2)}/>`;
    s += `<rect x="30" y="-94" width="7" height="14" fill="#b36557" ${K(1.6)}/>`;
    // cupola + dome + flag
    s += `<path d="M0 -150V-131" stroke="${INK}" stroke-width="1.6"/><g transform="translate(1 -150)"><rect width="15" height="10" fill="#fff" ${K(1.2)}/><path d="M0 2.4H15M0 5H15M0 7.6H15" stroke="${C.red}" stroke-width="1.4"/><rect width="6.5" height="5" fill="${C.navy}" ${K(1)}/></g>`;
    s += `<path d="M-13 -112Q-13 -131 0 -133Q13 -131 13 -112Z" fill="${C.roof}" ${K(2)}/><path d="M-8 -116Q-8 -126 -1 -128" stroke="#90d0a5" stroke-width="2" fill="none"/>`;
    s += `<rect x="-15" y="-113" width="30" height="4" rx="1" fill="${W}" ${K(1.6)}/><rect x="-12" y="-110" width="24" height="16" fill="${W}" ${K(1.8)}/>`;
    s += [-7, 0, 7].map((x) => `<path d="M${x - 2.4} -97V-104a2.4 2.4 0 0 1 4.8 0V-97Z" fill="${C.win}"/>`).join('');
    s += `<rect x="-52" y="-66" width="104" height="66" fill="${W}" ${K(2.2)}/><rect x="44" y="-64.5" width="7" height="63" fill="${WS}"/>`;
    s += `<path d="M-58 -64L0 -98L58 -64Z" fill="${W}" ${K(2.2)}/><path d="M-50 -66.5L0 -94L50 -66.5" fill="none" stroke="${WS}" stroke-width="2"/>`;
    s += `<path d="M-13 -68A13 13 0 0 1 13 -68Z" fill="${C.win}" ${K(1.6)}/><path d="M0 -68L0 -80M0 -68L-9 -76M0 -68L9 -76M0 -68L-12 -71M0 -68L12 -71" stroke="${C.cream}" stroke-width="1.1"/>`;
    s += `<rect x="-60" y="-67" width="120" height="5" rx="1.5" fill="${C.cream}" ${K(1.8)}/>`;
    // second floor windows with awnings
    for (const x of [-40, -18, 10, 32]) { s += `<rect x="${x}" y="-53" width="9" height="13" rx="1" fill="${C.win}" ${K(1.4)}/><path d="M${x + 4.5} -53V-40" stroke="${C.cream}" stroke-width="1"/>` + awning(x, -58, 9); }
    // porch: slab, columns, doors, steps
    s += `<rect x="-56" y="-37" width="112" height="5" rx="1.5" fill="${C.cream}" ${K(1.8)}/>`;
    s += `<rect x="-30" y="-32" width="60" height="28" fill="#5d6576"/>`;
    s += [-24, -6, 6].map((x) => `<rect x="${x + 2}" y="-27" width="${x === -6 ? 12 : 16}" height="23" rx="1" fill="${C.win}"/>`).join('');
    s += [-31, -14, 8, 25].map((x) => `<rect x="${x}" y="-32" width="6" height="28" fill="${W}" ${K(1.5)}/>`).join('');
    s += `<rect x="-48" y="-28" width="12" height="16" rx="1" fill="${C.win}" ${K(1.4)}/><rect x="36" y="-28" width="12" height="16" rx="1" fill="${C.win}" ${K(1.4)}/>`;
    s += `<path d="M-36 -4H36L40 0H-40Z" fill="${C.cream2}" ${K(1.8)}/><rect x="-126" y="-3" width="252" height="3" fill="${C.cream2}"/>`;
    // lit: warm windows + bulb strings along the cornice
    if (o.lit) { let p = []; for (let x = -56; x <= 56; x += 8) p.push([x, -62]); s += bulbs(p, true, 1.4);
      s += `<g class="bulb" fill="#e9ca79" opacity=".9">` + [-40, -18, 10, 32].map((x) => `<rect x="${x + 1}" y="-52" width="7" height="11" rx="1"/>`).join('') + `<rect x="-47" y="-27" width="10" height="14" rx="1"/><rect x="37" y="-27" width="10" height="14" rx="1"/><path d="M-11 -68A11 11 0 0 1 11 -68Z"/></g>`; }
    return s;
  }

  /* ---------------- rides (finished look; stages are applied by stage()) ---------------- */
  function horse(x, y, flip, body, saddle) {
    const f = flip ? -1 : 1;
    return `<g transform="translate(${x} ${y}) scale(${f} 1)"><g ${K(1.5)}>` +
      `<path d="M-9 -1Q-15 -2 -15 5" fill="none" stroke-width="3.6"/><path d="M-9 -1Q-15 -2 -15 5" fill="none" stroke="${saddle}" stroke-width="1.6"/>` +
      `<path d="M5 3L10 9M3 4L2 10M-5 4L-9 9M-7 3L-3 10" fill="none" stroke-width="4"/><path d="M5 3L10 9M3 4L2 10M-5 4L-9 9M-7 3L-3 10" fill="none" stroke="${body}" stroke-width="2"/>` +
      `<ellipse cx="0" cy="0" rx="10" ry="5.8" fill="${body}"/>` +
      `<path d="M4 -3L9 -12Q11 -15.5 15 -13.6L16.4 -9.6Q13.4 -9.8 11.6 -6.6L8.6 0Z" fill="${body}"/>` +
      `<path d="M5 -4L9.6 -12.4" stroke="${saddle}" stroke-width="1.6"/>` +
      `<path d="M-4 -5Q0 -7.4 4.2 -5L4 1H-4Z" fill="${saddle}" stroke-width="1.2"/></g></g>`;
  }
  function carousel(o) {
    o = o || {}; const lit = !!o.lit;
    let s = shadow(58, 7, 0);
    // deck + skirt
    s += `<path d="M-54 -11A54 11 0 0 0 54 -11V-3A54 11 0 0 1 -54 -3Z" fill="${C.grape}" ${K()}/><path d="M-54 -7A54 11 0 0 0 54 -7" fill="none" stroke="${C.gold}" stroke-width="2"/>`;
    s += `<ellipse cx="0" cy="-11" rx="54" ry="11" fill="#e3cb9e" ${K()}/>`;
    // back poles and the centre drum
    s += `<rect x="-11" y="-70" width="22" height="58" fill="${C.gold}" ${K()}/><path d="M-4 -68V-14M4 -68V-14" stroke="${C.red}" stroke-width="3"/>`;
    // poles + horses (three in front)
    const H = [[-36, -38, false, C.cream, C.red], [-2, -30, false, '#fff', C.lake], [32, -42, true, C.cream, C.grape]];
    for (const [x] of H) s += tube(`M${x} -70V-12`, C.gold, 2, 1.1);
    for (const h of H) s += horse(h[0], h[1], h[2], h[3], h[4]);
    // canopy: striped cone over a scalloped valance
    const ap = -104, by = -72, rx = 62, ry = 10, n = 12;
    const pt = (t) => [r1(-rx * Math.cos(t)), r1(by + ry * Math.sin(t))];
    let wedges = '', val = '', bl = [];
    for (let i = 0; i < n; i++) {
      const t0 = (i / n) * Math.PI, t1 = ((i + 1) / n) * Math.PI, a = pt(t0), b = pt(t1);
      wedges += `<path d="M0 ${ap}L${a[0]} ${a[1]}L${b[0]} ${b[1]}Z" fill="${i % 2 ? C.cream : C.red}"/>`;
      const m = [r1((a[0] + b[0]) / 2), r1((a[1] + b[1]) / 2 + 9)];
      val += `<path d="M${a[0]} ${a[1]}Q${m[0]} ${m[1] + 4} ${b[0]} ${b[1]}Z" fill="${i % 2 ? C.red : C.cream}" ${K(1.4)}/>`;
      bl.push([m[0], m[1] - 2]);
    }
    s += `<path d="M${-rx} ${by}L0 ${ap}L${rx} ${by}A${rx} ${ry} 0 0 1 ${-rx} ${by}Z" fill="${C.cream}" ${K()}/>` + wedges;
    s += `<path d="M${-rx} ${by}L0 ${ap}L${rx} ${by}A${rx} ${ry} 0 0 1 ${-rx} ${by}Z" fill="none" ${K()}/>`;
    s += `<path d="M-30 -86L-6 -100" stroke="#fff" stroke-width="2.4" opacity=".7" stroke-linecap="round"/>`;
    s += val + bulbs(bl, lit, 1.7);
    s += `<path d="M0 ${ap}V${ap - 16}" stroke="${INK}" stroke-width="1.8"/><path d="M0 ${ap - 16}L13 ${ap - 12}L0 ${ap - 8}Z" fill="${C.red}" ${K(1.3)}/><circle cx="0" cy="${ap}" r="4.5" fill="${C.gold}" ${K(1.8)}/>`;
    return s;
  }
  function ferris(o) {
    o = o || {}; const R = o.R || 36, hy = -(R + 14), N = 8;
    let s = shadow(40, 5, 0);
    s += tube(`M4 ${hy}L${4 - R * 0.62} 0M4 ${hy}L${4 + R * 0.62} 0`, '#b64d4e', 3.4, 1.6);
    let sp = '';
    for (let i = 0; i < N; i++) { const a = (i / N) * Math.PI * 2; sp += `M0 ${hy}L${r1(Math.cos(a) * R)} ${r1(hy + Math.sin(a) * R)}`; }
    s += `<path d="${sp}" stroke="${INK}" stroke-width="3"/><path d="${sp}" stroke="${C.gold}" stroke-width="1.4"/>`;
    s += `<circle cx="0" cy="${hy}" r="${R}" fill="none" stroke="${INK}" stroke-width="5.6"/><circle cx="0" cy="${hy}" r="${R}" fill="none" stroke="${C.red}" stroke-width="2.6"/>`;
    if (o.lit) { let p = []; for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; p.push([Math.cos(a) * R, hy + Math.sin(a) * R]); } s += bulbs(p, true, 1.3); }
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2 + 0.2, x = r1(Math.cos(a) * R), y = r1(hy + Math.sin(a) * R);
      s += `<g transform="translate(${x} ${y})"><path d="M0 0V3" stroke="${INK}" stroke-width="1.4"/><path d="M-6 3H6L4.6 10Q0 12 -4.6 10Z" fill="${i % 2 ? C.lake : C.gold}" ${K(1.5)}/></g>`;
    }
    s += tube(`M-4 ${hy}L${-4 - R * 0.62} 0M-4 ${hy}L${-4 + R * 0.62} 0`, C.red, 3.6, 1.6);
    s += `<circle cx="0" cy="${hy}" r="5" fill="${C.gold}" ${K(1.8)}/>`;
    s += `<rect x="-30" y="-5" width="60" height="5" rx="1.6" fill="${C.cream2}" ${K(1.8)}/>`;
    return s;
  }
  function shell(x, y, col, sc) {
    sc = sc || 1;
    return `<g transform="translate(${x} ${y}) scale(${sc})"><g ${K(1.6)}><path d="M-11 0V-8Q-11 -19 0 -19Q11 -19 11 -8V0Z" fill="${col}"/>` +
      `<path d="M-6 -2V-15M0 -2V-18M6 -2V-15" fill="none" stroke-width="1.1" opacity=".55"/>` +
      `<path d="M-10 -2Q-10 5 0 5Q10 5 10 -2V-5H-10Z" fill="${C.cream}"/></g><path d="M-7 -12Q-6 -16 -2 -17" stroke="#fff" stroke-width="1.8" fill="none" opacity=".75" stroke-linecap="round"/></g>`;
  }
  function tilt(o) {
    o = o || {};
    let s = shadow(58, 7, 0);
    // wavy track deck + skirt
    let wave = 'M-54 -12';
    for (let i = 0; i <= 12; i++) { const t = Math.PI - (i / 12) * Math.PI; wave += `L${r1(-54 * Math.cos(t))} ${r1(-12 + 12 * Math.sin(t) + (i % 2 ? -2 : 1.5))}`; }
    s += `<path d="M-54 -12A54 12 0 0 0 54 -12V-4A54 12 0 0 1 -54 -4Z" fill="${C.lake2}" ${K()}/><path d="M-54 -8A54 12 0 0 0 54 -8" fill="none" stroke="${C.gold}" stroke-width="2"/>`;
    s += `<ellipse cx="0" cy="-12" rx="54" ry="12" fill="${C.lake}" ${K()}/><path d="${wave}" fill="none" stroke="${C.lakehi}" stroke-width="1.6" opacity=".8"/>`;
    // centre pole + sign
    s += tube('M0 -14V-44', C.grape, 4, 1.6);
    s += `<rect x="-20" y="-58" width="40" height="15" rx="4" fill="${C.red}" ${K(2)}/><text x="0" y="-46.6" text-anchor="middle" font-family="Lilita One" font-size="11" fill="#fff" stroke="${INK}" stroke-width="2.2" paint-order="stroke">TILT</text>`;
    // shell cars: two behind, three in front
    s += shell(-28, -18, C.gold, 0.85) + shell(26, -19, C.grape, 0.85);
    s += shell(-40, -6, C.red) + shell(0, -1, C.go) + shell(40, -6, '#e5955e');
    return s;
  }
  function scrambler(o) {
    o = o || {};
    let s = shadow(54, 6, 0);
    s += `<path d="M-50 -10A50 10 0 0 0 50 -10V-3A50 10 0 0 1 -50 -3Z" fill="${C.gold2}" ${K()}/><ellipse cx="0" cy="-10" rx="50" ry="10" fill="${C.gold}" ${K()}/>`;
    const tub = (x, y, c) => `<g transform="translate(${x} ${y})"><path d="M-5.5 -6H5.5L4.4 1Q0 3 -4.4 1Z" fill="${c}" ${K(1.4)}/><rect x="-6.4" y="-7.4" width="12.8" height="3" rx="1.2" fill="${C.cream}" ${K(1.1)}/></g>`;
    // arms to three clusters (left, right, front)
    s += tube('M0 -40L-36 -26M0 -40L36 -24', C.lake2, 3, 1.4);
    s += tube('M0 -40V-14', C.red, 7, 1.8);
    for (const [cx, cy, c] of [[-36, -24, C.red], [36, -22, C.lake]]) {
      s += tube(`M${cx - 10} ${cy}H${cx + 10}M${cx} ${cy - 5}V${cy + 6}`, '#979a9e', 2, 1.1);
      s += tub(cx - 10, cy + 2, c) + tub(cx + 10, cy + 2, c) + tub(cx, cy + 8, c);
    }
    s += tube('M0 -40L4 -12', C.lake2, 3, 1.4);
    s += tub(-8, -4, C.grape) + tub(10, -3, C.grape) + tub(1, 2, C.grape);
    s += `<path d="M-9 -40H9L5 -50H-5Z" fill="${C.red}" ${K(1.8)}/><circle cx="0" cy="-52" r="3.4" fill="${C.gold}" ${K(1.4)}/>`;
    return s;
  }
  function train(o) {
    o = o || {}; const rust = !!o.rust;
    let s = shadow(74, 8, 0);
    // track loop
    const rail = rust ? '#977157' : '#747478';
    s += `<ellipse cx="0" cy="-12" rx="72" ry="16" fill="none" stroke="${rust ? '#b29372' : '#a17c57'}" stroke-width="8" stroke-dasharray="2 4"/>`;
    s += `<ellipse cx="0" cy="-12" rx="75" ry="17.5" fill="none" stroke="${rail}" stroke-width="1.6"/><ellipse cx="0" cy="-12" rx="69" ry="14.5" fill="none" stroke="${rail}" stroke-width="1.6"/>`;
    if (rust) return s;
    // depot at the back
    s += `<g transform="translate(26 -24)"><rect x="-14" y="-16" width="28" height="16" fill="${C.cream}" ${K(1.8)}/><path d="M-18 -16L0 -27L18 -16Z" fill="${C.red}" ${K(1.8)}/><rect x="-4" y="-11" width="8" height="11" fill="${C.win}" ${K(1.3)}/></g>`;
    // loco + car on the front of the loop
    s += `<g transform="translate(-22 2)">` +
      `<rect x="-6" y="-18" width="30" height="14" rx="2" fill="${C.gold}" ${K(1.8)}/><rect x="-3" y="-15" width="24" height="3" fill="${C.red}"/>` +
      `<rect x="-40" y="-20" width="26" height="14" rx="6" fill="#559466" ${K(1.8)}/><rect x="-18" y="-30" width="14" height="24" rx="2" fill="${C.red}" ${K(1.8)}/>` +
      `<rect x="-16" y="-27" width="10" height="7" rx="1.5" fill="${C.lakehi}" ${K(1.2)}/><rect x="-20" y="-33" width="18" height="4" rx="1.4" fill="${INK}"/>` +
      `<path d="M-35 -20V-29H-29V-20" fill="${INK}"/><path d="M-37 -31H-27" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>` +
      `<path d="M-40 -9L-46 -4H-40Z" fill="${C.red}" ${K(1.4)}/>` +
      [-34, -24, -12, 0, 16].map((x) => `<circle cx="${x}" cy="-4.5" r="4.2" fill="${C.red}" ${K(1.6)}/><circle cx="${x}" cy="-4.5" r="1.3" fill="${INK}"/>`).join('') +
      `</g>`;
    if (o.lit) s += `<circle cx="-62" cy="-38" r="7" fill="#fff" opacity=".9" ${K(1)}/><circle cx="-68" cy="-48" r="5" fill="#fff" opacity=".8" ${K(1)}/>`;
    return s;
  }

  /* ---------------- stage dressing ---------------- */
  function scaffold(w, h, part) {
    let s = '<g class="scaf">';
    const x0 = -w / 2, x1 = w / 2, cols = Math.max(2, Math.round(w / 18)), rows = Math.max(2, Math.round(h / 16));
    const xs = Array.from({ length: cols + 1 }, (_, i) => r1(x0 + (i * w) / cols)), ys = Array.from({ length: rows + 1 }, (_, i) => r1(-((i * h) / rows)));
    const keep = (i) => part == null || i <= Math.ceil(cols * part);
    let d = '';
    xs.forEach((x, i) => { if (keep(i)) d += `M${x} 0V${-h}`; });
    ys.forEach((y) => { d += `M${x0} ${y}H${part == null ? x1 : xs[Math.ceil(cols * part)]}`; });
    for (let i = 0; i < cols; i += 2) if (keep(i + 1)) d += `M${xs[i]} ${ys[1]}L${xs[i + 1]} ${ys[2]}`;
    s += `<path d="${d}" stroke="${INK}" stroke-width="3" stroke-linecap="round"/><path d="${d}" stroke="#d9bd91" stroke-width="1.5" stroke-linecap="round"/>`;
    s += `<rect x="${x0 - 2}" y="${r1(ys[2] - 2)}" width="${r1((part == null ? 1 : part) * w + 4)}" height="4" rx="1" fill="#b89367" ${K(1.2)}/></g>`;
    return s;
  }
  function weeds(x, y, s) { s = s || 1; return `<g transform="translate(${x} ${y}) scale(${s})"><path d="M-6 0Q-7 -7 -10 -10M-2 0Q-2 -9 0 -13M2 0Q4 -7 8 -9M5 0Q7 -4 11 -5" fill="none" stroke="${INK}" stroke-width="3.4" stroke-linecap="round"/><path d="M-6 0Q-7 -7 -10 -10M-2 0Q-2 -9 0 -13M2 0Q4 -7 8 -9M5 0Q7 -4 11 -5" fill="none" stroke="#84b55a" stroke-width="1.6" stroke-linecap="round"/></g>`; }
  function cone(x, y) { return `<g transform="translate(${x} ${y})"><path d="M-4 0L-1.6 -11H1.6L4 0Z" fill="#e5955e" ${K(1.3)}/><path d="M-2.8 -4.6H2.8" stroke="#fff" stroke-width="1.8"/><rect x="-5.5" y="-1" width="11" height="2.4" rx="1" fill="#e5955e" ${K(1.1)}/></g>`; }
  function sign(x, y, txt, sub) {
    return `<g transform="translate(${x} ${y})"><path d="M-12 0V-22M12 0V-22" stroke="${INK}" stroke-width="4" stroke-linecap="round"/><path d="M-12 0V-22M12 0V-22" stroke="#a57c56" stroke-width="2" stroke-linecap="round"/>` +
      `<rect x="-22" y="-36" width="44" height="20" rx="3" fill="${C.cream}" ${K(1.8)}/><text x="0" y="-25" text-anchor="middle" font-family="Lilita One" font-size="9" fill="${C.red2}">${txt}</text>` +
      (sub ? `<text x="0" y="-18.6" text-anchor="middle" font-family="Nunito" font-weight="900" font-size="5" fill="${INK}">${sub}</text>` : '') + `</g>`;
  }
  function lot(w, o) {
    o = o || {};
    let s = `<ellipse cx="0" cy="-8" rx="${w / 2}" ry="${r1(w / 7)}" fill="#d5bd92" stroke="#c1a57b" stroke-width="1.6"/>`;
    s += `<path d="M${-w / 2 + 6} -8Q${-w / 4} -14 0 -9T${w / 2 - 8} -9" fill="none" stroke="#c7ae86" stroke-width="2" stroke-linecap="round"/>`;
    return s;
  }
  /* The five looks every ride goes through: 0 empty lot, 1 blueprint + scaffolding, 2 built in primer,
     3 painted, 4 lights on and flag up. Stage 1 and 2 use CSS classes (.bp, .primer) so one drawing
     serves all five. */
  function staged(kind, stage, o) {
    o = o || {};
    const D = { carousel: [carousel, 124, 116], ferris: [ferris, 84, 90], tilt: [tilt, 116, 64], scrambler: [scrambler, 108, 60], train: [train, 156, 40] }[kind];
    const fn = D[0], w = D[1], h = D[2];
    if (stage <= 0) {
      let s = lot(w * 0.9);
      if (kind === 'train') s += train({ rust: true });
      s += weeds(-w * 0.22, -6, 1.1) + weeds(w * 0.28, -10, 0.9) + weeds(w * 0.05, -2, 0.8) + cone(-w * 0.36, -4) + cone(w * 0.4, -3) + sign(w * 0.14, -12, o.sign || 'SOON', o.sub);
      return s;
    }
    if (stage === 1) return lot(w * 0.92) + `<g class="bp">${fn({})}</g>` + scaffold(w * 0.7, h * 0.7, 0.55);
    if (stage === 2) return `<g class="primer">${fn({})}</g>` + scaffold(w * 0.62, h * 0.6, 0.35);
    if (stage >= 4) { const g = (x, y, r) => `<path d="M${r1(x)} ${r1(y - r)}Q${r1(x)} ${r1(y)} ${r1(x + r)} ${r1(y)}Q${r1(x)} ${r1(y)} ${r1(x)} ${r1(y + r)}Q${r1(x)} ${r1(y)} ${r1(x - r)} ${r1(y)}Q${r1(x)} ${r1(y)} ${r1(x)} ${r1(y - r)}Z" fill="#efe2a0" stroke="${INK}" stroke-width="1.3" stroke-linejoin="round"/>`; return fn({ lit: true }) + g(-w * 0.4, -h * 0.72, 7) + g(w * 0.42, -h * 0.5, 5.5) + g(w * 0.3, -h * 0.9, 4.5); }
    return fn({ lit: false });
  }

  /* ---------------- scenery ---------------- */
  function tree(x, y, s, c) {
    c = c || [C.lawn2, '#609750', '#9bcd74'];
    return `<g transform="translate(${x} ${y}) scale(${s || 1})"><rect x="-2.6" y="-14" width="5.2" height="14" fill="${C.trunk}" ${K(1.8)}/>` +
      `<g ${K(2)}><circle cx="-9" cy="-20" r="10" fill="${c[0]}"/><circle cx="9" cy="-21" r="10" fill="${c[0]}"/><circle cx="0" cy="-31" r="13" fill="${c[0]}"/></g>` +
      `<path d="M-14 -16Q0 -10 14 -17" fill="none" stroke="${c[1]}" stroke-width="4" opacity=".7"/><path d="M-7 -36Q-5 -41 1 -42" stroke="${c[2]}" stroke-width="3" fill="none" stroke-linecap="round"/></g>`;
  }
  function pine(x, y, s) {
    return `<g transform="translate(${x} ${y}) scale(${s || 1})"><rect x="-2" y="-8" width="4" height="8" fill="${C.trunk}" ${K(1.4)}/><g ${K(1.8)}><path d="M-14 -8L0 -26L14 -8Z" fill="${C.pine}"/><path d="M-11 -20L0 -36L11 -20Z" fill="${C.pine}"/><path d="M-8 -31L0 -46L8 -31Z" fill="${C.pine}"/></g><path d="M-3 -40L-6 -34" stroke="#7bab84" stroke-width="2" stroke-linecap="round"/></g>`;
  }
  function farPine(x, y, s, col) { return `<path transform="translate(${x} ${y}) scale(${s})" d="M0 -30L7 -18H4L9 -9H5L10 0H-10L-5 -9H-9L-4 -18H-7Z" fill="${col}"/>`; }
  function lamp(x, y, lit) {
    return `<g transform="translate(${x} ${y})">` + tube('M0 0V-30', C.navy, 2, 1.2) + `<path d="M-7 -30H7" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>` +
      `<g${lit ? ' class="bulb"' : ''}>` + (lit ? `<circle cx="-7" cy="-33" r="9" fill="#efe2a0" opacity=".45"/><circle cx="7" cy="-33" r="9" fill="#efe2a0" opacity=".45"/>` : '') +
      `<circle cx="-7" cy="-33" r="3.6" fill="${lit ? '#f5ecc3' : C.cream}" ${K(1.4)}/><circle cx="7" cy="-33" r="3.6" fill="${lit ? '#f5ecc3' : C.cream}" ${K(1.4)}/><circle cx="0" cy="-36" r="3.8" fill="${lit ? '#f5ecc3' : C.cream}" ${K(1.4)}/></g></g>`;
  }
  function bunting(x1, y1, x2, y2, sag, n) {
    const cx = (x1 + x2) / 2, cy = (y1 + y2) / 2 + sag;
    let s = `<path d="M${x1} ${y1}Q${cx} ${cy + sag} ${x2} ${y2}" fill="none" stroke="${INK}" stroke-width="1.2"/>`;
    const cols = [C.red, C.cream, C.gold, C.lake];
    for (let i = 1; i < n; i++) {
      const t = i / n, x = (1 - t) * (1 - t) * x1 + 2 * (1 - t) * t * cx + t * t * x2, y = (1 - t) * (1 - t) * y1 + 2 * (1 - t) * t * (cy + sag) + t * t * y2;
      s += `<path d="M${r1(x - 3.6)} ${r1(y)}H${r1(x + 3.6)}L${r1(x)} ${r1(y + 8)}Z" fill="${cols[i % 4]}" stroke="${INK}" stroke-width="1" stroke-linejoin="round"/>`;
    }
    return s;
  }
  function cloud(x, y, s) {
    return `<g transform="translate(${x} ${y}) scale(${s || 1})"><path d="M-30 0Q-34 -12 -20 -13Q-18 -26 -2 -24Q8 -34 20 -22Q34 -24 32 -8Q40 -2 30 0Z" fill="#fff"/><path d="M-28 -1Q0 4 30 -1" stroke="#c4e0ec" stroke-width="5" fill="none" stroke-linecap="round"/></g>`;
  }
  function freighter(x, y, s) {
    return `<g transform="translate(${x} ${y}) scale(${s || 1})"><path d="M-46 0L-42 -6H44L46 0Q0 3 -46 0Z" fill="#ab554c"/><rect x="-42" y="-8" width="86" height="2.4" fill="#51565b"/>` +
      `<rect x="-40" y="-15" width="10" height="7" fill="#e6dfd1"/><rect x="-39" y="-13" width="8" height="1.6" fill="#51565b"/><rect x="30" y="-14" width="12" height="6" fill="#e6dfd1"/><rect x="36" y="-19" width="3.4" height="5" fill="#51565b"/></g>`;
  }
  function sail(x, y, s) { return `<g transform="translate(${x} ${y}) scale(${s || 1})"><path d="M0 -2V-20L9 -3Z" fill="#fff"/><path d="M-1 -18L-7 -3H-1Z" fill="#cfe3ee"/><path d="M-8 -1H10L7 2H-6Z" fill="#be5a5a"/></g>`; }
  function bench(x, y) { return `<g transform="translate(${x} ${y})"><rect x="-10" y="-8" width="20" height="3" rx="1" fill="${C.plank}" ${K(1.3)}/><rect x="-10" y="-13" width="20" height="3" rx="1" fill="${C.plank}" ${K(1.3)}/><path d="M-8 -5V0M8 -5V0" stroke="${INK}" stroke-width="1.8"/></g>`; }

  /* The Prize Booth as a building in the park (tap it to open the Booth). Red-and-white awning. */
  function booth(o) {
    o = o || {};
    let s = shadow(30, 4, 0);
    s += `<rect x="-24" y="-30" width="48" height="30" fill="${C.cream}" ${K(2)}/>`;
    for (let i = 0; i < 6; i++) s += `<rect x="${-24 + i * 8}" y="-14" width="4" height="14" fill="${C.red}"/>`;
    s += `<rect x="-24" y="-14" width="48" height="14" fill="none" ${K(2)}/>`;
    s += `<rect x="-20" y="-28" width="40" height="12" fill="#5d4c69"/>`;
    // a teddy bear prize on the counter
    s += `<g transform="translate(-8 -17)" ${K(1.1)}><circle cx="-3.4" cy="-8" r="1.8" fill="#b5865c"/><circle cx="3.4" cy="-8" r="1.8" fill="#b5865c"/><circle cx="0" cy="-5.4" r="4" fill="#bf9369"/><ellipse cx="0" cy="0" rx="4" ry="3.4" fill="#bf9369"/></g>`;
    s += `<g transform="translate(8 -17)" ${K(1.1)}><path d="M0 0V-8" fill="none"/><circle cx="0" cy="-10" r="3.4" fill="${C.lake}"/><circle cx="3" cy="-6" r="2.8" fill="${C.red}"/></g>`;
    // awning
    let aw = `<path d="M-30 -30L-24 -42H24L30 -30Z" fill="${C.cream}" ${K(2)}/>`;
    for (let i = 0; i < 6; i += 2) aw += `<path d="M${-30 + i * 10} -30L${-24 + i * 8} -42H${-24 + (i + 1) * 8}L${-30 + (i + 1) * 10} -30Z" fill="${C.red}"/>`;
    for (let i = 0; i < 6; i++) aw += `<path d="M${-30 + i * 10} -30a5 4.6 0 0 0 10 0Z" fill="${i % 2 ? C.cream : C.red}" ${K(1.3)}/>`;
    s += aw + `<path d="M-30 -30L-24 -42H24L30 -30" fill="none" ${K(2)}/>`;
    s += `<rect x="-17" y="-55" width="34" height="13" rx="3" fill="${C.navy}" ${K(1.8)}/><text x="0" y="-45.4" text-anchor="middle" font-family="Lilita One" font-size="9" fill="${C.gold}">PRIZES</text>`;
    return s;
  }

  /* The whole Bay Beach scene, as one SVG body. o.w/o.h is the viewBox; o.hz the horizon y. */
  /* ---------------- skies: daylight, golden hour (day kept), night ---------------- */
  const SKY = {
    day: { sky: ['#6fb6d7', '#b6dbea', '#f3e0b6'], sun: ['#f5ecc3', '#f0e3a5'], far: '#99bbaf', farPine: '#8baea2', lake: ['#8fcae0', '#62accf', '#4691c2'], ripple: '#fff', sand: '#e4cb9a', lawn: ['#a3ce79', '#77af5c'], edge: '#6ca153', cloud: '#fff', cloudShade: '#c4e0ec' },
    golden: { sky: ['#e8a371', '#ecc18f', '#f1daad'], sun: ['#f4e8be', '#e9be7c'], far: '#c1a18a', farPine: '#b69681', lake: ['#eec79a', '#77a8c4', '#5286b3'], ripple: '#f2e1b0', sand: '#e2c08f', lawn: ['#afc873', '#75a658'], edge: '#699651', cloud: '#f5dbc1', cloudShade: '#eebf9a' },
    night: { sky: ['#373b61', '#4f4c77', '#826589'], moon: true, far: '#585978', farPine: '#525273', lake: ['#69668e', '#474d75', '#3a4063'], ripple: '#ecd48d', sand: '#837c78', lawn: ['#5c795f', '#49614a'], edge: '#445e45', cloud: '#5c5d82', cloudShade: '#515073' }
  };
  function cloudC(x, y, sc, c1, c2) { return `<g transform="translate(${x} ${y}) scale(${sc || 1})"><path d="M-30 0Q-34 -12 -20 -13Q-18 -26 -2 -24Q8 -34 20 -22Q34 -24 32 -8Q40 -2 30 0Z" fill="${c1}"/><path d="M-28 -1Q0 4 30 -1" stroke="${c2}" stroke-width="5" fill="none" stroke-linecap="round"/></g>`; }
  /* The Bay Beach backdrop. o = { w, h, hz (horizon y), shore (beach y), mode: 'day'|'golden'|'night', id (unique per page),
     clouds: [[x,y,scale]], ship: [x,y,s], sail: [x,y,s], sunX, sunY }. Draw structures on top with light(). */
  function scene(o) {
    const W = o.w, Hh = o.h, hz = o.hz, m = SKY[o.mode || 'day'], id = o.id || 'sc';
    let s = `<defs>
      <linearGradient id="${id}-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${m.sky[0]}"/><stop offset=".72" stop-color="${m.sky[1]}"/><stop offset="1" stop-color="${m.sky[2]}"/></linearGradient>
      <linearGradient id="${id}-lake" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${m.lake[0]}"/><stop offset=".35" stop-color="${m.lake[1]}"/><stop offset="1" stop-color="${m.lake[2]}"/></linearGradient>
      <linearGradient id="${id}-lawn" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${m.lawn[0]}"/><stop offset="1" stop-color="${m.lawn[1]}"/></linearGradient>
      <radialGradient id="${id}-sun" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="${m.sun ? m.sun[0] : '#fff'}"/><stop offset=".4" stop-color="${m.sun ? m.sun[1] : '#fff'}" stop-opacity=".8"/><stop offset="1" stop-color="${m.sun ? m.sun[1] : '#fff'}" stop-opacity="0"/></radialGradient>
    </defs>`;
    s += `<rect width="${W}" height="${Hh}" fill="url(#${id}-sky)"/>`;
    if (m.moon) {
      for (let i = 0; i < 40; i++) { const x = (i * 83 + 17) % W, y = 8 + ((i * 47) % Math.max(20, hz - 30)); s += `<circle cx="${x}" cy="${y}" r="${i % 5 ? 0.9 : 1.6}" fill="#fff" opacity="${i % 3 ? 0.6 : 0.95}"/>`; }
      s += `<circle cx="${o.sunX || W * 0.8}" cy="${o.sunY || hz - 120}" r="34" fill="#f3e6b9" opacity=".18"/><path d="M${(o.sunX || W * 0.8) - 2} ${(o.sunY || hz - 120) - 15}a15 15 0 1 0 12 24a12 12 0 0 1 -12 -24z" fill="#f2e3b1"/>`;
    } else {
      const sy = o.mode === 'golden' ? hz - 26 : (o.sunY || hz - 120);
      s += `<circle cx="${o.sunX || W * 0.82}" cy="${sy}" r="${o.mode === 'golden' ? 110 : 70}" fill="url(#${id}-sun)"/>`;
      if (o.mode === 'golden') s += `<circle cx="${o.sunX || W * 0.82}" cy="${sy}" r="22" fill="#f3e4b4"/>`;
    }
    s += (o.clouds || []).map((c) => cloudC(c[0], c[1], c[2], m.cloud, m.cloudShade)).join('');
    s += `<path d="M0 ${hz - 6}Q${W * 0.18} ${hz - 16} ${W * 0.36} ${hz - 8}T${W * 0.7} ${hz - 9}T${W} ${hz - 12}V${hz + 2}H0Z" fill="${m.far}"/>`;
    for (let x = 8; x < W; x += 13) s += farPine(x, hz - 2 - ((x * 7) % 5), 0.32 + ((x * 3) % 4) * 0.04, m.farPine);
    s += `<rect y="${hz}" width="${W}" height="${o.shore - hz + 4}" fill="url(#${id}-lake)"/>`;
    for (let i = 0; i < 16; i++) { const x = (i * 97) % W, y = hz + 8 + ((i * 37) % Math.max(6, o.shore - hz - 14)); s += `<path d="M${x} ${y}h${10 + (i % 3) * 6}" stroke="${m.ripple}" stroke-width="1.6" stroke-linecap="round" opacity="${o.mode === 'night' ? 0.35 : 0.55}"/>`; }
    if (o.ship) s += `<g${o.mode === 'night' ? ' opacity=".55"' : ''}>${freighter(o.ship[0], o.ship[1], o.ship[2])}</g>` + (o.mode === 'night' ? `<g class="bulb"><circle cx="${o.ship[0] - 35 * o.ship[2]}" cy="${o.ship[1] - 12 * o.ship[2]}" r="1.6" fill="#ecd48d"/><circle cx="${o.ship[0] + 36 * o.ship[2]}" cy="${o.ship[1] - 11 * o.ship[2]}" r="1.6" fill="#ecd48d"/></g>` : '');
    if (o.sail) s += sail(o.sail[0], o.sail[1], o.sail[2]);
    s += `<path d="M0 ${o.shore}Q${W * 0.5} ${o.shore - 6} ${W} ${o.shore}V${o.shore + 10}H0Z" fill="${m.sand}"/>`;
    s += `<path d="M0 ${o.shore + 7}Q${W * 0.5} ${o.shore + 1} ${W} ${o.shore + 7}V${Hh}H0Z" fill="url(#${id}-lawn)"/>`;
    s += `<path d="M0 ${o.shore + 7}Q${W * 0.5} ${o.shore + 1} ${W} ${o.shore + 7}" fill="none" stroke="${m.edge}" stroke-width="2"/>`;
    return s;
  }
  /* Wrap structures (rides, pavilion, trees) so one drawing serves every sky: tinted/dimmed copy, then a copy where
     only class="bulb" things show, at full brightness, on top. */
  function light(markup, mode) {
    if (!mode || mode === 'day') return markup;
    return `<g class="lt-base lt-${mode}">${markup}</g><g class="lt-only" aria-hidden="true">${markup}</g>`;
  }

  /* ---------------- icons (64 grid, same ink/stroke as the app's SYM set) ---------------- */
  const ICON = {
    jar: `<svg viewBox="0 0 64 64"><g stroke="${INK}" stroke-width="3" stroke-linejoin="round"><rect x="20" y="6" width="24" height="8" rx="2" fill="${C.red}"/><path d="M18 14H46V20Q54 24 54 34V50Q54 58 46 58H18Q10 58 10 50V34Q10 24 18 20Z" fill="#cae7ed"/></g><path d="M32 24L35 32L43 35L35 38L32 46L29 38L21 35L29 32Z" fill="${'#7bd4e0'}" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/><path d="M16 30Q16 24 21 22" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round"/></svg>`,
    chest: `<svg viewBox="0 0 64 64"><g stroke="${INK}" stroke-width="3" stroke-linejoin="round"><path d="M8 30H56V54Q56 58 52 58H12Q8 58 8 54Z" fill="#b58557"/><path d="M8 30Q8 10 32 10Q56 10 56 30Z" fill="#c59361"/><path d="M8 30H56" /><rect x="14" y="10" width="7" height="48" fill="${C.gold}" stroke-width="2.4"/><rect x="43" y="10" width="7" height="48" fill="${C.gold}" stroke-width="2.4"/><rect x="26" y="25" width="12" height="13" rx="2" fill="${C.gold}"/></g><circle cx="32" cy="31" r="2" fill="${INK}"/><path d="M14 22Q17 15 24 13" stroke="#e2bd8f" stroke-width="3" fill="none" stroke-linecap="round"/></svg>`,
    book: `<svg viewBox="0 0 64 64"><g stroke="${INK}" stroke-width="3" stroke-linejoin="round"><path d="M10 12Q20 8 31 13V56Q20 51 10 55Z" fill="${C.grape}"/><path d="M54 12Q44 8 33 13V56Q44 51 54 55Z" fill="${C.grape2}"/></g><circle cx="21" cy="30" r="7" fill="${C.gold}" stroke="${INK}" stroke-width="2.2"/><path d="M42 24l2 4 4.4.6-3.2 3 .8 4.4-4-2.1-4 2.1.8-4.4-3.2-3 4.4-.6z" fill="${C.gold}" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round"/></svg>`,
    trophy: `<svg viewBox="0 0 64 64"><g stroke="${INK}" stroke-width="3" stroke-linejoin="round"><path d="M18 10H46V24Q46 38 32 40Q18 38 18 24Z" fill="${C.gold}"/><path d="M18 14H10Q9 28 20 30M46 14H54Q55 28 44 30" fill="none"/><rect x="28" y="40" width="8" height="8" fill="${C.gold2}"/><rect x="18" y="48" width="28" height="9" rx="2" fill="${C.red}"/></g><path d="M24 15V25" stroke="#f2e6af" stroke-width="3.4" stroke-linecap="round"/></svg>`,
    goals: `<svg viewBox="0 0 64 64"><g stroke="${INK}" stroke-width="3" stroke-linejoin="round"><rect x="12" y="8" width="40" height="50" rx="5" fill="${C.cream}"/><rect x="22" y="4" width="20" height="9" rx="3" fill="${C.red}"/></g><g stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"><circle cx="22" cy="24" r="5" fill="${C.go}"/><circle cx="22" cy="38" r="5" fill="${C.go}"/><circle cx="22" cy="51" r="4" fill="#fff"/></g><path d="M30 24H44M30 38H44M30 51H40" stroke="${INK}" stroke-width="3" stroke-linecap="round"/></svg>`,
    slot: `<svg viewBox="0 0 64 64"><g stroke="${INK}" stroke-width="3" stroke-linejoin="round"><rect x="8" y="14" width="42" height="42" rx="7" fill="${C.red}"/><path d="M10 14Q29 2 48 14Z" fill="${C.gold}"/><rect x="13" y="24" width="32" height="20" rx="3" fill="#fff"/><path d="M50 28H55V16" fill="none"/><circle cx="55" cy="13" r="4.4" fill="${C.gold}"/></g><path d="M23.7 24V44M34.3 24V44" stroke="${INK}" stroke-width="2"/><circle cx="18.5" cy="34" r="3" fill="${C.gold}" stroke="${INK}" stroke-width="1.6"/><circle cx="29" cy="34" r="3" fill="${C.gold}" stroke="${INK}" stroke-width="1.6"/><circle cx="39.5" cy="34" r="3" fill="${C.gold}" stroke="${INK}" stroke-width="1.6"/></svg>`,
    wheel: `<svg viewBox="0 0 64 64"><g stroke="${INK}" stroke-linejoin="round" stroke-linecap="round"><path d="M32 28L16 58M32 28L48 58" stroke-width="7"/><path d="M32 28L16 58M32 28L48 58" stroke="${C.lake}" stroke-width="3.4"/><circle cx="32" cy="28" r="21" fill="#fff" fill-opacity=".001" stroke-width="7"/><circle cx="32" cy="28" r="21" fill="none" stroke="#fff" stroke-width="3"/><path d="M32 7V49M11 28H53M17 13L47 43M47 13L17 43" stroke-width="1.6"/></g>${[0, 1, 2, 3, 4, 5, 6, 7].map((k) => { const a = (k * Math.PI) / 4; return `<rect x="${r1(32 + 21 * Math.cos(a) - 4)}" y="${r1(28 + 21 * Math.sin(a) - 2)}" width="8" height="7" rx="2" fill="${C.red}" stroke="${INK}" stroke-width="1.6"/>`; }).join('')}<circle cx="32" cy="28" r="5" fill="${C.gold}" stroke="${INK}" stroke-width="2.2"/></svg>`
  };

  /* Storm damage, gently: a tarp, puddles and a "back tomorrow" sign; never wreckage. The next kept day
     takes the tarp off. */
  function storm(kind) {
    let s = staged(kind, 3);
    s += `<path d="M-60 -60L-72 0M60 -60L72 0" stroke="${INK}" stroke-width="1.2"/>`;
    s += `<path d="M-68 -64Q-52 -102 0 -110Q52 -102 68 -64L60 -55Q30 -62 0 -57Q-30 -62 -60 -55Z" fill="#6791c0" ${K(2.2)}/>`;
    s += `<path d="M-40 -64Q-30 -90 -8 -102M14 -100Q34 -88 42 -62M-10 -60Q-2 -84 4 -106" fill="none" stroke="#5277a4" stroke-width="2"/><path d="M-50 -74Q-40 -92 -20 -100" fill="none" stroke="#96bde5" stroke-width="2.4" stroke-linecap="round"/>`;
    s += `<ellipse cx="-34" cy="2" rx="16" ry="3.6" fill="#a0cfe6" stroke="#6496b9" stroke-width="1.2"/><ellipse cx="40" cy="4" rx="11" ry="2.8" fill="#a0cfe6" stroke="#6496b9" stroke-width="1.2"/>`;
    s += sign(-2, 6, 'BACK', 'tomorrow');
    s += `<g transform="translate(46 -126)"><path d="M-22 0Q-26 -10 -14 -11Q-12 -22 1 -20Q9 -28 18 -18Q28 -18 26 -6Q30 0 22 0Z" fill="#d7dbdf" ${K(2)}/>` +
      `<path d="M-12 6l-2 6M0 6l-2 6M12 6l-2 6" stroke="#6496b9" stroke-width="2.4" stroke-linecap="round"/></g>`;
    return s;
  }

  /* =====================================================================================================
     v2 components. HTML helpers return strings with absolute positions (style), meant for a .screen root.
     SYM (coin, bolt=ticket, shield=rain check, hammer, dig, bag) and GOB_ART come from app-art.js.
     ===================================================================================================== */
  const S_ = () => window.SYM;
  const px = (o) => Object.entries(o || {}).map(([k, v]) => `${k}:${typeof v === 'number' ? v + 'px' : v}`).join(';');
  ICON.bulb = `<svg viewBox="0 0 32 32"><path d="M16 3a9 9 0 0 0-5 16.5V23h10v-3.5A9 9 0 0 0 16 3z" fill="#e6c966" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/><path d="M11.5 23h9v3.2a2 2 0 0 1-2 2h-5a2 2 0 0 1-2-2z" fill="#c3c5c6" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/><path d="M12 10a5 5 0 0 1 4-3.4" stroke="#f5ecc3" stroke-width="2.4" fill="none" stroke-linecap="round"/></svg>`;
  ICON.menu = `<svg viewBox="0 0 24 24" width="20" height="20"><path d="M4 7h16M4 12h16M4 17h16" stroke="${INK}" stroke-width="2.8" stroke-linecap="round"/></svg>`;
  ICON.auto = `<svg viewBox="0 0 24 24"><path d="M19 8.5A7.5 7.5 0 1 0 19.5 15" fill="none" stroke="${INK}" stroke-width="2.8" stroke-linecap="round"/><path d="M20.5 3.5v5.5H15" fill="none" stroke="${INK}" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  ICON.ring = (pct) => { const R = 22, c = 2 * Math.PI * R, d = r1(c * Math.max(0, Math.min(1, pct))); return `<svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="${R}" fill="#f5e6c4" stroke="${INK}" stroke-width="12"/><circle cx="32" cy="32" r="${R}" fill="none" stroke="#dccaa6" stroke-width="7"/><circle cx="32" cy="32" r="${R}" fill="none" stroke="${C.go}" stroke-width="7" stroke-dasharray="${d} ${r1(c)}" transform="rotate(-90 32 32)" stroke-linecap="round"/><path d="M23 33l6 6 12-13" fill="none" stroke="${INK}" stroke-width="4.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`; };
  const nest = (svg, x, y, w, ex) => svg.replace('<svg ', `<svg x="${r1(x)}" y="${r1(y)}" width="${r1(w)}" height="${r1(w)}" ${ex || ''} `);
  const coinAt = (x, y, w, rot) => nest(S_().coin, x - w / 2, y - w / 2, w, rot ? `transform="rotate(${rot} ${x} ${y})"` : '');

  function statusBar(o) {
    o = o || {}; const f = o.dark ? INK : '#fff';
    return `<div class="status${o.se ? ' se' : ''}${o.dark ? ' dark' : ''}"><span>${o.se ? '' : '9:41'}</span>${o.se ? '<span>9:41</span>' : ''}<span class="r"><svg width="18" height="11" viewBox="0 0 18 11"><rect x="0" y="7" width="3" height="4" rx="1" fill="${f}"/><rect x="5" y="5" width="3" height="6" rx="1" fill="${f}"/><rect x="10" y="2.5" width="3" height="8.5" rx="1" fill="${f}"/><rect x="15" y="0" width="3" height="11" rx="1" fill="${f}"/></svg><svg width="26" height="12" viewBox="0 0 26 12"><rect x=".5" y=".5" width="22" height="11" rx="3" fill="none" stroke="${f}" opacity=".7"/><rect x="2" y="2" width="17" height="8" rx="1.6" fill="${f}"/><rect x="23.5" y="4" width="2" height="4" rx="1" fill="${f}" opacity=".7"/></svg></span></div>`;
  }
  /* HUD v2: coins · spins · "6 days" + rain checks · menu (or Done in full-screen places). */
  function hud(o) {
    o = o || {}; const rc = o.rain || [1, 1, 0];
    const left = o.done ? `<span class="done-btn">Done</span>` : '';
    const right = o.done ? '' : `<span class="menu" aria-label="Menu">${ICON.menu}</span>`;
    return `<div class="hud${o.se ? ' se' : ''}">${left}
      <div class="hp coins"><span class="i">${S_().coin}</span><span class="n ol">${o.coins}</span>${o.plus ? `<span class="plus ol">${o.plus}</span>` : ''}</div>
      ${o.done ? '' : `<div class="hp spins"><span class="i">${S_().bolt}</span><span class="n ol">${o.spins}</span>${o.splus ? `<span class="plus ol">${o.splus}</span>` : ''}</div>`}
      ${o.done ? '' : `<div class="hp streak"><span class="i">${ICON.bulb}</span><span class="n ol">${o.streak}</span><span class="u">days</span><span class="rc">${rc.map((x) => `<span class="${x ? '' : 'off'}">${S_().shield}</span>`).join('')}</span></div>`}
      ${right}</div>`;
  }
  function tabBar(active, o) {
    o = o || {};
    const T = o.five ? [['spin', 'Spin', ICON.slot], ['goals', 'Goals', ICON.ring(o.goalsPct || 0)], ['park', 'Park', ICON.wheel], ['stickers', 'Stickers', ICON.book], ['progress', 'Progress', ICON.trophy]]
      : [['spin', 'Spin', ICON.slot], ['goals', 'Goals', ICON.ring(o.goalsPct || 0)], ['stickers', 'Stickers', ICON.book], ['progress', 'Progress', ICON.trophy]];
    return `<nav class="tabs${o.five ? ' five' : ''}${o.se ? ' se' : ''}">${T.map(([k, l, ic]) => `<div class="tab ${k}${k === active ? ' on' : ''}"><span class="ti">${ic}</span><span class="tl">${l}</span></div>`).join('')}</nav>${o.se ? '' : '<div class="homebar"></div>'}`;
  }
  /* Today tray: 5 + 4 bulbs (the Big Wheel's strings), one line, the next two open goals as one-tap buttons. */
  function todayTray(o) {
    const b = (n0, n1, lit) => Array.from({ length: n1 - n0 }, (_, i) => `<i class="${n0 + i < lit ? 'on' : ''}"></i>`).join('');
    const ck = (g) => g.done ? `<span class="ck" style="border:2.5px solid ${INK};background:radial-gradient(circle at 38% 30%,#abdc86,#7dc05d 55%,#56a64a);display:grid;place-items:center"><svg width="16" height="16" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg></span>` : `<span class="ck"></span>`;
    return `<div class="today panel" style="${px(o.pos)}">
      <div class="top"><span class="lbl">TODAY</span><span class="bulbs">${b(0, 5, o.lit)}<b></b>${b(5, 9, o.lit)}</span><span class="all">All ${o.all || 9} ›</span></div>
      <div class="line">${o.line}</div>
      ${o.goals && o.goals.length ? `<div class="gs">${o.goals.map((g) => `<div class="gbtn">${ck(g)}<span class="nm">${g.name}</span><span class="chip">${S_().bolt.replace('<svg ', '<svg width="16" height="16" ')}<span>+${g.plus || 12}</span></span></div>`).join('')}</div>` : ''}
    </div>`;
  }
  function betChips(o) {
    return `<div class="bet" style="${px(o.pos)}"><span class="bl">BET</span><span class="row">${o.opts.map((t, i) => `<span class="bchip${i === o.sel ? ' sel' : ''}"><span>${t}</span></span>`).join('')}</span></div>`;
  }
  function autoBtn(o) { return `<div class="auto" style="${px(o.pos)}">${ICON.auto}<span>AUTO</span></div>`; }
  const RIBBON = (w) => `<svg viewBox="0 0 300 42" preserveAspectRatio="none"><g stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"><path d="M8 12H40V40H8L18 26Z" fill="#c34e51"/><path d="M292 12H260V40H292L282 26Z" fill="#c34e51"/><path d="M30 34L40 40V34Z" fill="#9c3c40"/><path d="M270 34L260 40V34Z" fill="#9c3c40"/><path d="M30 4H270V34H30Z" fill="#d9675c"/></g><path d="M36 9H264" stroke="#ec968b" stroke-width="3" stroke-linecap="round"/></svg>`;
  const STAR = `<svg viewBox="0 0 24 24"><path d="M12 2.2l2.9 6.1 6.7.9-4.9 4.6 1.3 6.6L12 17.2l-6 3.2 1.3-6.6-4.9-4.6 6.7-.9z" fill="#e3be54" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/></svg>`;
  function phaseRibbon(o) {
    return `<div class="phase" style="${px({ top: o.top })}">${o.tag ? `<span class="tag" style="margin-bottom:-5px;position:relative;z-index:2">${o.tag}</span>` : ''}<div class="ribbon">${RIBBON()}<span class="t ol2">${o.name}</span></div>
      <div class="sbar">${STAR}<span class="track"><i style="width:${Math.round((o.n / o.of) * 100)}%"></i></span><span class="ct">${o.n}/${o.of}</span></div></div>`;
  }
  /* Fix-up button with its progress ring. pct of the next fix-up's cost; afford = full, green, shining. */
  function fixRing(o) {
    const R = 31, c = 2 * Math.PI * R, d = r1(c * Math.min(1, o.pct));
    const face = o.afford ? `<circle cx="35" cy="35" r="24" fill="url(#fxg-${o.id || 'a'})" stroke="${INK}" stroke-width="2.6"/><ellipse cx="33" cy="24" rx="14" ry="6" fill="#fff" opacity=".5"/>`
      : `<circle cx="35" cy="35" r="24" fill="#f5e6c4" stroke="${INK}" stroke-width="2.6"/>`;
    return `<div class="fixring" style="${px(o.pos)}"><div class="rg"><svg viewBox="0 0 70 70">
      <defs><radialGradient id="fxg-${o.id || 'a'}" cx=".4" cy=".3" r=".75"><stop offset="0" stop-color="#b6e190"/><stop offset=".5" stop-color="#7dc05d"/><stop offset="1" stop-color="#56a64a"/></radialGradient></defs>
      <circle cx="35" cy="35" r="${R}" fill="#405981" stroke="${INK}" stroke-width="2.6"/>
      <circle cx="35" cy="35" r="${R}" fill="none" stroke="${o.afford ? C.go : C.gold}" stroke-width="6" stroke-dasharray="${d} ${r1(c)}" transform="rotate(-90 35 35)" stroke-linecap="round"/>
      ${face}${nest(S_().hammer, 17, 17, 36)}
      ${o.afford ? `<path d="M60 8l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="#efe2a0" stroke="${INK}" stroke-width="1.4" stroke-linejoin="round"/>` : ''}
      </svg></div><span class="label">${o.name} · ${o.cost}</span></div>`;
  }
  /* A small stack of chests waiting (wood on silver), no number: tap to open. */
  function chestStack(o) {
    const ch = (x, y, s, body, lid, band) => `<g transform="translate(${x} ${y}) scale(${s})"><g stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"><path d="M-20 0H20V-16H-20Z" fill="${body}"/><path d="M-20 -16Q-20 -30 0 -30Q20 -30 20 -16Z" fill="${lid}"/><path d="M-13 -30V0M13 -30V0" stroke-width="2"/></g><path d="M-13 -29V-1M13 -29V-1" stroke="${band}" stroke-width="3.4"/><rect x="-5" y="-21" width="10" height="9" rx="2" fill="${band}" stroke="${INK}" stroke-width="2"/><path d="M-15 -22Q-13 -27 -7 -28" stroke="#fff" stroke-width="2" fill="none" opacity=".6" stroke-linecap="round"/></g>`;
    return `<div class="obj" style="${px(o.pos)}"><svg width="56" height="52" viewBox="-28 -50 56 52"><ellipse cx="0" cy="0" rx="26" ry="4" fill="rgba(43,26,16,.25)"/>${ch(0, 0, 1, '#a6b1bc', '#bec7d0', '#e3be54')}${ch(-3, -24, 0.82, '#b58557', '#c59361', '#e3be54')}</svg><span class="label">Chests</span></div>`;
  }
  function labelAt(text, pos) { return `<span class="label" style="position:absolute;z-index:22;${px(pos)};transform:translateX(-50%)">${text}</span>`; }
  function stillArrow(x, y) { return `<svg class="still-arrow" style="left:${x}px;top:${y}px" viewBox="0 0 30 34"><path d="M8 2H22V16H28L15 31L2 16H8Z" fill="#7dc05d" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/><path d="M11 5V15" stroke="#cdefb1" stroke-width="2.6" stroke-linecap="round"/></svg>`; }

  /* Boardwalk planks from y0 to y1 across w. */
  function planks(w, y0, y1, id) {
    let s = `<defs><linearGradient id="${id || 'pl'}-sh" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7a5230" stop-opacity=".38"/><stop offset="1" stop-color="#7a5230" stop-opacity="0"/></linearGradient></defs>`;
    for (let y = y0, i = 0; y < y1; y += 24, i++) {
      s += `<rect x="0" y="${y}" width="${w}" height="24" fill="${i % 2 ? '#cda172' : '#d6ac7c'}"/><path d="M0 ${y}H${w}" stroke="#a8794e" stroke-width="2"/>`;
      for (let x = (i % 2 ? 40 : 110); x < w; x += 150) s += `<path d="M${x} ${y}V${y + 24}" stroke="#a8794e" stroke-width="1.6"/><circle cx="${x - 6}" cy="${y + 6}" r="1.4" fill="#986c47"/><circle cx="${x + 6}" cy="${y + 18}" r="1.4" fill="#986c47"/>`;
    }
    return s + `<rect x="0" y="${y0}" width="${w}" height="70" fill="url(#${id || 'pl'}-sh)"/>`;
  }

  /* The ticket-booth slot machine. o = { x, y (canopy top), w, reelH, syms: [[above,mid,below] x3], chase: 'idle'|'fast'|'all'|'off',
     tease (reel 3 slow + gold rim), win (glow + win line), marquee: text, plate: { icon: 'coin'|'shrug'|'none', html }, id }.
     Returns { svg, bottom }. Honest reels: chase 'fast' and tease only when the first two reels show jackpot bags. */
  function machine(o) {
    const x = o.x, y = o.y, W = o.w, cx = x + W / 2, id = o.id || 'm', rh = o.reelH || 88;
    const mqW = Math.round(W * 0.66), mqH = o.compact ? 36 : 40, mqTop = y + 12, mqBot = mqTop + mqH;
    const winTop = mqBot + 8, winH = rh + 14, winBot = winTop + winH, plTop = winBot + 6, plH = 24, plBot = plTop + plH;
    const apTop = plBot + 5, cabBot = apTop + 12, cabTop = y + 36;
    let m = `<defs>
      <radialGradient id="${id}-glow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#efe2a0" stop-opacity=".95"/><stop offset="1" stop-color="#e3be54" stop-opacity="0"/></radialGradient>
      <linearGradient id="${id}-bez" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#efe2a0"/><stop offset=".5" stop-color="#e3be54"/><stop offset="1" stop-color="#d2932e"/></linearGradient>
      <linearGradient id="${id}-cab" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d9675c"/><stop offset="1" stop-color="#bd494b"/></linearGradient>
      <linearGradient id="${id}-reel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c3b192"/><stop offset=".2" stop-color="#f7edd0"/><stop offset=".8" stop-color="#f7edd0"/><stop offset="1" stop-color="#c3b192"/></linearGradient>
      <linearGradient id="${id}-mq" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#516997"/><stop offset="1" stop-color="#3d517d"/></linearGradient>
      <linearGradient id="${id}-rT" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#84663a" stop-opacity=".45"/><stop offset="1" stop-color="#84663a" stop-opacity="0"/></linearGradient>
      <linearGradient id="${id}-rB" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#84663a" stop-opacity=".45"/><stop offset="1" stop-color="#84663a" stop-opacity="0"/></linearGradient>
      <clipPath id="${id}-clip"><rect x="${x + 25}" y="${winTop + 7}" width="${W - 50}" height="${rh}" rx="9"/></clipPath>
      <pattern id="${id}-tw" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(35)"><rect width="10" height="10" fill="#e3be54"/><rect width="4.5" height="10" fill="#d9675c"/></pattern>
    </defs>`;
    m += `<ellipse cx="${cx}" cy="${cabBot + 8}" rx="${W / 2}" ry="11" fill="rgba(60,25,5,.3)"/>`;
    m += `<rect x="${x + 14}" y="${cabTop}" width="${W - 28}" height="${cabBot - cabTop}" rx="14" fill="url(#${id}-cab)" stroke="${INK}" stroke-width="3"/>`;
    const n = 13, sw = (W - 28) / n;
    for (let i = 0; i < n; i++) m += `<path d="M${r1(x + 14 + i * sw)} ${apTop + 8}a${r1(sw / 2)} 9 0 0 0 ${r1(sw)} 0V${apTop}H${r1(x + 14 + i * sw)}Z" fill="${i % 2 ? '#f5e6c4' : '#d9675c'}" stroke="${INK}" stroke-width="2"/>`;
    m += `<path d="M${x + 14} ${apTop}H${x + W - 14}" stroke="${INK}" stroke-width="2.4"/>`;
    for (const px0 of [x, x + W - 20]) m += `<rect x="${px0}" y="${y + 26}" width="20" height="${cabBot - y - 22}" rx="6" fill="url(#${id}-tw)" stroke="${INK}" stroke-width="3"/><path d="M${px0 + 5} ${y + 32}V${cabBot - 2}" stroke="#fff" stroke-width="2.4" opacity=".55" stroke-linecap="round"/><circle cx="${px0 + 10}" cy="${cabBot + 6}" r="10" fill="url(#${id}-bez)" stroke="${INK}" stroke-width="2.6"/>`;
    // reel window
    m += `<rect x="${x + 18}" y="${winTop}" width="${W - 36}" height="${winH}" rx="16" fill="${INK}"/><rect x="${x + 22}" y="${winTop + 4}" width="${W - 44}" height="${winH - 8}" rx="12" fill="none" stroke="url(#${id}-bez)" stroke-width="4"/>`;
    const gap = 6, rw = (W - 50 - 2 * gap) / 3, mid = winTop + 7 + rh / 2, sym = Math.min(66, rh * 0.72), off = rh * 0.68;
    let reels = '';
    o.syms.forEach((st, i) => {
      const rx = x + 25 + i * (rw + gap), rc = rx + rw / 2;
      reels += `<rect x="${r1(rx)}" y="${winTop + 7}" width="${r1(rw)}" height="${rh}" fill="url(#${id}-reel)"/>`;
      if (o.win) reels += `<circle cx="${r1(rc)}" cy="${mid}" r="${r1(sym * 0.62)}" fill="url(#${id}-glow)"/>`;
      if (o.tease && i === 2) {
        reels += `<g opacity=".55">${nest(S_()[st[0]], rc - sym * 0.45, mid - off - sym * 0.45 + 18, sym * 0.9)}${nest(S_()[st[1]], rc - sym * 0.45, mid - sym * 0.45 + 18, sym * 0.9)}</g>`;
        reels += `<path d="M${r1(rx + 10)} ${winTop + 12}V${winTop + rh}M${r1(rx + rw - 10)} ${winTop + 12}V${winTop + rh}" stroke="#cfc0a1" stroke-width="6" opacity=".7" stroke-linecap="round"/>`;
      } else {
        reels += nest(S_()[st[0]], rc - sym * 0.45, mid - off - sym * 0.45, sym * 0.9) + nest(S_()[st[1]], rc - sym / 2, mid - sym / 2, sym) + nest(S_()[st[2]], rc - sym * 0.45, mid + off - sym * 0.45, sym * 0.9);
      }
      if (i < 2) reels += `<rect x="${r1(rx + rw)}" y="${winTop + 7}" width="${gap}" height="${rh}" fill="${INK}"/>`;
    });
    m += `<g clip-path="url(#${id}-clip)">${reels}<rect x="${x + 25}" y="${winTop + 7}" width="${W - 50}" height="18" fill="url(#${id}-rT)"/><rect x="${x + 25}" y="${winTop + rh - 11}" width="${W - 50}" height="18" fill="url(#${id}-rB)"/></g>`;
    if (o.tease) { const rx = x + 25 + 2 * (rw + gap); m += `<rect x="${r1(rx - 2)}" y="${winTop + 5}" width="${r1(rw + 4)}" height="${rh + 4}" rx="9" fill="none" stroke="#e3be54" stroke-width="4"/><rect x="${r1(rx - 2)}" y="${winTop + 5}" width="${r1(rw + 4)}" height="${rh + 4}" rx="9" fill="none" stroke="#efe2a0" stroke-width="1.4"/>`; }
    if (o.win) m += `<rect x="${x + 20}" y="${mid - 4}" width="${W - 40}" height="8" rx="4" fill="#efe2a0" stroke="${INK}" stroke-width="2" opacity=".95"/>`;
    m += `<path d="M${x + 6} ${mid - 13}L${x + 24} ${mid}L${x + 6} ${mid + 13}Z" fill="#e3be54" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/><path d="M${x + W - 6} ${mid - 13}L${x + W - 24} ${mid}L${x + W - 6} ${mid + 13}Z" fill="#e3be54" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/>`;
    // result plate (ticket)
    const p0 = x + 52, p1 = x + W - 52, pm = plTop + plH / 2;
    m += `<path d="M${p0} ${plTop}H${p1}A8 8 0 0 0 ${p1} ${pm}A8 8 0 0 0 ${p1} ${plBot}H${p0}A8 8 0 0 0 ${p0} ${pm}A8 8 0 0 0 ${p0} ${plTop}Z" fill="#f5e6c4" stroke="${INK}" stroke-width="2.4"/>`;
    const pl = o.plate || {};
    const iconW = 20;
    let tx = cx;
    if (pl.icon === 'coin') { m += nest(S_().coin, cx - pl.tw / 2 - iconW - 4, pm - iconW / 2, iconW); tx = cx + iconW / 2; }
    if (pl.icon === 'shrug') { m += `<g transform="translate(${cx - pl.tw / 2 - 16} ${pm + 9}) scale(.26)">${shrugGoblin()}</g>`; tx = cx + 12; }
    m += `<text x="${tx}" y="${pm + 5.5}" text-anchor="middle" font-family="Nunito" font-weight="900" font-size="14.5" fill="${INK}">${pl.html || ''}</text>`;
    // canopy
    const ty = y, by = y + 24, tx0 = x + 60, tx1 = x + W - 60, bx0 = x - 2, bx1 = x + W + 2, N = 14;
    let can = '';
    for (let i = 0; i < N; i++) { const a = tx0 + (tx1 - tx0) * i / N, b = tx0 + (tx1 - tx0) * (i + 1) / N, c2 = bx0 + (bx1 - bx0) * (i + 1) / N, d = bx0 + (bx1 - bx0) * i / N; can += `<path d="M${r1(a)} ${ty}L${r1(b)} ${ty}L${r1(c2)} ${by}L${r1(d)} ${by}Z" fill="${i % 2 ? '#f5e6c4' : '#d9675c'}"/>`; }
    m += `<path d="M${tx0} ${ty}H${tx1}L${bx1} ${by}H${bx0}Z" fill="#f5e6c4"/>${can}<path d="M${tx0} ${ty}H${tx1}L${bx1} ${by}H${bx0}Z" fill="none" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>`;
    const vsw = (bx1 - bx0) / N; let vb = [];
    for (let i = 0; i < N; i++) { const vx = bx0 + i * vsw; m += `<path d="M${r1(vx)} ${by}a${r1(vsw / 2)} 9 0 0 0 ${r1(vsw)} 0Z" fill="${i % 2 ? '#d9675c' : '#f5e6c4'}" stroke="${INK}" stroke-width="2"/>`; vb.push([vx + vsw / 2, by + 5]); }
    const chase = o.chase || 'idle', lit = (k) => chase === 'all' || chase === 'fast' || (chase === 'idle' && k % 2 === 0);
    m += vb.map(([bx, byy], k) => (lit(k) ? `<circle cx="${r1(bx)}" cy="${byy}" r="4.6" fill="#efe2a0" opacity=".55"/>` : '') + `<circle cx="${r1(bx)}" cy="${byy}" r="2.2" fill="${lit(k) ? '#f5ecc3' : '#dbc8a0'}" stroke="${INK}" stroke-width="1"/>`).join('');
    // marquee
    const mx0 = cx - mqW / 2;
    m += `<rect x="${mx0}" y="${mqTop}" width="${mqW}" height="${mqH}" rx="15" fill="url(#${id}-mq)" stroke="${INK}" stroke-width="3"/><rect x="${mx0 + 6}" y="${mqTop + 6}" width="${mqW - 12}" height="${mqH - 12}" rx="10" fill="none" stroke="url(#${id}-bez)" stroke-width="3"/>`;
    const iw = mqW - 12, ih = mqH - 12, per = 2 * (iw + ih), NB = 30;
    for (let k = 0; k < NB; k++) {
      let d = (k / NB) * per, bx, byy;
      if (d < iw) { bx = mx0 + 6 + d; byy = mqTop + 6; } else if (d < iw + ih) { bx = mx0 + 6 + iw; byy = mqTop + 6 + (d - iw); } else if (d < 2 * iw + ih) { bx = mx0 + 6 + iw - (d - iw - ih); byy = mqTop + 6 + ih; } else { bx = mx0 + 6; byy = mqTop + 6 + ih - (d - 2 * iw - ih); }
      const on = chase === 'all' || (chase === 'fast' ? k % 3 !== 2 : chase === 'idle' ? k % 2 === 0 : false);
      m += (on ? `<circle cx="${r1(bx)}" cy="${r1(byy)}" r="5" fill="#efe2a0" opacity=".5"/>` : '') + `<circle cx="${r1(bx)}" cy="${r1(byy)}" r="2.4" fill="${on ? '#f5ecc3' : '#a99674'}" stroke="${INK}" stroke-width="1.1"/>`;
    }
    if (chase === 'fast') m += `<path d="M${mx0 + 14} ${mqTop - 6}l8 -4M${mx0 + 26} ${mqTop - 7}l8 -4M${mx0 + mqW - 34} ${mqTop - 7}l8 -4" stroke="#efe2a0" stroke-width="2.4" stroke-linecap="round"/>`;
    const mt = o.marquee || 'Daily Spin', fs = mt.length > 12 ? (o.compact ? 17 : 19) : (o.compact ? 22 : 25);
    m += `<text x="${cx + 1}" y="${mqTop + mqH / 2 + fs * 0.36 + 1.5}" text-anchor="middle" font-family="Shrikhand" font-size="${fs}" fill="#d2932e" stroke="${INK}" stroke-width="6" stroke-linejoin="round" paint-order="stroke">${mt}</text>`;
    m += `<text x="${cx}" y="${mqTop + mqH / 2 + fs * 0.36}" text-anchor="middle" font-family="Shrikhand" font-size="${fs}" fill="${chase === 'off' ? '#ddcfb3' : '#f2e3b1'}" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round" paint-order="stroke">${mt}</text>`;
    // star topper + pennants
    m += `<path d="M${cx} ${y - 22}l5.4 11 12.1 1.8-8.8 8.5 2.1 12-10.8-5.7-10.8 5.7 2.1-12-8.8-8.5 12.1-1.8z" fill="url(#${id}-bez)" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/>`;
    for (const [fx, f] of [[tx0, -1], [tx1, 1]]) m += `<path d="M${fx} ${ty}V${ty - 20}" stroke="${INK}" stroke-width="2.4"/><path d="M${fx} ${ty - 20}L${fx + 14 * f} ${ty - 16}L${fx} ${ty - 12}Z" fill="#57a5ca" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round"/><circle cx="${fx}" cy="${ty - 21}" r="2.6" fill="#e3be54" stroke="${INK}" stroke-width="1.4"/>`;
    return { svg: m, bottom: cabBot + 16, mid };
  }
  function shrugGoblin() {
    // a small Deep-Fry-green goblin head with both hands up: "no match"
    return `<g stroke="${INK}" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"><path d="M-40 -40Q-62 -48 -74 -60Q-62 -28 -36 -18Z" fill="#abc371"/><path d="M40 -40Q62 -48 74 -60Q62 -28 36 -18Z" fill="#abc371"/>
      <path d="M-42 -30C-42 -60 -24 -70 0 -70C24 -70 42 -60 42 -30C42 -6 24 6 0 6C-24 6 -42 -6 -42 -30Z" fill="#abc371"/>
      <circle cx="-62" cy="-8" r="10" fill="#abc371"/><circle cx="62" cy="-8" r="10" fill="#abc371"/></g>
      <path d="M-24 -34h12M12 -34h12" stroke="${INK}" stroke-width="5" stroke-linecap="round"/><path d="M-12 -14Q0 -8 12 -14" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>
      <ellipse cx="-26" cy="-20" rx="6" ry="4" fill="#e39e8e"/><ellipse cx="26" cy="-20" rx="6" ry="4" fill="#e39e8e"/>`;
  }
  /* Spin buttons. state: 'spin' | 'earn' (green "Earn spins ↓", never pulses) | 'done' (matte). Returns an absolutely placed <svg>. */
  function spinPill(o) {
    const w = o.w || 200, h = o.h || 72, st = o.state || 'spin', id = o.id || 'sp';
    const dome = st === 'earn' ? ['#b6e190', '#7dc05d', '#4b9542', '#44813b'] : st === 'done' ? ['#ebdcbe', '#e2d2b2', '#cfbd9b', '#b6a485'] : ['#ec9e8d', '#d9675c', '#ad3f41', '#903639'];
    const R = h / 2;
    let s = `<svg style="position:absolute;z-index:21;left:${o.cx - w / 2 - 8}px;top:${o.cy - h / 2 - 8}px" width="${w + 16}" height="${h + 24}" viewBox="${-w / 2 - 8} ${-h / 2 - 8} ${w + 16} ${h + 24}">
      <defs><radialGradient id="${id}-d" cx=".4" cy=".25" r=".9"><stop offset="0" stop-color="${dome[0]}"/><stop offset=".5" stop-color="${dome[1]}"/><stop offset="1" stop-color="${dome[2]}"/></radialGradient>
      <linearGradient id="${id}-b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#efe2a0"/><stop offset=".5" stop-color="#e3be54"/><stop offset="1" stop-color="#d2932e"/></linearGradient>
      <linearGradient id="${id}-g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".85"/><stop offset="1" stop-color="#fff" stop-opacity=".05"/></linearGradient></defs>
      <rect x="${-w / 2}" y="${-h / 2 + 6}" width="${w}" height="${h}" rx="${R}" fill="${INK}"/>
      <rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" rx="${R}" fill="${st === 'done' ? '#ddcfb3' : `url(#${id}-b)`}" stroke="${INK}" stroke-width="3"/>`;
    // bulbs around the edge
    const iw = w - 14, ih = h - 14, rr = ih / 2, per = 2 * (iw - 2 * rr) + 2 * Math.PI * rr, NB = 26;
    for (let k = 0; k < NB; k++) {
      let d = (k / NB) * per, bx, by; const L = iw - 2 * rr;
      if (d < L) { bx = -L / 2 + d; by = -rr; } else if (d < L + Math.PI * rr) { const a = -Math.PI / 2 + (d - L) / rr; bx = L / 2 + rr * Math.cos(a); by = rr * Math.sin(a); } else if (d < 2 * L + Math.PI * rr) { bx = L / 2 - (d - L - Math.PI * rr); by = rr; } else { const a = Math.PI / 2 + (d - 2 * L - Math.PI * rr) / rr; bx = -L / 2 + rr * Math.cos(a); by = rr * Math.sin(a); }
      const on = st === 'spin' && k % 2 === 0;
      s += (on ? `<circle cx="${r1(bx)}" cy="${r1(by)}" r="4.6" fill="#f5ecc3" opacity=".55"/>` : '') + `<circle cx="${r1(bx)}" cy="${r1(by)}" r="2.2" fill="${on ? '#f5ecc3' : st === 'done' ? '#c6b595' : '#c49c53'}" stroke="${INK}" stroke-width="1"/>`;
    }
    const iw2 = w - 26, ih2 = h - 26;
    s += `<rect x="${-iw2 / 2}" y="${-ih2 / 2 + 5}" width="${iw2}" height="${ih2}" rx="${ih2 / 2}" fill="${dome[3]}" stroke="${INK}" stroke-width="2.6"/>`;
    s += `<rect x="${-iw2 / 2}" y="${-ih2 / 2}" width="${iw2}" height="${ih2}" rx="${ih2 / 2}" fill="url(#${id}-d)" stroke="${INK}" stroke-width="2.6"/>`;
    if (st !== 'done') s += `<rect x="${-iw2 / 2 + 12}" y="${-ih2 / 2 + 3}" width="${iw2 - 24}" height="${ih2 * 0.36}" rx="${ih2 * 0.18}" fill="url(#${id}-g)"/>`;
    if (st === 'spin') s += `<text x="0" y="${h > 64 ? 6 : 8}" text-anchor="middle" font-family="Lilita One" font-size="${h > 64 ? 32 : 28}" fill="#fff" stroke="${INK}" stroke-width="6" stroke-linejoin="round" paint-order="stroke">SPIN</text>${h > 64 ? `<text x="0" y="20" text-anchor="middle" font-family="Nunito" font-weight="900" font-size="9" letter-spacing="1.2" fill="#f5cbc0">HOLD FOR AUTO</text>` : ''}`;
    if (st === 'earn') s += `<text x="0" y="${h > 64 ? 3 : 7}" text-anchor="middle" font-family="Lilita One" font-size="${h > 64 ? 25 : 22}" fill="#fff" stroke="${INK}" stroke-width="5.5" stroke-linejoin="round" paint-order="stroke">EARN SPINS ↓</text>${h > 64 ? `<text x="0" y="19" text-anchor="middle" font-family="Nunito" font-weight="900" font-size="9.5" letter-spacing=".8" fill="#d9f1c1">CHECK A GOAL BELOW</text>` : ''}`;
    if (st === 'done') s += `<text x="0" y="7" text-anchor="middle" font-family="Lilita One" font-size="21" fill="#968367">Done for today</text>`;
    return s + `</svg>`;
  }
  function spinRound(o) {
    const r = o.r || 52, id = o.id || 'sr', st = o.state || 'spin';
    let s = `<svg style="position:absolute;z-index:21;left:${o.cx - r - 10}px;top:${o.cy - r - 10}px" width="${2 * r + 20}" height="${2 * r + 30}" viewBox="${-r - 10} ${-r - 10} ${2 * r + 20} ${2 * r + 30}">
      <defs><radialGradient id="${id}-d" cx=".38" cy=".3" r=".75"><stop offset="0" stop-color="#ec9e8d"/><stop offset=".45" stop-color="#d9675c"/><stop offset="1" stop-color="#ad3f41"/></radialGradient>
      <linearGradient id="${id}-b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#efe2a0"/><stop offset=".5" stop-color="#e3be54"/><stop offset="1" stop-color="#d2932e"/></linearGradient>
      <linearGradient id="${id}-g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".85"/><stop offset="1" stop-color="#fff" stop-opacity=".05"/></linearGradient></defs>
      <circle cy="6" r="${r}" fill="${INK}"/><circle r="${r}" fill="url(#${id}-b)" stroke="${INK}" stroke-width="3"/>`;
    for (let k = 0; k < 18; k++) { const a = (k / 18) * Math.PI * 2 - Math.PI / 2, bx = (r - 7.5) * Math.cos(a), by = (r - 7.5) * Math.sin(a), on = k % 2 === 0; s += (on ? `<circle cx="${r1(bx)}" cy="${r1(by)}" r="4.8" fill="#f5ecc3" opacity=".55"/>` : '') + `<circle cx="${r1(bx)}" cy="${r1(by)}" r="2.3" fill="${on ? '#f5ecc3' : '#c49c53'}" stroke="${INK}" stroke-width="1"/>`; }
    const ir = r - 15;
    s += `<circle cy="6" r="${ir}" fill="#903639" stroke="${INK}" stroke-width="2.6"/><circle r="${ir}" fill="url(#${id}-d)" stroke="${INK}" stroke-width="2.6"/><ellipse cx="-2" cy="${-ir * 0.52}" rx="${ir * 0.62}" ry="${ir * 0.3}" fill="url(#${id}-g)"/>`;
    s += `<text x="0" y="${ir * 0.22}" text-anchor="middle" font-family="Lilita One" font-size="${Math.round(ir * 0.62)}" fill="#fff" stroke="${INK}" stroke-width="6" stroke-linejoin="round" paint-order="stroke">SPIN</text>`;
    s += `<text x="0" y="${ir * 0.62}" text-anchor="middle" font-family="Nunito" font-weight="900" font-size="8" letter-spacing="1" fill="#f5cbc0">HOLD: AUTO</text>`;
    return s + `</svg>`;
  }

  /* ---------------- moments ---------------- */
  function sunburst(cx, cy, n, color, op, R) {
    let r = ''; R = R || 700;
    for (let i = 0; i < n; i++) { const a0 = (i / n) * Math.PI * 2, a1 = ((i + 0.5) / n) * Math.PI * 2; r += `<path d="M${cx} ${cy}L${r1(cx + R * Math.cos(a0))} ${r1(cy + R * Math.sin(a0))}L${r1(cx + R * Math.cos(a1))} ${r1(cy + R * Math.sin(a1))}Z"/>`; }
    return `<g fill="${color || '#efe2a0'}" opacity="${op == null ? 0.5 : op}">${r}</g>`;
  }
  function confetti(list) { return list.map(([x, y, c, r]) => `<rect x="${x}" y="${y}" width="9" height="14" rx="2" fill="${c}" stroke="${INK}" stroke-width="1.6" transform="rotate(${r} ${x} ${y})"/>`).join(''); }
  function sparkle(x, y, r, c) { return `<path d="M${x} ${y - r}Q${x} ${y} ${x + r} ${y}Q${x} ${y} ${x} ${y + r}Q${x} ${y} ${x - r} ${y}Q${x} ${y} ${x} ${y - r}Z" fill="${c || '#efe2a0'}" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/>`; }
  /* The high striker tower: origin = base centre, h tall. o.puck 0..1 (height reached), o.ring (bell rings), o.marks [[frac,label]] */
  function striker(o) {
    const h = o.h || 380, W = 46, top = -h, id = o.id || 'st';
    let s = `<defs><linearGradient id="${id}-tw" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#c34e51"/><stop offset=".5" stop-color="#d9675c"/><stop offset="1" stop-color="#c34e51"/></linearGradient></defs>`;
    s += `<ellipse cx="0" cy="2" rx="80" ry="10" fill="rgba(43,26,16,.3)"/>`;
    // base box + lever pad
    s += `<rect x="-58" y="-34" width="116" height="34" rx="6" fill="#516997" stroke="${INK}" stroke-width="3"/><path d="M-52 -26H52" stroke="#e3be54" stroke-width="3"/>`;
    s += `<text x="0" y="-9" text-anchor="middle" font-family="Lilita One" font-size="15" fill="#f2e3b1" stroke="${INK}" stroke-width="4" paint-order="stroke">TEST YOUR SWING</text>`;
    // tower
    s += `<rect x="${-W / 2}" y="${top + 26}" width="${W}" height="${h - 60}" rx="8" fill="url(#${id}-tw)" stroke="${INK}" stroke-width="3"/>`;
    s += `<rect x="-5" y="${top + 34}" width="10" height="${h - 76}" rx="5" fill="#3a2a22"/><rect x="-2.5" y="${top + 38}" width="5" height="${h - 84}" rx="2.5" fill="#979a9e"/>`;
    // scale marks
    (o.marks || []).forEach(([f, lab], i) => { const yy = r1(-34 - (h - 80) * f); s += `<rect x="${W / 2 - 2}" y="${yy - 11}" width="64" height="22" rx="6" fill="${['#f5e6c4', '#efd9a0', '#e7c670', '#e4b05c', '#e5955e'][i % 5]}" stroke="${INK}" stroke-width="2.4"/><text x="${W / 2 + 30}" y="${yy + 5.5}" text-anchor="middle" font-family="Lilita One" font-size="15" fill="${INK}">${lab}</text><path d="M${W / 2 - 8} ${yy}h6" stroke="${INK}" stroke-width="2.4"/>`; });
    // bell
    const bellY = top + 22;
    if (o.ring) s += `<circle cx="0" cy="${bellY - 6}" r="44" fill="#efe2a0" opacity=".55"/>` + [[-40, -24], [40, -24], [-46, 4], [46, 4], [0, -50]].map(([dx, dy]) => `<path d="M${r1(dx * 0.7)} ${r1(bellY + dy * 0.7)}L${dx} ${bellY + dy}" stroke="#efe2a0" stroke-width="4" stroke-linecap="round"/><path d="M${r1(dx * 0.7)} ${r1(bellY + dy * 0.7)}L${dx} ${bellY + dy}" stroke="${INK}" stroke-width="1.4" stroke-linecap="round"/>`).join('');
    s += `<path d="M-24 ${bellY + 8}Q-24 ${bellY - 26} 0 ${bellY - 28}Q24 ${bellY - 26} 24 ${bellY + 8}Z" fill="#e3be54" stroke="${INK}" stroke-width="3"/><rect x="-28" y="${bellY + 5}" width="56" height="7" rx="3.5" fill="#dda132" stroke="${INK}" stroke-width="2.6"/><path d="M-14 ${bellY - 10}Q-12 ${bellY - 20} -4 ${bellY - 22}" stroke="#f2e6af" stroke-width="3" fill="none" stroke-linecap="round"/><circle cx="0" cy="${bellY - 30}" r="5" fill="#e3be54" stroke="${INK}" stroke-width="2.4"/>`;
    // puck
    if (o.puck != null) { const py = r1(-34 - (h - 80) * o.puck); s += (o.puck > 0.1 ? `<path d="M0 ${py + 14}V${py + 70}" stroke="#fff" stroke-width="10" opacity=".55" stroke-linecap="round"/>` : '') + `<rect x="-15" y="${py - 9}" width="30" height="18" rx="7" fill="#57a5ca" stroke="${INK}" stroke-width="2.6"/><path d="M-9 ${py - 4}H6" stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity=".8"/>`; }
    // pad
    s += `<rect x="-36" y="-44" width="72" height="12" rx="5" fill="#e3be54" stroke="${INK}" stroke-width="3"/><circle cx="0" cy="-38" r="5" fill="${INK}"/>`;
    return s;
  }
  function mound(x, y, s) { return `<g transform="translate(${x} ${y}) scale(${s || 1})"><ellipse cx="0" cy="2" rx="40" ry="9" fill="rgba(120,80,30,.25)"/><g stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"><path d="M-36 0C-30 -22 -16 -32 0 -32S30 -22 36 0Z" fill="#e3cd99"/></g><path d="M-20 -14C-14 -24 -6 -27 2 -27" stroke="#f3e3b8" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M14 -16l4 -6 4 6z" fill="#e29f8f" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/></g>`; }
  function hole(x, y, s, inner) { return `<g transform="translate(${x} ${y}) scale(${s || 1})"><g stroke="${INK}" stroke-width="2.6"><ellipse cx="0" cy="0" rx="40" ry="12" fill="#d6c092"/><ellipse cx="0" cy="-1" rx="28" ry="7.5" fill="#8c714e"/></g>${inner || ''}</g>`; }

  /* sticker art for the Green Grocer set (64 grid, ink style) */
  const STK = {
    apple: `<g stroke="${INK}" stroke-width="3" stroke-linejoin="round"><path d="M32 18c-6-5-20-4-22 10s8 28 14 28c4 0 5-2 8-2s4 2 8 2c6 0 16-14 14-28s-16-15-22-10z" fill="#d9675c"/><path d="M32 18c0-5 2-9 6-11" fill="none"/><path d="M34 13c4-6 12-6 14-4-2 6-9 8-14 4z" fill="#7dc05d"/></g><path d="M16 30c0-6 3-9 7-10" stroke="#efada0" stroke-width="3.4" fill="none" stroke-linecap="round"/>`,
    carrot: `<g stroke="${INK}" stroke-width="3" stroke-linejoin="round"><path d="M24 20l20 4L26 58Q22 60 22 54Z" fill="#e5955e" transform="rotate(10 32 40)"/><path d="M30 18c-4-8-2-12 0-14 4 4 4 9 2 14M34 19c2-8 7-11 10-11 0 5-4 9-9 12M28 20c-6-4-11-3-13-1 3 3 8 4 13 2" fill="#7dc05d"/></g><path d="M27 32l6 1M27 42l5 1" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"/>`,
    blue: `<g stroke="${INK}" stroke-width="2.6"><circle cx="24" cy="36" r="10" fill="#7983c2"/><circle cx="40" cy="38" r="10" fill="#6f76b3"/><circle cx="32" cy="24" r="10" fill="#838dce"/></g><g fill="${INK}"><path d="M30 21l2 2 2-2M22 33l2 2 2-2M38 35l2 2 2-2"/></g><path d="M27 19q2-3 5-3" stroke="#bcc3eb" stroke-width="2.4" fill="none" stroke-linecap="round"/>`,
    avocado: `<g stroke="${INK}" stroke-width="3" stroke-linejoin="round"><path d="M32 6c-10 0-16 16-18 28-2 12 6 22 18 22s20-10 18-22C48 22 42 6 32 6z" fill="#60944a"/><path d="M32 12c-7 0-12 13-13 23-1 9 5 16 13 16s14-7 13-16c-1-10-6-23-13-23z" fill="#c3d885" stroke-width="2"/><circle cx="32" cy="38" r="8" fill="#a6774c"/></g>`,
    salmon: `<g stroke="${INK}" stroke-width="3" stroke-linejoin="round"><path d="M8 34c8-12 26-16 40-8l8-8v28l-8-8c-14 8-32 6-40-4z" fill="#eb9783"/></g><path d="M20 28c4 4 4 10 0 14M28 26c4 5 4 13 0 18M36 27c3 5 3 11 0 16" stroke="#f6dbc7" stroke-width="2.4" fill="none" stroke-linecap="round"/><circle cx="14" cy="32" r="2" fill="${INK}"/>`,
    bowl: `<g stroke="${INK}" stroke-width="3" stroke-linejoin="round"><circle cx="22" cy="28" r="7" fill="#7dc05d"/><circle cx="34" cy="24" r="7" fill="#d9675c"/><circle cx="44" cy="30" r="6" fill="#e3be54"/><path d="M8 32h48c0 14-10 24-24 24S8 46 8 32z" fill="#57a5ca"/></g><path d="M14 38c2 6 6 10 12 12" stroke="#b6daea" stroke-width="3" fill="none" stroke-linecap="round"/>`
  };
  function stickerCard(o) {
    // o: { x, y, w, kind, name, stars, isNew, back, rot }
    const w = o.w || 96, h = w * 1.3, id = o.id || 'sk';
    let s = `<g transform="translate(${o.x} ${o.y}) rotate(${o.rot || 0})">`;
    if (o.back) {
      s += `<rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" rx="12" fill="#9976d4" stroke="${INK}" stroke-width="3"/><rect x="${-w / 2 + 7}" y="${-h / 2 + 7}" width="${w - 14}" height="${h - 14}" rx="8" fill="none" stroke="#c2abe9" stroke-width="2" stroke-dasharray="4 4"/>` + `<g transform="translate(-14 -14) scale(.44)">${ICON.book.replace(/<\/?svg[^>]*>/g, '')}</g>`;
    } else {
      s += `<rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" rx="12" fill="#f7edd0" stroke="${INK}" stroke-width="3"/><rect x="${-w / 2 + 6}" y="${-h / 2 + 6}" width="${w - 12}" height="${w - 12}" rx="8" fill="#d0e5ee" stroke="${INK}" stroke-width="2"/>`;
      s += `<g transform="translate(${-w / 2 + 8} ${-h / 2 + 8}) scale(${(w - 16) / 64})">${STK[o.kind]}</g>`;
      s += `<text x="0" y="${h / 2 - 22}" text-anchor="middle" font-family="Nunito" font-weight="900" font-size="${w * 0.13}" fill="${INK}">${o.name}</text>`;
      const st = o.stars || 1; s += Array.from({ length: st }, (_, i) => `<g transform="translate(${r1((i - (st - 1) / 2) * w * 0.14 - w * 0.06)} ${r1(h / 2 - 15)}) scale(${w * 0.005})">${STAR.replace(/<\/?svg[^>]*>/g, '')}</g>`).join('');
      if (o.isNew) s += `<g transform="translate(${w / 2 - 8} ${-h / 2 + 6}) rotate(14)"><rect x="-22" y="-11" width="44" height="22" rx="6" fill="#d9675c" stroke="${INK}" stroke-width="2.4"/><text x="0" y="5.5" text-anchor="middle" font-family="Lilita One" font-size="14" fill="#fff">NEW</text></g>`;
    }
    return s + `</g>`;
  }
  function bigChest(o) {
    // o: { open, glow } origin base centre, ~120 wide
    let s = `<ellipse cx="0" cy="4" rx="70" ry="10" fill="rgba(0,0,0,.3)"/>`;
    if (o.open) s += `<circle cx="0" cy="-70" r="90" fill="#efe2a0" opacity=".35"/>` + sunburst(0, -66, 14, '#f3e6b4', 0.55, 170);
    s += `<g stroke="${INK}" stroke-width="3.4" stroke-linejoin="round"><path d="M-60 0H60V-56H-60Z" fill="#b58557"/><path d="M-60 -38H60" stroke-width="2.6"/><path d="M-42 0V-56M42 0V-56" stroke-width="2.6"/></g>`;
    s += `<path d="M-42 -54V-2M42 -54V-2" stroke="#e3be54" stroke-width="7"/><path d="M-42 -54V-2M42 -54V-2" stroke="${INK}" stroke-width="7" opacity=".0"/>`;
    s += `<rect x="-14" y="-50" width="28" height="22" rx="4" fill="#e3be54" stroke="${INK}" stroke-width="3"/><circle cx="0" cy="-40" r="3.4" fill="${INK}"/>`;
    if (o.open) s += `<g transform="rotate(-24 -60 -56)"><g stroke="${INK}" stroke-width="3.4" stroke-linejoin="round"><path d="M-60 -56Q-60 -100 0 -100Q60 -100 60 -56Z" fill="#c59361"/></g><path d="M-42 -96V-58M42 -96V-58" stroke="#e3be54" stroke-width="7"/></g>`;
    else s += `<g stroke="${INK}" stroke-width="3.4" stroke-linejoin="round"><path d="M-60 -56Q-60 -100 0 -100Q60 -100 60 -56Z" fill="#c59361"/></g><path d="M-42 -96V-58M42 -96V-58" stroke="#e3be54" stroke-width="7"/><path d="M-46 -70Q-40 -90 -20 -94" stroke="#e2bd8f" stroke-width="5" fill="none" stroke-linecap="round"/>`;
    return s;
  }

  window.KIT = { light, SKY, statusBar, hud, tabBar, todayTray, betChips, autoBtn, phaseRibbon, fixRing, chestStack, labelAt, stillArrow, planks, machine, shrugGoblin, spinPill, spinRound, sunburst, confetti, sparkle, striker, mound, hole, STK, stickerCard, bigChest, coinAt, nest, STAR, RIBBON, storm, INK, C, tube, K, bigWheel, pavilion, carousel, ferris, tilt, scrambler, train, staged, scaffold, lot, weeds, cone, sign, tree, pine, lamp, bunting, cloud, freighter, sail, bench, booth, scene, ICON, horse, shell };
})();

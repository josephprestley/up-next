/* Bay Beach for Daily Spin (cut from Home Base's art_rooms_b.js, Nov 5). Load after art.js. */
window.LAKE_ART = window.LAKE_ART || {};

/* Bay Beach for the game page, drawn with the map's own park art (LAKE_ART.drawPark / drawRide): the bay behind,
   the pavilion, the Big Wheel and every ride at its fix-up stage, under the sky of the current phase.
   LAKE_ART.drawParkScene(state, o) → { svg, viewBox }
     state: { n, levels, damaged } (the game save's village)
     o: { mood: "dawn"|"day"|"golden"|"dusk"|"night", season: "spring"|"summer"|"fall"|"winter", turning, lights,
          reduce, pending: {count, spins}, crop: "strip"|"full", id }
   LAKE_ART.drawRideCard(kind, v, level, o) → { svg, viewBox } — one ride at its stage on a patch of lawn. */
(function () {
  const A = window.LAKE_ART;
  const n1 = (v) => Math.round(v * 10) / 10;
  const rgb = (h) => { h = String(h).replace("#", ""); const n = parseInt(h, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const hex = (r, g, b) => "#" + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
  const mix = (a, b, t) => { const p = rgb(a), q = rgb(b); return hex(p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t); };
  const shade = (c, t) => (t < 0 ? mix(c, "#000000", -t) : mix(c, "#ffffff", t));
  const P = (d, f, ex) => '<path d="' + d + '" fill="' + f + '"' + (ex || "") + "/>";
  const R = (x, y, w, h, f, ex) => '<rect x="' + n1(x) + '" y="' + n1(y) + '" width="' + n1(w) + '" height="' + n1(h) + '" fill="' + f + '"' + (ex || "") + "/>";
  const C = (x, y, r, f, ex) => '<circle cx="' + n1(x) + '" cy="' + n1(y) + '" r="' + n1(r) + '" fill="' + f + '"' + (ex || "") + "/>";
  const L = (d, c, w, ex) => '<path d="' + d + '" fill="none" stroke="' + c + '" stroke-width="' + w + '" stroke-linecap="round"' + (ex || "") + "/>";
  function rng(seed) { let a = (seed * 2654435761) >>> 0; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  // the map's skies, plus a golden late afternoon for Kiddieland
  const SKY = { dawn: ["#9fb4d6", "#f6c9a4"], day: ["#8fc0e2", "#d9ecf4"], golden: ["#e6b26a", "#f8e3bb"], dusk: ["#4e5d93", "#f2a679"], night: ["#0c1530", "#26375a"] };
  const SHADE = { dawn: ["#f2b48c", 0.14], day: null, golden: ["#e9a55a", 0.16], dusk: ["#b9745c", 0.3], night: ["#18264c", 0.6] };
  function pal(season, frozen) {
    const ground = { winter: "#f0f3f5", spring: "#9dbb6b", summer: "#86a958", fall: "#9aa65c" }[season] || "#86a958";
    const water = frozen ? "#b9cedb" : { winter: "#56788c", spring: "#5a98b9", summer: "#4b91b6", fall: "#4c809f" }[season] || "#4b91b6";
    return { ground, water, waterHi: shade(water, frozen ? -0.08 : 0.28), far: season === "winter" ? "#d4dde4" : mix(ground, "#8aa0b2", 0.55),
      sand: season === "winter" ? "#e6ecf0" : "#e3d3a8", leaf: season === "spring" ? "#8fbf5a" : "#5c8f3e", pine: "#2f5640", pine2: "#234634", trunk: "#5b4030" };
  }
  // trees in the map's style
  function leafy(x, y, k, p, season, r) {
    let s = R(x - 2.4 * k, y - 22 * k, 4.8 * k, 22 * k, p.trunk);
    if (season === "winter") {
      s += L("M" + x + "," + (y - 20 * k) + " L" + (x - 10 * k) + "," + (y - 38 * k) + " M" + x + "," + (y - 22 * k) + " L" + (x + 2 * k) + "," + (y - 44 * k) + " M" + x + "," + (y - 18 * k) + " L" + (x + 12 * k) + "," + (y - 36 * k), p.trunk, 2.2 * k);
      return s + L("M" + (x - 10 * k) + "," + (y - 38.5 * k) + " L" + (x - 4 * k) + "," + (y - 27 * k), "#f8fafc", 1.6 * k);
    }
    let col = p.leaf;
    if (season === "fall") col = ["#d9822b", "#b8432f", "#e0b33a", "#c9622a", "#8f9a3f"][Math.floor(r() * 5)];
    else if (season === "spring" && r() < 0.4) col = r() < 0.5 ? "#f2c3cf" : "#f6eef0";
    const col2 = shade(col, -0.15);
    return s + C(x - 9 * k, y - 30 * k, 11 * k, col2) + C(x + 9 * k, y - 31 * k, 11 * k, col2) + C(x, y - 40 * k, 13 * k, col) + C(x - 4 * k, y - 29 * k, 10 * k, col) + C(x + 6 * k, y - 27 * k, 8 * k, col);
  }
  function pine(x, y, k, p, snowy) {
    const h = 40 * k, w = 26 * k;
    const tri = (y0, y1, ww, f) => P("M" + n1(x - ww / 2) + "," + n1(y0) + " L" + n1(x) + "," + n1(y1) + " L" + n1(x + ww / 2) + "," + n1(y0) + "Z", f);
    let s = R(x - 2 * k, y - 6 * k, 4 * k, 7 * k, p.trunk) + tri(y - 5 * k, y - h * 0.6, w, p.pine2) + tri(y - h * 0.36, y - h * 0.84, w * 0.8, p.pine) + tri(y - h * 0.64, y - h, w * 0.54, p.pine2);
    if (snowy) s += tri(y - h * 0.76, y - h, w * 0.36, "#f8fafc");
    return s;
  }
  function burst(x, y, r, col) {
    let d = "";
    for (let k = 0; k < 12; k++) { const a = (k * Math.PI) / 6; d += "M" + n1(x + Math.cos(a) * r * 0.35) + "," + n1(y + Math.sin(a) * r * 0.35) + " L" + n1(x + Math.cos(a) * r) + "," + n1(y + Math.sin(a) * r) + " "; }
    return L(d, col, 1.1, ' opacity=".9"') + C(x, y, r * 0.18, col);
  }

  A.drawParkScene = function (state, o) {
    o = o || {};
    const mood = SKY[o.mood] ? o.mood : "day", sky = SKY[mood], dim = mood === "dusk" || mood === "night", dark = mood === "night";
    const season = o.season || "summer", snowy = season === "winter", p = pal(season, snowy && mood !== "golden");
    const id = o.id || "bb";
    const strip = o.crop === "strip";
    const X0 = -262, X1 = 270, Y0 = strip ? -150 : -186, Y1 = strip ? 46 : 84;
    const horizon = -104, shore = -44;
    let s = '<defs><linearGradient id="' + id + 'sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + sky[0] + '"/><stop offset="1" stop-color="' + sky[1] + '"/></linearGradient>' +
      '<radialGradient id="' + id + 'glow"><stop offset="0" stop-color="#ffd27a" stop-opacity=".7"/><stop offset="1" stop-color="#ffd27a" stop-opacity="0"/></radialGradient></defs>';
    s += R(X0, Y0, X1 - X0, horizon - Y0 + 2, "url(#" + id + "sky)");
    const r = rng((state && state.n) || 1);
    if (dark) { for (let i = 0; i < 34; i++) s += C(X0 + r() * (X1 - X0), Y0 + r() * (horizon - Y0 - 8), 0.5 + r() * 0.7, "#fff8e0", ' opacity="' + (0.5 + r() * 0.5).toFixed(2) + '"'); s += C(176, Y0 + 30, 9, "#f3efd6") + C(180, Y0 + 27, 8, sky[0]); }
    else if (mood !== "dusk") s += C(mood === "dawn" ? -170 : mood === "golden" ? -150 : 150, Y0 + (mood === "day" ? 26 : 40), 11, mood === "golden" ? "#fff2c4" : "#fff6dc", ' opacity=".95"') + C(mood === "dawn" ? -170 : mood === "golden" ? -150 : 150, Y0 + (mood === "day" ? 26 : 40), 18, "#fff6dc", ' opacity=".25"');
    else s += C(-190, horizon - 4, 16, "#ffd9a0", ' opacity=".9"');
    if (o.fireworks && dark) s += burst(-120, Y0 + 34, 13, "#ff7ab0") + burst(-30, Y0 + 22, 15, "#ffd66b") + burst(90, Y0 + 40, 10, "#7fe0ff");
    // the far shore across the bay, the water, the sand
    let far = "M" + X0 + "," + (horizon + 2);
    for (let x = X0; x <= X1; x += 40) far += " Q" + (x + 20) + "," + n1(horizon - 3 - r() * 4) + " " + (x + 40) + "," + n1(horizon + 1);
    s += P(far + " L" + X1 + "," + (horizon + 6) + " L" + X0 + "," + (horizon + 6) + "Z", mix(p.far, sky[1], 0.35));
    s += R(X0, horizon + 4, X1 - X0, shore - horizon, p.water);
    if (!(snowy && mood !== "golden")) for (let i = 0; i < 16; i++) { const y = horizon + 10 + r() * (shore - horizon - 18), x = X0 + r() * (X1 - X0), w = 8 + r() * 20; s += L("M" + n1(x) + "," + n1(y) + " h" + n1(w), p.waterHi, 1.1, ' opacity=".75"'); }
    if (!snowy) {
      const bx = 150, by = horizon + 26;  // a sailboat and the freighter
      s += P("M" + (bx - 6) + "," + by + " h12 l-2,2.4 h-8z", dim ? "#4a5468" : "#f4f1ea") + P("M" + bx + "," + (by - 1) + " v-11 l6,11z", dim ? "#5a6478" : "#ffffff");
      s += R(-210, horizon + 12, 46, 5, dim ? "#3e3a3a" : "#6b2f2a") + R(-206, horizon + 7, 10, 5, dim ? "#55606a" : "#e8e4dc") + R(-178, horizon + 9, 4, 3, "#e8e4dc");
    }
    s += P("M" + X0 + "," + (shore - 2) + " Q0," + (shore - 6) + " " + X1 + "," + (shore - 3) + " L" + X1 + "," + (shore + 6) + " L" + X0 + "," + (shore + 6) + "Z", p.sand);
    s += R(X0, shore + 4, X1 - X0, Y1 - shore, p.ground);
    // trees at the sides, behind the park
    const tr = rng(7 + ((state && state.n) || 1));
    [[-252, -18, 1.05], [-236, -30, 0.8], [-226, 8, 1.25], [250, -22, 1.1], [236, -34, 0.8], [258, 12, 1.3], [-212, -40, 0.62], [222, -42, 0.66]].forEach(([x, y, k], i) => {
      s += i % 3 === 1 ? pine(x, y, k * 0.9, p, snowy) : leafy(x, y, k * 0.9, p, season, tr);
    });
    // the park itself (pavilion, Big Wheel, rides at their stages, the lawn and the midway paths)
    const park = A.drawPark ? A.drawPark(state, { layout: "wide", dim, dark, snowy, reduce: !!o.reduce, turning: !!o.turning, lights: !!o.lights, open: !dark, ground: p.ground, pending: o.pending }) : { b: "", l: "", t: "" };
    s += park.b;
    // the front path along the bottom
    if (!strip) s += P("M" + X0 + "," + (Y1 - 10) + " Q0," + (Y1 - 16) + " " + X1 + "," + (Y1 - 10) + " L" + X1 + "," + Y1 + " L" + X0 + "," + Y1 + "Z", snowy ? "#e6ebef" : "#d8d1c0");
    // light: tint the whole scene for the time of day, then the lights on top
    const sh = SHADE[mood];
    if (sh) s += R(X0, Y0, X1 - X0, Y1 - Y0, sh[0], ' opacity="' + sh[1] + '" style="mix-blend-mode:multiply"');
    if (dim) s += park.l;
    s += park.t || "";
    return { svg: s, viewBox: X0 + " " + Y0 + " " + (X1 - X0) + " " + (Y1 - Y0) };
  };

  A.drawRideCard = function (kind, v, level, o) {
    o = o || {};
    const def = (A.RIDES || []).find((x) => x.kind === kind && x.v === v) || {};
    const r = A.drawRide(kind, level, { v, colors: o.colors || def.c, damaged: !!o.damaged, lit: !!o.lit, snowy: !!o.snowy, reduce: true, w: def.w });
    const w = Math.max(30, r.w || 30), h = Math.max(15, r.h || 15);
    const side = Math.max(w * 1.12, h * 1.25 + 8);
    const gnd = o.snowy ? "#eef2f5" : "#a9c27f";
    let s = '<ellipse cx="0" cy="1" rx="' + n1(side * 0.48) + '" ry="' + n1(side * 0.1) + '" fill="' + gnd + '"/>' + r.b + (o.lit ? r.l : "");
    return { svg: s, viewBox: n1(-side / 2) + " " + n1(-side + side * 0.14) + " " + n1(side) + " " + n1(side) };
  };
})();

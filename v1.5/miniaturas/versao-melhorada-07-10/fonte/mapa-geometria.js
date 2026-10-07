/* Geometry in map metres. No DOM, scene, storage or city configuration. */
(function(root) {
  'use strict';
const shoelace = r => { let s = 0;
  for (let i = 0, n = r.length; i < n; i++) { const a = r[i], b = r[(i+1)%n]; s += a[0]*b[1] - b[0]*a[1]; }
  return s; };

const inside = (r, x, z) => { let hit = false;
  for (let i = 0, j = r.length-1; i < r.length; j = i++) { const a = r[i], b = r[j];
    if ((a[1] > z) !== (b[1] > z) && x < (b[0]-a[0])*(z-a[1])/(b[1]-a[1]) + a[0]) hit = !hit; }
  return hit; };

function triangulateRing(r, earcut, fallback) {
  if (typeof earcut === "function") {
    const flat = []; for (const p of r) { flat.push(p[0], p[1]); }
    const idx = earcut(flat);
    const tri = [];
    for (let i = 0; i < idx.length; i += 3) tri.push([idx[i], idx[i+1], idx[i+2]]);
    return tri;
  }
  return fallback(r);
}

function insetRing(r, dist) {
  const n = r.length, out = new Array(n);
  for (let i = 0; i < n; i++) {
    const p0 = r[(i-1+n)%n], p1 = r[i], p2 = r[(i+1)%n];
    let e1x = p1[0]-p0[0], e1z = p1[1]-p0[1], e1L = Math.hypot(e1x,e1z);
    let e2x = p2[0]-p1[0], e2z = p2[1]-p1[1], e2L = Math.hypot(e2x,e2z);
    if (e1L < 1e-6 || e2L < 1e-6) { out[i] = p1; continue; }
    e1x/=e1L; e1z/=e1L; e2x/=e2L; e2z/=e2L;
    const n1x = -e1z, n1z = e1x, n2x = -e2z, n2z = e2x; // normais externas (mesma
                                                          // convenção CW usada nas paredes)
    let mx = n1x+n2x, mz = n1z+n2z; const mL = Math.hypot(mx,mz);
    if (mL < 1e-6) { out[i] = [p1[0]-n1x*dist, p1[1]-n1z*dist]; continue; }
    mx/=mL; mz/=mL;
    const cosHalf = Math.max(0.35, mx*n1x + mz*n1z); // trava o "bico" em cantos muito agudos
    const scale = dist/cosHalf;
    out[i] = [p1[0]-mx*scale, p1[1]-mz*scale];
  }
  return out;
}
function safeInset(r, dist) {
  const before = shoelace(r), areaBefore = Math.abs(before)/2;
  if (areaBefore < 10) return r; // pequeno demais pra encolher com segurança
  const ins = insetRing(r, dist);
  const after = shoelace(ins), areaAfter = Math.abs(after)/2;
  if (areaAfter < areaBefore*0.25 || (after > 0) !== (before > 0)) return r; // colapsou/inverteu, mantém original
  return ins;
}

function convexHull(pts) {
  if (pts.length < 4) return pts.slice();
  const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0]-o[0])*(b[1]-o[1]) - (a[1]-o[1])*(b[0]-o[0]);
  const lo = [], up = [];
  for (const q of p) { while (lo.length >= 2 && cross(lo[lo.length-2], lo[lo.length-1], q) <= 0) lo.pop(); lo.push(q); }
  for (let i = p.length-1; i >= 0; i--) { const q = p[i];
    while (up.length >= 2 && cross(up[up.length-2], up[up.length-1], q) <= 0) up.pop(); up.push(q); }
  lo.pop(); up.pop();
  return lo.concat(up);
}

function obbOf(r, area) {
  const H = convexHull(r);
  let best = null;
  if (H.length >= 3) {
    for (let i = 0; i < H.length; i++) {                 // uma direção por aresta do casco
      const a = H[i], b = H[(i+1) % H.length];
      let ex = b[0]-a[0], ez = b[1]-a[1];
      const L = Math.hypot(ex, ez); if (L < 1e-6) continue;
      ex /= L; ez /= L;
      let u0 = 1e9, u1 = -1e9, v0 = 1e9, v1 = -1e9;
      for (const p of H) {
        const u = p[0]*ex + p[1]*ez, v = -p[0]*ez + p[1]*ex;
        if (u < u0) u0 = u; if (u > u1) u1 = u;
        if (v < v0) v0 = v; if (v > v1) v1 = v;
      }
      const A = (u1-u0) * (v1-v0);
      if (!best || A < best.A) best = { A, ex, ez, u0, u1, v0, v1 };
    }
  }
  if (!best) {                                            // degenerado: cai pro AABB
    let x0=1e9,x1=-1e9,z0=1e9,z1=-1e9;
    for (const p of r) { x0=Math.min(x0,p[0]); x1=Math.max(x1,p[0]); z0=Math.min(z0,p[1]); z1=Math.max(z1,p[1]); }
    best = { A:(x1-x0)*(z1-z0), ex:1, ez:0, u0:x0, u1:x1, v0:z0, v1:z1 };
  }
  const cu = (best.u0+best.u1)/2, cv = (best.v0+best.v1)/2;
  let hu = (best.u1-best.u0)/2, hv = (best.v1-best.v0)/2;
  let ux = best.ex, uz = best.ez;
  if (hv > hu) { const t = hu; hu = hv; hv = t;            // eixo maior sempre em u
                 const tx = ux; ux = -uz; uz = tx; }
  return {
    cx: cu*best.ex - cv*best.ez, cz: cu*best.ez + cv*best.ex,
    ux, uz, hu, hv,
    rect: best.A > 1e-6 ? Math.min(1, area / best.A) : 0,  // 1 = retângulo perfeito
    elong: hv > 1e-6 ? hu/hv : 1
  };
}
  root.MapGeometry = Object.freeze({shoelace, inside, triangulateRing, insetRing, safeInset, convexHull, obbOf});
})(globalThis);

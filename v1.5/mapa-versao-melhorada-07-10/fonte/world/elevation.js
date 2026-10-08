/* Grade de elevacao: busca na API livre, mediana 3x3 e cache do navegador. */
(function(root) {
  "use strict";
  function create({document, console, CENTER, MLAT, MLON, ELEV_N, ELEV_HALF, timed, sleep,
                   guarda}) {
async function fetchElevation(onProgress) {
  const N = ELEV_N, pts = [];
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const x = -ELEV_HALF + i/(N-1)*2*ELEV_HALF, z = -ELEV_HALF + j/(N-1)*2*ELEV_HALF;
    pts.push([CENTER.lat - z/MLAT, CENTER.lon + x/MLON]);
  }
  const out = new Float32Array(N*N), BATCH = 100, total = Math.ceil(pts.length/BATCH);
  for (let s = 0, b = 0; s < pts.length; s += BATCH, b++) {
    const chunk = pts.slice(s, s+BATCH);
    const locs = chunk.map(p => p[0].toFixed(5) + "," + p[1].toFixed(5)).join("|");
    if (onProgress) onProgress(b, total);
    let r;
    try { r = await timed("https://api.open-elevation.com/api/v1/lookup?locations=" + locs, 15000); }
    catch (e) { await sleep(1200); r = await timed("https://api.open-elevation.com/api/v1/lookup?locations=" + locs, 15000); }
    if (!r.ok) throw new Error("HTTP " + r.status);
    const j = await r.json();
    j.results.forEach((res, k) => out[s+k] = res.elevation || 0);
    if (s + BATCH < pts.length) await sleep(350);
  }
  // A API de elevação livre às vezes devolve UM ponto isolado ruim (bem diferente de
  // todos os vizinhos). Mediana 3x3 de 1 passada só descarta esse tipo de outlier
  // pontual, sem achatar o relevo real (a causa do prédio sumir era o frustum culling
  // desatualizado — ver frustumCulled=false na malha do prédio — não os dados de
  // elevação; um filtro mais forte aqui só destruía relevo de verdade à toa).
  const smooth = medianGrid(out, N, 1);
  const c = smooth[Math.round((N-1)/2)*N + Math.round((N-1)/2)];
  for (let i = 0; i < smooth.length; i++) smooth[i] -= c;
  return smooth;
}
function medianGrid(src, N, radius) {
  const out2 = new Float32Array(N*N);
  const win = [];
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    win.length = 0;
    for (let dj = -radius; dj <= radius; dj++) for (let di = -radius; di <= radius; di++) {
      const ii = i+di, jj = j+dj;
      if (ii < 0 || ii >= N || jj < 0 || jj >= N) continue;
      win.push(src[jj*N+ii]);
    }
    win.sort((a,b) => a-b);
    out2[j*N+i] = win[win.length >> 1];
  }
  return out2;
}

// Guarda a grade de elevação já baixada no navegador pra não ter que buscar de novo
// na API a cada F5 — só refaz o download se a cidade (centro) ou o tamanho da grade mudar.
const ELEV_CACHE_KEY = `elevGrid_v3_${CENTER.lat}_${CENTER.lon}_${ELEV_N}_${ELEV_HALF}`;
function loadElevCache() {
  const t = document.getElementById("__elevdata");
  if (t) {
    try {
      const a = JSON.parse(t.textContent);
      if (Array.isArray(a) && a.length === ELEV_N*ELEV_N) return Float32Array.from(a);
    } catch (e) { console.error("Grade de relevo embutida invalida:", e); }
  }
  try {
    const raw = guarda.le(ELEV_CACHE_KEY);
    if (!raw) return null;
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr) || arr.length !== ELEV_N*ELEV_N) return null;
    return Float32Array.from(arr);
  } catch (e) { return null; }
}
function saveElevCache(grid) {
  try { guarda.grava(ELEV_CACHE_KEY, JSON.stringify(Array.from(grid))); }
  catch (e) { /* localStorage cheio/indisponível — segue sem cache */ }
}

    return {fetchElevation, medianGrid, loadElevCache, saveElevCache, ELEV_CACHE_KEY};
  }
  root.Elevation = Object.freeze({create});
})(globalThis);

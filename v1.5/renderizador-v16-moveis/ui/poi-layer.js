/* POI ground layer: glow halo and beam per category, plus radius counts. */
(function(root) {
  "use strict";
  function create({THREE, pois:POIS, cat:CAT, terrainY, registerTerrain, document,
                   haloRadius:POI_HALO, beamTop:POI_Y}) {
/* --- camada 3D: halo no chao + feixe vertical, uma malha por categoria --- */
const glowTex = (() => {
  const N = 128, cv = document.createElement("canvas");
  cv.width = cv.height = N;
  const g = cv.getContext("2d"), rad = g.createRadialGradient(N/2, N/2, 0, N/2, N/2, N/2);
  rad.addColorStop(0, "rgba(255,255,255,.85)");
  rad.addColorStop(.45, "rgba(255,255,255,.28)");
  rad.addColorStop(.78, "rgba(255,255,255,.07)");
  rad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = rad; g.fillRect(0, 0, N, N);
  const t = new THREE.CanvasTexture(cv);
  t.minFilter = THREE.LinearFilter;
  return t;
})();

const gPoi = new THREE.Group();
const poiLayer = {};

function buildPoiLayer() {
  const byCat = new Map();
  for (const p of POIS) {
    if (!byCat.has(p.c)) byCat.set(p.c, []);
    byCat.get(p.c).push(p);
  }
  for (const [cat, list] of byCat) {
    const col = new THREE.Color(CAT[cat].hex), R = POI_HALO;
    const HP = [], HU = [], HC = [], HDY = [], HXZ = [];
    const LP = [], LC = [], LDY = [], LXZ = [];
    for (const p of list) {
      const y = terrainY(p.x, p.z);
      // halo: um quadrado deitado com a textura de brilho radial
      const quad = [[-R,-R,0,0],[R,-R,1,0],[R,R,1,1],[-R,-R,0,0],[R,R,1,1],[-R,R,0,1]];
      for (const c of quad) {
        HP.push(p.x + c[0], 0.55, p.z + c[1]); HU.push(c[2], c[3]);
        HC.push(col.r, col.g, col.b); HDY.push(y); HXZ.push(p.x, p.z);
      }
      // feixe: linha do chao ate o marcador, apagando conforme sobe
      LP.push(p.x, 0.6, p.z, p.x, POI_Y, p.z);
      LC.push(col.r, col.g, col.b, col.r*0.22, col.g*0.22, col.b*0.22);
      LDY.push(y, y); LXZ.push(p.x, p.z, p.x, p.z);
      // anel no chao marcando o ponto exato
      const N = 28, r = 6.5;
      for (let i = 0; i < N; i++) {
        const a0 = i/N*Math.PI*2, a1 = (i+1)/N*Math.PI*2;
        LP.push(p.x + Math.cos(a0)*r, 0.6, p.z + Math.sin(a0)*r,
                p.x + Math.cos(a1)*r, 0.6, p.z + Math.sin(a1)*r);
        LC.push(col.r, col.g, col.b, col.r, col.g, col.b);
        LDY.push(y, y); LXZ.push(p.x, p.z, p.x, p.z);
      }
    }
    const hg = new THREE.BufferGeometry();
    hg.setAttribute("position", new THREE.Float32BufferAttribute(HP, 3));
    hg.setAttribute("uv", new THREE.Float32BufferAttribute(HU, 2));
    hg.setAttribute("color", new THREE.Float32BufferAttribute(HC, 3));
    hg.userData.presetDY = new Float32Array(HDY);
    hg.userData.presetCenter = new Float32Array(HXZ);
    const halo = new THREE.Mesh(hg, new THREE.MeshBasicMaterial({
      map: glowTex, vertexColors: true, transparent: true, opacity: 0.62,
      depthWrite: false, blending: THREE.AdditiveBlending }));
    halo.renderOrder = 3; halo.frustumCulled = false;

    const lg = new THREE.BufferGeometry();
    lg.setAttribute("position", new THREE.Float32BufferAttribute(LP, 3));
    lg.setAttribute("color", new THREE.Float32BufferAttribute(LC, 3));
    lg.userData.presetDY = new Float32Array(LDY);
    lg.userData.presetCenter = new Float32Array(LXZ);
    // depthTest desligado: quase todo POI cai DENTRO do contorno de um predio, e com
    // teste de profundidade o feixe simplesmente nao apareceria. A opacidade baixa
    // mantem o efeito de facho de luz em vez de risco por cima da cena.
    const beam = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({
      vertexColors: true, transparent: true, opacity: 0.5,
      depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending }));
    beam.renderOrder = 4; beam.frustumCulled = false;

    hg.userData.poi = true; lg.userData.poi = true;
    registerTerrain(hg); registerTerrain(lg);
    gPoi.add(halo, beam);
    poiLayer[cat] = [halo, beam];
  }
}
buildPoiLayer();

    return {group:gPoi, layer:poiLayer};
  }

function contaPerto(POIS, x, z, PERTO_R) {
  const n = {}, R2 = PERTO_R * PERTO_R;
  for (const p of POIS) {
    const dx = p.x - x, dz = p.z - z;
    if (dx*dx + dz*dz <= R2) n[p.c] = (n[p.c] || 0) + 1;
  }
  return n;
}

  root.PoiLayer = Object.freeze({create, contaPerto});
})(globalThis);

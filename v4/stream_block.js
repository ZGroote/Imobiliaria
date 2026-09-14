/* ============================================================
   4b. Streaming por quarteirão  (v4)
   ------------------------------------------------------------
   O v3 montava a cidade inteira no boot: 1.281 draw calls e ~224 MB de VRAM
   residentes do primeiro frame ao último. Medido numa GTX 1650, o gargalo é
   submissão, não rasterização — 23 us por draw call, e cortar 68% dos
   triângulos não mudou o frame em nada. Ou seja: o que custa é QUANTOS objetos
   estão na cena, não quão detalhados eles são.

   Aqui a cidade passa a montar só o que está perto do alvo da câmera. A 400 m
   isso são ~0,8% da geometria, o que libera orçamento para casas muito mais
   detalhadas do que o v3 jamais poderia ter.

   A unidade é o quarteirão (face do grafo de ruas, ver build_blocks.py), não o
   tile de 850 m: quadra é a menor coisa que ainda parece um pedaço de cidade
   inteiro quando aparece, então montar/descartar por quadra não deixa costura
   visível no meio de uma rua.
   ============================================================ */
let   STREAM_R    = 1800;  // m — raio de montagem a partir do alvo da câmera
                           // let, não const: é tunável em tempo de execução — a
                           // ficha de um imóvel quer raio curto, uma vista de
                           // rota atravessando a cidade quer raio longo
const STREAM_HYST = 320;   // m — histerese: só descarta além de R+H, senão um
                           // movimento de vaivém na fronteira remonta sem parar.
                           // Escala com o raio: a 1.800 m um passo de câmera cobre
                           // mais quadras de fronteira que a 700 m.
const STREAM_MS   = 6;     // ms — fatia de montagem por frame

let gGroups = [];              // {cx, cz, rad, B, R, G}
const gLive = new Map();       // índice -> { objs, parcels, streets }
let streamQ = [];              // fila de montagem, mais perto primeiro
let anchorX = 1e9, anchorZ = 1e9;
let streamReady = false;

function groupsFrom(B, R, G, grp) {
  const out = [];
  // Prédios: fatia contígua de B. O build_city_v4.py reordenou o b[] agrupando
  // por quadra justamente pra isso caber em [início, quantidade] em vez de uma
  // lista de 111 mil índices (1,2 MB -> 0,13 MB).
  for (const g of grp)
    out.push({ cx: g.cx, cz: g.cz, rad: g.rad, B: B.slice(g.s, g.s + g.n), R: [], G: [] });

  // Ruas e áreas verdes não pertencem a quarteirão nenhum (a rua é a FRONTEIRA
  // entre duas quadras). Ficam na grade de 850 m do v3, como grupos próprios,
  // sujeitos ao mesmo teste de raio.
  const cells = new Map();
  const cellOf = p => {
    const gx = Math.round(p[0]/CELL), gz = Math.round(p[1]/CELL), k = gx + ":" + gz;
    let c = cells.get(k);
    if (!c) { c = { cx: gx*CELL, cz: gz*CELL, rad: 0, B: [], R: [], G: [] }; cells.set(k, c); }
    return c;
  };
  for (const r of R) cellOf(r.pts[0]).R.push(r);
  for (const g of G) cellOf(g.r[0]).G.push(g);
  // raio medido do conteúdo real: uma polilinha de rua atravessa a célula e sai
  // do outro lado, então meia-diagonal não a contém e a rua sumiria na borda.
  for (const c of cells.values()) {
    let far = 0;
    for (const r of c.R) for (const p of r.pts)
      far = Math.max(far, Math.hypot(p[0]-c.cx, p[1]-c.cz));
    for (const g of c.G) for (const p of g.r)
      far = Math.max(far, Math.hypot(p[0]-c.cx, p[1]-c.cz));
    c.rad = far;
    out.push(c);
  }
  return out;
}

function dropGroup(i) {
  const rec = gLive.get(i);
  if (!rec) return;
  for (const o of rec.objs) {
    if (o.parent) o.parent.remove(o);
    if (o.geometry) {
      const k = terrainRegistry.indexOf(o.geometry);
      if (k >= 0) terrainRegistry.splice(k, 1);
      o.geometry.dispose();
    }
    const t = treeRegistry.indexOf(o);
    if (t >= 0) treeRegistry.splice(t, 1);
    if (o.material) o.material.dispose();
  }
  // risers guarda o uniform da animação de subida por malha montada; sem tirar
  // daqui, a lista cresce sem limite conforme o usuário anda pela cidade.
  for (const u of rec.risers) {
    const k = risers.findIndex(r => r.u === u);
    if (k >= 0) risers.splice(k, 1);
  }
  // seenStreets nao e limpo aqui: o rebuildOverlay() zera e refaz o conjunto
  // inteiro logo em seguida, e limpar aqui so criaria dois donos pro mesmo estado.
  gLive.delete(i);
}

function buildGroup(i) {
  if (gLive.has(i)) return 0;
  const g = gGroups[i];
  const rec = { objs: [], parcels: [], risers: [], roads: g.R };
  gLive.set(i, rec);
  return assembleInto(rec, g.B, g.R, g.G, g.cx, g.cz);
}

/* Pinos e rótulos são DOM, não geometria: em vez de criar/remover um a um
   conforme a quadra entra e sai, refaço a lista inteira quando o conjunto vivo
   muda. Com no máximo algumas dezenas de quadras vivas isso é barato, e evita
   toda uma classe de bug de índice defasado que o addPins() incremental do v3
   teria assim que algo fosse descartado. */
function rebuildOverlay() {
  for (const q of mPin) q.el.remove();
  for (const l of labels) l.el.remove();
  mPin = []; labels = []; parcels.length = 0;
  seenStreets.clear();
  for (const rec of gLive.values()) {
    for (const p of rec.parcels) parcels.push(p);
    for (const w of rec.roads) addStreets([w]);
  }
  addPins();
}

function streamUpdate(force) {
  if (!streamReady) return;
  const dx = target.x - anchorX, dz = target.z - anchorZ;
  if (!force && dx*dx + dz*dz < 60*60) return;   // andou pouco: nada muda
  anchorX = target.x; anchorZ = target.z;

  const keep = STREAM_R + STREAM_HYST;
  let dropped = false;
  const want = [];
  for (let i = 0; i < gGroups.length; i++) {
    const g = gGroups[i];
    const d = Math.hypot(g.cx - target.x, g.cz - target.z) - g.rad;
    if (gLive.has(i)) { if (d > keep) { dropGroup(i); dropped = true; } }
    else if (d <= STREAM_R) want.push([d, i]);
  }
  // monta de dentro pra fora: o que está debaixo do nariz aparece primeiro
  want.sort((a, b) => a[0] - b[0]);
  streamQ = want.map(w => w[1]);
  if (dropped) rebuildOverlay();
}

/* Chamado uma vez por frame: gasta no máximo STREAM_MS montando. O laço de
   render é o mesmo que desenha, então estourar esse orçamento aparece como
   engasgo direto na tela — por isso é tempo medido, não contagem fixa. */
function streamPump() {
  if (!streamQ.length) return;
  const t0 = performance.now();
  let n = 0;
  while (streamQ.length && performance.now() - t0 < STREAM_MS) { buildGroup(streamQ.shift()); n++; }
  if (n) rebuildOverlay();
  if (!streamQ.length) {
    progTxt.textContent = `${gLive.size} quarteirões · ${blocks.toLocaleString("pt-BR")} edificações`;
  }
}

/* Malha viária inteira em UMA chamada de desenho: 62 mil arestas de linha fina,
   ~1,5 MB, sempre residente. Serve de contexto pro que ainda não montou e é o
   que permite desenhar uma rota que atravessa a cidade sem exigir que toda a
   cidade esteja construída. */
function buildStreetContext(R) {
  const P = [];
  for (const w of R)
    for (let i = 0; i < w.pts.length - 1; i++) {
      const a = w.pts[i], b = w.pts[i+1];
      P.push(a[0], 0.25, a[1], b[0], 0.25, b[1]);
    }
  if (!P.length) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(P), 3));
  registerTerrain(g);
  const m = new THREE.LineBasicMaterial({ color: K.road, transparent: true, opacity: 0.5 });
  const ls = new THREE.LineSegments(g, m);
  ls.renderOrder = -1;
  return ls;
}

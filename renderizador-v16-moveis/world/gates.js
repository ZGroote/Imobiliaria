/* Gate decoding, geometry and instancing. Caller owns scene insertion and refresh timing. */
(function(root) {
  "use strict";
  function decode(a) {
  if (!a.length) return null;
  const n = a.length / 5;
  const x = new Float32Array(n), z = new Float32Array(n), ang = new Float32Array(n);
  const larg = new Float32Array(n), tipo = new Uint8Array(n);
  let px = 0, pz = 0;
  for (let i = 0; i < n; i++) {
    px += a[i*5]; pz += a[i*5+1];
    x[i] = px/10; z[i] = pz/10;
    ang[i] = a[i*5+2] / 255 * Math.PI * 2;
    larg[i] = a[i*5+3] / 10;
    tipo[i] = a[i*5+4];
  }
  return { n, x, z, ang, larg, tipo };
  }
  function create({THREE, data, target, terrainY, getRelief, SOMBRA_CIDADE, radius = 700}) {
    const PORT = data ? decode(data) : null;
    const PORT_RAIO = radius;

/* Uma caixa em coordenadas locais. X vai de -0,5 a 0,5 (a largura do portao inteiro,
   pilar a pilar) e e o eixo que a instancia escala; Y e Z ja estao em metros. */
function _caixa(P, C, cx, cy, cz, sx, sy, sz, cor) {
  const x0=cx-sx/2, x1=cx+sx/2, y0=cy-sy/2, y1=cy+sy/2, z0=cz-sz/2, z1=cz+sz/2;
  const v = [[x0,y0,z0],[x1,y0,z0],[x1,y1,z0],[x0,y1,z0],
             [x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1]];
  const f = [[0,1,2],[0,2,3],[5,4,7],[5,7,6],[4,0,3],[4,3,7],
             [1,5,6],[1,6,2],[3,2,6],[3,6,7],[4,5,1],[4,1,0]];
  for (const t of f) for (const k of t) { P.push(v[k][0],v[k][1],v[k][2]); C.push(cor[0],cor[1],cor[2]); }
}

function _geoPortao(tipo) {
  const P = [], C = [];
  // Tres razoes pro portao sumir dentro do muro, todas consertadas aqui:
  //  1. ele nascia coplanar com o muro -> agora avanca 12 cm PRA RUA (o +Z local, que
  //     o gen_portoes garante ser o lado da rua);
  //  2. o painel era mais baixo que os 2,2 m do muro, entao o muro aparecia por cima
  //     -> agora o painel vai a 2,30 m e o pilar a 2,62 m, que e o que se ve na rua:
  //     pilar sempre mais alto que o muro;
  //  3. painel e pilar tinham quase a mesma cor do muro -> o pilar sai 35% mais claro
  //     que o painel na cor de vertice, e o tom da instancia e metalico medio/escuro.
  const pilar = [1.35,1.34,1.30], painel = [1.0,1.0,1.0], vao = [0.42,0.44,0.46];
  const ep = 0.086, ZF = 0.12;            // meia-espessura do pilar; avanco pra rua
  const hp = 2.62, hpa = 2.30;
  _caixa(P, C, -0.5+ep, hp/2, ZF, ep*2, hp, 0.34, pilar);
  _caixa(P, C,  0.5-ep, hp/2, ZF, ep*2, hp, 0.34, pilar);
  if (tipo === 0) {                       // correr liso
    _caixa(P, C, 0, hpa/2, ZF, 1-ep*2, hpa, 0.12, painel);
  } else if (tipo === 1) {                // basculante com friso no topo
    _caixa(P, C, 0, hpa/2, ZF, 1-ep*2, hpa, 0.12, painel);
    _caixa(P, C, 0, hpa-0.14, ZF+0.03, 1-ep*2, 0.18, 0.16, vao);
  } else if (tipo === 2) {                // portao + porta social ao lado
    _caixa(P, C, -0.12, hpa/2, ZF, 0.70-ep, hpa, 0.12, painel);
    _caixa(P, C,  0.28, hp/2-0.06, ZF, ep*1.5, hp-0.12, 0.32, pilar);
    _caixa(P, C,  0.40, 1.10, ZF, 0.16, 2.20, 0.11, vao);
  } else {                                // com cobertura/laje projetada
    _caixa(P, C, 0, hpa/2, ZF, 1-ep*2, hpa, 0.12, painel);
    _caixa(P, C, 0, hp+0.10, ZF+0.30, 1.0, 0.20, 0.95, pilar);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(P), 3));
  g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(C), 3));
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

// Metalico medio a escuro: e o que contrasta com o muro, que e claro. Tom claro
// demais (o primeiro palpite tinha 0xD8D8D6 e 0xEDEDE9) desaparece contra o reboco.
const PORT_COR = [0x9AA0A4, 0x6E7478, 0x4E565C, 0x3E4A42, 0x7A6A5A, 0x5A5F63, 0x8A8177];
const gPort = new THREE.Group();
gPort.name = "portoes";
const portMesh = [];

function refazPortoes() {
  if (!PORT) return;
  const R2 = PORT_RAIO * PORT_RAIO;
  const lista = [[], [], [], []];
  for (let i = 0; i < PORT.n; i++) {
    const dx = PORT.x[i] - target.x, dz = PORT.z[i] - target.z;
    if (dx*dx + dz*dz > R2) continue;
    lista[PORT.tipo[i]].push(i);
  }
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(),
        sc = new THREE.Vector3(), e = new THREE.Euler(), cor = new THREE.Color();
  for (let t = 0; t < 4; t++) {
    const L = lista[t];
    let im = portMesh[t];
    if (!L.length) { if (im) im.count = 0; continue; }
    if (!im || im.instanceMatrix.count < L.length) {
      if (im) { gPort.remove(im); im.dispose(); }
      const cap = 1 << Math.ceil(Math.log2(Math.max(64, L.length)));
      im = new THREE.InstancedMesh(_geoPortao(t),
        new THREE.MeshPhongMaterial({ vertexColors:true, shininess:8, specular:0x222222 }), cap);
      im.castShadow = false; im.receiveShadow = SOMBRA_CIDADE;
      im.frustumCulled = false;
      portMesh[t] = im; gPort.add(im);
    }
    for (let k = 0; k < L.length; k++) {
      const i = L[k];
      v.set(PORT.x[i], terrainY(PORT.x[i], PORT.z[i]) * getRelief(), PORT.z[i]);
      e.set(0, -PORT.ang[i], 0); q.setFromEuler(e);
      sc.set(PORT.larg[i], 1, 1);
      m.compose(v, q, sc);
      im.setMatrixAt(k, m);
      cor.setHex(PORT_COR[(i * 7 + PORT.tipo[i]) % PORT_COR.length]);
      im.setColorAt(k, cor);
    }
    im.count = L.length;
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
  }
}


    return {group:gPort, refresh:refazPortoes};
  }
  root.Gates = Object.freeze({create});
})(globalThis);

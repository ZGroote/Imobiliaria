/* Street label DOM, projection cache and lifetime. */
(function(root) {
  "use strict";
  function create({THREE, document, overlay, terrainY}) {
    const tmp = new THREE.Vector3();
const seenStreets = new Map();
let labels = [];
// O relevo de um rotulo nao muda: a rua nao anda. Amostrar terrainY tres vezes por
// rotulo por quadro (2.000 rotulos = 6.000 amostras da grade) era refazer sempre a
// mesma conta. Quem invalida e o botao Relevo, unico que mexe em reliefAmount/terrain.grid.
function dyDoRotulo(l) {
  l.ya = terrainY(l.a.x, l.a.z);
  l.yb = terrainY(l.b.x, l.b.z);
  l.ym = terrainY(l.m.x, l.m.z);
}
function recalcDyRotulos() { for (const l of labels) dyDoRotulo(l); }
// Camera parada = rotulo parado (ver o laco no frame()).
const _rotCam = new THREE.Vector3(1e9, 0, 1e9);
let _rotW = 0, _rotH = 0, _rotRel = -1, _rotSujo = true;
function sujaRotulos() { _rotSujo = true; }

function addStreets(roads) {
  for (const w of roads) {
    if (!w.name || w.pts.length < 2) continue;
    let best = 0, bi = 0;
    for (let i = 0; i < w.pts.length-1; i++) {
      const L = Math.hypot(w.pts[i+1][0]-w.pts[i][0], w.pts[i+1][1]-w.pts[i][1]);
      if (L > best) { best = L; bi = i; }
    }
    if (best < 45) continue;
    const prev = seenStreets.get(w.name);
    if (prev && prev >= best) continue;
    seenStreets.set(w.name, best);
    if (labels.length >= 2000) continue;
    const a = w.pts[bi], b = w.pts[bi+1], el = document.createElement("div");
    el.className = "street"; el.textContent = w.name.toUpperCase(); el.style.display = "none";
    overlay.appendChild(el);
    const rot = { el, a: new THREE.Vector3(a[0],0.3,a[1]), b: new THREE.Vector3(b[0],0.3,b[1]),
      m: new THREE.Vector3((a[0]+b[0])/2, 0.3, (a[1]+b[1])/2),
      v: new THREE.Vector3(), v2: new THREE.Vector3(), ya: 0, yb: 0, ym: 0 };
    dyDoRotulo(rot);
    labels.push(rot);
  }
}

    function hide() { for (const l of labels) l.el.style.display = "none"; sujaRotulos(); }
    function clear() { for (const l of labels) l.el.remove(); labels = []; seenStreets.clear(); sujaRotulos(); }
    function update({camera, W, H, reliefAmount, interior, showLab}) {
  // v9: rotulo de rua e desenhado por cima de tudo (DOM) e atravessa a parede da sala.
  if (interior) {
    for (const l of labels) if (l.el.style.display !== "none") l.el.style.display = "none";
    sujaRotulos();   // sair da casa tem que redesenhar, ainda que a camera volte igual
  } else if (showLab) {
    // Camera parada = rotulo parado. Projetar 2.000 rotulos e reescrever 2.000
    // `style.transform` por quadro pra pintar o mesmo pixel e trabalho puro de CPU --
    // e "usuario parado olhando a cidade" e o quadro comum, nao a excecao.
    // `camera.position` ja resume alvo, theta, phi e raio, e a rotacao sai do lookAt
    // sobre o alvo, entao ela nao precisa entrar na conta AQUI (a primeira pessoa, que
    // gira sem andar, so existe com interior e cai no ramo de cima). W/H cobre o
    // redimensionamento e reliefAmount cobre o botao Relevo.
    // Quem mexe na LISTA avisa por sujaRotulos(), nao por comparacao: rebuildOverlay()
    // refaz os rotulos inteiros quando o conjunto vivo muda e a lista volta com
    // elementos NOVOS, que nascem display:none -- as vezes no mesmo tamanho. Testado:
    // com `labels.length` como chave, andar pela cidade apagava o rotulo de rua e ele
    // so voltava quando alguma outra coisa invalidava a guarda.
    if (!_rotCam.equals(camera.position) || W !== _rotW || H !== _rotH ||
        reliefAmount !== _rotRel) _rotSujo = true;
    if (_rotSujo) {
      _rotCam.copy(camera.position); _rotW = W; _rotH = H;
      _rotRel = reliefAmount; _rotSujo = false;
      for (const l of labels) {
        l.v.copy(l.m); l.v.y += l.ym*reliefAmount; l.v.project(camera);
        if (l.v.z > 1 || Math.abs(l.v.x) > 1.05 || Math.abs(l.v.y) > 1.05) { l.el.style.display = "none"; continue; }
        l.v2.copy(l.b); l.v2.y += l.yb*reliefAmount; l.v2.project(camera);
        tmp.copy(l.a); tmp.y += l.ya*reliefAmount; tmp.project(camera);
        const ax = (tmp.x*0.5+0.5)*W, ay = (-tmp.y*0.5+0.5)*H;
        const bx = (l.v2.x*0.5+0.5)*W, by = (-l.v2.y*0.5+0.5)*H;
        if (Math.hypot(bx-ax, by-ay) < 78) { l.el.style.display = "none"; continue; }
        let ang = Math.atan2(by-ay, bx-ax);
        if (ang > Math.PI/2) ang -= Math.PI; else if (ang < -Math.PI/2) ang += Math.PI;
        l.el.style.display = "block";
        l.el.style.transform = `translate(${(l.v.x*0.5+0.5)*W}px,${(-l.v.y*0.5+0.5)*H}px) translate(-50%,-50%) rotate(${ang}rad)`;
      }
    }
  }
    }
    return {addStreets, recalcDyRotulos, sujaRotulos, hide, clear, update};
  }
  root.StreetLabels = {create};
})(globalThis);

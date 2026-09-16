/* Furniture editor grid, handles, shared-geometry preview and measurement labels. */
(function(root) {
  "use strict";
  function create({THREE, INT, MOB, MOB_VERDE, document, overlay, camera, redimensiona}) {
/* ---- a grade ----------------------------------------------------------- */
function fazGrade() {
  const pl = INT.pl;
  const lado = Math.ceil(Math.max(pl.ob.hu, pl.ob.hv) * 2 + 2);
  // Teto de divisoes: numa planta de 30 m a grade de 10 cm sao 600 linhas que
  // leem como cinza chapado. Passando disso ela afina pro dobro do passo.
  let div = Math.round(lado / MOB.passo);
  if (div > 200) div = Math.round(div / 2);
  const g = new THREE.GridHelper(lado, div, 0xFFFFFF, MOB_VERDE);
  g.material.transparent = true; g.material.opacity = 0.55;
  g.material.depthWrite = false;
  /* `toneMapped = false`, pelo mesmo motivo que o ceu do interior ja usa: dentro da
     casa a exposicao cai pra 0,58 e o ACES ainda comprime por cima. A grade nascia
     desenhada -- a contagem de chamadas subia de 107 pra 108 -- e mesmo assim
     invisivel no chao. Nao ha erro pra ver aqui: o pixel simplesmente empata com o
     piso. Sem tone mapping a linha sai na tela com a cor que esta escrita. */
  g.material.toneMapped = false;
  /* 2,6 cm, e o numero e apertado dos DOIS lados: o piso da casa e desenhado em
     y = 0,02 (ver `geoDaCasa`) e o movel assenta em y = 0,03. Um milimetro pra
     baixo e a grade some por z-fighting contra o proprio chao -- foi assim que
     ela nasceu, invisivel e sem erro nenhum; um centimetro pra cima e ela passa
     a flutuar por cima do tapete. */
  g.position.set(pl.ob.cx, 0.026, pl.ob.cz);
  g.rotation.y = Math.atan2(-pl.ob.uz, pl.ob.ux);
  return g;
}

/* ---- as setas ---------------------------------------------------------- */
/* Um cone por seta, e so o cone: com haste seriam dez chamadas de desenho pra
   enfeitar um gesto. O material ignora profundidade de proposito -- a seta que
   some atras do proprio armario e uma seta que nao da pra pegar. */
const MOB_EIXOS = [{ k:"w", s: 1, lx: 1, lz: 0 }, { k:"w", s:-1, lx:-1, lz:0 },
                   { k:"d", s: 1, lx: 0, lz: 1 }, { k:"d", s:-1, lx: 0, lz:-1 },
                   { k:"h", s: 1, lx: 0, lz: 0 }];
const mobSetas = (() => {
  const gr = new THREE.Group();
  const geo = new THREE.ConeGeometry(0.075, 0.26, 10);
  for (const e of MOB_EIXOS) {
    const mat = new THREE.MeshBasicMaterial({ color:MOB_VERDE, transparent:true,
                                              opacity:0.92, depthTest:false,
                                              toneMapped:false });   // ver fazGrade()
    const o = new THREE.Mesh(geo, mat);
    o.renderOrder = 6; o.userData.eixo = e;
    gr.add(o);
  }
  gr.visible = false;
  return gr;
})();

function poeSetas() {
  const m = INT.moveis[INT.sel];
  mobSetas.visible = !!(m && MOB.on && MOB.modo === "medir");
  if (!mobSetas.visible) return;
  const p = INT.pl.W(m.u, m.v);
  mobSetas.position.set(p[0], INT.baseY, p[1]);
  mobSetas.rotation.y = m.obj.rotation.y;
  const alto = Math.max(0.10, m.h);
  for (const o of mobSetas.children) {
    const e = o.userData.eixo;
    if (e.k === "h") {
      o.position.set(0, alto + 0.20, 0);
      o.rotation.set(0, 0, 0);
    } else {
      const dist = (e.k === "w" ? m.w : m.d)/2 + 0.17;
      o.position.set(e.lx * dist, alto/2, e.lz * dist);
      // O cone nasce apontando pro +Y; deitar pro eixo certo e um giro de 90 graus
      // sobre Z (pro X) ou sobre X (pro Z), com o sinal fazendo a ponta virar.
      if (e.k === "w") o.rotation.set(0, 0, -e.s * Math.PI/2);
      else             o.rotation.set(e.s * Math.PI/2, 0, 0);
    }
  }
  mobSetas.updateMatrixWorld(true);
}

/* ---- o fantasma -------------------------------------------------------- */
const matFantasma = new THREE.MeshBasicMaterial({ color:MOB_VERDE, transparent:true,
                                                  opacity:0.22, depthWrite:false,
                                                  toneMapped:false });   // ver fazGrade()
function poeFantasma(m) {
  tiraFantasma();
  /* Montado a mao, e NAO com `m.obj.clone()`. O clone do three copia o userData
     assim: `JSON.parse(JSON.stringify(source.userData))` -- e o userData de todo
     movel guarda `movel`, que aponta de volta pro proprio objeto. Clonar estourava
     em "Converting circular structure to JSON", ou seja: o botao Mover quebrava.

     A geometria e COMPARTILHADA de proposito (e so uma vista translucida da mesma
     malha), e por isso `tiraFantasma` remove da cena sem chamar dispose(): liberar
     aqui apagaria o movel de verdade. */
  const g = new THREE.Group();
  for (const o of m.obj.children) {
    if (!o.isMesh) continue;
    const c = new THREE.Mesh(o.geometry, matFantasma);
    c.position.copy(o.position); c.quaternion.copy(o.quaternion); c.scale.copy(o.scale);
    g.add(c);
  }
  g.position.copy(m.obj.position); g.quaternion.copy(m.obj.quaternion);
  g.scale.copy(m.obj.scale);
  MOB.fantasma = g;
  INT.raiz.add(g);
}
function tiraFantasma() {
  if (MOB.fantasma && INT.raiz) INT.raiz.remove(MOB.fantasma);
  MOB.fantasma = null;
}

/* ---- campos de medida (DOM, como os rotulos de comodo) ----------------- */
const MOB_MED = [{ k:"w", nome:"L" }, { k:"d", nome:"P" }, { k:"h", nome:"A" }];
const mobMed = MOB_MED.map(c => {
  const el = document.createElement("div");
  el.className = "med";
  el.appendChild(Object.assign(document.createElement("b"), { textContent:c.nome }));
  const inp = document.createElement("input");
  inp.type = "text"; inp.inputMode = "decimal"; inp.setAttribute("aria-label", "Medida");
  el.appendChild(inp);
  el.appendChild(Object.assign(document.createElement("b"), { textContent:"m" }));
  // Digitar a medida cresce pelo MESMO lado que a seta "+": manter a face oposta
  // parada e o unico comportamento que casa com o gesto.
  const aplica = () => {
    const m = INT.moveis[INT.sel]; if (!m) return;
    const v = parseFloat(String(inp.value).replace(",", "."));
    if (isFinite(v)) redimensiona(m, c.k, v, 1);
    pintaMedidas();
  };
  inp.addEventListener("change", aplica);
  inp.addEventListener("keydown", e => { if (e.key === "Enter") { aplica(); inp.blur(); } });
  el.style.display = "none";
  overlay.appendChild(el);
  return { c, el, inp, v:new THREE.Vector3() };
});
function pintaMedidas() {
  const m = INT.moveis[INT.sel];
  for (const q of mobMed)
    if (m && document.activeElement !== q.inp)
      q.inp.value = m[q.c.k].toFixed(2).replace(".", ",");
}
// Chamado de dentro do laco de quadro, junto dos rotulos de comodo e pelo mesmo
// motivo: sem a matriz da camera do quadro CORRENTE o campo arrasta atras da seta.
function posicionaMedidas(W2, H2) {
  const m = INT.moveis[INT.sel], liga = !!(m && mobSetas.visible);
  for (const q of mobMed) {
    if (!liga) { q.el.style.display = "none"; continue; }
    const alvo = mobSetas.children[q.c.k === "w" ? 0 : q.c.k === "d" ? 2 : 4];
    q.v.setFromMatrixPosition(alvo.matrixWorld).project(camera);
    if (q.v.z > 1 || Math.abs(q.v.x) > 1.1 || Math.abs(q.v.y) > 1.1) {
      q.el.style.display = "none"; continue;
    }
    q.el.style.display = "flex";
    q.el.style.left = ((q.v.x*0.5 + 0.5) * W2) + "px";
    q.el.style.top  = ((-q.v.y*0.5 + 0.5) * H2 + 14) + "px";
  }
}


    return {fazGrade, mobSetas, poeSetas, poeFantasma, tiraFantasma, mobMed,
      pintaMedidas, posicionaMedidas};
  }
  root.EditorVisuals = Object.freeze({create});
})(globalThis);

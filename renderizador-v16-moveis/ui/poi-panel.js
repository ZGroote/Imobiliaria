/* Estabelecimentos: marcador, ficha, categorias, pinos e "o que tem por perto". */
(function(root) {
  "use strict";
  function create({THREE, document, $, esc, overlay, scene, camera, sph, target, POIS, CAT,
                   CAT_KEYS, PoiLayer, terrainY, registerTerrain, POI_HALO, POI_Y, POI_MAX,
                   POI_NAME, usheet, hsheet, houseBeacon, flyTo, streamUpdate, getInterior,
                   getRelevo}) {
function recalcDyPois() { for (const p of POIS) p.dy = terrainY(p.x, p.z); }
recalcDyPois();
// Camera parada = marcador parado. Ver a guarda no updatePois.
const _poiCam = new THREE.Vector3(1e9, 0, 1e9);
let _poiW = 0, _poiH = 0, _poiRel = -1, _poiSelAnt = 0, _poiSujo = true;
function sujaPois() { _poiSujo = true; }

const {group:gPoi, layer:poiLayer} = PoiLayer.create({THREE, pois:POIS, cat:CAT, terrainY,
  registerTerrain, document, haloRadius:POI_HALO, beamTop:POI_Y});
scene.add(gPoi);

/* --- marcadores HTML --- */
const catOn = {};
let poiSel = null;

const psheet = $("psheet");
function closePoiSheet() {
  psheet.classList.remove("on");
  if (poiSel) { poiSel.el.classList.remove("sel"); poiSel = null; }
}
function openPoiSheet(p) {
  // Com o pino apagado (o padrao do v13) o marcador do POI nao existe na tela -- e
  // esta ficha pode vir da BUSCA, que nao passa pelo "por perto". Acender aqui e o
  // que faz "procurei a farmacia pelo nome" mostrar a farmacia.
  //
  // Os DOIS interruptores, nao so o grupo: depois de uma passada pelo "por perto" as
  // categorias ficam todas desligadas, e `updatePois` esconde marcador de categoria
  // desligada. Só `setPins` deixava a busca levando a camera pra um pino invisivel.
  setPins(true);
  aplicaCat(p.c, true);
  if (poiSel) poiSel.el.classList.remove("sel");
  poiSel = p; p.el.classList.add("sel");
  psheet.style.setProperty("--pc", p.cfg.col);
  $("pIc").innerHTML = '<svg viewBox="0 0 24 24">' + p.cfg.ic + '</svg>';
  $("pTag").textContent = p.cfg.curto;
  $("pName").textContent = p.n;
  const rows = [["Endereço", p.a], ["Horário", p.h], ["Telefone", p.t], ["Site", p.w]]
    .filter(r => r[1]);
  if (!p.a) rows.unshift(["Endereço", "não mapeado no OSM"]);
  $("pMeta").innerHTML = rows.map(r => '<div><span>' + r[0] + '</span>' + esc(r[1]) + '</div>').join("");
  $("pLink").href = "https://www.google.com/maps/dir/?api=1&destination=" + p.lat + "," + p.lon;
  psheet.classList.add("on");
  // Fora do "por perto", abrir a ficha de um lugar fecha a do imovel. DENTRO dele, a
  // tira fica: e ela que responde "perto de que?" -- e o CSS empilha as duas no rodape.
  if (!PERTO.on) { hsheet.classList.remove("on"); usheet.classList.remove("on"); }
  else minimizaFicha(true);
  // Dentro do "por perto" o farol NAO se apaga: e ele que continua dizendo qual dos
  // pontos do mapa e o imovel enquanto se olha os estabelecimentos em volta.
  if (!PERTO.on) houseBeacon.visible = false;
  flyTo(p.x, p.z, Math.min(sph.radius, 320));
}
$("px").addEventListener("click", () => {
  closePoiSheet();
  // Dentro do "por perto" o mapa continua aceso (foi pra isso que se entrou); fora
  // dele, o pino so estava ligado por causa DESTA ficha, e sem o botao Pins na tela
  // esta e a unica forma de apaga-lo.
  if (!PERTO.on) setPins(false);
});

for (const p of POIS) {
  const el = document.createElement("div");
  el.className = "poi";
  el.style.setProperty("--pc", p.cfg.col);
  el.innerHTML = '<div class="ic"><svg viewBox="0 0 24 24">' + p.cfg.ic + '</svg></div>' +
                 '<div class="nm">' + esc(p.n) + '</div>';
  el.style.display = "none";
  el.addEventListener("click", () => openPoiSheet(p));
  overlay.appendChild(el);
  p.el = el;
}
// Larguras medidas de uma vez so: ler offsetWidth marcador a marcador dentro do
// laco de render forcaria um reflow por quadro.
requestAnimationFrame(() => {
  for (const p of POIS) { p.el.style.display = "flex"; p.nw = p.el.offsetWidth; p.el.style.display = "none"; }
});

/* --- categorias: quem liga e desliga --------------------------------------
   A barra de chips do topo saiu da tela no v12 e NAO volta: o filtro agora e a coluna
   do "O que tem por perto?", logo abaixo, que so existe com um imovel escolhido.
   `catOn` continua sendo a fonte da verdade -- o que mudou foi quem escreve nele. */
const nChips = {};                       // categoria -> botao da coluna
for (const k of CAT_KEYS) if (POIS.some(p => p.c === k)) catOn[k] = true;

function aplicaCat(k, on) {
  if (!(k in catOn)) return;
  catOn[k] = on;
  sujaPois();
  for (const o of (poiLayer[k] || [])) o.visible = on;
  if (!on && poiSel && poiSel.c === k) closePoiSheet();
  if (nChips[k]) nChips[k].setAttribute("aria-pressed", String(on));
}

/* O PINO NASCE APAGADO (v13). Abrir a cidade com mil e duzentos marcadores acesos poe
   na frente do usuario justamente o que ele ainda nao veio ver: o estabelecimento so
   interessa DEPOIS de escolher um imovel. Tres coisas acendem, e nenhuma delas e o
   boot: o "O que tem por perto?", a busca (quem procura uma farmacia pelo nome quer ver
   o pino dela) e o botao Pins, que segue existindo como orfao. */
let poiHidden = true;
gPoi.visible = false;
$("tPins").setAttribute("aria-pressed", "false");
function setPins(on) {
  on = !!on;
  $("tPins").setAttribute("aria-pressed", String(on));
  if (on === !poiHidden) return;
  poiHidden = !on; gPoi.visible = on; sujaPois();
  if (poiHidden && poiSel) closePoiSheet();
}
$("tPins").addEventListener("click",
  () => setPins($("tPins").getAttribute("aria-pressed") !== "true"));

/* --- a coluna "O que tem por perto?" --------------------------------------
   O modo tem dono: um imovel. Ele centraliza a camera nele, abre o campo de visao pra
   caber a vizinhanca, acende os pinos e mostra ESTA coluna -- e sair dele apaga os
   pinos de novo. A contagem e por RAIO, nao pela cidade inteira: "12 farmacias" so
   responde "o que tem por perto" se as 12 estiverem perto. */
const PERTO_R = 1000;              // o raio da pergunta, em metros
const PERTO_ZOOM = 900;            // a que distancia a camera para depois de abrir
const nearbyBox = $("nearby");
const nList = $("nList");
for (const k of CAT_KEYS) {
  if (!(k in catOn)) continue;
  const b = document.createElement("button");
  b.className = "ncat";
  b.setAttribute("aria-pressed", "true");
  b.style.setProperty("--pc", CAT[k].col);
  b.title = CAT[k].lbl + " \u2014 clique para mostrar ou esconder no mapa";
  b.innerHTML = '<i></i><span>' + CAT[k].lbl + '</span><b>0</b>';
  b.addEventListener("click", () => aplicaCat(k, b.getAttribute("aria-pressed") !== "true"));
  nChips[k] = b;
  nList.appendChild(b);
}
$("nAll").addEventListener("click", () => { for (const k in nChips) aplicaCat(k, true); });
$("nNone").addEventListener("click", () => { for (const k in nChips) aplicaCat(k, false); });

const PERTO = { on: false, volta: null };
// ctx: { x, z, nome, volta } -- `volta` e o que reabre a ficha de onde se veio.
function abrePerto(ctx) {
  PERTO.on = true; PERTO.volta = ctx.volta || null;
  document.body.classList.add("perto");
  const n = PoiLayer.contaPerto(POIS, ctx.x, ctx.z, PERTO_R);
  // Mais perto primeiro. Ordem fixa esconderia a diferenca entre um apartamento no
  // centro e um no anel externo, que e exatamente o que a pergunta quer ver.
  // appendChild de um elemento que JA esta no pai e uma mudanca de lugar, nao uma
  // copia: a lista se reordena sem recriar botao nem perder o ligado/desligado.
  const ord = Object.keys(nChips)
    .sort((a, b) => (n[b] || 0) - (n[a] || 0) || CAT[a].pri - CAT[b].pri);
  let total = 0;
  for (const k of ord) {
    const b = nChips[k];
    b.querySelector("b").textContent = n[k] || 0;
    b.classList.toggle("vazio", !n[k]);
    // TODAS APAGADAS ao abrir. Acender as 21 de uma vez devolve a sopa de icone que o
    // pino apagado no boot foi feito pra evitar -- so que agora em cima do imovel. A
    // coluna passa a ser a pergunta ("me mostre farmacia"), nao a faxina.
    aplicaCat(k, false);
    nList.appendChild(b);
    total += n[k] || 0;
  }
  const raio = PERTO_R >= 1000 ? (PERTO_R / 1000).toLocaleString("pt-BR") + " km"
                               : PERTO_R + " m";
  $("nSub").textContent = total + " estabelecimento" + (total === 1 ? "" : "s") +
    " a menos de " + raio + " de " + (ctx.nome || "aqui") +
    ". Clique numa categoria para mostr\u00e1-la no mapa.";
  $("nBack").hidden = !PERTO.volta;
  nearbyBox.classList.add("on");
  setPins(true);
  // A ficha do imovel NAO fecha: encolhe pra tira e fica no mesmo canto de sempre.
  // Fechar apagava a resposta de "perto de QUE?" no instante em que ela passa a
  // importar -- e, com o mapa cheio de pino, o nome na tira e o unico texto que ainda
  // diz de quem e o farol. Uma das duas esta aberta; a classe na outra e inerte.
  minimizaFicha(true);
  closePoiSheet();
  // O farol fica ACESO o tempo todo aqui: sem ele, um mapa cheio de pino nao diz mais
  // qual dos pontos e o imovel.
  houseBeacon.position.set(ctx.x, 0, ctx.z);
  houseBeacon.visible = true;
  target.set(ctx.x, 0, ctx.z);
  streamUpdate(true);
  flyTo(ctx.x, ctx.z, PERTO_ZOOM);
}
// A tira e um estado da ficha, nao uma segunda ficha: o mesmo cartao, com `min`. Uma
// das duas esta aberta de cada vez; a classe na outra e inerte.
function minimizaFicha(sim) {
  sim = !!sim;
  usheet.classList.toggle("min", sim);
  hsheet.classList.toggle("min", sim);
  if (sim) { usheet.scrollTop = 0; hsheet.scrollTop = 0; }
  const seta = sim ? "\u25b4" : "\u25be";
  $("uDobra").textContent = seta;
  $("hDobra").textContent = seta;
}
function fechaPerto(voltando) {
  if (!PERTO.on) return;
  PERTO.on = false;
  document.body.classList.remove("perto");
  nearbyBox.classList.remove("on");
  setPins(false);
  closePoiSheet();
  minimizaFicha(false);
  if (voltando && PERTO.volta) PERTO.volta();
  else {
    // O x da coluna sai do modo E limpa o mapa. Como a ficha ficou aberta (minimizada)
    // o tempo todo, agora e aqui que ela fecha de verdade.
    usheet.classList.remove("on"); hsheet.classList.remove("on");
    houseBeacon.visible = false;
  }
}
$("nx").addEventListener("click", () => fechaPerto(false));
$("nBack").addEventListener("click", () => fechaPerto(true));
// Clicar na tira reabre a ficha inteira, sem sair do "por perto" (a coluna continua a
// esquerda). O `x` segue FECHANDO: o teste pelo alvo e o que separa os dois cliques,
// ja que o do `x` sobe por este mesmo cartao.
// `$` e nao as constantes `usheet`/`hsheet`: estes ouvintes sao registrados na
// inicializacao do modulo, e a constante `usheet` so e avaliada 500 linhas abaixo --
// le-la aqui estoura na zona morta e derruba a pagina antes do primeiro quadro.
for (const g of [$("uDobra"), $("hDobra")])
  g.addEventListener("click", e => {
    e.stopPropagation();                 // senao o clique sobe e o cartao desfaz
    minimizaFicha(!$("usheet").classList.contains("min"));
  });
// Clicar em qualquer lugar da TIRA tambem abre -- o alvo de 58 px de altura e mais
// facil de acertar que a seta, e no estado aberto este atalho nao vale (senao ler a
// ficha encolheria ela).
//
// So no ESPACO VAZIO da tira, nunca num controle. Todo clique em botao/link/x dentro do
// cartao sobe por aqui, e o pior deles e o proprio "O que tem por perto?": o ouvinte
// dele minimiza, o clique borbulha, este ve `min` recem-posta e desfaz -- a ficha
// piscava e voltava inteira no mesmo gesto.
for (const cartao of [$("usheet"), $("hsheet")])
  cartao.addEventListener("click", e => {
    if (!cartao.classList.contains("min")) return;
    if (e.target.closest("button, a, .x, .dobra")) return;
    minimizaFicha(false);
  });
function updatePois() {
  // v9: dentro do imovel o marcador de estabelecimento nao tem o que fazer -- ele e
  // desenhado por cima de tudo (DOM) e vira uma fileira de pilulas atravessando a sala.
  const I = getInterior();          // o interior nasce depois deste modulo
  const dentro = !!(I && I.on);
  gPoi.visible = !dentro && !poiHidden;   // sem atropelar o botao Pins do usuario
  if (poiHidden || dentro) {
    for (const p of POIS) if (p.el.style.display !== "none") p.el.style.display = "none";
    sujaPois();   // voltar do imovel (ou religar os Pins) tem que redesenhar
    return;
  }
  const W = innerWidth, H = innerHeight, cam = camera.position, vis = [];
  /* Camera parada = marcador parado, e aqui isso vale mais que nos rotulos: sao 1.197
     POIs contra 104 visiveis (medido em Ribeirao). Projetar os 1.197 e reescrever o
     `style` de todos por quadro, pra posicionar os mesmos 104 pixels, e o maior item de
     CPU que sobrou no laco. `camera.position` resume alvo, theta, phi e raio; poiSel
     entra porque o selecionado ignora a colisao de rotulo e muda o resultado do
     empacotamento. Categoria, botao Pins e Relevo avisam por sujaPois(). */
  if (!_poiCam.equals(camera.position) || W !== _poiW || H !== _poiH ||
      getRelevo() !== _poiRel || poiSel !== _poiSelAnt) _poiSujo = true;
  if (!_poiSujo) return;
  _poiCam.copy(camera.position); _poiW = W; _poiH = H;
  _poiRel = getRelevo(); _poiSelAnt = poiSel; _poiSujo = false;
  const esconde = p => { if (p.el.style.display !== "none") p.el.style.display = "none"; };
  const P2 = POI_MAX*POI_MAX;
  for (const p of POIS) {
    if (!catOn[p.c]) { esconde(p); continue; }
    // A distancia vem ANTES da projecao, e sem Vector3: `project()` e uma multiplicacao
    // de matriz por POI, e a esmagadora maioria dos 1.197 esta alem dos 4.200 m de
    // POI_MAX. Antes projetava tudo pra so entao comparar a distancia.
    const py = POI_Y + p.dy*getRelevo();
    const ex = p.x - cam.x, ey = py - cam.y, ez = p.z - cam.z;
    const d2 = ex*ex + ey*ey + ez*ez;
    if (d2 > P2) { esconde(p); continue; }
    p.v.set(p.x, py, p.z).project(camera);
    if (p.v.z > 1 || Math.abs(p.v.x) > 1.15 || Math.abs(p.v.y) > 1.15) { esconde(p); continue; }
    p.d = Math.sqrt(d2);
    p.sx = (p.v.x*0.5 + 0.5)*W; p.sy = (-p.v.y*0.5 + 0.5)*H;
    vis.push(p);
  }
  // Mais perto primeiro; empate resolve pela prioridade da categoria, entao um
  // hospital nunca e escondido por uma mercearia colada nele.
  vis.sort((a, b) => (a.d - b.d) || (a.cfg.pri - b.cfg.pri));
  const placed = [];
  for (const p of vis) {
    const s = Math.max(0.66, Math.min(1, 1000/(p.d + 380)));
    if (p !== poiSel) {
      let hit = false;
      for (const q of placed)
        if (Math.abs(q.sx - p.sx) < 31 && Math.abs(q.sy - p.sy) < 25) { hit = true; break; }
      if (hit) { esconde(p); continue; }
    }
    let name = p.d < POI_NAME || p === poiSel;
    if (name) {
      const w = p.nw * s;
      for (const q of placed)
        if (Math.abs(q.sy - p.sy) < 20 && q.sx > p.sx && q.sx < p.sx + w + 26) { name = false; break; }
    }
    p.el.classList.toggle("mini", !name);
    p.el.style.display = "flex";
    p.el.style.zIndex = String(8000 - Math.round(Math.min(7900, p.d)));
    p.el.style.transform = "translate(" + p.sx.toFixed(1) + "px," + p.sy.toFixed(1) + "px)" +
                           " translate(-15px,-15px) scale(" + s.toFixed(3) + ")";
    placed.push(p);
  }
}

    // `catOn` e o estado do pino saem porque o minimapa e a sonda de diagnostico leem
    // os dois: quem desenha o pino no quadradinho precisa saber o que esta aceso.
    return {recalcDyPois, sujaPois, closePoiSheet, openPoiSheet, aplicaCat, setPins,
            abrePerto, fechaPerto, minimizaFicha, updatePois, PERTO, catOn,
            pinoOculto: () => poiHidden};
  }
  root.PoiPanel = Object.freeze({create});
})(globalThis);

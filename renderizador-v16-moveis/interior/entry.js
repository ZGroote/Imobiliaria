/* Entrar, sair e olhar a unidade: compoe planta, casa, luz, sonda e voo da camera. */
(function(root) {
  "use strict";
  function create({THREE, document, $, camera, target, sph, gInteriores, INT, FP, TOQUE,
                   OLHO, LV, CORTE, CORTE_OFF, CORTE_OMBRO, NEAR_CASA, FAR_CASA,
                   NEAR_CIDADE, FAR_CIDADE, FOV_CIDADE, fovInterior, terrainY, getRelevo,
                   streamUpdate, sujaSombra, uFuro, selBox, BAKE, plantaDaUnidade,
                   unidadeDoPredio, predioDaUnidade, geoDaCasa, leMoveis, poeNaCena,
                   criaRotulos, pontoDeEntrada, melhorDirecao, livre, quatOlhando,
                   acendeInterior, apagaInterior, sondaDeAmbiente, soltaSonda, modoMoveis,
                   mostraJoy, pintaCatalogo, pintaEditor, fechaPerto, setPins, closePoiSheet,
                   hsheet, usheet, ipanel, houseBeacon, housesBox, poeTipoNulo}) {
function baseDaCasa(pl) {
  let by = terrainY(pl.mx, pl.mz);
  for (const p of pl.rec.r) { const t = terrainY(p[0], p[1]); if (t > by) by = t; }
  return by * getRelevo() + (pl.andar || 0) * LV;
}

// So entra em imovel CADASTRADO. Nao ha mais interior generico: cada unidade nasce de
// planta e material fornecidos, e predio sem cadastro nao abre porta nenhuma.
function enterInterior(rec, unidade) {
  const u = unidade || unidadeDoPredio(rec);
  if (!u) return;
  const pl = plantaDaUnidade(rec, u);
  if (!pl) return;
  if (INT.on || INT.raiz) descarta();
  INT.pl = pl;
  INT.baseY = baseDaCasa(pl);
  INT.raiz = new THREE.Group();
  INT.raiz.position.y = INT.baseY;
  gInteriores.add(INT.raiz);
  INT.teto = true;                     // unidade fechada tem forro; sem ele o "fora"
  $("iteto").setAttribute("aria-pressed", "true");   // volta a aparecer por cima
  INT.casa = geoDaCasa(pl, INT.teto);
  INT.raiz.add(INT.casa);
  acendeInterior(pl);
  INT.moveis = leMoveis(pl.id) || pl.moveis;
  for (const m of INT.moveis) poeNaCena(m);
  criaRotulos(pl);

  INT.salvo = { tx:target.x, tz:target.z, r:sph.radius, phi:sph.phi, theta:sph.theta };
  INT.on = true; INT.fp = false; INT.orbita = false; INT.sel = -1; selBox.visible = false; poeTipoNulo();
  target.set(pl.cx, 0, pl.cz);
  streamUpdate(true);

  const e = pontoDeEntrada(pl);
  FP.pos.set(e[0], 0, e[1]);
  // camera olha em -Z girado por yaw: frente = (-sen, -cos). Mira no centro da sala.
  FP.yaw = melhorDirecao(e[0], e[1]);
  // Tela em pe: o campo vertical e enorme e a mira reta enche o quadro de teto e
  // parede. Abaixar o olhar poe piso e movel de volta na cena.
  FP.pitch = innerHeight > innerWidth ? -0.26 : -0.12;
  // O corte começa perto do telhado e desce junto com a câmera: aparecer já
  // cortado seria um salto, e vir do infinito faria a cidade inteira piscar.
  camera.near = NEAR_CASA; camera.far = FAR_CASA;
  camera.fov = fovInterior(false); camera.updateProjectionMatrix();
  CORTE.constant = CORTE_OFF;
  INT.corteAlvo = alturaDoCorte();
  aplicaFuro();

  // Depois do furo, e so aqui: antes dele a casca do predio ainda tapa a
  // janela, e a sonda capturaria a fachada por dentro no lugar da cidade.
  sondaDeAmbiente(pl);

  const dest = new THREE.Vector3(e[0], INT.baseY + OLHO, e[1]);
  const olha = new THREE.Vector3(e[0] - Math.sin(FP.yaw)*6, INT.baseY + OLHO - 0.3,
                                 e[1] - Math.cos(FP.yaw)*6);
  INT.voo = { t0:performance.now(), dur:1100,
              p0:camera.position.clone(), q0:camera.quaternion.clone(),
              p1:dest, q1:quatOlhando(dest, olha),
              fim:() => { INT.fp = true; } };

  hsheet.classList.remove("on"); usheet.classList.remove("on");
  fechaPerto(false); setPins(false);   // la dentro o pino nao opera nada -- e a saida
                                       // da casa nao deve devolver a cidade acesa
  houseBeacon.visible = false;
  closePoiSheet();
  document.body.classList.add("dentro");
  ipanel.classList.toggle("min", TOQUE);   // no celular abre recolhido: a tela e a vista
  // v16-moveis: toda visita comeca SEM o modo. O painel de mobilia em cima da
  // chegada era exatamente o que o v12 tirou da tela; o que voltou foi o botao.
  modoMoveis(false);
  mostraJoy(true);
  housesBox.style.display = "none";   // mesmo canto do painel de mobilia
  const fc = pl.unidade && pl.unidade.ficha;
  $("iName").textContent = fc ? (fc.empreendimento && fc.empreendimento !== "\u2014"
                                 ? fc.empreendimento : fc.titulo)
                              : ((rec && rec.name) || "Edificação sem nome");
  const comodos = pl.comodos.length + (pl.comodos.length === 1 ? " cômodo · " : " cômodos · ");
  $("iInfo").textContent = fc
    ? comodos + (fc.area_util || Math.round(pl.area)) + " m² · "
      + (pl.andar ? pl.andar + "º andar · " : "") + "planta do anúncio"
    : comodos + Math.round(pl.area) + " m² úteis · planta estimada";
  const conf = pl.unidade && predioDaUnidade(pl.unidade);
  // Em lote nao se troca predio: nao ha predio pra trocar, e oferecer a troca convidaria
  // a pendurar o lancamento no vizinho -- que e justamente o erro que o lote resolve.
  const emLote = !!(pl.rec && (pl.rec.lote || pl.rec.lancamento));
  $("iPredioRow").hidden = !pl.unidade || emLote;
  let av = $("iAncora");
  if (!av) { av = document.createElement("div"); av.id = "iAncora"; av.className = "naoconf";
             $("iPredioRow").parentNode.insertBefore(av, $("iPredioRow")); }
  av.hidden = !(pl.unidade && conf && !conf.confirmado);
  av.textContent = emLote
    ? "Terreno ainda não confirmado — a planta está assentada na coordenada do endereço."
    : "Prédio ainda não confirmado — foi escolhido pela pista do anúncio. "
      + "Use \u201cTrocar prédio\u201d para apontar o certo.";
  pintaCatalogo(); pintaEditor();
}

function descarta() {
  if (INT.raiz) {
    INT.raiz.traverse(o => { if (o.geometry) o.geometry.dispose(); });
    gInteriores.remove(INT.raiz);
  }
  for (const r of INT.rotulos) r.el.remove();
  INT.rotulos = []; INT.raiz = null; INT.casa = null; INT.moveis = []; INT.pl = null;
  selBox.visible = false; INT.sel = -1;
  // bake pendente aponta pra malha que acabou de ser descartada: continuar
  // gastaria quadro pra escrever num buffer que nao esta mais na tela.
  BAKE.fila = null;
  soltaSonda();
}

function exitInterior() {
  if (!INT.on) return;
  const S = INT.salvo;
  INT.fp = false; INT.orbita = false;
  $("ivista").setAttribute("aria-pressed", "false");
  INT.corteAlvo = CORTE_OFF;
  camera.near = NEAR_CIDADE; camera.far = FAR_CIDADE;
  camera.fov = FOV_CIDADE; camera.updateProjectionMatrix();
  const alvo = new THREE.Vector3(S.tx, terrainY(S.tx, S.tz)*getRelevo(), S.tz);
  const dest = new THREE.Vector3().setFromSpherical(
    new THREE.Spherical(S.r, S.phi, S.theta)).add(alvo);
  INT.voo = { t0:performance.now(), dur:900,
              p0:camera.position.clone(), q0:camera.quaternion.clone(),
              p1:dest, q1:quatOlhando(dest, alvo),
              fim:() => {
                target.set(S.tx, 0, S.tz);
                sph.set(S.r, S.phi, S.theta);
                INT.on = false; descarta(); aplicaFuro(); apagaInterior(); streamUpdate(true);
              } };
  modoMoveis(false);
  document.body.classList.remove("dentro");
  mostraJoy(false);
  housesBox.style.display = "";
}

// Saída sem voo de volta: pra quem já vai reposicionar a câmera por conta
// própria (o botão Centro), animar o retorno só brigaria com o destino dele.
function saiSeco() {
  if (!INT.on) return;
  INT.on = false; INT.fp = false; INT.orbita = false; INT.voo = null;
  $("ivista").setAttribute("aria-pressed", "false");
  INT.corteAlvo = CORTE_OFF;
  camera.near = NEAR_CIDADE; camera.far = FAR_CIDADE;
  camera.fov = FOV_CIDADE; camera.updateProjectionMatrix();
  descarta(); aplicaFuro(); apagaInterior(); mostraJoy(false);
  document.body.classList.remove("dentro");
  modoMoveis(false); housesBox.style.display = "";
}

/* Duas vistas da mesma casa. Primeira pessoa responde "como é estar aqui"; a
   planta responde "onde ponho o sofá" -- e mobiliar de dentro, com a câmera na
   altura dos olhos e o móvel atrás de você, é sofrível. O corte continua no
   mesmo lugar nas duas: a planta é a mesma cena vista de cima, não outro modo. */
// Na primeira pessoa o corte fica logo acima do forro: quem está lá dentro quer
// a sala inteira em pé. Na planta ele desce pra cintura, que é onde a planta de
// arquitetura corta -- e é o que faz a casa toda aparecer de uma vez em vez de
// ficar metade escondida atrás da parede da frente.
/* De pe dentro do apartamento o corte SAI de cena: o furo ja tirou a casca que tapava
   a janela, e fatiar a cidade num plano na altura do ombro punha o bairro inteiro em
   maquete em volta de quem esta na sala. O corte volta so na vista de planta, que e
   onde ele serve pra alguma coisa -- ver por cima das proprias paredes. */
function alturaDoCorte() {
  if (!INT.on) return CORTE_OFF;
  return INT.orbita ? INT.baseY + CORTE_OMBRO : CORTE_OFF;
}
function aplicaFuro() {
  const f = INT.on && INT.pl && INT.pl.furo;
  // Altura minima BEM abaixo do terreno: o furo apaga a torre inteira, nao so o que
  // esta acima do piso da unidade. Cortando so o de cima, quem olha pela janela e
  // enxerga um pouco pra baixo ve a propria fachada do predio em que esta -- que foi
  // exatamente o que apareceu: uma grade de janelas ocupando metade da vista.
  if (f) uFuro.value.set(f.cx, f.cz, f.r, -100000);
  else uFuro.value.set(0, 0, 0, 0);
  sujaSombra();   // entrar e sair troca a caixa da câmera de sombra (ver enterInterior)
}
function vista(planta) {
  if (!INT.on) return;
  INT.orbita = planta; INT.fp = !planta;
  mostraJoy(!planta);                 // na planta se arrasta e pinca, nao se anda
  camera.fov = fovInterior(planta);
  camera.updateProjectionMatrix();
  INT.corteAlvo = alturaDoCorte();
  if (planta) CORTE.constant = INT.baseY + Math.max(6, INT.pl.h + 3);   // desce de cima
  if (planta) {
    target.set(INT.pl.cx, 0, INT.pl.cz);
    sph.set(Math.max(13, INT.pl.ob.hu * 2.6), 0.72, sph.theta);
  } else if (!livre(FP.pos.x, FP.pos.z)) {
    const e = pontoDeEntrada(INT.pl);   // saiu andando na planta e parou num móvel
    FP.pos.set(e[0], 0, e[1]);
  }
  $("iDica").textContent = planta
    ? (TOQUE ? "Arraste para mover a vista · dois dedos aproximam e giram · toque para escolher" : "Arrastar gira · roda aproxima · clicar escolhe e move")
    : (TOQUE ? "Use o controle circular para andar · arraste a vista para olhar" : "W A S D anda · arrastar olha · clicar escolhe · R gira");
}

    return {baseDaCasa, enterInterior, descarta, exitInterior, saiSeco, alturaDoCorte,
            aplicaFuro, vista};
  }
  root.InteriorEntry = Object.freeze({create});
})(globalThis);

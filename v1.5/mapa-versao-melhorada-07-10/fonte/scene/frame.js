/* O laco: UM requestAnimationFrame, com a ordem de atualizacao explicita. */
(function(root) {
  "use strict";
  /* `requestAnimationFrame` e `performance` NAO entram por parametro de proposito: o
     original os lia da janela a cada chamada, e a sonda do QA TROCA o rAF da janela pra
     congelar o laco e andar quadro a quadro. Capturar o original aqui deixava a pagina
     agendando quadros por fora do teste -- medido: as duas luzes do interior trocavam de
     slot (`chaveLuz` "1,0" virava "0,1"). Ligacao tardia e o comportamento, nao descuido. */
  function create({THREE, document, $, scene, camera,
                   renderer, target, sph, sun, SOL_OFF, SOMBRA_CIDADE, CEU, INT, BAKE,
                   governa, ajustaEsferas, resize, risers, mark, markMat, fillMat,
                   houseBeacon, houseBeaconMat, terrainYCached, bakePasso, interiorFrame,
                   streetLabels, vegetation, refazPortoes, refazSombras, alvoSombra,
                   updatePois, streamUpdate, streamPump, v12Frame, nevoaDoQuadro, pintaPerf,
                   sujaSombra, sombraDoQuadro, sujaContato, contatoSujo,
                   sombraPendente, limpaSombra,
                   getRelevo, mostraRotulos, getUrban, getExteriors, poeCpuMs, semRaf,
                   getWidth, getHeight,
                   // A escada das tres etapas (listings/stage.js).
                   PLANTA, plantaFrame, tourPassa, passoDoTempo, marcaTempo,
                   passoMaquete, desenhaMaquete,
                   // v2 (mapa melhorado): desenho sob demanda -- ver scene/sob-demanda.js.
                   animando, luzes, uniformes, contaQuadro, limiarSombra, revelando}) {
/* ---- desenho sob demanda (v2) ------------------------------------------------
   A passada de desenho so roda quando a ASSINATURA do quadro muda (camera, projecao,
   tela, sol, luzes, neblina, uniformes globais), quando o contador de mudanca de
   conteudo anda (SobDemanda: geometria, material, textura, objeto que entra, sai ou
   some), ou enquanto alguma coisa anima. Parado, o laco continua acordando a cada
   quadro, mas so para fazer essas contas -- nenhum triangulo vai para a GPU. */
const SD = globalThis.SobDemanda || null;
const _assin = new Float64Array(64), _assinAnt = new Float64Array(64);
let _versaoAnt = -1, _desenhouAnt = true;
function assina(W, H) {
  let k = 0;
  const e = camera.matrixWorld.elements, p = camera.projectionMatrix.elements;
  for (let i = 0; i < 16; i++) _assin[k++] = e[i];
  for (let i = 0; i < 16; i++) _assin[k++] = p[i];
  _assin[k++] = W; _assin[k++] = H; _assin[k++] = renderer.getPixelRatio();
  _assin[k++] = sun.position.x; _assin[k++] = sun.position.y; _assin[k++] = sun.position.z;
  if (luzes) k = luzes(_assin, k);
  if (scene.fog) { _assin[k++] = scene.fog.near; _assin[k++] = scene.fog.far;
                   _assin[k++] = scene.fog.color.r + scene.fog.color.g * 7 + scene.fog.color.b * 49; }
  if (uniformes) k = uniformes(_assin, k);
  while (k < 64) _assin[k++] = 0;
}
// Montagem em curso: o quarteirao novo entra na tela a cada REVELA ms, e nao em todo
// quadro -- desenhar a cidade inteira a cada quarteirao montado era o que fazia a
// montagem andar a um quarteirao por quadro desenhado.
const REVELA = 150;
let _ultimoDesenho = 0;
function precisaDesenhar(W, H, now) {
  if (!SD) return true;
  if ((animando && animando()) || SD.sujo() || sombraPendente()) return true;
  // A camera (ou a luz, a tela) mudou: desenha ja, montando ou nao -- voo e gesto lisos.
  assina(W, H);
  for (let i = 0; i < 64; i++) if (_assin[i] !== _assinAnt[i]) return true;
  if (revelando && revelando()) return now - _ultimoDesenho >= REVELA;
  return SD.versao() !== _versaoAnt;
}
function frame(now) {
  // A etapa 3 tem laco proprio. O desvio e a PRIMEIRA linha de proposito: tudo que
  // vem abaixo fala de uma cidade que, na cena da planta, nao esta sendo desenhada.
  if (PLANTA.on) { marcaTempo(now); return plantaFrame(now); }
  const _dt = passoDoTempo(now);
  tourPassa(_dt);
  passoMaquete(now, _dt);
  const t0 = performance.now();
  // O governador mede o tempo ENTRE quadros desenhados: quadro pulado nao e quadro rapido.
  if (_desenhouAnt) governa(now);
  // Enquadramento do mapa de sombra pelo zoom: so faz algo com a chave de aparencia
  // `sombra_projetada` ligada; sem ela e uma chamada vazia.
  sombraDoQuadro();
  ajustaEsferas();   // v8: relevo/altura mudaram? a esfera de corte muda junto
  resize();
  // Prédio subindo é vértice se movendo no shader: a sombra tem que acompanhar.
  for (const r of risers) if (r.u.value < 1) { r.u.value = Math.min(1, (now - r.t0)/1100); sujaSombra(); }
  if (mark.visible) {
    const b = 0.5 + 0.5*Math.sin(now*0.005);
    markMat.opacity = 0.22 + b*0.42; fillMat.opacity = 0.03 + b*0.05;
  }
  if (houseBeacon.visible) {
    const b = 0.5 + 0.5*Math.sin(now*0.006);
    houseBeaconMat.opacity = 0.5 + b*0.45;
  }
  // v4: o alvo da orbita segue o relevo. O target nasce sempre com y=0
  // (target.set(p.x, 0, p.z)), mas o chao e deslocado pra cima por
  // terrainY()*getRelevo() -- e terrainY ja embute TERRAIN_EXAG=4.5. Num bairro
  // alto isso punha o terreno POR CIMA da camera: ela orbitava um ponto no nivel
  // do mar enquanto o chao subia centenas de metros, e a cena ficava tapada.
  // Afastar a camera nao resolveria, so afastaria um ponto que continua enterrado.
  target.y = terrainYCached(target.x, target.z) * getRelevo();
  // v15: o bake assenta ao longo dos quadros. DURANTE O VOO ele gasta o triplo:
  // um quadro perdido enquanto a câmera varre a sala não se vê, e é ali que está
  // quase todo o tempo disponível antes de alguém olhar pra parede parada. Depois
  // que a câmera para, volta ao gasto pequeno. Ver `bakePrepara`.
  if (BAKE.fila && bakePasso(BAKE.fila, INT.voo ? BAKE.orcVoo : BAKE.orcamento))
    BAKE.fila = null;
  // v9: o interior manda na camera enquanto durar o voo de entrada ou a
  // primeira pessoa; fora disso interiorFrame so cuida do plano de corte.
  interiorFrame(now);
  if (!INT.voo && (!INT.on || INT.orbita)) {
    camera.position.setFromSpherical(sph).add(target);
    camera.lookAt(target);
  }
  sun.position.set(target.x + SOL_OFF.x, SOL_OFF.y, target.z + SOL_OFF.z);
  sun.target.position.copy(target);
  camera.updateMatrixWorld();
  $("compass").firstElementChild.style.transform = `rotate(${sph.theta}rad)`;

  const W = getWidth(), H = getHeight();

  streetLabels.update({camera, W, H, reliefAmount: getRelevo(),
    interior: INT.on, showLab: mostraRotulos()});
  // v10: as arvores sao InstancedMesh por especie, refeitas quando o conjunto vivo
  // muda OU quando o alvo anda o bastante pra mudar quem esta dentro dos 1800 m.
  if (vegetation.trackTarget()) sujaContato();
  if (vegetation.dirty) { vegetation.refresh(); refazPortoes(); sujaSombra(); }
  if (contatoSujo()) { refazSombras(); sujaSombra(); }
  updatePois();
  streamUpdate(false);   // alvo mudou? recalcula o conjunto vivo
  streamPump();          // gasta ate STREAM_MS montando o que falta
  if (getUrban()) getUrban().flush();
  if(getExteriors())getExteriors().update(target.x,target.z,sph.radius,getRelevo(),INT.on,performance.now());

  /* A sombra só é redesenhada quando alguma coisa que a projeta mudou. O sol acompanha
     o alvo, então andar pela cidade invalida o mapa -- mas só depois de andar o
     bastante pra sombra sair do lugar: sub-metro não muda um pixel do mapa de sombra e
     custaria uma passada inteira da cena. Dentro de casa a cena é uma casa só (poucas
     chamadas de desenho) e o usuário mexe em móvel o tempo todo, então lá vale sempre
     redesenhar em vez de rastrear cada edição. */
  if (INT.on) sujaSombra();
  // v2: o limiar acompanha o tamanho do mapa de sombra (5% da meia-caixa). O mapa vale
  // no MUNDO (a matriz da sombra e a do ultimo desenho dela), entao andar 5% da caixa
  // ainda deixa 95% coberta; refazer a cada metro era uma passada da cena inteira por
  // metro andado.
  else if (alvoSombra.distanceToSquared(target) > (limiarSombra ? limiarSombra() : 1)) { alvoSombra.copy(target); sujaSombra(); }
  // Nos niveis fracos SOMBRA_CIDADE e false e nada na cidade projeta nem recebe: a
  // passada do mapa de sombra percorre o grafo inteiro pra desenhar nada e ainda paga
  // bind + clear do alvo de profundidade, a cada quadro em que o alvo anda 1 m.
  // Desligar `shadowMap.enabled` daria o mesmo, mas o three exige `needsUpdate` em TODO
  // material depois de trocar essa flag -- seria recompilar a cidade inteira na entrada
  // da casa, exatamente o congelamento que a nota do SOMBRA_CIDADE evita. INT.on ja
  // cobre a casa inteira, voo de entrada e de saida inclusive.
  v12Frame(now);   // busca/link/minimapa/noite -- ver secao 14
  nevoaDoQuadro();

  // A cupula do ceu anda com a camera: ela e um FUNDO, nao um lugar.
  if (CEU && CEU.visible) CEU.position.copy(camera.position);
  const desenha = precisaDesenhar(W, H, now);
  if (desenha) {
    // So consome o pedido de sombra no quadro que desenha: pulado, o pedido espera.
    renderer.shadowMap.needsUpdate = sombraPendente() && (SOMBRA_CIDADE || INT.on);
    limpaSombra();
    if (SD) { _versaoAnt = SD.versao(); assina(W, H); _assinAnt.set(_assin); }
    renderer.render(scene, camera);
    // A miniatura e um SEGUNDO render no mesmo quadro, recortado pelo painel. Vem depois
    // da cidade de proposito -- a tesoura limita tambem a limpeza, entao o que esta fora
    // do retangulo e a cidade que acabou de ser desenhada.
    desenhaMaquete();
    if (contaQuadro) contaQuadro();
    _ultimoDesenho = now;
  }
  _desenhouAnt = desenha;
  poeCpuMs(performance.now() - t0);
  pintaPerf(now);
  if (!semRaf()) requestAnimationFrame(frame);
}

    return frame;
  }
  root.SceneFrame = Object.freeze({create});
})(globalThis);

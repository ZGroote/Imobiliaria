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
                   sujaSombra, sujaContato, contatoSujo, sombraPendente, limpaSombra,
                   getRelevo, mostraRotulos, getUrban, getExteriors, poeCpuMs, semRaf,
                   getWidth, getHeight}) {
function frame(now) {
  const t0 = performance.now();
  governa(now);
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
  else if (alvoSombra.distanceToSquared(target) > 1) { alvoSombra.copy(target); sujaSombra(); }
  // Nos niveis fracos SOMBRA_CIDADE e false e nada na cidade projeta nem recebe: a
  // passada do mapa de sombra percorre o grafo inteiro pra desenhar nada e ainda paga
  // bind + clear do alvo de profundidade, a cada quadro em que o alvo anda 1 m.
  // Desligar `shadowMap.enabled` daria o mesmo, mas o three exige `needsUpdate` em TODO
  // material depois de trocar essa flag -- seria recompilar a cidade inteira na entrada
  // da casa, exatamente o congelamento que a nota do SOMBRA_CIDADE evita. INT.on ja
  // cobre a casa inteira, voo de entrada e de saida inclusive.
  renderer.shadowMap.needsUpdate = sombraPendente() && (SOMBRA_CIDADE || INT.on);
  limpaSombra();

  v12Frame(now);   // busca/link/minimapa/noite -- ver secao 14
  nevoaDoQuadro();

  // A cupula do ceu anda com a camera: ela e um FUNDO, nao um lugar.
  if (CEU && CEU.visible) CEU.position.copy(camera.position);
  renderer.render(scene, camera);
  poeCpuMs(performance.now() - t0);
  pintaPerf(now);
  if (!semRaf()) requestAnimationFrame(frame);
}

    return frame;
  }
  root.SceneFrame = Object.freeze({create});
})(globalThis);

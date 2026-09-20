/* ============================================================
   AS TRES ETAPAS E A CENA DA PLANTA
   ============================================================
   A visita tem tres etapas explicitas, e um link abre direto em qualquer uma:

     1. MAPA     -- a camera circula o predio sozinha, com a ficha aberta e 2,5 km de
                    cidade montada em volta;
     2. INTERIOR -- andar dentro do apartamento (o que o v12 ja fazia);
     3. PLANTA   -- a unidade vista de cima, numa CENA PROPRIA: sem cidade, sem
                    relevo, sem rua. So a planta, a mobilia e o fundo.

   `?imovel=<id>` escolhe o imovel; `?etapa=mapa|interior|planta` escolhe onde abrir.

   NADA AQUI RODA NO CARREGAMENTO, fora declarar. `renderer`, `$`, `QS`, `LUZ_PI` e
   `NIVEL` nascem no `app.js`, que e o ULTIMO modulo da lista -- ler qualquer um deles
   no corpo deste arquivo daria TDZ, e a sonda so diria "Renderer did not start". Por
   isso a montagem da cena, a leitura da URL e a ligacao dos botoes estao todas dentro
   de `iniciaEtapas()`, que o `app.js` chama no ponto certo.

   COMO ESTE ARQUIVO E LIGADO. `app.js` e um IIFE: `QS`, `renderer`, `$`, `INT` e o
   resto sao PRIVADOS dele. Um modulo irmao no topo do script nao enxerga nada disso --
   o sintoma e um `ReferenceError: QS is not defined` e a pagina nunca monta. Por isso
   aqui segue o mesmo contrato dos outros modulos: uma fabrica que recebe o que precisa.
   O que ainda nao existe na hora da criacao (o laco, o medidor, a URL) entra como
   funcao, nao como valor. */
(function(root) {
  "use strict";
  function create({THREE, $, QS, renderer, scene, camera, target, sph, gInteriores,
                   NIVEL, LUZ_PI, INT, FP, CORTE, UNIDADES, NEAR_CASA, FAR_CASA, BAKE,
                   TOQUE,
                   usheet, houseBeacon, housesBox, flyTo, setStreamRadius, sujaSombra,
                   fovInterior, alturaDoCorte, baseDaCasa, enterInterior, exitInterior,
                   vista, distribuiLuzes, modoMoveis, seleciona, poeTeto, mostraJoy,
                   pontoDeEntrada, melhorDirecao, livre, abreUnidade, getFicha, setFicha,
                   paraVoo, resize, frameLoop, bakePasso,
                   // Os que so nascem DEPOIS desta criacao -- ver a nota acima.
                   governa, interiorFrame, pintaPerf, marcaEtapaNaUrl, getFrame,
                   sombraPendente, limpaSombra, poeCpuMs, semRaf}) {
  const ETAPAS_NOMES = ["mapa", "interior", "planta"];
  let LINK_IMOVEL = "";
  let LINK_ETAPA = "mapa";
  // 2,5 km de raio a pedido. E quase o dobro de area do raio normal de 1.800 m
  // (2,5^2 / 1,8^2 = 1,93), entao ele NAO vira o padrao da pagina: vale so na chegada
  // pelo link direto, que e quando a cidade em volta do predio e o assunto. O orcamento
  // por quadro do `streamPump` continua o mesmo -- o que muda e quanto tempo ele leva
  // pra encher, nao o tamanho do engasgo.
  const RAIO_LINK = 2500;

  /* ---- a camera que circula o predio --------------------------------------
     Nao e "autoRotate do OrbitControls": aqui a orbita e `sph` (raio, phi, theta) e o
     giro e um incremento em theta por SEGUNDO, nao por quadro -- com passo por quadro a
     mesma volta levaria 12 s numa GPU e 90 s no rasterizador de software, e a diferenca
     apareceria como "o link do celular esta quebrado".

     Ela para no primeiro toque de quem chegou. Esse e o ponto: o giro existe pra mostrar
     o predio a quem acabou de abrir o link, e insistir em girar por cima da mao de quem
     ja esta arrastando e o defeito classico desse recurso. Quem quiser de volta tem o
     botao "Girar camera" na ficha. */
  const TOUR = { on:false, vel:0.19 };   // rad/s -- uma volta em ~33 s
  function tour(on) {
    const q = !!on && !PLANTA.on;
    if (q === TOUR.on) { pintaTour(); return; }
    TOUR.on = q;
    pintaTour();
    if (q) frameLoop();
  }
  function pintaTour() {
    const b = $("uGira");
    if (b) b.setAttribute("aria-pressed", String(TOUR.on));
  }
  // Chamada de dentro do laco. `dt` vem limitado: uma aba que voltou do segundo plano
  // entrega 8 s de uma vez, e sem o teto a camera daria tres voltas num quadro so.
  function tourPassa(dt) {
    if (!TOUR.on || INT.on || INT.voo) return;
    sph.theta += TOUR.vel * Math.min(0.1, Math.max(0, dt));
  }

  /* ============================================================
     v17. ETAPA 3: A PLANTA 3D NUMA CENA PROPRIA
     ============================================================
     Ate o v16 a "vista de planta" era a cidade inteira com um plano de corte na altura
     do ombro. Funcionava e custava caro: o quadro continuava montando quarteirao,
     plantando arvore, projetando rotulo de rua, redesenhando minimapa e pintando pino --
     tudo isso atras de um apartamento de 60 m2 que era o unico assunto da tela. E o
     bairro fatiado em volta atrapalhava justamente a leitura que a planta existe pra dar.

     Aqui a planta ganha `cenaPlanta`: fundo proprio, nevoa propria, tres luzes proprias
     e mais nada. A geometria NAO e duplicada -- quem muda de cena e o grupo
     `gInteriores` inteiro, que ja carrega a raiz da unidade (paredes, piso, esquadria,
     mobilia, plafom, interruptor e a grade do modo moveis), o contorno de selecao, o
     gizmo de setas e, desde este arquivo, tambem as luzes do interior. Trocar de etapa e
     um `add()`: nao remonta malha, nao realoca buffer e nao recompila material.

     Tres detalhes que o resto do arquivo cobra:

     - A UNIDADE ASSENTA EM y = 0. Na cidade ela mora em `baseDaCasa` (cota do terreno +
       andar x pe-direito de pavimento); aqui isso nao significa nada -- planta de 3o
       andar nao se desenha 9 m acima do papel. `INT.baseY` vira 0 enquanto durar a etapa,
       e tudo que deriva dele (corte, caixa de selecao, gizmo, altura da lampada) segue
       junto sem precisar saber da troca.
     - O CORTE CONTINUA SENDO O GLOBAL. `renderer.clippingPlanes` e do renderizador, nao
       da cena: o mesmo plano que fatiava o bairro fatia a planta, e por isso o botao
       "Paredes" e uma linha e nao um modo novo.
     - QUEM NAO E DESENHADO NAO E ATUALIZADO. O laco da etapa 3 e `plantaFrame`, e ele
       nao chama streaming, arvore, portao, pino, rotulo de rua nem minimapa. E o ganho
       que justifica a cena separada, e nao um efeito colateral dela.               */
  const cenaPlanta = new THREE.Scene();
  const PLANTA = { on:false, corta:true, chao:null, grade:null, key:null, fill:null,
                   hemi:null, salvo:null };
  /* A COR ESCRITA AQUI E A COR NA TELA. O resto do arquivo escreve hex CRU porque a
     paleta da cidade foi calibrada a olho contra a saida sRGB (ver a nota do
     `ColorManagement` la em cima) -- na pratica, cada hex daquela paleta e um valor
     LINEAR que so quem calibrou sabe como sai. Numa cena nova isso nao se herda: o
     primeiro fundo desta cena foi escrito 0x121820 (quase preto) e saiu #4A5561 na tela,
     um cinza-azulado de meio-tom. Aqui a conversao e explicita, entao o numero abaixo e
     o que se ve -- e so vale nesta cena, sem mexer em pixel nenhum da cidade. */
  const corTela = hex => {
    const c = new THREE.Color(hex);
    // Só quando a saída é sRGB (o padrão; `?srgb=0` desliga) -- sem a conversão de saída
    // o hex cru JA e a cor da tela, e converter aqui escureceria tudo pela segunda vez.
    if (renderer.outputColorSpace === THREE.SRGBColorSpace) c.convertSRGBToLinear();
    return c;
  };
  const PLANTA_FUNDO = 0x131A22;
  function montaCenaPlanta() {
    cenaPlanta.background = corTela(PLANTA_FUNDO);
    // A nevoa e curta de proposito: ela fecha o horizonte logo depois da planta, o que
    // faz a maquete "pousar" no escuro em vez de flutuar num vazio chapado. Os numeros
    // sao reescritos na entrada, pelo tamanho da unidade (ver `entraPlanta`).
    cenaPlanta.fog = new THREE.Fog(cenaPlanta.background.getHex(), 30, 90);

    /* Tres luzes, e o motivo de serem TRES e o mesmo do interior: a parede ja carrega o
       lightmap do bake (secao 15), entao o que falta aqui nao e iluminar -- e dar
       direcao. A principal desenha a sombra de contato do movel no piso; a de
       preenchimento (fria, do lado oposto) tira o preto do lado que nao pega a
       principal; a hemisferica so existe pras pecas SEM lightmap (batente, folha,
       caixilho, movel), que em luz zero viram silhueta preta no meio de parede clara. */
    const key = new THREE.DirectionalLight(0xFFF3E0, 1.35 * LUZ_PI);
    key.castShadow = true;
    key.shadow.mapSize.set(NIVEL.somMap >= 2048 ? 2048 : 1024, NIVEL.somMap >= 2048 ? 2048 : 1024);
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.02;
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 220;
    const fill = new THREE.DirectionalLight(0xB8CCE8, 0.42 * LUZ_PI);
    const hemi = new THREE.HemisphereLight(0xEAEFF6, 0x1D242D, 0.42 * LUZ_PI);
    cenaPlanta.add(key, key.target, fill, hemi);
    PLANTA.key = key; PLANTA.fill = fill; PLANTA.hemi = hemi;
  }

  /* O "chao" da etapa 3 nao e terreno: e a mesa em que a maquete esta. Ele existe por um
     motivo tecnico antes de estetico -- sem uma superficie embaixo, a sombra do movel e
     da parede cai no nada e a cena perde a unica pista de profundidade que tem. Nasce e
     morre com a etapa porque o tamanho dele sai da unidade. */
  function montaPisoDaPlanta(pl) {
    soltaPisoDaPlanta();
    const R = Math.max(pl.ob.hu, pl.ob.hv) + 9;
    const g = new THREE.CircleGeometry(R, 64);
    g.rotateX(-Math.PI/2);
    const m = new THREE.MeshStandardMaterial({ color:corTela(0x1E252E), roughness:0.96, metalness:0 });
    const o = new THREE.Mesh(g, m);
    o.position.set(pl.ob.cx, -0.03, pl.ob.cz);
    o.receiveShadow = true;
    cenaPlanta.add(o);
    PLANTA.chao = o;

    // Grade de 1 m: da escala sem virar moire. Nao e a grade do modo moveis (aquela tem
    // passo de 10 cm, gira com o OBB da unidade e mora DENTRO da raiz); esta e cenario, e
    // por isso fica 1 cm abaixo do piso da mesa, sem disputar pixel com nada.
    const lado = Math.ceil(R * 2);
    const gr = new THREE.GridHelper(lado, lado, corTela(0x3A4756), corTela(0x27313D));
    gr.material.transparent = true; gr.material.opacity = 0.5;
    gr.material.depthWrite = false;
    gr.material.toneMapped = false;   // mesma razao da grade do modo moveis
    gr.position.set(pl.ob.cx, -0.02, pl.ob.cz);
    cenaPlanta.add(gr);
    PLANTA.grade = gr;

    cenaPlanta.fog.near = R * 1.6;
    cenaPlanta.fog.far  = R * 4.4;

    // A camera de sombra cobre a unidade e mais nada: apertada assim, 2.048 px dao ~2 cm
    // por texel e o pe da cadeira projeta sombra de verdade. Herdada da cidade (1.280 m
    // de lado) ela nao enxergaria um movel inteiro.
    const sc = PLANTA.key.shadow.camera, S = R + 2;
    sc.left = -S; sc.right = S; sc.top = S; sc.bottom = -S;
    sc.updateProjectionMatrix();
  }
  function soltaPisoDaPlanta() {
    for (const k of ["chao", "grade"]) {
      const o = PLANTA[k];
      if (!o) continue;
      cenaPlanta.remove(o);
      if (o.geometry) o.geometry.dispose();
      if (o.material) o.material.dispose();
      PLANTA[k] = null;
    }
  }

  /* Enquadramento inicial: tres quartos, de cima, com o eixo maior da unidade deitado na
     tela. `theta` sai do OBB da planta (o mesmo referencial em que todo movel vive), nao
     do norte -- um apartamento que nao esta em cima do eixo do mapa abriria torto. */
  function enquadraPlanta(pl) {
    const R = Math.max(pl.ob.hu, pl.ob.hv);
    target.set(pl.ob.cx, 0, pl.ob.cz);
    sph.radius = Math.max(11, R * 3.1);
    sph.phi = 0.78;
    sph.theta = Math.atan2(-pl.ob.uz, pl.ob.ux) + Math.PI * 0.25;
  }

  function entraPlanta() {
    if (PLANTA.on) return true;
    if (!INT.on || !INT.pl) return false;
    const pl = INT.pl;
    tour(false);
    paraVoo();                       // o voo da vitrine reescreveria o raio (ver paraVoo)
    INT.voo = null;                  // um voo de entrada pendente miraria na cidade
    PLANTA.on = true;
    PLANTA.salvo = { baseY: INT.baseY };

    // O grupo inteiro troca de pai. E a linha que faz a etapa existir: a partir daqui a
    // cidade nao e mais desenhada, e nada da unidade precisou ser refeito.
    cenaPlanta.add(gInteriores);
    INT.baseY = 0;
    INT.raiz.position.y = 0;
    for (const L of INT.lamps) L.p.y = pl.pd - 0.28;
    distribuiLuzes(true);

    montaPisoDaPlanta(pl);
    enquadraPlanta(pl);

    INT.orbita = true; INT.fp = false;
    camera.near = NEAR_CASA; camera.far = FAR_CASA;
    camera.fov = fovInterior(true);
    camera.updateProjectionMatrix();
    CORTE.constant = Math.max(6, pl.h + 3);   // desce de cima, como na vista antiga
    INT.corteAlvo = alturaDoCorte();
    /* SEM FORRO NA ETAPA 3. Com o corte no ombro ele some por clipping e nao se nota;
       com "paredes inteiras" ele e a tampa de uma caixa, e a planta desaparece debaixo
       dela. Maquete de arquitetura nao tem laje de cobertura -- e por isso o arquivo de
       referencia tambem nao tem. */
    poeTeto(false);
    if (INT.sel >= 0) seleciona(INT.sel);

    document.body.classList.add("dentro");
    document.body.classList.add("planta");
    mostraJoy(false);
    housesBox.style.display = "none";
    // "carregar o sistema de moveis (mesmo em vista aerea)": a etapa 3 e onde se
    // mobilia, entao ela ABRE com o modo ligado -- grade, catalogo e gizmo de uma vez.
    modoMoveis(true);
    pintaParedes();
    $("iDica").textContent = TOQUE
      ? "Arraste para girar a planta \u00b7 dois dedos aproximam \u00b7 toque para escolher o m\u00f3vel"
      : "Arrastar gira \u00b7 roda aproxima \u00b7 bot\u00e3o direito move a planta \u00b7 clicar escolhe o m\u00f3vel";
    sujaSombra();
    frameLoop();
    return true;
  }

  // `pra` diz o que vem depois: "interior" devolve a unidade pra cidade ja em primeira
  // pessoa; qualquer outra coisa so desfaz a etapa e deixa a decisao pro chamador.
  function saiPlanta(pra) {
    if (!PLANTA.on) return;
    PLANTA.on = false;
    document.body.classList.remove("planta");
    scene.add(gInteriores);
    soltaPisoDaPlanta();
    if (INT.pl) {
      INT.baseY = baseDaCasa(INT.pl);
      if (INT.raiz) INT.raiz.position.y = INT.baseY;
      for (const L of INT.lamps) L.p.y = INT.baseY + INT.pl.pd - 0.28;
      distribuiLuzes(true);
      if (INT.sel >= 0) seleciona(INT.sel);
      INT.corteAlvo = alturaDoCorte();
      // Voltando pra cidade o corte tem que PARTIR de cima de novo: deixado em 1,55 m
      // ele fatiaria o bairro inteiro no primeiro quadro da volta.
      CORTE.constant = INT.baseY + Math.max(6, INT.pl.h + 3);
    }
    if (INT.pl) poeTeto(true);   // v17: voltando pra cidade a unidade e fechada de novo
    if (pra === "interior" && INT.pl) {
      modoMoveis(false);
      vista(false);
      const e = livre(FP.pos.x, FP.pos.z) ? [FP.pos.x, FP.pos.z] : pontoDeEntrada(INT.pl);
      FP.pos.set(e[0], 0, e[1]);
      FP.yaw = melhorDirecao(e[0], e[1]);
      mostraJoy(true);
    }
    sujaSombra();
    frameLoop();
  }

  function pintaParedes() {
    const b = $("iparedes");
    if (b) {
      b.setAttribute("aria-pressed", String(PLANTA.corta));
      b.textContent = PLANTA.corta ? "Paredes cortadas" : "Paredes inteiras";
      b.hidden = !PLANTA.on;
    }
  }
  function trocaParedes() {
    PLANTA.corta = !PLANTA.corta;
    INT.corteAlvo = alturaDoCorte();
    pintaParedes();
    frameLoop();
  }

  /* ============================================================
     v17. A ESCADA DAS TRES ETAPAS
     ============================================================
     Quem e o imovel da vez ja tem dono: `FICHA` do listings/flow.js, que chega aqui por `getFicha()`. A etapa
     e so o ESTADO em que ele esta sendo visto, e trocar de etapa nunca descarta a
     unidade -- sair da planta pro interior nao remonta paredes, e voltar ao mapa nao
     joga fora o que foi mobiliado. */
  const ETAPA = { atual:"mapa" };

  // O raio de orbita que enquadra ESTE predio. Um sobrado de 8 m e uma torre de 40 nao
  // se mostram da mesma distancia, e o 190 fixo da vitrine mostrava um quarteirao no
  // primeiro caso e meia fachada no segundo.
  function raioDoEnquadre(rec) {
    if (!rec || !rec.r || !rec.r.length) return 190;
    let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
    for (const p of rec.r) {
      if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0];
      if (p[1] < z0) z0 = p[1]; if (p[1] > z1) z1 = p[1];
    }
    const d = Math.hypot(x1 - x0, z1 - z0), h = rec.h || 9;
    // O que tem que caber na tela e a DIAGONAL da base ou a ALTURA, o que for maior --
    // torre estreita e alta e o caso em que a base engana.
    return Math.max(70, Math.min(420, Math.max(d, h) * 2.6 + 32));
  }

  function enquadraImovel(girar) {
    const F = getFicha();
    if (!F) return;
    // Mais deitada que a vista de mapa (0,92): quem circula um predio quer ver a FACHADA,
    // e de 0,92 a torre aparece de cima, encurtada. 1,02 e o limite util antes de a
    // camera comecar a raspar o quarteirao da frente -- a faixa do arrasto vai a 1,15.
    sph.phi = 1.02;
    flyTo(F.x, F.z, raioDoEnquadre(F.rec));
    if (girar) tour(true);
  }

  function temPlanta(u) {
    return !!(u && u.planta && u.planta.comodos && u.planta.comodos.length);
  }

  function pintaEtapas() {
    const F = getFicha(), ok = !!F, com = ok && temPlanta(F.u);
    const par = [["eMapa", "mapa"], ["eInterior", "interior"], ["ePlanta", "planta"],
                 ["uE1", "mapa"], ["uEnter", "interior"], ["uPlanta", "planta"]];
    for (const [id, k] of par) {
      const b = $(id);
      if (!b) continue;
      b.setAttribute("aria-pressed", String(ETAPA.atual === k));
      // Unidade sem planta cadastrada nao tem etapa 2 nem 3 -- e o mesmo criterio que a
      // vitrine ja usava pra decidir se o imovel abre por dentro.
      if (k !== "mapa") b.hidden = !com;
    }
    const bv = $("ivista");
    if (bv) bv.setAttribute("aria-pressed", String(PLANTA.on));
    const bar = $("etapas");
    if (bar) bar.hidden = !ok;
    pintaTour();
    pintaParedes();
  }

  /* A unica porta de troca de etapa. Tudo -- barra flutuante, botoes da ficha, link
     direto, Esc e o "Voltar ao mapa" -- passa por aqui, pra que nao exista um segundo
     caminho que esqueca de desfazer a cena da planta. */
  function vaiParaEtapa(k) {
    // Sem imovel na ficha nao ha escada, mas "voltar ao mapa" tem que continuar saindo
    // da casa: e o unico botao de saida que sobra na tela dentro da visita.
    const F = getFicha();
    if (!F) { if (k === "mapa") exitInterior(); return; }
    if (k !== "mapa" && !temPlanta(F.u)) return;
    const de = ETAPA.atual;
    if (k === de && k !== "mapa") { pintaEtapas(); return; }

    if (k === "mapa") {
      exitInterior();              // ele proprio desfaz a cena da planta, se for o caso
      ETAPA.atual = "mapa";
      usheet.classList.add("on"); usheet.classList.remove("min");
      houseBeacon.position.set(F.x, 0, F.z);
      houseBeacon.visible = true;
      enquadraImovel(true);
    } else if (k === "interior") {
      tour(false);
      if (PLANTA.on) saiPlanta("interior");
      else if (INT.on) vista(false);
      else enterInterior(F.rec, F.u);
      ETAPA.atual = "interior";
    } else if (k === "planta") {
      tour(false);
      if (!INT.on) enterInterior(F.rec, F.u);
      if (!entraPlanta()) return;
      ETAPA.atual = "planta";
    }
    pintaEtapas();
    marcaEtapaNaUrl();
  }

  /* ---- o link direto ------------------------------------------------------
     `?imovel=<id>` abre a pagina JA no imovel: 2,5 km de cidade montada em volta, a
     ficha aberta e a camera circulando o predio. `?etapa=` decide em qual das tres
     etapas a pagina abre -- e um link de planta nem chega a desenhar a cidade.

     Roda depois que a cidade esta montada (ver `lerLink`), porque achar o predio de uma
     unidade depende de `gGroups`: e o mesmo elo fraco que a vitrine ja tem, e a mesma
     resposta -- se a ancora nao resolve, a pagina pede pra apontar o predio em vez de
     abrir em lugar nenhum.                                                          */
  function unidadePorId(id) {
    const alvo = String(id);
    for (const u of UNIDADES) if (String(u.id) === alvo) return u;
    return null;
  }
  // O `ui/position-link.js` pergunta por aqui em vez de ler a variavel: quando ele e
  // montado, `LINK_IMOVEL` ja foi escrito por `iniciaEtapas()`.
  function getLinkImovel() { return LINK_IMOVEL; }
  function abrePeloLink() {
    if (!LINK_IMOVEL) return;
    const u = unidadePorId(LINK_IMOVEL);
    if (!u) return;
    // O raio maior vale a partir daqui e so aqui: ver a nota do RAIO_LINK.
    setStreamRadius(RAIO_LINK);
    abreUnidade(u);
    const F = getFicha();
    if (!F || F.u !== u) return;    // caiu no "clique no predio": nada a enquadrar
    ETAPA.atual = "mapa";
    if (LINK_ETAPA === "mapa" || !temPlanta(u)) {
      enquadraImovel(true);
      pintaEtapas();
      marcaEtapaNaUrl();
    } else {
      vaiParaEtapa(LINK_ETAPA);
    }
  }

  /* `marcaEtapaNaUrl` vive em `ui/position-link.js`: ela escreve na MESMA URL que o
     link de posicao, e depende do `_linkOk` de la -- a trava que desliga a escrita
     quando `history.replaceState` lanca. Duas funcoes escrevendo a URL com duas
     travas separadas seria uma delas mentindo. */


  /* ---- laco de quadro da etapa 3 -------------------------------------------
     O contrario do `frame()`: aqui a lista do que NAO se faz e o recurso. Sem cidade na
     tela, streaming, arvore, portao, pino, rotulo de rua, minimapa, nevoa do quadro,
     noite e governador de sol nao tem o que atualizar -- e cada um deles custa CPU por
     quadro, que e o gargalo medido deste projeto (nao o triangulo).                 */
  function plantaFrame(now) {
    const t0 = performance.now();
    governa(now);
    resize();
    // O lightmap continua assentando aqui: `cenaDoBake` ja e uma cena separada e nao le
    // nada da cidade. Sem esta linha, um link que abre direto na etapa 3 ficaria com a
    // parede sem bake ate alguem voltar pro mapa.
    if (BAKE.fila && bakePasso(BAKE.fila, BAKE.orcamento)) BAKE.fila = null;
    interiorFrame(now);
    if (!INT.voo) {
      camera.position.setFromSpherical(sph).add(target);
      camera.lookAt(target);
    }
    camera.updateMatrixWorld();
    // A luz acompanha o ALVO, nao a origem do mundo: a planta mora nas coordenadas XZ do
    // predio dela (podem ser quilometros), e um sol fixo em (14,26,12) deixaria a unidade
    // inteira fora da camera de sombra.
    const kp = PLANTA.key;
    if (kp) {
      kp.position.set(target.x + 26, 42, target.z + 20);
      kp.target.position.set(target.x, 0, target.z);
      kp.target.updateMatrixWorld();
      PLANTA.fill.position.set(target.x - 30, 22, target.z - 24);
    }
    renderer.shadowMap.needsUpdate = sombraPendente();
    limpaSombra();
    renderer.render(cenaPlanta, camera);
    poeCpuMs(performance.now() - t0);
    pintaPerf(now);
    if (!semRaf()) requestAnimationFrame(getFrame());
  }

  /* ---- a porta de entrada, chamada pelo app.js -----------------------------
     Tudo que LE alguma coisa de fora mora aqui dentro: a URL, a cena e os botoes. */
  function iniciaEtapas() {
    LINK_IMOVEL = QS.get("imovel") || "";
    const _e = (QS.get("etapa") || "").toLowerCase();
    LINK_ETAPA = ETAPAS_NOMES.indexOf(_e) >= 0 ? _e : "mapa";
    montaCenaPlanta();
    /* ---- os botoes ---------------------------------------------------------- */
    for (const [id, k] of [["eMapa", "mapa"], ["eInterior", "interior"], ["ePlanta", "planta"],
                           ["uE1", "mapa"], ["uPlanta", "planta"]]) {
      const b = $(id);
      if (b) b.addEventListener("click", () => vaiParaEtapa(k));
    }
    { const b = $("uGira"); if (b) b.addEventListener("click", () => tour(!TOUR.on)); }
    { const b = $("iparedes"); if (b) b.addEventListener("click", trocaParedes); }
    // Estado inicial: sem imovel na ficha a barra nasce escondida, e o botao de parede so
    // existe na etapa 3. Sem esta chamada os dois so acertariam no primeiro clique.
    pintaEtapas();
  }


    return {PLANTA, ETAPA, TOUR, cenaPlanta, temPlanta, tour, tourPassa, pintaEtapas,
            vaiParaEtapa, entraPlanta, saiPlanta, trocaParedes, enquadraImovel,
            raioDoEnquadre, abrePeloLink, unidadePorId, getLinkImovel, plantaFrame,
            iniciaEtapas};
  }
  root.ListingStages = Object.freeze({create});
})(globalThis);
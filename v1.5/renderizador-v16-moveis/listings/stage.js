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
                   // A maquete: geometria do predio, terreno e o painel que a recorta.
                   canvas, LV, obbOf, safeInset, shoelace, terrainY, getRelevo,
                   predioMaisPerto,
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

  /* O passo de tempo do quadro mora AQUI, e nao no `scene/frame.js`, porque agora ele
     tem dois consumidores em dois lacos diferentes: o giro da camera (so na cidade) e
     a maquete (na cidade E na etapa 3). Com um relogio em cada laco, atravessar a
     transicao zerava o dt de um deles e o predio congelava meio apagado. */
  let _tourT = 0;
  function passoDoTempo(now) {
    const dt = _tourT ? Math.min(0.2, (now - _tourT)/1000) : 0;
    _tourT = now;
    return dt;
  }
  // Usada na virada pra etapa 3: marca o relogio sem consumir um passo.
  function marcaTempo(now) { _tourT = now; }
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

     Aqui a planta ganha `cenaImovel`: fundo proprio, nevoa propria, tres luzes proprias
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
  const cenaImovel = new THREE.Scene();
  /* `corta` nasce FALSO. O pedido da etapa 3 e "sobra o chao, as paredes, as janelas
     e os moveis; o teto some" -- e parede cortada na cintura nao e nada disso. Cortar
     continua sendo uma opcao, no botao. */
  const PLANTA = { on:false, corta:false, key:null, fill:null, hemi:null };
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
    cenaImovel.background = corTela(PLANTA_FUNDO);
    // A nevoa e curta de proposito: ela fecha o horizonte logo depois da planta, o que
    // faz a maquete "pousar" no escuro em vez de flutuar num vazio chapado. Os numeros
    // sao reescritos na entrada, pelo tamanho da unidade (ver `entraPlanta`).
    cenaImovel.fog = new THREE.Fog(cenaImovel.background.getHex(), 30, 90);

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
    cenaImovel.add(key, key.target, fill, hemi);
    PLANTA.key = key; PLANTA.fill = fill; PLANTA.hemi = hemi;
  }

  /* Enquadramento inicial: tres quartos, de cima, com o eixo maior da unidade deitado na
     tela. `theta` sai do OBB da planta (o mesmo referencial em que todo movel vive), nao
     do norte -- um apartamento que nao esta em cima do eixo do mapa abriria torto. */
  function enquadraPlanta(pl) {
    const R = Math.max(pl.ob.hu, pl.ob.hv);
    // y sai de `interiorFrame`, que crava `target.y = INT.baseY` a cada quadro: o alvo
    // da orbita mora no PISO da unidade, e nao no terreno la embaixo.
    target.set(pl.ob.cx, INT.baseY, pl.ob.cz);
    sph.radius = Math.max(13, R * 3.1);
    sph.phi = 0.72;
    // Continuidade com a maquete: ela acabou de parar num angulo, e recomecar noutro
    // seria girar o predio na cara de quem estava olhando pra ele.
    sph.theta = MAQ.raiz ? MAQ.theta
              : Math.atan2(-pl.ob.uz, pl.ob.ux) + Math.PI * 0.25;
  }

  function entraPlanta() {
    if (PLANTA.on) return true;
    if (!INT.on || !INT.pl) return false;
    const pl = INT.pl;
    tour(false);
    paraVoo();                       // o voo da vitrine reescreveria o raio (ver paraVoo)
    INT.voo = null;                  // um voo de entrada pendente miraria na cidade
    PLANTA.on = true;

    // O grupo inteiro troca de pai. E a linha que faz a etapa existir: a partir daqui a
    // cidade nao e mais desenhada, e nada da unidade precisou ser refeito.
    cenaImovel.add(gInteriores);

    /* A UNIDADE FICA NA COTA DELA. Antes da maquete isto era zerado -- planta de 3o
       andar nao se desenha 9 m acima do papel, era o argumento. Com a maquete inverteu
       de sinal: a planta tem que aparecer EXATAMENTE onde o pavimento verde estava
       piscando, senao o predio se apaga num lugar e a planta acende em outro, e a
       transicao que esta etapa existe pra ter vira um corte. Entao nada de zerar -- e
       todo o remendo que o zero exigia (a guarda no `interiorFrame`, o realinhamento
       das lampadas, o `PLANTA.salvo`) sai junto. */
    enquadraPlanta(pl);
    // O predio em volta se apaga enquanto a planta ja esta na tela.
    if (MAQ.raiz) { MAQ.modo = "planta"; apagaMaquete(700); }

    INT.orbita = true; INT.fp = false;
    camera.near = NEAR_CASA; camera.far = FAR_CASA;
    camera.fov = fovInterior(true);
    camera.updateProjectionMatrix();
    CORTE.constant = INT.baseY + Math.max(6, pl.h + 3);   // desce de cima
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
    escondeMaquete();            // fora da etapa 3 a maquete nao tem o que fazer
    if (INT.pl) {
      INT.corteAlvo = alturaDoCorte();
      // Voltando pra cidade o corte tem que PARTIR de cima de novo: deixado em 1,55 m
      // ele fatiaria o bairro inteiro no primeiro quadro da volta.
      CORTE.constant = INT.baseY + Math.max(6, INT.pl.h + 3);
      poeTeto(true);             // a unidade volta a ser fechada dentro da cidade
    }
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
     v18. A MAQUETE: o fio que liga as tres etapas
     ============================================================
     Ate o v17 as tres etapas eram tres CORTES: a ficha sumia, a cidade sumia, e a
     pessoa reaparecia dentro de uma sala sem ter visto como chegou ali. A maquete
     conserta isso sendo a mesma coisa nas tres:

       1. FICHA    -- ela e uma miniatura desenhada EM CIMA da ficha, girando devagar,
                      com o pavimento da unidade piscando em verde;
       2. ANDAR    -- a ficha encolhe, a miniatura CRESCE ate a tela inteira e se
                      aproxima do pavimento; quando chega, a visita 3D assume dali;
       3. PLANTA   -- a ficha some, a miniatura cresce mirando o pavimento e o predio
                      inteiro se apaga em volta dele: fica o piso, as paredes, as
                      esquadrias e a mobilia daquele andar, sem laje por cima.

     DUAS DECISOES QUE O RESTO DESTE BLOCO COBRA:

     - A MINIATURA NAO TEM CANVAS PROPRIO. Um segundo `WebGLRenderer` significaria um
       segundo contexto WebGL: outro conjunto de programas compilados, outra copia de
       cada textura, e um teto de contextos por aba que este projeto ja flerta com a
       cidade inteira na tela. Aqui ela e um VIEWPORT -- `setScissor` + `setViewport`
       sobre o mesmo renderizador, desenhando `cenaImovel` num retangulo. Crescer ate a
       tela inteira, entao, nao e trocar de tecnologia: e interpolar quatro numeros.

     - A MAQUETE MORA NAS COORDENADAS DO MUNDO. Seria mais facil monta-la na origem e
       escalar; seria tambem o fim da transicao continua. Nas coordenadas do predio, a
       camera da miniatura e a camera da cidade falam a mesma lingua -- no fim do
       crescimento basta copiar a pose de uma pra outra e a visita 3D comeca do ponto
       exato em que a miniatura parou, sem corte.                                   */
  const MAQ = {
    raiz:null, lajes:null, paredes:null, vidros:null, cobertura:null, obR:10,
    brilho:null, contorno:null, chao:null,
    n:0, base:0, andar:-1, rec:null, uni:null,
    cam:null, alvo:new THREE.Vector3(), theta:0.8, phi:1.02, raio:60,
    gira:true, modo:"off",        // off | ficha | crescendo | planta
    rect:null, anim:null, fadeAnim:null, fade:1, pulso:0, sombraSuja:true
  };
  function apagaMaquete(dur) { MAQ.fadeAnim = { t0:performance.now(), dur:dur||700, de:MAQ.fade, para:0 }; }

  /* A ETAPA QUE ESTA CHEGANDO, enquanto a transicao acontece.

     `enterInterior` e a porta de entrada da visita 3D vindo de QUALQUER lugar -- clique
     no predio, vitrine, link -- e por isso ele declara a etapa "interior" e apaga a
     maquete, que dentro da casa nao tem onde morar. So que a etapa 3 passa por ele no
     meio do caminho: a planta precisa da unidade montada. Sem este sinal, o proprio
     `enterInterior` desfazia os dois efeitos que a etapa 3 tinha acabado de preparar --
     medido: a planta abria com `ETAPA.atual` em "interior" (a barra acendia o botao
     errado) e com a maquete ja destruida, entao o predio em volta nao se apagava, ele
     simplesmente nunca existia. Nada disso da erro no console. */
  let _indoPara = null;
  // Lido de fora (interior/entry.js): a entrada na visita 3D precisa saber se esta
  // apenas de passagem pra etapa 3.
  function poeIndoPara(v) { _indoPara = v; }
  function indoPara() { return _indoPara; }
  const MAQ_VERDE = 0x39D98A;

  /* Alturas de um pavimento da maquete. Nao sao chute: `LV` (3,15 m) e o pe-direito de
     pavimento que o resto do projeto ja usa pra empilhar unidade, e as tres faixas
     somam exatamente ele -- laje, peitoril, janela, e o resto de parede ate a proxima
     laje. Assim o andar da maquete e o MESMO andar que `baseDaCasa` calcula. */
  const MAQ_LAJE = 0.32, MAQ_PEITO = 0.62, MAQ_VIDRO = 1.42;

  function formaDoAnel(r, cx, cz, buraco) {
    const s = new THREE.Shape();
    // O `-` no eixo vertical da forma: `ExtrudeGeometry` extruda em +Z e o
    // `rotateX(-PI/2)` leva (x,y,z) pra (x,z,-y). Sem inverter aqui, a planta da maquete
    // sairia espelhada em relacao ao predio de verdade -- e um predio em L espelhado nao
    // acusa erro nenhum, so fica errado.
    s.moveTo(r[0][0] - cx, -(r[0][1] - cz));
    for (let i = 1; i < r.length; i++) s.lineTo(r[i][0] - cx, -(r[i][1] - cz));
    s.closePath();
    if (buraco && buraco.length > 2) {
      const p = new THREE.Path();
      const h = buraco.slice().reverse();   // furo com enrolamento oposto ao contorno
      p.moveTo(h[0][0] - cx, -(h[0][1] - cz));
      for (let i = 1; i < h.length; i++) p.lineTo(h[i][0] - cx, -(h[i][1] - cz));
      p.closePath();
      s.holes.push(p);
    }
    return s;
  }
  function prismaDoAnel(r, cx, cz, alt, buraco) {
    const g = new THREE.ExtrudeGeometry(formaDoAnel(r, cx, cz, buraco),
                                        { depth: alt, bevelEnabled: false, curveSegments: 1 });
    g.rotateX(-Math.PI / 2);
    g.computeVertexNormals();
    return g;
  }

  /* Telhado de duas aguas, tirado do RETANGULO MINIMO do contorno e nao do contorno
     inteiro. Casa de verdade tem empena no lado curto e cumeeira no eixo longo, e e o
     OBB que sabe qual e qual -- num contorno de 9 vertices, "o lado longo" nao esta
     escrito em lugar nenhum. So entra em predio baixo: torre leva laje e platibanda. */
  function telhadoDeDuasAguas(ob, beiral, altura) {
    const HU = ob.hu + beiral, HV = ob.hv + beiral, H = altura;
    const P = [], N = [];
    const mundo = (u, v) => [ob.cx + ob.ux*u - ob.uz*v, ob.cz + ob.uz*u + ob.ux*v];
    const tri = (a, b, c) => {
      const pa = mundo(a[0], a[1]), pb = mundo(b[0], b[1]), pc = mundo(c[0], c[1]);
      const A = [pa[0], a[2], pa[1]], B = [pb[0], b[2], pb[1]], C = [pc[0], c[2], pc[1]];
      P.push(A[0],A[1],A[2], B[0],B[1],B[2], C[0],C[1],C[2]);
      const ux = B[0]-A[0], uy = B[1]-A[1], uz = B[2]-A[2];
      const vx = C[0]-A[0], vy = C[1]-A[1], vz = C[2]-A[2];
      let nx = uy*vz - uz*vy, ny = uz*vx - ux*vz, nz = ux*vy - uy*vx;
      const L = Math.hypot(nx, ny, nz) || 1; nx/=L; ny/=L; nz/=L;
      for (let k = 0; k < 3; k++) N.push(nx, ny, nz);
    };
    const A = [-HU,-HV,0], B = [HU,-HV,0], C = [HU,HV,0], D = [-HU,HV,0];
    const E = [-HU,0,H],   F = [HU,0,H];
    tri(A,B,F); tri(A,F,E);          // agua norte
    tri(C,D,E); tri(C,E,F);          // agua sul
    tri(A,E,D); tri(B,C,F);          // empenas
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(P), 3));
    g.setAttribute("normal", new THREE.BufferAttribute(new Float32Array(N), 3));
    return g;
  }

  function soltaMaquete() {
    if (!MAQ.raiz) return;
    MAQ.raiz.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose());
    });
    cenaImovel.remove(MAQ.raiz);
    MAQ.raiz = MAQ.lajes = MAQ.paredes = MAQ.vidros = null;
    MAQ.cobertura = MAQ.brilho = MAQ.contorno = MAQ.chao = null;
    MAQ.rec = MAQ.uni = null; MAQ.n = 0; MAQ.andar = -1;
  }

  /* Constroi a miniatura de UM registro de edificacao. Tres `InstancedMesh` dao o predio
     inteiro -- laje, parede e faixa de janela --, entao uma torre de 14 pavimentos custa
     as mesmas tres chamadas de desenho que um sobrado. Isso importa porque a miniatura e
     desenhada POR CIMA da cidade: ela e um segundo `render()` no mesmo quadro, e o
     gargalo medido deste projeto e chamada de desenho, nao triangulo. */
  function montaMaquete(rec, u) {
    soltaMaquete();
    if (!rec || !rec.r || rec.r.length < 3) return false;
    const r = rec.r;
    let cx = 0, cz = 0;
    for (const p of r) { cx += p[0]; cz += p[1]; }
    cx /= r.length; cz /= r.length;
    const area = Math.abs(shoelace(r)) / 2;
    const ob = obbOf(r, area);
    const alt = Math.max(LV, rec.h || LV);
    const n = Math.max(1, Math.round(alt / LV));
    const base = terrainY(cx, cz) * getRelevo();

    MAQ.raiz = new THREE.Group();
    MAQ.raiz.position.set(cx, base, cz);
    MAQ.rec = rec; MAQ.uni = u || null; MAQ.n = n; MAQ.base = base;
    MAQ.obR = Math.max(ob.hu, ob.hv);

    // Qual pavimento pisca. `andar` do cadastro manda; casa de um pavimento so pisca
    // inteira (e a unidade, nao um andar dela); predio sem andar declarado nao pisca --
    // acender o terreo por falta de dado seria apontar pro apartamento errado.
    MAQ.andar = u && u.andar != null ? Math.max(0, Math.min(n - 1, u.andar | 0))
              : (n === 1 && u ? 0 : -1);

    const anelInterno = safeInset(r, 0.34);
    const anelVidro   = safeInset(r, 0.20);
    const gLaje   = prismaDoAnel(r, cx, cz, MAQ_LAJE);
    const gParede = prismaDoAnel(anelInterno, cx, cz, LV - MAQ_LAJE);
    const gVidro  = prismaDoAnel(anelVidro, cx, cz, MAQ_VIDRO, safeInset(anelVidro, 0.12));

    const mLaje = new THREE.MeshStandardMaterial({ color:corTela(0xD8D3C9), roughness:0.86, metalness:0.02 });
    const mPar  = new THREE.MeshStandardMaterial({ color:corTela(0xBFC4C9), roughness:0.9,  metalness:0.02 });
    // O vidro e escuro e liso de proposito: numa miniatura ele nao precisa refletir
    // nada, precisa DESENHAR a laje. A faixa escura entre dois brancos e o que faz o
    // olho contar os pavimentos -- que e a unica coisa que esta miniatura tem que
    // comunicar pra pessoa achar o apartamento dela.
    const mVid  = new THREE.MeshStandardMaterial({ color:corTela(0x243240), roughness:0.24, metalness:0.55 });

    const lajes   = new THREE.InstancedMesh(gLaje, mLaje, n + 1);   // +1: a cobertura
    const paredes = new THREE.InstancedMesh(gParede, mPar, n);
    const vidros  = new THREE.InstancedMesh(gVidro, mVid, n);
    for (const m of [lajes, paredes, vidros]) { m.castShadow = true; m.receiveShadow = true; }

    const d = new THREE.Object3D();
    const poe = (malha, i, y) => {
      d.position.set(0, y, 0); d.rotation.set(0,0,0); d.scale.set(1,1,1);
      d.updateMatrix(); malha.setMatrixAt(i, d.matrix);
    };
    for (let i = 0; i < n; i++) {
      const y = i * LV;
      poe(lajes, i, y);
      poe(paredes, i, y + MAQ_LAJE);
      poe(vidros, i, y + MAQ_LAJE + MAQ_PEITO);
    }
    poe(lajes, n, n * LV);                       // a laje de cobertura fecha por cima
    for (const m of [lajes, paredes, vidros]) { m.instanceMatrix.needsUpdate = true; m.computeBoundingSphere(); }
    MAQ.raiz.add(lajes, paredes, vidros);
    MAQ.lajes = lajes; MAQ.paredes = paredes; MAQ.vidros = vidros;

    if (n <= 2) {
      // Casa: telhado. Sem ele um sobrado vira uma caixa de dois andares, e "casa" era
      // metade do pedido.
      const g = telhadoDeDuasAguas({ cx:ob.cx - cx, cz:ob.cz - cz, ux:ob.ux, uz:ob.uz,
                                     hu:ob.hu, hv:ob.hv }, 0.45, Math.min(2.2, ob.hv * 0.62));
      g.translate(0, n * LV + MAQ_LAJE, 0);
      const t = new THREE.Mesh(g, new THREE.MeshStandardMaterial({
        color:corTela(0x8A4F3D), roughness:0.92, metalness:0, side:THREE.DoubleSide }));
      t.castShadow = true;
      MAQ.raiz.add(t); MAQ.cobertura = t;
    } else {
      // Torre: platibanda. Duas linhas, e e o que separa "predio" de "caixa empilhada".
      const g = prismaDoAnel(r, cx, cz, 0.85, safeInset(r, 0.22));
      g.translate(0, n * LV + MAQ_LAJE, 0);
      const t = new THREE.Mesh(g, mPar.clone());
      t.castShadow = true;
      MAQ.raiz.add(t); MAQ.cobertura = t;
    }

    // O chao da miniatura. Existe por um motivo tecnico antes de estetico: sem uma
    // superficie embaixo, a sombra do predio cai no nada e a maquete perde a unica
    // pista de profundidade que tem num painel de 190 px.
    const raioChao = Math.max(ob.hu, ob.hv) * 2.6 + 6;
    const gc = new THREE.CircleGeometry(raioChao, 48); gc.rotateX(-Math.PI/2);
    const chao = new THREE.Mesh(gc, new THREE.MeshStandardMaterial({
      color:corTela(0x1B222B), roughness:0.97, metalness:0 }));
    chao.position.y = -0.04; chao.receiveShadow = true;
    MAQ.raiz.add(chao); MAQ.chao = chao;

    if (MAQ.andar >= 0) {
      // O PAVIMENTO QUE PISCA. Nao e cor de instancia: `setColorAt` num material
      // padrao modula a DIFUSA, e verde sobre parede clara sob luz forte da um bege
      // esverdeado que ninguem le como "e este aqui". Aqui e um volume proprio,
      // `MeshBasic` (sem luz, sem mapeamento de tom) e translucido, com o contorno do
      // pavimento por cima dele -- o mesmo par de recursos que o farol do chao ja usa.
      const gb = prismaDoAnel(r, cx, cz, LV);
      gb.translate(0, MAQ.andar * LV, 0);
      const b = new THREE.Mesh(gb, new THREE.MeshBasicMaterial({
        color:MAQ_VERDE, transparent:true, opacity:0.3, depthWrite:false, toneMapped:false }));
      b.renderOrder = 4;
      MAQ.raiz.add(b); MAQ.brilho = b;

      const P = [];
      for (let k = 0; k < 2; k++) {
        const y = MAQ.andar * LV + (k ? LV : 0);
        for (let i = 0; i < r.length; i++) {
          const a = r[i], c = r[(i + 1) % r.length];
          P.push(a[0]-cx, y, a[1]-cz, c[0]-cx, y, c[1]-cz);
        }
      }
      const gl = new THREE.BufferGeometry();
      gl.setAttribute("position", new THREE.BufferAttribute(new Float32Array(P), 3));
      const ln = new THREE.LineSegments(gl, new THREE.LineBasicMaterial({
        color:MAQ_VERDE, transparent:true, opacity:0.95, depthTest:false, toneMapped:false }));
      ln.renderOrder = 5;
      MAQ.raiz.add(ln); MAQ.contorno = ln;
    }

    cenaImovel.add(MAQ.raiz);
    MAQ.fade = 1;
    aplicaFadeMaquete(1);
    /* A CAMERA DE SOMBRA TEM QUE CABER O PREDIO, e este e o defeito que ela produz
       quando nao cabe: a luz direcional continua na cena, o material continua compilado
       com codigo de sombra, e todo fragmento fora da caixa da luz e amostrado FORA do
       mapa -- o que o three devolve como "na sombra". O resultado nao e uma sombra
       errada, e um predio PRETO, sem erro nenhum no console. A caixa nasce dos +-5 m do
       padrao do three; aqui ela passa a ser a do volume que se esta desenhando. */
    const S = Math.max(MAQ.obR * 1.9, n * LV * 0.75) + 7;
    const sc = PLANTA.key.shadow.camera;
    sc.left = -S; sc.right = S; sc.top = S; sc.bottom = -S;
    sc.near = 1; sc.far = 260;
    sc.updateProjectionMatrix();
    MAQ.sombraSuja = true;

    // Enquadramento: o predio inteiro no painel, visto de tres quartos e ligeiramente
    // de cima -- que e como maquete de lancamento e fotografada.
    MAQ.alvo.set(cx, base + n * LV * 0.45, cz);
    MAQ.raio = Math.max(18, Math.max(ob.hu, ob.hv) * 2.0 + n * LV * 1.25);
    MAQ.phi = 1.02;
    MAQ.theta = Math.atan2(-ob.uz, ob.ux) + Math.PI * 0.28;
    if (!MAQ.cam) {
      // 34 graus e teleobjetiva curta: miniatura com grande-angular distorce o predio
      // nas bordas do painel e a torre "cai" pra tras.
      MAQ.cam = new THREE.PerspectiveCamera(34, 1, 0.1, 6000);
    }
    return true;
  }

  function aplicaFadeMaquete(f) {
    MAQ.fade = f;
    if (!MAQ.raiz) return;
    MAQ.raiz.visible = f > 0.004;
    MAQ.raiz.traverse(o => {
      const m = o.material;
      if (!m || Array.isArray(m)) return;
      if (m._op0 === undefined) m._op0 = m.opacity;
      // `transparent` so e ligado quando precisa: material transparente sai da fila de
      // opacos, perde `depthWrite` e passa a ser ordenado por distancia todo quadro.
      // Pagar isso o tempo todo pra um fade de 600 ms seria caro do jeito errado.
      const tr = f < 0.996;
      if (m.transparent !== tr) { m.transparent = tr; m.needsUpdate = true; }
      m.opacity = m._op0 * f;
      m.depthWrite = !tr;
    });
  }

  /* ---- o retangulo em que ela e desenhada -------------------------------- */
  // O painel e um <div> de verdade (#maquete), movido entre as fichas: quem manda no
  // lugar e o CSS, e o WebGL so le onde ele parou. Ler o retangulo por quadro custa um
  // `getBoundingClientRect` -- a ficha ROLA por dentro (overflow:auto), entao a
  // alternativa seria invalidar em scroll, resize, troca de ficha e mudanca de conteudo,
  // e esquecer um deles deixa a miniatura desenhada fora do painel, sem erro nenhum.
  function rectDoPainel() {
    const el = $("maquete");
    if (!el || el.hidden || !el.offsetParent) return null;
    const b = el.getBoundingClientRect();
    if (b.width < 8 || b.height < 8) return null;
    // Recortado pela ficha: rolando a lista de comodos o painel sai por cima do titulo,
    // e sem o recorte a miniatura continuaria desenhada onde o painel ja nao esta.
    const pai = el.parentElement ? el.parentElement.getBoundingClientRect() : b;
    const x0 = Math.max(b.left, pai.left), x1 = Math.min(b.right, pai.right);
    const y0 = Math.max(b.top, pai.top),  y1 = Math.min(b.bottom, pai.bottom);
    if (x1 - x0 < 8 || y1 - y0 < 8) return null;
    return { x:x0, y:y0, w:x1 - x0, h:y1 - y0 };
  }
  const telaCheia = () => ({ x:0, y:0, w:innerWidth, h:innerHeight });

  function mostraMaquete(rec, u, dentroDe) {
    const el = $("maquete");
    if (!el) return false;
    if (!montaMaquete(rec, u)) { el.hidden = true; return false; }
    // UM painel, movido entre as fichas. Dois <div> seriam dois retangulos, dois
    // ouvintes de ponteiro e duas chances de desenhar no lugar errado.
    const pai = $(dentroDe);
    if (pai && el.parentElement !== pai) pai.insertBefore(el, pai.firstChild);
    el.hidden = false;
    MAQ.modo = "ficha"; MAQ.gira = true; MAQ.anim = null;
    MAQ.rect = rectDoPainel();
    pintaDicaMaquete();
    frameLoop();
    return true;
  }
  function escondeMaquete() {
    const el = $("maquete");
    if (el) el.hidden = true;
    MAQ.modo = "off"; MAQ.anim = null; MAQ.rect = null;
    soltaMaquete();
  }
  function pintaDicaMaquete() {
    const el = $("maqDica");
    if (!el) return;
    el.textContent = MAQ.andar >= 0
      ? (MAQ.uni && MAQ.uni.andar != null
          ? "Pavimento do imóvel em verde · " + (MAQ.uni.andar | 0) + "º andar"
          : "Imóvel em verde")
      : "Arraste para girar";
  }

  /* ---- a transicao: crescer ate a tela e mirar no pavimento --------------- */
  // `fim` roda no ultimo quadro da animacao. E ele que decide o que vem depois -- a
  // visita 3D ou a planta --, e e por isso que a mesma funcao serve as duas etapas.
  function cresceMaquete(paraAndar, dur, fim) {
    const de = MAQ.rect || rectDoPainel() || telaCheia();
    const alvoY = MAQ.base + (MAQ.andar >= 0 ? MAQ.andar : 0) * LV
                + (paraAndar ? 1.55 : LV * 0.5);
    /* O RAIO DE CHEGADA NAO E UMA FRACAO DO DE PARTIDA, e a medida do predio. Numa
       torre de 14 pavimentos o raio da ficha e ~60 m; num sobrado, ~20. Uma fracao
       entregaria a visita 3D a 14 m de distancia num caso e a 5 no outro -- e e o
       enquadramento de CHEGADA que tem que casar com o que vem depois, senao o primeiro
       quadro da etapa seguinte salta. */
    const raio = paraAndar ? Math.max(8, MAQ.obR * 1.1)      // quase encostando
                           : Math.max(13, MAQ.obR * 3.1);    // o mesmo de `enquadraPlanta`
    MAQ.modo = "crescendo";
    MAQ.gira = false;
    MAQ.anim = {
      t0: performance.now(), dur: dur || 900, fim: fim || null,
      de, para: telaCheia(),
      r0: MAQ.raio, r1: raio,
      y0: MAQ.alvo.y, y1: alvoY,
      p0: MAQ.phi, p1: paraAndar ? 1.28 : 0.72,
      // O campo tambem interpola: a miniatura usa 34 graus (teleobjetiva curta, que e
      // como maquete se fotografa) e o interior usa 95 horizontais. Saltar de um pro
      // outro no ultimo quadro e um corte -- e o corte e justamente o que esta etapa
      // existe pra tirar.
      f0: MAQ.cam ? MAQ.cam.fov : 34, f1: paraAndar ? fovInterior(false) : fovInterior(true)
    };
    const el = $("maquete");
    if (el) el.hidden = true;        // o <div> some: quem manda no retangulo agora e a animacao
    frameLoop();
  }

  function passoMaquete(now, dt) {
    if (MAQ.modo === "off") return;
    // O pulso do pavimento anda pelo RELOGIO, nao por quadro: no rasterizador de
    // software o quadro leva 700 ms, e um passo por quadro faria o verde piscar uma vez
    // por minuto na maquina em que ele mais precisa chamar atencao.
    MAQ.pulso += dt;
    if (MAQ.brilho) {
      const b = 0.5 + 0.5 * Math.sin(MAQ.pulso * 3.1);
      MAQ.brilho.material.opacity = (0.16 + b * 0.34) * MAQ.fade;
      if (MAQ.contorno) MAQ.contorno.material.opacity = (0.45 + b * 0.5) * MAQ.fade;
    }
    /* "some tanto para cima quanto para baixo do imovel". O predio nao e ESCONDIDO de
       uma vez: ele se apaga em ~700 ms enquanto a planta ja esta na tela, e e nesse
       intervalo que se ve que o andar que ficou e o mesmo que estava piscando. */
    const fa = MAQ.fadeAnim;
    if (fa) {
      const t = Math.min(1, (now - fa.t0) / fa.dur);
      aplicaFadeMaquete(fa.de + (fa.para - fa.de) * t);
      if (t >= 1) MAQ.fadeAnim = null;
    }
    const a = MAQ.anim;
    if (a) {
      const t = Math.min(1, (now - a.t0) / a.dur);
      const e = t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2, 3)/2;   // easeInOutCubic
      MAQ.rect = { x: a.de.x + (a.para.x - a.de.x)*e, y: a.de.y + (a.para.y - a.de.y)*e,
                   w: a.de.w + (a.para.w - a.de.w)*e, h: a.de.h + (a.para.h - a.de.h)*e };
      MAQ.raio = a.r0 + (a.r1 - a.r0)*e;
      MAQ.alvo.y = a.y0 + (a.y1 - a.y0)*e;
      MAQ.phi = a.p0 + (a.p1 - a.p0)*e;
      if (MAQ.cam && a.f0 != null) {
        MAQ.cam.fov = a.f0 + (a.f1 - a.f0)*e;
        MAQ.cam.updateProjectionMatrix();
      }
      if (t >= 1) { MAQ.anim = null; if (a.fim) a.fim(); }
    } else if (MAQ.modo === "ficha") {
      MAQ.rect = rectDoPainel();
      if (!MAQ.rect) return;
      // 0,13 rad/s: uma volta em 48 s. Devagar o bastante pra nao competir com a leitura
      // da ficha, que e o que a pessoa esta fazendo enquanto isso.
      if (MAQ.gira) MAQ.theta += 0.13 * Math.min(0.1, dt);
    }
  }

  /* As tres luzes de `cenaImovel` foram criadas pra etapa 3, e la quem as posiciona e
     o `plantaFrame`, por quadro, em relacao ao alvo da orbita. Na miniatura esse laco
     nao roda -- o quadro e o da CIDADE, e a miniatura e so um segundo `render()`. Sem
     esta funcao a principal fica em (0,0,0) mirando (0,0,0): uma direcional degenerada,
     que nao ilumina nada. Foi o que apareceu no primeiro print, junto com a sombra. */
  function poeLuzDaMaquete() {
    const kp = PLANTA.key;
    if (!kp || !MAQ.raiz) return;
    const a = MAQ.alvo, topo = MAQ.base + MAQ.n * LV;
    kp.position.set(a.x + 26, topo + 34, a.z + 20);
    kp.target.position.set(a.x, MAQ.base + MAQ.n * LV * 0.4, a.z);
    kp.target.updateMatrixWorld();
    PLANTA.fill.position.set(a.x - 30, topo + 16, a.z - 24);
  }

  // Onde a camera da miniatura esta AGORA. Sai daqui e nao de dentro do desenho porque
  // a transicao pro interior precisa desta mesma pose pra continuar de onde parou.
  function poeCamMaquete(cam, aspecto) {
    const sx = Math.sin(MAQ.phi);
    cam.position.set(MAQ.alvo.x + MAQ.raio * sx * Math.sin(MAQ.theta),
                     MAQ.alvo.y + MAQ.raio * Math.cos(MAQ.phi),
                     MAQ.alvo.z + MAQ.raio * sx * Math.cos(MAQ.theta));
    cam.lookAt(MAQ.alvo);
    if (aspecto && Math.abs(cam.aspect - aspecto) > 1e-4) {
      cam.aspect = aspecto; cam.updateProjectionMatrix();
    }
    cam.updateMatrixWorld();
  }

  /* O segundo `render()` do quadro. `setScissorTest` limita TAMBEM a limpeza, entao a
     cidade desenhada logo antes sobrevive fora do retangulo -- e por isso o painel nao
     precisa de fundo em CSS nem de um canvas proprio. */
  function desenhaMaquete() {
    if (MAQ.modo === "off" || MAQ.modo === "planta" || !MAQ.rect || !MAQ.raiz) return;
    const r = MAQ.rect;
    if (r.w < 8 || r.h < 8) return;
    poeLuzDaMaquete();
    poeCamMaquete(MAQ.cam, r.w / r.h);
    // `setViewport`/`setScissor` do three recebem PIXEL DE CSS: a multiplicacao pela
    // resolucao do buffer e feita la dentro. Passar pixel de buffer aqui desenharia a
    // miniatura no canto errado em toda tela com devicePixelRatio != 1 -- ou seja, em
    // todo celular.
    const y = innerHeight - r.y - r.h;
    /* O PLANO DE CORTE FICA. A tentacao e zera-lo aqui -- "o corte e da visita 3D, a
       maquete e inteira" -- e seria o erro que a nota do `CORTE` la em cima ja avisa:
       mexer em `renderer.clippingPlanes` muda a CONTAGEM de planos e recompila o shader
       de todo material envolvido, nos dois sentidos, A CADA QUADRO. Nao e preciso: a
       miniatura so e desenhada nas etapas em que o corte esta no infinito (`CORTE_OFF`),
       porque na unica que o baixa -- a etapa 3 -- ela ja saiu na primeira linha desta
       funcao (`modo === "planta"`). */
    /* `shadowMap.autoUpdate` e falso no projeto inteiro (ver a nota do `sujaSombra`), e
       o `needsUpdate` do quadro ja foi gasto pela cidade quando este render acontece --
       entao a luz da maquete nunca chegaria a ter mapa, e um mapa ausente le como
       sombra total. Aqui ele e refeito so quando alguma coisa mudou: montar a maquete,
       crescer, apagar. Parada na ficha, ela custa zero passadas de sombra. */
    renderer.shadowMap.needsUpdate = MAQ.sombraSuja || !!MAQ.anim || !!MAQ.fadeAnim;
    MAQ.sombraSuja = false;
    renderer.setScissorTest(true);
    renderer.setScissor(r.x, y, r.w, r.h);
    renderer.setViewport(r.x, y, r.w, r.h);
    renderer.render(cenaImovel, MAQ.cam);
    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, innerWidth, innerHeight);
  }

  /* ---- girar a miniatura com o dedo -------------------------------------- */

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
    // Uma transicao ja em curso nao se atropela: dois `cresceMaquete` no ar significam
    // dois `fim` disputando a camera, e o segundo ganha com o estado do primeiro.
    if (MAQ.anim) return;

    if (k === "mapa") {
      exitInterior();              // ele proprio desfaz a cena da planta, se for o caso
      ETAPA.atual = "mapa";
      usheet.classList.add("on"); usheet.classList.remove("min");
      houseBeacon.position.set(F.x, 0, F.z);
      houseBeacon.visible = true;
      enquadraImovel(true);
      mostraMaquete(F.rec, F.u, "usheet");
    } else if (k === "interior") {
      tour(false);
      ETAPA.atual = "interior";
      if (PLANTA.on) saiPlanta("interior");
      else if (INT.on) vista(false);
      else {
        // A ficha encolhe, a miniatura cresce ate a tela e se aproxima do pavimento;
        // quando chega, a visita 3D assume dali.
        usheet.classList.add("min");
        const entra = () => {
          usheet.classList.remove("on");
          escondeMaquete();
          enterInterior(F.rec, F.u);   // ele proprio declara a etapa "interior"
          pintaEtapas(); marcaEtapaNaUrl();
        };
        if (MAQ.modo === "ficha" && MAQ.raiz) {
          cresceMaquete(true, 950, () => {
            /* A EMENDA. A camera da cidade recebe a pose exata em que a miniatura
               parou; `enterInterior` usa `camera.position` como ponto de PARTIDA do voo
               de entrada, entao o primeiro quadro da visita e o ultimo da miniatura. E
               o unico motivo de a maquete viver em coordenadas do mundo (ver o
               cabecalho do bloco) -- em escala propria esta linha seria impossivel. */
            poeCamMaquete(camera, innerWidth / innerHeight);
            camera.fov = MAQ.cam.fov; camera.updateProjectionMatrix();
            entra();
          });
        } else entra();
      }
    } else if (k === "planta") {
      tour(false);
      ETAPA.atual = "planta";
      const entra = () => {
        poeIndoPara("planta");
        try {
          // Na planta nao ha ficha, so a planta.
          usheet.classList.remove("on");
          if (!INT.on) enterInterior(F.rec, F.u);
          INT.voo = null;          // o voo de entrada miraria a sala em primeira pessoa
          entraPlanta();
        } finally { poeIndoPara(null); }
        // A transicao termina DEPOIS que `vaiParaEtapa` ja retornou, entao a etapa e a
        // URL sao acertadas aqui -- e nao la embaixo, que roda antes de o voo comecar.
        ETAPA.atual = "planta";
        pintaEtapas(); marcaEtapaNaUrl();
      };
      if (MAQ.modo === "ficha" && MAQ.raiz) cresceMaquete(false, 900, entra);
      else entra();
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
    const dt = passoDoTempo(now);
    // A maquete continua viva aqui: ela esta na MESMA cena e e o fade dela que produz o
    // "some pra cima e pra baixo". Sem este passo o predio congelaria meio apagado.
    passoMaquete(now, dt);
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
      /* A altura do sol e RELATIVA ao alvo, nao absoluta. Com a planta na cota do
         andar, um sol cravado em y = 42 fica ABAIXO do piso de qualquer unidade do 14o
         andar pra cima -- e a planta passa a ser iluminada por baixo, o que le como
         negativo fotografico e nao como erro. */
      kp.position.set(target.x + 26, target.y + 42, target.z + 20);
      kp.target.position.set(target.x, target.y, target.z);
      kp.target.updateMatrixWorld();
      PLANTA.fill.position.set(target.x - 30, target.y + 22, target.z - 24);
    }
    renderer.shadowMap.needsUpdate = sombraPendente();
    limpaSombra();
    renderer.render(cenaImovel, camera);
    poeCpuMs(performance.now() - t0);
    pintaPerf(now);
    if (!semRaf()) requestAnimationFrame(getFrame());
  }

  function ligaPonteiroDaMaquete() {
    const el = $("maquete");
    if (!el || !el.addEventListener) return;
    let arr = false, lx = 0, ly = 0;
    el.addEventListener("pointerdown", e => {
      if (MAQ.modo !== "ficha") return;
      arr = true; lx = e.clientX; ly = e.clientY;
      MAQ.gira = false;                 // a mao de quem esta olhando manda mais que o giro
      el.setPointerCapture(e.pointerId);
      el.style.cursor = "grabbing";
      e.preventDefault(); e.stopPropagation();
    });
    el.addEventListener("pointermove", e => {
      if (!arr) return;
      MAQ.theta -= (e.clientX - lx) * 0.009;
      // A faixa de phi para longe do zenite e do horizonte: de cima a pino a maquete
      // vira planta baixa, e no horizonte ela some atras do proprio chao.
      MAQ.phi = Math.max(0.45, Math.min(1.42, MAQ.phi + (e.clientY - ly) * 0.007));
      lx = e.clientX; ly = e.clientY;
      frameLoop();
    });
    const solta = e => {
      if (!arr) return;
      arr = false; el.style.cursor = "";
      if (e && e.pointerId != null && el.hasPointerCapture(e.pointerId))
        el.releasePointerCapture(e.pointerId);
    };
    el.addEventListener("pointerup", solta);
    el.addEventListener("pointercancel", solta);
    el.addEventListener("wheel", e => {
      if (MAQ.modo !== "ficha") return;
      e.preventDefault(); e.stopPropagation();
      MAQ.raio = Math.max(6, Math.min(600, MAQ.raio * (1 + Math.sign(e.deltaY) * 0.1)));
      frameLoop();
    }, { passive:false });
  }

  /* ---- a porta de entrada, chamada pelo app.js -----------------------------
     Tudo que LE alguma coisa de fora mora aqui dentro: a URL, a cena e os botoes. */
  function iniciaEtapas() {
    LINK_IMOVEL = QS.get("imovel") || "";
    const _e = (QS.get("etapa") || "").toLowerCase();
    LINK_ETAPA = ETAPAS_NOMES.indexOf(_e) >= 0 ? _e : "mapa";
    montaCenaPlanta();
    ligaPonteiroDaMaquete();
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


    return {PLANTA, ETAPA, TOUR, cenaImovel, temPlanta, tour, tourPassa, pintaEtapas,
            vaiParaEtapa, entraPlanta, saiPlanta, trocaParedes, enquadraImovel,
            raioDoEnquadre, abrePeloLink, unidadePorId, getLinkImovel, plantaFrame,
            iniciaEtapas, passoDoTempo, marcaTempo, passoMaquete, desenhaMaquete,
            MAQ, montaMaquete, mostraMaquete, escondeMaquete, cresceMaquete,
            poeCamMaquete, aplicaFadeMaquete, rectDoPainel, poeIndoPara, indoPara};
  }
  root.ListingStages = Object.freeze({create});
})(globalThis);
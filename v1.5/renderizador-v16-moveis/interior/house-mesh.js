/* Interior house mesh: walls, skirting, floors and ceiling in three meshes, the bake queue and the openings. */
(function(root) {
  "use strict";
  function create({THREE, ESP, rgbAcabamento, triangulateRing, prismaQuad, quadDoSeg, cursorDeLuz, texturaDeLuz, _LUZUE, BAKE, bakePrepara, matParede, matFrio, matMadeira, geoDasEsquadrias}) {
/* Tres malhas, nao uma: parede, piso frio e piso de madeira tem MAPA diferente, e mapa
   diferente e material diferente. Sao tres chamadas de desenho pro apartamento inteiro
   -- o mesmo que custavam duas mesas de cabeceira. */
function geoDaCasa(pl, comTeto, tetoSeparado = false) {
  const P=[], N=[], C=[], U=[];
  const PF=[], NF=[], CF=[], UF=[];
  const PM=[], NM=[], CM=[], UM=[];
  const cor = (chave, padrao) => {
    const c = pl.unidade && pl.unidade.cores && pl.unidade.cores[chave];
    return rgbAcabamento(c ? parseInt(String(c).replace("#", ""), 16) : padrao);
  };
  const teto = cor("teto", 0xE6E3DD), parede = cor("parede", 0xD9D4CB),
        rodape = cor("rodape", 0xF4F2EE);
  // Placa de 1,20 m no piso frio e PASSO DE 2,40 m na madeira: a UV é o metro dividido
  // por esse passo, então a junta não anda quando o cômodo muda de tamanho. 2,40 e não
  // 1,60 porque a textura da madeira tem 12 réguas por passo — é a divisão que dá os
  // 20 cm de régua de verdade (ver texMadeira).
  //
  // O METRO É O DA PLANTA, NÃO O DO MUNDO, e essa é a diferença que o usuário viu: a
  // planta é girada pra assentar no eixo maior do prédio (`W()` em plantaDaUnidade), e
  // o prédio está no rumo da rua — 14°, 98°, 136°... Com a UV no X/Z do mundo, a junta
  // seguia o NORTE e cruzava a parede na diagonal, em toda unidade. Projetando o ponto
  // de volta no frame (ux,uz) do prédio, a régua nasce paralela à parede, que é como
  // piso se assenta. Vale para a placa de porcelanato pelo mesmo motivo.
  const oc = pl.ob;
  // v15: `LUZ` e o enderecador de pecas do atlas do Unreal (null quando nao ha
  // atlas pra esta unidade, ou quando `?luz=js`). Quando existe, ele e quem manda:
  // o bake em JS nao roda, porque os dois fazem a mesma conta e multiplicar as
  // duas escureceria canto duas vezes.
  const LUZ = cursorDeLuz(pl);
  // A peca de piso/forro cobre a CAIXA ENVOLVENTE do poligono no referencial da
  // planta -- exatamente como `face_de_poligono` do exportador. Por isso a conta
  // aqui usa (ux,uz) do predio e nao o X/Z do mundo.
  const caixaLocal = poly => {
    let a0 = 1e9, a1 = -1e9, b0 = 1e9, b1 = -1e9;
    for (const q of poly) {
      const dx = q[0]-oc.cx, dz = q[1]-oc.cz;
      const a =  dx*oc.ux + dz*oc.uz, b = -dx*oc.uz + dz*oc.ux;
      if (a < a0) a0 = a; if (a > a1) a1 = a;
      if (b < b0) b0 = b; if (b > b1) b1 = b;
    }
    return { a0, b0, da: (a1-a0) || 1, db: (b1-b0) || 1 };
  };
  const piso = (dst, poly, y, rgb, cima, passo, mapa) => {
    let tri; try { tri = triangulateRing(poly); } catch (e) { return; }
    const cx = mapa ? caixaLocal(poly) : null;
    for (const f of tri) for (const k of (cima ? [f[2], f[1], f[0]] : [f[0], f[1], f[2]])) {
      const px2 = poly[k][0] - oc.cx, pz2 = poly[k][1] - oc.cz;
      const la =  px2*oc.ux + pz2*oc.uz, lb = -px2*oc.uz + pz2*oc.ux;
      dst[0].push(poly[k][0], y, poly[k][1]); dst[1].push(0, cima ? 1 : -1, 0);
      dst[2].push(rgb[0], rgb[1], rgb[2]);
      dst[3].push(la/passo, lb/passo);
      if (dst[4]) {
        const t = mapa ? mapa((la-cx.a0)/cx.da, (lb-cx.b0)/cx.db) : [0, 0];
        dst[4].push(t[0], t[1]);
      }
    }
  };
  const U2 = LUZ ? [] : null, UF2 = LUZ ? [] : null, UM2 = LUZ ? [] : null;
  const dPar = [P, N, C, U, U2], dFrio = [PF, NF, CF, UF, UF2],
        dMad = [PM, NM, CM, UM, UM2];
  for (let i = 0; i < pl.comodos.length; i++) {
    const c = pl.comodos[i], mad = c.pisoTipo === "madeira";
    piso(mad ? dMad : dFrio, c.poly, 0.02, rgbAcabamento(c.piso), true,
         mad ? 2.4 : 1.2, LUZ && LUZ.piso(i));
  }
  // A curva: 0,82 no rodape, 1,00 na altura do peitoril, 0,93 no forro. Os numeros
  // sao poucos de proposito -- o que se quer e que a parede TENHA gradiente, e um
  // desnivel de 18% do chao ao meio ja e mais do que o olho precisa pra ler volume.
  const fyParede = y => {
    const t = Math.max(0, Math.min(1, y / pl.pd));
    return t < 0.42 ? 0.76 + 0.28 * (t/0.42)
                    : 1.04 - 0.14 * ((t-0.42)/0.58);
  };
  // v15: com bake ligado a curva sai de cena -- ela e a APROXIMACAO da mesma
  // coisa que o bake mede, e as duas somadas escureceriam o rodape duas vezes.
  // Com atlas do Unreal o bake em JS nao roda: os dois medem a mesma coisa, e
  // aplicar os dois escureceria canto duas vezes. `fyParede` tambem sai -- ela era
  // a aproximacao mais grosseira das tres.
  const assar = BAKE.on && !LUZ && pl.paredes && pl.paredes.length > 0;
  const cinco = f => [f(0), f(1), f(2), f(3), f(4)];
  // A parede que ENCOSTA no forro sobe 6 cm alem dele. Nao e folga de seguranca: a
  // `prismaQuad` emite uma TAMPA DE TOPO em y1 com normal (0,+1,0), e o forro e
  // desenhado no mesmo y=pd com normal (0,-1,0). Como o prisma tem ESP centrado na
  // divisa do comodo, 6,5 cm dessa tampa caem DENTRO do comodo, coplanares com o
  // forro -- e as duas faces sao DoubleSide. Uma virada pra cima (pega sol) e outra
  // pra baixo (na sombra) brigando pelo mesmo pixel dao um fio CLARO em toda junta
  // parede-teto: medido em +30 de luminancia sobre o vizinho mais claro. Subindo a
  // tampa acima do forro ela deixa de ser coplanar e deixa de ser visivel de dentro.
  const SOBE_FORRO = 0.06;
  /* PONTA DE PAREDE NAO PODE APARECER NA QUINA.

     `prismaQuad` fecha o prisma nas duas pontas, e essas tampas tem normal ao longo da
     parede -- ou seja, olham pro comodo. Numa quina isso e um fio vertical de 4 cm cuja
     normal ve a sala inteira, encravado entre duas faces que estao no canto, no escuro:
     o bake entrega luz de superficie exposta a ele e sombra as vizinhas, e o resultado
     e uma LISTRA CLARA em toda quina e em toda emenda de parede. Mesma fisica do fio do
     rodape (ver `semTampa`) -- so que aqui a tampa e necessaria, porque nem toda ponta
     morre em outra parede.

     A distincao ja existia no dado: `pa`/`pb` marcam a ponta que encosta num VAO (o
     vao de porta, onde a ponta E a face do rasgo e tem que aparecer). Ponta SEM essa
     marca morre em outra parede ou na divisa do desenho -- e essa entra meia espessura
     pra dentro da vizinha, onde ninguem a ve.

     Alongar so o desenho, e nao `pl.paredes`: a colisao e o bake leem o mesmo vetor, e
     parede mais comprida na colisao apertaria a passagem que o desenho nao mudou.     */
  /* MEIA ESPESSURA EXATA, e os dois erros de um lado e do outro sao visiveis:

     A ponta da parede tem que encostar na FACE DE FORA da vizinha -- nem antes, nem
     depois. Medido na mesma vista, mesma camera, em luminancia da listra sobre a
     parede (e olhando o apice da quina em busca de fresta):

       sem alongar        +13,8   a ponta fica exposta e vira listra clara
       + 10 mm             +8,0   atravessa a vizinha e sobra 1 cm do outro lado --
                                  uma tira de 10 cm encostada na face, que de perfil
                                  e a MESMA listra que o alongamento veio apagar
       -  6 mm             +0,7   sem listra, mas abre uma FRESTA de 6 mm na quina:
                                  nenhuma das duas paredes cobre aquele canto
       + 1,5 mm            +1,7
       ESP/2 exato         +0,9   sem listra e sem fresta                            */
  const EXT = ESP*0.5;
  const prismas = pl.paredes.map(w => {
    const dx=w.b[0]-w.a[0], dz=w.b[1]-w.a[1], L=Math.hypot(dx,dz)||1;
    const ea=w.remateA ?? (w.pa?0:EXT), eb=w.remateB ?? (w.pb?0:EXT);
    return {a:[w.a[0]-dx/L*ea,w.a[1]-dz/L*ea], b:[w.b[0]+dx/L*eb,w.b[1]+dz/L*eb],
      y0:w.y0,y1:w.y1>=pl.pd-.01?pl.pd+SOBE_FORRO:w.y1};
  });
  // Interseccao do segmento da ponta com os prismas vizinhos em coordenadas
  // locais. Funciona tambem depois de girar a planta e preserva UVs/atlas.
  const cortesDaPonta = (indice,face,esp,base,topo) => {
    const q=quadDoSeg([prismas[indice].a,prismas[indice].b],esp);
    const a=q[face], b=q[(face+1)%4], cortes=[];
    for (let j=0;j<prismas.length;j++) {
      if(j===indice) continue;
      const v=prismas[j], dx=v.b[0]-v.a[0], dz=v.b[1]-v.a[1], L=Math.hypot(dx,dz);
      const coord=p=>[( (p[0]-v.a[0])*dx+(p[1]-v.a[1])*dz)/L,
        (-(p[0]-v.a[0])*dz+(p[1]-v.a[1])*dx)/L];
      const A=coord(a),B=coord(b);let lo=0,hi=1;
      for(const [axis,min,max] of [[0,0,L],[1,-esp/2,esp/2]]) {
        const d=B[axis]-A[axis];
        if(Math.abs(d)<1e-9){if(A[axis]<min-1e-7||A[axis]>max+1e-7)hi=-1;}
        else {const x=(min-A[axis])/d,y=(max-A[axis])/d;lo=Math.max(lo,Math.min(x,y));hi=Math.min(hi,Math.max(x,y));}
      }
      const y0=base==null?v.y0:Math.max(base,v.y0),y1=topo==null?v.y1:Math.min(topo,v.y1);
      if(hi-lo>1e-7 && y1-y0>1e-7)cortes.push([lo,hi,y0,y1]);
    }
    return cortes;
  };
  for (let i = 0; i < pl.paredes.length; i++) {
    const w = pl.paredes[i];
    const yTopo = w.y1 >= pl.pd - 0.01 ? pl.pd + SOBE_FORRO : w.y1;
    const dxw = w.b[0]-w.a[0], dzw = w.b[1]-w.a[1];
    const Lw = Math.hypot(dxw, dzw) || 1, exw = dxw/Lw, ezw = dzw/Lw;
    const ea = w.remateA ?? (w.pa ? 0 : EXT), eb = w.remateB ?? (w.pb ? 0 : EXT);
    const wa = [w.a[0] - exw*ea, w.a[1] - ezw*ea];
    const wb = [w.b[0] + exw*eb, w.b[1] + ezw*eb];
    // Um remate substitui o filete removido: sua ponta pode ficar exposta junto
    // ao vao. Fechar essa face inteira impede enxergar por dentro do prisma.
    const semPontas = (w.pa || w.remateA != null ? 0 : 1) |
                      (w.pb || w.remateB != null ? 0 : 2);
    const cortes = {};
    if(w.remateA != null) cortes[3]=cortesDaPonta(i,3,ESP);
    if(w.remateB != null) cortes[1]=cortesDaPonta(i,1,ESP);
    prismaQuad(P, N, C, U, quadDoSeg([wa, wb], ESP), w.y0, yTopo, parede,
               (assar || LUZ) ? null : fyParede,
               U2, LUZ && cinco(f => LUZ.parede(i, f)), false,
               semPontas, 0.80, cortes);
    // Rodapé: 8 cm de faixa clara na base de toda parede que começa no chão. Custa
    // cinco quads por parede e é o detalhe que mais separa "caixa branca" de "cômodo".
    if (w.y0 < 0.05)
      // 1,4 cm de saliencia (era 2,4) e tampa em tom de PAREDE, nao de rodape: a
      // tampa e horizontal e virada pra cima, entao o bake entrega a ela a
      // irradiancia de quem ve o comodo todo -- com o branco do rodape isso vira um
      // fio picotado na junta chao-parede. Ver `rgbTopo` em prismaQuad.
      // 1,6 cm de saliencia e 9,5 cm de altura. O rodape sumia atras de todo movel
      // encostado -- mas a causa era o movel nascer 5 cm DENTRO da parede (ver
      // MEIA_PAREDE em `mobiliar.py`), nao o rodape ser fino. Corrigido aquilo, ele
      // ganhou volume de verdade: 1,6 cm passa na frente da folga de 1,5 cm com que
      // o movel para, entao ele aparece na junta em vez de ficar espremido.
      prismaQuad(P, N, C, U, quadDoSeg([wa, wb], ESP + 0.032), 0.02, 0.115, rodape,
                 null, U2, LUZ && cinco(f => LUZ.rodape(i, f)), true,
                 semPontas, undefined, {
                   3: w.remateA != null ? cortesDaPonta(i,3,ESP+.032,.02,.115) : [],
                   1: w.remateB != null ? cortesDaPonta(i,1,ESP+.032,.02,.115) : []
                 });
  }
  const dTeto = [[], [], [], [], LUZ ? [] : null];
  if (comTeto || tetoSeparado) for (let i = 0; i < pl.contorno.length; i++)
    piso(tetoSeparado ? dTeto : dPar, pl.contorno[i], pl.pd, teto, false, 1.2, LUZ && LUZ.teto(i));
  const malha = (Pa, Na, Ca, Ua, mat, Ua2) => {
    if (!Pa.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(Pa), 3));
    g.setAttribute("normal",   new THREE.BufferAttribute(new Float32Array(Na), 3));
    g.setAttribute("color",    new THREE.BufferAttribute(new Uint8Array(Ca), 3, true));
    g.setAttribute("uv",       new THREE.BufferAttribute(new Float32Array(Ua), 2));
    // `uv1` e o canal que o three usa pra lightMap desde a r152 (era `uv2` no r128).
    if (Ua2 && Ua2.length === (Pa.length/3)*2)
      g.setAttribute("uv1", new THREE.BufferAttribute(new Float32Array(Ua2), 2));
    g.computeBoundingSphere();
    const m = new THREE.Mesh(g, mat);
    m.userData.casa = true;
    m.receiveShadow = true;
    // A CASA TAMBEM PROJETA. Ficou so recebendo desde que o interior existe, e a
    // consequencia nao e "falta uma sombra": e que o sol atravessa o FORRO e toda
    // parede. Como esquadria e movel projetam, o que aparecia era a sombra do
    // BATENTE da janela desenhada no meio de uma parede interna -- um retangulo
    // escalonado saido do nada. Com a casa projetando, a unica luz direta que entra
    // e a que passa pelo vao, que e a mancha de sol no piso.
    m.castShadow = true;
    return m;
  };
  // v15: tesselar e por o bake na fila. Os tres grupos vao JUNTOS porque a
  // normalizacao da irradiancia e pela mediana dos tres -- ver `bakeFecha`. O
  // resultado fica em cache por unidade: reentrar na mesma casa nao paga o bake
  // de novo, e a vista de planta (sem forro) e uma entrada propria, porque a
  // malha e outra. A casa nasce com o albedo puro e escurece nos cantos ao longo
  // dos quadros seguintes -- ninguem espera pelo bake pra ver a sala.
  let gp = [[P, N, C, U], [PF, NF, CF, UF], [PM, NM, CM, UM]];
  let ctx = null;
  if (assar) {
    const ch = (pl.id || "?") + "|" + (comTeto ? 1 : 0);
    const pronto = BAKE.cache.get(ch);
    if (pronto) {                                   // ja assado: entra na hora
      gp = pronto.map((t, i) => t ? [t.P, t.N, t.C, t.U] : gp[i]);
      BAKE.pronto = true;
    } else {
      ctx = bakePrepara(pl, gp);
      if (ctx) { ctx.ch = ch; BAKE.pronto = false;
                 gp = ctx.malhas.map((t, i) => t ? [t.P, t.N, t.C, t.U] : gp[i]); }
    }
  }
  const grupo = new THREE.Group();
  // Com atlas, cada malha ganha um material PROPRIO -- `lightMap` e propriedade de
  // material, e os tres materiais base sao compartilhados por toda unidade. Sao tres
  // materiais por casa aberta, nao por quadro: o custo e de compilacao uma vez.
  const luzTex = LUZ ? texturaDeLuz(pl.id) : null;
  const comLuz = base => {
    if (!luzTex) return base;
    const m = base.clone();
    m.lightMap = luzTex;
    m.lightMapIntensity = (_LUZUE[pl.id] && _LUZUE[pl.id].escala) || 1.6;
    // O `envMap` do interior e um DEGRADE UNIFORME (ver `ambientePBR`): ele existia
    // pra fingir ambiente antes de existir bake, e ilumina todo ponto da parede
    // igual. Somado ao lightmap ele e quem achata -- medido, o atlas tem faixa de
    // 255 dentro das pecas e a cena saia com 51. Nao vai a zero porque ainda e ele
    // quem da o brilho especular do piso frio; cai pra um quarto.
    m.envMapIntensity = base.envMapIntensity * 0.25;
    return m;
  };
  const gl = [malha(gp[0][0], gp[0][1], gp[0][2], gp[0][3], comLuz(matParede), U2),
              malha(gp[1][0], gp[1][1], gp[1][2], gp[1][3], comLuz(matFrio), UF2),
              malha(gp[2][0], gp[2][1], gp[2][2], gp[2][3], comLuz(matMadeira), UM2)];
  for (const m of gl) if (m) grupo.add(m);
  if (tetoSeparado) {
    const forro = malha(dTeto[0], dTeto[1], dTeto[2], dTeto[3], comLuz(matParede), dTeto[4]);
    if (forro) { forro.name = 'forro-original'; grupo.add(forro); }
  }
  if (ctx) { ctx.gl = gl; BAKE.fila = ctx; }
  // Esquadria DEPOIS das três: `mede_interior.py` lê `INT.casa.children[1]` pra provar
  // que o piso recebe sombra, e entrar no meio da fila trocaria o piso por um batente.
  for (const m of geoDasEsquadrias(pl)) grupo.add(m);
  return grupo;
}

    return {geoDaCasa};
  }
  root.HouseMesh = Object.freeze({create});
})(globalThis);

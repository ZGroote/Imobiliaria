/* Interior light bake: ambient occlusion with one bounce, traced incrementally and written into vertex colour. */
(function(root) {
  "use strict";
  function create({inside, PD}) {
/* ============================================================
   12b. Bake de luz — a irradiância do cômodo, medida uma vez  (v15)
   ============================================================
   O plano que pediu isto mandava construir os apartamentos no Unreal, bakear
   lightmap com Lumen e trazer as texturas pro Three. O RESULTADO que ele quer é
   este: a luz do cômodo deixa de ser um valor chapado por face e passa a ter
   canto escuro, contato com o piso e parede clara perto da janela — sem custar
   GPU no navegador. O CAMINHO é que não serve aqui: 30-60 MB de KTX2 por cidade
   quebram a página que abre em file:// com duplo clique, e um bake externo é
   uma segunda fonte de verdade pra mesma planta, que muda toda vez que alguém
   corrige um cômodo no cadastro.

   Então o bake roda AQUI, sobre a mesma geometria que já é gerada, e escreve no
   MESMO lugar que já existia: a cor por vértice. Três consequências que são o
   motivo de valer a pena:

   - CUSTO DE DESENHO ZERO. Não entra textura, atributo, material nem malha. As
     três malhas da casa (parede, piso frio, piso madeira) continuam sendo três
     chamadas de desenho. O que muda é o conteúdo do buffer de cor.

   - TRIÂNGULO É BARATO, CHAMADA É CARA — a mesma conta do móvel chanfrado. Cor
     por vértice só tem resolução onde há vértice, e um quad de parede tem
     quatro. Então a malha é TESSELADA a ~34 cm antes de assar: sai de centenas
     pra milhares de triângulos, que a GPU nem sente, e o gradiente passa a ter
     onde morar.

   - O QUE ELE SUBSTITUI. `fyParede` era uma curva escrita à mão (0,76 no
     rodapé, 1,04 no peitoril, 0,90 no forro) fingindo a queda de luz. Fingia
     igual em toda parede — a que fica de frente pra janela e a do fundo do
     banheiro saíam com o mesmo desenho. Com o bake ligado ela sai de cena; sem
     bake (planta sem parede, ou `?bake=0`) ela continua sendo o fallback.

   Como se mede a irradiância, já que não há Lumen:

     de cada vértice saem 48 raios cosseno-ponderados no hemisfério da normal;
     cada raio devolve CÉU (escapou da planta por um vão) ou a distância até o
     que bateu. Céu vale 1; bater vale pouco e proporcional à distância — que é
     o que faz canto de parede (bate a 20 cm) ficar escuro e meio de sala (bate
     a 3 m) ficar claro. É oclusão de ambiente com uma ricochetada, não path
     tracing; e é o que uma foto de apartamento vazio mostra.

   Duas decisões que não são óbvias:

   - A CONTA RODA NO REFERENCIAL DA PLANTA, não no do mundo. A planta é girada
     pra assentar no eixo maior do prédio, e o prédio está no rumo da rua. No
     mundo as paredes ficam a 14°, 98°, 136°... e a caixa envolvente de uma
     parede de 8 m a 45° cobre 64 células da grade de busca. No referencial da
     planta toda parede é paralela a um eixo e a caixa é uma fatia. A luz é
     invariante a rotação, então não se perde nada.

   - A NORMALIZAÇÃO É PELA MÉDIA. O bake sai como ganho relativo (média 1), não
     como brilho absoluto. Sem isso ele seria mais um botão de exposição, e a
     exposição deste projeto tem dono: `pipeline/mede_interior.py`, que reprova
     o build fora da faixa de 120 a 175 de média. Normalizado pela média, o que
     o bake acrescenta é CONTRASTE (a medida `faixa`, p95-p05) com a média
     praticamente parada.
   ============================================================ */

const BAKE = {
  passo:   0.40,   // aresta máxima do triângulo depois de tesselar (m)
  raios:   48,     // direções por vértice
  alcance: 6.0,    // até onde vale procurar oclusor (m)
  celula:  0.90,   // lado da célula da grade de busca (m)
  raster:  0.25,   // lado da célula do mapa "isto ainda é dentro da planta" (m)
  perto:   2.60,   // distância em que bater já não escurece (m)
  // Os quatro números da APARÊNCIA, e são os únicos que se calibra no olho + no
  // `mede_interior.py`. Foram parar aqui vindos de 0,60/0,70/0,58/1,28, que passava
  // em Ribeirão e REPROVAVA São Carlos: a vista da circulação do monte-das-colinas
  // é um corredor apertado, onde a oclusão é quase uniforme, e a faixa dinâmica caía
  // pra 65,8 contra o mínimo de 80. A curva `fyParede` que saiu de cena entregava
  // aquele contraste de graça, porque rampeava 0,76->1,04 em TODA parede, olhando ou
  // não pra janela. O bake precisou de contraste de verdade pra repor: céu contra
  // superfície de 1 pra 0,30 (era 1 pra 0,60), e gama acima de 1, que ABRE em vez de
  // fechar. Medido depois: São Carlos 90,4 e Ribeirão 84,6.
  bounce:  0.30,   // quanto uma superfície devolve, contra 1,0 do céu
  gama:    1.12,   // curva do ganho depois de normalizar (>1 abre o contraste)
  chao:    0.28, teto: 1.38,   // trava do ganho: nem preto no canto, nem estouro
  tinta:   1.0,    // amplitude do degradê de temperatura (0 = sem cor)
  suave:   2,      // passadas de suavização sobre a vizinhança do vértice
  raio:    0.45,   // raio dessa vizinhança, em metros
  fundo:   4,      // profundidade máxima de subdivisão (2^4 por aresta)
  tetoVert: 260000,            // guarda-chuva: para de subdividir se passar disto
  cache:   new Map(), guarda: 6,   // bake por unidade; 6 cabe de sobra
  fila:    null,   // contexto em andamento; o laco de quadro drena
  lote:    128,    // vértices traçados entre duas olhadas no relógio
  orcVoo:  12,     // ms por quadro DURANTE o voo de entrada
  orcamento: 4,    // ms por quadro depois que a câmera parou
  msPrep:  0,      // custo SINCRONO (tesselar + tabela de vertices)
  pronto:  false,
  ms:      0, vertices: 0, unicos: 0, tris: 0,
  on:      new URLSearchParams(location.search).get("bake") !== "0"
};

/* 48 direções cosseno-ponderadas, geradas uma vez. Hammersley (van der Corput na
   base 2) + Malley: sorteia no disco e levanta pra esfera — o cosseno sai da
   projeção, sem rejeição e sem acos. Y é o eixo da normal no espaço tangente. */
const BAKE_DIR = (() => {
  const n = BAKE.raios, d = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    let b = i, r = 0, f = 0.5;
    while (b) { r += (b & 1) * f; b >>= 1; f *= 0.5; }
    const sr = Math.sqrt(r), ph = 2 * Math.PI * ((i + 0.5) / n);
    d[i*3]   = sr * Math.cos(ph);
    d[i*3+1] = Math.sqrt(Math.max(0, 1 - r));
    d[i*3+2] = sr * Math.sin(ph);
  }
  return d;
})();

/* ---- a cena do bake: paredes, piso, forro e "onde acaba a planta" ------
   Só isto ocluí. Móvel não entra de propósito: as unidades cadastradas estão
   vazias (`planta.moveis` vazio em todas), e móvel arrastado pelo usuário
   invalidaria o bake a cada gesto. */
function cenaDoBake(pl) {
  const ob = pl.ob;
  const loc = (x, z) => [ (x - ob.cx) * ob.ux + (z - ob.cz) * ob.uz,
                         -(x - ob.cx) * ob.uz + (z - ob.cz) * ob.ux ];
  const segs = [];
  for (const w of pl.paredes) {
    const A = loc(w.a[0], w.a[1]), B = loc(w.b[0], w.b[1]);
    if (Math.abs(A[0]-B[0]) + Math.abs(A[1]-B[1]) < 1e-4) continue;
    segs.push({ ax:A[0], az:A[1], rx:B[0]-A[0], rz:B[1]-A[1], y0:w.y0, y1:w.y1 });
  }
  const polys = pl.contorno.map(c => c.map(p => loc(p[0], p[1])));
  let u0 = 1e9, u1 = -1e9, v0 = 1e9, v1 = -1e9;
  for (const c of polys) for (const p of c) {
    if (p[0] < u0) u0 = p[0]; if (p[0] > u1) u1 = p[0];
    if (p[1] < v0) v0 = p[1]; if (p[1] > v1) v1 = p[1];
  }
  u0 -= 1; v0 -= 1; u1 += 1; v1 += 1;

  // grade de busca: cada parede entra nas células da sua caixa envolvente. No
  // referencial da planta a caixa de uma parede é uma fatia de uma célula de
  // largura, então não há desperdício.
  const cel = BAKE.celula;
  const NI = Math.max(1, Math.ceil((u1-u0)/cel)), NJ = Math.max(1, Math.ceil((v1-v0)/cel));
  const bal = new Array(NI*NJ);
  for (let k = 0; k < segs.length; k++) {
    const s = segs[k];
    const i0 = Math.max(0,    Math.floor((Math.min(s.ax, s.ax+s.rx) - u0)/cel)),
          i1 = Math.min(NI-1, Math.floor((Math.max(s.ax, s.ax+s.rx) - u0)/cel)),
          j0 = Math.max(0,    Math.floor((Math.min(s.az, s.az+s.rz) - v0)/cel)),
          j1 = Math.min(NJ-1, Math.floor((Math.max(s.az, s.az+s.rz) - v0)/cel));
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      const c = i*NJ + j; (bal[c] || (bal[c] = [])).push(k);
    }
  }

  // mapa de pertinência: raio que sai da planta viu o céu. Testar polígono a
  // cada raio custaria mais que o raio; um raster de 25 cm resolve num índice.
  const rc = BAKE.raster;
  const RI = Math.max(1, Math.ceil((u1-u0)/rc)), RJ = Math.max(1, Math.ceil((v1-v0)/rc));
  const dentro = new Uint8Array(RI*RJ);
  for (let i = 0; i < RI; i++) for (let j = 0; j < RJ; j++) {
    const x = u0 + (i+0.5)*rc, z = v0 + (j+0.5)*rc;
    for (const c of polys) if (inside(c, x, z)) { dentro[i*RJ+j] = 1; break; }
  }
  // `gira` e o `loc` SEM a translacao: e o que converte a normal, que e direcao e
  // nao ponto. Faltava isto na primeira versao, e o efeito nao foi normal torta --
  // foi bake inteiro valendo 1: o vertice ficava no mundo, a parede no referencial
  // da planta, nenhum raio batia em nada e tudo virava ceu.
  const gira = (x, z) => [ x*ob.ux + z*ob.uz, -x*ob.uz + z*ob.ux ];
  return { segs, bal, NI, NJ, cel, u0, v0, dentro, RI, RJ, rc,
           pd: pl.pd, yPiso: 0.02, loc, gira,
           marca: new Int32Array(segs.length).fill(-1), rodada: 0 };
}

const _bakeDentro = (S, x, z) => {
  const i = Math.floor((x - S.u0)/S.rc), j = Math.floor((z - S.v0)/S.rc);
  return (i < 0 || j < 0 || i >= S.RI || j >= S.RJ) ? 0 : S.dentro[i*S.RJ + j];
};

/* Devolve a distância até o que o raio bateu, ou -1 se ele escapou pro céu.
   O passeio é 2D (DDA sobre a grade) e a altura entra só no teste do vão: é o
   que faz a janela ser janela — parede embaixo do peitoril, parede acima da
   verga, e nada no meio. */
function bakeRaio(S, ox, oy, oz, dx, dy, dz) {
  const alc = BAKE.alcance;
  const h = Math.hypot(dx, dz);
  let melhor = Infinity;

  if (h > 1e-6) {
    const ex = dx/h, ez = dz/h, sLim = alc * h;
    S.rodada++;
    let ci = Math.floor((ox - S.u0)/S.cel), cj = Math.floor((oz - S.v0)/S.cel);
    const pi = ex > 0 ? 1 : -1, pj = ez > 0 ? 1 : -1;
    const dI = Math.abs(ex) > 1e-9 ? Math.abs(S.cel/ex) : Infinity;
    const dJ = Math.abs(ez) > 1e-9 ? Math.abs(S.cel/ez) : Infinity;
    let nI = dI === Infinity ? Infinity
           : ((ex > 0 ? (ci+1)*S.cel + S.u0 - ox : ox - (ci*S.cel + S.u0)) / Math.abs(ex));
    let nJ = dJ === Infinity ? Infinity
           : ((ez > 0 ? (cj+1)*S.cel + S.v0 - oz : oz - (cj*S.cel + S.v0)) / Math.abs(ez));
    let s = 0;
    while (s <= sLim && ci >= 0 && cj >= 0 && ci < S.NI && cj < S.NJ) {
      const lista = S.bal[ci*S.NJ + cj];
      if (lista) for (let n = 0; n < lista.length; n++) {
        const k = lista[n];
        if (S.marca[k] === S.rodada) continue;
        S.marca[k] = S.rodada;
        const g = S.segs[k];
        const den = ex*g.rz - ez*g.rx;
        if (den > -1e-12 && den < 1e-12) continue;
        const qx = g.ax - ox, qz = g.az - oz;
        const t = (qx*g.rz - qz*g.rx) / den;
        if (t <= 0.10 || t >= melhor || t > sLim) continue;
        const u = (qx*ez - qz*ex) / den;
        if (u < 0 || u > 1) continue;
        const y = oy + dy*(t/h);
        if (y >= g.y0 && y <= g.y1) melhor = t;
      }
      if (melhor < (nI < nJ ? nI : nJ)) break;
      if (nI < nJ) { s = nI; nI += dI; ci += pi; } else { s = nJ; nJ += dJ; cj += pj; }
    }
  }

  const tPar = melhor === Infinity ? Infinity : melhor / h;
  let tFC = Infinity;
  if (dy < -1e-6)     { const t = (S.yPiso - oy)/dy; if (t > 0.03) tFC = t; }
  else if (dy > 1e-6) { const t = (S.pd    - oy)/dy; if (t > 0.03) tFC = t; }

  if (tPar < tFC) return tPar < alc ? tPar : alc;
  if (tFC < alc) return _bakeDentro(S, ox + dx*tFC, oz + dz*tFC) ? tFC : -1;
  return _bakeDentro(S, ox + dx*alc, oz + dz*alc) ? alc : -1;
}

/* ---- tesselação: aresta longa vira aresta curta -----------------------
   Divisão pelo ponto médio (1 triângulo -> 4), recursiva enquanto a maior aresta
   passar do passo. Preserva a forma, então testar aresta basta — não precisa de
   área nem de proporção. Normal, cor e UV são interpolados; como cada face aqui
   é plana, a normal do filho é a do pai. */
function tesselaSopa(P, N, C, U, passo) {
  const oP = [], oN = [], oC = [], oU = [], p2 = passo*passo;
  const emite = v => { oP.push(v[0],v[1],v[2]); oN.push(v[3],v[4],v[5]);
                       oC.push(v[6],v[7],v[8]); oU.push(v[9],v[10]); };
  const meio = (a, b) => { const m = new Array(11);
                           for (let k = 0; k < 11; k++) m[k] = (a[k]+b[k])*0.5; return m; };
  const d2 = (a, b) => { const x=a[0]-b[0], y=a[1]-b[1], z=a[2]-b[2]; return x*x+y*y+z*z; };
  const parte = (a, b, c, nv) => {
    if (nv >= BAKE.fundo || oP.length > BAKE.tetoVert*3 ||
        (d2(a,b) <= p2 && d2(b,c) <= p2 && d2(c,a) <= p2)) {
      emite(a); emite(b); emite(c); return;
    }
    const ab = meio(a,b), bc = meio(b,c), ca = meio(c,a);
    parte(a, ab, ca, nv+1); parte(ab, b, bc, nv+1);
    parte(ca, bc, c, nv+1); parte(ab, bc, ca, nv+1);
  };
  for (let i = 0; i < P.length; i += 9) {
    const v = k => { const o = i + k*3, w = (i/3 + k)*2;
      return [P[o],P[o+1],P[o+2], N[o],N[o+1],N[o+2], C[o],C[o+1],C[o+2], U[w],U[w+1]]; };
    parte(v(0), v(1), v(2), 0);
  }
  return { P: oP, N: oN, C: oC, U: oU };
}

/* ---- o bake propriamente -----------------------------------------------
   Recebe os grupos de atributo já montados (parede, piso frio, piso madeira),
   devolve os mesmos grupos tesselados e com a cor multiplicada pela
   irradiância. A média é GLOBAL aos três: normalizar cada malha pela própria
   média deixaria piso e parede com o mesmo brilho médio, que é justamente o que
   se quer evitar. */
/* O bake em TRES tempos, e nao num bloco so. Medido com relogio de verdade
   (`--virtual-time-budget` congela `performance.now()` durante JS sincrono, e por
   isso a sonda relatava 0 ms): assar o mirra-114 de uma vez custa 948 ms. O voo
   de entrada dura 1.100 -- ou seja, a versao sincrona comia a animacao inteira e
   entregava um engasgo no lugar do que ela veio melhorar.

   Entao: `bakePrepara` tessela e monta a tabela de vertices (barato, sai junto
   com a malha); `bakePasso` traca alguns milhares de vertices por quadro dentro
   de um orcamento; `bakeFecha` suaviza, normaliza e escreve na cor. A casa
   aparece na hora com o albedo puro e a luz ASSENTA durante o voo.

   `bakeAgora()` termina o que falta de uma vez -- e o que as sondas chamam, pra
   nao fotografar uma cena assando pela metade e aprovar outra coisa. */
function bakePrepara(pl, grupos) {
  const _t0 = (typeof performance !== "undefined" && performance.now)
                ? performance.now() : Date.now();
  const S = cenaDoBake(pl);
  if (!S.segs.length) return null;      // planta sem parede: não há o que ocluir

  // Vértice repetido é a REGRA numa sopa de triângulos (3 cópias por face, e as
  // faces vizinhas repetem a aresta). Juntar as cópias serve a duas coisas: o
  // raio de cada ponto é traçado uma vez só (37 mil em vez de 219 mil), e a
  // vizinhança fica conhecida -- que é do que a suavização vive.
  const malhas = [], chave = new Map(), pos = [], nrm = [], idx = [];
  for (const g of grupos) {
    if (!g[0].length) { malhas.push(null); idx.push(null); continue; }
    const t = tesselaSopa(g[0], g[1], g[2], g[3], BAKE.passo);
    const n = t.P.length / 3, ix = new Int32Array(n);
    for (let i = 0; i < n; i++) {
      // a geometria está no MUNDO; a cena do bake, no referencial da planta.
      const q = S.loc(t.P[i*3], t.P[i*3+2]), qn = S.gira(t.N[i*3], t.N[i*3+2]);
      // TETO DA AMOSTRA: o vertice que esta ACIMA DO FORRO nao pode ser assado onde
      // ele esta. A parede sobe `SOBE_FORRO` alem do forro de proposito (senao a tampa
      // do prisma briga com o forro pelo mesmo pixel, ver `yTopo`), so que la em cima
      // ela esta FORA do comodo: o raio sai por sobre o forro, ve espaco aberto e volta
      // com irradiancia de fachada. A face lateral da parede interpola desse vertice
      // pra baixo, e o valor escorre pra dentro -- que e o FIO CLARO na junta
      // parede-teto que o usuario viu ("vazamento de luz"). Confirmado por A/B: com
      // `?bake=0` a junta sai limpa. Amostrar 2 cm abaixo do forro devolve o valor que
      // o ponto teria se a parede terminasse nele, que e o que se quer desenhar.
      //
      // E O MESMO DEFEITO NA OUTRA PONTA, que ficou de fora e e o "vazamento pela
      // quina perto do chao": a parede comeca em y=0 e o piso esta em y=0,02, entao a
      // base do prisma (e o rodape inteiro, que nasce em 0,02) esta NO NIVEL do piso
      // ou abaixo dele. Em `bakeRaio` o piso so entra como oclusor quando o raio o
      // cruza a mais de 3 cm -- de py=0 o cruzamento da t negativo, de py=0,02 da
      // zero, e nos dois casos o raio que DESCE nao bate em nada: cai no teste de
      // pertinencia a 6 m, que numa parede externa cai fora da planta e volta como
      // CEU (peso 1,0, contra 0,30 de superficie). Metade do hemisferio de um vertice
      // de normal horizontal aponta pra baixo, entao a base ganhava ate ~50% de ceu
      // que ela nao ve, e o valor escorria pra cima ate o proximo vertice (40 cm) mais
      // o raio da suavizacao (45 cm) -- a faixa clara de ~80 cm na junta chao-parede.
      // Medido no mirra-114: da altura do olho pra base a parede SUBIA 84 -> 111.
      // Piso da amostra 4 cm acima do piso e nao 2: o pior caso do corte de 3 cm e o
      // raio vertical (|dy| = 1), onde t vale a propria altura.
      const py = Math.min(Math.max(t.P[i*3+1], S.yPiso + 0.04), (pl.pd || PD) - 0.02);
      const px = q[0], pz = q[1];
      const nx = qn[0], ny = t.N[i*3+1], nz = qn[1];
      // CHAVE NUMERICA, nao string. Sao ~180 mil vertices, e montar 180 mil
      // strings custava a maior parte dos 190 ms sincronos desta etapa -- que e a
      // unica parte do bake que o usuario espera. 2 cm em 12 bits por eixo cobrem
      // +-40 m (planta nenhuma chega perto), e a normal cabe em 27 casos porque
      // aqui toda face e plana e axial. 2^41 e inteiro exato em ponto flutuante.
      const qx = ((px*50 + 2048) | 0), qy = ((py*50 + 2048) | 0), qz = ((pz*50 + 2048) | 0);
      const ch = ((qx*4096 + qy)*4096 + qz)*27
               + ((nx > 0.5 ? 2 : nx < -0.5 ? 0 : 1)*9
                + (ny > 0.5 ? 2 : ny < -0.5 ? 0 : 1)*3
                + (nz > 0.5 ? 2 : nz < -0.5 ? 0 : 1));
      let k = chave.get(ch);
      if (k === undefined) {
        k = pos.length / 3; chave.set(ch, k);
        pos.push(px, py, pz); nrm.push(nx, ny, nz);
      }
      ix[i] = k;
    }
    malhas.push(t); idx.push(ix);
  }
  const nu = pos.length / 3;
  // esta parte E sincrona (a malha depende dela). Medida separada de proposito:
  // se um dia ela passar de ~1 quadro, e ela que precisa fatiar, nao o traco.
  BAKE.msPrep = ((typeof performance !== "undefined" && performance.now)
                   ? performance.now() : Date.now()) - _t0;
  return { S, malhas, idx, pos, nrm, nu, E: new Float32Array(nu),
           Ceu: new Float32Array(nu), i: 0, gl: null, ch: null, ms: 0 };
}

function bakePasso(ctx, orcamento) {
  const agora = () => (typeof performance !== "undefined" && performance.now)
                        ? performance.now() : Date.now();
  const t0 = agora();
  const P = ctx.pos, N = ctx.nrm;
  while (ctx.i < ctx.nu) {
    // lote: chamar o relógio por vértice custaria mais que o vértice; mas um lote
    // grande demais estoura o orçamento antes da primeira olhada. Medido, o traço
    // sai a ~19 µs por vértice nesta máquina -- 128 dá ~2,4 ms, que cabe no menor
    // dos dois orçamentos. Com 512 (a primeira escolha) cada quadro gastava 9,7 ms
    // achando que gastava 4.
    const fim = Math.min(ctx.nu, ctx.i + BAKE.lote);
    for (let k = ctx.i; k < fim; k++) {
      ctx.E[k] = bakeVertice(ctx.S, P[k*3], P[k*3+1], P[k*3+2], N[k*3], N[k*3+1], N[k*3+2]);
      ctx.Ceu[k] = _bakeCeu;
    }
    ctx.i = fim;
    if (agora() - t0 > orcamento) { ctx.ms += agora() - t0; return false; }
  }
  ctx.ms += agora() - t0;
  bakeFecha(ctx);
  return true;
}

function bakeFecha(ctx) {
  const nu = ctx.nu;
  if (!nu) { BAKE.pronto = true; return; }   // planta so com esquadria: nada a assar
  let E = _bakeSuaviza(ctx.pos, ctx.nrm, ctx.E, nu);
  // a fracao de ceu passa pelo MESMO filtro: sem isso a temperatura chega ruidosa
  // e a parede fica manchada de azul e bege em vez de virar um degrade.
  const CEU = _bakeSuaviza(ctx.pos, ctx.nrm, ctx.Ceu, nu);
  // NORMALIZAR PELA MEDIANA, não pela média. A distribuição da irradiância num
  // apartamento é torta pra direita: quase toda superfície enxerga o mesmo pouco
  // (parede de frente pra parede), e uma minoria -- o que dá de cara pra janela
  // -- enxerga muito. Com a média, essa minoria puxa o divisor pra cima e a
  // PAREDE TÍPICA sai escurecida; medido, a mediana do ganho ficava em 0,82, ou
  // seja o bake virava um botão de exposição pra baixo -- que é o que ele não
  // pode ser, porque a exposição tem dono (`pipeline/mede_interior.py`). Pela
  // mediana, a parede típica fica onde estava e o bake só mexe nos extremos.
  const ord = Array.prototype.slice.call(E).sort((a, b) => a - b);
  const med = ord[ord.length >> 1] || 1;
  let baixo = 0, alto = 0;
  const ganho = new Float32Array(nu);
  for (let k = 0; k < nu; k++) {
    let g = Math.pow(Math.max(1e-3, E[k]/med), BAKE.gama);
    if (g < BAKE.chao) { g = BAKE.chao; baixo++; }
    else if (g > BAKE.teto) { g = BAKE.teto; alto++; }
    ganho[k] = g;
  }
  // TEMPERATURA: o vertice que enxerga muito ceu recebe luz fria; o que so enxerga
  // parede recebe o que ricocheteou, que e quente. `BAKE.tinta` e a amplitude --
  // pequena de proposito, porque a cor tem dono (o cadastro) e isto e a LUZ, nao a
  // tinta da parede. A referencia de calibragem e a mediana da fracao de ceu, nao
  // zero: senao um apartamento inteiro de frente pra janela sairia todo azul.
  let somaCeu = 0;
  for (let k = 0; k < nu; k++) somaCeu += CEU[k];
  const medCeu = (somaCeu / nu) || 0.001;
  const TQ = [1.045, 0.998, 0.928];   // quente: o que voltou do piso
  const TF = [0.958, 0.992, 1.062];   // frio: o que veio do ceu
  const tinta = new Float32Array(nu * 3);
  for (let k = 0; k < nu; k++) {
    let d = (CEU[k] - medCeu) / Math.max(0.08, medCeu);   // -1 fundo, +1 janela
    d = d < -1 ? -1 : (d > 1 ? 1 : d);
    const f = 0.5 + 0.5 * d, q = 1 - f;
    for (let c = 0; c < 3; c++)
      tinta[k*3+c] = 1 + ((TQ[c]-1)*q + (TF[c]-1)*f) * BAKE.tinta;
  }
  for (let m = 0; m < ctx.malhas.length; m++) {
    const t = ctx.malhas[m]; if (!t) continue;
    const ix = ctx.idx[m];
    for (let i = 0; i < ix.length; i++) {
      const k = ix[i], g = ganho[k];
      for (let c = 0; c < 3; c++) {
        const v = t.C[i*3+c] * g * tinta[k*3+c];
        t.C[i*3+c] = v > 255 ? 255 : (v < 0 ? 0 : v);
      }
    }
    // a malha já está na tela com o albedo puro: aqui a cor assentada entra no
    // buffer que já existe, sem recriar geometria nem chamada de desenho.
    const at = ctx.gl && ctx.gl[m] && ctx.gl[m].geometry.attributes.color;
    if (at) { at.array.set(t.C); at.needsUpdate = true; }
  }
  if (ctx.ch) {
    if (BAKE.cache.size >= BAKE.guarda) BAKE.cache.delete(BAKE.cache.keys().next().value);
    BAKE.cache.set(ctx.ch, ctx.malhas);
  }
  BAKE.ms = ctx.ms; BAKE.unicos = nu; BAKE.med = med; BAKE.pronto = true;
  BAKE.vertices = ctx.malhas.reduce((a, t) => a + (t ? t.P.length/3 : 0), 0);
  BAKE.tris = BAKE.vertices/3;
  BAKE.k = _bakePerfil(ganho, baixo, alto, nu);
}

/* Termina o bake pendente de uma vez. Chamado pelas sondas headless -- sem isto
   elas fotografam a cena assando pela metade e aprovam outra coisa -- e por quem
   nao pode esperar o quadro seguinte. */
function bakeAgora() {
  if (!BAKE.fila) return false;
  bakePasso(BAKE.fila, 1e9);
  BAKE.fila = null;
  return true;
}

/* Suavizacao por VIZINHANCA NO ESPACO, nao por aresta da malha.

   Duas coisas de uma vez:

   - RUIDO. 48 raios deixam ~14% de ruido de Monte Carlo, e num quad de parede
     isso le como MANCHA -- pior que o defeito que o bake veio consertar, porque
     parede manchada parece sujeira, nao iluminacao. Oclusao de ambiente e um
     campo de baixa frequencia por natureza, entao borrar nao perde detalhe. Sai
     mais barato que subir a contagem de raios (4x pra metade do ruido).

   - EMENDA. A parede de um comodo nao e uma peca: `paredesDaGrade` corta ela em
     cada vao, e cada pedaco vira um prisma proprio, com tampa nas pontas. Os
     vertices dos dois lados da emenda NAO coincidem, entao pela malha eles nao
     sao vizinhos -- e a media por aresta deixava um DEGRAU vertical em cada
     emenda. Com pouco contraste ninguem via; ao subir o contraste pra faixa
     dinamica passar no portao, as emendas apareceram como listras na parede.
     Vizinhanca por distancia atravessa a emenda, porque ela nao existe no
     espaco: os dois pedacos sao a mesma parede.

   O filtro de normal (`dot > 0,80`) e o que impede o borrao de atravessar quina:
   duas faces perpendiculares tem que poder ter irradiancia diferente -- e essa
   diferenca E a quina. Duas faces da MESMA parede olham pra lados opostos
   (produto negativo), entao tambem nao se misturam. */
function _bakeSuaviza(pos, nrm, E, nu) {
  const R = BAKE.raio, R2 = R*R;
  let u0 = 1e9, v0 = 1e9, w0 = 1e9;
  for (let k = 0; k < nu; k++) {
    if (pos[k*3]   < u0) u0 = pos[k*3];
    if (pos[k*3+1] < v0) v0 = pos[k*3+1];
    if (pos[k*3+2] < w0) w0 = pos[k*3+2];
  }
  const cel = R;
  const bal = new Map();
  // +1024 em cada eixo porque a varredura 3x3x3 consulta indice -1, e sem o
  // deslocamento (i*4096+j) com j negativo colide com a celula (i-1, 4095).
  const chaveDe = (i, j, l) => ((i+1024)*4096 + (j+1024))*4096 + (l+1024);
  for (let k = 0; k < nu; k++) {
    const c = chaveDe(((pos[k*3]-u0)/cel)|0, ((pos[k*3+1]-v0)/cel)|0, ((pos[k*3+2]-w0)/cel)|0);
    const l = bal.get(c); if (l) l.push(k); else bal.set(c, [k]);
  }
  for (let passo = 0; passo < BAKE.suave; passo++) {
    const F = new Float32Array(nu);
    for (let k = 0; k < nu; k++) {
      const px = pos[k*3], py = pos[k*3+1], pz = pos[k*3+2];
      const nx = nrm[k*3], ny = nrm[k*3+1], nz = nrm[k*3+2];
      const ci = ((px-u0)/cel)|0, cj = ((py-v0)/cel)|0, cl = ((pz-w0)/cel)|0;
      let soma = E[k], peso = 1;
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let c = -1; c <= 1; c++) {
        const l = bal.get(chaveDe(ci+a, cj+b, cl+c));
        if (!l) continue;
        for (let i = 0; i < l.length; i++) {
          const j = l[i]; if (j === k) continue;
          if (nrm[j*3]*nx + nrm[j*3+1]*ny + nrm[j*3+2]*nz < 0.80) continue;
          const dx = pos[j*3]-px, dy = pos[j*3+1]-py, dz = pos[j*3+2]-pz;
          const d2 = dx*dx + dy*dy + dz*dz;
          if (d2 > R2) continue;
          const p = 1 - Math.sqrt(d2)/R;      // triangular: vizinho longe pesa menos
          soma += E[j]*p; peso += p;
        }
      }
      F[k] = soma/peso;
    }
    E = F;
  }
  return E;
}

function _bakePerfil(ganho, baixo, alto, nu) {
  const v = Array.prototype.slice.call(ganho).sort((a, b) => a - b);
  const q = f => +(v[Math.min(v.length-1, Math.floor(f*v.length))] || 0).toFixed(3);
  return { min:q(0), p05:q(0.05), p50:q(0.50), p95:q(0.95), max:q(0.999),
           travadoBaixo:+(baixo/nu*100).toFixed(1), travadoAlto:+(alto/nu*100).toFixed(1) };
}

/* Devolve DOIS numeros por vertice: quanta luz chega, e QUANTO DELA E CEU.

   O segundo e o que faltava pro interior ter jogo de cor. Numa foto de apartamento
   as duas metades do quadro nunca tem a mesma cor de luz: perto da janela o que
   ilumina e ceu, que e frio; no fundo do corredor o que ilumina e o que ja
   ricocheteou no piso e na parede, que e quente. E um degrade de TEMPERATURA ao
   longo da profundidade, e ele carrega mais leitura de "foto" do que qualquer
   ganho de resolucao.

   Nao custa raio a mais: a fracao de ceu ja estava sendo contada dentro da soma, so
   nao estava saindo. */
function bakeVertice(S, px, py, pz, nx, ny, nz) {
  // base ortonormal com Y na normal. O vetor auxiliar troca quando a normal já é
  // Y, senão o produto vetorial degenera, a base sai nula e o vértice fica preto.
  const eixoX = Math.abs(ny) > 0.9 ? 1 : 0, eixoY = Math.abs(ny) > 0.9 ? 0 : 1;
  let tx = eixoY*nz, ty = -eixoX*nz, tz = eixoX*ny - eixoY*nx;
  const tl = Math.hypot(tx, ty, tz) || 1; tx /= tl; ty /= tl; tz /= tl;
  const bx = ny*tz - nz*ty, by = nz*tx - nx*tz, bz = nx*ty - ny*tx;
  const ox = px + nx*0.02, oy = py + ny*0.02, oz = pz + nz*0.02;

  let soma = 0, ceu = 0;
  for (let r = 0; r < BAKE.raios; r++) {
    const a = BAKE_DIR[r*3], b = BAKE_DIR[r*3+1], c = BAKE_DIR[r*3+2];
    const dx = tx*a + nx*b + bx*c, dy = ty*a + ny*b + by*c, dz = tz*a + nz*b + bz*c;
    const d = bakeRaio(S, ox, oy, oz, dx, dy, dz);
    if (d < 0) { soma += 1; ceu++; }
    else soma += BAKE.bounce * Math.min(1, d/BAKE.perto);
  }
  _bakeCeu = ceu / BAKE.raios;
  return soma / BAKE.raios;
}
// Saida secundaria do ultimo `bakeVertice`. Variavel de modulo em vez de par
// devolvido: sao ~30 mil chamadas por unidade e alocar um array em cada uma so pra
// carregar um float e desperdicio que aparece no orcamento de quadro.
let _bakeCeu = 0;

    return {BAKE, cenaDoBake, bakeRaio, tesselaSopa, bakePrepara, bakePasso, bakeFecha, bakeAgora, bakeVertice};
  }
  root.LightBake = Object.freeze({create});
})(globalThis);

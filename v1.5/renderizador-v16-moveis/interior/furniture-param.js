/* Parametric furniture: part lists per measure and one merged geometry per piece. */
(function(root) {
  "use strict";
  function create({THREE, getLib, rgbDe}) {
/* ============================================================
   MÓVEL PARAMÉTRICO: o que cresce é o NÚMERO DE MÓDULOS
   ============================================================
   `atualizaMovel` muda a medida de um móvel ESCALANDO a malha. Para quase tudo isso
   basta, mas para as peças MODULARES é o defeito que o usuário apontou olhando um
   sofá de 3,20 m: ele continuava com DOIS assentos, cada um de 1,40 m, com o braço
   esticado junto e o pé virando um tronco. Um sofá maior não tem assento maior --
   tem MAIS assento. Um armário de 2,60 não tem porta de 87 cm -- tem mais uma porta.

   Então a peça paramétrica não tem `malha:` fixa: tem `param(m)`, que devolve a LISTA
   DE PARTES para a medida atual, e `geoDeParts` funde tudo numa geometria só -- uma
   chamada de desenho, como todo o resto do catálogo. Uma parte é uma de duas coisas:

     - uma CAIXA chanfrada (`B(...)`) -- marcenaria retilínea, que não precisa do
       Blender: armário, gaveteiro, rodapé;
     - uma INSTÂNCIA de malha da biblioteca (`{malha:"sofa_mod", x, sx, ...}`) --
       estofado, que precisa de aresta macia e vem do Blender modelado POR MÓDULO.

   A folga que sobra depois de escolher o número de módulos vai só para o que pode
   respirar (a largura do assento, o pano da porta), nunca para o braço, o pé ou o
   puxador -- que são justamente as partes cujo tamanho o olho conhece de cor. */
const B = (x, y, z, w, h, d, c) => ({ x, y, z, w, h, d, c: c === undefined ? null : c });
/* Caixa CHANFRADA, não caixa. Aresta viva não existe em móvel de verdade e, pior, não
   pega luz: duas faces perpendiculares dão dois tons chapados e o objeto lê como bloco.
   Um chanfro de 1,5 cm cria uma terceira face fina, de brilho intermediário, que é o
   que o olho usa pra ler volume. Custa 44 triângulos em vez de 12 -- e triângulo não é
   a moeda cara aqui, chamada de desenho é, e continua uma por móvel. */
function caixaEm(P, N, C, p, rgb, chanfro) {
  const x0=p.x-p.w/2, x1=p.x+p.w/2, y0=p.y, y1=p.y+p.h, z0=p.z-p.d/2, z1=p.z+p.d/2;
  const ch = Math.min(chanfro === undefined ? 0.015 : chanfro,
                      p.w/2.6, p.h/2.6, p.d/2.6);
  const X=[x0,x1], Y=[y0,y1], Z=[z0,z1];
  const iX=[x0+ch,x1-ch], iY=[y0+ch,y1-ch], iZ=[z0+ch,z1-ch];
  const cx=(x0+x1)/2, cy=(y0+y1)/2, cz=(z0+z1)/2;
  const tri = (a, b, c) => {
    let nx=(b[1]-a[1])*(c[2]-a[2])-(b[2]-a[2])*(c[1]-a[1]);
    let ny=(b[2]-a[2])*(c[0]-a[0])-(b[0]-a[0])*(c[2]-a[2]);
    let nz=(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
    const L=Math.hypot(nx,ny,nz)||1; nx/=L; ny/=L; nz/=L;
    const gx=(a[0]+b[0]+c[0])/3-cx, gy=(a[1]+b[1]+c[1])/3-cy, gz=(a[2]+b[2]+c[2])/3-cz;
    /* VIRAR A NORMAL SEM VIRAR A ORDEM DOS VERTICES NAO VIRA A FACE.

       Os seis quads saem do mesmo laco com a mesma sequencia de cantos, entao metade
       deles nasce com a volta ao contrario -- e a correcao abaixo so consertava o
       ATRIBUTO de normal. O three nao descarta face pela normal: descarta pela ORDEM
       dos vertices. Com os dois discordando, a luz acertava (usa o atributo) e o
       culling cortava (usa a volta): tres das seis faces de cada caixa sumiam vistas
       de fora. Na primeira pessoa nao se notava, porque a que falta e quase sempre a
       de cima; na planta 3D, que se olha justamente de cima, todo armario aparecia
       aberto com o miolo a mostra.

       `[a,c,b]` troca a volta junto com a normal. Nao ha custo: e a mesma contagem de
       vertices, escrita noutra ordem. */
    let v3 = [a,b,c];
    if (nx*gx+ny*gy+nz*gz < 0) { nx=-nx; ny=-ny; nz=-nz; v3 = [a,c,b]; }
    for (const v of v3) { P.push(v[0],v[1],v[2]); N.push(nx,ny,nz); C.push(rgb[0],rgb[1],rgb[2]); }
  };
  const quad = (a,b,c,d) => { tri(a,b,c); tri(a,c,d); };
  // seis faces, cada uma recuada do chanfro nos dois eixos que não são o dela
  for (let s2 = 0; s2 < 2; s2++) {
    quad([X[s2],iY[0],iZ[0]],[X[s2],iY[1],iZ[0]],[X[s2],iY[1],iZ[1]],[X[s2],iY[0],iZ[1]]);
    quad([iX[0],Y[s2],iZ[0]],[iX[1],Y[s2],iZ[0]],[iX[1],Y[s2],iZ[1]],[iX[0],Y[s2],iZ[1]]);
    quad([iX[0],iY[0],Z[s2]],[iX[1],iY[0],Z[s2]],[iX[1],iY[1],Z[s2]],[iX[0],iY[1],Z[s2]]);
  }
  // doze arestas
  for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) {
    quad([X[a],iY[b],iZ[0]],[X[a],iY[b],iZ[1]],[iX[a],Y[b],iZ[1]],[iX[a],Y[b],iZ[0]]);   // ao longo de Z
    quad([X[a],iY[0],iZ[b]],[X[a],iY[1],iZ[b]],[iX[a],iY[1],Z[b]],[iX[a],iY[0],Z[b]]);   // ao longo de Y
    quad([iX[0],Y[a],iZ[b]],[iX[1],Y[a],iZ[b]],[iX[1],iY[a],Z[b]],[iX[0],iY[a],Z[b]]);   // ao longo de X
  }
  // oito cantos
  for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) for (let c = 0; c < 2; c++)
    tri([X[a],iY[b],iZ[c]], [iX[a],Y[b],iZ[c]], [iX[a],iY[b],Z[c]]);
}
/* Uma instância de malha da biblioteca, DESINDEXADA e transformada, no mesmo par de
   vetores das caixas. Desindexar é o preço de misturar as duas fontes numa geometria
   só -- e é o preço certo, porque o que se está comprando é a chamada de desenho
   única. A normal leva a escala INVERSA: com `sx` != `sz` a normal escalada junto
   deixa de ser perpendicular e o estofado ganha faixa de brilho torta. */
function instanciaLib(P, N, C, p, rgbM) {
  const d = getLib()[p.malha];
  if (!d) return;
  const sx = p.sx === undefined ? 1 : p.sx, sy = p.sy === undefined ? 1 : p.sy,
        sz = p.sz === undefined ? 1 : p.sz;
  const px = p.x || 0, py = p.y || 0, pz = p.z || 0;
  const fixa = p.c === undefined || p.c === null ? null : rgbDe(p.c);
  for (let t = 0; t < d.idx.length; t++) {
    const i = d.idx[t] * 3;
    P.push(px + d.pos_cm[i] / 100 * sx, py + d.pos_cm[i+1] / 100 * sy,
           pz + d.pos_cm[i+2] / 100 * sz);
    let nx = d.nrm_127[i] / 127 / sx, ny = d.nrm_127[i+1] / 127 / sy,
        nz = d.nrm_127[i+2] / 127 / sz;
    const L = Math.hypot(nx, ny, nz) || 1;
    N.push(nx / L, ny / L, nz / L);
    if (d.herda[d.idx[t]]) C.push(rgbM[0], rgbM[1], rgbM[2]);
    else if (fixa) C.push(fixa[0], fixa[1], fixa[2]);
    else C.push(d.col[i], d.col[i+1], d.col[i+2]);
  }
}
function geoDeParts(parts, corHex) {
  const P = [], N = [], C = [], rgbM = rgbDe(corHex);
  for (const p of parts) {
    if (p.malha) instanciaLib(P, N, C, p, rgbM);
    else caixaEm(P, N, C, p, p.c === null ? rgbM : rgbDe(p.c), p.ch);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(P), 3));
  g.setAttribute("normal",   new THREE.BufferAttribute(new Float32Array(N), 3));
  g.setAttribute("color",    new THREE.BufferAttribute(new Uint8Array(C), 3, true));
  g.computeBoundingSphere();
  return g;
}

/* ---- armário e guarda-roupa -------------------------------------------
   Marcenaria retilínea não precisa do Blender: é caixa chanfrada, e a caixa aqui
   nasce já na medida certa em vez de nascer numa medida e ser esticada. Três regras,
   e são elas que separam isto de um bloco com riscos:

     1. a largura vira N COLUNAS de ~50 cm (nunca uma porta de 87);
     2. de três colunas em diante a última vira GAVETEIRO -- é o que o marceneiro faz
        quando sobra pano de armário, e é o que o pedido descreveu ("crescer 20 cm e
        ganhar uma coluna de gavetas");
     3. acima de 2,30 m nasce MALEIRO, porque porta inteira de 2,50 não existe (não
        cabe no caminhão nem na fábrica) e lê como parede pintada de outra cor.

   O puxador é a CANALETA escura ATRÁS da fresta -- nunca dentro do painel, que é onde
   ela fica invisível (ver a nota da geladeira em `moveis/moveis.py`). */
const ARM_PRETO = 0x1E2126, ARM_GRAFITE = 0x2B3038;
function armarioParam(m) {
  const w = Math.max(0.40, m.w), h = Math.max(0.60, m.h), d = Math.max(0.28, m.d);
  const P = [];
  const ESP = 0.019;                       // espessura da folha
  const RB  = Math.min(0.08, h * 0.06);    // rodapé recuado
  const F   = 0.005;                       // fresta entre folhas
  const zP  = d / 2 - ESP / 2;             // plano da frente das portas
  const zC  = zP - 0.016;                  // canaleta: ATRÁS da folha, aparece na fresta
  // casco fechado + rodapé recuado: por fora um armário é isso, e sai em duas caixas
  P.push(B(0, 0, -0.02, w - 0.05, RB, d - ESP - 0.05, ARM_GRAFITE));
  // O casco recua 6 mm alem da folha. Encostado, a face dele fica COPLANAR com a
  // face de tras da porta e o resultado e z-fighting: manchas brancas piscando no
  // meio do pano da porta, que de longe leem como reflexo e nao como defeito.
  P.push(B(0, RB, -ESP / 2 - 0.003, w, h - RB, d - ESP - 0.006));

  const n  = Math.max(1, Math.min(6, Math.round(w / 0.50)));   // colunas
  const mw = w / n;
  const gav = n >= 3 ? n - 1 : -1;         // gaveteiro na última coluna
  const temMal = h >= 2.30;                // maleiro
  const yMal = temMal ? h - 0.42 : h;
  const cava = n === 1 ? 0.035 : 0;        // porta única não tem divisa: puxador na borda

  for (let i = 0; i < n; i++) {
    const cx = -w / 2 + mw * (i + 0.5);
    const ult = i === n - 1;
    const lw = mw - 2 * F - (ult ? cava : 0);
    const lx = cx - (ult ? cava / 2 : 0);
    if (i === gav) {
      // Gaveteiro SÓ NA PARTE DE BAIXO: coluna de gaveta do chão ao teto não existe em
      // armário de quarto. Acima de ~1 m o vão é de CABIDE, e o que se vê ali é porta.
      // Cada gaveta tem 3,5 cm de rebaixo no alto -- é esse rebaixo que é o puxador,
      // e ele precisa de VÃO pra existir.
      const hg = Math.min(1.00, (yMal - RB) * 0.45);
      const ng = Math.max(3, Math.min(5, Math.round(hg / 0.24)));
      const gh = (hg - F) / ng;
      for (let k = 0; k < ng; k++) {
        const y0 = RB + F + gh * k;
        P.push(B(lx, y0, zP, lw, gh - 0.035 - F, ESP));
        P.push(B(lx, y0 + gh - 0.035, zC, lw - 0.04, 0.030, 0.03, ARM_PRETO));
      }
      P.push(B(lx, RB + hg + F, zP, lw, yMal - RB - hg - 2 * F, ESP));   // cabideiro
    } else {
      P.push(B(lx, RB + F, zP, lw, yMal - RB - 2 * F, ESP));
    }
    if (temMal) P.push(B(lx, yMal + F, zP, lw, h - yMal - 2 * F, ESP));
    if (ult && cava) P.push(B(w / 2 - cava / 2 - 0.004, RB + F, zC, cava - 0.008,
                              yMal - RB - 2 * F, 0.03, ARM_PRETO));
  }
  // canaleta vertical em cada divisa de coluna: o puxador de quem tem duas portas
  for (let i = 1; i < n; i++)
    P.push(B(-w / 2 + mw * i, RB + F, zC, 0.028, yMal - RB - 2 * F, 0.03, ARM_PRETO));
  // e a horizontal do maleiro, pelo mesmo motivo
  if (temMal) P.push(B(0, yMal - 0.006, zC, w - 0.02, 0.012, 0.03, ARM_PRETO));
  return P;
}

/* ---- a família da cozinha: bancada, balcão e aéreo --------------------
   Foram as três peças que mais esticavam: o `mobiliar.py` manda a bancada com
   `min(1,30, o que sobrou da parede)` e o balcão com `min(1,00, resto)`, então um
   balcão de 0,60 era a malha de 1,00 espremida a 60% -- com a cuba, a torneira e o
   perfil do puxador espremidos junto. Aqui a largura escolhe o número de MÓDULOS e
   a cuba nunca muda de tamanho.

   Duas peças chegam prontas do Blender por instância, porque não são retilíneas:
   `cuba` (o furo, cinco chapas descendo do tampo) e `torneira` (gooseneck de arco).
   A torneira existia como pendência anotada em `moveis/moveis.py`: dentro da malha
   da `pia` ela empurrava a caixa envolvente medida pra 1,16 e `atualizaMovel`
   esmagava a bancada inteira em 79%. Peça paramétrica não escala, então o problema
   simplesmente deixou de existir. */
const ARM_MADEIRA = 0xA9793F, ARM_PEDRA = 0x23262A, ARM_VIDRO = 0x5A6572;
/* Perfil de puxador: a barra CLARA saliente 1 cm, com a sombra da canaleta atrás.
   A canaleta escura sozinha (o que havia antes) é correta de perto e invisível a
   dois metros -- e é a dois metros que se olha uma cozinha. */
function perfil(P, x0, x1, y, z, alt) {
  P.push(B((x0 + x1) / 2, y, z + 0.006, x1 - x0, alt || 0.024, 0.014, ARM_MADEIRA));
  P.push(B((x0 + x1) / 2, y + 0.002, z - 0.012, x1 - x0 - 0.02, (alt || 0.024) - 0.004,
           0.030, ARM_PRETO));
}
/* Frente de módulo: porta ou gaveta, sempre lisa, sempre com fresta em volta. */
function frente(P, x0, x1, y0, y1, zP, ESP, F) {
  P.push(B((x0 + x1) / 2, y0 + F, zP, x1 - x0 - 2 * F, y1 - y0 - 2 * F, ESP));
}

function bancadaParam(m) {
  const w = Math.max(0.45, m.w), d = Math.max(0.32, m.d);
  const P = [], F = 0.005, ESP = 0.019;
  const banho = m.tipo === "pia" && d <= 0.52;   // gabinete de banheiro
  const HT = 0.86;                               // face de baixo do tampo
  const TZ = banho ? 0.030 : 0.040;              // espessura da pedra
  const zP = d / 2 - ESP / 2;
  const RB = banho ? 0 : 0.10;                   // banheiro é SUSPENSO (as referências
  const Z0 = banho ? 0.52 : RB;                  // todas são), cozinha tem rodapé
  if (!banho) P.push(B(0, 0, -0.03, w - 0.05, RB, d - 0.06 - ESP, ARM_GRAFITE));
  // Carcaça OCA, e não caixa cheia. A cuba desce 17 cm abaixo do tampo: dentro de um
  // volume maciço o que se enxerga pela boca dela é a face INTERNA do armário (com a
  // cor do armário, verde-oliva na foto), não o inox -- e o defeito lê como "a cuba é
  // rasa", não como "a cuba está enterrada". Quatro chapas: duas laterais, fundo e base.
  const zc = -ESP / 2 - 0.003, dc = d - ESP - 0.006;
  for (const s of [-1, 1])
    P.push(B(s * (w / 2 - 0.009), Z0, zc, 0.018, HT - Z0, dc));
  P.push(B(0, Z0, zc - dc / 2 + 0.009, w, HT - Z0, 0.018));
  P.push(B(0, Z0, zc, w, 0.018, dc));
  // módulos: no banheiro duas gavetas; na cozinha o primeiro módulo é gaveteiro
  const n = Math.max(1, Math.min(4, Math.round(w / 0.52)));
  const mw = w / n;
  for (let i = 0; i < n; i++) {
    const x0 = -w / 2 + mw * i, x1 = x0 + mw;
    const gaveteiro = banho || (i === 0 && n >= 2);
    if (gaveteiro) {
      const ng = banho ? 2 : 3, gh = (HT - Z0 - 0.02) / ng;
      for (let k = 0; k < ng; k++) {
        const y0 = Z0 + 0.01 + gh * k;
        frente(P, x0, x1, y0, y0 + gh, zP, ESP, F);
        perfil(P, x0 + 0.02, x1 - 0.02, y0 + gh - 0.034, zP + ESP / 2, 0.024);
      }
    } else {
      frente(P, x0, x1, Z0 + 0.01, HT - 0.03, zP, ESP, F);
      perfil(P, x0 + 0.02, x1 - 0.02, HT - 0.058, zP + ESP / 2, 0.024);
    }
  }
  // tampo: no banheiro é inteiro (a cuba é de apoio); na cozinha sai em quatro tiras
  // em volta do vão, porque cuba de embutir é um FURO -- a versão antiga era um
  // bloco claro EM CIMA do tampo, e é a diferença entre "tem cuba" e "tem retângulo".
  const TX = w, TY = d + 0.02, tz = HT;
  if (m.tipo !== "pia" || banho) {
    P.push(B(0, tz, 0.01, TX, TZ, TY, ARM_PEDRA));
  } else {
    const cx = n >= 2 ? -w / 2 + mw * (n - 0.5) : 0;   // cuba no ÚLTIMO módulo
    const vx = 0.46, vy = 0.40, cz = 0.02;
    const x0 = -TX / 2, x1 = TX / 2, z0 = -TY / 2 + 0.01, z1 = TY / 2 + 0.01;
    const fx0 = cx - vx / 2, fx1 = cx + vx / 2, fz0 = cz - vy / 2, fz1 = cz + vy / 2;
    for (const q of [[x0, fx0, z0, z1], [fx1, x1, z0, z1],
                     [fx0, fx1, fz1, z1], [fx0, fx1, z0, fz0]])
      P.push(B((q[0] + q[1]) / 2, tz, (q[2] + q[3]) / 2, q[1] - q[0], TZ, q[3] - q[2],
               ARM_PEDRA));
    P.push({ malha:"cuba", x:cx, y:tz + TZ, z:cz });
    P.push({ malha:"torneira", x:cx, y:tz + TZ, z:cz - vy / 2 - 0.07 });
  }
  if (banho) {
    P.push({ malha:"cuba_apoio", x:0, y:tz + TZ, z:0.02 });
    P.push({ malha:"torneira", x:0, y:tz + TZ, z:-d / 2 + 0.07 });
    // espelho: em TODA foto de banheiro há um, e ele é duas caixas. Fica 1 cm à
    // frente do fundo do gabinete, que é o plano da parede -- encostado nela.
    P.push(B(0, 1.05, -d / 2 + 0.012, Math.min(w, 0.90), 0.85, 0.016, ARM_VIDRO));
    P.push(B(0, 1.03, -d / 2 + 0.008, Math.min(w, 0.90) + 0.04, 0.89, 0.010, ARM_MADEIRA));
  }
  return P;
}

function aereoParam(m) {
  const w = Math.max(0.35, m.w), h = Math.max(1.60, m.h), d = Math.max(0.22, m.d);
  const P = [], F = 0.005, ESP = 0.019;
  const Z0 = h - 0.70, zP = d / 2 - ESP / 2;
  // nicho aberto só quando há largura pra ele: numa fileira de portas iguais o olho
  // lê UM PANO SÓ, e nenhuma cozinha de referência é assim -- todas quebram a
  // fileira com um vão de madeira. Abaixo de 95 cm não cabe sem virar fresta.
  const nicho = w >= 0.95 ? 0.34 : 0;
  const wP = w - nicho;
  const n = Math.max(1, Math.min(3, Math.round(wP / 0.50)));
  const mw = wP / n;
  P.push(B(-w / 2 + wP / 2, Z0, -ESP / 2 - 0.003, wP, h - Z0, d - ESP - 0.006));
  for (let i = 0; i < n; i++) {
    const x0 = -w / 2 + mw * i;
    frente(P, x0, x0 + mw, Z0 + 0.035, h - 0.012, zP, ESP, F);
  }
  perfil(P, -w / 2 + 0.02, -w / 2 + wP - 0.02, Z0 + 0.010, zP + ESP / 2, 0.026);
  if (nicho) {
    const xc = w / 2 - nicho / 2;
    P.push(B(xc, Z0, -d / 2 + 0.010, nicho, h - Z0, 0.020, ARM_MADEIRA));
    for (const z of [Z0, h - 0.020])
      P.push(B(xc, z, 0, nicho, 0.020, d, null));
    P.push(B(w / 2 - 0.010, Z0, 0, 0.020, h - Z0, d, null));
    P.push(B(xc, Z0 + (h - Z0) / 2, 0.005, nicho - 0.02, 0.022, d - 0.03, ARM_MADEIRA));
  }
  // tira escura entre o corpo e a parede: sem ela o aéreo parece colado com fita
  P.push(B(0, Z0 - 0.012, -d / 2 + 0.005, w - 0.02, 0.012, 0.010, ARM_PRETO));
  return P;
}

/* ---- a parede da TV: ripado, rack e a TV pendurada ---------------------
   Em NENHUMA das salas de referência a televisão está num pedestal no meio do
   chão -- ela está pendurada, sobre um painel ripado, com um rack suspenso embaixo.
   Eram três peças faltando, e as três são paramétricas pelo mesmo motivo: a largura
   delas é o que sobra da parede, e é diferente em cada apartamento.

   O ripado é o melhor negócio do catálogo inteiro: 34 ripas de 4,5 cm com 3 cm de
   saliência custam 1.500 triângulos (barato) numa chamada de desenho (a moeda cara),
   e transformam a parede vazia atrás do sofá no elemento que essas salas têm de mais
   reconhecível. O que faz a ripa aparecer é a SOMBRA entre elas: o painel de trás é
   escuro fixo, não da cor do móvel -- ripa clara sobre fundo claro não tem vinco. */
function ripadoParam(m) {
  const w = Math.max(0.40, m.w), h = Math.max(0.60, m.h);
  const P = [], PASSO = 0.075, RIPA = 0.046;
  P.push(B(0, 0, -0.012, w, h, 0.020, 0x2A2622));
  const n = Math.max(1, Math.floor(w / PASSO));
  const sobra = (w - n * PASSO) / 2;
  for (let i = 0; i < n; i++)
    P.push(B(-w / 2 + sobra + PASSO * (i + 0.5), 0.012, 0.013, RIPA, h - 0.024, 0.030));
  return P;
}

/* Rack SUSPENSO: nas referências ele nunca toca o chão -- é a sombra embaixo que faz
   o volume flutuar e a sala parecer maior. Por isso a geometria começa em 28 cm e o
   `mobiliar.py` manda `h` = 0,70 (o topo), não a altura do corpo. */
function rackParam(m) {
  const w = Math.max(0.60, m.w), d = Math.max(0.28, m.d), h = Math.max(0.55, m.h);
  const P = [], F = 0.005, ESP = 0.019;
  const Z0 = h - 0.38, zP = d / 2 - ESP / 2;
  const zc = -ESP / 2 - 0.003, dc = d - ESP - 0.006;
  for (const s of [-1, 1]) P.push(B(s * (w / 2 - 0.009), Z0, zc, 0.018, h - Z0, dc));
  P.push(B(0, Z0, zc - dc / 2 + 0.009, w, h - Z0, 0.018, 0x2A2622));
  for (const y of [Z0, h - 0.018]) P.push(B(0, y, zc, w, 0.018, dc));
  // dois módulos de gaveta nas pontas e um NICHO aberto no meio: é o desenho de
  // todos os racks das fotos, e o nicho é o que impede o volume de ler como caixote.
  const mw = w / 3;
  for (const s of [-1, 1]) {
    const cx = s * (w / 2 - mw / 2);
    P.push(B(cx, Z0 + 0.018 + F, zP, mw - 2 * F, h - Z0 - 0.036 - 2 * F, ESP));
    perfil(P, cx - mw / 2 + 0.03, cx + mw / 2 - 0.03, h - 0.062, zP + ESP / 2, 0.022);
  }
  P.push(B(0, Z0 + 0.10, zc, 0.018, h - Z0 - 0.13, dc));   // divisória do nicho
  return P;
}

/* TV: pendurada quando o `mobiliar.py` manda `h` alto, com pedestal quando não.
   Painel de 2,2 cm -- a espessura toda mora numa bossa nas costas, que é onde ficam
   a placa e as entradas. A tela não é preta: preto puro lê como BURACO na parede. */
function tvParam(m) {
  const w = Math.max(0.60, m.w), h = Math.max(0.50, m.h);
  const P = [], ALT = Math.min(0.62, w * 0.56);
  const pe = h < 1.20;
  const y0 = pe ? 0.155 : h - ALT;
  if (pe) {
    P.push(B(0, 0, 0, 0.38, 0.024, 0.24, ARM_GRAFITE));
    P.push(B(0, 0.024, -0.01, 0.07, 0.131, 0.05, ARM_GRAFITE));
  }
  P.push(B(0, y0, 0, w, ALT, 0.022));
  P.push(B(0, y0 + ALT * 0.12, -0.032, w * 0.55, ALT * 0.5, 0.042));
  P.push(B(0, y0 + 0.013, 0.0085, w - 0.018, ALT - 0.026, 0.006, 0x27333F));
  return P;
}

/* ---- sofá --------------------------------------------------------------
   Estofado não vira caixa: o que faz o olho ler sofá é aresta macia, e isso vem do
   Blender. O que muda aqui é a UNIDADE modelada -- não o sofá inteiro, mas UM LUGAR
   (`sofa_mod`) e UM BRAÇO com seus dois pés (`sofa_braco`). A largura escolhe quantos
   lugares cabem; a sobra respira só na largura do assento, entre ~0,62 e ~0,95, que é
   a faixa em que um lugar continua sendo um lugar.

   O braço e o pé NUNCA escalam em X. Era exatamente esse o sofá da foto: 3,20 m de
   largura, dois assentos de 1,40 e um braço de 31 cm. */
/* ---- box e maquina de lavar: as duas pecas que a norma pede e faltavam -----
   O Anexo G da NBR 15575-1 lista box como um dos TRES itens minimos do banheiro
   (com lavatorio e vaso) e tanque + maquina como o minimo da area de servico.
   Faltavam as duas, e a falta do box e a mais visivel do catalogo inteiro: e a
   peca que ocupa o canto, e um banheiro sem ela le como obra parada.

   Ambas sao caixa chanfrada -- nao precisam do Blender e continuam UMA chamada
   de desenho, como todo o resto. */
const ARM_ALUM = 0xB9C0C6;
/* O vidro do box NAO e ARM_VIDRO. O cinza-ardosia do vidro do forno funciona num
   retangulo de 30 cm dentro de um movel escuro; num pano de 2 m ele vira PAREDE
   CINZA -- foi o que o primeiro print mostrou, um bloco chapado ocupando o canto
   do banheiro. Sendo geometria opaca (cor por vertice, uma chamada de desenho), o
   que resta pra dizer "vidro" e o TOM: claro, frio e quase sem croma, que e como
   um box aparece em foto -- ele mostra o azulejo atras, nao a propria cor. */
const BOX_VIDRO = 0xB8C4C6;

/* Box: base, tres panos de vidro e a ferragem. As duas folhas da FRENTE tem uma
   fresta entre elas -- e a fresta que faz o olho ler "porta de correr" em vez de
   aquario. O lado aberto do box depende de qual canto ele ocupa, e isso o
   `mobiliar.py` nao tem como saber: por isso ele e fechado nos tres lados e a
   abertura mora na fresta, que funciona em qualquer canto.

   O vidro nao e transparente. O interior inteiro e uma malha opaca com cor por
   vertice (uma chamada de desenho), entao vidro aqui e COR -- ARM_VIDRO, o mesmo
   cinza-azulado do vidro do forno. De dois metros, que e a distancia de onde se
   olha um banheiro, o que denuncia vidro e o tom frio e o caixilho, nao a
   transparencia. */
function boxParam(m) {
  const w = Math.max(0.60, m.w), d = Math.max(0.60, m.d), h = Math.max(1.60, m.h);
  const P = [], V = 0.012, F = 0.048;
  P.push(B(0, 0, 0, w, 0.055, d, 0xE8E9EA));            // base/ralo
  const y0 = 0.055, hv = h - y0 - 0.035;
  for (const s of [-1, 1])
    P.push(B(s * (w / 2 - V / 2), y0, 0, V, hv, d - V, BOX_VIDRO));
  const fw = (w - 2 * V - F) / 2;
  for (const s of [-1, 1])
    P.push(B(s * (F / 2 + fw / 2), y0, d / 2 - V / 2, fw, hv, V, BOX_VIDRO));
  P.push(B(0, y0, d / 2 - V / 2, w, 0.030, V + 0.008, ARM_ALUM));
  P.push(B(0, h - 0.035, 0, w, 0.035, d, ARM_ALUM));
  for (const s of [-1, 1])
    P.push(B(s * (F / 2 + fw - 0.010), y0, d / 2 - V / 2 - 0.006, 0.020, hv, 0.026,
             ARM_ALUM));
  P.push(B(0, h - 0.30, -d / 2 + 0.10, 0.030, 0.030, 0.20, ARM_ALUM));
  P.push(B(0, h - 0.34, -d / 2 + 0.20, 0.19, 0.045, 0.19, ARM_ALUM));
  return P;
}

/* Maquina de lavar: corpo, painel e a escotilha. A escotilha e um quadrado bem
   chanfrado, nao um circulo -- `caixaEm` limita o chanfro a lado/2,6, entao um
   quadrado de 45 cm com chanfro maximo ja le como disco a dois metros, e um
   circulo de verdade custaria malha nova pra ganhar nada. */
function maquinaParam(m) {
  const w = Math.max(0.45, m.w), d = Math.max(0.45, m.d), h = Math.max(0.70, m.h);
  const P = [], zP = d / 2;
  P.push(B(0, 0.02, 0, w, h - 0.02, d));
  P.push(B(0, 0, 0, w - 0.06, 0.02, d - 0.06, ARM_GRAFITE));
  P.push(B(0, h - 0.13, zP - 0.006, w - 0.05, 0.095, 0.014, ARM_GRAFITE));
  P.push(B(w / 2 - 0.10, h - 0.105, zP + 0.004, 0.045, 0.045, 0.016, ARM_ALUM));
  const esc = Math.min(w, h) * 0.52;
  P.push(B(0, (h - 0.16) / 2 - esc / 2, zP - 0.004, esc, esc, 0.022, 0xD7DBDF));
  P.push(B(0, (h - 0.16) / 2 - esc / 2 + 0.035, zP + 0.006, esc - 0.07, esc - 0.07,
           0.014, 0x2B3038));
  return P;
}

function sofaParam(m) {
  const L = getLib();
  if (!L.sofa_mod || !L.sofa_braco) return [];
  const bw = L.sofa_braco.b[0], mw0 = L.sofa_mod.b[0];
  const h0 = L.sofa_mod.b[1], d0 = L.sofa_mod.b[2];
  const w = Math.max(2 * bw + 0.62, m.w);
  const sy = m.h / h0, sz = m.d / d0;
  const util = w - 2 * bw;
  const n = Math.max(1, Math.min(5, Math.round(util / 0.785)));
  const mw = util / n;
  const P = [];
  for (let i = 0; i < n; i++)
    P.push({ malha:"sofa_mod", x: -w/2 + bw + mw * (i + 0.5), sx: mw / mw0, sy, sz });
  for (const s of [-1, 1])
    P.push({ malha:"sofa_braco", x: s * (w/2 - bw/2), sx: s, sy, sz });
  return P;
}

    return {geoDeParts, armarioParam, bancadaParam, aereoParam, ripadoParam, rackParam, tvParam, boxParam, maquinaParam, sofaParam};
  }
  root.FurnitureParam = Object.freeze({create});
})(globalThis);

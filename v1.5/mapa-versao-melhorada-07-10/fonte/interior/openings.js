/* Door and window joinery: frames, open leaves, handles, sills and sliding panes in three meshes. */
(function(root) {
  "use strict";
  function create({THREE, ESP, rgbDe, matEsq, matAlum, matVidro}) {
/* ---- esquadria: batente, folha e caixilho -----------------------------
   Até aqui porta e janela eram AUSÊNCIA: `paredesDaGrade` abria o buraco e nada mais
   entrava nele. Um cômodo cheio de retângulos vazios não lê como casa -- e a porta, que
   é a peça que mais diz "isto é habitação", era justamente a que não existia.

   Três decisões, pelo mesmo critério do resto deste arquivo:

   - TODA a esquadria da unidade sai em TRÊS malhas: pintado, alumínio e vidro. Um
     apartamento de 11 portas e 7 janelas teria 18 chamadas de desenho se cada peça
     fosse um objeto -- mais que a casa inteira custa hoje. Cor por vértice resolve:
     porta branca e porta de madeira convivem na mesma malha.

   - A FOLHA NASCE ABERTA, e não por preguiça de animar: fechada, ela veda o cômodo
     vizinho e a visita de primeira pessoa vira um quarto sem saída. Aberta a 78° a
     folha encosta na parede lateral, deixa o vão livre e ainda mostra pra que lado ela
     abre -- que é a informação que a planta de arquitetura passa com o arco.

   - O peitoril e o caixilho são o que dá ESCALA à janela. Buraco liso na parede não
     tem tamanho; um peitoril de 3 cm com montante no meio tem. */
const ESQ_ANG   = 78 * Math.PI/180;  // quanto a folha abre
const ESQ_FOLHA = 0.035;             // espessura da folha de porta
const ESQ_MARCO = 0.030;             // seção do batente que avança pra dentro do vão
const ESQ_GUARN = 0.055;             // largura da guarnição (o alizar, na face da parede)
const ESQ_PERF  = 0.050;             // largura do perfil de alumínio da esquadria
/* O ALUMINIO ESCURECEU, de 0x8E959C pra 0x4B5158, e nao e gosto.
   Toda janela e toda porta de correr tem perfil de aluminio, entao esse tom e a
   unica coisa da cena que aparece em TODO comodo. Em cinza medio ele desaparecia
   na parede clara; escuro, ele vira o desenho da esquadria -- a linha preta em
   volta do vidro que, numa foto de apartamento, e o que da recorte pra janela. E e
   a maior fonte de PRETO num interior vazio, que era o que faltava na paleta. */
const ESQ_COR = { esquadria:0xF2EFE9, porta:0xEDE7DD, aluminio:0x4B5158,
                  peitoril:0xD9D5CE, vidro:0xBFD4E2 };

/* Caixa orientada no plano XZ. `(dx,dz)` unitário é a direção do COMPRIMENTO; a
   espessura corre na perpendicular. Seis quads, normal explícita por face -- esquadria
   é chapa fina, onde o chanfro da caixa de móvel (44 triângulos) não apareceria, e o
   material é DoubleSide, então nem a orientação da face importa. */
function pecaOr(dst, cx, cz, dx, dz, comp, esp, y0, y1, rgb) {
  const px = -dz, pz = dx, hc = comp/2, he = esp/2;
  const v = (s, t, y) => [cx + dx*hc*s + px*he*t, y, cz + dz*hc*s + pz*he*t];
  const quad = (a, b, c, d, nx, ny, nz) => {
    for (const p of [a, b, c, a, c, d]) {
      dst[0].push(p[0], p[1], p[2]); dst[1].push(nx, ny, nz);
      dst[2].push(rgb[0], rgb[1], rgb[2]); dst[3].push(p[0], p[2]);
    }
  };
  const A = v(-1,-1,y0),  B = v(1,-1,y0),  C = v(1,1,y0),  D = v(-1,1,y0);
  const A2 = v(-1,-1,y1), B2 = v(1,-1,y1), C2 = v(1,1,y1), D2 = v(-1,1,y1);
  quad(A, B, B2, A2, -px, 0, -pz);
  quad(C, D, D2, C2,  px, 0,  pz);
  quad(B, C, C2, B2,  dx, 0,  dz);
  quad(D, A, A2, D2, -dx, 0, -dz);
  quad(A2, B2, C2, D2, 0,  1, 0);
  quad(D, C, B, A,     0, -1, 0);
}

/* Uma folha de correr (de porta ou de janela): moldura de alumínio nas quatro bordas e
   uma chapa de vidro no meio. `cx,cz` é o CENTRO da folha e `off` a desloca na
   perpendicular, pra que duas folhas se cruzem sem z-fighting -- que é exatamente o
   que a de correr faz de verdade, uma correndo na frente da outra. */
function folhaVidro(dAl, dVi, cx, cz, dx, dz, larg, y0, y1, off, rgbAl, rgbVi) {
  const X = cx - dz*off, Z = cz + dx*off, e = 0.040, m = ESQ_PERF;
  const at = t => [X + dx*t, Z + dz*t];
  const A = at(-larg/2 + m/2), B = at(larg/2 - m/2);
  pecaOr(dAl, A[0], A[1], dx, dz, m, e, y0, y1, rgbAl);          // montantes
  pecaOr(dAl, B[0], B[1], dx, dz, m, e, y0, y1, rgbAl);
  pecaOr(dAl, X, Z, dx, dz, larg, e, y0, y0 + m, rgbAl);         // travessas
  pecaOr(dAl, X, Z, dx, dz, larg, e, y1 - m, y1, rgbAl);
  if (larg > m*2.4 && y1 - y0 > m*2.4)
    pecaOr(dVi, X, Z, dx, dz, larg - m*1.8, 0.006, y0 + m*0.9, y1 - m*0.9, rgbVi);
}

function geoDasEsquadrias(pl) {
  const dPin = [[],[],[],[]], dAl = [[],[],[],[]], dVi = [[],[],[],[]];
  const cores = (pl.unidade && pl.unidade.cores) || {};
  const cor = chave => rgbDe(cores[chave]
    ? parseInt(String(cores[chave]).replace("#", ""), 16) : ESQ_COR[chave]);
  const cEsq = cor("esquadria"), cPorta = cor("porta"), cAl = cor("aluminio"),
        cPeit = cor("peitoril"), cVi = cor("vidro");
  const meia = ESP/2;

  for (const v of (pl.esquadrias || [])) {
    const dx = v.ux, dz = v.uz, nx = v.nx, nz = v.nz, L = v.L;
    const mx = (v.a[0]+v.b[0])/2, mz = (v.a[1]+v.b[1])/2;
    // ponto sobre o eixo da parede, a `t` metros de `a` e `o` metros pra fora dela
    const P = (t, o) => [v.a[0] + dx*t + nx*o, v.a[1] + dz*t + nz*o];

    // Passagem com VERGA é porta sem folha, e leva batente. Passagem que vai até o
    // forro não é vão de porta, é ausência de parede (sala e jantar como um cômodo só):
    // emoldurar isso inventaria um portal que a planta não tem.
    if (v.tipo === "vao" && v.y1 >= pl.pd - 0.06) continue;
    if (v.tipo === "giro" || v.tipo === "vao") {
      const prof = ESP + 0.012;   // o marco embrulha o vão e sobra 6 mm em cada face
      const A = P(ESQ_MARCO/2, 0), B = P(L - ESQ_MARCO/2, 0);
      pecaOr(dPin, A[0], A[1], nx, nz, prof, ESQ_MARCO, v.y0, v.y1, cEsq);   // ombreiras
      pecaOr(dPin, B[0], B[1], nx, nz, prof, ESQ_MARCO, v.y0, v.y1, cEsq);
      pecaOr(dPin, mx, mz, dx, dz, L, prof, v.y1 - ESQ_MARCO, v.y1, cEsq);   // travessa
      // Guarnição nas DUAS faces, transbordando a parede. É ela que some com a junta
      // entre reboco e batente -- e junta aparente é o que denuncia maquete.
      // O topo é aparado no forro: vão de altura de pé-direito inteiro existe (sala pra
      // jantar), e sem a aparagem a guarnição atravessa a laje e aparece no andar de cima.
      const yG = Math.min(v.y1 + ESQ_GUARN, pl.pd - 0.008);
      for (const s of [1, -1]) {
        const o = s*(meia + 0.006), g = ESQ_GUARN;
        // A guarnicao encosta na face PROXIMA da vizinha. Atravessa-la ate a
        // face oposta faria outra tira branca aparecer no comodo perpendicular.
        const ga = Math.max(g, v.remateA == null ? g : v.remateA - ESP);
        const gb = Math.max(g, v.remateB == null ? g : v.remateB - ESP);
        const E = P(-ga/2, o), F = P(L + gb/2, o), G = P((L+gb-ga)/2, o);
        pecaOr(dPin, E[0], E[1], dx, dz, ga, 0.014, v.y0, yG, cEsq);
        pecaOr(dPin, F[0], F[1], dx, dz, gb, 0.014, v.y0, yG, cEsq);
        if (yG > v.y1 + 0.004)
          pecaOr(dPin, G[0], G[1], dx, dz, L + ga + gb, 0.014, v.y1, yG, cEsq);
      }
      if (v.tipo === "vao") continue;   // passagem: marco e guarnição, sem folha
      // A folha, girada em torno da ombreira da dobradiça. `+ang` gira na direção +n
      // (checagem: girar `d` de +90° dá (-dz,dx), que é justamente `n`).
      const sh = v.eixo ? -1 : 1;
      const ang = v.lado * sh * ESQ_ANG;
      const hx = v.eixo ? v.b[0] : v.a[0], hz = v.eixo ? v.b[1] : v.a[1];
      const ex = hx + nx*v.lado*(meia - 0.024), ez = hz + nz*v.lado*(meia - 0.024);
      const ca = Math.cos(ang), sa = Math.sin(ang);
      const fx = dx*sh*ca - dz*sh*sa, fz = dx*sh*sa + dz*sh*ca;
      const larg = Math.max(0.30, L - ESQ_MARCO*2 - 0.010);
      const t0 = larg/2 + ESQ_MARCO*0.5;
      pecaOr(dPin, ex + fx*t0, ez + fz*t0, fx, fz, larg, ESQ_FOLHA,
             v.y0 + 0.012, v.y1 - ESQ_MARCO - 0.008, cPorta);
      // Maçaneta: espelho e alavanca nas duas faces, a alavanca apontando PRA
      // dobradiça, que é como alavanca de verdade fica (ao contrário engancha roupa).
      const gx = -fz, gz = fx, tM = larg + ESQ_MARCO*0.5 - 0.075;
      for (const s of [1, -1]) {
        const o = s*(ESQ_FOLHA/2 + 0.008), o2 = s*(ESQ_FOLHA/2 + 0.020);
        pecaOr(dAl, ex + fx*tM + gx*o, ez + fz*tM + gz*o, fx, fz,
               0.060, 0.016, v.y0 + 1.015, v.y0 + 1.075, cAl);
        pecaOr(dAl, ex + fx*(tM-0.055) + gx*o2, ez + fz*(tM-0.055) + gz*o2, fx, fz,
               0.115, 0.024, v.y0 + 1.033, v.y0 + 1.057, cAl);
      }
      v.folha = { x:ex, z:ez, dx:fx, dz:fz, larg:larg + ESQ_MARCO*0.5 };
      continue;
    }

    // ---- correr e fixa: caixilho de alumínio, e vidro que deixa a cidade entrar ----
    const janela = !v.porta, prof = ESP*0.62;
    if (janela && v.y0 > 0.20) {          // peitoril: a pedra que dá tamanho ao rasgo
      const S = P(L/2, 0);
      pecaOr(dPin, S[0], S[1], dx, dz, L + 0.10, ESP + 0.06, v.y0 - 0.035, v.y0, cPeit);
    }
    const C1 = P(ESQ_PERF/2, 0), C2 = P(L - ESQ_PERF/2, 0);
    pecaOr(dAl, C1[0], C1[1], nx, nz, prof, ESQ_PERF, v.y0, v.y1, cAl);   // ombreiras
    pecaOr(dAl, C2[0], C2[1], nx, nz, prof, ESQ_PERF, v.y0, v.y1, cAl);
    pecaOr(dAl, mx, mz, dx, dz, L, prof, v.y1 - ESQ_PERF, v.y1, cAl);     // trilho de cima
    const soleira = janela ? 0.030 : 0.020;
    pecaOr(dAl, mx, mz, dx, dz, L, prof, v.y0, v.y0 + soleira, cAl);      // trilho de baixo

    const yA = v.y0 + soleira, yB = v.y1 - ESQ_PERF;
    if (yB - yA < 0.15 || L < ESQ_PERF*3) continue;
    if (v.tipo === "fixa") {              // basculante de banheiro: uma chapa só
      folhaVidro(dAl, dVi, mx, mz, dx, dz, L - ESQ_PERF*2, yA, yB, 0, cAl, cVi);
      continue;
    }
    // Duas folhas de correr. A móvel nasce CORRIDA por cima da fixa, encostada no lado
    // da dobradiça: porta de varanda fechada bloquearia a passagem de quem visita, e
    // janela toda fechada esconde que ela abre. Sobra meio vão livre, como na vida.
    const meiaL = (L - ESQ_PERF*2) / 2;
    const sg = v.eixo ? -1 : 1;                       // pra que lado a folha some
    const tf = ESQ_PERF + (v.eixo ? meiaL*1.5 : meiaL/2);
    // Fechada, a móvel ficaria em `tf + sg*meiaL`. Aberta ela cavalga a fixa: 20% de
    // desencontro só pra as duas se lerem como duas, e o resto do vão fica livre.
    const tm = tf + sg*meiaL*0.20;
    const F0 = P(tf, 0), F1 = P(tm, 0);
    folhaVidro(dAl, dVi, F0[0], F0[1], dx, dz, meiaL, yA, yB,  0.026, cAl, cVi);
    folhaVidro(dAl, dVi, F1[0], F1[1], dx, dz, meiaL, yA, yB, -0.026, cAl, cVi);
    // puxador vertical na folha que corre, na borda que encosta na ombreira quando fecha
    const tp = tm + sg*(meiaL/2 - 0.06);
    const PX = P(tp, v.lado*0.056);
    pecaOr(dAl, PX[0], PX[1], nx, nz, 0.030, 0.026,
           yA + (janela ? 0.06 : 0.85), yA + (janela ? 0.26 : 1.15), cAl);
  }

  const malhas = [];
  const monta = (d, mat, vidro) => {
    if (!d[0].length) return;
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(d[0]), 3));
    g.setAttribute("normal",   new THREE.BufferAttribute(new Float32Array(d[1]), 3));
    g.setAttribute("color",    new THREE.BufferAttribute(new Uint8Array(d[2]), 3, true));
    g.setAttribute("uv",       new THREE.BufferAttribute(new Float32Array(d[3]), 2));
    g.computeBoundingSphere();
    const m = new THREE.Mesh(g, mat);
    m.userData.casa = true;
    m.castShadow = !vidro; m.receiveShadow = !vidro;
    if (vidro) m.renderOrder = 3;   // depthWrite:false só se comporta desenhando por último
    malhas.push(m);
  };
  monta(dPin, matEsq, false);
  monta(dAl, matAlum, false);
  monta(dVi, matVidro, true);
  return malhas;
}

    return {ESQ_ANG, ESQ_MARCO, geoDasEsquadrias};
  }
  root.Openings = Object.freeze({create});
})(globalThis);

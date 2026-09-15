/* Floor plan: walls derived from a 5 cm ownership grid, openings and which way each door swings. */
(function(root) {
  "use strict";
  function create({inside, shoelace, ESP, ESQ_ANG, ESQ_MARCO}) {
// t do ponto projetado no segmento, e o quanto ele esta fora dele
function projeta(p, a, b) {
  const dx = b[0]-a[0], dz = b[1]-a[1], L = Math.hypot(dx, dz) || 1e-6;
  let t = ((p[0]-a[0])*dx + (p[1]-a[1])*dz) / (L*L);
  const tc = t < 0 ? 0 : t > 1 ? 1 : t;
  return { t: tc*L, L, d: Math.hypot(a[0]+dx*tc - p[0], a[1]+dz*tc - p[1]) };
}

function paredesDaGrade(comodos, vaos, pd) {
  const G = 0.05;
  let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
  for (const c of comodos) for (const p of c.poly) {
    if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0];
    if (p[1] < z0) z0 = p[1]; if (p[1] > z1) z1 = p[1];
  }
  x0 -= G; z0 -= G; x1 += G; z1 += G;
  const NX = Math.ceil((x1-x0)/G), NZ = Math.ceil((z1-z0)/G);
  const dono = new Int16Array(NX*NZ).fill(-1);
  for (let i = 0; i < NX; i++) for (let j = 0; j < NZ; j++) {
    const x = x0 + (i+0.5)*G, z = z0 + (j+0.5)*G;
    for (let k = 0; k < comodos.length; k++)
      if (inside(comodos[k].poly, x, z)) { dono[i*NZ+j] = k; break; }
  }
  const brutos = [];
  for (let i = 0; i < NX-1; i++) { let j = 0;
    while (j < NZ) {
      if (dono[i*NZ+j] === dono[(i+1)*NZ+j]) { j++; continue; }
      const j0 = j;
      while (j < NZ && dono[i*NZ+j] !== dono[(i+1)*NZ+j]) j++;
      brutos.push([[x0+(i+1)*G, z0+j0*G], [x0+(i+1)*G, z0+j*G]]);
    } }
  for (let j = 0; j < NZ-1; j++) { let i = 0;
    while (i < NX) {
      if (dono[i*NZ+j] === dono[i*NZ+j+1]) { i++; continue; }
      const i0 = i;
      while (i < NX && dono[i*NZ+j] !== dono[i*NZ+j+1]) i++;
      brutos.push([[x0+i0*G, z0+(j+1)*G], [x0+i*G, z0+(j+1)*G]]);
    } }

  // Cada vao vai pra UMA parede: a mais perto. Porta em canto de dois comodos ficaria
  // perto de duas paredes perpendiculares e abriria buraco nas duas.
  const doVao = brutos.map(() => []);
  for (const v of vaos) {
    let melhor = -1, dm = 0.35, pr = null;
    for (let k = 0; k < brutos.length; k++) {
      const q = projeta(v.p, brutos[k][0], brutos[k][1]);
      if (q.d < dm) { dm = q.d; melhor = k; pr = q; }
    }
    if (melhor < 0) continue;
    const meia = (v.largura || 0.85) / 2;
    doVao[melhor].push({ src: v, a: Math.max(0, pr.t - meia), b: Math.min(pr.L, pr.t + meia),
                         y0: v.y0, y1: v.y1 });
  }

  const out = [], postos = [];
  for (let k = 0; k < brutos.length; k++) {
    const A = brutos[k][0], B2 = brutos[k][1];
    const L = Math.hypot(B2[0]-A[0], B2[1]-A[1]);
    if (L < G*1.5) continue;
    const ux = (B2[0]-A[0])/L, uz = (B2[1]-A[1])/L;
    const pt = t => [A[0] + ux*t, A[1] + uz*t];
    const vs = doVao[k].filter(v => v.b - v.a > 0.15).sort((p, q) => p.a - q.a);
    let t0 = 0;
    for (const v of vs) {
      // `pa`/`pb`: a extremidade encosta num vão. A colisão recua ali (ver `livre`),
      // senão porta de 70 cm fica intransitável -- o raio do corpo mais meia parede dá
      // 36,5 cm de cada lado, e o vão inteiro tem 35.
      if (v.a - t0 > 0.06)
        out.push({ a: pt(t0), b: pt(v.a), y0: 0.02, y1: pd, pa: t0 > 1e-3 ? 1 : 0, pb: 1 });
      // `pa`/`pb` = 1 nos dois: as duas pontas do peitoril e da verga SAO o vao. Sem
      // isso o alongamento de junta (ver `EXT` no desenho da parede) avancaria os dois
      // pra dentro da abertura.
      if (v.y0 > 0.06) out.push({ a: pt(v.a), b: pt(v.b), y0: 0.02, y1: v.y0, pa: 1, pb: 1 });
      if (v.y1 < pd - 0.06) out.push({ a: pt(v.a), b: pt(v.b), y0: v.y1, y1: pd, pa: 1, pb: 1 });
      // Vão posto: já sabe onde COMEÇA e onde TERMINA na parede, a direção dela e a
      // normal. É disso que a esquadria vive -- o ponto+largura da entrada não diz em
      // que parede caiu nem pra que lado ela olha.
      postos.push({ src: v.src, a: pt(v.a), b: pt(v.b), y0: v.y0, y1: v.y1,
                    ux, uz, nx: -uz, nz: ux, ta: v.a, tb: v.b, L });
      t0 = Math.max(t0, v.b);
    }
    if (L - t0 > 0.06) out.push({ a: pt(t0), b: pt(L), y0: 0.02, y1: pd, pa: vs.length ? 1 : 0 });
  }
  return { paredes: out, vaos: postos };
}

/* ---- pra que lado a porta abre ----------------------------------------
   A planta de anúncio não diz. Ela desenha um arco, e quem transcreve raramente
   transcreve o arco -- então o lado é DEDUZIDO, com a mesma regra que o desenhista usa:

     1. a folha gira pra dentro do ambiente MAIS PRIVADO dos dois (banho e quarto
        recebem a porta; circulação nunca, senão a folha aberta tranca o corredor);
     2. empate: gira pro MENOR, que é onde ela encosta na parede sem varrer o meio;
     3. a dobradiça fica na extremidade mais perto do canto do cômodo, pra folha
        abrir contra a parede lateral e não no meio da passagem.

   `abre_para` (nome do cômodo) e `dobradica` ([x,z] em metros da planta) mandam nas
   duas, quando quem cadastra sabe mais que a regra. */
const PRIVACIDADE = [
  [/^(circula|corredor|hall|escada|acesso|entrada)/i, 0],
  [/^(varanda|sacada|terra|quintal|jardim|churrasq)/i, 1],
  [/^(sala|estar|living|jantar|copa|home|escrit)/i,    2],
  [/^(cozinha|servi|despensa|lavand|t[eé]cnic|dep[oó])/i, 3],
  [/^(dormit|quarto|su[ií]te|closet)/i,                4],
  [/^(banho|banheiro|lavabo|wc|sanit)/i,               5]
];
function privacidade(nome) {
  for (const [re, r] of PRIVACIDADE) if (re.test(nome || "")) return r;
  return 3;
}
// Quem está de cada lado da parede, no ponto médio do vão. Duas sondagens: 26 cm cobre
// meia parede mais uma folga; 50 cm salva o cômodo estreito cujo eixo não passa pelo
// meio do vão.
function ladosDoVao(comodos, v) {
  const mx = (v.a[0]+v.b[0])/2, mz = (v.a[1]+v.b[1])/2;
  const acha = s => {
    for (const off of [0.26, 0.50]) {
      const x = mx + v.nx*off*s, z = mz + v.nz*off*s;
      for (const c of comodos) if (inside(c.poly, x, z)) return c;
    }
    return null;
  };
  return [acha(1), acha(-1)];   // [lado +normal, lado -normal]
}
const VARANDA = /^(varanda|sacada|terra|quintal)/i;
const areaDe = c => c.area || Math.abs(shoelace(c.poly)) / 2;

/* A FOLHA NAO PODE ATRAVESSAR PAREDE.

   Porta de giro nasce aberta a 78 graus (ver ESQ_ANG) porque folha fechada veda o
   comodo vizinho e a visita em primeira pessoa vira quarto sem saida. O preco e que a
   folha aberta OCUPA 80 cm de comodo -- e em canto apertado ela sai pelo outro lado e
   aparece cravada na parede vizinha, que e o defeito que o usuario apontou.

   Quando isso acontece a peca certa nao e uma folha menor: e o BATENTE SEM FOLHA. E o
   que se ve em obra numa passagem, e o `vao` ja desenha exatamente isso (marco e
   guarnicao, sem folha).

   O teste e o mesmo que a vista faz: a folha esta dentro do comodo em que ela gira?
   Tres amostras ao longo dela, empurradas 6 cm PRA DENTRO do comodo -- a ponta encosta
   na parede lateral POR PROJETO (a dobradica vai pro canto de proposito, ver `eixo`
   abaixo), entao testar a fronteira crua reprovaria toda porta bem colocada. */
function folhaCabe(alvo, v, larg, lado, eixo) {
  const sh = eixo ? -1 : 1;
  const ang = lado * sh * ESQ_ANG;
  const hx = eixo ? v.b[0] : v.a[0], hz = eixo ? v.b[1] : v.a[1];
  const ex = hx + v.nx*lado*(ESP/2 - 0.024), ez = hz + v.nz*lado*(ESP/2 - 0.024);
  const ca = Math.cos(ang), sa = Math.sin(ang);
  const fx = v.ux*sh*ca - v.uz*sh*sa, fz = v.ux*sh*sa + v.uz*sh*ca;
  const Lf = Math.max(0.30, larg - ESQ_MARCO*2 - 0.010);
  const ix = v.nx*lado*0.06, iz = v.nz*lado*0.06;
  for (const t of [0.55, 0.80, 1.0])
    if (!inside(alvo.poly, ex + fx*Lf*t + ix, ez + fz*Lf*t + iz)) return false;
  return true;
}

/* Que peça é este vão, pra que lado a folha gira e em que extremidade fica a
   dobradiça. Tudo em coordenadas da PLANTA -- quem gira pro mundo é `plantaDaUnidade`.

   O tipo é inferido da largura e da vizinhança porque planta de anúncio não declara:
   3,20 m de pé-direito inteiro entre sala e jantar não é porta, é ausência de parede;
   2,40 m dando pra varanda é porta de correr de vidro; 70 cm entre circulação e banho
   é folha de giro. `tipo` no cadastro passa por cima de tudo isso. */
function decideVao(comodos, v, pd) {
  const rec = v.src.rec || {};
  const larg = Math.hypot(v.b[0]-v.a[0], v.b[1]-v.a[1]);
  if (larg < 0.2) return null;
  const lados = ladosDoVao(comodos, v);
  const varanda = c => !!c && VARANDA.test(c.nome || "");

  let tipo = rec.tipo;
  if (!tipo) {
    if (!v.src.porta) tipo = larg >= 0.80 ? "correr" : "fixa";
    else if (v.y1 >= pd - 0.12 && larg >= 1.40) tipo = "vao";
    else if ((varanda(lados[0]) || varanda(lados[1])) && larg >= 1.20) tipo = "correr";
    else if (larg > 1.10) tipo = "vao";
    else tipo = "giro";
  }
  // `vao` é passagem sem folha -- mas ganha batente igual. Reboco virando a esquina do
  // rasgo não existe em obra: passagem de porta é acabada com marco e guarnição, e sem
  // eles a cozinha parece recortada a estilete.

  // De que lado está o "dentro". Na porta de giro é pra onde a folha vai; na de correr
  // e na janela é só onde ficam puxador e peitoril.
  let lado = 1;
  const nome = rec.abre_para ? String(rec.abre_para).toLowerCase() : null;
  const bate = c => !!c && !!nome && (c.nome || "").toLowerCase().indexOf(nome) === 0;
  if (bate(lados[0])) lado = 1;
  else if (bate(lados[1])) lado = -1;
  else if (!lados[0] !== !lados[1]) lado = lados[0] ? 1 : -1;   // um lado é a rua
  else if (lados[0] && lados[1]) {
    if (tipo === "giro") {
      const p0 = privacidade(lados[0].nome), p1 = privacidade(lados[1].nome);
      lado = p0 !== p1 ? (p0 > p1 ? 1 : -1)
                       : (areaDe(lados[0]) <= areaDe(lados[1]) ? 1 : -1);
    } else lado = varanda(lados[0]) ? -1 : 1;
  }

  // Dobradiça: a extremidade mais perto da lateral do cômodo em que a folha entra. É lá
  // que a porta aberta encosta na parede, em vez de varrer o meio da passagem.
  let eixo;
  const alvo = lado > 0 ? lados[0] : lados[1];
  if (rec.dobradica) {
    const q = rec.dobradica;
    eixo = Math.hypot(q[0]-v.a[0], q[1]-v.a[1]) <= Math.hypot(q[0]-v.b[0], q[1]-v.b[1]) ? 0 : 1;
  } else if (alvo && tipo === "giro") {
    let s0 = 1e9, s1 = -1e9;
    for (const p of alvo.poly) {
      const s = p[0]*v.ux + p[1]*v.uz;
      if (s < s0) s0 = s; if (s > s1) s1 = s;
    }
    const sa = v.a[0]*v.ux + v.a[1]*v.uz, sb = v.b[0]*v.ux + v.b[1]*v.uz;
    eixo = (sa - s0) <= (s1 - sb) ? 0 : 1;
  } else eixo = v.ta <= v.L - v.tb ? 0 : 1;

  // Só agora dá pra saber se a folha cabe: ela depende do lado E da dobradiça. Se não
  // couber, vira passagem emoldurada. `tipo` do cadastro continua mandando -- quem
  // escreveu "giro" tem o desenho na frente e pode saber de uma folha rebatida.
  if (tipo === "giro" && !rec.tipo) {
    const alvoF = lado > 0 ? lados[0] : lados[1];
    if (alvoF && !folhaCabe(alvoF, v, larg, lado, eixo)) tipo = "vao";
  }

  return { tipo, lado, eixo };
}

    return {projeta, paredesDaGrade, privacidade, ladosDoVao, folhaCabe, decideVao};
  }
  root.FloorPlan = Object.freeze({create});
})(globalThis);

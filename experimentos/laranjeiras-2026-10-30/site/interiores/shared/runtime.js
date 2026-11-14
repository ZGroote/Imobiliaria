/* Floor plan: walls derived from a 5 cm ownership grid, openings and which way each door swings. */
(function(root) {
  "use strict";
  function create({inside, shoelace, ESP, ESQ_ANG, ESQ_MARCO, safeInset, obbOf, BUILDING_INSET, PD, anelDoLote, MOVEIS, fecharQuinas = false}) {
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
  // A compactacao e opt-in do LEVE; mapa e outros consumidores mantem o contrato.
  if (!fecharQuinas) return {paredes: out, vaos: postos};
  // Um resto de parede menor que a propria espessura nao e um pano de parede:
  // e um filete deixado pelo recorte de um vao. Extrudar, por exemplo, 8 cm de
  // comprimento com 13 cm de espessura cria um prisma mais grosso que comprido,
  // expondo duas faces no corredor e uma quina falsa no encontro com o forro.
  // O remate abaixo fecha essa ombreira com os panos sobreviventes. Mantemos peitoris
  // e vergas (nao ocupam a altura inteira) e qualquer pano com comprimento >= ESP.
  const paredes = out.filter(w => {
    const comprimento = Math.hypot(w.b[0]-w.a[0], w.b[1]-w.a[1]);
    const alturaInteira = w.y0 < 0.05 && w.y1 >= pd - 0.01;
    return !alturaInteira || comprimento + 1e-6 >= ESP;
  });
  // Remates so existem quando o filete removido encontra um pano perpendicular.
  // Guardamos extensoes de desenho; os eixos usados pela colisao nao mudam.
  for (const v of postos) for (const lado of ['a', 'b']) {
    if (v.y1 >= pd - 0.06) continue; // ambiente continuo: nao criar portal/remate
    const sobra = lado === 'a' ? v.ta : v.L - v.tb;
    if (!(sobra > 1e-6 && sobra + 1e-6 < ESP)) continue;
    const sinal = lado === 'a' ? -1 : 1;
    const canto = [v[lado][0] + sinal*v.ux*sobra, v[lado][1] + sinal*v.uz*sobra];
    const vizinhas = paredes.filter(w => {
      const dx = w.b[0]-w.a[0], dz = w.b[1]-w.a[1], L = Math.hypot(dx,dz);
      return w.y0 < 0.05 && w.y1 >= pd-0.01 &&
        Math.abs((dx*v.ux+dz*v.uz)/L) < 1e-6 && projeta(canto,w.a,w.b).d < ESP/2;
    });
    if (!vizinhas.length) continue;
    const chave = lado === 'a' ? 'remateA' : 'remateB';
    v[chave] = sobra + ESP/2;
    // Peitoril/verga sobreviventes chegam a face externa da parede vizinha.
    for (const w of paredes) if (Math.hypot(w[lado][0]-v[lado][0],w[lado][1]-v[lado][1]) < 1e-6 &&
      Math.abs((w.b[0]-w.a[0])*v.uz-(w.b[1]-w.a[1])*v.ux) < 1e-6)
      w[chave] = Math.max(w[chave] || 0, v[chave]);
    // A ponta perpendicular pode estar marcada como vao: fecha ate a face,
    // descontando o deslocamento real entre os eixos (grade de 5 cm).
    for (const w of vizinhas) for (const ponta of ['a','b']) {
      const outra = ponta === 'a' ? 'b' : 'a';
      const dx = w[ponta][0]-w[outra][0], dz = w[ponta][1]-w[outra][1], L = Math.hypot(dx,dz);
      const distancia = (canto[0]-w[ponta][0])*dx/L + (canto[1]-w[ponta][1])*dz/L;
      if (Math.hypot(canto[0]-w[ponta][0],canto[1]-w[ponta][1]) < ESP/2 && distancia+ESP/2 > 0)
        w[ponta === 'a' ? 'remateA' : 'remateB'] = distancia+ESP/2;
    }
  }
  return { paredes, vaos: postos };
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

const PISO_HEX = { frio: 0xCFC7BB, madeira: 0x9A7B57, porcelanato: 0xD6D0C6 };
// Raio que cobre a pegada inteira do predio, com folga: e o tamanho do furo que apaga
// a casca em volta da unidade.
function raioDaCasca(casca, ob) {
  let r = 0;
  for (const p of casca) r = Math.max(r, Math.hypot(p[0]-ob.cx, p[1]-ob.cz));
  return r + 1.5;
}
// Movel tambem vem do cadastro: `moveis` traz tipo, ponto em metros da planta, giro em
// quartos de volta e tamanho. Sem isso a casa nasce vazia -- de proposito. Espalhar
// movel por receita generica era exatamente o que fazia a sala do anuncio ficar
// entulhada de coisa que nao esta no desenho.
/* `?moveis=0` esvazia a casa sem rebuild. Existe porque nem toda planta tem (ou
   deve ter) mobilia: unidade em obra, planta de gabarito, e o caso simples de
   querer ver o apartamento vazio. Os outros dois interruptores estao em
   `montar.py:bloco_unidades` -- `planta.moveis` a mao e `planta.mobiliar: false`. */
const MOVEIS_ON = new URLSearchParams(location.search).get("moveis") !== "0";
function moveisDaUnidade(P, mcx, mcz) {
  const out = [];
  if (!MOVEIS_ON) return out;
  for (const m of (P.moveis || [])) {
    const def = MOVEIS[m.tipo];
    if (!def || !m.p) continue;
    const item = { tipo: m.tipo, u: m.p[0] - mcx, v: m.p[1] - mcz, rot: (m.rot || 0) & 3,
                   w: m.w || def.b[0], h: m.h || def.b[1], d: m.d || def.b[2],
                   cor: m.cor ? parseInt(String(m.cor).replace("#", ""), 16) : def.cor };
    // Altura acompanha a própria peça; índices mudam quando um tipo não existe no catálogo.
    if (m.y != null) item.y = m.y;
    if (m.estilo) item.estilo = m.estilo;   // par de malhas do sofa (`sofaParam`)
    out.push(item);
  }
  return out;
}

/* A casca de uma unidade de LOTE. Sem volume na base, ela sai da PROPRIA PLANTA.

   Tudo daqui pra baixo -- posicao no mundo, eixo em que a planta assenta, altura do
   piso -- e lido do `rec` do predio. Em vez de espalhar `if (rec)` por
   `plantaDaUnidade`, `baseDaCasa` e `geoDaCasa`, o lote fabrica um `rec` com a mesma
   forma: um retangulo do tamanho da planta mais folga de alvenaria, plantado na
   coordenada do terreno. O resto do programa nao precisa saber a diferenca.

   Duas decisoes que nao sao arbitrarias:

   ENROLAMENTO POSITIVO de proposito. `plantaDaUnidade` le `shoelace(rec.r) > 0` como
   "contorno GERADO" e aplica recuo de 25 cm em vez do 1 m do footprint do Overture --
   e gerado e exatamente o que este contorno e. Com o sinal trocado, a casca do lote
   levaria 1 m de recuo por lado e a planta nasceria maior que a casca.

   FURO ZERO. O furo e o cilindro que a fachada nao desenha, pra apagar a casca do
   predio em que se entrou. Num lote nao ha casca pra apagar -- e um raio qualquer ali
   apagaria o VIZINHO. Ver `uFuro`.                                                  */
function recDeLote(u) {
  const an = anelDoLote(u);
  if (!an) return null;
  // `lote: true` e o que zera o furo la embaixo. So vale pro lote SEM predio: quando ha
  // torre declarada, ela e uma casca de verdade e precisa ser recortada como qualquer
  // outra -- senao entra-se no 7o andar com a propria fachada tapando a tela.
  return { r: an.r, h: an.h, name: null, lote: true };
}
function plantaDaUnidade(rec, u) {
  if (!rec) rec = recDeLote(u);
  if (!rec) return null;
  const P = u.planta, pd = P.pe_direito || PD;
  let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
  for (const c of P.comodos) for (const p of c.poly) {
    if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0];
    if (p[1] < z0) z0 = p[1]; if (p[1] > z1) z1 = p[1];
  }
  const mcx = (x0+x1)/2, mcz = (z0+z1)/2;

  // A planta vem em metros com origem propria. Ela e centrada no centroide do predio e
  // alinhada ao eixo maior do volume -- que e o mesmo referencial (u,v) em que o movel
  // ja vive, entao tudo daqui pra baixo nao sabe a diferenca entre planta e BSP.
  const gerado = shoelace(rec.r) > 0;
  const rOK = gerado ? rec.r.slice().reverse() : rec.r;
  const casca = safeInset(rOK, gerado ? 0.25 : BUILDING_INSET);
  const obB = obbOf(casca, Math.abs(shoelace(casca))/2);
  const ob = { cx: obB.cx, cz: obB.cz, ux: obB.ux, uz: obB.uz,
               hu: (x1-x0)/2, hv: (z1-z0)/2, rect: 1, elong: 1 };
  const W = (a, b) => [ob.cx + ob.ux*a - ob.uz*b, ob.cz + ob.uz*a + ob.ux*b];
  const mundo = p => W(p[0]-mcx, p[1]-mcz);

  const cores = u.cores || {};
  const hexPiso = k => {
    const c = cores["piso_" + k];
    return c ? parseInt(String(c).replace("#", ""), 16) : (PISO_HEX[k] || PISO_HEX.frio);
  };
  const comodos = P.comodos.map(c => {
    const poly = c.poly.map(mundo);
    let sx = 0, sz = 0, au = 1e9, bu = -1e9, av = 1e9, bv = -1e9;
    for (const p of c.poly) {
      const uu = p[0]-mcx, vv = p[1]-mcz;
      if (uu < au) au = uu; if (uu > bu) bu = uu;
      if (vv < av) av = vv; if (vv > bv) bv = vv;
    }
    for (const p of poly) { sx += p[0]; sz += p[1]; }
    return { nome: c.nome, area: c.area || Math.abs(shoelace(poly))/2, poly,
             piso: hexPiso(c.piso || "frio"), pisoTipo: c.piso || "frio",
             cx: sx/poly.length, cz: sz/poly.length,
             f: { u0: au, u1: bu, v0: av, v1: bv } };
  });

  const vaos = [];
  for (const p of (P.portas || []))
    vaos.push({ rec: p, porta: true, p: p.p, largura: p.largura || 0.85,
                y0: p.y0 != null ? p.y0 : 0, y1: p.y1 != null ? p.y1 : 2.10 });
  for (const j of (P.janelas || []))
    vaos.push({ rec: j, porta: false, p: j.p, largura: j.largura || 1.40,
                y0: j.y0 != null ? j.y0 : 1.00, y1: j.y1 != null ? j.y1 : 2.20 });
  const grade = paredesDaGrade(P.comodos, vaos, pd);
  const paredes = grade.paredes.map(w =>
    ({ a: mundo(w.a), b: mundo(w.b), y0: w.y0, y1: w.y1, pa: w.pa, pb: w.pb, remateA: w.remateA, remateB: w.remateB }));
  // A rotação `mundo()` preserva orientação (matriz [[ux,-uz],[uz,ux]], determinante 1),
  // então o sinal do lado decidido na planta continua valendo depois de girar.
  const esquadrias = [];
  for (const v of grade.vaos) {
    const d = decideVao(P.comodos, v, pd);
    if (!d) continue;
    const A = mundo(v.a), B2 = mundo(v.b);
    const Lv = Math.hypot(B2[0]-A[0], B2[1]-A[1]) || 1e-6;
    const dx = (B2[0]-A[0])/Lv, dz = (B2[1]-A[1])/Lv;
    esquadrias.push({ tipo: d.tipo, lado: d.lado, eixo: d.eixo, porta: !!v.src.porta,
                      y0: v.y0, y1: v.y1, a: A, b: B2, L: Lv,
                      ux: dx, uz: dz, nx: -dz, nz: dx, remateA: v.remateA, remateB: v.remateB });
  }

  let area = 0;
  for (const c of comodos) area += c.area;
  comodos.sort((a, b) => b.area - a.area);
  return { id: u.id, rec, dentro: comodos[0].poly, contorno: comodos.map(c => c.poly),
           casca, ob, area, W, paredes, esquadrias, comodos,
           moveis: moveisDaUnidade(P, mcx, mcz),
           furo: { cx: obB.cx, cz: obB.cz, r: rec.lote ? 0 : raioDaCasca(casca, obB) },
           cx: ob.cx, cz: ob.cz, mx: ob.cx, mz: ob.cz, h: rec.h,
           pd, andar: u.andar || 0, unidade: u };
}

// Dentro da casa = dentro de QUALQUER comodo. No BSP `contorno` e o contorno unico da
// casca; na planta fornecida e um poligono por comodo, e o vao entre eles e a parede.
function dentroDaPlanta(pl, x, z) {
  for (const c of pl.contorno) if (inside(c, x, z)) return true;
  return false;
}

    return {projeta, paredesDaGrade, privacidade, ladosDoVao, folhaCabe, decideVao, plantaDaUnidade, dentroDaPlanta};
  }
  root.FloorPlan = Object.freeze({create});
})(globalThis);

/* Interior shell geometry: the wall prism (faces, vertical gradient, light-atlas UVs) and a segment quad. */
(function(root) {
  "use strict";
/* `fy` e uma gradacao VERTICAL opcional, aplicada na cor por vertice.

   Parede de comodo nao tem uma cor so, e era isso que deixava o interior sonso: cada
   face saia num tom chapado do rodape ao forro, e tres faces chapadas lado a lado leem
   como maquete de papel. Na vida a parede escurece no encontro com o piso (contato),
   clareia na faixa da janela -- que e por onde a luz entra e por onde ela ricocheteia
   do chao -- e cai um pouco de novo no forro.

   Sai de graca porque o prisma ja emite o vertice de baixo e o de cima separados: a
   gradacao e interpolada pelo proprio rasterizador, sem um triangulo a mais. */
function prismaQuad(P, N, C, U, q, y0, y1, rgb, fy, U2, pecas, semTampa, semPontas, fPonta, cortesPontas) {
  // `U2`/`pecas`: a UV do atlas de luz. `pecas` e um vetor de 5 funcoes, uma por
  // face deste prisma, ja enderecadas por quem chamou -- ver `cursorDeLuz`.
  /* `fPonta`: quanto a PONTA do prisma escurece. A ponta que sobra (a que morre num
     vao) e a face do rasgo da porta, e ela tem a normal virada pro comodo enquanto as
     duas faces ao lado dela estao quase de perfil pra camera. So por isso ela recebe
     mais luz difusa e sai como um FIO CLARO ao lado de toda ombreira -- provado por
     A/B: com a luz desligada (emissive chapado) o fio some; com sombra desligada,
     lightmap desligado, textura desligada ou cor-de-vertice sozinha, o fio FICA.
     Nao e vazamento de sombra nem costura de atlas: e a resposta difusa de uma tira de
     10 cm de frente pra sala. Num rasgo de verdade essa faixa esta na sombra da propria
     abertura -- e e isso que o fator repoe. */
  let _ponta = false;
  const put = (x,y,z,nx,ny,nz,u,v) => {
    const f = (fy ? fy(y) : 1) * (_ponta ? fPonta : 1);
    P.push(x,y,z); N.push(nx,ny,nz); U.push(u,v);
    C.push(Math.min(255, rgb[0]*f), Math.min(255, rgb[1]*f), Math.min(255, rgb[2]*f));
  };
  let mapa = null;
  const put2 = (a, b) => { if (U2) { const t = mapa ? mapa(a, b) : [0, 0]; U2.push(t[0], t[1]); } };
  // Com `fy` a face e fatiada em quatro. Sem isso a gradacao vira uma RETA entre o
  // vertice do rodape e o do forro -- a curva existiria no codigo e nao na tela, que
  // foi exatamente o que aconteceu na primeira tentativa.
  const NF = fy ? 4 : 1;
  const H = (y1 - y0) || 1;
  /* `semPontas`: nao emitir as duas faces CURTAS (i = 1 e 3), que sao as pontas do
     prisma. Elas nao existem em obra: toda ponta de parede ou morre dentro de outra
     parede, ou morre num vao -- e vao e acabado com marco e guarnicao, que e geometria
     que ja esta la (ver `ESQ_MARCO`). Desenhar a ponta e desenhar reboco virando a
     esquina do rasgo.

     E nao e so redundancia: a ponta e uma tira de ~10 cm cuja NORMAL olha pro comodo,
     encravada entre duas faces que estao no canto. O bake entrega a ela irradiancia de
     superficie exposta e sombra as vizinhas -- listra clara vertical em toda quina e em
     toda ombreira, que e o segundo "vazamento de luz" que o usuario apontou. Provado
     pintando as pontas de magenta: as listras que ele fotografou ficaram magenta.     */
  for (let i = 0; i < 4; i++) {
    // `semPontas` e MASCARA, nao booleano: bit 1 apaga a ponta do lado `a` (face i=3),
    // bit 2 a do lado `b` (face i=1). Por que por ponta e nao pelas duas: a ponta que
    // morre numa OUTRA parede nao existe (esta dentro dela) e so entrega a listra; a
    // ponta que morre num VAO e o rasgo da porta, que existe e tem que aparecer.
    if ((semPontas & 2) && i === 1) continue;
    if ((semPontas & 1) && i === 3) continue;
    _ponta = (fPonta != null) && (i === 1 || i === 3);
    const a = q[i], b = q[(i+1)%4];
    let nx = b[1]-a[1], nz = -(b[0]-a[0]);
    const L = Math.hypot(nx, nz) || 1; nx /= L; nz /= L;
    const c = Math.hypot(b[0]-a[0], b[1]-a[1]);   // UV corre com o comprimento real
    mapa = pecas ? pecas[i] : null;
    if (!cortesPontas?.[i]?.length) {
    for (let k = 0; k < NF; k++) {
      const ya = y0 + (y1-y0)*k/NF, yb = y0 + (y1-y0)*(k+1)/NF;
      const va = (ya-y0)/H, vb = (yb-y0)/H;
      put(a[0],ya,a[1],nx,0,nz,0,ya); put2(0, va);
      put(b[0],ya,b[1],nx,0,nz,c,ya); put2(1, va);
      put(b[0],yb,b[1],nx,0,nz,c,yb); put2(1, vb);
      put(a[0],ya,a[1],nx,0,nz,0,ya); put2(0, va);
      put(b[0],yb,b[1],nx,0,nz,c,yb); put2(1, vb);
      put(a[0],yb,a[1],nx,0,nz,0,yb); put2(0, vb);
    }
      continue;
    }
    // Recorta somente a parte da ponta coberta por outro prisma. A parte
    // exposta continua opaca; a coberta nao duplica a face da parede vizinha.
    let retangulos = [[0, 1, y0, y1]];
    for (const [l,r,baixo,alto] of (cortesPontas?.[i] || [])) {
      retangulos = retangulos.flatMap(([x0,x1,z0,z1]) => {
        const a=Math.max(x0,l), b=Math.min(x1,r), c=Math.max(z0,baixo), d=Math.min(z1,alto);
        if (b-a < 1e-7 || d-c < 1e-7) return [[x0,x1,z0,z1]];
        return [[x0,a,z0,z1],[b,x1,z0,z1],[a,b,z0,c],[a,b,d,z1]]
          .filter(q => q[1]-q[0]>1e-7 && q[3]-q[2]>1e-7);
      });
    }
    for (const [t0,t1,baixo,alto] of retangulos) for (let k = 0; k < NF; k++) {
      const ya = Math.max(baixo,y0+(y1-y0)*k/NF), yb = Math.min(alto,y0+(y1-y0)*(k+1)/NF);
      if (yb <= ya) continue;
      const va = (ya-y0)/H, vb = (yb-y0)/H;
      const ax=a[0]+(b[0]-a[0])*t0, az=a[1]+(b[1]-a[1])*t0;
      const bx=a[0]+(b[0]-a[0])*t1, bz=a[1]+(b[1]-a[1])*t1;
      put(ax,ya,az,nx,0,nz,c*t0,ya); put2(t0, va);
      put(bx,ya,bz,nx,0,nz,c*t1,ya); put2(t1, va);
      put(bx,yb,bz,nx,0,nz,c*t1,yb); put2(t1, vb);
      put(ax,ya,az,nx,0,nz,c*t0,ya); put2(t0, va);
      put(bx,yb,bz,nx,0,nz,c*t1,yb); put2(t1, vb);
      put(ax,yb,az,nx,0,nz,c*t0,yb); put2(t0, vb);
    }
  }
  /* `semTampa`: NAO emitir a face de cima. Existe pro rodape, e o motivo e o
     "vazamento de luz" que o usuario reportou na junta chao-parede.

     O rodape e um prisma 1,4 cm mais grosso que a parede, entao a tampa dele e uma
     PRATELEIRA de 7 mm virada pra cima. Virada pra cima ela ve o comodo inteiro, e
     tanto o bake quanto o lightmap entregam a ela a irradiancia de quem esta exposto
     -- enquanto tudo em volta esta no canto chao-parede, no escuro. Resultado: um fio
     branco de 1 px na base de toda parede, picotado porque 7 mm a 5 m de distancia nao
     chega a um pixel (medido: escurecer a tampa pra 0,72 da cor da parede nao resolveu,
     porque o problema e a EXPOSICAO dela, nao o albedo).

     Sem a tampa, o que se ve no lugar dela e a face interna do proprio prisma, que esta
     na sombra -- que e o que se ve num rodape de verdade: uma linha de sombra, nao uma
     de luz. Nao ha o que vazar por ali: o prisma continua fechado dos lados que
     importam, e a fresta de 7 mm da pro miolo da parede.                            */
  if (semTampa) return;
  // tampa de cima: a peca corre em (q0->q1) por (q0->q3), igual ao exportador
  mapa = pecas ? pecas[4] : null;
  const ux = q[1][0]-q[0][0], uz = q[1][1]-q[0][1];
  const vx = q[3][0]-q[0][0], vz = q[3][1]-q[0][1];
  const uu = (ux*ux + uz*uz) || 1, vv = (vx*vx + vz*vz) || 1;
  for (const k of [0,1,2, 0,2,3]) {
    put(q[k][0], y1, q[k][1], 0,1,0, q[k][0], q[k][1]);
    const dx = q[k][0]-q[0][0], dz = q[k][1]-q[0][1];
    put2((dx*ux + dz*uz)/uu, (dx*vx + dz*vz)/vv);
  }
}
function quadDoSeg(seg, esp) {
  const a = seg[0], b = seg[1];
  let dx = b[0]-a[0], dz = b[1]-a[1];
  const L = Math.hypot(dx, dz) || 1; dx /= L; dz /= L;
  const nx = -dz*esp/2, nz = dx*esp/2;
  return [[a[0]+nx,a[1]+nz], [b[0]+nx,b[1]+nz], [b[0]-nx,b[1]-nz], [a[0]-nx,a[1]-nz]];
}

  root.ShellGeometry = Object.freeze({prismaQuad, quadDoSeg});
})(globalThis);

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
const ESQ_ANG   = 90 * Math.PI/180;  // quanto a folha abre
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
      {
        const espRodape = ESP + 0.032;
        // A ponta do rodape ocupa o MESMO plano da ponta da parede. No miolo de
        // largura ESP, portanto, desenhar as duas cria faces coplanares (z-fighting).
        // O rodape so precisa fechar as duas abas que realmente salientes, 1,6 cm
        // de cada lado. Recortamos o miolo contra a propria parede e mantemos os
        // cortes contra paredes vizinhas calculados acima.
        const margemParede = (espRodape - ESP) / (2 * espRodape);
        const cortaMiolo = [margemParede, 1-margemParede, 0.02, 0.115];
        prismaQuad(P, N, C, U, quadDoSeg([wa, wb], espRodape), 0.02, 0.115, rodape,
                   null, U2, LUZ && cinco(f => LUZ.rodape(i, f)), true,
                   semPontas, undefined, {
                     3: w.remateA != null ? [...cortesDaPonta(i,3,espRodape,.02,.115), cortaMiolo] : [],
                     1: w.remateB != null ? [...cortesDaPonta(i,1,espRodape,.02,.115), cortaMiolo] : []
                   });
      }
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

/* `m.estilo` escolhe o PAR modulo+braco (`sofa_mod_<estilo>`); estilo que a biblioteca
   nao tem cai no par padrao, entao registro antigo e lib antiga continuam montando. */
function sofaParam(m) {
  const L = getLib(), e = m.estilo && L["sofa_mod_" + m.estilo] ? "_" + m.estilo : "";
  const MOD = "sofa_mod" + e, BRACO = "sofa_braco" + e;
  if (!L[MOD] || !L[BRACO]) return [];
  const bw = L[BRACO].b[0], mw0 = L[MOD].b[0];
  const h0 = L[MOD].b[1], d0 = L[MOD].b[2];
  const w = Math.max(2 * bw + 0.62, m.w);
  const sy = m.h / h0, sz = m.d / d0;
  const util = w - 2 * bw;
  const n = Math.max(1, Math.min(5, Math.round(util / 0.785)));
  const mw = util / n;
  const P = [];
  for (let i = 0; i < n; i++)
    P.push({ malha:MOD, x: -w/2 + bw + mw * (i + 0.5), sx: mw / mw0, sy, sz });
  for (const s of [-1, 1])
    P.push({ malha:BRACO, x: s * (w/2 - bw/2), sx: s, sy, sz });
  return P;
}

    return {geoDeParts, armarioParam, bancadaParam, aereoParam, ripadoParam, rackParam, tvParam, boxParam, maquinaParam, sofaParam};
  }
  root.FurnitureParam = Object.freeze({create});
})(globalThis);

/* Furniture catalog: names, factory colours and measures, the Blender mesh library and one Group per piece. */
(function(root) {
  "use strict";
  function create({THREE, document, rgbDe, geoDeParts, getMaterial,
                   armarioParam, bancadaParam, aereoParam, ripadoParam, rackParam, tvParam, boxParam, maquinaParam, sofaParam}) {
/* ---- catálogo de móveis -----------------------------------------------
   Só nome, cor de fábrica e o nome da MALHA em `moveis/moveis_lib.json`. A caixa
   envolvente `b` que está escrita aqui é substituída pela MEDIDA da geometria assim
   que a biblioteca carrega -- `atualizaMovel` escala por ela, e número digitado
   contra malha que mede outra coisa foi o que deixou a chaminé da coifa boiando. */
const MOVEIS = {
  cama:      { nome:"Cama",      b:[1.45,0.95,2.05], cor:0x8A7660, malha:"cama" },
  /* O sofa nao e mais caixa. As almofadas eram `E(...)` -- ELIPSOIDE achatado -- e
     por isso pegavam o brilho do teto inteiro e liam como duas pocas de leite dentro
     de um caixote. Almofada e caixa MUITO arredondada (bevel de 5 cm + uma subdivisao),
     e isso nao se monta a mao aqui: vem de `moveis/moveis.py`, gerada no Blender.
     Continua UMA chamada de desenho -- a malha e a mesma forma indexada da arvore.
     `b` sai MEDIDA da geometria, nao digitada (era o que produzia o bug da coifa). */
  sofa:      { nome:"Sofá",      param:sofaParam, b:[1.96,0.80,0.92], cor:0x4A5A6B },
  mesa:      { nome:"Mesa",      b:[1.40,0.76,0.85], cor:0x9A7A55, malha:"mesa" },
  cadeira:   { nome:"Cadeira",   b:[0.46,0.92,0.48], cor:0x7C6A55, malha:"cadeira" },
  armario:   { nome:"Armário",   b:[1.20,2.10,0.58], cor:0x6E5B47, param:armarioParam },
  estante:   { nome:"Estante",   b:[0.95,1.85,0.34], cor:0x7D6949, malha:"estante" },
  geladeira: { nome:"Geladeira", b:[0.68,1.78,0.68], cor:0xC6CBD0, malha:"geladeira" },
  fogao:     { nome:"Fogão",     b:[0.62,0.92,0.62], cor:0xD3D7DB, malha:"fogao" },
  pia:       { nome:"Bancada",   b:[1.30,0.92,0.60], cor:0x8E9299, param:bancadaParam },
  vaso:      { nome:"Vaso",      b:[0.40,0.80,0.66], cor:0xF0F2F4, malha:"vaso" },
  tv:        { nome:"TV",        b:[1.15,0.78,0.26], cor:0x22262B, param:tvParam },
  /* v16.1: a parede da TV. `alto` porque as três dividem o mesmo lugar na
     parede -- o ripado é pele de parede, o rack fica embaixo e a TV pendurada
     em cima; sem isso qualquer uma delas acusa colisão com as outras duas. */
  ripado:    { nome:"Painel ripado", b:[2.40,2.40,0.05], cor:0x8A6A45, param:ripadoParam, alto:1 },
  rack:      { nome:"Rack",      b:[1.80,0.70,0.38], cor:0x3A3F45, param:rackParam, alto:1 },
  /* ---- v15.1: as pecas que faltavam pra um comodo parecer habitado ----------
     Todas seguem as duas convencoes do catalogo, e nenhuma delas e obvia lendo o
     codigo: a origem e o centro do CHAO da peca (x/z sao deslocamento, y e a BASE
     da caixa), e a FRENTE de todo movel e o +Z. `encosta()` no `mobiliar.py`
     depende das duas -- movel com a frente pro outro lado encosta a porta na
     parede e mostra o fundo pro comodo.

     `b` e a caixa envolvente contada DO CHAO, mesmo em peca pendurada: o aereo
     mede 2,20 de altura, nao 0,70, porque `atualizaMovel` escala por `b` e uma
     altura relativa faria o armario descer junto quando alguem mudasse a medida. */
  aereo:     { nome:"Aéreo",     b:[1.20,2.20,0.35], cor:0x7C8466, param:aereoParam, alto:1 },
  /* A chamine vai ate o TETO. Com b[1]=2.10 ela parava 60 cm abaixo de PD e ficava
     uma caixa boiando -- e o defeito nao aparece na vista de planta, so andando. */
  coifa:     { nome:"Coifa",     b:[0.60,2.70,0.50], cor:0x3A3E44, malha:"coifa", alto:1 },
  balcao:    { nome:"Balcão",    b:[1.00,0.92,0.60], cor:0x7C8466, param:bancadaParam },
  guardaroupa:{ nome:"Guarda-roupa", b:[2.00,2.35,0.60], cor:0xE8E4DC, param:armarioParam },
  criado:    { nome:"Criado-mudo", b:[0.45,0.55,0.40], cor:0x8A7660, malha:"criado" },
  /* Cortina: DOIS paineis abertos, nao um pano fechado. Fechado ela tapa a janela --
     que e a coisa que mais ilumina e a unica vista que o apartamento tem. Aberta ela
     faz o que a cortina faz numa foto de anuncio: da escala e tecido a uma parede
     que so tinha vidro. */
  cortina:   { nome:"Cortina",   b:[1.90,2.40,0.12], cor:0xC9BFAE, malha:"cortina", alto:1 },
  /* v16.2: as duas pecas da lista minima da NBR 15575-1 que faltavam. `alto` no
     box porque ele vai do chao ao teto e nao disputa lugar com bancada nenhuma. */
  box:       { nome:"Box",       b:[0.80,2.00,0.80], cor:0xE8E9EA, param:boxParam, alto:1 },
  maquina:   { nome:"Máquina de lavar", b:[0.60,0.85,0.65], cor:0xE4E6E8, param:maquinaParam },
  tapete:    { nome:"Tapete",    b:[2.20,0.02,1.60], cor:0x6B5A63, malha:"tapete" }
};
const MOVEL_KEYS = Object.keys(MOVEIS);

/* O móvel vira um Group de uma ou duas malhas: o corpo, e -- só se houver peça
   marcada `met` -- as partes cromadas. Metal precisa de material próprio (metalness
   alto não é cor, é modelo de reflexão) e material próprio é chamada de desenho
   própria; por isso vale só pra torneira, puxador e trilho, não peça a peça. */
/* Biblioteca de moveis modelados no Blender (`moveis/moveis_lib.json`), na mesma
   forma indexada da biblioteca de arvores: posicao em cm inteiro, normal em int8,
   cor em byte, mais um bit `herda` por vertice -- a peca marcada assim usa a cor que
   a pessoa escolheu no cadastro, o resto (pe, ferragem) mantem a propria. */
const MOVEIS_LIB = (() => {
  const el = document.getElementById("__moveis");
  let d = {};
  try { d = JSON.parse(el.textContent) || {}; } catch (e) {}
  const pecas = d.pecas || {};
  // A caixa envolvente do catalogo vem da MALHA, nao de numero digitado: `atualizaMovel`
  // escala por ela, e declarar 2,10 pra uma geometria de 2,70 foi exatamente o que
  // deixou a chamine da coifa boiando 60 cm abaixo do teto.
  for (const k in pecas) if (MOVEIS[k] && pecas[k].b) MOVEIS[k].b = pecas[k].b;
  return pecas;
})();

function geoDaLib(nome, corHex) {
  const d = MOVEIS_LIB[nome];
  if (!d) return null;
  const n = d.verts, P = new Float32Array(n*3), N = new Float32Array(n*3), C = new Uint8Array(n*3);
  const rgb = rgbDe(corHex);
  for (let i = 0; i < n; i++) {
    P[i*3] = d.pos_cm[i*3]/100; P[i*3+1] = d.pos_cm[i*3+1]/100; P[i*3+2] = d.pos_cm[i*3+2]/100;
    N[i*3] = d.nrm_127[i*3]/127; N[i*3+1] = d.nrm_127[i*3+1]/127; N[i*3+2] = d.nrm_127[i*3+2]/127;
    const h = d.herda[i];
    C[i*3] = h ? rgb[0] : d.col[i*3];
    C[i*3+1] = h ? rgb[1] : d.col[i*3+1];
    C[i*3+2] = h ? rgb[2] : d.col[i*3+2];
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(P, 3));
  g.setAttribute("normal",   new THREE.BufferAttribute(N, 3));
  g.setAttribute("color",    new THREE.BufferAttribute(C, 3, true));
  g.setIndex(d.verts > 65535 ? new THREE.Uint32BufferAttribute(d.idx, 1)
                             : new THREE.Uint16BufferAttribute(d.idx, 1));
  g.computeBoundingSphere();
  const m = new THREE.Mesh(g, getMaterial());
  m.castShadow = true; m.receiveShadow = true;
  const gr = new THREE.Group(); gr.add(m);
  return gr;
}

function geoDoMovel(def, corHex, m) {
  if (def.param) {
    const malha = new THREE.Mesh(geoDeParts(def.param(m || medidaPadrao(def)), corHex), getMaterial());
    malha.castShadow = true; malha.receiveShadow = true;
    const gr = new THREE.Group(); gr.add(malha);
    return gr;
  }
  const g = geoDaLib(def.malha, corHex);
  // Biblioteca ausente (cidade montada sem `moveis_lib.json`) devolve grupo vazio
  // em vez de quebrar: o movel some, a casa continua de pe.
  return g || new THREE.Group();
}
const medidaPadrao = def => ({ w:def.b[0], h:def.b[1], d:def.b[2] });

    return {MOVEIS, MOVEL_KEYS, MOVEIS_LIB, geoDoMovel};
  }
  root.FurnitureCatalog = Object.freeze({create});
})(globalThis);

(function(global){
global.corrigirNormaisCasaLiv=function(grupo,ctx){
  var report={verticalTriangles:0,opposedBefore:0,opposedAfter:0,flippedVertices:0,
    positionsChanged:false,floorsCeilingFurnitureChanged:false};
  var nativeFlips=new Set();
  // gl[0] é a identidade da malha P/N de paredes+rodapés no contexto do builder,
  // anterior aos pisos e às esquadrias. Openings tem winding inverso, N correta.
  var paredes=ctx && ctx.gl ? ctx.gl[0] : grupo.children.find(o=>o.isMesh && o.userData.casa);
  grupo.traverse(function(mesh){
    if(mesh!==paredes)return;
    var g=mesh.geometry,p=g.attributes.position,n=g.attributes.normal;
    if(!p || !n)return;
    var old=new Float32Array(n.array),flip=new Set(),triangles=[];
    var indices=g.index?g.index.array:null,count=indices?indices.length:p.count;
    for(var i=0;i<count;i+=3){
      var a=indices?indices[i]:i,b=indices?indices[i+1]:i+1,c=indices?indices[i+2]:i+2;
      var ab=[p.getX(b)-p.getX(a),p.getY(b)-p.getY(a),p.getZ(b)-p.getZ(a)];
      var ac=[p.getX(c)-p.getX(a),p.getY(c)-p.getY(a),p.getZ(c)-p.getZ(a)];
      var cross=[ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0]];
      var length=Math.hypot.apply(null,cross);if(length<1e-10)continue;
      var ny=(old[a*3+1]+old[b*3+1]+old[c*3+1])/3;
      if(Math.abs(ny)>.05 || Math.abs(cross[1]/length)>.05)continue;
      var dot=cross[0]*old[a*3]+cross[1]*old[a*3+1]+cross[2]*old[a*3+2];
      triangles.push({a:a,b:b,c:c,cross:cross});report.verticalTriangles++;
      if(dot<0){report.opposedBefore++;flip.add(a);flip.add(b);flip.add(c);}
    }
    flip.forEach(function(v){n.setXYZ(v,-old[v*3],-old[v*3+1],-old[v*3+2]);});
    triangles.forEach(function(t){
      if(t.cross[0]*n.getX(t.a)+t.cross[1]*n.getY(t.a)+t.cross[2]*n.getZ(t.a)<-1e-10)report.opposedAfter++;
    });
    report.flippedVertices+=flip.size;if(flip.size)n.needsUpdate=true;
    // A fila nativa tem os mesmos vértices tesselados; seu fallback deve traçar
    // a mesma normal corrigida, em vez de amostrar o miolo da parede.
    var m=ctx && ctx.gl?ctx.gl.indexOf(mesh):-1;
    if(m>=0){
      var data=ctx.malhas[m];for(var j=0;j<n.array.length;j++)data.N[j]=n.array[j];
      flip.forEach(function(v){nativeFlips.add(ctx.idx[m][v]);});
    }
  });
  if(ctx)nativeFlips.forEach(function(k){ctx.nrm[k*3]=-ctx.nrm[k*3];ctx.nrm[k*3+1]=-ctx.nrm[k*3+1];ctx.nrm[k*3+2]=-ctx.nrm[k*3+2];});
  if(report.opposedAfter)throw Error('Normal vertical LIV ainda oposta ao winding.');
  grupo.userData.livNormalRepair=report;return report;
};

})(globalThis);

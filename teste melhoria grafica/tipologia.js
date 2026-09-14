/* ============================================================
   Tipologia: do contorno + altura + classe para um arquétipo
   ============================================================
   O Overture (e o OSM por baixo dele) entrega polígono e, às vezes, altura.
   Nunca entrega "como esse prédio se parece". Todo gerador que precisa
   renderizar o mundo inteiro resolve isso do mesmo jeito: deriva um ARQUÉTIPO
   a partir do que dá pra medir no próprio dado — área, proporção do retângulo
   mínimo, número de pavimentos, classe de uso — e deixa um sorteio
   DETERMINÍSTICO (hash da posição) escolher as variações dentro do arquétipo.

   Determinístico importa: o mesmo prédio precisa sair igual em toda sessão e
   sobreviver a uma atualização da base. É o papel que o GERS ID cumpre no
   Overture; aqui o substituto é o centroide quantizado, que só muda se o
   contorno mudar de verdade.
   ============================================================ */

const ST = { CASA:0, SOBRADO:1, PREDIO:2, COMERCIO:3, TORRE:4, GALPAO:5, CIVICO:6, ANEXO:7 };
const ST_NOME = ["Casa térrea", "Sobrado", "Prédio residencial", "Comércio",
                 "Torre comercial", "Galpão", "Institucional", "Anexo"];

/* --- retângulo mínimo orientado (OBB) -----------------------------------
   Serve pra duas coisas: dar eixo e proporção pro telhado inclinado, e medir
   o quanto o contorno REALMENTE é um retângulo (`rect`). Contorno de casa no
   OSM quase sempre é; contorno digitalizado por ML raramente é. É esse número
   que decide quem ganha telhado de duas águas e quem cai pra laje — em vez de
   inventar um telhado torto sobre um polígono que não comporta. */
function convexHull(pts) {
  if (pts.length < 4) return pts.slice();
  const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0]-o[0])*(b[1]-o[1]) - (a[1]-o[1])*(b[0]-o[0]);
  const lo = [], up = [];
  for (const q of p) { while (lo.length >= 2 && cross(lo[lo.length-2], lo[lo.length-1], q) <= 0) lo.pop(); lo.push(q); }
  for (let i = p.length-1; i >= 0; i--) { const q = p[i];
    while (up.length >= 2 && cross(up[up.length-2], up[up.length-1], q) <= 0) up.pop(); up.push(q); }
  lo.pop(); up.pop();
  return lo.concat(up);
}

function obbOf(r, area) {
  const H = convexHull(r);
  let best = null;
  if (H.length >= 3) {
    for (let i = 0; i < H.length; i++) {                 // uma direção por aresta do casco
      const a = H[i], b = H[(i+1) % H.length];
      let ex = b[0]-a[0], ez = b[1]-a[1];
      const L = Math.hypot(ex, ez); if (L < 1e-6) continue;
      ex /= L; ez /= L;
      let u0 = 1e9, u1 = -1e9, v0 = 1e9, v1 = -1e9;
      for (const p of H) {
        const u = p[0]*ex + p[1]*ez, v = -p[0]*ez + p[1]*ex;
        if (u < u0) u0 = u; if (u > u1) u1 = u;
        if (v < v0) v0 = v; if (v > v1) v1 = v;
      }
      const A = (u1-u0) * (v1-v0);
      if (!best || A < best.A) best = { A, ex, ez, u0, u1, v0, v1 };
    }
  }
  if (!best) {                                            // degenerado: cai pro AABB
    let x0=1e9,x1=-1e9,z0=1e9,z1=-1e9;
    for (const p of r) { x0=Math.min(x0,p[0]); x1=Math.max(x1,p[0]); z0=Math.min(z0,p[1]); z1=Math.max(z1,p[1]); }
    best = { A:(x1-x0)*(z1-z0), ex:1, ez:0, u0:x0, u1:x1, v0:z0, v1:z1 };
  }
  const cu = (best.u0+best.u1)/2, cv = (best.v0+best.v1)/2;
  let hu = (best.u1-best.u0)/2, hv = (best.v1-best.v0)/2;
  let ux = best.ex, uz = best.ez;
  if (hv > hu) { const t = hu; hu = hv; hv = t;            // eixo maior sempre em u
                 const tx = ux; ux = -uz; uz = tx; }
  return {
    cx: cu*best.ex - cv*best.ez, cz: cu*best.ez + cv*best.ex,
    ux, uz, hu, hv,
    rect: best.A > 1e-6 ? Math.min(1, area / best.A) : 0,  // 1 = retângulo perfeito
    elong: hv > 1e-6 ? hu/hv : 1
  };
}

/* --- arquétipo ----------------------------------------------------------
   A ordem das regras é a ordem da confiança: o que veio etiquetado no dado
   manda, e a geometria só decide o resto — que aqui é a maioria, porque em
   São Carlos a classe do city.json é "sem uso mapeado" na maior parte do
   acervo. É exatamente esse buraco que faz uma cidade inteira virar caixa
   cinza se ninguém preencher. */
function tipoDe(cls, h, area, ob) {
  const pav = Math.max(1, Math.round((h - 1.1) / 3.15));
  if (area < 34 && h < 4.4) return ST.ANEXO;                        // garagem, edícula, puxadinho
  if (cls === 3) return ST.CIVICO;
  if (area > 700 && pav <= 2 && ob.rect > 0.70) return ST.GALPAO;   // barracão: grande, baixo e retangular
  if (cls === 2) return pav >= 8 ? ST.TORRE : ST.COMERCIO;
  if (cls === 1) return pav >= 4 ? ST.PREDIO : pav >= 2 ? ST.SOBRADO : ST.CASA;
  if (pav >= 8) return ST.TORRE;
  if (pav >= 4) return ST.PREDIO;
  if (area > 420) return ST.COMERCIO;
  return pav >= 2 ? ST.SOBRADO : ST.CASA;
}

/* --- paleta -------------------------------------------------------------
   Uma cor por arquétipo mataria a monotonia e criaria outra: oito cores em vez
   de uma. Então cada arquétipo tem um LEQUE, o hash escolhe dentro dele, e
   ainda leva um empurrão de luminosidade. O resultado é vizinho diferente de
   vizinho sem que o bairro perca identidade. */
const PAL = [
  { wall:[0xEFE7D8,0xE8ECE6,0xDCE4EC,0xF0E2CC,0xE6DED4,0xD9E3D8], roof:0xB2573A, telha:1 },  // CASA
  { wall:[0xEAE1D0,0xDFE6EA,0xEDE6DA,0xE2DACE,0xD7DFE6],          roof:0xA75033, telha:1 },  // SOBRADO
  { wall:[0xDCDFE3,0xE4E1DA,0xD2D8DE,0xE7E4DD,0xCFD6D9],          roof:0x6E757D, telha:0 },  // PREDIO
  { wall:[0xE6E3DC,0xE9DED2,0xDDE3E7,0xEFEAE0,0xD8DCD6],          roof:0x6A7079, telha:0 },  // COMERCIO
  { wall:[0xB9C4CE,0xAFBCC7,0xC3CBD2,0xA8B6C2],                   roof:0x5C646E, telha:0 },  // TORRE
  { wall:[0xC9CFD4,0xD5D8D6,0xBFC7CD,0xDCDEDB],                   roof:0x8B939B, telha:2 },  // GALPAO
  { wall:[0xEDE9E0,0xE3E7EA,0xF0EADF,0xDFE4E2],                   roof:0x7A6F66, telha:0 },  // CIVICO
  { wall:[0xD8D5CE,0xCFD4D6,0xDEDAD2],                            roof:0x8A8079, telha:0 }   // ANEXO
];

/* Platibanda por arquétipo. É o detalhe mais barato e mais brasileiro que
   existe: a parede sobe além da laje e esconde a cobertura. Sem ela, prédio de
   laje vira caixa cortada a faca — que é o visual de hoje. */
const PLATIBANDA = [0.45, 0.55, 1.15, 0.95, 1.45, 0.35, 1.20, 0.30];

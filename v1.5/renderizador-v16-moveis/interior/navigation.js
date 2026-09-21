/* Interior walking: collision with walls, open leaves and furniture, clearance, sight lines and the entry pose. */
(function(root) {
  "use strict";
  function create({INT, dentroDaPlanta, paraUV, MOVEIS, ESP, RAIO, OLHO}) {
function folga(x, z) {
  let d = 1e9;
  const per = (r) => {
    for (let i = 0, j = r.length-1; i < r.length; j = i++) {
      const ax = r[j][0], az = r[j][1], dx = r[i][0]-ax, dz = r[i][1]-az;
      const L2 = dx*dx + dz*dz || 1;
      let t = ((x-ax)*dx + (z-az)*dz) / L2;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      d = Math.min(d, Math.hypot(ax + dx*t - x, az + dz*t - z));
    }
  };
  for (const c of INT.pl.contorno) per(c);
  for (const g of INT.pl.paredes) if (g.y0 < 1.2) per([g.a, g.b, g.b, g.a]);
  return d;
}
function livre(x, z) {
  if (!dentroDaPlanta(INT.pl, x, z)) return false;
  const lim = ESP/2 + RAIO;
  for (const s of INT.pl.paredes) {
    // Verga e bandeira de janela passam por cima da cabeça: não são obstáculo.
    if (s.y0 >= 1.2) continue;
    const ax = s.a[0], az = s.a[1], dx = s.b[0]-ax, dz = s.b[1]-az;
    const L2 = dx*dx + dz*dz || 1, L = Math.sqrt(L2);
    // A ponta que encosta num VÃO recua 14 cm. Sem isso porta de 70 cm é intransitável:
    // meia parede mais o raio do corpo pedem 36,5 cm de folga de cada lado, e o vão
    // inteiro só tem 35 -- a colisão fechava a porta que o desenho tinha aberto.
    const ra = s.pa ? 0.14/L : 0, rb = s.pb ? 0.14/L : 0;
    let t = ((x-ax)*dx + (z-az)*dz) / L2;
    t = t < ra ? ra : t > 1-rb ? 1-rb : t;
    const px2 = ax + dx*t - x, pz2 = az + dz*t - z;
    if (px2*px2 + pz2*pz2 < lim*lim) return false;
  }
  // A folha aberta também barra -- ela ocupa o canto do cômodo, não o vão. Raio menor
  // que o da parede de propósito: é chapa de 3,5 cm, e o corpo raspa nela sem drama;
  // com o raio cheio a passagem de 70 cm fecharia de novo, agora pela porta.
  for (const v of (INT.pl.esquadrias || [])) {
    const f = v.folha;
    if (!f) continue;
    const ax = f.x + f.dx*0.12, az = f.z + f.dz*0.12;
    const dx = f.dx*(f.larg-0.12), dz = f.dz*(f.larg-0.12);
    const L2 = dx*dx + dz*dz || 1;
    let t = ((x-ax)*dx + (z-az)*dz) / L2;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const px2 = ax + dx*t - x, pz2 = az + dz*t - z;
    if (px2*px2 + pz2*pz2 < 0.215*0.215) return false;
  }
  // Movel tambem e obstaculo, e o teste sai de graca: o giro de um movel e em
  // QUARTOS de volta sobre o eixo do OBB, entao no referencial (u,v) todo movel
  // e uma caixa alinhada aos eixos. Tapete (baixo) nao atrapalha ninguem.
  const uv = paraUV(x, z);
  for (const m of INT.moveis) {
    // Peca `alto` nao ocupa o CHAO: aereo e coifa estao acima da cabeca, cortina e
    // ripado sao pele de parede, TV pendurada idem. Todas tinham caixa envolvente
    // contada do chao (ver a nota do `aereo` no catalogo) e por isso barravam quem
    // andava -- a cortina roubava uma faixa de 60 cm em frente a toda janela, e num
    // quarto de 8 m2 isso e a diferenca entre passar e nao passar. Medido: a mancha
    // andavel do Quarto 1 estava em 0,86 m2 de 8,3.
    if (m.h < 0.35 || (MOVEIS[m.tipo] && MOVEIS[m.tipo].alto)) continue;
    const par = m.rot % 2 === 0;
    if (Math.abs(uv[0] - m.u) < (par ? m.w : m.d)/2 + RAIO*0.8 &&
        Math.abs(uv[1] - m.v) < (par ? m.d : m.w)/2 + RAIO*0.8) return false;
  }
  return true;
}
/* Nascer no centro do maior comodo parece obvio e e ruim: a camera abre a 1 m de
   uma parede, ou dentro do sofa. O que se quer e a posicao de quem acabou de
   ENTRAR num comodo -- encostada numa ponta, olhando pra ele inteiro. Daí a
   busca: entre os pontos livres da sala, o MAIS LONGE do centro que ainda tenha
   meio metro de folga em volta; a mira vai pro centro. */
// Entra-se pela SALA, nao pelo maior comodo. Num apartamento a suite costuma ser o
// maior ambiente, e abrir a visita dentro do quarto de casal e estranho.
function comodoDeEntrada(pl) {
  for (const c of pl.comodos) if (/^(sala|estar|living)/i.test(c.nome)) return c;
  for (const c of pl.comodos) if (/^(jantar|copa)/i.test(c.nome)) return c;
  return pl.comodos[0];
}
/* Pra onde olhar ao entrar. Mirar no centro do comodo aponta pra parede mais perto;
   mirar no centro do apartamento aponta pra parede do quarto vizinho. O que se quer e
   a LINHA DE VISAO MAIS LONGA que existe do ponto onde se esta -- num apartamento ela
   costuma varrer sala e jantar de ponta a ponta, que e exatamente o que se mostra pra
   quem chega. Trinta e seis direcoes, marcha de 20 cm, a mais longa ganha. */
function visivel(x, z) {
  if (!dentroDaPlanta(INT.pl, x, z)) return false;
  for (const w of INT.pl.paredes) {
    if (w.y0 > OLHO || w.y1 < OLHO) continue;      // verga e peitoril nao tapam a vista
    const ax = w.a[0], az = w.a[1], dx = w.b[0]-ax, dz = w.b[1]-az;
    const L2 = dx*dx + dz*dz || 1;
    let t = ((x-ax)*dx + (z-az)*dz) / L2;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const px2 = ax + dx*t - x, pz2 = az + dz*t - z;
    if (px2*px2 + pz2*pz2 < (ESP/2 + 0.03)*(ESP/2 + 0.03)) return false;
  }
  return true;
}
function melhorDirecao(x, z) {
  let bdx = 0, bdz = -1, best = -1;
  for (let k = 0; k < 36; k++) {
    const a = k * Math.PI / 18, dx = Math.sin(a), dz = Math.cos(a);
    let t = 0.25;
    while (t < 16 && visivel(x + dx*t, z + dz*t)) t += 0.25;
    if (t > best) { best = t; bdx = dx; bdz = dz; }
  }
  return Math.atan2(-bdx, -bdz);   // camera olha em -Z girado por yaw
}
function pontoDeEntrada(pl) {
  const sala = comodoDeEntrada(pl), f = sala.f;
  let melhor = null, score = -1;
  for (let u = f.u0 + 0.25; u < f.u1; u += 0.25)
    for (let v = f.v0 + 0.25; v < f.v1; v += 0.25) {
      const p = pl.W(u, v);
      if (!livre(p[0], p[1]) || folga(p[0], p[1]) < 0.5) continue;
      const d = Math.hypot(p[0]-sala.cx, p[1]-sala.cz);
      if (d > score) { score = d; melhor = p; }
    }
  if (melhor) return melhor;
  for (const c of pl.comodos) if (livre(c.cx, c.cz)) return [c.cx, c.cz];
  return [sala.cx, sala.cz];
}

    return {folga, livre, comodoDeEntrada, visivel, melhorDirecao, pontoDeEntrada};
  }
  root.InteriorNavigation = Object.freeze({create});
})(globalThis);

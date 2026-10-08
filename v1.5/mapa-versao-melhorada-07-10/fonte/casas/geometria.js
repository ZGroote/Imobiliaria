/* Casas procedurais: do plano (casas/formato.js) aos triângulos, em três níveis de detalhe.

   Roda no navegador (fio principal ou Worker) e no Node, SEM THREE: escreve em arrays
   tipados que crescem, e quem chama monta a BufferGeometry (fonte/world/casas-mundo.js).
   Carregar antes: casas/sorteio.js e casas/formato.js.

     const casa = CasasGeometria.criaSaida(), chao = CasasGeometria.criaSaida();
     for (const c of arq.casasDoQuarteirao(q)) CasasGeometria.expande(c, nivel, casa, chao, arq.regras);
     // casa.nVertices, casa.nIndices; casa.pos.subarray(0, 3 * casa.nVertices) ...
     CasasGeometria.reinicia(casa)            // zera os contadores e reaproveita os buffers

   `expande(casa, nivel, saida[, saidaChao][, regras][, opcoes])`
     nivel     0 perto (≈600-1.500 triângulos), 1 meia distância (≈40-80), 2 longe (≈12-24).
     saidaChao se vier, recebe grama, piso e piscina (material de chão do mapa, com
               polygonOffset e relevo POR VÉRTICE). Sem ela, o chão vai para `saida`, com
               face.v = -2 e já inclinado pelo declive do plano (a casa inteira é rígida).
     regras    o JSON de regras embutido no casas.bin (arq.regras). Obrigatório, a não ser
               que `usaRegras(regras)` tenha sido chamado antes.
     opcoes    { exagero }: multiplica o declive do plano quando a geometria precisa saber
               onde está o chão (pé de parede, degrau de muro). O mapa exagera o relevo
               (TERRAIN_EXAG = 4,5 em fonte/app.js); sem isto a casa ficaria no ar no fundo
               do lote em declive. Padrão 1.
   Devolve o número de triângulos escritos.

   ATRIBUTOS, por vértice (mesmo contrato da fachada de fonte/world/buildings.js:250-300 e
   fonte/materials/facades.js):
     pos     Float32 xyz  metros do MAPA (x leste, z sul), já girado e posto na origem.
                          Y = 0 é o terreno na testada; o renderizador soma o relevo.
     nor     Int8 xyz     normal para FORA, normalizada (×127).
     cor     Uint8 rgb    cor da superfície, já com a sombra de canto feita por vértice.
     face    Float32 uv   parede: (metros ao longo da face, altura em metros, >= 0).
                          telhado/laje: (0, -1), como hoje. chão: (0, -2).
     estilo  Uint16 ×3    (tipo da tipologia, semente & 255, altura útil em dm). Tipo 0 casa
                          térrea, 1 sobrado, 7 anexo (edícula, garagem): o ST de
                          fonte/world/building-type.js, que é o que a fachada já entende.
     janela  Uint8 ×4     onde a regra DEIXA pôr janela, para o shader pintar no LOD1:
                            [0] máscara de vãos com janela (bit k = vão k a partir do início
                                da face; a janela fica centrada no vão)
                            [1] largura do vão estrutural, em unidades de 2 cm
                            [2] largura da janela, em unidades de 2 cm
                            [3] (tipo << 6) | piso do pavimento em dm (0..63)
                                tipo 0 sem janela, 1 janela (peitoril e verga das regras),
                                2 basculante, 3 vidro de verdade (LOD0: o shader só dá o
                                brilho, não pinta nada)
     semJanela Uint8      a mesma informação no código que fonte/materials/facades.js já lê
                          (aSemJanela): 0 janela pintada, 1 face cega, 2 janela é geometria
                          (LOD0), 3 basculante alto. Fica até o material definitivo ler `janela`.
     base    Float32 xz   ponto do relevo da casa inteira (presetCenter). É o MEIO DA
                          TESTADA, e não o centro da casa: Y = 0 é o chão ali, e o declive do
                          plano já desce a parede e o muro até o chão do resto do lote. Com o
                          centro, a frente de uma casa num lote de 10% ficaria 1 m fora do chão.
     idx     Uint32       triângulos indexados, enrolamento anti-horário visto de fora.
   Sem DoubleSide: toda face tem o enrolamento que a normal pede (ver `quad`).

   POR QUE A MOLDURA ESPELHA
   (u, v) é a moldura do lote: u ao longo da testada, à direita de quem olha da rua, v
   entrando no lote. No mapa ela é espelhada (det [U V] = -1), então um triângulo que é
   anti-horário em (u, y, v) sai horário no mundo. `quad` e `poligono` decidem a ordem
   pela normal pedida e por isso nada aqui precisa lembrar disso.

   O QUE CADA NÍVEL DESENHA
     LOD0  parede com vão de verdade (janela recuada, peitoril, requadro, caixilho, porta),
           rodapé, soleira, empena, beiral com forro, testeira e cumeeira, telhados em L e T
           unidos (rincão sem água atravessando a outra), platibanda com rufo/capa, caixa
           de laje aberta (garagem e varanda), garagem leve (pergolado ou telha), edícula,
           caixa d'água aparente ou torre, muros com capa e pilaretes (em degraus no
           declive), gradil, portões, piso de entrada, grama e piscina.
     LOD1  volumes, empena, telhado correto com testeira, janelas pelo atributo `janela`,
           porta como placa, muros como caixa, grama e entrada de carro.
     LOD2  caixa do corpo com o telhado, alas com tampa na cor da telha, lote numa peça.

   TELHADO EM L E T (regra 4 da ESPEC)
   Cada retângulo cerâmico tem o seu telhado com o MESMO beiral e a MESMA inclinação:
   h = base + i × (distância à linha de parede de cada lado "de água"), o mínimo entre os
   lados (quatro águas, duas águas e meia-água são o mesmo desenho com outros lados).
   A ala se estende para dentro do corpo até a metade dele: é o retângulo máximo da planta
   em L, e é isso que faz a cumeeira da ala morrer na água do corpo com dois rincões, em
   vez de um espigão virado para o corpo. Onde as duas lajes de telhado se sobrepõem, a
   parte da ala que fica DENTRO da laje do corpo (ou coplanar com ela, na lateral alinhada)
   é recortada em planta; o corpo não é recortado. Assim não sobra plano duplicado (sem
   z-fighting), a água da ala nunca passa por baixo da do corpo, e no rincão o plano do
   corpo continua por baixo do corte, então não abre fresta. Testeira, forro e cumeeira
   seguem a mesma regra, cada um no seu plano.

   Números de cidade (recuo, alturas, larguras, cores) vêm das regras. VISUAL abaixo é só
   aparência e folgas contra z-fighting, que não são regra de construção. */
(function (root) {
  "use strict";

  const Formato = () => {
    const f = root.CasasFormato;
    if (!f) throw new Error("CasasGeometria precisa de casas/formato.js carregado antes");
    return f;
  };
  const Sorteio = () => {
    const s = root.CasasSorteio;
    if (!s) throw new Error("CasasGeometria precisa de casas/sorteio.js carregado antes");
    return s;
  };

  /* Aparência e folgas (m). Nenhum destes é número de lei ou de prática de São Carlos:
     são espessuras de peça, sobras de acabamento e as distâncias mínimas para duas
     superfícies não dividirem o mesmo plano. */
  const VISUAL = Object.freeze({
    enterra: 0.5,                 // quanto parede e muro descem abaixo do chão (relevo irregular)
    parede: 0.15,                 // espessura de parede: platibanda, caixa aberta, oitão
    rodape: { altura: 0.12, relevo: 0.015 },
    moldura: { largura: 0.05, relevo: 0.015 },
    peitoril: { avanco: 0.035, espessura: 0.04, sobra: 0.035 },
    caixilho: { largura: 0.045, relevo: 0.012 },
    soleira: { meia: 0.6, fundo: 0.38 },
    cumeeira: { meia: 0.12, altura: 0.06, folga: 0.012 },
    oitao: 0.12,                  // empena sem beiral (na divisa) sobe acima da telha
    capa: { sobra: 0.025 },
    friso: { abaixo: 0.10, acima: 0.06, relevo: 0.03 },
    caixa: { viga: 0.32, pilar: 0.20 },
    garagem: { poste: 0.11, viga: 0.16, ripa: 0.06, ripaAlt: 0.10, ripaPasso: 0.48, folga: 0.06, beiral: 0.10 },
    pilarete: { sobe: 0.08, fundo: 0.03 },
    gradil: { barra: 0.022, passo: 0.14, maxBarras: 44, corrimao: 0.04 },
    portao: { espessura: 0.04, chao: 0.03, barraPasso: 0.12, friso: 0.04 },
    muroJitter: 0.001,            // × (semente % 19): vizinhos não dividem o plano do topo do muro
    camadas: { servico: 0.015, rampa: 0.025, caminho: 0.035, agua: 0.05, borda: 0.12 },
    caixaDagua: { proporcao: 0.62, tampa: 0.12, torreFolga: 0.22, torreSobe: 0.7, lados: 8 },
    pilaresMax: 14,               // pilaretes intermediários por lado de muro
    escuroInterno: 0.6,           // fator de cor de superfície dentro de caixa aberta
    cores: {
      vidro: [40, 52, 64], porta: [112, 74, 46], peitoril: [182, 176, 166], concreto: [172, 168, 160],
      embasamento: [146, 142, 134], caixaDagua: [62, 114, 166], madeira: [128, 92, 60],
      branco: [240, 238, 232], borda: [214, 208, 196], soleira: [160, 156, 148]
    }
  });

  const ST_CASA = 0, ST_SOBRADO = 1, ST_ANEXO = 7;

  /* =====================================================================
     SAÍDA: buffers que crescem (dobram) e se reaproveitam entre chamadas
     ===================================================================== */
  const ATRIB = [["pos", Float32Array, 3], ["nor", Int8Array, 3], ["cor", Uint8Array, 3], ["face", Float32Array, 2],
                 ["estilo", Uint16Array, 3], ["janela", Uint8Array, 4], ["semJanela", Uint8Array, 1], ["base", Float32Array, 2]];
  function criaSaida(capacidade) {
    const nv = Math.max(64, (capacidade | 0) || 4096);
    const s = { nVertices: 0, nIndices: 0, capVertices: nv, idx: new Uint32Array(nv * 2) };
    for (const [k, T, n] of ATRIB) s[k] = new T(nv * n);
    return s;
  }
  function reinicia(s) { s.nVertices = 0; s.nIndices = 0; return s; }
  function cresce(s, nv, ni) {
    if (s.nVertices + nv > s.capVertices) {
      let cap = s.capVertices * 2;
      while (s.nVertices + nv > cap) cap *= 2;
      for (const [k, T, n] of ATRIB) { const a = new T(cap * n); a.set(s[k].subarray(0, s.nVertices * n)); s[k] = a; }
      s.capVertices = cap;
    }
    if (s.nIndices + ni > s.idx.length) {
      let cap = s.idx.length * 2;
      while (s.nIndices + ni > cap) cap *= 2;
      const a = new Uint32Array(cap); a.set(s.idx.subarray(0, s.nIndices)); s.idx = a;
    }
  }

  /* =====================================================================
     EMISSOR. Estado do vértice corrente em variáveis do módulo: a casa inteira escreve
     milhares de vértices, e passar cor, estilo e janela em cada chamada custaria mais que
     a conta da posição. Só um fio usa o módulo por vez (navegador ou Worker).
     ===================================================================== */
  let SA = null;                                         // saída corrente
  let OX = 0, OZ = 0, UX = 1, UZ = 0, VX = 0, VZ = -1;   // moldura (u, v) -> mundo
  let BX = 0, BZ = 0;                                    // ponto do relevo
  let CR = 200, CG = 200, CB = 200;                      // cor corrente
  let ET = 0, ES = 0, EH = 0;                            // estilo
  let J0 = 0, J1 = 0, J2 = 0, J3 = 0, SJ = 2;            // janela e semJanela
  let FM = 0, FAU = 0, FAV = 0, FDU = 1, FDV = 0, FOF = 0; // modo de face: 0 parede, 1 telhado, 2 chão
  let AO0 = 0, AO1 = 1, AOK = 1;                         // rampa de cor por altura (sombra do pé)
  let NX8 = 0, NY8 = 127, NZ8 = 0;
  let NTRI = 0;
  const AREA2_MIN = 1e-10;                               // |a×b|² mínimo: triângulo de ~5e-6 m²

  const lim = x => x <= 0 ? 0 : x >= 255 ? 255 : x;
  function cor(c, k) { if (k === undefined) k = 1; CR = lim(c[0] * k); CG = lim(c[1] * k); CB = lim(c[2] * k); }
  const mistura = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const escala = (a, k) => [lim(a[0] * k), lim(a[1] * k), lim(a[2] * k)];
  function modoParede(au, av, du, dv, of) { FM = 0; FAU = au; FAV = av; FDU = du; FDV = dv; FOF = of || 0; }
  function modoTelhado() { FM = 1; }
  function modoChao() { FM = 2; }
  function semAO() { AOK = 1; }
  function comAO(y0, y1, k) { AO0 = y0; AO1 = y1; AOK = k; }
  function janela(a, b, c, d, sj) { J0 = a; J1 = b; J2 = c; J3 = d; SJ = sj; }

  function normal(nu, nv, ny) {
    const x = nu * UX + nv * VX, z = nu * UZ + nv * VZ;
    const k = 127 / (Math.sqrt(x * x + ny * ny + z * z) || 1);
    NX8 = Math.round(x * k); NY8 = Math.round(ny * k); NZ8 = Math.round(z * k);
  }

  function vert(u, v, y) {
    const s = SA, i = s.nVertices++, i3 = i * 3, i2 = i * 2, i4 = i * 4;
    const P = s.pos; P[i3] = OX + u * UX + v * VX; P[i3 + 1] = y; P[i3 + 2] = OZ + u * UZ + v * VZ;
    const N = s.nor; N[i3] = NX8; N[i3 + 1] = NY8; N[i3 + 2] = NZ8;
    let k = 1;
    if (AOK !== 1) k = y <= AO0 ? AOK : y >= AO1 ? 1 : AOK + (1 - AOK) * (y - AO0) / (AO1 - AO0);
    const C = s.cor; C[i3] = CR * k + 0.5; C[i3 + 1] = CG * k + 0.5; C[i3 + 2] = CB * k + 0.5;
    const Fa = s.face;
    if (FM === 0) { Fa[i2] = FOF + (u - FAU) * FDU + (v - FAV) * FDV; Fa[i2 + 1] = y > 0 ? y : 0; }
    else { Fa[i2] = 0; Fa[i2 + 1] = FM === 1 ? -1 : -2; }
    const E = s.estilo; E[i3] = ET; E[i3 + 1] = ES; E[i3 + 2] = EH;
    const J = s.janela; J[i4] = J0; J[i4 + 1] = J1; J[i4 + 2] = J2; J[i4 + 3] = J3;
    s.semJanela[i] = SJ;
    const Bs = s.base; Bs[i2] = BX; Bs[i2 + 1] = BZ;
    return i;
  }

  /* Quadrilátero plano e convexo, cantos 0-1-2-3 em volta (qualquer sentido), em (u, v, y)
     da moldura; (nu, nv, ny) é a normal para FORA na moldura. A ordem dos índices sai do
     sinal entre o produto vetorial (feito na tupla (u, y, v)) e a normal pedida: como a
     moldura é espelhada no mundo, o triângulo é de frente quando esse sinal é NEGATIVO.
     Triângulo de área zero (canto repetido, peça achatada) não é escrito. */
  function quad(u0, v0, y0, u1, v1, y1, u2, v2, y2, u3, v3, y3, nu, nv, ny) {
    const ax = u1 - u0, ay = y1 - y0, az = v1 - v0, bx = u2 - u0, by = y2 - y0, bz = v2 - v0;
    const cx = u3 - u0, cy = y3 - y0, cz = v3 - v0;
    const p1 = ay * bz - az * by, p2 = az * bx - ax * bz, p3 = ax * by - ay * bx;
    const q1 = by * cz - bz * cy, q2 = bz * cx - bx * cz, q3 = bx * cy - by * cx;
    const a1 = p1 * p1 + p2 * p2 + p3 * p3, a2 = q1 * q1 + q2 * q2 + q3 * q3;
    if (a1 < AREA2_MIN && a2 < AREA2_MIN) return;
    const direto = (a1 >= a2 ? p1 * nu + p2 * ny + p3 * nv : q1 * nu + q2 * ny + q3 * nv) < 0;
    cresce(SA, 4, 6);
    normal(nu, nv, ny);
    const i0 = vert(u0, v0, y0), i1 = vert(u1, v1, y1), i2 = vert(u2, v2, y2), i3 = vert(u3, v3, y3);
    const I = SA.idx; let k = SA.nIndices;
    if (a1 >= AREA2_MIN) { I[k++] = i0; if (direto) { I[k++] = i1; I[k++] = i2; } else { I[k++] = i2; I[k++] = i1; } NTRI++; }
    if (a2 >= AREA2_MIN) { I[k++] = i0; if (direto) { I[k++] = i2; I[k++] = i3; } else { I[k++] = i3; I[k++] = i2; } NTRI++; }
    SA.nIndices = k;
  }

  /* Polígono convexo plano, P = [u, v, y, ...] com n pontos. O sentido sai da normal de
     Newell (mesma convenção do `quad`); o leque descarta triângulo de área zero, que é o
     que um ponto colinear deixaria. */
  function poligono(P, n, nu, nv, ny) {
    if (n < 3) return;
    if (n === 4) { quad(P[0], P[1], P[2], P[3], P[4], P[5], P[6], P[7], P[8], P[9], P[10], P[11], nu, nv, ny); return; }
    let Nx = 0, Ny = 0, Nz = 0;
    for (let i = 0; i < n; i++) {
      const j = i + 1 === n ? 0 : i + 1;
      const ui = P[3 * i], vi = P[3 * i + 1], yi = P[3 * i + 2], uj = P[3 * j], vj = P[3 * j + 1], yj = P[3 * j + 2];
      Nx += (yi - yj) * (vi + vj); Ny += (vi - vj) * (ui + uj); Nz += (ui - uj) * (yi + yj);
    }
    if (Nx * Nx + Ny * Ny + Nz * Nz < AREA2_MIN) return;
    const direto = Nx * nu + Ny * ny + Nz * nv < 0;
    cresce(SA, n, 3 * (n - 2));
    normal(nu, nv, ny);
    const b = SA.nVertices;
    for (let i = 0; i < n; i++) vert(P[3 * i], P[3 * i + 1], P[3 * i + 2]);
    const I = SA.idx; let k = SA.nIndices;
    const u0 = P[0], v0 = P[1], y0 = P[2];
    for (let i = 1; i + 1 < n; i++) {
      const ax = P[3 * i] - u0, ay = P[3 * i + 2] - y0, az = P[3 * i + 1] - v0;
      const bx = P[3 * i + 3] - u0, by = P[3 * i + 5] - y0, bz = P[3 * i + 4] - v0;
      const c1 = ay * bz - az * by, c2 = az * bx - ax * bz, c3 = ax * by - ay * bx;
      if (c1 * c1 + c2 * c2 + c3 * c3 < AREA2_MIN) continue;
      I[k++] = b; if (direto) { I[k++] = b + i; I[k++] = b + i + 1; } else { I[k++] = b + i + 1; I[k++] = b + i; }
      NTRI++;
    }
    SA.nIndices = k;
  }

  // Quadrilátero com a normal tirada dos próprios cantos, virada para o lado de `dica`
  // (telhado, capa inclinada, cumeeira). Os cantos vêm em volta.
  function quadAuto(u0, v0, y0, u1, v1, y1, u2, v2, y2, u3, v3, y3, du, dv, dy) {
    const ax = u2 - u0, ay = y2 - y0, az = v2 - v0, bx = u3 - u1, by = y3 - y1, bz = v3 - v1;
    let nu = ay * bz - az * by, ny = az * bx - ax * bz, nv = ax * by - ay * bx;   // diagonais: robusto a canto repetido
    if (nu * du + nv * dv + ny * dy < 0) { nu = -nu; nv = -nv; ny = -ny; }
    quad(u0, v0, y0, u1, v1, y1, u2, v2, y2, u3, v3, y3, nu, nv, ny);
  }

  /* ---- face corrente: peças descritas em (s ao longo, p para DENTRO, y) ------------------
     Parede, muro, peitoril, rodapé, pilarete, portão: tudo se descreve melhor na face onde
     mora. (au, av) é a origem, (du, dv) a direção ao longo, (nu, nv) a normal para fora. */
  let PAU = 0, PAV = 0, PDU = 1, PDV = 0, PNU = 0, PNV = -1;
  function faceAtual(au, av, du, dv, nu, nv, of) {
    PAU = au; PAV = av; PDU = du; PDV = dv; PNU = nu; PNV = nv;
    modoParede(au, av, du, dv, of);
  }
  // normal em termos da face: ns ao longo, nn para fora, ny vertical
  function qf(s0, p0, y0, s1, p1, y1, s2, p2, y2, s3, p3, y3, ns, nn, ny) {
    quad(PAU + PDU * s0 - PNU * p0, PAV + PDV * s0 - PNV * p0, y0,
         PAU + PDU * s1 - PNU * p1, PAV + PDV * s1 - PNV * p1, y1,
         PAU + PDU * s2 - PNU * p2, PAV + PDV * s2 - PNV * p2, y2,
         PAU + PDU * s3 - PNU * p3, PAV + PDV * s3 - PNV * p3, y3,
         ns * PDU + nn * PNU, ns * PDV + nn * PNV, ny);
  }
  // retângulo de frente (normal +n) na profundidade p
  function rf(s0, s1, y0, y1, p) { qf(s0, p, y0, s1, p, y0, s1, p, y1, s0, p, y1, 0, 1, 0); }
  const CF_EXT = 1, CF_INT = 2, CF_TOPO = 4, CF_BASE = 8, CF_INI = 16, CF_FIM = 32, CF_TUDO = 63;
  // caixa na face: s0..s1 ao longo, p0..p1 de profundidade (p0 < p1), y0..y1
  function caixaFace(s0, s1, p0, p1, y0, y1, m) {
    if (m & CF_EXT) qf(s0, p0, y0, s1, p0, y0, s1, p0, y1, s0, p0, y1, 0, 1, 0);
    if (m & CF_INT) qf(s0, p1, y0, s1, p1, y0, s1, p1, y1, s0, p1, y1, 0, -1, 0);
    if (m & CF_TOPO) qf(s0, p0, y1, s1, p0, y1, s1, p1, y1, s0, p1, y1, 0, 0, 1);
    if (m & CF_BASE) qf(s0, p0, y0, s1, p0, y0, s1, p1, y0, s0, p1, y0, 0, 0, -1);
    if (m & CF_INI) qf(s0, p0, y0, s0, p1, y0, s0, p1, y1, s0, p0, y1, -1, 0, 0);
    if (m & CF_FIM) qf(s1, p0, y0, s1, p1, y0, s1, p1, y1, s1, p0, y1, 1, 0, 0);
  }
  // caixa alinhada à moldura (u, v)
  const B_FR = 1, B_DI = 2, B_FU = 4, B_ES = 8, B_TOPO = 16, B_BASE = 32, B_TUDO = 63;
  function caixaUV(u0, v0, u1, v1, y0, y1, m) {
    if (m & B_FR) { modoParede(u0, v0, 1, 0); quad(u0, v0, y0, u1, v0, y0, u1, v0, y1, u0, v0, y1, 0, -1, 0); }
    if (m & B_DI) { modoParede(u1, v0, 0, 1); quad(u1, v0, y0, u1, v1, y0, u1, v1, y1, u1, v0, y1, 1, 0, 0); }
    if (m & B_FU) { modoParede(u1, v1, -1, 0); quad(u1, v1, y0, u0, v1, y0, u0, v1, y1, u1, v1, y1, 0, 1, 0); }
    if (m & B_ES) { modoParede(u0, v1, 0, -1); quad(u0, v1, y0, u0, v0, y0, u0, v0, y1, u0, v1, y1, -1, 0, 0); }
    if (m & B_TOPO) quad(u0, v0, y1, u1, v0, y1, u1, v1, y1, u0, v1, y1, 0, 0, 1);
    if (m & B_BASE) quad(u0, v0, y0, u1, v0, y0, u1, v1, y0, u0, v1, y0, 0, 0, -1);
  }

  /* =====================================================================
     PLANTA: polígonos convexos achatados [x0, y0, x1, y1, ...] em (u, v)
     ===================================================================== */
  const EPS_D = 1e-9, AREA_MIN = 1e-5;
  // Fica a parte com a·x + b·y + c >= 0 (Sutherland-Hodgman de um lado só).
  function corta(P, a, b, c) {
    const n = P.length;
    if (!n) return P;
    let todos = true, nenhum = true;
    for (let i = 0; i < n; i += 2) { const d = a * P[i] + b * P[i + 1] + c; if (d < -EPS_D) todos = false; else nenhum = false; }
    if (todos) return P;
    if (nenhum) return [];
    const out = [];
    let px = P[n - 2], py = P[n - 1], pd = a * px + b * py + c;
    if (Math.abs(pd) < EPS_D) pd = 0;
    for (let i = 0; i < n; i += 2) {
      const qx = P[i], qy = P[i + 1];
      let qd = a * qx + b * qy + c;
      if (Math.abs(qd) < EPS_D) qd = 0;
      if (qd >= 0) {
        if (pd < 0) { const t = pd / (pd - qd); out.push(px + (qx - px) * t, py + (qy - py) * t); }
        out.push(qx, qy);
      } else if (pd > 0) { const t = pd / (pd - qd); out.push(px + (qx - px) * t, py + (qy - py) * t); }
      px = qx; py = qy; pd = qd;
    }
    return out;
  }
  function area(P) {
    let s = 0;
    for (let i = 0, n = P.length; i < n; i += 2) { const j = (i + 2) % n; s += P[i] * P[j + 1] - P[j] * P[i + 1]; }
    return s / 2;
  }
  const retPoly = (u0, v0, u1, v1) => [u0, v0, u1, v0, u1, v1, u0, v1];   // anti-horário em (u, v)
  // Semiplanos (normalizados) de um polígono convexo anti-horário: o interior é >= 0.
  function semiplanos(P) {
    const H = [];
    for (let i = 0, n = P.length; i < n; i += 2) {
      const j = (i + 2) % n, ex = P[j] - P[i], ey = P[j + 1] - P[i + 1], L = Math.hypot(ex, ey);
      if (L < 1e-9) continue;
      const a = -ey / L, b = ex / L;
      H.push(a, b, -(a * P[i] + b * P[i + 1]));
    }
    return H;
  }
  // Semiplanos com folga: d > 0 alarga a região (empate entra), d < 0 encolhe (empate fica fora).
  function folga(H, d) { const o = H.slice(); for (let k = 2; k < o.length; k += 3) o[k] += d; return o; }
  /* Tira de cada peça a região convexa H (todos os semiplanos >= 0). A peça é cortada
     semiplano a semiplano: o que fica fora de um deles sai como peça nova; o que sobra
     dentro de todos é a interseção, e some. Peça que não toca H passa inteira. */
  function subtrai(pecas, H) {
    const out = [];
    for (const P of pecas) {
      let toca = true;
      for (let k = 0; k < H.length && toca; k += 3) {
        let max = -Infinity;
        for (let i = 0; i < P.length; i += 2) { const d = H[k] * P[i] + H[k + 1] * P[i + 1] + H[k + 2]; if (d > max) max = d; }
        if (max <= 1e-7) toca = false;
      }
      if (!toca) { out.push(P); continue; }
      let resto = P;
      for (let k = 0; k < H.length; k += 3) {
        const fora = corta(resto, -H[k], -H[k + 1], -H[k + 2]);
        if (fora.length >= 6 && Math.abs(area(fora)) > AREA_MIN) out.push(fora);
        resto = corta(resto, H[k], H[k + 1], H[k + 2]);
        if (resto.length < 6 || Math.abs(area(resto)) <= AREA_MIN) break;
      }
    }
    return out;
  }
  // Intervalo do parâmetro t da reta p + t·d que satisfaz todos os semiplanos de H.
  function intervalo(pu, pv, du, dv, H, lo, hi) {
    for (let k = 0; k < H.length; k += 3) {
      const a = H[k] * du + H[k + 1] * dv, r = H[k] * pu + H[k + 1] * pv + H[k + 2];
      if (Math.abs(a) < 1e-12) { if (r < -1e-9) return null; continue; }
      const t = -r / a;
      if (a > 0) { if (t > lo) lo = t; } else if (t < hi) hi = t;
      if (lo > hi) return null;
    }
    return [lo, hi];
  }
  // Intervalos 1D: tira [a, b] de uma lista ordenada de [x, y].
  function tiraIntervalo(lista, a, b) {
    if (!(b > a)) return lista;
    const out = [];
    for (const [x, y] of lista) {
      if (b <= x || a >= y) { out.push([x, y]); continue; }
      if (a > x) out.push([x, a]);
      if (b < y) out.push([b, y]);
    }
    return out;
  }

  /* =====================================================================
     TELHADO DE ÁGUAS de um retângulo
     Lados: 0 frente (v = v0), 1 direita (u = u1), 2 fundo (v = v1), 3 esquerda (u = u0).
     ===================================================================== */
  function planoDoLado(W, base, i, lado) {
    if (lado === 0) return { A: 0, B: i, C: base - i * W.v0 };
    if (lado === 1) return { A: -i, B: 0, C: base + i * W.u1 };
    if (lado === 2) return { A: 0, B: -i, C: base + i * W.v1 };
    return { A: i, B: 0, C: base - i * W.u0 };
  }
  /* W: retângulo das paredes. beirais [4]: beiral por lado (0 = sem). aguas [4]: lados para
     onde a água corre (os outros são empena ou oitão). aberto: lado sem beiral nem testeira
     (a ala, onde encosta no corpo), ou -1. extensao: retângulo extra da projeção (a ala
     dentro do corpo). */
  function telhadoAguas(W, base, i, t, beirais, aguas, aberto, extensao, prio) {
    const b = k => k === aberto ? 0 : beirais[k];
    const pe = { u0: W.u0 - b(3), v0: W.v0 - b(0), u1: W.u1 + b(1), v1: W.v1 + b(2) };
    const planos = [];
    for (let k = 0; k < 4; k++) if (aguas[k]) planos.push(Object.assign(planoDoLado(W, base, i, k), { lado: k }));
    const rets = extensao ? [pe, extensao] : [pe];
    const facetas = [];
    for (let r = 0; r < rets.length; r++) {
      const R = rets[r];
      for (const p of planos) {
        let P = retPoly(R.u0, R.v0, R.u1, R.v1);
        for (const q of planos) {
          if (q === p) continue;
          P = corta(P, q.A - p.A, q.B - p.B, q.C - p.C);
          if (P.length < 6) break;
        }
        if (P.length >= 6 && area(P) > AREA_MIN) facetas.push({ P, A: p.A, B: p.B, C: p.C, lado: p.lado, ret: r, HP: semiplanos(P) });
      }
    }
    return { tipo: "telhado", W, WHP: semiplanos(retPoly(W.u0, W.v0, W.u1, W.v1)), base, i, t, beirais, aguas, aberto,
             pe, ext: extensao, planos, facetas, prio };
  }
  // altura do telhado de águas no ponto (o menor dos planos)
  function alturaTelhado(T, u, v) {
    let h = Infinity;
    for (const p of T.planos) { const y = p.A * u + p.B * v + p.C; if (y < h) h = y; }
    return h;
  }

  /* ---- recorte contra os outros sólidos ---------------------------------------------
     Um sólido é um telhado de águas (paredes cheias até o telhado + a laje de telhado de
     espessura t no beiral) ou uma caixa de laje (cheia até o topo da platibanda). Cada
     elemento (plano de água, forro, testeira, cumeeira) perde a parte que fica DENTRO de
     outro sólido. `d` > 0: o empate vai para o outro (o elemento é de menor prioridade);
     `d` < 0: o empate fica com o elemento. */
  function regioesPlano(Ae, Be, Ce, m, d) {
    const out = [];
    if (m.tipo === "caixa") { out.push(folga(m.HP, d).concat([-Ae, -Be, m.topo - Ce + d])); return out; }
    const W = folga(m.WHP, d);
    for (const f of m.facetas) {
      const HP = folga(f.HP, d);
      const abaixo = [f.A - Ae, f.B - Be, f.C - Ce + d];                // e <= P_f (+d)
      const faixa = [Ae - f.A, Be - f.B, Ce - f.C + m.t + d];           // e >= P_f - t (-d)
      out.push(HP.concat(W, abaixo));                                   // dentro das paredes
      out.push(HP.concat(abaixo, faixa));                               // dentro da laje do telhado
    }
    return out;
  }
  // Recorte de peça VERTICAL (testeira) no plano (s, y) da sua linha p + s·d.
  function regioesVertical(pu, pv, du, dv, m, d) {
    const out = [];
    if (m.tipo === "caixa") {
      const I = intervalo(pu, pv, du, dv, folga(m.HP, d), -1e6, 1e6);
      if (I) out.push([1, 0, -I[0], -1, 0, I[1], 0, -1, m.topo + d]);
      return out;
    }
    const IW = intervalo(pu, pv, du, dv, folga(m.WHP, d), -1e6, 1e6);
    for (const f of m.facetas) {
      const I = intervalo(pu, pv, du, dv, folga(f.HP, d), -1e6, 1e6);
      if (!I || I[1] - I[0] < 1e-6) continue;
      const al = f.A * du + f.B * dv, be = f.A * pu + f.B * pv + f.C;
      const abaixo = [al, -1, be + d], faixa = [-al, 1, -be + m.t + d];
      out.push([1, 0, -I[0], -1, 0, I[1]].concat(abaixo, faixa));
      if (IW) { const lo = Math.max(I[0], IW[0]), hi = Math.min(I[1], IW[1]); if (hi > lo) out.push([1, 0, -lo, -1, 0, hi].concat(abaixo)); }
    }
    return out;
  }
  // Recorte de LINHA (cumeeira): devolve os intervalos de s que ficam visíveis.
  function recortaLinha(pu, pv, du, dv, s0, s1, ae, be, solidos, eu, d) {
    let vis = [[s0, s1]];
    for (const m of solidos) {
      if (m === eu || !vis.length) continue;
      if (m.tipo === "caixa") {
        const I = intervalo(pu, pv, du, dv, folga(m.HP, d), s0, s1);
        if (!I) continue;
        const J = intervalo(0, 0, 1, 0, [-ae, 0, m.topo - be + d], I[0], I[1]);   // e <= topo
        if (J) vis = tiraIntervalo(vis, J[0], J[1]);
        continue;
      }
      const IW = intervalo(pu, pv, du, dv, folga(m.WHP, d), s0, s1);
      for (const f of m.facetas) {
        const I = intervalo(pu, pv, du, dv, folga(f.HP, d), s0, s1);
        if (!I) continue;
        const al = f.A * du + f.B * dv, bf = f.A * pu + f.B * pv + f.C;
        const abaixo = [al - ae, 0, bf - be + d], faixa = [ae - al, 0, be - bf + m.t + d];
        const J = intervalo(0, 0, 1, 0, abaixo.concat(faixa), I[0], I[1]);
        if (J) vis = tiraIntervalo(vis, J[0], J[1]);
        if (IW) { const K = intervalo(0, 0, 1, 0, abaixo, Math.max(I[0], IW[0]), Math.min(I[1], IW[1])); if (K) vis = tiraIntervalo(vis, K[0], K[1]); }
      }
    }
    return vis.filter(([a, b]) => b - a > 0.02);
  }
  const prioD = (eu, m) => (m.tipo === "caixa" || m.prio < eu.prio) ? 1e-3 : -1e-3;

  // Peças de um plano de água (ou do forro, com dy = -t) depois do recorte.
  function pecasDoPlano(f, dy, eu, solidos, comCorpo, foraDasParedes) {
    let pecas = [f.P];
    if (foraDasParedes) pecas = subtrai(pecas, eu.WHP);
    for (const m of solidos) {
      if (m === eu || !pecas.length) continue;
      if (m.tipo !== "caixa" && !comCorpo && m.prio > eu.prio) continue;
      for (const H of regioesPlano(f.A, f.B, f.C + dy, m, prioD(eu, m))) { pecas = subtrai(pecas, H); if (!pecas.length) break; }
    }
    return pecas;
  }
  function emitePlano(pecas, A, B, C, baixo) {
    const nu = baixo ? A : -A, nv = baixo ? B : -B, ny = baixo ? -1 : 1;
    for (const P of pecas) {
      const n = P.length / 2, Q = new Array(n * 3);
      for (let k = 0; k < n; k++) { const u = P[2 * k], v = P[2 * k + 1]; Q[3 * k] = u; Q[3 * k + 1] = v; Q[3 * k + 2] = A * u + B * v + C; }
      poligono(Q, n, nu, nv, ny);
    }
  }

  /* Testeiras: na borda da projeção, um trecho por plano de água que a borda atravessa
     (a empena tem dois, um de cada lado da cumeeira). `lod1` pula o recorte fino. */
  function testeiras(T, solidos) {
    const R = T.pe, out = [];
    const bordas = [[R.u0, R.v0, 1, 0, R.u1 - R.u0, 0, -1, 0], [R.u1, R.v0, 0, 1, R.v1 - R.v0, 1, 0, 1],
                    [R.u1, R.v1, -1, 0, R.u1 - R.u0, 0, 1, 2], [R.u0, R.v1, 0, -1, R.v1 - R.v0, -1, 0, 3]];
    for (const [pu, pv, du, dv, L, nu, nv, lado] of bordas) {
      if (lado === T.aberto || !(T.beirais[lado] > 0)) continue;
      for (const f of T.facetas) {
        if (f.ret !== 0) continue;
        const I = intervalo(pu, pv, du, dv, f.HP, 0, L);
        if (!I || I[1] - I[0] < 1e-4) continue;
        const al = f.A * du + f.B * dv, be = f.A * pu + f.B * pv + f.C;
        let pecas = [[I[0], al * I[0] + be - T.t, I[1], al * I[1] + be - T.t, I[1], al * I[1] + be, I[0], al * I[0] + be]];
        for (const m of solidos) {
          if (m === T || !pecas.length) continue;
          for (const H of regioesVertical(pu, pv, du, dv, m, prioD(T, m))) { pecas = subtrai(pecas, H); if (!pecas.length) break; }
        }
        for (const P of pecas) out.push({ pu, pv, du, dv, nu, nv, P });
      }
    }
    return out;
  }
  function emiteTesteiras(lista) {
    for (const { pu, pv, du, dv, nu, nv, P } of lista) {
      modoParede(pu, pv, du, dv);
      const n = P.length / 2, Q = new Array(n * 3);
      for (let k = 0; k < n; k++) { const s = P[2 * k]; Q[3 * k] = pu + du * s; Q[3 * k + 1] = pv + dv * s; Q[3 * k + 2] = P[2 * k + 1]; }
      poligono(Q, n, nu, nv, 0);
    }
  }

  // Cumeeira e espigões: a reta onde dois planos do mesmo retângulo se encontram.
  function linhasDoTelhado(T) {
    const out = [];
    for (let a = 0; a < T.planos.length; a++) for (let b = a + 1; b < T.planos.length; b++) {
      const p = T.planos[a], q = T.planos[b];
      const ka = p.A - q.A, kb = p.B - q.B, kc = p.C - q.C, n2 = ka * ka + kb * kb;
      if (n2 < 1e-12) continue;
      const n = Math.sqrt(n2), du = -kb / n, dv = ka / n, pu = -kc * ka / n2, pv = -kc * kb / n2;
      const rets = T.ext ? [T.pe, T.ext] : [T.pe];
      for (const R of rets) {
        const H = semiplanos(retPoly(R.u0, R.v0, R.u1, R.v1));
        for (const r of T.planos) if (r !== p && r !== q) H.push(r.A - p.A, r.B - p.B, r.C - p.C);
        const I = intervalo(pu, pv, du, dv, H, -1e4, 1e4);
        if (I && I[1] - I[0] > 0.05) out.push({ pu, pv, du, dv, s0: I[0], s1: I[1], A: p.A, B: p.B, C: p.C });
      }
    }
    return out;
  }
  function emiteCumeeiras(T, solidos, corTelha) {
    const { meia, altura, folga: fg } = VISUAL.cumeeira;
    for (const L of linhasDoTelhado(T)) {
      const ae = L.A * L.du + L.B * L.dv, be = L.A * L.pu + L.B * L.pv + L.C;
      const vis = recortaLinha(L.pu, L.pv, L.du, L.dv, L.s0, L.s1, ae, be, solidos, T, 1e-3);
      const wu = -L.dv, wv = L.du;
      cor(corTelha, 0.86);
      for (const [s0, s1] of vis) {
        const pt = s => [L.pu + L.du * s, L.pv + L.dv * s];
        const [a0, b0] = pt(s0), [a1, b1] = pt(s1);
        const top0 = ae * s0 + be + altura, top1 = ae * s1 + be + altura;
        const hl0 = alturaTelhado(T, a0 + wu * meia, b0 + wv * meia) + fg, hl1 = alturaTelhado(T, a1 + wu * meia, b1 + wv * meia) + fg;
        const hr0 = alturaTelhado(T, a0 - wu * meia, b0 - wv * meia) + fg, hr1 = alturaTelhado(T, a1 - wu * meia, b1 - wv * meia) + fg;
        quadAuto(a0 + wu * meia, b0 + wv * meia, hl0, a1 + wu * meia, b1 + wv * meia, hl1, a1, b1, top1, a0, b0, top0, wu, wv, 1);
        quadAuto(a0 - wu * meia, b0 - wv * meia, hr0, a0, b0, top0, a1, b1, top1, a1 - wu * meia, b1 - wv * meia, hr1, -wu, -wv, 1);
        poligono([a0 + wu * meia, b0 + wv * meia, hl0, a0, b0, top0, a0 - wu * meia, b0 - wv * meia, hr0], 3, -L.du, -L.dv, 0);
        poligono([a1 + wu * meia, b1 + wv * meia, hl1, a1, b1, top1, a1 - wu * meia, b1 - wv * meia, hr1], 3, L.du, L.dv, 0);
      }
    }
  }

  // Perfil do telhado ao longo de uma linha de parede: [[s, h], ...] em ordem.
  function perfil(T, au, av, du, dv, s0, s1) {
    const pts = [];
    for (const f of T.facetas) {
      const I = intervalo(au, av, du, dv, f.HP, s0, s1);
      if (!I || I[1] - I[0] < 1e-6) continue;
      const al = f.A * du + f.B * dv, be = f.A * au + f.B * av + f.C;
      pts.push([I[0], al * I[0] + be], [I[1], al * I[1] + be]);
    }
    pts.sort((a, b) => a[0] - b[0]);
    const out = [];
    for (const p of pts) { const q = out[out.length - 1]; if (!q || p[0] - q[0] > 1e-5) out.push(p); else if (p[1] > q[1]) q[1] = p[1]; }
    return out;
  }

  /* =====================================================================
     CONTEXTO DA CASA: números das regras, sorteios finos, cores, chão
     ===================================================================== */
  let REGRAS_PADRAO = null;
  function usaRegras(regras) { REGRAS_PADRAO = regras; }
  function entreM(f, faixa, passo) {
    const a = Math.round(faixa[0] / passo), b = Math.round(faixa[1] / passo);
    return f.inteiro(a, b) * passo;
  }

  function contexto(casa, det, regras, opcoes) {
    const F = Formato(), S = Sorteio();
    const R = c => F.regra(regras, c);
    const vols = casa.volumes, corpo = vols[0];
    const ala = vols.find(v => v.papel !== "corpo" && v.papel !== "edicula") || null;
    const ex = opcoes && opcoes.exagero !== undefined ? opcoes.exagero : 1;
    const dvl = casa.declive.v * ex, dul = casa.declive.u * ex;
    const fG = S.fluxo(casa.semente, "geometria");
    const p = {
      recuo: entreM(fG, R("aberturas.janela_recuo_m"), 0.01),
      peitoril: entreM(fG, R("aberturas.janela_peitoril_m"), 0.05),
      sala: entreM(fG, R("aberturas.janela_sala_largura_m"), 0.1),
      quarto: R("aberturas.janela_sala_largura_m")[0],
      basc: entreM(fG, R("aberturas.basculante_m"), 0.1),
      servicoSorteio: fG.chance(0.5),
      jitter: (casa.semente % 19) * VISUAL.muroJitter
    };
    const c = det.cores;
    const parede = c.parede;
    const cores = {
      parede, telha: c.telha, laje: c.laje, fibro: c.fibrocimento, esquadria: c.esquadria, portao: c.portao,
      muro: c.muro, grama: c.grama, piso: c.piso, piscina: c.piscina,
      forro: mistura(parede, VISUAL.cores.branco, 0.55), rodape: casa.embasamento ? VISUAL.cores.embasamento : escala(parede, 0.8),
      moldura: mistura(parede, VISUAL.cores.branco, 0.35), capa: mistura(c.muro, VISUAL.cores.branco, 0.4),
      capaParede: mistura(parede, VISUAL.cores.branco, 0.45),
      porta: c.esquadriaTipo === "madeira" ? c.esquadria : VISUAL.cores.porta
    };
    return {
      casa, det, regras, R, vols, corpo, ala, F, S, p, cores,
      edicula: vols.find(v => v.papel === "edicula") || null,
      sup: det.pavimentoSuperior, resp1: det.respaldoTerrea,
      chao: (u, v) => dvl * v + dul * u,       // chão do lote relativo à testada (já exagerado)
      e: VISUAL.parede, t: R("telhado.testeira_m"),
      verga: R("aberturas.verga_m"), canto: R("aberturas.janela_canto_min_m"),
      tipoST: casa.pavimentos === 2 ? ST_SOBRADO : ST_CASA
    };
  }
  // pé da parede: abaixo do chão mais baixo debaixo do retângulo
  function pe(cx, r) {
    const g = cx.chao;
    return Math.min(g(r.u0, r.v0), g(r.u1, r.v0), g(r.u0, r.v1), g(r.u1, r.v1), 0) - VISUAL.enterra;
  }

  /* =====================================================================
     TELHADOS DA CASA: monta os sólidos (corpo, ala, edícula, caixas) uma vez
     ===================================================================== */
  function beiraisDe(det, iv) {
    const b = [0, 0, 0, 0];
    for (const f of det.faces) if (f.volume === iv) b[["frente", "direita", "fundo", "esquerda"].indexOf(f.lado)] = f.beiral;
    return b;
  }
  function aguasDe(tipo, cum) {
    if (tipo === "quatro_aguas") return [true, true, true, true];
    if (tipo === "meia_agua") return [true, false, false, false];
    return cum === "u" ? [true, false, true, false] : [false, true, false, true];
  }
  function montaTelhados(cx) {
    const { casa, det, vols, corpo, sup } = cx;
    const ceramicos = [], caixas = [], planos = [], porVolume = [];
    vols.forEach((vol, iv) => {
      const tel = det.telhados[iv];
      if (vol.papel === "caixa_garagem" || vol.papel === "caixa_varanda") {
        const r = { u0: vol.u0, v0: vol.v0, u1: vol.u1, v1: vol.v1 };
        const cxa = { tipo: "caixa", W: r, HP: semiplanos(retPoly(r.u0, r.v0, r.u1, r.v1)), topo: tel.platibanda, prio: 9, iv };
        caixas.push(cxa); porVolume[iv] = { plano: tel, caixa: cxa };
        return;
      }
      if (vol.papel === "garagem_leve") { porVolume[iv] = { leve: tel }; return; }
      if (tel.material !== "ceramica") { porVolume[iv] = { plano: tel }; planos.push(iv); return; }
      // retângulo das paredes do telhado: o pavimento de cima no sobrado
      const W = vol.papel === "corpo" && sup ? { u0: sup.u0, v0: sup.v0, u1: sup.u1, v1: sup.v1 } : { u0: vol.u0, v0: vol.v0, u1: vol.u1, v1: vol.v1 };
      const tipo = tel.tipo === "duas_aguas_paralela" || tel.tipo === "duas_aguas_perpendicular" ? "duas" : tel.tipo;
      let aguas = aguasDe(tipo === "duas" ? "duas" : tel.tipo, tel.cumeeira), aberto = -1, extensao = null;
      const beirais = beiraisDe(det, iv);
      if (vol.papel === "ala_l" || vol.papel === "ala_t") {
        // A ala encosta na frente ou no fundo do corpo: esse lado fica aberto e o telhado
        // dela entra no corpo até a metade (retângulo máximo da planta em L/T).
        const frente = Math.abs(vol.v1 - corpo.v0) < 1e-6;
        aberto = frente ? 2 : 0;
        aguas = tel.tipo === "quatro_aguas" ? [true, true, true, true] : [false, true, false, true];
        aguas[aberto] = false;
        const meio = (corpo.v0 + corpo.v1) / 2;
        const eu0 = Math.max(vol.u0 - beirais[3], corpo.u0), eu1 = Math.min(vol.u1 + beirais[1], corpo.u1);
        extensao = frente ? { u0: eu0, v0: vol.v1, u1: eu1, v1: meio } : { u0: eu0, v0: meio, u1: eu1, v1: vol.v0 };
      }
      const T = telhadoAguas(W, tel.base, tel.inclinacao, cx.t, beirais, aguas, aberto, extensao,
                             vol.papel === "corpo" ? 0 : vol.papel === "edicula" ? 5 : 1);
      T.iv = iv; T.tel = tel; T.papel = vol.papel;
      ceramicos.push(T); porVolume[iv] = { aguas: T };
    });
    // a edícula é outro prédio: ninguém recorta contra ela, nem ela contra ninguém
    const solidos = ceramicos.filter(T => T.papel !== "edicula").concat(caixas);
    return { ceramicos, caixas, planos, porVolume, solidos };
  }

  /* =====================================================================
     PAREDES E ABERTURAS (decisão compartilhada pelo LOD0 e pelo LOD1)
     ===================================================================== */
  const LADOS = ["frente", "direita", "fundo", "esquerda"];
  function faceDoRet(r, lado) {
    if (lado === "frente") return { a: [r.u0, r.v0], d: [1, 0], n: [0, -1], L: r.u1 - r.u0 };
    if (lado === "direita") return { a: [r.u1, r.v0], d: [0, 1], n: [1, 0], L: r.v1 - r.v0 };
    if (lado === "fundo") return { a: [r.u1, r.v1], d: [-1, 0], n: [0, 1], L: r.u1 - r.u0 };
    return { a: [r.u0, r.v1], d: [0, -1], n: [-1, 0], L: r.v1 - r.v0 };
  }
  // trecho [x0, x1] em coordenada absoluta (u na frente/fundo, v nas laterais) -> s da face
  function paraS(fc, x0, x1) {
    const ao = fc.lado === "frente" || fc.lado === "fundo" ? fc.au : fc.av;
    const dd = fc.lado === "frente" || fc.lado === "fundo" ? fc.du : fc.dv;
    const a = (x0 - ao) * dd, b = (x1 - ao) * dd;
    return a < b ? [a, b] : [b, a];
  }

  /* Uma face por lado de volume e por pavimento, com as aberturas decididas por regra:
     - frente: janela de sala (térreo) ou de quarto (andar), centrada em cada vão livre;
       porta social na posição do plano (det.porta), e o vão dela fica sem janela;
     - fundo: basculante alto em cada vão, porta de serviço num vão do lado da garagem;
     - laterais: só em face com recuo >= 1,5 m (det.faces[].janela); janela de quarto por
       vão, da frente para o fundo, alternando os lados, até a área de janela passar de
       1/6 do piso (aberturas.janela_area_fracao_piso);
     - janela a 0,6 m do canto e do pilar (fica no meio do vão, e o vão tem 3,0-4,5 m);
     - nada em trecho encostado em outro volume (det.faces[].cobertos);
     - no sobrado, o andar repete as janelas de baixo na mesma vertical.
     Toda janela é centrada no vão e todas da face têm a mesma largura: por isso a máscara
     de vãos do atributo `janela` (LOD1) desenha exatamente o que o LOD0 constrói. */
  function planejaParedes(cx) {
    if (cx.paredes) return cx.paredes;
    const { casa, det, vols, corpo, sup, R, p, canto, verga } = cx;
    const piso = casa.alturas.piso, resp1 = cx.resp1;
    const faces = [];
    const peitJ = p.peitoril, altJ = R("aberturas.janela_sala_altura_m"), peitB = R("aberturas.basculante_peitoril_m");
    const alvoArea = R("aberturas.janela_area_fracao_piso") * casa.pavimentos *
      vols.filter(v => v.papel === "corpo" || v.papel === "ala_l" || v.papel === "ala_t").reduce((s, v) => s + (v.u1 - v.u0) * (v.v1 - v.v0), 0);
    const porId = new Map();

    det.faces.forEach((f, i) => {
      const vol = vols[f.volume];
      if (vol.papel === "caixa_garagem" || vol.papel === "caixa_varanda") return;
      const pavs = vol.papel === "corpo" && sup ? 2 : 1;
      for (let pav = 0; pav < pavs; pav++) {
        const r = pav === 1 ? sup : vol;
        const g0 = faceDoRet(vol, f.lado), g1 = faceDoRet(r, f.lado);
        const fc = {
          i, iv: f.volume, papel: vol.papel, lado: f.lado, pav, cega: f.cega, pode: f.janela && !f.cega,
          au: g0.a[0], av: g0.a[1], du: g0.d[0], dv: g0.d[1], nu: g0.n[0], nv: g0.n[1], L: f.comprimento,
          // no andar com balanço, a face anda mas a coordenada s continua a do térreo:
          // é isso que alinha as janelas na vertical
          sA: (g1.a[0] - g0.a[0]) * g0.d[0] + (g1.a[1] - g0.a[1]) * g0.d[1],
          vao: f.pilares.vao, nVaos: f.pilares.n,
          piso: pav === 1 ? resp1 : piso, aberturas: [], cobertos: [], janelasVao: []
        };
        fc.sB = fc.sA + g1.L;
        fc.cobertos = pav === 1 ? [] : f.cobertos.map(([x0, x1]) => paraS(fc, x0, x1));
        fc.inteira = fc.cobertos.some(([a, b]) => a <= fc.sA + 1e-6 && b >= fc.sB - 1e-6);
        // tipo de janela da face
        if (f.lado === "fundo" || (vol.papel === "edicula" && f.lado !== "frente")) {
          fc.tipoJ = 2; fc.larg = p.basc; fc.y0J = fc.piso + peitB; fc.y1J = fc.piso + verga;
        } else {
          fc.tipoJ = 1;
          fc.larg = f.lado === "frente" && pav === 0 && vol.papel !== "edicula" ? p.sala : p.quarto;
          fc.y0J = fc.piso + peitJ; fc.y1J = fc.piso + Math.min(peitJ + altJ, verga);
        }
        faces.push(fc); porId.set(i * 2 + pav, fc);
      }
    });

    // ---- portas --------------------------------------------------------------------------
    const pw = R("aberturas.porta_largura_m"), sw = R("aberturas.porta_servico_largura_m");
    const fcFrente = porId.get(0 * 2);               // a face 0 é a frente do corpo (det.faces na ordem LADOS)
    const fcFundo = porId.get(2 * 2);
    const porta = (fc, s, w, tipo) => fc.aberturas.push({ tipo, s0: s - w / 2, s1: s + w / 2, y0: fc.piso, y1: fc.piso + verga });
    const varanda = vols.find(v => v.papel === "caixa_varanda");
    if (fcFrente) porta(fcFrente, det.porta.u - corpo.u0, pw, "porta");
    const vaoLivre = (fc, k, meia) => {
      const c = (k + 0.5) * fc.vao;
      if (c - meia < fc.sA + 0.3 || c + meia > fc.sB - 0.3) return null;
      for (const [a, b] of fc.cobertos) if (c + meia > a - canto / 2 && c - meia < b + canto / 2) return null;
      return c;
    };
    if (fcFundo && !fcFundo.inteira) {
      const ks = [...Array(fcFundo.nVaos).keys()];
      // fundo corre de u1 para u0: a garagem à esquerda (u0) fica no último vão
      const lado = casa.garagem.lado === "esquerda" ? 1 : casa.garagem.lado === "direita" ? 0 : (p.servicoSorteio ? 1 : 0);
      if (lado) ks.reverse();
      for (const k of ks) { const c = vaoLivre(fcFundo, k, sw / 2 + 0.3); if (c !== null) { porta(fcFundo, c, sw, "servico"); break; } }
    }
    const ed = vols.findIndex(v => v.papel === "edicula");
    if (ed >= 0) {
      const fe = faces.find(fc => fc.iv === ed && fc.lado === "frente");
      if (fe && !fe.inteira) {
        // a porta da edícula fica no vão mais perto do eixo da casa
        let melhor = null;
        for (let k = 0; k < fe.nVaos; k++) {
          const c = vaoLivre(fe, k, sw / 2 + 0.3);
          if (c === null) continue;
          const u = fe.au + fe.du * c, dist = Math.abs(u - (corpo.u0 + corpo.u1) / 2);
          if (!melhor || dist < melhor[1]) melhor = [c, dist];
        }
        if (melhor) porta(fe, melhor[0], sw, "servico");
      }
    }

    // ---- janelas -------------------------------------------------------------------------
    const area = { total: 0 };
    const candidata = fc => {
      const out = [];
      if (!fc.pode || fc.inteira) return out;
      const w = Math.min(fc.larg, fc.vao - 2 * canto);
      if (w < (fc.tipoJ === 2 ? 0.4 : 0.8)) return out;
      for (let k = 0; k < Math.min(fc.nVaos, 8); k++) {
        const c = (k + 0.5) * fc.vao, a = c - w / 2, b = c + w / 2;
        if (a < fc.sA + canto - 1e-6 || b > fc.sB - canto + 1e-6) continue;
        let ok = true;
        for (const [x, y] of fc.cobertos) if (b > x - canto && a < y + canto) { ok = false; break; }
        for (const o of fc.aberturas) if (b > o.s0 - 0.3 && a < o.s1 + 0.3) { ok = false; break; }
        if (ok) out.push({ k, s0: a, s1: b, w });
      }
      return out;
    };
    const poe = (fc, c) => {
      fc.aberturas.push({ tipo: fc.tipoJ === 2 ? "basculante" : "janela", s0: c.s0, s1: c.s1, y0: fc.y0J, y1: fc.y1J });
      fc.janelasVao.push(c.k); fc.largUsada = c.w;
      area.total += c.w * (fc.y1J - fc.y0J);
    };
    const terreo = faces.filter(fc => fc.pav === 0), andar = faces.filter(fc => fc.pav === 1);
    // frente e fundo: todo vão livre
    for (const fc of terreo) if (fc.lado === "frente" || fc.lado === "fundo" || fc.papel === "edicula") for (const c of candidata(fc)) poe(fc, c);
    // laterais: da frente para o fundo, alternando os lados, até a área de janela
    const lat = [];
    for (const fc of terreo) {
      if (fc.papel === "edicula" || (fc.lado !== "direita" && fc.lado !== "esquerda")) continue;
      for (const c of candidata(fc)) {
        const sMeio = (c.s0 + c.s1) / 2, v = fc.av + fc.dv * sMeio;
        lat.push({ fc, c, v, lado: fc.lado === "esquerda" ? 0 : 1 });
      }
    }
    lat.sort((a, b) => (a.v - b.v) || (a.lado - b.lado));
    for (const x of lat) { if (area.total >= alvoArea) break; poe(x.fc, x.c); }
    // andar do sobrado: frente e fundo em todo vão; laterais na vertical das de baixo
    for (const fc of andar) {
      const baixo = terreo.find(t => t.i === fc.i);
      const cands = candidata(fc);
      if (fc.lado === "frente" || fc.lado === "fundo") { for (const c of cands) poe(fc, c); continue; }
      for (const c of cands) if (baixo && baixo.janelasVao.includes(c.k)) poe(fc, c);
    }
    for (const fc of faces) {
      fc.aberturas.sort((a, b) => a.s0 - b.s0);
      let m = 0;
      for (const k of fc.janelasVao) m |= 1 << k;
      fc.mascara = m;
    }
    cx.paredes = { faces, porId, fcFrente, varanda, areaJanela: area.total, alvoArea };
    return cx.paredes;
  }

  // Altura do topo da faixa de parede de cada face (térreo ou andar de cima).
  function topoDaFace(cx, fc, tels) {
    const vol = cx.vols[fc.iv], tel = cx.det.telhados[fc.iv];
    if (vol.papel === "corpo" && cx.sup && fc.pav === 0) return cx.resp1;
    if (tel.material === "ceramica") return tel.base;
    return tel.platibanda !== undefined ? tel.platibanda : tel.topo;
  }

  /* =====================================================================
     LOD0: PAREDE COM VÃO
     ===================================================================== */
  function estiloParede(cx, fc) {
    const vol = cx.vols[fc.iv];
    ET = vol.papel === "edicula" ? ST_ANEXO : cx.tipoST;
    EH = Math.min(65535, Math.round(cx.casa.alturas.respaldo * 10));
  }

  function paredeLOD0(cx, fc, tels) {
    if (fc.inteira && fc.papel !== "corpo") return;           // face toda dentro de outro volume
    const vol = cx.vols[fc.iv], r = fc.pav === 1 ? cx.sup : vol;
    const y0 = fc.pav === 1 ? cx.resp1 : pe(cx, r);
    const y1 = topoDaFace(cx, fc, tels);
    const { recuo } = cx.p;
    estiloParede(cx, fc);
    janela(0, 0, 0, 0, 2);
    faceAtual(fc.au, fc.av, fc.du, fc.dv, fc.nu, fc.nv);
    cor(cx.cores.parede);
    if (fc.pav === 0) comAO(0, 3.0, 0.86); else semAO();
    // faixa de parede em tiras: pano cheio entre vãos, peitoril e verga sobre cada vão
    let s = fc.sA;
    for (const o of fc.aberturas) {
      if (o.s0 > s + 1e-6) rf(s, o.s0, y0, y1, 0);
      if (o.y0 > y0 + 1e-6) rf(o.s0, o.s1, y0, o.y0, 0);
      if (o.y1 < y1 - 1e-6) rf(o.s0, o.s1, o.y1, y1, 0);
      s = o.s1;
    }
    if (fc.sB > s + 1e-6) rf(s, fc.sB, y0, y1, 0);
    semAO();
    // empena / oitão acima do respaldo
    const T = tels.porVolume[fc.iv] && tels.porVolume[fc.iv].aguas;
    if (T && (fc.pav === 1 || !(vol.papel === "corpo" && cx.sup))) empena(cx, fc, T, y1);
    for (const o of fc.aberturas) abertura(cx, fc, o, recuo);
    if (fc.pav === 0) rodape(cx, fc, y0);
  }

  function empena(cx, fc, T, y1) {
    const pf = perfil(T, fc.au, fc.av, fc.du, fc.dv, fc.sA, fc.sB);
    if (pf.length < 2) return;
    let max = -Infinity;
    for (const q of pf) if (q[1] > max) max = q[1];
    if (max - y1 < 0.01) return;
    const ladoK = LADOS.indexOf(fc.lado);
    const semBeiral = !(T.beirais[ladoK] > 0) && !T.aguas[ladoK];
    const sobe = semBeiral ? VISUAL.oitao : 0;
    const P = [fc.sA, y1, fc.sB, y1];
    for (let k = pf.length - 1; k >= 0; k--) P.push(pf[k][0], Math.max(y1, pf[k][1] + sobe));
    const n = P.length / 2, Q = new Array(n * 3);
    for (let k = 0; k < n; k++) { const s = P[2 * k]; Q[3 * k] = fc.au + fc.du * s; Q[3 * k + 1] = fc.av + fc.dv * s; Q[3 * k + 2] = P[2 * k + 1]; }
    cor(cx.cores.parede);
    poligono(Q, n, fc.nu, fc.nv, 0);
    if (!semBeiral) return;
    // oitão: a parede sobe acima da telha; face de dentro e topo com capa
    const e = cx.e;
    cor(cx.cores.parede, 0.92);
    for (let k = 0; k + 1 < pf.length; k++) {
      const [sa, ha] = pf[k], [sb, hb] = pf[k + 1];
      qf(sa, e, ha - 0.04, sb, e, hb - 0.04, sb, e, hb + sobe, sa, e, ha + sobe, 0, -1, 0);
    }
    cor(cx.cores.capaParede);
    for (let k = 0; k + 1 < pf.length; k++) {
      const [sa, ha] = pf[k], [sb, hb] = pf[k + 1];
      const ua = fc.au + fc.du * sa, va = fc.av + fc.dv * sa, ub = fc.au + fc.du * sb, vb = fc.av + fc.dv * sb;
      quadAuto(ua, va, ha + sobe, ub, vb, hb + sobe, ub - fc.nu * e, vb - fc.nv * e, hb + sobe, ua - fc.nu * e, va - fc.nv * e, ha + sobe, 0, 0, 1);
    }
    for (const [sk, hk] of [pf[0], pf[pf.length - 1]]) {
      // ponta do oitão no canto: tampa a espessura entre a face de fora e a de dentro
      const fim = sk > (fc.sA + fc.sB) / 2;
      cor(cx.cores.parede, 0.95);
      qf(sk, 0, hk - 0.04, sk, e, hk - 0.04, sk, e, hk + sobe, sk, 0, hk + sobe, fim ? 1 : -1, 0, 0);
    }
  }

  // Janela, basculante ou porta: vão com profundidade, requadro, caixilho e peitoril.
  function abertura(cx, fc, o, r) {
    const { moldura: M, peitoril: Pe, caixilho: Cx } = VISUAL;
    const m = M.largura, pr = M.relevo, c = Cx.largura, cr = Cx.relevo;
    const { s0, s1, y0, y1 } = o;
    const porta = o.tipo === "porta" || o.tipo === "servico";
    const cores = cx.cores;
    janela(0, 0, 0, 0, 2);
    // vão: ombreiras, verga (por baixo) e fundo (porta: soleira de dentro)
    cor(cores.parede, 0.82);
    qf(s0, -pr, y0, s0, r, y0, s0, r, y1, s0, -pr, y1, 1, 0, 0);
    qf(s1, -pr, y0, s1, r, y0, s1, r, y1, s1, -pr, y1, -1, 0, 0);
    cor(cores.parede, 0.7);
    qf(s0, -pr, y1, s1, -pr, y1, s1, r, y1, s0, r, y1, 0, 0, -1);
    if (porta) { cor(VISUAL.cores.soleira); qf(s0, 0, y0, s1, 0, y0, s1, r, y0, s0, r, y0, 0, 0, 1); }
    // vidro ou folha da porta, no fundo do vão
    if (porta) { cor(o.tipo === "porta" ? cores.porta : cores.esquadria); janela(0, 0, 0, 0, 2); }
    else { cor(VISUAL.cores.vidro); janela(0, 0, 0, 3 << 6, 2); }
    rf(s0, s1, y0, y1, r);
    janela(0, 0, 0, 0, 2);
    // caixilho (esquadria) um pouco à frente do vidro
    cor(cores.esquadria);
    const pc = r - cr;
    rf(s0, s0 + c, y0, y1, pc); rf(s1 - c, s1, y0, y1, pc);
    rf(s0 + c, s1 - c, y1 - c, y1, pc);
    if (!porta) rf(s0 + c, s1 - c, y0, y0 + c, pc);
    if (o.tipo === "janela") {
      const nm = s1 - s0 > 1.6 ? 3 : 1;
      for (let k = 1; k <= nm; k++) { const x = s0 + (s1 - s0) * k / (nm + 1); rf(x - c / 2, x + c / 2, y0 + c, y1 - c, pc); }
    } else if (o.tipo === "basculante") {
      for (let k = 1; k <= 2; k++) { const y = y0 + (y1 - y0) * k / 3; rf(s0 + c, s1 - c, y - c / 3, y + c / 3, pc); }
    } else {
      // porta: almofadas marcadas por dois frisos horizontais
      cor(escalaCor(o.tipo === "porta" ? cores.porta : cores.esquadria, 0.8));
      for (const f of [0.33, 0.66]) { const y = y0 + (y1 - y0) * f; rf(s0 + c, s1 - c, y - 0.012, y + 0.012, pc); }
    }
    // requadro (moldura) saliente em volta do vão
    cor(cores.moldura);
    const yb = porta ? y0 : y0;
    rf(s0 - m, s1 + m, y1, y1 + m, -pr);
    rf(s0 - m, s0, yb, y1, -pr); rf(s1, s1 + m, yb, y1, -pr);
    qf(s0 - m, 0, y1 + m, s1 + m, 0, y1 + m, s1 + m, -pr, y1 + m, s0 - m, -pr, y1 + m, 0, 0, 1);
    qf(s0 - m, 0, yb, s0 - m, -pr, yb, s0 - m, -pr, y1 + m, s0 - m, 0, y1 + m, -1, 0, 0);
    qf(s1 + m, 0, yb, s1 + m, -pr, yb, s1 + m, -pr, y1 + m, s1 + m, 0, y1 + m, 1, 0, 0);
    if (!porta) {
      // peitoril de pedra: avança da moldura, mais largo que o vão; o topo dele é o fundo do vão
      cor(VISUAL.cores.peitoril);
      caixaFace(s0 - m - Pe.sobra, s1 + m + Pe.sobra, -pr - Pe.avanco, r, y0 - Pe.espessura, y0, CF_EXT | CF_TOPO | CF_BASE | CF_INI | CF_FIM);
    }
  }
  const escalaCor = escala;

  /* Rodapé: faixa saliente no pé da parede, interrompida na porta e onde outro volume
     encosta. Frente e fundo passam o canto pela espessura do rodapé; as laterais param
     no canto: assim os dois rodapés de um canto não se sobrepõem. */
  function rodape(cx, fc, y0) {
    const { altura, relevo: rp } = VISUAL.rodape;
    const yt = fc.piso + altura;
    const passa = fc.lado === "frente" || fc.lado === "fundo";
    let trechos = [[fc.sA - (passa ? rp : 0), fc.sB + (passa ? rp : 0)]];
    for (const [a, b] of fc.cobertos) trechos = tiraIntervalo(trechos, a - rp, b + rp);
    for (const o of fc.aberturas) if (o.tipo === "porta" || o.tipo === "servico") trechos = tiraIntervalo(trechos, o.s0 - VISUAL.moldura.largura, o.s1 + VISUAL.moldura.largura);
    cor(cx.cores.rodape);
    for (const [a, b] of trechos) {
      if (b - a < 0.05) continue;
      const iniCanto = Math.abs(a - (fc.sA - (passa ? rp : 0))) < 1e-6, fimCanto = Math.abs(b - (fc.sB + (passa ? rp : 0))) < 1e-6;
      caixaFace(a, b, -rp, 0, y0, yt, CF_EXT | CF_TOPO | (iniCanto && !passa ? 0 : CF_INI) | (fimCanto && !passa ? 0 : CF_FIM));
    }
  }

  // Soleira de pedra na frente da porta (não debaixo da varanda, que já tem piso).
  function soleiras(cx, paredes) {
    const { meia, fundo } = VISUAL.soleira;
    for (const fc of paredes.faces) {
      if (fc.pav !== 0) continue;
      for (const o of fc.aberturas) {
        if (o.tipo !== "porta" && o.tipo !== "servico") continue;
        const sm = (o.s0 + o.s1) / 2, mm = o.tipo === "porta" ? meia : meia * 0.75;
        const u = fc.au + fc.du * sm + fc.nu * fundo / 2, v = fc.av + fc.dv * sm + fc.nv * fundo / 2;
        if (paredes.varanda && u > paredes.varanda.u0 && u < paredes.varanda.u1 && v > paredes.varanda.v0 && v < paredes.varanda.v1) continue;
        faceAtual(fc.au, fc.av, fc.du, fc.dv, fc.nu, fc.nv);
        janela(0, 0, 0, 0, 2);
        cor(VISUAL.cores.soleira);
        const a = Math.max(fc.sA, sm - mm), b = Math.min(fc.sB, sm + mm);
        caixaFace(a, b, -fundo, -0.001, pe(cx, cx.corpo), fc.piso - 0.004, CF_EXT | CF_TOPO | CF_INI | CF_FIM);
      }
    }
  }

  /* =====================================================================
     LOD0: TELHADOS
     ===================================================================== */
  function telhadosLOD0(cx, tels) {
    const { cores } = cx;
    for (const T of tels.ceramicos) {
      const sol = T.papel === "edicula" ? [] : tels.solidos;
      ES = cx.casa.semente & 255; ET = T.papel === "edicula" ? ST_ANEXO : cx.tipoST;
      janela(0, 0, 0, 0, 0);
      // águas
      modoTelhado(); cor(cores.telha);
      for (const f of T.facetas) emitePlano(pecasDoPlano(f, 0, T, sol, false, false), f.A, f.B, f.C, false);
      // forro do beiral (por baixo, fora das paredes)
      cor(cores.forro, 0.95);
      for (const f of T.facetas) emitePlano(pecasDoPlano(f, -T.t, T, sol, true, true), f.A, f.B, f.C - T.t, true);
      // testeira
      janela(0, 0, 0, 0, 2); cor(cores.forro);
      emiteTesteiras(testeiras(T, sol));
      // cumeeira e espigões
      modoTelhado(); janela(0, 0, 0, 0, 0);
      emiteCumeeiras(T, sol, cores.telha);
    }
  }

  /* Platibanda, laje e caixa de laje: parapeito com face de dentro, capa e o que fica lá
     dentro (fibrocimento escondido ou laje impermeabilizada). */
  function telhadoPlano(cx, iv, r, tel, lod) {
    const { e, cores } = cx;
    const topo = tel.platibanda, base = tel.base;
    const fibro = tel.tipo === "platibanda";
    const iu0 = r.u0 + e, iu1 = r.u1 - e, iv0 = r.v0 + e, iv1 = r.v1 - e;
    if (iu1 - iu0 < 0.3 || iv1 - iv0 < 0.3) return;
    janela(0, 0, 0, 0, lod === 0 ? 2 : 1);
    ET = cx.vols[iv].papel === "edicula" ? ST_ANEXO : cx.tipoST; EH = Math.round(base * 10);
    // faces de dentro do parapeito
    cor(cores.parede, 0.9);
    const yIn = base - 0.06;
    modoParede(iu0, iv0, 1, 0); quad(iu0, iv0, yIn, iu1, iv0, yIn, iu1, iv0, topo, iu0, iv0, topo, 0, 1, 0);
    modoParede(iu1, iv0, 0, 1); quad(iu1, iv0, yIn, iu1, iv1, yIn, iu1, iv1, topo, iu1, iv0, topo, -1, 0, 0);
    modoParede(iu1, iv1, -1, 0); quad(iu1, iv1, yIn, iu0, iv1, yIn, iu0, iv1, topo, iu1, iv1, topo, 0, -1, 0);
    modoParede(iu0, iv1, 0, -1); quad(iu0, iv1, yIn, iu0, iv0, yIn, iu0, iv0, topo, iu0, iv1, topo, 1, 0, 0);
    // cobertura de dentro
    modoTelhado(); janela(0, 0, 0, 0, 0);
    if (fibro) {
      // uma água de fibrocimento vencendo o lado curto, caindo para o fundo (ou para a direita)
      cor(cores.fibro);
      const i = tel.inclinacao;
      if (tel.cumeeira === "u") quadAuto(iu0, iv0, base + i * (iv1 - iv0), iu1, iv0, base + i * (iv1 - iv0), iu1, iv1, base, iu0, iv1, base, 0, 0, 1);
      else quadAuto(iu0, iv0, base + i * (iu1 - iu0), iu1, iv0, base, iu1, iv1, base, iu0, iv1, base + i * (iu1 - iu0), 0, 0, 1);
    } else {
      // laje com caimento para o fundo
      cor(cores.laje);
      const cai = (tel.caimento || 0) * (iv1 - iv0);
      quadAuto(iu0, iv0, base + cai, iu1, iv0, base + cai, iu1, iv1, base, iu0, iv1, base, 0, 0, 1);
    }
    if (lod !== 0) return;
    // capa: anel de caixas que não se sobrepõem (frente e fundo inteiros, laterais entre eles)
    const ov = VISUAL.capa.sobra, h = cx.R("muros.capa_m");
    janela(0, 0, 0, 0, 2); cor(cores.capaParede);
    const atras = cx.vols[iv].papel === "caixa_garagem" || cx.vols[iv].papel === "caixa_varanda";
    const fuOv = atras ? 0 : ov;                       // a caixa encosta no corpo atrás: sem sobra ali
    caixaUV(r.u0 - ov, r.v0 - ov, r.u1 + ov, iv0 + ov, topo, topo + h, B_TUDO);
    caixaUV(r.u0 - ov, iv1 - ov, r.u1 + ov, r.v1 + fuOv, topo, topo + h, B_TUDO);
    caixaUV(r.u0 - ov, iv0 + ov, iu0 + ov, iv1 - ov, topo, topo + h, B_DI | B_ES | B_TOPO | B_BASE);
    caixaUV(iu1 - ov, iv0 + ov, r.u1 + ov, iv1 - ov, topo, topo + h, B_DI | B_ES | B_TOPO | B_BASE);
  }

  /* =====================================================================
     LOD0: CAIXA DE LAJE (garagem ou varanda na frente do corpo)
     ===================================================================== */
  function caixaLajeLOD0(cx, iv) {
    const vol = cx.vols[iv], tel = cx.det.telhados[iv];
    const { e, cores } = cx;
    const varanda = vol.papel === "caixa_varanda";
    const cega = vol.cega;
    const topo = tel.platibanda, base = tel.base;
    const yo = base - VISUAL.caixa.viga, ceu = base - cx.casa.alturas.laje;
    const y0 = pe(cx, vol), piso = varanda ? cx.casa.alturas.piso : 0.0;
    const esc = VISUAL.escuroInterno;
    const abertoD = varanda && !cega.direita, abertoE = varanda && !cega.esquerda;
    ET = cx.tipoST; EH = Math.round(base * 10); ES = cx.casa.semente & 255;
    janela(0, 0, 0, 0, 2);
    const { u0, v0, u1, v1 } = vol;
    // frente: viga sobre o vão aberto (+ pontas das paredes laterais fechadas)
    cor(cores.parede);
    faceAtual(u0, v0, 1, 0, 0, -1);
    rf(0, u1 - u0, yo, topo, 0);
    if (!abertoE) rf(0, e, y0, yo, 0);
    if (!abertoD) rf(u1 - u0 - e, u1 - u0, y0, yo, 0);
    // laterais
    const lateral = (lado, aberto) => {
      const g = faceDoRet(vol, lado);
      faceAtual(g.a[0], g.a[1], g.d[0], g.d[1], g.n[0], g.n[1]);
      cor(cores.parede);
      if (aberto) {
        rf(0, g.L, yo, topo, 0);
        cor(cores.parede, esc); qf(e, 0, yo, g.L, 0, yo, g.L, e, yo, e, e, yo, 0, 0, -1);
        qf(0, e, yo, g.L, e, yo, g.L, e, ceu, 0, e, ceu, 0, -1, 0);
      } else {
        comAO(0, 3.0, 0.86); rf(0, g.L, y0, topo, 0); semAO();
        cor(cores.parede, esc);
        // face de dentro (do chão ao forro), sem o trecho da viga da frente
        const sF = lado === "direita" ? e : 0, sT = lado === "direita" ? g.L : g.L - e;
        qf(sF, e, y0, sT, e, y0, sT, e, ceu, sF, e, ceu, 0, -1, 0);
      }
    };
    lateral("direita", abertoD); lateral("esquerda", abertoE);
    // viga da frente: fundo e face de dentro
    cor(cores.parede, esc);
    faceAtual(u0, v0, 1, 0, 0, -1);
    qf(abertoE ? 0 : e, 0, yo, abertoD ? u1 - u0 : u1 - u0 - e, 0, yo, abertoD ? u1 - u0 : u1 - u0 - e, e, yo, abertoE ? 0 : e, e, yo, 0, 0, -1);
    qf(e, e, yo, u1 - u0 - e, e, yo, u1 - u0 - e, e, ceu, e, e, ceu, 0, -1, 0);
    // forro
    modoTelhado(); cor(cores.parede, esc * 1.1);
    quad(u0 + e, v0 + e, ceu, u1 - e, v0 + e, ceu, u1 - e, v1, ceu, u0 + e, v1, ceu, 0, 0, -1);
    // pilares de canto da varanda aberta
    const pw = VISUAL.caixa.pilar;
    cor(cores.parede);
    if (abertoE) caixaUV(u0, v0, u0 + pw, v0 + pw, piso, yo, B_FR | B_DI | B_FU | B_ES);
    if (abertoD) caixaUV(u1 - pw, v0, u1, v0 + pw, piso, yo, B_FR | B_DI | B_FU | B_ES);
    if (varanda) {
      // piso da varanda na altura do piso da casa
      cor(cx.cores.piso);
      caixaUV(u0, v0, u1, v1, y0, piso, B_FR | (cega.direita ? 0 : B_DI) | (cega.esquerda ? 0 : B_ES) | B_TOPO);
    }
    telhadoPlano(cx, iv, vol, tel, 0);
  }

  /* =====================================================================
     LOD0: GARAGEM LEVE (pergolado ou telha)
     Encosta no corpo, mas a estrutura começa fora do beiral dele: o beiral do corpo
     desce a ~2,6 m e a cobertura leve fica a 2,5-2,8 m. Assim a cobertura entra debaixo
     do beiral sem atravessá-lo.
     ===================================================================== */
  function garagemLOD0(cx, iv, tels, lod) {
    const vol = cx.vols[iv], tel = cx.det.telhados[iv], G = VISUAL.garagem;
    const { corpo, cores } = cx;
    const esq = Math.abs(vol.u1 - corpo.u0) < 0.05;          // garagem à esquerda do corpo
    // beiral do corpo do lado da garagem, e onde ele termina por baixo
    const fCorpo = cx.det.faces.find(f => f.volume === 0 && f.lado === (esq ? "esquerda" : "direita"));
    const Tc = tels.porVolume[0] && tels.porVolume[0].aguas;
    const bC = fCorpo ? fCorpo.beiral : 0;
    let afasta = G.folga;
    if (Tc && bC > 0 && cx.det.telhados[0].alturaBeiral - cx.t < tel.topo + 0.15) afasta = bC + G.folga;
    let ua = esq ? vol.u1 - afasta : vol.u0 + afasta;          // lado do corpo
    let ub = esq ? vol.u0 + 0.02 : vol.u1 - 0.02;              // lado da divisa
    if (Math.abs(ua - ub) < 1.5) return;                       // estreita demais para ficar de pé
    const a = Math.min(ua, ub), b = Math.max(ua, ub);
    const v0 = Math.max(vol.v0, 0) + 0.02, v1 = vol.v1;
    const base = tel.base, y0 = pe(cx, vol);
    ET = ST_ANEXO; EH = Math.round(base * 10); ES = cx.casa.semente & 255;
    janela(0, 0, 0, 0, lod === 0 ? 2 : 1);
    if (lod === 0) {
      // postes e vigas
      cor(VISUAL.cores.madeira);
      const ps = G.poste;
      for (const u of [a + 0.03, b - 0.03 - ps]) for (const v of [v0 + 0.15, v1 - 0.15 - ps]) caixaUV(u, v, u + ps, v + ps, y0, base - G.viga, B_FR | B_DI | B_FU | B_ES);
      for (const u of [a + 0.03, b - 0.03 - ps]) caixaUV(u, v0, u + ps, v1, base - G.viga, base, B_TUDO);
    }
    if (tel.tipo === "duas_aguas") {
      const W = { u0: a + 0.03, v0: v0 + 0.1, u1: b - 0.03, v1: v1 - 0.1 };
      const bb = G.beiral, T = telhadoAguas(W, base, tel.inclinacao, Math.min(0.1, cx.t), [bb, bb, bb, bb], [false, true, false, true], -1, null, 7);
      modoTelhado(); janela(0, 0, 0, 0, 0); cor(cores.telha);
      for (const f of T.facetas) emitePlano([f.P], f.A, f.B, f.C, false);
      if (lod === 0) {
        cor(cores.forro, 0.9);
        for (const f of T.facetas) emitePlano([f.P], f.A, f.B, f.C - T.t, true);
        janela(0, 0, 0, 0, 2); cor(cores.forro);
        emiteTesteiras(testeiras(T, []));
        modoTelhado(); janela(0, 0, 0, 0, 0);
        emiteCumeeiras(T, [], cores.telha);
      }
      return;
    }
    // pergolado: ripas atravessadas sobre as vigas
    cor(VISUAL.cores.madeira, 1.05);
    if (lod !== 0) { modoTelhado(); quad(a, v0, base + G.ripaAlt, b, v0, base + G.ripaAlt, b, v1, base + G.ripaAlt, a, v1, base + G.ripaAlt, 0, 0, 1); return; }
    const n = Math.max(2, Math.round((v1 - v0) / G.ripaPasso));
    for (let k = 0; k <= n; k++) {
      const v = v0 + (v1 - v0 - G.ripa) * k / n;
      caixaUV(a - 0.08, v, b + 0.08, v + G.ripa, base, base + G.ripaAlt, B_FR | B_FU | B_TOPO | B_BASE);
    }
  }

  /* =====================================================================
     LOD0: SOBRADO (friso da laje, fundo do balanço) e CAIXA D'ÁGUA
     ===================================================================== */
  function sobradoLOD0(cx) {
    const { sup, corpo, cores, resp1 } = cx;
    if (!sup) return;
    const { abaixo, acima, relevo: fr } = VISUAL.friso;
    janela(0, 0, 0, 0, 2); ET = ST_SOBRADO;
    if (sup.v0 < corpo.v0 - 0.01) { cor(cores.parede, 0.9); modoTelhado(); quad(sup.u0, sup.v0, resp1, sup.u1, sup.v0, resp1, sup.u1, corpo.v0, resp1, sup.u0, corpo.v0, resp1, 0, 0, -1); }
    if (sup.v1 < corpo.v1 - 0.01) { cor(cores.laje); modoTelhado(); quad(sup.u0, sup.v1, resp1, sup.u1, sup.v1, resp1, sup.u1, corpo.v1, resp1, sup.u0, corpo.v1, resp1, 0, 0, 1); }
    cor(cores.capaParede);
    const y0 = resp1 - abaixo, y1 = resp1 + acima;
    caixaUV(sup.u0 - fr, sup.v0 - fr, sup.u1 + fr, sup.v0, y0, y1, B_FR | B_DI | B_ES | B_TOPO | B_BASE);
    caixaUV(sup.u0 - fr, sup.v1, sup.u1 + fr, sup.v1 + fr, y0, y1, B_FU | B_DI | B_ES | B_TOPO | B_BASE);
    caixaUV(sup.u0 - fr, sup.v0, sup.u0, sup.v1, y0, y1, B_ES | B_TOPO | B_BASE);
    caixaUV(sup.u1, sup.v0, sup.u1 + fr, sup.v1, y0, y1, B_DI | B_TOPO | B_BASE);
  }

  function caixaDaguaLOD0(cx, tels) {
    const c = cx.det.caixaDagua;
    if (!c.aparente) return;
    const C = VISUAL.caixaDagua, { cores } = cx;
    // tamanho a partir dos litros: cilindro com altura ~0,62 do diâmetro
    const vol = c.litros / 1000, diam = Math.cbrt(4 * vol / (Math.PI * C.proporcao)), rr = diam / 2, hh = diam * C.proporcao;
    const bal = cx.sup ? cx.corpo.v0 - cx.sup.v0 : 0;
    const tel = cx.det.telhados[0];
    janela(0, 0, 0, 0, 2); ES = cx.casa.semente & 255;
    if (c.torre && tels.porVolume[0] && tels.porVolume[0].aguas) {
      // torre de alvenaria atravessando o telhado, com laje em cima
      const lado = diam + 2 * C.torreFolga, u = c.u, v = c.v - bal;
      const yb = tel.base - 0.3, yt = tel.topo + C.torreSobe;
      cor(cores.parede); comAO(yb, yt, 0.9);
      caixaUV(u - lado / 2, v - lado / 2, u + lado / 2, v + lado / 2, yb, yt, B_FR | B_DI | B_FU | B_ES);
      semAO(); modoTelhado(); cor(cores.laje);
      caixaUV(u - lado / 2 - 0.04, v - lado / 2 - 0.04, u + lado / 2 + 0.04, v + lado / 2 + 0.04, yt, yt + 0.08, B_TUDO);
      return;
    }
    if (tel.material !== "laje") return;
    const u = c.u, v = (c.vFrente !== null ? c.vFrente : c.v) + rr + 0.2 - bal, yb = tel.base - 0.02;
    const n = C.lados;
    cor(VISUAL.cores.caixaDagua);
    modoParede(u, v, 1, 0);
    for (let k = 0; k < n; k++) {
      const a0 = 2 * Math.PI * k / n, a1 = 2 * Math.PI * (k + 1) / n, am = (a0 + a1) / 2;
      quad(u + rr * Math.cos(a0), v + rr * Math.sin(a0), yb, u + rr * Math.cos(a1), v + rr * Math.sin(a1), yb,
           u + rr * Math.cos(a1), v + rr * Math.sin(a1), yb + hh, u + rr * Math.cos(a0), v + rr * Math.sin(a0), yb + hh, Math.cos(am), Math.sin(am), 0);
    }
    modoTelhado(); cor(VISUAL.cores.caixaDagua, 1.08);
    for (let k = 0; k < n; k++) {
      const a0 = 2 * Math.PI * k / n, a1 = 2 * Math.PI * (k + 1) / n, am = (a0 + a1) / 2, r2 = rr * 1.04;
      const Q = [u + r2 * Math.cos(a0), v + r2 * Math.sin(a0), yb + hh, u + r2 * Math.cos(a1), v + r2 * Math.sin(a1), yb + hh, u, v, yb + hh + C.tampa];
      poligono(Q, 3, Math.cos(am) * 0.5, Math.sin(am) * 0.5, 1);
    }
  }

  /* =====================================================================
     MUROS E PORTÕES
     ===================================================================== */
  // Trechos da linha de divisa onde a casa encosta (geminada) ou a garagem leve ocupa:
  // ali não há muro, a parede ou a estrutura é a divisa.
  function trechosSemMuro(cx, m, L, du, dv) {
    const out = [];
    const { vols, sup } = cx;
    if (m.lado !== "direita" && m.lado !== "esquerda" && m.lado !== "fundo") return out;
    const rets = vols.map(v => ({ r: v, leve: v.papel === "garagem_leve" })).concat(sup ? [{ r: sup, leve: false }] : []);
    for (const { r, leve } of rets) {
      // projeção do retângulo na linha e distância dele até a linha
      const proj = [[r.u0, r.v0], [r.u1, r.v0], [r.u1, r.v1], [r.u0, r.v1]].map(([u, v]) => {
        const s = (u - m.a[0]) * du + (v - m.a[1]) * dv;
        const dist = (u - m.a[0]) * (-dv) + (v - m.a[1]) * du;   // >0 para dentro do lote
        return [s, dist];
      });
      const dmin = Math.min(...proj.map(p => p[1]));
      if (dmin > (leve ? 0.6 : 0.3)) continue;
      const s0 = Math.min(...proj.map(p => p[0])), s1 = Math.max(...proj.map(p => p[0]));
      if (s1 < 0 || s0 > L) continue;
      out.push([s0 - 0.05, s1 + 0.05]);
    }
    return out;
  }

  function murosLOD0(cx, lod) {
    const { det, R, cores, casa } = cx;
    const e = R("muros.espessura_m"), capa = R("muros.capa_m"), passo = R("muros.pilarete_passo_m"), degrau = R("muros.degrau_m");
    const wp = R("portoes.pilarete_m"), P = VISUAL.pilarete, ov = VISUAL.capa.sobra;
    const g = cx.chao, jit = cx.p.jitter;
    ES = casa.semente & 255; ET = ST_ANEXO;
    const temFrente = casa.muroFrente !== "nenhum";
    for (const m of det.muros) {
      if (m.tipo === "nenhum" || !(m.altura > 0)) continue;
      const ax = m.a[0], az = m.a[1], L = Math.hypot(m.b[0] - ax, m.b[1] - az);
      if (L < 0.5) continue;
      const du = (m.b[0] - ax) / L, dv = (m.b[1] - az) / L;
      const nu = dv, nv = -du;                 // para FORA do lote (o lote fica à esquerda de a->b)
      faceAtual(ax, az, du, dv, nu, nv);
      const gradil = m.gradil > 0;
      const hMuro = m.altura + jit, hGrad = gradil ? m.gradil + jit : 0;
      const hPil = Math.max(hMuro, hGrad) + P.sobe;
      EH = Math.round(hPil * 10);
      // trechos com muro
      const lateral = m.lado === "direita" || m.lado === "esquerda";
      let ini = 0, fim = L;
      if (lateral) { if (temFrente) ini = wp; fim = L - wp; }   // os pilares de canto são da frente e do fundo
      let trechos = [[ini, fim]];
      for (const vz of m.vaos || []) trechos = tiraIntervalo(trechos, vz.u0 - m.a[0], vz.u1 - m.a[0]);
      for (const [a, b] of trechosSemMuro(cx, m, L, du, dv)) trechos = tiraIntervalo(trechos, a, b);
      const chaoS = s => g(ax + du * s, az + dv * s);
      const yb = s0 => Math.min(chaoS(s0[0]), chaoS(s0[1])) - VISUAL.enterra;
      for (const [s0, s1] of trechos) {
        if (s1 - s0 < 0.05) continue;
        const pilIni = !(lateral && Math.abs(s0 - ini) < 1e-6), pilFim = !(lateral && Math.abs(s1 - fim) < 1e-6);
        // pilaretes: nas pontas e a cada `passo` (ou mais espaçados num lado muito longo)
        const n = Math.min(VISUAL.pilaresMax + 1, Math.max(1, Math.round((s1 - s0) / passo)));
        const cortes = [];
        for (let k = 0; k <= n; k++) cortes.push(s0 + (s1 - s0) * k / n);
        // degrau: topo constante entre dois pilaretes, no múltiplo de `degrau` do chão
        const topoDe = (a, b) => degrau > 0 ? Math.round(chaoS((a + b) / 2) / degrau) * degrau : 0;
        if (lod !== 0) {
          // LOD1: caixa por trecho de degrau, sem pilarete nem capa
          cor(cores.muro); janela(0, 0, 0, 0, 1);
          let k = 0;
          while (k < n) {
            const t = topoDe(cortes[k], cortes[k + 1]);
            let j = k + 1;
            while (j < n && Math.abs(topoDe(cortes[j], cortes[j + 1]) - t) < 1e-6) j++;
            caixaFace(cortes[k], cortes[j], 0, e, yb([cortes[k], cortes[j]]), t + hMuro, CF_EXT | CF_INT | CF_TOPO | CF_INI | CF_FIM);
            if (gradil) { cor(cores.portao, 1.4); rf(cortes[k], cortes[j], t + hMuro, t + hGrad, e / 2 - 0.01); qf(cortes[k], e / 2 + 0.01, t + hMuro, cortes[j], e / 2 + 0.01, t + hMuro, cortes[j], e / 2 + 0.01, t + hGrad, cortes[k], e / 2 + 0.01, t + hGrad, 0, -1, 0); cor(cores.muro); }
            k = j;
          }
          continue;
        }
        janela(0, 0, 0, 0, 2);
        let k = 0;
        while (k < n) {
          const t = topoDe(cortes[k], cortes[k + 1]);
          let j = k + 1;
          while (j < n && Math.abs(topoDe(cortes[j], cortes[j + 1]) - t) < 1e-6) j++;
          const a = cortes[k], b = cortes[j], y0 = yb([a, b]), ht = t + hMuro;
          cor(cores.muro); comAO(t, t + hMuro, 0.88);
          caixaFace(a, b, 0, e, y0, ht, CF_EXT | CF_INT | CF_INI | CF_FIM);
          semAO();
          cor(cores.capa);
          caixaFace(a, b, -ov, e + ov, ht, ht + capa, CF_TUDO);
          if (gradil) gradilLOD0(cx, a + wp, b - wp, e, ht + capa, t + hGrad);
          k = j;
        }
        // pilaretes
        cor(cores.muro);
        for (let q = 0; q <= n; q++) {
          if ((q === 0 && !pilIni) || (q === n && !pilFim)) continue;
          const c = q === 0 ? s0 + wp / 2 : q === n ? s1 - wp / 2 : cortes[q];
          const t = Math.max(topoDe(cortes[Math.max(0, q - 1)], cortes[Math.max(1, q)]), topoDe(cortes[Math.min(n - 1, q)], cortes[Math.min(n, q + 1)]));
          const yt = t + hPil;
          cor(cores.muro);
          caixaFace(c - wp / 2, c + wp / 2, -P.fundo, e + P.fundo, yb([c - wp / 2, c + wp / 2]), yt, CF_EXT | CF_INT | CF_INI | CF_FIM);
          cor(cores.capa);
          caixaFace(c - wp / 2 - 0.015, c + wp / 2 + 0.015, -P.fundo - 0.015, e + P.fundo + 0.015, yt, yt + capa, CF_TUDO);
        }
      }
      // portões nos vãos da frente
      for (const vz of m.vaos || []) {
        const a = vz.u0 - m.a[0], b = vz.u1 - m.a[0];
        portao(cx, a, b, e, m, hMuro, hGrad, chaoS((a + b) / 2), lod);
      }
    }
  }

  function gradilLOD0(cx, a, b, e, y0, y1) {
    if (b - a < 0.1 || y1 - y0 < 0.1) return;
    const G = VISUAL.gradil;
    cor(cx.cores.portao);
    const n = Math.min(G.maxBarras, Math.max(2, Math.round((b - a) / G.passo)));
    const meio = e / 2, w = G.barra / 2;
    for (let k = 0; k <= n; k++) {
      const s = a + (b - a) * k / n;
      rf(s - w, s + w, y0, y1 - G.corrimao, meio - w);
      qf(s - w, meio + w, y0, s + w, meio + w, y0, s + w, meio + w, y1 - G.corrimao, s - w, meio + w, y1 - G.corrimao, 0, -1, 0);
    }
    caixaFace(a, b, meio - G.corrimao / 2, meio + G.corrimao / 2, y1 - G.corrimao, y1, CF_EXT | CF_INT | CF_TOPO | CF_BASE | CF_INI | CF_FIM);
  }

  function portao(cx, s0, s1, e, m, hMuro, hGrad, chao, lod) {
    const Pt = VISUAL.portao, { cores } = cx;
    // o portão acompanha o degrau do chão onde está; a altura é a do muro ou do gradil
    const t = Math.round(chao / cx.R("muros.degrau_m")) * cx.R("muros.degrau_m");
    const hP = t + (hGrad > 0 ? hGrad : m.tipo === "muro_baixo" ? hMuro + 0.35 : hMuro);
    const y0 = chao + Pt.chao;
    const a = s0 + 0.01, b = s1 - 0.01, p0 = e / 2 - Pt.espessura / 2, p1 = e / 2 + Pt.espessura / 2;
    janela(0, 0, 0, 0, lod === 0 ? 2 : 1);
    cor(cores.portao);
    const grade = m.tipo === "gradil" || m.tipo === "muro_baixo";
    if (lod !== 0) { caixaFace(a, b, p0, p1, y0, hP, CF_EXT | CF_INT | CF_TOPO); return; }
    if (!grade) {
      caixaFace(a, b, p0, p1, y0, hP, CF_EXT | CF_INT | CF_TOPO | CF_INI | CF_FIM);
      // chapa com frisos horizontais
      cor(cores.portao, 0.82);
      for (let k = 1; k <= 3; k++) { const y = y0 + (hP - y0) * k / 4; caixaFace(a + 0.04, b - 0.04, p0 - 0.01, p0, y - Pt.friso / 2, y + Pt.friso / 2, CF_EXT | CF_TOPO | CF_BASE); }
      return;
    }
    // grade: quadro e barras
    const q = 0.045;
    caixaFace(a, b, p0, p1, hP - q, hP, CF_EXT | CF_INT | CF_TOPO | CF_BASE);
    caixaFace(a, b, p0, p1, y0, y0 + q, CF_EXT | CF_INT | CF_TOPO);
    caixaFace(a, a + q, p0, p1, y0 + q, hP - q, CF_EXT | CF_INT | CF_FIM);
    caixaFace(b - q, b, p0, p1, y0 + q, hP - q, CF_EXT | CF_INT | CF_INI);
    const n = Math.max(2, Math.round((b - a) / Pt.barraPasso)), w = 0.011;
    for (let k = 1; k < n; k++) {
      const s = a + (b - a) * k / n;
      rf(s - w, s + w, y0 + q, hP - q, (p0 + p1) / 2 - w);
      qf(s - w, (p0 + p1) / 2 + w, y0 + q, s + w, (p0 + p1) / 2 + w, y0 + q, s + w, (p0 + p1) / 2 + w, hP - q, s - w, (p0 + p1) / 2 + w, hP - q, 0, -1, 0);
    }
  }

  /* =====================================================================
     CHÃO DO LOTE: grama, pisos, piscina
     ===================================================================== */
  function chaoLOD(cx, lod, saidaChao) {
    const { det, casa, cores } = cx;
    const noRelevo = !saidaChao;                    // chão dentro da casa rígida: segue o declive
    const anterior = SA;
    if (saidaChao) SA = saidaChao;
    const g = noRelevo ? cx.chao : () => 0;
    modoChao(); janela(0, 0, 0, 0, 1); ET = 0; EH = 0; ES = casa.semente & 255; semAO();
    const k = casa.lote.cantos;
    const Q = [k.frenteEsq, k.frenteDir, k.fundoDir, k.fundoEsq];
    // grama: o quadrilátero do lote; o leque sai de um vértice côncavo, se houver
    let inicio = 0;
    for (let i = 0; i < 4; i++) {
      const a = Q[(i + 3) % 4], b = Q[i], c = Q[(i + 1) % 4];
      if ((b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]) < 0) inicio = i;
    }
    const P = [];
    for (let i = 0; i < 4; i++) { const q = Q[(inicio + i) % 4]; P.push(q[0], q[1], g(q[0], q[1])); }
    cor(lod === 2 ? mistura(cores.grama, cores.piso, 0.18) : cores.grama);
    // o leque de 4 pontos a partir do vértice côncavo vale para quadrilátero simples
    quadChao(P);
    if (lod === 2) { SA = anterior; return; }
    const L = VISUAL.camadas;
    const ret = (r, y, c) => {
      if (!r || r.u1 - r.u0 < 0.05 || r.v1 - r.v0 < 0.05) return;
      cor(c);
      quad(r.u0, r.v0, g(r.u0, r.v0) + y, r.u1, r.v0, g(r.u1, r.v0) + y, r.u1, r.v1, g(r.u1, r.v1) + y, r.u0, r.v1, g(r.u0, r.v1) + y, 0, 0, 1);
    };
    // entrada de carro: a rampa até a garagem (e o chão dentro dela)
    const gv = cx.vols.find(v => v.papel === "caixa_garagem" || v.papel === "garagem_leve");
    const corRampa = mistura(cores.piso, VISUAL.cores.concreto, 0.5);
    if (det.rampa) ret(det.rampa, L.rampa, corRampa);
    if (lod === 1) { SA = anterior; return; }
    if (gv) ret({ u0: gv.u0 + (gv.papel === "caixa_garagem" ? cx.e : 0), v0: Math.max(gv.v0, 0), u1: gv.u1 - (gv.papel === "caixa_garagem" ? cx.e : 0), v1: gv.v1 }, L.rampa, corRampa);
    if (det.caminho) ret(det.caminho, L.caminho, cores.piso);
    ret(det.calcadaServico, L.servico, VISUAL.cores.concreto);
    if (det.piscina) piscina(cx, det.piscina, g);
    SA = anterior;
  }
  function quadChao(P) {
    // quadrilátero do lote: dois triângulos com a diagonal que sai do vértice 0 (côncavo,
    // se houver); cada um vira polígono próprio para o leque não cruzar a borda
    poligono([P[0], P[1], P[2], P[3], P[4], P[5], P[6], P[7], P[8]], 3, 0, 0, 1);
    poligono([P[0], P[1], P[2], P[6], P[7], P[8], P[9], P[10], P[11]], 3, 0, 0, 1);
  }
  function piscina(cx, p, g) {
    const L = VISUAL.camadas, b = p.borda, { cores } = cx;
    const y = (u, v) => g(u, v);
    const ya = L.agua, yb = L.borda;
    cor(cores.piscina, 1.0);
    quad(p.u0, p.v0, y(p.u0, p.v0) + ya, p.u1, p.v0, y(p.u1, p.v0) + ya, p.u1, p.v1, y(p.u1, p.v1) + ya, p.u0, p.v1, y(p.u0, p.v1) + ya, 0, 0, 1);
    cor(VISUAL.cores.borda);
    const g0 = y((p.u0 + p.u1) / 2, (p.v0 + p.v1) / 2);
    // borda: anel sem sobreposição (frente e fundo inteiros, laterais entre eles)
    caixaUV(p.u0 - b, p.v0 - b, p.u1 + b, p.v0, g0, g0 + yb, B_FR | B_DI | B_ES | B_TOPO);
    caixaUV(p.u0 - b, p.v1, p.u1 + b, p.v1 + b, g0, g0 + yb, B_FU | B_DI | B_ES | B_TOPO);
    caixaUV(p.u0 - b, p.v0, p.u0, p.v1, g0, g0 + yb, B_ES | B_TOPO);
    caixaUV(p.u1, p.v0, p.u1 + b, p.v1, g0, g0 + yb, B_DI | B_TOPO);
    // paredes de dentro, da borda até a água
    cor(cores.piscina, 0.75);
    modoChao();
    quad(p.u0, p.v0, g0 + ya, p.u1, p.v0, g0 + ya, p.u1, p.v0, g0 + yb, p.u0, p.v0, g0 + yb, 0, 1, 0);
    quad(p.u1, p.v1, g0 + ya, p.u0, p.v1, g0 + ya, p.u0, p.v1, g0 + yb, p.u1, p.v1, g0 + yb, 0, -1, 0);
    quad(p.u0, p.v1, g0 + ya, p.u0, p.v0, g0 + ya, p.u0, p.v0, g0 + yb, p.u0, p.v1, g0 + yb, 1, 0, 0);
    quad(p.u1, p.v0, g0 + ya, p.u1, p.v1, g0 + ya, p.u1, p.v1, g0 + yb, p.u1, p.v0, g0 + yb, -1, 0, 0);
    modoChao();
  }

  /* =====================================================================
     LOD1
     ===================================================================== */
  function paredeLOD1(cx, fc, tels) {
    if (fc.inteira && fc.papel !== "corpo") return;
    const vol = cx.vols[fc.iv], r = fc.pav === 1 ? cx.sup : vol;
    const y0 = fc.pav === 1 ? cx.resp1 : pe(cx, r), y1 = topoDaFace(cx, fc, tels);
    estiloParede(cx, fc);
    // atributo janela: vãos com janela, vão, largura, tipo e piso (ver o topo do arquivo)
    if (fc.mascara) {
      const larg = fc.largUsada || fc.larg;
      janela(fc.mascara & 255, Math.min(255, Math.round(fc.vao / 0.02)), Math.min(255, Math.round(larg / 0.02)),
             (fc.tipoJ << 6) | Math.min(63, Math.round(fc.piso * 10)), fc.tipoJ === 2 ? 3 : 0);
    } else janela(0, Math.min(255, Math.round(fc.vao / 0.02)), 0, Math.min(63, Math.round(fc.piso * 10)), 1);
    faceAtual(fc.au, fc.av, fc.du, fc.dv, fc.nu, fc.nv);
    cor(cx.cores.parede);
    if (fc.pav === 0) comAO(0, 3.0, 0.86);
    rf(fc.sA, fc.sB, y0, y1, 0);
    semAO();
    const T = tels.porVolume[fc.iv] && tels.porVolume[fc.iv].aguas;
    janela(0, 0, 0, 0, 1);
    if (T && (fc.pav === 1 || !(vol.papel === "corpo" && cx.sup))) {
      const pf = perfil(T, fc.au, fc.av, fc.du, fc.dv, fc.sA, fc.sB);
      let max = -Infinity; for (const q of pf) if (q[1] > max) max = q[1];
      if (pf.length >= 2 && max - y1 > 0.01) {
        const ladoK = LADOS.indexOf(fc.lado), sobe = !(T.beirais[ladoK] > 0) && !T.aguas[ladoK] ? VISUAL.oitao : 0;
        const P = [fc.sA, y1, fc.sB, y1];
        for (let k = pf.length - 1; k >= 0; k--) P.push(pf[k][0], Math.max(y1, pf[k][1] + sobe));
        const n = P.length / 2, Q = new Array(n * 3);
        for (let k = 0; k < n; k++) { const s = P[2 * k]; Q[3 * k] = fc.au + fc.du * s; Q[3 * k + 1] = fc.av + fc.dv * s; Q[3 * k + 2] = P[2 * k + 1]; }
        poligono(Q, n, fc.nu, fc.nv, 0);
      }
    }
    // portas: placa escura 2 cm à frente da parede
    for (const o of fc.aberturas) {
      if (o.tipo !== "porta" && o.tipo !== "servico") continue;
      cor(o.tipo === "porta" ? cx.cores.porta : cx.cores.esquadria, 0.85);
      rf(o.s0, o.s1, o.y0, o.y1, -0.02);
    }
  }

  function telhadosLOD1(cx, tels) {
    for (const T of tels.ceramicos) {
      const sol = T.papel === "edicula" ? [] : tels.solidos;
      ET = T.papel === "edicula" ? ST_ANEXO : cx.tipoST;
      modoTelhado(); janela(0, 0, 0, 0, 0); cor(cx.cores.telha);
      for (const f of T.facetas) emitePlano(pecasDoPlano(f, 0, T, sol, false, false), f.A, f.B, f.C, false);
      janela(0, 0, 0, 0, 1); cor(cx.cores.forro);
      emiteTesteiras(testeiras(T, sol));
    }
  }

  function caixaLajeLOD1(cx, iv) {
    const vol = cx.vols[iv], tel = cx.det.telhados[iv], { cores } = cx;
    const y0 = pe(cx, vol), topo = tel.platibanda, yo = tel.base - VISUAL.caixa.viga;
    ET = cx.tipoST; EH = Math.round(tel.base * 10); janela(0, 0, 0, 0, 1);
    cor(cores.parede); comAO(0, 3, 0.86);
    caixaUV(vol.u0, vol.v0, vol.u1, vol.v1, y0, topo, B_FR | B_DI | B_ES);
    semAO();
    // o vão aberto como placa escura
    cor(cores.parede, 0.42);
    faceAtual(vol.u0, vol.v0, 1, 0, 0, -1);
    const w = vol.u1 - vol.u0, pw = vol.papel === "caixa_varanda" ? VISUAL.caixa.pilar : cx.e;
    rf(pw, w - pw, vol.papel === "caixa_varanda" ? cx.casa.alturas.piso : 0, yo, -0.02);
    telhadoPlano(cx, iv, vol, tel, 1);
  }

  /* =====================================================================
     LOD2: caixa + telhado na cor da telha, lote numa peça
     ===================================================================== */
  function lod2(cx, tels) {
    const { vols, det, cores, corpo } = cx;
    vols.forEach((vol, iv) => {
      if (vol.papel === "garagem_leve") return;
      const tel = det.telhados[iv];
      const y0 = pe(cx, vol);
      const T = tels.porVolume[iv] && tels.porVolume[iv].aguas;
      const topoParede = iv === 0 ? (tel.material === "ceramica" ? tel.base : tel.platibanda) : (tel.material === "ceramica" ? tel.base : tel.platibanda || tel.topo);
      ET = iv === 0 ? cx.tipoST : ST_ANEXO; EH = Math.round(topoParede * 10); janela(0, 0, 0, 0, 1);
      cor(cores.parede);
      if (iv === 0 && T) {
        // corpo: caixa e as águas sem beiral; a empena fecha o triângulo nos lados sem água
        const W = T.W, T0 = telhadoAguas(W, tel.base, tel.inclinacao, cx.t, [0, 0, 0, 0], T.aguas, -1, null, 0);
        caixaUV(W.u0, W.v0, W.u1, W.v1, y0, tel.base, B_FR | B_DI | B_FU | B_ES);
        for (let k = 0; k < 4; k++) {
          if (T0.aguas[k]) continue;
          const g = faceDoRet(W, LADOS[k]);
          const pf = perfil(T0, g.a[0], g.a[1], g.d[0], g.d[1], 0, g.L);
          if (pf.length < 2) continue;
          const Q = [g.a[0], g.a[1], tel.base, g.a[0] + g.d[0] * g.L, g.a[1] + g.d[1] * g.L, tel.base];
          for (let q = pf.length - 1; q >= 0; q--) Q.push(g.a[0] + g.d[0] * pf[q][0], g.a[1] + g.d[1] * pf[q][0], pf[q][1]);
          modoParede(g.a[0], g.a[1], g.d[0], g.d[1]);
          poligono(Q, Q.length / 3, g.n[0], g.n[1], 0);
        }
        modoTelhado(); cor(cores.telha); janela(0, 0, 0, 0, 0);
        for (const f of T0.facetas) emitePlano([f.P], f.A, f.B, f.C, false);
        return;
      }
      const r = iv === 0 && cx.sup ? { u0: Math.min(vol.u0, cx.sup.u0), v0: Math.min(vol.v0, cx.sup.v0), u1: Math.max(vol.u1, cx.sup.u1), v1: Math.max(vol.v1, cx.sup.v1) } : vol;
      // volume encostado no corpo: sem a face que encosta
      const encosta = iv === 0 ? 0 : Math.abs(vol.v1 - corpo.v0) < 1e-6 ? B_FU : Math.abs(vol.v0 - corpo.v1) < 1e-6 ? B_FR
                    : Math.abs(vol.u1 - corpo.u0) < 1e-6 ? B_DI : Math.abs(vol.u0 - corpo.u1) < 1e-6 ? B_ES : 0;
      caixaUV(r.u0, r.v0, r.u1, r.v1, y0, topoParede, (B_FR | B_DI | B_FU | B_ES) & ~encosta);
      modoTelhado(); janela(0, 0, 0, 0, 0);
      cor(tel.material === "ceramica" ? cores.telha : tel.material === "fibrocimento" ? cores.fibro : cores.laje);
      quad(r.u0, r.v0, topoParede, r.u1, r.v0, topoParede, r.u1, r.v1, topoParede, r.u0, r.v1, topoParede, 0, 0, 1);
    });
  }

  /* =====================================================================
     EXPANDE
     ===================================================================== */
  function prepara(casa, saida) {
    SA = saida;
    OX = casa.origem[0]; OZ = casa.origem[1]; UX = casa.eixoU[0]; UZ = casa.eixoU[1]; VX = casa.eixoV[0]; VZ = casa.eixoV[1];
    BX = casa.origem[0]; BZ = casa.origem[1];
    ES = casa.semente & 255; ET = casa.pavimentos === 2 ? ST_SOBRADO : ST_CASA;
    EH = Math.min(65535, Math.round(casa.alturas.respaldo * 10));
    semAO(); janela(0, 0, 0, 0, 2); modoParede(0, 0, 1, 0);
  }

  function expande(casa, nivel, saida, saidaChao, regras, opcoes) {
    if (saidaChao && !saidaChao.pos) { opcoes = regras; regras = saidaChao; saidaChao = null; }
    regras = regras || casa.regras || REGRAS_PADRAO;
    if (!regras) throw new Error("CasasGeometria.expande: faltam as regras (arq.regras do casas.bin)");
    if (!saida || !saida.pos) throw new Error("CasasGeometria.expande: saída inválida (use criaSaida())");
    const det = (opcoes && opcoes.detalhe) || Formato().detalha(casa, regras);
    const cx = contexto(casa, det, regras, opcoes);
    const t0 = NTRI;
    prepara(casa, saida);
    const tels = montaTelhados(cx);
    const nv = nivel | 0;
    if (nv === 2) {
      lod2(cx, tels);
      chaoLOD(cx, 2, saidaChao);
    } else {
      const paredes = planejaParedes(cx);
      if (nv === 0) {
        for (const fc of paredes.faces) paredeLOD0(cx, fc, tels);
        soleiras(cx, paredes);
        telhadosLOD0(cx, tels);
        for (const iv of tels.planos) telhadoPlano(cx, iv, iv === 0 && cx.sup ? cx.sup : cx.vols[iv], det.telhados[iv], 0);
        cx.vols.forEach((v, iv) => {
          if (v.papel === "caixa_garagem" || v.papel === "caixa_varanda") caixaLajeLOD0(cx, iv);
          else if (v.papel === "garagem_leve") garagemLOD0(cx, iv, tels, 0);
        });
        sobradoLOD0(cx);
        caixaDaguaLOD0(cx, tels);
        murosLOD0(cx, 0);
        chaoLOD(cx, 0, saidaChao);
      } else {
        for (const fc of paredes.faces) paredeLOD1(cx, fc, tels);
        telhadosLOD1(cx, tels);
        for (const iv of tels.planos) telhadoPlano(cx, iv, iv === 0 && cx.sup ? cx.sup : cx.vols[iv], det.telhados[iv], 1);
        cx.vols.forEach((v, iv) => {
          if (v.papel === "caixa_garagem" || v.papel === "caixa_varanda") caixaLajeLOD1(cx, iv);
          else if (v.papel === "garagem_leve") garagemLOD0(cx, iv, tels, 1);
        });
        if (cx.sup) {
          // fundo do balanço e laje do térreo atrás do andar
          const { sup, corpo, resp1 } = cx;
          janela(0, 0, 0, 0, 1); modoTelhado();
          if (sup.v0 < corpo.v0 - 0.01) { cor(cx.cores.parede, 0.9); quad(sup.u0, sup.v0, resp1, sup.u1, sup.v0, resp1, sup.u1, corpo.v0, resp1, sup.u0, corpo.v0, resp1, 0, 0, -1); }
          if (sup.v1 < corpo.v1 - 0.01) { cor(cx.cores.laje); quad(sup.u0, sup.v1, resp1, sup.u1, sup.v1, resp1, sup.u1, corpo.v1, resp1, sup.u0, corpo.v1, resp1, 0, 0, 1); }
        }
        murosLOD0(cx, 1);
        chaoLOD(cx, 1, saidaChao);
      }
    }
    SA = null;
    return NTRI - t0;
  }

  /* Aberturas decididas por regra para uma casa (o mesmo que o LOD0 constrói e o LOD1
     pinta). Para testes e para o QA: [{ volume, papel, lado, pavimento, cega, vao,
     mascara, aberturas: [{tipo, s0, s1, y0, y1}] }], s em metros ao longo da face. */
  function aberturas(casa, regras, opcoes) {
    regras = regras || casa.regras || REGRAS_PADRAO;
    const det = (opcoes && opcoes.detalhe) || Formato().detalha(casa, regras);
    const cx = contexto(casa, det, regras, opcoes);
    const p = planejaParedes(cx);
    return { faces: p.faces.map(fc => ({ volume: fc.iv, papel: fc.papel, lado: fc.lado, pavimento: fc.pav, cega: fc.cega,
                                         pode: fc.pode, vao: fc.vao, nVaos: fc.nVaos, sA: fc.sA, sB: fc.sB, cobertos: fc.cobertos,
                                         mascara: fc.mascara, aberturas: fc.aberturas.map(o => Object.assign({}, o)) })),
             areaJanela: p.areaJanela, alvoArea: p.alvoArea };
  }

  root.CasasGeometria = Object.freeze({
    VISUAL, criaSaida, reinicia, expande, aberturas, usaRegras,
    // geometria plana, exposta para teste
    _plano: Object.freeze({ corta, subtrai, area, semiplanos, intervalo, telhadoAguas })
  });
})(globalThis);

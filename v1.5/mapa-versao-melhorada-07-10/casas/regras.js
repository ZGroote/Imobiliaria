/* Motor de regras das casas: lote -> plano da casa.

   Puro e determinístico: recebe o lote (polígono em metros do mapa), a distância até a
   rua, o relevo e as pistas do volume antigo, e devolve os CAMPOS do registro de
   casas/formato.js, ou a recusa com o motivo. Sem DOM, sem THREE, sem estado global.
   Os números saem todos de regras/<cidade>.json (`carrega`).

   COMO A PRECISÃO FICA IGUAL EM QUALQUER MÁQUINA
   A moldura é quantizada ANTES de qualquer decisão: o ângulo vai para u16 e a origem
   para decímetros, exatamente como o plano grava. O polígono do lote é então levado
   para essa moldura quantizada, e todo o planejamento acontece nela, em decímetros
   inteiros. O arredondamento é sempre PARA DENTRO do lote (teto no lado de baixo, piso
   no de cima). Assim, o que o navegador decodifica é literalmente o que foi conferido
   aqui, sem os ±7 cm que a quantização da origem introduziria depois do fato.

   ORDEM DAS REGRAS (casas/ESPEC.md)
     1. moldura e testada     2. recuos       3. partido em malha estrutural
     4. telhado               5. aberturas    6. muros e portões
     7. quintal/piscina       8. cores
   Cada etapa sorteia no próprio fluxo (casas/sorteio.js). O plano candidato é
   codificado, decodificado e detalhado (CasasFormato.detalha) e só então validado: o
   gerador e o navegador leem a mesma coisa que foi validada. */
(function (root) {
  "use strict";
  const Sorteio = () => root.CasasSorteio;
  const Formato = () => root.CasasFormato;

  /* =====================================================================
     GEOMETRIA PLANA (pontos [x, z] ou [u, v]; anéis sem ponto de fechamento)
     ===================================================================== */
  function areaAssinada(a) {
    let s = 0;
    for (let i = 0, n = a.length; i < n; i++) { const p = a[i], q = a[(i + 1) % n]; s += p[0] * q[1] - q[0] * p[1]; }
    return s / 2;
  }
  function centroide(a) {
    let A = 0, cx = 0, cz = 0;
    for (let i = 0, n = a.length; i < n; i++) {
      const p = a[i], q = a[(i + 1) % n], f = p[0] * q[1] - q[0] * p[1];
      A += f; cx += (p[0] + q[0]) * f; cz += (p[1] + q[1]) * f;
    }
    if (Math.abs(A) < 1e-12) { let x = 0, z = 0; for (const p of a) { x += p[0]; z += p[1]; } return [x / a.length, z / a.length]; }
    return [cx / (3 * A), cz / (3 * A)];
  }
  // Tira o ponto de fechamento e os vértices repetidos (< 1 cm): lado de 0 m não tem
  // direção, e a testada sairia de um lado sem direção.
  function limpaAnel(anel) {
    const out = [];
    for (const p of anel) {
      const q = out[out.length - 1];
      if (!q || Math.hypot(p[0] - q[0], p[1] - q[1]) > 0.01) out.push([p[0], p[1]]);
    }
    while (out.length > 1 && Math.hypot(out[0][0] - out[out.length - 1][0], out[0][1] - out[out.length - 1][1]) <= 0.01) out.pop();
    return out;
  }
  // Anti-horário no sentido matemático de (x, z): o interior fica à ESQUERDA de cada aresta.
  const antiHorario = a => areaAssinada(a) < 0 ? a.slice().reverse() : a;

  function dentro(x, z, a) {
    let s = false;
    for (let i = 0, j = a.length - 1; i < a.length; j = i++) {
      const p = a[j], q = a[i];
      if ((p[1] > z) !== (q[1] > z) && x < (q[0] - p[0]) * (z - p[1]) / (q[1] - p[1]) + p[0]) s = !s;
    }
    return s;
  }
  function distPS(px, pz, ax, az, bx, bz) {
    const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz;
    let t = L2 > 0 ? ((px - ax) * dx + (pz - az) * dz) / L2 : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    return Math.hypot(px - ax - t * dx, pz - az - t * dz);
  }

  /* Cortes de P pela reta coord[eixo] = c (eixo 1: reta v = c, devolve os u). Regra
     de meia-aberta: um vértice exatamente na reta conta uma vez só. */
  function cortes(P, eixo, c) {
    const o = 1 - eixo, out = [];
    for (let i = 0, n = P.length; i < n; i++) {
      const a = P[i], b = P[(i + 1) % n];
      if ((a[eixo] > c) !== (b[eixo] > c)) out.push(a[o] + (c - a[eixo]) * (b[o] - a[o]) / (b[eixo] - a[eixo]));
    }
    return out.sort((x, y) => x - y);
  }

  /* Faixa livre: o maior intervalo [lo, hi] no outro eixo que fica DENTRO de P para
     toda reta coord[eixo] = c com c em [a, b]. É exato porque entre dois vértices
     consecutivos as bordas são lineares: basta amostrar em volta de cada vértice e nas
     pontas. `ref` escolhe o pedaço quando a seção tem mais de um (lote em L). */
  function faixa(P, eixo, a, b, ref) {
    const eps = 1e-6, cs = [a + eps, Math.max(a + eps, b - eps)];
    for (const p of P) { const c = p[eixo]; if (c > a + eps && c < b - eps) cs.push(c - eps, c + eps); }
    cs.sort((x, y) => x - y);
    let lo = -Infinity, hi = Infinity;
    for (const c of cs) {
      const k = cortes(P, eixo, c);
      const alvo = Number.isFinite(lo) ? (lo + hi) / 2 : ref;
      let melhor = null, sobra = -Infinity;
      for (let i = 0; i + 1 < k.length; i += 2) {
        if (k[i] <= alvo && alvo <= k[i + 1]) { melhor = [k[i], k[i + 1]]; break; }
        const s = Math.min(hi, k[i + 1]) - Math.max(lo, k[i]);
        if (s > sobra) { sobra = s; melhor = [k[i], k[i + 1]]; }
      }
      if (!melhor) return null;
      lo = Math.max(lo, melhor[0]); hi = Math.min(hi, melhor[1]);
      if (lo > hi) return null;
    }
    return [lo, hi];
  }

  // Segmento ab corta o INTERIOR do retângulo r? (Liang–Barsky, estrito na borda.)
  function segCortaRet(ax, az, bx, bz, r) {
    let t0 = 0, t1 = 1;
    const dx = bx - ax, dz = bz - az;
    const p = [-dx, dx, -dz, dz], q = [ax - r.u0, r.u1 - ax, az - r.v0, r.v1 - az];
    for (let i = 0; i < 4; i++) {
      if (p[i] === 0) { if (q[i] <= 0) return false; continue; }
      const t = q[i] / p[i];
      if (p[i] < 0) { if (t > t1) return false; if (t > t0) t0 = t; }
      else { if (t < t0) return false; if (t < t1) t1 = t; }
    }
    return t1 - t0 > 1e-9;
  }
  const encolhe = (r, t) => ({ u0: r.u0 + t, v0: r.v0 + t, u1: r.u1 - t, v1: r.v1 - t });

  /* Retângulo (na moldura de P) dentro de P com tolerância `tol`: o centro está dentro
     e nenhuma aresta de P atravessa o retângulo encolhido de `tol`. As duas condições
     juntas bastam para qualquer polígono simples, côncavo inclusive. */
  function retDentro(r, P, tol) {
    const s = encolhe(r, tol);
    const cu = (r.u0 + r.u1) / 2, cv = (r.v0 + r.v1) / 2;
    if (!dentro(cu, cv, P)) return false;
    if (s.u1 <= s.u0 || s.v1 <= s.v0) return true;
    for (let i = 0, n = P.length; i < n; i++) {
      const a = P[i], b = P[(i + 1) % n];
      if (segCortaRet(a[0], a[1], b[0], b[1], s)) return false;
    }
    return true;
  }
  const retSobrepoe = (a, b, tol) => Math.min(a.u1, b.u1) - Math.max(a.u0, b.u0) > tol && Math.min(a.v1, b.v1) - Math.max(a.v0, b.v0) > tol;
  const retAnel = r => [[r.u0, r.v0], [r.u1, r.v0], [r.u1, r.v1], [r.u0, r.v1]];

  // Área da união de retângulos alinhados (compressão de coordenadas; n é pequeno).
  function areaUniaoRets(rs) {
    const us = [...new Set(rs.flatMap(r => [r.u0, r.u1]))].sort((a, b) => a - b);
    let A = 0;
    for (let i = 0; i + 1 < us.length; i++) {
      const um = (us[i] + us[i + 1]) / 2, iv = [];
      for (const r of rs) if (r.u0 < um && um < r.u1) iv.push([r.v0, r.v1]);
      iv.sort((a, b) => a[0] - b[0]);
      let L = 0, s = -Infinity, e = -Infinity;
      for (const [a, b] of iv) { if (a > e) { if (e > s) L += e - s; s = a; e = b; } else if (b > e) e = b; }
      if (e > s) L += e - s;
      A += L * (us[i + 1] - us[i]);
    }
    return A;
  }

  /* Área de P ∩ (Q1 ∪ Q2 ∪ ...), exata, para polígonos simples quaisquer.

     Fatia o plano em faixas verticais nas abscissas de todo vértice e de todo cruzamento
     de arestas. Dentro de uma faixa nenhuma borda se cruza, então o comprimento da seção
     é linear em x e a área da faixa é a seção no meio vezes a largura. É a mesma conta
     que o QA atual faz com shapely (`intersection` contra a união da fita), sem união
     de polígonos e sem dependência. */
  function areaIntersecao(P, Qs) {
    if (!Qs.length) return 0;
    const pts = [P, ...Qs];
    let x0 = Infinity, x1 = -Infinity;
    for (const p of P) { if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; }
    const xs = [x0, x1];
    for (const A of pts) for (const p of A) if (p[0] > x0 && p[0] < x1) xs.push(p[0]);
    // cruzamentos entre arestas de anéis diferentes
    const ar = pts.map(A => A.map((p, i) => [p, A[(i + 1) % A.length]]));
    for (let a = 0; a < ar.length; a++) for (let b = a + 1; b < ar.length; b++) {
      for (const [p1, p2] of ar[a]) for (const [q1, q2] of ar[b]) {
        const d = (p2[0] - p1[0]) * (q2[1] - q1[1]) - (p2[1] - p1[1]) * (q2[0] - q1[0]);
        if (d === 0) continue;
        const t = ((q1[0] - p1[0]) * (q2[1] - q1[1]) - (q1[1] - p1[1]) * (q2[0] - q1[0])) / d;
        const s = ((q1[0] - p1[0]) * (p2[1] - p1[1]) - (q1[1] - p1[1]) * (p2[0] - p1[0])) / d;
        if (t > 0 && t < 1 && s > 0 && s < 1) { const x = p1[0] + t * (p2[0] - p1[0]); if (x > x0 && x < x1) xs.push(x); }
      }
    }
    xs.sort((a, b) => a - b);
    const secao = (A, x) => {
      const z = [];
      for (let i = 0, n = A.length; i < n; i++) {
        const a = A[i], b = A[(i + 1) % n];
        if ((a[0] < x) !== (b[0] < x)) z.push(a[1] + (x - a[0]) * (b[1] - a[1]) / (b[0] - a[0]));
      }
      z.sort((u, v) => u - v);
      const iv = [];
      for (let i = 0; i + 1 < z.length; i += 2) iv.push([z[i], z[i + 1]]);
      return iv;
    };
    let area = 0;
    for (let i = 0; i + 1 < xs.length; i++) {
      const dx = xs[i + 1] - xs[i];
      if (dx <= 1e-12) continue;
      const xm = (xs[i] + xs[i + 1]) / 2;
      const ip = secao(P, xm);
      if (!ip.length) continue;
      let uq = [];
      for (const Q of Qs) uq.push(...secao(Q, xm));
      if (!uq.length) continue;
      uq.sort((a, b) => a[0] - b[0]);
      const un = [];
      for (const iv of uq) { const l = un[un.length - 1]; if (l && iv[0] <= l[1]) l[1] = Math.max(l[1], iv[1]); else un.push(iv.slice()); }
      let L = 0;
      for (const a of ip) for (const b of un) { const s = Math.min(a[1], b[1]) - Math.max(a[0], b[0]); if (s > 0) L += s; }
      area += L * dx;
    }
    return area;
  }

  /* =====================================================================
     REGRAS: carga e leitura
     ===================================================================== */
  /* Toda regra numérica tem `_nota`. A checagem roda ao carregar: número solto, sem
     explicação, não entra (é a regra do arquivo, e o teste também cobra). Um objeto
     com número direto precisa da própria nota, exceto a TABELA pura (só números,
     como os pesos por bairro) pendurada num objeto que já tem nota: a nota do pai
     explica a tabela inteira. */
  function semNota(no, caminho, out, paiTemNota) {
    if (Array.isArray(no)) { no.forEach((x, i) => { if (x && typeof x === "object") semNota(x, caminho + "[" + i + "]", out, paiTemNota); }); return out; }
    if (!no || typeof no !== "object") return out;
    const chaves = Object.keys(no).filter(k => k !== "_nota" && k !== "a_conferir");
    const numerico = k => typeof no[k] === "number" || (Array.isArray(no[k]) && no[k].some(x => typeof x === "number"));
    const temNota = typeof no._nota === "string";
    const tabelaPura = chaves.length > 0 && chaves.every(k => typeof no[k] === "number");
    if (chaves.some(numerico) && !temNota && !(tabelaPura && paiTemNota)) out.push(caminho || "(raiz)");
    for (const k of chaves) if (no[k] && typeof no[k] === "object") semNota(no[k], caminho ? caminho + "." + k : k, out, temNota);
    return out;
  }
  function carrega(json) {
    const faltam = semNota(json, "", []);
    if (faltam.length) throw new Error("regras sem _nota: " + faltam.slice(0, 8).join(", "));
    const F = Formato();
    const R = c => F.regra(json, c);
    return { json, R, versao: R("versao"), cidade: json.cidade };
  }

  const semAcento = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

  /* Bairro do lote (ESPEC regra 3), na ordem: centro antigo, conjunto habitacional,
     classe média, comum. `grupo` = estatística da quadra (mediana e CV da área dos
     lotes de PLANTA da mesma quadra/loteamento); lote sintético é igual por construção
     e não serve de prova de "lotes iguais". */
  function classificaBairro({ loteamento, fonte, area, distCentro, testada, grupo }, regras) {
    const R = regras.R;
    if (distCentro <= R("bairros.centro_antigo.raio_m")) return "centro";
    const nome = semAcento(loteamento);
    if (nome && R("bairros.conjunto_habitacional.nomes").some(t => nome.includes(semAcento(t)))) return "conjunto";
    if (fonte !== "sintetico" && grupo && grupo.n >= R("bairros.conjunto_habitacional.grupo_min_lotes") &&
        grupo.mediana <= R("bairros.conjunto_habitacional.grupo_area_mediana_max_m2") &&
        grupo.cv <= R("bairros.conjunto_habitacional.grupo_cv_max")) return "conjunto";
    if (area >= R("bairros.classe_media.area_min_m2")) return "medio";
    return "comum";
  }

  function classeTestada(T, regras) {
    const lim = regras.R("lote.classes_testada.limites_m"), nomes = regras.json.lote.classes_testada.nomes;
    for (let i = 0; i < lim.length; i++) if (T < lim[i]) return nomes[i];
    return nomes[lim.length];
  }

  /* =====================================================================
     1. LADOS DO LOTE E TESTADA
     ===================================================================== */
  /* Junta arestas quase colineares em LADOS. Começa no vértice de maior giro para não
     partir um lado ao meio no começo do anel. `anel` já anti-horário. */
  function ladosDoAnel(A, regras) {
    const n = A.length, lim = regras.R("testada.lado_angulo_max_graus") * Math.PI / 180;
    const dir = i => { const a = A[i], b = A[(i + 1) % n], dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz) || 1; return [dx / L, dz / L]; };
    const giro = i => { const p = dir((i - 1 + n) % n), q = dir(i); return Math.acos(Math.max(-1, Math.min(1, p[0] * q[0] + p[1] * q[1]))); };
    let ini = 0, maior = -1;
    for (let i = 0; i < n; i++) { const g = giro(i); if (g > maior + 1e-12) { maior = g; ini = i; } }
    const lados = [];
    let cur = null;
    for (let k = 0; k < n; k++) {
      const i = (ini + k) % n, d = dir(i);
      if (cur && Math.acos(Math.max(-1, Math.min(1, cur.d0[0] * d[0] + cur.d0[1] * d[1]))) < lim) { cur.arestas.push(i); cur.ib = (i + 1) % n; }
      else { if (cur) lados.push(cur); cur = { ia: i, ib: (i + 1) % n, d0: d, arestas: [i] }; }
    }
    lados.push(cur);
    for (const s of lados) {
      const a = A[s.ia], b = A[s.ib], dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz) || 1e-9;
      s.a = a; s.b = b; s.comprimento = L;
      s.fora = [dz / L, -dx / L];            // normal para fora (anel anti-horário)
    }
    return lados;
  }

  /* Amostra o lado e mede quanto dele está na rua (distância até a borda da fita). As
     pontas ficam de fora: o canto de um lote de esquina encosta na fita da outra rua. */
  function amostraRua(A, lado, distRua, regras) {
    const R = regras.R, passo = R("testada.amostra_passo_m"), mg = R("testada.amostra_margem");
    const dmax = R("testada.rua_distancia_max_m");
    const segs = lado.arestas.map(i => [A[i], A[(i + 1) % A.length]]);
    const Ls = segs.map(([a, b]) => Math.hypot(b[0] - a[0], b[1] - a[1]));
    const tot = Ls.reduce((x, y) => x + y, 0);
    const n = Math.max(3, Math.ceil(tot * (1 - 2 * mg) / passo));
    let na = 0, soma = 0;
    for (let k = 0; k < n; k++) {
      let s = tot * (mg + (1 - 2 * mg) * (n === 1 ? 0.5 : k / (n - 1)));
      let j = 0;
      while (j < segs.length - 1 && s > Ls[j]) { s -= Ls[j]; j++; }
      const [a, b] = segs[j], t = Ls[j] > 0 ? Math.min(1, s / Ls[j]) : 0;
      const d = distRua(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t);
      if (d <= dmax) na++;
      soma += Math.max(-5, Math.min(20, d));
    }
    return { cobertura: na / n, media: soma / n };
  }

  /* Lados de rua e testada (ESPEC regra 1): o lado mais perto da rua; empate pelo `fa`
     do volume antigo, depois pela normal do lote sintético, depois o lado mais curto
     (a testada de lote de esquina costuma ser o lado curto). Sem lado de rua, a testada
     é inferida pelas mesmas pistas. */
  function analisaLados(A, distRua, dica, regras) {
    const R = regras.R;
    const lados = ladosDoAnel(A, regras);
    const lmin = R("testada.lado_min_m"), cob = R("testada.rua_cobertura_min"), tmin = R("lote.testada_min_m");
    for (const s of lados) {
      const m = s.comprimento >= lmin ? amostraRua(A, s, distRua, regras) : { cobertura: 0, media: 20 };
      s.cobertura = m.cobertura; s.media = m.media; s.rua = s.comprimento >= lmin && m.cobertura >= cob;
    }
    const pista = s => {
      if (dica && Number.isFinite(dica.fa) && dica.fa >= 0 && dica.fa <= 360) {
        const a = dica.fa * Math.PI / 180;
        return s.fora[0] * Math.cos(a) + s.fora[1] * Math.sin(a);
      }
      if (dica && dica.normal) return s.fora[0] * dica.normal[0] + s.fora[1] * dica.normal[1];
      return -s.comprimento / 1000;
    };
    let cands = lados.filter(s => s.rua), inferida = false, testada;
    const longos = cands.filter(s => s.comprimento >= tmin);
    if (longos.length) cands = longos;
    if (cands.length) {
      const melhor = Math.min(...cands.map(s => s.media));
      const emp = cands.filter(s => s.media <= melhor + R("testada.empate_m"));
      testada = emp.reduce((a, b) => pista(b) > pista(a) + 1e-9 ? b : a, emp[0]);
    } else {
      inferida = true;
      let pool = lados.filter(s => s.comprimento >= tmin);
      if (!pool.length) pool = lados.filter(s => s.comprimento >= lmin);
      if (!pool.length) pool = lados;
      const temPista = dica && ((Number.isFinite(dica.fa) && dica.fa >= 0 && dica.fa <= 360) || dica.normal);
      testada = temPista ? pool.reduce((a, b) => pista(b) > pista(a) + 1e-9 ? b : a, pool[0])
                         : pool.reduce((a, b) => b.media < a.media - 1e-9 ? b : a, pool[0]);
    }
    return { lados, testada, inferida };
  }

  /* =====================================================================
     MOLDURA QUANTIZADA
     ===================================================================== */
  function moldura(A, an, centroQ, regras) {
    const t = an.testada;
    // u = da ponta b para a ponta a: com o anel anti-horário, é a direita de quem olha
    // o lote da rua (ver formato.js). v = (u_z, -u_x) entra no lote.
    let ux = t.a[0] - t.b[0], uz = t.a[1] - t.b[1];
    const L = Math.hypot(ux, uz); ux /= L; uz /= L;
    let th = Math.atan2(uz, ux);
    let ang = Math.round(th / (2 * Math.PI) * 65536);
    ang = ((ang % 65536) + 65536) % 65536;
    const thq = ang * 2 * Math.PI / 65536, U = [Math.cos(thq), Math.sin(thq)], V = [U[1], -U[0]];
    const mx = (t.a[0] + t.b[0]) / 2, mz = (t.a[1] + t.b[1]) / 2;
    const ox = Math.round(mx * 10 - centroQ[0]), oz = Math.round(mz * 10 - centroQ[1]);
    const O = [(centroQ[0] + ox) / 10, (centroQ[1] + oz) / 10];
    const loc = p => [(p[0] - O[0]) * U[0] + (p[1] - O[1]) * U[1], (p[0] - O[0]) * V[0] + (p[1] - O[1]) * V[1]];
    const P = A.map(loc);
    return { angulo: ang, origemX: ox, origemZ: oz, O, U, V, P, testada: L, local: loc };
  }

  /* =====================================================================
     2..8. PLANEJAMENTO
     ===================================================================== */
  const dmCima = x => Math.ceil(x * 10 - 1e-6);
  const dmBaixo = x => Math.floor(x * 10 + 1e-6);
  const clamp = (x, a, b) => x < a ? a : x > b ? b : x;

  // Lado de alvenaria em vãos de 3,0 a 4,5 m: 4,6..5,9 m não divide; desce para 4,5.
  function malhaDm(L, R) {
    const [a, b] = R("malha.vao_m").map(x => Math.round(x * 10));
    if (L < a) return 0;
    for (let n = Math.ceil(L / b); n >= 1; n--) if (L / n >= a && L / n <= b) return L;
    // não divide: maior comprimento <= L que divide
    for (let x = L; x >= a; x--) for (let n = Math.ceil(x / b); n >= 1; n--) if (x / n >= a && x / n <= b) return x;
    return 0;
  }

  function planeja(ent, regras) {
    const R = regras.R, S = Sorteio(), F = Formato();
    const info = { bairro: ent.bairro };
    const recusa = (motivo, extra) => ({ ok: false, motivo, info: Object.assign(info, extra || {}) });

    // ---- 1. lote e moldura ---------------------------------------------------------
    const A = antiHorario(limpaAnel(ent.anel));
    if (A.length < 3) return recusa("lote_invalido");
    const areaLote = Math.abs(areaAssinada(A));
    if (!(areaLote > 20)) return recusa("lote_invalido");
    const an = analisaLados(A, ent.distRua, ent.dica, regras);
    info.testadaInferida = an.inferida;
    const mol = moldura(A, an, ent.centroQuarteirao, regras);
    const P = mol.P;
    // arestas de rua (Código Civil vale para o VIZINHO, não para a rua)
    const rua = new Array(A.length).fill(false);
    for (const s of an.lados) if (s.rua) for (const i of s.arestas) rua[i] = true;
    const vizinhas = [];
    for (let i = 0; i < P.length; i++) if (!rua[i]) vizinhas.push([P[i], P[(i + 1) % P.length]]);

    const T = mol.testada, Tdm = Math.round(T * 10);
    // fundo: seção do lote pela linha do meio da testada
    const secM = faixa(P, 0, -0.25, 0.25, 0.5);
    let fundo = secM ? secM[1] : Math.max(...P.map(p => p[1]));
    // cantos de fundo: os vértices mais ao fundo de cada lado, em coordenadas normalizadas
    const vmax = Math.max(...P.map(p => p[1]));
    let fe = P[0], fd = P[0], se = -Infinity, sd = -Infinity;
    for (const p of P) {
      const a = p[1] / Math.max(vmax, 1e-6) - p[0] / Math.max(T, 1e-6), b = p[1] / Math.max(vmax, 1e-6) + p[0] / Math.max(T, 1e-6);
      if (a > se) { se = a; fe = p; }
      if (b > sd) { sd = b; fd = p; }
    }
    info.testada = T; info.fundo = fundo; info.area = areaLote;
    if (T < R("lote.testada_min_m")) return recusa("testada_curta");
    if (fundo < R("lote.fundo_min_m")) return recusa("fundo_curto");
    if (T > R("lote.testada_max_m") || fundo > R("lote.fundo_max_m") || areaLote > R("lote.area_max_m2")) return recusa("lote_grande");
    const cantos = { fundoEsqU: Math.round(fe[0] * 10), fundoEsqV: Math.round(fe[1] * 10),
                     fundoDirU: Math.round(fd[0] * 10), fundoDirV: Math.round(fd[1] * 10) };
    for (const k in cantos) if (cantos[k] < F.FAIXA[k][0] || cantos[k] > F.FAIXA[k][1]) return recusa("fora_do_alcance");
    if (mol.origemX < F.FAIXA.origemX[0] || mol.origemX > F.FAIXA.origemX[1] ||
        mol.origemZ < F.FAIXA.origemZ[0] || mol.origemZ > F.FAIXA.origemZ[1] || Tdm > F.FAIXA.testada[1]) return recusa("fora_do_alcance");
    // quadrilátero do plano contra o polígono real
    const quad = [[-T / 2, 0], [T / 2, 0], [cantos.fundoDirU / 10, cantos.fundoDirV / 10], [cantos.fundoEsqU / 10, cantos.fundoEsqV / 10]];
    const aq = Math.abs(areaAssinada(quad));
    const inter = aq > 0 ? areaIntersecao(antiHorario(quad), [P]) : 0;
    const iou = inter / Math.max(1e-9, aq + areaLote - inter);
    const nLados = an.lados.filter(s => s.comprimento >= R("testada.lado_min_m")).length;
    const irregular = nLados > 4 || iou < R("lote.irregular_iou_min") ? 1 : 0;
    info.iou = iou;
    const classe = classeTestada(T, regras);
    info.classe = classe;

    // esquina: outro lado de rua quase perpendicular à testada
    let esqRua = false, dirRua = false;
    const cosMax = R("testada.esquina_cos_max");
    for (const s of an.lados) {
      if (!s.rua || s === an.testada) continue;
      const c = s.fora[0] * an.testada.fora[0] + s.fora[1] * an.testada.fora[1];
      if (Math.abs(c) >= cosMax) continue;
      const lu = s.fora[0] * mol.U[0] + s.fora[1] * mol.U[1];
      if (lu < 0) esqRua = true; else dirRua = true;
    }
    info.esquina = esqRua || dirRua;
    info.duasFrentes = an.lados.some(s => s.rua && s !== an.testada &&
      s.fora[0] * an.testada.fora[0] + s.fora[1] * an.testada.fora[1] <= -cosMax);

    // relevo: declividade real (sem o exagero do renderizador)
    let declV = 0, declU = 0;
    if (ent.relevo) {
      const W = (u, v) => [mol.O[0] + u * mol.U[0] + v * mol.V[0], mol.O[1] + u * mol.U[1] + v * mol.V[1]];
      const h = (u, v) => { const p = W(u, v); return ent.relevo(p[0], p[1]); };
      const f = Math.max(1, fundo - 1), t = Math.max(1, T - 1);
      declV = (h(0, fundo - 0.5) - h(0, 0.5)) / f;
      declU = (h(T / 2 - 0.5, fundo / 2) - h(-T / 2 + 0.5, fundo / 2)) / t;
    }
    const embasamento = Math.max(Math.abs(declV), Math.abs(declU)) > R("alturas.declive_embasamento") ? 1 : 0;
    info.declive = Math.max(Math.abs(declV), Math.abs(declU));

    // ---- sementes e fluxos -------------------------------------------------------
    const sem = S.semente(ent.slug, ent.idLote, regras.versao) >>> 8;    // 24 bits gravados
    const fl = nome => S.fluxo(sem, nome);
    const bairro = ent.bairro;
    const pb = chave => { const t = R(chave); return t[bairro] !== undefined ? t[bairro] : t.comum; };

    // ---- 2. recuos e decisões de partido ---------------------------------------------
    const fR = fl("recuos"), fP = fl("partido");
    const centroAlinha = bairro === "centro" && T < R("bairros.centro_antigo.testada_max_m");
    const recuoF = centroAlinha ? Math.round(R("recuos.frontal_centro_antigo_m") * 10)
      : Math.round(R("recuos.frontal_m") * 10) + fR.inteiro(...R("recuos.frontal_extra_m").map(x => Math.round(x * 10)));
    const recuoFmin = centroAlinha ? recuoF : Math.round(R("recuos.frontal_m") * 10);
    let sobrado = (ent.dica && ent.dica.pavimentos >= R("selecao.sobrado_pavimentos")) || fP.chance(pb("partidos.sobrado_promove_prob"));
    if (T < R("partidos.sobrado_testada_min_m")) sobrado = false;
    const portaoMin = 4 * R("portoes.pilarete_m") + R("portoes.garagem_largura_m")[0] + R("portoes.social_largura_m");
    let temGaragem = !centroAlinha && T >= portaoMin && fP.chance(pb("partidos.garagem_prob"));
    // lado encostado: estreito sempre um lado (o da garagem); padrão por sorteio; centro, os dois
    const ladoSorteado = fP.chance(0.5) ? 1 : 2;              // 1 esquerda, 2 direita
    let garLado = temGaragem ? ladoSorteado : 0;
    const ruaDe = l => l === 1 ? esqRua : dirRua;
    if (garLado && ruaDe(garLado) && !ruaDe(3 - garLado)) garLado = 3 - garLado;   // garagem longe da esquina
    const vaoMin = Math.round(R("malha.vao_m")[0] * 10), lat = Math.round(R("recuos.lateral_janela_m") * 10);
    const ambos = (esqRua ? 0 : 1) | (dirRua ? 0 : 2);         // nunca encosta do lado da rua
    const umLado = () => { let l = garLado || ladoSorteado; if (ruaDe(l)) l = 3 - l; return ruaDe(l) ? 0 : l; };
    let encostado = 0;
    if (centroAlinha) encostado = ambos;
    else if (classe === "estreito" || (classe === "padrao" && fR.chance(pb("recuos.encosta_prob")))) encostado = umLado();
    // Lote estreitíssimo: com os dois afastamentos de 1,5 m não cabe um vão de 3,0 m,
    // então encosta um lado; se nem assim cabe, os dois.
    if (!encostado && Tdm - 2 * lat < vaoMin) encostado = umLado();
    if (encostado !== ambos && Tdm - (encostado ? lat : 2 * lat) < vaoMin) encostado = ambos;

    // forma do térreo
    let pesosForma = Object.assign({}, R("partidos.pesos")[bairro] || R("partidos.pesos").comum);
    delete pesosForma._nota; delete pesosForma.a_conferir;
    if (classe === "estreito" || centroAlinha) { pesosForma.L = 0; pesosForma.T = 0; pesosForma.garagem_lateral = 0; }
    if (centroAlinha) pesosForma.caixa_laje = 0;
    if (encostado || sobrado) { pesosForma.L = 0; pesosForma.T = 0; }
    if (!temGaragem) pesosForma.garagem_lateral = 0;
    const forma = fP.pesos(pesosForma) || "retangular";
    const caixaGaragem = temGaragem && fP.chance(R("partidos.caixa_garagem_prob"));
    const lFrente = fP.chance(R("partidos.L_frente_prob"));
    const querEdicula = fundo >= R("malha.edicula_fundo_lote_min_m") && fP.chance(pb("partidos.edicula_prob"));

    // ---- 4. telhado (sorteado antes: as tentativas abaixo não o reembaralham) ----------
    const fT = fl("telhado");
    let pesosTel = Object.assign({}, R("telhado.pesos")[bairro] || R("telhado.pesos").comum);
    delete pesosTel._nota; delete pesosTel.a_conferir;
    let telhado = fT.pesos(pesosTel) || "quatro_aguas";
    // Face na divisa não recebe água do vizinho: empena na divisa.
    if (encostado && (telhado === "quatro_aguas" || telhado === "duas_aguas_perpendicular")) telhado = "duas_aguas_paralela";
    // Fachada no alinhamento não tem beiral sobre a calçada: platibanda.
    const beiralMaxDm = Math.round(R("telhado.beiral_m")[1] * 10);
    if (recuoF < beiralMaxDm + 1 && (telhado === "quatro_aguas" || telhado.startsWith("duas"))) telhado = "platibanda";
    const ceram = telhado === "quatro_aguas" || telhado.startsWith("duas");
    const meioPct = v => Math.round(v * 200);            // fração -> passos de 0,5 %
    const cincoCm = v => Math.round(v * 20);             // m -> passos de 5 cm
    let inclinacao, beiral;
    if (ceram) { inclinacao = fT.inteiro(...R("telhado.ceramica_inclinacao").map(meioPct)); beiral = fT.inteiro(...R("telhado.beiral_m").map(cincoCm)); }
    else if (telhado === "platibanda") { inclinacao = fT.inteiro(...R("telhado.fibrocimento_inclinacao").map(meioPct)); beiral = 0; }
    else { inclinacao = fT.inteiro(...R("telhado.laje_caimento").map(meioPct)); beiral = 0; }
    const ediculaMeiaAgua = ceram && fT.chance(R("telhado.edicula_meia_agua_prob")) ? 1 : 0;
    const garagemTelha = ceram && fT.chance(R("telhado.garagem_telha_prob")) ? 1 : 0;

    // ---- 3b. alturas ----------------------------------------------------------------
    const fH = fl("alturas");
    const cm = x => Math.round(x * 100);
    const piso = fH.inteiro(...R("alturas.piso_m").map(cm));
    let pd = fH.inteiro(...R("alturas.pe_direito_m").map(cm));
    const laje = cm(R("alturas.laje_m")), n = sobrado ? 2 : 1;
    const [resMin, resMax] = R(sobrado ? "alturas.respaldo_sobrado_m" : "alturas.respaldo_terrea_m").map(cm);
    const [pdMin, pdMax] = R("alturas.pe_direito_m").map(cm);
    pd = clamp(pd, Math.max(pdMin, Math.ceil((resMin - piso) / n - laje)), Math.min(pdMax, Math.floor((resMax - piso) / n - laje)));
    const querBalanco = sobrado && fH.chance(R("alturas.balanco_prob"));
    const balancoSorteio = fH.inteiro(1, Math.round(R("alturas.balanco_max_m") * 10));

    // ---- 6. muro, 8. paleta ----------------------------------------------------------
    const fM = fl("muros");
    let muro = centroAlinha ? "nenhum" : (fM.pesos(R("muros.frente_pesos")[bairro] || R("muros.frente_pesos").comum) || "muro_alto");
    const fC = fl("cores");
    const pesosPal = R("cores.paleta_pesos")[bairro] || R("cores.paleta_pesos").comum;
    const paleta = parseInt(fC.pesos(pesosPal) || "0", 10);

    // ocupação alvo: a do volume antigo dentro da faixa
    const [tmin, tmax] = R("ocupacao.taxa_alvo");
    const taxaAlvo = ent.dica && ent.dica.ocupacao > 0 ? clamp(ent.dica.ocupacao, tmin, tmax) : (tmin + tmax) / 2;

    // ---- helpers de faixa em dm -----------------------------------------------------
    const limU = (v0, v1, ref) => { const f = faixa(P, 1, v0 / 10, v1 / 10, ref === undefined ? 0 : ref / 10); return f ? [dmCima(f[0]), dmBaixo(f[1])] : null; };
    const limV = (u0, u1, ref) => { const f = faixa(P, 0, u0 / 10, u1 / 10, ref / 10); return f ? [dmCima(f[0]), dmBaixo(f[1])] : null; };
    const rFundo = Math.round(R("recuos.fundo_m") * 10), rEsq0 = Math.round(R("recuos.esquina_lateral_m") * 10);
    const rLat = l => (encostado & l) ? 0 : (ruaDe(l) ? Math.max(lat, rEsq0) : lat);
    const fx = k => R(k).map(x => Math.round(x * 10));

    /* Monta um plano para uma tentativa {forma, garagem, edicula}. Devolve os campos ou
       uma string com o motivo. Tudo em dm, na moldura quantizada. */
    function monta(t) {
      const fV = fl("volumes");
      const rL = rLat(1), rR = rLat(2);
      let ala = null, alaTipo = 0, corpo, edic = null;
      const forma = t.forma;
      // profundidades fixas que empurram o corpo para trás
      let caixa = null;
      if (forma === "caixa_laje") {
        const g = t.garagem && t.caixaGaragem;
        caixa = { tipo: g ? 4 : 5, w: fV.inteiro(...fx(g ? "malha.caixa_garagem_largura_m" : "malha.caixa_varanda_largura_m")),
                  d: fV.inteiro(...fx(g ? "malha.caixa_garagem_profundidade_m" : "malha.caixa_varanda_profundidade_m")) };
        caixa.w = malhaDm(caixa.w, R); caixa.d = malhaDm(caixa.d, R);
      }
      let alaD = 0, alaW = 0;
      if (forma === "L" || forma === "T") {
        alaW = fV.inteiro(...fx("malha.ala_largura_m"));
        alaD = fV.inteiro(...fx("malha.ala_profundidade_m"));
      }
      const frenteL = forma === "L" && t.lFrente;
      let v0c = recuoF + (caixa ? caixa.d : 0) + (frenteL ? alaD : 0);

      // garagem leve: faixa lateral até a divisa, do alinhamento ou da frente do corpo
      let gar = null;
      if (forma === "garagem_lateral") {
        const gw = fV.inteiro(...fx("malha.garagem_largura_m")), gd = fV.inteiro(...fx("malha.garagem_profundidade_m"));
        const alinhada = fV.chance(R("recuos.garagem_leve_alinhada_prob"));
        gar = { w: gw, d: gd, alinhada };
      }

      const [gmin, gmax] = fx("malha.garagem_largura_m");
      // Garagem leve: faixa da divisa até o corpo, do alinhamento (ou da frente do corpo)
      // até a profundidade sorteada. Ela encosta na divisa do lado do portão; o corpo
      // encosta nela. A face do corpo voltada para a garagem fica a gw (>= 2,9 m) da
      // divisa, então pode ter janela.
      const garLateral = (u0c, wc) => {
        const gv0 = gar.alinhada ? Math.round(R("recuos.garagem_leve_frontal_m") * 10) : v0c;
        let lg = limU(Math.max(gv0, 2), gv0 + gar.d, t.garagem === 1 ? u0c - gar.w / 2 : u0c + wc + gar.w / 2);
        if (!lg) return null;
        const fr = limV(t.garagem === 1 ? lg[0] : u0c + wc, t.garagem === 1 ? u0c : lg[1], 10);
        if (!fr) return null;
        const v0 = Math.max(gv0, fr[0]);
        lg = limU(v0, v0 + gar.d, t.garagem === 1 ? u0c - gar.w / 2 : u0c + wc + gar.w / 2);
        if (!lg) return null;
        const g = t.garagem === 1 ? { u0: lg[0], w: u0c - lg[0] } : { u0: u0c + wc, w: lg[1] - (u0c + wc) };
        if (g.w < gmin || g.w > gmax) return null;
        return { u0: g.u0, v0, w: g.w, d: gar.d };
      };

      // ---- largura e posição do corpo
      const dGuess = 90;
      const lu = limU(v0c, v0c + dGuess);
      if (!lu) return "sem_espaco";
      let lo = lu[0] + rL, hi = lu[1] - rR;
      if (gar) { if (t.garagem === 1) lo = lu[0] + gar.w; else hi = lu[1] - gar.w; }
      const W = hi - lo;
      const [cwMin, cwMax] = fx("malha.corpo_largura_m");
      let w;
      if (W >= cwMin) w = fV.inteiro(cwMin, Math.min(cwMax, W));
      else if (W >= vaoMin) w = Math.min(Math.round(R("malha.vao_m")[1] * 10), W);
      else return "sem_espaco";
      w = malhaDm(w, R);
      if (!w) return "sem_espaco";
      if (caixa) { caixa.w = malhaDm(Math.min(caixa.w, w), R); if (!caixa.w) return "sem_espaco"; }
      // lado que cola: o da garagem leve, o encostado, ou nenhum (centro com folga sorteada)
      const cola = gar ? t.garagem : (encostado & 1) ? 1 : (encostado & 2) ? 2 : 0;
      const posiciona = (a, b, w0) => cola === 1 ? a : cola === 2 ? b - w0 : a + Math.round((b - a - w0) * jitter / 100);
      const jitter = fV.inteiro(35, 65);
      let u0 = posiciona(lo, hi, w);

      // ---- profundidade pela ocupação alvo
      const lv = limV(u0, u0 + w, v0c + 5);
      if (!lv) return "sem_espaco";
      v0c = Math.max(v0c, lv[0] + recuoF + (caixa ? caixa.d : 0) + (frenteL ? alaD : 0));
      const vBack = lv[1] - rFundo;
      const outros = (caixa ? caixa.w * caixa.d : 0) + (gar ? gar.w * gar.d : 0) + (forma === "L" || forma === "T" ? alaW * alaD : 0);
      const [cdMin, cdMax] = fx("malha.corpo_profundidade_m");
      const reservaAtras = (forma === "T" || (forma === "L" && !frenteL)) ? Math.round(R("malha.ala_profundidade_m")[0] * 10) : 0;
      let d = clamp(Math.round((taxaAlvo * areaLote * 100 - outros) / w), cdMin, cdMax);
      d = Math.min(d, vBack - v0c - reservaAtras);
      if (d < Math.round(R("malha.corpo_profundidade_min_absoluta_m") * 10)) return "sem_espaco";
      d = malhaDm(d, R);
      if (!d) return "sem_espaco";

      // ---- a faixa lateral com a profundidade final (o lote pode estreitar no fundo)
      for (let it = 0; it < 4; it++) {
        const l2 = limU(v0c, v0c + d, u0 + w / 2);
        if (!l2) return "sem_espaco";
        let a = l2[0] + rL, b = l2[1] - rR;
        if (gar) { if (t.garagem === 1) a = l2[0] + gmin; else b = l2[1] - gmin; }
        let w2 = w, u2 = u0;
        if (u2 < a) u2 = a;
        if (u2 + w2 > b) { if (cola === 1 || u2 === a) w2 = malhaDm(b - u2, R); else u2 = Math.max(a, b - w2); }
        if (u2 + w2 > b) w2 = malhaDm(b - u2, R);
        if (cola === 1 && !gar) u2 = a;
        if (cola === 2 && !gar) u2 = b - w2;
        if (!w2 || w2 < vaoMin) return "sem_espaco";
        const mudou = u2 !== u0 || w2 !== w;
        u0 = u2; w = w2;
        if (!mudou) break;
      }
      corpo = { u0, v0: v0c, w, d };

      // ---- segundo retângulo: caixa de laje, garagem leve, ala de L ou T
      if (caixa) {
        const esq = t.garagem ? t.garagem === 1 : fV.chance(0.5);
        // a caixa-garagem fica do lado do portão; a varanda do lado oposto (a porta
        // social fica debaixo dela)
        const ladoCaixa = caixa.tipo === 4 ? esq : !esq;
        const cu0 = ladoCaixa ? corpo.u0 : corpo.u0 + corpo.w - caixa.w;
        ala = { u0: cu0, v0: corpo.v0 - caixa.d, w: caixa.w, d: caixa.d };
        alaTipo = caixa.tipo;
      } else if (gar) {
        const g = garLateral(corpo.u0, corpo.w);
        if (!g) return "sem_espaco";
        ala = g; alaTipo = 3;
      } else if (forma === "L" || forma === "T") {
        // A ala vence um vão MENOR que o do corpo: a cumeeira dela morre na água do
        // corpo, nunca passa por cima (ESPEC regra 4).
        const folga = Math.round(R("malha.ala_folga_cumeeira_m") * 10);
        const vaoCorpo = Math.min(corpo.w, corpo.d);
        alaW = malhaDm(Math.min(alaW, vaoCorpo - folga, corpo.w), R);
        if (!alaW) return "sem_espaco";
        if (alaD > vaoCorpo - folga) alaD = malhaDm(vaoCorpo - folga, R);
        alaD = malhaDm(alaD, R);
        if (!alaD) return "sem_espaco";
        let au0;
        if (forma === "T") au0 = corpo.u0 + Math.floor((corpo.w - alaW) / 2);
        else {
          const esq = frenteL && t.garagem ? t.garagem === 1 : fV.chance(0.5);
          au0 = esq ? corpo.u0 : corpo.u0 + corpo.w - alaW;
        }
        const av0 = frenteL ? corpo.v0 - alaD : corpo.v0 + corpo.d;
        if (!frenteL) {                                   // ala dos fundos respeita o recuo de fundo
          const la = limV(au0, au0 + alaW, av0 - 5);
          if (!la) return "sem_espaco";
          const dmax = la[1] - rFundo - av0;
          if (dmax < alaD) { alaD = malhaDm(dmax, R); if (!alaD) return "sem_espaco"; }
        }
        ala = { u0: au0, v0: av0, w: alaW, d: alaD };
        alaTipo = forma === "T" ? 2 : 1;
      }

      // ---- edícula ao fundo: cola num lado (o encostado, se houver), recuo de fundo de
      // 2 m, quintal mínimo entre ela e a casa, e não mais longe que o afastamento máximo
      if (t.edicula) {
        const ew = malhaDm(fV.inteiro(...fx("malha.edicula_largura_m")), R), ed = malhaDm(fV.inteiro(...fx("malha.edicula_profundidade_m")), R);
        const traseira = Math.max(corpo.v0 + corpo.d, ala ? ala.v0 + ala.d : 0);
        const quintal = Math.round(R("malha.edicula_quintal_min_m") * 10);
        const afast = Math.round(R("malha.edicula_afastamento_max_m") * 10);
        const lado = (encostado & 1) ? 1 : (encostado & 2) ? 2 : (fV.chance(0.5) ? 1 : 2);
        const tenta = (ev0, ev1) => {
          const l3 = limU(ev0, ev1);
          if (!l3) return null;
          const a = l3[0] + rLat(1), b = l3[1] - rLat(2);
          if (b - a < ew) return null;
          return lado === 1 ? a : b - ew;
        };
        let eu0 = ew && ed ? tenta(traseira + quintal, traseira + quintal + ed) : null;
        if (eu0 !== null) {
          const le = limV(eu0, eu0 + ew, traseira + quintal + 1);
          const ev1 = le ? Math.min(le[1] - rFundo, traseira + afast) : -1;
          const ev0 = ev1 - ed, dv = ev0 - (corpo.v0 + corpo.d);
          if (le && ev0 - traseira >= quintal && dv >= 0 && dv <= F.FAIXA.ediculaDv[1]) {
            const u3 = tenta(ev0, ev1);
            if (u3 !== null && u3 >= F.FAIXA.ediculaU0[0] && u3 <= F.FAIXA.ediculaU0[1]) edic = { u0: u3, v0: ev0, w: ew, d: ed };
          }
        }
        if (!edic) return "sem_edicula";
      }

      // ---- balanço do sobrado: nunca invade o recuo frontal (só avança sobre a caixa)
      let balanco = 0;
      if (sobrado && querBalanco) {
        const limite = caixa ? corpo.v0 - ala.v0 : corpo.v0 - recuoFmin;
        balanco = clamp(Math.min(balancoSorteio, limite), 0, Math.round(R("alturas.balanco_max_m") * 10));
      }
      return { corpo, ala, alaTipo, edic, balanco };
    }

    /* Porta e portões (ESPEC regras 5 e 6): o portão de garagem vai na frente da
       garagem/vaga; o social encosta nele, separado por um pilarete; a porta social
       fica alinhada ao social, a pelo menos 0,6 m do canto, numa parte da frente do
       corpo que não esteja coberta por ala, caixa de garagem ou garagem. */
    function portas(campos, vols, gLado) {
      const pil = Math.round(R("portoes.pilarete_m") * 10), sw = Math.round(R("portoes.social_largura_m") * 10);
      const pw = Math.round(R("aberturas.porta_largura_m") * 10), canto = Math.round(R("aberturas.janela_canto_min_m") * 10);
      const cw = Math.round(R("quintal.caminho_largura_m") * 10);
      const corpo = vols.corpo;
      const meia = Math.max(Math.ceil(pw / 2), Math.ceil(cw / 2));
      let ok = [[corpo.u0 + canto + Math.ceil(pw / 2), corpo.u0 + corpo.w - canto - Math.ceil(pw / 2)]];
      // a varanda não bloqueia: o caminho entra debaixo dela
      if (vols.ala && (vols.alaTipo === 1 || vols.alaTipo === 4) && vols.ala.v0 + vols.ala.d <= corpo.v0)
        ok = subtrai(ok, vols.ala.u0 - meia, vols.ala.u0 + vols.ala.w + meia);
      ok = ok.filter(([a, b]) => b >= a);
      if (!ok.length) return null;
      let alvo, gate = null;
      if (gLado) {
        // portão de garagem: o mesmo cálculo de CasasFormato.detalha
        const tmp = F.casaDeCampos(Object.assign({}, campos, { portaU: 0 }), ent.centroQuarteirao[0], ent.centroQuarteirao[1], regras.json);
        const d = F.detalha(tmp, regras.json);
        if (!d.portaoGaragem) return null;
        gate = [Math.round(d.portaoGaragem.u0 * 10), Math.round(d.portaoGaragem.u1 * 10)];
        alvo = gLado === 1 ? gate[1] + pil + Math.ceil(sw / 2) : gate[0] - pil - Math.ceil(sw / 2);
      } else alvo = corpo.u0 + Math.round(corpo.w * (fl("aberturas").chance(0.5) ? 0.3 : 0.7));
      // posição válida mais próxima do alvo
      let melhor = null;
      for (const [a, b] of ok) { const u = clamp(alvo, a, b); if (melhor === null || Math.abs(u - alvo) < Math.abs(melhor - alvo)) melhor = u; }
      const u = melhor;
      if (muro !== "nenhum") {
        const s0 = u - Math.ceil(sw / 2), s1 = s0 + sw;
        if (s0 < -Tdm / 2 + pil || s1 > Tdm / 2 - pil) return null;
        if (gate && Math.min(s1, gate[1]) - Math.max(s0, gate[0]) > -pil) return null;
      }
      return u - corpo.u0;
    }
    function subtrai(iv, a, b) {
      const out = [];
      for (const [x, y] of iv) { if (b <= x || a >= y) out.push([x, y]); else { if (a > x) out.push([x, a - 1]); if (b < y) out.push([b + 1, y]); } }
      return out;
    }

    /* Máscara de faces cegas: a menos de 1,5 m da divisa (a faixa de visão de 1,5 m
       atravessa uma aresta de VIZINHO; a rua não conta) ou toda coberta por outro
       volume da casa. Garagem leve não tem parede. */
    // Faixa de visão de uma face: dj para fora, mais 1 cm para DENTRO do volume. O
    // centímetro para dentro é o que pega a divisa que coincide com a própria face
    // (geminada): sem ele, a faixa inteira cai do outro lado da divisa e nenhuma aresta
    // a atravessa.
    const tiraVisao = (m, k, dj) => {
      const e = 0.01;
      return k === 0 ? { u0: m.u0, u1: m.u1, v0: m.v0 - dj, v1: m.v0 + e } : k === 1 ? { u0: m.u1 - e, u1: m.u1 + dj, v0: m.v0, v1: m.v1 }
           : k === 2 ? { u0: m.u0, u1: m.u1, v0: m.v1 - e, v1: m.v1 + dj } : { u0: m.u0 - dj, u1: m.u0 + e, v0: m.v0, v1: m.v1 };
    };
    const vizinhoNaFaixa = t => { const s = encolhe(t, 1e-3); return vizinhas.some(([a, b]) => segCortaRet(a[0], a[1], b[0], b[1], s)); };
    function mascara(r, todos, extra) {
      const dj = R("recuos.lateral_janela_m"), m = r;
      let bits = 0;
      [0, 1, 2, 3].forEach(k => {
        let cega = vizinhoNaFaixa(tiraVisao(m, k, dj));
        for (const e of extra || []) if (vizinhoNaFaixa(tiraVisao(e, k, dj))) cega = true;
        // face inteira encostada em outro volume: interna
        const lados = [[m.u0, m.u1, "v", m.v0], [m.v0, m.v1, "u", m.u1], [m.u0, m.u1, "v", m.v1], [m.v0, m.v1, "u", m.u0]][k];
        let cob = 0;
        for (const o of todos) {
          if (o === r) continue;
          if (lados[2] === "v" && Math.abs((k === 0 ? o.v1 : o.v0) - lados[3]) < 1e-6) cob += Math.max(0, Math.min(o.u1, lados[1]) - Math.max(o.u0, lados[0]));
          if (lados[2] === "u" && Math.abs((k === 1 ? o.u0 : o.u1) - lados[3]) < 1e-6) cob += Math.max(0, Math.min(o.v1, lados[1]) - Math.max(o.v0, lados[0]));
        }
        if (cob >= lados[1] - lados[0] - 1e-6) cega = true;
        if (cega) bits |= 1 << k;
      });
      return bits;
    }

    /* Validação do plano DECODIFICADO, em metros, contra o polígono real. Devolve null
       (ok) ou o motivo. É a mesma bateria dos portões duros do gerador, rodada aqui
       para que a tentativa seguinte (partido mais simples) entre no lugar. */
    function valida(campos) {
      const casa = F.casaDeCampos(campos, ent.centroQuarteirao[0], ent.centroQuarteirao[1], regras.json);
      const det = F.detalha(casa, regras.json);
      const tol = 0.05;
      const vols = casa.volumes;
      const todos = vols.concat(det.pavimentoSuperior ? [det.pavimentoSuperior] : []);
      for (const v of todos) if (!retDentro(v, P, tol)) return "fora_do_lote";
      // beiral nas faces não cegas também fica no lote
      for (const f of det.faces) if (f.beiral > 0) {
        const v = vols[f.volume], b = f.beiral;
        const r = f.lado === "frente" ? { u0: v.u0, u1: v.u1, v0: v.v0 - b, v1: v.v0 } : f.lado === "fundo" ? { u0: v.u0, u1: v.u1, v0: v.v1, v1: v.v1 + b }
                : f.lado === "direita" ? { u0: v.u1, u1: v.u1 + b, v0: v.v0, v1: v.v1 } : { u0: v.u0 - b, u1: v.u0, v0: v.v0, v1: v.v1 };
        if (!retDentro(r, P, tol)) return "beiral_fora_do_lote";
      }
      for (let i = 0; i < vols.length; i++) for (let j = i + 1; j < vols.length; j++) if (retSobrepoe(vols[i], vols[j], 1e-6)) return "volumes_sobrepostos";
      for (const v of vols) if (v.papel !== "garagem_leve" && !(F.vaos(v.u1 - v.u0, regras.json).valido && F.vaos(v.v1 - v.v0, regras.json).valido)) return "fora_da_malha";
      // obstáculos: volume que fica no mapa, lote vizinho sobreposto
      for (const ob of obstaculos) for (const v of todos) {
        if (areaIntersecao(retAnel(v), [ob]) > 0.01) return "colide_volume_mantido";
      }
      // garagem: portão na frente, dentro da testada, sem invadir volume nem o social
      if (casa.garagem.lado !== "nenhuma") {
        const g = det.portaoGaragem, [gmin, gmax] = R("portoes.garagem_largura_m"), pil = R("portoes.pilarete_m");
        if (!g || g.largura < gmin - 1e-9 || g.largura > gmax + 1e-9) return "garagem_sem_portao";
        if (g.u0 < -T / 2 + pil - 1e-6 || g.u1 > T / 2 - pil + 1e-6) return "garagem_sem_portao";
        if (casa.muroFrente === "nenhum") return "garagem_sem_portao";
        const rp = det.rampa;
        if (rp.v1 - rp.v0 < R("recuos.frontal_m") - 1e-6 && !(vols[1] && (vols[1].papel === "garagem_leve" || vols[1].papel === "caixa_garagem"))) return "garagem_sem_portao";
        for (const v of vols) if (v.papel !== "garagem_leve" && v.papel !== "caixa_garagem" && retSobrepoe(rp, v, 1e-6)) return "garagem_sem_portao";
        if (!retDentro(rp, P, tol)) return "garagem_sem_portao";
        if (det.portaoSocial && Math.min(det.portaoSocial.u1, g.u1) - Math.max(det.portaoSocial.u0, g.u0) > -pil + 1e-6) return "portoes_sobrepostos";
      }
      if (det.portaoSocial) {
        const pil = R("portoes.pilarete_m");
        if (det.portaoSocial.u0 < -T / 2 + pil - 1e-6 || det.portaoSocial.u1 > T / 2 - pil + 1e-6) return "portao_social_fora";
        for (const v of vols) if (v.papel !== "caixa_varanda" && v.papel !== "garagem_leve" && retSobrepoe(det.caminho, v, 1e-6)) return "caminho_bloqueado";
      }
      // ocupação e permeabilidade
      const ocup = areaUniaoRets(vols) / areaLote;
      if (ocup > R("ocupacao.taxa_max") + 1e-9) return "ocupacao_alta";
      const pisos = vols.concat([det.caminho, det.rampa, det.calcadaServico].filter(Boolean));
      if (det.piscina) { const b = det.piscina.borda; pisos.push({ u0: det.piscina.u0 - b, u1: det.piscina.u1 + b, v0: det.piscina.v0 - b, v1: det.piscina.v1 + b }); }
      const perm = 1 - areaUniaoRets(pisos.map(r => clipaRet(r))) / areaLote;
      if (perm < R("ocupacao.permeabilidade_min") - 1e-9) return "permeabilidade_baixa";
      if (casa.pavimentos === 2 && casa.alturas.balanco > R("alturas.balanco_max_m") + 1e-9) return "balanco";
      if (casa.telhado.ceramico) { const [a, b] = R("telhado.ceramica_inclinacao"); if (casa.telhado.inclinacao < a - 1e-9 || casa.telhado.inclinacao > b + 1e-9) return "inclinacao"; }
      info.ocupacao = ocup; info.permeabilidade = perm;
      return null;
    }
    const lim0 = { u0: Math.min(...P.map(p => p[0])), u1: Math.max(...P.map(p => p[0])), v0: Math.min(...P.map(p => p[1])), v1: Math.max(...P.map(p => p[1])) };
    const clipaRet = r => ({ u0: Math.max(r.u0, lim0.u0), u1: Math.min(r.u1, lim0.u1), v0: Math.max(r.v0, lim0.v0), v1: Math.min(r.v1, lim0.v1) });

    // Piscina: só se a derivada (CasasFormato.detalha) cabe no lote, longe de tudo.
    function piscinaCabe(campos) {
      const casa = F.casaDeCampos(campos, ent.centroQuarteirao[0], ent.centroQuarteirao[1], regras.json);
      const det = F.detalha(casa, regras.json), p = det.piscina;
      if (!p || !(p.v1 - p.v0 >= R("piscina.comprimento_m")[0] - 1e-9)) return false;
      const m = p.borda + R("piscina.margem_m");
      const ext = { u0: p.u0 - m, u1: p.u1 + m, v0: p.v0 - m, v1: p.v1 + m };
      if (!retDentro(ext, P, 0)) return false;
      for (const v of casa.volumes.concat(det.pavimentoSuperior ? [det.pavimentoSuperior] : [], [det.calcadaServico])) if (retSobrepoe(ext, v, 0)) return false;
      for (const ob of obstaculos) if (areaIntersecao(retAnel(ext), [ob]) > 0.01) return false;
      return true;
    }

    const obstaculos = (ent.obstaculos || []).map(r => r.map(mol.local));

    // ---- tentativas, da escolha sorteada para a mais simples -------------------------
    const garInicial = garLado;
    const tentativas = [];
    const add = t => { if (!tentativas.some(x => JSON.stringify(x) === JSON.stringify(t))) tentativas.push(t); };
    add({ forma, garagem: garInicial, edicula: querEdicula, caixaGaragem, lFrente });
    if (querEdicula) add({ forma, garagem: garInicial, edicula: false, caixaGaragem, lFrente });
    add({ forma: "retangular", garagem: garInicial, edicula: false, caixaGaragem: false, lFrente: false });
    if (garInicial && !(encostado & (3 - garInicial) & 3) && !ruaDe(3 - garInicial)) add({ forma: "retangular", garagem: 3 - garInicial, edicula: false, caixaGaragem: false, lFrente: false });
    add({ forma: "retangular", garagem: 0, edicula: false, caixaGaragem: false, lFrente: false });

    let ultimo = "sem_espaco";
    for (const t of tentativas) {
      if (t.forma === "garagem_lateral" && !t.garagem) continue;
      const m = monta(t);
      if (typeof m === "string") { ultimo = m; continue; }
      const { corpo, ala, alaTipo, edic, balanco } = m;
      const formaFinal = t.forma;
      let partido = formaFinal === "L" ? 1 : formaFinal === "T" ? 2 : formaFinal === "garagem_lateral" ? 3 : formaFinal === "caixa_laje" ? 4 : 0;
      if (partido === 0 && edic) partido = 5;
      if (sobrado) partido = 6;
      if (centroAlinha) partido = 7;
      const campos = {
        origemX: mol.origemX, origemZ: mol.origemZ, angulo: mol.angulo, testada: Tdm,
        fundoEsqU: cantos.fundoEsqU, fundoEsqV: cantos.fundoEsqV, fundoDirU: cantos.fundoDirU, fundoDirV: cantos.fundoDirV,
        semente: sem, portaU: 0,
        partido, telhado: F.TELHADOS.indexOf(telhado), sobrado: sobrado ? 1 : 0, encostado,
        garagem: t.garagem, esquina: (esqRua ? 1 : 0) | (dirRua ? 2 : 0), muroFrente: F.MUROS_FRENTE.indexOf(muro),
        piscina: 0, ala: alaTipo, edicula: edic ? 1 : 0, ediculaMeiaAgua: edic ? ediculaMeiaAgua : 0,
        garagemTelha: alaTipo === 3 ? garagemTelha : 0, irregular, embasamento,
        balanco, inclinacao, beiral, piso, peDireito: pd - 240,
        declV: clamp(Math.round(declV * 100), F.FAIXA.declV[0], F.FAIXA.declV[1]),
        declU: clamp(Math.round(declU * 100), F.FAIXA.declU[0], F.FAIXA.declU[1]),
        paleta: clamp(paleta, 0, 15),
        corpoU0: corpo.u0, corpoV0: corpo.v0, corpoW: corpo.w, corpoD: corpo.d, corpoCega: 0,
        alaDu: ala ? ala.u0 - corpo.u0 : 0, alaDv: ala ? ala.v0 - corpo.v0 : 0, alaW: ala ? ala.w : 0, alaD: ala ? ala.d : 0, alaCega: 0,
        ediculaU0: edic ? edic.u0 : 0, ediculaDv: edic ? edic.v0 - (corpo.v0 + corpo.d) : 0, ediculaW: edic ? edic.w : 0, ediculaD: edic ? edic.d : 0, ediculaCega: 0,
        reservado: 0
      };
      // faixa dos campos: o que não cabe no formato vira recusa, nunca truncamento
      let fora = false;
      for (const k in campos) if (campos[k] < F.FAIXA[k][0] || campos[k] > F.FAIXA[k][1]) { fora = k; break; }
      if (fora) { ultimo = "fora_do_alcance"; continue; }
      // máscaras em metros, na moldura
      const ms = r => r && { u0: r.u0 / 10, v0: r.v0 / 10, u1: (r.u0 + r.w) / 10, v1: (r.v0 + r.d) / 10 };
      const rc = ms(corpo), ra = ms(ala), re = ms(edic);
      const todos = [rc, ra, re].filter(Boolean);
      const sup = balanco ? [{ u0: rc.u0, u1: rc.u1, v0: rc.v0 - balanco / 10, v1: rc.v1 - balanco / 10 }] : [];
      campos.corpoCega = mascara(rc, todos, sup);
      if (ra) campos.alaCega = alaTipo === 3 ? 15 : mascara(ra, todos);
      if (re) campos.ediculaCega = mascara(re, todos);
      // porta e portões
      const pu = portas(campos, { corpo, ala, alaTipo }, t.garagem);
      if (pu === null || pu < 0 || pu > F.FAIXA.portaU[1]) { ultimo = "portoes"; continue; }
      campos.portaU = pu;
      const mot = valida(campos);
      if (mot) { ultimo = mot; continue; }
      // piscina por regra, se couber
      const fPi = fl("piscina_regra");
      const traseira = Math.max(corpo.v0 + corpo.d, ala ? ala.v0 + ala.d : 0) / 10;
      const lvF = faixa(P, 0, rc.u0, rc.u1, traseira + 0.5);
      const livre = (edic ? re.v0 : (lvF ? lvF[1] - R("recuos.fundo_m") : 0)) - traseira;
      if (areaLote >= R("piscina.lote_min_m2") && livre >= R("piscina.fundo_livre_min_m") && fPi.chance(pb("piscina.prob"))) {
        campos.piscina = 1;
        if (!piscinaCabe(campos) || valida(campos)) campos.piscina = 0;
      }
      info.forma = formaFinal; info.tentativa = tentativas.indexOf(t);
      info.semente = sem;
      return { ok: true, campos, info };
    }
    return recusa(ultimo);
  }

  root.CasasRegras = Object.freeze({
    carrega, planeja, classificaBairro, classeTestada, semNota,
    geo: Object.freeze({ areaAssinada, centroide, limpaAnel, antiHorario, dentro, distPS, cortes, faixa,
                         segCortaRet, retDentro, retSobrepoe, areaUniaoRets, areaIntersecao, encolhe, retAnel }),
    lados: Object.freeze({ ladosDoAnel, amostraRua, analisaLados }),
    moldura, malhaDm
  });
})(globalThis);

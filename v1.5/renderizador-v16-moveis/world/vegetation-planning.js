/* Tree catalogue decoding and deterministic planting; no scene or DOM ownership. */
(function(root) {
  "use strict";
  function decode(d, config) {
  const cat = [], porNome = {};
  for (const nome in d.especies) {
    const e = d.especies[nome], n = e.idx.length;
    // Desindexa na carga: copiar arvore vira uma passada linear por vertice, sem
    // indireção por indice, e o buffer do quarteirao ja sai pronto pra concatenar.
    // Blender e Z-para-cima; aqui Y e pra cima -> (x, z, -y), que e rotacao de
    // -90 graus em X (mantem a mao da geometria, entao a normal continua valendo).
    const pos = new Float32Array(n*3), nrm = new Float32Array(n*3), col = new Float32Array(n*3);
    for (let i = 0; i < n; i++) {
      const v = e.idx[i];
      pos[i*3] = e.pos_cm[v*3]/100; pos[i*3+1] = e.pos_cm[v*3+2]/100; pos[i*3+2] = -e.pos_cm[v*3+1]/100;
      nrm[i*3] = e.nrm_127[v*3]/127; nrm[i*3+1] = e.nrm_127[v*3+2]/127; nrm[i*3+2] = -e.nrm_127[v*3+1]/127;
      col[i*3] = e.col[v*3]/255; col[i*3+1] = e.col[v*3+1]/255; col[i*3+2] = e.col[v*3+2]/255;
    }
    porNome[nome] = cat.length;
    cat.push({ nome, pos, nrm, col, verts: n, alt: e.alt_m });
  }
  // A mistura de especies e da CIDADE, nao do renderizador: vem do bloco __cidade.
  const A = config || {};
  const roleta = mix => {
    const idx = [], peso = [];
    let soma = 0;
    for (const nome in (mix || {})) {
      if (!(nome in porNome)) { console.warn("arborizacao: especie desconhecida", nome); continue; }
      soma += mix[nome]; idx.push(porNome[nome]); peso.push(soma);
    }
    return soma > 0 ? { idx, peso, soma } : null;
  };
  const rua = roleta(A.rua), praca = roleta(A.praca);
  if (!cat.length || (!rua && !praca)) return null;
  return { cat, rua: rua || praca, praca: praca || rua,
           mul_calcada: A.mul_calcada || 1.28,
           passo_rua: A.passo_rua_m || 20, dens_rua: A.densidade_rua == null ? 0.62 : A.densidade_rua,
           passo_praca: A.passo_praca_m || 15,
           max_praca: A.max_por_praca || 220, max_quadra: A.max_por_quadra || 500,
           raio: A.raio_m || 850, teto: A.max_na_cena || 14000,
           mul_pista: A.mul_pista || 1.0,
           ndvi_piso: (A.ndvi && A.ndvi.piso) != null ? A.ndvi.piso : 0.12,
           ndvi_teto: (A.ndvi && A.ndvi.teto) != null ? A.ndvi.teto : 0.55,
           ndvi_rua: (A.ndvi && A.ndvi.peso_rua) != null ? A.ndvi.peso_rua : 0.9,
           vias: A.vias_arborizadas || ["primary","secondary","tertiary","unclassified","residential","living_street"],
           sorteia(r, j) { const alvo = j * r.soma;
             for (let i = 0; i < r.peso.length; i++) if (alvo <= r.peso[i]) return r.idx[i];
             return r.idx[r.idx.length-1]; } };
  }
  function create({ARV, ROAD_W, HW, hash, inside, ndviBruto}) {
/* Onde acaba o asfalto, em toda a cidade.

   Plantar a ROAD_W/2 x mul_calcada do PROPRIO eixo poe o tronco na calcada daquela via
   e nao diz nada sobre a via que cruza: uma residencial (pista de 3,75 m) encontrando
   uma primaria (6,5 m) joga a arvore da esquina em cima do asfalto da avenida. Foram
   37 de 1.693 arvores reprovando o portao na primeira medida.

   O indice e da CIDADE, nao do quarteirao, e por um motivo medido: `groupsFrom` poe a
   rua na celula do PRIMEIRO ponto dela, entao a rua que atravessa a fronteira nao esta
   na lista do vizinho. Testar so contra `roads` do quarteirao derrubou 37 para 18 --
   as 18 que sobraram eram exatamente as da borda. */
const ASF = { cel: 120, g: new Map() };
function indexaAsfalto(R) {
  ASF.g.clear();
  if (!ARV) return;
  for (const w of R) {
    const h = (ROAD_W[HW[w.k]] || 7)/2 * ARV.mul_pista, pts = w.pts;
    for (let i = 0; i < pts.length-1; i++) {
      const a = pts[i], b = pts[i+1];
      const seg = [a[0], a[1], b[0]-a[0], b[1]-a[1], h*h];
      const cx0 = Math.floor((Math.min(a[0],b[0])-h)/ASF.cel), cx1 = Math.floor((Math.max(a[0],b[0])+h)/ASF.cel);
      const cz0 = Math.floor((Math.min(a[1],b[1])-h)/ASF.cel), cz1 = Math.floor((Math.max(a[1],b[1])+h)/ASF.cel);
      for (let cx = cx0; cx <= cx1; cx++) for (let cz = cz0; cz <= cz1; cz++) {
        const k = cx + ":" + cz;
        let l = ASF.g.get(k); if (!l) { l = []; ASF.g.set(k, l); }
        l.push(seg);
      }
    }
  }
}
function noAsfalto(x, z) {
  const l = ASF.g.get(Math.floor(x/ASF.cel) + ":" + Math.floor(z/ASF.cel));
  if (!l) return false;
  for (let k = 0; k < l.length; k++) {
    const s = l[k], L2 = s[2]*s[2] + s[3]*s[3];
    let t = L2 > 1e-9 ? ((x-s[0])*s[2] + (z-s[1])*s[3]) / L2 : 0;
    t = t < 0 ? 0 : (t > 1 ? 1 : t);
    const dx = s[0] + s[2]*t - x, dz = s[1] + s[3]*t - z;
    if (dx*dx + dz*dz < s[4]) return true;
  }
  return false;
}

/* 0 = asfalto/telhado, 1 = mata fechada. E este numero que substitui o "e parque ou
   nao e" do OSM. */
function ndviEm(x, z) {
  const v = (ndviBruto(x, z) - ARV.ndvi_piso) / Math.max(0.01, ARV.ndvi_teto - ARV.ndvi_piso);
  return v < 0 ? 0 : (v > 1 ? 1 : v);
}

function buildTrees(polys, roads) {
  if (!ARV) return null;
  const plant = [];
  let seed = 1;
  const sorte = () => hash(seed++ * 2654435761 % 2147483647);
  const put = (x, z, r, esc, rua) => {
    const j = sorte();
    /* v11: especie em MANCHA. Sortear especie por arvore da confete -- cidade real
       planta rua inteira de sibipiruna e depois um quarteirao de ipe. A mancha e uma
       celula de 30 m sorteada pela POSICAO, nao pela ordem do laco: continua a mesma
       depois que o streaming descarta e remonta o quarteirao.

       A mancha escolhe QUAL especie, nunca INVENTA especie: passa pela mesma roleta
       da cidade (`ARV.sorteia`), so que com o numero da celula no lugar do sorteio.
       Indexar `ARV.cat` direto poria numa rua uma especie que a cidade so usa em
       praca -- ou que ela nao usa. */
    const cel = hash(((Math.round(x/30) * 73856093) ^ (Math.round(z/30) * 19349663)) >>> 0);
    const sp = sorte() < 0.55 ? ARV.sorteia(r, cel) : ARV.sorteia(r, sorte());
    // Arvore grande varia mais de porte que arvorezinha de calcada. Duas copas de
    // 14 m identicas lado a lado denunciam o instanciamento; duas de 6 m, nao.
    const varia = (ARV.cat[sp].alt || 8) > 12 ? 0.30 : 0.20;
    plant.push({ x, z, rua, sp, rot: j*6.283,
                 s: esc * (1 - varia + sorte()*varia*2), tint: 0.90 + sorte()*0.22 });
  };


  for (const r of polys) {
    if (plant.length >= ARV.max_quadra) break;
    let x0=1e9,x1=-1e9,z0=1e9,z1=-1e9;
    for (const p of r) { x0=Math.min(x0,p[0]); x1=Math.max(x1,p[0]); z0=Math.min(z0,p[1]); z1=Math.max(z1,p[1]); }
    if (x1-x0 > 900 || z1-z0 > 900) continue;
    if (Math.min(x1-x0, z1-z0) < 22 || (x1-x0)*(z1-z0) < 1200) continue; // v6: sem canteiro/faixa fina
    const passo = ARV.passo_praca;
    let posta = 0;
    for (let x = x0; x < x1 && posta < ARV.max_praca; x += passo)
      for (let z = z0; z < z1 && posta < ARV.max_praca; z += passo) {
        const j1 = sorte(), j2 = sorte();
        const X = x + j1*passo*0.8, Z = z + j2*passo*0.8;
        if (!inside(r, X, Z) || noAsfalto(X, Z)) continue;
        // O passo da grade e o da MATA FECHADA; o que rareia o canteiro pelado e a
        // probabilidade, nao um passo maior -- passo maior deixaria a mata alinhada.
        // A curva do NDVI e concava (expoente < 1): o verde fraco ja rende alguma
        // arvore, e a saturacao ("aqui e mata, planta tudo") so chega no NDVI cheio.
        // A reta antiga saturava em 0,55 de NDVI -- dali pra cima era tudo mata
        // fechada igual, e abaixo o canteiro pelado ainda vinha com 18% de arvore.
        const ndvi = ndviEm(X, Z);
        if (sorte() > 0.10 + 0.90 * Math.pow(ndvi, 0.7)) continue;
        put(X, Z, ARV.praca, 1.0, false); posta++;
      }
  }
  for (const w of roads) {
    const kind = HW[w.k];
    if (ARV.vias.indexOf(kind) < 0) continue;
    // A calcada: entre a borda da pista e o fim da fita. Ver o comentario acima.
    const off = (ROAD_W[kind] || 7)/2 * ARV.mul_calcada, pts = w.pts;
    for (let i = 0; i < pts.length-1; i++) {
      const a = pts[i], b = pts[i+1];
      const dx = b[0]-a[0], dz = b[1]-a[1], L = Math.hypot(dx,dz);
      if (L < 14) continue;
      const ux = dx/L, uz = dz/L;
      // A margem de 7 m nas pontas mantem a esquina limpa: e onde duas fitas se
      // cruzam e onde a arvore taparia a boca da rua.
      for (let d = 7; d < L-7; d += ARV.passo_rua) {
        const j = sorte();
        // rua de bairro arborizado tem mais arvore que rua de bairro pelado, e isso
        // aparece no NDVI da propria quadra
        if (j > ARV.dens_rua * (1 - ARV.ndvi_rua*0.5 + ARV.ndvi_rua*ndviEm(a[0]+ux*d, a[1]+uz*d))) continue;
        const side = sorte() > 0.5 ? 1 : -1;
        const X = a[0]+ux*d - uz*off*side, Z = a[1]+uz*d + ux*off*side;
        if (noAsfalto(X, Z)) continue;
        put(X, Z, ARV.rua, 0.95, true);
      }
    }
  }
  return plant.length ? plant : null;
}


    return {indexaAsfalto, buildTrees};
  }
  root.VegetationPlanning = Object.freeze({decode, create});
})(globalThis);

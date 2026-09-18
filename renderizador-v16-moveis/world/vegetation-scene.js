/* Instanced tree scene and incremental membership; streaming supplies live records. */
(function(root) {
  "use strict";
  function create({THREE, ARV, terrainY, getRelief, target, SOMBRA_CIDADE, getLive,
                  projeta = false}) {
/* Uma InstancedMesh POR ESPECIE, global -- nao uma malha por quarteirao.

   A primeira tentativa mesclou as arvores do quarteirao num buffer so, o que dava
   uma chamada de desenho por quarteirao (igual ao v9) e parecia certo. Na medicao
   um quarteirao com area verde grande chegou a 59.935 arvores: a 261 triangulos
   cada, sao 15,6 milhoes de triangulos e ~700 MB num unico buffer, e o streaming
   parou de entregar predio. Instanciado, a arvore volta a custar uma matriz (64 B), e a
   cidade inteira cabe em ate 20 chamadas -- uma por especie -- nao importa quantos
   quarteiroes estejam vivos. O v9 gastava uma por quarteirao vivo com arvore (18 numa
   amostra de 80 quarteiroes): na amostra empatam, o que se ganha aqui e o teto.

   O conjunto e refeito inteiro quando o conjunto vivo muda, em vez de remendado por
   quarteirao. Sao ~20 mil composicoes de matriz, alguns milissegundos, e evita a
   classe inteira de bug de indice defasado que uma lista livre traria. */
const gArv = new THREE.Group();
gArv.name = "arvores";
const arvMesh = [];
let arvSujo = true;
const arvAlvo = new THREE.Vector3(1e9, 0, 1e9);   // onde o conjunto foi refeito

function arvGeometria(e) {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(e.pos, 3));
  g.setAttribute("normal", new THREE.BufferAttribute(e.nrm, 3));
  g.setAttribute("color", new THREE.BufferAttribute(e.col, 3));
  g.computeBoundingSphere();
  return g;
}

/* v11 (4.2 do plano): a arborizacao passou a ser remendada, nao refeita.

   O v10 refazia o conjunto inteiro de proposito, e o comentario acima diz por que:
   remendar traz de volta a classe de bug de indice defasado que uma lista livre
   sempre traz. Medido antes de escrever isto: sao ~2.410 arvores vivas, entao o que
   se economiza e da ordem de decimos de milissegundo por mudanca de conjunto vivo.
   Foi pedido mesmo assim, entao veio junto o que torna a troca defensavel:

   - o livro-caixa e explicito (`arvSlot` diz quem ocupa cada instancia, `arvPorRec`
     diz o que cada quarteirao colocou), em vez de indice implicito;
   - remocao e troca-com-o-ultimo, O(1) por planta, reescrevendo UMA matriz;
   - tudo que o remendo nao sabe fazer cai de volta no caminho completo, sem
     tentar ser esperto: alvo andou (muda quem esta no raio), relevo mudou, ou o
     TETO entrou em jogo (o corte por distancia nao e incremental);
   - e existe `__perf.confereArvores()`, que roda o caminho completo num rascunho e
     compara com o estado remendado. `pipeline/testa_arvore_incremental.py` anda pela
     cidade forcando entra/sai e cobra essa igualdade. Sem esse conferidor, isto aqui
     nao deveria entrar. */
/* Onde o alvo estava quando a PERTINENCIA AO RAIO foi avaliada pela ultima vez.

   O `arvAlvo` de 200 m nao serve pra isso: ele existe pra espacar a reconstrucao
   COMPLETA, e aceitava ate 200 m de defasagem na borda do raio de 850 m. O
   `testa_arvore_incremental.py` mediu essa defasagem (5 quarteiroes no raio contra 2
   no livro) -- ela ja existia antes do remendo, so que ninguem olhava. Como a
   varredura de pertinencia agora custa ~900 testes de distancia e ZERO matriz quando
   ninguem cruza a fronteira, da pra reavaliar a cada metro andado, e a defasagem
   simplesmente deixa de existir. Camera parada continua custando nada. */
const arvVisto = new THREE.Vector3(1e9, 0, 1e9);
const _arvSaiu = [];           // reusado: evita alocar array por chamada
const arvSlot = [];            // por especie: o plantio que ocupa cada instancia
const arvPorRec = new Map();   // indice do quarteirao -> plantios que ele colocou
let arvTotal = true;           // o proximo refaz tem que ser completo?

function arvZeraLivro() {
  arvSlot.length = 0;
  if (ARV) for (let i = 0; i < ARV.cat.length; i++) arvSlot.push([]);
  arvPorRec.clear();
}

// O pe de cada arvore de RUA viva, pro portao `arvore fora da calcada`. Virou getter
// porque com remendo nao ha um momento unico em que a lista "fica pronta" -- e derivar
// do livro-caixa na hora da leitura nao pode ficar defasado por construcao.
Object.defineProperty(gArv.userData, "pesRua", {
  get() {
    const r = [];
    for (const L of arvSlot) for (const p of L) if (p.rua) r.push([p.x, p.z]);
    return r;
  }
});

const _arvM = new THREE.Matrix4(), _arvQ = new THREE.Quaternion(),
      _arvV = new THREE.Vector3(), _arvS = new THREE.Vector3(),
      _arvE = new THREE.Euler(), _arvC = new THREE.Color();

function arvEscreve(sp, k, p) {
  const im = arvMesh[sp];
  _arvV.set(p.x, terrainY(p.x, p.z)*getRelief(), p.z);
  _arvE.set(0, p.rot, 0); _arvQ.setFromEuler(_arvE); _arvS.setScalar(p.s);
  _arvM.compose(_arvV, _arvQ, _arvS);
  im.setMatrixAt(k, _arvM);
  _arvC.setRGB(p.tint, p.tint, p.tint);
  im.setColorAt(k, _arvC);
}

/* Garante capacidade pra `n` instancias da especie. Crescer troca a InstancedMesh
   inteira, entao TODO slot ja ocupado e reescrito -- e o unico ponto onde o remendo
   volta a custar o que o caminho completo custava, e so acontece em potencia de dois. */
function arvGarante(sp, n) {
  let im = arvMesh[sp];
  if (im && im.instanceMatrix.count >= n) return;
  if (im) { gArv.remove(im); im.dispose(); }
  const cap = 1 << Math.ceil(Math.log2(Math.max(64, n)));
  im = new THREE.InstancedMesh(arvGeometria(ARV.cat[sp]),
        new THREE.MeshPhongMaterial({ vertexColors:true, shininess:0, specular:0x000000 }), cap);
  im.castShadow = projeta && SOMBRA_CIDADE; im.receiveShadow = SOMBRA_CIDADE;
  // Uma InstancedMesh cobre a cidade visivel inteira: nenhuma esfera de corte
  // ajuda, e o teste custaria mais que os 20 desenhos que ela evita.
  im.frustumCulled = false;
  arvMesh[sp] = im; gArv.add(im);
  const L = arvSlot[sp];
  for (let k = 0; k < L.length; k++) arvEscreve(sp, k, L[k]);
}

function arvFecha(tocadas) {
  for (const sp of tocadas) {
    const im = arvMesh[sp];
    if (!im) continue;
    im.count = arvSlot[sp].length;
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
  }
}

function arvVivos() { let n = 0; for (const L of arvSlot) n += L.length; return n; }

function arvPoeRec(i, rec, tocadas) {
  if (arvPorRec.has(i) || !rec || !rec.plants) return;
  const R2 = ARV.raio*ARV.raio;
  const dx = rec.cx - target.x, dz = rec.cz - target.z;
  if (dx*dx + dz*dz > R2) return;          // fora do raio: nao entra, e nada a remover
  const meus = [];
  for (const p of rec.plants) {
    const L = arvSlot[p.sp];
    arvGarante(p.sp, L.length + 1);
    p._sp = p.sp; p._k = L.length;
    L.push(p);
    arvEscreve(p.sp, p._k, p);
    tocadas.add(p.sp);
    meus.push(p);
  }
  arvPorRec.set(i, meus);
}

function arvTiraRec(i, tocadas) {
  const meus = arvPorRec.get(i);
  if (!meus) return;
  for (const p of meus) {
    const L = arvSlot[p._sp], k = p._k, ult = L[L.length - 1];
    L[k] = ult; ult._k = k; L.pop();
    if (k < L.length) arvEscreve(p._sp, k, ult);   // a que veio do fim mudou de slot
    tocadas.add(p._sp);
  }
  arvPorRec.delete(i);
}

/* O delta NAO e "os quarteiroes que o streaming acabou de montar e descartar" -- foi
   assim na primeira versao e o `testa_arvore_incremental.py` reprovou na hora: andar
   150 m nao monta nem descarta nada, mas muda QUEM ESTA DENTRO DO RAIO de 850 m, e o
   remendo ficou com 2.410 arvores onde o caminho completo dava 732.

   O delta certo e a PERTINENCIA: para cada quarteirao vivo, esta dentro do raio? A
   varredura custa os mesmos ~900 testes de distancia do caminho completo -- o que se
   economiza (e o unico ganho real disto tudo) sao as ~2.400 composicoes de matriz. */
function refazArvores() {
  const gLive = getLive();
  arvSujo = false;
  if (!ARV) return;
  if (arvTotal) return refazArvoresTotal();
  arvVisto.set(target.x, 0, target.z);
  const R2 = ARV.raio*ARV.raio, tocadas = new Set();
  // 1. quem saiu: quarteirao descartado, ou que deixou de estar no raio
  _arvSaiu.length = 0;
  for (const i of arvPorRec.keys()) {
    const rec = gLive.get(i);
    let fora = !rec || !rec.plants;
    if (!fora) { const dx = rec.cx - target.x, dz = rec.cz - target.z; fora = dx*dx + dz*dz > R2; }
    if (fora) _arvSaiu.push(i);       // nao da pra apagar do Map no meio da iteracao
  }
  for (const i of _arvSaiu) arvTiraRec(i, tocadas);
  // 2. o teto corta pelas MAIS DISTANTES, e isso nao e incremental: se ele entrar em
  //    jogo, o caminho completo assume. A folga de 5% evita oscilar na fronteira.
  let novos = 0;
  for (const [i, rec] of gLive) {
    if (arvPorRec.has(i) || !rec.plants) continue;
    const dx = rec.cx - target.x, dz = rec.cz - target.z;
    if (dx*dx + dz*dz <= R2) novos += rec.plants.length;
  }
  if (arvVivos() + novos > ARV.teto*0.95) return refazArvoresTotal();
  // 3. quem entrou
  for (const [i, rec] of gLive) arvPoeRec(i, rec, tocadas);
  arvFecha(tocadas);
}

function refazArvoresTotal() {
  const gLive = getLive();
  if (!ARV) return;
  // 1. junta o que os quarteiroes vivos plantaram, por especie
  const porEsp = ARV.cat.map(() => []);
  // Dois cortes, e os dois sao necessarios. O RAIO tira o que esta longe demais pra
  // se enxergar (arvore nao e predio: aos 1800 m do streaming ela e um pixel). O TETO
  // e o orcamento da cena inteira -- sem ele, uma regiao com muita area verde poe
  // 65 mil arvores vivas, que a 261 triangulos cada sao 17 milhoes de triangulos.
  // O teto corta pelas MAIS DISTANTES, entao o que some e o que menos se ve.
  arvSujo = false; arvTotal = false;
  arvVisto.set(target.x, 0, target.z);
  arvZeraLivro();
  const R2 = ARV.raio*ARV.raio;
  let cand = [];
  const doRec = new Map();
  for (const [i, rec] of gLive) {
    if (!rec.plants) continue;
    const dx = rec.cx - target.x, dz = rec.cz - target.z;
    if (dx*dx + dz*dz > R2) continue;
    for (const p of rec.plants) { cand.push(p); doRec.set(p, i); }
  }
  if (cand.length > ARV.teto) {
    for (const p of cand) { const dx = p.x - target.x, dz = p.z - target.z; p._d = dx*dx + dz*dz; }
    cand.sort((a, b) => a._d - b._d);
    cand.length = ARV.teto;
  }
  for (const p of cand) porEsp[p.sp].push(p);
  // 2. reescreve as matrizes
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(),
        sc = new THREE.Vector3(), e = new THREE.Euler(), cor = new THREE.Color();
  for (let i = 0; i < ARV.cat.length; i++) {
    const lista = porEsp[i];
    let im = arvMesh[i];
    if (!lista.length) { if (im) im.count = 0; continue; }
    // a capacidade so cresce: realocar pra baixo troca um pico de memoria por um
    // monte de lixo pro coletor, e o pico ja passou.
    if (!im || im.instanceMatrix.count < lista.length) {
      if (im) { gArv.remove(im); im.dispose(); }
      const cap = 1 << Math.ceil(Math.log2(Math.max(64, lista.length)));
      im = new THREE.InstancedMesh(arvGeometria(ARV.cat[i]),
            new THREE.MeshPhongMaterial({ vertexColors:true, shininess:0, specular:0x000000 }), cap);
      im.castShadow = projeta && SOMBRA_CIDADE; im.receiveShadow = SOMBRA_CIDADE;
      // Uma InstancedMesh cobre a cidade visivel inteira: nenhuma esfera de corte
      // ajuda, e o teste custaria mais que os 20 desenhos que ela evita.
      im.frustumCulled = false;
      arvMesh[i] = im; gArv.add(im);
    }
    for (let k = 0; k < lista.length; k++) {
      const p = lista[k];
      v.set(p.x, terrainY(p.x, p.z)*getRelief(), p.z);
      e.set(0, p.rot, 0); q.setFromEuler(e); sc.setScalar(p.s);
      m.compose(v, q, sc);
      im.setMatrixAt(k, m);
      cor.setRGB(p.tint, p.tint, p.tint);
      im.setColorAt(k, cor);
      // livro-caixa, pro remendo poder continuar daqui
      p._sp = i; p._k = k; arvSlot[i].push(p);
      const r = doRec.get(p);
      if (r !== undefined) {
        let L = arvPorRec.get(r);
        if (!L) { L = []; arvPorRec.set(r, L); }
        L.push(p);
      }
    }
    im.count = lista.length;
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
  }
}

  function confereArvores() {
    const gLive = getLive();
    const chave = p => p.sp + ":" + p.x.toFixed(3) + ":" + p.z.toFixed(3) +
                       ":" + p.s.toFixed(4) + ":" + p.rot.toFixed(4);
    const antes = new Map();
    for (const L of arvSlot) for (const p of L) antes.set(chave(p), (antes.get(chave(p))||0) + 1);
    const R2d = ARV ? ARV.raio*ARV.raio : 0;
    let noRaio = 0, comPlanta = 0;
    for (const rec of gLive.values()) {
      if (!rec.plants) continue;
      comPlanta++;
      const dx = rec.cx - target.x, dz = rec.cz - target.z;
      if (dx*dx + dz*dz <= R2d) noRaio++;
    }
    const diag = { vivos: gLive.size, comPlanta, noRaio, recsNoLivro: arvPorRec.size,
                   sujo: arvSujo, total: arvTotal };
    const cnt = [];
    for (let i = 0; i < arvMesh.length; i++) cnt.push(arvMesh[i] ? arvMesh[i].count : 0);
    refazArvoresTotal();
    const depois = new Map();
    for (const L of arvSlot) for (const p of L) depois.set(chave(p), (depois.get(chave(p))||0) + 1);
    let faltando = 0, sobrando = 0;
    for (const [k, v] of depois) if ((antes.get(k)||0) < v) faltando += v - (antes.get(k)||0);
    for (const [k, v] of antes)  if ((depois.get(k)||0) < v) sobrando += v - (depois.get(k)||0);
    let contaOk = true;
    for (let i = 0; i < arvMesh.length; i++)
      if ((arvMesh[i] ? arvMesh[i].count : 0) !== cnt[i]) contaOk = false;
    let soma = 0; for (const L of arvSlot) soma += L.length;
    return { ok: faltando === 0 && sobrando === 0 && contaOk,
             remendo: cnt.reduce((a,b) => a+b, 0), completo: soma,
             faltando, sobrando, contaOk, diag };
  }
    function trackTarget() {
  { const dx = target.x - arvAlvo.x, dz = target.z - arvAlvo.z;
    if (dx*dx + dz*dz > 200*200) { arvAlvo.set(target.x, 0, target.z);
      arvSujo = true; arvTotal = true; return true; }
    // Andou QUALQUER coisa: quem esta dentro do raio pode ter mudado. Barato porque o
    // remendo so escreve matriz de quem cruzou a fronteira (ver arvVisto).
    else if (target.x !== arvVisto.x || target.z !== arvVisto.z) arvSujo = true; }

      return false;
    }
    function invalidate(full = false) { arvSujo = true; if (full) arvTotal = true; }
    return {group:gArv, invalidate, trackTarget, refresh:refazArvores, confereArvores,
      get dirty() { return arvSujo; }};
  }
  root.VegetationScene = Object.freeze({create});
})(globalThis);

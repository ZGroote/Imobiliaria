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


(() => {
"use strict";
/* v12: seis controles sairam do painel a pedido (altura, pins, setas, muros, noite e
   minimapa) e o cabecalho do cartao saiu junto (titulo, extensao, carimbo e legenda).
   As FUNCOES continuam -- o que sumiu foi o botao --, e elas seguem no estado padrao:
   muro visivel, seta escondida, minimapa ligado, dia. A noite ainda entra por
   `?noite=1`, e a altura por `uHeight` no console.

   v13: o PINO de estabelecimento e a excecao -- ele nasce APAGADO, nao visivel. Quem o
   acende e o "O que tem por perto?" (ver abrePerto) ou a busca por um lugar; por isso o
   orfao `tPins` entra com aria-pressed=false.

   Em vez de espalhar `if (!$("tPins")) return;` por dez lugares, cada id removido
   devolve um elemento ORFAO -- criado de verdade, nunca anexado ao documento. Todo o
   codigo que le `.value`, escuta `click` ou troca `aria-pressed` continua valendo
   palavra por palavra, e ninguem ve nada. A lista e explicita porque id ERRADO tem que
   continuar estourando: sem ela, um typo viraria um botao fantasma silencioso. */
const SUMIDOS = {
  // do painel de baixo e do cartao de cima
  hs:"input", hv:"b", tPins:"button", tArrows:"button", tMuros:"button",
  tNoite:"button", tMapa:"button", extent:"div",
  // a barra de categorias de estabelecimento
  poibar:"div",
  // o painel do interior inteiro
  ipanel:"div", ix:"div", idobra:"div", iName:"h2", iInfo:"div", iCat:"div", iEdit:"div",
  iSelName:"div", ivw:"b", isw:"input", ivd:"b", isd:"input", ivh:"b", ish:"input",
  icor:"input", igir:"button", idel:"button", ivista:"button", iteto:"button",
  ireset:"button", isair:"button", iPredioRow:"div", ipredio:"button", iDica:"div" };
const _orfaos = new Map();
// Os orfaos moram TODOS dentro de uma div que nunca e anexada. Nao e organizacao: sem
// um pai, `$("iPredioRow").parentNode.insertBefore(...)` estoura -- e esse insertBefore
// e o que pendura o aviso de "predio ainda nao confirmado".
const _orfaoPai = document.createElement("div");
const $ = id => {
  const e = document.getElementById(id);
  if (e || !SUMIDOS[id]) return e;
  let o = _orfaos.get(id);
  if (!o) {
    o = document.createElement(SUMIDOS[id]);
    if (id === "hs") { o.type = "range"; o.min = "0.4"; o.max = "3"; o.step = "0.05"; o.value = "1"; }
    if (id === "isw" || id === "isd" || id === "ish") o.type = "range";
    if (id === "icor") o.type = "color";
    if (SUMIDOS[id] === "button")
      o.setAttribute("aria-pressed",
        (id === "tArrows" || id === "tNoite" || id === "tPins") ? "false" : "true");
    _orfaoPai.appendChild(o);
    _orfaos.set(id, o);
  }
  return o;
};
if (!window.THREE) {
  $("stK").textContent = "A biblioteca 3D não carregou";
  $("stM").textContent = "As duas origens do three.js foram bloqueadas ou estão fora do ar";
  $("stI").style.width = "100%";
  return;
}

/* ============================================================
   1. Referências fixas
   ============================================================ */
// A CIDADE VEM DE FORA. Estas constantes eram literais de São Carlos escritas aqui
// dentro (`CENTER = {-22.01725, -47.89080}`, `Q = 10`), e o city.json já trazia os
// mesmos valores nos campos `c` e `q` — que o renderizador ignorava. Era isso, e só
// isso, que travava "qualquer cidade": a geometria até desenhava (as coordenadas são
// metros relativos ao centro), mas tudo que converte para coordenada de verdade — POI,
// grade de relevo, rótulo de rua — saía no lugar errado.
// O bloco é escrito por pipeline/montar.py a partir de padrao/cidades/<slug>.json, e
// fica FORA da compressão de propósito: é lido na inicialização do módulo, antes de
// qualquer descompactação assíncrona.
const CIDADE = JSON.parse(document.getElementById("__cidade").textContent);
const CENTER = { lat: CIDADE.centro.lat, lon: CIDADE.centro.lon };
const TILE_M = 850, PAUSE = 450, CELL = 850;
const MLAT = 111132.92, MLON = 111319.49 * Math.cos(CENTER.lat * Math.PI/180);
const px = lon => (lon - CENTER.lon) * MLON;
const pz = lat => -(lat - CENTER.lat) * MLAT;
const Q = CIDADE.quantizacao;                          // decímetros: precisão de 10 cm

/* Aparência: o que vale SÓ NA CIDADE QUE PEDIU.
   ------------------------------------------------------------------
   Até a Fase 4 "só em Ribeirão" era por REMONTAGEM: o renderizador é um só, e o que
   separava as cidades era qual página tinha sido montada por último -- as outras quatro
   pegavam a mudança na montagem seguinte, ainda que disparada por outro motivo. Isso é
   o oposto de um escopo: é um atraso.

   Aqui vira chave de DADO. `padrao/cidades/<slug>.json` traz um bloco `aparencia`, o
   `montar.py` o copia pro `__cidade`, e quem não declarou continua com o desenho
   anterior AINDA QUE SEJA REMONTADA. Cada item é uma chave própria, e não um número de
   fase, porque "fase" é ordem de trabalho e não descreve o que a chave liga.        */
const APAR = CIDADE.aparencia || {};
// Vao de janela por medida FISICA (peitoril a ~1,05 m do piso do pavimento) em vez de
// fracao do pe-direito. E o que faz a casa terrea TER janela -- ver facadeMaterial.
const AP_JANELA = !!APAR.janela_metrica;
// Vidro que reflete, e luz de cena com mais degrau entre o que pega sol e o que nao pega.
const AP_LUZ = !!APAR.material_luz;

let GRID = 4, HALF = GRID * TILE_M / 2;
const LIGHT = () => GRID >= 10;

const LV = 3.15;
const BY_TYPE = { church:16,cathedral:24,chapel:9,temple:14,apartments:19,residential:7,house:4.2,
  detached:4.2,bungalow:3.6,terrace:5.2,hotel:22,commercial:11,office:16,retail:6.5,supermarket:8,
  kiosk:3.2,industrial:9,warehouse:8.5,garage:3,garages:3,roof:3.4,school:8,university:12,college:11,
  hospital:16,civic:11,government:14,train_station:12,transportation:10,hall:9,sports_hall:11 };
const CIVIC = /^(church|cathedral|chapel|temple|civic|government|school|university|college|hospital|train_station|public)$/;
const RES = /^(house|apartments|residential|detached|terrace|bungalow|semidetached_house|dormitory)$/;
const VERDE = /^(park|garden|pitch|playground|grass|forest|cemetery|recreation_ground|village_green)$/;
const CLS = ["none","res","biz","civic"];
const HW = ["motorway","trunk","primary","secondary","tertiary","unclassified","residential",
  "living_street","pedestrian","service","track","footway","path","cycleway","steps",
  "motorway_link","trunk_link","primary_link","secondary_link","tertiary_link","other"];
const ROAD_W = { motorway:16,trunk:14,primary:13,secondary:11,tertiary:9.5,unclassified:7.5,
  residential:7.5,living_street:6.5,pedestrian:6.5,service:4.6,track:4,footway:2.4,path:2.2,
  cycleway:2.6,steps:2.2,motorway_link:8,trunk_link:8,primary_link:8,secondary_link:7,
  tertiary_link:6.5,other:6 };
const BIGROAD = /^(motorway|trunk|primary|secondary|tertiary)$/;

const hash = id => { let h = 2166136261 ^ id; h = Math.imul(h ^ (h>>>15), 2246822507);
  h = Math.imul(h ^ (h>>>13), 3266489909); return ((h ^ (h>>>16))>>>0) / 4294967296; };


/* ============================================================
   2. Extração: OSM cru -> registros já projetados em metros
   ============================================================ */
const shoelace = r => { let s = 0;
  for (let i = 0, n = r.length; i < n; i++) { const a = r[i], b = r[(i+1)%n]; s += a[0]*b[1] - b[0]*a[1]; }
  return s; };


/* ============================================================
   3. Arquivo consolidado: números inteiros e diferença entre pontos
   ============================================================ */
function readPath(arr, i, out) {
  const n = arr[i++]; let lx = 0, lz = 0;
  for (let k = 0; k < n; k++) {
    lx += arr[i++]; lz += arr[i++];
    out.push([lx/Q, lz/Q]);
  }
  return i;
}

function decode(data) {
  const B = [], R = [], G = [], names = data.names || [];
  const meta = new Map();
  for (let i = 0; i < (data.bm||[]).length; i += 3)
    meta.set(data.bm[i], { name: names[data.bm[i+1]] || null, addr: names[data.bm[i+2]] || null });
  const q = data.q || 10, scale = q / Q;
  let i = 0, n = 0;
  while (i < data.b.length) {
    const c = data.b[i++], h = data.b[i++]/q;
    const r = []; i = readPath(data.b, i, r);
    if (scale !== 1) for (const p of r) { p[0] *= scale; p[1] *= scale; }
    const m = meta.get(n) || {};
    let a = Math.abs(shoelace(r))/2;
    B.push({ r, h, c, area:a, name:m.name || null, addr:m.addr || null, fa:(data.fa && data.fa[n]!==undefined ? data.fa[n] : 400) });
    n++;
  }
  i = 0;
  while (i < data.r.length) {
    const k = data.r[i++], ni = data.r[i++];
    const pts = []; i = readPath(data.r, i, pts);
    R.push({ pts, k, name: names[ni] || null });
  }
  i = 0;
  while (i < (data.g||[]).length) {
    const r = []; i = readPath(data.g, i, r);
    G.push({ r });
  }
  // v4: bl[] = [cx, cz, raio, inicioB, qtdB] por quarteirao. Os indices batem
  // com a ordem de B porque o pipeline/city_base.py reordenou data.b agrupando por
  // quadra -- por isso aqui e uma fatia contigua, nao uma lista de indices.
  const grp = [], bl = data.bl || [];
  for (let k = 0; k < bl.length; k += 5)
    grp.push({ cx: bl[k]/Q*scale, cz: bl[k+1]/Q*scale, rad: bl[k+2]/Q*scale,
               s: bl[k+3], n: bl[k+4] });
  return { B, R, G, grp };
}

/* ============================================================
   4. Cena
   ============================================================ */
// `road` NAO e a cor do asfalto: e a da linha da malha viaria sempre residente, que
// precisa continuar legivel sobre o vazio. `asfalto` e a fita da pista, que a saida
// sRGB mais o ACES levantam muito -- medido, 0x5A6774 chegava a luminancia 197 na
// tela, mais claro que a calcada, o inverso do real. Eram dois conceitos numa
// constante so.
// v12: o asfalto virou PRETO AZULADO. Era 0x1E2226, cinza praticamente neutro (30,34,38);
// agora 0x141B29 (20,27,41), com o azul quase o dobro do vermelho. `asfaltoPlano` e o
// mesmo asfalto na malha de preenchimento de cruzamento, que e MeshBasic (sem luz) e por
// isso renderiza mais claro com o mesmo hex -- os dois andam juntos, e antes um deles
// estava solto como literal la embaixo, no buildStreets.
const K = { void:0x1A222C, block:0x29323E, walk:0x46525F, road:0x5A6774,
  asfalto:0x141B29, asfaltoPlano:0x121724,
  mark:0xD7DCE2, markEixo:0xD7DCE2,
  wall:0xA7AFB8, roof:0x767E88, green:0x2F5C3C, tree:0x3F8058,
  res:0x4BDB7C, biz:0xF13A52, civic:0x8659F2 };

/* `rua_foto`: a fita da rua calibrada contra FOTO AEREA (a do cruzamento da Av. Braz
   Olaia Acosta com o Ribeirao Shopping). Nao e "mais detalhe" -- e menos:

   O AZUL SAI. `asfalto` era 0x141B29 (azul o dobro do vermelho), escolhido olhando a
   rua de PERTO, onde ela vive na parte baixa da curva. Visto de cima, que e como o
   mapa e usado, o mesmo hex chega na tela em (80,97,123): azul-aco, nao asfalto. E a
   luz hemisferica que faz isso -- o ceu (0xC7D6E8) bate inteiro numa face horizontal
   --, entao o albedo precisa vir FRIO pra chegar neutro, e nao o contrario.

   A MANCHA CAI PELA METADE. 0,42 foi calibrado quando o asfalto era claro e o ACES
   comprimia o topo da curva; com a pista escura ela deixou de ser comprimida e a rua
   passou a ler como brim, nao como recapeamento. Ver [[mapa-3d-textura-da-rua]].

   A CALCADA PERDE O AZUL junto: ela e a mesma fita, e sozinha ficaria denunciando.  */
const AP_RUA = !!APAR.rua_foto;
if (AP_RUA) Object.assign(K, {
  asfalto:0x181817, asfaltoPlano:0x141413, walk:0x444441,
  // A tinta de faixa nao e branca no Brasil: eixo (separa sentidos) e AMARELO desde
  // 1998, divisoria de rolamento e branca. Sao duas tintas, entao sao dois hex.
  mark:0xD8D6D0, markEixo:0xC69526 });
const CCOL = [K.wall, K.res, K.biz, K.civic];

/* Densidade de vegetacao medida por satelite (NDVI do Sentinel-2, ver
   pipeline/fontes/vegetacao.py). Ate aqui a arvore era plantada em cima do
   `leisure=park` / `landuse=forest` do OSM, que e BINARIO: bosque fechado e canteiro
   pelado recebiam a mesma densidade. Agora a densidade e continua e vem de uma imagem
   de satelite recente.

   `ndviEm` devolve 0..1 ja normalizado entre o piso e o teto configurados: 0 e
   asfalto/telhado, 1 e mata fechada. */
const VEG = (() => {
  const el = document.getElementById("__vegetacao");
  if (!el) return null;
  let d; try { d = JSON.parse(el.textContent); } catch (e) { return null; }
  if (!d || !d.ndvi_b64) return null;
  const bin = atob(d.ndvi_b64), n = d.n, g = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) g[i] = bin.charCodeAt(i);
  if (g.length !== n*n) { console.warn("vegetacao: grade incoerente"); return null; }
  return { n, half: d.half_m, g, cena: d.cena, data: d.data };
})();

function ndviBruto(x, z) {
  if (!VEG) return 0.25;
  const n = VEG.n, h = VEG.half;
  const c = Math.max(0, Math.min(n-1, ((x + h) / (2*h) * (n-1)) | 0));
  const r = Math.max(0, Math.min(n-1, ((z + h) / (2*h) * (n-1)) | 0));
  return VEG.g[r*n + c] / 255 * 1.1 - 0.2;
}


/* ============================================================
   3b. Nível de gráficos — o que a máquina aguenta
   ============================================================
   Máquina fraca não trava por causa da linguagem: o laço de render não faz conta
   nenhuma (ver `frame()`), e já foi medido que cortar 68% dos triângulos não mudou o
   quadro. O que pesa são quatro decisões de CONFIGURAÇÃO, e as duas primeiras têm que
   ser tomadas AQUI porque são atributos do contexto WebGL — depois de criado, não se
   troca sem recriar tudo:

     - `antialias` liga MSAA 4x na tela inteira. Custo puro de preenchimento, que é o
       recurso mais escasso numa GPU integrada.
     - `logarithmicDepthBuffer` faz cada fragmento escrever gl_FragDepth, e isso
       DESLIGA o early-Z da GPU: numa cidade vista de cima, com prédio atrás de prédio,
       ela passa a sombrear tudo que está escondido em vez de descartar cedo. Em GPU
       dedicada quase não aparece; em iGPU é o item mais caro da lista.

   As outras duas (resolução e sombra) mudam em tempo de execução e estão no governador
   do laço, mais abaixo.

   O nível não é adivinhação definitiva: é um palpite inicial pela string da GPU, que o
   governador corrige medindo. Quando ele desiste no piso da resolução, grava o nível
   rebaixado pra PRÓXIMA abertura -- que é a única forma de o antialias e o log-depth
   saírem do caminho, já que dependem da criação do contexto. */
const QUAL_NIVEIS = {
  // dpr: teto de resolução. O custo de preenchimento é quadrático nele, então é a
  // alavanca mais forte que existe -- num notebook a 150% de escala o devicePixelRatio
  // é 1,5, e prendê-lo em 1 corta 55% dos pixels sem mudar mais nada.
  // sombraCidade: medindo a cena montada, `castShadow` é FALSE em prédio, muro, árvore
  // e portão -- os únicos objetos que projetam sombra na página inteira são os móveis
  // do interior (seção 12). Ou seja: fora de casa o mapa de sombra do sol está sempre
  // vazio, e ainda assim 956 malhas o amostram por fragmento, com filtro PCF, pra
  // compor exatamente nada. Custou 5% do quadro na GTX 1650, onde sobra preenchimento;
  // numa iGPU, que é onde o problema aparece, é justamente o recurso que falta. Sai nos
  // níveis fracos. Em "alto" fica, porque lá o custo é irrelevante e a sombra volta a
  // valer no dia em que alguma coisa da cidade projetar.
  // ceuTex: largura da textura do ceu de dentro de casa (secao 12). 2.048 px pros
  // 360 graus da volta dao 0,18 grau por texel; em 1.024 a nuvem magnifica e borra.
  // Sao 8 MB de textura contra 2 -- vale onde sobra memoria, nao numa iGPU.
  alto:  { aa:true,  logdepth:true,  dpr:2,    dprMin:1,    somMap:2048, somSuave:true,  sombraCidade:true,  ceuTex:2048 },
  medio: { aa:false, logdepth:false, dpr:1.25, dprMin:0.75, somMap:1536, somSuave:false, sombraCidade:false, ceuTex:1024 },
  baixo: { aa:false, logdepth:false, dpr:1,    dprMin:0.55, somMap:1024, somSuave:false, sombraCidade:false, ceuTex:1024 },
};
// localStorage joga em file:// (origem opaca) e em janela anônima. Como a página abre
// por duplo clique de propósito, ler isso sem proteção derrubaria o app inteiro.
const guarda = {
  le(k)   { try { return localStorage.getItem(k); } catch (e) { return null; } },
  grava(k,v) { try { localStorage.setItem(k, v); } catch (e) {} },
};
function gpuString() {
  try {
    const c = document.createElement("canvas");
    const gl = c.getContext("webgl") || c.getContext("experimental-webgl");
    if (!gl) return "";
    const d = gl.getExtension("WEBGL_debug_renderer_info");
    return d ? (gl.getParameter(d.UNMASKED_RENDERER_WEBGL) || "") : "";
  } catch (e) { return ""; }
}
const GPU = gpuString();
function palpiteNivel() {
  const g = GPU.toLowerCase();
  // Rasterizador de software: nem "baixo" salva, mas é o menos pior.
  if (/swiftshader|llvmpipe|software|basic render/.test(g)) return "baixo";
  // iGPU da Intel e a APU antiga da AMD são exatamente o caso que motivou isto.
  if (/intel|uhd graphics|hd graphics|iris|vega \d|radeon r[2-5]\b/.test(g)) return "baixo";
  if (/nvidia|geforce|quadro|radeon rx|apple m\d/.test(g)) return "alto";
  // Sem string de GPU (extensão bloqueada) o número de núcleos é o que sobra.
  if ((navigator.hardwareConcurrency || 4) <= 4) return "baixo";
  return "medio";
}
const QS = new URLSearchParams(location.search);
// Precedência: ?q= manda (é como se testa), depois o que ficou gravado, depois o palpite.
const NIVEL_NOME = QUAL_NIVEIS[QS.get("q")] ? QS.get("q")
                 : QUAL_NIVEIS[guarda.le("mapa3d.qual")] ? guarda.le("mapa3d.qual")
                 : palpiteNivel();
const NIVEL = QUAL_NIVEIS[NIVEL_NOME];
// Lido lá na criação de cada malha da cidade (chão, rua, calçada, muro, prédio, árvore,
// portão). É decidido UMA vez, no boot, de propósito: mexer em `receiveShadow` depois
// obriga o three a recompilar o shader de toda malha afetada, e 956 recompilações no
// meio do uso é um congelamento pior que o que se queria evitar.
const SOMBRA_CIDADE = NIVEL.sombraCidade;

/* three r168 (4.4 do plano). O gerenciamento de cor automatico do r152+ fica
   DESLIGADO de proposito: com ele ligado todo `setHex`/`setRGB` passa a ser
   interpretado como sRGB e convertido pro espaco linear de trabalho, e a cidade
   inteira -- paleta de tipologia, leque de telha, tinta de arvore, cor de movel --
   foi calibrada olhando pixel contra a semantica do r128, junto com a exposicao do
   ACES em 1,18 e o `rgbAcabamento()`. Ligar isso e reabrir a calibracao inteira, que
   e outra tarefa. Desligado, o r168 se comporta como o r128 nesse ponto.
   A saida continua sendo sRGB, agora por `outputColorSpace`. */
if (THREE.ColorManagement) THREE.ColorManagement.enabled = false;

const canvas = $("c");
const renderer = new THREE.WebGLRenderer({ canvas, antialias:NIVEL.aa,
  powerPreference:"high-performance", logarithmicDepthBuffer:NIVEL.logdepth });
renderer.setPixelRatio(Math.min(devicePixelRatio, NIVEL.dpr));
// ACES no lugar do corte linear: sem ele, a luz de teto do interior estoura em branco
// chapado no ponto mais forte e a curva morre. Exposicao levemente acima de 1 pra
// compensar o que o ACES escurece no meio-tom -- calibrado olhando a CIDADE, nao o
// interior, porque quem paga o preco de um tone mapping global e ela.
renderer.toneMapping = THREE.ACESFilmicToneMapping;
// 1,18 compensava o meio-tom que o ACES escurece. Com o sol mais forte (ver `sun`)
// isso passa a estourar: a paleta de parede de casa e sobrado tem salmao, terracota e
// ocre desde a Fase 2, e nada disso aparecia porque a exposicao levava tudo pro branco.
// Baixar 9% e o que faz a cor pintada VOLTAR -- e o ganho e na cor, nao no brilho.
renderer.toneMappingExposure = AP_LUZ ? 1.075 : 1.18;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = NIVEL.somSuave ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
// O sol é reposicionado em relação ao alvo a cada quadro, então o three redesenhava o
// mapa de sombra SEMPRE -- uma segunda passada da cena inteira, com câmera parada e
// resultado idêntico ao anterior. Isso praticamente dobrava a submissão de draw call,
// que é o gargalo medido (23 us cada). Agora quem manda redesenhar é `sujaSombra()`, e
// só quando alguma coisa que projeta sombra de fato mudou.
renderer.shadowMap.autoUpdate = false;
let sombraSuja = true;
function sujaSombra() { sombraSuja = true; }
renderer.setClearColor(K.void);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(K.void, 700, 3000);   // ver nevoaDoQuadro: isto e so o valor de partida
if (new URLSearchParams(location.search).get("srgb") !== "0") {
  if ("outputColorSpace" in renderer) renderer.outputColorSpace = THREE.SRGBColorSpace;
  else renderer.outputEncoding = THREE.sRGBEncoding;
  const VOID2 = 0x59636F;
  renderer.setClearColor(VOID2);
  scene.fog.color.setHex(VOID2);
}
const camera = new THREE.PerspectiveCamera(40, 1, 2, 40000);
// v9: 2 m de plano proximo e MEIA SALA. Vendo a cidade de cima nada chega tao
// perto e o corte protege a precisao do buffer de profundidade; dentro de casa
// ele apagaria o chao (1,62 m abaixo do olho) e a parede em que se encosta.
//
// Sem o buffer logaritmico (níveis medio/baixo) quem protege a precisao passa a ser a
// RAZAO near/far, e 0,08 contra 40.000 é 500 mil -- z-fighting até no que está perto.
// Duas frouxidoes resolvem sem custo visivel: o near de dentro de casa sobe pra 15 cm
// (ainda abaixo de encostar numa parede, e o chao fica 1,62 m abaixo do olho), e o far
// de dentro de casa cai pra 6 km -- a NEVOA ja fecha em 5.500 m, entao o que foi
// cortado ali era geometria pintada da cor do fundo. Razao final: 40 mil.
const NEAR_CIDADE = 2, NEAR_CASA = NIVEL.logdepth ? 0.08 : 0.15;
const FAR_CIDADE = 40000, FAR_CASA = NIVEL.logdepth ? 40000 : 6000;
// 40 graus e teleobjetiva pra quem esta dentro de uma sala de 4 m: metade do
// comodo fica fora do quadro e o lugar parece um corredor. Interior de
// arquitetura se fotografa com grande-angular, e e o que a vista de dentro usa.
const FOV_CIDADE = 40;
// Dentro de casa o que importa e o campo HORIZONTAL: `camera.fov` do three e o
// vertical, e numa tela de celular em pe (proporcao 0,46) 62 graus verticais viram
// 30 horizontais -- uma luneta apontada pra parede. Aqui o alvo e horizontal e o
// vertical sai da proporcao da tela, entao o enquadramento e o mesmo deitado ou em pe.
// v12: 78 -> 95 graus horizontais a pedido. E a faixa em que interior de arquitetura e
// fotografado de verdade (16-20 mm em full frame da 90-100); abaixo disso uma sala de
// 3,5 m nao cabe no quadro de quem esta dentro dela. O teto de 80 graus VERTICAIS
// continua valendo e e ele que segura a distorcao numa tela em pe.
const FOV_H_CASA = 95, FOV_H_PLANTA = 72;
function fovInterior(planta) {
  const alvo = planta ? FOV_H_PLANTA : FOV_H_CASA;
  // innerWidth/innerHeight, nao camera.aspect: no primeiro quadro depois de entrar o
  // aspect ainda e o do quadro anterior (quem o atualiza e o resize(), dentro do laco),
  // e o campo saia calculado pra uma tela quadrada que nao existe.
  const a = innerWidth / innerHeight;
  const v = 2 * Math.atan(Math.tan(alvo * Math.PI/360) / a) * 180/Math.PI;
  // Teto de 80 graus VERTICAIS: numa tela em pe manter o campo horizontal exigiria 120,
  // e a distorcao de barril fica pior que o enquadramento apertado que ela resolve.
  return Math.max(40, Math.min(80, v));
}
const target = new THREE.Vector3();
const sph = new THREE.Spherical(900, 0.98, 0.55);

/* O r155 tirou o fator PI que o renderer aplicava sobre a intensidade de TODA luz
   (era o `useLegacyLights`, removido de vez no r165). Sem ele, a mesma cena fica
   escura: medido no A/B controlado (scratchpad/ab_three.py), a mesma parede
   0xD9D2C7 sob o mesmo sol e a mesma hemisferica dava (219,218,217) no r128 e
   (153,152,149) no r168. Multiplicando SOL e HEMISFERICA por PI o pixel volta a
   (219,218,217) -- identico, nao parecido.

   O fator fica aqui, num lugar so, pra os numeros do resto do codigo continuarem
   sendo os que foram calibrados olhando pixel (1,40 de sol dentro de casa, 0,58 da
   luminaria, 0,20 da hemisferica) e continuarem comparaveis com o PIPELINE.md. */
const LUZ_PI = parseInt(THREE.REVISION, 10) >= 155 ? Math.PI : 1;
/* A HEMISFERICA ERA MAIS FORTE QUE O SOL, e isso e o que chapava a cidade.
   Com 0,72 de ceu contra 0,95 de sol -- e a hemisferica batendo em TODA face, enquanto
   o sol so bate em algumas --, a parede virada pro sol e a virada pro lado oposto
   saiam quase com o mesmo valor. Sem degrau entre faces nao ha VOLUME: o predio le
   como recorte de papel, e nenhuma quantidade de detalhe de fachada conserta isso,
   porque o problema esta uma camada antes do desenho.

   Alem da forca, a COR do chao. 0x1A222C e quase preto e frio: a parede na sombra
   recebia so azul palido de cima e azul escuro de baixo, duas fontes cinza-azuladas
   que dao cinza sem croma. O olho le "sem cor", nao "na sombra". E exatamente o
   diagnostico que o interior ja tinha feito (ver acendeInterior), so que la o conserto
   ficou trancado dentro de casa. Aqui embaixo o que rebate na parede e asfalto, terra
   e calcada -- luz quente. A parede na sombra passa a ser bege escuro, nao cinza.  */
const hemi = new THREE.HemisphereLight(0xC7D6E8, AP_LUZ ? 0x3B372E : 0x1A222C,
                                       (AP_LUZ ? 0.50 : 0.72) * LUZ_PI);
scene.add(hemi);
// Onde o sol fica em relacao ao alvo. E constante: o sol acompanha a camera, entao a
// DIRECAO da luz nunca muda na cidade inteira -- e e dela que a sombra de contato tira
// pra que lado projetar (ver refazSombras).
const SOL_OFF = { x: -520, y: 940, z: 640 };
const sun = new THREE.DirectionalLight(0xFFF4E0, (AP_LUZ ? 1.16 : 0.95) * LUZ_PI);
sun.castShadow = true; sun.shadow.mapSize.set(NIVEL.somMap, NIVEL.somMap);
const SHR = 640, sc = sun.shadow.camera;
sc.left=-SHR; sc.right=SHR; sc.top=SHR; sc.bottom=-SHR; sc.near=200; sc.far=3200;
sun.shadow.bias = -0.0012;
scene.add(sun, sun.target);

/* ============================================================
   4a. Relevo (elevação aproximada do terreno)
   ============================================================ */
const ELEV_HALF = CIDADE.relevo_grade.half_m, ELEV_N = CIDADE.relevo_grade.n;
// A cidade tem ~33km de largura mas só umas dezenas de metros de desnível local — em
// escala real (1:1) até ladeira de subir de primeira marcha parece quase reta vista de
// cima. Exagera o relevo verticalmente (comum em qualquer visualização 3D de terreno)
// pra ele ficar visualmente aparente sem inventar dado novo.
const TERRAIN_EXAG = 4.5;
let elevGrid = null, reliefAmount = 0, reliefTarget = 0;
const terrainRegistry = [];
// Casas e ruas ficam presas ao relevo (aDY) independente do exagero de altura (uHeight):
// o shader soma o relevo real por cima da altura já escalada, em vez de escalar os dois juntos.
const uRelief = { value: 0 }, uHeight = { value: 1 };
// v12: 0 de dia, 1 de noite. Uniforme (e nao troca de material) porque mexer em
// material obriga o three a recompilar o shader de TODA malha afetada -- as mesmas
// 956 recompilacoes que a nota do NIVEL evita.
const uNoite = { value: 0 };
// v9: (cx, cz, raio, yMin) -- cilindro que a fachada NAO desenha. Com raio 0 nao faz
// nada. Serve pra apagar a casca do predio em que se entrou: de dentro do apartamento
// a fachada tapa a janela, e cortar a cidade inteira num plano (o que o modo planta
// faz) transforma o bairro numa maquete fatiada em volta de quem esta em pe na sala.
// Um furo custa quatro uniforms e um `discard`; identificar o predio por atributo
// custaria 8 bytes por vertice em milhoes de vertices.
const uFuro = { value: new THREE.Vector4(0, 0, 0, 0) };

function terrainY(x, z) {
  if (!elevGrid) return 0;
  const N = ELEV_N;
  const u = Math.max(0, Math.min(N-1, (x+ELEV_HALF)/(2*ELEV_HALF)*(N-1)));
  const v = Math.max(0, Math.min(N-1, (z+ELEV_HALF)/(2*ELEV_HALF)*(N-1)));
  const i0 = Math.floor(u), j0 = Math.floor(v), i1 = Math.min(N-1,i0+1), j1 = Math.min(N-1,j0+1);
  const fu = u-i0, fv = v-j0;
  const a = elevGrid[j0*N+i0], b = elevGrid[j0*N+i1], c = elevGrid[j1*N+i0], d = elevGrid[j1*N+i1];
  return ((a*(1-fu)+b*fu)*(1-fv) + (c*(1-fu)+d*fu)*fv) * TERRAIN_EXAG;
}
/* 1.2 do plano da Fase 1, na forma pedida: uma casa de cache pro ponto amostrado com
   mais frequencia, que e o ALVO da orbita. Uma casa so basta porque quem chama de
   verdade em sequencia e sempre o mesmo ponto; qualquer outro uso derruba o cache e
   volta a custar a amostragem cheia. */
let _tyCache = { x: NaN, z: NaN, v: 0 };
function terrainYCached(x, z) {
  if (x !== _tyCache.x || z !== _tyCache.z) {
    _tyCache.x = x; _tyCache.z = z; _tyCache.v = terrainY(x, z);
  }
  return _tyCache.v;
}

function registerTerrain(geo) {
  const pos = geo.attributes.position, n = pos.count;
  const baseY = new Float32Array(n);
  // Prédios já chegam com um valor de relevo por vértice pré-calculado (presetDY, um só
  // por edificação — ver buildBuildings) em vez de cada vértice amostrar o seu próprio
  // ponto; chão/rua/verde continuam amostrando por vértice normalmente.
  const dy = geo.userData.presetDY || new Float32Array(n);
  for (let i = 0; i < n; i++) { baseY[i] = pos.getY(i); if (!geo.userData.presetDY) dy[i] = terrainY(pos.getX(i), pos.getZ(i)); }
  geo.userData.terrain = { baseY, dy };
  // v8: so o shader de predio (dynamicHeight) le aDY. Chao/rua/muro tem o
  // relevo aplicado na CPU por applyTerrainToGeo -- ali o atributo e peso
  // morto na GPU (4 B x 1,45 M vertices).
  if (geo.userData.dynamicHeight)
    geo.setAttribute("aDY", new THREE.BufferAttribute(dy, 1));
  terrainRegistry.push(geo);
  if (reliefAmount) applyTerrainToGeo(geo, reliefAmount, true);
}
function applyTerrainToGeo(geo, amount, settle) {
  const t = geo.userData.terrain; if (!t) return;
  // Prédios/risers levam o relevo pelo uniform uRelief no shader (ver facadeMaterial/riseLine),
  // não por posição de vértice, para não serem esticados junto do exagero de altura (hs).
  if (geo.userData.dynamicHeight) return;
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setY(i, t.baseY[i] + t.dy[i]*amount);
  pos.needsUpdate = true;
  if (settle) {
    if (geo.attributes.normal) geo.computeVertexNormals();
    geo.computeBoundingSphere();
  }
}

// v8: esfera de corte que acompanha o que o SHADER faz com o vertice.
// O renderizador desloca cada vertice em `transformed.y*=riser*uHeight` e
// `transformed.y+=aDY*uRelief` -- nada disso existe na geometria da CPU, e por
// isso o v3 desligou o frustum culling: o three cortava quarteirao visivel.
// Aqui a esfera e a exata MAIS o deslocamento maximo que o shader pode aplicar,
// que da pra medir na propria malha (maior |aDY|, topo da caixa).
function medeFolga(geo) {
  geo.computeBoundingSphere();
  geo.computeBoundingBox();
  const dy = geo.userData.terrain && geo.userData.terrain.dy;
  let dm = 0;
  if (dy) for (let i = 0; i < dy.length; i++) { const v = Math.abs(dy[i]); if (v > dm) dm = v; }
  geo.userData.r0 = geo.boundingSphere.radius;
  geo.userData.dyMax = dm;
  geo.userData.hMax = Math.max(0, geo.boundingBox.max.y);
}
function inflaEsfera(geo) {
  if (geo.userData.r0 === undefined || !geo.boundingSphere) return;
  geo.boundingSphere.radius = geo.userData.r0
    + geo.userData.dyMax * Math.abs(uRelief.value)
    + geo.userData.hMax * Math.max(0, uHeight.value - 1);
}
let _relAnt = -1, _altAnt = -1;
function ajustaEsferas() {
  if (uRelief.value === _relAnt && uHeight.value === _altAnt) return;
  _relAnt = uRelief.value; _altAnt = uHeight.value;
  // Relevo e altura deslocam o vértice no shader: a sombra desenhada é de outro prédio.
  sujaSombra();
  for (const o of gBuild.children) inflaEsfera(o.geometry);
  for (const o of gLines.children) inflaEsfera(o.geometry);
}
const gBuild = new THREE.Group(), gLines = new THREE.Group(),
      gRoad  = new THREE.Group(), gRest  = new THREE.Group();
scene.add(gBuild, gLines, gRoad, gRest);

const HT = TILE_M/2;
const markMat = new THREE.LineBasicMaterial({ color:0x5FC777, transparent:true, opacity:0.5 });
const markGeo = new THREE.BufferGeometry();
markGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array([
  -HT,0,-HT, HT,0,-HT,  HT,0,-HT, HT,0,HT,  HT,0,HT, -HT,0,HT,  -HT,0,HT, -HT,0,-HT ]), 3));
const fillMat = new THREE.MeshBasicMaterial({ color:0x5FC777, transparent:true, opacity:0.05, depthWrite:false });
const mark = new THREE.Group();
mark.add(new THREE.LineSegments(markGeo, markMat));
const fillPlane = new THREE.Mesh(new THREE.PlaneGeometry(TILE_M, TILE_M), fillMat);
fillPlane.rotation.x = -Math.PI/2; mark.add(fillPlane);
mark.position.y = 0.45; mark.visible = false; scene.add(mark);

// Farol que aponta um imóvel específico no modelo 3D (anel no chão + feixe vertical),
// usado pela lista de "Imóveis para inspeção 3D" — cor âmbar pra não confundir com o
// quadrado verde do cursor de download de quadrante acima.
const houseBeaconMat = new THREE.LineBasicMaterial({ color:0xFFC24B, transparent:true, opacity:0.85 });
const houseRingGeo = new THREE.BufferGeometry();
{
  const N = 48, R1 = 13, pos = new Float32Array(N*2*3);
  for (let i = 0; i < N; i++) {
    const a0 = i/N*Math.PI*2, a1 = (i+1)/N*Math.PI*2, k = i*6;
    pos[k]=Math.cos(a0)*R1; pos[k+1]=0; pos[k+2]=Math.sin(a0)*R1;
    pos[k+3]=Math.cos(a1)*R1; pos[k+4]=0; pos[k+5]=Math.sin(a1)*R1;
  }
  houseRingGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
}
const houseBeamGeo = new THREE.BufferGeometry();
houseBeamGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array([0,0.5,0, 0,130,0]), 3));
const houseBeacon = new THREE.Group();
houseBeacon.add(new THREE.LineSegments(houseRingGeo, houseBeaconMat));
houseBeacon.add(new THREE.LineSegments(houseBeamGeo, houseBeaconMat));
houseBeacon.visible = false;
scene.add(houseBeacon);

const slow = matchMedia("(prefers-reduced-motion: reduce)").matches;
const risers = [];

/* ============================================================
   Fachada: um shader, oito tipologias
   ============================================================
   Não existe dado aberto de fachada em lugar nenhum do mundo — nem o Overture,
   nem o OSM, nem lidar nenhum dizem onde ficam as janelas. Então fachada é
   sempre desenhada, nunca lida. O que muda entre um mapa que parece maquete de
   isopor e um que parece cidade é só QUANTA regra você põe nesse desenho.

   Aqui a regra vem por vértice em `aStyle` = (tipologia, semente, altura útil).
   Como os três vértices de um triângulo carregam o mesmo valor, a interpolação
   entrega o número exato — dá pra ramificar por tipo sem material novo. É isso
   que mantém o custo em ZERO chamada de desenho a mais: um único material
   continua servindo o quarteirão inteiro.

   `aFace` continua sendo (u ao longo do perímetro, altura na parede), e telhado
   continua marcado com v = -1 pra sair fora de tudo isso.
   ============================================================ */
/* As duas tabelas da malha de janela, e qual delas a cidade usa.

   Trocar o SIGNIFICADO de `w.zw` (fracao do pe-direito -> metros acima do piso) nao
   cabe num `mix`: as oito linhas da tabela mudam de numero junto. Entao as duas
   versoes ficam escritas, e a chave da cidade escolhe -- quem nao declarou
   `janela_metrica` recebe GLSL identico ao de antes, byte a byte, e nao muda um pixel
   ainda que seja remontada.

   `AP_GLSL` faz o mesmo pelo acabamento: com 0.0 o compilador dobra os termos novos
   pra zero e o especular preto do material devolve exatamente o pixel anterior.     */
const AP_GLSL = AP_LUZ ? "1.0" : "0.0";

const JAN_TABELA = AP_JANELA ? `
         float pu = 3.4, pv = 3.15;            // largura do vao e pe-direito, em metros
         // x,y = fracao do vao, na horizontal. z,w = PEITORIL e VERGA, em METROS acima
         // do piso daquele pavimento (ver a nota em JAN_MALHA).
         vec4  w  = vec4(0.16, 0.84, 0.90, 2.55);
         float skip = 0.06;                    // fracao de colunas cegas
         float vitrine = 0.0, porta = 0.0, mull = 0.0, rib = 0.0, tint = 0.0;
         float peD = 3.15;                     // piso do primeiro pavimento-tipo

         if (st < 0.5)      { pu=3.6; pv=3.05; w=vec4(0.22,0.66,1.05,2.20); skip=0.16; porta=1.0; peD=0.0; }
         else if (st < 1.5) { pu=3.5; pv=3.00; w=vec4(0.20,0.64,1.05,2.20); skip=0.12; porta=1.0; peD=0.0; }
         else if (st < 2.5) { pu=3.3; pv=3.15; w=vec4(0.14,0.86,0.72,2.55); skip=0.05; peD=3.7; porta=1.0; }
         else if (st < 3.5) { pu=3.7; pv=3.30; w=vec4(0.18,0.82,1.00,2.65); skip=0.14; vitrine=1.0; peD=4.2; porta=1.0; }
         else if (st < 4.5) { pu=2.7; pv=3.20; w=vec4(0.06,0.94,0.42,2.90); skip=0.00; vitrine=1.0; mull=1.0; peD=4.7; tint=1.0; porta=1.0; }
         else if (st < 5.5) { pu=6.0; pv=2.60; skip=1.00; rib=1.0; peD=0.0; porta=1.0; }
         else if (st < 6.5) { pu=4.3; pv=3.60; w=vec4(0.22,0.78,1.05,3.10); skip=0.10; peD=4.8; porta=1.0; }
         else               { pu=3.2; pv=2.80; w=vec4(0.32,0.62,1.20,2.05); skip=0.58; porta=1.0; peD=0.0; }
` : `
         float pu = 3.4, pv = 3.15;            // periodo da malha de janelas
         vec4  w  = vec4(0.16, 0.84, 0.26, 0.84);
         float skip = 0.06;                    // fracao de colunas cegas
         float vitrine = 0.0, porta = 0.0, mull = 0.0, rib = 0.0, tint = 0.0;
         float peD = 3.15;                     // pe-direito do terreo

         if (st < 0.5)      { pu=4.7; pv=3.05; w=vec4(0.30,0.63,0.42,0.80); skip=0.46; porta=1.0; peD=0.9; }
         else if (st < 1.5) { pu=4.1; pv=3.05; w=vec4(0.26,0.62,0.36,0.80); skip=0.32; porta=1.0; peD=0.9; }
         else if (st < 2.5) { pu=3.3; pv=3.15; w=vec4(0.14,0.86,0.22,0.82); skip=0.05; peD=3.7; porta=1.0; }
         else if (st < 3.5) { pu=3.7; pv=3.30; w=vec4(0.18,0.82,0.30,0.80); skip=0.14; vitrine=1.0; peD=4.2; porta=1.0; }
         else if (st < 4.5) { pu=2.7; pv=3.20; w=vec4(0.06,0.94,0.12,0.90); skip=0.00; vitrine=1.0; mull=1.0; peD=4.7; tint=1.0; porta=1.0; }
         else if (st < 5.5) { pu=6.0; pv=2.60; skip=1.00; rib=1.0; peD=0.0; porta=1.0; }
         else if (st < 6.5) { pu=4.3; pv=3.60; w=vec4(0.22,0.78,0.30,0.86); skip=0.10; peD=4.8; porta=1.0; }
         else               { skip=1.00; porta=1.0; peD=0.6; }
`;

const JAN_MALHA = AP_JANELA ? `
         // --- pavimentos-tipo -----------------------------------------
         vec2 cell = vec2(vFace.x/pu, (y - peD)/pv);
         vec2 gq   = fract(cell);
         float col = floor(cell.x), row = floor(cell.y);
         float body = step(peD, y) * step(y, hU - 0.35);   // nada acima da laje: platibanda fica limpa
         // A altura DENTRO do pavimento, em METROS. Peitoril e verga tem tamanho
         // fisico (1,05 m e 2,20 m acima do piso, na casa e na torre) e nao fracao do
         // pe-direito -- e era fracao. E ISSO que deixava a rua de casa terrea CEGA:
         // 0,42 de 3,05 m poe o peitoril a 2,18 m do chao, ja dentro dos 35 cm que o
         // 'body' corta abaixo do beiral. Sobrava uma lasca escura colada no telhado,
         // que o olho le como sombra e nao como vao. Como casa e a tipologia da maior
         // parte da cidade, o mapa inteiro perdia a referencia de tamanho: sem fileira
         // de janela nada na fachada diz se aquilo tem 3 m ou 30. Mesma licao do
         // embasamento da Fase 2 -- o que tem tamanho fisico se mede em metro.
         float fy = y - peD - row * pv;
         // O pavimento so ganha janela se o VAO INTEIRO couber abaixo do beiral. Sem
         // isto o ultimo pavimento de qualquer altura quebrada reproduz a lasca: meia
         // janela cortada no meio da verga, que e pior que janela nenhuma.
         float cabe = step(peD + row * pv + w.w + 0.30, hU);
         float open = step(skip, fract(sin(col*12.9898 + row*3.713 + sd*311.7) * 43758.5453)) * cabe;
         float win = step(w.x,gq.x)*step(gq.x,w.y)*step(w.z,fy)*step(fy,w.w) * open * body;
         // A fileira de janela e a unica coisa da fachada que diz de quantos andares e
         // o predio, e ela nao alias como o resto do detalhe: com 3-4 m de passo ainda
         // sobram ~10 px a 700 m. Por isso ela tem o proprio alcance, mais longo que o
         // 'fade' geral (que existe pra apagar peitoril, escorrido e nervura).
         float fadeJ = 1.0 - smoothstep(430.0, 1050.0, length(vViewPosition));
         // Peitoril e verga. A janela era um retangulo escuro chapado: sem a faixa
         // clara embaixo (o peitoril pega sol de cima) e sem a sombra do vao no alto,
         // o vao nao tem profundidade nenhuma -- e vao sem profundidade e o que
         // separa uma fachada de um adesivo colado na caixa.
         float sill = step(w.z - 0.11, fy) * step(fy, w.z)
                    * step(w.x - 0.03, gq.x) * step(gq.x, w.y + 0.03) * open * body;
         float verga = win * smoothstep(0.34, 0.0, w.w - fy);
` : `
         // --- pavimentos-tipo -----------------------------------------
         vec2 cell = vec2(vFace.x/pu, (y - peD)/pv);
         vec2 gq   = fract(cell);
         float col = floor(cell.x), row = floor(cell.y);
         float body = step(peD, y) * step(y, hU - 0.35);   // nada acima da laje: platibanda fica limpa
         float open = step(skip, fract(sin(col*12.9898 + row*3.713 + sd*311.7) * 43758.5453));
         float win = step(w.x,gq.x)*step(gq.x,w.y)*step(w.z,gq.y)*step(gq.y,w.w) * open * body;
         float fadeJ = fade;
         // Peitoril e verga. A janela era um retangulo escuro chapado: sem a faixa
         // clara embaixo (o peitoril pega sol de cima) e sem a sombra do vao no alto,
         // o vao nao tem profundidade nenhuma -- e vao sem profundidade e o que
         // separa uma fachada de um adesivo colado na caixa.
         float sill = step(w.z - 0.09, gq.y) * step(gq.y, w.z)
                    * step(w.x - 0.03, gq.x) * step(gq.x, w.y + 0.03) * open * body;
         float verga = win * smoothstep(0.12, 0.0, w.w - gq.y);
`;

/* ---- textura de fachada da cidade -------------------------------------
   Ate aqui a parede era cor CHAPADA: um bloco branco de 20 m e uma area de um valor
   so, e o olho le papelao. O detalhe que existia (faixa de pavimento, janela,
   peitoril) e desenho no fragmento, nao superficie.

   Nao precisa de UV nem de triplanar: `vFace.x` ja corre ao longo da fachada em
   METROS e a altura e o `y` do mundo. Os dois juntos sao a UV, e ela ja esta la
   dentro do shader pro desenho das janelas.

   TIJOLO E RARO E SO EM CASA BAIXA. Reboco pintado e o que cobre a cidade; tijolo
   aparente em predio alto nao existe por aqui, e aplicado em tudo viraria fantasia.
   A escolha sai da SEMENTE do predio (`vStyle.y`), que ja viajava no atributo.

   O que a textura NAO conserta, e a medida diz: reboco tem desvio padrao 4,1 em 255
   -- a 80 m de distancia o mipmap devolve a mesma cor chapada de antes. Quem
   sobrevive a distancia e o tijolo (desvio 42,5). Ver `pipeline/baixa_texturas.py`. */
const TEX_CIDADE = (() => {
  const el = document.getElementById("__textura");
  let d = {};
  try { d = JSON.parse(el.textContent) || {}; } catch (e) {}
  const carrega = uri => {
    if (!uri) return null;
    const im = new Image();
    const t = new THREE.Texture(im);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    // NoColorSpace de proposito: a amostragem aqui e `texture2D` na mao, fora do
    // caminho `map` do three, entao a conversao sRGB->linear que ele injeta nao
    // acontece. Usada como RAZAO em torno da media (e nao como cor), a textura
    // fica no mesmo espaco dos dois lados e a conta se cancela.
    t.colorSpace = THREE.NoColorSpace;
    t.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
    // `needsUpdate` SO depois do onload: setar antes envia uma imagem de 0x0 pra GPU
    // e a textura fica preta pro resto da sessao, sem erro no console.
    im.onload = () => { t.needsUpdate = true; };
    im.src = uri;
    return t;
  };
  return { reboco: carrega(d.reboco), tijolo: carrega(d.tijolo),
           chao: carrega(d.chao) };
})();
const TEX_ON = !!(TEX_CIDADE.reboco && TEX_CIDADE.tijolo);

function facadeMaterial(u) {
  /* O vidro deixou de dividir o acabamento do reboco (`material_luz`).
     Uma fachada inteira com `shininess:0` e `specular` preto e uma superficie so:
     janela e parede diferem apenas em quanto escurecem a cor difusa -- ou seja, a
     janela e PINTURA. E pintura escura sobre plano claro e exatamente o que faz o
     volume ler como caixa de papelao com adesivo. Aqui o Phong ganha um especular
     de verdade, e quem decide onde ele aparece e o `specularStrength` por fragmento
     (ver `gEspec` no color_fragment): vidro brilha, reboco nao. `specularStrength`
     ja existia no material -- estava em 1,0 multiplicando um especular preto. */
  const m = new THREE.MeshPhongMaterial({ vertexColors:true,
    shininess: AP_LUZ ? 56 : 0, specular: AP_LUZ ? 0x6B7682 : 0x000000,
    side:THREE.DoubleSide });
  m.onBeforeCompile = sh => {
    sh.uniforms.uT = u;
    sh.uniforms.uRelief = uRelief;
    sh.uniforms.uHeight = uHeight;
    sh.uniforms.uFuro = uFuro;
    sh.uniforms.uNoite = uNoite;
    sh.uniforms.uTexReb = { value: TEX_CIDADE.reboco };
    sh.uniforms.uTexTij = { value: TEX_CIDADE.tijolo };
    sh.vertexShader =
      "attribute vec2 aFace;\nattribute float aDist;\nattribute float aDY;\nattribute vec3 aStyle;\n" +
      "uniform float uT;\nuniform float uRelief;\nuniform float uHeight;\n" +
      "varying vec2 vFace;\nvarying vec3 vStyle;\nvarying vec3 vMundo;\nvarying vec3 vNw;\n" +
      sh.vertexShader.replace("#include <begin_vertex>",
        "#include <begin_vertex>\nvFace=aFace;\nvStyle=aStyle;\nvNw=normal;\n" +
        "float g=clamp((uT-aDist*0.5)/0.5,0.0,1.0);transformed.y*=g*g*(3.0-2.0*g)*uHeight;transformed.y+=aDY*uRelief;\n" +
        "vMundo=transformed;");

    sh.fragmentShader = "varying vec2 vFace;\nvarying vec3 vStyle;\nvarying vec3 vMundo;\nvarying vec3 vNw;\nuniform vec4 uFuro;\nuniform float uNoite;\nuniform sampler2D uTexReb;\nuniform sampler2D uTexTij;\nvec3 gLuz;\nfloat gEspec;\n" + GLSL_RUIDO +
      sh.fragmentShader
        // A luz da janela nao pode entrar na cor difusa: difusa e multiplicada pela
        // luz da cena, e a noite a luz da cena e quase zero. Entra na EMISSIVA, que
        // atravessa a iluminacao -- e por isso precisa de uma global escrita la em
        // cima, no color_fragment, e somada aqui embaixo.
        .replace("#include <emissivemap_fragment>",
                 "#include <emissivemap_fragment>\ntotalEmissiveRadiance += gLuz;")
        .replace("#include <specularmap_fragment>",
                 "#include <specularmap_fragment>\nspecularStrength = gEspec;")
        .replace("#include <color_fragment>",
      `#include <color_fragment>
       gLuz = vec3(0.0);
       gEspec = 0.0;
       // ---- textura de superficie ----------------------------------------
       // Entra ANTES do desenho de janela e telha: vao e caixilho nao levam grao
       // de reboco. E entra como RAZAO em torno da media da textura, nao como cor
       // -- a cor vem do cadastro e da tipologia, e trocar por uma foto cinza
       // apagaria a paleta inteira da cidade.
       //
       // vFace.x ja corre ao longo da fachada em METROS e vMundo.y e a altura:
       // os dois sao a UV, sem atributo novo e sem triplanar.
       float wall = 1.0 - abs(vNw.y);            // 1 na fachada, 0 na laje/telhado
       if (wall > 0.35) {
         // Tijolo aparente e RARO e so em casa baixa (ate 9 m). Em predio alto nao
         // existe por aqui, e aplicado em tudo viraria fantasia. A escolha sai da
         // semente que o aStyle ja carregava.
         float tij = step(0.90, fract(sin(vStyle.y * 57.31) * 43758.5453))
                   * step(vStyle.z * 0.1, 9.0);
         vec2 uvT = vec2(vFace.x, vMundo.y);
         vec3 tx = mix(texture2D(uTexReb, uvT * 0.55).rgb,
                       texture2D(uTexTij, uvT * 0.42).rgb, tij);
         // medias medidas em pipeline/baixa_texturas.py: 212 e 116 de 255
         float med = mix(0.831, 0.455, tij);
         float g = dot(tx, vec3(0.299, 0.587, 0.114)) / med;
         // Reboco tem desvio 4,1 em 255 e some no mipmap a 80 m; tijolo tem 42,5 e
         // sobrevive. Por isso a forca e diferente -- empatar as duas gastaria
         // contraste onde nao ha o que mostrar.
         diffuseColor.rgb *= mix(1.0, g, mix(0.45, 0.85, tij) * wall);
         // Mancha de ~6 m: sobrevive ao mipmap porque a escala dela e METRO,
         // nao milimetro. Custa zero byte e faz o que a foto de reboco nao fez.
         float mancha = vnoise(vec2(vFace.x, vMundo.y) * 0.17 + vStyle.y) * 0.62
                      + vnoise(vec2(vFace.x, vMundo.y) * 0.61) * 0.38;
         diffuseColor.rgb *= 1.0 + (mancha - 0.5) * 0.20 * wall;
       }
       float AP = ${AP_GLSL};    // 1 so na cidade que declarou 'material_luz'
       if (uFuro.z > 0.0 && vMundo.y > uFuro.w &&
           distance(vMundo.xz, uFuro.xy) < uFuro.z) discard;
       if (vFace.y >= 0.0) {
         float st = vStyle.x;
         float sd = vStyle.y / 256.0;          // semente do prédio, 0..1
         float hU = vStyle.z * 0.1;            // altura útil (topo da laje), em metros
         float y  = vFace.y;
         // Detalhe some com a distância: de perto vira desenho, de longe vira
         // ruído. A cor da parede (vertexColors) não desaparece junto -- é ela
         // que segura a variedade do bairro visto de cima.
         float fade = 1.0 - smoothstep(190.0, 560.0, length(vViewPosition));
         /* A PALETA EXISTIA E NAO CHEGAVA NA TELA. Medido na cena de Ribeirao: 70%
            das 5.021 casas e sobrados tem croma >= 0,24 no atributo de cor -- salmao,
            terracota, ocre, cinza-azulado, a abertura de paleta da Fase 2 -- e a rua
            aparecia como uma familia de brancos. Nao e a paleta: e o caminho da cor.
            A saida sRGB levanta o valor (0,81 linear vira 0,92) e o ACES desatura
            justamente o meio-tom alto, entao os dois juntos comem quase todo o croma
            das cores claras, que sao a maioria de uma rua brasileira.

            O conserto e devolver croma ANTES do tone mapping, que e onde ele se perde:
            um 'mix' de peso NEGATIVO afasta a cor do proprio cinza. So na FACHADA --
            asfalto, grama, telha e chao tem calibracao propria e nao passam por aqui.
            O 0,96 no valor e o par disso: parede pintada nao e fonte de luz, e branco
            no limite do estouro nao aceita croma nenhum.                            */
         float lumP = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
         diffuseColor.rgb = max(vec3(0.0),
                                mix(diffuseColor.rgb, vec3(lumP), -0.34 * AP)) * (1.0 - 0.04 * AP);

${JAN_TABELA}

${JAN_MALHA}

         // --- térreo ---------------------------------------------------
         float g0  = step(0.75, y) * step(y, peD - 0.55);
         float vg  = fract(vFace.x/5.2);
         float vit = g0 * vitrine * step(0.08, vg) * step(vg, 0.92);   // vitrine quase corrida
         float marq = vitrine * smoothstep(0.26, 0.0, abs(y - (peD - 0.28))) * step(y, hU);  // marquise

         // Portão de garagem numa coluna sorteada: é o que faz duas casas iguais
         // pararem de ser a mesma casa.
         float du   = fract(vFace.x/pu);
         float door = porta * step(abs(col - floor(sd*5.0 + 1.0)), 0.5)
                    * step(0.20,du) * step(du,0.80) * step(0.05,y) * step(y,2.30);

         // --- galpão: nervura da telha + fita de clarabóia --------------
         float ribv  = rib * (0.5 + 0.5*sin(y * 6.9813)) * 0.07;
         float cg    = fract(vFace.x/2.4);
         float clere = rib * step(hU-2.6, y) * step(y, hU-0.9) * step(0.10,cg) * step(cg,0.90);

         // --- linha de laje e montante da cortina de vidro --------------
         float slab = step(1.5, st) * step(st, 4.5) * body * smoothstep(0.07, 0.0, abs(gq.y - 0.02));
         float ml   = mull * step(0.43, abs(du - 0.5));

         // Noite: parte das janelas acende. O sorteio e por JANELA (coluna, fila e a
         // semente do predio), entao a mesma janela fica acesa a noite inteira, o
         // vizinho acende outras, e quem tem mais vao acende mais.
         float acesa = step(0.56, h21(vec2(col * 3.7 + sd * 91.0, row * 1.9)));
         gLuz += uNoite * max(win, vit) * acesa * vec3(1.30, 0.92, 0.52) * 2.6;
         float glass = max(max(win, vit), clere);
         /* O VIDRO DEIXOU DE SER "UM RETANGULO MAIS ESCURO". Reboco e vidro dividiam o
            mesmo acabamento -- 'shininess:0', especular preto --, entao a janela era
            PINTURA: uma mancha escura chapada num plano claro, que e literalmente o
            desenho de um adesivo colado numa caixa. As duas coisas pelas quais o olho
            reconhece vidro sao o BRILHO (o sol na vidraca) e o REFLEXO DO CEU crescendo
            com o angulo rasante -- e por isso que a mesma janela e escura de frente e
            clara de esguelha, e por isso que uma torre vista de lado acende inteira.
            Nenhuma das duas custa chamada de desenho: o brilho sai pelo
            'specularStrength', que ja existia (em 1,0, multiplicando preto), e o
            Fresnel e uma potencia do produto escalar com a normal ja interpolada.   */
         gEspec = glass * 0.90 * AP;
         float fres = pow(1.0 - clamp(abs(dot(normalize(vNw),
                          normalize(cameraPosition - vMundo))), 0.0, 1.0), 4.0);
         gLuz += AP * glass * fres * fadeJ * (1.0 - uNoite * 0.8) * vec3(0.26, 0.31, 0.39);
         float dark  = min(0.80, glass*(0.36 + 0.10*AP) + door*0.44 + marq*0.34 + verga*0.30) * fadeJ;
         diffuseColor.rgb *= 1.0 + sill * 0.14 * fade;
         diffuseColor.rgb *= 1.0 - dark;
         diffuseColor.rgb *= 1.0 - (slab*0.10 + ml*0.13 + ribv) * fade;
         diffuseColor.rgb *= 1.0 - (1.0 - step(peD, y)) * 0.045;      // embasamento (terreo)
         // v11: a faixa de embasamento em METROS. A rampa por vertice nao sabe fazer
         // faixa -- entre dois vertices o rasterizador interpola em linha reta, e
         // fatiar a parede pra por a faixa por vertice multiplicaria o triangulo da
         // cidade inteira (a mesma armadilha que a gradacao da parede do interior
         // levou). Soleira e rodape de fachada tem tamanho FISICO, ~60-90 cm, igual
         // em casa e em torre; por isso nao e fracao da altura.
         diffuseColor.rgb *= 1.0 - (1.0 - smoothstep(0.0, 0.90, y)) * 0.10;
         // Sombra do beiral (ou da platibanda): os ultimos 45 cm da parede, logo
         // abaixo do topo util. Toda casa tem essa faixa escura debaixo do beiral;
         // sem ela o telhado parece COLADO na parede, que e exatamente a colagem que
         // faz o volume ler como bloco de montar.
         diffuseColor.rgb *= 1.0 - smoothstep(0.45, 0.0, hU - y) * step(y, hU) * 0.17 * fade;
         // Platibanda: acima da laje (hU) nao ha pavimento, so parapeito -- e e ela
         // que recorta o predio contra o ceu. Sai mais clara e menos saturada que a
         // parede. O proprio hU diz onde ela COMECA de verdade; nao e preciso chutar
         // "os 10% de cima", e telhado inclinado (ph = 0) nao entra sozinho: ali a
         // parede termina exatamente em hU.
         float plat = step(hU + 0.05, y);
         vec3  pcor = mix(diffuseColor.rgb,
                          vec3(dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722))), 0.25);
         diffuseColor.rgb = mix(diffuseColor.rgb, mix(pcor, vec3(1.0), 0.10), plat);
         // Encardido de parede. Reboco pintado nao e chapa de plastico: tem mancha
         // larga de pintura e, principalmente, ESCORRIDO -- a agua que desce da laje
         // ou do beiral risca a fachada de cima pra baixo. Sao os dois motivos de uma
         // caixa branca lida como caixa branca e nao como predio.
         diffuseColor.rgb *= 0.968 + 0.064 * vnoise(vec2(vFace.x * 0.33, y * 0.21));
         float escorre = (1.0 - smoothstep(0.0, 5.5, hU - y)) * step(y, hU)
                       * smoothstep(0.58, 0.96, h21(vec2(floor(vFace.x * 2.3), sd)));
         diffuseColor.rgb *= 1.0 - escorre * 0.075 * fade;
         diffuseColor.rgb  = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.70,0.81,0.96), glass*tint*fade);
       } else {
         /* --- telhado -----------------------------------------------------
            O telhado e a superficie que MAIS aparece num mapa olhado de cima, e ate
            aqui era cor chapada: o leque de cores separava um telhado do vizinho, mas
            dentro de cada telhado nao havia nada -- nenhuma escala, nenhuma fiada. Um
            bairro inteiro saia como um campo de poligonos marrons lisos, que e
            metade do motivo de a cidade parecer maquete de bloco de montar.

            Nao entra atributo novo nenhum aqui, e por isso o custo e zero byte de
            pagina e zero chamada de desenho. A direcao em que a agua DESCE sai da
            propria normal do triangulo (vNw e a normal em espaco de objeto, que
            nesta cena e o mundo: a malha do quarteirao nao gira nem escala), e a
            posicao de mundo ja existia pro furo do interior. Com as duas, a fiada
            corre perpendicular ao declive em qualquer telhado, de qualquer angulo,
            sem UV.                                                                */
         vec3  nw    = normalize(vNw);
         float incl  = clamp(length(nw.xz) / 0.45, 0.0, 1.0);   // 0 = laje, 1 = agua cheia
         // Laje de concreto tem um brilho fraco e largo; telha ceramica nao tem
         // nenhum. E o mesmo 'specularStrength' do vidro, com 1/6 da forca.
         gEspec = AP * (1.0 - incl) * 0.15;
         float fadeT = 1.0 - smoothstep(260.0, 780.0, length(vViewPosition));
         vec2  dirD  = incl > 0.02 ? normalize(nw.xz) : vec2(1.0, 0.0);   // desce a agua
         vec2  dirT  = vec2(-dirD.y, dirD.x);                             // corre a fiada
         float sD = dot(vMundo.xz, dirD), sT = dot(vMundo.xz, dirT);
         // 32 cm de fiada: a telha colonial deitada mede ~46 cm com ~14 de
         // sobreposicao. A junta escura e a sombra dessa sobreposicao, e e ela que
         // faz o telhado LER como telhado visto de cima.
         float fr    = fract(sD / 0.32);
         float junta = smoothstep(0.13, 0.0, fr) * 0.85 + smoothstep(0.88, 1.0, fr) * 0.35;
         // Capa e canal: a onda da telha ao longo da fiada, a cada 19 cm.
         float canal = 0.5 + 0.5 * cos(sT * 33.0);
         // So quem olha o telhado POR CIMA ve telha. Visto de baixo (o beiral, da
         // calcada) o que existe e forro e sombra -- desenhar fiada ali poria telha
         // na parte de baixo da agua. O cameraPosition e uniforme embutido do three,
         // e vMundo ja e posicao de mundo: o sinal do produto escalar resolve.
         float porCima = step(0.0, dot(nw, normalize(cameraPosition - vMundo)));
         float telha = (junta * 0.34 + (1.0 - canal) * 0.13) * incl * fadeT * porCima;
         diffuseColor.rgb *= 1.0 - (1.0 - porCima) * incl * 0.22;   // sombra do beiral por baixo
         // Laje nao tem telha: tem junta de concretagem, a cada 2,8 m, bem mais fraca.
         float jx = smoothstep(0.985, 1.0, fract(vMundo.x / 2.8))
                  + smoothstep(0.985, 1.0, fract(vMundo.z / 2.8));
         diffuseColor.rgb *= 1.0 - telha - min(0.10, jx * 0.09) * (1.0 - incl) * fadeT;
         // Encardido. Telhado de verdade nao tem cor uniforme: tem limo do lado que
         // nao pega sol e poeira no resto. Mesma mancha de baixa frequencia do asfalto.
         diffuseColor.rgb *= 0.93 + 0.14 * vnoise(vMundo.xz * 0.09);
       }`);
  };
  return m;
}

function riseLine(u) {
  const m = new THREE.LineBasicMaterial({ color:0xFFFFFF, transparent:true, opacity:0.22 });
  m.onBeforeCompile = sh => {
    sh.uniforms.uT = u;
    sh.uniforms.uRelief = uRelief;
    sh.uniforms.uHeight = uHeight;
    sh.uniforms.uFuro = uFuro;
    sh.vertexShader = "attribute float aDist;\nattribute float aDY;\nuniform float uT;\nuniform float uRelief;\nuniform float uHeight;\nvarying vec3 vMundo;\n" + sh.vertexShader.replace(
      "#include <begin_vertex>",
      "#include <begin_vertex>\nfloat g=clamp((uT-aDist*0.5)/0.5,0.0,1.0);transformed.y*=g*g*(3.0-2.0*g)*uHeight;transformed.y+=aDY*uRelief;\nvMundo=transformed;");
    sh.fragmentShader = "varying vec3 vMundo;\nuniform vec4 uFuro;\n" + sh.fragmentShader.replace(
      "#include <clipping_planes_fragment>",
      "#include <clipping_planes_fragment>\nif (uFuro.z > 0.0 && vMundo.y > uFuro.w && distance(vMundo.xz, uFuro.xy) < uFuro.z) discard;");
  };
  return m;
}
const flat = c => new THREE.MeshPhongMaterial({ color:c, shininess:0, specular:0x000000, polygonOffset:true, polygonOffsetFactor:-1, polygonOffsetUnits:-1 });
// v6: chao que acompanha o relevo (quadras). Ver pipeline/chao.py.
// v7: o relevo tem que estar carregado ANTES de chao/rua/muro/predio se registrarem.
// registerTerrain CONGELA o dy de cada vertice na hora do registro, e terrainY()
// devolve 0 enquanto elevGrid for null - e o elevGrid so era carregado no clique do
// botao Relevo. Consequencia: chao, rua e muro ficavam com dy=0 pra sempre; ao ligar
// o Relevo so os predios subiam/desciam, e onde o terreno e NEGATIVO a casa afundava
// no chao plano. Aqui a grade embutida e lida logo no boot.
(function preloadElev(){
  if (elevGrid) return;
  const t = document.getElementById("__elevdata");
  if (!t) return;
  try {
    const a = JSON.parse(t.textContent);
    if (Array.isArray(a) && a.length === ELEV_N*ELEV_N) elevGrid = Float32Array.from(a);
  } catch (e) { console.error("Grade de relevo embutida invalida:", e); }
})();
/* ---- triangulo grande nao acompanha o relevo -------------------------
   `applyTerrainToGeo` levanta os VERTICES; entre eles a face interpola LINEAR
   enquanto o terreno CURVA. Num triangulo de 200 m o miolo passa por baixo do
   chao -- e e exatamente o que se ve com o Relevo ligado: preenchimento de
   cruzamento afundado e borda serrilhada ao longo da avenida.

   Nao e defeito novo. O comentario do muro ja dizia "o muro e quebrado a cada
   40 m pra acompanhar o relevo", e o da rua ja dizia "Segmento comprido ainda
   corta a curvatura do terreno". O que faltava era aplicar a MESMA regra as
   duas malhas de preenchimento, que sao as unicas feitas de triangulo solto e
   largo: o chao do quarteirao e o vao entre quadras.

   Biseccao pelo MAIOR LADO: divide o triangulo em dois pelo ponto medio da
   aresta mais longa, ate nenhuma passar de PASSO_RELEVO. Pelo maior lado (e nao
   pelo centro) porque dois triangulos que dividem uma aresta longa a escolhem os
   dois, entao o corte casa e nao abre fenda na emenda.

   O teto de profundidade existe pro caso patologico: sem ele um triangulo
   degenerado de 2 km entra em recursao ate estourar a pilha. */
const PASSO_RELEVO = 40;
function subdivideParaRelevo(a, passo) {
  passo = passo || PASSO_RELEVO;
  const p2 = passo * passo, fora = [];
  const corta = (x0, z0, x1, z1, x2, z2, prof) => {
    const d01 = (x1-x0)*(x1-x0) + (z1-z0)*(z1-z0);
    const d12 = (x2-x1)*(x2-x1) + (z2-z1)*(z2-z1);
    const d20 = (x0-x2)*(x0-x2) + (z0-z2)*(z0-z2);
    const m = Math.max(d01, d12, d20);
    if (m <= p2 || prof >= 6) { fora.push(x0,z0, x1,z1, x2,z2); return; }
    if (m === d01)      { const mx=(x0+x1)/2, mz=(z0+z1)/2;
                          corta(x0,z0, mx,mz, x2,z2, prof+1);
                          corta(mx,mz, x1,z1, x2,z2, prof+1); }
    else if (m === d12) { const mx=(x1+x2)/2, mz=(z1+z2)/2;
                          corta(x0,z0, x1,z1, mx,mz, prof+1);
                          corta(x0,z0, mx,mz, x2,z2, prof+1); }
    else                { const mx=(x2+x0)/2, mz=(z2+z0)/2;
                          corta(x0,z0, x1,z1, mx,mz, prof+1);
                          corta(mx,mz, x1,z1, x2,z2, prof+1); }
  };
  for (let i = 0; i + 5 < a.length; i += 6)
    corta(a[i],a[i+1], a[i+2],a[i+3], a[i+4],a[i+5], 0);
  return fora;
}
(function buildGround(){
  const el = document.getElementById("__grounddata");
  if (!el) return;
  let a; try { a = JSON.parse(el.textContent); } catch(e){ return; }
  a = subdivideParaRelevo(a);
  const n = a.length/2, pos = new Float32Array(n*3);
  for (let i=0;i<n;i++){ pos[i*3]=a[i*2]; pos[i*3+1]=0; pos[i*3+2]=a[i*2+1]; }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos,3));
  // v8: sem normal. O material e MeshBasic, que nao ilumina -- a normal
  // nunca chegava a ser lida, e sao 12 B x 52 mil vertices.
  //
  // v11: o chao do quarteirao deixou de ser da cor do vazio. Era assim de proposito
  // (quadra sem chao nao aparecia), mas o efeito colateral era o terreno VAZIO ficar
  // do tom do nada -- e a rua brasileira nao tem buraco entre um lote e outro: ou tem
  // casa, ou tem mato. Agora a cor vem do NDVI do Sentinel-2, que ja esta na pagina:
  // quarteirao com quintal e lote vago sai verde, quarteirao todo construido sai
  // terra. Custa 3 B por vertice de memoria de video e ZERO byte de pagina.
  const cg = new Uint8Array(n*3);
  for (let i=0;i<n;i++){
    const t = Math.max(0, Math.min(1, (ndviBruto(pos[i*3], pos[i*3+2]) - 0.14) / 0.42));
    cg[i*3]   = 34 + (48-34)*(1-t);
    cg[i*3+1] = 40 + (74-40)*t;
    cg[i*3+2] = 34 + (36-34)*(1-t);
  }
  g.setAttribute("color", new THREE.BufferAttribute(cg, 3, true));
  g.userData.ground = true;
  g.userData.chaoDetalhe = true;   // o terreno de fundo precisa passar por BAIXO desta
  registerTerrain(g);
  // DoubleSide: a triangulacao das quadras tem winding arbitrario; sem isso metade
  // dos triangulos fica de costas e o chao some visto de cima.
  // MeshBasic (nao-iluminado) na cor do vazio: 0x192029 e o linear que, apos o
  // outputEncoding sRGB, vira o clearColor 0x59636F -- chao fica do mesmo tom do fundo.
  /* O MIOLO DA QUADRA ERA A MAIOR AREA CHAPADA DA TELA. Medido num quadro de
     bairro: 27,8% dos pixels com desvio local abaixo de 1,0 -- e a maior parte
     disso e este chao, nao parede. A cor vem do NDVI e varia por VERTICE, ou
     seja na escala do quarteirao; dentro do lote nao varia nada.

     Duas coisas entram, e em escalas diferentes de proposito:

       - a TEXTURA (Ground037, desvio 19,1) a ~8 m por repeticao: da o miudo de
         perto e ainda sobrevive de longe, porque 8 m nao vira sub-pixel tao
         cedo. A 2 m viraria -- foi o que aconteceu com o reboco na fachada,
         que some por completo (|delta| medio 0,07 no quadro inteiro);
       - a MANCHA procedural a ~35 m, que custa ZERO byte e e a unica coisa que
         continua legivel de 200 m de altura, onde qualquer textura ja morreu.

     Entra como RAZAO, nao como cor: a cor e do NDVI (verde onde ha quintal,
     terra onde e construido) e trocar por uma foto apagaria essa leitura. */
  const matChao = new THREE.MeshBasicMaterial({ vertexColors:true,
    side:THREE.DoubleSide, fog:true });
  matChao.onBeforeCompile = sh => {
    sh.uniforms.uTexChao = { value: TEX_CIDADE.chao };
    sh.vertexShader = "varying vec2 vXZ;\n" + sh.vertexShader.replace(
      "#include <begin_vertex>", "#include <begin_vertex>\nvXZ = transformed.xz;");
    sh.fragmentShader = "varying vec2 vXZ;\nuniform sampler2D uTexChao;\n" + GLSL_RUIDO +
      sh.fragmentShader.replace("#include <color_fragment>",
      `#include <color_fragment>
       float gc = dot(texture2D(uTexChao, vXZ * 0.125).rgb, vec3(0.299,0.587,0.114)) / 0.557;
       float mc = vnoise(vXZ * 0.028) * 0.65 + vnoise(vXZ * 0.11) * 0.35;
       diffuseColor.rgb *= mix(1.0, gc, 0.55) * (1.0 + (mc - 0.5) * 0.30);`);
  };
  // Sem a chave o three reaproveita o programa do MeshBasic cru e o patch nao entra.
  matChao.customProgramCacheKey = () => "chaoquadra";
  const m = new THREE.Mesh(g, matChao);
  m.userData.ground = true; m.position.y = -0.06; m.receiveShadow = SOMBRA_CIDADE; m.renderOrder = -2;
  scene.add(m);
})();
// v6: a RUA como uma unica entidade -- malha continua preenchendo os corredores
// entre as quadras (nao as tirinhas de centro). As casas encostam a face dianteira
// nela. Presa ao relevo, cor K.asfaltoPlano -- o preenchimento do cruzamento nao pode
// ficar mais claro que a fita da pista, e esta malha e MeshBasic, sem luz, entao o mesmo
// hex renderiza mais claro que o da fita; por isso sao duas entradas na paleta.
// renderOrder -1: acima do chao (-2), abaixo dos predios/ribbons.
// v7: MURO DE DIVISA em todo lote. Sem ele os quintais de fundo dos vizinhos
// viram um vazio continuo e some a nocao de terreno - era por isso que a casa
// ocupava 90% do lote. Chegam SEGMENTOS (dx0,dz0,vx,vz em decimetros,
// delta-encodados); a parede e levantada aqui: 5.500 km em triangulo pronto
// seriam ~14 MB de pagina, em segmento sao 3,9 MB.
/* O que se ve num quarteirao: tijolo a vista, tijolo sem reboco, reboco pintado,
   bege, concreto cru e um pintado escuro. Valores ~20% abaixo da cor de catalogo pelo
   mesmo motivo do telhado -- a saida sRGB mais o ACES levantam bastante. */
const MURO_COR = [[122,78,58], [96,62,47], [186,180,168], [172,158,132],
                  [150,146,138], [108,112,104], [200,196,186], [86,84,78]];
const BLOCO_MURO = `#include <color_fragment>
    {
      // Direcao ao longo do muro, pela derivada da posicao de mundo (ver a nota do
      // material). O 1e-6 evita o normalize de um vetor nulo no pixel degenerado da
      // borda, que sai como NaN e pinta o muro de preto.
      vec3 fn = normalize(cross(dFdx(vMw), dFdy(vMw)) + vec3(1e-8));
      vec2 dir = normalize(vec2(-fn.z, fn.x) + vec2(1e-6));
      float u = dot(vMw.xz, dir);
      // Detalhe de muro e coisa de perto: a 400 m ele so acrescenta ruido, e muro e
      // a malha mais comprida da cena.
      float fadeM = 1.0 - smoothstep(120.0, 420.0, length(vViewPosition));
      // Pilarete a cada 3,2 m -- o vao de bloco de concreto comum. O que se ve nao e
      // o pilar, e a JUNTA de sombra dos dois lados dele.
      float d = abs(fract(u / 3.2) - 0.5);
      float pil = 1.0 - smoothstep(0.045, 0.075, d);
      float junta = (1.0 - smoothstep(0.075, 0.105, d)) * step(0.06, d);
      diffuseColor.rgb *= 1.0 + pil * 0.055 * fadeM;
      diffuseColor.rgb *= 1.0 - junta * 0.11 * fadeM;
      // Fiada: 11 fiadas em 2,2 m de muro, que e o bloco de 19 cm com junta.
      diffuseColor.rgb *= 1.0 - smoothstep(0.10, 0.0, fract(vMv * 11.0)) * 0.07 * fadeM;
      // Capa por cima: quase todo muro termina em concreto, mais claro e mais
      // dessaturado que a pintura -- e e a capa que desenha a linha do muro contra o
      // fundo, do mesmo jeito que a platibanda desenha o predio contra o ceu.
      vec3 cinza = vec3(dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722)));
      diffuseColor.rgb = mix(diffuseColor.rgb, mix(cinza, vec3(1.0), 0.24),
                             smoothstep(0.90, 0.97, vMv) * 0.7);
      // Encardido da base: terra, limo e respingo de chuva. Vai ate 30 cm do chao.
      diffuseColor.rgb *= 1.0 - (1.0 - smoothstep(0.0, 0.14, vMv)) * 0.20 * fadeM;
      diffuseColor.rgb *= 0.95 + 0.10 * vnoise(vMw.xz * 0.33);
    }`;

(function buildMuros(){
  const el = document.getElementById("__murosdata");
  if (!el) return;
  let a; try { a = JSON.parse(el.textContent); } catch(e){ return; }
  const n = a.length/4, H = 2.2;
  // O muro segue o relevo pelas DUAS PONTAS, nao por uma cota so no meio.
  //
  // Com uma amostra no centro o quad nasce HORIZONTAL: numa encosta as duas pontas
  // ficam fora do chao (uma enterrada, outra no ar). Medido nos 175 mil segmentos
  // desta base: 31% erravam mais de 1,1 m na ponta -- metade da altura do muro --,
  // p99 6,8 m, maximo 76 m. E o relevo aqui e exagerado 4,5x (TERRAIN_EXAG), o que
  // multiplica o erro por 4,5. Amostrando as pontas, a base vira uma reta colada no
  // chao e o p99 cai pra 0,64 m.
  //
  // Segmento comprido ainda corta a curvatura do terreno -- o fundo de uma fileira
  // inteira e UMA reta de ate 383 m depois da fusao de colineares do gen_muros --,
  // entao ele e quebrado a cada PASSO metros. A 40 m: +8% de quads (175k -> 188k),
  // erro acima de 1,1 m em 0,29% dos segmentos. E quebra AQUI, na montagem: o
  // arquivo continua com os mesmos 175 mil segmentos delta-encodados.
  //
  // Continua UMA amostra de terrainY por ponta de pedaco (~370k) e nao uma por
  // vertice (3,27M): esta ultima trava o carregamento e o streamPump nao monta os
  // predios.
  const PASSO = 40;
  let px=0, pz=0, quads=0;
  const npedaco = new Int32Array(n);
  for (let i=0;i<n;i++){
    const x0 = px + a[i*4], z0 = pz + a[i*4+1];
    const x1 = x0 + a[i*4+2], z1 = z0 + a[i*4+3];
    px = x0; pz = z0;
    const L = Math.hypot((x1-x0)/10, (z1-z0)/10);
    const k = Math.max(1, Math.ceil(L/PASSO));
    npedaco[i] = k; quads += k;
  }
  const pos = new Float32Array(quads*18), dy = new Float32Array(quads*6);
  // Altura dentro do muro: 0 na base, 1 no topo. Um byte por vertice (1,1 MB na
  // cidade inteira). Nao da pra tirar isso da posicao no shader: o relevo ja foi
  // somado no Y na CPU (applyTerrainToGeo), entao a base de cada pedaco esta numa
  // cota diferente e nao existe "y do muro" pra ler. Ja a direcao ao longo do muro
  // sai de graca da derivada da posicao, e por isso NAO vira atributo.
  const mv = new Uint8Array(quads*6);
  // v10: o muro deixou de ter uma cor so. Na rua ele vai de tijolo a vista a pintado
  // claro, e uma fileira inteira do mesmo cinza era o que mais denunciava geracao
  // automatica. A cor e por SEGMENTO (nao por quad), senao um muro comprido fica
  // xadrez -- e o segmento aqui ja e a divisa inteira, depois da fusao de colineares.
  // Byte normalizado: 3 B por vertice em vez de 12.
  const col = new Uint8Array(quads*18);
  let o=0, q=0; px=0; pz=0;
  for (let i=0;i<n;i++){
    const x0 = px + a[i*4], z0 = pz + a[i*4+1];
    const x1 = x0 + a[i*4+2], z1 = z0 + a[i*4+3];
    px = x0; pz = z0;
    const k = npedaco[i];
    let ax = x0/10, az = z0/10, da = terrainY(ax, az);
    for (let s=1;s<=k;s++){
      const t = s/k;
      const bx = (x0 + (x1-x0)*t)/10, bz = (z0 + (z1-z0)*t)/10;
      const db = terrainY(bx, bz);
      pos[o++]=ax; pos[o++]=0; pos[o++]=az;
      pos[o++]=bx; pos[o++]=0; pos[o++]=bz;
      pos[o++]=bx; pos[o++]=H; pos[o++]=bz;
      pos[o++]=ax; pos[o++]=0; pos[o++]=az;
      pos[o++]=bx; pos[o++]=H; pos[o++]=bz;
      pos[o++]=ax; pos[o++]=H; pos[o++]=az;
      dy[q++]=da; dy[q++]=db; dy[q++]=db; dy[q++]=da; dy[q++]=db; dy[q++]=da;
      mv[q-6]=0; mv[q-5]=0; mv[q-4]=255; mv[q-3]=0; mv[q-2]=255; mv[q-1]=255;
      const c = MURO_COR[(hash(i*2654435761 % 2147483647) * MURO_COR.length) | 0] || MURO_COR[0];
      for (let v=0; v<6; v++) { col[o-18+v*3] = c[0]; col[o-18+v*3+1] = c[1]; col[o-18+v*3+2] = c[2]; }
      ax = bx; az = bz; da = db;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos,3));
  g.setAttribute("aMv", new THREE.BufferAttribute(mv,1,true));
  // v8: sem normal. O muro e um quad vertical plano e a malha nao e
  // indexada -- computeVertexNormals devolvia a normal da FACE, que e
  // exatamente o que flatShading calcula no fragmento. Mesma imagem,
  // menos 12 B x 1,1 M vertices e menos um passo no carregamento.
  g.userData.ground = true;
  g.userData.presetDY = dy;
  registerTerrain(g);
  g.setAttribute("color", new THREE.BufferAttribute(col, 3, true));
  /* O muro tinha cor por segmento e mais nada: visto da rua, 5.500 km de fita lisa.
     Aqui ele ganha o que todo muro de rua tem -- pilarete no ritmo, capa por cima,
     fiada de bloco e o encardido da base. Tudo desenhado no fragmento, com UM byte
     por vertice de atributo novo e zero chamada de desenho a mais.

     A direcao ao longo do muro sai da DERIVADA da posicao de mundo: o quad e
     vertical e plano, entao o produto vetorial das duas derivadas de tela e a normal
     da face, e o horizontal perpendicular a ela corre ao longo do muro. Isso da uma
     coordenada continua em metros que atravessa a emenda entre dois pedacos do mesmo
     segmento (o muro e quebrado a cada 40 m pra acompanhar o relevo) -- um contador
     por quad faria o pilarete pular na emenda. */
  const mat = new THREE.MeshPhongMaterial({
      vertexColors:true, side:THREE.DoubleSide, shininess:0, specular:0x000000,
      flatShading:true });
  mat.onBeforeCompile = sh => {
    sh.vertexShader = "attribute float aMv;\nvarying float vMv;\nvarying vec3 vMw;\n" +
      sh.vertexShader.replace("#include <begin_vertex>",
        "#include <begin_vertex>\nvMv=aMv;\nvMw=transformed;");
    sh.fragmentShader = "varying float vMv;\nvarying vec3 vMw;\n" + GLSL_RUIDO +
      sh.fragmentShader.replace("#include <color_fragment>", BLOCO_MURO);
  };
  // Sem isto o three usaria o texto da funcao como chave e recompilaria: ver a nota
  // do _compilaVia. Aqui e um material so pra cidade inteira, mas a chave e barata.
  mat.customProgramCacheKey = () => "muro";
  const m = new THREE.Mesh(g, mat);
  m.userData.ground = true; m.userData.muros = true;
  m.receiveShadow = SOMBRA_CIDADE; m.castShadow = false;
  scene.add(m);
  window.__gMuros = m;
})();
(function buildStreets(){
  const el = document.getElementById("__streetdata");
  if (!el) return;
  let a; try { a = JSON.parse(el.textContent); } catch(e){ return; }
  a = subdivideParaRelevo(a);
  const n = a.length/2, pos = new Float32Array(n*3);
  for (let i=0;i<n;i++){ pos[i*3]=a[i*2]; pos[i*3+1]=0; pos[i*3+2]=a[i*2+1]; }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos,3));
  // v8: sem normal, mesmo motivo do chao (MeshBasic nao ilumina).
  g.userData.ground = true;
  g.userData.chaoDetalhe = true;   // idem
  registerTerrain(g);
  // Esta e a malha de preenchimento -- (vao + corredores) - quadras -- e nao tem
  // direcao de rua nenhuma: e triangulo solto de cruzamento e area larga. Entao aqui
  // o grao e em espaco de MUNDO, sem junta e sem rodado. Fosse desenhar junta de
  // calcada nela, sairia alinhada com o norte em cima de esquina torta.
  const mat = new THREE.MeshBasicMaterial({ color:K.asfaltoPlano, side:THREE.DoubleSide, fog:true });
  mat.onBeforeCompile = sh => {
    sh.vertexShader = "varying vec3 vAsf;\n" +
      sh.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\nvAsf=transformed;");
    sh.fragmentShader = "varying vec3 vAsf;\n" + GLSL_RUIDO +
      sh.fragmentShader.replace("#include <color_fragment>", `#include <color_fragment>
      diffuseColor.rgb *= 1.0 + (h21(floor(vAsf.xz * 3.7)) - 0.5) * 0.22;
      diffuseColor.rgb *= 0.84 + 0.32 * vnoise(vAsf.xz * 0.085);`);
  };
  mat.customProgramCacheKey = () => "asfalto";
  const m = new THREE.Mesh(g, mat);
  m.userData.ground = true; m.position.y = -0.05; m.receiveShadow = SOMBRA_CIDADE; m.renderOrder = -1;
  scene.add(m);
})();
/* ------------------------------------------------------------
   TERRENO DE FUNDO (v12)
   ------------------------------------------------------------
   O chao do quarteirao e a malha de rua so existem onde ha QUADRA, e a quadra vem da
   face do grafo de ruas: varzea, chacara, aeroporto e area militar nao tem rua dentro,
   entao nao viram face, entao nao ganham chao. O resultado era um BURACO -- nao um
   terreno vazio, o nada mesmo. Medido num apartamento de Ribeirao a 155 m de cota: com
   o chao e a rua pintados de vermelho e verde e o clearColor em ciano, metade do quadro
   pela janela era ciano puro. E como as duas malhas sao superficies de espessura zero
   em DoubleSide, pelo buraco se via a BARRIGA do pedaco de cidade que o relevo (4,5x)
   tinha levantado do outro lado do vale -- a "parte de baixo" da cidade.

   Aqui entra uma superficie continua por baixo de tudo, tirada da MESMA grade de
   elevacao que ja esta na pagina. Ela nao acrescenta dado nenhum: e a grade de 80x80
   da cidade subdividida, e por isso custa zero byte de pagina.

   Tres numeros, todos medidos e nao chutados:

   - SUB = 4. A grade tem celula de 240 m; dois triangulos por celula nao reproduzem a
     bilinear que o `terrainY` devolve -- o erro e o termo de torcao (a+d-b-c)/4, que
     em Ribeirao chega a 41,6 m depois do exagero. Subdividir divide o erro por SUB^2:
     4 leva a 2,6 m, e e o ponto em que 200 mil triangulos ainda sao UMA chamada de
     desenho (que e a moeda cara aqui, nao o triangulo).
   - A FOLGA e MEDIDA, nao constante. Tem que ser maior que aquele erro, senao o fundo
     espeta por cima do chao detalhado no meio de um quarteirao -- e o erro muda de
     cidade pra cidade: medido nas cinco, a torcao vai de 23,6 m (Rio Preto) a 93,4 m
     (Sorocaba), ou seja, de 1,5 m a 5,8 m depois do SUB. Um 3 fixo, calibrado em
     Ribeirao, deixaria remendo verde no meio de Sorocaba. Sai da propria grade em
     ~6 mil contas no boot. Na borda de um buraco a folga vira um degrau, que a
     200 m de distancia e um fio.
   - LIM = 16 km. A grade so vai a 9,5 km do centro, e a cidade vai a 13. O anel de fora
     e esticado ate 16 km em vez de ganhar vertice novo: alem da grade o `terrainY`
     grampeia no valor da borda, entao esticar nao inventa relevo nenhum.

   E um QUARTO numero, este por vertice, que a primeira versao nao tinha e o conferidor
   pegou: O CHAO DETALHADO TAMBEM AFUNDA. Ele amostra o `terrainY` nos VERTICES do
   poligono da quadra, e um poligono grande vira um triangulo de centenas de metros que
   corta a encosta em linha reta -- em Ribeirao o pior afunda 18,7 m abaixo do terreno
   real. Uma folga uniforme que cobrisse isso seria um degrau de 20 m em toda borda de
   buraco. Entao a folga uniforme cobre so a torcao da grade, e por cima dela cada NO do
   fundo desce mais o tanto que o triangulo de detalhe que passa por ele afundou. O
   fundo fica colado no detalhe em toda parte e mergulha so debaixo da quadra que
   afundou -- onde ninguem ve, porque ela esta em cima.

   Material MeshBasic com a MESMA formula de cor do chao de quarteirao (NDVI do
   Sentinel-2 que ja esta na pagina). Se fosse iluminado, a encosta ao sol sairia mais
   clara que o chao de quarteirao vizinho, que e chapado -- e a emenda apareceria.

   O preco, medido em Ribeirao: 160 ms no boot (de ~1,1 s do app inteiro), 199.712
   triangulos numa UNICA chamada de desenho, ~1,5 MB de memoria de video e zero byte de
   pagina. O conferidor e `pipeline/testa_terreno_base.py`.
   ------------------------------------------------------------ */
const TERRENO_SUB = 4, TERRENO_LIM = 16000;
(function buildTerrenoBase(){
  if (!elevGrid) return;
  // Maior termo de torcao da grade -- e o quanto dois triangulos por celula erram
  // contra a bilinear do terrainY. Subdividir por SUB divide o erro por SUB^2.
  let torc = 0;
  for (let j=0;j<ELEV_N-1;j++) for (let i=0;i<ELEV_N-1;i++){
    const t = Math.abs(elevGrid[j*ELEV_N+i] + elevGrid[(j+1)*ELEV_N+i+1]
                     - elevGrid[j*ELEV_N+i+1] - elevGrid[(j+1)*ELEV_N+i]) / 4 * TERRAIN_EXAG;
    if (t > torc) torc = t;
  }
  const folga = Math.max(1.5, torc / (TERRENO_SUB*TERRENO_SUB) * 1.15 + 0.4);
  const N = (ELEV_N - 1) * TERRENO_SUB + 1, passo = 2*ELEV_HALF/(N-1);
  const co = i => i === 0 ? -TERRENO_LIM : i === N-1 ? TERRENO_LIM : -ELEV_HALF + i*passo;

  /* Quanto CADA no precisa descer alem da folga, por causa do triangulo de detalhe que
     passa por ele. Percorre os triangulos do chao de quarteirao e da malha de rua (os
     dois marcados com `chaoDetalhe`) e, para cada NO do fundo que cai dentro do
     triangulo, mede a distancia entre o plano do triangulo e o terreno real naquele
     ponto exato -- nao uma estimativa. Como o no e o mesmo ponto onde o vertice do
     fundo vai nascer, a garantia e exata, e nao "com folga pra mais".

     Custa o bastante para valer a pena dizer por que e barato: sao ~90 mil triangulos,
     mas o laco de dentro so visita NO, e a cidade inteira tem ~100 mil nos. Triangulo
     de rua normal nao cobre no nenhum e sai na caixa envolvente; quem custa e a meia
     duzia de poligonos gigantes, que sao justamente os que afundam. */
  const desce = new Float32Array(N*N);
  const noMin = c => Math.max(1, Math.ceil((c + ELEV_HALF)/passo));
  const noMax = c => Math.min(N-2, Math.floor((c + ELEV_HALF)/passo));
  for (const geo of terrainRegistry) {
    if (!geo.userData.chaoDetalhe) continue;
    const p = geo.attributes.position, dyv = geo.userData.terrain.dy;
    for (let t = 0; t + 2 < p.count; t += 3) {
      const ax=p.getX(t),   az=p.getZ(t),   ay=dyv[t];
      const bx=p.getX(t+1), bz=p.getZ(t+1), by=dyv[t+1];
      const cx=p.getX(t+2), cz=p.getZ(t+2), cy=dyv[t+2];
      const i0 = noMin(Math.min(ax,bx,cx) - passo), i1 = noMax(Math.max(ax,bx,cx) + passo);
      if (i0 > i1) continue;
      const j0 = noMin(Math.min(az,bz,cz) - passo), j1 = noMax(Math.max(az,bz,cz) + passo);
      if (j0 > j1) continue;
      const det = (bz-cz)*(ax-cx) + (cx-bx)*(az-cz);
      if (!det) continue;
      /* O triangulo vale UMA CELULA a mais para cada lado, e essa margem e o que faz a
         conta fechar na borda. Dentro do triangulo o fundo fica exatamente `folga`
         abaixo (as duas superficies sao lineares entre nos de dentro); mas a celula que
         atravessa a divisa tem um no dentro, rebaixado, e um fora, no zero, e a
         interpolacao entre eles sobe de volta por cima do detalhe. Sem esta margem
         sobravam 4 pontos espetando em Ribeirao, o pior por 15,7 m.

         A margem sai em coordenada baricentrica, nao em "um pouquinho": `wa` vai de 1
         no vertice a a 0 na aresta oposta, ao longo da altura |det|/|bc|, entao andar
         `passo` metros para fora daquela aresta e wa = -passo*|bc|/|det|. Assim a folga
         e um passo de verdade em qualquer triangulo, do esquio ao gigante. */
      const adet = Math.abs(det);
      const mgA = passo * Math.hypot(bx-cx, bz-cz) / adet;
      const mgB = passo * Math.hypot(cx-ax, cz-az) / adet;
      const mgC = passo * Math.hypot(ax-bx, az-bz) / adet;
      for (let j=j0;j<=j1;j++) for (let i=i0;i<=i1;i++){
        const x = -ELEV_HALF + i*passo, z = -ELEV_HALF + j*passo;
        const wa = ((bz-cz)*(x-cx) + (cx-bx)*(z-cz)) / det;
        if (wa < -mgA) continue;
        const wb = ((cz-az)*(x-cx) + (ax-cx)*(z-cz)) / det;
        if (wb < -mgB) continue;
        const wc = 1 - wa - wb;
        if (wc < -mgC) continue;
        /* No de DENTRO: wa/wb/wc ja estao em 0..1 e somam 1, e a conta e a exata. No
           da margem: grampeia e renormaliza, o que amostra o plano no ponto do
           triangulo mais proximo em vez de EXTRAPOLAR o plano para fora dele.
           Extrapolar foi a primeira versao e produziu mergulho de 4.389 m: num
           triangulo esquio a margem de um passo vale uma barbaridade em coordenada
           baricentrica, e o plano continuado por ela desce fora de escala. O poco de
           4 km ficava numa celula so, invisivel para o conferidor (que so pergunta se
           o fundo esta ABAIXO do detalhe) e bem visivel na tela ao lado de um buraco. */
        let ca = wa < 0 ? 0 : wa > 1 ? 1 : wa;
        let cb = wb < 0 ? 0 : wb > 1 ? 1 : wb;
        let cc = wc < 0 ? 0 : wc > 1 ? 1 : wc;
        const sw = ca + cb + cc;
        // afundou = o terreno real esta ACIMA do plano do triangulo neste ponto
        const d = terrainY(x, z) - (ay*ca + by*cb + cy*cc) / sw;
        const k = j*N+i;
        if (d > desce[k]) desce[k] = d;
      }
      /* E quatro amostras DENTRO do triangulo, marcadas nos nos da celula que as contem.
         O laco de cima so olha onde cai um no, e triangulo menor que a celula de 60 m
         pode nao conter nenhum -- foi assim que sobrou um ponto espetando 1,4 m em
         Araraquara, num triangulo de rua afundado 7,3 m entre dois nos de sobra zero.
         Sao ~360 mil amostras de terrainY na cidade inteira, a mesma ordem do muro, que
         ja e paga no boot. */
      for (let a2 = 0; a2 < 4; a2++) {
        const wa = a2 === 0 ? 1/3 : a2 === 1 ? 0.5 : a2 === 2 ? 0.5 : 0;
        const wb = a2 === 0 ? 1/3 : a2 === 1 ? 0.5 : a2 === 2 ? 0   : 0.5;
        const wc = 1 - wa - wb;
        const x = ax*wa + bx*wb + cx*wc, z = az*wa + bz*wb + cz*wc;
        const d = terrainY(x, z) - (ay*wa + by*wb + cy*wc);
        if (d <= 0) continue;
        const fi = (x + ELEV_HALF)/passo, fj = (z + ELEV_HALF)/passo;
        for (let dj=0; dj<2; dj++) for (let di=0; di<2; di++){
          const ii = Math.min(N-2, Math.max(1, Math.floor(fi) + di));
          const jj = Math.min(N-2, Math.max(1, Math.floor(fj) + dj));
          const k = jj*N+ii;
          if (d > desce[k]) desce[k] = d;
        }
      }
    }
  }

  /* Um passe de dilatacao por cima da margem. Sozinha a margem deixava 1 ponto espetando
     em Araraquara por 2,9 m: amostrar o plano no ponto do triangulo mais proximo e mais
     conservador que extrapola-lo, entao na celula de divisa a interpolacao ainda sobe um
     pouco. Espalhar o mergulho mais um no fecha isso, e espalha so 60 m -- a extrapolacao,
     que era a alternativa, espalhava 4 km de poco. */
  {
    const ant = desce.slice();
    for (let j=0;j<N;j++) for (let i=0;i<N;i++){
      let mx2 = ant[j*N+i];
      for (let dj=-1; dj<=1; dj++) for (let di=-1; di<=1; di++){
        const jj=j+dj, ii=i+di;
        if (jj<0||jj>=N||ii<0||ii>=N) continue;
        const v2 = ant[jj*N+ii]; if (v2 > mx2) mx2 = v2;
      }
      desce[j*N+i] = mx2;
    }
  }

  const pos = new Float32Array(N*N*3), col = new Uint8Array(N*N*3);
  for (let j=0;j<N;j++) for (let i=0;i<N;i++){
    const v=j*N+i, k=v*3, x=co(i), z=co(j);
    // O rebaixo entra no Y da GEOMETRIA (nao na posicao da malha) porque ele e por
    // vertice: o registerTerrain congela este valor como baseY e soma o relevo por
    // cima, entao o fundo continua acompanhando o botao Relevo.
    pos[k]=x; pos[k+1]=-(folga + desce[v]); pos[k+2]=z;
    const t = Math.max(0, Math.min(1, (ndviBruto(x, z) - 0.14) / 0.42));
    col[k]   = 34 + (48-34)*(1-t);
    col[k+1] = 40 + (74-40)*t;
    col[k+2] = 34 + (36-34)*(1-t);
  }
  // Uint32 porque sao ~100 mil vertices; Uint16 daria a volta em 65.535 e a malha
  // sairia embaralhada em vez de dar erro.
  const idx = new Uint32Array((N-1)*(N-1)*6);
  let o = 0;
  for (let j=0;j<N-1;j++) for (let i=0;i<N-1;i++){
    const a=j*N+i, b=a+1, c=a+N, d=c+1;
    idx[o++]=a; idx[o++]=c; idx[o++]=b;
    idx[o++]=b; idx[o++]=c; idx[o++]=d;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos,3));
  g.setAttribute("color", new THREE.BufferAttribute(col,3,true));
  g.setIndex(new THREE.BufferAttribute(idx,1));
  g.userData.ground = true;
  registerTerrain(g);   // amarra na grade: o botao Relevo levanta o fundo junto
  const mat = new THREE.MeshBasicMaterial({ vertexColors:true, side:THREE.DoubleSide, fog:true });
  mat.onBeforeCompile = sh => {
    // Sem isto o fundo e um lencol de cor unica por centenas de metros. Duas oitavas de
    // ruido em espaco de mundo custam quatro senos por fragmento e nenhum byte.
    sh.vertexShader = "varying vec3 vTer;\n" +
      sh.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\nvTer=transformed;");
    sh.fragmentShader = "varying vec3 vTer;\n" + GLSL_RUIDO +
      sh.fragmentShader.replace("#include <color_fragment>", `#include <color_fragment>
      diffuseColor.rgb *= 0.80 + 0.40 * vnoise(vTer.xz * 0.0055);
      diffuseColor.rgb *= 0.92 + 0.16 * vnoise(vTer.xz * 0.034);`);
  };
  mat.customProgramCacheKey = () => "terrenobase";
  const m = new THREE.Mesh(g, mat);
  m.userData.ground = true;
  m.renderOrder = -4;          // debaixo do chao de quarteirao (-2) e da rua (-1)
  scene.add(m);
  window.__gTerreno = m;
  // sonda de QA: ver pipeline/testa_terreno_base.py
  let fundo = 0;
  for (let v=0; v<desce.length; v++) if (desce[v] > fundo) fundo = desce[v];
  m.userData.folga = folga;
  m.userData.desceMax = fundo;
})();
const meshOf = P => {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(P),3));
  g.computeVertexNormals(); g.computeBoundingSphere();
  registerTerrain(g);
  return g;
};
const inside = (r, x, z) => { let hit = false;
  for (let i = 0, j = r.length-1; i < r.length; j = i++) { const a = r[i], b = r[j];
    if ((a[1] > z) !== (b[1] > z) && x < (b[0]-a[0])*(z-a[1])/(b[1]-a[1]) + a[0]) hit = !hit; }
  return hit; };

// Earcut lida com polígonos côncavos/degenerados de forma muito mais tolerante que
// THREE.ShapeUtils.triangulateShape, que costuma falhar (e descartar o prédio inteiro
// em silêncio) em contornos comuns do OSM. Cai de volta pro triangulador do three.js
// só se a lib não carregou.
function triangulateRing(r) {
  if (typeof earcut === "function") {
    const flat = []; for (const p of r) { flat.push(p[0], p[1]); }
    const idx = earcut(flat);
    const tri = [];
    for (let i = 0; i < idx.length; i += 3) tri.push([idx[i], idx[i+1], idx[i+2]]);
    return tri;
  }
  return THREE.ShapeUtils.triangulateShape(r.map(p => new V2(p[0], p[1])), []);
}

const BUILDING_INSET = 1.0; // metros — encolhe o contorno do lote antes de extrudar,
                             // pra simular o recuo/calçada e o prédio não "comer" a rua
function insetRing(r, dist) {
  const n = r.length, out = new Array(n);
  for (let i = 0; i < n; i++) {
    const p0 = r[(i-1+n)%n], p1 = r[i], p2 = r[(i+1)%n];
    let e1x = p1[0]-p0[0], e1z = p1[1]-p0[1], e1L = Math.hypot(e1x,e1z);
    let e2x = p2[0]-p1[0], e2z = p2[1]-p1[1], e2L = Math.hypot(e2x,e2z);
    if (e1L < 1e-6 || e2L < 1e-6) { out[i] = p1; continue; }
    e1x/=e1L; e1z/=e1L; e2x/=e2L; e2z/=e2L;
    const n1x = -e1z, n1z = e1x, n2x = -e2z, n2z = e2x; // normais externas (mesma
                                                          // convenção CW usada nas paredes)
    let mx = n1x+n2x, mz = n1z+n2z; const mL = Math.hypot(mx,mz);
    if (mL < 1e-6) { out[i] = [p1[0]-n1x*dist, p1[1]-n1z*dist]; continue; }
    mx/=mL; mz/=mL;
    const cosHalf = Math.max(0.35, mx*n1x + mz*n1z); // trava o "bico" em cantos muito agudos
    const scale = dist/cosHalf;
    out[i] = [p1[0]-mx*scale, p1[1]-mz*scale];
  }
  return out;
}
function safeInset(r, dist) {
  const before = shoelace(r), areaBefore = Math.abs(before)/2;
  if (areaBefore < 10) return r; // pequeno demais pra encolher com segurança
  const ins = insetRing(r, dist);
  const after = shoelace(ins), areaAfter = Math.abs(after)/2;
  if (areaAfter < areaBefore*0.25 || (after > 0) !== (before > 0)) return r; // colapsou/inverteu, mantém original
  return ins;
}

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
// v7: o telhado também virou LEQUE. Com uma cor só, um bairro inteiro de casa
// térrea saía com a mesma mancha no teto — e é o teto que se vê deste mapa, que
// é olhado de cima. As faixas são as que aparecem nas fotos de rua de São
// Carlos: cerâmica nova, cerâmica encardida, cerâmica escura de telha velha,
// fibrocimento cinza e metálico marrom. `laje` é a cor da laje/platibanda de
// quem não tem telha aparente — concreto claro, nunca preto.
// A saída é sRGB (`renderer.outputEncoding`): a cor da tabela chega na tela
// bem mais clara do que o hex sugere — a telha 0xB2573A media (248,193,162) na
// água iluminada. Por isso os valores de telhado e de laje aqui estão ~20%
// abaixo da cor "de catálogo": é o que faz cerâmica parecer cerâmica e laje
// parecer concreto em vez de papel branco.
/* v11: a paleta de parede da CASA e do SOBRADO abriu.
   Eram 10 tons e TODOS quase brancos (creme, off-white, cinza clarissimo), e o
   resultado era uma rua inteira de caixa branca -- a variedade de telhado e de
   cobertura ja existia, mas nao se via porque a parede nao mudava. As fotos de rua de
   Sao Carlos e Ribeirao tem salmao, terracota, ocre, cinza-azulado e verde-agua junto
   dos claros. Os claros continuam maioria (a rua brasileira e clara mesmo), so deixaram
   de ser unanimidade. Valores ~20% abaixo da cor de catalogo pelo motivo de sempre:
   a saida sRGB mais o ACES levantam. */
const PAL = [
  { // CASA
    wall:[0xEFE7D8,0xE8ECE6,0xDCE4EC,0xF0E2CC,0xE6DED4,0xD9E3D8,0xF2E8CE,0xE3CBB4,0xE8D9A8,
          0xCF7F5C,0xB86A4E,0xC98F62,0xA8724F,0x9FA9A2,0x8E9AA6,0xBFB08C,0x7E8C82,0xD4A98A,
          0xC2C6C0,0xAA9E90],
    roof:0x8E452E, telha:1, laje:0x81807B,
    roofs:[0x8E452E,0x9D5637,0xA35E3C,0x8A4A34,0x7B412D,0x96543D,0x9B5E48,0x7D7B76,0x6B6964,0x6E4A3A] },
  { // SOBRADO
    wall:[0xEAE1D0,0xDFE6EA,0xEDE6DA,0xE2DACE,0xD7DFE6,0xEFDFC4,0xD8BCA6,
          0xC08A66,0xA6B0AA,0x98A4B0,0xB9A882,0x8F7F6E],
    roof:0x864029, telha:1, laje:0x7E7C77,
    roofs:[0x864029,0x924C32,0x9A563B,0x8A4B36,0x723725,0x76746F,0x633D32] },
  { wall:[0xDCDFE3,0xE4E1DA,0xD2D8DE,0xE7E4DD,0xCFD6D9],          roof:0x6E757D, telha:0, laje:0x75797C },  // PREDIO
  { wall:[0xE6E3DC,0xE9DED2,0xDDE3E7,0xEFEAE0,0xD8DCD6],          roof:0x6A7079, telha:0, laje:0x74777B },  // COMERCIO
  { wall:[0xB9C4CE,0xAFBCC7,0xC3CBD2,0xA8B6C2],                   roof:0x5C646E, telha:0, laje:0x6B7076 },  // TORRE
  { wall:[0xC9CFD4,0xD5D8D6,0xBFC7CD,0xDCDEDB],                   roof:0x6F757C, telha:2, laje:0x6B7073 },  // GALPAO
  { wall:[0xEDE9E0,0xE3E7EA,0xF0EADF,0xDFE4E2],                   roof:0x7A6F66, telha:0, laje:0x79756E },  // CIVICO
  { // ANEXO — garagem/edícula: laje ou meia-água de fibrocimento
    wall:[0xD8D5CE,0xCFD4D6,0xDEDAD2,0xE2D6C6],                   roof:0x6E6661, telha:0, laje:0x7B7974,
    roofs:[0x6E6661,0x787673,0x65615D,0x804530] }
];

/* `parede_grande`: o leque de parede das cinco tipologias GRANDES.

   O v11 abriu a paleta da CASA e do SOBRADO e parou ali. Prédio, comércio, torre,
   galpão e institucional continuaram com 4 ou 5 tons cada, todos entre 0xAF e 0xF0 --
   e a saída sRGB mais o ACES levantam justamente essa ponta da curva, então os cinco
   arquétipos chegavam na tela como a MESMA caixa branca. É o que se via de cima: casa
   variada embaixo, cidade grande unânime.

   Aqui não há cor inventada. Cada leque é a mesma leitura de foto de rua que a CASA já
   tinha, aplicada ao porte: claro ainda é a maioria (prédio brasileiro é claro mesmo),
   mas entra bege e areia (pastilha), cimento e cinza médio (concreto aparente), e uma
   ponta de terracota/ocre. Torre ganha o azul de pele de vidro e o granito escuro;
   galpão, a telha metálica; institucional, o creme de escola estadual.

   Os valores continuam ~20% abaixo da cor de catálogo, pelo motivo de sempre. E o leque
   é sorteado uniformemente (`s1`), então a PROPORÇÃO de cada família é literalmente
   quantas entradas ela tem na lista -- é assim que se dosa, não com peso. */
if (APAR.parede_grande) {
  PAL[ST.PREDIO].wall = [
    0xCBD0D3,0xD2CCC0,0xC2C8CB,0xD0C8B6,                              // claros
    0xC4AF8E,0xC8B392,0xBBA47E,0xAD9670,                              // bege / areia
    0xA3A8AA,0x9C978C,0x8B8880,0x7E8386,                              // cimento
    0xB4785A,0xA8825E,0xAC8A46,0x96694F];                             // terracota / ocre
  PAL[ST.COMERCIO].wall = [
    0xD0CCC2,0xC8CCCE,0xD4CCBA,
    0xC6B292,0xB4A07C,0xA6906C,
    0xA0A09A,0x8E8D88,0x7C7B76,
    0xB88264,0xA86A56,0xBC9450,0x92A099,0x7C8E98];
  PAL[ST.TORRE].wall = [
    0xAEBCC6,0xA3B4C2,0x8FA4B6,0x7B93A8,                              // pele de vidro
    0xC8CCCF,0xBEC2C4,                                                // claros
    0x6E7176,0x5C6065,0x4E5257,                                       // granito escuro
    0xB0A183,0x9C8C6E,0x86765C];                                      // pastilha bege
  PAL[ST.GALPAO].wall = [
    0xBAC0C4,0xC4C7C2,0xACB3B8,                                       // telha metalica
    0x999FA2,0x868C8F,0x74797C,
    0xB4A88E,0xA0947C,
    0x88A0B0,0x789080];
  PAL[ST.CIVICO].wall = [
    0xD4D0C4,0xC8CED0,0xD8D0BE,
    0xD4C084,0xC0A860,                                                // creme de escola
    0xC0AE90,0xAC9C80,
    0xA09D95,0x8A8880,
    0xA67E60];
}

/* Platibanda por arquétipo. É o detalhe mais barato e mais brasileiro que
   existe: a parede sobe além da laje e esconde a cobertura. Sem ela, prédio de
   laje vira caixa cortada a faca — que é o visual de hoje. */
const PLATIBANDA = [0.45, 0.55, 1.15, 0.95, 1.45, 0.35, 1.20, 0.30];
// Caixa de agua: azul de polietileno (o comum na rua), concreto, azul escuro, fibra.
const CAIXA_COR = [0x4A7FB5, 0x8F9295, 0x2B5F8A, 0xD4D4D4];

/* --- arquétipo de COBERTURA ---------------------------------------------
   v7. Até aqui só existiam duas coberturas: "duas/quatro águas sobre o eixo
   maior" e "laje". Numa rua inteira de casa térrea isso dá o mesmo teto em
   todo lote, e é o teto que se vê num mapa olhado de cima.

   As formas abaixo são as que aparecem na rua em São Carlos:

     HIP    quatro águas, cumeeira curta                  telha cerâmica
     GABLE  duas águas com a cumeeira no eixo COMPRIDO    telha cerâmica
     CROSS  duas águas com a cumeeira ATRAVESSADA — a empena olha pra rua
     SHED   meia-água, um plano só                        cerâmica ou fibrocimento
     LAJE   laje escondida atrás de platibanda            casa "de laje"

   CROSS só entra em casa pouco alongada: numa casa 3x mais funda que larga a
   cumeeira atravessada exigiria uma água de 8 m de altura. `elong` decide.

   O sorteio é o mesmo `s2` determinístico do prédio — o mesmo lote tira sempre
   a mesma cobertura, em qualquer sessão. */
const RF = { HIP:0, GABLE:1, CROSS:2, SHED:3, LAJE:4 };

function coberturaDe(st, ob, s2) {
  if (st === ST.GALPAO) return RF.SHED;
  if (st === ST.ANEXO)  return (ob.rect > 0.70 && s2 > 0.55) ? RF.SHED : RF.LAJE;
  if (st !== ST.CASA && st !== ST.SOBRADO) return RF.LAJE;
  // faixas cumulativas: 30% quatro águas, 26% duas águas, 16% empena pra rua,
  // 14% meia-água, 14% laje com platibanda.
  if (s2 < 0.30) return RF.HIP;
  if (s2 < 0.56) return RF.GABLE;
  if (s2 < 0.72) return ob.elong < 1.75 ? RF.CROSS : RF.GABLE;
  if (s2 < 0.86) return RF.SHED;
  return RF.LAJE;
}

/* ============================================================
   5. Geometria a partir dos registros  (versão com tipologia)
   ============================================================
   Substitui o buildBuildings do v5. O contrato com o resto da página é o
   mesmo — mesma assinatura, mesmo { g, lg, count }, mesmos presetDY/
   presetCenter — porque o streaming por quarteirão do v4 depende disso.

   O que muda é só o que sai por prédio: além da caixa extrudada, agora saem
   telhado inclinado, platibanda, caixa de água e um atributo de tipologia que
   o shader lê pra desenhar a fachada certa.

   Custo: tudo isso entra nas MALHAS QUE JÁ EXISTEM (uma por quarteirão), sem
   criar nenhuma chamada de desenho nova. Num renderizador limitado por draw
   call — que é o caso medido aqui, 23 us por chamada — triângulo extra é de
   graça. O que não é de graça é VRAM, e por isso o atributo novo é Uint16
   (6 B/vértice) em vez de três floats (12 B).
   ============================================================ */
const V2 = THREE.Vector2;

function buildBuildings(recs, cx, cz) {
  const P=[],N=[],C=[],F=[],D=[],DY=[],CXY=[],S=[], LP=[],LD=[],LDY=[],LCXY=[];
  // Retangulo minimo de cada predio, pra sombra de contato (ver refazSombras).
  // 8 floats: centro, eixo u, meias-larguras, o relevo da base e a altura.
  const SOM = [];
  const c = new THREE.Color(), rc = new THREE.Color();
  let count = 0;

  for (const b of recs) {
    const r = b.r, h = b.h, cls = CLS[b.c];
    let mx=0, mz=0; for (const p of r) { mx+=p[0]; mz+=p[1]; }
    mx/=r.length; mz/=r.length;
    // Prédio real fica nivelado sobre o terreno (a fundação absorve a inclinação):
    // um valor de relevo por edificação, medido no centro. Ver comentário do v5.
    let by = terrainY(mx, mz);
    for (let bi = 0; bi < r.length; bi++) {
      const bt = terrainY(r[bi][0], r[bi][1]);
      if (bt > by) by = bt;            // telhado nunca abaixo do chao mais alto da pegada
    }
    const dist = Math.min(1, Math.hypot(mx-cx, mz-cz) / (TILE_M*0.75));

    /* --- ORIENTAÇÃO DO ANEL — o bug que apagou o telhado do v7 -----------
       `insetRing` calcula a normal externa assumindo shoelace < 0, que é a
       convenção da base do Overture. Os volumes que o `build_v7_city.py`
       gera saem com o sinal CONTRÁRIO (o frame (t,n) do lote inverte a
       orientação ao passar por `utm_to_map`, que espelha o eixo Y): medido
       nesta base, 57.607 anéis com shoelace > 0 contra 1.389 com < 0.

       Com o sinal trocado o "inset" vira OUTSET. Duas consequências, as duas
       visíveis: a casa era desenhada 1 m maior POR LADO (uma casa de
       11,7 x 7,4 m virava 13,7 x 9,4 m, +50% de área), e o `rect` — que é
       area/área do OBB — caía de 0,99 pra 0,66, abaixo do 0,76 que libera
       telhado inclinado. Resultado medido na página: 9.520 casas de laje
       contra 65 com telhado. Por isso o bairro inteiro saía como uma laje
       escura só, que é o que o usuário apontou.

       Normalizar aqui conserta os dois de uma vez, e conserta também a normal
       das paredes, que segue a mesma convenção. */
    const gerado = shoelace(r) > 0;
    const rOK = gerado ? r.slice().reverse() : r;
    // O contorno gerado JÁ É A CASA: recuo frontal, afastamento lateral e
    // quintal foram calculados no build_v7_city sobre o lote da planta. O
    // 1 m de BUILDING_INSET existe pro contorno do Overture, que vem colado
    // no lote — aplicá-lo de novo comeria 2 m de cada dimensão da casa.
    const rw = safeInset(rOK, gerado ? 0.25 : BUILDING_INSET);
    const ob = obbOf(rw, Math.abs(shoelace(rw)) / 2);
    const st = tipoDe(b.c, h, b.area, ob);
    const pal = PAL[st];

    // Semente estável: centroide em decímetros. Não depende da ordem de leitura
    // nem do quarteirão em que o prédio caiu — o mesmo prédio sorteia o mesmo
    // número em toda sessão, e continua sorteando depois de atualizar a base.
    const seed = ((Math.round(mx*10) * 73856093) ^ (Math.round(mz*10) * 19349663)) >>> 0;
    const s1 = hash(seed), s2 = hash(seed ^ 0x9E37), s3 = hash(seed ^ 0x85EB);
    const sd = Math.min(255, Math.floor(s1 * 256));

    const s4 = hash(seed ^ 0xC2B2), s5 = hash(seed ^ 0x27D4);
    // s6/s7 sao sementes NOVAS de proposito: s2 e s3 ja escolhem cor de parede, forma
    // de agua e indice do leque de telha. Reusa-los pra matiz amarraria o desvio de
    // matiz ao indice da telha -- cada cor do leque sairia sempre com o mesmo desvio,
    // que e o oposto de variedade.
    const s6 = hash(seed ^ 0x165667B1), s7 = hash(seed ^ 0x9E3779B9);

    c.setHex(pal.wall[Math.floor(s1 * pal.wall.length) % pal.wall.length]);
    // A rua de casa aguenta (e pede) mais variacao que um corredor de torre: pintura
    // de casa e escolha de morador, fachada de predio e projeto. O desvio de matiz e
    // pequeno de proposito -- o suficiente pra separar dois beges vizinhos, longe de
    // inventar cor que nao esta na paleta da tipologia.
    const varSat = st <= ST.SOBRADO ? 0.10 : 0.05;
    const varLum = st <= ST.SOBRADO ? 0.10 : 0.075;
    c.offsetHSL((s6 - 0.5) * 0.03, (s2 - 0.5) * varSat, (s3 - 0.5) * varLum);
    // Cor DECLARADA vence o sorteio, e vence DEPOIS do desvio de matiz: o desvio existe
    // pra separar dois beges sorteados iguais, e nao ha o que separar quando alguem
    // mediu a cor na perspectiva do anuncio (ver `parede` em recDoLancamento). Hoje so
    // lancamento declara; a base do Overture nao tem esse dado.
    if (b.parede != null) c.setHex(b.parede);
    const rr = c.r, gg = c.g, bb = c.b;

    /* --- cobertura ------------------------------------------------------
       Quem é retangular o bastante ganha água inclinada; o resto cai pra laje
       com platibanda. Julgar isso pelo contorno evita telhado torto em cima de
       polígono que não comporta — e polígono que não comporta é comum.

       v7: a FORMA da água virou sorteio (ver `coberturaDe`), e não mais "duas
       ou quatro águas sobre o eixo maior" pra todo mundo. `rk` é o arquétipo;
       daqui pra baixo só se calcula quanto ele sobe, quanto avança de beiral e
       de que cor é a telha. */
    const podeAgua = ob.rect > 0.76 && ob.hv > 1.6;
    let rk = RF.LAJE;
    if (pal.telha === 1 && podeAgua) rk = coberturaDe(st, ob, s2);
    else if (pal.telha === 2 && ob.rect > 0.62) rk = RF.SHED;
    else if (st === ST.ANEXO && podeAgua) rk = coberturaDe(st, ob, s2);

    // A cumeeira do CROSS atravessa a casa: a água passa a vencer o vão do
    // eixo COMPRIDO, então a meia-largura que define a altura troca junto.
    const across = rk === RF.CROSS ? ob.hu : ob.hv;
    const pitched = rk !== RF.LAJE;
    let rise = 0, ph = 0, ov = 0;
    if (pitched) {
      if (pal.telha === 2) { rise = Math.min(2.4, across * 0.17); ov = 0.35; }
      else if (rk === RF.SHED) {
        // meia-água vence o vão inteiro numa tacada só: inclinação bem menor,
        // senão a casa vira rampa. É a cobertura da garagem e da casa simples.
        rise = Math.min(2.6, across * (0.30 + s4 * 0.16)); ov = 0.45 + s5 * 0.45;
      } else {
        rise = Math.min(4.2, across * (0.72 + s4 * 0.26));
        ov = 0.45 + s5 * 0.60;            // beiral de 45 cm a 1,05 m
      }
    } else {
      // Platibanda: a de casa varia, senão a rua de casa "de laje" fica com
      // todo mundo na mesma altura de parapeito.
      ph = PLATIBANDA[st] * (st <= ST.SOBRADO ? (0.7 + s4 * 1.4) : 1);
    }

    // Cor da telha: leque, não cor única (ver PAL em tipologia.js). Laje não é
    // telha — puxa a cor de concreto, senão o teto plano fica quase preto.
    const leque = pal.roofs;
    rc.setHex(pitched && leque ? leque[Math.floor(s3 * leque.length) % leque.length]
                               : (pitched ? pal.roof : (pal.laje || pal.roof)));
    // O leque ja da a cor; isto e o desvio DENTRO da cor. Dobrado (0,06 -> 0,12) porque
    // duas casas de telha da mesma entrada do leque saiam praticamente identicas vistas
    // de cima, que e como o mapa e olhado. A matiz anda pouco (barro varia de queima,
    // nao de pigmento) e usa s7, nao s3 -- s3 e quem escolhe a entrada do leque.
    rc.offsetHSL((s7 - 0.5) * 0.02, 0, (s2 - 0.5) * 0.12);
    const hw = h + ph;                       // topo da parede
    const hUse = Math.max(0, Math.min(2600, Math.round(h * 10)));  // até onde vai janela

    const vtx = (x,y,z, nx,ny,nz, cr,cg,cb, fu,fv, dyv) => {
      P.push(x,y,z); N.push(nx,ny,nz); C.push(cr*255, cg*255, cb*255);
      F.push(fu,fv); D.push(dist); DY.push(dyv); CXY.push(mx,mz); S.push(st, sd, hUse);
    };
    // Triângulo com normal calculada e virada pra fora (o material é DoubleSide,
    // então a face aparece de qualquer jeito; quem decide a luz é a normal).
    const tri = (a, p2, p3, ref) => {
      const ux=p2[0]-a[0], uy=p2[1]-a[1], uz2=p2[2]-a[2];
      const vx=p3[0]-a[0], vy=p3[1]-a[1], vz=p3[2]-a[2];
      let nx=uy*vz-uz2*vy, ny=uz2*vx-ux*vz, nz=ux*vy-uy*vx;
      const L = Math.hypot(nx,ny,nz) || 1; nx/=L; ny/=L; nz/=L;
      const gx=(a[0]+p2[0]+p3[0])/3 - ref[0], gy=(a[1]+p2[1]+p3[1])/3 - ref[1], gz=(a[2]+p2[2]+p3[2])/3 - ref[2];
      if (nx*gx + ny*gy + nz*gz < 0) { nx=-nx; ny=-ny; nz=-nz; }
      for (const p of [a, p2, p3]) vtx(p[0],p[1],p[2], nx,ny,nz, rc.r,rc.g,rc.b, 0,-1, by);
    };

    /* --- laje / forro: fecha o volume por cima em h ------------------- */
    let triRoof; try { triRoof = triangulateRing(rw); } catch (e) { continue; }
    const roofFlat = rc.clone().lerp(c, pitched ? 0.10 : 0.22);
    // A tampa sai VIRADA PRA BAIXO: earcut preserva a orientação do anel, e o
    // anel é o mesmo que desenha as paredes. Com o material em DoubleSide o
    // three inverte a normal da face de trás (`faceDirection` em
    // normal_fragment_begin), então a laje ficava com a normal apontando pro
    // chão e recebia SÓ luz ambiente — vista de cima aparecia quase preta.
    // Medido trocando a cor da laje por magenta puro: 466 mil pixels saíam
    // (77,0,99) em vez de (255,0,255). Inverter a ordem dos três índices custa
    // zero e conserta todo prédio de laje da cidade, não só a casa.
    for (const f of triRoof) for (const k of [f[2], f[1], f[0]])
      vtx(rw[k][0], h, rw[k][1], 0,1,0, roofFlat.r, roofFlat.g, roofFlat.b, 0,-1, by);

    /* --- águas do telhado, sobre o retângulo mínimo --------------------
       Um só desenho serve as quatro formas. O eixo (a) é sempre o da CUMEEIRA
       e o eixo (b) é o que a água vence; HIP/GABLE põem a cumeeira no lado
       comprido, CROSS troca os dois (é o que faz a empena olhar pra rua) e
       SHED usa um plano só. Trocar a moldura em vez de escrever quatro
       telhados mantém tudo em ~6 triângulos e dentro da malha do quarteirão —
       zero chamada de desenho a mais. */
    if (pitched) {
      const alongU = rk !== RF.CROSS;
      const ax = alongU ? ob.ux : -ob.uz, az = alongU ? ob.uz : ob.ux;
      const bx = -az, bz = ax;
      const A = (alongU ? ob.hu : ob.hv) + ov;      // meia-cumeeira
      const B = (alongU ? ob.hv : ob.hu) + ov;      // meio-vão da água
      const pt = (a, b2, y) => [ob.cx + ax*a + bx*b2, y, ob.cz + az*a + bz*b2];
      const ref = [ob.cx, h + rise*0.35, ob.cz];

      if (rk === RF.SHED) {
        // Meia-água: um plano só, caindo pro lado sorteado. Fecha com as duas
        // empenas triangulares das pontas e a testeira alta do lado de cima.
        const L = s3 > 0.5 ? 1 : -1;                // pra que lado a água cai
        const lo1=pt(-A,-B*L,h), lo2=pt(A,-B*L,h);
        const hi1=pt(-A,B*L,h+rise), hi2=pt(A,B*L,h+rise);
        const tp1=pt(-A,B*L,h), tp2=pt(A,B*L,h);
        tri(lo1,lo2,hi2,ref); tri(lo1,hi2,hi1,ref);   // a água
        tri(lo1,hi1,tp1,ref); tri(lo2,tp2,hi2,ref);   // empena de cada ponta
        tri(tp1,hi1,hi2,ref); tri(tp1,hi2,tp2,ref);   // testeira alta
      } else {
        // Quatro águas encurta a cumeeira; duas águas mantém ela até a ponta, e
        // aí os mesmos dois triângulos das pontas viram empena vertical.
        const RA = rk === RF.HIP ? Math.max(0, A - B * 0.92) : A;
        const c1=pt(-A,-B,h), c2=pt(A,-B,h), c3=pt(A,B,h), c4=pt(-A,B,h);
        const r1=pt(-RA,0,h+rise), r2=pt(RA,0,h+rise);
        tri(c1,c2,r2,ref); tri(c1,r2,r1,ref);      // água de um lado
        tri(c3,c4,r1,ref); tri(c3,r1,r2,ref);      // água do outro
        tri(c2,c3,r2,ref); tri(c4,c1,r1,ref);      // tacaniça (4 águas) ou empena (2 águas)
      }
    }

    /* --- paredes ------------------------------------------------------ */
    /* v11: varanda em prédio alto. Só na face MAIS LONGA -- que é a que olha a rua na
       esmagadora maioria dos lotes. Fatiar as quatro faces multiplicaria por quatro a
       malha de parede, que já é a maior da cena, pra devolver relevo em fachadas que
       quase nunca aparecem. E só PRÉDIO/TORRE: são 1,5% dos vértices de parede da
       cidade (medido), então o custo do fatiamento cabe num canto do orçamento. */
    let iVar = -1;
    if ((st === ST.PREDIO || st === ST.TORRE) && h > 8) {
      let melhor = 0;
      for (let i = 0, n = rw.length; i < n; i++) {
        const A2 = rw[i], B2 = rw[(i+1)%n];
        const Ls = Math.hypot(B2[0]-A2[0], B2[1]-A2[1]);
        if (Ls > melhor) { melhor = Ls; iVar = i; }
      }
      if (melhor < 6) iVar = -1;     // fachada curta não comporta varanda
    }
    let run = 0;
    for (let i = 0, n = rw.length; i < n; i++) {
      const a = rw[i], b2 = rw[(i+1)%n];
      const dx = b2[0]-a[0], dz = b2[1]-a[1], L = Math.hypot(dx,dz);
      if (L < 0.05) continue;
      const nx = -dz/L, nz = dx/L, u0 = run, u1 = run + L; run = u1;
      // Rampa do CORPO da parede (base -> topo), por vertice. Subiu de 0,76 pra 0,82:
      // a faixa escura de baixo passou a ser desenhada no shader, em metros, e nao
      // mais esticada ao longo do predio inteiro pela interpolacao. Virou FUNCAO
      // porque a parede com varanda tem vertice no meio, nao so em 0 e hw.
      const lo = 0.82;
      /* 3.4 do plano da Fase 3, na forma pedida: uma faixa de ~0,90 m na base da face
         frontal, escurecida por COR DE VERTICE, sem triangulo novo.

         O que isso de fato consegue, medido: a parede e um quad de quatro cantos e nada
         entre eles, entao so ha vertice pra escurecer quando a porta cai a menos de
         45 cm de uma das pontas do pano -- em pano largo o efeito nao existe, e onde
         existe sai como degrade ate o outro canto, nao como faixa. A porta que DE FATO
         aparece em toda fachada e a do shader (`porta` em facadeMaterial), que desenha
         por fragmento e por isso consegue a faixa; ela foi estendida logo abaixo pras
         tipologias que ainda nao tinham. As duas convivem. */
      const doorX = L * 0.4 + hash(seed ^ 0x5F35 ^ i) * L * 0.2;
      const porta = L > 2 ? u0 + doorX : -1e9;
      const fy = (y, u) => {
        let f = Math.min(1, lo + (1 - lo) * (y / hw));
        if (y === 0 && u !== undefined && Math.abs(u - porta) < 0.45) f *= 0.65;
        return f;
      };
      // Trecho reto da parede, de y0 a y1. A base (y = 0) segue o relevo no proprio
      // ponto; o resto usa o valor unico do predio, pra o telhado ficar nivelado.
      const paredeDe = (y0, y1) => {
        const q = [[a[0],a[1],u0,y0],[b2[0],b2[1],u1,y0],[b2[0],b2[1],u1,y1],
                   [a[0],a[1],u0,y0],[b2[0],b2[1],u1,y1],[a[0],a[1],u0,y1]];
        for (const pt of q) {
          const yy = pt[3], dyv = yy === 0 ? terrainY(pt[0],pt[1]) : by, f = fy(yy, pt[2]);
          vtx(pt[0],yy,pt[1], nx,0,nz, rr*f, gg*f, bb*f, pt[2], yy, dyv);
        }
      };
      if (i === iVar) {
        const REC = 0.20;      // profundidade da varanda
        const VAO = 1.05;      // altura do vao
        // Ritmo da fachada. ESTES DOIS NUMEROS SAO COPIA do GLSL de `facadeMaterial`
        // (peD e pv por tipologia): sem bater com ele, a varanda cortaria a fileira de
        // janela no meio. E divida do mesmo naipe da tabela de vias -- o certo seria
        // uma fonte so, e o shader nao le JS.
        const peD = st === ST.TORRE ? 4.7 : 3.7, pv = st === ST.TORRE ? 3.20 : 3.15;
        const ix = a[0] - nx*REC, iz = a[1] - nz*REC;
        const jx = b2[0] - nx*REC, jz = b2[1] - nz*REC;
        // Retorno horizontal (piso e teto da varanda). Marcado com aFace.y = -1, igual
        // ao telhado: e laje, nao fachada -- sem isso o shader desenharia uma fileira
        // de janela atravessada na soleira.
        const retorno = (yy, sgn) => {
          const q = [[a[0],a[1],u0],[b2[0],b2[1],u1],[jx,jz,u1],
                     [a[0],a[1],u0],[jx,jz,u1],[ix,iz,u0]];
          const f = Math.min(1, fy(yy) * (sgn > 0 ? 1.06 : 0.70));
          for (const pt of q) vtx(pt[0],yy,pt[1], 0,sgn,0, rr*f, gg*f, bb*f, pt[2], -1, by);
        };
        // Fundo recuado: continua sendo FACHADA (aFace.y real), entao a janela do
        // shader e desenhada la dentro -- que e onde ela fica numa varanda de verdade.
        const fundo = (y0, y1) => {
          const q = [[ix,iz,u0,y0],[jx,jz,u1,y0],[jx,jz,u1,y1],
                     [ix,iz,u0,y0],[jx,jz,u1,y1],[ix,iz,u0,y1]];
          for (const pt of q) {
            const f = Math.min(1, fy(pt[3]) * 0.88);
            vtx(pt[0],pt[3],pt[1], nx,0,nz, rr*f, gg*f, bb*f, pt[2], pt[3], by);
          }
        };
        let base = 0;
        for (let y = peD; y + VAO < h - 0.6; y += pv) {
          paredeDe(base, y);
          retorno(y, 1);          // piso da varanda: pega luz
          fundo(y, y + VAO);
          retorno(y + VAO, -1);   // teto da varanda: sombra, e o que da o relevo
          base = y + VAO;
        }
        paredeDe(base, hw);
      } else paredeDe(0, hw);
      LP.push(a[0],hw,a[1], b2[0],hw,b2[1]); LD.push(dist,dist); LDY.push(by,by); LCXY.push(mx,mz,mx,mz);
    }

    /* --- SACADA DE VERDADE (lancamento) ---------------------------------
       A `varanda` do v11 acima e um RECUO de 20 cm na face mais longa: ela devolve uma
       sombra fina e nada mais. Numa torre de lancamento isso e pouco -- o que se ve na
       perspectiva publicada e uma pilha de lajes que AVANCAM da fachada, com
       guarda-corpo cheio, e sao elas que dao a listra horizontal e o relevo do predio.

       Por que a geometria nasce aqui e nao vem de um .blend: laje e guarda-corpo entram
       na MESMA malha do quarteirao, com os mesmos atributos -- entao herdam de graca o
       furo do interior (`uFuro` corta por posicao de mundo), a sombra, o clique, a
       tonalizacao por distancia e o descarte do streaming, e custam ZERO chamada de
       desenho. Uma malha importada precisaria de material proprio e perderia os cinco.

       So lancamento declara (`sacadas` no bloco): a base do Overture nao sabe onde ha
       sacada em 96 mil edificacoes, e inventar em todas trocaria uma monotonia por
       outra. ~48 triangulos por sacada. */
    if (b.sacadas || b.faixa_pav) {
      // Comprimento das faces, pra saber quais sao as LONGAS sem depender do indice do
      // anel (que muda de sinal com o enrolamento).
      const comp = [];
      for (let i = 0, n = rw.length; i < n; i++) {
        const A2 = rw[i], B2 = rw[(i+1)%n];
        comp.push(Math.hypot(B2[0]-A2[0], B2[1]-A2[1]));
      }
      const maior = Math.max.apply(null, comp);
      const triSac = (p1, p2, p3, ref, f) => {
        const ux=p2[0]-p1[0], uy=p2[1]-p1[1], uz2=p2[2]-p1[2];
        const vx=p3[0]-p1[0], vy=p3[1]-p1[1], vz=p3[2]-p1[2];
        let nx2=uy*vz-uz2*vy, ny2=uz2*vx-ux*vz, nz2=ux*vy-uy*vx;
        const Ln = Math.hypot(nx2,ny2,nz2) || 1; nx2/=Ln; ny2/=Ln; nz2/=Ln;
        const gx=(p1[0]+p2[0]+p3[0])/3-ref[0], gy=(p1[1]+p2[1]+p3[1])/3-ref[1],
              gz=(p1[2]+p2[2]+p3[2])/3-ref[2];
        if (nx2*gx+ny2*gy+nz2*gz < 0) { nx2=-nx2; ny2=-ny2; nz2=-nz2; }
        // aFace.y = -1: isto e LAJE, nao pano de fachada. Sem isso o shader desenharia
        // uma fileira de janela atravessada no guarda-corpo.
        for (const p of [p1,p2,p3])
          vtx(p[0],p[1],p[2], nx2,ny2,nz2, rr*f, gg*f, bb*f, 0, -1, by);
      };
      // Caixa orientada no frame da face: eixo U ao longo da parede, V pra fora.
      const caixa = (cx2, cy, cz2, ex, ez, hu2, hv2, hy, f) => {
        const fx = -ez, fz = ex, V = [];
        for (const sy of [-1,1]) for (const sv of [-1,1]) for (const su of [-1,1])
          V.push([cx2 + ex*hu2*su + fx*hv2*sv, cy + hy*sy, cz2 + ez*hu2*su + fz*hv2*sv]);
        const ref = [cx2, cy, cz2];
        for (const q of [[0,1,3,2],[4,5,7,6],[0,1,5,4],[2,3,7,6],[0,2,6,4],[1,3,7,5]]) {
          triSac(V[q[0]], V[q[1]], V[q[2]], ref, f);
          triSac(V[q[0]], V[q[2]], V[q[3]], ref, f);
        }
      };
    /* --- FAIXA DE PAVIMENTO ---------------------------------------------
       O elemento que mais aparece na perspectiva publicada do Wish, e o que faltava:
       a testeira da laje AVANCA e da a volta no predio inteiro -- inclusive na empena
       cega, onde nao ha janela nenhuma e ela e a unica coisa que se ve. E ela que faz
       a torre ter 21 linhas horizontais em vez de ser um pano liso com janela pintada.

       Medida na imagem 03 do anuncio: a faixa ocupa ~1/5 da altura do pavimento
       (0,55 m de 3,15) e avanca pouco -- o suficiente pra lancar sombra na parede logo
       abaixo. Nas quatro faces, sempre: e testeira de laje, e laje nao escolhe fachada. */
    if (b.faixa_pav) {
      const FA = b.faixa_pav.altura_m || 0.55, FV = b.faixa_pav.avanco_m || 0.22;
      for (let i = 0, n = rw.length; i < n; i++) {
        const L = comp[i];
        if (L < 1) continue;
        const a = rw[i], b2 = rw[(i+1)%n];
        const ex = (b2[0]-a[0])/L, ez = (b2[1]-a[1])/L;
        const nx2 = -ez, nz2 = ex;
        const mxF = (a[0]+b2[0])/2 + nx2*(FV/2), mzF = (a[1]+b2[1])/2 + nz2*(FV/2);
        for (let pav = 1; pav*LV < h - 0.3; pav++) {
          const y = pav * LV;
          const f = Math.min(1, (0.82 + 0.18*(y/hw)) * 1.10);   // testeira pega luz
          caixa(mxF, y - FA/2, mzF, ex, ez, L/2, FV/2, FA/2, f);
        }
      }
    }

    if (b.sacadas) {
      const sc = b.sacadas;
      const LARG = sc.largura_m || 3.4, AV = sc.avanco_m || 1.4;
      const PEIT = sc.peitoril_m || 1.05, ESP = 0.10;   // guarda-corpo cheio, 10 cm
      const LAJE = 0.16;                                // espessura da laje da sacada
      const dePav = sc.de_pav != null ? sc.de_pav : 1;
      const nPor = sc.por_face || 3;
      const alvo = sc.faces || "longas";
      for (let i = 0, n = rw.length; i < n; i++) {
        const L = comp[i];
        if (L < LARG + 1) continue;
        if (alvo === "longa" && L < maior - 0.01) continue;
        if (alvo === "longas" && L < maior * 0.8) continue;
        const a = rw[i], b2 = rw[(i+1)%n];
        const ex = (b2[0]-a[0])/L, ez = (b2[1]-a[1])/L;    // ao longo da parede
        const nx2 = -ez, nz2 = ex;                          // pra FORA (mesma convencao
                                                            // da parede, ver `paredeDe`)
        // As sacadas ficam centradas na face, com o mesmo vao entre elas e nas pontas:
        // encostar uma sacada na quina do predio nao acontece em projeto nenhum.
        const cabe = Math.max(1, Math.min(nPor, Math.floor((L - 1.2) / (LARG + 0.8))));
        const passo = L / cabe;
        for (let pav = dePav; pav * LV + PEIT < h - 0.4; pav++) {
          const y = pav * LV;
          // Escurece com a altura pelo mesmo motivo da parede: sem isso a pilha de
          // sacada sai chapada e desmente a rampa do pano ao lado dela.
          const f = Math.min(1, 0.82 + 0.18 * (y / hw));
          for (let k = 0; k < cabe; k++) {
            const s = passo * (k + 0.5);
            const px2 = a[0] + ex*s, pz2 = a[1] + ez*s;
            const cxL = px2 + nx2*(AV/2), czL = pz2 + nz2*(AV/2);
            // A laje leva f MAIOR, nao menor: ela e o piso da sacada e vive na sombra
            // da sacada de cima -- vista de cima, com a cor rebaixada junto, cada sacada
            // virava um buraco preto na fachada.
            caixa(cxL, y - LAJE/2, czL, ex, ez, LARG/2, AV/2, LAJE/2, Math.min(1, f*1.18));
            caixa(px2 + nx2*(AV - ESP/2), y + PEIT/2, pz2 + nz2*(AV - ESP/2),
                  ex, ez, LARG/2, ESP/2, PEIT/2, f);                             // frente
            for (const sgn of [-1, 1])                                           // laterais
              caixa(px2 + ex*sgn*(LARG/2 - ESP/2) + nx2*(AV/2),
                    y + PEIT/2,
                    pz2 + ez*sgn*(LARG/2 - ESP/2) + nz2*(AV/2),
                    ex, ez, ESP/2, AV/2, PEIT/2, f*0.97);
          }
        }
      }
    }
    }

    /* --- caixa d'água da casa ----------------------------------------
       O detalhe de telhado mais reconhecível do Brasil, e o mapa é olhado de
       cima: uma caixa de 1 m no teto distingue duas casas de mesma planta sem
       tocar em nada da silhueta da rua. Custa 10 triângulos e entra na malha
       que já existe. Só em ~35% das casas — em todas viraria outra monotonia,
       e cada caixa também é VRAM, que é o limite real aqui. */
    if ((st === ST.CASA || st === ST.SOBRADO) && s5 > 0.65 && b.area > 55) {
      const rcHex = rc.getHex();
      // Uma cor so fazia o telhado brasileiro inteiro ter a MESMA caixa. O azul de
      // polietileno e o mais comum na rua; concreto e a caixa velha, e a branca e a
      // de fibra. Sorteado por s4, que aqui so mexia na largura -- semente nova nao
      // pagaria a si mesma pra escolher entre quatro valores.
      rc.setHex(CAIXA_COR[Math.floor(s4 * CAIXA_COR.length) % CAIXA_COR.length]);
      const w = 0.55 + s4*0.20, hh = 0.95 + s3*0.55;
      const off = (s1 - 0.5) * ob.hu * 1.1;
      const bx = ob.cx + ob.ux*off, bz = ob.cz + ob.uz*off;
      const y0 = h + (pitched ? rise*0.45 : 0), y1 = y0 + hh + (pitched ? 0 : ph);
      const vx = -ob.uz, vz = ob.ux;
      const cn = [[-w,-w],[w,-w],[w,w],[-w,w]].map(p => [bx + ob.ux*p[0] + vx*p[1], bz + ob.uz*p[0] + vz*p[1]]);
      const ref = [bx, (y0+y1)/2, bz];
      for (let i = 0; i < 4; i++) {
        const A2 = cn[i], B2 = cn[(i+1)%4];
        tri([A2[0],y0,A2[1]], [B2[0],y0,B2[1]], [B2[0],y1,B2[1]], ref);
        tri([A2[0],y0,A2[1]], [B2[0],y1,B2[1]], [A2[0],y1,A2[1]], ref);
      }
      tri([cn[0][0],y1,cn[0][1]], [cn[1][0],y1,cn[1][1]], [cn[2][0],y1,cn[2][1]], ref);
      tri([cn[0][0],y1,cn[0][1]], [cn[2][0],y1,cn[2][1]], [cn[3][0],y1,cn[3][1]], ref);
      rc.setHex(rcHex);
    }

    /* --- caixa de água / casa de máquinas ----------------------------- */
    // Silhueta é o que se lê de longe. Uma caixinha no topo dos prédios altos
    // quebra a linha reta do skyline por ~30 triângulos cada.
    if ((st === ST.PREDIO || st === ST.TORRE || st === ST.CIVICO) && h > 13) {
      const w = Math.min(3.6, ob.hv * 0.55), d2 = Math.min(3.0, ob.hv * 0.45), hh = 2.3 + s3*1.4;
      if (w > 1.0 && d2 > 0.8) {
        const ux = ob.ux, uz = ob.uz, vx = -uz, vz = ux;
        const off = (s2 - 0.5) * ob.hu * 0.8;
        const bx = ob.cx + ux*off, bz = ob.cz + uz*off, y0 = hw, y1 = hw + hh;
        const cn = [[-w,-d2],[w,-d2],[w,d2],[-w,d2]].map(p => [bx + ux*p[0] + vx*p[1], bz + uz*p[0] + vz*p[1]]);
        const ref = [bx, (y0+y1)/2, bz];
        for (let i = 0; i < 4; i++) {
          const A2 = cn[i], B2 = cn[(i+1)%4];
          tri([A2[0],y0,A2[1]], [B2[0],y0,B2[1]], [B2[0],y1,B2[1]], ref);
          tri([A2[0],y0,A2[1]], [B2[0],y1,B2[1]], [A2[0],y1,A2[1]], ref);
        }
        tri([cn[0][0],y1,cn[0][1]], [cn[1][0],y1,cn[1][1]], [cn[2][0],y1,cn[2][1]], ref);
        tri([cn[0][0],y1,cn[0][1]], [cn[2][0],y1,cn[2][1]], [cn[3][0],y1,cn[3][1]], ref);
      }
    }
    SOM.push(ob.cx, ob.cz, ob.ux, ob.uz, ob.hu, ob.hv, by, hw);
    count++;
  }

  if (!count) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(P),3));
  g.setAttribute("normal",   new THREE.BufferAttribute(new Float32Array(N),3));
  g.setAttribute("color",    new THREE.BufferAttribute(new Uint8Array(C), 3, true));
  g.setAttribute("aFace",    new THREE.BufferAttribute(new Float32Array(F),2));
  g.setAttribute("aDist",    new THREE.BufferAttribute(new Float32Array(D),1));
  // Uint16 sem normalizar: chega no shader como float com o valor inteiro.
  // (tipo, semente 0-255, altura útil em decímetros) em 6 B em vez de 12.
  g.setAttribute("aStyle",   new THREE.BufferAttribute(new Uint16Array(S),3));
  g.computeBoundingSphere();
  g.userData.dynamicHeight = true;
  g.userData.presetDY = new Float32Array(DY);
  g.userData.presetCenter = new Float32Array(CXY);
  registerTerrain(g);
  const lg = new THREE.BufferGeometry();
  lg.setAttribute("position", new THREE.BufferAttribute(new Float32Array(LP),3));
  lg.setAttribute("aDist",    new THREE.BufferAttribute(new Float32Array(LD),1));
  lg.computeBoundingSphere();
  lg.userData.presetDY = new Float32Array(LDY);
  lg.userData.presetCenter = new Float32Array(LCXY);
  return { g, lg, count, sombras: new Float32Array(SOM) };
}

/* A fita da rua, em duas peças com ALTURAS diferentes (v11).

   Até o v10 pista e calçada eram dois quads planos, e — o que é pior — a PISTA ficava
   por cima (y 0,35 contra 0,18). Não havia meio-fio nenhum: a calçada era uma faixa
   pintada. Agora:

     pista    y = 0,02   faixa [0 .. base]           quad cheio, com o remendo da junta
     calçada  y = 0,17   faixa [base .. base*mul]    DUAS faixas laterais
     meio-fio            quad VERTICAL em ±base, ligando as duas alturas

   A calçada virou faixa lateral por necessidade, não por elegância: como quad cheio
   ela passaria POR CIMA do asfalto agora que está mais alta.

   E ela é encurtada nas pontas de cada via. Sem isso, a calçada de uma rua atravessa
   o cruzamento da outra como uma lombada de 15 cm no meio do asfalto — as vias do OSM
   são cortadas nos entroncamentos, então a ponta da via é a esquina. */
function buildRibbons(recs, y, mul, opt) {
  opt = opt || {};
  const de = opt.de || 0, junta = opt.junta !== false, meio = !!opt.meiofio;
  const yBaixo = opt.y_baixo != null ? opt.y_baixo : 0.10;
  const P = [], V = [];
  const quad = (ax,ay,az, bx,by,bz, cx,cy,cz, dx2,dy2,dz2, va,vb,vc,vd, ua,ub,base) => {
    P.push(ax,ay,az, bx,by,bz, cx,cy,cz, ax,ay,az, cx,cy,cz, dx2,dy2,dz2);
    V.push(ua,va,base, ub,vb,base, ub,vc,base, ua,va,base, ub,vc,base, ua,vd,base);
  };
  for (const w of recs) {
    const base = (ROAD_W[HW[w.k]] || 6) / 2, pts = w.pts;
    let total = 0;
    for (let i = 0; i < pts.length-1; i++) total += Math.hypot(pts[i+1][0]-pts[i][0], pts[i+1][1]-pts[i][1]);
    const corte = de > 0 ? Math.min(base * mul * 1.35, total * 0.32) : 0;
    let acc = 0;
    for (let i = 0; i < pts.length-1; i++) {
      const a = pts[i], b = pts[i+1];
      const dx = b[0]-a[0], dz = b[1]-a[1], L = Math.hypot(dx,dz);
      if (L < 0.2) continue;
      const ux = dx/L, uz = dz/L, px = -uz, pz = ux;
      // recorte do trecho pra respeitar a folga das pontas da VIA (nao do trecho)
      let s0 = Math.max(acc, corte), s1 = Math.min(acc + L, total - corte);
      if (s1 - s0 > 0.2) {
        const t0 = s0 - acc, t1 = s1 - acc;
        const a0x = a[0]+ux*t0, a0z = a[1]+uz*t0, b0x = a[0]+ux*t1, b0z = a[1]+uz*t1;
        const hd = base*de, ha = base*mul;
        if (de > 0) {
          for (const sg of [1, -1]) {
            quad(a0x+px*hd*sg, y, a0z+pz*hd*sg,  b0x+px*hd*sg, y, b0z+pz*hd*sg,
                 b0x+px*ha*sg, y, b0z+pz*ha*sg,  a0x+px*ha*sg, y, a0z+pz*ha*sg,
                 hd*sg, hd*sg, ha*sg, ha*sg, s0, s1, base);
            if (meio)   // face vertical do meio-fio, virada pra pista
              quad(a0x+px*hd*sg, yBaixo, a0z+pz*hd*sg,  b0x+px*hd*sg, yBaixo, b0z+pz*hd*sg,
                   b0x+px*hd*sg, y, b0z+pz*hd*sg,       a0x+px*hd*sg, y, a0z+pz*hd*sg,
                   hd*sg, hd*sg, hd*sg, hd*sg, s0, s1, base);
          }
        } else {
          quad(a0x+px*ha, y, a0z+pz*ha,  b0x+px*ha, y, b0z+pz*ha,
               b0x-px*ha, y, b0z-pz*ha,  a0x-px*ha, y, a0z-pz*ha,
               ha, ha, -ha, -ha, s0, s1, base);
        }
      }
      if (junta && i > 0) {
        const h = base*mul;
        const c = [[-h,-h],[h,-h],[h,h],[-h,-h],[h,h],[-h,h]];
        for (const [cx, cz] of c) {
          P.push(a[0]+cx, y, a[1]+cz);
          V.push(acc + cx*ux + cz*uz, cx*px + cz*pz, base);
        }
      }
      acc += L;
    }
  }
  if (!P.length) return null;
  const g = meshOf(P);
  g.setAttribute("aVia", new THREE.BufferAttribute(new Float32Array(V), 3));
  return g;
}

/* O ruido e o mesmo dos dois materiais: hash por celula pro agregado do asfalto
   (uma chamada de sin) e um valor suavizado pra mancha grande (quatro). Foi medido
   contra a alternativa obvia -- textura de imagem em canvas -- e ganha em tudo que
   importa aqui: 0 byte na pagina, 0 uv por vertice, e nenhum problema de costura
   entre malhas de quarteiroes vizinhos, que uma textura repetida em espaco de mundo
   teria nas bordas. */
const GLSL_RUIDO = `
  float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
  float vnoise(vec2 p){
    vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
    return mix(mix(h21(i), h21(i+vec2(1.0,0.0)), f.x),
               mix(h21(i+vec2(0.0,1.0)), h21(i+vec2(1.0,1.0)), f.x), f.y);
  }
`;
// A quebra de linha antes da crase NAO e enfeite: o shader do three comeca com
// `#define PHONG`, e sem ela a concatenacao produz "}#define PHONG" -- diretiva no
// meio da linha, que o GLSL recusa com "'#' : invalid character".

/* O que a `rua_foto` mexe DENTRO do shader. Vai interpolado no fonte, e nao como
   uniform, por dois motivos: e constante pra pagina inteira (a chave e da cidade, nao
   da via), e assim o compilador do GLSL apaga o ramo que sobra em vez de o ramo viajar
   ate a placa de video. `toFixed(2)` nao e enfeite -- "0" solto e int em GLSL e o
   `step(0, base)` nao compila. */
const RUA_MANCHA = (AP_RUA ? 0.16 : 0.42).toFixed(2);
// A trama de 0,62 m e o agregado visto de perto. De cima ela e sub-pixel e vira
// chuvisco: na foto aerea o asfalto e liso, e so a mancha larga sobrevive.
const RUA_TRAMA = (AP_RUA ? 0.10 : 0.20).toFixed(2);
// Meia-pista minima pra via TER faixa central. Zero = todas, que era o desenho ate
// aqui. Na foto a rua de bairro (7,5 m, meia-pista 3,75) nao tem faixa nenhuma, e
// pintar todas era o que fazia o bairro inteiro parecer avenida.
const RUA_EIXO_MIN = (AP_RUA ? 4.5 : 0.0).toFixed(2);
// A divisoria de faixa de ROLAMENTO so existe na `rua_foto`: e ela, e nao a do eixo,
// que a foto mostra na avenida -- que tem duas faixas por sentido. Sai do mesmo u/v da
// faixa central, entao continua custando zero chamada de desenho.
const RUA_ROLAMENTO = AP_RUA ? `
        float rol = step(5.0, base) * smoothstep(0.18, 0.11, abs(abs(v) - base*0.5));
        diffuseColor.rgb = mix(diffuseColor.rgb, uPintura, rol * trac * medio * 0.90);
` : "";

/* Uma funcao SO, compartilhada por todos os materiais de fita. O three usa
   `onBeforeCompile.toString()` como chave de cache de programa: closure nova por
   quarteirao (que e o que a `facadeMaterial` faz, porque precisa capturar o uniform
   da animacao) recompilaria o shader a cada quadra que entra na visao. */
function _compilaVia(sh) {
  sh.vertexShader = "attribute vec3 aVia;\nvarying vec3 vVia;\n" +
    sh.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\nvVia=aVia;");
  sh.fragmentShader = "varying vec3 vVia;\nuniform float uCalcada;\nuniform vec3 uPintura;\nuniform vec3 uEixo;\n" +
    GLSL_RUIDO +
    sh.fragmentShader.replace("#include <color_fragment>", `#include <color_fragment>
    {
      float u = vVia.x, v = vVia.y, base = max(vVia.z, 0.5);
      float d2 = length(vViewPosition);
      // Duas distancias, nao uma. O GRAO pode sumir cedo (a 90 m ja e menor que o
      // pixel, e ruido sub-pixel vira cintilacao quando a camera anda). A JUNTA da
      // calcada tem periodo de ~1 m e precisa sumir antes de virar moire, mas depois
      // do grao. Uma so das duas fazia a rua cintilar ou a calcada vibrar.
      float perto = 1.0 - smoothstep(70.0, 230.0, d2);
      float medio = 1.0 - smoothstep(260.0, 780.0, d2);

      // mancha larga: remendo, recapeamento, sombra de idade. E a unica que sobrevive
      // de longe, e e ela que tira o aspecto de papel na vista de cima.
      float mancha = vnoise(vec2(u, v) * 0.075) - 0.5;
      float trama  = vnoise(vec2(u, v) * 0.62) - 0.5;
      float grao   = h21(floor(vec2(u, v) * 9.0)) - 0.5;
      diffuseColor.rgb *= 1.0 + mancha * ${RUA_MANCHA} + trama * ${RUA_TRAMA} * medio + grao * 0.30 * perto;

      if (uCalcada > 0.5) {
        float d = abs(v);
        // junta de placa: transversal a cada 1,15 m, longitudinal a cada 0,95 m --
        // medidas a partir do MEIO-FIO, nao do eixo da rua, senao a fiada anda
        // conforme a largura da via.
        float jl = smoothstep(0.06, 0.0, abs(fract(u/1.15) - 0.5) - 0.46);
        float jt = smoothstep(0.06, 0.0, abs(fract((d - base)/0.95) - 0.5) - 0.46);
        diffuseColor.rgb *= 1.0 - (jl + jt) * 0.20 * medio;
        // meio-fio: faixa clara de concreto na divisa com o asfalto
        float mf = smoothstep(0.34, 0.06, abs(d - base));
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 1.22 + 0.045, mf * medio);
      } else {
        // rodado: as duas faixas de pneu, mais escuras e mais lisas que o resto
        float rodado = smoothstep(0.75, 0.0, abs(abs(v) - base*0.52));
        diffuseColor.rgb *= 1.0 - rodado * 0.13 * medio;
        // borda gasta: o asfalto encardido junto da sarjeta
        diffuseColor.rgb *= 0.86 + 0.14 * smoothstep(0.0, 0.9, base - abs(v));
        // faixa de bordo continua, so em via larga -- rua de bairro nao tem, e
        // pintar todas fazia o bairro inteiro parecer rodovia
        float bordo = step(5.0, base) * smoothstep(0.13, 0.02, abs(abs(v) - (base - 0.45)));
        diffuseColor.rgb = mix(diffuseColor.rgb, uPintura, bordo * 0.55 * medio);
        // v12: FAIXA CENTRAL TRACEJADA, em toda via. Sai daqui e nao de geometria: a
        // fita ja carrega u (ao longo do eixo) e v (transversal), entao a faixa custa
        // zero chamada de desenho e continua existindo no nivel de grafico baixo --
        // a malha de tracejado que ela substitui era uma chamada por quarteirao e
        // sumia no nivel baixo. Medidas dela: 0,32 m de largura, 3,5 m pintados a
        // cada 7 m, que sao as mesmas da malha antiga.
        // (crase em comentario de GLSL fecha o template literal do JS -- nao usar.)
        float eixo = smoothstep(0.19, 0.13, abs(v)) * step(${RUA_EIXO_MIN}, base);
        float trac = step(fract(u / 7.0), 0.50);
        diffuseColor.rgb = mix(diffuseColor.rgb, uEixo, eixo * trac * medio);
${RUA_ROLAMENTO}      }
    }`);
}

function matVia(cor, mul, calcada) {
  const m = new THREE.MeshPhongMaterial({ color:cor, shininess:0, specular:0x000000,
    polygonOffset:true, polygonOffsetFactor:-1, polygonOffsetUnits:-1 });
  m.onBeforeCompile = sh => {
    sh.uniforms.uCalcada = { value: calcada ? 1 : 0 };
    // A tinta continua morando na paleta (K.mark), nao num literal dentro do GLSL.
    // THREE.Color converte o hex de sRGB pro espaco linear de trabalho, que e onde o
    // `diffuseColor` vive neste ponto do shader -- por isso vai como Color, nao como
    // tres numeros escritos a mao.
    sh.uniforms.uPintura = { value: new THREE.Color(K.mark) };
    // Duas tintas: a do eixo e a de rolamento. Sem `rua_foto` as duas sao a mesma cor,
    // que e o desenho que as outras cidades ja tinham.
    sh.uniforms.uEixo = { value: new THREE.Color(K.markEixo) };
    _compilaVia(sh);
  };
  // Sem isto o three usa `onBeforeCompile.toString()` como chave -- igual pros dois
  // materiais -- e calcada e pista compartilhariam o programa com o uniform errado.
  m.customProgramCacheKey = () => "via" + (calcada ? "c" : "p");
  return m;
}

function buildPatches(recs) {
  const P = [], polys = [];
  for (const w of recs) {
    const r = w.r;
    let tri; try { tri = triangulateRing(r); } catch (e) { continue; }
    for (const f of tri) for (const k of f) P.push(r[k][0], 0.12, r[k][1]);
    polys.push(r);
  }
  return { m: P.length ? meshOf(P) : null, polys };
}
/* ------------------------------------------------------------------
   Arborizacao (v10). Ate o v9 toda arvore era UM icosaedro de 20 tris,
   instanciado, e so em praca -- a arvore de rua estava desligada porque
   caia em cima da casa e do asfalto.

   Agora sao 20 especies vindas de `arvores/arvores_lib.json` (gerador
   parametrico no Blender, cor por vertice, sem textura). Duas escolhas
   valem explicacao:

   * **Malha mesclada, nao instanciada.** Uma InstancedMesh so desenha UMA
     geometria; 20 especies seriam 20 chamadas de desenho POR QUARTEIRAO, e
     chamada de desenho e o gargalo desta pagina (23 us cada). Mesclado, o
     quarteirao inteiro continua custando UMA, igual ao v9 -- o que sobe e
     triangulo, que sobra.
   * **A arvore de rua volta, plantada na CALCADA.** A fita que o
     renderizador desenha tem duas bordas: a pista, a ROAD_W/2 x mul_pista
     do eixo, e o fim da rua, a ROAD_W/2 x mul_fita -- onde quadra, lote e
     muro param. Entre as duas ha calcada livre por construcao. O tronco vai
     no meio dessa faixa (`mul_calcada`), entao nao ha como nascer no asfalto
     nem dentro do lote. A copa passa por cima dos dois, que e o que as fotos
     mostram. O portao `arvore fora da calcada` mede isso na pagina pronta.
   ------------------------------------------------------------------ */
const ARV = (() => {
  const el = document.getElementById("__arvores");
  if (!el) return null;
  let d; try { d = JSON.parse(el.textContent); } catch (e) { console.error("Arvores:", e); return null; }
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
  const A = (CIDADE.arborizacao) || {};
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
})();

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
scene.add(gArv);
const arvMesh = [];
let arvSujo = true;
const arvAlvo = new THREE.Vector3(1e9, 0, 1e9);   // onde o conjunto foi refeito
const PORT_RAIO = 700;   // o portao e menor que a arvore: some antes

function arvGeometria(e) {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(e.pos, 3));
  g.setAttribute("normal", new THREE.BufferAttribute(e.nrm, 3));
  g.setAttribute("color", new THREE.BufferAttribute(e.col, 3));
  g.computeBoundingSphere();
  return g;
}

/* Sombra de contato: um borrao escuro na base de cada predio.

   NADA na cidade projeta sombra de verdade (`castShadow` e false em predio, muro e
   arvore desde o v8 -- ver a nota do SOMBRA_CIDADE), entao o volume aparece colado no
   chao, sem contato. Isto devolve o contato pelo preco de uma matriz por predio.

   Uma malha por quarteirao esta FORA DE COGITACAO: sao 901 quarteiroes vivos na
   medida do centro de Ribeirao, com 340 chamadas de desenho no total -- uma malha de
   sombra por quarteirao praticamente dobraria a conta, no que ja e o gargalo medido
   (23 us por chamada). Instanciado sao 6 triangulos de geometria e UMA chamada, nao
   importa quantos quarteiroes vivam. Mesmo raciocinio da arvore do v10.

   O raio e menor que o da arvore de proposito: sombra de contato so existe de perto;
   a 600 m o borrao tem menos de um pixel e vira custo de preenchimento puro -- que e
   exatamente o que falta na iGPU que motivou os niveis de grafico. */
// A sombra e a UNICA coisa transparente que cobre area de chao na cidade, e custo de
// preenchimento e exatamente o que falta na iGPU dos niveis fracos (ver a nota de
// QUAL_NIVEIS). Em "baixo" o raio encolhe: perto continua tendo sombra, longe nao.
const SOM_RAIO = NIVEL_NOME === "baixo" ? 380 : 620, SOM_TETO = 30000;
const gSom = new THREE.Group();
gSom.name = "sombras";
scene.add(gSom);
let somMesh = null, somSujo = true;

function _geoSombra() {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array([
    -0.5,0,-0.5,  0.5,0,-0.5,  0.5,0,0.5,
    -0.5,0,-0.5,  0.5,0,0.5,  -0.5,0,0.5]), 3));
  g.setAttribute("normal", new THREE.BufferAttribute(new Float32Array([
    0,1,0, 0,1,0, 0,1,0, 0,1,0, 0,1,0, 0,1,0]), 3));
  g.computeBoundingSphere();
  return g;
}

function refazSombras() {
  somSujo = false;
  const R2 = SOM_RAIO*SOM_RAIO;
  const buf = [], pos = [];
  for (const rec of gLive.values()) {
    if (!rec.sombras || !rec.sombras.length) continue;
    const dx = rec.cx - target.x, dz = rec.cz - target.z;
    if (dx*dx + dz*dz > R2) continue;
    for (let k = 0; k < rec.sombras.length; k += 8) { buf.push(rec.sombras); pos.push(k); }
  }
  const n = Math.min(pos.length, SOM_TETO);
  if (!n) { if (somMesh) somMesh.count = 0; return; }
  if (!somMesh || somMesh.instanceMatrix.count < n) {
    if (somMesh) { gSom.remove(somMesh); somMesh.dispose(); }
    const cap = 1 << Math.ceil(Math.log2(Math.max(1024, n)));
    somMesh = new THREE.InstancedMesh(_geoSombra(),
      // DoubleSide, e nao por preguica de acertar a ordem dos vertices: um quad
      // deitado no chao com a ordem trocada some visto DE CIMA, que e justamente como
      // o mapa e olhado -- a mesma armadilha que apagou a laje do telhado no v7. Custa
      // zero em fragmento (o quad e plano) e mata a classe de erro inteira.
      new THREE.MeshBasicMaterial({ color:0x000000, transparent:true, opacity:0.13,
                                    depthWrite:false, side:THREE.DoubleSide }), cap);
    somMesh.frustumCulled = false;     // a esfera da geometria unitaria nao vale nada
    somMesh.renderOrder = -3;          // colado no chao, antes do resto do transparente
    somMesh.castShadow = somMesh.receiveShadow = false;
    gSom.add(somMesh);
  }
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(),
        sc = new THREE.Vector3(), e = new THREE.Euler();
  for (let i = 0; i < n; i++) {
    const S = buf[i], k = pos[i];
    // O eixo u do retangulo minimo em XZ vira giro em Y: com theta = atan2(-uz, ux),
    // o X local cai em (ux, uz) e o Z local em (-uz, ux) -- o mesmo par que o resto
    // do codigo chama de (u, v).
    e.set(0, Math.atan2(-S[k+3], S[k+2]), 0); q.setFromEuler(e);
    /* Sombra PROJETADA, nao anel simetrico. A primeira versao seguia o plano ao pe da
       letra -- um plano 10-18% maior que a pegada, centrado no predio -- e foi medida:
       o anel de 45 cm a 1 m fica quase todo ESCONDIDO embaixo da propria casa e atras
       do muro do lote, e a sombra nao aparecia na tela. Provado pintando as instancias
       de vermelho opaco: sobravam duas lascas de 3 px por quarteirao.

       Deslocando na direcao da luz, a area escura cai FORA da pegada e le na hora. O
       comprimento sai da altura pela mesma razao da geometria do sol, e o quadrilatero
       vira a caixa do volume varrido: centro no meio do caminho, e cada eixo crescido
       do quanto a sombra andou naquele eixo.

       O teto de 11 m de altura efetiva existe porque a sombra literal de uma torre de
       60 m seria um tapete de 50 m atravessando tres lotes -- e sem ninguem mais na
       cidade projetando sombra, ela leria como erro, nao como sombra. */
    const hEf = Math.min(S[k+7], 11);
    const dx = -SOL_OFF.x * hEf / SOL_OFF.y, dz = -SOL_OFF.z * hEf / SOL_OFF.y;
    // A margem e em METROS, nao em porcentagem: um anel proporcional some na casa
    // pequena e vira tapete no galpao.
    const M = Math.min(1.4, Math.max(0.45, 0.20 * Math.min(S[k+4], S[k+5])));
    // Quanto a sombra andou em cada eixo do retangulo minimo (u e v).
    const du = Math.abs(dx*S[k+2] + dz*S[k+3]);
    const dv = Math.abs(-dx*S[k+3] + dz*S[k+2]);
    // A base usa o relevo do canto MAIS ALTO da pegada (`by`), nao o do centro: e o
    // mesmo valor que o shader soma na parede, entao a sombra acompanha o volume em
    // vez de afundar nele.
    v.set(S[k] + dx*0.5, S[k+6]*reliefAmount + 0.07, S[k+1] + dz*0.5);
    sc.set(S[k+4]*2 + M*2 + du, 1, S[k+5]*2 + M*2 + dv);
    m.compose(v, q, sc);
    somMesh.setMatrixAt(i, m);
  }
  somMesh.count = n;
  somMesh.instanceMatrix.needsUpdate = true;
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
  _arvV.set(p.x, terrainY(p.x, p.z)*reliefAmount, p.z);
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
  im.castShadow = false; im.receiveShadow = SOMBRA_CIDADE;
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
      im.castShadow = false; im.receiveShadow = SOMBRA_CIDADE;
      // Uma InstancedMesh cobre a cidade visivel inteira: nenhuma esfera de corte
      // ajuda, e o teste custaria mais que os 20 desenhos que ela evita.
      im.frustumCulled = false;
      arvMesh[i] = im; gArv.add(im);
    }
    for (let k = 0; k < lista.length; k++) {
      const p = lista[k];
      v.set(p.x, terrainY(p.x, p.z)*reliefAmount, p.z);
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

/* ============================================================
   Portoes (v10.2)

   Toda casa brasileira tem portao, e ate aqui o mapa tinha o muro sem ele: uma
   fileira de caixas fechadas. O `gen_portoes.py` decide ONDE (a aresta do lote mais
   perto do eixo de uma via dirigivel) e com que largura; aqui e so a forma.

   Quatro tipos, todos de 3 a 5 caixas. Detalhe fino nao chega ao olho nesta escala --
   o que se le de cima e a COR e a proporcao, entao a grade vertical e listra na cor
   do vertice, nao barra de verdade. Um portao de grade com 7 barras custaria 132
   triangulos contra os 36 de um painel listrado, pela mesma imagem.

   Instanciado por tipo, filtrado por raio e refeito junto com as arvores: 4 chamadas
   de desenho pra cidade toda. A largura entra como ESCALA EM X, entao o pilar
   engorda um pouco no portao largo -- o que e ate verdade na rua.
   ============================================================ */
const PORT = (() => {
  const el = document.getElementById("__portoes");
  if (!el) return null;
  let a; try { a = JSON.parse(el.textContent); } catch (e) { return null; }
  if (!a.length) return null;
  const n = a.length / 5;
  const x = new Float32Array(n), z = new Float32Array(n), ang = new Float32Array(n);
  const larg = new Float32Array(n), tipo = new Uint8Array(n);
  let px = 0, pz = 0;
  for (let i = 0; i < n; i++) {
    px += a[i*5]; pz += a[i*5+1];
    x[i] = px/10; z[i] = pz/10;
    ang[i] = a[i*5+2] / 255 * Math.PI * 2;
    larg[i] = a[i*5+3] / 10;
    tipo[i] = a[i*5+4];
  }
  return { n, x, z, ang, larg, tipo };
})();

/* Uma caixa em coordenadas locais. X vai de -0,5 a 0,5 (a largura do portao inteiro,
   pilar a pilar) e e o eixo que a instancia escala; Y e Z ja estao em metros. */
function _caixa(P, C, cx, cy, cz, sx, sy, sz, cor) {
  const x0=cx-sx/2, x1=cx+sx/2, y0=cy-sy/2, y1=cy+sy/2, z0=cz-sz/2, z1=cz+sz/2;
  const v = [[x0,y0,z0],[x1,y0,z0],[x1,y1,z0],[x0,y1,z0],
             [x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1]];
  const f = [[0,1,2],[0,2,3],[5,4,7],[5,7,6],[4,0,3],[4,3,7],
             [1,5,6],[1,6,2],[3,2,6],[3,6,7],[4,5,1],[4,1,0]];
  for (const t of f) for (const k of t) { P.push(v[k][0],v[k][1],v[k][2]); C.push(cor[0],cor[1],cor[2]); }
}

function _geoPortao(tipo) {
  const P = [], C = [];
  // Tres razoes pro portao sumir dentro do muro, todas consertadas aqui:
  //  1. ele nascia coplanar com o muro -> agora avanca 12 cm PRA RUA (o +Z local, que
  //     o gen_portoes garante ser o lado da rua);
  //  2. o painel era mais baixo que os 2,2 m do muro, entao o muro aparecia por cima
  //     -> agora o painel vai a 2,30 m e o pilar a 2,62 m, que e o que se ve na rua:
  //     pilar sempre mais alto que o muro;
  //  3. painel e pilar tinham quase a mesma cor do muro -> o pilar sai 35% mais claro
  //     que o painel na cor de vertice, e o tom da instancia e metalico medio/escuro.
  const pilar = [1.35,1.34,1.30], painel = [1.0,1.0,1.0], vao = [0.42,0.44,0.46];
  const ep = 0.086, ZF = 0.12;            // meia-espessura do pilar; avanco pra rua
  const hp = 2.62, hpa = 2.30;
  _caixa(P, C, -0.5+ep, hp/2, ZF, ep*2, hp, 0.34, pilar);
  _caixa(P, C,  0.5-ep, hp/2, ZF, ep*2, hp, 0.34, pilar);
  if (tipo === 0) {                       // correr liso
    _caixa(P, C, 0, hpa/2, ZF, 1-ep*2, hpa, 0.12, painel);
  } else if (tipo === 1) {                // basculante com friso no topo
    _caixa(P, C, 0, hpa/2, ZF, 1-ep*2, hpa, 0.12, painel);
    _caixa(P, C, 0, hpa-0.14, ZF+0.03, 1-ep*2, 0.18, 0.16, vao);
  } else if (tipo === 2) {                // portao + porta social ao lado
    _caixa(P, C, -0.12, hpa/2, ZF, 0.70-ep, hpa, 0.12, painel);
    _caixa(P, C,  0.28, hp/2-0.06, ZF, ep*1.5, hp-0.12, 0.32, pilar);
    _caixa(P, C,  0.40, 1.10, ZF, 0.16, 2.20, 0.11, vao);
  } else {                                // com cobertura/laje projetada
    _caixa(P, C, 0, hpa/2, ZF, 1-ep*2, hpa, 0.12, painel);
    _caixa(P, C, 0, hp+0.10, ZF+0.30, 1.0, 0.20, 0.95, pilar);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(P), 3));
  g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(C), 3));
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

// Metalico medio a escuro: e o que contrasta com o muro, que e claro. Tom claro
// demais (o primeiro palpite tinha 0xD8D8D6 e 0xEDEDE9) desaparece contra o reboco.
const PORT_COR = [0x9AA0A4, 0x6E7478, 0x4E565C, 0x3E4A42, 0x7A6A5A, 0x5A5F63, 0x8A8177];
const gPort = new THREE.Group();
gPort.name = "portoes";
scene.add(gPort);
const portMesh = [];

function refazPortoes() {
  if (!PORT) return;
  const R2 = PORT_RAIO * PORT_RAIO;
  const lista = [[], [], [], []];
  for (let i = 0; i < PORT.n; i++) {
    const dx = PORT.x[i] - target.x, dz = PORT.z[i] - target.z;
    if (dx*dx + dz*dz > R2) continue;
    lista[PORT.tipo[i]].push(i);
  }
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(),
        sc = new THREE.Vector3(), e = new THREE.Euler(), cor = new THREE.Color();
  for (let t = 0; t < 4; t++) {
    const L = lista[t];
    let im = portMesh[t];
    if (!L.length) { if (im) im.count = 0; continue; }
    if (!im || im.instanceMatrix.count < L.length) {
      if (im) { gPort.remove(im); im.dispose(); }
      const cap = 1 << Math.ceil(Math.log2(Math.max(64, L.length)));
      im = new THREE.InstancedMesh(_geoPortao(t),
        new THREE.MeshPhongMaterial({ vertexColors:true, shininess:8, specular:0x222222 }), cap);
      im.castShadow = false; im.receiveShadow = SOMBRA_CIDADE;
      im.frustumCulled = false;
      portMesh[t] = im; gPort.add(im);
    }
    for (let k = 0; k < L.length; k++) {
      const i = L[k];
      v.set(PORT.x[i], terrainY(PORT.x[i], PORT.z[i]) * reliefAmount, PORT.z[i]);
      e.set(0, -PORT.ang[i], 0); q.setFromEuler(e);
      sc.set(PORT.larg[i], 1, 1);
      m.compose(v, q, sc);
      im.setMatrixAt(k, m);
      cor.setHex(PORT_COR[(i * 7 + PORT.tipo[i]) % PORT_COR.length]);
      im.setColorAt(k, cor);
    }
    im.count = L.length;
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
  }
}

/* ============================================================
   6. Montagem de um lote
   ============================================================ */
const overlay = $("overlay");
const seenStreets = new Map();
let labels = [], built = 0, blocks = 0;
// O relevo de um rotulo nao muda: a rua nao anda. Amostrar terrainY tres vezes por
// rotulo por quadro (2.000 rotulos = 6.000 amostras da grade) era refazer sempre a
// mesma conta. Quem invalida e o botao Relevo, unico que mexe em reliefAmount/elevGrid.
function dyDoRotulo(l) {
  l.ya = terrainY(l.a.x, l.a.z);
  l.yb = terrainY(l.b.x, l.b.z);
  l.ym = terrainY(l.m.x, l.m.z);
}
function recalcDyRotulos() { for (const l of labels) dyDoRotulo(l); }
// Camera parada = rotulo parado (ver o laco no frame()).
const _rotCam = new THREE.Vector3(1e9, 0, 1e9);
let _rotW = 0, _rotH = 0, _rotRel = -1, _rotSujo = true;
function sujaRotulos() { _rotSujo = true; }

/* v4: era assemble(). Além de montar, agora REGISTRA em `rec` tudo o que criou —
   malhas, parcelas e uniforms de animação — porque uma quadra que entra na visão
   também precisa poder sair. No v3 nada era descartado, então nada precisava ser
   rastreado. */
function assembleInto(rec, B, R, G, cx, cz) {
  const add = (o, parent) => { parent.add(o); rec.objs.push(o); return o; };
  const gp = buildPatches(G);
  if (gp.m) { const m = new THREE.Mesh(gp.m, flat(K.green)); m.receiveShadow = SOMBRA_CIDADE; add(m, gRest); }
  // A pista NAO pode descer perto do chao: o poligono da quadra vai ate o EIXO da
  // via, entao o chao do quarteirao passa por baixo do asfalto inteiro. Com a pista a
  // 0,02 sobravam 8 cm sobre ele e a rua sumia embaixo do terreno. 0,10 devolve folga
  // e ainda deixa os 15 cm de meio-fio ate a calcada, a 0,25.
  const rd = buildRibbons(R, 0.10, 1.0);
  if (rd) { const m = new THREE.Mesh(rd, matVia(K.asfalto, 1.0, false)); m.receiveShadow = SOMBRA_CIDADE; add(m, gRoad); }
  const wk = buildRibbons(R, 0.25, 1.55, { de: 1.0, junta: false, meiofio: true, y_baixo: 0.10 });
  if (wk) { const m = new THREE.Mesh(wk, matVia(K.walk, 1.55, true)); m.receiveShadow = SOMBRA_CIDADE; add(m, gRoad); }
  // v12: a faixa central saiu daqui. Era uma chamada de desenho por quarteirao, so em
  // via grande e so no nivel de grafico alto; agora e o proprio shader da pista que a
  // pinta, em toda via e em todo nivel. Ver `_compilaVia`.
  { // v6 passava roads=[]: a arvore de beira de rua caia em cima da casa (que agora
    // encosta na rua) e do asfalto, entao so praca era arborizada. v10 devolve a rua,
    // plantando na faixa de calcada da propria fita -- ver buildTrees.
    // O quarteirao nao ganha malha de arvore: guarda o PLANTIO, e as InstancedMesh
    // por especie sao refeitas de uma vez pra cidade toda (ver refazArvores).
    rec.plants = buildTrees(gp.polys, R);
    rec.cx = cx; rec.cz = cz;
    if (rec.plants) arvSujo = true;
    somSujo = true;   // sombra de contato existe em quarteirao sem uma arvore sequer
  }
  const b = buildBuildings(B, cx, cz);
  if (b) {
    rec.sombras = b.sombras;
    const u = { value: slow ? 1 : 0 };
    risers.push({ u, t0: performance.now() });
    rec.risers.push(u);
    const bm = new THREE.Mesh(b.g, facadeMaterial(u));
    // v9: o interior precisa voltar da FACE clicada pro registro do predio.
    // `presetCenter` ja da o centroide por vertice; falta so a lista onde
    // procurar. E uma referencia, nao uma copia -- custa um ponteiro.
    bm.userData.recs = B;
    // v8: o corte por frustum volta. O v3 o desligou porque a esfera nao sabia do
    // deslocamento que o shader aplica (relevo/altura) e o three cortava quadra
    // visivel; agora a esfera e inflada pelo deslocamento maximo possivel dessa
    // malha (medeFolga/inflaEsfera). O streaming corta por distancia, mas quem
    // esta perto e ATRAS da camera continuava custando uma chamada de desenho.
    medeFolga(b.g); inflaEsfera(b.g);
    bm.frustumCulled = true;
    bm.castShadow = false; bm.receiveShadow = SOMBRA_CIDADE; add(bm, gBuild);
    if (!LIGHT()) {
      b.lg.userData.dynamicHeight = true; registerTerrain(b.lg);
      const lgLines = new THREE.LineSegments(b.lg, riseLine(u));
      medeFolga(b.lg); inflaEsfera(b.lg);
      lgLines.frustumCulled = true;
      add(lgLines, gLines);
    }
    else b.lg.dispose();
    blocks += b.count;
  }
  built++;
  return b ? b.count : 0;
}

function addStreets(roads) {
  for (const w of roads) {
    if (!w.name || w.pts.length < 2) continue;
    let best = 0, bi = 0;
    for (let i = 0; i < w.pts.length-1; i++) {
      const L = Math.hypot(w.pts[i+1][0]-w.pts[i][0], w.pts[i+1][1]-w.pts[i][1]);
      if (L > best) { best = L; bi = i; }
    }
    if (best < 45) continue;
    const prev = seenStreets.get(w.name);
    if (prev && prev >= best) continue;
    seenStreets.set(w.name, best);
    if (labels.length >= 2000) continue;
    const a = w.pts[bi], b = w.pts[bi+1], el = document.createElement("div");
    el.className = "street"; el.textContent = w.name.toUpperCase(); el.style.display = "none";
    overlay.appendChild(el);
    const rot = { el, a: new THREE.Vector3(a[0],0.3,a[1]), b: new THREE.Vector3(b[0],0.3,b[1]),
      m: new THREE.Vector3((a[0]+b[0])/2, 0.3, (a[1]+b[1])/2),
      v: new THREE.Vector3(), v2: new THREE.Vector3(), ya: 0, yb: 0, ym: 0 };
    dyDoRotulo(rot);
    labels.push(rot);
  }
}

/* ============================================================
   7. Leitura de formatos e rede
   ============================================================ */

// O nome do arquivo da base, pro ?city= e pra mensagem do boot(). Morava no meio do
// bloco de constantes do Overpass, que saiu junto com o caminho de baixar por tile.
const CITY_FILE = CIDADE.arquivo_base;

const sleep = ms => new Promise(r => setTimeout(r, ms));
function timed(url, ms) {
  const ctl = new AbortController();
  const to = setTimeout(() => ctl.abort(), ms || 30000);
  return fetch(url, { signal:ctl.signal }).finally(() => clearTimeout(to));
}

/* ============================================================
   8. Fila de quadrantes
   ============================================================ */
const stK=$("stK"), stM=$("stM"), stI=$("stI");
// Stubs for removed UI elements
const progTxt={set textContent(_){}};
const phase={classList:{remove(){},add(){},toggle(){}}};
let running = 0;

const aim = t => { if (t) { mark.position.x = t.x; mark.position.z = t.z; mark.visible = true; }
                   else mark.visible = false; };


function hideStatus() { $("status").style.display = "none"; frameLoop(); }


/* ============================================================
   9. Salvar e abrir a cidade pronta
   ============================================================ */
/* ============================================================
   4b. Streaming por quarteirão  (v4)
   ------------------------------------------------------------
   O v3 montava a cidade inteira no boot: 1.281 draw calls e ~224 MB de VRAM
   residentes do primeiro frame ao último. Medido numa GTX 1650, o gargalo é
   submissão, não rasterização — 23 us por draw call, e cortar 68% dos
   triângulos não mudou o frame em nada. Ou seja: o que custa é QUANTOS objetos
   estão na cena, não quão detalhados eles são.

   Aqui a cidade passa a montar só o que está perto do alvo da câmera. A 400 m
   isso são ~0,8% da geometria, o que libera orçamento para casas muito mais
   detalhadas do que o v3 jamais poderia ter.

   A unidade é o quarteirão (face do grafo de ruas, ver build_blocks.py), não o
   tile de 850 m: quadra é a menor coisa que ainda parece um pedaço de cidade
   inteiro quando aparece, então montar/descartar por quadra não deixa costura
   visível no meio de uma rua.
   ============================================================ */
let   STREAM_R    = 1800;  // m — raio de montagem a partir do alvo da câmera
                           // let, não const: é tunável em tempo de execução — a
                           // ficha de um imóvel quer raio curto, uma vista de
                           // rota atravessando a cidade quer raio longo
const STREAM_HYST = 320;   // m — histerese: só descarta além de R+H, senão um
                           // movimento de vaivém na fronteira remonta sem parar.
                           // Escala com o raio: a 1.800 m um passo de câmera cobre
                           // mais quadras de fronteira que a 700 m.
// Em "baixo" o orcamento de montagem cai: quem esta com 20 FPS nao tem 6 ms por
// quadro pra emprestar pro streaming, e o engasgo aparece justamente onde doi.
const STREAM_MS   = NIVEL_NOME === "baixo" ? 4 : 6;
// Afastar alem do que o streaming monta so mostraria chao vazio, entao o teto de
// zoom e amarrado ao raio -- e a decisao de produto ("mostrar so uma regiao")
// vira uma constante, nao uma regra espalhada pelo controle de camera.
function zoomMax() { return STREAM_R * 0.85; }

// Muda o alcance em tempo de execucao e refaz o conjunto vivo na hora: encolher
// descarta o excedente no mesmo instante, crescer enfileira o que falta.
function setStreamRadius(m) { STREAM_R = Math.max(150, m); streamUpdate(true); }     // ms — fatia de montagem por frame

let gGroups = [];              // {cx, cz, rad, B, R, G}
const gLive = new Map();       // índice -> { objs, risers, roads }
let streamQ = [];              // fila de montagem, mais perto primeiro
let anchorX = 1e9, anchorZ = 1e9;
let streamReady = false;

/* O acervo de unidades, lido CEDO. A lista continua documentada onde sempre esteve
   (ver UNIDADES, na secao do interior); o que subiu pra ca foi so a leitura, porque o
   LANCAMENTO virou volume da cidade e o `loadCity` precisa dele pra injetar o predio do
   lote -- e o loadCity roda muito antes daquela secao.  */
/* ============================================================
   12c. Luz assada no Unreal Engine  (v15)
   ============================================================
   O bake em JS (secao 12b) mede oclusao de ambiente com uma ricochetada. Isto aqui
   e outra coisa: e a iluminacao COMPLETA de um caminho de luz de verdade (Lumen,
   com ceu, sol e quantas ricochetadas ele quiser), calculada fora, uma vez, e
   trazida como imagem.

   O acordo entre os dois lados e uma LISTA ORDENADA DE PECAS. Uma peca e uma face
   plana: as cinco faces do prisma de cada parede, as cinco do rodape, o piso de
   cada comodo, o forro de cada contorno -- nesta ordem, que e a mesma em que
   `geoDaCasa` as desenha e a mesma que `pipeline/unreal_exporta.py` escreveu no
   OBJ. Cada peca tem um retangulo no atlas; a UV de lightmap sai do retangulo mais
   a posicao dentro da face.

   Nao ha geometria vinda do Unreal. A malha continua sendo a que este arquivo
   gera -- o que atravessa e so a LUZ, numa textura. E o que faz o cadastro
   continuar sendo a fonte de verdade: corrigir um comodo muda a malha aqui e
   invalida o atlas la, e o atlas se refaz sozinho pelo pipeline.

   QUAL DOS DOIS ENTRA, HOJE: o bake em JS. Nao por preferencia -- por MEDIDA. No
   portao de exposicao (`pipeline/mede_interior.py`, camera presa, monte-das-colinas):

       bake em JS      media 162,3   faixa dinamica 90,4   ok
       atlas do Unreal media 139,1   faixa dinamica 65,3   FORA (o piso e 80)

   A cena do Unreal e mais suave e mais correta de forma (a ricochetada e de verdade,
   nao uma aproximacao), mas chega achatada, e a causa esta identificada: a captura
   sai por `SCS_FINAL_COLOR_LDR`, ou seja ja passou pelo tonemapper -- que existe pra
   COMPRIMIR faixa dinamica, que e justamente o que um mapa de luz precisa carregar.
   Dentro das pecas o atlas tem faixa de 255; o que sobra na tela e 65. Fechar isso
   pede captura LINEAR (alvo de render em 16f e leitura de .hdr/.exr), esquadria
   dentro do assado (hoje batente e caixilho nao tem peca e ficam sem luz propria) e
   densidade maior que 24 texels/m.

   Entao: `?luz=ue` liga o atlas, `?luz=js` forca o bake em JS, e `auto` -- o padrao
   -- escolhe o JS. Trocar o padrao e trocar UMA palavra aqui embaixo, quando a
   medida virar.
   ============================================================ */
const _LUZUE = (() => {
  try { return JSON.parse(document.getElementById("__luzue").textContent) || {}; }
  catch (e) { return {}; }
})();
const LUZ_MODO = new URLSearchParams(location.search).get("luz") || "auto";
const _texLuz = new Map();

/* A textura do atlas. Vem embutida como data URI, entao nao ha rede nem CORS --
   a pagina continua abrindo com duplo clique. `colorSpace` FICA LINEAR de
   proposito: isto e irradiancia, nao cor de superficie; marcar como sRGB
   aplicaria a curva duas vezes e escureceria o meio-tom. */
function texturaDeLuz(id) {
  if (_texLuz.has(id)) return _texLuz.get(id);
  const d = _LUZUE[id];
  let t = null;
  if (d && d.png) {
    const im = new Image();
    t = new THREE.Texture(im);
    t.flipY = true;
    // CANAL 1, e nao o padrao. Desde a r152 cada textura carrega o `channel` que ela
    // le, e o padrao e 0 -- ou seja `uv`. Sem esta linha o lightMap era amostrado com
    // a UV DE MATERIAL, que aqui esta em METROS (0..3,9 numa parede): a textura
    // clampava e a casa saia com uma faixa do atlas atravessada na parede, listrada.
    // Nada no console, nada de errado na uv1 (medida: u 0,002-0,990, v 0,742-0,998,
    // dentro do atlas) -- so a textura lendo o canal errado.
    t.channel = 1;
    t.colorSpace = THREE.LinearSRGBColorSpace || THREE.LinearEncoding;
    t.minFilter = THREE.LinearFilter; t.magFilter = THREE.LinearFilter;
    t.generateMipmaps = false;        // atlas: mip mistura peca com peca
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    im.onload = () => { t.needsUpdate = true; sujaSombra && sujaSombra(); };
    im.src = d.png;
  }
  _texLuz.set(id, t);
  return t;
}

/* A peca e endereçada, nao contada. A primeira versao entregava "a proxima peca" e
   dependia de `geoDaCasa` desenhar na mesma ordem em que o exportador escreveu -- e
   ele NAO desenha: o piso sai antes da parede aqui, e depois dela la. Endereçar por
   (tipo, indice, face) tira a ordem de desenho da conta, e o mesmo endereco vale
   nos dois lados.

   O mapa de enderecos, que e o contrato com `pipeline/unreal_exporta.py`:

     parede i, face f  ->  base(i) + f            (5 faces: 4 laterais + tampa)
     rodape i, face f  ->  base(i) + 5 + f        (so quando a parede nasce no chao)
     piso do comodo i  ->  P0 + i
     forro do contorno i -> P0 + n_comodos + i

   `base(i)` soma 5 ou 10 por parede anterior, conforme ela tenha rodape. Se a conta
   nao fechar com o tamanho do atlas, o cursor se recusa a existir e o interior cai
   no bake em JS -- que e o certo pra planta corrigida depois do bake. */
function cursorDeLuz(pl) {
  const d = _LUZUE[pl && pl.id];
  if (!d || !d.rects || LUZ_MODO !== "ue") return null;   // `auto` = bake em JS
  const lado = d.atlas, paredes = pl.paredes;
  const base = new Int32Array(paredes.length);
  let acc = 0;
  for (let i = 0; i < paredes.length; i++) {
    base[i] = acc;
    acc += (paredes[i].y0 < 0.05) ? 10 : 5;
  }
  const P0 = acc, T0 = P0 + pl.comodos.length;
  const esperado = T0 + pl.contorno.length;
  if (esperado !== d.rects.length) {
    if (LUZ_MODO === "ue")
      console.warn("luz: atlas de " + pl.id + " tem " + d.rects.length +
                   " pecas e a planta pede " + esperado);
    return null;
  }
  const de = k => {
    const r = d.rects[k];
    if (!r) return null;
    return (a, b) => [ (r[0] + r[2]*a) / lado, 1 - (r[1] + r[3]*b) / lado ];
  };
  return {
    total: d.rects.length,
    parede: (i, f) => de(base[i] + f),
    rodape: (i, f) => de(base[i] + 5 + f),
    piso: i => de(P0 + i),
    teto: i => de(T0 + i)
  };
}

const _UNIDADES = (() => {
  try { return JSON.parse(document.getElementById("__unidades").textContent) || []; }
  catch (e) { return []; }
})();

/* O PREDIO QUE AINDA NAO EXISTE.

   Uma unidade de lote diz onde o imovel VAI ficar; com `lote.predio` ela diz tambem o
   que vai ser construido ali, e o mapa desenha. Nao e enfeite: sem volume, lancamento e
   um farol no mato -- nao da pra ver a implantacao, nem clicar nele, nem recortar a
   casca ao entrar.

   O volume entra como REGISTRO DE EDIFICACAO comum, num grupo de streaming so dele.
   Assim herda tudo de graca: fachada com janela, platibanda, sombra, clique, corte ao
   entrar, descarte quando sai do raio. Custo: uma chamada de desenho.

   A pegada e um retangulo declarado no cadastro, e nao a planta da unidade: a planta e
   de UM apartamento e a laje de uma torre comporta varios. Sem `largura_m` /
   `profundidade_m` cai na planta mais folga, que e a unica informacao que existe.

   UM RETANGULO NAO E UM PREDIO. Uma caixa extrudada com a grade de janela de sempre e
   exatamente o que a base do Overture ja da pras 96 mil edificacoes anonimas -- e
   lancamento e o unico caso do acervo em que existe PERSPECTIVA PUBLICADA, ou seja
   alguem sabe a forma. Por isso `lote.predio.blocos` aceita uma LISTA de volumes:
   ala em L, torre gemea, bloco MRV repetido, embasamento de garagem, casa de maquinas.
   Cada bloco e um registro de edificacao comum -- e como todos caem no MESMO grupo de
   streaming, viram uma malha so: o conjunto inteiro continua custando UMA chamada de
   desenho, igual a caixa que ele substitui.

   `du`/`dv` sao metros no frame do LOTE (du no eixo do `rumo_graus`, dv perpendicular);
   `giro_graus` gira o bloco em relacao a esse frame (e o que faz o L). `pavimentos`,
   `largura_m`, `profundidade_m` e `cor_parede` faltando caem no valor do `predio`.
   `classe` 2 e o que da laje com platibanda a um volume BAIXO (embasamento, portaria):
   sem ela `tipoDe` classifica 1 pavimento como CASA e poe telhado de duas aguas de
   300 m2 em cima da garagem.

   VOLUME NO ALTO SEM CAMPO NOVO: a parede sempre nasce no chao, entao uma caixa de
   maquinas e so um bloco ESTREITO com mais pavimentos que a torre -- o que esta abaixo
   do teto fica dentro da torre e nao aparece. */
function anelNoLote(L, b) {
  const aL = (L.rumo_graus || 0) * Math.PI / 180;
  const cx = px(L.lon) + Math.cos(aL)*(b.du || 0) - Math.sin(aL)*(b.dv || 0);
  const cz = pz(L.lat) + Math.sin(aL)*(b.du || 0) + Math.cos(aL)*(b.dv || 0);
  const a = aL + (b.giro_graus || 0) * Math.PI / 180;
  const ux = Math.cos(a), uz = Math.sin(a);
  const hu = b.largura_m / 2, hv = b.profundidade_m / 2;
  const W = (t, v) => [cx + ux*t - uz*v, cz + uz*t + ux*v];
  const r = [W(-hu,-hv), W(hu,-hv), W(hu,hv), W(-hu,hv)];
  // Enrolamento POSITIVO de proposito: `plantaDaUnidade` le shoelace > 0 como "contorno
  // gerado" e recua 0,25 m em vez do 1 m do footprint do Overture. Com o sinal trocado a
  // planta nasceria maior que a casca.
  if (shoelace(r) <= 0) r.reverse();
  return { r, cx, cz, rad: Math.hypot(hu, hv) };
}

function anelDoLote(u) {
  const L = u && u.lote;
  if (!L || L.lat == null) return null;
  const P = u.planta || {}, pr = L.predio || null;
  let hu, hv;
  if (pr && pr.largura_m && pr.profundidade_m) {
    hu = pr.largura_m / 2; hv = pr.profundidade_m / 2;
  } else {
    let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
    for (const c of (P.comodos || [])) for (const q of c.poly) {
      if (q[0] < x0) x0 = q[0]; if (q[0] > x1) x1 = q[0];
      if (q[1] < z0) z0 = q[1]; if (q[1] > z1) z1 = q[1];
    }
    if (x1 < x0) return null;
    // 0,90 m de folga: 0,25 volta no recuo da casca e o resto e a espessura de fachada
    // que qualquer predio tem entre a parede do apartamento e a face externa.
    hu = (x1-x0)/2 + 0.90; hv = (z1-z0)/2 + 0.90;
  }
  const { r, cx, cz } = anelNoLote(L, { largura_m: hu*2, profundidade_m: hv*2 });
  const pav = pr && pr.pavimentos ? pr.pavimentos : 0;
  const h = pav ? pav * LV : (u.andar || 0) * LV + (P.pe_direito || PD);
  return { r, h, cx, cz, rad: Math.hypot(hu, hv), torre: !!pav };
}

/* "#7E4A42" -> 0x7E4A42. Null pra qualquer coisa que nao seja cor: campo ausente,
   string vazia ou lixo viram sorteio de paleta, nao preto. */
function corHexDe(s) {
  if (typeof s !== "string") return null;
  const h = s.replace("#", "").trim();
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  return parseInt(h, 16);
}

/* O registro de edificacao do lancamento, memorizado NA UNIDADE. Tem que ser sempre o
   MESMO objeto: o grupo de streaming leva ele, e a ficha o devolve; se fossem duas
   copias, `predioDeId` e `unidadeDoPredio` passariam a depender do arredondamento do
   centroide pra concordar, em vez de simplesmente ser o mesmo predio. */
function recsDoLancamento(u) {
  if (u._recsLote !== undefined) return u._recsLote;
  const an = anelDoLote(u), L = (u && u.lote) || null;
  if (!an || !an.torre) { u._recLote = null; return (u._recsLote = []); }
  // `parede`: a cor da fachada AMOSTRADA da perspectiva do anuncio. Prédio da base
  // sorteia a cor no leque do arquetipo, e sortear e o certo la -- ninguem sabe de que
  // cor e cada uma das 79 mil edificacoes. Aqui alguem sabe: o lancamento tem render
  // publicado, e a torre de tijolo aparente do Sanca 135 sair bege por sorteio seria
  // jogar fora a unica informacao de cor que existe. Ausente, cai no sorteio de sempre.
  const pr = L.predio || {};
  const lista = (pr.blocos && pr.blocos.length)
    ? pr.blocos
    : [{ du: 0, dv: 0, largura_m: pr.largura_m, profundidade_m: pr.profundidade_m }];
  const recs = [];
  for (const b of lista) {
    const larg = b.largura_m || pr.largura_m, prof = b.profundidade_m || pr.profundidade_m;
    if (!larg || !prof) continue;
    const el = anelNoLote(L, { du: b.du, dv: b.dv, giro_graus: b.giro_graus,
                               largura_m: larg, profundidade_m: prof });
    recs.push({ r: el.r, h: (b.pavimentos || pr.pavimentos) * LV,
                c: b.classe != null ? b.classe : 1, area: larg * prof,
                name: (u.ficha && u.ficha.empreendimento) || null, addr: null,
                fa: 400, lancamento: true,
                parede: corHexDe(b.cor_parede || pr.cor_parede),
                sacadas: b.sacadas || (b.sacadas === null ? null : pr.sacadas) || null,
                _cx: el.cx, _cz: el.cz, _rad: el.rad, _principal: b.principal === true });
  }
  // O bloco PRINCIPAL e o que hospeda a unidade: e o registro que a ficha devolve, o que
  // a planta veste por dentro e o que o furo recorta. Sem marcacao e o primeiro -- que e
  // o unico que existe quando nao ha `blocos`.
  u._recLote = recs.find(b => b._principal) || recs[0] || null;
  return (u._recsLote = recs);
}
function recDoLancamento(u) { recsDoLancamento(u); return u._recLote; }

function groupsFrom(B, R, G, grp) {
  const out = [];
  // Prédios: fatia contígua de B. O pipeline/city_base.py reordenou o b[] agrupando
  // por quadra justamente pra isso caber em [início, quantidade] em vez de uma
  // lista de 111 mil índices (1,2 MB -> 0,13 MB).
  for (const g of grp)
    out.push({ cx: g.cx, cz: g.cz, rad: g.rad, B: B.slice(g.s, g.s + g.n), R: [], G: [] });

  // Ruas e áreas verdes não pertencem a quarteirão nenhum (a rua é a FRONTEIRA
  // entre duas quadras). Ficam na grade de 850 m do v3, como grupos próprios,
  // sujeitos ao mesmo teste de raio.
  const cells = new Map();
  const cellOf = p => {
    const gx = Math.round(p[0]/CELL), gz = Math.round(p[1]/CELL), k = gx + ":" + gz;
    let c = cells.get(k);
    if (!c) { c = { cx: gx*CELL, cz: gz*CELL, rad: 0, B: [], R: [], G: [] }; cells.set(k, c); }
    return c;
  };
  for (const r of R) cellOf(r.pts[0]).R.push(r);
  for (const g of G) cellOf(g.r[0]).G.push(g);
  // raio medido do conteúdo real: uma polilinha de rua atravessa a célula e sai
  // do outro lado, então meia-diagonal não a contém e a rua sumiria na borda.
  for (const c of cells.values()) {
    let far = 0;
    for (const r of c.R) for (const p of r.pts)
      far = Math.max(far, Math.hypot(p[0]-c.cx, p[1]-c.cz));
    for (const g of c.G) for (const p of g.r)
      far = Math.max(far, Math.hypot(p[0]-c.cx, p[1]-c.cz));
    c.rad = far;
    out.push(c);
  }
  return out;
}

function dropGroup(i) {
  const rec = gLive.get(i);
  if (!rec) return;
  for (const o of rec.objs) {
    if (o.parent) o.parent.remove(o);
    if (o.geometry) {
      const k = terrainRegistry.indexOf(o.geometry);
      if (k >= 0) terrainRegistry.splice(k, 1);
      o.geometry.dispose();
    }
    if (o.material) o.material.dispose();
  }
  // risers guarda o uniform da animação de subida por malha montada; sem tirar
  // daqui, a lista cresce sem limite conforme o usuário anda pela cidade.
  for (const u of rec.risers) {
    const k = risers.findIndex(r => r.u === u);
    if (k >= 0) risers.splice(k, 1);
  }
  // seenStreets nao e limpo aqui: o rebuildOverlay() zera e refaz o conjunto
  // inteiro logo em seguida, e limpar aqui so criaria dois donos pro mesmo estado.
  if (rec.plants) arvSujo = true;
  if (rec.sombras) somSujo = true;
  gLive.delete(i);
}

function buildGroup(i) {
  if (gLive.has(i)) return 0;
  const g = gGroups[i];
  const rec = { objs: [], risers: [], roads: g.R };
  gLive.set(i, rec);
  return assembleInto(rec, g.B, g.R, g.G, g.cx, g.cz);
}

/* Rótulo de rua é DOM, não geometria: em vez de criar/remover um a um conforme a
   quadra entra e sai, refaço a lista inteira quando o conjunto vivo muda. Com no
   máximo algumas dezenas de quadras vivas isso é barato, e evita toda uma classe de
   bug de índice defasado que uma atualização incremental teria assim que algo fosse
   descartado. */
function rebuildOverlay() {
  for (const l of labels) l.el.remove();
  labels = [];
  sujaRotulos();   // elementos NOVOS, que nascem display:none -- ver a guarda no frame()
  seenStreets.clear();
  for (const rec of gLive.values())
    for (const w of rec.roads) addStreets([w]);
}

function streamUpdate(force) {
  if (!streamReady) return;
  const dx = target.x - anchorX, dz = target.z - anchorZ;
  if (!force && dx*dx + dz*dz < 60*60) return;   // andou pouco: nada muda
  anchorX = target.x; anchorZ = target.z;

  const keep = STREAM_R + STREAM_HYST;
  let dropped = false;
  const want = [];
  for (let i = 0; i < gGroups.length; i++) {
    const g = gGroups[i];
    const d = Math.hypot(g.cx - target.x, g.cz - target.z) - g.rad;
    if (gLive.has(i)) { if (d > keep) { dropGroup(i); dropped = true; } }
    else if (d <= STREAM_R) want.push([d, i]);
  }
  // monta de dentro pra fora: o que está debaixo do nariz aparece primeiro
  want.sort((a, b) => a[0] - b[0]);
  streamQ = want.map(w => w[1]);
  if (dropped) rebuildOverlay();
}

/* Chamado uma vez por frame: gasta no máximo STREAM_MS montando. O laço de
   render é o mesmo que desenha, então estourar esse orçamento aparece como
   engasgo direto na tela — por isso é tempo medido, não contagem fixa. */
function streamPump() {
  if (!streamQ.length) return;
  const t0 = performance.now();
  let n = 0;
  while (streamQ.length && performance.now() - t0 < STREAM_MS) { buildGroup(streamQ.shift()); n++; }
  if (n) { rebuildOverlay(); sujaSombra(); }   // quarteirão novo entrou: ele projeta sombra
  if (!streamQ.length) {
    progTxt.textContent = `${gLive.size} quarteirões · ${blocks.toLocaleString("pt-BR")} edificações`;
  }
}

/* Malha viária inteira em UMA chamada de desenho: 62 mil arestas de linha fina,
   ~1,5 MB, sempre residente. Serve de contexto pro que ainda não montou e é o
   que permite desenhar uma rota que atravessa a cidade sem exigir que toda a
   cidade esteja construída. */
function buildStreetContext(R) {
  const P = [];
  for (const w of R)
    for (let i = 0; i < w.pts.length - 1; i++) {
      const a = w.pts[i], b = w.pts[i+1];
      P.push(a[0], 0.25, a[1], b[0], 0.25, b[1]);
    }
  if (!P.length) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(P), 3));
  registerTerrain(g);
  const m = new THREE.LineBasicMaterial({ color: K.road, transparent: true, opacity: 0.5 });
  const ls = new THREE.LineSegments(g, m);
  ls.renderOrder = -1;
  return ls;
}

function resetScene() {
  running++;
  for (const g of [gBuild, gLines, gRoad, gRest])
    for (const o of g.children.slice()) {
      if (o.geometry) o.geometry.dispose();
      if (o.material) o.material.dispose();
      g.remove(o);
    }
  for (const l of labels) l.el.remove();
  labels = []; risers.length = 0;
  arvTotal = true;
  sujaRotulos();
  seenStreets.clear();
  built = 0; blocks = 0;
  uHeight.value = parseFloat($("hs").value);
  // As malhas dos estabelecimentos (halo/feixe) nao pertencem a nenhum quadrante da
  // cidade e ficam na cena entre um carregamento e outro — se saissem do registro de
  // relevo aqui, parariam de acompanhar o terreno depois do primeiro loadCity().
  const keepPoi = terrainRegistry.filter(g => g.userData.poi || g.userData.ground);
  terrainRegistry.length = 0;
  for (const g of keepPoi) terrainRegistry.push(g);
  // v4: sem isso, um segundo loadCity() deixaria gLive apontando pra malhas ja
  // descartadas e o streaming nunca remontaria essas quadras.
  for (const k of [...gLive.keys()]) gLive.delete(k);
  streamQ = []; anchorX = anchorZ = 1e9; streamReady = false;
}
/* A NEVOA ESTAVA MEDIVELMENTE DESLIGADA em todo enquadramento de rua.
   `near`/`far` saiam do TAMANHO DA CIDADE (0,55 e 2,1 de HALF), e em Ribeirao isso da
   near = 3,0 km: num print de bairro (raio 700, camera a 187 m) a borda do dado
   aparece a 2-4 km, ou seja INTEIRA antes do near. Prova: trocar o literal de
   `new THREE.Fog` de (1400, 5500) pra (700, 3000) devolveu um PNG byte a byte
   identico -- frame0 sobrescrevia os dois de todo jeito.
   Sem nevoa a cidade termina numa navalha: carpete de telhado a contraste cheio
   colado no ceu. Era o unico defeito que o ceu novo criou -- com o cinza de limpeza
   a costura nao aparecia porque os dois lados tinham a MESMA cor.

   Tamanho de cidade e a variavel errada: o que decide se ha ar entre a camera e o
   fundo e o ENQUADRAMENTO. Uma so escala serve os dois extremos que existem aqui --
   o voo de abertura (raio ~HALF*0,55, o assunto E o longe) e o print de rua (raio
   150, o longe e so fundo). Por isso near acompanha o raio e nao a cidade. */
function nevoaDoQuadro() {
  const r = sph.radius;
  scene.fog.near = Math.max(600, r*1.5);
  scene.fog.far  = scene.fog.near + Math.max(2500, r*6);
}
function frame0(n) {
  HALF = n * TILE_M / 2;
  target.set(0,0,0); sph.set(HALF*0.55, 0.98, 0.55);
  $("extent").textContent = `${(n*TILE_M/1000).toFixed(1).replace(".", ",")} × ${(n*TILE_M/1000).toFixed(1).replace(".", ",")} km`;
}


// v6: setas de orientacao -- uma seta chata no teto de cada casa apontando pra
// frente (a rua). data.fa (graus) por predio; rotation.y = -fa (o +X do mapa vira
// (cos,-sin) no mundo). Uma InstancedMesh so, invisivel ate ligar no botao Setas.
let gArrows = null;
function buildFacingArrows(B) {
  if (gArrows) { scene.remove(gArrows); if (gArrows.geometry) gArrows.geometry.dispose(); gArrows = null; }
  let cnt = 0;
  for (const b of B) if (b.c === 1 && b.fa != null && b.fa < 361) cnt++;
  if (!cnt) return;
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array([
     3.0,0,0,  -1.4,0,1.5,  -0.3,0,0.55,
     3.0,0,0,  -0.3,0,-0.55, -1.4,0,-1.5,
     3.0,0,0,  -0.3,0,0.55,  -0.3,0,-0.55 ]), 3));
  g.computeVertexNormals();
  const mat = new THREE.MeshBasicMaterial({ color:0xff3b30, side:THREE.DoubleSide });
  const im = new THREE.InstancedMesh(g, mat, cnt);
  const o = new THREE.Object3D(); let k = 0;
  const ty = (typeof terrainY === "function") ? terrainY : () => 0;
  for (const b of B) {
    if (!(b.c === 1 && b.fa != null && b.fa < 361)) continue;
    let cx = 0, cz = 0; for (const p of b.r) { cx += p[0]; cz += p[1]; }
    cx /= b.r.length; cz /= b.r.length;
    o.position.set(cx, b.h + 0.5 + ty(cx, cz), cz);
    o.rotation.set(0, -b.fa * Math.PI / 180, 0);
    o.scale.setScalar(1);
    o.updateMatrix(); im.setMatrixAt(k++, o.matrix);
  }
  im.instanceMatrix.needsUpdate = true;
  im.frustumCulled = false; im.renderOrder = 4; im.visible = false; im.userData.arrows = true;
  gArrows = im; scene.add(im);
}
if ($("tMuros")) $("tMuros").addEventListener("click", () => {
  const on = $("tMuros").getAttribute("aria-pressed") !== "true";
  $("tMuros").setAttribute("aria-pressed", String(on));
  if (window.__gMuros) window.__gMuros.visible = on;
});
if ($("tArrows")) $("tArrows").addEventListener("click", () => {
  const on = $("tArrows").getAttribute("aria-pressed") !== "true";
  $("tArrows").setAttribute("aria-pressed", String(on));
  if (gArrows) gArrows.visible = on;
});
function loadCity(data, label) {
  if (!data || !data.b) throw new Error("arquivo sem edificações");
  resetScene();
  GRID = data.b.length > 400000 ? 12 : 4;
  const { B, R, G, grp } = decode(data);
  if (!grp.length) throw new Error("city.json sem bl[] — rode pipeline/city_base.py");

  gGroups = groupsFrom(B, R, G, grp);
  // O lancamento entra como grupo de UM predio, e depois do groupsFrom de proposito: ele
  // nao esta no city.json (nao existe na foto de satelite) e nao caberia na fatia
  // contigua de B, que e indexada por [inicio, quantidade].
  for (const u of _UNIDADES) {
    const bs = recsDoLancamento(u);
    if (!bs.length) continue;
    const an = anelDoLote(u);
    // O raio sai dos BLOCOS, nao do retangulo do cadastro: com ala em L ou torre gemea
    // o conjunto passa longe do envelope, e um raio curto faria o streaming descartar o
    // grupo com metade do empreendimento ainda na tela.
    let rad = an.rad;
    for (const b of bs)
      rad = Math.max(rad, Math.hypot(b._cx - an.cx, b._cz - an.cz) + b._rad);
    gGroups.push({ cx: an.cx, cz: an.cz, rad: rad + 2, B: bs, R: [], G: [] });
  }
  indexaBusca(B, R);        // v12: a busca sai do dado ja decodificado, sem reler nada
  montaBaseMinimapa(R);
  indexaAsfalto(R);   // a arvore nao pode nascer no asfalto de NENHUMA via
  buildFacingArrows(B);

  // A extensao vem do dado inteiro, nao do que esta montado: senao o
  // enquadramento mudaria sozinho conforme o streaming entra e sai.
  let minX=1e9,maxX=-1e9,minZ=1e9,maxZ=-1e9;
  for (const g of gGroups) {
    minX=Math.min(minX,g.cx-g.rad); maxX=Math.max(maxX,g.cx+g.rad);
    minZ=Math.min(minZ,g.cz-g.rad); maxZ=Math.max(maxZ,g.cz+g.rad);
  }
  frame0(Math.max(4, Math.round(Math.max(maxX-minX, maxZ-minZ)/TILE_M)));

  // A malha viaria inteira, fina, numa unica chamada de desenho: da contexto pro
  // que ainda nao montou e permite tracar rota atravessando a cidade sem exigir
  // que a cidade toda esteja construida.
  const ctx = buildStreetContext(R);
  if (ctx) { gRoad.add(ctx); }

  // Comeca olhando um bairro, nao a cidade: o enquadramento de cidade inteira do
  // v3 mostraria chao vazio. Valor absoluto, nao fracao de STREAM_R -- o raio de
  // montagem existe pra o usuario PODER afastar, nao pra ele comecar longe.
  sph.radius = Math.min(sph.radius, 480);
  streamReady = true;
  streamUpdate(true);
  lerLink();               // ?em=lat,lon&r&p&t: abre onde o link mandou, nao no centro

  phase.classList.remove("off");
  progTxt.textContent = `${gGroups.length} grupos · ${label}`;
  hideStatus();
}


/* ============================================================
   10. Inicio: a base da cidade vem de fora (v5)
   ============================================================ */
const CITY_URL = new URLSearchParams(location.search).get("city") || CITY_FILE;

async function fetchCity(url) {
  const r = await fetch(url, { cache: "force-cache" });
  if (!r.ok) throw new Error("HTTP " + r.status);
  // Content-Length vem do corpo COMPRIMIDO; o reader entrega bytes ja
  // descomprimidos. Num servidor com gzip os dois nao batem, entao a barra e
  // limitada a 100% e o texto mostra o que de fato chegou.
  const tot = +(r.headers.get("content-length") || 0);
  if (!r.body || !r.body.getReader) return r.json();

  const rd = r.body.getReader(), parts = [];
  let got = 0;
  for (;;) {
    const { done, value } = await rd.read();
    if (done) break;
    parts.push(value); got += value.length;
    const mb = (got / 1048576).toFixed(1).replace(".", ",");
    stM.textContent = tot ? `${mb} de ~${(tot/1048576).toFixed(1).replace(".", ",")} MB`
                          : `${mb} MB`;
    stI.style.width = tot ? `${8 + 62 * Math.min(1, got/tot)}%` : "45%";
  }
  const buf = new Uint8Array(got);
  let off = 0;
  for (const p of parts) { buf.set(p, off); off += p.length; }
  return JSON.parse(new TextDecoder().decode(buf));
}

async function boot() {
  frame0(4);
  // Duplo clique abre em file://, e ali fetch e bloqueado pela origem opaca.
  // A base vai embutida; a rede so entra se alguem pedir outra cidade por ?city=.
  const embutida = document.getElementById("__citydata");
  if (embutida && !new URLSearchParams(location.search).get("city")) {
    stK.textContent = "Reconstruindo a cidade";
    stM.textContent = "base embutida na pagina (v6)";
    stI.style.width = "45%";
    await new Promise(r => setTimeout(r, 50));
    try {
      loadCity(JSON.parse(embutida.textContent), "base embutida (v6 lotes)");
      return;
    } catch (e) {
      console.error("Base embutida invalida, tentando pela rede:", e);
    }
  }
  stK.textContent = "Baixando a base da cidade";
  stM.textContent = "Conectando";
  stI.style.width = "8%";
  try {
    const j = await fetchCity(CITY_URL);
    stI.style.width = "72%";
    stM.textContent = "Reconstruindo a cidade";
    await new Promise(r => setTimeout(r, 50));
    loadCity(j, CITY_URL === CITY_FILE ? "base local (v5)" : "base remota");
    return;
  } catch (e) {
    console.error("Falha ao carregar a base:", e);
    stK.textContent = "Nao consegui carregar a base da cidade";
    // O erro mais provavel aqui nao e rede: e abrir o arquivo com duplo clique.
    // Em file:// o fetch e bloqueado pela origem opaca, entao vale dizer isso
    // em vez de mostrar um "Failed to fetch" que nao ajuda ninguem.
    stM.textContent = location.protocol === "file:"
      ? "Abra por um servidor HTTP - file:// bloqueia a leitura do city.json."
      : (e.message || "Erro de rede");
    stI.style.width = "100%";
  }
}

/* ============================================================
   11. Ficha, câmera, controles, laço
   ============================================================ */
/* A FICHA GENERICA DE EDIFICACAO FOI REMOVIDA.

   Ate aqui, clicar em QUALQUER volume abria um cartao com pegada, pavimentos e altura,
   e um botao "Entrar na casa". Nenhum dos tres numeros e conhecido: a pegada e o
   contorno que o pipeline assentou no lote, o pavimento e `(h-1,1)/3,15` arredondado, e
   a altura vem do `building:levels` do OSM quando existe e de um chute por tipo quando
   nao. Anunciar isso numa ficha e apresentar estimativa como cadastro -- e a promessa
   de "entrar" numa casa que nao tem interior nenhum e pior ainda: o botao ate nascia
   escondido, mas a ficha inteira dizia que aquele volume era um imovel consultavel.

   A regra agora e uma so: **o mapa so abre ficha de imovel CADASTRADO**. Clicar num
   volume sem cadastro nao faz nada -- que e a resposta honesta, porque nao ha o que
   dizer sobre ele. O caminho de um imovel de verdade continua sendo o mesmo de sempre:
   vitrine -> `abreUnidade` -> `usheet` (ficha) -> "Entrar na visita 3D".            */

/* ============================================================
   11b. Imóveis para inspeção 3D (fonte pública: roca.com.br)
   Cada item traz lat/lon real do anúncio; px()/pz() (já definidos no
   topo do arquivo) convertem pro mesmo sistema de coordenadas do
   city.json, então o farol cai no prédio certo sem dado extra.
   ============================================================ */
// A VITRINE VEM DE FORA. Estes anuncios eram 6 imoveis de Sao Carlos escritos aqui
// dentro -- e no mapa de Araraquara apareciam do mesmo jeito, com bairro e preco de
// outro municipio. O bloco e opcional: cidade sem vitrine cadastrada recebe [].
const HOUSES = (function () {
  try { return JSON.parse(document.getElementById("__imoveis").textContent); }
  catch (e) { return []; }
})();

const brl = v => "R$ " + v.toLocaleString("pt-BR");

function flyTo(x, z, radius) {
  const x0 = target.x, z0 = target.z, r0 = sph.radius;
  const dx = x - x0, dz = z - z0, dr = radius - r0, t0 = performance.now(), dur = 900;
  // requestAnimationFrame sempre entrega um timestamp real no argumento — chamar step()
  // direto (sem passar por rAF) roda com now=undefined na primeira vez, o que vira NaN
  // em cascata (target/sph.radius = NaN) e quebra a câmera/render logo de cara.
  function step(now) {
    const t = Math.min(1, (now - t0) / dur);
    const e = t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2, 3)/2;   // easeInOutCubic
    target.x = x0 + dx*e; target.z = z0 + dz*e; sph.radius = r0 + dr*e;
    if (t < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

const hsheet = $("hsheet");
let HOUSE_ATUAL = null;   // o anuncio SEM planta que esta na ficha simples
function openHouseSheet(house) {
  const hx = px(house.lon), hz = pz(house.lat);
  HOUSE_ATUAL = { h: house, x: hx, z: hz };
  $("hTag").textContent = house.tipo === "aluguel" ? "Para alugar" : "À venda";
  $("hName").textContent = house.titulo;
  $("hAddr").textContent = house.bairro + " · São Carlos/SP";
  $("hPrice").textContent = brl(house.preco) + (house.tipo === "aluguel" ? "/mês" : "");
  $("hRooms").textContent = house.quartos ?? "—";
  $("hGar").textContent = house.vagas ?? "—";
  $("hLink").href = house.url;
  hsheet.classList.add("on");
  hsheet.classList.remove("min");
  usheet.classList.remove("on");
  closePoiSheet();
  houseBeacon.position.set(hx, 0, hz);
  houseBeacon.visible = true;
  flyTo(hx, hz, 190);
}
$("hx").addEventListener("click", () => { hsheet.classList.remove("on"); houseBeacon.visible = false; });
// O anuncio sem planta nao tem visita 3D, mas tem endereco -- e a vizinhanca dele e
// exatamente a mesma pergunta.
$("hPerto").addEventListener("click", () => {
  if (!HOUSE_ATUAL) return;
  const a = HOUSE_ATUAL;
  abrePerto({ x: a.x, z: a.z, nome: a.h.titulo,
              volta: () => { hsheet.classList.add("on"); hsheet.classList.remove("min");
                             houseBeacon.position.set(a.x, 0, a.z);
                             houseBeacon.visible = true;
                             flyTo(a.x, a.z, 190); } });
});

const housesBox = $("houses");
for (const h of HOUSES) {
  const el = document.createElement("div");
  el.className = "hitem";
  el.innerHTML = `<div class="t">${h.titulo}</div><div class="b">${h.bairro}</div>` +
    `<div class="p ${h.tipo === "aluguel" ? "rent" : "sale"}">${brl(h.preco)}${h.tipo === "aluguel" ? "/mês" : ""}</div>`;
  el.addEventListener("click", () => openHouseSheet(h));
  housesBox.appendChild(el);
}

/* ------------------------------------------------------------
   Navegação: botão esquerdo arrasta o mapa, direito gira a câmera.

   A câmera orbita o alvo, e o deslocamento dela é Spherical(r, phi, theta) =
   (senθ·senφ, cosφ, cosθ·senφ). Daí saem os dois eixos da tela projetados no
   chão, que é o que o arrasto precisa:

       direita da tela  = ( cosθ, 0, -senθ)
       fundo da tela    = (-senθ, 0, -cosθ)

   O código anterior girava o vetor de arrasto por -θ em vez de +θ. Com a
   câmera virada pro norte (θ=0) os dois dão no mesmo e parecia certo; em
   qualquer outro ângulo o arrasto saía torto e, meia volta depois, invertido.
   ------------------------------------------------------------ */
const PAN = 1, ORBIT = 2;
let drag = 0, lx = 0, ly = 0;
let dnX = 0, dnY = 0, moveu = 0;   // v9: separa clique de arrasto

canvas.addEventListener("pointerdown", e => {
  drag = (e.button === 2 || e.button === 1 || e.shiftKey) ? ORBIT : PAN;
  lx = e.clientX; ly = e.clientY;
  dnX = e.clientX; dnY = e.clientY; moveu = 0;
  canvas.setPointerCapture(e.pointerId);
  canvas.style.cursor = drag === PAN ? "grabbing" : "move";
});
function endDrag(e) {
  drag = 0; canvas.style.cursor = "";
  // Em pointercancel a captura já caiu sozinha; liberar de novo lança.
  if (e && e.pointerId != null && canvas.hasPointerCapture(e.pointerId))
    canvas.releasePointerCapture(e.pointerId);
}
canvas.addEventListener("pointerup", endDrag);
canvas.addEventListener("pointercancel", endDrag);

// Clique e apertar e soltar sem arrastar. Este ouvinte e registrado DEPOIS
// do endDrag, e a ordem de registro e a ordem de chamada: aqui `moveu` ja
// tem a resposta, mesmo com o `drag` zerado.
canvas.addEventListener("pointerup", e => {
  if (moveu || e.button === 2 || e.button === 1) return;
  if (INT.on) { if (INT.fp || INT.orbita) cliqueInterior(e); }
  else cliqueNaCidade(e);
});

canvas.addEventListener("pointermove", e => {
  if (!drag) return;
  const dx = e.clientX - lx, dy = e.clientY - ly;
  lx = e.clientX; ly = e.clientY;
  if (Math.abs(e.clientX - dnX) + Math.abs(e.clientY - dnY) > 4) moveu = 1;
  if (INT.on && !INT.orbita) {   // v9: dentro da casa o arrasto e olhar em volta
    FP.yaw -= dx*0.004;
    FP.pitch = Math.max(-1.25, Math.min(1.25, FP.pitch - dy*0.004));
    return;
  }
  if (drag === ORBIT) {
    sph.theta -= dx*0.005;
    sph.phi = Math.max(0.75, Math.min(1.15, sph.phi + dy*0.005));
  } else panBy(dx, dy);
});

// Arrastar leva a câmera pro lado oposto, então o chão acompanha o cursor.
// k = quanto de mundo cabe num pixel na distância do alvo. O eixo vertical
// divide ainda por cosφ porque a tela está inclinada sobre o chão: com a câmera
// mais rasante, cada pixel de altura cobre muito mais terreno. O piso de 0,25
// só existe pra proteger de divisão por ~zero se o limite de phi mudar.
function panBy(dx, dy) {
  const k  = 2 * sph.radius * Math.tan(camera.fov * Math.PI/360) / innerHeight;
  const kv = k / Math.max(0.25, Math.cos(sph.phi));
  const ct = Math.cos(sph.theta), st = Math.sin(sph.theta);
  const hx = k*dx, vy = kv*dy;
  target.x -= ct*hx + st*vy;
  target.z += st*hx - ct*vy;
}

canvas.addEventListener("contextmenu", e => e.preventDefault());
canvas.addEventListener("wheel", e => { e.preventDefault();
  if (INT.on && !INT.orbita) return;                   // v9: zoom nao vale a pe
  const rmin = INT.orbita ? 5 : 60;   // uma casa tem 8 m de frente, nao 60
  sph.radius = Math.max(rmin, Math.min(zoomMax(), sph.radius*(1 + Math.sign(e.deltaY)*0.11)));
}, { passive:false });

// No toque: um dedo arrasta (pelo pointermove acima), dois dedos dão zoom e
// giro. A rosca de dois dedos virou o único jeito de girar no celular agora
// que o arrasto de um dedo passou a mover o mapa.
let pd = 0, pa = 0;
canvas.addEventListener("touchmove", e => {
  if (e.touches.length !== 2) { pd = 0; return; }
  const a = e.touches[0], b = e.touches[1];
  const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
  const ang = Math.atan2(b.clientY - a.clientY, b.clientX - a.clientX);
  if (pd) {
    sph.radius = Math.max(60, Math.min(zoomMax(), sph.radius*pd/d));
    let da = ang - pa;
    if (da > Math.PI) da -= 2*Math.PI; else if (da < -Math.PI) da += 2*Math.PI;
    sph.theta += da;
  }
  pd = d; pa = ang; drag = 0;
}, { passive:true });
canvas.addEventListener("touchend", () => { pd = 0; });

$("hs").addEventListener("input", e => {
  const v = parseFloat(e.target.value);
  $("hv").textContent = v.toFixed(2).replace(".", ",") + "×";
  uHeight.value = v;
});
const toggle = (id, fn) => { const b = $(id);
  b.addEventListener("click", () => { const on = b.getAttribute("aria-pressed") !== "true";
    b.setAttribute("aria-pressed", String(on)); fn(on); }); };
let showLab = true;

toggle("tLab", on => { showLab = on; sujaRotulos(); if (!on) for (const l of labels) l.el.style.display = "none"; });
$("tHome").addEventListener("click", () => {
  saiSeco();                       // v9: o Centro tambem e a saida da casa
  fechaPerto(false);               // v13: ...e a saida do "o que tem por perto"
  setPins(false);                  // ...e apaga o pino que a busca tenha acendido
  target.set(0,0,0); sph.set(HALF*0.55, 0.98, 0.55);
  hsheet.classList.remove("on"); usheet.classList.remove("on");
  houseBeacon.visible = false;
  closePoiSheet();
});
$("compass").addEventListener("click", () => { sph.theta = 0; });

/* ============================================================
   11a. Relevo: alterna entre cidade plana e terreno aproximado
   ============================================================ */
async function fetchElevation(onProgress) {
  const N = ELEV_N, pts = [];
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const x = -ELEV_HALF + i/(N-1)*2*ELEV_HALF, z = -ELEV_HALF + j/(N-1)*2*ELEV_HALF;
    pts.push([CENTER.lat - z/MLAT, CENTER.lon + x/MLON]);
  }
  const out = new Float32Array(N*N), BATCH = 100, total = Math.ceil(pts.length/BATCH);
  for (let s = 0, b = 0; s < pts.length; s += BATCH, b++) {
    const chunk = pts.slice(s, s+BATCH);
    const locs = chunk.map(p => p[0].toFixed(5) + "," + p[1].toFixed(5)).join("|");
    if (onProgress) onProgress(b, total);
    let r;
    try { r = await timed("https://api.open-elevation.com/api/v1/lookup?locations=" + locs, 15000); }
    catch (e) { await sleep(1200); r = await timed("https://api.open-elevation.com/api/v1/lookup?locations=" + locs, 15000); }
    if (!r.ok) throw new Error("HTTP " + r.status);
    const j = await r.json();
    j.results.forEach((res, k) => out[s+k] = res.elevation || 0);
    if (s + BATCH < pts.length) await sleep(350);
  }
  // A API de elevação livre às vezes devolve UM ponto isolado ruim (bem diferente de
  // todos os vizinhos). Mediana 3x3 de 1 passada só descarta esse tipo de outlier
  // pontual, sem achatar o relevo real (a causa do prédio sumir era o frustum culling
  // desatualizado — ver frustumCulled=false na malha do prédio — não os dados de
  // elevação; um filtro mais forte aqui só destruía relevo de verdade à toa).
  const smooth = medianGrid(out, N, 1);
  const c = smooth[Math.round((N-1)/2)*N + Math.round((N-1)/2)];
  for (let i = 0; i < smooth.length; i++) smooth[i] -= c;
  return smooth;
}
function medianGrid(src, N, radius) {
  const out2 = new Float32Array(N*N);
  const win = [];
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    win.length = 0;
    for (let dj = -radius; dj <= radius; dj++) for (let di = -radius; di <= radius; di++) {
      const ii = i+di, jj = j+dj;
      if (ii < 0 || ii >= N || jj < 0 || jj >= N) continue;
      win.push(src[jj*N+ii]);
    }
    win.sort((a,b) => a-b);
    out2[j*N+i] = win[win.length >> 1];
  }
  return out2;
}
function recomputeAllDy() {
  for (const geo of terrainRegistry) {
    const t = geo.userData.terrain, pos = geo.attributes.position, ctr = geo.userData.presetCenter;
    // Prédio recalcula pelo centro da edificação (mesmo valor pra todo mundo dela), não
    // pela posição de cada vértice — mantém o telhado nivelado (ver buildBuildings).
    if (ctr) for (let i = 0; i < pos.count; i++) t.dy[i] = terrainY(ctr[i*2], ctr[i*2+1]);
    else for (let i = 0; i < pos.count; i++) t.dy[i] = terrainY(pos.getX(i), pos.getZ(i));
    if (geo.attributes.aDY) geo.attributes.aDY.needsUpdate = true;
  }
  // v10: arvore nao tem mais laco proprio aqui. Ela deixou de ser InstancedMesh e
  // virou malha mesclada com presetCenter (o pe do tronco), entao o laco de cima ja
  // recalcula o dy dela junto do resto. `treeRegistry` sobrou so pra visibilidade
  // por regiao no frame().
}
// Guarda a grade de elevação já baixada no navegador pra não ter que buscar de novo
// na API a cada F5 — só refaz o download se a cidade (centro) ou o tamanho da grade mudar.
const ELEV_CACHE_KEY = `elevGrid_v3_${CENTER.lat}_${CENTER.lon}_${ELEV_N}_${ELEV_HALF}`;
function loadElevCache() {
  const t = document.getElementById("__elevdata");
  if (t) {
    try {
      const a = JSON.parse(t.textContent);
      if (Array.isArray(a) && a.length === ELEV_N*ELEV_N) return Float32Array.from(a);
    } catch (e) { console.error("Grade de relevo embutida invalida:", e); }
  }
  try {
    const raw = localStorage.getItem(ELEV_CACHE_KEY);
    if (!raw) return null;
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr) || arr.length !== ELEV_N*ELEV_N) return null;
    return Float32Array.from(arr);
  } catch (e) { return null; }
}
function saveElevCache(grid) {
  try { localStorage.setItem(ELEV_CACHE_KEY, JSON.stringify(Array.from(grid))); }
  catch (e) { /* localStorage cheio/indisponível — segue sem cache */ }
}
let elevLoading = false;
toggle("tRelief", async on => {
  if (on && !elevGrid && !elevLoading) {
    elevLoading = true;
    const btn = $("tRelief");
    btn.disabled = true;
    try {
      const cached = loadElevCache();
      if (cached) {
        elevGrid = cached;
      } else {
        elevGrid = await fetchElevation((b, total) => { btn.textContent = `Relevo ${b+1}/${total}`; });
        saveElevCache(elevGrid);
      }
      recomputeAllDy();
    } catch (e) {
      console.error("Relevo:", e);
      btn.setAttribute("aria-pressed", "false");
      elevLoading = false; btn.disabled = false; btn.textContent = "Relevo";
      return;
    }
    btn.disabled = false; btn.textContent = "Relevo";
    elevLoading = false;
  }
  reliefTarget = on ? 1 : 0;
  reliefAmount = reliefTarget;
  uRelief.value = reliefAmount;
  for (const geo of terrainRegistry) applyTerrainToGeo(geo, reliefAmount, true);
  recalcDyRotulos();
  recalcDyPois(); sujaPois();
  arvSujo = true; arvTotal = true;   // arvore, portao e sombra levam o relevo na
  somSujo = true;                    // matriz da instancia, nao no vertice
});

/* Nível de gráficos, à mão. Recarrega de propósito: antialias e buffer logarítmico são
   atributos do contexto WebGL, e trocar qualquer um dos dois exige um contexto novo --
   não há como aplicar sem reconstruir a página. O que o botão faz é gravar a escolha e
   recarregar; a resolução dentro do nível continua a cargo do governador. */
const ORDEM_QUAL = ["alto", "medio", "baixo"];
function atualizaBotaoQual() {
  const b = $("tQual");
  if (!b) return;
  const grav = guarda.le("mapa3d.qual");
  // Rebaixado pelo governador mas ainda não recarregado: dizer isso é mais honesto que
  // mostrar o nível em uso e deixar a próxima abertura parecer um bug.
  b.textContent = grav && grav !== NIVEL_NOME
    ? "Gráficos: " + grav + " ⟳" : "Gráficos: " + NIVEL_NOME;
  b.title = grav && grav !== NIVEL_NOME
    ? `Rodando em "${NIVEL_NOME}", mas não segurou 30 FPS. Clique pra recarregar em "${grav}".`
    : "Nível de gráficos (recarrega a página)";
}
atualizaBotaoQual();
$("tQual").addEventListener("click", () => {
  const grav = guarda.le("mapa3d.qual");
  const prox = grav && grav !== NIVEL_NOME ? grav
             : ORDEM_QUAL[(ORDEM_QUAL.indexOf(NIVEL_NOME) + 1) % ORDEM_QUAL.length];
  guarda.grava("mapa3d.qual", prox);
  // O ?q= da URL venceria o que acabou de ser gravado; tirar dali é o que faz o botão
  // funcionar numa página aberta com ?q=alto pra teste.
  const u = new URL(location.href);
  u.searchParams.delete("q");
  location.replace(u.toString());
});

/* ============================================================
   11c. Estabelecimentos: supermercados, mercados, farmacias e saude
   Dataset fixo (OSM, ver build_pois.py) embutido em #__poidata. Cada
   ponto ganha tres camadas: um halo no chao, um feixe vertical e um
   marcador HTML com icone e nome que encolhe conforme a camera afasta.
   ============================================================ */
const ICO = {
  cart:  '<circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2 2h2l2.7 12.4a2 2 0 0 0 2 1.6h9.8a2 2 0 0 0 1.9-1.6L22 7H5.1"/>',
  pack:  '<path d="m7.5 4.3 9 5.1"/><path d="M21 8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>',
  basket:'<path d="m15 11-1 9"/><path d="m19 11-4-7"/><path d="M2 11h20"/><path d="m3.5 11 1.6 7.4a2 2 0 0 0 2 1.6h9.8a2 2 0 0 0 2-1.6l1.7-7.4"/><path d="m5 11 4-7"/><path d="m9 11 1 9"/>',
  pill:  '<path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/><path d="m8.5 8.5 7 7"/>',
  hosp:  '<path d="M12 6v4"/><path d="M14 14h-4"/><path d="M14 18h-4"/><path d="M14 8h-4"/><path d="M18 12h2a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2h2"/><path d="M18 22V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v18"/>',
  pulse: '<path d="M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7Z"/><path d="M3.2 13h6.3l.5-1 2 4.5 2-7 1.5 3.5h5.3"/>',
  shield:'<path d="M20 13c0 5-3.5 7.5-7.7 9a1 1 0 0 1-.7 0C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.2-2.7a1.2 1.2 0 0 1 1.5 0C14.5 3.8 17 5 19 5a1 1 0 0 1 1 1z"/><path d="M9 12h6"/><path d="M12 9v6"/>',
  clinic:'<path d="M12 10v6"/><path d="M9 13h6"/><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  utensils:'<path d="M3 2v7c0 1.1.9 2 2 2h.5a.5.5 0 0 1 .5.5V22"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Z"/><path d="M21 15v7"/>',
  coffee:'<path d="M10 2v2"/><path d="M14 2v2"/><path d="M6 2v2"/><path d="M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1"/>',
  bread:'<path d="M4 11h16a1 1 0 0 1 1 1 5 5 0 0 1-5 5H8a5 5 0 0 1-5-5 1 1 0 0 1 1-1z"/><path d="M8 11a4 4 0 0 1 8 0"/>',
  bank:'<line x1="3" x2="21" y1="22" y2="22"/><line x1="6" x2="6" y1="18" y2="11"/><line x1="10" x2="10" y1="18" y2="11"/><line x1="14" x2="14" y1="18" y2="11"/><line x1="18" x2="18" y1="18" y2="11"/><polygon points="12 2 20 7 4 7"/>',
  grad:'<path d="M22 10 12 5 2 10l10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>',
  fuel:'<line x1="3" x2="15" y1="22" y2="22"/><line x1="4" x2="14" y1="9" y2="9"/><path d="M14 22V4a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v18"/><path d="M14 13h2a2 2 0 0 1 2 2v2a2 2 0 0 0 4 0V9.8a2 2 0 0 0-.6-1.4L18 5"/>',
  bed:'<path d="M2 4v16"/><path d="M2 8h18a2 2 0 0 1 2 2v10"/><path d="M2 17h20"/><path d="M6 8v9"/>',
  church:'<path d="M10 9h4"/><path d="M12 7v5"/><path d="M14 22v-4a2 2 0 0 0-4 0v4"/><path d="m18 22 .01-8.5a2 2 0 0 0-.9-1.7L12 8 6.9 11.8a2 2 0 0 0-.9 1.7L6 22"/>',
  dumbbell:'<path d="m6.5 6.5 11 11"/><path d="m21 21-1-1"/><path d="m3 3 1 1"/><path d="m18 22 4-4"/><path d="m2 6 4-4"/><path d="m3 10 7-7"/><path d="m14 21 7-7"/>',
  store:'<path d="m2 7 4.4-4.4A2 2 0 0 1 7.8 2h8.3a2 2 0 0 1 1.4.6L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M2 7h20"/>',
  building:'<rect width="16" height="20" x="4" y="2" rx="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01M16 6h.01M12 6h.01M12 10h.01M12 14h.01M16 10h.01M8 10h.01M8 14h.01M16 14h.01"/>',
  camera:'<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z"/><circle cx="12" cy="13" r="3"/>',
  wrench:'<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-7.9 7.9l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 7.9-7.9z"/>',
};
// Ordem do objeto = ordem dos filtros na barra e prioridade de desempate quando
// dois marcadores se sobrepoem na tela (saude ganha de mercearia).
const CAT = {
  upa:          { lbl:"UPAs",             curto:"UPA / Pronto-socorro", col:"#FF3D5A", ic:ICO.pulse  },
  hospital:     { lbl:"Hospitais",             curto:"Hospital",       col:"#FF6FA5", ic:ICO.hosp   },
  unimed:       { lbl:"Unimed",                curto:"Unimed",         col:"#00C97B", ic:ICO.shield },
  ubs:          { lbl:"Postos de saúde",       curto:"Posto de saúde", col:"#3FB6F5", ic:ICO.clinic },
  farmacia:     { lbl:"Farmácias",             curto:"Farmácia",       col:"#2FE0C8", ic:ICO.pill   },
  supermercado: { lbl:"Supermercados",         curto:"Supermercado",   col:"#FFC53D", ic:ICO.cart   },
  atacado:      { lbl:"Atacados",              curto:"Atacado",        col:"#FF9E1B", ic:ICO.pack   },
  mercado:      { lbl:"Mercados",         curto:"Mercado / feira",      col:"#B98CFF", ic:ICO.basket },
  comida:    { lbl:'Restaurantes', curto:'Restaurante', col:'#FF7A45', ic:ICO.utensils },
  cafebar:   { lbl:'Cafés & Bares', curto:'Café / Bar', col:'#D98E4A', ic:ICO.coffee },
  padaria:   { lbl:'Padarias', curto:'Padaria', col:'#E7C24A', ic:ICO.bread },
  banco:     { lbl:'Bancos', curto:'Banco', col:'#4DA3FF', ic:ICO.bank },
  escola:    { lbl:'Escolas', curto:'Escola / Educação', col:'#63D2A0', ic:ICO.grad },
  posto:     { lbl:'Postos', curto:'Posto de combustível', col:'#FF5A5A', ic:ICO.fuel },
  hotel:     { lbl:'Hotéis', curto:'Hotel / Pousada', col:'#9B8CFF', ic:ICO.bed },
  igreja:    { lbl:'Igrejas', curto:'Igreja / Templo', col:'#B7A588', ic:ICO.church },
  academia:  { lbl:'Academias', curto:'Academia / Esporte', col:'#59D0E0', ic:ICO.dumbbell },
  loja:      { lbl:'Lojas', curto:'Loja / Comércio', col:'#C6D24A', ic:ICO.store },
  turismo:   { lbl:'Turismo & Cultura', curto:'Turismo / Cultura', col:'#E85D9C', ic:ICO.camera },
  publico:   { lbl:'Serviços públicos', curto:'Serviço público', col:'#8FA6BC', ic:ICO.building },
  servico:   { lbl:'Serviços', curto:'Serviço', col:'#9AA0A6', ic:ICO.wrench },
};
const CAT_KEYS = Object.keys(CAT);
CAT_KEYS.forEach((k, i) => { CAT[k].pri = i; CAT[k].hex = parseInt(CAT[k].col.slice(1), 16); });

const POI_Y = 24;            // altura do topo do feixe, onde o marcador HTML se ancora
const POI_MAX = 4200;        // alem disso o marcador some (a cidade toda vira sopa de icones)
const POI_NAME = 1400;       // ate essa distancia o marcador mostra o nome, depois so o icone
const POI_HALO = 30;         // raio do halo no chao, em metros

const esc = t => String(t).replace(/[&<>"]/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;" }[c]));

const poiRaw = (() => {
  try { return JSON.parse($("__poidata").textContent); } catch (e) { return []; }
})();
const POIS = poiRaw.map(p => Object.assign({}, p, {
  x: px(p.lon), z: pz(p.lat), cfg: CAT[p.c] || CAT.mercado,
  v: new THREE.Vector3(), sx:0, sy:0, d:0, nw:0, dy:0, el:null
}));
// Quem e de cada categoria. A lista nao muda em toda a sessao, e quem a percorre por
// quadro e o minimapa -- que precisa de um caminho POR COR, nao de um por ponto.
const POI_POR_CAT = (() => {
  const m = {};
  for (const p of POIS) (m[p.c] || (m[p.c] = [])).push(p);
  return m;
})();
// Mesmo caso do rotulo de rua: o estabelecimento nao anda, entao amostrar terrainY nos
// 1.197 POIs a cada quadro era refazer sempre a mesma conta. So o botao Relevo invalida.
function recalcDyPois() { for (const p of POIS) p.dy = terrainY(p.x, p.z); }
recalcDyPois();
// Camera parada = marcador parado. Ver a guarda no updatePois.
const _poiCam = new THREE.Vector3(1e9, 0, 1e9);
let _poiW = 0, _poiH = 0, _poiRel = -1, _poiSelAnt = 0, _poiSujo = true;
function sujaPois() { _poiSujo = true; }

/* --- camada 3D: halo no chao + feixe vertical, uma malha por categoria --- */
const glowTex = (() => {
  const N = 128, cv = document.createElement("canvas");
  cv.width = cv.height = N;
  const g = cv.getContext("2d"), rad = g.createRadialGradient(N/2, N/2, 0, N/2, N/2, N/2);
  rad.addColorStop(0, "rgba(255,255,255,.85)");
  rad.addColorStop(.45, "rgba(255,255,255,.28)");
  rad.addColorStop(.78, "rgba(255,255,255,.07)");
  rad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = rad; g.fillRect(0, 0, N, N);
  const t = new THREE.CanvasTexture(cv);
  t.minFilter = THREE.LinearFilter;
  return t;
})();

const gPoi = new THREE.Group();
scene.add(gPoi);
const poiLayer = {};

function buildPoiLayer() {
  const byCat = new Map();
  for (const p of POIS) {
    if (!byCat.has(p.c)) byCat.set(p.c, []);
    byCat.get(p.c).push(p);
  }
  for (const [cat, list] of byCat) {
    const col = new THREE.Color(CAT[cat].hex), R = POI_HALO;
    const HP = [], HU = [], HC = [], HDY = [], HXZ = [];
    const LP = [], LC = [], LDY = [], LXZ = [];
    for (const p of list) {
      const y = terrainY(p.x, p.z);
      // halo: um quadrado deitado com a textura de brilho radial
      const quad = [[-R,-R,0,0],[R,-R,1,0],[R,R,1,1],[-R,-R,0,0],[R,R,1,1],[-R,R,0,1]];
      for (const c of quad) {
        HP.push(p.x + c[0], 0.55, p.z + c[1]); HU.push(c[2], c[3]);
        HC.push(col.r, col.g, col.b); HDY.push(y); HXZ.push(p.x, p.z);
      }
      // feixe: linha do chao ate o marcador, apagando conforme sobe
      LP.push(p.x, 0.6, p.z, p.x, POI_Y, p.z);
      LC.push(col.r, col.g, col.b, col.r*0.22, col.g*0.22, col.b*0.22);
      LDY.push(y, y); LXZ.push(p.x, p.z, p.x, p.z);
      // anel no chao marcando o ponto exato
      const N = 28, r = 6.5;
      for (let i = 0; i < N; i++) {
        const a0 = i/N*Math.PI*2, a1 = (i+1)/N*Math.PI*2;
        LP.push(p.x + Math.cos(a0)*r, 0.6, p.z + Math.sin(a0)*r,
                p.x + Math.cos(a1)*r, 0.6, p.z + Math.sin(a1)*r);
        LC.push(col.r, col.g, col.b, col.r, col.g, col.b);
        LDY.push(y, y); LXZ.push(p.x, p.z, p.x, p.z);
      }
    }
    const hg = new THREE.BufferGeometry();
    hg.setAttribute("position", new THREE.Float32BufferAttribute(HP, 3));
    hg.setAttribute("uv", new THREE.Float32BufferAttribute(HU, 2));
    hg.setAttribute("color", new THREE.Float32BufferAttribute(HC, 3));
    hg.userData.presetDY = new Float32Array(HDY);
    hg.userData.presetCenter = new Float32Array(HXZ);
    const halo = new THREE.Mesh(hg, new THREE.MeshBasicMaterial({
      map: glowTex, vertexColors: true, transparent: true, opacity: 0.62,
      depthWrite: false, blending: THREE.AdditiveBlending }));
    halo.renderOrder = 3; halo.frustumCulled = false;

    const lg = new THREE.BufferGeometry();
    lg.setAttribute("position", new THREE.Float32BufferAttribute(LP, 3));
    lg.setAttribute("color", new THREE.Float32BufferAttribute(LC, 3));
    lg.userData.presetDY = new Float32Array(LDY);
    lg.userData.presetCenter = new Float32Array(LXZ);
    // depthTest desligado: quase todo POI cai DENTRO do contorno de um predio, e com
    // teste de profundidade o feixe simplesmente nao apareceria. A opacidade baixa
    // mantem o efeito de facho de luz em vez de risco por cima da cena.
    const beam = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({
      vertexColors: true, transparent: true, opacity: 0.5,
      depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending }));
    beam.renderOrder = 4; beam.frustumCulled = false;

    hg.userData.poi = true; lg.userData.poi = true;
    registerTerrain(hg); registerTerrain(lg);
    gPoi.add(halo, beam);
    poiLayer[cat] = [halo, beam];
  }
}
buildPoiLayer();

/* --- marcadores HTML --- */
const catOn = {};
let poiSel = null;

const psheet = $("psheet");
function closePoiSheet() {
  psheet.classList.remove("on");
  if (poiSel) { poiSel.el.classList.remove("sel"); poiSel = null; }
}
function openPoiSheet(p) {
  // Com o pino apagado (o padrao do v13) o marcador do POI nao existe na tela -- e
  // esta ficha pode vir da BUSCA, que nao passa pelo "por perto". Acender aqui e o
  // que faz "procurei a farmacia pelo nome" mostrar a farmacia.
  //
  // Os DOIS interruptores, nao so o grupo: depois de uma passada pelo "por perto" as
  // categorias ficam todas desligadas, e `updatePois` esconde marcador de categoria
  // desligada. Só `setPins` deixava a busca levando a camera pra um pino invisivel.
  setPins(true);
  aplicaCat(p.c, true);
  if (poiSel) poiSel.el.classList.remove("sel");
  poiSel = p; p.el.classList.add("sel");
  psheet.style.setProperty("--pc", p.cfg.col);
  $("pIc").innerHTML = '<svg viewBox="0 0 24 24">' + p.cfg.ic + '</svg>';
  $("pTag").textContent = p.cfg.curto;
  $("pName").textContent = p.n;
  const rows = [["Endereço", p.a], ["Horário", p.h], ["Telefone", p.t], ["Site", p.w]]
    .filter(r => r[1]);
  if (!p.a) rows.unshift(["Endereço", "não mapeado no OSM"]);
  $("pMeta").innerHTML = rows.map(r => '<div><span>' + r[0] + '</span>' + esc(r[1]) + '</div>').join("");
  $("pLink").href = "https://www.google.com/maps/dir/?api=1&destination=" + p.lat + "," + p.lon;
  psheet.classList.add("on");
  // Fora do "por perto", abrir a ficha de um lugar fecha a do imovel. DENTRO dele, a
  // tira fica: e ela que responde "perto de que?" -- e o CSS empilha as duas no rodape.
  if (!PERTO.on) { hsheet.classList.remove("on"); usheet.classList.remove("on"); }
  else minimizaFicha(true);
  // Dentro do "por perto" o farol NAO se apaga: e ele que continua dizendo qual dos
  // pontos do mapa e o imovel enquanto se olha os estabelecimentos em volta.
  if (!PERTO.on) houseBeacon.visible = false;
  flyTo(p.x, p.z, Math.min(sph.radius, 320));
}
$("px").addEventListener("click", () => {
  closePoiSheet();
  // Dentro do "por perto" o mapa continua aceso (foi pra isso que se entrou); fora
  // dele, o pino so estava ligado por causa DESTA ficha, e sem o botao Pins na tela
  // esta e a unica forma de apaga-lo.
  if (!PERTO.on) setPins(false);
});

for (const p of POIS) {
  const el = document.createElement("div");
  el.className = "poi";
  el.style.setProperty("--pc", p.cfg.col);
  el.innerHTML = '<div class="ic"><svg viewBox="0 0 24 24">' + p.cfg.ic + '</svg></div>' +
                 '<div class="nm">' + esc(p.n) + '</div>';
  el.style.display = "none";
  el.addEventListener("click", () => openPoiSheet(p));
  overlay.appendChild(el);
  p.el = el;
}
// Larguras medidas de uma vez so: ler offsetWidth marcador a marcador dentro do
// laco de render forcaria um reflow por quadro.
requestAnimationFrame(() => {
  for (const p of POIS) { p.el.style.display = "flex"; p.nw = p.el.offsetWidth; p.el.style.display = "none"; }
});

/* --- categorias: quem liga e desliga --------------------------------------
   A barra de chips do topo saiu da tela no v12 e NAO volta: o filtro agora e a coluna
   do "O que tem por perto?", logo abaixo, que so existe com um imovel escolhido.
   `catOn` continua sendo a fonte da verdade -- o que mudou foi quem escreve nele. */
const nChips = {};                       // categoria -> botao da coluna
for (const k of CAT_KEYS) if (POIS.some(p => p.c === k)) catOn[k] = true;

function aplicaCat(k, on) {
  if (!(k in catOn)) return;
  catOn[k] = on;
  sujaPois();
  for (const o of (poiLayer[k] || [])) o.visible = on;
  if (!on && poiSel && poiSel.c === k) closePoiSheet();
  if (nChips[k]) nChips[k].setAttribute("aria-pressed", String(on));
}

/* O PINO NASCE APAGADO (v13). Abrir a cidade com mil e duzentos marcadores acesos poe
   na frente do usuario justamente o que ele ainda nao veio ver: o estabelecimento so
   interessa DEPOIS de escolher um imovel. Tres coisas acendem, e nenhuma delas e o
   boot: o "O que tem por perto?", a busca (quem procura uma farmacia pelo nome quer ver
   o pino dela) e o botao Pins, que segue existindo como orfao. */
let poiHidden = true;
gPoi.visible = false;
$("tPins").setAttribute("aria-pressed", "false");
function setPins(on) {
  on = !!on;
  $("tPins").setAttribute("aria-pressed", String(on));
  if (on === !poiHidden) return;
  poiHidden = !on; gPoi.visible = on; sujaPois();
  if (poiHidden && poiSel) closePoiSheet();
}
$("tPins").addEventListener("click",
  () => setPins($("tPins").getAttribute("aria-pressed") !== "true"));

/* --- a coluna "O que tem por perto?" --------------------------------------
   O modo tem dono: um imovel. Ele centraliza a camera nele, abre o campo de visao pra
   caber a vizinhanca, acende os pinos e mostra ESTA coluna -- e sair dele apaga os
   pinos de novo. A contagem e por RAIO, nao pela cidade inteira: "12 farmacias" so
   responde "o que tem por perto" se as 12 estiverem perto. */
const PERTO_R = 1000;              // o raio da pergunta, em metros
const PERTO_ZOOM = 900;            // a que distancia a camera para depois de abrir
const nearbyBox = $("nearby");
const nList = $("nList");
for (const k of CAT_KEYS) {
  if (!(k in catOn)) continue;
  const b = document.createElement("button");
  b.className = "ncat";
  b.setAttribute("aria-pressed", "true");
  b.style.setProperty("--pc", CAT[k].col);
  b.title = CAT[k].lbl + " \u2014 clique para mostrar ou esconder no mapa";
  b.innerHTML = '<i></i><span>' + CAT[k].lbl + '</span><b>0</b>';
  b.addEventListener("click", () => aplicaCat(k, b.getAttribute("aria-pressed") !== "true"));
  nChips[k] = b;
  nList.appendChild(b);
}
$("nAll").addEventListener("click", () => { for (const k in nChips) aplicaCat(k, true); });
$("nNone").addEventListener("click", () => { for (const k in nChips) aplicaCat(k, false); });

function contaPerto(x, z) {
  const n = {}, R2 = PERTO_R * PERTO_R;
  for (const p of POIS) {
    const dx = p.x - x, dz = p.z - z;
    if (dx*dx + dz*dz <= R2) n[p.c] = (n[p.c] || 0) + 1;
  }
  return n;
}

const PERTO = { on: false, volta: null };
// ctx: { x, z, nome, volta } -- `volta` e o que reabre a ficha de onde se veio.
function abrePerto(ctx) {
  PERTO.on = true; PERTO.volta = ctx.volta || null;
  document.body.classList.add("perto");
  const n = contaPerto(ctx.x, ctx.z);
  // Mais perto primeiro. Ordem fixa esconderia a diferenca entre um apartamento no
  // centro e um no anel externo, que e exatamente o que a pergunta quer ver.
  // appendChild de um elemento que JA esta no pai e uma mudanca de lugar, nao uma
  // copia: a lista se reordena sem recriar botao nem perder o ligado/desligado.
  const ord = Object.keys(nChips)
    .sort((a, b) => (n[b] || 0) - (n[a] || 0) || CAT[a].pri - CAT[b].pri);
  let total = 0;
  for (const k of ord) {
    const b = nChips[k];
    b.querySelector("b").textContent = n[k] || 0;
    b.classList.toggle("vazio", !n[k]);
    // TODAS APAGADAS ao abrir. Acender as 21 de uma vez devolve a sopa de icone que o
    // pino apagado no boot foi feito pra evitar -- so que agora em cima do imovel. A
    // coluna passa a ser a pergunta ("me mostre farmacia"), nao a faxina.
    aplicaCat(k, false);
    nList.appendChild(b);
    total += n[k] || 0;
  }
  const raio = PERTO_R >= 1000 ? (PERTO_R / 1000).toLocaleString("pt-BR") + " km"
                               : PERTO_R + " m";
  $("nSub").textContent = total + " estabelecimento" + (total === 1 ? "" : "s") +
    " a menos de " + raio + " de " + (ctx.nome || "aqui") +
    ". Clique numa categoria para mostr\u00e1-la no mapa.";
  $("nBack").hidden = !PERTO.volta;
  nearbyBox.classList.add("on");
  setPins(true);
  // A ficha do imovel NAO fecha: encolhe pra tira e fica no mesmo canto de sempre.
  // Fechar apagava a resposta de "perto de QUE?" no instante em que ela passa a
  // importar -- e, com o mapa cheio de pino, o nome na tira e o unico texto que ainda
  // diz de quem e o farol. Uma das duas esta aberta; a classe na outra e inerte.
  minimizaFicha(true);
  closePoiSheet();
  // O farol fica ACESO o tempo todo aqui: sem ele, um mapa cheio de pino nao diz mais
  // qual dos pontos e o imovel.
  houseBeacon.position.set(ctx.x, 0, ctx.z);
  houseBeacon.visible = true;
  target.set(ctx.x, 0, ctx.z);
  streamUpdate(true);
  flyTo(ctx.x, ctx.z, PERTO_ZOOM);
}
// A tira e um estado da ficha, nao uma segunda ficha: o mesmo cartao, com `min`. Uma
// das duas esta aberta de cada vez; a classe na outra e inerte.
function minimizaFicha(sim) {
  sim = !!sim;
  usheet.classList.toggle("min", sim);
  hsheet.classList.toggle("min", sim);
  const seta = sim ? "\u25b4" : "\u25be";
  $("uDobra").textContent = seta;
  $("hDobra").textContent = seta;
}
function fechaPerto(voltando) {
  if (!PERTO.on) return;
  PERTO.on = false;
  document.body.classList.remove("perto");
  nearbyBox.classList.remove("on");
  setPins(false);
  closePoiSheet();
  minimizaFicha(false);
  if (voltando && PERTO.volta) PERTO.volta();
  else {
    // O x da coluna sai do modo E limpa o mapa. Como a ficha ficou aberta (minimizada)
    // o tempo todo, agora e aqui que ela fecha de verdade.
    usheet.classList.remove("on"); hsheet.classList.remove("on");
    houseBeacon.visible = false;
  }
}
$("nx").addEventListener("click", () => fechaPerto(false));
$("nBack").addEventListener("click", () => fechaPerto(true));
// Clicar na tira reabre a ficha inteira, sem sair do "por perto" (a coluna continua a
// esquerda). O `x` segue FECHANDO: o teste pelo alvo e o que separa os dois cliques,
// ja que o do `x` sobe por este mesmo cartao.
// `$` e nao as constantes `usheet`/`hsheet`: estes ouvintes sao registrados na
// inicializacao do modulo, e a constante `usheet` so e avaliada 500 linhas abaixo --
// le-la aqui estoura na zona morta e derruba a pagina antes do primeiro quadro.
for (const g of [$("uDobra"), $("hDobra")])
  g.addEventListener("click", e => {
    e.stopPropagation();                 // senao o clique sobe e o cartao desfaz
    minimizaFicha(!$("usheet").classList.contains("min"));
  });
// Clicar em qualquer lugar da TIRA tambem abre -- o alvo de 58 px de altura e mais
// facil de acertar que a seta, e no estado aberto este atalho nao vale (senao ler a
// ficha encolheria ela).
//
// So no ESPACO VAZIO da tira, nunca num controle. Todo clique em botao/link/x dentro do
// cartao sobe por aqui, e o pior deles e o proprio "O que tem por perto?": o ouvinte
// dele minimiza, o clique borbulha, este ve `min` recem-posta e desfaz -- a ficha
// piscava e voltava inteira no mesmo gesto.
for (const cartao of [$("usheet"), $("hsheet")])
  cartao.addEventListener("click", e => {
    if (!cartao.classList.contains("min")) return;
    if (e.target.closest("button, a, .x, .dobra")) return;
    minimizaFicha(false);
  });
function updatePois() {
  // v9: dentro do imovel o marcador de estabelecimento nao tem o que fazer -- ele e
  // desenhado por cima de tudo (DOM) e vira uma fileira de pilulas atravessando a sala.
  const dentro = typeof INT !== "undefined" && INT.on;
  gPoi.visible = !dentro && !poiHidden;   // sem atropelar o botao Pins do usuario
  if (poiHidden || dentro) {
    for (const p of POIS) if (p.el.style.display !== "none") p.el.style.display = "none";
    sujaPois();   // voltar do imovel (ou religar os Pins) tem que redesenhar
    return;
  }
  const W = innerWidth, H = innerHeight, cam = camera.position, vis = [];
  /* Camera parada = marcador parado, e aqui isso vale mais que nos rotulos: sao 1.197
     POIs contra 104 visiveis (medido em Ribeirao). Projetar os 1.197 e reescrever o
     `style` de todos por quadro, pra posicionar os mesmos 104 pixels, e o maior item de
     CPU que sobrou no laco. `camera.position` resume alvo, theta, phi e raio; poiSel
     entra porque o selecionado ignora a colisao de rotulo e muda o resultado do
     empacotamento. Categoria, botao Pins e Relevo avisam por sujaPois(). */
  if (!_poiCam.equals(camera.position) || W !== _poiW || H !== _poiH ||
      reliefAmount !== _poiRel || poiSel !== _poiSelAnt) _poiSujo = true;
  if (!_poiSujo) return;
  _poiCam.copy(camera.position); _poiW = W; _poiH = H;
  _poiRel = reliefAmount; _poiSelAnt = poiSel; _poiSujo = false;
  const esconde = p => { if (p.el.style.display !== "none") p.el.style.display = "none"; };
  const P2 = POI_MAX*POI_MAX;
  for (const p of POIS) {
    if (!catOn[p.c]) { esconde(p); continue; }
    // A distancia vem ANTES da projecao, e sem Vector3: `project()` e uma multiplicacao
    // de matriz por POI, e a esmagadora maioria dos 1.197 esta alem dos 4.200 m de
    // POI_MAX. Antes projetava tudo pra so entao comparar a distancia.
    const py = POI_Y + p.dy*reliefAmount;
    const ex = p.x - cam.x, ey = py - cam.y, ez = p.z - cam.z;
    const d2 = ex*ex + ey*ey + ez*ez;
    if (d2 > P2) { esconde(p); continue; }
    p.v.set(p.x, py, p.z).project(camera);
    if (p.v.z > 1 || Math.abs(p.v.x) > 1.15 || Math.abs(p.v.y) > 1.15) { esconde(p); continue; }
    p.d = Math.sqrt(d2);
    p.sx = (p.v.x*0.5 + 0.5)*W; p.sy = (-p.v.y*0.5 + 0.5)*H;
    vis.push(p);
  }
  // Mais perto primeiro; empate resolve pela prioridade da categoria, entao um
  // hospital nunca e escondido por uma mercearia colada nele.
  vis.sort((a, b) => (a.d - b.d) || (a.cfg.pri - b.cfg.pri));
  const placed = [];
  for (const p of vis) {
    const s = Math.max(0.66, Math.min(1, 1000/(p.d + 380)));
    if (p !== poiSel) {
      let hit = false;
      for (const q of placed)
        if (Math.abs(q.sx - p.sx) < 31 && Math.abs(q.sy - p.sy) < 25) { hit = true; break; }
      if (hit) { esconde(p); continue; }
    }
    let name = p.d < POI_NAME || p === poiSel;
    if (name) {
      const w = p.nw * s;
      for (const q of placed)
        if (Math.abs(q.sy - p.sy) < 20 && q.sx > p.sx && q.sx < p.sx + w + 26) { name = false; break; }
    }
    p.el.classList.toggle("mini", !name);
    p.el.style.display = "flex";
    p.el.style.zIndex = String(8000 - Math.round(Math.min(7900, p.d)));
    p.el.style.transform = "translate(" + p.sx.toFixed(1) + "px," + p.sy.toFixed(1) + "px)" +
                           " translate(-15px,-15px) scale(" + s.toFixed(3) + ")";
    placed.push(p);
  }
}

/* ============================================================
   12. Interiores — a casa por dentro, na MESMA cena
   ============================================================
   Não há segunda página, segundo renderer nem segunda cena. Entrar numa casa é:

     1. descobrir QUAL edificação foi clicada (raycast na malha mesclada +
        `presetCenter`, que já guarda o centroide de cada vértice);
     2. gerar a planta daquela casa (BSP sobre o retângulo mínimo do contorno);
     3. descer um PLANO DE CORTE global até a altura do peitoril, o que tira o
        telhado do bairro inteiro e deixa o interior à vista sem apagar a cidade;
     4. trocar a câmera orbital por primeira pessoa, com colisão nas paredes.

   Três decisões que valem comentário, porque nenhuma é óbvia:

   - O CORTE É GLOBAL E NASCE LIGADO. `renderer.clippingPlanes` com um plano no
     infinito custa algumas instruções por fragmento e nada mais. Ligar o corte
     só na hora de entrar mudaria a CONTAGEM de planos e recompilaria todo
     shader da cena no meio da transição — engasgo garantido, e justo no frame
     em que o usuário está olhando.

   - A CASA NÃO GANHA PAREDE EXTERNA. A casca que já existe (`gBuild`) é
     DoubleSide: vista de dentro ela já é a parede, com a janela e a porta que o
     shader de fachada desenha. Duplicar isso custaria geometria, z-fighting e
     uma segunda fonte de verdade pro mesmo contorno.

   - MÓVEL É CAIXA, NÃO GLTF. A página abre com duplo clique em file://; um
     loader externo seria um arquivo que não existe. E as caixas de um móvel
     viram UMA malha com cor por vértice, então cada móvel custa UMA chamada de
     desenho — que é a moeda cara aqui (~23 µs cada), não o triângulo.
   ============================================================ */

const gInteriores = new THREE.Group();
scene.add(gInteriores);

// normal (0,-1,0) + constante C mantém o que está em y < C. C = altura do corte.
const CORTE = new THREE.Plane(new THREE.Vector3(0, -1, 0), 1e6);
const CORTE_OFF = 1e6;
renderer.clippingPlanes = [CORTE];
camera.rotation.order = "YXZ";   // primeira pessoa: yaw depois pitch, nunca roll

const PD         = 2.70;   // pé-direito interno
const CORTE_OMBRO = 1.55;  // altura do corte na vista de planta
const ESP        = 0.13;   // espessura de parede interna
const VAO        = 0.90;   // vão de porta
const OLHO       = 1.62;   // altura dos olhos
const RAIO       = 0.30;   // raio do "corpo" pra colisão

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
  tapete:    { nome:"Tapete",    b:[2.20,0.02,1.60], cor:0x6B5A63, malha:"tapete" }
};
const MOVEL_KEYS = Object.keys(MOVEIS);

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
    if (nx*gx+ny*gy+nz*gz < 0) { nx=-nx; ny=-ny; nz=-nz; }
    for (const v of [a,b,c]) { P.push(v[0],v[1],v[2]); N.push(nx,ny,nz); C.push(rgb[0],rgb[1],rgb[2]); }
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
  const d = MOVEIS_LIB[p.malha];
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
function sofaParam(m) {
  const L = MOVEIS_LIB;
  if (!L.sofa_mod || !L.sofa_braco) return [];
  const bw = L.sofa_braco.b[0], mw0 = L.sofa_mod.b[0];
  const h0 = L.sofa_mod.b[1], d0 = L.sofa_mod.b[2];
  const w = Math.max(2 * bw + 0.62, m.w);
  const sy = m.h / h0, sz = m.d / d0;
  const util = w - 2 * bw;
  const n = Math.max(1, Math.min(5, Math.round(util / 0.785)));
  const mw = util / n;
  const P = [];
  for (let i = 0; i < n; i++)
    P.push({ malha:"sofa_mod", x: -w/2 + bw + mw * (i + 0.5), sx: mw / mw0, sy, sz });
  for (const s of [-1, 1])
    P.push({ malha:"sofa_braco", x: s * (w/2 - bw/2), sx: s, sy, sz });
  return P;
}

const _cor = new THREE.Color();
const rgbDe = hex => { _cor.setHex(hex);
  return [Math.round(_cor.r*255), Math.round(_cor.g*255), Math.round(_cor.b*255)]; };
/* O ACES COME CROMA, e e mensuravel: a parede declarada #D9D2C7 (R menos B = 18) chega
   na tela com R menos B = 11. Quarenta por cento do que separava "bege claro" de
   "cinza" some no caminho -- e o que sobra e a parede sonsa.

   Aqui a cor do cadastro e saturada ANTES de virar vertice, na medida do que o tone
   mapper vai tirar dela. Nao e enfeite e nao mexe no dado: e devolver na tela a cor que
   a pessoa amostrou da foto do anuncio. Vale so pro acabamento da casa (parede, forro,
   rodape, piso) -- movel ja chega com croma de sobra e estouraria. */
const CROMA_ACES = 1.55;
const _hsl = { h:0, s:0, l:0 };
const rgbAcabamento = hex => {
  _cor.setHex(hex); _cor.getHSL(_hsl);
  _cor.setHSL(_hsl.h, Math.min(1, _hsl.s * CROMA_ACES), _hsl.l);
  return [Math.round(_cor.r*255), Math.round(_cor.g*255), Math.round(_cor.b*255)];
};

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
  const m = new THREE.Mesh(g, matInt);
  m.castShadow = true; m.receiveShadow = true;
  const gr = new THREE.Group(); gr.add(m);
  return gr;
}

function geoDoMovel(def, corHex, m) {
  if (def.param) {
    const malha = new THREE.Mesh(geoDeParts(def.param(m || medidaPadrao(def)), corHex), matInt);
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
/* ---- ambiente refletido, sem arquivo -----------------------------------
   Material PBR sem ambiente é material morto: `metalness` alto sem nada pra refletir
   fica PRETO, e porcelanato liso sem céu fica fosco. O ambiente aqui é um gradiente
   equirretangular desenhado num canvas (céu em cima, piso quente embaixo, uma faixa
   clara na altura da janela) passado pelo PMREM. É a versão pobre do `RoomEnvironment`
   dos exemplos do three, que não está no pacote embutido -- e é suficiente, porque o
   que se quer dele é gradiente de luz, não paisagem legível. */
const ambientePBR = (() => {
  const c = document.createElement("canvas");
  c.width = 256; c.height = 128;
  const g = c.getContext("2d");
  const grd = g.createLinearGradient(0, 0, 0, 128);
  grd.addColorStop(0.00, "#E8F0FA");   // céu
  grd.addColorStop(0.42, "#CFDCEA");
  grd.addColorStop(0.52, "#FBF3E4");   // faixa da janela
  grd.addColorStop(0.68, "#B7AFA3");
  grd.addColorStop(1.00, "#6E665C");   // chão
  g.fillStyle = grd; g.fillRect(0, 0, 256, 128);
  /* UMA JANELA, e não um anel uniforme.
     O ambiente antigo era um degradê só na vertical: todo ponto da parede via a
     mesma coisa em toda direção, e reflexo que não muda com o ângulo não lê como
     reflexo -- lê como cor. Num cômodo real quase toda a luz vem de um retângulo
     brilhante numa parede, e é ele que desenha o fio de luz na borda do tampo e a
     mancha comprida no porcelanato. Aqui ele existe: duas manchas claras (a
     janela e a porta do cômodo vizinho) num ambiente escurecido. */
  const jan = (cx, cy, w, h, i) => {
    const r = g.createRadialGradient(cx, cy, 1, cx, cy, Math.max(w, h));
    r.addColorStop(0, "rgba(255,252,244," + i + ")");
    r.addColorStop(0.55, "rgba(255,250,238," + (i*0.45).toFixed(3) + ")");
    r.addColorStop(1, "rgba(255,250,238,0)");
    g.fillStyle = r; g.beginPath();
    g.ellipse(cx, cy, w, h, 0, 0, 6.2832); g.fill();
  };
  g.fillStyle = "rgba(38,40,46,0.30)"; g.fillRect(0, 0, 256, 128);
  jan(64, 54, 34, 26, 0.95);
  jan(190, 58, 22, 20, 0.55);
  const t = new THREE.CanvasTexture(c);
  t.mapping = THREE.EquirectangularReflectionMapping;
  const pm = new THREE.PMREMGenerator(renderer);
  const alvo = pm.fromEquirectangular(t);
  pm.dispose(); t.dispose();
  return alvo.texture;
})();

// DoubleSide porque o corte deixa ver o interior de qualquer ângulo, e porque o three
// inverte a normal da face de trás sozinho (a laje preta do v7 custou essa lição).
const matInt = new THREE.MeshStandardMaterial({ vertexColors:true, roughness:0.72,
  metalness:0.02, side:THREE.DoubleSide, envMap:ambientePBR, envMapIntensity:0.28 });
const matVidro = new THREE.MeshStandardMaterial({ color:0xC4D8E6, roughness:0.05,
  metalness:0.08, envMap:ambientePBR, envMapIntensity:1.4, transparent:true,
  opacity:0.17, side:THREE.DoubleSide, depthWrite:false });
// Esquadria pintada (batente, guarnição, folha de porta) e alumínio anodizado (caixilho,
// trilho, puxador). Dois materiais, não vinte: TODA esquadria da unidade sai em três
// malhas -- pintado, metal e vidro -- pelo mesmo motivo que o piso sai em três. Cor por
// vértice, então porta branca e porta de madeira convivem na mesma chamada de desenho.
const matEsq = new THREE.MeshStandardMaterial({ vertexColors:true, roughness:0.42,
  metalness:0.03, side:THREE.DoubleSide, envMap:ambientePBR, envMapIntensity:0.34 });
const matAlum = new THREE.MeshStandardMaterial({ vertexColors:true, roughness:0.34,
  metalness:0.86, side:THREE.DoubleSide, envMap:ambientePBR, envMapIntensity:1.05 });

/* ---- textura sem arquivo ----------------------------------------------
   Parede lisa e piso liso viram um cubo branco: sem junta e sem tábua não há escala,
   e um cômodo de 3 m parece do mesmo tamanho que um de 8 m. As três texturas abaixo
   são desenhadas num canvas na hora — a página abre por duplo clique em file://, onde
   arquivo externo não existe, e um PNG embutido em base64 custaria KB por textura.

   Elas saem quase brancas de propósito: a COR vem do `unidade.json`, por vértice, e a
   textura só multiplica. Trocar a cor de um cômodo não exige redesenhar textura. */
function _cv(n) {
  const c = document.createElement("canvas");
  c.width = c.height = n;
  // v16: `willReadFrequently`. Todo canvas que sai daqui e ALTURA lida de volta com
  // `getImageData` (ver normalDeAltura/rugosidadeDeAltura), e sem a dica o Chrome
  // acelera o canvas na GPU e cada leitura vira uma descida de volta pra CPU. Aqui
  // ele fica na CPU, que e onde ja e usado; o envio pra GPU continua sendo o mesmo
  // upload unico do CanvasTexture.
  //
  // NAO e isto que cala o aviso "Multiple readback operations" do console: com a dica
  // nos dois pontos de leitura ele continua saindo duas vezes, entao ele vem de outro
  // canvas (os que viram textura sem passar por aqui: halo de POI, ambiente, ceu -- o
  // upload de canvas pra GPU tambem conta como leitura). Fica registrado: a mudanca se
  // justifica pelo que estes canvas fazem, nao por um aviso que ela nao apagou.
  return [c, c.getContext("2d", { willReadFrequently: true })];
}
function _tex(c, rep, linear) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  // COR e sRGB; RELEVO e RUGOSIDADE nao sao cor. Marcar um mapa de normal como sRGB
  // aplica a curva de gama num vetor -- a normal sai torta e o brilho anda junto,
  // sem erro nenhum no console.
  if (!linear && THREE.SRGBColorSpace) t.colorSpace = THREE.SRGBColorSpace;
  if (rep) t.repeat.set(rep, rep);
  return t;
}

/* ---- relevo e rugosidade a partir de uma ALTURA ------------------------
   Ate aqui os tres materiais do interior tinham COR e mais nada: rugosidade
   constante e nenhuma normal. E o que faz superficie parecer papel -- parede
   pintada de verdade tem micro-relevo, junta de porcelanato tem chanfro, regua de
   madeira tem rebaixo. Nada disso e geometria: e o mapa de normal pegando a luz de
   raspao.

   `normalDeAltura` deriva a normal por diferenca central (Sobel simplificado) do
   canal verde de um canvas de altura. `forca` e quanto o relevo pesa -- em parede
   e minusculo de proposito: passar disso vira estuque, e estuque nao e o que o
   anuncio vende.

   As duas rodam UMA vez no boot e o resultado e compartilhado por todas as
   unidades: nao ha custo por casa aberta. */
function normalDeAltura(c, forca) {
  // Mesma dica do `_cv`: a altura e lida DUAS vezes (uma dentro de `_alturaParede`/
  // `_alturaPiso`, outra aqui), e pedir o contexto de novo sem os mesmos atributos
  // deixaria a segunda leitura sem ela.
  const n = c.width, g = c.getContext("2d", { willReadFrequently: true });
  const src = g.getImageData(0, 0, n, n).data;
  const [d, gd] = _cv(n);
  const out = gd.createImageData(n, n);
  const h = (x, y) => src[(((y + n) % n) * n + ((x + n) % n)) * 4 + 1] / 255;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const dx = (h(x + 1, y) - h(x - 1, y)) * forca;
    const dy = (h(x, y + 1) - h(x, y - 1)) * forca;
    const l = Math.hypot(dx, dy, 1);
    const i = (y * n + x) * 4;
    out.data[i]   = Math.round((-dx / l * 0.5 + 0.5) * 255);
    out.data[i+1] = Math.round((-dy / l * 0.5 + 0.5) * 255);
    out.data[i+2] = Math.round((1 / l * 0.5 + 0.5) * 255);
    out.data[i+3] = 255;
  }
  gd.putImageData(out, 0, 0);
  return _tex(d, null, true);
}

/* Rugosidade que VARIA. Parede pintada nao tem brilho uniforme: a demao deixa
   trecho mais fechado e trecho mais aberto, e e essa variacao que o olho le como
   tinta em vez de plastico. `base` e o valor medio, `amp` o quanto ele passeia --
   em manchas grandes (o rolo), nao em ruido de pixel. */
function rugosidadeManchada(base, amp, semente) {
  const N = 128, [c, g] = _cv(N);
  let s = semente >>> 0;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  g.fillStyle = "rgb(" + Math.round(base*255) + "," + Math.round(base*255) + "," +
                Math.round(base*255) + ")";
  g.fillRect(0, 0, N, N);
  for (let i = 0; i < 90; i++) {
    const v = Math.round(Math.max(0, Math.min(1, base + (rnd()-0.5)*2*amp)) * 255);
    const r = 8 + rnd()*26;
    g.fillStyle = "rgba(" + v + "," + v + "," + v + ",0.5)";
    g.beginPath(); g.arc(rnd()*N, rnd()*N, r, 0, 6.2832); g.fill();
  }
  return _tex(c, null, true);
}
/* ---- as tres ALTURAS -----------------------------------------------------
   Cada uma desenha, em cinza, o RELEVO da superficie -- claro e alto, escuro e
   baixo. `normalDeAltura` converte. Sao as tres coisas que o olho usa pra saber
   que material esta olhando, e nenhuma delas e cor:

     massa corrida  ondulacao larga e rasa da desempenadeira
     porcelanato    o CHANFRO da borda da placa (a junta e um vale em V)
     tabua          o rebaixo entre reguas, mais o veio de leve

   Sao geradas uma vez no boot e compartilhadas por toda unidade. */
function _alturaParede() {
  const N = 128, [c, g] = _cv(N);
  let s = 0x7C1D93F >>> 0;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  g.fillStyle = "#808080"; g.fillRect(0, 0, N, N);
  // ondulacao larga: a marca da desempenadeira, em manchas de 20 a 55 px
  for (let i = 0; i < 130; i++) {
    const v = Math.round(128 + (rnd() - 0.5) * 46);
    g.fillStyle = "rgba(" + v + "," + v + "," + v + ",0.42)";
    g.beginPath(); g.arc(rnd()*N, rnd()*N, 10 + rnd()*18, 0, 6.2832); g.fill();
  }
  // graozinho: o que sobra da textura do rolo
  const d = g.getImageData(0, 0, N, N);
  for (let i = 0; i < d.data.length; i += 4) {
    const j = (rnd() - 0.5) * 16;
    d.data[i] = d.data[i+1] = d.data[i+2] =
      Math.max(0, Math.min(255, d.data[i] + j));
  }
  g.putImageData(d, 0, 0);
  return c;
}

function _alturaPiso() {
  const N = 256, [c, g] = _cv(N);
  g.fillStyle = "#9a9a9a"; g.fillRect(0, 0, N, N);
  // o chanfro: uma borda que DESCE ate a junta. Sem ele a placa e um retangulo
  // pintado; com ele a junta pega sombra de um lado e luz do outro, que e como
  // porcelanato assentado se le de perto.
  const passos = 7;
  for (let k = 0; k < passos; k++) {
    const t = k / passos;
    const v = Math.round(154 - t * 96);
    g.strokeStyle = "rgb(" + v + "," + v + "," + v + ")";
    g.lineWidth = 1.15;
    g.strokeRect(0.6 + k * 1.15, 0.6 + k * 1.15,
                 N - 1.2 - k * 2.3, N - 1.2 - k * 2.3);
  }
  const d = g.getImageData(0, 0, N, N);
  for (let i = 0; i < d.data.length; i += 4) {
    const j = (Math.random() - 0.5) * 5;
    d.data[i] = d.data[i+1] = d.data[i+2] =
      Math.max(0, Math.min(255, d.data[i] + j));
  }
  g.putImageData(d, 0, 0);
  return c;
}

function _alturaMadeira() {
  const N = 512, TAB = 12, H = N / TAB, [c, g] = _cv(N);
  let s = 0x2F6E2B1 >>> 0;    // MESMA semente do albedo: veio e relevo tem que bater
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  g.fillStyle = "#8e8e8e"; g.fillRect(0, 0, N, N);
  for (let k = 0; k < TAB; k++) {
    const y0 = k * H;
    for (let i = 0; i < 90; i++) {           // veio: sulco raso
      const y = y0 + rnd() * H;
      const v = Math.round(132 - rnd() * 26);
      g.strokeStyle = "rgba(" + v + "," + v + "," + v + ",0.30)";
      g.lineWidth = 0.6 + rnd() * 1.2;
      g.beginPath(); g.moveTo(0, y);
      g.bezierCurveTo(N*0.33, y + (rnd()-0.5)*5, N*0.66, y + (rnd()-0.5)*5, N, y);
      g.stroke();
    }
  }
  // rebaixo entre reguas: vale escuro com a quina clara logo abaixo
  for (let k = 0; k <= TAB; k++) {
    const y = k * H;
    g.strokeStyle = "rgba(46,46,46,0.85)"; g.lineWidth = 2.0;
    g.beginPath(); g.moveTo(0, y + 0.9); g.lineTo(N, y + 0.9); g.stroke();
    g.strokeStyle = "rgba(214,214,214,0.55)"; g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(0, y + 2.7); g.lineTo(N, y + 2.7); g.stroke();
  }
  return c;
}

const texPiso = (() => {                      // porcelanato: junta fina, 1 placa por UV
  const [c, g] = _cv(256);
  g.fillStyle = "#ffffff"; g.fillRect(0, 0, 256, 256);
  const d = g.createImageData(256, 256);      // grão finíssimo, tira o "plástico"
  for (let i = 0; i < d.data.length; i += 4) {
    const v = 246 + Math.random() * 9;
    d.data[i] = d.data[i+1] = d.data[i+2] = v; d.data[i+3] = 26;
  }
  g.putImageData(d, 0, 0);
  g.strokeStyle = "rgba(120,120,120,0.55)"; g.lineWidth = 3;
  g.strokeRect(1.5, 1.5, 253, 253);
  return _tex(c);
})();
/* Piso em TÁBUA, não em listra. A primeira versão eram quatro réguas de 40 cm com veio
   corrido e nenhuma junta de topo: sem topo a régua parece infinita, e piso de régua
   infinita não é piso, é papel de parede -- foi o que o usuário apontou.

   Três coisas fazem a tábua ler como tábua, e as três estão aqui:
     1. LARGURA de gente: 12 réguas por UV com passo de 2,40 m dá 20 cm por peça, que é
        a régua que se compra. Com 40 cm o olho lê "painel".
     2. JUNTA DE TOPO escalonada: uma ou duas por régua, em posição sorteada. É ela que
        diz onde uma peça acaba e a outra começa.
     3. TOM POR PEÇA: cada régua sai de um pedaço diferente da tora. Chapar todas no
        mesmo tom é o que dá aparência de impressão.
   O sorteio é SEMEADO (LCG fixo), e não `Math.random`: assim a mesma página desenha o
   mesmo piso em toda sessão. A textura sai quase branca de propósito -- a cor vem de
   `cores.piso_madeira` por vértice e isto aqui só multiplica. */
const texMadeira = (() => {
  const N = 512, TAB = 12, H = N / TAB;
  const [c, g] = _cv(N);
  let s = 0x2F6E2B1 >>> 0;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  g.fillStyle = "#ffffff"; g.fillRect(0, 0, N, N);
  for (let k = 0; k < TAB; k++) {
    const y0 = k * H;
    // Tom por regua: de 0,13 pra 0,26 de amplitude. Piso de madeira de verdade
    // alterna regua clara e escura de forma bem visivel -- foi medido que a cena
    // inteira tinha saturacao media 0,044, e a madeira e a UNICA superficie do
    // apartamento que pode carregar cor sem virar parede colorida.
    g.fillStyle = "rgba(120,88,54," + (rnd() * 0.26).toFixed(3) + ")";
    g.fillRect(0, y0, N, H);
    for (let i = 0; i < 120; i++) {           // veio, sempre DENTRO da régua
      const y = y0 + rnd() * H;
      g.strokeStyle = "rgba(126,92,58," + (0.08 + rnd()*0.16).toFixed(3) + ")";
      g.lineWidth = 0.5 + rnd()*1.1;
      g.beginPath(); g.moveTo(0, y);
      g.bezierCurveTo(N*0.33, y + (rnd()-0.5)*5, N*0.66, y + (rnd()-0.5)*5, N, y);
      g.stroke();
    }
    for (let i = 0, nj = 1 + (rnd() < 0.45 ? 1 : 0); i < nj; i++) {
      const x = Math.round((0.12 + rnd()*0.76) * N);
      g.strokeStyle = "rgba(74,56,38,0.50)"; g.lineWidth = 1.4;
      g.beginPath(); g.moveTo(x, y0 + 1.2); g.lineTo(x, y0 + H - 1.2); g.stroke();
    }
  }
  // Junta longitudinal: fio escuro e, logo abaixo, um fio claro. O par é o chanfro da
  // régua pegando luz de raspão -- sem ele a junta vira um risco desenhado.
  for (let k = 0; k <= TAB; k++) {
    const y = k * H;
    g.strokeStyle = "rgba(70,52,34,0.55)"; g.lineWidth = 1.7;
    g.beginPath(); g.moveTo(0, y + 0.85); g.lineTo(N, y + 0.85); g.stroke();
    g.strokeStyle = "rgba(255,250,240,0.40)"; g.lineWidth = 1.0;
    g.beginPath(); g.moveTo(0, y + 2.5); g.lineTo(N, y + 2.5); g.stroke();
  }
  return _tex(c);
})();
const texParede = (() => {                    // massa corrida: quase nada, e é o ponto
  const [c, g] = _cv(128);
  const d = g.createImageData(128, 128);
  for (let i = 0; i < d.data.length; i += 4) {
    const v = 243 + Math.random() * 12;
    d.data[i] = d.data[i+1] = d.data[i+2] = v; d.data[i+3] = 255;
  }
  g.putImageData(d, 0, 0);
  return _tex(c);
})();

// Massa corrida é quase toda difusa; porcelanato polido é o oposto e é ele que dá o
// reflexo do ambiente no chão -- o detalhe que mais faz o cômodo parecer construído.
// 0,15 de ambiente era quase nada. Massa corrida e difusa, sim, mas a parede de um
// comodo real recebe do ceu da janela e do piso o tempo todo -- e e isso que faz o
// canto sombrio parar de ser um retangulo chapado.
/* As TRES superficies do interior, agora com relevo e rugosidade variavel.
   `normalScale` e pequeno de proposito em tudo: o alvo e superficie construida,
   nao estuque. A parede leva o menor de todos (0,22) -- massa corrida tem
   micro-relevo, e passar disso denuncia o truque na primeira luz de raspao. */
const nrmParede = normalDeAltura(_alturaParede(), 1.4);
const nrmPiso = normalDeAltura(_alturaPiso(), 4.5);
const nrmMadeira = normalDeAltura(_alturaMadeira(), 2.6);
const rugParede = rugosidadeManchada(0.78, 0.09, 0x51A3D1);
const rugPiso = rugosidadeManchada(0.20, 0.07, 0x9E3B77);
const rugMadeira = rugosidadeManchada(0.52, 0.10, 0x2C7F4A);

const matParede = new THREE.MeshStandardMaterial({ vertexColors:true, map:texParede,
  normalMap:nrmParede, normalScale:new THREE.Vector2(0.22, 0.22),
  roughnessMap:rugParede, roughness:1.0, metalness:0.0, side:THREE.DoubleSide,
  envMap:ambientePBR, envMapIntensity:0.34 });
const matFrio = new THREE.MeshStandardMaterial({ vertexColors:true, map:texPiso,
  normalMap:nrmPiso, normalScale:new THREE.Vector2(0.55, 0.55),
  roughnessMap:rugPiso, roughness:1.0, metalness:0.04, side:THREE.DoubleSide,
  envMap:ambientePBR, envMapIntensity:0.55 });
const matMadeira = new THREE.MeshStandardMaterial({ vertexColors:true, map:texMadeira,
  normalMap:nrmMadeira, normalScale:new THREE.Vector2(0.42, 0.42),
  roughnessMap:rugMadeira, roughness:1.0, metalness:0.0, side:THREE.DoubleSide,
  envMap:ambientePBR, envMapIntensity:0.34 });

/* ---- o forro so recebe ricochete, e o ricochete e do piso ---------------
   O forro era o plano MAIS SATURADO e um dos mais escuros do comodo -- bege alaranjado
   num apartamento de parede clara. Medido no quadro Sala->Cozinha de Sao Carlos, com a
   luz de teto apagada (que e como o visitante entra):

     forro    (167,143,112)   saturacao 0,329   luminancia 147
     parede   (195,191,183)   saturacao 0,062   luminancia 191

   Nao e o cadastro e nao e o bake: a cor por vertice que o bake deixa no forro e
   (0,912 / 0,903 / 0,876), saturacao 0,04 -- mais NEUTRA e mais CLARA que a da parede.
   A causa e de onde vem a luz. Com `envMapIntensity = 0` o forro cai pra (39,34,27):
   ~85% do que chega nele e a sonda de ambiente, e a metade de baixo da sonda e o piso
   de madeira (saturacao 0,376), com `SONDA_GANHO` dobrando por cima.

   Fisicamente esta certo -- forro sobre piso de madeira PUXA quente. Errada e a
   amplitude: tinta branca com 90% de albedo nao chega a 0,33 de croma.

   O que NAO resolve, medido: subir a hemisferica com chao neutro. Ela conserta o forro
   (0,329 -> 0,168) destruindo justamente o que a v15 conquistou -- faixa 118,9 -> 73,5,
   escuro 3,1% -> 2,1%, croma 0,150 -> 0,086. E o preenchimento falso voltando pela
   janela, e o portao de `mede_interior.py` existe pra barrar isso.

   Entao o conserto e CIRURGICO: tira o croma do ambiente so na face virada pra baixo,
   devolvendo em luz o que sai em cor. Nao toca em parede (normal horizontal), nem em
   piso (normal pra cima), nem na cidade. Medido depois:

     forro    (173,166,157)   saturacao 0,092   luminancia 167
     quadro   media 140,8 -> 142,0   faixa 118,9 -> 119,0   escuro 3,10% -> 3,10%
              croma 0,150 -> 0,137 (piso do portao: 0,09)                            */
const FORRO_NEUTRO = 0.80;   // quanto do croma do ambiente sai da face virada pra baixo
const FORRO_GANHO  = 0.40;   // e quanto de luz volta no lugar
for (const m of [matParede, matFrio, matMadeira, matInt, matEsq]) {
  m.onBeforeCompile = sh => {
    sh.fragmentShader = sh.fragmentShader.replace("#include <lights_fragment_maps>",
      `#include <lights_fragment_maps>
       /* A SONDA E DE UM COMODO SO, E A PAREDE NAO PODE HERDAR A JANELA DELE.
          sondaDeAmbiente roda UMA CubeCamera, no centro do MAIOR comodo, e o cubemap
          vira a luz ambiente da casa inteira. Na DIFUSA isso e direcional -- a
          irradiancia e amostrada na NORMAL --, entao toda parede da unidade que aponta
          pro rumo em que estava a janela daquele comodo recebe luz de janela, inclusive
          num quarto que nao tem janela nenhuma. E o que o usuario viu como "paredes que
          iluminam sem motivo": um degrau chapado entre duas paredes vizinhas, sem
          gradiente e sem fonte no quadro. Medido no wish-castanheiras-58, quarto: a
          lateral saia 1,20 vez a do fundo; com ?sonda=0 ela cai pra 0,84 -- a sonda
          nao acentuava a hierarquia de luz, ela INVERTIA.

          Aqui a irradiancia de toda face VERTICAL vira a media das quatro direcoes
          horizontais: quatro amostras do mip mais borrado, custo desprezivel. A parede
          para de ter rumo predileto e a sonda continua fazendo o que veio fazer -- o
          reflexo especular do piso, que e radiance e nao se toca aqui. Piso e forro
          (normal vertical) ficam de fora. Medido: 1,20 -> 0,85, o mesmo que desligar a
          sonda, sem perder o reflexo.                                               */
       if (abs(geometryNormal.y) < 0.5) {
         vec3 nIso1 = normalize(vec3(geometryNormal.x, 0.0, geometryNormal.z));
         vec3 nIso2 = vec3(-nIso1.z, 0.0, nIso1.x);
         iblIrradiance = 0.25 * (getIBLIrradiance(nIso1) + getIBLIrradiance(-nIso1)
                               + getIBLIrradiance(nIso2) + getIBLIrradiance(-nIso2));
       }
       float vBaixo = clamp(-geometryNormal.y, 0.0, 1.0);
       float lumAmb = dot(iblIrradiance, vec3(0.2126, 0.7152, 0.0722));
       iblIrradiance = mix(iblIrradiance, vec3(lumAmb), vBaixo * ${FORRO_NEUTRO.toFixed(2)})
                     * (1.0 + vBaixo * ${FORRO_GANHO.toFixed(2)});`);
  };
  // Sem chave propria o three reaproveitaria o programa de um material identico SEM o
  // remendo -- mesma licao do `matVia` e do `muro`.
  m.customProgramCacheKey = () => "forro16iso";
}

/* ---- sonda de ambiente: o comodo refletindo a si mesmo ------------------
   O `ambientePBR` acima e um DEGRADE, e degrade nao lê como reflexo: todo ponto da
   parede ve a mesma coisa em toda direcao, o que o olho interpreta como cor, nao
   como reflexo. O porcelanato tem `roughness 0,20` e `envMapIntensity 0,55` -- ele
   ja esta refletindo o tempo todo; so que reflete um degrade cinza.

   Aqui ele passa a refletir o COMODO. Uma `CubeCamera` renderiza a cena de dentro
   uma vez, na entrada, e o PMREM pre-filtra pro mesmo formato que o degrade tinha.
   Custa SEIS renders de 128 px uma vez por unidade -- nao por quadro -- e zero
   chamada de desenho a mais depois disso.

   Tres coisas que dao errado em silencio:

   1. TONEMAPPER. O ACES roda na saida de todo material, inclusive quando se renderiza
      pra um alvo. Um envMap ja tonemapeado passa pelo ACES DE NOVO na tela: o
      meio-tom sobe e o reflexo lava. Por isso o `NoToneMapping` em volta da sonda.
   2. HORA DE RODAR. Antes de `aplicaFuro()` a casca do predio ainda esta inteira, e
      a sonda captura a fachada por dentro no lugar da cidade pela janela -- reflexo
      de uma parede que o morador nao ve.
   3. MATERIAL CLONADO. Com atlas do Unreal, `comLuz()` CLONA os tres materiais base,
      e o clone nasce com o envMap antigo. Por isso a troca varre `INT.raiz` alem da
      lista de materiais compartilhados.                                            */
const MATS_INT = [matParede, matFrio, matMadeira, matInt, matEsq, matAlum,
                  matVidro];
// `?sonda=0` devolve o degrade. Existe pelo mesmo motivo que `?bake=0`: sem um
// A/B na MESMA pagina, medir se a sonda melhorou exige dois builds.
const SONDA_OFF = QS.get("sonda") === "0";
/* O PREENCHIMENTO FALSO CAI PELA METADE, e a sonda dobra pra repor.

   A hemisferica, a ambiente e as tres pontuais de teto existiam pra FINGIR a luz
   indireta, numa epoca em que nada media indireta nenhuma. Com a sonda elas passam a
   contar a mesma luz duas vezes -- e o sintoma disso e o quadro nao ter PRETO em
   lugar nenhum: medido na foto Cozinha->Sala, 0,00% de pixel abaixo de 70 no
   apartamento inteiro.

   Os dois numeros saem de uma varredura contra a foto do Unreal como alvo
   (`pipeline/compara_ue.py`). Cortar preenchimento SEM subir o ganho so escurece,
   porque o bake em JS e um GANHO sobre o albedo e nao repoe energia: fill 0,25
   sozinho leva a media pra 77,9, fora do portao (105 a 168). Com o ganho junto:

     original            media 146,2   faixa  64,1   croma 0,084
     so a sonda          media 147,6   faixa  82,0   croma 0,129
     0,5 / 2 (este)      media 148,2   faixa  90,4   croma 0,136
     0,5 / 3             media 168,7   faixa  78,2   croma 0,118
     Unreal (alvo)       media 142,1   faixa 156,8   croma 0,120

   Media parada de proposito: se ela subisse, "melhorou" seria so "clareou".        */
const FILL = 0.5;
const SONDA_GANHO = 2;
let SONDA = null;               // { rt, tex } enquanto houver unidade aberta

function poeAmbiente(tex) {
  // O `envMapIntensity` de cada material foi calibrado contra o DEGRADE, que e
  // escuro e chapado. A sonda e ambiente de verdade -- cubemap pre-filtrado
  // alimenta o termo DIFUSO do MeshStandardMaterial, nao so o especular -- entao
  // ela pode assumir o papel que a hemisferica e a pontual de teto faziam de
  // mentira. Sem subir o ganho junto, cortar o preenchimento so escurece: medido,
  // fill 0,25 leva a media pra 77,9, fora do portao (105 a 168).
  const toca = m => {
    /* v16: SO material PBR, e a diferenca nao e de gosto -- e de SIGNIFICADO do slot.
       `envMap` existe tambem em MeshBasic e MeshPhong, e la ele nao e irradiancia: e
       MULTIPLICADOR da cor (`combine` = MultiplyOperation, `reflectivity` = 1). O mapa
       da sonda e CubeUV (PMREM, `mapping` 306), formato que o caminho nao-PBR nao sabe
       amostrar -- e o produto sai ZERO.

       Quem caiu nisso foi o PLAFOM da secao 12d, que e MeshBasic de proposito (luminaria
       acesa e fonte, nao superficie iluminada). Medido no pixel do centro da calota:

         com o envMap da sonda      (0,0,0) apagado  E  (0,0,0) aceso
         sem ele                    (176,173,168)    E  (255,251,242)

       Ou seja: desde que a sonda entrou, a luminaria era um buraco preto no forro em
       todo comodo, e acender a luz nao mudava a propria luminaria -- o unico retorno
       visual que o interruptor tem. `?sonda=0` nao tinha o defeito, que e o A/B que
       fecha o diagnostico.                                                          */
    if (!m || !m.isMeshStandardMaterial) return;
    if (m._envBase === undefined) m._envBase = m.envMapIntensity;
    m.envMap = tex;
    m.envMapIntensity = m._envBase * (tex === ambientePBR ? 1 : SONDA_GANHO);
    m.needsUpdate = true;
  };
  for (const m of MATS_INT) toca(m);
  if (INT.raiz) INT.raiz.traverse(o => {
    if (!o.material) return;
    (Array.isArray(o.material) ? o.material : [o.material]).forEach(toca);
  });
}

function sondaDeAmbiente(pl) {
  soltaSonda();
  if (SONDA_OFF) return;
  const c = pl.comodos[0];                     // o maior comodo; ja vem ordenado
  const rt = new THREE.WebGLCubeRenderTarget(128, { type: THREE.HalfFloatType });
  const cam = new THREE.CubeCamera(0.08, 400, rt);
  cam.position.set(c.cx, INT.baseY + OLHO, c.cz);
  scene.add(cam);
  const tm = renderer.toneMapping, ex = renderer.toneMappingExposure;
  renderer.toneMapping = THREE.NoToneMapping; renderer.toneMappingExposure = 1;
  try { cam.update(renderer, scene); }
  finally { renderer.toneMapping = tm; renderer.toneMappingExposure = ex; scene.remove(cam); }
  const pm = new THREE.PMREMGenerator(renderer);
  const alvo = pm.fromCubemap(rt.texture);
  pm.dispose();
  SONDA = { rt, tex: alvo.texture };
  poeAmbiente(alvo.texture);
}

function soltaSonda() {
  if (!SONDA) return;
  poeAmbiente(ambientePBR);
  SONDA.tex.dispose(); SONDA.rt.dispose();
  SONDA = null;
}

/* ---- planta FORNECIDA --------------------------------------------------
   O BSP acima existe pros 74 mil volumes sobre os quais nao ha dado nenhum. Quando ha
   planta de verdade ela manda, e o formato em que ela chega e `plantas_fornecidas/`:
   comodo como poligono, porta e janela como PONTO com largura.

   PAREDE NAO E DADO DE ENTRADA, E DERIVADA. Rasteriza os comodos numa grade de 5 cm,
   pergunta de quem e cada celula, e emite parede em toda fronteira entre donos
   diferentes -- comodo x comodo, ou comodo x lado de fora. Tres motivos, nessa ordem:
   e o que a imagem de uma planta de fato entrega (area rotulada, nao espessura de
   alvenaria); e o que sobrevive a uma extracao torta, porque a grade nao se importa
   com poligono que nao fecha em angulo reto; e dispensa declarar contorno externo, que
   e justamente a parte que planta de anuncio nao desenha por inteiro. */
const UNIDADES = _UNIDADES;   // lido la em cima -- ver _UNIDADES

function idDoRegistro(rec) {
  let mx = 0, mz = 0;
  for (const p of rec.r) { mx += p[0]; mz += p[1]; }
  return Math.round(mx/rec.r.length*10) + "_" + Math.round(mz/rec.r.length*10);
}
// Normalmente a unidade acha o predio dela por `predio_id`. `?planta=<id>` forca UMA
// planta em qualquer predio que se clicar: e como se confere uma planta recem-extraida
// antes de decidir em que torre ela mora, sem que isso sequestre a pagina normal --
// sem o parametro, predio sem unidade cadastrada continua caindo no BSP.
const PLANTA_FORCADA = new URLSearchParams(location.search).get("planta");
/* Predio -> unidade. E a INVERSA de `predioDaUnidade`, e tem que ser mesmo: enquanto
   ela olhava so `predio_id`, a outra ja resolvia por tres fontes (predio fixado a mao,
   `predio_id` e a `ancora` lat/lon do anuncio). O resultado era um mapa em que a
   vitrine achava o predio do imovel e o predio nao achava o imovel de volta -- e a
   unica unidade real do acervo (mirra-114) tem justamente `predio_id: null`.

   Perguntar "de quem e este predio?" percorrendo as unidades e barato porque UNIDADES
   tem uma dezena de itens, nao milhares, e isso so roda no clique.                  */
function unidadeDoPredio(rec) {
  const id = idDoRegistro(rec);
  let forcada = null;
  for (const u of UNIDADES) {
    if (!u.planta || !u.planta.comodos || !u.planta.comodos.length) continue;
    // Lancamento com varios blocos: a torre gemea e o embasamento sao do MESMO
    // empreendimento, e clicar neles tem que abrir a mesma ficha. So o principal e
    // devolvido por `predioDaUnidade`, entao a busca olha a lista inteira.
    if (u.lote && recsDoLancamento(u).some(b => idDoRegistro(b) === id)) return u;
    const alvo = predioDaUnidade(u);
    // `alvo.rec` nulo e unidade de LOTE: ela nao e dona de volume nenhum, entao nao
    // pode ser devolvida por clique em predio -- senao o predio vizinho do terreno
    // abriria a ficha do lancamento como se fosse dele.
    if (alvo && alvo.rec && idDoRegistro(alvo.rec) === id) return u;
    if (PLANTA_FORCADA && u.id === PLANTA_FORCADA) forcada = u;
  }
  return forcada;
}

/* ---- a vitrine leva pra dentro -----------------------------------------
   No mapa de Sao Carlos a lista "Imoveis para inspecao 3D" ja voava a camera ate o
   anuncio e acendia um farol no chao. Uma unidade COM PLANTA merece ir alem: clicar
   nela voa ate o predio e ENTRA. O caminho de volta e o botao Sair, que ja existe.

   O elo fraco e saber em qual predio a unidade mora. Tres fontes, nessa ordem:
   o predio fixado a mao (localStorage), o `predio_id` do cadastro, e a `ancora`
   lat/lon do anuncio -- que resolve pro predio mais proximo. Nenhuma delas e
   confiavel por si so num anuncio que so diz "em frente ao shopping", entao existe o
   "Trocar predio": clica no predio certo uma vez e fica gravado. */
const chaveAncora = id => "ancora_" + CIDADE.slug + "_" + id;

function predioDeId(id) {
  for (const g of gGroups) for (const b of g.B) if (idDoRegistro(b) === id) return b;
  return null;
}
function predioMaisPerto(x, z, raio) {
  let melhor = null, dm = raio * raio;
  for (const g of gGroups) {
    if (Math.hypot(g.cx - x, g.cz - z) - g.rad > raio) continue;
    for (const b of g.B) {
      let mx = 0, mz = 0;
      for (const p of b.r) { mx += p[0]; mz += p[1]; }
      mx /= b.r.length; mz /= b.r.length;
      const d = (mx-x)*(mx-x) + (mz-z)*(mz-z);
      if (d < dm) { dm = d; melhor = b; }
    }
  }
  return melhor;
}
/* Unidade de LOTE: o imovel mora num TERRENO, nao num volume da base.

   E o caso do LANCAMENTO, e ele nao e exotico -- e o que um acervo de imobiliaria tem
   de mais comum. A base de edificacao e foto de satelite: se a torre nao estava de pe
   na captura, o que existe no dado e um lote vazio, e nao ha volume nenhum pra vestir.
   Ate aqui isso caia no "clique no predio do empreendimento", que e a resposta pra
   ancora ERRADA, nao pra predio que ainda nao foi construido -- e a ficha nem abria.

   O lote vence as tres fontes de predio (mao, `predio_id`, `ancora`) porque nao e uma
   quarta pista sobre onde o predio esta: e a afirmacao de que predio nao ha.          */
const loteDaUnidade = u =>
  (u.lote && u.lote.lat != null) ? { x: px(u.lote.lon), z: pz(u.lote.lat) } : null;

function predioDaUnidade(u) {
  const lt = loteDaUnidade(u);
  // Com `lote.predio` declarado o lancamento TEM volume na cena (ver recDoLancamento), e
  // o caminho volta a ser o de sempre: registro de verdade, furo de verdade, clique nos
  // dois sentidos. Sem predio, o lote continua sendo so um ponto no chao.
  if (lt) return { rec: recDoLancamento(u), lote: lt, confirmado: u.lote.confirmado === true };
  let fixado = null;
  try { fixado = localStorage.getItem(chaveAncora(u.id)); } catch (e) {}
  if (fixado) { const r = predioDeId(fixado); if (r) return { rec: r, confirmado: true }; }
  if (u.predio_id) { const r = predioDeId(u.predio_id); if (r) return { rec: r, confirmado: true }; }
  const a = u.ancora;
  if (a && a.lat != null) {
    const r = predioMaisPerto(px(a.lon), pz(a.lat), 120);
    if (r) return { rec: r, confirmado: a.confirmado === true };
  }
  return null;
}

const iaviso = $("iaviso");
let escolhendo = null;            // unidade esperando o usuario apontar o predio
function pedePredio(u, texto) {
  escolhendo = u;
  $("iavisoT").textContent = texto ||
    "Clique no prédio do " + ((u.ficha && u.ficha.empreendimento) || "empreendimento");
  iaviso.classList.add("on");
}
function cancelaEscolha() { escolhendo = null; iaviso.classList.remove("on"); }
$("iavisoX").addEventListener("click", cancelaEscolha);

function abreUnidade(u, tentativa) {
  // A vitrine e montada na inicializacao do modulo; a CIDADE chega depois. Clicar no
  // anuncio nesse meio-tempo achava zero predio e caia no "clique no predio certo" --
  // que e a resposta pra ancora ausente, nao pra cidade que ainda nao chegou.
  if (!gGroups.length) {
    if ((tentativa || 0) < 40) return setTimeout(() => abreUnidade(u, (tentativa||0)+1), 400);
    pedePredio(u, "A cidade ainda nao carregou. Clique no predio do empreendimento.");
    return;
  }
  const alvo = predioDaUnidade(u);
  if (!alvo) { pedePredio(u); return; }
  const rec = alvo.rec;
  let mx = 0, mz = 0;
  if (rec) {
    for (const p of rec.r) { mx += p[0]; mz += p[1]; }
    mx /= rec.r.length; mz /= rec.r.length;
  } else {
    // Unidade de LOTE: o alvo e o proprio terreno. O farol de chao (houseBeacon) ja
    // marca ponto, nao volume -- e por isso ele serve pro lote sem nenhuma mudanca.
    mx = alvo.lote.x; mz = alvo.lote.z;
  }
  // Voa igual a vitrine sempre voou e acende o farol -- e PARA AQUI. Ate o v12 o
  // clique caia dentro da casa 980 ms depois; quem so queria saber o que era aquele
  // anuncio se via em primeira pessoa numa sala, sem ter lido metragem nem comodo, e
  // com a cidade sumindo atras do corte. Agora a visita 3D e um botao da ficha.
  houseBeacon.position.set(mx, 0, mz);
  houseBeacon.visible = true;
  target.set(mx, 0, mz);
  streamUpdate(true);
  flyTo(mx, mz, 190);
  UNID_ATUAL = u;
  abreFichaDoImovel(u, rec, alvo.confirmado, mx, mz);
}
let UNID_ATUAL = null;

/* ---- a ficha do imovel -------------------------------------------------
   O que o anuncio diz (preco, quartos, vagas) mais o que a PLANTA diz (quantos
   comodos, quais, e quantos metros cada um). Os dois vem do mesmo `unidade.json`, e a
   ficha e o unico lugar da pagina onde eles aparecem juntos. */
const usheet = $("usheet");
let FICHA = null;                       // { u, rec, x, z } -- de quem a ficha e agora

const m2 = v => v.toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + " m\u00b2";

// A area de um comodo sai do cadastro quando ele a traz; quando nao, do POLIGONO (a
// formula do laco), que e o mesmo contorno que vira parede na visita 3D. Assim a
// metragem da ficha nunca contradiz o que se anda la dentro.
function areaDoComodo(c) {
  if (typeof c.area === "number" && c.area > 0) return c.area;
  const p = c.poly || [];
  let s = 0;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++)
    s += (p[j][0] + p[i][0]) * (p[j][1] - p[i][1]);
  return Math.abs(s) / 2;
}

function abreFichaDoImovel(u, rec, confirmado, x, z) {
  const f = u.ficha || {}, pl = u.planta || {}, com = pl.comodos || [];
  FICHA = { u, rec, x, z };
  const nome = (f.empreendimento && f.empreendimento !== "\u2014")
    ? f.empreendimento : (f.titulo || u.id);
  $("uTag").textContent = f.preco ? (f.tipo === "aluguel" ? "Para alugar" : "\u00c0 venda")
                                  : "Planta 3D";
  $("uName").textContent = nome;
  $("uAddr").textContent = [f.bairro, f.municipio || (CIDADE.nome + "/" + CIDADE.uf),
    u.andar ? u.andar + "\u00ba andar" : null].filter(Boolean).join(" \u00b7 ");
  // O aviso do item da vitrine repetido aqui de proposito: a ficha e onde se decide
  // entrar, e entrar num predio errado e o erro caro.
  $("uAviso").hidden = !!confirmado;
  $("uAviso").textContent = u.lote
    ? "Terreno ainda não confirmado"
    : "Prédio ainda não confirmado";

  const medida = com.reduce((a, c) => a + areaDoComodo(c), 0);
  const st = [];
  if (f.preco) st.push(["Pre\u00e7o", brl(f.preco) + (f.tipo === "aluguel" ? "/m\u00eas" : "")]);
  if (f.area_util) st.push(["\u00c1rea \u00fatil", m2(f.area_util)]);
  else if (medida) st.push(["\u00c1rea medida", m2(medida)]);
  if (f.area_total && f.area_total !== f.area_util) st.push(["\u00c1rea total", m2(f.area_total)]);
  if (f.quartos != null) st.push(["Quartos", f.quartos]);
  if (f.suites) st.push(["Su\u00edtes", f.suites]);
  if (f.banheiros != null) st.push(["Banheiros", f.banheiros]);
  if (f.vagas != null) st.push(["Vagas", f.vagas]);
  if (pl.pe_direito) st.push(["P\u00e9-direito", String(pl.pe_direito).replace(".", ",") + " m"]);
  $("uStats").innerHTML = st.map(r =>
    "<div>" + esc(r[0]) + "<b>" + esc(r[1]) + "</b></div>").join("");

  // Comodo repetido ganha numero. "Banho" duas vezes na lista parece erro de
  // transcricao; "Banho 1 / Banho 2" e a planta dizendo que sao dois.
  const quantos = {};
  for (const c of com) quantos[c.nome] = (quantos[c.nome] || 0) + 1;
  const visto = {};
  $("uNCom").textContent = com.length
    ? com.length + " \u00b7 " + m2(medida) + " de piso"
    : "sem planta";
  $("uCom").innerHTML = com.map(c => {
    visto[c.nome] = (visto[c.nome] || 0) + 1;
    const nm = c.nome + (quantos[c.nome] > 1 ? " " + visto[c.nome] : "");
    return '<div class="ci"><span>' + esc(nm) + "</span><b>" +
           esc(m2(areaDoComodo(c))) + "</b></div>";
  }).join("");
  usheet.querySelector(".comodos").hidden = !com.length;
  $("uEnter").hidden = !com.length;

  usheet.classList.add("on");
  usheet.classList.remove("min");
  hsheet.classList.remove("on");
  closePoiSheet();
}
// Voltar do "por perto" e reabrir a ficha exatamente como ela estava, inclusive o voo.
function reabreFicha() {
  if (!FICHA) return;
  usheet.classList.add("on");
  usheet.classList.remove("min");
  houseBeacon.position.set(FICHA.x, 0, FICHA.z);
  houseBeacon.visible = true;
  flyTo(FICHA.x, FICHA.z, 190);
}
$("ux").addEventListener("click", () => {
  usheet.classList.remove("on"); houseBeacon.visible = false;
});
$("uEnter").addEventListener("click", () => {
  if (FICHA) enterInterior(FICHA.rec, FICHA.u);
});
$("uPerto").addEventListener("click", () => {
  if (!FICHA) return;
  abrePerto({ x: FICHA.x, z: FICHA.z, nome: $("uName").textContent, volta: reabreFicha });
});

// A vitrine do HTML e a mesma; muda a origem de um dos itens.
for (const u of UNIDADES) {
  if (!u.planta || !u.planta.comodos || !u.planta.comodos.length) continue;
  if (String(u.id).charAt(0) === "_") continue;   // gabarito de formato nao e imovel
  const f = u.ficha || {};
  const el = document.createElement("div");
  el.className = "hitem";
  // Lote e predio tem cada um a sua confirmacao, e a palavra na tela muda junto: em
  // lancamento o que esta por confirmar e o TERRENO, e nao qual predio e o dele.
  const emLote = !!(u.lote && u.lote.lat != null);
  const conf = emLote ? u.lote.confirmado === true
                      : !!(u.ancora && u.ancora.confirmado === true);
  el.innerHTML = '<div class="t">' + esc(f.empreendimento && f.empreendimento !== "\u2014"
      ? f.empreendimento : (f.titulo || u.id)) + "</div>" +
    '<div class="b">' + esc([f.bairro, (u.andar ? u.andar + "\u00ba andar" : null)]
      .filter(Boolean).join(" \u00b7 ")) +
      (conf ? "" : ' <span class="aviso">\u00b7 ' + (emLote ? "terreno" : "pr\u00e9dio")
                   + ' n\u00e3o confirmado</span>') + "</div>" +
    '<div class="p ' + (f.tipo === "aluguel" ? "rent" : "sale") + '">' +
      (f.preco ? brl(f.preco) + (f.tipo === "aluguel" ? "/m\u00eas" : "") : "planta 3D") + "</div>";
  el.dataset.unidade = u.id;   // marca o item que tem interior, e nao so farol
  el.addEventListener("click", () => abreUnidade(u));
  housesBox.appendChild(el);
}

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
    out.push({ tipo: m.tipo, u: m.p[0] - mcx, v: m.p[1] - mcz, rot: (m.rot || 0) & 3,
               w: m.w || def.b[0], h: m.h || def.b[1], d: m.d || def.b[2],
               cor: m.cor ? parseInt(String(m.cor).replace("#", ""), 16) : def.cor });
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
    ({ a: mundo(w.a), b: mundo(w.b), y0: w.y0, y1: w.y1, pa: w.pa, pb: w.pb }));
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
                      ux: dx, uz: dz, nx: -dz, nz: dx });
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

/* ---- geometria fixa da casa (piso + divisórias) ----------------------- */
/* `fy` e uma gradacao VERTICAL opcional, aplicada na cor por vertice.

   Parede de comodo nao tem uma cor so, e era isso que deixava o interior sonso: cada
   face saia num tom chapado do rodape ao forro, e tres faces chapadas lado a lado leem
   como maquete de papel. Na vida a parede escurece no encontro com o piso (contato),
   clareia na faixa da janela -- que e por onde a luz entra e por onde ela ricocheteia
   do chao -- e cai um pouco de novo no forro.

   Sai de graca porque o prisma ja emite o vertice de baixo e o de cima separados: a
   gradacao e interpolada pelo proprio rasterizador, sem um triangulo a mais. */
function prismaQuad(P, N, C, U, q, y0, y1, rgb, fy, U2, pecas, semTampa, semPontas, fPonta) {
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
        const E = P(-g/2, o), F = P(L + g/2, o), G = P(L/2, o);
        pecaOr(dPin, E[0], E[1], dx, dz, g, 0.014, v.y0, yG, cEsq);
        pecaOr(dPin, F[0], F[1], dx, dz, g, 0.014, v.y0, yG, cEsq);
        if (yG > v.y1 + 0.004)
          pecaOr(dPin, G[0], G[1], dx, dz, L + g*2, 0.014, v.y1, yG, cEsq);
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

/* Tres malhas, nao uma: parede, piso frio e piso de madeira tem MAPA diferente, e mapa
   diferente e material diferente. Sao tres chamadas de desenho pro apartamento inteiro
   -- o mesmo que custavam duas mesas de cabeceira. */
/* ============================================================
   12b. Bake de luz — a irradiância do cômodo, medida uma vez  (v15)
   ============================================================
   O plano que pediu isto mandava construir os apartamentos no Unreal, bakear
   lightmap com Lumen e trazer as texturas pro Three. O RESULTADO que ele quer é
   este: a luz do cômodo deixa de ser um valor chapado por face e passa a ter
   canto escuro, contato com o piso e parede clara perto da janela — sem custar
   GPU no navegador. O CAMINHO é que não serve aqui: 30-60 MB de KTX2 por cidade
   quebram a página que abre em file:// com duplo clique, e um bake externo é
   uma segunda fonte de verdade pra mesma planta, que muda toda vez que alguém
   corrige um cômodo no cadastro.

   Então o bake roda AQUI, sobre a mesma geometria que já é gerada, e escreve no
   MESMO lugar que já existia: a cor por vértice. Três consequências que são o
   motivo de valer a pena:

   - CUSTO DE DESENHO ZERO. Não entra textura, atributo, material nem malha. As
     três malhas da casa (parede, piso frio, piso madeira) continuam sendo três
     chamadas de desenho. O que muda é o conteúdo do buffer de cor.

   - TRIÂNGULO É BARATO, CHAMADA É CARA — a mesma conta do móvel chanfrado. Cor
     por vértice só tem resolução onde há vértice, e um quad de parede tem
     quatro. Então a malha é TESSELADA a ~34 cm antes de assar: sai de centenas
     pra milhares de triângulos, que a GPU nem sente, e o gradiente passa a ter
     onde morar.

   - O QUE ELE SUBSTITUI. `fyParede` era uma curva escrita à mão (0,76 no
     rodapé, 1,04 no peitoril, 0,90 no forro) fingindo a queda de luz. Fingia
     igual em toda parede — a que fica de frente pra janela e a do fundo do
     banheiro saíam com o mesmo desenho. Com o bake ligado ela sai de cena; sem
     bake (planta sem parede, ou `?bake=0`) ela continua sendo o fallback.

   Como se mede a irradiância, já que não há Lumen:

     de cada vértice saem 48 raios cosseno-ponderados no hemisfério da normal;
     cada raio devolve CÉU (escapou da planta por um vão) ou a distância até o
     que bateu. Céu vale 1; bater vale pouco e proporcional à distância — que é
     o que faz canto de parede (bate a 20 cm) ficar escuro e meio de sala (bate
     a 3 m) ficar claro. É oclusão de ambiente com uma ricochetada, não path
     tracing; e é o que uma foto de apartamento vazio mostra.

   Duas decisões que não são óbvias:

   - A CONTA RODA NO REFERENCIAL DA PLANTA, não no do mundo. A planta é girada
     pra assentar no eixo maior do prédio, e o prédio está no rumo da rua. No
     mundo as paredes ficam a 14°, 98°, 136°... e a caixa envolvente de uma
     parede de 8 m a 45° cobre 64 células da grade de busca. No referencial da
     planta toda parede é paralela a um eixo e a caixa é uma fatia. A luz é
     invariante a rotação, então não se perde nada.

   - A NORMALIZAÇÃO É PELA MÉDIA. O bake sai como ganho relativo (média 1), não
     como brilho absoluto. Sem isso ele seria mais um botão de exposição, e a
     exposição deste projeto tem dono: `pipeline/mede_interior.py`, que reprova
     o build fora da faixa de 120 a 175 de média. Normalizado pela média, o que
     o bake acrescenta é CONTRASTE (a medida `faixa`, p95-p05) com a média
     praticamente parada.
   ============================================================ */

const BAKE = {
  passo:   0.40,   // aresta máxima do triângulo depois de tesselar (m)
  raios:   48,     // direções por vértice
  alcance: 6.0,    // até onde vale procurar oclusor (m)
  celula:  0.90,   // lado da célula da grade de busca (m)
  raster:  0.25,   // lado da célula do mapa "isto ainda é dentro da planta" (m)
  perto:   2.60,   // distância em que bater já não escurece (m)
  // Os quatro números da APARÊNCIA, e são os únicos que se calibra no olho + no
  // `mede_interior.py`. Foram parar aqui vindos de 0,60/0,70/0,58/1,28, que passava
  // em Ribeirão e REPROVAVA São Carlos: a vista da circulação do monte-das-colinas
  // é um corredor apertado, onde a oclusão é quase uniforme, e a faixa dinâmica caía
  // pra 65,8 contra o mínimo de 80. A curva `fyParede` que saiu de cena entregava
  // aquele contraste de graça, porque rampeava 0,76->1,04 em TODA parede, olhando ou
  // não pra janela. O bake precisou de contraste de verdade pra repor: céu contra
  // superfície de 1 pra 0,30 (era 1 pra 0,60), e gama acima de 1, que ABRE em vez de
  // fechar. Medido depois: São Carlos 90,4 e Ribeirão 84,6.
  bounce:  0.30,   // quanto uma superfície devolve, contra 1,0 do céu
  gama:    1.12,   // curva do ganho depois de normalizar (>1 abre o contraste)
  chao:    0.28, teto: 1.38,   // trava do ganho: nem preto no canto, nem estouro
  tinta:   1.0,    // amplitude do degradê de temperatura (0 = sem cor)
  suave:   2,      // passadas de suavização sobre a vizinhança do vértice
  raio:    0.45,   // raio dessa vizinhança, em metros
  fundo:   4,      // profundidade máxima de subdivisão (2^4 por aresta)
  tetoVert: 260000,            // guarda-chuva: para de subdividir se passar disto
  cache:   new Map(), guarda: 6,   // bake por unidade; 6 cabe de sobra
  fila:    null,   // contexto em andamento; o laco de quadro drena
  lote:    128,    // vértices traçados entre duas olhadas no relógio
  orcVoo:  12,     // ms por quadro DURANTE o voo de entrada
  orcamento: 4,    // ms por quadro depois que a câmera parou
  msPrep:  0,      // custo SINCRONO (tesselar + tabela de vertices)
  pronto:  false,
  ms:      0, vertices: 0, unicos: 0, tris: 0,
  on:      new URLSearchParams(location.search).get("bake") !== "0"
};

/* 48 direções cosseno-ponderadas, geradas uma vez. Hammersley (van der Corput na
   base 2) + Malley: sorteia no disco e levanta pra esfera — o cosseno sai da
   projeção, sem rejeição e sem acos. Y é o eixo da normal no espaço tangente. */
const BAKE_DIR = (() => {
  const n = BAKE.raios, d = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    let b = i, r = 0, f = 0.5;
    while (b) { r += (b & 1) * f; b >>= 1; f *= 0.5; }
    const sr = Math.sqrt(r), ph = 2 * Math.PI * ((i + 0.5) / n);
    d[i*3]   = sr * Math.cos(ph);
    d[i*3+1] = Math.sqrt(Math.max(0, 1 - r));
    d[i*3+2] = sr * Math.sin(ph);
  }
  return d;
})();

/* ---- a cena do bake: paredes, piso, forro e "onde acaba a planta" ------
   Só isto ocluí. Móvel não entra de propósito: as unidades cadastradas estão
   vazias (`planta.moveis` vazio em todas), e móvel arrastado pelo usuário
   invalidaria o bake a cada gesto. */
function cenaDoBake(pl) {
  const ob = pl.ob;
  const loc = (x, z) => [ (x - ob.cx) * ob.ux + (z - ob.cz) * ob.uz,
                         -(x - ob.cx) * ob.uz + (z - ob.cz) * ob.ux ];
  const segs = [];
  for (const w of pl.paredes) {
    const A = loc(w.a[0], w.a[1]), B = loc(w.b[0], w.b[1]);
    if (Math.abs(A[0]-B[0]) + Math.abs(A[1]-B[1]) < 1e-4) continue;
    segs.push({ ax:A[0], az:A[1], rx:B[0]-A[0], rz:B[1]-A[1], y0:w.y0, y1:w.y1 });
  }
  const polys = pl.contorno.map(c => c.map(p => loc(p[0], p[1])));
  let u0 = 1e9, u1 = -1e9, v0 = 1e9, v1 = -1e9;
  for (const c of polys) for (const p of c) {
    if (p[0] < u0) u0 = p[0]; if (p[0] > u1) u1 = p[0];
    if (p[1] < v0) v0 = p[1]; if (p[1] > v1) v1 = p[1];
  }
  u0 -= 1; v0 -= 1; u1 += 1; v1 += 1;

  // grade de busca: cada parede entra nas células da sua caixa envolvente. No
  // referencial da planta a caixa de uma parede é uma fatia de uma célula de
  // largura, então não há desperdício.
  const cel = BAKE.celula;
  const NI = Math.max(1, Math.ceil((u1-u0)/cel)), NJ = Math.max(1, Math.ceil((v1-v0)/cel));
  const bal = new Array(NI*NJ);
  for (let k = 0; k < segs.length; k++) {
    const s = segs[k];
    const i0 = Math.max(0,    Math.floor((Math.min(s.ax, s.ax+s.rx) - u0)/cel)),
          i1 = Math.min(NI-1, Math.floor((Math.max(s.ax, s.ax+s.rx) - u0)/cel)),
          j0 = Math.max(0,    Math.floor((Math.min(s.az, s.az+s.rz) - v0)/cel)),
          j1 = Math.min(NJ-1, Math.floor((Math.max(s.az, s.az+s.rz) - v0)/cel));
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      const c = i*NJ + j; (bal[c] || (bal[c] = [])).push(k);
    }
  }

  // mapa de pertinência: raio que sai da planta viu o céu. Testar polígono a
  // cada raio custaria mais que o raio; um raster de 25 cm resolve num índice.
  const rc = BAKE.raster;
  const RI = Math.max(1, Math.ceil((u1-u0)/rc)), RJ = Math.max(1, Math.ceil((v1-v0)/rc));
  const dentro = new Uint8Array(RI*RJ);
  for (let i = 0; i < RI; i++) for (let j = 0; j < RJ; j++) {
    const x = u0 + (i+0.5)*rc, z = v0 + (j+0.5)*rc;
    for (const c of polys) if (inside(c, x, z)) { dentro[i*RJ+j] = 1; break; }
  }
  // `gira` e o `loc` SEM a translacao: e o que converte a normal, que e direcao e
  // nao ponto. Faltava isto na primeira versao, e o efeito nao foi normal torta --
  // foi bake inteiro valendo 1: o vertice ficava no mundo, a parede no referencial
  // da planta, nenhum raio batia em nada e tudo virava ceu.
  const gira = (x, z) => [ x*ob.ux + z*ob.uz, -x*ob.uz + z*ob.ux ];
  return { segs, bal, NI, NJ, cel, u0, v0, dentro, RI, RJ, rc,
           pd: pl.pd, yPiso: 0.02, loc, gira,
           marca: new Int32Array(segs.length).fill(-1), rodada: 0 };
}

const _bakeDentro = (S, x, z) => {
  const i = Math.floor((x - S.u0)/S.rc), j = Math.floor((z - S.v0)/S.rc);
  return (i < 0 || j < 0 || i >= S.RI || j >= S.RJ) ? 0 : S.dentro[i*S.RJ + j];
};

/* Devolve a distância até o que o raio bateu, ou -1 se ele escapou pro céu.
   O passeio é 2D (DDA sobre a grade) e a altura entra só no teste do vão: é o
   que faz a janela ser janela — parede embaixo do peitoril, parede acima da
   verga, e nada no meio. */
function bakeRaio(S, ox, oy, oz, dx, dy, dz) {
  const alc = BAKE.alcance;
  const h = Math.hypot(dx, dz);
  let melhor = Infinity;

  if (h > 1e-6) {
    const ex = dx/h, ez = dz/h, sLim = alc * h;
    S.rodada++;
    let ci = Math.floor((ox - S.u0)/S.cel), cj = Math.floor((oz - S.v0)/S.cel);
    const pi = ex > 0 ? 1 : -1, pj = ez > 0 ? 1 : -1;
    const dI = Math.abs(ex) > 1e-9 ? Math.abs(S.cel/ex) : Infinity;
    const dJ = Math.abs(ez) > 1e-9 ? Math.abs(S.cel/ez) : Infinity;
    let nI = dI === Infinity ? Infinity
           : ((ex > 0 ? (ci+1)*S.cel + S.u0 - ox : ox - (ci*S.cel + S.u0)) / Math.abs(ex));
    let nJ = dJ === Infinity ? Infinity
           : ((ez > 0 ? (cj+1)*S.cel + S.v0 - oz : oz - (cj*S.cel + S.v0)) / Math.abs(ez));
    let s = 0;
    while (s <= sLim && ci >= 0 && cj >= 0 && ci < S.NI && cj < S.NJ) {
      const lista = S.bal[ci*S.NJ + cj];
      if (lista) for (let n = 0; n < lista.length; n++) {
        const k = lista[n];
        if (S.marca[k] === S.rodada) continue;
        S.marca[k] = S.rodada;
        const g = S.segs[k];
        const den = ex*g.rz - ez*g.rx;
        if (den > -1e-12 && den < 1e-12) continue;
        const qx = g.ax - ox, qz = g.az - oz;
        const t = (qx*g.rz - qz*g.rx) / den;
        if (t <= 0.10 || t >= melhor || t > sLim) continue;
        const u = (qx*ez - qz*ex) / den;
        if (u < 0 || u > 1) continue;
        const y = oy + dy*(t/h);
        if (y >= g.y0 && y <= g.y1) melhor = t;
      }
      if (melhor < (nI < nJ ? nI : nJ)) break;
      if (nI < nJ) { s = nI; nI += dI; ci += pi; } else { s = nJ; nJ += dJ; cj += pj; }
    }
  }

  const tPar = melhor === Infinity ? Infinity : melhor / h;
  let tFC = Infinity;
  if (dy < -1e-6)     { const t = (S.yPiso - oy)/dy; if (t > 0.03) tFC = t; }
  else if (dy > 1e-6) { const t = (S.pd    - oy)/dy; if (t > 0.03) tFC = t; }

  if (tPar < tFC) return tPar < alc ? tPar : alc;
  if (tFC < alc) return _bakeDentro(S, ox + dx*tFC, oz + dz*tFC) ? tFC : -1;
  return _bakeDentro(S, ox + dx*alc, oz + dz*alc) ? alc : -1;
}

/* ---- tesselação: aresta longa vira aresta curta -----------------------
   Divisão pelo ponto médio (1 triângulo -> 4), recursiva enquanto a maior aresta
   passar do passo. Preserva a forma, então testar aresta basta — não precisa de
   área nem de proporção. Normal, cor e UV são interpolados; como cada face aqui
   é plana, a normal do filho é a do pai. */
function tesselaSopa(P, N, C, U, passo) {
  const oP = [], oN = [], oC = [], oU = [], p2 = passo*passo;
  const emite = v => { oP.push(v[0],v[1],v[2]); oN.push(v[3],v[4],v[5]);
                       oC.push(v[6],v[7],v[8]); oU.push(v[9],v[10]); };
  const meio = (a, b) => { const m = new Array(11);
                           for (let k = 0; k < 11; k++) m[k] = (a[k]+b[k])*0.5; return m; };
  const d2 = (a, b) => { const x=a[0]-b[0], y=a[1]-b[1], z=a[2]-b[2]; return x*x+y*y+z*z; };
  const parte = (a, b, c, nv) => {
    if (nv >= BAKE.fundo || oP.length > BAKE.tetoVert*3 ||
        (d2(a,b) <= p2 && d2(b,c) <= p2 && d2(c,a) <= p2)) {
      emite(a); emite(b); emite(c); return;
    }
    const ab = meio(a,b), bc = meio(b,c), ca = meio(c,a);
    parte(a, ab, ca, nv+1); parte(ab, b, bc, nv+1);
    parte(ca, bc, c, nv+1); parte(ab, bc, ca, nv+1);
  };
  for (let i = 0; i < P.length; i += 9) {
    const v = k => { const o = i + k*3, w = (i/3 + k)*2;
      return [P[o],P[o+1],P[o+2], N[o],N[o+1],N[o+2], C[o],C[o+1],C[o+2], U[w],U[w+1]]; };
    parte(v(0), v(1), v(2), 0);
  }
  return { P: oP, N: oN, C: oC, U: oU };
}

/* ---- o bake propriamente -----------------------------------------------
   Recebe os grupos de atributo já montados (parede, piso frio, piso madeira),
   devolve os mesmos grupos tesselados e com a cor multiplicada pela
   irradiância. A média é GLOBAL aos três: normalizar cada malha pela própria
   média deixaria piso e parede com o mesmo brilho médio, que é justamente o que
   se quer evitar. */
/* O bake em TRES tempos, e nao num bloco so. Medido com relogio de verdade
   (`--virtual-time-budget` congela `performance.now()` durante JS sincrono, e por
   isso a sonda relatava 0 ms): assar o mirra-114 de uma vez custa 948 ms. O voo
   de entrada dura 1.100 -- ou seja, a versao sincrona comia a animacao inteira e
   entregava um engasgo no lugar do que ela veio melhorar.

   Entao: `bakePrepara` tessela e monta a tabela de vertices (barato, sai junto
   com a malha); `bakePasso` traca alguns milhares de vertices por quadro dentro
   de um orcamento; `bakeFecha` suaviza, normaliza e escreve na cor. A casa
   aparece na hora com o albedo puro e a luz ASSENTA durante o voo.

   `bakeAgora()` termina o que falta de uma vez -- e o que as sondas chamam, pra
   nao fotografar uma cena assando pela metade e aprovar outra coisa. */
function bakePrepara(pl, grupos) {
  const _t0 = (typeof performance !== "undefined" && performance.now)
                ? performance.now() : Date.now();
  const S = cenaDoBake(pl);
  if (!S.segs.length) return null;      // planta sem parede: não há o que ocluir

  // Vértice repetido é a REGRA numa sopa de triângulos (3 cópias por face, e as
  // faces vizinhas repetem a aresta). Juntar as cópias serve a duas coisas: o
  // raio de cada ponto é traçado uma vez só (37 mil em vez de 219 mil), e a
  // vizinhança fica conhecida -- que é do que a suavização vive.
  const malhas = [], chave = new Map(), pos = [], nrm = [], idx = [];
  for (const g of grupos) {
    if (!g[0].length) { malhas.push(null); idx.push(null); continue; }
    const t = tesselaSopa(g[0], g[1], g[2], g[3], BAKE.passo);
    const n = t.P.length / 3, ix = new Int32Array(n);
    for (let i = 0; i < n; i++) {
      // a geometria está no MUNDO; a cena do bake, no referencial da planta.
      const q = S.loc(t.P[i*3], t.P[i*3+2]), qn = S.gira(t.N[i*3], t.N[i*3+2]);
      // TETO DA AMOSTRA: o vertice que esta ACIMA DO FORRO nao pode ser assado onde
      // ele esta. A parede sobe `SOBE_FORRO` alem do forro de proposito (senao a tampa
      // do prisma briga com o forro pelo mesmo pixel, ver `yTopo`), so que la em cima
      // ela esta FORA do comodo: o raio sai por sobre o forro, ve espaco aberto e volta
      // com irradiancia de fachada. A face lateral da parede interpola desse vertice
      // pra baixo, e o valor escorre pra dentro -- que e o FIO CLARO na junta
      // parede-teto que o usuario viu ("vazamento de luz"). Confirmado por A/B: com
      // `?bake=0` a junta sai limpa. Amostrar 2 cm abaixo do forro devolve o valor que
      // o ponto teria se a parede terminasse nele, que e o que se quer desenhar.
      //
      // E O MESMO DEFEITO NA OUTRA PONTA, que ficou de fora e e o "vazamento pela
      // quina perto do chao": a parede comeca em y=0 e o piso esta em y=0,02, entao a
      // base do prisma (e o rodape inteiro, que nasce em 0,02) esta NO NIVEL do piso
      // ou abaixo dele. Em `bakeRaio` o piso so entra como oclusor quando o raio o
      // cruza a mais de 3 cm -- de py=0 o cruzamento da t negativo, de py=0,02 da
      // zero, e nos dois casos o raio que DESCE nao bate em nada: cai no teste de
      // pertinencia a 6 m, que numa parede externa cai fora da planta e volta como
      // CEU (peso 1,0, contra 0,30 de superficie). Metade do hemisferio de um vertice
      // de normal horizontal aponta pra baixo, entao a base ganhava ate ~50% de ceu
      // que ela nao ve, e o valor escorria pra cima ate o proximo vertice (40 cm) mais
      // o raio da suavizacao (45 cm) -- a faixa clara de ~80 cm na junta chao-parede.
      // Medido no mirra-114: da altura do olho pra base a parede SUBIA 84 -> 111.
      // Piso da amostra 4 cm acima do piso e nao 2: o pior caso do corte de 3 cm e o
      // raio vertical (|dy| = 1), onde t vale a propria altura.
      const py = Math.min(Math.max(t.P[i*3+1], S.yPiso + 0.04), (pl.pd || PD) - 0.02);
      const px = q[0], pz = q[1];
      const nx = qn[0], ny = t.N[i*3+1], nz = qn[1];
      // CHAVE NUMERICA, nao string. Sao ~180 mil vertices, e montar 180 mil
      // strings custava a maior parte dos 190 ms sincronos desta etapa -- que e a
      // unica parte do bake que o usuario espera. 2 cm em 12 bits por eixo cobrem
      // +-40 m (planta nenhuma chega perto), e a normal cabe em 27 casos porque
      // aqui toda face e plana e axial. 2^41 e inteiro exato em ponto flutuante.
      const qx = ((px*50 + 2048) | 0), qy = ((py*50 + 2048) | 0), qz = ((pz*50 + 2048) | 0);
      const ch = ((qx*4096 + qy)*4096 + qz)*27
               + ((nx > 0.5 ? 2 : nx < -0.5 ? 0 : 1)*9
                + (ny > 0.5 ? 2 : ny < -0.5 ? 0 : 1)*3
                + (nz > 0.5 ? 2 : nz < -0.5 ? 0 : 1));
      let k = chave.get(ch);
      if (k === undefined) {
        k = pos.length / 3; chave.set(ch, k);
        pos.push(px, py, pz); nrm.push(nx, ny, nz);
      }
      ix[i] = k;
    }
    malhas.push(t); idx.push(ix);
  }
  const nu = pos.length / 3;
  // esta parte E sincrona (a malha depende dela). Medida separada de proposito:
  // se um dia ela passar de ~1 quadro, e ela que precisa fatiar, nao o traco.
  BAKE.msPrep = ((typeof performance !== "undefined" && performance.now)
                   ? performance.now() : Date.now()) - _t0;
  return { S, malhas, idx, pos, nrm, nu, E: new Float32Array(nu),
           Ceu: new Float32Array(nu), i: 0, gl: null, ch: null, ms: 0 };
}

function bakePasso(ctx, orcamento) {
  const agora = () => (typeof performance !== "undefined" && performance.now)
                        ? performance.now() : Date.now();
  const t0 = agora();
  const P = ctx.pos, N = ctx.nrm;
  while (ctx.i < ctx.nu) {
    // lote: chamar o relógio por vértice custaria mais que o vértice; mas um lote
    // grande demais estoura o orçamento antes da primeira olhada. Medido, o traço
    // sai a ~19 µs por vértice nesta máquina -- 128 dá ~2,4 ms, que cabe no menor
    // dos dois orçamentos. Com 512 (a primeira escolha) cada quadro gastava 9,7 ms
    // achando que gastava 4.
    const fim = Math.min(ctx.nu, ctx.i + BAKE.lote);
    for (let k = ctx.i; k < fim; k++) {
      ctx.E[k] = bakeVertice(ctx.S, P[k*3], P[k*3+1], P[k*3+2], N[k*3], N[k*3+1], N[k*3+2]);
      ctx.Ceu[k] = _bakeCeu;
    }
    ctx.i = fim;
    if (agora() - t0 > orcamento) { ctx.ms += agora() - t0; return false; }
  }
  ctx.ms += agora() - t0;
  bakeFecha(ctx);
  return true;
}

function bakeFecha(ctx) {
  const nu = ctx.nu;
  if (!nu) { BAKE.pronto = true; return; }   // planta so com esquadria: nada a assar
  let E = _bakeSuaviza(ctx.pos, ctx.nrm, ctx.E, nu);
  // a fracao de ceu passa pelo MESMO filtro: sem isso a temperatura chega ruidosa
  // e a parede fica manchada de azul e bege em vez de virar um degrade.
  const CEU = _bakeSuaviza(ctx.pos, ctx.nrm, ctx.Ceu, nu);
  // NORMALIZAR PELA MEDIANA, não pela média. A distribuição da irradiância num
  // apartamento é torta pra direita: quase toda superfície enxerga o mesmo pouco
  // (parede de frente pra parede), e uma minoria -- o que dá de cara pra janela
  // -- enxerga muito. Com a média, essa minoria puxa o divisor pra cima e a
  // PAREDE TÍPICA sai escurecida; medido, a mediana do ganho ficava em 0,82, ou
  // seja o bake virava um botão de exposição pra baixo -- que é o que ele não
  // pode ser, porque a exposição tem dono (`pipeline/mede_interior.py`). Pela
  // mediana, a parede típica fica onde estava e o bake só mexe nos extremos.
  const ord = Array.prototype.slice.call(E).sort((a, b) => a - b);
  const med = ord[ord.length >> 1] || 1;
  let baixo = 0, alto = 0;
  const ganho = new Float32Array(nu);
  for (let k = 0; k < nu; k++) {
    let g = Math.pow(Math.max(1e-3, E[k]/med), BAKE.gama);
    if (g < BAKE.chao) { g = BAKE.chao; baixo++; }
    else if (g > BAKE.teto) { g = BAKE.teto; alto++; }
    ganho[k] = g;
  }
  // TEMPERATURA: o vertice que enxerga muito ceu recebe luz fria; o que so enxerga
  // parede recebe o que ricocheteou, que e quente. `BAKE.tinta` e a amplitude --
  // pequena de proposito, porque a cor tem dono (o cadastro) e isto e a LUZ, nao a
  // tinta da parede. A referencia de calibragem e a mediana da fracao de ceu, nao
  // zero: senao um apartamento inteiro de frente pra janela sairia todo azul.
  let somaCeu = 0;
  for (let k = 0; k < nu; k++) somaCeu += CEU[k];
  const medCeu = (somaCeu / nu) || 0.001;
  const TQ = [1.045, 0.998, 0.928];   // quente: o que voltou do piso
  const TF = [0.958, 0.992, 1.062];   // frio: o que veio do ceu
  const tinta = new Float32Array(nu * 3);
  for (let k = 0; k < nu; k++) {
    let d = (CEU[k] - medCeu) / Math.max(0.08, medCeu);   // -1 fundo, +1 janela
    d = d < -1 ? -1 : (d > 1 ? 1 : d);
    const f = 0.5 + 0.5 * d, q = 1 - f;
    for (let c = 0; c < 3; c++)
      tinta[k*3+c] = 1 + ((TQ[c]-1)*q + (TF[c]-1)*f) * BAKE.tinta;
  }
  for (let m = 0; m < ctx.malhas.length; m++) {
    const t = ctx.malhas[m]; if (!t) continue;
    const ix = ctx.idx[m];
    for (let i = 0; i < ix.length; i++) {
      const k = ix[i], g = ganho[k];
      for (let c = 0; c < 3; c++) {
        const v = t.C[i*3+c] * g * tinta[k*3+c];
        t.C[i*3+c] = v > 255 ? 255 : (v < 0 ? 0 : v);
      }
    }
    // a malha já está na tela com o albedo puro: aqui a cor assentada entra no
    // buffer que já existe, sem recriar geometria nem chamada de desenho.
    const at = ctx.gl && ctx.gl[m] && ctx.gl[m].geometry.attributes.color;
    if (at) { at.array.set(t.C); at.needsUpdate = true; }
  }
  if (ctx.ch) {
    if (BAKE.cache.size >= BAKE.guarda) BAKE.cache.delete(BAKE.cache.keys().next().value);
    BAKE.cache.set(ctx.ch, ctx.malhas);
  }
  BAKE.ms = ctx.ms; BAKE.unicos = nu; BAKE.med = med; BAKE.pronto = true;
  BAKE.vertices = ctx.malhas.reduce((a, t) => a + (t ? t.P.length/3 : 0), 0);
  BAKE.tris = BAKE.vertices/3;
  BAKE.k = _bakePerfil(ganho, baixo, alto, nu);
}

/* Termina o bake pendente de uma vez. Chamado pelas sondas headless -- sem isto
   elas fotografam a cena assando pela metade e aprovam outra coisa -- e por quem
   nao pode esperar o quadro seguinte. */
function bakeAgora() {
  if (!BAKE.fila) return false;
  bakePasso(BAKE.fila, 1e9);
  BAKE.fila = null;
  return true;
}

/* Suavizacao por VIZINHANCA NO ESPACO, nao por aresta da malha.

   Duas coisas de uma vez:

   - RUIDO. 48 raios deixam ~14% de ruido de Monte Carlo, e num quad de parede
     isso le como MANCHA -- pior que o defeito que o bake veio consertar, porque
     parede manchada parece sujeira, nao iluminacao. Oclusao de ambiente e um
     campo de baixa frequencia por natureza, entao borrar nao perde detalhe. Sai
     mais barato que subir a contagem de raios (4x pra metade do ruido).

   - EMENDA. A parede de um comodo nao e uma peca: `paredesDaGrade` corta ela em
     cada vao, e cada pedaco vira um prisma proprio, com tampa nas pontas. Os
     vertices dos dois lados da emenda NAO coincidem, entao pela malha eles nao
     sao vizinhos -- e a media por aresta deixava um DEGRAU vertical em cada
     emenda. Com pouco contraste ninguem via; ao subir o contraste pra faixa
     dinamica passar no portao, as emendas apareceram como listras na parede.
     Vizinhanca por distancia atravessa a emenda, porque ela nao existe no
     espaco: os dois pedacos sao a mesma parede.

   O filtro de normal (`dot > 0,80`) e o que impede o borrao de atravessar quina:
   duas faces perpendiculares tem que poder ter irradiancia diferente -- e essa
   diferenca E a quina. Duas faces da MESMA parede olham pra lados opostos
   (produto negativo), entao tambem nao se misturam. */
function _bakeSuaviza(pos, nrm, E, nu) {
  const R = BAKE.raio, R2 = R*R;
  let u0 = 1e9, v0 = 1e9, w0 = 1e9;
  for (let k = 0; k < nu; k++) {
    if (pos[k*3]   < u0) u0 = pos[k*3];
    if (pos[k*3+1] < v0) v0 = pos[k*3+1];
    if (pos[k*3+2] < w0) w0 = pos[k*3+2];
  }
  const cel = R;
  const bal = new Map();
  // +1024 em cada eixo porque a varredura 3x3x3 consulta indice -1, e sem o
  // deslocamento (i*4096+j) com j negativo colide com a celula (i-1, 4095).
  const chaveDe = (i, j, l) => ((i+1024)*4096 + (j+1024))*4096 + (l+1024);
  for (let k = 0; k < nu; k++) {
    const c = chaveDe(((pos[k*3]-u0)/cel)|0, ((pos[k*3+1]-v0)/cel)|0, ((pos[k*3+2]-w0)/cel)|0);
    const l = bal.get(c); if (l) l.push(k); else bal.set(c, [k]);
  }
  for (let passo = 0; passo < BAKE.suave; passo++) {
    const F = new Float32Array(nu);
    for (let k = 0; k < nu; k++) {
      const px = pos[k*3], py = pos[k*3+1], pz = pos[k*3+2];
      const nx = nrm[k*3], ny = nrm[k*3+1], nz = nrm[k*3+2];
      const ci = ((px-u0)/cel)|0, cj = ((py-v0)/cel)|0, cl = ((pz-w0)/cel)|0;
      let soma = E[k], peso = 1;
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let c = -1; c <= 1; c++) {
        const l = bal.get(chaveDe(ci+a, cj+b, cl+c));
        if (!l) continue;
        for (let i = 0; i < l.length; i++) {
          const j = l[i]; if (j === k) continue;
          if (nrm[j*3]*nx + nrm[j*3+1]*ny + nrm[j*3+2]*nz < 0.80) continue;
          const dx = pos[j*3]-px, dy = pos[j*3+1]-py, dz = pos[j*3+2]-pz;
          const d2 = dx*dx + dy*dy + dz*dz;
          if (d2 > R2) continue;
          const p = 1 - Math.sqrt(d2)/R;      // triangular: vizinho longe pesa menos
          soma += E[j]*p; peso += p;
        }
      }
      F[k] = soma/peso;
    }
    E = F;
  }
  return E;
}

function _bakePerfil(ganho, baixo, alto, nu) {
  const v = Array.prototype.slice.call(ganho).sort((a, b) => a - b);
  const q = f => +(v[Math.min(v.length-1, Math.floor(f*v.length))] || 0).toFixed(3);
  return { min:q(0), p05:q(0.05), p50:q(0.50), p95:q(0.95), max:q(0.999),
           travadoBaixo:+(baixo/nu*100).toFixed(1), travadoAlto:+(alto/nu*100).toFixed(1) };
}

/* Devolve DOIS numeros por vertice: quanta luz chega, e QUANTO DELA E CEU.

   O segundo e o que faltava pro interior ter jogo de cor. Numa foto de apartamento
   as duas metades do quadro nunca tem a mesma cor de luz: perto da janela o que
   ilumina e ceu, que e frio; no fundo do corredor o que ilumina e o que ja
   ricocheteou no piso e na parede, que e quente. E um degrade de TEMPERATURA ao
   longo da profundidade, e ele carrega mais leitura de "foto" do que qualquer
   ganho de resolucao.

   Nao custa raio a mais: a fracao de ceu ja estava sendo contada dentro da soma, so
   nao estava saindo. */
function bakeVertice(S, px, py, pz, nx, ny, nz) {
  // base ortonormal com Y na normal. O vetor auxiliar troca quando a normal já é
  // Y, senão o produto vetorial degenera, a base sai nula e o vértice fica preto.
  const eixoX = Math.abs(ny) > 0.9 ? 1 : 0, eixoY = Math.abs(ny) > 0.9 ? 0 : 1;
  let tx = eixoY*nz, ty = -eixoX*nz, tz = eixoX*ny - eixoY*nx;
  const tl = Math.hypot(tx, ty, tz) || 1; tx /= tl; ty /= tl; tz /= tl;
  const bx = ny*tz - nz*ty, by = nz*tx - nx*tz, bz = nx*ty - ny*tx;
  const ox = px + nx*0.02, oy = py + ny*0.02, oz = pz + nz*0.02;

  let soma = 0, ceu = 0;
  for (let r = 0; r < BAKE.raios; r++) {
    const a = BAKE_DIR[r*3], b = BAKE_DIR[r*3+1], c = BAKE_DIR[r*3+2];
    const dx = tx*a + nx*b + bx*c, dy = ty*a + ny*b + by*c, dz = tz*a + nz*b + bz*c;
    const d = bakeRaio(S, ox, oy, oz, dx, dy, dz);
    if (d < 0) { soma += 1; ceu++; }
    else soma += BAKE.bounce * Math.min(1, d/BAKE.perto);
  }
  _bakeCeu = ceu / BAKE.raios;
  return soma / BAKE.raios;
}
// Saida secundaria do ultimo `bakeVertice`. Variavel de modulo em vez de par
// devolvido: sao ~30 mil chamadas por unidade e alocar um array em cada uma so pra
// carregar um float e desperdicio que aparece no orcamento de quadro.
let _bakeCeu = 0;

function geoDaCasa(pl, comTeto) {
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
  for (let i = 0; i < pl.paredes.length; i++) {
    const w = pl.paredes[i];
    const yTopo = w.y1 >= pl.pd - 0.01 ? pl.pd + SOBE_FORRO : w.y1;
    const dxw = w.b[0]-w.a[0], dzw = w.b[1]-w.a[1];
    const Lw = Math.hypot(dxw, dzw) || 1, exw = dxw/Lw, ezw = dzw/Lw;
    const wa = w.pa ? w.a : [w.a[0] - exw*EXT, w.a[1] - ezw*EXT];
    const wb = w.pb ? w.b : [w.b[0] + exw*EXT, w.b[1] + ezw*EXT];
    prismaQuad(P, N, C, U, quadDoSeg([wa, wb], ESP), w.y0, yTopo, parede,
               (assar || LUZ) ? null : fyParede,
               U2, LUZ && cinco(f => LUZ.parede(i, f)), false,
               (w.pa ? 0 : 1) | (w.pb ? 0 : 2), 0.80);
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
      prismaQuad(P, N, C, U, quadDoSeg([wa, wb], ESP + 0.032), 0.02, 0.115, rodape,
                 null, U2, LUZ && cinco(f => LUZ.rodape(i, f)), true,
                 (w.pa ? 0 : 1) | (w.pb ? 0 : 2));
  }
  if (comTeto) for (let i = 0; i < pl.contorno.length; i++)
    piso(dPar, pl.contorno[i], pl.pd, teto, false, 1.2, LUZ && LUZ.teto(i));
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
  if (ctx) { ctx.gl = gl; BAKE.fila = ctx; }
  // Esquadria DEPOIS das três: `mede_interior.py` lê `INT.casa.children[1]` pra provar
  // que o piso recebe sombra, e entrar no meio da fila trocaria o piso por um batente.
  for (const m of geoDasEsquadrias(pl)) grupo.add(m);
  return grupo;
}

/* ---- estado ----------------------------------------------------------- */
const INT = { luzes:[], sombra:null, brilho:null, lamps:[], pool:[], chaveLuz:"",
              plafons:null, chaves:null,
              on:false, fp:false, orbita:false, pl:null, raiz:null, casa:null, moveis:[],
              sel:-1, teto:false, baseY:0, alvo:null, voo:null,
              corteAlvo:CORTE_OFF, salvo:null, rotulos:[] };
const FP = { pos:new THREE.Vector3(), yaw:0, pitch:-0.05, mov:{ x:0, z:0 } };
// Ponteiro grosso = dedo. Serve pra decidir o que aparece, nao o que funciona: o
// arrasto pra olhar em volta ja e evento de ponteiro e vale nos dois.
const TOQUE = matchMedia("(pointer:coarse)").matches || innerWidth < 820;
const teclas = Object.create(null);

const chaveSalva = id => "int_" + CIDADE.slug + "_" + id;
function salvaMoveis() {
  if (!INT.pl) return;
  sujaLuzes();
  try {
    localStorage.setItem(chaveSalva(INT.pl.id), JSON.stringify(INT.moveis.map(m =>
      ({ t:m.tipo, u:+m.u.toFixed(3), v:+m.v.toFixed(3), r:m.rot,
         w:+m.w.toFixed(3), d:+m.d.toFixed(3), h:+m.h.toFixed(3), c:m.cor }))));
  } catch (e) { /* aba anônima / cota cheia: o layout só não persiste */ }
}
function leMoveis(id) {
  try {
    const s = localStorage.getItem(chaveSalva(id));
    if (!s) return null;
    const a = JSON.parse(s);
    if (!Array.isArray(a) || !a.length) return null;
    return a.filter(m => MOVEIS[m.t]).map(m =>
      ({ tipo:m.t, u:m.u, v:m.v, rot:m.r|0, w:m.w, d:m.d, h:m.h, cor:m.c }));
  } catch (e) { return null; }
}

/* ---- um móvel na cena -------------------------------------------------- */
function poeNaCena(m) {
  const o = geoDoMovel(MOVEIS[m.tipo], m.cor, m);
  m.obj = o; o.userData.movel = m;
  for (const f of o.children) f.userData.movel = m;   // o raio bate na malha, não no grupo
  atualizaMovel(m);
  INT.raiz.add(o);
}
function atualizaMovel(m) {
  const def = MOVEIS[m.tipo], o = m.obj;
  if (!o) return;
  const p = INT.pl.W(m.u, m.v);
  o.position.set(p[0], 0.03, p[1]);
  if (def.param) refazParam(m, def);
  else o.scale.set(m.w/def.b[0], m.h/def.b[1], m.d/def.b[2]);
  o.rotation.y = Math.atan2(-INT.pl.ob.uz, INT.pl.ob.ux) + m.rot * Math.PI/2;
}
/* Peca parametrica nasce na medida, entao a escala fica 1 e quem muda e a MALHA.
   So remonta quando a medida (ou a cor) mudou de verdade: `atualizaMovel` tambem e
   chamado a cada quadro do gesto de MOVER, e ali a geometria e a mesma -- remontar
   ali seria jogar fora uma geometria que o FANTASMA esta usando (ele compartilha a
   malha de proposito; ver `poeFantasma`). */
function refazParam(m, def) {
  const o = m.obj, a = m._b;
  if (a && a[0] === m.w && a[1] === m.h && a[2] === m.d && a[3] === m.cor) return;
  m._b = [m.w, m.h, m.d, m.cor];
  o.scale.set(1, 1, 1);
  const malha = o.children[0];
  if (!malha) return;
  const velha = malha.geometry;
  malha.geometry = geoDeParts(def.param(m), m.cor);
  // `MOB` so existe na variante do MODO MOVEIS; nas outras o `typeof` devolve
  // "undefined" e a geometria velha e liberada sempre.
  if (typeof MOB === "undefined" || !MOB.fantasma) velha.dispose();
}
// Refaz a malha em vez de reescrever a cor vértice a vértice: com chanfro e esfera a
// contagem por peça deixou de ser fixa, e montar de novo custa menos de um milissegundo.
function recolore(m) {
  const novo = geoDoMovel(MOVEIS[m.tipo], m.cor, m);
  m.obj.traverse(o => { if (o.geometry) o.geometry.dispose(); });
  INT.raiz.remove(m.obj);
  novo.userData.movel = m;
  for (const f of novo.children) f.userData.movel = m;
  m.obj = novo;
  atualizaMovel(m);
  INT.raiz.add(novo);
}

// Contorno de seleção: uma malha de linhas só, reposicionada e reescalada.
const selBox = (() => {
  const e = [[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]];
  const v = [[-0.5,0,-0.5],[0.5,0,-0.5],[0.5,0,0.5],[-0.5,0,0.5],
             [-0.5,1,-0.5],[0.5,1,-0.5],[0.5,1,0.5],[-0.5,1,0.5]];
  const P = [];
  for (const p of e) { P.push(v[p[0]][0],v[p[0]][1],v[p[0]][2], v[p[1]][0],v[p[1]][1],v[p[1]][2]); }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(P), 3));
  const o = new THREE.LineSegments(g, new THREE.LineBasicMaterial({
    color:0x5FC777, transparent:true, opacity:0.9, depthTest:false }));
  o.renderOrder = 5; o.visible = false;
  return o;
})();
gInteriores.add(selBox);

function seleciona(i) {
  INT.sel = i;
  const m = INT.moveis[i];
  selBox.visible = !!m;
  if (m) {
    const p = INT.pl.W(m.u, m.v);
    selBox.position.set(p[0], INT.baseY + 0.03, p[1]);
    selBox.rotation.y = m.obj.rotation.y;
    selBox.scale.set(m.w, Math.max(0.12, m.h), m.d);
  }
  pintaEditor();
}

/* ---- entrar e sair ----------------------------------------------------- */
const _m4 = new THREE.Matrix4(), _up = new THREE.Vector3(0,1,0);
function quatOlhando(de, para) {
  _m4.lookAt(de, para, _up);
  return new THREE.Quaternion().setFromRotationMatrix(_m4);
}
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
// A unidade fornecida mora num ANDAR: o piso dela nasce em base + andar x pé-direito
// de pavimento. O relevo escala só a parte do terreno -- o prédio não fica mais alto
// porque o morro subiu.
/* ---- luz de dentro -----------------------------------------------------
   O sol e a hemisferica servem a CIDADE: vem de cima, de longe, e nao sabem que ha um
   forro no caminho. Dentro do apartamento o que existe e luminaria de teto -- luz
   proxima, quente, com queda -- e e ela que separa um comodo do outro. As luzes so
   existem enquanto se esta dentro: acrescentar luz muda a contagem do shader e obriga
   a recompilar todo material da cena, entao o preco e pago no voo de entrada, que dura
   1,1 s e esconde o engasgo, em vez de ficar pesando na cidade o tempo todo.

   Nenhuma delas projeta sombra. Luz pontual com sombra e um cubemap por luz, seis
   renderizacoes da cena por quadro cada uma -- com onze comodos seria o fim. A sombra
   vem do sol, uma so, que ja estava ligada. */
/* ---- céu de dentro de casa -------------------------------------------
   A cidade não tem céu, tem COR DE LIMPEZA: um cinza-ardósia igual ao da névoa, e é
   justamente essa igualdade que faz o horizonte fechar sem costura vista de fora. De
   dentro do apartamento não funciona -- a moldura da janela recorta um retângulo
   daquele cinza, e o imóvel inteiro passa a ser anunciado num dia de chumbo.

   Então o céu existe SÓ dentro de casa, e custa uma chamada de desenho:

   - Textura equirretangular desenhada num `<canvas>` na primeira entrada. A página
     abre por duplo clique em `file://`, onde arquivo externo não existe; e desenhar só
     na primeira entrada mantém o custo fora do carregamento da cidade.
   - `depthTest:false` + `renderOrder` bem negativo: a cúpula pinta antes de tudo e o
     resto da cena a cobre pelo próprio desenho. Uma cúpula "longe o bastante" seria
     recortada -- nos níveis sem buffer logarítmico o `far` de dentro de casa é 6 km.
   - `toneMapped:false`: o céu sai na tela exatamente com a cor do canvas. Com o ACES a
     0,72 de exposição (que é o que o interior usa) qualquer azul autoral viraria um
     cinza-azulado, e eu estaria calibrando a olho uma cor que dá pra escrever.

   NUVEM É PINCEL, NÃO RUÍDO. Um FBM por pixel num canvas de 1024x512 são milhões de
   interpolações em JS no meio da transição de entrada; três dezenas de aglomerados de
   elipse com gradiente radial saem em poucos milissegundos e, no traço estilizado
   desta cidade, leem melhor que fractal. A semente é fixa (`hash`), então o céu é o
   mesmo em toda sessão -- a mesma regra da fachada.

   A NÉVOA VEM JUNTO. Sem isso o bairro ao fundo continua morrendo no cinza da cidade
   enquanto o céu atrás dele é azul, e a emenda aparece exatamente na linha do
   horizonte, que é o que a janela mais mostra. */
const CEU_ZENITE = "#3F7AC4", CEU_MEIO = "#7CB0DD", CEU_HORIZ = "#B4D0E8";
// A LINHA do horizonte, que era literal no `addColorStop`. E ela, e nao CEU_HORIZ,
// que a nevoa tem que casar: e o pixel exato com que o ceu encosta no chao.
const CEU_LINHA = "#C7D8E4";
function texturaDoCeu() {
  // `k` mantem o TAMANHO ANGULAR da nuvem igual nos dois niveis: o que a resolucao
  // muda e a nitidez da borda, nao o quanto de ceu cada nuvem ocupa.
  const W = NIVEL.ceuTex || 1024, H = W/2, k = W/1024;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const g = c.getContext("2d");
  const grd = g.createLinearGradient(0, 0, 0, H);
  grd.addColorStop(0.00, CEU_ZENITE);
  grd.addColorStop(0.30, CEU_MEIO);
  grd.addColorStop(0.47, CEU_HORIZ);
  grd.addColorStop(0.50, CEU_LINHA);   // a linha do horizonte: sempre a mais lavada
  grd.addColorStop(0.62, "#8A959E");   // abaixo dela quem manda é o chão da cidade;
  grd.addColorStop(1.00, "#5E666E");   // isto aqui só existe pra não ter emenda dura
  g.fillStyle = grd; g.fillRect(0, 0, W, H);

  // Uma bolha: elipse com gradiente radial, opaca no meio e nula na borda. É o tijolo
  // da nuvem -- o volume vem de empilhar bolha, não de desenhar contorno.
  const bolha = (x, y, rx, ry, cor, a) => {
    g.save();
    g.translate(x, y); g.scale(1, ry/rx);
    const rg = g.createRadialGradient(0, 0, rx*0.15, 0, 0, rx);
    rg.addColorStop(0, "rgba(" + cor + "," + a.toFixed(3) + ")");
    rg.addColorStop(0.55, "rgba(" + cor + "," + (a*0.72).toFixed(3) + ")");
    rg.addColorStop(1, "rgba(" + cor + ",0)");
    g.fillStyle = rg;
    g.beginPath(); g.arc(0, 0, rx, 0, Math.PI*2); g.fill();
    g.restore();
  };

  let n = 0;
  const r = () => hash((n++ * 2654435761) >>> 0);
  /* MUITAS nuvens PEQUENAS, não poucas grandes. A textura dá a volta nos 360 graus em
     1.024 pixels, ou seja 0,35 grau por texel: um aglomerado de 100 px ocupa 35 graus
     do céu e, magnificado assim, não lê como nuvem -- lê como mancha desfocada, que foi
     a primeira versão. Cúmulo de verdade a essa distância abre uns 8 a 20 graus. */
  const CLUSTERS = 96;
  for (let i = 0; i < CLUSTERS; i++) {
    const u = r();
    /* Faixa de céu em que a nuvem vive. Ela vai QUASE até o horizonte de propósito:
       de dentro de casa quem olha pela janela vê a faixa logo acima da linha do
       horizonte e quase nada do zênite -- na primeira versão as nuvens paravam a 11°
       de altura e simplesmente nunca apareciam pela janela. No zênite elas somem, aí
       sim: equirretangular estica tudo no polo e a bolha vira um borrão que dá a volta. */
    const t = 0.13 + r()*0.345;
    const cy = t * H;
    const perto = 1 - (t - 0.13)/0.345;         // 1 no alto, 0 encostando no horizonte
    const esc = 0.35 + perto*0.65;
    const w = (20 + r()*44) * esc * k, h = w * (0.34 + r()*0.20) * (0.45 + perto*0.55);
    const alfa = (0.55 + r()*0.40) * (0.35 + perto*0.65);
    const puffs = 6 + Math.floor(r()*7);
    // A cópia lateral só existe pra quem encosta na emenda da imagem (uma nuvem
    // cortada a faca em pleno céu); repetir as noventa e seis seria triplicar o
    // desenho pra consertar meia dúzia.
    const beira = u*W < w*1.2 ? W : (W - u*W < w*1.2 ? -W : 0);
    for (const dx of (beira ? [0, beira] : [0])) {
      const cx = u*W + dx;
      // sombra primeiro, deslocada pra baixo: é ela que separa a nuvem do fundo.
      for (let k = 0; k < puffs; k++) {
        const a2 = k/puffs*Math.PI*2 + r()*0.6;
        bolha(cx + Math.cos(a2)*w*0.42, cy + h*0.30 + Math.sin(a2)*h*0.30,
              w*(0.30 + r()*0.20), h*(0.52 + r()*0.30), "168,182,198", alfa*0.55);
      }
      for (let k = 0; k < puffs; k++) {
        const a2 = k/puffs*Math.PI*2 + r()*0.6;
        bolha(cx + Math.cos(a2)*w*0.44, cy - h*0.10 + Math.sin(a2)*h*0.34,
              w*(0.30 + r()*0.22), h*(0.55 + r()*0.35), "255,255,255", alfa);
      }
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  if ("colorSpace" in t) t.colorSpace = THREE.SRGBColorSpace; else t.encoding = THREE.sRGBEncoding;
  t.anisotropy = 4;
  return t;
}

let CEU = null;
function mostraCeu(on) {
  if (on && !CEU) {
    CEU = new THREE.Mesh(new THREE.SphereGeometry(500, 32, 20),
      new THREE.MeshBasicMaterial({ map: texturaDoCeu(), side: THREE.BackSide,
        depthWrite: false, depthTest: false, fog: false, toneMapped: false }));
    CEU.renderOrder = -1000;
    CEU.frustumCulled = false;
    scene.add(CEU);
  }
  if (CEU) CEU.visible = !!on;
}

/* A CIDADE PASSA A TER O MESMO CEU.
   O que segurava a cupula dentro de casa era a nota acima: vista de fora, a cor de
   limpeza fecha o horizonte sem costura. Fecha -- e e justamente por isso que o alto
   do quadro nao e ceu, e uma banda cinza chapada, medida num print de rua. A cupula
   ja custa UMA chamada de desenho, ja anda com a camera e ja vem com a nevoa casada;
   o que faltava era chamar.

   A nevoa fecha na faixa do HORIZONTE da propria textura (nao no zenite), senao o
   bairro ao fundo morre numa cor que o ceu nao tem em lugar nenhum -- a mesma emenda
   que a versao de dentro de casa evita, so que aqui ela e a linha mais vista da tela.
   O fator e 1,0 e nao o 0,72 do interior porque a exposicao aqui fora e 1,075 e nao
   0,72: o que tem que casar e a cor na TELA, nao o numero.

   `apagaInterior` ja restaurava a nevoa do que estava valendo antes de entrar, entao
   sair de casa volta pra ca sozinho -- e por isso o par mostraCeu(true)/(false) do
   interior saiu: o ceu deixou de ser propriedade do apartamento. */
mostraCeu(true);
/* `linearDe` NAO SERVE MAIS, e nao servia desde o salto de revisao. Ela emula o r128,
   que tratava `THREE.Color` como linear e nao convertia nada -- elevar a 2,2 era o que
   fazia o papel da conversao. Do r152 pra ca o gerenciamento de cor faz isso sozinho,
   entao a potencia entra DE NOVO em cima do que ja esta linear e a nevoa fecha numa cor
   escura demais. Medido no horizonte, com o ceu ligado: ceu (198,215,228) contra nevoa
   (119,163,207) -- 79 niveis de degrau, uma faixa azul mais escura que o proprio ceu.
   FOG_K compensa o ACES, que nao e identidade: a nevoa passa pelo mapeamento de tom na
   exposicao da cidade e o ceu nao (`toneMapped:false`). O numero saiu de medir o pixel
   Com a conversao certa nao sobrou compensacao pra fazer: a nevoa sai (199,216,228)
   contra (198,215,228) do ceu, um nivel de degrau. Nao ha constante de ajuste aqui
   porque o valor medido dela seria 1,0. */
scene.fog.color.set(CEU_LINHA);

const MAX_LUZES = 6;
function acendeInterior(pl) {
  apagaInterior();
  // A luz da cidade NAO some, ela cede espaco. Sol e hemisferica foram calibrados pra
  // iluminar telhado a ceu aberto; mantidos no valor cheio, somados a luminaria de teto
  // e ao ACES, o apartamento inteiro estourava em branco chapado -- foi o que apareceu
  // no primeiro teste. Aqui eles caem pro papel de luz que entra pela janela.
  INT.brilho = { sol: sun.intensity, hemi: hemi.intensity, exp: renderer.toneMappingExposure,
                 hcima: hemi.color.getHex(), hbaixo: hemi.groundColor.getHex(),
                 fog: scene.fog.color.getHex() };
  // O sol e quem faz SOMBRA; luminaria de teto so preenche. Na primeira mistura o
  // preenchimento era mais forte que ele e a sombra sumia: existia no mapa e nao
  // aparecia na tela. A proporcao aqui e ~60% sol / 40% preenchimento.
  // v15: COM ATLAS DO UNREAL, O PREENCHIMENTO SAI DE CENA.
  //
  // As luzes deste bloco existiam pra FINGIR o que o bake agora mede: a hemisferica
  // quente embaixo era a luz que ricocheteia do piso, e a luminaria de teto por comodo
  // era o preenchimento indireto. Mantidas junto com o lightmap, a mesma luz e contada
  // duas vezes -- medido: media 189,7 (o teto do portao e 175) e faixa dinamica 49,9
  // (o piso e 80). A cena ficava clara E chapada ao mesmo tempo, que e a assinatura de
  // luz somada em cima de luz.
  //
  // Com o atlas fica so o SOL, e fraco: ele nao ilumina, ele desenha o retangulo
  // nitido que entra pela janela. Todo o resto -- ambiente, ricochetada, canto escuro,
  // sombra suave -- ja esta no atlas, e veio de um caminho de luz de verdade.
  const assado = !!cursorDeLuz(pl);
  sun.intensity = (assado ? 1.05 : 1.95) * LUZ_PI;
  renderer.toneMappingExposure = assado ? 0.58 : 0.72;
  /* A nevoa fecha na cor do ceu, senao o bairro visto pela janela morre num cinza que
     o ceu nao tem em lugar nenhum, com azul atras dele -- e a emenda cai bem na linha
     do horizonte. Mesmo conserto de conversao da cupula da cidade (ver mostraCeu).
     O fator e uma RAZAO DE EXPOSICAO, e o antigo 0,72 estava invertido. A cupula tem
     `toneMapped:false`, entao o pixel de ceu e o mesmo aqui e na cidade; a nevoa passa
     pelo ACES. Pra sair na MESMA cor de tela com exposicao menor, o que entra tem que
     ser MAIOR na mesma proporcao -- ACES e a mesma funcao nos dois casos, e canal acima
     de 1 e justamente o que ela existe pra comprimir. */
  scene.fog.color.set(CEU_LINHA)
    .multiplyScalar(INT.brilho.exp / renderer.toneMappingExposure);
  /* A HEMISFERICA DA CIDADE E O QUE DEIXAVA A PAREDE SONSA. Ela vem calibrada pra
     telhado a ceu aberto: azul palido em cima, 0x1A222C (quase preto, e frio) embaixo.
     Dentro de casa a parede que nao pega sol fica com essa mistura e mais nada -- e
     duas fontes cinza-azuladas dao cinza sem croma nenhum. O olho le "sem cor", nao
     "na sombra", e a diferenca entre a parede iluminada e a do lado vira degrau de
     BRILHO quando na vida e degrau de MATIZ.

     Aqui ela troca de cor enquanto se esta dentro: continua fria em cima (o que entra
     pela janela e ceu) e vira quente embaixo, porque o que ilumina a parede por baixo
     e a luz que ja bateu no piso. A parede na sombra passa a ser bege, nao cinza. */
  // Azul palido em cima ANULAVA o bege da parede: numa superficie vertical a
  // hemisferica entra meio a meio, e uma metade fria contra uma quente da cinza. Aqui
  // o alto e quase neutro (e ceu filtrado por vidro, nao ceu) e o chao e francamente
  // quente, que e a luz que ja bateu no piso. As duas metades empurram pro mesmo lado.
  hemi.color.setHex(0xE9EDF4);
  hemi.groundColor.setHex(0xE2BC8E);
  // Nem tudo la dentro tem lightmap: batente, folha de porta, caixilho e vidro sao
  // malhas de esquadria, sem peca no atlas. Com hemisferica em zero elas ficavam
  // CINZA no meio de uma parede iluminada -- a moldura branca virava a coisa mais
  // escura do quadro. O resto de hemisferica existe pra elas.
  /* SO A JANELA ILUMINA. A hemisferica e a ambiente entram em TODA face, olhando ou
     nao pra fora -- e no valor antigo o fundo do corredor recebia quase a mesma luz
     que o peitoril. A casa saia acesa "por todos os cantos" sem haver de onde, que e
     exatamente o defeito reclamado olhando a tela. Aqui elas caem pro minimo que as
     pecas SEM lightmap precisam (batente, folha, caixilho e movel nao tem bake nem
     atlas; em zero eles viram silhueta preta no meio de parede iluminada). Quem
     ilumina o comodo passa a ser o sol pela abertura, o ceu que o bake mediu por essa
     mesma abertura e, quando alguem acende, a lampada -- ver `montaLuminarias`. */
  hemi.intensity = (assado ? 0.085 : 0.11) * LUZ_PI * FILL;
  const amb = new THREE.AmbientLight(0xFFEDD8, (assado ? 0.025 : 0.022) * LUZ_PI * FILL);
  scene.add(amb); INT.luzes.push(amb);
  // A luminaria de teto nao acende mais sozinha: virou LAMPADA, tem interruptor na
  // parede, comeca apagada e a luz dela para na parede. Ver secao 12d.
  montaLuminarias(pl);
  // A camera de sombra do sol e dimensionada pra CIDADE (1.280 m de lado, 2048 px =
  // 60 cm por texel). Isso nao enxerga um pe de cadeira. Aqui ela e reapontada pro
  // apartamento: ~25 m de lado dao 8 cm por texel, e a sombra de contato aparece.
  const sc2 = sun.shadow.camera;
  INT.sombra = { l:sc2.left, r:sc2.right, t:sc2.top, b:sc2.bottom,
                 n:sc2.near, f:sc2.far, bias:sun.shadow.bias, nb:sun.shadow.normalBias };
  const R = Math.max(pl.ob.hu, pl.ob.hv) + 4;
  sc2.left = -R; sc2.right = R; sc2.top = R; sc2.bottom = -R;
  // O near/far tambem: a camera de sombra da cidade cobre 3 km de profundidade, e a
  // 24 bits isso da ~0,2 mm de passo -- que parece muito ate lembrar que a sombra de
  // uma cadeira mede 2 cm de deslocamento. Com o plano longe assim, o `bias` que evita
  // acne come a sombra inteira. O sol fica sempre a 1.250 m do alvo (o deslocamento e
  // constante em frame()), entao aqui a faixa encolhe pra 80 m em volta dele.
  const D = Math.hypot(520, 940, 640);
  sc2.near = D - 40; sc2.far = D + 40;
  sc2.updateProjectionMatrix();
  sun.shadow.bias = -0.0002;
  sun.shadow.normalBias = 0.02;
}
function apagaInterior() {
  for (const l of INT.luzes) scene.remove(l);
  INT.luzes.length = 0;
  // As malhas morrem junto com INT.raiz (`descarta`); aqui so caem as referencias e o
  // pool, que vive na cena e nao na raiz.
  INT.lamps = []; INT.pool = []; INT.chaveLuz = "";
  INT.plafons = INT.chaves = null;
  if (INT.brilho) {
    sun.intensity = INT.brilho.sol;
    hemi.intensity = INT.brilho.hemi;
    hemi.color.setHex(INT.brilho.hcima);
    hemi.groundColor.setHex(INT.brilho.hbaixo);
    scene.fog.color.setHex(INT.brilho.fog);
    renderer.toneMappingExposure = INT.brilho.exp;
    INT.brilho = null;
  }
  if (INT.sombra) {
    const sc2 = sun.shadow.camera, a = INT.sombra;
    sc2.left = a.l; sc2.right = a.r; sc2.top = a.t; sc2.bottom = a.b;
    sc2.near = a.n; sc2.far = a.f;
    sc2.updateProjectionMatrix();
    sun.shadow.bias = a.bias; sun.shadow.normalBias = a.nb;
    INT.sombra = null;
  }
}

/* ============================================================
   12d. Lampada, interruptor e o que a luz nao atravessa  (v16)
   ============================================================
   Ate aqui "luz de dentro" eram tres pontuais que nasciam acesas nos tres maiores
   comodos, sem nada na cena que dissesse de onde vinham, e que atravessavam parede:
   luz pontual sem sombra ilumina os dois lados da divisoria igual. Somado ao
   preenchimento uniforme (hemisferica + ambiente), o apartamento saia aceso por
   inteiro num dia em que ninguem acendeu nada.

   Agora a instalacao e a de uma casa: cada comodo tem um plafom no teto e uma placa
   de interruptor na parede, ao lado do batente da porta. Clicar em qualquer um dos
   dois acende ou apaga aquele comodo, e a luz acesa PARA na parede.

   Tres decisoes de custo, que sao o motivo de isto caber:

   - POOL DE QUATRO LUZES, NAO UMA POR COMODO. Uma planta destas tem de 6 a 11
     comodos. Luz pontual com sombra e um cubemap -- SEIS renderizacoes da cena por
     luz -- e, pior, cada luz na cena entra no shader de TODO material, acesa ou
     apagada: a contagem de luzes e o que decide a compilacao. Entao existem quatro
     luzes de verdade, criadas na entrada e nunca removidas (mexer na contagem
     recompilaria a cidade inteira no meio da visita), e elas sao emprestadas as
     lampadas acesas mais proximas de quem olha. Acender a quinta acende o plafom e
     move a luz de quem ficou longe: o comodo que voce nao esta vendo e o que fica
     sem luz calculada.

   - CUBEMAP SO QUANDO MUDA. Dentro de casa o mapa de sombra do sol e redesenhado
     todo quadro (a nota do `sombraSuja` explica por que). Quatro cubemaps nesse
     ritmo seriam 24 passadas por quadro. `shadow.autoUpdate = false` por luz: a
     sombra da lampada e refeita quando alguem aciona um interruptor, quando a luz
     troca de comodo e quando um movel muda de lugar -- nunca por andar pela sala,
     porque a lampada nao anda com voce.

   - DUAS CHAMADAS DE DESENHO PRA INSTALACAO INTEIRA. Plafom e placa sao
     `InstancedMesh` com cor por instancia, pela mesma conta do resto do projeto:
     triangulo e barato, chamada e cara. Onze plafons custam o mesmo que um.

   O plafom aceso e `MeshBasic` sem mapeamento de tom: o vidro de uma luminaria acesa
   e a fonte, nao uma superficie iluminada -- passado pelo ACES ele sairia cinza, que
   e o que acontece com todo autoluminoso deste projeto (ver a cupula do ceu). */
const LAMP = {
  pool:    4,      // luzes com sombra vivas ao mesmo tempo
  int:     2.4,    // intensidade de uma lampada acesa (antes do fator PI)
  alcance: 9.0,    // distancia em que a luz zera (m)
  altura:  1.05,   // altura do interruptor (m) -- a de norma, e a que a mao acha
  cor:     0xFFEFD6
};
const LAMP_ACESA = 0xFFF7E2, LAMP_APAGADA = 0x6F6B64;
const CHAVE_ON = 0xFFFFFF, CHAVE_OFF = 0xE6E2DA;

function montaLuminarias(pl) {
  const n = pl.comodos.length;
  if (!n) return;
  const mapa = NIVEL.somMap >= 2048 ? 512 : 256;
  for (let k = 0; k < Math.min(LAMP.pool, n); k++) {
    const l = new THREE.PointLight(LAMP.cor, 0, LAMP.alcance, 2);
    l.castShadow = true;
    l.shadow.mapSize.set(mapa, mapa);
    l.shadow.camera.near = 0.08;
    l.shadow.camera.far = LAMP.alcance;
    l.shadow.bias = -0.001;
    l.shadow.normalBias = 0.10;
    l.shadow.autoUpdate = false;
    l.position.set(pl.cx, INT.baseY + pl.pd - 0.28, pl.cz);
    scene.add(l); INT.luzes.push(l); INT.pool.push(l);
  }

  // Plafom: calota de 23 cm rente ao forro. A luz mora 18 cm abaixo dela, pra que a
  // propria calota nao seja o primeiro oclusor do cubemap.
  const gBul = new THREE.SphereGeometry(0.115, 12, 8);
  gBul.scale(1, 0.58, 1);
  const bul = new THREE.InstancedMesh(gBul, new THREE.MeshBasicMaterial({ toneMapped:false }), n);
  bul.userData.luz = "plafon";
  bul.castShadow = bul.receiveShadow = false;
  const d = new THREE.Object3D();
  for (let i = 0; i < n; i++) {
    const c = pl.comodos[i];
    d.position.set(c.cx, pl.pd - 0.09, c.cz);
    d.rotation.set(0, 0, 0); d.scale.set(1, 1, 1);
    d.updateMatrix(); bul.setMatrixAt(i, d.matrix);
    INT.lamps.push({ i, on:false, p:new THREE.Vector3(c.cx, INT.baseY + pl.pd - 0.28, c.cz) });
  }
  bul.instanceMatrix.needsUpdate = true; bul.computeBoundingSphere();
  INT.raiz.add(bul); INT.plafons = bul;

  // Interruptor: ao lado do batente da porta do comodo, do lado de dentro. O vao ja
  // traz a normal (`nx,nz`) e o versor ao longo dele (`ux,uz`) -- o que falta decidir
  // e o SINAL dos dois: de que lado da porta esta este comodo, e de que lado do vao
  // sobra parede pra placa. Os dois saem de um teste de pertinencia no poligono do
  // proprio comodo, que e o mesmo criterio que o resto do interior usa.
  const chaves = [];
  for (let i = 0; i < n; i++) {
    const c = pl.comodos[i];
    let alvo = null, dm = 1e9;
    for (const e of pl.esquadrias) {
      if (!e.porta) continue;
      const mx = (e.a[0]+e.b[0])/2, mz = (e.a[1]+e.b[1])/2;
      const s = inside(c.poly, mx + e.nx*0.30, mz + e.nz*0.30) ?  1
              : inside(c.poly, mx - e.nx*0.30, mz - e.nz*0.30) ? -1 : 0;
      if (!s) continue;
      const dd = Math.hypot(mx - c.cx, mz - c.cz);
      if (dd < dm) { dm = dd; alvo = { e, s, mx, mz }; }
    }
    if (!alvo) continue;                       // comodo sem porta propria (varanda):
    const e = alvo.e;                          // fica so com o plafom, que e clicavel
    const nx = e.nx*alvo.s, nz = e.nz*alvo.s;
    for (const t of [1, -1]) {
      const off = e.L/2 + 0.17;
      const qx = alvo.mx + e.ux*off*t, qz = alvo.mz + e.uz*off*t;
      if (!inside(c.poly, qx + nx*0.35, qz + nz*0.35)) continue;
      chaves.push({ i, x: qx + nx*(ESP/2 + 0.008), z: qz + nz*(ESP/2 + 0.008),
                    ang: Math.atan2(nx, nz) });
      break;
    }
  }
  if (chaves.length) {
    const gCh = new THREE.BoxGeometry(0.086, 0.128, 0.014);
    const ch = new THREE.InstancedMesh(gCh, new THREE.MeshStandardMaterial({
      roughness:0.75, metalness:0, emissive:0x0E0D0B }), chaves.length);
    ch.userData.luz = "chave";
    ch.userData.mapa = chaves.map(q => q.i);
    ch.castShadow = ch.receiveShadow = false;
    for (let k = 0; k < chaves.length; k++) {
      const q = chaves[k];
      d.position.set(q.x, LAMP.altura, q.z);
      d.rotation.set(0, q.ang, 0); d.scale.set(1, 1, 1);
      d.updateMatrix(); ch.setMatrixAt(k, d.matrix);
    }
    ch.instanceMatrix.needsUpdate = true; ch.computeBoundingSphere();
    INT.raiz.add(ch); INT.chaves = ch;
  }
  pintaLuminarias();
  distribuiLuzes(true);
}

// Cor por instancia: e o unico jeito de um plafom aceso e um apagado dividirem a
// mesma malha -- e dividir a malha e o que faz a instalacao caber em duas chamadas.
function pintaLuminarias() {
  const cor = new THREE.Color();
  if (INT.plafons) {
    for (const L of INT.lamps)
      INT.plafons.setColorAt(L.i, cor.setHex(L.on ? LAMP_ACESA : LAMP_APAGADA));
    INT.plafons.instanceColor.needsUpdate = true;
  }
  if (INT.chaves) {
    const m = INT.chaves.userData.mapa;
    for (let k = 0; k < m.length; k++)
      INT.chaves.setColorAt(k, cor.setHex(INT.lamps[m[k]].on ? CHAVE_ON : CHAVE_OFF));
    INT.chaves.instanceColor.needsUpdate = true;
  }
}

/* Empresta as quatro luzes as lampadas acesas mais proximas da camera. Sai cedo
   quando a lista nao muda: e chamada de dentro do laco de quadro. */
function distribuiLuzes(forca) {
  if (!INT.pool.length) return;
  const acesas = INT.lamps.filter(L => L.on)
    .sort((a, b) => a.p.distanceToSquared(camera.position)
                  - b.p.distanceToSquared(camera.position))
    .slice(0, INT.pool.length);
  const chave = acesas.map(L => L.i).join(",");
  if (!forca && chave === INT.chaveLuz) return;
  INT.chaveLuz = chave;
  for (let k = 0; k < INT.pool.length; k++) {
    const L = acesas[k], pt = INT.pool[k];
    pt.intensity = L ? LAMP.int * LUZ_PI : 0;
    if (L) { pt.position.copy(L.p); pt.shadow.needsUpdate = true; }
  }
}
// Movel mudou de lugar: a sombra da lampada e que nao sabe (a do sol e refeita todo
// quadro). Chamada de `salvaMoveis`, que e por onde toda edicao de mobilia passa.
function sujaLuzes() {
  for (const pt of INT.pool) if (pt.intensity > 0) pt.shadow.needsUpdate = true;
}
function alternaLuz(i) {
  const L = INT.lamps[i];
  if (!L) return;
  L.on = !L.on;
  pintaLuminarias();
  distribuiLuzes(true);
}
// O raio bate na malha instanciada e volta com `instanceId`; nos plafons ele ja e o
// indice do comodo, nas placas passa pelo mapa (comodo sem porta nao tem placa).
function luzDoHit(h) {
  const k = h.object.userData.luz;
  if (!k) return -1;
  return k === "plafon" ? h.instanceId : h.object.userData.mapa[h.instanceId];
}

function baseDaCasa(pl) {
  let by = terrainY(pl.mx, pl.mz);
  for (const p of pl.rec.r) { const t = terrainY(p[0], p[1]); if (t > by) by = t; }
  return by * reliefAmount + (pl.andar || 0) * LV;
}

// So entra em imovel CADASTRADO. Nao ha mais interior generico: cada unidade nasce de
// planta e material fornecidos, e predio sem cadastro nao abre porta nenhuma.
function enterInterior(rec, unidade) {
  const u = unidade || unidadeDoPredio(rec);
  if (!u) return;
  const pl = plantaDaUnidade(rec, u);
  if (!pl) return;
  if (INT.on || INT.raiz) descarta();
  INT.pl = pl;
  INT.baseY = baseDaCasa(pl);
  INT.raiz = new THREE.Group();
  INT.raiz.position.y = INT.baseY;
  gInteriores.add(INT.raiz);
  INT.teto = true;                     // unidade fechada tem forro; sem ele o "fora"
  $("iteto").setAttribute("aria-pressed", "true");   // volta a aparecer por cima
  INT.casa = geoDaCasa(pl, INT.teto);
  INT.raiz.add(INT.casa);
  acendeInterior(pl);
  INT.moveis = leMoveis(pl.id) || pl.moveis;
  for (const m of INT.moveis) poeNaCena(m);
  criaRotulos(pl);

  INT.salvo = { tx:target.x, tz:target.z, r:sph.radius, phi:sph.phi, theta:sph.theta };
  INT.on = true; INT.fp = false; INT.orbita = false; INT.sel = -1; selBox.visible = false; poeTipo = null;
  target.set(pl.cx, 0, pl.cz);
  streamUpdate(true);

  const e = pontoDeEntrada(pl);
  FP.pos.set(e[0], 0, e[1]);
  // camera olha em -Z girado por yaw: frente = (-sen, -cos). Mira no centro da sala.
  FP.yaw = melhorDirecao(e[0], e[1]);
  // Tela em pe: o campo vertical e enorme e a mira reta enche o quadro de teto e
  // parede. Abaixar o olhar poe piso e movel de volta na cena.
  FP.pitch = innerHeight > innerWidth ? -0.26 : -0.12;
  // O corte começa perto do telhado e desce junto com a câmera: aparecer já
  // cortado seria um salto, e vir do infinito faria a cidade inteira piscar.
  camera.near = NEAR_CASA; camera.far = FAR_CASA;
  camera.fov = fovInterior(false); camera.updateProjectionMatrix();
  CORTE.constant = CORTE_OFF;
  INT.corteAlvo = alturaDoCorte();
  aplicaFuro();

  // Depois do furo, e so aqui: antes dele a casca do predio ainda tapa a
  // janela, e a sonda capturaria a fachada por dentro no lugar da cidade.
  sondaDeAmbiente(pl);

  const dest = new THREE.Vector3(e[0], INT.baseY + OLHO, e[1]);
  const olha = new THREE.Vector3(e[0] - Math.sin(FP.yaw)*6, INT.baseY + OLHO - 0.3,
                                 e[1] - Math.cos(FP.yaw)*6);
  INT.voo = { t0:performance.now(), dur:1100,
              p0:camera.position.clone(), q0:camera.quaternion.clone(),
              p1:dest, q1:quatOlhando(dest, olha),
              fim:() => { INT.fp = true; } };

  hsheet.classList.remove("on"); usheet.classList.remove("on");
  fechaPerto(false); setPins(false);   // la dentro o pino nao opera nada -- e a saida
                                       // da casa nao deve devolver a cidade acesa
  houseBeacon.visible = false;
  closePoiSheet();
  ipanel.classList.add("on");
  document.body.classList.add("dentro");
  ipanel.classList.toggle("min", TOQUE);   // no celular abre recolhido: a tela e a vista
  mostraJoy(true);
  housesBox.style.display = "none";   // mesmo canto do painel de mobilia
  const fc = pl.unidade && pl.unidade.ficha;
  $("iName").textContent = fc ? (fc.empreendimento && fc.empreendimento !== "\u2014"
                                 ? fc.empreendimento : fc.titulo)
                              : ((rec && rec.name) || "Edificação sem nome");
  const comodos = pl.comodos.length + (pl.comodos.length === 1 ? " cômodo · " : " cômodos · ");
  $("iInfo").textContent = fc
    ? comodos + (fc.area_util || Math.round(pl.area)) + " m² · "
      + (pl.andar ? pl.andar + "º andar · " : "") + "planta do anúncio"
    : comodos + Math.round(pl.area) + " m² úteis · planta estimada";
  const conf = pl.unidade && predioDaUnidade(pl.unidade);
  // Em lote nao se troca predio: nao ha predio pra trocar, e oferecer a troca convidaria
  // a pendurar o lancamento no vizinho -- que e justamente o erro que o lote resolve.
  const emLote = !!(pl.rec && (pl.rec.lote || pl.rec.lancamento));
  $("iPredioRow").hidden = !pl.unidade || emLote;
  let av = $("iAncora");
  if (!av) { av = document.createElement("div"); av.id = "iAncora"; av.className = "naoconf";
             $("iPredioRow").parentNode.insertBefore(av, $("iPredioRow")); }
  av.hidden = !(pl.unidade && conf && !conf.confirmado);
  av.textContent = emLote
    ? "Terreno ainda não confirmado — a planta está assentada na coordenada do endereço."
    : "Prédio ainda não confirmado — foi escolhido pela pista do anúncio. "
      + "Use \u201cTrocar prédio\u201d para apontar o certo.";
  pintaCatalogo(); pintaEditor();
}

function descarta() {
  if (INT.raiz) {
    INT.raiz.traverse(o => { if (o.geometry) o.geometry.dispose(); });
    gInteriores.remove(INT.raiz);
  }
  for (const r of INT.rotulos) r.el.remove();
  INT.rotulos = []; INT.raiz = null; INT.casa = null; INT.moveis = []; INT.pl = null;
  selBox.visible = false; INT.sel = -1;
  // bake pendente aponta pra malha que acabou de ser descartada: continuar
  // gastaria quadro pra escrever num buffer que nao esta mais na tela.
  BAKE.fila = null;
  soltaSonda();
}

function exitInterior() {
  if (!INT.on) return;
  const S = INT.salvo;
  INT.fp = false; INT.orbita = false;
  $("ivista").setAttribute("aria-pressed", "false");
  INT.corteAlvo = CORTE_OFF;
  camera.near = NEAR_CIDADE; camera.far = FAR_CIDADE;
  camera.fov = FOV_CIDADE; camera.updateProjectionMatrix();
  const alvo = new THREE.Vector3(S.tx, terrainY(S.tx, S.tz)*reliefAmount, S.tz);
  const dest = new THREE.Vector3().setFromSpherical(
    new THREE.Spherical(S.r, S.phi, S.theta)).add(alvo);
  INT.voo = { t0:performance.now(), dur:900,
              p0:camera.position.clone(), q0:camera.quaternion.clone(),
              p1:dest, q1:quatOlhando(dest, alvo),
              fim:() => {
                target.set(S.tx, 0, S.tz);
                sph.set(S.r, S.phi, S.theta);
                INT.on = false; descarta(); aplicaFuro(); apagaInterior(); streamUpdate(true);
              } };
  ipanel.classList.remove("on");
  document.body.classList.remove("dentro");
  mostraJoy(false);
  housesBox.style.display = "";
}

// Saída sem voo de volta: pra quem já vai reposicionar a câmera por conta
// própria (o botão Centro), animar o retorno só brigaria com o destino dele.
function saiSeco() {
  if (!INT.on) return;
  INT.on = false; INT.fp = false; INT.orbita = false; INT.voo = null;
  $("ivista").setAttribute("aria-pressed", "false");
  INT.corteAlvo = CORTE_OFF;
  camera.near = NEAR_CIDADE; camera.far = FAR_CIDADE;
  camera.fov = FOV_CIDADE; camera.updateProjectionMatrix();
  descarta(); aplicaFuro(); apagaInterior(); mostraJoy(false);
  document.body.classList.remove("dentro");
  ipanel.classList.remove("on"); housesBox.style.display = "";
}

/* Duas vistas da mesma casa. Primeira pessoa responde "como é estar aqui"; a
   planta responde "onde ponho o sofá" -- e mobiliar de dentro, com a câmera na
   altura dos olhos e o móvel atrás de você, é sofrível. O corte continua no
   mesmo lugar nas duas: a planta é a mesma cena vista de cima, não outro modo. */
// Na primeira pessoa o corte fica logo acima do forro: quem está lá dentro quer
// a sala inteira em pé. Na planta ele desce pra cintura, que é onde a planta de
// arquitetura corta -- e é o que faz a casa toda aparecer de uma vez em vez de
// ficar metade escondida atrás da parede da frente.
/* De pe dentro do apartamento o corte SAI de cena: o furo ja tirou a casca que tapava
   a janela, e fatiar a cidade num plano na altura do ombro punha o bairro inteiro em
   maquete em volta de quem esta na sala. O corte volta so na vista de planta, que e
   onde ele serve pra alguma coisa -- ver por cima das proprias paredes. */
function alturaDoCorte() {
  if (!INT.on) return CORTE_OFF;
  return INT.orbita ? INT.baseY + CORTE_OMBRO : CORTE_OFF;
}
function aplicaFuro() {
  const f = INT.on && INT.pl && INT.pl.furo;
  // Altura minima BEM abaixo do terreno: o furo apaga a torre inteira, nao so o que
  // esta acima do piso da unidade. Cortando so o de cima, quem olha pela janela e
  // enxerga um pouco pra baixo ve a propria fachada do predio em que esta -- que foi
  // exatamente o que apareceu: uma grade de janelas ocupando metade da vista.
  if (f) uFuro.value.set(f.cx, f.cz, f.r, -100000);
  else uFuro.value.set(0, 0, 0, 0);
  sujaSombra();   // entrar e sair troca a caixa da câmera de sombra (ver enterInterior)
}
function vista(planta) {
  if (!INT.on) return;
  INT.orbita = planta; INT.fp = !planta;
  mostraJoy(!planta);                 // na planta se arrasta e pinca, nao se anda
  camera.fov = fovInterior(planta);
  camera.updateProjectionMatrix();
  INT.corteAlvo = alturaDoCorte();
  if (planta) CORTE.constant = INT.baseY + Math.max(6, INT.pl.h + 3);   // desce de cima
  if (planta) {
    target.set(INT.pl.cx, 0, INT.pl.cz);
    sph.set(Math.max(13, INT.pl.ob.hu * 2.6), 0.72, sph.theta);
  } else if (!livre(FP.pos.x, FP.pos.z)) {
    const e = pontoDeEntrada(INT.pl);   // saiu andando na planta e parou num móvel
    FP.pos.set(e[0], 0, e[1]);
  }
  $("iDica").textContent = planta
    ? "Arrastar gira · roda aproxima · clicar escolhe e move"
    : "W A S D anda · arrastar olha · clicar escolhe · R gira";
}

/* ---- rótulos de cômodo (DOM, como os de rua) --------------------------- */
function criaRotulos(pl) {
  for (const c of pl.comodos) {
    const el = document.createElement("div");
    el.className = "ilbl"; el.textContent = c.nome;
    overlay.appendChild(el);
    INT.rotulos.push({ el, c, v:new THREE.Vector3() });
  }
}

/* ---- primeira pessoa --------------------------------------------------- */
function fpPasso(dt) {
  const d0 = Math.min(0.05, dt);
  if (teclas.q) FP.yaw += 1.8 * d0;
  if (teclas.e) FP.yaw -= 1.8 * d0;
  let mf = (teclas.w ? 1 : 0) - (teclas.s ? 1 : 0) + FP.mov.z;
  let mr = (teclas.d ? 1 : 0) - (teclas.a ? 1 : 0) + FP.mov.x;
  if (!mf && !mr) return;
  // O manche entrega modulo entre 0 e 1: perto do centro anda devagar, o que e o que
  // permite ajustar posicao dentro de um comodo pequeno sem passar direto.
  const forca = Math.min(1, Math.hypot(mf, mr));
  const v = (teclas.shift ? 3.6 : 1.7) * d0 * forca;
  const L = Math.hypot(mf, mr); mf /= L; mr /= L;
  const sy = Math.sin(FP.yaw), cy = Math.cos(FP.yaw);
  const dx = (-sy*mf + cy*mr) * v, dz = (-cy*mf - sy*mr) * v;
  const x = FP.pos.x, z = FP.pos.z;
  if (livre(x+dx, z+dz)) { FP.pos.x = x+dx; FP.pos.z = z+dz; }
  else if (livre(x+dx, z)) FP.pos.x = x+dx;
  else if (livre(x, z+dz)) FP.pos.z = z+dz;
}
addEventListener("keydown", e => {
  if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
  const k = e.key.toLowerCase();
  // Antes do corte por INT.on: o medidor serve dentro e fora da casa, e é justamente
  // fora (cidade inteira na tela) que o número interessa.
  if (k === "p") { mostraPerf(!perfOn); return; }
  if (INT.on && k === "escape") { exitInterior(); return; }
  if (!INT.on) return;
  if (k === "delete") { excluiSel(); e.preventDefault(); return; }
  if (k === "r") { giraSel(); return; }
  if (k === "w" || k === "arrowup") teclas.w = 1;
  else if (k === "s" || k === "arrowdown") teclas.s = 1;
  else if (k === "a" || k === "arrowleft") teclas.a = 1;
  else if (k === "d" || k === "arrowright") teclas.d = 1;
  else if (k === "q") teclas.q = 1;
  else if (k === "e") teclas.e = 1;
  else return;
  teclas.shift = e.shiftKey ? 1 : 0;
  e.preventDefault();
});
addEventListener("keyup", e => {
  const k = e.key.toLowerCase();
  if (k === "w" || k === "arrowup") teclas.w = 0;
  else if (k === "s" || k === "arrowdown") teclas.s = 0;
  else if (k === "a" || k === "arrowleft") teclas.a = 0;
  else if (k === "d" || k === "arrowright") teclas.d = 0;
  else if (k === "q") teclas.q = 0;
  else if (k === "e") teclas.e = 0;
  teclas.shift = e.shiftKey ? 1 : 0;
});
addEventListener("blur", () => { for (const k in teclas) teclas[k] = 0; FP.mov.x = FP.mov.z = 0; });

/* ---- manche de caminhada (celular) ------------------------------------- */
const joy = $("joy"), joyPino = joy.firstElementChild;
let joyId = null, joyCx = 0, joyCy = 0;
const JOY_R = 34;                      // curso util, em pixels
function mostraJoy(v) {
  joy.classList.toggle("on", !!(v && TOQUE));
  if (!v) soltaJoy();
}
function soltaJoy() {
  joyId = null; FP.mov.x = FP.mov.z = 0;
  joyPino.style.transform = "";
}
joy.addEventListener("pointerdown", e => {
  const r = joy.getBoundingClientRect();
  joyCx = r.left + r.width/2; joyCy = r.top + r.height/2;
  joyId = e.pointerId; joy.setPointerCapture(e.pointerId);
  moveJoy(e); e.preventDefault(); e.stopPropagation();
});
joy.addEventListener("pointermove", e => { if (e.pointerId === joyId) moveJoy(e); });
for (const ev of ["pointerup", "pointercancel", "pointerleave"])
  joy.addEventListener(ev, e => { if (e.pointerId === joyId) soltaJoy(); });
function moveJoy(e) {
  let dx = e.clientX - joyCx, dy = e.clientY - joyCy;
  const L = Math.hypot(dx, dy);
  if (L > JOY_R) { dx = dx/L*JOY_R; dy = dy/L*JOY_R; }
  joyPino.style.transform = "translate(" + dx.toFixed(1) + "px," + dy.toFixed(1) + "px)";
  FP.mov.x = dx / JOY_R;              // direita/esquerda
  FP.mov.z = -dy / JOY_R;             // pra cima na tela = pra frente
}

/* ---- de um clique até um registro de edificação -------------------------
   A malha da quadra é mesclada: não há um objeto por prédio pro raycast
   devolver. Mas cada vértice já carrega o CENTROIDE do prédio dele em
   `presetCenter` (o shader usa isso pro relevo), e o centroide quantizado é a
   mesma chave que a fachada usa de semente. Face -> centroide -> registro.

   Com o Relevo ligado o raycast erra o alvo por alguns metros: a malha é
   deslocada no SHADER (aDY*uRelief) e o raycast lê a posição do buffer, que não
   sabe disso. Erra de prédio vizinho, não de lugar — e o dado que sai daqui
   (o centroide) continua exato. */
const rcaster = new THREE.Raycaster();
const _ndc = new THREE.Vector2();
function registroDoHit(hit) {
  const o = hit.object, pc = o.geometry.userData.presetCenter, recs = o.userData.recs;
  if (!pc || !recs || !hit.face) return null;
  let idx = o.userData.indice;
  if (!idx) {
    idx = new Map();
    for (const b of recs) {
      let mx = 0, mz = 0;
      for (const p of b.r) { mx += p[0]; mz += p[1]; }
      idx.set(Math.round(mx/b.r.length*10) + "," + Math.round(mz/b.r.length*10), b);
    }
    o.userData.indice = idx;
  }
  const a = hit.face.a;
  return idx.get(Math.round(pc[a*2]*10) + "," + Math.round(pc[a*2+1]*10)) || null;
}
function cliqueNaCidade(e) {
  _ndc.set(e.clientX/innerWidth*2 - 1, -(e.clientY/innerHeight*2 - 1));
  rcaster.setFromCamera(_ndc, camera);
  const hits = rcaster.intersectObjects(gBuild.children, false);
  for (const h of hits) {
    const rec = registroDoHit(h);
    if (!rec) continue;
    if (escolhendo) {                       // apontando o predio de uma unidade
      const u = escolhendo;
      try { localStorage.setItem(chaveAncora(u.id), idDoRegistro(rec)); } catch (e2) {}
      cancelaEscolha();
      abreUnidade(u);
      return;
    }
    abreFicha(rec);
    return;
  }
}
function abreFicha(rec) {
  // Sem cadastro nao ha ficha (ver a nota onde a ficha generica foi removida). Com
  // cadastro, o clique no volume leva pro MESMO lugar que o clique na vitrine leva --
  // a ficha do imovel, com preco, comodos e a porta pra visita 3D -- em vez de um
  // cartao paralelo, mais pobre, que dizia outras coisas sobre o mesmo predio.
  const uni = unidadeDoPredio(rec);
  if (uni) abreUnidade(uni);
}

/* ---- clique dentro da casa: põe, escolhe ou move ----------------------- */
let poeTipo = null;
function cliqueInterior(e) {
  _ndc.set(e.clientX/innerWidth*2 - 1, -(e.clientY/innerHeight*2 - 1));
  rcaster.setFromCamera(_ndc, camera);
  // A casa entra no teste JUNTO com os móveis. Sem ela o raio atravessa parede e
  // seleciona a cama do quarto vizinho -- visto na vista de planta, onde a metade
  // de trás da casa fica exatamente atrás de uma parede.
  const objs = [];
  for (const m of INT.moveis) if (m.obj) for (const f of m.obj.children) objs.push(f);
  if (INT.casa) for (const o of INT.casa.children) objs.push(o);
  // Interruptor e plafom entram na MESMA lista, e nao num teste proprio antes: e o
  // que faz um interruptor do comodo vizinho, atras da parede, nao ser clicavel.
  if (INT.plafons) objs.push(INT.plafons);
  if (INT.chaves) objs.push(INT.chaves);
  // O raio tem que enxergar o que a TELA enxerga: o que está acima do plano de
  // corte foi descartado no fragmento e não pode ser clicado. Sem este filtro a
  // vista de planta ficaria intransitável -- a parede some aos 1,55 m mas o raio
  // continuaria batendo nela até 2,70 m, e todo clique viraria "nada aqui".
  let h0 = null;
  for (const h of rcaster.intersectObjects(objs, false))
    if (h.point.y <= CORTE.constant) { h0 = h; break; }
  if (h0 && h0.object.userData.luz) { alternaLuz(luzDoHit(h0)); return; }
  if (h0 && !h0.object.userData.casa) {
    if (!poeTipo) { seleciona(INT.moveis.indexOf(h0.object.userData.movel)); return; }
  } else if (h0 && h0.point.y > INT.baseY + 0.25) {
    seleciona(-1); return;                      // clicou numa parede, não no chão
  }
  const dir = rcaster.ray.direction, org = rcaster.ray.origin;
  if (Math.abs(dir.y) < 1e-4) return;
  const t = (INT.baseY + 0.03 - org.y) / dir.y;
  if (t <= 0) return;
  const x = org.x + dir.x*t, z = org.z + dir.z*t;
  if (!dentroDaPlanta(INT.pl, x, z)) { if (!poeTipo) seleciona(-1); return; }
  const uv = paraUV(x, z);
  if (poeTipo) {
    const def = MOVEIS[poeTipo];
    const m = { tipo:poeTipo, u:uv[0], v:uv[1], rot:0,
                w:def.b[0], d:def.b[2], h:def.b[1], cor:def.cor };
    INT.moveis.push(m); poeNaCena(m);
    poeTipo = null; pintaCatalogo();
    seleciona(INT.moveis.length - 1); salvaMoveis();
  } else if (INT.sel >= 0) {
    const m = INT.moveis[INT.sel];
    m.u = uv[0]; m.v = uv[1]; atualizaMovel(m); seleciona(INT.sel); salvaMoveis();
  }
}
function paraUV(x, z) {
  const ob = INT.pl.ob, dx = x - ob.cx, dz = z - ob.cz;
  return [dx*ob.ux + dz*ob.uz, -dx*ob.uz + dz*ob.ux];
}

/* ---- painel ------------------------------------------------------------ */
const ipanel = $("ipanel");
function pintaCatalogo() {
  const box = $("iCat");
  if (!box.children.length) {
    for (const k of MOVEL_KEYS) {
      const b = document.createElement("button");
      b.textContent = MOVEIS[k].nome; b.dataset.k = k;
      b.addEventListener("click", () => {
        poeTipo = poeTipo === k ? null : k;
        if (poeTipo) seleciona(-1);
        pintaCatalogo();
      });
      box.appendChild(b);
    }
  }
  for (const b of box.children) b.setAttribute("aria-pressed", String(b.dataset.k === poeTipo));
  $("iDica").textContent = poeTipo
    ? "Clique no chão para posicionar: " + MOVEIS[poeTipo].nome
    : "W A S D anda · arrastar olha · clicar escolhe · R gira · clique no interruptor acende";
}
function pintaEditor() {
  const m = INT.moveis[INT.sel];
  $("iEdit").hidden = !m;
  if (!m) return;
  $("iSelName").textContent = MOVEIS[m.tipo].nome;
  $("isw").value = m.w; $("ivw").textContent = m.w.toFixed(2).replace(".", ",") + " m";
  $("isd").value = m.d; $("ivd").textContent = m.d.toFixed(2).replace(".", ",") + " m";
  $("ish").value = m.h; $("ivh").textContent = m.h.toFixed(2).replace(".", ",") + " m";
  $("icor").value = "#" + m.cor.toString(16).padStart(6, "0");
}
function mexeSel(campo, valor) {
  const m = INT.moveis[INT.sel]; if (!m) return;
  m[campo] = valor; atualizaMovel(m); seleciona(INT.sel); salvaMoveis();
}
function giraSel() {
  const m = INT.moveis[INT.sel]; if (!m) return;
  m.rot = (m.rot + 1) % 4; atualizaMovel(m); seleciona(INT.sel); salvaMoveis();
}
function excluiSel() {
  const m = INT.moveis[INT.sel]; if (!m) return;
  INT.raiz.remove(m.obj); m.obj.traverse(o => { if (o.geometry) o.geometry.dispose(); });
  INT.moveis.splice(INT.sel, 1); seleciona(-1); salvaMoveis();
}
$("isw").addEventListener("input", e => mexeSel("w", parseFloat(e.target.value)));
$("isd").addEventListener("input", e => mexeSel("d", parseFloat(e.target.value)));
$("ish").addEventListener("input", e => mexeSel("h", parseFloat(e.target.value)));
$("icor").addEventListener("input", e => {
  const m = INT.moveis[INT.sel]; if (!m) return;
  m.cor = parseInt(e.target.value.slice(1), 16); recolore(m); salvaMoveis();
});
$("igir").addEventListener("click", giraSel);
$("idel").addEventListener("click", excluiSel);
$("isair").addEventListener("click", exitInterior);
$("ix").addEventListener("click", exitInterior);
$("idobra").addEventListener("click", () => {
  const min = ipanel.classList.toggle("min");
  $("idobra").textContent = min ? "\u25b4" : "\u25be";
});
$("ireset").addEventListener("click", () => {
  if (!INT.pl) return;
  for (const m of INT.moveis) {
    INT.raiz.remove(m.obj); m.obj.traverse(o => { if (o.geometry) o.geometry.dispose(); });
  }
  INT.moveis = INT.pl.moveis.map(m => Object.assign({}, m));
  for (const m of INT.moveis) poeNaCena(m);
  seleciona(-1); salvaMoveis();
});
toggle("ivista", on => vista(on));
toggle("iteto", on => {
  INT.teto = on;
  if (!INT.pl) return;
  INT.casa.traverse(o => { if (o.geometry) o.geometry.dispose(); });
  INT.raiz.remove(INT.casa);
  INT.casa = geoDaCasa(INT.pl, on);
  INT.raiz.add(INT.casa);
});
$("ipredio").addEventListener("click", () => {
  const u = INT.pl && INT.pl.unidade;
  if (!u) return;
  saiSeco();
  pedePredio(u, "Clique no prédio certo do "
    + ((u.ficha && u.ficha.empreendimento) || "empreendimento"));
});

/* ---- por frame --------------------------------------------------------- */
let _tAnt = 0;
// Porta pro QA headless, como o `window.__gMuros`: o modulo e um IIFE, entao
// sem isto nenhuma sonda consegue perguntar onde a camera parou.
// `sph` e `target` entram porque enquadrar um print no Chrome headless sempre
// esbarrou neles estarem fora de alcance (ver [[mapa-3d-qa-headless]]).
window.__int = { INT, FP, CORTE, camera, scene, gInteriores, MOVEIS, sph, target,
                 renderer, sun, hemi,
                 enterInterior, exitInterior, plantaDaUnidade, UNIDADES, uFuro,
                 livre, decideVao,
                 // v13: a vitrine para na ficha, e o "por perto" e o unico caminho
                 // normal ate os pinos. Sem estes tres nenhuma sonda alcanca o fluxo.
                 abreUnidade, abrePerto, fechaPerto, setPins, PERTO,
                 alternaLuz, LAMP,
                 pins: () => !poiHidden,
                 BAKE, bakeAgora, bakePrepara, cenaDoBake, bakeRaio,  // v15: bake
                 grupos: () => gGroups, vivos: () => gLive };

// Sonda do medidor. Existe pelo mesmo motivo da de cima e por um a mais: em aba oculta
// o rAF e estrangulado (ver [[mapa-3d-raf-aba-oculta]]), entao QUALQUER medida tirada do
// laco normal mente. `bombeia` termina a montagem e `mede` desenha fora do rAF, que e a
// unica forma de comparar duas configuracoes sem depender da aba estar na frente.
window.__perf = {
  renderer, scene, camera, NIVEL, nivel: NIVEL_NOME, gpu: GPU,
  dpr: () => dprAtual, quadroMs: () => _cpuMed, cpuMs: () => _cpuMs,
  fila: () => streamQ.length, sujaSombra, setStreamRadius, raio: () => STREAM_R,
  bombeia(max) { let k = 0; while (streamQ.length && k < max) { streamPump(); k++; } return streamQ.length; },
  // Um quadro COMPLETO fora do rAF. Mesma razao do `mede`, um degrau acima: em Chrome
  // headless o rAF para depois dos primeiros quadros (ver [[mapa-3d-raf-aba-oculta]]),
  // e sem isto nenhuma sonda consegue testar o que o frame() DECIDE -- rotulo de rua,
  // streaming, sombra --, so o que ele desenha. `_semRaf` evita que a chamada manual
  // agende um segundo laco por cima do que ja esta rodando.
  passo(t) {
    _semRaf = true;
    try { frame(t === undefined ? performance.now() : t); } finally { _semRaf = false; }
  },
  /* O remendo da arborizacao (4.2) so e defensavel com isto: roda o caminho COMPLETO
     num rascunho e compara com o estado remendado, planta a planta. Devolve
     {ok, remendo, completo, faltando, sobrando}. Custa uma reconstrucao inteira --
     e ferramenta de teste, nao de laco. */
  confereArvores() {
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
  },
  mede(n, comSombra) {
    const gl = renderer.getContext(), t = [];
    for (let i = 0; i < n; i++) {
      renderer.shadowMap.needsUpdate = !!comSombra;
      const a = performance.now();
      renderer.render(scene, camera);
      gl.finish();                       // sem isto se mede o enfileiramento, nao o desenho
      t.push(performance.now() - a);
    }
    t.sort((x, y) => x - y);
    return { ms: t[n >> 1], calls: renderer.info.render.calls,
             tris: renderer.info.render.triangles };
  },
};

function interiorFrame(now) {
  const dt = _tAnt ? (now - _tAnt)/1000 : 0; _tAnt = now;
  // O corte persegue o alvo. Na volta ele sobe em progressão e, passado o
  // telhado mais alto, salta pro infinito: interpolar até 1e6 nunca chegaria lá.
  if (CORTE.constant !== INT.corteAlvo) {
    if (INT.corteAlvo === CORTE_OFF) {
      CORTE.constant += Math.max(6, (CORTE.constant - INT.baseY) * 0.35);
      if (CORTE.constant > INT.baseY + 90) CORTE.constant = CORTE_OFF;
    } else {
      const k = Math.min(1, dt*6);
      CORTE.constant += (INT.corteAlvo - CORTE.constant) * k;
      if (Math.abs(INT.corteAlvo - CORTE.constant) < 0.01) CORTE.constant = INT.corteAlvo;
    }
  }
  if (!INT.on && !INT.voo) return;
  if (INT.pl) {
    // v11: o alvo passa pelo cache de terrainY (1.2 do plano) -- e o mesmo ponto que o
    // frame() acabou de amostrar, entao aqui ele ja vem da casa do cache.
    if (INT.on) _tyCache.v = terrainYCached(target.x, target.z);
    // O alvo da orbita mora no PISO da unidade, nao no terreno. Sem isto a vista de
    // planta de um apartamento do 3o andar orbita um ponto 9 m abaixo dele -- e o que
    // aparece na tela e a laje vista por baixo.
    if (INT.on) target.y = INT.baseY;
    const by = baseDaCasa(INT.pl);
    if (Math.abs(by - INT.baseY) > 1e-4) {
      INT.baseY = by; INT.raiz.position.y = by;
      INT.corteAlvo = alturaDoCorte();
      aplicaFuro();
      // A lampada esta pendurada no forro DA UNIDADE, entao ela sobe com o piso.
      for (const L of INT.lamps) L.p.y = INT.baseY + INT.pl.pd - 0.28;
      distribuiLuzes(true);
      if (INT.sel >= 0) seleciona(INT.sel);
    }
    // A luz emprestada segue quem olha -- so faz sentido com mais lampada acesa que
    // luz no pool; a funcao sai cedo quando a lista nao muda.
    if (INT.on && INT.lamps.length > INT.pool.length) distribuiLuzes(false);
  }
  if (INT.voo) {
    const v = INT.voo, t = Math.min(1, (now - v.t0)/v.dur);
    const e = t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2, 3)/2;
    camera.position.lerpVectors(v.p0, v.p1, e);
    THREE.Quaternion.slerp ? THREE.Quaternion.slerp(v.q0, v.q1, camera.quaternion, e)
                           : camera.quaternion.slerpQuaternions(v.q0, v.q1, e);
    if (t >= 1) { INT.voo = null; v.fim(); }
    return;
  }
  if (INT.fp) {
    fpPasso(dt);
    camera.position.set(FP.pos.x, INT.baseY + OLHO, FP.pos.z);
    camera.rotation.set(FP.pitch, FP.yaw, 0);
  }
  // O laço só atualiza a matriz da câmera DEPOIS daqui; sem isto o rótulo do
  // cômodo projetaria com a matriz do frame anterior e ficaria arrastando.
  camera.updateMatrixWorld();
  const W2 = innerWidth, H2 = innerHeight;
  for (const r of INT.rotulos) {
    // O rotulo e <div> projetado: nao passa pelo teste de profundidade, entao em
    // primeira pessoa o nome de TODO comodo aparece atravessando as paredes. Na
    // vista de planta isso e certo (nao ha parede na frente); andando, nao. Quem
    // nomeia o comodo em que se esta e o minimapa.
    if (INT.fp) { r.el.style.display = "none"; continue; }
    r.v.set(r.c.cx, INT.baseY + 1.95, r.c.cz).project(camera);
    if (r.v.z > 1 || Math.abs(r.v.x) > 1.05 || Math.abs(r.v.y) > 1.05) {
      r.el.style.display = "none"; continue;
    }
    r.el.style.display = "block";
    r.el.style.transform = "translate(" + ((r.v.x*0.5+0.5)*W2) + "px," +
      ((-r.v.y*0.5+0.5)*H2) + "px) translate(-50%,-50%)";
  }
}

const tmp = new THREE.Vector3();
let looping = false;
/* 1.1 do plano da Fase 1, na forma pedida: sai cedo quando a JANELA nao mudou.

   ATENCAO, e esta a consequencia medida: o governador de resolucao chama
   `setPixelRatio()` e logo em seguida `resize()` -- com a janela do MESMO tamanho, que
   e o caso normal. Com esta guarda o `resize()` sai antes de aplicar o novo dpr, e o
   governador para de ter efeito. `pipeline/testa_governador.py` mede isso.

   Pra devolver o governador basta apagar as tres linhas da guarda: a comparacao de
   baixo (pixel do canvas) ja cobria janela E dpr sozinha. */
let _lastW = 0, _lastH = 0;
function resize() {
  const w0 = innerWidth, h0 = innerHeight;
  if (w0 === _lastW && h0 === _lastH) return;
  _lastW = w0; _lastH = h0;
  const w = innerWidth, h = innerHeight, dpr = renderer.getPixelRatio();
  if (canvas.width !== Math.floor(w*dpr) || canvas.height !== Math.floor(h*dpr)) {
    renderer.setSize(w, h, false); camera.aspect = w/h;
    // Girar o telefone muda a proporcao: o campo horizontal so fica constante se o
    // vertical for recalculado aqui.
    if (typeof INT !== "undefined" && INT.on) camera.fov = fovInterior(INT.orbita);
    camera.updateProjectionMatrix();
  }
}
addEventListener("resize", resize);
function frameLoop() { if (!looping) { looping = true; requestAnimationFrame(frame); } }

/* ---- governador de resolução ------------------------------------------- *
   As duas alavancas que sobram depois da criação do contexto: quantos pixels desenhar,
   e com que frequência refazer o mapa de sombra. A resolução é a mais forte que existe
   -- o custo de preenchimento é quadrático nela -- e a única que pode ser mexida a
   cada quadro sem recriar nada.

   A regra é ficar acima de ALVO_MIN e não passar de ALVO_MAX, mexendo devagar: quem
   corrige a cada quadro entra em oscilação visível (a tela "respira"). Mede-se a
   MEDIANA de uma janela, não a média, porque um único engasgo de coleta de lixo puxa
   média e faz o governador reagir a nada.

   Duas janelas são descartadas de propósito -- montagem de quarteirão e voo de entrada
   na casa são picos legítimos e conhecidos, e baixar a resolução por causa deles
   pioraria justamente o momento em que o usuário está olhando. */
const ALVO_MIN = 1000/30, ALVO_MAX = 1000/55;   // ms por quadro: piso de 30, folga a 55
// Teto por amostra. Precisa passar folgado acima do pior quadro REAL (uma máquina a 3
// FPS mede 333 ms, e é exatamente ela que mais precisa do governador) e ficar bem
// abaixo do rAF estrangulado, que chega a ~1.000 ms. 400 ms separa os dois casos sem
// encostar em nenhum. Foi medido: com a aba em segundo plano `document.hidden` continua
// FALSE nesta janela, então a guarda de visibilidade sozinha não bastava -- quem
// segurou o governador foi este teto.
const DT_MAX = 400;
// A janela fecha por contagem OU por tempo. Só por contagem, a 3 FPS, a primeira
// correção sairia 15 segundos depois -- tempo demais justamente na máquina que está
// pegando fogo.
const JANELA = 45, JANELA_MS = 1500;
const _dt = []; let _govAnt = 0, _cpuMs = 0, _cpuMed = 0, _somaDt = 0;
let dprAtual = Math.min(devicePixelRatio, NIVEL.dpr);
let rebaixado = false;
function governa(now) {
  const dt = _govAnt ? now - _govAnt : 0;
  _govAnt = now;
  // Aba oculta: o navegador estrangula o rAF pra ~1 Hz. Sem esta guarda o governador
  // leria 1.000 ms por quadro, concluiria "máquina lenta" e jogaria a resolução no
  // piso -- o usuário voltaria de outra aba com a página borrada por um engano. Mesma
  // armadilha que já engana o QA headless (ver [[mapa-3d-raf-aba-oculta]]).
  // O corte por amostra cobre de quebra alt-tab, pausa no depurador e coleta de lixo
  // longa: nada disso é sinal de GPU fraca.
  if (document.hidden) { _dt.length = 0; _somaDt = 0; return; }
  if (dt > 0 && dt < DT_MAX) { _dt.push(dt); _somaDt += dt; }
  if (_dt.length < JANELA && _somaDt < JANELA_MS) return;
  if (_dt.length < 6) { _dt.length = 0; _somaDt = 0; return; }   // amostra pequena não decide
  const ord = _dt.slice().sort((a, b) => a - b);
  const med = ord[ord.length >> 1];
  _dt.length = 0; _somaDt = 0;
  _cpuMed = med;
  // Pico conhecido: não é sinal de máquina fraca, é trabalho agendado.
  if (streamQ.length || INT.voo) return;
  const teto = Math.min(devicePixelRatio, NIVEL.dpr);
  let d = dprAtual;
  if (med > ALVO_MIN)      d = Math.max(NIVEL.dprMin, dprAtual * 0.85);
  else if (med < ALVO_MAX) d = Math.min(teto, dprAtual * 1.08);
  if (Math.abs(d - dprAtual) < 0.02) return;
  dprAtual = d;
  renderer.setPixelRatio(dprAtual);
  resize();
  // Chegou no piso da resolução e AINDA não segura 30: o que falta cortar (antialias,
  // buffer logarítmico) só sai na criação do contexto. Grava o nível de baixo pra
  // próxima abertura, em vez de recarregar por conta própria no meio do uso.
  if (!rebaixado && med > ALVO_MIN && dprAtual <= NIVEL.dprMin + 0.02 && NIVEL_NOME !== "baixo") {
    rebaixado = true;
    guarda.grava("mapa3d.qual", NIVEL_NOME === "alto" ? "medio" : "baixo");
    atualizaBotaoQual();
  }
}

/* ---- medidor ------------------------------------------------------------ */
const perfBox = $("perf");
let perfOn = QS.get("perf") === "1", _perfT = 0;
function mostraPerf(v) {
  perfOn = v; perfBox.hidden = !v;
  if (v) $("pfGpu").textContent = GPU || "GPU não identificada (extensão bloqueada)";
}
mostraPerf(perfOn);
function pintaPerf(now) {
  if (!perfOn || now - _perfT < 260) return;
  _perfT = now;
  const med = _cpuMed || 0, fps = med > 0 ? 1000/med : 0;
  const t = $("pfFps");
  t.textContent = fps ? fps.toFixed(0) + " FPS" : "—";
  t.className = "t " + (fps >= 50 ? "ok" : fps >= 28 ? "mid" : "bad");
  const i = renderer.info;
  $("pfMs").textContent  = med ? med.toFixed(1) + " ms" : "—";
  $("pfCpu").textContent = _cpuMs.toFixed(1) + " ms";
  $("pfDc").textContent  = i.render.calls;
  $("pfTri").textContent = (i.render.triangles/1e3).toFixed(0) + "k";
  $("pfPrg").textContent = i.programs ? i.programs.length : "—";
  $("pfGeo").textContent = i.memory.geometries;
  $("pfDpr").textContent = dprAtual.toFixed(2) + "× · " + NIVEL_NOME;
  $("pfQt").textContent  = gLive.size + (streamQ.length ? " +" + streamQ.length : "");
  $("pfSom").textContent = NIVEL.somMap + (NIVEL.somSuave ? " suave" : "");
}

const alvoSombra = new THREE.Vector3(1e9, 0, 1e9);
let _semRaf = false;   // ligado so durante __perf.passo()

/* ============================================================
   14. Busca, link de posição, minimapa e modo noite  (v12)
   ============================================================
   Quatro coisas que o mapa não tinha e que não custam quadro:

   - BUSCA. O índice é montado UMA vez, no loadCity, a partir do que já foi
     decodificado (as vias com nome, as edificações com nome e os POIs). Nada
     de varrer o DOM nem de reprocessar o JSON: `decode()` já entregou tudo.
   - LINK. A posição da câmera vai pra URL e volta dela. Em `file://` o
     `replaceState` pode ser recusado pela origem opaca; quando é, o recurso se
     desliga sozinho em vez de estourar um erro por segundo no console.
   - MINIMAPA. A malha viária inteira é rasterizada uma vez num canvas fora de
     tela (é a mesma lista de vias da busca); cada quadro só recorta, gira e
     desenha — um `drawImage`, não 10 mil linhas.
   - NOITE. A alavanca é a EXPOSIÇÃO, não a cor de cada material: chão, rua e
     terreno de fundo são MeshBasic (não são iluminados), então baixar o sol
     deixaria a cidade acesa e só os prédios escuros. Exposição pega todo mundo
     de uma vez, inclusive o que não tem luz nenhuma. Em cima disso, a janela
     acende — e isso sim é por material, no mesmo shader de fachada que já
     desenha o vão, somando em `totalEmissiveRadiance`.
   ============================================================ */

const semAcento = t => String(t).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/* ---------------- busca ---------------- */
const BUSCA = [];
function indexaBusca(B, R) {
  BUSCA.length = 0;
  for (const p of POIS)
    BUSCA.push({ k: "poi", n: p.n, s: p.cfg.curto, x: p.x, z: p.z, cor: p.cfg.col, poi: p });

  // Uma entrada por NOME de via, no meio do trecho mais comprido — o mesmo critério
  // do rótulo de rua, pra que "ir até a rua X" caia onde o nome aparece escrito.
  const porNome = new Map();
  for (const w of R) {
    if (!w.name || w.pts.length < 2) continue;
    let best = 0, bi = 0;
    for (let i = 0; i < w.pts.length - 1; i++) {
      const L = Math.hypot(w.pts[i+1][0] - w.pts[i][0], w.pts[i+1][1] - w.pts[i][1]);
      if (L > best) { best = L; bi = i; }
    }
    const ant = porNome.get(w.name);
    if (ant && ant.L >= best) continue;
    porNome.set(w.name, { L: best, x: (w.pts[bi][0] + w.pts[bi+1][0]) / 2,
                                  z: (w.pts[bi][1] + w.pts[bi+1][1]) / 2 });
  }
  for (const [n, v] of porNome) BUSCA.push({ k: "rua", n, s: "via", x: v.x, z: v.z });

  // Edificação com nome próprio: escola, hospital, shopping. São poucas (o `bm[]`
  // só existe pra quem tem nome ou endereço), então o centroide sai barato.
  // O que TAMBÉM tem nome próprio é o POI, e os dois vêm do mesmo OSM: sem esta
  // peneira, "catedral" devolvia a catedral duas vezes, uma como lugar e outra como
  // edificação. Quem fica é o POI, que tem endereço, horário e ficha.
  const jaTem = new Set(POIS.map(p => semAcento(p.n)));
  for (const b of B) {
    if (!b.name || BUSCA.length > 24000 || jaTem.has(semAcento(b.name))) continue;
    let mx = 0, mz = 0;
    for (const p of b.r) { mx += p[0]; mz += p[1]; }
    BUSCA.push({ k: "predio", n: b.name, s: CLS[b.c] === "biz" ? "comércio" : "edificação",
                 x: mx / b.r.length, z: mz / b.r.length });
  }
  for (const it of BUSCA) it.q = semAcento(it.n);
}

const bq = $("bq"), bres = $("bres");
let bSel = -1, bLista = [];

function buscaAgora(termo) {
  const q = semAcento(termo).trim();
  if (q.length < 2) return [];
  const alvo = target;
  const out = [];
  for (const it of BUSCA) {
    const i = it.q.indexOf(q);
    if (i < 0) continue;
    // Ordena por: começa com o termo > contém; depois pelo tipo (lugar antes de
    // via, que é o que se procura mais); e só então pela distância de onde a
    // câmera está. Sem a distância, "rua sao paulo" numa cidade com cinco delas
    // manda o usuário pra outra ponta do mapa.
    const d = Math.hypot(it.x - alvo.x, it.z - alvo.z);
    out.push({ it, r: (i === 0 ? 0 : 1000) + (it.k === "poi" ? 0 : it.k === "predio" ? 30 : 60) + d / 4000 });
    // O teto e alto de proposito: cortar cedo devolveria os primeiros 400 da ORDEM DO
    // INDICE, nao os melhores 400 -- 'ru' casa com quase toda via da cidade, e o
    // resultado mais perto ficaria de fora. Varrer os 11 mil itens custa menos de 2 ms.
    if (out.length > 3000) break;
  }
  out.sort((a, b) => a.r - b.r);
  return out.slice(0, 9).map(o => o.it);
}

function pintaBusca() {
  if (!bLista.length) {
    bres.innerHTML = bq.value.trim().length >= 2
      ? '<div class="vazio">Nada com esse nome por aqui.</div>' : "";
    bres.hidden = !bq.value.trim().length;
    return;
  }
  bres.innerHTML = bLista.map((it, i) =>
    '<div class="bi' + (i === bSel ? " on" : "") + '" data-i="' + i + '">' +
    '<i style="background:' + (it.cor || (it.k === "rua" ? "#5A6774" : "#A7AFB8")) + '"></i>' +
    '<span class="t">' + esc(it.n) + '</span><span class="s">' + esc(it.s) + '</span></div>').join("");
  bres.hidden = false;
}

function vaiPara(it) {
  if (!it) return;
  bres.hidden = true; bq.blur();
  // Buscar de dentro da casa e pedir pra sair: quem manda na camera ali e o
  // interiorFrame, entao o flyTo iria pro lugar certo com a camera presa na sala.
  if (INT.on) exitInterior();
  if (it.k === "poi") { openPoiSheet(it.poi); return; }
  aim({ x: it.x, z: it.z });
  flyTo(it.x, it.z, Math.min(Math.max(sph.radius, 180), 420));
  frameLoop();
}

bq.addEventListener("input", () => { bLista = buscaAgora(bq.value); bSel = bLista.length ? 0 : -1; pintaBusca(); });
bq.addEventListener("focus", () => { if (bLista.length) bres.hidden = false; });
bq.addEventListener("keydown", e => {
  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    e.preventDefault();
    if (!bLista.length) return;
    bSel = (bSel + (e.key === "ArrowDown" ? 1 : bLista.length - 1)) % bLista.length;
    pintaBusca();
  } else if (e.key === "Enter") { vaiPara(bLista[bSel] || bLista[0]); }
  else if (e.key === "Escape") { bres.hidden = true; bq.blur(); }
  e.stopPropagation();   // a cidade escuta tecla solta (P, R, WASD): digitar não é atalho
});
bq.addEventListener("keyup", e => e.stopPropagation());
bres.addEventListener("mousedown", e => {
  const el = e.target.closest(".bi"); if (!el) return;
  e.preventDefault(); vaiPara(bLista[+el.dataset.i]);
});
addEventListener("pointerdown", e => {
  if (!bres.hidden && !e.target.closest("#hud .busca")) bres.hidden = true;
}, true);

/* ---------------- link de posição ---------------- */
// `em` é lat,lon do ALVO da órbita (não da câmera): é o que a pessoa quer mostrar.
// r/p/t são raio, phi e theta — os três números que definem de onde se olha.
let _linkOk = true, _linkT = 0, _linkUlt = "";
function escreveLink() {
  if (!_linkOk || INT.on) return;
  const lat = CENTER.lat - target.z / MLAT, lon = CENTER.lon + target.x / MLON;
  const s = "em=" + lat.toFixed(5) + "," + lon.toFixed(5) +
            "&r=" + Math.round(sph.radius) +
            "&p=" + sph.phi.toFixed(2) + "&t=" + sph.theta.toFixed(2) +
            (NOITE.on ? "&noite=1" : "");
  if (s === _linkUlt) return;
  _linkUlt = s;
  try {
    const u = new URL(location.href);
    for (const k of ["em", "r", "p", "t", "noite"]) u.searchParams.delete(k);
    const busca = u.searchParams.toString();
    history.replaceState(null, "", u.pathname + "?" + (busca ? busca + "&" : "") + s + u.hash);
  } catch (e) {
    // file:// com origem opaca recusa o replaceState em alguns navegadores. Uma vez
    // recusado, não adianta tentar de novo a cada segundo.
    _linkOk = false;
  }
}
function lerLink() {
  const p = new URLSearchParams(location.search);
  if (p.get("noite") === "1") setNoite(true, true);
  const em = p.get("em"); if (!em) return;
  const [lat, lon] = em.split(",").map(Number);
  if (!isFinite(lat) || !isFinite(lon)) return;
  target.set(px(lon), 0, pz(lat));
  const r = Number(p.get("r")), f = Number(p.get("p")), t = Number(p.get("t"));
  if (isFinite(r) && r > 20) sph.radius = Math.min(9000, r);
  if (isFinite(f)) sph.phi = Math.max(0.06, Math.min(1.52, f));
  if (isFinite(t)) sph.theta = t;
  streamUpdate(true);
}

/* ---------------- minimapa ---------------- */
const MM = { cv: $("mmc"), ctx: null, vias: null, grade: null, pronto: false, on: true,
             t: 0, ax: 1e9, az: 1e9, ath: 1e9, ar: 0 };
const MM_CEL = 600;      // lado da celula do indice espacial, em metros

/* A primeira versao rasterizava a cidade inteira num canvas de 1.400 px e cada quadro
   recortava um pedaco dele. Sai barato e sai ILEGIVEL: a largura da linha fica presa a
   escala em que o bitmap foi desenhado, entao ou a via some quando se afasta, ou vira
   uma mancha cinza quando se aproxima (foi o que aconteceu -- 170 px de cinza chapado).

   Aqui o desenho e ao vivo, com a largura em PIXELS (que e o que importa num quadrado
   de 170 px), e o que segura o custo e um indice por celula de 600 m: em vez das ~11
   mil vias da cidade, cada quadro toca so as que caem na janela -- algumas centenas.
   E so redesenha quando a camera anda, gira ou aproxima (ver v12Frame). */
function montaBaseMinimapa(R) {
  MM.vias = R;
  MM.grade = new Map();
  MM.pronto = false;
  const chave = (cx, cz) => cx + "," + cz;
  for (let i = 0; i < R.length; i++) {
    const pts = R[i].pts;
    if (!pts || pts.length < 2) continue;
    let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9;
    for (const p of pts) {
      if (p[0] < minX) minX = p[0]; if (p[0] > maxX) maxX = p[0];
      if (p[1] < minZ) minZ = p[1]; if (p[1] > maxZ) maxZ = p[1];
    }
    // Uma via comprida entra em varias celulas. Marcar so a do meio deixaria a avenida
    // sumir do minimapa a 2 km do proprio centro dela.
    for (let cx = Math.floor(minX / MM_CEL); cx <= Math.floor(maxX / MM_CEL); cx++)
      for (let cz = Math.floor(minZ / MM_CEL); cz <= Math.floor(maxZ / MM_CEL); cz++) {
        const k = chave(cx, cz);
        let l = MM.grade.get(k); if (!l) MM.grade.set(k, l = []);
        l.push(i);
      }
  }
  MM.pronto = MM.grade.size > 0;
  MM.ctx = MM.cv.getContext("2d");
  MM.ax = 1e9;                      // forca o primeiro desenho
  MM.chaveVias = null;              // ...e o primeiro Path2D (ver desenhaMinimapa)
}

function desenhaMinimapa() {
  if (!MM.pronto || !MM.on) return;
  const g = MM.ctx, S = MM.cv.width, R2 = S / 2;
  // Quanto do mundo cabe no quadrado: acompanha o raio da orbita, senao o minimapa ou
  // fica inutil de perto ou vira borrao de longe.
  const alcance = Math.max(360, Math.min(6000, sph.radius * 4.0));
  const esc = S / alcance;                       // pixels por metro
  const meio = alcance * 0.72;                   // meia janela + folga pra rotacao

  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, S, S);
  g.fillStyle = "#0E141C"; g.fillRect(0, 0, S, S);
  g.translate(R2, R2);
  g.rotate(sph.theta);            // mesma convencao da bussola: a camera olha pra cima
  g.scale(esc, esc);
  g.translate(-target.x, -target.z);

  /* A GEOMETRIA das vias nao muda -- o que muda a cada quadro e a TRANSFORMACAO. Por
     isso os dois caminhos sao Path2D em coordenada de MUNDO, guardados, e o desenho e
     so `stroke(path)` sob a matriz da vez.

     A chave do cache e a JANELA DE CELULAS de 600 m, que e o que decide QUAIS vias
     entram: arrastar o mapa dentro da mesma janela passa a custar dois `stroke`, em vez
     de remontar algumas centenas de vias ponto a ponto. Medido em Ribeirao (22 mil vias
     no indice), no rasterizador de software do headless: 0,57 ms -> 0,06 ms por
     desenho. Quem invalida e cruzar celula ou mudar o alcance -- as duas coisas mudam a
     janela, entao a mesma chave cobre as duas. */
  const cx0 = Math.floor((target.x - meio) / MM_CEL), cx1 = Math.floor((target.x + meio) / MM_CEL);
  const cz0 = Math.floor((target.z - meio) / MM_CEL), cz1 = Math.floor((target.z + meio) / MM_CEL);
  // A ESCALA entra na chave por causa do ponto de POI: o raio dele sai de `esc`, entao
  // ele so pode ser reaproveitado enquanto o zoom nao muda. A via nao se importa (a
  // largura dela e propriedade do contexto, nao do caminho), mas uma chave so pros dois
  // e mais simples que duas -- e arrastar o mapa, que e o caso comum, nao mexe no zoom.
  const chaveVias = cx0 + ":" + cx1 + ":" + cz0 + ":" + cz1 + ":" + esc.toFixed(5);
  if (MM.chaveVias !== chaveVias) {
    MM.chaveVias = chaveVias;
    const vistas = new Set();
    for (let cx = cx0; cx <= cx1; cx++)
      for (let cz = cz0; cz <= cz1; cz++) {
        const l = MM.grade.get(cx + "," + cz); if (!l) continue;
        for (const i of l) vistas.add(i);
      }
    // Dois caminhos: a malha fina e a via larga. Sao desenhados em ordem (fina
    // primeiro, larga por cima), que e o que da leitura de "onde estao as avenidas"
    // num quadrado de 170 px.
    MM.paths = [new Path2D(), new Path2D()];
    for (const i of vistas) {
      const w = MM.vias[i], pts = w.pts;
      const p = MM.paths[BIGROAD.test(HW[w.k] || "") ? 1 : 0];
      p.moveTo(pts[0][0], pts[0][1]);
      for (let j = 1; j < pts.length; j++) p.lineTo(pts[j][0], pts[j][1]);
    }
    /* Um caminho por CATEGORIA, montado aqui e nao a cada desenho. Antes eram ate 2.393
       `arc()` por quadro so pra remontar os mesmos circulos; agora e um `fill()` por
       categoria acesa sobre caminho pronto. TODAS entram, inclusive as apagadas: ligar
       e desligar categoria passa a ser escolher QUAIS preencher, nao remontar nada.

       O recorte e a JANELA DE CELULAS, nao `target +/- meio`: dentro de uma mesma
       chave o alvo continua andando, e um recorte que anda junto deixaria de fora o
       ponto que acabou de entrar no quadro. A janela de celulas ja cobre o visivel com
       folga, e o que sobra e clipado pelo canvas.
       O `moveTo` antes de cada `arc` nao e enfeite: sem ele o arco novo se liga ao
       anterior por uma reta e o minimapa vira uma teia. */
    const rp = 1.9 / esc;
    const wx0 = cx0*MM_CEL, wx1 = (cx1+1)*MM_CEL;
    const wz0 = cz0*MM_CEL, wz1 = (cz1+1)*MM_CEL;
    MM.pathsPoi = {};
    for (const k of CAT_KEYS) {
      const lista = POI_POR_CAT[k]; if (!lista) continue;
      const P = new Path2D();
      let algum = false;
      for (const p of lista) {
        if (p.x < wx0 || p.x > wx1 || p.z < wz0 || p.z > wz1) continue;
        P.moveTo(p.x + rp, p.z);
        P.arc(p.x, p.z, rp, 0, Math.PI * 2);
        algum = true;
      }
      if (algum) MM.pathsPoi[k] = P;
    }
  }
  g.lineCap = "round"; g.lineJoin = "round";
  for (let k = 0; k < 2; k++) {
    g.lineWidth = (k ? 2.6 : 1.0) / esc;         // em PIXELS, nao em metros
    g.strokeStyle = k ? "rgba(226,232,240,.88)" : "rgba(139,152,167,.38)";
    g.stroke(MM.paths[k]);
  }
  // Os estabelecimentos ligados entram como ponto da cor da categoria: e o que
  // transforma o minimapa em "onde tem farmacia" em vez de so "onde tem rua". Os
  // caminhos ja estao montados acima; aqui so se escolhe quais preencher.
  if (!poiHidden) {
    g.globalAlpha = 0.85;
    for (const k of CAT_KEYS) {
      if (!catOn[k] || !MM.pathsPoi[k]) continue;
      g.fillStyle = CAT[k].col;
      g.fill(MM.pathsPoi[k]);
    }
    g.globalAlpha = 1;
  }

  // Cone de visao, ponto e norte: ja no sistema da tela, entao nao giram junto.
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.translate(R2, R2);
  const meioFov = Math.atan(Math.tan(camera.fov * Math.PI / 360) * camera.aspect);
  g.beginPath(); g.moveTo(0, 0);
  g.arc(0, 0, R2 * 0.92, -Math.PI / 2 - meioFov, -Math.PI / 2 + meioFov);
  g.closePath();
  g.fillStyle = "rgba(75,219,124,.10)"; g.fill();
  // O ponto da camera leva um anel escuro: sem ele some no meio dos pontos de POI.
  g.beginPath(); g.arc(0, 0, 4.4, 0, Math.PI * 2);
  g.fillStyle = "rgba(10,15,21,.85)"; g.fill();
  g.beginPath(); g.arc(0, 0, 3.0, 0, Math.PI * 2);
  g.fillStyle = "#4BDB7C"; g.fill();
  g.rotate(sph.theta);
  g.fillStyle = "rgba(231,235,240,.55)";
  g.font = "600 10px " + getComputedStyle(document.body).fontFamily;
  g.textAlign = "center"; g.fillText("N", 0, -R2 + 13);
  g.setTransform(1, 0, 0, 1, 0, 0);
  // Escala: sem ela o minimapa nao diz se aquilo e um bairro ou a cidade.
  const km = alcance >= 1000 ? (alcance / 1000).toFixed(1).replace(".", ",") + " km"
                             : Math.round(alcance) + " m";
  g.textAlign = "left";
  g.fillStyle = "rgba(8,12,17,.75)"; g.fillText(km, 8, S - 6);
  g.fillStyle = "rgba(231,235,240,.62)"; g.fillText(km, 7, S - 7);
}

/* --- a planta, dentro da casa ---------------------------------------------
   Ate o v12 o minimapa se ESCONDIA no interior: um mapa de rua desenhado por cima de
   uma sala nao diz nada. Ele nao volta a esconder -- troca de assunto. O que ele passa
   a mostrar e a planta do proprio imovel, com o ponto de onde se esta olhando: duas
   vistas ao mesmo tempo, a primeira pessoa na tela e o de-cima no canto.

   O desenho e no referencial da PLANTA, nao no do mundo. `pl.ob` guarda o eixo maior do
   predio, e desfazer essa rotacao poe o apartamento RETO no quadrado; uma planta torta
   dentro de 170 px desperdica metade da area e deixa de se ler como planta. Quem gira
   e so o cone de visao, que e o unico elemento cuja direcao importa.

   Nao ha guarda de "camera parada" separada: o gatilho e a POSICAO de quem anda
   (FP.pos/yaw), que e o que muda aqui dentro -- a mesma ideia da guarda do minimapa de
   rua, com outra fonte. */
function locDaPlanta(pl, x, z) {
  // inversa de pl.W: a matriz e [[ux,-uz],[uz,ux]] (rotacao pura), entao a inversa e a
  // transposta -- nao ha divisao nem caso degenerado.
  const o = pl.ob, dx = x - o.cx, dz = z - o.cz;
  return [o.ux*dx + o.uz*dz, -o.uz*dx + o.ux*dz];
}

function desenhaPlantaMini() {
  const pl = INT.pl;
  if (!pl || !pl.comodos || !pl.comodos.length) return;
  if (!MM.ctx) MM.ctx = MM.cv.getContext("2d");
  const g = MM.ctx, S = MM.cv.width;

  // Os limites nao mudam enquanto se anda: valem por planta.
  if (MM.limPl !== pl) {
    let u0 = 1e9, u1 = -1e9, v0 = 1e9, v1 = -1e9;
    for (const c of pl.comodos) for (const p of c.poly) {
      const q = locDaPlanta(pl, p[0], p[1]);
      if (q[0] < u0) u0 = q[0]; if (q[0] > u1) u1 = q[0];
      if (q[1] < v0) v0 = q[1]; if (q[1] > v1) v1 = q[1];
    }
    MM.limPl = pl; MM.lim = { u0, u1, v0, v1 };
  }
  // A faixa de baixo e da legenda: sem reserva-la, um apartamento mais alto que largo
  // encosta na linha do texto e os dois se atrapalham.
  const L = MM.lim, M = 12, MB = 22;
  const esc = Math.min((S - 2*M) / Math.max(0.5, L.u1 - L.u0),
                       (S - M - MB) / Math.max(0.5, L.v1 - L.v0));
  const ccu = (L.u0 + L.u1)/2, ccv = (L.v0 + L.v1)/2, cy = (M + S - MB) / 2;
  const px2 = (u, v) => [S/2 + (u - ccu)*esc, cy + (v - ccv)*esc];

  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, S, S);
  g.fillStyle = "#0E141C"; g.fillRect(0, 0, S, S);

  // Em que comodo se esta. E o unico destaque de cor da planta: "voce esta aqui" dito
  // pelo comodo inteiro se le de relance, coisa que um ponto de 3 px nao faz.
  const aqui = pl.comodos.find(c => inside(c.poly, FP.pos.x, FP.pos.z)) || null;

  for (const c of pl.comodos) {
    g.beginPath();
    for (let i = 0; i < c.poly.length; i++) {
      const q = locDaPlanta(pl, c.poly[i][0], c.poly[i][1]);
      const s = px2(q[0], q[1]);
      if (i === 0) g.moveTo(s[0], s[1]); else g.lineTo(s[0], s[1]);
    }
    g.closePath();
    g.fillStyle = c === aqui ? "rgba(75,219,124,.20)" : "rgba(226,232,240,.11)";
    g.fill();
  }

  // Parede INTEIRA (do chao ao teto) so. Peitoril e verga sao pedacos da mesma parede
  // na mesma posicao em planta: desenhar todos taparia justamente o vao, que e o que a
  // planta precisa mostrar -- onde se passa de um comodo pro outro.
  g.lineWidth = 2.1; g.lineCap = "round"; g.lineJoin = "round";
  g.strokeStyle = "rgba(231,235,240,.86)";
  g.beginPath();
  for (const w of pl.paredes) {
    if (w.y0 > 0.06 || w.y1 < pl.pd - 0.06) continue;
    const a = locDaPlanta(pl, w.a[0], w.a[1]), b = locDaPlanta(pl, w.b[0], w.b[1]);
    const sa = px2(a[0], a[1]), sb = px2(b[0], b[1]);
    g.moveTo(sa[0], sa[1]); g.lineTo(sb[0], sb[1]);
  }
  g.stroke();

  // A janela e o vao que CONTINUA sendo parede: linha fina no lugar dela. A porta fica
  // como buraco, que e como planta de arquitetura se le.
  g.lineWidth = 1.0; g.strokeStyle = "rgba(120,190,255,.75)";
  g.beginPath();
  for (const e of pl.esquadrias) {
    if (e.porta) continue;
    const a = locDaPlanta(pl, e.a[0], e.a[1]), b = locDaPlanta(pl, e.b[0], e.b[1]);
    const sa = px2(a[0], a[1]), sb = px2(b[0], b[1]);
    g.moveTo(sa[0], sa[1]); g.lineTo(sb[0], sb[1]);
  }
  g.stroke();

  // Onde se esta e pra onde se olha. A camera olha em (-sen yaw, -cos yaw) no mundo; a
  // mesma rotacao inversa dos pontos leva a direcao pro referencial da planta.
  const q = locDaPlanta(pl, FP.pos.x, FP.pos.z);
  const s = px2(q[0], q[1]);
  const dx = -Math.sin(FP.yaw), dz = -Math.cos(FP.yaw);
  const du = pl.ob.ux*dx + pl.ob.uz*dz, dv = -pl.ob.uz*dx + pl.ob.ux*dz;
  const ang = Math.atan2(dv, du);
  const meioFov = Math.atan(Math.tan(camera.fov * Math.PI / 360) * camera.aspect);
  g.beginPath(); g.moveTo(s[0], s[1]);
  g.arc(s[0], s[1], 30, ang - meioFov, ang + meioFov);
  g.closePath(); g.fillStyle = "rgba(75,219,124,.20)"; g.fill();
  g.beginPath(); g.arc(s[0], s[1], 4.4, 0, Math.PI*2);
  g.fillStyle = "rgba(10,15,21,.85)"; g.fill();
  g.beginPath(); g.arc(s[0], s[1], 3.0, 0, Math.PI*2);
  g.fillStyle = "#4BDB7C"; g.fill();

  // Legenda: o comodo em que se esta. E o que o rotulo 3D ja diz quando se olha pra
  // ele, dito aqui sem precisar olhar.
  const txt = aqui ? aqui.nome + " \u00b7 " + Math.round(aqui.area) + " m\u00b2"
                   : Math.round(pl.area) + " m\u00b2";
  g.font = "600 10px " + getComputedStyle(document.body).fontFamily;
  g.textAlign = "left";
  g.fillStyle = "rgba(8,12,17,.75)"; g.fillText(txt, 8, S - 6);
  g.fillStyle = "rgba(231,235,240,.72)"; g.fillText(txt, 7, S - 7);
}

MM.cv.addEventListener("click", e => {
  // Dentro da casa o quadrado e planta, nao mapa: clicar nele nao teleporta ninguem
  // (a camera ali anda com colisao, e pular pra dentro de uma parede seria o fim).
  if (INT.on) return;
  if (!MM.pronto) return;
  const r = MM.cv.getBoundingClientRect(), S = MM.cv.width;
  const dx = (e.clientX - r.left) / r.width * S - S / 2;
  const dy = (e.clientY - r.top) / r.height * S - S / 2;
  const alcance = Math.max(420, Math.min(7000, sph.radius * 4.2)), esc = S / alcance;
  const c = Math.cos(-sph.theta), s = Math.sin(-sph.theta);
  const wx = (dx * c - dy * s) / esc + target.x;
  const wz = (dx * s + dy * c) / esc + target.z;
  aim({ x: wx, z: wz });
  flyTo(wx, wz, sph.radius);
  frameLoop();
});

$("tMapa").addEventListener("click", () => {
  MM.on = $("tMapa").getAttribute("aria-pressed") !== "true";
  $("tMapa").setAttribute("aria-pressed", String(MM.on));
  $("minimapa").hidden = !MM.on;
  guarda.grava("mapa3d.minimapa", MM.on ? "1" : "0");
  if (MM.on) desenhaMinimapa();
});
// Sem botao no painel, a preferencia guardada nao tem como ser desfeita: uma sessao
// antiga que desligou o minimapa deixaria ele desligado pra sempre. Com o controle
// fora, o minimapa e sempre visivel.

/* ---------------- modo noite ---------------- */
const NOITE = { on: false, t: 0, dia: null };
function guardaDia() {
  if (NOITE.dia) return;
  NOITE.dia = { exp: renderer.toneMappingExposure,
                sol: sun.intensity, solCor: sun.color.getHex(),
                hemi: hemi.intensity, ceu: hemi.color.getHex(), chao: hemi.groundColor.getHex(),
                fog: scene.fog.color.getHex(), fundo: renderer.getClearColor(new THREE.Color()).getHex() };
}
function aplicaNoite() {
  if (INT.on) return;         // dentro de casa a iluminação é outra (ver interiorFrame)
  guardaDia();
  const d = NOITE.dia, k = NOITE.t;
  // Exposição é a alavanca: pega prédio (Phong), chão, rua e terreno de fundo
  // (MeshBasic, sem luz nenhuma) na mesma conta. 1,18 -> 0,40 é o que põe o asfalto
  // em luminância de noite sem apagar a silhueta.
  renderer.toneMappingExposure = d.exp * (1 - k) + 0.40 * k;
  sun.intensity = d.sol * (1 - k) + d.sol * 0.16 * k;
  sun.color.setHex(d.solCor).lerp(new THREE.Color(0x8FA8DA), k);
  hemi.intensity = d.hemi * (1 - k) + d.hemi * 0.30 * k;
  hemi.color.setHex(d.ceu).lerp(new THREE.Color(0x2A3A5C), k);
  hemi.groundColor.setHex(d.chao).lerp(new THREE.Color(0x0A0E14), k);
  const noiteCor = new THREE.Color(0x0C1622);
  scene.fog.color.setHex(d.fog).lerp(noiteCor, k);
  renderer.setClearColor(new THREE.Color(d.fundo).lerp(noiteCor, k), 1);
  // A cupula tem toneMapped:false -- a exposicao, que e a alavanca de tudo o mais aqui,
  // nao chega nela. Quem escurece o ceu e a COR do material, que multiplica a textura.
  if (CEU) CEU.material.color.setRGB(1, 1, 1).lerp(new THREE.Color(0x0E1726), k);
  uNoite.value = k;
  sujaSombra();
}
function setNoite(on, jaVai) {
  NOITE.on = on;
  if (jaVai) NOITE.t = on ? 1 : 0;
  const b = $("tNoite");
  if (b) b.setAttribute("aria-pressed", String(on));
  guarda.grava("mapa3d.noite", on ? "1" : "0");
  aplicaNoite(); frameLoop();
}
$("tNoite").addEventListener("click", () => setNoite(!NOITE.on));
if (guarda.le("mapa3d.noite") === "1") setNoite(true, true);

// Porta pro QA headless, como o resto do __int: sem isto nenhuma sonda consegue
// perguntar em que ponto da transicao a noite parou.
// `el` e o $ do proprio app: e por ele que uma sonda alcanca os controles que sairam
// do painel (viraram elemento orfao -- ver SUMIDOS la em cima). O botao nao esta no
// documento, entao `document.getElementById` nao acha; a funcao continua.
Object.assign(window.__int, { NOITE, MM, setNoite, BUSCA, buscaAgora, el: $, v12: 1,
                              desenhaPlantaMini, desenhaMinimapa, locDaPlanta });

/* ---------------- o que o laço de quadro chama ---------------- */
let _v12Int = false, _v12Ult = 0, _mmDentro = false;
function v12Frame(now) {
  // Sair da casa: o interiorFrame restaurou os valores de DIA que ele guardou na
  // entrada. Se estava de noite, é aqui que a noite volta.
  if (_v12Int && !INT.on) aplicaNoite();
  _v12Int = INT.on;

  // A transicao anda pelo RELOGIO, nao por quadro. Medido no rasterizador de
  // software (o pior caso, e o do QA headless): 8 quadros em 6 s -- com passo por
  // quadro o amanhecer levava 30 s e parecia que o botao nao tinha funcionado.
  // O teto de 400 ms nao e enfeite: no rasterizador de software o quadro leva ~750 ms,
  // e com teto de 120 a transicao andava 0,17 por quadro -- 6 s pra escurecer. O teto
  // existe so pra que uma pausa longa (aba escondida) nao vire um salto seco.
  const dt = Math.min(400, Math.max(0, now - (_v12Ult || now)));
  _v12Ult = now;
  if (NOITE.t !== (NOITE.on ? 1 : 0)) {
    const passo = dt / 700;
    NOITE.t = NOITE.on ? Math.min(1, NOITE.t + passo) : Math.max(0, NOITE.t - passo);
    aplicaNoite();
    frameLoop();
  }
  // v13: dentro da casa o minimapa nao se esconde mais -- ele troca de assunto e
  // desenha a PLANTA do imovel (ver desenhaPlantaMini). Entrar e sair invalida os dois
  // lados: quem entra pode nao ter andado um metro, e quem sai encontra o quadrado com
  // a planta ainda pintada.
  if (INT.on !== _mmDentro) {
    _mmDentro = INT.on;
    $("minimapa").hidden = !MM.on;
    $("minimapa").title = INT.on ? "Planta do im\u00f3vel" : "Clique para ir at\u00e9 o ponto";
    MM.ax = 1e9; MM.px = 1e9;
  }
  if (now - _linkT > 1000) { _linkT = now; escreveLink(); }
  // O minimapa só se redesenha quando o que ele mostra muda: parado, custa zero. É a
  // mesma guarda dos rótulos de rua, com a fonte trocada conforme o assunto -- lá fora
  // a órbita, aqui dentro o passo de quem anda.
  if (!MM.on) { /* desligado: nada a desenhar */ }
  else if (INT.on) {
    if (FP.pos.x !== MM.px || FP.pos.z !== MM.pz || FP.yaw !== MM.pyaw) {
      MM.px = FP.pos.x; MM.pz = FP.pos.z; MM.pyaw = FP.yaw;
      desenhaPlantaMini();
    }
  } else if (MM.pronto &&
      (target.x !== MM.ax || target.z !== MM.az || sph.theta !== MM.ath || sph.radius !== MM.ar)) {
    MM.ax = target.x; MM.az = target.z; MM.ath = sph.theta; MM.ar = sph.radius;
    desenhaMinimapa();
  }
}

function frame(now) {
  const t0 = performance.now();
  governa(now);
  ajustaEsferas();   // v8: relevo/altura mudaram? a esfera de corte muda junto
  resize();
  // Prédio subindo é vértice se movendo no shader: a sombra tem que acompanhar.
  for (const r of risers) if (r.u.value < 1) { r.u.value = Math.min(1, (now - r.t0)/1100); sujaSombra(); }
  if (mark.visible) {
    const b = 0.5 + 0.5*Math.sin(now*0.005);
    markMat.opacity = 0.22 + b*0.42; fillMat.opacity = 0.03 + b*0.05;
  }
  if (houseBeacon.visible) {
    const b = 0.5 + 0.5*Math.sin(now*0.006);
    houseBeaconMat.opacity = 0.5 + b*0.45;
  }
  // v4: o alvo da orbita segue o relevo. O target nasce sempre com y=0
  // (target.set(p.x, 0, p.z)), mas o chao e deslocado pra cima por
  // terrainY()*reliefAmount -- e terrainY ja embute TERRAIN_EXAG=4.5. Num bairro
  // alto isso punha o terreno POR CIMA da camera: ela orbitava um ponto no nivel
  // do mar enquanto o chao subia centenas de metros, e a cena ficava tapada.
  // Afastar a camera nao resolveria, so afastaria um ponto que continua enterrado.
  target.y = terrainYCached(target.x, target.z) * reliefAmount;
  // v15: o bake assenta ao longo dos quadros. DURANTE O VOO ele gasta o triplo:
  // um quadro perdido enquanto a câmera varre a sala não se vê, e é ali que está
  // quase todo o tempo disponível antes de alguém olhar pra parede parada. Depois
  // que a câmera para, volta ao gasto pequeno. Ver `bakePrepara`.
  if (BAKE.fila && bakePasso(BAKE.fila, INT.voo ? BAKE.orcVoo : BAKE.orcamento))
    BAKE.fila = null;
  // v9: o interior manda na camera enquanto durar o voo de entrada ou a
  // primeira pessoa; fora disso interiorFrame so cuida do plano de corte.
  interiorFrame(now);
  if (!INT.voo && (!INT.on || INT.orbita)) {
    camera.position.setFromSpherical(sph).add(target);
    camera.lookAt(target);
  }
  sun.position.set(target.x + SOL_OFF.x, SOL_OFF.y, target.z + SOL_OFF.z);
  sun.target.position.copy(target);
  camera.updateMatrixWorld();
  $("compass").firstElementChild.style.transform = `rotate(${sph.theta}rad)`;

  const W = innerWidth, H = innerHeight;

  // v9: rotulo de rua e desenhado por cima de tudo (DOM) e atravessa a parede da sala.
  if (INT.on) {
    for (const l of labels) if (l.el.style.display !== "none") l.el.style.display = "none";
    sujaRotulos();   // sair da casa tem que redesenhar, ainda que a camera volte igual
  } else if (showLab) {
    // Camera parada = rotulo parado. Projetar 2.000 rotulos e reescrever 2.000
    // `style.transform` por quadro pra pintar o mesmo pixel e trabalho puro de CPU --
    // e "usuario parado olhando a cidade" e o quadro comum, nao a excecao.
    // `camera.position` ja resume alvo, theta, phi e raio, e a rotacao sai do lookAt
    // sobre o alvo, entao ela nao precisa entrar na conta AQUI (a primeira pessoa, que
    // gira sem andar, so existe com INT.on e cai no ramo de cima). W/H cobre o
    // redimensionamento e reliefAmount cobre o botao Relevo.
    // Quem mexe na LISTA avisa por sujaRotulos(), nao por comparacao: rebuildOverlay()
    // refaz os rotulos inteiros quando o conjunto vivo muda e a lista volta com
    // elementos NOVOS, que nascem display:none -- as vezes no mesmo tamanho. Testado:
    // com `labels.length` como chave, andar pela cidade apagava o rotulo de rua e ele
    // so voltava quando alguma outra coisa invalidava a guarda.
    if (!_rotCam.equals(camera.position) || W !== _rotW || H !== _rotH ||
        reliefAmount !== _rotRel) _rotSujo = true;
    if (_rotSujo) {
      _rotCam.copy(camera.position); _rotW = W; _rotH = H;
      _rotRel = reliefAmount; _rotSujo = false;
      for (const l of labels) {
        l.v.copy(l.m); l.v.y += l.ym*reliefAmount; l.v.project(camera);
        if (l.v.z > 1 || Math.abs(l.v.x) > 1.05 || Math.abs(l.v.y) > 1.05) { l.el.style.display = "none"; continue; }
        l.v2.copy(l.b); l.v2.y += l.yb*reliefAmount; l.v2.project(camera);
        tmp.copy(l.a); tmp.y += l.ya*reliefAmount; tmp.project(camera);
        const ax = (tmp.x*0.5+0.5)*W, ay = (-tmp.y*0.5+0.5)*H;
        const bx = (l.v2.x*0.5+0.5)*W, by = (-l.v2.y*0.5+0.5)*H;
        if (Math.hypot(bx-ax, by-ay) < 78) { l.el.style.display = "none"; continue; }
        let ang = Math.atan2(by-ay, bx-ax);
        if (ang > Math.PI/2) ang -= Math.PI; else if (ang < -Math.PI/2) ang += Math.PI;
        l.el.style.display = "block";
        l.el.style.transform = `translate(${(l.v.x*0.5+0.5)*W}px,${(-l.v.y*0.5+0.5)*H}px) translate(-50%,-50%) rotate(${ang}rad)`;
      }
    }
  }
  // v10: as arvores sao InstancedMesh por especie, refeitas quando o conjunto vivo
  // muda OU quando o alvo anda o bastante pra mudar quem esta dentro dos 1800 m.
  { const dx = target.x - arvAlvo.x, dz = target.z - arvAlvo.z;
    if (dx*dx + dz*dz > 200*200) { arvAlvo.set(target.x, 0, target.z);
      arvSujo = true; arvTotal = true; somSujo = true; }
    // Andou QUALQUER coisa: quem esta dentro do raio pode ter mudado. Barato porque o
    // remendo so escreve matriz de quem cruzou a fronteira (ver arvVisto).
    else if (target.x !== arvVisto.x || target.z !== arvVisto.z) arvSujo = true; }
  if (arvSujo) { refazArvores(); refazPortoes(); sujaSombra(); }
  if (somSujo) { refazSombras(); sujaSombra(); }
  updatePois();
  streamUpdate(false);   // alvo mudou? recalcula o conjunto vivo
  streamPump();          // gasta ate STREAM_MS montando o que falta

  /* A sombra só é redesenhada quando alguma coisa que a projeta mudou. O sol acompanha
     o alvo, então andar pela cidade invalida o mapa -- mas só depois de andar o
     bastante pra sombra sair do lugar: sub-metro não muda um pixel do mapa de sombra e
     custaria uma passada inteira da cena. Dentro de casa a cena é uma casa só (poucas
     chamadas de desenho) e o usuário mexe em móvel o tempo todo, então lá vale sempre
     redesenhar em vez de rastrear cada edição. */
  if (INT.on) sujaSombra();
  else if (alvoSombra.distanceToSquared(target) > 1) { alvoSombra.copy(target); sujaSombra(); }
  // Nos niveis fracos SOMBRA_CIDADE e false e nada na cidade projeta nem recebe: a
  // passada do mapa de sombra percorre o grafo inteiro pra desenhar nada e ainda paga
  // bind + clear do alvo de profundidade, a cada quadro em que o alvo anda 1 m.
  // Desligar `shadowMap.enabled` daria o mesmo, mas o three exige `needsUpdate` em TODO
  // material depois de trocar essa flag -- seria recompilar a cidade inteira na entrada
  // da casa, exatamente o congelamento que a nota do SOMBRA_CIDADE evita. INT.on ja
  // cobre a casa inteira, voo de entrada e de saida inclusive.
  renderer.shadowMap.needsUpdate = sombraSuja && (SOMBRA_CIDADE || INT.on);
  sombraSuja = false;

  v12Frame(now);   // busca/link/minimapa/noite -- ver secao 14
  nevoaDoQuadro();

  // A cupula do ceu anda com a camera: ela e um FUNDO, nao um lugar.
  if (CEU && CEU.visible) CEU.position.copy(camera.position);
  renderer.render(scene, camera);
  _cpuMs = performance.now() - t0;
  pintaPerf(now);
  if (!_semRaf) requestAnimationFrame(frame);
}

boot();
})();

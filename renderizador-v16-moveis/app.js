
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



/* ============================================================
   3. Arquivo consolidado: números inteiros e diferença entre pontos
   ============================================================ */
const {shoelace, inside, insetRing, safeInset, convexHull, obbOf} = MapGeometry;
const triangulateRing = r => MapGeometry.triangulateRing(r,
  typeof earcut === 'function' ? earcut : null,
  ring => THREE.ShapeUtils.triangulateShape(ring.map(p => new V2(p[0], p[1])), []));
const decode = CityData.createDecoder(Q, shoelace);

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
// localStorage joga em file:// (origem opaca) e em janela anônima. Como a página abre
// por duplo clique de propósito, ler isso sem proteção derrubaria o app inteiro.
const guarda = MapStorage.create(() => localStorage);
const QS = new URLSearchParams(location.search);
// Nivel de graficos (tabela, palpite pela GPU e precedencia ?q= / gravado / palpite):
// ver scene/quality.js.
const {GPU, NIVEL_NOME, NIVEL} = GraphicsQuality.create({document, guarda, QS});
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
// Planos e campo de visao da camera (cidade e casa): ver scene/camera-lenses.js.
const {NEAR_CIDADE, NEAR_CASA, FAR_CIDADE, FAR_CASA, FOV_CIDADE, fovInterior} = CameraLenses.create({NIVEL});
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
let reliefAmount = 0, reliefTarget = 0;
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

const terrain = WorldTerrain.create({THREE, TerrainFit,
  n: ELEV_N, half: ELEV_HALF, exaggeration: TERRAIN_EXAG,
  getAmount: () => reliefAmount});
const {sample: terrainY, sampleCached: terrainYCached,
       register: registerTerrain, apply: applyTerrainToGeo} = terrain;

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
const {GLSL_RUIDO} = MaterialResources;
const TEX_CIDADE = (() => {
  const el = document.getElementById("__textura");
  let data = {};
  try { data = JSON.parse(el.textContent) || {}; } catch (e) {}
  return MaterialResources.cityTextures({THREE, ImageClass: Image, data,
    maxAnisotropy: renderer.capabilities.getMaxAnisotropy()});
})();

const {facadeMaterial, riseLine} = FacadeMaterials.create({
  THREE, AP_LUZ, AP_JANELA, TEX_CIDADE, GLSL_RUIDO,
  uRelief, uHeight, uFuro, uNoite
});
const surfaceMaterials = SurfaceMaterials.create({THREE, K, TEX_CIDADE, GLSL_RUIDO});
const flat = c => new THREE.MeshPhongMaterial({ color:c, shininess:0, specular:0x000000, polygonOffset:true, polygonOffsetFactor:-1, polygonOffsetUnits:-1 });
// v6: chao que acompanha o relevo (quadras). Ver make_v6.py.
// v7: o relevo tem que estar carregado ANTES de chao/rua/muro/predio se registrarem.
// registerTerrain CONGELA o dy de cada vertice na hora do registro, e terrainY()
// devolve 0 enquanto terrain.grid for null - e o terrain.grid so era carregado no clique do
// botao Relevo. Consequencia: chao, rua e muro ficavam com dy=0 pra sempre; ao ligar
// o Relevo so os predios subiam/desciam, e onde o terreno e NEGATIVO a casa afundava
// no chao plano. Aqui a grade embutida e lida logo no boot.
(function preloadElev(){
  if (terrain.grid) return;
  const t = document.getElementById("__elevdata");
  if (!t) return;
  try {
    const a = JSON.parse(t.textContent);
    if (Array.isArray(a) && a.length === ELEV_N*ELEV_N) terrain.grid = Float32Array.from(a);
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
  // TerrainFit clips directly to the common elevation grid in registerTerrain.
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
  const matChao = surfaceMaterials.chao();
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
function buildMuros() {
  const el = document.getElementById("__murosdata");
  if (!el) return;
  let data; try { data = JSON.parse(el.textContent); } catch(e) { return; }
  const walls = WorldWalls.build(data, {THREE, roadSafety, terrainY, hash,
    registerTerrain, material:surfaceMaterials.muros(), shadows:SOMBRA_CIDADE});
  scene.add(walls.mesh);
  window.__gMuros = walls.mesh;
  if (exteriors) exteriors.walls(walls.detailSegments, walls.detailHidden, walls.mesh.geometry.attributes.color);
}
(function buildStreets(){
  const el = document.getElementById("__streetdata");
  if (!el) return;
  let a; try { a = JSON.parse(el.textContent); } catch(e){ return; }
  // TerrainFit clips directly to the common elevation grid in registerTerrain.
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
  const mat = surfaceMaterials.asfalto();
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
  if (!terrain.grid) return;
  // Maior termo de torcao da grade -- e o quanto dois triangulos por celula erram
  // contra a bilinear do terrainY. Subdividir por SUB divide o erro por SUB^2.
  let torc = 0;
  for (let j=0;j<ELEV_N-1;j++) for (let i=0;i<ELEV_N-1;i++){
    const t = Math.abs(terrain.grid[j*ELEV_N+i] + terrain.grid[(j+1)*ELEV_N+i+1]
                     - terrain.grid[j*ELEV_N+i+1] - terrain.grid[(j+1)*ELEV_N+i]) / 4 * TERRAIN_EXAG;
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
  for (const geo of terrain.geometries()) {
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
  const mat = surfaceMaterials.fundo();
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


// Earcut lida com polígonos côncavos/degenerados de forma muito mais tolerante que
// THREE.ShapeUtils.triangulateShape, que costuma falhar (e descartar o prédio inteiro
// em silêncio) em contornos comuns do OSM. Cai de volta pro triangulador do three.js
// só se a lib não carregou.





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

const {ST, ST_NOME, tipoDe, BUILDING_INSET} = BuildingType;

/* --- retângulo mínimo orientado (OBB) -----------------------------------
   Serve pra duas coisas: dar eixo e proporção pro telhado inclinado, e medir
   o quanto o contorno REALMENTE é um retângulo (`rect`). Contorno de casa no
   OSM quase sempre é; contorno digitalizado por ML raramente é. É esse número
   que decide quem ganha telhado de duas águas e quem cai pra laje — em vez de
   inventar um telhado torto sobre um polígono que não comporta. */


/* --- arquétipo ----------------------------------------------------------
   A ordem das regras é a ordem da confiança: o que veio etiquetado no dado
   manda, e a geometria só decide o resto — que aqui é a maioria, porque em
   São Carlos a classe do city.json é "sem uso mapeado" na maior parte do
   acervo. É exatamente esse buraco que faz uma cidade inteira virar caixa
   cinza se ninguém preencher. */


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

// Biblioteca de exteriores: a geometria e compartilhada entre todos os quarteiroes.
// ?casas=procedural permite comparar com a representacao anterior.
let urban = null;
let exteriors = null;
let roadSafety = null;
if(window.ExteriorDetails && $("__exteriorModels") && QS.get("exteriores")!=="0"){
  try {
    exteriors=ExteriorDetails.create(THREE,JSON.parse($("__exteriorModels").textContent),scene,
      {terrain:terrainY,coverageRadius:()=>STREAM_R+STREAM_HYST,groundTexture:TEX_CIDADE.chao,roadHit:ring=>!!roadSafety?.hit(ring),compact:matchMedia("(pointer:coarse)").matches||innerWidth<=820});
  }catch(e){console.warn("Detalhes externos indisponíveis; mantendo a representação anterior.",e);}
}
const buildingPlacement = BuildingPlacement.create({geometry: MapGeometry, types: BuildingType, terrainY});
const {explicitBuilding} = buildingPlacement;
const buildingOverRoad = b => buildingPlacement.blocked(b, roadSafety);
const urbanSplit = records => buildingPlacement.split(records, urban, roadSafety);
if (new URLSearchParams(location.search).get("casas") !== "procedural") {
  try {
    urban = UrbanModels.create(THREE, JSON.parse($("__urbanModels").textContent), gBuild,
                              {cut:uFuro, shadows:SOMBRA_CIDADE,terrain:urbanBase});
  } catch (e) { console.warn("Biblioteca urbana indisponivel; usando volumes atuais.", e); }
}
function urbanBase(b, x, z) {
  return terrainY(x,z);
}
const {buildBuildings} = WorldBuildings.create({THREE, APAR, CLS, TILE_M, LV,
  geometry: MapGeometry, types: BuildingType, hash, terrainY, registerTerrain,
  triangulateRing, explicitBuilding, getRoadSafety: () => roadSafety});

/* A fita da rua, em duas peças com ALTURAS diferentes (v11).

   Até o v10 pista e calçada eram dois quads planos, e — o que é pior — a PISTA ficava
   por cima (y 0,35 contra 0,18). Não havia meio-fio nenhum: a calçada era uma faixa
   pintada. Agora:

     pista    y = 0,10   faixa [0 .. base]           quad cheio, com o remendo da junta
     calçada  y = 0,32   faixa [base .. base*mul]    DUAS faixas laterais
     sarjeta            faixa de 30 cm junto da pista, no nivel baixo
     chanfro            quina de 4 cm entre face vertical e passeio
     meio-fio            quad VERTICAL em ±base, ligando as duas alturas

   A calçada virou faixa lateral por necessidade, não por elegância: como quad cheio
   ela passaria POR CIMA do asfalto agora que está mais alta.

   E ela é encurtada nas pontas de cada via. Sem isso, a calçada de uma rua atravessa
   o cruzamento da outra como uma lombada de 15 cm no meio do asfalto — as vias do OSM
   são cortadas nos entroncamentos, então a ponta da via é a esquina. */
const roadGeometry = WorldRoads.create({THREE,
  widthOf: w => ROAD_W[HW[w.k]] || 6, registerTerrain});
const {indexaJuncoes} = roadGeometry;

const {matVia} = RoadMaterials.create({THREE, AP_RUA, K, GLSL_RUIDO});

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
  return VegetationPlanning.decode(d, CIDADE.arborizacao);
})();
const vegetationPlanning = VegetationPlanning.create({ARV, ROAD_W, HW, hash, inside, ndviBruto});
const {buildTrees} = vegetationPlanning;
function indexaAsfalto(roads) {
  indexaJuncoes(roads);
  vegetationPlanning.indexaAsfalto(roads);
}

const vegetation = VegetationScene.create({THREE, ARV, terrainY,
  getRelief: () => reliefAmount, target, SOMBRA_CIDADE, getLive: () => gLive});
scene.add(vegetation.group);

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
const gatesData = (() => {
  const el = document.getElementById("__portoes");
  if (!el) return null;
  try { return JSON.parse(el.textContent); } catch (e) { return null; }
})();
const gates = Gates.create({THREE, data:gatesData, target, terrainY,
  getRelief: () => reliefAmount, SOMBRA_CIDADE});
scene.add(gates.group);
const refazPortoes = gates.refresh;

/* ============================================================
   6. Montagem de um lote
   ============================================================ */
const overlay = $("overlay");
let built = 0, blocks = 0;
const streetLabels = StreetLabels.create({THREE, document, overlay, terrainY});
const {addStreets, recalcDyRotulos, sujaRotulos} = streetLabels;

/* v4: era assemble(). Além de montar, agora REGISTRA em `rec` tudo o que criou —
   malhas, parcelas e uniforms de animação — porque uma quadra que entra na visão
   também precisa poder sair. No v3 nada era descartado, então nada precisava ser
   rastreado. */
function assembleInto(rec, B, R, G, cx, cz) {
  const add = (o, parent) => { parent.add(o); rec.objs.push(o); return o; };
  const gp = buildPatches(G);
  if (gp.m) { const m = new THREE.Mesh(gp.m, flat(K.green)); m.receiveShadow = SOMBRA_CIDADE; add(m, gRest); }
  for (const mesh of roadGeometry.meshes(R, {material: matVia, K, shadows: SOMBRA_CIDADE})) add(mesh, gRoad);
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
    if (rec.plants) vegetation.invalidate();
    somSujo = true;   // sombra de contato existe em quarteirao sem uma arvore sequer
  }
  const safeBuildings = B.filter(b=>!buildingOverRoad(b));
  rec.roadRejected = B.length-safeBuildings.length;
  const replaced = urbanSplit(safeBuildings);
  rec.urban = replaced.slots;
  const b = buildBuildings(replaced.rest, cx, cz);
  rec.sombras = new Float32Array([...(b?b.sombras:[]),...replaced.shadows]);
  if (b) {
    const u = { value: slow ? 1 : 0 };
    risers.push({ u, t0: performance.now() });
    rec.risers.push(u);
    const bm = new THREE.Mesh(b.g, facadeMaterial(u));
    // v9: o interior precisa voltar da FACE clicada pro registro do predio.
    // `presetCenter` ja da o centroide por vertice; falta so a lista onde
    // procurar. E uma referencia, nao uma copia -- custa um ponteiro.
    bm.userData.recs = replaced.rest;
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
  blocks += replaced.slots.length;
  return (b ? b.count : 0) + replaced.slots.length;
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
const streaming = WorldStreaming.create({target, live:gLive, getGroups:()=>gGroups,
  getRadius:()=>STREAM_R, hysteresis:STREAM_HYST, budgetMs:STREAM_MS,
  dropGroup, buildGroup, rebuildOverlay, now:()=>performance.now()});

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
const {_LUZUE, texturaDeLuz, cursorDeLuz} = LightAtlas.create({THREE, document, sujaSombra});

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
  // Prédios: fatia contígua de B. O build_city_v4.py reordenou o b[] agrupando
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
  if (urban) for (const slot of rec.urban || []) urban.remove(slot);
  for (const o of rec.objs) {
    if (o.parent) o.parent.remove(o);
    if (o.geometry) {
      terrain.unregister(o.geometry);
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
  if (rec.plants) vegetation.invalidate();
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
  streetLabels.clear();
  for (const rec of gLive.values())
    for (const w of rec.roads) addStreets([w]);
}

const streamUpdate = streaming.update;

/* Chamado uma vez por frame: gasta no máximo STREAM_MS montando. O laço de
   render é o mesmo que desenha, então estourar esse orçamento aparece como
   engasgo direto na tela — por isso é tempo medido, não contagem fixa. */
function streamPump() {
  if (!streaming.pending) return;
  const n = streaming.pump();
  if (n) { rebuildOverlay(); sujaSombra(); }   // quarteirão novo entrou: ele projeta sombra
  if (!streaming.pending) {
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
  if(exteriors)exteriors.reset();
  if (urban) urban.clear();
  for (const g of [gBuild, gLines, gRoad, gRest])
    for (const o of g.children.slice()) {
      if (o.geometry) o.geometry.dispose();
      if (o.material) o.material.dispose();
      g.remove(o);
    }
  streetLabels.clear();
  risers.length = 0;
  vegetation.invalidate(true);
  built = 0; blocks = 0;
  uHeight.value = parseFloat($("hs").value);
  if (urban) urban.transform(reliefAmount,uHeight.value);
  // As malhas dos estabelecimentos (halo/feixe) nao pertencem a nenhum quadrante da
  // cidade e ficam na cena entre um carregamento e outro — se saissem do registro de
  // relevo aqui, parariam de acompanhar o terreno depois do primeiro loadCity().
  terrain.retain(g => g.userData.poi || g.userData.ground);
  // v4: sem isso, um segundo loadCity() deixaria gLive apontando pra malhas ja
  // descartadas e o streaming nunca remontaria essas quadras.
  for (const k of [...gLive.keys()]) gLive.delete(k);
  streaming.reset();
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
  if (!grp.length) throw new Error("city.json sem bl[] — rode build_city_v4.py");

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
  roadSafety = RoadClearance.create(R,w=>ROAD_W[HW[w.k]]||6,.15);
  buildingPlacement.clear();
  // Walls depend on the complete street index too, not just the visible blocks.
  if(window.__gMuros){
    const old=window.__gMuros;
    old.removeFromParent();
    terrain.unregister(old.geometry);
    old.geometry.dispose();old.material.dispose();
  }
  buildMuros();
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
  streaming.start();
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
  listingSheet.preencheAnuncio(house);
  hsheet.classList.add("on");
  hsheet.classList.remove("min");
  usheet.classList.remove("on");
  closePoiSheet();
  houseBeacon.position.set(hx, 0, hz);
  houseBeacon.visible = true;
  flyTo(hx, hz, 190);
}
$("hModel").addEventListener("click", () => { if (HOUSE_ATUAL) ListingModels.open(HOUSE_ATUAL.h.id); });
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
  const el = document.createElement("button");
  el.type = "button";
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
const dedos = new Map();
let gestoDuplo = false;
function medidaDedos() {
  const [a, b] = [...dedos.values()];
  return { d:Math.hypot(b.x-a.x, b.y-a.y), a:Math.atan2(b.y-a.y, b.x-a.x) };
}
let toqueAnterior = null;

canvas.addEventListener("pointerdown", e => {
  if (e.pointerType === "touch") {
    dedos.set(e.pointerId, {x:e.clientX, y:e.clientY});
    if (dedos.size > 1) {
      gestoDuplo = true; moveu = 1; drag = 0;
      toqueAnterior = medidaDedos();
      soltaSeta(e);
      canvas.setPointerCapture(e.pointerId);
      return;
    }
    gestoDuplo = false;
  }
  drag = (e.button === 2 || e.button === 1 || e.shiftKey) ? ORBIT : PAN;
  lx = e.clientX; ly = e.clientY;
  dnX = e.clientX; dnY = e.clientY; moveu = 0;
  canvas.setPointerCapture(e.pointerId);
  canvas.style.cursor = drag === PAN ? "grabbing" : "move";
});
function endDrag(e) {
  if (e && e.pointerType === "touch") {
    dedos.delete(e.pointerId);
    toqueAnterior = null;
    if (gestoDuplo || e.type === "pointercancel") moveu = 1;
  }
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
  if (e.pointerType === "touch" && dedos.has(e.pointerId)) {
    dedos.set(e.pointerId, {x:e.clientX, y:e.clientY});
    if (dedos.size > 1) {
      const atual = medidaDedos();
      if (toqueAnterior && atual.d > 0 && !(INT.on && !INT.orbita)) {
        sph.radius = Math.max(INT.orbita ? 5 : 60, Math.min(zoomMax(), sph.radius*toqueAnterior.d/atual.d));
        let da = atual.a - toqueAnterior.a;
        if (da > Math.PI) da -= 2*Math.PI; else if (da < -Math.PI) da += 2*Math.PI;
        sph.theta += da;
      }
      toqueAnterior = atual; moveu = 1; drag = 0;
      return;
    }
    if (gestoDuplo) return;
  }
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

// Pointer Events são a única fonte dos gestos: não duplicar com touchmove.
canvas.addEventListener("lostpointercapture", e => {
  if (dedos.has(e.pointerId)) { moveu = 1; endDrag(e); }
});

$("hs").addEventListener("input", e => {
  const v = parseFloat(e.target.value);
  $("hv").textContent = v.toFixed(2).replace(".", ",") + "×";
  uHeight.value = v;
  if (urban) urban.transform(reliefAmount,v);
});
const toggle = (id, fn) => { const b = $(id);
  b.addEventListener("click", () => { const on = b.getAttribute("aria-pressed") !== "true";
    b.setAttribute("aria-pressed", String(on)); fn(on); }); };
let showLab = true;

toggle("tLab", on => { showLab = on; sujaRotulos(); if (!on) streetLabels.hide(); });
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
  if (urban) urban.transform(reliefAmount,uHeight.value,urbanBase);
  terrain.recompute();
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
    const raw = guarda.le(ELEV_CACHE_KEY);
    if (!raw) return null;
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr) || arr.length !== ELEV_N*ELEV_N) return null;
    return Float32Array.from(arr);
  } catch (e) { return null; }
}
function saveElevCache(grid) {
  try { guarda.grava(ELEV_CACHE_KEY, JSON.stringify(Array.from(grid))); }
  catch (e) { /* localStorage cheio/indisponível — segue sem cache */ }
}
let elevLoading = false;
toggle("tRelief", async on => {
  if (on && !terrain.grid && !elevLoading) {
    elevLoading = true;
    const btn = $("tRelief");
    btn.disabled = true;
    try {
      const cached = loadElevCache();
      if (cached) {
        terrain.grid = cached;
      } else {
        terrain.grid = await fetchElevation((b, total) => { btn.textContent = `Relevo ${b+1}/${total}`; });
        saveElevCache(terrain.grid);
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
  if (urban) urban.transform(reliefAmount,uHeight.value,urbanBase);
  for (const geo of terrain.geometries()) applyTerrainToGeo(geo, reliefAmount, true);
  recalcDyRotulos();
  recalcDyPois(); sujaPois();
  vegetation.invalidate(true);   // arvore, portao e sombra levam o relevo na
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

const {group:gPoi, layer:poiLayer} = PoiLayer.create({THREE, pois:POIS, cat:CAT, terrainY,
  registerTerrain, document, haloRadius:POI_HALO, beamTop:POI_Y});
scene.add(gPoi);

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

const PERTO = { on: false, volta: null };
// ctx: { x, z, nome, volta } -- `volta` e o que reabre a ficha de onde se veio.
function abrePerto(ctx) {
  PERTO.on = true; PERTO.volta = ctx.volta || null;
  document.body.classList.add("perto");
  const n = PoiLayer.contaPerto(POIS, ctx.x, ctx.z, PERTO_R);
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
  if (sim) { usheet.scrollTop = 0; hsheet.scrollTop = 0; }
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

// Pecas parametricas: ver interior/furniture-param.js. Criado ANTES do catalogo, que
// referencia os `*Param`; biblioteca e cor chegam tarde, por funcao.
const {geoDeParts, armarioParam, bancadaParam, aereoParam, ripadoParam, rackParam, tvParam, boxParam, maquinaParam, sofaParam} =
  FurnitureParam.create({THREE, getLib: () => MOVEIS_LIB, rgbDe: hex => rgbDe(hex)});

// Catalogo, biblioteca do Blender e montagem de cada peca: ver interior/furniture-catalog.js.
// Material e cor chegam por funcao porque sao definidos mais abaixo.
const {MOVEIS, MOVEL_KEYS, MOVEIS_LIB, geoDoMovel} = FurnitureCatalog.create({THREE, document,
  rgbDe: hex => rgbDe(hex), geoDeParts, getMaterial: () => matInt,
  armarioParam, bancadaParam, aereoParam, ripadoParam, rackParam, tvParam, boxParam, maquinaParam, sofaParam});

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

const interiorTextures = InteriorTextures.create({THREE, document});

const {matInt, matVidro, matEsq, matAlum, matParede, matFrio, matMadeira} =
  InteriorMaterials.create({THREE, ambientePBR,
    ...interiorTextures});

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

const listingIdentity = ListingIdentity.create({units:UNIDADES, getGroups:()=>gGroups,
  slug:CIDADE.slug, storage:guarda, px, pz, recDoLancamento, recsDoLancamento,
  forcedPlan:new URLSearchParams(location.search).get("planta")});
const {idDoRegistro, unidadeDoPredio, chaveAncora, predioDeId,
  predioMaisPerto, loteDaUnidade, predioDaUnidade} = listingIdentity;

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
const listingSheet = ListingSheet.create({$, esc, brl, cidade:CIDADE, sheet:usheet,
  listingModels:ListingModels});

function abreFichaDoImovel(u, rec, confirmado, x, z) {
  FICHA = { u, rec, x, z };
  listingSheet.preenche(u, confirmado);
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
  const el = document.createElement("button");
  el.type = "button";
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

/* ---- geometria fixa da casa (piso + divisórias) ----------------------- */
// Prisma de parede e quad de segmento: ver interior/shell-geometry.js.
const {prismaQuad, quadDoSeg} = ShellGeometry;
// Esquadrias (batente, folha, caixilho): ver interior/openings.js. A planta abaixo le as
// medidas da folha e do marco que nascem la.
const {ESQ_ANG, ESQ_MARCO, geoDasEsquadrias} = Openings.create({THREE, ESP, rgbDe, matEsq, matAlum, matVidro});

// Planta: parede pela grade, vaos e lado da folha -- ver interior/floor-plan.js. Criado
// aqui, depois das medidas da esquadria que ele le.
const {decideVao, plantaDaUnidade, dentroDaPlanta} = FloorPlan.create({inside, shoelace, ESP, ESQ_ANG, ESQ_MARCO,
  safeInset, obbOf, BUILDING_INSET, PD, anelDoLote, MOVEIS});

// Bake de luz do interior: ver interior/bake.js.
const {BAKE, cenaDoBake, bakeRaio, bakePrepara, bakePasso, bakeAgora} = LightBake.create({inside, PD});

// Malha da casa (parede, rodape, piso, forro e esquadrias): ver interior/house-mesh.js.
const {geoDaCasa} = HouseMesh.create({THREE, ESP, rgbAcabamento, triangulateRing, prismaQuad, quadDoSeg, cursorDeLuz, texturaDeLuz, _LUZUE, BAKE, bakePrepara, matParede, matFrio, matMadeira, geoDasEsquadrias});

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
  // Escolher OUTRO movel encerra o gesto do anterior -- senao o fantasma do sofa
  // fica na sala enquanto se mexe na cama. Reposicionar o MESMO movel (o que o
  // arrasto faz a cada pixel) chega aqui com o mesmo indice e nao cancela nada.
  if (i !== INT.sel && typeof MOB !== "undefined" && MOB.modo) {
    MOB.modo = null; MOB.origem = null; tiraFantasma();
    selBox.material.color.setHex(MOB_VERDE);
  }
  INT.sel = i;
  const m = INT.moveis[i];
  selBox.visible = !!m;
  if (m) {
    const p = INT.pl.W(m.u, m.v);
    selBox.position.set(p[0], INT.baseY + 0.03, p[1]);
    selBox.rotation.y = m.obj.rotation.y;
    selBox.scale.set(m.w, Math.max(0.12, m.h), m.d);
  }
  // O gizmo e os campos de medida seguem a selecao: sem isto a seta fica na
  // posicao do movel ANTERIOR e puxa o objeto errado.
  poeSetas(); pintaMedidas();
  pintaEditor();
}

/* ---- entrar e sair ----------------------------------------------------- */
const _m4 = new THREE.Matrix4(), _up = new THREE.Vector3(0,1,0);
function quatOlhando(de, para) {
  _m4.lookAt(de, para, _up);
  return new THREE.Quaternion().setFromRotationMatrix(_m4);
}
// Colisao, folga, linha de visao e ponto de entrada: ver interior/navigation.js.
const {livre, pontoDeEntrada, melhorDirecao} = InteriorNavigation.create({INT, dentroDaPlanta, paraUV, MOVEIS, ESP, RAIO, OLHO});
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

// Luz de dentro, lampadas e interruptores: ver interior/lights.js.
const {acendeInterior, apagaInterior, LAMP, distribuiLuzes, sujaLuzes, alternaLuz, luzDoHit} =
  InteriorLights.create({THREE, INT, scene, sun, hemi, renderer, camera, NIVEL, LUZ_PI, FILL, cursorDeLuz, CEU_LINHA, inside, ESP});

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
  document.body.classList.add("dentro");
  ipanel.classList.toggle("min", TOQUE);   // no celular abre recolhido: a tela e a vista
  // v16-moveis: toda visita comeca SEM o modo. O painel de mobilia em cima da
  // chegada era exatamente o que o v12 tirou da tela; o que voltou foi o botao.
  modoMoveis(false);
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
  modoMoveis(false);
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
  modoMoveis(false); housesBox.style.display = "";
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
    ? (TOQUE ? "Arraste para mover a vista · dois dedos aproximam e giram · toque para escolher" : "Arrastar gira · roda aproxima · clicar escolhe e move")
    : (TOQUE ? "Use o controle circular para andar · arraste a vista para olhar" : "W A S D anda · arrastar olha · clicar escolhe · R gira");
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

addEventListener("keydown", e => {
  if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
  const k = e.key.toLowerCase();
  // Antes do corte por INT.on: o medidor serve dentro e fora da casa, e é justamente
  // fora (cidade inteira na tela) que o número interessa.
  if (k === "p") { mostraPerf(!perfOn); return; }
  if (INT.on && k === "escape") {
    // Tres degraus, do mais local pro mais global. Sem eles o Esc de "desisti de
    // mover" jogava a pessoa pra fora da casa inteira.
    if (MOB.modo) { cancelaGesto(); return; }
    if (MOB.on) { modoMoveis(false); return; }
    exitInterior(); return;
  }
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

// Passo em primeira pessoa e manche do celular: ver interior/first-person.js.
const {fpPasso, mostraJoy} = FirstPerson.create({FP, teclas, livre, joy: $("joy"), TOQUE});

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
  if (hit.object.userData.urbanPool) return urban ? urban.hit(hit) : null;
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
      try { guarda.grava(chaveAncora(u.id), idDoRegistro(rec)); } catch (e2) {}
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
  // v16-moveis: fora do modo, clicar dentro da casa so acende luz. A visita e uma
  // visita -- selecionar movel sem querer era o que fazia o contorno verde piscar
  // na cara de quem so queria olhar.
  if (!MOB.on) return;
  // Em "mover", o clique CONFIRMA o destino. Ele nao pode cair no ramo de selecao
  // logo abaixo: soltar o movel em cima de outro selecionaria o outro.
  if (MOB.modo === "mover" && INT.sel >= 0) {
    if (MOB.cabe) confirmaMover();
    return;
  }
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
  } else {
    // Antes do v16 o clique no chao teletransportava o movel escolhido. Com o botao
    // "Mover" isso virou armadilha: o gesto de largar a selecao (clicar no vazio)
    // era o mesmo de mudar o movel de comodo, sem aviso e sem desfazer.
    seleciona(-1);
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
    ? (TOQUE ? "Toque no chão para posicionar: " : "Clique no chão para posicionar: ") + MOVEIS[poeTipo].nome
    : (TOQUE ? "Use o controle circular para andar · arraste para olhar · toque num móvel para escolher" : "W A S D anda · arrastar olha · clicar escolhe · R gira · clique no interruptor acende");
}
function pintaEditor() {
  const m = INT.moveis[INT.sel];
  $("icancel").hidden = !m || !MOB.modo;
  $("iEdit").hidden = !m;
  if (!m) return;
  $("iSelName").textContent = MOVEIS[m.tipo].nome;
  $("isw").value = m.w; $("ivw").textContent = m.w.toFixed(2).replace(".", ",") + " m";
  $("isd").value = m.d; $("ivd").textContent = m.d.toFixed(2).replace(".", ",") + " m";
  $("ish").value = m.h; $("ivh").textContent = m.h.toFixed(2).replace(".", ",") + " m";
  $("icor").value = "#" + m.cor.toString(16).padStart(6, "0");
  $("imover").setAttribute("aria-pressed", String(MOB.modo === "mover"));
  $("imodif").setAttribute("aria-pressed", String(MOB.modo === "medir"));
  $("iDica").textContent =
    MOB.modo === "mover" ? (TOQUE ? "Toque no destino para mover · vermelho indica que não cabe · Cancelar ajuste desfaz" : "Mova o ponteiro e clique pra soltar · vermelho = nao cabe · Esc desiste")
    : MOB.modo === "medir" ? (TOQUE ? "Arraste uma seta ou digite a medida" : "Puxe uma seta ou digite a medida · cresce so pro lado puxado · Shift solta a grade")
    : (TOQUE ? "Use Mover, Modificar, Rotacionar ou Excluir para ajustar o móvel" : "Clique num movel pra escolher · R gira · Del apaga");
  pintaMedidas();
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
$("ix").addEventListener("click", () => modoMoveis(false));
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
/* ============================================================
   MODO MOVEIS (v16-moveis): grade, gizmo de setas e fantasma
   ============================================================
   O editor de mobilia ja existia inteiro desde o v11 -- catalogo, clique pra por,
   clique pra escolher, medida, cor, girar, excluir e `localStorage`. O v12 tirou o
   PAINEL da tela e os ids viraram orfaos (ver SUMIDOS, no topo). O que este bloco
   acrescenta e so o que faltava pra mobiliar ser um gesto e nao um formulario:

     1. um MODO -- fora dele a visita 3D e a do v12, e clicar nao seleciona nada;
     2. a GRADE, alinhada aos eixos da planta (nao aos do mundo);
     3. o GIZMO: cinco setas que crescem o movel por UM lado so, ancorando a face
        oposta, com o campo de medida embaixo de cada uma;
     4. o FANTASMA: mover deixa uma copia translucida no lugar antigo e acusa em
        vermelho quando o destino nao cabe.

   Duas coisas que NAO sao obvias e que o resto do arquivo cobra:

   - A grade tem que girar com a planta. Todo movel se posiciona em (u,v) -- o
     referencial do OBB da unidade --, e uma grade alinhada ao norte cruzaria as
     paredes na diagonal em qualquer casa que nao esteja em cima do eixo do mapa.
   - O eixo local de um movel NAO se deduz do `rot` com uma tabela de sinais. Ele
     sai medido: leva-se um ponto 1 m a frente pelo Euler do proprio objeto e
     pergunta-se ao `paraUV` onde ele caiu. Errar o sinal aqui faz a seta crescer
     pro lado contrario do que a pessoa puxou, e nao ha erro no console. */
const MOB = { on:false, modo:null, grade:null, fantasma:null,
              arrasto:null, cabe:true,
              // 10 cm: e o passo em que marcenaria conversa ("aumenta 20"), e e
              // grosso o bastante pra grade nao virar moire numa planta grande.
              passo:0.10 };
const MOB_VERDE = 0x5FC777, MOB_VERMELHO = 0xE2564E;
// Moveis na cena e layout salvo: ver interior/furniture-instances.js. Criado aqui, depois
// do MOB que ele consulta; as funcoes so rodam depois da carga.
const {salvaMoveis, leMoveis, poeNaCena, atualizaMovel, recolore} =
  FurnitureInstances.create({INT, MOVEIS, geoDoMovel, geoDeParts, guarda, CIDADE, sujaLuzes, MOB});
// Regras do editor (grade, eixo local, redimensionar por um lado, cabe aqui): ver
// interior/furniture-editor.js.
const {arred, dirUV, redimensiona, cabeAqui} = FurnitureEditor.create({THREE, INT, MOB, MOVEIS, ESP,
  dentroDaPlanta, paraUV, atualizaMovel, seleciona, salvaMoveis});

/* ---- a grade ----------------------------------------------------------- */
function fazGrade() {
  const pl = INT.pl;
  const lado = Math.ceil(Math.max(pl.ob.hu, pl.ob.hv) * 2 + 2);
  // Teto de divisoes: numa planta de 30 m a grade de 10 cm sao 600 linhas que
  // leem como cinza chapado. Passando disso ela afina pro dobro do passo.
  let div = Math.round(lado / MOB.passo);
  if (div > 200) div = Math.round(div / 2);
  const g = new THREE.GridHelper(lado, div, 0xFFFFFF, MOB_VERDE);
  g.material.transparent = true; g.material.opacity = 0.55;
  g.material.depthWrite = false;
  /* `toneMapped = false`, pelo mesmo motivo que o ceu do interior ja usa: dentro da
     casa a exposicao cai pra 0,58 e o ACES ainda comprime por cima. A grade nascia
     desenhada -- a contagem de chamadas subia de 107 pra 108 -- e mesmo assim
     invisivel no chao. Nao ha erro pra ver aqui: o pixel simplesmente empata com o
     piso. Sem tone mapping a linha sai na tela com a cor que esta escrita. */
  g.material.toneMapped = false;
  /* 2,6 cm, e o numero e apertado dos DOIS lados: o piso da casa e desenhado em
     y = 0,02 (ver `geoDaCasa`) e o movel assenta em y = 0,03. Um milimetro pra
     baixo e a grade some por z-fighting contra o proprio chao -- foi assim que
     ela nasceu, invisivel e sem erro nenhum; um centimetro pra cima e ela passa
     a flutuar por cima do tapete. */
  g.position.set(pl.ob.cx, 0.026, pl.ob.cz);
  g.rotation.y = Math.atan2(-pl.ob.uz, pl.ob.ux);
  return g;
}

/* ---- as setas ---------------------------------------------------------- */
/* Um cone por seta, e so o cone: com haste seriam dez chamadas de desenho pra
   enfeitar um gesto. O material ignora profundidade de proposito -- a seta que
   some atras do proprio armario e uma seta que nao da pra pegar. */
const MOB_EIXOS = [{ k:"w", s: 1, lx: 1, lz: 0 }, { k:"w", s:-1, lx:-1, lz:0 },
                   { k:"d", s: 1, lx: 0, lz: 1 }, { k:"d", s:-1, lx: 0, lz:-1 },
                   { k:"h", s: 1, lx: 0, lz: 0 }];
const mobSetas = (() => {
  const gr = new THREE.Group();
  const geo = new THREE.ConeGeometry(0.075, 0.26, 10);
  for (const e of MOB_EIXOS) {
    const mat = new THREE.MeshBasicMaterial({ color:MOB_VERDE, transparent:true,
                                              opacity:0.92, depthTest:false,
                                              toneMapped:false });   // ver fazGrade()
    const o = new THREE.Mesh(geo, mat);
    o.renderOrder = 6; o.userData.eixo = e;
    gr.add(o);
  }
  gr.visible = false;
  return gr;
})();
gInteriores.add(mobSetas);

function poeSetas() {
  const m = INT.moveis[INT.sel];
  mobSetas.visible = !!(m && MOB.on && MOB.modo === "medir");
  if (!mobSetas.visible) return;
  const p = INT.pl.W(m.u, m.v);
  mobSetas.position.set(p[0], INT.baseY, p[1]);
  mobSetas.rotation.y = m.obj.rotation.y;
  const alto = Math.max(0.10, m.h);
  for (const o of mobSetas.children) {
    const e = o.userData.eixo;
    if (e.k === "h") {
      o.position.set(0, alto + 0.20, 0);
      o.rotation.set(0, 0, 0);
    } else {
      const dist = (e.k === "w" ? m.w : m.d)/2 + 0.17;
      o.position.set(e.lx * dist, alto/2, e.lz * dist);
      // O cone nasce apontando pro +Y; deitar pro eixo certo e um giro de 90 graus
      // sobre Z (pro X) ou sobre X (pro Z), com o sinal fazendo a ponta virar.
      if (e.k === "w") o.rotation.set(0, 0, -e.s * Math.PI/2);
      else             o.rotation.set(e.s * Math.PI/2, 0, 0);
    }
  }
  mobSetas.updateMatrixWorld(true);
}

// Vetor de rascunho do arrasto da seta de altura (o de `dirUV` foi junto pro modulo).
const _mobV = new THREE.Vector3();
/* ---- o fantasma -------------------------------------------------------- */
const matFantasma = new THREE.MeshBasicMaterial({ color:MOB_VERDE, transparent:true,
                                                  opacity:0.22, depthWrite:false,
                                                  toneMapped:false });   // ver fazGrade()
function poeFantasma(m) {
  tiraFantasma();
  /* Montado a mao, e NAO com `m.obj.clone()`. O clone do three copia o userData
     assim: `JSON.parse(JSON.stringify(source.userData))` -- e o userData de todo
     movel guarda `movel`, que aponta de volta pro proprio objeto. Clonar estourava
     em "Converting circular structure to JSON", ou seja: o botao Mover quebrava.

     A geometria e COMPARTILHADA de proposito (e so uma vista translucida da mesma
     malha), e por isso `tiraFantasma` remove da cena sem chamar dispose(): liberar
     aqui apagaria o movel de verdade. */
  const g = new THREE.Group();
  for (const o of m.obj.children) {
    if (!o.isMesh) continue;
    const c = new THREE.Mesh(o.geometry, matFantasma);
    c.position.copy(o.position); c.quaternion.copy(o.quaternion); c.scale.copy(o.scale);
    g.add(c);
  }
  g.position.copy(m.obj.position); g.quaternion.copy(m.obj.quaternion);
  g.scale.copy(m.obj.scale);
  MOB.fantasma = g;
  INT.raiz.add(g);
}
function tiraFantasma() {
  if (MOB.fantasma && INT.raiz) INT.raiz.remove(MOB.fantasma);
  MOB.fantasma = null;
}

/* ---- campos de medida (DOM, como os rotulos de comodo) ----------------- */
const MOB_MED = [{ k:"w", nome:"L" }, { k:"d", nome:"P" }, { k:"h", nome:"A" }];
const mobMed = MOB_MED.map(c => {
  const el = document.createElement("div");
  el.className = "med";
  el.appendChild(Object.assign(document.createElement("b"), { textContent:c.nome }));
  const inp = document.createElement("input");
  inp.type = "text"; inp.inputMode = "decimal"; inp.setAttribute("aria-label", "Medida");
  el.appendChild(inp);
  el.appendChild(Object.assign(document.createElement("b"), { textContent:"m" }));
  // Digitar a medida cresce pelo MESMO lado que a seta "+": manter a face oposta
  // parada e o unico comportamento que casa com o gesto.
  const aplica = () => {
    const m = INT.moveis[INT.sel]; if (!m) return;
    const v = parseFloat(String(inp.value).replace(",", "."));
    if (isFinite(v)) redimensiona(m, c.k, v, 1);
    pintaMedidas();
  };
  inp.addEventListener("change", aplica);
  inp.addEventListener("keydown", e => { if (e.key === "Enter") { aplica(); inp.blur(); } });
  el.style.display = "none";
  overlay.appendChild(el);
  return { c, el, inp, v:new THREE.Vector3() };
});
function pintaMedidas() {
  const m = INT.moveis[INT.sel];
  for (const q of mobMed)
    if (m && document.activeElement !== q.inp)
      q.inp.value = m[q.c.k].toFixed(2).replace(".", ",");
}
// Chamado de dentro do laco de quadro, junto dos rotulos de comodo e pelo mesmo
// motivo: sem a matriz da camera do quadro CORRENTE o campo arrasta atras da seta.
function posicionaMedidas(W2, H2) {
  const m = INT.moveis[INT.sel], liga = !!(m && mobSetas.visible);
  for (const q of mobMed) {
    if (!liga) { q.el.style.display = "none"; continue; }
    const alvo = mobSetas.children[q.c.k === "w" ? 0 : q.c.k === "d" ? 2 : 4];
    q.v.setFromMatrixPosition(alvo.matrixWorld).project(camera);
    if (q.v.z > 1 || Math.abs(q.v.x) > 1.1 || Math.abs(q.v.y) > 1.1) {
      q.el.style.display = "none"; continue;
    }
    q.el.style.display = "flex";
    q.el.style.left = ((q.v.x*0.5 + 0.5) * W2) + "px";
    q.el.style.top  = ((-q.v.y*0.5 + 0.5) * H2 + 14) + "px";
  }
}

/* ---- ligar e desligar o modo ------------------------------------------- */
function modoMoveis(on) {
  MOB.on = !!on && INT.on;
  $("imob").setAttribute("aria-pressed", String(MOB.on));
  ipanel.classList.toggle("on", MOB.on);
  if (MOB.on) {
    if (!MOB.grade && INT.raiz) { MOB.grade = fazGrade(); INT.raiz.add(MOB.grade); }
    pintaCatalogo(); pintaEditor();
  } else {
    if (MOB.grade) {
      if (INT.raiz) INT.raiz.remove(MOB.grade);
      MOB.grade.geometry.dispose();
      MOB.grade = null;
    }
    poeTipo = null; MOB.modo = null; MOB.arrasto = null;
    tiraFantasma(); seleciona(-1);
  }
  poeSetas();
}
function modo(qual) {
  const m = INT.moveis[INT.sel];
  if (MOB.modo === "mover" && qual !== "mover") cancelaGesto();
  MOB.modo = (MOB.modo === qual || !m) ? null : qual;
  tiraFantasma();
  if (MOB.modo === "mover" && m) { MOB.origem = { u:m.u, v:m.v }; poeFantasma(m); }
  selBox.material.color.setHex(MOB_VERDE);
  poeSetas(); pintaEditor();
}
/* Cancelar um "mover" tem que DEVOLVER o movel: o fantasma marca de onde ele saiu,
   e desistir deixando-o onde o cursor parou seria mover sem querer. */
function cancelaGesto() {
  const m = INT.moveis[INT.sel];
  if (MOB.modo === "mover" && m && MOB.origem) {
    m.u = MOB.origem.u; m.v = MOB.origem.v;
    atualizaMovel(m); salvaMoveis();
  }
  MOB.modo = null; MOB.origem = null; tiraFantasma();
  selBox.material.color.setHex(MOB_VERDE);
  seleciona(INT.sel); pintaEditor();
}
function confirmaMover() {
  MOB.modo = null; MOB.origem = null; tiraFantasma();
  selBox.material.color.setHex(MOB_VERDE);
  seleciona(INT.sel); pintaEditor(); salvaMoveis();
}

/* ---- arrastar a seta --------------------------------------------------- */
const _mobPlano = new THREE.Plane(), _mobPto = new THREE.Vector3();
// Onde o ponteiro cruza um plano horizontal, em coordenadas do mundo.
function pontoNoChao(e, y) {
  _ndc.set(e.clientX/innerWidth*2 - 1, -(e.clientY/innerHeight*2 - 1));
  rcaster.setFromCamera(_ndc, camera);
  const dir = rcaster.ray.direction, org = rcaster.ray.origin;
  if (Math.abs(dir.y) < 1e-4) return null;
  const t = (y - org.y) / dir.y;
  if (t <= 0) return null;
  return [org.x + dir.x*t, org.z + dir.z*t];
}
// A seta de ALTURA nao tem plano horizontal pra cruzar: usa-se um plano vertical
// virado pra camera, passando pelo movel. Sem isso a seta de cima nao anda.
function alturaNoPonteiro(e, cx, cz) {
  _ndc.set(e.clientX/innerWidth*2 - 1, -(e.clientY/innerHeight*2 - 1));
  rcaster.setFromCamera(_ndc, camera);
  camera.getWorldDirection(_mobV);
  _mobV.y = 0;
  if (_mobV.lengthSq() < 1e-6) return null;
  _mobPlano.setFromNormalAndCoplanarPoint(_mobV.normalize(),
                                          _mobPto.set(cx, INT.baseY, cz));
  return rcaster.ray.intersectPlane(_mobPlano, _mobPto) ? _mobPto.y - INT.baseY : null;
}
// Deslocamento do ponteiro ao longo do eixo que se puxa, em metros, medido do
// CENTRO do movel. A conta do arrasto compara este numero com o do pointerdown.
function tNoEixo(e, m, eixo) {
  if (eixo.k === "h") {
    const p = INT.pl.W(m.u, m.v);
    return alturaNoPonteiro(e, p[0], p[1]);
  }
  const q = pontoNoChao(e, INT.baseY + Math.max(0.10, m.h)/2);
  if (!q) return null;
  const uv = paraUV(q[0], q[1]);
  const d = dirUV(m, eixo.k === "w" ? eixo.s : 0, eixo.k === "d" ? eixo.s : 0);
  return (uv[0] - m.u)*d[0] + (uv[1] - m.v)*d[1];
}
function pegaSeta(e) {
  if (!mobSetas.visible) return null;
  _ndc.set(e.clientX/innerWidth*2 - 1, -(e.clientY/innerHeight*2 - 1));
  rcaster.setFromCamera(_ndc, camera);
  const h = rcaster.intersectObjects(mobSetas.children, false)[0];
  return h ? h.object.userData.eixo : null;
}

canvas.addEventListener("pointerdown", e => {
  if (!MOB.on || !INT.on || e.button !== 0) return;
  if (dedos.size > 1 || gestoDuplo && e.pointerType === "touch") return;
  const eixo = pegaSeta(e);
  if (!eixo) return;
  const m = INT.moveis[INT.sel];
  const t0 = tNoEixo(e, m, eixo);
  if (t0 == null) return;
  MOB.arrasto = { eixo, t0, base:m[eixo.k] };
  for (const q of mobMed) q.el.classList.add("arrasta");
  // A camera nao pode reagir ao mesmo gesto: `drag` e `moveu` sao do laco de
  // ponteiro la de cima, e sem zerar um e marcar o outro a casa gira junto e o
  // soltar ainda dispara um clique de selecao por cima.
  drag = 0; moveu = 1;
  canvas.setPointerCapture(e.pointerId);
});

canvas.addEventListener("pointermove", e => {
  if (!MOB.on || !INT.on) return;
  if (dedos.size > 1 || gestoDuplo && e.pointerType === "touch") return;
  const m = INT.moveis[INT.sel];
  if (MOB.arrasto && m) {
    const a = MOB.arrasto;
    const t = tNoEixo(e, m, a.eixo);
    if (t == null) return;
    const bruto = a.base + (t - a.t0);
    const alvo = e.shiftKey ? bruto : arred(bruto);
    if (Math.abs(alvo - m[a.eixo.k]) > 1e-4)
      redimensiona(m, a.eixo.k, alvo, a.eixo.k === "h" ? 1 : a.eixo.s);
    return;
  }
  if (MOB.modo === "mover" && m) {
    const q = pontoNoChao(e, INT.baseY + 0.03);
    if (!q) return;
    const uv = paraUV(q[0], q[1]);
    m.u = e.shiftKey ? uv[0] : arred(uv[0]);
    m.v = e.shiftKey ? uv[1] : arred(uv[1]);
    MOB.cabe = cabeAqui(m, m.u, m.v);
    atualizaMovel(m); seleciona(INT.sel);
    selBox.material.color.setHex(MOB.cabe ? MOB_VERDE : MOB_VERMELHO);
  }
});

function soltaSeta(e) {
  if (!MOB.arrasto) return;
  MOB.arrasto = null;
  for (const q of mobMed) q.el.classList.remove("arrasta");
  if (e && e.pointerId != null && canvas.hasPointerCapture(e.pointerId))
    canvas.releasePointerCapture(e.pointerId);
  salvaMoveis(); pintaMedidas();
}
canvas.addEventListener("pointerup", soltaSeta);
canvas.addEventListener("pointercancel", soltaSeta);

/* ---- os botoes do painel ----------------------------------------------- */
$("imob").addEventListener("click", () => modoMoveis(!MOB.on));
$("imover").addEventListener("click", () => modo("mover"));
$("imodif").addEventListener("click", () => modo("medir"));
$("icancel").addEventListener("click", cancelaGesto);

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
window.__int = { INT, FP, CORTE, camera, scene, gInteriores, MOVEIS, sph, target, exteriors,
                 urban, registroDoHit,
                 roadClearance: {hit:ring=>roadSafety?.hit(ring), blocked:buildingOverRoad,
                   stats:()=>({rejected:[...gLive.values()].reduce((n,r)=>n+(r.roadRejected||0),0)})},
                 renderer, sun, hemi,
                 enterInterior, exitInterior, plantaDaUnidade, UNIDADES, uFuro,
                 livre, decideVao,
                 // v13: a vitrine para na ficha, e o "por perto" e o unico caminho
                 // normal ate os pinos. Sem estes tres nenhuma sonda alcanca o fluxo.
                 abreUnidade, abrePerto, fechaPerto, setPins, PERTO,
                 alternaLuz, LAMP,
                 // v16-moveis: sem estes o portao nao alcanca o gesto. O que mais
                 // importa e `redimensiona` -- o sinal do eixo local nao produz erro
                 // no console quando esta trocado, so um armario que cresce pro lado
                 // errado, e so a sonda pega isso.
                 MOB, modoMoveis, modo, redimensiona, cabeAqui, dirUV,
                 cancelaGesto, confirmaMover, mobSetas, mobMed, seleciona,
                 atualizaMovel, poeNaCena, cliqueInterior, vista, CORTE,
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
  fila: () => streaming.pending, sujaSombra, setStreamRadius, raio: () => STREAM_R,
  bombeia(max) { let k = 0; while (streaming.pending && k < max) { streamPump(); k++; } return streaming.pending; },
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
  confereArvores: vegetation.confereArvores,
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
    if (INT.on) terrainYCached(target.x, target.z);
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
  posicionaMedidas(W2, H2);
}

const tmp = new THREE.Vector3();
let looping = false;
// CSS fixes the display to the viewport; DPR changes only the drawing buffer.
// Track both window size and DPR so automatic quality changes keep them in sync.
let _lastW = 0, _lastH = 0, _lastDpr = 0;
function resize() {
  const w = innerWidth, h = innerHeight, dpr = renderer.getPixelRatio();
  if (w === _lastW && h === _lastH && dpr === _lastDpr &&
      canvas.width === Math.floor(w*dpr) && canvas.height === Math.floor(h*dpr)) return;
  _lastW = w; _lastH = h; _lastDpr = dpr;
  renderer.setSize(w, h, false); camera.aspect = w/h;
    // Girar o telefone muda a proporcao: o campo horizontal so fica constante se o
    // vertical for recalculado aqui.
    if (typeof INT !== "undefined" && INT.on) camera.fov = fovInterior(INT.orbita);
  camera.updateProjectionMatrix();
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
  if (streaming.pending || INT.voo) return;
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
  $("pfQt").textContent  = gLive.size + (streaming.pending ? " +" + streaming.pending : "");
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

const {semAcento, BUSCA, indexaBusca, buscaAgora} = CitySearch.create({pois:POIS, cls:CLS, target});

const bq = $("bq"), bres = $("bres");
MobileTabs.create({$, perto:PERTO, fechaTudo: () => {
  fechaPerto(false);
  $("usheet").classList.remove("on"); $("hsheet").classList.remove("on");
  closePoiSheet(); houseBeacon.visible = false;
}});
bq.addEventListener("focus", () => document.body.classList.add("buscando"));
bq.addEventListener("blur", () => document.body.classList.remove("buscando"));
let bSel = -1, bLista = [];

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
  if (INT.on) saiSeco();
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
bres.addEventListener("click", e => {
  const el = e.target.closest(".bi"); if (!el) return;
  e.preventDefault(); vaiPara(bLista[+el.dataset.i]);
});
addEventListener("pointerdown", e => {
  if (!bres.hidden && !e.target.closest("#hud .busca")) bres.hidden = true;
}, true);

// Link de posicao na URL: ver ui/position-link.js. `_linkT` fica aqui porque e o laco
// de quadro que o conta.
let _linkT = 0;

/* ---------------- minimapa ---------------- */
const {MM, MM_CEL, montaBaseMinimapa, desenhaMinimapa} = StreetMinimap.create({canvas:$("mmc"),
  target, sph, camera, cat:CAT, catKeys:CAT_KEYS, poiPorCat:POI_POR_CAT, catOn,
  isPoiHidden:() => poiHidden, bigRoad:BIGROAD, hw:HW});

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
const {escreveLink, lerLink} = PositionLink.create({CENTER, MLAT, MLON, px, pz, target, sph, NOITE, INT,
  setNoite, streamUpdate});
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

  streetLabels.update({camera, W, H, reliefAmount, interior: INT.on, showLab});
  // v10: as arvores sao InstancedMesh por especie, refeitas quando o conjunto vivo
  // muda OU quando o alvo anda o bastante pra mudar quem esta dentro dos 1800 m.
  if (vegetation.trackTarget()) somSujo = true;
  if (vegetation.dirty) { vegetation.refresh(); refazPortoes(); sujaSombra(); }
  if (somSujo) { refazSombras(); sujaSombra(); }
  updatePois();
  streamUpdate(false);   // alvo mudou? recalcula o conjunto vivo
  streamPump();          // gasta ate STREAM_MS montando o que falta
  if (urban) urban.flush();
  if(exteriors)exteriors.update(target.x,target.z,sph.radius,reliefAmount,INT.on,performance.now());

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

window.__qa = MapDiagnostics.create({
  terrainY, scene, renderer, camera, target, sph,
  getArborizacao: () => ARV,
  monta(n = 60) {
    streamUpdate(true);
    while (streaming.pending && n-- > 0) streaming.buildNext();
  }
});
boot();
})();

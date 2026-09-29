
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
/* A escada das tres etapas (listings/stage.js) so pode ser criada depois que a casa,
   o editor e a luz existem -- ver a criacao mais abaixo. Os modulos montados ANTES dela
   (gestos, ficha, editor, entrada) recebem acessores, nao valores: na hora em que eles
   sao montados esta caixa ainda esta vazia, e na hora em que eles USAM ja esta cheia. */
let etapas = null;
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
  ireset:"button", isair:"button", iPredioRow:"div", ipredio:"button", iDica:"div",
  // A escada das tres etapas e o corte de parede da planta. Estao no corpo.html, mas
  // entram aqui pela mesma razao dos de cima: uma pagina montada de um corpo ANTIGO
  // continua abrindo, so sem os botoes -- nao com um TypeError no boot.
  etapas:"nav", eMapa:"button", eInterior:"button", ePlanta:"button",
  uEtapas:"div", uE1:"button", uPlanta:"button", uGira:"button", iparedes:"button",
  // O painel da maquete. Orfao ele nao desenha nada (`rectDoPainel` devolve null sem
  // `offsetParent`), e a pagina continua abrindo -- que e o contrato do SUMIDOS.
  maquete:"div", maqDica:"div" };
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
const URL_PARAMS = new URLSearchParams(location.search);
const RUNTIME_V2 = URL_PARAMS.get("runtime") === "v2";
const RUNTIME_V2_INDEX = URL_PARAMS.get("cityIndex");

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
// Sombra PROJETADA na cidade (predio, muro, portao e arvore lancando sombra no chao) e
// o sol baixo que a torna visivel: ver scene/city-shadow.js. Nasce DESLIGADA -- e
// promocao por cidade, com medida, e nao efeito de remontagem.
const AP_SOMBRA = !!APAR.sombra_projetada;
// Especular POR FRAGMENTO: o expoente do lobo deixa de ser um numero pra fachada
// inteira (56, calibrado pro vidro) e passa a ser 8 na pintura, 16 no telhado e 56 no
// vidro; junto vem o asfalto (26) e a folha (24). Portado do v15. Nasce DESLIGADA.
const AP_ESPEC = !!APAR.especular_fragmento;

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
const {shoelace, inside, safeInset, obbOf} = MapGeometry;
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
const SOL_OFF = { x: -520, z: 640,
                  y: AP_SOMBRA ? CityShadow.ALTURA_COM : CityShadow.ALTURA_SEM };
const sun = new THREE.DirectionalLight(0xFFF4E0, (AP_LUZ ? 1.16 : 0.95) * LUZ_PI);
sun.castShadow = true; sun.shadow.mapSize.set(NIVEL.somMap, NIVEL.somMap);
const cityShadow = CityShadow.create({sun, sph, sujaSombra, projeta:AP_SOMBRA});
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

const {facadeMaterial, riseLine} = FacadeMaterials.create({ AP_ESPEC,
  THREE, AP_LUZ, AP_JANELA, TEX_CIDADE, GLSL_RUIDO,
  uRelief, uHeight, uFuro, uNoite
});
const surfaceMaterials = SurfaceMaterials.create({THREE, K, TEX_CIDADE, GLSL_RUIDO,
  AP_LUZ, AP_ESPEC});
const flat = c => new THREE.MeshPhongMaterial({ color:c, shininess:0, specular:0x000000, polygonOffset:true, polygonOffsetFactor:-1, polygonOffsetUnits:-1 });
// v6: chao que acompanha o relevo (quadras). Ver pipeline/chao.py.
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
  const walls = WorldWalls.build(data, {THREE, roadSafety, terrainY, hash, projeta:AP_SOMBRA,
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

const {tipoDe, BUILDING_INSET} = BuildingType;

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
if (!RUNTIME_V2 && new URLSearchParams(location.search).get("casas") !== "procedural") {
  try {
    urban = UrbanModels.create(THREE, JSON.parse($("__urbanModels").textContent), gBuild,
                              {cut:uFuro, shadows:SOMBRA_CIDADE,terrain:urbanBase});
  } catch (e) { console.warn("Biblioteca urbana indisponivel; usando volumes atuais.", e); }
}
// Runtime V2 receives its lightweight city-house kit from the server spatial
// package during loadCityV2(); the heavyweight V1 pack stays V1-only.
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

const {matVia} = RoadMaterials.create({THREE, AP_RUA, K, GLSL_RUIDO, AP_LUZ, AP_ESPEC});

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

const vegetation = VegetationScene.create({THREE, ARV, terrainY, projeta:AP_SOMBRA,
  AP_LUZ, AP_ESPEC,
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
const gates = Gates.create({THREE, data:gatesData, target, terrainY, projeta:AP_SOMBRA,
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
    bm.castShadow = AP_SOMBRA && SOMBRA_CIDADE;
    bm.receiveShadow = SOMBRA_CIDADE; add(bm, gBuild);
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
let v2Index = null, v2Loader = null, v2Bridge = null, v2Controller = null;

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

function disposeGroupRec(rec) {
  if (!rec) return;
  if (urban) for (const slot of rec.urban || []) urban.remove(slot);
  for (const o of rec.objs || []) {
    if (o.parent) o.parent.remove(o);
    if (o.geometry) {
      terrain.unregister(o.geometry);
      o.geometry.dispose();
    }
    if (o.material) o.material.dispose();
  }
  // risers guarda o uniform da animação de subida por malha montada; sem tirar
  // daqui, a lista cresce sem limite conforme o usuário anda pela cidade.
  for (const u of rec.risers || []) {
    const k = risers.findIndex(r => r.u === u);
    if (k >= 0) risers.splice(k, 1);
  }
  if (rec.plants) vegetation.invalidate();
  if (rec.sombras) somSujo = true;
}
function dropGroup(i) {
  const rec = gLive.get(i);
  if (!rec) return;
  disposeGroupRec(rec);
  // seenStreets nao e limpo aqui: o rebuildOverlay() zera e refaz o conjunto
  // inteiro logo em seguida, e limpar aqui so criaria dois donos pro mesmo estado.
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

function streamUpdate(force) {
  // No V2, ruas/areas verdes continuam usando o streaming espacial comprovado do V1
  // enquanto a aparencia dos predios vem dos chunks direcionais.
  streaming.update(force);
  if (v2Controller) v2Controller.update(!!force);
}

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
  // V2 pode ter requisicoes em voo. Cancela a geracao logica antes de limpar a cena,
  // para uma resposta atrasada nao remontar um chunk depois do reset.
  if (v2Controller) v2Controller.reset();
  v2Index = v2Loader = v2Bridge = v2Controller = null;
  if (window.__runtimeV2) window.__runtimeV2 = null;
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
const v2JsonSession = new Map();
async function fetchJsonV2(url) {
  const absolute = new URL(url, location.href).href;
  if (v2JsonSession.has(absolute)) return v2JsonSession.get(absolute);
  const p = (async () => {
    const r = await fetch(absolute, { cache:"default" });
    if (!r.ok) throw new Error("HTTP " + r.status + " em " + absolute);
    return r.json();
  })();
  v2JsonSession.set(absolute,p);
  try { return await p; }
  catch (e) { v2JsonSession.delete(absolute); throw e; }
}
function v2Absolute(base, rel) { return new URL(rel, base).href; }

let v2PrewarmLast = null;
async function prewarmCityV2At(x,z) {
  if (!RUNTIME_V2_INDEX || !Number.isFinite(x) || !Number.isFinite(z)) return null;
  const absoluteIndex = new URL(RUNTIME_V2_INDEX, location.href).href;
  const rawIndex = await fetchJsonV2(absoluteIndex);
  if (!Array.isArray(rawIndex.chunks)) return null;

  const base = [
    fetchJsonV2(v2Absolute(absoluteIndex, rawIndex.context?.url || "context.json"))
  ];
  if (rawIndex.urbanKit?.url)
    base.push(fetchJsonV2(v2Absolute(absoluteIndex, rawIndex.urbanKit.url)));

  const ranked = rawIndex.chunks.map(ch => ({
    ch,
    d: Math.max(0, Math.hypot((ch.cx||0)-x,(ch.cz||0)-z) - (ch.rad||0))
  })).sort((a,b)=>a.d-b.d);

  // First useful neighbourhood: enough mass to make the transition feel instant,
  // but intentionally much smaller than the normal 128-visible working set.
  const critical = ranked.slice(0,12);
  const warm = ranked.slice(12,32);

  await Promise.all(base.concat(critical.map(({ch}) =>
    fetchJsonV2(v2Absolute(absoluteIndex,ch.url)))));
  v2PrewarmLast = {x,z,critical:critical.length,warm:warm.length,ready:true};

  // The second ring is opportunistic. It never blocks the miniature or map transition.
  Promise.all(warm.map(({ch})=>fetchJsonV2(v2Absolute(absoluteIndex,ch.url))))
    .then(()=>{ if(v2PrewarmLast&&v2PrewarmLast.x===x&&v2PrewarmLast.z===z) v2PrewarmLast.warmReady=true; })
    .catch(()=>{});
  return v2PrewarmLast;
}

function mountV2Chunk(id, value, meta) {
  const key = "v2:" + id;
  if (gLive.has(key)) return key;
  const rec = { objs:[], risers:[], roads:[], cx:meta.cx, cz:meta.cz };
  gLive.set(key, rec);
  assembleInto(rec, value.B || [], [], [], meta.cx, meta.cz);
  sujaSombra();
  return key;
}
function unmountV2Chunk(_id, key) {
  const rec = gLive.get(key);
  if (!rec) return;
  disposeGroupRec(rec);
  gLive.delete(key);
  sujaSombra();
}

async function loadCityV2(indexUrl) {
  resetScene();
  const absoluteIndex = new URL(indexUrl, location.href).href;
  const rawIndex = await fetchJsonV2(absoluteIndex);
  if (rawIndex.format !== "city-runtime-v2" || rawIndex.version !== 2 ||
      !rawIndex.cityId || !Array.isArray(rawIndex.chunks))
    throw new Error("indice Runtime V2 invalido ou sem identidade persistente");

  const index = {
    ...rawIndex,
    chunks: rawIndex.chunks.map(ch => ({...ch, url:v2Absolute(absoluteIndex, ch.url)}))
  };
  const contextUrl = v2Absolute(absoluteIndex, rawIndex.context?.url || "context.json");
  const kitUrl = rawIndex.urbanKit?.url ? v2Absolute(absoluteIndex, rawIndex.urbanKit.url) : null;
  const [rawContext, rawUrbanKit] = await Promise.all([
    fetchJsonV2(contextUrl),
    kitUrl ? fetchJsonV2(kitUrl) : Promise.resolve(null)
  ]);
  const {R, G} = CityChunkDataV2.decodeContext(decode, rawContext);

  // V2 is intentionally online/server-first. Recreate the shared lightweight asset
  // pools from the server package; never depend on an embedded/offline urban payload.
  if (urban) { urban.dispose(); urban = null; }
  if (rawUrbanKit) {
    try {
      urban = UrbanModels.create(THREE, rawUrbanKit, gBuild,
                                {cut:uFuro, shadows:SOMBRA_CIDADE,terrain:urbanBase});
    } catch (e) {
      console.warn("Kit urbano V2 do servidor indisponivel; usando volumes procedurais.", e);
    }
  }
  const buildingCount = index.buildingCount ??
    index.chunks.reduce((n,ch) => n + (ch.buildings || 0), 0);
  GRID = buildingCount > 50000 ? 12 : 4;

  // O contexto leve continua conhecido: vias, areas verdes, busca e minimapa.
  // A massa de predios NAO entra aqui; chega somente pelos chunks selecionados.
  gGroups = groupsFrom([], R, G, []);
  indexaBusca([], R);
  montaBaseMinimapa(R);
  indexaAsfalto(R);
  roadSafety = RoadClearance.create(R,w=>ROAD_W[HW[w.k]]||6,.15);
  buildingPlacement.clear();
  if (window.__gMuros) {
    const old=window.__gMuros;
    old.removeFromParent(); terrain.unregister(old.geometry);
    old.geometry.dispose(); old.material.dispose();
  }
  buildMuros();
  buildFacingArrows([]);

  let minX=1e9,maxX=-1e9,minZ=1e9,maxZ=-1e9;
  for (const g of index.chunks) {
    minX=Math.min(minX,g.cx-g.rad); maxX=Math.max(maxX,g.cx+g.rad);
    minZ=Math.min(minZ,g.cz-g.rad); maxZ=Math.max(maxZ,g.cz+g.rad);
  }
  if (index.chunks.length)
    frame0(Math.max(4, Math.round(Math.max(maxX-minX,maxZ-minZ)/TILE_M)));
  else frame0(4);

  const ctx = buildStreetContext(R);
  if (ctx) gRoad.add(ctx);
  sph.radius = Math.min(sph.radius, 480);

  v2Loader = CityChunkLoaderV2.create({
    fetchJson: fetchJsonV2,
    decode: (raw, meta) => CityChunkDataV2.decodeChunk(decode, raw, meta, index.cityId),
    maxResident: 192,
    maxResidentBytes: 768 * 1024
  });
  v2Bridge = CitySceneBridgeV2.create({
    loader:v2Loader, mountChunk:mountV2Chunk, unmountChunk:unmountV2Chunk,
    concurrency:8
  });
  v2Index = index;
  v2Controller = CityControllerV2.create({
    index,
    select:CityRuntimeV2.select,
    bridge:v2Bridge,
    getResident:()=>v2Loader.residentIds(),
    getSample:()=>({
      x:target.x, z:target.z,
      // THREE.Spherical: camera offset = (sin(theta), cos(theta)) no plano XZ.
      // O que a camera enxerga alem do alvo e o vetor oposto.
      viewDirX:-Math.sin(sph.theta), viewDirZ:-Math.cos(sph.theta)
    }),
    getViewConfig:()=>({
      renderRadius:STREAM_R,
      prefetchRadius:STREAM_R*1.15,
      forwardExtra:Math.max(350, STREAM_R*.75),
      prefetchBias:STREAM_R*.22,
      hysteresis:STREAM_HYST,
      baseRenderFactor:.62,
      // Hard working-set budget: city size must not determine client memory/network.
      maxVisible:128,
      maxWarm:48,
      maxWantedBytes:512 * 1024
    }),
    now:()=>performance.now(),
    onError:e=>console.error("Runtime V2 streaming:",e)
  });

  window.__runtimeV2 = {
    index, loader:v2Loader, bridge:v2Bridge, controller:v2Controller,
    stats:()=>({
      cityId:index.cityId,
      chunks:index.chunks.length,
      buildings:buildingCount,
      resident:v2Loader.residentIds().size,
      residentBytes:v2Loader.residentBytes(),
      mounted:v2Bridge.mountedIds().size
    })
  };

  streaming.start();            // contexto (ruas/verde)
  streamUpdate(true);           // contexto + primeiro lote direcional de predios
  lerLink();

  phase.classList.remove("off");
  progTxt.textContent = `${index.chunks.length} chunks · Runtime V2 experimental`;
  hideStatus();
}

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
  if (RUNTIME_V2) {
    stK.textContent = "Iniciando Runtime V2";
    stM.textContent = "Carregando indice espacial";
    stI.style.width = "12%";
    try {
      if (!RUNTIME_V2_INDEX) throw new Error("use ?runtime=v2&cityIndex=<index.json>");
      await loadCityV2(RUNTIME_V2_INDEX);
      stI.style.width = "100%";
      return;
    } catch (e) {
      console.error("Falha no Runtime V2:", e);
      stK.textContent = "Runtime V2 nao iniciou";
      stM.textContent = e.message || "Erro no indice/chunks";
      stI.style.width = "100%";
      return;
    }
  }
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
   11b. Imóveis para inspeção 3D: a vitrine de demonstração. Os anúncios
   são FICTÍCIOS (sao-carlos/dados/imoveis.json, desde 26/09/2026); a
   trava é tests/test_vitrine_ficticia.py. Cada item traz lat/lon, e
   px()/pz() (já definidos no topo do arquivo) convertem pro mesmo
   sistema de coordenadas do city.json, sem dado extra.
   ============================================================ */
// A VITRINE VEM DE FORA. Estes anuncios eram 6 imoveis de Sao Carlos escritos aqui
// dentro -- e no mapa de Araraquara apareciam do mesmo jeito, com bairro e preco de
// outro municipio. O bloco e opcional: cidade sem vitrine cadastrada recebe [].
const brl = v => "R$ " + v.toLocaleString("pt-BR");

/* O voo tem GERACAO. Sem ela dois `flyTo` disparados no mesmo gesto (a vitrine
   enquadrando o anuncio e, logo depois, o link enquadrando o predio pelo tamanho dele)
   rodavam os dois ao mesmo tempo, cada um escrevendo em `target` e `sph.radius` no seu
   proprio rAF -- a camera tremia e parava num ponto que nao era o de nenhum dos dois.
   Agora o voo novo invalida o velho na primeira linha do passo. */
let _vooGer = 0;
// Cancela o voo em curso sem mexer na camera: quem chama e quem vai enquadrar por conta
// propria. Sem isto o `flyTo(mx, mz, 190)` da vitrine continuava animando por cima da
// entrada na casa e da cena da planta -- medido, a planta abria a 190 m de distancia
// (um apartamento de 10 m virava tres pixels) porque o voo escrevia em `sph.radius`
// DEPOIS do enquadramento.
function paraVoo() { _vooGer++; }
function flyTo(x, z, radius) {
  const ger = ++_vooGer;
  const x0 = target.x, z0 = target.z, r0 = sph.radius;
  const dx = x - x0, dz = z - z0, dr = radius - r0, t0 = performance.now(), dur = 900;
  // requestAnimationFrame sempre entrega um timestamp real no argumento — chamar step()
  // direto (sem passar por rAF) roda com now=undefined na primeira vez, o que vira NaN
  // em cascata (target/sph.radius = NaN) e quebra a câmera/render logo de cara.
  function step(now) {
    if (ger !== _vooGer) return;                               // outro voo tomou a frente
    const t = Math.min(1, (now - t0) / dur);
    const e = t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2, 3)/2;   // easeInOutCubic
    target.x = x0 + dx*e; target.z = z0 + dz*e; sph.radius = r0 + dr*e;
    if (t < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

// Escapa texto de cadastro que vai pra innerHTML. Fica AQUI, e nao junto do POI onde
// nasceu, porque a vitrine publica se monta na criacao do modulo abaixo -- um const
// declarado depois estaria na zona morta e a vitrine quebraria inteira.
const esc = t => String(t).replace(/[&<>"]/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;" }[c]));

const hsheet = $("hsheet");
const housesBox = $("houses");
// Ficha do anuncio SEM planta (vitrine publica, farol e voo): ver listings/house-sheet.js.
// A ficha (a peca compartilhada com o imovel cadastrado), a ficha do POI e o "por perto"
// nascem depois neste arquivo, entao entram por leitor ou chamada adiada; `usheet` entra
// pelo proprio `$`, que ja acha o elemento no documento.
HouseSheet.create({document, $, esc, px, pz, brl, getSheet:()=>listingSheet,
  ListingModels, hsheet, usheet:$("usheet"), housesBox, houseBeacon, flyTo,
  prewarmMapAt:(x,z)=>prewarmCityV2At(x,z),
  closePoiSheet:()=>closePoiSheet(), abrePerto:ctx=>abrePerto(ctx),
  // `listingIdentity` e a escada nascem os dois mais abaixo -- chamada adiada.
  predioMaisPerto:(x,z,r)=>listingIdentity.predioMaisPerto(x,z,r),
  mostraMaquete:(rec,u,d)=>etapas.mostraMaquete(rec,u,d),
  escondeMaquete:()=>etapas.escondeMaquete()});

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
const cameraGestures = CameraGestures.create({canvas, target, sph, camera, zoomMax,
  getHeight:()=>innerHeight, getInterior:()=>INT, getFirstPerson:()=>FP,
  soltaSeta, cliqueInterior:e=>cliqueInterior(e), cliqueNaCidade:e=>cliqueNaCidade(e),
  getPlanta:()=>etapas.PLANTA, paraTour:()=>{ if (etapas) etapas.tour(false); }});

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
// Busca, mediana e cache da grade: ver world/elevation.js. O que fica aqui e a LIGACAO
// do botao com a cena -- quem repassa a grade nova pro terreno, pros predios urbanos,
// pros rotulos, pros POIs e pra vegetacao.
const {fetchElevation, loadElevCache, saveElevCache} = Elevation.create({document, console,
  CENTER, MLAT, MLON, ELEV_N, ELEV_HALF, timed, sleep, guarda});
function recomputeAllDy() {
  if (urban) urban.transform(reliefAmount,uHeight.value,urbanBase);
  terrain.recompute();
  // v10: arvore nao tem mais laco proprio aqui. Ela deixou de ser InstancedMesh e
  // virou malha mesclada com presetCenter (o pe do tronco), entao o laco de cima ja
  // recalcula o dy dela junto do resto. `treeRegistry` sobrou so pra visibilidade
  // por regiao no frame().
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
// Estabelecimentos: marcador na tela, ficha, categorias, pinos e a coluna "o que tem
// por perto" -- ver ui/poi-panel.js. `usheet` e o interior nascem mais abaixo no arquivo:
// a ficha entra pelo proprio `$` (o elemento ja existe no documento) e o interior por
// leitor, que era o que o `typeof INT` do original ja dizia.
const {recalcDyPois, sujaPois, closePoiSheet, openPoiSheet, setPins, abrePerto, fechaPerto,
       updatePois, PERTO, catOn, pinoOculto} = PoiPanel.create({THREE, document, $, esc, overlay, scene, camera,
  sph, target, POIS, CAT, CAT_KEYS, PoiLayer, terrainY, registerTerrain, POI_HALO, POI_Y,
  POI_MAX, POI_NAME, usheet:$("usheet"), hsheet:$("hsheet"), houseBeacon, flyTo, streamUpdate,
  getInterior:()=>typeof INT !== "undefined" ? INT : null, getRelevo:()=>reliefAmount});

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

// Calibração do preenchimento com ganho 2 da sonda: interior/environment-probe.js.
const FILL = 0.5;

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
  predioDaUnidade, predioMaisPerto} = listingIdentity;

const usheet = $("usheet");
// A ficha e a MESMA peca nos dois fluxos: o anuncio simples (hsheet, la em cima) e a
// ficha do imovel. Por isso ela nasce aqui, e nao dentro de um dos dois.
const listingSheet = ListingSheet.create({$, esc, brl, cidade:CIDADE, sheet:usheet,
  listingModels:ListingModels});
// Fluxo do anuncio (vitrine, "clique no predio", ficha e volta do "por perto"): ver
// listings/flow.js. `enterInterior` nasce mais abaixo, entao entra como chamada adiada.
// Saiu junto o `UNID_ATUAL`, que era escrito e nunca lido.
const {pedePredio, cancelaEscolha, abreUnidade, getEscolhendo, getFicha, setFicha} =
  ListingFlow.create({document, $, esc, brl, UNIDADES,
  listingSheet, usheet, hsheet, housesBox, houseBeacon, target, streamUpdate,
  flyTo, getGroups:()=>gGroups, predioDaUnidade, closePoiSheet, abrePerto,
  enterInterior:(rec,u)=>enterInterior(rec,u), setTimeout,
  getEtapa:()=>etapas.ETAPA, pintaEtapas:()=>etapas.pintaEtapas(),
  vaiParaEtapa:k=>etapas.vaiParaEtapa(k), tour:v=>etapas.tour(v),
  marcaEtapaNaUrl:()=>marcaEtapaNaUrl(), predioMaisPerto,
  prewarmMapAt:(x,z)=>prewarmCityV2At(x,z),
  mostraMaquete:(rec,u,d)=>etapas.mostraMaquete(rec,u,d),
  escondeMaquete:()=>etapas.escondeMaquete()});

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
const {sondaDeAmbiente, soltaSonda} = InteriorEnvironmentProbe.create({
  THREE, renderer, scene, INT, OLHO, QS, ambientePBR,
  MATS_INT: [matParede, matFrio, matMadeira, matInt, matEsq, matAlum, matVidro]
});
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
// Ceu pintado da cidade e da casa, criado ja na carga: ver scene/sky.js. `CEU` nao muda
// mais depois disto (a noite so troca a cor do material; o laco so move a cupula).
const {CEU_LINHA, CEU} = SkyDome.create({THREE, document, scene, NIVEL, hash});
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
  InteriorLights.create({THREE, INT, scene, gInteriores, sun, hemi, renderer, camera, NIVEL, LUZ_PI, FILL, cursorDeLuz, CEU_LINHA, inside, ESP});


/* ---- rótulos de cômodo (DOM, como os de rua) --------------------------- */
function criaRotulos(pl) {
  for (const c of pl.comodos) {
    const el = document.createElement("div");
    el.className = "ilbl"; el.textContent = c.nome;
    overlay.appendChild(el);
    INT.rotulos.push({ el, c, v:new THREE.Vector3() });
  }
}


// Passo em primeira pessoa e manche do celular: ver interior/first-person.js.
const {fpPasso, mostraJoy} = FirstPerson.create({FP, teclas, livre, joy: $("joy"), TOQUE});

function paraUV(x, z) {
  const ob = INT.pl.ob, dx = x - ob.cx, dz = z - ob.cz;
  return [dx*ob.ux + dz*ob.uz, -dx*ob.uz + dz*ob.ux];
}

/* ---- painel ------------------------------------------------------------ */
const ipanel = $("ipanel");
$("isw").addEventListener("input", e => mexeSel("w", parseFloat(e.target.value)));
$("isd").addEventListener("input", e => mexeSel("d", parseFloat(e.target.value)));
$("ish").addEventListener("input", e => mexeSel("h", parseFloat(e.target.value)));
$("icor").addEventListener("input", e => {
  const m = INT.moveis[INT.sel]; if (!m) return;
  m.cor = parseInt(e.target.value.slice(1), 16); recolore(m); salvaMoveis();
});
$("igir").addEventListener("click", () => giraSel());
$("idel").addEventListener("click", () => excluiSel());
$("isair").addEventListener("click", () => etapas.vaiParaEtapa("mapa"));
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
// "Planta" deixou de ser uma vista da cena da cidade e virou a ETAPA 3, com cena
// propria. O id continua o mesmo porque o QA headless o alcanca por ele.
$("ivista").addEventListener("click", () =>
  etapas.vaiParaEtapa(etapas.PLANTA.on ? "interior" : "planta"));
// A troca do forro saiu do ouvinte pra virar funcao. A etapa 3 precisa dela: com parede
// INTEIRA e forro no lugar, a planta vista de cima e uma caixa fechada -- foi exatamente
// o que apareceu ao ligar "Paredes inteiras" pela primeira vez.
function poeTeto(on) {
  INT.teto = on;
  const b = $("iteto");
  if (b) b.setAttribute("aria-pressed", String(on));
  if (!INT.pl || !INT.casa) return;
  INT.casa.traverse(o => { if (o.geometry) o.geometry.dispose(); });
  INT.raiz.remove(INT.casa);
  INT.casa = geoDaCasa(INT.pl, on);
  INT.raiz.add(INT.casa);
  sujaSombra();
}
toggle("iteto", poeTeto);
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
  dentroDaPlanta, paraUV, atualizaMovel, seleciona:i=>seleciona(i), salvaMoveis});

const {fazGrade, mobSetas, poeSetas, poeFantasma, tiraFantasma, mobMed,
  pintaMedidas, posicionaMedidas} = EditorVisuals.create({THREE, INT, MOB, MOB_VERDE,
    document, overlay, camera, redimensiona, getPlanta:()=>etapas.PLANTA});
gInteriores.add(mobSetas);
// Painel e coordenacao do editor (selecao, catalogo, medidas, modos): ver
// interior/editor-panel.js. Criado aqui, depois da grade/setas/fantasma que ele comanda.
// `poeTipo` mora no `app.js` porque o painel e o clique dentro da casa (ui/picking.js)
// escrevem no MESMO slot; os dois o alcancam pelos mesmos dois acessores.
let poeTipo = null;   // slot compartilhado pelo painel e pelo clique dentro da casa
const {seleciona, pintaCatalogo, pintaEditor, mexeSel, giraSel, excluiSel,
       modoMoveis, modo, cancelaGesto, confirmaMover} = EditorPanel.create({document, $,
  INT, MOB, MOB_VERDE, MOVEIS, MOVEL_KEYS, TOQUE, selBox, ipanel, atualizaMovel,
  salvaMoveis, fazGrade, poeSetas, poeFantasma, tiraFantasma, pintaMedidas,
  getPoeTipo:()=>poeTipo, setPoeTipo:v=>{ poeTipo = v; }});



const editorPointer = EditorPointer.create({THREE, canvas, camera, INT, MOB,
  mobSetas, mobMed, cameraGestures, paraUV, dirUV, arred, redimensiona, cabeAqui,
  atualizaMovel, seleciona, selBox, MOB_VERDE, MOB_VERMELHO, salvaMoveis, pintaMedidas,
  getWidth:()=>innerWidth, getHeight:()=>innerHeight});
function soltaSeta(e) { editorPointer.soltaSeta(e); }
// Roteamento do clique (cidade -> registro -> ficha; dentro da casa -> luz, escolher, por,
// mover): ver ui/picking.js. Criado aqui, depois do painel, que ele comanda. `poeTipo`,
// `escolhendo` e `urban` sao variaveis do `app.js` que mudam de valor, e entram como
// acessores; o slot de `poeTipo` e o MESMO que o painel escreve.
const {registroDoHit, cliqueNaCidade, abreFicha, cliqueInterior} = Picking.create({THREE,
  camera, gBuild, getUrban:()=>urban, guarda, chaveAncora, idDoRegistro, unidadeDoPredio,
  abreUnidade, cancelaEscolha, getEscolhendo, INT, MOB, CORTE, MOVEIS,
  dentroDaPlanta, paraUV, alternaLuz, luzDoHit, seleciona, confirmaMover, pintaCatalogo,
  poeNaCena, salvaMoveis, getPoeTipo:()=>poeTipo, setPoeTipo:v=>{ poeTipo = v; }});


// Entrar, sair, corte, furo e as duas vistas da unidade: ver interior/entry.js. Criado
// aqui, depois dos moveis na cena e do manche, que a entrada chama. Duas trocas em
// relacao ao original: `reliefAmount` e `poeTipo` sao variaveis do `app.js` que mudam de
// valor -- a primeira entra como leitor (`getRelevo`), a segunda como o `poeTipoNulo` que
// a entrada usa pra limpar o tipo em espera.
const {baseDaCasa, enterInterior, descarta, exitInterior, saiSeco, alturaDoCorte,
       aplicaFuro, vista} = InteriorEntry.create({THREE, document, $, camera, target, sph,
  gInteriores, INT, FP, TOQUE, OLHO, LV, CORTE, CORTE_OFF, CORTE_OMBRO, NEAR_CASA, FAR_CASA,
  NEAR_CIDADE, FAR_CIDADE, FOV_CIDADE, fovInterior, terrainY, getRelevo:()=>reliefAmount,
  streamUpdate, sujaSombra, uFuro, selBox, BAKE, plantaDaUnidade, unidadeDoPredio,
  predioDaUnidade, geoDaCasa, leMoveis, poeNaCena, criaRotulos, pontoDeEntrada,
  getPlanta:()=>etapas.PLANTA, getEtapa:()=>etapas.ETAPA,
  saiPlanta:pra=>etapas.saiPlanta(pra), pintaEtapas:()=>etapas.pintaEtapas(),
  paraVoo, getFicha, setFicha,
  indoPara:()=>etapas.indoPara(), escondeMaquete:()=>etapas.escondeMaquete(),
  melhorDirecao, livre, quatOlhando, acendeInterior, apagaInterior, sondaDeAmbiente,
  soltaSonda, modoMoveis, mostraJoy, pintaCatalogo, pintaEditor, fechaPerto, setPins,
  closePoiSheet, hsheet, usheet, ipanel, houseBeacon, housesBox,
  poeTipoNulo:()=>{ poeTipo = null; }});

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

/* A escada das tres etapas nasce AQUI: e o primeiro ponto do arquivo em que a casa
   (`enterInterior`), o editor (`modoMoveis`) e a luz (`distribuiLuzes`) ja existem. O
   que vem depois dela -- o laco, o medidor e a URL -- entra como funcao, porque nesta
   linha ainda nao existe. */
etapas = ListingStages.create({THREE, $, QS, renderer, scene, camera, target, sph,
  gInteriores, NIVEL, LUZ_PI, INT, FP, CORTE, UNIDADES, NEAR_CASA, FAR_CASA, BAKE,
  TOQUE, usheet, houseBeacon, housesBox, flyTo, setStreamRadius, sujaSombra,
  fovInterior, alturaDoCorte, baseDaCasa, enterInterior, exitInterior, vista,
  distribuiLuzes, modoMoveis, seleciona, poeTeto, mostraJoy, pontoDeEntrada,
  melhorDirecao, livre, abreUnidade, getFicha, setFicha, paraVoo, resize, frameLoop,
  bakePasso, canvas, LV, obbOf, safeInset, shoelace, terrainY,
  getRelevo:()=>reliefAmount, predioMaisPerto,
  governa:now=>governa(now), interiorFrame:now=>interiorFrame(now),
  pintaPerf:now=>pintaPerf(now), marcaEtapaNaUrl:()=>marcaEtapaNaUrl(),
  getFrame:()=>frame,
  sombraPendente:()=>sombraSuja, limpaSombra:()=>{ sombraSuja = false; },
  poeCpuMs:v=>{ _cpuMs = v; }, semRaf:()=>_semRaf});
etapas.iniciaEtapas();

/* ---- por frame --------------------------------------------------------- */
// Porta pro QA headless, como o `window.__gMuros`: o modulo e um IIFE, entao
// sem isto nenhuma sonda consegue perguntar onde a camera parou.
// `sph` e `target` entram porque enquadrar um print no Chrome headless sempre
// esbarrou neles estarem fora de alcance (ver [[mapa-3d-qa-headless]]).
window.__int = { INT, FP, CORTE, camera, scene, gInteriores, MOVEIS, sph, target, exteriors,
                 // Sem estes nenhuma sonda alcanca as tres etapas. `cenaPlanta` entra
                 // junto de `scene` porque o `mede()` do __perf renderiza uma cena por
                 // nome -- medir a etapa 3 pela cena da cidade daria o numero de uma
                 // coisa que nao esta na tela.
                 MAQ:etapas.MAQ, montaMaquete:etapas.montaMaquete,
                 mostraMaquete:etapas.mostraMaquete, escondeMaquete:etapas.escondeMaquete,
                 cresceMaquete:etapas.cresceMaquete, poeCamMaquete:etapas.poeCamMaquete,
                 aplicaFadeMaquete:etapas.aplicaFadeMaquete, rectDoPainel:etapas.rectDoPainel,
                 ETAPA:etapas.ETAPA, PLANTA:etapas.PLANTA, TOUR:etapas.TOUR,
                 cenaImovel:etapas.cenaImovel, vaiParaEtapa:etapas.vaiParaEtapa,
                 entraPlanta:etapas.entraPlanta, saiPlanta:etapas.saiPlanta,
                 tour:etapas.tour, trocaParedes:etapas.trocaParedes,
                 abrePeloLink:etapas.abrePeloLink, unidadePorId:etapas.unidadePorId,
                 enquadraImovel:etapas.enquadraImovel, raioDoEnquadre:etapas.raioDoEnquadre,
                 ficha: () => getFicha(),
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
                 pins: () => !pinoOculto(),
                 BAKE, bakeAgora, bakePrepara, cenaDoBake, bakeRaio,  // v15: bake
                 grupos: () => gGroups, vivos: () => gLive };

// Sonda do medidor. Existe pelo mesmo motivo da de cima e por um a mais: em aba oculta
// o rAF e estrangulado (ver [[mapa-3d-raf-aba-oculta]]), entao QUALQUER medida tirada do
// laco normal mente. `bombeia` termina a montagem e `mede` desenha fora do rAF, que e a
// unica forma de comparar duas configuracoes sem depender da aba estar na frente.
window.__perf = {
  renderer, scene, camera, NIVEL, nivel: NIVEL_NOME, gpu: GPU,
  dpr: () => governor.dpr, quadroMs: () => governor.frameMs, cpuMs: () => _cpuMs,
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

const interiorFrame = InteriorFrame.create({THREE, INT, FP, CORTE, CORTE_OFF,
  camera, target, OLHO, terrainYCached, baseDaCasa, alturaDoCorte, aplicaFuro,
  distribuiLuzes, seleciona, fpPasso, posicionaMedidas,
  getWidth:()=>innerWidth, getHeight:()=>innerHeight});

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
// `t => frame(t)` e nao `frame`: o laco nasce mais abaixo (scene/frame.js), e ha DOIS
// caminhos que chamam frameLoop ainda durante a carga -- a noite guardada no navegador e
// o `?noite=1` do link. Passar a constante aqui a leria na zona morta e derrubaria a
// pagina justamente para quem deixou a noite ligada. O rAF entrega o mesmo carimbo.
function frameLoop() { if (!looping) { looping = true; requestAnimationFrame(t => frame(t)); } }

const governor = ResolutionGovernor.create({document, getDevicePixelRatio:()=>devicePixelRatio,
  NIVEL, NIVEL_NOME, streaming, INT, renderer, resize, guarda, atualizaBotaoQual});
const governa = governor.update;
let _cpuMs = 0;

/* ---- medidor ------------------------------------------------------------ */
// Numeros do HUD: ver ui/perf-meter.js. `_cpuMs` fica aqui, onde o laco o escreve.
const {mostraPerf, pintaPerf, ligado:perfLigado} = PerfMeter.create({$, QS, GPU, governor,
  renderer, NIVEL, NIVEL_NOME, gLive, streaming, getCpuMs:()=>_cpuMs});

// Teclado (P do medidor, Esc em tres degraus, Del/R no movel, WASD/setas e o "solta tudo"
// ao perder o foco): ver ui/keyboard.js. Criado aqui, e nao no lugar de origem, porque tudo
// que ele aciona -- painel, saida da casa, medidor -- nasce acima desta linha.
Keyboard.create({addEventListener, teclas, INT, MOB, FP, mostraPerf, perfLigado,
  cancelaGesto, modoMoveis, exitInterior, excluiSel, giraSel});

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

const {BUSCA, indexaBusca, buscaAgora} = CitySearch.create({pois:POIS, cls:CLS, target});

const bq = $("bq"), bres = $("bres");
MobileTabs.create({$, perto:PERTO, fechaTudo: () => {
  fechaPerto(false);
  $("usheet").classList.remove("on"); $("hsheet").classList.remove("on");
  closePoiSheet(); houseBeacon.visible = false;
}});
// Caixa de busca (lista, teclado, clique e o voo ate o resultado): ver ui/search-box.js.
// Ela mesma assina os ouvintes do campo, como o manche e os gestos ja faziam.
SearchBox.create({document, addEventListener, bq, bres, esc, buscaAgora, INT, saiSeco,
  openPoiSheet, aim, flyTo, sph, frameLoop});
// Link de posicao na URL: ver ui/position-link.js.

/* ---------------- minimapa ---------------- */
const {MM, montaBaseMinimapa, desenhaMinimapa} = StreetMinimap.create({canvas:$("mmc"),
  target, sph, camera, cat:CAT, catKeys:CAT_KEYS, poiPorCat:POI_POR_CAT, catOn,
  isPoiHidden:pinoOculto, bigRoad:BIGROAD, hw:HW});

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
const {locDaPlanta, desenhaPlantaMini} = FloorPlanMinimap.create({INT, MM, FP,
  camera, inside, document, getComputedStyle});

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
const {aplicaNoite, setNoite} = DayNight.create({THREE, NOITE, renderer, sun, hemi,
  scene, INT, CEU, uNoite, sujaSombra, guarda, frameLoop, el:$});
const {escreveLink, lerLink, marcaEtapaNaUrl} =
  PositionLink.create({CENTER, MLAT, MLON, px, pz, target, sph, NOITE, INT,
  setNoite, streamUpdate, ETAPA:etapas.ETAPA, TOUR:etapas.TOUR, getFicha,
  getLinkImovel:()=>etapas.getLinkImovel(), abrePeloLink:()=>etapas.abrePeloLink()});
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
/* ---------------- o que o laço de quadro chama ---------------- */
// Noite, link na URL e minimapa por quadro: ver ui/frame.js. O contador do link (`_linkT`)
// foi junto: quem conta o intervalo e esta funcao, nao o laco.
const v12Frame = UiFrame.create({$, INT, FP, NOITE, MM, target, sph, aplicaNoite, frameLoop,
  escreveLink, desenhaMinimapa, desenhaPlantaMini});

/* ---- o laco ------------------------------------------------------------- */
// A ORDEM de atualizacao por quadro: ver scene/frame.js. Entra por leitor ou escritor o
// estado que o laco NAO possui -- relevo, rotulo de rua, as duas sujeiras de sombra, os
// dois modulos que so nascem com a cidade (urbanos e exteriores), o tempo de CPU que o
// medidor le e a trava do passo manual do QA.
const frame = SceneFrame.create({THREE, document, $, PLANTA:etapas.PLANTA,
  plantaFrame:now=>etapas.plantaFrame(now), tourPassa:dt=>etapas.tourPassa(dt),
  passoDoTempo:now=>etapas.passoDoTempo(now), marcaTempo:now=>etapas.marcaTempo(now),
  passoMaquete:(now,dt)=>etapas.passoMaquete(now,dt),
  desenhaMaquete:()=>etapas.desenhaMaquete(),
  scene, camera, renderer, target, sph, sun, SOL_OFF, SOMBRA_CIDADE, CEU, INT, BAKE,
  governa, ajustaEsferas, resize, risers, mark, markMat, fillMat, houseBeacon,
  houseBeaconMat, terrainYCached, bakePasso, interiorFrame, streetLabels, vegetation,
  refazPortoes, refazSombras, alvoSombra, updatePois, streamUpdate, streamPump, v12Frame,
  nevoaDoQuadro, pintaPerf, sujaSombra, sombraDoQuadro:cityShadow.porQuadro,
  sujaContato:()=>{ somSujo = true; }, contatoSujo:()=>somSujo,
  sombraPendente:()=>sombraSuja, limpaSombra:()=>{ sombraSuja = false; },
  getRelevo:()=>reliefAmount, mostraRotulos:()=>showLab,
  getUrban:()=>urban, getExteriors:()=>exteriors,
  poeCpuMs:v=>{ _cpuMs = v; }, semRaf:()=>_semRaf,
  getWidth:()=>innerWidth, getHeight:()=>innerHeight});

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

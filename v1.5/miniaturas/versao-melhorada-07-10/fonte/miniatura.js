
/* MINIATURA v4 -- maquete, planta e visita 3D (versão melhorada de 07/10/2026).

   Base: o padrão aprovado em 23/09 (`padrao-atual/anterior/v2.html` + lightmap-v3,
   exterior-v3 e interruptores). O desenho, a luz calculada e o comportamento de cada modo
   são os mesmos; o que mudou é COMO a página chega e quanto ela gasta no aparelho:

   - Arquivos separados e cacheáveis em vez de um HTML de 3,4 MB: three.js e o código ficam
     no cache do aparelho (imutáveis, com hash no nome) e servem a todo imóvel.
   - Interior sob demanda: módulos da planta, biblioteca de móveis e luz interna só descem
     quando alguém abre a Planta 3D ou a Visita (com pré-carga na INTENÇÃO: o dedo que toca
     o botão já dispara o download).
   - Dados em binário (gerador/binario.py) em vez de JSON: sem `JSON.parse` de milhões de
     números nem `push` um a um.
   - Luz em KTX2/UASTC (luz.js): comprimida também na GPU; atlas externo reempacotado.
   - Quadro sob demanda: sem animação e sem toque, nada é desenhado (bateria e calor).
     Na maquete, que gira sozinha, o giro ocioso roda a 30 quadros no perfil médio/baixo.
   - Sombras em cache: o mapa de sombra só é refeito quando algo que projeta muda.
   - Qualidade adaptativa (qualidade.js): perfil por aparelho e resolução dinâmica.
   - Sem o "Ver mapa" e sem a versão offline: a página é online e independente do mapa. */
import * as THREE from 'three';
import { escolhePerfil, criaGovernador, PERFIS } from './qualidade.js';
import { carregaBinario } from './binario.js';
import { carregaAtlas, decodificaGLSL } from './luz.js';
import './mapa-geometria.js';

window.THREE = THREE;              // os módulos do interior e as sondas de QA leem o global
var CFG = JSON.parse(document.getElementById("__config").textContent);
var ESTADO = { exterior: "carregando", interior: "parado", erro: null, quadros: 0 };
// Começa a baixar o prédio antes de qualquer outra coisa: é a única peça da primeira
// imagem que não vem no HTML.
var predioPronto = carregaBinario(CFG.assets.predio);

(async function () {
"use strict";
var D = JSON.parse(document.getElementById("__imovel").textContent);
var P = D.predio, LV = P.pe_direito_pav, N = P.pavimentos, ANDAR = D.andar;

/* ---- a ficha -------------------------------------------------------------- */
function esc(s){ return String(s).replace(/[&<>"]/g, function(c){
  return {"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[c]; }); }
document.getElementById("fTag").textContent = D.tag;
document.getElementById("fNome").textContent = D.empreendimento + " \u00b7 " + D.unidade;
document.getElementById("fSub").textContent = D.endereco;
document.getElementById("fPreco").insertAdjacentHTML("beforeend", esc(D.preco));
document.getElementById("fStats").innerHTML = D.ficha.map(function (r) {
  return "<div>" + esc(r[0]) + "<b>" + esc(r[1]) + "</b></div>"; }).join("");

document.getElementById("seloT").textContent = ANDAR === 0 ? "T\u00e9rreo" : ANDAR + "\u00ba andar";

/* ---- cena ----------------------------------------------------------------- */
var cv = document.getElementById("c"), caixa = document.getElementById("cena");
/* O QUE SE DECIDE ANTES DE CRIAR O CONTEXTO nao da pra mudar depois: antialias e
   escolha de construcao, nao propriedade. Num telefone a tela ja tem 3x de densidade,
   entao o serrilhado que o MSAA tira custa caro e se ve pouco -- e o custo de
   preenchimento e quadratico na resolucao, que e a alavanca mais forte que existe. */
var TOQUE = matchMedia("(pointer:coarse)").matches;
var PEQUENA = Math.min(screen.width, screen.height) <= 820;
var CELULAR = TOQUE && PEQUENA;
/* v4: O PERFIL decide o que so se decide aqui (MSAA) e o ponto de partida do resto. */
var QUAL = window.__perfil || escolhePerfil(), PERFIL = QUAL.perfil;
PERFIL.fpsMeta = PERFIL.fps;
// `?luz=cheia|metade` força a resolução dos atlas (comparação visual e QA).
(function () { var l = new URLSearchParams(location.search).get("luz");
  if (l === "cheia" || l === "metade") PERFIL.luzExterior = PERFIL.luzInterior = l; })();
/* `alpha: true` e o que faz a maquete FLUTUAR. Sem ele o canvas e um retangulo
   opaco com o predio dentro, e qualquer sobreposicao com o cartao vira uma caixa
   por cima de outra. Com ele o que nao e predio e transparente, e o cartao aparece
   por tras -- que e o "em cima da janela de informacoes" do pedido. */
var ren = new THREE.WebGLRenderer({ canvas: cv, antialias: PERFIL.msaa, alpha: true,
                                    powerPreference: "high-performance" });
ren.setClearAlpha(0);
ren.setPixelRatio(PERFIL.dprTeto);
ren.outputColorSpace = THREE.SRGBColorSpace;
ren.toneMapping = THREE.ACESFilmicToneMapping;
ren.toneMappingExposure = 1.02;
ren.shadowMap.enabled = true;
ren.shadowMap.type = PERFIL.sombraSuave ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
/* SOMBRA EM CACHE. O sol nao se move em relacao ao predio enquanto a camera gira -- e
   isso que faz a maquete parecer um objeto numa mesa --, entao o mapa de sombra feito
   num quadro vale para os seguintes. `invalidaSombras` e chamado por quem muda o que
   projeta (modo, conjunto, moveis, interruptores, luz carregada) e o laco confere a
   posicao do sol a cada quadro. Antes o mapa era refeito em TODO quadro. */
ren.shadowMap.autoUpdate = false;
var sombraSuja = true;
function invalidaSombras() { sombraSuja = true; suja(); }
/* O editor avisa quando a mobilia muda (mover, girar, redimensionar, trocar, excluir,
   desfazer, restaurar). Antes isso era DESCOBERTO a cada quadro, comparando a posicao de
   todo movel e montando uma chave de texto com todos eles. */
var versaoMobilia = 0;
function mobiliaMudou() { versaoMobilia++; invalidaSombras(); }
/* QUADRO SOB DEMANDA. `suja()` pede um desenho; o laco so continua sozinho enquanto ha
   animacao (giro da maquete, caminhada, transicao). Declarado aqui porque tudo que vem
   abaixo pode chamar. */
var _pendente = false, _sujo = true, _visivel = true, _lacoPronto = false;
function suja() { _sujo = true; agenda(); }
var _rafId = 0, _resgate = 0;
function agenda() {
  if (!_pendente && _visivel && _lacoPronto) {
    _pendente = true; _rafId = requestAnimationFrame(quadro);
    /* RESGATE. Quadro pedido que nao vem (Chromium sem tela, alguns WebViews que
       estrangulam o rAF) deixaria a cena parada esperando: 250 ms depois ele roda assim
       mesmo. Com o rAF normal o timer e cancelado antes. */
    clearTimeout(_resgate);
    _resgate = setTimeout(function () { if (_pendente) { cancelAnimationFrame(_rafId); quadro(performance.now()); } }, 250);
  }
}
/* Toda interacao pede um quadro: um ouvinte so, na captura, em vez de lembrar de chamar
   `suja()` em cada um dos manipuladores la embaixo. Mover o mouse SEM botao nao desenha
   nada -- exceto com o editor posicionando um movel, que segue o ponteiro. */
["pointerdown", "pointerup", "pointercancel", "wheel", "keydown", "keyup", "click", "input", "change"]
  .forEach(function (t) { addEventListener(t, suja, { capture: true, passive: true }); });
addEventListener("pointermove", function (e) {
  if (e.buttons || e.pointerType === "touch" ||
      (editorCedros && editorCedros.estado.on && editorCedros.estado.acao)) suja();
}, { capture: true, passive: true });
/* Fora da tela nao se desenha: aba em segundo plano, ou a maquete rolada para cima
   enquanto a pessoa le a ficha no celular. */
function avaliaVisivel(naTela) {
  if (naTela !== undefined) avaliaVisivel.naTela = naTela;
  var era = _visivel;
  _visivel = !document.hidden && avaliaVisivel.naTela !== false;
  if (_visivel && !era) { tAnt = 0; suja(); }
}
document.addEventListener("visibilitychange", function () { avaliaVisivel(); });
if (window.IntersectionObserver) new IntersectionObserver(function (es) {
  avaliaVisivel(es[es.length - 1].isIntersecting);
}).observe(caixa);
/* RESOLUCAO DINAMICA (qualidade.js). So o pixel ratio muda; `redim` refaz o tamanho. */
// `?drs=0` desliga a resolucao dinamica (comparacao visual e QA em rasterizador de software).
var SEM_DRS = new URLSearchParams(location.search).get("drs") === "0";
var GOV = criaGovernador({ perfil: PERFIL,
  aplicaDpr: function (d) { ren.setPixelRatio(d); redim(); suja(); },
  aoRebaixar: function (abaixo) { rebaixaAoVivo(abaixo); } });

var cena = new THREE.Scene();
/* Sem fundo e sem nevoa, de proposito. A nevoa fecha na COR dela, e sobre um fundo
   transparente isso pinta uma borda cinza em volta do predio em vez de dissolve-lo. */

/* UM AMBIENTE, SEM ARQUIVO. Vidro e metal nao sao pintados pela luz: eles sao pintados
   pelo que REFLETEM. Sem mapa de ambiente, `metalness` alto nao da vidro -- da preto,
   que foi exatamente o primeiro resultado: 108 janelas que liam como buracos na
   fachada. Um HDR de verdade seria um arquivo (e esta pagina abre com duplo clique),
   entao o ceu e gerado: um degrade equirretangular de 64x32, passado pelo PMREM do
   proprio three. Custa ~1 ms no boot e nao custa nada por quadro. */
(function ambiente() {
  var W = 64, H = 32, dados = new Uint8Array(W * H * 4);
  for (var y = 0; y < H; y++) {
    var t = y / (H - 1);                       // 0 = zenite, 1 = nadir
    // Ceu frio em cima, faixa clara no horizonte, chao escuro embaixo: e o que a
    // janela reflete numa foto de maquete, e e o que da a linha horizontal no vidro.
    var horiz = Math.exp(-Math.pow((t - 0.52) / 0.09, 2));
    var r = (30 + 130 * (1 - t) + 150 * horiz) | 0;
    var g = (44 + 150 * (1 - t) + 155 * horiz) | 0;
    var b = (66 + 175 * (1 - t) + 160 * horiz) | 0;
    for (var x = 0; x < W; x++) {
      var i = (y * W + x) * 4;
      dados[i] = Math.min(255, r); dados[i+1] = Math.min(255, g);
      dados[i+2] = Math.min(255, b); dados[i+3] = 255;
    }
  }
  var tex = new THREE.DataTexture(dados, W, H, THREE.RGBAFormat);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  var pm = new THREE.PMREMGenerator(ren);
  pm.compileEquirectangularShader();
  cena.environment = pm.fromEquirectangular(tex).texture;
  tex.dispose(); pm.dispose();
})();
var cam = new THREE.PerspectiveCamera(34, 1, 0.2, 900);
cam.rotation.order = "YXZ";   // primeira pessoa: yaw depois pitch, nunca roll

/* Luz: uma principal que DESENHA A SOMBRA (e a sombra e o que faz uma maquete parecer
   pousada numa mesa), uma de preenchimento fria do lado oposto pra tirar o preto da
   face que nao pega sol, e uma hemisferica fraca pro resto. Tres e o suficiente --
   cada luz a mais entra no shader de todo material, acesa ou nao. */
var sol = new THREE.DirectionalLight(0xFFF2DD, 2.6);
sol.position.set(26, 42, 18);
sol.castShadow = true;
sol.shadow.mapSize.set(PERFIL.solMapa, PERFIL.solMapa);
sol.shadow.bias = -0.0004;
sol.shadow.normalBias = 0.02;
cena.add(sol, sol.target);
cena.add(new THREE.DirectionalLight(0xAFC8EA, 0.75).translateX(-30).translateY(20).translateZ(-26));
cena.add(new THREE.HemisphereLight(0xEAF0F8, 0x171D25, 0.85));

/* ---- geometria ------------------------------------------------------------ */
var anel = P.pegada, cx = 0, cz = 0;
for (var i = 0; i < anel.length; i++) { cx += anel[i][0]; cz += anel[i][1]; }
cx /= anel.length; cz /= anel.length;

function area2(r) { var s = 0, j = r.length - 1;
  for (var i = 0; i < r.length; j = i++) s += r[j][0]*r[i][1] - r[i][0]*r[j][1];
  return s / 2; }
// Encolhe o anel por deslocamento de aresta. Convexo basta aqui: a casca de um predio
// de anuncio e um retangulo ou um L, e o L so falharia num recuo menor que a espessura.
function encolhe(r, d) {
  var sgn = area2(r) > 0 ? 1 : -1, out = [];
  for (var i = 0; i < r.length; i++) {
    var a = r[(i - 1 + r.length) % r.length], b = r[i], c = r[(i + 1) % r.length];
    var n1 = norm(a, b), n2 = norm(b, c);
    var mx = (n1[0] + n2[0]), mz = (n1[1] + n2[1]);
    var L = Math.hypot(mx, mz) || 1;
    var cosm = (n1[0]*n2[0] + n1[1]*n2[1] + 1) / 2;
    var k = d / Math.max(0.35, Math.sqrt(Math.max(0.12, cosm)));
    out.push([b[0] - sgn * mx / L * k, b[1] - sgn * mz / L * k]);
  }
  return out;
  function norm(p, q) { var dx = q[0]-p[0], dz = q[1]-p[1], l = Math.hypot(dx, dz) || 1;
    return [dz/l, -dx/l]; }
}
function forma(r, buraco) {
  var s = new THREE.Shape();
  s.moveTo(r[0][0] - cx, -(r[0][1] - cz));
  for (var i = 1; i < r.length; i++) s.lineTo(r[i][0] - cx, -(r[i][1] - cz));
  s.closePath();
  if (buraco) {
    var h = buraco.slice().reverse(), p = new THREE.Path();
    p.moveTo(h[0][0] - cx, -(h[0][1] - cz));
    for (var k = 1; k < h.length; k++) p.lineTo(h[k][0] - cx, -(h[k][1] - cz));
    p.closePath(); s.holes.push(p);
  }
  return s;
}
function prisma(r, alt, buraco, bisel) {
  var g = new THREE.ExtrudeGeometry(forma(r, buraco), { depth: alt,
    bevelEnabled: !!bisel, bevelSize: bisel || 0, bevelThickness: bisel || 0,
    bevelSegments: 1, steps: 1 });
  g.rotateX(-Math.PI / 2); g.computeVertexNormals();
  return g;
}

var predio = new THREE.Group();
cena.add(predio);

var LAJE = 0.34;                       // a laje avanca alem da parede: e ela que
var REC  = 0.30;                       // desenha a linha horizontal de cada pavimento
// Texturas pequenas, deterministicas e embutidas: continuam funcionando offline.
// Cor em sRGB; relevo e rugosidade usam dados lineares. UVs do prisma em metros.
function acabamento(escala, semente) {
  var c = document.createElement('canvas'); c.width = c.height = 128;
  var ctx = c.getContext('2d'), pixels = ctx.createImageData(128,128);
  for (var i = 0; i < pixels.data.length; i += 4) {
    semente = (Math.imul(semente,1664525) + 1013904223) >>> 0;
    var v = 224 + (semente >>> 27);
    pixels.data[i] = pixels.data[i+1] = pixels.data[i+2] = v;
    pixels.data[i+3] = 255;
  }
  ctx.putImageData(pixels,0,0);
  var mapa = new THREE.CanvasTexture(c);
  mapa.wrapS = mapa.wrapT = THREE.RepeatWrapping;
  mapa.repeat.set(escala,escala);
  mapa.anisotropy = Math.min(4,ren.capabilities.getMaxAnisotropy());
  var relevo = mapa.clone(); relevo.needsUpdate = true;
  mapa.colorSpace = THREE.SRGBColorSpace;
  return { map:mapa, bumpMap:relevo, bumpScale:0.018, roughnessMap:relevo };
}
var reboco = acabamento(1.5,71), concreto = acabamento(0.8,113);
var matLaje = new THREE.MeshStandardMaterial({ color: 0xDED7CA, roughness: 0.88,
                                               metalness: 0.02, envMapIntensity: 0.5 });
var matPar  = new THREE.MeshStandardMaterial({ color: 0xB4BAC1, roughness: 0.92,
                                               metalness: 0.02, envMapIntensity: 0.5 });
// `envMapIntensity` acima de 1 de proposito: o ambiente gerado e fraco (um degrade,
// nao um HDR), e e o reflexo que desenha a janela.
var matVid  = new THREE.MeshStandardMaterial({ color: 0x4D6877, roughness: 0.18,
                                               metalness: 0.35, envMapIntensity: 1.6 });
var matCax  = new THREE.MeshStandardMaterial({ color: 0xD7D4CD, roughness: 0.38, metalness: 0.35 });
matLaje.setValues(concreto); matPar.setValues(reboco);
var matTopo = new THREE.MeshStandardMaterial(Object.assign({ color:0x737A7A,
  roughness:0.96, metalness:0, polygonOffset:true, polygonOffsetFactor:-1,
  polygonOffsetUnits:-1 }, concreto));


/* ---- O PREDIO E UMA LISTA DE BLOCOS --------------------------------------
   O Castanheiras nao e uma caixa: sao duas laminas de 20x15, oito faixas de cobogo de
   1,6x1,4 que sobem os 22 pavimentos, duas caixas de escada UM pavimento mais altas que
   a torre, e um embasamento de 38x8 rente a rua com a portaria. Tudo isso esta no
   cadastro (`lote.predio.blocos`) e e o mesmo que o mapa 3D desenha -- desenhar so o
   bloco principal aqui era mostrar menos predio do que o produto ja mostra.

   Cada bloco custa duas chamadas (laje e parede instanciadas) mais duas de esquadria
   quando ele tem apartamento. Treze blocos nao sao treze predios: sao ~30 chamadas numa
   pagina que nao desenha mais nada. */
var JAN_L = 1.40, JAN_A = 1.45, JAN_PASSO = 2.30, JAN_PEITO = 0.95;
var CAX_FORA = 0.02, VID_FORA = 0.065;
function dentro(r, x, z) {          // ponto em poligono, por cruzamentos
  var d = false;
  for (var i = 0, j = r.length - 1; i < r.length; j = i++) {
    if ((r[i][1] > z) !== (r[j][1] > z) &&
        x < (r[j][0]-r[i][0]) * (z-r[i][1]) / (r[j][1]-r[i][1]) + r[i][0]) d = !d;
  }
  return d;
}
/* Um material de parede por COR, memorizado. Sem o cache, oito faixas de cobogo da
   mesma cor viravam oito materiais -- oito programas compilados pro mesmo pixel. */
/* O objeto de rascunho das instancias e o ajudante que escreve a matriz. Saem uma vez
   so: `InstancedMesh.setMatrixAt` quer uma matriz pronta, e criar um Object3D por
   instancia seria 13 blocos x 23 pavimentos de lixo por montagem. */
var d = new THREE.Object3D();
function poe(m, i, y) {
  d.position.set(0, y, 0); d.rotation.set(0, 0, 0); d.scale.set(1, 1, 1);
  d.updateMatrix(); m.setMatrixAt(i, d.matrix);
}

var matsPar = {};
function matDaCor(hex) {
  if (!hex) return matPar;
  if (!matsPar[hex]) matsPar[hex] = new THREE.MeshStandardMaterial(Object.assign(
    { color: new THREE.Color(hex), roughness: 0.92, metalness: 0.02, envMapIntensity: 0.5 }, reboco));
  return matsPar[hex];
}

/* v4: AS MALHAS DO BLENDER CHEGAM EM BINARIO (`predio.bin`, gerador/binario.py). Antes
   eram 1,4 MB de numeros escritos em texto dentro do HTML (`CASTANHEIRAS_BLENDER`); aqui
   cada atributo e uma vista Float32Array sobre o arquivo baixado, entregue a GPU sem
   conversao. O nome antigo continua: o resto da pagina testa a existencia dele. */
var PREDIO_BIN = await predioPronto;
var CASTANHEIRAS_BLENDER = PREDIO_BIN.cab;
/* Consome malhas avaliadas e exportadas pelo Blender.
   Fonte: modelar_castanheiras.py / castanheiras.blend. */
function montaCastanheiras(bl) {
  if(!bl.principal)return {};
  var asset=CASTANHEIRAS_BLENDER, A=PREDIO_BIN.arrays, geometrias={}, materiais={}, resultado={};
  Object.keys(asset.geometries).forEach(function(key){
    var dados=asset.geometries[key],g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.BufferAttribute(A[dados.position],3));
    g.setAttribute('normal',new THREE.BufferAttribute(A[dados.normal],3));
    g.setAttribute('uv',new THREE.BufferAttribute(A[dados.uv],2));
    if(dados.index)g.setIndex(new THREE.BufferAttribute(A[dados.index],1));
    g.computeBoundingSphere();geometrias[key]=g;
  });
  Object.keys(asset.materials).forEach(function(key){
    var data=asset.materials[key],m=new THREE.MeshStandardMaterial({
      roughness:data.roughness,metalness:data.metalness,
      emissiveIntensity:data.emissiveIntensity,envMapIntensity:0.8});
    m.color.setRGB.apply(m.color,data.color);
    m.emissive.setRGB.apply(m.emissive,data.emissive);
    if(key==='MAT-reboco')m.setValues(reboco);
    if(key==='MAT-concreto')m.setValues(concreto);
    materiais[key]=m;
  });
  var o=new THREE.Object3D();
  asset.groups.forEach(function(group){
    var instances=group.instances.slice().sort((a,b)=>a.floor-b.floor);
    var mesh=new THREE.InstancedMesh(geometrias[group.geometry],materiais[group.material],instances.length);
    mesh.name='Blender / '+group.geometry+' / torre '+group.tower;
    instances.forEach(function(it,i){
      if(it.matrix)o.matrix.fromArray(it.matrix);
      else {o.position.fromArray(it.p);o.scale.fromArray(it.s);o.updateMatrix();}
      mesh.setMatrixAt(i,o.matrix);
    });
    mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();
    mesh.castShadow=mesh.receiveShadow=true;mesh.userData.tower=group.tower;predio.add(mesh);
    if(group.tower===0 && group.role==='lajes')resultado.lajes=mesh;
    if(group.tower===0 && group.role==='paredes')resultado.pars=mesh;
  });
  if(!resultado.lajes || !resultado.pars)throw Error('Exportacao Blender sem pavimentos selecionaveis');
  predio.userData.fonte=asset.source;
  return resultado;
}


function montaBloco(bl) {
  if (typeof CASTANHEIRAS_BLENDER !== 'undefined') return montaCastanheiras(bl);
  var r = bl.pegada, nb = bl.pavimentos;
  var interno = encolhe(r, REC);
  var gL = prisma(r, LAJE, null, 0.025), gP = prisma(interno, LV - LAJE);
  var ml = new THREE.InstancedMesh(gL, matLaje, nb + 1);
  var mp = new THREE.InstancedMesh(gP, matDaCor(bl.cor), nb);
  ml.castShadow = ml.receiveShadow = true;
  mp.castShadow = mp.receiveShadow = true;
  for (var f = 0; f < nb; f++) { poe(ml, f, f*LV); poe(mp, f, f*LV + LAJE); }
  poe(ml, nb, nb*LV);                   // laje de cobertura
  ml.instanceMatrix.needsUpdate = mp.instanceMatrix.needsUpdate = true;
  predio.add(ml, mp);

  if (bl.janelas) {
    /* AS JANELAS SAO ESQUADRIAS, NAO UMA FITA. Uma faixa continua de vidro em volta do
       predio inteiro le como torre corporativa -- e o imovel aqui e residencial. Cada
       face recebe uma FILEIRA de janelas de 1,40 m, espacadas 2,30, centradas na face; o
       que sobra de parede nas pontas e o que da escala ao predio. */
    var postos = [];
    for (var e = 0; e < interno.length; e++) {
      var a = interno[e], b = interno[(e + 1) % interno.length];
      var dx = b[0]-a[0], dz = b[1]-a[1], Lg = Math.hypot(dx, dz);
      if (Lg < 1.2) continue;
      /* PRA QUE LADO ESTA O LADO DE FORA. Deduzir do sentido do anel funciona ate chegar
         um contorno com o enrolamento trocado -- e entao as janelas de uma fachada
         inteira nascem viradas pra dentro da parede, o que nao acusa erro nenhum: a
         fachada fica lisa. Aqui o lado de fora e MEDIDO. */
      var nx = dz/Lg, nz = -dx/Lg;
      var mx = a[0] + dx/2, mz = a[1] + dz/2;
      if (dentro(interno, mx + nx*0.5, mz + nz*0.5)) { nx = -nx; nz = -nz; }
      var quantas = Math.max(1, Math.floor((Lg - 0.9) / JAN_PASSO));
      var passo = Lg / quantas;
      for (var k = 0; k < quantas; k++) {
        var t = (k + 0.5) * passo;
        postos.push({ x: a[0] + dx/Lg*t - cx, z: a[1] + dz/Lg*t - cz,
                      nx: nx, nz: nz, ang: Math.atan2(nx, nz) });
      }
    }
    /* O CAIXILHO TEM QUE FICAR NA FRENTE DA PAREDE, e o vidro na frente dele. A parede e
       um prisma MACICO (nao um anel), entao qualquer peca posta sobre a linha da fachada
       fica metade enterrada -- foi o que aconteceu no primeiro print: 108 janelas
       desenhadas e nenhuma visivel, so os buracos pretos do vidro. */
    var nJ = postos.length * nb;
    if (nJ) {
      var vidros = new THREE.InstancedMesh(new THREE.BoxGeometry(JAN_L, JAN_A, 0.05), matVid, nJ);
      var caxs   = new THREE.InstancedMesh(new THREE.BoxGeometry(JAN_L + 0.18, JAN_A + 0.18, 0.12), matCax, nJ);
      var divisorias = new THREE.InstancedMesh(new THREE.BoxGeometry(0.045, JAN_A, 0.065), matCax, nJ);
      var peitoris = new THREE.InstancedMesh(new THREE.BoxGeometry(JAN_L + 0.28, 0.09, 0.28), matLaje, nJ);
      divisorias.name = 'Divisoes das esquadrias'; peitoris.name = 'Peitoris';
      vidros.name = 'Vidros';
      peitoris.castShadow = peitoris.receiveShadow = true;
      vidros.receiveShadow = caxs.receiveShadow = true;
      var tomVidro = new THREE.Color();
      caxs.castShadow = true;
      var n2 = 0;
      for (var f2 = 0; f2 < nb; f2++) for (var q = 0; q < postos.length; q++) {
        var pt = postos[q], yy = f2*LV + LAJE + JAN_PEITO + JAN_A/2;
        d.rotation.set(0, pt.ang, 0); d.scale.set(1,1,1);
        d.position.set(pt.x + pt.nx*CAX_FORA, yy, pt.z + pt.nz*CAX_FORA);
        d.updateMatrix(); caxs.setMatrixAt(n2, d.matrix);
        d.position.set(pt.x + pt.nx*VID_FORA, yy, pt.z + pt.nz*VID_FORA);
        d.updateMatrix(); vidros.setMatrixAt(n2, d.matrix);
        var variacao = 0.76 + ((f2*17 + q*7) % 11) * 0.024;
        vidros.setColorAt(n2, tomVidro.setRGB(variacao,variacao,variacao));
        d.position.set(pt.x + pt.nx*0.12, yy, pt.z + pt.nz*0.12);
        d.updateMatrix(); divisorias.setMatrixAt(n2,d.matrix);
        d.position.set(pt.x + pt.nx*0.08, yy - JAN_A/2 - 0.08, pt.z + pt.nz*0.08);
        d.updateMatrix(); peitoris.setMatrixAt(n2,d.matrix);
        n2++;
      }
      vidros.instanceMatrix.needsUpdate = caxs.instanceMatrix.needsUpdate = true;
      divisorias.instanceMatrix.needsUpdate = peitoris.instanceMatrix.needsUpdate = true;
      vidros.instanceColor.needsUpdate = true;
      predio.add(caxs, vidros, divisorias, peitoris);
    }
    // Platibanda: e o que separa "predio" de "caixa empilhada". So onde ha apartamento;
    // a caixa de escada do cadastro ja e o remate das laminas.
    var plat = new THREE.Mesh(prisma(r, 0.95, encolhe(r, 0.24)), matDaCor(bl.cor));
    plat.position.y = nb*LV + LAJE; plat.castShadow = plat.receiveShadow = true; predio.add(plat);
    var topo = new THREE.Mesh(prisma(encolhe(r,0.26),0.025),matTopo);
    topo.position.y = nb*LV + LAJE + 0.005; topo.receiveShadow = true;
    var remate = new THREE.Mesh(prisma(r,0.065,encolhe(r,0.28),0.012),matLaje);
    remate.position.y = nb*LV + LAJE + 0.95;
    remate.castShadow = remate.receiveShadow = true;
    predio.add(topo,remate);
  }
  return { lajes: ml, pars: mp };
}

/* A CASA DE MAQUINAS NAO E MAIS SINTETICA. Havia uma caixa de 3,2x2,4x2,6 fixa no
   centro do topo; o cadastro traz as DUAS de verdade (7x5, 23 pavimentos -- um a mais
   que a torre), entao a inventada saiu. */
var BLOCOS = (P.blocos && P.blocos.length) ? P.blocos
           : [{ pegada: anel, pavimentos: N, cor: null, janelas: true, principal: true }];
var lajes = null, pars = null;
for (var ib = 0; ib < BLOCOS.length; ib++) {
  var feito = montaBloco(BLOCOS[ib]);
  if (BLOCOS[ib].principal) { lajes = feito.lajes; pars = feito.pars; }
}
if (!lajes) { lajes = predio.children[0]; pars = predio.children[1]; }


/* NADA DE TERRENO. Tinha um disco com grade aqui, e o argumento era bom -- sem
   superficie embaixo a sombra cai no nada e a maquete perde a pista de profundidade.
   So que "pista de profundidade" custava prender o predio no chao, e o pedido e o
   contrario: ele flutua. O que sobra desenhando volume e a sombra do proprio predio
   sobre ele mesmo (a platibanda na laje, o recuo de cada janela) mais o degrade que o
   CSS poe ATRAS do canvas -- que nao e geometria e nao pesa nada.

   `raioChao` continua existindo porque o enquadramento e a camera de sombra se apoiam
   nele; ele passou a ser so a extensao do predio, sem malha nenhuma. */
/* O raio cobre TODOS os blocos, nao so o principal. Com a segunda lamina 21 m ao lado e
   o embasamento de 38 m, medir so o bloco da unidade deixava metade do predio fora do
   enquadramento e fora da camera de sombra -- e sombra fora da caixa da luz nao sai
   errada, sai PRETA (a mesma armadilha que ja custou uma volta aqui). */
var raioChao = 0;
for (var ib2 = 0; ib2 < BLOCOS.length; ib2++) {
  var rr = BLOCOS[ib2].pegada;
  for (var v = 0; v < rr.length; v++)
    raioChao = Math.max(raioChao, Math.hypot(rr[v][0]-cx, rr[v][1]-cz));
}
raioChao = raioChao * 2.4 + 8;

/* O PAVIMENTO DA UNIDADE. Verde, translucido, sem luz (`MeshBasic`) e com o contorno
   por cima: cor de material iluminado nao le como "e este aqui" -- ela some no branco
   da parede assim que o sol bate. O pulso anda pelo RELOGIO, nao por quadro. */
var brilho = null, contorno = null, corInst = new THREE.Color();
if (ANDAR >= 0 && ANDAR < N) {
  /* Cor POR INSTANCIA na laje e na parede daquele pavimento. A primeira versao punha um
     volume verde translucido dentro do andar -- e ele nao aparecia, porque estava
     DENTRO do predio: a parede opaca o tapava por inteiro, e do lado de fora so sobrava
     o contorno. Pintar a propria laje e a propria parede resolve pelo lado certo, e de
     graca: `setColorAt` multiplica a difusa, entao a faixa do andar fica verde e
     continua sendo a mesma chamada de desenho. */
  lajes.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array((N+1)*3), 3);
  pars.instanceColor  = new THREE.InstancedBufferAttribute(new Float32Array(N*3), 3);
  for (var ci = 0; ci <= N; ci++) lajes.setColorAt(ci, corInst.setRGB(1,1,1));
  for (var cj = 0; cj < N; cj++)  pars.setColorAt(cj, corInst.setRGB(1,1,1));
  var pts = [];
  for (var s2 = 0; s2 < 2; s2++) {
    var yl = ANDAR*LV + (s2 ? LV : 0);
    for (var i2 = 0; i2 < anel.length; i2++) {
      var p1 = anel[i2], p2 = anel[(i2+1) % anel.length];
      pts.push(p1[0]-cx, yl, p1[1]-cz, p2[0]-cx, yl, p2[1]-cz);
    }
  }
  var gl = new THREE.BufferGeometry();
  gl.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pts), 3));
  contorno = new THREE.LineSegments(gl, new THREE.LineBasicMaterial({
    color: 0x39D98A, transparent: true, opacity: 0.95, depthTest: false }));
  contorno.renderOrder = 5; predio.add(contorno);
  brilho = true;                       // so o sinal de que ha pavimento pra pulsar
}

/* ---- camera em orbita ----------------------------------------------------- */
/* O CENTRO DE GIRO E O DO CONJUNTO, E NAO O DO BLOCO DA UNIDADE.

   Todo bloco vem no referencial do PRINCIPAL, entao a ORIGEM da cena e o centro do
   bloco onde esta o apartamento -- e era ali que a orbita girava, com `raioBase`
   medido so na pegada desse mesmo bloco. Numa torre unica os dois acertam por
   coincidencia, e foi assim que isto passou despercebido. No Monte das Colinas, que
   sao duas laminas lado a lado mais um embasamento, a camera girava em torno da
   lamina da ESQUERDA: a outra metade do empreendimento ficava fora da tela, entrando
   e saindo conforme a volta.

   A caixa da malha JA MONTADA responde as duas coisas de uma vez, e responde pelo que
   existe de fato -- platibanda, casa de maquinas e o contorno do pavimento inclusive
   -- em vez de refazer a conta a partir do cadastro e errar de novo no proximo
   formato de empreendimento que aparecer. */
predio.updateWorldMatrix(true, true);
var modeloMontes = /^monte-d[ao]s-/.test(D._id || '');
var conjuntoCompleto = !modeloMontes;
function caixaVisivel() {
  var box=new THREE.Box3();
  predio.children.forEach(function(o){if(o.visible && o.isMesh)box.expandByObject(o);});
  return box;
}
if(modeloMontes)predio.children.forEach(function(o){
  if(o.isMesh)o.visible=o.userData.tower===0;
});
var CAIXA = caixaVisivel();
var MEIO = CAIXA.getCenter(new THREE.Vector3());
var TAM = CAIXA.getSize(new THREE.Vector3());
var ALTURA = TAM.y;
/* Raio da esfera que envolve a PLANTA do conjunto -- a diagonal, e nao o semi-lado.
   E o pior caso de qualquer giro, que e o unico que interessa a uma coisa que roda
   sozinha: com o semi-lado o canto do embasamento sairia da tela em 45 graus. */
var raioBase = Math.hypot(TAM.x, TAM.z) / 2;
var alvo = new THREE.Vector3(MEIO.x, MEIO.y, MEIO.z);
var orb = { r: 40, th: D._id === 'wish-castanheiras-58' ? -0.48 : 0.72,
            ph: D._id === 'wish-castanheiras-58' ? 1.38 : 1.03 };
var R_MIN = 9, R_MAX = 260, gira = true, zoomManual = false;
if(modeloMontes){
  var btConjunto=document.getElementById('verConjunto');btConjunto.hidden=false;
  var nota=document.getElementById('notaModelo');nota.hidden=false;
  nota.textContent=D._id==='monte-das-colinas-39'
    ? 'Maquete ilustrativa • conjunto com quatro blocos representativos; implantação completa não reproduzida.'
    : 'Maquete ilustrativa baseada nas imagens da MRV • dimensões e implantação aproximadas.';
  btConjunto.onclick=function(){
    conjuntoCompleto=!conjuntoCompleto;
    predio.children.forEach(function(o){if(o.isMesh)o.visible=conjuntoCompleto || o.userData.tower===0;});
    CAIXA=caixaVisivel();CAIXA.getCenter(MEIO);CAIXA.getSize(TAM);
    ALTURA=TAM.y;raioBase=Math.hypot(TAM.x,TAM.z)/2;
    btConjunto.textContent=conjuntoCompleto?'Ver bloco da unidade':'Ver conjunto';
    btConjunto.setAttribute('aria-pressed',String(conjuntoCompleto));
    vaiPara('maquete');
  };
}

/* O RAIO QUE ENQUADRA O PREDIO INTEIRO, e nao um multiplo chutado do tamanho dele.
   O primeiro palpite (`max(raioChao*1.25, ALTURA*1.5)`) cortava a cobertura no topo da
   tela, e cortava mais ou menos conforme a PROPORCAO da janela -- numa tela larga o
   campo vertical e o limite, numa estreita e o horizontal. Aqui os dois entram: a
   esfera que envolve o predio tem que caber no menor dos dois campos. */
function raioQueEnquadra() {
  var vf = cam.fov * Math.PI / 180;
  var hf = 2 * Math.atan(Math.tan(vf / 2) * cam.aspect);
  /* Contra a CAIXA, e nao contra a esfera envolvente. A esfera e mais simples e mais
     conservadora: ela trata um predio alto e estreito como uma bola do tamanho da
     diagonal dele, e num celular em pe isso deixava meia tela de sobra dos lados --
     medido, o predio ENCOLHIA quando a ficha recolhia e dava mais altura pra cena, que
     e o oposto do esperado. Aqui cada eixo e medido no campo dele e vence o mais
     exigente; o termo final e a metade de perto do predio, que a orbita (distancia ao
     CENTRO) nao conta. */
  /* O QUE SE ENQUADRA MUDA COM O MODO: no "Predio" e a torre inteira, na "Planta 3D"
     e a laje de um pavimento -- 21 m de altura contra 2,6. Usar a medida da torre nos
     dois deixaria a planta do tamanho de uma moeda no meio do painel. */
  var ehPlanta = (typeof modo !== "undefined") && modo === "planta3d";
  if (ehPlanta) {
    /* A PLANTA E LARGA E PLANA, e isso quebra a conta por eixo. Num predio a altura
       fica no eixo vertical e a largura no horizontal, qualquer que seja o giro. Numa
       laje de 16 x 9 m inclinada, a PROFUNDIDADE dela projeta no eixo vertical junto
       com o pe-direito -- medir so 2,6 m de altura deixava o canto de baixo saindo
       pela borda. Aqui vale a esfera que a envolve contra o menor dos dois campos:
       e conservador, e conservador e o certo pra uma coisa que gira livre. */
    var Rb = Math.hypot(Math.hypot(PB.w, PB.h) / 2, PD / 2);
    return Math.max(R_MIN, Rb / Math.sin(Math.min(vf, hf) / 2) * 1.08);
  }
  var dv = (ALTURA / 2) / Math.tan(vf / 2);
  var dh = raioBase / Math.tan(hf / 2);
  // 1,12 e nao 1,06: com a margem justa a base do predio encostava na borda de baixo
  // do painel, e a perspectiva ainda empurra pra fora o canto mais proximo.
  return Math.max(R_MIN, Math.max(dv, dh) * 1.12 + raioBase * 0.9);
}
var deslocamentoPivo = new THREE.Vector3(0, 0, 1);
function poeCam() {
  var s = Math.sin(orb.ph);
  cam.position.set(alvo.x + orb.r*s*Math.sin(orb.th), alvo.y + orb.r*Math.cos(orb.ph),
                   alvo.z + orb.r*s*Math.cos(orb.th));
  /* O `up` SAI DA PROPRIA ORBITA, e nao do eixo Y do mundo.

     Com `up = (0,1,0)` a camera nao chega ao zenite: olhando reto pra baixo a direcao
     de vista fica PARALELA ao up, o `lookAt` perde a referencia de rotacao e a imagem
     gira sozinha. Era por isso que o arrasto parava em 0,28 rad -- 16 graus fora da
     vertical --, e por isso nao havia como ver a planta de cima de verdade.

     Este vetor e a tangente "norte" da esfera no ponto onde a camera esta. Para
     `ph > 0` ele da EXATAMENTE a mesma orientacao que o up do mundo dava (e a
     componente de (0,1,0) perpendicular a vista, normalizada -- a conta fecha), entao
     nada muda no resto da faixa. A diferenca e que em `ph = 0` ele continua definido:
     vale `(-sen th, 0, -cos th)`, e o norte da planta fica preso ao azimute em vez de
     saltar. Com ele, o limite pode ir a zero, e zero e a vista de planta baixa. */
  cam.up.set(-Math.cos(orb.ph)*Math.sin(orb.th), s, -Math.cos(orb.ph)*Math.cos(orb.th));
  cam.lookAt(alvo);
  // O pivo pode ficar fora do centro da tela sem inclinar os eixos da camera.
  if (modo === 'planta3d')
    cam.position.copy(deslocamentoPivo).applyQuaternion(cam.quaternion).multiplyScalar(orb.r).add(alvo);
  cam.updateMatrixWorld();
}

/* CENTRALIZAR VERTICALMENTE, e nao so caber.

   Um conjunto largo e baixo projeta BAIXO: a camera olha de cima, e o que e achatado
   cai pro pe do quadro. Medido no Monte das Colinas: 24,1% de folga no topo contra
   8,9% na base. Cabia inteiro e ficava torto -- com a sobra acumulada justamente em
   cima, que e o lugar de onde ela ja tinha sido tirada uma vez.

   O ajuste e no ALVO e nao na camera: `poeCam` poe a camera EM VOLTA do alvo, entao
   mover o alvo em y sobe os dois juntos. E deslocamento paralelo, nao inclinacao --
   o enquadramento horizontal nao muda, e nem o angulo de quem olha.

   A conta e feita sobre o CILINDRO que envolve o predio (dois aneis de raio
   `raioBase`, um no topo e um na base) e nao sobre a caixa. O cilindro e identico
   visto de qualquer azimute: a correcao nao muda com o giro, e por isso o predio nao
   balanca pra cima e pra baixo enquanto a maquete roda sozinha. */
var _pc = new THREE.Vector3();
function centralizaVertical() {
  var vf = cam.fov * Math.PI / 180, i, k;
  for (k = 0; k < 3; k++) {                  // converge em 2; a 3a e folga
    poeCam(); cam.updateMatrixWorld();
    var lo = 1e9, hi = -1e9;
    for (i = 0; i < 16; i++) {
      var a = (i % 8) * Math.PI / 4;
      _pc.set(MEIO.x + raioBase * Math.cos(a),
              i < 8 ? CAIXA.max.y : CAIXA.min.y,
              MEIO.z + raioBase * Math.sin(a)).project(cam);
      lo = Math.min(lo, _pc.y); hi = Math.max(hi, _pc.y);
    }
    var desvio = (lo + hi) / 2;               // 0 = centrado, +1 = topo do quadro
    if (Math.abs(desvio) < 0.004) break;
    // meia altura do tronco a essa distancia: e quanto vale 1 de NDC em metros
    alvo.y += desvio * Math.tan(vf / 2) * orb.r;
  }
}
function redim() {
  var w = caixa.clientWidth, h = caixa.clientHeight;
  if (!w || !h) return;
  if (cv.width !== Math.floor(w*ren.getPixelRatio()) || cv.height !== Math.floor(h*ren.getPixelRatio())) {
    /* `updateStyle` LIGADO (o padrao). Com ele desligado o canvas fica sem tamanho de
       CSS e o navegador o exibe no tamanho do BUFFER -- que e `w * devicePixelRatio`.
       Num monitor de dpr 1 os dois numeros coincidem e nao se ve nada; num celular de
       dpr 1,75 a maquete sai 75% maior que o painel e vaza por fora dele. Foi assim
       que a "miniatura gigante no celular" nasceu, junto com um `width:100pct` invalido
       que ficou na folha. Aqui sao os dois consertos, e este e o que nao depende de o
       CSS estar certo. */
    ren.setSize(w, h);
  }
  if (Math.abs(cam.aspect - w/h) > 1e-4) { cam.aspect = w/h; cam.updateProjectionMatrix(); }
  /* Fora do `if` de proposito. No primeiro quadro a ficha ainda nao foi medida, entao
     a caixa da cena tem a altura da tela inteira e o raio sai calculado pra uma
     proporcao que nao existe. Recalcular sempre custa duas tangentes por quadro e
     acerta o enquadramento assim que o layout assenta. Quem ja aproximou com a mao
     (`zoomManual`) ou pediu "Ver andar" (`perto`) nao e mexido. */
  if (!zoomManual && !voo && !perto && modo !== "visita") {
    orb.r = raioQueEnquadra();
    // `alvo.y` volta ao meio antes de corrigir: senao cada `redim` corrige a correcao
    // anterior e o predio escorrega pra fora a cada arrasto de janela.
    if (typeof modo === "undefined" || modo === "maquete") {
      alvo.y = MEIO.y; centralizaVertical();
    }
  }
  // A planta 2D e desenhada em PIXELS do painel: mudou a caixa, o desenho e refeito.
  if (typeof modo !== "undefined" && modo === "planta2d") desenhaPlanta2D();
}
function redimSuja() { redim(); suja(); }
addEventListener("resize", redimSuja);
if (window.ResizeObserver) new ResizeObserver(redimSuja).observe(caixa);

var perto = false, voo = null;    // declarados aqui: `redim()` os consulta
var mergulho = null;              // a descida pro mapa, ver o "Ver mapa" la embaixo
var ARRASTO = "girar";            // "girar" | "mover" -- ver a barra de ferramentas
var _pf = new THREE.Vector3(), _pd = new THREE.Vector3();
var _raio = new THREE.Raycaster(), _ndc = new THREE.Vector2(), _off = new THREE.Vector3();

/* Na planta 3D, o ponto atingido vira o pivo sem alterar a pose da camera.
   Guarda o deslocamento no referencial da camera, sem mudar os angulos de giro.
   Assim o ponto fica fixo na tela e a camera nao acumula inclinacao lateral. */
function focaNoPonto(e) {
  if (modo !== "planta3d" || ARRASTO !== "girar" || !planta3d) return;
  var cr = cv.getBoundingClientRect();
  if (!cr.width || !cr.height) return;
  _ndc.set(((e.clientX - cr.left) / cr.width) * 2 - 1,
          -((e.clientY - cr.top) / cr.height) * 2 + 1);
  _raio.setFromCamera(_ndc, cam);
  var achou = _raio.intersectObject(planta3d, true);
  if (!achou.length) return;                 // clicou no vazio: pivo fica onde estava
  var posAnterior=cam.position.clone(), rotAnterior=cam.quaternion.clone();
  _off.copy(posAnterior).sub(achou[0].point);
  var d = _off.length();
  if (!(d > cam.near)) return;
  alvo.copy(achou[0].point);
  orb.r  = d;
  deslocamentoPivo.copy(_off).applyQuaternion(rotAnterior.clone().invert()).divideScalar(d);
  // O raio virou escolha de quem clicou; `redim` nao pode reenquadrar por cima dele.
  zoomManual = true;
  // A pose atual fica intacta; poeCam reconstruira a mesma pose no proximo quadro.
}
var dedos = new Map(), ant = null, arr = false, lx = 0, ly = 0;
function medida() { var a = [], it = dedos.values(), v;
  while (!(v = it.next()).done) a.push(v.value);
  return { d: Math.hypot(a[1].x-a[0].x, a[1].y-a[0].y), a: Math.atan2(a[1].y-a[0].y, a[1].x-a[0].x) }; }
cv.addEventListener("pointerdown", function (e) {
  gira = false; mexeu();
/* A dica so vira "ensino de zoom" NA MAQUETE. Ela era trocada em qualquer modo, entao
   o primeiro toque na planta 3D substituia a legenda dela pela promessa "ela volta a
   girar sozinha" -- que nao e verdade ali, e era a unica coisa escrita na tela
   dizendo o contrario do que a planta faz. */
if (modo === "maquete")
  document.getElementById("dica").textContent = TOQUE
    ? "Arraste a maquete para girar · dois dedos aproximam · ela volta a girar sozinha"
    : "Arraste a maquete para girar · roda aproxima · ela volta a girar sozinha";
  if (e.pointerType === "touch") { dedos.set(e.pointerId, {x:e.clientX,y:e.clientY});
    if (dedos.size > 1) { ant = medida(); arr = false;
      try { cv.setPointerCapture(e.pointerId); } catch (err) {} return; } }
  focaNoPonto(e);
  arr = true; lx = e.clientX; ly = e.clientY;
  // A captura e um plus (segura o gesto quando o dedo sai do canvas), nao um
  // requisito. Ela LANCA quando o ponteiro ja nao esta ativo, e sem o try isso abortava
  // o resto do `pointerdown` -- o arrasto simplesmente nao comecava.
  try { cv.setPointerCapture(e.pointerId); } catch (err) {}
});
cv.addEventListener("pointermove", function (e) {
  if (e.pointerType === "touch" && dedos.has(e.pointerId)) {
    dedos.set(e.pointerId, {x:e.clientX,y:e.clientY});
    if (dedos.size > 1) { var m = medida();
      if (ant && m.d > 0) { zoomManual = true;
        orb.r = Math.max(R_MIN, Math.min(R_MAX, orb.r * ant.d / m.d));
        var da = m.a - ant.a;
        if (da > Math.PI) da -= 2*Math.PI; else if (da < -Math.PI) da += 2*Math.PI;
        orb.th += da; }
      ant = m; return; } }
  if (!arr) return;
  if (modo === "visita") {
    /* Dentro da casa o arrasto e OLHAR EM VOLTA, nao girar um objeto: nao ha objeto,
       ha um lugar -- e por isso o eixo vertical aqui NAO e o invertido da maquete.
       O pitch trava antes do zenite pra nao virar de cabeca pra baixo. */
    FP.yaw -= (e.clientX - lx) * 0.004;
    FP.pitch = Math.max(-1.25, Math.min(1.25, FP.pitch - (e.clientY - ly) * 0.004));
    lx = e.clientX; ly = e.clientY;
    return;
  }
  if (ARRASTO === "mover") {
    // Desloca a camera no plano da tela para a planta acompanhar o ponteiro.
    var esc_ = 2 * orb.r * Math.tan(cam.fov * Math.PI / 360) / (caixa.clientHeight || 1);
    cam.updateMatrixWorld();
    _pd.setFromMatrixColumn(cam.matrixWorld,0);
    _pf.setFromMatrixColumn(cam.matrixWorld,1);
    alvo.addScaledVector(_pd, -(e.clientX - lx) * esc_);
    alvo.addScaledVector(_pf,  (e.clientY - ly) * esc_);
    zoomManual = true;
    lx = e.clientX; ly = e.clientY;
    return;
  }
  orb.th -= (e.clientX - lx) * 0.0085;
  /* VERTICAL INVERTIDO a pedido. Agora arrastar pra BAIXO sobe a camera: e como se a
     mao pegasse a face da frente do predio e a puxasse pra baixo, trazendo o topo pra
     ca. E a convencao de visualizador de OBJETO; a de antes era a de camera em
     primeira pessoa (arrasta pra baixo, olha pra baixo), que aqui nao faz sentido
     porque ninguem esta dentro de nada.

     A faixa tambem abriu: sem terreno nao ha mais em que a camera afunde, entao da
     pra passar do horizonte e olhar a maquete por baixo. */
  /* Ate o ZENITE. O piso era 0,28 rad porque o `up` do mundo quebrava no polo; com o
     up da orbita (ver `poeCam`) ele nao quebra mais. E o zero e util: quem arrasta ate
     o fim para EXATAMENTE em 0, que e a vista de planta baixa -- o limite faz o papel
     de encaixe, sem precisar de mira. */
  orb.ph = Math.max(0, Math.min(2.20, orb.ph - (e.clientY - ly) * 0.0065));
  lx = e.clientX; ly = e.clientY;
});
function solta(e) { arr = false; ant = null;
  if (e && e.pointerId != null) { dedos.delete(e.pointerId);
    try { if (cv.hasPointerCapture(e.pointerId)) cv.releasePointerCapture(e.pointerId); }
    catch (err) {} } }
cv.addEventListener("pointerup", solta);
cv.addEventListener("pointercancel", solta);
// Toque longo no canvas abre o menu de contexto do sistema no meio do giro.
cv.addEventListener("contextmenu", function (e) { e.preventDefault(); });
cv.addEventListener("wheel", function (e) {
  e.preventDefault(); gira = false; mexeu(); zoomManual = true;
  orb.r = Math.max(R_MIN, Math.min(R_MAX, orb.r * (1 + Math.sign(e.deltaY) * 0.1)));
}, { passive: false });

/* ============================================================
   OS QUATRO MODOS
   ============================================================
   Predio, planta 2D, planta 3D e visita -- o mesmo imovel, quatro leituras. Duas
   decisoes valem nota antes do codigo:

   - PAREDE NAO E DADO DE ENTRADA, E DERIVADA. O cadastro declara COMODO (poligono com
     nome), e a parede sai de toda fronteira entre donos diferentes numa grade de 5 cm.
     E a mesma regra do renderizador (`paredesDaGrade`, no app.js), e ela existe por
     tres motivos: e o que a imagem de uma planta de fato entrega (area rotulada, nao
     espessura de alvenaria); sobrevive a um poligono que nao fecha em angulo reto; e
     dispensa declarar contorno externo, que e a parte que planta de anuncio nao
     desenha por inteiro.

   - OS QUATRO MODOS DIVIDEM UMA CENA SO. Trocar de modo troca a VISIBILIDADE de dois
     grupos e o jeito de posicionar a camera. Nao ha segunda cena, segundo renderizador
     nem remontagem: a planta 3D e construida uma vez, na primeira vez que alguem
     pedir, e a visita e a mesma planta com a camera na altura dos olhos.        */

var PL = D.planta, PD = PL.pe_direito;
var ESP = 0.13;                 // espessura de parede interna
var OLHO = 1.62, RAIO_CORPO = 0.20;

/* ---- parede a partir dos comodos ---------------------------------------- */
function derivaParedes() {
  var G = 0.05, C = PL.comodos;
  var x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
  for (var i = 0; i < C.length; i++) for (var j = 0; j < C[i].poly.length; j++) {
    var p = C[i].poly[j];
    if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0];
    if (p[1] < z0) z0 = p[1]; if (p[1] > z1) z1 = p[1];
  }
  x0 -= G; z0 -= G; x1 += G; z1 += G;
  var NX = Math.ceil((x1-x0)/G), NZ = Math.ceil((z1-z0)/G);
  var dono = new Int16Array(NX*NZ).fill(-1);
  for (var a = 0; a < NX; a++) for (var b = 0; b < NZ; b++) {
    var px = x0 + (a+0.5)*G, pz = z0 + (b+0.5)*G;
    for (var k = 0; k < C.length; k++)
      if (dentro(C[k].poly, px, pz)) { dono[a*NZ+b] = k; break; }
  }
  // Toda fronteira entre donos diferentes vira parede -- comodo x comodo, ou comodo x
  // lado de fora. Corridas contiguas viram UM segmento, senao seriam 5 cm por peca.
  var brutos = [];
  for (var a2 = 0; a2 < NX-1; a2++) { var j2 = 0;
    while (j2 < NZ) {
      if (dono[a2*NZ+j2] === dono[(a2+1)*NZ+j2]) { j2++; continue; }
      var jA = j2;
      while (j2 < NZ && dono[a2*NZ+j2] !== dono[(a2+1)*NZ+j2]) j2++;
      brutos.push([[x0+(a2+1)*G, z0+jA*G], [x0+(a2+1)*G, z0+j2*G]]);
    } }
  for (var b2 = 0; b2 < NZ-1; b2++) { var i2 = 0;
    while (i2 < NX) {
      if (dono[i2*NZ+b2] === dono[i2*NZ+b2+1]) { i2++; continue; }
      var iA = i2;
      while (i2 < NX && dono[i2*NZ+b2] !== dono[i2*NZ+b2+1]) i2++;
      brutos.push([[x0+iA*G, z0+(b2+1)*G], [x0+i2*G, z0+(b2+1)*G]]);
    } }

  // Cada vao vai pra UMA parede: a mais perto. Porta em canto de dois comodos ficaria
  // perto de duas paredes perpendiculares e abriria buraco nas duas.
  var vaos = [];
  for (var q = 0; q < PL.portas.length; q++)
    vaos.push({ p: PL.portas[q].p, larg: PL.portas[q].largura, porta: true, y0: 0, y1: 2.10 });
  for (var w = 0; w < PL.janelas.length; w++)
    vaos.push({ p: PL.janelas[w].p, larg: PL.janelas[w].largura, porta: false, y0: 1.00, y1: 2.20 });
  var doVao = brutos.map(function () { return []; });
  for (var v = 0; v < vaos.length; v++) {
    var melhor = -1, dm = 0.35, pr = null;
    for (var n = 0; n < brutos.length; n++) {
      var pj = projeta(vaos[v].p, brutos[n][0], brutos[n][1]);
      if (pj.d < dm) { dm = pj.d; melhor = n; pr = pj; }
    }
    if (melhor < 0) continue;
    var meia = vaos[v].larg / 2;
    doVao[melhor].push({ src: vaos[v], a: Math.max(0, pr.t - meia),
                         b: Math.min(pr.L, pr.t + meia) });
  }

  var out = [], postos = [];
  for (var m = 0; m < brutos.length; m++) {
    var A = brutos[m][0], B = brutos[m][1];
    var L = Math.hypot(B[0]-A[0], B[1]-A[1]);
    if (L < G*1.5) continue;
    var ux = (B[0]-A[0])/L, uz = (B[1]-A[1])/L;
    var pt = function (t) { return [A[0] + ux*t, A[1] + uz*t]; };
    var vs = doVao[m].filter(function (o) { return o.b - o.a > 0.15; })
                     .sort(function (o, r) { return o.a - r.a; });
    var t0 = 0;
    for (var y = 0; y < vs.length; y++) {
      var vv = vs[y];
      if (vv.a - t0 > 0.06) out.push({ a: pt(t0), b: pt(vv.a), y0: 0, y1: PD });
      // Peitoril e verga: o que sobra de parede embaixo e em cima do vao.
      if (vv.src.y0 > 0.06) out.push({ a: pt(vv.a), b: pt(vv.b), y0: 0, y1: vv.src.y0 });
      if (vv.src.y1 < PD - 0.06) out.push({ a: pt(vv.a), b: pt(vv.b), y0: vv.src.y1, y1: PD });
      postos.push({ a: pt(vv.a), b: pt(vv.b), y0: vv.src.y0, y1: vv.src.y1,
                    porta: vv.src.porta, ux: ux, uz: uz });
      t0 = Math.max(t0, vv.b);
    }
    if (L - t0 > 0.06) out.push({ a: pt(t0), b: pt(L), y0: 0, y1: PD });
  }
  return { paredes: out, vaos: postos };
}
function projeta(p, a, b) {
  var dx = b[0]-a[0], dz = b[1]-a[1], L = Math.hypot(dx, dz) || 1e-6;
  var t = ((p[0]-a[0])*dx + (p[1]-a[1])*dz) / (L*L);
  var tc = t < 0 ? 0 : t > 1 ? 1 : t;
  return { t: tc*L, L: L, d: Math.hypot(a[0]+dx*tc - p[0], a[1]+dz*tc - p[1]) };
}
var PAREDES = null;
function paredes() { if (!PAREDES) PAREDES = derivaParedes(); return PAREDES; }

// Extensao da planta, pra enquadrar e pra centrar o desenho 2D.
var PB = (function () {
  var x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
  for (var i = 0; i < PL.comodos.length; i++) for (var j = 0; j < PL.comodos[i].poly.length; j++) {
    var p = PL.comodos[i].poly[j];
    if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0];
    if (p[1] < z0) z0 = p[1]; if (p[1] > z1) z1 = p[1];
  }
  return { x0:x0, x1:x1, z0:z0, z1:z1, cx:(x0+x1)/2, cz:(z0+z1)/2, w:x1-x0, h:z1-z0 };
})();

/* ============================================================
   O INTERIOR E O DO RENDERIZADOR, nao um parecido
   ============================================================
   Ate aqui esta pagina derivava parede sozinha (`derivaParedes`), desenhava janela como
   caixa de vidro e nao tinha bake. Isso era uma SEGUNDA verdade sobre a mesma planta --
   e media 22 niveis de variacao numa parede onde o renderizador mede 26 a 33, sem
   textura, sem rodape e sem esquadria.

   Aqui os nove modulos do interior entram com os contratos que ja tem. A ordem das
   chamadas e a unica coisa que esta pagina decide, e ela e ditada pelas dependencias:
   geometria -> texturas -> materiais -> esquadrias -> planta -> bake -> atlas -> casa.

   O QUE ESTA PAGINA FORNECE no lugar do mapa: `rec`, o registro de edificacao. No mapa
   ele vem do `anelDoLote`, que precisa de projecao lat/lon; aqui o predio ja mora na
   origem, entao o anel do bloco PRINCIPAL e o registro -- e a projecao nao entra. */
var MG = MapGeometry;

/* O CHAO SUMIA AQUI, E SEM UMA LINHA NO CONSOLE.

   `MapGeometry.triangulateRing` recebe TRES argumentos: o anel, o earcut e um recuo
   pra quando nao houver earcut. Esta pagina passava a funcao CRUA adiante, e o
   `house-mesh.js` a chama com um argumento so -- entao `fallback` chegava `undefined`
   e a chamada lancava "fallback is not a function" em TODO comodo.

   E o `piso()` do house-mesh engole a excecao (`catch (e) { return; }`), porque ali
   ela significa "poligono degenerado, pula este comodo". Com ela lancando sempre, o
   resultado nao foi erro: foi a planta 3D e a visita 3D SEM CHAO NENHUM, com parede,
   esquadria e movel intactos. Medido: 0 dos 9 comodos triangulava.

   O renderizador sempre embrulhou (app.js:153); o que faltava aqui era a embalagem.
   Sem earcut de proposito -- sao 7 KB por uma planta de 9 comodos, e o recuo do
   proprio three, que ja esta embutido, da conta desse tamanho. */
var triangulaAnel = function (r) {
  return MG.triangulateRing(r, typeof earcut === "function" ? earcut : null,
    function (anel) {
      return THREE.ShapeUtils.triangulateShape(
        anel.map(function (p) { return new THREE.Vector2(p[0], p[1]); }), []);
    });
};
var ESP = 0.13, PD_INT = 2.70, OLHO = 1.62, BUILDING_INSET = 0.50;

/* O ambiente refletido, sem arquivo: material PBR sem ambiente e material morto --
   `metalness` alto sem nada pra refletir fica PRETO, e porcelanato liso sem ceu fica
   fosco. Degrade equirretangular num canvas, passado pelo PMREM. */
var ambientePBR = (function () {
  var c = document.createElement("canvas");
  c.width = 256; c.height = 128;
  var g2 = c.getContext("2d");
  var grd = g2.createLinearGradient(0, 0, 0, 128);
  grd.addColorStop(0.00, "#E8F0FA"); grd.addColorStop(0.42, "#CFDCEA");
  grd.addColorStop(0.52, "#FBF3E4"); grd.addColorStop(0.68, "#B7AFA3");
  grd.addColorStop(1.00, "#6E665C");
  g2.fillStyle = grd; g2.fillRect(0, 0, 256, 128);
  var tx = new THREE.CanvasTexture(c);
  tx.mapping = THREE.EquirectangularReflectionMapping;
  var pm = new THREE.PMREMGenerator(ren);
  var env = pm.fromEquirectangular(tx).texture;
  pm.dispose(); tx.dispose();
  return env;
})();

/* A cor do acabamento e SATURADA antes de virar vertice, na medida do que o ACES vai
   tirar dela: a parede declarada #D9D2C7 chega na tela com 40% menos croma. Nao e
   enfeite -- e devolver a cor que a pessoa amostrou da foto do anuncio. */
var CROMA_ACES = 1.45, _hsl = {h:0, s:0, l:0};
var rgbAcabamento = function (hex) {
  _corAux.setHex(hex); _corAux.getHSL(_hsl);
  _corAux.setHSL(_hsl.h, Math.min(1, _hsl.s * CROMA_ACES), _hsl.l);
  return [Math.round(_corAux.r*255), Math.round(_corAux.g*255), Math.round(_corAux.b*255)];
};

/* ---- O CATALOGO DE MOVEIS, reaproveitado do renderizador ------------------
   `furniture-param.js` e `furniture-catalog.js` entram inteiros, com os contratos que
   ja tem. O que esta pagina fornece e so o minimo que eles pedem: o conversor de cor,
   o material e a biblioteca. Nao entra o `furniture-instances.js`: ele e o EDITOR
   (salvar, mover, recolorir), e aqui a mobilia e fixa -- a do cadastro. */
var _corAux = new THREE.Color();
var rgbDe = function (hex) {
  _corAux.setHex(hex);
  return [Math.round(_corAux.r*255), Math.round(_corAux.g*255), Math.round(_corAux.b*255)];
};
// Um material so pra mobilia inteira: a cor de cada peca viaja no VERTICE (e o que o
// `geoDeParts` e a biblioteca do Blender produzem), entao 25 moveis continuam sendo
// poucas chamadas em vez de 25 materiais.
var matMovel = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78,
                                                metalness: 0.04, envMapIntensity: 0.45 });
var FURN = null;
/* v4: O INTERIOR E MONTADO SOB DEMANDA. Catalogo de moveis, texturas, materiais, planta e
   editor saiam todos na abertura -- inclusive para quem so olhou o predio e foi embora.
   `iniciaInterior` roda uma vez, quando o pacote do interior (modulos + biblioteca de
   moveis + atlas do Unreal) termina de chegar (`garanteInterior`, mais abaixo). A ordem
   das chamadas la dentro e a mesma de antes. */
function criaCatalogo() {
try {
  var _fp = FurnitureParam.create({ THREE: THREE, getLib: function () { return FURN ? FURN.MOVEIS_LIB : {}; },
                                    rgbDe: rgbDe });
  FURN = FurnitureCatalog.create({ THREE: THREE, document: document, rgbDe: rgbDe,
    geoDeParts: _fp.geoDeParts, getMaterial: function () { return matMovel; },
    armarioParam: _fp.armarioParam, bancadaParam: _fp.bancadaParam, aereoParam: _fp.aereoParam,
    ripadoParam: _fp.ripadoParam, rackParam: _fp.rackParam, tvParam: _fp.tvParam,
    boxParam: _fp.boxParam, maquinaParam: _fp.maquinaParam, sofaParam: _fp.sofaParam });
} catch (e) { console.log("catalogo de moveis indisponivel: " + e); }
}

/* A MOBILIA DO CADASTRO. Cada peca traz tipo, ponto, giro em quartos de volta, medida
   e cor -- o mesmo registro que o mapa 3D consome. `rot` e 0..3 e vale 90 graus cada,
   como no renderizador. Peca de tipo desconhecido e PULADA com aviso, e nao silenciosa:
   catalogo e cadastro evoluem em arquivos diferentes. */
/* A MOBILIA DA PLANTA DO RENDERIZADOR. `plantaDaUnidade` ja recentrou cada peca no
   referencial do predio, entao aqui nao ha deslocamento nenhum a aplicar -- e era
   exatamente o deslocamento em duplicata que poria o sofa dentro da parede. */
function montaMoveisDaPlanta(g) {
  if (!FURN || !PL_R) return 0;
  var n = 0;
  for (var i = 0; i < PL_R.moveis.length; i++) {
    var m = PL_R.moveis[i], def = FURN.MOVEIS[m.tipo];
    if (!def) { console.log("movel sem catalogo: " + m.tipo); continue; }
    var obj = FURN.geoDoMovel(def, m.cor != null ? m.cor : def.cor,
                              { w: m.w || def.b[0], h: m.h || def.b[1], d: m.d || def.b[2] });
    if (!obj) continue;
    /* A peca mora em (u,v), o referencial do OBB da unidade -- o mesmo em que o
       cadastro a escreveu. `W` leva pro mundo e o giro do OBB entra somado ao `rot`
       do cadastro, que e em quartos de volta. Sem a parcela do OBB todo movel de um
       predio fora do eixo do mapa nasceria torto dentro da propria sala. */
    var w2 = PL_R.W(m.u, m.v);
    obj.position.set(w2[0], 0.03, w2[1]);
    // Peca parametrica ja nasce na medida (a malha e outra); o resto escala.
    if (!def.param) obj.scale.set(m.w/def.b[0], m.h/def.b[1], m.d/def.b[2]);
    obj.rotation.y = Math.atan2(-PL_R.ob.uz, PL_R.ob.ux) + (m.rot || 0) * Math.PI/2;
    obj.userData.movel=true;obj.userData.registroMovel=m;g.add(obj); n++;
  }
  return n;
}

function montaMoveis(g) {
  var lista = (PL.moveis || []);
  if (!FURN || !lista.length) return 0;
  var postos = 0;
  for (var i = 0; i < lista.length; i++) {
    var m = lista[i], def = FURN.MOVEIS[m.tipo];
    if (!def) { console.log("movel sem catalogo: " + m.tipo); continue; }
    var cor = (typeof m.cor === "string" && /^#[0-9a-fA-F]{6}$/.test(m.cor))
            ? parseInt(m.cor.slice(1), 16) : def.cor;
    var obj = FURN.geoDoMovel(def, cor, { w: m.w || def.b[0], h: m.h || def.b[1], d: m.d || def.b[2] });
    if (!obj) continue;
    // `alto` marca a peca que nasce PENDURADA (aereo, coifa, ripado, box, cortina): o
    // catalogo ja traz a altura cheia dela, entao ela assenta no chao como as outras --
    // e a propria geometria que sobe. Sem esta distincao o aereo ficava no piso.
    obj.position.set(m.p[0], 0, m.p[1]);
    obj.rotation.y = (m.rot || 0) * Math.PI / 2;
    obj.userData.movel=true;g.add(obj);
    postos++;
  }
  return postos;
}

/* ---- a cadeia do interior, em ordem de dependencia ----------------------- */
var TEX = null, MAT = null, OPEN = null, FP2 = null, BK = null, ATL = null, HM = null;
var PL_R = null, INTERIOR_PRONTO = false;
function iniciaInterior() {
if (INTERIOR_PRONTO) return;
criaCatalogo();
TEX = InteriorTextures.create({ THREE: THREE, document: document });
MAT = InteriorMaterials.create({ THREE: THREE, ambientePBR: ambientePBR,
  texParede: TEX.texParede, texPiso: TEX.texPiso, texMadeira: TEX.texMadeira,
  nrmParede: TEX.nrmParede, nrmPiso: TEX.nrmPiso, nrmMadeira: TEX.nrmMadeira,
  rugParede: TEX.rugParede, rugPiso: TEX.rugPiso, rugMadeira: TEX.rugMadeira });
OPEN = Openings.create({ THREE: THREE, ESP: ESP, rgbDe: rgbDe,
  matEsq: MAT.matEsq, matAlum: MAT.matAlum, matVidro: MAT.matVidro });
FP2 = FloorPlan.create({ inside: MG.inside, shoelace: MG.shoelace, ESP: ESP,
  ESQ_ANG: OPEN.ESQ_ANG, ESQ_MARCO: OPEN.ESQ_MARCO, safeInset: MG.safeInset,
  obbOf: MG.obbOf, BUILDING_INSET: BUILDING_INSET, PD: PD_INT,
  // `anelDoLote` e a ponte com o MAPA (lat/lon -> metros). Aqui o predio ja nasce na
  // origem, entao ela nunca e chamada: `plantaDaUnidade` recebe o `rec` pronto.
  anelDoLote: function () { return null; },
  MOVEIS: FURN ? FURN.MOVEIS : {} });
BK = LightBake.create({ inside: MG.inside, PD: PD_INT });
ATL = LightAtlas.create({ THREE: THREE, document: document, sujaSombra: function () { invalidaSombras(); } });
HM = HouseMesh.create({ THREE: THREE, ESP: ESP, rgbAcabamento: rgbAcabamento,
  triangulateRing: triangulaAnel, prismaQuad: ShellGeometry.prismaQuad,
  quadDoSeg: ShellGeometry.quadDoSeg, cursorDeLuz: ATL.cursorDeLuz,
  texturaDeLuz: ATL.texturaDeLuz, _LUZUE: ATL._LUZUE, BAKE: BK.BAKE,
  bakePrepara: BK.bakePrepara, matParede: MAT.matParede, matFrio: MAT.matFrio,
  matMadeira: MAT.matMadeira, geoDasEsquadrias: OPEN.geoDasEsquadrias });

/* A PLANTA, a mesma do mapa. Daqui saem parede pela grade, esquadria com batente e
   folha, comodo com piso tipado e a mobilia ja recentrada -- e por isso a lista que esta
   pagina montava por conta propria (`derivaParedes`, `montaMoveis`) nao e mais usada
   pela planta 3D nem pela visita. */
try {
  PL_R = D.cadastro ? FP2.plantaDaUnidade(REC_UNI, D.cadastro) : null;
} catch (e) { console.log("planta do renderizador indisponivel: " + e); }
if (PL_R) console.log("planta: " + PL_R.paredes.length + " paredes, " +
                      PL_R.esquadrias.length + " esquadrias, " +
                      PL_R.comodos.length + " comodos, " + PL_R.moveis.length + " moveis");
iniciaEstudoV2();
editorCedros = criaEditorCedros();
INTERIOR_PRONTO = true;
}

/* O PACOTE DO INTERIOR. Codigo dos modulos (um arquivo), biblioteca de moveis e atlas do
   Unreal (JSON) descem juntos, uma vez. Os dois JSON entram como os blocos <script> que
   os modulos sempre leram (`__moveis`, `__luzue`), sem mudar uma linha deles. */
var _interiorP = null;
function garanteInterior() {
  if (!_interiorP) {
    ESTADO.interior = "carregando";
    _interiorP = Promise.all([
      import("./interior-modulos.js"),
      fetch(CFG.assets.moveis).then(function (r) { if (!r.ok) throw Error("moveis " + r.status); return r.text(); }),
      fetch(CFG.assets.luzue).then(function (r) { if (!r.ok) throw Error("luzue " + r.status); return r.text(); })
    ]).then(function (v) {
      ESTADO.tempos.interiorPacote = performance.now();
      [["__moveis", v[1]], ["__luzue", v[2]]].forEach(function (p) {
        var s = document.createElement("script"); s.type = "application/json"; s.id = p[0];
        s.textContent = p[1]; document.body.appendChild(s);
      });
      iniciaInterior();
      ESTADO.tempos.interiorIniciado = performance.now();
      ESTADO.interior = "base";
    }).catch(function (e) {
      _interiorP = null; ESTADO.interior = "parado"; ESTADO.erro = String(e); console.error(e); throw e;
    });
  }
  return _interiorP;
}
/* Pre-carga na INTENCAO: o dedo que encosta no botao da planta ou da visita ja dispara
   o download -- ate o clique se completar, boa parte chegou. Ninguem que so olhou o
   predio paga por isso. */
["pointerdown", "pointerenter", "focus"].forEach(function (t) {
  document.querySelectorAll('#modos [data-modo="planta3d"],#modos [data-modo="visita"]').forEach(function (b) {
    b.addEventListener(t, function () { garanteInterior().catch(function () {}); }, { passive: true });
  });
});

/* O REGISTRO DE EDIFICACAO desta pagina. `plantaDaUnidade` le `rec.r` (o anel), `rec.h`
   (a altura) e `rec.lote` (que decide o recuo da casca e se ha furo na fachada). O anel
   e o do bloco PRINCIPAL, com enrolamento POSITIVO: `plantaDaUnidade` le shoelace > 0
   como "contorno gerado" e recua 0,25 m em vez de 0,50 -- com o sinal trocado a planta
   nasceria maior que a casca. */
var REC_UNI = (function () {
  var r = anel.slice();
  if (MG.shoelace(r) <= 0) r.reverse();
  return { r: r, h: N * LV, lote: true, cx: cx, cz: cz };
})();

/* ---- planta 3D: a mesma parede, extrudada ------------------------------- */
var PISOS = { quente: 0x8E6E4C, frio: 0xA9AFB6 };
var planta3d = null, tetoVisita = null, bakeReserva = null;
var materiaisSemLuz=new WeakMap();
function guardaCoresPlanta(){
  if(D._id!=='monte-dos-cedros-37')return;
  planta3d.traverse(function(o){if(o.isMesh && o.userData.casa && o.geometry.attributes.color){o.userData.geoVisita=o.geometry;o.userData.geoPlanta=o.geometry.clone();}});
}
function luzDaPlanta(plana){ plana=false;
  if(D._id!=='monte-dos-cedros-37'||!planta3d)return;
  planta3d.traverse(function(o){
    if(!o.isMesh)return;
    if(o.userData.materialVisita){o.material=o.userData.materialVisita;if(o.userData.geoVisita)o.geometry=o.userData.geoVisita;}
    if(!plana||!o.material.isMeshStandardMaterial)return;
    var original=o.material,basico=materiaisSemLuz.get(original);
    if(!basico){basico=new THREE.MeshBasicMaterial({color:original.color,map:original.map,vertexColors:original.vertexColors,side:original.side,transparent:original.transparent,opacity:original.opacity,alphaTest:original.alphaTest,depthWrite:original.depthWrite});materiaisSemLuz.set(original,basico);}
    o.userData.materialVisita=original;o.material=basico;
    if(o.userData.geoPlanta)o.geometry=o.userData.geoPlanta;
  });
}
function acabamentoTeto(grupo,pl) {
  var gesso = new THREE.MeshStandardMaterial({color:0xF2EFE8,roughness:0.88});
  var caixaGesso = new THREE.BoxGeometry(1,1,1);
  // Duas faixas em degraus acompanham apenas paredes que chegam ao forro.
  pl.paredes.forEach(function(w){
    if(w.y1 < pl.pd-0.01)return;
    var dx=w.b[0]-w.a[0], dz=w.b[1]-w.a[1], comprimento=Math.hypot(dx,dz);
    [[0.10,0.055,0.0275],[0.055,0.055,0.0825]].forEach(function(f){
      var moldura=new THREE.Mesh(caixaGesso,gesso);
      moldura.name='rodateto';
      moldura.position.set((w.a[0]+w.b[0])/2,pl.pd-f[2],(w.a[1]+w.b[1])/2);
      moldura.rotation.y=Math.atan2(dx,dz);
      moldura.scale.set(ESP+f[0],f[1],comprimento+ESP);
      moldura.receiveShadow=true;grupo.add(moldura);
    });
  });
  // Mesmo plafom de 23 cm e mesmas posicoes do modulo interior/lights.js.
  var calota=new THREE.SphereGeometry(0.115,12,8);calota.scale(1,0.58,1);
  var difusor=new THREE.MeshBasicMaterial({color:0xFFF7E2,toneMapped:false});
  var aro=new THREE.CylinderGeometry(0.13,0.13,0.035,20);
  pl.comodos.forEach(function(c){
    var base=new THREE.Mesh(aro,gesso);base.position.set(c.cx,pl.pd-0.035,c.cz);grupo.add(base);
    var lampada=new THREE.Mesh(calota,difusor);lampada.name='plafon';
    lampada.position.set(c.cx,pl.pd-0.09,c.cz);grupo.add(lampada);
  });
}
function montaTeto(grupo, contornos, altura) {
  tetoVisita = new THREE.Group();
  tetoVisita.name = 'teto-visita';
  var material = new THREE.MeshStandardMaterial({color:0xE6E3DD,emissive:0xE6E3DD,emissiveIntensity:0.3,roughness:0.95,side:THREE.DoubleSide});
  contornos.forEach(function(poly) {
    var forma = new THREE.Shape();
    poly.forEach(function(p,i){if(i)forma.lineTo(p[0],p[1]);else forma.moveTo(p[0],p[1]);});
    forma.closePath();
    var geo = new THREE.ShapeGeometry(forma);
    geo.rotateX(Math.PI/2);
    geo.translate(0,altura,0);
    var malha = new THREE.Mesh(geo,material);
    malha.receiveShadow = true;
    tetoVisita.add(malha);
  });
  tetoVisita.visible = false;
  grupo.add(tetoVisita);
}
function montaPlanta3D() {
  if (planta3d) return planta3d;
  if (!INTERIOR_PRONTO) return null;     // v4: o pacote do interior ainda nao chegou
  var _t0 = performance.now();
  try { return montaPlanta3DAgora(); } finally { ESTADO.tempos.plantaMontada = performance.now(); ESTADO.tempos.plantaMs = ESTADO.tempos.plantaMontada - _t0; }
}
function montaPlanta3DAgora() {
  /* CAMINHO DO RENDERIZADOR. `geoDaCasa` devolve tres malhas (parede, piso frio, piso
     de madeira -- mapas diferentes, materiais diferentes) mais as esquadrias, e deixa
     `BAKE.fila` armada: a oclusao e tracada em fatias, quadro a quadro, e escrita na
     cor por vertice. O laco chama `bakePasso` ate ela fechar. `false` = SEM TETO, pela
     mesma razao da etapa 3 do mapa: com laje por cima a planta vista de fora e uma
     caixa fechada. */
  if (PL_R) {
    var gr = HM.geoDaCasa(PL_R, false, true);
    tetoVisita = new THREE.Group();tetoVisita.name='teto-visita';
    var forroOriginal=gr.getObjectByName('forro-original');
    if(forroOriginal)tetoVisita.add(forroOriginal);
    acabamentoTeto(tetoVisita,PL_R);
    tetoVisita.visible=false;gr.add(tetoVisita);
    gr.position.set(-PL_R.ob.cx, 0, -PL_R.ob.cz);   // a casa mora no centro do predio
    var nm2 = montaMoveisDaPlanta(gr);
    if (nm2) console.log("moveis do cadastro: " + nm2);
    gr.visible = false;
    cena.add(gr);
    planta3d = gr;
    guardaCoresPlanta();
    /* v4: O BAKE DE OCLUSAO NO NAVEGADOR FICA DE RESERVA. Quando ha luz calculada (Cycles)
       para este imovel, ela substitui o resultado do bake em JS -- a luz final usa as
       cores guardadas ANTES dele (`guardaCoresPlanta`) --, entao os segundos de tracado
       eram descartados (medido: 6,5 s no computador antes de a luz comecar a descer).
       A fila so volta se a luz calculada falhar. */
    if (BK.BAKE.fila && CFG.assets.interiorLuz && D._id === 'monte-dos-cedros-37') {
      bakeReserva = BK.BAKE.fila; BK.BAKE.fila = null;
    }
    return gr;
  }

  // CAMINHO ANTIGO, so se o cadastro nao vier (o IMOVEL de exemplo escrito a mao). A
  // parede aqui e derivada nesta pagina, sem textura, sem rodape e sem bake.
  var P = paredes(), g = new THREE.Group();

  // Piso por comodo: e o que da a leitura de "quantos ambientes" numa olhada, e o
  // motivo de o cadastro trazer o TIPO de piso e nao so o nome do comodo.
  for (var i = 0; i < PL.comodos.length; i++) {
    var c = PL.comodos[i], sh = new THREE.Shape();
    sh.moveTo(c.poly[0][0], -c.poly[0][1]);
    for (var j = 1; j < c.poly.length; j++) sh.lineTo(c.poly[j][0], -c.poly[j][1]);
    sh.closePath();
    var gm = new THREE.ShapeGeometry(sh);
    gm.rotateX(Math.PI/2);        // o plano da forma (XY) deita em XZ
    gm.translate(0, 0.02, 0);
    var mp = new THREE.Mesh(gm, new THREE.MeshStandardMaterial({
      color: PISOS[c.piso] || PISOS.frio, roughness: 0.82, metalness: 0.02,
      envMapIntensity: 0.35, side: THREE.DoubleSide }));
    mp.receiveShadow = true;
    g.add(mp);
  }

  /* UMA caixa unitaria, instanciada. Cada parede tem comprimento e angulo proprios, e
     e a MATRIZ da instancia que carrega os dois -- entao 45 trechos de parede custam
     uma chamada de desenho, nao 45. */
  var cx0 = new THREE.BoxGeometry(1, 1, 1);
  var matPar3 = new THREE.MeshStandardMaterial({ color: 0xE6E2DA, roughness: 0.94,
                                                 metalness: 0.01, envMapIntensity: 0.4 });
  var im = new THREE.InstancedMesh(cx0, matPar3, P.paredes.length);
  im.castShadow = im.receiveShadow = true;
  var d3 = new THREE.Object3D();
  for (var k = 0; k < P.paredes.length; k++) {
    var w = P.paredes[k];
    var dx = w.b[0]-w.a[0], dz = w.b[1]-w.a[1], L = Math.hypot(dx, dz);
    d3.position.set((w.a[0]+w.b[0])/2, (w.y0+w.y1)/2, (w.a[1]+w.b[1])/2);
    d3.rotation.set(0, Math.atan2(dx, dz), 0);
    d3.scale.set(ESP, w.y1-w.y0, L + ESP);   // +ESP fecha a junta de canto
    d3.updateMatrix(); im.setMatrixAt(k, d3.matrix);
  }
  im.instanceMatrix.needsUpdate = true;
  g.add(im);

  // Vidro nas janelas; porta fica como VAO ABERTO de proposito -- folha fechada tapa
  // justamente a passagem que a planta existe pra mostrar.
  var jan = P.vaos.filter(function (v) { return !v.porta; });
  if (jan.length) {
    var iv = new THREE.InstancedMesh(cx0, new THREE.MeshStandardMaterial({
      color: 0x9EC4DE, roughness: 0.06, metalness: 0.25, envMapIntensity: 2.0,
      transparent: true, opacity: 0.42 }), jan.length);
    for (var q = 0; q < jan.length; q++) {
      var v2 = jan[q];
      var dx2 = v2.b[0]-v2.a[0], dz2 = v2.b[1]-v2.a[1], L2 = Math.hypot(dx2, dz2);
      d3.position.set((v2.a[0]+v2.b[0])/2, (v2.y0+v2.y1)/2, (v2.a[1]+v2.b[1])/2);
      d3.rotation.set(0, Math.atan2(dx2, dz2), 0);
      d3.scale.set(0.04, v2.y1-v2.y0, L2);
      d3.updateMatrix(); iv.setMatrixAt(q, d3.matrix);
    }
    iv.instanceMatrix.needsUpdate = true;
    g.add(iv);
  }
  montaTeto(g, PL.comodos.map(function(c){return c.poly;}), PD);
  var nm = montaMoveis(g);
  if (nm) console.log("moveis do cadastro: " + nm);

  g.visible = false;
  cena.add(g);
  planta3d = g;
  return g;
}

/* ---- planta 2D: SVG, e nao canvas --------------------------------------- */
// SVG porque a planta e VETOR: ela tem que ficar nitida em qualquer zoom e em
// qualquer densidade de tela, e num canvas 2D isso obrigaria a redesenhar tudo por
// mudanca de dpr. Aqui o navegador cuida.
var p2d = document.getElementById("p2d");
function desenhaPlanta2D() {
  var P = paredes();
  /* A MEDIDA VEM DO PAINEL, e nao do proprio <svg>. `clientWidth` de um elemento SVG
     devolve 0 em Chrome, entao o desenho caia no palpite de 400x260 e saia
     letterboxado dentro de um painel de 474x242. `#cena` e um <div> e mede direito. */
  var b = caixa.getBoundingClientRect();
  var M = 14, w = Math.round(b.width) || 400, h = Math.round(b.height) || 260;
  var esc = Math.min((w - M*2) / PB.w, (h - M*2) / PB.h);
  var ox = w/2 - PB.cx*esc, oy = h/2 - PB.cz*esc;
  var X = function (x) { return (ox + x*esc).toFixed(1); };
  var Y = function (z) { return (oy + z*esc).toFixed(1); };
  var s = ['<rect width="100%" height="100%" fill="none"/>'];

  for (var i = 0; i < PL.comodos.length; i++) {
    var c = PL.comodos[i], pts = [];
    for (var j = 0; j < c.poly.length; j++) pts.push(X(c.poly[j][0]) + "," + Y(c.poly[j][1]));
    s.push('<polygon points="' + pts.join(" ") + '" fill="' +
           (c.piso === "quente" ? "rgba(190,150,105,.17)" : "rgba(150,170,190,.15)") +
           '" stroke="none"/>');
  }
  // Parede como linha GROSSA na espessura real: `stroke-linecap:square` fecha o canto
  // sem precisar de peca de junta.
  var pw = Math.max(1.5, ESP * esc);
  for (var k = 0; k < P.paredes.length; k++) {
    var q = P.paredes[k];
    if (q.y0 > 0.06 && q.y1 < PD - 0.06) continue;      // verga: nao e corte de planta
    if (q.y1 < 1.2) continue;                            // peitoril idem
    s.push('<line x1="' + X(q.a[0]) + '" y1="' + Y(q.a[1]) + '" x2="' + X(q.b[0]) +
           '" y2="' + Y(q.b[1]) + '" stroke="#E7EBF0" stroke-width="' + pw.toFixed(1) +
           '" stroke-linecap="square"/>');
  }
  for (var v = 0; v < P.vaos.length; v++) {
    var o = P.vaos[v];
    if (o.porta) {
      // Porta: o vao aberto mais o arco de abertura -- que e como planta de
      // arquitetura diz "abre pra ca", e o unico desenho que o croqui enviado tinha.
      var dx = o.b[0]-o.a[0], dz = o.b[1]-o.a[1], L = Math.hypot(dx, dz);
      if (L > 1.6) continue;                             // passagem larga nao tem folha
      var r = L * esc;
      s.push('<path d="M ' + X(o.a[0]) + ' ' + Y(o.a[1]) + ' a ' + r.toFixed(1) + ' ' +
             r.toFixed(1) + ' 0 0 1 ' + (dx*esc - dz*esc).toFixed(1) + ' ' +
             (dz*esc + dx*esc).toFixed(1) + '" fill="none" stroke="rgba(231,235,240,.34)" stroke-width="1"/>');
      s.push('<line x1="' + X(o.a[0]) + '" y1="' + Y(o.a[1]) + '" x2="' +
             (parseFloat(X(o.a[0])) - dz*esc).toFixed(1) + '" y2="' +
             (parseFloat(Y(o.a[1])) + dx*esc).toFixed(1) +
             '" stroke="rgba(231,235,240,.6)" stroke-width="1.4"/>');
    } else {
      s.push('<line x1="' + X(o.a[0]) + '" y1="' + Y(o.a[1]) + '" x2="' + X(o.b[0]) +
             '" y2="' + Y(o.b[1]) + '" stroke="#6FC6F5" stroke-width="' +
             Math.max(1.2, pw*0.5).toFixed(1) + '" stroke-linecap="butt"/>');
    }
  }
  /* O ROTULO CABE NO COMODO -- ou nao e escrito.

     A versao anterior punha o nome na MEDIA DOS VERTICES, com corpo `esc*0.42` igual
     pra todo mundo. Os dois erram, e erram junto: numa area de servico de 1,4 m o nome
     saia inteiro pra fora do desenho, e num comodo em L a media dos vertices cai FORA
     do proprio comodo -- era isso que o remendo `if (nome === "Sala") sx += 2`
     corrigia, com um numero escrito a mao que so valia pra uma planta. No cadastro do
     Wish esse mesmo remendo nao pegava, e "Estar/Jantar" ia parar em cima do Hall.

     Aqui o ponto e o de MAIOR FOLGA ate a parede mais proxima, amostrado na caixa do
     comodo. Ele esta sempre dentro (so pontos interiores entram), funciona em L e em
     U sem caso especial, e a folga que o elegeu e tambem a largura disponivel: o corpo
     encolhe ate caber nela. Se nem no menor corpo couber, o nome sai e fica so a area
     -- que e a informacao que uma planta deve e que a anterior nao dava. */
  function folgaMax(poly) {
    var x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9, i;
    for (i = 0; i < poly.length; i++) {
      x0 = Math.min(x0, poly[i][0]); x1 = Math.max(x1, poly[i][0]);
      z0 = Math.min(z0, poly[i][1]); z1 = Math.max(z1, poly[i][1]);
    }
    var meio = { x:(x0+x1)/2, z:(z0+z1)/2, d:0 };
    var passo = Math.max(x1-x0, z1-z0) / 22;
    if (!(passo > 0)) return meio;
    var melhor = null, x, z;
    for (x = x0 + passo/2; x < x1; x += passo)
      for (z = z0 + passo/2; z < z1; z += passo) {
        if (!dentro(poly, x, z)) continue;
        var d = 1e9;
        for (i = 0; i < poly.length; i++) {
          var a = poly[i], b = poly[(i+1) % poly.length];
          var vx = b[0]-a[0], vz = b[1]-a[1], L2 = vx*vx + vz*vz;
          var t = L2 ? Math.max(0, Math.min(1, ((x-a[0])*vx + (z-a[1])*vz) / L2)) : 0;
          d = Math.min(d, Math.hypot(a[0] + vx*t - x, a[1] + vz*t - z));
        }
        if (!melhor || d > melhor.d) melhor = { x:x, z:z, d:d };
      }
    return melhor || meio;
  }
  // O nome vem do cadastro: `&` ou `<` num nome de comodo quebraria o SVG inteiro,
  // porque `innerHTML` de um <svg> e analisado como marcacao.
  function esc_(t) {
    return String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  for (var n = 0; n < PL.comodos.length; n++) {
    var cc = PL.comodos[n], p = folgaMax(cc.poly);
    var nome = esc_(cc.nome);
    var area = cc.area || Math.abs(MG.shoelace(cc.poly)) / 2;
    // 0,54 em por caractere e a largura media da system-ui em caixa mista. Ela erra
    // pra MAIS em caixa alta, que e o lado seguro pra quem so quer saber se cabe.
    var largura = 2 * p.d * esc * 0.90;
    var fs = Math.min(esc * 0.40, largura / (0.54 * nome.length), p.d * esc * 0.80);
    var comNome = fs >= 6.5;
    fs = Math.max(6.5, Math.min(fs, 20));
    var fa = Math.max(6, fs * 0.74);
    var yb = parseFloat(Y(p.z)) + (comNome ? -fs*0.08 : fa*0.36);
    if (comNome)
      s.push('<text x="' + X(p.x) + '" y="' + yb.toFixed(1) + '" text-anchor="middle" ' +
             'font-family="system-ui,sans-serif" font-size="' + fs.toFixed(1) +
             '" fill="rgba(231,235,240,.82)">' + nome + '</text>');
    // A area so entra se houver ALTURA pra segunda linha: em banho de 1,2 m ela
    // encostaria no nome, e duas linhas empilhadas ilegiveis sao piores que uma.
    if (area > 0.4 && fa * 3.6 < 2 * p.d * esc)
      s.push('<text x="' + X(p.x) + '" y="' + (yb + fa*1.18).toFixed(1) + '" text-anchor="middle" ' +
             'font-family="system-ui,sans-serif" font-size="' + fa.toFixed(1) +
             '" fill="rgba(231,235,240,.48)">' + area.toFixed(1).replace(".", ",") +
             ' m²</text>');
  }
  /* A ESCALA. Sem ela a planta diz a FORMA e esconde o TAMANHO -- e tamanho e a
     pergunta que leva alguem a abrir uma planta. Barra e nao cota escrita: a cota em
     pixel mente assim que a janela muda de largura (e aqui ela muda, o desenho e
     refeito a cada `redim`), a barra e redesenhada na mesma escala do traco. Passo
     redondo mais proximo de 1/5 da largura util. */
  var alvo_ = (w - M*2) * 0.2, passos = [1, 2, 5, 10, 20], pm = passos[0], pi;
  for (pi = 0; pi < passos.length; pi++) if (passos[pi] * esc <= alvo_) pm = passos[pi];
  var bx = M + 2, by = h - M - 5, bw = pm * esc, cinza = 'rgba(231,235,240,.45)';
  s.push('<path d="M ' + bx + ' ' + (by-4) + ' V ' + (by+4) + ' M ' + bx + ' ' + by +
         ' H ' + (bx+bw).toFixed(1) + ' M ' + (bx+bw).toFixed(1) + ' ' + (by-4) +
         ' V ' + (by+4) + '" fill="none" stroke="' + cinza + '" stroke-width="1.5"/>');
  s.push('<text x="' + (bx + bw/2).toFixed(1) + '" y="' + (by-8) + '" text-anchor="middle" ' +
         'font-family="system-ui,sans-serif" font-size="10" fill="' + cinza + '">' +
         pm + ' m</text>');
  p2d.setAttribute("viewBox", "0 0 " + w + " " + h);
  p2d.innerHTML = s.join("");
}

/* ---- visita: primeira pessoa dentro da planta --------------------------- */
var FP = { x:0, z:0, yaw:0, pitch:-0.05, mx:0, mz:0 };
var obstaculosMoveis = null;
function preparaObstaculos() {
  if(obstaculosMoveis || !planta3d)return;
  obstaculosMoveis=[];planta3d.updateMatrixWorld(true);
  planta3d.children.forEach(function(obj){
    if(!obj.userData.movel)return;
    var inversa=obj.matrixWorld.clone().invert(),caixa=new THREE.Box3();
    obj.traverse(function(mesh){
      if(!mesh.isMesh||!mesh.geometry)return;
      mesh.geometry.computeBoundingBox();
      var mundo=mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld);
      if(mundo.max.y<0.12||mundo.min.y>OLHO+0.15)return;
      caixa.union(mesh.geometry.boundingBox.clone().applyMatrix4(inversa.clone().multiply(mesh.matrixWorld)));
    });
    if(caixa.isEmpty())return;
    var escala=new THREE.Vector3();obj.getWorldScale(escala);
    obstaculosMoveis.push({caixa:caixa,inversa:inversa,rx:RAIO_CORPO/Math.abs(escala.x),rz:RAIO_CORPO/Math.abs(escala.z)});
  });
}
var pontoColisao=new THREE.Vector3();
function livreDosMoveis(x,z) {
  preparaObstaculos();
  return !(obstaculosMoveis||[]).some(function(o){
    pontoColisao.set(x,0,z).applyMatrix4(o.inversa);
    return pontoColisao.x>o.caixa.min.x-o.rx && pontoColisao.x<o.caixa.max.x+o.rx && pontoColisao.z>o.caixa.min.z-o.rz && pontoColisao.z<o.caixa.max.z+o.rz;
  });
}
function livre(x, z) {
  var P = paredes(), lim = ESP/2 + RAIO_CORPO;
  for (var i = 0; i < P.paredes.length; i++) {
    var w = P.paredes[i];
    if (w.y0 >= 1.2) continue;                 // verga e bandeira passam por cima
    var ax = w.a[0], az = w.a[1], dx = w.b[0]-ax, dz = w.b[1]-az;
    var L2 = dx*dx + dz*dz || 1;
    var t = ((x-ax)*dx + (z-az)*dz) / L2;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    var px = ax + dx*t - x, pz = az + dz*t - z;
    if (px*px + pz*pz < lim*lim) return false;
  }
  return dentroDaPlanta(x, z) && livreDosMoveis(x,z);
}
function dentroDaPlanta(x, z) {
  for (var i = 0; i < PL.comodos.length; i++)
    if (dentro(PL.comodos[i].poly, x, z)) return true;
  return false;
}
/* ONDE A VISITA COMECA.

   Duas escolhas, e nenhuma e "o centro da maior sala".

   1. O COMODO e a SALA, e nao o maior. Num apartamento a suite costuma ser o maior
      ambiente, e abrir a visita dentro do quarto de casal e estranho.
   2. O PONTO e o de maior FOLGA dentro dela. Nascer no centro geometrico parece obvio
      e e ruim: num comodo em L o centro cai atras de uma parede, e num retangulo ele
      poe a camera a um metro da parede de fundo. Aqui o ponto e o mais longe de
      qualquer parede -- que e onde uma pessoa de fato para pra olhar um comodo.
   3. A MIRA e a linha de visao mais LONGA que existe desse ponto. Mirar no centro do
      comodo aponta pra parede mais perto; a linha mais longa costuma varrer sala e
      jantar de ponta a ponta, que e o que se mostra pra quem chega. */
function folga(x, z) {
  var P = paredes(), d = 1e9;
  for (var i = 0; i < P.paredes.length; i++) {
    var w = P.paredes[i];
    if (w.y0 >= 1.2) continue;
    var ax = w.a[0], az = w.a[1], dx = w.b[0]-ax, dz = w.b[1]-az;
    var L2 = dx*dx + dz*dz || 1;
    var t = ((x-ax)*dx + (z-az)*dz) / L2;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    d = Math.min(d, Math.hypot(ax + dx*t - x, az + dz*t - z));
  }
  return d;
}
function visivel(x, z) {
  var P = paredes();
  if (!dentroDaPlanta(x, z)) return false;
  for (var i = 0; i < P.paredes.length; i++) {
    var w = P.paredes[i];
    if (w.y0 > OLHO || w.y1 < OLHO) continue;      // verga e peitoril nao tapam a vista
    var ax = w.a[0], az = w.a[1], dx = w.b[0]-ax, dz = w.b[1]-az;
    var L2 = dx*dx + dz*dz || 1;
    var t = ((x-ax)*dx + (z-az)*dz) / L2;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    var px = ax + dx*t - x, pz = az + dz*t - z;
    if (px*px + pz*pz < (ESP/2 + 0.03)*(ESP/2 + 0.03)) return false;
  }
  return true;
}
function melhorDirecao(x, z) {
  var bdx = 0, bdz = -1, best = -1;
  for (var k = 0; k < 24; k++) {
    var a = k * Math.PI / 12, dx = Math.sin(a), dz = Math.cos(a), t = 0.3;
    while (t < 18 && visivel(x + dx*t, z + dz*t)) t += 0.3;
    if (t > best) { best = t; bdx = dx; bdz = dz; }
  }
  return Math.atan2(-bdx, -bdz);     // a camera olha em -Z girado por yaw
}
function pontoDeEntrada() {
  var sala = null;
  for (var i = 0; i < PL.comodos.length; i++)
    if (/^(sala|estar|living)/i.test(PL.comodos[i].nome)) { sala = PL.comodos[i]; break; }
  if (!sala) sala = PL.comodos[PL.comodos.length-1];
  var bx0 = 1e9, bx1 = -1e9, bz0 = 1e9, bz1 = -1e9;
  for (var j = 0; j < sala.poly.length; j++) {
    var p = sala.poly[j];
    if (p[0] < bx0) bx0 = p[0]; if (p[0] > bx1) bx1 = p[0];
    if (p[1] < bz0) bz0 = p[1]; if (p[1] > bz1) bz1 = p[1];
  }
  var melhor = null, score = -1;
  for (var x = bx0 + 0.3; x < bx1; x += 0.3)
    for (var z = bz0 + 0.3; z < bz1; z += 0.3) {
      // `dentro(sala.poly)` e nao `dentroDaPlanta`: a sala e um hexagono que passa por
      // cima do banho e da cozinha (ver a nota da ordem dos comodos), entao o teste
      // tem que ser o do comodo E o de estar livre de parede e de outro ambiente.
      if (!dentro(sala.poly, x, z) || !livre(x, z)) continue;
      var f = folga(x, z);
      if (f > score) { score = f; melhor = [x, z]; }
    }
  return melhor || [(bx0+bx1)/2, (bz0+bz1)/2];
}
/* Caminhada por destino. Coordenadas locais da planta centralizada. */
var caminhada = { rota:[], indice:0, marca:null };
function cancelaCaminhada() {
  if(caminhada.rota.length && typeof DICAS!=='undefined')document.getElementById('dica').textContent=DICAS.visita;
  caminhada.rota=[];
  if(caminhada.marca)caminhada.marca.visible=false;
}
function trechoLivre(a,b) {
  var n=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/0.07));
  for(var i=0;i<=n;i++)if(!livre(a.x+(b.x-a.x)*i/n,a.z+(b.z-a.z)*i/n))return false;
  return true;
}
function caminhoAte(destino) {
  var inicio={x:FP.x,z:FP.z};
  if(!livre(destino.x,destino.z))return [];
  if(trechoLivre(inicio,destino))return [destino];
  var passo=0.09, nx=Math.ceil(PB.w/passo)+1,nz=Math.ceil(PB.h/passo)+1;
  var pontos=[],pais=new Int32Array(nx*nz);pais.fill(-2);
  for(var z=0;z<nz;z++)for(var x=0;x<nx;x++){
    var p={x:PB.x0+x*passo,z:PB.z0+z*passo};
    pontos.push(livre(p.x,p.z)?p:null);
  }
  var fila=[];
  pontos.forEach(function(p,i){if(p && Math.hypot(p.x-inicio.x,p.z-inicio.z)<passo*2 && trechoLivre(inicio,p)){pais[i]=-1;fila.push(i);}});
  var fim=-1;
  for(var k=0;k<fila.length;k++){
    var id=fila[k],p=pontos[id];
    if(Math.hypot(p.x-destino.x,p.z-destino.z)<passo*2 && trechoLivre(p,destino)){fim=id;break;}
    for(var dz=-1;dz<=1;dz++)for(var dx=-1;dx<=1;dx++){
      if(!dx&&!dz)continue;
      var xx=id%nx+dx,zz=Math.floor(id/nx)+dz,j=zz*nx+xx;
      if(xx<0||xx>=nx||zz<0||zz>=nz||pais[j]!==-2||!pontos[j])continue;
      if(trechoLivre(p,pontos[j])){pais[j]=id;fila.push(j);}
    }
  }
  if(fim<0)return [];
  var bruta=[destino];for(var j=fim;j>=0;j=pais[j])bruta.unshift(pontos[j]);
  var rota=[],origem=inicio;
  for(var i=0;i<bruta.length;){var j=bruta.length-1;while(j>i&&!trechoLivre(origem,bruta[j]))j--;rota.push(bruta[j]);origem=bruta[j];i=j+1;}
  return rota;
}
var materialRota=new THREE.MeshBasicMaterial({color:0x999D9F,transparent:true,opacity:0.8,side:THREE.DoubleSide,depthWrite:false});
var geoBolinha=new THREE.CircleGeometry(0.035,12),geoCirculo=new THREE.RingGeometry(0.17,0.205,40);
geoBolinha.rotateX(-Math.PI/2);geoCirculo.rotateX(-Math.PI/2);
var formaSeta=new THREE.Shape();formaSeta.moveTo(0,0.1);formaSeta.lineTo(-0.07,-0.06);formaSeta.lineTo(0,-0.025);formaSeta.lineTo(0.07,-0.06);formaSeta.closePath();
var geoSeta=new THREE.ShapeGeometry(formaSeta);geoSeta.rotateX(-Math.PI/2);
function iniciaCaminhada(destino) {
  var rota=caminhoAte(destino);
  cancelaCaminhada();
  if(!rota.length){document.getElementById('dica').textContent='Escolha um ponto livre no chão, com passagem até ele.';return false;}
  if(caminhada.marca)cena.remove(caminhada.marca);
  var grupo=new THREE.Group();grupo.name='destino-caminhada';cena.add(grupo);caminhada.marca=grupo;
  function marca(geo,p){var mesh=new THREE.Mesh(geo,materialRota);mesh.position.set(p.x,0.045,p.z);grupo.add(mesh);return mesh;}
  marca(geoCirculo,destino);
  var anterior=rota.length>1?rota[rota.length-2]:{x:FP.x,z:FP.z};
  var dx=destino.x-anterior.x,dz=destino.z-anterior.z,L=Math.hypot(dx,dz)||1;
  var seta=marca(geoSeta,{x:destino.x-dx/L*0.32,z:destino.z-dz/L*0.32});seta.rotation.y=Math.atan2(-dx,-dz);
  var a={x:FP.x,z:FP.z};
  rota.forEach(function(b){var d=Math.hypot(b.x-a.x,b.z-a.z);for(var t=0.25;t<d-0.22;t+=0.28)marca(geoBolinha,{x:a.x+(b.x-a.x)*t/d,z:a.z+(b.z-a.z)*t/d});a=b;});
  caminhada.rota=rota;caminhada.indice=0;
  document.getElementById('dica').textContent='Indo até o círculo · arraste para olhar · controles de movimento para parar';
  return true;
}
function passoAutomatico(dt) {
  if(!caminhada.rota.length)return;
  var alvo=caminhada.rota[caminhada.indice],dx=alvo.x-FP.x,dz=alvo.z-FP.z,d=Math.hypot(dx,dz),passo=Math.min(d,1.4*Math.min(0.05,dt));
  var novo={x:FP.x+dx/(d||1)*passo,z:FP.z+dz/(d||1)*passo};
  if(!trechoLivre({x:FP.x,z:FP.z},novo)){cancelaCaminhada();return;}
  FP.x=novo.x;FP.z=novo.z;
  if(d<=passo+0.001 && ++caminhada.indice>=caminhada.rota.length){cancelaCaminhada();document.getElementById('dica').textContent=DICAS.visita;}
}
function destinoNaTela(e) {
  var r=cv.getBoundingClientRect(),raio=new THREE.Raycaster();
  raio.setFromCamera(new THREE.Vector2((e.clientX-r.left)/r.width*2-1,1-(e.clientY-r.top)/r.height*2),cam);
  planta3d.updateMatrixWorld(true);
  var hits=raio.intersectObject(planta3d,true);
  // O primeiro objeto precisa ser piso: nao escolher destinos atraves de paredes ou moveis.
  if(hits.length && hits[0].point.y<0.13 && hits[0].face && hits[0].face.normal.y>0.8)
    iniciaCaminhada({x:hits[0].point.x,z:hits[0].point.z});
}
(function duploToque(){
  var atual=null,ultimo=null,ativos=new Set();
  cv.addEventListener('pointerdown',function(e){
    if(modo!=='visita'||e.button!==0)return;
    ativos.add(e.pointerId);
    if(ativos.size>1){atual=null;ultimo=null;return;}
    atual={id:e.pointerId,x:e.clientX,y:e.clientY,t:performance.now(),arrastou:false};
  });
  cv.addEventListener('pointermove',function(e){
    if(atual && atual.id===e.pointerId && Math.hypot(e.clientX-atual.x,e.clientY-atual.y)>8){atual.arrastou=true;ultimo=null;}
  });
  cv.addEventListener('pointerup',function(e){
    ativos.delete(e.pointerId);
    if(!atual||atual.id!==e.pointerId)return;
    var a=atual;atual=null;var agora=performance.now();
    if(modo!=='visita'||a.arrastou||agora-a.t>300){ultimo=null;return;}
    if(ultimo && agora-ultimo.t<350 && Math.hypot(e.clientX-ultimo.x,e.clientY-ultimo.y)<24){ultimo=null;destinoNaTela(e);}
    else ultimo={x:e.clientX,y:e.clientY,t:agora};
  });
  cv.addEventListener('pointercancel',function(e){ativos.delete(e.pointerId);atual=null;ultimo=null;});
})();

function passoVisita(dt) {
  var mf = FP.mz, mr = FP.mx;
  if (teclas.w) mf += 1; if (teclas.s) mf -= 1;
  if (teclas.d) mr += 1; if (teclas.a) mr -= 1;
  if (!mf && !mr) { passoAutomatico(dt); return; }
  cancelaCaminhada();
  var forca = Math.min(1, Math.hypot(mf, mr));
  var vel = 1.8 * Math.min(0.05, dt) * forca;
  var L = Math.hypot(mf, mr); mf /= L; mr /= L;
  var sy = Math.sin(FP.yaw), cy = Math.cos(FP.yaw);
  var dx = (-sy*mf + cy*mr) * vel, dz = (-cy*mf - sy*mr) * vel;
  // Desliza pela parede em vez de travar: barrado na diagonal, tenta cada eixo. Sem
  // isso, andar encostado numa parede para de funcionar e parece travamento.
  if (livre(FP.x+dx, FP.z+dz)) { FP.x += dx; FP.z += dz; }
  else if (livre(FP.x+dx, FP.z)) FP.x += dx;
  else if (livre(FP.x, FP.z+dz)) FP.z += dz;
}
var teclas = {};
addEventListener("keydown", function (e) {
  if (modo !== "visita" || /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) return;
  var k = e.key.toLowerCase();
  if (k === "w" || k === "arrowup") teclas.w = 1;
  else if (k === "s" || k === "arrowdown") teclas.s = 1;
  else if (k === "a" || k === "arrowleft") teclas.a = 1;
  else if (k === "d" || k === "arrowright") teclas.d = 1;
  else return;
  e.preventDefault();
});
addEventListener("keyup", function (e) {
  var k = e.key.toLowerCase();
  if (k === "w" || k === "arrowup") teclas.w = 0;
  else if (k === "s" || k === "arrowdown") teclas.s = 0;
  else if (k === "a" || k === "arrowleft") teclas.a = 0;
  else if (k === "d" || k === "arrowright") teclas.d = 0;
});
(function manche() {
  var joy = document.getElementById("joy"), pino = joy.firstElementChild, id = null;
  function poe(e) {
    var b = joy.getBoundingClientRect();
    var dx = (e.clientX - (b.left + b.width/2)) / (b.width/2);
    var dz = (e.clientY - (b.top + b.height/2)) / (b.height/2);
    var L = Math.hypot(dx, dz);
    if (L > 1) { dx /= L; dz /= L; }
    FP.mx = dx; FP.mz = -dz;
    pino.style.transform = "translate(" + (dx*32).toFixed(0) + "px," + (dz*32).toFixed(0) + "px)";
  }
  joy.addEventListener("pointerdown", function (e) {
    id = e.pointerId; poe(e);
    try { joy.setPointerCapture(e.pointerId); } catch (err) {}
    e.preventDefault(); e.stopPropagation();
  });
  joy.addEventListener("pointermove", function (e) { if (id === e.pointerId) poe(e); });
  function solta2(e) {
    if (id !== e.pointerId) return;
    id = null; FP.mx = FP.mz = 0; pino.style.transform = "";
  }
  joy.addEventListener("pointerup", solta2);
  joy.addEventListener("pointercancel", solta2);
})();

/* ---- o giro, que e estado e nao botao ------------------------------------ */
/* A versao anterior tinha um botao "Girar", e botao pra isso e a pergunta errada: nao
   existe momento em que alguem quer a miniatura parada de proposito. O que existe e o
   momento em que a pessoa esta MEXENDO nela, e ai o giro tem que sair da frente. Entao
   ele para no toque e volta sozinho quando a mao larga. */
var RETOMA = 2200;                       // ms de mao parada ate o giro voltar
var ultimoToque = 0;
function mexeu() { gira = false; ultimoToque = performance.now(); }

/* ---- a troca de modo ----------------------------------------------------- */
var modo = "maquete";
var vistaPlanta = null;              // ultimo angulo da planta 3D, ver `vaiPara`
var DICAS = {
  maquete:  "Arraste a maquete para girar · ela volta a girar sozinha",
  planta2d: "Corte na altura do peitoril · azul é esquadria",
  planta3d: "Escolha à esquerda se o arraste gira ou move · sem laje por cima",
  visita:   TOQUE ? "Dois toques no chão para caminhar · manche para andar · arraste para olhar"
                  : "Duplo clique no chão para caminhar · W A S D para andar · arraste para olhar"
};
document.getElementById('alternarFicha').addEventListener('click', function() {
  var recolhida = document.body.classList.toggle('ficha-recolhida');
  document.getElementById('informacoes').hidden = recolhida;
  this.setAttribute('aria-expanded', String(!recolhida));
  var label = recolhida ? 'Mostrar informações' : 'Recolher informações';
  this.setAttribute('aria-label',label);this.title=label;
  redim();
});
/* v4: Planta 3D e Visita dependem do pacote do interior. Enquanto ele desce, o botao
   ja fica marcado e a dica avisa; se a pessoa trocar de ideia, o modo pedido por ultimo
   e o que vale. */
var _modoPendente = null;
function vaiPara(novo) {
  if ((novo === "planta3d" || novo === "visita") && !INTERIOR_PRONTO) {
    _modoPendente = novo;
    document.querySelectorAll("#modos button").forEach(function (b) {
      b.setAttribute("aria-pressed", String(b.dataset.modo === novo)); });
    document.getElementById("dica").textContent = "Preparando o apartamento…";
    garanteInterior().then(function () {
      if (_modoPendente === novo) { _modoPendente = null; vaiPara(novo); }
    }, function () {
      if (_modoPendente === novo) { _modoPendente = null; vaiPara(modo); }
      document.getElementById("dica").textContent = "Não foi possível abrir o apartamento. Verifique a conexão e tente de novo.";
    });
    return;
  }
  _modoPendente = null;
  vaiParaAgora(novo);
  invalidaSombras();
}
function vaiParaAgora(novo) {
  cancelaCaminhada();
  /* De onde a planta estava sendo vista e uma ESCOLHA, nao um estado qualquer: como
     ela nao gira sozinha, o angulo na tela foi posto ali por alguem. Ir ver o predio e
     voltar tem que devolver o mesmo desenho, e nao o de fabrica. */
  if (modo === "planta3d")
    vistaPlanta = { th:orb.th, ph:orb.ph, r:orb.r, zoom:zoomManual,
                    ax:alvo.x, ay:alvo.y, az:alvo.z, deslocamento:deslocamentoPivo.clone() };
  if(typeof editorCedros!=="undefined" && editorCedros && novo!=="planta3d" && novo!=="visita")editorCedros.fechar(false);
  modo = novo;
  if(typeof editorCedros!=="undefined" && editorCedros)editorCedros.sincronizaModo();
  deslocamentoPivo.set(0, 0, 1);
  var botoes = document.querySelectorAll("#modos button");
  for (var i = 0; i < botoes.length; i++)
    botoes[i].setAttribute("aria-pressed", String(botoes[i].dataset.modo === novo));
  var ehPlanta = novo === "planta3d" || novo === "visita";
  if (ehPlanta) montaPlanta3D();
  predio.visible = novo === "maquete";
  if(modeloMontes)document.getElementById('verConjunto').hidden=novo!=='maquete';
  if (planta3d) planta3d.visible = ehPlanta;
  if (tetoVisita) tetoVisita.visible = novo === "visita";
  /* `hidden` E PROPRIEDADE DE HTMLElement, E `<svg>` NAO E UM. Atribuir
     `svg.hidden = false` cria uma propriedade solta no objeto -- ela ate LE como
     `false` depois --, mas o atributo do markup continua no elemento, e a regra
     global `[hidden]{display:none!important}` continua valendo. Medido: `svg.hidden`
     dizia `false`, `getComputedStyle` dizia `display:none`, e a planta 2D era uma area
     vazia sem erro nenhum no console. Com atributo funciona nos dois. */
  if (novo === "planta2d") p2d.removeAttribute("hidden");
  else p2d.setAttribute("hidden", "");
  document.getElementById("c").style.visibility = novo === "planta2d" ? "hidden" : "";
  document.getElementById("joy").hidden = !(novo === "visita" && TOQUE);
  document.getElementById("selo").hidden = novo !== "maquete";
  document.getElementById("dica").textContent = DICAS[novo];
  /* A barra so existe na planta 3D, e fora dela o arrasto VOLTA a girar. Modo ligado
     sem o botao na tela pra dize-lo e armadilha: a pessoa arrastaria o predio
     esperando girar e ele sairia de lado. */
  caixa.classList.toggle("ferr", novo === "planta3d");
  poeArrasto(novo === "planta3d" ? ARRASTO : "girar");
  if (novo === "planta2d") { desenhaPlanta2D(); return; }
  if (novo === "visita") {
    var e = pontoDeEntrada();
    FP.x = e[0]; FP.z = e[1]; FP.pitch = -0.05;
    FP.yaw = melhorDirecao(e[0], e[1]);
    cam.fov = 72; cam.near = 0.08; cam.updateProjectionMatrix();
  } else {
    cam.fov = 34; cam.near = 0.2; cam.updateProjectionMatrix();
    zoomManual = false;
    if (novo === "planta3d") {
      alvo.set(PB.cx, PD * 0.5, PB.cz);
      if (vistaPlanta) {
        orb.th = vistaPlanta.th; orb.ph = vistaPlanta.ph;
        orb.r = vistaPlanta.r;   zoomManual = vistaPlanta.zoom;
        // o deslocamento tambem e escolha de quem olhou: volta junto com o angulo
        alvo.set(vistaPlanta.ax, vistaPlanta.ay, vistaPlanta.az);
        if(vistaPlanta.deslocamento)deslocamentoPivo.copy(vistaPlanta.deslocamento);
      } else { orb.ph = 0.72; orb.r = raioQueEnquadra(); }
    } else {
      alvo.set(MEIO.x, MEIO.y, MEIO.z);
      orb.ph = D._id === 'wish-castanheiras-58' ? 1.38 : 1.03;
      orb.r = raioQueEnquadra();
      centralizaVertical();
    }
  }
  mexeu();
}
(function ligaModos() {
  var botoes = document.querySelectorAll("#modos button");
  for (var i = 0; i < botoes.length; i++)
    botoes[i].addEventListener("click", function () { vaiPara(this.dataset.modo); });
})();

/* GIRAR OU MOVER: o mesmo arrasto, dois resultados.

   Sem isto so havia girar, e deslocar a planta pro canto -- pra ler um comodo de
   perto sem o resto na frente -- nao tinha gesto nenhum. Botao do meio e tecla
   modificadora resolveriam num programa de CAD, mas aqui nao ha quem os descubra
   sozinho, e no telefone nao existem. Dois icones resolvem os dois problemas de uma
   vez: dao o gesto e ANUNCIAM que ele existe.

   O cursor muda junto. E a unica confirmacao continua de qual modo esta ligado
   enquanto a mao esta sobre o desenho, longe dos botoes. */
function poeArrasto(qual) {
  if(typeof editorCedros!=="undefined" && editorCedros)editorCedros.navegar();
  ARRASTO = qual;
  var g = document.getElementById("fGirar"), mv = document.getElementById("fMover");
  g.setAttribute("aria-pressed", String(qual === "girar"));
  mv.setAttribute("aria-pressed", String(qual === "mover"));
  cv.style.cursor = qual === "mover" ? "move" : "grab";
  document.getElementById("dica").textContent = DICAS[modo];
}
(function ligaFerramentas() {
  document.getElementById("fGirar").addEventListener("click", function () { poeArrasto("girar"); });
  document.getElementById("fMover").addEventListener("click", function () { poeArrasto("mover"); });
})();

/* v4: SEM "VER MAPA". A miniatura passou a ser uma pagina independente: o link, a
   cortina e o mergulho de camera que cobriam a troca de pagina sairam. */

/* ---- laco (v4: sob demanda) --------------------------------------------------
   Antes, `requestAnimationFrame` redesenhava a cena 60 vezes por segundo em qualquer
   modo, parada ou nao -- inclusive na Planta 2D, onde o canvas nem aparece (e onde o
   SVG era refeito a cada quadro: medido, 46-69% da CPU de um celular). Agora:
   - so se desenha quando algo mudou (`suja`) ou enquanto algo anima sozinho (`anima`);
   - no giro ocioso da maquete o teto e `PERFIL.fpsGiro` (30 no medio/baixo): o predio
     gira 0,3 grau por quadro, a metade dos quadros nao se ve e e metade da bateria;
   - a Planta 2D nao usa o laco;
   - o governador de resolucao mede o intervalo entre quadros desenhados em sequencia. */
var tAnt = 0, pulso = 0, _ultimoDesenho = 0;
var _solAnt = new Float64Array(6);
function anima() {
  if (voo || mergulho) return true;
  if (modo === "maquete") return !CAPA;             // giro sozinho e pulso do andar
  if (BK && BK.BAKE.fila) return true;              // bake em fatias (sem atlas)
  if (modo === "visita" && (FP.mx || FP.mz || teclas.w || teclas.s || teclas.a || teclas.d ||
                            caminhada.rota.length)) return true;
  return false;
}
function quadro(now) {
  _pendente = false; clearTimeout(_resgate);
  if (!_visivel) { tAnt = 0; _ultimoDesenho = 0; return; }
  if (modo === "planta2d") { _sujo = false; tAnt = 0; _ultimoDesenho = 0; return; }
  var animando = anima();
  var interagindo = arr || dedos.size > 0 || now - ultimoToque < RETOMA;
  var fpsAlvo = (modo === "maquete" && !interagindo) ? PERFIL.fpsGiro : PERFIL.fps;
  PERFIL.fpsMeta = fpsAlvo;
  if (!_sujo) {
    if (!animando) { tAnt = 0; _ultimoDesenho = 0; return; }
    // teto de quadros: pula este vsync e espera o proximo
    if (_ultimoDesenho && now - _ultimoDesenho < 1000 / fpsAlvo - 4) { agenda(); return; }
  }
  _sujo = false;
  var dt = tAnt ? Math.min(0.1, (now - tAnt) / 1000) : 0;
  tAnt = now;
  redim();
  /* O BAKE ASSENTA AQUI, em fatias. Tracar a oclusao de uma unidade inteira num quadro
     so trava a pagina por segundos; `bakePasso` gasta um orcamento por quadro e devolve
     `true` quando fecha. Ate la a parede aparece com a luz analitica e vai escurecendo
     nos cantos -- que e melhor que uma tela parada. */
  luzDaPlanta(false);
  if (BK && BK.BAKE.fila && BK.bakePasso(BK.BAKE.fila, 9)) BK.BAKE.fila = null;
  if (voo) {
    var t = Math.min(1, (now - voo.t0) / voo.dur);
    var ee = t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2, 3)/2;
    alvo.y = voo.y0 + (voo.y1 - voo.y0)*ee;
    orb.r  = voo.r0 + (voo.r1 - voo.r0)*ee;
    orb.ph = voo.p0 + (voo.p1 - voo.p0)*ee;
    if (t >= 1) voo = null;
  }
  // 0,16 rad/s: uma volta em 39 s. Por SEGUNDO e nao por quadro -- com passo por
  // quadro a mesma volta leva 12 s numa GPU e um minuto num rasterizador de software.
  // Volta a girar sozinha depois que a mao larga -- ver a nota do `mexeu`.
  /* SO A MAQUETE GIRA SOZINHA. Na vitrine o giro e o que apresenta o volume: ninguem
     pediu pra ver o predio, ele tem que se oferecer. Na PLANTA e o contrario -- quem
     esta ali esta LENDO: comparando onde fica o quarto em relacao a cozinha, medindo
     com o olho. Um desenho que roda sozinho reinicia essa leitura a cada volta, e
     obriga a pessoa a correr atras do proprio raciocinio. Aqui a planta fica onde a
     mao largou, e so sai de la quando alguem a mover. */
  var giraSozinha = modo !== "visita" && modo !== "planta3d" && !mergulho;
  if (!gira && giraSozinha && now - ultimoToque > RETOMA) gira = true;
  if (gira && giraSozinha && !voo && !CAPA) orb.th += 0.16 * dt;
  pulso += dt;
  if (brilho) {
    var b = 0.5 + 0.5 * Math.sin(pulso * 3.0);
    contorno.material.opacity = 0.45 + b * 0.5;
    // Do branco ao verde e de volta. Multiplica a difusa, entao o andar "acende" sem
    // deixar de ser parede -- textura, sombra e reflexo continuam os mesmos.
    // v4: so enquanto lajes e paredes instanciadas estao na cena (antes da luz externa).
    if (lajes.parent) {
      corInst.setRGB(1 - b*0.72, 1 - b*0.12, 1 - b*0.52);
      lajes.setColorAt(ANDAR, corInst); pars.setColorAt(ANDAR, corInst);
      lajes.instanceColor.needsUpdate = pars.instanceColor.needsUpdate = true;
    }
  }
  if (modo === "visita") {
    // Dentro da casa quem manda na camera e o corpo, nao a orbita.
    passoVisita(dt);
    cam.position.set(FP.x, OLHO, FP.z);
    cam.rotation.set(FP.pitch, FP.yaw, 0);
    cam.updateMatrixWorld();
  } else poeCam();
  // O sol fica FIXO no mundo enquanto a camera gira: e o que faz a maquete parecer
  // um objeto numa mesa, e nao um objeto grudado na lente. Posto a oeste-norte, a
  // sombra cai pro lado oposto e entra no quadro na maior parte da volta.
  // Na visita ele mira a planta: `alvo` e o alvo da ORBITA, que ali nao e usado, e
  // ficaria parado no ultimo enquadramento -- o sol nao entraria pela janela certa.
  var sx = modo === "visita" ? PB.cx : alvo.x;
  var sy = modo === "visita" ? PD/2  : alvo.y;
  var sz = modo === "visita" ? PB.cz : alvo.z;
  sol.position.set(sx - 30, 46 + sy, sz + 22);
  sol.target.position.set(sx, sy, sz);
  sol.target.updateMatrixWorld();
  luzDaPlanta(modo === "planta3d");
  aplicaEstudoV2();
  // v4: o mapa de sombra so e refeito se o sol (ou o alvo dele) se moveu, ou se alguem
  // avisou (`invalidaSombras`).
  var sp = sol.position, st = sol.target.position;
  if (Math.abs(_solAnt[0]-sp.x) + Math.abs(_solAnt[1]-sp.y) + Math.abs(_solAnt[2]-sp.z) +
      Math.abs(_solAnt[3]-st.x) + Math.abs(_solAnt[4]-st.y) + Math.abs(_solAnt[5]-st.z) > 1e-4) {
    _solAnt[0] = sp.x; _solAnt[1] = sp.y; _solAnt[2] = sp.z;
    _solAnt[3] = st.x; _solAnt[4] = st.y; _solAnt[5] = st.z;
    sombraSuja = true;
  }
  if (sombraSuja) { ren.shadowMap.needsUpdate = true; sombraSuja = false; }
  ren.render(cena, cam);
  if (!ESTADO.quadros++) primeiroQuadro();
  if (modo !== "maquete" && !ESTADO.tempos.primeiroQuadroInterior && planta3d) ESTADO.tempos.primeiroQuadroInterior = performance.now();
  if (_tiraCapaAposQuadro) { _tiraCapaAposQuadro = false; tiraCapa(); }
  if (animando && _ultimoDesenho && !SEM_DRS) GOV.quadro(now - _ultimoDesenho);
  _ultimoDesenho = animando ? now : 0;
  if (animando || _sujo) agenda();
}
/* A CAPA (pagina.html, gerador/capa.mjs) e a maquete JA COM a luz calculada, na pose
   de abertura. Ela fica ate o 3D poder mostrar a mesma coisa -- o primeiro quadro DEPOIS
   da luz externa --, com o giro segurado ate la: o esmaecimento troca imagem por imagem
   igual. Se a pessoa tocar antes, ou a luz demorar mais de 12 s, o 3D aparece na hora. */
var CAPA = document.getElementById("capa"), _tiraCapaAposQuadro = false;
ESTADO.tempos = { capa: window.__tCapa || null, primeiroQuadro: null, exterior: null, interior: null };
function primeiroQuadro() { ESTADO.tempos.primeiroQuadro = performance.now(); }
function tiraCapa() {
  if (!CAPA) return;
  var c = CAPA; CAPA = null; ESTADO.tempos.capaSaiu = performance.now();
  c.classList.add("some"); setTimeout(function () { c.remove(); }, 450);
  tAnt = 0; suja();
}
if (CAPA) {
  if (!CAPA.complete) CAPA.addEventListener("load", function () { ESTADO.tempos.capa = window.__tCapa || performance.now(); });
  cv.addEventListener("pointerdown", tiraCapa, { capture: true });
  setTimeout(tiraCapa, 12000);
}
// A camera de sombra tem que CABER o predio: nos +-5 m do padrao do three todo
// fragmento fora da caixa e amostrado fora do mapa, e o three devolve isso como
// sombra -- o predio sai preto, sem erro nenhum no console.
var S = Math.max(raioChao, ALTURA) * 0.9;
sol.shadow.camera.left = -S; sol.shadow.camera.right = S;
sol.shadow.camera.top = S;   sol.shadow.camera.bottom = -S;
sol.shadow.camera.near = 1;  sol.shadow.camera.far = 240;
sol.shadow.camera.updateProjectionMatrix();
redim(); orb.r = raioQueEnquadra(); centralizaVertical(); poeCam();
/* Editor experimental apenas do Cedros. Reutiliza catalogo e regras do renderizador.
   v4: criado junto com o interior (`iniciaInterior`), nao na abertura. */
var editorCedros = null;
function criaEditorCedros(){ return (function(){
  var estado={on:false,moveis:[],sel:-1,acao:null,tipo:null,grade:null,caixa:null,iniciado:false},historico=[],padrao=null,recolhidaAntes=false;
  var chave='miniaturas:cedros:moveis:v1';
  var style=document.createElement('style');style.textContent=`
    #botaoMoveis{position:absolute;top:10px;right:10px;z-index:8;padding:8px 14px;min-height:40px;background:#202b32;border:1px solid #52605e;border-radius:8px;color:#e7ebf0;cursor:pointer;flex:none}
    #botaoMoveis[aria-pressed=true]{border-color:#5fc777;color:#bff3d2}
    #editorMoveis{max-height:260px;overflow:auto;overscroll-behavior:contain;margin-top:8px;padding-top:8px;border-top:1px solid var(--line);font-size:12px;flex:1 1 auto;min-height:0}
    #editorMoveis button,#editorMoveis select,#editorMoveis input{font:inherit;color:var(--txt);background:#202b32;border:1px solid #52605e;border-radius:6px;min-height:36px;padding:6px;min-width:0}
    #editorMoveis button{cursor:pointer}#editorMoveis button:disabled{opacity:.4;cursor:default}
    #editorMoveis .linha{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px;align-items:center}
    #editorMoveis select{flex:1}#editorMoveis .medidas{display:grid;grid-template-columns:repeat(3,minmax(190px,1fr));gap:12px;margin-bottom:8px;overflow-x:auto}
    #editorMoveis label{display:flex;align-items:center;gap:8px}#editorMoveis input{width:100%}
    #editorMoveis .medidas label{display:grid;grid-template-columns:auto minmax(60px,1fr);align-items:center;gap:6px;white-space:nowrap}
    #editorMoveis .campoCor{display:grid;grid-template-columns:118px minmax(0,1fr);align-items:center;gap:8px}
    #editorMoveis .selecao{flex-wrap:nowrap;overflow-x:auto}
    #editorMoveis .selecao>label{flex:0 0 auto}
    #editorMoveis .selecao select{min-width:110px}
    #editorMoveis .selecao button{flex:none;white-space:nowrap}
    #editorMoveis .campoCor{margin-bottom:8px}
    #editorMoveis .linha>label{flex:0 0 118px}
    #editorMoveis [role=status]:empty{display:none}
    #editorMoveis [role=status]{color:#b9c5cf;line-height:1.5;margin:6px 0}
    body.editandoMoveis #ficha{max-height:65dvh;display:flex;flex-direction:column;min-height:0}
    body.editandoMoveis #modos{flex:none}body.editandoMoveis #alternarFicha{flex:none}
    @media(max-width:640px){#editorMoveis{max-height:240px}#editorMoveis button{min-height:44px}}
  `;document.head.appendChild(style);
  var botao=document.createElement('button');botao.id='botaoMoveis';botao.type='button';botao.textContent='Móveis';botao.setAttribute('aria-pressed','false');botao.setAttribute('aria-controls','editorMoveis');
  document.getElementById('cena').appendChild(botao);botao.hidden=modo!=='planta3d';
  var painel=document.createElement('section');painel.id='editorMoveis';painel.hidden=true;painel.setAttribute('aria-label','Editor de móveis');document.getElementById('modos').after(painel);
  painel.innerHTML=`<div class="linha"><label for="catalogoMovel">Adicionar</label><select id="catalogoMovel"><option value="">Escolha um móvel</option></select><button id="adicionaMovel">Posicionar</button></div>
  <div class="linha selecao"><label for="listaMoveis">Selecionar</label><select id="listaMoveis"><option value="">Clique em um móvel</option></select><button id="moveMovel" disabled>Mover</button><button id="giraMovel" disabled>Girar 90°</button><button id="excluiMovel" disabled>Excluir</button></div>
  <div id="ajustesMovel" hidden>
  <div class="medidas"><label>Largura (m)<input id="movelW" type="number" min="0.2" max="3.5" step="0.05"></label><label>Profundidade (m)<input id="movelD" type="number" min="0.2" max="3.5" step="0.05"></label><label>Altura (m)<input id="movelH" type="number" min="0.04" max="2.6" step="0.02"></label></div>
  <label class="campoCor">Cor<input id="corMovel" type="color"></label></div>
  <div class="linha"><button id="cancelaMovel" hidden>Cancelar ajuste</button><button id="desfazMovel">Desfazer</button><button id="restauraMoveis">Restaurar original</button><button id="fechaMoveis">Concluir</button></div>
  <p id="statusMoveis" role="status" aria-live="polite">Selecione um móvel na planta ou na lista. Grade de 10 cm. Alterações ficam neste navegador.</p>`;
  var $=id=>document.getElementById(id),status=texto=>{$('statusMoveis').textContent=texto;};
  FURN.MOVEL_KEYS.forEach(function(k){var o=document.createElement('option');o.value=k;o.textContent=FURN.MOVEIS[k].nome;$('catalogoMovel').appendChild(o);});
  function dados(){return estado.moveis.map(m=>({tipo:m.tipo,u:m.u,v:m.v,rot:m.rot,w:m.w,h:m.h,d:m.d,cor:m.cor}));}
  function guarda(){mobiliaMudou();obstaculosMoveis=null;cancelaCaminhada();try{localStorage.setItem(chave,JSON.stringify(dados()));}catch(e){status('Alterações aplicadas nesta sessão; o navegador não permitiu salvar.');}}
  function registra(){historico.push(dados());if(historico.length>30)historico.shift();}
  function tira(obj){planta3d.remove(obj);obj.traverse(o=>{if(o.geometry)o.geometry.dispose();});}
  function constroi(m){
    var def=FURN.MOVEIS[m.tipo],obj=FURN.geoDoMovel(def,m.cor,m),p=PL_R.W(m.u,m.v);
    obj.position.set(p[0],0.03,p[1]);if(!def.param)obj.scale.set(m.w/def.b[0],m.h/def.b[1],m.d/def.b[2]);
    obj.rotation.y=Math.atan2(-PL_R.ob.uz,PL_R.ob.ux)+m.rot*Math.PI/2;
    obj.userData.movel=true;obj.userData.registroMovel=m;m.obj=obj;planta3d.add(obj);return obj;
  }
  function refaz(m){if(m.obj)tira(m.obj);constroi(m);obstaculosMoveis=null;pinta();if(estado.acao)criaHolograma();}
  function carrega(lista){estado.moveis.forEach(m=>tira(m.obj));estado.moveis=lista.map(m=>Object.assign({},m));estado.moveis.forEach(constroi);estado.sel=-1;estado.acao=null;estado.tipo=null;obstaculosMoveis=null;mobiliaMudou();pinta();}
  function pinta(){
    if(!estado.acao)limpaHolograma();
    var lista=$('listaMoveis');lista.innerHTML='<option value="">Clique em um móvel</option>';
    estado.moveis.forEach(function(m,i){var o=document.createElement('option');o.value=i;o.textContent=(i+1)+'. '+FURN.MOVEIS[m.tipo].nome;lista.appendChild(o);});
    lista.value=estado.sel<0?'':String(estado.sel);var m=estado.moveis[estado.sel];$('ajustesMovel').hidden=!m;['moveMovel','giraMovel','excluiMovel'].forEach(id=>{$(id).disabled=!m;});
    if(m){$('movelW').value=m.w.toFixed(2);$('movelD').value=m.d.toFixed(2);$('movelH').value=m.h.toFixed(2);$('corMovel').value='#'+Number(m.cor).toString(16).padStart(6,'0');}
    if(estado.caixa){cena.remove(estado.caixa);estado.caixa.geometry.dispose();estado.caixa.material.dispose();estado.caixa=null;}
    if(m&&estado.on){m.obj.updateWorldMatrix(true,true);estado.caixa=new THREE.BoxHelper(m.obj,0x5fc777);cena.add(estado.caixa);}
    $('cancelaMovel').hidden=!estado.acao;$('desfazMovel').disabled=!historico.length;
  }
  var regras=FurnitureEditor.create({THREE:THREE,INT:{get pl(){return PL_R;},get moveis(){return estado.moveis;}},MOB:{passo:0.1},MOVEIS:FURN.MOVEIS,ESP:ESP,
    dentroDaPlanta:function(pl,x,z){return dentroDaPlanta(x-pl.ob.cx,z-pl.ob.cz);}});
  function cabe(m){
    if(!regras.cabeAqui(m,m.u,m.v))return false;
    // Testa a area toda contra as paredes, nao apenas os quatro cantos.
    var p=PL_R.W(m.u,m.v),a=Math.atan2(-PL_R.ob.uz,PL_R.ob.ux)+m.rot*Math.PI/2,c=Math.cos(a),s=Math.sin(a);
    for(var x=-m.w/2;x<=m.w/2+0.001;x+=Math.min(0.08,m.w/4))for(var z=-m.d/2;z<=m.d/2+0.001;z+=Math.min(0.08,m.d/4)){
      var wx=p[0]+x*c+z*s-PL_R.ob.cx,wz=p[1]-x*s+z*c-PL_R.ob.cz;
      if(folga(wx,wz)<ESP/2-0.005)return false;
    }
    return true;
  }
  function seleciona(i){estado.sel=i;estado.acao=i>=0?'mover':null;estado.tipo=null;pinta();if(i>=0)criaHolograma();}
  function altera(campo,valor){
    var m=estado.moveis[estado.sel];if(!m)return;
    if(!Number.isFinite(valor)){pinta();return;}
    var antigo=m[campo];m[campo]=valor;
    var valido=campo==='cor'||cabe(m);m[campo]=antigo;
    if(!valido){status('Esse ajuste invade uma parede, outro móvel ou sai da planta.');pinta();return;}
    registra();m[campo]=valor;refaz(m);guarda();status('Móvel atualizado.');
  }
  function inicia(){
    if(estado.iniciado)return;montaPlanta3D();
    estado.moveis=planta3d.children.filter(o=>o.userData.registroMovel).map(o=>Object.assign({},o.userData.registroMovel,{obj:o}));
    estado.moveis.forEach(m=>{var d=FURN.MOVEIS[m.tipo];m.cor=m.cor==null?d.cor:m.cor;m.rot=m.rot||0;});padrao=dados();estado.iniciado=true;
    try{var saved=JSON.parse(localStorage.getItem(chave)||'null');if(Array.isArray(saved)&&saved.length<150&&saved.every(m=>FURN.MOVEIS[m.tipo]&&['u','v','rot','w','h','d','cor'].every(k=>Number.isFinite(m[k]))&&m.w>0&&m.d>0&&m.h>0))carrega(saved);}catch(e){}
    // Recorta cada linha da grade pela uniao dos contornos da planta.
    var polys=PL_R.contorno.map(poly=>poly.map(p=>{var x=p[0]-PL_R.ob.cx,z=p[1]-PL_R.ob.cz;return [x*PL_R.ob.ux+z*PL_R.ob.uz,-x*PL_R.ob.uz+z*PL_R.ob.ux];}));
    var vertices=[];
    for(var eixo=0;eixo<2;eixo++){
      var coords=polys.flat().map(p=>p[eixo]),min=Math.min(...coords),max=Math.max(...coords);
      for(var k=Math.ceil(min*10);k<=Math.floor(max*10);k++){
        var valor=k/10,intervalos=[];
        polys.forEach(poly=>{var cortes=[];for(var i=0;i<poly.length;i++){var a=poly[i],b=poly[(i+1)%poly.length];if((a[eixo]<=valor&&b[eixo]>valor)||(b[eixo]<=valor&&a[eixo]>valor))cortes.push(a[1-eixo]+(valor-a[eixo])/(b[eixo]-a[eixo])*(b[1-eixo]-a[1-eixo]));}
          cortes.sort((a,b)=>a-b);for(var i=0;i+1<cortes.length;i+=2)intervalos.push([cortes[i],cortes[i+1]]);
        });
        intervalos.sort((a,b)=>a[0]-b[0]);var uniao=[];
        intervalos.forEach(ab=>{var prev=uniao[uniao.length-1];if(prev&&ab[0]<=prev[1]+0.0001)prev[1]=Math.max(prev[1],ab[1]);else uniao.push(ab.slice());});
        uniao.forEach(ab=>ab.forEach(v=>vertices.push(eixo===0?valor:v,0,eixo===0?v:valor)));
      }
    }
    var geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
    estado.grade=new THREE.LineSegments(geo,new THREE.LineBasicMaterial({color:0x5fc777,transparent:true,opacity:0.25,depthWrite:false,toneMapped:false}));
    estado.grade.name='grade-moveis';estado.grade.raycast=function(){};
    estado.grade.position.set(PL_R.ob.cx,0.026,PL_R.ob.cz);estado.grade.rotation.y=Math.atan2(-PL_R.ob.uz,PL_R.ob.ux);planta3d.add(estado.grade);estado.grade.visible=false;
  }
  function abrir(){inicia();if(modo!=='planta3d')vaiPara('planta3d');cancelaCaminhada();recolhidaAntes=document.body.classList.contains('ficha-recolhida');if(!recolhidaAntes)$('alternarFicha').click();estado.on=true;estado.grade.visible=true;painel.hidden=false;document.body.classList.add('editandoMoveis');botao.setAttribute('aria-pressed','true');pinta();redim();}
  function fechar(restaurar){estado.on=false;estado.acao=null;estado.tipo=null;if(estado.grade)estado.grade.visible=false;painel.hidden=true;document.body.classList.remove('editandoMoveis');botao.setAttribute('aria-pressed','false');pinta();if(restaurar!==false&&!recolhidaAntes&&document.body.classList.contains('ficha-recolhida'))$('alternarFicha').click();redim();}
  botao.onclick=()=>estado.on?fechar():abrir();$('fechaMoveis').onclick=()=>fechar();
  $('listaMoveis').onchange=e=>seleciona(e.target.value===''?-1:Number(e.target.value));
  $('adicionaMovel').onclick=function(){var tipo=$('catalogoMovel').value;if(!tipo){status('Escolha um tipo de móvel.');return;}estado.tipo=tipo;estado.acao='adicionar';estado.sel=-1;pinta();criaHolograma();status('Prévia: mova o mouse ou arraste no chão e solte para colocar. Vermelho = não cabe.');};
  $('catalogoMovel').onchange=function(){if(this.value)$('adicionaMovel').click();else{estado.acao=null;estado.tipo=null;pinta();}};
  $('moveMovel').onclick=function(){estado.acao='mover';pinta();criaHolograma();status('Clique ou toque no novo lugar. O móvel só muda quando o destino couber.');};
  $('cancelaMovel').onclick=()=>{estado.acao=null;estado.tipo=null;pinta();status('Ajuste cancelado.');};
  $('giraMovel').onclick=()=>{var m=estado.moveis[estado.sel];if(m)altera('rot',(m.rot+1)%4);};
  ['w','d','h'].forEach(k=>{$('movel'+k.toUpperCase()).onchange=e=>altera(k,Math.max(k==='h'?0.04:0.2,Math.min(k==='h'?PL_R.pd:3.5,Number(e.target.value))));});
  $('corMovel').onchange=e=>altera('cor',parseInt(e.target.value.slice(1),16));
  $('excluiMovel').onclick=function(){var m=estado.moveis[estado.sel];if(!m)return;registra();tira(m.obj);estado.moveis.splice(estado.sel,1);seleciona(-1);guarda();status('Móvel excluído. Use Desfazer para recuperar.');};
  $('desfazMovel').onclick=function(){if(!historico.length)return;carrega(historico.pop());guarda();status('Última alteração desfeita.');};
  $('restauraMoveis').onclick=function(){registra();carrega(padrao);guarda();status('Layout original restaurado.');};
  function limpaHolograma(){
    if(!estado.holograma)return;planta3d.remove(estado.holograma);
    estado.holograma.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.isMesh)o.material.dispose();});estado.holograma=null;estado.previa=null;
  }
  function criaHolograma(){
    limpaHolograma();var m=estado.moveis[estado.sel],novo=estado.acao==='adicionar';
    if(novo){var d=FURN.MOVEIS[estado.tipo];m={tipo:estado.tipo,u:0,v:0,rot:0,w:d.b[0],h:d.b[1],d:d.b[2],cor:d.cor};}
    if(!m)return;estado.previa=Object.assign({},m);delete estado.previa.obj;
    var obj=FURN.geoDoMovel(FURN.MOVEIS[m.tipo],m.cor,m),def=FURN.MOVEIS[m.tipo];
    if(!def.param)obj.scale.set(m.w/def.b[0],m.h/def.b[1],m.d/def.b[2]);
    obj.rotation.y=Math.atan2(-PL_R.ob.uz,PL_R.ob.ux)+m.rot*Math.PI/2;
    obj.name='holograma-movel';obj.traverse(o=>{o.raycast=function(){};if(o.isMesh){o.material=new THREE.MeshBasicMaterial({color:0x70e4bc,transparent:true,opacity:0.48,depthWrite:false,depthTest:false});o.renderOrder=8;o.castShadow=false;o.receiveShadow=false;}});
    estado.holograma=obj;planta3d.add(obj);atualizaPrevia(m.u,m.v);
    if(novo){var b=cv.getBoundingClientRect();seguePonteiro({clientX:b.left+b.width/2,clientY:b.top+b.height/2});}
  }
  function atualizaPrevia(u,v){
    var p=estado.previa;if(!p)return;p.u=u;p.v=v;
    var original=estado.acao==='mover'?estado.moveis[estado.sel]:p,antigo={u:original.u,v:original.v};original.u=u;original.v=v;
    estado.previaValida=cabe(original);original.u=antigo.u;original.v=antigo.v;
    var w=PL_R.W(u,v);estado.holograma.position.set(w[0],0.035,w[1]);
    estado.holograma.traverse(o=>{if(o.isMesh)o.material.color.setHex(estado.previaValida?0x70e4bc:0xef7373);});
  }
  function seguePonteiro(e){
    var p=new THREE.Vector3();if(!raio(e).ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),-0.02),p))return;
    planta3d.worldToLocal(p);var x=p.x-PL_R.ob.cx,z=p.z-PL_R.ob.cz;
    atualizaPrevia(Math.round((x*PL_R.ob.ux+z*PL_R.ob.uz)*10)/10,Math.round((-x*PL_R.ob.uz+z*PL_R.ob.ux)*10)/10);
  }
  var inicio=null;
  function raio(e){var b=cv.getBoundingClientRect(),r=new THREE.Raycaster();r.setFromCamera(new THREE.Vector2((e.clientX-b.left)/b.width*2-1,1-(e.clientY-b.top)/b.height*2),cam);planta3d.updateMatrixWorld(true);return r;}
  function atingido(e){var hits=raio(e).intersectObjects(estado.moveis.map(m=>m.obj),true);if(!hits.length)return -1;var obj=hits[0].object;while(obj&&!obj.userData.movel)obj=obj.parent;return estado.moveis.findIndex(m=>m.obj===obj);}
  cv.addEventListener('pointerdown',function(e){if(!estado.on||e.button!==0)return;var i=atingido(e);if(estado.acao||i>=0){inicio={id:e.pointerId,x:e.clientX,y:e.clientY,i:i};if(estado.acao)seguePonteiro(e);if(estado.acao)e.stopImmediatePropagation();try{cv.setPointerCapture(e.pointerId);}catch(err){}}},true);
  cv.addEventListener('pointermove',function(e){if(estado.on&&estado.acao){seguePonteiro(e);e.stopImmediatePropagation();}},true);
  cv.addEventListener('pointerup',function(e){
    if(!inicio||inicio.id!==e.pointerId)return;var ini=inicio;inicio=null;if(estado.acao)e.stopImmediatePropagation();else solta(e);
    if(!estado.acao&&Math.hypot(e.clientX-ini.x,e.clientY-ini.y)>10)return;
    if(!estado.acao){seleciona(ini.i);return;}
    var p=new THREE.Vector3(),r=raio(e);if(!r.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),-0.02),p))return;
    planta3d.worldToLocal(p);var x=p.x-PL_R.ob.cx,z=p.z-PL_R.ob.cz;
    var u=Math.round((x*PL_R.ob.ux+z*PL_R.ob.uz)*10)/10,v=Math.round((-x*PL_R.ob.uz+z*PL_R.ob.ux)*10)/10;
    var m=estado.moveis[estado.sel],novo=estado.acao==='adicionar';
    if(novo){var d=FURN.MOVEIS[estado.tipo];m={tipo:estado.tipo,u:u,v:v,rot:0,w:d.b[0],h:d.b[1],d:d.b[2],cor:d.cor};}
    var antigo={u:m.u,v:m.v};m.u=u;m.v=v;var valido=cabe(m);m.u=antigo.u;m.v=antigo.v;
    if(!valido){status('Não cabe nesse ponto. Escolha um lugar livre dentro da planta.');return;}
    registra();m.u=u;m.v=v;
    if(novo){estado.moveis.push(m);constroi(m);estado.sel=estado.moveis.length-1;}else refaz(m);
    estado.acao=null;estado.tipo=null;pinta();guarda();status('');
  },true);
  cv.addEventListener('pointercancel',()=>{inicio=null;},true);
  function navegar(){estado.acao=null;estado.tipo=null;pinta();}
  function sincronizaModo(){botao.hidden=modo!=='planta3d';if(estado.on&&modo!=='planta3d')fechar(false);}
  return {navegar:navegar,sincronizaModo:sincronizaModo,estado:estado,abrir:abrir,fechar:fechar,seleciona:seleciona,altera:altera,cabe:cabe};
})(); }

/* Porta pro QA. `quadro` entra porque em Chrome headless o rAF para depois dos
   primeiros quadros: sem ele, uma sonda so consegue desenhar chamando `ren.render`
   direto -- e ai o que o laco DECIDE (a camera da visita, o passo de caminhada, a
   posicao do sol) nunca roda, e o print sai com a camera do modo anterior. */
// Shared scene for plan and walk-through; no prerendered replacement or video.
var V2={ready:false,mode:null,materials:{},textures:[],replaced:[],lights:new THREE.Group()};
cena.add(V2.lights);
function v2Texture(kind,data){
  var n=256,c=document.createElement('canvas');c.width=c.height=n;
  var g=c.getContext('2d'),im=g.createImageData(n,n),seed=7163;
  function rnd(){seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;}
  for(var y=0;y<n;y++)for(var x=0;x<n;x++){
    var v=0.9,noise=(rnd()-.5);
    if(kind==='linen')v=.83+.09*Math.sin(x*Math.PI/2)*Math.sin(y*Math.PI/2)+noise*.11;
    if(kind==='wood')v=.92+.018*Math.sin(x*1.29+Math.sin(y*.029)*2)+.012*Math.sin(x*2.97+y*.03)+noise*.025;
    if(kind==='plaster')v=.985+noise*.012;
    if(kind==='stone')v=.88+noise*.08+.025*Math.sin(x*.04+y*.025);
    if(kind==='oak'){
      var row=Math.floor(x/32),yy=(y+row*83)%256;
      v=.91+.025*Math.sin(row*7)+.018*Math.sin(x*1.66+Math.sin(y*.032)*2)+noise*.025;
      if(x%32<1||yy<1)v=.77;
    }
    var k=(y*n+x)*4;im.data[k]=im.data[k+1]=im.data[k+2]=Math.round(v*255);im.data[k+3]=255;
  }
  g.putImageData(im,0,0);var t=new THREE.CanvasTexture(c);
  t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=Math.min(8,ren.capabilities.getMaxAnisotropy());
  if(!data)t.colorSpace=THREE.SRGBColorSpace;
  V2.textures.push(t);return t;
}
// v4: as dez texturas procedurais (256 px, laco por pixel em JS) saem com o interior.
var v2Maps=null;
function iniciaEstudoV2(){
  v2Maps={};['linen','wood','stone','oak','plaster'].forEach(k=>{v2Maps[k]=v2Texture(k,false);v2Maps[k+'Bump']=v2Texture(k,true);});
  v2OriginalFactory=FURN.geoDoMovel;FURN.geoDoMovel=v2GeoDoMovel;
}
function v2Material(name,color,kind,rough,metal,vertex){
  var key=[name,color,vertex].join('-');if(V2.materials[key])return V2.materials[key];
  var m=new THREE.MeshStandardMaterial({name:name,color:color,roughness:rough,metalness:metal||0,
    vertexColors:!!vertex,side:THREE.DoubleSide,envMap:ambientePBR,envMapIntensity:.55});
  if(kind){m.map=v2Maps[kind];m.bumpMap=v2Maps[kind+'Bump'];m.bumpScale=kind==='linen'?.0018:.001;}
  V2.materials[key]=m;return m;
}
function v2UV(g,scale){
  var p=g.attributes.position,n=g.attributes.normal,uv=new Float32Array(p.count*2);
  for(var i=0;i<p.count;i++){
    var nx=Math.abs(n.getX(i)),ny=Math.abs(n.getY(i)),nz=Math.abs(n.getZ(i));
    uv[i*2]=(nx>ny&&nx>nz?p.getZ(i):p.getX(i))*scale;
    uv[i*2+1]=(ny>nx&&ny>nz?p.getZ(i):p.getY(i))*scale;
  }g.setAttribute('uv',new THREE.BufferAttribute(uv,2));return g;
}
// Rounded boxes with continuous normals, dimensions in metres, shared by upholstery.
function v2Round(w,h,d,r){
  r=Math.min(r,w*.45,h*.45,d*.45);
  var g=new THREE.BoxGeometry(1,1,1,8,8,8),p=g.attributes.position,n=g.attributes.normal;
  var a=new THREE.Vector3(),b=new THREE.Vector3(),q=new THREE.Vector3();
  for(var i=0;i<p.count;i++){
    a.set(p.getX(i),p.getY(i),p.getZ(i));
    b.set(Math.max(-.375,Math.min(.375,a.x)),Math.max(-.375,Math.min(.375,a.y)),Math.max(-.375,Math.min(.375,a.z)));
    q.copy(a).sub(b).normalize();
    p.setXYZ(i,b.x/.75*(w-2*r)+q.x*r,b.y/.75*(h-2*r)+q.y*r,b.z/.75*(d-2*r)+q.z*r);
    n.setXYZ(i,q.x,q.y,q.z);
  }return v2UV(g,3);
}
function v2Box(group,mat,w,h,d,x,y,z,r,rx,rz){
  var mesh=new THREE.Mesh(v2Round(w,h,d,r||.008),mat);
  mesh.position.set(x,y,z);mesh.rotation.set(rx||0,0,rz||0);mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);return mesh;
}
// Merge only within each furniture item, keeping editor transforms and material boundaries.
function v2Merge(group){
  var buckets={};group.updateMatrixWorld(true);
  group.children.slice().forEach(o=>{if(!o.isMesh)return;var key=o.material.uuid;
    (buckets[key]||(buckets[key]={mat:o.material,p:[],n:[],uv:[]}));var b=buckets[key];
    var g=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();o.updateMatrix();g.applyMatrix4(o.matrix);
    ['position','normal','uv'].forEach((k,j)=>b[['p','n','uv'][j]].push(...g.attributes[k].array));
    g.dispose();o.geometry.dispose();group.remove(o);
  });
  Object.values(buckets).forEach(b=>{var g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(b.p,3));
    g.setAttribute('normal',new THREE.Float32BufferAttribute(b.n,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(b.uv,2));g.computeBoundingSphere();
    var o=new THREE.Mesh(g,b.mat);o.castShadow=o.receiveShadow=true;group.add(o);});return group;
}
function v2Upholstery(type,dim){
  var w=dim.w,h=dim.h,d=dim.d,g=new THREE.Group();
  var fabric=v2Material('Tecido linho',0x88958d,'linen',.94),cream=v2Material('Algodao cru',0xe6dfcf,'linen',.96);
  var accent=v2Material('Tecido terracota',0xa76c50,'linen',.96),wood=v2Material('Madeira nogueira',0x69503b,'wood',.52);
  if(type==='sofa'){
    v2Box(g,wood,w*.86,h*.13,d*.76,0,h*.065,0,.015);
    v2Box(g,fabric,w,h*.24,d,0,h*.26,0,.055);
    var count=Math.max(2,Math.round(w/.8)),cw=(w-.30)/count;
    for(var i=0;i<count;i++){
      var x=-w/2+.15+cw*(i+.5);
      v2Box(g,fabric,cw-.025,h*.20,d*.71,x,h*.46,d*.09,.055);
      v2Box(g,fabric,cw-.02,h*.43,d*.19,x,h*.755,-d*.36,.055,-.12);
    }
    [-1,1].forEach(s=>{v2Box(g,fabric,.15,h*.48,d*.95,s*(w/2-.075),h*.43,0,.045);
      v2Box(g,s<0?cream:accent,.34,.34,.12,s*w*.28,h*.68,-d*.12,.055,-.2,s*.13);});
  }else{
    v2Box(g,wood,w*.94,h*.27,d*.96,0,h*.15,0,.025);
    v2Box(g,cream,w*.96,h*.22,d*.93,0,h*.39,0,.06);
    v2Box(g,fabric,w,h*.80,.10,0,h*.60,-d/2+.05,.04);
    v2Box(g,cream,w*.98,h*.13,d*.74,0,h*.53,d*.10,.055);
    [-1,1].forEach(s=>v2Box(g,cream,w*.42,h*.14,.46,s*w*.24,h*.57,-d*.30,.075,-.08));
    // Folded woven cover across the foot; full mesh, visible from every angle.
    v2Box(g,accent,w*.99,h*.04,d*.28,0,h*.61,d*.31,.018);
  }
  V2.replaced.push(type);return v2Merge(g);
}
var v2OriginalFactory=null;
function v2GeoDoMovel(def,color,dim){
  var type=Object.keys(FURN.MOVEIS).find(k=>FURN.MOVEIS[k]===def),obj;
  if(type==='sofa'||type==='cama'){
    // Non-parametric pieces are scaled by the caller; build at catalog size in that case.
    obj=v2Upholstery(type,def.param?dim:{w:def.b[0],h:def.b[1],d:def.b[2]});
  }else{
    obj=v2OriginalFactory(def,color,dim);
    var cloth=['cortina','tapete'].includes(type),wood=['armario','guardaroupa','ripado','rack','criado','mesa','cadeira','estante'].includes(type);
    var metal=['coifa','geladeira','fogao'].includes(type),stone=['pia','balcao'].includes(type);
    obj.traverse(o=>{if(!o.isMesh)return;
      o.geometry=o.geometry.clone();v2UV(o.geometry,cloth?5:wood?1.4:2);
      o.material=v2Material('Acabamento '+type,0xffffff,cloth?'linen':wood?'wood':stone?'stone':null,cloth?.94:metal?.30:wood?.55:.48,metal?.68:0,true);
    });
  }
  obj.name='v2-'+type;
  if(['sofa','cama','mesa','criado','geladeira','balcao','pia','guardaroupa'].includes(type))v2Contact(obj);
  return obj;
}
var v2ShadowTexture=null;
function v2Contact(obj){
  if(!v2ShadowTexture){
    var c=document.createElement('canvas');c.width=c.height=128;var ctx=c.getContext('2d'),im=ctx.createImageData(128,128);
    for(var y=0;y<128;y++)for(var x=0;x<128;x++){
      var d=Math.max(Math.abs(x-63.5),Math.abs(y-63.5))/64,a=Math.pow(Math.max(0,1-d*d*d),2);
      im.data[(y*128+x)*4+3]=Math.round(a*95);
    }ctx.putImageData(im,0,0);v2ShadowTexture=new THREE.CanvasTexture(c);V2.textures.push(v2ShadowTexture);
  }
  var b=new THREE.Box3().setFromObject(obj),s=b.getSize(new THREE.Vector3()),center=b.getCenter(new THREE.Vector3());
  var m=new THREE.MeshBasicMaterial({map:v2ShadowTexture,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,toneMapped:false});
  var o=new THREE.Mesh(new THREE.PlaneGeometry(s.x,s.z),m);o.name='contact-occlusion';o.rotation.x=-Math.PI/2;
  o.position.set(center.x,.004,center.z);o.renderOrder=2;obj.add(o);
}
var v2Ground=new THREE.Mesh(new THREE.PlaneGeometry(150,150),new THREE.ShadowMaterial({opacity:.20}));
v2Ground.rotation.x=-Math.PI/2;v2Ground.position.y=-.04;v2Ground.receiveShadow=true;cena.add(v2Ground);
function v2Prepare(){
  if(V2.ready||!planta3d)return;V2.ready=true;
  MAT.matMadeira.map=v2Maps.oak;MAT.matMadeira.normalMap=null;MAT.matMadeira.bumpMap=v2Maps.oakBump;
  MAT.matMadeira.bumpScale=.002;MAT.matMadeira.roughness=.52;MAT.matMadeira.envMapIntensity=.65;
  MAT.matParede.map=v2Maps.plaster;MAT.matParede.normalScale.set(.025,.025);MAT.matParede.roughness=.95;
  MAT.matFrio.normalScale.set(.16,.16);MAT.matFrio.roughness=.38;
  [MAT.matMadeira,MAT.matParede,MAT.matFrio].forEach(m=>m.needsUpdate=true);
  // Local ceiling spots: one map per source, no six-face point-light shadows.
  PL_R.comodos.filter(c=>/Estar|Quarto|Cozinha/.test(c.nome)).forEach(c=>{
    var l=new THREE.SpotLight(0xffedd8,1.9,5.5,1.13,.65,1.5);
    l.position.set(c.cx-PL_R.ob.cx,PL_R.pd-.14,c.cz-PL_R.ob.cz);
    l.target.position.set(l.position.x,0,l.position.z);l.castShadow=PERFIL.sombrasVisita;
    l.shadow.mapSize.set(512,512);l.shadow.bias=-.0003;l.shadow.normalBias=.018;
    l.shadow.camera.near=.08;l.shadow.camera.far=5.5;V2.lights.add(l,l.target);
  });
  planta3d.traverse(o=>{if(o.isMesh&&o.name!=='contact-occlusion'){o.receiveShadow=true;if(o.name!=='plafon')o.castShadow=true;}});
  // Keep exterior light from casting the ceiling's silhouette over every room.
  if(tetoVisita)tetoVisita.traverse(o=>{if(o.isMesh)o.castShadow=false;});
}
function aplicaEstudoV2(){
  var inside=modo==='visita'||modo==='planta3d';v2Prepare();
  if(V2.ready&&!BK.BAKE.fila&&!V2.floorTint){
    V2.floorTint=true;
    planta3d.traverse(o=>{if(o.isMesh&&o.material===MAT.matMadeira&&o.geometry.attributes.color){
      var a=o.geometry.attributes.color;for(var i=0;i<a.count;i++){var l=.2126*a.getX(i)+.7152*a.getY(i)+.0722*a.getZ(i);a.setXYZ(i,l*1.50,l*1.08,l*.68);}a.needsUpdate=true;
    }});
  }
  V2.lights.visible=modo==='visita';v2Ground.visible=modo==='maquete';
  if(inside){sol.position.set(-5,7,10);sol.target.position.set(0,0,0);sol.target.updateMatrixWorld();}
  if(V2.mode!==modo){
    var e=inside?6:S;sol.shadow.camera.left=-e;sol.shadow.camera.right=e;sol.shadow.camera.top=e;sol.shadow.camera.bottom=-e;sol.shadow.camera.updateProjectionMatrix();
    sol.shadow.normalBias=inside?.012:.02;sol.shadow.bias=-.00015;
    sol.intensity=modo==='visita'?1.65:2.6;
    cena.children.filter(o=>o.isDirectionalLight&&o!==sol).forEach(o=>{o.intensity=inside?.22:.75;});
    var hemi=cena.children.find(o=>o.isHemisphereLight);if(hemi){hemi.intensity=modo==='visita'?.46:.85;hemi.groundColor.setHex(0xada79d);}
    V2.mode=modo;
  }
}
window.__estudo={version:2,planta:()=>PL_R,bake:()=>!!(BK&&BK.BAKE.fila),details:V2};
// Explicit deep links to the same interactive model, not a separate render viewer.
// v4: planta e visita esperam o pacote do interior antes de posicionar a camera.
setTimeout(function(){var start=new URLSearchParams(location.search).get('modo');
  if(['visita','planta3d','maquete'].includes(start)){
    var aplica=function(){vaiPara(start);
      if(start==='visita'){FP.x=-2.35;FP.z=-1.72;FP.yaw=Math.atan2(1.75,-2.47);FP.pitch=-.12;}
      suja();};
    if(start==='maquete')aplica();else garanteInterior().then(aplica,function(){});
  }
},0);

/* ============================================================================
   LUZ CALCULADA (v4). Mesma fisica e mesmas malhas do padrao aprovado
   (lightmap-v3.js, exterior-v3.js, interruptores.js); mudam o transporte e a montagem:
   - atlas em KTX2/UASTC (luz.js), decodificado no shader;
   - UVs de luz em binario (binario.js), copiadas com arrays tipados;
   - exterior ja indexado e com o atlas reempacotado (gerador/luz.py);
   - shaders compilados FORA do laco (`compileAsync`) antes da troca de material, para
     a luz entrar sem engasgo;
   - a invalidacao por edicao de moveis vem do editor (`mobiliaMudou`), nao de uma
     comparacao de todos os moveis a cada quadro.
   ============================================================================ */
var LUZES_CENA=cena.children.filter(o=>o.isLight);
var LUZES_DIR=LUZES_CENA.filter(o=>o.isDirectionalLight);
var HEMI=cena.children.find(o=>o.isHemisphereLight);
function trechoLuz(meta,extra){
  return THREE.ShaderChunk.lights_fragment_maps
    .replace('lightMapTexel.rgb * lightMapIntensity',decodificaGLSL(meta)+' * lightMapIntensity')
    .replace('iblIrradiance += getIBLIrradiance( geometryNormal );',extra);
}
// Sem KHR_parallel_shader_compile (alguns Android, rasterizador de software) a compilacao
// seria sincrona de qualquer jeito: nao ha o que adiantar fora do laco.
function compilaAntes(grupo){
  if(!ren.compileAsync||!ren.extensions.has('KHR_parallel_shader_compile'))return Promise.resolve();
  return ren.compileAsync(grupo,cam,cena);
}
function copiaAtributo(src,ind,base,n){
  // Mesma leitura do original (`getX/getY/getZ`, que tira a normalizacao da cor em
  // bytes), com um atalho para o caso comum de Float32Array simples.
  var size=src.itemSize,a=new Float32Array(n*size),i,c,ix;
  if(!src.isInterleavedBufferAttribute&&!src.normalized&&src.array instanceof Float32Array){
    var arr=src.array;
    for(i=0;i<n;i++){ix=ind[base+i]*size;for(c=0;c<size;c++)a[i*size+c]=arr[ix+c];}
  }else for(i=0;i<n;i++){ix=ind[base+i];a[i*size]=src.getX(ix);a[i*size+1]=src.getY(ix);if(size===3)a[i*size+2]=src.getZ(ix);}
  return new THREE.BufferAttribute(a,size);
}
function uvLuz(U,base,n,escala){
  var a=new Float32Array(n*2),k=1/escala;for(var i=0;i<n*2;i++)a[i]=U[base*2+i]*k;return new THREE.BufferAttribute(a,2);
}

// ---- interior (antes: lightmap-v3.js) ---------------------------------------
var V3={started:false,ready:false,error:null,materials:[],disabled:false};
var v3PreviousFrame=aplicaEstudoV2;
var v3Status=document.createElement('div');v3Status.style.cssText='position:fixed;left:18px;top:18px;z-index:90;padding:9px 14px;border-radius:8px;background:#132622e8;color:#e3f1e7;font:13px system-ui;pointer-events:none';
v3Status.textContent='Preparando iluminação…';v3Status.hidden=true;document.body.appendChild(v3Status);
function v3Load(){
 V3.started=true;v3Status.hidden=false;ESTADO.interior='luz';ESTADO.tempos.interiorLuzPedida=performance.now();
 Promise.all([
   carregaBinario(CFG.assets.interiorUV),
   carregaAtlas(ren,CFG.lib.basis,CFG.assets.interiorLuz[PERFIL.luzInterior||PERFIL.luz],PERFIL.mipLuz)
 ]).then(function(r){
   ESTADO.tempos.interiorLuzBaixada=performance.now();
   var bin=r[0],map=r[1],A=bin.arrays,meta=CFG.luz.interior;
   map.anisotropy=Math.min(8,ren.capabilities.getMaxAnisotropy());map.needsUpdate=true;
   var original=[];planta3d.traverse(o=>{if(o.isMesh)original.push(o);});
   var oldGeometries=new Set(original.map(o=>o.geometry));
   var cache=new Map();
   function bakedMaterial(m){
     if(!m.isMeshStandardMaterial)return m;
     if(cache.has(m))return cache.get(m);
     var n=m.clone();n.lightMap=map;n.lightMapIntensity=Math.PI;n.envMapIntensity=.35;
     // No second ambient diffuse contribution over the transported diffuse light.
     n.onBeforeCompile=shader=>{
       shader.uniforms.v3Active={value:V3.disabled?0:1};n.userData.shader=shader;
       shader.fragmentShader='uniform float v3Active;\n'+shader.fragmentShader
         .replace('#include <lights_fragment_maps>',trechoLuz(meta,'iblIrradiance += (1.0-v3Active)*getIBLIrradiance( geometryNormal );'));
     };
     n.customProgramCacheKey=()=> 'cedros-transport-v4';n.needsUpdate=true;cache.set(m,n);V3.materials.push(n);return n;
   }
   var novos=[];
   bin.cab.entradas.forEach(d=>{
     var old=original[d.slot];if(!old)throw Error('Missing mesh slot '+d.slot);
     if(d.correctedWorldMatrix){old.parent.updateMatrixWorld(true);var corrected=new THREE.Matrix4().fromArray(d.correctedWorldMatrix);corrected.premultiply(old.parent.matrixWorld.clone().invert());corrected.decompose(old.position,old.quaternion,old.scale);old.updateMatrixWorld(true);}
     if(old.geometry.attributes.position.count!==d.sourceVertexCount)throw Error('Mesh layout changed at slot '+d.slot);
     var g=new THREE.BufferGeometry(),n=d.nCantos;
     for(var k of ['position','normal','uv','color']){
       var src=k==='color'&&old.userData.geoPlanta?old.userData.geoPlanta.attributes.color:old.geometry.attributes[k];
       if(k==='position'&&d.correctedPosition)src=new THREE.Float32BufferAttribute(A[d.correctedPosition],3);
       if(!src)continue;g.setAttribute(k,copiaAtributo(src,A.ind,d.ind,n));
     }
     g.setAttribute('uv1',uvLuz(A.uv1,d.ind,n,bin.cab.uvNormalizado));
     // Match supplied normals to the corrected outward winding used for transport.
     var pp=g.attributes.position,nn=g.attributes.normal;
     if(nn){var aa=new THREE.Vector3(),bb=new THREE.Vector3(),cc=new THREE.Vector3(),normal=new THREE.Vector3();
       for(var i=0;i<pp.count;i+=3){aa.fromBufferAttribute(pp,i);bb.fromBufferAttribute(pp,i+1).sub(aa);cc.fromBufferAttribute(pp,i+2).sub(aa);normal.fromBufferAttribute(nn,i);
         if(bb.cross(cc).dot(normal)<0)for(var j=0;j<3;j++)nn.setXYZ(i+j,-nn.getX(i+j),-nn.getY(i+j),-nn.getZ(i+j));
       }
     }
     d.groups.forEach(a=>g.addGroup(a.start,a.count,a.materialIndex));g.computeBoundingSphere();g.computeBoundingBox();
     var mat=Array.isArray(old.material)?old.material.map(bakedMaterial):bakedMaterial(old.material);
     novos.push({d:d,old:old,g:g,mat:mat});
   });
   // Compila os programas novos fora do laco antes de trocar: a luz entra sem engasgo.
   ESTADO.tempos.interiorMalhas=performance.now();
   var prova=new THREE.Group();novos.forEach(x=>prova.add(new THREE.Mesh(x.g,x.mat)));
   return compilaAntes(prova).catch(()=>{}).then(()=>{
   novos.forEach(x=>{
     var d=x.d,old=x.old,g=x.g,mat=x.mat;
     if(d.instance!==null){
       var o=new THREE.Mesh(g,mat),a=new THREE.Matrix4();old.getMatrixAt(d.instance,a);o.matrix.copy(old.matrix).multiply(a);o.matrix.decompose(o.position,o.quaternion,o.scale);old.parent.add(o);old.visible=false;
     }else{
       old.geometry=g;old.material=mat;old.userData.geoVisita=g;delete old.userData.geoPlanta;delete old.userData.materialVisita;
     }
   });
   original.forEach(o=>{if(o.name==='contact-occlusion')o.visible=false;});
   var retained=new Set();cena.traverse(o=>{if(o.isMesh)retained.add(o.geometry);});oldGeometries.forEach(g=>{if(!retained.has(g))g.dispose();});
   V3.versao=versaoMobilia;
   V3.ready=true;ESTADO.interior='pronto';ESTADO.tempos.interior=performance.now();v3Status.textContent='Sala revisada';setTimeout(()=>{if(!V3.disabled)v3Status.hidden=true;},2500);
   invalidaSombras();
   });
 }).catch(e=>{V3.error=String(e);ESTADO.interior='erro';ESTADO.erro=String(e);v3Status.textContent='Não foi possível carregar a iluminação. Atualize a página.';console.error(e);
   // sem a luz calculada, volta o bake em JS que ficou de reserva
   if(bakeReserva&&BK){BK.BAKE.fila=bakeReserva;bakeReserva=null;}
   suja();});
}
aplicaEstudoV2=function(){
 v3PreviousFrame();
 var inside=modo==='visita'||modo==='planta3d';
 if(inside&&V2.floorTint&&!BK.BAKE.fila&&!V3.started)v3Load();
 if(!V3.ready)return;
 if(!V3.disabled&&versaoMobilia!==V3.versao){
   // The editor rebuilds objects on move/resize/remove: any change invalidates the bake.
   V3.disabled=true;V2.mode=null;V3.materials.forEach(m=>{m.lightMapIntensity=0;if(m.userData.shader)m.userData.shader.uniforms.v3Active.value=0;});v3Status.hidden=false;v3Status.textContent='Layout alterado: iluminação dinâmica. Recarregue para voltar à cena calculada.';
   invalidaSombras();
 }
 if(inside&&!V3.disabled){V2.lights.visible=false;LUZES_CENA.forEach(o=>o.intensity=0);}
};
window.__bakeV3=V3;

// ---- exterior (antes: exterior-v3.js) ---------------------------------------
var EX={started:false,ready:false,error:null};window.__exteriorV3=EX;
var exFrame=aplicaEstudoV2;
function exLoad(){
 EX.started=true;
 Promise.all([carregaBinario(CFG.assets.exteriorUV),carregaAtlas(ren,CFG.lib.basis,CFG.assets.exteriorLuz[PERFIL.luzExterior||PERFIL.luz],PERFIL.mipLuz)]).then(function(r){
  var bin=r[0],map=r[1],A=bin.arrays,meta=CFG.luz.exterior,escala=1/bin.cab.uvNormalizado;
  var originals=[];predio.traverse(o=>{if(o.isMesh)originals.push(o);});var materials=new Map(),buckets=new Map();
  function material(m){
   if(materials.has(m))return materials.get(m);
   var n=m.clone();n.lightMap=map;n.lightMapIntensity=Math.PI;n.envMap=ambientePBR;n.envMapIntensity=.45;
   n.onBeforeCompile=shader=>{
    shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_maps>',trechoLuz(meta,'')).replace('#include <lights_fragment_end>','#include <lights_fragment_end>\nreflectedLight.directDiffuse=vec3(0.0);');
   };n.customProgramCacheKey=()=> 'cedros-exterior-bake-v4';n.needsUpdate=true;materials.set(m,n);return n;
  }
  bin.cab.entradas.forEach(d=>{if(!buckets.has(d.slot))buckets.set(d.slot,[]);buckets.get(d.slot).push(d);});
  var M=new THREE.Matrix4(),NM=new THREE.Matrix3(),v=new THREE.Vector3(),trocas=[];
  buckets.forEach((items,slot)=>{
   var old=originals[slot];if(!old)throw Error('Exterior mesh missing '+slot);
   var src={};['position','normal','uv','color'].forEach(k=>{if(old.geometry.attributes[k])src[k]=old.geometry.attributes[k];});
   var nU=0,nT=0;items.forEach(d=>{nU+=d.nUnicos;nT+=d.nCantos;});
   var out={};Object.keys(src).forEach(k=>{out[k]=new Float32Array(nU*src[k].itemSize);});
   var uv1=new Float32Array(nU*2),idx=nU>65535?new Uint32Array(nT):new Uint16Array(nT),groups=[],vo=0,to=0;
   items.forEach(d=>{
    if(old.geometry.attributes.position.count!==d.sourceVertexCount)throw Error('Exterior geometry mismatch');
    var temM=d.instance!==null;if(temM){old.getMatrixAt(d.instance,M);NM.getNormalMatrix(M);}
    for(var j=0;j<d.nUnicos;j++){
     var s=A.src[d.src+j],w=vo+j;
     for(var k in src){
      var at=src[k],sz=at.itemSize;
      if(temM&&(k==='position'||k==='normal')){
       v.fromBufferAttribute(at,s);if(k==='position')v.applyMatrix4(M);else v.applyNormalMatrix(NM);
       out[k][w*3]=v.x;out[k][w*3+1]=v.y;out[k][w*3+2]=v.z;
      }else{out[k][w*sz]=at.getX(s);if(sz>1)out[k][w*sz+1]=at.getY(s);if(sz>2)out[k][w*sz+2]=at.getZ(s);}
     }
     uv1[w*2]=A.uv1[(d.uv+j)*2]*escala;uv1[w*2+1]=A.uv1[(d.uv+j)*2+1]*escala;
    }
    for(var t=0;t<d.nCantos;t++)idx[to+t]=A.tri[d.tri+t]+vo;
    for(var gr of d.groups)groups.push({start:to+gr.start,count:gr.count,materialIndex:gr.materialIndex});
    vo+=d.nUnicos;to+=d.nCantos;
   });
   var g=new THREE.BufferGeometry();
   Object.keys(out).forEach(k=>g.setAttribute(k,new THREE.BufferAttribute(out[k],src[k].itemSize)));
   g.setAttribute('uv1',new THREE.BufferAttribute(uv1,2));g.setIndex(new THREE.BufferAttribute(idx,1));
   // Each source batch has one material; a single group keeps original draw calls.
   if(Array.isArray(old.material))groups.forEach(gr=>g.addGroup(gr.start,gr.count,gr.materialIndex));
   g.computeBoundingSphere();g.computeBoundingBox();
   var mat=Array.isArray(old.material)?old.material.map(material):material(old.material);
   trocas.push({old:old,g:g,mat:mat});
  });
  var prova=new THREE.Group();trocas.forEach(x=>prova.add(new THREE.Mesh(x.g,x.mat)));
  return compilaAntes(prova).catch(()=>{}).then(()=>{
  var antigas=new Set();
  trocas.forEach(x=>{var old=x.old,g=x.g,mat=x.mat;
   if(old.isInstancedMesh){var replacement=new THREE.Mesh(g,mat);replacement.name=old.name;replacement.userData={...old.userData};replacement.position.copy(old.position);replacement.quaternion.copy(old.quaternion);replacement.scale.copy(old.scale);replacement.visible=old.visible;replacement.castShadow=true;replacement.receiveShadow=PERFIL.recebeSombraFachada;old.parent.add(replacement);old.parent.remove(old);antigas.add(old);}else{old.geometry=g;old.material=mat;old.castShadow=true;old.receiveShadow=PERFIL.recebeSombraFachada;}
  });
  // v4: a geometria instanciada que saiu de cena volta a memoria de video (antes ficava).
  var vivas=new Set();cena.traverse(o=>{if(o.isMesh)vivas.add(o.geometry);});
  antigas.forEach(o=>{if(!vivas.has(o.geometry))o.geometry.dispose();o.dispose();});
  // Ground receives live shadows; architectural diffuse light is already baked.
  v2Ground.geometry.dispose();v2Ground.geometry=new THREE.BoxGeometry(1,1,1);v2Ground.rotation.set(0,0,0);
  v2Ground.material=new THREE.MeshStandardMaterial({color:0x34464a,roughness:1,metalness:0});v2Ground.receiveShadow=true;
  EX.ready=true;ESTADO.exterior='pronto';ESTADO.tempos.exterior=performance.now();_tiraCapaAposQuadro=true;invalidaSombras();
  });
 }).catch(e=>{EX.error=String(e);ESTADO.exterior='erro';ESTADO.erro=String(e);console.error(e);tiraCapa();suja();});
}
aplicaEstudoV2=function(){
 exFrame();
 if(modo!=='maquete')return;
 if(!EX.started)exLoad();
 if(!EX.ready)return;
 v2Ground.scale.set(conjuntoCompleto?88:42,.45,conjuntoCompleto?36:24);v2Ground.position.set(conjuntoCompleto?22:0,-.27,conjuntoCompleto?4:0);
 sol.position.set(-18,110,55);sol.target.position.set(22,25,0);sol.target.updateMatrixWorld(true);sol.intensity=2.5;
 var e=85;sol.shadow.camera.left=-e;sol.shadow.camera.right=e;sol.shadow.camera.top=e;sol.shadow.camera.bottom=-e;sol.shadow.camera.near=.5;sol.shadow.camera.far=260;sol.shadow.camera.updateProjectionMatrix();sol.shadow.normalBias=.035;sol.shadow.bias=-.00008;
 LUZES_DIR.forEach(o=>{if(o!==sol)o.intensity=0;});
 if(HEMI)HEMI.intensity=.7;
};
setTimeout(()=>{if(new URLSearchParams(location.search).get('conjunto')==='1'&&!conjuntoCompleto)document.getElementById('verConjunto').click();},0);

// ---- interruptores (antes: interruptores.js) --------------------------------
// Per-room luminaire switches. Static transport is invalidated on first change.
var ROOMLIGHTS={ready:false,rooms:[],group:new THREE.Group()};cena.add(ROOMLIGHTS.group);window.__roomLights=ROOMLIGHTS;
// v4: a resolucao em tela de toque vem do perfil (qualidade.js), nao daqui.
ROOMLIGHTS.mobile=CELULAR||matchMedia('(pointer:coarse)').matches;
function invalidateRoomShadows(){ROOMLIGHTS.rooms.forEach(r=>r.light.shadow.needsUpdate=true);invalidaSombras();}
ren.domElement.addEventListener('webglcontextrestored',()=>{ROOMLIGHTS.shadowKey=null;invalidateRoomShadows();});
var lightPanel=document.createElement('details');lightPanel.id='interruptores';lightPanel.hidden=true;
lightPanel.style.cssText='position:fixed;right:16px;bottom:16px;z-index:95;max-width:280px;max-height:55vh;overflow:auto;background:#17252bf5;color:#eef4f1;padding:12px;border:1px solid #547366;border-radius:10px;font:14px system-ui';
var summary=document.createElement('summary');summary.textContent='💡 Luzes do apartamento';summary.style.cursor='pointer';lightPanel.appendChild(summary);document.body.appendChild(lightPanel);
function dynamicRoomLights(){
 V3.disabled=true;V2.mode=null;
 V3.materials.forEach(m=>{m.lightMapIntensity=0;if(m.userData.shader)m.userData.shader.uniforms.v3Active.value=0;});
 v3Status.textContent='Iluminação controlada pelos interruptores.';v3Status.hidden=false;
 setTimeout(()=>{v3Status.hidden=true;},3000);
}
function prepareRoomLights(){
 if(ROOMLIGHTS.ready||!V3.ready)return;ROOMLIGHTS.ready=true;
 var lamps=[];planta3d.traverse(o=>{if(o.name==='plafon'){o.material=o.material.clone();lamps.push(o);}});
 PL_R.comodos.forEach((c,i)=>{
  var x=c.cx-PL_R.ob.cx,z=c.cz-PL_R.ob.cz;
  var light=new THREE.SpotLight(0xfff1da,15,7,1.42,.85,1.5);light.position.set(x,PL_R.pd-.20,z);light.target.position.set(x,0,z);light.castShadow=true;
  light.shadow.mapSize.set(PERFIL.sombraComodos,PERFIL.sombraComodos);light.shadow.camera.near=.05;light.shadow.camera.far=7;light.shadow.bias=-.001;light.shadow.normalBias=.045;
  light.shadow.autoUpdate=false;light.shadow.needsUpdate=true;
  ROOMLIGHTS.group.add(light,light.target);
  var lamp=lamps[i],row={name:c.nome,on:true,light,lamp};ROOMLIGHTS.rooms.push(row);
  var button=document.createElement('button');button.type='button';button.setAttribute('role','switch');button.setAttribute('aria-checked','true');button.dataset.room=String(i);
  button.style.cssText='display:block;width:100%;padding:10px;margin-top:8px;text-align:left;color:inherit;background:#284439;border:1px solid #719987;border-radius:6px;cursor:pointer';
  function paint(){button.textContent=c.nome+' · '+(row.on?'Ligada':'Desligada');button.setAttribute('aria-checked',String(row.on));button.style.background=row.on?'#284439':'#30373b';}
  button.onclick=()=>{row.on=!row.on;dynamicRoomLights();paint();suja();};paint();lightPanel.appendChild(button);
 });
}
var beforeRoomLights=aplicaEstudoV2;
aplicaEstudoV2=function(){
 beforeRoomLights();var inside=modo==='visita'||modo==='planta3d';lightPanel.hidden=!inside;
 prepareRoomLights();ROOMLIGHTS.group.visible=inside&&V3.disabled;
 // Zero intensity alone does not stop Three.js rendering a shadow map.
 LUZES_DIR.forEach(o=>{
  if(o.userData.exteriorCastShadow===undefined)o.userData.exteriorCastShadow=o.castShadow;
  o.castShadow=inside?false:o.userData.exteriorCastShadow;
 });
 if(!inside||!V3.disabled)return;
 // No exterior sun projected through the open cutaway plan or a non-shadowing roof.
 // Dynamic interior is lit by the actual ceiling fixtures and a modest sky fill.
 V2.lights.visible=false;LUZES_DIR.forEach(o=>o.intensity=0);
 if(HEMI)HEMI.intensity=.14;
 V3.materials.forEach(m=>m.envMapIntensity=.10);
 if(tetoVisita)tetoVisita.traverse(o=>{if(o.isMesh)o.castShadow=o.name!=='plafon';});
 var bits=0;
 ROOMLIGHTS.rooms.forEach((r,i)=>{r.light.intensity=r.on?15:0;if(r.lamp)r.lamp.material.color.setHex(r.on?0xfff7e2:0x787976);if(r.on)bits|=1<<i;});
 // v4: a chave e numerica -- modo, interruptores e versao da mobilia (o editor avisa).
 // Camera movement does not change shadows.
 var key=(modo==='visita'?1:2)*1e9+bits*1e6+versaoMobilia;
 if(key!==ROOMLIGHTS.shadowKey){ROOMLIGHTS.shadowKey=key;invalidateRoomShadows();}
};

/* ---- qualidade ao vivo ------------------------------------------------------
   Quando o governador chega ao piso de resolucao e ainda nao segura a meta, aplica ja o
   que o perfil de baixo muda sem recriar o contexto. O resto (MSAA, resolucao do atlas)
   vale na proxima abertura -- o perfil foi gravado. */
function rebaixaAoVivo(nome){
 var p=PERFIS[nome];if(!p)return;
 PERFIL.fps=Math.min(PERFIL.fps,p.fps);PERFIL.fpsGiro=Math.min(PERFIL.fpsGiro,p.fpsGiro);
 if(p.solMapa<sol.shadow.mapSize.x){sol.shadow.mapSize.set(p.solMapa,p.solMapa);if(sol.shadow.map){sol.shadow.map.dispose();sol.shadow.map=null;}}
 if(!p.recebeSombraFachada){PERFIL.recebeSombraFachada=false;predio.traverse(o=>{if(o.isMesh&&EX.ready)o.receiveShadow=false;});}
 if(!p.sombrasVisita){PERFIL.sombrasVisita=false;V2.lights.children.forEach(l=>{if(l.isLight)l.castShadow=false;});}
 PERFIL.rebaixadoPara=nome;invalidaSombras();
}

/* ---- medidor (?perf=1): FPS, perfil e resolucao, para testar em celular de verdade -- */
if(new URLSearchParams(location.search).get('perf')==='1'){
 var hud=document.createElement('div');hud.style.cssText='position:fixed;left:8px;top:8px;z-index:99;font:12px/1.4 ui-monospace,monospace;background:#000b;color:#cfe;padding:6px 8px;border-radius:6px;pointer-events:none;white-space:pre';
 document.body.appendChild(hud);var nq=0,t0=performance.now();
 (function mede(){nq=ESTADO.quadros;setTimeout(function(){var t=performance.now(),f=(ESTADO.quadros-nq)*1000/(t-t0);t0=t;
  hud.textContent='perfil '+PERFIL.nome+(PERFIL.rebaixadoPara?' -> '+PERFIL.rebaixadoPara:'')+' ('+QUAL.origem+')\n'+f.toFixed(0)+' quadros/s  meta '+PERFIL.fpsMeta+'\nDPR '+GOV.dpr.toFixed(2)+'  '+ren.info.render.calls+' chamadas\n'+(QUAL.placa.gpu||'GPU ?');mede();},1000);})();
}

window.__maq = { cena:cena, cam:cam, ren:ren, orb:orb, alvo:alvo, predio:predio,
                 brilho:brilho, andar:ANDAR, N:N, poeCam:poeCam, quadro:quadro,
                 vaiPara:vaiPara, FP:FP, modo:function(){ return modo; },
                 editor:function(){return typeof editorCedros!=="undefined"?editorCedros:null;}, caminhada:caminhada, caminhoAte:caminhoAte, livre:livre, passoVisita:passoVisita, paredes:paredes, planta:function(){ return planta3d; },
                 suja:suja, invalidaSombras:invalidaSombras, garanteInterior:garanteInterior };
window.__miniatura = { estado: ESTADO, perfil: PERFIL, qualidade: QUAL, governador: GOV, config: CFG,
  laco: function () { return { pendente: _pendente, sujo: _sujo, visivel: _visivel, pronto: _lacoPronto, modo: modo }; } };
// A luz externa comeca a descer junto com a primeira imagem, nao no primeiro quadro.
exLoad();
_lacoPronto = true; suja();
})().catch(function (e) {
  ESTADO.erro = String(e && e.stack || e); console.error(e);
  var d = document.getElementById("dica"); if (d) d.textContent = "Não foi possível abrir a maquete neste aparelho.";
});

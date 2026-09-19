# -*- coding: utf-8 -*-
"""Pagina de TESTE da maquete: um predio, uma ficha embaixo, e mais nada.

Pedido de 19/09/2026: "esquece o mapa para fazermos um teste aqui. Gere uma pagina e
uma miniatura do predio desejado. Com uma janela de informacoes em baixo."

E de proposito que isto NAO e o renderizador: sem cidade, sem streaming, sem relevo e
sem as tres etapas, a pagina abre em 1,5 MB e a maquete e a unica coisa que existe pra
olhar -- que e o ponto de um teste. A geometria segue a mesma regra do
`montaMaquete` do `renderizador-v18/app.js` (laje, parede e caixilho por pavimento,
tudo em `InstancedMesh`), com um degrau a mais de detalhe que so cabe aqui: as janelas
sao ESQUADRIAS DE VERDADE, distribuidas ao longo de cada face, em vez de uma fita
continua de vidro.

    python pipeline/pagina_maquete.py                    # -> v18/maquete.html
    python pipeline/pagina_maquete.py --saida /tmp/x.html
"""
import io, json, os, sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
THREE = os.path.join(RAIZ, "renderizador-v18", "lib", "three.min.js")


def arg(nome, padrao=None):
    return sys.argv[sys.argv.index(nome) + 1] if nome in sys.argv else padrao


SAIDA = arg("--saida", os.path.join(RAIZ, "v18", "maquete.html"))

# ---------------------------------------------------------------------------
# O IMOVEL. Tudo que a pagina mostra sai daqui -- trocar de predio e trocar este
# bloco. As medidas do apartamento sao as da planta enviada em 19/09/2026
# (16,5 x 9,2 m de piso, pe-direito 2,60 m, recuo no canto sudeste).
# ---------------------------------------------------------------------------
IMOVEL = {
    "empreendimento": "Edifício da planta",
    "unidade": "Apartamento 304",
    "endereco": "Rua da Planta, 120 · Centro",
    "tag": "À venda",
    "preco": "R$ 690.000",
    "andar": 3,                     # pavimento da unidade (0 = térreo)
    "predio": {
        # Pegada do predio em metros, no sentido horario visto de cima. Nao e o
        # contorno da PLANTA: e o da casca, 40 cm maior de cada lado.
        "pegada": [[-8.45, 4.80], [8.45, 4.80], [8.45, -4.80], [-8.45, -4.80]],
        "pavimentos": 6,
        "pe_direito_pav": 3.15      # laje a laje; o mesmo LV do renderizador
    },
    "ficha": [
        ["Área útil", "133,3 m²"],
        ["Quartos", "2"],
        ["Banheiros", "1"],
        ["Pé-direito", "2,60 m"],
        ["Pavimento", "3º de 6"],
        ["Vagas", "2"]
    ],
    "comodos": [
        ["Sala", "50,7 m²"], ["Área privativa", "21,4 m²"],
        ["Quarto 1", "17,4 m²"], ["Quarto 2", "15,8 m²"],
        ["Hall", "15,8 m²"], ["Banho", "6,2 m²"], ["Cozinha", "5,9 m²"]
    ]
}

PAGINA = u"""<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Maquete 3D · %(TITULO)s</title>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='6' fill='%231A222C'/%3E%3Cpath d='M5 15L16 6l11 9v12h-8v-8h-6v8H5z' fill='%234BDB7C'/%3E%3C/svg%3E">
<style>
  :root{
    --void:#0E141B; --line:rgba(255,255,255,.12); --txt:#E7EBF0; --verde:#4BDB7C;
    --ui:system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",sans-serif;
  }
  *{box-sizing:border-box;margin:0;padding:0}
  [hidden]{display:none!important}
  /* `overflow-x:hidden` sozinho ESCONDE o estouro, nao o conserta: o documento
     continua largo, `clientWidth` da caixa da cena continua largo, e a maquete passa
     a ser desenhada num canvas maior que a tela -- foi assim que o predio apareceu
     cortado no lado direito no telefone. O conserto de verdade sao os `min-width:0`
     abaixo, que e o que deixa os itens do flex encolherem. */
  /* MINIATURA E MINIATURA: ela tem TAMANHO PROPRIO, nao o tamanho que sobra.

     A primeira versao era uma cena `flex:1` com a ficha embaixo -- ou seja, um
     visualizador de tela cheia, e no celular o predio ocupava 670 dos 900 px. Nada
     nisso e miniatura. Aqui a pagina volta a ser uma PAGINA que rola: coluna centrada,
     painel da maquete com altura declarada, ficha logo abaixo dele. Quem quiser ver de
     perto tem o botao Ampliar, que ai sim toma a tela -- por pedido, e nao por padrao. */
  html{background:var(--void)}
  body{font-family:var(--ui);color:var(--txt);-webkit-font-smoothing:antialiased;
    background:var(--void);min-height:100%;user-select:none;-webkit-user-select:none;
    -webkit-tap-highlight-color:transparent;
    padding:16px calc(16px + env(safe-area-inset-right))
            calc(24px + env(safe-area-inset-bottom))
            calc(16px + env(safe-area-inset-left))}
  .folha{max-width:720px;margin:0 auto}

  /* A MAQUETE em cima, a ficha embaixo. A maquete e `flex:1` e a ficha tem altura
     propria: numa tela baixa quem cede espaco e o 3D, nunca a informacao. */
  /* `clamp` e nao `vh` puro: em tela baixa e deitada 40vh vira uma faixa de 150 px, e
     num monitor grande vira meio metro de predio. O piso e o teto sao o que dao a
     miniatura o mesmo tamanho aparente nos dois. */
  /* A MAQUETE NAO TEM MOLDURA. Ela e um canvas transparente que se sobrepoe ao
     cartao: a margem negativa de baixo e o que faz o predio passar POR CIMA da ficha
     em vez de ficar numa caixa empilhada acima dela. O degrade e o unico fundo que
     sobrou -- ele da presenca ao volume sem prende-lo a um chao, que era o que o
     disco de terreno fazia. */
  #cena{position:relative;height:clamp(220px,40vh,420px);min-width:0;z-index:2;
    margin-bottom:-46px;
    background:radial-gradient(ellipse 62% 58% at 50% 46%,
      rgba(86,124,168,.17),rgba(86,124,168,.05) 55%,transparent 72%)}
  @supports (height:40dvh){ #cena{height:clamp(220px,40dvh,420px)} }
  body.ampliada{overflow:hidden}
  body.ampliada #cena{position:fixed;inset:0;height:auto;margin:0;z-index:50;
    background:radial-gradient(ellipse 52% 48% at 50% 46%,
      rgba(86,124,168,.15),transparent 70%),var(--void)}
  #c{display:block;width:100%;height:100%;touch-action:none;cursor:grab}
  #c:active{cursor:grabbing}

  /* O topo da tela de um celular com entalhe nao comeca em zero: `viewport-fit=cover`
     (no <meta>) pede a tela inteira, e e por isso que daqui pra baixo todo canto usa
     `env(safe-area-inset-*)`. Sem isso o selo fica debaixo do relogio do sistema. */
  #selo{position:absolute;top:10px;left:10px;display:flex;align-items:center;gap:7px;
    padding:6px 11px;border-radius:999px;background:rgba(12,18,25,.72);
    border:1px solid rgba(75,219,124,.42);backdrop-filter:blur(8px);
    font-size:11.5px;letter-spacing:.02em;pointer-events:none}
  #selo i{width:7px;height:7px;border-radius:50%;background:var(--verde);flex:none;
    box-shadow:0 0 10px 1px rgba(75,219,124,.85);animation:pisca 1.6s ease-in-out infinite}
  @keyframes pisca{0%,100%{opacity:1}50%{opacity:.25}}

  #ctrl{position:absolute;top:10px;right:10px;display:flex;gap:6px}
  /* Ampliada, os controles passam a respeitar o entalhe. Fora dela quem cuida disso e
     o `padding` do corpo, e somar os dois empurraria os botoes pra dentro da maquete. */
  body.ampliada #selo{top:calc(12px + env(safe-area-inset-top));
    left:calc(12px + env(safe-area-inset-left))}
  body.ampliada #ctrl{top:calc(12px + env(safe-area-inset-top));
    right:calc(12px + env(safe-area-inset-right))}
  #ctrl button{font:inherit;font-size:11px;padding:7px 11px;border-radius:7px;cursor:pointer;
    background:rgba(12,18,25,.72);border:1px solid var(--line);color:var(--txt);
    backdrop-filter:blur(8px);transition:.15s;min-height:34px;
    touch-action:manipulation}   /* mata o zoom de toque duplo no botao */
  #ctrl button:hover{background:rgba(255,255,255,.14)}
  #ctrl button[aria-pressed=true]{border-color:rgba(75,219,124,.5);
    background:rgba(75,219,124,.16);color:#BFF3D2}
  /* A dica fica POR CIMA da maquete, entao ela precisa de fundo proprio: sobre a
     parede clara do predio, texto a 45% de opacidade desaparece. O degrade e so na
     faixa de baixo -- escurecer o painel inteiro apagaria a sombra no chao, que e a
     pista de profundidade da cena. */
  /* A dica saiu do canvas. Sem moldura nao ha rodape onde ela caiba: em cima do
     predio ela fica ilegivel, e na faixa de baixo ela cai justamente onde o canvas se
     sobrepoe ao cartao. Virou a ultima linha da ficha, que e onde legenda mora. */
  #dica{margin-top:13px;padding-top:11px;border-top:1px solid var(--line);
    font-size:10.5px;opacity:.42;letter-spacing:.04em}

  /* A JANELA DE INFORMACOES. Rola por dentro: numa tela de telefone deitado a ficha
     inteira nao cabe, e encolher a maquete ate o predio sumir seria pior. */
  /* O topo generoso e onde a maquete pousa por cima. Sem ele o predio cairia em
     cima do "A VENDA". */
  #ficha{position:relative;background:rgba(18,25,33,.92);border:1px solid var(--line);
    border-radius:14px;padding:56px 18px 18px}
  body.ampliada #ficha{display:none}
  #ficha .topo{display:flex;align-items:flex-start;gap:8px 14px;flex-wrap:wrap}
  /* Sem isto o bloco do titulo tem `min-width:auto` e se recusa a encolher abaixo do
     conteudo, empurrando o preco pra fora da tela. */
  #ficha .topo>div{min-width:0}
  #ficha .topo>div:first-child{flex:1 1 220px}
  #ficha .tag{font-size:9px;letter-spacing:.14em;text-transform:uppercase;opacity:.6;color:#FFC24B}
  #ficha h1{font-size:17px;font-weight:650;line-height:1.25;margin:3px 0 2px;
    overflow-wrap:anywhere}
  #ficha .sub{font-size:12px;opacity:.6;overflow-wrap:anywhere}
  #ficha .preco{margin-left:auto;text-align:right;font-size:19px;font-weight:700;
    font-variant-numeric:tabular-nums;white-space:nowrap}
  #ficha .preco small{display:block;font-size:9px;letter-spacing:.14em;
    text-transform:uppercase;opacity:.5;font-weight:600}
  .stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(92px,1fr));gap:10px 16px;
    margin-top:13px;padding-top:12px;border-top:1px solid var(--line)}
  .stats div{font-size:10px;opacity:.55}
  .stats b{display:block;font-size:14px;font-weight:650;opacity:1;margin-top:2px;
    font-variant-numeric:tabular-nums}
  .comodos{margin-top:13px;padding-top:12px;border-top:1px solid var(--line)}
  .comodos h2{font-size:9px;letter-spacing:.14em;text-transform:uppercase;opacity:.55;
    font-weight:600;margin-bottom:8px}
  .comodos .grade{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:2px 22px}
  .ci{display:flex;justify-content:space-between;gap:12px;font-size:12px;padding:3px 0}
  .ci span{opacity:.72;min-width:0;overflow-wrap:anywhere}
  .ci b{font-weight:600;font-variant-numeric:tabular-nums;white-space:nowrap}
  #ctrl,#selo,#dica{max-width:calc(100% - 28px)}
  /* Ponteiro grosso = dedo. Nao e "tela pequena": um tablet tem tela grande e dedo,
     e e o dedo que decide se o botao precisa de 44 px de alvo. */
  @media (pointer:coarse),(max-width:640px){
    #ctrl button{min-height:44px;padding:9px 11px;font-size:12px}
    #selo{padding:7px 11px;font-size:12px}
  }
  @media (max-width:640px){
    body{padding:12px 12px calc(20px + env(safe-area-inset-bottom))}
    /* No telefone a miniatura encolhe mais: o cartao inteiro -- miniatura e ficha --
       tem que caber na primeira tela, que e o ponto de um cartao de imovel. */
    #cena{height:clamp(190px,30vh,290px);margin-bottom:-38px}
    #ficha{padding:46px 14px 16px}
    #ficha h1{font-size:16px}
    /* No telefone o preco desce pra linha de baixo, alinhado a esquerda com o resto:
       empurrado pra direita ele briga por largura com um titulo que ja mal cabe. */
    #ficha .preco{margin:6px 0 0;text-align:left;font-size:18px;width:100%}
    #ficha .preco small{display:inline;margin-right:8px;font-size:9px}
    .stats{grid-template-columns:repeat(auto-fit,minmax(78px,1fr));gap:9px 12px}
    /* Duas colunas ainda cabem em 500 px e poupam 4 linhas de ficha -- que e altura
       que volta pra maquete. Abaixo de ~340 px o `auto-fit` cai pra uma sozinho. */
    .comodos .grade{grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:0 16px}
  }
  @supports (height:30dvh){ @media (max-width:640px){ #cena{height:clamp(190px,30dvh,290px)} } }

</style>
</head>
<body>
<div class="folha">
<div id="cena">
  <canvas id="c"></canvas>
  <div id="selo"><i></i><span id="seloT">3&ordm; andar</span></div>
  <div id="ctrl">
    <button id="bCorte" aria-pressed="false">Ver andar</button>
    <button id="bAmpliar" aria-pressed="false">Ampliar</button>
  </div>
</div>

<section id="ficha">
  <div class="topo">
    <div>
      <div class="tag" id="fTag"></div>
      <h1 id="fNome"></h1>
      <div class="sub" id="fSub"></div>
    </div>
    <div class="preco" id="fPreco"><small>Valor</small></div>
  </div>
  <div class="stats" id="fStats"></div>
  <div class="comodos"><h2>C&ocirc;modos</h2><div class="grade" id="fComodos"></div></div>
  <div id="dica">Arraste a maquete para girar</div>
</section>
</div>

<script>@@THREE@@</script>
<script id="__imovel" type="application/json">@@DADOS@@</script>
<script>
(function () {
"use strict";
var D = JSON.parse(document.getElementById("__imovel").textContent);
var P = D.predio, LV = P.pe_direito_pav, N = P.pavimentos, ANDAR = D.andar;

/* ---- a ficha -------------------------------------------------------------- */
function esc(s){ return String(s).replace(/[&<>"]/g, function(c){
  return {"&":"&amp;","<":"&lt;",">":"&gt;","\\"":"&quot;"}[c]; }); }
document.getElementById("fTag").textContent = D.tag;
document.getElementById("fNome").textContent = D.empreendimento + " \\u00b7 " + D.unidade;
document.getElementById("fSub").textContent = D.endereco;
document.getElementById("fPreco").insertAdjacentHTML("beforeend", esc(D.preco));
document.getElementById("fStats").innerHTML = D.ficha.map(function (r) {
  return "<div>" + esc(r[0]) + "<b>" + esc(r[1]) + "</b></div>"; }).join("");
document.getElementById("fComodos").innerHTML = D.comodos.map(function (r) {
  return '<div class="ci"><span>' + esc(r[0]) + "</span><b>" + esc(r[1]) + "</b></div>"; }).join("");
document.getElementById("seloT").textContent = ANDAR === 0 ? "T\\u00e9rreo" : ANDAR + "\\u00ba andar";

/* ---- cena ----------------------------------------------------------------- */
var cv = document.getElementById("c"), caixa = document.getElementById("cena");
/* O QUE SE DECIDE ANTES DE CRIAR O CONTEXTO nao da pra mudar depois: antialias e
   escolha de construcao, nao propriedade. Num telefone a tela ja tem 3x de densidade,
   entao o serrilhado que o MSAA tira custa caro e se ve pouco -- e o custo de
   preenchimento e quadratico na resolucao, que e a alavanca mais forte que existe. */
var TOQUE = matchMedia("(pointer:coarse)").matches;
var PEQUENA = Math.min(screen.width, screen.height) <= 820;
var CELULAR = TOQUE && PEQUENA;
/* `alpha: true` e o que faz a maquete FLUTUAR. Sem ele o canvas e um retangulo
   opaco com o predio dentro, e qualquer sobreposicao com o cartao vira uma caixa
   por cima de outra. Com ele o que nao e predio e transparente, e o cartao aparece
   por tras -- que e o "em cima da janela de informacoes" do pedido. */
var ren = new THREE.WebGLRenderer({ canvas: cv, antialias: !CELULAR, alpha: true,
                                    powerPreference: "high-performance" });
ren.setClearAlpha(0);
ren.setPixelRatio(Math.min(devicePixelRatio, CELULAR ? 1.75 : 2));
ren.outputColorSpace = THREE.SRGBColorSpace;
ren.toneMapping = THREE.ACESFilmicToneMapping;
ren.toneMappingExposure = 1.02;
ren.shadowMap.enabled = true;
ren.shadowMap.type = THREE.PCFSoftShadowMap;

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

/* Luz: uma principal que DESENHA A SOMBRA (e a sombra e o que faz uma maquete parecer
   pousada numa mesa), uma de preenchimento fria do lado oposto pra tirar o preto da
   face que nao pega sol, e uma hemisferica fraca pro resto. Tres e o suficiente --
   cada luz a mais entra no shader de todo material, acesa ou nao. */
var sol = new THREE.DirectionalLight(0xFFF2DD, 2.6);
sol.position.set(26, 42, 18);
sol.castShadow = true;
sol.shadow.mapSize.set(CELULAR ? 1024 : 2048, CELULAR ? 1024 : 2048);
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
    out.push([b[0] + sgn * mx / L * k, b[1] + sgn * mz / L * k]);
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
function prisma(r, alt, buraco) {
  var g = new THREE.ExtrudeGeometry(forma(r, buraco), { depth: alt, bevelEnabled: false });
  g.rotateX(-Math.PI / 2); g.computeVertexNormals();
  return g;
}

var predio = new THREE.Group();
cena.add(predio);

var LAJE = 0.34;                       // a laje avanca alem da parede: e ela que
var REC  = 0.30;                       // desenha a linha horizontal de cada pavimento
var matLaje = new THREE.MeshStandardMaterial({ color: 0xCFCABF, roughness: 0.88,
                                               metalness: 0.02, envMapIntensity: 0.5 });
var matPar  = new THREE.MeshStandardMaterial({ color: 0xB4BAC1, roughness: 0.92,
                                               metalness: 0.02, envMapIntensity: 0.5 });
// `envMapIntensity` acima de 1 de proposito: o ambiente gerado e fraco (um degrade,
// nao um HDR), e e o reflexo que desenha a janela.
var matVid  = new THREE.MeshStandardMaterial({ color: 0x16202C, roughness: 0.09,
                                               metalness: 0.45, envMapIntensity: 2.1 });
var matCax  = new THREE.MeshStandardMaterial({ color: 0xE9E6E0, roughness: 0.6,  metalness: 0.05 });

var gLaje = prisma(anel, LAJE);
var gPar  = prisma(encolhe(anel, REC), LV - LAJE);
var lajes = new THREE.InstancedMesh(gLaje, matLaje, N + 1);
var pars  = new THREE.InstancedMesh(gPar,  matPar,  N);
lajes.castShadow = lajes.receiveShadow = true;
pars.castShadow  = pars.receiveShadow  = true;
var d = new THREE.Object3D();
function poe(m, i, y) { d.position.set(0, y, 0); d.rotation.set(0,0,0); d.scale.set(1,1,1);
  d.updateMatrix(); m.setMatrixAt(i, d.matrix); }
for (var f = 0; f < N; f++) { poe(lajes, f, f*LV); poe(pars, f, f*LV + LAJE); }
poe(lajes, N, N*LV);                   // laje de cobertura
lajes.instanceMatrix.needsUpdate = pars.instanceMatrix.needsUpdate = true;
predio.add(lajes, pars);

/* AS JANELAS SAO ESQUADRIAS, NAO UMA FITA. Uma faixa continua de vidro em volta do
   predio inteiro le como torre corporativa -- e o imovel aqui e residencial. Cada face
   recebe uma FILEIRA de janelas de 1,40 m, espacadas 2,30, centradas na face; o que
   sobra de parede nas pontas e o que da escala ao predio. Vidro e caixilho sao duas
   malhas instanciadas, entao o predio inteiro continua custando quatro chamadas. */
var JAN_L = 1.40, JAN_A = 1.45, JAN_PASSO = 2.30, JAN_PEITO = 0.95;
function dentro(r, x, z) {          // ponto em poligono, por cruzamentos
  var d = false;
  for (var i = 0, j = r.length - 1; i < r.length; j = i++) {
    if ((r[i][1] > z) !== (r[j][1] > z) &&
        x < (r[j][0]-r[i][0]) * (z-r[i][1]) / (r[j][1]-r[i][1]) + r[i][0]) d = !d;
  }
  return d;
}
var postos = [];
var interno = encolhe(anel, REC);
for (var e = 0; e < interno.length; e++) {
  var a = interno[e], b = interno[(e + 1) % interno.length];
  var dx = b[0]-a[0], dz = b[1]-a[1], L = Math.hypot(dx, dz);
  if (L < 1.2) continue;
  /* PRA QUE LADO ESTA O LADO DE FORA. Deduzir do sentido do anel (perpendicular da
     aresta, com o sinal do enrolamento) funciona ate chegar um contorno em L vindo de
     outro lugar com o enrolamento trocado -- e entao as janelas de uma fachada inteira
     nascem viradas pra dentro da parede, o que nao acusa erro nenhum: a fachada fica
     lisa. Aqui o lado de fora e MEDIDO: anda-se meio metro na perpendicular e
     pergunta-se se ainda se esta dentro do predio. */
  var nx = dz/L, nz = -dx/L;
  var mx = a[0] + dx/2, mz = a[1] + dz/2;
  if (dentro(interno, mx + nx*0.5, mz + nz*0.5)) { nx = -nx; nz = -nz; }
  var quantas = Math.max(1, Math.floor((L - 0.9) / JAN_PASSO));
  var passo = L / quantas;
  for (var k = 0; k < quantas; k++) {
    var t = (k + 0.5) * passo;
    postos.push({ x: a[0] + dx/L*t - cx, z: a[1] + dz/L*t - cz,
                  nx: nx, nz: nz, ang: Math.atan2(nx, nz) });   // +Z do caixilho pra fora
  }
}
/* O CAIXILHO TEM QUE FICAR NA FRENTE DA PAREDE, e o vidro na frente dele. A parede e
   um prisma MACICO (nao um anel), entao qualquer peca posta sobre a linha da fachada
   fica metade enterrada -- foi o que aconteceu no primeiro print: 108 janelas
   desenhadas e nenhuma visivel, so os buracos pretos do vidro. Os dois deslocamentos
   abaixo sao ao longo da normal de fora: 2 cm pro caixilho, 6 cm pro vidro. */
var CAX_FORA = 0.02, VID_FORA = 0.065;
var nJ = postos.length * N;
var gVid = new THREE.BoxGeometry(JAN_L, JAN_A, 0.05);
var gCax = new THREE.BoxGeometry(JAN_L + 0.18, JAN_A + 0.18, 0.12);
var vidros = new THREE.InstancedMesh(gVid, matVid, nJ);
var caxs   = new THREE.InstancedMesh(gCax, matCax, nJ);
caxs.castShadow = true;
var n2 = 0;
for (var f2 = 0; f2 < N; f2++) for (var q = 0; q < postos.length; q++) {
  var pt = postos[q], yy = f2*LV + LAJE + JAN_PEITO + JAN_A/2;
  d.rotation.set(0, pt.ang, 0); d.scale.set(1,1,1);
  d.position.set(pt.x + pt.nx*CAX_FORA, yy, pt.z + pt.nz*CAX_FORA);
  d.updateMatrix(); caxs.setMatrixAt(n2, d.matrix);
  d.position.set(pt.x + pt.nx*VID_FORA, yy, pt.z + pt.nz*VID_FORA);
  d.updateMatrix(); vidros.setMatrixAt(n2, d.matrix);
  n2++;
}
vidros.instanceMatrix.needsUpdate = caxs.instanceMatrix.needsUpdate = true;
predio.add(caxs, vidros);

// Platibanda e casa de maquinas: e o que separa "predio" de "caixa empilhada".
var plat = new THREE.Mesh(prisma(anel, 0.95, encolhe(anel, 0.24)), matPar);
plat.position.y = N*LV + LAJE; plat.castShadow = true; predio.add(plat);
var cm = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2.4, 2.6), matPar);
cm.position.set(0, N*LV + LAJE + 1.2, 0); cm.castShadow = true; predio.add(cm);

/* NADA DE TERRENO. Tinha um disco com grade aqui, e o argumento era bom -- sem
   superficie embaixo a sombra cai no nada e a maquete perde a pista de profundidade.
   So que "pista de profundidade" custava prender o predio no chao, e o pedido e o
   contrario: ele flutua. O que sobra desenhando volume e a sombra do proprio predio
   sobre ele mesmo (a platibanda na laje, o recuo de cada janela) mais o degrade que o
   CSS poe ATRAS do canvas -- que nao e geometria e nao pesa nada.

   `raioChao` continua existindo porque o enquadramento e a camera de sombra se apoiam
   nele; ele passou a ser so a extensao do predio, sem malha nenhuma. */
var raioChao = 0;
for (var v = 0; v < anel.length; v++)
  raioChao = Math.max(raioChao, Math.hypot(anel[v][0]-cx, anel[v][1]-cz));
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
var ALTURA = N * LV + LAJE + 2.4;          // ate o alto da casa de maquinas
var raioBase = 0;
for (var rb = 0; rb < anel.length; rb++)
  raioBase = Math.max(raioBase, Math.hypot(anel[rb][0]-cx, anel[rb][1]-cz));
var alvo = new THREE.Vector3(0, ALTURA * 0.5, 0);
var orb = { r: 40, th: 0.72, ph: 1.03 };
var R_MIN = 9, R_MAX = 260, gira = true, zoomManual = false;

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
  var dv = (ALTURA / 2) / Math.tan(vf / 2);
  var dh = raioBase / Math.tan(hf / 2);
  // 1,12 e nao 1,06: com a margem justa a base do predio encostava na borda de baixo
  // do painel, e a perspectiva ainda empurra pra fora o canto mais proximo.
  return Math.max(R_MIN, Math.max(dv, dh) * 1.12 + raioBase * 0.9);
}
function poeCam() {
  var s = Math.sin(orb.ph);
  cam.position.set(alvo.x + orb.r*s*Math.sin(orb.th), alvo.y + orb.r*Math.cos(orb.ph),
                   alvo.z + orb.r*s*Math.cos(orb.th));
  cam.lookAt(alvo);
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
  if (!zoomManual && !voo && !perto) orb.r = raioQueEnquadra();
}
addEventListener("resize", redim);
if (window.ResizeObserver) new ResizeObserver(redim).observe(caixa);

var perto = false, voo = null;    // declarados aqui: `redim()` os consulta
var dedos = new Map(), ant = null, arr = false, lx = 0, ly = 0;
function medida() { var a = [], it = dedos.values(), v;
  while (!(v = it.next()).done) a.push(v.value);
  return { d: Math.hypot(a[1].x-a[0].x, a[1].y-a[0].y), a: Math.atan2(a[1].y-a[0].y, a[1].x-a[0].x) }; }
cv.addEventListener("pointerdown", function (e) {
  gira = false; mexeu();
document.getElementById("dica").textContent = TOQUE
  ? "Arraste a maquete para girar \u00b7 dois dedos aproximam \u00b7 ela volta a girar sozinha"
  : "Arraste a maquete para girar \u00b7 roda aproxima \u00b7 ela volta a girar sozinha";
  if (e.pointerType === "touch") { dedos.set(e.pointerId, {x:e.clientX,y:e.clientY});
    if (dedos.size > 1) { ant = medida(); arr = false;
      try { cv.setPointerCapture(e.pointerId); } catch (err) {} return; } }
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
  orb.th -= (e.clientX - lx) * 0.0085;
  /* VERTICAL INVERTIDO a pedido. Agora arrastar pra BAIXO sobe a camera: e como se a
     mao pegasse a face da frente do predio e a puxasse pra baixo, trazendo o topo pra
     ca. E a convencao de visualizador de OBJETO; a de antes era a de camera em
     primeira pessoa (arrasta pra baixo, olha pra baixo), que aqui nao faz sentido
     porque ninguem esta dentro de nada.

     A faixa tambem abriu: sem terreno nao ha mais em que a camera afunde, entao da
     pra passar do horizonte e olhar a maquete por baixo. */
  orb.ph = Math.max(0.28, Math.min(2.20, orb.ph - (e.clientY - ly) * 0.0065));
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

/* ---- os dois botoes ------------------------------------------------------- */
var bCorte = document.getElementById("bCorte");
/* A MAQUETE GIRA. Nao e um modo que se liga -- e o estado dela.

   A versao anterior tinha um botao "Girar", e botao pra isso e a pergunta errada: nao
   existe momento em que alguem quer a miniatura parada de proposito. O que existe e o
   momento em que a pessoa esta MEXENDO nela, e ai o giro tem que sair da frente. Entao
   ele para no toque e volta sozinho quando a mao larga. */
var RETOMA = 2200;                       // ms de mao parada ate o giro voltar
var ultimoToque = 0;
function mexeu() { gira = false; ultimoToque = performance.now(); }

// "Ver andar": a camera desce ate a altura do pavimento da unidade e aproxima. Nao e
// outra cena -- e a mesma orbita com outro alvo, que e o que mantem a transicao
// continua em vez de um corte.
bCorte.addEventListener("click", function () {
  perto = !perto;
  bCorte.setAttribute("aria-pressed", String(perto));
  bCorte.textContent = perto ? "Ver o pr\\u00e9dio" : "Ver andar";
  gira = false; mexeu();
  zoomManual = false;
  voo = { t0: performance.now(), dur: 900,
          y0: alvo.y, y1: perto ? (ANDAR*LV + LV*0.5) : ALTURA*0.5,
          r0: orb.r,  r1: perto ? Math.max(R_MIN, raioBase*2.2) : raioQueEnquadra(),
          p0: orb.ph, p1: perto ? 1.22 : 1.03 };
});
mexeu();

/* ---- ampliar: a miniatura toma a tela, por pedido ------------------------- */
var bAmpliar = document.getElementById("bAmpliar"), ampliada = false;
function poeAmpliada(v) {
  ampliada = v;
  document.body.classList.toggle("ampliada", v);
  bAmpliar.setAttribute("aria-pressed", String(v));
  bAmpliar.textContent = v ? "Reduzir" : "Ampliar";
  // O `ResizeObserver` do #cena chama `redim()` sozinho quando a caixa muda de
  // tamanho, e `redim()` reenquadra -- a proporcao de tela cheia nao e a do painel.
}
bAmpliar.addEventListener("click", function () { poeAmpliada(!ampliada); });
// Sair pelo Esc: ampliada nao ha botao de fechar alem do proprio, e teclado e o
// caminho que quem esta no desktop tenta primeiro.
addEventListener("keydown", function (e) { if (e.key === "Escape" && ampliada) poeAmpliada(false); });

/* ---- laco ----------------------------------------------------------------- */
var tAnt = 0, pulso = 0;
function quadro(now) {
  requestAnimationFrame(quadro);
  var dt = tAnt ? Math.min(0.1, (now - tAnt) / 1000) : 0;
  tAnt = now;
  redim();
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
  if (!gira && !ampliada && now - ultimoToque > RETOMA) gira = true;
  if (gira && !voo) orb.th += 0.16 * dt;
  pulso += dt;
  if (brilho) {
    var b = 0.5 + 0.5 * Math.sin(pulso * 3.0);
    contorno.material.opacity = 0.45 + b * 0.5;
    // Do branco ao verde e de volta. Multiplica a difusa, entao o andar "acende" sem
    // deixar de ser parede -- textura, sombra e reflexo continuam os mesmos.
    corInst.setRGB(1 - b*0.72, 1 - b*0.12, 1 - b*0.52);
    lajes.setColorAt(ANDAR, corInst); pars.setColorAt(ANDAR, corInst);
    lajes.instanceColor.needsUpdate = pars.instanceColor.needsUpdate = true;
  }
  poeCam();
  // O sol fica FIXO no mundo enquanto a camera gira: e o que faz a maquete parecer
  // um objeto numa mesa, e nao um objeto grudado na lente. Posto a oeste-norte, a
  // sombra cai pro lado oposto e entra no quadro na maior parte da volta.
  sol.position.set(alvo.x - 30, 46 + alvo.y, alvo.z + 22);
  sol.target.position.set(alvo.x, alvo.y, alvo.z);
  sol.target.updateMatrixWorld();
  ren.render(cena, cam);
}
// A camera de sombra tem que CABER o predio: nos +-5 m do padrao do three todo
// fragmento fora da caixa e amostrado fora do mapa, e o three devolve isso como
// sombra -- o predio sai preto, sem erro nenhum no console.
var S = Math.max(raioChao, ALTURA) * 0.9;
sol.shadow.camera.left = -S; sol.shadow.camera.right = S;
sol.shadow.camera.top = S;   sol.shadow.camera.bottom = -S;
sol.shadow.camera.near = 1;  sol.shadow.camera.far = 240;
sol.shadow.camera.updateProjectionMatrix();
redim(); orb.r = raioQueEnquadra(); poeCam();
requestAnimationFrame(quadro);
window.__maq = { cena:cena, cam:cam, ren:ren, orb:orb, alvo:alvo, predio:predio,
                 brilho:brilho, andar:ANDAR, N:N, poeCam:poeCam };
})();
</script>
</body>
</html>
"""


def main():
    three = io.open(THREE, encoding="utf-8", newline="").read()
    s = (PAGINA
         .replace("@@TITULO@@", IMOVEL["empreendimento"] + " · " + IMOVEL["unidade"])
         .replace("@@DADOS@@", json.dumps(IMOVEL, ensure_ascii=False))
         .replace("@@THREE@@", three))
    os.makedirs(os.path.dirname(os.path.abspath(SAIDA)), exist_ok=True)
    # PORTAO DE `%%`. O template ja foi formatado por `%` um dia, e os escapes que
    # aquilo exigia sobreviveram a troca pra `.replace()`: sobrou `width:100%%` na folha,
    # que e declaracao INVALIDA. Sem tamanho de CSS o navegador exibe o canvas no
    # tamanho do BUFFER -- num monitor de dpr 1 da no mesmo e nao se ve nada; num
    # celular de dpr 1,75 a maquete sai 75% maior que o painel. Custou uma ida e volta
    # ate alguem abrir no telefone, entao vira portao.
    if "%%" in s:
        raise SystemExit("saida tem '%%' -- escape de formatacao que virou CSS invalido")
    io.open(SAIDA, "w", encoding="utf-8", newline="").write(s)
    print("%.2f MB -> %s" % (len(s.encode("utf-8")) / 1e6, SAIDA))
    print("  %s · %d pavimentos · unidade no %dº andar"
          % (IMOVEL["empreendimento"], IMOVEL["predio"]["pavimentos"], IMOVEL["andar"]))
    return 0


if __name__ == "__main__":
    sys.exit(main())

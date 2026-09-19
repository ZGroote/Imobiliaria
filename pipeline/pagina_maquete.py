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
    # A PLANTA DA UNIDADE, em metros, no referencial do desenho enviado em 19/09/2026
    # (16,5 x 9,2 m de piso, pe-direito 2,60 m, recuo no canto sudeste). Sao as MESMAS
    # coordenadas do `pipeline/demo_v18.py`; a diferenca e que aqui ela e desenhada de
    # tres jeitos -- 2D, 3D e por dentro -- em vez de virar cidade.
    #
    # A ORDEM DOS COMODOS IMPORTA: quem deriva parede pergunta "de quem e esta celula?"
    # e fica no PRIMEIRO da lista que a contem. A sala e o poligono que SOBRA (um
    # hexagono que passa por cima do banho e da cozinha), entao vem por ultimo.
    "planta": {
        "pe_direito": 2.60,
        "comodos": [
            {"nome": "Banho",          "poly": [[-1.10,-1.40],[1.50,-1.40],[1.50,1.00],[-1.10,1.00]], "piso": "frio"},
            {"nome": "Cozinha",        "poly": [[2.00,-4.50],[4.80,-4.50],[4.80,-2.40],[2.00,-2.40]], "piso": "frio"},
            {"nome": "Quarto 1",       "poly": [[-8.15,-4.50],[-2.70,-4.50],[-2.70,-1.30],[-8.15,-1.30]], "piso": "quente"},
            {"nome": "Quarto 2",       "poly": [[-8.15,1.60],[-2.70,1.60],[-2.70,4.50],[-8.15,4.50]], "piso": "quente"},
            {"nome": "Hall",           "poly": [[-8.15,-1.30],[-2.70,-1.30],[-2.70,1.60],[-8.15,1.60]], "piso": "quente"},
            {"nome": "\u00c1rea privativa", "poly": [[4.80,-4.50],[8.15,-4.50],[8.15,1.90],[4.80,1.90]], "piso": "frio"},
            {"nome": "Sala", "piso": "quente",
             "poly": [[-2.70,-4.50],[4.80,-4.50],[4.80,1.90],[3.00,1.90],[3.00,4.50],[-2.70,4.50]]}
        ],
        # Vao e PONTO + largura: ele acha sozinho a parede mais proxima.
        "portas": [
            {"p": [-4.00,-1.30], "largura": 0.80}, {"p": [-4.00,1.60], "largura": 0.80},
            {"p": [-2.70,0.15],  "largura": 2.90},   # hall e sala sao o mesmo espaco
            {"p": [1.50,-0.20],  "largura": 0.80},   # o croqui nao fecha o banho; aqui fecha
            {"p": [3.40,-2.40],  "largura": 0.90}, {"p": [4.80,-3.75], "largura": 1.50}
        ],
        "janelas": [
            {"p": [-8.15,-3.00], "largura": 1.60}, {"p": [-8.15,2.50], "largura": 1.60},
            {"p": [8.15,-1.50],  "largura": 2.20}, {"p": [5.50,1.90],  "largura": 1.80},
            {"p": [-4.00,-4.50], "largura": 2.00}, {"p": [1.50,-4.50], "largura": 2.00}
        ]
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
  /* A FICHA ENCOSTA NO RODAPE DA TELA. Era uma coluna que comecava no topo, e sobrava
     tela morta embaixo do cartao. Com o corpo em coluna de altura cheia e a folha
     empurrada por `margin-top:auto`, o conjunto -- maquete e ficha -- desce junto e a
     ultima linha para logo acima da borda de baixo. Passando disso, a pagina rola
     normalmente, porque a altura e `min-height` e nao `height`. */
  body{font-family:var(--ui);color:var(--txt);-webkit-font-smoothing:antialiased;
    background:var(--void);min-height:100%;display:flex;flex-direction:column;
    user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent;
    padding:16px calc(16px + env(safe-area-inset-right))
            calc(10px + env(safe-area-inset-bottom))
            calc(16px + env(safe-area-inset-left))}
  @supports (min-height:100dvh){ body{min-height:100dvh} }
  .folha{max-width:720px;margin:auto auto 0;width:100%}

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

  /* A planta 2D e um <svg> por cima do canvas, no mesmo painel: trocar de modo nao
     troca de caixa, so de conteudo -- e por isso a maquete nao "salta" quando volta. */
  #p2d{position:absolute;inset:0;width:100%;height:100%}
  #p2d[hidden]{display:none}
  /* A dica fica POR CIMA da maquete, entao ela precisa de fundo proprio: sobre a
     parede clara do predio, texto a 45% de opacidade desaparece. O degrade e so na
     faixa de baixo -- escurecer o painel inteiro apagaria a sombra no chao, que e a
     pista de profundidade da cena. */
  /* A dica saiu do canvas. Sem moldura nao ha rodape onde ela caiba: em cima do
     predio ela fica ilegivel, e na faixa de baixo ela cai justamente onde o canvas se
     sobrepoe ao cartao. Virou a ultima linha da ficha, que e onde legenda mora. */
  /* A ESCADA DE MODOS mora na ficha, e nao flutuando sobre a maquete: sao os quatro
     jeitos de ver o MESMO imovel, e o lugar disso e junto da informacao dele. Rola no
     eixo x em tela estreita em vez de quebrar em duas linhas. */
  #modos{display:flex;gap:6px;margin-top:14px;padding-top:12px;
    border-top:1px solid var(--line);overflow-x:auto;scrollbar-width:none}
  #modos::-webkit-scrollbar{display:none}
  #modos button{flex:1 1 0;min-width:84px;font:inherit;font-size:11.5px;padding:9px 6px;
    border-radius:8px;cursor:pointer;background:rgba(255,255,255,.06);
    border:1px solid var(--line);color:var(--txt);transition:.15s;
    touch-action:manipulation;white-space:nowrap}
  #modos button:hover{background:rgba(255,255,255,.13)}
  #modos button[aria-pressed=true]{background:rgba(75,219,124,.16);
    border-color:rgba(75,219,124,.5);color:#BFF3D2}
  #dica{margin-top:11px;font-size:10.5px;opacity:.42;letter-spacing:.04em}

  /* Manche de caminhada: so na visita, so em ponteiro grosso. Dentro de um
     apartamento de 3,5 m, quatro setas sao sofriveis -- o manche devolve um vetor
     continuo, e e isso que deixa ajustar a posicao dentro de um comodo pequeno. */
  #joy{position:absolute;left:12px;bottom:12px;width:104px;height:104px;border-radius:50%;
    background:rgba(12,18,25,.42);border:1px solid var(--line);touch-action:none;z-index:3}
  #joy[hidden]{display:none}
  #joy i{position:absolute;left:50%;top:50%;width:42px;height:42px;margin:-21px 0 0 -21px;
    border-radius:50%;background:rgba(231,235,240,.5);border:1px solid rgba(255,255,255,.3)}

  /* A JANELA DE INFORMACOES. Rola por dentro: numa tela de telefone deitado a ficha
     inteira nao cabe, e encolher a maquete ate o predio sumir seria pior. */
  /* O topo generoso e onde a maquete pousa por cima. Sem ele o predio cairia em
     cima do "A VENDA". */
  #ficha{position:relative;background:rgba(18,25,33,.92);border:1px solid var(--line);
    border-radius:14px;padding:56px 18px 18px}
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
  #selo{max-width:calc(100% - 28px)}
  /* Ponteiro grosso = dedo. Nao e "tela pequena": um tablet tem tela grande e dedo,
     e e o dedo que decide se o botao precisa de 44 px de alvo. */
  @media (pointer:coarse),(max-width:640px){
    #modos button{min-height:44px;font-size:12px}
    #selo{padding:7px 11px;font-size:12px}
  }
  @media (max-width:640px){
    body{padding:12px 12px calc(8px + env(safe-area-inset-bottom))}
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
  <svg id="p2d" hidden aria-label="Planta baixa"></svg>
  <div id="joy" hidden aria-hidden="true"><i></i></div>

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
  <nav id="modos" aria-label="Como ver o im&oacute;vel">
    <button data-modo="maquete" aria-pressed="true">Pr&eacute;dio</button>
    <button data-modo="planta2d" aria-pressed="false">Planta 2D</button>
    <button data-modo="planta3d" aria-pressed="false">Planta 3D</button>
    <button data-modo="visita" aria-pressed="false">Visita 3D</button>
  </nav>
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
cam.rotation.order = "YXZ";   // primeira pessoa: yaw depois pitch, nunca roll

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
  /* O QUE SE ENQUADRA MUDA COM O MODO: no "Predio" e a torre inteira, na "Planta 3D"
     e a laje de um pavimento -- 21 m de altura contra 2,6. Usar a medida da torre nos
     dois deixaria a planta do tamanho de uma moeda no meio do painel. */
  var ehPlanta = (typeof modo !== "undefined") && modo === "planta3d";
  var alt  = ehPlanta ? PD : ALTURA;
  var lado = ehPlanta ? Math.hypot(PB.w, PB.h) / 2 : raioBase;
  var dv = (alt / 2) / Math.tan(vf / 2);
  var dh = lado / Math.tan(hf / 2);
  // 1,12 e nao 1,06: com a margem justa a base do predio encostava na borda de baixo
  // do painel, e a perspectiva ainda empurra pra fora o canto mais proximo.
  return Math.max(R_MIN, Math.max(dv, dh) * 1.12 + lado * 0.9);
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
  if (!zoomManual && !voo && !perto && modo !== "visita") orb.r = raioQueEnquadra();
  // A planta 2D e desenhada em PIXELS do painel: mudou a caixa, o desenho e refeito.
  if (typeof modo !== "undefined" && modo === "planta2d") desenhaPlanta2D();
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
  if (modo === "visita") {
    /* Dentro da casa o arrasto e OLHAR EM VOLTA, nao girar um objeto: nao ha objeto,
       ha um lugar -- e por isso o eixo vertical aqui NAO e o invertido da maquete.
       O pitch trava antes do zenite pra nao virar de cabeca pra baixo. */
    FP.yaw -= (e.clientX - lx) * 0.004;
    FP.pitch = Math.max(-1.25, Math.min(1.25, FP.pitch - (e.clientY - ly) * 0.004));
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
var OLHO = 1.62, RAIO_CORPO = 0.30;

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

/* ---- planta 3D: a mesma parede, extrudada ------------------------------- */
var PISOS = { quente: 0x8E6E4C, frio: 0xA9AFB6 };
var planta3d = null;
function montaPlanta3D() {
  if (planta3d) return planta3d;
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
  /* A FAIXA DE BAIXO DO PAINEL ESTA DEBAIXO DO CARTAO. O canvas se sobrepoe a ficha de
     proposito (e o que faz a maquete flutuar por cima dela), e o predio 3D aproveita
     isso -- ele passa por cima e fica bonito. Um DESENHO TECNICO nao: metade da sala
     escondida atras do cartao nao e efeito, e informacao perdida. Entao a planta 2D
     desenha so acima da emenda, medida aqui e nao chutada. */
  var fi = document.getElementById("ficha").getBoundingClientRect();
  var mb = Math.max(M, Math.round(b.bottom - fi.top) + 10);
  var esc = Math.min((w - M*2) / PB.w, (h - M - mb) / PB.h);
  var ox = w/2 - PB.cx*esc, oy = (M + (h - mb)) / 2 - PB.cz*esc;
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
  for (var n = 0; n < PL.comodos.length; n++) {
    var cc = PL.comodos[n], sx = 0, sz = 0;
    for (var m = 0; m < cc.poly.length; m++) { sx += cc.poly[m][0]; sz += cc.poly[m][1]; }
    sx /= cc.poly.length; sz /= cc.poly.length;
    if (cc.nome === "Sala") sx += 2.0;      // o centroide do hexagono cai no banho
    s.push('<text x="' + X(sx) + '" y="' + Y(sz) + '" text-anchor="middle" ' +
           'font-family="system-ui,sans-serif" font-size="' + Math.max(7, esc*0.42).toFixed(1) +
           '" fill="rgba(231,235,240,.78)">' + cc.nome + '</text>');
  }
  p2d.setAttribute("viewBox", "0 0 " + w + " " + h);
  p2d.innerHTML = s.join("");
}

/* ---- visita: primeira pessoa dentro da planta --------------------------- */
var FP = { x:0, z:0, yaw:0, pitch:-0.05, mx:0, mz:0 };
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
  return dentroDaPlanta(x, z);
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
function passoVisita(dt) {
  var mf = FP.mz, mr = FP.mx;
  if (teclas.w) mf += 1; if (teclas.s) mf -= 1;
  if (teclas.d) mr += 1; if (teclas.a) mr -= 1;
  if (!mf && !mr) return;
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
  if (modo !== "visita") return;
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
var DICAS = {
  maquete:  "Arraste a maquete para girar · ela volta a girar sozinha",
  planta2d: "Corte na altura do peitoril · azul é esquadria",
  planta3d: "Arraste para girar a planta · sem laje por cima",
  visita:   TOQUE ? "Use o manche para andar · arraste a vista para olhar"
                  : "W A S D para andar · arraste para olhar"
};
function vaiPara(novo) {
  modo = novo;
  var botoes = document.querySelectorAll("#modos button");
  for (var i = 0; i < botoes.length; i++)
    botoes[i].setAttribute("aria-pressed", String(botoes[i].dataset.modo === novo));
  var ehPlanta = novo === "planta3d" || novo === "visita";
  if (ehPlanta) montaPlanta3D();
  predio.visible = novo === "maquete";
  if (planta3d) planta3d.visible = ehPlanta;
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
      orb.ph = 0.72;
    } else {
      alvo.set(0, ALTURA * 0.5, 0);
      orb.ph = 1.03;
    }
    orb.r = raioQueEnquadra();
  }
  mexeu();
}
(function ligaModos() {
  var botoes = document.querySelectorAll("#modos button");
  for (var i = 0; i < botoes.length; i++)
    botoes[i].addEventListener("click", function () { vaiPara(this.dataset.modo); });
})();

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
  if (!gira && now - ultimoToque > RETOMA) gira = true;
  if (gira && !voo && modo !== "visita") orb.th += 0.16 * dt;
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
/* Porta pro QA. `quadro` entra porque em Chrome headless o rAF para depois dos
   primeiros quadros: sem ele, uma sonda so consegue desenhar chamando `ren.render`
   direto -- e ai o que o laco DECIDE (a camera da visita, o passo de caminhada, a
   posicao do sol) nunca roda, e o print sai com a camera do modo anterior. */
window.__maq = { cena:cena, cam:cam, ren:ren, orb:orb, alvo:alvo, predio:predio,
                 brilho:brilho, andar:ANDAR, N:N, poeCam:poeCam, quadro:quadro,
                 vaiPara:vaiPara, FP:FP, modo:function(){ return modo; },
                 paredes:paredes, planta:function(){ return planta3d; } };
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

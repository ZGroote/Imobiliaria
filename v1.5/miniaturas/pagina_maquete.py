# -*- coding: utf-8 -*-
"""Pagina de TESTE da maquete: um predio, uma ficha embaixo, e mais nada.

Pedido de 19/09/2026: "esquece o mapa para fazermos um teste aqui. Gere uma pagina e
uma miniatura do predio desejado. Com uma janela de informacoes em baixo."

E de proposito que isto NAO e o renderizador: sem cidade, sem streaming, sem relevo e
sem as tres etapas, a pagina abre em 1,5 MB e a maquete e a unica coisa que existe pra
olhar -- que e o ponto de um teste. A geometria segue a mesma regra do `montaMaquete`
do renderizador, hoje em `v1.5/renderizador-v16-moveis/listings/stage.js` (laje, parede
e caixilho por pavimento, tudo em `InstancedMesh`), com um degrau a mais de detalhe que
so cabe aqui: as janelas sao ESQUADRIAS DE VERDADE, distribuidas ao longo de cada face,
em vez de uma fita continua de vidro.

    python v1.5/miniaturas/pagina_maquete.py                 # -> v1.5/miniaturas/maquete.html
    python v1.5/miniaturas/pagina_maquete.py --saida /tmp/x.html
    python v1.5/miniaturas/pagina_maquete.py --unidade <id> \\
           --mapa ../mapa/imovel-<id>.html                   # com o botao "Ver mapa"

`--mapa` e opcional de proposito: a pagina tambem viaja sozinha, e ali nao ha mapa ao
lado pra onde ir.
"""
import io, json, math, os, sys

RAIZ = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, RAIZ)
THREE = os.path.join(RAIZ, "v1.5", "renderizador-v16-moveis", "lib", "three.min.js")
LV = 3.15                        # pe-direito de pavimento, o mesmo do renderizador


def arg(nome, padrao=None):
    return sys.argv[sys.argv.index(nome) + 1] if nome in sys.argv else padrao


SAIDA = arg("--saida", os.path.join(RAIZ, "v1.5", "miniaturas", "maquete.html"))
UNIDADE = arg("--unidade")       # id do cadastro; sem ele vale o IMOVEL de exemplo
CIDADE = arg("--cidade", "sao-carlos")
MAPA = arg("--mapa")             # href do mapa deste imovel; sem ele, sem botao
MODELOS_BLENDER = {
    'wish-castanheiras-58': 'castanheiras_blender',
    'monte-dos-cedros-37': 'monte-dos-cedros_blender',
    'monte-das-colinas-39': 'monte-das-colinas_blender',
}


# ---------------------------------------------------------------------------
# O CADASTRO DE VERDADE. `--unidade <id>` troca o dicionario escrito a mao pelo que
# o pipeline ja tem: a mesma planta que o mapa 3D veste por dentro, a mesma ficha que
# a vitrine mostra, e a torre que `anelDoLote` desenha no mapa.
# ---------------------------------------------------------------------------
def brl(v):
    if not isinstance(v, (int, float)):
        return None
    return "R$ " + "{:,.0f}".format(v).replace(",", ".")


def linha_de_area(f):
    """A linha de área da ficha: (rótulo, valor), ou None. A útil quando o cadastro a tem;
    senão a total, com o nome de TOTAL -- são números diferentes, e quem compara imóvel
    compara pelo rótulo. Sem nenhuma das duas, a ficha não mostra área."""
    for campo, rotulo in (("area_util", "Área útil"), ("area_total", "Área total")):
        if f.get(campo):
            return rotulo, "%s m²" % ("%.1f" % f[campo]).replace(".", ",")
    return None


def anel_do_bloco(u, v, larg, prof, giro=0.0):
    """O retangulo de um bloco, no referencial do lote. Mesma conta do `anelNoLote` do
    renderizador: `largura_m` corre em u, `profundidade_m` em v, e `giro_graus` gira o
    bloco em torno do proprio centro."""
    a = math.radians(giro or 0.0)
    ux, uz = math.cos(a), math.sin(a)
    hu, hv = larg / 2.0, prof / 2.0
    def W(t, r):
        return [round(u + ux*t - uz*r, 3), round(v + uz*t + ux*r, 3)]
    return [W(-hu, hv), W(hu, hv), W(hu, -hv), W(-hu, -hv)]


def do_cadastro(uid, slug):
    """O IMOVEL montado a partir do cadastro da cidade."""
    from padrao.cidade import carrega
    from pipeline.build import blocos
    todas = json.loads(blocos.bloco_unidades(carrega(slug)))
    u = next((x for x in todas if str(x.get("id")) == uid), None)
    if u is None:
        raise SystemExit("unidade %r nao esta no cadastro de %s (tem: %s)"
                         % (uid, slug, ", ".join(str(x.get("id")) for x in todas)))
    f, P = u.get("ficha") or {}, u.get("planta") or {}
    if not P.get("comodos"):
        raise SystemExit("a unidade %r nao tem planta cadastrada" % uid)

    # A PEGADA vem do lote, nao da planta. Um apartamento de 58 m2 nao e a pegada do
    # predio: o cadastro do lancamento descreve a torre em BLOCOS, e o que hospeda a
    # unidade e o marcado `principal` (ver `recsDoLancamento` no renderizador). Sem
    # blocos, cai na largura/profundidade do proprio `lote.predio`.
    pr = ((u.get("lote") or {}).get("predio")) or {}
    blocos_l = pr.get("blocos") or [{}]
    bl = next((b for b in blocos_l if b.get("principal")), None) or blocos_l[0]
    larg = bl.get("largura_m") or pr.get("largura_m")
    prof = bl.get("profundidade_m") or pr.get("profundidade_m")
    pav = bl.get("pavimentos") or pr.get("pavimentos")
    if not (larg and prof and pav):
        raise SystemExit("o cadastro de %r nao descreve a torre (lote.predio.largura_m/"
                         "profundidade_m/pavimentos). Sem isso nao ha o que modelar." % uid)

    # TODOS os blocos, no referencial do PRINCIPAL. O Castanheiras nao e uma caixa: sao
    # duas laminas, oito faixas de cobogo, duas caixas de escada mais altas que a torre
    # e um embasamento de 38 m rente a rua. Desenhar so o principal e o que fazia esta
    # pagina mostrar menos predio do que o mapa 3D ja mostra.
    du0, dv0 = bl.get("du") or 0, bl.get("dv") or 0
    lista = []
    for b in blocos_l:
        bw = b.get("largura_m") or pr.get("largura_m")
        bp = b.get("profundidade_m") or pr.get("profundidade_m")
        bn = b.get("pavimentos") or pr.get("pavimentos")
        if not (bw and bp and bn):
            continue
        lista.append({
            "pegada": anel_do_bloco((b.get("du") or 0) - du0, (b.get("dv") or 0) - dv0,
                                    bw, bp, b.get("giro_graus")),
            "pavimentos": bn,
            "cor": b.get("cor_parede") or pr.get("cor_parede"),
            # Janela so onde ha apartamento. Faixa de cobogo, caixa de escada e
            # embasamento com esquadria de sala ficariam com cara de torre corporativa.
            "janelas": bool(b.get("sacadas")) or b is bl,
            "principal": b is bl,
        })

    # A planta e desenhada no referencial DELA (canto em 0,0); a pegada e centrada na
    # origem. Centrar a planta na pegada e a unica escolha que esta pagina faz por conta
    # propria -- o cadastro nao diz em que ponto da laje a unidade fica.
    xs = [q[0] for c in P["comodos"] for q in c["poly"]]
    zs = [q[1] for c in P["comodos"] for q in c["poly"]]
    ox, oz = (min(xs) + max(xs)) / 2.0, (min(zs) + max(zs)) / 2.0
    def mv(q): return [round(q[0] - ox, 3), round(q[1] - oz, 3)]

    area = f.get("area_util") or f.get("area_total")
    quartos, suites = f.get("quartos"), f.get("suites")
    desc = ("%d dormitório%s" % (quartos, "s" if quartos != 1 else "")) if quartos else "Unidade"
    if suites:
        desc += " (%d suíte%s)" % (suites, "s" if suites != 1 else "")
    linhas = [linha_de_area(f),
              ("Dormitórios", str(quartos)) if quartos else None,
              ("Suítes", str(suites)) if suites else None,
              ("Banheiros", str(f["banheiros"])) if f.get("banheiros") else None,
              ("Vagas", str(f["vagas"])) if f.get("vagas") else None,
              ("Pé-direito", ("%.2f m" % P.get("pe_direito", 2.6)).replace(".", ",")),
              ("Pavimento", "%dº de %d" % (u.get("andar", 0), pav)),
              ("Construtora", f["construtora"]) if f.get("construtora") else None]
    comodos = [[c.get("nome", "—"),
                ("%.2f m²" % c["area"]).replace(".", ",") if c.get("area") else "—"]
               for c in sorted(P["comodos"], key=lambda c: -(c.get("area") or 0))]

    return {
        "empreendimento": f.get("empreendimento") or f.get("titulo") or uid,
        "unidade": "%s · %s m²" % (desc, ("%.0f" % area) if area else "?"),
        "endereco": f.get("endereco") or f.get("bairro") or "",
        "tag": {"venda": "À venda", "aluguel": "Para alugar"}.get(f.get("tipo"), "Imóvel"),
        "preco": brl(f.get("preco")) or "Sob consulta",
        "andar": u.get("andar", 0),
        "predio": {
            # `pegada`/`pavimentos` continuam sendo os do bloco PRINCIPAL: e nele que a
            # unidade mora, e e ele que o realce do andar pinta.
            "pegada": anel_do_bloco(0, 0, larg, prof),
            "pavimentos": pav,
            "pe_direito_pav": LV,
            "blocos": lista,
        },
        "planta": {
            "pe_direito": P.get("pe_direito", 2.6),
            # `area` vem do CADASTRO e nao do poligono: a planta 2D carimba o mesmo
            # numero que a ficha logo abaixo dela. Calcular por shoelace daria um valor
            # proximo e diferente, e duas areas discordando na mesma tela e pior que
            # nenhuma. Sem cadastro, o JS cai no shoelace do proprio desenho.
            "comodos": [{"nome": c.get("nome", "—"), "piso": c.get("piso", "quente"),
                         "area": c.get("area"),
                         "poly": [mv(q) for q in c["poly"]]} for c in P["comodos"]],
            "portas": [{"p": mv(d["p"]), "largura": d.get("largura", 0.8)}
                       for d in P.get("portas", [])],
            "janelas": [{"p": mv(j["p"]), "largura": j.get("largura", 1.2)}
                        for j in P.get("janelas", [])],
            # A MOBILIA do cadastro, no mesmo referencial recentrado. Sao as mesmas 25
            # pecas que o mapa 3D poe dentro da unidade -- catalogo, medida e cor. Sem
            # elas a planta 3D desta pagina era um casco vazio, e o produto ja mostra
            # mobiliado.
            "moveis": [dict(m, p=mv(m["p"])) for m in P.get("moveis", []) if m.get("p")],
        },
        "ficha": [l for l in linhas if l],
        "comodos": comodos,
        # O CADASTRO CRU. `plantaDaUnidade` do renderizador le a unidade original -- ela
        # centra a planta no volume e recentra o movel por conta propria, entao mandar a
        # versao ja deslocada daria uma planta deslocada duas vezes. As listas acima
        # continuam existindo porque sao o TEXTO da ficha, que e outra coisa.
        "_id": uid,
        "cadastro": {"id": u.get("id"), "andar": u.get("andar", 0),
                     "planta": P, "cores": u.get("cores") or {}},
    }

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
    # (16,5 x 9,2 m de piso, pe-direito 2,60 m, recuo no canto sudeste). O antigo
    # `demo_v18.py` (fora do HEAD desde o #48) usava as MESMAS coordenadas pra virar
    # cidade; aqui ela e desenhada de tres jeitos -- 2D, 3D e por dentro.
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
<title>Maquete 3D · @@TITULO@@</title>
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
  /* A MAQUETE NAO TEM MOLDURA, MAS TEM LIMITE. Ela continua um canvas transparente
     sem chao -- o degrade e o unico fundo, e e ele que da presenca ao volume sem
     prende-lo a um piso.

     O que saiu foi a SOBREPOSICAO. A margem negativa fazia o predio passar por cima
     da ficha, e a ideia parecia boa ate a construcao cobrir o "A VENDA" e a metragem:
     informacao coberta por desenho nao e profundidade, e informacao perdida. O
     `overflow:hidden` e a garantia dura -- por mais que a camera se aproxime ou a
     geometria cresca, nada e desenhado fora desta caixa. */
  /* A ALTURA E O QUE SOBRA, E NAO UMA FRACAO DA TELA. Com `40vh` numa janela de
     1000 px a cena ficava com 400 px, a ficha com 399, e os 179 px restantes viravam
     FAIXA MORTA NO TOPO -- a folha e empurrada pro rodape por `margin-top:auto`, entao
     toda sobra se acumula em cima do predio. Medido: margem de topo 179 px contra
     10 px embaixo, com o predio ja ocupando 93% do painel que tinha.
     `100vh - 440px` e a tela menos a ficha (399) menos as folgas (26 de padding e 12
     de respiro): a cena cresce ate a soma encostar nas duas bordas. O teto de 560 px
     e o que impede a miniatura de virar visualizador de tela cheia num monitor alto,
     e o piso de 220 px segura a leitura numa janela baixa. O 440 e medido nesta ficha;
     numa com menos comodos sobra um resto pequeno, nunca os 179 px. */
  #cena{position:relative;height:clamp(220px,calc(100vh - 440px),560px);min-width:0;overflow:hidden;
    margin-bottom:12px;
    background:radial-gradient(ellipse 62% 58% at 50% 46%,
      rgba(86,124,168,.17),rgba(86,124,168,.05) 55%,transparent 72%)}
  @supports (height:100dvh){ #cena{height:clamp(220px,calc(100dvh - 440px),560px)} }
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
    border-top:1px solid var(--line);flex-wrap:wrap}
  #modos::-webkit-scrollbar{display:none}
  /* O "Ver mapa" e um <a> e nao um <button>: ele SAI da pagina. Sendo ancora, o
     botao do meio abre noutra aba, o direito oferece copiar o endereco, e se o
     programa nao rodar ele continua levando ao mapa. A aparencia e a mesma; o que
     muda e a natureza. */
  #modos button,#modos a{flex:1 1 100px;min-width:0;font:inherit;font-size:11.5px;
    padding:9px 6px;border-radius:8px;cursor:pointer;background:rgba(255,255,255,.06);
    border:1px solid var(--line);color:var(--txt);transition:.15s;
    touch-action:manipulation;white-space:nowrap;text-align:center;
    text-decoration:none;display:block}
  #modos button:hover,#modos a:hover{background:rgba(255,255,255,.13)}
  #modos button[aria-pressed=true]{background:rgba(75,219,124,.16);
    border-color:rgba(75,219,124,.5);color:#BFF3D2}
  /* A CORTINA da ida pro mapa. Existe porque a troca e de PAGINA -- o mapa tem 14 MB
     e leva segundos pra montar -- e sem cobrir o corte o que se ve e a maquete
     congelando e depois um vazio. Ela tapa a folha INTEIRA e nao so a cena: a ficha
     tambem tem que sair, senao sobra texto boiando sobre nada. */
  #cortina{position:fixed;inset:0;z-index:9;background:var(--void);opacity:0;
    pointer-events:none;transition:opacity .5s ease;display:flex;
    align-items:center;justify-content:center;font-size:12px;letter-spacing:.07em;
    color:rgba(231,235,240,.55)}
  #cortina.on{opacity:1;pointer-events:auto}
  /* A BARRA DE FERRAMENTAS fica DENTRO da cena, colada na borda esquerda: ela fala
     sobre o desenho, e nao sobre o imovel -- o lugar dela e onde o gesto acontece,
     não na fileira de modos junto da ficha. Só aparece na planta 3D, que é onde
     deslocar tem serventia: na maquete o prédio é o assunto e sair de cima dele com
     ele girando sozinho não leva a lugar nenhum. */
  #ferramentas{position:absolute;left:10px;top:50%;transform:translateY(-50%);
    display:none;flex-direction:column;gap:6px;z-index:4}
  #cena.ferr #ferramentas{display:flex}
  #ferramentas button{width:38px;height:38px;padding:0;border-radius:9px;cursor:pointer;
    background:rgba(12,18,25,.72);border:1px solid var(--line);color:var(--txt);
    display:grid;place-items:center;backdrop-filter:blur(8px);
    touch-action:manipulation;transition:.15s}
  #ferramentas button:hover{background:rgba(12,18,25,.9)}
  #ferramentas button[aria-pressed=true]{background:rgba(75,219,124,.18);
    border-color:rgba(75,219,124,.55);color:#BFF3D2}
  #ferramentas svg{width:19px;height:19px;fill:none;stroke:currentColor;
    stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}
  /* O rótulo existe pra quem usa leitor de tela: `title` não é lido de forma
     confiável, e um botão só com desenho é um botão sem nome. */
  .sr{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);
    white-space:nowrap}
  @media (pointer:coarse){ #ferramentas button{width:44px;height:44px} }
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
  #ficha{position:relative;background:rgba(18,25,33,.92);border:1px solid var(--line);
    border-radius:14px;padding:16px 18px 18px}
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
    #cena{height:clamp(190px,30vh,290px);margin-bottom:10px}
    #ficha{padding:14px 14px 16px}
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

  #alternarFicha{display:flex;align-items:center;justify-content:center;margin:-8px auto 0;width:44px;height:32px;
    border:0;border-radius:6px;background:transparent;color:#99a5af;cursor:pointer}
  #alternarFicha:hover{color:var(--txt);background:rgba(255,255,255,.05)}
  #alternarFicha svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.6}
  body.ficha-recolhida #alternarFicha svg{transform:rotate(180deg)}
  #alternarFicha:focus-visible{outline:2px solid var(--verde);outline-offset:3px}
  body.ficha-recolhida .folha{height:calc(100vh - 26px - env(safe-area-inset-bottom));
    height:calc(100dvh - 26px - env(safe-area-inset-bottom));display:flex;flex-direction:column;margin:0 auto}
  body.ficha-recolhida #cena{height:0;min-height:160px;flex:1 1 0}
  body.ficha-recolhida #ficha{flex:none}
  body.ficha-recolhida #alternarFicha{margin-bottom:0}
  body.ficha-recolhida #notaModelo{display:none}
  /* Em telas pequenas, os detalhes rolam dentro da ficha; a navegacao fica acessivel. */
  @media (max-width:640px), (max-height:500px) and (max-width:1000px){
    body{padding:8px max(8px,env(safe-area-inset-right)) max(8px,env(safe-area-inset-bottom)) max(8px,env(safe-area-inset-left))}
    body .folha,body.ficha-recolhida .folha{height:calc(100vh - 16px - env(safe-area-inset-bottom));height:calc(100dvh - 16px - env(safe-area-inset-bottom));margin:0 auto;display:flex;flex-direction:column;gap:8px}
    body #cena,body.ficha-recolhida #cena{height:0;flex:1 1 0;min-height:120px;margin:0}
    #ficha{display:flex;flex-direction:column;min-height:0;max-height:62%;padding:8px 10px;flex:0 1 auto}
    #informacoes{overflow-y:auto;min-height:0;overscroll-behavior:contain;padding-right:2px}
    #alternarFicha{flex:none;margin:-4px auto 0}
    #modos{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:4px;flex:none;margin-top:6px;padding-top:6px;overflow:visible}
    #modos button,#modos a{min-width:0;min-height:44px;padding:8px 2px;font-size:11px;white-space:normal;display:flex;align-items:center;justify-content:center}
    #modos a{grid-column:1/-1}
    #dica{flex:none;font-size:10px;margin-top:6px}
    #ficha .preco{font-size:16px;margin-top:4px}
    .stats,.comodos{margin-top:8px;padding-top:8px}
    .comodos .grade{display:flex;flex-wrap:wrap;gap:4px 10px}
    .ci{font-size:11px;padding:0}
    body.ficha-recolhida #ficha{max-height:none;flex:none}
  }
  @media (min-width:640px) and (max-width:1000px) and (max-height:500px){
    body:not(.ficha-recolhida) .folha{max-width:none;display:grid;grid-template-columns:minmax(0,1fr) minmax(270px,40%)}
    body:not(.ficha-recolhida) #cena{height:100%;min-height:0}
    body:not(.ficha-recolhida) #ficha{max-height:100%;overflow:hidden}
  }
</style>
</head>
<body>
<div class="folha">
<div id="cena">
  <canvas id="c"></canvas>
  <div id="selo"><i></i><span id="seloT">3&ordm; andar</span></div>
  <svg id="p2d" hidden aria-label="Planta baixa"></svg>
  <!-- O QUE O ARRASTO FAZ. Girar e mover sao os dois gestos possiveis sobre o mesmo
       desenho, e num painel deste tamanho nao ha botao do meio nem tecla modificadora
       que a pessoa va descobrir sozinha. Dois icones dizem que existem os dois. -->
  <div id="ferramentas" role="group" aria-label="O que o arrasto faz">
    <button id="fGirar" type="button" aria-pressed="true" title="Arrastar gira a planta">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M20.5 12a8.5 8.5 0 1 1-2.6-6.1"/><path d="M20.5 3.5v4.2h-4.2"/></svg>
      <span class="sr">Girar</span>
    </button>
    <button id="fMover" type="button" aria-pressed="false" title="Arrastar move a planta">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3.2v17.6M3.2 12h17.6"/>
        <path d="M12 3.2 9.6 5.6M12 3.2l2.4 2.4M12 20.8l-2.4-2.4M12 20.8l2.4-2.4"/>
        <path d="M3.2 12l2.4-2.4M3.2 12l2.4 2.4M20.8 12l-2.4-2.4M20.8 12l-2.4 2.4"/></svg>
      <span class="sr">Mover</span>
    </button>
  </div>
  <div id="joy" hidden aria-hidden="true"><i></i></div>

</div>

<section id="ficha">
  <button id="alternarFicha" type="button" aria-expanded="true" aria-controls="informacoes" aria-label="Recolher informações" title="Recolher informações"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button>
  <div id="informacoes">
  <div class="topo">
    <div>
      <div class="tag" id="fTag"></div>
      <h1 id="fNome"></h1>
      <div class="sub" id="fSub"></div>
    </div>
    <div class="preco" id="fPreco"><small>Valor</small></div>
  </div>
  <div class="stats" id="fStats"></div>
  </div>
  <nav id="modos" aria-label="Como ver o im&oacute;vel">
    <button data-modo="maquete" aria-pressed="true">Pr&eacute;dio</button>
    <button data-modo="planta2d" aria-pressed="false">Planta 2D</button>
    <button data-modo="planta3d" aria-pressed="false">Planta 3D</button>
    <button data-modo="visita" aria-pressed="false">Visita 3D</button>@@BOTAO_MAPA@@
  </nav>
  <div id="dica">Arraste a maquete para girar</div>
  <button id="verConjunto" hidden style="margin-top:10px;padding:9px 14px;border:1px solid #52605e;border-radius:8px;background:#202b32;color:#e7ebf0;cursor:pointer" aria-pressed="false">Ver conjunto</button>
  <p id="notaModelo" hidden style="font-size:11px;color:#99a5af;margin-top:8px;line-height:1.5"></p>
</section>
</div>
<div id="cortina" aria-hidden="true">Abrindo o mapa&hellip;</div>

<script>@@THREE@@</script>
<script id="__imovel" type="application/json">@@DADOS@@</script>
<!-- A BIBLIOTECA DE MOVEIS, a mesma do renderizador: malha por peca, vinda do Blender,
     em posicao/normal/cor por vertice quantizadas. Entra como bloco JSON porque e assim
     que o `furniture-catalog.js` a le (`getElementById("__moveis")`), e reaproveitar o
     modulo inteiro vale os 840 KB: escrever um catalogo proprio aqui seria uma segunda
     verdade sobre a mesma mobilia. -->
<script id="__moveis" type="application/json">@@MOVEIS@@</script>
<script>@@FURN_PARAM@@</script>
<script>@@FURN_CAT@@</script>
<!-- O INTERIOR DO RENDERIZADOR, inteiro. Nove modulos, os mesmos arquivos que o mapa 3D
     monta -- nao uma copia adaptada. Eles sao fabricas independentes (`root.X.create`),
     entao a ordem aqui nao importa; o que importa e a ordem das CHAMADAS la embaixo.
     Com eles a planta desta pagina deixa de ser derivada por conta propria e passa a ser
     a MESMA de `plantaDaUnidade`: parede pela grade, esquadria com batente e folha,
     piso de madeira e frio com textura, e o bake de oclusao na cor por vertice. -->
@@LUZUE@@
<script>@@GEOMETRY@@</script>
<script>@@SHELL@@</script>
<script>@@TEXTURES@@</script>
<script>@@MATERIAIS@@</script>
<script>@@OPENINGS@@</script>
<script>@@FLOORPLAN@@</script>
<script>@@BAKE@@</script>
<script>@@ATLAS@@</script>
<script>@@HOUSEMESH@@</script>
@@EDITOR_LIB@@
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

@@CASTANHEIRAS@@

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
addEventListener("resize", redim);
if (window.ResizeObserver) new ResizeObserver(redim).observe(caixa);

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
    ? "Arraste a maquete para girar \u00b7 dois dedos aproximam \u00b7 ela volta a girar sozinha"
    : "Arraste a maquete para girar \u00b7 roda aproxima \u00b7 ela volta a girar sozinha";
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
try {
  var _fp = FurnitureParam.create({ THREE: THREE, getLib: function () { return FURN ? FURN.MOVEIS_LIB : {}; },
                                    rgbDe: rgbDe });
  FURN = FurnitureCatalog.create({ THREE: THREE, document: document, rgbDe: rgbDe,
    geoDeParts: _fp.geoDeParts, getMaterial: function () { return matMovel; },
    armarioParam: _fp.armarioParam, bancadaParam: _fp.bancadaParam, aereoParam: _fp.aereoParam,
    ripadoParam: _fp.ripadoParam, rackParam: _fp.rackParam, tvParam: _fp.tvParam,
    boxParam: _fp.boxParam, maquinaParam: _fp.maquinaParam, sofaParam: _fp.sofaParam });
} catch (e) { console.log("catalogo de moveis indisponivel: " + e); }

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
var TEX = InteriorTextures.create({ THREE: THREE, document: document });
var MAT = InteriorMaterials.create({ THREE: THREE, ambientePBR: ambientePBR,
  texParede: TEX.texParede, texPiso: TEX.texPiso, texMadeira: TEX.texMadeira,
  nrmParede: TEX.nrmParede, nrmPiso: TEX.nrmPiso, nrmMadeira: TEX.nrmMadeira,
  rugParede: TEX.rugParede, rugPiso: TEX.rugPiso, rugMadeira: TEX.rugMadeira });
var OPEN = Openings.create({ THREE: THREE, ESP: ESP, rgbDe: rgbDe,
  matEsq: MAT.matEsq, matAlum: MAT.matAlum, matVidro: MAT.matVidro });
var FP2 = FloorPlan.create({ inside: MG.inside, shoelace: MG.shoelace, ESP: ESP,
  ESQ_ANG: OPEN.ESQ_ANG, ESQ_MARCO: OPEN.ESQ_MARCO, safeInset: MG.safeInset,
  obbOf: MG.obbOf, BUILDING_INSET: BUILDING_INSET, PD: PD_INT,
  // `anelDoLote` e a ponte com o MAPA (lat/lon -> metros). Aqui o predio ja nasce na
  // origem, entao ela nunca e chamada: `plantaDaUnidade` recebe o `rec` pronto.
  anelDoLote: function () { return null; },
  MOVEIS: FURN ? FURN.MOVEIS : {} });
var BK = LightBake.create({ inside: MG.inside, PD: PD_INT });
var ATL = LightAtlas.create({ THREE: THREE, document: document, sujaSombra: function () {} });
var HM = HouseMesh.create({ THREE: THREE, ESP: ESP, rgbAcabamento: rgbAcabamento,
  triangulateRing: triangulaAnel, prismaQuad: ShellGeometry.prismaQuad,
  quadDoSeg: ShellGeometry.quadDoSeg, cursorDeLuz: ATL.cursorDeLuz,
  texturaDeLuz: ATL.texturaDeLuz, _LUZUE: ATL._LUZUE, BAKE: BK.BAKE,
  bakePrepara: BK.bakePrepara, matParede: MAT.matParede, matFrio: MAT.matFrio,
  matMadeira: MAT.matMadeira, geoDasEsquadrias: OPEN.geoDasEsquadrias });

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

/* A PLANTA, a mesma do mapa. Daqui saem parede pela grade, esquadria com batente e
   folha, comodo com piso tipado e a mobilia ja recentrada -- e por isso a lista que esta
   pagina montava por conta propria (`derivaParedes`, `montaMoveis`) nao e mais usada
   pela planta 3D nem pela visita. */
var PL_R = null;
try {
  PL_R = D.cadastro ? FP2.plantaDaUnidade(REC_UNI, D.cadastro) : null;
} catch (e) { console.log("planta do renderizador indisponivel: " + e); }
if (PL_R) console.log("planta: " + PL_R.paredes.length + " paredes, " +
                      PL_R.esquadrias.length + " esquadrias, " +
                      PL_R.comodos.length + " comodos, " + PL_R.moveis.length + " moveis");

/* ---- planta 3D: a mesma parede, extrudada ------------------------------- */
var PISOS = { quente: 0x8E6E4C, frio: 0xA9AFB6 };
var planta3d = null, tetoVisita = null;
var materiaisSemLuz=new WeakMap();
function guardaCoresPlanta(){
  if(D._id!=='monte-dos-cedros-37')return;
  planta3d.traverse(function(o){if(o.isMesh && o.userData.casa && o.geometry.attributes.color){o.userData.geoVisita=o.geometry;o.userData.geoPlanta=o.geometry.clone();}});
}
function luzDaPlanta(plana){
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
@@CAMINHADA@@
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
function vaiPara(novo) {
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

/* A IDA PRO MAPA.

   Nao da pra continuar a cena: e troca de PAGINA, e a do outro lado tem 14 MB que
   levam segundos pra montar. O que da e cobrir o corte, e cobrir na direcao certa --
   a camera MERGULHA no predio enquanto a cortina fecha, porque e isso que a proxima
   tela mostra: o mesmo imovel, de perto, no lugar dele na cidade. Um fade parado
   diria "carregando"; a descida diz "estou indo pra la".

   O enquadramento do outro lado nao e feito aqui: `pipeline/imovel.py` ja escreve
   `?em=lat,lon&r&p&t` do lote dentro da propria pagina do imovel, e o
   `ui/position-link.js` le isso no boot. O mapa abre olhando pro predio sem que esta
   pagina precise saber onde ele fica no mundo.

   A navegacao e no fim da transicao e nao no clique: disparar `location.href` antes
   mata o laco de animacao no mesmo quadro em alguns navegadores, e a cortina nunca
   chega a aparecer. */
(function ligaMapa() {
  var bt = document.getElementById("verMapa");
  if (!bt) return;                      // pagina avulsa: nao ha mapa ao lado
  var cortina = document.getElementById("cortina"), indo = false;
  bt.addEventListener("click", function (ev) {
    // Ctrl/Cmd/meio: a pessoa pediu OUTRA ABA. Nao ha transicao a fazer nesta.
    if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.button !== 0) return;
    ev.preventDefault();
    if (indo) return;
    indo = true;
    var destino = bt.href;
    cortina.classList.add("on");
    gira = false; zoomManual = true;     // o mergulho manda no raio ate a pagina trocar
    if (modo !== "maquete") vaiPara("maquete");
    mergulho = { t0: performance.now(), dur: 620, r0: orb.r, r1: orb.r * 0.52,
                 p0: orb.ph, p1: Math.min(1.45, orb.ph + 0.20) };
    setTimeout(function () { location.href = destino; }, 640);
  });
  /* VOLTAR PRECISA DESFAZER A CORTINA.

     O navegador guarda esta pagina viva ao navegar (bfcache) e devolve o DOM EXATO no
     "voltar" -- inclusive a cortina fechada e o mergulho no meio. Sem isto, voltar do
     mapa dava uma tela preta escrito "Abrindo o mapa...", e o unico jeito de sair era
     recarregar. `pageshow` cobre os dois caminhos: ele dispara na carga normal (onde
     isto nao faz nada) e na volta do cache (onde e tudo). */
  addEventListener("pageshow", function () {
    cortina.classList.remove("on");
    indo = false; mergulho = null; zoomManual = false;
    redim();
  });
})();

/* ---- laco ----------------------------------------------------------------- */
var tAnt = 0, pulso = 0;
function quadro(now) {
  requestAnimationFrame(quadro);
  var dt = tAnt ? Math.min(0.1, (now - tAnt) / 1000) : 0;
  tAnt = now;
  redim();
  /* O BAKE ASSENTA AQUI, em fatias. Tracar a oclusao de uma unidade inteira num quadro
     so trava a pagina por segundos; `bakePasso` gasta um orcamento por quadro e devolve
     `true` quando fecha. Ate la a parede aparece com a luz analitica e vai escurecendo
     nos cantos -- que e melhor que uma tela parada. */
  luzDaPlanta(false);
  if (BK.BAKE.fila && BK.bakePasso(BK.BAKE.fila, 9)) BK.BAKE.fila = null;
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
  if (mergulho) {
    var tm = Math.min(1, (now - mergulho.t0) / mergulho.dur);
    var em = 1 - Math.pow(1 - tm, 3);        // sai rapido e desacelera: parece queda
    orb.r  = mergulho.r0 + (mergulho.r1 - mergulho.r0) * em;
    orb.ph = mergulho.p0 + (mergulho.p1 - mergulho.p0) * em;
  }
  var giraSozinha = modo !== "visita" && modo !== "planta3d" && !mergulho;
  if (!gira && giraSozinha && now - ultimoToque > RETOMA) gira = true;
  if (gira && giraSozinha && !voo) orb.th += 0.16 * dt;
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
  luzDaPlanta(modo === "planta3d");
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
redim(); orb.r = raioQueEnquadra(); centralizaVertical(); poeCam();
@@EDITOR_CEDROS@@
requestAnimationFrame(quadro);
/* Porta pro QA. `quadro` entra porque em Chrome headless o rAF para depois dos
   primeiros quadros: sem ele, uma sonda so consegue desenhar chamando `ren.render`
   direto -- e ai o que o laco DECIDE (a camera da visita, o passo de caminhada, a
   posicao do sol) nunca roda, e o print sai com a camera do modo anterior. */
window.__maq = { cena:cena, cam:cam, ren:ren, orb:orb, alvo:alvo, predio:predio,
                 brilho:brilho, andar:ANDAR, N:N, poeCam:poeCam, quadro:quadro,
                 vaiPara:vaiPara, FP:FP, modo:function(){ return modo; },
                 editor:function(){return typeof editorCedros!=="undefined"?editorCedros:null;}, caminhada:caminhada, caminhoAte:caminhoAte, livre:livre, passoVisita:passoVisita, paredes:paredes, planta:function(){ return planta3d; } };
})();
</script>
</body>
</html>
"""


def le(caminho):
    return io.open(caminho, encoding="utf-8", newline="").read()


def bloco_luz(imovel):
    """O atlas de luz assado no Unreal, SO da unidade desta pagina.

    O `bloco_luzue` do pipeline embute as cinco unidades da cidade; aqui uma pagina e um
    imovel, e levar as outras quatro seria 700 KB de atlas que ninguem vai olhar. Ele so
    entra em cena com `?luz=ue` -- o padrao e o bake em JS, que nao precisa de arquivo."""
    uid = imovel.get("_id")
    if not uid:
        return '<script id="__luzue" type="application/json">{}</script>'
    import sys as _s
    _s.path.insert(0, RAIZ)
    from pipeline.build import blocos as _b
    try:
        todos = json.loads(_b.bloco_luzue(carrega_cidade()))
    except Exception as exc:
        print("  (sem atlas do Unreal: %s)" % exc)
        todos = {}
    so = {uid: todos[uid]} if uid in todos else {}
    if so:
        print("  atlas do Unreal: %s (%.0f KB)" % (uid, len(json.dumps(so)) / 1024))
    return ('<script id="__luzue" type="application/json">'
            + json.dumps(so, ensure_ascii=False).replace("</", "<\\/")
            + "</script>")


def carrega_cidade():
    from padrao.cidade import carrega
    return carrega(CIDADE)


def botao_mapa(imovel=None):
    """O "Ver mapa", ou nada.

    Sem `--mapa` o botao NAO E ESCRITO -- e nao escrito escondido. Esta pagina e feita
    pra viajar sozinha (duplo clique, anexo de e-mail), e ali nao existe mapa ao lado:
    um botao presente que nao leva a lugar nenhum e pior que botao ausente. Esconder
    com `hidden` tambem nao serviria: `[hidden]` ja falhou em <button> nesta casa, e o
    modo de falhar e o botao APARECER.
    """
    destino = MAPA or ("https://imobilaria-deccb.web.app/?voltar=https%3A%2F%2Fimobilaria-deccb-miniaturas.web.app%2Fmaquete-monte-dos-cedros-37.html" if imovel and imovel.get("_id") == "monte-dos-cedros-37" else None)
    if not destino:
        return ""
    from html import escape
    return ('\n    <a id="verMapa" href="%s">Ver mapa</a>'
            % escape(destino, quote=True))


def main():
    if UNIDADE == 'monte-dos-cedros-37' and '--geometria-base' not in sys.argv:
        from padrao_atual import render
        from pathlib import Path
        target = Path(SAIDA)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(render(offline=True, map_href=MAPA), encoding='utf8')
        print('Padrao atual Cedros: maquete, planta e visita com luz calculada ->', target)
        return 0
    imovel = do_cadastro(UNIDADE, CIDADE) if UNIDADE else IMOVEL
    three = le(THREE)
    R16 = os.path.join(RAIZ, "v1.5", "renderizador-v16-moveis")
    rend = os.path.join(R16, "interior")
    s = (PAGINA
         .replace("@@MOVEIS@@", le(os.path.join(RAIZ, "moveis", "moveis_lib.json")))
         .replace("@@FURN_PARAM@@", le(os.path.join(rend, "furniture-param.js")))
         .replace("@@FURN_CAT@@", le(os.path.join(rend, "furniture-catalog.js")))
         .replace("@@LUZUE@@", bloco_luz(imovel))
         .replace("@@GEOMETRY@@", le(os.path.join(R16, "core", "geometry.js")))
         .replace("@@SHELL@@", le(os.path.join(rend, "shell-geometry.js")))
         .replace("@@TEXTURES@@", le(os.path.join(R16, "materials", "interior-textures.js")))
         .replace("@@MATERIAIS@@", le(os.path.join(R16, "materials", "interior.js")))
         .replace("@@OPENINGS@@", le(os.path.join(rend, "openings.js")))
         .replace("@@FLOORPLAN@@", le(os.path.join(rend, "floor-plan.js")))
         .replace("@@BAKE@@", le(os.path.join(rend, "bake.js")))
         .replace("@@ATLAS@@", le(os.path.join(rend, "light-atlas.js")))
         .replace("@@CAMINHADA@@", le(os.path.join(RAIZ, "v1.5", "miniaturas", "caminhada.js")))
         .replace("@@EDITOR_LIB@@", ('<script>'+le(os.path.join(rend, 'furniture-editor.js'))+'</script>') if imovel.get('_id') == 'monte-dos-cedros-37' else '')
         .replace("@@EDITOR_CEDROS@@", le(os.path.join(RAIZ, 'v1.5', 'miniaturas', 'editor_cedros.js')) if imovel.get('_id') == 'monte-dos-cedros-37' else '')
         .replace("@@HOUSEMESH@@", le(os.path.join(rend, "house-mesh.js")))
         .replace("@@CASTANHEIRAS@@", (
             'var CASTANHEIRAS_BLENDER = ' + le(os.path.join(RAIZ, "v1.5", "miniaturas", MODELOS_BLENDER[imovel['_id']], "modelo.json")) + ';\n'
             + le(os.path.join(RAIZ, "v1.5", "miniaturas", "castanheiras.js"))
             ) if imovel.get('_id') in MODELOS_BLENDER else '')
         .replace("@@BOTAO_MAPA@@", botao_mapa(imovel))
         .replace("@@TITULO@@", imovel["empreendimento"] + " · " + imovel["unidade"])
         .replace("@@DADOS@@", json.dumps(imovel, ensure_ascii=False))
         .replace("@@THREE@@", three))
    os.makedirs(os.path.dirname(os.path.abspath(SAIDA)), exist_ok=True)
    # PORTAO DE `%%`. O template ja foi formatado por `%` um dia, e os escapes que
    # aquilo exigia sobreviveram a troca pra `.replace()`: sobrou `width:100%%` na folha,
    # que e declaracao INVALIDA. Sem tamanho de CSS o navegador exibe o canvas no
    # tamanho do BUFFER -- num monitor de dpr 1 da no mesmo e nao se ve nada; num
    # celular de dpr 1,75 a maquete sai 75% maior que o painel. Custou uma ida e volta
    # ate alguem abrir no telefone, entao vira portao.
    # PORTAO DE MARCADOR. O template ja foi formatado por `%` um dia, e restos daquilo
    # sobreviveram a troca pra `.replace()` -- duas vezes, e as duas so apareceram no
    # telefone: `width:100%%` (declaracao invalida, canvas no tamanho do buffer) e
    # `%(TITULO)s` cru na barra de titulo. Nenhum dos dois quebra nada de forma visivel
    # no desktop, entao viram portao.
    for marca in ("%%", "%(TITULO)s", "%(DADOS)s", "%(THREE)s", "@@"):
        if marca in s:
            raise SystemExit("saida tem %r -- marcador de montagem que nao foi trocado" % marca)
    io.open(SAIDA, "w", encoding="utf-8", newline="").write(s)
    print("%.2f MB -> %s" % (len(s.encode("utf-8")) / 1e6, SAIDA))
    print("  %s · %d pavimentos · unidade no %dº andar"
          % (imovel["empreendimento"], imovel["predio"]["pavimentos"], imovel["andar"]))
    return 0


if __name__ == "__main__":
    sys.exit(main())

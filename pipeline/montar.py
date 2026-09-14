# -*- coding: utf-8 -*-
"""Etapa 8: monta a pagina a partir das PECAS, em vez de patchear texto.

Substitui a cadeia `make_v4 -> make_v5 -> make_v7 -> make_v8` (59 ancoras de texto
exato, encadeadas). Aqui o renderizador e codigo de verdade em `renderizador/`, e a
pagina e a concatenacao das pecas com os blocos de dado no meio:

    cabeca.html  <- titulo e meta
    lib/three.min.js + lib/earcut.min.js
    estilo.css
    <script type="application/json" id="__*data">  os 6 blocos, na ordem
    corpo.html   <- canvas, HUD, painel
    app.js       <- O RENDERIZADOR (120 KB)

    python pipeline/montar.py                  # -> v8/sao-carlos-v8-aberto.html + v8.html
    python pipeline/montar.py --sem-zip        # so a versao aberta
    python pipeline/montar.py --conferir <arq> # exige saida byte a byte igual a <arq>

`--conferir` e o aceite da migracao: a pagina montada tem que reproduzir exatamente o
HTML de onde as pecas foram extraidas. Depois disso, `make_v4..make_v8` viram historico
(seguem em v4/, v5/, v7/, v8/ e nao sao mais chamados pelo runner).

O carimbo do HUD e a UNICA coisa que muda entre duas montagens do mesmo dado (a data),
entao `--conferir` normaliza os dois lados so nessa linha antes de comparar.
"""
import base64, io, json, os, re, sys, time, zlib

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.abspath(os.path.join(AQUI, "..")) + os.sep
sys.path.insert(0, RAIZ)
from padrao.cidade import carrega, lista

from pipeline.build.config import resolve, V_PADRAO, VERSAO


def saida(chave, config=None):
    return str((config or resolve()).saida(chave))

# id do bloco -> chave da fonte no JSON da cidade. A ORDEM importa: o renderizador le
# o relevo antes de chao/rua/muro se registrarem no terrainRegistry.
# `imoveis` fica junto dos dados grandes (comprime bem e o app so o le tarde).
DADOS = [("__imoveis", "imoveis"),
         ("__grounddata", "chao_tris"),
         ("__murosdata", "muros"),
         ("__streetdata", "rua_tris"),
         ("__elevdata", "relevo"),
         ("__portoes", "portoes"),
         ("__vegetacao", "vegetacao"),
         ("__citydata", "city_saida"),
         ("__arvores", "arvores"),
         ("__poidata", "pois")]

CARIMBO = re.compile(r'(<div class="sub" id="build"[^>]*>)[^<]*(</div>)')


def le(rel, config=None):
    return io.open(os.path.join((config or resolve()).fonte, rel.replace("/", os.sep)),
                   encoding="utf-8", newline="").read()


def bloco_moveis():
    """Biblioteca de moveis modelados no Blender (`moveis/moveis_lib.json`).

       Ausente vira "{}": o catalogo em `app.js` continua com as pecas de caixa, e so
       os moveis marcados `malha:` dependem daqui. Cidade montada sem a biblioteca
       perde esses moveis, nao quebra a montagem."""
    cam = os.path.join(RAIZ, "moveis", "moveis_lib.json")
    if not os.path.exists(cam):
        print("  (sem moveis_lib.json: moveis de malha desligados)")
        return "{}"
    return io.open(cam, encoding="utf-8", newline="").read()


def bloco_textura():
    """Texturas de fachada da cidade (`texturas/*.webp`), em data URI.

       Vai EMBUTIDO pelo mesmo motivo de todo o resto: a pagina abre com duplo clique
       em file:// e `fetch` de arquivo local e barrado por CORS.

       Sao 81 KB (109 em base64) numa pagina de 19,5 MB -- 0,6%. Antes de medir eu
       tinha estimado 1,5 a 3 MB; errado por duas ordens de grandeza, porque material
       quase uniforme comprime a quase nada. Ver `pipeline/baixa_texturas.py`, que
       tambem guarda a procedencia (ambientCG, CC0).

       Ausente vira "{}": o shader cai no ramo sem textura e a cidade continua como
       era. Textura de fachada e melhoria, nao dependencia."""
    import base64
    base = os.path.join(RAIZ, "texturas")
    fora = {}
    for nome in ("reboco", "tijolo", "chao"):
        cam = os.path.join(base, nome + ".webp")
        if not os.path.exists(cam):
            continue
        with open(cam, "rb") as f:
            fora[nome] = "data:image/webp;base64," + base64.b64encode(f.read()).decode()
    if not fora:
        print("  (sem texturas/: fachada sem textura)")
        return "{}"
    print("  texturas de fachada: %s (%.0f KB)"
          % (", ".join(sorted(fora)), sum(len(v) for v in fora.values()) / 1024.0))
    return json.dumps(fora, separators=(",", ":"))


def bloco_cidade(CID):
    """O que o renderizador precisa saber sobre a cidade, tirado do JSON dela.

    Fica FORA da compressao de proposito: o app le isso na inicializacao do modulo,
    antes de qualquer descompactacao assincrona. Sao ~200 bytes."""
    q_base = json.load(io.open(CID.caminho("city_saida"), encoding="utf-8"))["q"]
    if q_base != CID._d["quantizacao"]:
        raise SystemExit("quantizacao divergente: city.json tem q=%s, "
                         "padrao/cidades/%s.json diz %s -- o renderizador leria a errada"
                         % (q_base, CID.slug, CID._d["quantizacao"]))
    return json.dumps({"slug": CID.slug, "nome": CID.nome, "uf": CID.uf,
                       "centro": {"lat": CID.clat, "lon": CID.clon},
                       "quantizacao": CID._d["quantizacao"],
                       "relevo_grade": CID._d["relevo_grade"],
                       # Que especie vai na rua e na praca desta cidade, e com que
                       # espacamento. Mistura de arvore muda de cidade pra cidade
                       # (a de Curitiba nao e a de Ribeirao), entao e dado, nao codigo.
                       "arborizacao": CID._d.get("arborizacao", {}),
                       # O que esta cidade desenha e as outras ainda nao. Escopo de
                       # aparencia era, ate aqui, "qual pagina foi montada por ultimo"
                       # -- ou seja, nenhum: a proxima montagem de qualquer motivo
                       # levava a mudanca junto. Aqui vira chave, e quem nao declarou
                       # continua igual mesmo remontado. Ver renderizador/app.js (APAR).
                       "aparencia": CID._d.get("aparencia", {}),
                       "arquivo_base": os.path.basename(CID.caminho("city_saida"))},
                      ensure_ascii=False)


# sRGB -> linear, por byte. O renderizador roda com `outputEncoding = sRGBEncoding`:
# ele trata a cor que recebe como LINEAR e reencoda pra tela. A biblioteca guarda a
# cor em sRGB (que e o que se le num seletor de cor); a conversao mora aqui, uma vez,
# em vez de ficar espalhada entre o Blender e o JS.
_LIN = [round(255.0 * ((c/255.0)/12.92 if c/255.0 <= 0.04045
                       else (((c/255.0) + 0.055)/1.055) ** 2.4)) for c in range(256)]


def bloco_arvores(CID):
    """A biblioteca de arvores, so o LOD baixo e ja no espaco de cor do renderizador.

    O LOD alto (copa de 80 tris por blob) fica no arquivo pra uso de perto; a cidade
    leva o baixo, que e o que a camera de cima resolve. Mandar os dois dobraria o
    bloco sem mudar um pixel do que se ve."""
    p = CID.caminho("arvores")
    if not os.path.exists(p):
        print("  (sem %s: cidade sai sem arvore)" % os.path.basename(p))
        return '{"especies":{}}'
    lib = json.load(io.open(p, encoding="utf-8"))
    out = {}
    for nome, e in lib["especies"].items():
        g = e["lod"]["0"]
        out[nome] = {"pos_cm": g["pos_cm"], "nrm_127": g["nrm_127"],
                     "col": [_LIN[c] for c in g["col"]], "idx": g["idx"],
                     "alt_m": e["altura_m"]}
    print("  arvores: %d especies, %d tris no LOD baixo"
          % (len(out), sum(len(e["idx"]) // 3 for e in out.values())))
    return json.dumps({"especies": out}, separators=(",", ":"))


def bloco_unidades(CID):
    """As plantas FORNECIDAS desta cidade, uma por pasta em plantas_fornecidas/.

    Fica fora da compressao pelo mesmo motivo do bloco da cidade: sao alguns KB, e o
    renderizador consulta a lista no clique, nao no boot -- entrar numa descompactacao
    assincrona por causa disso seria trocar simplicidade por nada. `cidade: null` e
    planta de gabarito: vale em qualquer cidade.

    `plantas_de` no JSON da cidade deixa uma VARIANTE herdar o acervo da cidade de
    origem: a variante tem slug proprio (pra ter QA proprio) e o cadastro do imovel
    continua dizendo o slug original.
    """
    base = os.path.join(RAIZ, "plantas_fornecidas")
    out = []
    if os.path.isdir(base):
        for nome in sorted(os.listdir(base)):
            p = os.path.join(base, nome, "unidade.json")
            if not os.path.exists(p):
                continue
            u = json.load(io.open(p, encoding="utf-8"))
            if u.get("cidade") not in (None, CID.slug, CID.plantas_de):
                continue
            # Campo com _ na frente e anotacao pra humano (conflito de ficha, topologia
            # lida da imagem, pendencia). Fica no arquivo, nao viaja pra pagina.
            u = {k: v for k, v in u.items() if not k.startswith("_")}
            if "planta" in u:
                u["planta"] = {k: v for k, v in u["planta"].items() if not k.startswith("_")}
                # MOBILIA AUTOMATICA, e as tres formas de nao ter.
                #
                # `pipeline/mobiliar.py` deduz um layout da planta e grava em
                # `moveis.auto.json`. Ele entra AQUI, por merge, e nunca dentro do
                # `unidade.json` -- cadastro e de quem cadastra.
                #
                #   1. mobilia posta A MAO em `planta.moveis` ganha (o merge so
                #      acontece quando a lista esta vazia);
                #   2. `planta.mobiliar: false` no cadastro recusa a automatica
                #      naquela unidade -- e a chave pra planta que nao tem movel;
                #   3. `?moveis=0` na URL desliga na pagina inteira, sem rebuild.
                auto = os.path.join(base, nome, "moveis.auto.json")
                if (not u["planta"].get("moveis") and u["planta"].get("mobiliar") is not False
                        and os.path.exists(auto)):
                    d = json.load(io.open(auto, encoding="utf-8"))
                    u["planta"]["moveis"] = d.get("moveis") or []
                    if u["planta"]["moveis"]:
                        print("    %s: %d moveis automaticos"
                              % (u.get("id"), len(u["planta"]["moveis"])))
                u["planta"].pop("mobiliar", None)
                if not u["planta"].get("comodos"):
                    print("  (planta %s ainda sem comodos: entra so como ficha)" % u.get("id"))
            out.append(u)
    if out:
        print("  unidades fornecidas: %s" % ", ".join(str(u.get("id")) for u in out))
    return json.dumps(out, ensure_ascii=False)


def bloco_luzue(CID):
    """Os atlas de luz assados no Unreal, um por unidade que tenha.

    Vai EMBUTIDO em data URI, e nao como arquivo ao lado, pelo mesmo motivo de todo o
    resto: a pagina abre com duplo clique em file://, e `fetch` de arquivo local e
    barrado por CORS. Sao ~820 KB de PNG pras cinco unidades (~1,1 MB em base64) --
    cabe. Quando a publicacao virar servidor, o caminho e trocar isto por URL e
    carregar sob demanda; a estrutura ja e POR UNIDADE justamente pra isso.

    O que viaja: o tamanho do atlas, o retangulo de CADA peca na ordem que
    `pipeline/unreal_exporta.py` escreveu, a escala de exposicao e a imagem. A
    geometria NAO viaja -- ela continua nascendo do cadastro, dentro do renderizador.
    E o que impede o Unreal de virar uma segunda fonte de verdade da planta.
    """
    import base64
    base = os.path.join(RAIZ, "unreal", "lightmaps")
    malhas = os.path.join(RAIZ, "unreal", "malhas")
    fornecidas = os.path.join(RAIZ, "plantas_fornecidas")
    out = {}
    if not os.path.isdir(base):
        return "{}"
    for nome in sorted(os.listdir(base)):
        if not nome.endswith(".png"):
            continue
        ident = nome[:-4]
        # so entra a unidade que E desta cidade -- a mesma regra de bloco_unidades()
        u = os.path.join(fornecidas, ident, "unidade.json")
        if os.path.exists(u):
            d = json.load(io.open(u, encoding="utf-8"))
            if d.get("cidade") not in (None, CID.slug, CID.plantas_de):
                continue
        plano = os.path.join(malhas, "%s.tiles.json" % ident)
        if not os.path.exists(plano):
            continue
        pl = json.load(io.open(plano, encoding="utf-8"))
        png = base64.b64encode(open(os.path.join(base, nome), "rb").read()).decode()
        out[ident] = {"atlas": pl["atlas"],
                      "escala": round(1.0 / 0.62, 3),
                      "rects": [q["rect"] for q in pl["pecas"]],
                      "png": "data:image/png;base64," + png}
    if out:
        print("  luz do unreal: %s" % ", ".join(
            "%s (%d pecas, %.0f KB)" % (k, len(v["rects"]), len(v["png"]) / 1024.0)
            for k, v in out.items()))
    return json.dumps(out, separators=(",", ":"))


def monta(carimbo=None, config=None):
    config = config or resolve()
    CID = config.cidade()
    VERSAO = config.versao
    FONTE = str(config.fonte)
    def ler(rel):
        return le(rel, config)
    carimbo = carimbo or "%s / %s / %s" % (CID.slug, VERSAO, time.strftime("%Y-%m-%d %H:%M"))
    partes = [ler("cabeca.html").replace("{{CIDADE}}", CID.nome).replace("{{VERSAO}}", VERSAO),
              '<script type="application/json" id="__cidade">', bloco_cidade(CID), "</script>\n",
              '<script type="application/json" id="__unidades">', bloco_unidades(CID), "</script>\n",
              '<script type="application/json" id="__luzue">', bloco_luzue(CID), "</script>\n",
              '<script type="application/json" id="__moveis">', bloco_moveis(), "</script>\n",
              '<script type="application/json" id="__textura">', bloco_textura(), "</script>\n",
              "<script>", ler("lib/three.min.js"), "</script>\n",
              "<script>", ler("lib/earcut.min.js"), "</script>\n",
              "<style>", ler("estilo.css"), "</style>\n"]
    for ident, chave in DADOS:
        if ident == "__arvores":
            partes += ['<script type="application/json" id="%s">' % ident,
                       bloco_arvores(CID), "</script>\n"]
            continue
        p = CID.caminho(chave)
        # Bloco ausente vira lista vazia em vez de quebrar a montagem: cidade nova pode
        # nao ter POI mapeado nem muro, e o renderizador ja trata array vazio (o
        # buildX() correspondente simplesmente nao cria malha). O que NAO pode faltar e
        # a base da cidade -- sem ela nao ha o que desenhar.
        if os.path.exists(p):
            d = io.open(p, encoding="utf-8", newline="").read()
        elif chave == "city_saida":
            raise SystemExit("falta a base da cidade: %s" % p)
        else:
            d = "[]"; print("  (sem %s: bloco %s vazio)" % (os.path.basename(p), ident))
        if chave == "city_saida" and os.path.exists(os.path.join(FONTE, "urban-models.js")):
            pack_path = os.path.join(RAIZ, "modelos_urbanos", "v1", "mapa-casas.json")
            if os.path.exists(pack_path):
                from pipeline.encaixar_casas_lotes import compile_placements
                placements = compile_placements(CID, d, io.open(pack_path, encoding="utf-8").read(), RAIZ)
                city = json.loads(d); city['urbanLots'] = placements
                d = json.dumps(city, ensure_ascii=False, separators=(',', ':'))
        partes += ['<script type="application/json" id="%s">' % ident, d, "</script>\n"]
    corpo = ler("corpo.html").replace("{{CIDADE}}", CID.nome)
    corpo = CARIMBO.sub(lambda m: m.group(1) + carimbo + m.group(2), corpo)
    urban = ""
    if os.path.exists(os.path.join(FONTE, "urban-models.js")):
        urban = ler("terrain-fit.js") + "\n" + ler("road-clearance.js") + "\n" + ler("urban-models.js") + "\n"
        pack = os.path.join(RAIZ, "modelos_urbanos", "v1", "mapa-casas.json")
        dados = io.open(pack, encoding="utf-8").read() if os.path.exists(pack) else "{}"
        compact_path = os.path.join(RAIZ, "modelos_urbanos", "v1", "compactos.json")
        if os.path.exists(pack) and os.path.exists(compact_path):
            library = json.loads(dados)
            library['assets'] += json.load(io.open(compact_path, encoding="utf-8"))['assets']
            dados = json.dumps(library, separators=(',', ':'))
        partes += ['<script type="application/json" id="__urbanModels">', dados, "</script>\n"]
    if os.path.exists(os.path.join(FONTE, "exterior-details.js")):
        exterior_root = os.path.join(RAIZ, "exteriores", "v1")
        exterior_pack = json.load(io.open(os.path.join(exterior_root, "mapa-exteriores.json"), encoding="utf-8"))
        exterior_pack['placements'] = (json.load(io.open(os.path.join(exterior_root, "encaixes.json"), encoding="utf-8"))['placements']
                                       if CID.slug == 'sao-carlos' else [])
        exterior_pack['props'] = json.load(io.open(os.path.join(exterior_root, "componentes.json"), encoding="utf-8"))['assets']
        terrain_pack = json.load(io.open(os.path.join(exterior_root, "terrenos-manifesto.json"), encoding="utf-8"))
        exterior_pack['parcelTiles'] = terrain_pack if CID.slug == 'sao-carlos' else dict(keys=[],parcels=0,size=160)
        exterior_pack['palette'] = terrain_pack['palette']
        exterior_pack['aerial'] = json.load(io.open(os.path.join(exterior_root, 'atlas-distante.json'), encoding='utf-8'))
        import base64
        exterior_pack['aerial']['image'] = 'data:image/png;base64,' + base64.b64encode(open(os.path.join(exterior_root, 'atlas-distante.png'), 'rb').read()).decode()
        partes += ['<script type="application/json" id="__exteriorModels">',
                   json.dumps(exterior_pack, separators=(',', ':')), "</script>\n"]
        urban += ler("exterior-details.js") + "\n"
    listing_js = ""
    if os.path.exists(os.path.join(FONTE, "listing-models.js")):
        listing_pack = os.path.join(RAIZ, "modelos_cadastrados", "estudos.json")
        listing_data = io.open(listing_pack, encoding="utf-8").read() if CID.slug == 'sao-carlos' and os.path.exists(listing_pack) else '{"assets":[]}'
        partes += ['<script type="application/json" id="__listingModels">', listing_data, "</script>\n"]
        listing_js = ler("listing-models.js")
    partes += [corpo, "<script>", urban, listing_js, ler("app.js"), "</script>", ler("rabo.html")]
    return "".join(partes)


# ---- compressao (o que o make_v8 fazia) -------------------------------------
def comprime(s):
    """Cada bloco embutido vira deflate cru + base64 e volta no boot por
    DecompressionStream("deflate-raw") -- nativo, sem biblioteca de inflate.

    A descompressao e assincrona e o renderizador e um <script> classico que monta
    chao/rua/muro no meio da pagina. Em vez de reescrever aquilo em async, o PROPRIO
    programa vira um pacote comprimido e e injetado como <script> depois que os dados
    chegaram. Por isso o carregador vai no FIM: ele varre script[data-zip], que
    precisam ja estar parseados."""
    pedacos = []
    for ident, _ in DADOS:
        abre = '<script type="application/json" id="%s">' % ident
        i = s.index(abre); j = s.index("</script>", i)
        pedacos.append((s[i:j + 9], s[i + len(abre):j], "json", ident))
    # As bibliotecas e o app tambem vao comprimidos -- three.js sozinho e 589 KB, e
    # deixar so os dados comprimidos custava 0,4 MB de pagina a mais. Sao os tres
    # <script> SEM atributo, em ordem: three, earcut, app. O `__cidade` fica de fora
    # (o app le ele na inicializacao, antes de qualquer descompactacao).
    abre_urban = '<script type="application/json" id="__urbanModels">'
    if abre_urban in s:
        i = s.index(abre_urban); j = s.index("</script>", i)
        pedacos.append((s[i:j + 9], s[i + len(abre_urban):j], "json", "__urbanModels"))
    abre_exterior = '<script type="application/json" id="__exteriorModels">'
    if abre_exterior in s:
        i = s.index(abre_exterior); j = s.index("</script>", i)
        pedacos.append((s[i:j + 9], s[i + len(abre_exterior):j], "json", "__exteriorModels"))
    abre_listing = '<script type="application/json" id="__listingModels">'
    if abre_listing in s:
        i = s.index(abre_listing); j = s.index("</script>", i)
        pedacos.append((s[i:j + 9], s[i + len(abre_listing):j], "json", "__listingModels"))
    anon = [m for m in re.finditer(r"<script>", s)]
    if len(anon) != 3:
        raise SystemExit("esperava 3 <script> sem atributo; achei %d" % len(anon))
    for n, m in enumerate(anon):
        j = s.index("</script>", m.end())
        pedacos.append((s[m.start():j + 9], s[m.end():j], "js",
                        ["__three", "__earcut", "__app"][n]))
    for k, (bruto, corpo, tipo, ident) in enumerate(pedacos):
        z = base64.b64encode(zlib.compress(corpo.encode("utf-8"), 9)[2:-4]).decode()
        s = s.replace(bruto, '<script type="text/plain" data-zip="%s" id="%s">%s</script>'
                      % (tipo, ident, z), 1)
        print("      %-14s %7.2f MB -> %6.2f MB" % (ident, len(corpo) / 1e6, len(z) / 1e6))
    return s + CARREGADOR


CARREGADOR = """
<script>
// Desempacota os blocos e SO ENTAO injeta o programa. Ver montar.py:comprime().
(async function () {
  const de64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  async function inflar(b64) {
    const st = new DecompressionStream("deflate-raw");
    const r = new Response(new Blob([de64(b64)]).stream().pipeThrough(st));
    return await r.text();
  }
  // Ordem do documento: os blocos de dado vem antes das bibliotecas, e o app e o
  // ultimo. Descompacta tudo primeiro, DEPOIS executa os js na mesma ordem -- three e
  // earcut tem que estar de pe antes da primeira linha do app rodar.
  const zips = [...document.querySelectorAll("script[data-zip]")];
  const js = [];
  for (const el of zips) {
    const txt = await inflar(el.textContent.trim());
    if (el.dataset.zip === "js") { js.push(txt); continue; }
    const t = document.createElement("script");
    t.type = "application/json"; t.id = el.id; t.textContent = txt;
    el.replaceWith(t);
  }
  for (const src of js) {
    const t = document.createElement("script"); t.textContent = src;
    document.body.appendChild(t);
  }
})();
</script>
"""


def blocos(t):
    """Quebra uma pagina montada nos blocos de topo, pra comparar peca a peca.

    Os blocos anonimos sao nomeados por PAPEL (three/earcut/app/css), nao por posicao:
    numerar por ordem faz o `__cidade` novo deslocar todos os indices e a comparacao
    vira ruido -- foi o que aconteceu na primeira tentativa."""
    fora = []; dentro = {}; ant = 0; anon = []
    for m in re.finditer(r"<(script|style)([^>]*)>", t):
        tag = m.group(1); fim = t.index("</%s>" % tag, m.end())
        corpo = t[m.end():fim]
        ident = re.search(r'id="([^"]+)"', m.group(2))
        if ident: dentro[ident.group(1)] = corpo
        elif tag == "style": dentro["css"] = corpo
        else: anon.append(corpo)
        fora.append(t[ant:m.start()]); ant = fim + len(tag) + 3
    fora.append(t[ant:])
    # o ULTIMO anonimo e sempre o app; dos anteriores, o que cita earcut e o earcut.
    # (Detectar por "THREE" no inicio nao funciona: o proprio app usa THREE nas
    # primeiras linhas e as duas pecas colidiam na mesma chave.)
    if anon:
        dentro["app"] = anon[-1]
        for c in anon[:-1]:
            dentro["lib:earcut" if "earcut" in c[:400] else "lib:three"] = c
    return fora, dentro


def confere(montado, alvo):
    """Aceite da migracao. Compara PECA A PECA, nao a string inteira.

    A concatenacao nao bate byte a byte por um motivo inerte: o HTML antigo tinha
    linha em branco entre alguns blocos de topo e nao entre outros -- acidente do
    historico de patches, nao significado. O que precisa bater exatamente e o
    CONTEUDO de cada bloco (three.js, earcut, css, os 6 blocos de dado e o
    renderizador) e o markup fora deles a menos de espaco em branco."""
    o = io.open(alvo, encoding="utf-8", newline="").read()
    sem_carimbo = lambda t: CARIMBO.sub(lambda m: m.group(1) + "CARIMBO" + m.group(2), t)
    fa, da = blocos(sem_carimbo(montado)); fb, db = blocos(sem_carimbo(o))
    ruim = 0
    if set(da) != set(db):
        print("blocos diferentes: so no montado %s | so no alvo %s"
              % (sorted(set(da) - set(db)), sorted(set(db) - set(da)))); ruim += 1
    for k in sorted(set(da) & set(db)):
        igual = da[k] == db[k]
        print("  %-14s %9.1f KB  %s" % (k, len(da[k]) / 1024, "identico" if igual else "DIFERE"))
        if not igual: ruim += 1
    ma = "".join(fa).split(); mb = "".join(fb).split()
    if ma == mb:
        print("  %-14s %9s      identico (a menos de espaco em branco)" % ("markup", ""))
    else:
        import difflib
        d = [l for l in difflib.unified_diff(mb, ma, "alvo", "montado", n=0, lineterm="")]
        print("  %-14s %9s      DIFERE em %d palavra(s):" % ("markup", "", len([x for x in d if x[:1] in "+-"]) - 2))
        for l in d[2:14]: print("      %s" % l)
        ruim += 1
    if ruim:
        print("\n%d peca(s) divergente(s)." % ruim); return 1
    print("\nTodas as pecas identicas a %s." % os.path.relpath(alvo, RAIZ))
    print("So mudou espaco em branco entre blocos de topo (inerte em HTML).")
    return 0


def main(argv=None):
    import argparse
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('cidade', nargs='?')
    parser.add_argument('--variante')
    parser.add_argument('--destino', help='Diretorio isolado para os dois HTMLs')
    parser.add_argument('--sem-zip', action='store_true')
    parser.add_argument('--conferir')
    args = parser.parse_args(argv)
    try:
        config = resolve(args.cidade, args.variante, args.destino)
        s = monta(config=config)
    except (ValueError, KeyError) as exc:
        parser.error(str(exc))
    if args.conferir:
        return confere(s, args.conferir)
    aberto = saida("html_saida", config)
    os.makedirs(os.path.dirname(aberto), exist_ok=True)
    io.open(aberto, "w", encoding="utf-8", newline="").write(s)
    print("aberto: %.2f MB -> %s" % (len(s) / 1e6, aberto))
    if args.sem_zip: return 0
    print("  comprimindo:")
    z = comprime(s)
    alvo = saida("html_comprimido", config)
    io.open(alvo, "w", encoding="utf-8", newline="").write(z)
    print("comprimido: %.2f MB -> %s (-%.0f%%)"
          % (len(z) / 1e6, alvo, 100 * (1 - len(z) / len(s))))
    return 0


if __name__ == "__main__":
    sys.exit(main())

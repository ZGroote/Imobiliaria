# -*- coding: utf-8 -*-
"""Blocos de dado que a pagina carrega inteiros: moveis, texturas, a cidade, as
arvores, as plantas fornecidas e os atlas de luz do Unreal.

Sao a outra metade do que estava no `monta()`. Cada um le arquivos do acervo e devolve
TEXTO JSON pronto pra entrar num <script type="application/json">; nenhum deles toca na
cena nem depende da ordem em que a pagina e escrita. O que muda de um pro outro e so a
politica de ausencia -- e ela esta escrita em cada funcao, porque nao e a mesma:
biblioteca de movel ausente desliga os moveis de malha, textura ausente cai no ramo sem
textura, e cidade ausente e erro.
"""
import io
import json
import os

from .config import RAIZ

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

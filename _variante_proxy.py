# -*- coding: utf-8 -*-
"""Deriva `ribeirao-preto-proxy`: a MESMA cidade, com o footprint real no lugar
da casa gerada.

Nao toca em nenhum arquivo existente. So escreve
`padrao/cidades/ribeirao-preto-proxy.json`, mudando quatro coisas:

  slug / nome          identidade propria, pra ter relatorio de QA proprio
  fontes.city_saida    aponta pro city_base (o footprint do Overture)
  fontes.html_*        saida propria, pra nao sobrescrever a pagina boa
  plantas_de           herda o acervo de imovel da cidade de origem

Todo o resto -- vias, limiares, arborizacao, aparencia, relevo, NDVI -- e
copiado byte a byte da cidade original: a variante tem que diferir SO na
geometria de edificacao, senao a comparacao nao vale.
"""
import collections, io, json, os, sys

sys.stdout.reconfigure(encoding="utf-8")
AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
# A versao tem UM dono (montar.py). Fixar "v13" aqui fazia a variante
# regerada depois de um bump gravar na pasta velha, em silencio.
from pipeline.montar import VERSAO
CID_DIR = os.path.join(AQUI, "padrao", "cidades")

ORIG = "ribeirao-preto"
NOVO = "ribeirao-preto-proxy"

origem = os.path.join(CID_DIR, ORIG + ".json")
destino = os.path.join(CID_DIR, NOVO + ".json")

d = json.load(io.open(origem, encoding="utf-8"),
              object_pairs_hook=collections.OrderedDict)

d["slug"] = NOVO
d["nome"] = "Ribeirao Preto (proxy footprint)"
d["_nota_variante"] = (
    "VARIANTE DE EXPERIMENTO, nao e cidade de producao. Identica a "
    "ribeirao-preto, exceto que `city_saida` aponta pro city_base (recortado): a geometria "
    "de edificacao passa a ser o FOOTPRINT REAL do Overture (285 mil telhados "
    "medidos por satelite) em vez da casa sintetica assentada no lote (146 mil). "
    "Serve pra medir se o footprint presta como malha de individualizacao -- o "
    "alvo de clique e de colisao -- num mapa cuja aparencia viria de outro lugar "
    "(splat/fotogrametria). Ver Arqueologia das versoes: o projeto trocou o "
    "footprint pela casa gerada entre o v4 e o v7 por razoes de APARENCIA, e "
    "elas deixam de valer quando a aparencia nao vem daqui.")

# O acervo de imovel (plantas_fornecidas/) diz `cidade: "ribeirao-preto"`. Sem isto a
# variante nasce sem a unica unidade real do acervo (mirra-114) e a vitrine fica
# vazia -- justamente o que a variante precisa exercitar: se o footprint presta
# como alvo de clique, o teste e clicar no imovel.
d["plantas_de"] = ORIG

f = d["fontes"]
# <- a troca inteira. Aponta pro city_base RECORTADO, e nao pro city_base cru: o
# recorte de sitio (padrao/sitios.py) nao e aparencia -- e o mapa deixando de afirmar
# que existe uma laje de 446 m onde ha estacionamento. Sem ele o terreno do
# RibeiraoShopping cobre quarteiroes inteiros com torres saindo por dentro. A variante
# continua sendo footprint cru naquilo que ela mede, que e individualizacao.
#   python pipeline/recorta_sitios.py ribeirao-preto-proxy
f["city_saida"] = f["city_base"].replace(".city.json", "-recortado.city.json")
f["html_saida"] = "%s/%s-%s-aberto.html" % (VERSAO, NOVO, VERSAO)
f["html_comprimido"] = "%s/%s-%s.html" % (VERSAO, NOVO, VERSAO)
f["_nota_city_saida"] = (
    "e o city_base (footprint cru do Overture) com o recorte de sitio aplicado por "
    "pipeline/recorta_sitios.py -- NAO passa pela etapa 7, que e o que a variante "
    "existe pra evitar. Regerar com: python pipeline/recorta_sitios.py ribeirao-preto-proxy")

io.open(destino, "w", encoding="utf-8").write(
    json.dumps(d, ensure_ascii=False, indent=2))

print("-> %s" % os.path.relpath(destino, AQUI))
print()
# confere que so mudou o que devia
a = json.load(io.open(origem, encoding="utf-8"))
b = json.load(io.open(destino, encoding="utf-8"))


def achata(o, pre=""):
    if isinstance(o, dict):
        for k, v in o.items():
            yield from achata(v, pre + "/" + k)
    elif isinstance(o, list):
        yield pre, json.dumps(o, ensure_ascii=False)
    else:
        yield pre, o


ca, cb = dict(achata(a)), dict(achata(b))
dif = sorted(k for k in set(ca) | set(cb) if ca.get(k) != cb.get(k))
print("campos que diferem da cidade original (%d):" % len(dif))
for k in dif:
    print("  %-34s %r  ->  %r" % (k, ca.get(k), cb.get(k)))

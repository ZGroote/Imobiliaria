# -*- coding: utf-8 -*-
"""Deriva `ribeirao-preto-proxy-union`: a variante proxy lendo a base DISSOLVIDA.

Mesmo espirito do `_variante_proxy.py`: nao toca em nada, so escreve
`padrao/cidades/ribeirao-preto-proxy-union.json` mudando o minimo -- identidade,
`city_saida` e as saidas de HTML. Todo o resto e copia byte a byte da variante
proxy, senao a comparacao lado a lado nao vale.

Existe pra VER o resultado do `_union_proxy.py`: os numeros dizem que a uniao por
adjacencia colou vizinho (p99 de area foi de 765 para 1.777 m2, uma componente
comeu 102 footprints). Esta pagina e pra conferir isso com o olho, nao pra virar
producao.

  python _variante_union.py
  set CIDADE=ribeirao-preto-proxy-union && python pipeline/montar.py
"""
import collections, io, json, os, sys

sys.stdout.reconfigure(encoding="utf-8")
AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
# A versao tem UM dono (montar.py). Fixar "v13" aqui fazia a variante
# regerada depois de um bump gravar na pasta velha, em silencio.
from pipeline.montar import VERSAO
CID_DIR = os.path.join(AQUI, "padrao", "cidades")

ORIG = "ribeirao-preto-proxy"
NOVO = "ribeirao-preto-proxy-union"

d = json.load(io.open(os.path.join(CID_DIR, ORIG + ".json"), encoding="utf-8"),
              object_pairs_hook=collections.OrderedDict)

d["slug"] = NOVO
d["nome"] = "Ribeirao Preto (proxy dissolvido)"
d["_nota_variante"] = (
    "VARIANTE DE EXPERIMENTO, nao e cidade de producao. Identica a "
    "ribeirao-preto-proxy, exceto que `city_saida` aponta pra base DISSOLVIDA por "
    "_union_proxy.py: footprint que encosta em footprint (<= 0,4 m) virou um corpo so, "
    "284.921 -> 165.906 volumes. Serve pra VER o efeito da fusao. A medicao ja disse "
    "que ela cola vizinho de parede geminada -- 2.200 componentes engoliram 10+ "
    "footprints, a maior comeu 102 -- entao esperar quadra virando bloco macico e o "
    "comportamento previsto, nao um defeito da pagina.")
d["plantas_de"] = "ribeirao-preto"

f = d["fontes"]
f["city_saida"] = "ribeirao-preto/ribeirao-preto-v4-recortado-union.city.json"
f["html_saida"] = "%s/%s-%s-aberto.html" % (VERSAO, NOVO, VERSAO)
f["html_comprimido"] = "%s/%s-%s.html" % (VERSAO, NOVO, VERSAO)
f["_nota_city_saida"] = (
    "saida do `_union_proxy.py` sobre o `-recortado`. Regerar com: python _union_proxy.py")

io.open(os.path.join(CID_DIR, NOVO + ".json"), "w", encoding="utf-8").write(
    json.dumps(d, ensure_ascii=False, indent=2))
print("-> padrao/cidades/%s.json" % NOVO)

a = json.load(io.open(os.path.join(CID_DIR, ORIG + ".json"), encoding="utf-8"))
b = json.load(io.open(os.path.join(CID_DIR, NOVO + ".json"), encoding="utf-8"))


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
print("\ncampos que diferem da variante proxy (%d):" % len(dif))
for k in dif:
    va, vb = repr(ca.get(k))[:70], repr(cb.get(k))[:70]
    print("  %-26s %s\n  %-26s -> %s" % (k, va, "", vb))

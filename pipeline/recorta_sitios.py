# -*- coding: utf-8 -*-
"""Aplica o recorte de SITIO a uma base de cidade JA PRONTA.

    python pipeline/recorta_sitios.py <slug>
    python pipeline/recorta_sitios.py <slug> --entrada a.city.json --saida b.city.json

A regra e a mesma da etapa 7 (`padrao/sitios.py`): poligono atravessado por via publica
nao e edificacao, e e RECORTADO nas massas construidas. O que muda aqui e QUANDO ela
roda -- sobre um `city.json` fechado, e nao no meio da montagem.

**Por que isso existiu.** A ferramenta nasceu para a variante de experimento
`ribeirao-preto-proxy`, que foi removida no #41 (27/09/2026), junto com os scripts que a
geravam. Aquela variante apontava o `city_saida` pro `city_base` de proposito: era o
footprint cru do Overture, e esse era o experimento. So que o recorte de sitio NAO e
aparencia -- e o mapa deixando de afirmar que existe uma laje de 446 m onde ha
estacionamento. Sem ele, o terreno do RibeiraoShopping (107.729 m2 a 7,7 m) cobria
quarteiroes inteiros com torres saindo por dentro. Por isso a variante passou a apontar
pra uma base recortada. A ferramenta continua valendo para qualquer `city.json` ja
fechado que nao tenha passado pela etapa 7.

**O trabalho real nao e o recorte, e o INDICE.** Um sitio vira N massas, e o `b[]` e
indexado por tres estruturas que precisam continuar de acordo:

    bl[]   [cx, cz, raio, inicio, quantidade] por quarteirao -- fatia CONTIGUA de b[]
    bm[]   [indice, nome, endereco] por edificacao nomeada
    fa[]   azimute da frente, um por edificacao (quando existe)

Trocar 1 poligono por 4 empurra tudo que vem depois. Aqui isso e feito por soma de
prefixo sobre a contagem por edificacao antiga -- e a ordem e preservada de proposito,
porque e ela que faz a fatia contigua do `bl` continuar valendo.
"""
import io, json, os, sys

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.abspath(os.path.join(AQUI, ".."))
sys.path.insert(0, RAIZ)
sys.stdout.reconfigure(encoding="utf-8")

from padrao.cidade import carrega
from padrao import vias as _vias
from padrao import sitios as _sitios


def decodifica(b):
    """b[] -> [(cls, h, anel)] com o anel em DECIMETROS."""
    out = []; i = 0; n = len(b)
    while i < n:
        cls, h, npt = b[i], b[i+1], b[i+2]; i += 3
        lx = lz = 0; anel = []
        for _ in range(npt):
            lx += b[i]; lz += b[i+1]; i += 2; anel.append((lx, lz))
        out.append((cls, h, anel))
    return out


def codifica(recs):
    b = []
    for cls, h, anel in recs:
        b.append(cls); b.append(h); b.append(len(anel))
        lx = lz = 0
        for x, z in anel:
            b.append(x - lx); b.append(z - lz); lx = x; lz = z
    return b


def main():
    a = sys.argv[1:]
    if not a or a[0].startswith("--"):
        print(__doc__.strip().splitlines()[2]); return 2
    slug = a[0]
    cid = carrega(slug)
    pega = lambda k, d: (a[a.index(k)+1] if k in a else d)
    entrada = os.path.abspath(pega("--entrada", cid.caminho("city_base")))
    padrao_saida = entrada[:-len(".city.json")] + "-recortado.city.json" \
        if entrada.endswith(".city.json") else entrada + ".recortado"
    saida = os.path.abspath(pega("--saida", padrao_saida))

    city = json.load(io.open(entrada, encoding="utf-8"))
    Q = city["q"]; names = city.get("names", [])
    recs = decodifica(city["b"])
    print("%s: %d edificacoes" % (os.path.relpath(entrada, RAIZ), len(recs)))

    bm = city.get("bm", [])
    namemap = {bm[i]: (bm[i+1], bm[i+2]) for i in range(0, len(bm), 3)}

    def nome_de(oi):
        if oi is None or oi not in namemap: return ""
        ni, _ = namemap[oi]
        return names[ni] if 0 <= ni < len(names) else ""

    # `kept_face` leva o INDICE ANTIGO, e nao None: e por ele que se descobre, do outro
    # lado, quantas massas cada edificacao virou. A funcao so preserva o valor na PRIMEIRA
    # massa (as outras recebem None), e e essa marca que delimita os grupos na volta.
    kept = [(cls, h, anel, i) for i, (cls, h, anel) in enumerate(recs)]
    novos, faces, n_sitio, n_massa = _sitios.separa(
        kept, list(range(len(recs))), _vias.eixos(city, cid), cid, Q, nome_de=nome_de)
    print("sitios recortados %d -> massas %d | edificacoes agora %d"
          % (n_sitio, n_massa, len(novos)))
    if not n_sitio:
        print("nada a recortar; nenhum arquivo escrito."); return 0

    # contagem por edificacao antiga, pela marca em `faces`
    cnt = [0] * len(recs); atual = None
    for f in faces:
        if f is not None: atual = f
        if atual is None: raise SystemExit("faces sem marca inicial -- indice quebrado")
        cnt[atual] += 1
    pref = [0] * (len(recs) + 1)
    for i in range(len(recs)): pref[i+1] = pref[i] + cnt[i]
    assert pref[-1] == len(novos), (pref[-1], len(novos))

    city["b"] = codifica([(c, h, anel) for c, h, anel, _oi in novos])

    bl = city.get("bl", []); novo_bl = []
    for k in range(0, len(bl), 5):
        cx, cz, rad, s, n = bl[k:k+5]
        novo_bl += [cx, cz, rad, pref[s], pref[s+n] - pref[s]]
    city["bl"] = novo_bl

    novo_bm = []
    for i in range(0, len(bm), 3):
        idx = bm[i]
        if cnt[idx] == 0: continue          # sitio que nao rendeu massa nenhuma
        novo_bm += [pref[idx], bm[i+1], bm[i+2]]
    city["bm"] = novo_bm

    fa = city.get("fa")
    if fa is not None:
        city["fa"] = [fa[i] for i in range(len(recs)) for _ in range(cnt[i])]

    io.open(saida, "w", encoding="utf-8").write(json.dumps(city, separators=(",", ":")))
    print("bl %d | bm %d | fa %s | %.1f MB -> %s"
          % (len(city["bl"]) // 5, len(city["bm"]) // 3,
             len(city["fa"]) if city.get("fa") else "-",
             os.path.getsize(saida) / 1e6, os.path.relpath(saida, RAIZ)))
    return 0


if __name__ == "__main__":
    sys.exit(main())

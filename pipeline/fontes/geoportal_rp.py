# -*- coding: utf-8 -*-
"""Geoportal da Prefeitura de Ribeirao Preto -> GeoJSON, pela API REST publica.

A prefeitura publica o cadastro num ArcGIS Enterprise com o diretorio REST ABERTO e
`Query` habilitado. Nao e raspagem: e a API documentada do servidor, com paginacao
(`resultOffset`/`resultRecordCount`) e saida geoJSON nativa.

  https://webgis.ribeiraopreto.sp.gov.br/server/rest/services
  servico: GeoPortal/Geoportal_Cadastro/MapServer

O que cada camada resolve, e por que valem mais que o que o pipeline usa hoje:

  2  Territorial  231.572  o LOTE oficial, com `inscricao` (IPTU), `nome_logradouro`,
                           `numero_lote` e `cep`. Hoje o mapa usa 187.859 lotes
                           SINTETICOS (grade 12x25 caminhando o miolo). Foi a base
                           sintetica que fez 24% dos enderecos do CNEFE nao acharem
                           lote nenhum.
  0  Quadra        11.293  quadra oficial, contra a face do grafo de ruas.
  3  Trecho de     32.800  segmento de rua COM NOME. Das 22.165 vias do `r[]`, 10.575
     Logradouro             estao sem nome -- e a causa dos rotulos faltando no mapa.

PAGINACAO SO E ESTAVEL COM `orderByFields`. Sem ordem declarada o servidor pode
repetir ou pular feicao entre paginas, e o erro e silencioso: o arquivo fecha com o
numero errado e ninguem percebe. Por isso a conferencia de id unico no fim nao e
decoracao -- e o portao.

Saida em EPSG:4326 (lon/lat), que e o que o resto do pipeline le nos .geojson.

  python pipeline/fontes/geoportal_rp.py            # as tres camadas
  python pipeline/fontes/geoportal_rp.py --camada 2
"""
import io, json, os, sys, time
import urllib.parse, urllib.request

RAIZ = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.stdout.reconfigure(encoding="utf-8")

BASE = ("https://webgis.ribeiraopreto.sp.gov.br/server/rest/services/"
        "GeoPortal/Geoportal_Cadastro/MapServer")
PASSO = 5000
CAMADAS = {
    2: ("lotes_oficiais_geoportal.geojson", "Territorial (lote oficial)"),
    0: ("quadras_oficiais_geoportal.geojson", "Quadra"),
    3: ("logradouros_oficiais_geoportal.geojson", "Trecho de Logradouro"),
}
DESTINO = os.path.join(RAIZ, "ribeirao-preto", "fontes")


def pega(url, tentativas=4):
    for k in range(tentativas):
        try:
            with urllib.request.urlopen(url, timeout=180) as r:
                return json.loads(r.read().decode("utf-8"))
        except Exception as e:
            if k == tentativas - 1: raise
            print("    ! %s -- tentando de novo em %ds" % (type(e).__name__, 3 * (k + 1)))
            time.sleep(3 * (k + 1))


def conta(lid):
    q = urllib.parse.urlencode({"where": "1=1", "returnCountOnly": "true", "f": "json"})
    return pega("%s/%d/query?%s" % (BASE, lid, q))["count"]


def baixa(lid):
    nome, rotulo = CAMADAS[lid]
    total = conta(lid)
    print("camada %d - %s: %d feicoes" % (lid, rotulo, total))
    feats, off, t0 = [], 0, time.time()
    while off < total:
        q = urllib.parse.urlencode({
            "where": "1=1", "outFields": "*", "returnGeometry": "true",
            "orderByFields": "id",          # <- sem isto a paginacao nao e estavel
            "resultOffset": off, "resultRecordCount": PASSO,
            "outSR": 4326, "f": "geojson"})
        d = pega("%s/%d/query?%s" % (BASE, lid, q))
        got = d.get("features") or []
        if not got:
            print("    pagina vazia em offset %d -- parando" % off); break
        feats.extend(got); off += len(got)
        print("\r    %d/%d  (%.0fs)" % (len(feats), total, time.time() - t0), end="")
    print()

    ids = [f["properties"].get("id") for f in feats]
    unicos = len(set(ids))
    if unicos != len(feats):
        print("    ! REPROVADO: %d feicoes mas %d ids unicos -- paginacao repetiu"
              % (len(feats), unicos))
        return None
    if len(feats) != total:
        print("    ! aviso: baixadas %d de %d anunciadas" % (len(feats), total))

    os.makedirs(DESTINO, exist_ok=True)
    saida = os.path.join(DESTINO, nome)
    io.open(saida, "w", encoding="utf-8").write(json.dumps(
        {"type": "FeatureCollection",
         "crs": {"type": "name", "properties": {"name": "EPSG:4326"}},
         "features": feats}, ensure_ascii=False))
    print("    -> %s  (%.1f MB, %d feicoes, ids unicos ok)"
          % (os.path.relpath(saida, RAIZ), os.path.getsize(saida) / 1048576, len(feats)))
    return saida


def main():
    alvo = ([int(sys.argv[sys.argv.index("--camada") + 1])]
            if "--camada" in sys.argv else [2, 0, 3])
    for lid in alvo:
        baixa(lid)
        print()
    return 0


if __name__ == "__main__":
    sys.exit(main())

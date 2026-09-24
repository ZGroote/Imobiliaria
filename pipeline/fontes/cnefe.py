# -*- coding: utf-8 -*-
"""CNEFE do IBGE -> `address_points.json`, a segunda prova de ocupacao.

Ate aqui so Sao Carlos tinha ponto de endereco (54.111, do SigaSC). Toda cidade nova
do padrao nascia com UMA prova de ocupacao -- o footprint do Overture -- e por isso
lote onde o satelite nao enxergou telhado ficava vazio: 71.494 de 187.859 em Ribeirao
Preto (38%). O CNEFE fecha esse buraco pro Brasil inteiro.

  Fonte: Cadastro Nacional de Enderecos para Fins Estatisticos, Censo 2022, versao
  georreferenciada (100% dos enderecos com coordenada). GeoJSON por municipio em
  ftp.ibge.gov.br, EPSG:4674 (SIRGAS 2000 geografico).

  NV_GEO_COORD (dicionario oficial -- a ordem NAO e do mais grosso pro mais fino):
    1  endereco, coordenada ORIGINAL coletada no Censo 2022   <- melhor
    2  endereco, coordenada modificada (apartamentos no mesmo numero)
    3  endereco, coordenada estimada
    4  face de quadra
    5  localidade
  O padrao aceita 1-3 (endereco); 4 e 5 sao aproximacao de quadra/bairro e entrariam
  como ocupacao falsa espalhada. Em Ribeirao isso descarta 0,8%; em Sao Carlos, 0,03%.

  python pipeline/fontes/cnefe.py ribeirao-preto 3543402
  python pipeline/fontes/cnefe.py sao-carlos 3548906 --saida-alternativa
"""
import io, json, os, sys, zipfile

from pyproj import Transformer

RAIZ = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, RAIZ)
sys.stdout.reconfigure(encoding="utf-8")
from padrao.cidade import carrega

URL = ("https://ftp.ibge.gov.br/Cadastro_Nacional_de_Enderecos_para_Fins_Estatisticos/"
       "Censo_Demografico_2022/Arquivos_CNEFE/GeoJSON/Municipio_20240910/"
       "qg_810_endereco_Munic%s.json.zip")
NIVEL_OK = (1, 2, 3)      # coordenada de ENDERECO; 4/5 sao quadra/localidade


def main():
    if len(sys.argv) < 3:
        print(__doc__); return 2
    slug, cod = sys.argv[1], sys.argv[2]
    CID = carrega(slug)
    zpath = sys.argv[sys.argv.index("--zip") + 1] if "--zip" in sys.argv else None
    if not zpath:
        # O de Sao Carlos morava em `v7/dados/` e vinha por este segundo candidato;
        # com o dado da cidade reunido em `sao-carlos/`, o primeiro serve as duas.
        cand = os.path.join(RAIZ, "%s/fontes/cnefe_%s.json.zip" % (slug, cod))
        if os.path.exists(cand): zpath = cand
    if not zpath or not os.path.exists(zpath):
        print("zip do CNEFE nao encontrado. Baixe:\n  %s" % (URL % cod)); return 2

    z = zipfile.ZipFile(zpath)
    d = json.loads(z.read(z.namelist()[0]).decode("utf-8"))
    fs = d["features"]
    print("%s: %d enderecos no CNEFE" % (slug, len(fs)))

    # EPSG:4674 (SIRGAS 2000 geografico) -> o CRS metrico da cidade. Sao Carlos usa
    # SAD69 (EPSG:29193) e Ribeirao SIRGAS (31983); o pyproj resolve o datum, entao a
    # conversao tem que sair do 4674 declarado no arquivo, nao de 4326 "de olho".
    fwd = Transformer.from_crs("EPSG:4674", CID.epsg_utm, always_xy=True)
    lons, lats, especies = [], [], []
    fora = 0
    for f in fs:
        nv = f["properties"].get("NV_GEO_COORD")
        if nv not in NIVEL_OK: fora += 1; continue
        c = f["geometry"]["coordinates"]
        lons.append(c[0]); lats.append(c[1]); especies.append(f["properties"].get("COD_ESPECIE"))
    xs, ys = fwd.transform(lons, lats)
    pts = [[round(x, 2), round(y, 2)] for x, y in zip(xs, ys)]
    print("  aceitos (nivel 1-3): %d | descartados (face/localidade): %d" % (len(pts), fora))

    saida = CID.caminho("enderecos")
    os.makedirs(os.path.dirname(saida), exist_ok=True)
    if os.path.exists(saida) and "--forcar" not in sys.argv:
        print("  JA EXISTE: %s" % saida)
        print("  (nao sobrescrevo cadastro proprio da prefeitura; use --forcar ou --saida-alternativa)")
        if "--saida-alternativa" in sys.argv:
            saida = saida.replace(".json", "_cnefe.json")
        else:
            return 1
    io.open(saida, "w", encoding="utf-8").write(json.dumps(pts))
    print("-> %s  (%.1f MB)" % (os.path.relpath(saida, RAIZ), os.path.getsize(saida) / 1048576))
    return 0


if __name__ == "__main__":
    sys.exit(main())

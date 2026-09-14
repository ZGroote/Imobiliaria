# -*- coding: utf-8 -*-
"""Limpeza do acervo: compacta o que fica, arquiva o que ja nao serve.

Duas operacoes separadas, e nenhuma delas apaga dado:

  compactar  reescreve GeoJSON/JSON com coordenada arredondada e sem espaco. A
             base inteira esta gravada com 15-17 digitos por coordenada -- 1e-15
             grau e 0,1 nanometro. O dado de origem e raster vetorizado, ~6%
             inflado (v7/README.md): sete casas (1,1 cm) ja e mais precisao do
             que a fonte tem.

  arquivar   MOVE (nao apaga) versoes anteriores, snapshots e rascunho de QA
             para _arquivo/, com um MANIFESTO.md dizendo o que era cada um e
             como refazer. Antes de mover, confere se algum .py/.js/.md do
             projeto cita o arquivo pelo nome -- se citar, ele fica onde esta.

  python v8/pipeline/limpar_dados.py              # so o relatorio, nao escreve
  python v8/pipeline/limpar_dados.py --compactar
  python v8/pipeline/limpar_dados.py --arquivar
"""
import io, os, sys, json, shutil, datetime

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(os.path.dirname(AQUI))
ARQ = os.path.join(RAIZ, "_arquivo")

CASAS_GEO = 7    # graus: 1,1 cm
CASAS_PROP = 3   # metro / m2: 1 mm

COMPACTAR = [
    "v7/dados/lotes_saocarlos_completo.geojson",
    "v7/dados/lotes_sinteticos_miolo.geojson",
    "v7/dados/lotes_oficiais_saocarlos.geojson",
    "v7/dados/gabarito_ocupacao.geojson",
    "v7/dados/quadras_miolo.geojson",
    "v7/dados/lotes_confiaveis_saocarlos.geojson",
    "v7/dados/address_points.json",
    "quadras_saocarlos.geojson",
    "quadras_estruturas.geojson",
    "lotes_saocarlos.geojson",
    "casas_lote.geojson",
    "bairros_saocarlos_completo.geojson",
    "bairros_centro_saocarlos.geojson",
    "loteamentos_bairros_saocarlos.geojson",
    "loteamentos_saocarlos_oficial.geojson",
    "loteamentos_saocarlos_osm.geojson",
    "pois_saocarlos_osm.geojson",
    "pois_uteis.geojson",
    # overture_buildings.geojson fica de fora de proposito: sao 71 MB que rendem
    # 0,7 MB (ja e quase tudo digito util) e custam minutos de parse por rodada.
]

# (caminho, por que saiu, como voltar)
ARQUIVAR = [
    ("v7/pipeline/_medir.html", "rascunho da sonda de QA", "qa_medir.py refaz"),
    ("v7/pipeline/_qa_qa_telhados.html", "rascunho da sonda de QA", "qa_shot.py refaz"),
    ("v4.zip", "snapshot do v4/", "o diretorio v4/ esta aqui"),
    ("v6.zip", "snapshot do v6/", "o diretorio v6/ esta aqui"),
    ("v7.zip", "snapshot do v7/", "o diretorio v7/ esta aqui"),
    ("v6_backup_20260826_1118", "backup manual do v6", "v6/ esta aqui; make_v6.py refaz"),
    ("v6/walls_tris.json", "muros do v6, retirados a pedido (nao ajudaram)",
     "o v7 usa v7/dados/muros_segs.json: os mesmos muros em segmento, 2,4 MB"),
    ("v5/sao-carlos-v5-preenchido.city.json", "base intermediaria do v5",
     "v5/sao-carlos-v5-lotes.city.json e a que o v6 usa"),
    ("sao-carlos.html", "mapa v1 (grade sintetica)", "historico"),
    ("sao-carlos.city.json", "base do v1", "historico"),
    ("sao-carlos-grade_1.html", "esboco da grade v1", "historico"),
    ("sao-carlos-overture.html", "mapa v2 (1a carga Overture)", "historico"),
    ("sao-carlos-overture.city.json", "base do v2", "convert_overture.py refaz"),
    ("sao-carlos-overture-v2.html", "mapa v2.1", "historico"),
    ("sao-carlos-overture-v2.city.json", "base do v2.1", "merge_osm_overture.py refaz"),
    ("test_load.html", "teste de carga de city.json", "descartavel"),
    ("estruturas_heat.html", "mapa de calor de estruturas",
     "gerado a partir de quadras_estruturas.geojson"),
]


def tamanho(p):
    if os.path.isdir(p):
        return sum(os.path.getsize(os.path.join(r, f))
                   for r, _, fs in os.walk(p) for f in fs)
    return os.path.getsize(p) if os.path.exists(p) else 0


def mb(n):
    return "%8.2f MB" % (n / 1048576.0)


def arredonda(o, casas):
    if isinstance(o, float):
        return round(o, casas)
    if isinstance(o, list):
        return [arredonda(x, casas) for x in o]
    if isinstance(o, dict):
        return {k: arredonda(v, casas) for k, v in o.items()}
    return o


def compacta(caminho, aplicar):
    """(bytes_antes, bytes_depois). Geometria a CASAS_GEO, propriedade a CASAS_PROP."""
    antes = os.path.getsize(caminho)
    d = json.load(io.open(caminho, encoding="utf-8"))
    if isinstance(d, dict) and d.get("type") == "FeatureCollection":
        for ft in d.get("features", []):
            if ft.get("geometry"):
                ft["geometry"] = arredonda(ft["geometry"], CASAS_GEO)
            if ft.get("properties"):
                ft["properties"] = arredonda(ft["properties"], CASAS_PROP)
    else:
        d = arredonda(d, CASAS_GEO)
    txt = json.dumps(d, separators=(",", ":"), ensure_ascii=False)
    depois = len(txt.encode("utf-8"))
    if aplicar:
        tmp = caminho + ".tmp"
        io.open(tmp, "w", encoding="utf-8").write(txt)
        os.replace(tmp, caminho)   # so troca depois de gravar o arquivo inteiro
    return antes, depois


def fontes():
    """Todo .py/.js/.md do projeto -- fora os HTML gerados, que sao gigantes."""
    for r, ds, fs in os.walk(RAIZ):
        ds[:] = [d for d in ds if d not in ("__pycache__", "_arquivo", "plantas_openplots")]
        for f in fs:
            if f.endswith((".py", ".js", ".md")):
                yield os.path.join(r, f)


def main():
    aplicar_c = "--compactar" in sys.argv
    aplicar_a = "--arquivar" in sys.argv
    so_relatorio = not (aplicar_c or aplicar_a)

    print("== compactar (coordenada com %d casas = 1,1 cm) ==" % CASAS_GEO)
    ta = td = 0
    for rel in COMPACTAR:
        p = os.path.join(RAIZ, rel)
        if not os.path.exists(p):
            print("  (ausente) %s" % rel)
            continue
        a, d = compacta(p, aplicar_c)
        ta += a
        td += d
        print("  %s -> %s  %+5.0f%%  %s" % (mb(a), mb(d), (d - a) * 100.0 / a, rel))
    if ta:
        print("  TOTAL %s -> %s   (%s a menos)" % (mb(ta), mb(td), mb(ta - td)))

    print("\n== arquivar (MOVE para _arquivo/) ==")
    textos = [(p, io.open(p, encoding="utf-8", errors="replace").read()) for p in fontes()]
    mover, total = [], 0
    for rel, porque, volta in ARQUIVAR:
        p = os.path.join(RAIZ, rel)
        if not os.path.exists(p):
            print("  (ausente) %s" % rel)
            continue
        nome = os.path.basename(rel)
        # arquivo que comeca com "_" e rascunho de sonda: quem o cita e o script
        # que o CRIA, entao a checagem de citacao nao vale pra ele.
        cita = [] if nome.startswith("_") else [
            c for c, t in textos
            if nome in t and os.path.basename(c) not in ("limpar_dados.py", "MANIFESTO.md")]
        n = tamanho(p)
        if cita:
            print("  MANTIDO %s  %s  (citado em %s)"
                  % (mb(n), rel, ", ".join(sorted({os.path.basename(c) for c in cita})[:3])))
            continue
        total += n
        mover.append((rel, porque, volta, n))
        print("  %s  %s  -- %s" % (mb(n), rel, porque))
    print("  TOTAL a arquivar: %s" % mb(total))

    if aplicar_a and mover:
        os.makedirs(ARQ, exist_ok=True)
        linhas = ["# _arquivo - o que saiu de circulacao", "",
                  "Movido por `v8/pipeline/limpar_dados.py --arquivar` em %s."
                  % datetime.date.today().isoformat(),
                  "Nada foi apagado: e so mover de volta se precisar.", "",
                  "| arquivo | tamanho | por que saiu | como voltar |", "|---|---|---|---|"]
        for rel, porque, volta, n in mover:
            destino = os.path.join(ARQ, rel.replace("/", os.sep))
            os.makedirs(os.path.dirname(destino), exist_ok=True)
            shutil.move(os.path.join(RAIZ, rel), destino)
            linhas.append("| `%s` | %.1f MB | %s | %s |" % (rel, n / 1048576.0, porque, volta))
        io.open(os.path.join(ARQ, "MANIFESTO.md"), "w", encoding="utf-8").write(
            "\n".join(linhas) + "\n")
        print("  -> movidos para %s" % ARQ)

    py = [os.path.join(r, d) for r, ds, _ in os.walk(RAIZ) for d in ds if d == "__pycache__"]
    npy = sum(tamanho(p) for p in py)
    print("\n== __pycache__ ==\n  %s em %d diretorios%s"
          % (mb(npy), len(py), "" if so_relatorio else " (removidos)"))
    if not so_relatorio:
        for p in py:
            shutil.rmtree(p, ignore_errors=True)

    if so_relatorio:
        print("\n(relatorio apenas -- nada foi escrito. Use --compactar e/ou --arquivar.)")


if __name__ == "__main__":
    main()

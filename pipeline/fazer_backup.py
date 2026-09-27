# -*- coding: utf-8 -*-
"""Ponto de backup do projeto do mapa 3D.

Dois pacotes, porque tem dois tipos de coisa que valem backup por motivos diferentes:

  <data>-codigo.zip    o que NAO da pra refazer: renderizador, pipeline, padrao, os
                       .md, os JSON de cidade, os relatorios de QA e as plantas
                       fornecidas (a mirra-114 foi transcrita a mao).
  <data>-<versao>.zip  as paginas montadas, pra poder voltar exatamente ao que esta
                       na pasta hoje sem remontar.

Fica de FORA a fonte bruta (fontes_osm, overture, plantas_openplots, os .geojson
grandes e as versoes antigas v3..v11): sao ~2,7 GB que o pipeline baixa e regenera.
"""
import io, os, sys, time, zipfile, hashlib

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
# Sem `--variante`: a variante vem do `resolve()` (MAPA_V ou o padrao), como nas sondas.
# Um MAPA_V aposentado (o v15) reprova aqui, antes de arquivar pasta velha.
from pipeline.build.config import resolve
VERSAO = resolve().versao

RAIZ = os.path.abspath(".")
DEST = os.path.join(RAIZ, "backups")
DATA = time.strftime("%Y-%m-%d-%H%M")

# (rotulo, [caminhos], extensoes aceitas ou None pra tudo)
CODIGO = [
    # A fonte da unica variante viva. Ate o #49 era `renderizador/` (o v15), e o
    # `os.path.exists` abaixo faria o backup sair SEM renderizador, calado, depois da
    # retirada.
    ("renderizador", [os.path.join("v1.5", "renderizador-v16-moveis")], None),
    ("pipeline",     ["pipeline"], (".py", ".json", ".csv", ".md")),
    # As ETAPAS 1b..7b (city_final, ruas, chao, muros, ocupacao, juntar_lotes,
    # quadras_miolo, quadras_grafo, lotes_sinteticos, portoes) moravam em
    # `v7/pipeline/` e ficaram de fora do backup ate 03/09/2026 -- o nome da pasta
    # fazia ela parecer versao antiga descartavel, e era o codigo VIVO. Hoje estao em
    # `pipeline/`, cobertas pela linha acima, e `v7/` nao existe mais.
    #
    # O dado grande da cidade (`<slug>/dados/`) continua fora de proposito: sao os
    # .geojson que o pipeline regenera, e a regra do cabecalho vale pra eles.
    ("padrao",       ["padrao"], (".py", ".json", ".md")),
    ("arvores",      ["arvores"], (".py", ".json", ".md")),
    ("relatorios",   ["relatorios"], None),
    ("plantas_fornecidas", ["plantas_fornecidas"], None),
]
RAIZ_ARQ = [".md"]                       # PADRAO.md, PIPELINE.md
RAIZ_PY  = True                          # os .py soltos na raiz
PULA_DIR = {"__pycache__", ".git", "node_modules"}

LEIAME = """Ponto de backup do mapa 3D -- {data}

O QUE ESTA AQUI
  {cod}
      Codigo e configuracao. E o que nao da pra refazer:
        v1.5/renderizador-v16-moveis/   os modulos, css, html, three e earcut (fonte da
                        verdade da pagina; o v15 em renderizador/ saiu no #49)
        pipeline/       montar.py, rodar.py, os testes headless, o estado das cidades
        padrao/         cidade.py, qa.py, vias.py, os JSON por cidade
        arvores/        os scripts do Blender e a biblioteca de especies
        relatorios/     o QA que aprovou o build que esta na pasta
        plantas_fornecidas/  plantas de unidade (a mirra-114 foi transcrita a mao)
        PADRAO.md, PIPELINE.md e os .py soltos da raiz

  {pag}
      As paginas montadas da {ver}, do jeito que estao na pasta hoje.

O QUE NAO ESTA (de proposito)
  fontes_osm/, overture_buildings.geojson, plantas_openplots/, os .geojson grandes
  e as versoes antigas (v3..v11, v7/, _arquivo/). Sao ~2,7 GB de fonte bruta e de
  saida derivada: `python pipeline/rodar.py --rede` baixa e regenera.

COMO VOLTAR
  1. Descompactar os dois zips por cima da pasta do projeto.
  2. `CIDADE=<slug> python pipeline/montar.py` remonta a pagina a partir de
     v1.5/renderizador-v16-moveis/ (so precisa das bases da cidade em <slug>/).
  3. `python padrao/rodar_qa.py <slug>` confere que o build bate com o relatorio.

ESTADO NO MOMENTO DO BACKUP
  Variante {ver}, a unica viva desde o #49. O que mudou em cada entrega esta no
  historico do git e em DOCUMENTACAO.md.
"""


def junta(zf, caminho, filtro=None, prefixo=""):
    n = 0
    if os.path.isfile(caminho):
        zf.write(caminho, prefixo or os.path.relpath(caminho, RAIZ))
        return 1
    for base, dirs, arqs in os.walk(caminho):
        dirs[:] = [d for d in dirs if d not in PULA_DIR]
        for a in arqs:
            if filtro and not a.lower().endswith(filtro):
                continue
            f = os.path.join(base, a)
            zf.write(f, os.path.relpath(f, RAIZ))
            n += 1
    return n


def md5(p):
    h = hashlib.md5()
    with open(p, "rb") as f:
        for b in iter(lambda: f.read(1 << 20), b""):
            h.update(b)
    return h.hexdigest()


def main():
    os.makedirs(DEST, exist_ok=True)
    zcod = os.path.join(DEST, DATA + "-codigo.zip")
    zpag = os.path.join(DEST, DATA + "-%s.zip" % VERSAO)

    print("codigo -> %s" % os.path.relpath(zcod, RAIZ))
    total = 0
    with zipfile.ZipFile(zcod, "w", zipfile.ZIP_DEFLATED, compresslevel=6) as zf:
        for rot, cams, filtro in CODIGO:
            n = 0
            for c in cams:
                if os.path.exists(c):
                    n += junta(zf, c, filtro)
            print("  %-22s %5d arquivo(s)" % (rot, n))
            total += n
        n = 0
        for a in sorted(os.listdir(RAIZ)):
            if not os.path.isfile(a):
                continue
            if a.endswith(".md") or a.endswith(".py"):
                zf.write(a, a)
                n += 1
        print("  %-22s %5d arquivo(s)" % ("raiz (.md/.py)", n))
        total += n
        zf.writestr("LEIAME-BACKUP.txt", LEIAME.format(
            ver=VERSAO, data=DATA, cod=os.path.basename(zcod), pag=os.path.basename(zpag)))

    print("pagina -> %s" % os.path.relpath(zpag, RAIZ))
    with zipfile.ZipFile(zpag, "w", zipfile.ZIP_DEFLATED, compresslevel=6) as zf:
        n = junta(zf, VERSAO)
        print("  %-22s %5d arquivo(s)" % (VERSAO, n))
        zf.writestr("LEIAME-BACKUP.txt", LEIAME.format(
            ver=VERSAO, data=DATA, cod=os.path.basename(zcod), pag=os.path.basename(zpag)))

    print("")
    for z in (zcod, zpag):
        with zipfile.ZipFile(z) as zf:
            ruim = zf.testzip()          # le e confere o CRC de cada entrada
        print("  %-34s %7.1f MB  %d entradas  CRC %s  md5 %s"
              % (os.path.basename(z), os.path.getsize(z) / 1e6,
                 len(zipfile.ZipFile(z).namelist()),
                 "ok" if ruim is None else "FALHOU em " + ruim, md5(z)[:12]))
    return 0


if __name__ == "__main__":
    sys.exit(main())

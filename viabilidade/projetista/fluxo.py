"""Fluxo de ponta a ponta: gerador → torre → avaliação → cargas → pacote.

    python viabilidade/projetista/fluxo.py <piloto> <pasta> [--terreo] [--sondagem arq] [--escopo a,b]

Grava `revisao-01.json` (o pavimento), `revisao-02.json` (a torre) e `avaliacao-02`, `cargas-02` e `pacote-02` da
torre. Tudo é calculado antes de gravar; se uma etapa falha, diz qual e não deixa arquivo novo na pasta.
Sem relógio: duas rodadas dão os mesmos bytes. Com `--sondagem`, a avaliação cita o cadastro e o pacote confere.
"""
import argparse
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(RAIZ))
from viabilidade.projetista.adaptador import estudo_para_site
from viabilidade.projetista.cargas import estimar, selar_cargas
from viabilidade.projetista.esquema import gravar, selar, serializar
from viabilidade.projetista.gerador import PADROES, gerar_pavimento
from viabilidade.projetista.pacote import montar, selar_pacote
from viabilidade.projetista.sintese import ESCOPO_PADRAO, avaliar, normalizar_escopo, selar_avaliacao
from viabilidade.projetista.sondagem import ler_sondagem, referencia
from viabilidade.projetista.torre import compor


class EtapaFalhou(Exception):
    def __init__(self, etapa, motivo):
        super().__init__(f"falhou na etapa {etapa}: {motivo}")
        self.etapa = etapa


def _etapa(nome, fn, *a, **kw):
    try:
        return fn(*a, **kw)
    except EtapaFalhou:
        raise
    except Exception as erro:  # qualquer erro vira "etapa X falhou", com o texto do erro
        raise EtapaFalhou(nome, " ".join(str(x) for x in getattr(erro, "args", ())) or type(erro).__name__) from erro


def _gerar(piloto):
    estudo, site, regras = estudo_para_site(piloto)
    r = gerar_pavimento(site, regras, {"unidades": PADROES["unidades"]}, None, estudo)
    if r["outcome"] != "gerado":
        raise ValueError(f"{r['outcome']}: {r.get('prova') or r.get('motivo') or 'sem candidatas'}")
    return r["revisoes"][0]


def rodar(piloto, terreo=False, sondagem=None, escopo=ESCOPO_PADRAO):
    """{nome do arquivo: (dado, selador)}, sem gravar nada."""
    escopo = _etapa("escopo", normalizar_escopo, escopo)
    cad = _etapa("sondagem", ler_sondagem, sondagem) if sondagem else None
    pav = _etapa("gerador", _gerar, piloto)
    torre = _etapa("torre", compor, pav, terreo=terreo)
    evid = {"sondagem": referencia(cad)} if cad else {}
    av = _etapa("avaliação", avaliar, torre, escopo, evid, cad)
    cargas = _etapa("cargas", estimar, torre)
    pacote = _etapa("pacote", montar, torre, av, cad, cargas)
    return {"revisao-01.json": (pav, selar), "revisao-02.json": (torre, selar),
            "avaliacao-02.json": (av, selar_avaliacao), "cargas-02.json": (cargas, selar_cargas),
            "pacote-02.json": (pacote, selar_pacote)}


def gravar_tudo(pasta, arquivos):
    """Grava tudo ou nada: confere conflito antes; se algo falha no meio, apaga o que esta rodada criou."""
    for nome, (dado, selador) in arquivos.items():
        if (pasta / nome).exists() and (pasta / nome).read_bytes() != serializar(selador(dado)):
            raise EtapaFalhou("gravação", f"{nome} já existe com outro conteúdo em {pasta}")
    novos = [pasta / n for n in arquivos if not (pasta / n).exists()]
    pasta.mkdir(parents=True, exist_ok=True)
    try:
        return {n: gravar(pasta / n, d, selador=s) for n, (d, s) in arquivos.items()}
    except Exception as erro:
        for p in novos:
            p.unlink(missing_ok=True)
        raise EtapaFalhou("gravação", str(erro)) from erro


def main(argv=None):
    ap = argparse.ArgumentParser(description="Roda gerador, torre, avaliação, cargas e pacote em sequência.")
    ap.add_argument("piloto", type=Path)
    ap.add_argument("pasta", type=Path)
    ap.add_argument("--terreo", action="store_true")
    ap.add_argument("--sondagem", type=Path)
    ap.add_argument("--escopo", default=",".join(ESCOPO_PADRAO), help="domínios, separados por vírgula (padrão: %(default)s)")
    a = ap.parse_args(argv)
    try:
        feitos = gravar_tudo(a.pasta, rodar(a.piloto, a.terreo, a.sondagem, [d.strip() for d in a.escopo.split(",")]))
    except EtapaFalhou as erro:
        print(erro, file=sys.stderr)
        return 1
    print(f"gravados em {a.pasta}: {', '.join(feitos)}")
    print("pacote da torre: " + ", ".join(f"{k} {v['estado']}" + (f" ({v['motivo']})" if v["motivo"] else "")
                                          for k, v in feitos["pacote-02.json"]["pecas"].items()))
    return 0


if __name__ == "__main__":
    sys.exit(main())

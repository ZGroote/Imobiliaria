# -*- coding: utf-8 -*-
"""Roda os portoes de qualidade de uma cidade.

  python padrao/rodar_qa.py                 # sao-carlos, geometria + comportamento
  python padrao/rodar_qa.py <slug>
  python padrao/rodar_qa.py <slug> --rapido # so a geometria (nao precisa de Chrome)
  python padrao/rodar_qa.py --todas         # todas as cidades de padrao/cidades/

Sai com codigo 1 se algum portao reprovar. Grava `relatorios/qa_<slug>.json` com os
numeros e a data - e esse arquivo, nao a memoria de quem olhou, que diz se o build que
esta na pasta passou.

Sao DUAS familias de portao, e a distincao importa na hora de ler o relatorio:

  geometria      abre arquivo e mede poligono (muro sobre a rua, lote fora do eixo,
                 arvore no asfalto). Segundos, sem dependencia externa.
  comportamento  abre a PAGINA num Chrome headless e mexe nela: e a unica forma de
                 provar o que o v11..v13 acrescentou, que e interface e nao coordenada
                 (ficha, "o que tem por perto", quadro preguicoso, governador, remendo
                 de arvore, custo do minimapa). ~3 min por cidade.

`--rapido` existe pro ciclo curto de quem esta mexendo em geometria. Ele NAO e o
aceite: relatorio com comportamento nao medido nao autoriza publicar.
"""
import io, json, os, sys, time

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(AQUI))

from padrao.cidade import carrega, lista, RAIZ
from padrao import qa


def formata(p):
    if isinstance(p.valor, bool):
        return ("sim" if p.valor else "NAO"), "sim"
    if p.valor is None:
        return "-", "-"
    med = ("%.2f %s" % (p.valor, p.unidade) if isinstance(p.valor, float)
           else "%s %s" % (p.valor, p.unidade))
    lim = ("-" if p.limite is None else
           ("%.2f" % p.limite if isinstance(p.limite, float) else str(p.limite)))
    return med, lim


def uma_cidade(slug, comportamento=True):
    from pipeline.build.config import resolve
    cid = resolve(slug).cidade_para_qa()
    t0 = time.time()
    print("QA de %s (%s)%s" % (cid.nome, slug, "" if comportamento else "  [--rapido: so geometria]"))
    portoes = qa.roda(cid, comportamento=comportamento)
    print("")
    reprovou = 0
    familia_atual = None
    for p in portoes:
        fam = getattr(p, "familia", "geometria")
        if fam != familia_atual:
            familia_atual = fam
            print("  -- %s %s" % (fam, "-" * (66 - len(fam))))
            print("  %-42s %12s %10s  %s" % ("portao", "medido", "limite", ""))
        med, lim = formata(p)
        marca = "  " if p.passou is None else ("ok" if p.passou else "XX")
        if p.passou is False: reprovou += 1
        print("  %s %-40s %12s %10s  %s" % (marca, p.nome, med, lim, p.detalhe))
    nao_medidos = [p.nome for p in portoes if p.passou is None]
    print("")
    print("%d portao(oes) reprovado(s) | %d nao medido(s) | %.0fs"
          % (reprovou, len(nao_medidos), time.time() - t0))
    if nao_medidos:
        print("  nao medido: %s" % ", ".join(nao_medidos))

    rel = os.path.join(RAIZ, "relatorios")
    os.makedirs(rel, exist_ok=True)
    saida = os.path.join(rel, "qa_%s.json" % slug)
    io.open(saida, "w", encoding="utf-8").write(json.dumps({
        "cidade": slug, "quando": time.strftime("%Y-%m-%d %H:%M"),
        # A versao que estava na pasta quando isto rodou. Sem ela o relatorio nao diz
        # QUAL pagina passou -- e foi print de arquivo velho lido como novo que ja
        # custou uma rodada inteira de conversa.
        "versao": _versao(),
        "comportamento_medido": comportamento,
        "reprovados": reprovou,
        "nao_medidos": nao_medidos,
        "portoes": [{"nome": p.nome, "familia": getattr(p, "familia", "geometria"),
                     "valor": p.valor, "limite": p.limite,
                     "passou": p.passou, "detalhe": p.detalhe} for p in portoes],
    }, ensure_ascii=False, indent=1))
    print("-> relatorios/qa_%s.json" % slug)
    return reprovou


def _versao():
    from pipeline.build.config import resolve
    return resolve().versao


def main():
    a = sys.argv[1:]
    if '--variante' in a:
        i = a.index('--variante')
        if i + 1 == len(a):
            raise SystemExit('--variante precisa de um valor')
        from pipeline.build.config import resolve
        os.environ['MAPA_V'] = resolve(versao=a[i + 1]).versao
        a = a[:i] + a[i + 2:]
    if any(x in a for x in ("-h", "--help")):
        print(__doc__); print("cidades:", ", ".join(lista())); return 0
    rapido = "--rapido" in a
    slugs = [x for x in a if not x.startswith("-")]
    if "--todas" in a: slugs = lista()
    if not slugs: slugs = ["sao-carlos"]
    ruim = 0
    for i, slug in enumerate(slugs):
        if i: print("\n" + "=" * 78 + "\n")
        ruim += uma_cidade(slug, comportamento=not rapido)
    if len(slugs) > 1:
        print("\n%d portao(oes) reprovado(s) em %d cidade(s)." % (ruim, len(slugs)))
    return 1 if ruim else 0


if __name__ == "__main__":
    sys.exit(main())

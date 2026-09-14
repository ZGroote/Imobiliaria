# -*- coding: utf-8 -*-
"""Os portoes de COMPORTAMENTO: o que so se prova abrindo a pagina e mexendo nela.

Ate aqui `padrao/qa.py` media GEOMETRIA (muro sobre a rua, lote fora do eixo, arvore
no asfalto). Tudo que o v11..v13 acrescentou e de outra natureza: nao ha numero de
geometria que diga se o clique na vitrine abre a ficha, se o pino nasce apagado, se o
minimapa vira planta dentro da casa ou se o remendo de arvore bate com a reconstrucao
completa. Isso so se prova mexendo na pagina pronta.

Essas provas ja existiam -- como nove scripts soltos em `pipeline/testa_*.py`, rodados
a mao pelo autor da mudanca, na cidade que ele tinha aberto. Que e o mesmo defeito que
o PADRAO.md existe pra matar, so que na forma "o aceite esta escrito em mais de um
lugar": `padrao/rodar_qa.py` dizia aprovado com nove medidas de 29/08 enquanto o mapa
que sai hoje e o v13. Cidade nova recebia carimbo sem que nada tivesse conferido que
ela tem o comportamento do v13.

Aqui cada script vira um portao, com a MESMA regra dos outros: mede, compara com um
limite (zero reprova) e o build nao sai se falhar.

**Roda como subprocesso, nao como import.** Cada sonda sobe um Chrome headless com
perfil temporario proprio, escreve HTML de trabalho e imprime a propria tabela. Chamar
`main()` por import obrigaria a mexer em `sys.argv` global, misturaria o stdout das
nove tabelas na do QA e faria uma sonda que trava derrubar o relatorio inteiro. Como
processo, cada uma tem prazo (`PRAZO_S`) e o codigo de saida ja e o veredito -- que e
o contrato que esses scripts sempre tiveram.

**A ordem nao e cosmetica: e do mais fundamental pro mais fino.** Se a pagina nem abre
em file://, saber que o minimapa custa 0,03 ms nao ajuda; a primeira linha da tabela e
a que diz o que investigar.
"""
import os, subprocess, sys, time

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(AQUI)

# `qa` importa este modulo DENTRO de `roda()`, nao no topo -- senao os dois se importam
# em circulo e `Portao` ainda nao existe quando esta linha corre.
from padrao.qa import Portao

PRAZO_S = 600      # sonda que passa disso esta travada, nao lenta: a mais cara
                   # (terreno de fundo) leva ~60 s por cidade nesta maquina.

# nome do portao, script, desde que versao, o que ele prova
SONDAS = [
    ("abre em file:// (duplo clique)", "pipeline/testa_duplo_clique.py", "v6",
     "a pagina comprimida sobe sem servidor e a vitrine leva pra dentro da casa"),
    ("terreno de fundo sem buraco", "pipeline/testa_terreno_base.py", "v11",
     "o chao existe onde nao ha quadra, e nao espeta por cima dela"),
    ("quadro preguicoso", "pipeline/testa_quadro_preguicoso.py", "v11",
     "rotulo e sombra so refazem quando algo muda, nos dois niveis de grafico"),
    ("governador de grafico", "pipeline/testa_governador.py", "v11",
     "baixar e subir a resolucao chega no canvas de verdade"),
    ("arvore remendada", "pipeline/testa_arvore_incremental.py", "v11",
     "o remendo por raio da o MESMO conjunto que a reconstrucao completa"),
    ("UX: busca, link, noite, minimapa", "pipeline/testa_v12_ux.py", "v12",
     "o que a barra de cima promete continua funcionando"),
    ("ficha e 'o que tem por perto'", "pipeline/testa_ficha_e_perto.py", "v13",
     "o clique na vitrine para na ficha e o pino nasce apagado"),
    ("custo do minimapa", "pipeline/mede_minimapa.py", "v13",
     "rua, rua+POI e planta cabem no orcamento de quadro"),
    ("exposicao do interior", "pipeline/mede_interior.py", "v13",
     "a cena de dentro nao sai estourada nem chapada (so cidade com planta)"),
]


def tem_interior(cid):
    """A cidade tem alguma unidade que a vitrine consiga ABRIR?

    Tres condicoes, e as duas primeiras versoes deste teste erraram por adivinhar quais
    eram as outras:

      `cidade == slug`   planta com `cidade: null` (o `_exemplo`) viaja pra TODA cidade
                         como gabarito de formato -- e por isso mesmo nao e de nenhuma.
                         `plantas_de` entra junto: a variante de experimento tem slug
                         proprio e herda o acervo da cidade de origem.
      lote/ancora/predio  e o que pendura a unidade na cena. Sem isso nao ha item de
                         vitrine com `data-unidade`, e nao ha o que clicar. `lote` e a
                         terceira forma e chegou por ultimo: o LANCAMENTO nao tem volume
                         na base, e esquecer de listar aqui foi o que fez este portao
                         sair "nao medido" na hora em que o lote entrou -- de novo.
      planta.comodos     04/09/2026: entraram quatro LANCAMENTOS de Sao Carlos com
                         `lote` e SEM planta -- o pedido era por o predio no mapa, nao
                         o apartamento. Sem `comodos` o renderizador nao lista a unidade
                         na vitrine nem a devolve em `unidadeDoPredio` (ele testa
                         `planta.comodos.length` nos DOIS lugares), entao nao ha o que
                         abrir. Sem esta terceira condicao o portao passaria a rodar em
                         Sao Carlos medindo uma cena de interior que nao existe. A regra
                         geral continua a mesma: a condicao daqui tem que ser a MESMA que
                         o renderizador usa pra montar o item de vitrine.

    `predio_id` sozinho nao serve de teste: o mirra-114, a UNICA unidade de verdade do
    acervo, tem `predio_id: null` e se prende pela `ancora`. Com o teste errado o portao
    do interior saiu "nao medido" exatamente na unica cidade onde havia interior --
    passou por nao ter sido olhado, que e o modo de falhar que este arquivo existe pra
    evitar."""
    import io, json
    base = os.path.join(RAIZ, "plantas_fornecidas")
    if not os.path.isdir(base): return False
    for nome in sorted(os.listdir(base)):
        p = os.path.join(base, nome, "unidade.json")
        if not os.path.exists(p): continue
        try: u = json.load(io.open(p, encoding="utf-8"))
        except ValueError: continue
        if (u.get("cidade") in (cid.slug, cid.plantas_de)
                and (u.get("lote") or u.get("ancora") or u.get("predio_id"))
                and ((u.get("planta") or {}).get("comodos"))):
            return True
    return False


# Aviso de biblioteca no stderr nao e veredito. Sem este filtro o portao do interior
# resumia como "px = list(im.getdata())" -- a ultima linha da saida era o rastro de um
# DeprecationWarning do Pillow, e o relatorio deixava de dizer o que foi medido.
_RUIDO = ("Warning:", "warnings.warn", "DeprecationWarning", "FutureWarning")


def _resumo(saida):
    """A ultima linha util da tabela da sonda -- que e onde todas elas poem o veredito."""
    # Cortar por indentacao ("linha citada por aviso") foi tentado e e pior que o mal:
    # `testa_terreno_base` poe o veredito numa linha INDENTADA de tabela, e o resumo
    # sumia. O que separa ruido de veredito e o canal, nao a forma -- ver `uma()`.
    linhas = [l.strip() for l in (saida or "").splitlines()
              if l.strip() and not any(r in l for r in _RUIDO)]
    if not linhas: return ""
    # A linha de falha diz mais que o total; prefere a primeira marcada com XX/FALHOU.
    for l in linhas:
        if l.startswith(("XX", "FALHOU", "FORA")) or " XX " in l or " FORA" in l:
            return l[:160]
    return linhas[-1][:160]


def uma(cid, nome, script, desde, oque, prazo=PRAZO_S):
    caminho = os.path.join(RAIZ, script.replace("/", os.sep))
    if not os.path.exists(caminho):
        return Portao(nome, 1, 0, "reprovas", detalhe="script sumiu: %s" % script,
                      familia="comportamento")
    t0 = time.time()
    try:
        r = subprocess.run([sys.executable, caminho, cid.slug], cwd=RAIZ,
                           capture_output=True, text=True, encoding="utf-8",
                           errors="replace", timeout=prazo)
    except subprocess.TimeoutExpired:
        return Portao(nome, 1, 0, "reprovas", familia="comportamento",
                      detalhe="%s: travou (mais de %d s)" % (desde, prazo))
    dt = time.time() - t0
    # O veredito sai no STDOUT dessas sondas; o stderr e onde caem os avisos de
    # biblioteca e o log do Chrome. Misturar os dois fazia o resumo virar ruido.
    saida = (r.stdout or "") + (r.stderr or "")
    veredito = _resumo(r.stdout) or _resumo(r.stderr)
    # Codigo 2 e a convencao dessas sondas pra "nao deu pra medir" (sem Chrome, sem
    # pasta da versao). Isso nao e reprova -- e ausencia de medida, e o portao do muro
    # ja trata assim: limite None faz o relatorio imprimir em branco em vez de "ok".
    if r.returncode == 2 or "Chrome nao encontrado" in saida:
        return Portao(nome, None, None, familia="comportamento",
                      detalhe="%s: nao medido (%s)"
                      % (desde, "sem Chrome" if "Chrome nao" in saida else _resumo(saida)))
    return Portao(nome, 0 if r.returncode == 0 else 1, 0, "reprovas",
                  familia="comportamento",
                  detalhe="%s | %.0fs | %s" % (desde, dt, veredito))


def roda(cid, prazo=PRAZO_S):
    """Um portao por sonda, na ordem da tabela. Pula o interior onde nao ha planta."""
    from padrao import pagina
    if not pagina.disponivel():
        return [Portao(n, None, None, familia="comportamento",
                       detalhe="%s: sem Chrome, nao medido" % d)
                for n, _s, d, _o in SONDAS]
    tem_int = tem_interior(cid)
    out = []
    for nome, script, desde, oque in SONDAS:
        if script.endswith("mede_interior.py") and not tem_int:
            out.append(Portao(nome, None, None, familia="comportamento",
                              detalhe="%s: %s nao tem planta fornecida com predio"
                                      % (desde, cid.slug)))
            continue
        out.append(uma(cid, nome, script, desde, oque, prazo))
    return out

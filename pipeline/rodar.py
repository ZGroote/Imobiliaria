# -*- coding: utf-8 -*-
"""O pipeline inteiro, do arquivo baixado ao HTML, numa ordem so.

    python pipeline/rodar.py --listar          # a tabela e o que esta velho
    python pipeline/rodar.py                   # roda o que esta velho (SEM rede)
    python pipeline/rodar.py --de 2 --ate 9    # so um trecho
    python pipeline/rodar.py --rede            # inclui as etapas que baixam
    python pipeline/rodar.py --forcar          # ignora o "ja esta fresco"

Regras, e o motivo de cada uma:

**As etapas de rede sao opt-in.** Baixar Overture, Overpass, SigaSC e open-elevation
leva horas e depende de servidor de terceiro. Elas so rodam com `--rede`, e cada uma
e retomavel (pula o tile/arquivo que ja existe).

**Fresco = toda saida existe e e mais nova que toda entrada -- e, se nao for, o
CONTEUDO da entrada mudou mesmo.** So mtime dava falso positivo caro: regerar um
artefato identico (o `blocks.json` sai byte a byte igual quando so o caminho de
entrada muda) marcava metade do pipeline como velha e custava uma hora a toa. Entao
mtime velho manda conferir sha1 contra `_estado.json`, com cache em `_hashes.json`
chaveado por (caminho, tamanho, mtime) -- hash de 75 MB roda uma vez, nao a cada
verificacao. Onde nem isso basta, a propria etapa confere: o `make_*` falha alto se a
ancora de texto sumir, e o `rodar_qa` reprova por medida, nao por data.

**Para na primeira que falhar.** Etapa que quebra e etapa seguinte lendo lixo:
foi assim que o `build_v7_city` leu a lista velha de quadras e descartou 11 mil casas
sem ninguem notar.

**A ordem tem duas travas que ja morderam** (estao na coluna `nota`):
  * a etapa 5 guarda INDICES do arquivo da 4 -- mexeu na 4, roda a 5;
  * a 7b (chao/rua) le a MESMA lista de quadras da 2 -- se ficar pra tras, o asfalto
    passa por cima das casas e o bairro novo fica sem chao.
"""
import os, subprocess, sys, time

# Sem isto o log fica ilegivel: o stdout do runner fica com buffer de BLOCO quando
# redirecionado pra arquivo, enquanto cada etapa filha escreve direto no descritor --
# a saida da etapa aparece dezenas de linhas ANTES do proprio cabecalho dela.
try: sys.stdout.reconfigure(line_buffering=True)
except Exception: pass

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.abspath(os.path.join(AQUI, "..")) + os.sep
sys.path.insert(0, RAIZ)
from padrao.cidade import carrega
from pipeline.build.config import resolve
from pipeline.build.manifest import entradas as entradas_build, assinatura

CONFIG = resolve()
CID = CONFIG.cidade()
PY = sys.executable


def F(chave):
    """Caminho de uma fonte declarada no JSON da cidade."""
    if chave in ('html_saida', 'html_comprimido'):
        return str(CONFIG.saida(chave, CID))
    return CID.caminho(chave)


def R(rel):
    return os.path.join(RAIZ, rel.replace("/", os.sep))


def O(caminho):
    """Entrada OPCIONAL: a etapa roda sem ela.

    A distincao nao e cosmetica. Cidade sem cadastro de quadra, sem planta oficial e
    sem ponto de endereco e o caso COMUM -- Sao Carlos e que e a excecao. Tratar tudo
    como obrigatorio faz a etapa 1b (que existe exatamente pra rodar sem cadastro) ser
    pulada, e o resto do pipeline cai junto. Tratar tudo como opcional faz a etapa 0d
    processar a planta da cidade errada. Entao cada entrada diz o que e."""
    return ("?", caminho)


def _req(ent):  return [p for p in ent if not isinstance(p, tuple)]
def _todas(ent): return [p[1] if isinstance(p, tuple) else p for p in ent]


# id, titulo, script(+args), entradas, saidas, rede?, nota
ETAPAS = [
    ("0.1", "Overture: footprints",
     ["pipeline/fontes/overture.py"], [], [F("overture_bruto")], True,
     "telhado por satelite, nao cadastro: casa+garagem+edicula viram 3 poligonos"),
    ("0.2", "Overpass: ruas + base",
     ["rebuild_city.py"], [F("overture_bruto")], [F("city_bruto")], True,
     "a malha viaria r[] nasce aqui e nao muda mais em nenhuma versao"),
    ("0.3", "Overpass: tags de predio",
     ["fetch_osm_buildings.py"], [], [F("osm_predios")], True,
     "so ~4,5k dos 126k casam; e daqui que vem nome e building:levels"),
    ("0.4", "Overpass: POIs",
     ["fetch_osm_pois.py"], [], [F("osm_pois")], True, ""),
    ("0.5", "SigaSC: quadras",
     ["pipeline/fontes/sigasc_quadras.py"], [], [F("quadras")], True,
     "NAO cobre a cidade toda; quem completa e a 1b"),
    ("0.6", "SigaSC: loteamentos",
     ["pipeline/fontes/sigasc_parcelamentos.py"], [], [F("loteamentos")], True,
     "so pra nomear; nao entra em etapa obrigatoria"),
    ("0.7", "SigaSC: pontos de endereco",
     ["pipeline/fontes/sigasc_enderecos.py"], [F("quadras")], [F("enderecos")], True,
     "a prova de ocupacao da etapa 5"),
    ("0.8", "open-elevation: relevo",
     ["pipeline/fontes/relevo.py"], [], [F("relevo")], True,
     "+-9,5 km: a grade de +-5,5 km deixava a periferia fora e o chao saltava"),
    ("0.10", "Sentinel-2: densidade de vegetacao (NDVI)",
     ["pipeline/fontes/vegetacao.py"], [], [F("vegetacao")], True,
     "substitui o 'e parque ou nao e' do OSM por um numero continuo; ~2 min por cidade"),
    ("0.9", "OpenPlots: plantas",
     ["baixar_openplots.py"], [], [F("plantas")], True, "retomavel"),

    ("0a", "Cruza OSM x Overture",
     ["merge_osm_overture.py"], [F("city_bruto"), F("osm_predios")],
     [F("city_v2")], False,
     "aqui o predio ganha classe (0/1 residencial, 2 comercio, 3 civico) e nome"),
    ("0b", "Faces do grafo de ruas",
     ["build_blocks.py"], [F("city_v2")], [F("faces_ruas")], False,
     "4.457 faces; e a fonte de quadra da 1b onde o cadastro nao tem"),
    ("0c", "city_base (agrupado por quadra)",
     ["v4/build_city_v4.py"], [F("city_v2"), F("faces_ruas")], [F("city_base")], False,
     "reordena b[] por quadra e emite bl[]; e o que o streaming le"),
    ("0d", "Plantas -> lotes oficiais",
     ["v7/pipeline/rodar_tudo.py", "v7/pipeline/relatorio.py"], [F("plantas")],
     [F("relatorio_plantas")], False,
     "vetoriza+georreferencia planta a planta; ~1 subprocesso por planta. "
     "quem escreve o CSV e o relatorio.py -- sem ele a etapa nunca fica fresca"),
    ("0e", "Consolida e filtra lote de planta",
     ["v7/pipeline/consolidar.py", "v7/pipeline/auditoria_tamanhos.py",
      "v7/pipeline/filtrar_confiaveis.py"],
     [F("relatorio_plantas")],
     [F("lotes_oficiais"), F("lotes_planta")], False,
     "a planta e o gabarito: lote fora do tamanho padrao dela e erro de extracao. "
     "o `padrao_lote` que o filtro le e escrito pela auditoria_tamanhos -- sem ela "
     "o filtro devolve ZERO lote confiavel, sem erro nenhum"),

    ("0f", "POIs da pagina",
     ["pipeline/fontes/pois.py"], [F("osm_pois")], [F("pois")], False,
     "converte as tags do OSM na lista que o renderizador desenha (nao entra supermercado: o build_pois ja traz)"),

    ("1b", "Quadra do grafo onde falta cadastro",
     ["v7/pipeline/quadras_grafo.py"], [O(F("quadras")), F("faces_ruas"), F("city_base")],
     [F("quadras_completo")], False,
     "so face com prova de urbanizacao (>=5 predios e >=3/ha)"),
    ("2", "Miolo (quadra menos a fita da rua)",
     ["v7/pipeline/quadras_miolo.py"], [F("quadras_completo"), F("city_base")],
     [F("miolo")], False,
     "corta pela fita que o renderizador DESENHA, nao por recuo fixo"),
    ("3", "Grade de lote sintetico",
     ["v7/pipeline/lotes_sinteticos.py"], [F("miolo")], [F("lotes_sinteticos")], False, ""),
    ("4", "Junta planta + sintetico",
     ["v7/pipeline/juntar_lotes.py"], [O(F("lotes_planta")), F("lotes_sinteticos"), F("miolo")],
     [F("lotes")], False,
     "exame por quadra: >15 graus de desalinho ou >20% fora do miolo -> refaz a fileira"),
    ("5", "Prova de ocupacao",
     ["v7/pipeline/ocupacao.py"], [F("lotes"), O(F("enderecos")), F("city_base")],
     [F("lotes_ocupados")], False,
     "GUARDA INDICES da etapa 4: refez a 4, TEM que refazer a 5"),
    ("6", "Muros de divisa",
     ["v7/pipeline/gen_muros.py"], [F("lotes"), F("lotes_ocupados")], [F("muros")], False, ""),
    ("6b", "Portao de cada lote com casa",
     ["v7/pipeline/gen_portoes.py"], [F("lotes"), F("lotes_ocupados"), F("city_saida")],
     [F("portoes")], False,
     "a frente sai da malha viaria: o nx/ny do lote so existe em lote sintetico"),
    ("7", "city.json final",
     ["v7/pipeline/build_v7_city.py"],
     [F("city_base"), F("lotes"), F("lotes_ocupados"), F("quadras_completo"), F("miolo")],
     [F("city_saida")], False,
     "le quadras_completo -- com o cadastro puro aqui, 11 mil casas somem no dedup"),
    ("7b", "Chao e asfalto",
     ["v7/pipeline/gen_chao.py", "v7/pipeline/gen_ruas.py"],
     [F("quadras_completo"), F("city_base")], [F("chao_tris"), F("rua_tris")], False,
     "MESMA lista de quadras da 2, senao o asfalto cobre a casa nova"),
    ("8", "HTML (monta das pecas)",
     ["pipeline/montar.py"],
     [F("city_saida")] + [O(str(p)) for p in entradas_build(CONFIG)],
     [F("html_saida"), F("html_comprimido")], False,
     "concatena renderizador/ + os blocos de dado; make_v4..v8 viraram historico. "
     "a biblioteca de arvores entra aqui: mexeu nela, a pagina esta velha"),
    ("9", "Portoes de QA (geometria + comportamento)",
     ["padrao/rodar_qa.py " + CID.slug],
     [F("html_saida"), F("html_comprimido"), F("lotes"), F("muros")],
     [R("relatorios/qa_%s.json" % CID.slug)], False,
     "sai 1 se reprovar; e o unico aceite. Alem da geometria, abre a pagina num "
     "Chrome headless e mexe nela (ficha, 'o que tem por perto', quadro preguicoso, "
     "governador, remendo de arvore, minimapa): ~3 min. `--rapido` no rodar_qa pula "
     "essa parte, mas ai o relatorio nao autoriza publicar"),
]


# Por CIDADE: as chaves sao o id da etapa, entao um arquivo so faria Araraquara
# sobrescrever o carimbo de Sao Carlos e vice-versa.
ESTADO = os.path.join(AQUI, "_estado_%s_%s.json" % (CID.slug, CONFIG.versao))
CACHE = os.path.join(AQUI, "_hashes.json")      # sha1 memorizado por (tamanho, mtime)


def _carrega(p):
    try:
        import json as _j
        with open(p, encoding="utf-8") as stream:
            return _j.load(stream)
    except Exception:
        return {}


def _grava(p, d):
    import json as _j
    with open(p, "w", encoding="utf-8") as stream:
        _j.dump(d, stream)


def mtime(p):
    if not os.path.exists(p): return None
    if os.path.isdir(p):
        t = 0
        for raiz, _, arqs in os.walk(p):
            for a in arqs:
                try: t = max(t, os.path.getmtime(os.path.join(raiz, a)))
                except OSError: pass
        return t or None
    return os.path.getmtime(p)


_cache = _carrega(CACHE)


def sha(p):
    """sha1 do arquivo, memorizado por (tamanho, mtime).

    So e chamado quando o mtime ja disse "velho": e a segunda opiniao. Regerar um
    artefato identico (o `blocks.json` sai byte a byte igual quando so o caminho de
    entrada muda) marcava a metade do pipeline como velha e custava uma hora a toa."""
    import hashlib
    if os.path.isdir(p):
        h = hashlib.sha1()
        for raiz, _, arqs in sorted(os.walk(p)):
            for a in sorted(arqs):
                f = os.path.join(raiz, a)
                try: h.update(("%s:%d;" % (a, os.path.getsize(f))).encode())
                except OSError: pass
        return h.hexdigest()
    st = os.stat(p); k = "%s|%d|%d" % (p, st.st_size, int(st.st_mtime))
    if k in _cache: return _cache[k]
    h = hashlib.sha1()
    with open(p, "rb") as fh:
        for bloco in iter(lambda: fh.read(1 << 20), b""):
            h.update(bloco)
    _cache[k] = h.hexdigest(); _grava(CACHE, _cache)
    return _cache[k]


def estado(eid, ent, sai):
    ts = [mtime(p) for p in sai]
    if any(t is None for t in ts): return "FALTA"
    if eid == '8':
        reg = _carrega(ESTADO).get(eid, {})
        return 'fresco' if reg.get('assinatura') == assinatura(CONFIG) else 'velho'
    te = [mtime(p) for p in _todas(ent) if mtime(p) is not None]
    if not te or max(te) <= min(ts): return "fresco"
    # mtime diz velho -- confere o conteudo antes de gastar a etapa inteira
    reg = _carrega(ESTADO).get(eid, {}).get("entradas", {})
    if reg and all(os.path.exists(p) and reg.get(p) == sha(p) for p in _todas(ent)):
        return "fresco"
    return "velho"


def anota(eid, ent, sai):
    d = _carrega(ESTADO)
    if eid == '8':
        d[eid] = {'assinatura': assinatura(CONFIG),
                  'quando': time.strftime('%Y-%m-%d %H:%M')}
        _grava(ESTADO, d)
        return
    d[eid] = {"entradas": {p: sha(p) for p in _todas(ent) if os.path.exists(p)},
              "quando": time.strftime("%Y-%m-%d %H:%M")}
    _grava(ESTADO, d)


def listar():
    print("pipeline de %s\n" % CID.nome)
    print("  %-4s %-34s %-7s %s" % ("id", "etapa", "estado", "saida"))
    for eid, tit, _, ent, sai, rede, nota in ETAPAS:
        st = estado(eid, ent, sai)
        marca = "~" if rede else " "
        curto = ", ".join(os.path.relpath(s, RAIZ) for s in sai) if sai else "-"
        print("%s %-4s %-34s %-7s %s" % (marca, eid, tit[:34], st, curto[:56]))
        if nota: print("       %s" % nota)
    print("\n  ~ = baixa da rede (so roda com --rede)")


def roda(eid, tit, scripts, nota):
    print("\n=== [%s] %s" % (eid, tit))
    if nota: print("    %s" % nota)
    for sc in scripts:
        partes = sc.split(" ")
        cmd = [PY, R(partes[0])] + partes[1:]
        t0 = time.time()
        r = subprocess.run(cmd, cwd=RAIZ)
        dt = time.time() - t0
        if r.returncode:
            print("\nREPROVOU na etapa %s (%s), codigo %d apos %.0fs."
                  % (eid, partes[0], r.returncode, dt))
            print("Nada depois disso foi executado -- etapa quebrada alimenta lixo na seguinte.")
            sys.exit(1)
        print("    %s ok (%.0fs)" % (os.path.basename(partes[0]), dt))


def main():
    a = sys.argv[1:]
    if "--listar" in a: return listar()
    if "--carimbar" in a:
        # adota a arvore como esta: grava o hash das entradas de cada etapa sem rodar
        # nada. E pra quando o pipeline foi rodado a mao antes de existir este runner.
        for eid, _, _, ent, sai, _, _ in ETAPAS:
            if all(mtime(p) is not None for p in sai): anota(eid, ent, sai)
        print("estado carimbado em %s" % os.path.relpath(ESTADO, RAIZ)); return
    rede = "--rede" in a
    forcar = "--forcar" in a
    ids = [e[0] for e in ETAPAS]
    de = a[a.index("--de") + 1] if "--de" in a else ids[0]
    ate = a[a.index("--ate") + 1] if "--ate" in a else ids[-1]
    if de not in ids or ate not in ids:
        raise SystemExit("id desconhecido. Os validos: %s" % " ".join(ids))
    faixa = ETAPAS[ids.index(de):ids.index(ate) + 1]
    t0 = time.time(); feitas = 0
    for eid, tit, scripts, ent, sai, e_rede, nota in faixa:
        if e_rede and not rede:
            print("[%s] %s -- pulada (rede; use --rede)" % (eid, tit)); continue
        # Etapa cuja ENTRADA nao existe e etapa que nao se aplica a esta cidade (nao
        # ha planta oficial, nao ha cadastro). Rodar assim mesmo foi pior que falhar:
        # com Araraquara sem plantas, a etapa 0d comecou a processar as 171 plantas de
        # SAO CARLOS -- iria assentar lote de um municipio no outro.
        faltando = [p for p in _req(ent) if mtime(p) is None]
        if faltando:
            print("[%s] %s -- pulada (falta %s)"
                  % (eid, tit, ", ".join(os.path.basename(p) for p in faltando[:3])))
            continue
        st = estado(eid, ent, sai)
        if st == "fresco" and not forcar:
            print("[%s] %s -- fresco" % (eid, tit)); continue
        roda(eid, tit, scripts, nota); anota(eid, ent, sai); feitas += 1
    print("\n%d etapa(s) executada(s) em %.0fs." % (feitas, time.time() - t0))


if __name__ == "__main__":
    main()

# -*- coding: utf-8 -*-
"""M1-F: E2E controlado da leitura fixada até a maquete LEVE local.

    python -m pipeline.e2e_leitura ENTRADA.json CONTEXTO.json --destino PASTA

ENTRADA é o par que o pedido fixou no M1-E: `pedido.productionInput` e o snapshot de
`propertyReadings` para onde ele aponta -- exatamente o que o M2 vai ler do Firestore.
CONTEXTO é o que não pertence ao capturador (ficha, prédio, andar, cores), declarado à
parte e nunca deduzido da planta.

    F0 entrada     ponteiro == snapshot == sha256 do conteúdo; M1-0; M1-A vinculado ao hash
    F1 unidade     planta derivada + contexto explícito, num documento da própria execução
    F5 portões     o que o consumidor não representa fielmente bloqueia ANTES da página
    F3 artefato    pagina_maquete.py --cadastro, numa pasta de trabalho
    F2 conferência a sonda roda o FloorPlan embutido no artefato; cômodos e aberturas batem
    F4 relatório   leitura -> planta derivada -> geometria do consumidor -> artefato

Sem Firestore, BuildJob, Blender, Hosting ou publicação; nada é escrito em
`plantas_fornecidas/`. Stdout: o relatório (0) ou {"valid": false, "errors": [...]} (2).
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile

from pipeline import validar_leitura
from pipeline.normalizar_planta import LeituraInvalida, normalizar, serializar

RAIZ = Path(__file__).resolve().parents[1]
MAQUETE = RAIZ / "v1.5" / "miniaturas" / "pagina_maquete.py"
SONDA = RAIZ / "tools" / "sonda-maquete.mjs"

PONTEIRO = ("readingId", "readingVersion", "readingRevision", "schemaVersion", "contentSha256")
DO_SNAPSHOT = {"readingId": "id", "readingVersion": "version", "readingRevision": "revision",
               "schemaVersion": "schemaVersion", "contentSha256": "contentSha256"}

# O que o consumidor (v1.5/renderizador-v16-moveis/interior/floor-plan.js) desenha sem
# alterar a leitura. Fora disso ele aproxima calado, então aqui é recusa (F5).
GRADE_MM = 50           # paredesDaGrade: G = 0.05, a partir do menor x/y da planta
VAO_MIN_MM = 200        # decideVao descarta vão abaixo de 0,2 m
RECUO_CASCA_M = 0.25    # plantaDaUnidade: casca de contorno gerado recua 0,25 m por lado
TOL_M = 1e-6

CONTEXTO = {"schema", "propertyId", "agencyId", "andar", "ficha", "cores", "lote"}
PREDIO = {"largura_m", "profundidade_m", "pavimentos"}
COR = re.compile(r"#[0-9A-Fa-f]{6}")


class Recusa(Exception):
    """Entrada, contexto ou geometria que o E2E não aceita; nada foi gerado."""

    def __init__(self, errors):
        super().__init__("E2E recusado")
        self.errors = errors


def _erro(code, path, message):
    return {"code": code, "path": path, "message": message}


def _sha(dado):
    return hashlib.sha256(dado).hexdigest()


def _numero(v):
    return isinstance(v, (int, float)) and not isinstance(v, bool)


def _vinculo(pi, derivada):
    """O que o artefato carrega da leitura fixada: o ponteiro e a versão do normalizador."""
    return {**{k: pi[k] for k in PONTEIRO},
            "normalizer": "%(id)s@%(version)s" % derivada["normalizer"]}


# ---- F0 -----------------------------------------------------------------------------

def resolver_entrada(doc):
    """Confere o ponteiro contra o snapshot e o snapshot contra o próprio conteúdo, valida
    no M1-0 e normaliza no M1-A. Nenhum hash vindo de fora é aceito sem recálculo."""
    if not (isinstance(doc, dict) and set(doc) == {"schema", "pedido", "snapshot"}
            and doc["schema"] == 1 and isinstance(doc["pedido"], dict)
            and isinstance(doc["snapshot"], dict)):
        raise Recusa([_erro("ENTRADA_INVALIDA", "", "A entrada é {schema: 1, pedido, snapshot}.")])
    pedido, snap = doc["pedido"], doc["snapshot"]
    pi, leitura = pedido.get("productionInput"), snap.get("leitura")
    if not isinstance(pi, dict) or not isinstance(leitura, dict):
        raise Recusa([_erro("ENTRADA_INVALIDA", "/pedido/productionInput",
                            "Pedido sem entrada fixada ou snapshot sem leitura.")])
    erros = []
    for campo, do_snap in DO_SNAPSHOT.items():
        if pi.get(campo) is None or pi.get(campo) != snap.get(do_snap):
            erros.append(_erro("PONTEIRO_DIVERGENTE", "/pedido/productionInput/" + campo,
                               "O pedido aponta %s=%r; o snapshot tem %r."
                               % (campo, pi.get(campo), snap.get(do_snap))))
    for campo in ("propertyId", "agencyId"):
        if not pedido.get(campo) or pedido.get(campo) != snap.get(campo):
            erros.append(_erro("VINCULO_DIVERGENTE", "/snapshot/" + campo,
                               "O snapshot não é do imóvel/agência do pedido."))
    if leitura.get("revision") != snap.get("revision") or \
            leitura.get("schemaVersion") != snap.get("schemaVersion"):
        erros.append(_erro("PONTEIRO_DIVERGENTE", "/snapshot/leitura",
                           "Revisão/schema do snapshot diferem dos da própria leitura."))
    try:
        calculado = _sha(serializar(leitura))
    except (TypeError, ValueError):
        calculado = None
    if calculado != snap.get("contentSha256"):
        erros.append(_erro("CONTEUDO_ADULTERADO", "/snapshot/contentSha256",
                           "O sha256 do conteúdo não é o persistido no snapshot."))
    if erros:
        raise Recusa(erros)
    try:
        derivada = normalizar(leitura)          # o M1-A valida no M1-0 antes de transformar
    except LeituraInvalida as exc:
        raise Recusa(exc.errors)
    fonte = derivada["source"]
    if (fonte["sha256"], fonte["id"], fonte["revision"]) != \
            (pi["contentSha256"], leitura["id"], pi["readingRevision"]):
        raise Recusa([_erro("NORMALIZADOR_DESVINCULADO", "/source",
                            "A planta derivada não está vinculada à leitura fixada.")])
    return derivada


# ---- F5 -----------------------------------------------------------------------------

def portoes_do_consumidor(leitura):
    """M1-0 aceita o que o floor-plan.js não desenha fielmente; isso bloqueia aqui."""
    erros = []
    rooms = leitura["rooms"]
    x0, y0 = min(r["xMm"] for r in rooms), min(r["yMm"] for r in rooms)
    for i, r in enumerate(rooms):
        for campo, v in (("xMm", r["xMm"] - x0), ("yMm", r["yMm"] - y0),
                         ("widthMm", r["widthMm"]), ("depthMm", r["depthMm"])):
            if v % GRADE_MM:
                erros.append(_erro("FORA_DA_GRADE", "/rooms/%d/%s" % (i, campo),
                                   "O consumidor desenha parede em grade de 5 cm a partir do "
                                   "menor x/y da planta; esta medida não cai nela."))
    for i, o in enumerate(leitura["openings"]):
        if o["widthMm"] < VAO_MIN_MM:
            erros.append(_erro("VAO_ESTREITO", "/openings/%d/widthMm" % i,
                               "O consumidor descarta vão com menos de 20 cm."))
    return erros


# ---- F1 -----------------------------------------------------------------------------

def unidade(derivada, pedido, contexto):
    """A unidade que a página consome: planta derivada + contexto explícito. O contexto
    não traz geometria e a planta não fabrica contexto."""
    c = contexto
    if not (isinstance(c, dict) and c.get("schema") == 1):
        raise Recusa([_erro("CONTEXTO_INVALIDO", "/schema", "O contexto é {schema: 1, ...}.")])
    erros = []
    if set(c) - CONTEXTO:
        erros.append(_erro("CONTEXTO_INVALIDO", "", "Chaves fora do contexto: %s. Planta e "
                           "geometria vêm só da leitura." % ", ".join(sorted(set(c) - CONTEXTO))))
    for campo in ("propertyId", "agencyId"):
        if c.get(campo) != pedido.get(campo):
            erros.append(_erro("CONTEXTO_DE_OUTRO_IMOVEL", "/" + campo,
                               "O contexto não é do imóvel/agência do pedido."))
    andar = c.get("andar")
    if not (isinstance(andar, int) and not isinstance(andar, bool) and andar >= 0):
        erros.append(_erro("CONTEXTO_INVALIDO", "/andar", "Andar é inteiro >= 0."))
    ficha = c.get("ficha")
    if not (isinstance(ficha, dict)
            and all(isinstance(v, (str, int, float, bool)) for v in ficha.values())):
        erros.append(_erro("CONTEXTO_INVALIDO", "/ficha", "Ficha é um objeto de valores simples."))
    cores = c.get("cores", {})
    if not (isinstance(cores, dict)
            and all(isinstance(v, str) and COR.fullmatch(v) for v in cores.values())):
        erros.append(_erro("CONTEXTO_INVALIDO", "/cores", "Cores são #RRGGBB."))
    lote = c.get("lote")
    predio = lote.get("predio") if isinstance(lote, dict) and set(lote) == {"predio"} else None
    if not (isinstance(predio, dict) and not set(predio) - PREDIO
            and all(_numero(predio.get(k)) and predio[k] > 0 for k in ("largura_m", "profundidade_m"))
            and isinstance(predio.get("pavimentos"), int) and not isinstance(predio["pavimentos"], bool)
            and predio["pavimentos"] > 0):
        erros.append(_erro("CONTEXTO_INVALIDO", "/lote/predio",
                           "O prédio é {largura_m, profundidade_m, pavimentos} declarado."))
    if erros:
        raise Recusa(erros)
    if andar >= predio["pavimentos"]:
        raise Recusa([_erro("CONTEXTO_INVALIDO", "/andar", "Andar fora dos pavimentos do prédio.")])

    # A planta assenta com o seu x no eixo MAIOR do prédio (obbOf), dentro da casca recuada.
    P = derivada["planta"]
    xs = [p[0] for cm in P["comodos"] for p in cm["poly"]]
    zs = [p[1] for cm in P["comodos"] for p in cm["poly"]]
    larg, prof = max(xs) - min(xs), max(zs) - min(zs)
    maior = max(predio["largura_m"], predio["profundidade_m"]) - 2 * RECUO_CASCA_M
    menor = min(predio["largura_m"], predio["profundidade_m"]) - 2 * RECUO_CASCA_M
    if larg > maior + TOL_M or prof > menor + TOL_M:
        raise Recusa([_erro("CONTEXTO_NAO_COMPORTA", "/lote/predio",
                            "A planta (%.2f x %.2f m) não cabe no prédio declarado do jeito que "
                            "o consumidor a assenta (%.2f x %.2f m úteis)." % (larg, prof, maior, menor))])

    return {
        "id": pedido["propertyId"], "cidade": None, "andar": andar, "ficha": ficha,
        "cores": cores, "lote": {"predio": predio},
        "planta": {
            "pe_direito": P["pe_direito"], "comodos": P["comodos"],
            "portas": P["portas"], "janelas": P["janelas"],
            # o vínculo viaja DENTRO do artefato: a página diz de que leitura nasceu
            "entrada": _vinculo(pedido["productionInput"], derivada),
        },
    }


# ---- F3 / F2 ------------------------------------------------------------------------

def gerar(unid, pasta):
    """pagina_maquete.py com a unidade explícita; LF canônico, como o build_imovel."""
    cadastro = pasta / "unidade.json"
    cadastro.write_text(json.dumps(unid, ensure_ascii=False, sort_keys=True, indent=1) + "\n",
                        encoding="utf-8", newline="\n")
    saida = pasta / "maquete.html"
    r = subprocess.run([sys.executable, str(MAQUETE), "--cadastro", str(cadastro),
                        "--modo", "leve", "--saida", str(saida)],
                       cwd=str(RAIZ), capture_output=True, text=True, encoding="utf-8",
                       errors="replace", env={**os.environ, "PYTHONUTF8": "1"})
    if r.returncode:
        raise RuntimeError("pagina_maquete.py falhou:\n" + (r.stdout + r.stderr)[-2000:])
    dado = saida.read_bytes()
    saida.write_bytes(dado.replace(b"\r\n", b"\n").replace(b"\r", b"\n"))
    return saida


def sondar(maquete):
    r = subprocess.run(["node", str(SONDA), str(maquete)], cwd=str(RAIZ), capture_output=True,
                       text=True, encoding="utf-8", errors="replace")
    if r.returncode:
        raise RuntimeError("sonda da maquete falhou:\n" + r.stderr[-2000:])
    return json.loads(r.stdout)


def _perto(a, b):
    return len(a) == len(b) and all(
        (abs(x - y) <= TOL_M if _numero(x) and _numero(y) else
         _perto(x, y) if isinstance(x, (list, tuple)) and isinstance(y, (list, tuple)) else x == y)
        for x, y in zip(a, b))


def conferir(derivada, sonda, pi):
    """Cômodos e aberturas que o consumidor montou == os da leitura, no referencial da
    planta. Nada entra nem sai: mesma quantidade, mesmas medidas, mesmas alturas."""
    P, g = derivada["planta"], sonda["geometria"]
    xs = [p[0] for c in P["comodos"] for p in c["poly"]]
    zs = [p[1] for c in P["comodos"] for p in c["poly"]]
    mx, mz = (min(xs) + max(xs)) / 2, (min(zs) + max(zs)) / 2
    k = lambda v: round(v, 4)       # chave de ordenação estável; a comparação é por TOL_M

    chave_c = lambda c: (c[0], [[k(x), k(z)] for x, z in c[1]])
    esperados = sorted(((c["nome"], [[p[0] - mx, p[1] - mz] for p in c["poly"]])
                        for c in P["comodos"]), key=chave_c)
    obtidos = sorted(((c["nome"], c["poly"]) for c in g["comodos"]), key=chave_c)

    # abertura = (é porta, centro x, centro z, largura, y0, y1)
    chave_v = lambda v: (v[0], k(v[1]), k(v[2]))
    vaos = sorted(((porta, o["p"][0] - mx, o["p"][1] - mz, o["largura"], o["y0"], o["y1"])
                   for porta, lista in ((True, P["portas"]), (False, P["janelas"])) for o in lista),
                  key=chave_v)
    montados = sorted(((e["porta"], (e["a"][0] + e["b"][0]) / 2, (e["a"][1] + e["b"][1]) / 2,
                        ((e["b"][0] - e["a"][0]) ** 2 + (e["b"][1] - e["a"][1]) ** 2) ** 0.5,
                        e["y0"], e["y1"]) for e in g["esquadrias"]), key=chave_v)

    erros = []
    if abs(g["pd"] - P["pe_direito"]) > TOL_M:
        erros.append(_erro("GEOMETRIA_DIVERGENTE", "/pd", "Pé-direito montado difere da leitura."))
    if not (len(esperados) == len(obtidos) and all(
            a[0] == b[0] and _perto(a[1], b[1]) for a, b in zip(esperados, obtidos))):
        erros.append(_erro("GEOMETRIA_DIVERGENTE", "/comodos",
                           "Cômodos montados (%d) não correspondem aos %d da leitura."
                           % (len(obtidos), len(esperados))))
    if not (len(vaos) == len(montados) and all(_perto(a, b) for a, b in zip(vaos, montados))):
        erros.append(_erro("GEOMETRIA_DIVERGENTE", "/aberturas",
                           "Aberturas montadas (%d) não correspondem às %d da leitura."
                           % (len(montados), len(vaos))))
    if sonda.get("entrada") != _vinculo(pi, derivada):
        erros.append(_erro("GEOMETRIA_DIVERGENTE", "/entrada",
                           "O artefato não carrega o vínculo da leitura fixada."))
    return erros


# ---- orquestração + F4 --------------------------------------------------------------

def executar(entrada, contexto, destino):
    """Tudo o que recusa acontece antes da página; o que diverge depois descarta o artefato."""
    derivada = resolver_entrada(entrada)                                           # F0
    leitura, pedido = entrada["snapshot"]["leitura"], entrada["pedido"]
    erros = portoes_do_consumidor(leitura)                                         # F5
    try:
        unid = unidade(derivada, pedido, contexto)                                 # F1
    except Recusa as exc:
        raise Recusa(erros + exc.errors)
    if erros:
        raise Recusa(erros)

    destino = Path(destino)
    if destino.exists() and (not destino.is_dir() or any(destino.iterdir())):
        raise Recusa([_erro("DESTINO_OCUPADO", str(destino), "O destino já existe e não está vazio.")])
    destino.parent.mkdir(parents=True, exist_ok=True)
    trabalho = Path(tempfile.mkdtemp(prefix=".e2e-", dir=str(destino.parent)))
    try:
        maquete = gerar(unid, trabalho)                                            # F3
        sonda = sondar(maquete)                                                    # F2
        erros = conferir(derivada, sonda, pedido["productionInput"])
        if erros:
            raise Recusa(erros)
        pi, g, dado = pedido["productionInput"], sonda["geometria"], maquete.read_bytes()
        relatorio = {                                                              # F4
            "schema": 1,
            "entrada": {"pedidoId": pedido.get("id"), "propertyId": pedido["propertyId"],
                        "agencyId": pedido["agencyId"], **{c: pi[c] for c in PONTEIRO}},
            "normalizador": derivada["normalizer"],
            "planta": {"sha256": _sha(serializar(derivada))},
            "contexto": {"sha256": _sha(serializar(contexto))},
            "consumidor": {"pagina": "v1.5/miniaturas/pagina_maquete.py",
                           "floorPlanSha256": sonda["floorPlanSha256"]},
            "geometria": {"conferida": True, "pe_direito": g["pd"],
                          "comodos": len(g["comodos"]), "paredes": len(g["paredes"]),
                          "portas": sum(1 for e in g["esquadrias"] if e["porta"]),
                          "janelas": sum(1 for e in g["esquadrias"] if not e["porta"]),
                          "sha256": _sha(serializar(g))},
            "artefato": {"arquivo": "maquete.html", "bytes": len(dado), "sha256": _sha(dado),
                         "id": _sha(dado)[:12]},
        }
        (trabalho / "relatorio.json").write_bytes(serializar(relatorio))
        if destino.exists():
            destino.rmdir()
        trabalho.rename(destino)
    except BaseException:
        shutil.rmtree(trabalho, ignore_errors=True)
        raise
    return relatorio


def _ler(caminho, codigo):
    try:
        return json.loads(Path(caminho).read_text(encoding="utf-8"),
                          object_pairs_hook=validar_leitura._unique_object,
                          parse_constant=validar_leitura._invalid_constant)
    except (OSError, UnicodeError, ValueError, RecursionError):
        raise Recusa([_erro(codigo, str(caminho), "Arquivo ilegível ou JSON inválido.")])


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    p.add_argument("entrada", help="{schema, pedido: {..., productionInput}, snapshot}")
    p.add_argument("contexto", help="ficha, andar, cores e lote.predio do imóvel")
    p.add_argument("--destino", required=True, help="pasta nova (ou vazia) para o artefato")
    args = p.parse_args(argv)
    try:
        relatorio = executar(_ler(args.entrada, "ENTRADA_INVALIDA"),
                             _ler(args.contexto, "CONTEXTO_INVALIDO"), args.destino)
    except Recusa as exc:
        sys.stdout.buffer.write(serializar({"valid": False, "errors": exc.errors}))
        return 2
    sys.stdout.buffer.write(serializar(relatorio))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

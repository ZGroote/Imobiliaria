# -*- coding: utf-8 -*-
"""M1.1-A: roda a cadeia sobre um leitura.json exportado do capturador, sem editar nada.

    python -m pipeline.avaliar_captura EXPORT.json --caso C1
    python -m pipeline.avaliar_captura EXPORT.json --caso C1 --contexto CTX.json [--destino PASTA]

Harness do estudo de usabilidade, NÃO caminho de entrada: o caminho confiável continua
sendo o par fixado (productionInput + snapshot) em `pipeline.e2e_leitura`. Aqui o export é
embrulhado como o M1-D o gravaria (hash calculado do próprio arquivo) só para medir até
onde a cadeia vai:

    leitura do arquivo (política M1-0) -> M1-0 -> M1-A -> portões do consumidor M1-F
    [-> encaixe no prédio, e maquete local com --destino: só com --contexto]

Sem --contexto o encaixe fica "nao-avaliado": o estudo não inventa prédio. Stdout: JSON com
cada etapa. Stderr: cômodos e aberturas em mm, para conferir a fidelidade contra a planta
de origem.
"""
import argparse
import hashlib
import json
from pathlib import Path
import sys

from pipeline import e2e_leitura as e2e
from pipeline import validar_leitura
from pipeline.normalizar_planta import serializar


def embrulhar(leitura, caso, contexto=None):
    """O par que o M1-E fixaria para esta leitura, com o hash calculado do próprio export."""
    l = json.loads(serializar(leitura))              # a forma canônica que o M1-D persiste
    h = hashlib.sha256(serializar(l)).hexdigest()
    ids = {"propertyId": (contexto or {}).get("propertyId", caso),
           "agencyId": (contexto or {}).get("agencyId", "estudo-m1-1a")}
    pi = {"readingId": caso, "readingVersion": 1, "readingRevision": l.get("revision"),
          "schemaVersion": l.get("schemaVersion"), "contentSha256": h}
    snap = {"id": caso, **ids, "version": 1, "revision": l.get("revision"),
            "schemaVersion": l.get("schemaVersion"), "contentSha256": h, "leitura": l}
    return {"schema": 1, "pedido": {"id": caso, **ids, "productionInput": pi}, "snapshot": snap}


def residuo(leitura, path):
    """Quanto uma medida recusada por FORA_DA_GRADE erra a grade de 5 cm do consumidor."""
    _, _, i, campo = path.split("/")
    rooms = leitura["rooms"]
    base = {"xMm": min(r["xMm"] for r in rooms), "yMm": min(r["yMm"] for r in rooms)}.get(campo, 0)
    valor = int(rooms[int(i)][campo]) - base
    resto = valor % e2e.GRADE_MM
    return {"path": path, "comodo": rooms[int(i)]["name"], "valorMm": valor, "restoMm": resto,
            "ateGradeMm": min(resto, e2e.GRADE_MM - resto)}


def avaliar(dado, caso, contexto=None, destino=None):
    r = {"caso": caso, "arquivo": {"bytes": len(dado), "sha256": hashlib.sha256(dado).hexdigest()}}
    try:
        leitura = json.loads(dado.decode("utf-8"), object_pairs_hook=validar_leitura._unique_object,
                             parse_constant=validar_leitura._invalid_constant)
    except (UnicodeError, ValueError, RecursionError):
        r["m1_0"] = {"ok": False, "errors": [validar_leitura._error("INVALID_JSON", "")]}
        return r
    erros = validar_leitura.validar(leitura)
    r["m1_0"] = {"ok": not erros, "errors": erros}
    if erros:
        return r
    r["complexidade"] = {"comodos": len(leitura["rooms"]),
                         "portas": sum(o["kind"] == "door" for o in leitura["openings"]),
                         "janelas": sum(o["kind"] == "window" for o in leitura["openings"]),
                         "revision": leitura["revision"]}
    ent = embrulhar(leitura, caso, contexto)
    derivada = e2e.resolver_entrada(ent)             # M1-A vinculado ao hash, como no M1-F
    r["m1_a"] = {"ok": True, "contentSha256": ent["pedido"]["productionInput"]["contentSha256"],
                 "plantaSha256": hashlib.sha256(serializar(derivada)).hexdigest()}
    portoes = e2e.portoes_do_consumidor(ent["snapshot"]["leitura"])
    r["consumidor"] = {"ok": not portoes, "errors": portoes,
                       "foraDaGrade": [residuo(leitura, e["path"]) for e in portoes
                                       if e["code"] == "FORA_DA_GRADE"]}
    if contexto is None:
        r["encaixe"] = "nao-avaliado"
        return r
    try:
        e2e.unidade(derivada, ent["pedido"], contexto)
        r["encaixe"] = {"ok": True}
    except e2e.Recusa as exc:
        r["encaixe"] = {"ok": False, "errors": exc.errors}
    if destino and r["consumidor"]["ok"] and r["encaixe"]["ok"]:
        try:
            r["maquete"] = {"ok": True, "relatorio": e2e.executar(ent, contexto, destino)}
        except e2e.Recusa as exc:
            r["maquete"] = {"ok": False, "errors": exc.errors}
    return r


def resumo(r, leitura=None):
    """As linhas que o facilitador copia para a ficha, e a tabela da fidelidade."""
    linhas = ["caso %s · arquivo %s…" % (r["caso"], r["arquivo"]["sha256"][:12])]
    if not r["m1_0"]["ok"]:
        return linhas + ["M1-0 RECUSOU: " + ", ".join("%(code)s %(path)s" % e for e in r["m1_0"]["errors"])]
    c = r["complexidade"]
    linhas.append("%d cômodos, %d portas, %d janelas · revisão %d"
                  % (c["comodos"], c["portas"], c["janelas"], c["revision"]))
    linhas.append("M1-0 ok · M1-A ok (planta %s…)" % r["m1_a"]["plantaSha256"][:12])
    cons = r["consumidor"]
    if cons["ok"]:
        linhas.append("M1-F consumidor: aceita")
    else:
        linhas.append("M1-F consumidor: " + ", ".join("%(code)s %(path)s" % e for e in cons["errors"]))
        for g in cons["foraDaGrade"]:
            linhas.append("  %(comodo)s %(path)s = %(valorMm)d mm: resto %(restoMm)d, "
                          "%(ateGradeMm)d mm até a grade" % g)
    enc = r["encaixe"]
    linhas.append("encaixe no prédio: " + ("não avaliado (sem contexto)" if enc == "nao-avaliado"
                  else "ok" if enc["ok"] else ", ".join(e["code"] for e in enc["errors"])))
    if r.get("maquete"):
        m = r["maquete"]
        linhas.append("maquete: " + ("artefato %s, geometria conferida" % m["relatorio"]["artefato"]["id"]
                                     if m["ok"] else ", ".join(e["code"] for e in m["errors"])))
    if leitura:
        linhas.append("cômodos (mm):")
        linhas += ["  %-6s %-20s x %6d  y %6d  %6d x %6d" % (q["id"], q["name"][:20], q["xMm"], q["yMm"],
                   q["widthMm"], q["depthMm"]) for q in leitura["rooms"]]
        linhas.append("aberturas (mm):")
        linhas += ["  %-6s %-6s %-14s offset %6d  largura %5d  peitoril %4d  altura %4d%s"
                   % (o["id"], "porta" if o["kind"] == "door" else "janela", o["wallId"], o["offsetMm"],
                      o["widthMm"], o["sillMm"], o["heightMm"],
                      "  par " + o["pairedWallId"] if o.get("pairedWallId") else "")
                   for o in leitura["openings"]]
    return linhas


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    p.add_argument("export", help="leitura.json baixado do capturador, sem edição")
    p.add_argument("--caso", required=True, help="ID anônimo do caso (C1..C5)")
    p.add_argument("--contexto", help="contexto declarado do imóvel (formato do M1-F)")
    p.add_argument("--destino", help="gera a maquete local aqui, se tudo passar (exige --contexto)")
    args = p.parse_args(argv)
    if args.destino and not args.contexto:
        p.error("--destino exige --contexto")
    dado = Path(args.export).read_bytes()
    contexto = json.loads(Path(args.contexto).read_text(encoding="utf-8")) if args.contexto else None
    r = avaliar(dado, args.caso, contexto, args.destino)
    leitura = json.loads(dado) if r["m1_0"]["ok"] else None
    sys.stderr.write("\n".join(resumo(r, leitura)) + "\n")
    sys.stdout.buffer.write(serializar(r))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

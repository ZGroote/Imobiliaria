# -*- coding: utf-8 -*-
"""Casa o rotulo do OpenPlots ('BURITIS (QUINTA DOS)') com o nome do poligono oficial
('Quinta dos Buritis') e conta quantas quadras oficiais caem dentro dele."""
import json, re, unicodedata, difflib
from shapely.geometry import shape
from shapely.ops import unary_union
from shapely.strtree import STRtree

PROJ = "C:/Users/respawn/Desktop/imobiliaria/"
FONTES = ["loteamentos_saocarlos_oficial.geojson", "bairros_centro_saocarlos.geojson"]
ART = {"DE", "DA", "DO", "DAS", "DOS", "E"}
TIPOS = {"JARDIM", "VILA", "PARQUE", "RESIDENCIAL", "LOTEAMENTO", "CONJUNTO", "HABITACIONAL",
         "CONDOMINIO", "SOCIAL", "CHACARA", "CHACARAS", "RECREIO", "NUCLEO", "DISTRITO",
         "EMPRESARIAL", "SITIO", "SITIOS", "DESMEMBRAMENTO", "DESMEMBRAMENTOS",
         "AMPLIACAO", "PARTE", "AREA", "INTERESSE", "SUBDIVISAO", "TERRENOS"}
ORD = {"I": "1", "II": "2", "III": "3", "IV": "4", "V": "5", "VI": "6", "VII": "7", "VIII": "8"}

def sa(s):
    return unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore").decode()

def toks(s, tirar_tipo):
    s = re.sub(r"[^A-Z0-9 ]", " ", sa(s).upper())
    t = [ORD.get(w, w) for w in s.split()]
    # digito/letra sozinha e o que separa "Gleba D" de "Gleba E" e "I" de "II": nao pode cair
    t = [w for w in t if w not in ART and (len(w) > 1 or w.isalnum())]
    if tirar_tipo:
        t2 = [w for w in t if w not in TIPOS]
        if t2: t = t2
    return set(t)

def rotulo_plano(rot):
    """'ANGELINA, SANTA (LOTEAMENTO SOCIAL)' -> 'LOTEAMENTO SOCIAL SANTA ANGELINA'"""
    r = sa(rot).upper()
    par = " ".join(re.findall(r"\((.*?)\)", r))
    r = re.sub(r"\(.*?\)", " ", r)
    if "," in r:
        a, b = r.split(",", 1); r = b + " " + a
    return " ".join((par + " " + r).split())

def jac_suave(A, B, tol=0.84):
    """jaccard que perdoa erro de digitacao (SCHIMIDT x SCHMIDT, ELIZA x ELISA)."""
    if not A or not B: return 0.0
    def casa(x, S):
        return x in S or any(difflib.SequenceMatcher(None, x, y).ratio() >= tol for y in S)
    inter = sum(1 for x in A if casa(x, B))
    return inter / (len(A) + len(B) - inter)

def score(rot, nome):
    r = rotulo_plano(rot)
    s = 0.0
    for tt in (True, False):
        s = max(s, jac_suave(toks(r, tt), toks(nome, tt)))
    seq = difflib.SequenceMatcher(None, " ".join(sorted(toks(r, True))),
                                  " ".join(sorted(toks(nome, True)))).ratio()
    return max(s, 0.65 * s + 0.35 * seq)

def carregar_areas():
    grupos = {}
    for fn in FONTES:
        try: d = json.load(open(PROJ + fn, encoding="utf-8"))
        except FileNotFoundError: continue
        for f in d["features"]:
            p = f["properties"]
            nome = p.get("nome") or p.get("bairro") or p.get("name") or ""
            if not nome: continue
            grupos.setdefault(nome, []).append(shape(f["geometry"]))
    return grupos

def main(saida="plantas_pipeline/casamento_nomes.json", limiar=0.60):
    man = json.load(open(PROJ + "plantas_openplots/manifest.json", encoding="utf-8"))
    grupos = carregar_areas()
    q = json.load(open(PROJ + "quadras_saocarlos.geojson", encoding="utf-8"))
    qg = [shape(f["geometry"]) for f in q["features"]]
    tree = STRtree(qg); pts = [g.representative_point() for g in qg]

    out = []
    for it in man:
        if it["geral"]: continue
        cand = sorted(((score(it["rotulo"], n), n) for n in grupos), reverse=True)
        sc, nome = cand[0]
        reg = {"arquivo": it["arquivo"], "rotulo": it["rotulo"], "match": None,
               "score": round(sc, 3), "quadras": 0,
               "alternativas": [[round(s, 3), n] for s, n in cand[1:4]]}
        if sc >= limiar:
            P = unary_union(grupos[nome])
            n = sum(1 for j in tree.query(P) if pts[j].within(P))
            reg.update(match=nome, quadras=n)
        out.append(reg)
    json.dump(out, open(PROJ + saida, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    com = [r for r in out if r["match"]]; apto = [r for r in com if r["quadras"] >= 4]
    print("plantas de loteamento: %d" % len(out))
    print("  nome casado: %d | georreferenciavel (>=4 quadras): %d | casou mas <4 quadras: %d | nao casou: %d"
          % (len(com), len(apto), len(com) - len(apto), len(out) - len(com)))
    print("\nduvidosos (score < 0.78):")
    for r in sorted([r for r in com if r["score"] < 0.78], key=lambda r: r["score"]):
        print("  %.2f q=%-3d %-44.44s -> %s" % (r["score"], r["quadras"], r["rotulo"], sa(r["match"])))
    print("\nsem match (%d):" % (len(out) - len(com)))
    for r in out:
        if not r["match"]:
            print("  %.2f %-44.44s  (melhor: %s)" % (r["score"], r["rotulo"], sa(r["alternativas"][0][1]) if r["alternativas"] else "-"))

if __name__ == "__main__":
    main()

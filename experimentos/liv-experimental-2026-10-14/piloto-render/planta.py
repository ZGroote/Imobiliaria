"""Leitura do cadastro da tipologia (`interiores/<tipologia>/unidade.json`) no referencial do Blender.

Sem bpy: usado pelo Blender (montar_apartamento.py, capturar_splat.py) e pelo inspetor.

Referencial: a planta tem x para a direita e y para baixo (metros); o .blend exportado centra a
planta na origem com y invertido. Conferido nas duas tipologias pelas luzes "LIV fixture <cômodo>".
"""
import json, math

def carregar(caminho):
    with open(caminho, encoding="utf-8") as f:
        return Planta(json.load(f)["planta"])

def tipo_comodo(nome):
    n = nome.lower()
    for chave, tipo in (("banho", "banho"), ("varanda", "varanda"), ("sala", "sala"),
                        ("suíte", "quarto"), ("dormit", "quarto"), ("quarto", "quarto")):
        if chave in n: return tipo
    return "outro"

def dentro(pt, poly):
    x, y = pt; ok = False
    for (x0, y0), (x1, y1) in zip(poly, poly[1:] + poly[:1]):
        if (y0 > y) != (y1 > y) and x < x0 + (y - y0) * (x1 - x0) / (y1 - y0):
            ok = not ok
    return ok

class Planta:
    def __init__(self, p):
        self.p = p
        xs = [v[0] for c in p["comodos"] for v in c["poly"]]; ys = [v[1] for c in p["comodos"] for v in c["poly"]]
        self.cx, self.cy = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2
        self.pe_direito = p.get("pe_direito", 2.7)
        self.comodos = [{"nome": c["nome"], "tipo": tipo_comodo(c["nome"]),
                         "poly": [self.mundo(v) for v in c["poly"]]} for c in p["comodos"]]

    def mundo(self, v):
        return (v[0] - self.cx, self.cy - v[1])

    def comodo(self, pt):
        """Cômodo que contém o ponto (mundo)."""
        return next((c for c in self.comodos if dentro(pt, c["poly"])), None)

    def moveis(self):
        """Móveis com centro, costas (rumo da parede de encosto/cabeceira) e lado, em mundo.

        rot conta quartos de volta no sentido horário da planta; com rot 0 as costas apontam para -y da
        planta. Conferido na cama da suíte e no rack/sofá das duas tipologias."""
        for m in self.p.get("moveis", []):
            a = -math.pi / 2 * m["rot"]                          # (0,-1) girado por a, y invertido
            costas = (round(math.sin(a)), round(math.cos(a)))
            c = self.mundo(m["p"])
            com = self.comodo(c)
            yield dict(m, centro=c, costas=costas, lado=(-costas[1], costas[0]),
                       comodo=com["nome"] if com else None, tipo_comodo=com["tipo"] if com else None)

    def aberturas(self):
        """Janelas e portas largas com o rumo para dentro de cada lado (mundo)."""
        for tipo, lista in (("janela", self.p.get("janelas", [])), ("porta", self.p.get("portas", []))):
            for a in lista:
                eixo_y = a["wallId"].rsplit("-", 1)[1] in ("south", "north")   # parede horizontal na planta
                c = self.mundo(a["p"]); lados = []
                for s in (1, -1):
                    d = (0, s) if eixo_y else (s, 0)
                    com = self.comodo((c[0] + d[0] * 0.3, c[1] + d[1] * 0.3))
                    if com: lados.append((com, d))
                yield dict(a, tipo=tipo, centro=c, lados=lados, ao_longo=(1, 0) if eixo_y else (0, 1))


if __name__ == "__main__":   # conferência contra o .blend do Meio e do Canto (sonda das luzes LIV fixture)
    import os
    base = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "interiores")
    meio = carregar(os.path.join(base, "meio", "unidade.json"))
    cama = next(m for m in meio.moveis() if m["nome"] == "Cama da suíte")
    assert cama["costas"] == (1, 0) and abs(cama["centro"][0] - 3.625) < 1e-6 and abs(cama["centro"][1] + 0.25) < 1e-6, cama
    assert meio.comodo((2.53, -0.51))["nome"] == "Suíte"
    sofa = next(m for m in meio.moveis() if m["tipo"] == "sofa"); assert sofa["costas"] == (0, -1), sofa
    canto = carregar(os.path.join(base, "canto", "unidade.json"))
    c = {}
    for m in canto.moveis(): c.setdefault(m["tipo"], m)
    assert c["cama"]["costas"] == (-1, 0) and c["rack"]["costas"] == (-1, 0) and c["sofa"]["costas"] == (1, 0)
    assert canto.comodo((0.97, -0.85))["tipo"] == "sala" and canto.comodo((-2.9, 1.05))["nome"] == "Suíte"
    jan = [a for a in canto.aberturas() if a["id"] == "a7"][0]
    assert jan["lados"][0][0]["nome"] == "Suíte" and jan["lados"][0][1] == (1, 0), jan["lados"]
    print("planta ok")

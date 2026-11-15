"""Busca exaustiva fina, só para PROVAR se o motor deixou de achar uma opção que existia (tarefa 16).

    python -I -X utf8 viabilidade/motor/busca_fina.py LOTE.json ZONA_ID      # LOTE.json = lote do terreno/novo_lote.py

Não faz parte do motor e não o muda. Para cada opção ausente do estudo, varre pavimentos x tamanho da laje x posição
(passos de 0,1 a 0,5 m, bem mais finos que a busca do motor) e confere cada candidato com as MESMAS funções do motor
(`_volume`, `_avaliar`, `_cabe`): CA, TO, permeabilidade, altura, pavimentos, laje mínima e pelo menos 1 apartamento.
A região permitida é a caixa dos recuos da lei (pelo recuo do topo, como o motor), sem o limite de permeabilidade do motor
(esse limite é heurística; a permeabilidade é conferida de verdade no `_cabe`). Forma de cada opção como no motor:
A = 1 quadrado; B = 2 quadrados iguais a >= afastamento; C = 1 retângulo qualquer (<= pavimentos_lamina_max);
D = embasamento (2 pav.) + torre quadrada de até 90% dele, com e sem parede cega.
Devolve, por opção: achou (n, laje, unidades) ou não, e a causa do "não".
"""
import json
import math
import sys
from pathlib import Path

sys.dont_write_bytecode = True
AQUI = Path(__file__).resolve().parent
sys.path.insert(0, str(AQUI))
sys.path.insert(0, str(AQUI.parent / "terreno"))
import motor  # noqa: E402
from shapely.geometry import Polygon, box  # noqa: E402

PASSO_LADO, PASSO_POS, MAX_POS = 0.1, 0.5, 12


def _unidades(laje, pr, n=1):  # a mesma conta do _avaliar, para pular o que não dá nem 1 apartamento sem rodar o resto
    por_andar = max(0.0, min(laje * pr["eficiencia"], laje - pr["area_comum_por_pavimento_m2"]))
    return n * math.floor((por_andar + 1e-9) / pr["area_privativa_por_unidade_m2"])


def _lados(ini, fim, passo=PASSO_LADO):
    k = 0
    while ini + k * passo <= fim + 1e-9:
        yield round(ini + k * passo, 4)
        k += 1


def _posicoes(cx, w, d, passo=PASSO_POS, maximo=MAX_POS):
    """Retângulos w x d (eixos do lote) que cabem em cx, numa grade; no máximo `maximo`, espalhados (inclui as pontas)."""
    x0, y0, x1, y1 = cx.bounds
    achados, cheio = [], cx.buffer(1e-7)
    x = x0
    while x + w <= x1 + 1e-9:
        y = y0
        while y + d <= y1 + 1e-9:
            r = box(x, y, x + w, y + d)
            if cheio.contains(r):
                achados.append(r)
            y += passo
        x += passo
    if len(achados) > maximo:
        achados = [achados[round(i * (len(achados) - 1) / (maximo - 1))] for i in range(maximo)]
    return achados


class Fina:
    def __init__(self, lote, zona, premissas=None, envelope=False):
        self.pr = dict(motor.PREMISSAS_PADRAO, **(premissas or {}))
        zp = zona["parametros"]
        if zp.get("garagem_computavel") is not None:
            self.pr["garagem_computavel"] = zp["garagem_computavel"]
        self.zp, pr = zp, self.pr
        self.poly = Polygon(lote["poligono_utm"])
        A = self.A = self.poly.area
        frente = [list(p) for p in lote["frente"]]
        u, _ = motor.eixos_da_frente(frente, self.poly)
        origem = tuple(frente[0])
        rf = zp["recuo_frontal_m"] if zp.get("recuo_frontal_m") is not None else pr["recuo_frontal_m"]
        rl, rb = zp.get("recuo_lateral_m") or 0, zp.get("recuo_fundos_m") or 0
        perm = zp.get("taxa_permeabilidade") or 0
        self.caixas = motor._Caixas(self.poly, frente, rf, origem, u, area_max=(1 - perm) * A)
        rl0 = motor.recuo_divisa(zp, rl, 1, pr["pe_direito_terreo_m"])
        rb0 = motor.recuo_divisa(zp, rb, 1, pr["pe_direito_terreo_m"], "fundos")
        self.caixas.fixa_limite()  # o mesmo subsolo do motor (com o limite do envelope, se for o caso)
        if not envelope:
            self.caixas.limite = None
        especiais = lote.get("areas_especiais") or []
        alturas = [x for x in [zp.get("altura_max_m")] + [e.get("altura_max_m") for e in especiais] if x]
        altura_max = min(alturas) if alturas else None
        comp_max = zp["ca_maximo"] * A if zp.get("ca_maximo") is not None else None
        pav_cap = min(pr["pavimentos_max_projeto"], zp.get("pavimentos_max") or math.inf)
        if comp_max is not None:
            n_max = min(motor.PAV_BUSCA_MAX, int(comp_max // pr["laje_minima_m2"]) + 1)
        elif zp.get("pavimentos_max"):
            n_max = zp["pavimentos_max"]
        else:
            n_max = pr["pavimentos_sem_ca"]
            pav_cap = min(pav_cap, n_max)
        self.n_max = min(n_max, pav_cap)
        self.pav_cap = pav_cap
        self.ctx = {"pr": pr, "zp": zp, "A": A, "subsolo": self.caixas.mundo(rl0, rb0), "u": u, "origem": origem,
                    "rl": rl, "rb": rb, "altura_max": altura_max, "pav_cap": pav_cap,
                    "cap": comp_max if comp_max is not None else math.inf, "perm_min": perm * A}
        self.rl, self.rb, self.altura_max = rl, rb, altura_max
        self.contagem = {"avaliados": 0, "cabem_na_caixa_com_unidade": 0}

    # --- peças ---
    def topo(self, n):
        r = motor._recuos_topo(self.ctx, n, motor._altura(self.pr, n, True))
        return r, motor._para_local(self.caixas.legal(*r), self.ctx["origem"], self.ctx["u"])

    def confere(self, vols):
        m = motor._avaliar(vols, self.ctx)[0]
        self.contagem["avaliados"] += 1
        return m, motor._cabe(m, vols, self.ctx)

    def _res(self, n, lajes, m):
        return {"pavimentos": n, "lajes_m2": [round(l, 2) for l in lajes], "unidades": m["unidades_estimadas"],
                "computavel": m["area_computavel_m2"], "permeavel": m["area_permeavel_m2"], "to": m["to_usada"]}

    # --- opções ---
    def opcao_a(self):
        pr = self.pr
        for n in range(1, self.n_max + 1):
            r, cx = self.topo(n)
            if cx.is_empty:
                continue
            x0, y0, x1, y1 = cx.bounds
            for s in _lados(math.sqrt(pr["laje_minima_m2"]), min(x1 - x0, y1 - y0, math.sqrt(pr["laje_torre_max_m2"]))):
                if _unidades(s * s, pr) < 1:
                    continue
                for q in _posicoes(cx, s, s):
                    self.contagem["cabem_na_caixa_com_unidade"] += 1
                    vols = [motor._volume(q, self.ctx, 0, n, "residencial", True, *r)]
                    m, ok = self.confere(vols)
                    if ok:
                        return self._res(n, [q.area], m)
        return None

    def opcao_b(self):
        pr = self.pr
        for n in range(1, self.n_max + 1):
            r, cx = self.topo(n)
            if cx.is_empty:
                continue
            x0, y0, x1, y1 = cx.bounds
            for s in _lados(math.sqrt(pr["laje_minima_m2"]), min(x1 - x0, y1 - y0, math.sqrt(pr["laje_torre_max_m2"]))):
                if _unidades(s * s, pr) < 1:
                    continue
                pos = _posicoes(cx, s, s, passo=1.0, maximo=40)
                for i, p in enumerate(pos):
                    for q in pos[i + 1:]:
                        if p.distance(q) + 1e-9 < pr["afastamento_entre_torres_m"]:
                            continue
                        self.contagem["cabem_na_caixa_com_unidade"] += 1
                        vols = [motor._volume(l, self.ctx, 0, n, "residencial", True, *r) for l in (p, q)]
                        m, ok = self.confere(vols)
                        if ok:
                            return self._res(n, [p.area, q.area], m)
        return None

    def opcao_c(self):
        pr = self.pr
        for n in range(1, min(pr["pavimentos_lamina_max"], self.pav_cap, self.n_max) + 1):
            r, cx = self.topo(n)
            if cx.is_empty:
                continue
            x0, y0, x1, y1 = cx.bounds
            for w in _lados(math.sqrt(pr["laje_minima_m2"]) * 0.5, x1 - x0, 0.25):
                for d in _lados(max(w, 5.0), y1 - y0, 0.25) if False else _lados(5.0, y1 - y0, 0.25):
                    if w * d < pr["laje_minima_m2"] or _unidades(w * d, pr) < 1:
                        continue
                    for q in _posicoes(cx, w, d, passo=1.0, maximo=4):
                        self.contagem["cabem_na_caixa_com_unidade"] += 1
                        vols = [motor._volume(q, self.ctx, 0, n, "residencial", True, *r)]
                        m, ok = self.confere(vols)
                        if ok:
                            return self._res(n, [q.area], m)
        return None

    def opcao_d(self):
        pr, ctx, A = self.pr, self.ctx, self.A
        nb = pr["pavimentos_embasamento"]
        hb = motor._altura(pr, nb, True)
        cega = self.zp.get("parede_cega_encosta_ate_m")
        variantes = [False] + ([True] if cega and hb <= cega + 1e-6 else [])
        laje_base_max = pr["embasamento_ocupacao"] * A
        for base_cega in variantes:
            if base_cega:
                rb_, cb = (0.0, 0.0), motor._para_local(self.caixas.legal(0.0, 0.0), ctx["origem"], ctx["u"])
            else:
                rb_, cb = self.topo(nb)
            if cb.is_empty:
                continue
            for n in range(1, min(self.n_max, self.pav_cap - nb) + 1):
                r = motor._recuos_topo(ctx, nb + n, hb + motor._altura(pr, n, False))
                regiao = motor._para_local(self.caixas.legal(*r), ctx["origem"], ctx["u"]).intersection(cb)
                if regiao.is_empty:
                    continue
                x0, y0, x1, y1 = regiao.bounds
                for s in _lados(math.sqrt(pr["laje_minima_m2"]), min(x1 - x0, y1 - y0, math.sqrt(pr["laje_torre_max_m2"]))):
                    if _unidades(s * s, pr) < 1:
                        continue
                    base_area = max(pr["laje_minima_m2"], s * s / 0.9 * 1.001)
                    if base_area > laje_base_max + 1e-6 or base_area > cb.area:
                        continue
                    for q in _posicoes(regiao, s, s):
                        base = motor._cresce(q, cb, base_area)
                        if base.area < pr["laje_minima_m2"] or q.area > base.area * 0.9 + 0.01 or not cb.buffer(1e-6).contains(base):
                            continue
                        self.contagem["cabem_na_caixa_com_unidade"] += 1
                        vols = [motor._volume(base, ctx, 0, nb, "embasamento", True, *rb_),
                                motor._volume(q, ctx, hb, n, "residencial", False, *r, pav_abaixo=nb)]
                        m, ok = self.confere(vols)
                        if ok:
                            return self._res(n, [base.area, q.area], m)
        return None

    def todas(self, ids="ABCD"):
        return {i: getattr(self, "opcao_" + i.lower())() for i in ids}


def main():
    lote = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    zonas = {z["id"]: z for z in json.loads((AQUI.parent / "lei" / "zonas.json").read_text(encoding="utf-8"))}
    f = Fina(lote, zonas[sys.argv[2]])
    print(json.dumps(f.todas(), ensure_ascii=False, indent=1), f.contagem)


if __name__ == "__main__":
    main()

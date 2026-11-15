"""Mede o corpus existente: python -I -X utf8 viabilidade/motor/dominio.py.

Não gera opções nem amplia automaticamente o domínio durante um estudo.
"""
import json
import math
from functools import lru_cache
from pathlib import Path

from shapely.geometry import Polygon

ARQUIVO = Path(__file__).with_name("dominio-0.8.json")
AVISO_FORA = "Lote fora do domínio testado do motor: resultado não validado; encaminhar a profissional."
PARAMETROS = ("ca_basico", "ca_maximo", "taxa_ocupacao", "taxa_permeabilidade")
ROTULOS = {"area_m2": "área do lote (m²)", "vertices": "número de vértices",
           "convexidade": "convexidade", "frente_profundidade": "razão frente/profundidade",
           "angulo_min_graus": "menor ângulo interno (graus)", "ca_basico": "CA básico",
           "ca_maximo": "CA máximo", "taxa_ocupacao": "TO", "taxa_permeabilidade": "permeabilidade"}


def _pontos(valor, minimo, maximo=None):
    try:
        return (isinstance(valor, (list, tuple)) and minimo <= len(valor) <= (maximo or math.inf)
                and all(len(p) == 2 and all(isinstance(v, (int, float)) and not isinstance(v, bool)
                                           and math.isfinite(v) for v in p) for p in valor))
    except TypeError:
        return False


def entradas_calculaveis(lote, zona):
    return (isinstance(lote, dict) and _pontos(lote.get("poligono_utm"), 3)
            and _pontos(lote.get("frente"), 2, 2) and isinstance(zona, dict)
            and bool(zona.get("id")) and isinstance(zona.get("parametros"), dict))


def medir(lote, zona, premissas=None):
    """Medidas da entrada original; dados ausentes nunca são substituídos por zero."""
    lote = lote if isinstance(lote, dict) else {}
    zona = zona if isinstance(zona, dict) else {}
    premissas = premissas or {}
    medidas, faltas = {}, []
    pts = lote.get("poligono_utm")
    poly = None
    if _pontos(pts, 3):
        pts = [tuple(p) for i, p in enumerate(pts) if tuple(p) != tuple(pts[i - 1])]
        poly = Polygon(pts) if len(pts) >= 3 else None
    if poly is None or not poly.is_valid or poly.area <= 0:
        faltas.append("polígono do lote ausente, degenerado ou inválido; conferir geometria")
    else:
        pts = list(poly.exterior.coords)[:-1]
        sentido = 1 if poly.exterior.is_ccw else -1
        angulos = []
        for a, b, c in zip(pts[-1:] + pts[:-1], pts, pts[1:] + pts[:1]):
            u, v = (b[0] - a[0], b[1] - a[1]), (c[0] - b[0], c[1] - b[1])
            giro = math.degrees(math.atan2(u[0] * v[1] - u[1] * v[0], u[0] * v[0] + u[1] * v[1]))
            angulos.append(180 - sentido * giro)
        medidas.update(area_m2=poly.area, vertices=len(pts), convexidade=poly.area / poly.convex_hull.area,
                       angulo_min_graus=min(angulos))
    frente = lote.get("frente")
    if not _pontos(frente, 2, 2) or math.dist(*frente) == 0:
        faltas.append("frente ausente ou sem comprimento; razão frente/profundidade não medida")
    elif poly is not None and poly.is_valid and poly.area > 0:
        comprimento = math.dist(*frente)
        nx, ny = -(frente[1][1] - frente[0][1]) / comprimento, (frente[1][0] - frente[0][0]) / comprimento
        proj = [(x - frente[0][0]) * nx + (y - frente[0][1]) * ny for x, y in pts]
        medidas["frente_profundidade"] = comprimento / (max(proj) - min(proj))
    medidas["area_especial"] = bool(lote.get("areas_especiais"))
    if not zona.get("id"):
        faltas.append("zona ausente ou sem identificação")
    else:
        medidas["zona"] = zona["id"]
    zp = zona.get("parametros")
    if not isinstance(zp, dict):
        faltas.append("parâmetros da zona ausentes")
    else:
        for chave in PARAMETROS:
            valor = zp.get(chave)
            if chave not in zp or (valor is not None and (isinstance(valor, bool) or not isinstance(valor, (int, float)) or not math.isfinite(valor))):
                faltas.append(f"{ROTULOS[chave]} ausente ou inválido na zona")
            else:
                medidas[chave] = valor  # null explícito é uma condição observada, não uma faixa numérica
        gc = zp.get("garagem_computavel")
        medidas["garagem_computavel"] = gc if gc is not None else premissas.get("garagem_computavel", False)
    return medidas, faltas


def corpus():
    raiz = Path(__file__).resolve().parent.parent
    arquivos = [raiz / "motor/exemplos/estudo-exemplo.json", *sorted((raiz / "motor/exemplos/pilotos").glob("*.json")),
                *sorted((raiz / "auditoria/casos").glob("*.json"))]
    for arquivo in arquivos:
        estudo = json.loads(arquivo.read_text(encoding="utf-8"))
        if isinstance(estudo.get("lote"), dict):
            yield arquivo.relative_to(raiz).as_posix(), estudo


def construir():
    faixas = {k: {"min": None, "max": None, "aceita_null": False} for k in ROTULOS}
    categorias = {k: set() for k in ("zona", "area_especial", "garagem_computavel")}
    fontes = []
    for nome, estudo in corpus():
        medidas, faltas = medir(estudo["lote"], estudo.get("zona"), estudo.get("premissas"))
        fontes.append({"arquivo": nome, "medidas_ausentes": faltas})
        for k, valor in medidas.items():
            if k in categorias:
                categorias[k].add(valor)
            elif valor is None:
                faixas[k]["aceita_null"] = True
            else:
                f = faixas[k]
                f["min"] = valor if f["min"] is None else min(f["min"], valor)
                f["max"] = valor if f["max"] is None else max(f["max"], valor)
    return {"versao": "dominio-0.8", "folga_relativa": 0.001,
            "metodo": "Faixas marginais observadas, não prova de cobertura de todas as combinações. Área pelo polígono UTM; vértices sem fechamento nem repetições consecutivas; convexidade = área/área do fecho convexo; profundidade = amplitude da projeção normal à frente; ângulos internos respeitam concavidade e orientação. Folga de 0,1% de cada extremo numérico (mínimo 1e-9); vértices e categorias sem folga. null explícito é separado de campo ausente. Entradas isoladas e registros de erro sem lote não entram no corpus.",
            "faixas": faixas, "categorias": {k: sorted(v) for k, v in categorias.items()}, "fontes": fontes}


@lru_cache(maxsize=1)
def carregar():
    return json.loads(ARQUIVO.read_text(encoding="utf-8"))


def classificar(lote, zona, premissas=None, dominio=None):
    dominio = carregar() if dominio is None else dominio
    medidas, faltas = medir(lote, zona, premissas)
    fora = []
    for k, valor in medidas.items():
        if k in dominio["categorias"]:
            if valor not in dominio["categorias"][k]:
                fora.append(f"{k}: {valor} não consta no conjunto testado")
            continue
        faixa = dominio["faixas"][k]
        if valor is None:
            if not faixa["aceita_null"]:
                fora.append(f"{ROTULOS[k]} sem limite explícito (null) não testado")
            continue
        for extremo, sinal, texto in (("min", -1, "abaixo do menor"), ("max", 1, "acima do maior")):
            limite = faixa[extremo]
            if limite is None:
                faltas.append(f"{ROTULOS[k]} sem referência medida no corpus")
                break
            folga = 0 if k == "vertices" else max(1e-9, abs(limite) * dominio["folga_relativa"])
            if sinal * (valor - limite) > folga:
                fora.append(f"{ROTULOS[k]} {valor:.4f} {texto} testado ({limite:.4f})")
    return {"status": "fora" if fora else "dados_insuficientes" if faltas else "dentro",
            "motivos": fora + faltas, "versao": dominio["versao"]}


if __name__ == "__main__":
    dominio = construir()
    ARQUIVO.write_text(json.dumps(dominio, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"{len(dominio['fontes'])} estudos medidos; gravado {ARQUIVO.name}")

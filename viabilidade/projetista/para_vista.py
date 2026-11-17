"""Prévia 3D de uma revisão do Projetista: converte a revisão em um estudo do motor.

    python -I -X utf8 viabilidade/projetista/para_vista.py <revisao.json> <estudo.json> --saida <arquivo>

O `viabilidade/visual/index.html` já desenha o formato "estudo do motor"
(`?estudo=<arquivo>`). Aqui só se troca `opcoes` por UMA opção `projetista`, com um
volume por unidade, por espaço comum e por peça do núcleo, empilhados andar a andar.
O estudo original não é alterado (nem o arquivo, nem o dict de entrada).
"""
import argparse
import copy
import json
import math
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(RAIZ))
from shapely.geometry import Polygon
from shapely.ops import unary_union

from viabilidade.projetista.adaptador import estudo_para_site
from viabilidade.projetista.esquema import TOLERANCIAS, carregar_json, conferir_estrutura
from viabilidade.projetista.validador import _posicionar

MAX_VOLUMES = 200  # limite do visualizador por opção
USOS = {"unidade": "unidade", "circulacao": "circulacao", "nucleo": "nucleo"}


def _estudo(entrada):
    if isinstance(entrada, dict):
        return copy.deepcopy(entrada)
    raw = entrada.read_bytes() if isinstance(entrada, Path) else entrada
    return carregar_json(raw.encode("utf-8") if isinstance(raw, str) else raw)


def _envelope(faixas, z0, z1):
    """Mesma regra do validador: interseção das faixas que tocam [z0, z1); None se passa do topo."""
    g = None
    for b in faixas:
        if b["z0_m"] < z1 and b["z1_m"] > z0:
            p = Polygon(b["polygon_m"]) if len(b["polygon_m"]) >= 3 else Polygon()
            if not p.is_valid:
                raise ValueError(f"faixa do envelope em z={b['z0_m']:g}..{b['z1_m']:g} m é inválida")
            g = p if g is None else g.intersection(p)
    if g is None or not faixas or z1 > faixas[-1]["z1_m"] + 1e-9:
        return None
    return g


def _cabe(laje, faixas, z0, z1, tg):
    """(cabe, motivo). `laje` já vem engordada pela meia espessura externa (a face física)."""
    env = _envelope(faixas, z0, z1)
    if env is None:
        topo = faixas[-1]["z1_m"] if faixas else 0
        return False, f"o andar (z {z0:g} a {z1:g} m) passa da altura máxima da caixa ({topo:g} m)"
    fora = laje.difference(env.buffer(tg, join_style="mitre")).area
    if fora > TOLERANCIAS["tol_overlap_m2"]:
        return False, f"o andar (z {z0:g} a {z1:g} m) sai do envelope dessa altura: {fora:.2f} m² para fora"
    return True, None


def _unidos(pecas, tol=0.0006):
    """Junta peças encostadas (vão de décimos de mm) num polígono só; se não der sem buraco, mantém separadas."""
    if len(pecas) < 2:
        return pecas
    g = unary_union([p.buffer(tol, join_style="mitre") for p in pecas]).buffer(-tol, join_style="mitre")
    if g.geom_type == "Polygon" and not g.interiors:
        return [g]
    return pecas


def _anel_utm(poly, frame):
    # local = M·(P-origem), M = [[ux,uy],[vx,vy]] já arredondada a 4 casas (não é ortonormal exata): inversa exata, não a transposta
    (x0, y0), (ux, uy), (vx, vy) = frame["origem"], frame["u"], frame["v"]
    det = ux * vy - uy * vx
    if abs(det) < 1e-9:
        raise ValueError("local_frame degenerado (u e v paralelos)")
    pts = list(poly.exterior.coords)[:-1]
    return [[round(x0 + (vy * u - uy * v) / det, 4), round(y0 + (-vx * u + ux * v) / det, 4)] for u, v in pts]


def revisao_para_estudo(revisao, estudo_json, pavimentos=None):
    """Estudo (dict) com uma opção `projetista`. `pavimentos=None` empilha até onde cada andar cabe."""
    conferir_estrutura(revisao)
    if len(revisao["floor_plates"]) != 1:
        raise ValueError("a prévia espera uma revisão com um só pavimento tipo")
    if pavimentos is not None and (type(pavimentos) is not int or pavimentos < 1):
        raise ValueError("pavimentos deve ser inteiro >= 1")
    ref, _, _ = estudo_para_site(estudo_json)
    # dict não guarda os bytes do arquivo, então o hash dele não bate com o da revisão: compara só o id
    chave = "study_id" if isinstance(estudo_json, dict) else "study_sha256"
    if ref[chave] != revisao["study_ref"][chave]:
        raise ValueError(f"a revisão foi gerada de outro estudo ({chave} diferente)")
    base = _estudo(estudo_json)
    placa, site, tg = revisao["floor_plates"][0], revisao["site"], TOLERANCIAS["tol_geom_m"]
    tipos = {t["id"]: t for t in revisao["unit_types"]}
    h, z0 = placa["height_m"], placa["z0_m"]

    # 1. Quantos andares cabem
    meia = max(t["thickness_m"]["externa"] for t in tipos.values()) / 2
    laje = Polygon(placa["outline_m"]).buffer(meia, join_style="mitre")
    faixas, parou, n = site["envelope_by_height"], None, 0
    limite = pavimentos if pavimentos is not None else 1000
    while n < limite:
        cabe, motivo = _cabe(laje, faixas, z0 + n * h, z0 + (n + 1) * h, tg)
        if not cabe:
            parou = motivo
            break
        n += 1
    if pavimentos is not None and n < pavimentos:
        raise ValueError(f"não cabem {pavimentos} pavimentos: andar {n + 1}: {parou}")
    if n == 0:
        raise ValueError(f"nem o primeiro andar cabe: {parou}")

    # 2. Peças de um andar, em coordenadas locais
    unidades = [(p["id"], _posicionar(Polygon(tipos[p["unit_type_id"]]["outline_m"]), p)) for p in placa["unit_placements"]]
    comuns = [(e["id"], Polygon(e["polygon_m"])) for e in placa["shared_spaces"]]
    nucleo = [(e["id"], Polygon(e["polygon_m"])) for e in placa["cores"]]
    juntou = len(unidades) + len(comuns) + len(nucleo) > 0 and n * (len(unidades) + len(comuns) + len(nucleo)) > MAX_VOLUMES
    por_andar = [("unidade", unidades), ("circulacao", comuns), ("nucleo", nucleo)]
    if juntou:  # passa de 200: circulação e núcleo viram um volume cada, por andar
        por_andar = [("unidade", unidades)] + [
            (uso, [(f"{uso}_unido", g) for g in _unidos([g for _, g in pecas])]) for uso, pecas in por_andar[1:]]
    volumes = []
    for k in range(n):
        for uso, pecas in por_andar:
            for pid, g in pecas:
                volumes.append({"id": f"{pid}_andar_{k + 1:02d}", "base_utm": _anel_utm(g, site["local_frame"]),
                                "z0_m": round(z0 + k * h, 4), "altura_m": round(h, 4), "pavimentos": 1, "uso": USOS[uso]})
    if len(volumes) > MAX_VOLUMES:
        raise ValueError(f"{len(volumes)} volumes: passa do limite de {MAX_VOLUMES} do visualizador mesmo juntando por andar")

    # 3. Métricas: só as que o visualizador lê; a área privativa vem da revisão
    m = revisao["metrics_summary"]
    if not isinstance(m.get("privativa_total_m2"), (int, float)):
        raise ValueError("a revisão não traz metrics_summary.privativa_total_m2")
    metricas = {"unidades_estimadas": len(unidades) * n, "area_privativa_m2": round(m["privativa_total_m2"] * n, 4),
                "pavimentos": n, "vagas": None, "area_nao_computavel_m2": None, "vgv_estimado": None}

    # 4. Alertas (texto simples; o que não foi conferido fica dito)
    zona_ok = base["lote"].get("zona_conferida") is True and base["zona"].get("conferido") is True
    alertas = [f"Prévia esquemática do projetista (revisão {revisao['revision_id']}): preliminar, não é projeto aprovado nem estudo do motor.",
               f"{len(unidades)} unidades por andar, empilhadas em {n} pavimento(s) de {h:g} m; "
               + (f"parou em {n} porque {parou}." if parou else f"pedido: {n} pavimento(s).")]
    if not zona_ok:
        alertas.append("Zona do terreno não conferida: a prévia herda o envelope do estudo e não vale como verificação da lei.")
    if m.get("regras_nao_verificadas"):
        alertas.append("Regras com fonte não verificada na revisão: " + ", ".join(m["regras_nao_verificadas"]) + ".")
    if juntou:
        alertas.append(f"Passaria de {MAX_VOLUMES} volumes: circulação e núcleo foram juntos por andar.")
    alertas.append("Sem vagas, garagem, recuos por volume nem relevo: a prévia só mostra o pavimento tipo repetido.")
    opcao = {"id": "projetista", "nome": "Pavimento tipo do projetista (prévia esquemática)", "volumes": volumes,
             "metricas": metricas, "alertas": alertas,
             "fonte": {"revision_id": revisao["revision_id"], "content_sha256": revisao["content_sha256"]}}

    # 5. Estudo: mantém lote, zona, caixa máxima; troca opcoes; sem opcoes_ausentes (eram das opções do motor)
    saida = {}
    for k, v in base.items():
        if k == "opcoes":
            saida[k] = [opcao]
        elif k == "opcoes_ausentes":
            continue
        elif k == "criterio_escolha":
            saida[k] = {"ordem": ["area_privativa_total desc"], "texto": "Opção única do gerador do Projetista: maior área privativa total no pavimento tipo; sem prova de ótimo."}
        elif k == "incertezas":
            saida[k] = ["As opções do Motor foram trocadas por UMA prévia esquemática do Projetista; as incertezas abaixo são do estudo original."] + list(v)
        else:
            saida[k] = v
    saida.setdefault("incertezas", ["As opções do Motor foram trocadas por UMA prévia esquemática do Projetista."])
    return saida


def serializar(estudo):
    """Bytes iguais para a mesma entrada: ordem das chaves herdada, UTF-8, LF."""
    return (json.dumps(estudo, ensure_ascii=False, allow_nan=False, indent=1) + "\n").encode("utf-8")


def main(argv=None):
    ap = argparse.ArgumentParser(description="Converte uma revisão do Projetista em estudo para o visualizador.")
    ap.add_argument("revisao", type=Path)
    ap.add_argument("estudo", type=Path)
    ap.add_argument("--saida", type=Path, required=True)
    ap.add_argument("--pavimentos", type=int, default=None)
    a = ap.parse_args(argv)
    try:
        revisao = carregar_json(a.revisao.read_bytes())
        estudo = revisao_para_estudo(revisao, a.estudo, a.pavimentos)
    except ValueError as erro:
        print(f"erro: {erro}")
        return 1
    a.saida.parent.mkdir(parents=True, exist_ok=True)
    a.saida.write_bytes(serializar(estudo))
    o = estudo["opcoes"][0]
    print(f"{o['metricas']['pavimentos']} pavimento(s), {len(o['volumes'])} volumes, {o['metricas']['unidades_estimadas']} unidades, "
          f"área privativa {o['metricas']['area_privativa_m2']:.2f} m²")
    print(o["alertas"][1])
    print(f"gravado em {a.saida}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

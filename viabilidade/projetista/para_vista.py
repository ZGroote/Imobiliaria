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
from viabilidade.projetista.esquema import carregar_json, conferir_estrutura
from viabilidade.projetista.torre import PADROES_TERREO, _montar, _partes, nucleo_fundido  # noqa: F401 (PADROES_TERREO é reexportado)
from viabilidade.projetista.validador import _posicionar

MAX_VOLUMES = 200  # limite do visualizador por opção
USOS = {"unidade": "unidade", "circulacao": "circulacao", "nucleo": "nucleo"}


def _estudo(entrada):
    if isinstance(entrada, dict):
        return copy.deepcopy(entrada)
    raw = entrada.read_bytes() if isinstance(entrada, Path) else entrada
    return carregar_json(raw.encode("utf-8") if isinstance(raw, str) else raw)


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


def revisao_para_estudo(revisao, estudo_json, pavimentos=None, terreo=False, premissas_terreo=None):
    """Estudo (dict) com uma opção `projetista`.

    Revisão que já é torre (`metrics_summary.torre`, de `torre.compor`): desenha o que está em `floor_plates`, sem
    recalcular; `pavimentos`, `terreo` e `premissas_terreo` não valem aqui, valem na `compor`.
    Revisão de um pavimento: empilha até onde cada andar cabe INTEIRO (regra das tarefas 6 e 8; o escalonamento
    por unidade é da `compor`). `terreo=True` põe núcleo, hall e garagem em z = 0 e começa os andares tipo em cima
    dele; `pavimentos` conta só os andares tipo. Sem `terreo` a saída é a da tarefa 6, byte a byte.
    """
    conferir_estrutura(revisao)
    ref, _, _ = estudo_para_site(estudo_json)
    # dict não guarda os bytes do arquivo, então o hash dele não bate com o da revisão: compara só o id
    chave = "study_id" if isinstance(estudo_json, dict) else "study_sha256"
    if ref[chave] != revisao["study_ref"][chave]:
        raise ValueError(f"a revisão foi gerada de outro estudo ({chave} diferente)")
    base = _estudo(estudo_json)
    m = revisao["metrics_summary"]
    if "torre" in m:
        if terreo or pavimentos is not None or premissas_terreo:
            raise ValueError("a revisão já tem a torre: terreo e pavimentos valem na torre.compor, não na prévia")
        placas, T = revisao["floor_plates"], m["torre"]
    else:
        if len(revisao["floor_plates"]) != 1:
            raise ValueError("a prévia espera uma revisão com um só pavimento tipo")
        placas, T = _montar(revisao, terreo, pavimentos, premissas_terreo, escalonar=False)
    tipos, site = {t["id"]: t for t in revisao["unit_types"]}, revisao["site"]
    terr = next((p for p in placas if p["id"] == "terreo"), None)
    andares = [p for p in placas if p["id"] != "terreo"]
    n, h, ht, PT, parou = len(andares), andares[0]["height_m"], (terr["height_m"] if terr else 0.0), T["premissas_terreo"], T["parou"]

    # 1. Peças de cada andar (e do térreo), em coordenadas locais
    def pecas(pl):
        return [("unidade", [(p["id"], _posicionar(Polygon(tipos[p["unit_type_id"]]["outline_m"]), p)) for p in pl["unit_placements"]]),
                ("circulacao", [(e["id"], Polygon(e["polygon_m"])) for e in pl["shared_spaces"]]),
                ("nucleo", [(e["id"], Polygon(e["polygon_m"])) for e in pl["cores"]])]

    t_vol = []  # térreo: (uso, [polígonos]); o núcleo é a fusão dos três cores, como na tarefa 8
    if terr:
        laje = Polygon(terr["outline_m"])
        t_vol = [("nucleo", _partes(nucleo_fundido(laje, [Polygon(e["polygon_m"]) for e in terr["cores"]]), "núcleo do térreo", laje))]
        t_vol += [(k, [Polygon(e["polygon_m"]) for e in terr["shared_spaces"] if e["kind"] == k]) for k in ("hall", "garagem")]
    total = sum(len(g) for _, g in t_vol) + sum(len(x) for pl in andares for _, x in pecas(pl))
    juntou = total > MAX_VOLUMES
    volumes = []
    for uso, gs in t_vol:
        for i, g in enumerate(gs, 1):
            volumes.append({"id": f"{uso}_terreo_{i:02d}", "base_utm": _anel_utm(g, site["local_frame"]),
                            "z0_m": round(float(terr["z0_m"]), 4), "altura_m": round(float(ht), 4), "pavimentos": 1, "uso": uso})
    for pl in andares:
        grupos = pecas(pl)
        if juntou:  # passa de 200: circulação e núcleo viram um volume cada, por andar
            grupos = grupos[:1] + [(uso, [(f"{uso}_unido_{pl['id']}", g) for g in _unidos([g for _, g in x])]) for uso, x in grupos[1:]]
        for uso, x in grupos:
            for pid, g in x:
                volumes.append({"id": pid, "base_utm": _anel_utm(g, site["local_frame"]), "z0_m": round(pl["z0_m"], 4),
                                "altura_m": round(pl["height_m"], 4), "pavimentos": 1, "uso": USOS[uso]})
    if len(volumes) > MAX_VOLUMES:
        raise ValueError(f"{len(volumes)} volumes: passa do limite de {MAX_VOLUMES} do visualizador mesmo juntando por andar")

    # 2. Métricas: só as que o visualizador lê; tudo vem do resumo da torre
    metricas = {"unidades_estimadas": T["unidades"]["valor"], "area_privativa_m2": T["privativa_total"]["valor"],
                "pavimentos": T["pavimentos"]["valor"], "vagas": T["vagas"]["valor"], "area_nao_computavel_m2": None, "vgv_estimado": None}
    if terr:
        metricas["area_garagem_m2"] = T["area_garagem"]["valor"]

    # 3. Alertas (texto simples; o que não foi conferido fica dito)
    zona_ok = base["lote"].get("zona_conferida") is True and base["zona"].get("conferido") is True
    por = {len(pl["unit_placements"]) for pl in andares}
    quant = f"{por.pop()} unidades por andar" if len(por) == 1 else f"{T['unidades']['valor']} unidades no total (andares escalonados)"
    alertas = [f"Prévia esquemática do projetista (revisão {revisao['revision_id']}): preliminar, não é projeto aprovado nem estudo do motor.",
               (f"Térreo de {ht:g} m (hall e garagem) e {quant}, empilhadas em {n} andar(es) tipo de {h:g} m"
                if terr else f"{quant}, empilhadas em {n} pavimento(s) de {h:g} m")
               + (f"; parou em {n} porque {parou}." if parou else f"; pedido: {n} pavimento(s).")]
    if not zona_ok:
        alertas.append("Zona do terreno não conferida: a prévia herda o envelope do estudo e não vale como verificação da lei.")
    if m.get("regras_nao_verificadas"):
        alertas.append("Regras com fonte não verificada na revisão: " + ", ".join(m["regras_nao_verificadas"]) + ".")
    if juntou:
        alertas.append(f"Passaria de {MAX_VOLUMES} volumes: circulação e núcleo foram juntos por andar.")
    if terr:
        alertas.append(f"Vagas por área bruta (premissa de {PT['m2_por_vaga']:g} m² por vaga com circulação), não desenhadas nem conferidas pela lei.")
        alertas.append(f"Hall = faixa de {PT['hall_largura_m']:g} m ao redor do núcleo; garagem = resto da laje do térreo: premissas, sem rampa, pilar nem acesso desenhados. Sem recuos por volume nem relevo.")
    else:
        alertas.append("Sem vagas, garagem, recuos por volume nem relevo: a prévia só mostra o pavimento tipo repetido.")
    opcao = {"id": "projetista", "nome": "Pavimento tipo do projetista (prévia esquemática)", "volumes": volumes,
             "metricas": metricas, "alertas": alertas,
             "fonte": {"revision_id": revisao["revision_id"], "content_sha256": revisao["content_sha256"]}}

    # 4. Estudo: mantém lote, zona, caixa máxima; troca opcoes; sem opcoes_ausentes (eram das opções do motor)
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
    ap.add_argument("--pavimentos", type=int, default=None, help="andares tipo (sem contar o térreo)")
    ap.add_argument("--terreo", action="store_true", help="põe térreo com núcleo, hall e garagem e calcula vagas")
    a = ap.parse_args(argv)
    try:
        revisao = carregar_json(a.revisao.read_bytes())
        estudo = revisao_para_estudo(revisao, a.estudo, a.pavimentos, a.terreo)
    except ValueError as erro:
        print(f"erro: {erro}")
        return 1
    a.saida.parent.mkdir(parents=True, exist_ok=True)
    a.saida.write_bytes(serializar(estudo))
    o = estudo["opcoes"][0]
    m = o["metricas"]
    print(f"{m['pavimentos']} pavimento(s), {len(o['volumes'])} volumes, {m['unidades_estimadas']} unidades, "
          f"área privativa {m['area_privativa_m2']:.2f} m²" + (f", {m['vagas']} vagas" if m["vagas"] is not None else ""))
    print(o["alertas"][1])
    print(f"gravado em {a.saida}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

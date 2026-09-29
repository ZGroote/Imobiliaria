#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Croqui ortogonal (imagem) -> planta intermediaria revisavel.

MVP conservador:
  1. detecta eixos longos de parede em croquis aproximadamente ortogonais;
  2. usa UMA medida conhecida para fixar a escala;
  3. sugere celulas fechadas como comodos;
  4. grava um JSON intermediario que PRECISA de revisao humana;
  5. exporta uma leitura compativel com pipeline/extrair_planta.py.

Nao publica, nao cria pedido e nao escreve unidade.json diretamente.

Exemplo:
  python pipeline/croqui.py analisar croqui.png --ref 100,80,500,80 --metros 4.0
  # editar croqui.intermediario.json: nomear/confirmar comodos e cadastrar portas/janelas
  python pipeline/croqui.py exportar croqui.intermediario.json --id meu-imovel
  python pipeline/extrair_planta.py montar leitura.croqui.json
"""
from __future__ import annotations

import argparse
import json
import math
import os
from dataclasses import dataclass
from typing import Iterable

import numpy as np
from PIL import Image


@dataclass(frozen=True)
class Eixo:
    pos: int
    inicio: int
    fim: int
    cobertura: float


def _grupos(indices: Iterable[int], folga: int = 7) -> list[list[int]]:
    out: list[list[int]] = []
    for i in indices:
        if out and i - out[-1][-1] <= folga:
            out[-1].append(i)
        else:
            out.append([i])
    return out


def _maior_run(v: np.ndarray) -> tuple[int, int, int]:
    melhor = ini = fim = 0
    atual = 0
    atual_ini = 0
    for i, x in enumerate(v):
        if x:
            if atual == 0:
                atual_ini = i
            atual += 1
            if atual > melhor:
                melhor, ini, fim = atual, atual_ini, i + 1
        else:
            atual = 0
    return melhor, ini, fim


def carregar_tinta(path: str, limiar: int = 190) -> np.ndarray:
    g = np.asarray(Image.open(path).convert("L"))
    return g < limiar


def detectar_eixos(tinta: np.ndarray, minimo_frac: float = 0.22) -> tuple[list[Eixo], list[Eixo]]:
    """Eixos quase verticais/horizontais por maior run continuo de tinta."""
    h, w = tinta.shape
    vdados = [_maior_run(tinta[:, x]) for x in range(w)]
    hdados = [_maior_run(tinta[y, :]) for y in range(h)]
    vcs = [x for x, (n, _, _) in enumerate(vdados) if n >= h * minimo_frac]
    hrs = [y for y, (n, _, _) in enumerate(hdados) if n >= w * minimo_frac]

    def monta(grupos: list[list[int]], dados: list[tuple[int, int, int]], total: int) -> list[Eixo]:
        out = []
        for g in grupos:
            p = int(round(float(np.mean(g))))
            melhor = max((dados[i] for i in g), key=lambda z: z[0])
            n, a, b = melhor
            out.append(Eixo(p, a, b, n / max(total, 1)))
        return out

    return monta(_grupos(vcs), vdados, h), monta(_grupos(hrs), hdados, w)


def _cobertura_borda(tinta: np.ndarray, x0: int, y0: int, x1: int, y1: int, banda: int = 3) -> float:
    h, w = tinta.shape
    if x0 == x1:
        xa, xb = max(0, x0-banda), min(w, x0+banda+1)
        ya, yb = max(0, min(y0, y1)), min(h, max(y0, y1)+1)
    else:
        ya, yb = max(0, y0-banda), min(h, y0+banda+1)
        xa, xb = max(0, min(x0, x1)), min(w, max(x0, x1)+1)
    sub = tinta[ya:yb, xa:xb]
    if not sub.size:
        return 0.0
    # Uma borda grossa nao precisa preencher a banda inteira: para cada passo,
    # basta haver tinta em algum pixel transversal.
    if x0 == x1:
        return float(np.mean(np.any(sub, axis=1))) if sub.shape[0] else 0.0
    return float(np.mean(np.any(sub, axis=0))) if sub.shape[1] else 0.0


def detectar_comodos(tinta: np.ndarray, xs: list[Eixo], ys: list[Eixo],
                     px_por_m: float, cobertura_min: float = 0.58) -> list[dict]:
    """Sugere retangulos fechados entre eixos adjacentes. Nao nomeia comodos."""
    xv = sorted(e.pos for e in xs)
    yv = sorted(e.pos for e in ys)
    out = []
    for x0, x1 in zip(xv, xv[1:]):
        if x1 - x0 < 24:
            continue
        for y0, y1 in zip(yv, yv[1:]):
            if y1 - y0 < 24:
                continue
            cov = [
                _cobertura_borda(tinta, x0, y0, x1, y0),
                _cobertura_borda(tinta, x1, y0, x1, y1),
                _cobertura_borda(tinta, x0, y1, x1, y1),
                _cobertura_borda(tinta, x0, y0, x0, y1),
            ]
            conf = min(cov)
            if conf < cobertura_min:
                continue
            area = (x1-x0) * (y1-y0) / max(px_por_m*px_por_m, 1e-9)
            out.append({
                "nome": None,
                "px": [x0, y0, x1, y1],
                "area_m2_estimada": round(area, 2),
                "confianca": round(conf, 3),
                "confirmado": False,
            })
    return out


def parse_ref(s: str) -> tuple[float, float, float, float]:
    p = [float(x.strip()) for x in s.split(",")]
    if len(p) != 4:
        raise ValueError("--ref exige x0,y0,x1,y1")
    return p[0], p[1], p[2], p[3]


def analisar(path: str, ref: tuple[float, float, float, float], metros: float,
            saida: str | None = None, limiar: int = 190) -> dict:
    if metros <= 0:
        raise ValueError("--metros precisa ser > 0")
    x0, y0, x1, y1 = ref
    dist = math.hypot(x1-x0, y1-y0)
    if dist < 5:
        raise ValueError("referencia em pixels curta demais")
    px_por_m = dist / metros
    tinta = carregar_tinta(path, limiar)
    xs, ys = detectar_eixos(tinta)
    comodos = detectar_comodos(tinta, xs, ys, px_por_m)
    obj = {
        "schema": "croqui-intermediario-v1",
        "status": "revisao_obrigatoria",
        "imagem": os.path.abspath(path),
        "escala": {
            "px_por_m": round(px_por_m, 6),
            "metros_referencia": metros,
            "segmento_px": [x0, y0, x1, y1],
            "conferida_por": "medida_fornecida",
        },
        "paredes_detectadas": {
            "verticais": [e.__dict__ for e in xs],
            "horizontais": [e.__dict__ for e in ys],
        },
        "comodos": comodos,
        "portas": [],
        "janelas": [],
        "incertezas": [
            "MVP aceita croqui aproximadamente ortogonal; paredes diagonais ainda exigem correcao manual.",
            "Nomes de comodos, portas e janelas precisam ser conferidos/cadastrados antes da exportacao.",
            "Nenhum dado deste arquivo pode ser publicado sem revisao.",
        ],
    }
    destino = saida or os.path.join(os.path.dirname(os.path.abspath(path)), "croqui.intermediario.json")
    with open(destino, "w", encoding="utf-8") as fp:
        json.dump(obj, fp, ensure_ascii=False, indent=2)
    return obj


def exportar(path: str, unidade_id: str, saida: str | None = None) -> dict:
    with open(path, encoding="utf-8") as fp:
        src = json.load(fp)
    if src.get("schema") != "croqui-intermediario-v1":
        raise ValueError("schema de croqui desconhecido")
    escala = float(src.get("escala", {}).get("px_por_m") or 0)
    if escala <= 0:
        raise ValueError("croqui sem escala valida")

    comodos = []
    for c in src.get("comodos", []):
        if not c.get("confirmado"):
            continue
        if not c.get("nome"):
            raise ValueError("todo comodo confirmado precisa de nome")
        comodos.append({
            "nome": c["nome"],
            "px": c["px"],
            # Area rotulada e opcional: extrair_planta usa a escala conhecida.
            **({"area_rotulada": c["area_rotulada"]} if c.get("area_rotulada") is not None else {}),
            **({"piso": c["piso"]} if c.get("piso") else {}),
        })
    if not comodos:
        raise ValueError("nenhum comodo confirmado")

    leitura = {
        "id": unidade_id,
        "imagem": src.get("imagem"),
        "escala_px_por_m": escala,
        "escala_origem": "croqui:medida_fornecida",
        "comodos": comodos,
        "portas": src.get("portas", []),
        "janelas": src.get("janelas", []),
        "pe_direito": src.get("pe_direito", 2.70),
        "cores": src.get("cores", {}),
        "_croqui_intermediario": os.path.abspath(path),
    }
    destino = saida or os.path.join(os.path.dirname(os.path.abspath(path)), "leitura.croqui.json")
    with open(destino, "w", encoding="utf-8") as fp:
        json.dump(leitura, fp, ensure_ascii=False, indent=2)
    return leitura


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    sub = ap.add_subparsers(dest="cmd", required=True)
    a = sub.add_parser("analisar")
    a.add_argument("imagem")
    a.add_argument("--ref", required=True, help="x0,y0,x1,y1 do segmento com medida conhecida")
    a.add_argument("--metros", type=float, required=True)
    a.add_argument("--saida")
    a.add_argument("--limiar", type=int, default=190)
    e = sub.add_parser("exportar")
    e.add_argument("intermediario")
    e.add_argument("--id", required=True)
    e.add_argument("--saida")
    ns = ap.parse_args(argv)

    if ns.cmd == "analisar":
        obj = analisar(ns.imagem, parse_ref(ns.ref), ns.metros, ns.saida, ns.limiar)
        print("paredes: %d verticais, %d horizontais; comodos sugeridos: %d" % (
            len(obj["paredes_detectadas"]["verticais"]),
            len(obj["paredes_detectadas"]["horizontais"]),
            len(obj["comodos"])))
        print("->", ns.saida or os.path.join(os.path.dirname(os.path.abspath(ns.imagem)),
                                             "croqui.intermediario.json"))
        return 0
    exportar(ns.intermediario, ns.id, ns.saida)
    print("->", ns.saida or os.path.join(os.path.dirname(os.path.abspath(ns.intermediario)),
                                         "leitura.croqui.json"))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Gerador de relatório HTML de viabilidade urbanística (A4, pronto para impressão).

Uso:
    python -I -X utf8 viabilidade/relatorio/relatorio.py --estudo X.json --saida Y.html

Regras atendidas:
- Somente biblioteca padrão do Python, sem acesso à internet (CSS e SVG embutidos).
- Uma página A4 de capa (comparação lado a lado + dados do lote/zona/conferência)
  seguida de uma página A4 por opção, na ordem da seção 7 de ESTUDO-REAL.md.
- Todos os números vêm diretamente do estudo.json, sem inventar nada.
- Premissas que vieram do padrão (premissas.padrao) aparecem marcadas com "padrão".
- Separação explícita e destacada entre "números da zona conferidos na lei"
  (zona.conferido) e "o terreno está nessa zona" (lote.zona_conferida / zona_origem).
- Alertas, áreas especiais e incertezas em destaque.
- Planta de implantação 2D e vista 3D axonométrica em SVG para cada opção,
  desenhadas diretamente a partir das coordenadas UTM do JSON.
"""

from __future__ import annotations

import argparse
import html
import json
import math
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple


RODAPE_FIXO = (
    "Estudo preliminar automático. Não substitui o arquiteto responsável "
    "nem garante aprovação na prefeitura."
)

NOMES_PREMISSAS: Dict[str, Tuple[str, str]] = {
    "area_privativa_por_unidade_m2": ("Tipologia (área privativa por unidade)", "m²"),
    "vagas_por_unidade": ("Vagas por unidade", "vaga/un."),
    "area_por_vaga_m2": ("Área por vaga (com circulação)", "m²"),
    "garagem": ("Tipo de garagem", ""),
    "subsolos_max": ("Subsolos máximos", "subsolos"),
    "garagem_computavel": ("Garagem computável no CA", ""),
    "pe_direito_m": ("Pé-direito tipo", "m"),
    "pe_direito_terreo_m": ("Pé-direito térreo", "m"),
    "eficiencia": ("Eficiência (privativa ÷ construída)", ""),
    "area_comum_por_pavimento_m2": ("Área comum por pavimento", "m²"),
    "nucleo_nao_computavel_m2": ("Núcleo não computável por pavimento", "m²"),
    "recuo_frontal_m": ("Recuo frontal adotado", "m"),
    "preco_venda_m2_privativo": ("Preço de venda por m² privativo", "R$/m²"),
    "laje_torre_max_m2": ("Laje máxima de torre", "m²"),
    "laje_minima_m2": ("Laje mínima", "m²"),
    "afastamento_entre_torres_m": ("Afastamento entre torres", "m"),
    "pavimentos_lamina_max": ("Pavimentos máximos na lâmina", "pav."),
    "pavimentos_embasamento": ("Pavimentos no embasamento", "pav."),
    "pavimentos_sem_ca": ("Pavimentos limite quando sem CA", "pav."),
    "embasamento_ocupacao": ("Ocupação do embasamento", ""),
}

DESCRICAO_ZONA_ORIGEM: Dict[str, str] = {
    "oficial": "Mapa digital oficial",
    "anotada_a_mao": "Anotada à mão (lida no anexo em PDF)",
    "teste": "Teste (escolhida só para testar)",
}


def esc(texto: Any) -> str:
    """Escapa texto para HTML seguro."""
    if texto is None:
        return ""
    return html.escape(str(texto), quote=True)


def formatar_numero_ptbr(valor: Any, casas_min: int = 0) -> str:
    """
    Formata um número (int ou float) no padrão brasileiro (ponto para milhar,
    vírgula para decimal), preservando todas as casas decimais significativas
    do JSON para nunca perder precisão.
    """
    if isinstance(valor, bool) or valor is None:
        return "—"
    if isinstance(valor, int):
        s_int = f"{abs(valor):,}".replace(",", ".")
        s = f"-{s_int}" if valor < 0 else s_int
        if casas_min > 0:
            s += "," + ("0" * casas_min)
        return s
    if isinstance(valor, float):
        negativo = valor < 0
        v_abs = abs(valor)
        bruto = repr(v_abs)
        if "e" in bruto or "E" in bruto:
            bruto = f"{v_abs:.8f}".rstrip("0").rstrip(".")
        if "." in bruto:
            parte_int_str, parte_dec_str = bruto.split(".", 1)
        else:
            parte_int_str, parte_dec_str = bruto, ""
        parte_dec_str = parte_dec_str.rstrip("0")
        min_dec = max(casas_min, 1 if isinstance(valor, float) else 0)
        if len(parte_dec_str) < min_dec:
            parte_dec_str = parte_dec_str.ljust(min_dec, "0")
        parte_int = int(parte_int_str) if parte_int_str else 0
        s_int = f"{parte_int:,}".replace(",", ".")
        s = f"{s_int},{parte_dec_str}" if parte_dec_str else s_int
        return f"-{s}" if negativo else s
    return str(valor)


def span_num(
    campo: str,
    valor: Any,
    unidade: str = "",
    casas_min: int = 0,
    classe_extra: str = "",
) -> str:
    """
    Embrulha um número do JSON em um <span class="num"> com atributos
    data-campo e data-valor exatos para conferência automatizada.
    """
    classes = "num" + (f" {classe_extra}" if classe_extra else "")
    if valor is None:
        return (
            f'<span class="{esc(classes)} num-nulo" '
            f'data-campo="{esc(campo)}" data-valor="null">—</span>'
        )
    if isinstance(valor, bool):
        texto_bool = "Sim" if valor else "Não"
        val_raw = "true" if valor else "false"
        return (
            f'<span class="{esc(classes)} num-bool" '
            f'data-campo="{esc(campo)}" data-valor="{val_raw}">{texto_bool}</span>'
        )
    texto_fmt = formatar_numero_ptbr(valor, casas_min=casas_min)
    sufixo = f"\u00a0{esc(unidade)}" if unidade else ""
    return (
        f'<span class="{esc(classes)}" '
        f'data-campo="{esc(campo)}" data-valor="{esc(repr(valor) if isinstance(valor, float) else str(valor))}">'
        f"{esc(texto_fmt)}</span>{sufixo}"
    )


def calcular_area_poligono(pts: Sequence[Sequence[float]]) -> float:
    """Calcula a área plana 2D (fórmula de Gauss/Shoelace) a partir de coordenadas UTM."""
    n = len(pts)
    if n < 3:
        return 0.0
    soma = 0.0
    for i in range(n):
        x1, y1 = pts[i][0], pts[i][1]
        x2, y2 = pts[(i + 1) % n][0], pts[(i + 1) % n][1]
        soma += x1 * y2 - x2 * y1
    return 0.5 * abs(soma)


def _coletar_pontos_estudo(
    lote: Dict[str, Any],
    caixa_maxima: Dict[str, Any],
    opcao: Dict[str, Any],
) -> List[Tuple[float, float]]:
    pontos: List[Tuple[float, float]] = []
    for p in lote.get("poligono_utm") or []:
        if len(p) >= 2:
            pontos.append((float(p[0]), float(p[1])))
    for p in caixa_maxima.get("projecao_utm") or []:
        if len(p) >= 2:
            pontos.append((float(p[0]), float(p[1])))
    for p in caixa_maxima.get("projecao_parede_cega_utm") or []:
        if len(p) >= 2:
            pontos.append((float(p[0]), float(p[1])))
    for v in opcao.get("volumes") or []:
        for p in v.get("base_utm") or []:
            if len(p) >= 2:
                pontos.append((float(p[0]), float(p[1])))
    return pontos


def gerar_svg_planta(
    lote: Dict[str, Any],
    caixa_maxima: Dict[str, Any],
    opcao: Dict[str, Any],
    largura: int = 340,
    altura: int = 250,
    compacto: bool = False,
) -> str:
    """
    Gera o SVG da planta de implantação (projeção dos volumes sobre o lote)
    diretamente das coordenadas UTM do estudo.json.
    """
    pontos = _coletar_pontos_estudo(lote, caixa_maxima, opcao)
    if not pontos:
        return (
            f'<svg class="svg-planta" viewBox="0 0 {largura} {altura}" '
            f'width="{largura}" height="{altura}" xmlns="http://www.w3.org/2000/svg">'
            '<text x="50%" y="50%" text-anchor="middle" font-size="11">Sem coordenadas</text>'
            "</svg>"
        )

    xs = [p[0] for p in pontos]
    ys = [p[1] for p in pontos]
    min_x, max_x = min(xs), max(xs)
    min_y, max_y = min(ys), max(ys)
    span_x = max(max_x - min_x, 1.0)
    span_y = max(max_y - min_y, 1.0)

    pad_top = 18 if compacto else 26
    pad_bottom = 20 if compacto else 34
    pad_left = 18 if compacto else 26
    pad_right = 18 if compacto else 26

    util_w = max(largura - pad_left - pad_right, 40)
    util_h = max(altura - pad_top - pad_bottom, 40)
    escala = min(util_w / span_x, util_h / span_y)

    desenho_w = span_x * escala
    desenho_h = span_y * escala
    off_x = pad_left + (util_w - desenho_w) / 2.0
    off_y = pad_top + (util_h - desenho_h) / 2.0

    def proj(pt: Sequence[float]) -> Tuple[float, float]:
        px = off_x + (float(pt[0]) - min_x) * escala
        py = off_y + (max_y - float(pt[1])) * escala
        return (px, py)

    def fmt_pts(seq: Sequence[Sequence[float]]) -> str:
        return " ".join(f"{proj(p)[0]:.2f},{proj(p)[1]:.2f}" for p in seq)

    partes: List[str] = []
    id_suf = esc(f"{lote.get('id', 'lote')}-{opcao.get('id', 'op')}-{'mini' if compacto else 'full'}")
    partes.append(
        f'<svg class="svg-planta" data-opcao="{esc(opcao.get("id"))}" '
        f'viewBox="0 0 {largura} {altura}" width="100%" height="{altura}" '
        f'xmlns="http://www.w3.org/2000/svg" role="img" '
        f'aria-label="Planta de implantação da opção {esc(opcao.get("id"))}">'
    )
    partes.append(
        f"<defs>"
        f'<pattern id="hachura-subsolo-{id_suf}" width="6" height="6" '
        f'patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">'
        f'<line x1="0" y1="0" x2="0" y2="6" stroke="#64748b" stroke-width="1.2" stroke-opacity="0.45"/>'
        f"</pattern>"
        f"</defs>"
    )

    # Fundo suave
    partes.append(
        f'<rect x="0" y="0" width="{largura}" height="{altura}" rx="4" '
        f'fill="#f8fafc" stroke="#e2e8f0" stroke-width="1"/>'
    )

    # 1. Polígono do Lote (área permeável / terreno)
    pol_lote = lote.get("poligono_utm") or []
    if len(pol_lote) >= 3:
        partes.append(
            f'<polygon class="planta-lote" points="{fmt_pts(pol_lote)}" '
            f'fill="#e6f4ea" stroke="#1e6b3b" stroke-width="1.8" stroke-linejoin="round">'
            f"<title>Lote {esc(lote.get('id'))} ({formatar_numero_ptbr(lote.get('area_m2'))} m²)</title>"
            f"</polygon>"
        )

    # 2. Envelope de parede cega (se existir)
    pol_cega = caixa_maxima.get("projecao_parede_cega_utm") or []
    if len(pol_cega) >= 3:
        partes.append(
            f'<polygon class="planta-parede-cega" points="{fmt_pts(pol_cega)}" '
            f'fill="none" stroke="#94a3b8" stroke-width="1" stroke-dasharray="2,2">'
            f"<title>Limite parede cega na divisa</title></polygon>"
        )

    # 3. Projeção da Caixa Máxima (recuos da lei/premissa)
    pol_caixa = caixa_maxima.get("projecao_utm") or []
    if len(pol_caixa) >= 3:
        partes.append(
            f'<polygon class="planta-caixa-maxima" points="{fmt_pts(pol_caixa)}" '
            f'fill="#ffffff" fill-opacity="0.45" stroke="#475569" '
            f'stroke-width="1.2" stroke-dasharray="5,3" stroke-linejoin="round">'
            f"<title>Projeção da caixa máxima (recuos)</title></polygon>"
        )

    # 4. Volumes da opção: primeiro subsolo/garagem, depois embasamento, depois residencial
    ordem_uso = {"garagem": 0, "embasamento": 1, "comercial": 2, "residencial": 3}
    volumes_ordenados = sorted(
        enumerate(opcao.get("volumes") or []),
        key=lambda item: (ordem_uso.get(str(item[1].get("uso", "")), 2), float(item[1].get("z0_m", 0.0))),
    )

    estilos_uso = {
        "garagem": (f"url(#hachura-subsolo-{id_suf})", "#475569", "4,2", "1.3", "Subsolo / Garagem"),
        "embasamento": ("#f59e0b", "#b45309", "", "1.5", "Embasamento"),
        "comercial": ("#10b981", "#047857", "", "1.5", "Comercial"),
        "residencial": ("#2563eb", "#1e3a8a", "", "1.8", "Residencial"),
    }

    for idx_vol, vol in volumes_ordenados:
        base = vol.get("base_utm") or []
        if len(base) < 3:
            continue
        uso = str(vol.get("uso", "residencial"))
        fill, stroke, dash, sw, rotulo_uso = estilos_uso.get(
            uso, ("#3b82f6", "#1d4ed8", "", "1.6", uso.capitalize())
        )
        fill_op = "0.85" if uso == "garagem" else ("0.55" if uso == "embasamento" else "0.72")
        dash_attr = f' stroke-dasharray="{dash}"' if dash else ""
        pavs = vol.get("pavimentos", 0)
        alt_v = vol.get("altura_m", 0)
        z0_v = vol.get("z0_m", 0)
        partes.append(
            f'<polygon class="planta-volume planta-volume-{esc(uso)}" '
            f'data-volume-idx="{idx_vol}" data-uso="{esc(uso)}" '
            f'points="{fmt_pts(base)}" fill="{fill}" fill-opacity="{fill_op}" '
            f'stroke="{stroke}" stroke-width="{sw}"{dash_attr} stroke-linejoin="round">'
            f"<title>{esc(rotulo_uso)}: {pavs} pav., h={formatar_numero_ptbr(alt_v)} m (z0={formatar_numero_ptbr(z0_v)} m)</title>"
            f"</polygon>"
        )

        # Rótulo no centroide do volume acima do solo (quando não for compacto)
        if not compacto and uso != "garagem":
            cx = sum(proj(p)[0] for p in base) / len(base)
            cy = sum(proj(p)[1] for p in base) / len(base)
            texto_curto = f"{pavs}p ({formatar_numero_ptbr(alt_v)}m)"
            partes.append(
                f'<text x="{cx:.1f}" y="{cy:.1f}" text-anchor="middle" '
                f'dominant-baseline="central" font-family="sans-serif" '
                f'font-size="8.5" font-weight="700" fill="#ffffff" '
                f'stroke="#0f172a" stroke-width="2" paint-order="stroke">'
                f"{esc(texto_curto)}</text>"
            )

    # 5. Frente do lote (acesso / rua)
    frente = lote.get("frente") or []
    if len(frente) >= 2:
        p1 = proj(frente[0])
        p2 = proj(frente[1])
        partes.append(
            f'<line class="planta-frente" x1="{p1[0]:.2f}" y1="{p1[1]:.2f}" '
            f'x2="{p2[0]:.2f}" y2="{p2[1]:.2f}" stroke="#dc2626" '
            f'stroke-width="{3.0 if compacto else 3.8}" stroke-linecap="round">'
            f"<title>Frente do lote (acesso)</title></line>"
        )
        if not compacto:
            mx = (p1[0] + p2[0]) / 2.0
            my = (p1[1] + p2[1]) / 2.0
            partes.append(
                f'<text x="{mx:.1f}" y="{my - 5:.1f}" text-anchor="middle" '
                f'font-family="sans-serif" font-size="8" font-weight="700" '
                f'fill="#b91c1c" stroke="#ffffff" stroke-width="2.2" paint-order="stroke">'
                f"FRENTE / ACESSO</text>"
            )

    # 6. Norte e barra de escala métrica
    partes.append(
        f'<g transform="translate({largura - 20}, 16)">'
        f'<line x1="0" y1="8" x2="0" y2="-4" stroke="#0f172a" stroke-width="1.5"/>'
        f'<polygon points="0,-7 -3.5,-1 3.5,-1" fill="#0f172a"/>'
        f'<text x="0" y="16" text-anchor="middle" font-family="sans-serif" '
        f'font-size="7.5" font-weight="700" fill="#0f172a">N</text>'
        f"</g>"
    )

    # Barra de escala automática (5 m, 10 m ou 20 m)
    metros_candidatos = [5, 10, 20, 50]
    barra_m = 10
    for m_cand in metros_candidatos:
        if 22 <= m_cand * escala <= 85:
            barra_m = m_cand
            break
    barra_px = barra_m * escala
    bx = 12.0
    by = altura - 8.0
    partes.append(
        f'<g class="planta-escala">'
        f'<line x1="{bx:.1f}" y1="{by:.1f}" x2="{bx + barra_px:.1f}" y2="{by:.1f}" '
        f'stroke="#0f172a" stroke-width="2"/>'
        f'<line x1="{bx:.1f}" y1="{by - 3:.1f}" x2="{bx:.1f}" y2="{by + 3:.1f}" '
        f'stroke="#0f172a" stroke-width="1.5"/>'
        f'<line x1="{bx + barra_px:.1f}" y1="{by - 3:.1f}" x2="{bx + barra_px:.1f}" y2="{by + 3:.1f}" '
        f'stroke="#0f172a" stroke-width="1.5"/>'
        f'<text x="{bx + barra_px / 2.0:.1f}" y="{by - 4:.1f}" text-anchor="middle" '
        f'font-family="sans-serif" font-size="7.5" font-weight="600" fill="#0f172a">'
        f"{barra_m} m</text>"
        f"</g>"
    )

    if not compacto:
        partes.append(
            f'<text x="10" y="13" font-family="sans-serif" font-size="8.5" '
            f'font-weight="700" fill="#334155">IMPLANTAÇÃO (PROJEÇÃO UTM)</text>'
        )

    partes.append("</svg>")
    return "".join(partes)


def gerar_svg_vista_3d(
    lote: Dict[str, Any],
    caixa_maxima: Dict[str, Any],
    opcao: Dict[str, Any],
    largura: int = 340,
    altura: int = 250,
    compacto: bool = False,
) -> str:
    """
    Gera o SVG da vista 3D axonométrica da opção dentro da caixa máxima transparente,
    calculada diretamente das coordenadas UTM (x, y) e cotas (z0_m, altura_m).
    """
    pontos_2d = _coletar_pontos_estudo(lote, caixa_maxima, opcao)
    if not pontos_2d:
        return (
            f'<svg class="svg-vista3d" viewBox="0 0 {largura} {altura}" '
            f'width="{largura}" height="{altura}" xmlns="http://www.w3.org/2000/svg"></svg>'
        )

    xs = [p[0] for p in pontos_2d]
    ys = [p[1] for p in pontos_2d]
    cx = 0.5 * (min(xs) + max(xs))
    cy = 0.5 * (min(ys) + max(ys))

    # Ângulo axonométrico suave para destacar tanto fachada quanto profundidade
    ang = math.radians(32.0)
    cos_a = math.cos(ang)
    sin_a = math.sin(ang)
    inclinacao_y = 0.52

    def iso_raw(x: float, y: float, z: float) -> Tuple[float, float]:
        dx = x - cx
        dy = y - cy
        u = dx * cos_a - dy * sin_a
        v = -(dx * sin_a + dy * cos_a) * inclinacao_y - z * 0.92
        return (u, v)

    # Coletar todos os vértices 3D para enquadrar a caixa de visualização
    amostras_3d: List[Tuple[float, float]] = []
    alt_caixa = float(caixa_maxima.get("altura_m") or 0.0)
    for p in lote.get("poligono_utm") or []:
        amostras_3d.append(iso_raw(float(p[0]), float(p[1]), 0.0))
    for p in caixa_maxima.get("projecao_utm") or []:
        amostras_3d.append(iso_raw(float(p[0]), float(p[1]), 0.0))
        amostras_3d.append(iso_raw(float(p[0]), float(p[1]), alt_caixa))
    for v in opcao.get("volumes") or []:
        z0 = float(v.get("z0_m") or 0.0)
        z1 = z0 + float(v.get("altura_m") or 0.0)
        for p in v.get("base_utm") or []:
            amostras_3d.append(iso_raw(float(p[0]), float(p[1]), z0))
            amostras_3d.append(iso_raw(float(p[0]), float(p[1]), z1))

    us = [uv[0] for uv in amostras_3d]
    vs = [uv[1] for uv in amostras_3d]
    min_u, max_u = min(us), max(us)
    min_v, max_v = min(vs), max(vs)
    span_u = max(max_u - min_u, 1.0)
    span_v = max(max_v - min_v, 1.0)

    pad_x = 16 if compacto else 24
    pad_top = 16 if compacto else 24
    pad_bottom = 14 if compacto else 22
    util_w = max(largura - 2 * pad_x, 40)
    util_h = max(altura - pad_top - pad_bottom, 40)
    escala = min(util_w / span_u, util_h / span_v)

    off_u = pad_x + (util_w - span_u * escala) / 2.0
    off_v = pad_top + (util_h - span_v * escala) / 2.0

    def proj3d(x: float, y: float, z: float) -> Tuple[float, float]:
        u, v = iso_raw(x, y, z)
        return (off_u + (u - min_u) * escala, off_v + (v - min_v) * escala)

    def fmt_poly3d(pts: Sequence[Sequence[float]], z: float) -> str:
        return " ".join(f"{proj3d(float(p[0]), float(p[1]), z)[0]:.2f},{proj3d(float(p[0]), float(p[1]), z)[1]:.2f}" for p in pts)

    partes: List[str] = []
    partes.append(
        f'<svg class="svg-vista3d" data-opcao="{esc(opcao.get("id"))}" '
        f'viewBox="0 0 {largura} {altura}" width="100%" height="{altura}" '
        f'xmlns="http://www.w3.org/2000/svg" role="img" '
        f'aria-label="Vista 3D axonométrica da opção {esc(opcao.get("id"))}">'
    )
    partes.append(
        f'<rect x="0" y="0" width="{largura}" height="{altura}" rx="4" '
        f'fill="#f8fafc" stroke="#e2e8f0" stroke-width="1"/>'
    )

    # 1. Base do lote em z = 0
    pol_lote = lote.get("poligono_utm") or []
    if len(pol_lote) >= 3:
        partes.append(
            f'<polygon points="{fmt_poly3d(pol_lote, 0.0)}" '
            f'fill="#dcfce7" fill-opacity="0.7" stroke="#15803d" stroke-width="1.4"/>'
        )

    # Frente do lote em z = 0
    frente = lote.get("frente") or []
    if len(frente) >= 2:
        f1 = proj3d(float(frente[0][0]), float(frente[0][1]), 0.0)
        f2 = proj3d(float(frente[1][0]), float(frente[1][1]), 0.0)
        partes.append(
            f'<line x1="{f1[0]:.2f}" y1="{f1[1]:.2f}" x2="{f2[0]:.2f}" y2="{f2[1]:.2f}" '
            f'stroke="#dc2626" stroke-width="2.6" stroke-linecap="round"/>'
        )

    # Função auxiliar para desenhar um prisma 3D extrudado
    def desenhar_prisma(
        base: Sequence[Sequence[float]],
        z0: float,
        z1: float,
        cor_topo: str,
        cor_lado_claro: str,
        cor_lado_escuro: str,
        cor_borda: str,
        opacidade: float = 0.85,
        tracejado: str = "",
    ) -> None:
        pts_limpos = list(base)
        if len(pts_limpos) > 3 and pts_limpos[0] == pts_limpos[-1]:
            pts_limpos = pts_limpos[:-1]
        n = len(pts_limpos)
        if n < 3:
            return

        # Ordenar faces laterais pela profundidade média (algoritmo do pintor)
        faces_laterais = []
        for i in range(n):
            p_a = pts_limpos[i]
            p_b = pts_limpos[(i + 1) % n]
            _, va0 = iso_raw(float(p_a[0]), float(p_a[1]), z0)
            _, vb0 = iso_raw(float(p_b[0]), float(p_b[1]), z0)
            profundidade = 0.5 * (va0 + vb0)
            ua, _ = proj3d(float(p_a[0]), float(p_a[1]), z0)
            ub, _ = proj3d(float(p_b[0]), float(p_b[1]), z0)
            cor_face = cor_lado_claro if ub >= ua else cor_lado_escuro
            q1 = proj3d(float(p_a[0]), float(p_a[1]), z0)
            q2 = proj3d(float(p_b[0]), float(p_b[1]), z0)
            q3 = proj3d(float(p_b[0]), float(p_b[1]), z1)
            q4 = proj3d(float(p_a[0]), float(p_a[1]), z1)
            faces_laterais.append((profundidade, [q1, q2, q3, q4], cor_face))

        faces_laterais.sort(key=lambda item: item[0])
        dash_attr = f' stroke-dasharray="{tracejado}"' if tracejado else ""

        for _, quad, cor_f in faces_laterais:
            pts_str = " ".join(f"{q[0]:.2f},{q[1]:.2f}" for q in quad)
            partes.append(
                f'<polygon points="{pts_str}" fill="{cor_f}" fill-opacity="{opacidade}" '
                f'stroke="{cor_borda}" stroke-width="0.9"{dash_attr} stroke-linejoin="round"/>'
            )

        # Topo do prisma
        partes.append(
            f'<polygon points="{fmt_poly3d(pts_limpos, z1)}" fill="{cor_topo}" '
            f'fill-opacity="{min(opacidade + 0.08, 0.96)}" stroke="{cor_borda}" '
            f'stroke-width="1.1"{dash_attr} stroke-linejoin="round"/>'
        )

    # 2. Volumes ordenados de baixo para cima e de trás para frente
    volumes_lista = list(opcao.get("volumes") or [])

    def chave_pintor_vol(v: Dict[str, Any]) -> Tuple[float, float]:
        z0 = float(v.get("z0_m") or 0.0)
        b = v.get("base_utm") or [[cx, cy]]
        v_med = sum(iso_raw(float(p[0]), float(p[1]), z0)[1] for p in b) / max(len(b), 1)
        return (z0, v_med)

    for vol in sorted(volumes_lista, key=chave_pintor_vol):
        base = vol.get("base_utm") or []
        z0 = float(vol.get("z0_m") or 0.0)
        z1 = z0 + float(vol.get("altura_m") or 0.0)
        uso = str(vol.get("uso", "residencial"))
        if uso == "garagem":
            desenhar_prisma(
                base, z0, z1,
                cor_topo="#cbd5e1", cor_lado_claro="#94a3b8", cor_lado_escuro="#64748b",
                cor_borda="#475569", opacidade=0.42, tracejado="3,2",
            )
        elif uso == "embasamento":
            desenhar_prisma(
                base, z0, z1,
                cor_topo="#fbbf24", cor_lado_claro="#f59e0b", cor_lado_escuro="#d97706",
                cor_borda="#92400e", opacidade=0.82,
            )
        else:
            desenhar_prisma(
                base, z0, z1,
                cor_topo="#60a5fa", cor_lado_claro="#3b82f6", cor_lado_escuro="#1d4ed8",
                cor_borda="#1e3a8a", opacidade=0.84,
            )

    # 3. Caixa máxima transparente por cima (envelope máximo da lei)
    pol_caixa = caixa_maxima.get("projecao_utm") or []
    if len(pol_caixa) >= 3 and alt_caixa > 0:
        pts_c = list(pol_caixa)
        if len(pts_c) > 3 and pts_c[0] == pts_c[-1]:
            pts_c = pts_c[:-1]
        # Base e topo tracejados + arestas verticais da caixa máxima transparente
        partes.append(
            f'<polygon class="vista3d-caixa-topo" points="{fmt_poly3d(pts_c, alt_caixa)}" '
            f'fill="#0ea5e9" fill-opacity="0.06" stroke="#0284c7" '
            f'stroke-width="1.0" stroke-dasharray="4,3"/>'
        )
        for p in pts_c:
            b_pt = proj3d(float(p[0]), float(p[1]), 0.0)
            t_pt = proj3d(float(p[0]), float(p[1]), alt_caixa)
            partes.append(
                f'<line x1="{b_pt[0]:.2f}" y1="{b_pt[1]:.2f}" '
                f'x2="{t_pt[0]:.2f}" y2="{t_pt[1]:.2f}" '
                f'stroke="#0284c7" stroke-width="0.8" stroke-opacity="0.55" stroke-dasharray="3,3"/>'
            )

    if not compacto:
        partes.append(
            f'<text x="10" y="13" font-family="sans-serif" font-size="8.5" '
            f'font-weight="700" fill="#334155">VISTA 3D + CAIXA MÁXIMA (h={formatar_numero_ptbr(alt_caixa)} m)</text>'
        )

    partes.append("</svg>")
    return "".join(partes)


def _semaforo_html(nivel: str, rotulo: str) -> str:
    """Retorna o selo de semáforo (verde / amarelo / vermelho / neutro)."""
    mapa_cores = {
        "verde": ("semaforo-verde", "OK"),
        "amarelo": ("semaforo-amarelo", "Atenção"),
        "vermelho": ("semaforo-vermelho", "Violado"),
        "neutro": ("semaforo-neutro", "Info"),
    }
    cls, padrao_txt = mapa_cores.get(nivel, ("semaforo-neutro", "Info"))
    txt = rotulo or padrao_txt
    return f'<span class="semaforo {cls}"><span class="semaforo-ponto"></span>{esc(txt)}</span>'


def _gerar_painel_conferencia(lote: Dict[str, Any], zona: Dict[str, Any], compacto: bool = False) -> str:
    """
    Gera o painel que separa explicitamente:
    1) Números da zona conferidos na lei (zona.conferido)
    2) O terreno está nessa zona (lote.zona_conferida e lote.zona_origem)
    """
    zona_conf = bool(zona.get("conferido"))
    lote_zona_conf = bool(lote.get("zona_conferida"))
    zona_origem_cod = str(lote.get("zona_origem") or "não informada")
    zona_origem_desc = DESCRICAO_ZONA_ORIGEM.get(zona_origem_cod, zona_origem_cod)

    cls_zona = "conf-ok" if zona_conf else "conf-pendente"
    txt_zona = "CONFERIDO NA LEI" if zona_conf else "NÃO CONFERIDO NA LEI"

    cls_lote = "conf-ok" if lote_zona_conf else "conf-alerta"
    txt_lote = "CONFERIDO" if lote_zona_conf else "NÃO CONFERIDO"

    anotacao = lote.get("anotacao_zoneamento") or {}
    zona_ambigua = bool(anotacao.get("zona_ambigua"))
    alternativas = anotacao.get("alternativas_zona_id") or []
    aviso_ambigua = ""
    if zona_ambigua or alternativas:
        alt_str = ", ".join(str(a) for a in alternativas) if alternativas else ""
        aviso_ambigua = (
            f'<div class="conf-subalerta"><strong>Zona ambígua:</strong> '
            f'alternativas {esc(alt_str)}.</div>'
        )

    fontes_resumo = []
    for f in zona.get("fontes") or []:
        lei_s = f.get("lei", "")
        art_s = f.get("artigo", "")
        data_s = f.get("data", "")
        fontes_resumo.append(f"{lei_s} ({art_s}, {data_s})")
    fontes_txt = "; ".join(fontes_resumo) if fontes_resumo else "Sem fonte informada"

    if compacto:
        return f"""
        <div class="conferencia-dupla conferencia-compacta">
          <div class="conf-card {cls_zona}">
            <div class="conf-titulo">1. Números da zona conferidos na lei (<code>zona.conferido</code>)</div>
            <div class="conf-valor">
              <span class="badge-conf">{txt_zona}</span>
              <span class="conf-detalhe">{span_num("zona.conferido", zona.get("conferido"))} — Zona <strong>{esc(zona.get("id"))}</strong> ({esc(zona.get("nome"))})</span>
            </div>
          </div>
          <div class="conf-card {cls_lote}">
            <div class="conf-titulo">2. O terreno está nessa zona? (<code>lote.zona_conferida</code>)</div>
            <div class="conf-valor">
              <span class="badge-conf">{txt_lote}</span>
              <span class="conf-detalhe">{span_num("lote.zona_conferida", lote.get("zona_conferida"))} — Origem: <strong>{esc(zona_origem_desc)}</strong> (<code>{esc(zona_origem_cod)}</code>)</span>
            </div>
            {aviso_ambigua}
          </div>
        </div>
        """

    return f"""
    <div class="conferencia-dupla">
      <div class="conf-card {cls_zona}">
        <div class="conf-titulo">1. Números da zona conferidos na lei (<code>zona.conferido</code>)</div>
        <div class="conf-valor">
          <span class="badge-conf">{txt_zona}</span>
          <span>Valor no JSON: {span_num("zona.conferido", zona.get("conferido"))}</span>
        </div>
        <div class="conf-explicacao">
          Os índices urbanísticos da zona <strong>{esc(zona.get("id"))} — {esc(zona.get("nome"))}</strong>
          {"foram conferidos no texto oficial da lei" if zona_conf else "NÃO foram conferidos no texto oficial da lei"}.
          <br/><small><strong>Fontes:</strong> {esc(fontes_txt)}</small>
        </div>
      </div>
      <div class="conf-card {cls_lote}">
        <div class="conf-titulo">2. O terreno está nessa zona? (<code>lote.zona_conferida</code>)</div>
        <div class="conf-valor">
          <span class="badge-conf">{txt_lote}</span>
          <span>Valor no JSON: {span_num("lote.zona_conferida", lote.get("zona_conferida"))} | Origem: <strong>{esc(zona_origem_desc)}</strong> (<code>{esc(zona_origem_cod)}</code>)</span>
        </div>
        <div class="conf-explicacao">
          <strong>Importante:</strong> "números da zona conferidos" ≠ "o terreno está nessa zona".
          O enquadramento do lote <strong>{esc(lote.get("id"))}</strong> na zona <strong>{esc(lote.get("zona_id"))}</strong>
          {"foi conferido em mapa/certidão oficial" if lote_zona_conf else "NÃO está conferido oficialmente e exige confirmação na prefeitura/matrícula"}.
        </div>
        {aviso_ambigua}
      </div>
    </div>
    """


def _extrair_resumo_lote(lote: Dict[str, Any]) -> str:
    """Extrai informações complementares do lote (loteamento, quadra, lid) se presentes no JSON."""
    partes = [f"ID: <strong>{esc(lote.get('id'))}</strong>"]
    if lote.get("lid") is not None:
        partes.append(f"LID: {span_num('lote.lid', lote.get('lid'))}")
    fonte = lote.get("fonte") or {}
    props = fonte.get("propriedades") or {}
    if not props and fonte.get("propriedades_componentes"):
        comp0 = (fonte.get("propriedades_componentes") or [{}])[0]
        props = comp0 if isinstance(comp0, dict) else {}
    loteamento = props.get("loteamento")
    quadra = props.get("quadra") or fonte.get("quadra")
    if loteamento:
        partes.append(f"Loteamento: <strong>{esc(loteamento)}</strong>")
    if quadra is not None:
        partes.append(f"Quadra: <strong>{esc(quadra)}</strong>")
    return " · ".join(partes)


def _gerar_capa_comparacao(estudo: Dict[str, Any]) -> str:
    """
    Gera a página de Capa com:
    - Identificação completa do Lote, Relevo, Zona e Versão do Motor
    - Painel separado de conferência (zona.conferido x lote.zona_conferida)
    - Tabela de comparação lado a lado de todas as opções com miniaturas 2D + 3D
    - Parâmetros da Zona e da Caixa Máxima
    - Áreas especiais, alertas e incertezas em destaque
    """
    versao_motor = estudo.get("versao_motor", "—")
    lote = estudo.get("lote") or {}
    zona = estudo.get("zona") or {}
    params = zona.get("parametros") or {}
    caixa = estudo.get("caixa_maxima") or {}
    premissas = estudo.get("premissas") or {}
    opcoes = estudo.get("opcoes") or []
    incertezas = estudo.get("incertezas") or []
    areas_especiais = lote.get("areas_especiais") or []

    datas_fontes = sorted({f.get("data", "") for f in (zona.get("fontes") or []) if f.get("data")})
    data_lei_str = ", ".join(datas_fontes) if datas_fontes else "—"

    # Bloco de relevo
    relevo = lote.get("relevo")
    if isinstance(relevo, dict) and relevo:
        relevo_html = (
            f"Cota mín.: {span_num('lote.relevo.cota_min_m', relevo.get('cota_min_m'), 'm')} · "
            f"Cota máx.: {span_num('lote.relevo.cota_max_m', relevo.get('cota_max_m'), 'm')} · "
            f"Declividade: {span_num('lote.relevo.declividade_pct', relevo.get('declividade_pct'), '%')} · "
            f"Resolução: {span_num('lote.relevo.resolucao_m', relevo.get('resolucao_m'), 'm')} "
            f"<small>({esc(relevo.get('fonte', ''))})</small>"
        )
    else:
        relevo_html = '<span class="texto-suave">Relevo não preenchido (considerado plano z=0 m)</span>'

    # Cabeçalhos das colunas de opções na tabela comparativa
    ths_opcoes = "".join(
        f'<th class="col-opcao">Opção {esc(op.get("id"))}<br/><span>{esc(op.get("nome"))}</span></th>'
        for op in opcoes
    )

    # Linha de miniaturas (Planta + 3D lado a lado em cada coluna)
    tds_miniaturas = []
    for op in opcoes:
        svg_p = gerar_svg_planta(lote, caixa, op, largura=155, altura=112, compacto=True)
        svg_3d = gerar_svg_vista_3d(lote, caixa, op, largura=155, altura=112, compacto=True)
        tds_miniaturas.append(
            f'<td class="cel-miniatura">'
            f'<div class="mini-dupla">'
            f'<div class="mini-item"><div class="mini-legenda">Implantação</div>{svg_p}</div>'
            f'<div class="mini-item"><div class="mini-legenda">Vista 3D</div>{svg_3d}</div>'
            f"</div></td>"
        )

    def linha_metrica(
        rotulo: str,
        chave: str,
        unidade: str = "",
        destaque: bool = False,
        eh_vgv: bool = False,
    ) -> str:
        cls_tr = ' class="linha-destaque"' if destaque else ""
        celulas = []
        for op in opcoes:
            oid = op.get("id")
            m = op.get("metricas") or {}
            val = m.get(chave)
            campo_id = f"opcoes.{oid}.metricas.{chave}"
            if eh_vgv and val is None:
                conteudo = (
                    f'<span class="num num-nulo" data-campo="{esc(campo_id)}" data-valor="null">'
                    f"informe o preço</span>"
                )
            else:
                conteudo = span_num(campo_id, val, unidade=unidade)
            celulas.append(f"<td>{conteudo}</td>")
        return f"<tr{cls_tr}><th>{esc(rotulo)}</th>{''.join(celulas)}</tr>"

    # Altura máxima atingida pelos volumes de cada opção
    celulas_altura = []
    for op in opcoes:
        oid = op.get("id")
        alt_max_op = max(
            [float(v.get("z0_m", 0.0)) + float(v.get("altura_m", 0.0)) for v in (op.get("volumes") or []) if float(v.get("z0_m", 0.0)) >= 0.0]
            or [0.0]
        )
        celulas_altura.append(
            f'<td>{span_num(f"opcoes.{oid}.altura_topo_m", alt_max_op, "m")}</td>'
        )

    # Alertas resumidos por opção na capa
    celulas_alertas = []
    for op in opcoes:
        als = op.get("alertas") or []
        itens = "".join(f"<li>{esc(a)}</li>" for a in als)
        celulas_alertas.append(f'<td class="cel-alertas"><ul class="lista-compacta">{itens}</ul></td>')

    # Áreas especiais em destaque
    bloco_areas_especiais = ""
    if areas_especiais:
        itens_ae = []
        for idx_ae, ae in enumerate(areas_especiais):
            itens_ae.append(
                f"<li><strong>{esc(ae.get('tipo'))} — {esc(ae.get('nome'))}:</strong> "
                f"{esc(ae.get('observacoes'))} "
                f"<small>(Fonte: {esc(ae.get('fonte'))} | Conferido: "
                f"{span_num(f'lote.areas_especiais.{idx_ae}.conferido', ae.get('conferido'))})</small></li>"
            )
        bloco_areas_especiais = f"""
        <div class="caixa-alerta caixa-perigo">
          <div class="caixa-alerta-titulo">Áreas Especiais / Restrições Sobrepostas no Lote</div>
          <ul class="lista-alertas">{''.join(itens_ae)}</ul>
        </div>
        """

    # Incertezas do estudo em destaque
    itens_incertezas = "".join(f"<li>{esc(inc)}</li>" for inc in incertezas)
    bloco_incertezas = f"""
    <div class="caixa-alerta caixa-incertezas">
      <div class="caixa-alerta-titulo">Incertezas e Limitações do Estudo ({len(incertezas)})</div>
      <ul class="lista-alertas">{itens_incertezas}</ul>
    </div>
    """

    return f"""
    <section class="pagina pagina-capa" id="capa">
      <header class="cabecalho-pagina">
        <div class="cab-esquerda">
          <div class="cab-tag">CAPA — COMPARAÇÃO DE OPÇÕES DE VIABILIDADE</div>
          <h1 class="cab-titulo">Estudo de Massa e Viabilidade — Lote {esc(lote.get("id"))}</h1>
          <div class="cab-subtitulo">
            {_extrair_resumo_lote(lote)} ·
            Área do lote: <strong>{span_num("lote.area_m2", lote.get("area_m2"), "m²")}</strong> ·
            Zona: <strong>{esc(zona.get("id"))} — {esc(zona.get("nome"))}</strong>
          </div>
        </div>
        <div class="cab-direita">
          <div>Motor v<strong>{esc(versao_motor)}</strong></div>
          <div>Leis de ref.: {esc(data_lei_str)}</div>
          <div>Opções geradas: <strong>{len(opcoes)}</strong></div>
        </div>
      </header>

      {_gerar_painel_conferencia(lote, zona, compacto=False)}

      <div class="grade-resumo-lote">
        <div class="card-info">
          <div class="card-info-titulo">Parâmetros da Zona ({esc(zona.get("id"))})</div>
          <div class="card-info-corpo">
            CA básico: <strong>{span_num("zona.parametros.ca_basico", params.get("ca_basico"))}</strong> ·
            CA máx.: <strong>{span_num("zona.parametros.ca_maximo", params.get("ca_maximo"))}</strong> ·
            TO máx.: <strong>{span_num("zona.parametros.taxa_ocupacao", params.get("taxa_ocupacao"))}</strong> ({formatar_numero_ptbr((params.get("taxa_ocupacao") or 0) * 100)}%) ·
            Permeab. mín.: <strong>{span_num("zona.parametros.taxa_permeabilidade", params.get("taxa_permeabilidade"))}</strong> ({formatar_numero_ptbr((params.get("taxa_permeabilidade") or 0) * 100)}%) ·
            Recuo frontal lei: <strong>{span_num("zona.parametros.recuo_frontal_m", params.get("recuo_frontal_m"), "m")}</strong> ·
            Recuo lat./fundos mín.: <strong>{span_num("zona.parametros.recuo_lateral_m", params.get("recuo_lateral_m"), "m")}</strong> / <strong>{span_num("zona.parametros.recuo_fundos_m", params.get("recuo_fundos_m"), "m")}</strong> ·
            Parede cega até: <strong>{span_num("zona.parametros.parede_cega_encosta_ate_m", params.get("parede_cega_encosta_ate_m"), "m")}</strong> ·
            Outorga onerosa: <strong>{span_num("zona.parametros.outorga_onerosa", params.get("outorga_onerosa"))}</strong>
          </div>
        </div>
        <div class="card-info">
          <div class="card-info-titulo">Caixa Máxima e Relevo do Terreno</div>
          <div class="card-info-corpo">
            Altura caixa máx.: <strong>{span_num("caixa_maxima.altura_m", caixa.get("altura_m"), "m")}</strong> ·
            Projeção máx.: <strong>{span_num("caixa_maxima.area_projecao_m2", caixa.get("area_projecao_m2"), "m²")}</strong> ·
            Ocupação máx. (TO): <strong>{span_num("caixa_maxima.ocupacao_max_m2", caixa.get("ocupacao_max_m2"), "m²")}</strong> ·
            Área computável máx. (CAM): <strong>{span_num("caixa_maxima.area_computavel_max_m2", caixa.get("area_computavel_max_m2"), "m²")}</strong> ·
            Recuo frontal usado: <strong>{span_num("caixa_maxima.recuo_frontal_m", caixa.get("recuo_frontal_m"), "m")}</strong>
            {"<span class='badge-padrao'>padrão</span>" if "recuo_frontal_m" in (premissas.get("padrao") or []) else ""}
            <br/>Relevo: {relevo_html}
          </div>
        </div>
      </div>

      <h2 class="secao-titulo">Comparação Lado a Lado das Opções</h2>
      <table class="tabela-comparacao">
        <thead>
          <tr>
            <th class="col-indicador">Indicador / Métrica</th>
            {ths_opcoes}
          </tr>
        </thead>
        <tbody>
          <tr class="linha-miniaturas">
            <th>Planta (2D) e Volumetria (3D)</th>
            {''.join(tds_miniaturas)}
          </tr>
          {linha_metrica("1. Unidades estimadas", "unidades_estimadas", "un.", destaque=True)}
          {linha_metrica("2. Área privativa vendável", "area_privativa_m2", "m²", destaque=True)}
          {linha_metrica("3. Vagas de garagem", "vagas", "vagas", destaque=True)}
          {linha_metrica("4. VGV estimado", "vgv_estimado", "R$", destaque=True, eh_vgv=True)}
          {linha_metrica("CA usado", "ca_usado", "", destaque=False)}
          {linha_metrica("Taxa de ocupação usada (TO)", "to_usada", "", destaque=False)}
          {linha_metrica("Pavimentos (acima do solo)", "pavimentos", "pav.", destaque=False)}
          <tr><th>Altura máxima no topo</th>{''.join(celulas_altura)}</tr>
          {linha_metrica("Área construída total", "area_construida_m2", "m²")}
          {linha_metrica("Área computável", "area_computavel_m2", "m²")}
          {linha_metrica("Área não computável", "area_nao_computavel_m2", "m²")}
          {linha_metrica("Área acima do CA básico (outorga)", "area_acima_ca_basico_m2", "m²")}
          {linha_metrica("Área de garagem", "area_garagem_m2", "m²")}
          {linha_metrica("Área permeável", "area_permeavel_m2", "m²")}
          <tr><th>Alertas da opção</th>{''.join(celulas_alertas)}</tr>
        </tbody>
      </table>

      {bloco_areas_especiais}
      {bloco_incertezas}

      <div class="observacoes-rodape">
        <div><strong>Observações do Lote:</strong> {esc(lote.get("observacoes") or "—")}</div>
        <div><strong>Observações da Zona:</strong> {esc(zona.get("observacoes") or "—")}</div>
      </div>

      <footer class="rodape-fixo">{esc(RODAPE_FIXO)}</footer>
    </section>
    """


def _gerar_pagina_opcao(estudo: Dict[str, Any], opcao: Dict[str, Any]) -> str:
    """
    Gera uma página A4 completa para uma opção, seguindo rigorosamente a ordem
    da seção 7 de viabilidade/produto/ESTUDO-REAL.md:
    1. Cabeçalho
    2. Imagem (vista 3D na caixa máxima transparente + implantação 2D ao lado)
    3. Os 4 números grandes (unidades, área privativa, vagas, VGV)
    4. Uso da lei (usado / permitido / folga + semáforo)
    5. Quadro de áreas resumido (por pavimento/volume + totais e eficiência)
    6. Premissas usadas (marcando "padrão" para premissas.padrao)
    7. Alertas e incertezas em destaque
    8. Rodapé fixo
    """
    oid = str(opcao.get("id", ""))
    nome_op = str(opcao.get("nome", ""))
    versao_motor = estudo.get("versao_motor", "—")
    lote = estudo.get("lote") or {}
    zona = estudo.get("zona") or {}
    params = zona.get("parametros") or {}
    caixa = estudo.get("caixa_maxima") or {}
    premissas = estudo.get("premissas") or {}
    padrao_set = set(premissas.get("padrao") or [])
    metricas = opcao.get("metricas") or {}
    volumes = opcao.get("volumes") or []
    alertas_op = opcao.get("alertas") or []
    incertezas = estudo.get("incertezas") or []
    areas_especiais = lote.get("areas_especiais") or []

    datas_fontes = sorted({f.get("data", "") for f in (zona.get("fontes") or []) if f.get("data")})
    leis_nomes = [f"{f.get('lei', '')} ({f.get('data', '')})" for f in (zona.get("fontes") or [])]

    # 2. Imagens SVG (Implantação 2D + Vista 3D com caixa máxima transparente)
    svg_planta = gerar_svg_planta(lote, caixa, opcao, largura=350, altura=215, compacto=False)
    svg_3d = gerar_svg_vista_3d(lote, caixa, opcao, largura=350, altura=215, compacto=False)

    # 3. Os 4 números grandes
    vgv_val = metricas.get("vgv_estimado")
    if vgv_val is None:
        vgv_html = (
            f'<span class="num num-nulo" data-campo="opcoes.{esc(oid)}.metricas.vgv_estimado" '
            f'data-valor="null">informe o preço</span>'
        )
        vgv_sub = "Preço de venda (R$/m²) não informado"
    else:
        vgv_html = f'R$ {span_num(f"opcoes.{oid}.metricas.vgv_estimado", vgv_val)}'
        vgv_sub = f'R$ {formatar_numero_ptbr(premissas.get("preco_venda_m2_privativo"))}/m² privativo'

    # 4. Uso da lei (CA, TO, Permeabilidade, Altura/Pavimentos, Recuos)
    area_lote = float(lote.get("area_m2") or caixa.get("area_lote_m2") or 1.0)
    ca_usado = float(metricas.get("ca_usado") or 0.0)
    ca_basico = params.get("ca_basico")
    ca_maximo = params.get("ca_maximo")
    acima_cab = float(metricas.get("area_acima_ca_basico_m2") or 0.0)

    if ca_maximo is not None:
        folga_ca = float(ca_maximo) - ca_usado
        folga_ca_txt = f"{formatar_numero_ptbr(round(folga_ca, 4))} de CA"
        if ca_usado > float(ca_maximo) + 1e-4:
            sem_ca = _semaforo_html("vermelho", "Acima do CAM")
        elif folga_ca <= 0.05 or acima_cab > 0:
            rot_ca = "No limite / Outorga" if folga_ca <= 0.05 else "Com outorga"
            sem_ca = _semaforo_html("amarelo", rot_ca)
        else:
            sem_ca = _semaforo_html("verde", "Até CA básico")
    else:
        folga_ca_txt = "Sem limite de CA"
        sem_ca = _semaforo_html("verde", "OK")

    to_usada = float(metricas.get("to_usada") or 0.0)
    to_max = params.get("taxa_ocupacao")
    if to_max is not None:
        folga_to = float(to_max) - to_usada
        folga_to_txt = f"{formatar_numero_ptbr(round(folga_to * 100, 2))} p.p. ({formatar_numero_ptbr(round(folga_to, 4))})"
        if to_usada > float(to_max) + 1e-4:
            sem_to = _semaforo_html("vermelho", "Acima da TO")
        elif folga_to <= 0.02:
            sem_to = _semaforo_html("amarelo", "No limite")
        else:
            sem_to = _semaforo_html("verde", "Com folga")
    else:
        folga_to_txt = "Sem limite"
        sem_to = _semaforo_html("verde", "OK")

    perm_m2 = float(metricas.get("area_permeavel_m2") or 0.0)
    perm_pct = perm_m2 / area_lote if area_lote > 0 else 0.0
    perm_min_taxa = params.get("taxa_permeabilidade")
    if perm_min_taxa is not None:
        perm_min_m2 = float(perm_min_taxa) * area_lote
        folga_perm_m2 = perm_m2 - perm_min_m2
        folga_perm_txt = f"+{formatar_numero_ptbr(round(folga_perm_m2, 2))} m² ({formatar_numero_ptbr(round(perm_pct * 100, 1))}%)"
        if folga_perm_m2 < -0.5:
            sem_perm = _semaforo_html("vermelho", "Abaixo do mín.")
        elif folga_perm_m2 <= 5.0:
            sem_perm = _semaforo_html("amarelo", "No limite")
        else:
            sem_perm = _semaforo_html("verde", "Atende")
    else:
        perm_min_m2 = 0.0
        folga_perm_txt = "—"
        sem_perm = _semaforo_html("verde", "OK")

    # Altura máxima e pavimentos
    alt_usada_m = max(
        [float(v.get("z0_m", 0.0)) + float(v.get("altura_m", 0.0)) for v in volumes if float(v.get("z0_m", 0.0)) >= 0.0]
        or [0.0]
    )
    alt_max_lei = params.get("altura_max_m")
    pav_max_lei = params.get("pavimentos_max")
    tem_gabarito_especial = bool(areas_especiais)
    if alt_max_lei is not None and alt_usada_m > float(alt_max_lei) + 1e-3:
        sem_alt = _semaforo_html("vermelho", "Acima do limite")
    elif tem_gabarito_especial:
        sem_alt = _semaforo_html("amarelo", "Conferir área esp.")
    else:
        sem_alt = _semaforo_html("verde", "Livre na zona")

    # Recuos usados nos volumes acima do solo
    recuos_vol_desc = []
    for v in volumes:
        if v.get("uso") == "garagem":
            continue
        rl = v.get("recuo_lateral_m")
        rf = v.get("recuo_fundos_m")
        if rl is not None or rf is not None:
            cega_txt = " (parede cega)" if v.get("parede_cega") else ""
            recuos_vol_desc.append(
                f"{v.get('uso')}: lat. {formatar_numero_ptbr(rl)} m / fundos {formatar_numero_ptbr(rf)} m{cega_txt}"
            )
    recuos_usados_str = "; ".join(recuos_vol_desc) if recuos_vol_desc else "—"
    sem_recuo = (
        _semaforo_html("amarelo", "Frontal padrão")
        if params.get("recuo_frontal_m") is None
        else _semaforo_html("verde", "Atende")
    )

    # 5. Quadro de áreas resumido (por bloco/volume + métricas totais e eficiência)
    linhas_volumes = []
    for idx_v, v in enumerate(volumes):
        uso_v = str(v.get("uso", ""))
        z0_v = v.get("z0_m", 0.0)
        alt_v = v.get("altura_m", 0.0)
        pav_v = v.get("pavimentos", 0)
        area_base_v = round(calcular_area_poligono(v.get("base_utm") or []), 2)
        rl_v = v.get("recuo_lateral_m")
        rf_v = v.get("recuo_fundos_m")
        rec_str = (
            f'{span_num(f"opcoes.{oid}.volumes.{idx_v}.recuo_lateral_m", rl_v, "m")} / '
            f'{span_num(f"opcoes.{oid}.volumes.{idx_v}.recuo_fundos_m", rf_v, "m")}'
            if (rl_v is not None or rf_v is not None)
            else "Subsolo"
        )
        linhas_volumes.append(
            f"<tr>"
            f"<td><strong>{esc(uso_v.capitalize())}</strong> (bloco {idx_v + 1})</td>"
            f'<td>{span_num(f"opcoes.{oid}.volumes.{idx_v}.z0_m", z0_v, "m")}</td>'
            f'<td>{span_num(f"opcoes.{oid}.volumes.{idx_v}.altura_m", alt_v, "m")}</td>'
            f'<td>{span_num(f"opcoes.{oid}.volumes.{idx_v}.pavimentos", pav_v, "pav.")}</td>'
            f"<td>{formatar_numero_ptbr(area_base_v)} m²</td>"
            f"<td>{rec_str}</td>"
            f"</tr>"
        )

    area_const = float(metricas.get("area_construida_m2") or 0.0)
    area_gar = float(metricas.get("area_garagem_m2") or 0.0)
    area_priv = float(metricas.get("area_privativa_m2") or 0.0)
    area_sem_gar = area_const - area_gar
    efic_sem_gar_pct = (area_priv / area_sem_gar * 100.0) if area_sem_gar > 0 else 0.0
    efic_total_pct = (area_priv / area_const * 100.0) if area_const > 0 else 0.0

    # 6. Premissas usadas (todas as chaves de estudo.premissas exceto 'padrao')
    itens_premissas = []
    chaves_ordenadas = list(NOMES_PREMISSAS.keys()) + [
        k for k in premissas.keys() if k not in NOMES_PREMISSAS and k != "padrao"
    ]
    for ch in chaves_ordenadas:
        if ch not in premissas or ch == "padrao":
            continue
        rotulo_p, unid_p = NOMES_PREMISSAS.get(ch, (ch, ""))
        val_p = premissas.get(ch)
        eh_padrao = ch in padrao_set
        selo_padrao = ' <span class="badge-padrao" data-padrao="true">padrão</span>' if eh_padrao else ""
        if isinstance(val_p, (int, float, bool)) or val_p is None:
            val_html = span_num(f"premissas.{ch}", val_p, unid_p)
        else:
            val_html = f'<span class="num-texto" data-campo="premissas.{esc(ch)}" data-valor="{esc(val_p)}">{esc(val_p)}</span>'
        itens_premissas.append(
            f'<div class="premissa-item" data-premissa="{esc(ch)}">'
            f'<span class="premissa-nome">{esc(rotulo_p)}:</span> '
            f'<strong class="premissa-valor">{val_html}</strong>{selo_padrao}'
            f"</div>"
        )

    # 7. Alertas da opção + incertezas
    html_alertas_op = "".join(f"<li>{esc(a)}</li>" for a in alertas_op) or "<li>Nenhum alerta específico na opção.</li>"
    html_incertezas_op = "".join(f"<li>{esc(inc)}</li>" for inc in incertezas)

    return f"""
    <section class="pagina pagina-opcao" id="opcao-{esc(oid)}" data-opcao-id="{esc(oid)}">
      <!-- 1. CABEÇALHO -->
      <header class="cabecalho-pagina">
        <div class="cab-esquerda">
          <div class="cab-tag">OPÇÃO {esc(oid)} — FICHA DE VIABILIDADE POR OPÇÃO</div>
          <h1 class="cab-titulo">{esc(oid)} — {esc(nome_op)}</h1>
          <div class="cab-subtitulo">
            Lote: <strong>{esc(lote.get("id"))}</strong> ({span_num("lote.area_m2", lote.get("area_m2"), "m²")}) ·
            Zona: <strong>{esc(zona.get("id"))} — {esc(zona.get("nome"))}</strong>
          </div>
        </div>
        <div class="cab-direita">
          <div>Motor v<strong>{esc(versao_motor)}</strong></div>
          <div>Leis: {esc(", ".join(datas_fontes) if datas_fontes else "—")}</div>
          <div class="cab-fontes-curtas" title="{esc('; '.join(leis_nomes))}">{len(zona.get("fontes") or [])} fontes legais</div>
        </div>
      </header>

      {_gerar_painel_conferencia(lote, zona, compacto=True)}

      <!-- 2. IMAGEM: VISTA 3D + IMPLANTAÇÃO DE CIMA AO LADO -->
      <div class="painel-desenhos">
        <div class="desenho-box">
          {svg_planta}
          <div class="legenda-svg">
            <span><i class="cor-leg" style="background:#e6f4ea;border-color:#1e6b3b"></i>Lote / Permeável</span>
            <span><i class="cor-leg" style="background:#fff;border:1px dashed #475569"></i>Caixa máx. (recuos)</span>
            <span><i class="cor-leg" style="background:#cbd5e1;border-color:#475569"></i>Subsolo</span>
            <span><i class="cor-leg" style="background:#f59e0b;border-color:#b45309"></i>Embasamento</span>
            <span><i class="cor-leg" style="background:#2563eb;border-color:#1e3a8a"></i>Residencial</span>
            <span><i class="cor-leg" style="background:#dc2626;border-color:#dc2626"></i>Frente/Acesso</span>
          </div>
        </div>
        <div class="desenho-box">
          {svg_3d}
          <div class="legenda-svg">
            <span>Envelope azul tracejado transparente = Caixa máxima ({span_num("caixa_maxima.altura_m", caixa.get("altura_m"), "m")})</span>
          </div>
        </div>
      </div>

      <!-- 3. OS 4 NÚMEROS GRANDES -->
      <div class="quatro-numeros">
        <div class="card-numero">
          <div class="card-numero-rotulo">Unidades Estimadas</div>
          <div class="card-numero-valor">{span_num(f"opcoes.{oid}.metricas.unidades_estimadas", metricas.get("unidades_estimadas"))}</div>
          <div class="card-numero-sub">un. de {span_num("premissas.area_privativa_por_unidade_m2", premissas.get("area_privativa_por_unidade_m2"), "m²")}</div>
        </div>
        <div class="card-numero">
          <div class="card-numero-rotulo">Área Privativa Vendável</div>
          <div class="card-numero-valor">{span_num(f"opcoes.{oid}.metricas.area_privativa_m2", metricas.get("area_privativa_m2"), "m²")}</div>
          <div class="card-numero-sub">Base de venda e VGV</div>
        </div>
        <div class="card-numero">
          <div class="card-numero-rotulo">Vagas de Garagem</div>
          <div class="card-numero-valor">{span_num(f"opcoes.{oid}.metricas.vagas", metricas.get("vagas"))}</div>
          <div class="card-numero-sub">Área gar.: {span_num(f"opcoes.{oid}.metricas.area_garagem_m2", metricas.get("area_garagem_m2"), "m²")}</div>
        </div>
        <div class="card-numero">
          <div class="card-numero-rotulo">VGV Estimado</div>
          <div class="card-numero-valor card-numero-vgv">{vgv_html}</div>
          <div class="card-numero-sub">{esc(vgv_sub)}</div>
        </div>
      </div>

      <!-- 4. USO DA LEI + 5. QUADRO DE ÁREAS LADO A LADO -->
      <div class="grade-meio">
        <div class="coluna-meio">
          <h2 class="secao-titulo">4. Uso da Lei (Usado × Permitido × Folga)</h2>
          <table class="tabela-compacta">
            <thead>
              <tr>
                <th>Parâmetro</th>
                <th>Usado na Opção</th>
                <th>Permitido na Lei</th>
                <th>Folga / Outorga</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>CA</strong></td>
                <td>{span_num(f"opcoes.{oid}.metricas.ca_usado", metricas.get("ca_usado"))} ({span_num(f"opcoes.{oid}.metricas.area_computavel_m2", metricas.get("area_computavel_m2"), "m²")})</td>
                <td>Bás. {span_num("zona.parametros.ca_basico", ca_basico)} / Máx. {span_num("zona.parametros.ca_maximo", ca_maximo)} ({span_num("caixa_maxima.area_computavel_max_m2", caixa.get("area_computavel_max_m2"), "m²")})</td>
                <td>Folga: {esc(folga_ca_txt)}<br/>Outorga: {span_num(f"opcoes.{oid}.metricas.area_acima_ca_basico_m2", metricas.get("area_acima_ca_basico_m2"), "m²")}</td>
                <td>{sem_ca}</td>
              </tr>
              <tr>
                <td><strong>TO (Ocupação)</strong></td>
                <td>{span_num(f"opcoes.{oid}.metricas.to_usada", metricas.get("to_usada"))} ({formatar_numero_ptbr(round(to_usada * 100, 1))}%)</td>
                <td>Máx. {span_num("zona.parametros.taxa_ocupacao", to_max)} ({span_num("caixa_maxima.ocupacao_max_m2", caixa.get("ocupacao_max_m2"), "m²")})</td>
                <td>{esc(folga_to_txt)}</td>
                <td>{sem_to}</td>
              </tr>
              <tr>
                <td><strong>Permeabilidade</strong></td>
                <td>{span_num(f"opcoes.{oid}.metricas.area_permeavel_m2", metricas.get("area_permeavel_m2"), "m²")} ({formatar_numero_ptbr(round(perm_pct * 100, 1))}%)</td>
                <td>Mín. {span_num("zona.parametros.taxa_permeabilidade", perm_min_taxa)} ({formatar_numero_ptbr(round(perm_min_m2, 2))} m²)</td>
                <td>{esc(folga_perm_txt)}</td>
                <td>{sem_perm}</td>
              </tr>
              <tr>
                <td><strong>Altura e Pav.</strong></td>
                <td>{span_num(f"opcoes.{oid}.metricas.pavimentos", metricas.get("pavimentos"), "pav.")} / {formatar_numero_ptbr(alt_usada_m)} m</td>
                <td>Zona: {span_num("zona.parametros.altura_max_m", alt_max_lei, "m")} / {span_num("zona.parametros.pavimentos_max", pav_max_lei, "pav.")} (Caixa: {span_num("caixa_maxima.altura_m", caixa.get("altura_m"), "m")})</td>
                <td>{"Área especial no lote" if tem_gabarito_especial else "Limitada pelo CA"}</td>
                <td>{sem_alt}</td>
              </tr>
              <tr>
                <td><strong>Recuos</strong></td>
                <td>Frontal: {span_num("caixa_maxima.recuo_frontal_m", caixa.get("recuo_frontal_m"), "m")}<br/><small>{esc(recuos_usados_str)}</small></td>
                <td>Frontal lei: {span_num("zona.parametros.recuo_frontal_m", params.get("recuo_frontal_m"), "m")}<br/>Lat./Fdo. mín.: {span_num("zona.parametros.recuo_lateral_m", params.get("recuo_lateral_m"), "m")} / {span_num("zona.parametros.recuo_fundos_m", params.get("recuo_fundos_m"), "m")} (h/8 acima 2º pav.)</td>
                <td>{"Conferir loteamento" if params.get("recuo_frontal_m") is None else "OK"}</td>
                <td>{sem_recuo}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="coluna-meio">
          <h2 class="secao-titulo">5. Quadro de Áreas Resumido (Espírito NBR 12721)</h2>
          <table class="tabela-compacta">
            <thead>
              <tr>
                <th>Volume / Uso</th>
                <th>Cota z0</th>
                <th>Altura</th>
                <th>Pav.</th>
                <th>Projeção</th>
                <th>Recuo Lat./Fdo.</th>
              </tr>
            </thead>
            <tbody>
              {''.join(linhas_volumes)}
            </tbody>
          </table>

          <table class="tabela-compacta tabela-totais-areas">
            <tbody>
              <tr>
                <th>Área construída total</th>
                <td><strong>{span_num(f"opcoes.{oid}.metricas.area_construida_m2", metricas.get("area_construida_m2"), "m²")}</strong></td>
                <th>Área computável (CA)</th>
                <td><strong>{span_num(f"opcoes.{oid}.metricas.area_computavel_m2", metricas.get("area_computavel_m2"), "m²")}</strong></td>
              </tr>
              <tr>
                <th>Área não computável</th>
                <td>{span_num(f"opcoes.{oid}.metricas.area_nao_computavel_m2", metricas.get("area_nao_computavel_m2"), "m²")}</td>
                <th>Área de garagem</th>
                <td>{span_num(f"opcoes.{oid}.metricas.area_garagem_m2", metricas.get("area_garagem_m2"), "m²")}</td>
              </tr>
              <tr>
                <th>Área privativa vendável</th>
                <td><strong>{span_num(f"opcoes.{oid}.metricas.area_privativa_m2", metricas.get("area_privativa_m2"), "m²")}</strong></td>
                <th>Acima do CA básico (outorga)</th>
                <td>{span_num(f"opcoes.{oid}.metricas.area_acima_ca_basico_m2", metricas.get("area_acima_ca_basico_m2"), "m²")}</td>
              </tr>
              <tr>
                <th>Eficiência (s/ garagem)</th>
                <td>{formatar_numero_ptbr(round(efic_sem_gar_pct, 1))}% (premissa: {span_num("premissas.eficiencia", premissas.get("eficiencia"))})</td>
                <th>Eficiência (sobre total)</th>
                <td>{formatar_numero_ptbr(round(efic_total_pct, 1))}%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- 6. PREMISSAS USADAS -->
      <div class="bloco-premissas">
        <h2 class="secao-titulo">6. Premissas Usadas <span class="subtitulo-leve">(itens vindos de <code>premissas.padrao</code> marcados com <span class="badge-padrao">padrão</span>)</span></h2>
        <div class="grade-premissas">
          {''.join(itens_premissas)}
        </div>
      </div>

      <!-- 7. ALERTAS E INCERTEZAS -->
      <div class="grade-alertas-opcao">
        <div class="caixa-alerta caixa-aviso">
          <div class="caixa-alerta-titulo">7a. Alertas da Opção {esc(oid)}</div>
          <ul class="lista-alertas">{html_alertas_op}</ul>
        </div>
        <div class="caixa-alerta caixa-incertezas">
          <div class="caixa-alerta-titulo">7b. Incertezas do Estudo</div>
          <ul class="lista-alertas">{html_incertezas_op}</ul>
        </div>
      </div>

      <!-- 8. RODAPÉ FIXO -->
      <footer class="rodape-fixo">{esc(RODAPE_FIXO)}</footer>
    </section>
    """


CSS_ESTILOS = """
@page {
  size: A4 portrait;
  margin: 8mm;
}
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}
body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  font-size: 9.5pt;
  line-height: 1.32;
  color: #0f172a;
  background: #e2e8f0;
  padding: 12px 0;
}
.pagina {
  width: 210mm;
  min-height: 281mm;
  margin: 0 auto 14px auto;
  background: #ffffff;
  padding: 8mm 9mm;
  box-shadow: 0 2px 10px rgba(15, 23, 42, 0.12);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  page-break-after: always;
  break-after: page;
}
.pagina:last-child {
  page-break-after: auto;
  break-after: auto;
}
@media print {
  body {
    background: #ffffff;
    padding: 0;
  }
  .pagina {
    width: 100%;
    min-height: 278mm;
    margin: 0;
    padding: 0;
    box-shadow: none;
  }
}
.cabecalho-pagina {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  border-bottom: 2px solid #0f172a;
  padding-bottom: 5px;
  margin-bottom: 6px;
}
.cab-tag {
  font-size: 7pt;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: #1d4ed8;
  text-transform: uppercase;
}
.cab-titulo {
  font-size: 13.5pt;
  font-weight: 800;
  color: #0f172a;
  margin: 1px 0;
}
.cab-subtitulo {
  font-size: 8.2pt;
  color: #334155;
}
.cab-direita {
  text-align: right;
  font-size: 7.5pt;
  color: #475569;
  white-space: nowrap;
  margin-left: 10px;
}
.conferencia-dupla {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-bottom: 6px;
}
.conf-card {
  border-radius: 5px;
  padding: 5px 8px;
  border: 1.5px solid #cbd5e1;
  font-size: 7.8pt;
}
.conf-ok {
  background: #f0fdf4;
  border-color: #16a34a;
}
.conf-alerta, .conf-pendente {
  background: #fffbeb;
  border-color: #d97706;
}
.conf-titulo {
  font-weight: 700;
  font-size: 7.8pt;
  color: #0f172a;
  margin-bottom: 2px;
}
.conf-valor {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 2px;
}
.badge-conf {
  display: inline-block;
  padding: 1px 6px;
  border-radius: 3px;
  font-size: 7pt;
  font-weight: 800;
  letter-spacing: 0.03em;
}
.conf-ok .badge-conf {
  background: #15803d;
  color: #ffffff;
}
.conf-alerta .badge-conf, .conf-pendente .badge-conf {
  background: #b45309;
  color: #ffffff;
}
.conf-explicacao {
  font-size: 7.2pt;
  color: #334155;
}
.conf-subalerta {
  margin-top: 2px;
  padding: 2px 5px;
  background: #fef2f2;
  border-left: 3px solid #dc2626;
  color: #991b1b;
  font-size: 7.2pt;
}
.grade-resumo-lote {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-bottom: 6px;
}
.card-info {
  background: #f8fafc;
  border: 1px solid #cbd5e1;
  border-radius: 4px;
  padding: 5px 7px;
  font-size: 7.6pt;
}
.card-info-titulo {
  font-weight: 700;
  color: #1e293b;
  margin-bottom: 2px;
  font-size: 8pt;
}
.secao-titulo {
  font-size: 8.8pt;
  font-weight: 800;
  color: #0f172a;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  margin: 4px 0 3px 0;
  border-left: 3px solid #2563eb;
  padding-left: 5px;
}
.subtitulo-leve {
  font-size: 7.2pt;
  font-weight: 400;
  text-transform: none;
  color: #475569;
}
.tabela-comparacao, .tabela-compacta {
  width: 100%;
  border-collapse: collapse;
  font-size: 7.5pt;
  margin-bottom: 5px;
}
.tabela-comparacao th, .tabela-comparacao td,
.tabela-compacta th, .tabela-compacta td {
  border: 1px solid #cbd5e1;
  padding: 3px 5px;
  vertical-align: top;
}
.tabela-comparacao thead th, .tabela-compacta thead th {
  background: #1e293b;
  color: #ffffff;
  font-weight: 700;
  text-align: left;
}
.tabela-comparacao tbody th {
  background: #f1f5f9;
  text-align: left;
  font-weight: 600;
  width: 24%;
}
.tabela-comparacao tr.linha-destaque th,
.tabela-comparacao tr.linha-destaque td {
  background: #eff6ff;
  font-weight: 700;
  font-size: 8.2pt;
}
.mini-dupla {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 3px;
}
.mini-legenda {
  font-size: 6.5pt;
  font-weight: 700;
  color: #475569;
  text-align: center;
}
.painel-desenhos {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-bottom: 6px;
}
.desenho-box {
  border: 1px solid #cbd5e1;
  border-radius: 5px;
  padding: 4px;
  background: #ffffff;
}
.legenda-svg {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  font-size: 6.8pt;
  color: #334155;
  margin-top: 2px;
  justify-content: center;
}
.cor-leg {
  display: inline-block;
  width: 8px;
  height: 8px;
  border: 1px solid #334155;
  margin-right: 3px;
  vertical-align: middle;
}
.quatro-numeros {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 7px;
  margin-bottom: 6px;
}
.card-numero {
  background: #eff6ff;
  border: 1.5px solid #93c5fd;
  border-radius: 5px;
  padding: 5px 7px;
  text-align: center;
}
.card-numero-rotulo {
  font-size: 7.2pt;
  font-weight: 700;
  text-transform: uppercase;
  color: #1e3a8a;
}
.card-numero-valor {
  font-size: 13pt;
  font-weight: 800;
  color: #0f172a;
  margin: 1px 0;
}
.card-numero-vgv {
  font-size: 10.5pt;
}
.card-numero-sub {
  font-size: 6.8pt;
  color: #475569;
}
.grade-meio {
  display: grid;
  grid-template-columns: 1.12fr 0.88fr;
  gap: 8px;
  margin-bottom: 5px;
}
.tabela-totais-areas th {
  background: #f1f5f9;
  text-align: left;
  font-weight: 600;
}
.semaforo {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 1px 5px;
  border-radius: 10px;
  font-size: 6.8pt;
  font-weight: 700;
  white-space: nowrap;
}
.semaforo-ponto {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  display: inline-block;
}
.semaforo-verde {
  background: #dcfce7;
  color: #166534;
}
.semaforo-verde .semaforo-ponto {
  background: #16a34a;
}
.semaforo-amarelo {
  background: #fef3c7;
  color: #92400e;
}
.semaforo-amarelo .semaforo-ponto {
  background: #d97706;
}
.semaforo-vermelho {
  background: #fee2e2;
  color: #991b1b;
}
.semaforo-vermelho .semaforo-ponto {
  background: #dc2626;
}
.bloco-premissas {
  margin-bottom: 5px;
}
.grade-premissas {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 3px 8px;
  background: #f8fafc;
  border: 1px solid #cbd5e1;
  border-radius: 4px;
  padding: 5px 7px;
  font-size: 7.1pt;
}
.premissa-item {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.badge-padrao {
  display: inline-block;
  background: #e2e8f0;
  color: #334155;
  border: 1px solid #94a3b8;
  border-radius: 3px;
  padding: 0 4px;
  font-size: 6.3pt;
  font-weight: 700;
  text-transform: lowercase;
  vertical-align: middle;
}
.grade-alertas-opcao {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-bottom: 5px;
}
.caixa-alerta {
  border-radius: 4px;
  padding: 5px 7px;
  font-size: 7.1pt;
  margin-bottom: 5px;
}
.caixa-aviso {
  background: #fffbeb;
  border: 1.5px solid #f59e0b;
}
.caixa-perigo {
  background: #fef2f2;
  border: 1.5px solid #ef4444;
}
.caixa-incertezas {
  background: #fff7ed;
  border: 1.5px solid #fb923c;
}
.caixa-alerta-titulo {
  font-weight: 800;
  font-size: 7.6pt;
  margin-bottom: 2px;
  color: #7c2d12;
}
.lista-alertas, .lista-compacta {
  padding-left: 13px;
}
.lista-alertas li, .lista-compacta li {
  margin-bottom: 1.5px;
}
.observacoes-rodape {
  font-size: 6.9pt;
  color: #475569;
  border-top: 1px dashed #cbd5e1;
  padding-top: 3px;
  margin-bottom: 4px;
}
.rodape-fixo {
  border-top: 1.5px solid #0f172a;
  padding-top: 4px;
  text-align: center;
  font-size: 7.4pt;
  font-weight: 700;
  color: #334155;
}
code {
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  font-size: 90%;
}
"""


def gerar_html(estudo: Dict[str, Any]) -> str:
    """Gera a string HTML completa (capa + uma página A4 por opção) a partir do dict do estudo."""
    lote = estudo.get("lote") or {}
    opcoes = estudo.get("opcoes") or []
    titulo_doc = f"Relatório de Viabilidade — {lote.get('id', 'Estudo')}"

    paginas_html = [_gerar_capa_comparacao(estudo)]
    for op in opcoes:
        paginas_html.append(_gerar_pagina_opcao(estudo, op))

    return f"""<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>{esc(titulo_doc)}</title>
  <style>{CSS_ESTILOS}</style>
</head>
<body>
{''.join(paginas_html)}
</body>
</html>
"""


def gerar_relatorio(caminho_estudo: Path | str, caminho_saida: Path | str) -> Path:
    """Lê o arquivo JSON de estudo e grava o relatório HTML correspondente."""
    p_in = Path(caminho_estudo)
    p_out = Path(caminho_saida)
    with p_in.open("r", encoding="utf-8") as f:
        estudo = json.load(f)
    conteudo_html = gerar_html(estudo)
    p_out.parent.mkdir(parents=True, exist_ok=True)
    with p_out.open("w", encoding="utf-8") as f:
        f.write(conteudo_html)
    return p_out


def main(argv: Optional[Sequence[str]] = None) -> int:
    parser = argparse.ArgumentParser(
        description="Gera relatório HTML (A4) de viabilidade a partir de um estudo.json."
    )
    parser.add_argument(
        "--estudo",
        required=True,
        help="Caminho para o arquivo JSON do estudo (ex.: estudo.json).",
    )
    parser.add_argument(
        "--saida",
        required=True,
        help="Caminho para o arquivo HTML de saída (ex.: relatorio.html).",
    )
    args = parser.parse_args(argv)
    gerar_relatorio(args.estudo, args.saida)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

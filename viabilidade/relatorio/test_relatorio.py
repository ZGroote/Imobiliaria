#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Testes automatizados do gerador de relatório HTML (viabilidade/relatorio/relatorio.py).

Execução:
    python -I -X utf8 viabilidade/relatorio/test_relatorio.py
ou via unittest:
    python -I -X utf8 -m unittest viabilidade/relatorio/test_relatorio.py

O que este teste faz:
1. Gera os relatórios HTML dos 7 estudos de `viabilidade/motor/exemplos/pilotos/`
   e do estudo de exemplo (`viabilidade/motor/exemplos/estudo-exemplo.json`),
   salvando em `viabilidade/relatorio/saida/`.
2. Analisa o HTML gerado e confere todos os números visíveis no texto contra
   os valores exatos do JSON (lote, relevo, zona, caixa máxima, premissas,
   volumes e todas as 13 métricas de cada opção).
3. Falha imediatamente se qualquer número do HTML não bater com o JSON, ou se
   faltar algum número obrigatório, alerta, incerteza, marcação de "padrão",
   separação `zona.conferido` × `lote.zona_conferida`, ou planta SVG.
4. Testa também que uma adulteração numérica no HTML é detectada e reprovada.
"""

from __future__ import annotations

from html.parser import HTMLParser
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from typing import Any, Dict, List, Optional, Tuple

DIR_RELATORIO = Path(__file__).resolve().parent
DIR_VIABILIDADE = DIR_RELATORIO.parent
DIR_EXEMPLOS = DIR_VIABILIDADE / "motor" / "exemplos"
DIR_PILOTOS = DIR_EXEMPLOS / "pilotos"

sys.path.insert(0, str(DIR_RELATORIO))
import relatorio  # noqa: E402


class _ExtratorRelatorioHTML(HTMLParser):
    """Extrai elementos numéricos, premissas, páginas e SVGs do HTML gerado."""

    def __init__(self) -> None:
        super().__init__()
        self.spans_num: List[Dict[str, str]] = []
        self._span_atual: Optional[Dict[str, str]] = None
        self._profundidade_span: int = 0

        self.premissas_encontradas: Dict[str, Dict[str, Any]] = {}
        self._premissa_atual: Optional[str] = None
        self._profundidade_premissa: int = 0

        self.svgs_planta: List[Dict[str, Any]] = []
        self.svgs_vista3d: List[Dict[str, Any]] = []
        self._svg_atual: Optional[Dict[str, Any]] = None

        self.paginas_count: int = 0
        self.recursos_externos: List[str] = []

    def handle_starttag(self, tag: str, attrs: List[Tuple[str, Optional[str]]]) -> None:
        attr_dict = {k: (v or "") for k, v in attrs}
        classes = set(attr_dict.get("class", "").split())

        # Verificar ausência de recursos externos (sem internet)
        if tag in ("script", "img", "iframe"):
            src = attr_dict.get("src", "")
            if src.startswith(("http://", "https://", "//")):
                self.recursos_externos.append(f"<{tag} src='{src}'>")
        if tag == "link":
            href = attr_dict.get("href", "")
            if href.startswith(("http://", "https://", "//")):
                self.recursos_externos.append(f"<link href='{href}'>")

        if tag == "section" and "pagina" in classes:
            self.paginas_count += 1

        if tag == "div" and "premissa-item" in classes and "data-premissa" in attr_dict:
            self._premissa_atual = attr_dict["data-premissa"]
            self._profundidade_premissa = 1
            if self._premissa_atual not in self.premissas_encontradas:
                self.premissas_encontradas[self._premissa_atual] = {"padrao": False}
        elif self._premissa_atual is not None and tag == "div":
            self._profundidade_premissa += 1

        if self._premissa_atual is not None and "badge-padrao" in classes:
            self.premissas_encontradas[self._premissa_atual]["padrao"] = True

        if tag == "span" and ("num" in classes or "num-texto" in classes) and "data-campo" in attr_dict:
            self._span_atual = {
                "campo": attr_dict.get("campo") or attr_dict["data-campo"],
                "valor_attr": attr_dict.get("data-valor", ""),
                "texto": "",
                "classes": attr_dict.get("class", ""),
            }
            self._profundidade_span = 1
        elif self._span_atual is not None and tag == "span":
            self._profundidade_span += 1

        if tag == "svg":
            if "svg-planta" in classes:
                self._svg_atual = {"tipo": "planta", "opcao": attr_dict.get("data-opcao", ""), "polygons": 0, "lines": 0}
            elif "svg-vista3d" in classes:
                self._svg_atual = {"tipo": "vista3d", "opcao": attr_dict.get("data-opcao", ""), "polygons": 0, "lines": 0}
        elif self._svg_atual is not None:
            if tag == "polygon":
                self._svg_atual["polygons"] += 1
            elif tag == "line":
                self._svg_atual["lines"] += 1

    def handle_data(self, data: str) -> None:
        if self._span_atual is not None:
            self._span_atual["texto"] += data

    def handle_endtag(self, tag: str) -> None:
        if self._span_atual is not None and tag == "span":
            self._profundidade_span -= 1
            if self._profundidade_span == 0:
                self._span_atual["texto"] = self._span_atual["texto"].strip()
                self.spans_num.append(self._span_atual)
                self._span_atual = None

        if self._premissa_atual is not None and tag == "div":
            self._profundidade_premissa -= 1
            if self._profundidade_premissa == 0:
                self._premissa_atual = None

        if self._svg_atual is not None and tag == "svg":
            if self._svg_atual["tipo"] == "planta":
                self.svgs_planta.append(self._svg_atual)
            else:
                self.svgs_vista3d.append(self._svg_atual)
            self._svg_atual = None


def _resolver_campo_no_estudo(estudo: Dict[str, Any], campo: str) -> Tuple[bool, Any]:
    """
    Resolve um caminho de campo do tipo:
    - 'lote.area_m2'
    - 'zona.parametros.ca_basico'
    - 'opcoes.A.metricas.area_construida_m2'
    - 'opcoes.A.volumes.0.altura_m'
    - 'opcoes.A.altura_topo_m' (calculado dos volumes da opção)
    """
    partes = campo.split(".")
    if len(partes) >= 3 and partes[0] == "opcoes":
        oid = partes[1]
        op_obj = next((o for o in (estudo.get("opcoes") or []) if str(o.get("id")) == oid), None)
        if op_obj is None:
            return (False, None)
        if partes[2] == "altura_topo_m":
            vols = op_obj.get("volumes") or []
            alt = max(
                [float(v.get("z0_m", 0.0)) + float(v.get("altura_m", 0.0)) for v in vols if float(v.get("z0_m", 0.0)) >= 0.0]
                or [0.0]
            )
            return (True, alt)
        atual: Any = op_obj
        for p in partes[2:]:
            if isinstance(atual, list):
                idx = int(p)
                if idx < 0 or idx >= len(atual):
                    return (False, None)
                atual = atual[idx]
            elif isinstance(atual, dict) and p in atual:
                atual = atual[p]
            else:
                return (False, None)
        return (True, atual)

    atual = estudo
    for p in partes:
        if isinstance(atual, list):
            idx = int(p)
            if idx < 0 or idx >= len(atual):
                return (False, None)
            atual = atual[idx]
        elif isinstance(atual, dict) and p in atual:
            atual = atual[p]
        else:
            return (False, None)
    return (True, atual)


def _converter_texto_ptbr_para_float(texto: str) -> float:
    """Converte número formatado em pt-BR (ex.: '4.684,19') para float."""
    limpo = texto.strip().replace("\u00a0", "").replace(".", "").replace(",", ".")
    return float(limpo)


def validar_html_contra_json(html_str: str, estudo: Dict[str, Any]) -> None:
    """
    Valida que todos os números do HTML batem exatamente com o estudo.json
    e que todos os campos obrigatórios do estudo estão presentes no HTML.
    Levanta AssertionError se qualquer número divergir ou faltar.
    """
    extrator = _ExtratorRelatorioHTML()
    extrator.feed(html_str)

    if extrator.recursos_externos:
        raise AssertionError(f"HTML contém recursos externos proibidos: {extrator.recursos_externos}")

    opcoes = estudo.get("opcoes") or []
    paginas_esperadas = 1 + len(opcoes)
    if extrator.paginas_count != paginas_esperadas:
        raise AssertionError(
            f"Quantidade de páginas A4 incorreta: esperado {paginas_esperadas}, encontrado {extrator.paginas_count}"
        )

    # 1. Conferir cada span numérico encontrado no HTML contra o JSON
    if not extrator.spans_num:
        raise AssertionError("Nenhum elemento numérico (<span class='num'>) encontrado no HTML.")

    campos_vistos: Dict[str, int] = {}
    for item in extrator.spans_num:
        campo = item["campo"]
        texto_visivel = item["texto"]
        valor_attr = item["valor_attr"]
        campos_vistos[campo] = campos_vistos.get(campo, 0) + 1

        existe, valor_json = _resolver_campo_no_estudo(estudo, campo)
        if not existe:
            raise AssertionError(f"Campo '{campo}' presente no HTML não existe no JSON.")

        if valor_json is None:
            if valor_attr != "null":
                raise AssertionError(f"Campo nulo '{campo}' deveria ter data-valor='null', mas tem '{valor_attr}'.")
            if texto_visivel not in ("—", "informe o preço"):
                raise AssertionError(
                    f"Campo nulo '{campo}' deveria exibir '—' ou 'informe o preço', mas exibe '{texto_visivel}'."
                )
        elif isinstance(valor_json, bool):
            esperado_txt = "Sim" if valor_json else "Não"
            esperado_attr = "true" if valor_json else "false"
            if texto_visivel != esperado_txt or valor_attr != esperado_attr:
                raise AssertionError(
                    f"Booleano '{campo}' divergente: JSON={valor_json}, HTML texto='{texto_visivel}', attr='{valor_attr}'."
                )
        elif isinstance(valor_json, (int, float)):
            try:
                num_visivel = _converter_texto_ptbr_para_float(texto_visivel)
            except ValueError as exc:
                raise AssertionError(
                    f"Texto numérico inválido no HTML para '{campo}': '{texto_visivel}'"
                ) from exc
            try:
                num_attr = float(valor_attr)
            except ValueError as exc:
                raise AssertionError(
                    f"Atributo data-valor inválido no HTML para '{campo}': '{valor_attr}'"
                ) from exc

            if abs(num_visivel - float(valor_json)) > 1e-6:
                raise AssertionError(
                    f"Número visível no HTML não bate com o JSON em '{campo}': "
                    f"HTML='{texto_visivel}' ({num_visivel}) != JSON={valor_json}"
                )
            if abs(num_attr - float(valor_json)) > 1e-6:
                raise AssertionError(
                    f"Atributo data-valor no HTML não bate com o JSON em '{campo}': "
                    f"attr='{valor_attr}' ({num_attr}) != JSON={valor_json}"
                )
        else:
            if texto_visivel != str(valor_json):
                raise AssertionError(
                    f"Valor textual '{campo}' divergente: HTML='{texto_visivel}' != JSON='{valor_json}'"
                )

    # 2. Conferir presença de todos os campos numéricos obrigatórios do JSON no HTML
    campos_obrigatorios = [
        "lote.area_m2",
        "zona.conferido",
        "lote.zona_conferida",
        "zona.parametros.ca_basico",
        "zona.parametros.ca_maximo",
        "zona.parametros.taxa_ocupacao",
        "zona.parametros.taxa_permeabilidade",
        "zona.parametros.recuo_frontal_m",
        "zona.parametros.recuo_lateral_m",
        "zona.parametros.recuo_fundos_m",
        "zona.parametros.altura_max_m",
        "zona.parametros.pavimentos_max",
        "caixa_maxima.altura_m",
        "caixa_maxima.area_projecao_m2",
        "caixa_maxima.area_computavel_max_m2",
        "caixa_maxima.ocupacao_max_m2",
        "caixa_maxima.recuo_frontal_m",
    ]
    relevo = (estudo.get("lote") or {}).get("relevo")
    if isinstance(relevo, dict) and relevo:
        for k_rel in ("cota_min_m", "cota_max_m", "declividade_pct", "resolucao_m"):
            if k_rel in relevo:
                campos_obrigatorios.append(f"lote.relevo.{k_rel}")

    premissas = estudo.get("premissas") or {}
    for k_prem in premissas:
        if k_prem != "padrao":
            campos_obrigatorios.append(f"premissas.{k_prem}")

    metricas_chaves = [
        "area_construida_m2",
        "area_computavel_m2",
        "area_nao_computavel_m2",
        "area_privativa_m2",
        "area_acima_ca_basico_m2",
        "area_garagem_m2",
        "vagas",
        "area_permeavel_m2",
        "ca_usado",
        "to_usada",
        "pavimentos",
        "unidades_estimadas",
        "vgv_estimado",
    ]
    for op in opcoes:
        oid = op.get("id")
        for mk in metricas_chaves:
            campos_obrigatorios.append(f"opcoes.{oid}.metricas.{mk}")
        for idx_v, v in enumerate(op.get("volumes") or []):
            campos_obrigatorios.append(f"opcoes.{oid}.volumes.{idx_v}.z0_m")
            campos_obrigatorios.append(f"opcoes.{oid}.volumes.{idx_v}.altura_m")
            campos_obrigatorios.append(f"opcoes.{oid}.volumes.{idx_v}.pavimentos")
            if v.get("recuo_lateral_m") is not None:
                campos_obrigatorios.append(f"opcoes.{oid}.volumes.{idx_v}.recuo_lateral_m")
            if v.get("recuo_fundos_m") is not None:
                campos_obrigatorios.append(f"opcoes.{oid}.volumes.{idx_v}.recuo_fundos_m")

    for c_obrig in campos_obrigatorios:
        if c_obrig not in campos_vistos:
            raise AssertionError(f"Campo obrigatório do JSON ausente no HTML: '{c_obrig}'")

    # 3. Conferir que premissas em premissas.padrao estão marcadas com "padrão"
    padrao_set = set(premissas.get("padrao") or [])
    for k_prem in premissas:
        if k_prem == "padrao":
            continue
        if k_prem not in extrator.premissas_encontradas:
            raise AssertionError(f"Premissa '{k_prem}' não encontrada no bloco de premissas do HTML.")
        marcada = extrator.premissas_encontradas[k_prem]["padrao"]
        deveria = k_prem in padrao_set
        if marcada != deveria:
            raise AssertionError(
                f"Marcação 'padrão' incorreta para premissa '{k_prem}': esperado={deveria}, encontrado={marcada}"
            )

    # 4. Conferir alertas e incertezas e separação zona.conferido x lote.zona_conferida
    if "zona.conferido" not in html_str or "lote.zona_conferida" not in html_str:
        raise AssertionError("HTML não separa claramente zona.conferido de lote.zona_conferida.")

    for inc in estudo.get("incertezas") or []:
        if html_escape_check(inc) not in html_str:
            raise AssertionError(f"Incerteza ausente do HTML: '{inc}'")

    for op in opcoes:
        for al in op.get("alertas") or []:
            if html_escape_check(al) not in html_str:
                raise AssertionError(f"Alerta da opção {op.get('id')} ausente do HTML: '{al}'")

    # 5. Conferir presença dos SVGs de planta e vista 3D para cada opção
    opcoes_ids = {str(op.get("id")) for op in opcoes}
    opcoes_com_planta = {s["opcao"] for s in extrator.svgs_planta if s["polygons"] >= 2}
    if opcoes_ids != opcoes_com_planta:
        raise AssertionError(
            f"Nem todas as opções possuem planta SVG válida: esperado={opcoes_ids}, encontrado={opcoes_com_planta}"
        )


def html_escape_check(texto: str) -> str:
    return relatorio.esc(texto)


class TestRelatorioViabilidade(unittest.TestCase):
    """Suite de testes para os 7 estudos pilotos + estudo-exemplo."""

    _tmpdir: Optional[tempfile.TemporaryDirectory[str]] = None

    @classmethod
    def setUpClass(cls) -> None:
        dir_preferido = DIR_RELATORIO / "saida"
        try:
            dir_preferido.mkdir(parents=True, exist_ok=True)
            probe = dir_preferido / ".probe_write"
            probe.write_text("ok", encoding="utf-8")
            probe.unlink()
            cls.dir_saida = dir_preferido
        except PermissionError:
            cls._tmpdir = tempfile.TemporaryDirectory(prefix="relatorio_viabilidade_")
            cls.dir_saida = Path(cls._tmpdir.name)
        cls.arquivos_pilotos = sorted(DIR_PILOTOS.glob("*.json"))
        cls.arquivo_exemplo = DIR_EXEMPLOS / "estudo-exemplo.json"

    @classmethod
    def tearDownClass(cls) -> None:
        if cls._tmpdir is not None:
            cls._tmpdir.cleanup()

    def test_quantidade_estudos_pilotos(self) -> None:
        """Confere que existem exatamente os 7 estudos pilotos e o exemplo."""
        self.assertEqual(
            len(self.arquivos_pilotos),
            7,
            f"Esperados 7 estudos em {DIR_PILOTOS}, encontrados {len(self.arquivos_pilotos)}.",
        )
        self.assertTrue(self.arquivo_exemplo.is_file(), f"Arquivo {self.arquivo_exemplo} não encontrado.")

    def test_geracao_e_validacao_todos_estudos(self) -> None:
        """Gera o HTML do exemplo e dos 7 pilotos via CLI e valida todos os números contra o JSON."""
        todos_estudos = [self.arquivo_exemplo] + list(self.arquivos_pilotos)
        for caminho_json in todos_estudos:
            with self.subTest(estudo=caminho_json.name):
                caminho_html = self.dir_saida / f"{caminho_json.stem}.html"
                cmd = [
                    sys.executable,
                    "-I",
                    "-X",
                    "utf8",
                    str(DIR_RELATORIO / "relatorio.py"),
                    "--estudo",
                    str(caminho_json),
                    "--saida",
                    str(caminho_html),
                ]
                proc = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8")
                self.assertEqual(
                    proc.returncode,
                    0,
                    f"Falha ao executar CLI para {caminho_json.name}: {proc.stderr}",
                )
                self.assertTrue(caminho_html.is_file(), f"HTML não foi gerado: {caminho_html}")

                estudo_dict = json.loads(caminho_json.read_text(encoding="utf-8"))
                html_gerado = caminho_html.read_text(encoding="utf-8")
                validar_html_contra_json(html_gerado, estudo_dict)

    def test_falha_quando_numero_html_diverge_do_json(self) -> None:
        """Garante que o validador falha imediatamente se qualquer número do HTML não bater com o JSON."""
        estudo_dict = json.loads(self.arquivo_exemplo.read_text(encoding="utf-8"))
        html_correto = relatorio.gerar_html(estudo_dict)

        # Adulterar um número visível no HTML (ex.: trocar 4.684,19 por 4.999,19)
        html_adulterado = html_correto.replace("4.684,19", "4.999,19", 1)
        self.assertNotEqual(html_correto, html_adulterado)
        with self.assertRaises(AssertionError):
            validar_html_contra_json(html_adulterado, estudo_dict)

        # Adulterar um CA visível no HTML (ex.: trocar 2,105 por 2,205)
        html_adulterado_ca = html_correto.replace(">2,105<", ">2,205<", 1)
        self.assertNotEqual(html_correto, html_adulterado_ca)
        with self.assertRaises(AssertionError):
            validar_html_contra_json(html_adulterado_ca, estudo_dict)

    def test_vgv_preenchido_quando_preco_informado(self) -> None:
        """Testa que quando vgv_estimado e preco_venda_m2_privativo estão preenchidos, o valor numérico aparece e bate."""
        estudo_dict = json.loads(self.arquivo_exemplo.read_text(encoding="utf-8"))
        estudo_dict["premissas"]["preco_venda_m2_privativo"] = 8500.0
        estudo_dict["premissas"]["padrao"] = [
            p for p in estudo_dict["premissas"]["padrao"] if p != "preco_venda_m2_privativo"
        ]
        for op in estudo_dict["opcoes"]:
            op["metricas"]["vgv_estimado"] = round(op["metricas"]["area_privativa_m2"] * 8500.0, 2)

        html_com_vgv = relatorio.gerar_html(estudo_dict)
        validar_html_contra_json(html_com_vgv, estudo_dict)


if __name__ == "__main__":
    unittest.main(verbosity=2)

"""Revisão 2 estática e geração dos casos para Chrome; somente biblioteca padrão.

python -I -B -X utf8 viabilidade/revisao/tarefa2/auditar.py
"""
import copy
import hashlib
import importlib.util
import json
from html.parser import HTMLParser
from pathlib import Path
import sys

sys.dont_write_bytecode = True
AQUI = Path(__file__).resolve().parent
REF = AQUI / "referencia/viabilidade"
spec = importlib.util.spec_from_file_location("relatorio_revisado", REF / "relatorio/relatorio.py")
relatorio = importlib.util.module_from_spec(spec)
spec.loader.exec_module(relatorio)
spec_t = importlib.util.spec_from_file_location("teste_revisado", REF / "relatorio/test_relatorio.py")
sys.path.insert(0, str(REF / "relatorio"))
teste = importlib.util.module_from_spec(spec_t)
spec_t.loader.exec_module(teste)
PAYLOAD = '<img src=x onerror=alert(1)>'


def gravar(p, dados):
    assert p.resolve().is_relative_to(AQUI)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(dados, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


class Inspecao(HTMLParser):
    def __init__(self, html):
        super().__init__()
        self.sha = None
        self.numeros = {}
        self.ativos = []
        self.textos = []
        self.feed(html)

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "meta" and a.get("name") == "estudo-sha256":
            self.sha = a.get("content")
        if "data-campo" in a:
            self.numeros.setdefault(a["data-campo"], []).append(a.get("data-valor"))
        if tag in ("img", "script", "iframe", "object") or any(k.startswith("on") for k in a):
            self.ativos.append({"tag": tag, "atributos": a})

    def handle_data(self, texto):
        self.textos.append(texto)


def mudar(d, caminho, valor):
    partes = caminho.split(".")
    for parte in partes[:-1]:
        d = d[int(parte)] if isinstance(d, list) else d[parte]
    if isinstance(d, list):
        d[int(partes[-1])] = valor
    else:
        d[partes[-1]] = valor


def main():
    manifest = json.loads((AQUI / "evidencias/snapshot-sha256.json").read_text(encoding="utf-8"))
    assert all(hashlib.sha256((AQUI / "referencia" / p).read_bytes()).hexdigest() == sha for p, sha in manifest.items()), "snapshot modificado"
    entradas = [REF / "motor/exemplos/estudo-exemplo.json", *sorted((REF / "motor/exemplos/pilotos").glob("*.json"))]
    assert len(entradas) == 8
    estudos = []
    for p in entradas:
        data = p.read_bytes()
        e = json.loads(data)
        h = (REF / "relatorio/saida" / (p.stem + ".html")).read_text(encoding="utf-8")
        ins = Inspecao(h)
        sha = hashlib.sha256(data).hexdigest()
        novo = relatorio.gerar_html(e, sha)
        teste.validar_html_contra_json(novo, e)
        diffs = []
        for o in e["opcoes"]:
            for k in ("unidades_estimadas", "area_privativa_m2", "ca_usado", "to_usada", "vagas"):
                chave = f"opcoes.{o['id']}.metricas.{k}"
                vs = ins.numeros.get(chave, [])
                if not vs or any(float(v) != o["metricas"][k] for v in vs):
                    diffs.append({"campo": chave, "json": o["metricas"][k], "html": vs})
        v4 = copy.deepcopy(e)
        v4.pop("opcoes_ausentes", None)
        v4.pop("criterio_escolha", None)
        v4.pop("dominio_validade", None)
        v4_path = AQUI / "casos" / (p.stem + "-v4.json")
        gravar(v4_path, v4)
        relatorio.gerar_relatorio(v4_path, v4_path.with_suffix(".html"))
        teste.validar_html_contra_json(v4_path.with_suffix(".html").read_text(encoding="utf-8"), v4)
        novo_path = AQUI / "gerados" / (p.stem + ".html")
        novo_path.parent.mkdir(parents=True, exist_ok=True)
        novo_path.write_text(novo, encoding="utf-8")
        estudos.append({"id": p.stem, "json": str(p.relative_to(REF)).replace("\\", "/"),
            "sha_json": sha, "sha_html_commitado": ins.sha, "hash_confere": sha == ins.sha,
            "metricas_divergentes": diffs, "html_regenerado_valido": True, "v4_valido": True})
        print(p.stem, "hash", sha == ins.sha, "diferenças métricas", len(diffs), flush=True)
    gravar(AQUI / "evidencias/estudos.json", estudos)

    base = json.loads(entradas[0].read_bytes())
    base["opcoes_ausentes"] = [{"id": "X", "nome": "Ausente", "motivo": "busca_inconclusiva", "detalhe": "Teste"}]
    base["lote"]["relevo"] = {"fonte": "Teste", "resolucao_m": 30, "cota_min_m": 10, "cota_max_m": 20, "declividade_pct": 1}
    base["lote"]["areas_especiais"] = [{"tipo": "Teste", "nome": "Teste", "fonte": "Teste", "observacoes": "Teste", "conferido": False}]
    base["lote"]["anotacao_zoneamento"] = {"zona_ambigua": True, "alternativas_zona_id": ["Teste"]}
    base["lote"]["fonte"] = {"propriedades": {"loteamento": "Teste", "quadra": "Teste"}}
    base["premissas"]["texto_revisor"] = "Teste"
    campos = ["versao_motor", "lote.id", "lote.zona_id", "lote.observacoes", "lote.zona_origem",
        "lote.relevo.fonte", "lote.areas_especiais.0.tipo", "lote.areas_especiais.0.nome",
        "lote.areas_especiais.0.fonte", "lote.areas_especiais.0.observacoes",
        "lote.anotacao_zoneamento.alternativas_zona_id.0", "lote.fonte.propriedades.loteamento",
        "lote.fonte.propriedades.quadra", "zona.id", "zona.nome", "zona.observacoes",
        "zona.fontes.0.lei", "zona.fontes.0.artigo", "zona.fontes.0.url", "zona.fontes.0.data",
        "opcoes.0.id", "opcoes.0.nome", "opcoes.0.volumes.0.uso", "opcoes.0.alertas.0",
        "opcoes_ausentes.0.id", "opcoes_ausentes.0.nome", "opcoes_ausentes.0.detalhe",
        "incertezas.0", "criterio_escolha.texto", "premissas.texto_revisor"]
    casos = []
    for i, campo in enumerate(campos):
        for tipo, carga in (("img", PAYLOAD), ("aspas", '\"><img src=x onerror=alert(1)>')):
            e = copy.deepcopy(base)
            mudar(e, campo, carga)
            nome = f"xss-{i:02}-{tipo}"
            p = AQUI / "casos" / (nome + ".json")
            gravar(p, e)
            relatorio.gerar_relatorio(p, p.with_suffix(".html"))
            ins = Inspecao(p.with_suffix(".html").read_text(encoding="utf-8"))
            casos.append({"id": nome, "campo": campo, "tipo": tipo, "carga": carga, "tags_ativas": ins.ativos,
                          "texto_literal_presente": carga in "".join(ins.textos), "rejeicao_visual_esperada": False})
    for campo in ("motivo",):
        e = copy.deepcopy(base)
        e["opcoes_ausentes"][0][campo] = PAYLOAD
        p = AQUI / "casos/xss-motivo.json"
        gravar(p, e)
        relatorio.gerar_relatorio(p, p.with_suffix(".html"))
        casos.append({"id": p.stem, "campo": "opcoes_ausentes.0.motivo", "tipo": "img", "carga": PAYLOAD,
                      "tags_ativas": Inspecao(p.with_suffix(".html").read_text(encoding="utf-8")).ativos,
                      "rejeicao_visual_esperada": True})
    # A tela também aceita estes estudos sem opções: parâmetros numéricos não são validados.
    for campo in ("taxa_ocupacao", "taxa_permeabilidade"):
        e = copy.deepcopy(base)
        e["opcoes"] = []
        e["zona"]["parametros"][campo] = PAYLOAD
        p = AQUI / "casos" / ("xss-numerico-" + campo + ".json")
        gravar(p, e)
        relatorio.gerar_relatorio(p, p.with_suffix(".html"))
        ativos = Inspecao(p.with_suffix(".html").read_text(encoding="utf-8")).ativos
        assert len(ativos) == 100 and all(v["atributos"].get("onerror") == "alert(1)" for v in ativos)
        casos.append({"id": p.stem, "campo": "zona.parametros." + campo, "tipo": "img", "carga": PAYLOAD,
                      "tags_ativas": ativos, "rejeicao_visual_esperada": False})
    gravar(AQUI / "evidencias/xss-casos.json", casos)
    assert not Inspecao(relatorio.esc(PAYLOAD)).ativos
    assert len(Inspecao(PAYLOAD).ativos) == 1

    vendor = REF / "visual/vendor"
    bundle = (vendor / "three-viabilidade.min.js").read_bytes()
    metadata = json.loads((vendor / "three-viabilidade.json").read_bytes())
    atual = hashlib.sha256(bundle).hexdigest()
    assert atual == metadata["sha256"]
    licenca = {"sha256": atual, "bytes": len(bundle), "metadata_confere": True,
        "reproducao": "conferido pela central", "commit_central": "df37e7b4",
        "nota": "Tentativa local bloqueada em spawn EPERM; usuário dispensou reexecução com permissão.",
        "aviso_copyright": b"Copyright 2010-2026 Three.js Authors" in bundle,
        "spdx_mit": b"SPDX-License-Identifier: MIT" in bundle,
        "texto_completo_mit_no_bundle": b"Permission is hereby granted" in bundle,
        "arquivos_ao_lado": sorted(p.name for p in vendor.iterdir())}
    gravar(AQUI / "evidencias/vendor.json", licenca)
    print("Casos XSS:", len(casos), "com markup ativo:", sum(bool(c["tags_ativas"]) for c in casos))
    print("Pacote:", atual, "reprodução conferida pela central")


if __name__ == "__main__":
    main()

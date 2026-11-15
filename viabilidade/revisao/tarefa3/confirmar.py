"""Confirmação final: python -I -B -X utf8 viabilidade/revisao/tarefa3/confirmar.py."""
import copy
import hashlib
from html.parser import HTMLParser
import json
from pathlib import Path
import sys

sys.dont_write_bytecode = True
AQUI = Path(__file__).resolve().parent
REVISAO = AQUI.parent
VIAB = REVISAO.parent
sys.path.insert(0, str(VIAB / "relatorio"))
import relatorio
import test_relatorio


def ler(p):
    return json.loads(p.read_text("utf-8"))


def salvar(nome, valor):
    p = AQUI / nome
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(valor, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


class Detector(HTMLParser):
    def __init__(self, html):
        super().__init__()
        self.ativas = []
        self.feed(html)

    def handle_starttag(self, tag, attrs):
        if tag in {"img", "script", "iframe", "object", "embed"} or any(k.startswith("on") for k, _ in attrs):
            self.ativas.append({"tag": tag, "atributos": dict(attrs)})


def main():
    resultados = []
    antigos = []
    for modo, quantidade in (("varredura", 70), ("direcionados", 24)):
        rs = ler(AQUI / f"evidencias/{modo}.json")
        assert len(rs) == quantidade
        assert ler(AQUI / f"evidencias/{modo}-pares.json") == ler(REVISAO / f"evidencias/{modo}-pares.json")
        resultados.extend(rs)
        antigos.extend(r["id"] for r in ler(REVISAO / f"evidencias/{modo}.json") if r["perdas"])
    assert len(antigos) == 12 and len(set(antigos)) == 12
    reincidentes = [r for r in resultados if r["id"] in antigos]
    assert len(reincidentes) == 12
    assert not any(r["perdas"] or any(r["invariantes"]) for r in resultados)
    avisos = [a for r in resultados for a in r["avisos_garagem"] if a["exigido"]]
    assert avisos and all(a["presente"] for a in avisos)
    salvar("evidencias/12-pares.json", reincidentes)

    exemplo = VIAB / "motor/exemplos/estudo-exemplo.json"
    estudo = ler(exemplo)
    for campo in ("taxa_ocupacao", "taxa_permeabilidade"):
        saida = AQUI / f"casos/recusado-{campo}.html"
        try:
            relatorio.gerar_relatorio(REVISAO / f"tarefa2/casos/xss-numerico-{campo}.json", saida)
        except ValueError as erro:
            assert f"zona.parametros.{campo} deve ser número ou null" in str(erro)
        else:
            raise AssertionError(f"Payload aceito em {campo}")
        assert not saida.exists()

    # Mesma mutação do teste existente, em memória: sua limpeza temporária foi bloqueada.
    def injetar_textos(valor):
        if isinstance(valor, dict):
            return {k: injetar_textos(v) for k, v in valor.items()}
        if isinstance(valor, list):
            return [injetar_textos(v) for v in valor]
        return '<img src=x onerror=alert(1)>' if isinstance(valor, str) else valor
    assert not Detector(relatorio.gerar_html(injetar_textos(estudo))).ativas
    payload = '</title></polygon></svg><img src=x onerror=alert(1)><svg><title>'
    assert len(Detector('<img src=x onerror=alert(1)>').ativas) == 1
    assert not Detector(relatorio.esc(payload)).ativas
    caso = copy.deepcopy(estudo)
    caso["opcoes"][0]["volumes"][0]["pavimentos"] = payload
    salvar("casos/xss-pavimentos.json", caso)
    saida = AQUI / "casos/xss-pavimentos.html"
    relatorio.gerar_relatorio(AQUI / "casos/xss-pavimentos.json", saida)
    ativas = Detector(saida.read_text("utf-8")).ativas

    vendor = VIAB / "visual/vendor"
    manifesto = ler(vendor / "three-viabilidade.json")
    licenca = hashlib.sha256((vendor / "LICENSE-three.txt").read_bytes()).hexdigest()
    assert licenca == manifesto["license_sha256"]
    assert hashlib.sha256((vendor / "three-viabilidade.min.js").read_bytes()).hexdigest() == manifesto["sha256"]
    metricas = []
    for caminho in [exemplo, *sorted((VIAB / "motor/exemplos/pilotos").glob("*.json"))]:
        e = ler(caminho)
        h = relatorio.gerar_html(e)
        test_relatorio.validar_html_contra_json(h, e)
        parser = test_relatorio._ExtratorRelatorioHTML()
        parser.feed(h)
        for op in e["opcoes"]:
            spans = [s for s in parser.spans_num if s["campo"].startswith(f"opcoes.{op['id']}.metricas.")]
            metricas.append({"estudo": caminho.stem, "opcao": op["id"], "json": op["metricas"], "relatorio": spans})
    salvar("evidencias/metricas-relatorio.json", metricas)
    resumo = {"motor": ler(AQUI / "evidencias/versao.json"), "pares": len(resultados),
              "pares_antes_falhos": len(reincidentes), "perdas": 0, "invariantes_falhos": 0,
              "estudos_com_aviso_exigido": len(avisos), "avisos_ausentes": 0,
              "teste_generico_existente": "mutação equivalente em memória passou; substitui somente strings; teste original bloqueado na limpeza temporária",
              "xss_numericos_anteriores": "2 recusados sem criar HTML",
              "xss_pavimentos": ativas, "licenca_sha256": licenca, "metricas_opcoes": len(metricas)}
    salvar("evidencias/confirmacao.json", resumo)
    print(json.dumps(resumo, ensure_ascii=False, indent=2))
    return 1 if ativas else 0


if __name__ == "__main__":
    sys.exit(main())

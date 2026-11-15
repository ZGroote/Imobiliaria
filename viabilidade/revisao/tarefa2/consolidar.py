"""Confere a procedência das evidências e complementa cad94ecd, sem navegador."""
import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys

sys.dont_write_bytecode = True
AQUI = Path(__file__).resolve().parent
sys.path.insert(0, str(AQUI))
from auditar import Inspecao, PAYLOAD


def git(commit, caminho):
    return subprocess.check_output(["git", "show", f"{commit}:{caminho}"], cwd=AQUI)


def sha(data):
    return hashlib.sha256(data).hexdigest()


def main():
    manifest = json.loads((AQUI / "evidencias/snapshot-sha256.json").read_text("utf-8"))
    for caminho, esperado in manifest.items():
        assert sha((AQUI / "referencia" / caminho).read_bytes()) == esperado, caminho
        assert sha(git("83c107f0", caminho)) == esperado, caminho
    resultado = {"snapshot_83c107f0_arquivos_identicos_ao_git": len(manifest), "commits": {}}
    estudos = json.loads((AQUI / "evidencias/estudos.json").read_text("utf-8"))
    for commit in ("83c107f0", "cad94ecd"):
        entradas = []
        for estudo in estudos:
            data = git(commit, "viabilidade/" + estudo["json"])
            html = git(commit, "viabilidade/relatorio/saida/" + estudo["id"] + ".html").decode("utf-8")
            ins = Inspecao(html)
            divergencias = []
            for opcao in json.loads(data)["opcoes"]:
                for campo in ("unidades_estimadas", "area_privativa_m2", "ca_usado", "to_usada", "vagas"):
                    valores = ins.numeros.get(f"opcoes.{opcao['id']}.metricas.{campo}", [])
                    if not valores or any(float(v) != opcao["metricas"][campo] for v in valores):
                        divergencias.append(f"{opcao['id']}.{campo}")
            assert not divergencias
            confere = sha(data) == ins.sha
            assert confere == (commit == "cad94ecd")
            entradas.append({"id": estudo["id"], "sha_json": sha(data), "sha_relatorio": ins.sha,
                             "hash_confere": confere, "metricas_divergentes": divergencias})
        codigo = git(commit, "viabilidade/relatorio/relatorio.py").decode("utf-8")
        modulo = {"__name__": "relatorio_consolidacao"}
        exec(compile(codigo, commit + ":relatorio.py", "exec"), modulo)
        injecoes = []
        for campo in ("taxa_ocupacao", "taxa_permeabilidade"):
            caso = json.loads((AQUI / f"casos/xss-numerico-{campo}.json").read_text("utf-8"))
            tags = Inspecao(modulo["gerar_html"](caso)).ativos
            assert len(tags) == 100 and all(t["atributos"].get("onerror") == "alert(1)" for t in tags)
            injecoes.append({"campo": campo, "imgs_onerror": len(tags)})
        dominio = None
        if commit == "cad94ecd":
            dominio = []
            for status in ("dentro", "fora", "dados_insuficientes"):
                caso = {"dominio": {"status": status, "versao": PAYLOAD, "motivos": [PAYLOAD]}}
                html = modulo["_gerar_selo_dominio"](caso)
                assert not Inspecao(html).ativos
                dominio.append({"status": status, "tags_ativas": 0})
        visual = git(commit, "viabilidade/visual/index.html").decode("utf-8")
        formato = re.search(r"const numero = .*", visual)[0]
        assert "maximumFractionDigits: 2" in formato
        resultado["commits"][commit] = {"estudos": entradas, "xss_numericos": injecoes,
            "dominio_relatorio": dominio, "formatacao_visual": formato}
    destino = AQUI / "evidencias/consolidacao.json"
    destino.write_text(json.dumps(resultado, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Snapshot: {len(manifest)} arquivos idênticos; hashes: 0/8 em 83c107f0, 8/8 em cad94ecd.")
    print("Métricas dos relatórios: conferem nos dois commits; injeção: 100 tags em cada campo, nos dois.")


if __name__ == "__main__":
    main()

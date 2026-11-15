"""Testes do estudar.py (tarefa 13).

    python -I -X utf8 viabilidade/motor/test_estudar.py
"""
import json
import re
import sys
import tempfile
from pathlib import Path

sys.dont_write_bytecode = True
AQUI = Path(__file__).resolve().parent
sys.path.insert(0, str(AQUI))
import estudar  # noqa: E402
import novo_lote  # noqa: E402  (estudar já pôs terreno/ no path)

ARQUIVOS = {"lote.json", "estudo.json", "relatorio.html", "resumo.txt"}


def lista(pasta):
    return {p.name for p in Path(pasta).iterdir()} if Path(pasta).exists() else None


def igual(a, b, caminho="estudo"):
    """Comparação recursiva; número solto até 1e-6 (o lote novo e o piloto diferem só no arredondamento do polígono)."""
    if isinstance(a, dict) and isinstance(b, dict):
        assert a.keys() == b.keys(), f"{caminho}: chaves {sorted(a.keys() ^ b.keys())}"
        for k in a:
            igual(a[k], b[k], f"{caminho}.{k}")
    elif isinstance(a, list) and isinstance(b, list):
        assert len(a) == len(b), f"{caminho}: {len(a)} itens != {len(b)}"
        for i, (x, y) in enumerate(zip(a, b)):
            igual(x, y, f"{caminho}[{i}]")
    elif isinstance(a, (int, float)) and isinstance(b, (int, float)) and not isinstance(a, bool):
        assert abs(a - b) <= 1e-6, f"{caminho}: {a} != {b}"
    else:
        assert a == b, f"{caminho}: {a!r} != {b!r}"


def main():
    cad = novo_lote.Cadastro("completo")  # a leitura da base é o grosso do tempo; um só para todos os casos
    with tempfile.TemporaryDirectory() as tmp:
        tmp = Path(tmp)

        # (a) completo/30516 com SC-Z4 reproduz o piloto, fora os campos de origem do lote
        r = estudar.estudar("completo", [30516], "SC-Z4", tmp / "a", cadastro=cad)
        assert lista(tmp / "a") == ARQUIVOS, lista(tmp / "a")
        novo = json.loads((tmp / "a" / "estudo.json").read_text(encoding="utf-8"))
        piloto = json.loads((AQUI / "exemplos" / "pilotos" / "SC-completo-30516.json").read_text(encoding="utf-8"))
        assert novo["versao_motor"] == piloto["versao_motor"], "piloto velho: rode gerar_pilotos.py"
        # o alerta de ÁREA ESPECIAL vem do enriquecimento manual do piloto, que o lote do cadastro não traz
        for o in piloto["opcoes"]:
            o["alertas"] = [a for a in o["alertas"] if not a.startswith("ÁREA ESPECIAL")]
        for campo in ("opcoes", "opcoes_ausentes", "dominio", "caixa_maxima", "premissas", "zona"):
            igual(novo[campo], piloto[campo], campo)
        assert len(novo["opcoes"]) == 4

        # (d) a revisão bate: estudo.json, relatório e resumo
        sha = __import__("hashlib").sha256((tmp / "a" / "estudo.json").read_bytes()).hexdigest()
        html = (tmp / "a" / "relatorio.html").read_text(encoding="utf-8")
        assert re.search(r'<meta name="estudo-sha256" content="%s"' % sha, html), "meta estudo-sha256 não bate"
        assert f"rev {sha[:12]}" in html and r["revisao"] == sha[:12]
        assert f"Revisão do estudo: {sha[:12]}" in (tmp / "a" / "resumo.txt").read_text(encoding="utf-8")

        # (b) lote fora dos pilotos (8697, 3 opções e 1 ausente), pasta ainda inexistente em dois níveis
        r = estudar.estudar("completo", [8697], "SC-Z4", tmp / "b" / "fundo", cadastro=cad)
        assert lista(tmp / "b" / "fundo") == ARQUIVOS
        estudo = json.loads((tmp / "b" / "fundo" / "estudo.json").read_text(encoding="utf-8"))
        assert len(estudo["opcoes"]) == 3 and len(estudo["opcoes_ausentes"]) == 1
        resumo = (tmp / "b" / "fundo" / "resumo.txt").read_text(encoding="utf-8")
        assert "informada pelo usuário, não conferida" in resumo and "Opções ausentes: 1" in resumo
        assert estudo["opcoes_ausentes"][0]["motivo"] in resumo and 5 <= len(resumo.splitlines()) <= 10
        lote = json.loads((tmp / "b" / "fundo" / "lote.json").read_text(encoding="utf-8"))
        assert lote["id"] == "SC-completo-8697" and lote["zona_conferida"] is False
        assert (tmp / "b" / "fundo" / "relatorio.html").read_text(encoding="utf-8").lstrip().startswith("<!DOCTYPE html")

        # pasta existente mas vazia vale, e continua existindo
        (tmp / "vazia").mkdir()
        estudar.estudar("completo", [8697], "SC-Z4", tmp / "vazia", cadastro=cad)
        assert lista(tmp / "vazia") == ARQUIVOS

        # (c) recusas que não deixam pasta (nem alteram a que existe)
        for nome, args, trecho in (
            ("indice", ([10 ** 9], "SC-Z4"), "Índice inexistente"),
            ("zona", ([8697], "SC-Z99"), "Zona inexistente"),
            ("sem_frente", ([2000], "SC-Z4"), "sem frente"),
        ):
            try:
                estudar.estudar("completo", args[0], args[1], tmp / nome, cadastro=cad)
            except ValueError as e:
                assert trecho in str(e), f"{nome}: {e}"
            else:
                raise AssertionError(f"{nome}: devia recusar")
            assert not (tmp / nome).exists(), f"{nome}: deixou pasta"
        antes = {p.name: p.read_bytes() for p in (tmp / "a").iterdir()}
        try:
            estudar.estudar("completo", [30516], "SC-Z4", tmp / "a", cadastro=cad)
        except ValueError as e:
            assert "já existe" in str(e)
        else:
            raise AssertionError("pasta com arquivos devia recusar")
        assert antes == {p.name: p.read_bytes() for p in (tmp / "a").iterdir()}, "alterou a pasta existente"

        # falha no meio da gravação (3 arquivos já escritos): apaga o que criou, inclusive a pasta
        ruim = tmp / "ruim"
        orig = Path.write_bytes

        def quebra(self, dados):
            if self.name == "resumo.txt":
                raise OSError("disco cheio (teste)")
            return orig(self, dados)

        Path.write_bytes = quebra
        try:
            estudar.estudar("completo", [8697], "SC-Z4", ruim, cadastro=cad)
        except OSError as e:
            assert "disco cheio" in str(e)
        else:
            raise AssertionError("devia propagar a falha")
        finally:
            Path.write_bytes = orig
        assert not ruim.exists(), "falha na gravação deixou pasta meio pronta"

        # a linha de comando mostra a mensagem da etapa e sai com erro, sem pasta
        try:
            estudar.main(["--base", "completo", "--indices", "8697", "--zona", "SC-Z99", "--pasta", str(tmp / "cli")])
        except SystemExit as e:
            assert e.code == 2
        else:
            raise AssertionError("CLI devia sair com erro")
        assert not (tmp / "cli").exists()
    print("ok")


if __name__ == "__main__":
    main()

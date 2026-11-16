"""Testes do estudar.py (tarefa 13).

    python -I -X utf8 viabilidade/motor/test_estudar.py
"""
import contextlib
import io
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
from test_motor import confere  # noqa: E402  (as mesmas conferências de lei do motor)

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


def _chave_alerta(a):
    """ÁREA ESPECIAL: vale o tipo; o nome entre parênteses pode ser mais rico no piloto (enriquecimento manual)."""
    return re.sub(r" \([^)]*\)\.", ".", a) if a.startswith("ÁREA ESPECIAL") else a


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
        # alertas: o lote novo traz as áreas especiais sozinho (terreno tarefa 6). Todo alerta do piloto tem que estar no
        # estudo novo (o de ÁREA ESPECIAL compara o tipo, não o nome entre parênteses, que o piloto enriqueceu à mão);
        # os extras só podem ser de área especial "não verificada" ou "possível incidência".
        extras = []
        for on, op in zip(novo["opcoes"], piloto["opcoes"]):
            novos = {_chave_alerta(a) for a in on["alertas"]}
            faltam = [a for a in op["alertas"] if _chave_alerta(a) not in novos]
            assert not faltam, f"opção {on['id']}: alerta do piloto sumiu no estudo novo: {faltam}"
            velhos = {_chave_alerta(a) for a in op["alertas"]}
            extras += [(on["id"], a) for a in on["alertas"] if _chave_alerta(a) not in velhos]
        for id_, a in extras:
            area = a.startswith("ÁREA ESPECIAL") and ("nao_verificada" in a or "possível incidência" in a)
            relevo = a.startswith(("Terreno com ~", "Lote ~")) and a.endswith("podem mudar; conferir com levantamento planialtimétrico.")  # T27, só com declive/desnível altos
            assert area or relevo, f"opção {id_}: alerta extra fora do combinado: {a}"
        print(f"alertas extras no lote novo (área especial não verificada ou relevo): {len(extras)}")
        for opcoes in (novo["opcoes"], piloto["opcoes"]):
            for o in opcoes:
                o["alertas"] = []
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

        # (e) --ponto e --zona auto (terreno tarefas 5 e 7): o mesmo lote e o mesmo estudo do caminho por índice
        c = cad.geos[25297].centroid  # o Terreno testa este centroide como "concorda": 25297 -> SC-Z1
        lon, lat = novo_lote.gl.GEO.transform(c.x, c.y)
        ponto = f"{lat:.6f}, {lon:.6f}"
        estudar.estudar("completo", None, "auto", tmp / "p", cadastro=cad, ponto=ponto)
        assert lista(tmp / "p") == ARQUIVOS
        lote = json.loads((tmp / "p" / "lote.json").read_text(encoding="utf-8"))
        assert lote["fonte"]["indices_feicoes_zero_based"] == [25297] and lote["zona_id"] == "SC-Z1"
        assert lote["zona_origem"] == "sugerida_pelo_mapa" and lote["zona_conferida"] is False
        resumo = (tmp / "p" / "resumo.txt").read_text(encoding="utf-8")
        assert "Zona: SC-Z1 (sugerida pelo mapa do Plano Diretor, não conferida; outras zonas por perto: nenhuma)" in resumo, resumo
        assert "Áreas especiais encontradas: nenhuma" in resumo and "Áreas especiais não verificadas: Anexo 05, Anexo 06, Anexo 07, Anexo 06/09-A" in resumo, resumo  # terreno tarefa 13: ressalva por anexo + leis posteriores
        assert "informada pelo usuário" not in resumo
        assert 5 <= len(resumo.splitlines()) <= 12, resumo
        estudar.estudar("completo", [25297], "SC-Z1", tmp / "q", cadastro=cad)
        igual(json.loads((tmp / "p" / "estudo.json").read_text(encoding="utf-8"))["opcoes"],
              json.loads((tmp / "q" / "estudo.json").read_text(encoding="utf-8"))["opcoes"], "opcoes ponto+auto x indices+Z1")
        assert "informada pelo usuário, não conferida" in (tmp / "q" / "resumo.txt").read_text(encoding="utf-8")
        # a incerteza do estudo reconhece a origem da zona (antes dizia "sem origem informada")
        inc_p = json.loads((tmp / "p" / "estudo.json").read_text(encoding="utf-8"))["incertezas"][0]
        inc_q = json.loads((tmp / "q" / "estudo.json").read_text(encoding="utf-8"))["incertezas"][0]
        assert "NÃO conferido (sugerida pelo mapa do Plano Diretor; outras zonas por perto: nenhuma)" in inc_p, inc_p
        assert "NÃO conferido (informada pelo usuário)" in inc_q, inc_q
        for pasta in ("p", "q", "b/fundo"):
            assert "sem origem" not in (tmp / pasta / "relatorio.html").read_text(encoding="utf-8"), pasta
        # a área especial encontrada aparece na linha própria (piloto 30516: AIA)
        resumo30516 = (tmp / "a" / "resumo.txt").read_text(encoding="utf-8")
        assert "Áreas especiais encontradas: AIA (sobreposição visual)" in resumo30516, resumo30516
        assert "Áreas especiais não verificadas: Anexo 05" in resumo30516, resumo30516

        # recusas do terreno: a mensagem sai inteira e não fica pasta
        rua = "-22.042271578900, -47.894003877937"  # rua real, já testada pelo Terreno (índices próximos 110068, 110067, 110065)
        for nome, kw, trechos in (
            ("rua", dict(indices=None, zona="SC-Z4", ponto=rua), ("Nenhuma feição contém o ponto", "110068", "--indices")),
            ("divisa", dict(indices=[22421], zona="auto", ponto=None),
             ("Zona automática recusada", "Alternativas: SC-Z1, SC-EIXO", "Rode de novo com --zona SC-XX, uma destas: SC-Z1, SC-EIXO.")),
            ("ponto_ruim", dict(indices=None, zona="SC-Z4", ponto="-22,5, -47,9"), ("Ponto inválido",)),
            ("os_dois", dict(indices=[8697], zona="SC-Z4", ponto=ponto), ("--indices", "--ponto")),
            ("nenhum", dict(indices=None, zona="SC-Z4", ponto=None), ("--indices", "--ponto")),
        ):
            try:
                estudar.estudar("completo", pasta=tmp / nome, cadastro=cad, **kw)
            except ValueError as e:
                for trecho in trechos:
                    assert trecho in str(e), f"{nome}: falta {trecho!r} em: {e}"
            else:
                raise AssertionError(f"{nome}: devia recusar")
            assert not (tmp / nome).exists(), f"{nome}: deixou pasta"

        # a linha de comando aceita --ponto com coordenada negativa e mostra a recusa inteira, sem pasta
        erro = io.StringIO()
        try:
            with contextlib.redirect_stderr(erro):
                estudar.main(["--base", "completo", "--ponto", rua, "--zona", "SC-Z4", "--pasta", str(tmp / "cli2")])
        except SystemExit as e:
            assert e.code == 2
        else:
            raise AssertionError("CLI devia recusar o ponto na rua")
        assert "Nenhuma feição contém o ponto" in erro.getvalue() and not (tmp / "cli2").exists(), erro.getvalue()
        # --indices e --ponto juntos: o próprio argparse recusa
        try:
            with contextlib.redirect_stderr(io.StringIO()):
                estudar.main(["--base", "completo", "--indices", "1", "--ponto", rua, "--zona", "SC-Z4", "--pasta", str(tmp / "cli3")])
        except SystemExit as e:
            assert e.code == 2
        else:
            raise AssertionError("CLI devia recusar --indices com --ponto")
        assert not (tmp / "cli3").exists()

        # (g) tarefa 18: premissas de produto pela linha de comando. 75902 é estreito (9,2 m úteis): com apto de 60 m² só a lâmina cabe
        ponto = "-22.0175, -47.8908"
        estudar.estudar("completo", None, "auto", tmp / "g60", cadastro=cad, ponto=ponto)
        r35 = estudar.estudar("completo", None, "auto", tmp / "g35", cadastro=cad, ponto=ponto,
                              premissas=estudar.juntar_premissas(None, apto_m2=35.0))
        e60, e35 = (json.loads((tmp / n / "estudo.json").read_text(encoding="utf-8")) for n in ("g60", "g35"))
        ids60, ids35 = {o["id"] for o in e60["opcoes"]}, {o["id"] for o in e35["opcoes"]}
        assert ids60 == {"C"} and ids35 >= {"A", "B", "C"} and ids60 < ids35, (ids60, ids35)
        confere(e35)  # CA, TO, permeabilidade, recuos, altura: nenhuma opção nova passa do que a lei deixa
        assert e35["premissas"]["area_privativa_por_unidade_m2"] == 35 and "area_privativa_por_unidade_m2" not in e35["premissas"]["padrao"]
        assert "Premissas do usuário: apto 35 m²\n" in r35["resumo"], r35["resumo"]
        assert "Premissas do usuário" not in (tmp / "g60" / "resumo.txt").read_text(encoding="utf-8")
        assert estudar.juntar_premissas({"eficiencia": 0.7}, apto_m2=40.0, comum_m2=0.0, laje_min_m2=60.0) == {
            "eficiencia": 0.7, "area_privativa_por_unidade_m2": 40.0, "area_comum_por_pavimento_m2": 0.0, "laje_minima_m2": 60.0}
        assert "apto 40 m²; comum por pavimento 0 m²; laje mínima 60 m²" in estudar._linha_premissas(
            estudar.juntar_premissas(None, apto_m2=40.0, comum_m2=0.0, laje_min_m2=60.0))[0]
        # recusas: fora da faixa e conflito com --premissas, pela linha de comando, sem pasta
        (tmp / "conflito.json").write_text('{"area_privativa_por_unidade_m2": 50}', encoding="utf-8")
        for nome, extra, trecho in (
            ("apto_baixo", ["--apto-m2", "10"], "--apto-m2 10 fora da faixa"),
            ("apto_alto", ["--apto-m2", "500"], "--apto-m2 500 fora da faixa"),
            ("comum_neg", ["--comum-m2=-5"], "--comum-m2 -5 fora da faixa"),
            ("laje_baixa", ["--laje-min-m2", "5"], "--laje-min-m2 5 fora da faixa"),
            ("conflito", ["--apto-m2", "35", "--premissas", str(tmp / "conflito.json")], "use só um dos dois"),
        ):
            erro = io.StringIO()
            try:
                with contextlib.redirect_stderr(erro):
                    estudar.main(["--base", "completo", "--indices", "8697", "--zona", "SC-Z4", "--pasta", str(tmp / nome), *extra])
            except SystemExit as e:
                assert e.code == 2, nome
            else:
                raise AssertionError(f"{nome}: devia recusar")
            assert trecho in erro.getvalue() and not (tmp / nome).exists(), f"{nome}: {erro.getvalue()}"

        # (h) tarefa 19: frente presumida pelo terreno vira incerteza do estudo (e do relatório)
        for indice, trecho in ((59281, "Frente presumida (asfalto a 8.312 m, acima dos 6 m da regra): confirmar testada e alinhamento na matrícula."),
                               (94130, "Frente presumida (juntou 2 arestas colineares, asfalto a até 6 m): confirmar testada e alinhamento na matrícula.")):
            estudar.estudar("completo", [indice], {59281: "SC-Z2"}.get(indice, "auto"), tmp / f"h{indice}", cadastro=cad)
            inc = json.loads((tmp / f"h{indice}" / "estudo.json").read_text(encoding="utf-8"))["incertezas"]
            assert sum(i.startswith("Frente presumida") for i in inc) == 1 and trecho in inc, inc
            assert trecho in (tmp / f"h{indice}" / "relatorio.html").read_text(encoding="utf-8").replace("&#x27;", "'"), indice
        # (i) tarefa 21: frente pela borda da quadra tem ramo próprio (não é "asfalto acima dos 6 m")
        estudar.estudar("completo", [92058], "SC-Z4", tmp / "i", cadastro=cad)
        lote = json.loads((tmp / "i" / "lote.json").read_text(encoding="utf-8"))
        frente = lote["qualidade"]["frentes"][0]
        assert frente["regra"] == "borda_de_quadra", frente
        trecho = f"Frente presumida pela borda da quadra (sem asfalto no mapa; vão de {frente['largura_vao_m']:g} m entre quadras): conferir no local."
        inc = json.loads((tmp / "i" / "estudo.json").read_text(encoding="utf-8"))["incertezas"]
        assert sum(i.startswith("Frente presumida") for i in inc) == 1 and trecho in inc and not any("acima dos 6 m" in i for i in inc), inc
        assert trecho in (tmp / "i" / "relatorio.html").read_text(encoding="utf-8").replace("&#x27;", "'")
        # (j) tarefa 24: altura do art. 80 é medida do térreo; acrescimo_topo_m (padrão 1,5 m, não validado) soma platibanda/caixa d'água
        def estudo_(nome, indice, premissas=None):
            estudar.estudar("completo", [indice], "SC-Z1", tmp / nome, premissas=premissas, cadastro=cad)
            return json.loads((tmp / nome / "estudo.json").read_text(encoding="utf-8"))

        topo = lambda o: max(v["z0_m"] + v["altura_m"] for v in o["volumes"])
        folga = lambda o: [a for a in o["alertas"] if a.startswith("Altura: sobram")]
        e0 = estudo_("j0", 77015)  # dentro da subárea de 9 m, premissa no padrão
        assert "acrescimo_topo_m" in e0["premissas"]["padrao"] and e0["premissas"]["acrescimo_topo_m"] == 1.5, e0["premissas"]
        assert any("ninguém validou" in i for i in e0["incertezas"]), e0["incertezas"]
        assert any(abs(topo(o) - 7.5) < 1e-6 for o in e0["opcoes"]), [topo(o) for o in e0["opcoes"]]  # 2 pavimentos, 7,5 m: cabe com 1,5 m de folga
        for o in e0["opcoes"]:
            assert topo(o) + 1.5 <= 9 + 1e-6 and len(folga(o)) == 1, (o["id"], topo(o), folga(o))
            assert f"sobram {9 - topo(o):.1f} m até os 9 m de art. 80 do Plano Diretor" in folga(o)[0] and "medido do térreo, não da via" in folga(o)[0]
            assert "DEPENDE DE CONFIRMAÇÃO" not in folga(o)[0]  # folga >= 1,5 m
        z = estudo_("jz", 77015, {"acrescimo_topo_m": 0})  # sem acréscimo: cabe tudo que o motor mede até 9 m
        assert "acrescimo_topo_m" not in z["premissas"]["padrao"] and z["premissas"]["acrescimo_topo_m"] == 0
        assert all(topo(o) <= 9 + 1e-6 for o in z["opcoes"]) and len(z["opcoes"]) >= len(e0["opcoes"])
        for o in z["opcoes"]:
            assert ("DEPENDE DE CONFIRMAÇÃO" in folga(o)[0]) == (9 - topo(o) < 1.5 - 1e-6), (o["id"], topo(o), folga(o))
        e2 = estudo_("j2", 77015, {"acrescimo_topo_m": 2})
        assert e2["premissas"]["acrescimo_topo_m"] == 2
        assert all(topo(o) + 2 <= 9 + 1e-6 for o in e2["opcoes"]) and not any(abs(topo(o) - 7.5) < 1e-6 for o in e2["opcoes"]), [topo(o) for o in e2["opcoes"]]  # a de 7,5 m saiu ou mudou
        for ruim in (-1, 80, "2"):
            try:
                estudo_("jruim", 77015, {"acrescimo_topo_m": ruim})
            except ValueError as erro:
                assert "acrescimo_topo_m" in str(erro), erro
            else:
                raise AssertionError(f"acrescimo_topo_m={ruim!r} devia recusar")
        ef = estudo_("jf", 74451)  # fora da subárea: nada novo na saída
        assert "acrescimo_topo_m" not in ef["premissas"] and not any(a.startswith("Altura: sobram") for o in ef["opcoes"] for a in o["alertas"])
        assert not any(i.startswith("Frente presumida") for i in novo["incertezas"]), novo["incertezas"]  # 30516: frente normal, sem aviso

        # (i) T29: lote na divisa (terreno T23) = um estudo por candidata; 90050 (Z4|Z3, sem opção que caiba) e 85446 (Z4|Z3, com opção)
        for i, tem_opcao in ((90050, False), (85446, True)):
            pasta = tmp / f"div{i}"
            r = estudar.estudar("completo", [i], "auto", pasta, cadastro=cad)
            assert r["divisa"] == ["SC-Z4", "SC-Z3"] and lista(pasta) == {"zona-SC-Z4", "zona-SC-Z3", "resumo.txt"}, (r["divisa"], lista(pasta))
            raiz = (pasta / "resumo.txt").read_text(encoding="utf-8")
            assert "confirmar a zona na Prefeitura antes de usar qualquer um dos estudos." in raiz and raiz == r["resumo"], raiz
            for z in ("SC-Z4", "SC-Z3"):
                assert lista(pasta / f"zona-{z}") == ARQUIVOS
                lote = json.loads((pasta / f"zona-{z}" / "lote.json").read_text(encoding="utf-8"))
                est = json.loads((pasta / f"zona-{z}" / "estudo.json").read_text(encoding="utf-8"))
                assert lote["zona_id"] == z and lote["zona_origem"] == "candidata_na_divisa" and lote["zona_conferida"] is False
                assert f"zona-{z}/" in raiz and est["incertezas"][0].startswith(f"Terreno na zona {z}: NÃO conferido (uma das zonas candidatas na divisa (SC-Z4, SC-Z3)"), est["incertezas"][0]
                assert "candidatas na divisa" in (pasta / f"zona-{z}" / "resumo.txt").read_text(encoding="utf-8")
                assert "sem origem" not in (pasta / f"zona-{z}" / "relatorio.html").read_text(encoding="utf-8")
                assert bool(est["opcoes"]) == tem_opcao, (i, z)
                for o in est["opcoes"]:
                    assert sum(a.startswith("Lote na divisa entre zonas (SC-Z4 | SC-Z3, a ~") and f"supõe {z};" in a for a in o["alertas"]) == 1, o["alertas"]
        # só divisa, mas uma candidata só (75352-75354): recusa de hoje, sem pasta
        try:
            estudar.estudar("completo", [75352, 75353, 75354], "auto", tmp / "div1", cadastro=cad)
        except ValueError as e:
            assert "Zona automática recusada" in str(e) and "Rode de novo com --zona SC-XX, uma destas: SC-Z2." in str(e), e
        else:
            raise AssertionError("divisa com uma candidata só devia recusar")
        assert not (tmp / "div1").exists()
        # falha na gravação do segundo estudo apaga tudo, inclusive as subpastas
        orig, n = Path.write_bytes, [0]
        def morre(self, dados):
            n[0] += 1
            if n[0] == 6:
                raise OSError("disco cheio")
            return orig(self, dados)
        Path.write_bytes = morre
        try:
            estudar.estudar("completo", [90050], "auto", tmp / "divruim", cadastro=cad)
        except OSError:
            pass
        else:
            raise AssertionError("devia propagar a falha")
        finally:
            Path.write_bytes = orig
        assert not (tmp / "divruim").exists()
    print("ok")


if __name__ == "__main__":
    main()

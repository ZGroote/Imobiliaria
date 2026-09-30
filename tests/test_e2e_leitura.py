"""M1-F: leitura fixada -> M1-0 -> M1-A -> contexto explícito -> maquete LEVE local.

Roda o consumidor de verdade: pagina_maquete.py gera o artefato e a sonda
(tools/sonda-maquete.mjs, Node) executa o FloorPlan embutido nele.
"""
import copy
import hashlib
import json
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
import unittest
from unittest import mock

from pipeline import e2e_leitura as e2e
from pipeline.normalizar_planta import serializar

RAIZ = Path(__file__).resolve().parents[1]
LEITURAS = RAIZ / "tests" / "fixtures" / "leitura" / "v1"
CONTEXTO_ARQ = RAIZ / "tests" / "fixtures" / "m1f" / "contexto-sintetico.json"
CONTEXTO = json.loads(CONTEXTO_ARQ.read_text(encoding="utf-8"))


def leitura(nome="exemplo-geometrico"):
    return json.loads((LEITURAS / (nome + ".json")).read_text(encoding="utf-8"))


def entrada(l, reading_id="leitura-m1f-v1", version=1):
    """O par que o M1-E fixa: o snapshot como o M1-D grava e o productionInput do pedido."""
    l = json.loads(serializar(l))                 # o M1-D persiste a forma canônica
    h = hashlib.sha256(serializar(l)).hexdigest()
    snap = {"id": reading_id, "propertyId": "m1f-sintetico", "agencyId": "agA",
            "version": version, "revision": l["revision"], "schemaVersion": l["schemaVersion"],
            "contentSha256": h, "leitura": l, "basedOnVersionId": None}
    pi = {"readingId": reading_id, "readingVersion": version, "readingRevision": l["revision"],
          "schemaVersion": l["schemaVersion"], "contentSha256": h, "fixedBy": "op"}
    return {"schema": 1, "snapshot": snap,
            "pedido": {"id": "pedido-m1f", "agencyId": "agA", "propertyId": "m1f-sintetico",
                       "productionInput": pi}}


def dados_da_pagina(pasta):
    html = (Path(pasta) / "maquete.html").read_text(encoding="utf-8")
    return json.loads(re.search(r'<script id="__imovel" type="application/json">(.*?)</script>',
                                html, re.S).group(1))


class Base(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp(prefix="m1f-"))
        self.addCleanup(shutil.rmtree, self.tmp, True)

    def rodar(self, ent, ctx=CONTEXTO, nome="saida"):
        return e2e.executar(ent, ctx, self.tmp / nome), self.tmp / nome

    def recusa(self, ent, ctx=CONTEXTO):
        """Recusa sem nunca chegar à página nem deixar pasta para trás."""
        with mock.patch.object(e2e, "gerar", side_effect=AssertionError("chegou à página")):
            with self.assertRaises(e2e.Recusa) as cm:
                e2e.executar(ent, ctx, self.tmp / "recusado")
        self.assertFalse((self.tmp / "recusado").exists())
        return {e["code"] for e in cm.exception.errors}


class CaminhoFeliz(Base):
    def test_leitura_fixada_chega_ao_consumidor_e_o_relatorio_amarra_tudo(self):
        ent = entrada(leitura())
        rel, pasta = self.rodar(ent)
        pi = ent["pedido"]["productionInput"]
        self.assertEqual(rel["entrada"], {"pedidoId": "pedido-m1f", "propertyId": "m1f-sintetico",
                                          "agencyId": "agA", **{k: pi[k] for k in e2e.PONTEIRO}})
        self.assertEqual((rel["normalizador"]["id"], rel["normalizador"]["version"]),
                         ("nominal-floor-plan", "1.0.0"))
        g = rel["geometria"]
        self.assertEqual((g["conferida"], g["comodos"], g["portas"], g["janelas"], g["pe_direito"]),
                         (True, 8, 7, 4, 2.7))
        dado = (pasta / "maquete.html").read_bytes()
        self.assertEqual(rel["artefato"]["sha256"], hashlib.sha256(dado).hexdigest())
        self.assertEqual(rel["artefato"]["id"], rel["artefato"]["sha256"][:12])
        self.assertNotIn(b"\r\n", dado)
        self.assertEqual((pasta / "relatorio.json").read_bytes(), serializar(rel))

        # O artefato carrega a planta DA LEITURA e o vínculo dela, e nada do acervo por id.
        D = dados_da_pagina(pasta)
        self.assertIsNone(D["_id"])
        planta = D["cadastro"]["planta"]
        self.assertEqual(planta["entrada"], {**{k: pi[k] for k in e2e.PONTEIRO},
                                             "normalizer": "nominal-floor-plan@1.0.0"})
        derivada = e2e.resolver_entrada(ent)["planta"]
        for chave in ("pe_direito", "comodos", "portas", "janelas"):
            self.assertEqual(planta[chave], derivada[chave], chave)
        self.assertNotIn("moveis", planta)
        self.assertFalse((RAIZ / "plantas_fornecidas" / "m1f-sintetico").exists())
        self.assertEqual(list(self.tmp.glob(".e2e-*")), [])


class Rastreabilidade(Base):
    @classmethod
    def setUpClass(cls):
        cls.base = Path(tempfile.mkdtemp(prefix="m1f-v1-"))
        cls.rel1 = e2e.executar(entrada(leitura()), CONTEXTO, cls.base / "v1")

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.base, True)

    def test_leitura_nova_muda_planta_geometria_e_artefato(self):
        l2 = leitura()
        l2["revision"] = 2
        janela = next(o for o in l2["openings"] if o["id"] == "window-1")
        janela["offsetMm"] += 200                 # a janela anda 20 cm na parede oeste
        rel2, pasta2 = self.rodar(entrada(l2, "leitura-m1f-v2", 2))
        for campo in ("contentSha256", "readingId", "readingVersion", "readingRevision"):
            self.assertNotEqual(rel2["entrada"][campo], self.rel1["entrada"][campo], campo)
        for parte in ("planta", "geometria", "artefato"):
            self.assertNotEqual(rel2[parte]["sha256"], self.rel1[parte]["sha256"], parte)
        # e a diferença no que o consumidor montou é exatamente a janela, 20 cm adiante
        e1 = e2e.sondar(self.base / "v1" / "maquete.html")["geometria"]["esquadrias"]
        e2 = e2e.sondar(pasta2 / "maquete.html")["geometria"]["esquadrias"]
        so1 = [e for e in e1 if e not in e2]
        so2 = [e for e in e2 if e not in e1]
        self.assertEqual((len(so1), len(so2)), (1, 1))
        self.assertAlmostEqual(so2[0]["a"][1] - so1[0]["a"][1], 0.2, places=6)
        self.assertEqual((so1[0]["a"][0], so2[0]["a"][0]), (so1[0]["b"][0], so2[0]["b"][0]))

    def test_so_dado_comercial_nao_finge_planta_nova(self):
        ctx = copy.deepcopy(CONTEXTO)
        ctx["ficha"]["preco"] = 450000
        rel, pasta = self.rodar(entrada(leitura()), ctx)
        self.assertNotEqual(rel["artefato"]["sha256"], self.rel1["artefato"]["sha256"])
        self.assertNotEqual(rel["contexto"]["sha256"], self.rel1["contexto"]["sha256"])
        for parte in ("entrada", "normalizador"):
            self.assertEqual(rel[parte], self.rel1[parte], parte)
        for parte in ("planta", "geometria"):
            self.assertEqual(rel[parte]["sha256"], self.rel1[parte]["sha256"], parte)
        self.assertEqual(dados_da_pagina(pasta)["cadastro"]["planta"],
                         dados_da_pagina(self.base / "v1")["cadastro"]["planta"])

    def test_predio_girado_assenta_outra_vez_a_mesma_planta(self):
        ctx = copy.deepcopy(CONTEXTO)
        ctx["lote"]["predio"].update(largura_m=12, profundidade_m=16)   # eixo maior em z
        rel, _ = self.rodar(entrada(leitura()), ctx)
        self.assertTrue(rel["geometria"]["conferida"])
        self.assertEqual(rel["geometria"]["sha256"], self.rel1["geometria"]["sha256"])
        self.assertNotEqual(rel["artefato"]["sha256"], self.rel1["artefato"]["sha256"])


class Recusas(Base):
    def test_ponteiro_que_nao_e_o_snapshot(self):
        for campo, valor in (("contentSha256", "ab" * 32), ("readingId", "outra"),
                             ("readingVersion", 2), ("readingRevision", 9), ("schemaVersion", "1.0.1")):
            ent = entrada(leitura())
            ent["pedido"]["productionInput"][campo] = valor
            with self.subTest(campo=campo):
                self.assertEqual(self.recusa(ent), {"PONTEIRO_DIVERGENTE"})

    def test_conteudo_adulterado_com_hashes_intactos(self):
        ent = entrada(leitura())
        ent["snapshot"]["leitura"]["rooms"][0]["name"] = "Sala trocada"
        self.assertEqual(self.recusa(ent), {"CONTEUDO_ADULTERADO"})

    def test_snapshot_de_outro_imovel_ou_agencia(self):
        for campo in ("propertyId", "agencyId"):
            ent = entrada(leitura())
            ent["snapshot"][campo] = "outro"
            with self.subTest(campo=campo):
                self.assertEqual(self.recusa(ent), {"VINCULO_DIVERGENTE"})

    def test_entrada_malformada(self):
        for ent in ({}, {"schema": 1, "pedido": {}, "snapshot": {}}, [1]):
            with self.subTest(ent=ent):
                self.assertEqual(self.recusa(ent), {"ENTRADA_INVALIDA"})

    def test_geometria_que_o_m1_0_nao_aceita(self):
        self.assertEqual(self.recusa(entrada(leitura("geometria-nao-suportada"))),
                         {"UNSUPPORTED_GEOMETRY"})

    def test_geometria_valida_no_m1_0_que_o_consumidor_aproximaria(self):
        fora = leitura("comodo-unico")
        fora["rooms"][0]["widthMm"] += 3                     # 3 mm fora da grade de 5 cm
        self.assertEqual(self.recusa(entrada(fora)), {"FORA_DA_GRADE"})
        estreita = leitura("apartamento-simples")
        next(o for o in estreita["openings"] if o["kind"] == "window")["widthMm"] = 150
        self.assertEqual(self.recusa(entrada(estreita)), {"VAO_ESTREITO"})

    def test_contexto_nao_traz_geometria_nem_e_de_outro_imovel(self):
        casos = (
            ({"planta": {"comodos": []}}, "CONTEXTO_INVALIDO"),
            ({"propertyId": "outro"}, "CONTEXTO_DE_OUTRO_IMOVEL"),
            ({"agencyId": "agB"}, "CONTEXTO_DE_OUTRO_IMOVEL"),
            ({"andar": 5}, "CONTEXTO_INVALIDO"),
            ({"lote": {"predio": {"largura_m": 16, "pavimentos": 5}}}, "CONTEXTO_INVALIDO"),
            ({"lote": {"predio": {"largura_m": 9, "profundidade_m": 7, "pavimentos": 5}}},
             "CONTEXTO_NAO_COMPORTA"),
            ({"cores": {"parede": "branco"}}, "CONTEXTO_INVALIDO"),
            ({"schema": 2}, "CONTEXTO_INVALIDO"),
        )
        for mudanca, codigo in casos:
            ctx = {**copy.deepcopy(CONTEXTO), **mudanca}
            with self.subTest(mudanca=mudanca):
                self.assertEqual(self.recusa(entrada(leitura()), ctx), {codigo})

    def test_destino_ocupado(self):
        (self.tmp / "recusado").mkdir()
        (self.tmp / "recusado" / "x").write_text("x")
        with mock.patch.object(e2e, "gerar", side_effect=AssertionError("chegou à página")):
            with self.assertRaises(e2e.Recusa) as cm:
                e2e.executar(entrada(leitura()), CONTEXTO, self.tmp / "recusado")
        self.assertEqual({e["code"] for e in cm.exception.errors}, {"DESTINO_OCUPADO"})


class Conferencia(Base):
    """O consumidor real não diverge das leituras válidas; a conferência precisa pegar
    quando divergir, e aí o artefato não fica."""

    @classmethod
    def setUpClass(cls):
        cls.pasta = Path(tempfile.mkdtemp(prefix="m1f-sonda-"))
        cls.ent = entrada(leitura())
        e2e.executar(cls.ent, CONTEXTO, cls.pasta / "v1")
        cls.sonda = e2e.sondar(cls.pasta / "v1" / "maquete.html")
        cls.derivada = e2e.resolver_entrada(cls.ent)

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.pasta, True)

    def divergencias(self, mexe):
        s = copy.deepcopy(self.sonda)
        mexe(s)
        return {e["path"] for e in e2e.conferir(self.derivada, s, self.ent["pedido"]["productionInput"])}

    def test_consumidor_fiel_passa(self):
        self.assertEqual(self.divergencias(lambda s: None), set())

    def test_cada_divergencia_e_apontada(self):
        g = lambda s: s["geometria"]
        casos = (
            (lambda s: g(s)["esquadrias"].pop(), "/aberturas"),                 # vão sumiu
            (lambda s: g(s)["esquadrias"][0].update(y1=2.3), "/aberturas"),     # altura
            (lambda s: g(s)["esquadrias"][0]["b"].__setitem__(1, g(s)["esquadrias"][0]["b"][1] + .01),
             "/aberturas"),                                                     # 1 cm de largura
            (lambda s: g(s)["esquadrias"][0].update(porta=not g(s)["esquadrias"][0]["porta"]),
             "/aberturas"),                                                     # porta vira janela
            (lambda s: g(s)["comodos"][0]["poly"][0].__setitem__(0, g(s)["comodos"][0]["poly"][0][0] + .01),
             "/comodos"),                                                       # 1 cm de parede
            (lambda s: g(s)["comodos"][0].update(nome="Outro"), "/comodos"),
            (lambda s: g(s)["comodos"].pop(), "/comodos"),
            (lambda s: g(s).update(pd=2.6), "/pd"),
            (lambda s: s["entrada"].update(contentSha256="ab" * 32), "/entrada"),
        )
        for mexe, caminho in casos:
            with self.subTest(caminho=caminho):
                self.assertEqual(self.divergencias(mexe), {caminho})

    def test_divergencia_descarta_o_artefato(self):
        falsa = copy.deepcopy(self.sonda)
        falsa["geometria"]["esquadrias"].pop()
        with mock.patch.object(e2e, "sondar", return_value=falsa):
            with self.assertRaises(e2e.Recusa) as cm:
                e2e.executar(self.ent, CONTEXTO, self.tmp / "divergente")
        self.assertEqual({e["code"] for e in cm.exception.errors}, {"GEOMETRIA_DIVERGENTE"})
        self.assertFalse((self.tmp / "divergente").exists())
        self.assertEqual(list(self.tmp.glob(".e2e-*")), [])


class Cli(Base):
    def test_codigos_de_saida(self):
        ent = self.tmp / "entrada.json"
        ruim = entrada(leitura())
        ruim["pedido"]["productionInput"]["contentSha256"] = "ab" * 32
        ent.write_text(json.dumps(ruim), encoding="utf-8")
        r = subprocess.run([sys.executable, "-m", "pipeline.e2e_leitura", str(ent), str(CONTEXTO_ARQ),
                            "--destino", str(self.tmp / "x")], cwd=str(RAIZ), capture_output=True)
        self.assertEqual(r.returncode, 2)
        self.assertEqual(json.loads(r.stdout)["valid"], False)
        self.assertFalse((self.tmp / "x").exists())

        ent.write_text(json.dumps(entrada(leitura())), encoding="utf-8")
        r = subprocess.run([sys.executable, "-m", "pipeline.e2e_leitura", str(ent), str(CONTEXTO_ARQ),
                            "--destino", str(self.tmp / "ok")], cwd=str(RAIZ), capture_output=True)
        self.assertEqual(r.returncode, 0, r.stderr)
        rel = json.loads(r.stdout)
        self.assertTrue(rel["geometria"]["conferida"])
        self.assertEqual((self.tmp / "ok" / "relatorio.json").read_bytes(), r.stdout)


if __name__ == "__main__":
    unittest.main()

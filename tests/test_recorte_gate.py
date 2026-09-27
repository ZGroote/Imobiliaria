"""O gate do recorte: o tour por imóvel não sai com um prédio que não é o da cidade inteira.

`pipeline/recorte.py` confere o bloco recortado contra o inteiro durante a própria montagem
(`diverge`). A divergência levanta `IdentidadeQuebrada` e aborta a geração. Estes testes não
montam cidade: usam uma de cinco prédios, montada à mão.

A biblioteca urbana tem 100 modelos, e os lotes usam índices esparsos (60, 70, 80). Com isso a
poda remapeia os índices (60 vira 38), e a checagem pelo ID do modelo, e não pelo índice, é
exercitada de verdade.
"""
import copy
import json
import sys
import unittest
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RAIZ))
from pipeline import recorte  # noqa: E402
from pipeline.recorte import IdentidadeQuebrada, Recorte, diverge  # noqa: E402

# b[] em decímetros (q=10): [cor, altura, n_vertices, x0, z0]. Quarteirão A em volta de
# (0, 0), com os prédios 0, 1 e 2; quarteirão B a 1000 m, com os prédios 3 e 4.
CIDADE = {
    "v": 1, "c": [0, 0], "q": 10,
    "names": ["N0", "A0", "N1", "A1", "N3", "A3", "N4", "A4"],
    "b": [1, 30, 1, 0, 0,
          2, 31, 1, 50, 0,
          3, 32, 1, 0, 50,
          4, 40, 1, 10000, 0,
          5, 41, 1, 10050, 0],
    "bm": [0, 0, 1, 1, 2, 3, 3, 4, 5, 4, 6, 7],          # o prédio 2 não tem nome
    "bl": [0, 0, 100, 0, 3, 10000, 0, 100, 3, 2],
    "fa": [100, 200, 300, 400, 500],
    "r": [], "g": [],
    "urbanLots": {"0": [60, 1, 2, 3], "1": [70, 4, 5, 6], "3": [80, 7, 8, 9], "4": [5, 1, 1, 1]},
}
BIBLIOTECA = {"assets": [{"id": "casa-%d" % i} for i in range(100)]}


def recortado(cls=Recorte):
    """(recorte, cheia, cidade recortada, biblioteca recortada) de uma montagem correta."""
    r = cls((0, 0), 100)
    corte = json.loads(r.citydata(json.dumps(CIDADE)))
    lib = json.loads(r.urbanModels(json.dumps(BIBLIOTECA)))
    return r, copy.deepcopy(CIDADE), corte, lib


class CorretoTests(unittest.TestCase):
    def test_correct_crop_passes_and_keeps_identity(self):
        r, cheia, corte, lib = recortado()
        self.assertEqual(r.relatorio["predios"], (5, 3))
        self.assertEqual(corte["fa"], [100, 200, 300])
        # o índice do modelo mudou (a biblioteca encolheu), mas o modelo é o mesmo
        self.assertNotEqual(corte["urbanLots"]["0"][0], 60)
        self.assertEqual(lib["assets"][corte["urbanLots"]["0"][0]]["id"], "casa-60")
        self.assertEqual(lib["assets"][corte["urbanLots"]["1"][0]]["id"], "casa-70")
        self.assertEqual(diverge(cheia, corte, BIBLIOTECA, lib), [])

    def test_the_gate_only_reads(self):
        # A saída com o gate é, byte a byte, a do corte sem ele.
        sem_gate = json.dumps(Recorte((0, 0), 100)._corta_cidade(json.loads(json.dumps(CIDADE))),
                              ensure_ascii=False, separators=(",", ":"))
        self.assertEqual(Recorte((0, 0), 100).citydata(json.dumps(CIDADE)), sem_gate)

    def test_two_buildings_starting_at_the_same_point_are_not_a_false_alarm(self):
        cidade = copy.deepcopy(CIDADE)
        cidade["b"][5:10] = [9, 90, 1, 0, 0]       # o prédio 1 começa onde o 0 começa
        r = Recorte((0, 0), 100)
        r.citydata(json.dumps(cidade))              # não pode levantar
        r.urbanModels(json.dumps(BIBLIOTECA))


class MutacaoTests(unittest.TestCase):
    """Cada mutação artificial do recorte vira exatamente uma divergência do tipo certo."""

    def tipos(self, muda, lib_muda=None):
        _, cheia, corte, lib = recortado()
        muda(corte)
        if lib_muda:
            lib_muda(lib)
        return [e[0] for e in diverge(cheia, corte, BIBLIOTECA, lib)]

    def test_height(self):
        self.assertEqual(self.tipos(lambda c: c["b"].__setitem__(1, 99)), ["geometria"])

    def test_name(self):
        self.assertEqual(self.tipos(lambda c: c["bm"].__setitem__(1, 2)), ["nome"])

    def test_facade(self):
        self.assertEqual(self.tipos(lambda c: c["fa"].__setitem__(0, 999)), ["fa"])

    def test_model_by_id(self):
        def troca(lib):                               # mesmo índice, outro modelo
            lib["assets"].reverse()
        self.assertEqual(self.tipos(lambda c: None, troca), ["modelo urbano", "modelo urbano"])

    def test_urban_lot_transform(self):
        self.assertEqual(self.tipos(lambda c: c["urbanLots"]["0"].__setitem__(1, 42)), ["urbanLot"])

    def test_urban_lot_missing(self):
        self.assertEqual(self.tipos(lambda c: c["urbanLots"].pop("1")), ["urbanLot ausente"])

    def test_building_without_match(self):
        self.assertEqual(self.tipos(lambda c: c["b"].__setitem__(3, 12345)), ["sem par"])

    def test_duplicated_building_with_a_single_match_fails(self):
        # Uma cópia do prédio 0 no recorte, igual em tudo (geometria, nome, fa, lote e
        # modelo), com um único correspondente na cidade inteira: o casamento é 1:1.
        def duplica(c):
            c["b"].extend(c["b"][0:5])
            c["fa"].append(c["fa"][0])
            c["bm"].extend([3, c["bm"][1], c["bm"][2]])
            c["urbanLots"]["3"] = list(c["urbanLots"]["0"])
        self.assertEqual(self.tipos(duplica), ["duplicado"])

    def test_facade_array_removed_fails(self):
        self.assertEqual(self.tipos(lambda c: c.pop("fa")), ["fa ausente"] * 3)

    def test_facade_array_too_short_fails_without_index_error(self):
        self.assertEqual(self.tipos(lambda c: c.__setitem__("fa", c["fa"][:2])), ["fa ausente"])


class GateNaMontagemTests(unittest.TestCase):
    """A divergência aborta a própria montagem, não um relatório depois."""

    def test_citydata_aborts(self):
        class Quebrado(Recorte):
            def _corta_cidade(self, c):
                c = super()._corta_cidade(c)
                c["b"][1] = 99                         # altura errada no primeiro prédio
                return c
        with self.assertRaisesRegex(IdentidadeQuebrada, "__citydata"):
            Quebrado((0, 0), 100).citydata(json.dumps(CIDADE))

    def test_urban_models_aborts(self):
        class Quebrado(Recorte):
            def _corta_modelos(self, d):
                d = super()._corta_modelos(d)
                d["assets"].reverse()                  # índice certo, modelo errado
                return d
        r = Quebrado((0, 0), 100)
        r.citydata(json.dumps(CIDADE))
        with self.assertRaisesRegex(IdentidadeQuebrada, "__urbanModels"):
            r.urbanModels(json.dumps(BIBLIOTECA))

    def test_the_abort_is_a_runtime_error(self):
        # O build por imóvel trata como falha qualquer exceção da montagem.
        self.assertTrue(issubclass(IdentidadeQuebrada, RuntimeError))


class OrdemTests(unittest.TestCase):
    """Chamar os blocos fora da ordem continua falhando, e não vira biblioteca vazia."""

    def test_urban_models_before_citydata(self):
        with self.assertRaisesRegex(RuntimeError, "antes de __citydata"):
            Recorte((0, 0), 100).urbanModels(json.dumps(BIBLIOTECA))

    def test_urban_models_before_citydata_through_aplica(self):
        with self.assertRaisesRegex(RuntimeError, "antes de __citydata"):
            Recorte((0, 0), 100).aplica("__urbanModels", json.dumps(BIBLIOTECA))

    def test_light_before_units(self):
        with self.assertRaisesRegex(RuntimeError, "antes de __unidades"):
            Recorte((0, 0), 100).luzue(json.dumps({"x": 1}))

    def test_self_proof_of_the_module(self):
        recorte._prova()


if __name__ == '__main__':
    unittest.main()

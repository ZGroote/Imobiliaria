"""O sorteio do portão tem que ser o MESMO em toda execução.

Antes era `hash(("portao", i))`: o `hash()` de string é randomizado por processo, então
cada rodada da etapa 6b mexia o portão das 74 mil casas e a etapa não podia ser
conferida por comparação de saída. Estes números são o cadeado: mudar a fórmula move
portão de cidade, e tem que ser uma decisão, não um efeito colateral.
"""
import subprocess
import sys
import unittest

from pipeline.portoes import sorteio


class SorteioTests(unittest.TestCase):
    def test_known_values(self):
        self.assertEqual([sorteio(i) for i in range(5)],
                         [1648414829, 357032187, 206483777, 2068414935, 1697453172])

    def test_pure_function_of_the_index(self):
        self.assertEqual(sorteio(74139), sorteio(74139))
        self.assertNotEqual(sorteio(10), sorteio(11))

    def test_stable_across_hash_seeds(self):
        """Roda em outro processo, com semente de hash diferente: mesmo resultado."""
        codigo = ('import sys; sys.path.insert(0, ".");'
                  'from pipeline.portoes import sorteio;'
                  'print([sorteio(i) for i in (0, 1, 7, 74139)])')
        saidas = set()
        for semente in ('0', '7', 'random'):
            r = subprocess.run([sys.executable, '-c', codigo], capture_output=True, text=True,
                               env={'PYTHONHASHSEED': semente, 'PATH': ''})
            self.assertEqual(r.returncode, 0, r.stderr)
            saidas.add(r.stdout.strip())
        self.assertEqual(len(saidas), 1, 'o sorteio mudou com a semente: %s' % saidas)

    def test_side_and_kind_both_come_from_it(self):
        """Lado (bit 0) e tipo (bits 3+) usam o mesmo número; os dois têm que variar."""
        lados = {sorteio(i) & 1 for i in range(200)}
        tipos = {(sorteio(i) >> 3) % 4 for i in range(200)}
        self.assertEqual(lados, {0, 1})
        self.assertEqual(tipos, {0, 1, 2, 3})


if __name__ == '__main__':
    unittest.main()

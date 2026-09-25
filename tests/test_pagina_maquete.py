"""A ficha da maquete: a área mostrada leva o nome da área que ela é.

`area_util` e `area_total` são números diferentes, e quem compara imóvel compara pelo rótulo.
Quando o cadastro só tem a total, ela aparece como "Área total", nunca como "Área útil".
"""
import importlib.util
import unittest
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[1]
# `v1.5` tem ponto no nome e não é pacote: o módulo é carregado pelo caminho.
_spec = importlib.util.spec_from_file_location('pagina_maquete', RAIZ / 'v1.5/miniaturas/pagina_maquete.py')
pagina_maquete = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(pagina_maquete)
linha = pagina_maquete.linha_de_area


class LinhaDeArea(unittest.TestCase):
    def test_rotulo_e_o_da_area_mostrada(self):
        # com a útil, é ela que aparece, como hoje (os pilotos têm as duas, iguais)
        self.assertEqual(linha({'area_util': 37.28, 'area_total': 37.28}), ('Área útil', '37,3 m²'))
        self.assertEqual(linha({'area_util': 37.28, 'area_total': 45.0}), ('Área útil', '37,3 m²'))
        # sem a útil, a total aparece com o nome de total
        self.assertEqual(linha({'area_total': 45.0}), ('Área total', '45,0 m²'))
        self.assertEqual(linha({'area_util': None, 'area_total': 45.0}), ('Área total', '45,0 m²'))
        self.assertEqual(linha({'area_util': 0, 'area_total': 45.0}), ('Área total', '45,0 m²'))
        # nenhuma das duas: a ficha não inventa área nem rótulo
        self.assertIsNone(linha({}))
        self.assertIsNone(linha({'area_util': None, 'area_total': None}))

    def test_a_total_nunca_sai_como_util(self):
        for f in ({'area_total': 45.0}, {'area_util': None, 'area_total': 58.0}, {'area_util': 0, 'area_total': 1.0}):
            self.assertNotEqual(linha(f)[0], 'Área útil', f)


if __name__ == '__main__':
    unittest.main()

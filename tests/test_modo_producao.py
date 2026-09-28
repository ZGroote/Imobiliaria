# -*- coding: utf-8 -*-
"""Produto explícito da maquete: LEVE/PREMIUM sem fallback silencioso."""
import runpy
from pathlib import Path
import unittest

RAIZ = Path(__file__).resolve().parents[1]
M = runpy.run_path(str(RAIZ / 'pipeline/modo_producao.py'))
B = runpy.run_path(str(RAIZ / 'pipeline/build_imovel.py'))

CEDROS = 'monte-dos-cedros-37'
COLINAS = 'monte-das-colinas-39'
CAST = 'wish-castanheiras-58'


class ResolverModoTests(unittest.TestCase):
    def test_sem_modo_preserva_historico(self):
        self.assertEqual(M['resolver'](CEDROS), 'premium')
        self.assertEqual(M['resolver'](COLINAS), 'leve')
        self.assertEqual(M['resolver'](CAST), 'leve')

    def test_modo_explicito_e_autoridade(self):
        self.assertEqual(M['resolver'](CEDROS, 'leve'), 'leve')
        self.assertEqual(M['resolver'](CEDROS, 'premium'), 'premium')
        self.assertEqual(M['resolver'](COLINAS, 'leve'), 'leve')
        self.assertEqual(M['resolver'](CAST, 'leve'), 'leve')

    def test_premium_sem_pacote_falha_fechado(self):
        for uid in (COLINAS, CAST):
            with self.subTest(uid=uid), self.assertRaisesRegex(ValueError, 'PREMIUM_UNAVAILABLE'):
                M['resolver'](uid, 'premium')

    def test_modo_invalido_nao_e_acomodado(self):
        with self.assertRaisesRegex(ValueError, 'PRODUCTION_MODE_INVALID'):
            M['resolver'](CEDROS, 'ultra')


class FontesDoProdutoTests(unittest.TestCase):
    def rel(self, paths):
        return {Path(p).resolve().relative_to(RAIZ).as_posix() for p in paths}

    def test_cedros_premium_usa_padrao_aprovado_e_nao_modelo_leve(self):
        fontes = self.rel(B['fontes_da_maquete'](CEDROS, 'premium'))
        self.assertIn('v1.5/miniaturas/padrao_atual.py', fontes)
        self.assertTrue(any(p.startswith('v1.5/miniaturas/padrao-atual/') for p in fontes))
        self.assertNotIn('v1.5/miniaturas/monte-dos-cedros_blender/modelo.json', fontes)

    def test_cedros_leve_usa_modelo_leve_e_nao_padrao_premium(self):
        fontes = self.rel(B['fontes_da_maquete'](CEDROS, 'leve'))
        self.assertIn('v1.5/miniaturas/monte-dos-cedros_blender/modelo.json', fontes)
        self.assertIn('v1.5/miniaturas/editor_cedros.js', fontes)
        self.assertNotIn('v1.5/miniaturas/padrao_atual.py', fontes)
        self.assertFalse(any(p.startswith('v1.5/miniaturas/padrao-atual/') for p in fontes))

    def test_resolvedor_de_modo_faz_parte_da_proveniencia(self):
        for uid, modo in ((CEDROS, 'leve'), (CEDROS, 'premium'), (COLINAS, 'leve'), (CAST, 'leve')):
            with self.subTest(uid=uid, modo=modo):
                fontes = self.rel(B['fontes_da_maquete'](uid, modo))
                self.assertIn('pipeline/modo_producao.py', fontes)


class ContratoDaPaginaTests(unittest.TestCase):
    def test_pagina_recebe_modo_explicito_e_nao_decide_por_id_cru(self):
        codigo = (RAIZ / 'v1.5/miniaturas/pagina_maquete.py').read_text(encoding='utf-8')
        self.assertIn('MODO = arg("--modo")', codigo)
        self.assertIn('modo = modo_producao.resolver(UNIDADE, MODO)', codigo)
        self.assertIn("if modo == 'premium':", codigo)
        self.assertNotIn("if UNIDADE == 'monte-dos-cedros-37' and '--geometria-base'", codigo)

    def test_build_passa_modo_para_pagina(self):
        codigo = (RAIZ / 'pipeline/build_imovel.py').read_text(encoding='utf-8')
        self.assertIn("'--mapa', 'tour.html', '--modo', modo", codigo)
        self.assertIn("parser.add_argument('--modo'", codigo)


if __name__ == '__main__':
    unittest.main()

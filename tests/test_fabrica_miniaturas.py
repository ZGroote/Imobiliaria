# -*- coding: utf-8 -*-
"""M1 da fábrica: orquestração local, sem preview e sem esconder checks não medidos."""
import hashlib
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from pipeline import fabrica_miniaturas as F


class EntradaTests(unittest.TestCase):
    def test_cedros_e_entrada_valida_do_piloto(self):
        r = F.validar_entrada('monte-dos-cedros-37')
        self.assertEqual((r['cidade'], r['variante'], r['unidade']),
                         ('sao-carlos', 'v16-moveis', 'monte-dos-cedros-37'))
        self.assertGreater(r['comodos'], 0)

    def test_mirra_fica_blocked_antes_de_qualquer_build(self):
        with self.assertRaises(F.Bloqueado) as e:
            F.validar_entrada('mirra-114')
        self.assertEqual(e.exception.codigo, 'ORIGIN_UNCONFIRMED')


class FontesTests(unittest.TestCase):
    def test_runner_assina_as_fontes_extras_do_build_imovel(self):
        """M1 não pode declarar proveniência menor que a do build que ele orquestra."""
        with patch.object(F, 'entradas', return_value=[]), \
             patch.object(F.build_imovel, 'fontes_da_maquete', return_value=[]):
            r = F.resolver_fontes('monte-dos-cedros-37')
        caminhos = set(r['caminhos'])
        esperados = {
            'tasks/v1.0/piloto.json',
            'exteriores/v1/terrenos-manifesto.json',
            'pipeline/build_imovel.py',
            'pipeline/imovel.py',
            'pipeline/recorte.py',
        }
        self.assertLessEqual(esperados, caminhos)
        self.assertEqual(len(r['sha256']), 64)


class RunnerTests(unittest.TestCase):
    def test_blocked_para_a_linha_e_grava_relatorio(self):
        with tempfile.TemporaryDirectory() as tmp:
            report = Path(tmp) / 'report.json'
            with patch.object(F, 'validar_entrada',
                              side_effect=F.Bloqueado('INPUT_MISSING', 'sem planta')), \
                 patch.object(F, 'resolver_fontes') as fontes, \
                 patch.object(F, 'construir') as build:
                r = F.executar('x-1', builds=Path(tmp) / 'builds', relatorio_path=report)
            self.assertEqual(r['status'], 'blocked')
            self.assertEqual([j['jobType'] for j in r['jobs']], ['validar_entrada'])
            self.assertEqual(r['jobs'][0]['error']['code'], 'INPUT_MISSING')
            fontes.assert_not_called()
            build.assert_not_called()
            self.assertEqual(json.loads(report.read_text(encoding='utf-8')), r)
            self.assertFalse((report.parent / ('.' + report.name + '.tmp')).exists())

    def test_sucesso_registra_os_cinco_jobs_sem_preview(self):
        with tempfile.TemporaryDirectory() as tmp:
            report = Path(tmp) / 'report.json'
            build = {'build': 'aaaaaaaaaaaa', 'reutilizado': True, 'pasta': 'x'}
            conferido = {'build': 'aaaaaaaaaaaa', 'reutilizado': True,
                         'manifest_sha256': 'f' * 64, 'arquivos': {}}
            with patch.object(F, 'validar_entrada',
                              return_value={'cidade': 'sao-carlos', 'variante': 'v16-moveis'}), \
                 patch.object(F, 'resolver_fontes',
                              return_value={'sha256': '1' * 64, 'fontes': 3}), \
                 patch.object(F, 'verificar_maquete',
                              return_value={'sha256': '2' * 64, 'perfil': 'premium-atual'}), \
                 patch.object(F, 'construir', return_value=build), \
                 patch.object(F, 'verificar_build', return_value=conferido):
                r = F.executar('monte-dos-cedros-37',
                               builds=Path(tmp) / 'builds', relatorio_path=report)
            self.assertEqual(r['status'], 'succeeded')
            self.assertEqual([j['jobType'] for j in r['jobs']],
                             ['validar_entrada', 'resolver_fontes', 'verificar_maquete',
                              'build_imovel', 'verificar_build'])
            self.assertTrue(all(j['status'] == 'succeeded' for j in r['jobs']))
            self.assertTrue(all(len(j['inputSha256']) == 64 for j in r['jobs']))
            self.assertFalse(r['preview']['executed'])
            self.assertEqual(r['qa']['browserVisual'], 'not_run')
            self.assertEqual(r['result']['build'], 'aaaaaaaaaaaa')
            self.assertEqual(json.loads(report.read_text(encoding='utf-8')), r)

    def test_falha_tecnica_e_diferente_de_blocked(self):
        with tempfile.TemporaryDirectory() as tmp:
            with patch.object(F, 'validar_entrada', side_effect=RuntimeError('quebrou')):
                r = F.executar('x-1', builds=Path(tmp) / 'b',
                               relatorio_path=Path(tmp) / 'r.json')
            self.assertEqual(r['status'], 'failed')
            self.assertEqual(r['jobs'][0]['status'], 'failed')
            self.assertEqual(r['jobs'][0]['error']['type'], 'RuntimeError')


class BuildIntegrityTests(unittest.TestCase):
    def cenario(self, raiz):
        imovel = 'x-1'
        tour, maq = b'<tour>\n', b'<maq>\n'
        build = hashlib.sha256(tour + maq).hexdigest()[:12]
        pasta = Path(raiz) / imovel / build
        pasta.mkdir(parents=True)
        (pasta / 'tour.html').write_bytes(tour)
        (pasta / 'maquete.html').write_bytes(maq)
        arquivos = {
            'tour.html': {'bytes': len(tour), 'sha256': hashlib.sha256(tour).hexdigest()},
            'maquete.html': {'bytes': len(maq), 'sha256': hashlib.sha256(maq).hexdigest()},
        }
        manifest = {'schema': 1, 'imovel': imovel, 'build': build, 'arquivos': arquivos}
        (pasta / 'manifest.json').write_text(json.dumps(manifest), encoding='utf-8')
        return imovel, build, pasta

    def test_verifica_bytes_manifest_e_id(self):
        with tempfile.TemporaryDirectory() as tmp:
            imovel, build, _ = self.cenario(tmp)
            r = F.verificar_build(imovel, {'build': build, 'reutilizado': False}, Path(tmp))
            self.assertEqual(r['build'], build)
            self.assertFalse(r['reutilizado'])
            self.assertEqual(set(r['arquivos']), {'tour.html', 'maquete.html'})
            self.assertEqual(len(r['manifest_sha256']), 64)

    def test_mutacao_do_html_reprova(self):
        with tempfile.TemporaryDirectory() as tmp:
            imovel, build, pasta = self.cenario(tmp)
            (pasta / 'tour.html').write_bytes(b'<alterado>\n')
            with self.assertRaisesRegex(ValueError, 'tour.html difere do manifest'):
                F.verificar_build(imovel, {'build': build, 'reutilizado': True}, Path(tmp))


class CliTests(unittest.TestCase):
    def test_exit_codes_sao_estaveis(self):
        casos = [('succeeded', 0), ('blocked', 2), ('failed', 1)]
        for status, esperado in casos:
            with self.subTest(status), patch.object(
                    F, 'executar',
                    return_value={'property': 'x', 'status': status, 'jobs': [],
                                  'report': 'r.json', 'preview': {'executed': False}}):
                self.assertEqual(F.main(['x']), esperado)


if __name__ == '__main__':
    unittest.main()

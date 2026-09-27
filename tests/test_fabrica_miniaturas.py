# -*- coding: utf-8 -*-
"""Fábrica local: geração LEVE isolada/cacheada + build, ainda sem preview."""
import hashlib
import json
import os
from pathlib import Path
import subprocess
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

    def test_modelo_leve_ausente_e_saida_geravel_nao_input_missing(self):
        with tempfile.TemporaryDirectory() as tmp:
            modelo = Path(tmp) / 'modelo.json'
            with patch.object(F, 'entradas', return_value=[]), \
                 patch.object(F.build_imovel, 'fontes_da_maquete',
                              return_value=[modelo]), \
                 patch.object(F, '_modelo_geravel', return_value=modelo):
                r = F.resolver_fontes('monte-das-colinas-39')
            self.assertEqual(r['fontes_geradas'], [str(modelo)])
            self.assertNotIn(str(modelo), r['fontes_maquete'])


class LeveDescricaoTests(unittest.TestCase):
    def test_tres_fixtures_tem_assinatura_leve(self):
        for uid, profile in (
            ('monte-dos-cedros-37', 'montes-mrv-v1'),
            ('monte-das-colinas-39', 'montes-mrv-v1'),
            ('wish-castanheiras-58', 'castanheiras-ebm-v1'),
        ):
            with self.subTest(uid=uid):
                r = F.descrever_leve(uid)
                self.assertEqual(r['profile'], profile)
                self.assertEqual(len(r['sha256']), 64)
                self.assertEqual(len(r['canonicalSha256']), 64)
                self.assertIn('v1.5/miniaturas/modelar_imovel.py', r['code'])

    def test_imovel_sem_perfil_vira_unsupported_case(self):
        with patch.object(F.fonte_leve, 'normalizar',
                          side_effect=F.fonte_leve.FonteLeveErro('sem perfil')):
            with self.assertRaises(F.Bloqueado) as e:
                F.descrever_leve('x')
        self.assertEqual(e.exception.codigo, 'UNSUPPORTED_CASE')


class BlenderTests(unittest.TestCase):
    def test_caminho_explicito_ausente_bloqueia(self):
        with tempfile.TemporaryDirectory() as tmp:
            with self.assertRaises(F.Bloqueado) as e:
                F.resolver_blender(Path(tmp) / 'nao-existe.exe')
        self.assertEqual(e.exception.codigo, 'ENVIRONMENT_MISSING')

    def test_versao_incompativel_bloqueia(self):
        with tempfile.TemporaryDirectory() as tmp:
            exe = Path(tmp) / 'blender'
            exe.write_bytes(b'x')
            proc = subprocess.CompletedProcess([str(exe), '--version'], 0,
                                               'Blender 5.1.0\n', '')
            with patch.object(F.subprocess, 'run', return_value=proc):
                with self.assertRaises(F.Bloqueado) as e:
                    F.resolver_blender(exe)
        self.assertEqual(e.exception.codigo, 'ENVIRONMENT_MISMATCH')


class LeveGeracaoTests(unittest.TestCase):
    def _fake_blender(self, desc, modelo=b'{"ok":true}', checks=True):
        def run(args, **kwargs):
            raiz = Path(kwargs['env']['LEVE_OUTPUT_ROOT'])
            out = raiz / (desc['slug'] + '_blender')
            out.mkdir(parents=True)
            (out / 'modelo.json').write_bytes(modelo)
            (out / (desc['slug'] + '.glb')).write_bytes(b'glTF' + b'\0' * 8)
            (out / 'validacao.json').write_text(
                json.dumps({'checks': {'gate': checks}}), encoding='utf-8')
            return subprocess.CompletedProcess(args, 0, 'MODEL_READY\n', '')
        return run

    def test_gera_isolado_promove_deterministicos_e_segunda_rodada_cacheia(self):
        desc = F.descrever_leve('monte-das-colinas-39')
        with tempfile.TemporaryDirectory() as tmp:
            raiz = Path(tmp)
            cache = raiz / 'cache' / 'leve-state.json'
            destino = raiz / 'destino'
            ambiente = {'path': 'blender-falso', 'version': 'Blender 5.2.2 LTS'}
            with patch.object(F, 'resolver_blender', return_value=ambiente), \
                 patch.object(F.subprocess, 'run',
                              side_effect=self._fake_blender(desc)):
                r1 = F.gerar_leve('monte-das-colinas-39', cache_path=cache,
                                  dest_root=destino, descricao=desc)
            self.assertFalse(r1['cached'])
            self.assertTrue((destino / (desc['slug'] + '_blender') / 'modelo.json').is_file())
            self.assertTrue(cache.is_file())

            with patch.object(F, 'resolver_blender',
                              side_effect=AssertionError('não deveria procurar Blender')), \
                 patch.object(F.subprocess, 'run',
                              side_effect=AssertionError('não deveria executar Blender')):
                r2 = F.gerar_leve('monte-das-colinas-39', cache_path=cache,
                                  dest_root=destino, descricao=desc)
            self.assertTrue(r2['cached'])
            self.assertEqual(r1['outputs'], r2['outputs'])

    def test_cache_adulterado_com_validacao_invalida_e_regenerado(self):
        desc = F.descrever_leve('monte-das-colinas-39')
        with tempfile.TemporaryDirectory() as tmp:
            raiz = Path(tmp)
            cache = raiz / 'cache' / 'leve-state.json'
            destino = raiz / 'destino'
            ambiente = {'path': 'blender-falso', 'version': 'Blender 5.2.2 LTS'}
            with patch.object(F, 'resolver_blender', return_value=ambiente), \
                 patch.object(F.subprocess, 'run',
                              side_effect=self._fake_blender(desc)):
                F.gerar_leve('monte-das-colinas-39', cache_path=cache,
                             dest_root=destino, descricao=desc)

            paths = F._artefatos_leve('monte-das-colinas-39', destino)
            paths['validacao.json'].write_text(
                json.dumps({'checks': {'gate': False}}), encoding='utf-8')
            state = json.loads(cache.read_text(encoding='utf-8'))
            state['outputs'] = F._hashes_existentes(paths)
            cache.write_text(json.dumps(state), encoding='utf-8')

            with patch.object(F, 'resolver_blender', return_value=ambiente), \
                 patch.object(F.subprocess, 'run',
                              side_effect=self._fake_blender(desc)):
                r = F.gerar_leve('monte-das-colinas-39', cache_path=cache,
                                 dest_root=destino, descricao=desc)
            self.assertFalse(r['cached'])
            self.assertTrue(
                json.loads(paths['validacao.json'].read_text(encoding='utf-8'))
                ['checks']['gate'])

    def test_check_falso_nao_promove_saida(self):
        desc = F.descrever_leve('wish-castanheiras-58')
        with tempfile.TemporaryDirectory() as tmp:
            raiz = Path(tmp)
            destino = raiz / 'destino'
            with patch.object(F, 'resolver_blender',
                              return_value={'path': 'b', 'version': 'Blender 5.2.2'}), \
                 patch.object(F.subprocess, 'run',
                              side_effect=self._fake_blender(desc, checks=False)):
                with self.assertRaisesRegex(ValueError, 'check não aprovado'):
                    F.gerar_leve('wish-castanheiras-58',
                                 cache_path=raiz / 'cache/state.json',
                                 dest_root=destino, descricao=desc)
            self.assertFalse((destino / (desc['slug'] + '_blender') / 'modelo.json').exists())

    def test_saida_local_divergente_bloqueia_promocao(self):
        destinos = {
            'modelo.json': F.RAIZ / 'v1.5/miniaturas/__teste-nao-existe/modelo.json',
            'x.glb': F.RAIZ / 'v1.5/miniaturas/__teste-nao-existe/x.glb',
            'validacao.json': F.RAIZ / 'v1.5/miniaturas/__teste-nao-existe/validacao.json',
        }
        proc = subprocess.CompletedProcess([], 0, ' M v1.5/miniaturas/x\n', '')
        with patch.object(F.subprocess, 'run', return_value=proc):
            with self.assertRaises(F.Bloqueado) as e:
                F._promocao_segura(destinos, None)
        self.assertEqual(e.exception.codigo, 'LOCAL_OUTPUT_DIRTY')


class ModeladoresTests(unittest.TestCase):
    def test_geradores_respeitam_saida_isolada_sem_mudar_default(self):
        for nome in ('modelar_montes.py', 'modelar_castanheiras.py'):
            with self.subTest(nome=nome):
                codigo = (F.MINI_ROOT / nome).read_text(encoding='utf-8')
                self.assertIn("LEVE_OUTPUT_ROOT", codigo)
                self.assertIn("str(ROOT)", codigo)


class RunnerTests(unittest.TestCase):
    def test_blocked_para_a_linha_e_grava_relatorio(self):
        with tempfile.TemporaryDirectory() as tmp:
            report = Path(tmp) / 'report.json'
            with patch.object(F, 'validar_entrada',
                              side_effect=F.Bloqueado('INPUT_MISSING', 'sem planta')), \
                 patch.object(F, 'resolver_fontes') as fontes, \
                 patch.object(F, 'gerar_leve') as leve, \
                 patch.object(F, 'construir') as build:
                r = F.executar('x-1', builds=Path(tmp) / 'builds', relatorio_path=report)
            self.assertEqual(r['status'], 'blocked')
            self.assertEqual([j['jobType'] for j in r['jobs']], ['validar_entrada'])
            self.assertEqual(r['jobs'][0]['error']['code'], 'INPUT_MISSING')
            fontes.assert_not_called()
            leve.assert_not_called()
            build.assert_not_called()
            self.assertEqual(json.loads(report.read_text(encoding='utf-8')), r)
            self.assertFalse((report.parent / ('.' + report.name + '.tmp')).exists())

    def test_sucesso_registra_seis_jobs_sem_preview(self):
        with tempfile.TemporaryDirectory() as tmp:
            report = Path(tmp) / 'report.json'
            build = {'build': 'aaaaaaaaaaaa', 'reutilizado': True, 'pasta': 'x'}
            conferido = {'build': 'aaaaaaaaaaaa', 'reutilizado': True,
                         'manifest_sha256': 'f' * 64, 'arquivos': {}}
            desc = {'property': 'x', 'profile': 'p', 'slug': 's',
                    'canonicalSha256': 'c' * 64, 'code': {}, 'sha256': 'd' * 64}
            leve = {'profile': 'p', 'slug': 's', 'cached': True,
                    'inputSha256': 'd' * 64, 'blender': None,
                    'outputs': {'modelo.json': {'bytes': 1, 'sha256': 'e' * 64}}}
            with patch.object(F, 'validar_entrada',
                              return_value={'cidade': 'sao-carlos', 'variante': 'v16-moveis'}), \
                 patch.object(F, 'resolver_fontes',
                              return_value={'sha256': '1' * 64, 'fontes': 3}), \
                 patch.object(F, 'descrever_leve', return_value=desc), \
                 patch.object(F, 'gerar_leve', return_value=leve), \
                 patch.object(F, 'verificar_maquete',
                              return_value={'sha256': '2' * 64, 'perfil': 'premium-atual'}), \
                 patch.object(F, 'construir', return_value=build), \
                 patch.object(F, 'verificar_build', return_value=conferido):
                r = F.executar('monte-dos-cedros-37',
                               builds=Path(tmp) / 'builds', relatorio_path=report)
            self.assertEqual(r['status'], 'succeeded')
            self.assertEqual([j['jobType'] for j in r['jobs']],
                             ['validar_entrada', 'resolver_fontes', 'gerar_leve',
                              'verificar_maquete', 'build_imovel', 'verificar_build'])
            self.assertTrue(all(j['status'] == 'succeeded' for j in r['jobs']))
            self.assertTrue(all(len(j['inputSha256']) == 64 for j in r['jobs']))
            self.assertFalse(r['preview']['executed'])
            self.assertEqual(r['qa']['browserVisual'], 'not_run')
            self.assertEqual(r['result']['build'], 'aaaaaaaaaaaa')
            self.assertTrue(r['result']['leveCached'])
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

"""Recuperação do cache e substituição atômica dos arquivos de controle."""
from contextlib import redirect_stderr, redirect_stdout
import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch


SPEC = importlib.util.spec_from_file_location('processo_testado', Path(__file__).resolve().parents[1] / 'processar_anuncio.py')
processo = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(processo)
URL = 'https://example.com/imovel/123'


class ProcessoTests(unittest.TestCase):
    def setUp(self):
        folder = tempfile.TemporaryDirectory()
        self.addCleanup(folder.cleanup)
        self.destino = Path(folder.name)
        self.job = self.destino / 'processo.json'
        self.anuncio_path = self.destino / 'anuncio.json'
        self.stderr = io.StringIO()
        self.manifesto = {'url': URL, 'fotos': [{'arquivo': 'fachada.jpg', 'sha256': hashlib.sha256(b'foto').hexdigest()}]}
        (self.destino / 'fachada.jpg').write_bytes(b'foto')

    def preparar(self, *extra):
        with redirect_stdout(io.StringIO()), redirect_stderr(self.stderr):
            return processo.main([URL, '--destino', str(self.destino), '--preparar', *extra])

    def processo_existente(self, url=URL):
        self.job.write_text(json.dumps({'url': url, 'status': 'aguardando_revisao'}), encoding='utf-8')

    def rejeitar(self, *extra):
        with self.assertRaises(SystemExit) as error:
            self.preparar(*extra)
        self.assertEqual(error.exception.code, 2)
        self.assertNotIn('Traceback', self.stderr.getvalue())

    def test_truncated_or_invalid_process_is_preserved_without_extraction(self):
        for contents in ['{"url":', '[]', '{"status":"extraindo"}']:
            with self.subTest(contents=contents):
                self.job.write_text(contents, encoding='utf-8')
                with patch('extrair_anuncio.extrair') as extrair:
                    self.rejeitar('--atualizar-fotos')
                extrair.assert_not_called()
                self.assertEqual(self.job.read_text(encoding='utf-8'), contents)
                self.assertIn('processo.json inválido', self.stderr.getvalue())
                self.assertIn('nova pasta', self.stderr.getvalue())

    def test_process_of_another_url_is_never_overwritten(self):
        self.processo_existente('https://example.com/imovel/999')
        before = self.job.read_bytes()
        with patch('extrair_anuncio.extrair') as extrair:
            self.rejeitar('--atualizar-fotos')
        extrair.assert_not_called()
        self.assertEqual(self.job.read_bytes(), before)

    def test_update_recovers_truncated_manifest_with_confirmed_url(self):
        self.processo_existente()
        self.anuncio_path.write_text('{"url":', encoding='utf-8')

        def extrair(url, destino, **kwargs):
            self.assertEqual(url, URL)
            (destino / 'anuncio.json').write_text(json.dumps(self.manifesto), encoding='utf-8')
            return self.manifesto

        with patch('extrair_anuncio.extrair', side_effect=extrair) as mocked:
            self.assertEqual(self.preparar('--atualizar-fotos'), 0)
        mocked.assert_called_once()
        self.assertEqual(json.loads(self.anuncio_path.read_text(encoding='utf-8')), self.manifesto)
        state = json.loads(self.job.read_text(encoding='utf-8'))
        self.assertEqual((state['url'], state['status']), (URL, 'referencias_coletadas'))

    def test_truncated_manifest_without_update_retains_previous_state(self):
        self.processo_existente()
        before = self.job.read_bytes()
        self.anuncio_path.write_text('{"url":', encoding='utf-8')
        with patch('extrair_anuncio.extrair') as extrair:
            self.rejeitar()
        extrair.assert_not_called()
        self.assertEqual(self.job.read_bytes(), before)
        self.assertIn('--atualizar-fotos', self.stderr.getvalue())

    def test_truncated_manifest_without_process_cannot_claim_directory(self):
        self.anuncio_path.write_text('{"url":', encoding='utf-8')
        with patch('extrair_anuncio.extrair') as extrair:
            self.rejeitar('--atualizar-fotos')
        extrair.assert_not_called()
        self.assertFalse(self.job.exists())
        self.assertEqual(self.anuncio_path.read_text(encoding='utf-8'), '{"url":')

    def test_readable_manifest_of_another_url_is_not_replaced_on_update(self):
        self.processo_existente()
        before = self.job.read_bytes()
        other = json.dumps({'url': 'https://example.com/imovel/999', 'fotos': []})
        self.anuncio_path.write_text(other, encoding='utf-8')
        with patch('extrair_anuncio.extrair') as extrair:
            self.rejeitar('--atualizar-fotos')
        extrair.assert_not_called()
        self.assertEqual(self.job.read_bytes(), before)
        self.assertEqual(self.anuncio_path.read_text(encoding='utf-8'), other)

    def test_repeated_prepare_reuses_valid_gallery(self):
        self.processo_existente()
        self.anuncio_path.write_text(json.dumps(self.manifesto), encoding='utf-8')
        with patch('extrair_anuncio.extrair') as extrair:
            self.assertEqual(self.preparar(), 0)
            self.assertEqual(self.preparar(), 0)
        extrair.assert_not_called()
        self.assertEqual(json.loads(self.job.read_text(encoding='utf-8'))['url'], URL)

    def test_atomic_write_keeps_complete_old_file_until_replace(self):
        self.processo_existente()
        before = self.job.read_bytes()
        replacement = {'url': URL, 'status': 'referencias_coletadas', 'nota': 'referências'}
        replace = os.replace

        def observe(source, target):
            self.assertEqual(self.job.read_bytes(), before)
            self.assertEqual(Path(source).parent, self.job.parent)
            self.assertEqual(json.loads(Path(source).read_text(encoding='utf-8')), replacement)
            replace(source, target)

        with patch.object(processo.os, 'replace', side_effect=observe):
            processo.gravar(self.job, replacement)
        self.assertEqual(json.loads(self.job.read_text(encoding='utf-8')), replacement)
        self.assertEqual(list(self.destino.glob('.*.tmp')), [])

    def test_failed_atomic_replace_preserves_old_file_and_cleans_temporary(self):
        self.processo_existente()
        before = self.job.read_bytes()
        with patch.object(processo.os, 'replace', side_effect=OSError('simulated interrupted replacement')):
            with self.assertRaises(OSError):
                processo.gravar(self.job, {'url': URL, 'status': 'extraindo'})
        self.assertEqual(self.job.read_bytes(), before)
        self.assertEqual(list(self.destino.glob('.*.tmp')), [])


if __name__ == '__main__':
    unittest.main()

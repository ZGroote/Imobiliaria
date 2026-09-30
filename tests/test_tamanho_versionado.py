"""Trava de tamanho: arquivo grande só entra no repositório com classificação.

O inventário e a decisão de cada arquivo estão em tasks/higiene-repositorio/arquivos-grandes.md.
Este teste é a trava do CI, com quatro regras:

1. Todo arquivo versionado acima de 1 MiB precisa estar em EXCECOES, com classe e motivo.
2. Nenhum arquivo cresce além do teto dele em GRANDES: o tamanho de 27/09/2026, arredondado
   para cima até o MiB inteiro.
3. O repositório inteiro, somado, não passa de TOTAL_MAX.
4. Cada entrada de GRANDES existe e continua acima de 1 MiB. Quando o arquivo sai, ou encolhe
   para 1 MiB ou menos, a entrada sai daqui e do inventário no mesmo PR, e a lista continua sendo
   o inventário exato.

GRANDES deriva os tetos de EXCECOES, sem segunda lista manual.
Arquivo grande novo, ou um que cresceu, entra com a linha dele aqui e no inventário. Essa é a
classificação explícita. O tamanho medido é o do blob no índice do git, e não o do disco: no
Windows, a conversão de fim de linha muda o tamanho do arquivo no disco.
"""
import subprocess
import tempfile
import unittest
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[1]
MiB = 1 << 20
LIMITE = 1 * MiB
TOTAL_MAX = 300 * MiB           # 280,3 MiB em 27/09/2026; a folga é para o que é pequeno
GITHUB_DURO = 100 * MiB         # o GitHub recusa acima disso; avisa a partir de 50

# caminho -> (teto em MiB, classe principal, justificativa de permanência).
# Não usar globs: cada exceção nova precisa de motivo revisável no mesmo PR.
EXCECOES = {
    'sao-carlos/dados/lotes_saocarlos_completo.geojson':
        (63, 'fonte', 'Base de lotes consumida pelo build; entradas de regeneracao ausentes do Git.'),
    'lotes_saocarlos.geojson':
        (36, 'fonte', 'Fallback de consolidar/encaixar_casas_lotes; sem gerador versionado.'),
    'v1.5/miniaturas/padrao-atual/exterior-v3/geometry-compact.json':
        (16, 'runtime', 'Geometria do exterior PREMIUM consumida pela pagina do Cedros.'),
    'v1.5/miniaturas/padrao-atual/exterior-v3/lightmap.rgbm.gz':
        (7, 'runtime', 'Iluminacao do exterior PREMIUM; regeneracao depende de bake GPU.'),
    'v1.5/miniaturas/padrao-atual/piloto-v3/geometry-compact.json':
        (7, 'runtime', 'Geometria do interior PREMIUM consumida pela pagina do Cedros.'),
    'v1.5/miniaturas/padrao-atual/piloto-v3/lightmap.rgbm.gz':
        (7, 'runtime', 'Iluminacao do interior PREMIUM; regeneracao depende de bake GPU.'),
    'sao-carlos/sao-carlos-v7.city.json':
        (5, 'runtime', 'Cidade consumida pela montagem; city_base nao esta no Git.'),
    'modelos_urbanos/v1/mapa-casas.json':
        (5, 'runtime', 'Catalogo usado pela montagem urbana e pelos exteriores.'),
    'sao-carlos/dados/street_tris.json':
        (5, 'runtime', 'Malha viaria consumida pela montagem; quadras fonte fora do Git.'),
    'v1.5/miniaturas/maquete-wish-castanheiras-58.html':
        (4, 'runtime', 'Pagina consumida por preparar_publicacao.py; regeneracao equivalente nao provada.'),
    'sao-carlos/dados/muros_segs.json':
        (4, 'runtime', 'Segmentos de muros consumidos pela montagem da cidade.'),
    'v1.5/miniaturas/padrao-atual/anterior/v2.html':
        (4, 'fonte', 'Template historico ainda usado pelo PREMIUM do Cedros; nao e descarte.'),
    'v1.5/miniaturas/maquete-monte-das-colinas-39.html':
        (4, 'runtime', 'Pagina consumida por preparar_publicacao.py; regeneracao equivalente nao provada.'),
    'exteriores/v1/mapa-exteriores.json':
        (3, 'runtime', 'Exterior gerado no Blender, consumido pela montagem e ferramentas de exteriores.'),
    'v1.5/miniaturas/castanheiras_blender/modelo.json':
        (2, 'runtime', 'Modelo LEVE consumido pela maquete de Castanheiras.'),
    'modelos_urbanos/v1/integracao/encaixes-sao-carlos.json':
        (2, 'gerado', 'Cache validado pela montagem; recalculo caro, preservado sem limpeza automatica.'),
    'exteriores/v1/componentes.json':
        (2, 'runtime', 'Biblioteca de componentes consumida pela montagem e exteriores.'),
    'v1.5/miniaturas/monte-dos-cedros_blender/modelo.json':
        (2, 'runtime', 'Modelo do caminho LEVE do Cedros; PREMIUM nao o substitui.'),
    'v1.5/miniaturas/monte-das-colinas_blender/modelo.json':
        (2, 'runtime', 'Modelo LEVE consumido pela maquete de Colinas.'),
    'arvores/arvores_lib.json':
        (2, 'runtime', 'Biblioteca de arvores consumida pela montagem urbana.'),
    'sao-carlos/dados/portoes.json':
        (2, 'runtime', 'Portoes consumidos pela montagem da cidade.'),
    'v1.5/miniaturas/castanheiras_blender/castanheiras.blend':
        (2, 'fonte', 'Projeto editavel LEVE; equivalencia de regeneracao nao provada.'),
}
GRANDES = {c: dados[0] for c, dados in EXCECOES.items()}


def tamanhos(raiz=RAIZ):
    """{caminho: bytes do blob} de tudo que está no índice do git."""
    lista = subprocess.run(['git', 'ls-files', '-s', '-z'], cwd=raiz, capture_output=True,
                           check=True).stdout.decode('utf-8').split('\0')
    blobs = {}
    for linha in filter(None, lista):
        meta, caminho = linha.split('\t', 1)
        blobs[caminho] = meta.split()[1]
    saida = subprocess.run(['git', 'cat-file', '--batch-check=%(objectname) %(objectsize)'],
                           cwd=raiz, input='\n'.join(blobs.values()) + '\n',
                           capture_output=True, check=True, text=True).stdout.split('\n')
    por_sha = dict(l.split() for l in saida if l.strip())
    return {c: int(por_sha[s]) for c, s in blobs.items()}


def violacoes(t, grandes=GRANDES):
    """As três regras sobre um {caminho: bytes}. Função pura, para a trava ter teste próprio."""
    fora = sorted('%s: %d bytes > limite %d bytes; falta excecao justificada'
                  % (c, n, LIMITE) for c, n in t.items() if n > LIMITE and c not in grandes)
    acima = sorted('%s: %d bytes > teto %d bytes' % (c, t[c], teto * MiB)
                   for c, teto in grandes.items() if c in t and t[c] > teto * MiB)
    total = sum(t.values())
    return fora, acima, (total if total > TOTAL_MAX else None)


def encolhidos(t, grandes=GRANDES):
    """Entradas de GRANDES que existem mas não estão mais acima de LIMITE."""
    return sorted(c for c in grandes if c in t and t[c] <= LIMITE)


class TamanhoVersionadoTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.t = tamanhos()

    def test_no_unclassified_large_file(self):
        fora, _, _ = violacoes(self.t)
        self.assertFalse(fora, 'arquivo acima de 1 MiB sem classificação')

    def test_no_large_file_grows_past_its_ceiling(self):
        _, acima, _ = violacoes(self.t)
        self.assertFalse(acima, 'arquivo grande cresceu além do teto')

    def test_repository_total_stays_under_the_ceiling(self):
        _, _, total = violacoes(self.t)
        self.assertIsNone(total, 'repositório passou de %d MiB' % (TOTAL_MAX // MiB))

    def test_nothing_near_githubs_hard_limit(self):
        self.assertFalse([c for c, n in self.t.items() if n > GITHUB_DURO])

    def test_the_list_is_the_inventory(self):
        faltam = sorted(set(GRANDES) - set(self.t))
        self.assertFalse(faltam, 'saiu do repositório: tire de GRANDES no mesmo PR')

    def test_every_listed_file_is_still_above_the_limit(self):
        self.assertFalse(encolhidos(self.t),
                         'não está mais acima de 1 MiB: tire de GRANDES e do inventário no mesmo PR')

    def test_the_check_itself(self):
        base = {'a.json': 3 * MiB, 'b.txt': 10}
        self.assertEqual(violacoes(base, {'a.json': 3}), ([], [], None))
        self.assertIn('a.json: 3145728 bytes > limite 1048576 bytes', violacoes(base, {})[0][0])
        self.assertTrue(violacoes({'a.json': 3 * MiB + 1}, {'a.json': 3})[1])  # passou do teto
        self.assertTrue(violacoes({'x': TOTAL_MAX + 1}, {'x': 400})[2])         # total
        self.assertEqual(encolhidos({'a.json': LIMITE}, {'a.json': 3}), ['a.json'])  # = 1 MiB já é pouco
        self.assertEqual(encolhidos({'a.json': LIMITE + 1}, {'a.json': 3}), [])

    def test_every_exception_has_a_class_reason_and_bounded_ceiling(self):
        for caminho, (teto, classe, motivo) in EXCECOES.items():
            with self.subTest(caminho=caminho):
                self.assertIs(type(teto), int)
                self.assertGreater(teto, LIMITE // MiB)
                self.assertLessEqual(teto * MiB, GITHUB_DURO)
                self.assertIn(classe, {'fonte', 'gerado', 'runtime', 'descartavel'})
                self.assertIsInstance(motivo, str)
                self.assertTrue(motivo.strip(), 'excecao sem justificativa')


class IndiceGitTests(unittest.TestCase):
    def preparar(self, pasta, nome, n):
        raiz = Path(pasta)
        subprocess.run(['git', 'init', '-q', str(raiz)], check=True, capture_output=True)
        subprocess.run(['git', '-C', str(raiz), 'config', 'core.autocrlf', 'false'], check=True)
        (raiz / nome).write_bytes(b'x' * n)
        subprocess.run(['git', '-C', str(raiz), 'add', '--', nome], check=True)
        return raiz

    def test_new_file_at_limit_is_allowed(self):
        with tempfile.TemporaryDirectory() as pasta:
            raiz = self.preparar(pasta, 'permitido.bin', LIMITE)
            self.assertEqual(violacoes(tamanhos(raiz), {}), ([], [], None))

    def test_new_large_file_reports_path_size_and_limit(self):
        with tempfile.TemporaryDirectory() as pasta:
            raiz = self.preparar(pasta, 'arquivo com espaco.bin', LIMITE + 1)
            fora, _, _ = violacoes(tamanhos(raiz), {})
            self.assertEqual(len(fora), 1)
            self.assertIn('arquivo com espaco.bin', fora[0])
            self.assertIn(str(LIMITE + 1), fora[0])
            self.assertIn(str(LIMITE), fora[0])

    def test_explicit_exception_allows_file_only_up_to_its_ceiling(self):
        with tempfile.TemporaryDirectory() as pasta:
            raiz = self.preparar(pasta, 'fonte.bin', 2 * MiB)
            self.assertEqual(violacoes(tamanhos(raiz), {'fonte.bin': 2}), ([], [], None))
            (raiz / 'fonte.bin').write_bytes(b'x' * (2 * MiB + 1))
            subprocess.run(['git', '-C', str(raiz), 'add', 'fonte.bin'], check=True)
            self.assertTrue(violacoes(tamanhos(raiz), {'fonte.bin': 2})[1])

    def test_untracked_and_unstaged_bytes_do_not_change_index_measurement(self):
        with tempfile.TemporaryDirectory() as pasta:
            raiz = self.preparar(pasta, 'pequeno.bin', 10)
            (raiz / 'pequeno.bin').write_bytes(b'x' * (LIMITE + 1))
            (raiz / 'nao-versionado.bin').write_bytes(b'x' * (LIMITE + 1))
            self.assertEqual(tamanhos(raiz), {'pequeno.bin': 10})
            subprocess.run(['git', '-C', str(raiz), 'add', 'pequeno.bin'], check=True)
            self.assertTrue(violacoes(tamanhos(raiz), {})[0])


if __name__ == '__main__':
    unittest.main()

"""Trava de tamanho: arquivo grande só entra no repositório com classificação.

O inventário e a decisão de cada arquivo estão em tasks/higiene-repositorio/arquivos-grandes.md.
Este teste é a trava do CI, com quatro regras:

1. Todo arquivo versionado acima de 1 MiB precisa estar em GRANDES.
2. Nenhum arquivo cresce além do teto dele em GRANDES: o tamanho de 27/09/2026, arredondado
   para cima até o MiB inteiro.
3. O repositório inteiro, somado, não passa de TOTAL_MAX.
4. Cada entrada de GRANDES existe e continua acima de 1 MiB. Quando o arquivo sai, ou encolhe
   para 1 MiB ou menos, a entrada sai daqui e do inventário no mesmo PR, e a lista continua sendo
   o inventário exato.

Arquivo grande novo, ou um que cresceu, entra com a linha dele aqui e no inventário. Essa é a
classificação explícita. O tamanho medido é o do blob no índice do git, e não o do disco: no
Windows, a conversão de fim de linha muda o tamanho do arquivo no disco.
"""
import subprocess
import unittest
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[1]
MiB = 1 << 20
LIMITE = 1 * MiB
TOTAL_MAX = 300 * MiB           # 280,3 MiB em 27/09/2026; a folga é para o que é pequeno
GITHUB_DURO = 100 * MiB         # o GitHub recusa acima disso; avisa a partir de 50

# caminho -> teto em MiB. Classe (ver o inventário): E = entra no build ou é publicação;
# F = fonte necessária para reproduzir; I = intermediário.
GRANDES = {
    'sao-carlos/dados/lotes_saocarlos_completo.geojson': 63,                      # E
    'lotes_saocarlos.geojson': 36,                                                 # E (só fallback)
    'v1.5/miniaturas/padrao-atual/piloto-v3/source-before-normal-repair.json': 23,  # I
    'v1.5/miniaturas/padrao-atual/piloto-v3/source.json': 23,                     # F (premium)
    'v1.5/miniaturas/padrao-atual/exterior-v3/geometry-compact.json': 16,         # E
    'v1.5/miniaturas/padrao-atual/exterior-v3/uv.json': 15,                       # I
    'v1.5/miniaturas/padrao-atual/exterior-v3/lightmap.rgbm.gz': 7,               # E
    'v1.5/miniaturas/padrao-atual/piloto-v3/geometry-compact.json': 7,            # E
    'v1.5/miniaturas/padrao-atual/piloto-v3/lightmap.rgbm.gz': 7,                 # E
    'v1.5/miniaturas/padrao-atual/piloto-v3/uv.json': 6,                          # I
    'sao-carlos/sao-carlos-v7.city.json': 5,                                      # E
    'modelos_urbanos/v1/mapa-casas.json': 5,                                      # E
    'sao-carlos/dados/street_tris.json': 5,                                       # E
    'v1.5/miniaturas/maquete-wish-castanheiras-58.html': 4,                       # E (publicação)
    'sao-carlos/dados/muros_segs.json': 4,                                        # E
    'v1.5/miniaturas/padrao-atual/anterior/v2.html': 4,                           # E
    'v1.5/miniaturas/maquete-monte-das-colinas-39.html': 4,                       # E (publicação)
    'exteriores/v1/mapa-exteriores.json': 3,                                      # E
    'v1.5/miniaturas/padrao-atual/exterior-v3/source.json': 3,                    # F (premium)
    'v1.5/miniaturas/castanheiras_blender/modelo.json': 2,                        # E
    'modelos_urbanos/v1/integracao/encaixes-sao-carlos.json': 2,                  # I (cache)
    'exteriores/v1/componentes.json': 2,                                          # E
    'v1.5/miniaturas/monte-dos-cedros_blender/modelo.json': 2,                    # F (leve)
    'v1.5/miniaturas/monte-das-colinas_blender/modelo.json': 2,                   # E
    'arvores/arvores_lib.json': 2,                                                # E
    'sao-carlos/dados/portoes.json': 2,                                           # E
    'v1.5/miniaturas/castanheiras_blender/castanheiras.blend': 2,                 # F (leve)
}


def tamanhos():
    """{caminho: bytes do blob} de tudo que está no índice do git."""
    lista = subprocess.run(['git', 'ls-files', '-s', '-z'], cwd=RAIZ, capture_output=True,
                           check=True).stdout.decode('utf-8').split('\0')
    blobs = {}
    for linha in filter(None, lista):
        meta, caminho = linha.split('\t', 1)
        blobs[caminho] = meta.split()[1]
    saida = subprocess.run(['git', 'cat-file', '--batch-check=%(objectname) %(objectsize)'],
                           cwd=RAIZ, input='\n'.join(blobs.values()) + '\n',
                           capture_output=True, check=True, text=True).stdout.split('\n')
    por_sha = dict(l.split() for l in saida if l.strip())
    return {c: int(por_sha[s]) for c, s in blobs.items()}


def violacoes(t, grandes=GRANDES):
    """As três regras sobre um {caminho: bytes}. Função pura, para a trava ter teste próprio."""
    fora = sorted(c for c, n in t.items() if n > LIMITE and c not in grandes)
    acima = sorted('%s: %.2f MiB > teto %d' % (c, t[c] / MiB, teto)
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
        self.assertEqual(violacoes(base, {})[0], ['a.json'])                 # grande sem lista
        self.assertTrue(violacoes({'a.json': 3 * MiB + 1}, {'a.json': 3})[1])  # passou do teto
        self.assertTrue(violacoes({'x': TOTAL_MAX + 1}, {'x': 400})[2])         # total
        self.assertEqual(encolhidos({'a.json': LIMITE}, {'a.json': 3}), ['a.json'])  # = 1 MiB já é pouco
        self.assertEqual(encolhidos({'a.json': LIMITE + 1}, {'a.json': 3}), [])


if __name__ == '__main__':
    unittest.main()

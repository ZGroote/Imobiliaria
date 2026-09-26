"""Dado de imóvel real é PRIVADO e só entra no repositório com intenção.

A classificação está em tasks/higiene-repositorio/dados-privados.md. Esses arquivos
continuam aqui porque são entradas reais do produto e dos builds, e a migração para
armazenamento privado vem junto com a política de artefatos. Até lá, este teste é a trava.

Não entram sem aparecer nas listas abaixo:
- unidade real nova;
- modelo do Blender novo;
- página de maquete nova;
- imagem nova fora de uma pasta já classificada.

Acrescentar a uma lista é a classificação explícita. É de propósito que isso exija editar
este arquivo. Retirar um item nunca reprova: a trava é contra entrada, não contra saída.

Vai pelo git, e não pelo disco: a pasta principal tem muito arquivo fora do git, e só o
que está versionado conta.
"""
import subprocess
import unittest
from pathlib import Path, PurePosixPath

RAIZ = Path(__file__).resolve().parents[1]

UNIDADES_REAIS = {'mirra-114', 'monte-das-colinas-39', 'monte-dos-cedros-37',
                  'sanca-135-29', 'wish-castanheiras-58'}
UNIDADES_SINTETICAS = {'_exemplo'}          # gabarito, sem imóvel por trás
MODELOS_BLENDER = {'castanheiras_blender', 'monte-das-colinas_blender',
                   'monte-dos-cedros_blender'}
PAGINAS_DE_MAQUETE = {'maquete-monte-das-colinas-39.html', 'maquete-wish-castanheiras-58.html'}

EXT_IMAGEM = {'.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.tif', '.tiff', '.pdf',
              '.heic', '.avif'}
# Imagens soltas já classificadas, uma a uma.
IMAGENS = {
    'texturas/chao.webp', 'texturas/reboco.webp', 'texturas/tijolo.webp',   # ambientCG, CC0
    'exteriores/v1/atlas-distante.png',                                    # gerada aqui
    'experimentos/mirante-7-2026-09-22/modelo/preview.png',               # render nosso
}
# Pastas inteiras classificadas como dado privado do Cedros: bake, texturas, QA e renders.
PASTAS_DE_IMAGEM = ('v1.5/miniaturas/padrao-atual/',)


def versionados():
    saida = subprocess.run(['git', 'ls-files', '-z'], cwd=RAIZ, capture_output=True,
                           check=True).stdout.decode('utf-8')
    return [PurePosixPath(p) for p in saida.split('\0') if p]


def imagem_classificada(p):
    s = p.as_posix()
    if s in IMAGENS or s.startswith(PASTAS_DE_IMAGEM):
        return True
    if s.startswith('unreal/lightmaps/'):
        return p.stem in UNIDADES_REAIS
    return (len(p.parts) == 4 and p.parts[:2] == ('v1.5', 'miniaturas')
            and p.parts[2] in MODELOS_BLENDER)


class DadosPrivadosTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.arquivos = versionados()

    def filhos(self, pasta):
        n = len(PurePosixPath(pasta).parts)
        return {p.parts[n] for p in self.arquivos
                if len(p.parts) > n + 1 and p.parts[:n] == PurePosixPath(pasta).parts}

    def test_no_new_real_unit(self):
        novas = self.filhos('plantas_fornecidas') - UNIDADES_REAIS - UNIDADES_SINTETICAS
        self.assertFalse(novas, 'unidade nova em plantas_fornecidas/ sem classificação')

    def test_baked_light_only_for_known_units(self):
        for pasta, sufixo in (('unreal/lightmaps', '.png'), ('unreal/malhas', '.tiles.json')):
            nomes = {p.name[:-len(sufixo)] for p in self.arquivos
                     if p.parent.as_posix() == pasta and p.name.endswith(sufixo)}
            self.assertFalse(nomes - UNIDADES_REAIS, pasta)

    def test_no_new_blender_model_or_maquete_page(self):
        miniaturas = {p.name for p in self.arquivos
                      if p.parent.as_posix() == 'v1.5/miniaturas'}
        modelos = {d for d in self.filhos('v1.5/miniaturas') if d.endswith('_blender')}
        self.assertFalse(modelos - MODELOS_BLENDER, 'modelo do Blender novo sem classificação')
        paginas = {n for n in miniaturas if n.startswith('maquete-') and n.endswith('.html')}
        self.assertFalse(paginas - PAGINAS_DE_MAQUETE, 'página de maquete nova sem classificação')

    def test_every_image_is_classified(self):
        soltas = [p.as_posix() for p in self.arquivos
                  if p.suffix.lower() in EXT_IMAGEM and not imagem_classificada(p)]
        self.assertFalse(soltas, 'imagem sem classificação (terceiro? cliente?)')

    def test_the_lists_still_match_the_repository(self):
        # Sem isto, um nome errado na lista liberaria a entrada que ele deveria travar.
        self.assertTrue(UNIDADES_REAIS <= self.filhos('plantas_fornecidas'))
        self.assertTrue(MODELOS_BLENDER <= self.filhos('v1.5/miniaturas'))
        todos = {p.as_posix() for p in self.arquivos}
        self.assertTrue(IMAGENS <= todos, IMAGENS - todos)

    def test_the_check_itself(self):
        P = PurePosixPath
        self.assertFalse(imagem_classificada(P('experimentos/novo/fotos/01.jpg')))
        self.assertFalse(imagem_classificada(P('unreal/lightmaps/cliente-novo-12.png')))
        self.assertFalse(imagem_classificada(P('v1.5/miniaturas/outro_blender/preview.png')))
        self.assertTrue(imagem_classificada(P('v1.5/miniaturas/castanheiras_blender/preview.png')))
        self.assertTrue(imagem_classificada(P('unreal/lightmaps/sanca-135-29.png')))


if __name__ == '__main__':
    unittest.main()

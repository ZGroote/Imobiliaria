"""A vitrine de demonstração do mapa é FICTÍCIA, e continua sendo.

Até 26/09/2026 a vitrine trazia 7 anúncios reais do roca.com.br (título, preço, URL), e
6 estudos 3D feitos a partir das fotos deles. Os dois iam para dentro do mapa e do tour
sem autorização registrada. Os anúncios viraram fictícios e o pacote de estudos foi
esvaziado (tasks/higiene-repositorio/proveniencia.md).

Este teste impede que anúncio ou URL real volte por acidente. Pôr anúncio real na vitrine
é uma decisão, e ela passa por mudar este teste. O contrato de cada item é conferido junto,
porque o mapa e o tour leem esses campos (`listings/house-sheet.js`).
"""
import json
import re
import subprocess
import unittest
from pathlib import Path
from urllib.parse import urlsplit

RAIZ = Path(__file__).resolve().parents[1]
ESTUDOS = RAIZ / 'modelos_cadastrados/estudos.json'
# Nomes reservados pela RFC 2606 e pela RFC 6761: nunca apontam para um site de verdade.
RESERVADOS = ('example.com', 'example.net', 'example.org')
SUFIXOS = ('.example', '.invalid', '.test', '.localhost')
URL = re.compile(r'https?://[^\s"\'<>\\]+')
CAMPOS = {'id': int, 'titulo': str, 'bairro': str, 'tipo': str, 'preco': int,
          'quartos': int, 'vagas': int, 'lat': float, 'lon': float, 'url': str}


def reservado(url):
    host = (urlsplit(url).hostname or '').lower()
    return host in RESERVADOS or host.endswith(tuple('.' + d for d in RESERVADOS) + SUFIXOS)


def vitrines():
    """O `dados/imoveis.json` de cada cidade que o tenha VERSIONADO.

    Vai pelo git, e não pelo disco: a pasta principal tem cidades inteiras fora do git, e o
    que não está versionado não é publicado por este repositório."""
    saida = subprocess.run(['git', 'ls-files', '-z', '--', '*/dados/imoveis.json'], cwd=RAIZ,
                           capture_output=True, check=True).stdout.decode('utf-8')
    return [RAIZ / p for p in saida.split('\0') if p]


class VitrineFicticiaTests(unittest.TestCase):
    def test_sao_carlos_has_a_listing_file(self):
        # Sem isto o resto passaria em silêncio, com a lista vazia.
        self.assertIn(RAIZ / 'sao-carlos/dados/imoveis.json', vitrines())

    def test_every_listing_is_fictitious_and_keeps_the_contract(self):
        for arquivo in vitrines():
            anuncios = json.loads(arquivo.read_text(encoding='utf-8'))
            self.assertIsInstance(anuncios, list, arquivo)
            for a in anuncios:
                with self.subTest(arquivo=arquivo.relative_to(RAIZ).as_posix(), id=a.get('id')):
                    self.assertEqual(set(a), set(CAMPOS))
                    for campo, tipo in CAMPOS.items():
                        self.assertIsInstance(a[campo], tipo, campo)
                    self.assertIn(a['tipo'], ('venda', 'aluguel'))
                    self.assertTrue(a['titulo'].startswith('[FICTÍCIO]'), a['titulo'])
                    self.assertTrue(reservado(a['url']), a['url'])

    def test_no_real_url_in_listing_data_or_studies(self):
        # Varre o texto cru, e não só o campo `url`: o pacote de estudos trazia a URL do
        # anúncio no campo `source`, e um campo novo não pode abrir outra porta.
        for arquivo in vitrines() + [ESTUDOS]:
            for url in URL.findall(arquivo.read_text(encoding='utf-8')):
                with self.subTest(arquivo=arquivo.relative_to(RAIZ).as_posix()):
                    self.assertTrue(reservado(url), url)

    def test_studies_pack_keeps_its_format(self):
        pacote = json.loads(ESTUDOS.read_text(encoding='utf-8'))
        self.assertEqual(pacote.get('version'), 1)
        self.assertIsInstance(pacote.get('assets'), list)

    def test_the_check_itself(self):
        self.assertTrue(reservado('https://example.com/anuncio-ficticio/1'))
        self.assertTrue(reservado('https://imoveis.exemplo.invalid/x'))
        self.assertFalse(reservado('https://roca.com.br/imovel/venda/casas/sao-carlos/x/1'))
        self.assertFalse(reservado('https://example.com.br/x'))
        self.assertFalse(reservado('https://notexample.com/x'))


if __name__ == '__main__':
    unittest.main()

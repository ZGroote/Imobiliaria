"""MG-4: o exportador da maquete de hoje para o pacote de dados do motor (pipeline/maquete_dados.py).

O que precisa de navegador (abrir a página e ler a cena) é conferido pelo maquete/motor/qa_exportados.py,
com placa de vídeo. Aqui, sem navegador: o pacote sai igual da mesma cena, os manifestos batem com os
arquivos, a luz do Cedros vira o formato do motor, e cada produto só leva a luz que é dele.
"""
import base64
import gzip
import hashlib
import json
import struct
import sys
import tempfile
import unittest
from array import array
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RAIZ))
from pipeline import maquete_dados as md  # noqa: E402

sha = lambda b: hashlib.sha256(b).hexdigest()


def atributo(tipo, valores, item):
    dado = array({'Float32Array': 'f', 'Uint16Array': 'H'}[tipo], valores).tobytes()
    return {'type': tipo, 'base64': base64.b64encode(dado).decode(), 'length': len(valores), 'itemSize': item, 'normalized': False}


def imovel(**muda):
    base = {'_id': 'casa-x', 'empreendimento': 'Casa X', 'unidade': '2 dormitórios · 70 m²', 'endereco': 'Rua A, 1',
            'tag': 'À venda', 'preco': 'R$ 1', 'andar': 0, 'predio': {'pavimentos': 1},
            'ficha': [['Área útil', '70,0 m²'], ['Dormitórios', '2']],
            'planta': {'pe_direito': 2.6, 'comodos': [{'nome': 'Sala', 'piso': 'quente', 'area': 12.0, 'poly': [[0, 0], [4, 0], [4, 3], [0, 3]]}],
                       'portas': [{'p': [2, 3], 'largura': .8}], 'janelas': [], 'moveis': [{'tipo': 'sofa', 'p': [1, 1]}]}}
    base.update(muda)
    return base


def cena(baked=False, atlas=()):
    return {
        'geometries': [{'attributes': {'position': atributo('Float32Array', [0, 0, 0, 1, 0, 0, 0, 1, 0], 3)},
                        'index': atributo('Uint16Array', [0, 1, 2], 1), 'groups': [], 'drawRange': {'start': 0, 'count': None}}],
        'materials': [{'name': 'parede', 'type': 'MeshStandardMaterial', 'baked': baked, 'color': [1, 1, 1], 'roughness': .9}],
        'textures': [{'png': base64.b64encode(b'png falso').decode(), 'width': 1, 'height': 1, 'repeat': [1, 1]}],
        'meshes': [{'name': 'parede', 'geometry': 0, 'material': 0, 'matrix': [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
                    'castShadow': True, 'receiveShadow': True, 'renderOrder': 0, 'userData': {}, 'instances': None}],
        'lights': [{'type': 'DirectionalLight', 'color': [1, 1, 1], 'groundColor': None, 'intensity': 2.6, 'position': [-30, 50, 22],
                    'target': [0, 0, 0], 'castShadow': True, 'shadow': None}],
        'visibleBounds': {'min': [0, 0, 0], 'max': [1, 1, 1]}, 'renderer': {'exposure': 1.02, 'toneMapping': 4, 'pixelRatio': 1},
        'camera': {'fov': 34, 'near': .1, 'far': 900, 'target': [0, 4, 0], 'orbit': {'r': 48, 'th': .72, 'ph': 1.03}},
        'atlas': list(atlas), 'imovel': imovel(),
    }


def luz_falsa(largura=4, altura=2):
    return bytes(range(256))[:largura * altura * 4] * 1, largura, altura


def ler(arquivos, nome):
    return json.loads(gzip.decompress(arquivos[nome])) if nome.endswith('.gz') else json.loads(arquivos[nome])


class Pacote(unittest.TestCase):
    def test_a_mesma_cena_da_os_mesmos_bytes(self):
        self.assertEqual(md.pacote(cena(), 'a' * 64, 'leve'), md.pacote(cena(), 'a' * 64, 'leve'))
        luz = luz_falsa()
        premium = md.pacote(cena(True, [{'width': 4, 'height': 2}]), 'a' * 64, 'premium', luz)
        self.assertEqual(premium, md.pacote(cena(True, [{'width': 4, 'height': 2}]), 'a' * 64, 'premium', luz))
        # Duas chamadas no mesmo segundo dariam o mesmo gzip mesmo com a hora dentro: a data tem de ser zero.
        for nome in ('exterior/scene.json.gz', 'exterior/irradiance.rgbm.gz'):
            self.assertEqual(premium[nome][4:8], b'\0\0\0\0', nome)

    def test_o_manifesto_bate_com_os_arquivos(self):
        for modo, c, luz in (('leve', cena(), None), ('premium', cena(True, [{'width': 4, 'height': 2}]), luz_falsa())):
            arquivos = md.pacote(c, 'b' * 64, modo, luz)
            m = ler(arquivos, 'exterior/manifest.json')
            self.assertEqual(m['schema'], 'liv-proof-manifest-v1')
            self.assertEqual(set(m['files']), {n[len('exterior/'):] for n in arquivos if n.startswith('exterior/') and n != 'exterior/manifest.json'})
            for nome, ident in m['files'].items():
                self.assertEqual((ident['bytes'], ident['sha256']), (len(arquivos['exterior/' + nome]), sha(arquivos['exterior/' + nome])))
            dado = gzip.decompress(arquivos['exterior/scene.json.gz'])
            self.assertEqual(sha(dado), m['sceneJSONSHA256'])
            s = json.loads(dado)
            # o que o motor confere: a mesma edição na cena, no manifesto e na luz
            self.assertEqual((s['schema'], s['sourceModelSHA256'], m['sourceModelSHA256']), ('liv-exterior-proof-v1', 'b' * 64, 'b' * 64))
            self.assertEqual(sorted(s['views']), ['aerea', 'perspectiva'])
            self.assertEqual(s['textures'][0]['url'], 'texture-00.png')
            self.assertNotIn('png', s['textures'][0])
            self.assertEqual(arquivos['exterior/texture-00.png'], b'png falso')
            if modo == 'premium':
                rgba = gzip.decompress(arquivos['exterior/irradiance.rgbm.gz'])
                self.assertEqual((s['rgbm']['sourceSHA256'], s['rgbm']['textureSHA256'], len(rgba)), ('b' * 64, sha(rgba), 4 * 2 * 4))
                self.assertEqual((s['rgbm']['range'], m['bakedMeshes']), (16, 1))
            else:
                self.assertIsNone(s['rgbm'])
                self.assertEqual(m['bakedMeshes'], 0)

    def test_a_vista_inicial_e_a_da_pagina(self):
        s = ler(md.pacote(cena(), 'c' * 64, 'leve'), 'exterior/scene.json.gz')
        v = s['views']['perspectiva']
        self.assertEqual((v['target'], v['orbit']), ([0, 4, 0], {'r': 48, 'th': .72, 'ph': 1.03}))
        # a mesma órbita da página: alvo + r·(sen θ sen φ, cos φ, cos θ sen φ)
        import math
        self.assertAlmostEqual(v['position'][1], 4 + 48 * math.cos(1.03))
        self.assertAlmostEqual(v['position'][0], 48 * math.sin(.72) * math.sin(1.03))

    def test_cada_produto_so_leva_a_luz_dele(self):
        with self.assertRaisesRegex(ValueError, 'LEVE tem material'):
            md.pacote(cena(baked=True), 'a' * 64, 'leve')
        with self.assertRaisesRegex(ValueError, 'PREMIUM leva a luz'):
            md.pacote(cena(), 'a' * 64, 'premium')
        with self.assertRaisesRegex(ValueError, 'PREMIUM leva a luz'):
            md.pacote(cena(), 'a' * 64, 'leve', luz_falsa())
        # a página não usou a luz do padrão (outro tamanho, ou nenhum material com ela)
        with self.assertRaisesRegex(ValueError, 'não usou a luz do padrão'):
            md.pacote(cena(True, [{'width': 8, 'height': 2}]), 'a' * 64, 'premium', luz_falsa())
        with self.assertRaisesRegex(ValueError, 'não usou a luz do padrão'):
            md.pacote(cena(False, [{'width': 4, 'height': 2}]), 'a' * 64, 'premium', luz_falsa())


class Dados(unittest.TestCase):
    def test_a_ficha_e_a_planta_vem_da_pagina(self):
        arquivos = md.pacote(cena(), 'a' * 64, 'leve')
        js = arquivos['maquete.js'].decode()
        self.assertTrue(js.startswith('// '))
        d = json.loads(js[js.index('export default ') + len('export default '):].rstrip().rstrip(';'))
        self.assertEqual((d['schema'], d['tipo'], d['imovel'], d['edicaoPadrao']), ('maquete-dados-v1', 'casa', 'casa-x', 'leve'))
        self.assertEqual(d['edicoes']['leve']['assets'], 'dados/exterior/')
        self.assertIsNone(d['edicoes']['leve']['units'])
        self.assertEqual(d['ficha'], {'tag': 'À venda', 'titulo': 'Casa X', 'subtitulo': '2 dormitórios · 70 m²',
                                      'endereco': 'Rua A, 1', 'preco': 'R$ 1', 'linhas': [['Área útil', '70,0 m²'], ['Dormitórios', '2']]})
        # a Planta 2D do motor lê cômodos, portas e janelas; os móveis ficam para o interior (MG-7)
        self.assertEqual(sorted(d['planta']), ['comodos', 'janelas', 'pe_direito', 'portas'])

    def test_apartamento_e_casa(self):
        self.assertEqual(md.dados_do_imovel(imovel(andar=8, predio={'pavimentos': 15}), 'leve')['tipo'], 'apartamento')
        self.assertEqual(md.dados_do_imovel(imovel(andar=0, predio={'pavimentos': 4}), 'leve')['tipo'], 'apartamento')
        self.assertEqual(md.dados_do_imovel(imovel(andar=0, predio={'pavimentos': 2}), 'leve')['tipo'], 'casa')


class LuzDoPadrao(unittest.TestCase):
    def test_a_luz_do_cedros_vira_o_formato_do_motor(self):
        rgba, largura, altura = md.luz_do_padrao()
        self.assertEqual((largura, altura, len(rgba)), (4096, 4096, 4096 * 4096 * 4))

    def test_cabecalho_que_nao_bate_e_recusado(self):
        with tempfile.TemporaryDirectory() as tmp:
            p = Path(tmp) / 'luz.rgbm.gz'
            p.write_bytes(gzip.compress(struct.pack('<II', 4, 2) + b'\0' * 31))
            with self.assertRaisesRegex(ValueError, 'luz do padrão inválida'):
                md.luz_do_padrao(p)
            p.write_bytes(gzip.compress(struct.pack('<II', 4, 2) + b'\0' * 32))
            self.assertEqual(md.luz_do_padrao(p)[1:], (4, 2))


if __name__ == '__main__':
    unittest.main()

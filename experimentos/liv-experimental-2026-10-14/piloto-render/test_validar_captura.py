import base64
import json
from pathlib import Path
import tempfile
import unittest
from validar_captura import validar


class ValidarCaptura(unittest.TestCase):
    def test_incompleto_nao_libera_treino(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp)
            frames = [{"file_path": f"images/f{i}.png", "comodo": "Sala", "pitch": 0,
                       "transform_matrix": [[1,0,0,i],[0,1,0,0],[0,0,1,1.62],[0,0,0,1]]} for i in range(2)]
            data = {"w": 32, "h": 16, "frames": frames, "ply_file_path": "pontos.ply",
                    "train_filenames": ["images/f0.png"], "val_filenames": ["images/f1.png"], "test_filenames": ["images/f1.png"]}
            plano = {"dataset": data}
            def write(): (path / 'plano-captura.json').write_text(json.dumps(plano), encoding='utf-8')
            write()
            self.assertEqual(validar(path)["render_pendente"], 2)
            with self.assertRaisesRegex(ValueError, "Render pendente"): validar(path, True)
            data['frames'][1]['transform_matrix'][0][3] = 0; write()
            with self.assertRaisesRegex(ValueError, "Mesma posição"): validar(path)
            data['frames'][1]['transform_matrix'][0][3] = 1
            data['train_filenames'].append('images/f1.png'); write()
            with self.assertRaisesRegex(ValueError, "Divisão"): validar(path)
            data['train_filenames'].pop()
            data['frames'][0]['transform_matrix'][0][0] = float('nan'); write()
            with self.assertRaisesRegex(ValueError, "Matriz"): validar(path)
            data['frames'][0]['transform_matrix'][0][0] = 1
            data.update(w=1, h=1)
            write()
            (path / 'images').mkdir()
            png = base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aE5sAAAAASUVORK5CYII=')
            for name in ('f0.png','f1.png'): (path / 'images' / name).write_bytes(png)
            (path / 'pontos.ply').write_text('ply\nformat ascii 1.0\nelement vertex 0\nend_header\n')
            (path / 'transforms.json').write_text(json.dumps(data),encoding='utf-8')
            self.assertTrue(validar(path,True)['pronto_para_treino'])
            plano['diagnostico'] = True; write()
            self.assertFalse(validar(path,True)['pronto_para_treino'])
            (path / 'images/f1.png').write_bytes(png[:-12])
            with self.assertRaisesRegex(ValueError,'PNG incompleto'): validar(path)


if __name__ == '__main__': unittest.main()

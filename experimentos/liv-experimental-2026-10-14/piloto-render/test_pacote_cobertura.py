import base64
import hashlib
import json
from pathlib import Path
import tempfile
import unittest
import zipfile
from preparar_pacote_cobertura import preparar


class PacoteCobertura(unittest.TestCase):
    def test_preserva_fonte_parametros_e_amostras_do_plano(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            source = root/'corrigida.blend'
            source.write_bytes(b'cena corrigida de teste')
            plan = root/'dataset'
            (plan/'images').mkdir(parents=True)
            frames = [{'file_path': f'images/f{i}.png', 'comodo': 'Sala', 'pitch': 0,
                       'transform_matrix': [[1,0,0,i],[0,1,0,0],[0,0,1,1.62],[0,0,0,1]]} for i in range(2)]
            data = {'w':1,'h':1,'frames':frames,'ply_file_path':'pontos.ply',
                    'train_filenames':['images/f0.png'],'val_filenames':['images/f1.png'],
                    'test_filenames':['images/f1.png']}
            config = {'source_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),
                      'dataset':data,'zona':['apto'],'folga':.18,'colado':.25,
                      'passo':.55,'rumos':8,'sem_jitter':True,'amostras':128}
            (plan/'plano-captura.json').write_text(json.dumps(config), encoding='utf-8')
            png = base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aE5sAAAAASUVORK5CYII=')
            (plan/'images/f0.png').write_bytes(png)
            (plan/'images/antiga.png').write_bytes(png)
            result = preparar(plan, root/'pacote.zip', source)
            self.assertEqual(result['imagens_presentes'], 1)
            with zipfile.ZipFile(root/'pacote.zip') as archive:
                self.assertEqual(archive.read('apartamento.blend'), source.read_bytes())
                command = archive.read('executar.sh').decode()
                self.assertIn('--rumos 8 --sem-jitter --res 1x1 --amostras 128', command)
                self.assertNotIn('__RUMOS__', command)
                self.assertNotIn('dataset/images/antiga.png', archive.namelist())
                self.assertEqual(archive.read('dataset/images/f0.png'), png)
                for name, sha in json.loads(archive.read('manifesto.json')).items():
                    self.assertEqual(hashlib.sha256(archive.read(name)).hexdigest(), sha)
            source.write_bytes(b'outra cena')
            with self.assertRaisesRegex(ValueError, 'Cena diferente'):
                preparar(plan, root/'errado.zip', source)


if __name__ == '__main__': unittest.main()

import unittest
import numpy as np
from inspetor import escuro_incorreto, quadros_avaliacao, separar_avaliacao


class Split(unittest.TestCase):
    def test_escuro_so_quando_diverge_da_referencia(self):
        claro = np.ones((10,10,3),dtype=np.float32)
        pred = claro.copy(); pred[:2] = 0
        self.assertAlmostEqual(escuro_incorreto(claro,pred),20)
        self.assertEqual(escuro_incorreto(pred,pred),0)

    def test_reserva_explicita_na_ordem_do_nerfstudio(self):
        frames = [{'file_path': f'images/f{i:04d}.png'} for i in reversed(range(20))]
        val = ['images/f0019.png','images/f0001.png','images/f0007.png']
        ordenados, indices = quadros_avaliacao({'frames': frames, 'val_filenames': val})
        self.assertEqual(indices, [1,7,19])
        self.assertEqual([ordenados[i]['file_path'] for i in indices], sorted(val))
        self.assertEqual(quadros_avaliacao({'frames': frames})[1], separar_avaliacao(20))
        with self.assertRaisesRegex(ValueError, 'desconhecidas'):
            quadros_avaliacao({'frames': frames,'val_filenames':['missing.png']})


if __name__ == '__main__': unittest.main()

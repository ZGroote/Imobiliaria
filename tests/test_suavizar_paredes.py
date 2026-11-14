import importlib.util
import base64
from pathlib import Path
import unittest

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('walls', ROOT / 'v1.5/miniaturas/liv-ipanema/interior/suavizar_paredes.py')
walls = importlib.util.module_from_spec(spec)
spec.loader.exec_module(walls)


class WallLightTests(unittest.TestCase):
    def plane(self, split=False, disconnected=False, opposite=False, corner_points=None):
        image = np.zeros((80, 90, 3), np.float32)
        islands = np.zeros(image.shape[:2], int)
        faces = []
        for part in range(2):
            x, y = np.meshgrid(np.arange(20), np.arange(30))
            ix = x.ravel() + 3 + part * 45
            iy = y.ravel() + 3
            s = (x.ravel() + part * 20) * .025
            if disconnected and part:
                s += .5
            h = y.ravel() * .025 + 1.8
            samples = np.c_[iy, ix, np.zeros(len(s)), h, s]
            lo, hi = s.min(), s.max() + .025
            a, b, c, d = np.array([[0, 1.8, lo], [0, 1.8, hi], [0, 2.55, hi], [0, 2.55, lo]])
            normal = np.array([-1 if opposite and part else 1, 0, 0])
            faces += [(np.array([a, b, c]), normal, samples),
                      (np.array([a, c, d]), normal, np.empty((0, 5)))]
            image[iy, ix] = 1 + part * 2 if split else 2
            islands[iy, ix] = part + 1
        return image, islands, walls.wall_filters(faces, corner_points=corner_points)

    def test_continuous_wall_crosses_atlas_islands_without_a_step(self):
        image, islands, filters = self.plane(split=True)
        before = image.copy()
        walls.soften_walls(image, filters, islands)
        self.assertLess(abs(float(image[25, 22, 0] - image[25, 48, 0])), .2)
        np.testing.assert_array_equal(image[3:10], before[3:10])
        self.assertGreater(image[25, 23, 0], 0, 'a margem deve acompanhar a parede')

    def test_uniform_light_stays_uniform(self):
        image, islands, filters = self.plane()
        walls.soften_walls(image, filters, islands)
        np.testing.assert_allclose(image[islands > 0], 2, atol=1e-6)

    def test_edge_guard_keeps_corner_shading_and_still_smooths_interior_seams(self):
        image, islands, filters = self.plane(split=True)
        image[3:33, 3:6] = .1
        before = image.copy()
        walls.soften_walls(image, filters, islands, edge_guard=.10)
        np.testing.assert_array_equal(image[3:33, 3:6], before[3:33, 3:6])
        self.assertLess(abs(float(image[25, 22, 0] - image[25, 48, 0])), .2)

    def test_room_corner_inside_a_continuous_plane_keeps_original_light(self):
        image, islands, filters = self.plane(corner_points=np.array([[0, .225]]))
        image[3:33, 11:14] = .1
        before = image.copy()
        walls.soften_walls(image, filters, islands, edge_guard=.10)
        np.testing.assert_array_equal(image[3:33, 11:14], before[3:33, 11:14])

    def test_disconnected_surfaces_do_not_exchange_light(self):
        image, islands, filters = self.plane(split=True, disconnected=True)
        walls.soften_walls(image, filters, islands)
        np.testing.assert_allclose(image[islands == 1], 1, atol=1e-6)
        np.testing.assert_allclose(image[islands == 2], 3, atol=1e-6)

    def test_opposite_faces_do_not_exchange_light(self):
        image, islands, filters = self.plane(split=True, opposite=True)
        walls.soften_walls(image, filters, islands)
        np.testing.assert_allclose(image[islands == 1], 1, atol=1e-6)
        np.testing.assert_allclose(image[islands == 2], 3, atol=1e-6)

    def test_bilinear_at_shared_edge_uses_surface_padding(self):
        image = np.full((80, 80, 3), 9, np.float32)
        vertices, indices, uv = [], [], []
        for part, left in enumerate([3, 48]):
            start = len(vertices)
            vertices += [[0, 1.8, part * .5], [0, 1.8, (part + 1) * .5],
                         [0, 2.55, (part + 1) * .5], [0, 2.55, part * .5]]
            coords = np.array([[left, 3], [left + 20, 3], [left + 20, 33], [left, 33]]) / 80
            for face in [[0, 2, 1], [0, 3, 2]]:
                indices.extend(start + i for i in face)
                uv.extend(coords[face])
            image[3:33, left:left + 20] = 1 + 2 * part
        source = {'objects': [{'slot': 0, 'geometry': 'wall', 'matrix': np.eye(4).ravel().tolist()}],
                  'geometries': {'wall': {'position': np.array(vertices).ravel().tolist()}}}
        compact = {'objects': [{'objectIndex': 0,
                   'indicesU32': base64.b64encode(np.array(indices, '<u4').tobytes()).decode(),
                   'uv1U16': base64.b64encode(np.rint(np.array(uv) * 65535).astype('<u2').tobytes()).decode()}]}
        filters, islands = walls.scene_wall_filters(source, compact, 80)
        walls.soften_walls(image, filters, islands)
        left = image[25, [22, 23], 0].mean()
        right = image[25, [47, 48], 0].mean()
        self.assertLess(abs(float(left - right)), .04, 'O bilinear não pode revelar a divisão das ilhas')


if __name__ == '__main__':
    unittest.main()

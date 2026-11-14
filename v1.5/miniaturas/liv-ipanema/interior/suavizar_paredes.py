"""Denoise da luz no plano da parede, sem reiniciar nas ilhas do atlas."""
import base64
import numpy as np
from scipy import ndimage

WALL_DENOISE = 'surface-plane-v1'


def scene_wall_filters(source, compact, size, corner_points=None):
    """Lê geometria e UV1 reais; também marca as outras ilhas para proteger suas margens."""
    covered = np.zeros((size, size), bool)
    owners = np.full((size, size), -1, int)
    faces = []
    uv_triangles = []
    for record in compact['objects']:
        obj = source['objects'][record['objectIndex']]
        geometry = source['geometries'][obj['geometry']]
        matrix = np.asarray(obj['matrix']).reshape(4, 4).T
        points = np.asarray(geometry['position']).reshape(-1, 3) @ matrix[:3, :3].T + matrix[:3, 3]
        indices = np.frombuffer(base64.b64decode(record['indicesU32']), '<u4').reshape(-1, 3)
        uv = np.frombuffer(base64.b64decode(record['uv1U16']), '<u2').reshape(-1, 3, 2) / 65535 * size
        for vertices, triangle in zip(points[indices], uv):
            low = np.floor(triangle.min(0)).astype(int).clip(0, size - 1)
            high = np.ceil(triangle.max(0)).astype(int).clip(0, size - 1)
            edge = (triangle[1:] - triangle[0]).T
            if abs(np.linalg.det(edge)) < 1e-12:
                continue
            x, y = np.meshgrid(np.arange(low[0], high[0] + 1), np.arange(low[1], high[1] + 1))
            bary = np.linalg.solve(edge, np.stack([x.ravel() + .5, y.ravel() + .5]) - triangle[0, :, None])
            inside = (bary.min(0) >= 0) & (bary.sum(0) <= 1)
            ix, iy = x.ravel()[inside], y.ravel()[inside]
            covered[iy, ix] = True
            normal = np.cross(vertices[1] - vertices[0], vertices[2] - vertices[0])
            normal /= np.linalg.norm(normal)
            if obj.get('slot') == 0 and abs(normal[1]) < .01:
                world = vertices[0] + bary[:, inside].T @ (vertices[1:] - vertices[0])
                owners[iy, ix] = len(faces)
                faces.append((vertices, normal, np.c_[iy, ix, world, np.ones(len(iy))]))
                uv_triangles.append(triangle)
            else:
                owners[iy, ix] = -1
    # A margem precisa extrapolar a luz no plano, em vez de repetir a última linha de texels.
    distance, near = ndimage.distance_transform_edt(~covered, return_indices=True)
    owner = owners[near[0], near[1]]
    iy, ix = np.nonzero(~covered & (distance <= 4) & (owner >= 0))
    for index in np.unique(owner[iy, ix]):
        selected = owner[iy, ix] == index
        y, x = iy[selected], ix[selected]
        vertices, normal, samples = faces[index]
        triangle = uv_triangles[index]
        bary = np.linalg.solve((triangle[1:] - triangle[0]).T,
                               np.stack([x + .5, y + .5]) - triangle[0, :, None])
        world = vertices[0] + bary.T @ (vertices[1:] - vertices[0])
        faces[index] = (vertices, normal, np.r_[samples, np.c_[y, x, world, np.zeros(len(y))]])
    return wall_filters(faces, corner_points=corner_points), ndimage.label(covered)[0]


def encode_rgbm2(rgb, value_range):
    if not np.isfinite(rgb).all() or rgb.min(initial=0) < 0 or rgb.max(initial=0) > value_range:
        raise ValueError('A luz corrigida não cabe no RGBM')
    alpha = np.clip(np.ceil(np.sqrt(rgb.max(axis=-1) / value_range) * 255), 1, 255)
    scale = (alpha / 255) ** 2 * value_range
    encoded = np.empty((*rgb.shape[:-1], 4), np.uint8)
    encoded[..., :3] = np.rint(np.clip(rgb / scale[..., None], 0, 1) * 255).astype(np.uint8)
    encoded[..., 3] = alpha.astype(np.uint8)
    return encoded


def wall_filters(faces, cell=.025, corner_points=None):
    """Agrupa faces coplanares com a mesma orientação; vãos desconectados ficam separados."""
    planes = {}
    for vertices, normal, samples in faces:
        key = (*np.round(normal, 5), round(float(vertices[0] @ normal), 4))
        plane = planes.setdefault(key, [[], []])
        tangent = np.array([-normal[2], 0, normal[0]])
        plane[0].append(np.c_[vertices @ tangent, vertices[:, 1]])
        if len(samples):
            valid = samples[:, 5] if samples.shape[1] > 5 else np.ones(len(samples))
            plane[1].append(np.c_[samples[:, :2], samples[:, 2:5] @ tangent, samples[:, 3], valid])
    filters = []
    for plane, (triangles, parts) in planes.items():
        if not parts:
            continue
        samples = np.concatenate(parts)
        corner_distance = None
        if corner_points is not None:
            nx, _, nz, offset = plane
            on_plane = np.abs(corner_points @ [nx, nz] - offset) <= .04
            if on_plane.any():
                projected = corner_points[on_plane] @ [-nz, nx]
                corner_distance = np.abs(samples[:, 2, None] - projected).min(axis=1)
        triangles = np.asarray(triangles)
        origin = np.minimum(triangles.min(axis=(0, 1)), samples[:, 2:4].min(0))
        triangles = (triangles - origin) / cell
        coordinates = (samples[:, 2:4] - origin) / cell
        shape = tuple((np.ceil(np.maximum(triangles.max(axis=(0, 1)), coordinates.max(0))).astype(int) + 2)[::-1])
        domain = np.zeros(shape, bool)
        for triangle in triangles:
            low = np.floor(triangle.min(0)).astype(int).clip(0)
            high = np.ceil(triangle.max(0)).astype(int)
            x, y = np.meshgrid(np.arange(low[0], high[0] + 1), np.arange(low[1], high[1] + 1))
            edge = (triangle[1:] - triangle[0]).T
            if abs(np.linalg.det(edge)) < 1e-10:
                continue
            bary = np.linalg.solve(edge, np.stack([x.ravel(), y.ravel()]) - triangle[0, :, None])
            inside = (bary.min(0) >= -1e-6) & (bary.sum(0) <= 1 + 1e-6)
            domain[y.ravel()[inside], x.ravel()[inside]] = True
        grid = np.rint(coordinates).astype(int)
        observations = samples[:, 4] > 0
        domain[grid[observations, 1], grid[observations, 0]] = True
        labels = ndimage.label(domain, structure=np.ones((3, 3)))[0]
        _, nearest = ndimage.distance_transform_edt(~domain, return_indices=True)
        labels = labels[nearest[0], nearest[1]]
        filters.append((samples[:, :2].astype(int), grid, coordinates, labels,
                        samples[:, 3], cell, observations, corner_distance))
    return filters


def soften_walls(image, filters, islands, radius=.12, start=2.0, feather=.15, edge_guard=0.0):
    """Suaviza a faixa alta; edge_guard preserva o rebatimento original nas bordas do plano."""
    on_wall = np.zeros(islands.shape, bool)
    for pixels, grid, coordinates, labels, height, cell, observations, corner_distance in filters:
        iy, ix = pixels.T
        gx, gy = grid.T
        room = labels[gy, gx]
        values = image[iy, ix, :3]
        out = values.copy()
        blend = np.clip((height - start) / feather, 0, 1)
        for label in np.unique(room):
            selected = room == label
            observed = selected & observations
            if edge_guard and observed.any():
                across = coordinates[selected, 0]
                observed_across = coordinates[observed, 0]
                distance = np.minimum(across - observed_across.min(), observed_across.max() - across) * cell
                if corner_distance is not None:
                    distance = np.minimum(distance, corner_distance[selected])
                fade = np.clip((distance - edge_guard) / radius, 0, 1)
                blend[selected] *= fade * fade * (3 - 2 * fade)
            count = np.zeros(labels.shape)
            accumulated = np.zeros((*labels.shape, 3))
            np.add.at(count, (gy[observed], gx[observed]), 1)
            np.add.at(accumulated, (gy[observed], gx[observed]), values[observed])
            valid = count > 0
            accumulated /= np.maximum(count, 1)[..., None]
            count = ndimage.gaussian_filter(valid.astype(float), radius / cell, mode='constant')
            at = coordinates[selected, ::-1].T
            weight = ndimage.map_coordinates(count, at, order=1, mode='nearest')
            for channel in range(3):
                blurred = ndimage.gaussian_filter(accumulated[..., channel], radius / cell, mode='constant')
                out[selected, channel] = ndimage.map_coordinates(blurred, at, order=1, mode='nearest') / np.maximum(weight, 1e-12)
        image[iy, ix, :3] = values + (out - values) * blend[:, None]
        on_wall[iy[blend > 0], ix[blend > 0]] = True
    # O bilinear também lê a margem do atlas: ela precisa acompanhar a superfície corrigida.
    covered = islands > 0
    distance, near = ndimage.distance_transform_edt(~covered, return_indices=True)
    margin = ~covered & (distance <= 4) & on_wall[near[0], near[1]] & ~on_wall
    image[margin, :3] = image[near[0][margin], near[1][margin], :3]
    return on_wall | margin

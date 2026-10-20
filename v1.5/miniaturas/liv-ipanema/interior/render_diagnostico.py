"""Low-cost Cycles previews of the exact imported LIV scene before rebaking.

The source materials, fixtures and diffuse lighting are unchanged. The ceiling
is hidden only from camera rays for the top view; its shadow/indirect contribution
remains active. No exposure or atlas edits are used to compensate geometry defects.
"""
from pathlib import Path
import argparse
import hashlib
import json
import math
import sys
import time
import bpy
import numpy as np
from mathutils import Vector

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from bake_luz import aim, compute_device, web_position


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--blend', type=Path, required=True)
    parser.add_argument('--out', type=Path, required=True)
    parser.add_argument('--samples', type=int, default=24)
    parser.add_argument('--position', type=float, nargs=3, default=[2.65, 1.65, -.3])
    parser.add_argument('--target', type=float, nargs=3, default=[.4, .6, 2.075])
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
    bpy.ops.wm.open_mainfile(filepath=str(args.blend.resolve()))
    scene = bpy.context.scene; scene.render.engine = 'CYCLES'
    backend, devices = compute_device(scene)
    scene.cycles.samples = args.samples; scene.cycles.use_denoising = True
    scene.render.resolution_x = 900; scene.render.resolution_y = 1000; scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'; scene.render.image_settings.color_mode = 'RGB'
    scene.view_settings.exposure = 0
    args.out.mkdir(parents=True, exist_ok=True)
    camera_data = bpy.data.cameras.new('LIV diagnostic camera')
    camera_data.sensor_fit = 'VERTICAL'; camera_data.sensor_height = 24; camera_data.lens = 24 / (2 * math.tan(math.radians(72) / 2))
    camera = bpy.data.objects.new(camera_data.name, camera_data); scene.collection.objects.link(camera); scene.camera = camera
    camera.location = web_position(args.position); aim(camera, web_position(args.target))
    original_source_sha = scene.get('liv_source_sha256'); unit_sha = scene.get('liv_unit_sha256')
    expected = {'sourceSHA256': original_source_sha, 'unitSHA256': unit_sha,
                'backend': backend, 'devices': devices, 'samples': args.samples,
                'exposure': 0, 'atlasUsed': False, 'renderDenoising': True, 'images': []}
    started = time.perf_counter()
    scene.render.filepath = str((args.out / 'diagnostic-sala.png').resolve())
    bpy.ops.render.render(write_still=True)
    expected['images'].append({'name': 'diagnostic-sala.png', 'positionWeb': args.position, 'targetWeb': args.target,
                               'sha256': hashlib.sha256((args.out / 'diagnostic-sala.png').read_bytes()).hexdigest(),
                               'seconds': time.perf_counter() - started, 'ceilingCameraVisible': True})
    shell = [obj for obj in scene.objects if obj.type == 'MESH' and obj.get('liv_slot') == 0]
    if not shell:
        raise RuntimeError('Exact imported wall mesh is absent')
    points = [obj.matrix_world @ Vector(vertex.co) for obj in shell for vertex in obj.data.vertices]
    xyz = np.asarray([list(point) for point in points]); lo = xyz.min(0); hi = xyz.max(0); center = (lo + hi) / 2
    center[2] = .25
    ceiling_hidden = []
    for obj in scene.objects:
        if obj.type == 'MESH' and (obj.name == 'forro-original' or obj.name.startswith('plafon')):
            obj.visible_camera = False; ceiling_hidden.append(obj.name)
    scene.render.resolution_x = 1000; scene.render.resolution_y = 760
    camera_data.type = 'ORTHO'; camera_data.ortho_scale = max(hi[0] - lo[0], hi[1] - lo[1]) * 1.29
    camera.location = Vector((center[0] + .7, center[1] - 6, 10)); aim(camera, center)
    scene.render.filepath = str((args.out / 'diagnostic-topo.png').resolve()); started = time.perf_counter()
    bpy.ops.render.render(write_still=True)
    expected['images'].append({'name': 'diagnostic-topo.png', 'positionBlender': list(camera.location), 'targetBlender': center.tolist(),
                               'sha256': hashlib.sha256((args.out / 'diagnostic-topo.png').read_bytes()).hexdigest(),
                               'seconds': time.perf_counter() - started, 'ceilingCameraVisible': False,
                               'ceilingShadowAndIndirectPreserved': True, 'cameraHiddenObjects': ceiling_hidden})
    (args.out / 'diagnostic-render.json').write_text(json.dumps(expected, indent=2), encoding='utf8')
    print('LIV_DIAGNOSTIC_RENDER_COMPLETE', json.dumps(expected), flush=True)


if __name__ == '__main__':
    main()

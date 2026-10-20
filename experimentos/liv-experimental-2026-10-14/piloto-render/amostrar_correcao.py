"""Seleciona e renderiza referências de piso/horizonte/teto dos seis ambientes.

As amostras corrigidas usam exatamente as poses e parâmetros do plano final.
As referências originais ficam separadas; nunca entram no dataset corrigido.
"""
import bpy
import hashlib
import json
import math
from pathlib import Path
import sys
import time
from mathutils import Matrix, Quaternion, Vector

args = sys.argv[sys.argv.index('--')+1:]
def arg(name, default=None): return args[args.index(name)+1] if name in args else default
root = Path(arg('--pasta')).resolve()
baseline = '--original' in args
config = json.loads((root/'dataset/plano-captura.json').read_text(encoding='utf-8'))
if baseline:
    # Isola a mudança de vidro: mesma geometria/porta/luzes, apenas o shader anterior.
    render_device = bpy.context.scene.cycles.device
    bpy.ops.wm.open_mainfile(filepath=str(root/'apartamento.blend'))
    bpy.context.scene.cycles.device = render_device
    original_glass = bpy.data.materials['MAT-vidro-volumetrico-original']
    for obj in bpy.context.scene.objects:
        if obj.type != 'MESH': continue
        for slot in obj.material_slots:
            if slot.material and slot.material.name == 'Vidro': slot.material = original_glass
scene = bpy.context.scene
data = config['dataset']
assert hashlib.sha256(Path(bpy.data.filepath).read_bytes()).hexdigest() == config['source_sha256']
selection_path = root/'amostras.json'
if not selection_path.exists():
    assert not baseline, 'Selecione amostras na fonte corrigida primeiro'
    selection = []
    for room in sorted({f['comodo'] for f in data['frames']}):
        candidates = [f for f in data['frames'] if f['comodo'] == room and f['pitch'] == 0]
        centers = {f['position_id']: Vector([f['transform_matrix'][k][3] for k in range(3)]) for f in candidates}
        mean = sum(centers.values(), Vector())/len(centers)
        pos = min(centers, key=lambda p: (centers[p]-mean).length)
        options = [f for f in candidates if f['position_id'] == pos]
        def depth(f):
            matrix = Matrix(f['transform_matrix'])
            hit, loc, *_ = scene.ray_cast(bpy.context.evaluated_depsgraph_get(), matrix.translation, -matrix.col[2].xyz)
            return (loc-matrix.translation).length if hit else 50
        horizontal = max(options, key=depth)
        direction = -Matrix(horizontal['transform_matrix']).col[2].xyz
        for pitch in (-60, 0, 60):
            choices = [f for f in data['frames'] if f['comodo'] == room and f['position_id'] == pos and f['pitch'] == pitch]
            assert choices, (room, pitch)
            selected = max(choices, key=lambda f: (-Matrix(f['transform_matrix']).col[2].xyz).dot(direction))
            selection.append({'room': room, 'pitch': pitch, 'frame': selected})
    selection_path.write_text(json.dumps(selection, ensure_ascii=False, indent=2), encoding='utf-8')
selection = json.loads(selection_path.read_text(encoding='utf-8'))

cd = bpy.data.cameras.new('CAM-validacao-captura')
cd.sensor_width, cd.sensor_fit, cd.clip_start = 36, 'HORIZONTAL', .05
cd.dof.use_dof = False
cam = bpy.data.objects.new('CAM-validacao-captura', cd)
scene.collection.objects.link(cam)
scene.camera = cam
scene.render.resolution_percentage = 100
scene.render.pixel_aspect_x = scene.render.pixel_aspect_y = 1
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGB'
scene.cycles.samples = config['amostras']
scene.cycles.use_denoising = True
scene.render.use_persistent_data = True
results = []

def render(path, matrix, w, h, lens):
    cam.matrix_world = matrix
    cd.lens = lens
    scene.render.resolution_x, scene.render.resolution_y = w, h
    bpy.context.view_layer.update()
    if not path.exists():
        path.parent.mkdir(parents=True, exist_ok=True)
        partial = path.with_suffix('.partial.png')
        scene.render.filepath = str(partial)
        start = time.monotonic()
        bpy.ops.render.render(write_still=True)
        partial.replace(path)
        print('AMOSTRA', path.name, round(time.monotonic()-start, 2), flush=True)

# Câmera exata que comprovou o preto na entrada.
q = Quaternion((.10501673075224097,-.02963032517767816,-.9566784973500052,-.2699255134293759))
to_blender = Matrix.Rotation(math.pi/2, 4, 'X')
matrix = to_blender @ q.to_matrix().to_4x4()
matrix.translation = to_blender @ Vector((-1.475, 1.62, .7500000000000004))
if not baseline:
    render(root/'evidencias/entrada-corrigida.png', matrix, 1265, 468,
           36/(2*math.tan(math.radians(48)/2)*2.702991452991453))
cam.matrix_world = matrix
bpy.context.view_layer.update()
ray_checks = []
fx = 1265/(2*math.tan(math.radians(48)/2)*2.702991452991453)
for x, y in ((1100,250),(1120,350)):
    direction = matrix.to_3x3() @ Vector(((x-632.5)/fx, (234-y)/fx, -1)).normalized()
    hit, _, _, _, obj, _ = scene.ray_cast(bpy.context.evaluated_depsgraph_get(), matrix.translation, direction)
    ray_checks.append({'pixel': [x,y], 'object': obj.name if hit else None})
if not baseline: assert all(r['object'] == 'GEO-porta-entrada-fechada' for r in ray_checks), ray_checks

for row in selection:
    if baseline and (row['pitch'] != 0 or row['room'] not in ('Sala integrada', 'Banho')): continue
    frame = row['frame']
    if arg('--apenas') and Path(frame['file_path']).name not in arg('--apenas').split(','): continue
    path = root/('originais' if baseline else 'dataset')/frame['file_path']
    render(path, Matrix(frame['transform_matrix']), data['w'], data['h'], 36*data['fl_x']/data['w'])
    results.append({'room': row['room'], 'pitch': row['pitch'], 'file_path': path.relative_to(root).as_posix()})
(root/('amostras-parciais.json' if arg('--apenas') else 'amostras-originais-renderizadas.json' if baseline else 'amostras-renderizadas.json')).write_text(
    json.dumps({'source_sha256': hashlib.sha256(Path(bpy.data.filepath).read_bytes()).hexdigest(),
                'samples': config['amostras'], 'resolution': [data['w'],data['h']],
                'glass_override': 'MAT-vidro-volumetrico-original' if baseline else None,
                'entry_rays': ray_checks if not baseline else [], 'images': results}, ensure_ascii=False, indent=2), encoding='utf-8')
print('AMOSTRAS-FIM', len(results), flush=True)

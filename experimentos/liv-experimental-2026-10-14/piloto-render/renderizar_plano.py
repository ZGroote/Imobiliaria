"""Renderiza poses já aprovadas, repartidas entre GPUs, sem recalcular ou mudar o plano."""
import bpy
import hashlib
import json
from pathlib import Path
import struct
import sys
import time
from mathutils import Matrix

args = sys.argv[sys.argv.index('--')+1:]
def arg(name, default): return args[args.index(name)+1] if name in args else default
pasta = Path(arg('--pasta','dataset'))
parte, partes = int(arg('--parte','0')), int(arg('--partes','1'))
limite = int(arg('--limite','0'))
config = json.loads((pasta/'plano-captura.json').read_text(encoding='utf-8'))
with open(bpy.data.filepath,'rb') as f: sha = hashlib.file_digest(f,'sha256').hexdigest()
if sha != config['source_sha256']: raise RuntimeError('Cena diferente da fonte aprovada')
if not 0 <= parte < partes: raise ValueError('Partição inválida')
data = config['dataset']
scene = bpy.context.scene
scene.render.resolution_x,scene.render.resolution_y = data['w'],data['h']
scene.render.resolution_percentage = 100
scene.render.pixel_aspect_x = scene.render.pixel_aspect_y = 1
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGB'
scene.cycles.samples = config['amostras']
scene.cycles.use_denoising = True
scene.render.use_persistent_data = True
cd = bpy.data.cameras.new('capture-approved')
cd.sensor_width = 36
cd.sensor_fit = 'HORIZONTAL'
cd.lens = 36 * data['fl_x']/data['w']
cd.clip_start = .05
cd.dof.use_dof = False
cam = bpy.data.objects.new('capture-approved',cd)
scene.collection.objects.link(cam)
scene.camera = cam
(pasta/'images').mkdir(parents=True,exist_ok=True)
done = 0
for index,frame in enumerate(data['frames']):
    if index % partes != parte: continue
    path = pasta/frame['file_path']
    if path.exists():
        with path.open('rb') as f: header=f.read(24);f.seek(-12,2);end=f.read()
        if header[:8]==b'\x89PNG\r\n\x1a\n' and struct.unpack('>II',header[16:24])==(data['w'],data['h']) and end[4:8]==b'IEND': continue
        raise RuntimeError(f'Imagem incompleta: {path}; preservar e revisar antes de retomar')
    begin = time.monotonic()
    cam.matrix_world = Matrix(frame['transform_matrix'])
    bpy.context.view_layer.update()
    partial = path.with_suffix('.partial.png')
    scene.render.filepath = str(partial)
    bpy.ops.render.render(write_still=True)
    partial.replace(path)
    done += 1
    print(f'VISTA {parte} {index+1}/{len(data["frames"])} {time.monotonic()-begin:.2f}s',flush=True)
    if limite and done >= limite: break
print(f'PARTE-FIM {parte} novas={done}',flush=True)

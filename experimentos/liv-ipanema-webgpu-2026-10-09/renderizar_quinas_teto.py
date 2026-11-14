"""Renderiza as mesmas quinas antes/depois na cena própria importada para o bake."""
import hashlib
import json
from pathlib import Path

import bpy
from mathutils import Matrix, Vector

EXP = Path(__file__).resolve().parent
ROOT = EXP.parents[1]
BASIS = Matrix(((1,0,0,0),(0,0,-1,0),(0,1,0,0),(0,0,0,1)))
VIEWS = {
    'suite': ([-3.5,2.25,-2.0], [-4.16,2.63,-2.735]),
    'sala': ([.4,2.25,2.1], [1.045,2.63,3.035]),
    'banho': ([-2.85,2.25,1.65], [-3.27,2.63,.815]),
}


def main():
    scene = bpy.context.scene
    out = EXP/'evidencias/rodateto-autoria'; out.mkdir(parents=True,exist_ok=True)
    scene.cycles.samples = 24
    scene.cycles.use_denoising = True
    scene.render.resolution_x = 800; scene.render.resolution_y = 600; scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    cam = bpy.data.objects.new('Revisão de quinas', bpy.data.cameras.new('Revisão de quinas'))
    scene.collection.objects.link(cam); scene.camera = cam; cam.data.lens = 24
    current = scene.objects.get('rodateto')
    assert current and current['liv_slot'] == 19
    original = ROOT/'v1.5/miniaturas/liv-ipanema/interior/luz/source.json'
    source = json.loads(original.read_bytes()); earlier = []
    for o in source['objects']:
        if o['name'] != 'rodateto': continue
        g = source['geometries'][o['geometry']]
        p = [g['position'][i:i+3] for i in range(0,len(g['position']),3)]
        ids = g['index'] or list(range(len(p)))
        mesh = bpy.data.meshes.new('Moldura anterior')
        mesh.from_pydata(p,[],[ids[i:i+3] for i in range(0,len(ids),3)]); mesh.update()
        mesh.materials.append(current.data.materials[0])
        obj = bpy.data.objects.new('Moldura anterior',mesh); scene.collection.objects.link(obj)
        obj.matrix_world = BASIS @ Matrix([o['matrix'][i::4] for i in range(4)])
        earlier.append(obj)
    images = []
    for edition in ['antes','depois']:
        current.hide_render = edition == 'antes'
        for o in earlier: o.hide_render = edition == 'depois'
        for name,(position,target) in VIEWS.items():
            cam.location = (BASIS @ Vector([*position,1]))[:3]
            to = Vector((BASIS @ Vector([*target,1]))[:3])
            cam.rotation_euler = (to-cam.location).to_track_quat('-Z','Y').to_euler()
            path = out/f'{edition}-{name}.png'; scene.render.filepath = str(path)
            bpy.ops.render.render(write_still=True)
            images.append({'file':path.name,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()})
    report = {'schema':'liv-molding-authoring-images-v1','sourceSHA256':scene['liv_source_sha256'],
              'unitSHA256':scene['liv_unit_sha256'],'views':VIEWS,'images':images,
              'scope':'Source PBR geometry preview before bake; identical scene/cameras/lighting, only moldings replaced'}
    (out/'autoria.json').write_text(json.dumps(report,indent=2),encoding='utf8')
    print('LIV_MOLDING_PREVIEW_READY', json.dumps(report), flush=True)


if __name__ == '__main__': main()

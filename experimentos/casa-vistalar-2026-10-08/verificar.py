"""Conferência do modelo e dos renders efetivamente entregues."""
import bpy
import json
import math
from pathlib import Path

OUT=Path(__file__).resolve().parent
scene=bpy.context.scene
deps=bpy.context.evaluated_depsgraph_get()
triangles=0
degenerate=0
meshes=[o for o in scene.objects if o.type=='MESH']
for o in meshes:
    eo=o.evaluated_get(deps)
    me=eo.to_mesh()
    me.calc_loop_triangles()
    triangles+=len(me.loop_triangles)
    degenerate+=sum(1 for p in me.polygons if p.area<1e-12)
    assert all(math.isfinite(c) for v in me.vertices for c in v.co),o.name
    eo.to_mesh_clear()
external=[im.filepath for im in bpy.data.images if im.source=='FILE' and not im.packed_file]
assert not external,external
assert scene.camera and scene.camera.type=='CAMERA'
assert scene.render.engine=='CYCLES'
images={}
for name in ['casa-vistalar-dia.png','casa-vistalar-fim-de-tarde.png']:
    path=OUT/name
    assert path.exists() and path.stat().st_size>100000,name
    im=bpy.data.images.load(str(path),check_existing=False)
    assert tuple(im.size)==(2000,1125),(name,tuple(im.size))
    images[name]={'pixels':list(im.size),'bytes':path.stat().st_size}
    bpy.data.images.remove(im)
report={
    'status':'OK',
    'blender':bpy.app.version_string,
    'renderer':scene.render.engine,
    'objects':len(scene.objects),
    'mesh_objects':len(meshes),
    'unique_meshes':len({o.data.name for o in meshes}),
    'shared_mesh_instances':len(meshes)-len({o.data.name for o in meshes}),
    'evaluated_triangles':triangles,
    'degenerate_polygons':degenerate,
    'materials':len(bpy.data.materials),
    'unpacked_external_images':external,
    'blend_bytes':(OUT/'casa-vistalar.blend').stat().st_size,
    'images':images,
    'note':'Estudo visual ilustrativo; vegetação inclui superfícies abertas de folhas.'
}
(OUT/'verificacao.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print('VERIFIED '+json.dumps(report),flush=True)

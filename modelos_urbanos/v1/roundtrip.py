"""Reimport three exported GLBs into clean Blender scenes and render the actual files."""
import bpy, json, importlib.util
from pathlib import Path
ROOT=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('urban_library',ROOT/'gerar.py')
lib=importlib.util.module_from_spec(spec);spec.loader.exec_module(lib)
catalog=json.loads((ROOT/'catalogo.json').read_text(encoding='utf-8'))
report=[]
for ident in ['casas-20','sobrados-04','predios-05']:
    scene=lib.setup()
    before=set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(ROOT/'glb'/f'{ident}.glb'))
    objs=[o for o in bpy.data.objects if o not in before and o.type=='MESH']
    assert len(objs)==1,(ident,len(objs))
    obj=objs[0];bpy.context.view_layer.update()
    expected=next(x for x in catalog['assets'] if x['id']==ident)['lod0']['dimensions_m']
    assert all(abs(a-b)<.025 for a,b in zip(obj.dimensions,expected)),(ident,list(obj.dimensions),expected)
    assert obj.data.color_attributes,ident+' missing colours'
    obj.hide_render=False
    lib.frame(obj)
    scene.render.filepath=str(ROOT/'validation'/f'roundtrip-{ident}.png')
    bpy.ops.render.render(write_still=True)
    report.append(dict(id=ident,dimensions_m=list(obj.dimensions),color_attributes=[x.name for x in obj.data.color_attributes],pass_dimensions=True))
(ROOT/'validation'/'roundtrip.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print('ROUNDTRIP_COMPLETE',len(report))

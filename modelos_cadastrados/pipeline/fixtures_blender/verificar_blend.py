import bpy, json, copy, importlib.util
from pathlib import Path
root=Path('modelos_cadastrados/pipeline')
spec=importlib.util.spec_from_file_location('montar',root/'montar_blender.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
recipe=json.loads((root/'fixtures_blender/receita.json').read_text())
m.validate(recipe)
checks=[]
for label,field,bad in [('centro_nan','centro',[float('nan'),0,0]),('dimensao_zero','tamanho',[0,1,1]),('cor_invalida','cor','file:///leia.py'),('tipo_invalido','tipo','exec'),('estimado_invalido','estimado','false')]:
 d=copy.deepcopy(recipe);d['partes'][0][field]=bad
 try:m.validate(d)
 except ValueError:checks.append(label)
 else:raise AssertionError(label)
d=copy.deepcopy(recipe);d['partes'][6]['triangulos']=[[0,1,900]]
try:m.validate(d)
except ValueError:checks.append('indice_invalido')
else:raise AssertionError('indice_invalido')
bpy.ops.wm.open_mainfile(filepath=str((root/'fixtures_blender/saida/projeto.blend').resolve()))
scene=bpy.context.scene
assert scene.name.startswith('Exterior-')
assert scene.unit_settings.system=='METRIC' and scene.unit_settings.scale_length==1
parents=[o for o in scene.objects if o.name.startswith('PARTE-')]
meshes=[o for o in scene.objects if o.name.startswith('GEO-')]
assert len(parents)==9 and len(meshes)==94
assert all(o.parent and o.get('parte')==o.parent.name for o in meshes)
assert all(all(key in o for key in ['tipo_receita','referencias','estimado','status']) for o in parents+meshes)
assert 'receita.json' in bpy.data.texts
references=[o for o in scene.objects if o.name.startswith('REF-')]
assert len(references)==1 and references[0].data.packed_file
signed={}
for name in ['GEO-paredes','GEO-coluna','GEO-escada']:
 mesh=bpy.data.objects[name].data;mesh.calc_loop_triangles()
 volume=sum(mesh.vertices[t.vertices[0]].co.dot(mesh.vertices[t.vertices[1]].co.cross(mesh.vertices[t.vertices[2]].co)) for t in mesh.loop_triangles)/6
 assert volume>0,(name,volume)
 signed[name]=volume
report={'passou':True,'validacoes_invalidas_rejeitadas':checks,'partes_editaveis':len(parents),'malhas_editaveis':len(meshes),'referencias_empacotadas':len(references),'volumes_orientados':signed}
(root/'fixtures_blender/verificacao-blend.json').write_text(json.dumps(report,indent=2),encoding='utf8')
print(json.dumps(report,indent=2))

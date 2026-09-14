import importlib.util,json,shutil,bpy
from pathlib import Path
root=Path('modelos_cadastrados/pipeline')
spec=importlib.util.spec_from_file_location('montar',root/'montar_blender.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
dest=(root/'fixtures_blender/manifesto').resolve();(dest/'fotos').mkdir(parents=True,exist_ok=True)
source=root/'fixtures_blender/saida/fotos/fachada.jpg'
for name in ['original.jpg','thumbnail-obsoleto.jpg']:shutil.copyfile(source,dest/'fotos'/name)
manifest={'fotos':[{'arquivo':'fotos/original.jpg'},{'arquivo':'fotos/original.jpg'}]}
(dest/'anuncio.json').write_text(json.dumps(manifest),encoding='utf8')
scene=bpy.data.scenes.new('Teste-manifesto')
count=m.add_references(scene,dest)
assert count==1,count
refs=[o.name for o in scene.objects]
assert refs==['REF-original'],refs
manifest['fotos']=[{'arquivo':'../receita.json'}]
(dest/'anuncio.json').write_text(json.dumps(manifest),encoding='utf8')
try:m.add_references(scene,dest)
except ValueError:pass
else:raise AssertionError('escape nao rejeitado')
manifest['fotos']=[{'arquivo':'fotos/original.jpg'}]
(dest/'anuncio.json').write_text(json.dumps(manifest),encoding='utf8')
print(json.dumps({'passou':True,'so_original_manifesto':True,'deduplicacao':True,'escape_rejeitado':True}))

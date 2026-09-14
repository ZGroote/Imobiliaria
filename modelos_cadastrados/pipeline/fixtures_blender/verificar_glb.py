import json, math, struct
from pathlib import Path
from collections import Counter
root=Path('modelos_cadastrados/pipeline/fixtures_blender')
data=(root/'saida/exterior.glb').read_bytes()
n=struct.unpack_from('<I',data,12)[0]
gltf=json.loads(data[20:20+n]); blob=data[28+n:]
nodes=gltf.get('nodes',[])
assert all(n.get('name','').startswith('GEO-') for n in nodes)
assert not gltf.get('cameras') and not gltf.get('animations')
assert not gltf.get('images') and not gltf.get('textures')
assert not gltf.get('extensionsRequired')
recipe=json.loads((root/'receita.json').read_text())
by_name={f'PARTE-{i:04d}-'+p['nome']:p for i,p in enumerate(recipe['partes'])}
seen=Counter(); max_error=0
# Blender exporter creates standalone nodes carrying world transforms.
def transform(v,n):
 x,y,z=v
 if 'matrix' in n:
  m=n['matrix']; return [m[j]*x+m[4+j]*y+m[8+j]*z+m[12+j] for j in range(3)]
 s=n.get('scale',[1,1,1]); x*=s[0];y*=s[1];z*=s[2]
 q=n.get('rotation',[0,0,0,1]); qx,qy,qz,qw=q
 tx=2*(qy*z-qz*y);ty=2*(qz*x-qx*z);tz=2*(qx*y-qy*x)
 x,y,z=x+qw*tx+qy*tz-qz*ty,y+qw*ty+qz*tx-qx*tz,z+qw*tz+qx*ty-qy*tx
 t=n.get('translation',[0,0,0]);return [x+t[0],y+t[1],z+t[2]]
for node in nodes:
 assert 'mesh' in node and not node.get('children'),node
 extra=node['extras']; part=by_name[extra['parte']];seen[part['tipo']]+=1
 assert extra['referencias']==json.dumps(part['referencias'],ensure_ascii=False)
 assert extra['estimado'] is True and extra['status']=='aguarda_revisao_visual'
 for primitive in gltf['meshes'][node['mesh']]['primitives']:
  attr=gltf['accessors'][primitive['attributes']['POSITION']];view=gltf['bufferViews'][attr['bufferView']]
  assert attr['componentType']==5126 and attr['type']=='VEC3'
  offset=view.get('byteOffset',0)+attr.get('byteOffset',0);stride=view.get('byteStride',12)
  for i in range(attr['count']):
   world=transform(struct.unpack_from('<fff',blob,offset+i*stride),node)
   x,y,z=[world[j]-part['centro'][j] for j in range(3)]
   a=math.radians(part['rotacao_graus']);local=[math.cos(a)*x-math.sin(a)*z,y,math.sin(a)*x+math.cos(a)*z]
   error=max(abs(local[j])-part['tamanho'][j]/2 for j in range(3));max_error=max(max_error,error)
   assert error<0.00005,(node['name'],local,part['tamanho'],error)
assert len(seen)==9,seen
report={'passou':True,'tipos':dict(seen),'max_erro_limite_metros':max_error,'glb_bytes':len(data),'nodes_so_geometria':len(nodes),'sem_texturas_externas':True,'metadados_preservados':True}
(root/'verificacao-glb.json').write_text(json.dumps(report,indent=2),encoding='utf8')
print(json.dumps(report,indent=2))

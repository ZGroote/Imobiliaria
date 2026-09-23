"""Cycles transport atlas on browser meshes. No video."""
import bpy,json,base64,math,time,sys,faulthandler
faulthandler.enable()
import numpy as np
from pathlib import Path
from mathutils import Matrix,Vector
H=Path(__file__).resolve().parent;O=H/'exterior-v3';D=json.loads((O/'source.json').read_text())
SIZE=int(sys.argv[-1]) if sys.argv[-1].isdigit() else 2048
UV=json.loads((O/'uv.json').read_text())
bpy.ops.wm.read_factory_settings(use_empty=True);s=bpy.context.scene;s.render.engine='CYCLES'
cp=bpy.context.preferences.addons['cycles'].preferences;cp.compute_device_type='OPTIX';cp.get_devices()
for dev in cp.devices:dev.use=dev.type=='OPTIX'
s.cycles.device='GPU';s.cycles.samples=128;s.cycles.max_bounces=8;s.cycles.diffuse_bounces=5;s.cycles.transparent_max_bounces=12;s.cycles.use_adaptive_sampling=False;s.cycles.seed=31
s.world=bpy.data.worlds.new('Daylight');s.world.use_nodes=True
bg=s.world.node_tree.nodes.get('Background');bg.inputs[0].default_value=(.72,.82,1,1);bg.inputs[1].default_value=.7
s.view_settings.view_transform='AgX';texdir=O/'textures';texdir.mkdir(exist_ok=True)
for k,t in D['textures'].items():(texdir/(k+'.png')).write_bytes(base64.b64decode(t['data'].split(',')[1]))
materials={}
for key,v in D['materials'].items():
 m=bpy.data.materials.new(v['name'] or key);m.use_nodes=True;nt=m.node_tree;bs=nt.nodes.get('Principled BSDF')
 bs.inputs['Base Color'].default_value=(*v['color'],1);bs.inputs['Roughness'].default_value=v['roughness'];bs.inputs['Metallic'].default_value=v['metalness']
 color=None
 if v['vertexColors']:
  col=nt.nodes.new('ShaderNodeVertexColor');col.layer_name='Color';color=col.outputs['Color']
 for field,socket in [('map','Base Color'),('normalMap','Normal'),('roughnessMap','Roughness'),('bumpMap','Normal')]:
  tk=v.get(field)
  if not tk:continue
  tx=nt.nodes.new('ShaderNodeTexImage');tx.image=bpy.data.images.load(str(texdir/(tk+'.png')),check_existing=False)
  if field!='map':tx.image.colorspace_settings.name='Non-Color'
  uv=nt.nodes.new('ShaderNodeUVMap');uv.uv_map='UVMap';mp=nt.nodes.new('ShaderNodeMapping');mp.inputs['Scale'].default_value=(*D['textures'][tk]['repeat'],1)
  nt.links.new(uv.outputs['UV'],mp.inputs['Vector']);nt.links.new(mp.outputs['Vector'],tx.inputs['Vector']);out=tx.outputs['Color']
  if field=='map' and color:
   mix=nt.nodes.new('ShaderNodeMixRGB');mix.blend_type='MULTIPLY';mix.inputs[0].default_value=1;nt.links.new(color,mix.inputs[1]);nt.links.new(out,mix.inputs[2]);out=mix.outputs[0];color=None
  if field=='normalMap':
   nm=nt.nodes.new('ShaderNodeNormalMap');nm.uv_map='UVMap';nm.inputs['Strength'].default_value=sum(v['normalScale'])/2;nt.links.new(out,nm.inputs['Color']);out=nm.outputs['Normal']
  if field=='bumpMap':
   nm=nt.nodes.new('ShaderNodeBump');nm.inputs['Distance'].default_value=v['bumpScale'];nm.inputs['Strength'].default_value=.5;nt.links.new(out,nm.inputs['Height']);out=nm.outputs['Normal']
  nt.links.new(out,bs.inputs[socket])
 if color:nt.links.new(color,bs.inputs['Base Color'])
 if v['opacity']<.5:
  tr=nt.nodes.new('ShaderNodeBsdfTransparent');mix=nt.nodes.new('ShaderNodeMixShader');mix.inputs[0].default_value=.08
  nt.links.new(tr.outputs[0],mix.inputs[1]);nt.links.new(bs.outputs[0],mix.inputs[2]);nt.links.new(mix.outputs[0],nt.nodes.get('Material Output').inputs['Surface'])
 materials[key]=m
basis=Matrix(((1,0,0,0),(0,0,-1,0),(0,1,0,0),(0,0,0,1)));targets=[];flipped=0
for oi,rec in enumerate(D['objects']):
 g=D['geometries'][rec['geometry']];pos=np.array(g['position']).reshape(-1,3);norm=np.array(g.get('normal') or np.zeros_like(pos).tolist()).reshape(-1,3);idx=np.array(g['index'] or list(range(len(pos)))).reshape(-1,3)
 bad=np.sum(np.cross(pos[idx[:,1]]-pos[idx[:,0]],pos[idx[:,2]]-pos[idx[:,0]])*norm[idx[:,0]],axis=1)<0;idx[bad]=idx[bad][:,[0,2,1]];flipped+=int(bad.sum())
 me=bpy.data.meshes.new(str(oi));me.from_pydata(pos.tolist(),[],idx.tolist());me.update()
 for mk in rec['materials']:me.materials.append(materials[mk])
 for group in g['groups']:
  for i in range(group['start']//3,(group['start']+group['count'])//3):
   if i<len(me.polygons):me.polygons[i].material_index=group['materialIndex']
 uv=me.uv_layers.new(name='UVMap')
 if g.get('uv'):
  for li,lp in enumerate(me.loops):uv.data[li].uv=g['uv'][lp.vertex_index*2:lp.vertex_index*2+2]
 if g.get('color'):
  attr=me.color_attributes.new(name='Color',type='FLOAT_COLOR',domain='POINT')
  for i,co in enumerate(attr.data):co.color=(*g['color'][i*3:i*3+3],1)
 if str(oi) in UV:
  uv1=me.uv_layers.new(name='Lightmap')
  assert len(UV[str(oi)])==len(me.loops)
  for li,item in enumerate(uv1.data):item.uv=UV[str(oi)][li]
  me.uv_layers.active=uv1
 for poly in me.polygons:poly.use_smooth=True
 ob=bpy.data.objects.new(f'{oi}-{rec["name"]}',me);s.collection.objects.link(ob);a=rec['matrix'];ob.matrix_world=basis@Matrix([a[i::4] for i in range(4)])
 if rec['name']=='plafon':ob.visible_shadow=False
 elif all(D['materials'][k]['opacity']>=.5 for k in rec['materials']):targets.append(ob)
print('IMPORTED',len(D['objects']),'targets',len(targets),'flipped',flipped,flush=True)
def aim(o,p):o.rotation_euler=(Vector(p)-o.location).to_track_quat('-Z','Y').to_euler()
for room in D['rooms']:
 ld=bpy.data.lights.new('Plafom '+room['name'],'AREA');ld.energy=45;ld.shape='DISK';ld.size=.32;ld.color=(1,.95,.86)
 ob=bpy.data.objects.new(ld.name,ld);s.collection.objects.link(ob);ob.location=(room['x'],-room['z'],D['height']-.16);aim(ob,(room['x'],-room['z'],0))
ld=bpy.data.lights.new('Sun through windows','SUN');ld.energy=2.5;ld.angle=math.radians(4)
ob=bpy.data.objects.new(ld.name,ld);s.collection.objects.link(ob);ob.location=(-40,-55,85);aim(ob,(0,0,0))
# Neutral ground for bounce light at the foot of the towers.
bpy.ops.mesh.primitive_plane_add(size=300, location=(22,0,-.03))
ground=bpy.context.object;ground.name='Neutral presentation ground'
gmat=bpy.data.materials.new('Neutral stone');gmat.diffuse_color=(.25,.27,.26,1);ground.data.materials.append(gmat)
bpy.ops.object.select_all(action='DESELECT')
for ob in targets:ob.select_set(True)
bpy.context.view_layer.objects.active=targets[0];print('JOIN START',flush=True);bpy.ops.object.join();print('JOIN DONE',flush=True);atlas=bpy.context.object;atlas.name='Baked interior surfaces';me=atlas.data
me.uv_layers.active=me.uv_layers['Lightmap']
img=bpy.data.images.new('Diffuse transport',SIZE,SIZE,alpha=True,float_buffer=True);img.colorspace_settings.name='Non-Color'
for m in me.materials:
 nt=m.node_tree;node=nt.nodes.new('ShaderNodeTexImage');node.image=img;nt.nodes.active=node
s.render.bake.use_clear=True;s.render.bake.margin=4;s.render.bake.use_pass_color=False;s.render.bake.use_pass_direct=True;s.render.bake.use_pass_indirect=True
bpy.ops.wm.save_as_mainfile(filepath=str(O/'lightmap-scene.blend'))
t=time.perf_counter();print('BAKE START',SIZE,flush=True);bpy.ops.object.bake(type='DIFFUSE',pass_filter={'DIRECT','INDIRECT'})
pixels=np.empty(SIZE*SIZE*4,dtype=np.float32);img.pixels.foreach_get(pixels);pixels.tofile(str(O/'irradiance.f32'))
(O/'bake.json').write_text(json.dumps({'size':SIZE,'seconds':time.perf_counter()-t,'samples':s.cycles.samples,'objects':len(UV),'triangles':len(me.polygons),'flipped':flipped,'passes':['DIRECT','INDIRECT'],'colorPass':False},indent=2))
img.filepath_raw=str(O/'irradiance.exr');img.file_format='OPEN_EXR';img.save();bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(O/'lightmap-scene.blend'));print('BAKE COMPLETE',flush=True)

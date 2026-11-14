"""Exporta uma cópia leve da cena; não modifica o arquivo Blender original."""
import bpy, json, math
import numpy as np
from pathlib import Path
OUT=Path(__file__).resolve().parent
scene=bpy.context.scene
rng=np.random.default_rng(2718)
for mat in bpy.data.materials:
    if not mat.use_nodes:continue
    nodes=mat.node_tree.nodes; links=mat.node_tree.links
    p=next((n for n in nodes if n.type=='BSDF_PRINCIPLED'),None)
    ramp=next((n for n in nodes if n.type=='VALTORGB'),None)
    if not p or not ramp:continue
    size=256
    a=np.array(ramp.color_ramp.elements[0].color[:3]);b=np.array(ramp.color_ramp.elements[-1].color[:3])
    yy,xx=np.mgrid[0:size,0:size]/size
    grain='oak' in mat.name.lower()
    noise=rng.random((size,size))*.15
    if grain:
        f=.5+.09*np.sin(xx*180+np.sin(yy*12)*2)+.05*np.sin(xx*500+yy*3)+noise*.5-.0375
    else:
        # Smooth random mineral variation without repeating stripes on large lawns.
        grid=rng.random((12,12))
        coarse=np.array([np.interp(np.linspace(0,11,size),np.arange(12),row) for row in grid])
        smooth=np.array([np.interp(np.linspace(0,11,size),np.arange(12),coarse[:,i]) for i in range(size)]).T
        f=.5+(smooth-.5)*.30+(noise-.075)*.45
    pixels=np.ones((size,size,4),np.float32)
    # Blender image pixels are scene linear; image export converts to sRGB.
    pixels[:,:,:3]=a[None,None,:]+(b-a)[None,None,:]*np.clip(f[:,:,None],0,1)
    im=bpy.data.images.new('WEB-'+mat.name,width=size,height=size)
    im.pixels.foreach_set(pixels.ravel());im.filepath_raw=str(OUT/(mat.name.replace('MAT | ','').replace(' ','-')+'.png'));im.file_format='PNG';im.save();im.pack()
    for link in list(p.inputs['Base Color'].links):links.remove(link)
    for link in list(p.inputs['Normal'].links):links.remove(link)
    tex=nodes.new('ShaderNodeTexImage');tex.image=im
    links.new(tex.outputs['Color'],p.inputs['Base Color'])

seen=set()
for o in list(scene.objects):
    if o.type!='MESH':continue
    if 'GEO-Car ' in o.name:
        # Apply object material overrides to mesh data before evaluated export.
        materials=[s.material for s in o.material_slots]
        o.data=o.data.copy()
        paint=bpy.data.materials.get('MAT | Touring '+('graphite' if 'graphite' in o.name else 'pearl')+' paint')
        for i,m in enumerate(materials):
            o.material_slots[i].link='DATA'
            o.data.materials[i]=paint if m and ('Paint' in m.name or 'Touring' in m.name) else m
    # Web foliage is reduced while the native render retains its detail.
    if any(s in o.name.lower() for s in ['leaf','grass','foliage','shrub','liriope','lawn blades']) and len(o.data.polygons)>100:
        d=o.modifiers.new('Web foliage budget','DECIMATE');d.ratio=.22
    elif 'GEO-Car ' in o.name and len(o.data.polygons)>2000:
        d=o.modifiers.new('Web car budget','DECIMATE');d.ratio=.38
    mesh=o.data
    if mesh.name in seen or mesh.uv_layers:continue
    seen.add(mesh.name)
    uv=mesh.uv_layers.new(name='UVMap')
    horizontal=any('horizontal' in m.name.lower() for m in mesh.materials if m)
    for face in mesh.polygons:
        normal=face.normal; axis=max(range(3),key=lambda i:abs(normal[i]))
        axes=(1,2) if axis==0 else ((0,2) if axis==1 else (0,1))
        if horizontal:axes=axes[::-1]
        for idx in face.loop_indices:
            v=mesh.vertices[mesh.loops[idx].vertex_index].co
            uv.data[idx].uv=(v[axes[0]],v[axes[1]])

bpy.ops.object.select_all(action='DESELECT')
for o in scene.objects:
    if o.type=='MESH' or o.get('door'):o.select_set(True)
target=OUT/'casa-vistalar-web.glb'
bpy.ops.export_scene.gltf(filepath=str(target),export_format='GLB',use_selection=True,export_apply=True,export_extras=True,export_animations=False,export_cameras=False,export_lights=False,export_yup=True)
report={'bytes':target.stat().st_size,'objects':sum(o.type=='MESH' for o in scene.objects),'doors':[o.get('label') for o in scene.objects if o.get('door')]}
(OUT/'web-metrics.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print('WEB_READY',report,flush=True)

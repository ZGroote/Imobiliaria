"""Completa a mesma casa para uma visita real em dois pavimentos."""
import bpy
import math
import json
import sys
import importlib.util
from pathlib import Path
from mathutils import Vector,Matrix

OUT=Path(__file__).resolve().parent
if '--build-only' not in sys.argv:sys.argv.append('--build-only')
spec=importlib.util.spec_from_file_location('casa_base',OUT/'gerar_casa.py')
base=importlib.util.module_from_spec(spec);spec.loader.exec_module(base)
box=base.box;cylinder=base.cylinder;sphere=base.sphere;mesh=base.mesh
scene=bpy.context.scene

def remove(name):
    o=bpy.data.objects.get('GEO-'+name)
    if o:bpy.data.objects.remove(o,do_unlink=True)

def solid(name,loc,size,mat=None,bevel=.015):
    o=box(name,loc,size,mat or base.plaster,bevel);o['collidable']=True;return o

def door(name,hinge,width,height,axis='X',glass=False,slide=False):
    root=bpy.data.objects.new('PORTA-'+name,None);base.ACTIVE.objects.link(root);root.location=hinge
    root['door']=True;root['label']=name;root['slide']=slide;root['travel']=width if slide else math.pi/2
    loc=(hinge[0]+width/2,hinge[1],hinge[2]+height/2) if axis=='X' else (hinge[0],hinge[1]+width/2,hinge[2]+height/2)
    size=(width,.035,height) if axis=='X' else (.035,width,height)
    leaf=box(name+' leaf',loc,size,base.glass if glass else base.wood,.006)
    leaf['collidable']=True
    parts=[leaf]
    if not glass:
        for i in range(12):
            off=(i+.5)*width/12
            p=(hinge[0]+off,hinge[1]-.023,hinge[2]+height*.5) if axis=='X' else (hinge[0]-.023,hinge[1]+off,hinge[2]+height*.5)
            s=(.004,.012,height-.04) if axis=='X' else (.012,.004,height-.04)
            parts.append(box(name+' groove',p,s,base.dark,.0))
        p=(hinge[0]+width-.12,hinge[1]-.06,hinge[2]+1.0) if axis=='X' else (hinge[0]-.06,hinge[1]+width-.12,hinge[2]+1.0)
        parts.append(box(name+' handle',p,(.13,.03,.02) if axis=='X' else (.03,.13,.02),base.black,.007))
    bpy.context.view_layer.update()
    for o in parts:
        mw=o.matrix_world.copy();o.parent=root;o.matrix_world=mw
    return root

base.ACTIVE=base.collections['01 Arquitetura']
# Open the entrance in the original facade instead of leaving a wall behind the door.
remove('Entrance side wall');remove('Entrance recess')
solid('Entrance wall left',(-3.55,.85,1.94),(.40,.20,2.77))
solid('Entrance wall right',(-.39,.85,1.94),(2.10,.20,2.77))
solid('Entrance header',(-2.70,.85,3.25),(2.10,.20,.20))
parts=[o for o in scene.objects if o.name.startswith(('GEO-Oak pivot door','GEO-Door vertical board','GEO-Door pull'))]
entry=bpy.data.objects.new('PORTA-Entrada principal',None);base.ACTIVE.objects.link(entry);entry.location=(-3.33,.64,.585)
entry['door']=True;entry['label']='Entrada principal';entry['travel']=math.pi/2;entry['slide']=False
bpy.context.view_layer.update()
for o in parts:
    mw=o.matrix_world.copy();o.parent=entry;o.matrix_world=mw
    if o.name.startswith('GEO-Oak pivot door'):o['collidable']=True

# A real floor opening and 18 treads; no teleport is necessary to change storeys.
remove('Upper suite floor')
solid('Upper floor west',(-3.995,4,3.60),(5.29,6.9,.22),base.wood_h)
solid('Upper floor front',(-2.94,1.10,3.60),(7.4,1.10,.22),base.wood_h)
solid('Upper landing',(-2.94,6.90,3.60),(7.4,1.10,.22),base.wood_h)
solid('Upper floor east',(.365,4,3.60),(.79,4.7,.22),base.wood_h)
for i in range(18):
    y=1.65+(i+.5)*4.7/18
    z=.59+(i+1)*3.12/18
    box('Stair oak tread '+str(i+1),(-.60,y,z-.05),(1.22,4.7/18+.007,.10),base.wood_h,.008)
    box('Stair warm nosing '+str(i+1),(-.60,y-4.7/36,z-.048),(1.16,.011,.012),base.emissive,.001)
for x in [-.97,-.22]:
    cylinder('Stair steel stringer',(x,1.70,.49),(x,6.25,3.55),.06,base.black,10)
for x in [-1.25,.04]:
    v=[(x,1.65,.70),(x,6.35,3.77),(x,6.35,4.66),(x,1.65,1.59)]
    o=mesh('Stair glass guard',v,[(0,1,2,3)],base.glass);o['collidable']=True
    cylinder('Stair oak handrail',(x,1.65,1.64),(x,6.35,4.74),.024,base.wood,12)
# Ground-floor washroom below the high end of the stair.
solid('Lavabo front',(-.39,5.17,1.69),(1.93,.14,2.20))
solid('Lavabo door jamb front',(-1.38,5.38,1.69),(.14,.40,2.20))
solid('Lavabo door jamb rear',(-1.38,6.90,1.69),(.14,.85,2.20))
solid('Lavabo door header',(-1.38,6.025,2.69),(.14,.91,.20))
door('Lavabo',(-1.39,5.59,.59),.87,2.0,axis='Y')
# Upper suite and bathroom, each with an actual doorway.
solid('Suite front partition',(-3.23,.95,5.13),(.14,.80,2.84))
solid('Suite rear partition',(-3.23,4.85,5.13),(.14,5.20,2.84))
solid('Suite door header',(-3.23,1.80,6.18),(.14,.91,.73))
door('Suíte',(-3.23,1.35,3.71),.88,2.1,axis='Y')
solid('Bathroom upper front',(-2.34,4.43,5.13),(1.72,.14,2.84))
solid('Bathroom east wall front',(-1.48,5.40,5.13),(.14,1.80,2.84))
solid('Bathroom east wall rear',(-1.48,7.29,5.13),(.14,.20,2.84))
solid('Bathroom door header',(-1.48,6.75,6.18),(.14,.89,.73))
door('Banheiro da suíte',(-1.48,6.31,3.71),.85,2.1,axis='Y')
# Separate the tall glazing into lower panes and a sliding balcony door upstairs.
for o in list(scene.objects):
    if o.name.startswith('GEO-Double height glazing'):bpy.data.objects.remove(o,do_unlink=True)
for x in [-5.72,-4.42]:
    o=solid('Living tall glass',(x,.39,2.09),(1.24,.012,2.83),base.glass,.001)
solid('Suite fixed balcony pane',(-5.72,.39,5.01),(1.24,.012,2.72),base.glass,.001)
door('Varanda',(-5.04,.39,3.71),1.24,2.70,glass=True,slide=True)
# Rear windows bring natural light to the dining area and desk.
remove('Rear wall')
solid('Rear wall west',(-6.55,7.4,3.65),(.30,.24,6.3))
solid('Rear wall east',(-1.33,7.4,3.65),(4.24,.24,6.3))
solid('Rear window sill',(-4.93,7.4,.98),(2.94,.24,.86))
solid('Rear middle spandrel',(-4.93,7.4,3.54),(2.94,.24,1.44))
solid('Rear upper lintel',(-4.93,7.4,6.20),(2.94,.24,.80))
for z,h in [(2.12,1.42),(4.96,1.48)]:
    solid('Rear clear window',(-4.93,7.4,z),(2.87,.018,h),base.glass,.001)
    for x in [-6.39,-4.93,-3.47]:solid('Rear frame',(x,7.38,z),(.035,.08,h+.06),base.black,.002)
    for zz in [z-h/2,z+h/2]:solid('Rear window track',(-4.93,7.38,zz),(2.95,.08,.035),base.black,.002)

base.ACTIVE=base.collections['02 Interiores']
# Circular dining table and four oak / linen chairs.
cylinder('Dining pedestal',(-4.90,5.62,.59),(-4.90,5.62,1.33),.18,base.wood,24)['collidable']=True
cylinder('Dining stone top',(-4.90,5.62,1.31),(-4.90,5.62,1.37),.63,base.stone,48)['collidable']=True
for i in range(4):
    a=i*math.tau/4
    x=-4.90+math.cos(a)*.94;y=5.62+math.sin(a)*.94
    o=solid('Dining linen seat',(x,y,1.04),(.46,.46,.12),base.fabric,.045)
    # Back faces the table; its location sits on the outside of the seat.
    ox,oy=math.cos(a)*.22,math.sin(a)*.22
    o=solid('Dining oak back',(x+ox,y+oy,1.36),(.46,.07,.63),base.wood,.025)
    o.rotation_euler.z=a-math.pi/2
    for dx in [-.17,.17]:
        for dy in [-.17,.17]:cylinder('Dining chair leg',(x+dx,y+dy,.59),(x+dx,y+dy,1.0),.021,base.wood,8)
sphere('Dining ceramic vase',(-4.9,5.62,1.49),(.10,.10,.15),base.stone,20,12)
base.leaf_cloud('Dining foliage',[((-4.88,5.62,1.74),.10)],22,.05)
# Galley kitchen, continuous oak cabinetry and stone surfaces.
solid('Kitchen base west',(-3.04,5.40,1.05),(.58,2.00,.92),base.wood_h,.012)
solid('Kitchen base rear',(-2.24,6.96,1.05),(2.12,.58,.92),base.wood_h,.012)
box('Kitchen worktop west',(-3.04,5.40,1.53),(.63,2.05,.06),base.stone,.010)
box('Kitchen worktop rear',(-2.24,6.96,1.53),(2.18,.63,.06),base.stone,.010)
for y in [4.77,5.41,6.02]:box('Kitchen oak drawer',(-2.738,y,1.09),(.024,.58,.76),base.wood,.004)
for x in [-2.94,-2.25,-1.56]:box('Kitchen rear oak drawer',(x,6.646,1.09),(.63,.024,.76),base.wood,.004)
box('Kitchen backsplash',(-2.25,7.23,1.98),(2.1,.025,.89),base.stone,.002)
box('Kitchen upper cabinet',(-2.25,7.08,2.59),(2.14,.34,.52),base.wood_h,.008)
box('Kitchen undercabinet LED',(-2.25,6.902,2.316),(2.06,.015,.015),base.emissive,.002)
box('Kitchen sink bowl',(-2.2,6.92,1.57),(.60,.42,.025),base.chrome,.025)
box('Kitchen sink inset',(-2.2,6.92,1.588),(.52,.34,.008),base.dark,.04)
cylinder('Kitchen tap',(-2.2,7.15,1.58),(-2.2,7.15,1.89),.017,base.chrome,12)
cylinder('Kitchen tap neck',(-2.2,7.15,1.89),(-2.2,6.98,1.89),.017,base.chrome,12)
box('Kitchen induction hob',(-3.04,5.10,1.57),(.50,.65,.018),base.black,.012)
for x in [-3.16,-2.92]:
    for y in [4.95,5.24]:cylinder('Induction ring',(x,y,1.58),(x,y,1.583),.083,base.chrome,24)
solid('Kitchen fridge',(-3.63,6.96,1.54),(.72,.68,1.90),base.chrome,.025)
box('Fridge horizontal reveal',(-3.63,6.605,1.32),(.66,.02,.022),base.black,.004)
box('Fridge vertical pull',(-3.32,6.575,1.8),(.024,.05,.5),base.black,.005)
base.light('LGT | kitchen',(-2.4,5.8,3.40),115,size=1.5,target=(-2.4,5.8,.9))
base.light('LGT | dining',(-4.9,5.6,3.4),70,size=.9,target=(-4.9,5.6,1.0))
# Desk and book shelves form an open study at the rear of the suite.
solid('Office desktop',(-4.87,6.93,4.48),(2.20,.67,.07),base.wood_h,.015)
for x in [-5.80,-3.93]:solid('Office desk support',(x,6.94,4.10),(.075,.52,.76),base.black,.006)
box('Office monitor',(-4.88,7.10,4.85),(.70,.05,.43),base.black,.008)
cylinder('Office monitor stem',(-4.88,7.1,4.52),(-4.88,7.1,4.66),.025,base.black,12)
solid('Office chair seat',(-4.87,6.22,4.16),(.52,.50,.10),base.fabric,.045)
solid('Office chair back',(-4.87,5.99,4.48),(.52,.08,.58),base.fabric,.05)
cylinder('Office chair pedestal',(-4.87,6.22,3.74),(-4.87,6.22,4.12),.045,base.chrome,12)
for i in range(5):
    a=i*math.tau/5
    cylinder('Office chair base',(-4.87,6.22,3.78),(-4.87+math.cos(a)*.30,6.22+math.sin(a)*.30,3.78),.02,base.black,8)
box('Office book',(-5.53,6.81,4.55),(.25,.33,.05),base.cloth,.005)
base.light('LGT | office',(-5.0,6.30,6.34),85,size=1.2,target=(-5,6.3,4.3))
# Upper sitting corner beside the staircase, with a clear circulation strip.
solid('Reading seat',(-2.45,2.82,4.12),(.73,.78,.48),base.fabric,.08)
solid('Reading seat back',(-2.45,3.15,4.45),(.73,.12,.75),base.fabric,.06)
cylinder('Reading table',(-2.20,3.72,3.73),(-2.20,3.72,4.25),.22,base.wood,24)
base.light('LGT | upper hall',(-2.25,2.90,6.35),70,size=1.2,target=(-2.25,2.9,4))

def bathroom(prefix,x,y,z,shower=False):
    solid(prefix+' vanity',(x,y,z+.42),(.75,.48,.68),base.wood_h,.018)
    box(prefix+' vanity top',(x,y,z+.80),(.80,.51,.07),base.stone,.016)
    sphere(prefix+' basin',(x,y-.06,z+.87),(.27,.17,.07),base.stone,32,12)
    cylinder(prefix+' tap',(x,y+.16,z+.86),(x,y+.16,z+1.12),.016,base.chrome,12)
    cylinder(prefix+' spout',(x,y+.16,z+1.12),(x,y+.03,z+1.12),.016,base.chrome,12)
    box(prefix+' mirror',(x,y+.256,z+1.46),(.73,.018,.84),base.chrome,.03)
    sphere(prefix+' toilet',(x+.14,y+.90,z+.29),(.24,.34,.30),base.stone,24,12)['collidable']=True
    box(prefix+' toilet tank',(x+.14,y+1.17,z+.54),(.43,.15,.52),base.stone,.05)
    if shower:
        box(prefix+' shower tray',(x-.30,y-1.25,z+.026),(1.39,.85,.05),base.stone,.01)
        solid(prefix+' shower glass',(x-.30,y-.80,z+1.12),(1.39,.014,2.20),base.glass,.001)
        cylinder(prefix+' shower rail',(x-.78,y-1.63,z+1.0),(x-.78,y-1.63,z+2.10),.018,base.chrome,12)
        cylinder(prefix+' shower head',(x-.78,y-1.63,z+2.10),(x-.78,y-1.46,z+2.10),.05,base.chrome,20)
    base.light('LGT | '+prefix,(x,y+.3,z+2.10),38,size=.5,target=(x,y,z+.5))
bathroom('Lavabo',-.30,5.61,.59)
bathroom('Suite bathroom',-2.23,5.70,3.71,True)
for name in ['GEO-Suite bathroom toilet','GEO-Suite bathroom toilet tank']:
    bpy.data.objects[name].location.x=-2.72

# Explicit collision tagging for the base architecture and large furniture.
for o in scene.objects:
    if o.type!='MESH' or o.get('collidable') is not None:continue
    name=o.name.lower()
    if any(s in name for s in ['flank','portal','fin','frame','glass','door','rear wall','entrance wall','sofa','bed ','headboard','bedside','garage right pier','garage rear wall','garden front retaining','garden left retaining']):
        o['collidable']=True
    if any(s in name for s in ['roof slab','upper floor','floor','foundation','balcony slab','stair oak tread','stair warm','sloped driveway','garden lawn','fine lawn','foliage']):o['collidable']=False

# Optional attributed car asset replaces the rough blockout cars in the final scene.
asset=OUT/'car-concept.glb'
if asset.exists():
    coll=base.collections['04 Veiculos']
    for o in list(coll.objects):bpy.data.objects.remove(o,do_unlink=True)
    before=set(scene.objects)
    bpy.ops.import_scene.gltf(filepath=str(asset))
    imported=[o for o in scene.objects if o not in before]
    carmeshes=[o for o in imported if o.type=='MESH']
    for o in carmeshes:
        mat=o.matrix_world.copy();o.parent=None;o.matrix_world=mat
        for c in list(o.users_collection):c.objects.unlink(o)
        coll.objects.link(o)
        if len(o.data.polygons)>2500:
            mod=o.modifiers.new('Vehicle distance LOD','DECIMATE');mod.ratio=.50
    for o in imported:
        if o.type!='MESH':bpy.data.objects.remove(o,do_unlink=True)
    coords=[o.matrix_world@Vector(p) for o in carmeshes for p in o.bound_box]
    lo=Vector(tuple(min(p[i] for p in coords) for i in range(3)))
    hi=Vector(tuple(max(p[i] for p in coords) for i in range(3)))
    dims=hi-lo
    rot=Matrix.Rotation(math.pi/2,4,'Z') if dims.x>dims.y else Matrix.Identity(4)
    for o in carmeshes:o.matrix_world=rot@o.matrix_world
    coords=[o.matrix_world@Vector(p) for o in carmeshes for p in o.bound_box]
    lo=Vector(tuple(min(p[i] for p in coords) for i in range(3)));hi=Vector(tuple(max(p[i] for p in coords) for i in range(3)))
    center=(lo+hi)*.5
    headlights=next((o for o in carmeshes if 'bodyheadlights' in o.name.lower()),None)
    if headlights:
        hp=sum((headlights.matrix_world@Vector(v) for v in headlights.bound_box),Vector())/8
        if hp.y>center.y:
            rot=Matrix.Rotation(math.pi,4,'Z')
            for o in carmeshes:o.matrix_world=rot@o.matrix_world
            coords=[o.matrix_world@Vector(p) for o in carmeshes for p in o.bound_box]
            lo=Vector(tuple(min(p[i] for p in coords) for i in range(3)));hi=Vector(tuple(max(p[i] for p in coords) for i in range(3)));center=(lo+hi)*.5
    scale=4.35/(hi.y-lo.y)
    transform=Matrix.Translation(Vector((2.2,2.70,.54))-Vector((center.x,center.y,lo.z))*scale)@Matrix.Scale(scale,4)
    darkpaint=base.material('MAT | Touring graphite paint',(.075,.085,.095),.23,coat=.8)
    pearlpaint=base.material('MAT | Touring pearl paint',(.63,.64,.60),.23,coat=.8)
    for o in carmeshes:
        o.matrix_world=transform@o.matrix_world;o.name='GEO-Car graphite '+o.name;o['collidable']=True
        bpy.context.view_layer.update()
        twin=o.copy();coll.objects.link(twin);twin.location.x+=3.12;twin.name=o.name.replace('graphite','pearl')
        for car,paint in [(o,darkpaint),(twin,pearlpaint)]:
            for slot in car.material_slots:
                if slot.material and 'Paint' in slot.material.name:
                    slot.link='OBJECT';slot.material=paint
                elif slot.material and slot.material.name=='License':slot.link='OBJECT';slot.material=base.stone
    for im in bpy.data.images:
        if im.source=='FILE' and max(im.size)>512:im.scale(min(512,im.size[0]),min(512,im.size[1]))
    print('CARS_ASSET_READY',len(carmeshes),tuple(round(x,3) for x in hi-lo),flush=True)

# Navigation is expressed in Blender coordinates; the viewer converts Y-up once.
navigation={
 'eye':1.65,'radius':.19,'ground':.59,'upper':3.71,
 'stair':{'xmin':-1.20,'xmax':-.04,'ymin':1.65,'ymax':6.35,'rise':3.12,'steps':18},
 'upperFootprint':[-6.48,.58,.55,7.26],
 'balcony':[-6.36,-1.96,-.46,.55],
 'rooms':[
  {'id':'fachada','name':'Fachada','floor':0,'position':[2,-5.5,.16],'target':[-1,2,3.0],'bounds':[-9,8,-5.2,.55]},
  {'id':'sala','name':'Sala de estar','floor':0,'position':[-3.95,1.10,.59],'target':[-4.7,4.4,1.4],'bounds':[-6.48,-3.4,.6,4.5]},
  {'id':'jantar','name':'Jantar','floor':0,'position':[-3.70,6.15,.59],'target':[-4.9,5.65,1.2],'bounds':[-6.48,-3.4,4.5,7.27]},
  {'id':'cozinha','name':'Cozinha','floor':0,'position':[-2.0,5.55,.59],'target':[-3.0,6.5,1.4],'bounds':[-3.4,-1.48,4.4,7.27]},
  {'id':'lavabo','name':'Lavabo','floor':0,'position':[-.75,6.10,.59],'target':[-.30,5.6,1.4],'bounds':[-1.3,.56,5.24,7.27]},
  {'id':'escada','name':'Escada','floor':0,'position':[-.50,1.30,.59],'target':[-.50,5.6,3.5],'bounds':[-1.3,.23,1.6,6.4]},
  {'id':'hall','name':'Hall superior','floor':1,'position':[-2.05,1.45,3.71],'target':[-2.1,3.1,4.3],'bounds':[-3.14,-1.38,.55,4.36]},
  {'id':'suite','name':'Suíte','floor':1,'position':[-3.64,1.58,3.71],'target':[-4.9,4.2,4.5],'bounds':[-6.48,-3.33,.55,5.60]},
  {'id':'escritorio','name':'Escritório','floor':1,'position':[-5.93,6.15,3.71],'target':[-4.87,6.98,4.6],'bounds':[-6.48,-3.33,5.60,7.27]},
  {'id':'banheiro','name':'Banheiro','floor':1,'position':[-1.95,6.80,3.71],'target':[-2.3,5.6,4.6],'bounds':[-3.14,-1.56,4.50,7.27]},
  {'id':'varanda','name':'Varanda','floor':1,'position':[-4.15,-.10,3.71],'target':[-5.0,1.5,4.5],'bounds':[-6.36,-1.96,-.46,.55]}
 ]
}
(OUT/'navigation.json').write_text(json.dumps(navigation,ensure_ascii=False,indent=2),encoding='utf-8')
bpy.ops.file.pack_all()
for mat in bpy.data.materials:
    if not mat.name.startswith('MAT |') and hasattr(mat.cycles,'emission_sampling'):mat.cycles.emission_sampling='NONE'
scene['Visita']='Dois pavimentos conectados pela escada, cinco portas interativas e varanda.'
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'casa-vistalar.blend'),compress=True)
print('INTERIOR_READY',len(scene.objects),flush=True)

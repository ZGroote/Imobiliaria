import bpy
import json
from pathlib import Path
from mathutils import Vector

root = Path(__file__).resolve().parent
source = root.parent / 'liv-render-blender-2026-10-26/entrega/LIV_Ipanema_Render.blend'
bpy.ops.wm.open_mainfile(filepath=str(source))
report = {'scenes': {}, 'materials': []}
for scene in bpy.data.scenes:
    bpy.context.window.scene = scene
    bpy.context.view_layer.update()
    objects = []
    for o in scene.objects:
        if o.type != 'MESH':
            continue
        pts = [o.matrix_world @ Vector(c) for c in o.bound_box]
        objects.append({'name': o.name, 'slot': o.get('LIV_source_slot'), 'role': o.get('LIV_role'),
                        'min': [round(min(p[i] for p in pts), 3) for i in range(3)],
                        'max': [round(max(p[i] for p in pts), 3) for i in range(3)],
                        'materials': [m.name if m else None for m in o.data.materials],
                        'mesh': o.data.name, 'vertices': len(o.data.vertices)})
    report['scenes'][scene.name] = objects
for m in bpy.data.materials:
    n = next((n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None) if m.use_nodes else None
    report['materials'].append({'name': m.name, 'base': list(n.inputs['Base Color'].default_value) if n else [],
                               'roughness': n.inputs['Roughness'].default_value if n else None,
                               'images': [n.image.name for n in m.node_tree.nodes if n.type == 'TEX_IMAGE' and n.image] if m.use_nodes else []})
(root / 'fontes').mkdir(exist_ok=True)
(root / 'fontes/inventario.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
print('INVENTORY_OK', {s: len(o) for s, o in report['scenes'].items()}, flush=True)

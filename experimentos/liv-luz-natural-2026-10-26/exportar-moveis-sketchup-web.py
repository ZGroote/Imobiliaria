"""Exporta para o Tour os móveis da SketchUp Content Library escolhidos em 27/10.

& 'C:\\Program Files (x86)\\Steam\\steamapps\\common\\Blender\\blender.exe' -b --factory-startup --python exportar-moveis-sketchup-web.py

Fonte: os GLBs públicos que o próprio 3D Warehouse indica, baixados por liv-sketchup-2026-10-26/baixar_asset.py
(dados/warehouse/<nome>.glb, crédito em fontes/credito-<nome>.json). Todos têm a frente em -Y (vira +Z no Three).
Saída: interiores/melhorias/<id>.glb e fontes/moveis-sketchup.json, com os registros para o catalogo.json.
"""
from pathlib import Path
import hashlib
import json

import bmesh
import bpy
import numpy as np

ROOT = Path(__file__).resolve().parent
WAREHOUSE = ROOT.parent / 'liv-sketchup-2026-10-26'
DEST = ROOT.parent / 'liv-experimental-2026-10-14/interiores/melhorias'
WEAVE = ROOT.parent / 'moveis-referencia/materiais/blackout_nor.png'
SPECS = [
    # A colcha do modelo é uma casca rígida: vira pano simulado caindo sobre colchão e estrutura.
    {'id': 'cama-casal-estofada', 'source': 'upholsteredbed', 'types': ['cama'], 'namePattern': 'su.te',
     'drape': {'blanket': '3DGeom-8', 'mattress': '3DGeom-1', 'colliders': ['3DGeom-1', '3DGeom-2', '3DGeom-4']}},
    {'id': 'cama-solteiro-escura', 'source': 'bed', 'types': ['cama'], 'namePattern': 'dormit',
     'drape': {'blanket': '3DGeom-3', 'mattress': '3DGeom-4', 'colliders': ['3DGeom-4', '3DGeom-2']}},
    # A suíte das duas plantas tem um par de criados: cada planta fica com um dos dois modelos escolhidos.
    {'id': 'criado-madeira-metal', 'source': 'nightstand', 'types': ['criado'], 'typology': 'meio'},
    {'id': 'criado-gaveta-branca', 'source': 'bedsidetable', 'types': ['criado'], 'typology': 'canto'},
    # Só o móvel: a TV, o pé dela e as caixas de som do modelo ficam fora (acima de 50 cm ou fora do vão de 1,5 m).
    {'id': 'rack-gavetas', 'source': 'tvcabinet', 'types': ['rack'], 'keep': lambda lo, hi: hi[2] <= .505 and max(abs(lo[0]), abs(hi[0])) <= .76},
    # O lado para onde o guarda-roupa abre vem da parede no site (o giro do cadastro diverge entre as plantas).
    {'id': 'guarda-roupa-gavetas', 'source': 'wardrobe', 'types': ['guardaroupa'], 'namePattern': 'su.te'},
    # 80 cm de largura contra 1,40-1,65 m do dormitório: dois lado a lado em vez de esticar as portas.
    {'id': 'guarda-roupa-simples', 'source': 'simplewardrobe', 'types': ['guardaroupa'], 'namePattern': 'dormit', 'copies': 2},
]


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def bounds(objects):
    points = [obj.matrix_world @ v.co for obj in objects for v in obj.data.vertices]
    return [min(p[i] for p in points) for i in range(3)], [max(p[i] for p in points) for i in range(3)]


def drape(spec, objects):
    """Troca a colcha por um pano que cai sobre o colchão: grade de 3,5 cm com ondas em direções aleatórias (regular
    congela como caixa de ovo), 70 quadros de gravidade, 1 cm de espessura e a trama de tecido como relevo."""
    names = {o.name: o for o in objects}; blanket = names[spec['blanket']]; mattress = names[spec['mattress']]
    (bx0, by0, _), (bx1, by1, _) = bounds([blanket]); (mx0, my0, _), (mx1, my1, mz1) = bounds([mattress])
    over = .12  # desce pelas laterais e pelo pé sem passar da estrutura (o site ajusta a cama pela caixa total)
    x0, x1, y0, y1 = mx0 - over, mx1 + over, min(by0, my0) - over, by1
    cell = .035; nx, ny = int((x1 - x0) / cell), int((y1 - y0) / cell)
    mesh = bpy.data.meshes.new('colcha'); bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=nx, y_segments=ny, size=1)
    gx = [v.co.x for v in bm.verts]; gy = [v.co.y for v in bm.verts]
    rng = np.random.default_rng(7); waves = [(rng.uniform(0, 2 * np.pi), rng.uniform(3, 9), rng.uniform(0, 2 * np.pi)) for _ in range(10)]
    uv = bm.loops.layers.uv.new('UVMap')
    for v in bm.verts:
        u, w = (v.co.x - min(gx)) / (max(gx) - min(gx)), (v.co.y - min(gy)) / (max(gy) - min(gy)); x, y = x0 + u * (x1 - x0), y0 + w * (y1 - y0)
        z = mz1 + .06 + sum(.022 * np.sin(k * (x * np.cos(a) + y * np.sin(a)) + f) for a, k, f in waves)
        v.co = (x, y, z)
    for face in bm.faces:
        for loop in face.loops:
            loop[uv].uv = (loop.vert.co.x * 3, loop.vert.co.y * 3)  # trama: 3 repetições por metro
    bm.to_mesh(mesh); bm.free()
    cloth = bpy.data.objects.new('colcha', mesh); bpy.context.scene.collection.objects.link(cloth)
    for poly in mesh.polygons:
        poly.use_smooth = True
    mesh.materials.append(blanket.material_slots[0].material)
    for name in spec['colliders']:
        names[name].modifiers.new('colisao', 'COLLISION'); names[name].collision.thickness_outer = .006
        names[name].collision.cloth_friction = 20
    mod = cloth.modifiers.new('pano', 'CLOTH'); c = mod.settings
    c.quality = 8; c.mass = .4; c.tension_stiffness = c.compression_stiffness = 12; c.shear_stiffness = 6
    # 6% maior que a grade em repouso e dobra mole: ondula em cima como colcha arrumada à mão, sem ficar lisa.
    c.bending_stiffness = .08; c.shrink_min = -.06; c.air_damping = 2; mod.collision_settings.distance_min = .006
    mod.point_cache.frame_start, mod.point_cache.frame_end = 1, 70
    scene = bpy.context.scene; scene.frame_start, scene.frame_end = 1, 70
    for frame in range(1, 71):
        scene.frame_set(frame)
    rest = bpy.data.meshes.new_from_object(cloth.evaluated_get(bpy.context.evaluated_depsgraph_get()))
    cloth.modifiers.clear(); cloth.data = rest
    for name in spec['colliders']:
        names[name].modifiers.clear()
    solid = cloth.modifiers.new('espessura', 'SOLIDIFY'); solid.thickness = .012; solid.offset = 1
    # Trama do tecido como relevo (a cor lisa da colcha continua a do modelo).
    material = cloth.material_slots[0].material.copy(); cloth.material_slots[0].material = material
    tree = material.node_tree; bsdf = next(n for n in tree.nodes if n.type == 'BSDF_PRINCIPLED')
    weave = tree.nodes.new('ShaderNodeTexImage'); weave.image = bpy.data.images.load(str(WEAVE)); weave.image.colorspace_settings.name = 'Non-Color'
    normal = tree.nodes.new('ShaderNodeNormalMap'); normal.inputs['Strength'].default_value = 1
    tree.links.new(weave.outputs['Color'], normal.inputs['Color']); tree.links.new(normal.outputs['Normal'], bsdf.inputs['Normal'])
    bsdf.inputs['Roughness'].default_value = .9
    kept = [o for o in objects if o is not blanket] + [cloth]; bpy.data.objects.remove(blanket)
    return kept


def export(spec):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(WAREHOUSE / 'dados/warehouse' / (spec['source'] + '.glb')))
    # Imagem gerada (as cópias em JPEG abaixo) é gravada pelo caminho de render: Standard não passa o AgX nela.
    bpy.context.scene.view_settings.view_transform = 'Standard'; bpy.context.scene.view_settings.look = 'None'
    objects = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    if 'drape' in spec:
        objects = drape(spec['drape'], objects)
    if 'keep' in spec:
        for obj in [o for o in objects if not spec['keep'](*bounds([o]))]:
            bpy.data.objects.remove(obj)
        objects = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    if spec.get('copies', 1) > 1:
        width = bounds(objects)[1][0] - bounds(objects)[0][0]
        for k in range(1, spec['copies']):
            for obj in list(objects):
                copy = obj.copy(); copy.data = obj.data; bpy.context.scene.collection.objects.link(copy)
                copy.matrix_world = obj.matrix_world.copy(); copy.matrix_world.translation.x += k * width
                objects.append(copy)
    # A imagem embutida do glTF sai no formato de origem (PNG de 1-2 MB): uma cópia gerada sai em JPEG.
    copies = {}
    for material in {s.material for o in objects for s in o.material_slots if s.material}:
        # O SketchUp grava a cor lisa em sRGB (RGB 6,106,143 vira 0,024/0,416/0,561) no campo que o glTF lê
        # como linear: a colcha verde-azulada saía azul-clara. A cor de textura já vem certa.
        bsdf = next((n for n in material.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None)
        if bsdf:
            # O especular/brilho do SketchUp (0,5/0,5) chega como IOR 1000: quase espelho, e a peça toda desbotava.
            bsdf.inputs['IOR'].default_value = 1.5; bsdf.inputs['Specular IOR Level'].default_value = .5
            bsdf.inputs['Specular Tint'].default_value = (1, 1, 1, 1); bsdf.inputs['Roughness'].default_value = .6
        if bsdf and not bsdf.inputs['Base Color'].is_linked:
            color = bsdf.inputs['Base Color'].default_value
            for i in range(3):
                c = color[i]; color[i] = c / 12.92 if c <= .04045 else ((c + .055) / 1.055) ** 2.4
        for node in material.node_tree.nodes:
            if node.type == 'TEX_IMAGE' and node.image:
                image = node.image
                if image.name not in copies:
                    pixels = [0.0] * (image.size[0] * image.size[1] * 4); image.pixels.foreach_get(pixels)
                    copy = bpy.data.images.new(image.name + '_web', image.size[0], image.size[1], alpha=False)
                    copy.colorspace_settings.name = image.colorspace_settings.name; copy.pixels.foreach_set(pixels)
                    copy.file_format = 'JPEG'; copies[image.name] = copy
                node.image = copies[image.name]
                # O import liga o alfa da textura mesmo no móvel opaco, e o exportador guarda PNG para não perder o alfa.
                for link in list(node.outputs['Alpha'].links):
                    material.node_tree.links.remove(link)
    for obj in bpy.context.scene.objects:
        obj.select_set(obj in objects)
    bpy.context.view_layer.objects.active = objects[0]
    out = DEST / f'{spec["id"]}.glb'
    kwargs = {'filepath': str(out), 'export_format': 'GLB', 'use_selection': True, 'export_apply': True,
              'export_materials': 'EXPORT', 'export_image_format': 'JPEG', 'export_jpeg_quality': 88, 'export_yup': True,
              'export_animations': False, 'export_cameras': False, 'export_lights': False, 'export_tangents': True}
    parameters = bpy.ops.export_scene.gltf.get_rna_type().properties
    bpy.ops.export_scene.gltf(**{k: v for k, v in kwargs.items() if k in parameters})
    lo, hi = bounds(objects)
    credit = json.loads((WAREHOUSE / 'fontes' / f'credito-{spec["source"]}.json').read_text(encoding='utf8'))
    record = {'id': spec['id'], 'path': out.name, 'types': spec['types'], 'pivot': 'center-xz-base-y', 'front': '+Z',
              # Three = (Blender.x, Blender.z, -Blender.y)
              'dimensions': {'w': hi[0] - lo[0], 'h': hi[2] - lo[2], 'd': hi[1] - lo[1]},
              'source': {'library': 'SketchUp Content Library', 'title': credit['titulo'], 'page': credit['pagina'],
                         'glbSHA256': sha(WAREHOUSE / 'dados/warehouse' / (spec['source'] + '.glb')), 'copies': spec.get('copies', 1)},
              'materialConversion': {'bakeLighting': False, 'method': 'glTF do Warehouse reexportado (JPEG)'},
              'bytes': out.stat().st_size, 'sha256': sha(out),
              'triangles': sum(len(p.vertices) - 2 for o in objects for p in o.data.polygons), 'meshes': len(objects)}
    for key in ('namePattern', 'typology'):
        if spec.get(key):
            record[key] = spec[key]
    print('LIV_MOVEL_SKETCHUP', json.dumps(record), flush=True)
    return record


records = [export(spec) for spec in SPECS]
(ROOT / 'fontes/moveis-sketchup.json').write_text(json.dumps(records, indent=2, ensure_ascii=False) + '\n', encoding='utf8')

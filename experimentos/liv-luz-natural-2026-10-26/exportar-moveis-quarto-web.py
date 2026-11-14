"""Exporta para o Tour a cama de madeira (casal e solteiro), o rack do painel de TV e um criado-mudo novo.

& 'C:\\Program Files (x86)\\Steam\\steamapps\\common\\Blender\\blender.exe' -b --factory-startup --python exportar-moveis-quarto-web.py

As camas e o rack vêm das cenas feitas contra foto em experimentos/moveis-referencia (06/10). O criado-mudo
é modelado aqui com a mesma madeira. Os materiais de lá multiplicam a textura por uma cor (nó Mix), o que o
glTF não leva: a cor é multiplicada dentro de uma cópia da imagem. Saída: interiores/melhorias/<id>.glb e
fontes/moveis-quarto.json, com os registros para o catalogo.json (não escreve o catálogo).
"""
from pathlib import Path
import hashlib
import json
import math

import bpy
import bmesh
import numpy as np
from mathutils import Vector

ROOT = Path(__file__).resolve().parent
REF = ROOT.parent / 'moveis-referencia'
DEST = ROOT.parent / 'liv-experimental-2026-10-14/interiores/melhorias'
SCENE_PROPS = {'parede', 'piso', 'tapete'}
MAX_TRIANGLES = 2500
SPECS = [
    {'id': 'cama-casal', 'blend': REF / 'cama-madeira/render_r6.blend', 'types': ['cama'], 'namePattern': 'su.te'},
    {'id': 'cama-solteiro', 'blend': REF / 'cama-madeira/render_solteiro.blend', 'types': ['cama'], 'namePattern': 'dormit'},
    # Só o móvel baixo: o painel, o mármore e o LED ficam na parede da cena de referência.
    {'id': 'rack-sala', 'blend': REF / 'painel-tv/render_r3.blend', 'types': ['rack'],
     'names': ['rack_base', 'rack_lado_dir', 'rack_lado_esq', 'rack_miolo', 'rack_rodape', 'rack_tampo',
               'porta_esq', 'porta_dir', 'nicho_bloco', 'nicho_fundo', 'nicho_piso'],
     'remap': {'marmore': 'madeira_painel'}},
    {'id': 'criado-mudo', 'blend': REF / 'painel-tv/render_r3.blend', 'types': ['criado'], 'build': 'criado'},
]


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def mix_tint(node):
    """Fator e cor B do Mix RGBA (os sockets repetem o nome por tipo de dado)."""
    factor = next(s for s in node.inputs if s.name == 'Factor' and s.type == 'VALUE')
    color = next(s for s in node.inputs if s.name == 'B' and s.type == 'RGBA')
    return factor.default_value, np.array(color.default_value[:3])


def flatten(material, cache):
    """Principled com textura de cor já tingida e mapa de normal; o resto vira valor fixo."""
    if material.name in cache:
        return cache[material.name]
    tree = material.node_tree; bsdf = next(n for n in tree.nodes if n.type == 'BSDF_PRINCIPLED')
    color_link = bsdf.inputs['Base Color'].links
    image = tint = normal = strength = None
    if color_link:
        mix = color_link[0].from_node
        source = next(s for s in mix.inputs if s.name == 'A' and s.type == 'RGBA').links[0].from_node if mix.type == 'MIX' else mix
        image = source.image
        if mix.type == 'MIX':
            factor, color = mix_tint(mix); tint = (1 - factor) + factor * color
    normal_link = bsdf.inputs['Normal'].links
    if normal_link:
        node = normal_link[0].from_node; strength = node.inputs['Strength'].default_value
        normal = node.inputs['Color'].links[0].from_node.image
    out = bpy.data.materials.new(material.name + ' | WEB'); out.use_nodes = True
    nodes, links = out.node_tree.nodes, out.node_tree.links
    principled = next(n for n in nodes if n.type == 'BSDF_PRINCIPLED')
    principled.inputs['Roughness'].default_value = bsdf.inputs['Roughness'].default_value
    principled.inputs['Metallic'].default_value = bsdf.inputs['Metallic'].default_value
    if image is not None:
        pixels = np.empty(image.size[0] * image.size[1] * 4, np.float32); image.pixels.foreach_get(pixels)
        pixels = pixels.reshape(-1, 4)
        if tint is not None:
            pixels[:, :3] *= tint  # pixels lineares (Blender converte o sRGB ao ler)
        baked = bpy.data.images.new(f'{material.name}_cor', image.size[0], image.size[1], alpha=False)
        baked.colorspace_settings.name = 'sRGB'; baked.pixels.foreach_set(pixels.ravel())
        baked.file_format = 'JPEG'
        texture = nodes.new('ShaderNodeTexImage'); texture.image = baked
        links.new(texture.outputs['Color'], principled.inputs['Base Color'])
    else:
        principled.inputs['Base Color'].default_value = bsdf.inputs['Base Color'].default_value
    if normal is not None:
        texture = nodes.new('ShaderNodeTexImage'); texture.image = normal; normal.colorspace_settings.name = 'Non-Color'
        node = nodes.new('ShaderNodeNormalMap'); node.inputs['Strength'].default_value = strength
        links.new(texture.outputs['Color'], node.inputs['Color']); links.new(node.outputs['Normal'], principled.inputs['Normal'])
    cache[material.name] = out
    return out


def box_uv(obj, size=1.0):
    """UV por eixo dominante, em metros: a madeira repete como nas peças de referência."""
    mesh = obj.data; bm = bmesh.new(); bm.from_mesh(mesh)
    layer = bm.loops.layers.uv.verify()
    for face in bm.faces:
        n = face.normal; axis = max(range(3), key=lambda i: abs(n[i]))
        for loop in face.loops:
            co = obj.matrix_world @ loop.vert.co
            u, v = [(co.y, co.z), (co.x, co.z), (co.x, co.y)][axis]
            loop[layer].uv = (u / size, v / size)
    bm.to_mesh(mesh); bm.free()


def cube(name, lo, hi, material):
    mesh = bpy.data.meshes.new(name); bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0); bm.to_mesh(mesh); bm.free()
    obj = bpy.data.objects.new(name, mesh); bpy.context.scene.collection.objects.link(obj)
    obj.scale = [hi[i] - lo[i] for i in range(3)]; obj.location = [(hi[i] + lo[i]) / 2 for i in range(3)]
    bpy.context.view_layer.update(); obj.data.transform(obj.matrix_world); obj.matrix_world.identity()
    mesh.materials.append(material); box_uv(obj)
    return obj


def build_criado():
    """Criado de 45 x 40 x 55 cm: caixa em madeira, gaveta com fresta de 4 mm, puxador e pés cônicos.
    Blender: frente em -Y (vira +Z no Three)."""
    wood = bpy.data.materials['madeira_painel']; dark = bpy.data.materials['fundo_nicho']
    metal = bpy.data.materials.new('criado_puxador'); metal.use_nodes = True
    p = next(n for n in metal.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    p.inputs['Base Color'].default_value = (.08, .07, .06, 1); p.inputs['Metallic'].default_value = 1; p.inputs['Roughness'].default_value = .35
    w, d, h, leg, t = .45, .40, .55, .14, .018
    parts = [
        cube('criado_tampo', (-w / 2, -d / 2, h - t), (w / 2, d / 2, h), wood),
        cube('criado_base', (-w / 2 + t, -d / 2 + .01, leg), (w / 2 - t, d / 2, leg + t), wood),
        cube('criado_lado_esq', (-w / 2, -d / 2, leg), (-w / 2 + t, d / 2, h - t), wood),
        cube('criado_lado_dir', (w / 2 - t, -d / 2, leg), (w / 2, d / 2, h - t), wood),
        cube('criado_fundo', (-w / 2 + t, d / 2 - .008, leg + t), (w / 2 - t, d / 2, h - t), wood),
        cube('criado_miolo', (-w / 2 + t, -d / 2 + .02, leg + t), (w / 2 - t, d / 2 - .008, h - t), dark),
    ]
    # Duas frentes de gaveta separadas por fresta: a de baixo maior, como os criados de catálogo.
    gap, front, split = .004, .02, leg + t + (h - t - leg - t) * .45
    parts += [
        cube('criado_gaveta_baixo', (-w / 2 + t + gap, -d / 2, leg + t + gap), (w / 2 - t - gap, -d / 2 + front, split - gap / 2), wood),
        cube('criado_gaveta_cima', (-w / 2 + t + gap, -d / 2, split + gap / 2), (w / 2 - t - gap, -d / 2 + front, h - t - gap), wood),
    ]
    for z in ((leg + t + split) / 2, (split + h - t) / 2):
        parts.append(cube('criado_puxador', (-.06, -d / 2 - .012, z - .006), (.06, -d / 2, z + .006), metal))
    for sx in (-1, 1):
        for sy in (-1, 1):
            mesh = bpy.data.meshes.new('criado_pe'); bm = bmesh.new()
            bmesh.ops.create_cone(bm, cap_ends=True, segments=12, radius1=.012, radius2=.018, depth=leg)
            bm.to_mesh(mesh); bm.free()
            obj = bpy.data.objects.new('criado_pe', mesh); bpy.context.scene.collection.objects.link(obj)
            obj.location = (sx * (w / 2 - .04), sy * (d / 2 - .04), leg / 2)
            bpy.context.view_layer.update(); mesh.transform(obj.matrix_world); obj.matrix_world.identity()
            mesh.materials.append(wood); box_uv(obj); parts.append(obj)
    return parts


def export(spec):
    bpy.ops.wm.open_mainfile(filepath=str(spec['blend']))
    # A imagem gerada é gravada pelo caminho de render: com AgX/Filmic as cores saíam lavadas.
    bpy.context.scene.view_settings.view_transform = 'Standard'; bpy.context.scene.view_settings.look = 'None'
    bpy.context.scene.view_settings.exposure = 0
    if spec.get('build') == 'criado':
        objects = build_criado()
    elif 'names' in spec:
        objects = [bpy.data.objects[name] for name in spec['names']]
    else:
        objects = [o for o in bpy.data.objects if o.type == 'MESH' and not o.hide_render and o.name not in SCENE_PROPS]
    # O pano simulado (edredom, lençol, travesseiro) chega a 6 MB de malha com a subdivisão aplicada;
    # no Tour ele é visto de 1-3 m e a sonda de luz é de 2 cm: 2.500 triângulos por peça bastam.
    depsgraph = bpy.context.evaluated_depsgraph_get()
    for obj in objects:
        faces = sum(len(p.vertices) - 2 for p in obj.evaluated_get(depsgraph).data.polygons)
        if faces > MAX_TRIANGLES:
            obj.modifiers.new('web', 'DECIMATE').ratio = MAX_TRIANGLES / faces
    cache = {}
    for obj in objects:
        for slot in obj.material_slots:
            name = spec.get('remap', {}).get(slot.material.name, slot.material.name)
            slot.material = flatten(bpy.data.materials[name], cache)
    for obj in bpy.data.objects:
        obj.select_set(obj in objects)
    bpy.context.view_layer.objects.active = objects[0]
    out = DEST / f'{spec["id"]}.glb'
    kwargs = {'filepath': str(out), 'export_format': 'GLB', 'use_selection': True, 'export_apply': True,
              'export_materials': 'EXPORT', 'export_image_format': 'JPEG', 'export_jpeg_quality': 88, 'export_yup': True,
              'export_animations': False, 'export_cameras': False, 'export_lights': False, 'export_tangents': True}
    parameters = bpy.ops.export_scene.gltf.get_rna_type().properties
    bpy.ops.export_scene.gltf(**{k: v for k, v in kwargs.items() if k in parameters})
    points = [obj.matrix_world @ v.co for obj in objects for v in obj.data.vertices]
    lo = [min(p[i] for p in points) for i in range(3)]; hi = [max(p[i] for p in points) for i in range(3)]
    depsgraph = bpy.context.evaluated_depsgraph_get()
    triangles = sum(len(p.vertices) - 2 for obj in objects for p in obj.evaluated_get(depsgraph).data.polygons)
    record = {'id': spec['id'], 'path': out.name, 'types': spec['types'], 'pivot': 'center-xz-base-y', 'front': '+Z',
              # Three = (Blender.x, Blender.z, -Blender.y)
              'dimensions': {'w': hi[0] - lo[0], 'h': hi[2] - lo[2], 'd': hi[1] - lo[1]},
              'source': {'blend': str(spec['blend'].relative_to(ROOT.parents[1])).replace('\\', '/'), 'objects': [o.name for o in objects]},
              'materialConversion': {'bakeLighting': False, 'method': 'Mix multiply folded into the color image'},
              'bytes': out.stat().st_size, 'sha256': sha(out), 'triangles': triangles, 'meshes': len(objects)}
    if spec.get('namePattern'):
        record['namePattern'] = spec['namePattern']
    print('LIV_MOVEL_QUARTO', json.dumps(record), flush=True)
    return record


records = [export(spec) for spec in SPECS]
(ROOT / 'fontes/moveis-quarto.json').write_text(json.dumps(records, indent=2, ensure_ascii=False) + '\n', encoding='utf8')

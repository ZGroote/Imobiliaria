"""Corrige entrada, vidro e fundo externo em uma cópia da fonte.

blender -b fonte.blend --python corrigir_fonte_captura.py -- --saida copia.blend --unidade unidade.json
Não altera a fonte original. O vidro fino mantém reflexão Fresnel, sem refração volumétrica.
"""
import bpy
import hashlib
import json
from pathlib import Path
import sys
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
from planta import carregar

args = sys.argv[sys.argv.index('--') + 1:]
def arg(name): return args[args.index(name) + 1]

source = Path(bpy.data.filepath).resolve()
output = Path(arg('--saida')).resolve()
assert source != output, 'Preserve a fonte original'
assert not output.exists(), 'Use uma saída nova para preservar o resultado anterior'
plan = carregar(arg('--unidade'))
scene = bpy.context.scene
assert not bpy.data.collections.get('COL-correcao-captura'), 'Correção já aplicada'
collection = bpy.data.collections.new('COL-correcao-captura')
scene.collection.children.link(collection)

def box(name, center, size, material):
    bpy.ops.mesh.primitive_cube_add(size=1, location=center)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    for col in list(obj.users_collection): col.objects.unlink(obj)
    collection.objects.link(obj)
    obj.data.materials.append(material)
    bevel = obj.modifiers.new('Arestas', 'BEVEL')
    bevel.width, bevel.segments = .003, 2
    return obj

# A única porta com um lado interior é a entrada; portas entre cômodos continuam abertas.
entrances = [a for a in plan.aberturas() if a['tipo'] == 'porta' and len(a['lados']) == 1]
assert len(entrances) == 1, 'Conferir entrada na planta antes de corrigir'
entry = entrances[0]
height = entry['y1'] - entry['y0']
along = entry['ao_longo']
width = entry['largura']
size = (width if along[0] else .04, width if along[1] else .04, height)
# m3 usa atlas/UV da malha importada; uma folha nova precisa de material próprio.
door_mat = bpy.data.materials.new('MAT-porta-entrada')
door_mat.use_nodes = True
door_bsdf = next(n for n in door_mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
door_bsdf.inputs['Base Color'].default_value = (.72, .69, .63, 1)
door_bsdf.inputs['Roughness'].default_value = .55
door = box('GEO-porta-entrada-fechada', (*entry['centro'], entry['y0'] + height/2), size, door_mat)
normal = entry['lados'][0][1]
handle_center = Vector((*entry['centro'], 1.03)) + Vector((*normal, 0))*.045 + Vector((*along, 0))*(width/2-.12)
box('GEO-macaneta-entrada', handle_center, (.11 if along[0] else .025, .11 if along[1] else .025, .025), bpy.data.materials['Inox'])

glass = bpy.data.materials['Vidro']
original_glass = glass.copy()
original_glass.name = 'MAT-vidro-volumetrico-original'
original_glass.use_fake_user = True
nodes, links = glass.node_tree.nodes, glass.node_tree.links
nodes.clear()
out = nodes.new('ShaderNodeOutputMaterial')
transparent = nodes.new('ShaderNodeBsdfTransparent')
reflection = nodes.new('ShaderNodeBsdfGlossy')
reflection.inputs['Color'].default_value = (.96, .98, 1, 1)
reflection.inputs['Roughness'].default_value = .04
fresnel = nodes.new('ShaderNodeFresnel')
fresnel.inputs['IOR'].default_value = 1.45
mix = nodes.new('ShaderNodeMixShader')
links.new(fresnel.outputs[0], mix.inputs[0])
links.new(transparent.outputs[0], mix.inputs[1])
links.new(reflection.outputs[0], mix.inputs[2])
light_path = nodes.new('ShaderNodeLightPath')
shadow = nodes.new('ShaderNodeMixShader')
links.new(light_path.outputs['Is Shadow Ray'], shadow.inputs[0])
links.new(mix.outputs[0], shadow.inputs[1])
links.new(transparent.outputs[0], shadow.inputs[2])
links.new(shadow.outputs[0], out.inputs['Surface'])
glass['modelo_captura'] = 'Vidro fino: transmissão reta + reflexão Fresnel; não simula espessura/refracao'
scene.cycles.transparent_max_bounces = max(scene.cycles.transparent_max_bounces, 24)
scene.render.film_transparent = False
# O céu Nishita não fornece terreno abaixo do horizonte. Um mínimo neutro de
# radiância completa esse fundo, sem apresentar uma vista urbana inventada.
world_nodes, world_links = scene.world.node_tree.nodes, scene.world.node_tree.links
background = next(n for n in world_nodes if n.type == 'BACKGROUND')
sky_link = next(l for l in world_links if l.to_socket == background.inputs['Color'])
sky_output = sky_link.from_socket
world_links.remove(sky_link)
minimum = world_nodes.new('ShaderNodeVectorMath')
minimum.name = 'Fundo externo neutro abaixo do horizonte'
minimum.operation = 'MAXIMUM'
minimum.inputs[1].default_value = (2.5, 2.8, 3.0)
world_links.new(sky_output, minimum.inputs[0])
world_links.new(minimum.outputs['Vector'], background.inputs['Color'])
scene['captura_correcao'] = '2026-10-16: entrada fechada a5; vidro fino; fundo externo neutro'
bpy.context.view_layer.update()

# Confirma que a abertura cadastrada encontra a nova folha, pelo lado interno.
origin = Vector((*entry['centro'], 1.2)) + Vector((*normal, 0))*.35
hit, point, _, _, obj, _ = scene.ray_cast(bpy.context.evaluated_depsgraph_get(), origin, -Vector((*normal, 0)))
assert hit and obj == door, ('Porta não cobre abertura', obj.name if hit else None)
assert all(img.packed_file for img in bpy.data.images if img.source == 'FILE'), 'Texturas externas'
output.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=str(output), compress=True)
report = {'source': str(source), 'source_sha256': hashlib.sha256(source.read_bytes()).hexdigest(),
          'corrected_sha256': hashlib.sha256(output.read_bytes()).hexdigest(),
          'entry_id': entry['id'], 'entry_center': entry['centro'], 'entry_size': size,
          'door_ray_pass': True, 'glass': glass['modelo_captura'],
          'external_background': 'Céu original com radiância mínima neutra; não representa vista real do imóvel',
          'created_objects': [o.name for o in collection.objects], 'packed_images': len(bpy.data.images)}
output.with_suffix('.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
print('FONTE-CORRIGIDA', json.dumps(report, ensure_ascii=False))

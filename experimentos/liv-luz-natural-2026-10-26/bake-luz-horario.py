"""Grava no Cycles a luz do Canto por hora, menos o sol direto, que o site desenha em tempo real.

& 'C:\\Program Files (x86)\\Steam\\steamapps\\common\\Blender\\blender.exe' -b entrega/LIV_Luz_Natural.blend --python bake-luz-horario.py -- [--size 1024 --samples 256 --so lazer-08]

Fonte: a cena aprovada `03 | Sala e jantar`, sem salvar o .blend. As superfícies gravadas recebem a
malha exata do site (source.json + UV1 de geometry-compact) para o atlas casar com o navegador.
Cada chave vira fontes/luz-horario/<id>.f32 (RGBA float32, origem embaixo):
  dia   = céu sem disco (direto + rebatido) + rebatido de um Sun com a irradiância medida do disco;
  noite = rebatido dos seis plafons do site, sem céu.
e <id>-sondas.f32: a mesma luz em cubos de 2 cm numa grade por cômodo (sondas.json), para o que não
tem UV1 no site (móveis, portas, moldura). Os cubos não aparecem para nenhum raio, só recebem.
Portais sem potência nas janelas guiam a amostragem do céu (o ruído dos quartos virava mancha no
OIDN) e a porta de entrada é gravada fechada, como no site (portas-web.json).
medidas.json guarda a irradiância do disco por chave e a escala do bake (v1 = valor de um Sun 1 W/m²).
"""
from pathlib import Path
import argparse
import base64
import gzip
import hashlib
import json
import math
import sys
import time

import bpy
import numpy as np
from mathutils import Matrix, Vector

ROOT = Path(__file__).resolve().parent
WEB = ROOT.parent / 'liv-experimental-2026-10-14'
OUT = ROOT / "fontes/luz-horario"
sys.path.insert(0, str(ROOT.parents[1] / 'v1.5/miniaturas/liv-ipanema/interior'))
from bake_luz import BASIS, compute_device, topology  # noqa: E402  (mesmo recorte de triângulos do UV1)

SCENE = '03 | Sala e jantar'


def sha(data):
    return hashlib.sha256(data).hexdigest()


def aim_along(obj, direction):
    """Sun do Blender ilumina ao longo de -Z local; direction aponta para o sol."""
    obj.rotation_euler = (-Vector(direction)).to_track_quat('-Z', 'Y').to_euler()


PROBE_SPACING, PROBE_LEVELS, PROBE_INSET, PROBE_BLOCK = .4, 6, .12, 2


def unit_rooms():
    """Cômodos em coordenadas do site (createLayout: centro da caixa de todos os polígonos)."""
    plan = json.loads((WEB / 'interiores/canto/unidade.json').read_text(encoding='utf8'))
    points = [p for c in plan['planta']['comodos'] for p in c['poly']]
    center = [(min(p[i] for p in points) + max(p[i] for p in points)) / 2 for i in (0, 1)]
    rooms = [{'id': c.get('id'), 'name': c['nome'], 'poly': [[p[0] - center[0], p[1] - center[1]] for p in c['poly']]}
             for c in plan['planta']['comodos']]
    return plan, center, rooms


def inside(poly, x, z):
    hit = False
    for i in range(len(poly)):
        a, b = poly[i], poly[i - 1]
        if (a[1] > z) != (b[1] > z) and x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]:
            hit = not hit
    return hit


def srgb_linear(hex_color):
    value = [int(hex_color[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return [c / 12.92 if c <= .04045 else ((c + .055) / 1.055) ** 2.4 for c in value]


def turn(x, z, hinge, angle):
    """Mesmo giro do Three (rotation.y) em torno da dobradiça, no plano XZ do site."""
    dx, dz = x - hinge[0], z - hinge[1]; c, s = math.cos(angle), math.sin(angle)
    return hinge[0] + dx * c + dz * s, hinge[1] - dx * s + dz * c


def close_entrance(positions, normals, colors, door, color):
    """A folha da entrada (36 vértices com a cor de porta perto da dobradiça) volta ao vão."""
    hits = 0
    for i, p in enumerate(positions):
        if colors is None or math.hypot(p[0] - door['hinge'][0], p[2] - door['hinge'][1]) > .8 or np.abs(colors[i] - color).max() > .004:
            continue
        p[0], p[2] = turn(p[0], p[2], door['hinge'], door['closedRotation'])
        nx, nz = turn(normals[i][0], normals[i][2], (0, 0), door['closedRotation']); normals[i][0], normals[i][2] = nx, nz
        hits += 1
    return hits


def install_web_meshes(scene, source, compact, entrance, door_color):
    targets = []; closed = 0
    for record in compact['objects']:
        so = source['objects'][record['objectIndex']]
        obj = scene.objects.get(so['name'])
        if obj is None or obj.hide_render or obj.type != 'MESH':
            continue  # substituído pelos móveis aprovados ou fora da cena
        materials = [slot.material for slot in obj.material_slots]
        if len(materials) != len(so['materials']):
            raise RuntimeError(f'{so["name"]}: materiais do Blender não casam com a fonte do site')
        geo = source['geometries'][so['geometry']]
        positions, normals, indices, face_materials = topology(geo, len(so['materials']))
        colors = np.asarray(geo['color'], dtype=np.float32).reshape(-1, 3) if geo.get('color') else None
        moved = close_entrance(positions, normals, colors, entrance, door_color) if entrance else 0
        closed += moved
        prepared = np.frombuffer(base64.b64decode(record['indicesU32']), dtype='<u4').reshape(-1, 3)
        if not np.array_equal(prepared, indices):
            raise RuntimeError(f'{so["name"]}: ordem dos cantos difere do UV1 do site')
        world = BASIS @ Matrix([so['matrix'][i::4] for i in range(4)])
        old = [obj.matrix_world @ Vector(c) for c in obj.bound_box]
        new = [world @ Vector(p) for p in positions[np.unique(indices)]]
        for axis in range(3):
            a = (min(v[axis] for v in old), max(v[axis] for v in old)); b = (min(v[axis] for v in new), max(v[axis] for v in new))
            if not moved and (abs(a[0] - b[0]) > .02 or abs(a[1] - b[1]) > .02):
                raise RuntimeError(f'{so["name"]}: a malha do Blender não está onde o site a desenha ({a} x {b})')
        mesh = bpy.data.meshes.new(f'LIV luz horario {so["name"]}')
        mesh.from_pydata(positions.tolist(), [], indices.tolist()); mesh.update()
        for material in materials:
            mesh.materials.append(material)
        for face, index in zip(mesh.polygons, face_materials):
            face.material_index = int(index); face.use_smooth = True
        mesh.normals_split_custom_set(normals[indices].reshape(-1, 3).tolist())
        uv0 = mesh.uv_layers.new(name='UVMap')
        if geo.get('uv'):
            uv0.data.foreach_set('uv', np.asarray(geo['uv'], dtype=np.float32).reshape(-1, 2)[indices].reshape(-1))
        uv1 = mesh.uv_layers.new(name='Lightmap')
        uv1.data.foreach_set('uv', np.frombuffer(base64.b64decode(record['uv1U16']), dtype='<u2').astype(np.float32) / 65535)
        uv0.active_render = True; mesh.uv_layers.active = uv1
        obj.data = mesh; obj.matrix_world = world; obj.modifiers.clear()
        targets.append(obj)
    if entrance and closed != 36:
        raise RuntimeError(f'Folha da entrada: {closed} vértices, esperados 36')
    # O Blender grava objeto por objeto e sincroniza a cena a cada um: 33 sincronizações viravam ~50 s.
    names = [obj.name for obj in targets]
    bpy.ops.object.select_all(action='DESELECT')
    for obj in targets:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = targets[0]; bpy.ops.object.join()
    joined = bpy.context.view_layer.objects.active; joined.name = 'LIV luz horario | superficies gravadas'
    joined.data.uv_layers['UVMap'].active_render = True; joined.data.uv_layers.active = joined.data.uv_layers['Lightmap']
    return [joined], names


def bake(scene, groups, passes, margin=3):
    """groups: [(objetos, imagem)]; uma gravação só escreve cada imagem nos materiais do seu grupo."""
    bpy.ops.object.select_all(action='DESELECT')
    for objects, image in groups:
        for obj in objects:
            obj.select_set(True)
        for material in {s.material for o in objects for s in o.material_slots if s.material}:
            node = material.node_tree.nodes.get('LIV luz horario') or material.node_tree.nodes.new('ShaderNodeTexImage')
            node.name = 'LIV luz horario'; node.image = image; material.node_tree.nodes.active = node
    bpy.context.view_layer.objects.active = groups[0][0][0]
    started = time.perf_counter()
    bpy.ops.object.bake(type='DIFFUSE', pass_filter=passes, use_clear=True, margin=margin, margin_type='EXTEND', target='IMAGE_TEXTURES')
    print('LIV_LUZ_HORARIO_BAKE', scene.name, sorted(passes), [g[1].size[0] for g in groups], round(time.perf_counter() - started, 1), flush=True)
    out = []
    for _, image in groups:
        pixels = np.empty(image.size[0] * image.size[1] * 4, dtype=np.float32); image.pixels.foreach_get(pixels)
        out.append(pixels.reshape(image.size[1], image.size[0], 4))
    return out


def bake_both(scene, shell, image, probes, probe_image, passes):
    # Sondas à parte e sem borda: os blocos já são cheios, e estender borda em 13 mil ilhas custava ~70 s.
    return bake(scene, [(shell, image)], passes)[0], bake(scene, [([probes], probe_image)], passes, margin=0)[0]


def add_portals(scene, plan, center, rooms):
    """Portal sem potência em cada janela, com -Z para dentro do cômodo (o vão da varanda já tem o seu)."""
    made = []
    for window in plan['planta']['janelas']:
        room = next(r for r in rooms if r['id'] == window['wallId'].split('-')[0])
        x, z = window['p'][0] - center[0], window['p'][1] - center[1]
        cx = sum(p[0] for p in room['poly']) / len(room['poly']); cz = sum(p[1] for p in room['poly']) / len(room['poly'])
        along_x = window['wallId'].endswith(('north', 'south'))
        inward = (0, math.copysign(1, cz - z)) if along_x else (math.copysign(1, cx - x), 0)
        y0, y1 = window.get('y0', 1), window.get('y1', 2.2)
        light = bpy.data.lights.new('LIV luz horario | portal ' + window['id'], 'AREA')
        light.shape = 'RECTANGLE'; light.size = window['largura']; light.size_y = y1 - y0; light.energy = 0; light.cycles.is_portal = True
        obj = bpy.data.objects.new(light.name, light); scene.collection.objects.link(obj)
        obj.location = (x, -z, (y0 + y1) / 2)
        # aim_along põe -Z ao longo de -d: d = -inward, já em Blender (z do site vira -y).
        aim_along(obj, (-inward[0], inward[1], 0))
        made.append(window['id'])
    return made


def build_probes(scene, rooms, depsgraph):
    """Grade por cômodo; sonda dentro de móvel/parede (raio sai por face de trás) fica inválida."""
    grids, cubes = [], []
    directions = [(1, 0, 0), (-1, 0, 0), (0, 0, 1), (0, 0, -1), (0, -1, 0), (0, 1, 0)]  # +x -x +y -y +z -z do site, em Blender
    for room in rooms:
        xs = [p[0] for p in room['poly']]; zs = [p[1] for p in room['poly']]
        x0, x1, z0, z1 = min(xs) + PROBE_INSET, max(xs) - PROBE_INSET, min(zs) + PROBE_INSET, max(zs) - PROBE_INSET
        nx = max(2, round((x1 - x0) / PROBE_SPACING) + 1); nz = max(2, round((z1 - z0) / PROBE_SPACING) + 1)
        ys = np.linspace(.15, 2.55, PROBE_LEVELS); valid = []
        for k in range(nz):
            for j in range(PROBE_LEVELS):
                for i in range(nx):
                    x = x0 + (x1 - x0) * i / (nx - 1); z = z0 + (z1 - z0) * k / (nz - 1); y = float(ys[j])
                    ok = inside(room['poly'], x, z)
                    if ok:
                        back = 0
                        for d in directions:
                            hit, _, normal, *_ = scene.ray_cast(depsgraph, Vector((x, -z, y)), Vector(d), distance=1.0)
                            back += bool(hit and normal.dot(Vector(d)) > 0)
                        ok = back < 2
                    valid.append(bool(ok))
                    cubes.append((x, y, z))
        grids.append({'room': room['id'], 'name': room['name'], 'origin': [x0, float(ys[0]), z0],
                      'step': [(x1 - x0) / (nx - 1), float(ys[1] - ys[0]), (z1 - z0) / (nz - 1)], 'n': [nx, PROBE_LEVELS, nz],
                      'valid': valid})
    # Seis faces por sonda, cada uma num bloco de 2x2 texels; ordem das faces = +x -x +y -y +z -z do site.
    faces = len(cubes) * 6; per_row = 256; width = per_row * PROBE_BLOCK; height = -(-faces // per_row) * PROBE_BLOCK
    verts, polys, uvs, h = [], [], [], .01
    quads = [  # (normal no site, 4 cantos no site, em ordem anti-horária vista de fora)
        ((1, 0, 0), [(h, -h, -h), (h, h, -h), (h, h, h), (h, -h, h)]), ((-1, 0, 0), [(-h, -h, h), (-h, h, h), (-h, h, -h), (-h, -h, -h)]),
        ((0, 1, 0), [(-h, h, -h), (-h, h, h), (h, h, h), (h, h, -h)]), ((0, -1, 0), [(-h, -h, h), (-h, -h, -h), (h, -h, -h), (h, -h, h)]),
        ((0, 0, 1), [(h, -h, h), (h, h, h), (-h, h, h), (-h, -h, h)]), ((0, 0, -1), [(-h, -h, -h), (-h, h, -h), (h, h, -h), (h, -h, -h)])]
    for c, (x, y, z) in enumerate(cubes):
        for f, (_, corners) in enumerate(quads):
            block = c * 6 + f; bx, by = block % per_row, block // per_row; base = len(verts)
            for (ox, oy, oz) in corners:
                verts.append((x + ox, -(z + oz), y + oy))
            polys.append((base, base + 1, base + 2, base + 3))
            u0, v0 = bx * PROBE_BLOCK / width, by * PROBE_BLOCK / height
            u1, v1 = (bx + 1) * PROBE_BLOCK / width, (by + 1) * PROBE_BLOCK / height
            uvs += [(u0, v0), (u1, v0), (u1, v1), (u0, v1)]
    mesh = bpy.data.meshes.new('LIV luz horario | sondas'); mesh.from_pydata(verts, [], polys); mesh.update()
    for poly, (normal, _) in zip(mesh.polygons, quads * len(cubes)):
        if poly.normal.dot(Vector((normal[0], -normal[2], normal[1]))) < .99:
            poly.flip()  # o giro de site para Blender espelha o sentido; a face precisa olhar para fora
    mesh.update()
    for poly, (normal, _) in zip(mesh.polygons, quads * len(cubes)):
        if poly.normal.dot(Vector((normal[0], -normal[2], normal[1]))) < .99:
            raise RuntimeError('Face de sonda com normal errada')
    layer = mesh.uv_layers.new(name='UVMap'); layer.data.foreach_set('uv', np.asarray(uvs, dtype=np.float32).reshape(-1))
    material = bpy.data.materials.new('LIV luz horario | sondas'); material.use_nodes = True; mesh.materials.append(material)
    obj = bpy.data.objects.new('LIV luz horario | sondas', mesh); scene.collection.objects.link(obj)
    # Sem nenhuma visibilidade o Cycles descarta o objeto; câmera não entra na gravação.
    for flag in ('visible_diffuse', 'visible_glossy', 'visible_transmission', 'visible_volume_scatter', 'visible_shadow'):
        setattr(obj, flag, False)
    image = bpy.data.images.new('LIV luz horario | sondas', width, height, alpha=True, float_buffer=True); image.colorspace_settings.name = 'Non-Color'
    spec = {'schema': 'liv-luz-horario-sondas-v1', 'block': PROBE_BLOCK, 'perRow': per_row, 'width': width, 'height': height,
            'faceOrder': ['+x', '-x', '+y', '-y', '+z', '-z'], 'probes': len(cubes), 'rooms': grids}
    return obj, image, spec


def rotate_entrance_handles(scene, door):
    """As maçanetas da entrada (malha de alumínio, fora do UV1) acompanham a folha fechada."""
    obj = scene.objects['mesh-4']; mesh = obj.data; moved = 0
    if obj.matrix_world != Matrix.Identity(4):
        raise RuntimeError('mesh-4 fora da origem')
    for v in mesh.vertices:
        x, z, y = v.co.x, -v.co.y, v.co.z
        if math.hypot(x - door['hinge'][0], z - door['hinge'][1]) <= .8 and .95 < y < 1.13:
            x, z = turn(x, z, door['hinge'], door['closedRotation']); v.co.x, v.co.y = x, -z; moved += 1
    mesh.update()
    return moved


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--size', type=int, default=1024)
    parser.add_argument('--samples', type=int, default=256)
    parser.add_argument('--texture-limit', default='256')
    parser.add_argument('--so', default=None, help='grava só esta chave (ex.: lazer-08 ou noite)')
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
    blend = Path(bpy.data.filepath)
    if blend.resolve() != (ROOT / 'entrega/LIV_Luz_Natural.blend').resolve():
        raise RuntimeError('Abra entrega/LIV_Luz_Natural.blend')
    record = json.loads((WEB / 'interiores/catalogo.json').read_text(encoding='utf8'))['tipologias']['canto']
    source_bytes = (WEB / 'interiores/canto/source.json').read_bytes()
    compact_bytes = gzip.decompress((WEB / record['files']['compact']['path']).read_bytes())
    if sha(source_bytes) != record['sourceSHA256'] or sha(compact_bytes) != record['files']['compact']['decodedSHA256']:
        raise RuntimeError('Fonte ou UV1 do Canto diferem do catálogo do site')
    source, compact = json.loads(source_bytes), json.loads(compact_bytes)
    keys = json.loads((OUT / 'chaves.json').read_text(encoding='utf8'))['keys']
    plafons = json.loads((OUT / 'plafons-web.json').read_text(encoding='utf8'))
    entrance = next(d for d in json.loads((OUT / 'portas-web.json').read_text(encoding='utf8')) if d['entrance'])
    plan, center, rooms = unit_rooms()
    door_color = np.asarray(srgb_linear(((plan.get('cores') or {}).get('porta') or '#EDE7DD').lstrip('#')), dtype=np.float32)

    scene = bpy.data.scenes[SCENE]; bpy.context.window.scene = scene
    backend, devices = compute_device(scene)
    scene.cycles.samples = args.samples; scene.cycles.use_adaptive_sampling = False; scene.cycles.seed = 31
    scene.render.use_persistent_data = True
    # O rebatimento só depende da cor média; subir as texturas em 4K a cada gravação custava ~2 min.
    scene.render.use_simplify = True; scene.cycles.texture_limit_render = args.texture_limit
    # O box do chuveiro é vidro no site (26/10): na gravação ele sai de cena, como vidro claro.
    # Opaco, ele tapava a janela do banho da suíte e o interior do box saía escuro.
    glass = [o.name for o in scene.objects if o.type == 'MESH' and any(s.material and s.material.name == 'LIV | Acabamento box' for s in o.material_slots)]
    for name in glass:
        scene.objects[name].hide_render = True
    print('LIV_LUZ_HORARIO_VIDRO', glass, flush=True)
    targets, target_names = install_web_meshes(scene, source, compact, entrance, door_color)
    handles = rotate_entrance_handles(scene, entrance)
    portals = add_portals(scene, plan, center, rooms)
    probes, probe_image, probe_spec = build_probes(scene, rooms, bpy.context.evaluated_depsgraph_get())
    (OUT / 'sondas.json').write_text(json.dumps(probe_spec), encoding='utf8')
    print('LIV_LUZ_HORARIO_SONDAS', probe_spec['probes'], sum(sum(r['valid']) for r in probe_spec['rooms']), portals, 'macanetas', handles, flush=True)
    nodes = scene.world.node_tree.nodes
    sky = next(n for n in nodes if n.type == 'TEX_SKY'); background = next(n for n in nodes if n.type == 'BACKGROUND')
    strength = background.inputs['Strength'].default_value

    def new_light(name, kind):
        light = bpy.data.lights.new(name, kind); obj = bpy.data.objects.new(name, light)
        scene.collection.objects.link(obj); return obj
    sun = new_light('LIV luz horario | sol', 'SUN'); sun.data.angle = math.radians(.53)
    # Prova da irradiância: placa sozinha numa cena com o mesmo World, de frente para o sol, só luz direta.
    probe_scene = bpy.data.scenes.new('LIV luz horario | placa'); probe_scene.world = scene.world
    probe_scene.render.engine = 'CYCLES'; compute_device(probe_scene); probe_scene.cycles.samples = 1024
    plate_mesh = bpy.data.meshes.new('LIV luz horario | placa'); plate_mesh.from_pydata([(-.5, -.5, 0), (.5, -.5, 0), (.5, .5, 0), (-.5, .5, 0)], [], [(0, 1, 2, 3)])
    plate_mesh.uv_layers.new(name='UVMap'); plate = bpy.data.objects.new('LIV luz horario | placa', plate_mesh)
    probe_scene.collection.objects.link(plate)
    white = bpy.data.materials.new('LIV luz horario | placa'); white.use_nodes = True; plate_mesh.materials.append(white)
    plate_image = bpy.data.images.new('LIV luz horario | placa', 4, 4, float_buffer=True); plate_image.colorspace_settings.name = 'Non-Color'
    calibration = bpy.data.objects.new('LIV luz horario | sol da prova', sun.data.copy()); probe_scene.collection.objects.link(calibration)

    def plate_value(direction, lamp=False):
        calibration.hide_render = not lamp; calibration.data.energy = 1; aim_along(calibration, direction)
        aim_along(plate, direction)  # -Z local fica de costas para o sol: a normal (+Z) olha para ele
        bpy.context.window.scene = probe_scene
        try:
            return bake(probe_scene, [([plate], plate_image)], {'DIRECT'})[0][:, :, :3].reshape(-1, 3).mean(axis=0)
        finally:
            bpy.context.window.scene = scene

    image = bpy.data.images.new('LIV luz horario', args.size, args.size, alpha=True, float_buffer=True)
    image.colorspace_settings.name = 'Non-Color'
    OUT.mkdir(parents=True, exist_ok=True)
    measured_path = OUT / 'medidas.json'
    measured = json.loads(measured_path.read_text(encoding='utf8')) if measured_path.is_file() else {}
    measured.update(size=args.size, samples=args.samples, backend=backend, devices=devices,
                    blendSHA256=sha(blend.read_bytes()), sourceSHA256=record['sourceSHA256'],
                    geometrySHA256=record['files']['compact']['decodedSHA256'], targets=target_names,
                    exposureEV=scene.view_settings.exposure, keys=measured.get('keys', {}))
    if 'v1' not in measured:
        background.inputs['Strength'].default_value = 0
        measured['v1'] = float(plate_value((0, 0, 1), lamp=True).mean())
    print('LIV_LUZ_HORARIO_V1', measured['v1'], backend, devices, len(target_names), flush=True)

    jobs = [*keys, {'id': 'noite'}]
    for key in jobs:
        if args.so and key['id'] != args.so:
            continue
        started = time.perf_counter()
        if key['id'] == 'noite':
            sun.hide_render = True; background.inputs['Strength'].default_value = 0
            spots = []
            for item in plafons:
                spot = new_light('LIV luz horario | ' + item['name'], 'SPOT'); spots.append(spot)
                p, t = item['position'], item['target']
                spot.location = (p[0], -p[2], p[1]); aim_along(spot, [p[0] - t[0], -(p[2] - t[2]), p[1] - t[1]])
                # Three: candela com decaimento físico. Cycles: P/(4π) W/sr.
                spot.data.energy = 4 * math.pi * item['dayIntensity']; spot.data.color = item['color']
                spot.data.spot_size = 2 * item['angle']; spot.data.spot_blend = item['penumbra']; spot.data.shadow_soft_size = .05
            pixels, probe_pixels = bake_both(scene, targets, image, probes, probe_image, {'INDIRECT'})
            for spot in spots:
                bpy.data.objects.remove(spot)
            entry = {'kind': 'noite'}
        else:
            d = key['directionBlender']; elevation = math.asin(max(-1, min(1, d[2])))
            sky.sun_elevation = elevation; sky.sun_rotation = math.pi / 2 - math.atan2(d[1], d[0])
            background.inputs['Strength'].default_value = strength; sun.hide_render = True
            sky.sun_disc = True; on = plate_value(d)
            sky.sun_disc = False; off = plate_value(d)
            irradiance = np.maximum(on - off, 0) / measured['v1']
            pixels, probe_pixels = bake_both(scene, targets, image, probes, probe_image, {'DIRECT', 'INDIRECT'})  # céu sem disco
            if irradiance.max() > 1e-4:
                background.inputs['Strength'].default_value = 0; sun.hide_render = False
                sun.data.energy = float(irradiance.max()); sun.data.color = tuple(irradiance / irradiance.max())
                aim_along(sun, d)
                extra, extra_probes = bake_both(scene, targets, image, probes, probe_image, {'INDIRECT'})
                pixels[:, :, :3] += extra[:, :, :3]; probe_pixels[:, :, :3] += extra_probes[:, :, :3]
            entry = {'kind': 'dia', 'side': key['side'], 'hour': key['hour'], 'elevationDegrees': key['elevationDegrees'],
                     'daylight': key['daylight'], 'sunStrength': key['sunStrength'], 'sunIrradianceRGB': irradiance.tolist()}
        if not np.isfinite(pixels).all() or not (pixels[:, :, 3] > 0).any():
            raise RuntimeError(f'{key["id"]}: bake vazio ou inválido')
        raw = np.ascontiguousarray(pixels, dtype=np.float32).tobytes(); (OUT / f'{key["id"]}.f32').write_bytes(raw)
        probe_raw = np.ascontiguousarray(probe_pixels, dtype=np.float32).tobytes(); (OUT / f'{key["id"]}-sondas.f32').write_bytes(probe_raw)
        entry.update(rawSHA256=sha(raw), probesSHA256=sha(probe_raw), seconds=time.perf_counter() - started, max=float(pixels[:, :, :3].max()))
        measured['keys'][key['id']] = entry
        measured_path.write_text(json.dumps(measured, indent=2), encoding='utf8')
        print('LIV_LUZ_HORARIO_CHAVE', key['id'], json.dumps(entry), flush=True)


if __name__ == '__main__':
    main()

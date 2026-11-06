"""Grava no Cycles a luz de uma planta do Laranjeiras por hora, menos o sol direto (o site desenha em tempo real).

& 'C:\\Program Files (x86)\\Steam\\steamapps\\common\\Blender\\blender.exe' -b experimentos/liv-luz-natural-2026-10-26/entrega/LIV_Luz_Natural.blend --python experimentos/containers-mooca-2026-11-05/interiores/luz/bake_horario.py -- --tipologia canto [--so maisx-08]

Mesmo bake do LIV (liv-luz-natural-2026-10-26/bake-luz-horario.py, cujas funções este importa): céu, câmera e
exposição da cena aprovada `03 | Sala e jantar`, com o corredor do prédio atrás da entrada; as malhas vêm da fonte congelada (interiores/luz/<planta>/
source.json, exportar_fonte.py) com o UV1 do preparar_luz.py (bake/geometry-compact.json). Os móveis que o site
troca saem e entram os aprovados (moveis-site.glb); a porta de entrada é gravada fechada. Saída em
interiores/luz/<planta>/gravado/: <id>.f32 e <id>-sondas.f32, medidas.json e sondas.json (empacotar_horario.py).
"""
from pathlib import Path
import argparse
import base64
import hashlib
import importlib.util
import json
import math
import sys
import time

import bpy
import numpy as np
from mathutils import Matrix

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parents[3]
SITE = ROOT.parents[1] / 'site'
LIV_LUZ = REPO / 'experimentos/liv-luz-natural-2026-10-26'
sys.path.insert(0, str(REPO / 'v1.5/miniaturas/liv-ipanema/interior'))
from bake_luz import BASIS, compute_device, create_material, topology  # noqa: E402

spec = importlib.util.spec_from_file_location('liv_horario', LIV_LUZ / 'bake-luz-horario.py')
liv = importlib.util.module_from_spec(spec); spec.loader.exec_module(liv)
SCENE = liv.SCENE


def sha(data):
    return hashlib.sha256(data).hexdigest()


def unit_rooms(typology):
    """Cômodos em coordenadas do site (createLayout: centro da caixa de todos os polígonos)."""
    plan = json.loads((SITE / f'interiores/{typology}/unidade.json').read_text(encoding='utf8'))
    points = [p for c in plan['planta']['comodos'] for p in c['poly']]
    center = [(min(p[i] for p in points) + max(p[i] for p in points)) / 2 for i in (0, 1)]
    rooms = [{'id': c.get('id'), 'name': c['nome'], 'poly': [[p[0] - center[0], p[1] - center[1]] for p in c['poly']]}
             for c in plan['planta']['comodos']]
    return plan, center, rooms


def new_scene(base):
    """Cena vazia com o mundo, a exposição e os rebatimentos aprovados da base (como meio_scene do LIV)."""
    scene = bpy.data.scenes.new('Laranjeiras luz horario'); scene.world = base.world; scene.render.engine = 'CYCLES'
    for attr in ('view_transform', 'look', 'exposure', 'gamma'):
        setattr(scene.view_settings, attr, getattr(base.view_settings, attr))
    scene.display_settings.display_device = base.display_settings.display_device
    for attr in ('max_bounces', 'diffuse_bounces', 'glossy_bounces', 'transmission_bounces', 'volume_bounces', 'transparent_max_bounces',
                 'caustics_reflective', 'caustics_refractive', 'blur_glossy', 'sample_clamp_direct', 'sample_clamp_indirect'):
        setattr(scene.cycles, attr, getattr(base.cycles, attr))
    return scene


# Mesmas medidas de corridorBox em site/interior-renderer.js (m): boca dentro da espessura da parede, fundo, sobra
# para cada lado do vão, piso e teto.
CORREDOR = {'boca': .04, 'fundo': 1.5, 'margem': .5, 'piso': -.005, 'teto': 2.7}


def corridor(scene, plan, center, door_id):
    """Corredor do prédio atrás da entrada. A folha fechada não cobre o vão inteiro (5,5 cm do lado da maçaneta,
    1,2 cm embaixo) e, com a unidade solta no céu, céu e sol entravam por ali: faixa clara forte no piso em frente
    à porta. Caixa cinza fechada, aberta só para a parede (a boca fica dentro da espessura dela)."""
    door = next(d for d in plan['planta']['portas'] if d['id'] == door_id)
    x, z = door['p'][0] - center[0], door['p'][1] - center[1]
    across_z = door['wallId'].endswith(('-north', '-south'))  # parede ao longo de x: o corredor fica em ±z
    line, along = (z, x) if across_z else (x, z)
    sign = math.copysign(1, line); half = door['largura'] / 2 + CORREDOR['margem']
    near, far = line + sign * CORREDOR['boca'], line + sign * CORREDOR['fundo']
    corners = []
    for n in (near, far):
        for a in (along - half, along + half):
            for y in (CORREDOR['piso'], CORREDOR['teto']):
                sx, sz = (a, n) if across_z else (n, a)
                corners.append((sx, -sz, y))  # site (x, y, z) -> Blender (x, -z, y)
    # Índice = 4*fundo + 2*lado + teto; cinco faces (a da boca fica aberta).
    faces = [(4, 5, 7, 6), (0, 1, 5, 4), (2, 3, 7, 6), (0, 2, 6, 4), (1, 3, 7, 5)]
    mesh = bpy.data.meshes.new('Laranjeiras corredor'); mesh.from_pydata(corners, [], faces); mesh.update()
    material = bpy.data.materials.new('Laranjeiras corredor'); material.use_nodes = True
    bsdf = next(n for n in material.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    bsdf.inputs['Base Color'].default_value = (.35, .35, .35, 1); bsdf.inputs['Roughness'].default_value = 1
    mesh.materials.append(material)
    obj = bpy.data.objects.new('Laranjeiras corredor', mesh); scene.collection.objects.link(obj)
    print('LARANJEIRAS_LUZ_CORREDOR', door_id, 'z' if across_z else 'x', round(near, 3), round(far, 3), flush=True)
    return obj


def close_handles(site, door):
    """Maçaneta da entrada (alumínio, perto da dobradiça, a 0,95-1,13 m) acompanha a folha fechada."""
    moved = 0
    for p in site:
        if math.hypot(p[0] - door['hinge'][0], p[2] - door['hinge'][1]) <= .8 and .95 < p[1] < 1.13:
            p[0], p[2] = liv.turn(p[0], p[2], door['hinge'], door['closedRotation']); moved += 1
    return moved


def close_leaf(positions, normals, colors, indices, door, color):
    """liv.close_entrance gira todo vértice com cor de porta a até 0,8 m da dobradiça. No casal com bebê o batente
    do banho fica a 0,7 m e girava junto. Aqui só gira a peça (triângulos ligados por vértice na mesma posição)
    que encosta na dobradiça (< 15 cm): a folha da entrada."""
    if colors is None or not len(indices):
        return 0
    near = np.hypot(positions[:, 0] - door['hinge'][0], positions[:, 2] - door['hinge'][1])
    painted = np.abs(colors - color).max(1) <= .004
    tris = [t for t in indices if painted[t].all() and (near[t] <= .8).all()]
    if not tris:
        return 0
    key = {}; parent = list(range(len(tris)))
    def root(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]; i = parent[i]
        return i
    for i, t in enumerate(tris):
        for v in t:
            k = tuple(np.round(positions[v], 4))
            if k in key:
                parent[root(i)] = root(key[k])
            else:
                key[k] = i
    keep = {root(i) for i, t in enumerate(tris) if (near[t] < .15).any()}
    moved = sorted({int(v) for i, t in enumerate(tris) if root(i) in keep for v in t})
    for v in moved:
        p = positions[v]; p[0], p[2] = liv.turn(p[0], p[2], door['hinge'], door['closedRotation'])
        nx, nz = liv.turn(normals[v][0], normals[v][2], (0, 0), door['closedRotation']); normals[v][0], normals[v][2] = nx, nz
    return len(moved)


def leaf_material(source, door, color):
    """Material da folha: o que tem a peça presa à dobradiça. A maçaneta é o seguinte (m3/m4 no casal; m2/m3 no
    quádruplo e no casal com bebê, que têm um material a menos antes da porta)."""
    for record in source['objects']:
        geo = source['geometries'][record['geometry']]
        if len(record['materials']) != 1 or not geo.get('color'):
            continue
        positions, normals, indices, _ = topology(geo, 1)
        m = np.asarray(record['matrix'], dtype=np.float64).reshape(4, 4).T
        site = positions.astype(np.float64) @ m[:3, :3].T + m[:3, 3]
        if close_leaf(site, normals.astype(np.float64) @ m[:3, :3].T, np.asarray(geo['color'], dtype=np.float32).reshape(-1, 3), indices, door, color):
            return record['materials'][0]
    raise RuntimeError('Não achei a folha da porta de entrada')


def build(scene, source, compact, work, typology, door, door_color):
    """Malhas da fonte congelada, na mesma ordem de cantos do UV1 do site; devolve as superfícies juntadas."""
    textures = work / 'bake/textures'; textures.mkdir(parents=True, exist_ok=True)
    for key, texture in source['textures'].items():
        (textures / (key + '.png')).write_bytes(base64.b64decode(texture['data'].split(',', 1)[1]))
    images = {'directory': textures}
    materials = {key: create_material(key, data, source, images) for key, data in source['materials'].items()}
    replaced = set(json.loads((work / 'moveis-site.json').read_text(encoding='utf8'))['replaced'])
    by_index = {item['objectIndex']: item for item in compact['objects']}
    targets, names, hidden, leaf, handles = [], [], [], 0, 0
    leaf_key = leaf_material(source, door, door_color)
    handle_key = f'm{int(leaf_key[1:]) + 1}'
    for oi, record in enumerate(source['objects']):
        material_names = {source['materials'][m]['name'] for m in record['materials']}
        # Móvel trocado no site sai (entra o aprovado); o box do chuveiro é vidro no site, sai como vidro claro.
        if not record.get('include', True) or record.get('furnitureId') in replaced or 'Acabamento box' in material_names:
            hidden.append(record['name']); continue
        geo = source['geometries'][record['geometry']]
        positions, normals, indices, face_materials = topology(geo, len(record['materials']))
        if not len(indices):
            continue
        colors = np.asarray(geo['color'], dtype=np.float32).reshape(-1, 3) if geo.get('color') else None
        uv = by_index.get(oi)
        if uv is not None and not np.array_equal(np.frombuffer(base64.b64decode(uv['indicesU32']), dtype='<u4').reshape(-1, 3), indices):
            raise RuntimeError(f'{record["name"]}: ordem dos cantos difere do UV1 do site')
        world_matrix = BASIS @ Matrix([record['matrix'][i::4] for i in range(4)])
        if leaf_key in record['materials'] or handle_key in record['materials']:
            # A folha (cor de porta) e a maçaneta giram na dobradiça, no mundo do site (matriz do Three).
            m = np.asarray(record['matrix'], dtype=np.float64).reshape(4, 4).T; r = m[:3, :3]
            site = positions.astype(np.float64) @ r.T + m[:3, 3]; site_normals = normals.astype(np.float64) @ r.T
            if leaf_key in record['materials']:
                leaf += close_leaf(site, site_normals, colors, indices, door, door_color)
            if handle_key in record['materials']:
                handles += close_handles(site, door)
            inverse = np.linalg.inv(r)
            positions = ((site - m[:3, 3]) @ inverse.T).astype(np.float32); normals = (site_normals @ inverse.T).astype(np.float32)
        mesh = bpy.data.meshes.new(f'Laranjeiras {record["name"]}')
        mesh.from_pydata(positions.tolist(), [], indices.tolist()); mesh.update()
        for key in record['materials']:
            mesh.materials.append(materials[key])
        for face, index in zip(mesh.polygons, face_materials):
            face.material_index = int(index); face.use_smooth = True
        corners = liv.flat_corners(positions, normals, indices) if uv is not None else normals[indices]
        mesh.normals_split_custom_set(corners.reshape(-1, 3).tolist())
        uv0 = mesh.uv_layers.new(name='UVMap')
        if geo.get('uv'):
            uv0.data.foreach_set('uv', np.asarray(geo['uv'], dtype=np.float32).reshape(-1, 2)[indices].reshape(-1))
        if colors is not None:
            tint = colors * np.asarray(record['instanceColor']) if record.get('instanceColor') else colors
            attribute = mesh.color_attributes.new('Color', 'FLOAT_COLOR', 'POINT')
            attribute.data.foreach_set('color', np.c_[tint, np.ones(len(tint))].astype(np.float32).reshape(-1))
        if uv is not None:
            uv1 = mesh.uv_layers.new(name='Lightmap')
            uv1.data.foreach_set('uv', np.frombuffer(base64.b64decode(uv['uv1U16']), dtype='<u2').astype(np.float32) / 65535)
            uv0.active_render = True; mesh.uv_layers.active = uv1
        obj = bpy.data.objects.new(record['name'], mesh); scene.collection.objects.link(obj); obj.matrix_world = world_matrix
        if uv is not None:
            targets.append(obj); names.append(record['name'])  # o .blend do LIV já tem mesh-N: o Blender renomeia
    if not leaf or not handles:
        raise RuntimeError(f'Porta de entrada não fechou: folha {leaf} vértices, maçaneta {handles}')
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(work / 'moveis-site.glb'))
    added = [o for o in bpy.data.objects if o not in before and o.type == 'MESH']
    for obj in added:
        if obj.name not in scene.collection.all_objects:
            scene.collection.objects.link(obj)
    print('LARANJEIRAS_LUZ_CENA', typology, 'alvos', len(targets), 'escondidos', hidden, 'aprovados', len(added),
          'folha', leaf, 'macaneta', handles, flush=True)
    bpy.ops.object.select_all(action='DESELECT')
    for obj in targets:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = targets[0]; bpy.ops.object.join()
    joined = bpy.context.view_layer.objects.active; joined.name = 'Laranjeiras luz horario | superficies gravadas'
    joined.data.uv_layers['UVMap'].active_render = True; joined.data.uv_layers.active = joined.data.uv_layers['Lightmap']
    return [joined], names


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--size', type=int, default=1024)
    parser.add_argument('--samples', type=int, default=256)
    parser.add_argument('--texture-limit', default='256')
    parser.add_argument('--so', default=None, help='grava só esta chave (ex.: maisx-08 ou noite)')
    parser.add_argument('--tipologia', default='individual', choices=('individual', 'individual-pne', 'casal', 'quadruplo', 'casal-bebe', 'refeitorio', 'convivencia'))
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
    blend = Path(bpy.data.filepath)
    if blend.resolve() != (LIV_LUZ / 'entrega/LIV_Luz_Natural.blend').resolve():
        raise RuntimeError('Abra experimentos/liv-luz-natural-2026-10-26/entrega/LIV_Luz_Natural.blend')
    typology = args.tipologia; work = ROOT / typology; out = work / 'gravado'
    source_bytes = (work / 'source.json').read_bytes(); compact_bytes = (work / 'bake/geometry-compact.json').read_bytes()
    unwrap = json.loads((work / 'bake/unwrap.json').read_text(encoding='utf8'))
    if sha(source_bytes) != unwrap['sourceSHA256'] or sha(compact_bytes) != unwrap['geometrySHA256'] or unwrap['size'] != args.size:
        raise RuntimeError('Fonte ou UV1 mudaram depois do preparar_luz.py')
    source, compact = json.loads(source_bytes), json.loads(compact_bytes)
    keys = json.loads((work / 'chaves.json').read_text(encoding='utf8'))['keys']
    plafons = json.loads((work / 'plafons-web.json').read_text(encoding='utf8'))
    door = next(d for d in json.loads((work / 'portas-web.json').read_text(encoding='utf8')) if d['entrance'])
    plan, center, rooms = unit_rooms(typology)
    door_color = np.asarray(liv.srgb_linear(((plan.get('cores') or {}).get('porta') or '#EDE7DD').lstrip('#')), dtype=np.float32)

    scene = new_scene(bpy.data.scenes[SCENE]); bpy.context.window.scene = scene
    backend, devices = compute_device(scene)
    scene.cycles.samples = args.samples; scene.cycles.use_adaptive_sampling = False; scene.cycles.seed = 31
    scene.render.use_persistent_data = True
    # O rebatimento só depende da cor média; subir as texturas grandes a cada gravação custava minutos no LIV.
    scene.render.use_simplify = True; scene.cycles.texture_limit_render = args.texture_limit
    targets, target_names = build(scene, source, compact, work, typology, door, door_color)
    corridor(scene, plan, center, door['id'])
    # A planta do meio tem janela em parede de cômodo que não existe (a6: 'c2-west'): o portal vai para o cômodo
    # cuja borda passa mais perto da janela, na mesma face (west/east/...).
    ids = {r['id'] for r in rooms}
    for window in plan['planta']['janelas']:
        room_id, face = window['wallId'].split('-', 1)
        if room_id not in ids:
            x, z = window['p'][0] - center[0], window['p'][1] - center[1]

            def gap(room):
                poly = room['poly']
                return min(math.hypot(*np.subtract((x, z), np.add(a, np.clip(np.dot(np.subtract((x, z), a), np.subtract(b, a)) /
                           max(np.dot(np.subtract(b, a), np.subtract(b, a)), 1e-12), 0, 1) * np.subtract(b, a))))
                           for a, b in zip(poly, poly[1:] + poly[:1]))
            window['wallId'] = min(rooms, key=gap)['id'] + '-' + face
            print('LARANJEIRAS_LUZ_JANELA', window['id'], room_id, '->', window['wallId'], flush=True)
    portals = liv.add_portals(scene, plan, center, rooms)
    probes, probe_image, probe_spec = liv.build_probes(scene, rooms, bpy.context.evaluated_depsgraph_get())
    out.mkdir(parents=True, exist_ok=True)
    (out / 'sondas.json').write_text(json.dumps(probe_spec), encoding='utf8')
    print('LARANJEIRAS_LUZ_SONDAS', probe_spec['probes'], sum(sum(r['valid']) for r in probe_spec['rooms']), portals, flush=True)
    nodes = scene.world.node_tree.nodes
    sky = next(n for n in nodes if n.type == 'TEX_SKY'); background = next(n for n in nodes if n.type == 'BACKGROUND')
    strength = background.inputs['Strength'].default_value

    def new_light(name, kind):
        light = bpy.data.lights.new(name, kind); obj = bpy.data.objects.new(name, light)
        scene.collection.objects.link(obj); return obj
    sun = new_light('Laranjeiras luz horario | sol', 'SUN'); sun.data.angle = math.radians(.53)
    # Prova da irradiância: placa sozinha numa cena com o mesmo World, de frente para o sol, só luz direta.
    probe_scene = bpy.data.scenes.new('Laranjeiras luz horario | placa'); probe_scene.world = scene.world
    probe_scene.render.engine = 'CYCLES'; compute_device(probe_scene); probe_scene.cycles.samples = 1024
    plate_mesh = bpy.data.meshes.new('placa'); plate_mesh.from_pydata([(-.5, -.5, 0), (.5, -.5, 0), (.5, .5, 0), (-.5, .5, 0)], [], [(0, 1, 2, 3)])
    plate_mesh.uv_layers.new(name='UVMap'); plate = bpy.data.objects.new('placa', plate_mesh)
    probe_scene.collection.objects.link(plate)
    white = bpy.data.materials.new('placa'); white.use_nodes = True; plate_mesh.materials.append(white)
    plate_image = bpy.data.images.new('placa', 4, 4, float_buffer=True); plate_image.colorspace_settings.name = 'Non-Color'
    calibration = bpy.data.objects.new('sol da prova', sun.data.copy()); probe_scene.collection.objects.link(calibration)

    def plate_value(direction, lamp=False):
        calibration.hide_render = not lamp; calibration.data.energy = 1; liv.aim_along(calibration, direction)
        liv.aim_along(plate, direction)  # -Z local fica de costas para o sol: a normal (+Z) olha para ele
        bpy.context.window.scene = probe_scene
        try:
            return liv.bake(probe_scene, [([plate], plate_image)], {'DIRECT'})[0][:, :, :3].reshape(-1, 3).mean(axis=0)
        finally:
            bpy.context.window.scene = scene

    image = bpy.data.images.new('Laranjeiras luz horario', args.size, args.size, alpha=True, float_buffer=True)
    image.colorspace_settings.name = 'Non-Color'
    measured_path = out / 'medidas.json'
    measured = json.loads(measured_path.read_text(encoding='utf8')) if measured_path.is_file() else {}
    if measured.get('sourceSHA256') not in (None, sha(source_bytes)):
        measured = {}  # outra fonte: as chaves antigas não valem
    measured.update(size=args.size, samples=args.samples, backend=backend, devices=devices,
                    blendSHA256=sha(blend.read_bytes()), sourceSHA256=sha(source_bytes),
                    geometrySHA256=sha(compact_bytes), targets=target_names,
                    exposureEV=scene.view_settings.exposure, keys=measured.get('keys', {}))
    if 'v1' not in measured:
        background.inputs['Strength'].default_value = 0
        measured['v1'] = float(plate_value((0, 0, 1), lamp=True).mean())
    print('LARANJEIRAS_LUZ_V1', measured['v1'], backend, devices, len(target_names), flush=True)

    for key in [*keys, {'id': 'noite'}]:
        if args.so and key['id'] != args.so:
            continue
        started = time.perf_counter()
        if key['id'] == 'noite':
            sun.hide_render = True; background.inputs['Strength'].default_value = 0
            spots = []
            for item in plafons:
                spot = new_light('Laranjeiras luz horario | ' + item['name'], 'SPOT'); spots.append(spot)
                p, t = item['position'], item['target']
                spot.location = (p[0], -p[2], p[1]); liv.aim_along(spot, [p[0] - t[0], -(p[2] - t[2]), p[1] - t[1]])
                # Three: candela com decaimento físico. Cycles: P/(4π) W/sr.
                spot.data.energy = 4 * math.pi * item['dayIntensity']; spot.data.color = item['color']
                spot.data.spot_size = 2 * item['angle']; spot.data.spot_blend = item['penumbra']; spot.data.shadow_soft_size = .05
            pixels, probe_pixels = liv.bake_both(scene, targets, image, probes, probe_image, {'INDIRECT'})
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
            pixels, probe_pixels = liv.bake_both(scene, targets, image, probes, probe_image, {'DIRECT', 'INDIRECT'})  # céu sem disco
            if irradiance.max() > 1e-4:
                background.inputs['Strength'].default_value = 0; sun.hide_render = False
                sun.data.energy = float(irradiance.max()); sun.data.color = tuple(irradiance / irradiance.max())
                liv.aim_along(sun, d)
                extra, extra_probes = liv.bake_both(scene, targets, image, probes, probe_image, {'INDIRECT'})
                pixels[:, :, :3] += extra[:, :, :3]; probe_pixels[:, :, :3] += extra_probes[:, :, :3]
            entry = {'kind': 'dia', 'side': key['side'], 'hour': key['hour'], 'elevationDegrees': key['elevationDegrees'],
                     'daylight': key['daylight'], 'sunStrength': key['sunStrength'], 'sunIrradianceRGB': irradiance.tolist()}
        if not np.isfinite(pixels).all() or not (pixels[:, :, 3] > 0).any():
            raise RuntimeError(f'{key["id"]}: bake vazio ou inválido')
        raw = np.ascontiguousarray(pixels, dtype=np.float32).tobytes(); (out / f'{key["id"]}.f32').write_bytes(raw)
        probe_raw = np.ascontiguousarray(probe_pixels, dtype=np.float32).tobytes(); (out / f'{key["id"]}-sondas.f32').write_bytes(probe_raw)
        entry.update(rawSHA256=sha(raw), probesSHA256=sha(probe_raw), seconds=time.perf_counter() - started, max=float(pixels[:, :, :3].max()))
        measured['keys'][key['id']] = entry
        measured_path.write_text(json.dumps(measured, indent=2), encoding='utf8')
        print('LARANJEIRAS_LUZ_CHAVE', key['id'], json.dumps(entry), flush=True)


if __name__ == '__main__':
    main()

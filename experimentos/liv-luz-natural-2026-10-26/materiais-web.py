"""Converte materiais das cópias de exportação, nunca o .blend aprovado.

Só propriedades do BSDF são rasterizadas. Não há bake de iluminação, AO ou sol.
Materiais Principled com imagens/UV suportados pelo glTF são preservados.
"""
from contextlib import contextmanager
import hashlib
import math
from pathlib import Path
import re

import bpy


CHANNELS = {'basecolor': 'Base Color', 'roughness': 'Roughness',
            'metallic': 'Metallic', 'alpha': 'Alpha'}


def _name(value):
    return re.sub(r'[^a-zA-Z0-9_.-]+', '-', value).strip('-')[:100] or 'material'


def _principled(material):
    return next((n for n in material.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None)


def _flatten_transparent_mix(material):
    """Traduz Transparent/Principled de folhas para Alpha do próprio Principled."""
    if not material.use_nodes:
        return False
    nodes, links = material.node_tree.nodes, material.node_tree.links
    output = next((n for n in nodes if n.type == 'OUTPUT_MATERIAL' and n.is_active_output), None)
    if not output or not output.inputs['Surface'].is_linked:
        return False
    mix = output.inputs['Surface'].links[0].from_node
    if mix.type != 'MIX_SHADER' or not all(mix.inputs[i].is_linked for i in (1, 2)):
        return False
    first, second = [mix.inputs[i].links[0].from_node for i in (1, 2)]
    for index, branch in ((1, first), (2, second)):
        if branch.type != 'ADD_SHADER' or not all(socket.is_linked for socket in branch.inputs):
            continue
        children = [socket.links[0].from_node for socket in branch.inputs]
        if {child.type for child in children} == {'BSDF_PRINCIPLED', 'BSDF_TRANSLUCENT'}:
            principal = next(child for child in children if child.type == 'BSDF_PRINCIPLED')
            links.new(principal.outputs['BSDF'], mix.inputs[index])
            material['WEB_thin_translucency_approximation'] = True
    first, second = [mix.inputs[i].links[0].from_node for i in (1, 2)]
    if {first.type, second.type} != {'BSDF_TRANSPARENT', 'BSDF_PRINCIPLED'}:
        return False
    factor = mix.inputs[0]
    # O truque Is Shadow Ray do vidro não representa opacidade de câmera.
    if factor.is_linked and factor.links[0].from_node.type == 'LIGHT_PATH':
        return False
    bsdf = second if second.type == 'BSDF_PRINCIPLED' else first
    alpha = bsdf.inputs['Alpha']
    previous = alpha.links[0].from_socket if alpha.is_linked else None
    previous_value = alpha.default_value
    value = factor.default_value if second == bsdf else 1 - factor.default_value
    opacity = factor.links[0].from_socket if factor.is_linked else None
    if opacity and first == bsdf:
        invert = nodes.new('ShaderNodeMath')
        invert.operation = 'SUBTRACT'
        invert.inputs[0].default_value = 1
        links.new(opacity, invert.inputs[1])
        opacity = invert.outputs[0]
    if previous or abs(previous_value - 1) > 1e-8:
        multiply = nodes.new('ShaderNodeMath')
        multiply.operation = 'MULTIPLY'
        if opacity:
            links.new(opacity, multiply.inputs[0])
        else:
            multiply.inputs[0].default_value = value
        if previous:
            links.new(previous, multiply.inputs[1])
        else:
            multiply.inputs[1].default_value = previous_value
        opacity = multiply.outputs[0]
    if opacity:
        links.new(opacity, alpha)
    else:
        alpha.default_value = value
    links.new(bsdf.outputs['BSDF'], output.inputs['Surface'])
    return True


def _uv_coordinates(socket, visited=None):
    """Reconhece somente o subconjunto UV que o exportador glTF preserva."""
    if not socket.is_linked:
        return True
    visited = set() if visited is None else visited
    node = socket.links[0].from_node
    if node in visited:
        return False
    visited.add(node)
    if node.type == 'UVMAP':
        return True
    if node.type == 'REROUTE':
        return _uv_coordinates(node.inputs[0], visited)
    if node.type == 'TEX_COORD':
        return socket.links[0].from_socket.name == 'UV'
    if node.type == 'MAPPING':
        return (node.vector_type == 'POINT' and
                not any(node.inputs[key].is_linked for key in ('Location', 'Rotation', 'Scale')) and
                all(abs(value) < 1e-8 for value in node.inputs['Rotation'].default_value[:2]) and
                _uv_coordinates(node.inputs['Vector'], visited))
    return False


def _image_socket(socket, has_uv):
    if not socket.is_linked:
        return True
    node = socket.links[0].from_node
    if node.type in ('SEPRGB', 'SEPARATE_COLOR'):
        return _image_socket(node.inputs[0], has_uv)
    return bool(has_uv and node.type == 'TEX_IMAGE' and node.image and node.projection == 'FLAT' and
                _uv_coordinates(node.inputs['Vector']))


def _normal_socket(socket, has_uv):
    if not socket.is_linked:
        return True
    node = socket.links[0].from_node
    return bool(node.type == 'NORMAL_MAP' and node.space == 'TANGENT' and
                _image_socket(node.inputs['Color'], has_uv) and
                not node.inputs['Strength'].is_linked)


def _plan(material, has_uv):
    if not material.use_nodes:
        return {}, None
    bsdf = _principled(material)
    if not bsdf:
        # A dedicated Emission shader is already glTF-unlit; do not reinterpret it.
        return {}, None
    result = {key: not _image_socket(bsdf.inputs[name], has_uv)
              for key, name in CHANNELS.items()}
    # glTF stores color and opacity in one RGBA texture, so their UV must agree.
    if result['alpha'] or result['basecolor'] and bsdf.inputs['Alpha'].is_linked:
        result['alpha'] = result['basecolor'] = True
    result['normal'] = not _normal_socket(bsdf.inputs['Normal'], has_uv)
    return result, bsdf


def _pin_original_uv(material, original_name):
    if not material.use_nodes:
        return
    nodes, links = material.node_tree.nodes, material.node_tree.links
    if not original_name:
        coordinates = nodes.new('ShaderNodeCombineXYZ')
        coordinates.name = 'WEB | UV ausente original preservado'
        for node in list(nodes):
            if node.type == 'TEX_IMAGE' and not node.inputs['Vector'].is_linked:
                links.new(coordinates.outputs['Vector'], node.inputs['Vector'])
            if node.type == 'TEX_COORD':
                for link in list(node.outputs['UV'].links):
                    links.new(coordinates.outputs['Vector'], link.to_socket)
            if node.type == 'UVMAP':
                for link in list(node.outputs['UV'].links):
                    links.new(coordinates.outputs['Vector'], link.to_socket)
        return
    uv = nodes.new('ShaderNodeUVMap')
    uv.name = 'WEB | UV original preservado'
    uv.uv_map = original_name
    for node in list(nodes):
        if node == uv:
            continue
        if node.type == 'UVMAP' and not node.uv_map:
            node.uv_map = original_name
        if node.type == 'TEX_IMAGE' and not node.inputs['Vector'].is_linked:
            links.new(uv.outputs['UV'], node.inputs['Vector'])
        if node.type == 'TEX_COORD':
            for link in list(node.outputs['UV'].links):
                links.new(uv.outputs['UV'], link.to_socket)


def _unwrap(obj):
    old = obj.data.uv_layers.get('WEB_BAKE')
    if old:
        obj.data.uv_layers.remove(old)
    layer = obj.data.uv_layers.new(name='WEB_BAKE')
    uv_name = str(layer.name)
    obj.data.uv_layers.active = layer
    layer.active_render = True
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=.015,
                            area_weight=0, correct_aspect=True, scale_to_bounds=False)
    bpy.ops.object.mode_set(mode='OBJECT')
    return uv_name


@contextmanager
def _unlit_channel(materials, channel):
    restore = []
    try:
        for material in materials:
            nodes, links = material.node_tree.nodes, material.node_tree.links
            output = next((n for n in nodes if n.type == 'OUTPUT_MATERIAL' and n.is_active_output), None)
            bsdf = _principled(material)
            if not output or not bsdf:
                raise RuntimeError(f'Canal {channel} sem Principled/output: {material.name}')
            emission = nodes.new('ShaderNodeEmission')
            emission.inputs['Strength'].default_value = 1
            source = bsdf.inputs[CHANNELS[channel]]
            if source.is_linked:
                links.new(source.links[0].from_socket, emission.inputs['Color'])
            else:
                value = source.default_value
                emission.inputs['Color'].default_value = value if hasattr(value, '__len__') else (value, value, value, 1)
            previous = [link.from_socket for link in output.inputs['Surface'].links]
            restore.append((material, output, previous, emission))
            links.new(emission.outputs[0], output.inputs['Surface'])
        yield
    finally:
        for material, output, previous, emission in restore:
            material.node_tree.nodes.remove(emission)
            for socket in previous:
                material.node_tree.links.new(socket, output.inputs['Surface'])


def _image(materials, name, size, channel):
    image = bpy.data.images.new(name, width=size, height=size, alpha=False,
                                float_buffer=False)
    image.colorspace_settings.name = 'sRGB' if channel == 'basecolor' else 'Non-Color'
    for material in materials:
        node = material.node_tree.nodes.new('ShaderNodeTexImage')
        node.name = 'WEB | Alvo bake sem luz'
        node.image = image
        material.node_tree.nodes.active = node
        node.select = True
    return image


def _attach(material, bsdf, image, uv_name, channel):
    nodes, links = material.node_tree.nodes, material.node_tree.links
    uv = nodes.new('ShaderNodeUVMap')
    uv.uv_map = uv_name
    texture = nodes.new('ShaderNodeTexImage')
    texture.name = f'WEB | {channel} aprovado'
    texture.image = image
    links.new(uv.outputs['UV'], texture.inputs['Vector'])
    if channel == 'normal':
        normal = nodes.new('ShaderNodeNormalMap')
        normal.space = 'TANGENT'
        normal.uv_map = uv_name
        normal.inputs['Strength'].default_value = 1
        links.new(texture.outputs['Color'], normal.inputs['Color'])
        links.new(normal.outputs['Normal'], bsdf.inputs['Normal'])
    else:
        links.new(texture.outputs['Color'], bsdf.inputs[CHANNELS[channel]])


def _save(image, destination):
    image.filepath_raw = str(destination)
    image.file_format = 'PNG'
    image.save()
    image.pack()
    return {'file': str(destination), 'width': image.size[0], 'height': image.size[1],
            'colorSpace': image.colorspace_settings.name,
            'sha256': hashlib.sha256(destination.read_bytes()).hexdigest()}


def prepare_export_materials(objects, texture_dir, max_size=1024, reuse_existing_uv=False):
    """Converte um grupo de cópias avaliadas ANTES da normalização do asset.

    A cena corrente precisa conter as cópias. A função altera somente seus dados,
    materiais clonados e UV extra, e devolve um relatório serializável. Os planos
    de amostra podem pedir reuse_existing_uv=True para manter somente TEXCOORD_0.
    """
    objects = [obj for obj in objects if obj.type == 'MESH']
    texture_dir = Path(texture_dir)
    texture_dir.mkdir(parents=True, exist_ok=True)
    size = int(max_size)
    if size < 32 or size > 4096:
        raise ValueError('Resolução de textura fora do intervalo32–4096.')
    scene = bpy.context.scene
    saved = {'engine': scene.render.engine, 'samples': scene.cycles.samples,
             'device': scene.cycles.device, 'margin': scene.render.bake.margin,
             'selected_to_active': scene.render.bake.use_selected_to_active,
             'clear': scene.render.bake.use_clear,
             'selected': list(bpy.context.selected_objects), 'active': bpy.context.view_layer.objects.active}
    report = {'objects': [], 'images': [], 'warnings': [], 'bakeLighting': False, 'samples': 1,
              'reuseExistingUV': bool(reuse_existing_uv),
              'converter_sha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest()}
    try:
        scene.render.engine = 'CYCLES'
        scene.cycles.device = 'CPU'
        scene.cycles.samples = 1
        scene.render.bake.margin = 16
        scene.render.bake.use_selected_to_active = False
        scene.render.bake.use_clear = True
        for obj in objects:
            for selected in list(bpy.context.selected_objects):
                selected.select_set(False)
            obj.select_set(True)
            bpy.context.view_layer.objects.active = obj
            # Copiar dados evita mudar UV de outro objeto ou da fonte por referência.
            obj.data = obj.data.copy()
            original_uv = obj.data.uv_layers.active.name if obj.data.uv_layers.active else None
            entries, materials, transparent = [], [], []
            for slot in obj.material_slots:
                if not slot.material:
                    continue
                original = slot.material
                material = original.copy()
                material.name = original.name + ' | WEB'
                slot.material = material
                if _flatten_transparent_mix(material):
                    transparent.append(material.name)
                if material.get('WEB_thin_translucency_approximation'):
                    report['warnings'].append({'material':material.name,'limit':'glTF surface keeps leaf alpha, color and normal maps; separate Translucent BSDF is not portable.'})
                needs, bsdf = _plan(material, bool(original_uv))
                entries.append((material, needs, bsdf))
                materials.append(material)
            channels = [key for key in ('normal', *CHANNELS) if any(needs.get(key) for _, needs, _ in entries)]
            row = {'name': obj.name, 'channels': channels,
                   'originalUV': original_uv,
                   'materials': [material.name for material in materials],
                   'transparentMixToAlpha': transparent}
            report['objects'].append(row)
            if not channels:
                continue
            for material in materials:
                _pin_original_uv(material, original_uv)
            if reuse_existing_uv:
                if not original_uv:
                    raise ValueError(f'UV original ausente para acabamento: {obj.name}')
                uv_name = original_uv
                obj.data.uv_layers.active = obj.data.uv_layers[uv_name]
                obj.data.uv_layers[uv_name].active_render = True
            else:
                uv_name = _unwrap(obj)
            for channel in channels:
                image = _image(materials, 'WEB | ' + obj.name + ' | ' + channel, size, channel)
                print('WEB_MATERIAL_BAKE_BEGIN', obj.name, channel, size, flush=True)
                if channel == 'normal':
                    bpy.ops.object.bake(type='NORMAL', normal_space='TANGENT')
                else:
                    with _unlit_channel(materials, channel):
                        bpy.ops.object.bake(type='EMIT')
                destination = texture_dir / (_name(obj.name) + '-' + channel + '.png')
                info = _save(image, destination)
                info.update({'object': obj.name, 'channel': channel})
                report['images'].append(info)
                for material, needs, bsdf in entries:
                    if needs.get(channel):
                        _attach(material, bsdf, image, uv_name, channel)
                print('WEB_MATERIAL_BAKE_OK', obj.name, channel, flush=True)
        return report
    finally:
        if bpy.context.object and bpy.context.object.mode != 'OBJECT':
            bpy.ops.object.mode_set(mode='OBJECT')
        scene.render.engine = saved['engine']
        scene.cycles.samples = saved['samples']
        scene.cycles.device = saved['device']
        scene.render.bake.margin = saved['margin']
        scene.render.bake.use_selected_to_active = saved['selected_to_active']
        scene.render.bake.use_clear = saved['clear']
        for obj in list(bpy.context.selected_objects):
            obj.select_set(False)
        for obj in saved['selected']:
            if obj.name in bpy.context.view_layer.objects:
                obj.select_set(True)
        if saved['active'] and saved['active'].name in bpy.context.view_layer.objects:
            bpy.context.view_layer.objects.active = saved['active']

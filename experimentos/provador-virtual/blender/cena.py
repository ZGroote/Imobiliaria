"""Utilidades de Blender (bpy): objetos a partir de modelo.Malha, materiais, luz, câmera."""
import math
from pathlib import Path

import bpy
import numpy as np

import modelo


def limpar():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def objeto(nome, malha: modelo.Malha, materiais=(), suave=True):
    v = malha.vertices()
    me = bpy.data.meshes.new(nome)
    me.from_pydata(v.tolist(), [], [list(f) for f in malha.f])
    uv = me.uv_layers.new(name="UVMap")
    flat = [c for face in malha.uv for c in face]
    uv.data.foreach_set("uv", np.asarray(flat, float).ravel())
    me.polygons.foreach_set("material_index", malha.mat)
    me.polygons.foreach_set("use_smooth", [suave] * len(me.polygons))
    for m in materiais:
        me.materials.append(m)
    me.validate(clean_customdata=False)
    ob = bpy.data.objects.new(nome, me)
    bpy.context.scene.collection.objects.link(ob)
    for g, idx in malha.grupos.items():
        vg = ob.vertex_groups.new(name=g)
        vg.add(sorted(set(idx)), 1.0, "REPLACE")
    return ob


def shape_keys(ob, construtor):
    """Base = medidas mínimas; um shape key por medida, do mínimo ao máximo."""
    ob.shape_key_add(name="Basis")
    base = construtor(dict(modelo.MINIMO)).vertices()
    for k in modelo.PARAMS:
        p = dict(modelo.MINIMO)
        p[k] = modelo.FAIXAS[k][1]
        sk = ob.shape_key_add(name=k, from_mix=False)
        alvo = construtor(p).vertices()
        sk.data.foreach_set("co", alvo.ravel())
        sk.slider_min, sk.slider_max = -0.5, 1.5
    return base


def aplicar_medidas(ob, p):
    for k in modelo.PARAMS:
        lo, hi = modelo.FAIXAS[k]
        ob.data.shape_keys.key_blocks[k].value = (p[k] - lo) / (hi - lo)


def _img(caminho, cor=True):
    im = bpy.data.images.load(str(caminho), check_existing=True)
    if not cor:
        im.colorspace_settings.name = "Non-Color"
    return im


def material_tecido(nome, cor, normal, rug, brilho_tecido, forca_normal=1.0):
    m = bpy.data.materials.new(nome)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    tc = nt.nodes.new("ShaderNodeTexImage")
    tc.image = _img(cor)
    tn = nt.nodes.new("ShaderNodeTexImage")
    tn.image = _img(normal, False)
    nm = nt.nodes.new("ShaderNodeNormalMap")
    nm.inputs["Strength"].default_value = forca_normal
    nt.links.new(tc.outputs["Color"], bsdf.inputs["Base Color"])
    nt.links.new(tn.outputs["Color"], nm.inputs["Color"])
    nt.links.new(nm.outputs["Normal"], bsdf.inputs["Normal"])
    bsdf.inputs["Roughness"].default_value = rug
    bsdf.inputs["Sheen Weight"].default_value = brilho_tecido
    bsdf.inputs["Sheen Roughness"].default_value = 0.5
    m.use_backface_culling = False
    return m


def material_liso(nome, rgb, rug, metal=0.0):
    m = bpy.data.materials.new(nome)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*rgb, 1)
    b.inputs["Roughness"].default_value = rug
    b.inputs["Metallic"].default_value = metal
    return m


def materiais_jaqueta(tex: Path):
    denim = material_tecido("Denim", tex / "denim_cor.jpg", tex / "denim_normal.jpg", 0.86, 0.25)
    sherpa = material_tecido("Sherpa", tex / "sherpa_cor.jpg", tex / "sherpa_normal.jpg", 0.95, 0.7, 1.3)
    metal = material_liso("Botao_cobre", (0.62, 0.36, 0.19), 0.38, 1.0)
    forro = material_tecido("Forro_sherpa", tex / "sherpa_cor.jpg", tex / "sherpa_normal.jpg", 0.95, 0.7, 1.3)
    return [denim, sherpa, metal, forro]


def material_manequim():
    return material_liso("Manequim", (0.80, 0.78, 0.75), 0.45)


def uv_forro(malha: modelo.Malha):
    """O forro usa as UVs do atlas do denim; reescala para repetir o sherpa."""
    for i, mt in enumerate(malha.mat):
        if mt == 3:
            malha.uv[i] = [(u * 9.0, v * 10.0) for u, v in malha.uv[i]]


def jaqueta_malha():
    m = modelo.jaqueta(modelo.params_peca())
    uv_forro(m)
    return m


# ------------------------------------------------------------------ estúdio
def estudio(alvo_z=1.1, dist=4.6, lente=70, res=(900, 1200), amostras=64, azimute=-22):
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.cycles.device = "CPU"
    sc.cycles.samples = amostras
    sc.cycles.use_denoising = True
    sc.render.resolution_x, sc.render.resolution_y = res
    sc.view_settings.view_transform = "Standard"
    sc.view_settings.exposure = -0.6
    w = bpy.data.worlds.new("Mundo")
    w.use_nodes = True
    w.node_tree.nodes["Background"].inputs[0].default_value = (0.86, 0.84, 0.80, 1)
    w.node_tree.nodes["Background"].inputs[1].default_value = 0.22
    sc.world = w
    # chão infinito (fundo de estúdio)
    bpy.ops.mesh.primitive_plane_add(size=40, location=(0, 0, 0))
    chao = bpy.context.object
    chao.data.materials.append(material_liso("Chao", (0.78, 0.76, 0.72), 0.8))
    # luzes: principal, preenchimento, recorte
    def luz(nome, loc, energia, tam, cor=(1, 1, 1)):
        d = bpy.data.lights.new(nome, "AREA")
        d.energy, d.size, d.color = energia, tam, cor
        o = bpy.data.objects.new(nome, d)
        o.location = loc
        sc.collection.objects.link(o)
        dirv = np.array([0, 0, alvo_z]) - np.array(loc)
        o.rotation_euler = _olhar(dirv)
        return o
    luz("Principal", (-2.2, -3.0, 2.8), 320, 2.0, (1.0, 0.96, 0.9))
    luz("Preench", (2.6, -2.2, 1.6), 90, 3.0, (0.9, 0.95, 1.0))
    luz("Recorte", (1.0, 3.0, 2.6), 260, 1.5)
    cam = bpy.data.cameras.new("Cam")
    cam.lens = lente
    co = bpy.data.objects.new("Cam", cam)
    a = math.radians(azimute)
    co.location = (dist * math.sin(a), -dist * math.cos(a), alvo_z + 0.15)
    co.rotation_euler = _olhar(np.array([0, 0, alvo_z]) - np.array(co.location))
    sc.collection.objects.link(co)
    sc.camera = co
    return co


def _olhar(d):
    from mathutils import Vector
    return Vector(d).to_track_quat("-Z", "Y").to_euler()


def render(caminho):
    bpy.context.scene.render.filepath = str(caminho)
    bpy.ops.render.render(write_still=True)

# -*- coding: utf-8 -*-
"""Le o dump de tools/exporta_interior.py e monta a MESMA cena no Blender.

Roda dentro do Blender (via MCP). Existe pra isolar UMA variavel: o renderizador.
Geometria, materiais, camera e direcao do sol vem do Three; quem muda e so quem
calcula a luz. As texturas (reboco, piso) NAO vem -- so cor por vertice.

Eixo: Three e Y-cima, Blender e Z-cima. Toda matriz passa por C = Rx(+90).
"""
import base64, json, math, os, bpy
from mathutils import Matrix, Vector, Quaternion

DUMP = os.environ.get("DUMP_INT", r"C:\Users\respawn\AppData\Local\Temp\claude\C--Users-respawn-Desktop-imobiliaria\4494686c-2e50-4973-82b0-2204f852fa15\scratchpad\interior_albedo.json")
SAIDA = os.environ.get("SAIDA_PNG", os.path.join(os.path.dirname(DUMP), "cycles.png"))
AMOSTRAS = int(os.environ.get("AMOSTRAS", "128"))
SOL = float(os.environ.get("SOL", "4.0"))
EXPO = float(os.environ.get("EXPO", "0.0"))
CEU = float(os.environ.get("CEU", "1.0"))   # forca do ceu; o sol e SOL
LUZINT = float(os.environ.get("LUZINT", "0"))  # watts por plafom; 0 = luz apagada

C = Matrix.Rotation(math.radians(90), 4, 'X')   # Three (x,y,z) -> Blender (x,-z,y)


def limpar():
    for ob in list(bpy.data.objects):
        bpy.data.objects.remove(ob, do_unlink=True)
    for c in (bpy.data.meshes, bpy.data.materials, bpy.data.lights, bpy.data.cameras):
        for b in list(c):
            c.remove(b)


def ent(no, nome):
    """Socket por nome ou por identificador -- o nome muda entre versoes do Blender."""
    for s in no.inputs:
        if s.name == nome or s.identifier == nome.replace(" ", ""):
            return s
    return None


WRAP = {1000: 'REPEAT', 1001: 'EXTEND', 1002: 'MIRROR'}


def grava_texturas(d):
    """Salva os PNGs do dump em disco -- o no de imagem do Blender le de arquivo."""
    dst = os.path.join(os.path.dirname(DUMP), "tex")
    os.makedirs(dst, exist_ok=True)
    for t in d.get("texturas", {}).values():
        if not t.get("png"):
            continue
        f = os.path.join(dst, t["id"] + ".png")
        with open(f, "wb") as h:
            h.write(base64.b64decode(t["png"].split(",", 1)[1]))
        t["arq"] = f
    return d.get("texturas", {})


def no_textura(nt, tex, saida_de_uv=None):
    """Image Texture ligada ao UV, com wrap e escala do Three."""
    n = nt.nodes.new("ShaderNodeTexImage")
    img = bpy.data.images.load(tex["arq"], check_existing=True)
    img.colorspace_settings.name = 'sRGB' if tex["cs"] == "srgb" else 'Non-Color'
    n.image = img
    n.extension = WRAP.get(tex["wrap"][0], 'REPEAT')
    if tex["rep"] != [1, 1] or tex["off"] != [0, 0]:
        mp = nt.nodes.new("ShaderNodeMapping")
        uv = nt.nodes.new("ShaderNodeUVMap"); uv.uv_map = "UVMap"
        mp.inputs["Scale"].default_value = (tex["rep"][0], tex["rep"][1], 1.0)
        mp.inputs["Location"].default_value = (tex["off"][0], tex["off"][1], 0.0)
        nt.links.new(uv.outputs["UV"], mp.inputs["Vector"])
        nt.links.new(mp.outputs["Vector"], n.inputs["Vector"])
    return n


def material(i, mt, texs):
    m = bpy.data.materials.new("mat%02d" % i)
    m.use_nodes = True
    nt = m.node_tree
    p = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    ent(p, "Base Color").default_value = tuple(mt["cor"]) + (1.0,)
    ent(p, "Roughness").default_value = mt["rug"]
    ent(p, "Metallic").default_value = mt["met"]
    # O Three faz cor_do_material x map x cor_por_vertice. Aqui e a mesma conta,
    # com um MULTIPLY entre a textura e a cor por vertice quando existem as duas.
    fontes = []
    tx = texs.get(mt.get("map")) if mt.get("map") else None
    if tx and tx.get("arq"):
        fontes.append(no_textura(nt, tx).outputs["Color"])
    if mt["vcor"]:
        n = nt.nodes.new("ShaderNodeVertexColor")
        n.layer_name = "Col"
        fontes.append(n.outputs["Color"])
    if len(fontes) == 2:
        mix = nt.nodes.new("ShaderNodeMix")
        mix.data_type = 'RGBA'
        mix.blend_type = 'MULTIPLY'
        mix.inputs[0].default_value = 1.0
        nt.links.new(fontes[0], mix.inputs[6])
        nt.links.new(fontes[1], mix.inputs[7])
        nt.links.new(mix.outputs[2], ent(p, "Base Color"))
    elif fontes:
        nt.links.new(fontes[0], ent(p, "Base Color"))
    if mt["op"] < 1.0:
        ent(p, "Alpha").default_value = mt["op"]
        try:
            m.blend_method = 'BLEND'
        except Exception:
            pass
    e = mt["emis"]
    if max(e) > 0.001:
        (ent(p, "Emission Color") or ent(p, "Emission")).default_value = tuple(e) + (1.0,)
        ent(p, "Emission Strength").default_value = 1.0
    return m


def montar(d):
    limpar()
    texs = grava_texturas(d)
    for i, md in enumerate(d["meshes"]):
        pos, idx = md["pos"], md["idx"]
        bruto = [(pos[k], pos[k+1], pos[k+2]) for k in range(0, len(pos), 3)]
        if idx:
            tri = [(idx[k], idx[k+1], idx[k+2]) for k in range(0, len(idx), 3)]
        else:
            tri = [(k, k+1, k+2) for k in range(0, len(bruto), 3)]
        # A malha vem do Three NAO INDEXADA: cada triangulo traz os proprios 3
        # vertices, e nada e compartilhado. Assim ela nao e uma superficie, e um monte
        # de cacos -- e assar isso da irradiancia descontinua de um triangulo pro
        # vizinho, que aparece como cunha de quina viva na parede. Solda-se aqui, na
        # construcao, e nao com `remove_doubles`: aquele e single-thread e engasga com
        # coordenada na casa dos milhares (medido: 0,6 nucleo e nao terminava).
        # Cor e UV vivem no CANTO, entao juntar posicao nao mistura material.
        # A chave leva a UV junto. So posicao junta demais: duas faces perpendiculares
        # dividem a quina mas tem UV descontinua ali, e soldar as duas faz a
        # subdivisao INTERPOLAR a UV atravessando a quina -- o defeito aparece como
        # uma grade de linhas escuras em toda junta de face. Com a UV na chave,
        # solda-se o que e continuo (a parede plana, que era onde faltava luz
        # continua) e mantem-se separado o que e quina de verdade.
        uvd = md.get("uv")
        mapa, vs, para = {}, [], [0] * len(bruto)
        for i, v in enumerate(bruto):
            # SEM arredondar: o dump ja veio quantizado, e arredondar de novo em
            # coordenada da ordem de 1.600 cai abaixo da precisao de float32 e solda
            # vertice que nao era coincidente.
            k = (v[0], v[1], v[2])
            if uvd:
                k += (uvd[i*2], uvd[i*2+1])
            j = mapa.get(k)
            if j is None:
                j = len(vs); vs.append(v); mapa[k] = j
            para[i] = j
        # `orig` guarda, canto a canto e na MESMA ordem em que as faces entram, qual
        # era o vertice ORIGINAL. Sem isso a UV e a cor teriam que sair de um
        # representante arbitrario do grupo soldado -- e como UV vive no CANTO, o
        # resultado e costura preta em toda junta de face.
        fs, orig = [], []
        for a_, b_, c_ in tri:
            f = (para[a_], para[b_], para[c_])
            if len(set(f)) == 3:              # solda pode degenerar triangulo fino
                fs.append(f)
                orig += [a_, b_, c_]
        me = bpy.data.meshes.new("m%02d" % i)
        me.from_pydata(vs, [], fs)
        me.update()
        cor = md["cor"]
        if cor:
            n = len(cor) // len(bruto)       # 3 (RGB) ou 4 (RGBA)
            lay = me.color_attributes.new("Col", 'FLOAT_COLOR', 'CORNER')
            for lp in me.loops:
                b = orig[lp.index] * n
                lay.data[lp.index].color = (cor[b], cor[b+1], cor[b+2],
                                            cor[b+3] if n == 4 else 1.0)
        ob = bpy.data.objects.new("m%02d" % i, me)
        bpy.context.collection.objects.link(ob)
        mw = md["mw"]
        W = Matrix([[mw[0], mw[4], mw[8],  mw[12]],
                    [mw[1], mw[5], mw[9],  mw[13]],
                    [mw[2], mw[6], mw[10], mw[14]],
                    [mw[3], mw[7], mw[11], mw[15]]])
        ob.matrix_world = C @ W
        uv = md.get("uv")
        if uv:
            lay = me.uv_layers.new(name="UVMap")
            for lp in me.loops:
                b = orig[lp.index] * 2
                lay.data[lp.index].uv = (uv[b], uv[b + 1])
        if md["mat"]:
            ob.data.materials.append(material(i, md["mat"], texs))
        # PLANO, nao suave. A casa e feita de prismas: parede, laje e forro sao faces
        # planas. Marcar como suave faz a normal ser interpolada ao longo da DIAGONAL
        # do quadrilatero -- no render isso passa por gradiente, mas no BAKE vira
        # faixa diagonal atravessando a parede, porque o hemisferio amostrado inclina.
        for pg in me.polygons:
            pg.use_smooth = False

    # camera: mesma posicao, mesma rotacao, mesmo FOV vertical
    c = d["cam"]
    cam = bpy.data.cameras.new("Cam")
    cam.sensor_fit = 'VERTICAL'
    cam.angle_y = math.radians(c["fov"])
    cam.clip_start, cam.clip_end = c["near"], 200.0
    co = bpy.data.objects.new("Cam", cam)
    bpy.context.collection.objects.link(co)
    q = c["quat"]                                    # Three: [x,y,z,w]
    W = Quaternion((q[3], q[0], q[1], q[2])).to_matrix().to_4x4()
    W.translation = Vector(c["pos"])
    co.matrix_world = C @ W
    bpy.context.scene.camera = co

    # sol: a MESMA direcao da DirectionalLight do Three
    dl = [l for l in d["luzes"] if l["tipo"] == "DirectionalLight"][0]
    p, a = Vector(dl["pos"]), Vector(dl["alvo"] or [0, 0, 0])
    dv = (C @ (a - p).to_4d()).to_3d().normalized()  # direcao que a luz VIAJA
    lz = bpy.data.lights.new("Sol", 'SUN')
    lz.energy = SOL
    lz.color = dl["cor"]
    lz.angle = math.radians(0.53)                    # disco solar real: sombra macia
    lo = bpy.data.objects.new("Sol", lz)
    bpy.context.collection.objects.link(lo)
    lo.rotation_mode = 'QUATERNION'
    lo.rotation_quaternion = Vector((0, 0, -1)).rotation_difference(dv)
    # Os plafons vem do dump com intensidade 0 (e dia, a luz esta apagada). Pra foto
    # de anuncio acende-se a luz -- LUZINT e a potencia em watts de cada um.
    if LUZINT > 0:
        vistos = set()
        pontuais = []
        for l in d["luzes"]:                     # o pool repete o mesmo plafom 4x
            if l["tipo"] != "PointLight":
                continue
            k = tuple(round(v, 2) for v in l["pos"])
            if k not in vistos:
                vistos.add(k); pontuais.append(l)
        for j, pl in enumerate(pontuais):
            pz = bpy.data.lights.new("Plafom%d" % j, 'POINT')
            pz.energy = LUZINT
            pz.color = pl["cor"]
            pz.shadow_soft_size = 0.06
            po = bpy.data.objects.new("Plafom%d" % j, pz)
            bpy.context.collection.objects.link(po)
            po.matrix_world = C @ Matrix.Translation(Vector(pl["pos"]))

    bpy.context.scene.world = ceu(-dv)
    return co


def ceu(para_o_sol):
    w = bpy.data.worlds.new("Ceu")
    w.use_nodes = True
    nt = w.node_tree
    for n in list(nt.nodes):
        if n.type != 'OUTPUT_WORLD':
            nt.nodes.remove(n)
    bg = nt.nodes.new("ShaderNodeBackground")
    bg.inputs["Strength"].default_value = CEU
    sky = nt.nodes.new("ShaderNodeTexSky")
    tipos = [i.identifier for i in
             sky.bl_rna.properties['sky_type'].enum_items]          # muda por versao
    sky.sky_type = ('MULTIPLE_SCATTERING' if 'MULTIPLE_SCATTERING' in tipos
                    else 'NISHITA' if 'NISHITA' in tipos else tipos[0])
    sky.sun_direction = para_o_sol
    sky.sun_disc = False
    nt.links.new(sky.outputs[0], bg.inputs[0])
    out = next(n for n in nt.nodes if n.type == 'OUTPUT_WORLD')
    nt.links.new(bg.outputs[0], out.inputs["Surface"])
    return w


def render():
    s = bpy.context.scene
    s.render.engine = 'CYCLES'
    try:
        s.cycles.device = 'GPU'
    except Exception:
        pass
    s.cycles.samples = AMOSTRAS
    s.cycles.use_denoising = True
    s.render.resolution_x = 1280
    s.render.resolution_y = int(round(1280 / 1.9007518796992482))
    s.render.resolution_percentage = 100
    s.render.image_settings.file_format = 'PNG'
    s.view_settings.view_transform = 'AgX'
    s.view_settings.exposure = EXPO
    s.render.filepath = SAIDA
    bpy.ops.render.render(write_still=True)


d = json.load(open(DUMP, encoding="utf-8"))
montar(d)
render()
print("OK %s  meshes=%d" % (SAIDA, len(d["meshes"])))

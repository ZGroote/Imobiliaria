"""Veste qualquer tipologia do Liv por regra e renderiza as vistas de conferência no Cycles.

Uso (na raiz do repositório):
  blender -b experimentos/liv-experimental-2026-10-14/interiores/<tipologia>/bake/interior-source.blend \
    --python experimentos/liv-experimental-2026-10-14/piloto-render/montar_apartamento.py -- \
    --saida <pasta> [--amostras 24] [--res 640x360] [--vistas suite,v1] [--cameras arquivo.json] [--sem-render]

Generaliza montar_sala.py (o piloto do Meio, escrito à mão): nenhuma coordenada é da tipologia. Tudo sai
do cadastro (`interiores/<tipologia>/unidade.json`: cômodos, móveis com rumo, janelas e portas) e de
raios lançados na cena (parede atrás de um móvel, altura do colchão, ponto livre). Regras por TIPO de
móvel e de cômodo; os números de acabamento são os do piloto aprovado.

--cameras troca as vistas derivadas por {nome: [[olho], [alvo]]} (para comparar com outra cena).
Grava <saida>/<vista>.png, <saida>/apartamento.blend e <saida>/cameras.json. A cena guarda os cômodos
em `liv_comodos` para o capturar_splat.py derivar as zonas.
"""
import bpy, bmesh, json, math, os, random, re, sys
from mathutils import Vector, Matrix

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
import planta as P

RAIZ = os.path.abspath(os.path.join(AQUI, "..", "..", ".."))
TEX = os.path.join(RAIZ, "publicacao", "piloto-qualidade-visual-2026-10-04", "materiais-v2", "originais")
SOFA_GEN = os.path.join(RAIZ, "blender", "sofa_generator.py")

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
def arg(nome, padrao):
    return argv[argv.index(nome) + 1] if nome in argv else padrao
BLEND = bpy.data.filepath
UNIDADE = arg("--unidade", os.path.join(os.path.dirname(os.path.dirname(BLEND)), "unidade.json"))
SAIDA = os.path.abspath(arg("--saida", os.path.join(AQUI, "apartamento")))
AMOSTRAS = int(arg("--amostras", "24"))
RES = [int(v) for v in arg("--res", "640x360").split("x")]
os.makedirs(SAIDA, exist_ok=True)
random.seed(7)
PL = P.carregar(UNIDADE)
PE = PL.pe_direito
cena = bpy.context.scene
Z = Vector((0, 0, 1))
V = lambda xy, z=0.0: Vector((xy[0], xy[1], z))

# Tudo o que o script cria fica em coleções excluídas até o render: os raios só veem a cena original.
col = bpy.data.collections.new("Vestido"); cena.collection.children.link(col)
def excluir(colecao, sim):
    bpy.context.view_layer.layer_collection.children[colecao.name].exclude = sim
excluir(col, True)

# ---------------------------------------------------------------- materiais (os do piloto)
def principled(m):
    return next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")

def entrada(no, *nomes):
    for n in nomes:
        if n in no.inputs: return no.inputs[n]
    raise KeyError(nomes)

def novo_mat(nome):
    m = bpy.data.materials.new(nome); m.use_nodes = True
    return m

def imagem(nt, arquivo, cor=True):
    t = nt.nodes.new("ShaderNodeTexImage")
    t.image = bpy.data.images.load(os.path.join(TEX, arquivo), check_existing=True)
    t.image.colorspace_settings.name = "sRGB" if cor else "Non-Color"
    t.projection = "BOX"; t.projection_blend = 0.25
    return t

def mat_textura(m, base, escala, tinta=(1, 1, 1), rug=(0.0, 1.0), relevo=0.08):
    """Textura em escala física (metros por repetição) por projeção em caixa no espaço do mundo."""
    nt = m.node_tree; b = principled(m)
    geo = nt.nodes.new("ShaderNodeNewGeometry")
    mp = nt.nodes.new("ShaderNodeMapping"); mp.inputs["Scale"].default_value = (1 / escala,) * 3
    nt.links.new(geo.outputs["Position"], mp.inputs["Vector"])
    c = imagem(nt, base + "-color.jpg"); r = imagem(nt, base + "-roughness.png", False)
    for t in (c, r): nt.links.new(mp.outputs["Vector"], t.inputs["Vector"])
    mix = nt.nodes.new("ShaderNodeMix"); mix.data_type = "RGBA"; mix.blend_type = "MULTIPLY"
    mix.inputs["Factor"].default_value = 1.0; mix.inputs["B"].default_value = (*tinta, 1)
    nt.links.new(c.outputs["Color"], mix.inputs["A"]); nt.links.new(mix.outputs["Result"], entrada(b, "Base Color"))
    mr = nt.nodes.new("ShaderNodeMapRange"); mr.inputs["To Min"].default_value, mr.inputs["To Max"].default_value = rug
    nt.links.new(r.outputs["Color"], mr.inputs["Value"]); nt.links.new(mr.outputs["Result"], entrada(b, "Roughness"))
    bp = nt.nodes.new("ShaderNodeBump"); bp.inputs["Strength"].default_value = relevo
    nt.links.new(c.outputs["Color"], bp.inputs["Height"]); nt.links.new(bp.outputs["Normal"], entrada(b, "Normal"))
    return m

def mat_liso(m, cor, rug=0.5, metal=0.0, coat=0.0):
    b = principled(m)
    entrada(b, "Base Color").default_value = (*cor, 1); entrada(b, "Roughness").default_value = rug
    entrada(b, "Metallic").default_value = metal; entrada(b, "Coat Weight").default_value = coat
    return m

def mat_marmore(nome):
    m = novo_mat(nome); nt = m.node_tree; b = principled(m)
    geo = nt.nodes.new("ShaderNodeNewGeometry")
    wv = nt.nodes.new("ShaderNodeTexWave"); wv.inputs["Scale"].default_value = 0.9
    wv.inputs["Distortion"].default_value = 14; wv.inputs["Detail"].default_value = 10
    wv.inputs["Detail Scale"].default_value = 1.6
    nt.links.new(geo.outputs["Position"], wv.inputs["Vector"])
    cr = nt.nodes.new("ShaderNodeValToRGB"); e = cr.color_ramp.elements
    e[0].position, e[0].color = 0.0, (0.30, 0.29, 0.28, 1); e[1].position, e[1].color = 0.12, (0.93, 0.92, 0.90, 1)
    nt.links.new(wv.outputs["Fac"], cr.inputs["Fac"]); nt.links.new(cr.outputs["Color"], entrada(b, "Base Color"))
    entrada(b, "Roughness").default_value = 0.12; entrada(b, "Coat Weight").default_value = 0.4
    return m

def mat_vidro(nome):
    """Vidro que deixa o sol passar: raio de sombra vê transparência (sem cáustica)."""
    m = novo_mat(nome); nt = m.node_tree; out = next(n for n in nt.nodes if n.type == "OUTPUT_MATERIAL")
    g = nt.nodes.new("ShaderNodeBsdfGlass"); g.inputs["Roughness"].default_value = 0.0; g.inputs["IOR"].default_value = 1.5
    t = nt.nodes.new("ShaderNodeBsdfTransparent"); lp = nt.nodes.new("ShaderNodeLightPath")
    mx = nt.nodes.new("ShaderNodeMixShader")
    nt.links.new(lp.outputs["Is Shadow Ray"], mx.inputs[0]); nt.links.new(g.outputs[0], mx.inputs[1])
    nt.links.new(t.outputs[0], mx.inputs[2]); nt.links.new(mx.outputs[0], out.inputs["Surface"])
    return m

def mat_emissor(nome, cor, forca):
    m = novo_mat(nome); b = principled(m)
    entrada(b, "Base Color").default_value = (*cor, 1)
    entrada(b, "Emission Color").default_value = (*cor, 1); entrada(b, "Emission Strength").default_value = forca
    return m

def mat_por_altura(nome, baixo, alto, z):
    """Um objeto, dois acabamentos: acima de z (tampo) usa `alto`."""
    m = novo_mat(nome); nt = m.node_tree; out = next(n for n in nt.nodes if n.type == "OUTPUT_MATERIAL")
    nt.nodes.remove(principled(m))
    geo = nt.nodes.new("ShaderNodeNewGeometry"); sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    gt = nt.nodes.new("ShaderNodeMath"); gt.operation = "GREATER_THAN"; gt.inputs[1].default_value = z
    nt.links.new(geo.outputs["Position"], sep.inputs[0]); nt.links.new(sep.outputs["Z"], gt.inputs[0])
    mx = nt.nodes.new("ShaderNodeMixShader"); nt.links.new(gt.outputs[0], mx.inputs[0])
    for i, src in ((1, baixo), (2, alto)):
        g = nt.nodes.new("ShaderNodeGroup"); grp = bpy.data.node_groups.new(src.name + "_grp", "ShaderNodeTree")
        grp.interface.new_socket("Shader", in_out="OUTPUT", socket_type="NodeSocketShader")
        mapa = {}
        for n in src.node_tree.nodes:
            if n.type == "OUTPUT_MATERIAL": continue
            c = grp.nodes.new(n.bl_idname); mapa[n.name] = c
            for attr in ("operation", "data_type", "blend_type", "projection", "projection_blend", "image"):
                if hasattr(n, attr): setattr(c, attr, getattr(n, attr))
            if n.type == "VALTORGB":
                for k, el in enumerate(n.color_ramp.elements):
                    e2 = c.color_ramp.elements[k] if k < len(c.color_ramp.elements) else c.color_ramp.elements.new(el.position)
                    e2.position, e2.color = el.position, el.color
            for a, b2 in zip(n.inputs, c.inputs):
                if hasattr(a, "default_value") and not a.is_linked:
                    try: b2.default_value = a.default_value
                    except Exception: pass
        go = grp.nodes.new("NodeGroupOutput")
        for l in src.node_tree.links:
            if l.to_node.type == "OUTPUT_MATERIAL":
                grp.links.new(mapa[l.from_node.name].outputs[l.from_socket.identifier], go.inputs[0])
            else:
                fo = next(s for s in mapa[l.from_node.name].outputs if s.identifier == l.from_socket.identifier)
                ti = next(s for s in mapa[l.to_node.name].inputs if s.identifier == l.to_socket.identifier)
                grp.links.new(fo, ti)
        g.node_tree = grp; nt.links.new(g.outputs[0], mx.inputs[i])
    nt.links.new(mx.outputs[0], out.inputs["Surface"])
    return m

M = bpy.data.materials
# Arquitetura: o exportador do Liv nomeia m0 parede/forro, m1 piso de madeira, m2 piso frio,
# m3 portas, m4 caixilhos, m5 vidro (igual no Meio e no Canto; conferido pela rugosidade no source.json).
mat_liso(M["m0"], (0.86, 0.83, 0.78), rug=0.9)
mat_textura(M["m1"], "madeira", 1.8, tinta=(0.95, 0.85, 0.75), rug=(0.25, 0.55), relevo=0.05)
mat_textura(M["m2"], "frio", 0.9, tinta=(0.92, 0.9, 0.87), rug=(0.2, 0.4), relevo=0.02)
NOGUEIRA = mat_textura(novo_mat("Nogueira"), "madeira_movel", 1.2, tinta=(0.85, 0.7, 0.55), rug=(0.35, 0.6), relevo=0.04)
FREIJO = mat_textura(novo_mat("Freijo"), "madeira_movel", 1.2, tinta=(1.05, 0.92, 0.8), rug=(0.35, 0.6), relevo=0.04)
MARMORE = mat_marmore("Marmore")
LINHO = mat_liso(novo_mat("Linho cru"), (0.82, 0.76, 0.66), rug=0.95)   # a textura "tecido" é xadrez: só lisos
BOUCLE = mat_liso(novo_mat("Boucle"), (0.86, 0.82, 0.75), rug=0.95)
TAPETE = mat_liso(novo_mat("Tapete la"), (0.74, 0.68, 0.6), rug=1.0)
PRETO = mat_liso(novo_mat("Metal preto"), (0.02, 0.02, 0.02), rug=0.35, metal=1.0)
INOX = mat_liso(novo_mat("Inox"), (0.75, 0.74, 0.72), rug=0.28, metal=1.0)
LATAO = mat_liso(novo_mat("Latao"), (0.85, 0.66, 0.38), rug=0.25, metal=1.0)
CERAMICA = mat_liso(novo_mat("Ceramica"), (0.86, 0.82, 0.76), rug=0.45, coat=0.3)
TERRACOTA = mat_liso(novo_mat("Terracota"), (0.55, 0.30, 0.20), rug=0.8)
ROUPA = mat_liso(novo_mat("Roupa de cama"), (0.9, 0.89, 0.86), rug=0.95)
PAINEL = mat_liso(novo_mat("Painel estofado"), (0.72, 0.66, 0.58), rug=0.95)
LOUCA = mat_liso(novo_mat("Louca"), (0.93, 0.93, 0.92), rug=0.08, coat=0.5)
ESMALTE = mat_liso(novo_mat("Esmalte"), (0.9, 0.9, 0.89), rug=0.3)
ESPELHO = mat_liso(novo_mat("Espelho"), (0.92, 0.92, 0.92), rug=0.02, metal=1.0)
LED = mat_emissor("LED 2700K", (1.0, 0.72, 0.42), 9.0)
TELA = mat_emissor("Tela TV", (0.05, 0.07, 0.1), 0.25)
VIDRO = mat_vidro("Vidro")
FOLHA = mat_liso(novo_mat("Folha"), (0.06, 0.16, 0.05), rug=0.45)
entrada(principled(FOLHA), "Subsurface Weight").default_value = 0.25
VOIL = novo_mat("Voil"); vb = principled(VOIL)
entrada(vb, "Base Color").default_value = (0.95, 0.92, 0.86, 1); entrada(vb, "Roughness").default_value = 0.9
entrada(vb, "Transmission Weight").default_value = 0.55
MANTAS = [mat_liso(novo_mat("Manta"), c, rug=1.0) for c in ((0.62, 0.42, 0.32), (0.55, 0.62, 0.52))]
mat_liso(M["m3"], (0.92, 0.9, 0.86), rug=0.4)             # portas e batentes
mat_liso(M["m4"], (0.12, 0.12, 0.12), rug=0.4, metal=0.6)  # caixilhos
M["m5"].user_remap(VIDRO)                                 # vidro opaco -> vidro real

_altura = {}
def por_altura(nome, baixo, alto, z):
    chave = (nome, round(z, 3))
    if chave not in _altura: _altura[chave] = mat_por_altura(nome, baixo, alto, z)
    return _altura[chave]

# ---------------------------------------------------------------- geometria auxiliar
def giro(n):
    """Rotação em z que leva o eixo local +y para n (x local vira o lado)."""
    return math.atan2(-n.x, n.y)

def caixa(nome, dim, centro, mat, bevel=0.004, n=None):
    """dim = (largura ao longo do lado, profundidade ao longo de n, altura); sem n, eixos do mundo."""
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1.0)
    me = bpy.data.meshes.new(nome); bm.to_mesh(me); bm.free()
    me.transform(Matrix.Diagonal((*dim, 1.0)))
    ob = bpy.data.objects.new(nome, me); col.objects.link(ob); ob.location = centro
    if n is not None: ob.rotation_euler = (0, 0, giro(n))
    me.materials.append(mat)
    if bevel:
        bv = ob.modifiers.new("Bevel", "BEVEL"); bv.width = bevel; bv.segments = 2
    return ob

def esfera(nome, r, centro, mat, escala=(1, 1, 1)):
    bm = bmesh.new(); bmesh.ops.create_uvsphere(bm, u_segments=24, v_segments=16, radius=r)
    me = bpy.data.meshes.new(nome); bm.to_mesh(me); bm.free()
    for p in me.polygons: p.use_smooth = True
    ob = bpy.data.objects.new(nome, me); col.objects.link(ob); ob.location = centro; ob.scale = escala
    me.materials.append(mat); return ob

def cilindro(nome, r, h, base, mat, r_topo=None, seg=32):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=r, radius2=r_topo if r_topo is not None else r, depth=h)
    me = bpy.data.meshes.new(nome); bm.to_mesh(me); bm.free()
    for p in me.polygons: p.use_smooth = True
    ob = bpy.data.objects.new(nome, me); col.objects.link(ob)
    ob.location = (base[0], base[1], base[2] + h / 2); me.materials.append(mat); return ob

def luz(nome, tipo, centro, energia, cor=(1.0, 0.75, 0.5), **kw):
    d = bpy.data.lights.new(nome, tipo); d.energy = energia; d.color = cor
    for k, v in kw.items(): setattr(d, k, v)
    ob = bpy.data.objects.new(nome, d); col.objects.link(ob); ob.location = centro; return ob

def planta(nome, base, altura, folhas=22, larg=0.10, vaso=CERAMICA, r_vaso=0.16):
    cilindro(nome + " vaso", r_vaso, r_vaso * 2.0, base, vaso, r_topo=r_vaso * 1.15)
    topo_v = base[2] + r_vaso * 2.0
    for i in range(folhas):
        h = topo_v + altura * (0.25 + 0.75 * random.random())
        ang = random.uniform(0, 2 * math.pi); raio_f = random.uniform(0.05, 0.35) * altura / 1.2
        f = esfera(f"{nome} folha {i}", 1.0, (base[0] + math.cos(ang) * raio_f, base[1] + math.sin(ang) * raio_f, h),
                   FOLHA, escala=(larg, larg * 2.4, 0.006))
        f.rotation_euler = (random.uniform(0.6, 1.2), 0, ang - math.pi / 2)
        cilindro(f"{nome} haste {i}", 0.006, h - topo_v, (base[0] + math.cos(ang) * raio_f * 0.5,
                 base[1] + math.sin(ang) * raio_f * 0.5, topo_v), FOLHA, seg=6)

def cortina(nome, p0, p1, n, mat, ondas=3, amp=0.05):
    """Painel franzido de p0 a p1 (mundo, xy), ondulando ao longo de n, do piso ao forro."""
    k = ondas * 8; bm = bmesh.new(); vs = []
    for i in range(k + 1):
        t = i / k; q = p0.lerp(p1, t) + n * amp * math.sin(t * ondas * 2 * math.pi)
        vs.append((bm.verts.new((q.x, q.y, 0.03)), bm.verts.new((q.x, q.y, PE - 0.04))))
    for i in range(k):
        bm.faces.new((vs[i][0], vs[i + 1][0], vs[i + 1][1], vs[i][1]))
    me = bpy.data.meshes.new(nome); bm.to_mesh(me); bm.free()
    for p in me.polygons: p.use_smooth = True
    ob = bpy.data.objects.new(nome, me); col.objects.link(ob); me.materials.append(mat)
    ob.modifiers.new("Esp", "SOLIDIFY").thickness = 0.004
    return ob

def abajur(nome, base):
    x, y, z = base
    cilindro(nome + " base", 0.055, 0.24, (x, y, z), CERAMICA, r_topo=0.035)
    cilindro(nome + " cupula", 0.14, 0.2, (x, y, z + 0.24), mat_emissor(nome + " tecido", (1.0, 0.82, 0.62), 2.2), r_topo=0.1)
    luz(nome + " luz", "POINT", (x, y, z + 0.33), 10, shadow_soft_size=0.08)

def spot(nome, xy):
    luz(nome, "SPOT", (xy[0], xy[1], PE - 0.04), 35, spot_size=math.radians(70), spot_blend=0.6, shadow_soft_size=0.03)
    cilindro(nome + " aro", 0.045, 0.01, (xy[0], xy[1], PE - 0.015), mat_emissor(nome + " emissor", (1.0, 0.8, 0.6), 4.0))

# ---------------------------------------------------------------- raios na cena original
def raio(p, d, longe=50.0):
    ok, loc, *_ = cena.ray_cast(bpy.context.evaluated_depsgraph_get(), p, d, distance=longe)
    return (loc - p).length if ok else longe

def parede(p, d):
    """Parede no rumo d a partir de p: (ponto na face, normal para dentro)."""
    ok, loc, *_ = cena.ray_cast(bpy.context.evaluated_depsgraph_get(), p, d, distance=3.0)
    if not ok: loc = p + d * 0.5
    return loc, -d

def parede_atras(obs, z=1.4):
    """Parede mais próxima de um móvel encostado (o lavatório do piloto): (ponto na parede, normal para dentro)."""
    c = caixa_de(obs)[0]; c = Vector((c.x, c.y, z)); melhor = None
    for d in (Vector((1, 0, 0)), Vector((-1, 0, 0)), Vector((0, 1, 0)), Vector((0, -1, 0))):
        p = c
        for _ in range(4):   # atravessa o próprio móvel (o lavatório do Canto tem espelho na peça)
            ok, loc, _n, _i, ob, _m = cena.ray_cast(bpy.context.evaluated_depsgraph_get(), p, d, distance=1.0)
            if not (ok and ob in obs): break
            p = loc + d * 0.002
        if ok and (melhor is None or (loc - c).length < (melhor[0] - c).length):
            melhor = (loc, -d)
    return melhor

def topo(xy):
    """Altura da primeira superfície abaixo de (x, y): o colchão, não o chute."""
    ok, loc, *_ = cena.ray_cast(bpy.context.evaluated_depsgraph_get(), V(xy, PE - 0.2), Vector((0, 0, -1)))
    return loc.z if ok else 0.0

def livre(xy, folga=0.25, zs=(0.3, 1.0)):
    """Chão à vista (nada em cima) e nada a menos de `folga` em volta."""
    if topo(xy) > 0.06: return False
    return all(raio(V(xy, z), Vector((math.cos(a), math.sin(a), 0))) >= folga
               for z in zs for a in [k * math.pi / 4 for k in range(8)])

PORTAS = [Vector(PL.mundo(a["p"])) for a in PL.p.get("portas", [])]
def cantos_livres(comodo, recuo=0.35):
    """Cantos do cômodo com chão livre, longe da passagem das portas."""
    for v in comodo["poly"]:
        dentro = [q for q in ((v[0] + sx * recuo, v[1] + sy * recuo) for sx in (1, -1) for sy in (1, -1))
                  if P.dentro(q, comodo["poly"])]
        if len(dentro) != 1: continue          # quina para dentro do cômodo (parede saliente) não é canto
        q = dentro[0]
        if all((Vector(q) - p).length > 0.9 for p in PORTAS) and livre(q): yield Vector(q)

def caixa_de(obs):
    vs = [o.matrix_world @ Vector(c) for o in obs for c in o.bound_box]
    mn = Vector([min(v[i] for v in vs) for i in range(3)]); mx = Vector([max(v[i] for v in vs) for i in range(3)])
    return (mn + mx) / 2, mn, mx

# ---------------------------------------------------------------- móveis do cadastro <-> objetos da cena
ARQ = re.compile(r"^m\d+$")
def base_mat(nome): return re.sub(r"\.\d+$", "", nome)

MOVEIS = list(PL.moveis())
for m in MOVEIS:
    m["obs"] = []
    hx, hy = (m["d"] / 2, m["w"] / 2) if m["costas"][0] else (m["w"] / 2, m["d"] / 2)
    m["meia"] = (hx + 0.12, hy + 0.12)
for ob in list(cena.objects):
    if ob.type != "MESH": continue
    mats = [s.material.name for s in ob.material_slots if s.material]
    if not mats or all(ARQ.match(n) or n == VIDRO.name for n in mats) or ob.name.startswith(("forro", "rodateto", "plafon")): continue
    c = caixa_de([ob])[0]
    cand = [m for m in MOVEIS if abs(c.x - m["centro"][0]) <= m["meia"][0] and abs(c.y - m["centro"][1]) <= m["meia"][1]]
    if not cand:
        print("SEM MOVEL NO CADASTRO", ob.name, mats); continue
    min(cand, key=lambda m: (c.x - m["centro"][0]) ** 2 + (c.y - m["centro"][1]) ** 2)["obs"].append(ob)

POR_TIPO = {"guardaroupa": FREIJO, "criado": NOGUEIRA, "cadeira": BOUCLE, "vaso": LOUCA, "box": VIDRO,
            "maquina": ESMALTE, "rack": NOGUEIRA, "tapete": TAPETE, "geladeira": INOX}
CAMA = {"Algodao cru": ROUPA, "Madeira nogueira": NOGUEIRA, "Tecido linho": PAINEL}

def acabamento(m, nome_mat):
    t, r, b = m["tipo"], m["tipo_comodo"], base_mat(nome_mat)
    if t == "cama": return CAMA.get(b, ROUPA)
    if t == "mesa":
        return por_altura("Mesa jantar", PRETO, MARMORE, caixa_de(m["obs"])[2].z - 0.05) if r == "sala" else FREIJO
    if t == "pia": return LOUCA if r == "varanda" else por_altura("Bancada", NOGUEIRA, MARMORE, 0.86)
    return POR_TIPO.get(t)

for m in MOVEIS:
    for ob in list(m["obs"]):
        nomes = [s.material.name for s in ob.material_slots if s.material]
        # o sofá de blocos, a TV do catálogo e a manta de pé da cama são trocados pelos do decorado
        if m["tipo"] == "sofa" or "Acabamento tv" in map(base_mat, nomes) or (m["tipo"] == "cama" and any(base_mat(n) == "Tecido LIV" for n in nomes)):
            m["obs"].remove(ob); bpy.data.objects.remove(ob, do_unlink=True); continue
        for s in ob.material_slots:
            novo = s.material and acabamento(m, s.material.name)
            if novo: s.link = "OBJECT"; s.material = novo

# ---------------------------------------------------------------- sofá (gerador do repositório, arquétipo Cloud)
fonte = open(SOFA_GEN, encoding="utf-8").read()
fonte = fonte[:fonte.index("# 5. EXECUÇÃO")]
ns = {"__name__": "sofa_generator"}; exec(compile(fonte, SOFA_GEN, "exec"), ns)
SOFA_W, SOFA_D = 2.40, 1.02          # medidas de projeto do arquétipo Cloud (build_sofa_0_cloud)
sofa_col, ec = ns["reset_sofa_collection"]()   # o gerador cria as almofadas na coleção "Sofa"
excluir(sofa_col, True); bpy.data.collections.remove(ec)

def sofa(m):
    sc = sofa_col
    ns["build_sofa_0_cloud"]()
    raiz = bpy.data.objects.new("Sofa_Root", None); sc.objects.link(raiz)
    for ob in list(sc.objects):
        if ob is not raiz and ob.parent is None: ob.parent = raiz
    B = V(m["costas"])
    # ponytail: 7% mais largo e 5% mais fundo que o cadastro e 8 cm para a parede, como no piloto aprovado
    raiz.location = V(m["centro"], 0.02) + B * 0.08
    raiz.rotation_euler = (0, 0, giro(B)); raiz.scale = (m["w"] * 1.07 / SOFA_W, m["d"] * 1.05 / SOFA_D, 1.0)

def almofada(nome, dims, centro, n, mat):
    ob = ns["make_throw_pillow"](nome, *dims, tuple(centro), (math.radians(14), 0, giro(n)), mat)
    for c in list(ob.users_collection): c.objects.unlink(ob)
    col.objects.link(ob); return ob

# ---------------------------------------------------------------- regras por tipo
JANELAS = list(PL.aberturas())

def peitoril_na_parede(comodo, wall, n, lado, meia):
    """Altura livre de uma parede: abaixo do peitoril da janela que estiver no vão [-meia, meia] do lado."""
    z = None
    for a in JANELAS:
        if a["tipo"] != "janela": continue
        for com, d in a["lados"]:
            c = V(a["centro"])
            if com is comodo and V(d).dot(n) > 0.9 and abs((c - wall).dot(n)) < 0.3 \
                    and abs((c - wall).dot(lado)) < meia + a["largura"] / 2:
                z = a["y0"] if z is None else min(z, a["y0"])
    return z

def vestir_cama(m, i_cama):
    C, B, L = V(m["centro"]), V(m["costas"]), V(m["lado"])
    casal = m["w"] >= 1.3
    zc = topo(m["centro"]); print("COLCHAO", m["nome"], round(zc, 3))
    wall, n = parede(C + Z * 1.4, B); wall.z = 0
    cab = C + B * (m["d"] / 2); pe = C - B * (m["d"] / 2)
    larg, z0, z1 = (m["w"] + 1.2, 0.45, 1.65) if casal else (m["w"] + 0.25, 0.45, 1.45)
    peit = peitoril_na_parede(PL.comodo(m["centro"]), wall, n, L, larg / 2)
    if peit is not None: z1 = min(z1, peit - 0.05)
    caixa(f"Painel cabeceira {i_cama}", (larg, 0.06, z1 - z0), wall + n * 0.03 + Z * ((z0 + z1) / 2), PAINEL, bevel=0.01, n=n)
    if casal:
        for k, s in enumerate((-1, 1)):
            almofada(f"Travesseiro {i_cama} {k}", (0.55, 0.42, 0.16), cab - B * 0.28 + L * (0.3 * s) + Z * (zc + 0.13), n, ROUPA)
        almofada(f"Almofada {i_cama}", (0.4, 0.4, 0.15), cab - B * 0.46 + Z * (zc + 0.17), n, MANTAS[0])
        caixa(f"Manta {i_cama}", (m["w"] + 0.12, 0.55, 0.035), pe + B * 0.30 + Z * (zc + 0.018), MANTAS[0], bevel=0.012, n=n)
        caixa(f"Tapete cama {i_cama}", (m["w"] + 0.8, m["d"] + 0.6, 0.012), C - B * 0.28 + Z * 0.026, TAPETE, n=n)
    else:
        almofada(f"Travesseiro {i_cama}", (0.55, 0.4, 0.15), cab - B * 0.25 + Z * (zc + 0.13), n, ROUPA)
        caixa(f"Manta {i_cama}", (m["w"] + 0.07, 0.5, 0.035), pe + B * 0.34 + Z * (zc + 0.018), MANTAS[1], bevel=0.012, n=n)
        s = max((1, -1), key=lambda s: raio(C + Z * 0.3, L * s))          # tapete do lado com mais chão
        caixa(f"Tapete cama {i_cama}", (1.4, 1.0, 0.012), C + L * s * (m["w"] / 2 + 0.525) + Z * 0.026, TAPETE, n=L)

def lavatorio(nome, obs):
    """Revestimento de porcelanato marmorizado, espelho com LED atrás e toalha sobre o lavatório."""
    loc, n = parede_atras(obs)
    lado = Vector((-n.y, n.x, 0))
    def placa(nm, larg, alt, zc, desloc, mat, esp=0.01):
        return caixa(nm, (larg, esp, alt), loc + n * desloc + Vector((0, 0, zc - loc.z)), mat, bevel=0, n=n)
    placa(nome + " revestimento", 1.3, PE - 0.08, PE / 2 - 0.01, 0.006, MARMORE)
    placa(nome + " LED", 0.66, 0.86, 1.5, 0.014, mat_emissor(nome + " brilho", (1.0, 0.8, 0.6), 3.0), esp=0.004)
    placa(nome + " espelho", 0.6, 0.8, 1.5, 0.03, ESPELHO, esp=0.012)
    caixa(nome + " toalha", (0.4, 0.04, 0.6), loc + n * 0.04 + lado * 0.55 + Vector((0, 0, 1.0 - loc.z)), ROUPA, bevel=0.01, n=n)
    cilindro(nome + " torneira", 0.012, 0.22, tuple(loc + n * 0.08 + Vector((0, 0, 0.93 - loc.z))), PRETO)
    luz(nome + " spot", "SPOT", tuple(loc + n * 0.45 + Vector((0, 0, PE - 0.04 - loc.z))), 25,
        spot_size=math.radians(80), spot_blend=0.6, shadow_soft_size=0.03)
    return loc + n * 0.03 + Vector((0, 0, 1.5 - loc.z))

def cozinha(m):
    C, B, L = V(m["centro"]), V(m["costas"]), V(m["lado"])
    wall, n = parede(C + Z * 1.4, B); wall.z = 0
    caixa("Armario alto", (m["w"] - 0.01, 0.36, 0.72), wall + n * 0.18 + Z * 1.98, NOGUEIRA, n=n)
    caixa("Fita LED armario", (m["w"] - 0.07, 0.02, 0.008), wall + n * 0.30 + Z * 1.614, LED, bevel=0, n=n)
    cilindro("Torneira", 0.012, 0.32, tuple(wall + n * 0.18 - L * 0.3 + Z * 0.93), PRETO)
    for i in range(2):
        cilindro(f"Pote {i}", 0.05 + 0.01 * i, 0.12 + 0.06 * i, tuple(wall + n * (0.2 + 0.1 * i) + L * (m["w"] / 2 - 0.22) + Z * 0.93), CERAMICA)
    for i, s in enumerate((-1, 1)):
        spot(f"Spot cozinha {i}", wall + n * (m["d"] + 0.6) + L * (0.6 * s))

def jantar(m):
    C, B, L = V(m["centro"]), V(m["costas"]), V(m["lado"])
    zt = caixa_de(m["obs"])[2].z
    longo = L if m["w"] >= m["d"] else B
    for i, s in enumerate((-1, 0, 1)):
        p = C + longo * (0.3 * s)
        cilindro(f"Cabo {i}", 0.003, PE - 1.75, (p.x, p.y, 1.75), PRETO, seg=6)
        esfera(f"Pendente {i}", 0.09, (p.x, p.y, 1.72), mat_emissor(f"Globo {i}", (1.0, 0.78, 0.55), 2.5))
        luz(f"Luz pendente {i}", "POINT", (p.x, p.y, 1.66), 12, shadow_soft_size=0.08)
    cilindro("Vaso mesa", 0.08, 0.18, (C.x, C.y, zt), CERAMICA, r_topo=0.06)
    planta("Ramo mesa", (C.x, C.y, zt + 0.16), 0.35, folhas=10, larg=0.04, vaso=CERAMICA, r_vaso=0.0001)

def escrivaninha(m):
    C, B, L = V(m["centro"]), V(m["costas"]), V(m["lado"])
    zt = caixa_de(m["obs"])[2].z
    wall, n = parede(C + Z * 1.4, B); wall.z = 0
    comp = min(1.0, m["w"] * 0.67)
    caixa("Prateleira", (comp, 0.22, 0.03), wall + n * 0.11 + Z * 1.55, FREIJO, bevel=0.003, n=n)
    for i in range(6):
        h = 0.2 + 0.03 * (i % 3)
        caixa(f"Livro prateleira {i}", (0.035, 0.16, h), wall + n * 0.11 + L * (-comp / 2 + 0.1 + i * 0.045) + Z * (1.565 + h / 2),
              [LINHO, NOGUEIRA, TERRACOTA][i % 3], bevel=0.002, n=n)
    p = C + L * (m["w"] / 2 - 0.27)
    cilindro("Luminaria mesa base", 0.07, 0.02, (p.x, p.y, zt), PRETO)
    cilindro("Luminaria mesa haste", 0.008, 0.42, (p.x, p.y, zt + 0.02), PRETO, seg=8)
    cilindro("Luminaria mesa cupula", 0.09, 0.12, (p.x, p.y, zt + 0.41), mat_emissor("Cupula mesa", (1.0, 0.8, 0.6), 2.0), r_topo=0.05)
    luz("Luminaria mesa luz", "POINT", (p.x, p.y, zt + 0.39), 8, shadow_soft_size=0.05)
    q = C - L * (m["w"] / 2 - 0.17)
    planta("Planta mesa", (q.x, q.y, zt), 0.3, folhas=8, larg=0.04, r_vaso=0.06)

def parede_tv(m):
    C, B, L = V(m["centro"]), V(m["costas"]), V(m["lado"])
    zt = caixa_de(m["obs"])[2].z
    wall, n = parede(C + Z * 1.4, B); wall.z = 0
    k = round((m["w"] + 0.02) / 0.06)
    for i in range(k):
        caixa(f"Ripa {i}", (0.035, 0.025, PE - 0.04), wall + n * 0.015 + L * ((i - (k - 1) / 2) * 0.06) + Z * (PE / 2 + 0.01),
              NOGUEIRA, bevel=0.003, n=n)
    caixa("Fita LED ripado", (m["w"] - 0.02, 0.01, 0.012), wall + n * 0.035 + Z * (PE - 0.06), LED, bevel=0, n=n)
    caixa("TV", (1.25, 0.03, 0.72), wall + n * 0.045 + Z * 1.28, PRETO, bevel=0.005, n=n)
    caixa("TV tela", (1.21, 0.002, 0.68), wall + n * 0.062 + Z * 1.28, TELA, bevel=0, n=n)
    for i, (w, h) in enumerate(((0.035, 0.24), (0.03, 0.22), (0.04, 0.25), (0.03, 0.2))):
        caixa(f"Livro {i}", (w, 0.17, h), C + L * (-m["w"] / 2 + 0.2 + i * 0.04) + Z * (zt + h / 2),
              [LINHO, NOGUEIRA, CERAMICA, TERRACOTA][i], bevel=0.002, n=n)
    p = C + L * (m["w"] / 2 - 0.27); cilindro("Vaso rack", 0.07, 0.26, (p.x, p.y, zt), CERAMICA, r_topo=0.04)
    p = C + L * (m["w"] / 2 - 0.47); esfera("Objeto rack", 0.06, (p.x, p.y, zt + 0.06), LATAO)
    return wall + n * 0.06 + Z * 1.0

ALVOS = {}   # pontos que as vistas derivadas enquadram
i_cama = 0
for m in MOVEIS:
    t, r = m["tipo"], m["tipo_comodo"]
    if t == "cama":
        vestir_cama(m, i_cama); i_cama += 1
        ALVOS.setdefault(m["comodo"], V(m["centro"]) + V(m["costas"]) * (m["d"] / 2) + Z * 0.75)
    elif t == "criado" and m["obs"]:
        abajur(f"Abajur {m['nome']} {m['centro']}", (*m["centro"], caixa_de(m["obs"])[2].z))
    elif t == "sofa":
        sofa(m)
    elif t == "rack" and r == "sala":
        ALVOS["tv"] = parede_tv(m)
    elif t == "pia" and r == "sala" and m["obs"]:
        cozinha(m); ALVOS["cozinha"] = V(m["centro"]) + Z * 1.0
    elif t == "pia" and r == "banho" and m["obs"]:
        ALVOS[m["comodo"]] = lavatorio("Lavatorio " + m["comodo"], m["obs"])
    elif t == "mesa" and m["obs"]:
        if r == "sala": jantar(m); ALVOS["jantar"] = V(m["centro"]) + Z * 0.85
        elif r == "quarto": escrivaninha(m)
        elif r == "varanda":
            zt = caixa_de(m["obs"])[2].z
            cilindro("Vaso varanda mesa", 0.06, 0.16, (*m["centro"], zt), CERAMICA, r_topo=0.045)
            ALVOS.setdefault(m["comodo"], V(m["centro"]) + Z * 0.8)

# sala: spots entre sofá e rack, planta na ponta do sofá, tapete se o cadastro não tiver
sofa_m = next((m for m in MOVEIS if m["tipo"] == "sofa"), None)
rack_m = next((m for m in MOVEIS if m["tipo"] == "rack" and m["tipo_comodo"] == "sala"), None)
if sofa_m and rack_m:
    meio_sr = (V(sofa_m["centro"]) + V(rack_m["centro"])) / 2
    for i, s in enumerate((-1, 1)):
        spot(f"Spot sala {i}", meio_sr + V(sofa_m["lado"]) * (0.475 * s))
    if not any(m["tipo"] == "tapete" and m["tipo_comodo"] == "sala" for m in MOVEIS):
        caixa("Tapete sala", (sofa_m["w"], (V(sofa_m["centro"]) - V(rack_m["centro"])).length - sofa_m["d"] / 2, 0.012),
              meio_sr + Z * 0.026, TAPETE, n=V(sofa_m["costas"]))
if sofa_m:   # planta no canto livre mais perto do sofá (o sofá novo não está na cena dos raios: fica a 0,6 m dele)
    sc = V(sofa_m["centro"]).to_2d()
    perto = [q for q in cantos_livres(PL.comodo(sofa_m["centro"])) if (q - sc).length > sofa_m["w"] * 0.54 + 0.6]
    for s in (1, -1):   # sem canto livre: na ponta do sofá
        q = (V(sofa_m["centro"]) + V(sofa_m["lado"]) * s * (sofa_m["w"] * 0.54 + 0.3) + V(sofa_m["costas"]) * (sofa_m["d"] * 0.25)).to_2d()
        if not perto and livre(q, folga=0.15) and all((q - p).length > 0.5 for p in PORTAS): perto = [q]
    if perto:
        q = min(perto, key=lambda q: (q - sc).length)
        planta("Planta sala", (q.x, q.y, 0.02), 1.35, folhas=26, larg=0.11, vaso=TERRACOTA)

# plantas em cantos livres: perto da janela na suíte (quarto de casal), duas na varanda
for com in PL.comodos:
    janelas = [V(a["centro"]) for a in JANELAS if any(c is com for c, _ in a["lados"])] or [V((0, 0))]
    perto = lambda q: min((q - j.to_2d()).length for j in janelas)
    cantos = sorted(set(tuple(q) for q in cantos_livres(com)), key=lambda q: perto(Vector(q)))
    casal = any(m["tipo"] == "cama" and m["w"] >= 1.3 and m["comodo"] == com["nome"] for m in MOVEIS)
    if com["tipo"] == "quarto" and casal and cantos:
        planta("Planta " + com["nome"], (*cantos[0], 0.02), 0.9, folhas=14, larg=0.08)
    if com["tipo"] == "varanda":
        usados = []
        for q in cantos:
            if all((Vector(q) - u).length > 1.0 for u in usados):
                planta(f"Planta varanda {len(usados)}", (*q, 0.02), 1.1 - 0.3 * len(usados), folhas=20 - 8 * len(usados),
                       larg=0.09, vaso=[CERAMICA, TERRACOTA][len(usados)]); usados.append(Vector(q))
            if len(usados) == 2: break

# cortinas: janelas e portas de vidro largas, só do lado de quarto e sala, sem cobrir o vão
for a in JANELAS:
    if a["tipo"] == "porta" and a["largura"] < 1.2: continue
    for com, d in a["lados"]:
        if com["tipo"] not in ("quarto", "sala"): continue
        n, ao = V(d), V(a["ao_longo"]); base = V(a["centro"]) + n * 0.11
        for k, s in enumerate((-1, 1)):
            ini = a["largura"] / 2 + 0.02
            for fim in (ini + 0.33, ini + 0.2):   # encolhe se bater na quina do cômodo
                if P.dentro(tuple((V(a["centro"]) + n * 0.3 + ao * (s * fim)).xy), com["poly"]): break
            else:
                continue
            cortina(f"Cortina {a['id']} {com['nome']} {k}", (base + ao * (s * ini)).to_2d(), (base + ao * (s * fim)).to_2d(),
                    n.to_2d(), VOIL, ondas=3)

# ---------------------------------------------------------------- luz
for ob in cena.objects:
    if ob.type == "LIGHT" and ob.name.startswith("LIV fixture"):
        ob.data.color = (1.0, 0.78, 0.55); ob.data.energy = 18

# Sol de inverno, 16h30, São Carlos: altitude 13 graus. Sem norte validado, o sol vem perpendicular à
# fachada da varanda (escolha artística do piloto): o rumo para fora da maior janela da varanda.
fora = [(a["largura"], -V(d)) for a in JANELAS if a["tipo"] == "janela" for c, d in a["lados"]
        if c["tipo"] == "varanda" and len(a["lados"]) == 1]
ALT, DIR = math.radians(13.0), max(fora, key=lambda f: f[0])[1] if fora else Vector((0, 1, 0))
para_sol = (DIR * math.cos(ALT) + Vector((0, 0, math.sin(ALT)))).normalized()
sol = next(o for o in cena.objects if o.type == "LIGHT" and o.data.type == "SUN")
sol.rotation_euler = Vector((0, 0, 1)).rotation_difference(para_sol).to_euler()
sol.data.energy = 5.0; sol.data.color = (1.0, 0.70, 0.46); sol.data.angle = math.radians(0.6)

mundo = cena.world; mundo.use_nodes = True; wn = mundo.node_tree
for no in list(wn.nodes):
    if no.type != "OUTPUT_WORLD": wn.nodes.remove(no)
ceu = wn.nodes.new("ShaderNodeTexSky")
tipos = [i.identifier for i in ceu.bl_rna.properties["sky_type"].enum_items]
ceu.sky_type = next((t for t in tipos if "NISHITA" in t or "SINGLE" in t), tipos[0])
for k, v in (("sun_elevation", ALT), ("sun_rotation", math.atan2(DIR.x, DIR.y) % (2 * math.pi)), ("sun_disc", False)):
    if hasattr(ceu, k): setattr(ceu, k, v)
fundo = wn.nodes.new("ShaderNodeBackground"); fundo.inputs["Strength"].default_value = float(arg("--ceu", "0.12"))
wn.links.new(ceu.outputs[0], fundo.inputs[0])
wn.links.new(fundo.outputs[0], next(no for no in wn.nodes if no.type == "OUTPUT_WORLD").inputs["Surface"])

# ---------------------------------------------------------------- vistas derivadas dos cômodos
excluir(col, False); excluir(sofa_col, False)   # daqui em diante os raios veem o decorado (câmera fora da planta)
def pontos_livres(com, passo=0.2, folga=0.3, longe_da_porta=False):
    xs = [v[0] for v in com["poly"]]; ys = [v[1] for v in com["poly"]]
    x = min(xs) + passo / 2
    while x < max(xs):
        y = min(ys) + passo / 2
        while y < max(ys):
            if P.dentro((x, y), com["poly"]) and livre((x, y), folga=folga, zs=(1.55,))                     and (not longe_da_porta or all((Vector((x, y)) - p).length > 0.9 for p in PORTAS)):
                yield Vector((x, y, 1.55))
            y += passo
        x += passo

def ve(olho, alvo):
    d = alvo - olho
    return raio(olho, d.normalized(), d.length) >= d.length - 0.45

def vista_longe(com, alvo):
    """Ponto livre do cômodo mais longe do alvo que ainda o enxerga: o enquadramento mais aberto.
    Primeiro fora de corredor (folga de 0,5 m) e longe das portas, para não enquadrar batente; senão, onde der."""
    for kw in ({"folga": 0.5, "longe_da_porta": True}, {}):
        livres = list(pontos_livres(com, **kw)); vis = [p for p in livres if ve(p, alvo)]
        if vis: break
    if not vis: print("SEM VISTA", com["nome"], "livres", len(livres), "alvo", tuple(round(c, 2) for c in alvo))
    return max(vis, key=lambda p: (p - alvo).length, default=None)

cameras = {}
nomes_usados = {}
def nome_vista(com):
    base = {"quarto": "suite" if "su" in com["nome"].lower() else "quarto", "banho": "banho_suite" if "su" in com["nome"].lower() else "banho",
            "varanda": "varanda"}.get(com["tipo"], com["tipo"])
    nomes_usados[base] = nomes_usados.get(base, 0) + 1
    return base if nomes_usados[base] == 1 else f"{base}{nomes_usados[base]}"

if "--cameras" in argv:
    cameras = {k: (Vector(o), Vector(a)) for k, (o, a) in json.load(open(arg("--cameras", ""), encoding="utf-8")).items()}
else:
    sala = next((c for c in PL.comodos if c["tipo"] == "sala"), None)
    porta_var = next((V(a["centro"]) for a in JANELAS if a["tipo"] == "porta" and {c["tipo"] for c, _ in a["lados"]} == {"sala", "varanda"}), None)
    for com in PL.comodos:
        if com["tipo"] == "sala": continue
        if com["tipo"] == "varanda" and porta_var is not None:   # olhando o fundo da varanda (o lado longe da sala)
            fundo = max((V(v) for v in com["poly"]), key=lambda v: (v - porta_var).length)
            ctr = sum((V(v) for v in com["poly"]), Vector()) / len(com["poly"])
            alvo = fundo + (ctr - fundo).normalized() * 0.4 + Z * 0.8
            if (o := vista_longe(com, alvo)): cameras[nome_vista(com)] = (o, alvo)
            continue
        alvo = ALVOS.get(com["nome"])
        if alvo is None:
            xs = [v[0] for v in com["poly"]]; ys = [v[1] for v in com["poly"]]
            alvo = Vector(((min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2, 0.9))
        olho = vista_longe(com, alvo)
        if olho: cameras[nome_vista(com)] = (olho, alvo)
    if sala:
        for nome, chave in (("v1", "cozinha"), ("v2", "tv")):
            if chave in ALVOS and (o := vista_longe(sala, ALVOS[chave])): cameras[nome] = (o, ALVOS[chave])
        if porta_var is not None and "jantar" in ALVOS:   # da porta da varanda, através da mesa até a parede do fundo
            perto = [p for p in pontos_livres(sala) if ve(p, ALVOS["jantar"])]
            if perto:
                o = min(perto, key=lambda p: (p.to_2d() - porta_var.to_2d()).length)
                d = (ALVOS["jantar"] - o); d.z = 0
                cameras["v3"] = (o, ALVOS["jantar"] + d.normalized() * 2.0)
print("VISTAS", {k: [list(map(lambda x: round(x, 2), o)), list(map(lambda x: round(x, 2), a))] for k, (o, a) in cameras.items()})
with open(os.path.join(SAIDA, "cameras.json"), "w", encoding="utf-8") as f:
    json.dump({k: [list(o), list(a)] for k, (o, a) in cameras.items()}, f, indent=1)

# ---------------------------------------------------------------- render
cena["liv_comodos"] = json.dumps(PL.comodos, ensure_ascii=False)
cena["liv_pe_direito"] = PE
cena.render.engine = "CYCLES"
pref = bpy.context.preferences.addons["cycles"].preferences
for tipo in ("OPTIX", "CUDA"):
    try:
        pref.compute_device_type = tipo; pref.get_devices()
        if any(d.type == tipo for d in pref.devices):
            for d in pref.devices: d.use = d.type == tipo
            cena.cycles.device = "GPU"; print("DISPOSITIVO", tipo); break
    except TypeError:
        continue
cena.cycles.samples = AMOSTRAS; cena.cycles.use_denoising = True
cena.cycles.sample_clamp_indirect = 8.0; cena.cycles.max_bounces = 10
cena.render.resolution_x, cena.render.resolution_y = RES
cena.view_settings.view_transform = "AgX"
try:
    cena.view_settings.look = arg("--look", "AgX - Medium High Contrast")
except TypeError as e:
    print("LOOK indisponível:", e)
cena.view_settings.exposure = float(arg("--exposicao", "0.5"))

vistas = arg("--vistas", ",".join(cameras)).split(",")
for nome in vistas:
    olho, alvo = cameras[nome]
    cd = bpy.data.cameras.new(nome); cd.lens = 20; cd.clip_start = 0.05
    co = bpy.data.objects.new(nome, cd); col.objects.link(co); co.location = olho
    co.rotation_euler = (alvo - olho).to_track_quat("-Z", "Y").to_euler()
    if "--sem-render" in argv: continue
    cena.camera = co; cena.render.filepath = os.path.join(SAIDA, nome + ".png")
    bpy.ops.render.render(write_still=True); print("SALVO", cena.render.filepath)

bpy.ops.wm.save_as_mainfile(filepath=os.path.join(SAIDA, "apartamento.blend"), compress=True)
print("BLEND", os.path.join(SAIDA, "apartamento.blend"))

"""Moradia estudantil em containers (Mooca): o conjunto no Blender, no molde do Laranjeiras.

blender --background --factory-startup --python modelar_containers.py -- [--no-render]

Lê implantacao/implantacao-m.json. Cada container sai com a medida real (6,058 ou 12,192 x 2,438 x 2,591 m),
chapa corrugada, quadro de canto, porta e vidro nos lados compridos. Usa as ferramentas do LIV (v1.5/miniaturas).
"""
import bpy, json, math, random, sys
from pathlib import Path

OUT = Path(__file__).resolve().parent
EXP = OUT.parent
ROOT = EXP.parents[1]
LIV = ROOT/'v1.5'/'miniaturas'/'liv-ipanema'
sys.path.insert(0, str(LIV.parent))
sys.path.insert(0, str(LIV))
from blender_maquete_base import material, box, flush, exportar, MATS
import modelar_implantacao as mi
mi.xy = lambda u, v: (u, v)          # aqui as coordenadas já são metros, como no Laranjeiras

scene = bpy.context.scene
for ob in list(scene.objects):
    bpy.data.objects.remove(ob, do_unlink=True)

IMPL = json.loads((EXP/'implantacao'/'implantacao-m.json').read_text(encoding='utf-8'))
H = IMPL['alturaContainer']          # 2,591 m (high cube não: o corte dá 2,69 de piso a piso)
cx0, cz0, cx1, cz1 = IMPL['resumo']['caixaM']
OX, OZ = (cx0+cx1)/2, (cz0+cz1)/2    # o conjunto fica centrado na origem da cena


def arq(x, z):
    return x-OX, z-OZ


# Cores do caderno (p. 79): dormitório em chapa branca, área comum em azul "Oceano Pacífico" (Suvinil),
# piso de tauari. O azul é o dos renders do caderno: a amostra da p. 79 não traz o azul.
for name, rgb, rough, metal in [
    ('chapa-branca', (226, 226, 220), .55, .25), ('chapa-azul', (38, 70, 112), .55, .25),
    ('quadro', (58, 62, 66), .5, .4), ('quadro-azul', (30, 52, 84), .5, .4),
    ('vidro', (62, 80, 88), .15, 0), ('esquadria', (40, 42, 44), .4, .8),
    ('porta', (200, 200, 194), .6, .2), ('deck', (150, 108, 70), .85, 0),
    ('grade', (70, 72, 74), .6, .6), ('guarda-corpo', (55, 58, 60), .5, .6),
    ('pergolado', (132, 92, 58), .8, 0), ('piso-pátio', (186, 182, 172), .9, 0),
    ('grama', (98, 126, 70), 1, 0), ('terreno', (140, 136, 126), .95, 0),
    ('calcada', (176, 172, 162), .92, 0), ('muro', (196, 192, 182), .9, 0),
    ('escada', (64, 66, 68), .55, .5),
]:
    material(name, rgb, rough, metal)
mi._materials()

rng = random.Random(20251210)
PASSO = .30                          # passo da chapa corrugada
RIB = .035                           # saliência da onda


def container(c):
    x, z = arq(*c['centro'])
    w, d = c['larguraX'], c['profundidadeZ']
    y0 = c['base']
    comum = c['id'].startswith('c')
    chapa = 'chapa-azul' if comum else 'chapa-branca'
    quadro = 'quadro-azul' if comum else 'quadro'
    # Caixa: piso, teto e as quatro faces (a face recua RIB para a onda ficar para fora).
    box(chapa, x, y0+H/2, z, w-2*RIB, H-.04, d-2*RIB)
    for yy in (y0+.06, y0+H-.06):                           # longarinas de baixo e de cima (só o contorno)
        for s in (-1, 1):
            box(quadro, x, yy, z+s*(d/2-.06), w, .12, .12)
            box(quadro, x+s*(w/2-.06), yy, z, .12, .12, d)
    for sx in (-1, 1):
        for sz in (-1, 1):
            box(quadro, x+sx*(w/2-.08), y0+H/2, z+sz*(d/2-.08), .16, H, .16)   # colunas de canto
    deitado = c['deitado']
    comp = w if deitado else d
    n = int((comp-.4)/PASSO)
    # Ondas nos lados compridos, interrompidas onde há vidro/porta.
    vaos = [(-.5*comp+.9, -.5*comp+1.9, 'porta'), (-.1*comp, .3*comp, 'vidro')] if not comum else \
           [(-.35*comp, .35*comp, 'vidro')]
    for lado in (-1, 1):
        for k in range(n):
            t = -comp/2+.2+(k+.5)*PASSO
            if any(a <= t <= b for a, b, _ in vaos):
                continue
            if deitado:
                box(chapa, x+t, y0+H/2, z+lado*(d/2-RIB/2), .12, H-.3, RIB)
            else:
                box(chapa, x+lado*(w/2-RIB/2), y0+H/2, z+t, RIB, H-.3, .12)
        for a, b, tipo in vaos:
            m, L = (a+b)/2, b-a
            if tipo == 'porta':
                alt, base = 2.1, .12
                mat = 'porta'
            else:
                alt, base = 1.6, .7 if not comum else .3
                mat = 'vidro'
            if deitado:
                box(mat, x+m, y0+base+alt/2, z+lado*(d/2-.01), L, alt, .03)
                box('esquadria', x+m, y0+base+alt+.03, z+lado*(d/2), L+.06, .06, .06)
            else:
                box(mat, x+lado*(w/2-.01), y0+base+alt/2, z+m, .03, alt, L)
                box('esquadria', x+lado*(w/2), y0+base+alt+.03, z+m, .06, .06, L+.06)
    # Ondas nas cabeceiras (sem vão).
    m = int((w if not deitado else d)/PASSO)-1
    for lado in (-1, 1):
        for k in range(m):
            t = -(d if deitado else w)/2+.15+(k+.5)*PASSO
            if deitado:
                box(chapa, x+lado*(w/2-RIB/2), y0+H/2, z+t, RIB, H-.3, .12)
            else:
                box(chapa, x+t, y0+H/2, z+lado*(d/2-RIB/2), .12, H-.3, RIB)


for c in IMPL['containers']:
    container(c)
for ob in flush('containers'):
    ob['tower'] = -1; ob['role'] = 'containers'

NIVEL1 = IMPL['niveis']['1']
for f in IMPL['superficies']:
    x0, z0, x1, z1 = f['ret']
    (ax, az), (bx, bz) = arq(x0, z0), arq(x1, z1)
    x, z, w, d = (ax+bx)/2, (az+bz)/2, bx-ax, bz-az
    t = f['tipo']
    y = f['base']
    if t == 'deck':
        if y > 0:                       # terraço do 1º pavimento: laje + deck + guarda-corpo
            box('deck', x, y+.05, z, w, .1, d)
        else:
            box('deck', x, .1, z, w, .12, d)
            for k in range(int(w/.9)):
                box('quadro', ax+(k+.5)*w/int(w/.9), .02, z, .08, .04, d)
        if y > 0:
            for zz in (az, bz):
                box('guarda-corpo', x, y+1.05, zz, w, .05, .05)
            for xx in (ax, bx):
                box('guarda-corpo', xx, y+1.05, z, .05, .05, d)
    elif t == 'passarela':
        box('grade', x, y-.05, z, w, .1, d)
        for zz in (az, bz):
            box('guarda-corpo', x, y+1.05, zz, w, .04, .04)
        for xx in (ax, bx):
            box('guarda-corpo', xx, y+1.05, z, .04, .04, d)
        # Pilares nos cantos de fora (as passarelas assentam no deck ou no chão).
        for xx in (ax+.1, bx-.1):
            for zz in (az+.1, bz-.1):
                box('quadro', xx, y/2, zz, .12, y, .12)
    elif t == 'jardim':
        box('grama', x, .06, z, w, .08, d)
    elif t == 'piso':
        box('piso-pátio', x, .05, z, w, .06, d)
        box('quadro-azul', x, NIVEL1-.05, z, w, .12, d)     # laje do terraço por cima do refeitório coberto
        for xx in (ax+.12, bx-.12):
            for zz in (az+.12, bz-.12):
                box('quadro-azul', xx, NIVEL1/2, zz, .16, NIVEL1, .16)
    elif t == 'pergolado':
        for xx in (ax+.1, bx-.1):
            for zz in (az+.1, bz-.1):
                box('pergolado', xx, 1.35, zz, .14, 2.7, .14)
        for k in range(int(d/.45)+1):
            box('pergolado', x, 2.68, az+k*d/int(d/.45), w+.2, .12, .06)
    elif t == 'escada':
        comprido_z = d >= w
        L = d if comprido_z else w
        n = 15
        for k in range(n):
            frac = (k+.5)/n
            alt = NIVEL1*(k+1)/n
            if comprido_z:
                box('escada', x, alt-.04, bz-frac*L, w*.9, .06, L/n)
            else:
                box('escada', ax+frac*L, alt-.04, z, L/n, .06, d*.9)
        box('guarda-corpo', x, NIVEL1/2+1, z, .04 if comprido_z else w, .04, d if comprido_z else .04)

_folhas = material('folhas-cartao', (255, 255, 255), .8, 0)   # cor e recorte de texturas/folhas.webp
_nos = _folhas.node_tree.nodes
_img = _nos.new('ShaderNodeTexImage'); _img.image = bpy.data.images.load(str(OUT/'texturas'/'folhas.webp'))
_bsdf = next(n for n in _nos if n.type == 'BSDF_PRINCIPLED')
_folhas.node_tree.links.new(_img.outputs['Color'], _bsdf.inputs['Base Color'])
_folhas.node_tree.links.new(_img.outputs['Alpha'], _bsdf.inputs['Alpha'])


def arvore(x, y, h, raio, rng, cartoes=230, lado=1.3):
    """Árvore alta e de copa estreita, como as dos renders do caderno: tronco, 5 galhos e a copa em cartões
    com o galho de folhas (folhas.webp). Cada cartão aponta o pé para o miolo da copa. O material tem "folha"
    no nome: fica fora da luz gravada (preparar_luz.py) e é iluminado em tempo real, como o vidro."""
    from mathutils import Vector
    topo = h*.55
    mi.rod('site-tronco', (x, y, 0), (x, y, topo), .13, .7, detail='arvore')
    cy = h*.68                                   # centro da copa
    for k in range(5):
        ang = k*math.tau/5+rng.uniform(-.4, .4)
        alvo = (x+math.cos(ang)*raio*.6, y+math.sin(ang)*raio*.6, cy+rng.uniform(-.5, 1.2))
        mi.rod('site-tronco', (x, y, topo*.85), alvo, .05, .5, detail='arvore')
    verts, faces, uvs = [], [], []
    centro = Vector((x, -y, cy))
    for _ in range(cartoes):
        while True:                              # ponto no elipsoide, mais denso perto da casca
            d = Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), rng.uniform(-1, 1)))
            if .25 < d.length <= 1:
                break
        p = centro+Vector((d.x*raio, d.y*raio, d.z*h*.3))
        v = (p-centro+Vector((0, 0, .6))).normalized()
        u = v.cross(Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), rng.uniform(-1, 1)))).normalized()
        b = len(verts)
        for su, sv in ((-.5, -.5), (.5, -.5), (.5, .5), (-.5, .5)):
            verts.append(tuple(p+u*su*lado+v*sv*lado))
        faces.append((b, b+1, b+2, b+3))
        uvs += [(0, 0), (1, 0), (1, 1), (0, 1)]
    me = bpy.data.meshes.new('SITE-copa-cartoes')
    me.from_pydata(verts, [], faces); me.update()
    me.materials.append(MATS['folhas-cartao'])
    camada = me.uv_layers.new(name='UVMap')
    for i, loop in enumerate(me.loops):
        camada.data[i].uv = uvs[loop.vertex_index]
    ob = bpy.data.objects.new('GEO-SITE-copa', me); scene.collection.objects.link(ob)
    ob['acabamento'] = 'folhas-cartao'
    mi._tag(ob, 'arvore')


# Árvores do pátio (renders do caderno: copas altas sobre os decks e o pátio central).
PATIO = {f['id']: f['ret'] for f in IMPL['superficies']}
for nome, fr in [('patio-central', [(.25, .2), (.7, .55), (.3, .85)]), ('patio-norte', [(.4, .45)]), ('patio-leste', [(.75, .5)])]:
    x0, z0, x1, z1 = PATIO[nome]
    for a, b in fr:
        arvore(*arq(x0+(x1-x0)*a, z0+(z1-z0)*b), rng.uniform(8, 10), rng.uniform(2.2, 2.8), rng)
# Mobiliário do pátio (planta do térreo e render 7 do caderno): caminho de concreto em L entre os gramados,
# banco sinuoso de pufes de concreto, 3 mesas de piquenique e postes de globo. Coordenadas na mesma leitura
# ampliada 2x da implantação (leitura_da_planta.py).
REG = json.loads((EXP/'implantacao'/'implantacao.json').read_text(encoding='utf-8'))['registro']


def lido(zx, zy):
    u, v = 640+zx/2, 240+zy/2
    return arq((u-REG['ancoraPx'][0])/REG['pxPorM'], (v-REG['ancoraPx'][1])/REG['pxPorM'])


material('concreto-claro', (214, 210, 200), .85, 0)
material('madeira-mesa', (128, 88, 56), .75, 0)
material('poste', (48, 50, 52), .45, .7)
material('globo', (240, 238, 228), .3, 0)
for z0x, z0y, z1x, z1y in [(895, 130, 955, 1270), (955, 545, 1490, 595)]:      # caminho em L
    (ax, az), (bx, bz) = lido(z0x, z0y), lido(z1x, z1y)
    box('piso-pátio', (ax+bx)/2, .065, (az+bz)/2, bx-ax, .07, bz-az)
# Banco sinuoso: pufes redondos de concreto (Ø 0,84 m) em zigue-zague, como a "onda" branca da planta.
(bx0, bz0), (bx1, bz1) = lido(980, 774), lido(1074, 1174)
for k in range(11):
    t = k/10
    x = (bx0+bx1)/2+math.sin(t*math.pi*4)*(bx1-bx0)*.28
    zz = bz0+t*(bz1-bz0)
    mi.rod('concreto-claro', (x, zz, 0), (x, zz, .45), radius=.42, sides=16, detail='banco-sinuoso')
# Mesas de piquenique: tampo 2,0 x 0,8 a 0,75 m e dois bancos 2,0 x 0,3 a 0,45 m.
for zx, zy in [(1172, 456), (1186, 866), (1346, 1086)]:
    x, z = lido(zx, zy)
    box('madeira-mesa', x, .74, z, 2.0, .05, .8)
    for dz in (-.62, .62):
        box('madeira-mesa', x, .44, z+dz, 2.0, .04, .3)
    for dx in (-.8, .8):
        box('poste', x+dx, .37, z, .06, .72, 1.6)
# Postes de 4,5 m com globo, na beira do caminho (render 7).
for zx, zy in [(925, 250), (925, 700), (925, 1150), (1180, 600), (1440, 600)]:
    x, z = lido(zx, zy)
    box('poste', x, 2.25, z, .1, 4.5, .1)
    mi.sphere('globo', x, z, 4.68, .2, .2, .2, detail='poste')

# Chão do lote: terreno em volta + calçada contínua.
box('terreno', 0, .0, 0, (cx1-cx0)+14, .02, (cz1-cz0)+14)
for ob in flush('implantacao'):
    ob['tower'] = -1; ob['role'] = 'implantacao'

dorms = [c for c in IMPL['containers'] if c['id'].startswith('d')]
metadata = {'towers': 0, 'floors': 2, 'floorHeight': NIVEL1, 'width': cx1-cx0, 'depth': cz1-cz0,
            'units': len(dorms), 'origemM': [OX, OZ], 'ancoraGeo': IMPL['ancoraGeo'], 'rumo_cima_graus': 0,
            'source': 'TCC Tamires Ruffino, Escola da Cidade (dez/2025)',
            'containers': [{**{k: c[k] for k in ('id', 'nivel', 'tipo', 'uso', 'larguraX', 'profundidadeZ', 'base', 'topo')},
                            'centro': list(arq(*c['centro']))} for c in IMPL['containers']]}
exportar(OUT, 'containers', metadata)

from mathutils import Vector
world = bpy.data.worlds.new('WORLD-containers'); world.use_nodes = True; scene.world = world
nodes = world.node_tree.nodes; nodes.clear()
bg = nodes.new('ShaderNodeBackground'); bg.inputs['Color'].default_value = (.55, .68, .85, 1); bg.inputs['Strength'].default_value = .9
o = nodes.new('ShaderNodeOutputWorld'); world.node_tree.links.new(bg.outputs[0], o.inputs[0])
sun = bpy.data.lights.new('LGT-sol', 'SUN'); sun.energy = 4.5; sun.angle = .02
so = bpy.data.objects.new('LGT-sol', sun); scene.collection.objects.link(so); so.rotation_euler = (math.radians(50), 0, math.radians(35))


def aim(ob, target):
    ob.rotation_euler = (Vector(target)-ob.location).to_track_quat('-Z', 'Y').to_euler()


cam_data = bpy.data.cameras.new('CAM'); cam = bpy.data.objects.new('CAM', cam_data); scene.collection.objects.link(cam)
scene.camera = cam
scene.render.engine = 'CYCLES'; scene.cycles.samples = 32; scene.cycles.use_denoising = True
try:
    cp = bpy.context.preferences.addons['cycles'].preferences
    cp.compute_device_type = 'OPTIX'; cp.get_devices()
    for dv in cp.devices:
        dv.use = dv.type == 'OPTIX'
    if any(dv.use for dv in cp.devices):
        scene.cycles.device = 'GPU'
except (TypeError, RuntimeError):
    pass
scene.render.resolution_x = 1400; scene.render.resolution_y = 900
scene.render.image_settings.file_format = 'JPEG'; scene.render.image_settings.quality = 88
scene.view_settings.view_transform = 'AgX'
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'containers.blend'))
if '--no-render' not in sys.argv:
    # Blender: y = -z da implantação (norte = +y). Aérea do sudoeste, como a perspectiva da p. 108.
    for nome, loc, alvo, lente in [('aerea', (-45, -55, 38), (0, 0, 2), 35),
                                    ('patio', (8, -12, 1.7), (-4, 6, 3), 22)]:
        cam.location = loc; aim(cam, alvo); cam_data.lens = lente
        scene.render.filepath = str(OUT/f'preview-{nome}.jpg'); bpy.ops.render.render(write_still=True)
print('CONTAINERS_READY', json.dumps({'containers': len(IMPL['containers']), 'dormitorios': len(dorms)}), flush=True)

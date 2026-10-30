"""Parque das Laranjeiras: torres e implantação no Blender, no molde do LIV.

blender --background --factory-startup --python modelar_laranjeiras.py -- [--no-render]

A fachada sai das plantas: cada apartamento do andar é a planta do book posta no lugar do final
(girada/espelhada), e as paredes e janelas dela viram as da torre. O terreno sai de
implantacao/implantacao-m.json. Usa as ferramentas do LIV (v1.5/miniaturas).
"""
import bpy, json, math, random, sys
from pathlib import Path
import numpy as np

OUT = Path(__file__).resolve().parent
EXP = OUT.parent
ROOT = EXP.parents[1]
LIV = ROOT/'v1.5'/'miniaturas'/'liv-ipanema'
sys.path.insert(0, str(LIV.parent))
sys.path.insert(0, str(LIV))
from blender_maquete_base import material, box, flush, MATS, exportar
import modelar_implantacao as mi

scene = bpy.context.scene
for ob in list(scene.objects):
    bpy.data.objects.remove(ob, do_unlink=True)

IMPL = json.loads((EXP/'implantacao'/'implantacao-m.json').read_text(encoding='utf-8'))
TORRE = IMPL['torre']
N = TORRE['pavimentos']        # térreo + 12
LV = 2.80                      # pé-direito 2,60 do book + laje
LAJE = .15
ALA, FUNDO, NUCLEO = TORRE['alaM'], TORRE['fundoM'], TORRE['nucleoM']
COMP = TORRE['comprimentoM']
HC = TORRE['corredorM']/2      # meia largura do corredor

# Cores lidas nos renders do book (piscina e playground): corpo cinza claro, faixas
# cinza escuro nas varandas, friso vermelho no recuo do núcleo, guarda-corpo branco.
for name, rgb, rough, metal in [
    ('reboco', (190, 189, 190), .85, 0), ('escuro', (92, 92, 97), .85, 0),
    ('vermelho', (170, 42, 46), .8, 0), ('interno', (226, 223, 216), .9, 0),
    ('laje', (214, 212, 208), .85, 0), ('esquadria', (48, 52, 54), .4, .8),
    ('vidro', (60, 78, 86), .2, 0), ('vidro-claro', (96, 116, 124), .25, 0),
    ('guarda-corpo', (236, 236, 233), .5, .1), ('cobertura', (150, 152, 150), .9, 0),
    ('peitoril', (222, 220, 214), .8, 0),
]:
    material(name, rgb, rough, metal)
mi._materials()


def unidade(nome):
    u = json.loads((EXP/'interiores'/nome/'unidade.json').read_text(encoding='utf-8'))
    return u['planta']


PLANTAS = {'canto': unidade('canto'), 'meio': unidade('meio')}
CW = max(p[0] for c in PLANTAS['canto']['comodos'] for p in c['poly'])
CD = max(p[1] for c in PLANTAS['canto']['comodos'] for p in c['poly'])
MW = max(p[0] for c in PLANTAS['meio']['comodos'] for p in c['poly'])
X0 = COMP/2           # ponta da torre
XM = X0-CW            # divisa canto x meio
Y0 = FUNDO/2          # fachada comprida


def posicao(final):
    """Leva (x, y) da planta para a torre: x ao longo da lâmina, y<0 = lado de cima do book (SSE)."""
    sx = -1 if final in ('08', '07', '06', '05') else 1          # ala esquerda / direita
    sy = -1 if final in ('08', '06', '04', '02') else 1          # fileira de cima / de baixo
    if final in ('01', '02', '07', '08'):                        # canto: planta como está na 08
        return 'canto', lambda p: (sx*(X0-p[0]) if sx > 0 else -X0+p[0], sy*(Y0-p[1]) if sy > 0 else -Y0+p[1])
    # meio: fachada (x=0 da planta) vira a fachada comprida; ponta de baixo da planta encosta no núcleo
    return 'meio', lambda p: (sx*(XM-p[1]), sy*(Y0-p[0]))


# Grade de ocupação do andar (10 cm) para separar fachada de parede interna.
G = .1
NX, NY = int(COMP/G)+40, int(FUNDO/G)+40
occ = np.zeros((NX, NY), bool)


def cel(x, y):
    return int(round((x+COMP/2)/G))+20, int(round((y+FUNDO/2)/G))+20


def pinta_ret(x0, y0, x1, y1):
    a, b = cel(min(x0, x1), min(y0, y1)); c, d = cel(max(x0, x1), max(y0, y1))
    occ[a:c, b:d] = True


def dentro_poly(x, y, poly):
    hit = False
    for (ax, ay), (bx, by) in zip(poly, poly[1:]+poly[:1]):
        if (ay > y) != (by > y) and x < ax+(y-ay)*(bx-ax)/(by-ay):
            hit = not hit
    return hit


FINAIS = ['08', '06', '04', '02', '07', '05', '03', '01']
unidades = []
for f in FINAIS:
    tip, T = posicao(f)
    planta = PLANTAS[tip]
    comodos = [{'nome': c['nome'], 'poly': [T(p) for p in c['poly']]} for c in planta['comodos']]
    abert = [{**o, 'tipo': 'porta', 'p': T(o['p'])} for o in planta['portas']] + \
            [{**o, 'tipo': 'janela', 'p': T(o['p'])} for o in planta['janelas']]
    unidades.append({'final': f, 'tipologia': tip, 'comodos': comodos, 'aberturas': abert})
    for c in comodos:
        xs, ys = [p[0] for p in c['poly']], [p[1] for p in c['poly']]
        for i in range(*cel(min(xs), 0)[:1], cel(max(xs), 0)[0]):
            for j in range(cel(0, min(ys))[1], cel(0, max(ys))[1]):
                x, y = (i-20)*G-COMP/2+G/2, (j-20)*G-FUNDO/2+G/2
                if dentro_poly(x, y, c['poly']):
                    occ[i, j] = True
# Corredor, hall e núcleo (escada + elevador), recuado no meio da lâmina: o H do book.
pinta_ret(-X0, -HC, X0, HC)
pinta_ret(-XM, -(Y0-MW), XM, Y0-MW)        # hall entre os meios
NUC_Y = Y0-1.65
pinta_ret(-NUCLEO/2, -NUC_Y, NUCLEO/2, NUC_Y)


def ocupado(x, y):
    i, j = cel(x, y)
    return 0 <= i < NX and 0 <= j < NY and occ[i, j]


def parede(cor, a, b, z0, z1, esp=.14):
    (ax, ay), (bx, by) = a, b
    L = math.hypot(bx-ax, by-ay)
    if L < .01 or z1-z0 < .01:
        return
    mx, my_ = (ax+bx)/2, (ay+by)/2
    if abs(by-ay) < 1e-6:
        box(cor, mx, (z0+z1)/2, my_, L, z1-z0, esp)
    else:
        box(cor, mx, (z0+z1)/2, my_, esp, z1-z0, L)


def janela(c, larg, z0, z1, horizontal, normal):
    x, y = c
    f = .05
    if horizontal:
        box('vidro', x, (z0+z1)/2, y, larg-.06, z1-z0-.06, .03)
        for s in (-1, 1):
            box('esquadria', x+s*(larg/2-f/2), (z0+z1)/2, y+normal*.03, f, z1-z0, .06)
        for zz in (z0+f/2, z1-f/2):
            box('esquadria', x, zz, y+normal*.03, larg, f, .06)
        box('esquadria', x, (z0+z1)/2, y+normal*.03, .035, z1-z0, .05)
        box('peitoril', x, z0-.03, y+normal*.10, larg+.1, .05, .2)
    else:
        box('vidro', x, (z0+z1)/2, y, .03, z1-z0-.06, larg-.06)
        for s in (-1, 1):
            box('esquadria', x+normal*.03, (z0+z1)/2, y+s*(larg/2-f/2), .06, z1-z0, f)
        for zz in (z0+f/2, z1-f/2):
            box('esquadria', x+normal*.03, zz, y, .06, f, larg)
        box('esquadria', x+normal*.03, (z0+z1)/2, y, .05, z1-z0, .035)
        box('peitoril', x+normal*.10, z0-.03, y, .2, .05, larg+.1)


def guarda_corpo(a, b, horizontal, normal):
    (ax, ay), (bx, by) = a, b
    L = math.hypot(bx-ax, by-ay)
    n = max(2, int(L/.11))
    for zz in (LAJE+.08, LAJE+1.05):
        if horizontal:
            box('guarda-corpo', (ax+bx)/2, zz, ay+normal*.02, L, .05, .05)
        else:
            box('guarda-corpo', ax+normal*.02, zz, (ay+by)/2, .05, .05, L)
    for k in range(n+1):
        t = k/n
        x, y = ax+(bx-ax)*t, ay+(by-ay)*t
        box('guarda-corpo', x+(0 if horizontal else normal*.02), LAJE+.56, y+(normal*.02 if horizontal else 0), .025, .95, .025)


def arestas(unid):
    """Arestas únicas dos cômodos (divisória entre dois cômodos aparece uma vez só)."""
    vistos = {}
    for c in unid['comodos']:
        poly = c['poly']
        for a, b in zip(poly, poly[1:]+poly[:1]):
            k = tuple(sorted([(round(a[0], 3), round(a[1], 3)), (round(b[0], 3), round(b[1], 3))]))
            vistos.setdefault(k, []).append(c['nome'])
    return vistos


def andar():
    """Paredes, janelas e varandas de um andar (8 apartamentos), em coordenadas da torre."""
    for u in unidades:
        for (a, b), nomes in arestas(u).items():
            horizontal = abs(a[1]-b[1]) < 1e-6
            mx, my_ = (a[0]+b[0])/2, (a[1]+b[1])/2
            # Fachada = do outro lado da aresta não há nada ocupado.
            n = (0, 1) if horizontal else (1, 0)
            fora = [s for s in (-1, 1) if not ocupado(mx+n[0]*s*.25, my_+n[1]*s*.25)]
            fachada = bool(fora)
            normal = fora[0] if fora else 1
            varanda = any('Varanda' in nm for nm in nomes)
            if not fachada:
                continue      # parede interna não aparece por fora e só tomaria espaço no atlas de luz
            cor = 'escuro' if varanda else 'reboco'
            eixo = 0 if horizontal else 1
            lo, hi = sorted([a[eixo], b[eixo]])
            furos = []
            for o in u['aberturas']:
                p = o['p']
                if abs(p[1-eixo]-(a[1-eixo])) < .04 and lo-.01 <= p[eixo] <= hi+.01:
                    furos.append((p[eixo]-o['largura']/2, p[eixo]+o['largura']/2, o))
            furos.sort(key=lambda t: t[0])
            cursor = lo
            pt = (lambda s: (s, a[1])) if horizontal else (lambda s: (a[0], s))
            for f0, f1, o in furos:
                f0, f1 = max(f0, lo), min(f1, hi)
                parede(cor, pt(cursor), pt(f0), LAJE, LV)
                y0, y1 = LAJE+o.get('y0', 0), LAJE+o.get('y1', 2.1)
                guarda = o['tipo'] == 'janela' and varanda and fachada
                if guarda:
                    y0 = LAJE
                    guarda_corpo(pt(f0), pt(f1), horizontal, normal)
                parede(cor, pt(f0), pt(f1), y1, LV)
                if y0 > LAJE:
                    parede(cor, pt(f0), pt(f1), LAJE, y0)
                c = pt((f0+f1)/2)
                if o['tipo'] == 'janela' and not guarda:
                    janela(c, f1-f0, y0, y1, horizontal, normal)
                elif o['tipo'] == 'porta' and f1-f0 > 1.2:      # porta de correr da varanda
                    janela(c, f1-f0, y0, y1, horizontal, normal)
                cursor = f1
            parede(cor, pt(cursor), pt(hi), LAJE, LV)
    # Pontas do corredor com janela; núcleo com friso vermelho no recuo.
    for s in (-1, 1):
        parede('reboco', (s*X0, -HC), (s*X0, HC), LAJE, LV)
        janela((s*(X0+.01), 0), .9, LAJE+1.1, LAJE+2.2, False, s)
    for s in (-1, 1):
        parede('vermelho', (-NUCLEO/2, s*NUC_Y), (NUCLEO/2, s*NUC_Y), LAJE, LV, .2)
        janela((0, s*(NUC_Y+.01)), 1.2, LAJE+1.0, LAJE+2.2, True, s)


def faixas():
    """Ocupação do andar como retângulos grandes: colunas com as mesmas faixas são juntadas."""
    col = []
    for i in range(NX):
        runs, j = [], 0
        while j < NY:
            if occ[i, j]:
                k = j
                while k < NY and occ[i, k]:
                    k += 1
                runs.append((j, k)); j = k
            else:
                j += 1
        col.append(tuple(runs))
    rets, i = [], 0
    while i < NX:
        k = i
        while k < NX and col[k] == col[i]:
            k += 1
        for j0, j1 in col[i]:
            rets.append(((i-20)*G-COMP/2, (j0-20)*G-FUNDO/2, (k-20)*G-COMP/2, (j1-20)*G-FUNDO/2))
        i = k
    return rets


def laje(z=0.0, mat='laje'):
    for x0, y0, x1, y1 in faixas():
        box(mat, (x0+x1)/2, z+LAJE/2, (y0+y1)/2, x1-x0, LAJE, y1-y0)


def contorno_externo():
    """Bordas da ocupação (para a platibanda), juntadas em trechos retos."""
    segs = []
    for i in range(NX-1):          # bordas verticais: troca entre coluna i e i+1
        j = 0
        while j < NY:
            if occ[i, j] != occ[i+1, j]:
                k = j
                while k < NY and occ[i, k] != occ[i+1, k] and occ[i, k] == occ[i, j]:
                    k += 1
                x = (i+1-20)*G-COMP/2
                segs.append(('v', x, (j-20)*G-FUNDO/2, (k-20)*G-FUNDO/2)); j = k
            else:
                j += 1
    for j in range(NY-1):          # bordas horizontais
        i = 0
        while i < NX:
            if occ[i, j] != occ[i, j+1]:
                k = i
                while k < NX and occ[k, j] != occ[k, j+1] and occ[k, j] == occ[i, j]:
                    k += 1
                y = (j+1-20)*G-FUNDO/2
                segs.append(('h', y, (i-20)*G-COMP/2, (k-20)*G-COMP/2)); i = k
            else:
                i += 1
    return segs


TORRES = IMPL['torres']
lote = IMPL['loteM']
cx = sum(p[0] for p in lote)/len(lote)
cz = sum(p[1] for p in lote)/len(lote)


def arq(p):
    return p[0]-cx, p[1]-cz


def coloca(objs, role, pisos):
    for t_i, t in enumerate(TORRES):
        x, y = arq(t['centroM'])
        rot = math.pi/2 if t['girada'] else 0
        for piso in pisos:
            for src in objs:
                ob = src.copy(); ob.data = src.data; scene.collection.objects.link(ob)
                ob.name = f'GEO-T{t_i+1:02d}-{role}-{piso:02d}-{src["acabamento"]}'
                ob.location = (x, -y, piso*LV); ob.rotation_euler.z = rot
                ob['tower'] = t_i; ob['floor'] = piso
                ob['role'] = role if (role != 'paredes' or src['acabamento'] == 'reboco') else 'detalhes-panos'
    for src in objs:
        bpy.data.objects.remove(src, do_unlink=True)


andar()
coloca(flush('panos'), 'paredes', range(N))
laje()
coloca(flush('lajes'), 'lajes', range(N+1))

# Cobertura: platibanda no contorno, caixa d'água e casa de máquinas sobre o núcleo.
H = N*LV
for kind, c, a, b in contorno_externo():
    if kind == 'v':
        box('reboco', c, H+LAJE+.5, (a+b)/2, .15, 1.0, b-a)
    else:
        box('reboco', (a+b)/2, H+LAJE+.5, c, b-a, 1.0, .15)
box('reboco', 0, H+2.0, 0, NUCLEO+.4, 3.6, 2*NUC_Y)
box('cobertura', 0, H+3.85, 0, NUCLEO+.6, .1, 2*NUC_Y+.2)
coloca(flush('cobertura'), 'cobertura', [0])

# ---------- Implantação ----------
mi.xy = lambda u, v: (u, v)        # as funções do LIV recebem coordenada arquitetônica direto
rng = random.Random(30102026)


def poligono(mat, pts, top, bottom=None):
    n = len(pts)
    verts = [(x, -y, top) for x, y in pts]
    faces = [tuple(reversed(range(n)))]
    if bottom is not None:
        verts += [(x, -y, bottom) for x, y in pts]
        faces += [tuple(range(n, 2*n))]
        faces += [(i, (i+1) % n, (i+1) % n+n, i+n) for i in range(n)]
    me = bpy.data.meshes.new('SITE-'+mat); me.from_pydata(verts, [], faces); me.update()
    me.materials.append(MATS[mat])
    ob = bpy.data.objects.new('GEO-SITE-'+mat, me); scene.collection.objects.link(ob)
    ob['acabamento'] = mat.removeprefix('site-'); ob['tower'] = -1; ob['role'] = 'implantacao'
    return ob


LOTE = [arq(p) for p in lote]
poligono('site-grama', LOTE, .05, -.3)

for v in IMPL['vias']:
    pts = [arq(p) for p in v['linhaM']]
    w = v['larguraM']
    for (ax, ay), (bx, by) in zip(pts, pts[1:]):
        L = math.hypot(bx-ax, by-ay)
        ang = math.atan2(by-ay, bx-ax)
        # box gira em x/z; para via inclinada usa o maior eixo.
        if abs(by-ay) < abs(bx-ax):
            box('site-asfalto', (ax+bx)/2, .08, (ay+by)/2, L+w, .06, w)
        else:
            box('site-asfalto', (ax+bx)/2, .08, (ay+by)/2, w, .06, L+w)
        for s in (-1, 1):   # guia de concreto dos dois lados
            if abs(by-ay) < abs(bx-ax):
                box('site-piso', (ax+bx)/2, .1, (ay+by)/2+s*(w/2+.08), L+w, .1, .16)
            else:
                box('site-piso', (ax+bx)/2+s*(w/2+.08), .1, (ay+by)/2, .16, .1, L+w)

carros = ['site-car-branco', 'site-car-prata', 'site-car-chumbo', 'site-car-vermelho', 'site-car-azul']
vagas = 0
for e in IMPL['estacionamento']:
    (x0, z0), (x1, z1) = e['m']
    (ax, ay), (bx, by) = arq((x0, z0)), arq((x1, z1))
    deitada = (bx-ax) >= (by-ay)
    box('site-permeavel', (ax+bx)/2, .07, (ay+by)/2, bx-ax, .04, by-ay)
    comp = (bx-ax) if deitada else (by-ay)
    prof = (by-ay) if deitada else (bx-ax)
    n = e['vagas']//e['fileiras']
    for fil in range(e['fileiras']):
        for k in range(n):
            t = (k+.5)/n
            if deitada:
                x = ax+(bx-ax)*t; y = ay+prof*(fil+.5)/e['fileiras']
                box('site-piso', x, .1, y, 1.8, .03, prof/e['fileiras']*.8)
                box('site-marcacao', x+1.25, .12, y, .06, .02, prof/e['fileiras']*.9)
                if rng.random() < .42:
                    mi.car(x, y, carros[vagas % 5], fil % 2 == 1, rng.uniform(.88, .97))
            else:
                y = ay+(by-ay)*t; x = ax+prof*(fil+.5)/e['fileiras']
                box('site-piso', x, .1, y, prof/e['fileiras']*.8, .03, 1.8)
                box('site-marcacao', x, .12, y+1.25, prof/e['fileiras']*.9, .02, .06)
            vagas += 1
        # Árvore a cada 3 vagas, como nas fileiras do book.
        for k in range(0, n, 3):
            t = (k+.5)/n
            if deitada:
                mi.tree(ax+(bx-ax)*t, by+.6 if fil == e['fileiras']-1 else ay-.6, rng.uniform(4.5, 6), rng.uniform(1.6, 2.1), rng)
            else:
                mi.tree(bx+.6, ay+(by-ay)*t, rng.uniform(4.5, 6), rng.uniform(1.6, 2.1), rng)

# Calçada em volta das torres e o térreo.
for t in TORRES:
    x, y = arq(t['centroM'])
    w, d = t['larguraM']+3.0, t['profundidadeM']+3.0
    box('site-piso', x, .09, y, w, .06, d)

for l in IMPL['lazer']:
    (x0, z0), (x1, z1) = l['m']
    (ax, ay), (bx, by) = arq((x0, z0)), arq((x1, z1))
    x, y, w, d = (ax+bx)/2, (ay+by)/2, bx-ax, by-ay
    tipo = l['tipo']
    if tipo == 'edificio':
        h = l.get('altura', 3.0)
        box('site-reboco', x, h/2, y, w, h, d)
        box('site-cobertura', x, h+.08, y, w+.6, .16, d+.6)
    elif tipo == 'piscina':
        box('site-deck', x, .1, y, w+3, .1, d+3)
        box('site-azulejo', x, .12, y, w, .1, d)
        box('site-agua', x, .16, y, w-.3, .04, d-.3)
        for k in range(4):
            mi.palm(x+(k-1.5)*w/3, y-d/2-1.6, 6.5, 1, rng) if hasattr(mi, 'palm') else None
    elif tipo == 'reservatorio':
        mi.rod('site-muro', (x, y, 0), (x, y, l.get('altura', 6)), min(w, d)/2, sides=16)
    else:
        mat = 'site-play-azul' if 'Playground' in l['nome'] else 'site-deck' if 'Pet' not in l['nome'] else 'site-permeavel'
        box(mat, x, .1, y, w, .06, d)

# Muro no contorno (frente com gradil baixo sobre mureta).
for (ax, ay), (bx, by) in zip(LOTE, LOTE[1:]+LOTE[:1]):
    L = math.hypot(bx-ax, by-ay)
    frente = abs(by-ay) < .01 and abs(ay-max(q[1] for q in LOTE)) < .01   # borda da Rua José Quatrochi
    h = .6 if frente else 2.2
    if abs(by-ay) < abs(bx-ax):
        box('site-muro', (ax+bx)/2, h/2, (ay+by)/2, L, h, .18)
    else:
        box('site-muro', (ax+bx)/2, h/2, (ay+by)/2, .18, h, L)
    if frente:
        steps = int(L/.15)
        for k in range(steps):
            box('site-metal', ax+(bx-ax)*k/steps, 1.3, ay, .03, 1.4, .03)
        box('site-metal', (ax+bx)/2, 2.0, ay, L, .05, .05)
    # Árvores ao longo das divisas.
    for k in range(int(L/9)):
        t = (k+.5)/int(L/9)
        mi.tree(ax+(bx-ax)*t, ay+(by-ay)*t, rng.uniform(5, 7), rng.uniform(1.8, 2.4), rng)

for ob in flush('implantacao'):
    ob['tower'] = -1; ob['role'] = 'implantacao'

metadata = {'towers': len(TORRES), 'floors': N, 'floorHeight': LV, 'width': COMP, 'depth': FUNDO,
            'units_per_floor': 8, 'units': len(TORRES)*N*8, 'vagas_desenhadas': vagas,
            'rumo_cima_graus': IMPL['registro']['rumoCimaGraus'], 'lote_centro_m': [cx, cz],
            'lote_geo': IMPL['loteGeo'], 'source': 'book ADN Parque das Laranjeiras (out/2026)',
            'finais': {u['final']: u['tipologia'] for u in unidades},
            # Caixa de cada final no andar (coordenadas da torre) e posição das torres: base do cadastro de cliques.
            'unidades_local': {u['final']: {'tipologia': u['tipologia'],
                               'ret': [min(p[0] for c in u['comodos'] for p in c['poly']), min(p[1] for c in u['comodos'] for p in c['poly']),
                                       max(p[0] for c in u['comodos'] for p in c['poly']), max(p[1] for c in u['comodos'] for p in c['poly'])]}
                               for u in unidades},
            'envelope_local': [X0, Y0], 'laje': LAJE,
            'torres_arq': [{'id': t['id'], 'nome': t['nome'], 'centro': list(arq(t['centroM'])), 'girada': t['girada']} for t in TORRES]}
exportar(OUT, 'laranjeiras', metadata)

# Render de inspeção (mesma geometria), luz de estúdio como no LIV.
from mathutils import Vector
world = bpy.data.worlds.new('WORLD-laranjeiras'); world.use_nodes = True; scene.world = world
nodes = world.node_tree.nodes; nodes.clear()
bg = nodes.new('ShaderNodeBackground'); bg.inputs['Color'].default_value = (.55, .68, .85, 1); bg.inputs['Strength'].default_value = .9
o = nodes.new('ShaderNodeOutputWorld'); world.node_tree.links.new(bg.outputs[0], o.inputs[0])
sun = bpy.data.lights.new('LGT-sol', 'SUN'); sun.energy = 4.5; sun.angle = .02
so = bpy.data.objects.new('LGT-sol', sun); scene.collection.objects.link(so); so.rotation_euler = (math.radians(50), 0, math.radians(35))


def aim(ob, target):
    ob.rotation_euler = (Vector(target)-ob.location).to_track_quat('-Z', 'Y').to_euler()


cam_data = bpy.data.cameras.new('CAM'); cam = bpy.data.objects.new('CAM', cam_data); scene.collection.objects.link(cam)
scene.camera = cam
scene.render.engine = 'CYCLES'; scene.cycles.samples = 24; scene.cycles.use_denoising = True
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
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'laranjeiras.blend'))
if '--no-render' not in sys.argv:
    # Vista da piscina como o render da p. 17 do book: de junto da borda, olhando as torres 01/03.
    pisc = next(l for l in IMPL['lazer'] if l['tipo'] == 'piscina')
    (qx0, qz0), (qx1, qz1) = pisc['m']; px_, py_ = arq(((qx0+qx1)/2, (qz0+qz1)/2))
    t1x, t1y = arq(TORRES[0]['centroM'])
    frente_y = max(q[1] for q in LOTE)
    for nome, loc, alvo, lente in [('aerea', (-120, -110, 95), (0, 0, 10), 35),
                                    ('piscina', (px_+3, -(py_+4), 1.5), (t1x, -t1y, 16), 22),
                                    ('rua', (-10, -(frente_y+22), 1.7), (0, 0, 16), 24)]:
        cam.location = loc; aim(cam, alvo); cam_data.lens = lente
        scene.render.filepath = str(OUT/f'preview-{nome}.jpg'); bpy.ops.render.render(write_still=True)
print('LARANJEIRAS_READY', json.dumps({k: metadata[k] for k in ('towers', 'floors', 'units', 'vagas_desenhadas')}), flush=True)

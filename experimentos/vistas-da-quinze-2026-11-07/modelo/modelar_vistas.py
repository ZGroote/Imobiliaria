"""Vistas da Quinze: torre em L com degraus, embasamento e lazer no Blender, no molde do LIV.

blender --background --factory-startup --python-exit-code 1 --python modelar_vistas.py -- [--no-render]

Lê implantacao/implantacao-m.json (258 apartamentos andar por andar). A fachada sai das janelas das
plantas T01..T06 (frente de cada apartamento), os degraus saem das pontas de cada andar e o terraço de
cada ponta fica sobre a laje do andar de baixo. Cores e painéis da fachada pelos renders do site oficial
(galeria-00 e galeria-15). Usa as ferramentas do LIV (v1.5/miniaturas) e a árvore de folhas do Mooca.
"""
import bpy, json, math, random, sys
from pathlib import Path

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
T = IMPL['torre']
QX, QZ = T['quinaSE']
PROF, CORR = T['profundidadeUnidadeM'], T['corredorM']
FUNDO = T['fundoAlaM']
H0, LV = T['alturaEmbasamentoM'], T['alturaAndarM']
A0, A1 = T['primeiroAndar'], T['ultimoAndar']
LAJE = .15
ALAS = {a['id']: a for a in T['alas']}
UNIDADES = IMPL['unidades']

# Cores medidas nos renders do site (galeria-15: fachada do pátio; galeria-01: terraços).
for name, rgb, rough, metal in [
    ('reboco', (236, 235, 230), .85, 0), ('grafite', (74, 72, 70), .85, 0), ('fendi', (140, 129, 116), .85, 0),
    ('moldura', (104, 93, 82), .85, 0), ('laje', (226, 224, 219), .85, 0), ('esquadria', (238, 238, 235), .4, .1),
    ('vidro', (58, 72, 82), .15, 0), ('ar-condicionado', (40, 40, 40), .6, .2), ('guarda-corpo', (244, 244, 241), .5, .05),
    ('madeira-terraco', (196, 146, 96), .7, 0), ('mureta', (214, 203, 186), .85, 0), ('piso-terraco', (222, 219, 212), .8, 0),
    ('spa', (245, 245, 243), .3, 0), ('agua-spa', (120, 196, 214), .1, 0), ('embasamento', (150, 149, 146), .88, 0),
    ('garagem-vao', (34, 36, 38), .9, 0), ('cobertura', (170, 170, 166), .9, 0), ('telhado-lazer', (86, 80, 74), .8, 0),
    ('pista', (120, 160, 160), .9, 0), ('vaso', (64, 62, 60), .8, 0),
    ('folhas-cartao', (90, 120, 60), 1, 0),
]:
    material(name, rgb, rough, metal)
mi._materials()
mi.xy = lambda u, v: (u, v)        # as funções do LIV recebem coordenada arquitetônica direto
rng = random.Random(7112026)

LOTE = IMPL['loteM']
CX = sum(p[0] for p in LOTE)/len(LOTE)
CZ = sum(p[1] for p in LOTE)/len(LOTE)


def arq(x, z):
    return x-CX, z-CZ


def base(andar):
    return H0+(andar-A0)*LV


# ---------- Ponta de cada ala por andar (a mesma regra da implantação) ----------
def ponta(ala, andar):
    a = ALAS[ala]
    comp = a['comprimentoM']
    if andar < A0:
        return comp
    return comp-max(0, andar-a['primeiroDegrau']+1)*a['larguraM']/3


# Janelas da frente de cada planta (metros ao longo da frente, medidos nas plantas do construtor):
# (início, fim, tipo); q = quarto (1,20 m de altura, peitoril 1,00), s = sala (1,40, peitoril 0,80).
JANELAS = {
    'T01': [(.68, 2.08, 'q'), (3.18, 5.18, 's'), (6.12, 7.48, 'q')],
    'T02': [(.77, 2.06, 'q'), (3.18, 5.14, 's')],
    'T03': [(.68, 2.08, 'q'), (3.4, 4.9, 'q'), (6.0, 7.8, 's')],
    'T05': [(.68, 2.08, 'q'), (3.4, 4.9, 'q'), (6.0, 7.8, 's')],
    'T04': [(.68, 2.08, 'q'), (3.4, 4.9, 'q'), (6.1, 7.6, 'q'), (8.9, 10.6, 's')],
    'T06': [(.6, 2.0, 'q'), (3.0, 5.0, 's')],
}
ALTURA = {'q': (1.0, 2.2), 's': (.8, 2.2)}

# Painéis de cor da fachada (galeria-15 e galeria-00): (ala, face, de, até [m ao longo da ala, a partir
# do núcleo], andar inicial, andar final, material, moldura). Aproximados pelos renders.
PAINEIS = [
    ('sul', 'patio', 9.8, 13.6, 3, 19, 'grafite', False),
    ('sul', 'patio', 16.0, 23.4, 11, 14, 'fendi', True),
    ('sul', 'patio', 16.0, 23.4, 4, 7, 'fendi', True),
    ('sul', 'patio', 26.6, 30.4, 3, 12, 'grafite', False),
    ('sul', 'patio', 33.6, 40.6, 3, 7, 'fendi', True),
    ('sul', 'patio', .4, 7.8, 13, 17, 'fendi', True),
    ('sul', 'patio', .4, 7.8, 3, 9, 'fendi', True),
    ('leste', 'patio', 1.0, 6.4, 3, 8, 'fendi', True),
    ('leste', 'patio', 7.6, 10.2, 3, 16, 'grafite', False),
    ('leste', 'patio', 15.0, 20.4, 9, 13, 'fendi', True),
    ('sul', 'fora', 2.0, 9.0, 4, 10, 'fendi', True),
    ('sul', 'fora', 12.0, 15.6, 3, 18, 'grafite', False),
    ('sul', 'fora', 22.0, 29.0, 9, 13, 'fendi', True),
    ('leste', 'fora', -12.8, -5.0, 6, 11, 'fendi', True),
    ('leste', 'fora', 3.0, 6.6, 3, 17, 'grafite', False),
    ('leste', 'fora', 12.0, 19.0, 4, 8, 'fendi', True),
]


def face_local(ala, face):
    """Transforma (s ao longo da ala a partir do núcleo, n para fora da face) em (x, z) do lote."""
    if ala == 'sul':
        x_nucleo = QX-FUNDO
        z = QZ if face == 'fora' else QZ-FUNDO
        sz = 1 if face == 'fora' else -1
        return (lambda s, n=0: (x_nucleo-s, z+sz*n)), True     # face horizontal (corre em x)
    x = QX if face == 'fora' else QX-FUNDO
    sx = 1 if face == 'fora' else -1
    z_nucleo = QZ-FUNDO
    return (lambda s, n=0: (x+sx*n, z_nucleo-s)), False


def parede_reta(mat, a, b, z0, z1, esp=.2, recuo=0.0):
    """Parede entre os pontos a e b (lote), centrada recuo para dentro da face."""
    (ax, az), (bx, bz) = arq(*a), arq(*b)
    L = math.hypot(bx-ax, bz-az)
    if L < .01 or z1-z0 < .01:
        return
    if abs(bz-az) < 1e-6:
        box(mat, (ax+bx)/2, (z0+z1)/2, az, L, z1-z0, esp)
    else:
        box(mat, ax, (z0+z1)/2, (az+bz)/2, esp, z1-z0, L)


def janela(c, larg, z0, z1, horizontal, normal, ac=True):
    """Janela de esquadria branca com vidro, na face (normal = +1/-1 para fora no eixo perpendicular)."""
    x, y = arq(*c)
    f = .06
    if horizontal:
        box('vidro', x, (z0+z1)/2, y, larg-.08, z1-z0-.08, .03)
        for s in (-1, 1):
            box('esquadria', x+s*(larg/2-f/2), (z0+z1)/2, y+normal*.05, f, z1-z0, .08)
        for zz in (z0+f/2, z1-f/2):
            box('esquadria', x, zz, y+normal*.05, larg, f, .08)
        box('esquadria', x, (z0+z1)/2, y+normal*.05, .04, z1-z0, .06)
        if ac:   # condensadora preta ao lado da janela (render galeria-15)
            box('ar-condicionado', x+larg/2+.5, z0+.05, y+normal*.22, .78, .52, .32)
    else:
        box('vidro', x, (z0+z1)/2, y, .03, z1-z0-.08, larg-.08)
        for s in (-1, 1):
            box('esquadria', x+normal*.05, (z0+z1)/2, y+s*(larg/2-f/2), .08, z1-z0, f)
        for zz in (z0+f/2, z1-f/2):
            box('esquadria', x+normal*.05, zz, y, .08, f, larg)
        box('esquadria', x+normal*.05, (z0+z1)/2, y, .06, z1-z0, .04)
        if ac:
            box('ar-condicionado', x+normal*.22, z0+.05, y+larg/2+.5, .32, .52, .78)


def guarda_corpo(a, b, z, horizontal, normal):
    """Guarda-corpo de réguas horizontais brancas com rodapé de madeira (render galeria-01)."""
    (ax, ay), (bx, by) = arq(*a), arq(*b)
    L = math.hypot(bx-ax, by-ay)
    if L < .05:
        return
    mx, my = (ax+bx)/2, (ay+by)/2
    off = normal*.04
    dims = (lambda h, e: (L, h, e)) if horizontal else (lambda h, e: (e, h, L))
    pos = (lambda zz: (mx, zz, my+off)) if horizontal else (lambda zz: (mx+off, zz, my))
    box('madeira-terraco', *pos(z+.18), *dims(.36, .05))
    for k in range(6):
        box('guarda-corpo', *pos(z+.42+k*.14), *dims(.07, .03))
    box('guarda-corpo', *pos(z+1.12), *dims(.06, .07))
    n = max(1, int(L/1.4))
    for k in range(n+1):
        t = k/n
        x, y = ax+(bx-ax)*t, ay+(by-ay)*t
        box('guarda-corpo', x+(0 if horizontal else off), z+.58, y+(off if horizontal else 0), .06, 1.16, .06)


def faixa_com_janelas(mat, ala, face, s0, s1, andar, furos):
    """Parede da face de s0 a s1 (ao longo da ala) com os vãos [(a, b, z0, z1)] em metros da face."""
    P, horiz = face_local(ala, face)
    normal = 1 if face == 'fora' else -1
    if not horiz:
        normal = 1 if face == 'fora' else -1
    zb = base(andar)
    furos = sorted((max(a, s0), min(b, s1), z0, z1) for a, b, z0, z1 in furos if b > s0 and a < s1)
    # Painéis de cor (galeria-15) são a cor da própria parede no trecho, então as janelas continuam abertas.
    pin = [(p0, p1, m, mol, af0, af1) for al, fc, p0, p1, af0, af1, m, mol in PAINEIS
           if al == ala and fc == face and af0 <= andar <= af1]

    def trecho(a, b, z0, z1):
        cortes = sorted({a, b} | {v for p0, p1, *_ in pin for v in (p0, p1) if a < v < b})
        for c0, c1 in zip(cortes, cortes[1:]):
            meio = (c0+c1)/2
            m = next((pm for p0, p1, pm, *_ in pin if p0 <= meio <= p1), mat)
            parede_reta(m, P(c0), P(c1), zb+z0, zb+z1)

    cur = s0
    for a, b, z0, z1 in furos:
        trecho(cur, a, LAJE, LV)
        trecho(a, b, LAJE, z0)
        trecho(a, b, z1, LV)
        cur = b
    trecho(cur, s1, LAJE, LV)
    for a, b, z0, z1 in furos:
        janela(P((a+b)/2), b-a, zb+z0, zb+z1, horiz, normal if horiz else (1 if face == 'fora' else -1))
    # Moldura escura dos quadros fendi: faixas de 30 cm, 1 cm à frente da parede, sem passar por janela.
    for p0, p1, m, mol, af0, af1 in pin:
        p1 = min(p1, s1)
        if not mol or p1-p0 < .5:
            continue
        faixas = [(s, s, LAJE, LV) for s in (p0, p1) if not any(a-.25 < s < b+.25 for a, b, *_ in furos)]
        if andar == af0:
            faixas.append((p0, p1, LAJE, LAJE+.3))
        if andar == af1:
            faixas.append((p0, p1, LV-.3, LV))
        for a, b, z0, z1 in faixas:
            if a == b:
                a, b = a-.15, a+.15
            (ax, ay), (bx, by) = arq(*P(a, .11)), arq(*P(b, .11))
            if horiz:
                box('moldura', (ax+bx)/2, zb+(z0+z1)/2, ay, abs(bx-ax), z1-z0, .02)
            else:
                box('moldura', ax, zb+(z0+z1)/2, (ay+by)/2, .02, z1-z0, abs(by-ay))


def ao_longo(u):
    """Trecho [s0, s1] do apartamento ao longo da ala (a partir do núcleo)."""
    if u['ala'] == 'sul':
        x_nucleo = QX-FUNDO
        return x_nucleo-u['x'][1], x_nucleo-u['x'][0]
    z_nucleo = QZ-FUNDO
    return z_nucleo-u['z'][1], z_nucleo-u['z'][0]


def andar_ala(ala, andar):
    us = [u for u in UNIDADES if u['andar'] == andar and u['ala'] == ala]
    fim = ponta(ala, andar)
    for face, lado in (('fora', 'fora'), ('patio', 'patio')):
        furos = []
        for k, u in enumerate(sorted((u for u in us if u['lado'] == lado), key=lambda u: ao_longo(u)[0])):
            s0, s1 = ao_longo(u)
            jan = JANELAS[u['tipologia']]
            espelho = k % 2 == 1
            for a, b, t in jan:
                if b > s1-s0+.01:
                    continue
                z0, z1 = ALTURA[t]
                aa, bb = (s1-b, s1-a) if espelho else (s0+a, s0+b)
                furos.append((aa, bb, z0, z1))
        inicio = -FUNDO if face == 'fora' else 0.0      # a face de fora passa pela frente do núcleo
        faixa_com_janelas('reboco', ala, face, inicio, fim, andar, furos)
        if face == 'fora':   # janelas da escada/hall na frente do núcleo
            P, horiz = face_local(ala, face)
            zb = base(andar)
            janela(P(-FUNDO/2), 1.2, zb+1.0, zb+2.2, horiz, 1, ac=False)
    # Testa da ala (a ponta): a parede corre na largura da ala; corredor com janela.
    P_fora, horiz = face_local(ala, 'fora')
    P_patio, _ = face_local(ala, 'patio')
    zb = base(andar)
    a, b = P_fora(fim), P_patio(fim)
    pontas = [u for u in us if abs(ao_longo(u)[1]-fim) < .05]
    com_terraco = any('terracoM' in u for u in pontas)
    larg = PROF
    for lado, (n0, n1) in (('fora', (0, PROF)), ('patio', (PROF+CORR, FUNDO))):
        q0, q1 = n0+larg*.25, n0+larg*.75
        if ala == 'sul':
            z_of = lambda n: QZ-n
            seg = [((a[0], z_of(n0)), (a[0], z_of(q0))), ((a[0], z_of(q1)), (a[0], z_of(n1)))]
            parede_reta('reboco', *seg[0], zb+LAJE, zb+LV); parede_reta('reboco', *seg[1], zb+LAJE, zb+LV)
            if com_terraco:
                parede_reta('reboco', (a[0], z_of(q0)), (a[0], z_of(q1)), zb+2.3, zb+LV)
                janela((a[0], z_of((q0+q1)/2)), q1-q0, zb+LAJE, zb+2.3, False, -1, ac=False)
            else:
                parede_reta('reboco', (a[0], z_of(q0)), (a[0], z_of(q1)), zb+LAJE, zb+1.0)
                parede_reta('reboco', (a[0], z_of(q0)), (a[0], z_of(q1)), zb+2.2, zb+LV)
                janela((a[0], z_of((q0+q1)/2)), q1-q0, zb+1.0, zb+2.2, False, -1)
        else:
            x_of = lambda n: QX-n
            seg = [((x_of(n0), a[1]), (x_of(q0), a[1])), ((x_of(q1), a[1]), (x_of(n1), a[1]))]
            parede_reta('reboco', *seg[0], zb+LAJE, zb+LV); parede_reta('reboco', *seg[1], zb+LAJE, zb+LV)
            if com_terraco:
                parede_reta('reboco', (x_of(q0), a[1]), (x_of(q1), a[1]), zb+2.3, zb+LV)
                janela((x_of((q0+q1)/2), a[1]), q1-q0, zb+LAJE, zb+2.3, True, -1, ac=False)
            else:
                parede_reta('reboco', (x_of(q0), a[1]), (x_of(q1), a[1]), zb+LAJE, zb+1.0)
                parede_reta('reboco', (x_of(q0), a[1]), (x_of(q1), a[1]), zb+2.2, zb+LV)
                janela((x_of((q0+q1)/2), a[1]), q1-q0, zb+1.0, zb+2.2, True, -1)
    # Corredor: janela na testa.
    if ala == 'sul':
        parede_reta('reboco', (a[0], QZ-PROF), (a[0], QZ-PROF-CORR), zb+LAJE, zb+1.1)
        parede_reta('reboco', (a[0], QZ-PROF), (a[0], QZ-PROF-CORR), zb+2.2, zb+LV)
        janela((a[0], QZ-PROF-CORR/2), CORR, zb+1.1, zb+2.2, False, -1, ac=False)
    else:
        parede_reta('reboco', (QX-PROF, a[1]), (QX-PROF-CORR, a[1]), zb+LAJE, zb+1.1)
        parede_reta('reboco', (QX-PROF, a[1]), (QX-PROF-CORR, a[1]), zb+2.2, zb+LV)
        janela((QX-PROF-CORR/2, a[1]), CORR, zb+1.1, zb+2.2, True, -1, ac=False)
    # Terraços das pontas: piso, guarda-corpo, mureta no eixo do corredor, spa e bancada.
    for u in pontas:
        if 'terracoM' not in u:
            continue
        tx, tz = u['terracoM']['x'], u['terracoM']['z']
        zt = zb   # o terraço é a laje de cobertura do andar de baixo, no nível deste andar
        (x0, y0), (x1, y1) = arq(tx[0], tz[0]), arq(tx[1], tz[1])
        box('piso-terraco', (x0+x1)/2, zt+LAJE+.01, (y0+y1)/2, x1-x0, .02, y1-y0)
        if ala == 'sul':
            xe = tx[0]
            guarda_corpo((xe, tz[0]), (xe, tz[1]), zt+LAJE, False, -1)
            zf = tz[1] if u['lado'] == 'fora' else tz[0]
            guarda_corpo((tx[0], zf), (tx[1], zf), zt+LAJE, True, 1 if u['lado'] == 'fora' else -1)
            spa = (tx[0]+1.25, (tz[0]+tz[1])/2+(.6 if u['lado'] == 'fora' else -.6))
        else:
            ze = tz[0]
            guarda_corpo((tx[0], ze), (tx[1], ze), zt+LAJE, True, -1)
            xf = tx[1] if u['lado'] == 'fora' else tx[0]
            guarda_corpo((xf, tz[0]), (xf, tz[1]), zt+LAJE, False, 1 if u['lado'] == 'fora' else -1)
            spa = ((tx[0]+tx[1])/2+(.6 if u['lado'] == 'fora' else -.6), tz[0]+1.25)
        sx, sy = arq(*spa)
        box('spa', sx, zt+LAJE+.42, sy, 1.9, .84, 1.9)
        box('agua-spa', sx, zt+LAJE+.85, sy, 1.55, .02, 1.55)
        for dx, dy in ((-.85, -.85), (.85, .85)):
            box('ar-condicionado', sx+dx, zt+LAJE+.9, sy+dy, .26, .1, .26)
    # Mureta bege entre os terraços dos dois lados (no eixo do corredor), como em galeria-01.
    tt = [u for u in pontas if 'terracoM' in u]
    if tt:
        tx, tz = tt[0]['terracoM']['x'], tt[0]['terracoM']['z']
        if ala == 'sul':
            (x0, _), (x1, _) = arq(tx[0], 0), arq(tx[1], 0)
            _, yc = arq(0, QZ-PROF-CORR/2)
            box('mureta', (x0+x1)/2, zb+LAJE+.9, yc, x1-x0, 1.8, .15)
        else:
            (_, y0), (_, y1) = arq(0, tz[0]), arq(0, tz[1])
            xc, _ = arq(QX-PROF-CORR/2, 0)
            box('mureta', xc, zb+LAJE+.9, (y0+y1)/2, .15, 1.8, y1-y0)


def laje_ala(ala, andar, z):
    """Laje do andar: a ala até a ponta do andar de BAIXO (ela é o teto dele e o piso do terraço) + o núcleo."""
    fim = ponta(ala, andar-1)
    if ala == 'sul':
        (x0, y0), (x1, y1) = arq(QX-FUNDO-fim, QZ-FUNDO), arq(QX, QZ)
    else:
        (x0, y0), (x1, y1) = arq(QX-FUNDO, QZ-FUNDO-fim), arq(QX, QZ-FUNDO)
    box('laje', (x0+x1)/2, z+LAJE/2, (y0+y1)/2, x1-x0, LAJE, y1-y0)


def marcar(objs, torre, andar, role):
    for ob in objs:
        ob['tower'] = torre; ob['floor'] = andar-A0; ob['role'] = role if ob['acabamento'] == 'reboco' or role != 'paredes' else 'detalhes-panos'


# ---------- Torre: andar por andar (geometria diferente em cada um por causa dos degraus) ----------
for andar in range(A0, A1+1):
    for t_i, ala in enumerate(('sul', 'leste')):
        andar_ala(ala, andar)
        marcar(flush(f'andar{andar:02d}-{ala}'), t_i, andar, 'paredes')
        laje_ala(ala, andar, base(andar))
        marcar(flush(f'laje{andar:02d}-{ala}'), t_i, andar, 'lajes')

# Cobertura de cada ponta + platibanda e o bloco da caixa d'água sobre o núcleo (galeria-00).
TOPO = base(A1)+LV
for t_i, ala in enumerate(('sul', 'leste')):
    laje_ala(ala, A1+1, TOPO)
    fim = ponta(ala, A1)
    if ala == 'sul':
        pts = [(QX-FUNDO-fim, QZ-FUNDO), (QX, QZ-FUNDO), (QX, QZ), (QX-FUNDO-fim, QZ)]
    else:
        pts = [(QX-FUNDO, QZ-FUNDO-fim), (QX, QZ-FUNDO-fim), (QX, QZ-FUNDO), (QX-FUNDO, QZ-FUNDO)]
    for a, b in zip(pts, pts[1:]+pts[:1]):
        parede_reta('reboco', a, b, TOPO+LAJE, TOPO+1.1, .15)
    marcar(flush(f'cobertura-{ala}'), t_i, A1+1, 'cobertura')
(nx0, ny0), (nx1, ny1) = arq(QX-FUNDO+.6, QZ-FUNDO+.6), arq(QX-.6, QZ-.6)
box('reboco', (nx0+nx1)/2, TOPO+3.4, (ny0+ny1)/2, nx1-nx0, 6.5, ny1-ny0)
box('cobertura', (nx0+nx1)/2, TOPO+6.7, (ny0+ny1)/2, nx1-nx0+.3, .12, ny1-ny0+.3)
marcar(flush('caixa-dagua'), 0, A1+1, 'cobertura')

# ---------- Embasamento (garagem) e o lazer em cima (galeria-00 e galeria-15) ----------
E0 = 1.0   # recuo do embasamento para dentro do lote
(lx0, ly0), (lx1, ly1) = arq(LOTE[0][0]+E0, LOTE[0][1]+E0), arq(LOTE[2][0]-E0, LOTE[2][1]-E0)
box('embasamento', (lx0+lx1)/2, H0/2, (ly0+ly1)/2, lx1-lx0, H0, ly1-ly0)
for zz in (1.5, 4.5, 7.5):    # três faixas escuras de ventilação da garagem nas fachadas das ruas
    box('garagem-vao', (lx0+lx1)/2, zz, ly0-.02, lx1-lx0-2, .9, .06)            # norte (XV)
    box('garagem-vao', lx0-.02, zz, (ly0+ly1)/2, .06, .9, ly1-ly0-2)            # oeste (Major Manoel)
box('laje', (lx0+lx1)/2, H0+.05, (ly0+ly1)/2, lx1-lx0, .1, ly1-ly0)
for a, b in [((lx0, ly0), (lx1, ly0)), ((lx0, ly0), (lx0, ly1))]:   # platibanda branca nas ruas
    (ax, ay), (bx, by) = a, b
    if ay == by:
        box('reboco', (ax+bx)/2, H0+.6, ay+.1, bx-ax, 1.2, .2)
    else:
        box('reboco', ax+.1, H0+.6, (ay+by)/2, .2, 1.2, by-ay)
for ob in flush('embasamento'):
    ob['tower'] = -1; ob['role'] = 'implantacao'

ZD = H0+.1
for l in IMPL['lazer']:
    x0, z0, x1, z1 = l['m']
    (ax, ay), (bx, by) = arq(x0, z0), arq(x1, z1)
    x, y, w, d = (ax+bx)/2, (ay+by)/2, bx-ax, by-ay
    tipo = l['tipo']
    if tipo == 'edificio':
        h = l.get('altura', 3.0)
        box('reboco', x, ZD+h/2, y, w, h, d)
        box('telhado-lazer', x, ZD+h+.1, y, w+.8, .2, d+.8)
        janela(((x0+x1)/2, z1), min(w*.6, 4), ZD+.2, ZD+2.4, True, 1, ac=False)
    elif tipo == 'piscina':
        box('site-azulejo', x, ZD+.06, y, w, .1, d)
        box('site-agua', x, ZD+.12, y, w-.3, .04, d-.3)
    elif tipo == 'deck':
        box('madeira-terraco', x, ZD+.03, y, w, .05, d)
    elif 'Playground' in l['nome']:
        box('site-play-azul', x, ZD+.04, y, w, .06, d)
    else:
        box('site-piso', x, ZD+.02, y, w, .04, d)
# Pista "RUN FAST 100m" na borda oeste do lazer (galeria-08 e galeria-15).
(px0, py0), (px1, py1) = arq(LOTE[0][0]+2.2, LOTE[0][1]+3), arq(LOTE[0][0]+4.0, QZ-FUNDO-1)
box('pista', (px0+px1)/2, ZD+.04, (py0+py1)/2, px1-px0, .06, py1-py0)
for ob in flush('lazer'):
    ob['tower'] = -1; ob['role'] = 'implantacao'


def arvore(x, y, z, h, raio, rng, cartoes=180, lado=1.2):
    """Árvore de folhas do Mooca (cartões com folhas.webp), com base na altura z."""
    from mathutils import Vector
    topo = h*.55
    mi.rod('site-tronco', (x, y, z), (x, y, z+topo), .12, .7, detail='arvore')
    cy = z+h*.68
    for k in range(5):
        ang = k*math.tau/5+rng.uniform(-.4, .4)
        alvo = (x+math.cos(ang)*raio*.6, y+math.sin(ang)*raio*.6, cy+rng.uniform(-.5, 1.0))
        mi.rod('site-tronco', (x, y, z+topo*.85), alvo, .05, .5, detail='arvore')
    verts, faces, uvs = [], [], []
    centro = Vector((x, -y, cy))
    for _ in range(cartoes):
        while True:
            dd = Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), rng.uniform(-1, 1)))
            if .25 < dd.length <= 1:
                break
        p = centro+Vector((dd.x*raio, dd.y*raio, dd.z*h*.3))
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


# Três árvores da praça do lazer (galeria-15) e vasos com árvore nos terraços do degrau (galeria-01).
praca = next(l for l in IMPL['lazer'] if 'Praça' in l['nome'])
x0, z0, x1, z1 = praca['m']
for f in (.2, .5, .8):
    x, y = arq(x0+(x1-x0)*f, (z0+z1)/2)
    box('vaso', x, ZD+.3, y, 2.2, .6, 2.2)
    arvore(x, y, ZD+.6, rng.uniform(5.5, 6.5), rng.uniform(2.0, 2.4), rng)
for u in UNIDADES:
    if 'terracoM' in u and u['lado'] == 'patio':
        tx, tz = u['terracoM']['x'], u['terracoM']['z']
        x, y = arq(tx[1]-.5, tz[0]+.5) if u['ala'] == 'sul' else arq(tx[0]+.5, tz[1]-.5)
        zt = base(u['andar'])+LAJE
        box('vaso', x, zt+.25, y, .5, .5, .5)
        arvore(x, y, zt+.5, 1.6, .55, rng, cartoes=28, lado=.6)

# Ruas (eixos no OSM: XV em z=0, Major Manoel em x=0), calçadas e palmeiras da XV (galeria-15).
for (x0, z0, x1, z1, mat, h) in [(-30, -4.5, 100, 4.5, 'site-asfalto', .02), (-4.5, -30, 4.5, 100, 'site-asfalto', .02),
                                 (-30, 4.5, 100, 6.0, 'site-piso', .12), (4.5, 6.0, 6.0, 100, 'site-piso', .12),
                                 (-30, -6.0, 100, -4.5, 'site-piso', .12), (-6.0, 6.0, -4.5, 100, 'site-piso', .12)]:
    (ax, ay), (bx, by) = arq(x0, z0), arq(x1, z1)
    box(mat, (ax+bx)/2, h/2, (ay+by)/2, bx-ax, h, by-ay)
(gx0, gy0), (gx1, gy1) = arq(-40, -40), arq(110, 110)
box('site-grama', (gx0+gx1)/2, -.03, (gy0+gy1)/2, gx1-gx0, .02, gy1-gy0)
for k in range(7):
    mi.palm(*arq(12+k*8.5, 5.2), h=rng.uniform(6.5, 8), rng=rng)
for ob in flush('implantacao'):
    ob['tower'] = -1; ob['role'] = 'implantacao'

# ---------- Exporta ----------
alas_md = []
for t_i, ala in enumerate(('sul', 'leste')):
    a = ALAS[ala]
    comp = a['comprimentoM']
    if ala == 'sul':
        (x0, y0), (x1, y1) = arq(QX-FUNDO-comp, QZ-FUNDO), arq(QX, QZ)
    else:
        (x0, y0), (x1, y1) = arq(QX-FUNDO, QZ-FUNDO-comp), arq(QX, QZ-FUNDO)
    alas_md.append({'id': ala, 'indice': t_i, 'caixa': [x0, y0, x1, y1]})
metadata = {'towers': 0, 'floors': A1-A0+1, 'floorHeight': LV, 'baseHeight': H0, 'firstFloor': A0, 'laje': LAJE,
            'units': len(UNIDADES), 'origemM': [CX, CZ], 'ancoraGeo': IMPL['registro']['origemGeo'],
            'rumo_cima_graus': 0, 'alas': alas_md, 'quinaSE': [QX, QZ], 'fundoAla': FUNDO,
            'source': 'Plantas e renders públicos do Grupo Plano (grupoplano.eng.br, nov/2026)'}
exportar(OUT, 'vistas', metadata)

# ---------- Render de conferência (Cycles), nas câmeras dos renders do site ----------
from mathutils import Vector
world = bpy.data.worlds.new('WORLD-vistas'); world.use_nodes = True; scene.world = world
nodes = world.node_tree.nodes; nodes.clear()
bg = nodes.new('ShaderNodeBackground'); bg.inputs['Color'].default_value = (.45, .62, .85, 1); bg.inputs['Strength'].default_value = 1.0
o = nodes.new('ShaderNodeOutputWorld'); world.node_tree.links.new(bg.outputs[0], o.inputs[0])
sun = bpy.data.lights.new('LGT-sol', 'SUN'); sun.energy = 4.0; sun.angle = .02
so = bpy.data.objects.new('LGT-sol', sun); scene.collection.objects.link(so)
so.rotation_euler = (math.radians(40), 0, math.radians(200))    # sol do norte (hemisfério sul), fim da manhã


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
scene.render.image_settings.file_format = 'JPEG'; scene.render.image_settings.quality = 88
scene.view_settings.view_transform = 'AgX'
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'vistas.blend'))
if '--no-render' not in sys.argv:
    # Blender: y = -z do lote (norte = +y). galeria-00: drone a noroeste, alto; galeria-15: do norte, olhando
    # a face do pátio da ala sul por cima do lazer.
    cx_, cy_ = arq(QX-30, QZ-20)
    for nome, loc, alvo, lente, res in [('aerea', (cx_-25, -cy_+175, 105), (cx_+5, -cy_, 28), 30, (1400, 980)),
                                         ('patio', (cx_-4, -cy_+95, 40), (cx_-4, -cy_-5, 32), 26, (1000, 1250)),
                                         # galeria-01: de perto, olhando os terraços da ponta oeste da ala sul
                                         ('terraco', (*(lambda p: (p[0]-9, -p[1]+16))(arq(QX-FUNDO-ponta('sul', 13), QZ-FUNDO)), base(13)+7),
                                          (*(lambda p: (p[0]+2, -p[1]-4))(arq(QX-FUNDO-ponta('sul', 13), QZ-FUNDO)), base(13)), 24, (900, 1125))]:
        cam.location = loc; aim(cam, alvo); cam_data.lens = lente
        scene.render.resolution_x, scene.render.resolution_y = res
        scene.render.filepath = str(OUT/f'preview-{nome}.jpg'); bpy.ops.render.render(write_still=True)
print('VISTAS_READY', json.dumps({'unidades': len(UNIDADES), 'andares': A1-A0+1}), flush=True)

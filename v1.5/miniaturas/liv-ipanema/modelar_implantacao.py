"""Implantação LIV Ipanema, reconstruída das imagens oficiais de divulgação.

Chamado pelo autor da torre; não limpa a cena, não exporta e não renderiza.
Os comprimentos são estimativas proporcionais da implantação, não levantamento.
"""
import bpy
import math
import random
from mathutils import Vector
from blender_maquete_base import material, box, flush, MATS

SCALE = .145
POLYGON_PX = [(42, 80), (508, 80), (560, 132), (656, 684), (45, 684)]
_templates = {}
_created = []


def xy(u, v):
    return ((432-v)*SCALE, (u-315)*SCALE)


def _tag(ob, detail=None):
    ob['tower'] = -1
    ob['role'] = 'implantacao'
    if detail:
        ob['elemento'] = detail
    _created.append(ob)
    return ob


def _mesh(name, mat, verts, faces, smooth=False):
    me = bpy.data.meshes.new('SITE-'+name)
    me.from_pydata(verts, [], faces)
    me.update()
    me.materials.append(MATS[mat])
    if smooth:
        for p in me.polygons:
            p.use_smooth = True
    return me


def _object(name, me, x=0, y=0, z=0, scale=(1, 1, 1), angle=0, detail=None):
    ob = bpy.data.objects.new('GEO-SITE-'+name, me)
    bpy.context.scene.collection.objects.link(ob)
    ob.location = (x, -y, z)
    ob.scale = scale
    ob.rotation_euler.z = -angle
    ob['acabamento'] = me.materials[0].name.removeprefix('MAT-')
    return _tag(ob, detail)


def polygon(name, mat, points, top=.07, bottom=None):
    # Architectonic x/y converted once to Blender x/-y.
    coords = [xy(u, v) for u, v in points]
    n = len(coords)
    verts = [(x, -y, top) for x, y in coords]
    faces = [tuple(reversed(range(n)))]
    if bottom is not None:
        verts += [(x, -y, bottom) for x, y in coords]
        faces += [tuple(range(n, 2*n))]
        faces += [(i, (i+1)%n, (i+1)%n+n, i+n) for i in range(n)]
    return _object(name, _mesh(name, mat, verts, faces))


def pxbox(mat, u, v, du, dv, h=.08, z=.08):
    x, y = xy(u, v)
    box(mat, x, z, y, dv*SCALE, h, du*SCALE)


def _cylinder_mesh(mat, taper=1, sides=12):
    key = ('cylinder', mat, taper, sides)
    if key not in _templates:
        verts = []
        for z, r in [(0, 1), (1, taper)]:
            verts.extend((r*math.cos(i*math.tau/sides), r*math.sin(i*math.tau/sides), z) for i in range(sides))
        faces = [tuple(reversed(range(sides))), tuple(range(sides, sides*2))]
        faces += [(i, (i+1)%sides, (i+1)%sides+sides, i+sides) for i in range(sides)]
        _templates[key] = _mesh('cylinder-'+mat+'-'+str(taper)+'-'+str(sides), mat, verts, faces, True)
    return _templates[key]


def rod(mat, a, b, radius=.05, taper=1, sides=8, detail=None):
    # Endpoints a/b use x/y/z architectural coordinates.
    va, vb = Vector((a[0], -a[1], a[2])), Vector((b[0], -b[1], b[2]))
    delta = vb-va
    ob = _object('rod', _cylinder_mesh(mat, taper, sides), a[0], a[1], a[2], (radius, radius, delta.length), detail=detail)
    ob.rotation_euler = delta.to_track_quat('Z', 'Y').to_euler()
    return ob


def sphere(mat, x, y, z, sx, sy, sz, angle=0, detail=None):
    key = ('ico', mat)
    if key not in _templates:
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=1)
        tmp = bpy.context.object
        me = tmp.data
        me.name = 'SITE-organic-'+mat
        me.materials.append(MATS[mat])
        for p in me.polygons:
            p.use_smooth = True
        _templates[key] = me
        bpy.data.objects.remove(tmp, do_unlink=True)
    return _object('folhagem', _templates[key], x, y, z, (sx, sy, sz), angle, detail)


def tree(u, v, height, spread, rng, forest=False):
    x, y = xy(u, v)
    drift = rng.uniform(-.35, .35)
    rod('site-tronco', (x, y, .1), (x+drift, y+.12, height*.72), .14 if forest else .10, .62, detail='arvore')
    leaf = rng.choice(['site-folha-escura', 'site-folha-media', 'site-folha-clara'])
    # Overlapping anisotropic crowns preserve a loose organic silhouette.
    for dx, dy, dz, f in [(0, 0, 0, 1), (-.42, .12, -.18, .69), (.4, .25, -.12, .75), (.12, -.38, .17, .71)]:
        sphere(leaf, x+dx*spread, y+dy*spread, height+dz*spread,
               spread*f, spread*f*.87, spread*f*.91, rng.uniform(0, math.tau), 'bosque' if forest else 'arvore')


def _palm_mesh(mat):
    key = ('palm', mat)
    if key in _templates:
        return _templates[key]
    verts, faces = [], []
    # Eight arched fronds, each with 10 pairs of tapered leaflets.
    for k in range(8):
        ang = k*math.tau/8
        cs, sn = math.cos(ang), math.sin(ang)
        def point(s, side=0):
            d = 3.1*s
            zz = .85*math.sin(s*math.pi)-.8*s*s
            return (cs*d-sn*side, sn*d+cs*side, zz)
        for j in range(10):
            s = .1+j*.085
            width = .52*math.sin(s*math.pi)+.08
            for sign in (-1, 1):
                base = len(verts)
                verts += [point(s-.035), point(s+.045), point(s+.13, width*sign)]
                faces.append((base, base+1, base+2))
                faces.append((base+2, base+1, base))
    _templates[key] = _mesh('palmeira-frondes-'+mat, mat, verts, faces)
    return _templates[key]


def palm(u, v, h=7, factor=1, rng=None):
    rng = rng or random.Random(0)
    x, y = xy(u, v)
    drift = rng.uniform(-.4, .4)
    previous = (x, y, .12)
    for i in range(4):
        t = (i+1)/4
        current = (x+drift*t*t, y+.22*t*t, h*t)
        rod('site-tronco-palmeira', previous, current, .15*(1-.3*t), .93, 9, 'palmeira')
        previous = current
    _object('palmeira-frondes', _palm_mesh('site-palmeira'), previous[0], previous[1], h, (factor, factor, factor), rng.uniform(0, math.tau), 'palmeira')
    sphere('site-folha-escura', previous[0], previous[1], h+.08, .30, .30, .35, detail='palmeira')


def fence(points, solid=False, skip_last=False):
    for idx, (pa, pb) in enumerate(zip(points, points[1:])):
        ax, ay = xy(*pa)
        bx, by = xy(*pb)
        length = math.hypot(bx-ax, by-ay)
        rod('site-muro', (ax, ay, .25), (bx, by, .25), .17, sides=4)
        if solid:
            # Vertical wall follows each lot edge, independent of box angle semantics.
            verts = [(ax, -ay, .1), (bx, -by, .1), (bx, -by, 2.2), (ax, -ay, 2.2)]
            _object('muro-limite', _mesh('muro-'+str(idx), 'site-muro', verts, [(0, 1, 2, 3), (3, 2, 1, 0)]))
            continue
        rod('site-metal', (ax, ay, 1.55), (bx, by, 1.55), .045)
        rod('site-metal', (ax, ay, .65), (bx, by, .65), .035)
        n = max(1, int(length/.48))
        for i in range(n+1):
            t = i/n
            xx, yy = ax+(bx-ax)*t, ay+(by-ay)*t
            rod('site-metal', (xx, yy, .28), (xx, yy, 1.72), .030 if i%5 else .055, sides=6)


def bench(x, y, z=.15, angle=0):
    for dz in (0, .11, .22):
        box('site-madeira', x, z+.5+dz, y, 1.7, .07, .48)
    for dx in (-.65, .65):
        rod('site-metal', (x+dx, y, z), (x+dx, y, z+.6), .045)
    box('site-madeira', x, z+1.0, y-.22, 1.7, .36, .065)


def chair(x, y, z=.13):
    box('site-movel', x, z+.45, y, .47, .07, .47)
    box('site-movel', x, z+.77, y-.23, .47, .58, .065)
    for dx in (-.20, .20):
        for dy in (-.20, .20):
            rod('site-metal', (x+dx, y+dy, z), (x+dx, y+dy, z+.43), .025, sides=6)


def table(x, y, z=.13, size=.8):
    rod('site-movel', (x, y, z+.77), (x, y, z+.83), size/2, sides=12)
    rod('site-metal', (x, y, z), (x, y, z+.79), .055)


def umbrella(x, y, z=.13, radius=1.3):
    rod('site-madeira', (x, y, z), (x, y, z+2.65), .045)
    key = ('umbrella', 'site-sombra')
    if key not in _templates:
        verts = [(0, 0, .52)] + [(math.cos(i*math.tau/12), math.sin(i*math.tau/12), 0) for i in range(12)]
        faces = [(0, i+1, (i+1)%12+1) for i in range(12)]
        faces += [tuple(reversed(f)) for f in list(faces)]
        _templates[key] = _mesh('ombrelone', 'site-sombra', verts, faces)
    _object('ombrelone', _templates[key], x, y, z+2.3, (radius, radius, 1), detail='piscina')


def _vehicle_mesh(mat):
    key = ('car', mat)
    if key in _templates:
        return _templates[key]
    # Shaped bumper / hood / cabin / trunk, long axis along architectonic y.
    verts = []
    sections = [(-2.12, .73, .22, .66), (-1.82, .91, .22, .86), (-.95, .91, .22, .92),
                (-.56, .81, .22, 1.48), (.72, .81, .22, 1.47), (1.30, .89, .22, .9), (2.10, .79, .22, .72)]
    for y, w, lo, hi in sections:
        verts += [(-w, -y, lo), (w, -y, lo), (w, -y, hi), (-w, -y, hi)]
    faces = [(0, 3, 2, 1), tuple(range(len(verts)-4, len(verts)))]
    for k in range(len(sections)-1):
        for j in range(4):
            faces.append((k*4+j, k*4+(j+1)%4, (k+1)*4+(j+1)%4, (k+1)*4+j))
    _templates[key] = _mesh('carroceria-'+mat, mat, verts, faces)
    return _templates[key]


def car(u, v, mat, flip=False, scale=1):
    x, y = xy(u, v)
    angle = math.pi if flip else 0
    _object('carro', _vehicle_mesh(mat), x, y, .12, (scale, scale, scale), angle, 'estacionamento')
    # Detail coordinates rotated for opposing rows; bodies and glazing stay separate material.
    def tr(dx, dy, zz):
        cs, sn = math.cos(angle), math.sin(angle)
        return (x+(cs*dx-sn*dy)*scale, y+(sn*dx+cs*dy)*scale, .12+zz*scale)
    for sy in (-1.28, 1.28):
        for sx in (-.91, .91):
            a, b = tr(sx-.10, sy, .38), tr(sx+.10, sy, .38)
            rod('site-pneu', a, b, .32*scale, sides=12, detail='carro')
    # Windscreen and side glass in a small linked mesh.
    key = ('car-glass',)
    if key not in _templates:
        vs = [(-.74, .95, .94), (.74, .95, .94), (.72, .57, 1.44), (-.72, .57, 1.44),
              (-.72, -.72, 1.43), (.72, -.72, 1.43), (.78, -1.22, .94), (-.78, -1.22, .94)]
        fs = [(0, 1, 2, 3), (4, 5, 6, 7), (0, 3, 4, 7), (1, 6, 5, 2)]
        _templates[key] = _mesh('car-vidro', 'site-vidro', vs, fs)
    _object('car-vidro', _templates[key], x, y, .12, (scale, scale, scale), angle)
    for sy, material_name in [(-2.12, 'site-farol'), (2.10, 'site-lanterna')]:
        for sx in (-.58, .58):
            xx, yy, zz = tr(sx, sy, .68)
            box(material_name, xx, zz, yy, .37*scale, .14*scale, .06*scale)


def _materials():
    for name, rgb, rough, metal in [
        ('base', (52, 58, 62), .8, 0), ('asfalto', (64, 68, 67), .94, 0),
        ('piso', (199, 196, 184), .89, 0), ('deck', (229, 222, 207), .83, 0),
        ('grama', (106, 128, 74), 1, 0), ('permeavel', (135, 149, 106), 1, 0),
        ('muro', (185, 185, 174), .88, 0), ('reboco', (228, 225, 211), .85, 0),
        ('cobertura', (86, 91, 89), .76, .05), ('metal', (46, 52, 49), .55, .3),
        ('marcacao', (230, 229, 211), .95, 0), ('amarelo', (237, 207, 59), .8, 0),
        ('agua', (67, 151, 195), .19, .08), ('azulejo', (33, 79, 134), .7, 0),
        ('infantil', (39, 144, 180), .23, 0), ('vidro', (57, 81, 79), .16, .25),
        ('madeira', (143, 104, 63), .9, 0), ('movel', (111, 104, 85), .82, .04),
        ('sombra', (217, 212, 192), .91, 0), ('tronco', (92, 76, 51), 1, 0),
        ('tronco-palmeira', (144, 125, 92), 1, 0), ('palmeira', (73, 107, 49), 1, 0),
        ('folha-escura', (51, 86, 49), 1, 0), ('folha-media', (70, 106, 54), 1, 0),
        ('folha-clara', (97, 125, 66), 1, 0), ('flor', (155, 85, 122), .9, 0),
        ('flor-roxa', (111, 101, 153), 1, 0), ('play-verde', (33, 132, 69), .87, 0),
        ('play-azul', (44, 95, 205), .7, 0), ('play-amarelo', (229, 198, 33), .75, 0),
        ('play-vermelho', (190, 48, 59), .75, 0), ('pneu', (30, 32, 32), .88, 0),
        ('car-branco', (226, 226, 218), .29, .28), ('car-prata', (153, 165, 166), .32, .45),
        ('car-chumbo', (72, 78, 79), .28, .35), ('car-vermelho', (128, 54, 48), .3, .28),
        ('car-azul', (64, 89, 113), .3, .28), ('farol', (222, 227, 203), .24, .2),
        ('lanterna', (159, 40, 38), .3, 0), ('acessivel', (43, 103, 157), .8, 0),
    ]:
        material('site-'+name, rgb, rough, metal)


def _parking(rng):
    # Counts follow the official 175 spaces; individual bay dimensions are inferred.
    rows = [(63, 105, 681, 37), (132, 184, 640, 31), (169, 243, 640, 27),
            (237, 243, 607, 24), (390, 243, 607, 24), (460, 244, 640, 24)]
    bays = []
    for row, (u, lo, hi, count) in enumerate(rows):
        step = (hi-lo)/count
        pxbox('site-permeavel', u, (lo+hi)/2, 34, hi-lo, .04, .08)
        for i in range(count):
            v = lo+(i+.5)*step
            x, y = xy(u, v)
            w = step*SCALE
            box('site-piso', x, .108, y, w*.72, .036, 4.1)
            for edge in (-.5, .5):
                box('site-marcacao', x+edge*w, .14, y, .052, .025, 4.85)
            box('site-marcacao', x, .14, y+2.45, w, .025, .052)
            if row == 4 and i in (17, 18, 19):
                box('site-acessivel', x, .145, y, w*.67, .023, 3.8)
                # Accessible symbol represented as white ring and stem, sized for aerial visibility.
                rod('site-marcacao', (x, y, .164), (x, y, .176), .46, sides=12)
                rod('site-acessivel', (x, y, .177), (x, y, .182), .29, sides=12)
                box('site-marcacao', x-.22, .185, y-.44, .10, .024, .68)
            bays.append((u, v, row))
    # Eight transverse spaces at the short entrance end, exactly 175 in total.
    for i in range(8):
        u = 226+(i+.5)*(181/8)
        pxbox('site-permeavel', u, 631, 181/8-.7, 34, .035, .1)
        x, y = xy(u, 631)
        box('site-piso', x, .125, y, 4.2, .035, 2.05)
        for edge in (-1.58, 1.58):
            box('site-marcacao', x, .155, y+edge, 4.95, .02, .052)
        bays.append((u, 631, 6))
    assert len(bays) == 175
    selected = rng.sample(bays[:-8], 36)
    for i, (u, v, row) in enumerate(selected):
        car(u, v, ['site-car-branco', 'site-car-prata', 'site-car-chumbo', 'site-car-vermelho', 'site-car-azul'][i%5], row%2 == 0, rng.uniform(.87, .98))
    # Crosswalks over three drives at the tower's lower short end.
    for u, v, du in [(199, 442, 29), (427, 470, 29), (97, 159, 26)]:
        for j in range(7):
            pxbox('site-marcacao', u, v+j*2.0, du, .8, .025, .10)
    return len(bays), len(selected)


def _pool():
    # Adult long basin, separate smaller child basin, white paving and vestiários.
    pxbox('site-deck', 518, 302, 78, 132, .13, .12)
    for u, v, du, dv, mat in [(505, 299, 31, 87, 'site-agua'), (539, 326, 16, 32, 'site-infantil')]:
        pxbox('site-azulejo', u, v, du+2, dv+2, .22, .16)
        pxbox(mat, u, v, du, dv, .045, .285)
        for vv in (v-dv/2-1.5, v+dv/2+1.5):
            pxbox('site-deck', u, vv, du+5, 2.0, .11, .29)
        for uu in (u-du/2-1.5, u+du/2+1.5):
            pxbox('site-deck', uu, v, 2, dv, .11, .29)
        xx, yy = xy(u-du/2-1, v+dv*.20)
        for dd in (-.3, .3):
            rod('site-metal', (xx, yy+dd, .35), (xx, yy+dd, 1.05), .035)
            rod('site-metal', (xx, yy+dd, 1.05), (xx+.35, yy+dd, 1.05), .035)
    # Subtle pool lane tile seams, kept shallow and dark blue.
    for v in (276, 291, 306, 321):
        pxbox('site-azulejo', 505, v, 29, .36, .01, .312)
    # Building on the gateward edge of the deck.
    pxbox('site-reboco', 514, 355, 53, 14, 2.75, 1.5)
    pxbox('site-cobertura', 514, 355, 57, 18, .23, 2.98)
    for u in (501, 512, 524):
        pxbox('site-metal', u, 346.7, 6, .22, 2.1, 1.25)
    for u, v in [(537, 261), (542, 289), (537, 349)]:
        x, y = xy(u, v)
        umbrella(x, y, .23, 1.3)
        table(x, y, .23)
        chair(x+1.0, y, .23)
        chair(x-1.0, y, .23)
    for v in (265, 279, 294, 312, 327):
        x, y = xy(484, v)
        # White-framed angled lounge chair with sloped fabric back.
        box('site-movel', x, .53, y, 1.8, .09, .65)
        box('site-sombra', x-.54, .76, y, .65, .08, .65, -.50)
        for dx in (-.66, .66):
            for dy in (-.26, .26):
                rod('site-metal', (x+dx, y+dy, .23), (x+dx, y+dy, .50), .025)
    fence([(482, 246), (482, 364), (552, 364)])


def _entry_and_quiosques():
    # Entrance is a low flat charcoal canopy and a tall rectangular car portal.
    pxbox('site-piso', 594, 631, 66, 92, .10, .16)
    pxbox('site-reboco', 594, 623, 31, 40, 2.95, 1.68)
    pxbox('site-vidro', 578, 623, .3, 26, 1.7, 1.76)
    pxbox('site-metal', 577.6, 623, .25, 26, .10, 2.68)
    pxbox('site-cobertura', 594, 623, 63, 51, .42, 3.40)
    # Portal raised above vehicle lane as in the official portaria render.
    # Pilares estreitos, não paredes de oito metros: abertura legível da rua.
    for u in (621, 651):
        for v in (611, 659):
            pxbox('site-cobertura', u, v, 2.4, 2.4, 4.2, 2.15)
    pxbox('site-cobertura', 636, 635, 32.4, 56, .30, 4.39)
    for v in range(611, 660, 4):
        pxbox('site-metal', 636, v, 29, .75, .12, 4.12)
    for u in (561, 577):
        pxbox('site-reboco', u, 630, 1.7, 37, 3.0, 1.7)
    for v in (645, 666):
        ax, ay = xy(611, v)
        bx, by = xy(649, v)
        rod('site-metal', (ax, ay, .4), (bx, by, .4), .05)
        for u in range(612, 650, 3):
            x, y = xy(u, v)
            rod('site-metal', (x, y, .2), (x, y, 2.65), .037)
    for u in (619, 640):
        pxbox('site-amarelo', u, 673, 22, .8, .027, .20)
    # Gate sign panel; no image texture required for the compact model.
    pxbox('site-reboco', 578, 651, 12, 2, .95, .65)
    pxbox('site-folha-media', 578, 652.2, 8.5, .12, .14, .80)
    # Livon Shop in the amenity garden beside the gate.
    pxbox('site-reboco', 488, 606, 16, 15, 2.5, 1.42)
    pxbox('site-cobertura', 488, 606, 18, 17, .19, 2.78)
    pxbox('site-vidro', 497, 606, .25, 10, 1.8, 1.50)
    # The long grey footprint labelled 05/06 contains the two quiosques.
    pxbox('site-piso', 503, 519, 58, 105, .12, .13)
    pxbox('site-reboco', 502, 519, 37, 83, 2.85, 1.58)
    pxbox('site-vidro', 521, 519, .25, 75, 2.43, 1.65)
    pxbox('site-reboco', 501, 519, 39, 1.4, 2.9, 1.61)
    pxbox('site-cobertura', 503, 519, 46, 91, .34, 3.19)
    for v in (476, 500, 522, 543, 564):
        pxbox('site-metal', 522, v, .8, .8, 2.87, 1.58)
    # Happy Hour billiard table and kitchen, readable when roof is hidden.
    x, y = xy(504, 543)
    box('site-madeira', x, .95, y, 2.1, .2, 1.13)
    box('site-play-verde', x, 1.07, y, 1.88, .045, .96)
    for dx in (-.77, .77):
        for dy in (-.36, .36):
            rod('site-metal', (x+dx, y+dy, .16), (x+dx, y+dy, .88), .055)
    pxbox('site-madeira', 487, 519, 4.3, 73, .85, .62)
    pxbox('site-movel', 487, 519, 5.5, 76, .12, 1.10)
    for v in (485, 500, 556):
        x, y = xy(506, v)
        table(x, y, .18, 1.0)
        for dx, dy in [(1, 0), (-1, 0), (0, 1), (0, -1)]:
            chair(x+dx, y+dy, .18)
    # Pergolado alongside the quiosque's gateward edge.
    for u in (503, 533):
        for v in (577, 590):
            x, y = xy(u, v)
            rod('site-madeira', (x, y, .18), (x, y, 2.77), .065)
    for v in range(577, 591, 2):
        pxbox('site-madeira', 518, v, 32, .8, .17, 2.77)


def _playground_and_fitness():
    # Playground with green mat, blue stairs, yellow slide and red canopy.
    pxbox('site-play-verde', 557, 558, 53, 39, .09, .17)
    x, y = xy(562, 560)
    for dx in (-.64, .64):
        for dy in (-.65, .65):
            rod('site-madeira', (x+dx, y+dy, .21), (x+dx, y+dy, 3.44), .082)
    box('site-play-azul', x, 1.85, y, 1.42, .15, 1.43)
    rod('site-play-vermelho', (x, y, 3.41), (x, y, 3.93), 1.24, taper=0, sides=12)
    # Seven blue staircase treads, yellow handrails.
    for i in range(7):
        box('site-play-azul', x-1.7+i*.16, .30+i*.22, y, .39, .26, .86)
    rod('site-play-amarelo', (x-1.9, y-.46, .75), (x-.65, y-.46, 2.42), .029)
    rod('site-play-amarelo', (x-1.9, y+.46, .75), (x-.65, y+.46, 2.42), .029)
    # Slide follows a curved profile instead of a straight rectangular cuboid.
    verts, faces = [], []
    for i in range(9):
        t = i/8
        xx = x+.6+2.4*t
        zz = .35+1.55*(1-t)**1.35
        verts += [(xx, -y-.43, zz), (xx, -y+.43, zz), (xx, -y-.43, zz+.22), (xx, -y+.43, zz+.22)]
    for i in range(8):
        a, b = i*4, (i+1)*4
        faces += [(a, b, b+1, a+1), (a, a+2, b+2, b), (a+1, b+1, b+3, a+3)]
    _object('escorregador', _mesh('escorregador', 'site-play-amarelo', verts, faces))
    # Green swing frame and seats; full rope geometry rather than colored blocks.
    sx, sy = xy(545, 565)
    for dx in (-1.9, 1.9):
        for dy in (-.9, .9):
            rod('site-play-verde', (sx+dx, sy+dy, .20), (sx+dx, sy, 2.44), .042)
    rod('site-play-verde', (sx-1.9, sy, 2.44), (sx+1.9, sy, 2.44), .055)
    for dx in (-.8, .8):
        for dd in (-.24, .24):
            rod('site-madeira', (sx+dx+dd, sy, 2.37), (sx+dx+dd, sy, .72), .012, sides=6)
        box('site-madeira', sx+dx, .70, sy, .57, .08, .35)
    # Outdoor timber fitness: pull-up frames and inclined bench from reference.
    pxbox('site-piso', 522, 405, 54, 46, .08, .12)
    fx, fy = xy(522, 405)
    for offset, h, width in [(-1.6, 2.6, 1.7), (.7, 2.15, 1.6), (2.8, 1.55, 1.4)]:
        for dy in (-width/2, width/2):
            rod('site-madeira', (fx+offset, fy+dy, .18), (fx+offset, fy+dy, h), .08)
        rod('site-madeira', (fx+offset, fy-width/2, h), (fx+offset, fy+width/2, h), .08)
    box('site-madeira', fx-1.4, .63, fy+2.1, 2.05, .09, .58, -.30)
    for dx, h in [(-2.20, .9), (-.60, .38)]:
        for dy in (1.88, 2.32):
            rod('site-madeira', (fx+dx, fy+dy, .18), (fx+dx, fy+dy, h), .065)
    # Agility ladder at ground level.
    for dy in (-.45, .45):
        rod('site-madeira', (fx-3.3, fy+dy, .20), (fx-6.3, fy+dy, .20), .055)
    for i in range(9):
        rod('site-madeira', (fx-3.3-i*.34, fy-.45, .20), (fx-3.3-i*.34, fy+.45, .20), .04)


def _landscape(rng):
    # Continuous forest at the far short end, with large irregular overlapping crowns.
    polygon('bosque-solo', 'site-grama', [(179, 83), (475, 83), (522, 109), (547, 202), (540, 233), (180, 233)], .075)
    total = 0
    for v in range(95, 232, 17):
        for u in range(190, 539, 23):
            uu, vv = u+rng.uniform(-7, 7), v+rng.uniform(-6, 6)
            # Retain softened corner toward the street.
            if uu > 520 and vv < 140:
                continue
            tree(uu, vv, rng.uniform(4.0, 6.3), rng.uniform(1.75, 2.5), rng, True)
            total += 1
    # Amenity garden serpentine footprint follows the diagonal street boundary.
    polygon('lazer-jardim', 'site-grama', [(479, 371), (570, 372), (551, 451), (580, 494), (592, 537),
                                          (585, 589), (528, 624), (479, 647)], .08)
    # Garden paths link the pool, fitness, orchard, quiosques and gate.
    polygon('caminho-lazer', 'site-piso', [(525, 369), (538, 369), (538, 435), (558, 450), (558, 529),
                                        (536, 557), (536, 612), (521, 612), (521, 549), (545, 521),
                                        (545, 456), (525, 442)], .115)
    pxbox('site-piso', 524, 448, 72, 8, .07, .11)
    pxbox('site-piso', 551, 474, 48, 7, .07, .11)
    # Horta and pomar are distinct planted areas, below the fitness garden.
    for u in (488, 498, 508):
        for v in (438, 445):
            pxbox('site-madeira', u, v, 7.0, 4.2, .22, .21)
            pxbox('site-folha-media', u, v, 6.3, 3.4, .22, .33)
    for u, v in [(554, 475), (558, 494), (559, 512), (554, 455), (545, 433)]:
        tree(u, v, rng.uniform(2.6, 3.2), .94, rng)
        total += 1
    # Palms beside pool, visitor gardens and landscaped street-side border.
    palm_locations = [(478, 257), (478, 292), (480, 330), (552, 349), (562, 393), (560, 429),
                      (575, 481), (583, 539), (547, 600), (553, 638), (618, 593), (578, 207), (565, 159)]
    for i, (u, v) in enumerate(palm_locations):
        palm(u, v, rng.uniform(5.8, 7.4), rng.uniform(.82, 1.03), rng)
    # Street hedges: irregular rounded shrubs with sparse flowering accents.
    for u, v in [(479, k) for k in range(379, 641, 15)] + [(552, k) for k in range(239, 352, 12)]:
        x, y = xy(u, v)
        sphere('site-folha-media', x, y, .65, .73, .48, .58, rng.random(), 'arbusto')
        if v%3 == 0:
            sphere('site-flor-roxa', x+.12, y+.08, 1.07, .53, .40, .20, detail='flor')
    # Flower beds beside entry/playground, high enough to read in oblique view.
    for u, v in [(531, 595), (553, 537), (584, 602), (528, 451), (498, 378)]:
        for j in range(3):
            x, y = xy(u+j*3.5, v)
            sphere('site-folha-escura', x, y, .5, .55, .45, .43, detail='arbusto')
            sphere('site-flor', x, y, .83, .43, .32, .18, detail='flor')
    for u, v in [(521, 435), (535, 455), (556, 523), (540, 585)]:
        x, y = xy(u, v)
        bench(x, y)
    # Picnic and lounge nodes.
    for u, v in [(551, 435), (512, 435)]:
        x, y = xy(u, v)
        table(x, y, size=1.1)
        for dx in (-1.1, 1.1):
            chair(x+dx, y)
    # Redário: two suspended cloth hammocks with a visibly sagging profile.
    for u, v in [(572, 381), (588, 382)]:
        hx, hy = xy(u, v)
        for dx in (-1.9, 1.9):
            rod('site-madeira', (hx+dx, hy, .13), (hx+dx, hy, 2.05), .085, detail='redario')
        verts, faces = [], []
        for i in range(11):
            t = i/10
            xx = hx-1.62+3.24*t
            zz = 1.62-.77*math.sin(t*math.pi)
            halfwidth = .09+.38*math.sin(t*math.pi)
            verts += [(xx, -hy-halfwidth, zz), (xx, -hy+halfwidth, zz)]
        for i in range(10):
            faces.append((i*2, i*2+1, i*2+3, i*2+2))
            faces.append((i*2+2, i*2+3, i*2+1, i*2))
        _object('rede-redario', _mesh('rede-redario-'+str(u), 'site-sombra', verts, faces), detail='redario')
        rod('site-madeira', (hx-1.9, hy, 1.92), (hx-1.62, hy, 1.62), .014)
        rod('site-madeira', (hx+1.9, hy, 1.92), (hx+1.62, hy, 1.62), .014)
    # Kids Air marked in planting; a compact low balance trail.
    for i in range(7):
        x, y = xy(550, 510+i*3)
        rod('site-madeira', (x, y, .12), (x, y, .35+(i%3)*.08), .20, sides=10)
    return total, len(palm_locations)


def _utilities_and_lighting():
    # White cylindrical water tank, distinct from the tower.
    x, y = xy(151, 129)
    rod('site-reboco', (x, y, .12), (x, y, 8.5), 2.55, taper=.97, sides=32, detail='caixa-agua')
    rod('site-reboco', (x, y, 8.45), (x, y, 8.64), 2.54, taper=.92, sides=32)
    rod('site-reboco', (x, y, 8.64), (x, y, 8.88), 2.32, taper=.83, sides=32)
    # Service yard / refuse / GLP enclosure near the tank.
    pxbox('site-reboco', 151, 88, 58, 10, 1.6, .96)
    pxbox('site-cobertura', 151, 88, 59, 12, .12, 1.83)
    for u in (123, 132, 140):
        pxbox('site-metal', u, 96, 6, .22, 1.1, .93)
    # Car wash at the start of the side parking drive.
    pxbox('site-piso', 130, 177, 35, 37, .10, .11)
    for u in (114, 146):
        for v in (164, 192):
            xx, yy = xy(u, v)
            rod('site-metal', (xx, yy, .12), (xx, yy, 2.75), .075)
    pxbox('site-cobertura', 130, 178, 36, 33, .15, 2.83)
    # Small pet care node at forest/tower transition.
    pxbox('site-madeira', 286, 250, 35, 4.5, .14, .36)
    # Street/site luminaires: slim posts and square head, grounded in reference.
    for u, v in [(482, 254), (553, 304), (542, 410), (560, 490), (528, 576), (604, 607),
                 (106, 249), (201, 328), (200, 517), (424, 332), (424, 571), (290, 658)]:
        xx, yy = xy(u, v)
        rod('site-metal', (xx, yy, .12), (xx, yy, 4.8), .045)
        box('site-metal', xx+.19, 4.80, yy, .65, .10, .40)
        box('site-farol', xx+.19, 4.745, yy, .53, .035, .31)
    # Bicycle stands beside piscina/pergolado.
    for u in (536, 540, 544, 548):
        xx, yy = xy(u, 371)
        for dx in (-.35, .35):
            rod('site-metal', (xx+dx, yy, .12), (xx+dx, yy, .8), .022)
        rod('site-metal', (xx-.35, yy, .8), (xx+.35, yy, .8), .022)


def build_site():
    """Build the complete ground scene and return reproducible counts."""
    _created.clear()
    _templates.clear()
    rng = random.Random(20261008)
    _materials()
    polygon('base-perimetro', 'site-base', POLYGON_PX, .015, -.95)
    polygon('asfalto-implantacao', 'site-asfalto', POLYGON_PX, .065)
    # Light perimeter sidewalk is restricted to the official outline.
    polygon('passeio-rua', 'site-piso', [(508, 80), (560, 132), (656, 684), (635, 684), (540, 141), (489, 80)], .085)
    # Footpath around main building and thin grass islands in long parking rows.
    pxbox('site-piso', 315, 432, 112, 361, .11, .1)
    for u in (113, 185, 217, 412, 440):
        pxbox('site-grama', u, 447, 3.2, 383, .04, .095)
    # Tower footpath leaves no unnecessary terrain beyond the maquette base.
    parking_count, cars_count = _parking(rng)
    _pool()
    _entry_and_quiosques()
    _playground_and_fitness()
    trees_count, palms_count = _landscape(rng)
    _utilities_and_lighting()
    # Two sides masonry; street front transparent fencing, with entrance gap.
    fence([(42, 80), (45, 684), (551, 684)], solid=True)
    fence([(42, 80), (508, 80)], solid=True)
    fence([(508, 80), (560, 132), (633, 565)])
    fence([(651, 668), (656, 684)])
    objects = flush('SITE-implantacao')
    for ob in objects:
        _tag(ob)
    unique_meshes = {ob.data.name: ob.data for ob in _created if ob.type == 'MESH'}
    stats = {
        'parking_spaces': parking_count,
        'cars': cars_count,
        'trees': trees_count,
        'palms': palms_count,
        'site_objects': len(_created),
        'unique_site_meshes': len(unique_meshes),
        'unique_site_vertices': sum(len(me.vertices) for me in unique_meshes.values()),
        'official_site_area_m2': 6921.79,
        'site_dimensions_are_inferred': True,
        'amenities': ['portaria', 'livon-shop', 'pergolado', 'playground', 'quiosque-happy-hour',
                      'quiosque-steak-house', 'kids-air', 'pomar', 'horta', 'lounge', 'piquenique',
                      'espaco-fitness', 'bicicletario', 'redario', 'piscina-adulto', 'piscina-infantil',
                      'pet-care', 'car-wash', 'bosque', 'caixa-agua'],
    }
    return stats

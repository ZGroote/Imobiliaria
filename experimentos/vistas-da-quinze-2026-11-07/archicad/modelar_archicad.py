"""Vistas da Quinze no Archicad (etapa 10): BIM nativo pela conexão Tapir, sem o seletor de arquivo.

Lê as mesmas fontes do Blender e do site e cria elementos do Archicad (não importa malha):
- implantacao/implantacao-m.json: torre em L, degraus, núcleo, embasamento e lazer (regras de modelar_vistas.py);
- interiores/T0N/unidade.json: cômodos, portas e janelas de cada planta, levados ao lugar de cada um dos 258
  apartamentos (fachada para fora, entrada no corredor, terraço na ponta, espelhado nos ímpares como no Blender).
Paredes repetidas (cômodo x cômodo, vizinho x vizinho) viram uma só; cada cômodo vira uma zona com o número do
apartamento. A T06 tem o terraço na FRENTE e a torre pede o terraço do LADO: entra como apartamento + terraço,
sem as paredes internas (a planta dela fica no site).

Com o Archicad aberto em archicad/vistas-da-quinze.pln (Tapir na porta 19723):
python -I experimentos/vistas-da-quinze-2026-11-07/archicad/modelar_archicad.py
Apaga o que o projeto tiver e refaz tudo; no fim salva o .pln.
"""
import json
import math
import sys
import urllib.request
from collections import defaultdict
from pathlib import Path

EXP = Path(__file__).resolve().parents[1]
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 19723
PROJETO = EXP/'archicad'/'vistas-da-quinze.pln'

IMPL = json.loads((EXP/'implantacao'/'implantacao-m.json').read_text(encoding='utf-8'))
T = IMPL['torre']
QX, QZ = T['quinaSE']
PROF, CORR, FUNDO = T['profundidadeUnidadeM'], T['corredorM'], T['fundoAlaM']
H0, LV = T['alturaEmbasamentoM'], T['alturaAndarM']
A0, A1 = T['primeiroAndar'], T['ultimoAndar']
ALAS = {a['id']: a for a in T['alas']}
LAJE = .15
TOPO = H0+(A1+1-A0)*LV
COBERTURA = A1+1
ESP = {'ext': .15, 'int': .10, 'parapeito': .12, 'mureta': .15, 'emb': .25}
ALTURA = {'ext': LV-LAJE, 'int': LV-LAJE, 'parapeito': 1.05, 'mureta': 1.8}
# T06 (só casca): janelas da frente medidas na planta do construtor, como em modelar_vistas.py.
JANELAS_T06 = [(.6, 2.0, 1.0, 2.2), (3.0, 5.0, .8, 2.2)]


# ---------- Conexão ----------
def tapir(cmd, params=None):
    body = {'command': 'API.ExecuteAddOnCommand', 'parameters': {
        'addOnCommandId': {'commandNamespace': 'TapirCommand', 'commandName': cmd}, 'addOnCommandParameters': params or {}}}
    req = urllib.request.Request(f'http://127.0.0.1:{PORT}', json.dumps(body).encode(), {'Content-Type': 'application/json'})
    out = json.loads(urllib.request.urlopen(req, timeout=600).read())
    if not out.get('succeeded'):
        raise RuntimeError(f'{cmd}: {out}')
    return out['result']['addOnCommandResponse']


def criar(cmd, chave, itens, lote=250):
    """Cria em lotes e devolve os guids na mesma ordem; qualquer erro de elemento para o script."""
    guids = []
    for i in range(0, len(itens), lote):
        r = tapir(cmd, {chave: itens[i:i+lote]})
        for k, e in enumerate(r['elements']):
            if 'elementId' not in e:
                raise RuntimeError(f'{cmd} #{i+k}: {e} <- {json.dumps(itens[i+k])[:300]}')
            guids.append(e['elementId']['guid'])
    return guids


def pt(x, z):
    """Lote (x leste, z sul) -> Archicad (X leste, Y norte)."""
    return (round(x, 4), round(-z, 4))


def c2(p):
    return {'x': p[0], 'y': p[1]}


# ---------- Regras da torre (as mesmas de modelar_vistas.py) ----------
def base(andar):
    return H0+(andar-A0)*LV


def ponta(ala, andar):
    a = ALAS[ala]
    if andar < A0:
        return a['comprimentoM']
    return a['comprimentoM']-max(0, andar-a['primeiroDegrau']+1)*a['larguraM']/3


def face_local(ala, face):
    """(s ao longo da ala a partir do núcleo, n para fora da face) -> (x, z) do lote."""
    if ala == 'sul':
        z = QZ if face == 'fora' else QZ-FUNDO
        sz = 1 if face == 'fora' else -1
        return lambda s, n=0: (QX-FUNDO-s, z+sz*n)
    x = QX if face == 'fora' else QX-FUNDO
    sx = 1 if face == 'fora' else -1
    return lambda s, n=0: (x+sx*n, QZ-FUNDO-s)


def ao_longo(u):
    if u['ala'] == 'sul':
        return QX-FUNDO-u['x'][1], QX-FUNDO-u['x'][0]
    return QZ-FUNDO-u['z'][1], QZ-FUNDO-u['z'][0]


# ---------- Plantas ----------
def planta(tip):
    p = json.loads((EXP/'interiores'/tip/'unidade.json').read_text(encoding='utf-8'))['planta']
    xs = [x for c in p['comodos'] for x, _ in c['poly']]
    ys = [y for c in p['comodos'] for _, y in c['poly']]
    assert min(xs) == 0 and min(ys) == 0, tip
    p['W'], p['D'] = max(xs), max(ys)
    terr = [c for c in p['comodos'] if c['nome'].lower().startswith('terra')]
    if tip != 'T06' and terr:   # T03/T04/T05: o terraço tem que estar na ponta (x alto), como na torre
        assert min(x for x, _ in terr[0]['poly']) > p['W']/2, f'{tip}: terraço fora da ponta'
    return p


PLANTAS = {t: planta(t) for t in ('T01', 'T02', 'T03', 'T04', 'T05')}


def casca_t06(corpo, lt):
    """T06 só casca: apartamento + terraço, porta de entrada, porta do terraço e as janelas da frente."""
    return {'W': corpo+lt, 'D': PROF,
            'comodos': [{'nome': 'Apartamento T06', 'poly': [[0, 0], [corpo, 0], [corpo, PROF], [0, PROF]]},
                        {'nome': 'Terraço', 'poly': [[corpo, 0], [corpo+lt, 0], [corpo+lt, PROF], [corpo, PROF]]}],
            'portas': [{'p': [corpo/2, PROF], 'largura': .8, 'y0': 0, 'y1': 2.1},
                       {'p': [corpo, PROF/2], 'largura': 2.0, 'y0': 0, 'y1': 2.2}],
            'janelas': [{'p': [(a+b)/2, 0], 'largura': b-a, 'y0': y0, 'y1': y1} for a, b, y0, y1 in JANELAS_T06 if b < corpo]}


# ---------- Montagem por andar ----------
class Andar:
    def __init__(self, idx):
        self.idx = idx
        self.arestas = []      # (a, b, dono) das zonas: viram parede depois de deduplicar
        self.paredes = []      # (a, b, classe) já classificadas
        self.vaos = []         # (tipo, p, largura, peitoril, altura)
        self.zonas = []        # (nome, número, polígono)
        self.lajes = []        # (polígono, nível do topo)
        self.morphs = []       # (canto, tamanho)


ANDARES = {i: Andar(i) for i in range(0, COBERTURA+1)}


def apartamento(u, espelho):
    s0, s1 = ao_longo(u)
    corpo = s1-s0
    lt = 0.0
    if 'terracoM' in u:
        t = u['terracoM']
        lt = (t['x'][1]-t['x'][0]) if u['ala'] == 'sul' else (t['z'][1]-t['z'][0])
    pl = casca_t06(corpo, lt) if u['tipologia'] == 'T06' else PLANTAS[u['tipologia']]
    L = corpo+lt
    sx, sy = L/pl['W'], PROF/pl['D']
    espelho = espelho and not lt          # com terraço, o lado do terraço manda
    P = face_local(u['ala'], u['lado'])

    def m(x, y):
        s = s0+(L-x*sx if espelho else x*sx)
        return pt(*P(s, -y*sy))

    A = ANDARES[u['andar']]
    num = u['id']
    # Contorno do apartamento: a T02 tem um vão sem cômodo junto da fachada (5,55-7,0 x 0-4,1) e, espelhada no
    # vizinho, abria 2,9 m de fachada. O contorno não conta na classificação; só fecha onde nenhum cômodo fecha.
    env = [m(0, 0), m(pl['W'], 0), m(pl['W'], pl['D']), m(0, pl['D'])]
    for a, b in zip(env, env[1:]+env[:1]):
        A.arestas.append((a, b, (num, -1, False)))
    for k, c in enumerate(pl['comodos']):
        poly = [m(x, y) for x, y in c['poly']]
        dono = (num, k, c['nome'].lower().startswith('terra'))
        for a, b in zip(poly, poly[1:]+poly[:1]):
            A.arestas.append((a, b, dono))
        A.zonas.append((c['nome'], num, poly))
    for tipo, lista in (('porta', pl['portas']), ('janela', pl['janelas'])):
        for o in lista:
            A.vaos.append((tipo, m(*o['p']), o['largura'], o['y0'], o['y1']-o['y0']))
    return s1+lt


def spa(u):
    """Spa no fundo do terraço, como em modelar_vistas.py."""
    tx, tz = u['terracoM']['x'], u['terracoM']['z']
    if u['ala'] == 'sul':
        c = (tx[0]+1.25, (tz[0]+tz[1])/2+(.6 if u['lado'] == 'fora' else -.6))
    else:
        c = ((tx[0]+tx[1])/2+(.6 if u['lado'] == 'fora' else -.6), tz[0]+1.25)
    x, y = pt(*c)
    ANDARES[u['andar']].morphs.append(((x-.95, y-.95, base(u['andar'])+LAJE), (1.9, 1.9, .84)))


def retangulo(x0, z0, x1, z1):
    return [pt(x0, z0), pt(x1, z0), pt(x1, z1), pt(x0, z1)]


def laje_ala(ala, andar):
    """A ala até a ponta do andar de BAIXO (teto dele e piso do terraço deste) + o núcleo na ala sul."""
    fim = ponta(ala, andar-1)
    if ala == 'sul':
        return retangulo(QX-FUNDO-fim, QZ-FUNDO, QX, QZ)
    return retangulo(QX-FUNDO, QZ-FUNDO-fim, QX, QZ-FUNDO)


def torre():
    por_andar = defaultdict(list)
    for u in IMPL['unidades']:
        por_andar[(u['andar'], u['ala'], u['lado'])].append(u)
    for (andar, ala, lado), us in sorted(por_andar.items()):
        for k, u in enumerate(sorted(us, key=lambda u: ao_longo(u)[0])):
            apartamento(u, k % 2 == 1)
            if 'terracoM' in u:
                spa(u)
    for andar in range(A0, A1+1):
        A = ANDARES[andar]
        if andar > A0:   # no 3º o piso é a laje do embasamento
            for ala in ALAS:
                A.lajes.append((laje_ala(ala, andar), base(andar)+LAJE))
        for ala in ALAS:
            fim = ponta(ala, andar)
            Pf, Pp = face_local(ala, 'fora'), face_local(ala, 'patio')
            # Circulação da ala e a testa do corredor (parede com janela, como no Blender).
            a, b = pt(*Pf(0, -PROF)), pt(*Pf(fim, -PROF))
            c, d = pt(*Pp(fim, -PROF)), pt(*Pp(0, -PROF))
            A.zonas.append(('Circulação', f'{andar}{ala[0].upper()}', [a, b, c, d]))
            A.paredes.append((b, c, 'ext'))
            A.vaos.append(('janela', ((b[0]+c[0])/2, (b[1]+c[1])/2), 1.2, 1.1, 1.1))
            # Mureta no eixo do corredor entre os terraços da ponta.
            lt = ALAS[ala]['larguraM']/3
            if andar >= ALAS[ala]['primeiroDegrau']:
                A.paredes.append((pt(*Pf(fim, -PROF-CORR/2)), pt(*Pf(fim+lt, -PROF-CORR/2)), 'mureta'))
        # Núcleo: fachada sul e leste, bloco de escadas/elevadores aproximado e a zona do hall.
        A.paredes += [(pt(QX-FUNDO, QZ), pt(QX, QZ), 'ext'), (pt(QX, QZ), pt(QX, QZ-FUNDO), 'ext')]
        nucleo = retangulo(QX-FUNDO+7.2, QZ-FUNDO+7.2, QX-.8, QZ-.8)
        for p, q in zip(nucleo, nucleo[1:]+nucleo[:1]):
            A.paredes.append((p, q, 'ext'))
        A.zonas.append(('Núcleo: hall, escadas e elevadores (aproximado)', f'{andar}N', retangulo(QX-FUNDO, QZ-FUNDO, QX, QZ)))
    # Cobertura: laje da última ponta, platibanda e caixa d'água.
    C = ANDARES[COBERTURA]
    for ala in ALAS:
        poly = laje_ala(ala, A1+1)
        C.lajes.append((poly, TOPO+LAJE))
    contorno = [pt(QX-FUNDO-ponta('sul', A1), QZ-FUNDO), pt(QX-FUNDO, QZ-FUNDO), pt(QX-FUNDO, QZ-FUNDO-ponta('leste', A1)),
                pt(QX, QZ-FUNDO-ponta('leste', A1)), pt(QX, QZ), pt(QX-FUNDO-ponta('sul', A1), QZ)]
    for p, q in zip(contorno, contorno[1:]+contorno[:1]):
        C.paredes.append((p, q, 'parapeito'))
    x0, y0 = pt(QX-FUNDO+.6, QZ-.6)
    C.morphs.append(((x0, y0, TOPO+LAJE), (FUNDO-1.2, FUNDO-1.2, 6.5)))


def embasamento_e_lazer():
    lote = IMPL['loteM']
    E0 = 1.0
    r = retangulo(lote[0][0]+E0, lote[0][1]+E0, lote[2][0]-E0, lote[2][1]-E0)
    for s in (0, 1, 2):
        A = ANDARES[s]
        A.lajes.append((r, s*3.0))
        for p, q in zip(r, r[1:]+r[:1]):
            A.paredes.append((p, q, 'emb'))
        A.zonas.append(('Garagem', f'G{s+1}', r))
    L3 = ANDARES[A0]
    L3.lajes.append((r, H0+LAJE))
    # Platibanda nas duas ruas (XV de Novembro ao norte, Major Manoel a oeste).
    L3.paredes += [(r[0], r[1], 'parapeito'), (r[3], r[0], 'parapeito')]   # r = [NO, NE, SE, SO] no lote
    for item in IMPL['lazer']:
        x0, z0, x1, z1 = item['m']
        poly = retangulo(x0, z0, x1, z1)
        L3.zonas.append((item['nome'], 'L', poly))
        if item['tipo'] == 'edificio':
            for p, q in zip(poly, poly[1:]+poly[:1]):
                L3.paredes.append((p, q, 'ext'))
            L3.vaos.append(('porta', ((poly[0][0]+poly[1][0])/2, poly[2][1]), 1.6, 0, 2.2))
            L3.lajes.append((poly, H0+LAJE+3.0))
        elif item['tipo'] == 'piscina':
            a, b = poly[0], poly[2]
            L3.morphs.append(((min(a[0], b[0]), min(a[1], b[1]), H0+LAJE), (abs(b[0]-a[0]), abs(b[1]-a[1]), .1)))


# ---------- Paredes: dividir, deduplicar, classificar e juntar ----------
def _proj(p, a, b):
    dx, dy = b[0]-a[0], b[1]-a[1]
    L2 = dx*dx+dy*dy
    t = ((p[0]-a[0])*dx+(p[1]-a[1])*dy)/L2
    d = abs((p[0]-a[0])*dy-(p[1]-a[1])*dx)/math.sqrt(L2)
    return t, d


def paredes_do_andar(A):
    vert = {p for a, b, _ in A.arestas for p in (a, b)}
    pedacos = defaultdict(list)
    for a, b, dono in A.arestas:
        ts = sorted({0.0, 1.0} | {t for p in vert for t, d in [_proj(p, a, b)] if d < 1e-3 and 1e-6 < t < 1-1e-6})
        for t0, t1 in zip(ts, ts[1:]):
            p = (round(a[0]+(b[0]-a[0])*t0, 3), round(a[1]+(b[1]-a[1])*t0, 3))
            q = (round(a[0]+(b[0]-a[0])*t1, 3), round(a[1]+(b[1]-a[1])*t1, 3))
            if p != q:
                pedacos[tuple(sorted((p, q)))].append(dono)
    segs = []
    for (p, q), donos in pedacos.items():
        comodos = [d for d in donos if d[1] >= 0]      # d[1] == -1: contorno do apartamento
        unidades = {d[0] for d in comodos}
        if len(comodos) >= 2:
            classe = 'int' if len(unidades) == 1 else 'ext'
        elif comodos:
            classe = 'parapeito' if comodos[0][2] else 'ext'
        else:
            classe = 'ext'
        segs.append((p, q, classe))
    segs += A.paredes
    # Junta trechos colineares e encostados da mesma classe (uma parede por alinhamento).
    linhas = defaultdict(list)
    for p, q, classe in segs:
        dx, dy = q[0]-p[0], q[1]-p[1]
        n = math.hypot(dx, dy)
        if n < 1e-3:
            continue
        ux, uy = dx/n, dy/n
        if ux < -1e-9 or (abs(ux) < 1e-9 and uy < 0):
            ux, uy = -ux, -uy
        c = round(p[0]*uy-p[1]*ux, 3)
        t0, t1 = sorted((p[0]*ux+p[1]*uy, q[0]*ux+q[1]*uy))
        linhas[(round(ux, 4), round(uy, 4), c, classe)].append((t0, t1))
    saida = []
    for (ux, uy, c, classe), trechos in linhas.items():
        trechos.sort()
        cur = list(trechos[0])
        for t0, t1 in trechos[1:]+[(math.inf, math.inf)]:
            if t0 <= cur[1]+1e-3:
                cur[1] = max(cur[1], t1)
                continue
            # ponto = t*u + c*n, com n = (uy, -ux)
            ponto = lambda t: (round(t*ux+c*uy, 4), round(t*uy-c*ux, 4))
            saida.append((ponto(cur[0]), ponto(cur[1]), classe))
            cur = [t0, t1]
    return saida


def hospedar(paredes, guids, tipo, p, larg):
    melhor = None
    for (a, b, classe), g in zip(paredes, guids):
        if classe in ('parapeito', 'mureta', 'emb'):
            continue
        L = math.dist(a, b)
        t, d = _proj(p, a, b)
        if d < .03 and -1e-3 <= t <= 1+1e-3 and (melhor is None or d < melhor[0]):
            melhor = (d, g, t*L, L)
    if not melhor:
        return None
    _, g, off, L = melhor
    folga = min(off, L-off)-.05
    larg = min(larg, 2*folga)
    if larg < .4:
        return None
    return g, off, larg


# ---------- Execução ----------
def main():
    info = tapir('GetProjectInfo')
    if Path(info['projectPath']).resolve() != PROJETO.resolve():
        raise SystemExit(f'Archicad está com outro projeto aberto: {info["projectPath"]}')
    todos = tapir('GetAllElements')['elements']
    if todos:
        tapir('DeleteElements', {'elements': todos})
    tapir('SetStories', {'stories': [
        {'index': i, 'level': (3.0*i if i < A0 else base(i) if i <= A1 else TOPO), 'dispOnSections': True,
         'name': ('Térreo · garagem' if i == 0 else f'Garagem {i+1}' if i < A0 else f'{i}º andar · lazer' if i == A0
                  else f'{i}º andar' if i <= A1 else 'Cobertura')} for i in range(COBERTURA+1)]})
    torre()
    embasamento_e_lazer()
    resumo = defaultdict(int)
    for i, A in sorted(ANDARES.items()):
        nivel = 3.0*i if i < A0 else base(i) if i <= A1 else TOPO
        paredes = paredes_do_andar(A)
        dados = []
        for a, b, classe in paredes:
            emb = classe == 'emb'
            dados.append({'begCoordinate': c2(a), 'endCoordinate': c2(b), 'floorIndex': i,
                          'zCoordinate': 0.0 if emb else LAJE, 'height': 3.0 if emb else ALTURA[classe],
                          'thickness': ESP[classe], 'structureType': 'Basic', 'referenceLineLocation': 'Center'})
        guids = criar('CreateWalls', 'wallsData', dados)
        portas, janelas = [], []
        for tipo, p, larg, peit, alt in A.vaos:
            h = hospedar(paredes, guids, tipo, p, larg)
            if not h:
                resumo['vão sem parede'] += 1
                continue
            g, off, w = h
            item = {'ownerWallId': {'guid': g}, 'centerOffset': off, 'width': w, 'height': alt, 'sillHeight': peit}
            (portas if tipo == 'porta' else janelas).append(item)
        criar('CreateDoors', 'doorsData', portas)
        criar('CreateWindows', 'windowsData', janelas)
        criar('CreateSlabs', 'slabsData', [{'level': lv, 'thickness': LAJE, 'structureType': 'Basic', 'referencePlaneLocation': 'Top',
                                            'floorIndex': i, 'polygonCoordinates': [c2(p) for p in poly]} for poly, lv in A.lajes])
        criar('CreateZones', 'zonesData', [{'name': nome, 'numberStr': num, 'floorIndex': i,
                                            'geometry': {'polygonCoordinates': [c2(p) for p in poly]}} for nome, num, poly in A.zonas])
        criar('CreateMorphs', 'morphsData', [{'basePoint': {'x': c[0], 'y': c[1], 'z': c[2]}, 'size': {'x': s[0], 'y': s[1], 'z': s[2]},
                                              'floorIndex': i} for c, s in A.morphs])
        for k, n in (('paredes', len(paredes)), ('portas', len(portas)), ('janelas', len(janelas)), ('lajes', len(A.lajes)),
                     ('zonas', len(A.zonas)), ('volumes', len(A.morphs))):
            resumo[k] += n
        print(f'andar {i:2d} ({nivel:6.2f} m): {len(paredes)} paredes, {len(portas)} portas, {len(janelas)} janelas, '
              f'{len(A.zonas)} zonas', flush=True)
    tapir('SaveProject', {})
    # IFC4 do projeto inteiro: o tradutor padrão só leva o visível no 3D e perdia as 1.118 zonas (IfcSpace).
    tapir('IFCFileOperation', {'method': 'save', 'ifcFilePath': str(PROJETO.with_suffix('.ifc')), 'fileType': 'ifc',
                               'translatorName': 'Exportação IFC4 Design Transfer View-based', 'elementsToExport': 'EntireProject'})
    print('VISTAS_ARCHICAD', json.dumps(dict(resumo), ensure_ascii=False))


if __name__ == '__main__':
    main()

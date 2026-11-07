"""Exporta e confere uma planta do Vistas da Quinze pelas APIs oficiais do pipeline.

Mesmo caminho de interiores/meio/exportar-meio.py do LIV, para qualquer tipologia.
Rodado por construir.ts; à mão: python exportar.py <tipologia>.
"""
import hashlib
import itertools
import json
import sys
from pathlib import Path

AQUI = Path(__file__).resolve().parent
ROOT = AQUI.parents[2]
sys.path.insert(0, str(ROOT))

from PIL import Image, ImageDraw, ImageFont
from pipeline.avaliar_captura import embrulhar
from pipeline.e2e_leitura import resolver_entrada, portoes_do_consumidor, unidade
from pipeline.gerar_maquete import extrair_moveis_3d
from pipeline.normalizar_planta import serializar

INPUTS = ['planta.json', 'leitura.json', 'projeto-planta.json', 'moveis.json', 'contexto.json']


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def read(path):
    return json.loads(path.read_text(encoding='utf-8'))


def write(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')


def footprint(item):
    w, d = item['widthMm']/1000, item['depthMm']/1000
    if item['rotDegrees'] % 180:
        w, d = d, w
    x, y = item['xMm']/1000, item['yMm']/1000
    return [x-w/2, y-d/2, x+w/2, y+d/2]


def inside(x, y, poly):
    hit = False
    for a, b in zip(poly, poly[1:]+poly[:1]):
        cross = (x-a[0])*(b[1]-a[1])-(y-a[1])*(b[0]-a[0])
        if abs(cross) < 1e-8 and min(a[0], b[0])-1e-8 <= x <= max(a[0], b[0])+1e-8 and min(a[1], b[1])-1e-8 <= y <= max(a[1], b[1])+1e-8:
            return True
        if (a[1] > y) != (b[1] > y) and x < a[0]+(y-a[1])*(b[0]-a[0])/(b[1]-a[1]):
            hit = not hit
    return hit


def conferir(pasta, ref, project, result):
    """Desenha contornos, vãos e móveis sobre a imagem do book e confere os móveis."""
    base = Image.open(pasta/ref['imagem']).convert('RGBA')
    over = Image.new('RGBA', base.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(over)
    try:
        font = ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf', 20)
    except OSError:
        font = ImageFont.load_default(size=20)
    scale = ref['registro']['mmPorPixel']
    ox, oy = ref['registro']['origemPx']

    def px(x, y):
        return ox+x*1000/scale, oy+y*1000/scale

    rooms = result['planta']['comodos']
    colors = ['#38a98b', '#557adb', '#ef9c4c', '#c75684', '#9480ce', '#68c0cb', '#d0b030']
    for room, color in zip(rooms, colors):
        poly = [px(x, y) for x, y in room['poly']]
        draw.polygon(poly, fill=color+'22', outline=color, width=4)
        x, y = poly[0]
        draw.text((x+8, y+6), room['nome'], font=font, fill=color, stroke_width=2, stroke_fill='#ffffff')
    for kind, color in [('portas', '#ed8427'), ('janelas', '#04b8e9')]:
        for o in result['planta'][kind]:
            x, y = o['p']
            half = o['largura']/2
            side = o['wallId'].rsplit('-', 1)[1]
            ends = [px(x-half, y), px(x+half, y)] if side in ('north', 'south') else [px(x, y-half), px(x, y+half)]
            draw.line(ends, fill=color, width=9)
    furniture = project['floors'][0]['furniture']
    checks = []
    for item in furniture:
        x0, y0, x1, y1 = footprint(item)
        draw.rectangle([px(x0, y0), px(x1, y1)], outline='#91552e', width=3)
        corners = [(a, b) for a in (x0, x1) for b in (y0, y1)]
        owners = [r['nome'] for r in rooms if all(inside(a, b, r['poly']) for a, b in corners)]
        checks.append({'id': item['id'], 'nome': item['nome'], 'comodos': owners, 'contido': bool(owners)})
    overlaps = []
    for a, b in itertools.combinations(furniture, 2):
        if 'tapete' in a['tipo3D'] or 'tapete' in b['tipo3D']:
            continue
        fa, fb = footprint(a), footprint(b)
        dx, dy = min(fa[2], fb[2])-max(fa[0], fb[0]), min(fa[3], fb[3])-max(fa[1], fb[1])
        if dx > 1e-9 and dy > 1e-9:
            mesa = {a['tipo3D'], b['tipo3D']} == {'mesa', 'cadeira'}
            overlaps.append({'nomes': [a['nome'], b['nome']], 'areaM2': round(dx*dy, 4), 'revisar': not mesa})
    Image.alpha_composite(base, over).convert('RGB').save(pasta/'conferencia.jpg', quality=85)
    status = 'PASS' if all(c['contido'] for c in checks) and not any(o['revisar'] for o in overlaps) else 'REVIEW'
    report = {'status': status, 'areaNominalM2': ref['areaContornoNominalAproximadaM2'],
              'registro': ref['registro'], 'moveis': checks, 'sobreposicoes': overlaps,
              'vaos': {'portas': len(result['planta']['portas']), 'janelas': len(result['planta']['janelas'])},
              'conferenciaJPG': sha(pasta/'conferencia.jpg'), 'unidadeSHA256': sha(pasta/'unidade.json'),
              'limites': ['Sobreposição na imagem do book; não é conferência executiva.',
                          'Contorno, vãos, móveis e escala são leituras de planta humanizada sem cotas.']}
    write(pasta/'conferencia.json', report)
    return report


def main(tipologia):
    pasta = AQUI/tipologia
    ref = read(pasta/'referencia.json')
    if sha(pasta/ref['imagem']) != ref['imagemSha256']:
        raise ValueError('A imagem do book mudou; revisar planta.json.')
    hashes = {n: sha(pasta/n) for n in INPUTS}
    if ref['captura']['inputsSHA256'] != hashes:
        raise ValueError('Entrada mudou depois da captura; rodar construir.ts.')
    reading, project, furniture, context = [read(pasta/n) for n in INPUTS[1:]]
    floors = project.get('floors', [])
    if project.get('activeFloor') != 0 or len(floors) != 1 or floors[0]['leitura'] != reading:
        raise ValueError('Projeto reabrível e leitura não correspondem ao mesmo andar.')
    context = {**context, 'moveis': extrair_moveis_3d(furniture)}
    wrapped = embrulhar(reading, context['propertyId'], context)
    derived = resolver_entrada(wrapped)
    errors = portoes_do_consumidor(reading)
    if errors:
        raise ValueError(errors)
    result = unidade(derived, wrapped['pedido'], context)
    # Caderno: piso de madeira tauari nos dormitórios; o banho fica com o piso frio.
    for room in result['planta']['comodos']:
        room['piso'] = 'frio' if 'banho' in room['nome'].lower() else 'madeira'
    payload = serializar(result)
    tmp = pasta/'unidade.json.tmp'
    tmp.write_bytes(payload)
    tmp.replace(pasta/'unidade.json')
    checked = conferir(pasta, ref, project, result)
    counts = {k: len(result['planta'][k]) for k in ('comodos', 'portas', 'janelas')}
    print(json.dumps({'ok': checked['status'] == 'PASS', 'conferencia': checked['status'],
                      'unidadeSHA256': hashlib.sha256(payload).hexdigest(), **counts,
                      'revisar': [c['nome'] for c in checked['moveis'] if not c['contido']] +
                                 [o['nomes'] for o in checked['sobreposicoes'] if o['revisar']]}, ensure_ascii=False))


if __name__ == '__main__':
    main(sys.argv[1])

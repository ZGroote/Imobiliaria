"""Exporta e confere a Planta 2 de meio pelas APIs oficiais do pipeline.

Execute construir-meio.ts antes. --validar não grava arquivos e rejeita saídas
que não correspondam ao construtor, às entradas nominais ou à imagem registrada.
"""
import argparse
import hashlib
import itertools
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
sys.path.insert(0, str(ROOT))

from PIL import Image, ImageDraw, ImageFont
from pipeline.avaliar_captura import embrulhar
from pipeline.e2e_leitura import resolver_entrada, portoes_do_consumidor, unidade
from pipeline.gerar_maquete import extrair_moveis_3d
from pipeline.normalizar_planta import serializar

SOURCE_SHA = 'bc846b68c7ce1204578336829d205ea3c60aee80258429aed6f45d331a3e032a'
READING_ID = 'liv-ipanema-planta-meio-referencia'
INPUTS = ['leitura.json', 'projeto-planta.json', 'moveis.json', 'contexto.json']


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def read(path):
    return json.loads(path.read_text(encoding='utf-8'))


def write(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')


def source_inputs():
    ref = read(HERE/'referencia.json')
    source = (HERE/ref['imagem']).resolve()
    if ref['imagemSha256'] != SOURCE_SHA or sha(source) != SOURCE_SHA:
        raise ValueError('A imagem registrada de meio mudou; revisar a captura.')
    constructor = sha(HERE/'construir-meio.ts')
    hashes = {name: sha(HERE/name) for name in INPUTS}
    if ref.get('captura', {}).get('construtorSHA256') != constructor:
        raise ValueError('O construtor mudou após a captura; executar construir-meio.ts.')
    if ref['captura']['inputsSHA256'] != hashes:
        raise ValueError('Uma entrada nominal mudou após a captura; executar construir-meio.ts.')
    reading, project, furniture, context = [read(HERE/name) for name in INPUTS]
    if reading['id'] != READING_ID or context['propertyId'] != READING_ID or context['agencyId'] != 'referencia-publica-local':
        raise ValueError('A identidade da reconstrução de meio não corresponde à fonte registrada.')
    floors = project.get('floors', [])
    if project.get('activeFloor') != 0 or len(floors) != 1 or floors[0]['floor'] != 0 or floors[0]['leitura'] != reading:
        raise ValueError('Projeto reabrível e leitura nominal não correspondem ao mesmo andar.')
    # Both companions come from the same Session. The exported renderer companion
    # changes units/keys, so use the pipeline validator instead of assuming equality.
    context = {**context, 'moveis': extrair_moveis_3d(furniture)}
    wrapped = embrulhar(reading, context['propertyId'], context)
    derived = resolver_entrada(wrapped)
    errors = portoes_do_consumidor(reading)
    if errors:
        raise ValueError(errors)
    result = unidade(derived, wrapped['pedido'], context)
    reference_definition = {k: v for k, v in ref.items() if k != 'conversao'}
    sources = {**hashes, 'construir-meio.ts': constructor, 'exportar-meio.py': sha(Path(__file__)),
               'imagem2D': SOURCE_SHA,
               'referenceDefinitionSHA256': hashlib.sha256(serializar(reference_definition)).hexdigest()}
    return ref, source, project, derived, result, sources


def footprint(item):
    width, depth = item['widthMm']/1000, item['depthMm']/1000
    if item['rotDegrees'] % 180:
        width, depth = depth, width
    x, y = item['xMm']/1000, item['yMm']/1000
    return [x-width/2, y-depth/2, x+width/2, y+depth/2]


def point_inside(x, y, poly):
    hit = False
    for a, b in zip(poly, poly[1:]+poly[:1]):
        cross = (x-a[0])*(b[1]-a[1])-(y-a[1])*(b[0]-a[0])
        if abs(cross) < 1e-8 and min(a[0], b[0])-1e-8 <= x <= max(a[0], b[0])+1e-8 and min(a[1], b[1])-1e-8 <= y <= max(a[1], b[1])+1e-8:
            return True
        if (a[1] > y) != (b[1] > y) and x < a[0]+(y-a[1])*(b[0]-a[0])/(b[1]-a[1]):
            hit = not hit
    return hit


def source_overlay(ref, source, project, result):
    base = Image.open(source).convert('RGBA')
    overlay = Image.new('RGBA', base.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    try:
        font = ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf', 17)
    except OSError:
        font = ImageFont.load_default(size=17)
    scale = ref['registro']['mmPorPixel']
    ox, oy = ref['registro']['origemPx']

    def pixel(x, y):
        return ox+x*1000/scale, oy+y*1000/scale

    rooms = result['planta']['comodos']
    colors = ['#38a98b', '#557adb', '#ef9c4c', '#c75684', '#9480ce', '#68c0cb']
    for room, color in zip(rooms, colors):
        polygon = [pixel(x, y) for x, y in room['poly']]
        draw.polygon(polygon, fill=color+'15', outline=color, width=4)
        x, y = polygon[0]
        draw.text((x+8, y+6), room['nome'], font=font, fill=color, stroke_width=2, stroke_fill='#ffffff')
    for kind, color in [('portas', '#ed8427'), ('janelas', '#04b8e9')]:
        for opening in result['planta'][kind]:
            x, y = opening['p']
            half = opening['largura']/2
            side = opening['wallId'].rsplit('-', 1)[1]
            ends = [pixel(x-half, y), pixel(x+half, y)] if side in ('north', 'south') else [pixel(x, y-half), pixel(x, y+half)]
            draw.line(ends, fill=color, width=8)
    furniture = project['floors'][0]['furniture']
    checks = []
    for item in furniture:
        x0, y0, x1, y1 = footprint(item)
        draw.rectangle([pixel(x0, y0), pixel(x1, y1)], outline='#91552e', width=2)
        x, y = pixel(item['xMm']/1000, item['yMm']/1000)
        draw.ellipse([x-3, y-3, x+3, y+3], fill='#91552e')
        corners = [(a, b) for a in (x0, x1) for b in (y0, y1)]
        owners = [room['nome'] for room in rooms if all(point_inside(a, b, room['poly']) for a, b in corners)]
        checks.append({'id': item['id'], 'nome': item['nome'], 'containedPhysicalRooms': owners,
                       'fourCornerFootprintContained': bool(owners)})
    overlaps = []
    for left, right in itertools.combinations(furniture, 2):
        if 'tapete' in left['tipo3D'] or 'tapete' in right['tipo3D']:
            continue
        a, b = footprint(left), footprint(right)
        dx, dy = min(a[2], b[2])-max(a[0], b[0]), min(a[3], b[3])-max(a[1], b[1])
        if dx > 1e-9 and dy > 1e-9:
            intentional = {left['tipo3D'], right['tipo3D']} == {'mesa', 'cadeira'}
            overlaps.append({'a': left['id'], 'b': right['id'], 'names': [left['nome'], right['nome']],
                             'areaM2': round(dx*dy, 6), 'tableChairTuckedPlacement': intentional,
                             'requiresReview': not intentional})
    Image.alpha_composite(base, overlay).convert('RGB').save(HERE/'conferencia.png')
    status = 'PASS' if all(c['fourCornerFootprintContained'] for c in checks) and not any(o['requiresReview'] for o in overlaps) else 'REVIEW'
    report = {'schema': 'liv-meio-source-check-v1', 'status': status,
              'source2D': {'path': str(source), 'sha256': SOURCE_SHA, 'pixels': list(base.size)},
              'sourceUnitSHA256': sha(HERE/'unidade.json'), 'sourceConstructionSHA256': sha(HERE/'construir-meio.ts'),
              'overlay': {'path': 'conferencia.png', 'sha256': sha(HERE/'conferencia.png'), 'pixels': list(base.size),
                          'legend': {'polygons': 'contornos físicos registrados', 'orange': 'portas', 'cyan': 'janelas', 'brown': 'footprints dos móveis'}},
              'registration': ref['registro'], 'areaNominalM2': ref['areaContornoNominalAproximadaM2'],
              'areaPublishedRangeM2': ref['areaPublicadaIntervaloM2'], 'furnitureChecks': checks, 'footprintOverlaps': overlaps,
              'openingCounts': {'doors': len(result['planta']['portas']), 'windows': len(result['planta']['janelas'])},
              'corrections': [{'items': ['m3', 'm4'], 'reason': 'Separar criados da cama e armário; posições y445 e615px.'},
                              {'items': ['m22'], 'reason': 'Separar lavatório social do box; posição x610px.'}],
              'limits': ['Sobreposição documental na imagem original; não é render 3D ou conferência executiva.',
                         'Contenção e AABB não validam interação 3D, folgas para acessibilidade, sentido/marcha de portas ou todos os modelos do catálogo.',
                         'Sobreposições mesa-cadeira registram encaixe visual sob tampo; requerem conferência no runtime 3D.',
                         'Direções north/south pertencem ao contrato do construtor, não à orientação solar.',
                         'Contorno, portas, móveis e escala são leituras inferidas de uma planta comercial sem cotas.']}
    write(HERE/'conferencia.json', report)
    if status != 'PASS':
        raise ValueError('Footprints precisam de revisão; consultar conferencia.json.')
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--validar', action='store_true', help='Confere saída existente e rejeita artefatos antigos sem gravar arquivos.')
    args = parser.parse_args()
    ref, source, project, derived, result, sources = source_inputs()
    payload = serializar(result)
    expected_sha = hashlib.sha256(payload).hexdigest()
    counts = {'comodos': len(result['planta']['comodos']), 'portas': len(result['planta']['portas']), 'janelas': len(result['planta']['janelas'])}
    if args.validar:
        if sha(HERE/'unidade.json') != expected_sha:
            raise ValueError('unidade.json não corresponde à captura atual; executar exportar-meio.py.')
        exported = read(HERE/'exportacao.json')
        checked = read(HERE/'conferencia.json')
        if exported['status'] != 'PASS' or checked['status'] != 'PASS' or exported['sourcesSHA256'] != sources or exported['unidadeSHA256'] != expected_sha or ref['conversao']['unidadeSHA256'] != expected_sha:
            raise ValueError('Registro de exportação antigo; executar exportar-meio.py.')
        if checked['sourceUnitSHA256'] != expected_sha or checked['sourceConstructionSHA256'] != sources['construir-meio.ts'] or checked['overlay']['sha256'] != sha(HERE/'conferencia.png'):
            raise ValueError('Conferência 2D não corresponde à unidade atual; executar exportar-meio.py.')
        print(json.dumps({'ok': True, 'mode': 'validate', 'unidadeSHA256': expected_sha, **counts}))
        return
    # A complete file is adopted atomically; interrupted writes cannot become the unit.
    temporary = HERE/'unidade.json.tmp'
    temporary.write_bytes(payload)
    temporary.replace(HERE/'unidade.json')
    checked = source_overlay(ref, source, project, result)
    report = {'schema': 'liv-meio-export-v1', 'status': 'PASS', 'sourceReadingId': READING_ID,
              'sourcesSHA256': sources, 'unidadeSHA256': expected_sha, 'normalizer': derived['normalizer'],
              'geometrySourceSHA256': derived['source']['sha256'], 'counts': counts, 'roundTripRecorded': ref['construtor']['roundTrip'],
              'validation': ['resolver_entrada', 'portoes_do_consumidor', 'unidade', 'four-corner-physical-room-containment', 'furniture-AABB-review'],
              'sourceOverlaySHA256': checked['overlay']['sha256']}
    ref['conversao'] = {'status': 'PASS', 'normalizer': derived['normalizer'], **counts,
                        'entrada': 'pipeline.avaliar_captura.embrulhar',
                        'validacao': 'pipeline.e2e_leitura.resolver_entrada + portoes_do_consumidor',
                        'exportador': 'pipeline.e2e_leitura.unidade', 'script': 'exportar-meio.py',
                        'unidadeSHA256': expected_sha, 'geometrySourceSHA256': derived['source']['sha256']}
    write(HERE/'referencia.json', ref)
    write(HERE/'exportacao.json', report)
    print(json.dumps({'ok': True, 'mode': 'export', 'normalizer': derived['normalizer'], 'unidadeSHA256': expected_sha, **counts}))


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print(json.dumps({'ok': False, 'error': str(error)}, ensure_ascii=False), file=sys.stderr)
        raise SystemExit(1)

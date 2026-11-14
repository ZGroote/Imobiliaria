"""Planta 2D do site (cópia do Mooca): imagem humanizada, recorte, régua, medidas e entrada por tipologia.

Lê T0N/planta.json e referencia.json (escala) e grava em ../site/plantas2d/: t0N.jpg (a imagem pública,
ampliada 3x porque a original tem ~45 px/m), t0N-recorte.svg e dados.js (importado por site/tipologias.js).
A entrada é a porta da sala no lado de baixo da imagem (o corredor do andar).
python experimentos/vistas-da-quinze-2026-11-07/interiores/gerar_plantas2d.py
"""
import json
from pathlib import Path

from PIL import Image

AQUI = Path(__file__).resolve().parent
SAIDA = AQUI.parent/'site'/'plantas2d'
TIPOS = ('T01', 'T02', 'T03', 'T04', 'T05', 'T06')
K = 3              # ampliação da imagem pública
PAREDE_PX = 4      # meia parede na imagem original


def gerar(tip):
    spec = json.loads((AQUI/tip/'planta.json').read_text(encoding='utf-8'))
    ref = json.loads((AQUI/tip/'referencia.json').read_text(encoding='utf-8'))
    im = Image.open((AQUI/tip/spec['imagem']).resolve()).convert('RGB')
    im = im.resize((im.width*K, im.height*K), Image.LANCZOS)
    w, h = im.size
    im.save(SAIDA/f'{tip.lower()}.jpg', quality=90)
    mm = ref['registro']['mmPorPixel']/K
    rects = [[x0*K, y0*K, x1*K, y1*K] for c in spec['comodos'] for x0, y0, x1, y1 in c['partes']]
    p = PAREDE_PX*K
    svg = ''.join(f'<rect x="{x0-p}" y="{y0-p}" width="{x1-x0+2*p}" height="{y1-y0+2*p}"/>' for x0, y0, x1, y1 in rects)
    (SAIDA/f'{tip.lower()}-recorte.svg').write_text(
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}"><g fill="white">{svg}</g></svg>\n', encoding='utf-8')
    medidas = []
    for c in spec['comodos']:
        x0, y0, x1, y1 = max(c['partes'], key=lambda r: (r[2]-r[0])*(r[3]-r[1]))
        medidas.append({'name': c['nome'], 'x': round((x0+x1)/2*K/w, 4), 'y': round((y0+y1)/2*K/h, 4),
                        'widthMm': round((x1-x0)*K*mm/50)*50, 'depthMm': round((y1-y0)*K*mm/50)*50})
    regua = {'width': w, 'height': h, 'mmPerPixel': mm,
             'paths': [[[x0, y0], [x1, y0], [x1, y1], [x0, y1]] for x0, y0, x1, y1 in rects]}
    # Entrada: a porta da sala no lado "north" (embaixo na imagem, para o corredor do andar).
    porta = next(a for a in spec['aberturas'] if a['tipo'] == 'door' and a['lado'] == 'north' and a['comodo'] == 'Sala integrada')
    parte = next(c for c in spec['comodos'] if c['nome'] == 'Sala integrada')['partes'][porta.get('parte', 0)]
    ex, ey = (porta['de']+porta['ate'])/2*K, parte[3]*K
    return {'measurements': medidas, 'ruler': regua, 'entryMarker': {'x': round(ex/w, 4), 'y': round(ey/h, 4)}, 'size': [w, h]}


def main():
    SAIDA.mkdir(parents=True, exist_ok=True)
    dados = {tip.lower(): gerar(tip) for tip in TIPOS}
    (SAIDA/'dados.js').write_text('// Gerado por interiores/gerar_plantas2d.py a partir de planta.json; não editar à mão.\n'
                                  'export const PLANTAS2D=' + json.dumps(dados, ensure_ascii=False) + ';\n', encoding='utf-8')
    print({tip: (len(d['measurements']), d['entryMarker'], d['size']) for tip, d in dados.items()})


if __name__ == '__main__':
    main()

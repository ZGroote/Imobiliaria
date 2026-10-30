"""Planta 2D do site (cópia do LIV): imagem do book, recorte, régua, medidas e entrada por tipologia.

Lê <tipologia>/planta.json e referencia.json (escala) e grava em ../site/plantas2d/:
canto.jpg, meio.jpg, *-recorte.svg e dados.js (importado por site/tipologias.js).
python experimentos/laranjeiras-2026-10-30/interiores/gerar_plantas2d.py
"""
import json
import shutil
from pathlib import Path

from PIL import Image

AQUI = Path(__file__).resolve().parent
SAIDA = AQUI.parent/'site'/'plantas2d'
PAREDE_PX = 14     # meia parede externa, para o recorte não comer o traço preto


def gerar(tip):
    spec = json.loads((AQUI/tip/'planta.json').read_text(encoding='utf-8'))
    ref = json.loads((AQUI/tip/'referencia.json').read_text(encoding='utf-8'))
    imagem = (AQUI/tip/spec['imagem']).resolve()
    w, h = Image.open(imagem).size
    mm = ref['registro']['mmPorPixel']
    shutil.copyfile(imagem, SAIDA/f'{tip}.jpg')
    rects = [r for c in spec['comodos'] for r in c['partes']]
    svg = ''.join(f'<rect x="{x0-PAREDE_PX}" y="{y0-PAREDE_PX}" width="{x1-x0+2*PAREDE_PX}" height="{y1-y0+2*PAREDE_PX}"/>'
                  for x0, y0, x1, y1 in rects)
    (SAIDA/f'{tip}-recorte.svg').write_text(
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}"><g fill="white">{svg}</g></svg>\n', encoding='utf-8')
    medidas = []
    for c in spec['comodos']:
        x0, y0, x1, y1 = max(c['partes'], key=lambda r: (r[2]-r[0])*(r[3]-r[1]))
        medidas.append({'name': c['nome'], 'x': round((x0+x1)/2/w, 4), 'y': round((y0+y1)/2/h, 4),
                        'widthMm': round((x1-x0)*mm/50)*50, 'depthMm': round((y1-y0)*mm/50)*50})
    regua = {'width': w, 'height': h, 'mmPerPixel': mm,
             'paths': [[[x0, y0], [x1, y0], [x1, y1], [x0, y1]] for x0, y0, x1, y1 in rects]}
    # Entrada = porta da sala integrada com 2,10 m (a de 2,20 m é a da varanda).
    porta = next(a for a in spec['aberturas'] if a['comodo'] == 'Sala integrada' and a['tipo'] == 'door' and a['alturaMm'] == 2100)
    parte = next(c for c in spec['comodos'] if c['nome'] == porta['comodo'])['partes'][porta.get('parte', 0)]
    meio = (porta['de']+porta['ate'])/2
    ex, ey = {'north': (meio, parte[3]), 'south': (meio, parte[1]), 'east': (parte[2], meio), 'west': (parte[0], meio)}[porta['lado']]
    return {'measurements': medidas, 'ruler': regua, 'entryMarker': {'x': round(ex/w, 4), 'y': round(ey/h, 4)},
            'size': [w, h]}


def main():
    SAIDA.mkdir(parents=True, exist_ok=True)
    dados = {tip: gerar(tip) for tip in ('canto', 'meio')}
    (SAIDA/'dados.js').write_text('// Gerado por interiores/gerar_plantas2d.py a partir de planta.json; não editar à mão.\n'
                                  'export const PLANTAS2D=' + json.dumps(dados, ensure_ascii=False) + ';\n', encoding='utf-8')
    print({tip: (len(d['measurements']), d['entryMarker']) for tip, d in dados.items()})


if __name__ == '__main__':
    main()

"""Planta 2D do site (cópia do Laranjeiras): imagem do caderno, recorte, régua, medidas e entrada por tipo.

Lê <tipo>/planta.json e referencia.json (escala) e grava em ../site/plantas2d/: <tipo>.jpg (o container
recortado da folha do caderno), <tipo>-recorte.svg e dados.js (importado por site/tipologias.js).
A entrada é a porta que fica no contorno externo do container.
python experimentos/containers-mooca-2026-11-05/interiores/gerar_plantas2d.py
"""
import json
from pathlib import Path

from PIL import Image

AQUI = Path(__file__).resolve().parent
SAIDA = AQUI.parent/'site'/'plantas2d'
TIPOS = ('individual', 'individual-pne', 'casal', 'quadruplo', 'casal-bebe')
PAREDE_PX = 8      # meia parede do container, para o recorte não comer o traço
MARGEM_PX = 60


def gerar(tip):
    spec = json.loads((AQUI/tip/'planta.json').read_text(encoding='utf-8'))
    ref = json.loads((AQUI/tip/'referencia.json').read_text(encoding='utf-8'))
    imagem = (AQUI/tip/spec['imagem']).resolve()
    cx0, cy0, cx1, cy1 = spec['calibracao']['contornoFacesPx'][0]
    ox, oy = cx0-MARGEM_PX, cy0-MARGEM_PX
    corte = Image.open(imagem).convert('RGB').crop((ox, oy, cx1+MARGEM_PX, cy1+MARGEM_PX))
    w, h = corte.size
    corte.save(SAIDA/f'{tip}.jpg', quality=90)
    mm = ref['registro']['mmPorPixel']
    rects = [[x0-ox, y0-oy, x1-ox, y1-oy] for c in spec['comodos'] for x0, y0, x1, y1 in c['partes']]
    svg = ''.join(f'<rect x="{x0-PAREDE_PX}" y="{y0-PAREDE_PX}" width="{x1-x0+2*PAREDE_PX}" height="{y1-y0+2*PAREDE_PX}"/>'
                  for x0, y0, x1, y1 in rects)
    (SAIDA/f'{tip}-recorte.svg').write_text(
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}"><g fill="white">{svg}</g></svg>\n', encoding='utf-8')
    medidas = []
    for c in spec['comodos']:
        x0, y0, x1, y1 = max(c['partes'], key=lambda r: (r[2]-r[0])*(r[3]-r[1]))
        medidas.append({'name': c['nome'], 'x': round(((x0+x1)/2-ox)/w, 4), 'y': round(((y0+y1)/2-oy)/h, 4),
                        'widthMm': round((x1-x0)*mm/50)*50, 'depthMm': round((y1-y0)*mm/50)*50})
    regua = {'width': w, 'height': h, 'mmPerPixel': mm,
             'paths': [[[x0, y0], [x1, y0], [x1, y1], [x0, y1]] for x0, y0, x1, y1 in rects]}

    def ponto(a):
        parte = next(c for c in spec['comodos'] if c['nome'] == a['comodo'])['partes'][a.get('parte', 0)]
        m = (a['de']+a['ate'])/2
        return {'north': (m, parte[3]), 'south': (m, parte[1]), 'east': (parte[2], m), 'west': (parte[0], m)}[a['lado']]

    def no_contorno(p):
        return min(abs(p[0]-cx0), abs(p[0]-cx1), abs(p[1]-cy0), abs(p[1]-cy1)) < 6
    portas = [a for a in spec['aberturas'] if a['tipo'] == 'door']
    ex, ey = next(p for p in map(ponto, portas) if no_contorno(p))
    return {'measurements': medidas, 'ruler': regua, 'entryMarker': {'x': round((ex-ox)/w, 4), 'y': round((ey-oy)/h, 4)},
            'size': [w, h]}


def main():
    SAIDA.mkdir(parents=True, exist_ok=True)
    dados = {tip: gerar(tip) for tip in TIPOS}
    (SAIDA/'dados.js').write_text('// Gerado por interiores/gerar_plantas2d.py a partir de planta.json; não editar à mão.\n'
                                  'export const PLANTAS2D=' + json.dumps(dados, ensure_ascii=False) + ';\n', encoding='utf-8')
    print({tip: (len(d['measurements']), d['entryMarker'], d['size']) for tip, d in dados.items()})


if __name__ == '__main__':
    main()

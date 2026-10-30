"""Passa a implantação do book (pixels) para metros e para o mapa.

Lê implantacao.json e as duas plantas tipo; grava implantacao-m.json e conferencia.jpg.
python experimentos/laranjeiras-2026-10-30/implantacao/montar.py
"""
import hashlib
import json
import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

AQUI = Path(__file__).resolve().parent
INTERIORES = AQUI.parent/'interiores'
CORREDOR_M = 1.3   # circulação entre as duas fileiras de apartamentos (sem cota no book)
NUCLEO_M = 4.0     # escada + elevador entre as alas, medido no desenho do book
VAGA_M = 2.5       # largura de vaga comum


def bbox_planta(nome):
    u = json.loads((INTERIORES/nome/'unidade.json').read_text(encoding='utf-8'))
    pts = [p for c in u['planta']['comodos'] for p in c['poly']]
    xs, ys = [p[0] for p in pts], [p[1] for p in pts]
    return max(xs)-min(xs), max(ys)-min(ys)


def main():
    d = json.loads((AQUI/'implantacao.json').read_text(encoding='utf-8'))
    imagem = (AQUI/d['imagem']).resolve()
    if hashlib.sha256(imagem.read_bytes()).hexdigest() != d['imagemSha256']:
        raise ValueError('A imagem da implantação mudou; revisar implantacao.json.')
    reg = d['registro']
    s, (u0, v0) = reg['pxPorM'], d['lote'][0]
    rumo = math.radians(reg['rumoCimaGraus'])
    au, av = reg['ancoraPx']
    alat, alon = reg['ancoraGeo']

    def m(p):   # metros do lote: x para a direita da imagem, z para baixo, origem na quina de cima à esquerda
        return [round((p[0]-u0)/s, 3), round((p[1]-v0)/s, 3)]

    def geo(p):
        dir_, cima = (p[0]-au)/s, (av-p[1])/s
        dr, dc = rumo+math.pi/2, rumo     # direita da imagem = rumo+90°
        leste = dir_*math.sin(dr)+cima*math.sin(dc)
        norte = dir_*math.cos(dr)+cima*math.cos(dc)
        return [round(alat+norte/111320, 7), round(alon+leste/(111320*math.cos(math.radians(alat))), 7)]

    def ret(r):
        return [m((r[0], r[1])), m((r[2], r[3]))]

    # Torre pelo tamanho real das plantas: ala = canto + meio ao longo da fachada,
    # fundo = duas fileiras de apartamentos com o corredor no meio.
    cw, cd = bbox_planta('canto')
    mw, md = bbox_planta('meio')
    ala = cw+md                       # o meio tem a fachada no lado comprido
    fundo = 2*max(cd, mw)+CORREDOR_M
    comprimento = 2*ala+NUCLEO_M
    torres = []
    for t in d['torres']:
        c = m(t['centroPx'])
        larg, prof = (fundo, comprimento) if t['girada'] else (comprimento, fundo)
        torres.append({**t, 'centroM': c, 'larguraM': round(larg, 3), 'profundidadeM': round(prof, 3),
                       'desenhoM': ret(t['desenhoPx']), 'centroGeo': geo(t['centroPx'])})
    vagas = 0
    estac = []
    for e in d['estacionamento']:
        (x0, z0), (x1, z1) = ret(e['px'])
        comp = max(x1-x0, z1-z0)
        n = int(comp//VAGA_M)*e['fileiras']
        vagas += n
        estac.append({**e, 'm': [[x0, z0], [x1, z1]], 'vagas': n})
    lote = [m(p) for p in d['lote']]
    area = abs(sum(a[0]*b[1]-b[0]*a[1] for a, b in zip(lote, lote[1:]+lote[:1])))/2
    out = {
        'titulo': d['titulo'], 'fonte': 'implantacao.json', 'registro': reg,
        'referencial': 'metros; x para a direita da imagem do book, z para baixo; origem na quina de cima à esquerda do lote',
        'loteM': lote, 'loteGeo': [geo(p) for p in d['lote']], 'areaLoteM2': round(area, 1), 'areaBookM2': 11894.4,
        'torre': {'alaM': round(ala, 3), 'fundoM': round(fundo, 3), 'comprimentoM': round(comprimento, 3),
                  'corredorM': CORREDOR_M, 'nucleoM': NUCLEO_M, 'pavimentos': 13, 'peDireitoM': 2.6},
        'torres': torres, 'finais': d['finais'],
        'vias': [{**v, 'larguraM': round(v['largura']/s, 2), 'linhaM': [m(p) for p in v['linha']]} for v in d['vias']],
        'estacionamento': estac, 'vagasEstimadas': vagas, 'vagasBook': 290,
        'lazer': [{**l, 'm': ret(l['px'])} for l in d['lazer']],
    }
    (AQUI/'implantacao-m.json').write_text(json.dumps(out, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    conferir(imagem, d, out, s)
    print(json.dumps({'areaLoteM2': out['areaLoteM2'], 'torreM': [round(comprimento, 2), round(fundo, 2)],
                      'vagasEstimadas': vagas, 'vagasBook': 290}, ensure_ascii=False))


def conferir(imagem, d, out, s):
    """Desenha lote, vias, vagas, lazer e a torre em tamanho real sobre a implantação do book."""
    base = Image.open(imagem).convert('RGBA')
    over = Image.new('RGBA', base.size, (0, 0, 0, 0))
    g = ImageDraw.Draw(over)
    try:
        font = ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf', 22)
    except OSError:
        font = ImageFont.load_default(size=22)
    g.polygon([tuple(p) for p in d['lote']], outline='#ff2fd0', width=6)
    for v in d['vias']:
        g.line([tuple(p) for p in v['linha']], fill='#ffd23080', width=int(v['largura']*0.6))
    for e in out['estacionamento']:
        g.rectangle(e['px'], outline='#30c0ff', width=3)
        g.text((e['px'][0]+4, e['px'][1]+2), str(e['vagas']), font=font, fill='#30c0ff', stroke_width=2, stroke_fill='#000')
    for l in d['lazer']:
        g.rectangle(l['px'], outline='#7dff6a', width=3)
    for t in out['torres']:
        cu, cv = t['centroPx']
        hw, hd = t['larguraM']*s/2, t['profundidadeM']*s/2
        g.rectangle([cu-hw, cv-hd, cu+hw, cv+hd], outline='#ff6a2f', width=5)
        g.text((cu-hw+6, cv-hd+4), f"{t['nome']} {t['larguraM']:.1f} x {t['profundidadeM']:.1f} m", font=font, fill='#ff6a2f', stroke_width=2, stroke_fill='#000')
    Image.alpha_composite(base, over).convert('RGB').save(AQUI/'conferencia.jpg', quality=85)


if __name__ == '__main__':
    main()

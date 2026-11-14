"""Passa a implantação do caderno (pixels) para metros e para o mapa.

Lê implantacao.json; grava implantacao-m.json e conferencia.jpg.
Cada container é assentado com a medida real (6,058 ou 12,192 x 2,438 m), centrado onde o caderno o desenha.
python experimentos/containers-mooca-2026-11-05/implantacao/montar.py
"""
import hashlib
import json
import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

AQUI = Path(__file__).resolve().parent
MEDIDA = {'c6': 6.058, 'c12': 12.192}
LARGURA = 2.438
ALTURA = 2.591
CORES = {'c6': '#1f6fd1', 'c12': '#d1381f', 'deck': '#a5703f', 'passarela': '#555555', 'jardim': '#3f9f4f',
         'pergolado': '#8a6a2a', 'escada': '#7a2ad1', 'piso': '#999999'}


def main():
    d = json.loads((AQUI/'implantacao.json').read_text(encoding='utf-8'))
    imagem = (AQUI/d['imagem']).resolve()
    if hashlib.sha256(imagem.read_bytes()).hexdigest() != d['imagemSha256']:
        raise ValueError('A imagem da planta mudou; revisar implantacao.json.')
    reg = d['registro']
    s = reg['pxPorM']
    au, av = reg['ancoraPx']
    alat, alon = reg['ancoraGeo']
    rumo = math.radians(reg['rumoCimaGraus'])

    def m(u, v):   # metros a partir da âncora: x para leste (direita), z para o sul (baixo)
        return (u-au)/s, (v-av)/s

    def geo(x, z):
        leste = x*math.cos(rumo)-z*math.sin(rumo)
        norte = -z*math.cos(rumo)-x*math.sin(rumo)
        return [round(alat+norte/111320, 7), round(alon+leste/(111320*math.cos(math.radians(alat))), 7)]

    containers, avisos = [], []
    for c in d['containers']:
        u0, v0, u1, v1 = c['px']
        x0, z0 = m(u0, v0)
        x1, z1 = m(u1, v1)
        deitado = (x1-x0) >= (z1-z0)          # comprido no sentido leste-oeste
        comp, larg = MEDIDA[c['tipo']], LARGURA
        lido = max(x1-x0, z1-z0), min(x1-x0, z1-z0)
        if abs(lido[0]-comp) > 0.6 or abs(lido[1]-larg) > 0.4:
            avisos.append(f"{c['id']}: desenho {lido[0]:.2f} x {lido[1]:.2f} m contra {comp} x {larg} m")
        cx, cz = (x0+x1)/2, (z0+z1)/2
        w, p = (comp, larg) if deitado else (larg, comp)
        base = d['niveis'][str(c['nivel'])]
        containers.append({**{k: c[k] for k in ('id', 'nivel', 'tipo', 'uso')},
                           'centro': [round(cx, 3), round(cz, 3)], 'larguraX': w, 'profundidadeZ': p,
                           'deitado': deitado, 'base': base, 'topo': round(base+ALTURA, 3), 'geoCentro': geo(cx, cz)})
    superficies = []
    for f in d['superficies']:
        x0, z0 = m(*f['px'][:2])
        x1, z1 = m(*f['px'][2:])
        superficies.append({**{k: f[k] for k in ('id', 'nivel', 'tipo')},
                            'ret': [round(x0, 3), round(z0, 3), round(x1, 3), round(z1, 3)],
                            'base': d['niveis'][str(f['nivel'])]})
    todos = [(c['centro'][0]-c['larguraX']/2, c['centro'][1]-c['profundidadeZ']/2,
              c['centro'][0]+c['larguraX']/2, c['centro'][1]+c['profundidadeZ']/2) for c in containers]
    caixa = [min(t[0] for t in todos), min(t[1] for t in todos), max(t[2] for t in todos), max(t[3] for t in todos)]
    dorms = [c for c in containers if c['id'].startswith('d')]
    resumo = {'containers': len(containers), 'dormitorios': len(dorms),
              'porTipo': {t: sum(1 for c in dorms if c['uso'] == t) for t in sorted({c['uso'] for c in dorms})},
              'caixaM': [round(v, 2) for v in caixa],
              'pegadaM': [round(caixa[2]-caixa[0], 2), round(caixa[3]-caixa[1], 2)]}
    saida = {'schema': 'containers-mooca-implantacao-v1', 'fonte': 'implantacao.json',
             'fonteSha256': hashlib.sha256((AQUI/'implantacao.json').read_bytes()).hexdigest(),
             'eixos': 'x para leste, z para o sul, em metros a partir da esquina das ruas (âncora)',
             'ancoraGeo': reg['ancoraGeo'], 'niveis': d['niveis'], 'alturaContainer': ALTURA,
             'resumo': resumo, 'avisos': avisos, 'containers': containers, 'superficies': superficies}
    (AQUI/'implantacao-m.json').write_text(json.dumps(saida, ensure_ascii=False, indent=1)+'\n', encoding='utf-8')

    base = Image.open(imagem).convert('RGBA')
    over = Image.new('RGBA', base.size, (0, 0, 0, 0))
    dr = ImageDraw.Draw(over)
    try:
        font = ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf', 13)
    except OSError:
        font = ImageFont.load_default()

    def px(x, z):
        return au+x*s, av+z*s
    for f in superficies:
        x0, z0, x1, z1 = f['ret']
        cor = CORES[f['tipo']]
        dr.rectangle([px(x0, z0), px(x1, z1)], fill=cor+'33', outline=cor+'aa', width=1)
    for c in containers:
        x, z, w, p = *c['centro'], c['larguraX'], c['profundidadeZ']
        cor = CORES[c['tipo']]
        largura = 3 if c['nivel'] else 2
        dr.rectangle([px(x-w/2, z-p/2), px(x+w/2, z+p/2)], outline=cor, width=largura,
                     fill=cor+('22' if c['nivel'] else '11'))
        dr.text(px(x-w/2+0.3, z-p/2+0.2), c['id'], font=font, fill=cor)
    Image.alpha_composite(base, over).convert('RGB').save(AQUI/'conferencia.jpg', quality=85)
    print(json.dumps({'ok': not avisos, **resumo, 'avisos': avisos}, ensure_ascii=False))


if __name__ == '__main__':
    main()

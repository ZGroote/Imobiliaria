"""Passa a implantação do Vistas da Quinze para metros, mapa e apartamentos por andar.

Lê implantacao.json; grava implantacao-m.json, conferencia.jpg (pavimento do lazer com as unidades do 3º
andar por cima) e fachadas.jpg (as duas faces do pátio, andar por andar, com a cor da tipologia).
python experimentos/vistas-da-quinze-2026-11-07/implantacao/montar.py
"""
import hashlib
import json
import math
from pathlib import Path

from PIL import Image, ImageDraw

AQUI = Path(__file__).resolve().parent
COR = {'T01': (205, 60, 50), 'T02': (225, 120, 90), 'T03': (240, 150, 40), 'T04': (140, 70, 200),
       'T05': (240, 190, 60), 'T06': (60, 170, 90)}


def unidades(t):
    """Apartamentos de cada andar: o par da ponta tem o corpo que sobra até o recuo e o terraço sobre o recuo de baixo."""
    qx, qz = t['quinaSE']
    prof, corr = t['profundidadeUnidadeM'], t['corredorM']
    fundo = 2*prof+corr
    regra = t['tipologiaDaPonta']
    out = []
    for ala in t['alas']:
        w, n, f0 = ala['larguraM'], len(ala['pares']), ala['primeiroDegrau']
        comp = n*w

        def ponta(f):
            return comp-max(0, f-f0+1)*w/3

        for f in range(t['primeiroAndar'], t['ultimoAndar']+1):
            fim, fim_baixo = ponta(f), ponta(f-1)
            corpos = []
            for i in range(n):
                corpo = min(w, fim-i*w)
                if corpo >= 2*w/3-1e-6:
                    corpos.append([i, corpo])
                elif corpo > 1e-6 and corpos:
                    corpos[-1][1] += corpo        # sobra de 1/3: o vizinho de dentro estica
            for k, (i, corpo) in enumerate(corpos):
                e_ponta = f >= f0 and k == len(corpos)-1
                terraco = fim_baixo-fim if e_ponta else 0.0
                for lado, final in zip(('patio', 'fora'), ala['pares'][i]):
                    if not e_ponta:
                        tip = ala['tipologia']
                    else:
                        terco = round(3*corpo/w)
                        tip = {4: regra['corpo4/3'], 2: regra['corpo2/3']}.get(terco) or \
                            regra['corpo3/3']['impar' if lado == 'patio' else 'par']
                    a0, a1 = i*w, i*w+corpo           # ao longo da ala, a partir do núcleo
                    b0, b1 = (prof+corr, fundo) if lado == 'patio' else (0, prof)   # a partir da face de fora
                    if ala['id'] == 'sul':            # a ala sul corre para oeste a partir do núcleo
                        x0, x1 = qx-fundo-a1, qx-fundo-a0
                        z0, z1 = qz-b1, qz-b0
                        tx = [x0-terraco, x0] if terraco else None
                        tz = [z0, z1]
                    else:                             # a leste corre para norte
                        x0, x1 = qx-b1, qx-b0
                        z0, z1 = qz-fundo-a1, qz-fundo-a0
                        tx = [x0, x1]
                        tz = [z0-terraco, z0] if terraco else None
                    u = {'id': f'{f}{final}', 'andar': f, 'final': final, 'ala': ala['id'], 'lado': lado,
                         'tipologia': tip, 'corpoM': round(corpo, 3), 'x': [round(x0, 3), round(x1, 3)],
                         'z': [round(z0, 3), round(z1, 3)]}
                    if terraco:
                        u['terracoM'] = {'x': [round(v, 3) for v in tx], 'z': [round(v, 3) for v in tz]}
                    out.append(u)
    return out


def main():
    d = json.loads((AQUI/'implantacao.json').read_text(encoding='utf-8'))
    imagem = (AQUI/d['imagem']).resolve()
    if hashlib.sha256(imagem.read_bytes()).hexdigest() != d['imagemSha256']:
        raise ValueError('A imagem do pavimento mudou; revisar implantacao.json.')
    reg, t = d['registro'], d['torre']
    lat0, lon0 = reg['origemGeo']
    s = reg['imagemPxPorM']

    def geo(x, z):
        return [round(lat0-z/111320, 7), round(lon0+x/(111320*math.cos(math.radians(lat0))), 7)]

    qx, qz = t['quinaSE']     # a quina sudeste da torre fica em (160, 115) px na imagem

    def px(x, z):
        return 160+(qx-x)*s, 115+(qz-z)*s

    def m(p):
        return [round(qx-(p[0]-160)/s, 2), round(qz-(p[1]-115)/s, 2)]

    us = unidades(t)
    for u in us:
        u['centroGeo'] = geo(sum(u['x'])/2, sum(u['z'])/2)
    fundo = 2*t['profundidadeUnidadeM']+t['corredorM']
    lazer = [{**z, 'm': m(z['px'][:2])+m(z['px'][2:])} for z in d['lazer']]
    for z in lazer:   # a imagem é girada: ordena para [x0, z0, x1, z1] crescente
        x0, z0, x1, z1 = z['m']
        z['m'] = [min(x0, x1), min(z0, z1), max(x0, x1), max(z0, z1)]
    por_andar = {}
    for u in us:
        por_andar.setdefault(u['andar'], []).append(u['id'])
    contagem = {}
    for u in us:
        contagem[u['tipologia']] = contagem.get(u['tipologia'], 0)+1
    out = {
        'titulo': d['titulo'], 'fonte': 'implantacao.json', 'registro': reg,
        'referencial': reg['eixos']+'; origem no cruzamento das ruas',
        'loteM': d['lote'], 'loteGeo': [geo(*p) for p in d['lote']],
        'nucleoM': {'x': [qx-fundo, qx], 'z': [qz-fundo, qz]},
        'torre': {k: v for k, v in t.items() if k != 'alas'} | {'fundoAlaM': fundo,
                  'alas': [{k: v for k, v in a.items() if k != 'pares'} | {'comprimentoM': len(a['pares'])*a['larguraM']}
                           for a in t['alas']]},
        'lazer': lazer, 'unidades': us, 'porAndar': por_andar, 'totalUnidades': len(us), 'porTipologia': contagem,
        'limites': d['limites'],
    }
    (AQUI/'implantacao-m.json').write_text(json.dumps(out, ensure_ascii=False, indent=1)+'\n', encoding='utf-8')

    # Conferência 1: unidades do 3º andar e o lazer sobre o pavimento do lazer.
    im = Image.open(imagem).convert('RGB')
    dr = ImageDraw.Draw(im)
    for u in us:
        if u['andar'] != 3:
            continue
        a, b = px(u['x'][1], u['z'][1]), px(u['x'][0], u['z'][0])
        dr.rectangle([a, b], outline=COR[u['tipologia']], width=2)
        dr.text(((a[0]+b[0])/2-6, (a[1]+b[1])/2-5), u['final'], fill=(255, 255, 0))
    a, b = px(qx, qz), px(qx-fundo, qz-fundo)
    dr.rectangle([a, b], outline=(0, 200, 255), width=2)
    for z in lazer:
        x0, z0, x1, z1 = z['m']
        dr.rectangle([px(x1, z1), px(x0, z0)], outline=(0, 255, 120), width=1)
    lote = [px(*p) for p in d['lote']]
    dr.line(lote+lote[:1], fill=(255, 255, 255), width=1)
    im.save(AQUI/'conferencia.jpg', quality=90)

    # Conferência 2: as faces do pátio, como na perspectiva numerada (cor por tipologia).
    E, H = 14, 18
    ala_sul = [u for u in us if u['ala'] == 'sul' and u['lado'] == 'patio']
    ala_leste = [u for u in us if u['ala'] == 'leste' and u['lado'] == 'patio']
    W = int((qx-fundo-min(u['x'][0] for u in ala_sul)+2)*E+(qz-fundo-min(u['z'][0] for u in ala_leste)+2)*E)+60
    fa = Image.new('RGB', (W, (t['ultimoAndar']+2)*H), 'white')
    dr = ImageDraw.Draw(fa)
    base = (t['ultimoAndar']+1)*H
    x_leste = 10
    for u in ala_leste:   # vista do oeste: norte à esquerda
        x0 = x_leste+(u['z'][0]-(qz-fundo-4*7.0))*E
        x1 = x_leste+(u['z'][1]-(qz-fundo-4*7.0))*E
        y1 = base-(u['andar']-2)*H
        dr.rectangle([x0, y1-H+2, x1, y1], fill=COR[u['tipologia']], outline=(60, 60, 60))
        dr.text((x0+3, y1-H+4), u['id'], fill=(255, 255, 255))
        if 'terracoM' in u:
            dr.rectangle([x_leste+(u['terracoM']['z'][0]-(qz-fundo-28))*E, y1-5, x0, y1], fill=(150, 150, 150))
    x_sul = x_leste+30*E+40
    for u in ala_sul:     # vista do norte: leste à esquerda
        x0 = x_sul+((qx-fundo)-u['x'][1])*E
        x1 = x_sul+((qx-fundo)-u['x'][0])*E
        y1 = base-(u['andar']-2)*H
        dr.rectangle([x0, y1-H+2, x1, y1], fill=COR[u['tipologia']], outline=(60, 60, 60))
        dr.text((x0+3, y1-H+4), u['id'], fill=(255, 255, 255))
        if 'terracoM' in u:
            dr.rectangle([x1, y1-5, x_sul+((qx-fundo)-u['terracoM']['x'][0])*E, y1], fill=(150, 150, 150))
    for i, (k, c) in enumerate(COR.items()):
        dr.rectangle([10+i*70, 4, 22+i*70, 14], fill=c)
        dr.text((26+i*70, 4), k, fill=(0, 0, 0))
    fa.save(AQUI/'fachadas.jpg', quality=90)
    print(json.dumps({'unidades': len(us), 'porTipologia': contagem,
                      'andar20': por_andar[20], 'andar15': por_andar[15]}, ensure_ascii=False))


if __name__ == '__main__':
    main()

"""Marcos de qualidade x peso x tempo x custo, dos numeros MEDIDOS (medicao-cama-rede-*.json).
   python custo.py  -> marcos.md"""
import json, os, brotli
AQUI = os.path.dirname(os.path.abspath(__file__))
W = os.path.join(AQUI, 'web-solteiro')
br = lambda f: len(brotli.compress(open(os.path.join(W, f), 'rb').read(), quality=11))
geo = br('cama.json') + br('geo.bin')
M = json.load(open(os.path.join(W, 'cama.json')))
cum, acc = {}, geo
for q in ('q1', 'q2', 'q3', 'q4'):
    acc += M['bytes'][q]
    cum[q] = acc / 1024
L = json.load(open(os.path.join(AQUI, 'medicao-cama-rede-site-leve.json')))['res']
P = json.load(open(os.path.join(AQUI, 'medicao-cama-rede-site.json')))['res']
leve, pbr = L['4g-bom']['mediana']['kb_pagina'], P['4g-bom']['mediana']['kb_pagina']
# v6: LEVE enxuta (sem __luzue, biblioteca so com as 7 pecas pedidas, three separado) + cama
# AVIF / atlas por skyline / travesseiro 1,7 mil tri / pula nivel em rede rapida / so na visita
V6 = json.load(open(os.path.join(AQUI, 'medicao-cama-rede-cedros-v6-site-leve.json')))['res']
V6P = V6['4g-bom']['mediana']['kb_pagina']
V6C = max(V6[p]['mediana']['kb_cama'] for p in V6)       # pior caso: sem pular nivel
PERFIS = [('4g-bom', '4G bom (20 Mbps)'), ('4g-fraco', '4G fraco (5 Mbps)'), ('3g', '3G (1,6 Mbps)'),
          ('celular-lighthouse', 'celular lento + CPU 4x')]
GRATIS_GB, USD_GB, CAMBIO, VIS = 0.36, 0.15, 5.50, 1000
marcos = [('A', 'hoje: cama do catalogo', leve, None, None),
          ('B', 'cama assada q1 (forma)', leve + cum['q1'], 'q1', L),
          ('C', 'cama assada q2 (basico)', leve + cum['q2'], 'q2', L),
          ('D', 'cama assada q3 (detalhe)', leve + cum['q3'], 'q3', L),
          ('E', 'cama assada q4 (maximo)', leve + cum['q4'], None, None),
          ('F', 'q3 + parede/piso PBR (v4)', pbr + cum['q3'], 'q3', P),
          ('G', 'v6: base enxuta + cama q3 otimizada', V6P + V6C, 'q3', V6)]
o = ['| marco | o que tem | peso 1a visita | ' + ' | '.join(n for _, n in PERFIS) + ' | GB/mes (1000/dia) | US$/mes | R$/mes |',
     '|' + '---|' * (6 + len(PERFIS))]
for k, nome, kb, q, R in marcos:
    tempos = []
    for p, _ in PERFIS:
        if R is None:
            tempos.append('abre %.1f s' % L[p]['mediana']['quadro1'] if k == 'A' else 'nao medido')
        else:
            m = R[p]['mediana']
            tempos.append('abre %.1f / cama %.1f s' % (m['quadro1'], m[q]))
    gb_dia = VIS * kb / 1024 / 1024
    usd = max(0, gb_dia - GRATIS_GB) * USD_GB * 30
    o.append('| %s | %s | %.0f KB | %s | %.0f | %.2f | %.2f |' % (k, nome, kb, ' | '.join(tempos), gb_dia * 30, usd, usd * CAMBIO))
open(os.path.join(AQUI, 'marcos.md'), 'w', encoding='utf-8').write('\n'.join(o) + '\n')
print('\n'.join(o))
print('cama cumulativa KB:', {k: round(v) for k, v in cum.items()}, ' LEVE %.0f KB, v4 %.0f KB' % (leve, pbr))

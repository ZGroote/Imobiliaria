"""Confere (e com --corrigir afasta) portas coladas na quina.

Com 10 cm entre o eixo da porta e a parede perpendicular sobravam ~4 cm de parede: os batentes e as
guarnições das duas portas da quina se cruzavam e abriam uma fresta escura (print do usuário, 07/11).
Mede em unidade.json (metros, eixo das paredes) e corrige em planta.json (pixels da imagem do book);
depois rode construir.ts da planta.

python experimentos/vistas-da-quinze-2026-11-07/interiores/folga_portas.py [--corrigir]
"""
import json
import math
import sys
from pathlib import Path

AQUI = Path(__file__).resolve().parent
# m do eixo da parede vizinha até o vão: meia parede (6,5 cm) + guarnição (5,5 cm) de interior-portas.js.
MIN = .15   # 12,5 cm arredondado para a grade de 5 cm do construtor (gradeMm)
LARGURA_MIN = .60


def folgas(planta, d):
    """(folga antes, folga depois) da porta até a junção de parede mais próxima no mesmo alinhamento."""
    verts = {tuple(v) for c in planta['comodos'] for v in c['poly']}
    horiz = d['wallId'].rsplit('-', 1)[1] in ('north', 'south')
    x, y = d['p']
    c, h = (x if horiz else y), d['largura']/2
    antes, depois = math.inf, math.inf
    for vx, vy in verts:
        if abs((vy if horiz else vx)-(y if horiz else x)) > 1e-3:
            continue
        s = vx if horiz else vy
        if s <= c-h+1e-6:
            antes = min(antes, c-h-s)
        elif s >= c+h-1e-6:
            depois = min(depois, s-c-h)
    return antes, depois


def main(corrigir):
    ruins = 0
    for pasta in sorted(AQUI.glob('T0?')):
        planta = json.loads((pasta/'unidade.json').read_text(encoding='utf-8'))['planta']
        fonte = json.loads((pasta/'planta.json').read_text(encoding='utf-8'))
        portas = [a for a in fonte['aberturas'] if a['tipo'] == 'door']
        assert len(portas) == len(planta['portas']), pasta.name
        mudou = False
        for a, d in zip(portas, planta['portas']):
            antes, depois = folgas(planta, d)
            if min(antes, depois) >= MIN-.01:   # o eixo da planta tem ±1 px (2 cm)
                continue
            ruins += 1
            m_px = d['largura']/(a['ate']-a['de'])
            assert .015 < m_px < .03, (pasta.name, d['id'], m_px)   # a mesma porta nos dois arquivos
            de, ate = a['de'], a['ate']
            desloc = (MIN-antes) if antes < depois else -(MIN-depois)
            if max(antes, depois)-abs(desloc) >= MIN:   # cabe: empurra para longe da quina
                px = round(abs(desloc)/m_px)*(1 if desloc > 0 else -1)
                de, ate = de+px, ate+px
            else:                                        # trecho curto: cada lado encolhe o que falta
                de += max(0, round((MIN-antes)/m_px))
                ate -= max(0, round((MIN-depois)/m_px))
                if (ate-de)*m_px < LARGURA_MIN-1e-6:
                    print(f'{pasta.name} {d["id"]}: trecho curto demais ({antes:.2f}/{d["largura"]:.2f}/{depois:.2f} m)')
                    continue
            print(f'{pasta.name} {d["id"]} {a["comodo"]} {a["lado"]}: folga {antes:.2f}/{depois:.2f} m, '
                  f'px {a["de"]}-{a["ate"]} -> {de}-{ate}')
            if corrigir:
                a['de'], a['ate'] = de, ate
                mudou = True
        if mudou:
            (pasta/'planta.json').write_text(json.dumps(fonte, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    print('PORTAS_NA_QUINA', ruins)
    return ruins


if __name__ == '__main__':
    main('--corrigir' in sys.argv)

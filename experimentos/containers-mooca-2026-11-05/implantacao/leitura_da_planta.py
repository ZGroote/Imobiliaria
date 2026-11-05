"""Leitura da planta 1:200 (térreo e 1º pavimento sobrepostos): grava implantacao.json.

Coordenadas lidas na planta-terreo.png ampliada 2x a partir de (640, 240); o 1º pavimento
fica deslocado (58, -58) px na imagem dele e foi lido já alinhado ao térreo.
python experimentos/containers-mooca-2026-11-05/implantacao/leitura_da_planta.py experimentos/containers-mooca-2026-11-05/implantacao/implantacao.json
"""
import hashlib, json, sys
from pathlib import Path

out = Path(sys.argv[1])
img = Path('plantas_fornecidas/containers-mooca/fonte/planta-terreo.png')
O = lambda x, y: [round(640+x/2, 1), round(240+y/2, 1)]
R = lambda x0, y0, x1, y1: O(x0, y0)+O(x1, y1)

# (id, nível, tipo, uso, retângulo em zoom, lado do banheiro/fundo)
C = [
    # Térreo: áreas comuns (bloco noroeste e bloco oeste)
    ('c01', 0, 'c6', 'Banheiros coletivos', (65, 40, 155, 270)),
    ('c02', 0, 'c6', 'Refeitório', (65, 270, 155, 500)),
    ('c03', 0, 'c6', 'Cozinha compartilhada', (155, 410, 390, 500)),
    ('c04', 0, 'c6', 'Sala de convivência', (390, 40, 480, 270)),
    ('c05', 0, 'c6', 'Copa e despensa', (390, 270, 480, 500)),
    ('c06', 0, 'c6', 'Sala de convivência (oeste)', (410, 700, 505, 925)),
    ('c07', 0, 'c6', 'Escada e depósito', (405, 930, 635, 1020)),
    ('c08', 0, 'c6', 'Administração', (635, 930, 865, 1020)),
    ('c09', 0, 'c6', 'Lavanderia', (405, 1020, 500, 1250)),
    ('c10', 0, 'c6', 'Sala de estudos', (770, 1030, 860, 1255)),
    # Térreo: dormitórios 6 m
    ('d01', 0, 'c6', 'individual', (785, 135, 875, 365)),
    ('d02', 0, 'c6', 'individual', (1155, 135, 1245, 365)),
    ('d03', 0, 'c6', 'individual', (1490, 250, 1720, 340)),
    ('d04', 0, 'c6', 'individual', (1490, 600, 1720, 690)),
    ('d05', 0, 'c6', 'individual', (1495, 970, 1725, 1060)),
    ('d06', 0, 'c6', 'individual', (1495, 1325, 1725, 1415)),
    ('d07', 0, 'c6', 'individual-pne', (930, 1275, 1020, 1500)),
    ('d08', 0, 'c6', 'individual-pne', (1280, 1275, 1370, 1500)),
    # 1º pavimento: 12 m
    ('d09', 1, 'c12', 'quadruplo', (783, 180, 1245, 270)),
    ('d10', 1, 'c12', 'quadruplo', (1555, 255, 1648, 710)),
    ('d11', 1, 'c12', 'casal-bebe', (1555, 970, 1648, 1430)),
    ('d12', 1, 'c12', 'quadruplo', (915, 1345, 1380, 1435)),
    # 1º pavimento: 6 m
    ('d13', 1, 'c6', 'individual', (62, 40, 155, 268)),
    ('d14', 1, 'c6', 'casal', (62, 272, 155, 500)),
    ('d15', 1, 'c6', 'casal', (378, 40, 610, 130)),
    ('d16', 1, 'c6', 'individual', (275, 410, 500, 500)),
    ('d17', 1, 'c6', 'individual', (405, 795, 500, 1022)),
    ('d18', 1, 'c6', 'individual', (405, 1024, 500, 1250)),
    ('d19', 1, 'c6', 'individual', (768, 795, 862, 1024)),
    ('d20', 1, 'c6', 'individual', (768, 1026, 862, 1255)),
]
# Superfícies abertas: deck, passarela (grade metálica), pergolado, terraço, escada, pátio
S = [
    ('deck-norte', 0, 'deck', (875, 125, 1155, 365)),
    ('deck-leste-1', 0, 'deck', (1490, 340, 1720, 600)),
    ('deck-leste-2', 0, 'deck', (1490, 1060, 1735, 1325)),
    ('deck-sul', 0, 'deck', (1020, 1275, 1280, 1500)),
    ('deck-estudos', 0, 'deck', (500, 1020, 770, 1250)),
    ('refeitorio-coberto', 0, 'piso', (155, 40, 390, 410)),
    ('patio-norte', 0, 'jardim', (480, 130, 895, 500)),
    ('patio-leste', 0, 'jardim', (955, 365, 1490, 545)),
    ('patio-central', 0, 'jardim', (950, 595, 1490, 1195)),
    ('patio-oeste', 0, 'jardim', (865, 590, 895, 1270)),
    ('pergolado', 0, 'pergolado', (1395, 695, 1495, 955)),
    ('pergolado-leste', 0, 'pergolado', (1610, 690, 1720, 800)),
    ('passarela-norte', 1, 'passarela', (1245, 250, 1490, 365)),
    ('passarela-leste', 1, 'passarela', (1490, 340, 1555, 1300)),
    ('passarela-sul', 1, 'passarela', (925, 1270, 1495, 1345)),
    ('passarela-oeste', 1, 'passarela', (495, 1025, 770, 1100)),
    ('circulacao-oeste', 1, 'passarela', (495, 930, 770, 1025)),
    ('terraco-noroeste', 1, 'deck', (195, 45, 390, 365)),
    ('escada-leste', 0, 'escada', (1390, 110, 1485, 250)),
    ('escada-sul', 0, 'escada', (1395, 1375, 1500, 1540)),
    ('escada-noroeste', 0, 'escada', (480, 280, 560, 440)),
]
d = {
    'titulo': 'Moradia estudantil em containers (Mooca) · implantação',
    'imagem': '../../../'+img.as_posix(), 'imagemSha256': hashlib.sha256(img.read_bytes()).hexdigest(),
    'registro': {
        'pxPorM': 18.9, 'rumoCimaGraus': 0,
        'ancoraPx': O(698, 2922), 'ancoraGeo': [-23.5581268, -46.6057803],
        'metodo': 'Escala pelos containers (6,058 x 2,438 m e 12,192 x 2,438 m) medidos na planta 1:200. '
                  'Norte para cima (seta da p. 90; a Rua Guaratinguetá corre leste-oeste no OSM e na planta). '
                  'Âncora: esquina das ruas Guaratinguetá e João Antônio de Oliveira (eixo das vias no OSM) '
                  'no cruzamento dos eixos das duas faixas hachuradas da planta.',
        'divergencias': [
            'O trecho diagonal da Rua João Antônio mede ~58 m na planta e ~61 m no OSM.',
            'O lote da planta não tem cota; o caderno diz 2.179,7 m².']},
    'niveis': {'0': 0.0, '1': 2.69, 'cobertura': 5.38},
    'containers': [{'id': i, 'nivel': n, 'tipo': t, 'uso': u, 'px': R(*r)} for i, n, t, u, r in C],
    'superficies': [{'id': i, 'nivel': n, 'tipo': t, 'px': R(*r)} for i, n, t, r in S],
}
out.write_text(json.dumps(d, ensure_ascii=False, indent=1)+'\n', encoding='utf-8')
print(len(C), len(S))

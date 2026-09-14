"""Contrato de geometria: dados limitados, nunca código Python vindo do anúncio/IA."""
import math
import re

TIPOS = ['caixa', 'telhado_duas_aguas', 'portao_vertical', 'portao_horizontal', 'janela', 'malha', 'porta', 'cilindro', 'escada']
VETOR = {'type': 'array', 'items': {'type': 'number'}, 'minItems': 3, 'maxItems': 3}
PARTE = {
    'nome': {'type': 'string'}, 'tipo': {'type': 'string', 'enum': TIPOS},
    'centro': VETOR, 'tamanho': VETOR, 'rotacao_graus': {'type': 'number'},
    'cor': {'type': 'string'},
    'vertices': {'type': 'array', 'items': VETOR},
    'triangulos': {'type': 'array', 'items': {'type': 'array', 'items': {'type': 'integer'}, 'minItems': 3, 'maxItems': 3}},
    'referencias': {'type': 'array', 'items': {'type': 'string'}},
    'estimado': {'type': 'boolean'},
}
SCHEMA = {
    'type': 'object', 'additionalProperties': False,
    'properties': {
        'versao': {'type': 'integer', 'enum': [1]}, 'titulo': {'type': 'string'},
        'observacoes': {'type': 'array', 'items': {'type': 'string'}},
        'partes': {'type': 'array', 'items': {
            'type': 'object', 'additionalProperties': False,
            'properties': PARTE, 'required': list(PARTE),
        }},
    },
    'required': ['versao', 'titulo', 'observacoes', 'partes'],
}


def validar(receita):
    """Rejeita coordenadas absurdas, malhas quebradas e receitas vazias antes do Blender."""
    def fail(message):
        raise ValueError('Receita inválida: ' + message)

    def vetor(v, label, positive=False):
        if not isinstance(v, list) or len(v) != 3:
            fail(label + ' precisa de três números')
        for n in v:
            if isinstance(n, bool) or not isinstance(n, (int, float)) or not math.isfinite(n) or abs(n) > 500:
                fail(label + ' contém medida inválida')
            if positive and not .001 <= n <= 500:
                fail(label + ' precisa ter dimensões positivas')

    if not isinstance(receita, dict) or set(receita) != set(SCHEMA['required']) or receita['versao'] != 1:
        fail('estrutura ou versão desconhecida')
    if not isinstance(receita['titulo'], str) or not receita['titulo'].strip():
        fail('título ausente')
    if not isinstance(receita['observacoes'], list) or not receita['observacoes'] or not all(isinstance(s, str) for s in receita['observacoes']):
        fail('registre as limitações das referências')
    if not isinstance(receita['partes'], list) or not 1 <= len(receita['partes']) <= 500:
        fail('esperadas entre 1 e 500 peças')
    vertices_total = 0
    nomes = set()
    for p in receita['partes']:
        if not isinstance(p, dict) or set(p) != set(PARTE):
            fail('campos de peça desconhecidos ou ausentes')
        if not isinstance(p['nome'], str) or not p['nome'].strip() or p['nome'] in nomes:
            fail('cada peça precisa de nome único')
        nomes.add(p['nome'])
        if p['tipo'] not in TIPOS:
            fail('tipo desconhecido')
        vetor(p['centro'], p['nome'] + ': centro')
        vetor(p['tamanho'], p['nome'] + ': tamanho', positive=True)
        rot = p['rotacao_graus']
        if isinstance(rot, bool) or not isinstance(rot, (int, float)) or not math.isfinite(rot) or abs(rot) > 360:
            fail('rotação inválida')
        if not isinstance(p['cor'], str) or not re.fullmatch(r'#[0-9a-fA-F]{6}', p['cor']):
            fail('cor deve ser #RRGGBB')
        if not isinstance(p['estimado'], bool) or not isinstance(p['referencias'], list) or not all(isinstance(s, str) for s in p['referencias']):
            fail('evidências inválidas')
        if not p['estimado'] and not p['referencias']:
            fail('peça declarada observada sem referência')
        verts, tris = p['vertices'], p['triangulos']
        if not isinstance(verts, list) or not isinstance(tris, list):
            fail('malha deve conter listas')
        if p['tipo'] != 'malha' and (verts or tris):
            fail('primitiva não deve conter malha adicional')
        if p['tipo'] == 'malha' and (len(verts) < 3 or not tris):
            fail('malha vazia')
        vertices_total += len(verts)
        if vertices_total > 100000 or len(tris) > 100000:
            fail('malha excede o limite de tamanho')
        for v in verts:
            vetor(v, 'vértice')
        for tri in tris:
            if not isinstance(tri, list) or len(tri) != 3 or any(type(i) is not int or not 0 <= i < len(verts) for i in tri) or len(set(tri)) != 3:
                fail('triângulo com índices inválidos')
    return receita


def validar_referencias(receita, manifesto):
    nomes = {str(f['arquivo']).replace('\\', '/').rsplit('/', 1)[-1] for f in manifesto.get('fotos', [])}
    for p in receita['partes']:
        for ref in p['referencias']:
            if ref not in nomes:
                raise ValueError('Referência inexistente na galeria deste anúncio: ' + ref)
    return receita

"""Fontes efetivamente consumidas pela montagem, inclusive opcionais ausentes."""
from pathlib import Path
import hashlib
import json

from .config import RAIZ


def entradas(config):
    cid = config.cidade()
    paths = {RAIZ / 'padrao/cidades' / (cid.slug + '.json')}
    paths.update((RAIZ / 'pipeline/build').glob('*.py'))
    paths.update(RAIZ / p for p in ('pipeline/montar.py', 'padrao/cidade.py',
                                  'pipeline/encaixar_casas_lotes.py'))
    paths.update(config.fonte.rglob('*.js'))
    paths.update(config.fonte.rglob('*.css'))
    paths.update(config.fonte.glob('*.html'))
    paths.update(config.fonte / p for p in ('app.js', 'estilo.css', 'cabeca.html',
                                          'corpo.html', 'rabo.html',
                                          'lib/three.min.js', 'lib/earcut.min.js'))
    paths.add(config.fonte / 'modules.json')
    for key in ('imoveis', 'chao_tris', 'muros', 'rua_tris', 'relevo', 'portoes',
                'vegetacao', 'city_saida', 'arvores', 'pois', 'lotes', 'lotes_visualizacao'):
        value = cid._fontes.get(key, [])
        for p in ([value] if isinstance(value, str) else value):
            paths.add(RAIZ / p)
    paths.add(RAIZ / 'moveis/moveis_lib.json')
    paths.update(RAIZ / 'texturas' / (n + '.webp') for n in ('reboco', 'tijolo', 'chao'))
    for pattern in ('*/unidade.json', '*/moveis.auto.json'):
        paths.update((RAIZ / 'plantas_fornecidas').glob(pattern))
    paths.update((RAIZ / 'unreal/lightmaps').glob('*.png'))
    paths.update((RAIZ / 'unreal/malhas').glob('*.tiles.json'))
    if (config.fonte / 'urban-models.js').exists():
        paths.update(RAIZ / 'modelos_urbanos/v1' / p for p in ('mapa-casas.json', 'compactos.json'))
    if (config.fonte / 'exterior-details.js').exists():
        paths.update(RAIZ / 'exteriores/v1' / p for p in (
            'mapa-exteriores.json', 'encaixes.json', 'componentes.json',
            'terrenos-manifesto.json', 'atlas-distante.json', 'atlas-distante.png'))
    if (config.fonte / 'listing-models.js').exists():
        paths.add(RAIZ / 'modelos_cadastrados/estudos.json')
    return sorted(paths)


def snapshot(paths):
    """Conteudo e presenca: remover um opcional tambem muda a pagina."""
    result = {}
    for p in paths:
        p = Path(p)
        if p.is_file():
            with p.open('rb') as stream:
                result[str(p)] = hashlib.file_digest(stream, 'sha256').hexdigest()
        else:
            result[str(p)] = None
    return result


def assinatura(config):
    values = dict(cidade=config.slug, variante=config.versao,
                  entradas=snapshot(entradas(config)),
                  saidas=[str(config.saida(k)) for k in ('html_saida', 'html_comprimido')])
    return hashlib.sha256(json.dumps(values, sort_keys=True).encode()).hexdigest()

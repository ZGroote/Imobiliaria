"""Entrega portátil da miniatura e das comparações verificadas."""
from pathlib import Path
import hashlib
import json
import zipfile

ROOT = Path(__file__).resolve().parent

def confere_hash(relative, expected):
    path = ROOT / relative
    if not path.is_file() or hashlib.sha256(path.read_bytes()).hexdigest() != expected:
        raise SystemExit('Artefato ausente ou alterado após revisão: ' + relative)

def main():
    report = json.loads((ROOT / 'validacao-referencias.json').read_text(encoding='utf8'))
    if not report['allHardGatesPass']:
        raise SystemExit('As quatro comparações devem estar verificadas antes da entrega.')
    visual = json.loads((ROOT / 'validacao-visual.json').read_text(encoding='utf8'))
    if visual['status'] != 'PASS' or visual['modeloSHA256'] != report['sourceSHA256']:
        raise SystemExit('Revisão visual ausente ou desatualizada.')
    for relative, expected in visual['capturasSHA256'].items():
        confere_hash(relative, expected)
    interior = json.loads((ROOT / 'validacao-interior.json').read_text(encoding='utf8'))
    if interior['status'] != 'PASS':
        raise SystemExit('Interior do construtor ainda não aprovado visualmente.')
    for relative, expected in interior['artefatosSHA256'].items():
        confere_hash(relative, expected)
    for relative, expected in interior['capturasSHA256'].items():
        confere_hash(relative, expected)
    light = json.loads((ROOT / 'interior/luz/manifest.json').read_text(encoding='utf8'))
    if not light.get('ready') or not light.get('geometryApproved'):
        raise SystemExit('O mapa de luz próprio do interior ainda não está pronto/aprovado.')
    if light['unitSHA256'] != interior['unidadeSHA256'] or light['sourceSHA256'] != interior['cenaSHA256']:
        raise SystemExit('A aprovação do interior não corresponde ao mapa de luz atual.')
    confere_hash('interior/previa/unidade.json', interior['unidadeSHA256'])
    files = [ROOT / name for name in ('maquete-liv-ipanema.html', 'liv-ipanema.blend',
             'liv-ipanema.glb', 'LEIA-ME.md', 'BUILD_NOTES.md', 'validacao-referencias.json',
             'validacao-visual.json', 'validacao-interior.json',
             'gerar_pagina.py', 'liv-viewer.js', 'liv-interior.js',
             'liv-interior-lightmap.js', 'comparar_interior.py',
             'validar_interior.py', 'empacotar.py', 'qa/interior-ui-final.png')]
    files += [ROOT / 'interior' / name for name in ('README.md', 'referencia.json',
             'projeto-planta.json', 'leitura.json', 'moveis.json', 'contexto.json',
             'construir-interior.ts', 'comparativo-captura.png',
             'previa/unidade.json', 'previa/relatorio.json')]
    files += [ROOT / relative for relative in interior.get('arquivosEntrega', [])]
    files += sorted((ROOT / 'comparacoes').glob('*.png'))
    files += sorted((ROOT / 'referencias').glob('*.jpg'))
    files = list(dict.fromkeys(files))
    manifest = {'sourceURL': report['sourceURL'], 'geometrySHA256': report['sourceSHA256'],
                'interiorUnidadeSHA256': interior['unidadeSHA256'],
                'files': {p.relative_to(ROOT).as_posix(): {
                    'bytes': p.stat().st_size, 'sha256': hashlib.sha256(p.read_bytes()).hexdigest()
                } for p in files}}
    (ROOT / 'entrega-manifest.json').write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf8')
    files.append(ROOT / 'entrega-manifest.json')
    destination = ROOT / 'liv-ipanema-entrega.zip'
    with zipfile.ZipFile(destination, 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
        for path in files:
            archive.write(path, path.relative_to(ROOT).as_posix())
    with zipfile.ZipFile(destination) as archive:
        if archive.testzip() is not None:
            raise RuntimeError('Falha de integridade no arquivo de entrega.')
    print('ENTREGA_VERIFICADA', destination, destination.stat().st_size)

if __name__ == '__main__':
    main()

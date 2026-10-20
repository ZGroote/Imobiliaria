"""Confere a frescura dos artefatos; exige revisão visual explícita da cena final."""
from pathlib import Path
import gzip
import hashlib
import json

ROOT = Path(__file__).resolve().parent
LIGHT = ROOT / 'interior/luz'

def read(relative):
    return json.loads((ROOT / relative).read_text('utf8'))

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def main():
    visual = read('revisao-interior.json')
    if visual['status'] != 'PASS':
        raise SystemExit('A revisão visual do interior deve ser feita após carregar o atlas.')
    manifest = read('interior/luz/manifest.json')
    captures = read('qa/interior-capturas.json')
    runtime = read('qa/interior-runtime.json')
    pipeline = read('interior/previa/relatorio.json')
    unit_hash = sha(ROOT / 'interior/previa/unidade.json')
    if not manifest['ready'] or not manifest['geometryApproved']:
        raise SystemExit('Mapa de luz próprio não calculado/aprovado.')
    if captures.get('etapa') != 'atlas-real-ativo' or captures['sourceSHA256'] != manifest['sourceSHA256']:
        raise SystemExit('As fotos devem ser feitas com o atlas final ativo.')
    for doc, key in ((manifest, 'unitSHA256'), (captures, 'unidadeSHA256'),
                     (runtime, 'unidadeSHA256'), (visual, 'unidadeSHA256')):
        if doc[key] != unit_hash:
            raise SystemExit('Documento não corresponde à unidade final do construtor: ' + key)
    if not pipeline['geometria']['conferida'] or not runtime['cadastroCruPreservado']:
        raise SystemExit('Fluxo nominal do construtor não conferido.')
    if runtime['erros'] or runtime['avisos']:
        raise SystemExit('Há erro de runtime ou item sem catálogo.')
    nav = runtime['navegacao']
    if len(nav['alcancaveis']) != nav['totalAmbientes'] or nav['totalAmbientes'] != 6:
        raise SystemExit('A visita deve alcançar os seis ambientes reais.')
    if len(nav['rotasAutomaticas']) != 6 or not all(r['segmentosLivres'] for r in nav['rotasAutomaticas']):
        raise SystemExit('Rotas automáticas não conferidas contra paredes e móveis.')
    atlas = runtime.get('atlas')
    if not atlas or not atlas['ready'] or not atlas['active'] or atlas['targetsMapped'] != manifest['objects']:
        raise SystemExit('A luz precisa estar aplicada aos objetos no canvas final.')
    if not all(atlas[k] for k in ('geometryHashVerified', 'textureHashVerified',
                'layoutVerified', 'materialsVerified', 'sourceGeometryVerified', 'semAOduplicado')):
        raise SystemExit('Contrato geométrico/material do atlas não conferido no navegador.')
    if atlas['sourceSHA256'] != manifest['sourceSHA256'] or atlas['textureSHA256'] != manifest['textureSHA256']:
        raise SystemExit('O runtime não usa a cena/atlas finais.')
    edit = runtime.get('editFallbackRestauracao')
    if not edit or not all(edit['invalid'][k] for k in ('invalidated', 'editPreserved', 'fallbackWithoutAtlas')):
        raise SystemExit('Mover um móvel deve preservar a edição e invalidar a luz antiga.')
    if not edit['restored'] or not edit['active']:
        raise SystemExit('Restaurar o layout deve reativar o atlas correspondente.')
    mobile = runtime['celular']
    if mobile['document'] > mobile['width'] or not mobile['active'] or mobile['targetsMapped'] != manifest['objects']:
        raise SystemExit('O interior deve funcionar na tela móvel sem overflow.')
    if sha(LIGHT / 'source.json') != manifest['sourceSHA256']:
        raise SystemExit('Cena alterada após o cálculo da luz.')
    if sha(LIGHT / 'geometry-compact.json') != manifest['geometrySHA256']:
        raise SystemExit('UVs/índices alterados após o cálculo da luz.')
    texture_path = ROOT / manifest['textureURL']
    texture_hash = hashlib.sha256(gzip.decompress(texture_path.read_bytes())).hexdigest()
    if texture_hash != manifest['textureSHA256']:
        raise SystemExit('Bytes RGBM não correspondem ao atlas calculado.')
    if visual['cenaSHA256'] != manifest['sourceSHA256']:
        raise SystemExit('A revisão visual não corresponde à cena final.')
    if any(doc['textureSHA256'] != texture_hash for doc in (visual, captures)):
        raise SystemExit('As fotografias/revisão não correspondem ao atlas final.')
    for relative, expected in captures['capturasSHA256'].items():
        if sha(ROOT / relative) != expected or visual['capturasSHA256'].get(relative) != expected:
            raise SystemExit('Foto alterada ou não revisada: ' + relative)
    delivery = [
        'interior/LUZ.md', 'interior/exporter-interior.js', 'interior/preparar_luz.py',
        'interior/bake_luz.py', 'interior/denoise_luz.py',
        'interior/auditar_cena.py', 'interior/auditar_saida.py',
        'interior/luz/source.json', 'interior/luz/export.json', 'interior/luz/unwrap.json',
        'interior/luz/approval.json', 'interior/luz/manifest.json', 'interior/luz/bake.json',
        'interior/luz/denoise.json', 'interior/luz/audit-transport.json',
        'interior/luz/audit-runtime-payload.json',
        'interior/luz/audit-moldings.json', 'interior/luz/audit-authoring.json',
        'interior/luz/audit-scene.json',
        'interior/luz/geometry-compact.json', 'interior/luz/geometry-compact.json.gz',
        texture_path.relative_to(ROOT).as_posix(),
        'interior/luz/interior-source.blend', 'interior/luz/interior-source.glb',
        'interior/luz/interior-baked.blend', 'revisao-interior.json',
        'qa/interior-runtime.json', 'qa/interior-capturas.json', 'qa/final-smoke.json',
    ]
    delivery += list(captures['capturasSHA256'])
    tracked = delivery + ['maquete-liv-ipanema.html', 'interior/projeto-planta.json',
                          'interior/previa/unidade.json', 'interior/previa/relatorio.json']
    report = {
        'status': 'PASS', 'unidadeSHA256': unit_hash, 'cenaSHA256': manifest['sourceSHA256'],
        'textureSHA256': texture_hash, 'capturasSHA256': captures['capturasSHA256'],
        'artefatosSHA256': {rel: sha(ROOT / rel) for rel in tracked},
        'arquivosEntrega': delivery,
        'revisaoVisual': visual['observacoes'],
    }
    (ROOT / 'validacao-interior.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), 'utf8')
    print('INTERIOR_DELIVERY_VERIFIED', unit_hash, texture_hash)

if __name__ == '__main__':
    main()

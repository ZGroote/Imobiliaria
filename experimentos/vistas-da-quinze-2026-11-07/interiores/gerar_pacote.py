"""Pacote dos interiores do site (cópia do LIV): catálogo liv-interior-catalog-v1, modo native-factories.

O LIV monta o Meio por fábricas nativas a partir do unidade.json, com materiais/móveis compartilhados e
luz dinâmica (gerar_pacote_interiores.py, --iluminacao-meio dynamic). Aqui as seis plantas do Vistas da
Quinze seguem esse caminho; os recursos compartilhados são copiados do LIV sem alteração. Quando interiores/luz/<planta>/
tem a fonte congelada e o UV1, a planta vira frozen-source com luz gravada por hora (lighting time-rgbm).
python experimentos/vistas-da-quinze-2026-11-07/interiores/gerar_pacote.py
"""
import gzip
import hashlib
import json
import shutil
from pathlib import Path

AQUI = Path(__file__).resolve().parent
SITE = AQUI.parent/'site'
LIV = AQUI.parents[1]/'liv-experimental-2026-10-14'/'interiores'
LUZ = AQUI/'luz'  # fonte congelada + UV1 da luz por hora (luz/exportar_fonte.py, preparar_luz.py)
ROTULO = {'T01': 'T01 · 2 dormitórios', 'T02': 'T02 · 1 dormitório', 'T03': 'T03 · 2 dormitórios com terraço',
          'T04': 'T04 · 2 dormitórios e escritório com terraço', 'T05': 'T05 · 2 dormitórios com terraço',
          'T06': 'T06 · 2 dormitórios com terraço frontal'}
AREA = {'T01': 44.79, 'T02': 31.53, 'T03': 62.29, 'T04': 77.65, 'T05': 62.43, 'T06': 71.1}


def sha(b):
    return hashlib.sha256(b).hexdigest()


def encoded(value):
    return (json.dumps(value, ensure_ascii=False, separators=(',', ':'))+'\n').encode()


def packed(path, rel, raw):
    data = gzip.compress(raw, compresslevel=9, mtime=0)
    path.write_bytes(data)
    return {'path': rel, 'bytes': len(data), 'sha256': sha(data), 'compression': 'gzip',
            'decodedBytes': len(raw), 'decodedSHA256': sha(raw)}


def main():
    destino = SITE/'interiores'
    # luz-horario/ (empacotar_horario.py) fica: só o compartilhado e os arquivos da planta são refeitos.
    shutil.rmtree(destino/'shared', ignore_errors=True)
    shutil.copytree(LIV/'shared', destino/'shared')
    liv = json.loads((LIV/'catalogo.json').read_text(encoding='utf-8'))
    shared = liv['shared']
    for chave, rec in shared.items():
        if sha((LIV.parent/rec['path']).read_bytes()) != rec['sha256']:
            raise SystemExit(f'Recurso compartilhado do LIV mudou: {chave}')
    catalogo = {'schema': 'liv-interior-catalog-v1', 'shared': shared, 'tipologias': {}}
    for TIP in ROTULO:
        tip = TIP.lower()
        unit_bytes = (AQUI/TIP/'unidade.json').read_bytes()
        unit = json.loads(unit_bytes)
        recipe = {'schema': 'liv-interior-native-recipe-v1', 'unitId': unit['id'], 'unitSHA256': sha(unit_bytes),
                  'runtimeSHA256': shared['runtime']['sha256'], 'materialsSHA256': shared['materials']['sha256'],
                  'furnitureSHA256': shared['furniture']['sha256'],
                  'factories': ['FloorPlan', 'HouseMesh', 'Openings', 'FurnitureParam', 'FurnitureCatalog'],
                  'lighting': 'dynamic', 'cornerFloorPartition': False, 'cornerCountertopCustomization': False}
        recipe_bytes = encoded(recipe)
        pasta = destino/tip
        pasta.mkdir(parents=True, exist_ok=True)
        (pasta/'unidade.json').write_bytes(unit_bytes)
        (pasta/'recipe.json').write_bytes(recipe_bytes)
        catalogo['tipologias'][tip] = {
            'id': tip, 'label': ROTULO[TIP], 'area': AREA[TIP], 'unitId': unit['id'],
            'unitSHA256': sha(unit_bytes), 'sourceSHA256': sha(recipe_bytes),
            'geometryKind': 'native-factories', 'lighting': 'dynamic',
            'files': {'unit': {'path': f'interiores/{tip}/unidade.json', 'bytes': len(unit_bytes), 'sha256': sha(unit_bytes)},
                      'recipe': {'path': f'interiores/{tip}/recipe.json', 'bytes': len(recipe_bytes), 'sha256': sha(recipe_bytes)}}}
        # Com a fonte congelada pronta, a planta passa a ler a luz gravada por hora (como o Canto e o Meio do LIV).
        fonte, uv1 = LUZ/tip/'source.json', LUZ/tip/'bake/geometry-compact.json'
        if fonte.is_file() and uv1.is_file():
            source_bytes, compact_bytes = fonte.read_bytes(), uv1.read_bytes()
            source, compact = json.loads(source_bytes), json.loads(compact_bytes)
            if source['unitSHA256'] != sha(unit_bytes) or compact['sourceSHA256'] != sha(source_bytes):
                raise SystemExit(f'{tip}: fonte congelada ou UV1 de outra revisão; rode luz/exportar_fonte.py e o preparar_luz.py')
            record = catalogo['tipologias'][tip]
            record.update(geometryKind='frozen-source', lighting='time-rgbm', materialsOrigin='source',
                          nativeRecipeSHA256=sha(recipe_bytes), sourceSHA256=sha(source_bytes),
                          furnitureSlots=source['metadata']['furnitureSlots'])
            record['files']['source'] = packed(pasta/'source.json.gz', f'interiores/{tip}/source.json.gz', source_bytes)
            record['files']['compact'] = packed(pasta/'geometry-compact.json.gz', f'interiores/{tip}/geometry-compact.json.gz', compact_bytes)
    (destino/'catalogo.json').write_text(json.dumps(catalogo, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    print({t: (v['unitSHA256'][:12], v['geometryKind']) for t, v in catalogo['tipologias'].items()})


if __name__ == '__main__':
    main()

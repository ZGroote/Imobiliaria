"""Pacote dos interiores do site (cópia do LIV): catálogo liv-interior-catalog-v1, modo native-factories.

O LIV monta o Meio por fábricas nativas a partir do unidade.json, com materiais/móveis compartilhados e
luz dinâmica (gerar_pacote_interiores.py, --iluminacao-meio dynamic). Aqui as duas plantas do Laranjeiras
seguem esse caminho; os recursos compartilhados são copiados do LIV sem alteração.
python experimentos/laranjeiras-2026-10-30/interiores/gerar_pacote.py
"""
import hashlib
import json
import shutil
from pathlib import Path

AQUI = Path(__file__).resolve().parent
SITE = AQUI.parent/'site'
LIV = AQUI.parents[1]/'liv-experimental-2026-10-14'/'interiores'
ROTULO = {'canto': 'Apartamento de canto', 'meio': 'Apartamento de meio'}
AREA = {'canto': 39.12, 'meio': 40.79}


def sha(b):
    return hashlib.sha256(b).hexdigest()


def encoded(value):
    return (json.dumps(value, ensure_ascii=False, separators=(',', ':'))+'\n').encode()


def main():
    destino = SITE/'interiores'
    if destino.exists():
        shutil.rmtree(destino)
    shutil.copytree(LIV/'shared', destino/'shared')
    liv = json.loads((LIV/'catalogo.json').read_text(encoding='utf-8'))
    shared = liv['shared']
    for chave, rec in shared.items():
        if sha((LIV.parent/rec['path']).read_bytes()) != rec['sha256']:
            raise SystemExit(f'Recurso compartilhado do LIV mudou: {chave}')
    catalogo = {'schema': 'liv-interior-catalog-v1', 'shared': shared, 'tipologias': {}}
    for tip in ('canto', 'meio'):
        unit_bytes = (AQUI/tip/'unidade.json').read_bytes()
        unit = json.loads(unit_bytes)
        recipe = {'schema': 'liv-interior-native-recipe-v1', 'unitId': unit['id'], 'unitSHA256': sha(unit_bytes),
                  'runtimeSHA256': shared['runtime']['sha256'], 'materialsSHA256': shared['materials']['sha256'],
                  'furnitureSHA256': shared['furniture']['sha256'],
                  'factories': ['FloorPlan', 'HouseMesh', 'Openings', 'FurnitureParam', 'FurnitureCatalog'],
                  'lighting': 'dynamic', 'cornerFloorPartition': False, 'cornerCountertopCustomization': False}
        recipe_bytes = encoded(recipe)
        pasta = destino/tip
        pasta.mkdir(parents=True)
        (pasta/'unidade.json').write_bytes(unit_bytes)
        (pasta/'recipe.json').write_bytes(recipe_bytes)
        catalogo['tipologias'][tip] = {
            'id': tip, 'label': ROTULO[tip], 'area': AREA[tip], 'unitId': unit['id'],
            'unitSHA256': sha(unit_bytes), 'sourceSHA256': sha(recipe_bytes),
            'geometryKind': 'native-factories', 'lighting': 'dynamic',
            'files': {'unit': {'path': f'interiores/{tip}/unidade.json', 'bytes': len(unit_bytes), 'sha256': sha(unit_bytes)},
                      'recipe': {'path': f'interiores/{tip}/recipe.json', 'bytes': len(recipe_bytes), 'sha256': sha(recipe_bytes)}}}
    (destino/'catalogo.json').write_text(json.dumps(catalogo, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    print({t: v['unitSHA256'][:12] for t, v in catalogo['tipologias'].items()})


if __name__ == '__main__':
    main()

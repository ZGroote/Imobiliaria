"""Reusa o transporte RGBM, acrescentando somente os quatro PBR da entrada.

Adaptações verificadas ocorrem na memória do processo. A receita qualificada da
torre e seu pacote ativo não são regravados. Não cria shaders de acabamento.
"""
import hashlib
import json
from pathlib import Path
import sys

HERE=Path(__file__).resolve().parent;OWN=HERE.parent;ROOT=OWN.parents[2]
AUTHOR=OWN/'exportar_variante.py'


def replace_once(source,old,new):
    if source.count(old)!=1:raise ValueError('A receita de transporte mudou; revisar a adaptação da entrada.')
    return source.replace(old,new)


def main():
    source=AUTHOR.read_text(encoding='utf-8')
    source=replace_once(source,"if not args.saida.resolve().is_relative_to(OWN/'variante'):",
                       "if not args.saida.resolve().is_relative_to(OWN/'entrada/candidato'):")
    old="""        assert len(matches)==1,(name,baked,len(matches))
        spec=deepcopy(matches[0]);spec['name']=name;spec['baked']=baked"""
    new="""        if not matches and name in {'MAT-entrada-carbono','MAT-entrada-reboco','MAT-entrada-metal','MAT-entrada-vidro'}:
            spec={'type':'MeshStandardMaterial','name':name,'baked':baked,
                  'color':source['color'],'roughness':source['roughness'],'metalness':source['metalness'],
                  'emissive':source['emissive'],'emissiveIntensity':source['emissiveIntensity'],
                  'envMapIntensity':.35,'vertexColors':baked}
        else:
            assert len(matches)==1,(name,baked,len(matches))
            spec=deepcopy(matches[0]);spec['name']=name;spec['baked']=baked"""
    source=replace_once(source,old,new)
    source=replace_once(source,"""                 'Blender / SITE-implantacao-site-vidro / torre -1':.16,
                 'Blender / LIV-IPANEMA-tipografia / torre -1':.65}""",
                       "                 'Blender / SITE-implantacao-site-vidro / torre -1':.16}")
    scope={'__file__':str(AUTHOR),'__name__':'liv_entry_export_template'}
    exec(compile(source,str(AUTHOR),'exec'),scope)
    sys.argv=[str(Path(__file__)),'--modelo',str(HERE/'candidato/modelo.json'),
              '--luz',str(HERE/'candidato/luz'),'--saida',str(HERE/'candidato/assets')]
    scope['main']()
    path=HERE/'candidato/assets/manifest.json';manifest=json.loads(path.read_bytes())
    manifest['sources'][Path(__file__).resolve().relative_to(ROOT).as_posix()]=hashlib.sha256(Path(__file__).read_bytes()).hexdigest()
    manifest['exportPurpose']='Estudo inferido da entrada: quatro materiais padrão, UV/bake próprios; ainda sem integração no piloto comercial.'
    manifest['entryMaterialPolicy']='Principled BSDF → MeshStandardMaterial; RGBM existente somente no transporte de luz.'
    path.write_text(json.dumps(manifest,indent=2),encoding='utf-8')


if __name__=='__main__':main()

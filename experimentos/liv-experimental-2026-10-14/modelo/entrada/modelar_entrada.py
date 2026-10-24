"""Gera uma revisão isolada da entrada usando a torre corrigida como fonte.

Execute via Blender. As adaptações são locais ao processo, sem regravar os
geradores da torre ou implantação. O modelo ativo não é substituído.
"""
import hashlib
import json
import math
from pathlib import Path
import runpy
import sys

import bpy

HERE=Path(__file__).resolve().parent;OWN=HERE.parent;ROOT=OWN.parents[2]
CANON=ROOT/'v1.5/miniaturas/liv-ipanema';AUTHOR=OWN/'modelar_exterior.py'
sys.path[:0]=[str(HERE),str(OWN),str(CANON),str(CANON.parent)]
import blender_maquete_base as base
import modelar_implantacao as site
from entrada_site import build_entry,STATS
import vagas_oficiais as vagas

baseline=OWN/'variante/modelo.json'
source=json.loads(baseline.read_bytes())
for path,value in source['metadata']['recipeSources'].items():
    if hashlib.sha256((ROOT/path).read_bytes()).hexdigest()!=value:raise ValueError('Receita base desatualizada: '+path)
reference=CANON/'referencias/portaria.jpg'
adaptations={'removedEntryBoxes':0,'removedEntryRods':0,'removedOldSignBoxes':0,'palmMoves':[],'fenceMoves':[]}
original_entry=site._entry_and_quiosques;original_pxbox=site.pxbox;original_rod=site.rod


def pxbox(mat,u,v,*args,**kwargs):
    if u>550 and 600<=v<=675:adaptations['removedEntryBoxes']+=1;return
    return original_pxbox(mat,u,v,*args,**kwargs)


def rod(mat,a,b,*args,**kwargs):
    u=a[1]/site.SCALE+315;v=432-a[0]/site.SCALE
    if u>550 and 600<=v<=675:adaptations['removedEntryRods']+=1;return
    return original_rod(mat,a,b,*args,**kwargs)


def entry_and_quiosques():
    site.pxbox=pxbox;site.rod=rod
    try:original_entry()
    finally:site.pxbox=original_pxbox;site.rod=original_rod
    build_entry()


original_palm=site.palm
def palm(u,v,*args,**kwargs):
    if (u,v)==(618,593):
        adaptations['palmMoves'].append({'fromUV':[u,v],'toUV':[612,575],'reason':'fora da nova marquise'})
        u,v=612,575
    return original_palm(u,v,*args,**kwargs)


original_box=base.box
def box(mat,*args,**kwargs):
    old=(-31.7,.68,43.4,3.1,1.02,.22)
    if mat=='reboco' and len(args)>=6 and all(math.isclose(a,b,abs_tol=1e-8) for a,b in zip(args[:6],old)):
        adaptations['removedOldSignBoxes']+=1;return
    return original_box(mat,*args,**kwargs)


original_fence=site.fence
def fence(points,*args,**kwargs):
    replacement=None
    if points==[(651,668),(656,684)]:replacement=[(655.5,681),(656,684)]
    elif points==[(508,80),(560,132),(633,565)]:replacement=[(508,80),(560,132),(636.2,584)]
    if replacement:
        adaptations['fenceMoves'].append({'fromUV':points,'toUV':replacement,'reason':'conectar às laterais da entrada sem bloquear a pista'})
        points=replacement
    return original_fence(points,*args,**kwargs)


original_export=base.exportar
def export(out,slug,metadata):
    old=bpy.data.objects.get('GEO-placa-LIV-IPANEMA')
    if old is None:raise ValueError('Não encontrou o letreiro antigo esperado.')
    bpy.data.objects.remove(old,do_unlink=True)
    if (adaptations['removedEntryBoxes'],adaptations['removedEntryRods'],adaptations['removedOldSignBoxes'])!=(29,28,1):
        raise ValueError('A implantação de origem mudou: '+json.dumps(adaptations))
    if len(adaptations['palmMoves'])!=1 or len(adaptations['fenceMoves'])!=2:raise ValueError('Paisagismo/fechamento de origem mudaram.')
    metadata['entryStudy']={**STATS,'adaptations':adaptations,'baselineModelSHA256':hashlib.sha256(baseline.read_bytes()).hexdigest(),
      'reference':{'path':reference.relative_to(ROOT).as_posix(),'sha256':hashlib.sha256(reference.read_bytes()).hexdigest()},
      'status':'inferido; sem projeto executivo; sem qualificação do bake desta entrada'}
    planta=ROOT/'relatorios/liv-referencias-publicas-2026-10-09/implantacao-finais-e-vagas.png'
    fonte={'path':planta.relative_to(ROOT).as_posix(),'sha256':hashlib.sha256(planta.read_bytes()).hexdigest()}
    metadata['parkingStudy']={'spaces':len(vagas.vagas()),'numbering':fonte,'file':'vagas.json',
      'status':'centros medidos na implantação oficial; dimensões inferidas'}
    vagas.gravar_json(HERE/'candidato/vagas.json',fonte)
    for path in [Path(__file__).resolve(),HERE/'entrada_site.py',HERE/'vagas_oficiais.py']:
        metadata['recipeSources'][path.relative_to(ROOT).as_posix()]=hashlib.sha256(path.read_bytes()).hexdigest()
    return original_export(out,slug,metadata)


site._entry_and_quiosques=entry_and_quiosques;site.palm=palm;site.fence=fence;base.box=box;base.exportar=export
site._parking=lambda rng:vagas.construir(site,rng)
sys.argv=[str(AUTHOR),'--','--saida',str(HERE/'candidato'),'--no-render']
runpy.run_path(str(AUTHOR),run_name='__main__')

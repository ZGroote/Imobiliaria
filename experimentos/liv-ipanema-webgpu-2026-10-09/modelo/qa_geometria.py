"""Valida a malha exportada contra a anotação manual da imagem, não cotas executivas."""
import argparse
from collections import Counter
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from scipy.ndimage import binary_erosion, distance_transform_edt
from contorno import Outline, signed_area, validate_outline

OWN=Path(__file__).resolve().parent
ROOT=OWN.parents[2]
CANON=ROOT/'v1.5/miniaturas/liv-ipanema'


def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()


def slab(model):
    groups=[g for g in model['groups'] if g['tower']==0 and g['role']=='lajes']
    assert len(groups)==1
    return groups[0],model['geometries'][groups[0]['geometry']]


def projected_mask(geo,outline,bounds,scale):
    pos=np.array(geo['position']).reshape(-1,3)
    tris=pos[np.array(geo['index']).reshape(-1,3)]
    top=tris[np.all(np.isclose(tris[:,:,1],.17,atol=1e-5),axis=1)]
    assert len(top)>0
    mask=Image.new('1',((bounds[2]-bounds[0])*scale,(bounds[3]-bounds[1])*scale))
    draw=ImageDraw.Draw(mask)
    for tri in top:
        pixels=[outline.to_image(p[0],p[2]) for p in tri]
        draw.polygon([((u-bounds[0])*scale,(v-bounds[1])*scale) for u,v in pixels],fill=1)
    return np.array(mask),len(top)


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--model',type=Path,default=OWN/'variante/modelo.json')
    parser.add_argument('--saida',type=Path,default=OWN.parent/'evidencias/contorno-estudo')
    args=parser.parse_args();args.saida.mkdir(parents=True,exist_ok=True)
    outline=Outline(OWN/'contorno-torre.json',ROOT)
    model=json.loads(args.model.read_text('utf-8'))
    baseline_path=CANON/'modelo.json';baseline=json.loads(baseline_path.read_text('utf-8'))
    assert sha(baseline_path)=='89f552ec2c030afdcd1ab2167df78e6ff530bf40dd3e7c598d356b5582ebd919'
    assert model['metadata']['outlineSHA256']==sha(outline.path)
    assert all(sha(ROOT/p)==value for p,value in model['metadata']['recipeSources'].items())
    # O registro inverso deve manter inclusive os pontos que ultrapassam o corpo.
    assert all(np.allclose(outline.to_image(*outline.to_model(*p)),p,atol=1e-9) for p in outline.pixels)
    assert outline.face(5,1)<outline.face(10,1)-.8
    assert outline.end(0,1)<outline.end(4.35,1)-.8
    invalid=[[0,0],[3,0],[3,3],[1,3],[1,-1],[2,-1],[2,2],[0,2]]
    try:validate_outline(invalid)
    except ValueError:pass
    else:raise AssertionError('O contorno auto-intersectado foi aceito')

    group,geo=slab(model);oldgroup,oldgeo=slab(baseline)
    assert sorted(i['floor'] for i in group['instances'])==list(range(18))
    walls=[g for g in model['groups'] if g['tower']==0 and g['role']=='paredes']
    assert len(walls)==1 and sorted(i['floor'] for i in walls[0]['instances'])==list(range(17))
    pos=np.array(geo['position']).reshape(-1,3)
    indices=np.array(geo['index']).reshape(-1,3);triangles=pos[indices]
    assert np.isfinite(pos).all() and indices.min()>=0 and indices.max()<len(pos)
    crosses=np.cross(triangles[:,1]-triangles[:,0],triangles[:,2]-triangles[:,0])
    assert (np.linalg.norm(crosses,axis=1)>1e-8).all()
    edges=Counter()
    for tri in triangles:
        keys=[tuple(np.round(p,5)) for p in tri]
        for a,b in zip(keys,keys[1:]+keys[:1]):edges[tuple(sorted([a,b]))]+=1
    assert all(count==2 for count in edges.values()),'Laje aberta ou não manifold'
    volume=float(np.einsum('ij,ij->i',triangles[:,0],np.cross(triangles[:,1],triangles[:,2])).sum()/6)
    expected_volume=signed_area(outline.points)*.17
    assert abs(volume-expected_volume)<.003 and volume>0
    normals=np.array(geo['normal']).reshape(-1,3)
    assert np.allclose(np.linalg.norm(normals,axis=1),1,atol=1e-4)
    assert np.all(np.einsum('ij,ij->i',crosses,normals[indices].mean(axis=1))>0)

    # Geometria de implantação/térreo deve permanecer idêntica, por grupo semântico.
    untouched=[g for g in baseline['groups'] if g['tower']==-1 or g['role']=='terreo']
    current={(g['geometry'],g['tower']):g for g in model['groups']}
    for g in untouched:
        assert current[(g['geometry'],g['tower'])]==g,g['geometry']
        assert model['geometries'][g['geometry']]==baseline['geometries'][g['geometry']],g['geometry']
    assert model['materials']==baseline['materials']

    bounds=(265,260,366,606);scale=4
    target=Image.new('1',((bounds[2]-bounds[0])*scale,(bounds[3]-bounds[1])*scale))
    ImageDraw.Draw(target).polygon([((u-bounds[0])*scale,(v-bounds[1])*scale) for u,v in outline.pixels],fill=1)
    target=np.array(target)
    candidate,top_count=projected_mask(geo,outline,bounds,scale)
    old,old_top_count=projected_mask(oldgeo,outline,bounds,scale)
    iou=lambda a:float(np.logical_and(a,target).sum()/np.logical_or(a,target).sum())
    new_iou,old_iou=iou(candidate),iou(old)
    assert new_iou>=outline.spec['validation']['roofMaskIoUMin'] and new_iou>old_iou+.01
    target_boundary=target^binary_erosion(target);new_boundary=candidate^binary_erosion(candidate)
    distance=float(max(distance_transform_edt(~target_boundary)[new_boundary].max(),
                       distance_transform_edt(~new_boundary)[target_boundary].max())/scale)
    assert distance<=outline.spec['validation']['boundaryTolerancePixels']

    source=Image.open(ROOT/outline.spec['source']['path']).convert('RGB').crop(bounds).resize(target.shape[::-1])
    overlay=np.array(source)
    overlay[old^binary_erosion(old)]=[244,90,85]
    overlay[target_boundary]=[25,235,145]
    Image.fromarray(overlay).save(args.saida/'contorno-sobre-fonte.png')
    comparison=Image.new('RGB',(target.shape[1]*3,target.shape[0]),'#20272b')
    for i,mask in enumerate([target,old,candidate]):
        tile=np.zeros((*mask.shape,3),np.uint8);tile[mask]=[230,236,237]
        comparison.paste(Image.fromarray(tile),(i*target.shape[1],0))
    comparison.save(args.saida/'mascaras-fonte-base-variante.png')
    report={'schema':'liv-outline-geometry-qa-v1','atUtc':datetime.now(timezone.utc).isoformat(),
            'result':'PASS','sourceSHA256':sha(args.model),'baselineSHA256':sha(baseline_path),
            'outlineSHA256':sha(outline.path),'annotationConfidence':'inferido, ±2 pixels',
            'measurementScope':'Projeção dos triângulos exportados contra anotação manual; não comprova dimensões reais nem repetição vertical.',
            'mask':{'baselineIoU':old_iou,'candidateIoU':new_iou,'boundaryMaxPixels':distance,
                    'candidateTopTriangles':top_count,'baselineTopTriangles':old_top_count,'sampleScale':scale},
            'mesh':{'closedEdges':len(edges),'triangles':len(indices),'volume':volume,'expectedVolume':expected_volume,
                    'structuralFloors':17,'slabs':18,'unchangedGroundSiteGroups':len(untouched)},
            'windowShifts':model['metadata']['windowShifts'],
            'sources':{p.relative_to(ROOT).as_posix():sha(p) for p in [Path(__file__).resolve(),OWN/'contorno.py',
                       OWN/'modelar_exterior.py',outline.path,ROOT/outline.spec['source']['path'],args.model,baseline_path]}}
    (args.saida/'geometria.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    print(json.dumps({k:report[k] for k in ['result','sourceSHA256','mask','mesh']}))


if __name__=='__main__':main()

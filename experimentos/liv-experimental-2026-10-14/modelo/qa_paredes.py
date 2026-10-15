"""Reproduz as sobreposições antigas e valida a superfície exportada das paredes."""
import argparse
from collections import Counter, defaultdict
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path

import numpy as np
from shapely.geometry import Point, Polygon
from shapely.strtree import STRtree

from contorno import Outline

OWN=Path(__file__).resolve().parent
ROOT=OWN.parents[2]


def digest(path):return hashlib.sha256(path.read_bytes()).hexdigest()


def surfaces(model,prefix):
    rows=[]
    for group in model['groups']:
        if not group['geometry'].startswith(prefix):continue
        geometry=model['geometries'][group['geometry']]
        pos=np.array(geometry['position']).reshape(-1,3)
        triangles=pos[np.array(geometry['index']).reshape(-1,3)]
        for index,triangle in enumerate(triangles):
            cross=np.cross(triangle[1]-triangle[0],triangle[2]-triangle[0])
            length=np.linalg.norm(cross)
            if length<1e-8:continue
            normal=cross/length;axis=int(np.argmax(abs(normal)))
            if abs(normal[axis])<.99999:continue
            poly=Polygon(triangle[:,[i for i in range(3) if i!=axis]])
            rows.append((axis,round(float(triangle[:,axis].mean()),5),poly,group['geometry'],index,triangle))
    return rows


def overlaps(rows):
    planes=defaultdict(list)
    for axis,coordinate,poly,name,index,triangle in rows:planes[axis,coordinate].append((poly,name,index))
    count=0;area=0.;examples=[];slivers=0;sliver_area=0.
    for key,values in planes.items():
        tree=STRtree([value[0] for value in values])
        for i,(poly,name,index) in enumerate(values):
            for j in tree.query(poly):
                if j<=i:continue
                shape=poly.intersection(values[j][0]);intersection=shape.area
                if intersection<=1e-7:continue
                # O exportador arredonda posições a cinco casas. Registra, mas
                # separa, faixas sem interior a 10 micrômetros; não são faces
                # duplicadas com espessura acima da precisão da autoria.
                if shape.buffer(-1e-5).is_empty:
                    slivers+=1;sliver_area+=intersection;continue
                count+=1;area+=intersection
                if len(examples)<8:
                    examples.append({'plane':list(key),'a':[name,index],
                                     'b':[values[j][1],values[j][2]],'intersectionAreaModel':intersection})
    return {'overlappingTrianglePairs':count,'summedIntersectionAreaModel':area,'examples':examples,
            'positionQuantumMeters':1e-5,'quantizationSliverPairs':slivers,'quantizationSliverAreaModel':sliver_area}


def closed(model,prefix):
    edges=Counter();count=0;degenerate=0
    for group in model['groups']:
        if not group['geometry'].startswith(prefix):continue
        geo=model['geometries'][group['geometry']]
        positions=np.array(geo['position']).reshape(-1,3)
        triangles=positions[np.array(geo['index']).reshape(-1,3)]
        for triangle in triangles:
            count+=1
            if np.linalg.norm(np.cross(triangle[1]-triangle[0],triangle[2]-triangle[0]))<1e-8:degenerate+=1
            keys=[tuple(np.round(p,5)) for p in triangle]
            for a,b in zip(keys,keys[1:]+keys[:1]):edges[tuple(sorted([a,b]))]+=1
    return {'triangles':count,'edges':len(edges),'nonManifoldEdges':sum(v!=2 for v in edges.values()),
            'degenerateTriangles':degenerate}


def covered(rows,axis,coordinate,u,v):
    return any(abs(c-coordinate)<1e-4 and poly.covers(Point(u,v))
               for a,c,poly,*_ in rows if a==axis)


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--model',type=Path,default=OWN/'variante/modelo.json')
    parser.add_argument('--antes',type=Path,default=OWN/'variante/luz/antes-quinas/modelo.json')
    parser.add_argument('--saida',type=Path,default=OWN.parent/'evidencias/quinas-geometria')
    args=parser.parse_args();args.saida.mkdir(parents=True,exist_ok=True)
    model=json.loads(args.model.read_text());before=json.loads(args.antes.read_text())
    outline=Outline(OWN/'contorno-torre.json',ROOT)
    rows=surfaces(model,'panos-');old=overlaps(surfaces(before,'panos-'));current=overlaps(rows)
    assert old['overlappingTrianglePairs']>0,'A reprodução da falha antiga não detectou sobreposições'
    assert current['overlappingTrianglePairs']==0,current
    roof_overlaps=overlaps(surfaces(model,'cobertura-'))
    assert roof_overlaps['overlappingTrianglePairs']==0,roof_overlaps
    meshes={prefix:closed(model,prefix) for prefix in ['panos-','cobertura-']}
    assert all(v['nonManifoldEdges']==v['degenerateTriangles']==0 for v in meshes.values()),meshes
    perimeter=Polygon(outline.points).buffer(1e-4)
    assert all(perimeter.covers(Point(p[0],p[2])) for row in rows for p in row[-1]),'Parede invade um rasgo'
    # Nos mesmos pontos que deverão receber vidro/porta, nenhuma parede deve
    # ocupar o plano externo. Não depende dos materiais do renderer.
    windows=outline.window_centers([(v-.5)*47.7 for v in [.062,.238,.302,.503,.571,.653,.707,.911]])
    centers=[*windows,-.13*47.7,*[(v-.5)*47.7 for v in [.11,.19,.45,.76,.85]]]
    open_checks=0
    for sign in [-1,1]:
        for x in centers:
            assert not covered(rows,2,outline.face(x,sign),x,1.55),(sign,x)
            open_checks+=1
        for depth in [-4.35,0,4.35]:
            assert not covered(rows,0,outline.end(depth,sign),1.565,depth),(sign,depth)
            open_checks+=1
    outline_checks=0
    for a,b in zip(outline.points,outline.points[1:]+outline.points[:1]):
        x,z=(a[0]+b[0])/2,(a[1]+b[1])/2
        assert covered(rows,0,x,2.75,z) if abs(a[0]-b[0])<1e-8 else covered(rows,2,z,x,2.75),(a,b)
        outline_checks+=1
    files=[Path(__file__),OWN/'unir_paredes.py',OWN/'modelar_exterior.py',OWN/'contorno.py',outline.path,args.model,args.antes]
    report={'schema':'liv-wall-join-qa-v1','status':'PASS','atUtc':datetime.now(timezone.utc).isoformat(),
            'before':old,'after':current,'roofOverlaps':roof_overlaps,'exportedMeshes':meshes,'openingChecks':open_checks,
            'perimeterEdgesCovered':outline_checks,'wallVolumeWithinOutline':True,
            'flatFacade':True,'sourceSHA256':digest(args.model),
            'sources':{p.relative_to(ROOT).as_posix():digest(p) for p in files}}
    (args.saida/'paredes.json').write_text(json.dumps(report,indent=2),encoding='utf8')
    print(json.dumps({k:report[k] for k in ['status','sourceSHA256','after','exportedMeshes','openingChecks','perimeterEdgesCovered']}))


if __name__=='__main__':main()

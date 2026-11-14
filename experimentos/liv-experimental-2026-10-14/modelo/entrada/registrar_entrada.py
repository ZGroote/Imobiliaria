"""Confere a entrada exportada e registra a comparação PBR com identidade."""
from collections import Counter
import gzip
import hashlib
import json
from pathlib import Path
from collections import defaultdict

import numpy as np
from shapely.geometry import Point,Polygon
from shapely.strtree import STRtree

HERE=Path(__file__).resolve().parent;OWN=HERE.parent;EXP=OWN.parent;ROOT=OWN.parents[2]


def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()


def triangles(model,prefix):
    output=[]
    for group in model['groups']:
        if not group['geometry'].startswith(prefix):continue
        geo=model['geometries'][group['geometry']];positions=np.array(geo['position']).reshape(-1,3)
        points=np.column_stack((positions,np.ones(len(positions))))
        for instance in group['instances']:
            world=(points@np.array(instance['matrix']).reshape(4,4))[:,:3]
            output.extend(world[np.array(geo['index']).reshape(-1,3)])
    return np.array(output)


def closed(rows):
    edges=Counter();zero=0
    for row in rows:
        if np.linalg.norm(np.cross(row[1]-row[0],row[2]-row[0]))<=1e-10:zero+=1
        points=[tuple(v) for v in row]
        for a,b in zip(points,points[1:]+points[:1]):edges[tuple(sorted((a,b)))]+=1
    bad=sum(value!=2 for value in edges.values())
    volume=float(np.einsum('ij,ij->i',rows[:,0],np.cross(rows[:,1],rows[:,2])).sum()/6)
    return {'triangles':len(rows),'nonManifoldEdges':bad,'degenerateTriangles':zero,'signedVolume':volume}


def local(rows,entry):
    result=rows.copy();delta=rows[:,:,[0,2]]-entry['originXZ']
    result[:,:,0]=delta@entry['streetTangent'];result[:,:,1]=delta@entry['inward'];result[:,:,2]=rows[:,:,1]
    return result


def blocked(rows,s,h,start,end):
    point=Point(s,h)
    for row in rows:
        if np.ptp(row[:,1])>2e-5 or not start-2e-5<=row[:,1].mean()<=end+2e-5:continue
        shape=Polygon(row[:,[0,2]])
        if shape.area>1e-8 and shape.covers(point):return True
    return False


def overlaps(rows):
    planes=defaultdict(list);pairs=0;area=0.0
    for row in rows:
        axes=np.flatnonzero(np.ptp(row,axis=0)<2e-5)
        if len(axes)!=1:continue
        axis=int(axes[0]);shape=Polygon(np.delete(row,axis,axis=1))
        if shape.area>1e-8:planes[(axis,round(float(row[:,axis].mean()),4))].append(shape)
    for shapes in planes.values():
        tree=STRtree(shapes)
        for i,shape in enumerate(shapes):
            for j in tree.query(shape):
                if j<=i:continue
                shared=shape.intersection(shapes[j])
                if shared.area>1e-7 and not shared.buffer(-1e-5).is_empty:pairs+=1;area+=shared.area
    return {'coplanarOverlappingTrianglePairs':pairs,'intersectionArea':area}


def main():
    source=HERE/'candidato/modelo.json';model=json.loads(source.read_bytes());entry=model['metadata']['entryStudy']
    baseline=OWN/'variante/modelo.json';before=json.loads(baseline.read_bytes())
    assert sha(baseline)==entry['baselineModelSHA256']
    for path,value in model['metadata']['recipeSources'].items():assert sha(ROOT/path)==value,path
    assert sha(ROOT/entry['reference']['path'])==entry['reference']['sha256']
    tower=[g for g in before['groups'] if g['tower']==0]
    by_name={g['geometry']:g for g in model['groups'] if g['tower']==0}
    for group in tower:
        assert by_name[group['geometry']]==group,group['geometry']
        assert model['geometries'][group['geometry']]==before['geometries'][group['geometry']]
        assert model['materials'][group['material']]==before['materials'][group['material']]
    structures={}
    for label in entry['unions']:
        rows=triangles(model,'entrada-'+label+'-')
        result={**closed(rows),**overlaps(local(rows,entry))};structures[label]=result
        assert result['triangles']>0 and result['nonManifoldEdges']==0 and result['degenerateTriangles']==0 and result['signedVolume']>0,(label,result)
        assert result['coplanarOverlappingTrianglePairs']==0,(label,result)
    portal=local(triangles(model,'entrada-portal-'),entry)
    portal_points=[(s,h) for s in [-4.05,-2.35,-.65] for h in [.5,1.5,3.9]]
    assert not any(blocked(portal,s,h,0,.41) for s,h in portal_points),'Portal frontal fechado.'
    walls=local(triangles(model,'entrada-guarita-marquise-entrada-reboco'),entry)
    windows=[(s,h) for s in [1.5,2.4,3.8] for h in [1.2,1.8,2.4]]
    assert not any(blocked(walls,s,h,1.80,2.06) for s,h in windows),'Parede atrás da janela.'
    pane=local(triangles(model,'entrada-janela-'),entry)
    assert all(blocked(pane,s,h,1.85,2.0) for s,h in windows),'Janela não cobre o vão.'
    lot=Polygon([(42,80),(508,80),(560,132),(656,684),(45,684)])
    footprint=[]
    for label in ['portal','guarita-marquise','piso','placa']:
        points=triangles(model,'entrada-'+label+'-').reshape(-1,3)
        uv=np.column_stack((points[:,2]/.145+315,432-points[:,0]/.145))
        misses=[p.tolist() for p in uv if not lot.buffer(1e-3).covers(Point(p))]
        assert not misses,(label,misses[:3])
        footprint.append({'label':label,'verticesInsideIllustratedLot':len(uv)})
    lighting=json.loads(gzip.decompress((OWN/'variante/assets/scene.json.gz').read_bytes()))
    files={}
    for edition,path in [('original',OWN/'variante/liv-contorno.glb'),('candidato',HERE/'candidato/liv-contorno.glb')]:
        files[edition]={'path':path.relative_to(HERE).as_posix() if path.is_relative_to(HERE) else '../variante/liv-contorno.glb',
                        'bytes':path.stat().st_size,'sha256':sha(path)}
    report={'status':'PASS','schema':'liv-entry-geometry-qa-v1','sourceModelSHA256':sha(source),
      'baselineModelSHA256':sha(baseline),'reference':entry['reference'],'inferred':True,
      'preservedTowerGroups':len(tower),'preservedTowerInstances':sum(len(g['instances']) for g in tower),
      'structures':structures,'portalOpeningSamples':len(portal_points),'windowOpeningSamples':len(windows),
      'footprint':footprint,'sources':{p.relative_to(ROOT).as_posix():sha(p) for p in [Path(__file__),source,baseline]}}
    output=EXP/'evidencias/entrada-geometria';output.mkdir(parents=True,exist_ok=True)
    (output/'geometria.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    manifest={'schema':'liv-entry-preview-v1','files':files,'lights':lighting['lights'],'exposure':lighting['renderer']['exposure'],
      'sourceModelSHA256':sha(source),'geometryReportSHA256':sha(output/'geometria.json'),
      'sources':{**report['sources'],**model['metadata']['recipeSources'],entry['reference']['path']:entry['reference']['sha256'],
        **{p.relative_to(ROOT).as_posix():sha(p) for p in [OWN/'variante/assets/manifest.json',OWN/'variante/assets/scene.json.gz']}}}
    (HERE/'manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
    print(json.dumps({'status':report['status'],'structures':structures,'towerGroups':len(tower),'files':files}),flush=True)


if __name__=='__main__':main()

"""Transporta a nova autoria e seu atlas para o renderer já qualificado.

Reutiliza apenas materiais/texturas de superfície e câmeras da base fixada.
A irradiância, os vértices, as instâncias e os UV1 vêm exclusivamente da variante.
"""
import argparse
import base64
from copy import deepcopy
from datetime import datetime, timezone
import gzip
import hashlib
import json
from pathlib import Path

import numpy as np

OWN=Path(__file__).resolve().parent
EXP=OWN.parent
ROOT=OWN.parents[2]
BASE=EXP/'assets-prova'
IDENTITY=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]


def sha(data):return hashlib.sha256(data).hexdigest()


def attribute(values,size,dtype='<f4'):
    values=np.ascontiguousarray(values,dtype=dtype).reshape(-1)
    assert np.isfinite(values).all()
    return {'type':'Uint32Array' if dtype=='<u4' else 'Float32Array','length':len(values),
            'itemSize':size,'normalized':False,'base64':base64.b64encode(values.tobytes()).decode('ascii')}


def geometry(attributes,index=None):
    return {'attributes':attributes,'index':index,'groups':[],'drawRange':{'start':0,'count':None}}


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--modelo',type=Path,default=OWN/'variante/modelo.json')
    parser.add_argument('--luz',type=Path,default=OWN/'variante/luz')
    parser.add_argument('--saida',type=Path,default=OWN/'variante/assets')
    args=parser.parse_args()
    if not args.saida.resolve().is_relative_to(OWN/'variante'):
        raise ValueError('A saída deve ficar na pasta isolada da variante')
    model_bytes=args.modelo.read_bytes();model=json.loads(model_bytes);model_hash=sha(model_bytes)
    compact_bytes=(args.luz/'geometry-compact.json').read_bytes();compact=json.loads(compact_bytes)
    rgbm=json.loads((args.luz/'manifest.json').read_text('utf-8'))
    atlas=(args.luz/'irradiance.rgbm.gz').read_bytes()
    assert rgbm['sourceSHA256']==compact['sourceSHA256']==model_hash,'Atlas de outra geometria'
    assert rgbm['geometrySHA256']==sha(compact_bytes)
    assert rgbm['textureSHA256']==sha(gzip.decompress(atlas))
    bake=json.loads((args.luz/'bake.json').read_text('utf-8'))
    assert all(bake['checks'].values()),'Bake não qualificado'
    base_manifest=json.loads((BASE/'manifest.json').read_text('utf-8'))
    base_encoded=gzip.decompress((BASE/'scene.json.gz').read_bytes())
    assert sha(base_encoded)==base_manifest['sceneJSONSHA256']
    baseline=json.loads(base_encoded)
    assert baseline['sourceModelSHA256']=='89f552ec2c030afdcd1ab2167df78e6ff530bf40dd3e7c598d356b5582ebd919'
    assert model_hash!=baseline['sourceModelSHA256'] and rgbm['textureSHA256']!=baseline['rgbm']['textureSHA256']

    materials=[];material_ids={};geometries=[];meshes=[];chunks={}
    lower=np.array([np.inf]*3);upper=-lower
    covered={g['groupIndex']:g for g in compact['groups']}

    def add_material(name,baked):
        key=(name,baked)
        if key in material_ids:return material_ids[key]
        source=model['materials'][name]
        matches=[m for m in baseline['materials'] if m['baked']==baked
                 and np.allclose(m['color'],source['color'],atol=1e-7,rtol=0)
                 and abs(m['roughness']-source['roughness'])<1e-7
                 and abs(m['metalness']-source['metalness'])<1e-7]
        assert len(matches)==1,(name,baked,len(matches))
        spec=deepcopy(matches[0]);spec['name']=name;spec['baked']=baked
        material_ids[key]=len(materials);materials.append(spec)
        return material_ids[key]

    for group_index,group in enumerate(model['groups']):
        source=model['geometries'][group['geometry']]
        positions=np.array(source['position'],dtype=np.float64).reshape(-1,3)
        normals=np.array(source['normal'],dtype=np.float64).reshape(-1,3)
        uv=np.array(source['uv'],dtype=np.float64).reshape(-1,2)
        spec=covered.get(group_index);baked=spec is not None
        material_id=add_material(group['material'],baked)
        indexes=np.array(spec['indices'] if baked else source['index'],dtype=np.uint32)
        matrices=[]
        for instance_index,instance in enumerate(group['instances']):
            matrix=np.array(instance['matrix']).reshape(4,4,order='F')
            points=positions@matrix[:3,:3].T+matrix[:3,3]
            lower=np.minimum(lower,points.min(axis=0));upper=np.maximum(upper,points.max(axis=0))
            matrices.extend(instance['matrix'])
            if not baked:continue
            encoded=spec['instances'][instance_index]
            assert encoded['instanceIndex']==instance_index and encoded['floor']==instance['floor']
            uv1=np.frombuffer(base64.b64decode(encoded['uv1U16']),dtype='<u2').reshape(-1,2)/65535
            assert len(uv1)==len(indexes) and np.isfinite(uv1).all() and (uv1>=0).all() and (uv1<=1).all()
            transformed=normals@np.linalg.inv(matrix[:3,:3])
            transformed/=np.linalg.norm(transformed,axis=1,keepdims=True)
            key=(material_id,group['tower'])
            bucket=chunks.setdefault(key,{'parts':[],'ranges':[],'count':0,'groups':[]})
            bucket['parts'].append({'position':points[indexes],'normal':transformed[indexes],
                                    'uv':uv[indexes],'uv1':uv1,
                                    'color':np.ones((len(indexes),3)),
                                    'livFloorIndex':np.full((len(indexes),1),instance['floor'])})
            bucket['ranges'].append({'groupIndex':group_index,'instanceIndex':instance_index,
                                     'floor':instance['floor'],'start':bucket['count'],'count':len(indexes)})
            bucket['count']+=len(indexes)
            if group_index not in bucket['groups']:bucket['groups'].append(group_index)
        if baked:continue
        geometry_id=len(geometries)
        geometries.append(geometry({'position':attribute(positions,3),'normal':attribute(normals,3),
                                    'uv':attribute(uv,2)},attribute(indexes,1,'<u4')))
        meshes.append({'name':f"Blender / {group['geometry']} / torre {group['tower']}",
                       'geometry':geometry_id,'material':material_id,'matrix':IDENTITY,
                       'castShadow':True,'receiveShadow':True,'renderOrder':0,
                       'userData':{'tower':group['tower'],'livPavimentos':[i['floor'] for i in group['instances']]},
                       'instances':{'count':len(group['instances']),'matrix':attribute(matrices,16),'color':None}})

    for (material_id,tower),bucket in chunks.items():
        attributes={name:attribute(np.concatenate([part[name] for part in bucket['parts']]),size)
                    for name,size in [('position',3),('normal',3),('uv',2),('uv1',2),('color',3),('livFloorIndex',1)]}
        geometry_id=len(geometries);geometries.append(geometry(attributes))
        meshes.append({'name':f"LIV contorno / {materials[material_id]['name']} / torre {tower}",
                       'geometry':geometry_id,'material':material_id,'matrix':IDENTITY,
                       'castShadow':True,'receiveShadow':True,'renderOrder':0,'instances':None,
                       'userData':{'tower':tower,'livBakedTransport':True,'livFloorRanges':bucket['ranges'],
                                   'livGroupIndices':bucket['groups']}})

    # Mesma calibração visual da prévia: clones locais de materiais padrão do Three.
    adjustments={'Blender / esquadrias-varandas-esquadria / torre 0':.55,
                 'Blender / SITE-implantacao-site-vidro / torre -1':.16,
                 'Blender / LIV-IPANEMA-tipografia / torre -1':.65}
    calibration=[]
    for name,roughness in adjustments.items():
        matches=[m for m in meshes if m['name']==name];assert len(matches)==1
        mesh=matches[0];old=materials[mesh['material']];assert not old['baked']
        new=deepcopy(old);new.update(metalness=0,roughness=roughness)
        calibration.append({'mesh':name,'sourceMaterial':mesh['material'],'material':len(materials),
                            'sourceMetalness':old['metalness'],'metalness':0,'roughness':roughness})
        mesh['material']=len(materials);materials.append(new)

    data={k:deepcopy(baseline[k]) for k in ['renderer','lights','camera','views','orbit','textures']}
    rgbm['textureURL']='irradiance.rgbm.gz'
    data.update(schema='liv-exterior-proof-v1',sourceModelSHA256=model_hash,originalRuntime='Blender export / Three r186',
                geometries=geometries,meshes=meshes,materials=materials,rgbm=rgbm,
                bake={'ready':True,'textureHashVerified':True,'geometryHashVerified':True},
                visibleBounds={'min':lower.tolist(),'max':upper.tolist()},
                outline=model['metadata'],materialCalibration=calibration)
    args.saida.mkdir(parents=True,exist_ok=True)
    resources={'irradiance.rgbm.gz':atlas}
    for texture in data['textures']:
        name=texture['url'];content=(BASE/name).read_bytes()
        assert sha(content)==base_manifest['files'][name]['sha256']
        resources[name]=content
    encoded=json.dumps(data,ensure_ascii=True,separators=(',',':')).encode('utf-8')
    resources['scene.json.gz']=gzip.compress(encoded,compresslevel=6,mtime=0)
    for name,content in resources.items():(args.saida/name).write_bytes(content)
    manifest={'schema':'liv-proof-manifest-v1','exportedAtUtc':datetime.now(timezone.utc).isoformat(),
              'sourceModelSHA256':model_hash,'sceneJSONSHA256':sha(encoded),
              'files':{name:{'bytes':len(content),'sha256':sha(content)} for name,content in resources.items()},
              'meshCount':len(meshes),'bakedMeshes':len(chunks),'exportPurpose':'Variante inferida: nova geometria, UV1 e bake próprios; sem cadastro comercial.',
              'sources':{p.relative_to(ROOT).as_posix():sha(p.read_bytes()) for p in [Path(__file__).resolve(),
                         args.modelo,args.luz/'manifest.json',args.luz/'geometry-compact.json',BASE/'manifest.json']}}
    (args.saida/'manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
    print(json.dumps({'result':'PASS','sourceModelSHA256':model_hash,'meshes':len(meshes),'bakedMeshes':len(chunks),
                      'downloadBytes':sum(len(b) for b in resources.values())}))


if __name__=='__main__':main()

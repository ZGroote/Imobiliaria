"""Transporte exato, rasgos navegáveis e descarte da variante nos dois backends."""
import argparse
import base64
from datetime import datetime, timezone
import gzip
import hashlib
import json
from pathlib import Path

import numpy as np
from playwright.sync_api import sync_playwright

OWN=Path(__file__).resolve().parent
EXP=OWN.parent
ROOT=OWN.parents[2]
URL='http://127.0.0.1:8790/experimentos/liv-experimental-2026-10-14/'
CHROME=r'C:\Program Files\Google\Chrome\Application\chrome.exe'
PROFILES={'webgpu':(1440,900,'webgpu'),'webgl':(1440,900,'webgl'),'toque':(390,844,'auto')}


def digest(path):return hashlib.sha256(path.read_bytes()).hexdigest()


def decode(spec):
    kind='<u4' if spec['type']=='Uint32Array' else '<f4'
    values=np.frombuffer(base64.b64decode(spec['base64']),dtype=kind)
    assert len(values)==spec['length'] and np.isfinite(values).all()
    return values.reshape(-1,spec['itemSize'])


def audit_transport():
    directory=OWN/'variante/assets';manifest=json.loads((directory/'manifest.json').read_text('utf-8'))
    for name,record in manifest['files'].items():
        assert (directory/name).stat().st_size==record['bytes'] and digest(directory/name)==record['sha256']
    encoded=gzip.decompress((directory/'scene.json.gz').read_bytes())
    assert hashlib.sha256(encoded).hexdigest()==manifest['sceneJSONSHA256']
    data=json.loads(encoded);source=json.loads((OWN/'variante/modelo.json').read_text('utf-8'))
    compact=json.loads((OWN/'variante/luz/geometry-compact.json').read_text('utf-8'))
    assert data['sourceModelSHA256']==data['rgbm']['sourceSHA256']==compact['sourceSHA256']==digest(OWN/'variante/modelo.json')
    assert data['rgbm']['denoise']['outputGuardPixels']==4
    assert data['rgbm']['textureSHA256']==hashlib.sha256(gzip.decompress((directory/'irradiance.rgbm.gz').read_bytes())).hexdigest()
    compact_groups={g['groupIndex']:g for g in compact['groups']};ranges=0;native=0
    for mesh in data['meshes']:
        geometry=data['geometries'][mesh['geometry']]
        attrs={name:decode(spec) for name,spec in geometry['attributes'].items()}
        if mesh['instances']:
            group=next(g for g in source['groups'] if mesh['name']==f"Blender / {g['geometry']} / torre {g['tower']}")
            original=source['geometries'][group['geometry']]
            for name,key,size in [('position','position',3),('normal','normal',3),('uv','uv',2)]:
                assert np.allclose(attrs[name],np.array(original[key]).reshape(-1,size),atol=3e-6,rtol=0)
            assert np.array_equal(decode(geometry['index']).reshape(-1),original['index'])
            assert np.allclose(decode(mesh['instances']['matrix']).reshape(-1),
                               [v for i in group['instances'] for v in i['matrix']],atol=3e-6,rtol=0)
            native+=1;continue
        assert np.all(attrs['color']==1) and geometry['index'] is None
        for span in mesh['userData']['livFloorRanges']:
            group=source['groups'][span['groupIndex']];packed=compact_groups[span['groupIndex']]
            inst=group['instances'][span['instanceIndex']];original=source['geometries'][group['geometry']]
            index=np.array(packed['indices']);matrix=np.array(inst['matrix']).reshape(4,4,order='F')
            pos=np.array(original['position']).reshape(-1,3)
            normal=np.array(original['normal']).reshape(-1,3)@np.linalg.inv(matrix[:3,:3])
            normal/=np.linalg.norm(normal,axis=1,keepdims=True)
            uv=np.array(original['uv']).reshape(-1,2)
            uv1=np.frombuffer(base64.b64decode(packed['instances'][span['instanceIndex']]['uv1U16']),dtype='<u2').reshape(-1,2)/65535
            start,count=span['start'],span['count'];sl=slice(start,start+count)
            assert count==len(index)
            assert np.allclose(attrs['position'][sl],(pos@matrix[:3,:3].T+matrix[:3,3])[index],atol=5e-6,rtol=0)
            assert np.allclose(attrs['normal'][sl],normal[index],atol=5e-6,rtol=0)
            assert np.allclose(attrs['uv'][sl],uv[index],atol=5e-6,rtol=0)
            assert np.allclose(attrs['uv1'][sl],uv1,atol=1e-7,rtol=0)
            assert (attrs['livFloorIndex'][sl]==inst['floor']).all()
            ranges+=1
    assert native==15 and ranges==data['rgbm']['instances']==1012
    return data,{'nativeGroups':native,'verifiedBakedInstances':ranges,'verticesNormalsUV0UV1Preserved':True}


def ready(page,model='contorno'):
    page.wait_for_function('''m=>{
      const s=window.__livContourStudy;
      if(s?.frame?.contentWindow?.__livProva?.error)throw Error(s.frame.contentWindow.__livProva.error);
      return s?.model===m&&s?.api?.ready;
    }''',arg=model,timeout=180000)


def run_case(browser,name,width,height,backend,out,report,data):
    context=browser.new_context(viewport={'width':width,'height':height},device_scale_factor=1,
                                has_touch=name=='toque',is_mobile=name=='toque')
    page=context.new_page();errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
    requested=[];page.on('request',lambda request:requested.append(request.url))
    try:
        page.goto(URL+'modelo/comparacao.html?backend='+backend,wait_until='load',timeout=180000)
        ready(page)
        result=page.evaluate('''()=>{
          const p=__livContourStudy.api;
          return {backend:p.backend,state:p.getState(),source:p.data.sourceModelSHA256,atlas:p.data.rgbm.textureSHA256,
            frames:document.querySelectorAll('iframe').length,meshes:p.meshes.length,
            baked:p.meshes.filter(m=>m.material.userData.livBakedTransport).length,
            native:p.meshes.filter(m=>!m.material.userData.livBakedTransport).every(m=>m.material.isMeshStandardMaterial&&!m.material.isNodeMaterial),
            units:p.units,picking:!!p.unitPicking,calibration:p.data.materialCalibration};
        }''')
        if backend!='auto':assert result['backend']==backend
        assert result['source']==data['sourceModelSHA256'] and result['atlas']==data['rgbm']['textureSHA256']
        assert result['meshes']==56 and result['baked']==41 and result['native'] and result['frames']==1
        assert result['units'] is None and not result['picking'] and not any('/unidades.json' in url for url in requested)
        assert page.evaluate('''()=>{
          try{__livContourStudy.api.setSelectedUnit('liv-final-01');return false;}
          catch(e){return e.message.includes('posições comerciais');}
        }''')
        highlighted=page.evaluate('''()=>{
          const p=__livContourStudy.api;p.setFloor(16);let changed=0;
          for(const m of p.meshes){const f=m.geometry.getAttribute('livFloorIndex'),c=m.geometry.getAttribute('color');
            if(!f||!c)continue;for(let i=0;i<f.count;i++){if(f.getX(i)===16&&c.getY(i)<1)changed++;}}
          p.setFloor(-1);return changed;
        }''')
        assert highlighted>100
        page.locator('#view').select_option('implantacao')
        page.wait_for_timeout(150)
        page.screenshot(path=str(out/(name+'-contorno.png')),full_page=True)
        page.evaluate('''()=>{
          const p=__livContourStudy.api;
          const resources=new Set([...p.meshes.map(m=>m.geometry),...p.materials,p.atlas,p.scene.environment]);
          for(const m of p.materials)for(const k of ['map','bumpMap','roughnessMap'])if(m[k])resources.add(m[k]);
          window.__contourOld=p;window.__contourDisposals=[...resources].map(resource=>{
            const item={type:resource.type||'Texture',calls:0};resource.addEventListener('dispose',()=>item.calls++);return item;});
        }''')
        page.locator('[data-model=base]').click();ready(page,'base')
        disposal=page.evaluate('''()=>({disposed:__contourOld.disposed,counts:__contourDisposals.map(r=>r.calls),
          frames:document.querySelectorAll('iframe').length})''')
        assert disposal['disposed'] and set(disposal['counts'])=={1} and disposal['frames']==1
        page.screenshot(path=str(out/(name+'-original.png')),full_page=True)
        page.locator('[data-model=contorno]').click();ready(page)
        page.locator('#view').select_option('varandas')
        if name=='toque':
            before=page.evaluate('__livContourStudy.api.camera.position.toArray()')
            bounds=page.locator('iframe').bounding_box();x=bounds['x']+bounds['width']*.55;y=bounds['y']+bounds['height']*.4
            cdp=context.new_cdp_session(page)
            cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x,'y':y,'radiusX':3,'radiusY':3}]})
            for offset in [15,30,45]:cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':x-offset,'y':y,'radiusX':3,'radiusY':3}]})
            cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
            assert not np.allclose(before,page.evaluate('__livContourStudy.api.camera.position.toArray()'))
        page.screenshot(path=str(out/(name+'-varandas.png')),full_page=True)
        assert not errors,errors
        result.update(status='PASS',profile=name,viewport={'width':width,'height':height},floorHighlightVertices=highlighted,resourcesDisposedOnce=len(disposal['counts']),
                      switchBackToCandidate=True,touchEmulated=name=='toque')
        report['cases'].append(result);print(name+': PASS',flush=True)
    finally:
        page.evaluate('window.__livContourStudy?.dispose()');context.close()


def incompatible_atlas(browser,report):
    context=browser.new_context();page=context.new_page();requested=[]
    page.on('request',lambda request:requested.append(request.url))
    wrong=json.loads((OWN/'variante/assets/manifest.json').read_text('utf-8'))
    wrong['sourceModelSHA256']='89f552ec2c030afdcd1ab2167df78e6ff530bf40dd3e7c598d356b5582ebd919'
    pattern='**/modelo/variante/assets/manifest.json'
    page.route(pattern,lambda route:route.fulfill(status=200,content_type='application/json',body=json.dumps(wrong)))
    try:
        page.goto(URL+'prova-rgbm.html?backend=webgl&geometria=contorno')
        page.wait_for_function('window.__livProva?.error',timeout=120000)
        assert 'mesma edição' in page.evaluate('__livProva.error')
        assert page.evaluate('__livProva.disposed') and not any('irradiance.rgbm.gz' in url for url in requested)
        report['incompatibleAtlasRejectedBeforeDownload']=True
    finally:context.close()


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--saida',type=Path,default=EXP/'evidencias/contorno-runtime')
    parser.add_argument('--perfil',choices=['todos',*PROFILES],default='todos')
    args=parser.parse_args();args.saida.mkdir(parents=True,exist_ok=True)
    data,audit=audit_transport()
    files=[OWN/'qa_runtime.py',OWN/'contorno.py',OWN/'contorno-torre.json',OWN/'modelar_exterior.py',OWN/'exportar_variante.py',OWN/'preparar_luz_densa.py',
           OWN/'comparacao.html',OWN/'comparacao.js',OWN/'variante/modelo.json',OWN/'variante/assets/manifest.json',
           OWN/'variante/luz/manifest.json',OWN/'variante/luz/geometry-compact.json',EXP/'renderer.js',
           EXP/'material-rgbm.js',EXP/'cameras.js',EXP/'exterior-finishes.js',EXP/'prova-rgbm.html',
           EXP/'assets-prova/manifest.json',EXP/'unidades.json',EXP/'interiores/catalogo.json']
    report={'schema':'liv-outline-runtime-qa-v1','atUtc':datetime.now(timezone.utc).isoformat(),'status':'RUNNING',
            'physicalMobile':False,'transport':audit,'sources':{p.relative_to(ROOT).as_posix():digest(p) for p in files},'cases':[]}
    try:
        with sync_playwright() as pw:
            browser=pw.chromium.launch(executable_path=CHROME,headless=True)
            report['browserVersion']=browser.version
            for name,(width,height,backend) in PROFILES.items():
                if args.perfil in ['todos',name]:run_case(browser,name,width,height,backend,args.saida,report,data)
            incompatible_atlas(browser,report);browser.close()
        report['status']='PASS'
    except Exception as error:
        report.update(status='FAIL',failure=str(error));raise
    finally:
        (args.saida/'runtime.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
        print(json.dumps({'status':report['status'],'cases':len(report['cases'])}),flush=True)


if __name__=='__main__':main()

"""Inspeção local do material da versão pública preservada, sem alterá-la."""
from pathlib import Path
from io import BytesIO
import argparse
import base64
import hashlib
import json
import urllib.request
from datetime import datetime, timezone
from PIL import Image, ImageStat
from playwright.sync_api import sync_playwright

EXP=Path(__file__).resolve().parent
OUT=EXP/'evidencias/luz-camera-relatada'
URL='http://127.0.0.1:8790/backups/liv-webgpu-2026-10-09/site-v3/maquete-liv-ipanema.html?modo=visita'
CHROME=r'C:\Program Files\Google\Chrome\Application\chrome.exe'
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--rapido',action='store_true')
parser.add_argument('--comparar-nativo',action='store_true')
parser.add_argument('--verificar-publico',action='store_true')
args=parser.parse_args()
BASELINE=EXP.parents[1]/'backups/liv-webgpu-2026-10-09/site-v3/maquete-liv-ipanema.html'
PUBLIC='https://imobilaria-deccb-miniaturas--liv-mapa-5km-20261008-onn3ia42.web.app/maquete-liv-ipanema.html'
report={'recordedAtUtc':datetime.now(timezone.utc).isoformat(),'status':'RUNNING',
        'physicalMobile':False,'viewport':[390,844],'deviceScaleFactor':1.75,
        'userReportedDevice':{'model':'Poco X6 5G','os':'Android 13','browser':'Chrome 154.0.8037.127'},
        'testEnvironment':'Chrome headless no Windows; GPU desktop, viewport e toque emulados',
        'baselineSHA256':hashlib.sha256(BASELINE.read_bytes()).hexdigest(),
        'sourceSHA256':{p:hashlib.sha256((EXP/p).read_bytes()).hexdigest() for p in
          ['diagnosticar_luz_camera.py','interior-renderer.js','material-rgbm.js','interiores/catalogo.json']}}
OUT.mkdir(parents=True,exist_ok=True)
(OUT/'runtime.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
if args.verificar_publico:
    with urllib.request.urlopen(PUBLIC,timeout=35) as response:
        report['publicHTTP']=response.status
        report['publicSHA256']=hashlib.sha256(response.read()).hexdigest()
    report['publicMatchesBaseline']=report['baselineSHA256']==report['publicSHA256']
    assert report['publicMatchesBaseline'],'A versão pública mudou; o diagnóstico se refere à base preservada.'

with sync_playwright() as pw:
    browser=pw.chromium.launch(executable_path=CHROME,headless=True)
    report['browserVersion']=browser.version
    context=browser.new_context(viewport={'width':390,'height':844},device_scale_factor=1.75,is_mobile=True,has_touch=True)
    page=context.new_page()
    page.goto(URL,wait_until='load',timeout=150000)
    page.wait_for_function('window.__maq?.modo()==="visita"&&window.__liv?.luzInteriorPronta',timeout=120000)
    page.evaluate('async()=>{await __liv.luzPronta;await __liv.luzInteriorPronta;}')
    data=page.evaluate('''()=>{
      const api=__maq,root=api.planta(),meshes=[];
      root.updateWorldMatrix(true,true);
      root.traverse(o=>{if(!o.isMesh)return;
        const b=new THREE.Box3().setFromObject(o),ms=Array.isArray(o.material)?o.material:[o.material];
        meshes.push({name:o.name,uuid:o.uuid,visible:o.visible,bounds:[b.min.toArray(),b.max.toArray()],
          materials:ms.map(m=>({name:m.name,type:m.type,color:m.color?.toArray(),roughness:m.roughness,
            metalness:m.metalness,envMapIntensity:m.envMapIntensity,side:m.side,
            lightMap:!!m.lightMap,lightMapIntensity:m.lightMapIntensity,bumpScale:m.bumpScale,
            bumpMap:!!m.bumpMap,normalMap:!!m.normalMap,opacity:m.opacity,transparent:m.transparent,
            depthWrite:m.depthWrite,shaderHook:m.onBeforeCompile.toString(),
            cacheKey:m.customProgramCacheKey()}))});
      });
      const light=__liv.luzInterior;
      return {bake:{ready:light.ready,invalidated:light.invalidated,reason:light.reason,
          objects:light.objects,triangles:light.triangles,sourceSHA256:light.sourceSHA256},
        fp:{...api.FP},rooms:__liv.interior().comodosLocais,meshes};
    }''')
    OUT.mkdir(parents=True,exist_ok=True)
    (OUT/'inspecao.json').write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')
    page.evaluate('''()=>{
      window.__livUniformProbe={};let wall=null;__maq.planta().traverse(o=>{if(!wall&&o.isMesh)wall=o;});
      wall.onAfterRender=function(renderer,scene,camera,geometry,material){
        const key=window.__livCaptureKey;if(!key||__livUniformProbe[key])return;
        const gl=renderer.getContext(),program=gl.getParameter(gl.CURRENT_PROGRAM),uniforms={};
        for(const name of ['lightMapIntensity','envMapIntensity','diffuse','emissive','roughness','metalness',
          'lightMap','map','normalScale','normalMatrix','directionalLights[0].color','directionalLights[0].direction',
          'hemisphereLights[0].direction','hemisphereLights[0].skyColor','hemisphereLights[0].groundColor']){
          const location=gl.getUniformLocation(program,name),value=location?gl.getUniform(program,location):null;
          uniforms[name]=value&&ArrayBuffer.isView(value)?Array.from(value):value;
        }
        __livUniformProbe[key]={uniforms,cpu:{lightMapIntensity:material.lightMapIntensity,
          emissive:material.emissive.toArray(),emissiveIntensity:material.emissiveIntensity}};
      };
    }''')
    page.evaluate('()=>{__maq.FP.pitch=.65;__maq.FP.mx=__maq.FP.mz=0;}')
    page.wait_for_timeout(400)
    page.locator('#cena').screenshot(path=str(OUT/'entrada-olhando-acima.png'))
    poses=[{'name':'suite-a','x':-2.35,'z':-.1,'target':[-1.63,2.4,.32]},
           {'name':'suite-b','x':-2.05,'z':.12,'target':[-1.63,2.4,.32]},
           {'name':'hall-a','x':-.8,'z':.1,'target':[-1.47,2.4,.38]},
           {'name':'hall-b','x':-1.12,'z':.3,'target':[-1.47,2.4,.38]}]
    for pitch in [.55,.65,.75,.85]:
        poses.append({'name':f'rotacao-{pitch}','x':-.8,'z':.1,
                      'target':[-1.4850000143051147,2.4,.38],'yaw':1.98,'pitch':pitch})
    if args.rapido:poses=[p for p in poses if p['name'] in ['rotacao-0.55','rotacao-0.65']]
    data['poses']=[]
    for variant in ['original','sem-especular','atlas-isolado','albedo-isolado','uv-isolado','irradiancia-isolada','difuso-isolado','emissivo-isolado','material-difuso-isolado','ibl-isolado','lambert-isolado']:
        if variant=='sem-especular':
            page.evaluate('''()=>{
              const patched=new Set();__maq.planta().traverse(o=>{if(!o.isMesh)return;
                for(const m of Array.isArray(o.material)?o.material:[o.material]){
                  if(patched.has(m)||!m.isMeshStandardMaterial)continue;patched.add(m);
                  const original=m.onBeforeCompile,key=m.customProgramCacheKey();
                  m.onBeforeCompile=function(s,r){original.call(this,s,r);
                    s.fragmentShader=s.fragmentShader.replace('#include <lights_fragment_end>',
                      '#include <lights_fragment_end>\\nreflectedLight.directSpecular=vec3(0.0);reflectedLight.indirectSpecular=vec3(0.0);');
                  };
                  m.customProgramCacheKey=()=>key+'-diagnostico-sem-especular';m.needsUpdate=true;
                }
              });
            }''')
        elif variant!='original':
            page.evaluate('''variant=>{
              const patched=new Set();__maq.planta().traverse(o=>{if(!o.isMesh)return;
                for(const m of Array.isArray(o.material)?o.material:[o.material]){
                  if(patched.has(m)||!m.isMeshStandardMaterial||!m.lightMap)continue;patched.add(m);
                  const original=m.onBeforeCompile,key=m.customProgramCacheKey();
                  const expression=variant==='atlas-isolado'?
                    'vec4 livSample=texture2D(lightMap,vLightMapUv);outgoingLight=livSample.rgb*livSample.a*16.0;':
                    variant==='albedo-isolado'?'outgoingLight=diffuseColor.rgb;':
                    variant==='uv-isolado'?'outgoingLight=vec3(vLightMapUv,0.0);':
                    variant==='irradiancia-isolada'?'outgoingLight=irradiance*RECIPROCAL_PI;':
                    variant==='difuso-isolado'?'outgoingLight=reflectedLight.indirectDiffuse;':
                    variant==='emissivo-isolado'?'outgoingLight=totalEmissiveRadiance;':
                    variant==='material-difuso-isolado'?'outgoingLight=material.diffuseColor;':
                    variant==='ibl-isolado'?'outgoingLight=iblIrradiance*RECIPROCAL_PI;':
                    'outgoingLight=irradiance*BRDF_Lambert(material.diffuseColor);';
                  m.onBeforeCompile=function(s,r){original.call(this,s,r);
                    s.fragmentShader=s.fragmentShader.replace('#include <opaque_fragment>',expression+'\\n#include <opaque_fragment>');
                  };
                  m.customProgramCacheKey=()=>key+'-diagnostico-'+variant;m.needsUpdate=true;
                }
              });
            }''',variant)
        for pose in poses:
            page.evaluate('''input=>{
              const {pose,variant}=input;window.__livCaptureKey=variant+':'+pose.name;
              const fp=__maq.FP,t=pose.target,dx=t[0]-pose.x,dz=t[2]-pose.z;
              Object.assign(fp,{x:pose.x,z:pose.z,mx:0,mz:0,
                yaw:pose.yaw??Math.atan2(-dx,-dz),pitch:pose.pitch??Math.atan2(t[1]-1.62,Math.hypot(dx,dz))});
            }''',{'pose':pose,'variant':variant})
            page.wait_for_timeout(600)
            page.locator('#cena').screenshot(path=str(OUT/f'{pose["name"]}-{variant}.png'))
            detail=page.evaluate('''pose=>{
              const api=__maq,point=new THREE.Vector3(...pose.target),p=point.clone().project(api.cam),
                r=new THREE.Raycaster(api.cam.position,point.clone().sub(api.cam.position).normalize());
              return {bakeReady:__liv.luzInterior.ready,camera:api.cam.position.toArray(),
                fp:{...api.FP},projected:p.toArray(),canvasPNG:api.ren.domElement.toDataURL('image/png'),
                hits:r.intersectObject(api.planta(),true).slice(0,6).map(h=>({
                  distance:h.distance,point:h.point.toArray(),name:h.object.name,face:h.faceIndex,
                  materialIndex:h.face.materialIndex,normal:h.face.normal.toArray(),uv:h.uv?.toArray(),uv1:h.uv1?.toArray()}))};
            }''',pose)
            png=base64.b64decode(detail.pop('canvasPNG').split(',',1)[1])
            (OUT/f'{pose["name"]}-{variant}-canvas.png').write_bytes(png)
            with Image.open(BytesIO(png)) as im:
                x=(detail['projected'][0]+1)*im.width/2
                y=(1-detail['projected'][1])*im.height/2
                assert 5<x<im.width-5 and 5<y<im.height-5,(pose,x,y)
                detail['samplePixel']=[x,y]
                detail['sampleRGB']=ImageStat.Stat(im.convert('RGB').crop((round(x)-3,round(y)-3,round(x)+4,round(y)+4))).mean
            data['poses'].append({'variant':variant,'pose':pose,'detail':detail})
        if variant=='original':
            shaders=page.evaluate('''()=>{
              const r=__maq.ren,gl=r.getContext();
              return r.info.programs.map(p=>({name:p.name,cacheKey:p.cacheKey,
                fragment:gl.getShaderSource(p.fragmentShader)}));
            }''')
            (OUT/'shaders-compilados.json').write_text(json.dumps(shaders,ensure_ascii=False,indent=2),encoding='utf-8')
    data['uniforms']=page.evaluate('()=>window.__livUniformProbe')
    (OUT/'inspecao.json').write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')
    page.close()
    if args.comparar_nativo:
        data['native']=[]
        for backend in ['webgl','webgpu']:
            page=context.new_page()
            page.goto('http://127.0.0.1:8790/experimentos/liv-ipanema-webgpu-2026-10-09/interior.html?tipologia=canto&modo=visita&backend='+backend,
                      wait_until='load',timeout=150000)
            page.wait_for_function('window.__livInterior?.ready||window.__livInterior?.error',timeout=150000)
            assert page.evaluate('()=>__livInterior.ready'),page.evaluate('()=>__livInterior.error')
            for pose in [p for p in poses if p['name'] in ['rotacao-0.55','rotacao-0.65']]:
                page.evaluate('''async pose=>{
                  const api=__livInterior,s=api.getState();s.mode='visita';
                  s.camera={position:[pose.x,1.62,pose.z],yaw:pose.yaw,pitch:pose.pitch};
                  await api.restoreState(s);
                }''',pose)
                page.wait_for_timeout(600)
                result=page.evaluate('''async pose=>{
                  const api=__livInterior,url=await api.capture(),p=api.camera.position.clone().fromArray(pose.target).project(api.camera);
                  return {state:api.getState(),projected:p.toArray(),png:url};
                }''',pose)
                png=base64.b64decode(result.pop('png').split(',',1)[1])
                (OUT/f'{pose["name"]}-nativo-{backend}.png').write_bytes(png)
                with Image.open(BytesIO(png)) as im:
                    x=(result['projected'][0]+1)*im.width/2;y=(1-result['projected'][1])*im.height/2
                    assert 5<x<im.width-5 and 5<y<im.height-5,(backend,pose,x,y)
                    result['sampleRGB']=ImageStat.Stat(im.convert('RGB').crop((round(x)-3,round(y)-3,round(x)+4,round(y)+4))).mean
                data['native'].append({'backend':backend,'pose':pose,'detail':result})
                (OUT/'inspecao.json').write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')
            await_disposal=page.evaluate('async()=>{await __livInterior.dispose();return __livInterior.disposed;}')
            assert await_disposal
            page.close()
    paired={variant:[s for s in data['poses'] if s['variant']==variant and s['pose']['name'] in
            ['rotacao-0.55','rotacao-0.65']] for variant in dict.fromkeys(s['variant'] for s in data['poses'])}
    report['baselineSamples']={}
    for variant,pair in paired.items():
        assert len(pair)==2
        assert all(s['detail']['bakeReady'] for s in pair)
        rgb=[s['detail']['sampleRGB'] for s in pair]
        report['baselineSamples'][variant]={'RGB':rgb,'maxDeltaRGB':max(abs(a-b) for a,b in zip(*rgb))}
    assert report['baselineSamples']['original']['maxDeltaRGB']>15,'A variação da versão antiga não foi reproduzida.'
    assert report['baselineSamples']['sem-especular']['maxDeltaRGB']>15,'Reavaliar a hipótese: retirar reflexos resolveu a variação.'
    for variant in ['atlas-isolado','albedo-isolado','uv-isolado','irradiancia-isolada','material-difuso-isolado','lambert-isolado']:
        assert report['baselineSamples'][variant]['maxDeltaRGB']<2,(variant,'O ponto de controle não ficou estável.')
    report['fixedWorldPoint']=[-1.4850000143051147,2.4,.38]
    report['fixedCameraPosition']=[-.8,1.62,.1]
    report['angles']={'yaw':1.98,'pitch':[.55,.65]}
    report['nativeCases']=[]
    if args.comparar_nativo:
        for backend in ['webgl','webgpu']:
            pair=[s for s in data['native'] if s['backend']==backend]
            assert len(pair)==2
            for s in pair:
                state=s['detail']['state']
                assert state['backend']==backend and state['lighting']['bakedActive']
                assert state['camera']['position']==report['fixedCameraPosition']
            rgb=[s['detail']['sampleRGB'] for s in pair]
            delta=max(abs(a-b) for a,b in zip(*rgb));assert delta<2,(backend,delta)
            report['nativeCases'].append({'backend':backend,'status':'PASS','RGB':rgb,'maxDeltaRGB':delta,
              'unitSHA256':pair[0]['detail']['state']['unitSHA256'],
              'sourceSHA256':pair[0]['detail']['state']['sourceSHA256'],'bakedActive':True})
    report['status']='PASS'
    report['nativeQualified']=args.comparar_nativo
    (OUT/'runtime.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps({'bake':data['bake'],'fp':data['fp'],'meshes':len(data['meshes']),'output':str(OUT)}))
    browser.close()

"""Diagnóstico da caminhada da versão pública preservada, sem modificar o produto.

Executar isoladamente dos outros QAs gráficos. Viewport/toque/CPU emulados usam
a GPU desktop; as medições não comprovam desempenho de celular físico.
"""
import argparse
import hashlib
import json
import statistics
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

from playwright.sync_api import sync_playwright

EXP = Path(__file__).resolve().parent
ROOT = EXP.parents[1]
BASELINE = ROOT / 'backups/liv-webgpu-2026-10-09/site-v3/maquete-liv-ipanema.html'
URL = 'http://127.0.0.1:8790/backups/liv-webgpu-2026-10-09/site-v3/maquete-liv-ipanema.html?modo=visita'
PUBLIC = 'https://imobilaria-deccb-miniaturas--liv-mapa-5km-20261008-onn3ia42.web.app/maquete-liv-ipanema.html'
CHROME = r'C:\Program Files\Google\Chrome\Application\chrome.exe'

METADATA = r'''()=>{
  const api=__maq,root=api.planta(),r=api.ren,lights=[],materials=new Set();
  let meshes=0,vertices=0,triangles=0;
  root.traverse(o=>{if(!o.isMesh)return;meshes++;
    vertices+=o.geometry.attributes.position?.count||0;
    triangles+=(o.geometry.index?.count||o.geometry.attributes.position?.count||0)/3;
    for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);
  });
  api.cena.traverse(o=>{if(o.isLight)lights.push({type:o.type,castShadow:o.castShadow,
    ...(o.shadow?{shadowAutoUpdate:o.shadow.autoUpdate,shadowSize:o.shadow.mapSize.toArray()}: {})});});
  return {threeVersion:THREE.REVISION,mode:api.modo(),pixelRatio:r.getPixelRatio(),
    canvas:{width:r.domElement.width,height:r.domElement.height,
      cssWidth:r.domElement.clientWidth,cssHeight:r.domElement.clientHeight},
    lights,geometry:{meshes,vertices,triangles,materials:materials.size},
    interiorBake:{ready:__liv.luzInterior.ready,reason:__liv.luzInterior.reason},
    exteriorBakeReady:!!__livLightmap?.ready,
    rendererMemory:{...r.info.memory},camera:api.cam.position.toArray()};
}'''

CPU_PROBES = r'''()=>{
  const api=__maq,interior=__liv.interior(),initial={...api.FP};
  const measure=(fn,n)=>{const values=[];for(let i=0;i<n;i++){
    const t=performance.now();fn(i);values.push(performance.now()-t);
  }return values;};
  const checks=measure(()=>__liv.luzInterior.check(),120);
  const collisions=measure(i=>api.livre(initial.x+Math.sin(i)*.08,initial.z+Math.cos(i)*.08),300);
  api.FP.mz=.55;api.FP.mx=.15;
  const steps=measure(()=>api.passoVisita(1/60),120);
  Object.assign(api.FP,initial);api.FP.mz=api.FP.mx=0;
  const routes=[];
  for(const room of interior.comodosLocais){
    const xs=room.poly.map(p=>p[0]),zs=room.poly.map(p=>p[1]),
      cx=xs.reduce((a,b)=>a+b,0)/xs.length,cz=zs.reduce((a,b)=>a+b,0)/zs.length;
    let target=null,best=Infinity;
    for(let z=Math.min(...zs);z<=Math.max(...zs);z+=.15){
      for(let x=Math.min(...xs);x<=Math.max(...xs);x+=.15){
        if(!interior.dentro(room.poly,x,z)||!api.livre(x,z))continue;
        const d=(x-cx)**2+(z-cz)**2;if(d<best){best=d;target={x,z};}
      }
    }
    if(!target){routes.push({room:room.nome,target:null});continue;}
    const times=[],counts=[];
    for(let attempt=0;attempt<3;attempt++){
      Object.assign(api.FP,initial);api.FP.mz=api.FP.mx=0;
      const t=performance.now(),route=api.caminhoAte(target);
      times.push(performance.now()-t);counts.push(route.length);
    }
    routes.push({room:room.nome,target,durationsMs:times,pathPoints:counts});
  }
  Object.assign(api.FP,initial);api.FP.mz=api.FP.mx=0;
  return {checks,collisions,steps,routes};
}'''

SAMPLE = r'''async variant=>{
  const api=__maq,r=api.ren,bake=__liv.luzInterior,initial={...api.FP},
    original={render:r.render,check:bake.check,pixelRatio:r.getPixelRatio(),shadows:r.shadowMap.enabled};
  let recording=false,frames=[];
  try{
    if(variant==='resolution-1')r.setPixelRatio(1);
    if(variant==='without-shadow')r.shadowMap.enabled=false;
    if(variant==='without-bake-check')bake.check=()=>true;
    r.render=function(...args){
      const start=performance.now(),result=original.render.apply(this,args);
      if(recording)frames.push({at:start,cpuSubmitMs:performance.now()-start,
        calls:this.info.render.calls,triangles:this.info.render.triangles});
      return result;
    };
    await new Promise(resolve=>setTimeout(resolve,1500));
    Object.assign(api.FP,initial);api.FP.mz=.55;api.FP.mx=.15;
    const start=performance.now();recording=true;
    await new Promise(resolve=>setTimeout(resolve,2500));
    recording=false;
    return {variant,elapsedMs:performance.now()-start,frames,
      pixelRatio:r.getPixelRatio(),shadowsEnabled:r.shadowMap.enabled,
      movementMeters:Math.hypot(api.FP.x-initial.x,api.FP.z-initial.z),
      canvas:{width:r.domElement.width,height:r.domElement.height},
      bakeStillReady:bake.ready};
  }finally{
    recording=false;r.render=original.render;bake.check=original.check;
    r.setPixelRatio(original.pixelRatio);r.shadowMap.enabled=original.shadows;
    Object.assign(api.FP,initial);api.FP.mz=api.FP.mx=0;
  }
}'''


def distribution(values, unit='ms'):
    ordered = sorted(values)
    return {'count': len(values), 'unit': unit,
            'median': statistics.median(ordered) if ordered else None,
            'p95': ordered[min(len(ordered)-1, int(len(ordered)*.95))] if ordered else None,
            'max': max(ordered) if ordered else None}


def persist(report, output):
    (output / 'runtime.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')


def run(output, verify_public):
    output.mkdir(parents=True, exist_ok=True)
    body = BASELINE.read_bytes()
    digest = hashlib.sha256(body).hexdigest()
    report = {'recordedAtUtc': datetime.now(timezone.utc).isoformat(), 'status': 'RUNNING',
              'physicalMobile': False, 'gpu': 'Desktop; não emulada pelo throttling de CPU',
              'network': 'Loopback; custo de rede pública não comparado',
              'url': URL, 'publicURL': PUBLIC, 'baselineSHA256': digest,
              'baselineBytes': len(body), 'sourceSHA256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
              'viewport': [390, 844], 'deviceScaleFactor': 3, 'cases': []}
    persist(report, output)
    try:
        if verify_public:
            with urllib.request.urlopen(PUBLIC, timeout=35) as response:
                live = response.read()
                report['publicHTTP'] = response.status
            report['publicSHA256'] = hashlib.sha256(live).hexdigest()
            report['publicMatchesBaseline'] = report['publicSHA256'] == digest
            assert report['publicMatchesBaseline'], 'A versão pública mudou; não atribuir o diagnóstico à cópia antiga.'
            del live
        with sync_playwright() as pw:
            browser = pw.chromium.launch(executable_path=CHROME, headless=True)
            report['browserVersion'] = browser.version
            context = browser.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=3,
                                          is_mobile=True, has_touch=True, service_workers='block')
            page = context.new_page()
            errors=[]
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.goto(URL, wait_until='load', timeout=150000)
            page.wait_for_function('window.__maq?.modo()==="visita"&&window.__liv?.luzInteriorPronta', timeout=120000)
            page.evaluate('''async()=>{await Promise.race([
              Promise.all([__liv.luzPronta,__liv.luzInteriorPronta]),
              new Promise((_,reject)=>setTimeout(()=>reject(Error('Bake não assentou em 90 s.')),90000))
            ]);if(!__liv.luzInterior?.ready)throw Error('Bake interior não está pronto.');}''')
            report['metadata'] = page.evaluate(METADATA)
            cdp = context.new_cdp_session(page)
            for rate in [1, 4]:
                cdp.send('Emulation.setCPUThrottlingRate', {'rate': rate})
                case = {'cpuThrottlingRate': rate, 'status': 'RUNNING', 'variants': []}
                report['cases'].append(case);persist(report, output)
                probes = page.evaluate(CPU_PROBES)
                case['cpu'] = {key: distribution(probes[key]) for key in ['checks', 'collisions', 'steps']}
                case['routes'] = probes['routes']
                for variant in ['original', 'resolution-1', 'without-shadow', 'without-bake-check']:
                    for round_number in [1, 2]:
                        sample = page.evaluate(SAMPLE, variant)
                        frames = sample.pop('frames')
                        sample['round'] = round_number
                        sample['frameCount'] = len(frames)
                        sample['cpuSubmit'] = distribution([f['cpuSubmitMs'] for f in frames])
                        gaps = [b['at']-a['at'] for a,b in zip(frames,frames[1:])]
                        sample['frameIntervals'] = distribution(gaps)
                        sample['framesOver33Ms'] = sum(value>33.34 for value in gaps)
                        sample['sufficientFrames'] = len(frames)>=30
                        sample['drawCalls'] = distribution([f['calls'] for f in frames], 'calls/frame')
                        sample['triangles'] = distribution([f['triangles'] for f in frames], 'triangles/frame')
                        assert sample['movementMeters']>.05, 'A amostra não exercitou caminhada.'
                        assert sample['bakeStillReady'], 'O experimento invalidou o bake.'
                        case['variants'].append(sample);persist(report, output)
                case['status']='PASS';persist(report, output)
            cdp.detach();context.close();browser.close()
            report['errors']=errors
            assert not errors, errors
        report['status']='PASS'
    except Exception as error:
        report['status']='FAIL';report['failure']=str(error);raise
    finally:
        persist(report, output)
        print(json.dumps({'status': report['status'], 'cases': len(report['cases']), 'output': str(output)}))


if __name__ == '__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--saida', type=Path, default=EXP/'evidencias/perfil-visita-publica')
    parser.add_argument('--verificar-publico', action='store_true')
    args=parser.parse_args()
    run(args.saida,args.verificar_publico)

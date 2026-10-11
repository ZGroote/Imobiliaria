"""Compara base e evolução em sequência, no desktop local, com HTTP frio/cache."""
import argparse
import hashlib
import json
import platform
from datetime import datetime, timezone
from pathlib import Path

from playwright.sync_api import sync_playwright

EXP=Path(__file__).resolve().parent
URL='http://127.0.0.1:8790/experimentos/liv-ipanema-webgpu-2026-10-09/'
SAMPLE="""async duration=>{
 const m=window.__maq||window.__livProva,r=m.ren||m.renderer,original=r.render,times=[],costs=[];
 const start=performance.now(),theta=m.orb?.th,snapshot=m.getState?.();
 const initial=m.camera?.position.clone(),target=m.controls?.target.clone(),axis=target?.clone().set(0,1,0);
 r.render=function(...args){
   const t=performance.now(),angle=(t-start)*.00012;
   if(m.orb){m.orb.th=theta+angle;m.poeCam();}
   else{m.camera.position.copy(initial).sub(target).applyAxisAngle(axis,angle).add(target);m.camera.lookAt(target);}
   times.push(t);const value=original.apply(this,args);costs.push(performance.now()-t);return value;
 };
 try{await new Promise(resolve=>setTimeout(resolve,duration));}
 finally{r.render=original;if(m.orb){m.orb.th=theta;m.poeCam();}else m.restoreState(snapshot);}
 const percentile=(v,p)=>{const s=[...v].sort((a,b)=>a-b);return s[Math.min(s.length-1,Math.floor(s.length*p))]??null;};
 const intervals=times.slice(1).map((t,i)=>t-times[i]);
 const gl=r.backend?.isWebGPUBackend?null:(r.backend?.getContext?.()||r.getContext?.());
 const ext=gl?.getExtension('WEBGL_debug_renderer_info'),gpu=r.backend?.device?.adapterInfo;
 return {renderSubmissions:times.length,sampleMs:performance.now()-start,
   intervalP50Ms:percentile(intervals,.5),intervalP95Ms:percentile(intervals,.95),
   cpuSubmitP50Ms:percentile(costs,.5),cpuSubmitP95Ms:percentile(costs,.95),
   backend:m.backend||'webgl',gpu:gpu?{vendor:gpu.vendor,architecture:gpu.architecture,isFallbackAdapter:gpu.isFallbackAdapter}:null,
   webglRenderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):null,
   canvas:[r.domElement.width,r.domElement.height],dpr:r.getPixelRatio(),renderInfo:{...r.info.render},memoryObjects:{...r.info.memory}};
}"""
NETWORK="""()=>[...performance.getEntriesByType('navigation'),...performance.getEntriesByType('resource')]
 .filter(r=>r.initiatorType!=='iframe').map(r=>({url:r.name,encodedBytes:r.encodedBodySize,
 decodedBytes:r.decodedBodySize,transferBytes:r.transferSize,type:r.initiatorType||'navigation'}))"""


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--saida',type=Path,default=EXP/'evidencias'/'medicao-final')
    parser.add_argument('--rodadas',type=int,default=3)
    parser.add_argument('--amostra-ms',type=int,default=4000)
    parser.add_argument('--geometria',choices=['base','contorno','ambas'],default='base')
    parser.add_argument('--base-url',default=URL)
    parser.add_argument('--igualar-canvas',action='store_true',help='Usa 720x390 no exterior novo, como na base preservada.')
    args=parser.parse_args();out=args.saida;out.mkdir(parents=True,exist_ok=True)
    report={'recordedAtUtc':datetime.now(timezone.utc).isoformat(),'status':'RUNNING',
        'platform':platform.platform(),'headless':True,'physicalMobile':False,'viewport':[1440,900],
        'network':'loopback sem compressão HTTP; recursos .gz já comprimidos no arquivo',
        'execution':'sequencial; Chrome novo por rodada, reload no mesmo contexto; fila pausada após primeira cena utilizável para isolar a amostra de órbita',
        'limits':'Contexto novo para cache HTTP frio; caches do driver e outras aplicações não controlados. Cadência de submissão não é tempo GPU. Tráfego do worker não é contabilizado pelos documentos.',
        'sourceSHA256':{name:hashlib.sha256((EXP/name).read_bytes()).hexdigest() for name in ['medir_runtime.py','renderer.js','material-rgbm.js','viewer.js','maquete-liv-ipanema.html','prova-rgbm.html','transfers.js','transfer-worker.js','transfer-manifest.json','cameras.js','exterior-finishes.js','assets-prova/manifest.json','modelo/variante/assets/manifest.json','unidades.json','modelo/unidades-contorno.json']},
        'matchedCanvas':args.igualar_canvas,'geometrySelection':args.geometria,'baseURL':args.base_url,'rounds':[]}
    try:
        with sync_playwright() as pw:
            variants=[('base','site-baseline/maquete-liv-ipanema.html')]
            for geometry in (['base','contorno'] if args.geometria=='ambas' else [args.geometria]):
                for backend in ['webgl','webgpu']:
                    label=backend if geometry=='base' else 'contorno-'+backend
                    variants.append((label,f'maquete-liv-ipanema.html?backend={backend}&geometria={geometry}'))
            for variant,path in variants:
                for number in range(args.rodadas):
                    browser=pw.chromium.launch(executable_path=r'C:\Program Files\Google\Chrome\Application\chrome.exe',headless=True)
                    report['browserVersion']=browser.version
                    context=browser.new_context(viewport={'width':1440,'height':900},device_scale_factor=1)
                    if args.igualar_canvas:
                        context.add_init_script("""(() => {
                          function install(){if(!document.documentElement)return false;
                            const style=document.createElement('style');style.textContent='#stage{box-sizing:content-box!important;width:720px!important;height:390px!important}';
                            document.documentElement.append(style);return true;}
                          if(!install()){const observer=new MutationObserver(()=>{if(install())observer.disconnect();});
                            observer.observe(document,{childList:true});}
                        })();""")
                    page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
                    page.goto(args.base_url.rstrip('/')+'/'+path,wait_until='load',timeout=120000)
                    record={'variant':variant,'round':number+1,'phases':{},'errors':errors};report['rounds'].append(record)
                    for phase in ['cold','warm']:
                        if phase=='warm':page.reload(wait_until='load',timeout=120000)
                        if variant=='base':page.wait_for_function('window.__maq&&window.__livLightmap?.ready',timeout=120000)
                        else:
                            try:page.wait_for_function('()=>{if(window.__livViewer?.error)throw Error(__livViewer.error);return window.__livViewer?.ready;}',timeout=120000)
                            except Exception:
                                record['failureState']=page.evaluate("()=>{const v=window.__livViewer,m=v?.frame?.contentWindow?.__livProva;return {viewerError:v?.error,loadingProgress:v?.loadingProgress,renderer:m?{ready:m.ready,error:m.error,timings:m.timings,progress:m.progress,deviceLoss:m.deviceLoss,backendError:m.backendError}:null};}")
                                raise
                        ready_ms=page.evaluate('performance.now()')
                        # Snapshot completed initial resources before the orbit sample.
                        # Background SW traffic is reported separately; ResourceTiming
                        # in documents cannot measure HTTP-encoded SW response bytes.
                        resources=[r for f in page.frames for r in f.evaluate(NETWORK)]
                        resources=list({r['url']:r for r in resources}.values())
                        queue=None
                        if variant!='base':
                            page.evaluate('async()=>{await __livTransfers.pause();}')
                            queue=page.evaluate('__livTransfers.getState()')
                        frame=page if variant=='base' else page.frames[-1]
                        identity=frame.evaluate("()=>{const m=window.__livProva;return m?{backend:m.backend,sourceModelSHA256:m.data.sourceModelSHA256,timings:{...m.timings},frameTimeOrigin:performance.timeOrigin,memory:{...m.renderer.info.memory}}:null;}")
                        if identity:assert identity['backend']==('webgpu' if variant.endswith('webgpu') else 'webgl'),identity
                        await_data=frame.evaluate(SAMPLE,args.amostra_ms)
                        if args.igualar_canvas:assert await_data['canvas']==[720,390],await_data['canvas']
                        data={'readyMs':ready_ms,'metrics':await_data,'resources':list(resources),
                            'encodedBodyBytes':sum(r['encodedBytes'] for r in resources),
                            'transferBytes':sum(r['transferBytes'] for r in resources),'queueAtSample':queue,'identity':identity}
                        if variant!='base':assert not any('/site-baseline/' in r['url'] for r in resources),data
                        record['phases'][phase]=data
                        print(json.dumps({'variant':variant,'round':number+1,'phase':phase,'readyMs':round(ready_ms)}),flush=True)
                    assert not errors,errors
                    context.close();browser.close()
        report['status']='PASS'
    except Exception as error:
        report['status']='FAIL';report['failure']=str(error);raise
    finally:
        (out/'medicao.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
        print(json.dumps({'status':report['status'],'rounds':len(report['rounds']),'output':str(out)}))


if __name__=='__main__':main()

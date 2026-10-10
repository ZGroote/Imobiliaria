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
   canvas:[r.domElement.width,r.domElement.height],dpr:r.getPixelRatio(),renderInfo:{...r.info.render}};
}"""
NETWORK="""()=>[...performance.getEntriesByType('navigation'),...performance.getEntriesByType('resource')]
 .filter(r=>r.initiatorType!=='iframe').map(r=>({url:r.name,encodedBytes:r.encodedBodySize,
 decodedBytes:r.decodedBodySize,transferBytes:r.transferSize,type:r.initiatorType||'navigation'}))"""


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--saida',type=Path,default=EXP/'evidencias'/'medicao-final')
    parser.add_argument('--rodadas',type=int,default=3)
    parser.add_argument('--amostra-ms',type=int,default=4000)
    args=parser.parse_args();out=args.saida;out.mkdir(parents=True,exist_ok=True)
    report={'recordedAtUtc':datetime.now(timezone.utc).isoformat(),'status':'RUNNING',
        'platform':platform.platform(),'headless':True,'physicalMobile':False,'viewport':[1440,900],
        'network':'loopback sem compressão HTTP; recursos .gz já comprimidos no arquivo',
        'execution':'sequencial; fila pausada após primeira cena utilizável para isolar a amostra de órbita',
        'limits':'Contexto novo para cache HTTP frio; caches do driver não controlados. Canvas da interface pode diferir; cadência de submissão não é tempo GPU.',
        'sourceSHA256':{name:hashlib.sha256((EXP/name).read_bytes()).hexdigest() for name in ['renderer.js','material-rgbm.js','viewer.js','maquete-liv-ipanema.html','transfers.js','transfer-worker.js','transfer-manifest.json']},
        'rounds':[]}
    try:
        with sync_playwright() as pw:
            browser=pw.chromium.launch(executable_path=r'C:\Program Files\Google\Chrome\Application\chrome.exe',headless=True)
            report['browserVersion']=browser.version
            for variant,path in [('base','site-baseline/maquete-liv-ipanema.html'),('webgl','maquete-liv-ipanema.html?backend=webgl'),('webgpu','maquete-liv-ipanema.html?backend=webgpu')]:
                for number in range(args.rodadas):
                    context=browser.new_context(viewport={'width':1440,'height':900},device_scale_factor=1)
                    page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
                    page.goto(URL+path,wait_until='load',timeout=120000)
                    record={'variant':variant,'round':number+1,'phases':{}};report['rounds'].append(record)
                    for phase in ['cold','warm']:
                        if phase=='warm':page.reload(wait_until='load',timeout=120000)
                        if variant=='base':page.wait_for_function('window.__maq&&window.__livLightmap?.ready',timeout=120000)
                        else:page.wait_for_function('window.__livViewer?.ready',timeout=120000)
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
                        await_data=frame.evaluate(SAMPLE,args.amostra_ms)
                        data={'readyMs':ready_ms,'metrics':await_data,'resources':list(resources),
                            'encodedBodyBytes':sum(r['encodedBytes'] for r in resources),
                            'transferBytes':sum(r['transferBytes'] for r in resources),'queueAtSample':queue}
                        if variant!='base':assert not any('/site-baseline/' in r['url'] for r in resources),data
                        record['phases'][phase]=data
                    assert not errors,errors
                    context.close()
            browser.close()
        report['status']='PASS'
    except Exception as error:
        report['status']='FAIL';report['failure']=str(error);raise
    finally:
        (out/'medicao.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
        print(json.dumps({'status':report['status'],'rounds':len(report['rounds']),'output':str(out)}))


if __name__=='__main__':main()

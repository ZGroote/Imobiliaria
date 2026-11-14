"""Compara o decoder nativo com o fallback na abertura real, sem desativar cache.

A única intervenção seleciona a disponibilidade de Uint8Array.fromBase64.
geometryStart/geometryReady medem a montagem real, incluindo bounds e matrizes.
"""
import argparse
import hashlib
import json
import platform
from datetime import datetime, timezone
from pathlib import Path

from playwright.sync_api import sync_playwright

from medir_instancias import CANVAS
from medir_runtime import EXP, URL, NETWORK, SAMPLE

TRIAL=r"""(() => {
 const trial=window.__livBufferTrial={policy:POLICY,nativeCalls:0,legacyCalls:0,nativeMs:0};
 const native=Uint8Array.fromBase64,legacy=window.atob;
 trial.nativeAvailable=typeof native==='function';
 Object.defineProperty(Uint8Array,'fromBase64',{configurable:true,writable:true,
   value:trial.policy==='manual'?undefined:typeof native==='function'?function(...args){
     const start=performance.now();trial.nativeCalls++;
     try{return native.apply(this,args);}finally{trial.nativeMs+=performance.now()-start;}
   }:undefined});
 window.atob=function(...args){trial.legacyCalls++;return legacy.apply(this,args);};
})();"""


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--saida',type=Path,default=EXP/'evidencias/medicao-buffers')
    parser.add_argument('--rodadas',type=int,default=3)
    parser.add_argument('--amostra-ms',type=int,default=4000)
    parser.add_argument('--cpu-factor',type=int,choices=[1,4],default=1)
    args=parser.parse_args()
    if args.rodadas<1 or args.amostra_ms<1:
        parser.error('Rodadas e duração devem ser positivas.')
    args.saida.mkdir(parents=True,exist_ok=True)
    names=['renderer.js','material-rgbm.js','ambiente.js','viewer.js','prova-rgbm.html',
      'maquete-liv-ipanema.html','edicoes.js','unidades.js','cameras.js','exterior-finishes.js',
      'transfers.js','transfer-worker.js','transfer-manifest.json','medir_buffers.py',
      'medir_runtime.py','medir_instancias.py','modelo/entrada/candidato/assets/manifest.json',
      'modelo/entrada/unidades-entrada.json','assets-ambiente/manifest.json']
    report={'status':'RUNNING','recordedAtUtc':datetime.now(timezone.utc).isoformat(),
      'platform':platform.platform(),'headless':True,'physicalMobile':False,
      'viewport':[1440,900],'canvas':[720,390],'dpr':1,'cpuFactor':args.cpu_factor,
      'method':'Chrome novo por braço/rodada; frio/reload no mesmo contexto; ordem alternada; fila pausada após ready. Sem interceptação HTTP. Marcadores delimitam a montagem real da geometria.',
      'intervention':'Nativa conserva fromBase64 e conta chamadas. Manual torna a API indisponível: o renderer executa seu fallback anterior. Contagem de atob igual nos dois braços. Nenhuma mudança em materiais, instâncias, luz, compilação ou apresentação.',
      'limits':'Loopback, cache do driver/outras aplicações não controlados. Throttling de CPU não emula GPU nem um celular físico. Marcadores/contadores adicionam custo; confirmar abertura sem intervenção em medir_runtime.py.',
      'sourceSHA256':{n:hashlib.sha256((EXP/n).read_bytes()).hexdigest() for n in names},
      'trialSHA256':hashlib.sha256(TRIAL.encode()).hexdigest(),'rounds':[]}
    try:
        with sync_playwright() as pw:
            for number in range(args.rodadas):
                backends=['webgpu','webgl'] if number%2==0 else ['webgl','webgpu']
                policies=['manual','nativa'] if number%2==0 else ['nativa','manual']
                for backend in backends:
                    for policy in policies:
                        browser=pw.chromium.launch(executable_path=r'C:\Program Files\Google\Chrome\Application\chrome.exe',headless=True)
                        report['browserVersion']=browser.version
                        context=browser.new_context(viewport={'width':1440,'height':900},device_scale_factor=1)
                        context.add_init_script(CANVAS);context.add_init_script(TRIAL.replace('POLICY',json.dumps(policy)))
                        page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
                        session=context.new_cdp_session(page)
                        session.send('Emulation.setCPUThrottlingRate',{'rate':args.cpu_factor})
                        row={'round':number+1,'backend':backend,'policy':policy,'phases':{}}
                        report['rounds'].append(row)
                        for phase in ['cold','warm']:
                            if phase=='cold':page.goto(URL+f'maquete-liv-ipanema.html?geometria=entrada&backend={backend}&ambiente=precalculado',wait_until='load',timeout=120000)
                            else:page.reload(wait_until='load',timeout=120000)
                            page.wait_for_function('()=>{if(__livViewer?.error)throw Error(__livViewer.error);return __livViewer?.ready;}',timeout=120000)
                            ready_ms=page.evaluate('performance.now()')
                            resources=list({r['url']:r for f in page.frames for r in f.evaluate(NETWORK)}.values())
                            page.evaluate('async()=>{await __livTransfers.pause();}')
                            frame=next(f for f in page.frames if f.evaluate('Boolean(window.__livProva?.ready)'))
                            identity=frame.evaluate("""()=>{const p=__livProva;return {backend:p.backend,
                              sourceModelSHA256:p.data.sourceModelSHA256,timings:{...p.timings},
                              environmentProfile:p.environmentProfile,environmentFallbackError:p.environmentFallbackError,
                              trial:{...__livBufferTrial},memory:{...p.renderer.info.memory}};}""")
                            assert identity['backend']==backend and identity['environmentProfile']=='precalculado'
                            assert not identity.get('environmentFallbackError') and identity['sourceModelSHA256']=='09407385ae2776910decbf433a365f000f61512e2c35c8fd7e3f3248086b172a'
                            trial=identity['trial'];assert trial['nativeAvailable'],trial
                            assert (trial['nativeCalls']==327 and trial['legacyCalls']==0) if policy=='nativa' else (trial['nativeCalls']==0 and trial['legacyCalls']==327),trial
                            build_ms=identity['timings']['geometryReady']-identity['timings']['geometryStart']
                            metrics=frame.evaluate(SAMPLE,args.amostra_ms)
                            assert metrics['canvas']==[720,390] and metrics['dpr']==1,metrics
                            row['phases'][phase]={'readyMs':ready_ms,'geometryBuildMs':build_ms,
                              'identity':identity,'metrics':metrics,'encodedBodyBytes':sum(r['encodedBytes'] for r in resources),'resources':resources}
                            print(json.dumps({'round':number+1,'backend':backend,'policy':policy,'phase':phase,
                              'readyMs':round(ready_ms),'geometryBuildMs':round(build_ms,1)}),flush=True)
                        assert not errors,errors
                        context.close();browser.close()
        report['status']='PASS'
    except Exception as error:
        report['status']='FAIL';report['failure']=str(error);raise
    finally:
        (args.saida/'medicao.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
        print(json.dumps({'status':report['status'],'output':str(args.saida)}),flush=True)


if __name__=='__main__':
    main()

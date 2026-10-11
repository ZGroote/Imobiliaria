"""Ensaio A/B de um quadro antes de compileAsync, sem alterar a produção.

Cache HTTP permanece ativo: não intercepta requisições. Anexa a intervenção
antes da montagem da cena; mantém compilação e a espera de apresentação.
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

TRIAL = r"""(() => {
  const trial=window.__livPreparationTrial={policy:POLICY,attachedAt:null,calls:0};
  const poll=setInterval(()=>{
    const state=window.__livProva,renderer=state?.renderer;
    if(!state&&window.__livViewer){clearInterval(poll);return;}
    if(!renderer)return;
    clearInterval(poll);trial.attachedAt=performance.now();
    const original=renderer.compileAsync;
    renderer.compileAsync=function(scene,camera,...rest){
      trial.calls++;trial.before=performance.now();
      if(trial.policy==='quadro')renderer.render(scene,camera);
      trial.afterFrame=performance.now();
      return original.call(this,scene,camera,...rest);
    };
  },1);
})();"""


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--saida',type=Path,default=EXP/'evidencias/medicao-preparo')
    parser.add_argument('--rodadas',type=int,default=3)
    parser.add_argument('--amostra-ms',type=int,default=4000)
    args=parser.parse_args()
    if args.rodadas<1 or args.amostra_ms<1:
        parser.error('Rodadas e duração devem ser positivas.')
    args.saida.mkdir(parents=True,exist_ok=True)
    names=['renderer.js','material-rgbm.js','ambiente.js','viewer.js','prova-rgbm.html',
           'maquete-liv-ipanema.html','edicoes.js','unidades.js','cameras.js','exterior-finishes.js',
           'transfers.js','transfer-worker.js','transfer-manifest.json','medir_runtime.py',
           'medir_instancias.py','medir_preparo.py','modelo/entrada/candidato/assets/manifest.json',
           'modelo/entrada/unidades-entrada.json','assets-ambiente/manifest.json']
    report={'status':'RUNNING','recordedAtUtc':datetime.now(timezone.utc).isoformat(),
        'platform':platform.platform(),'headless':True,'physicalMobile':False,
        'viewport':[1440,900],'canvas':[720,390],'dpr':1,
        'method':'Chrome novo por tratamento/rodada; HTTP frio e reload no mesmo contexto; ordem alternada; fila pausada depois de ready; sem interceptação HTTP.',
        'intervention':'Compilacao conserva compileAsync. Quadro executa renderer.render(scene,camera) imediatamente antes de compileAsync. Os dois mantêm o loop existente, a compilação completa e a dupla requestAnimationFrame antes de ready. Intervenção só no ensaio.',
        'limits':'Loopback; cache do driver e outras aplicações não controlados. Anexação igual nos dois braços. Cadência de submissão não mede FPS nem tempo GPU.',
        'sourceSHA256':{name:hashlib.sha256((EXP/name).read_bytes()).hexdigest() for name in names},
        'trialSHA256':hashlib.sha256(TRIAL.encode()).hexdigest(),'rounds':[]}
    try:
        with sync_playwright() as pw:
            for number in range(args.rodadas):
                backends=['webgpu','webgl'] if number%2==0 else ['webgl','webgpu']
                policies=['compilacao','quadro'] if number%2==0 else ['quadro','compilacao']
                for backend in backends:
                    for policy in policies:
                        browser=pw.chromium.launch(executable_path=r'C:\Program Files\Google\Chrome\Application\chrome.exe',headless=True)
                        report['browserVersion']=browser.version
                        context=browser.new_context(viewport={'width':1440,'height':900},device_scale_factor=1)
                        context.add_init_script(CANVAS)
                        context.add_init_script(TRIAL.replace('POLICY',json.dumps(policy)))
                        page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
                        row={'round':number+1,'backend':backend,'policy':policy,'phases':{}}
                        report['rounds'].append(row)
                        for phase in ['cold','warm']:
                            if phase=='cold':
                                page.goto(URL+f'maquete-liv-ipanema.html?geometria=entrada&backend={backend}&ambiente=precalculado',wait_until='load',timeout=120000)
                            else:
                                page.reload(wait_until='load',timeout=120000)
                            page.wait_for_function('()=>{if(__livViewer?.error)throw Error(__livViewer.error);return __livViewer?.ready;}',timeout=120000)
                            ready_ms=page.evaluate('performance.now()')
                            resources=list({r['url']:r for f in page.frames for r in f.evaluate(NETWORK)}.values())
                            page.evaluate('async()=>{await __livTransfers.pause();}')
                            frame=next(f for f in page.frames if f.evaluate('Boolean(window.__livProva?.ready)'))
                            identity=frame.evaluate("""()=>{const p=__livProva;return {backend:p.backend,
                              sourceModelSHA256:p.data.sourceModelSHA256,timings:{...p.timings},
                              environmentProfile:p.environmentProfile,environmentFallbackError:p.environmentFallbackError,
                              trial:{...__livPreparationTrial},memory:{...p.renderer.info.memory}};}""")
                            assert identity['backend']==backend and identity['environmentProfile']=='precalculado'
                            assert not identity.get('environmentFallbackError') and identity['sourceModelSHA256']=='09407385ae2776910decbf433a365f000f61512e2c35c8fd7e3f3248086b172a'
                            assert identity['trial']['attachedAt']<identity['timings']['sceneBuilt'] and identity['trial']['calls']==1,identity
                            metrics=frame.evaluate(SAMPLE,args.amostra_ms)
                            assert metrics['canvas']==[720,390] and metrics['dpr']==1,metrics
                            row['phases'][phase]={'readyMs':ready_ms,'identity':identity,'metrics':metrics,
                              'encodedBodyBytes':sum(r['encodedBytes'] for r in resources),'resources':resources}
                            print(json.dumps({'round':number+1,'backend':backend,'policy':policy,'phase':phase,
                              'readyMs':round(ready_ms),'compiledMs':round(identity['timings']['compiled']-identity['timings']['sceneBuilt'])}),flush=True)
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

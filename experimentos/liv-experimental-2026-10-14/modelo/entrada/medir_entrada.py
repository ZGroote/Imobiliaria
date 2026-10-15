"""Compara o custo do novo exterior com o contorno anterior, sem a interface/fila."""
import argparse
import hashlib
import json
import platform
import sys
from datetime import datetime,timezone
from pathlib import Path

from playwright.sync_api import sync_playwright

HERE=Path(__file__).resolve().parent;EXP=HERE.parents[1]
sys.path.insert(0,str(EXP))
from medir_runtime import NETWORK,SAMPLE

URL='http://127.0.0.1:8790/experimentos/liv-experimental-2026-10-14/prova-rgbm.html'
CHROME=r'C:\Program Files\Google\Chrome\Application\chrome.exe'
MATCH_CANVAS='''(() => {
  function install(){if(!document.documentElement)return false;
    const style=document.createElement('style');style.textContent='#stage{box-sizing:content-box!important;width:720px!important;height:390px!important}';
    document.documentElement.append(style);return true;}
  if(!install()){const observer=new MutationObserver(()=>{if(install())observer.disconnect();});observer.observe(document,{childList:true});}
})();'''


def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--saida',type=Path,required=True)
    parser.add_argument('--rodadas',type=int,default=3);parser.add_argument('--amostra-ms',type=int,default=4000)
    args=parser.parse_args();assert args.rodadas>0 and args.amostra_ms>=1000
    args.saida.mkdir(parents=True,exist_ok=True)
    names=['modelo/entrada/medir_entrada.py','medir_runtime.py','renderer.js','prova-rgbm.html','material-rgbm.js','cameras.js',
           'ambiente.js','assets-ambiente/manifest.json','assets-ambiente/ambiente.f16.gz',
           'modelo/variante/assets/manifest.json','modelo/entrada/candidato/assets/manifest.json']
    report={'status':'RUNNING','recordedAtUtc':datetime.now(timezone.utc).isoformat(),'platform':platform.platform(),
      'headless':True,'physicalMobile':False,'viewport':[1440,900],'matchedCanvas':[720,390],'baseURL':URL,
      'execution':'Chrome/contexto novo por tratamento/rodada; reload no mesmo contexto; ordem alternada entre rodadas; ensaios sequenciais',
      'network':'HTTP local sem compressão adicional; recursos .gz já comprimidos; sem fila, mapa, interiores ou cadastro',
      'limits':'Compara só o exterior isolado na mesma página. Não é tempo da interface integrada ou aprovação de T05. Caches do driver e outras aplicações não controlados; intervalos/custo CPU de submissão não são tempo GPU ou FPS.',
      'sourceSHA256':{name:hashlib.sha256((EXP/name).read_bytes()).hexdigest() for name in names},'rounds':[]}
    expected={geometry:json.loads((EXP/path).read_bytes())['sourceModelSHA256'] for geometry,path in
      [('contorno','modelo/variante/assets/manifest.json'),('entrada','modelo/entrada/candidato/assets/manifest.json')]}
    reference_camera=None
    try:
        with sync_playwright() as pw:
            variants=[(geometry,backend) for backend in ['webgl','webgpu'] for geometry in ['contorno','entrada']]
            for number in range(args.rodadas):
                order=variants if number%3==0 else list(reversed(variants)) if number%3==1 else variants[2:]+variants[:2]
                for geometry,backend in order:
                    browser=pw.chromium.launch(executable_path=CHROME,headless=True);report['browserVersion']=browser.version
                    context=browser.new_context(viewport={'width':1440,'height':900},device_scale_factor=1);context.add_init_script(MATCH_CANVAS)
                    page=context.new_page();errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
                    record={'variant':geometry+'-'+backend,'round':number+1,'phases':{},'errors':errors};report['rounds'].append(record)
                    try:
                        page.goto(URL+f'?geometria={geometry}&backend={backend}',wait_until='load',timeout=120000)
                        for phase in ['cold','warm']:
                            if phase=='warm':page.reload(wait_until='load',timeout=120000)
                            page.wait_for_function('()=>{const api=window.__livProva;if(api?.error)throw Error(api.error);return api?.ready;}',timeout=120000)
                            ready=page.evaluate('performance.now()');resources=page.evaluate(NETWORK)
                            identity=page.evaluate('''()=>{const api=__livProva;return {backend:api.backend,sourceModelSHA256:api.data.sourceModelSHA256,
                              environmentProfile:api.environmentProfile,environmentFallbackError:api.environmentFallbackError,
                              camera:api.getState().camera,timings:{...api.timings}};}''')
                            assert identity['backend']==backend and identity['sourceModelSHA256']==expected[geometry],identity
                            assert identity['environmentProfile']=='precalculado' and not identity.get('environmentFallbackError')
                            if reference_camera is None:reference_camera=identity['camera']
                            assert identity['camera']==reference_camera,identity['camera']
                            metrics=page.evaluate(SAMPLE,args.amostra_ms);assert metrics['canvas']==[720,390] and metrics['dpr']==1
                            record['phases'][phase]={'readyMs':ready,'identity':identity,'metrics':metrics,'resources':resources,
                              'encodedBodyBytes':sum(r['encodedBytes'] for r in resources),'transferBytes':sum(r['transferBytes'] for r in resources)}
                            print(json.dumps({'variant':record['variant'],'round':number+1,'phase':phase,'readyMs':round(ready)}),flush=True)
                        assert not errors,errors
                        page.evaluate('async()=>{await __livProva.dispose();}')
                    finally:context.close();browser.close()
        report['status']='PASS'
    except Exception as error:report['status']='FAIL';report['failure']=str(error);raise
    finally:(args.saida/'medicao.json').write_text(json.dumps(report,indent=2),encoding='utf-8')


if __name__=='__main__':main()

"""Valida preservação de PBR importado, abertura local, recuperação e descarte."""
import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image, ImageStat
from playwright.sync_api import sync_playwright

EXP=Path(__file__).resolve().parent
URL='http://127.0.0.1:8790/experimentos/liv-ipanema-webgpu-2026-10-09/materiais.html'
STATE="""()=>{
 const p=__livMaterials,materials=[];
 p.asset.scene.traverse(o=>{for(const m of Array.isArray(o.material)?o.material:[o.material]){
  if(m&&!materials.some(x=>x.uuid===m.uuid))materials.push({uuid:m.uuid,type:m.type,node:!!m.isNodeMaterial,name:m.name});}});
 return {backend:p.backend,report:p.report,origin:p.origin,bounds:p.bounds,materials,
   sceneChildren:p.scene.children.length,renderInfo:{...p.renderer.info.render},memory:{...p.renderer.info.memory}};
}"""


def wait_ready(page):
    page.wait_for_function('window.__livMaterials && !__livMaterials.busy && (__livMaterials.ready||__livMaterials.error||__livMaterials.lastLoadError)',timeout=120000)
    error=page.evaluate('window.__livMaterials.error||window.__livMaterials.lastLoadError')
    assert not error,error


def check_asset(page):
    data=page.evaluate(STATE)
    report=data['report']
    assert report['compatible'] and report['meshCount']==10 and report['materialCount']==6,report
    assert not any(m['node'] for m in data['materials']),data
    assert {m['uuid'] for m in data['materials']}=={m['uuid'] for m in report['materials']},data
    mats={m['name']:m for m in report['materials']}
    assert mats['Superfície com verniz']['type']=='MeshPhysicalMaterial',mats
    assert mats['Superfície com verniz']['properties']['clearcoat']==1,mats
    glass=mats['Vidro com volume']['properties']
    assert glass['transmission']==.92 and glass['thickness']==.7 and glass['ior']==1.45,glass
    mineral=mats['Mineral fosco']
    maps={t['slot']:t for t in mineral['textures']}
    assert maps['map']['colorSpace']=='srgb' and maps['roughnessMap']['colorSpace']=='',maps
    assert maps['metalnessMap']['uuid']==maps['roughnessMap']['uuid'],maps
    assert report['geometryCount']==2 and report['textureCount']==2,report
    assert data['sceneChildren']==3,data  # Hemisphere, sun, imported scene.
    bounds=page.evaluate("""()=>{
      const p=__livMaterials,box=p.bounds,points=[];p.camera.updateMatrixWorld();
      for(const x of [box.min[0],box.max[0]])for(const y of [box.min[1],box.max[1]])for(const z of [box.min[2],box.max[2]])
        points.push(p.camera.position.clone().set(x,y,z).project(p.camera));
      return {maxXY:Math.max(...points.flatMap(v=>[Math.abs(v.x),Math.abs(v.y)])),maxZ:Math.max(...points.map(v=>Math.abs(v.z)))};
    }""")
    assert bounds['maxXY']<1.01 and bounds['maxZ']<1.01,bounds
    data['projectedBounds']=bounds
    return data


def expect_file_failure(page,files,message):
    before=page.evaluate('__livMaterials.asset.scene.uuid')
    page.locator('#files').set_input_files(files)
    page.wait_for_function('!__livMaterials.busy && __livMaterials.lastLoadError',timeout=30000)
    error=page.evaluate('__livMaterials.lastLoadError')
    assert message.lower() in error.lower(),error
    assert page.evaluate('__livMaterials.asset.scene.uuid')==before
    assert page.locator('#error').is_visible() and page.locator('#capture').is_enabled()
    return error


def begin_blocked_compile(page):
    page.evaluate("""async()=>{
      const response=await fetch('assets-materiais/amostra.glb'),buffer=await response.arrayBuffer();
      const p=__livMaterials,original=p.renderer.compileAsync.bind(p.renderer);
      window.__qaCompileBlocked=false;
      p.renderer.compileAsync=async(...args)=>{
        const result=await original(...args);window.__qaCompileBlocked=true;
        await new Promise(resolve=>window.__qaReleaseCompile=resolve);return result;
      };
      window.__qaLoad=p.loadFiles([new File([buffer],'pendente.glb')]);
    }""")
    page.wait_for_function('window.__qaCompileBlocked',timeout=30000)


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--saida',type=Path,default=EXP/'evidencias'/'materiais')
    parser.add_argument('--ciclos',type=int,default=20)
    parser.add_argument('--asset',type=Path,help='GLB local adicional para qualificar um asset existente nos dois backends desktop.')
    args=parser.parse_args();args.saida.mkdir(parents=True,exist_ok=True)
    folder=args.saida/'pacote-local'
    for path in [folder/'modelo',folder/'dados',folder/'texturas']:path.mkdir(parents=True,exist_ok=True)
    nested=json.loads((EXP/'assets-materiais'/'amostra.gltf').read_text(encoding='utf-8'))
    nested['buffers'][0]['uri']='../dados/amostra.bin'
    for image,name in zip(nested['images'],['cor.png','rugosidade.png']):
        image['uri']='../texturas/'+name
        (folder/'texturas'/name).write_bytes((EXP/'assets-materiais'/name).read_bytes())
    (folder/'dados'/'amostra.bin').write_bytes((EXP/'assets-materiais'/'amostra.bin').read_bytes())
    (folder/'modelo'/'amostra.gltf').write_text(json.dumps(nested,ensure_ascii=False),encoding='utf-8')
    report={'recordedAtUtc':datetime.now(timezone.utc).isoformat(),'status':'RUNNING','physicalMobile':False,
        'limits':'Amostra própria sem referência ao LIV. Compressões Draco/KTX2/Meshopt não qualificadas por este ensaio. Contagens de recursos não medem toda a memória GPU.',
        'sourceSHA256':{name:hashlib.sha256((EXP/name).read_bytes()).hexdigest() for name in
                       ['materials.js','asset-loader.js','materials-viewer.js','materiais.html']},'cases':[]}
    try:
        with sync_playwright() as pw:
            browser=pw.chromium.launch(executable_path=r'C:\Program Files\Google\Chrome\Application\chrome.exe',headless=True)
            report['browserVersion']=browser.version
            for backend,width,height in [('webgl',1440,900),('webgpu',1440,900),('webgl',390,844),('webgpu',390,844)]:
                case={'backend':backend,'viewport':[width,height],'touchEmulated':width==390,'errors':[],'httpFailures':[],'remoteRequests':[],'status':'RUNNING'}
                report['cases'].append(case)
                context=browser.new_context(viewport={'width':width,'height':height},device_scale_factor=1,
                    is_mobile=width==390,has_touch=width==390,accept_downloads=True)
                page=context.new_page()
                page.on('pageerror',lambda e,c=case:c['errors'].append(str(e)))
                page.on('response',lambda r,c=case:c['httpFailures'].append({'url':r.url,'status':r.status}) if r.status>=400 else None)
                page.on('request',lambda r,c=case:c['remoteRequests'].append(r.url) if r.url.startswith('http') and not r.url.startswith('http://127.0.0.1:8790/') else None)
                page.goto(URL+'?backend='+backend,wait_until='load',timeout=120000);wait_ready(page)
                case['sample']=check_asset(page);assert case['sample']['backend']==backend
                canvas=page.locator('canvas');canvas.screenshot(path=str(args.saida/f'{backend}-{width}-amostra.png'))
                with page.expect_download(timeout=15000) as download_info:page.locator('#capture').click()
                target=args.saida/f'{backend}-{width}-captura.png';download_info.value.save_as(target)
                with Image.open(target) as image:
                    assert image.width>=200 and image.height>=200
                    assert max(ImageStat.Stat(image.convert('RGB')).var)>30
                    case['png']={'dimensions':[image.width,image.height],'bytes':target.stat().st_size}
                # Use the product's file-input path, not a substitute test loader.
                page.locator('#files').set_input_files(str(EXP/'assets-materiais'/'amostra.glb'));wait_ready(page)
                case['localGLB']=check_asset(page)
                package=[str(EXP/'assets-materiais'/name) for name in ['amostra.gltf','amostra.bin','cor.png','rugosidade.png']]
                page.locator('#files').set_input_files(package);wait_ready(page);case['localGLTF']=check_asset(page)
                page.locator('#directory').set_input_files(str(folder.resolve()));wait_ready(page)
                case['nestedFolder']=check_asset(page)
                assert page.evaluate('__livMaterials.asset.localImport.rootPath').endswith('modelo/amostra.gltf')
                invalid=json.loads((EXP/'assets-materiais'/'amostra.gltf').read_text(encoding='utf-8'))
                invalid['buffers'][0]['uri']='https://example.invalid/model.bin'
                case['remoteURI']=expect_file_failure(page,[{'name':'remoto.gltf','mimeType':'model/gltf+json','buffer':json.dumps(invalid).encode()}],'externo')
                case['corruptGLB']=expect_file_failure(page,[{'name':'quebrado.glb','mimeType':'model/gltf-binary','buffer':b'glTF\x02\x00'}],'glb')
                case['missingResource']=expect_file_failure(page,[str(EXP/'assets-materiais'/'amostra.gltf')],'amostra.bin')
                invalid['buffers'][0]['uri']='amostra.bin';invalid['extensionsRequired']=['EXT_sem_suporte']
                case['unknownExtension']=expect_file_failure(page,[{'name':'ext.gltf','mimeType':'model/gltf+json','buffer':json.dumps(invalid).encode()}],'EXT_sem_suporte')
                page.locator('#sample').click();wait_ready(page);check_asset(page)
                # Last requested model wins, including a parse that finishes late.
                page.evaluate("async()=>{const r=await fetch('assets-materiais/amostra.glb'),b=await r.arrayBuffer();await Promise.all([__livMaterials.loadFiles([new File([b],'primeiro.glb')]),__livMaterials.loadFiles([new File([b],'ultimo.glb')])]);}")
                wait_ready(page);assert page.evaluate('__livMaterials.origin.name')=='ultimo.glb'
                case['rapidLoadLastWins']=True
                if backend=='webgpu' and width==1440:
                    case['cycles']=[]
                    for i in range(args.ciclos):
                        page.locator('#files').set_input_files(str(EXP/'assets-materiais'/'amostra.glb'));wait_ready(page)
                        if i in [0,args.ciclos-1]:case['cycles'].append({'cycle':i+1,'state':check_asset(page)})
                    assert case['cycles'][0]['state']['memory']==case['cycles'][-1]['state']['memory'],case['cycles']
                layout=page.evaluate("({overflow:document.documentElement.scrollWidth>innerWidth+1,minButtonHeight:Math.min(...[...document.querySelectorAll('button')].map(b=>b.getBoundingClientRect().height))})")
                assert not layout['overflow'] and layout['minButtonHeight']>=44,layout;case['layout']=layout
                if args.asset and width==1440:
                    asset=args.asset.resolve()
                    page.locator('#files').set_input_files(str(asset));wait_ready(page)
                    actual=page.evaluate(STATE)
                    assert actual['report']['compatible'] and actual['report']['meshCount']>0,actual
                    assert not any(m['node'] for m in actual['materials']),actual
                    assert {m['uuid'] for m in actual['materials']}=={m['uuid'] for m in actual['report']['materials']},actual
                    case['existingAsset']={'path':str(asset),'bytes':asset.stat().st_size,
                        'sha256':hashlib.sha256(asset.read_bytes()).hexdigest(),'state':actual,
                        'extensions':page.evaluate('__livMaterials.asset.localImport.extensions')}
                    canvas.screenshot(path=str(args.saida/f'{backend}-{width}-asset-existente.png'))
                    page.locator('#sample').click();wait_ready(page)
                if backend=='webgpu' and width==1440:
                    begin_blocked_compile(page)
                    page.evaluate('window.__qaDisposal=__livMaterials.dispose();void 0')
                    assert not page.evaluate('__livMaterials.ready')
                    assert page.evaluate('__livMaterials.asset!==null')  # Ownership drained after compile.
                    page.evaluate('async()=>{__qaReleaseCompile();await Promise.all([__qaLoad,__qaDisposal]);}')
                    assert page.evaluate('__livMaterials.asset===null && __livMaterials.scene.children.length===0')
                    case['disposeDuringCompile']='PASS'
                    page.reload(wait_until='load');wait_ready(page)
                    begin_blocked_compile(page)
                    page.evaluate("__livMaterials.renderer.onDeviceLost({api:'WebGPU',reason:'unknown',message:'QA callback simulado'});__qaReleaseCompile();void 0")
                    page.evaluate('async()=>{await __qaLoad;}')
                    assert page.evaluate('!__livMaterials.ready && !__livMaterials.busy && !!__livMaterials.error')
                    assert page.locator('#error').is_visible() and page.locator('#open').is_disabled()
                    case['lossDuringCompile']='PASS — callback simulado; sem falha física da GPU'
                page.evaluate('__livMaterials.dispose()');assert not page.evaluate('__livMaterials.ready')
                assert not case['errors'] and not case['httpFailures'] and not case['remoteRequests'],case
                case['status']='PASS';context.close()
            browser.close()
        report['status']='PASS'
    except Exception as error:
        report['status']='FAIL';report['failure']=str(error);raise
    finally:
        (args.saida/'runtime.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
        print(json.dumps({'status':report['status'],'output':str(args.saida)}))


if __name__=='__main__':main()

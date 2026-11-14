"""Confere imagens e dados das instâncias contra a edição anterior do renderer.

Executar depois do benchmark: a interceptação HTTP deste QA desativa o cache,
portanto seus tempos não são medidas de abertura.
"""
import argparse
import base64
import hashlib
import io
import json
import subprocess
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
from PIL import Image
from playwright.sync_api import sync_playwright

EXP=Path(__file__).resolve().parent
REL='experimentos/liv-ipanema-webgpu-2026-10-09/renderer.js'
URL='http://127.0.0.1:8790/experimentos/liv-ipanema-webgpu-2026-10-09/'
PROFILES={'webgpu':(1440,900,'webgpu',1),'webgl':(1440,900,'webgl',1),
          'toque':(390,844,'auto',3)}
VIEWS=['perspectiva','fachada','aerea','portaria','implantacao','varandas','acesso']

SNAPSHOT=r"""async()=>{
  const p=__livProva,hash=async a=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',
    new Uint8Array(a.buffer,a.byteOffset,a.byteLength)))].map(b=>b.toString(16).padStart(2,'0')).join('');
  const instances=[];
  for(const mesh of p.meshes.filter(m=>m.isInstancedMesh)){
    const spec=p.data.meshes.find(s=>s.name===mesh.name);
    const binary=atob(spec.instances.matrix.base64),source=Uint8Array.from(binary,c=>c.charCodeAt(0));
    const matrixSHA256=await hash(mesh.instanceMatrix.array);
    if(matrixSHA256!==await hash(source)||mesh.count!==spec.instances.count||mesh.instanceMatrix.count!==spec.instances.count)
      throw Error('Matrizes ou contagem alteradas: '+mesh.name);
    instances.push({name:mesh.name,count:mesh.count,capacity:mesh.instanceMatrix.count,matrixSHA256});
  }
  const geometryBuffers=[];
  for(const [index,spec]of p.data.geometries.entries()){
    const meshIndex=p.data.meshes.findIndex(m=>m.geometry===index);
    if(meshIndex<0)continue;
    const geometry=p.meshes[meshIndex].geometry;
    for(const [name,attribute]of Object.entries({...spec.attributes,...(spec.index?{index:spec.index}:{})})){
      // Pilot floor colors are mutable and have their own selection checks.
      if(name==='color')continue;
      const current=name==='index'?geometry.index:geometry.getAttribute(name);
      const raw=Uint8Array.from(atob(attribute.base64),c=>c.charCodeAt(0));
      const SourceType=globalThis[attribute.type];let expected=new SourceType(raw.buffer);
      if(current.array.constructor!==SourceType){
        // r186 WebGPUAttributeUtils widens non-normalized small integers.
        // Check its exact value conversion, including primitive restart.
        const signed=['Int8Array','Int16Array'].includes(attribute.type);
        const unsigned=['Uint8Array','Uint16Array'].includes(attribute.type);
        const RuntimeType=signed?Int32Array:unsigned?Uint32Array:null;
        if(p.backend!=='webgpu'||attribute.normalized||!RuntimeType||current.array.constructor!==RuntimeType)
          throw Error('Conversão de buffer inesperada: '+index+'/'+name);
        expected=new RuntimeType(expected);
        if(name==='index'&&unsigned)for(let i=0;i<expected.length;i++)if(expected[i]===0xffff)expected[i]=0xffffffff;
      }
      const sha256=await hash(current.array);
      if(sha256!==await hash(expected)||current.itemSize!==attribute.itemSize||current.normalized!==attribute.normalized)
        throw Error('Buffer da fonte alterado: '+index+'/'+name);
      geometryBuffers.push({index,name,sourceType:attribute.type,sourceSHA256:await hash(raw),
        type:current.array.constructor.name,length:current.array.length,sha256});
    }
  }
  return {sourceModelSHA256:p.data.sourceModelSHA256,atlasSHA256:p.data.rgbm.textureSHA256,
    instances,geometryBuffers,materials:p.materials.map(m=>({name:m.name,type:m.type,node:!!m.isNodeMaterial,
      baked:m.userData.livBakedTransport,color:m.color?.toArray(),roughness:m.roughness,
      metalness:m.metalness,transparent:m.transparent,side:m.side})),
    geometryCount:new Set(p.meshes.map(m=>m.geometry)).size};
}"""


def capture(page,path):
    encoded=page.evaluate('async()=>{await new Promise(requestAnimationFrame);return __livProva.capture(false);}')
    raw=base64.b64decode(encoded.split(',',1)[1]);path.write_bytes(raw)
    image=np.asarray(Image.open(io.BytesIO(raw)).convert('RGBA'),dtype=np.int16)
    assert image[:,:,:3].std()>3,'Imagem vazia'
    return image


def run_case(browser,profile,geometry,treatment,source,out,native_decoder='auto'):
    width,height,backend,dpr=PROFILES[profile]
    context=browser.new_context(viewport={'width':width,'height':height},device_scale_factor=dpr,
                               is_mobile=profile=='toque',has_touch=profile=='toque')
    if native_decoder=='ausente':
        context.add_init_script("Object.defineProperty(Uint8Array,'fromBase64',{configurable:true,writable:true,value:undefined});")
    context.route('**/renderer.js',lambda route:route.fulfill(status=200,content_type='text/javascript',body=source))
    page=context.new_page();errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
    result={'profile':profile,'geometry':geometry,'treatment':treatment,'errors':errors}
    images={}
    try:
        page.goto(URL+f'prova-rgbm.html?geometria={geometry}&backend={backend}&selecao=piloto',timeout=120000)
        page.wait_for_function('()=>{const p=window.__livProva;if(p?.error)throw Error(p.error);return p?.ready;}',timeout=120000)
        result['initial']=page.evaluate('''async()=>{
          const p=__livProva;await p.renderer.setAnimationLoop(null);
          const counts=window.__qaInstanceDisposal={geometry:0,material:0,atlas:0,environment:0};
          for(const g of new Set(p.meshes.map(o=>o.geometry)))g.addEventListener('dispose',()=>counts.geometry++);
          for(const m of p.materials)m.addEventListener('dispose',()=>counts.material++);
          p.atlas.addEventListener('dispose',()=>counts.atlas++);p.scene.environment.addEventListener('dispose',()=>counts.environment++);
          return {backend:p.backend,nativeDecoderAvailable:typeof Uint8Array.fromBase64==='function',environmentProfile:p.environmentProfile,environmentFallbackError:p.environmentFallbackError,
            memory:{...p.renderer.info.memory},canvas:[p.renderer.domElement.width,p.renderer.domElement.height]};}''')
        assert result['initial']['backend']==('webgpu' if backend=='auto' else backend)
        assert result['initial']['environmentProfile']=='precalculado' and not result['initial'].get('environmentFallbackError')
        result['source']=page.evaluate(SNAPSHOT)
        assert all(m['node']==m['baked'] for m in result['source']['materials'])
        for view in VIEWS:
            page.evaluate('(v)=>__livProva.setView(v)',view)
            images[view]=capture(page,out/f'{geometry}-{profile}-{treatment}-{view}.png')
        page.evaluate('__livProva.setUnitView("lazer");__livProva.setSelectedUnit(__livProva.units.units[0].id);')
        images['final-01']=capture(page,out/f'{geometry}-{profile}-{treatment}-final-01.png')
        result['floorColors']=page.evaluate('''()=>{
          const p=__livProva,values=[];
          for(const mesh of p.meshes.filter(m=>m.isInstancedMesh&&m.userData.tower===0&&m.userData.livPavimentos?.includes(1))){
            const floors=mesh.userData.livPavimentos,colors=mesh.instanceColor;
            if(!colors)throw Error('Cor do pavimento ausente');
            for(let i=0;i<mesh.count;i++){
              const color=[colors.getX(i),colors.getY(i),colors.getZ(i)],expected=floors[i]===1?[.28,.95,.53]:[1,1,1];
              if(color.some((v,k)=>Math.abs(v-expected[k])>1e-6))throw Error('Cor incorreta: '+mesh.name+'/'+i);
            }
            values.push({name:mesh.name,selected: floors.filter(f=>f===1).length});
          }
          return values;
        }''')
        assert result['floorColors'] and all(v['selected']>0 for v in result['floorColors'])
        page.evaluate('__livProva.setFloor(-1);__livProva.setView("varandas")')
        images['before-move']=capture(page,out/f'{geometry}-{profile}-{treatment}-before-move.png')
        result['moved']=page.evaluate('''async()=>{
          const p=__livProva,THREE=await import('three/webgpu');
          const mesh=p.meshes.find(m=>m.isInstancedMesh&&m.userData.tower===0&&m.count>10&&m.userData.livPavimentos);
          if(!mesh)throw Error('Esquadrias ausentes');
          const original=new THREE.Matrix4();mesh.getMatrixAt(10,original);
          window.__qaMovedInstance={mesh,original,index:10};
          const moved=original.clone();moved.elements[12]+=2;
          mesh.setMatrixAt(10,moved);mesh.instanceMatrix.needsUpdate=true;p.invalidateShadows();
          return {name:mesh.name,index:10};
        }''')
        images['moved']=capture(page,out/f'{geometry}-{profile}-{treatment}-moved.png')
        changed=np.any(images['before-move']!=images['moved'],axis=2)
        result['movedPixels']=int(changed.sum());assert result['movedPixels']>20,result
        page.evaluate('''()=>{const v=__qaMovedInstance;v.mesh.setMatrixAt(v.index,v.original);
          v.mesh.instanceMatrix.needsUpdate=true;__livProva.invalidateShadows();}''')
        images['restored']=capture(page,out/f'{geometry}-{profile}-{treatment}-restored.png')
        assert int(np.abs(images['before-move']-images['restored']).max())<=1,'Restauração mudou a imagem'
        assert result['source']==page.evaluate(SNAPSHOT),'Edição alterada após selecionar/mover/restaurar'
        result['settledMemory']=page.evaluate('({...__livProva.renderer.info.memory})')
        result['programInventory']=page.evaluate('''async()=>{
          const result=[];
          for(const [stage,programs]of Object.entries(__livProva.renderer._pipelines.programs))
            for(const p of programs.values()){
              const code=new TextEncoder().encode(p.code);
              const sha256=[...new Uint8Array(await crypto.subtle.digest('SHA-256',code))].map(b=>b.toString(16).padStart(2,'0')).join('');
              result.push({stage,name:p.name,usedTimes:p.usedTimes,bytes:code.length,sha256});
            }
          return result;
        }''')
        result['disposed']=page.evaluate('async()=>{await __livProva.dispose();return {...__qaInstanceDisposal};}')
        assert result['disposed']=={'geometry':result['source']['geometryCount'],
          'material':len(result['source']['materials']),'atlas':1,'environment':1},result['disposed']
        assert not errors,errors
        return result,images
    finally:
        context.close()


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--referencia',default='b67984e')
    parser.add_argument('--programas',choices=['reducao','registrar'],default='reducao',
                        help='Redução para instancing; inventário de cache para alterações apenas no loader.')
    parser.add_argument('--decoder-nativo',choices=['auto','ausente'],default='auto')
    parser.add_argument('--saida',type=Path,default=EXP/'evidencias/instancias-paridade')
    args=parser.parse_args();args.saida.mkdir(parents=True,exist_ok=True)
    before=subprocess.run(['git','show',args.referencia+':'+REL],capture_output=True,check=True).stdout
    after=(EXP/'renderer.js').read_bytes()
    report={'status':'RUNNING','recordedAtUtc':datetime.now(timezone.utc).isoformat(),
      'referenceGit':args.referencia,'referenceRendererSHA256':hashlib.sha256(before).hexdigest(),
      'programExpectation':args.programas,'nativeDecoder':args.decoder_nativo,
      'sourceSHA256':{name:hashlib.sha256((EXP/name).read_bytes()).hexdigest() for name in
        ['renderer.js','material-rgbm.js','ambiente.js','cameras.js','unidades.js','picking.js','edicoes.js','qa_instancias.py',
         'assets-prova/manifest.json','modelo/variante/assets/manifest.json','modelo/entrada/candidato/assets/manifest.json',
         'node_modules/three/src/renderers/webgpu/utils/WebGPUAttributeUtils.js']},
      'method':'Comparação sequencial das capturas RGBA da referência e do candidato; mesma câmera/canvas/atlas/ambiente. Interceptação só no renderer; nenhum tempo deste QA é benchmark.',
      'physicalMobile':False,'cases':[]}
    try:
        with sync_playwright() as pw:
            browser=pw.chromium.launch(executable_path=r'C:\Program Files\Google\Chrome\Application\chrome.exe',headless=True)
            report['browserVersion']=browser.version
            for geometry in ['base','contorno','entrada']:
                for profile in PROFILES:
                    old,old_images=run_case(browser,profile,geometry,'referencia',before,args.saida,args.decoder_nativo)
                    new,new_images=run_case(browser,profile,geometry,'atual',after,args.saida,args.decoder_nativo)
                    case={'geometry':geometry,'profile':profile,'before':old,'after':new,'views':[]};report['cases'].append(case)
                    assert old['source']==new['source'],'Dados ou materiais diferentes'
                    assert old['initial']['canvas']==new['initial']['canvas']
                    for name in old_images:
                        delta=np.abs(old_images[name]-new_images[name]);maximum=int(delta.max())
                        case['views'].append({'view':name,'maxRgbaDelta':maximum,'meanRgbaDelta':float(delta.mean())})
                        assert maximum<=1,(geometry,profile,name,maximum)
                    if args.programas=='reducao':
                        assert new['initial']['memory']['programs']<old['initial']['memory']['programs'],case
                    print(json.dumps({'geometry':geometry,'profile':profile,'status':'PASS',
                      'programs':[old['initial']['memory']['programs'],new['initial']['memory']['programs']]}),flush=True)
            browser.close()
        report['status']='PASS'
    except Exception as error:
        report['status']='FAIL';report['failure']=str(error);raise
    finally:
        (args.saida/'runtime.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
        print(json.dumps({'status':report['status'],'output':str(args.saida)}),flush=True)


if __name__=='__main__':
    main()

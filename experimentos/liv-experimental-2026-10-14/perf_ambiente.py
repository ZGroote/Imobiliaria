"""Experimenta PMREM pré-calculado sem alterar os materiais ou o runtime publicado."""
import argparse
import base64
import hashlib
import io
import json
from pathlib import Path
from datetime import datetime,timezone

import numpy as np
from PIL import Image
from playwright.sync_api import sync_playwright

EXP=Path(__file__).resolve().parent
URL='http://127.0.0.1:8790/experimentos/liv-experimental-2026-10-14/'
CHROME=r'C:\Program Files\Google\Chrome\Application\chrome.exe'


def capture(page,path):
    data=base64.b64decode(page.evaluate('__qaFrame()').split(',',1)[1]);path.write_bytes(data)
    return np.asarray(Image.open(io.BytesIO(data)).convert('RGB'),dtype=np.float32)


def run(out):
    out.mkdir(parents=True,exist_ok=True)
    report={'status':'RUNNING','recordedAtUtc':datetime.now(timezone.utc).isoformat(),'physicalMobile':False,
      'sourceSHA256':{name:hashlib.sha256((EXP/name).read_bytes()).hexdigest() for name in ['perf_ambiente.py','renderer.js','material-rgbm.js','node_modules/three/src/nodes/pmrem/PMREMNode.js','node_modules/three/src/renderers/common/extras/PMREMGenerator.js']},'cases':[]}
    try:
        with sync_playwright() as pw:
            for backend in ['webgpu','webgl']:
                browser=pw.chromium.launch(executable_path=CHROME,headless=True)
                context=browser.new_context(viewport={'width':1200,'height':900});page=context.new_page()
                row={'backend':backend,'errors':[],'candidates':[]};report['cases'].append(row)
                page.on('pageerror',lambda error:row['errors'].append(str(error)))
                page.goto(URL+f'prova-rgbm.html?backend={backend}&geometria=contorno',timeout=120000)
                page.wait_for_function('window.__livProva?.ready',timeout=120000)
                page.evaluate('''async()=>{const api=__livProva;await api.renderer.setAnimationLoop(null);
                  window.__qaEnvSource=api.scene.environment;
                  window.__qaFrame=async()=>{await new Promise(requestAnimationFrame);return api.capture(false);};}''')
                reference=capture(page,out/f'{backend}-referencia.png')
                orientations=[(False,False,False),(False,True,False),(True,False,False),(True,True,False),
                              (False,False,True),(False,True,True)]
                for flip_input,flip_output,cube_y in orientations:
                    data=page.evaluate('''async flip=>{
                      const api=__livProva,THREE=await import('three/webgpu'),source=__qaEnvSource;
                      const pixels=new Uint8Array(source.image.data),{width,height}=source.image;
                      if(flip.input){const row=width*4;for(let y=0;y<height;y++)pixels.set(source.image.data.subarray((height-1-y)*row,(height-y)*row),y*row);}
                      const input=new THREE.DataTexture(pixels,width,height,THREE.RGBAFormat);
                      input.mapping=THREE.EquirectangularReflectionMapping;input.colorSpace=THREE.SRGBColorSpace;input.needsUpdate=true;
                      const generator=new THREE.PMREMGenerator(api.renderer),target=generator.fromEquirectangular(input);
                      const readback=await api.renderer.readRenderTargetPixelsAsync(target,0,0,target.width,target.height);
                      if(!(readback instanceof Uint16Array))throw Error('Readback não retornou float16.');
                      const rowValues=target.width*4,rowBytes=rowValues*2;
                      const stride=api.renderer.backend.isWebGPUBackend?Math.ceil(rowBytes/256)*128:rowValues;
                      const expected=(target.height-1)*stride+rowValues;
                      if(readback.length!==expected)throw Error(`Readback: ${readback.length}, esperado ${expected}.`);
                      const buffer=new Uint16Array(target.width*target.height*4);
                      for(let y=0;y<target.height;y++){
                        const from=(flip.output?target.height-1-y:y)*stride;
                        buffer.set(readback.subarray(from,from+rowValues),y*rowValues);
                      }
                      // Reflect the sampling direction in the packed cube faces, without
                      // re-filtering the equirectangular source (which changes GGX samples).
                      if(flip.cubeY){
                        if(target.width!==336||target.height!==64)throw Error('Layout PMREM mudou.');
                        const copy=buffer.slice(),faces=[0,4,2,3,1,5],size=16;
                        for(let lod=0;lod<7;lod++)for(let face=0;face<6;face++){
                          const fromFace=faces[face];
                          for(let y=0;y<size;y++)for(let x=0;x<size;x++){
                            const dst=((Math.floor(face/3)*size+y)*target.width+lod*48+(face%3)*size+x)*4;
                            const src=((Math.floor(fromFace/3)*size+size-1-y)*target.width+lod*48+(fromFace%3)*size+x)*4;
                            buffer.set(copy.subarray(src,src+4),dst);
                          }
                        }
                      }
                      const texture=new THREE.DataTexture(buffer,target.width,target.height,THREE.RGBAFormat,THREE.HalfFloatType);
                      texture.mapping=THREE.CubeUVReflectionMapping;texture.colorSpace=THREE.LinearSRGBColorSpace;
                      texture.minFilter=texture.magFilter=THREE.LinearFilter;texture.generateMipmaps=false;texture.needsUpdate=true;
                      api.scene.environment=texture;
                      api.scene.traverse(o=>{for(const m of o.material?(Array.isArray(o.material)?o.material:[o.material]):[])m.needsUpdate=true;});
                      await api.renderer.compileAsync(api.scene,api.camera);await __qaFrame();
                      let binary='';for(let i=0;i<buffer.byteLength;i+=8192)binary+=String.fromCharCode(...new Uint8Array(buffer.buffer,i,Math.min(8192,buffer.byteLength-i)));
                      window.__qaEnvCandidate=texture;target.dispose();generator.dispose();input.dispose();
                      return {width:texture.image.width,height:texture.image.height,bytes:buffer.byteLength,readbackBytes:readback.byteLength,base64:btoa(binary)};
                    }''',{'input':flip_input,'output':flip_output,'cubeY':cube_y})
                    label=f'{backend}-input-{int(flip_input)}-output-{int(flip_output)}-cube-{int(cube_y)}'
                    candidate=capture(page,out/f'{label}.png')
                    raw=base64.b64decode(data.pop('base64'));(out/f'{label}.f16').write_bytes(raw)
                    data.update({'flipInput':flip_input,'flipOutput':flip_output,'cubeY':cube_y,'maxRgbDelta':float(np.abs(candidate-reference).max()),
                      'meanRgbDelta':float(np.abs(candidate-reference).mean()),'sha256':hashlib.sha256(raw).hexdigest()})
                    row['candidates'].append(data)
                    page.evaluate('()=>{__livProva.scene.environment=__qaEnvSource;__qaEnvCandidate.dispose();}')
                assert not row['errors'],row['errors']
                page.evaluate('async()=>{await __livProva.dispose();}');context.close();browser.close()
                print(json.dumps(row),flush=True)
        report['status']='PASS'
    except Exception as error:report['status']='FAIL';report['failure']=str(error);raise
    finally:
        (out/'runtime.json').write_text(json.dumps(report,indent=2),encoding='utf-8')


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--saida',type=Path,required=True)
    run(parser.parse_args().saida)

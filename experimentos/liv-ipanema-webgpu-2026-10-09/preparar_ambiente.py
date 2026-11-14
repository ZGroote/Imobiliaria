"""Exporta o PMREM do gradiente original para CubeUV externo, sem alterar materiais."""
import argparse
import base64
import gzip
import hashlib
import json
from pathlib import Path

from playwright.sync_api import sync_playwright

EXP=Path(__file__).resolve().parent
URL='http://127.0.0.1:8790/experimentos/liv-ipanema-webgpu-2026-10-09/'
CHROME=r'C:\Program Files\Google\Chrome\Application\chrome.exe'


def prepare(output):
    with sync_playwright() as pw:
        browser=pw.chromium.launch(executable_path=CHROME,headless=True)
        page=browser.new_page(viewport={'width':720,'height':600})
        page.goto(URL+'prova-rgbm.html?backend=webgpu&geometria=contorno&ambiente=procedural',timeout=120000)
        page.wait_for_function('window.__livProva?.ready',timeout=120000)
        result=page.evaluate('''async()=>{
          const api=__livProva,THREE=await import('three/webgpu');
          await api.renderer.setAnimationLoop(null);
          if(api.backend!=='webgpu')throw Error('Geração exige WebGPU nativo.');
          const source=api.scene.environment;
          if(source.mapping!==THREE.EquirectangularReflectionMapping)throw Error('Ambiente de origem já pré-calculado.');
          const generator=new THREE.PMREMGenerator(api.renderer),target=generator.fromEquirectangular(source);
          try{
            if(target.width!==336||target.height!==64)throw Error('Layout PMREM mudou.');
            const readback=await api.renderer.readRenderTargetPixelsAsync(target,0,0,336,64);
            const stride=Math.ceil(336*8/256)*128,row=336*4;
            if(!(readback instanceof Uint16Array)||readback.length!==63*stride+row)throw Error('Readback PMREM inesperado.');
            const packed=new Uint16Array(336*64*4);
            for(let y=0;y<64;y++)packed.set(readback.subarray(y*stride,y*stride+row),y*row);
            // PMREMNode flips direction.y for render targets, but not authored
            // DataTextures. Reflect every 16px cube face and swap +Y/-Y.
            // Reorder pixels after filtering to preserve the original GGX result.
            const copy=packed.slice(),faces=[0,4,2,3,1,5];
            for(let lod=0;lod<7;lod++)for(let face=0;face<6;face++)for(let y=0;y<16;y++)for(let x=0;x<16;x++){
              const fromFace=faces[face];
              const dst=((Math.floor(face/3)*16+y)*336+lod*48+(face%3)*16+x)*4;
              const src=((Math.floor(fromFace/3)*16+15-y)*336+lod*48+(fromFace%3)*16+x)*4;
              packed.set(copy.subarray(src,src+4),dst);
            }
            const encode=bytes=>{let s='';for(let i=0;i<bytes.length;i+=8192)s+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(s);};
            const bytes=new Uint8Array(packed.byteLength),view=new DataView(bytes.buffer);
            for(let i=0;i<packed.length;i++)view.setUint16(i*2,packed[i],true);
            return {runtime:THREE.REVISION,raw:encode(bytes),source:encode(source.image.data),
              sourceWidth:source.image.width,sourceHeight:source.image.height};
          }finally{target.dispose();generator.dispose();}
        }''')
        page.evaluate('async()=>{await __livProva.dispose();}')
        browser.close()
    raw=base64.b64decode(result.pop('raw'));source=base64.b64decode(result.pop('source'))
    assert len(raw)==172032 and len(source)==64*32*4
    compressed=gzip.compress(raw,compresslevel=9,mtime=0)
    output.mkdir(parents=True,exist_ok=True)
    name='ambiente.f16.gz';(output/name).write_bytes(compressed)
    manifest={'schema':'liv-pmrem-v1',**result,'width':336,'height':64,'format':'rgba-f16-le-cubeuv',
      'sourceRGBA_SHA256':hashlib.sha256(source).hexdigest(),'rawSHA256':hashlib.sha256(raw).hexdigest(),
      'file':{'name':name,'bytes':len(compressed),'sha256':hashlib.sha256(compressed).hexdigest()},
      'recipeSHA256':{name:hashlib.sha256((EXP/name).read_bytes()).hexdigest() for name in
        ['preparar_ambiente.py','ambiente.js','node_modules/three/build/three.webgpu.js',
         'node_modules/three/src/nodes/pmrem/PMREMNode.js','node_modules/three/src/renderers/common/extras/PMREMGenerator.js']}}
    (output/'manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
    print(json.dumps({'output':str(output),'rawBytes':len(raw),'compressedBytes':len(compressed),'sha256':manifest['rawSHA256']}))


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--saida',type=Path,default=EXP/'assets-ambiente')
    prepare(parser.parse_args().saida)

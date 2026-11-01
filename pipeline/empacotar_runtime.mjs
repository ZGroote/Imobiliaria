// Caminho comum aos pacotes de maquete gerados: inclui o interior nas mesmas dependências compartilhadas.
import {build} from 'esbuild';
import {join} from 'node:path';

export function empacotarRuntime(dir,three){
  return build({
    entryPoints:{'viewer.bundle':join(dir,'viewer.js'),'renderer.bundle':join(dir,'renderer.js'),
      'interior-renderer.bundle':join(dir,'interior-renderer.js')},
    outdir:dir,bundle:true,splitting:true,format:'esm',target:'es2022',minify:true,charset:'utf8',
    chunkNames:'chunk-[hash]',metafile:true,legalComments:'eof',sourcemap:'linked',sourcesContent:false,
    alias:{'three/webgpu':join(three,'build/three.webgpu.js'),'three/tsl':join(three,'build/three.tsl.js'),
      three:join(three,'build/three.webgpu.js'),'three/addons':join(three,'examples/jsm')},
    external:['./estoque-runtime.js'],
  });
}

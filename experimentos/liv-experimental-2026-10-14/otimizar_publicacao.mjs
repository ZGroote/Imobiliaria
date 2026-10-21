// Otimiza a cópia publicada da maquete (não a fonte): empacota e minifica o JS das duas
// páginas da abertura, corta o que não é usado do three, gera source map sem o código-fonte
// dentro, embute o CSS no HTML e pré-carrega o que antes vinha em sequência.
//   node otimizar_publicacao.mjs <pasta publicada, ex.: payload/liv-classico>
// Os módulos originais ficam na pasta: interior.html e materiais.html continuam usando-os.
import {build,transform} from 'esbuild';
import {readFileSync,writeFileSync} from 'node:fs';
import {join,basename,resolve} from 'node:path';

const dir=resolve(process.argv[2]??'');
if(!process.argv[2])throw Error('uso: node otimizar_publicacao.mjs <pasta publicada>');
const three=join(dir,'node_modules/three');
const read=name=>readFileSync(join(dir,name),'utf8');
const replaceOnce=(text,from,to)=>{
  if(text.split(from).length!==2)throw Error(`esperava 1 ocorrência de ${from}`);
  return text.replace(from,()=>to);
};

const result=await build({
  entryPoints:{'viewer.bundle':join(dir,'viewer.js'),'renderer.bundle':join(dir,'renderer.js')},
  outdir:dir,bundle:true,splitting:true,format:'esm',target:'es2022',minify:true,charset:'utf8',
  // import.meta.url das fontes aponta para a mesma pasta dos pacotes: os caminhos relativos seguem valendo.
  chunkNames:'chunk-[hash]',metafile:true,legalComments:'eof',
  sourcemap:'linked',sourcesContent:false,
  alias:{'three/webgpu':join(three,'build/three.webgpu.js'),'three/tsl':join(three,'build/three.tsl.js'),three:join(three,'build/three.webgpu.js'),
    'three/addons':join(three,'examples/jsm')},
  // SDK de estoque já é um pacote próprio e só carrega sob demanda.
  external:['./estoque-runtime.js'],
});

const outputs=result.metafile.outputs;
const output=entry=>Object.keys(outputs).find(path=>outputs[path].entryPoint&&basename(outputs[path].entryPoint)===entry);
const preloads=entry=>outputs[output(entry)].imports.filter(i=>i.kind==='import-statement'&&!i.external).map(i=>basename(i.path));
const css=async name=>(await transform(read(name),{loader:'css',minify:true})).code.trim();

let page=read('maquete-liv-ipanema.html');
page=replaceOnce(page,'<link rel="stylesheet" href="unit-ui.css">',`<style>${await css('unit-ui.css')}</style>`);
page=replaceOnce(page,/<link rel="stylesheet" href="viewer-ui\.css[^"]*">/.exec(page)?.[0],`<style>${await css('viewer-ui.css')}</style>`);
page=replaceOnce(page,/<script type="module" src="viewer\.js[^"]*"><\/script>/.exec(page)?.[0],
  [...preloads('viewer.js'),'../analytics/liv-analytics-classico.mjs','../analytics/metricas.mjs'].map(href=>`<link rel="modulepreload" href="${href}">`).join('')+
  '<script type="module" src="viewer.bundle.js"></script>');
writeFileSync(join(dir,'maquete-liv-ipanema.html'),page);

let frame=read('prova-rgbm.html');
frame=frame.replace(/<script type="importmap">[^<]*<\/script>\n?/,'');
frame=replaceOnce(frame,/<script type="module" src="renderer\.js[^"]*"><\/script>/.exec(frame)?.[0],
  preloads('renderer.js').map(href=>`<link rel="modulepreload" href="${href}">`).join('')+'<script type="module" src="renderer.bundle.js"></script>');
writeFileSync(join(dir,'prova-rgbm.html'),frame);

// Workers não entram no pacote (o esbuild não segue new Worker): minificados no lugar.
// O SDK do estoque já sai minificado, mas com as licenças do Firebase repetidas no meio do
// código; elas vão para um arquivo ao lado, citado no topo.
for(const name of ['decodificar-worker.js','transfer-worker.js']){
  writeFileSync(join(dir,name),(await transform(read(name),{loader:'js',minify:true,charset:'utf8',legalComments:'none'})).code);
}
const stockHeader='/*! Licenças: estoque-runtime.js.LEGAL.txt */\n';
if(!read('estoque-runtime.js').startsWith(stockHeader)){
  const stock=await transform(read('estoque-runtime.js'),{loader:'js',format:'esm',minify:true,charset:'utf8',legalComments:'external'});
  writeFileSync(join(dir,'estoque-runtime.js.LEGAL.txt'),stock.legalComments);
  writeFileSync(join(dir,'estoque-runtime.js'),stockHeader+stock.code);
}

for(const [path,{bytes}] of Object.entries(outputs))if(path.endsWith('.js'))console.log(basename(path),bytes);

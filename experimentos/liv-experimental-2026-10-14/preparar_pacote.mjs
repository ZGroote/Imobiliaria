// Regenera o runtime sobre uma release preservada, sem perder dados, HTML ou ajustes já publicados.
// node preparar_pacote.mjs <base liv-classico> <novo destino>
import {cp,mkdir,readFile,readdir,writeFile} from 'node:fs/promises';
import {resolve,relative,isAbsolute,sep,join,dirname,basename} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {empacotarRuntime} from '../../pipeline/empacotar_runtime.mjs';
import {prepararInteriores} from '../../pipeline/preparar_interiores.mjs';

const source=dirname(fileURLToPath(import.meta.url)),root=resolve(source,'../..');
if(process.argv.length!==4)throw Error('uso: node preparar_pacote.mjs <base liv-classico> <novo destino>');
const base=resolve(process.argv[2]),out=resolve(process.argv[3]);
const fromBase=relative(base,out);
if(!fromBase||fromBase!=='..'&&!fromBase.startsWith('..'+sep)&&!isAbsolute(fromBase))throw Error('O destino deve ser independente da base.');
await mkdir(out,{recursive:true});if((await readdir(out)).length)throw Error('Destino ocupado.');
await cp(base,out,{recursive:true,filter:path=>!path.split(/[\\/]/).includes('node_modules')});
for(const name of ['viewer.js','renderer.js','interior-renderer.js','interior-navigation.js','interior-melhorias.js',
  'interior-luz-horario.js','material-rgbm.js','classic-renderer.js','classic-lighting.js','probe-code.js','interior-look.js','interior-geometry.js','prepared-scene.js','prepared-hdr.js','horario-interior.js','shader-scheduler.js','transfers.js','transfer-worker.js'])await cp(join(source,name),join(out,name));
console.log(JSON.stringify({prepared:await prepararInteriores(out)}));
const result=await empacotarRuntime(out,join(source,'node_modules/three'));
const rewrite=(html,entry)=>{
  const output=Object.values(result.metafile.outputs).find(o=>o.entryPoint&&basename(o.entryPoint)===entry+'.js');
  const preload=output.imports.filter(i=>i.kind==='import-statement'&&!i.external).map(i=>`<link rel="modulepreload" href="${basename(i.path)}">`).join('');
  return html.replace(/<link rel="modulepreload" href="chunk-[^"]+">/g,'').replace(new RegExp(`<script type="module" src="${entry}\\.bundle\\.js"></script>`),preload+`<script type="module" src="${entry}.bundle.js"></script>`);
};
for(const [name,entry]of [['maquete-liv-ipanema.html','viewer'],['prova-rgbm.html','renderer'],['interior.html','interior-renderer']])
  await writeFile(join(out,name),rewrite(await readFile(join(out,name),'utf8'),entry));
const publicEntry=join(base,'../maquetes/liv/index.html');
try{await writeFile(join(dirname(out),'maquetes-liv-index.html'),rewrite(await readFile(publicEntry,'utf8'),'viewer'));}
catch(error){if(error.code!=='ENOENT')throw error;}
execFileSync('python',['-m','pipeline.transfer_manifest',out],{cwd:root,stdio:'pipe'});
const files={};async function walk(dir){for(const e of await readdir(dir,{withFileTypes:true})){
  const p=join(dir,e.name);if(e.isDirectory())await walk(p);else{const data=await readFile(p);files[p.slice(out.length+1).replaceAll('\\','/')]={bytes:data.length,sha256:createHash('sha256').update(data).digest('hex')};}
}}await walk(out);
await writeFile(join(dirname(out),'inventario-liv.json'),JSON.stringify({base,files},null,2)+'\n');
console.log(JSON.stringify({out,files:Object.keys(files).length}));

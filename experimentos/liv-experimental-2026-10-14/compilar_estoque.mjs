import { build } from 'esbuild';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const root=new URL('./',import.meta.url);
const args=process.argv.slice(2);
if(args.length && (args.length!==1 || args[0]!=='--laranjeiras'))throw Error('Use --laranjeiras para compilar o leitor do Laranjeiras, ou nenhum argumento para o LIV.');
const laranjeiras=args[0]==='--laranjeiras';
const result=await build({entryPoints:[fileURLToPath(new URL('estoque-publico-src.ts',root))],bundle:true,format:'esm',platform:'browser',target:'es2022',minify:true,legalComments:'inline',metafile:true,write:false});
const data=result.outputFiles[0].contents,sha=v=>createHash('sha256').update(v).digest('hex');
const path=laranjeiras?'../laranjeiras-2026-10-30/site/estoque-runtime.js':'estoque-runtime.js';
await writeFile(new URL(path,root),data);
if(!laranjeiras){
  const files={};for(const name of Object.keys(result.metafile.inputs)){const raw=await readFile(name);files[name.replaceAll('\\','/')]={bytes:raw.length,sha256:sha(raw)};}
  await writeFile(new URL('estoque-build.json',root),JSON.stringify({schema:'liv-sales-bundle-v1',file:{path,bytes:data.length,sha256:sha(data)},sources:files},null,2)+'\n');
}
console.log(JSON.stringify({status:'PASS',path,bytes:data.length,sha256:sha(data),inputs:Object.keys(result.metafile.inputs).length}));

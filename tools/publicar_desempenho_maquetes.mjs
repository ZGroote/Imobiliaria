// Publicação preservando o inventário/configuração integral do Hosting compartilhado.
// node tools/publicar_desempenho_maquetes.mjs <pacotes> <evidências> [--publicar|--desfazer]
import {createRequire} from 'node:module';
import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {join,resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {Readable} from 'node:stream';
import assert from 'node:assert/strict';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const require=createRequire(join(root,'package.json'));
const auth=require('firebase-tools/lib/auth.js'),{requireAuth}=require('firebase-tools/lib/requireAuth.js');
const {Client}=require('firebase-tools/lib/apiv2.js'),hosting=require('firebase-tools/lib/hosting/api.js');
const project='imobilaria-deccb',site='imobilaria-deccb-miniaturas',origin='https://conectaimoveis3d.com.br';
const [input,evidence]=process.argv.slice(2);assert(input&&evidence,'Informe os pacotes e a pasta de evidências.');
const packages=resolve(input),out=resolve(evidence),sha=bytes=>createHash('sha256').update(bytes).digest('hex');
await mkdir(out,{recursive:true});
await requireAuth({project,nonInteractive:true,...auth.getProjectDefaultAccount(process.cwd())});
const api=new Client({urlPrefix:'https://firebasehosting.googleapis.com',apiVersion:'v1beta1',auth:true});
async function list(version){
  const files={};let pageToken;
  do{
    const result=(await api.get('/'+version+'/files',{queryParams:{pageSize:1000,...(pageToken?{pageToken}:{})}})).body;
    for(const file of result.files??[])files[file.path]=file.hash;
    pageToken=result.nextPageToken;
  }while(pageToken);return files;
}
const version=(await hosting.getChannel(project,site,'live')).release.version.name;
const json=async(name,value)=>writeFile(join(out,name),JSON.stringify(value,null,2)+'\n');
if(process.argv.includes('--desfazer')){
  const published=JSON.parse(await readFile(join(out,'publicado.json'),'utf8'));
  assert.equal(version.split('/').at(-1),published.version.split('/').at(-1),'Há publicação posterior; não desfazer alterações de outra sessão.');
  const release=await hosting.createRelease(site,'live',published.previousVersion,{});
  await json('desfeito.json',{version:published.previousVersion,release:release.name,at:new Date().toISOString()});
  console.log('Versão anterior restaurada.');process.exit(0);
}
const config=(await api.get('/'+version)).body.config,files=await list(version);
assert(files['/liv-classico/viewer.bundle.js'],'O LIV deve existir no site selecionado.');
const raw=new Map();
async function add(prefix,name){raw.set('/'+prefix+'/'+name,await readFile(join(packages,prefix,name)));}
const sources=['viewer.js','interior-renderer.js','interior-navigation.js','interior-melhorias.js',
  'interior-luz-horario.js','horario-interior.js','transfers.js','transfer-worker.js','transfer-manifest.json'];
for(const name of sources)await add('liv-classico',name);
// Só os chunks referidos pelos novos bundles: conservar os antigos para HTML/abas já abertos.
async function bundle(name){
  if(raw.has('/liv-classico/'+name))return;
  await add('liv-classico',name);await add('liv-classico',name+'.map');
  const code=raw.get('/liv-classico/'+name).toString();
  for(const match of code.matchAll(/["']\.\/(chunk-[A-Z0-9]+\.js)["']/g))await bundle(match[1]);
}
for(const name of ['viewer.bundle.js','renderer.bundle.js','interior-renderer.bundle.js'])await bundle(name);
async function walk(dir,relative=''){
  for(const entry of await readdir(dir,{withFileTypes:true})){
    const name=relative+entry.name;
    if(entry.isDirectory())await walk(join(dir,entry.name),name+'/');else await add('laranjeiras',name);
  }
}
await walk(join(packages,'laranjeiras'));
const proposed={...files},uploads=new Map(),inventory={};
for(const [path,bytes]of raw){
  const packed=gzipSync(bytes,{level:9}),hash=sha(packed);
  proposed[path]=hash;uploads.set(hash,packed);inventory[path]={bytes:bytes.length,sha256:sha(bytes),hostingHash:hash};
}
const changed=Object.keys(inventory).filter(path=>proposed[path]!==files[path]);
if(!process.argv.includes('--publicar')){
  // Fonte preservada que foi usada pelo empacotador, para detectar publicações não incorporadas.
  const base=JSON.parse(await readFile(join(packages,'inventario-liv.json'),'utf8')).base;
  const checks=[];
  for(const path of Object.keys(inventory).filter(path=>path.startsWith('/liv-classico/')&&!path.endsWith('.map'))){
    if(!files[path])continue;
    const response=await fetch(origin+path,{cache:'no-store'});assert.equal(response.status,200,path);
    const current=sha(Buffer.from(await response.arrayBuffer()));
    let previous=null;try{previous=sha(await readFile(join(base,path.slice('/liv-classico/'.length))));}catch(e){if(e.code!=='ENOENT')throw e;}
    assert(current===inventory[path].sha256||current===previous,'O LIV publicado difere da base preservada: '+path);
    checks.push({path,current,base:previous});
  }
  await json('preflight.json',{version,config,files,inventory,changed,checks,at:new Date().toISOString()});
  console.log(JSON.stringify({mode:'preflight',version,total:Object.keys(files).length,packageFiles:raw.size,changed:changed.length,
    uploadMiB:+([...uploads].filter(([hash])=>!new Set(Object.values(files)).has(hash)).reduce((n,[,b])=>n+b.length,0)/2**20).toFixed(2)}));
  process.exit(0);
}
const before=JSON.parse(await readFile(join(out,'preflight.json'),'utf8'));
assert.equal(version,before.version,'Houve outra publicação depois da conferência.');
assert.deepEqual(config,before.config);assert.deepEqual(files,before.files);assert.deepEqual(inventory,before.inventory,'O pacote mudou depois da conferência.');
const next=await hosting.createVersion(site,{config,labels:{deployment:'liv-laranjeiras-desempenho-20261031'}});
const entries=Object.entries(proposed),required=new Set();let uploadUrl;
for(let i=0;i<entries.length;i+=1000){
  const result=(await api.post('/'+next+':populateFiles',{files:Object.fromEntries(entries.slice(i,i+1000))})).body;
  for(const hash of result.uploadRequiredHashes??[])required.add(hash);uploadUrl=result.uploadUrl||uploadUrl;
}
for(const hash of required)assert(uploads.has(hash),'O Hosting solicitou arquivo fora do pacote.');
console.log(JSON.stringify({created:next,uploadFiles:required.size,total:entries.length}));
const queue=[...required];let done=0;
await Promise.all(Array.from({length:4},async()=>{
  const upload=new Client({urlPrefix:uploadUrl,auth:true});
  while(queue.length){
    const hash=queue.shift();await upload.post('/'+hash,Readable.from(uploads.get(hash)),{headers:{'Content-Type':'application/octet-stream'}});
    done++;if(done%20===0||done===required.size)console.log('Enviados '+done+'/'+required.size);
  }
}));
const finalized=await hosting.updateVersion(site,next.split('/').at(-1),{status:'FINALIZED'});
assert.equal((await hosting.getChannel(project,site,'live')).release.version.name,version,'Outra sessão publicou durante o envio.');
const release=await hosting.createRelease(site,'live',finalized.name,{});
await json('publicado.json',{version:finalized.name,previousVersion:version,release:release.name,changed:changed.length,
  packageFiles:raw.size,uploaded:required.size,at:new Date().toISOString()});
const after=await list(finalized.name);assert.deepEqual(after,proposed);
for(const [path,hash]of Object.entries(files))if(!raw.has(path))assert.equal(after[path],hash,'Conteúdo externo alterado: '+path);
await json('integridade-hosting.json',{status:'PASS',version:finalized.name,total:Object.keys(after).length,
  untouched:Object.keys(files).filter(path=>!raw.has(path)).length,configPreserved:true});
const checks=[];
for(const path of Object.keys(inventory).filter(path=>changed.includes(path)&&(/\.js$|manifest\.json$|catalogo\.json$|index\.html$/.test(path)))){
  const response=await fetch(origin+path,{cache:'no-store'});assert.equal(response.status,200,path);
  assert.equal(sha(Buffer.from(await response.arrayBuffer())),inventory[path].sha256,'Resposta pública difere do pacote: '+path);
  checks.push(path);
}
for(const path of ['/','/maquetes/liv/','/laranjeiras/','/checkup/liv.html']){
  const response=await fetch(origin+path,{cache:'no-store'});assert.equal(response.status,200,path);checks.push(path);
}
await json('http-publico.json',{status:'PASS',checks});
console.log(JSON.stringify({status:'PASS',version:finalized.name,changed:changed.length,untouched:Object.keys(files).filter(path=>!raw.has(path)).length}));

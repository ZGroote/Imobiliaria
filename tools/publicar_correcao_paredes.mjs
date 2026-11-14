// Prepara e publica somente a correção das paredes sobre o Hosting atual, preservando seus demais arquivos.
// node tools/publicar_correcao_paredes.mjs [--publicar|--desfazer]
import {createRequire} from 'node:module';
import {readFile,writeFile,mkdir,readdir,copyFile} from 'node:fs/promises';
import {resolve,join,dirname,basename} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {Readable} from 'node:stream';
import assert from 'node:assert/strict';
import {empacotarRuntime} from '../pipeline/empacotar_runtime.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),require=createRequire(join(root,'package.json'));
const auth=require('firebase-tools/lib/auth.js'),{requireAuth}=require('firebase-tools/lib/requireAuth.js');
const {Client}=require('firebase-tools/lib/apiv2.js'),hosting=require('firebase-tools/lib/hosting/api.js');
const project='imobilaria-deccb',site='imobilaria-deccb-miniaturas',origin='https://conectaimoveis3d.com.br';
const out=join(root,'publicacao/correcao-vergas-20261101'),payload=join(out,'payload'),work=join(out,'fontes-liv');
const source=join(root,'experimentos/liv-experimental-2026-10-14');
const base=join(root,'publicacao/qa-liv-laranjeiras-corredor-20261101/pacotes/liv-classico');
const three=join(source,'node_modules/three');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const json=async(path,value)=>{await mkdir(dirname(path),{recursive:true});await writeFile(path,JSON.stringify(value,null,2)+'\n');};
await mkdir(out,{recursive:true});
await requireAuth({project,nonInteractive:true,...auth.getProjectDefaultAccount(process.cwd())});
const api=new Client({urlPrefix:'https://firebasehosting.googleapis.com',apiVersion:'v1beta1',auth:true});
const live=async()=>(await hosting.getChannel(project,site,'live')).release.version.name;
const version=await live();
async function list(name){
 const files={};let pageToken;
 do{const response=(await api.get('/'+name+'/files',{queryParams:{pageSize:1000,...(pageToken?{pageToken}:{})}})).body;
  for(const file of response.files??[])files[file.path]=file.hash;pageToken=response.nextPageToken;
 }while(pageToken);return files;
}
if(process.argv.includes('--desfazer')){
 const published=JSON.parse(await readFile(join(out,'publicado.json'),'utf8'));
 assert.equal(version.split('/').at(-1),published.version.split('/').at(-1),'Há publicação posterior; nada foi desfeito.');
 const release=await hosting.createRelease(site,'live',published.previousVersion,{});
 await json(join(out,'desfeito.json'),{version:published.previousVersion,release:release.name});
 console.log('Restaurada a versão anterior.');process.exit(0);
}
const config=(await api.get('/'+version)).body.config,files=await list(version);
const raw=new Map();
async function publicBytes(path){
 const response=await fetch(origin+path+'?vergas-base='+version.split('/').at(-1),{cache:'no-store'});
 assert.equal(response.status,200,path);const bytes=Buffer.from(await response.arrayBuffer());
 assert.equal(sha(gzipSync(bytes,{level:9})),files[path],'A resposta pública não corresponde à versão atual: '+path);
 return bytes;
}
async function add(path,bytes){
 assert(/^\/(liv-classico|laranjeiras)\//.test(path)&&!path.split('/').includes('..'),'Destino fora da correção');
 const destination=join(payload,path.slice(1));await mkdir(dirname(destination),{recursive:true});await writeFile(destination,bytes);raw.set(path,bytes);
}
if(!process.argv.includes('--publicar')){
 assert(files['/liv-classico/interior-renderer.bundle.js']&&files['/laranjeiras/interior-renderer.bundle.js'],'Site incorreto');
 await mkdir(work,{recursive:true});
 // Fontes ausentes no inventário público vêm da cópia preservada. As que estão publicadas são lidas da versão atual.
 for(const entry of await readdir(base,{withFileTypes:true}))if(entry.isFile()&&entry.name.endsWith('.js')&&!/^(chunk-|.*\.bundle\.)/.test(entry.name))await copyFile(join(base,entry.name),join(work,entry.name));
 const paths=Object.keys(files).filter(path=>/^\/liv-classico\/[^/]+\.js$/.test(path)&&!/\/(chunk-|[^/]+\.bundle\.)/.test(path));
 const queue=[...paths];
 await Promise.all(Array.from({length:4},async()=>{while(queue.length){const path=queue.shift();await writeFile(join(work,basename(path)),await publicBytes(path));}}));
 const contact='/liv-classico/contato-publico.json';
 await writeFile(join(work,'contato-publico.json'),files[contact]?await publicBytes(contact):await readFile(join(base,'contato-publico.json')));
 const normalize=text=>text.replaceAll('\r\n','\n');
 let material=normalize(await readFile(join(work,'material-rgbm.js'),'utf8'));
 const fresh=normalize(await readFile(join(source,'material-rgbm.js'),'utf8'));
 const start='export function createTimeIrradiance(',end='// Equal RGBM expressions';
 assert(material.includes(start)&&material.includes(end)&&fresh.includes(start)&&fresh.includes(end));
 material=material.slice(0,material.indexOf(start))+fresh.slice(fresh.indexOf(start),fresh.indexOf(end))+material.slice(material.indexOf(end));
 material=material.replace(/import \{([^}]+)\} from 'three\/tsl';/,(_,names)=>{
  const all=names.split(',').map(x=>x.trim());for(const name of ['floor','fract','mix'])if(!all.includes(name))all.push(name);
  return `import {${all.join(', ')}} from 'three/tsl';`;
 });
 let temporal=normalize(await readFile(join(work,'interior-luz-horario.js'),'utf8'));
 if(!temporal.includes('texture.minFilter=texture.magFilter=THREE.NearestFilter;')){
  const needle='const texture=own(createRGBMTexture(bytes,manifest));texture.name=`LIV luz gravada · ${id}`;';
  assert.equal(temporal.split(needle).length,2,'A fonte publicada do atlas mudou');
  temporal=temporal.replace(needle,needle+'\n      texture.minFilter=texture.magFilter=THREE.NearestFilter; // o shader interpola depois de decodificar RGBM');
 }
 await writeFile(join(work,'material-rgbm.js'),material);await writeFile(join(work,'interior-luz-horario.js'),temporal);
 for(const name of ['material-rgbm.js','interior-luz-horario.js'])await add('/liv-classico/'+name,await readFile(join(work,name)));
 assert.equal(JSON.parse(await readFile(join(three,'package.json'),'utf8')).version,'0.186.1');
 await empacotarRuntime(work,three);
 async function bundle(name){
  if(raw.has('/liv-classico/'+name))return;
  const bytes=await readFile(join(work,name));await add('/liv-classico/'+name,bytes);await add('/liv-classico/'+name+'.map',await readFile(join(work,name+'.map')));
  for(const match of bytes.toString().matchAll(/["']\.\/(chunk-[A-Z0-9]+\.js)["']/g))await bundle(match[1]);
 }
 await bundle('interior-renderer.bundle.js');
 const imports=[...new Set([...raw.get('/liv-classico/interior-renderer.bundle.js').toString().matchAll(/import\{[^}]*\}from"\.\/(chunk-[A-Z0-9]+\.js)"/g)].map(match=>match[1]))];
 assert(imports.length,'Dependências estáticas do interior ausentes');
 const before=await publicBytes('/liv-classico/interior.html'),strip=html=>html.replace(/<link rel="modulepreload"[^>]*>/g,'');
 const html=strip(before.toString()).replace('<script type="module" src="interior-renderer.bundle.js"></script>',imports.map(name=>`<link rel="modulepreload" href="${name}">`).join('')+'<script type="module" src="interior-renderer.bundle.js"></script>');
 assert.equal(strip(html),strip(before.toString()));await add('/liv-classico/interior.html',Buffer.from(html));
 for(const [prefix,local]of [['liv-classico',source],['laranjeiras',join(root,'experimentos/laranjeiras-2026-10-30/site')]]){
  const catalog=JSON.parse(await publicBytes('/'+prefix+'/interiores/catalogo.json'));
  for(const [typology,record]of Object.entries(catalog.tipologias)){
   const path=`interiores/${typology}/luz-horario/manifest.json`,bytes=await readFile(join(local,path)),manifest=JSON.parse(bytes);
   assert.equal(manifest.wallDenoise,'surface-plane-v1');assert.equal(manifest.sourceSHA256,record.sourceSHA256);
   assert.equal(manifest.geometrySHA256,record.files.compact.decodedSHA256);
   const previous=JSON.parse(await publicBytes('/'+prefix+'/'+path));
   assert.equal(previous.sourceSHA256,manifest.sourceSHA256);assert.equal(previous.geometrySHA256,manifest.geometrySHA256);
   const metadata=({keys,night,wallDenoise,...rest})=>rest;
   assert.deepEqual(metadata(manifest),metadata(previous),'Os parâmetros da luz publicada mudaram');
   const oldEntries=new Map([...previous.keys,previous.night].map(entry=>[entry.id,entry]));
   assert.deepEqual([...manifest.keys,manifest.night].map(entry=>entry.id).sort(),[...oldEntries.keys()].sort(),'Os horários publicados mudaram');
   for(const entry of [...manifest.keys,manifest.night]){
    assert.deepEqual(entry.probes,oldEntries.get(entry.id)?.probes,'As sondas publicadas mudaram');
    const texture=await readFile(join(local,entry.path));assert.equal(texture.length,entry.bytes);assert.equal(sha(texture),entry.sha256);
    await add('/'+prefix+'/'+entry.path,texture);
   }
   await add('/'+prefix+'/'+path,bytes);
  }
 }
 assert.equal(await live(),version,'Houve outra publicação durante a preparação');
}else{
 const plan=JSON.parse(await readFile(join(out,'preflight.json'),'utf8'));
 assert.equal(version.split('/').at(-1),plan.version.split('/').at(-1),'Houve outra publicação depois da preparação');
 assert.deepEqual(config,plan.config);assert.deepEqual(files,plan.files);
 for(const [path,entry]of Object.entries(plan.inventory)){
  const bytes=await readFile(join(payload,path.slice(1)));assert.equal(sha(bytes),entry.sha256,'Pacote alterado: '+path);raw.set(path,bytes);
 }
}
const proposed={...files},uploads=new Map(),inventory={};
for(const [path,bytes]of raw){const packed=gzipSync(bytes,{level:9}),hash=sha(packed);proposed[path]=hash;uploads.set(hash,packed);inventory[path]={bytes:bytes.length,sha256:sha(bytes),hostingHash:hash};}
const changed=Object.keys(inventory).filter(path=>files[path]!==proposed[path]);
if(!process.argv.includes('--publicar')){
 await json(join(out,'preflight.json'),{version,config,files,inventory,changed,at:new Date().toISOString()});
 console.log(JSON.stringify({mode:'preflight',version,files:raw.size,changed:changed.length,preserved:Object.keys(files).filter(path=>!raw.has(path)).length}));process.exit(0);
}
const next=await hosting.createVersion(site,{config,labels:{deployment:'vergas-paredes-20261101'}});
const entries=Object.entries(proposed),required=new Set();let uploadUrl;
for(let i=0;i<entries.length;i+=1000){const response=(await api.post('/'+next+':populateFiles',{files:Object.fromEntries(entries.slice(i,i+1000))})).body;
 for(const hash of response.uploadRequiredHashes??[])required.add(hash);uploadUrl=response.uploadUrl||uploadUrl;
}
for(const hash of required)assert(uploads.has(hash),'O Hosting solicitou recurso fora da correção');
const queue=[...required];let done=0;
await Promise.all(Array.from({length:4},async()=>{const upload=new Client({urlPrefix:uploadUrl,auth:true});while(queue.length){const hash=queue.shift();await upload.post('/'+hash,Readable.from(uploads.get(hash)),{headers:{'Content-Type':'application/octet-stream'}});done++;if(done%20===0||done===required.size)console.log(`Enviados ${done}/${required.size}`);}}));
const finalized=await hosting.updateVersion(site,next.split('/').at(-1),{status:'FINALIZED'});
assert.equal((await live()).split('/').at(-1),version.split('/').at(-1),'Outra sessão publicou durante o envio');
const release=await hosting.createRelease(site,'live',finalized.name,{});
await json(join(out,'publicado.json'),{version:finalized.name,previousVersion:version,release:release.name,changed:changed.length,uploaded:required.size,at:new Date().toISOString()});
assert.deepEqual(await list(finalized.name),proposed);
const checks=[];
for(const path of changed){const response=await fetch(origin+path+'?vergas='+finalized.name.split('/').at(-1),{cache:'no-store'});assert.equal(response.status,200,path);assert.equal(sha(Buffer.from(await response.arrayBuffer())),inventory[path].sha256,'Resposta pública divergente: '+path);checks.push(path);}
for(const path of ['/maquetes/liv/','/laranjeiras/']){const response=await fetch(origin+path,{cache:'no-store'});assert.equal(response.status,200,path);}
await json(join(out,'integridade.json'),{status:'PASS',version:finalized.name,changed:changed.length,checked:checks.length,configPreserved:true,untouched:Object.keys(files).filter(path=>!raw.has(path)).length});
console.log(JSON.stringify({status:'PASS',version:finalized.name,changed:changed.length}));

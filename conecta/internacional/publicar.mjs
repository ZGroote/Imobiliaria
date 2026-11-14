// Sem flags, prepara um pacote imutável. --publicar é a única operação que cria versões/releases.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {mkdir,readFile,readdir,realpath,stat,writeFile} from 'node:fs/promises';
import {dirname,isAbsolute,join,relative,resolve,sep} from 'node:path';
import {Readable} from 'node:stream';
import {fileURLToPath} from 'node:url';
import {gzipSync,gunzipSync} from 'node:zlib';

export const PROJECT='imobilaria-deccb';
const PROJECT_NUMBER='163406298617';
export const TARGETS=[
  {id:'br',site:'imobilaria-deccb-miniaturas',locale:'pt-BR',origin:'https://conectaimoveis3d.com.br',index:'index.html'},
  {id:'global',site:'imobilaria-deccb-global',locale:'en',origin:'https://conectaimoveis3d.com',index:'index.en.html'}
];
const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const SOURCE=join(ROOT,'experimentos/apresentacao-2026-11-01/site');
const OUTPUT=join(ROOT,'publicacao/internacionalizacao-20261103');
const ROOT_ASSETS=new Set(['styles.css','site.js','i18n.js','idiomas.js','contato.js']);
const CONTACT_REWRITE={glob:'/api/contact',run:{serviceId:'recebercontato',region:'southamerica-east1'}};
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const json=async(file,value)=>{await mkdir(dirname(file),{recursive:true});await writeFile(file,JSON.stringify(value,null,2)+'\n');};
const readJSON=async file=>JSON.parse(await readFile(file,'utf8'));

export function publicPath(path){
  assert(typeof path==='string'&&path.startsWith('/')&&!/[\\%?#\x00-\x1f]/.test(path),'Caminho público inválido');
  assert(path!=='/'&&path.split('/').slice(1).every(part=>part&&part!=='.'&&part!=='..'&&!part.includes(':')),'Caminho público fora do pacote');
  return path;
}
export function insidePath(base,path){
  const destination=resolve(base,'.'+publicPath(path)),within=relative(resolve(base),destination);
  assert(within&&!isAbsolute(within)&&within!=='..'&&!within.startsWith('..'+sep),'Destino fora do pacote');
  return destination;
}
export function landingPath(path){
  publicPath(path);
  return path==='/index.html'||ROOT_ASSETS.has(path.slice(1))||/^\/(assets|fonts|demo)\//.test(path)||
    path==='/region.json'||path==='/locales/ALL_br/region.json';
}
function inlineHashes(html,tag){
  return [...html.matchAll(new RegExp(`<${tag}\\b([^>]*)>([\\s\\S]*?)<\\/${tag}>`,'gi'))]
    .filter(match=>!/(?:^|\s)src\s*=/i.test(match[1]))
    .map(match=>`'sha256-${createHash('sha256').update(match[2]).digest('base64')}'`);
}
export function landingConfig(before,{html,locale}){
  const config=structuredClone(before),oldRoot=config.i18n?.root;
  assert(!oldRoot||oldRoot.replace(/^\/+|\/+$/g,'')==='locales','A configuração i18n existente precisa ser conciliada antes de publicar');
  config.i18n={...(config.i18n||{}),root:'/locales'};
  const contact=(config.rewrites||[]).filter(rule=>rule.glob===CONTACT_REWRITE.glob);
  assert(contact.length<=1,'Há rotas de contato repetidas; confira a configuração antes de publicar');
  if(contact.length)assert.deepEqual(contact[0],CONTACT_REWRITE,'A rota de contato existente aponta para outro serviço');
  assert(!(config.redirects||[]).some(rule=>rule.glob===CONTACT_REWRITE.glob),'Há um redirecionamento existente na rota de contato');
  config.rewrites=[structuredClone(CONTACT_REWRITE),...(config.rewrites||[]).filter(rule=>rule.glob!==CONTACT_REWRITE.glob)];
  const csp=["default-src 'none'","base-uri 'self'","object-src 'none'","frame-ancestors 'none'","frame-src 'self'",
    `script-src 'self' ${[...new Set(inlineHashes(html,'script'))].join(' ')}`.trim(),
    `style-src 'self' ${[...new Set(inlineHashes(html,'style'))].join(' ')}`.trim(),
    "img-src 'self' data:","font-src 'self'","connect-src 'self'","form-action 'none'"].join('; ');
  const regionPaths=['/region.json','/locales/ALL_br/region.json'];
  const headers=[],exact=Object.fromEntries(['/','/index.html',...regionPaths].map(path=>[path,{}]));
  for(const rule of config.headers||[]){
    if(Object.hasOwn(exact,rule.glob)){Object.assign(exact[rule.glob],rule.headers);continue;}
    const composite=rule.glob?.match(/^\/\{([^{}]+)\}\.html$/);
    if(composite&&composite[1].split(',').includes('index')){
      Object.assign(exact['/index.html'],rule.headers);
      const pages=composite[1].split(',').filter(page=>page!=='index');
      if(pages.length)headers.push({...rule,glob:pages.length===1?`/${pages[0]}.html`:`/{${pages.join(',')}}.html`});
    }else headers.push(rule);
  }
  const rootHeaders={'Content-Security-Policy':csp,'X-Frame-Options':'DENY','X-Content-Type-Options':'nosniff',
    'Referrer-Policy':'strict-origin-when-cross-origin','Permissions-Policy':'camera=(), microphone=(), geolocation=()',
    'Cache-Control':'public, max-age=0, must-revalidate','Content-Language':locale};
  headers.push(...['/','/index.html'].map(glob=>({glob,headers:{...exact[glob],...rootHeaders}})));
  const region={'Cache-Control':'private, no-store','Content-Type':'application/json; charset=utf-8','X-Content-Type-Options':'nosniff'};
  for(const glob of regionPaths)headers.push({glob,headers:{...exact[glob],...region}});
  config.headers=headers;
  const alternate=locale==='en'?{glob:'/index.pt.html',location:TARGETS[0].origin+'/',statusCode:302}:
    {glob:'/index.en.html',location:TARGETS[1].origin+'/',statusCode:302};
  config.redirects=[alternate,...(config.redirects||[]).filter(rule=>rule.glob!==alternate.glob)];
  return config;
}

async function eachLimit(items,worker,limit=4){
  let next=0;
  await Promise.all(Array.from({length:Math.min(limit,items.length)},async()=>{
    while(next<items.length){const item=items[next++];await worker(item);}
  }));
}
async function sourceFiles(source){
  const base=await realpath(source),files=[];
  async function walk(folder,prefix){
    for(const entry of await readdir(folder,{withFileTypes:true})){
      if(entry.name.startsWith('.')||entry.name.endsWith('.map'))continue;
      assert(!entry.isSymbolicLink(),'Links simbólicos não podem entrar no pacote público');
      const path=publicPath(prefix+'/'+entry.name),file=insidePath(base,path);
      const actual=await realpath(file),within=relative(base,actual);
      assert(!isAbsolute(within)&&within!=='..'&&!within.startsWith('..'+sep),'Arquivo fora da origem');
      if(entry.isDirectory())await walk(file,path);else if(entry.isFile())files.push({path,file});
    }
  }
  for(const entry of await readdir(base,{withFileTypes:true})){
    if(entry.name==='index.html'||entry.name==='index.en.html'||ROOT_ASSETS.has(entry.name)){
      assert(entry.isFile()&&!entry.isSymbolicLink(),'Entrada da apresentação não é arquivo regular');
      files.push({path:'/'+entry.name,file:insidePath(base,'/'+entry.name)});
    }else if(['assets','fonts','demo'].includes(entry.name)){
      assert(entry.isDirectory()&&!entry.isSymbolicLink(),'Pasta pública inválida');await walk(join(base,entry.name),'/'+entry.name);
    }
  }
  for(const required of ['index.html','index.en.html','styles.css','site.js','i18n.js','idiomas.js','contato.js'])assert(files.some(file=>file.path==='/'+required),'Falta gerar '+required);
  return files;
}
async function blob(out,bytes){
  const packed=gzipSync(bytes,{level:9}),hash=sha(packed),file=join(out,'blobs',hash+'.gz');
  await mkdir(dirname(file),{recursive:true});
  try{await writeFile(file,packed,{flag:'wx'});}catch(error){if(error.code!=='EEXIST')throw error;assert.equal(sha(await readFile(file)),hash,'Blob preparado foi alterado');}
  return {bytes:bytes.length,sha256:sha(bytes),hostingHash:hash,packedBytes:packed.length};
}
export function mergeInventory(previous,patch){
  const files={...previous};
  for(const [path,record]of Object.entries(patch)){assert(landingPath(path),'Tentativa de alterar rota fora da apresentação: '+path);files[path]=record.hostingHash;}
  return files;
}
export function sameHostingVersion(first,second){
  if(first===null&&second===null)return true;
  const resource=value=>typeof value==='string'?value.match(new RegExp(`^projects/(?:${PROJECT}|${PROJECT_NUMBER})/(sites/[^/]+/versions/[^/]+)$`))?.[1]:null;
  const a=resource(first),b=resource(second);return Boolean(a&&b&&a===b);
}
function sameSnapshot(current,before){
  assert(sameHostingVersion(current.version,before.version),'Houve outra publicação; prepare novamente antes de prosseguir');
  assert.deepEqual(current.config,before.config,'A configuração remota mudou');
  assert.deepEqual(current.files,before.files,'O inventário remoto mudou');
}
export async function prepare({source=SOURCE,out=OUTPUT,remote}={}){
  assert(remote,'Adaptador do Hosting ausente');
  try{await stat(join(out,'publicado.json'));throw Error('Esta pasta já registra uma publicação; preserve seu histórico e use outra saída.');}catch(error){if(error.code!=='ENOENT')throw error;}
  const inputs=await sourceFiles(source),records={},html={};
  await eachLimit(inputs,async({path,file})=>{
    const bytes=await readFile(file);records[path]=await blob(out,bytes);
    if(path==='/index.html'||path==='/index.en.html')html[path]=bytes.toString('utf8');
  });
  assert(/<html\b[^>]*\blang=["']pt(?:-BR)?["']/i.test(html['/index.html']),'A raiz brasileira precisa estar em português');
  assert(/<html\b[^>]*\blang=["']en(?:-[a-z]+)?["']/i.test(html['/index.en.html']),'A raiz internacional precisa estar em inglês');
  const regions={
    '/region.json':await blob(out,Buffer.from(JSON.stringify({country:null,locale:'en'})+'\n')),
    '/locales/ALL_br/region.json':await blob(out,Buffer.from(JSON.stringify({country:'BR',locale:'pt-BR'})+'\n'))
  };
  const plans=[];
  for(const target of TARGETS){
    const before=await remote.snapshot(target),inventory={...records,...regions};
    delete inventory['/index.en.html'];inventory['/index.html']=records['/'+target.index];
    const config=landingConfig(before.config,{html:html['/'+target.index],locale:target.locale});
    const files=mergeInventory(before.files,inventory),changed=Object.keys(inventory).filter(path=>files[path]!==before.files[path]);
    const plan={target,before,config,files,inventory,changed};plans.push(plan);
    await json(join(out,target.id,'antes.json'),before);
    await json(join(out,target.id,'config.json'),config);
    await json(join(out,target.id,'inventario.json'),files);
    await json(join(out,target.id,'diferencas.json'),{added:changed.filter(path=>!before.files[path]),
      changed:changed.filter(path=>before.files[path]),removed:[],preserved:Object.keys(before.files).filter(path=>!changed.includes(path)),
      configBefore:before.config,configAfter:config});
  }
  for(const plan of plans)sameSnapshot(await remote.snapshot(plan.target),plan.before);
  const manifest={schema:'conecta-international-hosting-v1',project:PROJECT,preparedAt:new Date().toISOString(),source:await realpath(source),plans};
  await json(join(out,'preflight.json'),manifest);
  return manifest;
}

async function checkedBlob(out,record){
  assert(/^[a-f0-9]{64}$/.test(record.hostingHash),'Hash de envio inválido');
  const packed=await readFile(join(out,'blobs',record.hostingHash+'.gz'));
  assert.equal(packed.length,record.packedBytes);assert.equal(sha(packed),record.hostingHash,'O pacote mudou após a preparação');return packed;
}
export async function publish({out=OUTPUT,remote}={}){
  const manifest=await readJSON(join(out,'preflight.json'));
  assert.equal(manifest.schema,'conecta-international-hosting-v1');assert.equal(manifest.project,PROJECT);
  assert.deepEqual(manifest.plans.map(plan=>plan.target),TARGETS,'Destinos diferentes dos aprovados');
  const byHash=new Map();
  for(const plan of manifest.plans){
    assert.deepEqual(mergeInventory(plan.before.files,plan.inventory),plan.files,'Plano de preservação inválido');
    const html=gunzipSync(await checkedBlob(out,plan.inventory['/index.html'])).toString('utf8');
    assert.deepEqual(plan.config,landingConfig(plan.before.config,{html,locale:plan.target.locale}),'A configuração proposta mudou após a preparação');
    for(const record of Object.values(plan.inventory))byHash.set(record.hostingHash,record);
    sameSnapshot(await remote.snapshot(plan.target),plan.before);
  }
  await eachLimit([...byHash.values()],record=>checkedBlob(out,record));
  const staged=[];
  for(const plan of manifest.plans){
    sameSnapshot(await remote.snapshot(plan.target),plan.before);
    const version=await remote.createVersion(plan.target,plan.config);staged.push({plan,version});
    await json(join(out,'versoes-preparadas.json'),staged.map(item=>({site:item.plan.target.site,version:item.version,previousVersion:item.plan.before.version})));
    const {hashes,uploadUrl}=await remote.populate(version,plan.files);
    for(const hash of hashes)assert(byHash.has(hash),'Hosting solicitou um recurso antigo que deve continuar disponível: '+hash);
    await eachLimit([...hashes],async hash=>remote.upload(uploadUrl,hash,await checkedBlob(out,byHash.get(hash))));
    await remote.finalize(plan.target,version);
  }
  for(const {plan}of staged)sameSnapshot(await remote.snapshot(plan.target),plan.before);
  const published=[];
  // A página internacional fica disponível antes de a raiz brasileira passar a encaminhar visitantes.
  for(const {plan,version}of staged.sort((a,b)=>Number(b.plan.target.id==='global')-Number(a.plan.target.id==='global'))){
    sameSnapshot(await remote.snapshot(plan.target),plan.before);
    const release=await remote.release(plan.target,version);
    published.push({site:plan.target.site,origin:plan.target.origin,version,previousVersion:plan.before.version,release,at:new Date().toISOString()});
    await json(join(out,'publicado.json'),{project:PROJECT,sites:published});
    const current=await remote.snapshot(plan.target);assert(sameHostingVersion(current.version,version),'A versão publicada diverge do release solicitado');assert.deepEqual(current.files,plan.files);assert.deepEqual(current.config,plan.config);
  }
  await json(join(out,'integridade.json'),{status:'PASS',sites:published.map(item=>item.site),preservedInventories:true,at:new Date().toISOString()});
  return published;
}

export async function firebaseRemote(){
  const require=createRequire(join(ROOT,'package.json')),auth=require('firebase-tools/lib/auth.js');
  const {requireAuth}=require('firebase-tools/lib/requireAuth.js'),{Client}=require('firebase-tools/lib/apiv2.js');
  const hosting=require('firebase-tools/lib/hosting/api.js');
  await requireAuth({project:PROJECT,nonInteractive:true,...auth.getProjectDefaultAccount(ROOT)});
  const api=new Client({urlPrefix:'https://firebasehosting.googleapis.com',apiVersion:'v1beta1',auth:true});
  const list=async version=>{
    const files={};let pageToken;
    do{const response=(await api.get('/'+version+'/files',{queryParams:{pageSize:1000,...(pageToken?{pageToken}:{})}})).body;
      for(const file of response.files||[])files[publicPath(file.path)]=file.hash;pageToken=response.nextPageToken;
    }while(pageToken);return files;
  };
  return {
    async snapshot(target){
      await hosting.getSite(PROJECT,target.site);
      const channel=await hosting.getChannel(PROJECT,target.site,'live'),version=channel?.release?.version?.name||null;
      return {version,release:channel?.release?.name||null,config:version?(await api.get('/'+version)).body.config||{}:{},files:version?await list(version):{}};
    },
    createVersion:(target,config)=>hosting.createVersion(target.site,{config,labels:{deployment:'internacional-20261103'}}),
    async populate(version,files){
      const entries=Object.entries(files),hashes=new Set();let uploadUrl;
      for(let i=0;i<entries.length;i+=1000){const response=(await api.post('/'+version+':populateFiles',{files:Object.fromEntries(entries.slice(i,i+1000))})).body;
        for(const hash of response.uploadRequiredHashes||[])hashes.add(hash);uploadUrl=response.uploadUrl||uploadUrl;
      }return {hashes,uploadUrl};
    },
    async upload(uploadUrl,hash,bytes){assert(uploadUrl,'URL de envio ausente');const upload=new Client({urlPrefix:uploadUrl,auth:true});await upload.post('/'+hash,Readable.from(bytes),{headers:{'Content-Type':'application/octet-stream'}});},
    finalize:(target,version)=>hosting.updateVersion(target.site,version.split('/').at(-1),{status:'FINALIZED'}),
    async release(target,version){return (await hosting.createRelease(target.site,'live',version,{})).name;}
  };
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const args=process.argv.slice(2);assert(args.every(arg=>arg==='--publicar'),'Use sem argumentos para preparar, ou --publicar para publicar o pacote preparado.');
  const remote=await firebaseRemote();
  if(args.includes('--publicar'))console.log(JSON.stringify({mode:'published',sites:await publish({remote})}));
  else{const prepared=await prepare({remote});console.log(JSON.stringify({mode:'preflight',out:OUTPUT,sites:prepared.plans.map(plan=>({site:plan.target.site,changed:plan.changed.length,preserved:Object.keys(plan.before.files).filter(path=>!plan.changed.includes(path)).length}))}));}
}

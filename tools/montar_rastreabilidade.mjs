import {readFile,writeFile,mkdir,lstat,readdir,copyFile,rename} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,join,relative,dirname,sep,isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('..',import.meta.url));
const source=fileURLToPath(new URL('../rastreabilidade/public/',import.meta.url));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const inside=(path,parent)=>{const rel=relative(parent,path);return Boolean(rel)&&!isAbsolute(rel)&&rel!=='..'&&!rel.startsWith('..'+sep);};

export function configuredUrl(value,{originOnly=false}={}) {
  const url=new URL(value);
  if(url.username||url.password||url.search||url.hash||!(url.protocol==='https:'
    ||(url.protocol==='http:'&&['127.0.0.1','localhost','[::1]'].includes(url.hostname))))throw Error('URL de configuração inválida');
  if(originOnly&&url.pathname!=='/')throw Error('Origem pública deve conter apenas a origem');
  return originOnly?url.origin:(url.href.endsWith('/')?url.href:url.href+'/');
}

async function noLinks(path,stop) {
  let current=path;
  while(current!==stop) {
    try {const stat=await lstat(current);if(stat.isSymbolicLink())throw Error('Destino não permite link simbólico');}
    catch(error) {if(error.code!=='ENOENT')throw error;}
    const parent=dirname(current);if(parent===current)throw Error('Destino fora da raiz');current=parent;
  }
  const stat=await lstat(stop);if(stat.isSymbolicLink())throw Error('Raiz não permite link simbólico');
}

async function filesOf(from,prefix='') {
  const files=[];
  for(const entry of await readdir(from,{withFileTypes:true})) {
    if(entry.isSymbolicLink()||(!entry.isDirectory()&&!entry.isFile()))throw Error('Site base contém entrada não regular');
    const name=prefix+entry.name;
    if(entry.isDirectory())files.push(...await filesOf(join(from,entry.name),name+'/'));
    else files.push(name);
  }
  return files;
}

async function inventory(baseSite) {
  const bytes=await readFile(join(baseSite,'estado.json')),state=JSON.parse(bytes);
  if(state.schema!==1||!state.arquivos||Array.isArray(state.arquivos)||typeof state.arquivos!=='object')throw Error('Inventário do site base inválido');
  const names=Object.keys(state.arquivos),actual=await filesOf(baseSite);
  for(const name of names) {
    if(name.split('/').some(part=>!part||part==='.'||part==='..'||part.startsWith('.'))||name.includes('\\')||name.includes(':')
      ||!/^[0-9a-f]{64}$/.test(state.arquivos[name]))throw Error('Inventário do site base inválido');
    if(hash(await readFile(join(baseSite,name)))!==state.arquivos[name])throw Error('Hash do inventário do site base divergente');
  }
  if(actual.length!==names.length+1||actual.some(name=>name!=='estado.json'&&!names.includes(name)))throw Error('Site base contém arquivo fora do inventário');
  return {...state.arquivos,'estado.json':hash(bytes)};
}

// Output must be a new sibling package. No overwrite of a publication or M1.1 round.
export async function montar({output,apiBase,publicOrigin,baseSite,workspace=root}) {
  if(!output)throw Error('Informe destino novo');
  workspace=resolve(workspace);output=resolve(output);
  const allowed=join(workspace,'publicacao','rastreabilidade');
  if(!inside(output,allowed))throw Error('Destino deve ser uma pasta nova dentro de publicacao/rastreabilidade');
  await noLinks(output,workspace);
  try {await lstat(output);throw Error('Destino já existe: use uma pasta nova');}catch(error){if(error.code!=='ENOENT')throw error;}
  apiBase=configuredUrl(apiBase);publicOrigin=configuredUrl(publicOrigin,{originOnly:true});
  let baseFiles={};
  if(baseSite) {
    baseSite=resolve(baseSite);
    if(!inside(baseSite,workspace))throw Error('Site base deve estar dentro do workspace');
    await noLinks(baseSite,workspace);
    if(baseSite===output||inside(output,baseSite)||inside(baseSite,output))throw Error('Site base e destino se sobrepõem');
    for(const name of ['acesso.html','rastreabilidade','rastreabilidade-manifest.json']) {
      try {await lstat(join(baseSite,name));throw Error('Site base já contém pacote de rastreabilidade');}catch(error){if(error.code!=='ENOENT')throw error;}
    }
    baseFiles=await inventory(baseSite);
  }
  const names=['acesso.html','runtime.mjs','metricas.mjs'];
  const bytes=Object.fromEntries(await Promise.all(names.map(async name=>[name,await readFile(join(source,name))])));
  const config={schemaVersion:1,apiBase,publicOrigin};
  const release=hash(Buffer.concat([...names.map(name=>bytes[name]),Buffer.from(JSON.stringify(config))])).slice(0,16);
  await mkdir(dirname(output),{recursive:true});
  const temporary=output+'.preparando-'+process.pid;
  await mkdir(temporary);
  for(const [name,expected] of Object.entries(baseFiles)) {
    const target=join(temporary,name);await mkdir(dirname(target),{recursive:true});await copyFile(join(baseSite,name),target);
    if(hash(await readFile(target))!==expected)throw Error('Site base mudou durante a cópia');
  }
  const assets=join(temporary,'rastreabilidade',release);await mkdir(assets,{recursive:true});
  for(const name of ['runtime.mjs','metricas.mjs'])await writeFile(join(assets,name),bytes[name]);
  const html=bytes['acesso.html'].toString('utf8').replace('__TRACKING_CONFIG__',JSON.stringify(config).replaceAll('<','\\u003c'))
    .replace('__TRACKING_RUNTIME__',`/rastreabilidade/${release}/runtime.mjs`);
  await writeFile(join(temporary,'acesso.html'),html);
  const files={'acesso.html':hash(html),...Object.fromEntries(['runtime.mjs','metricas.mjs'].map(name=>[`rastreabilidade/${release}/${name}`,hash(bytes[name])]))};
  const manifest={schemaVersion:1,release,config,files,baseFiles,sources:Object.fromEntries(names.map(name=>[name,hash(bytes[name])])),
    buildToolSha256:hash(await readFile(fileURLToPath(import.meta.url))),
    note:'Pacote local. Montar não publica sites nem altera builds /b.'};
  await writeFile(join(temporary,'rastreabilidade-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
  await rename(temporary,output);
  return {output,release,manifest};
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  try {
    const args=process.argv.slice(2),options={};
    const map={'--saida':'output','--api':'apiBase','--origem-publica':'publicOrigin','--site-base':'baseSite'};
    for(let i=0;i<args.length;i+=2) {if(!map[args[i]]||!args[i+1])throw Error('Use --saida <pasta nova> --api <URL> --origem-publica <origem> [--site-base <pasta>]');options[map[args[i]]]=args[i+1];}
    const result=await montar(options);process.stdout.write(JSON.stringify({output:result.output,release:result.release})+'\n');
  } catch(error) {process.stderr.write(error.message+'\n');process.exitCode=1;}
}

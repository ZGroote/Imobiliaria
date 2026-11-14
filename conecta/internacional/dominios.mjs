// O cadastro no Firebase não muda os registros da Spaceship.
// Sem argumentos: apenas consulta. --vincular: cria o site global e vincula .com/www.
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const require=createRequire(join(root,'package.json'));
const auth=require('firebase-tools/lib/auth.js');
const {requireAuth}=require('firebase-tools/lib/requireAuth.js');
const {Client}=require('firebase-tools/lib/apiv2.js');
const hosting=require('firebase-tools/lib/hosting/api.js');
const project='imobilaria-deccb',site='imobilaria-deccb-global';
const parent=`projects/${project}/sites/${site}`;
const bind=process.argv.includes('--vincular');
const pendingOperations=[];
await requireAuth({project,nonInteractive:true,...auth.getProjectDefaultAccount(root)});
const api=new Client({urlPrefix:'https://firebasehosting.googleapis.com',apiVersion:'v1beta1',auth:true});

async function operation(result){
  let value=result;
  for(let attempt=0;!value.done&&attempt<5;attempt++){
    await new Promise(resolve=>setTimeout(resolve,1000));
    value=(await api.get('/'+value.name)).body;
  }
  if(value.error)throw Error(value.error.message||'Falha ao cadastrar o domínio.');
  if(!value.done)pendingOperations.push(value.name);
  return value.response;
}

let resource;
try {resource=await hosting.getSite(project,site);}
catch(error){
  if(error.status!==404)throw error;
  if(bind)resource=await hosting.createSite(project,site);
}
const domains=[];
if(resource)for(const [domain,options] of [
  ['conectaimoveis3d.com',{}],
  ['www.conectaimoveis3d.com',{redirectTarget:'conectaimoveis3d.com'}],
]){
  const name=`${parent}/customDomains/${domain}`;
  let value;
  try {value=(await api.get('/'+name)).body;}
  catch(error){
    if(error.status!==404)throw error;
    if(bind) {
      await operation((await api.post('/'+parent+'/customDomains',options,{queryParams:{customDomainId:domain}})).body);
      value=(await api.get('/'+name)).body;
    }
  }
  if(value&&options.redirectTarget&&value.redirectTarget!==options.redirectTarget)
    throw Error(`O domínio ${domain} já existe com outro destino; configuração preservada.`);
  domains.push(value||{name,notConfigured:true});
}
const result={project,site,defaultUrl:resource?.defaultUrl,domains,pendingOperations};
const out=join(root,'publicacao/internacionalizacao-20261103');
await mkdir(out,{recursive:true});
await writeFile(join(out,'dominios.json'),JSON.stringify(result,null,2)+'\n');
const printable=process.argv.includes('--resumo')?{project,site,domains:domains.map(domain=>({
  name:domain.name,host:domain.hostState,ownership:domain.ownershipState,certificate:domain.cert?.state,
  dns:domain.requiredDnsUpdates?.desired,certificateDns:domain.cert?.verification?.dns?.desired,
}))}:result;
console.log(JSON.stringify(printable,null,2));

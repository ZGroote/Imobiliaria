// Provisiona somente a chave estável da idempotência; nunca lê ou imprime seu valor.
import {randomBytes} from 'node:crypto';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const require=createRequire(join(root,'package.json'));
const auth=require('firebase-tools/lib/auth.js');
const {requireAuth}=require('firebase-tools/lib/requireAuth.js');
const {Client}=require('firebase-tools/lib/apiv2.js');
const project='imobilaria-deccb',secret='CONTACT_HMAC_KEY';
const out=join(root,'publicacao/contato-internacional-20261103');
const mutate=process.argv.includes('--criar-segredo');

try {
  await requireAuth({project,nonInteractive:true,...auth.getProjectDefaultAccount(root)});
  const api=new Client({urlPrefix:'https://secretmanager.googleapis.com',apiVersion:'v1',auth:true});
  const path=`projects/${project}/secrets/${secret}`;
  let metadata,created=false;
  try {metadata=(await api.get(path)).body;}
  catch(error){
    if(error.status!==404)throw error;
    if(mutate){
      metadata=(await api.post(`projects/${project}/secrets`,{
        replication:{automatic:{}},labels:{'firebase-managed':'functions','conecta-purpose':'contact-idempotency'},
      },{queryParams:{secretId:secret}})).body;
      created=true;
    }
  }
  let versions=[];
  if(metadata){
    versions=(await api.get(path+'/versions')).body.versions||[];
    if(!versions.length&&mutate){
      if(metadata.labels?.['conecta-purpose']!=='contact-idempotency')throw Error('Existing secret belongs to another configuration.');
      const key=randomBytes(32).toString('base64url');
      // The CLI client's request logging must never receive the payload.
      const version=(await api.post(path+':addVersion',{
        payload:{data:Buffer.from(key).toString('base64')},
      },{skipLog:{body:true,resBody:true}})).body;
      versions=[{name:version.name,state:version.state}];
    }
  }
  const result={project,secret,created,exists:Boolean(metadata),versions:versions.map(v=>({name:v.name,state:v.state}))};
  await mkdir(out,{recursive:true});
  await writeFile(join(out,'segredo-metadados.json'),JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify(result));
} catch(error) {
  console.error('Falha ao preparar metadados do contato; HTTP '+(error.status||'não informado')+'. Nenhum valor de segredo foi impresso.');
  process.exitCode=1;
}

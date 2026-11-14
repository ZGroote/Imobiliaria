// Copia somente a configuração pública já usada pelo painel. Não lê credenciais Admin.
import {readFile,writeFile} from 'node:fs/promises';
const args=process.argv.slice(2),root=new URL('./',import.meta.url);
let id=null;if(args.length){if(args.length!==2||args[0]!=='--imovel'||!/^[A-Za-z0-9_-]{1,128}$/.test(args[1]))throw Error('Use --imovel ID_DO_IMOVEL, ou nenhum argumento para ativação por link.');id=args[1];}
const env=await readFile(new URL('../../painel/.env.production',root),'utf8');
function publicValue(key){const match=env.match(new RegExp('^NEXT_PUBLIC_FIREBASE_'+key+'=(.+)$','m'));return match?.[1].trim().replace(/^['"]|['"]$/g,'');}
const firebase={apiKey:publicValue('API_KEY'),projectId:publicValue('PROJECT_ID'),appId:publicValue('APP_ID')};
if(Object.values(firebase).some(v=>!v)||firebase.projectId.startsWith('demo-'))throw Error('Configuração pública do painel incompleta.');
const config={schema:'liv-sales-config-v1',mode:'firebase',propertyId:id,firebase};
await writeFile(new URL('estoque-config.json',root),JSON.stringify(config,null,2)+'\n');
console.log(JSON.stringify({status:'PASS',projectId:firebase.projectId,propertyId:id,activation:id?'config':'query-estoque',secretsRead:false}));

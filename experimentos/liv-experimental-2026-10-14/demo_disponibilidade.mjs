// Executar sob emulators:exec --project demo-painel. Nunca grava em produção.
import {spawn} from 'node:child_process';
import {randomInt} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {getAuth} from 'firebase-admin/auth';
import {adminDb,Timestamp} from '../../painel/scripts/seed.mjs';
import {SENHA_DEV,USUARIOS_DEV,AGENCIAS_DEV} from '../../painel/src/lib/dev.ts';
import {BOOK_SHA,posicoes,vazias,totais} from '../../painel/src/lib/estoque-modelo.ts';

if(process.env.GCLOUD_PROJECT!=='demo-painel'||process.env.FIRESTORE_EMULATOR_HOST!=='127.0.0.1:8180'||
   process.env.FIREBASE_AUTH_EMULATOR_HOST!=='127.0.0.1:9099')throw Error('Demonstração exige emuladores locais do projeto demo-painel.');
const db=adminDb(),auth=getAuth(),propertyId='liv-demo-disponibilidade',parent=db.doc('salesInventory/'+propertyId);
// Create only missing demo accounts/agencies; never clear another test inventory.
for(const uid of ['op','admin']){
  const user=USUARIOS_DEV.find(u=>u.uid===uid);
  try{await auth.getUser(uid);}catch(error){
    if(error.code!=='auth/user-not-found')throw error;
    await auth.createUser({uid,email:user.email,password:SENHA_DEV,emailVerified:true,displayName:user.name});
  }
  const ref=db.doc('users/'+uid);
  if(!(await ref.get()).exists){const {uid:_,...profile}=user;await ref.set({...profile,active:true,createdAt:Timestamp.now(),updatedAt:Timestamp.now()});}
}
const agency=db.doc('agencies/agA');
if(!(await agency.get()).exists){const {id:_,...data}=AGENCIAS_DEV[0];await agency.set({...data,active:true,createdAt:Timestamp.now(),updatedAt:Timestamp.now()});}
let created=false;
if(!(await parent.get()).exists){
  const title='LIV Ipanema — DEMONSTRAÇÃO SEM OFERTA REAL',now=Timestamp.now();
  const shuffled=posicoes();
  for(let i=shuffled.length-1;i>0;i--){const j=randomInt(i+1);[shuffled[i],shuffled[j]]=[shuffled[j],shuffled[i]];}
  const available=new Set(shuffled.slice(0,34).map(u=>u.id)),batch=db.batch();
  const record=(kind,key,fields)=>{
    const changeId=`demo-inicial-${kind}-${key}`,snapshot={...fields,revision:1,updatedAt:now,lastChangeId:changeId};
    batch.set(kind==='settings'?parent:parent.collection(kind).doc(key),snapshot);
    batch.set(parent.collection('history').doc(changeId),{kind,key,revision:1,actor:'op',timestamp:now,snapshot});
  };
  batch.set(db.doc('properties/'+propertyId),{agencyId:'agA',title,developmentName:title,status:'active',createdAt:now,updatedAt:now});
  record('settings','settings',{schema:'liv-sales-v1',bookSHA256:BOOK_SHA,model:'liv-ipanema',total:170,title,publicEnabled:true});
  for(const position of posicoes())record('units',position.id,{...position,commercialNumber:null,
    availability:available.has(position.id)?'disponivel':'vendida',profileId:null,
    overrides:{...vazias(),description:'Dado fictício para teste visual. Não representa a disponibilidade real do LIV Ipanema.'}});
  for(const id of ['canto','meio'])record('profiles',id,{id,info:vazias()});
  await batch.commit();created=true;
}
const units=(await parent.collection('units').get()).docs.map(doc=>doc.data());
const folder=fileURLToPath(new URL('./evidencias/demo-disponibilidade/',import.meta.url));await mkdir(folder,{recursive:true});
const distribution={project:'demo-painel',propertyId,syntheticOnly:true,created,total:units.length,
  counts:totais(units),availableTechnicalIds:units.filter(u=>u.availability==='disponivel').map(u=>u.technicalId).sort()};
await writeFile(folder+'/distribuicao.json',JSON.stringify(distribution,null,2));
console.log(JSON.stringify({demo:propertyId,total:units.length,counts:distribution.counts,created}));
const panel=fileURLToPath(new URL('../../painel/',import.meta.url));
const next=spawn(process.execPath,[panel+'node_modules/next/dist/bin/next','dev','--hostname','127.0.0.1','--port','3017'],
  {cwd:panel,stdio:'inherit',env:{...process.env,NEXT_PUBLIC_FIREBASE_EMULATOR:'1'}});
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>next.kill());
await new Promise((resolve,reject)=>{next.once('error',reject);next.once('exit',code=>code===0?resolve():reject(Error('Painel de demonstração terminou: '+code)));});

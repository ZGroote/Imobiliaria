// Executar dentro de emulators:exec (auth/firestore/storage, projeto demo-painel).
import {spawn} from 'node:child_process';
import {mkdir,readFile} from 'node:fs/promises';
import {createWriteStream} from 'node:fs';
import {once} from 'node:events';
import {fileURLToPath} from 'node:url';
import {semear,adminDb,Timestamp} from '../../painel/scripts/seed.mjs';
if(process.env.FIRESTORE_EMULATOR_HOST!=='127.0.0.1:8180'||process.env.FIREBASE_AUTH_EMULATOR_HOST!=='127.0.0.1:9099')throw Error('QA exige os emuladores locais do projeto demo-painel.');
const repo=fileURLToPath(new URL('../../',import.meta.url)),out=fileURLToPath(new URL('./evidencias/estoque-admin/',import.meta.url));
await mkdir(out,{recursive:true});
function run(command,args,options={}){return new Promise((resolve,reject)=>{const child=spawn(command,args,{cwd:repo,stdio:'inherit',...options});child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(Error('QA terminou com código '+code)));});}
if(!process.argv.includes('--browser-only')){
  const tests=createWriteStream(out+'/regras.log');await once(tests,'open');
  try { await run(process.execPath,['--test','--test-concurrency=1','firebase/tests/regras.test.mjs','painel/tests/estoque.test.ts'],{stdio:['ignore',tests,tests]}); }
  finally { await new Promise(resolve=>tests.end(resolve));console.log((await readFile(out+'/regras.log','utf8')).split('\n').slice(-18).join('\n')); }
}
await semear();await adminDb().doc('properties/liv-estoque-qa').set({agencyId:'agA',title:'LIV — DEMONSTRAÇÃO SEM OFERTA REAL',developmentName:'LIV — DEMONSTRAÇÃO SEM OFERTA REAL',status:'active',createdAt:Timestamp.now(),updatedAt:Timestamp.now()});
const log=createWriteStream(out+'/next.log'),panel=fileURLToPath(new URL('../../painel/',import.meta.url));
const next=spawn(process.execPath,[panel+'node_modules/next/dist/bin/next','dev','--hostname','127.0.0.1','--port','3017'],
  {cwd:panel,stdio:['ignore','pipe','pipe'],env:{...process.env,NEXT_PUBLIC_FIREBASE_EMULATOR:'1'}});
next.stdout.pipe(log);next.stderr.pipe(log);
try{await run('C:/Python314/python.exe',[fileURLToPath(new URL('./qa_estoque_admin.py',import.meta.url))]);}
finally{next.kill();log.end();}

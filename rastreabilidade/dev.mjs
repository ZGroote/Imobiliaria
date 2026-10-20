// Somente demo-painel e emuladores locais. Reinicializa as fixtures do emulador.
import http from 'node:http'
import {randomBytes,randomUUID,createHash} from 'node:crypto'
import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises'
import {resolve,join,extname,relative,isAbsolute} from 'node:path'
import {fileURLToPath} from 'node:url'
import {spawn} from 'node:child_process'
import {getAuth} from 'firebase-admin/auth'
import {semear,adminDb} from '../painel/scripts/seed.mjs'
import {montar} from '../tools/montar_rastreabilidade.mjs'
import {criarServidorRastreabilidade} from './servidor.mjs'
import {criarServicoRastreabilidade} from './modelo.mjs'
import {SENHA_DEV} from '../painel/src/lib/dev.ts'

const workspace=fileURLToPath(new URL('..',import.meta.url))
const args=process.argv.slice(2)
if(args.length&&!(args.length===2&&args[0]==='--maquete'))throw Error('Use node rastreabilidade/dev.mjs [--maquete <HTML local autocontido>]')
if(process.env.GCLOUD_PROJECT!=='demo-painel'||process.env.FIRESTORE_EMULATOR_HOST!=='127.0.0.1:8180'
  ||process.env.FIREBASE_AUTH_EMULATOR_HOST!=='127.0.0.1:9099')throw Error('Use emulators:exec --only auth,firestore --project demo-painel.')
const publicOrigin='http://127.0.0.1:5058',panelOrigin='http://127.0.0.1:3000',apiBase='http://127.0.0.1:5057'
const directory=join(workspace,'publicacao','rastreabilidade','demo-'+randomUUID())
const base=join(directory,'base'),site=join(directory,'site'),build='a1b2c3d4e5f6',unit='monte-dos-cedros-37'
const files=['LEIA-ME.txt',`b/${unit}/${build}/tour.html`,`b/${unit}/${build}/maquete.html`,`b/${unit}/${build}/manifest.json`]
await mkdir(base,{recursive:true})
const hashes={}
for(const name of files){
  const target=join(base,name);await mkdir(resolve(target,'..'),{recursive:true})
  const from=args.length&&name.endsWith('/maquete.html')?resolve(args[1]):join(workspace,'painel','exemplo',name)
  await copyFile(from,target);hashes[name]=createHash('sha256').update(await readFile(target)).digest('hex')
}
const state=JSON.parse(await readFile(join(workspace,'painel','exemplo','estado.json'),'utf8'))
state.arquivos=hashes;await writeFile(join(base,'estado.json'),JSON.stringify(state,null,2)+'\n')
await montar({output:site,baseSite:base,apiBase,publicOrigin})
await semear()
const db=adminDb(),auth=getAuth()
await auth.createUser({uid:'corA2',email:'corretor.a2@painel.test',password:SENHA_DEV,emailVerified:true})
await db.doc('users/corA2').set({name:'Corretor A2 (dev)',email:'corretor.a2@painel.test',role:'agent',agencyId:'agA',active:true})
await db.doc('properties/cedros').update({publishedBuild:build,tourUrl:publicOrigin+`/b/${unit}/${build}/tour.html`,
  maqueteUrl:publicOrigin+`/b/${unit}/${build}/maquete.html`})
const secret=randomBytes(32).toString('hex')
const service=criarServicoRastreabilidade({db,secret,publicOrigin})
const roots=await Promise.all(['corA','corA2'].map(brokerUid=>service.criarLink('gerA',{propertyId:'cedros',brokerUid,attemptId:randomUUID()})))
const api=criarServidorRastreabilidade({service,auth,publicOrigin,panelOrigin})
const types={'.html':'text/html; charset=utf-8','.json':'application/json','.mjs':'text/javascript; charset=utf-8','.txt':'text/plain; charset=utf-8'}
const staticServer=http.createServer(async(req,res)=>{
  try{
    if(!['GET','HEAD'].includes(req.method)){res.writeHead(405).end();return}
    const pathname=decodeURIComponent(new URL(req.url,publicOrigin).pathname)
    const file=resolve(site,'.'+pathname),rel=relative(site,file)
    if(!rel||rel.startsWith('..')||isAbsolute(rel)){res.writeHead(404).end();return}
    const bytes=await readFile(file)
    res.writeHead(200,{'content-type':types[extname(file)]??'application/octet-stream','cache-control':'no-store','referrer-policy':'no-referrer'}).end(req.method==='HEAD'?undefined:bytes)
  }catch{res.writeHead(404).end()}
})
api.listen(5057,'127.0.0.1');staticServer.listen(5058,'127.0.0.1')
const next=spawn(process.execPath,[join(workspace,'painel','node_modules','next','dist','bin','next'),'dev','--hostname','127.0.0.1','--port','3000'],
  {cwd:join(workspace,'painel'),stdio:'inherit',windowsHide:true,env:{...process.env,NEXT_PUBLIC_FIREBASE_EMULATOR:'1',NEXT_PUBLIC_TRACKING_API_URL:apiBase}})
const stop=()=>{next.kill();api.closeAllConnections();api.close();staticServer.closeAllConnections();staticServer.close()}
process.once('SIGINT',stop);process.once('SIGTERM',stop)
next.once('exit',code=>{stop();process.exitCode=code??0})
await writeFile(join(directory,'demo.json'),JSON.stringify({site,publicOrigin,apiBase,panelOrigin,roots:roots.map(({link})=>link)},null,2)+'\n')
console.log(JSON.stringify({event:'tracking_demo_ready',site,panelOrigin,links:roots.map(({link})=>link.url),
  note:'Demonstração local descartável; não homologa celulares nem publica sites.'}))

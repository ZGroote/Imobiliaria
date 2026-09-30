// Fronteira confiável M1-D. O cliente não escreve snapshots diretamente.
import http from 'node:http'
import {execFile} from 'node:child_process'
import {fileURLToPath,pathToFileURL} from 'node:url'
import {initializeApp} from 'firebase-admin/app'
import {getAuth} from 'firebase-admin/auth'
import {getFirestore,FieldValue} from 'firebase-admin/firestore'

const ROOT=fileURLToPath(new URL('..',import.meta.url))
const LIMIT=384*1024
const id=v=>typeof v==='string'&&/^[a-zA-Z0-9_-]{1,128}$/.test(v)
const fail=(status,message)=>Object.assign(new Error(message),{status})
export function prepararLeitura(text){
  if(typeof text!=='string'||Buffer.byteLength(text)>LIMIT) return Promise.reject(fail(413,'Leitura excede 384 KiB.'))
  return new Promise((resolve,reject)=>{
    const child=execFile(process.env.PYTHON??'python',['-m','pipeline.preparar_leitura'],
      {cwd:ROOT,timeout:10000,maxBuffer:1024*1024,windowsHide:true},(err,out)=>{
        if(err){
          if(err.code===2){try{reject(fail(422,JSON.parse(out).errors.map(e=>`${e.code}: ${e.message}`).join(' ')));return}catch{}}
          reject(fail(503,'Validador indisponível; nenhuma versão foi salva.'));return
        }
        try{resolve(JSON.parse(out))}catch{reject(fail(503,'Resposta inválida do validador.'))}
      })
    child.stdin.on('error',()=>{});child.stdin.end(text)
  })
}
function authorize(user,property,agencyId){
  if(user?.active!==true||!property||property.agencyId!==agencyId
    ||(!['platform_admin','operator'].includes(user.role)
       &&!(['agency_manager','agent'].includes(user.role)&&user.agencyId===agencyId)))
    throw fail(403,'Sem permissão para este imóvel/agência.')
}
export async function criarVersao(db,uid,input){
  if(!input||typeof input!=='object'||Array.isArray(input)
    ||Object.keys(input).some(k=>!['saveId','propertyId','agencyId','leituraJson','basedOnVersionId'].includes(k))
    ||!id(input.propertyId)||!id(input.agencyId)||!id(input.saveId)
    ||(input.basedOnVersionId!==undefined&&!id(input.basedOnVersionId))) throw fail(400,'Campos de gravação inválidos.')
  const {propertyId,agencyId,saveId,basedOnVersionId}=input
  const userRef=db.doc('users/'+uid),propertyRef=db.doc('properties/'+propertyId)
  const [u,p]=await Promise.all([userRef.get(),propertyRef.get()]);authorize(u.data(),p.data(),agencyId)
  const prepared=await prepararLeitura(input.leituraJson)
  const ref=db.doc('propertyReadings/'+saveId),counter=db.doc('propertyReadingCounters/'+propertyId)
  return db.runTransaction(async tx=>{
    const [user,property,existing,count]=await tx.getAll(userRef,propertyRef,ref,counter)
    authorize(user.data(),property.data(),agencyId)
    if(basedOnVersionId){
      const base=await tx.get(db.doc('propertyReadings/'+basedOnVersionId))
      if(!base.exists||base.data().propertyId!==propertyId||base.data().agencyId!==agencyId)
        throw fail(403,'A versão base não pertence a este imóvel/agência.')
    }
    if(existing.exists){
      const old=existing.data()
      if(old.createdBy!==uid||old.propertyId!==propertyId||old.agencyId!==agencyId
        ||old.contentSha256!==prepared.contentSha256||old.basedOnVersionId!== (basedOnVersionId??null))
        throw fail(409,'Identificador de gravação já utilizado com outro conteúdo.')
      return {id:ref.id,version:old.version}
    }
    const version=(count.data()?.version??0)+1
    tx.create(ref,{propertyId,agencyId,version,createdBy:uid,createdByName:user.data().name,
      createdAt:FieldValue.serverTimestamp(),schemaVersion:prepared.leitura.schemaVersion,
      revision:prepared.leitura.revision,contentSha256:prepared.contentSha256,leitura:prepared.leitura,
      basedOnVersionId:basedOnVersionId??null})
    tx.set(counter,{version})
    return {id:ref.id,version}
  })
}
export function criarServidorLeituras({db,auth,origin}){
  if(!origin||new URL(origin).origin!==origin) throw new Error('Configure uma origem exata para o painel.')
  let running=0
  const server=http.createServer(async(req,res)=>{
    const headers={'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','vary':'Origin'}
    const respond=(status,data)=>res.writeHead(status,headers).end(JSON.stringify(data))
    if(req.headers.origin&&req.headers.origin!==origin){respond(403,{error:'Origem não permitida.'});return}
    headers['access-control-allow-origin']=origin
    headers['access-control-allow-headers']='Authorization, Content-Type'
    headers['access-control-allow-methods']='POST, OPTIONS'
    if(req.url!=='/property-readings'){respond(404,{error:'Rota inexistente.'});return}
    if(req.method==='OPTIONS'){respond(204,{});return}
    if(req.method!=='POST'){respond(405,{error:'Somente criação de versão é permitida.'});return}
    if(running>=4){respond(429,{error:'Tente novamente em instantes.'});return}
    running++
    try{
      if(!req.headers.authorization?.startsWith('Bearer ')) throw fail(401,'Autenticação necessária.')
      let token
      try{token=await auth.verifyIdToken(req.headers.authorization.slice(7),true)}catch{throw fail(401,'Sessão inválida ou expirada.')}
      if(!req.headers['content-type']?.startsWith('application/json')) throw fail(415,'Envie JSON.')
      let size=0;const chunks=[]
      for await(const chunk of req){size+=chunk.length;if(size>512*1024) throw fail(413,'Requisição muito grande.');chunks.push(chunk)}
      let input;try{input=JSON.parse(Buffer.concat(chunks).toString('utf8'))}catch{throw fail(400,'JSON inválido.')}
      respond(200,await criarVersao(db,token.uid,input))
    }catch(e){respond(e.status??500,{error:e.status?e.message:'Não foi possível salvar a versão.'})}
    finally{running--}
  })
  server.requestTimeout=15000;server.headersTimeout=15000
  return server
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const projectId=process.env.GCLOUD_PROJECT,origin=process.env.READINGS_ALLOWED_ORIGIN
  if(!projectId) throw new Error('GCLOUD_PROJECT obrigatório.')
  const emulated=process.env.FIRESTORE_EMULATOR_HOST||process.env.FIREBASE_AUTH_EMULATOR_HOST
  if(emulated&&(!projectId.startsWith('demo-')||!process.env.FIRESTORE_EMULATOR_HOST||!process.env.FIREBASE_AUTH_EMULATOR_HOST))
    throw new Error('Emulação exige projeto demo e Auth/Firestore locais juntos.')
  const app=initializeApp({projectId})
  criarServidorLeituras({db:getFirestore(app),auth:getAuth(app),origin}).listen(Number(process.env.PORT??5056),'127.0.0.1',()=>console.log('API de leituras pronta.'))
}

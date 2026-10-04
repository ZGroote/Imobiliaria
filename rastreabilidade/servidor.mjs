import http from 'node:http'
import {createHmac,randomBytes,randomUUID} from 'node:crypto'
import {pathToFileURL} from 'node:url'

const fail=(status,message,code)=>Object.assign(new Error(message),{status,...(code?{code}:{})})
function origemExata(value){
  let url
  try{url=new URL(value)}catch{throw new Error('Configure uma origem exata para a rastreabilidade.')}
  if(url.origin!==value||url.username||url.password)throw new Error('Configure uma origem exata para a rastreabilidade.')
  if(url.protocol!=='https:'&&!(url.protocol==='http:'&&['127.0.0.1','localhost','[::1]'].includes(url.hostname)))
    throw new Error('Use HTTPS fora do ambiente local.')
  return value
}
async function corpo(req){
  if(!/^application\/json(?:\s*;.*)?$/i.test(req.headers['content-type']??''))throw fail(415,'Envie JSON.')
  const chunks=[];let size=0
  if(Number(req.headers['content-length'])>8192)throw fail(413,'Solicitação excede 8 KiB.')
  for await(const chunk of req){size+=chunk.length;if(size>8192)throw fail(413,'Solicitação excede 8 KiB.');chunks.push(chunk)}
  let input
  try{input=JSON.parse(Buffer.concat(chunks).toString('utf8'))}catch{throw fail(400,'JSON inválido.')}
  if(!input||typeof input!=='object'||Array.isArray(input))throw fail(400,'Envie um objeto JSON.')
  return input
}
function query(url,allowed){
  const result={}
  for(const [key,value] of url.searchParams){
    if(!allowed.includes(key)||Object.hasOwn(result,key))throw fail(400,'Parâmetros inválidos.')
    result[key]=value
  }
  return result
}

export function criarServidorRastreabilidade({service,db,auth,secret,publicOrigin,panelOrigin,now=Date.now,
  requestsPerMinute=240,log=e=>console.log(JSON.stringify(e))}){
  const origins=new Set([origemExata(publicOrigin),origemExata(panelOrigin)])
  if(!Number.isSafeInteger(requestsPerMinute)||requestsPerMinute<1)throw new Error('Limite de frequência inválido.')
  const ipSalt=randomBytes(32),rates=new Map()
  let load
  const getService=()=>service??(load??=import('./modelo.mjs').then(({criarServicoRastreabilidade})=>
    criarServicoRastreabilidade({db,secret,publicOrigin,now})))
  async function usuario(req){
    const value=req.headers.authorization
    if(typeof value!=='string'||!value.startsWith('Bearer ')||!value.slice(7))throw fail(401,'Autenticação necessária.')
    try{
      const verified=await auth.verifyIdToken(value.slice(7),true)
      if(typeof verified.uid!=='string'||!verified.uid)throw new Error('uid ausente')
      return verified.uid
    }catch{throw fail(401,'Autenticação necessária.')}
  }
  function limitar(req){
    // Apenas digest efêmero em memória; endereço não é persistido nem registrado.
    // Não confiar em X-Forwarded-For enviado pelo cliente. Limite por conexão/edge.
    const key=createHmac('sha256',ipSalt).update(req.socket.remoteAddress??'unknown').digest('hex')
    const time=Date.now(),old=rates.get(key)
    if(!old||time-old.start>=60000){
      if(rates.size>=5000)for(const [k,v] of rates)if(time-v.start>=60000)rates.delete(k)
      if(rates.size>=5000&&!rates.has(key))throw fail(429,'Muitas solicitações. Tente novamente em instantes.')
      rates.set(key,{start:time,count:1});return
    }
    old.count++
    if(old.count>requestsPerMinute)throw fail(429,'Muitas solicitações. Tente novamente em instantes.')
  }
  const server=http.createServer(async(req,res)=>{
    const requestId=randomUUID(),start=performance.now()
    let route='unknown',status=500
    const headers={'content-type':'application/json; charset=utf-8','cache-control':'no-store',
      'x-content-type-options':'nosniff','x-request-id':requestId,'vary':'Origin'}
    const respond=(code,body)=>{
      status=code
      if(code===429)headers['retry-after']='60'
      if(code===413)headers.connection='close'
      res.writeHead(code,headers).end(code===204||req.method==='HEAD'?undefined:JSON.stringify(body))
    }
    try{
      if(req.headers.origin&&!origins.has(req.headers.origin))throw fail(403,'Origem não permitida.')
      if(req.headers.origin)headers['access-control-allow-origin']=req.headers.origin
      headers['access-control-allow-headers']='Authorization, Content-Type'
      headers['access-control-allow-methods']='GET, POST, OPTIONS'
      const url=new URL(req.url,'http://localhost'),path=url.pathname
      const revoke=path.match(/^\/links\/([A-Za-z0-9_-]{32})\/revoke$/)
      route=revoke?'/links/:id/revoke':(['/links','/open','/sessions','/events','/report'].includes(path)?path:'unknown')
      if(route==='unknown')throw fail(404,'Rota não encontrada.')
      if(req.method==='OPTIONS'){respond(204);return}
      const expected=path==='/report'?'GET':path==='/links'?['GET','POST']:'POST'
      if(!(Array.isArray(expected)?expected:[expected]).includes(req.method))throw fail(405,'Método não permitido.')
      limitar(req)
      const privateRoute=path==='/links'||path==='/report'||!!revoke
      const uid=privateRoute?await usuario(req):null
      const input=req.method==='GET'?query(url,path==='/links'?['propertyId']:['propertyId','from','to','brokerUid']):await corpo(req)
      if(req.method==='POST'&&url.search)throw fail(400,'Parâmetros inválidos.')
      if(revoke&&Object.keys(input).length)throw fail(400,'Parâmetros inválidos.')
      const api=await getService()
      let result
      if(path==='/links')result=req.method==='GET'?await api.listarLinks(uid,input):await api.criarLink(uid,input)
      else if(revoke)result=await api.revogarLink(uid,revoke[1])
      else if(path==='/open')result=await api.abrirVisita(input)
      else if(path==='/sessions')result=await api.criarSessao(input)
      else if(path==='/events')result=await api.registrarEvento(input)
      else result=await api.gerarRelatorio(uid,input)
      respond(200,result)
    }catch(error){
      const safe=Number.isInteger(error?.status)&&error.status>=400&&error.status<500
      respond(safe?error.status:503,{error:safe?error.message:'Serviço indisponível. Tente novamente em instantes.',
        ...(safe&&typeof error.code==='string'&&/^[A-Z_]{1,40}$/.test(error.code)?{code:error.code}:{})})
    }finally{
      try{log({event:'tracking_request',entryPoint:'tracking_http',requestId,route,status,durationMs:Math.round(performance.now()-start)})}catch{}
    }
  })
  server.requestTimeout=10000;server.headersTimeout=10000
  return server
}

export async function iniciarRastreabilidade(env=process.env){
  const project=env.GCLOUD_PROJECT
  if(!project||!env.TRACKING_SECRET||env.TRACKING_SECRET.length<32)
    throw new Error('Configure GCLOUD_PROJECT e TRACKING_SECRET de pelo menos 32 caracteres.')
  const emulated=!!(env.FIRESTORE_EMULATOR_HOST||env.FIREBASE_AUTH_EMULATOR_HOST)
  if(emulated&&(!project.startsWith('demo-')||!env.FIRESTORE_EMULATOR_HOST||!env.FIREBASE_AUTH_EMULATOR_HOST))
    throw new Error('Auth e Firestore emulados devem estar juntos num projeto demo-.')
  const [{initializeApp},{getFirestore},{getAuth}]=await Promise.all([
    import('firebase-admin/app'),import('firebase-admin/firestore'),import('firebase-admin/auth')])
  const app=initializeApp({projectId:project},'rastreabilidade-'+randomUUID())
  const server=criarServidorRastreabilidade({db:getFirestore(app),auth:getAuth(app),secret:env.TRACKING_SECRET,
    publicOrigin:env.TRACKING_PUBLIC_ORIGIN,panelOrigin:env.TRACKING_PANEL_ORIGIN})
  const port=Number(env.PORT??5057),host=env.TRACKING_BIND_HOST??'127.0.0.1'
  if(!Number.isInteger(port)||port<1||port>65535)throw new Error('Porta inválida.')
  server.listen(port,host,()=>console.log(JSON.stringify({event:'tracking_ready',entryPoint:'tracking_http',port})))
  return server
}
if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url){
  iniciarRastreabilidade().catch(()=>{console.error('API de rastreabilidade não iniciou. Confira a configuração.');process.exitCode=1})
}

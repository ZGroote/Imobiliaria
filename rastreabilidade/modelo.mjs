import {randomBytes,createHash,createHmac,timingSafeEqual} from 'node:crypto'
import {resumir} from './relatorios.mjs'

export const DAY=86400000,RETENTION_DAYS=30,SESSION_IDLE_MS=30*60000,MAX_DEPTH=8
export const paginas=new Set(['tour','maquete'])
export const secoes=new Set(['ficha','mapa','interior','planta','maquete','planta2d','planta3d','visita','carregando'])
export const erro=(status,message,code)=>Object.assign(new Error(message),{status,...(code?{code}:{})})
export const millis=v=>v?.toMillis?v.toMillis():v instanceof Date?v.getTime():new Date(v).getTime()
const opaque=()=>randomBytes(24).toString('base64url')
const digest=value=>createHash('sha256').update(value).digest('hex')
const identifier=v=>typeof v==='string'&&/^[a-zA-Z0-9_-]{1,128}$/.test(v)
const token=v=>typeof v==='string'&&/^[a-zA-Z0-9_-]{32}$/.test(v)
const label=(value,fallback,max)=>typeof value==='string'&&value.trim()?value.trim().slice(0,max):fallback
function campos(input,allowed,required=allowed){
  if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!allowed.includes(k))
    ||required.some(k=>input[k]===undefined))throw erro(400,'Campos inválidos.')
}

export function criarServicoRastreabilidade({db,secret,publicOrigin,now=Date.now}){
  if(typeof secret!=='string'||Buffer.byteLength(secret)<32)throw Error('Configure segredo de rastreabilidade com pelo menos 32 bytes.')
  if(!publicOrigin||new URL(publicOrigin).origin!==publicOrigin||!['http:','https:'].includes(new URL(publicOrigin).protocol))throw Error('Configure a origem pública exata.')
  const date=()=>new Date(now()),ref=(collection,id)=>db.doc(collection+'/'+id)
  const shareUrl=id=>publicOrigin+'/acesso.html?l='+id+'&pagina=maquete'
  const wireLink=link=>({id:link.id,propertyId:link.propertyId,agencyId:link.agencyId,brokerUid:link.brokerUid,
    brokerName:label(link.brokerName,'Corretor',200),status:link.status,createdAt:new Date(millis(link.createdAt)).toISOString(),url:shareUrl(link.id)})
  async function contexto(get,uid,propertyId){
    const [userSnap,propertySnap]=await Promise.all([get(ref('users',uid)),get(ref('properties',propertyId))])
    const user=userSnap.data(),property=propertySnap.data()
    if(!user||user.active!==true||!['platform_admin','operator','agency_manager','agent'].includes(user.role)
      ||!property||property.status!=='active'||!identifier(property.agencyId)
      ||(!['platform_admin','operator'].includes(user.role)&&user.agencyId!==property.agencyId))throw erro(403,'Sem permissão para este imóvel.')
    const agency=(await get(ref('agencies',property.agencyId))).data()
    if(agency?.active!==true)throw erro(403,'Agência inativa.')
    return {user,property}
  }
  async function corretor(get,brokerUid,agencyId){
    const user=(await get(ref('users',brokerUid))).data()
    if(user?.active!==true||user.role!=='agent'||user.agencyId!==agencyId)throw erro(403,'Corretor não pertence à agência ativa.')
    return user
  }
  const read=r=>r.get()
  async function criarLink(uid,input){
    campos(input,['propertyId','brokerUid','attemptId'],['propertyId','attemptId'])
    if(!identifier(uid)||!identifier(input.propertyId)||!identifier(input.attemptId)||(input.brokerUid!==undefined&&!identifier(input.brokerUid)))throw erro(400,'Identificadores inválidos.')
    const linkId=opaque(),attemptRef=ref('trackingAttempts',digest('root|'+uid+'|'+input.attemptId))
    return db.runTransaction(async tx=>{
      const get=r=>tx.get(r),{user,property}=await contexto(get,uid,input.propertyId)
      const brokerUid=input.brokerUid??uid
      if(user.role==='agent'&&brokerUid!==uid)throw erro(403,'Corretor gerencia somente seus links.')
      const broker=await corretor(get,brokerUid,property.agencyId)
      const payloadHash=digest(JSON.stringify([input.propertyId,brokerUid])),attempt=(await get(attemptRef)).data()
      if(attempt){
        if(attempt.payloadHash!==payloadHash)throw erro(409,'Tentativa reutilizada com outro conteúdo.')
        const existing=(await get(ref('trackingLinks',attempt.linkId))).data()
        if(!existing)throw erro(409,'A tentativa anterior não pode ser recuperada.')
        return {link:wireLink(existing)}
      }
      const createdAt=date(),link={id:linkId,schemaVersion:1,propertyId:input.propertyId,agencyId:property.agencyId,
        brokerUid,brokerName:label(broker.name,'Corretor',200),rootId:linkId,parentId:null,depth:0,status:'active',createdAt,expiresAt:null}
      tx.create(ref('trackingLinks',linkId),link)
      tx.create(attemptRef,{payloadHash,linkId,propertyId:link.propertyId,agencyId:link.agencyId,createdAt,expiresAt:new Date(createdAt.getTime()+RETENTION_DAYS*DAY)})
      return {link:wireLink(link)}
    })
  }
  async function listarLinks(uid,input){
    campos(input,['propertyId'])
    if(!identifier(uid)||!identifier(input.propertyId))throw erro(400,'Identificadores inválidos.')
    const {user,property}=await contexto(read,uid,input.propertyId)
    let query=db.collection('trackingLinks').where('propertyId','==',input.propertyId).where('agencyId','==',property.agencyId).where('parentId','==',null)
    if(user.role==='agent')query=query.where('brokerUid','==',uid)
    const docs=(await query.orderBy('createdAt','desc').limit(101).get()).docs
    return {links:docs.slice(0,100).map(s=>wireLink({...s.data(),id:s.id})),truncated:docs.length>100}
  }
  async function revogarLink(uid,id){
    if(!identifier(uid)||!token(id))throw erro(400,'Identificadores inválidos.')
    return db.runTransaction(async tx=>{
      const linkRef=ref('trackingLinks',id),link=(await tx.get(linkRef)).data()
      if(!link)throw erro(404,'Link não encontrado.')
      const {user,property}=await contexto(r=>tx.get(r),uid,link.propertyId)
      if(link.agencyId!==property.agencyId)throw erro(403,'Link pertence à agência anterior do imóvel.')
      if(user.role==='agent'&&link.brokerUid!==uid)throw erro(403,'Corretor gerencia somente seus links.')
      if(link.status!=='revoked')tx.update(linkRef,{status:'revoked',revokedAt:date()})
      return {ok:true}
    })
  }
  const receiptFor=id=>id+'.'+createHmac('sha256',secret).update('visit:v1:'+id).digest('base64url')
  function validarRecibo(visitId,receipt){
    const expected=receiptFor(visitId)
    if(!token(visitId)||typeof receipt!=='string'||!/^[a-zA-Z0-9_-]{32}\.[a-zA-Z0-9_-]{43}$/.test(receipt)
      ||!timingSafeEqual(Buffer.from(receipt),Buffer.from(expected)))throw erro(403,'Recibo inválido.')
  }
  async function visitar(get,visitId,receipt){
    validarRecibo(visitId,receipt)
    const visit=(await get(ref('trackingVisits',visitId))).data()
    if(!visit||visit.receiptHash!==digest(receipt))throw erro(403,'Recibo inválido.')
    if(millis(visit.expiresAt)<=now())throw erro(410,'A visita expirou.','VISIT_EXPIRED')
    return visit
  }
  async function publicacao(get,id){
    let link=(await get(ref('trackingLinks',id))).data(),current=link
    const seen=new Set()
    while(current){
      if(seen.has(current.id)||seen.size>MAX_DEPTH||current.status!=='active'
        ||(current.expiresAt&&millis(current.expiresAt)<=now()))throw erro(410,'Link indisponível.','LINK_DISABLED')
      seen.add(current.id)
      if(current.rootId!==link.rootId||current.propertyId!==link.propertyId||current.agencyId!==link.agencyId
        ||current.brokerUid!==link.brokerUid)throw erro(410,'Link indisponível.','LINK_DISABLED')
      if(current.parentId===null){if(current.id!==link.rootId)throw erro(410,'Link indisponível.','LINK_DISABLED');break}
      current=(await get(ref('trackingLinks',current.parentId))).data()
      if(!current)throw erro(410,'Link indisponível.','LINK_DISABLED')
    }
    if(!link||!current)throw erro(410,'Link indisponível.','LINK_DISABLED')
    const [propertySnap,brokerSnap,agencySnap]=await Promise.all([
      get(ref('properties',link.propertyId)),get(ref('users',link.brokerUid)),get(ref('agencies',link.agencyId))])
    const property=propertySnap.data(),broker=brokerSnap.data(),agency=agencySnap.data()
    if(property?.status!=='active'||property.agencyId!==link.agencyId||agency?.active!==true
      ||broker?.active!==true||broker.role!=='agent'||broker.agencyId!==link.agencyId
      ||typeof property.pipelineUnitId!=='string'||property.pipelineUnitId.length>128||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(property.pipelineUnitId)
      ||!/^[0-9a-f]{12}$/.test(property.publishedBuild??''))
      throw erro(410,'Publicação indisponível.','LINK_DISABLED')
    return {link,property,broker}
  }
  function abertura(visit,context,sourceClass=visit.sourceClass){
    const {property,broker}=context,base=publicOrigin+'/b/'+property.pipelineUnitId+'/'+property.publishedBuild+'/'
    const phone=broker.publicContact?.whatsapp
    return {visitId:visit.id,receipt:receiptFor(visit.id),shareToken:visit.canonicalLinkId,
      shareUrl:shareUrl(visit.canonicalLinkId),sourceClass,destinations:{tour:base+'tour.html',maquete:base+'maquete.html'},
      publishedBuild:property.publishedBuild,propertyTitle:label(property.title,'Imóvel',500),
      contact:{brokerName:label(broker.name,'Corretor',200),whatsappNumber:typeof phone==='string'&&/^[1-9][0-9]{7,14}$/.test(phone)?phone:null},
      ...(visit.lineageLimited?{lineageLimited:true}:{})}
  }
  async function abrirVisita(input){
    campos(input,['token','attemptId','receipt'],['token','attemptId'])
    if(!token(input.token)||!identifier(input.attemptId))throw erro(400,'Identificadores inválidos.')
    const visitId=opaque(),childId=opaque(),attemptRef=ref('trackingAttempts',digest('open|'+input.attemptId))
    const payloadHash=digest(JSON.stringify([input.token,input.receipt??null]))
    return db.runTransaction(async tx=>{
      const get=r=>tx.get(r),context=await publicacao(get,input.token),attempt=(await get(attemptRef)).data()
      if(attempt){
        if(attempt.payloadHash!==payloadHash)throw erro(409,'Tentativa reutilizada com outro conteúdo.')
        const visit=await visitar(get,attempt.visitId,receiptFor(attempt.visitId))
        return abertura(visit,context,attempt.sourceClass)
      }
      const createdAt=date(),expiresAt=new Date(createdAt.getTime()+RETENTION_DAYS*DAY)
      if(input.receipt!==undefined){
        const id=typeof input.receipt==='string'?input.receipt.split('.')[0]:''
        const visit=await visitar(get,id,input.receipt)
        if(![visit.sourceLinkId,visit.canonicalLinkId].includes(input.token))throw erro(403,'Recibo pertence a outra entrada.')
        tx.update(ref('trackingVisits',id),{lastOpeningClass:'own_return',lastOpenedAt:createdAt})
        tx.create(attemptRef,{payloadHash,visitId:id,propertyId:visit.propertyId,agencyId:visit.agencyId,sourceClass:'own_return',createdAt,expiresAt})
        return abertura(visit,context,'own_return')
      }
      const {link}=context,lineageLimited=link.depth>=MAX_DEPTH
      const sourceClass=lineageLimited?'uncertain':link.depth===0?'root':'forwarded'
      const visit={id:visitId,schemaVersion:1,propertyId:link.propertyId,agencyId:link.agencyId,brokerUid:link.brokerUid,
        rootId:link.rootId,sourceLinkId:link.id,canonicalLinkId:lineageLimited?link.id:childId,sourceClass,
        lastOpeningClass:sourceClass,receiptHash:digest(receiptFor(visitId)),createdAt,expiresAt,lineageLimited}
      if(!lineageLimited)tx.create(ref('trackingLinks',childId),{id:childId,schemaVersion:1,propertyId:link.propertyId,
        agencyId:link.agencyId,brokerUid:link.brokerUid,brokerName:label(context.broker.name,'Corretor',200),rootId:link.rootId,
        parentId:link.id,depth:link.depth+1,issuedByVisitId:visitId,status:'active',createdAt,expiresAt})
      tx.create(ref('trackingVisits',visitId),visit)
      tx.create(attemptRef,{payloadHash,visitId,propertyId:visit.propertyId,agencyId:visit.agencyId,sourceClass,createdAt,expiresAt})
      return abertura(visit,context)
    })
  }
  async function criarSessao(input){
    campos(input,['visitId','receipt','visitorKey','page'])
    if(!token(input.visitId)||typeof input.visitorKey!=='string'||!/^[a-zA-Z0-9_-]{16,128}$/.test(input.visitorKey)
      ||!paginas.has(input.page))throw erro(400,'Dados de sessão inválidos.')
    const sessionId=opaque()
    return db.runTransaction(async tx=>{
      const get=r=>tx.get(r),visit=await visitar(get,input.visitId,input.receipt)
      const context=await publicacao(get,visit.canonicalLinkId)
      const visitorHash=createHmac('sha256',secret).update('visitor:v1:'+visit.propertyId+'|'+input.visitorKey).digest('hex')
      const previous=visit.activeSessionId?(await get(ref('trackingSessions',visit.activeSessionId))).data():null
      if(previous&&previous.visitorHash===visitorHash&&millis(previous.expiresAt)>now()&&now()-millis(previous.lastAcceptedAt)<SESSION_IDLE_MS){
        return {sessionId:previous.id,nextSeq:previous.lastSeq+1}
      }
      const createdAt=date(),session={id:sessionId,schemaVersion:1,visitId:visit.id,propertyId:visit.propertyId,
        agencyId:visit.agencyId,brokerUid:visit.brokerUid,brokerName:label(context.broker.name,'Corretor',200),rootId:visit.rootId,
        sourceClass:previous?'own_return':visit.lastOpeningClass,visitorHash,consentGranted:true,consentPolicyVersion:1,
        consentedAt:createdAt,startedAt:createdAt,lastAcceptedAt:createdAt,expiresAt:new Date(createdAt.getTime()+RETENTION_DAYS*DAY),
        lastSeq:0,recentPayloadHashes:{},lastPage:null,lastSection:null,pageViews:0,activeMs:0,sections:{}}
      tx.create(ref('trackingSessions',sessionId),session)
      tx.update(ref('trackingVisits',visit.id),{activeSessionId:sessionId})
      return {sessionId,nextSeq:1}
    })
  }
  async function registrarEvento(input){
    campos(input,['visitId','receipt','sessionId','seq','type','page','section','activeMs'])
    if(!token(input.visitId)||!token(input.sessionId)||!Number.isSafeInteger(input.seq)||input.seq<1
      ||!['view','heartbeat','pause'].includes(input.type)||!paginas.has(input.page)||!secoes.has(input.section)
      ||!Number.isSafeInteger(input.activeMs)||input.activeMs<0||input.activeMs>30000)throw erro(400,'Evento inválido.')
    const payloadHash=digest(JSON.stringify([input.type,input.page,input.section,input.activeMs]))
    return db.runTransaction(async tx=>{
      const get=r=>tx.get(r),visit=await visitar(get,input.visitId,input.receipt)
      await publicacao(get,visit.canonicalLinkId)
      const sessionRef=ref('trackingSessions',input.sessionId),session=(await get(sessionRef)).data()
      if(!session||session.visitId!==visit.id)throw erro(403,'Sessão não pertence à visita.')
      if(visit.activeSessionId!==session.id||session.consentGranted!==true||millis(session.expiresAt)<=now()||now()-millis(session.lastAcceptedAt)>=SESSION_IDLE_MS)
        throw erro(410,'A sessão de coleta expirou.','SESSION_EXPIRED')
      if(input.seq<=session.lastSeq){
        if(!session.recentPayloadHashes[String(input.seq)]||session.recentPayloadHashes[String(input.seq)]!==payloadHash)
          throw erro(409,'Sequência reutilizada com outro conteúdo ou fora da janela de dedupe.','EVENT_CONFLICT')
        return {accepted:false,seq:input.seq}
      }
      if(input.seq!==session.lastSeq+1)throw erro(409,'Sequência fora de ordem.','EVENT_CONFLICT')
      const activeMs=Math.min(input.activeMs,Math.max(0,now()-millis(session.lastAcceptedAt)),30000)
      const key=input.page+':'+input.section,sections={...session.sections}
      const bucket={...(sections[key]??{page:input.page,section:input.section,views:0,activeMs:0})}
      const changedPage=input.page!==session.lastPage,changedSection=changedPage||input.section!==session.lastSection
      if(input.type==='view'&&changedSection)bucket.views++
      bucket.activeMs+=activeMs;sections[key]=bucket
      const recent={...session.recentPayloadHashes,[input.seq]:payloadHash}
      for(const seq of Object.keys(recent))if(Number(seq)<=input.seq-32)delete recent[seq]
      tx.update(sessionRef,{lastSeq:input.seq,recentPayloadHashes:recent,lastAcceptedAt:date(),
        lastPage:input.page,lastSection:input.section,sections,
        pageViews:session.pageViews+(input.type==='view'&&changedPage?1:0),activeMs:session.activeMs+activeMs})
      return {accepted:true,seq:input.seq}
    })
  }
  async function gerarRelatorio(uid,input){
    campos(input,['propertyId','from','to','brokerUid'],['propertyId','from','to'])
    const validIso=value=>{
      if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)||!Number.isFinite(Date.parse(value)))return false
      const normalized=new Date(value).toISOString()
      return value===normalized||value===normalized.replace('.000Z','Z')
    }
    if(!identifier(uid)||!identifier(input.propertyId)||!validIso(input.from)||!validIso(input.to)
      ||Date.parse(input.from)>=Date.parse(input.to)||Date.parse(input.to)-Date.parse(input.from)>RETENTION_DAYS*DAY
      ||(input.brokerUid!==undefined&&!identifier(input.brokerUid)))throw erro(400,'Período ou identificadores inválidos; máximo de 30 dias UTC.')
    const {user,property}=await contexto(read,uid,input.propertyId)
    if(user.role==='agent'&&input.brokerUid!==undefined&&input.brokerUid!==uid)throw erro(403,'Corretor consulta somente seus resultados.')
    const brokerUid=user.role==='agent'?uid:input.brokerUid
    if(brokerUid)await corretor(read,brokerUid,property.agencyId)
    const retentionStart=now()-RETENTION_DAYS*DAY,from=new Date(Math.max(Date.parse(input.from),retentionStart)),to=new Date(input.to)
    let query=db.collection('trackingSessions').where('propertyId','==',input.propertyId).where('agencyId','==',property.agencyId)
    if(brokerUid)query=query.where('brokerUid','==',brokerUid)
    const docs=from<to?(await query.where('startedAt','>=',from).where('startedAt','<',to).orderBy('startedAt','asc').limit(501).get()).docs:[]
    return resumir(docs.slice(0,500).map(s=>s.data()),{propertyId:input.propertyId,from:input.from,to:input.to,
      now:now(),truncated:docs.length>500})
  }
  return {criarLink,listarLinks,revogarLink,abrirVisita,criarSessao,registrarEvento,gerarRelatorio}
}

import test from 'node:test'
import assert from 'node:assert/strict'
import {criarServicoRastreabilidade} from '../rastreabilidade/modelo.mjs'

// Adaptador só de teste: as operações de negócio usam a API Firestore, não Maps.
export function bancoFake(seed={}) {
  const data=new Map(Object.entries(seed).map(([k,v])=>[k,structuredClone(v)]))
  const snapshot=path=>({id:path.split('/').at(-1),exists:data.has(path),data:()=>structuredClone(data.get(path))})
  let tail=Promise.resolve()
  const doc=path=>({path,id:path.split('/').at(-1),get:async()=>snapshot(path),set:async v=>data.set(path,structuredClone(v))})
  function query(collection,filters=[],sort=[],max=Infinity){
    return {
      where:(field,op,value)=>query(collection,[...filters,[field,op,value]],sort,max),
      orderBy:(field,direction='asc')=>query(collection,filters,[...sort,[field,direction]],max),
      limit:n=>query(collection,filters,sort,n),
      async get(){
        const rows=[...data.keys()].filter(k=>k.startsWith(collection+'/')&&k.split('/').length===2)
          .filter(k=>filters.every(([f,op,v])=>{const a=data.get(k)[f];return op==='=='?a===v:op==='>='?a>=v:op==='>'?a>v:op==='<'?a<v:a<=v}))
          .sort((a,b)=>{for(const [f,d] of sort){const x=data.get(a)[f],y=data.get(b)[f];if(x<y)return d==='asc'?-1:1;if(x>y)return d==='asc'?1:-1}return a.localeCompare(b)})
        const docs=rows.slice(0,max).map(snapshot);return {docs,size:docs.length,empty:!docs.length}
      },
    }
  }
  return {data,doc,collection:name=>query(name),runTransaction:fn=>{
    const pending=tail.then(async()=>{
      const writes=[]
      const tx={get:async ref=>{assert.equal(writes.length,0,'Firestore exige todas as leituras antes das escritas');return ref.get()},
        getAll:async(...refs)=>Promise.all(refs.map(r=>tx.get(r))),
        create:(ref,value)=>writes.push(()=>{assert(!data.has(ref.path));data.set(ref.path,structuredClone(value))}),
        set:(ref,value)=>writes.push(()=>data.set(ref.path,structuredClone(value))),
        update:(ref,value)=>writes.push(()=>data.set(ref.path,{...data.get(ref.path),...structuredClone(value)}))}
      const result=await fn(tx);for(const write of writes)write();return result
    });tail=pending.catch(()=>{});return pending
  }}
}
export function fixture(){
  const publicOrigin='https://publico.test',panelOrigin='https://painel.test'
  const db=bancoFake({
    'agencies/a':{active:true},'agencies/b':{active:true},
    'users/admin':{role:'platform_admin',active:true,name:'Equipe'},
    'users/manager':{role:'agency_manager',agencyId:'a',active:true,name:'Gerente'},
    'users/brokerA':{role:'agent',agencyId:'a',active:true,name:'Corretor A',publicContact:{whatsapp:'5511999999999'}},
    'users/brokerB':{role:'agent',agencyId:'a',active:true,name:'Corretor B'},
    'users/outsider':{role:'agent',agencyId:'b',active:true,name:'Outro'},
    'properties/p':{agencyId:'a',status:'active',title:'Imóvel de teste',pipelineUnitId:'imovel-p',publishedBuild:'123456abcdef'},
    'properties/q':{agencyId:'b',status:'active',title:'Outro imóvel',pipelineUnitId:'imovel-q',publishedBuild:'abcdef123456'},
  })
  let ms=Date.parse('2026-10-04T12:00:00Z')
  const options={db,secret:'segredo-sintetico-apenas-testes-123456789',publicOrigin,panelOrigin,now:()=>ms}
  return {db,options,service:criarServicoRastreabilidade(options),advance:n=>{ms+=n}}
}

test('raízes de dois corretores são opacas e criação repetida é idempotente',async()=>{
  const {service,db}=fixture()
  const input={propertyId:'p',brokerUid:'brokerA',attemptId:'tentativa-a'}
  const [a,retry]=await Promise.all([service.criarLink('manager',input),service.criarLink('manager',input)])
  const b=await service.criarLink('brokerB',{propertyId:'p',attemptId:'tentativa-b'})
  assert.deepEqual(a,retry);assert.notEqual(a.link.id,b.link.id)
  assert.match(a.link.id,/^[A-Za-z0-9_-]{32}$/)
  assert.equal(new URL(a.link.url).searchParams.get('l'),a.link.id)
  assert.equal(a.link.url.includes('brokerA'),false)
  assert.equal([...db.data.keys()].filter(k=>k.startsWith('trackingLinks/')).length,2)
  assert.equal((await service.listarLinks('brokerA',{propertyId:'p'})).links.length,1)
  await assert.rejects(service.criarLink('manager',{...input,brokerUid:'brokerB'}),{status:409})
})

test('autoridade viva impede agência cruzada, agência imóvel e corretor inativos',async()=>{
  const {service,db}=fixture()
  await assert.rejects(service.criarLink('brokerA',{propertyId:'p',brokerUid:'brokerB',attemptId:'a'}),{status:403})
  await assert.rejects(service.criarLink('outsider',{propertyId:'p',attemptId:'b'}),{status:403})
  await assert.rejects(service.criarLink('manager',{propertyId:'p',brokerUid:'outsider',attemptId:'c'}),{status:403})
  for(const [path,field,bad] of [['users/brokerA','active',false],['agencies/a','active',false],['properties/p','status','inactive']]){
    const old=structuredClone(db.data.get(path));db.data.set(path,{...old,[field]:bad})
    await assert.rejects(service.criarLink('manager',{propertyId:'p',brokerUid:'brokerA',attemptId:path.replace('/','-')}),{status:403})
    db.data.set(path,old)
  }
})

test('entrada, cópia e retomada conservam raiz/corretor sem repetir filhos',async()=>{
  const {service,db}=fixture()
  const {link}=await service.criarLink('brokerA',{propertyId:'p',attemptId:'raiz'})
  const a=await service.abrirVisita({token:link.id,attemptId:'entrada-a'})
  assert.equal(a.sourceClass,'root');assert.equal(a.contact.brokerName,'Corretor A')
  assert.equal(a.contact.whatsappNumber,'5511999999999')
  assert.equal(a.destinations.maquete,'https://publico.test/b/imovel-p/123456abcdef/maquete.html')
  assert.equal(a.shareUrl.includes(a.receipt),false)
  assert.equal(JSON.stringify([...db.data.values()]).includes(a.receipt),false)
  assert.deepEqual(await service.abrirVisita({token:link.id,attemptId:'entrada-a'}),a)
  const b=await service.abrirVisita({token:a.shareToken,attemptId:'entrada-b'})
  assert.equal(b.sourceClass,'forwarded');assert.equal(b.contact.brokerName,a.contact.brokerName)
  const count=[...db.data.keys()].filter(k=>k.startsWith('trackingLinks/')).length
  for(const token of [link.id,a.shareToken]){
    const resumed=await service.abrirVisita({token,attemptId:'retomar-'+token,receipt:a.receipt})
    assert.equal(resumed.visitId,a.visitId);assert.equal(resumed.shareToken,a.shareToken)
    assert.equal(resumed.sourceClass,'own_return')
  }
  assert.equal([...db.data.keys()].filter(k=>k.startsWith('trackingLinks/')).length,count)
  assert.equal([...db.data.keys()].filter(k=>k.startsWith('trackingSessions/')).length,0)
  const other=(await service.criarLink('brokerB',{propertyId:'p',attemptId:'outra-raiz'})).link
  await assert.rejects(service.abrirVisita({token:other.id,attemptId:'troca',receipt:a.receipt}),{status:403})
  await assert.rejects(service.abrirVisita({token:link.id,attemptId:'entrada-a',brokerUid:'brokerB'}),{status:400})
})

test('revogação da raiz, recibo adulterado e publicação inválida impedem resolução',async()=>{
  const {service,db}=fixture()
  const {link}=await service.criarLink('brokerA',{propertyId:'p',attemptId:'raiz'})
  const a=await service.abrirVisita({token:link.id,attemptId:'a'})
  await assert.rejects(service.abrirVisita({token:a.shareToken,attemptId:'bad',receipt:a.receipt+'x'}),{status:403})
  await assert.rejects(service.revogarLink('brokerB',link.id),{status:403})
  const property=db.data.get('properties/p');db.data.set('properties/p',{...property,pipelineUnitId:'../outro'})
  await assert.rejects(service.abrirVisita({token:link.id,attemptId:'redirect'}),{status:410,code:'LINK_DISABLED'})
  db.data.set('properties/p',property)
  await service.revogarLink('brokerA',link.id)
  await assert.rejects(service.abrirVisita({token:a.shareToken,attemptId:'depois'}),{status:410,code:'LINK_DISABLED'})
})

test('limite de linhagem conserva compartilhamento e marca origem limitada',async()=>{
  const {service}=fixture();const {link}=await service.criarLink('brokerA',{propertyId:'p',attemptId:'raiz'})
  let token=link.id,opening
  for(let i=0;i<10;i++){opening=await service.abrirVisita({token,attemptId:'pessoa-'+i});token=opening.shareToken}
  assert.equal(opening.lineageLimited,true);assert.equal(opening.sourceClass,'uncertain')
})

test('sessão consentida é idempotente e eventos não duplicam ou excedem tempo observado',async()=>{
  const {service,db,advance}=fixture();const {link}=await service.criarLink('brokerA',{propertyId:'p',attemptId:'raiz'})
  const a=await service.abrirVisita({token:link.id,attemptId:'a'})
  const request={visitId:a.visitId,receipt:a.receipt,visitorKey:'browser-sintetico-123456789',page:'maquete'}
  await assert.rejects(service.criarSessao({...request,visitorKey:undefined}),{status:400})
  const session=await service.criarSessao(request)
  assert.equal(session.nextSeq,1)
  assert.deepEqual(await service.criarSessao(request),session)
  const base={visitId:a.visitId,receipt:a.receipt,sessionId:session.sessionId,page:'maquete',section:'planta2d'}
  await service.registrarEvento({...base,seq:1,type:'view',activeMs:0})
  advance(10000)
  const event={...base,seq:2,type:'heartbeat',activeMs:30000}
  assert.deepEqual(await service.registrarEvento(event),{accepted:true,seq:2})
  assert.deepEqual(await service.registrarEvento(event),{accepted:false,seq:2})
  await assert.rejects(service.registrarEvento({...event,activeMs:1}),{status:409})
  await assert.rejects(service.registrarEvento({...event,seq:4}),{status:409})
  for(const activeMs of [-1,Infinity,1.5,30001])await assert.rejects(service.registrarEvento({...event,seq:3,activeMs}),{status:400})
  await service.registrarEvento({...base,seq:3,type:'view',section:'planta3d',activeMs:0})
  assert.equal((await service.criarSessao(request)).nextSeq,4)
  const stored=db.data.get('trackingSessions/'+session.sessionId)
  assert.equal(stored.activeMs,10000);assert.equal(stored.pageViews,1)
  assert.equal(stored.sections['maquete:planta2d'].views,1)
  assert.equal(stored.sections['maquete:planta3d'].views,1)
  assert.equal(JSON.stringify(stored).includes(request.visitorKey),false)
  assert.equal(JSON.stringify(stored).includes(a.receipt),false)
})

test('recibo, expiração e revogação governam sessão e eventos',async()=>{
  const {service,advance,db}=fixture();const {link}=await service.criarLink('brokerA',{propertyId:'p',attemptId:'raiz'})
  const a=await service.abrirVisita({token:link.id,attemptId:'a'})
  const request={visitId:a.visitId,receipt:a.receipt,visitorKey:'navegador-local-123456789',page:'tour'}
  const session=await service.criarSessao(request)
  const event={visitId:a.visitId,receipt:a.receipt,sessionId:session.sessionId,seq:1,type:'view',page:'tour',section:'mapa',activeMs:0}
  await assert.rejects(service.registrarEvento({...event,receipt:a.receipt.replace(/.$/,'!')}),{status:403})
  advance(30*60000)
  await assert.rejects(service.registrarEvento(event),{status:410,code:'SESSION_EXPIRED'})
  const next=await service.criarSessao(request);assert.notEqual(next.sessionId,session.sessionId)
  assert.equal(db.data.get('trackingSessions/'+next.sessionId).sourceClass,'own_return')
  await service.revogarLink('brokerA',link.id)
  await assert.rejects(service.registrarEvento({...event,sessionId:next.sessionId}),{status:410,code:'LINK_DISABLED'})
  advance(30*86400000)
  await assert.rejects(service.criarSessao(request),{status:410,code:'VISIT_EXPIRED'})
})

test('relatório deduplica navegadores entre dias/corretores e isola agência e papel',async()=>{
  const {service,advance}=fixture()
  const a=(await service.criarLink('brokerA',{propertyId:'p',attemptId:'raiz-a'})).link
  const b=(await service.criarLink('brokerB',{propertyId:'p',attemptId:'raiz-b'})).link
  let openingA=await service.abrirVisita({token:a.id,attemptId:'a'}),seq
  for(const [i,token] of [a.id,b.id,openingA.shareToken].entries()){
    const opening=i===0?openingA:await service.abrirVisita({token,attemptId:'novo-'+i})
    const {sessionId}=await service.criarSessao({visitId:opening.visitId,receipt:opening.receipt,
      visitorKey:'mesmo-browser-123456789',page:'tour'})
    seq={visitId:opening.visitId,receipt:opening.receipt,sessionId,page:'tour',section:'mapa'}
    await service.registrarEvento({...seq,seq:1,type:'view',activeMs:0})
    advance(10000);await service.registrarEvento({...seq,seq:2,type:'heartbeat',activeMs:10000})
    advance(86400000)
  }
  const request={propertyId:'p',from:'2026-10-04T00:00:00Z',to:'2026-10-08T00:00:00Z'}
  const r=await service.gerarRelatorio('manager',request)
  assert.equal(r.summary.sessions,3);assert.equal(r.summary.estimatedVisitors,1)
  assert.equal(r.summary.rootEntries,2);assert.equal(r.summary.forwardedEntries,1)
  assert.equal(r.summary.activeMs,30000);assert.equal(r.bySection[0].activeMs,30000)
  assert.equal(r.byBroker.length,2);assert.equal(r.byBroker.reduce((n,b)=>n+b.estimatedVisitors,0),2)
  assert.equal(r.coverage.consentedOnly,true);assert.equal(r.coverage.truncated,false)
  assert.equal(JSON.stringify(r).includes('visitorHash'),false)
  assert.equal(JSON.stringify(r).includes(openingA.receipt),false)
  assert.equal((await service.gerarRelatorio('brokerA',request)).summary.sessions,2)
  await assert.rejects(service.gerarRelatorio('outsider',request),{status:403})
  await assert.rejects(service.gerarRelatorio('brokerA',{...request,brokerUid:'brokerB'}),{status:403})
  await assert.rejects(service.gerarRelatorio('manager',{...request,to:'2026-12-01T00:00:00Z'}),{status:400})
})

test('retenção é filtrada antes do TTL e relatórios limitados indicam parcial',async()=>{
  const {service,db,advance}=fixture()
  const startedAt=new Date('2026-10-04T12:00:00Z')
  for(let i=0;i<502;i++)db.data.set('trackingSessions/f'+i,{id:'f'+i,propertyId:'p',agencyId:'a',brokerUid:'brokerA',brokerName:'Corretor A',
    sourceClass:'root',visitorHash:'v'+i,consentGranted:true,startedAt,expiresAt:new Date(startedAt.getTime()+30*86400000),
    pageViews:0,activeMs:0,sections:{}})
  const input={propertyId:'p',from:'2026-10-04T00:00:00Z',to:'2026-10-05T00:00:00Z'}
  const partial=await service.gerarRelatorio('manager',input)
  assert.equal(partial.summary.sessions,500);assert.equal(partial.coverage.truncated,true)
  advance(31*86400000)
  const expired=await service.gerarRelatorio('manager',input)
  assert.equal(expired.summary.sessions,0);assert.equal(expired.coverage.truncated,false)
  assert.equal(expired.coverage.retentionDays,30)
})

test('janela padrão de 30 dias tolera latência sem declarar consulta truncada',async()=>{
  const {service,advance}=fixture()
  const clientNow=Date.parse('2026-10-04T12:00:00Z')
  const input={propertyId:'p',from:new Date(clientNow-30*86400000).toISOString(),to:new Date(clientNow).toISOString()}
  advance(100)
  const report=await service.gerarRelatorio('manager',input)
  assert.equal(report.summary.sessions,0)
  assert.deepEqual(report.coverage,{consentedOnly:true,truncated:false,retentionDays:30})
})

test('transferir imóvel de agência não permite acessar ou revogar vínculos anteriores',async()=>{
  const {service,db}=fixture()
  const {link}=await service.criarLink('brokerA',{propertyId:'p',attemptId:'antigo'})
  db.data.set('properties/p',{...db.data.get('properties/p'),agencyId:'b'})
  assert.deepEqual(await service.listarLinks('outsider',{propertyId:'p'}),{links:[],truncated:false})
  await assert.rejects(service.revogarLink('outsider',link.id),{status:403})
  await assert.rejects(service.abrirVisita({token:link.id,attemptId:'mudou-agencia'}),{status:410,code:'LINK_DISABLED'})
})

test('sessão de outra visita, WhatsApp inválido e datas inexistentes não atravessam contrato',async()=>{
  const {service,db}=fixture();const {link}=await service.criarLink('brokerA',{propertyId:'p',attemptId:'raiz'})
  db.data.set('users/brokerA',{...db.data.get('users/brokerA'),publicContact:{whatsapp:'+55 11 <script>'}})
  const a=await service.abrirVisita({token:link.id,attemptId:'a'}),b=await service.abrirVisita({token:a.shareToken,attemptId:'b'})
  assert.equal(a.contact.whatsappNumber,null)
  const {sessionId}=await service.criarSessao({visitId:a.visitId,receipt:a.receipt,visitorKey:'browser-local-123456789',page:'tour'})
  await assert.rejects(service.registrarEvento({visitId:b.visitId,receipt:b.receipt,sessionId,seq:1,type:'view',page:'tour',section:'mapa',activeMs:0}),{status:403})
  await assert.rejects(service.gerarRelatorio('manager',{propertyId:'p',from:'2026-02-30T00:00:00Z',to:'2026-03-05T00:00:00Z'}),{status:400})
})

test('reaceite com identidade nova abre sessão sem vincular hashes, encerrando a anterior',async()=>{
  const {service,db}=fixture();const {link}=await service.criarLink('brokerA',{propertyId:'p',attemptId:'raiz'})
  const opening=await service.abrirVisita({token:link.id,attemptId:'a'})
  const request={visitId:opening.visitId,receipt:opening.receipt,visitorKey:'identidade-antes-123456789',page:'tour'}
  const first=await service.criarSessao(request)
  const second=await service.criarSessao({...request,visitorKey:'identidade-depois-123456789'})
  assert.notEqual(first.sessionId,second.sessionId);assert.equal(second.nextSeq,1)
  const a=db.data.get('trackingSessions/'+first.sessionId),b=db.data.get('trackingSessions/'+second.sessionId)
  assert.equal(b.sourceClass,'own_return');assert.notEqual(a.visitorHash,b.visitorHash)
  assert.equal(JSON.stringify(b).includes(a.visitorHash),false)
  await assert.rejects(service.registrarEvento({visitId:opening.visitId,receipt:opening.receipt,sessionId:first.sessionId,
    seq:1,type:'view',page:'tour',section:'mapa',activeMs:0}),{status:410,code:'SESSION_EXPIRED'})
})

test('sequência sem recibo de dedupe ou conteúdo incompatível exige recuperação explícita',async()=>{
  const {service}=fixture();const {link}=await service.criarLink('brokerA',{propertyId:'p',attemptId:'raiz'})
  const opening=await service.abrirVisita({token:link.id,attemptId:'a'})
  const request={visitId:opening.visitId,receipt:opening.receipt,visitorKey:'navegador-fixture-123456789',page:'tour'}
  const {sessionId}=await service.criarSessao(request),base={visitId:opening.visitId,receipt:opening.receipt,sessionId,type:'view',page:'tour',section:'mapa',activeMs:0}
  for(let seq=1;seq<=35;seq++)await service.registrarEvento({...base,seq})
  await assert.rejects(service.registrarEvento({...base,seq:1}),{status:409,code:'EVENT_CONFLICT'})
  await assert.rejects(service.registrarEvento({...base,seq:35,section:'ficha'}),{status:409,code:'EVENT_CONFLICT'})
  assert.equal((await service.criarSessao(request)).nextSeq,36)
})

test('wire público limita nomes e aceita somente unidade com slug canônico',async()=>{
  const {service,db}=fixture()
  db.data.set('users/brokerA',{...db.data.get('users/brokerA'),name:'A'.repeat(220)})
  const property={...db.data.get('properties/p'),title:'P'.repeat(520)};db.data.set('properties/p',property)
  const {link}=await service.criarLink('brokerA',{propertyId:'p',attemptId:'raiz'})
  assert.equal(link.brokerName.length,200)
  const opening=await service.abrirVisita({token:link.id,attemptId:'a'})
  assert.equal(opening.contact.brokerName.length,200);assert.equal(opening.propertyTitle.length,500)
  for(const pipelineUnitId of ['Unidade','unidade_x','-unidade','unidade--x']){
    db.data.set('properties/p',{...property,pipelineUnitId})
    await assert.rejects(service.abrirVisita({token:link.id,attemptId:'slug-'+pipelineUnitId}),{status:410,code:'LINK_DISABLED'})
  }
})

import {test} from 'node:test'
import assert from 'node:assert/strict'
import {request} from 'node:http'
import {criarServidorRastreabilidade} from '../rastreabilidade/servidor.mjs'

const origin='http://127.0.0.1:5058',panel='http://127.0.0.1:3000'
async function gateway(run,{service={},auth={verifyIdToken:async()=>({uid:'agent-a'})},...options}={}){
  const logs=[]
  const server=criarServidorRastreabilidade({service,auth,publicOrigin:origin,panelOrigin:panel,log:e=>logs.push(e),...options})
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
  const base=`http://127.0.0.1:${server.address().port}`
  try{await run(base,logs)}finally{await new Promise(resolve=>{server.close(resolve);server.closeAllConnections()})}
}
const json=(body,extra={})=>({method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify(body),...extra})

test('rastreamento HTTP: gerenciamento exige Firebase Auth, público não concede leitura',async()=>{
  await gateway(async(base)=>{
    const r=await fetch(base+'/links?propertyId=p1',{headers:{origin:panel}})
    assert.equal(r.status,401);assert.match((await r.json()).error,/autentic/i)
    const pub=await fetch(base+'/report?propertyId=p1',{headers:{origin}})
    assert.equal(pub.status,401)
  })
})
test('rastreamento HTTP: token Firebase revogado não vaza erro de autenticação',async()=>{
  await gateway(async(base,logs)=>{
    const r=await fetch(base+'/links?propertyId=p1',{headers:{origin:panel,authorization:'Bearer secret-token'}})
    assert.equal(r.status,401)
    const text=JSON.stringify([await r.json(),logs]);assert.doesNotMatch(text,/secret-token|private@|stack/)
  },{auth:{verifyIdToken:async()=>{throw new Error('secret-token private@example.test')}}})
})
test('rastreamento HTTP: origem exata, preflight e cache privado',async()=>{
  await gateway(async(base)=>{
    const denied=await fetch(base+'/open',json({token:'t'},{headers:{origin:'https://evil.example','content-type':'application/json'}}))
    assert.equal(denied.status,403);assert.equal(denied.headers.get('access-control-allow-origin'),null)
    const preflight=await fetch(base+'/open',{method:'OPTIONS',headers:{origin}})
    assert.equal(preflight.status,204);assert.equal(preflight.headers.get('access-control-allow-origin'),origin)
    assert.equal(preflight.headers.get('cache-control'),'no-store')
  })
})
test('rastreamento HTTP: GET e HEAD em open não criam visita',async()=>{
  await gateway(async(base)=>{
    for(const method of ['GET','HEAD'])assert.equal((await fetch(base+'/open',{method})).status,405)
  },{service:{abrirVisita:async()=>{throw new Error('Não deve abrir visita')}}})
})
test('rastreamento HTTP: JSON inválido, lista e corpo grande são recusados',async()=>{
  await gateway(async(base)=>{
    assert.equal((await fetch(base+'/open',json([]))).status,400)
    assert.equal((await fetch(base+'/open',json({padding:'x'.repeat(8192)}))).status,413)
    assert.equal((await fetch(base+'/open',{method:'POST',headers:{'content-type':'application/json'},body:'{'})).status,400)
    assert.equal((await fetch(base+'/open',{method:'POST',body:'{}'})).status,415)
  })
})
test('rastreamento HTTP: corpo chunked acima do limite recebe 413 sem derrubar a conexão antes da resposta',async()=>{
  await gateway(async base=>{
    const status=await new Promise((resolve,reject)=>{
      const req=request(base+'/open',{method:'POST',headers:{'content-type':'application/json'}},res=>{
        res.resume();res.on('end',()=>resolve(res.statusCode))
      })
      req.on('error',reject)
      req.write('{"padding":"');req.write('x'.repeat(9000));req.end('"}')
    })
    assert.equal(status,413)
  })
})
test('rastreamento HTTP: expiração tem código estável para retomada',async()=>{
  await gateway(async(base)=>{
    const r=await fetch(base+'/events',json({sessionId:'s'}));assert.equal(r.status,410)
    assert.deepEqual(await r.json(),{error:'Sessão expirada.',code:'SESSION_EXPIRED'})
  },{service:{registrarEvento:async()=>{throw Object.assign(new Error('Sessão expirada.'),{status:410,code:'SESSION_EXPIRED'})}}})
})
test('rastreamento HTTP: /leads é público e só aceita POST',async()=>{
  let recebido
  await gateway(async(base)=>{
    const r=await fetch(base+'/leads',json({visitId:'v',receipt:'r',channel:'whatsapp'}));assert.equal(r.status,200)
    assert.deepEqual(recebido,{visitId:'v',receipt:'r',channel:'whatsapp'})
    assert.equal((await fetch(base+'/leads')).status,405)
  },{service:{registrarLead:async input=>{recebido=input;return {leadId:'l',status:'novo'}}}})
})
test('rastreamento HTTP: payload público não passa por gerenciamento e logs não expõem dados',async()=>{
  await gateway(async(base,logs)=>{
    const body={token:'public-token',receipt:'private-receipt',attemptId:'attempt'}
    const r=await fetch(base+'/open',json(body));assert.equal(r.status,200)
    assert.deepEqual(await r.json(),{visitId:'v1'})
    const id=r.headers.get('x-request-id');assert.match(id,/^[a-f0-9-]{36}$/)
    assert.equal(logs[0].requestId,id);assert.equal(logs[0].entryPoint,'tracking_http')
    assert.equal(logs[0].route,'/open');assert.doesNotMatch(JSON.stringify(logs),/public-token|private-receipt|127\.0\.0\.1/)
  },{service:{abrirVisita:async input=>{assert.equal(input.receipt,'private-receipt');return {visitId:'v1'}}}})
})
test('rastreamento HTTP: listagem usa identidade conferida e query estrita',async()=>{
  await gateway(async(base)=>{
    const h={origin:panel,authorization:'Bearer token'}
    const r=await fetch(base+'/links?propertyId=p1',{headers:h});assert.equal(r.status,200)
    assert.deepEqual(await r.json(),{links:[],truncated:false})
    assert.equal((await fetch(base+'/links?propertyId=p1&agencyId=other',{headers:h})).status,400)
    assert.equal((await fetch(base+'/links?propertyId=p1&propertyId=p2',{headers:h})).status,400)
  },{service:{listarLinks:async(uid,input)=>{assert.equal(uid,'agent-a');assert.deepEqual(input,{propertyId:'p1'});return {links:[],truncated:false}}}})
})
test('rastreamento HTTP: proteção de frequência e configuração restrita',async()=>{
  assert.throws(()=>criarServidorRastreabilidade({service:{},publicOrigin:'http://remote.example',panelOrigin:panel}),/HTTPS/)
  await gateway(async(base)=>{
    assert.equal((await fetch(base+'/open',json({}))).status,200)
    assert.equal((await fetch(base+'/open',json({}))).status,429)
  },{service:{abrirVisita:async()=>({visitId:'v'})},requestsPerMinute:1})
})
test('rastreamento HTTP: atrás de proxy, cada visitante tem o seu limite e o X-Forwarded-For forjado não ajuda',async()=>{
  assert.throws(()=>criarServidorRastreabilidade({service:{},publicOrigin:origin,panelOrigin:panel,proxyHops:-1}),/proxy/)
  const de=(chain)=>json({},{headers:{origin,'content-type':'application/json','x-forwarded-for':chain}})
  await gateway(async(base)=>{
    assert.equal((await fetch(base+'/open',de('203.0.113.1'))).status,200)
    assert.equal((await fetch(base+'/open',de('203.0.113.2'))).status,200,'outro visitante, mesma conexão do proxy')
    assert.equal((await fetch(base+'/open',de('1.2.3.4, 203.0.113.1'))).status,429,'o prefixo é do cliente; vale a última entrada')
  },{service:{abrirVisita:async()=>({visitId:'v'})},requestsPerMinute:1,proxyHops:1})
})

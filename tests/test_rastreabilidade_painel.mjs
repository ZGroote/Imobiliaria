import {test} from 'node:test'
import assert from 'node:assert/strict'
import {baseRastreabilidade, corretoresAtivos, criarClienteRastreabilidade, periodo30Dias,
  validarLink, validarRelatorio} from '../painel/src/lib/rastreabilidade.ts'
import {resumir} from '../rastreabilidade/relatorios.mjs'

const scope={propertyId:'propA',agencyId:'agA',brokerUid:'corA'}
const token='a'.repeat(32)
const link=()=>({id:token,propertyId:'propA',agencyId:'agA',brokerUid:'corA',brokerName:'Ana',
  status:'active',createdAt:'2026-10-04T12:00:00.000Z',url:`https://imoveis.example/acesso.html?l=${token}&pagina=maquete`})
const summary=()=>({sessions:2,estimatedVisitors:1,pageViews:3,activeMs:30000,rootEntries:1,
  forwardedEntries:1,ownReturns:0,uncertainEntries:0})
const range=()=>({from:'2026-09-04T12:00:00.000Z',to:'2026-10-04T12:00:00.000Z'})
const report=()=>({...range(),propertyId:'propA',summary:summary(),
  byBroker:[{brokerUid:'corA',brokerName:'Ana',...summary()}],
  bySource:[{sourceClass:'root',sessions:1,estimatedVisitors:1,activeMs:15000}],
  bySection:[{page:'maquete',section:'planta2d',views:2,activeMs:30000}],
  coverage:{consentedOnly:true,truncated:false,retentionDays:30}})

test('painel tracking: ausência é offline; endpoint exige HTTPS ou loopback, sem credenciais/query',()=>{
  assert.equal(baseRastreabilidade(undefined),null)
  assert.equal(baseRastreabilidade('  '),null)
  assert.equal(baseRastreabilidade('https://api.example/rastreabilidade/'),'https://api.example/rastreabilidade')
  assert.equal(baseRastreabilidade('http://127.0.0.1:5057'),'http://127.0.0.1:5057')
  for(const invalid of ['javascript:alert(1)','http://api.example','https://user:pass@api.example',
    'https://api.example/?token=abc','https://api.example/#segredo']) assert.throws(()=>baseRastreabilidade(invalid))
})

test('painel tracking: seleção de corretor não reutiliza responsável e exclui agência/papel/inativo',()=>{
  const users=[{id:'corA',agencyId:'agA',role:'agent',active:true,name:'Ana'},
    {id:'corB',agencyId:'agB',role:'agent',active:true,name:'Beto'},
    {id:'gerA',agencyId:'agA',role:'agency_manager',active:true,name:'Gerente'},
    {id:'old',agencyId:'agA',role:'agent',active:false,name:'Inativo'}]
  assert.deepEqual(corretoresAtivos(users,'agA').map(x=>x.id),['corA'])
  assert.deepEqual(periodo30Dias(new Date('2026-10-04T12:00:00Z')),range())
})

test('painel tracking: link válido é fechado e vinculado a imóvel/agência/corretor',()=>{
  assert.deepEqual(validarLink(link(),scope),link())
  for(const patch of [{propertyId:'propB'},{agencyId:'agB'},{brokerUid:'corB'},
    {status:'published'},{createdAt:'ontem'},{email:'private@example.test'},
    {url:'javascript:alert(1)'},{url:`https://imoveis.example/acesso.html?l=${token}&brokerUid=corB`},
    {url:`https://imoveis.example/acesso.html?l=${token}&l=${token}&pagina=maquete`},
    {url:`https://imoveis.example/imovel/cedros?l=${token}`},
    {url:`https://imoveis.example/acesso.html?l=${'b'.repeat(32)}&pagina=maquete`}])
    assert.throws(()=>validarLink({...link(),...patch},scope))
})

test('painel tracking: relatório preserva estimativas/zero/parcial, recusa PII, formas e escopo incorretos',()=>{
  assert.deepEqual(validarRelatorio(report(),scope,range()),report())
  const partial=report();partial.coverage.truncated=true
  assert.equal(validarRelatorio(partial,scope,range()).coverage.truncated,true)
  const empty=report();Object.keys(empty.summary).forEach(k=>empty.summary[k]=0)
  empty.byBroker=[];empty.bySource=[];empty.bySection=[]
  assert.equal(validarRelatorio(empty,scope,range()).summary.sessions,0)
  const bad=[{...report(),propertyId:'propB'},{...report(),from:'2026-09-05T12:00:00.000Z'},
    {...report(),visitorIds:['private']},{...report(),summary:{...summary(),activeMs:-1}},
    {...report(),summary:{...summary(),sessions:Number.NaN}},
    {...report(),summary:{...summary(),estimatedVisitors:3}},
    {...report(),byBroker:[{brokerUid:'corB',brokerName:'Beto',...summary()}]},
    {...report(),bySource:[{sourceClass:'whatsapp',sessions:1,estimatedVisitors:1,activeMs:0}]},
    {...report(),bySection:[{page:'maquete',section:'quarto',views:1,activeMs:0}]},
    {...report(),coverage:{consentedOnly:false,truncated:false,retentionDays:30}},
    {...report(),byBroker:[{brokerUid:'corA',brokerName:'Ana',email:'private',...summary()}]}]
  for(const value of bad)assert.throws(()=>validarRelatorio(value,scope,range()))
})

test('painel tracking: chamadas autenticadas usam contrato e criação repete attemptId após erro de rede',async()=>{
  const calls=[];let first=true
  const client=criarClienteRastreabilidade({baseUrl:'http://127.0.0.1:5057/api',getToken:async()=> 'firebase-test',
    fetcher:async(url,options)=>{
      calls.push({url:String(url),options})
      if(options.method==='POST'&&String(url).endsWith('/links')){
        if(first){first=false;throw new TypeError('network')}
        return Response.json({link:link()})
      }
      if(String(url).includes('/revoke'))return Response.json({ok:true})
      if(String(url).includes('/report?'))return Response.json(report())
      return Response.json({links:[link()],truncated:false})
    }})
  await assert.rejects(client.criar(scope,{attemptId:'attempt-1'}),/indisponível/)
  assert.deepEqual(await client.criar(scope,{attemptId:'attempt-1'}),link())
  assert.deepEqual(await client.listar(scope),{links:[link()],truncated:false})
  await client.revogar(token)
  assert.deepEqual(await client.relatorio(scope,range()),report())
  const posts=calls.filter(c=>c.url.endsWith('/links'))
  assert.equal(posts.length,2)
  assert.deepEqual(posts.map(c=>JSON.parse(c.options.body)),[
    {propertyId:'propA',attemptId:'attempt-1'},{propertyId:'propA',attemptId:'attempt-1'}])
  assert.ok(calls.every(c=>c.options.headers.Authorization==='Bearer firebase-test'))
  assert.ok(calls.every(c=>c.options.cache==='no-store'&&c.options.credentials==='omit'))
  const query=new URL(calls.at(-1).url).searchParams
  assert.equal(query.get('propertyId'),'propA');assert.equal(query.get('brokerUid'),'corA')
  assert.equal(query.get('from'),range().from)
})

test('painel tracking: manager escolhe explicitamente corretor; resposta de outro dono é recusada',async()=>{
  let body
  const client=criarClienteRastreabilidade({baseUrl:'https://api.example',getToken:async()=> 'token',
    fetcher:async(_,options)=>{body=JSON.parse(options.body);return Response.json({link:link()})}})
  const managerScope={propertyId:'propA',agencyId:'agA'}
  await assert.rejects(client.criar(managerScope,{attemptId:'attempt-2',brokerUid:'corB'}),/resposta/i)
  assert.deepEqual(body,{propertyId:'propA',attemptId:'attempt-2',brokerUid:'corB'})
})

test('painel tracking: respostas inválidas/PII ou links de colega nunca são exibidos',async()=>{
  for(const payload of [{links:[{...link(),brokerUid:'corB'}],truncated:false},
    {links:[link()],truncated:'false'},{links:[link()],truncated:false,receipt:'private'}]){
    const client=criarClienteRastreabilidade({baseUrl:'https://api.example',getToken:async()=> 'token',
      fetcher:async()=>Response.json(payload)})
    await assert.rejects(client.listar(scope),/resposta/i)
  }
})

test('painel tracking: erro não expõe payload do servidor e aborto conserva mudança de imóvel',async()=>{
  const client=criarClienteRastreabilidade({baseUrl:'https://api.example',getToken:async()=> 'token',
    fetcher:async()=>Response.json({error:'private-user-id-and-email'},{status:403})})
  await assert.rejects(client.listar(scope),e=>/permissão/.test(e.message)&&!e.message.includes('private'))
  const controller=new AbortController();controller.abort()
  await assert.rejects(client.listar(scope,controller.signal),e=>e.name==='AbortError')
})

test('painel tracking: contrato real do agregador deduplica corretor/dia e informa cobertura parcial',()=>{
  const period=range(),now=Date.parse(period.to)
  const visit={propertyId:'propA',brokerUid:'corA',brokerName:'Ana',visitorHash:'same-browser',
    consentGranted:true,sourceClass:'root',startedAt:'2026-09-20T12:00:00.000Z',
    expiresAt:'2026-10-20T12:00:00.000Z',activeMs:15000,pageViews:1,
    sections:{'maquete:planta2d':{page:'maquete',section:'planta2d',views:1,activeMs:15000}}}
  const actual=resumir([visit,{...visit,brokerUid:'corB',brokerName:'Beto',sourceClass:'forwarded',
    startedAt:'2026-09-21T12:00:00.000Z'}],{propertyId:'propA',...period,now,truncated:true})
  const checked=validarRelatorio(actual,{propertyId:'propA',agencyId:'agA'},period)
  assert.equal(checked.summary.estimatedVisitors,1)
  assert.equal(checked.byBroker.reduce((sum,b)=>sum+b.estimatedVisitors,0),2)
  assert.equal(checked.coverage.truncated,true)
  assert.throws(()=>validarRelatorio(actual,scope,period))
})

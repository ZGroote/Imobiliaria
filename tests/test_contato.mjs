import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {readFile} from 'node:fs/promises'
import vm from 'node:vm'
import {validarContato, processarContato, criarHandlerContato} from '../emails/contato.mjs'

const key = 'test-only-key-not-a-real-credential-123456'
const origin = 'https://conectaimoveis3d.com'
const input = extra => ({name:'Ana Smith', email:'ana@example.com', company:'Example Homes',
  message:'I would like a presentation for a new development.', locale:'en', requestId:randomUUID(), website:'', ...extra})

// Serial transactions stage writes until commit and enforce Firestore's read-before-write rule.
function database() {
  const records = new Map()
  let queue = Promise.resolve()
  return {
    records,
    doc:path => ({path}),
    async runTransaction(work) {
      const previous = queue
      let release
      queue = new Promise(resolve => {release = resolve})
      await previous
      const writes = new Map()
      let wrote = false
      try {
        const result = await work({
          async get(ref) {
            assert.equal(wrote, false, 'Firestore cannot read after a transaction write.')
            const value = records.get(ref.path)
            return {exists:value !== undefined, data:()=>structuredClone(value)}
          },
          set(ref, value) {wrote = true; writes.set(ref.path, structuredClone(value))},
          update(ref, value) {
            wrote = true
            assert.ok(records.has(ref.path), 'Cannot update a missing document.')
            writes.set(ref.path, {...structuredClone(records.get(ref.path)), ...structuredClone(value)})
          },
        })
        for (const [path, value] of writes) records.set(path, value)
        return result
      } finally {release()}
    },
  }
}

function app(extra = {}) {
  let time = Date.parse('2026-11-03T15:00:00Z')
  const db = database(), calls = []
  const deps = {db, segredo:key, agora:()=>time, enviar:async(message,id)=>{
    calls.push({message,id})
    return {id:'provider-message-id'}
  }, ...extra}
  return {db,calls,deps,advance:ms=>{time+=ms},setTime:value=>{time=value},process:value=>processarContato(value,deps)}
}

function request(body, extra = {}) {
  return {method:'POST', headers:{origin,'content-type':'application/json'}, rawBody:Buffer.from(JSON.stringify(body)), ...extra}
}

async function http(app, req) {
  const response = {headers:{}, code:null, body:null,
    set(name,value){this.headers[name.toLowerCase()]=value;return this},
    status(code){this.code=code;return this},
    json(body){this.body=body;return this},
    end(){return this},
  }
  await criarHandlerContato(app.deps)(req,response)
  return response
}

test('contact validation constrains fields and headers and preserves the English enquiry as plain text', async()=>{
  const value=input(), next=validarContato(value)
  assert.equal(next.email, value.email)
  assert.equal(next.company,value.company)
  assert.equal(validarContato({...value,company:undefined}).company,'')
  assert.equal(validarContato({...value,email:'ana@EXAMPLE.COM'}).email,'ana@example.com')
  assert.equal(validarContato({...value,message:'  Message with\r\na line break.  '}).message,'Message with\na line break.')
  const invalid=[{name:''},{name:'x'.repeat(121)},{name:'Ana\r\nBcc:person@example.com'},
    {email:'a@example.com\r\nBcc:x@example.com'},{email:'a@example.com,b@example.com'},
    {email:'a@localhost'},{email:'a..b@example.com'},{email:'a@-bad.example'},
    {company:'x'.repeat(161)},{company:'Company\nOther'}, {message:'short'},
    {message:'x'.repeat(5001)},{message:'Long message\x00 hidden'}, {locale:'fr'},
    {requestId:'not-a-uuid'},{website:'https://spam.example'}, {to:'victim@example.com'}, {html:'<script>x</script>'}]
  for (const extra of invalid) assert.throws(()=>validarContato({...value,...extra}), e=>e.status===400,JSON.stringify(extra))
  for (const value of [null,[],true,'test']) assert.throws(()=>validarContato(value),e=>e.status===400)
})

test('one accepted submission sends only to the owned inbox and stores no enquiry, address or secret',async()=>{
  const state=app(),value=input({message:'Please reply about <b>my property</b>. This is plain text.'})
  assert.deepEqual(await state.process(value),{status:'accepted'})
  const {message,id}=state.calls[0]
  assert.equal(message.from,'Conecta Imóveis 3D <noreply@conectaimoveis3d.com>')
  assert.deepEqual(message.to,['contact@conectaimoveis3d.com'])
  assert.equal(message.reply_to,value.email)
  assert.equal(message.subject,'Website enquiry — Conecta Imóveis 3D')
  assert.equal(message.html,undefined)
  assert.ok(message.text.includes(value.message))
  assert.match(id,/^contact\/[a-f0-9]{64}$/)
  assert.equal(state.db.records.get('emailQuota/2026-11-03').count,1)
  assert.equal(state.db.records.get('contactQuota/2026-11-03').count,1)
  const metadata=JSON.stringify([...state.db.records])
  for (const content of [value.name,value.email,value.company,value.message,value.requestId,key]) assert.equal(metadata.includes(content),false,content)
  assert.match([...state.db.records.keys()].find(path=>path.startsWith('contactEmailQuota/')),/2026-11-03-[a-f0-9]{64}$/)
})

test('concurrent duplicates share one reservation and an accepted retry never consumes another message',async()=>{
  let release,entered
  const started=new Promise(resolve=>{entered=resolve}), gate=new Promise(resolve=>{release=resolve})
  const state=app({enviar:async(message,id)=>{state.calls.push({message,id});entered();await gate;return {id:'provider-id'}}})
  const value=input(), first=state.process(value)
  await started
  assert.deepEqual(await state.process(value),{status:'processing'})
  assert.equal(state.calls.length,1)
  release();assert.deepEqual(await first,{status:'accepted'})
  assert.deepEqual(await state.process(value),{status:'accepted'})
  assert.equal(state.calls.length,1)
  assert.equal(state.db.records.get('emailQuota/2026-11-03').count,1)
  assert.equal(state.db.records.get('contactQuota/2026-11-03').count,1)
})

test('a UUID cannot be reused for another address, message or locale',async()=>{
  const state=app(),value=input();await state.process(value)
  for (const extra of [{email:'other@example.com'},{message:'A completely different enquiry'},{locale:'pt-BR'}])
    await assert.rejects(state.process({...value,...extra}),e=>e.status===409&&e.code==='request_conflict')
  assert.equal(state.calls.length,1)
})

test('one sender waits a minute and can reserve at most three new requests per UTC day',async()=>{
  const state=app();await state.process(input())
  await assert.rejects(state.process(input()),e=>e.status===429&&e.retryAfter===60)
  state.advance(60_000);await state.process(input({email:'ANA@example.com'}))
  state.advance(60_000);await state.process(input())
  state.advance(60_000);await assert.rejects(state.process(input()),e=>e.status===429)
  assert.equal(state.calls.length,3)
  assert.equal(state.db.records.get('contactQuota/2026-11-03').count,3)
})

test('contact quota and existing shared provider quota are reserved atomically',async()=>{
  const state=app()
  state.db.records.set('contactQuota/2026-11-03',{count:19})
  state.db.records.set('emailQuota/2026-11-03',{count:89})
  const results=await Promise.allSettled([state.process(input({email:'a@example.com'})),state.process(input({email:'b@example.com'}))])
  assert.equal(results.filter(value=>value.status==='fulfilled').length,1)
  assert.equal(state.calls.length,1)
  assert.equal(state.db.records.get('emailQuota/2026-11-03').count,90)
  assert.equal(state.db.records.get('contactQuota/2026-11-03').count,20)
  for (const [path,count] of [['emailQuota/2026-11-03',90],['contactQuota/2026-11-03',20]]) {
    const bounded=app();bounded.db.records.set(path,{count})
    const before=structuredClone([...bounded.db.records])
    await assert.rejects(bounded.process(input()),e=>e.status===429)
    assert.deepEqual([...bounded.db.records],before)
    assert.equal(bounded.calls.length,0)
  }
})

test('provider failures remain failures and retries keep the same idempotency key and reservation',async()=>{
  let failed=true
  const state=app({enviar:async(message,id)=>{state.calls.push({message,id});if(failed)throw Object.assign(new Error('private provider details'),{repetir:true});return {id:'accepted-id'}}})
  const value=input()
  await assert.rejects(state.process(value),e=>e.status===503&&e.code==='send_failed'&&!e.message.includes('private'))
  assert.equal([...state.db.records.values()].find(value=>value.status)?.status,'failed')
  await assert.rejects(state.process(value),e=>e.status===503&&e.retryAfter===60)
  assert.equal(state.calls.length,1)
  state.advance(60_000);failed=false
  assert.deepEqual(await state.process(value),{status:'accepted'})
  assert.equal(state.calls[0].id,state.calls[1].id)
  assert.equal(state.db.records.get('emailQuota/2026-11-03').count,1)
  assert.equal(state.db.records.get('contactQuota/2026-11-03').count,1)
})

test('permanent provider errors, exhausted attempts and expired requests cannot restart a send',async()=>{
  const permanent=app({enviar:async()=>{permanent.calls.push(1);throw Object.assign(new Error('provider'),{repetir:false})}}),value=input()
  await assert.rejects(permanent.process(value),e=>e.status===503)
  permanent.advance(100_000)
  await assert.rejects(permanent.process(value),e=>e.status===503)
  assert.equal(permanent.calls.length,1)
  const transient=app({enviar:async()=>{transient.calls.push(1);throw new Error('timeout')}}),retry=input()
  for (let i=0;i<3;i++){await assert.rejects(transient.process(retry),e=>e.status===503);transient.advance(60_000)}
  await assert.rejects(transient.process(retry),e=>e.status===503)
  assert.equal(transient.calls.length,3)
  const expired=app({enviar:async()=>{expired.calls.push(1);throw new Error('timeout')}}),old=input()
  await assert.rejects(expired.process(old),e=>e.status===503)
  expired.advance(23*60*60*1000)
  await assert.rejects(expired.process(old),e=>e.status===503)
  assert.equal(expired.calls.length,1)
})

test('a late success cannot be overwritten by a failed lease recovery',async()=>{
  let release,entered
  const started=new Promise(resolve=>{entered=resolve}),gate=new Promise(resolve=>{release=resolve})
  const state=app({enviar:async()=>{state.calls.push(1);if(state.calls.length===1){entered();await gate;return {id:'accepted-id'}};throw new Error('later attempt timeout')}})
  const value=input(),first=state.process(value);await started
  state.advance(91_000)
  await assert.rejects(state.process(value),e=>e.status===503)
  release();assert.deepEqual(await first,{status:'accepted'})
  assert.deepEqual(await state.process(value),{status:'accepted'})
})

test('a retry crossing UTC midnight reserves the next day and respects its shared budget',async()=>{
  let fail=true
  const state=app({enviar:async()=>{state.calls.push(1);if(fail)throw new Error('timeout');return {id:'accepted-id'}}})
  state.setTime(Date.parse('2026-11-03T23:59:00Z'))
  const value=input();await assert.rejects(state.process(value),e=>e.status===503)
  state.advance(61_000);state.db.records.set('emailQuota/2026-11-04',{count:90})
  await assert.rejects(state.process(value),e=>e.status===429)
  assert.equal(state.calls.length,1)
  state.db.records.set('emailQuota/2026-11-04',{count:89});fail=false
  assert.deepEqual(await state.process(value),{status:'accepted'})
  assert.equal(state.db.records.get('emailQuota/2026-11-04').count,90)
  assert.equal(state.db.records.get('contactQuota/2026-11-04').count,1)
})

test('HTTP accepts only exact origins and POST JSON; preflight is explicit and never sends',async()=>{
  const state=app(),value=input()
  for (const requestOrigin of [undefined, 'https://conectaimoveis3d.com.evil.example','http://conectaimoveis3d.com','null']) {
    const response=await http(state,request(value,{headers:{origin:requestOrigin,'content-type':'application/json'}}))
    assert.equal(response.code,403)
    assert.equal(response.headers['access-control-allow-origin'],undefined)
  }
  const preflight=await http(state,{method:'OPTIONS',headers:{origin,'access-control-request-method':'POST','access-control-request-headers':'content-type'}})
  assert.equal(preflight.code,204);assert.equal(preflight.headers['access-control-allow-origin'],origin)
  assert.equal(state.calls.length,0)
  assert.equal(state.db.records.size,0)
  assert.equal((await http(state,request(value,{method:'GET'}))).code,405)
  for (const headers of [{'content-type':'text/plain'},{'content-type':'application/json','content-encoding':'gzip'}])
    assert.equal((await http(state,request(value,{headers:{origin,...headers}}))).code,415)
  assert.equal((await http(state,request(value,{rawBody:Buffer.from('{bad json')}))).code,400)
  assert.equal((await http(state,request({...value,website:'filled by a bot'}))).code,400)
  assert.equal(state.db.records.size,0)
})

test('HTTP enforces byte size and validation before quota or provider access',async()=>{
  const state=app(),value=input()
  const malformed=await http(state,request(value,{headers:{origin,'content-type':'application/json','content-length':'not a number'}}))
  assert.equal(malformed.code,400)
  const large=await http(state,request(value,{rawBody:Buffer.alloc(12289)}));assert.equal(large.code,413)
  const declared=await http(state,request(value,{headers:{origin,'content-type':'application/json','content-length':'12289'}}));assert.equal(declared.code,413)
  assert.equal(state.calls.length,0);assert.equal(state.db.records.size,0)
})

test('HTTP never reports processing, a quota error or provider failure as an accepted submission',async()=>{
  let release,entered
  const started=new Promise(resolve=>{entered=resolve}),gate=new Promise(resolve=>{release=resolve})
  const state=app({enviar:async()=>{entered();await gate;return {id:'accepted-id'}}}),value=input()
  const first=http(state,request(value));await started
  const processing=await http(state,request(value));assert.equal(processing.code,202)
  assert.deepEqual(processing.body,{status:'processing'});assert.equal(processing.headers['retry-after'],'5')
  release();const accepted=await first;assert.equal(accepted.code,200);assert.deepEqual(accepted.body,{status:'accepted'})
  assert.equal(accepted.headers['cache-control'],'no-store')
  const throttled=await http(state,request(input()));assert.equal(throttled.code,429);assert.equal(throttled.body.status,'failed')
  const failed=app({enviar:async()=>{throw new Error('sensitive message and key')}})
  const response=await http(failed,request(input()));assert.equal(response.code,503)
  assert.deepEqual(response.body,{status:'failed',error:'send_failed'})
  assert.equal(response.headers['retry-after'],'60')
  assert.equal(JSON.stringify(response).includes('sensitive'),false)
})

test('the deployed handler preserves idempotency and quotas when only the sending credential rotates',async()=>{
  const db=database(), calls=[], values={RESEND_API_KEY:'re_old_sending_test_key',CONTACT_HMAC_KEY:key}
  const source=(await readFile(new URL('../emails/index.mjs',import.meta.url),'utf8'))
    .replace(/^import .*\r?\n/gm,'').replaceAll('export const','const')
  const context=vm.createContext({URL,PAINEL:'https://painel.conectaimoveis3d.com.br/login',
    defineSecret:name=>({name,value:()=>values[name]}),
    onDocumentWritten:()=>({}),onCall:()=>({}),
    onRequest:(options,handler)=>Object.assign(handler,{options}),
    getApps:()=>[{}],getFirestore:()=>db,criarHandlerContato,
    clienteResend:credential=>async(method,path,message,id)=>{calls.push({credential,method,path,message,id});return {id:'accepted-id'}},
  })
  vm.runInContext(source+'\nglobalThis.contactHandler=receberContato',context)
  const handler=context.contactHandler
  assert.deepEqual([...handler.options.secrets].map(secret=>secret.name),['RESEND_API_KEY','CONTACT_HMAC_KEY'])
  const response=()=>({headers:{},set(name,value){this.headers[name]=value;return this},status(code){this.code=code;return this},json(body){this.body=body;return this}})
  const value=input(), first=response();await handler(request(value),first)
  assert.equal(first.code,200);assert.deepEqual(first.body,{status:'accepted'})
  values.RESEND_API_KEY='re_rotated_sending_test_key'
  const replay=response();await handler(request(value),replay)
  assert.equal(replay.code,200);assert.deepEqual(replay.body,{status:'accepted'})
  assert.equal(calls.length,1,'Rotating the provider credential cannot create a second delivery.')
  assert.equal([...db.records.keys()].filter(path=>path.startsWith('contactRequests/')).length,1)
  assert.equal([...db.records.entries()].find(([path])=>path.startsWith('emailQuota/'))[1].count,1)
  assert.equal([...db.records.entries()].find(([path])=>path.startsWith('contactQuota/'))[1].count,1)
  const next=response();await handler(request(input({email:'another@example.com'})),next)
  assert.equal(next.code,200);assert.equal(calls.length,2)
  assert.equal(calls[1].credential,'re_rotated_sending_test_key','A genuinely new enquiry uses the new sending credential.')
})

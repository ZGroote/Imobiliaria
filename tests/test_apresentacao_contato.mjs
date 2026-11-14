import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source=readFileSync(new URL('../experimentos/apresentacao-2026-11-01/site/contato.js',import.meta.url),'utf8');
const response=(status=200,data={status:'accepted'})=>({status,json:async()=>data});

function harness({lang='en'}={}){
  let submitHandler,timer,id=0;
  const fields=Object.fromEntries(['name','email','company','message','website'].map(name=>[name,{
    value:({name:' Alex Doe ',email:' alex@example.test ',company:' Example Studio ',message:' A new property presentation. '})[name]||'',
    disabled:false,attributes:{},custom:'',focused:false,reports:0,
    setCustomValidity(value){this.custom=value;},checkValidity(){return !this.custom&&this.nativeValid!==false;},
    setAttribute(name,value){this.attributes[name]=value;},removeAttribute(name){delete this.attributes[name];},
    focus(){this.focused=true;},reportValidity(){this.reports++;},
  }]));
  const status={dataset:{},textContent:'',focused:false,focus(){this.focused=true;},
    set innerHTML(value){throw Error('Contact copy must never interpret HTML.');}};
  const label={textContent:''},submit={disabled:true,querySelector:()=>label};
  const form={attributes:{},resets:0,
    querySelector(selector){
      const name=selector.match(/^\[name="(.+)"\]$/)?.[1];
      if(name)return fields[name];
      if(selector==='[data-contato-status]')return status;
      if(selector==="[type='submit']")return submit;
      throw Error(selector);
    },
    querySelectorAll(){return [...Object.values(fields),submit];},
    setAttribute(name,value){this.attributes[name]=value;},
    addEventListener(type,fn){assert.equal(type,'submit');submitHandler=fn;},
    reset(){this.resets++;for(const field of Object.values(fields))field.value='';},
  };
  const calls=[],replies=[];
  const context={document:{documentElement:{lang},querySelector:()=>form},AbortController,
    crypto:{randomUUID:()=>`00000000-0000-4000-8000-${String(++id).padStart(12,'0')}`},
    setTimeout(fn){timer=fn;return 1;},clearTimeout(){timer=null;},
    fetch:async(url,options)=>{
      calls.push({url,...options,body:JSON.parse(options.body)});
      const next=replies.shift();
      if(typeof next==='function')return next(options);
      if(next instanceof Error)throw next;
      return next||response();
    }};
  vm.runInNewContext(source,context);
  return {fields,status,label,submit,form,calls,replies,
    send:()=>submitHandler?.({preventDefault(){}}),expire:()=>timer?.(),hasHandler:()=>Boolean(submitHandler),
  };
}

test('the Portuguese site sends the same form with locale pt-BR',async()=>{
  const app=harness({lang:'pt-BR'});
  assert.equal(app.hasHandler(),true);
  assert.equal(app.submit.disabled,false);
  await app.send();
  assert.equal(app.calls.length,1);
  assert.equal(app.calls[0].body.locale,'pt-BR');
});

test('invalid fields are focused without sending or losing the draft',async()=>{
  const app=harness();app.fields.name.value='  ';
  await app.send();
  assert.equal(app.calls.length,0);
  assert.equal(app.fields.name.focused,true);
  assert.equal(app.fields.name.attributes['aria-invalid'],'true');
  assert.equal(app.fields.name.reports,1);
  assert.equal(app.fields.message.value,' A new property presentation. ');
  app.fields.name.value='Alex';app.fields.email.value='bad@example';
  await app.send();assert.equal(app.calls.length,0);assert.equal(app.fields.email.focused,true);
  app.fields.email.value='alex@example.test';app.fields.message.value='short';
  await app.send();assert.equal(app.calls.length,0);assert.equal(app.fields.message.focused,true);
});

test('one in-flight submission sends the exact contract and accepted delivery resets the form',async()=>{
  const app=harness();let complete;
  app.replies.push(()=>new Promise(resolve=>{complete=resolve;}));
  const pending=app.send();
  assert.equal(app.form.attributes['aria-busy'],'true');
  assert.ok([...Object.values(app.fields),app.submit].every(field=>field.disabled));
  assert.equal(app.label.textContent,'Sending…');
  await app.send();assert.equal(app.calls.length,1,'A second click cannot start a duplicate request.');
  assert.equal(app.calls[0].url,'/api/contact');assert.equal(app.calls[0].method,'POST');
  assert.equal(app.calls[0].credentials,'same-origin');
  assert.deepEqual(app.calls[0].body,{name:'Alex Doe',email:'alex@example.test',company:'Example Studio',
    message:'A new property presentation.',website:'',locale:'en',requestId:'00000000-0000-4000-8000-000000000001'});
  complete(response());await pending;
  assert.equal(app.form.resets,1);assert.equal(app.status.dataset.state,'accepted');
  assert.equal(app.status.focused,true);assert.match(app.status.textContent,/submitted/);
  assert.ok([...Object.values(app.fields),app.submit].every(field=>!field.disabled));
  assert.equal(app.form.attributes['aria-busy'],'false');
});

test('uncertain network and server failures retain the same request ID; editing creates a new request',async()=>{
  const app=harness();app.replies.push(Error('network interrupted'),response(503),response(200));
  await app.send();await app.send();
  assert.equal(app.calls[0].body.requestId,app.calls[1].body.requestId);
  assert.equal(app.form.resets,0);assert.equal(app.fields.message.value,' A new property presentation. ');
  app.fields.message.value='Another property presentation.';
  await app.send();
  assert.notEqual(app.calls[2].body.requestId,app.calls[0].body.requestId);
  assert.equal(app.form.resets,1);
});

test('processing, rate limits and malformed success responses never claim accepted delivery',async()=>{
  const app=harness();
  app.replies.push(response(202,{status:'processing'}),response(429),response(200,{ok:true}),response(200));
  await app.send();assert.equal(app.status.dataset.state,'processing');assert.match(app.status.textContent,/wait a minute/);
  await app.send();assert.equal(app.status.dataset.state,'error');assert.match(app.status.textContent,/too many requests/);
  await app.send();assert.equal(app.status.dataset.state,'error');assert.equal(app.form.resets,0);
  await app.send();assert.equal(app.form.resets,1);
  assert.ok(app.calls.every(call=>call.body.requestId===app.calls[0].body.requestId));
});

test('errors use local plain copy, preserve fields and recover from an explicit ID conflict',async()=>{
  const app=harness();app.fields.company.value='<img src=x onerror=alert(1)>';
  app.replies.push(response(403,{error:'<script>bad</script>'}),response(413),response(400),
    response(409),{status:200,json:async()=>{throw Error('not JSON');}},response());
  for(let i=0;i<5;i++){
    await app.send();assert.equal(app.status.dataset.state,'error');assert.equal(app.form.resets,0);
    assert.equal(app.fields.company.value,'<img src=x onerror=alert(1)>');
    assert.doesNotMatch(app.status.textContent,/<(?:script|img)/);
  }
  assert.ok(app.calls.every(call=>call.url==='/api/contact'&&call.body.company==='<img src=x onerror=alert(1)>'),
    'Personal data stays in the JSON body; it is never appended to the URL or interpreted as HTML.');
  assert.notEqual(app.calls[3].body.requestId,app.calls[4].body.requestId,'An explicit conflict allows a fresh request ID.');
  await app.send();assert.equal(app.status.dataset.state,'accepted');
});

test('a timed out send can be retried idempotently without losing the draft',async()=>{
  const app=harness();
  app.replies.push(options=>new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>reject(Error('timeout')))));
  const first=app.send();app.expire();await first;
  assert.equal(app.form.resets,0);assert.equal(app.submit.disabled,false);
  assert.match(app.status.textContent,/couldn’t confirm/);
  await app.send();assert.equal(app.calls[0].body.requestId,app.calls[1].body.requestId);
  assert.equal(app.form.resets,1);
});

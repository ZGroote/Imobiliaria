import test from 'node:test';
import assert from 'node:assert/strict';
import {MessageChannel} from 'node:worker_threads';
import {installShaderScheduler} from '../shader-scheduler.js';

test('sem scheduler, a compilação cede por tarefa mesmo sem repaint do iframe',async()=>{
  const scope={MessageChannel,requestAnimationFrame(){throw Error('Não pode aguardar repaint oculto.');}};
  const cleanup=installShaderScheduler(scope);
  let settled=false;const pending=scope.scheduler.yield().then(()=>{settled=true;});
  assert.equal(settled,false,'Deve ceder a execução, não devolver Promise já resolvida.');
  await pending;assert.equal(settled,true);cleanup();assert.equal('scheduler' in scope,false);
});

test('mantém o scheduler nativo e suas outras APIs',async()=>{
  let calls=0;const native={yield:async()=>{calls++;},postTask:()=>42},scope={scheduler:native,MessageChannel};
  const cleanup=installShaderScheduler(scope);assert.equal(scope.scheduler,native);
  await scope.scheduler.yield();cleanup();assert.equal(calls,1);assert.equal(scope.scheduler,native);
});

test('completa scheduler sem yield e restaura só o método que instalou',async()=>{
  const native={postTask:()=>42},scope={scheduler:native,MessageChannel};
  const cleanup=installShaderScheduler(scope);assert.equal(scope.scheduler.postTask(),42);
  await Promise.all(Array.from({length:30},()=>scope.scheduler.yield()));
  cleanup();cleanup();assert.equal(scope.scheduler,native);assert.equal('yield' in native,false);
});


test('scheduler não extensível conserva o fallback original sem quebrar a página',()=>{
  const scope={MessageChannel,scheduler:Object.freeze({postTask(){}})};
  assert.doesNotThrow(()=>installShaderScheduler(scope)());assert.equal(scope.scheduler.yield,undefined);
});

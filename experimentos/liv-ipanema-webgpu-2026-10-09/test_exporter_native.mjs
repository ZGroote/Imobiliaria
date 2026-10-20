import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';
import vm from 'node:vm';

test('a identidade geométrica permanece válida após JSON normalizar zero negativo',async()=>{
  const context=vm.createContext({crypto:webcrypto});
  vm.runInContext(readFileSync(new URL('./exporter-native.js',import.meta.url),'utf8'),context);
  const geometry={position:[-0,1,2,3,-0,4],normal:[-0,0,1,0,-0,-1],uv:[-0,1,2,-0],color:[],index:[0,1]};
  const saved=JSON.parse(JSON.stringify(geometry));
  assert.equal(await context.hashGeometriaInteriorLiv(geometry),await context.hashGeometriaInteriorLiv(saved));
  assert.equal(Object.is(geometry.position[0],-0),true,'Hashing must not rewrite the caller geometry.');
  const changed=structuredClone(saved);changed.position[1]=1.25;
  assert.notEqual(await context.hashGeometriaInteriorLiv(saved),await context.hashGeometriaInteriorLiv(changed));
});

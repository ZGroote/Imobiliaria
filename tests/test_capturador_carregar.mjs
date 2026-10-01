import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {carregar,exportar,aplicar} from '../painel/src/components/construtor-planta/modelo.ts';
const doc=JSON.parse(readFileSync(new URL('./fixtures/leitura/v1/capturador-aberturas-mobile.json',import.meta.url),'utf8'));
test('carregar snapshot preserva semântica, identidade e não compartilha estado mutável',()=>{
  const before=JSON.stringify(doc),s=carregar(doc);
  assert.deepEqual(JSON.parse(exportar(s)),doc);
  const next=aplicar(s,{type:'opening-edit',...s.present.openings[1],widthMm:1300});
  assert.equal(next.revision,doc.revision+1);assert.equal(JSON.stringify(doc),before);
  assert.equal(next.id,doc.id);assert.equal(s.nextOpeningId,3);assert.equal(s.nextId,3);
});
test('editor não descarta referências, procedência ou paredes fora de seu subconjunto',()=>{
  const d=structuredClone(doc);d.references=[{id:'foto',kind:'photo',description:'Foto'}];
  assert.throws(()=>carregar(d),/suportado/);
  const wall=structuredClone(doc);wall.rooms[0].walls.south='outra';assert.throws(()=>carregar(wall),/suportado/);
});
test('editor ainda produz 1.0.0 e recusa leitura 1.1.0 (cômodo mesclado) sem descartar nada',()=>{
  const v11=structuredClone(doc);v11.schemaVersion='1.1.0';assert.throws(()=>carregar(v11),/suportado/);
  const merged=structuredClone(v11);merged.relations[0].kind='merged';assert.throws(()=>carregar(merged),/suportado/);
});

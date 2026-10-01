import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {prepararLeitura} from '../tools/leitura-api.mjs';
const text=readFileSync(new URL('./fixtures/leitura/v1/capturador-aberturas-mobile.json',import.meta.url),'utf8');
test('gravação exige gate Python real e hash canônico M1-A',async()=>{
  const a=await prepararLeitura(text),b=await prepararLeitura(JSON.stringify(JSON.parse(text)));
  assert.deepEqual(a,b);assert.equal(a.contentSha256,'354dfa0ca394accff00060ab2fe83c60ad34cdafd294035d2bd7770218d5d313');
  const invalid=JSON.parse(text);invalid.openings[0].widthMm=999999;
  await assert.rejects(prepararLeitura(JSON.stringify(invalid)),/INVALID_OPENING/);
  await assert.rejects(prepararLeitura(text.replace('"revision": 13','"revision": 13, "revision": 14')),/INVALID_JSON/);
});
test('gravação aceita leitura 1.1.0 (cômodo mesclado) pelo mesmo gate',async()=>{
  const l=readFileSync(new URL('./fixtures/leitura/v1/sala-em-l.json',import.meta.url),'utf8');
  assert.equal((await prepararLeitura(l)).leitura.schemaVersion,'1.1.0');
  const nome=JSON.parse(l);nome.rooms[2].name='Estar';
  await assert.rejects(prepararLeitura(JSON.stringify(nome)),/MERGED_NAME_MISMATCH/);
});

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,readdirSync,unlinkSync,rmdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,basename} from 'node:path';
import {importCommercial} from './importar_comercial.mjs';
test('valid import is repeatable and invalid replacement preserves the previous bytes',()=>{
  const directory=mkdtempSync(join(tmpdir(),'liv-commercial-test-'));
  const input=join(directory,'input.json'),output=join(directory,'output.json');
  const pilot=JSON.parse(readFileSync(new URL('modelo/entrada/unidades-entrada.json',import.meta.url),'utf8'));
  const data={schema:'liv-commercial-v1',status:'fornecido',bookSHA256:pilot.source.bookSHA256,
    source:{label:'Fixture sintética, sem oferta real',asOf:'2026-10-11'},units:[{
      id:'liv-ipanema/pavimento-modelo-00/final-01',commercialNumber:'TESTE',priceCents:10,availability:'disponivel'}]};
  try{
    writeFileSync(output,'VERSAO ANTERIOR');writeFileSync(input,JSON.stringify(data));
    assert.equal(importCommercial(input,output).changed,true);
    assert.equal(readFileSync(output+'.previous','utf8'),'VERSAO ANTERIOR');
    const before=readFileSync(output,'utf8');assert.equal(importCommercial(input,output).changed,false);
    data.units[0].id='101';writeFileSync(input,JSON.stringify(data));
    assert.throws(()=>importCommercial(input,output));assert.equal(readFileSync(output,'utf8'),before);
    assert.equal(readFileSync(output+'.previous','utf8'),'VERSAO ANTERIOR');
    assert.throws(()=>importCommercial(input,input));assert.equal(readdirSync(directory).length,3);
  }finally{
    assert.equal(resolve(directory),join(resolve(tmpdir()),basename(directory)));
    assert.ok(basename(directory).startsWith('liv-commercial-test-'));
    for(const file of ['input.json','output.json','output.json.previous']){
      try{unlinkSync(join(directory,file));}catch(error){if(error.code!=='ENOENT')throw error;}
    }
    rmdirSync(directory);
  }
});

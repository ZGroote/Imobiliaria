import test from 'node:test'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {mkdtempSync,readFileSync,writeFileSync,mkdirSync,existsSync,rmSync,readdirSync,symlinkSync,watch} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {execFile} from 'node:child_process'
import {promisify} from 'node:util'
import {carregar,documento,iniciar,aplicar} from '../painel/src/components/construtor-planta/modelo.ts'
import {exportarEditor} from '../painel/src/components/construtor-planta/editorDocument.ts'
import {avaliarProjetoCapturado} from '../tools/avaliar_projeto_capturado.mjs'

const root=new URL('..',import.meta.url)
const fixture=readFileSync(new URL('./fixtures/leitura/v1/capturador-aberturas-mobile.json',import.meta.url))
const hash=bytes=>createHash('sha256').update(bytes).digest('hex')
const json=file=>JSON.parse(readFileSync(file,'utf8'))
const exec=promisify(execFile)
function workspace(t){const dir=mkdtempSync(join(tmpdir(),'avaliar-projeto-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));return dir}
function projeto(){
  let ground=carregar(JSON.parse(fixture))
  ground=aplicar(ground,{type:'furniture-add',item:{tipoCatalogo:'sofa-3',tipo3D:'sofa',nome:'Sofá',xMm:1200,yMm:700,
    widthMm:1960,depthMm:920,alturaMm:800,rotDegrees:90,cor:'#4A5A6B'}})
  let upper=aplicar(iniciar('leitura-superior'),{type:'add',name:'Sala',xMm:0,yMm:0,widthMm:3000,depthMm:3000,ceilingHeightMm:2700})
  upper=aplicar(upper,{type:'add',name:'Sala',xMm:3000,yMm:0,widthMm:2000,depthMm:2000,ceilingHeightMm:2700})
  upper=aplicar(upper,{type:'merge',roomAId:'c1',roomBId:'c2'})
  return {0:ground,1:upper}
}

test('preserva bytes originais e extrai todos os pisos, móveis e leitura composta',async t=>{
  const dir=workspace(t),input=join(dir,'download.json'),destino=join(dir,'resultado'),sessions=projeto()
  const raw=Buffer.from(exportarEditor(sessions,1).replaceAll('\n','\r\n'))
  writeFileSync(input,raw)
  const report=await avaliarProjetoCapturado({arquivo:input,caso:'C1',destino})
  assert.equal(report.ok,true)
  assert.equal(report.physicalAccepted,false)
  assert.equal(report.andarSelecionado,1)
  assert.deepEqual(readFileSync(input),raw)
  assert.deepEqual(readFileSync(join(destino,'original.json')),raw)
  assert.equal(report.original.sha256,hash(raw))
  assert.deepEqual(report.andares.map(f=>f.andar),[0,1])
  assert.deepEqual(json(join(destino,'andar-0/leitura.json')),documento(sessions[0]))
  assert.deepEqual(json(join(destino,'andar-1/leitura.json')),documento(sessions[1]))
  const sofa=json(join(destino,'andar-0/moveis.json')).moveis[0]
  assert.deepEqual({p:sofa.p,rot:sofa.rot,w:sofa.w,h:sofa.h,d:sofa.d},{p:[1.2,0.7],rot:1,w:1.96,h:0.8,d:0.92})
  assert.equal(report.andares.every(f=>f.avaliacao.m1_0.ok&&f.avaliacao.m1_a.ok&&f.avaliacao.consumidor.ok),true)
  assert.equal(report.andares.every(f=>f.encaixeReal==='nao-avaliado'),true)
  assert.deepEqual(json(join(destino,'relatorio.json')),report)
})

test('CLI aceita leitura bare, não inventa móveis e retorna recusa M1-F apesar de avaliador exit0',async t=>{
  const dir=workspace(t),input=join(dir,'leitura.json'),destino=join(dir,'bare')
  writeFileSync(input,fixture)
  await exec(process.execPath,['tools/avaliar_projeto_capturado.mjs',input,'--caso','C2','--destino',destino],{cwd:root})
  assert.equal(json(join(destino,'relatorio.json')).ok,true)
  assert.deepEqual(json(join(destino,'andar-0/moveis.json')).moveis,[])
  const fora=JSON.parse(fixture);fora.rooms[1].widthMm+=1
  writeFileSync(input,JSON.stringify(fora))
  const refused=await avaliarProjetoCapturado({arquivo:input,caso:'C2',destino:join(dir,'recusa'),demo:true})
  assert.equal(refused.ok,false)
  assert.equal(refused.andares[0].avaliacao.m1_0.ok,true)
  assert.equal(refused.andares[0].avaliacao.consumidor.ok,false)
  assert.equal(refused.errors.some(e=>e.code==='FORA_DA_GRADE'),true)
  assert.equal(existsSync(join(dir,'recusa/andar-0/maquete')),false)
})

test('recusas normativas e JSON ambíguo preservam original e relatório sem extrair dados inválidos',async t=>{
  const dir=workspace(t),input=join(dir,'download.json')
  const invalid=JSON.parse(fixture);invalid.rooms[0].widthMm=-1
  for(const [i,raw,code] of [[0,JSON.stringify(invalid),'INVALID_DIMENSION'],
    [1,fixture.toString('utf8').replace('"revision":','"revision":99,"revision":'),'INVALID_JSON'],
    [2,'{"schemaVersion":"1.0.0","schemaVersion":"1.0.0"}','INVALID_JSON']]){
    writeFileSync(input,raw)
    const dest=join(dir,'r'+i),r=await avaliarProjetoCapturado({arquivo:input,caso:'C3',destino:dest})
    assert.equal(r.ok,false)
    assert.equal(r.physicalAccepted,false)
    assert.equal(r.errors.some(e=>e.code===code),true)
    assert.deepEqual(readFileSync(join(dest,'original.json')),Buffer.from(raw))
    assert.equal(existsSync(join(dest,'andar-0/leitura.json')),false)
  }
})

test('recusa destino preexistente vazio/ocupado e entrada/saída por symlink sem apagar dados',async t=>{
  const dir=workspace(t),input=join(dir,'download.json');writeFileSync(input,fixture)
  for(const name of ['vazio','ocupado']){
    const dest=join(dir,name);mkdirSync(dest)
    if(name==='ocupado')writeFileSync(join(dest,'usuario.txt'),'preservar')
    await assert.rejects(avaliarProjetoCapturado({arquivo:input,caso:'C4',destino:dest}),/DESTINO_OCUPADO/)
    assert.equal(existsSync(dest),true)
    if(name==='ocupado')assert.equal(readFileSync(join(dest,'usuario.txt'),'utf8'),'preservar')
  }
  const linked=join(dir,'link'),real=join(dir,'real');mkdirSync(real);writeFileSync(join(real,'download.json'),fixture)
  symlinkSync(real,linked,process.platform==='win32'?'junction':'dir')
  await assert.rejects(avaliarProjetoCapturado({arquivo:join(linked,'download.json'),caso:'C4',destino:join(dir,'saida')}),/SYMLINK/)
  await assert.rejects(avaliarProjetoCapturado({arquivo:input,caso:'C4',destino:join(linked,'saida')}),/SYMLINK/)
  assert.equal(existsSync(join(real,'saida')),false)
})

test('demo e contexto real são explícitos; apenas piso selecionado gera e aplica contexto',async t=>{
  const dir=workspace(t),input=join(dir,'projeto.json');writeFileSync(input,exportarEditor(projeto(),1))
  const demo=await avaliarProjetoCapturado({arquivo:input,caso:'C5',destino:join(dir,'demo'),andar:0,demo:true})
  assert.equal(demo.ok,true)
  assert.equal(demo.andarSelecionado,0)
  assert.equal(demo.andares[0].geracao.ok,true)
  assert.equal(demo.andares[0].geracao.andarNoArtefato,0)
  assert.match(demo.andares[0].geracao.rotulo,/piso 0/)
  assert.equal(demo.andares[0].encaixeReal,'nao-avaliado')
  assert.equal(demo.andares[1].geracao,undefined)
  const html=readFileSync(join(dir,'demo/andar-0/maquete/maquete.html'))
  assert.equal(demo.andares[0].geracao.relatorio.artefato.sha256,hash(html))
  assert.match(html.toString('utf8'),/Prévia demonstrativa/)
  const ctx=join(dir,'contexto.json'),contexto={schema:1,propertyId:'real-C5',agencyId:'estudo',andar:1,
    ficha:{titulo:'Dados declarados do caso'},lote:{predio:{largura_m:10,profundidade_m:10,pavimentos:2}}}
  writeFileSync(ctx,JSON.stringify(contexto))
  const actual=await avaliarProjetoCapturado({arquivo:input,caso:'C5',destino:join(dir,'real'),contexto:ctx})
  assert.equal(actual.ok,true)
  assert.equal(actual.andares[0].encaixeReal,'nao-avaliado')
  assert.equal(actual.andares[1].encaixeReal,'conferido')
  assert.equal(actual.andares[1].geracao.relatorio.entrada.propertyId,'real-C5')
  await assert.rejects(avaliarProjetoCapturado({arquivo:input,caso:'C5',destino:join(dir,'ambigua'),demo:true,contexto:ctx}),/MODO_AMBIGUO/)
  assert.equal(existsSync(join(dir,'ambigua')),false)
})

test('contexto de outro piso é recusado e demo do superior explicita pavimento demonstrativo0',async t=>{
  const dir=workspace(t),input=join(dir,'projeto.json');writeFileSync(input,exportarEditor(projeto(),1))
  const ctx=join(dir,'contexto.json');writeFileSync(ctx,JSON.stringify({schema:1,propertyId:'real',agencyId:'estudo',andar:0,
    ficha:{titulo:'Dados declarados'},lote:{predio:{largura_m:10,profundidade_m:10,pavimentos:2}}}))
  const refused=await avaliarProjetoCapturado({arquivo:input,caso:'C1',destino:join(dir,'divergente'),contexto:ctx})
  assert.equal(refused.ok,false)
  assert.equal(refused.errors.some(e=>e.code==='CONTEXTO_ANDAR_DIVERGENTE'),true)
  assert.equal(refused.andares[1].encaixeReal,'recusado')
  assert.equal(existsSync(join(dir,'divergente/andar-1/maquete')),false)
  const demo=await avaliarProjetoCapturado({arquivo:input,caso:'C1',destino:join(dir,'demo-superior'),demo:true})
  assert.equal(demo.ok,true)
  assert.equal(demo.andares[1].geracao.andarNoArtefato,0)
  assert.match(demo.andares[1].geracao.rotulo,/pavimento demonstrativo 0.*piso 1/)
  assert.equal(demo.andares[1].encaixeReal,'nao-avaliado')
})

test('piso não ativo também passa pelo gate normativo e CLI recusa com exit2',async t=>{
  const dir=workspace(t),input=join(dir,'invalido.json'),state=JSON.parse(exportarEditor(projeto(),0))
  state.floors[1].leitura.rooms[0].widthMm=-1
  writeFileSync(input,JSON.stringify(state))
  const dest=join(dir,'recusa')
  await assert.rejects(exec(process.execPath,['tools/avaliar_projeto_capturado.mjs',input,'--caso','C2','--destino',dest],{cwd:root}),
    e=>e.code===2&&JSON.parse(e.stdout).ok===false)
  const report=json(join(dest,'relatorio.json'))
  assert.equal(report.errors.some(e=>e.code==='INVALID_DIMENSION'&&e.path.includes('/floors/1/')),true)
  assert.equal(report.physicalAccepted,false)
  assert.equal(existsSync(join(dest,'andar-0')),false)
})

test('ocupação concorrente recusa a promoção e limpa somente o trabalho temporário',async t=>{
  const dir=workspace(t),input=join(dir,'download.json'),destino=join(dir,'concorrente');writeFileSync(input,fixture)
  const watcher=watch(dir,(_event,name)=>{
    if(String(name).startsWith('.m1-1-captura-')&&!existsSync(destino)){
      mkdirSync(destino);writeFileSync(join(destino,'usuario.txt'),'preservar')
    }
  });t.after(()=>watcher.close())
  await assert.rejects(avaliarProjetoCapturado({arquivo:input,caso:'C1',destino}),/DESTINO_OCUPADO/)
  assert.equal(readFileSync(join(destino,'usuario.txt'),'utf8'),'preservar')
  assert.equal(readdirSync(dir).some(name=>name.startsWith('.m1-1-captura-')),false)
})

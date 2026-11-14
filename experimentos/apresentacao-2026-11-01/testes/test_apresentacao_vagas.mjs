import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {mkdtemp,mkdir,readFile,readdir,rm,writeFile} from 'node:fs/promises';
import {dirname,join,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import test from 'node:test';
import vm from 'node:vm';
import {attachCommercial as attachBaseCommercial} from '../site/demo/comercial.js';
import {expandBuildingCatalog} from '../site/demo/catalogo-unidades.js';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../../..');
const presentation=join(root,'experimentos/apresentacao-2026-11-01'),demo=join(presentation,'site/demo');
const read=async name=>readFile(join(demo,name));
const json=async name=>JSON.parse(await read(name));
const clone=value=>JSON.parse(JSON.stringify(value));

async function wrapper(){
  const code=(await readFile(join(presentation,'comercial-apresentacao.js'),'utf8'))
    .replace(/^import .*;\r?\n/gm,'').replaceAll('export function','function');
  const context=vm.createContext({attachBaseCommercial});
  vm.runInContext(code+'\nglobalThis.attach=attachPresentationCommercial;',context);
  return context.attach;
}

test('the demo links all170 explicit parking labels to physical spaces without changing the client module',async()=>{
  const attach=await wrapper(),pilot=await json('modelo/entrada/unidades-entrada.json');
  const catalog=expandBuildingCatalog(pilot),commercial=await json('comercial.json');
  const original=clone(catalog),input=clone(commercial),base=attachBaseCommercial(catalog,commercial);
  assert.ok(base.units.every(unit=>unit.parkingSpaces===undefined),'The original commercial module keeps its original contract.');
  const next=attach(catalog,commercial),physical=new Set((await json('modelo/entrada/candidato/vagas.json')).vagas.map(v=>v.numero));
  assert.equal(next.units.length,170);
  assert.ok(next.units.every(unit=>unit.parkingSpaces.length===1&&physical.has(unit.parkingSpaces[0])));
  for(const [id,number]of [['vila-aurora/pavimento-modelo-00/final-01',1],['vila-aurora/pavimento-modelo-16/final-10',170]]){
    const unit=next.units.find(unit=>unit.id===id);
    assert.deepEqual([...unit.parkingSpaces],[number]);
    assert.equal(unit.commercial.parking,`Vaga ${number}`);
  }
  for(let i=0;i<next.units.length;i++){
    const {parkingSpaces,...unit}=next.units[i];
    assert.deepEqual(clone(unit),clone(base.units[i]),'Only the presentation parking array is added.');
  }
  assert.deepEqual(catalog,original);assert.deepEqual(commercial,input);
});

test('refresh replaces or clears links; generic counts and unknown spaces never become assignments',async()=>{
  const attach=await wrapper(),catalog=expandBuildingCatalog(await json('modelo/entrada/unidades-entrada.json'));
  const commercial=await json('comercial.json');let current=attach(catalog,commercial);
  for(const [label,expected]of [['Vaga 175',[175]],[null,[]],['1 vaga',[]],['Vagas 1 e 2',[]],['Vaga 176',[]],['Vaga 9007199254740993',[]],['Vaga 01',[]],['Vaga 2',[2]]]){
    const next=clone(commercial);next.units[0].parking=label;
    current=attach(current,next);assert.deepEqual([...current.units[0].parkingSpaces],expected,label);
  }
  const removed=clone(commercial);removed.units.shift();
  current=attach(current,removed);assert.deepEqual([...current.units[0].parkingSpaces],[]);
  current=attach(current,{schema:'liv-commercial-v1',status:'ausente',source:null,units:[]});
  assert.ok(current.units.every(unit=>unit.parkingSpaces.length===0));
});

async function snapshot(dir){
  const records={};
  for(const item of await readdir(dir,{withFileTypes:true})){
    if(item.isDirectory())for(const [path,sha]of Object.entries(await snapshot(join(dir,item.name))))records[item.name+'/'+path]=sha;
    else records[item.name]=createHash('sha256').update(await readFile(join(dir,item.name))).digest('hex');
  }
  return records;
}

async function fixture(t){
  const scratch=join(root,'.tmp');await mkdir(scratch,{recursive:true});
  const dir=await mkdtemp(join(scratch,'presentation-parking-'));
  t.after(async()=>{assert.ok(resolve(dir).startsWith(resolve(scratch)+sep));await rm(dir,{recursive:true,force:true});});
  for(const path of ['viewer.js','comercial.json','modelo/entrada/candidato/vagas.json','modelo/entrada/unidades-entrada.json']){
    await mkdir(dirname(join(dir,path)),{recursive:true});await writeFile(join(dir,path),await read(path));
  }
  const run=()=>spawnSync('python',['-I','-X','utf8','-c',
    "import importlib.util,pathlib,sys; s=importlib.util.spec_from_file_location('builder',sys.argv[1]); m=importlib.util.module_from_spec(s); s.loader.exec_module(m); m.DESTINO=pathlib.Path(sys.argv[2]); m.ligar_vagas_apresentacao()",
    join(presentation,'clonar_demo.py'),dir],{cwd:root,encoding:'utf8'});
  return {dir,run};
}

test('build links the shared import once and leaves all175 parking geometries and source rows unchanged',async t=>{
  const app=await fixture(t),before=await snapshot(app.dir);
  let result=app.run();assert.equal(result.status,0,result.stderr||result.stdout);
  const first=await snapshot(app.dir),viewer=await readFile(join(app.dir,'viewer.js'),'utf8');
  assert.match(viewer,/import \{attachPresentationCommercial as attachCommercial\} from '\.\/comercial-apresentacao\.js';/);
  assert.equal(first['comercial.json'],before['comercial.json']);
  assert.equal(first['modelo/entrada/candidato/vagas.json'],before['modelo/entrada/candidato/vagas.json']);
  assert.equal(first['modelo/entrada/unidades-entrada.json'],before['modelo/entrada/unidades-entrada.json']);
  assert.deepEqual(await readFile(join(app.dir,'comercial-apresentacao.js')),await readFile(join(presentation,'comercial-apresentacao.js')));
  result=app.run();assert.equal(result.status,0,result.stderr||result.stdout);
  assert.deepEqual(await snapshot(app.dir),first,'Repeated integration does not stack imports or alter data.');
});

test('invalid parking numbers, duplicate assignments and unknown units fail before any build mutation',async t=>{
  const app=await fixture(t),commercial=await json('comercial.json'),physical=await json('modelo/entrada/candidato/vagas.json');
  const cases=[
    ['comercial.json',value=>{value.units[0].parking='Vaga 176';}],
    ['comercial.json',value=>{value.units[0].parking='1 vaga';}],
    ['comercial.json',value=>{value.units[1].parking=value.units[0].parking;}],
    ['comercial.json',value=>{value.units[0].id='vila-aurora/pavimento-modelo-99/final-01';}],
    ['comercial.json',value=>{value.units[1].id=value.units[0].id;}],
    ['modelo/entrada/candidato/vagas.json',value=>{value.vagas[1].numero=value.vagas[0].numero;}],
    ['modelo/entrada/candidato/vagas.json',value=>{value.vagas.pop();}],
  ];
  for(const [path,change]of cases){
    await writeFile(join(app.dir,'comercial.json'),JSON.stringify(commercial));
    await writeFile(join(app.dir,'modelo/entrada/candidato/vagas.json'),JSON.stringify(physical));
    const value=clone(path==='comercial.json'?commercial:physical);change(value);await writeFile(join(app.dir,path),JSON.stringify(value));
    const before=await snapshot(app.dir),result=app.run();
    assert.notEqual(result.status,0,path);assert.match(result.stderr,/ValueError: .*vaga/i);
    assert.deepEqual(await snapshot(app.dir),before,'Invalid input cannot partially change the demo.');
  }
});

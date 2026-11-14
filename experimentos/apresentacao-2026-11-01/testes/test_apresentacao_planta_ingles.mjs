import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp, mkdir, readFile, readdir, rm, writeFile} from 'node:fs/promises';
import {dirname, join, resolve, sep} from 'node:path';
import {spawnSync} from 'node:child_process';
import {deflateSync} from 'node:zlib';
import {fileURLToPath} from 'node:url';
import test from 'node:test';
import vm from 'node:vm';
import {localizedPlanImage} from '../planta2d-idioma.js';
import * as ruler from '../site/demo/plan-ruler.js';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../../..');
const presentation=join(root,'experimentos/apresentacao-2026-11-01');
const source=join(presentation,'site/demo');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const json=value=>JSON.parse(JSON.stringify(value));

function pngFixture(width=1000,height=1000){
  const crc=bytes=>{let value=0xffffffff;for(const byte of bytes){value^=byte;for(let bit=0;bit<8;bit++)value=(value>>>1)^((value&1)?0xedb88320:0);}return (value^0xffffffff)>>>0;};
  const chunk=(name,data)=>{
    const type=Buffer.from(name),size=Buffer.alloc(4),checksum=Buffer.alloc(4);
    size.writeUInt32BE(data.length);checksum.writeUInt32BE(crc(Buffer.concat([type,data])));
    return Buffer.concat([size,type,data,checksum]);
  };
  const header=Buffer.alloc(13);header.writeUInt32BE(width,0);header.writeUInt32BE(height,4);header[8]=8;header[9]=6;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),
    chunk('IDAT',deflateSync(Buffer.alloc((width*4+1)*height))),chunk('IEND',Buffer.alloc(0))]);
}

test('the original image remains the default; only an explicit English query selects its translated copy',()=>{
  const pt='plantas2d/canto.jpg?rev=original-20261102',en='plantas2d/canto-en.png?rev=123456abcdef';
  assert.equal(localizedPlanImage(pt,en),pt,'Importing the catalog without browser globals must keep working.');
  for(const search of ['','?lang=pt-BR','?lang=fr','?lang=en-US','?other=en'])assert.equal(localizedPlanImage(pt,en,search),pt);
  assert.equal(localizedPlanImage(pt,en,'?tipologia=canto&lang=en'),en);
});

async function fixture(t){
  const scratch=join(root,'.tmp');await mkdir(scratch,{recursive:true});
  const dir=await mkdtemp(join(scratch,'plan-english-'));
  t.after(async()=>{
    assert.ok(resolve(dir).startsWith(resolve(scratch)+sep),'Only remove this test’s temporary fixture.');
    await rm(dir,{recursive:true,force:true});
  });
  const demo=join(dir,'demo'),assets=join(dir,'english');
  await mkdir(join(demo,'plantas2d'),{recursive:true});await mkdir(assets);
  await writeFile(join(demo,'tipologias.js'),await readFile(join(source,'tipologias.js')));
  const originals={};
  for(const type of ['canto','meio'])for(const suffix of ['.jpg','-recorte.svg']){
    const relative='plantas2d/'+type+suffix;
    originals[relative]=await readFile(join(source,relative));
    await writeFile(join(demo,relative),originals[relative]);
  }
  const manifest={schema:'liv-transfer-manifest-v1',order:['tour','map','planta2d'],
    groups:{tour:{label:'Tour'},map:{label:'Map'},planta2d:{label:'Planta 2D'}},
    files:[{path:'kept.bin',group:'tour',bytes:7,sha256:'a'.repeat(64),essential:true},
      ...['canto','meio'].map(type=>({path:`plantas2d/${type}.jpg`,group:'planta2d',bytes:originals[`plantas2d/${type}.jpg`].length,
        sha256:sha(originals[`plantas2d/${type}.jpg`]),essential:false}))],version:'old-version'};
  await writeFile(join(demo,'transfer-manifest.json'),JSON.stringify(manifest));
  // The fixture checks selection and integrity; no image is decoded by a GPU.
  const png=pngFixture();
  for(const type of ['canto','meio'])await writeFile(join(assets,type+'.png'),Buffer.concat([png,Buffer.from(type)]));
  const run=()=>spawnSync('python',['-I','-X','utf8','-c',
    "import importlib.util, pathlib, sys; s=importlib.util.spec_from_file_location('demo_builder',sys.argv[1]); m=importlib.util.module_from_spec(s); s.loader.exec_module(m); m.DESTINO=pathlib.Path(sys.argv[2]); m.internacionalizar_plantas(pathlib.Path(sys.argv[3]))",
    join(presentation,'clonar_demo.py'),demo,assets],{encoding:'utf8',cwd:root});
  const integrate=()=>{const result=run();assert.equal(result.status,0,result.stderr||result.stdout);};
  return {dir,demo,assets,originals,manifest,run,integrate};
}

async function catalog(demo,search,helperFile=join(demo,'planta2d-idioma.js')){
  const helper=(await readFile(helperFile,'utf8')).replaceAll('export function','function');
  const spec=(await readFile(join(demo,'tipologias.js'),'utf8')).replace(/^import .*;\r?\n/gm,'')
    .replaceAll('export const','const').replaceAll('export function','function');
  const context=vm.createContext({URLSearchParams,location:{search}});
  vm.runInContext(helper+'\n'+spec+'\nglobalThis.catalog=typologies;',context);
  return context.catalog;
}

async function files(dir){
  const snapshot={};
  for(const item of await readdir(dir,{withFileTypes:true})){
    if(item.isDirectory())for(const [name,bytes]of Object.entries(await files(join(dir,item.name))))snapshot[item.name+'/'+name]=bytes;
    else snapshot[item.name]=sha(await readFile(join(dir,item.name)));
  }
  return snapshot;
}

test('the generator preserves every PT byte and plan coordinate, updates hashes and is idempotent',async t=>{
  const app=await fixture(t),before=await catalog(app.demo,'?lang=pt-BR',join(presentation,'planta2d-idioma.js'));
  app.integrate();
  const pt=await catalog(app.demo,'?lang=pt-BR'),en=await catalog(app.demo,'?lang=en');
  assert.deepEqual(json(pt),json(before),'The complete Portuguese catalog must remain unchanged.');
  for(const type of ['canto','meio']){
    const png=await readFile(join(app.assets,type+'.png'));
    assert.equal(pt[type].image,`plantas2d/${type}.jpg?rev=original-20261102`);
    assert.equal(en[type].image,`plantas2d/${type}-en.png?rev=${sha(png).slice(0,12)}`);
    const {image:ptImage,...ptMetadata}=pt[type],{image:enImage,...enMetadata}=en[type];
    assert.deepEqual(json(enMetadata),json(ptMetadata),'Ruler, mask, measurements and entrance use the same registration.');
    assert.deepEqual(await readFile(join(app.demo,'plantas2d',type+'-en.png')),png);
  }
  for(const [name,bytes]of Object.entries(app.originals))assert.deepEqual(await readFile(join(app.demo,name)),bytes,name);
  const manifest=JSON.parse(await readFile(join(app.demo,'transfer-manifest.json'),'utf8'));
  assert.deepEqual(manifest.files.slice(0,app.manifest.files.length),app.manifest.files,'Existing records remain intact.');
  for(const type of ['canto','meio']){
    const entry=manifest.files.find(item=>item.path===`plantas2d/${type}-en.png`),png=await readFile(join(app.assets,type+'.png'));
    assert.deepEqual(entry,{path:`plantas2d/${type}-en.png`,group:'planta2d',bytes:png.length,sha256:sha(png),essential:false});
  }
  const first=await files(app.demo);app.integrate();assert.deepEqual(await files(app.demo),first);
  const changed=Buffer.concat([await readFile(join(app.assets,'canto.png')),Buffer.from('revision')]);
  await writeFile(join(app.assets,'canto.png'),changed);app.integrate();
  assert.equal((await catalog(app.demo,'?lang=en')).canto.image,`plantas2d/canto-en.png?rev=${sha(changed).slice(0,12)}`);
  const revised=JSON.parse(await readFile(join(app.demo,'transfer-manifest.json'),'utf8'));
  assert.notEqual(revised.version,manifest.version);
  assert.equal(revised.files.filter(item=>item.path==='plantas2d/canto-en.png').length,1);
  assert.deepEqual(revised.files.slice(0,app.manifest.files.length),app.manifest.files);
});

test('missing English assets fail clearly before changing the demo',async t=>{
  const app=await fixture(t);await rm(join(app.assets,'meio.png'));
  const before=await files(app.demo),result=app.run();
  assert.notEqual(result.status,0);assert.match(result.stderr,/Falta a planta 2D em ingl/);assert.match(result.stderr,/meio\.png/);
  assert.deepEqual(await files(app.demo),before);
});

test('an English image with different dimensions is rejected before changing the registered plan',async t=>{
  const app=await fixture(t);await writeFile(join(app.assets,'canto.png'),pngFixture(1024,1024));
  const before=await files(app.demo),result=app.run();
  assert.notEqual(result.status,0);assert.match(result.stderr,/1000×1000/);
  assert.deepEqual(await files(app.demo),before);
});

class Element{
  constructor(){this.children=[];this.style={};this.dataset={};this.attributes={};this.pointers=new Set();}
  append(...children){for(const child of children){this.children.push(child);child.parent=this;}}
  remove(){if(this.parent)this.parent.children=this.parent.children.filter(child=>child!==this);}
  addEventListener(){}removeEventListener(){}
  setAttribute(name,value){this.attributes[name]=value;}
  getBoundingClientRect(){return {width:1040,height:650,left:0,top:0};}
  hasPointerCapture(id){return this.pointers.has(id);}releasePointerCapture(id){this.pointers.delete(id);}
}

test('both English images predecode once and remain cached while plans alternate',async t=>{
  const app=await fixture(t);app.integrate();const plans=await catalog(app.demo,'?lang=en');
  const images=[],document={createElement:()=>new Element(),createElementNS:()=>{const node=new Element();node.ownerDocument=document;return node;}};
  const context=vm.createContext({document,...ruler,
    Image:class extends Element{
      constructor(){super();this.naturalWidth=1000;this.naturalHeight=1000;images.push(this);}
      decode(){this.decodes=(this.decodes||0)+1;return Promise.resolve();}
    }});
  const code=(await readFile(join(source,'planta2d.js'),'utf8')).replace(/^import .*;\r?\n/gm,'').replaceAll('export function','function');
  vm.runInContext(code+'\nglobalThis.create=createPlan2D;',context);
  const viewer=context.create(new Element(),{});t.after(()=>viewer.dispose());
  const canto=viewer.prepare('canto',plans.canto),meio=viewer.prepare('meio',plans.meio);
  assert.equal(viewer.prepare('canto',plans.canto),canto,'In-flight prepare calls share one decode.');
  await Promise.all([canto,meio]);const original=[viewer.getImage('canto'),viewer.getImage('meio')];
  for(let cycle=0;cycle<3;cycle++)for(const type of ['canto','meio']){
    assert.equal(viewer.show(type),true);viewer.hide();await viewer.prepare(type,plans[type]);
  }
  assert.equal(images.length,2);assert.ok(images.every(image=>image.decodes===1));
  assert.deepEqual([viewer.getImage('canto'),viewer.getImage('meio')],original);
  assert.ok(images.every(image=>/-en\.png\?rev=[a-f0-9]{12}$/.test(image.src)));
  assert.equal(viewer.getImage('canto').style.maskImage,`url("${plans.canto.imageMask}")`);
  assert.equal(viewer.getImage('meio').style.maskImage,`url("${plans.meio.imageMask}")`);
});

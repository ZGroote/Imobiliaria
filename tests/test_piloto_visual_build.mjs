import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { validarAssets, derivarHtml, plantaSvg, leituraPiloto, montar } from '../experimentos/piloto-qualidade-visual-2026-10-04/montar.mjs';

const hash = b => createHash('sha256').update(b).digest('hex');
async function assets(t) {
  const dir = await mkdtemp(join(tmpdir(), 'piloto-assets-'));
  t.after(() => rm(dir, {recursive:true,force:true}));
  const materials = [];
  for (const id of ['madeira','tecido','frio','parede','madeira_movel']) {
    const maps = {};
    for (const slot of ['color','normal','roughness']) {
      const data = Buffer.from(`source-${id}-${slot}`), file = `${id}-${slot}.webp`;
      await writeFile(join(dir,file),data);
      maps[slot] = {file,width:512,height:512,bytes:data.length,sha256:hash(data),sourceUrl:'https://polyhaven.com/a/fixture',sourceSha256:hash(data)};
    }
    materials.push({id,tileMeters:1,maps});
  }
  const manifest = {schema:1,materials};
  await writeFile(join(dir,'manifesto.json'),JSON.stringify(manifest));
  return {dir,manifest};
}

test('pacote de assets é conferido byte a byte e restrito aos quinze mapas do catálogo',async t => {
  const {dir} = await assets(t);
  const got = await validarAssets(dir);
  assert.equal(got.files.length,15);
  assert.ok(got.bytes > 0 && got.bytes < 3000000);
  await writeFile(join(dir,'madeira-color.webp'),'alterado');
  await assert.rejects(validarAssets(dir),/hash|bytes/i);
});

test('manifesto recusa caminho externo, normal acima do orçamento e material faltante',async t => {
  const {dir,manifest} = await assets(t);
  const store = async m => writeFile(join(dir,'manifesto.json'),JSON.stringify(m));
  const bad = structuredClone(manifest); bad.materials[0].maps.color.file='../segredo.webp';
  await store(bad); await assert.rejects(validarAssets(dir),/arquivo|caminho/i);
  const big = structuredClone(manifest); big.materials[0].maps.normal.width=1024;
  await store(big); await assert.rejects(validarAssets(dir),/dimens|resolu/i);
  await store({...manifest,materials:manifest.materials.slice(0,4)});
  await assert.rejects(validarAssets(dir),/materia/i);
  const duplicate=structuredClone(manifest);duplicate.materials[4].id='madeira';
  await store(duplicate);await assert.rejects(validarAssets(dir),/materia/i);
});

test('catálogo maior ainda recusa orçamento excedido antes de montar o site',async t=>{
  const {dir,manifest}=await assets(t),map=manifest.materials[3].maps.color;
  const payload=Buffer.alloc(3000001,17);await writeFile(join(dir,map.file),payload);
  map.bytes=payload.length;map.sha256=hash(payload);
  await writeFile(join(dir,'manifesto.json'),JSON.stringify(manifest));
  await assert.rejects(validarAssets(dir),/orçamento/i);
});

test('derivação preserva conteúdo original, identifica ponte e não aceita template desconhecido', () => {
  const base = '<html><head><title>Demo</title></head><body><script>window.__maq = {cena:cena};\n})();</script></body></html>';
  const output = derivarHtml(base,{materials:[],assetPath:'assets/abcd/',release:'abcdef'});
  assert.ok(output.includes('window.__maq = {cena:cena};'));
  assert.ok(output.includes('window.__pilotoBase'));
  assert.ok(output.includes('FURN:FURN'));
  assert.ok(output.includes('visual.js'));
  assert.ok(output.includes('PilotoVisual.start'));
  assert.equal(base.includes('PilotoVisual'),false);
  assert.throws(()=>derivarHtml('<html></html>',{}),/template/i);
});

test('planta sintética usa dois dormitórios, áreas calculadas e SVG sem referências externas', () => {
  const {leitura,area} = leituraPiloto();
  assert.equal(leitura.rooms.filter(r=>/Dormitório/.test(r.name)).length,2);
  assert.equal(leitura.rooms.length,7);
  assert.equal(leitura.openings.length,13);
  assert.equal(area,59.64);
  const svg = plantaSvg(leitura);
  assert.ok(svg.startsWith('<svg'));
  assert.match(svg,/59,64/);
  assert.match(svg,/Dormitório/);
  assert.equal(/https?:\/\//.test(svg.replace('http://www.w3.org/2000/svg','')),false);
});

async function output(t,a) {
  const parent=await mkdtemp(join(tmpdir(),'piloto-output-'));
  t.after(()=>rm(parent,{recursive:true,force:true}));
  const site=join(parent,'site');await mkdir(site);
  const checked=await validarAssets(a.dir),files={};
  await mkdir(join(site,'assets',checked.release),{recursive:true});
  for(const name of ['index.html','maquete.html','visual.js','planta.svg',...checked.files.map(f=>`assets/${checked.release}/${f}`)]){
    const data=name.startsWith('assets/')?await readFile(join(a.dir,name.split('/').at(-1))):Buffer.from('pacote anterior');
    await writeFile(join(site,name),data);files[name]={bytes:data.length,sha256:hash(data)};
  }
  await writeFile(join(site,'manifesto.json'),JSON.stringify({schema:1,kind:'piloto-qualidade-visual',files}));
  await writeFile(join(site,'creditos.json'),'{}');
  await mkdir(join(parent,'entrada'));await writeFile(join(parent,'entrada','leitura.json'),'leitura anterior');
  return {parent,site};
}

test('montagem recusa destino ocupado e extras antes de alterar entrada ou saída',async t=>{
  const a=await assets(t),o=await output(t,a);
  await assert.rejects(montar(a.dir,o.site),/ocupado/i);
  await writeFile(join(o.site,'arquivo-fora-do-pacote.txt'),'preservar');
  await assert.rejects(montar(a.dir,o.site,true),/extras/i);
  assert.equal(await readFile(join(o.site,'index.html'),'utf8'),'pacote anterior');
  assert.equal(await readFile(join(o.parent,'entrada','leitura.json'),'utf8'),'leitura anterior');
});

test('atualização recusa leitura divergente sem sobrescrevê-la',async t=>{
  const a=await assets(t),o=await output(t,a);
  await assert.rejects(montar(a.dir,o.site,true),/leitura.*mudou/i);
  assert.equal(await readFile(join(o.parent,'entrada','leitura.json'),'utf8'),'leitura anterior');
});

test('manifesto adulterado não autoriza arquivo extra no pacote',async t=>{
  const a=await assets(t),o=await output(t,a),manifestPath=join(o.site,'manifesto.json');
  const manifest=JSON.parse(await readFile(manifestPath,'utf8')),data=Buffer.from('privado');
  await writeFile(join(o.site,'privado.txt'),data);
  manifest.files['privado.txt']={bytes:data.length,sha256:hash(data)};
  await writeFile(manifestPath,JSON.stringify(manifest));
  await assert.rejects(montar(a.dir,o.site,true),/lista permitida/i);
  assert.equal(await readFile(join(o.site,'privado.txt'),'utf8'),'privado');
  assert.equal(await readFile(join(o.parent,'entrada','leitura.json'),'utf8'),'leitura anterior');
});

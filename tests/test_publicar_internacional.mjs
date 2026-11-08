import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,rm,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import {gunzipSync} from 'node:zlib';
import {TARGETS,insidePath,landingConfig,mergeInventory,prepare,publish,publicPath,sameHostingVersion} from '../conecta/internacional/publicar.mjs';

const inline='document.documentElement.classList.add("js")';
const html=lang=>`<!doctype html><html lang="${lang}"><head><script>${inline}</script><link rel="stylesheet" href="styles.css"></head><body>${lang}</body></html>`;
const oldConfig={cleanUrls:false,trailingSlashBehavior:'REMOVE',
  headers:[{glob:'/',headers:{'Content-Security-Policy':"connect-src 'none'; frame-src 'none'",'X-Custom-Preserved':'yes'}},
    {glob:'/{index,termos,privacidade,cookies}.html',headers:{'Content-Security-Policy':"connect-src 'none'"}},
    {glob:'/institucional/**',headers:{'X-Frame-Options':'DENY'}},{glob:'/b/**',headers:{'Cache-Control':'private, no-store'}}],
  redirects:[{glob:'/painel{,/}',location:'https://painel.conectaimoveis3d.com.br/login',statusCode:302}],
  rewrites:[{glob:'/liv-classico{,/**}',function:'conectaTracking',functionRegion:'southamerica-east1'}]};

test('configuração limita a nova CSP à landing e conserva regras e produtos existentes',()=>{
  const before=structuredClone(oldConfig),config=landingConfig(before,{html:html('pt-BR'),locale:'pt-BR'});
  assert.deepEqual(before,oldConfig);assert.deepEqual(config.rewrites.slice(1),before.rewrites);
  assert.deepEqual(config.rewrites[0],{glob:'/api/contact',run:{serviceId:'recebercontato',region:'southamerica-east1'}});
  assert.deepEqual(config.redirects.slice(1),before.redirects);assert.equal(config.cleanUrls,false);
  assert.equal(config.trailingSlashBehavior,before.trailingSlashBehavior);assert.deepEqual(config.i18n,{root:'/locales'});
  assert.deepEqual(config.headers.find(rule=>rule.glob==='/{termos,privacidade,cookies}.html').headers,before.headers[1].headers);
  assert.deepEqual(config.headers.find(rule=>rule.glob==='/b/**'),before.headers[3]);
  for(const path of ['/','/index.html']){
    const policy=config.headers.find(rule=>rule.glob===path).headers['Content-Security-Policy'];
    assert.match(policy,/script-src 'self' 'sha256-[^']+'/);assert.match(policy,/frame-src 'self'/);assert.match(policy,/connect-src 'self'/);
    assert.doesNotMatch(policy,/unsafe-inline|unsafe-eval/);
  }
  assert.equal(config.headers.find(rule=>rule.glob==='/region.json').headers['Cache-Control'],'private, no-store');
  assert.equal(config.headers.find(rule=>rule.glob==='/').headers['X-Custom-Preserved'],'yes');
  assert.equal(config.headers.find(rule=>rule.glob==='/locales/ALL_br/region.json').headers['Cache-Control'],'private, no-store');
  assert.throws(()=>landingConfig({i18n:{root:'/outros'}},{html:html('en'),locale:'en'}),/i18n existente/);
});

test('caminhos e inventário rejeitam travessia e preservam hashes de todos os outros produtos',()=>{
  for(const path of ['/../secrets','/demo/../login','//demo/a','/demo/%2e%2e/a','/demo\\a','/demo/a?x','/C:/x','/demo/./a'])assert.throws(()=>publicPath(path));
  assert.equal(insidePath(tmpdir(),'/demo/interior.js'),join(tmpdir(),'demo','interior.js'));
  const before={'/liv-classico/a.js':'old-liv','/laranjeiras/a.js':'old-laranjeiras','/index.html':'old-root','/painel/x':'old-panel'};
  const after=mergeInventory(before,{'/index.html':{hostingHash:'new-root'},'/demo/x.js':{hostingHash:'new-demo'}});
  assert.equal(after['/liv-classico/a.js'],'old-liv');assert.equal(after['/laranjeiras/a.js'],'old-laranjeiras');assert.equal(after['/painel/x'],'old-panel');
  assert.throws(()=>mergeInventory(before,{'/liv-classico/a.js':{hostingHash:'bad'}}),/fora da apresentação/);
});

test('versão aceita só alias e número do projeto aprovado, conservando site e ID da versão',()=>{
  const alias='projects/imobilaria-deccb/sites/imobilaria-deccb-global/versions/f8c84d8ff18c3e21';
  const numeric=alias.replace('imobilaria-deccb/','163406298617/');
  assert.equal(sameHostingVersion(alias,numeric),true);assert.equal(sameHostingVersion(numeric,alias),true);
  assert.equal(sameHostingVersion(null,null),true);assert.equal(sameHostingVersion(alias,null),false);
  assert.equal(sameHostingVersion(alias,numeric.replace('/imobilaria-deccb-global/','/outro-site/')),false);
  assert.equal(sameHostingVersion(alias,numeric.replace('f8c84d8ff18c3e21','outra-versao')),false);
  assert.equal(sameHostingVersion(alias,numeric.replace('163406298617','999999999')),false);
  assert.equal(sameHostingVersion(numeric.replace('163406298617','outro-projeto'),numeric.replace('163406298617','outro-projeto')),false);
});

test('repetir a preparação mantém uma regra por região e conserva seus cabeçalhos extras',()=>{
  const before=structuredClone(oldConfig);
  before.headers.push({glob:'/region.json',headers:{'X-Region-Extra':'keep','Cache-Control':'old'}},
    {glob:'/region.json',headers:{'X-Another-Extra':'also keep'}},
    {glob:'/locales/ALL_br/region.json',headers:{'X-Country-Extra':'keep'}});
  const first=landingConfig(before,{html:html('en'),locale:'en'}),second=landingConfig(first,{html:html('en'),locale:'en'});
  assert.deepEqual(second,first);
  for(const path of ['/region.json','/locales/ALL_br/region.json'])assert.equal(second.headers.filter(rule=>rule.glob===path).length,1);
  const headers=second.headers.find(rule=>rule.glob==='/region.json').headers;
  assert.equal(headers['Cache-Control'],'private, no-store');assert.equal(headers['X-Region-Extra'],'keep');assert.equal(headers['X-Another-Extra'],'also keep');
});

test('o contato precede os outros rewrites e recusa substituir um serviço ou redirecionamento alheio',()=>{
  const before=structuredClone(oldConfig);
  before.rewrites.push({glob:'/**',path:'/legacy.html'});
  const once=landingConfig(before,{html:html('en'),locale:'en'});
  assert.equal(once.rewrites[0].glob,'/api/contact');
  assert.deepEqual(once.rewrites.slice(1),before.rewrites);
  assert.deepEqual(landingConfig(once,{html:html('en'),locale:'en'}),once);
  const conflict=structuredClone(before);
  conflict.rewrites.unshift({glob:'/api/contact',run:{serviceId:'outro-servico',region:'southamerica-east1'}});
  assert.throws(()=>landingConfig(conflict,{html:html('en'),locale:'en'}),/outro serviço/);
  const redirect=structuredClone(before);
  redirect.redirects.push({glob:'/api/contact',location:'https://example.com/',statusCode:302});
  assert.throws(()=>landingConfig(redirect,{html:html('en'),locale:'en'}),/redirecionamento existente/);
});

async function fixture(t){
  const folder=await mkdtemp(join(tmpdir(),'conecta-internacional-'));t.after(()=>rm(folder,{recursive:true,force:true}));
  const source=join(folder,'source'),out=join(folder,'out');await mkdir(join(source,'demo'),{recursive:true});
  for(const [name,value]of Object.entries({'index.html':html('pt-BR'),'index.en.html':html('en'),'styles.css':'body{}','site.js':'// site','i18n.js':'// i18n','idiomas.js':'// idiomas','contato.js':'// contact','demo/interior.js':'// demo'}))await writeFile(join(source,name),value);
  const snapshots=new Map(TARGETS.map(target=>[target.site,{version:target.id==='br'?`projects/imobilaria-deccb/sites/${target.site}/versions/old`:null,release:null,
    config:target.id==='br'?structuredClone(oldConfig):{},files:target.id==='br'?{'/index.html':'old','/liv-classico/a.js':'preserve-me'}:{}}]));
  const calls=[],versions=new Map();let sequence=0;
  const remote={
    async snapshot(target){return structuredClone(snapshots.get(target.site));},
    async createVersion(target,config){calls.push(['create',target.site]);const name=`projects/163406298617/sites/${target.site}/versions/new-${++sequence}`;versions.set(name,{config,files:null});return name;},
    async populate(version,files){versions.get(version).files=files;return {hashes:new Set(Object.values(files).filter(hash=>hash!=='preserve-me')),uploadUrl:'https://upload.invalid'};},
    async upload(url,hash,bytes){assert.equal(url,'https://upload.invalid');assert.ok(bytes.length);calls.push(['upload',hash]);},
    async finalize(target,version){calls.push(['finalize',target.site]);},
    async release(target,version){calls.push(['release',target.site]);snapshots.set(target.site,{version:version.replace('projects/163406298617/','projects/imobilaria-deccb/'),release:'release-fixture',...versions.get(version)});return 'release-fixture';}
  };
  return {folder,source,out,remote,calls,snapshots};
}
async function unpack(out,record){return gunzipSync(await readFile(join(out,'blobs',record.hostingHash+'.gz'))).toString();}

test('preparar não publica; inglês vira raiz só do global e região é baseada somente no país',async t=>{
  const app=await fixture(t),manifest=await prepare(app);
  assert.deepEqual(app.calls,[]);assert.equal(manifest.plans.length,2);
  for(const plan of manifest.plans){
    assert.equal(await unpack(app.out,plan.inventory['/index.html']),html(plan.target.locale));
    assert.equal(plan.inventory['/index.en.html'],undefined);
    assert.deepEqual(JSON.parse(await unpack(app.out,plan.inventory['/region.json'])),{country:null,locale:'en'});
    assert.deepEqual(JSON.parse(await unpack(app.out,plan.inventory['/locales/ALL_br/region.json'])),{country:'BR',locale:'pt-BR'});
  }
  assert.equal(manifest.plans[0].files['/liv-classico/a.js'],'preserve-me');
  const published=await publish(app);assert.equal(published.length,2);
  assert.deepEqual(app.calls.filter(call=>call[0]==='release').map(call=>call[1]),['imobilaria-deccb-global','imobilaria-deccb-miniaturas']);
  assert.equal(JSON.parse(await readFile(join(app.out,'integridade.json'),'utf8')).status,'PASS');
});

test('publicar recusa corrida de versão antes de criar qualquer recurso',async t=>{
  const app=await fixture(t);await prepare(app);app.snapshots.get(TARGETS[0].site).version='sites/br/versions/concurrent';
  await assert.rejects(publish(app),/outra publicação/);assert.deepEqual(app.calls,[]);
});

test('publicar verifica o blob congelado antes de criar versões',async t=>{
  const app=await fixture(t),manifest=await prepare(app),record=manifest.plans[0].inventory['/site.js'];
  await writeFile(join(app.out,'blobs',record.hostingHash+'.gz'),'alterado');
  await assert.rejects(publish(app));assert.deepEqual(app.calls,[]);
});

test('publicar recusa alteração na configuração proposta e corrida antes do release',async t=>{
  const app=await fixture(t);await prepare(app);
  const path=join(app.out,'preflight.json'),original=await readFile(path,'utf8'),manifest=JSON.parse(original);
  manifest.plans[0].config.rewrites=[];await writeFile(path,JSON.stringify(manifest));
  await assert.rejects(publish(app),/configuração proposta mudou/);assert.deepEqual(app.calls,[]);
  await writeFile(path,original);
  const finalize=app.remote.finalize;
  app.remote.finalize=async(target,version)=>{await finalize(target,version);app.snapshots.get(TARGETS[0].site).version='sites/br/versions/concurrent';};
  await assert.rejects(publish(app),/outra publicação/);
  assert.equal(app.calls.some(call=>call[0]==='release'),false);
});

test('preparo recusa symlink dentro dos recursos públicos',async t=>{
  const app=await fixture(t);let created=false;
  await mkdir(join(app.folder,'outro'));
  try{await symlink(join(app.folder,'outro'),join(app.source,'demo','escape'),'junction');created=true;}
  catch(error){if(error.code==='EPERM')t.skip('Criação de links não permitida neste Windows');else throw error;}
  if(created)await assert.rejects(prepare(app),/simbólicos/);
});

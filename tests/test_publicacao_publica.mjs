import {test} from 'node:test'
import assert from 'node:assert/strict'
import {createServer} from 'node:http'
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {gzipSync} from 'node:zlib'
import {criarPublicacaoPublica} from '../rastreabilidade/publicacao-publica.mjs'
import {carregarPaginasPublicas} from '../rastreabilidade/functions/build.mjs'

const html='<html lang="pt-BR"><body>Maquete preparada<script src="viewer.js"></script></body></html>'
const pages={'/maquetes/liv/index.html':{propertyId:'liv-ipanema',html},
  '/b/liv-ipanema/123456abcdef/maquete.html':{propertyId:'liv-ipanema',html},
  '/liv-classico/interior.html':{propertyId:'liv-ipanema',html}}

async function gateway(run,options={}){
  const data=new Map([['properties/liv-ipanema',{agencyId:'a',status:'active',publicationReady:true}],['agencies/a',{active:true}]])
  const db={doc:path=>({get:async()=>({data:()=>data.get(path)})})}
  const gate=criarPublicacaoPublica({db,pages,log:()=>{},...options})
  const server=createServer(async(req,res)=>{if(!await gate(req,res))res.writeHead(404).end()})
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
  try{await run(`http://127.0.0.1:${server.address().port}`,data)}
  finally{await new Promise(resolve=>{server.close(resolve);server.closeAllConnections()})}
}

test('público: pausa bloqueia alias e builds, reativar devolve o mesmo HTML sem cache',async()=>{
  await gateway(async(base,data)=>{
    const urls=['/maquetes/liv/','/maquetes/liv','/maquetes/liv/index.html',
      '/b/liv-ipanema/123456abcdef/maquete.html','/liv-classico/interior.html']
    for(const url of urls){const r=await fetch(base+url+'?experiencia=original');assert.equal(r.status,200);assert.equal(await r.text(),html);assert.match(r.headers.get('cache-control'),/no-store/)}
    data.get('properties/liv-ipanema').status='inactive'
    for(const url of urls){const r=await fetch(base+url+'?status=active&propertyId=outro');assert.equal(r.status,503);assert.doesNotMatch(await r.text(),/viewer\.js/);assert.equal(r.headers.get('retry-after'),'300')}
    data.get('properties/liv-ipanema').status='active'
    assert.equal(await(await fetch(base+'/maquetes/liv/?experiencia=original')).text(),html)
    const head=await fetch(base+'/maquetes/liv/',{method:'HEAD'});assert.equal(head.status,200);assert.equal(await head.text(),'')
  })
})

test('público: imóvel/agência indisponível falha fechado e não entrega dados privados',async()=>{
  await gateway(async(base,data)=>{
    for(const change of [()=>{data.get('properties/liv-ipanema').publicationReady=false},
      ()=>{data.get('properties/liv-ipanema').status='archived'},
      ()=>{data.get('agencies/a').active=false},()=>data.delete('properties/liv-ipanema')]){
      change();const r=await fetch(base+'/maquetes/liv/');assert.equal(r.status,503);assert.doesNotMatch(await r.text(),/agencyId|liv-ipanema|viewer\.js/)
    }
    assert.equal((await fetch(base+'/maquetes/liv/',{method:'POST'})).status,405)
    assert.equal((await fetch(base+'/maquetes/liv/desconhecido.html')).status,404)
    assert.equal((await fetch(base+'/open')).status,404)
  })
})

test('pacote público: inclui todos os HTMLs do LIV e preserva a fachada e os scripts estáticos',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'publicacao-publica-'))
  try{
    for(const file of ['maquetes/liv/index.html','liv-novo/interior.html','liv-classico/mapa-runtime/index.html',
      'b/liv-ipanema/123456abcdef/tour.html','index.html','liv-classico/viewer.js']){
      await mkdir(join(dir,file,'..'),{recursive:true});await writeFile(join(dir,file),html)
    }
    const result=await carregarPaginasPublicas(dir)
    assert.deepEqual(Object.keys(result).sort(),['/b/liv-ipanema/123456abcdef/tour.html','/liv-classico/mapa-runtime/index.html','/liv-novo/interior.html','/maquetes/liv/index.html'])
    assert.ok(Object.entries(result).every(([path,p])=>p.propertyId==='liv-ipanema'&&p.source===path.slice(1)))
  }finally{await rm(dir,{recursive:true,force:true})}
})

test('público: HTML comprimido é entregue intacto; falha de leitura não vaza nem envia gzip inválido',async()=>{
  const compressedPages={'/maquetes/liv/index.html':{propertyId:'liv-ipanema',encoding:'gzip'}}
  await gateway(async base=>{
    const r=await fetch(base+'/maquetes/liv/');assert.equal(r.status,200);assert.equal(await r.text(),html)
  },{pages:compressedPages,loadPage:async()=>gzipSync(html)})
  await gateway(async base=>{
    const r=await fetch(base+'/maquetes/liv/');assert.equal(r.status,503);assert.equal(r.headers.get('content-encoding'),null)
    assert.doesNotMatch(await r.text(),/stack|segredo|viewer\.js/)
  },{pages:compressedPages,loadPage:async()=>{throw Error('segredo')}})
})

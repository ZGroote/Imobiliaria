import { readFile, writeFile, mkdir, readdir, copyFile, lstat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { resolve, dirname, basename, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { CASAS, construirCasa } from '../../tools/benchmark_10_casas.mjs';

const pasta = dirname(fileURLToPath(import.meta.url));
const raiz = resolve(pasta,'../..');
const sha256 = b => createHash('sha256').update(b).digest('hex');
const json = x => JSON.stringify(x).replaceAll('<','\\u003c');
const fmt = x => x.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});

async function inventario(dir,prefix='') {
  const entries=await readdir(dir,{withFileTypes:true}), files=[];
  for(const e of entries){const rel=prefix+e.name,full=join(dir,e.name),s=await lstat(full);
    if(s.isSymbolicLink())throw Error('Pacote não aceita links de filesystem.');
    if(s.isDirectory())files.push(...await inventario(full,rel+'/'));
    else if(s.isFile())files.push(rel);else throw Error('Arquivo não regular no pacote.');
  }
  return files.sort();
}

async function semLinks(path) {
  for(let p=resolve(path);;p=dirname(p)){
    try{if((await lstat(p)).isSymbolicLink())throw Error('Caminho não aceita links de filesystem.');}catch(e){if(e.code!=='ENOENT')throw e;}
    if(p===dirname(p))break;
  }
}

export function leituraPiloto() {
  const leitura = JSON.parse(construirCasa(CASAS[2]));
  leitura.id = 'casa-piloto-qualidade-visual';
  const area = leitura.rooms.reduce((s,r)=>s+r.widthMm*r.depthMm,0)/1000000;
  return {leitura,area};
}

export async function validarAssets(dir) {
  const manifest = JSON.parse(await readFile(join(dir,'manifesto.json'),'utf8'));
  if(manifest.schema!==1||!Array.isArray(manifest.materials)||manifest.materials.length!==3
    ||new Set(manifest.materials.map(m=>m.id)).size!==3
    ||manifest.materials.some(m=>!['madeira','tecido','frio'].includes(m.id))) throw Error('Materiais do manifesto inválidos.');
  const files = [], seen = new Set(); let bytes=0;
  for(const m of manifest.materials) {
    if(!Number.isFinite(m.tileMeters)||m.tileMeters<0.1||m.tileMeters>20) throw Error('Escala do material inválida.');
    if(!m.maps||Object.keys(m.maps).sort().join(',')!=='color,normal,roughness') throw Error('Mapas do material inválidos.');
    for(const slot of ['color','normal','roughness']) {
      const v=m.maps[slot], max=slot==='color'?1024:512;
      if(!v||typeof v.file!=='string'||!/^[-a-zA-Z0-9_]+\.webp$/.test(v.file)||basename(v.file)!==v.file||seen.has(v.file)) throw Error('Caminho de arquivo inválido ou duplicado.');
      if(!Number.isInteger(v.width)||!Number.isInteger(v.height)||Math.min(v.width,v.height)<1||Math.max(v.width,v.height)>max) throw Error('Resolução do mapa excede o limite.');
      const data=await readFile(join(dir,v.file));
      if(data.length!==v.bytes||sha256(data)!==v.sha256) throw Error(`Hash/bytes divergentes: ${v.file}`);
      seen.add(v.file);files.push(v.file);bytes+=data.length;
    }
  }
  if(bytes>1500000) throw Error('Assets excedem orçamento de 1,5 MB.');
  return {manifest,files,bytes,release:sha256(json(manifest)).slice(0,16)};
}

export function plantaSvg(leitura) {
  const rooms=leitura.rooms, w=Math.max(...rooms.map(r=>r.xMm+r.widthMm))/1000,
    h=Math.max(...rooms.map(r=>r.yMm+r.depthMm))/1000, area=rooms.reduce((a,r)=>a+r.widthMm*r.depthMm,0)/1e6;
  const esc=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
  let shapes='';
  for(const r of rooms) {
    const x=r.xMm/1000,y=r.yMm/1000,rw=r.widthMm/1000,rh=r.depthMm/1000;
    shapes+=`<rect x="${x}" y="${y}" width="${rw}" height="${rh}" fill="${/Cozinha|Serviço|Banheiro/.test(r.name)?'#e2ddd3':'#ded0b8'}" stroke="#555850" stroke-width=".07"/>`;
    const name=r.name.replace('Sala Estar e Jantar','Sala / jantar').replace('Dormitório 1 Casal','Dormitório casal').replace('Dormitório 2 Solteiro','Dormitório solteiro').replace('Banheiro Social','Banheiro');
    const lines=name.split(' '); const mid=Math.ceil(lines.length/2);
    shapes+=`<text x="${x+rw/2}" y="${y+rh/2-.14}" text-anchor="middle" font-size=".17" fill="#333b34" font-family="Arial,sans-serif"><tspan x="${x+rw/2}">${esc(lines.slice(0,mid).join(' '))}</tspan><tspan x="${x+rw/2}" dy=".23">${esc(lines.slice(mid).join(' '))}</tspan><tspan x="${x+rw/2}" dy=".3" font-size=".15">${fmt(rw*rh)} m²</tspan></text>`;
  }
  // Vãos usam a convenção do normalizador: south/north partem de x, east/west de y.
  for(const op of leitura.openings) {
    const r=rooms.find(r=>Object.values(r.walls).includes(op.wallId));
    if(!r) throw Error('Vão sem parede.');
    const side=Object.entries(r.walls).find(([,v])=>v===op.wallId)[0];
    const x=r.xMm/1000,y=r.yMm/1000,off=op.offsetMm/1000,len=op.widthMm/1000;
    const hor=side==='north'||side==='south',xx=hor?x+off:x+(side==='east'?r.widthMm/1000:0), yy=hor?y+(side==='north'?r.depthMm/1000:0):y+off;
    shapes+=`<path d="M${xx},${yy} ${hor?'h':'v'}${len}" stroke="${op.kind==='window'?'#739da2':'#f9f6ef'}" stroke-width=".1"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-.4 -.55 ${w+.8} ${h+1.1}" role="img" aria-labelledby="titulo"><title id="titulo">Planta demonstrativa · ${fmt(area)} m²</title><rect x="-.4" y="-.55" width="${w+.8}" height="${h+1.1}" fill="#f9f6ef"/>${shapes}<text x="${w/2}" y="${h+.35}" text-anchor="middle" font-size=".15" font-family="Arial,sans-serif" fill="#58645a">PLANTA SINTÉTICA · ${fmt(area)} m² · sem escala de impressão</text></svg>`;
}

export function derivarHtml(base,{materials=[],assetPath='assets/',release=''}) {
  const marker='window.__maq =';
  if(base.split(marker).length!==2||!base.includes('</body>')||!base.includes('</head>')) throw Error('Template de maquete desconhecido.');
  const bridge='window.__pilotoBase = {MAT:MAT,matMovel:matMovel,ambientePBR:ambientePBR,PL_R:PL_R};\n';
  const contrast='<style>html.pilot-embed #p2d text{fill:#354438}html.pilot-embed #p2d path{stroke:#687064}html.pilot-embed #p2d line:not([stroke="#6FC6F5"]){stroke:#555850}html.pilot-embed #ferramentas button[aria-pressed=true]{color:#354438;border-color:#7c9975;background:#d3e4cb}</style>';
  const css='<style id="piloto-apresentacao">html.pilot-embed,html.pilot-embed body{margin:0;padding:0;width:100%;height:100%;background:#eeeae2}html.pilot-embed .folha{display:block;grid-template-columns:none;max-width:none;margin:0;width:100%}html.pilot-embed #ficha{display:none}html.pilot-embed #cena{height:100dvh;max-height:none;min-height:0;width:100%;border:0;border-radius:0;background:#eeeae2}html.pilot-embed #cena::before{display:none}html.pilot-embed #andar-tag{display:none}</style><script>if(new URL(location.href).searchParams.get("embed")==="1")document.documentElement.classList.add("pilot-embed");</script>';
  const start=`<script src="visual.js"></script><script>window.__pilotoRelease=${json(release)};if(__maq.modo()==='planta3d'&&__maq.planta()){var b=new THREE.Box3().setFromObject(__maq.planta()),s=b.getSize(new THREE.Vector3()),half=__maq.cam.fov*Math.PI/360,fit=Math.min(half,Math.atan(Math.tan(half)*__maq.cam.aspect));__maq.alvo.copy(b.getCenter(new THREE.Vector3()));__maq.orb.r=s.length()/2/Math.sin(fit)*1.06;__maq.poeCam();}PilotoVisual.start({THREE:THREE,maq:__maq,base:__pilotoBase,assets:${json(materials)},assetPath:${json(assetPath)},enabled:new URL(location.href).searchParams.get('acabamento')!=='base'});</script><script src="metricas.js"></script>`;
  return base.replace(marker,bridge+marker).replace('</head>',css+contrast+'</head>').replace('</body>',start+'</body>');
}

function python(args) {
  const res=spawnSync('python',args,{cwd:raiz,encoding:'utf8',env:{...process.env,PYTHONUTF8:'1',PYTHONIOENCODING:'utf-8'},timeout:120000,maxBuffer:8*1024*1024});
  if(res.status!==0) throw Error(`Geração recusada: ${(res.stderr||res.stdout||String(res.error)).slice(-3000)}`);
  return res.stdout;
}

export async function montar(assetsDir,destino,atualizar=false) {
  assetsDir=resolve(assetsDir);destino=resolve(destino);
  const parent=dirname(destino), baseDir=join(parent,'base'), entrada=join(parent,'entrada');
  await Promise.all([semLinks(assetsDir),semLinks(destino),semLinks(baseDir),semLinks(entrada)]);
  const checked=await validarAssets(assetsDir);
  let present=[];try{if((await lstat(destino)).isSymbolicLink())throw Error('Destino não aceita links de filesystem.');present=await readdir(destino);}catch(e){if(e.code!=='ENOENT')throw e;}
  if(present.length) {
    if(!atualizar) throw Error('Destino ocupado. Use outro destino; --atualizar somente para este piloto.');
    const prior=JSON.parse(await readFile(join(destino,'manifesto.json'),'utf8'));
    if(prior.kind!=='piloto-qualidade-visual'||prior.schema!==1) throw Error('Destino não pertence ao piloto.');
    const allowed=['index.html','maquete.html','visual.js','planta.svg',...(prior.files['metricas.js']?['metricas.js']:[]),...checked.files.map(f=>`assets/${checked.release}/${f}`)].sort();
    if(JSON.stringify(Object.keys(prior.files).sort())!==JSON.stringify(allowed))throw Error('Manifesto anterior não corresponde à lista permitida.');
    const expected=[...allowed,'manifesto.json','creditos.json'].sort();
    if(JSON.stringify(await inventario(destino))!==JSON.stringify(expected))throw Error('Destino contém arquivos extras; preserve-o e escolha uma pasta nova.');
    const priorAssetPaths=Object.keys(prior.files).filter(n=>n.startsWith('assets/'));
    if(priorAssetPaths.some(n=>!n.startsWith(`assets/${checked.release}/`)))throw Error('Mudança de assets exige uma nova pasta de publicação.');
    for(const [file,info] of Object.entries(prior.files)) {const data=await readFile(join(destino,file));if(data.length!==info.bytes||sha256(data)!==info.sha256)throw Error('Pacote anterior foi alterado; atualização recusada.');}
  }
  if(!atualizar){for(const path of [baseDir,entrada]){try{if((await readdir(path)).length)throw Error('Entrada/base já ocupada; escolha uma nova pasta.');}catch(e){if(e.code!=='ENOENT')throw e;}}}
  await mkdir(parent,{recursive:true});
  const {leitura,area}=leituraPiloto();
  await mkdir(entrada,{recursive:true});
  const leituraPath=join(entrada,'leitura.json');
  const leituraBytes=JSON.stringify(leitura,null,2)+'\n';
  if(atualizar){
    const priorReading=await readFile(leituraPath,'utf8');
    if(priorReading!==leituraBytes)throw Error('Leitura do piloto mudou; gere uma nova pasta.');
    const report=JSON.parse(await readFile(join(baseDir,'relatorio.json'),'utf8'));
    const contentHash=python(['-c','import json,sys,hashlib; from pipeline.normalizar_planta import serializar; print(hashlib.sha256(serializar(json.load(open(sys.argv[1],encoding="utf-8")))).hexdigest())',leituraPath]).trim();
    if(contentHash!==report.entrada.contentSha256)throw Error('Leitura não corresponde ao E2E preservado.');
  }else await writeFile(leituraPath,leituraBytes);
  let baseHtml,rel;
  if(!atualizar) {
    const mob=JSON.parse(python(['-c','import json,sys; import pipeline.mobiliar as m; import pipeline.normalizar_planta as n; p=n.normalizar(json.load(open(sys.argv[1],encoding="utf-8"))); ms,rel,errs,ap=m.mobilia({"planta":p["planta"]}); print(json.dumps({"moveis":ms,"erros":errs,"apertos":ap}))',leituraPath]));
    if(mob.erros.length) throw Error('Composição de móveis recusada.');
    const dim=13,context={schema:1,propertyId:leitura.id,agencyId:'demo-visual',andar:0,
      ficha:{titulo:`Casa piloto · ${fmt(area)} m² · 2 dormitórios`,empreendimento:'Planta sintética de acabamento'},
      cores:{parede:'#ECE6DC',piso_frio:'#D3CEC3',piso_madeira:'#B89B73',teto:'#F4F1E9'},
      lote:{predio:{largura_m:dim,profundidade_m:dim,pavimentos:1}},moveis:mob.moveis};
    const contextPath=join(entrada,'contexto.json');await writeFile(contextPath,JSON.stringify(context,null,2)+'\n');
    await writeFile(join(entrada,'mobilia.json'),JSON.stringify(mob,null,2)+'\n');
    python(['-m','pipeline.gerar_maquete',leituraPath,'--contexto',contextPath,'--destino',baseDir]);
  }
  baseHtml=await readFile(join(baseDir,'maquete.html'),'utf8');rel=JSON.parse(await readFile(join(baseDir,'relatorio.json'),'utf8'));
  if(sha256(baseHtml)!==rel.artefato.sha256||Buffer.byteLength(baseHtml)!==rel.artefato.bytes) throw Error('Maquete base diverge do E2E.');
  const visual=await readFile(join(pasta,'visual.js')), index=await readFile(join(pasta,'index.html')),metricas=await readFile(join(pasta,'metricas.js'));
  const builder=await readFile(fileURLToPath(import.meta.url));
  const release=sha256(Buffer.concat([builder,Buffer.from(baseHtml),visual,index,metricas,Buffer.from(json(checked.manifest))])).slice(0,16);
  const assetPath=`assets/${checked.release}/`, html=derivarHtml(baseHtml,{materials:checked.manifest.materials,assetPath,release});
  await mkdir(join(destino,assetPath),{recursive:true});
  for(const name of checked.files) await copyFile(join(assetsDir,name),join(destino,assetPath,name));
  const contents={'maquete.html':html,'visual.js':visual,'metricas.js':metricas,'index.html':index,'planta.svg':plantaSvg(leitura)};
  for(const [name,data] of Object.entries(contents)) await writeFile(join(destino,name),data);
  const files={};for(const name of [...Object.keys(contents),...checked.files.map(n=>assetPath+n)]) {const data=await readFile(join(destino,name));files[name]={bytes:data.length,sha256:sha256(data)};}
  const credits={license:'CC0-1.0',licenseUrl:'https://polyhaven.com/license',materials:checked.manifest.materials};
  await writeFile(join(destino,'creditos.json'),JSON.stringify(credits,null,2)+'\n');
  const manifest={schema:1,kind:'piloto-qualidade-visual',release,property:'Planta sintética',areaM2:area,rooms:leitura.rooms.length,openings:leitura.openings.length,
    base:{sha256:rel.artefato.sha256,bytes:rel.artefato.bytes},assetsBytes:checked.bytes,files,physicalMobileValidated:false};
  await writeFile(join(destino,'manifesto.json'),JSON.stringify(manifest,null,2)+'\n');
  if(JSON.stringify(await inventario(destino))!==JSON.stringify([...Object.keys(files),'creditos.json','manifesto.json'].sort()))throw Error('Inventário final diverge da lista permitida.');
  await copyFile(join(pasta,'firebase.preview.json'),join(parent,'firebase.preview.json'));
  return manifest;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) {
  const {values}=parseArgs({options:{assets:{type:'string'},destino:{type:'string'},atualizar:{type:'boolean',default:false}}});
  if(!values.assets||!values.destino) throw Error('Use --assets CAMINHO --destino CAMINHO.');
  const m=await montar(values.assets,values.destino,values.atualizar);
  console.log(JSON.stringify({release:m.release,areaM2:m.areaM2,rooms:m.rooms,openings:m.openings,assetsBytes:m.assetsBytes,files:Object.keys(m.files).length},null,2));
}

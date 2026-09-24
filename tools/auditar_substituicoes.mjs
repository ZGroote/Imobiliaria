import fs from 'node:fs';import vm from 'node:vm';
for(const file of ['core/geometry.js','core/city-data.js','world/building-type.js'])
  vm.runInThisContext(fs.readFileSync('v1.5/renderizador-v16-moveis/'+file,'utf8'));
const {shoelace,safeInset,obbOf}=MapGeometry;
const {ST,tipoDe,BUILDING_INSET}=BuildingType;
const config=JSON.parse(fs.readFileSync('padrao/cidades/sao-carlos.json','utf8'));
const decode=CityData.createDecoder(config.quantizacao,shoelace);
vm.runInThisContext(fs.readFileSync('v1.5/renderizador-v16-moveis/urban-models.js','utf8'));
const html=fs.readFileSync('v16-moveis/sao-carlos-v16-moveis-aberto.html','utf8');const read=id=>JSON.parse(html.match(new RegExp('id="'+id+'">([\\s\\S]*?)</script>'))[1]);const {B}=decode(read('__citydata')),pack=read('__urbanModels'),stats={total:B.length,eligible:0,new:0,old:0,irregular:0,lot:0},samples=[];
for(const b of B){const generated=shoelace(b.r)>0,ring=safeInset(generated?b.r.slice().reverse():b.r,generated?.25:BUILDING_INSET),ob=obbOf(ring,Math.abs(shoelace(ring))/2),st=tipoDe(b.c,b.h,b.area,ob),cat=st===ST.CASA?'casas':st===ST.SOBRADO?'sobrados':null;if(!cat)continue;stats.eligible++;const chosen=UrbanModels.select(pack.assets,b,ob,ring,cat);if(chosen){stats.new++;if(chosen.lotFit)stats.lot++;}else{stats.old++;if(ob.rect<.9)stats.irregular++;if(samples.length<12)samples.push({width:2*ob.hv,depth:2*ob.hu,h:b.h,area:b.area,rect:ob.rect,fa:b.fa});}}
console.log(JSON.stringify({stats,samples}));fs.writeFileSync('relatorios/casas-depois-assentamento.json',JSON.stringify({stats,samples},null,2));

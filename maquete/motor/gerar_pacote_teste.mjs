// Gera o pacote de teste do motor (MG-2): a cena de um volume simples de 12 × 6 × 8 m sobre um chão, a
// luz pré-calculada de 64 × 64, o manifesto que o renderizador confere e o cadastro do pavimento piloto.
// Sai igual em toda rodada e em todo sistema: o gzip não leva data e o byte do sistema vai como
// "desconhecido", senão o Windows e o Linux dariam arquivos diferentes.
//
//   node maquete/motor/gerar_pacote_teste.mjs [pasta]      (padrão: maquete/motor/dados)
import {createHash} from 'node:crypto';
import {mkdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {gzipSync} from 'node:zlib';

const sha=b=>createHash('sha256').update(b).digest('hex');
const gz=b=>{const z=gzipSync(b,{level:9});z[9]=0xff;return z;};
const attribute=(type,array,itemSize)=>({type,base64:Buffer.from(array.buffer).toString('base64'),length:array.length,itemSize,normalized:false});
const W=12,H=6,D=8,CHAO=20,ATLAS=64;
// A luz pré-calculada é uma grade de 4 × 2 células: as 6 faces do volume e o chão, cada um na sua.
const CELULAS={'+x':0,'-x':1,'+y':2,'-y':3,'+z':4,'-z':5,chao:6};
const celula=(nome,u,v)=>{const c=CELULAS[nome],x=c%4,y=Math.floor(c/4),m=.06;return [(x+m+u*(1-2*m))/4,(y+m+v*(1-2*m))/2];};

// Uma caixa: 4 vértices por face, com a UV da textura e a UV1 da luz pré-calculada.
function caixa(min,max,comLuz){
  const pos=[],nor=[],uv=[],uv1=[],idx=[];
  const faces=[
    ['+x',[1,0,0],[[max[0],min[1],max[2]],[max[0],min[1],min[2]],[max[0],max[1],min[2]],[max[0],max[1],max[2]]]],
    ['-x',[-1,0,0],[[min[0],min[1],min[2]],[min[0],min[1],max[2]],[min[0],max[1],max[2]],[min[0],max[1],min[2]]]],
    ['+y',[0,1,0],[[min[0],max[1],max[2]],[max[0],max[1],max[2]],[max[0],max[1],min[2]],[min[0],max[1],min[2]]]],
    ['-y',[0,-1,0],[[min[0],min[1],min[2]],[max[0],min[1],min[2]],[max[0],min[1],max[2]],[min[0],min[1],max[2]]]],
    ['+z',[0,0,1],[[min[0],min[1],max[2]],[max[0],min[1],max[2]],[max[0],max[1],max[2]],[min[0],max[1],max[2]]]],
    ['-z',[0,0,-1],[[max[0],min[1],min[2]],[min[0],min[1],min[2]],[min[0],max[1],min[2]],[max[0],max[1],min[2]]]],
  ];
  const cantos=[[0,0],[1,0],[1,1],[0,1]];
  for(const [nome,normal,vertices] of faces){
    const base=pos.length/3;
    vertices.forEach((p,i)=>{pos.push(...p);nor.push(...normal);uv.push(...cantos[i]);uv1.push(...celula(nome,...cantos[i]));});
    idx.push(base,base+1,base+2,base,base+2,base+3);
  }
  const attributes={position:attribute('Float32Array',new Float32Array(pos),3),normal:attribute('Float32Array',new Float32Array(nor),3),
    uv:attribute('Float32Array',new Float32Array(uv),2)};
  if(comLuz)attributes.uv1=attribute('Float32Array',new Float32Array(uv1),2);
  return {attributes,index:attribute('Uint16Array',new Uint16Array(idx),1),groups:[],drawRange:{start:0,count:null}};
}

function chao(){
  const pos=[-CHAO,0,CHAO, CHAO,0,CHAO, CHAO,0,-CHAO, -CHAO,0,-CHAO],nor=[0,1,0,0,1,0,0,1,0,0,1,0];
  const cantos=[[0,0],[1,0],[1,1],[0,1]];
  return {attributes:{position:attribute('Float32Array',new Float32Array(pos),3),normal:attribute('Float32Array',new Float32Array(nor),3),
    uv:attribute('Float32Array',new Float32Array(cantos.flat()),2),uv1:attribute('Float32Array',new Float32Array(cantos.flatMap(([u,v])=>celula('chao',u,v))),2)},
    index:attribute('Uint16Array',new Uint16Array([0,1,2,0,2,3]),1),groups:[],drawRange:{start:0,count:null}};
}

// A luz de cada célula: o topo claro, as faces mais claras em cima, o chão escurecendo perto do volume.
function luz(){
  const rgba=new Uint8Array(ATLAS*ATLAS*4);
  for(let j=0;j<ATLAS;j++)for(let i=0;i<ATLAS;i++){
    const x=Math.min(3,Math.floor(i/(ATLAS/4))),y=Math.min(1,Math.floor(j/(ATLAS/2))),c=y*4+x;
    const u=(i%(ATLAS/4))/(ATLAS/4-1),v=(j%(ATLAS/2))/(ATLAS/2-1);
    let valor={0:.75+.35*v,1:.55+.3*v,2:1.25,3:.25,4:.85+.35*v,5:.5+.3*v,6:.6+.45*Math.min(1,Math.hypot(u-.5,v-.5)*2.2)}[c]??.0;
    // RGBM, faixa 16: cor × alfa × 16. O alfa é o menor que cabe; a cor puxa um pouco para o quente.
    const a=Math.max(1,Math.ceil(valor/16*255)),escala=a/255*16,o=(j*ATLAS+i)*4;
    rgba[o]=Math.min(255,Math.round(valor*1.02/escala*255));rgba[o+1]=Math.min(255,Math.round(valor/escala*255));
    rgba[o+2]=Math.min(255,Math.round(valor*.95/escala*255));rgba[o+3]=a;
  }
  return rgba;
}

function vista(r,th,ph,alvo){
  return {type:'PerspectiveCamera',fov:34,near:.2,far:900,zoom:1,aspect:1.8461538461538463,
    position:[alvo[0]+r*Math.sin(th)*Math.sin(ph),alvo[1]+r*Math.cos(ph),alvo[2]+r*Math.cos(th)*Math.sin(ph)],target:alvo,orbit:{r,th,ph}};
}

export function gerar(pasta){
  const modelo=sha(JSON.stringify({pacote:'volume-de-teste',versao:1,W,H,D,CHAO,ATLAS}));
  const atlas=luz(),atlasGz=gz(atlas);
  const cena={
    schema:'liv-exterior-proof-v1',sourceModelSHA256:modelo,
    geometries:[caixa([-W/2,0,-D/2],[W/2,H,D/2],true),chao(),caixa([-W/2-.05,2.9,-D/2-.05],[W/2+.05,3.1,D/2+.05],false)],
    materials:[
      {name:'Teste — paredes',type:'MeshStandardMaterial',baked:true,color:[.82,.79,.74],roughness:.9,metalness:0},
      {name:'Teste — chão',type:'MeshStandardMaterial',baked:true,color:[.46,.5,.43],roughness:1,metalness:0},
      {name:'Teste — faixa',type:'MeshStandardMaterial',baked:false,color:[.08,.1,.11],roughness:.25,metalness:0},
    ],
    textures:[],
    meshes:[
      {name:'Teste / volume',geometry:0,material:0,matrix:[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],castShadow:true,receiveShadow:true,renderOrder:0,userData:{tower:0}},
      {name:'Teste / chão',geometry:1,material:1,matrix:[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],castShadow:false,receiveShadow:true,renderOrder:0,userData:{tower:-1}},
      {name:'Teste / faixa',geometry:2,material:2,matrix:[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],castShadow:true,receiveShadow:true,renderOrder:0,userData:{tower:0}},
    ],
    lights:[
      {type:'DirectionalLight',color:[1,.89,.72],groundColor:null,intensity:2.4,position:[-18,40,25],target:[0,3,0],castShadow:true,
        shadow:{bias:-.0004,normalBias:.02,mapSize:[1024,1024],camera:{left:-25,right:25,top:25,bottom:-25,near:1,far:120}}},
      {type:'HemisphereLight',color:[.82,.87,.94],groundColor:[.03,.035,.04],intensity:.85,position:[0,50,0],castShadow:false},
    ],
    visibleBounds:{min:[-CHAO,0,-CHAO],max:[CHAO,H,CHAO]},
    renderer:{exposure:1,toneMapping:4,pixelRatio:1},
    views:{perspectiva:vista(46,.7,1.12,[0,2.5,0]),aerea:vista(60,.35,.55,[0,0,0])},
    rgbm:{schema:'liv-lightmap-v1',sourceSHA256:modelo,textureURL:'irradiance.rgbm.gz',textureCompression:'gzip',
      textureEncoding:'linear-rgbm-u8',textureSHA256:sha(atlas),width:ATLAS,height:ATLAS,range:16,origin:'bottom-left',
      premultiplyAlpha:false,lightMapIntensity:Math.PI},
  };
  const json=Buffer.from(JSON.stringify(cena)),cenaGz=gz(json);
  const manifesto={schema:'liv-proof-manifest-v1',origem:'maquete/motor/gerar_pacote_teste.mjs',sourceModelSHA256:modelo,
    sceneJSONSHA256:sha(json),files:{'irradiance.rgbm.gz':{bytes:atlasGz.length,sha256:sha(atlasGz)},'scene.json.gz':{bytes:cenaGz.length,sha256:sha(cenaGz)}},
    meshCount:cena.meshes.length,bakedMeshes:cena.meshes.filter(m=>cena.materials[m.material].baked).length};
  const unidade=(final,side,z)=>({id:`teste/pavimento-01/final-${final}`,final,side,positionConfidence:'inferido',
    bounds:{min:[-W/2,3,z[0]],max:[W/2,6,z[1]]},typology:null,plan2d:null,mirroring:null,areaM2:null,commercialNumber:null,
    availability:'nao_informada',price:null,parking:null});
  const unidades={schema:'liv-pilot-units-v1',floorIndex:1,sourceModelSHA256:modelo,registration:{confidence:'inferido'},
    source:{label:'Pacote de teste do motor',bookSHA256:sha('volume-de-teste')},
    units:[unidade('01','fundos',[-D/2,-.1]),unidade('02','frente',[.1,D/2])]};
  mkdirSync(join(pasta,'exterior'),{recursive:true});
  const saida={'exterior/irradiance.rgbm.gz':atlasGz,'exterior/scene.json.gz':cenaGz,
    'exterior/manifest.json':Buffer.from(JSON.stringify(manifesto,null,2)+'\n'),'unidades.json':Buffer.from(JSON.stringify(unidades,null,2)+'\n')};
  for(const [nome,bytes] of Object.entries(saida))writeFileSync(join(pasta,nome),bytes);
  return Object.fromEntries(Object.entries(saida).map(([nome,bytes])=>[nome,sha(bytes)]));
}

if(process.argv[1]===fileURLToPath(import.meta.url)){
  console.log(JSON.stringify(gerar(process.argv[2]??fileURLToPath(new URL('./dados/',import.meta.url)))));
}

// Individually authored exterior studies, based on the listing photographs.
// Unphotographed elevations and uncoted depths remain estimates, not surveys.
import fs from 'node:fs';import vm from 'node:vm';
import {Document,NodeIO} from '@gltf-transform/core';
import {fileURLToPath} from 'node:url';
vm.runInThisContext(fs.readFileSync(new URL('../renderizador-v16-moveis/lib/three.min.js',import.meta.url),'utf8'));
const T=globalThis.THREE,assets=[],b64=a=>Buffer.from(a.buffer).toString('base64');
const houses=JSON.parse(fs.readFileSync(new URL('../sao-carlos/dados/imoveis.json',import.meta.url)));
for(const id of [57881,89981,86834,85452,87313,89963]){
  const P=[],N=[],C=[],indices=[],parts=[];
  function geometry(name,g,color){
    if(g.index){const original=g;g=g.toNonIndexed();original.dispose();}g.computeVertexNormals();const p=g.attributes.position,n=g.attributes.normal,c=new T.Color('#'+color),start=P.length/3;
    for(let i=0;i<p.count;i++){P.push(p.getX(i),p.getY(i),p.getZ(i));N.push(n.getX(i),n.getY(i),n.getZ(i));C.push(c.r,c.g,c.b);indices.push(start+i);}
    parts.push({name,first:start,count:p.count});g.dispose();
  }
  const box=(name,x,y,z,w,h,d,c)=>geometry(name,new T.BoxGeometry(w,h,d).translate(x,y,z),c);
  const face=(name,pts,c)=>{const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pts.flat(),3));geometry(name,g,c);};
  function roof(x,z,w,d,h,rise,color='9c6145',end='ded2b3'){
    const a=[x-w/2,h,z+d/2],b=[x,h+rise,z+d/2],c=[x+w/2,h,z+d/2],aa=[a[0],h,z-d/2],bb=[x,h+rise,z-d/2],cc=[c[0],h,z-d/2];
    face('agua esquerda',[a,b,aa,b,bb,aa],color);face('agua direita',[b,c,bb,c,cc,bb],color);
    face('empena frontal',[a,c,b],end);face('empena posterior',[cc,aa,bb],end);
    // Tile courses retain real spacing instead of stretching a roof texture.
    for(let j=0;j<=Math.floor(d/.32);j++){
      const zz=z-d/2+j*.32;
      for(const sg of [-1,1]){
        const g=new T.BoxGeometry(Math.hypot(w/2,rise),.035,.045);
        g.rotateZ(-sg*Math.atan2(rise,w/2)).translate(x+sg*w/4,h+rise/2+.022,zz);geometry('fiada de telha',g,'b17a58');
      }
    }
    box('cumeeira',x,h+rise+.03,z,.14,.1,d+.1,'80503b');
  }
  function gate(x,z,w,h,color='d4d6cf',horizontal=false,y=0){
    box('trilho inferior',x,y+.07,z,w,.10,.07,color);box('trilho superior',x,y+h-.07,z,w,.10,.07,color);
    for(const xx of [x-w/2,x,x+w/2])box('montante',xx,y+h/2,z,.065,h,.08,color);
    if(horizontal)for(let yy=.15;yy<h-.1;yy+=.095)box('lamina horizontal',x,y+yy,z,w,.035,.06,color);
    else for(let xx=x-w/2+.13;xx<x+w/2;xx+=.13)box('barra vertical',xx,y+h/2,z,.035,h-.12,.04,color);
  }
  function window(x,y,z,w=1.2,h=1.25,color='d9dad2'){
    box('caixilho',x,y,z,w+.12,h+.12,.07,color);box('vidro escuro',x,y,z+.045,w,h,.035,'39494b');
    box('montante janela',x,y,z+.07,.045,h,.04,color);box('travessa janela',x,y,z+.07,w,.045,.04,color);
    box('peitoril',x,y-h/2-.08,z+.04,w+.24,.09,.2,'b8b8ac');
  }
  let note='Fachada observada nas fotos do anúncio. Largura, profundidade e fachadas não fotografadas estimadas; sem planta interna validada.';
  if([57881,89981,86834].includes(id)){
    const w=id===86834?6:5,d=id===57881?26:id===89981?25:22,color=id===57881?'aebd74':id===89981?'d2c6ac':'c3d1cc';
    box('piso garagem',0,.06,5,w,.12,5.3,'bcb8a7');
    box('corpo residencial',0,1.45,-4.7,w,2.9,14,color);
    for(const sg of [-1,1])box('parede lateral garagem',sg*(w/2-.10),1.5,5,.2,3,5.5,color);
    box('verga fachada',0,2.8,7.7,w,.55,.23,color);
    box('pilar esquerdo fachada',-w/2+.15,1.25,7.7,.3,2.5,.25,color);
    box('pilar direito fachada',w/2-.15,1.25,7.7,.3,2.5,.25,color);
    gate(0,7.85,w-.6,2.5,'cfd0c8',id===89981);
    window(w*.20,1.65,2.36,1.25,1.1,id===89981?'edece4':'b7b9af');
    box('porta de entrada',-w*.27,1.05,2.37,.85,2.1,.08,id===89981?'684c38':'404a3b');
    if(id===89981)roof(0,0,w+.1,16,3,1.05,'915431',color);
    else{box('laje garagem',0,3.05,5,w+.14,.16,5.6,color);roof(0,-2,w+.05,14,3.05,.45,'777860',color);}
    box('terreno',0,-.08,0,w,.16,d,'9b9c83');
  }else if(id===85452){
    box('sobrado geminado',0,3,0,5,6,10,'ad6250');box('faixa superior ocre',0,5.6,5.03,5,.8,.1,'bca47d');
    roof(0,0,5.3,10.4,6,.65,'76563e','bca47d');
    box('sacada laje',.8,3.05,5.7,2.4,.2,1.5,'a36050');gate(.8,6.42,2.4,1,'333d38',false,3.15);
    for(const x of [-.4,2]){box('retorno sacada',x,3.65,5.7,.045,1,1.45,'333d38');}
    window(.8,4.5,5.05,1.7,2,'e1dfce');window(-1.35,1.7,5.05,1.05,1.65,'e1dfce');
    box('porta envidracada',.65,1.15,5.06,1.25,2.3,.09,'ebeadb');window(.65,1.25,5.13,1.08,1.96);
    box('mureta',0,.5,7.4,5,1,.2,'9a5548');gate(0,7.4,4.8,1.05,'333c36',false,1);
    box('piso frontal',0,-.05,0,5.2,.1,15,'8d9380');
  }else if(id===87313){
    note='Terreno de 10 × 50 m informado no anúncio. Fachada azul-clara, grades e janelas arqueadas observadas. Posição da piscina/edícula e profundidade do corpo principal são estimadas.';
    box('terreno 10x50',0,-.08,-12,10,.16,50,'88966e');box('corpo principal',-1,1.6,1,7.4,3.2,18,'afced0');
    box('platibanda frontal',-1,3.38,10,7.5,.35,.2,'adcfd0');box('friso branco',-1,3.25,10.1,7.6,.12,.12,'dde2d7');
    roof(-1,1,7.5,18,3.35,.85,'9f6447','afced0');
    for(const x of [-3.2,-1]){
      window(x,1.55,10.1,1.1,1.65,'d7d8c5');
      const arch=new T.Shape();arch.moveTo(-.54,0);arch.lineTo(.54,0);arch.absarc(0,0,.54,0,Math.PI,false);arch.closePath();
      geometry('vidro em arco',new T.ShapeGeometry(arch,20).translate(x,2.38,10.15),'39494b');
      geometry('arco da janela',new T.TorusGeometry(.6,.055,5,18,Math.PI).translate(x,2.38,10.18),'d7d8c5');
    }
    box('garagem lateral cobertura',3.1,3.05,6.4,3.2,.22,7.2,'bed7d4');box('pilar garagem',4.65,1.5,9.9,.3,3,.32,'adcfd0');
    box('calcamento frontal',0,.01,11.3,10,.08,2.6,'b4b3a0');gate(0,12.6,9.6,2.35,'e1e1d7');
    box('deck piscina estimado',0,.07,-16,7,.14,10,'b4ae91');box('borda piscina',0,.15,-16,4.3,.20,7.3,'d4d1ba');box('agua piscina',0,.27,-16,3.85,.035,6.85,'64aec3');
    box('edicula estimada',0,1.35,-32,8,2.7,7,'aec9c5');roof(0,-32,8.2,7.2,2.75,.75);window(-2,1.6,-28.4);window(2,1.6,-28.4);
  }else{
    note='Composição em L, madeira, telhas, varanda, piscina e muro observados nas cinco fotos arquivadas. Dimensões e fundos estimados a partir da área do anúncio; ônibus omitido por ser objeto móvel.';
    box('quintal',0,-.06,0,14,.12,21,'7a8d59');box('ala esquerda',-4.4,3,-1,4.7,6,11,'dfd3b8');box('ala posterior',1,3,-5.5,6.2,6,5,'dfd3b8');
    roof(-4.4,-1,5.2,11.5,6,1.0);roof(1,-5.5,6.7,5.5,6,.9);
    box('volume reservatorio',-1.8,6.65,-4,2,1.1,2,'d7d0b6');
    box('varanda inferior',-.1,2.95,-1.8,8.3,.18,2.8,'9b6541');
    for(const x of [-3.8,-.2,3.6])box('coluna da varanda',x,1.45,-.5,.23,2.9,.23,'e0d8bf');
    box('sacada madeira',-4.4,3.15,5.4,4.5,.2,1.4,'8d6548');gate(-4.4,6.1,4.5,1,'785239',false,3.25);
    for(const x of [-6.55,-2.25])box('pilar madeira',x,4.6,5.7,.17,3,.17,'765136');
    box('porta sacada',-4.4,4.3,4.56,1.1,2.1,.1,'674730');window(-.6,4.6,-2.96,1.2,1.3,'77533b');window(2.5,4.6,-2.96,.65,.75,'77533b');
    box('parede ocre gourmet',-3.2,1.4,-.2,2.3,2.8,.12,'bc963e');box('bancada',-3.5,.92,.1,1.8,.15,.7,'989786');
    window(.5,1.65,-2.9,1.7,1.2,'5d4e3d');window(2.8,1.65,-2.9,1.4,1.2,'5d4e3d');
    box('deck',-3.3,.045,8.2,6,.09,3.9,'b9a876');box('borda piscina',-3.3,.13,8.2,4.3,.15,2.8,'d5ceaf');box('agua piscina',-3.3,.22,8.2,3.9,.03,2.4,'67bfd2');
    box('muro frontal esquerdo',-3.9,1.35,10.5,6.2,2.7,.2,'d3d0b8');box('muro frontal direito',5.7,1.35,10.5,2.6,2.7,.2,'d3d0b8');
    for(const y of [.9,1.7])box('junta horizontal muro',-3.9,y,10.62,6.2,.025,.01,'919681');
  }
  const size=[0,0,0];for(let i=0;i<P.length;i+=3){size[0]=Math.max(size[0],Math.abs(P[i])*2);size[1]=Math.max(size[1],P[i+1]);size[2]=Math.max(size[2],Math.abs(P[i+2])*2);}
  const front={57881:{w:5,h:3.2,z:7.8},89981:{w:5,h:4.1,z:8},86834:{w:6,h:3.5,z:7.8},85452:{w:6.5,h:6.8,z:7},87313:{w:10,h:3.4,z:12.6},89963:{w:14,h:7.5,z:10.5}}[id];
  const asset={id:String(id),front,title:houses.find(h=>h.id===id).titulo,source:houses.find(h=>h.id===id).url,status:'estudo_exterior',note,size,parts,p:b64(Int16Array.from(P,v=>Math.round(v*100))),n:b64(Int8Array.from(N,v=>Math.round(v*127))),c:b64(Uint8Array.from(C,v=>Math.round(v*255))),i:b64(new Uint16Array(indices))};
  if(indices.length>65535)throw Error('Index overflow');assets.push(asset);
  const doc=new Document(),buffer=doc.createBuffer(),a=(name,type,array)=>doc.createAccessor(name).setType(type).setArray(array).setBuffer(buffer);
  const primitive=doc.createPrimitive().setAttribute('POSITION',a('position','VEC3',new Float32Array(P))).setAttribute('NORMAL',a('normal','VEC3',new Float32Array(N))).setAttribute('COLOR_0',a('color','VEC3',new Float32Array(C))).setIndices(a('indices','SCALAR',new Uint16Array(indices))).setMaterial(doc.createMaterial().setDoubleSided(true).setRoughnessFactor(.8));
  doc.createScene().addChild(doc.createNode('cadastro-'+id).setMesh(doc.createMesh().addPrimitive(primitive)).setExtras({listingId:id,note,parts}));
  const folder=new URL('./'+id+'/',import.meta.url);fs.mkdirSync(folder,{recursive:true});
  await new NodeIO().write(fileURLToPath(new URL('exterior-estudo.glb',folder)),doc);
  fs.writeFileSync(new URL('referencias.json',folder),JSON.stringify({id,source:asset.source,status:asset.status,note,parts:parts.map(p=>p.name)},null,2));
}
fs.writeFileSync(new URL('./estudos.json',import.meta.url),JSON.stringify({version:1,assets}));
console.log(JSON.stringify({studies:assets.length,vertices:assets.map(a=>({id:a.id,parts:a.parts.length}))}));

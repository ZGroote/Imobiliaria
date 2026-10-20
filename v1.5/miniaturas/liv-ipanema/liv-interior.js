/* Geometria e materiais do padrão V2 aprovado, com dimensões/cores do cadastro LIV.
   Fonte: padrao-atual/anterior/v2.html, v2Texture..factory e acabamento material.
   Inclui apenas acabamento: nenhuma planta, layout, câmera, luz ou atlas do Cedros. */
(function(global){
'use strict';
function aplicarAcabamentosLiv({THREE,document,renderer,environment,catalog,materials}){
var ren=renderer,ambientePBR=environment,FURN=catalog,MAT=materials;
var V2={materials:{},textures:[],replaced:[]};
function v2Texture(kind,data){
  var n=256,c=document.createElement('canvas');c.width=c.height=n;
  var g=c.getContext('2d'),im=g.createImageData(n,n),seed=7163;
  function rnd(){seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;}
  for(var y=0;y<n;y++)for(var x=0;x<n;x++){
    var v=0.9,noise=(rnd()-.5);
    if(kind==='linen')v=.83+.09*Math.sin(x*Math.PI/2)*Math.sin(y*Math.PI/2)+noise*.11;
    if(kind==='wood')v=.92+.018*Math.sin(x*1.29+Math.sin(y*.029)*2)+.012*Math.sin(x*2.97+y*.03)+noise*.025;
    if(kind==='plaster')v=.985+noise*.012;
    if(kind==='stone')v=.88+noise*.08+.025*Math.sin(x*.04+y*.025);
    if(kind==='oak'){
      var row=Math.floor(x/32),yy=(y+row*83)%256;
      v=.91+.025*Math.sin(row*7)+.018*Math.sin(x*1.66+Math.sin(y*.032)*2)+noise*.025;
      if(x%32<1||yy<1)v=.77;
    }
    var k=(y*n+x)*4;im.data[k]=im.data[k+1]=im.data[k+2]=Math.round(v*255);im.data[k+3]=255;
  }
  g.putImageData(im,0,0);var t=new THREE.CanvasTexture(c);
  t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=Math.min(8,ren.capabilities.getMaxAnisotropy());
  if(!data)t.colorSpace=THREE.SRGBColorSpace;
  V2.textures.push(t);return t;
}
var v2Maps={};['linen','wood','stone','oak','plaster'].forEach(k=>{v2Maps[k]=v2Texture(k,false);v2Maps[k+'Bump']=v2Texture(k,true);});
function v2Material(name,color,kind,rough,metal,vertex){
  var key=[name,color,vertex].join('-');if(V2.materials[key])return V2.materials[key];
  var m=new THREE.MeshStandardMaterial({name:name,color:color,roughness:rough,metalness:metal||0,
    vertexColors:!!vertex,side:THREE.DoubleSide,envMap:ambientePBR,envMapIntensity:.55});
  if(kind){m.map=v2Maps[kind];m.bumpMap=v2Maps[kind+'Bump'];m.bumpScale=kind==='linen'?.0018:.001;}
  V2.materials[key]=m;return m;
}
function v2UV(g,scale){
  var p=g.attributes.position,n=g.attributes.normal,uv=new Float32Array(p.count*2);
  for(var i=0;i<p.count;i++){
    var nx=Math.abs(n.getX(i)),ny=Math.abs(n.getY(i)),nz=Math.abs(n.getZ(i));
    uv[i*2]=(nx>ny&&nx>nz?p.getZ(i):p.getX(i))*scale;
    uv[i*2+1]=(ny>nx&&ny>nz?p.getZ(i):p.getY(i))*scale;
  }g.setAttribute('uv',new THREE.BufferAttribute(uv,2));return g;
}
// Rounded boxes with continuous normals, dimensions in metres, shared by upholstery.
function v2Round(w,h,d,r){
  r=Math.min(r,w*.45,h*.45,d*.45);
  var g=new THREE.BoxGeometry(1,1,1,8,8,8),p=g.attributes.position,n=g.attributes.normal;
  var a=new THREE.Vector3(),b=new THREE.Vector3(),q=new THREE.Vector3();
  for(var i=0;i<p.count;i++){
    a.set(p.getX(i),p.getY(i),p.getZ(i));
    b.set(Math.max(-.375,Math.min(.375,a.x)),Math.max(-.375,Math.min(.375,a.y)),Math.max(-.375,Math.min(.375,a.z)));
    q.copy(a).sub(b).normalize();
    p.setXYZ(i,b.x/.75*(w-2*r)+q.x*r,b.y/.75*(h-2*r)+q.y*r,b.z/.75*(d-2*r)+q.z*r);
    n.setXYZ(i,q.x,q.y,q.z);
  }return v2UV(g,3);
}
function v2Box(group,mat,w,h,d,x,y,z,r,rx,rz){
  var mesh=new THREE.Mesh(v2Round(w,h,d,r||.008),mat);
  mesh.position.set(x,y,z);mesh.rotation.set(rx||0,0,rz||0);mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);return mesh;
}
// Merge only within each furniture item, keeping editor transforms and material boundaries.
function v2Merge(group){
  var buckets={};group.updateMatrixWorld(true);
  group.children.slice().forEach(o=>{if(!o.isMesh)return;var key=o.material.uuid;
    (buckets[key]||(buckets[key]={mat:o.material,p:[],n:[],uv:[]}));var b=buckets[key];
    var g=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();o.updateMatrix();g.applyMatrix4(o.matrix);
    ['position','normal','uv'].forEach((k,j)=>b[['p','n','uv'][j]].push(...g.attributes[k].array));
    g.dispose();o.geometry.dispose();group.remove(o);
  });
  Object.values(buckets).forEach(b=>{var g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(b.p,3));
    g.setAttribute('normal',new THREE.Float32BufferAttribute(b.n,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(b.uv,2));g.computeBoundingSphere();
    var o=new THREE.Mesh(g,b.mat);o.castShadow=o.receiveShadow=true;group.add(o);});return group;
}
function v2Upholstery(type,dim,color){
  var w=dim.w,h=dim.h,d=dim.d,g=new THREE.Group();
  var fabric=v2Material('Tecido linho',color == null ? 0x88958d : color,'linen',.94),cream=v2Material('Algodao cru',0xe6dfcf,'linen',.96);
  var accent=v2Material('Tecido LIV',color == null ? 0x99b7aa : color,'linen',.96),wood=v2Material('Madeira nogueira',0x69503b,'wood',.52);
  if(type==='sofa'){
    v2Box(g,wood,w*.86,h*.13,d*.76,0,h*.065,0,.015);
    v2Box(g,fabric,w,h*.24,d,0,h*.26,0,.055);
    var count=Math.max(2,Math.round(w/.8)),cw=(w-.30)/count;
    for(var i=0;i<count;i++){
      var x=-w/2+.15+cw*(i+.5);
      v2Box(g,fabric,cw-.025,h*.20,d*.71,x,h*.46,d*.09,.055);
      v2Box(g,fabric,cw-.02,h*.43,d*.19,x,h*.755,-d*.36,.055,-.12);
    }
    [-1,1].forEach(s=>{v2Box(g,fabric,.15,h*.48,d*.95,s*(w/2-.075),h*.43,0,.045);
      v2Box(g,s<0?cream:accent,.34,.34,.12,s*w*.28,h*.68,-d*.12,.055,-.2,s*.13);});
  }else{
    v2Box(g,wood,w*.94,h*.27,d*.96,0,h*.15,0,.025);
    v2Box(g,cream,w*.96,h*.22,d*.93,0,h*.39,0,.06);
    v2Box(g,fabric,w,h*.80,.10,0,h*.60,-d/2+.05,.04);
    v2Box(g,cream,w*.98,h*.13,d*.74,0,h*.53,d*.10,.055);
    [-1,1].forEach(s=>v2Box(g,cream,w*.42,h*.14,.46,s*w*.24,h*.57,-d*.30,.075,-.08));
    // Folded woven cover across the foot; full mesh, visible from every angle.
    v2Box(g,accent,w*.99,h*.04,d*.28,0,h*.61,d*.31,.018);
  }
  V2.replaced.push(type);return v2Merge(g);
}
var v2OriginalFactory=FURN.geoDoMovel;
FURN.geoDoMovel=function(def,color,dim){
  var type=Object.keys(FURN.MOVEIS).find(k=>FURN.MOVEIS[k]===def),obj;
  if(type==='sofa'||type==='cama'){
    // Non-parametric pieces are scaled by the caller; build at catalog size in that case.
    obj=v2Upholstery(type,def.param?dim:{w:def.b[0],h:def.b[1],d:def.b[2]},color);
  }else if(type==='tapete'){
    // A biblioteca em cm colapsa campo/listras na mesma cota. Uma única superfície
    // fechada de tecido conserva o item nominal; o caller escala do tamanho base.
    obj=new THREE.Group();
    var tecido=v2Material('Tapete LIV',color,'linen',.96);
    v2Box(obj,tecido,def.b[0],def.b[1],def.b[2],0,def.b[1]/2,0,.004);
  }else{
    // O parâmetro tipo é necessário para cuba/gabinete na fábrica real de bancadas.
    var medida=Object.assign({},dim,{tipo:type}),factoryDef=def;
    if(type==='pia'||type==='balcao'){
      factoryDef=Object.assign({},def,{param:function(m){
        var partes=def.param(m);
        if(m.livNome==='Bancada e cuba da cozinha'){
          // Cuba observada ~pixel842,492, dentro da mesma bancada cadastrada.
          partes=partes.filter(p=>p.c!==0x23262a);
          var cx=-.48,vx=.46,vd=.40,cz=.02;
          var x0=-m.w/2,x1=m.w/2,z0=-(m.d+.02)/2+.01,z1=(m.d+.02)/2+.01;
          [[x0,cx-vx/2,z0,z1],[cx+vx/2,x1,z0,z1],
            [cx-vx/2,cx+vx/2,cz+vd/2,z1],[cx-vx/2,cx+vx/2,z0,cz-vd/2]].forEach(q=>{
              partes.push({x:(q[0]+q[1])/2,y:.86,z:(q[2]+q[3])/2,
                w:q[1]-q[0],h:.04,d:q[3]-q[2],c:color});
            });
          partes.forEach(p=>{if(p.malha==='cuba'||p.malha==='torneira')p.x=cx;});
        }
        partes.forEach(p=>{if(p.c===0x23262a)p.c=color;});
        return partes;
      }});
    }
    obj=v2OriginalFactory(factoryDef,color,medida);
    var cloth=['cortina','tapete'].includes(type),wood=['armario','guardaroupa','ripado','rack','criado','mesa','cadeira','estante'].includes(type);
    var metal=['coifa','geladeira','fogao'].includes(type),stone=['pia','balcao'].includes(type);
    obj.traverse(o=>{if(!o.isMesh)return;
      o.geometry=o.geometry.clone();v2UV(o.geometry,cloth?5:wood?1.4:2);
      if(stone){
        // Granito preto é a cor fixa da fábrica; o cadastro LIV especifica pedra clara.
        var old=new THREE.Color(0x23262a),target=new THREE.Color(color),a=o.geometry.attributes.color;
        if(a)for(var i=0;i<a.count;i++){
          if(Math.abs(a.getX(i)-old.r)+Math.abs(a.getY(i)-old.g)+Math.abs(a.getZ(i)-old.b)<.002)
            a.setXYZ(i,target.r,target.g,target.b);
        }
      }
      o.material=v2Material('Acabamento '+type,0xffffff,cloth?'linen':wood?'wood':stone?'stone':null,cloth?.94:metal?.30:wood?.55:.48,metal?.68:0,true);
    });
  }
  obj.name='liv-'+type;
  if(type==='rack'){
    // A tela pertence ao rack registrado; não cria entidade fora do construtor.
    var tela=FURN.geoDoMovel(FURN.MOVEIS.tv,0x22262b,
      {w:Math.min(dim.w*.64,1.20),h:1.46,d:.07});
    tela.name='liv-rack-televisao';tela.userData.livSubcomponente='televisao';
    tela.position.z=-dim.d/2+.02;obj.add(tela);
  }
  return obj;
};

MAT.matMadeira.map=v2Maps.oak;MAT.matMadeira.normalMap=null;MAT.matMadeira.bumpMap=v2Maps.oakBump;
MAT.matMadeira.bumpScale=.002;MAT.matMadeira.roughness=.52;MAT.matMadeira.envMapIntensity=.65;
MAT.matParede.map=v2Maps.plaster;MAT.matParede.normalScale.set(.025,.025);MAT.matParede.roughness=.95;
MAT.matFrio.normalScale.set(.16,.16);MAT.matFrio.roughness=.38;
[MAT.matMadeira,MAT.matParede,MAT.matFrio].forEach(m=>m.needsUpdate=true);
V2.personalizar=function(obj,m){
  if(m.livNome!=='Mesa da varanda')return obj;
  // A mesma mesa cadastrada recebe o tampo circular observado na planta.
  var grupo=new THREE.Group(),mat=v2Material('Mesa circular LIV',0xffffff,'wood',.55,0,true);
  function cilindro(rt,rb,h,x,y,z){
    var geo=new THREE.CylinderGeometry(rt,rb,h,48);v2UV(geo,1.4);
    var mesh=new THREE.Mesh(geo,mat);mesh.position.set(x,y,z);
    mesh.castShadow=mesh.receiveShadow=true;grupo.add(mesh);
    var cor=new THREE.Color(m.cor);var cores=new Float32Array(geo.attributes.position.count*3);
    for(var i=0;i<cores.length;i+=3){cores[i]=cor.r;cores[i+1]=cor.g;cores[i+2]=cor.b;}
    geo.setAttribute('color',new THREE.BufferAttribute(cores,3));
  }
  cilindro(m.w/2,m.w/2,.045,0,m.h-.0225,0);
  [-1,1].forEach(function(x){[-1,1].forEach(function(z){
    cilindro(.022,.030,m.h-.045,x*m.w*.25,(m.h-.045)/2,z*m.d*.25);
  });});
  grupo.name='liv-mesa-varanda-circular';grupo.userData.livAcabamento='tampo circular da referência';
  grupo.userData.livDimensaoFinal=true;
  obj.traverse(o=>{if(o.isMesh)o.geometry.dispose();});
  return grupo;
};
return V2;
}
global.aplicarAcabamentosLiv=aplicarAcabamentosLiv;
global.corrigirNormaisCasaLiv=function(grupo,ctx){
  var report={verticalTriangles:0,opposedBefore:0,opposedAfter:0,flippedVertices:0,
    positionsChanged:false,floorsCeilingFurnitureChanged:false};
  var nativeFlips=new Set();
  // gl[0] é a identidade da malha P/N de paredes+rodapés no contexto do builder,
  // anterior aos pisos e às esquadrias. Openings tem winding inverso, N correta.
  var paredes=ctx && ctx.gl ? ctx.gl[0] : grupo.children.find(o=>o.isMesh && o.userData.casa);
  grupo.traverse(function(mesh){
    if(mesh!==paredes)return;
    var g=mesh.geometry,p=g.attributes.position,n=g.attributes.normal;
    if(!p || !n)return;
    var old=new Float32Array(n.array),flip=new Set(),triangles=[];
    var indices=g.index?g.index.array:null,count=indices?indices.length:p.count;
    for(var i=0;i<count;i+=3){
      var a=indices?indices[i]:i,b=indices?indices[i+1]:i+1,c=indices?indices[i+2]:i+2;
      var ab=[p.getX(b)-p.getX(a),p.getY(b)-p.getY(a),p.getZ(b)-p.getZ(a)];
      var ac=[p.getX(c)-p.getX(a),p.getY(c)-p.getY(a),p.getZ(c)-p.getZ(a)];
      var cross=[ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0]];
      var length=Math.hypot.apply(null,cross);if(length<1e-10)continue;
      var ny=(old[a*3+1]+old[b*3+1]+old[c*3+1])/3;
      if(Math.abs(ny)>.05 || Math.abs(cross[1]/length)>.05)continue;
      var dot=cross[0]*old[a*3]+cross[1]*old[a*3+1]+cross[2]*old[a*3+2];
      triangles.push({a:a,b:b,c:c,cross:cross});report.verticalTriangles++;
      if(dot<0){report.opposedBefore++;flip.add(a);flip.add(b);flip.add(c);}
    }
    flip.forEach(function(v){n.setXYZ(v,-old[v*3],-old[v*3+1],-old[v*3+2]);});
    triangles.forEach(function(t){
      if(t.cross[0]*n.getX(t.a)+t.cross[1]*n.getY(t.a)+t.cross[2]*n.getZ(t.a)<-1e-10)report.opposedAfter++;
    });
    report.flippedVertices+=flip.size;if(flip.size)n.needsUpdate=true;
    // A fila nativa tem os mesmos vértices tesselados; seu fallback deve traçar
    // a mesma normal corrigida, em vez de amostrar o miolo da parede.
    var m=ctx && ctx.gl?ctx.gl.indexOf(mesh):-1;
    if(m>=0){
      var data=ctx.malhas[m];for(var j=0;j<n.array.length;j++)data.N[j]=n.array[j];
      flip.forEach(function(v){nativeFlips.add(ctx.idx[m][v]);});
    }
  });
  if(ctx)nativeFlips.forEach(function(k){ctx.nrm[k*3]=-ctx.nrm[k*3];ctx.nrm[k*3+1]=-ctx.nrm[k*3+1];ctx.nrm[k*3+2]=-ctx.nrm[k*3+2];});
  if(report.opposedAfter)throw Error('Normal vertical LIV ainda oposta ao winding.');
  grupo.userData.livNormalRepair=report;return report;
};
global.particionarPisoLiv=function(pl){
  var social=pl.comodos.find(c=>c.nome==='Sala integrada');
  if(!social)return pl;
  // Partição visual disjunta: não muda cômodos, paredes, cadastro ou colisão.
  // Origem105,225;11mm/px. Diagonal755,566→819,625 da fotografia oficial.
  var anchor=social.poly[0],ob=pl.ob;
  function W(p){var x=p[0]-5.35,z=p[1]-1.5;
    return [anchor[0]+x*ob.ux-z*ob.uz,anchor[1]+x*ob.uz+z*ob.ux];}
  var frio=[[7.15,1.5],[8.5,1.5],[8.5,4.4],[7.85,4.4],[7.15,3.75]].map(W);
  var madeira=[[5.35,1.5],[7.15,1.5],[7.15,3.75],[7.85,4.4],[8.5,4.4],
    [8.5,5.4],[6,5.4],[6,6.25],[3.55,6.25],[3.55,3.85],[2.7,3.85],[2.7,2.85],[5.35,2.85]].map(W);
  function area(poly){var a=0;for(var i=0;i<poly.length;i++){
    var p=poly[i],q=poly[(i+1)%poly.length];a+=p[0]*q[1]-q[0]*p[1];}return Math.abs(a)/2;}
  if(Math.abs(area(social.poly)-area(frio)-area(madeira))>1e-8)
    throw Error('Partição de acabamento alteraria a área da sala.');
  var pisoFrio=parseInt(String(pl.unidade.cores.piso_frio).replace('#',''),16);
  var partitions=[Object.assign({},social,{poly:madeira}),
    Object.assign({},social,{poly:frio,pisoTipo:'frio',piso:pisoFrio})];
  var derivado=Object.assign({},pl,{comodos:pl.comodos.flatMap(c=>c===social?partitions:[c])});
  derivado.livAcabamentoCozinha={areaFria:area(frio),areaMadeira:area(madeira),areaOriginal:area(social.poly)};
  return derivado;
};
})(globalThis);

/* Extensões exclusivas LIV Ipanema. A geometria continua sendo o export Blender. */
var livManifest=null;
var livInteriorManifest=null,livInteriorPendente=null;
conjuntoCompleto = false;
ANDAR = -1;
document.getElementById('seloT').textContent = 'LIV Ipanema · 17 pavimentos';
var livNota = document.getElementById('notaModelo');
livNota.hidden = false;
livNota.textContent = 'Maquete baseada nas imagens da Livon. Dimensões e implantação aproximadas; '
  + 'planta 3D e visita ilustrativas.';
DICAS.maquete = 'Arraste para girar · use a roda ou dois dedos para aproximar';
DICAS.planta2d = 'Planta oficial publicada pela Livon · apartamento de 47,59 m²';
DICAS.planta3d = 'Ilustração da planta publicada · medidas e pé-direito aproximados';
DICAS.visita += ' · ilustração da planta publicada';
document.getElementById('dica').textContent = DICAS.maquete;
var livConjunto = document.getElementById('verConjunto');
livConjunto.hidden = false;
livConjunto.textContent = 'Ver conjunto';
livConjunto.onclick = function () { livSetConjunto(!conjuntoCompleto); };

// O interior vem exclusivamente do cadastro exportado pelo construtor.
if(!D.cadastro || !PL_R)throw Error('LIV Ipanema requer a planta válida do construtor.');
var livAcabamentos=aplicarAcabamentosLiv({THREE:THREE,document:document,
  renderer:ren,environment:ambientePBR,catalog:FURN,materials:MAT});
PL_R.moveis.forEach(function(m,i){
  var nominal=D.cadastro.planta.moveis[i];
  if(!nominal || nominal.tipo!==m.tipo || nominal.w!==m.w || nominal.d!==m.d)
    throw Error('Correspondência do móvel nominal perdeu a ordem do construtor.');
  m.livNome=nominal.nome;
});
PL_R.comodos.forEach(function(c){
  // Acabamento observado na planta publicitária; não modifica o cadastro nominal.
  var madeira=/^(su[ií]te|dormit[oó]rio|sala|circula)/i.test(c.nome || '');
  c.pisoTipo=madeira ? 'madeira' : 'frio';
  var cores=D.cadastro.cores || {};
  c.piso=parseInt(String(cores['piso_'+c.pisoTipo] || (madeira?'#B89369':'#B4B5B1')).replace('#',''),16);
});
var livPontoInterior=function(p){return [p[0]-PL_R.ob.cx,p[1]-PL_R.ob.cz];};
// Caminhar e escolher a entrada usam exatamente os segmentos exibidos pelo FloorPlan.
PL.comodos=PL_R.comodos.map(function(c){return {
  nome:c.nome,area:c.area,piso:c.pisoTipo,poly:c.poly.map(livPontoInterior)
};});
PAREDES={
  paredes:PL_R.paredes.map(function(w){return Object.assign({},w,{a:livPontoInterior(w.a),b:livPontoInterior(w.b)});}),
  vaos:PL_R.esquadrias.map(function(e){return Object.assign({},e,{a:livPontoInterior(e.a),b:livPontoInterior(e.b)});})
};
var livNavegacao=InteriorNavigation.create({
  INT:{pl:PL_R,moveis:PL_R.moveis},dentroDaPlanta:FP2.dentroDaPlanta,
  paraUV:function(x,z){var dx=x-PL_R.ob.cx,dz=z-PL_R.ob.cz;
    return [dx*PL_R.ob.ux+dz*PL_R.ob.uz,-dx*PL_R.ob.uz+dz*PL_R.ob.ux];},
  MOVEIS:FURN.MOVEIS,ESP:ESP,RAIO:RAIO_CORPO,OLHO:OLHO
});
livre=function(x,z){return livNavegacao.livre(x+PL_R.ob.cx,z+PL_R.ob.cz);};
folga=function(x,z){return livNavegacao.folga(x+PL_R.ob.cx,z+PL_R.ob.cz);};
visivel=function(x,z){return livNavegacao.visivel(x+PL_R.ob.cx,z+PL_R.ob.cz);};
melhorDirecao=function(x,z){return livNavegacao.melhorDirecao(x+PL_R.ob.cx,z+PL_R.ob.cz);};
pontoDeEntrada=function(){return livPontoInterior(livNavegacao.pontoDeEntrada(PL_R));};
var livXs=[],livZs=[];
PL.comodos.forEach(function(c){c.poly.forEach(function(p){livXs.push(p[0]);livZs.push(p[1]);});});
PB={x0:Math.min.apply(null,livXs),x1:Math.max.apply(null,livXs),
    z0:Math.min.apply(null,livZs),z1:Math.max.apply(null,livZs)};
PB.cx=(PB.x0+PB.x1)/2;PB.cz=(PB.z0+PB.z1)/2;PB.w=PB.x1-PB.x0;PB.h=PB.z1-PB.z0;
var livGeoDaCasaBase=HM.geoDaCasa;
HM.geoDaCasa=function(){
  var args=Array.prototype.slice.call(arguments);
  args[0]=particionarPisoLiv(args[0]);
  var grupo=livGeoDaCasaBase.apply(HM,args);
  corrigirNormaisCasaLiv(grupo,BK.BAKE.fila);
  // Albedo anterior ao AO por vértice, sobre a mesma geometria tesselada do viewer.
  grupo.traverse(function(o){
    var cor=o.isMesh && o.geometry.getAttribute('color');
    if(!cor)return;
    var divisor=cor.normalized && cor.array instanceof Uint8Array ? 255 : 1;
    var albedo=new Float32Array(cor.array.length);
    for(var i=0;i<albedo.length;i++)albedo[i]=cor.array[i]/divisor;
    o.userData.livAlbedo=albedo;
  });
  return grupo;
};
var livAcabamentoTetoBase=acabamentoTeto;
acabamentoTeto=function(grupo,pl){
  livAcabamentoTetoBase(grupo,pl);
  // União dos intervalos colineares das duas faixas; a mesma união espacial sem
  // faces duplicadas nos remates de segmentos consecutivos da parede real.
  var buckets={};
  grupo.children.filter(o=>o.name==='rodateto').forEach(function(o){
    var x=Math.sin(o.rotation.y),z=Math.cos(o.rotation.y);
    if(x<-.00001 || Math.abs(x)<.00001 && z<0){x=-x;z=-z;}
    var linha=-z*o.position.x+x*o.position.z,t=x*o.position.x+z*o.position.z;
    var key=[x,z,linha,o.position.y,o.scale.x,o.scale.y].map(v=>v.toFixed(6)).join('|');
    if(!buckets[key])buckets[key]={x:x,z:z,linha:linha,prototype:o,intervalos:[]};
    buckets[key].intervalos.push([t-o.scale.z/2,t+o.scale.z/2]);grupo.remove(o);
  });
  Object.values(buckets).forEach(function(b){
    b.intervalos.sort((a,c)=>a[0]-c[0]);var unidos=[];
    b.intervalos.forEach(function(r){var last=unidos[unidos.length-1];
      if(last && r[0]<=last[1]+1e-6)last[1]=Math.max(last[1],r[1]);else unidos.push(r.slice());});
    unidos.forEach(function(r){var mesh=b.prototype.clone(),t=(r[0]+r[1])/2;
      mesh.position.set(b.x*t-b.z*b.linha,b.prototype.position.y,b.z*t+b.x*b.linha);
      mesh.rotation.y=Math.atan2(b.x,b.z);mesh.scale.z=r[1]-r[0];grupo.add(mesh);});
  });
};
var livMontaPlantaBase=montaPlanta3D;
montaPlanta3D=function(){
  var root=livMontaPlantaBase();
  if(!livInteriorPendente && typeof LIV_INTERIOR_LIGHTMAP_DATA!=='undefined'){
    livInteriorPendente=(async function(){
      // A fila nativa escreve na geometria original. Concluí-la também preserva
      // a iluminação de fallback antes de trocar os cantos pelos UV preparados.
      while(BK.BAKE.fila)await new Promise(resolve=>requestAnimationFrame(resolve));
      var state=await aplicarLuzInteriorLiv({THREE:THREE,root:root,
        unitHash:D.interiorFonte.unidadeSHA256,proof:LIV_INTERIOR_LIGHTMAP_DATA.proof,
        loadJSON:async function(path){var value=LIV_INTERIOR_LIGHTMAP_DATA.json[path];
          if(!value)throw Error('JSON interno ausente: '+path);return value;},
        loadBytes:async function(path){var value=LIV_INTERIOR_LIGHTMAP_DATA.gzip[path];
          if(!value)throw Error('Atlas interno ausente: '+path);
          var s=atob(value),bytes=new Uint8Array(s.length);
          for(var i=0;i<s.length;i++)bytes[i]=s.charCodeAt(i);
          return new Uint8Array(await new Response(new Blob([bytes]).stream()
            .pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());},
        onReady:function(estado,manifest){livInteriorManifest=manifest;
          estado.active=true;estado.targetsMapped=estado.objects;estado.semAOduplicado=true;
          sol.shadow.needsUpdate=true;},
        onInvalidate:function(estado){estado.active=false;sol.shadow.needsUpdate=true;},
        onError:function(error,estado){estado.active=false;console.warn('Luz interior LIV: '+error);}
      });
      window.__liv.luzInterior=state;return state;
    })();
    window.__liv.luzInteriorPronta=livInteriorPendente;
  }
  return root;
};
var livQuadroBase=quadro;
quadro=function(agora){
  if(window.__liv && window.__liv.luzInterior)window.__liv.luzInterior.check();
  livQuadroBase(agora);
};

var livMalhas = predio.children.filter(function (obj) { return obj.isInstancedMesh; });
livMalhas.forEach(function (mesh, indice) {
  var grupo = CASTANHEIRAS_BLENDER.groups[indice];
  mesh.userData.livPavimentos = grupo.instances.slice().sort(function(a,b){return a.floor-b.floor;})
    .map(function(it){return it.floor;});
});
var livSelecao = new THREE.Color(0.28, 0.95, 0.53);
var livBranco = new THREE.Color(1, 1, 1);
function livSetFloor(pavimento) {
  ANDAR = Math.max(-1, Math.min(N - 1, Number(pavimento)));
  livMalhas.forEach(function (mesh) {
    if (mesh.userData.tower !== 0) return;
    if (!mesh.isInstancedMesh) {
      var floorsMerged = mesh.geometry.getAttribute('livFloorIndex');
      var colorsMerged = mesh.geometry.getAttribute('color');
      if(!floorsMerged || !colorsMerged)return;
      for(var vertice=0;vertice<floorsMerged.count;vertice++){
        var cor=ANDAR>=0 && floorsMerged.getX(vertice)===ANDAR ? livSelecao : livBranco;
        colorsMerged.setXYZ(vertice,cor.r,cor.g,cor.b);
      }
      colorsMerged.needsUpdate=true;
      return;
    }
    var floors = mesh.userData.livPavimentos;
    for (var i = 0; i < mesh.count; i++)
      mesh.setColorAt(i, ANDAR >= 0 && floors[i] === ANDAR ? livSelecao : livBranco);
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });
  document.getElementById('livAndar').value = String(ANDAR);
  document.getElementById('seloT').textContent = ANDAR < 0
    ? 'LIV Ipanema · 17 pavimentos' : (ANDAR + 1) + 'º pavimento · destaque ilustrativo';
  if (window.__maq) window.__maq.andar = ANDAR;
  ren.render(cena, cam);
}
function livSetConjunto(mostrar, manterModo) {
  conjuntoCompleto = Boolean(mostrar);
  predio.children.forEach(function(o){
    if(o.isMesh)o.visible=conjuntoCompleto || o.userData.tower===0;
  });
  CAIXA = caixaVisivel(); CAIXA.getCenter(MEIO); CAIXA.getSize(TAM);
  ALTURA = TAM.y; raioBase = Math.hypot(TAM.x,TAM.z)/2;
  livConjunto.textContent = conjuntoCompleto ? 'Ver torre' : 'Ver conjunto';
  livConjunto.setAttribute('aria-pressed', String(conjuntoCompleto));
  caixaSombraVisita = null;
  sol.shadow.needsUpdate=true;
  if (!manterModo) livView('perspectiva');
}
var livCamPerspectiva=cam;
var livCamOrtografica=new THREE.OrthographicCamera(-1,1,1,-1,0.2,2000);
livCamOrtografica.aspect=cam.aspect;
// O controle existente usa orb.r para zoom; aqui ele representa meia altura do quadro.
livCamOrtografica.fov=90;
function livSelecionaCamera(ortografica){
  cam=ortografica ? livCamOrtografica : livCamPerspectiva;
  cam.aspect=(caixa.clientWidth || 1)/(caixa.clientHeight || 1);
  if(window.__maq)window.__maq.cam=cam;
}
var livPoeCamBase=poeCam;
poeCam=function(){
  livPoeCamBase();
  if(!cam.isOrthographicCamera)return;
  cam.aspect=(caixa.clientWidth || 1)/(caixa.clientHeight || 1);
  cam.left=-orb.r*cam.aspect;cam.right=orb.r*cam.aspect;
  cam.top=orb.r;cam.bottom=-orb.r;
  cam.updateProjectionMatrix();
  // A distância física é independente do zoom e mantém toda a maquete após o near.
  var direcao=cam.position.clone().sub(alvo).normalize();
  cam.position.copy(alvo).addScaledVector(direcao,400);
  cam.updateMatrixWorld();
};
function livFitOrtografico(){
  var st=Math.sin(orb.th),ct=Math.cos(orb.th),sp=Math.sin(orb.ph),cp=Math.cos(orb.ph);
  var right=new THREE.Vector3(ct,0,-st),up=new THREE.Vector3(-st*cp,sp,-ct*cp);
  var meiaAltura=R_MIN,d=new THREE.Vector3();
  [CAIXA.min.x,CAIXA.max.x].forEach(function(x){
    [CAIXA.min.y,CAIXA.max.y].forEach(function(y){
      [CAIXA.min.z,CAIXA.max.z].forEach(function(z){
        d.set(x-alvo.x,y-alvo.y,z-alvo.z);
        meiaAltura=Math.max(meiaAltura,Math.abs(d.dot(up)),Math.abs(d.dot(right))/cam.aspect);
      });
    });
  });
  return meiaAltura*1.08;
}
function livFitBox() {
  var vf=cam.fov*Math.PI/180, hf=2*Math.atan(Math.tan(vf/2)*cam.aspect);
  var sinPhi=Math.sin(orb.ph),cosPhi=Math.cos(orb.ph);
  var sinTheta=Math.sin(orb.th),cosTheta=Math.cos(orb.th);
  var dir=new THREE.Vector3(sinTheta*sinPhi,cosPhi,cosTheta*sinPhi);
  var right=new THREE.Vector3(cosTheta,0,-sinTheta);
  var up=new THREE.Vector3(-sinTheta*cosPhi,sinPhi,-cosTheta*cosPhi);
  var distancia=R_MIN,delta=new THREE.Vector3();
  [CAIXA.min.x,CAIXA.max.x].forEach(function(x){
    [CAIXA.min.y,CAIXA.max.y].forEach(function(y){
      [CAIXA.min.z,CAIXA.max.z].forEach(function(z){
        delta.set(x-alvo.x,y-alvo.y,z-alvo.z);
        distancia=Math.max(distancia,delta.dot(dir)+Math.max(
          Math.abs(delta.dot(right))/Math.tan(hf/2),Math.abs(delta.dot(up))/Math.tan(vf/2)));
      });
    });
  });
  return distancia*1.08;
}
function livFitPortaria() {
  // Enquadra os volumes da torre e da entrada mantendo o observador a 1,8 m.
  var caixas=[
    {min:[-24.35,-0.3,-6.85],max:[24.35,N*LV+3.5,6.85]},
    {min:[-35.6,0,35.8],max:[-23,4.75,51.5]}
  ];
  var pontos=[];
  caixas.forEach(function(box){
    [box.min[0],box.max[0]].forEach(function(x){
      [box.min[1],box.max[1]].forEach(function(y){
        [box.min[2],box.max[2]].forEach(function(z){pontos.push(new THREE.Vector3(x,y,z));});
      });
    });
  });
  var tanV=Math.tan(cam.fov*Math.PI/360),tanH=tanV*cam.aspect;
  function cabe(r){
    var ph=Math.acos((1.8-alvo.y)/r),s=Math.sin(ph),c=Math.cos(ph);
    var th=orb.th,st=Math.sin(th),ct=Math.cos(th);
    var dir=new THREE.Vector3(st*s,c,ct*s);
    var right=new THREE.Vector3(ct,0,-st),up=new THREE.Vector3(-st*c,s,-ct*c);
    return pontos.every(function(p){
      var d=p.clone().sub(alvo),depth=r-d.dot(dir);
      return depth>0 && Math.abs(d.dot(right))<=depth*tanH*.90
        && Math.abs(d.dot(up))<=depth*tanV*.90;
    });
  }
  var lo=Math.abs(1.8-alvo.y)+1,hi=600;
  for(var i=0;i<32;i++){var mid=(lo+hi)/2;if(cabe(mid))hi=mid;else lo=mid;}
  orb.r=hi;orb.ph=Math.acos((1.8-alvo.y)/orb.r);
}
function livView(vista) {
  if(vista === 'frontal')vista='fachada';
  if (vista === 'aerea' || vista === 'portaria' || vista === 'implantacao') livSetConjunto(true, true);
  vaiPara('maquete');
  cam.fov = vista === 'portaria' ? 60 : 34;
  cam.updateProjectionMatrix();
  alvo.copy(MEIO);
  if (vista === 'fachada') { orb.th = -0.08; orb.ph = 1.78; }
  else if (vista === 'aerea') { orb.th = 1.05; orb.ph = 0.95; }
  else if (vista === 'implantacao') {
    livSelecionaCamera(true);orb.th = -Math.PI/2;orb.ph = 0;
  }
  else if (vista === 'portaria') {
    alvo.set(-6, 25, 10); orb.th = -0.13;
  } else { orb.th = 0.58; orb.ph = 1.24; }
  if (vista === 'portaria') livFitPortaria();
  else if (vista === 'implantacao') orb.r=livFitOrtografico();
  else orb.r=livFitBox();
  if(vista === 'fachada'){
    alvo.y=1.8-orb.r*Math.cos(orb.ph);
    orb.r=livFitBox();alvo.y=1.8-orb.r*Math.cos(orb.ph);
  }
  zoomManual = true;
  // Enquadramentos comparativos ficam estáveis; a órbita manual continua livre.
  gira = false; ultimoToque = performance.now();
  RETOMA = Infinity;
  poeCam(); ren.render(cena,cam);
  document.querySelectorAll('[data-vista]').forEach(function(bt){
    bt.setAttribute('aria-pressed', String(bt.dataset.vista === vista));
  });
  document.getElementById('livCameras').hidden = false;
  livConjunto.hidden = false;
  return {vista:vista, conjunto:conjuntoCompleto, camera:cam.position.toArray(), alvo:alvo.toArray()};
}
document.getElementById('livAndar').addEventListener('change',function(){livSetFloor(this.value);});
document.querySelectorAll('[data-vista]').forEach(function(bt){
  bt.addEventListener('click',function(){livView(this.dataset.vista);});
});
function livCapturar(){
  if(modo==='visita')quadro(performance.now());else poeCam();
  ren.render(cena,cam);
  return ren.domElement.toDataURL('image/png');
}
document.getElementById('livFoto').addEventListener('click',function(){
  var link=document.createElement('a');
  var vista=document.querySelector('[data-vista][aria-pressed=true]');
  link.href=livCapturar();link.download='liv-ipanema-'+(modo==='maquete' && vista?vista.dataset.vista:modo)+'.png';link.click();
});
var livVaiParaBase = vaiPara;
var livFundoExterior=cena.background;
var livFundoVisita=new THREE.Color(0xdce7eb);
vaiPara = function (novo) {
  var modoAnterior=modo;
  var primeiraPlanta=novo==='planta3d' && !vistaPlanta;
  livSelecionaCamera(false);
  livVaiParaBase(novo);
  if(primeiraPlanta){orb.th=0;orb.ph=.20;orb.r=raioQueEnquadra();poeCam();}
  cena.background=novo==='visita' ? livFundoVisita : livFundoExterior;
  if(modoAnterior!==novo)sol.shadow.needsUpdate=true;
  document.getElementById('livCameras').hidden = novo !== 'maquete';
  livConjunto.hidden = novo !== 'maquete';
  if(novo === 'maquete')document.getElementById('dica').textContent=DICAS.maquete;
};
// Downloads são arquivos independentes; o HTML já inclui os recursos do viewer.
var livDownloads = document.createElement('div');
livDownloads.className = 'liv-downloads';
livDownloads.innerHTML = '<a href="liv-ipanema.glb" download>Modelo GLB</a>'
  + '<a href="liv-ipanema.blend" download>Projeto Blender</a>';
document.getElementById('livReferencias').appendChild(livDownloads);
window.__liv = {view:livView, setFloor:livSetFloor, setConjunto:livSetConjunto,
  captura:livCapturar,
  interior:function(){return {cadastro:D.cadastro,fonte:D.interiorFonte,planta:PL_R,
    grupo:montaPlanta3D(),teto:tetoVisita,paredes:paredes(),livre:livre,entrada:pontoDeEntrada,
    bake:BK.BAKE,acabamentos:livAcabamentos,comodosLocais:PL.comodos,limites:PB,visita:FP,dentro:dentro};}};
if(typeof LIV_LIGHTMAP_DATA!=='undefined' && typeof aplicarLuzLiv==='function'){
  var livTrocaPendente=false;
  var livDecodifica=function(base64){
    var binario=atob(base64),bytes=new Uint8Array(binario.length);
    for(var i=0;i<binario.length;i++)bytes[i]=binario.charCodeAt(i);
    return bytes;
  };
  var livArquivo=function(relative){return relative.split('/').pop();};
  window.__liv.luzPronta=aplicarLuzLiv({THREE:THREE,predio:predio,asset:CASTANHEIRAS_BLENDER,
    modeloHash:LIV_LIGHTMAP_DATA.modeloHash,
    loadJSON:async function(relative){
      var dado=LIV_LIGHTMAP_DATA.json[livArquivo(relative)];
      if(!dado)throw Error('JSON de luz ausente: '+relative);
      return dado;
    },
    loadBytes:async function(relative){
      var nome=livArquivo(relative),gzip=LIV_LIGHTMAP_DATA.gzip[nome]
        || LIV_LIGHTMAP_DATA.gzip[nome+'.gz'];
      if(!gzip)throw Error('Atlas de luz ausente: '+relative);
      var fluxo=new Blob([livDecodifica(gzip)]).stream().pipeThrough(new DecompressionStream('gzip'));
      return new Uint8Array(await new Response(fluxo).arrayBuffer());
    },
    onReady:function(estado,manifest){
      livManifest=manifest;
      // Sol e geometria exterior ficam fixos; navegar não recalcula sombras.
      sol.shadow.autoUpdate=false;sol.shadow.needsUpdate=true;
      if(modo==='maquete'){
        sol.position.fromArray(manifest.sunWebPosition);
        sol.target.position.fromArray(manifest.sunWebTarget);
        sol.intensity=manifest.sunIntensity;
        caixaSombraVisita=null;caixaDaSombra(false);
      }
    },
    onReplace:function(oldMesh,newMesh,groupIndex){
      var pos=livMalhas.indexOf(oldMesh);
      if(pos>=0)livMalhas.splice(pos,1);
      if(livMalhas.indexOf(newMesh)<0)livMalhas.push(newMesh);
      newMesh.userData.tower=CASTANHEIRAS_BLENDER.groups[groupIndex].tower;
      if(!livTrocaPendente){
        livTrocaPendente=true;
        queueMicrotask(function(){
          livTrocaPendente=false;livSetConjunto(conjuntoCompleto,true);livSetFloor(ANDAR);
        });
      }
    }
  }).then(function(resultado){window.__liv.luz=resultado;return resultado;})
    .catch(function(erro){
      console.warn('Luz LIV indisponível; iluminação dinâmica mantida.',erro);
      window.__liv.erroLuz=String(erro);return null;
    });
}
ren.domElement.addEventListener('webglcontextrestored',function(){sol.shadow.needsUpdate=true;});
var livParams = new URLSearchParams(location.search);
var livModo = livParams.get('modo') || location.hash.slice(1);
if (!livModo || livModo === 'maquete')livView(livParams.get('vista') || 'perspectiva');
else if(livModo==='planta3d' || livModo==='visita'){
  // O template aceita links diretos antes desta extensão; remonta com os mesmos
  // dados nominais e as fábricas LIV para que esses links usem o fluxo completo.
  if(planta3d){cena.remove(planta3d);planta3d.traverse(o=>{if(o.isMesh)o.geometry.dispose();});
    planta3d=null;tetoVisita=null;}
  vaiPara(livModo);
}

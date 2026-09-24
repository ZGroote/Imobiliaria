/* Caminhada por destino. Coordenadas locais da planta centralizada. */
var caminhada = { rota:[], indice:0, marca:null };
function cancelaCaminhada() {
  if(caminhada.rota.length && typeof DICAS!=='undefined')document.getElementById('dica').textContent=DICAS.visita;
  caminhada.rota=[];
  if(caminhada.marca)caminhada.marca.visible=false;
}
function trechoLivre(a,b) {
  var n=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/0.07));
  for(var i=0;i<=n;i++)if(!livre(a.x+(b.x-a.x)*i/n,a.z+(b.z-a.z)*i/n))return false;
  return true;
}
function caminhoAte(destino) {
  var inicio={x:FP.x,z:FP.z};
  if(!livre(destino.x,destino.z))return [];
  if(trechoLivre(inicio,destino))return [destino];
  var passo=0.18, nx=Math.ceil(PB.w/passo)+1,nz=Math.ceil(PB.h/passo)+1;
  var pontos=[],pais=new Int32Array(nx*nz);pais.fill(-2);
  for(var z=0;z<nz;z++)for(var x=0;x<nx;x++){
    var p={x:PB.x0+x*passo,z:PB.z0+z*passo};
    pontos.push(livre(p.x,p.z)?p:null);
  }
  var fila=[];
  pontos.forEach(function(p,i){if(p && Math.hypot(p.x-inicio.x,p.z-inicio.z)<passo*2 && trechoLivre(inicio,p)){pais[i]=-1;fila.push(i);}});
  var fim=-1;
  for(var k=0;k<fila.length;k++){
    var id=fila[k],p=pontos[id];
    if(Math.hypot(p.x-destino.x,p.z-destino.z)<passo*2 && trechoLivre(p,destino)){fim=id;break;}
    for(var dz=-1;dz<=1;dz++)for(var dx=-1;dx<=1;dx++){
      if(!dx&&!dz)continue;
      var xx=id%nx+dx,zz=Math.floor(id/nx)+dz,j=zz*nx+xx;
      if(xx<0||xx>=nx||zz<0||zz>=nz||pais[j]!==-2||!pontos[j])continue;
      if(trechoLivre(p,pontos[j])){pais[j]=id;fila.push(j);}
    }
  }
  if(fim<0)return [];
  var bruta=[destino];for(var j=fim;j>=0;j=pais[j])bruta.unshift(pontos[j]);
  var rota=[],origem=inicio;
  for(var i=0;i<bruta.length;){var j=bruta.length-1;while(j>i&&!trechoLivre(origem,bruta[j]))j--;rota.push(bruta[j]);origem=bruta[j];i=j+1;}
  return rota;
}
var materialRota=new THREE.MeshBasicMaterial({color:0x999D9F,transparent:true,opacity:0.8,side:THREE.DoubleSide,depthWrite:false});
var geoBolinha=new THREE.CircleGeometry(0.035,12),geoCirculo=new THREE.RingGeometry(0.17,0.205,40);
geoBolinha.rotateX(-Math.PI/2);geoCirculo.rotateX(-Math.PI/2);
var formaSeta=new THREE.Shape();formaSeta.moveTo(0,0.1);formaSeta.lineTo(-0.07,-0.06);formaSeta.lineTo(0,-0.025);formaSeta.lineTo(0.07,-0.06);formaSeta.closePath();
var geoSeta=new THREE.ShapeGeometry(formaSeta);geoSeta.rotateX(-Math.PI/2);
function iniciaCaminhada(destino) {
  var rota=caminhoAte(destino);
  cancelaCaminhada();
  if(!rota.length){document.getElementById('dica').textContent='Escolha um ponto livre no chão, com passagem até ele.';return false;}
  if(caminhada.marca)cena.remove(caminhada.marca);
  var grupo=new THREE.Group();grupo.name='destino-caminhada';cena.add(grupo);caminhada.marca=grupo;
  function marca(geo,p){var mesh=new THREE.Mesh(geo,materialRota);mesh.position.set(p.x,0.045,p.z);grupo.add(mesh);return mesh;}
  marca(geoCirculo,destino);
  var anterior=rota.length>1?rota[rota.length-2]:{x:FP.x,z:FP.z};
  var dx=destino.x-anterior.x,dz=destino.z-anterior.z,L=Math.hypot(dx,dz)||1;
  var seta=marca(geoSeta,{x:destino.x-dx/L*0.32,z:destino.z-dz/L*0.32});seta.rotation.y=Math.atan2(-dx,-dz);
  var a={x:FP.x,z:FP.z};
  rota.forEach(function(b){var d=Math.hypot(b.x-a.x,b.z-a.z);for(var t=0.25;t<d-0.22;t+=0.28)marca(geoBolinha,{x:a.x+(b.x-a.x)*t/d,z:a.z+(b.z-a.z)*t/d});a=b;});
  caminhada.rota=rota;caminhada.indice=0;
  document.getElementById('dica').textContent='Indo até o círculo · arraste para olhar · controles de movimento para parar';
  return true;
}
function passoAutomatico(dt) {
  if(!caminhada.rota.length)return;
  var alvo=caminhada.rota[caminhada.indice],dx=alvo.x-FP.x,dz=alvo.z-FP.z,d=Math.hypot(dx,dz),passo=Math.min(d,1.4*Math.min(0.05,dt));
  var novo={x:FP.x+dx/(d||1)*passo,z:FP.z+dz/(d||1)*passo};
  if(!trechoLivre({x:FP.x,z:FP.z},novo)){cancelaCaminhada();return;}
  FP.x=novo.x;FP.z=novo.z;
  if(d<=passo+0.001 && ++caminhada.indice>=caminhada.rota.length){cancelaCaminhada();document.getElementById('dica').textContent=DICAS.visita;}
}
function destinoNaTela(e) {
  var r=cv.getBoundingClientRect(),raio=new THREE.Raycaster();
  raio.setFromCamera(new THREE.Vector2((e.clientX-r.left)/r.width*2-1,1-(e.clientY-r.top)/r.height*2),cam);
  planta3d.updateMatrixWorld(true);
  var hits=raio.intersectObject(planta3d,true);
  // O primeiro objeto precisa ser piso: nao escolher destinos atraves de paredes ou moveis.
  if(hits.length && hits[0].point.y<0.13 && hits[0].face && hits[0].face.normal.y>0.8)
    iniciaCaminhada({x:hits[0].point.x,z:hits[0].point.z});
}
(function duploToque(){
  var atual=null,ultimo=null,ativos=new Set();
  cv.addEventListener('pointerdown',function(e){
    if(modo!=='visita'||e.button!==0)return;
    ativos.add(e.pointerId);
    if(ativos.size>1){atual=null;ultimo=null;return;}
    atual={id:e.pointerId,x:e.clientX,y:e.clientY,t:performance.now(),arrastou:false};
  });
  cv.addEventListener('pointermove',function(e){
    if(atual && atual.id===e.pointerId && Math.hypot(e.clientX-atual.x,e.clientY-atual.y)>8){atual.arrastou=true;ultimo=null;}
  });
  cv.addEventListener('pointerup',function(e){
    ativos.delete(e.pointerId);
    if(!atual||atual.id!==e.pointerId)return;
    var a=atual;atual=null;var agora=performance.now();
    if(modo!=='visita'||a.arrastou||agora-a.t>300){ultimo=null;return;}
    if(ultimo && agora-ultimo.t<350 && Math.hypot(e.clientX-ultimo.x,e.clientY-ultimo.y)<24){ultimo=null;destinoNaTela(e);}
    else ultimo={x:e.clientX,y:e.clientY,t:agora};
  });
  cv.addEventListener('pointercancel',function(e){ativos.delete(e.pointerId);atual=null;ultimo=null;});
})();

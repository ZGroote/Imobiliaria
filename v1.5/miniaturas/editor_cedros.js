/* Editor experimental apenas do Cedros. Reutiliza catalogo e regras do renderizador. */
var editorCedros=(function(){
  var estado={on:false,moveis:[],sel:-1,acao:null,tipo:null,grade:null,caixa:null,iniciado:false},historico=[],padrao=null,recolhidaAntes=false;
  var chave='miniaturas:cedros:moveis:v1';
  var style=document.createElement('style');style.textContent=`
    #botaoMoveis{position:absolute;top:10px;right:10px;z-index:8;padding:8px 14px;min-height:40px;background:#202b32;border:1px solid #52605e;border-radius:8px;color:#e7ebf0;cursor:pointer;flex:none}
    #botaoMoveis[aria-pressed=true]{border-color:#5fc777;color:#bff3d2}
    #editorMoveis{max-height:260px;overflow:auto;overscroll-behavior:contain;margin-top:8px;padding-top:8px;border-top:1px solid var(--line);font-size:12px;flex:1 1 auto;min-height:0}
    #editorMoveis button,#editorMoveis select,#editorMoveis input{font:inherit;color:var(--txt);background:#202b32;border:1px solid #52605e;border-radius:6px;min-height:36px;padding:6px;min-width:0}
    #editorMoveis button{cursor:pointer}#editorMoveis button:disabled{opacity:.4;cursor:default}
    #editorMoveis .linha{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px;align-items:center}
    #editorMoveis select{flex:1}#editorMoveis .medidas{display:grid;grid-template-columns:repeat(3,minmax(190px,1fr));gap:12px;margin-bottom:8px;overflow-x:auto}
    #editorMoveis label{display:flex;align-items:center;gap:8px}#editorMoveis input{width:100%}
    #editorMoveis .medidas label{display:grid;grid-template-columns:auto minmax(60px,1fr);align-items:center;gap:6px;white-space:nowrap}
    #editorMoveis .campoCor{display:grid;grid-template-columns:118px minmax(0,1fr);align-items:center;gap:8px}
    #editorMoveis .selecao{flex-wrap:nowrap;overflow-x:auto}
    #editorMoveis .selecao>label{flex:0 0 auto}
    #editorMoveis .selecao select{min-width:110px}
    #editorMoveis .selecao button{flex:none;white-space:nowrap}
    #editorMoveis .campoCor{margin-bottom:8px}
    #editorMoveis .linha>label{flex:0 0 118px}
    #editorMoveis [role=status]:empty{display:none}
    #editorMoveis [role=status]{color:#b9c5cf;line-height:1.5;margin:6px 0}
    body.editandoMoveis #ficha{max-height:65dvh;display:flex;flex-direction:column;min-height:0}
    body.editandoMoveis #modos{flex:none}body.editandoMoveis #alternarFicha{flex:none}
    @media(max-width:640px){#editorMoveis{max-height:240px}#editorMoveis button{min-height:44px}}
  `;document.head.appendChild(style);
  var botao=document.createElement('button');botao.id='botaoMoveis';botao.type='button';botao.textContent='Móveis';botao.setAttribute('aria-pressed','false');botao.setAttribute('aria-controls','editorMoveis');
  document.getElementById('cena').appendChild(botao);botao.hidden=modo!=='planta3d';
  var painel=document.createElement('section');painel.id='editorMoveis';painel.hidden=true;painel.setAttribute('aria-label','Editor de móveis');document.getElementById('modos').after(painel);
  painel.innerHTML=`<div class="linha"><label for="catalogoMovel">Adicionar</label><select id="catalogoMovel"><option value="">Escolha um móvel</option></select><button id="adicionaMovel">Posicionar</button></div>
  <div class="linha selecao"><label for="listaMoveis">Selecionar</label><select id="listaMoveis"><option value="">Clique em um móvel</option></select><button id="moveMovel" disabled>Mover</button><button id="giraMovel" disabled>Girar 90°</button><button id="excluiMovel" disabled>Excluir</button></div>
  <div id="ajustesMovel" hidden>
  <div class="medidas"><label>Largura (m)<input id="movelW" type="number" min="0.2" max="3.5" step="0.05"></label><label>Profundidade (m)<input id="movelD" type="number" min="0.2" max="3.5" step="0.05"></label><label>Altura (m)<input id="movelH" type="number" min="0.04" max="2.6" step="0.02"></label></div>
  <label class="campoCor">Cor<input id="corMovel" type="color"></label></div>
  <div class="linha"><button id="cancelaMovel" hidden>Cancelar ajuste</button><button id="desfazMovel">Desfazer</button><button id="restauraMoveis">Restaurar original</button><button id="fechaMoveis">Concluir</button></div>
  <p id="statusMoveis" role="status" aria-live="polite">Selecione um móvel na planta ou na lista. Grade de 10 cm. Alterações ficam neste navegador.</p>`;
  var $=id=>document.getElementById(id),status=texto=>{$('statusMoveis').textContent=texto;};
  FURN.MOVEL_KEYS.forEach(function(k){var o=document.createElement('option');o.value=k;o.textContent=FURN.MOVEIS[k].nome;$('catalogoMovel').appendChild(o);});
  function dados(){return estado.moveis.map(m=>({tipo:m.tipo,u:m.u,v:m.v,rot:m.rot,w:m.w,h:m.h,d:m.d,cor:m.cor}));}
  function guarda(){obstaculosMoveis=null;cancelaCaminhada();try{localStorage.setItem(chave,JSON.stringify(dados()));}catch(e){status('Alterações aplicadas nesta sessão; o navegador não permitiu salvar.');}}
  function registra(){historico.push(dados());if(historico.length>30)historico.shift();}
  function tira(obj){planta3d.remove(obj);obj.traverse(o=>{if(o.geometry)o.geometry.dispose();});}
  function constroi(m){
    var def=FURN.MOVEIS[m.tipo],obj=FURN.geoDoMovel(def,m.cor,m),p=PL_R.W(m.u,m.v);
    obj.position.set(p[0],0.03,p[1]);if(!def.param)obj.scale.set(m.w/def.b[0],m.h/def.b[1],m.d/def.b[2]);
    obj.rotation.y=Math.atan2(-PL_R.ob.uz,PL_R.ob.ux)+m.rot*Math.PI/2;
    obj.userData.movel=true;obj.userData.registroMovel=m;m.obj=obj;planta3d.add(obj);return obj;
  }
  function refaz(m){if(m.obj)tira(m.obj);constroi(m);obstaculosMoveis=null;pinta();if(estado.acao)criaHolograma();}
  function carrega(lista){estado.moveis.forEach(m=>tira(m.obj));estado.moveis=lista.map(m=>Object.assign({},m));estado.moveis.forEach(constroi);estado.sel=-1;estado.acao=null;estado.tipo=null;obstaculosMoveis=null;pinta();}
  function pinta(){
    if(!estado.acao)limpaHolograma();
    var lista=$('listaMoveis');lista.innerHTML='<option value="">Clique em um móvel</option>';
    estado.moveis.forEach(function(m,i){var o=document.createElement('option');o.value=i;o.textContent=(i+1)+'. '+FURN.MOVEIS[m.tipo].nome;lista.appendChild(o);});
    lista.value=estado.sel<0?'':String(estado.sel);var m=estado.moveis[estado.sel];$('ajustesMovel').hidden=!m;['moveMovel','giraMovel','excluiMovel'].forEach(id=>{$(id).disabled=!m;});
    if(m){$('movelW').value=m.w.toFixed(2);$('movelD').value=m.d.toFixed(2);$('movelH').value=m.h.toFixed(2);$('corMovel').value='#'+Number(m.cor).toString(16).padStart(6,'0');}
    if(estado.caixa){cena.remove(estado.caixa);estado.caixa.geometry.dispose();estado.caixa.material.dispose();estado.caixa=null;}
    if(m&&estado.on){m.obj.updateWorldMatrix(true,true);estado.caixa=new THREE.BoxHelper(m.obj,0x5fc777);cena.add(estado.caixa);}
    $('cancelaMovel').hidden=!estado.acao;$('desfazMovel').disabled=!historico.length;
  }
  var regras=FurnitureEditor.create({THREE:THREE,INT:{get pl(){return PL_R;},get moveis(){return estado.moveis;}},MOB:{passo:0.1},MOVEIS:FURN.MOVEIS,ESP:ESP,
    dentroDaPlanta:function(pl,x,z){return dentroDaPlanta(x-pl.ob.cx,z-pl.ob.cz);}});
  function cabe(m){
    if(!regras.cabeAqui(m,m.u,m.v))return false;
    // Testa a area toda contra as paredes, nao apenas os quatro cantos.
    var p=PL_R.W(m.u,m.v),a=Math.atan2(-PL_R.ob.uz,PL_R.ob.ux)+m.rot*Math.PI/2,c=Math.cos(a),s=Math.sin(a);
    for(var x=-m.w/2;x<=m.w/2+0.001;x+=Math.min(0.08,m.w/4))for(var z=-m.d/2;z<=m.d/2+0.001;z+=Math.min(0.08,m.d/4)){
      var wx=p[0]+x*c+z*s-PL_R.ob.cx,wz=p[1]-x*s+z*c-PL_R.ob.cz;
      if(folga(wx,wz)<ESP/2-0.005)return false;
    }
    return true;
  }
  function seleciona(i){estado.sel=i;estado.acao=i>=0?'mover':null;estado.tipo=null;pinta();if(i>=0)criaHolograma();}
  function altera(campo,valor){
    var m=estado.moveis[estado.sel];if(!m)return;
    if(!Number.isFinite(valor)){pinta();return;}
    var antigo=m[campo];m[campo]=valor;
    var valido=campo==='cor'||cabe(m);m[campo]=antigo;
    if(!valido){status('Esse ajuste invade uma parede, outro móvel ou sai da planta.');pinta();return;}
    registra();m[campo]=valor;refaz(m);guarda();status('Móvel atualizado.');
  }
  function inicia(){
    if(estado.iniciado)return;montaPlanta3D();
    estado.moveis=planta3d.children.filter(o=>o.userData.registroMovel).map(o=>Object.assign({},o.userData.registroMovel,{obj:o}));
    estado.moveis.forEach(m=>{var d=FURN.MOVEIS[m.tipo];m.cor=m.cor==null?d.cor:m.cor;m.rot=m.rot||0;});padrao=dados();estado.iniciado=true;
    try{var saved=JSON.parse(localStorage.getItem(chave)||'null');if(Array.isArray(saved)&&saved.length<150&&saved.every(m=>FURN.MOVEIS[m.tipo]&&['u','v','rot','w','h','d','cor'].every(k=>Number.isFinite(m[k]))&&m.w>0&&m.d>0&&m.h>0))carrega(saved);}catch(e){}
    // Recorta cada linha da grade pela uniao dos contornos da planta.
    var polys=PL_R.contorno.map(poly=>poly.map(p=>{var x=p[0]-PL_R.ob.cx,z=p[1]-PL_R.ob.cz;return [x*PL_R.ob.ux+z*PL_R.ob.uz,-x*PL_R.ob.uz+z*PL_R.ob.ux];}));
    var vertices=[];
    for(var eixo=0;eixo<2;eixo++){
      var coords=polys.flat().map(p=>p[eixo]),min=Math.min(...coords),max=Math.max(...coords);
      for(var k=Math.ceil(min*10);k<=Math.floor(max*10);k++){
        var valor=k/10,intervalos=[];
        polys.forEach(poly=>{var cortes=[];for(var i=0;i<poly.length;i++){var a=poly[i],b=poly[(i+1)%poly.length];if((a[eixo]<=valor&&b[eixo]>valor)||(b[eixo]<=valor&&a[eixo]>valor))cortes.push(a[1-eixo]+(valor-a[eixo])/(b[eixo]-a[eixo])*(b[1-eixo]-a[1-eixo]));}
          cortes.sort((a,b)=>a-b);for(var i=0;i+1<cortes.length;i+=2)intervalos.push([cortes[i],cortes[i+1]]);
        });
        intervalos.sort((a,b)=>a[0]-b[0]);var uniao=[];
        intervalos.forEach(ab=>{var prev=uniao[uniao.length-1];if(prev&&ab[0]<=prev[1]+0.0001)prev[1]=Math.max(prev[1],ab[1]);else uniao.push(ab.slice());});
        uniao.forEach(ab=>ab.forEach(v=>vertices.push(eixo===0?valor:v,0,eixo===0?v:valor)));
      }
    }
    var geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
    estado.grade=new THREE.LineSegments(geo,new THREE.LineBasicMaterial({color:0x5fc777,transparent:true,opacity:0.25,depthWrite:false,toneMapped:false}));
    estado.grade.name='grade-moveis';estado.grade.raycast=function(){};
    estado.grade.position.set(PL_R.ob.cx,0.026,PL_R.ob.cz);estado.grade.rotation.y=Math.atan2(-PL_R.ob.uz,PL_R.ob.ux);planta3d.add(estado.grade);estado.grade.visible=false;
  }
  function abrir(){inicia();if(modo!=='planta3d')vaiPara('planta3d');cancelaCaminhada();recolhidaAntes=document.body.classList.contains('ficha-recolhida');if(!recolhidaAntes)$('alternarFicha').click();estado.on=true;estado.grade.visible=true;painel.hidden=false;document.body.classList.add('editandoMoveis');botao.setAttribute('aria-pressed','true');pinta();redim();}
  function fechar(restaurar){estado.on=false;estado.acao=null;estado.tipo=null;if(estado.grade)estado.grade.visible=false;painel.hidden=true;document.body.classList.remove('editandoMoveis');botao.setAttribute('aria-pressed','false');pinta();if(restaurar!==false&&!recolhidaAntes&&document.body.classList.contains('ficha-recolhida'))$('alternarFicha').click();redim();}
  botao.onclick=()=>estado.on?fechar():abrir();$('fechaMoveis').onclick=()=>fechar();
  $('listaMoveis').onchange=e=>seleciona(e.target.value===''?-1:Number(e.target.value));
  $('adicionaMovel').onclick=function(){var tipo=$('catalogoMovel').value;if(!tipo){status('Escolha um tipo de móvel.');return;}estado.tipo=tipo;estado.acao='adicionar';estado.sel=-1;pinta();criaHolograma();status('Prévia: mova o mouse ou arraste no chão e solte para colocar. Vermelho = não cabe.');};
  $('catalogoMovel').onchange=function(){if(this.value)$('adicionaMovel').click();else{estado.acao=null;estado.tipo=null;pinta();}};
  $('moveMovel').onclick=function(){estado.acao='mover';pinta();criaHolograma();status('Clique ou toque no novo lugar. O móvel só muda quando o destino couber.');};
  $('cancelaMovel').onclick=()=>{estado.acao=null;estado.tipo=null;pinta();status('Ajuste cancelado.');};
  $('giraMovel').onclick=()=>{var m=estado.moveis[estado.sel];if(m)altera('rot',(m.rot+1)%4);};
  ['w','d','h'].forEach(k=>{$('movel'+k.toUpperCase()).onchange=e=>altera(k,Math.max(k==='h'?0.04:0.2,Math.min(k==='h'?PL_R.pd:3.5,Number(e.target.value))));});
  $('corMovel').onchange=e=>altera('cor',parseInt(e.target.value.slice(1),16));
  $('excluiMovel').onclick=function(){var m=estado.moveis[estado.sel];if(!m)return;registra();tira(m.obj);estado.moveis.splice(estado.sel,1);seleciona(-1);guarda();status('Móvel excluído. Use Desfazer para recuperar.');};
  $('desfazMovel').onclick=function(){if(!historico.length)return;carrega(historico.pop());guarda();status('Última alteração desfeita.');};
  $('restauraMoveis').onclick=function(){registra();carrega(padrao);guarda();status('Layout original restaurado.');};
  function limpaHolograma(){
    if(!estado.holograma)return;planta3d.remove(estado.holograma);
    estado.holograma.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.isMesh)o.material.dispose();});estado.holograma=null;estado.previa=null;
  }
  function criaHolograma(){
    limpaHolograma();var m=estado.moveis[estado.sel],novo=estado.acao==='adicionar';
    if(novo){var d=FURN.MOVEIS[estado.tipo];m={tipo:estado.tipo,u:0,v:0,rot:0,w:d.b[0],h:d.b[1],d:d.b[2],cor:d.cor};}
    if(!m)return;estado.previa=Object.assign({},m);delete estado.previa.obj;
    var obj=FURN.geoDoMovel(FURN.MOVEIS[m.tipo],m.cor,m),def=FURN.MOVEIS[m.tipo];
    if(!def.param)obj.scale.set(m.w/def.b[0],m.h/def.b[1],m.d/def.b[2]);
    obj.rotation.y=Math.atan2(-PL_R.ob.uz,PL_R.ob.ux)+m.rot*Math.PI/2;
    obj.name='holograma-movel';obj.traverse(o=>{o.raycast=function(){};if(o.isMesh){o.material=new THREE.MeshBasicMaterial({color:0x70e4bc,transparent:true,opacity:0.48,depthWrite:false,depthTest:false});o.renderOrder=8;o.castShadow=false;o.receiveShadow=false;}});
    estado.holograma=obj;planta3d.add(obj);atualizaPrevia(m.u,m.v);
    if(novo){var b=cv.getBoundingClientRect();seguePonteiro({clientX:b.left+b.width/2,clientY:b.top+b.height/2});}
  }
  function atualizaPrevia(u,v){
    var p=estado.previa;if(!p)return;p.u=u;p.v=v;
    var original=estado.acao==='mover'?estado.moveis[estado.sel]:p,antigo={u:original.u,v:original.v};original.u=u;original.v=v;
    estado.previaValida=cabe(original);original.u=antigo.u;original.v=antigo.v;
    var w=PL_R.W(u,v);estado.holograma.position.set(w[0],0.035,w[1]);
    estado.holograma.traverse(o=>{if(o.isMesh)o.material.color.setHex(estado.previaValida?0x70e4bc:0xef7373);});
  }
  function seguePonteiro(e){
    var p=new THREE.Vector3();if(!raio(e).ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),-0.02),p))return;
    planta3d.worldToLocal(p);var x=p.x-PL_R.ob.cx,z=p.z-PL_R.ob.cz;
    atualizaPrevia(Math.round((x*PL_R.ob.ux+z*PL_R.ob.uz)*10)/10,Math.round((-x*PL_R.ob.uz+z*PL_R.ob.ux)*10)/10);
  }
  var inicio=null;
  function raio(e){var b=cv.getBoundingClientRect(),r=new THREE.Raycaster();r.setFromCamera(new THREE.Vector2((e.clientX-b.left)/b.width*2-1,1-(e.clientY-b.top)/b.height*2),cam);planta3d.updateMatrixWorld(true);return r;}
  function atingido(e){var hits=raio(e).intersectObjects(estado.moveis.map(m=>m.obj),true);if(!hits.length)return -1;var obj=hits[0].object;while(obj&&!obj.userData.movel)obj=obj.parent;return estado.moveis.findIndex(m=>m.obj===obj);}
  cv.addEventListener('pointerdown',function(e){if(!estado.on||e.button!==0)return;var i=atingido(e);if(estado.acao||i>=0){inicio={id:e.pointerId,x:e.clientX,y:e.clientY,i:i};if(estado.acao)seguePonteiro(e);if(estado.acao)e.stopImmediatePropagation();try{cv.setPointerCapture(e.pointerId);}catch(err){}}},true);
  cv.addEventListener('pointermove',function(e){if(estado.on&&estado.acao){seguePonteiro(e);e.stopImmediatePropagation();}},true);
  cv.addEventListener('pointerup',function(e){
    if(!inicio||inicio.id!==e.pointerId)return;var ini=inicio;inicio=null;if(estado.acao)e.stopImmediatePropagation();else solta(e);
    if(!estado.acao&&Math.hypot(e.clientX-ini.x,e.clientY-ini.y)>10)return;
    if(!estado.acao){seleciona(ini.i);return;}
    var p=new THREE.Vector3(),r=raio(e);if(!r.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),-0.02),p))return;
    planta3d.worldToLocal(p);var x=p.x-PL_R.ob.cx,z=p.z-PL_R.ob.cz;
    var u=Math.round((x*PL_R.ob.ux+z*PL_R.ob.uz)*10)/10,v=Math.round((-x*PL_R.ob.uz+z*PL_R.ob.ux)*10)/10;
    var m=estado.moveis[estado.sel],novo=estado.acao==='adicionar';
    if(novo){var d=FURN.MOVEIS[estado.tipo];m={tipo:estado.tipo,u:u,v:v,rot:0,w:d.b[0],h:d.b[1],d:d.b[2],cor:d.cor};}
    var antigo={u:m.u,v:m.v};m.u=u;m.v=v;var valido=cabe(m);m.u=antigo.u;m.v=antigo.v;
    if(!valido){status('Não cabe nesse ponto. Escolha um lugar livre dentro da planta.');return;}
    registra();m.u=u;m.v=v;
    if(novo){estado.moveis.push(m);constroi(m);estado.sel=estado.moveis.length-1;}else refaz(m);
    estado.acao=null;estado.tipo=null;pinta();guarda();status('');
  },true);
  cv.addEventListener('pointercancel',()=>{inicio=null;},true);
  function navegar(){estado.acao=null;estado.tipo=null;pinta();}
  function sincronizaModo(){botao.hidden=modo!=='planta3d';if(estado.on&&modo!=='planta3d')fechar(false);}
  return {navegar:navegar,sincronizaModo:sincronizaModo,estado:estado,abrir:abrir,fechar:fechar,seleciona:seleciona,altera:altera,cabe:cabe};
})();

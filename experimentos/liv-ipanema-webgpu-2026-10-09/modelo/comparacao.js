const stage=document.querySelector('#stage'),message=document.querySelector('#message');
const status=document.querySelector('#status'),view=document.querySelector('#view');
const parameters=new URLSearchParams(location.search);
const backend=parameters.get('backend')||'auto';
let frame=null,api=null,revision=0,model='contorno',disposed=false;
const controls=[...document.querySelectorAll('[data-model]')];

function applyView(){
  if(!api)return;
  if(view.value!=='implantacao'){api.setView(view.value);return;}
  // Enquadramento da torre, para que os recortes possam ser inspecionados.
  const camera={...api.data.views.implantacao,left:-40,right:40,top:26,bottom:-26,
    position:[-.0004,450,0],target:[0,50,0]};
  api.restoreState({view:'livre',floor:-1,selectedUnitId:null,camera});
}

function release(){
  const previous=api||frame?.contentWindow?.__livProva;
  previous?.dispose?.();api=null;
  frame?.remove();frame=null;
}

function failure(error){
  status.textContent=String(error.message||error);
  message.textContent='Não foi possível carregar este volume. Tente o volume original ou volte à prévia completa.';
  message.hidden=false;
  controls.forEach(button=>button.disabled=false);
}

async function show(next){
  if(disposed)return;
  const operation=++revision;
  release();model=next;
  controls.forEach(button=>{button.disabled=true;button.setAttribute('aria-pressed',String(button.dataset.model===model));});
  status.textContent=model==='contorno'?'Carregando o contorno com recuos…':'Carregando o volume original…';
  message.hidden=false;message.textContent=status.textContent;
  const url=new URL('../prova-rgbm.html',import.meta.url);
  url.searchParams.set('embed','1');url.searchParams.set('backend',backend);
  url.searchParams.set('geometria',model);
  url.searchParams.set('acabamento',model==='base'?'referencia':'base');
  const current=document.createElement('iframe');
  current.title=model==='contorno'?'Maquete com recuos em estudo':'Maquete com volume original';
  current.src=url.href;frame=current;stage.append(current);
  // A troca sempre encerra o renderer anterior antes de carregar o próximo.
  const deadline=performance.now()+180000;
  while(!disposed&&operation===revision){
    const proof=current.contentWindow?.__livProva;
    if(proof?.error)throw Error(proof.error);
    if(proof?.ready){
      api=proof;applyView();message.hidden=true;
      status.textContent=`${model==='contorno'?'Contorno com recuos':'Volume original'} carregado. Arraste para girar.`;
      controls.forEach(button=>button.disabled=false);return;
    }
    if(performance.now()>deadline)throw Error('O carregamento excedeu o tempo de espera.');
    await new Promise(resolve=>setTimeout(resolve,150));
  }
}

controls.forEach(button=>button.addEventListener('click',()=>{
  if(button.dataset.model!==model)show(button.dataset.model).catch(failure);
}));
view.addEventListener('change',applyView);
window.__livContourStudy={get frame(){return frame;},get api(){return api;},get model(){return model;},
  show,getState:()=>({model,view:view.value,ready:!!api?.ready,frames:stage.querySelectorAll('iframe').length}),
  dispose(){if(disposed)return;disposed=true;revision++;release();}};
window.addEventListener('pagehide',()=>window.__livContourStudy.dispose(),{once:true});
show('contorno').catch(failure);

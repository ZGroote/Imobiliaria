/* Busca local dos POIs já carregados. Nenhuma consulta ou recurso de rede. */
(function(root){
  'use strict';
  const PAGE=20;
  const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').trim();
  const distanceLabel=meters=>meters<1000?Math.round(meters).toLocaleString('pt-BR')+' m':
    (meters/1000).toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1})+' km';
  function createCatalog(raw,center,radius=5000){
    return raw.map((p,id)=>({...p,id,distance:Math.hypot(p.x-center[0],p.z-center[1])}))
      .filter(p=>Number.isFinite(p.distance)&&p.distance<=radius&&typeof p.n==='string'&&p.n.trim())
      .sort((a,b)=>a.distance-b.distance||a.n.localeCompare(b.n,'pt-BR')||a.id-b.id);
  }
  function filterCatalog(records,category,query){
    const term=normalize(query);
    return records.filter(p=>(!category||p.c===category)&&(!term||normalize(p.n).includes(term)));
  }
  const css=`
  #livProximos{position:fixed;z-index:65;left:12px;top:var(--liv-header-bottom,88px);width:320px;max-width:calc(100vw - 24px);max-height:calc(100dvh - var(--liv-header-bottom,88px) - 12px);border:1px solid #ffffff30;border-radius:10px;background:#14212ef5;color:#eef3f8;font:14px/1.4 system-ui;box-sizing:border-box;display:flex;flex-direction:column;overflow:hidden}
  #livProximos *{box-sizing:border-box}#livProximos button,#livProximos input,#livProximos select{font:inherit;color:inherit}
  #livProximos button{min-height:44px;border:1px solid #ffffff30;border-radius:6px;background:#263b47;cursor:pointer;padding:8px 12px}
  #livProximos button:hover{background:#344b58}#livProximos :focus-visible{outline:2px solid #ffcf75;outline-offset:2px}
  #livProximos .liv-near-heading{display:flex;align-items:center;gap:8px;padding:8px 12px;border-bottom:1px solid #ffffff25;flex:none}
  #livProximos h1{font-size:16px;line-height:1.3;margin:0;flex:1;font-weight:650}#livProximosToggle{font-size:12px!important;padding:4px 8px!important;flex:0 0 auto!important;width:auto!important}
  #livProximosBody{padding:12px;display:flex;flex-direction:column;gap:8px;min-height:0;max-height:560px;overflow:auto}
  #livProximosBody[hidden],#livProximos [hidden]{display:none!important}#livProximos p{margin:0}
  #livProximos .liv-near-note,#livProximosStatus,#livProximosSelection{font-size:12px;color:#c8d4de}
  #livProximos label{font-size:12px;display:block;font-weight:600;margin-bottom:4px}
  #livProximos input,#livProximos select{display:block!important;width:100%;min-height:44px;background:#0c1924;border:1px solid #ffffff40;border-radius:6px;padding:8px 10px;opacity:1!important;visibility:visible!important}
  #livProximos input::placeholder{color:#a7b8c6}#livProximos form{display:grid;gap:8px;margin:0;flex:none}
  #livProximos .liv-near-actions{display:flex;gap:8px}#livProximos .liv-near-actions button{flex:1;font-size:12px}
  #livProximosList{list-style:none;padding:0;margin:0;overflow:auto;overscroll-behavior:contain;min-height:72px;max-height:320px;flex:1;scrollbar-width:thin}
  #livProximosList li+li{margin-top:6px}#livProximosList button{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:4px 8px;width:100%;text-align:left;background:#1b2d3a;padding:9px 10px}
  #livProximosList button[aria-pressed=true]{border-color:#ffcf75;background:#344638}#livProximosList .liv-near-name{font-weight:600;overflow-wrap:anywhere}
  #livProximosList .liv-near-distance{font-size:12px;white-space:nowrap;color:#ffcf75}#livProximosList .liv-near-detail{grid-column:1/-1;font-size:12px;color:#c8d4de;overflow-wrap:anywhere}
  #livProximosEmpty{padding:12px 0;font-size:13px}#livProximosMore{flex:none;font-size:12px!important}
  @media(max-width:680px){#livProximos{top:auto!important;left:12px;right:12px;bottom:max(12px,env(safe-area-inset-bottom));width:auto;max-height:min(52dvh,460px)}#livProximosBody{padding:8px 12px;gap:6px}#livProximosList{min-height:56px}#livProximos form{grid-template-columns:1fr 1fr;gap:8px}#livProximos .liv-near-note{font-size:11px}}
  @media(max-width:680px) and (max-height:650px){body.livProximosOpen #minimapa{display:none!important}#livProximos{max-height:calc(100dvh - var(--liv-header-bottom,110px) - 12px)}}
  `;
  let starting=false;
  function start(){
    if(starting||typeof document==='undefined'||document.getElementById('livProximos'))return;
    starting=true;let attempts=0;
    function ready(){
      const bridge=root.__int?.nearby,map=root.__livMapa;
      if(!bridge||!map){if(++attempts<300)setTimeout(ready,100);else starting=false;return;}
      mount(bridge,map);starting=false;
    }
    ready();
  }
  function mount(bridge,map){
    if(document.getElementById('livProximos'))return;
    const records=createCatalog(bridge.catalog(),map.centro,Math.min(map.raio||5000,5000)),categories=bridge.categories;
    const counts={};for(const p of records)counts[p.c]=(counts[p.c]||0)+1;
    const label=key=>categories[key]?.lbl||key.replace(/_/g,' ');
    const style=document.createElement('style');style.id='livProximosStyle';style.textContent=css;document.head.appendChild(style);
    const panel=document.createElement('section');panel.id='livProximos';panel.setAttribute('aria-labelledby','livProximosTitle');
    panel.innerHTML=`<div class="liv-near-heading"><h1 id="livProximosTitle">O que tem por perto?</h1><button id="livProximosToggle" type="button" aria-expanded="true" aria-controls="livProximosBody">Recolher</button></div>
      <div id="livProximosBody"><p class="liv-near-note">Até 5 km do LIV Ipanema. Distâncias em linha reta.</p>
      <form role="search" aria-label="Buscar locais próximos"><div><label for="livProximosCategory">Categoria</label><select id="livProximosCategory"></select></div><div><label for="livProximosQuery">Nome do local</label><input id="livProximosQuery" type="search" placeholder="Ex.: farmácia" autocomplete="off"></div></form>
      <div class="liv-near-actions"><button id="livProximosAll" type="button">Todas no mapa</button><button id="livProximosClear" type="button">Limpar filtros</button></div>
      <p id="livProximosStatus" role="status" aria-live="polite" aria-atomic="true"></p><p id="livProximosSelection" role="status" hidden></p>
      <ul id="livProximosList" aria-label="Locais por distância do LIV"></ul><p id="livProximosEmpty" hidden>Nenhum local encontrado. Tente outra categoria ou limpe o nome.</p><button id="livProximosMore" type="button" hidden>Mostrar mais</button></div>`;
    document.body.appendChild(panel);document.body.classList.add('livProximosOpen');
    const el=id=>document.getElementById('livProximos'+id),select=el('Category'),query=el('Query'),list=el('List'),status=el('Status'),selection=el('Selection'),more=el('More'),toggle=el('Toggle');
    const option=(key,title,parent)=>{const o=document.createElement('option');o.value=key;o.textContent=title;parent.appendChild(o);};
    option('','Todas as categorias ('+records.length+')',select);
    const groups=[['Saúde',['upa','hospital','unimed','ubs','farmacia']],['Compras e alimentação',['supermercado','atacado','mercado','comida','cafebar','padaria','loja']],['Serviços e educação',['banco','escola','posto','publico','servico']],['Lazer e outros',['academia','turismo','igreja','hotel']]];
    const grouped=new Set();
    for(const [title,keys] of groups){const group=document.createElement('optgroup');group.label=title;for(const key of keys)if(counts[key]){option(key,label(key)+' ('+counts[key]+')',group);grouped.add(key);}if(group.children.length)select.appendChild(group);}
    for(const key of Object.keys(counts).filter(k=>!grouped.has(k)).sort())option(key,label(key)+' ('+counts[key]+')',select);
    const state={limit:PAGE,selected:null,expanded:true};
    function measure(){const bar=document.getElementById('livMapaBar');if(bar)document.documentElement.style.setProperty('--liv-header-bottom',Math.ceil(bar.getBoundingClientRect().bottom+12)+'px');}
    function render(){
      const results=filterCatalog(records,select.value,query.value),scroll=list.scrollTop;list.replaceChildren();
      status.textContent=results.length+' '+(results.length===1?'local encontrado':'locais encontrados')+' · mais próximos primeiro';
      el('Empty').hidden=results.length>0;more.hidden=results.length<=state.limit;
      for(const p of results.slice(0,state.limit)){
        const item=document.createElement('li'),button=document.createElement('button');button.type='button';button.dataset.poiId=p.id;button.setAttribute('aria-pressed',String(state.selected===p.id));
        const name=document.createElement('span');name.className='liv-near-name';name.textContent=p.n;
        const distance=document.createElement('span');distance.className='liv-near-distance';distance.textContent=distanceLabel(p.distance);
        const detail=document.createElement('span');detail.className='liv-near-detail';detail.textContent=label(p.c)+(p.a?' · '+p.a:'');button.append(name,distance,detail);
        button.setAttribute('aria-label',p.n+', '+label(p.c)+', a '+distanceLabel(p.distance)+' do LIV. Mostrar no mapa.');
        button.addEventListener('click',()=>{
          bridge.filter([p.c]);if(bridge.select(p.id)===false)return;
          state.selected=p.id;for(const b of list.querySelectorAll('button'))b.setAttribute('aria-pressed',String(Number(b.dataset.poiId)===p.id));
          selection.hidden=false;selection.textContent=p.n+' destacado no mapa · '+distanceLabel(p.distance)+' do LIV';updateDiagnostics(results.length);
        });item.appendChild(button);list.appendChild(item);
      }
      list.scrollTop=scroll;updateDiagnostics(results.length);
    }
    function updateDiagnostics(total){root.__livNearby={ready:true,center:map.centro.slice(),radius:5000,catalogCount:records.length,categoryCount:Object.keys(counts).length,total,shown:Math.min(total,state.limit),selectedId:state.selected,category:select.value,query:query.value,expanded:state.expanded};}
    function reset(){select.value='';query.value='';state.limit=PAGE;state.selected=null;selection.hidden=true;bridge.clear();render();}
    select.addEventListener('change',()=>{state.limit=PAGE;state.selected=null;selection.hidden=true;bridge.filter(select.value?[select.value]:[]);render();});
    query.addEventListener('input',()=>{state.limit=PAGE;state.selected=null;selection.hidden=true;bridge.clear();render();});
    panel.querySelector('form').addEventListener('submit',event=>{event.preventDefault();list.querySelector('button')?.click();});
    more.addEventListener('click',()=>{state.limit+=PAGE;render();});el('Clear').addEventListener('click',reset);
    el('All').addEventListener('click',()=>{reset();bridge.filter(Object.keys(counts));});
    function expand(on){state.expanded=on;el('Body').hidden=!on;toggle.textContent=on?'Recolher':'Explorar';toggle.setAttribute('aria-expanded',String(on));document.body.classList.toggle('livProximosOpen',on);measure();if(root.__livNearby)root.__livNearby.expanded=on;}
    toggle.addEventListener('click',()=>expand(!state.expanded));
    panel.addEventListener('keydown',event=>{if(event.key==='Escape'){expand(false);toggle.focus();}event.stopPropagation();});
    panel.addEventListener('pointerdown',event=>event.stopPropagation());panel.addEventListener('wheel',event=>event.stopPropagation(),{passive:true});
    root.addEventListener('resize',measure);const bar=document.getElementById('livMapaBar');if(bar&&root.ResizeObserver)new ResizeObserver(measure).observe(bar);
    bridge.clear();render();measure();
  }
  root.LivNearby={start,createCatalog,filterCatalog,distanceLabel};
  if(typeof document!=='undefined')start();
})(globalThis);

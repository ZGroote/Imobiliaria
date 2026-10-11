import {floorLabel,floorOf} from './catalogo-unidades.js';
export function createBuildingMirror(catalog,onSelect){
  const root=document.getElementById('buildingMirror'),body=document.getElementById('mirrorRows');
  const filter=document.getElementById('mirrorFloor'),buttons=[],rows=[];root.hidden=false;
  for(let floor=16;floor>=0;floor--){
    filter.add(new Option(floorLabel(floor),String(floor)));
    const row=document.createElement('tr'),heading=document.createElement('th');heading.scope='row';heading.textContent=floor===0?'Térreo':`${floor}º`;
    row.append(heading);rows.push({floor,row});
    for(const unit of catalog.units.filter(unit=>floorOf(catalog,unit)===floor)){
      const cell=document.createElement('td'),button=document.createElement('button');
      button.type='button';button.textContent=unit.final;button.dataset.mirrorUnitId=unit.id;
      button.setAttribute('aria-label',`Final ${unit.final}, ${floorLabel(floor)}, posição aproximada, disponibilidade não informada`);
      button.setAttribute('aria-pressed','false');button.tabIndex=-1;
      button.addEventListener('click',()=>onSelect(unit.id));cell.append(button);row.append(cell);
      buttons.push({button,floor});
    }
    body.append(row);
  }
  let state={ready:false,mode:'maquete',selectedUnitId:null};
  function update(next=state){
    state=next;let first=null,selected=null,visible=0;
    for(const {row,floor} of rows){row.hidden=filter.value!=='todos'&&Number(filter.value)!==floor;if(!row.hidden)visible+=10;}
    for(const {button} of buttons){
      const active=button.dataset.mirrorUnitId===state.selectedUnitId;
      button.setAttribute('aria-pressed',String(active));button.disabled=!state.ready||state.mode!=='maquete';
      button.tabIndex=-1;if(!button.closest('tr').hidden){first??=button;if(active)selected=button;}
    }
    if(selected||first)(selected||first).tabIndex=0;
    document.getElementById('mirrorCount').textContent=`${visible} posições exibidas · disponibilidade não informada`;
  }
  filter.addEventListener('change',()=>update());
  body.addEventListener('keydown',event=>{
    const visible=buttons.map(item=>item.button).filter(button=>!button.closest('tr').hidden&&!button.disabled);
    const index=visible.indexOf(event.target);if(index<0)return;
    const deltas={ArrowLeft:-1,ArrowRight:1,ArrowUp:-10,ArrowDown:10};let target;
    if(Object.hasOwn(deltas,event.key))target=index+deltas[event.key];
    else if(event.key==='Home')target=index-index%10;
    else if(event.key==='End')target=index-index%10+9;
    else return;
    event.preventDefault();target=Math.max(0,Math.min(visible.length-1,target));
    for(const button of visible)button.tabIndex=-1;visible[target].tabIndex=0;visible[target].focus();
  });
  update();return {update};
}

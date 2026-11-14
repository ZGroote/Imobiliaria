import {floorLabel,floorOf} from './catalogo-unidades.js';
import {saleOf,saleLabel,AVAILABILITY} from './comercial.js';
export function createBuildingMirror(catalog,onSelect){
  const root=document.getElementById('buildingMirror'),body=document.getElementById('mirrorRows');
  const filter=document.getElementById('mirrorFloor'),buttons=[],rows=[];root.hidden=false;
  const availability=document.getElementById('mirrorAvailability');
  for(const [value,label] of Object.entries(AVAILABILITY))availability.add(new Option(label,value));
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
      buttons.push({button,floor,id:unit.id});
    }
    body.append(row);
  }
  let state={ready:false,mode:'maquete',selectedUnitId:null};
  function update(next=state){
    state=next;let first=null,selected=null,visible=0;
    const units=new Map(catalog.units.map(unit=>[unit.id,unit]));
    availability.disabled=!catalog.units.some(unit=>saleOf(unit).availability!=='nao_informada');
    for(const {button,floor,id} of buttons){
      const unit=units.get(id),sale=saleOf(unit);
      button.hidden=(filter.value!=='todos'&&Number(filter.value)!==floor)||
        (availability.value!=='todos'&&sale.availability!==availability.value);
      button.dataset.availability=sale.availability;
      button.setAttribute('aria-label',`Final ${unit.final}, ${floorLabel(floor)}, posição aproximada, ${saleLabel(unit)}`);
      if(!button.hidden)visible++;
    }
    for(const {row} of rows)row.hidden=!row.querySelector('button:not([hidden])');
    for(const {button} of buttons){
      const active=button.dataset.mirrorUnitId===state.selectedUnitId;
      button.setAttribute('aria-pressed',String(active));button.disabled=!state.ready||state.mode!=='maquete';
      button.tabIndex=-1;if(!button.hidden&&!button.closest('tr').hidden){first??=button;if(active)selected=button;}
    }
    if(selected||first)(selected||first).tabIndex=0;
    document.getElementById('mirrorCount').textContent=`${visible} posições exibidas · ${catalog.commercialSource?
      `tabela de ${catalog.commercialSource.asOf}`:'disponibilidade não informada'}`;
  }
  filter.addEventListener('change',()=>update());
  availability.addEventListener('change',()=>update());
  body.addEventListener('keydown',event=>{
    const visible=buttons.map(item=>item.button).filter(button=>!button.hidden&&!button.closest('tr').hidden&&!button.disabled);
    const index=visible.indexOf(event.target);if(index<0)return;
    const deltas={ArrowLeft:-1,ArrowRight:1};let target;
    if(Object.hasOwn(deltas,event.key))target=index+deltas[event.key];
    else if(['ArrowUp','ArrowDown'].includes(event.key)){
      const cell=event.target.closest('td'),row=cell.parentElement.rowIndex,sign=event.key==='ArrowUp'?-1:1;
      const candidates=visible.filter(button=>button.closest('td').cellIndex===cell.cellIndex&&
        (button.closest('tr').rowIndex-row)*sign>0);
      candidates.sort((a,b)=>Math.abs(a.closest('tr').rowIndex-row)-Math.abs(b.closest('tr').rowIndex-row));
      target=candidates.length?visible.indexOf(candidates[0]):index;
    }else if(event.key==='Home'||event.key==='End'){
      const row=visible.filter(button=>button.closest('tr')===event.target.closest('tr'));
      target=visible.indexOf(event.key==='Home'?row[0]:row.at(-1));
    }
    else return;
    event.preventDefault();target=Math.max(0,Math.min(visible.length-1,target));
    for(const button of visible)button.tabIndex=-1;visible[target].tabIndex=0;visible[target].focus();
  });
  update();return {update,setCatalog(data){catalog=data;update();}};
}

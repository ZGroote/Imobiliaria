import {solarState,normalizeHour,formatHour} from './horario-solar.js';
const $=id=>document.getElementById(id);
const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR');
const status=$('map-status');
function element(tag,text){const node=document.createElement(tag);node.textContent=text;return node;}

async function start(){
  if(!window.maplibregl)throw Error('Não foi possível carregar os controles do mapa. Recarregue a página.');
  const response=await fetch(new URL('./mapa-pois.json',import.meta.url));
  if(!response.ok)throw Error('Não foi possível carregar os pontos de interesse. Recarregue a página.');
  const data=await response.json();
  if(data.schema!=='liv-map-2d-v1'||data.property.id!=='vistas-da-quinze')throw Error('Mapa de outro empreendimento.');
  const focusId=new URLSearchParams(location.search).get('empreendimento')||'vistas-da-quinze';
  const property=data.properties.find(item=>item.id===focusId);
  if(!property)throw Error('Empreendimento não disponível neste mapa.');
  const {categories}=data;
  const initialZoom=Math.min(17.3,16.2+Math.log2(innerWidth/390));
  document.title=property.name+' — mapa do entorno';$('livMapaBar').querySelector('strong').textContent=property.name;$('center').textContent='Centralizar';
  $('satellite').setAttribute('aria-label','Mapa do entorno de '+property.name);
  const lngLat=[property.center[1],property.center[0]];
  const map=new maplibregl.Map({container:'satellite',center:lngLat,zoom:initialZoom,pitch:55,bearing:-20,maxPitch:75,minZoom:12,maxZoom:20,
    pixelRatio:Math.min(devicePixelRatio||1,2),maxTileCacheZoomLevels:3,
    canvasContextAttributes:{antialias:true},attributionControl:false,
    style:{version:8,sources:{satellite:{type:'raster',tiles:['https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],tileSize:256,maxzoom:18,attribution:'Imagens © Esri, Vantor, Earthstar Geographics e comunidade GIS'}},layers:[{id:'satellite',type:'raster',source:'satellite',paint:{'raster-fade-duration':0}}]}});
  map.addControl(new maplibregl.NavigationControl({visualizePitch:true}),'top-right');
  map.addControl(new maplibregl.AttributionControl({compact:false,customAttribution:data.imagery?'Área dos empreendimentos com tratamento visual por IA':[]}),'bottom-right');
  map.addControl(new maplibregl.ScaleControl({unit:'metric'}),'bottom-right');
  // Intercept only right-button drags; other map gestures keep their native handlers.
  const canvas=map.getCanvas();let rightDrag=null;
  function startRightDrag(event){
    if(event.button!==2)return;
    event.preventDefault();event.stopImmediatePropagation();map.stop();
    rightDrag={x:event.clientX,y:event.clientY};
  }
  function moveRightDrag(event){
    if(!rightDrag)return;
    if(!(event.buttons&2)){rightDrag=null;return;}
    const dx=event.clientX-rightDrag.x,dy=event.clientY-rightDrag.y;
    rightDrag={x:event.clientX,y:event.clientY};
    map.jumpTo({bearing:map.getBearing()-dx*.8,pitch:map.getPitch()-dy*.5});
    event.preventDefault();
  }
  function endRightDrag(){rightDrag=null;}
  const preventMenu=event=>event.preventDefault();
  canvas.addEventListener('mousedown',startRightDrag,true);canvas.addEventListener('contextmenu',preventMenu);
  window.addEventListener('mousemove',moveRightDrag);window.addEventListener('mouseup',endRightDrag);window.addEventListener('blur',endRightDrag);
  map.on('remove',()=>{canvas.removeEventListener('mousedown',startRightDrag,true);canvas.removeEventListener('contextmenu',preventMenu);window.removeEventListener('mousemove',moveRightDrag);window.removeEventListener('mouseup',endRightDrag);window.removeEventListener('blur',endRightDrag);});
  let imageryError=false,buildingError=null;
  function showMapStatus(){
    const message=buildingError||(imageryError?'Imagem de satélite indisponível. Confira sua conexão; os pontos continuam disponíveis.':'');
    status.textContent=message;status.hidden=!message;
  }
  map.on('error',event=>{if(event.sourceId==='satellite'){imageryError=true;showMapStatus();}});
  await new Promise(resolve=>map.once('load',resolve));
  const imageryLayers=['satellite'];
  if(data.imagery){
    const imageURL=new URL(data.imagery.url,import.meta.url);imageURL.searchParams.set('v',data.imagery.sha256);
    map.addSource('satellite-enhanced',{type:'image',url:imageURL.href,coordinates:data.imagery.coordinates});
    map.addLayer({id:'satellite-enhanced',type:'raster',source:'satellite-enhanced',paint:{'raster-fade-duration':0,
      'raster-opacity':['interpolate',['linear'],['zoom'],14,0,16,1]}});
    imageryLayers.push('satellite-enhanced');
    map.getCanvas().dataset.imagery='Tratamento visual por IA na área dos empreendimentos';
  }
  const popup=new maplibregl.Popup({maxWidth:'280px',focusAfterOpen:false});
  const label=element('button',property.name);label.className='liv-property';label.type='button';
  label.hidden=true;label.title='Abrir maquete de '+property.name;
  const marker=new maplibregl.Marker({element:label,anchor:'bottom'}).setLngLat(lngLat).addTo(map);
  function openProperty(id=property.id){
    const record=data.properties.find(item=>item.id===id)||property;
    const body=element('div','');body.append(element('h2',record.name),element('p','Explore o empreendimento e suas plantas.'));
    const open=element('a','Abrir maquete');open.href=record.viewer;open.target='_top';
    if(record.id===property.id)open.dataset.mapReturn='true';body.append(open);
    popup.setLngLat([record.center[1],record.center[0]]).setDOMContent(body).addTo(map);
  }
  label.addEventListener('click',()=>openProperty());
  function distance(a,b){const rad=Math.PI/180,dlat=(b[0]-a[0])*rad,dlon=(b[1]-a[1])*rad,h=Math.sin(dlat/2)**2+Math.cos(a[0]*rad)*Math.cos(b[0]*rad)*Math.sin(dlon/2)**2;return 12742000*Math.asin(Math.min(1,Math.sqrt(h)));}
  const points=data.pois.map((poi,id)=>({...poi,id,distance:distance(property.center,[poi.lat,poi.lon])}))
    .filter(poi=>Number.isFinite(poi.distance)&&poi.distance<=5000)
    .sort((a,b)=>a.distance-b.distance||a.n.localeCompare(b.n,'pt-BR'));
  const counts={};
  for(const poi of points)counts[poi.c]=(counts[poi.c]||0)+1;
  for(const [key,category] of Object.entries(categories)){
    const option=element('option',`${category.label} (${counts[key]||0})`);option.value=key;$('category').append(option);
  }
  function card(poi){
    const body=element('div','');body.append(element('h2',poi.n),element('p',categories[poi.c].label));
    if(poi.a)body.append(element('p',poi.a));
    if(poi.h)body.append(element('p',`Horários: ${poi.h}`));
    if(poi.t)body.append(element('p',`Telefone: ${poi.t}`));
    if(poi.w){try{const url=new URL(poi.w);if(['http:','https:'].includes(url.protocol)){const link=element('a','Site do local');link.href=url.href;link.target='_blank';link.rel='noopener noreferrer';body.append(link);}}catch{}}
    body.append(element('p',`${(poi.distance/1000).toLocaleString('pt-BR',{maximumFractionDigits:1})} km do empreendimento em linha reta`));
    return body;
  }
  let enabled=true,limit=20,selected=null,active=true,disposed=false;
  function matches(){return points.filter(p=>(!$('category').value||p.c===$('category').value)&&normalize(p.n).includes(normalize($('search').value).trim()));}
  map.addSource('pois',{type:'geojson',data:{type:'FeatureCollection',features:[]}});
  map.addLayer({id:'pois',type:'circle',source:'pois',paint:{'circle-radius':7,'circle-color':['get','color'],'circle-stroke-color':'#fff','circle-stroke-width':2}});
  function renderPins(){
    map.getSource('pois').setData({type:'FeatureCollection',features:enabled?matches().map(p=>({type:'Feature',geometry:{type:'Point',coordinates:[p.lon,p.lat]},properties:{id:p.id,color:categories[p.c].color}})):[]});
    $('pins').textContent=enabled?'Pings ligados':'Pings desligados';$('pins').setAttribute('aria-pressed',String(enabled));
  }
  function openPoi(poi){popup.setLngLat([poi.lon,poi.lat]).setDOMContent(card(poi)).addTo(map);}
  map.on('click','pois',event=>{const poi=points.find(p=>p.id===event.features[0].properties.id);if(poi)openPoi(poi);});
  map.on('mouseenter','pois',()=>map.getCanvas().style.cursor='pointer');map.on('mouseleave','pois',()=>map.getCanvas().style.cursor='');
  function renderList(){
    const found=matches();$('count').textContent=`${found.length} locais em até 5 km do empreendimento`;
    $('results').replaceChildren();
    for(const poi of found.slice(0,limit)){
      const li=element('li',''),button=element('button',poi.n);button.type='button';
      button.append(element('small',`${categories[poi.c].label} · ${(poi.distance/1000).toLocaleString('pt-BR',{maximumFractionDigits:1})} km`));
      button.addEventListener('click',()=>{
        selected=poi.id;enabled=true;renderPins();map.jumpTo({center:[poi.lon,poi.lat],zoom:17});openPoi(poi);
        setPanel(false);diagnostics();
      });li.append(button);$('results').append(li);
    }
    if(!found.length)$('results').append(element('li','Nenhum local encontrado. Tente outro nome ou categoria.'));
    $('more').hidden=found.length<=limit;diagnostics();
  }
  function diagnostics(){window.__livNearby={ready:true,catalogCount:points.length,categoryCount:Object.keys(categories).length,total:matches().length,shown:Math.min(limit,matches().length),pins:enabled,selectedId:selected};}
  function setPanel(show){document.querySelector('.map-solar').hidden=show;$('nearby').hidden=!show;$('filters').setAttribute('aria-expanded',String(show));if(show)$('search').focus();}
  $('pins').addEventListener('click',()=>{enabled=!enabled;popup.remove();renderPins();diagnostics();});
  $('filters').addEventListener('click',()=>setPanel($('nearby').hidden));
  $('close-filters').addEventListener('click',()=>{setPanel(false);$('filters').focus();});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!$('nearby').hidden){setPanel(false);$('filters').focus();}});
  for(const id of ['search','category'])$(id).addEventListener(id==='search'?'input':'change',()=>{limit=20;popup.remove();renderPins();renderList();});
  $('more').addEventListener('click',()=>{limit+=20;renderList();});
  $('center').addEventListener('click',()=>{popup.remove();map.jumpTo({center:lngLat,zoom:initialZoom,pitch:55,bearing:-20});});
  renderPins();renderList();status.hidden=true;
  status.hidden=false;status.textContent='Carregando empreendimento 3D…';
  let building=null;
  try {
    const {attachBuilding}=await import('./mapa-edificio.bundle.js?v='+data.rendererSHA256);
    const edition=new URLSearchParams(location.search).get('geometria')||'entrada';
    const properties=data.properties.map(record=>({...record,asset:record.models[record.id===property.id?edition:'entrada']||record.models.entrada||record.models.base}));
    building=await attachBuilding({map,center:property.center,properties,focusId:property.id,onSelect:openProperty,onLabelPosition(point){
      const base=map.project(lngLat);marker.setOffset([point.x-base.x,point.y-base.y]);label.hidden=!point.visible;
    }});
    showMapStatus();
  } catch(error) {buildingError=error.message+' Use o marcador para abrir a maquete.';showMapStatus();}
  const query=new URLSearchParams(location.search);
  let hour=normalizeHour(query.get('hora'),6.5),date;
  try{date=solarState(hour,query.has('data')?{date:query.get('data')}:{}).date;}catch{date=solarState(hour).date;}
  function setTime(hourValue,dateValue=date){
    const solar=solarState(normalizeHour(hourValue,hour),{date:dateValue,latitude:property.center[0],longitude:property.center[1]});hour=solar.hour;date=solar.date;
    building?.setSolar(solar);
    for(const layer of imageryLayers){
      map.setPaintProperty(layer,'raster-brightness-max',.18+.82*solar.daylight);
      map.setPaintProperty(layer,'raster-saturation',-.35*solar.night);
    }
    map.setSky({'sky-color':solar.daylight>.5?'#78a8d2':'#071020','horizon-color':solar.daylight>.5?'#e0e9e9':'#26334d','fog-color':solar.daylight>.5?'#cbdfe7':'#0e1728','sky-horizon-blend':.5});
    $('map-hour').value=String(hour);$('map-hour-value').textContent=formatHour(hour);$('map-date').value=date;
    const params=new URLSearchParams(location.search);params.set('hora',String(hour));params.set('data',date);history.replaceState(null,'',location.pathname+'?'+params);
    window.__livMapSolar=solar;window.parent.postMessage({type:'liv-map-solar',hour,date},location.origin);
    return solar;
  }
  $('map-hour').addEventListener('input',()=>setTime(Number($('map-hour').value)));
  $('map-date').addEventListener('change',()=>{try{setTime(hour,$('map-date').value);}catch{$('map-date').value=date;}});
  $('view-angle').addEventListener('click',()=>{map.jumpTo({pitch:map.getPitch()>10?0:55});$('view-angle').textContent=map.getPitch()>10?'Vista de cima':'Visão 3D';});
  setTime(hour);
  window.__livMap2D={ready:true,building,setTime,propertyId:property.id,map,marker,points,categories,
    setActive(value){if(disposed||typeof value!=='boolean')return false;active=value;building?.setActive(value);if(active)map.resize();return true;},
    dispose(){if(disposed)return;disposed=true;this.ready=false;building?.dispose();map.remove();},
    get active(){return active;}};
  window.__livMap2DLoaded=true;
}
start().catch(error=>{status.hidden=false;status.textContent=error.message;window.__livMap2DError=error.message;});

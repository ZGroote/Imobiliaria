import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {constrainPlanView,zoomPlanView} from './planta2d.js';
import {createFrameScheduler} from './frame-scheduler.js';

test('zoom preserva o ponto sob o cursor e limita a planta às bordas da experiência',()=>{
  const area={width:1000,height:700},image={width:1600,height:1000};
  assert.deepEqual(zoomPlanView({scale:1,x:0,y:0},2,{x:100,y:50},area,image),{scale:2,x:-100,y:-50});
  assert.deepEqual(constrainPlanView({scale:2,x:5000,y:-5000},area,image),{scale:2,x:500,y:-275});
  assert.deepEqual(constrainPlanView({scale:.5,x:30,y:30},area,image),{scale:1,x:0,y:0});
  assert.equal(constrainPlanView({scale:50,x:0,y:0},area,image).scale,6);
  const portrait={width:320,height:560};
  assert.deepEqual(constrainPlanView({scale:1,x:50,y:50},portrait,image),{scale:1,x:0,y:0});
});

function planHarness(){
  class Element {
    constructor(tag='div'){
      this.tagName=tag.toUpperCase();this.listeners=new Map();this.dataset={};this.attributes={};this.children=[];this.pointers=new Set();
      this.hidden=false;this.disabled=false;this.className='';
      this.style={setProperty:(key,value)=>{this.style[key]=value;},getPropertyValue:key=>this.style[key]||''};
    }
    addEventListener(type,fn){const list=this.listeners.get(type)||[];list.push(fn);this.listeners.set(type,list);}
    removeEventListener(type,fn){this.listeners.set(type,(this.listeners.get(type)||[]).filter(item=>item!==fn));}
    fire(type,event={}){let prevented=false;for(const fn of this.listeners.get(type)||[])fn({preventDefault(){prevented=true;},...event});return prevented;}
    setAttribute(key,value){this.attributes[key]=String(value);if(key==='class')this.className=String(value);}
    getAttribute(key){return this.attributes[key]??null;}
    append(...children){for(const child of children){this.children.push(child);child.parent=this;}}
    appendChild(child){this.append(child);return child;}
    querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
    querySelectorAll(selector){
      const matches=node=>selector.startsWith('.')?node.className.split(/\s+/).includes(selector.slice(1)):node.tagName===selector.toUpperCase();
      return this.children.flatMap(child=>[...(matches(child)?[child]:[]),...child.querySelectorAll(selector)]);
    }
    focus(options){this.focused=true;this.focusOptions=options;}
    remove(){if(this.parent)this.parent.children=this.parent.children.filter(child=>child!==this);}
    getBoundingClientRect(){return {width:1000,height:700,left:0,top:0};}
    setPointerCapture(id){this.pointers.add(id);}hasPointerCapture(id){return this.pointers.has(id);}releasePointerCapture(id){this.pointers.delete(id);}
  }
  const images=[],observers=[],controls={in:new Element(),out:new Element(),reset:new Element(),value:new Element(),measurements:new Element('button'),measurementsNote:new Element()},stage=new Element();
  controls.measurements.hidden=true;controls.measurementsNote.hidden=true;
  const context=vm.createContext({document:{createElement:tag=>new Element(tag)},
    Image:class extends Element {constructor(){super('img');this.naturalWidth=1600;this.naturalHeight=1000;images.push(this);}decode(){return Promise.resolve();}},
    ResizeObserver:class {constructor(callback){this.callback=callback;observers.push(this);}observe(){}disconnect(){}notify(){this.callback();}}});
  vm.runInContext(readFileSync(new URL('./planta2d.js',import.meta.url),'utf8').replaceAll('export function','function'),context);
  return {plans:context.createPlan2D(stage,controls),stage,controls,images,observers};
}

test('arrastar a planta captura o ponteiro sem iniciar seleção ou arraste nativos',async()=>{
  const {plans,stage,images}=planHarness();await plans.prepare('canto',{image:'canto.jpg',imageAlt:'Canto'});plans.show('canto');
  const layer=stage.children[0];
  assert.equal(images[0].draggable,false);
  assert.equal(layer.fire('pointerdown',{button:0,pointerId:1,clientX:500,clientY:350}),true);
  assert.equal(layer.hasPointerCapture(1),true);assert.equal(layer.focused,true);assert.equal(layer.focusOptions.preventScroll,true);
  assert.equal(layer.fire('selectstart'),true);assert.equal(layer.fire('dragstart'),true);
  assert.equal(layer.fire('pointerdown',{button:2,pointerId:2,clientX:500,clientY:350}),false);
  assert.equal(layer.hasPointerCapture(2),false);
  plans.hide();assert.equal(layer.hasPointerCapture(1),false);
  assert.equal(layer.fire('pointerdown',{button:0,pointerId:3,clientX:500,clientY:350}),false);
  plans.dispose();assert.equal(layer.fire('selectstart'),false);assert.equal(layer.fire('dragstart'),false);
});

test('botões, roda, teclado, arraste e pinça ampliam a mesma planta e centralizar restaura',async()=>{
  const {plans,stage,controls}=planHarness();await plans.prepare('canto',{image:'canto.jpg',imageAlt:'Canto'});plans.show('canto');
  const layer=stage.children[0];controls.in.fire('click');assert.equal(controls.value.textContent,'125%');
  controls.reset.fire('click');assert.equal(layer.fire('wheel',{deltaY:-150,deltaMode:0,clientX:500,clientY:350}),true);
  assert.equal(controls.value.textContent,'135%');layer.fire('keydown',{key:'Home'});
  layer.fire('pointerdown',{button:0,pointerId:1,clientX:450,clientY:350});
  layer.fire('pointerdown',{button:0,pointerId:2,clientX:550,clientY:350});
  layer.fire('pointermove',{pointerId:2,clientX:650,clientY:350});
  assert.equal(layer.dataset.scale,'2');assert.equal(plans.getState().plans.canto.x,50);
  layer.fire('pointerup',{pointerId:1});layer.fire('pointerup',{pointerId:2});
  layer.fire('pointerdown',{button:0,pointerId:3,clientX:500,clientY:350});
  layer.fire('pointermove',{pointerId:3,clientX:5000,clientY:5000});
  assert.equal(plans.getState().plans.canto.x,500);assert.equal(plans.getState().plans.canto.y,275);
  plans.hide();assert.equal(layer.hasPointerCapture(3),false);
  plans.show('canto');controls.reset.fire('click');layer.fire('keydown',{key:'+'});layer.fire('keydown',{key:'ArrowRight'});
  assert.equal(plans.getState().plans.canto.x,-32);
  for(let i=0;i<20;i++)controls.in.fire('click');assert.equal(controls.value.textContent,'600%');assert.equal(controls.in.disabled,true);
  controls.reset.fire('click');assert.equal(controls.out.disabled,true);assert.equal(controls.value.textContent,'100%');
  plans.dispose();assert.equal(stage.children.length,0);assert.equal(controls.in.listeners.get('click').length,0);
});

test('duas chamadas de preparação decodificam a imagem uma vez e mantêm zoom separado',async()=>{
  const {plans,controls,images}=planHarness();
  const spec={image:'canto.jpg',imageAlt:'Canto'},a=plans.prepare('canto',spec),b=plans.prepare('canto',spec);
  assert.equal(a,b);await a;await plans.prepare('meio',{image:'meio.jpg',imageAlt:'Meio'});
  plans.show('canto');controls.in.fire('click');plans.show('meio');assert.equal(controls.value.textContent,'100%');
  plans.show('canto');assert.equal(controls.value.textContent,'125%');assert.equal(images.length,2);plans.dispose();
});

const measuredPlan=(image,name)=>({image,imageAlt:name,measurements:[{name,x:.25,y:.6,widthMm:3200,depthMm:2550}]});

test('medidas começam discretas e a escolha de exibição acompanha as duas plantas',async()=>{
  const {plans,stage,controls}=planHarness();
  await plans.prepare('canto',measuredPlan('canto.jpg','Sala'));
  await plans.prepare('meio',measuredPlan('meio.jpg','Quarto'));
  const [canto,meio]=stage.children,overlay=canto.querySelector('.plan2d-measurements');
  assert.equal(plans.getState().measurementsVisible,false);assert.equal(controls.measurements.hidden,true);
  plans.show('canto');assert.equal(controls.measurements.hidden,false);assert.equal(controls.measurements.getAttribute('aria-pressed'),'false');
  assert.equal(overlay.hidden,true);assert.equal(controls.measurementsNote.hidden,true);
  assert.equal(overlay.children[0].children[0].textContent,'Sala');
  assert.equal(overlay.children[0].children[1].textContent,'≈ 3,20 × 2,55 m');
  controls.measurements.fire('click');assert.equal(plans.getState().measurementsVisible,true);assert.equal(overlay.hidden,false);
  assert.equal(controls.measurements.getAttribute('aria-pressed'),'true');assert.equal(controls.measurementsNote.hidden,false);
  plans.hide();assert.equal(controls.measurements.hidden,true);assert.equal(controls.measurementsNote.hidden,true);
  assert.equal(plans.getState().measurementsVisible,true);
  plans.show('meio');assert.equal(canto.hidden,true);assert.equal(meio.querySelector('.plan2d-measurements').hidden,false);
  assert.equal(controls.measurements.hidden,false);assert.equal(controls.measurementsNote.hidden,false);
  controls.measurements.fire('click');plans.show('canto');
  assert.equal(plans.getState().measurementsVisible,false);assert.equal(overlay.hidden,true);assert.equal(controls.measurementsNote.hidden,true);
  plans.dispose();assert.equal(controls.measurements.hidden,true);assert.equal(controls.measurements.listeners.get('click').length,0);
});

test('âncoras das medidas acompanham a imagem contida, a ampliação, o arraste e o novo espaço',async()=>{
  const {plans,stage,controls,observers}=planHarness();
  await plans.prepare('canto',measuredPlan('canto.jpg','Sala'));plans.show('canto');controls.measurements.fire('click');
  const layer=stage.children[0],overlay=layer.querySelector('.plan2d-measurements'),label=overlay.children[0];
  assert.equal(overlay.style.width,'1000px');assert.equal(overlay.style.height,'625px');
  assert.equal(overlay.style.left,'calc(50% + 0px)');assert.equal(overlay.style.top,'calc(50% + 0px)');
  assert.equal(label.style.left,'25%');assert.equal(label.style.top,'60%');
  plans.change(2);assert.equal(overlay.style.width,'2000px');assert.equal(overlay.style.height,'1250px');
  layer.fire('pointerdown',{button:0,pointerId:1,clientX:500,clientY:350});
  layer.fire('pointermove',{pointerId:1,clientX:620,clientY:410});layer.fire('pointerup',{pointerId:1});
  assert.equal(overlay.style.left,'calc(50% + 120px)');assert.equal(overlay.style.top,'calc(50% + 60px)');
  assert.equal(label.style.left,'25%');assert.equal(label.style.top,'60%');
  plans.reset();stage.getBoundingClientRect=()=>({width:800,height:1000,left:0,top:0});observers[0].notify();
  assert.equal(overlay.style.width,'800px');assert.equal(overlay.style.height,'500px');
  assert.equal(overlay.style.left,'calc(50% + 0px)');assert.equal(overlay.style.top,'calc(50% + 0px)');
  assert.equal(overlay.hidden,false);plans.dispose();
});

test('uma planta sem dados de medidas oculta o botão e preserva a preferência das outras',async()=>{
  const {plans,controls}=planHarness();await plans.prepare('canto',measuredPlan('canto.jpg','Sala'));
  await plans.prepare('sem-medidas',{image:'sem-medidas.jpg',imageAlt:'Sem medidas'});
  plans.show('canto');controls.measurements.fire('click');plans.show('sem-medidas');
  assert.equal(controls.measurements.hidden,true);assert.equal(controls.measurementsNote.hidden,true);
  controls.measurements.fire('click');assert.equal(plans.getState().measurementsVisible,true);
  plans.show('canto');assert.equal(controls.measurements.hidden,false);assert.equal(controls.measurementsNote.hidden,false);plans.dispose();
});

function frameHarness(){
  const callbacks=new Map();let next=0;
  const target={requestAnimationFrame(fn){const id=++next;callbacks.set(id,fn);return id;},cancelAnimationFrame(id){callbacks.delete(id);}};
  return {target,callbacks,run(time){const batch=[...callbacks];callbacks.clear();for(const [,fn] of batch)fn(time);}};
}

test('mapa suspenso guarda callbacks sem renderizar e retoma o mesmo loop',()=>{
  const frames=frameHarness(),scheduler=createFrameScheduler(frames.target);let count=0;
  function render(){count++;frames.target.requestAnimationFrame(render);}
  frames.target.requestAnimationFrame(render);frames.run(16);assert.equal(count,1);
  scheduler.setActive(false);assert.equal(frames.callbacks.size,0);frames.run(32);assert.equal(count,1);
  scheduler.setActive(true);assert.equal(frames.callbacks.size,1);frames.run(48);assert.equal(count,2);
  scheduler.dispose();assert.equal(frames.callbacks.size,0);
});

test('cancelamento após retomar usa o identificador original e dispose restaura as APIs',()=>{
  const frames=frameHarness(),originalRequest=frames.target.requestAnimationFrame,originalCancel=frames.target.cancelAnimationFrame;
  const scheduler=createFrameScheduler(frames.target);let count=0;
  scheduler.setActive(false);const id=frames.target.requestAnimationFrame(()=>count++);
  assert.equal(frames.callbacks.size,0);scheduler.setActive(true);frames.target.cancelAnimationFrame(id);frames.run(16);assert.equal(count,0);
  scheduler.dispose();assert.equal(frames.target.requestAnimationFrame,originalRequest);assert.equal(frames.target.cancelAnimationFrame,originalCancel);
  frames.target.requestAnimationFrame(()=>count++);frames.run(32);assert.equal(count,1);
});

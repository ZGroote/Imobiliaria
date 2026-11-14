import assert from 'node:assert/strict';
import test from 'node:test';
import {translateDemoText, isEnglishDemo, installDemoI18n} from './demo-i18n.js';

test('English UI keeps the property identity, dimensions, keyboard shortcuts and BRL amounts', () => {
  const samples = [
    ['Vila Aurora — maquete interativa', 'Vila Aurora — interactive building model'],
    ['Maquete exterior do Vila Aurora', 'Exterior building model of Vila Aurora'],
    ['Apartamento 1201 · ficha', 'Apartment 1201 · details'],
    ['Disponível · R$\u00a0350.000,00', 'Available · R$\u00a0350.000,00'],
    ['Vila Aurora · São Carlos · 47,50 m² · ≈ 2,60 × 3,25 m', 'Vila Aurora · São Carlos · 47,50 m² · ≈ 2,60 × 3,25 m'],
    ['2 quartos (1 suíte) · 1 Vaga', '2 bedrooms (1 en suite) · 1 Parking space'],
    ['Fechar porta · Suíte (E)', 'Close door · Primary bedroom (E)'],
    ['Dormitório 01', 'Bedroom 01'],
    ['Banho suíte', 'En suite bathroom'],
    ['Banho', 'Bathroom'],
    ['Sala integrada', 'Living / dining room'],
    ['Varanda / serviço', 'Balcony / utility area'],
    ['Meio · 47,50 m² · ilustração aproximada', 'Middle · 47,50 m² · approximate illustration'],
    ['06:30, noite · luzes acesas', '06:30, night · lights on'],
    ['7 disponíveis em verde · 2 toques abrem a planta', '7 available in green · 2 taps open the floorplan'],
    ['1,23 m. Marque outros dois pontos para medir novamente. Medida aproximada.', '1,23 m. Mark two more points to measure again. Approximate measurement.'],
    ['  Ver planta 2D  ', '  View 2D floorplan  '],
  ];
  for (const [source, expected] of samples) {
    assert.equal(translateDemoText(source), expected, source);
    assert.equal(translateDemoText(expected), expected, 'An English label must be stable.');
  }
  assert.equal(translateDemoText('interiores/canto/unidade.json?v=1201'), 'interiores/canto/unidade.json?v=1201');
});

function browser() {
  const doc = {defaultView:{location:{search:'?lang=en'}}, observers:[], writes:0};
  const notify = record => {
    for (const observer of doc.observers) {
      if (!observer.active || record.type==='attributes'&&!observer.options.attributeFilter.includes(record.attributeName)) continue;
      observer.records.push(record);
      if (!observer.pending) {
        observer.pending=true;
        queueMicrotask(()=>{
          observer.pending=false;
          const records=observer.records.splice(0);
          if(records.length&&observer.active){observer.calls++;observer.callback(records);}
        });
      }
    }
  };
  class Text {
    constructor(value) {this.nodeType=3;this._value=value;}
    get nodeValue(){return this._value;}
    set nodeValue(value){if(value!==this._value){this._value=value;doc.writes++;notify({type:'characterData',target:this});}}
  }
  class Element {
    constructor(tag, attrs={}) {this.nodeType=1;this.tagName=tag.toUpperCase();this.attrs={...attrs};this.childNodes=[];}
    get lang(){return this.attrs.lang||'';}
    set lang(value){this.setAttribute('lang',value);}
    hasAttribute(name){return Object.hasOwn(this.attrs,name);}
    getAttribute(name){return this.attrs[name]??null;}
    setAttribute(name,value){if(this.attrs[name]!==value){this.attrs[name]=value;doc.writes++;notify({type:'attributes',target:this,attributeName:name});}}
    closest(selector){
      const matches=(el,s)=>s==='option:not([value])'?el.tagName==='OPTION'&&!el.hasAttribute('value'):
        s[0]==='.'?(el.attrs.class||'').split(' ').includes(s.slice(1)):
        s==='[translate="no"]'?el.attrs.translate==='no':s==='[data-i18n-skip]'?el.hasAttribute('data-i18n-skip'):el.tagName.toLowerCase()===s;
      for(let el=this;el;el=el.parentElement)if(selector.split(',').some(s=>matches(el,s)))return el;
      return null;
    }
    append(...children){for(const child of children){child.parentElement=this;this.childNodes.push(child);notify({type:'childList',target:this,addedNodes:[child]});}}
  }
  doc.defaultView.MutationObserver=class {
    constructor(callback){this.callback=callback;this.records=[];this.active=false;this.calls=0;doc.observers.push(this);}
    observe(target,options){this.active=true;this.options=options;}
    disconnect(){this.active=false;this.records.length=0;}
  };
  doc.documentElement=new Element('html',{lang:'pt-BR'});
  doc.make=(tag,attrs={},label)=>{const el=new Element(tag,attrs);if(label!==undefined)el.append(new Text(label));return el;};
  return doc;
}

test('only English documents activate translation; an explicit Portuguese query wins', () => {
  const doc=browser();
  assert.equal(isEnglishDemo(doc),true);
  assert.equal(isEnglishDemo(doc,{search:''}),false);
  assert.equal(installDemoI18n(doc,{search:'?lang=pt-BR'}),null);
  assert.equal(doc.observers.length,0);
  doc.documentElement.lang='en-GB';
  assert.equal(isEnglishDemo(doc,{search:''}),true);
  assert.equal(isEnglishDemo(doc,{search:'?lang=pt-BR'}),false);
});

test('initial and dynamic DOM labels translate without changing IDs, values, URLs or observing themselves', async () => {
  const doc=browser(), root=doc.documentElement;
  const button=doc.make('button',{id:'hostRoomGo','aria-label':'Ir ao ambiente selecionado','data-mode':'visita'},'Ir ↗');
  const option=doc.make('option',{value:'suite'},'Suíte');
  const implicit=doc.make('option',{},'Suíte');
  const slider=doc.make('input',{id:'livHour',value:'6.5','aria-valuetext':'06:30, noite · luzes acesas'});
  const ruler=doc.make('p',{'data-mobile':'Toque em dois pontos · Medida aproximada.'},'Marque o segundo ponto.');
  const proper=doc.make('p',{class:'project-name'},'Vila Aurora · Sala');
  const code=doc.make('script',{},'const label="Régua";');
  const frame=doc.make('iframe',{src:'interior.html?tipologia=canto&lang=en',title:'Planta e Tour do Vila Aurora · Canto'});
  root.append(button,option,implicit,slider,ruler,proper,code,frame);
  const api=installDemoI18n(doc);
  assert.equal(installDemoI18n(doc),api,'One observer per document.');
  assert.equal(button.childNodes[0].nodeValue,'Go ↗');
  assert.equal(button.getAttribute('aria-label'),'Go to the selected room');
  assert.equal(button.getAttribute('id'),'hostRoomGo');
  assert.equal(button.getAttribute('data-mode'),'visita');
  assert.equal(option.childNodes[0].nodeValue,'Primary bedroom');
  assert.equal(option.getAttribute('value'),'suite');
  assert.equal(implicit.childNodes[0].nodeValue,'Suíte','Implicit option values must remain unchanged.');
  assert.equal(slider.getAttribute('value'),'6.5');
  assert.equal(slider.getAttribute('aria-valuetext'),'06:30, night · lights on');
  assert.equal(ruler.getAttribute('data-mobile'),'Tap two points · Approximate measurement.');
  assert.equal(proper.childNodes[0].nodeValue,'Vila Aurora · Sala');
  assert.equal(code.childNodes[0].nodeValue,'const label="Régua";');
  assert.equal(frame.getAttribute('src'),'interior.html?tipologia=canto&lang=en');
  assert.equal(frame.getAttribute('title'),'Floorplan and walkthrough of Vila Aurora · Corner');
  button.childNodes[0].nodeValue='Centralizar';
  button.setAttribute('title','Mostrar medidas estimadas da planta 2D');
  const room=doc.make('option',{value:'sala'},'Sala integrada');root.append(room);
  await new Promise(setImmediate);
  assert.equal(button.childNodes[0].nodeValue,'Center view');
  assert.equal(button.getAttribute('title'),'Show estimated 2D floorplan measurements');
  assert.equal(room.childNodes[0].nodeValue,'Living / dining room');
  assert.equal(room.getAttribute('value'),'sala');
  assert.equal(doc.observers[0].calls,1,'Own translations cannot schedule another observer callback.');
  const writes=doc.writes;api.refresh();assert.equal(doc.writes,writes,'Repeated refresh is idempotent.');
  api.dispose();button.childNodes[0].nodeValue='Régua';await new Promise(setImmediate);
  assert.equal(button.childNodes[0].nodeValue,'Régua');
});

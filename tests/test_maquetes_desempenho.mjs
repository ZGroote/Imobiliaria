import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as THREE from '../experimentos/liv-experimental-2026-10-14/node_modules/three/build/three.webgpu.js';
import {MessageChannel} from 'node:worker_threads';
import {createHash} from 'node:crypto';

const runtimes=['liv-experimental-2026-10-14','laranjeiras-2026-10-30/site'];
for(const runtime of runtimes){
  const source=readFileSync(new URL(`../experimentos/${runtime}/interior-renderer.js`,import.meta.url),'utf8');
  test(`${runtime}: descarte concluído deixa de reter os buffers na coleção de recursos`,async()=>{
    const context=vm.createContext({});
    vm.runInContext(`const owned=new Set(),released=new WeakSet(),pendingDisposals=new Set();
      const state={ownership:{created:0,disposed:0}};
      ${source.slice(source.indexOf('function own('),source.indexOf('function closeBitmap('))}
      globalThis.api={own,release,owned,pendingDisposals,state};`,context);
    const {api}=context;let disposals=0;
    const geometry={array:new Float32Array(1024),dispose(){disposals++;}};
    api.own(geometry);assert.equal(api.owned.has(geometry),true);
    const pending=api.release(geometry);
    assert.equal(api.owned.has(geometry),true,'O recurso continua rastreado enquanto o descarte está pendente.');
    await pending;
    assert.equal(api.owned.has(geometry),false,'Geometria descartada não pode prender seus arrays no Set.');
    await api.release(geometry);assert.equal(disposals,1,'Não descartar duas vezes.');
    assert.equal(api.pendingDisposals.size,0);
  });

  test(`${runtime}: mover/redimensionar móvel não refaz rotas da navegação sem móveis`,()=>{
    let invalidations=0,routeBuilds=0,shadows=0,refreshes=0;
    const context=vm.createContext({
      navigation:{invalidate(){invalidations++;},free:()=>true},tourPosition:[0,0],
      stopRoute(){},layoutOriginal:()=>false,solarLighting:null,setBaked(){},
      state:{lighting:{bakedActive:false}},document:{querySelector:()=>({})},
      furnitureEditor:{refresh(){refreshes++;}},invalidateShadows(){shadows++;},
      refreshRooms(){routeBuilds++;},
    });
    vm.runInContext(source.slice(source.indexOf('function furnitureChanged('),source.indexOf('state.moveFurniture=')),context);
    vm.runInContext('furnitureChanged()',context);
    assert.equal(invalidations,0);assert.equal(routeBuilds,0);
    assert.equal(shadows,1,'A iluminação ainda acompanha o novo layout.');
    assert.equal(refreshes,1,'O editor continua refletindo a alteração.');
  });

  test(`${runtime}: consulta repetida reutiliza rotas e invalidação reabre passagem`,async()=>{
    const {createNavigation}=await import(`../experimentos/${runtime}/interior-navigation.js`);
    let collisionChecks=0;
    const layout={bounds:{x0:-2,x1:2,z0:-1,z1:1},joinery:[],walls:[{
      get y0(){collisionChecks++;return 0;},a:[0,-1],b:[0,1],
    }],rooms:[
      {id:'a',name:'Sala',cx:-1,cz:0,poly:[[-2,-1],[0,-1],[0,1],[-2,1]]},
      {id:'b',name:'Quarto',cx:1,cz:0,poly:[[0,-1],[2,-1],[2,1],[0,1]]},
    ]};
    const navigation=createNavigation(layout,()=>[],{step:.2});
    const first=navigation.routes([-1,0]);assert.equal(first[1].reachable,false);
    const before=collisionChecks;
    first[0].reachable=false;first[0].path.length=0;
    const again=navigation.routes([-1,0]);
    assert.equal(again[0].reachable,true,'O chamador não pode corromper o cache.');
    assert.ok(again[0].path.length>0);
    assert.equal(collisionChecks,before,'Consultar a mesma posição não repete a busca.');
    navigation.routes([-1,.1]);assert.ok(collisionChecks>before,'Posição nova pede outra busca.');
    layout.walls.length=0;navigation.invalidate();
    assert.equal(navigation.routes([-1,.1])[1].reachable,true,'Remover obstáculo e invalidar atualiza as rotas.');
  });

  test(`${runtime}: abertura prepara a hora e o contexto solicitados antes dos downloads`,async()=>{
    const begin=source.indexOf('async function start(){')+'async function start(){'.length;
    const prefix=source.slice(begin,source.indexOf("  progress('Preparando os gráficos",begin));
    const requested={side:'lazer',yaw:Math.PI,occluders:[{center:[1,2,3],size:[4,5,6],yaw:.2}]};
    const query=new URLSearchParams({hora:'6.5',data:'2026-10-31',contexto:JSON.stringify(requested)});
    const context=vm.createContext({query,typology:'canto',requested:'webgl',state:{mode:'planta3d'},timeOfDay:{hour:14},structuredClone,
      interiorTimeState:(hour,unit,options)=>({hour:Number(hour),context:unit,date:options.date}),
    });
    const result=await vm.runInContext(`(async()=>{${prefix};return timeOfDay})()`,context);
    assert.equal(result.hour,6.5);assert.equal(result.date,'2026-10-31');
    assert.equal(JSON.stringify(result.context),JSON.stringify(requested),'Preserva também as torres vizinhas.');
    assert.equal(context.state.timeOfDay.hour,6.5);
  });

  test(`${runtime}: dimensões compartilham vértices e descarte libera os dois materiais sem destruir o template`,async()=>{
    const improvementSource=readFileSync(new URL(`../experimentos/${runtime}/interior-melhorias.js`,import.meta.url),'utf8');
    const fitting=improvementSource.slice(improvementSource.indexOf('export function fitImprovedFurniture'),improvementSource.indexOf('export async function loadInteriorImprovements')).replace('export ','');
    const context=vm.createContext({THREE,positive:x=>Number.isFinite(x)&&x>0});
    vm.runInContext(fitting,context);
    const template=new THREE.Group(),geometry=new THREE.BoxGeometry(1,1,1),original=new THREE.MeshStandardMaterial();
    template.add(new THREE.Mesh(geometry,original));
    const group=context.fitImprovedFurniture(template,{id:'sofa',position:[0,0],rotation:0},{w:2,h:1,d:1});
    const mesh=group.children[0].children[0].children[0],native=mesh.material;
    assert.equal(mesh.geometry,geometry,'Escalar o grupo não precisa copiar vértices.');
    assert.notEqual(native,original,'Os materiais de instâncias seguem independentes.');
    const node=new THREE.MeshStandardMaterial();mesh.material=node;
    const resources=[],probeLit=[{mesh,originalMaterial:native,material:node}];
    Object.assign(context,{probeLit,framePromise:Promise.resolve(),release:x=>resources.push(x),group});
    vm.runInContext(source.slice(source.indexOf('function disposeEditedGroup('),source.indexOf('function resizeFurniture(')),context);
    vm.runInContext('disposeEditedGroup(group)',context);await new Promise(resolve=>setImmediate(resolve));
    assert.equal(probeLit.length,0);assert.ok(resources.includes(node));assert.ok(resources.includes(native));
    assert.ok(!resources.includes(geometry),'Outra instância ainda pode usar a geometria do template.');
    for(const material of new Set([original,native,node]))material.dispose();geometry.dispose();
  });

  test(`${runtime}: página fora do escopo comunica com o worker ativo sem esperar controle impossível`,async()=>{
    const url=new URL(`../experimentos/${runtime}/transfers.js`,import.meta.url);
    const worker={state:'activated',scriptURL:new URL('./transfer-worker.js',url).href,
      addEventListener(){},removeEventListener(){},postMessage(message,ports){
        assert.equal(message.type,'LIV_TRANSFER');
        ports[0].postMessage({ok:true,state:{enabled:true,paused:false,groups:{},workerInstance:'fixture',progressVersion:1}});
        ports[0].close();
      }};
    const events=new Map(),registration={active:worker,addEventListener(){}};
    const serviceWorker={controller:null,register:async()=>registration,addEventListener:(name,fn)=>events.set(name,fn),removeEventListener(){},getRegistrations:async()=>[]};
    const context=vm.createContext({URL,MessageChannel,isSecureContext:true,navigator:{serviceWorker},
      location:{href:'https://example.invalid/maquetes/liv/'},
      setTimeout:(fn,ms)=>setTimeout(fn,Math.min(ms,50)),clearTimeout,
    });context.window=context;
    const code=readFileSync(url,'utf8').replaceAll('import.meta.url',JSON.stringify(url.href)).replace('export const transfers=','const transfers=').replace('export function showTransferStatus','function showTransferStatus');
    vm.runInContext(code,context);
    assert.equal((await context.__livTransfers.start()).ok,true);
    assert.equal(context.__livTransfers.getState().enabled,true);
  });

  test(`${runtime}: texturas idênticas compartilham recurso sem misturar cores ou UVs diferentes`,async()=>{
    const code=readFileSync(new URL(`../experimentos/${runtime}/interior-melhorias.js`,import.meta.url),'utf8');
    const context=vm.createContext({sha256:async bytes=>createHash('sha256').update(new Uint8Array(bytes)).digest('hex')});
    vm.runInContext(code.slice(code.indexOf('async function shareEmbeddedTextures('),code.indexOf('function registerModel(')),context);
    const bytes=new ArrayBuffer(32);new DataView(bytes).setUint32(12,0,true);
    const metadata={images:[{bufferView:0}],bufferViews:[{buffer:0,byteOffset:0,byteLength:4}],textures:[{source:0}]};
    const shared=new Map(),outputs=[];
    for(let i=0;i<4;i++){
      const texture=new THREE.Texture({width:1,height:1});
      if(i===2)texture.colorSpace=THREE.SRGBColorSpace;
      if(i===3)texture.repeat.set(2,1);
      const scene=new THREE.Group(),material=new THREE.MeshStandardMaterial({map:texture});
      scene.add(new THREE.Mesh(new THREE.BoxGeometry(),material));
      await context.shareEmbeddedTextures({scene,parser:{associations:new Map([[texture,{textures:0}]])}},bytes,metadata,shared);
      outputs.push(material.map);scene.children[0].geometry.dispose();material.dispose();
    }
    assert.equal(outputs[0],outputs[1]);assert.notEqual(outputs[0],outputs[2]);assert.notEqual(outputs[0],outputs[3]);
    for(const texture of new Set(outputs))texture.dispose();
  });
}

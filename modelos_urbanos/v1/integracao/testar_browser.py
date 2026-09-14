import json, os, re, shutil, subprocess, sys, uuid
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3]
mode=sys.argv[1] if len(sys.argv)>1 else 'modelos'
sys.argv=sys.argv[:1]
sys.path.insert(0,str(ROOT))
from pipeline.foto import CHROME, servidor_de_espera
OUT=Path(__file__).resolve().parent
page=ROOT/'v16-moveis'/'sao-carlos-v16-moveis.html'
if mode=='ruas-antes': page=OUT/'antes'/'mapa-antes-profundidade.html'
if mode=='arvores-antes': page=OUT/'antes'/'mapa-antes-arvores-cruzamentos.html'
if mode=='colisao-antes': page=OUT/'antes'/'mapa-antes-colisao-ruas.html'
if mode=='proporcoes-antes': page=OUT/'antes'/'mapa-antes-proporcoes.html'
srv,port=servidor_de_espera()
probe=r'''
<script>
(function wait(n){
if(!window.__int||!__int.grupos().length){if(n)return setTimeout(()=>wait(n-1),300);console.log('URBAN_FAIL boot');return;}
const I=__int,P=__perf;const check=(v,msg)=>{if(!v)throw Error(msg);};
try {
I.target.set(50000,0,50000);P.setStreamRadius(450);P.passo(performance.now()+1000);
I.target.set(-525,0,-1598);I.sph.set(230,1.05,.6);
P.passo(performance.now()+2000);P.bombeia(100000);P.passo(performance.now()+3000);
const before=I.urban?.stats()||{enabled:false};
console.log('URBAN_STATS '+JSON.stringify(before));
const expected=new URLSearchParams(location.search).get('casas')!=='procedural';
check(before.enabled===expected,'mode');
if(expected){
check(before.instances>50,'no replacements');
check(before.models===74,'building library not active');
if (TEST_BUILDINGS) check(before.categories.predios>0,'no compatible buildings at test location');
const samples=JSON.stringify(I.urban.sample());
const mesh=I.scene.getObjectByName('urban-'+I.urban.sample()[0].id);
const s=mesh.userData.urbanPool.slots[0];check(I.registroDoHit({object:mesh,instanceId:0})===s.record,'picking');
const relief=document.getElementById('tRelief');relief.click();
const m=new THREE.Matrix4();mesh.getMatrixAt(0,m);check(Math.abs(m.elements[13]-s.base)<1e-3,'relief');
relief.click();mesh.getMatrixAt(0,m);check(m.elements[13]===0,'flat terrain');
I.target.set(50000,0,50000);P.passo(performance.now()+4000);P.bombeia(100000);P.passo(performance.now()+5000);
check(I.urban.stats().instances===0,'unload');
I.target.set(-525,0,-1598);P.passo(performance.now()+6000);P.bombeia(100000);P.passo(performance.now()+7000);
check(I.urban.stats().instances===before.instances,'reload count');
check(JSON.stringify(I.urban.sample())===samples,'stable model choices');
}
const image=new Image();image.onload=()=>{
if(TEST_COLLISION){
I.target.set(-805,0,-1979);I.sph.set(100,.65,.6);
}
if(TEST_TREES){
I.target.set(-680,0,-1650);I.sph.set(130,1.02,.6);
}
if(TEST_SIZE){
I.target.set(-680,0,-1650);I.sph.set(120,.4,.6);
const houses=[...I.vivos().values()].flatMap(r=>r.urban||[]).filter(s=>s.asset.category==='casas');
console.log('URBAN_SIZE '+JSON.stringify({houses:houses.length,lotFits:houses.filter(s=>s.lotFit).length,
minScale:Math.min(...houses.map(s=>s.scale)),meanEnvelope:houses.reduce((n,s)=>n+s.asset.size[0]*s.asset.size[2]*s.scale*s.scale,0)/houses.length}));
}
if(TEST_ROADS){
const roads=[...I.vivos().values()].flatMap(r=>r.roads||[]);
let best=null;
for(const w of roads)for(let i=1;i<w.pts.length;i++){
const a=w.pts[i-1],b=w.pts[i],dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz);
if(len<70)continue;
const x=(a[0]+b[0])/2,z=(a[1]+b[1])/2,d=Math.hypot(x+525,z+1598);
if(!best||d<best.d)best={x,z,d,theta:Math.atan2(dx,dz)+.45};
}
check(best,'road test segment');I.target.set(best.x,0,best.z);I.sph.set(24,1.32,best.theta);
document.getElementById('overlay').style.display='none';
}
if(TEST_BUILDINGS){
const building=I.urban.sample().find(s=>s.id.startsWith('predios-'));
I.target.set(building.x,0,building.z);I.sph.set(100,1.05,.6);
}
P.passo(performance.now()+8000);
if(TEST_COLLISION && I.roadClearance){
let bad=0,instances=0,records=0,wallBad=0,roofBad=0;
for(const rec of I.vivos().values()){
for(const slot of rec.urban||[]){instances++;if(I.roadClearance.hit(slot.corners))bad++;}
for(const obj of rec.objs||[]){
for(const b of obj.userData.recs||[]){records++;if(I.roadClearance.blocked(b))bad++;}
if(!obj.userData.recs?.length||obj.userData.recs.some(b=>b.lancamento||b.parede!=null||b.sacadas))continue;
const pos=obj.geometry.attributes.position;
for(let k=0;k<pos.count;k+=3){
const tri=[0,1,2].map(j=>[pos.getX(k+j),pos.getZ(k+j)]);
const area=(tri[1][0]-tri[0][0])*(tri[2][1]-tri[0][1])-(tri[1][1]-tri[0][1])*(tri[2][0]-tri[0][0]);
if(Math.abs(area)>1e-5&&I.roadClearance.hit(tri)){roofBad++;if(roofBad<4)console.log('ROAD_ROOF '+JSON.stringify(tri));}
}
}
}
const walls=window.__gMuros?.geometry.attributes.position;
if(walls)for(let k=0;k<walls.count;k+=6){
const p=[(walls.getX(k)+walls.getX(k+1))/2,(walls.getZ(k)+walls.getZ(k+1))/2];
if(I.roadClearance.hit([p]))wallBad++;
}
console.log('ROAD_CLEARANCE '+JSON.stringify({bad,wallBad,roofBad,instances,records,...I.roadClearance.stats()}));
check(bad===0,'rendered buildings overlap streets');
check(wallBad===0&&roofBad===0,'wall or roof crosses street');
check(I.roadClearance.stats().rejected>0,'known conflicts were not blocked');
}
console.log('URBAN '+JSON.stringify({mode:expected?'modelos':'procedural',stats:I.urban?.stats(),groups:I.vivos().size,calls:I.renderer.info.render.calls,triangles:I.renderer.info.render.triangles}));
};image.src='http://127.0.0.1:PORT/espera?ms=5000';
}catch(e){console.log('URBAN_FAIL '+e.stack);}
})(180);
</script>
'''.replace('PORT',str(port)).replace('TEST_BUILDINGS','true' if mode=='predios' else 'false').replace('TEST_ROADS','true' if mode.startswith('ruas') else 'false').replace('TEST_TREES','true' if mode.startswith('arvores') else 'false').replace('TEST_COLLISION','true' if mode.startswith('colisao') else 'false').replace('TEST_SIZE','true' if mode.startswith('proporcoes') else 'false')
if mode=='predios': probe=probe.replace('-525,0,-1598','0,0,0')
tmp=OUT/('qa-'+mode+'.html');tmp.write_text(page.read_text(encoding='utf8')+probe,encoding='utf8')
profile=OUT/('chrome-'+uuid.uuid4().hex)
url=tmp.as_uri()+'?q=alto'+('&casas=procedural' if mode=='procedural' else '')
try:
 r=subprocess.run([CHROME,'--headless=new','--user-data-dir='+str(profile),'--window-size=1440,1000','--use-angle=swiftshader','--enable-unsafe-swiftshader','--hide-scrollbars','--screenshot='+str(OUT/(mode+'.png')),'--virtual-time-budget=30000','--enable-logging=stderr','--log-level=0',url],capture_output=True,text=True,encoding='utf8',errors='replace',timeout=150)
finally:
 srv.shutdown()
 # Only this test's unique profile, resolved inside its own output directory.
 if profile.resolve().parent==OUT.resolve() and profile.name.startswith('chrome-'):
  shutil.rmtree(profile,ignore_errors=True)
 tmp.unlink(missing_ok=True)
log=r.stdout+r.stderr;(OUT/(mode+'.log')).write_text(log,encoding='utf8')
lines=[l for l in log.splitlines() if 'URBAN' in l or 'ROAD_CLEARANCE' in l or 'Shader Error' in l or 'Uncaught' in l]
print('\n'.join(lines)[:6000])
if 'URBAN_FAIL' in log or 'Shader Error' in log or 'Uncaught' in log or 'URBAN {' not in log:sys.exit(1)



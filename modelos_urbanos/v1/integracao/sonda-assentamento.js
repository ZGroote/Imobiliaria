(function wait(n){
 if(!window.__int||!__int.grupos().length){if(n)setTimeout(()=>wait(n-1),300);return;}
 try{
 const I=__int,P=__perf;P.setStreamRadius(450);I.target.set(-525,0,-1598);I.sph.set(190,1.12,.6);
 P.passo(performance.now()+1000);P.bombeia(100000);P.passo(performance.now()+2000);
 document.getElementById('tRelief').click();
 setTimeout(()=>{
 try{
 const grid=JSON.parse(document.getElementById('__elevdata').textContent),city=JSON.parse(document.getElementById('__cidade').textContent);
 const ty=(x,z)=>TerrainFit.sample(grid,city.relevo_grade.n,city.relevo_grade.half_m,x,z)*4.5;
 let minRoad=Infinity,roadTriangles=0,foundations=0,badFoundations=0;
 I.scene.traverse(o=>{const p=o.geometry?.attributes.position;if(!o.geometry?.attributes.aVia)return;
 for(let j=0;j<p.count;j+=3){const x=(p.getX(j)+p.getX(j+1)+p.getX(j+2))/3,z=(p.getZ(j)+p.getZ(j+1)+p.getZ(j+2))/3,y=(p.getY(j)+p.getY(j+1)+p.getY(j+2))/3;
 minRoad=Math.min(minRoad,y-ty(x,z));roadTriangles++;}});
 for(const rec of I.vivos().values())for(const slot of rec.urban||[]){foundations++;const m=new THREE.Matrix4();slot.pool.foundation.getMatrixAt(slot.index,m);
 for(const [x,z] of slot.corners)if(m.elements[13]-m.elements[5]>ty(x,z)+.001)badFoundations++;}
 const result={pass:roadTriangles>0&&minRoad>.09&&foundations>0&&badFoundations===0,minRoad,roadTriangles,foundations,badFoundations,models:I.urban.stats(),exteriors:I.exteriors?.stats?.()};
 const output=document.createElement('pre');output.id='qa-assentamento';output.textContent=JSON.stringify(result);output.style='position:fixed;bottom:0;left:260px;max-width:600px;background:white;color:black;z-index:999;font-size:10px;white-space:pre-wrap';document.body.append(output);console.log('QA_ASSENTAMENTO '+JSON.stringify(result));
 }catch(e){document.body.insertAdjacentHTML('beforeend','<pre id="qa-assentamento">'+e.stack+'</pre>');}
 },1500);
 }catch(e){console.error(e);}
})(180);

const {chromium}=require('C:/Users/respawn/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('fs'),path=require('path');
(async()=>{
 const build=JSON.parse(fs.readFileSync(path.join(__dirname,'build.json')));
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1000,height:900},deviceScaleFactor:1});
 const url=process.env.MAPA_LIVE==='1'?build.liveUrl:'http://127.0.0.1:8765'+build.localUrl;
 await page.goto(url+'?em=-22.00891,-47.90494&r=134&p=0.98&t=0.55',{timeout:90000});
 await page.waitForFunction(()=>window.__int&&document.querySelector('#status').style.display==='none',{},{timeout:120000});
 await page.waitForFunction(()=>__int.exteriors.stats().pendingTiles===0&&__int.exteriors.stats().aerialProps>0,{},{timeout:120000});
 await page.waitForTimeout(1500);
 await page.screenshot({path:path.join(__dirname,process.argv.includes('--antes')?'vazio-antes.png':'vazio-depois.png')});
 const report=await page.evaluate(()=>{
  const I=__int;
  const samples=[[200,420],[350,500],[550,540]].map(([x,y])=>{
   const ray=I.target.clone().set(x/innerWidth*2-1,1-y/innerHeight*2,.5).unproject(I.camera).sub(I.camera.position).normalize();
   const p=I.camera.position.clone().addScaledVector(ray,-I.camera.position.y/ray.y);
   return [p.x,p.z];
  });
  return {target:I.target.toArray(),stats:I.exteriors.stats(),vacantSamples:samples};
 });
 fs.writeFileSync(path.join(__dirname,process.argv.includes('--antes')?'vazio-antes.json':'vazio-depois.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify(report));
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});

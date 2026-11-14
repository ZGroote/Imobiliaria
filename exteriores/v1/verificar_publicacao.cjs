const fs=require('fs'),path=require('path'),crypto=require('crypto');
(async()=>{
 const response=await fetch('https://imobilaria-deccb.web.app/',{cache:'no-store'});
 if(!response.ok)throw Error('HTTP '+response.status);
 const index=await response.text();
 if(process.argv.includes('--antes')){
  fs.writeFileSync(path.join(__dirname,'index-producao-anterior.html'),index);
  console.log('Indice de producao preservado para rollback');return;
 }
 const build=JSON.parse(fs.readFileSync(path.join(__dirname,'build.json')));
 if(!index.includes(build.name))throw Error('Indice ainda aponta para outra versao');
 const asset=await fetch(build.liveUrl);if(!asset.ok)throw Error('Asset HTTP '+asset.status);
 const data=Buffer.from(await asset.arrayBuffer()),sha=crypto.createHash('sha256').update(data).digest('hex');
 if(sha!==build.sha256)throw Error('Hash publicado diferente do testado');
 const manifest=JSON.parse(fs.readFileSync(path.join(__dirname,'terrenos-manifesto.json')));
 const tile=await fetch(new URL(manifest.prefix+manifest.keys[0]+'.bin',build.liveUrl));
 if(!tile.ok)throw Error('Tile publicado HTTP '+tile.status);
 const parcels=JSON.parse(require('zlib').gunzipSync(Buffer.from(await tile.arrayBuffer())));
 if(!Array.isArray(parcels)||!parcels.length)throw Error('Tile publicado vazio ou inválido');
 const report={url:build.liveUrl,status:asset.status,bytes:data.length,sha256:sha,indexCache:response.headers.get('cache-control'),assetCache:asset.headers.get('cache-control'),verifiedAt:new Date().toISOString()};
 report.parcelTileVerified=true;fs.writeFileSync(path.join(__dirname,'publicacao.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 const mobilePath=path.join(__dirname,'../../relatorios/mobile/build.json'),mobile=JSON.parse(fs.readFileSync(mobilePath));
 mobile.deployed=true;mobile.liveUrl=build.liveUrl;fs.writeFileSync(mobilePath,JSON.stringify(mobile,null,2));
})().catch(e=>{console.error(e);process.exit(1)});

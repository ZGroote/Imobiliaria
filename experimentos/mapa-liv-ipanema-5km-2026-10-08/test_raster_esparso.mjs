import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const context=vm.createContext({atob:s=>Buffer.from(s,'base64').toString('binary'),
  btoa:s=>Buffer.from(s,'binary').toString('base64')});
vm.runInContext(fs.readFileSync(new URL('./raster-regional.js',import.meta.url),'utf8'),context);
const expand=data=>context.RegionalRasters.expand(JSON.parse(JSON.stringify(data)));
const data={format:'regional-raster-sparse-v2',source_grid:{n:5,half_m:2},
  center_m:{x:0,z:0},radius_m:1,indices:[7,11,12,13,17],edge_policy:'nearest-inside'};
const elevation=expand({...data,kind:'elevation',values:[10,20,30,40,50]});
data.indices.forEach((i,j)=>assert.equal(elevation.data[i],[10,20,30,40,50][j]));
assert.equal(elevation.data.length,25);
assert(elevation.data.every(v=>[10,20,30,40,50].includes(v)));
assert.equal(elevation.report.exported_cells,5);
assert.equal(elevation.report.max_sample_radius_m,1);
const ndvi=expand({...data,kind:'ndvi',ndvi_b64:Buffer.from([1,2,3,4,5]).toString('base64')});
const bytes=Buffer.from(ndvi.data.ndvi_b64,'base64');
data.indices.forEach((i,j)=>assert.equal(bytes[i],j+1));
assert.equal(bytes.filter(v=>v!==0).length,5);
assert.throws(()=>expand({...data,kind:'elevation',indices:[0],values:[99]}),/outside/);
assert.throws(()=>expand({...data,kind:'elevation',indices:[7,7],values:[1,2]}),/outside/);
assert.throws(()=>expand({...data,kind:'elevation',values:[1]}),/values/);
assert.throws(()=>expand({...data,kind:'elevation',values:[1,2,3,4,5],radius_m:null}),/circle/);
console.log('PASS: source samples preserved; no exterior values; nearest-inside fill; invalid payloads rejected');

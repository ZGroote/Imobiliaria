import assert from 'node:assert/strict';
import {test} from 'node:test';
import {distribution,observeRenderer} from './diagnostic-recorder.js';
test('empty and partial measurements retain null and discard nonfinite samples',()=>{
  assert.deepEqual(distribution([]),{count:0,p50:null,p95:null,max:null});
  assert.deepEqual(distribution([10,20,30,NaN]),{count:3,p50:20,p95:30,max:30});
});
test('observer restores rendering, bounds samples and excludes hidden intervals',()=>{
  let time=0,hidden=false,position=[0,0,0],visibility;
  const original=function(){time+=2;return 7;};
  const renderer={render:original,info:{memory:{total:80}},domElement:{width:10,height:20},getPixelRatio:()=>1};
  const win={performance:{now:()=>time,memory:{usedJSHeapSize:100}},document:{
    get hidden(){return hidden;},addEventListener:(name,fn)=>visibility=fn,removeEventListener:(name,fn)=>{assert.equal(fn,visibility);}}};
  const observer=observeRenderer({renderer,backend:'webgpu',camera:{position:{toArray:()=>[...position]}}},win,{limit:3});
  assert.equal(renderer.render(),7);time+=14;renderer.render();
  hidden=true;visibility();time+=1000;renderer.render();hidden=false;visibility();renderer.render();
  time+=14;renderer.render();position=[3,0,4];
  const sample=observer.stop();assert.equal(renderer.render,original);
  assert.equal(sample.submissions,4);assert.equal(sample.droppedSamples,1);
  assert.equal(sample.submissionIntervalMs.count,1);assert.equal(sample.submissionIntervalMs.max,16);
  assert.equal(sample.hiddenMs,1002);assert.equal(sample.cameraDisplacementMeters,5);
  assert.equal(sample.memoryPeakSampled.rendererTrackedBytes,80);
  observer.stop();assert.equal(renderer.render,original);
});

import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
vm.runInThisContext(fs.readFileSync(new URL('../../../v1.5/renderizador-v16-moveis/road-clearance.js',import.meta.url),'utf8'));
const rect=(x,z,w,d)=>[[x-w,z-d],[x+w,z-d],[x+w,z+d],[x-w,z+d]];
const road={pts:[[-300,0],[0,0],[300,0]],name:'avenue'};
const index=RoadClearance.create([road],()=>10,0);
assert(index.hit(rect(0,0,1,1))); // entirely inside road
assert(index.hit(rect(0,0,20,20))); // road entirely inside building
assert(index.hit(rect(159,4.9,2,1))); // overlap across spatial cell boundary
assert(index.hit([[-10,-10],[-9,-10],[10,10],[9,10]])); // edge crossings, no inside corners
assert.equal(index.hit(rect(0,8,1,1)),null);
assert.deepEqual(index.clipSegment([0,-10],[0,10]),[[0,.25],[.75,1]]);
assert.deepEqual(index.clipSegment([0,-2],[0,2]),[]);
assert.deepEqual(index.clipSegment([0,8],[10,8]),[[0,1]]);
const turn=RoadClearance.create([{pts:[[-20,-20],[0,0],[20,-20]]}],()=>10,0);
assert(turn.hit(rect(4,4,.4,.4))); // square road junction patch
assert.equal(RoadClearance.create([],()=>10).hit(rect(0,0,1,1)),null);
// Concave courtyard can surround a road rectangle without touching it.
const concave=[[-10,-10],[10,-10],[10,10],[6,10],[6,-6],[-6,-6],[-6,10],[-10,10]];
assert.equal(RoadClearance.overlaps(concave,rect(0,0,2,2)),false);
console.log('PASS: containment, edge-only crossing, cell boundaries, junction patches, concave polygon, empty roads.');

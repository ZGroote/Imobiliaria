import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import vm from 'node:vm';
import {encodeRGBA} from '../experimentos/piloto-qualidade-visual-2026-10-04/png.mjs';

test('PNG é decodificado pelo Pillow com pixels, alpha e orientação exatos de view de outro realm',()=>{
  const pixels=[255,0,0,255, 0,255,0,128, 15,25,35,0,
    0,0,255,255, 12,34,56,17, 210,180,140,200];
  const ForeignBytes=vm.runInNewContext('Uint8Array');
  const backing=new ForeignBytes([91,92,93,94,...pixels,95,96,97,98]);
  const data=backing.subarray(4,28),before=Array.from(backing);
  const png=encodeRGBA({width:3,height:2,data});
  assert.equal(Buffer.isBuffer(png),true);
  assert.deepEqual(Array.from(backing),before);
  assert.deepEqual(png,encodeRGBA({width:3,height:2,data}));
  const decoded=spawnSync(process.env.PYTHON||'python',['-c',
    'import io,json,sys; from PIL import Image; raw=sys.stdin.buffer.read(); im=Image.open(io.BytesIO(raw)); im.verify(); im=Image.open(io.BytesIO(raw)); im.load(); print(json.dumps({"format":im.format,"mode":im.mode,"size":list(im.size),"pixels":list(im.tobytes())}))'],
    {input:png,encoding:'utf8',windowsHide:true});
  assert.equal(decoded.status,0,decoded.stderr||decoded.error?.message);
  assert.deepEqual(JSON.parse(decoded.stdout),{format:'PNG',mode:'RGBA',size:[3,2],pixels});
});

test('encoder recusa dimensões PNG inválidas e dados que não são bytes RGBA completos',()=>{
  const valid={width:1,height:1,data:new Uint8ClampedArray([1,2,3,255])};
  assert.equal(Buffer.isBuffer(encodeRGBA(valid)),true);
  for(const dimensions of [{width:0},{height:-1},{width:1.5},{height:NaN},{width:0x80000000}])
    assert.throws(()=>encodeRGBA({...valid,...dimensions}),RangeError);
  for(const data of [new Uint8Array(3),new Uint8Array(5),new Uint16Array(2),new DataView(new ArrayBuffer(4)),[1,2,3,255],null])
    assert.throws(()=>encodeRGBA({...valid,data}),/RGBA/);
});

import * as THREE from 'three/webgpu';

export function environmentPixels(){
  const width=64,height=32,bytes=new Uint8Array(width*height*4);
  for(let y=0;y<height;y++){
    const t=y/(height-1),horizon=Math.exp(-Math.pow((t-.52)/.09,2));
    const rgb=[30+130*(1-t)+150*horizon,44+150*(1-t)+155*horizon,66+175*(1-t)+160*horizon];
    for(let x=0;x<width;x++){
      const i=(y*width+x)*4;
      for(let channel=0;channel<3;channel++)bytes[i+channel]=Math.min(255,rgb[channel]|0);
      bytes[i+3]=255;
    }
  }
  return {width,height,bytes};
}

export function environmentTexture(){
  const {width,height,bytes}=environmentPixels();
  const texture=new THREE.DataTexture(bytes,width,height,THREE.RGBAFormat);
  texture.mapping=THREE.EquirectangularReflectionMapping;
  texture.colorSpace=THREE.SRGBColorSpace;
  texture.needsUpdate=true;
  return texture;
}

async function sha(bytes){
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(b=>b.toString(16).padStart(2,'0')).join('');
}

export async function precomputedEnvironment(signal){
  const base=new URL('./assets-ambiente/',import.meta.url);
  const response=await fetch(new URL('manifest.json',base),{cache:'no-cache',signal});
  if(!response.ok)throw Error(`Ambiente: manifesto HTTP ${response.status}.`);
  const manifest=await response.json(),source=environmentPixels(),record=manifest.file;
  if(manifest.schema!=='liv-pmrem-v1'||manifest.runtime!==THREE.REVISION||
    manifest.width!==336||manifest.height!==64||manifest.format!=='rgba-f16-le-cubeuv'||
    manifest.sourceWidth!==source.width||manifest.sourceHeight!==source.height||
    manifest.sourceRGBA_SHA256!==await sha(source.bytes)||
    record?.name!=='ambiente.f16.gz'||!Number.isInteger(record.bytes)||record.bytes<1||record.bytes>172032||
    !/^[a-f0-9]{64}$/.test(record.sha256||'')||!/^[a-f0-9]{64}$/.test(manifest.rawSHA256||''))
    throw Error('Ambiente pré-calculado não corresponde ao gradiente/runtime atual.');
  const url=new URL(record.name,base);url.searchParams.set('v',record.sha256);
  const asset=await fetch(url,{signal});
  if(!asset.ok)throw Error(`Ambiente: recurso HTTP ${asset.status}.`);
  const compressed=new Uint8Array(await asset.arrayBuffer());
  if(compressed.length!==record.bytes||await sha(compressed)!==record.sha256)throw Error('Ambiente comprimido inválido.');
  const raw=new Uint8Array(await new Response(new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
  if(raw.length!==manifest.width*manifest.height*8||await sha(raw)!==manifest.rawSHA256)throw Error('Ambiente descomprimido inválido.');
  // The asset stores little-endian half floats; DataView also covers hosts with
  // a different native byte order. It remains a stock CubeUV DataTexture.
  const values=new Uint16Array(raw.length/2),view=new DataView(raw.buffer,raw.byteOffset,raw.byteLength);
  for(let i=0;i<values.length;i++)values[i]=view.getUint16(i*2,true);
  const texture=new THREE.DataTexture(values,manifest.width,manifest.height,THREE.RGBAFormat,THREE.HalfFloatType);
  texture.mapping=THREE.CubeUVReflectionMapping;
  texture.colorSpace=THREE.LinearSRGBColorSpace;
  texture.minFilter=texture.magFilter=THREE.LinearFilter;
  texture.generateMipmaps=false;texture.needsUpdate=true;
  return texture;
}

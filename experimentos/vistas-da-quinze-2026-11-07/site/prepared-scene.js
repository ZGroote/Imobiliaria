const decoder=new TextDecoder();
export function decodePreparedScene(bytes,{sourceSHA,compactSHA}){
 if(bytes.length<12||decoder.decode(bytes.subarray(0,8))!=='LIVBUF01')throw Error('Cena binária interior inválida.');
 const length=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength).getUint32(8,true),base=(12+length+3)&~3;
 if(base>bytes.length||length>16*1024*1024)throw Error('Cabeçalho binário interior inválido.');
 const header=JSON.parse(decoder.decode(bytes.subarray(12,12+length)));
 if(header.schema!=='liv-prepared-interior-v1'||header.sourceSHA256!==sourceSHA||header.compactSHA256!==compactSHA)throw Error('Cena binária de outra revisão.');
 const view=spec=>{
  if(!Number.isSafeInteger(spec?.offset)||!Number.isSafeInteger(spec?.length)||spec.offset<0||spec.length<0||!['f32','u32','u8'].includes(spec.type))throw Error('Buffer interior inválido.');
  const Type={f32:Float32Array,u32:Uint32Array,u8:Uint8Array}[spec.type],offset=base+spec.offset,size=spec.length*Type.BYTES_PER_ELEMENT;
  if(offset+size>bytes.length||(bytes.byteOffset+offset)%Type.BYTES_PER_ELEMENT)throw Error('Buffer interior fora do arquivo.');
  return new Type(bytes.buffer,bytes.byteOffset+offset,spec.length);
 };
 const geometry=spec=>{for(const name of ['position','normal','uv','uv1','color','index'])if(spec[name])spec[name]=view(spec[name]);return spec;};
 const scene=header.scene;
 for(const spec of Object.values(scene.geometries))geometry(spec);
 for(const texture of Object.values(scene.textures||{}))if(texture.preparedPNG)texture.preparedPNG=view(texture.preparedPNG);
 for(const corner of scene.preparedBake.objects)geometry(corner.preparedGeometry);
 return scene;
}

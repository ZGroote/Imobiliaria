// Baixa, confere e descomprime os recursos grandes da maquete fora da linha principal:
// descomprimir, conferir o SHA-256 e ler 2,7 MB de JSON travavam a página por ~0,5 s no
// celular, e a troca pelo atlas completo (13 MB) por mais ~0,7 s.
// Pedido: {id,url,name,bytes,sha256,decodedSHA256,scene}. Resposta: {id,progress} ou {id,bytes|data|error}.
const typed={Float32Array:4,Float64Array:8,Uint32Array:4,Uint16Array:2,Uint8Array:1,Int32Array:4,Int16Array:2,Int8Array:1};

async function sha(bytes){
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(b=>b.toString(16).padStart(2,'0')).join('');
}

async function download({id,url,name,bytes:size}){
  const response=await fetch(url);
  if(!response.ok)throw Error(`Recurso ${name}: HTTP ${response.status}.`);
  const reader=response.body.getReader(),bytes=new Uint8Array(size);let loaded=0;
  postMessage({id,progress:{loaded,total:size}});
  for(;;){
    const {value,done}=await reader.read();if(done)break;
    if(loaded+value.length>size){await reader.cancel();throw Error(`Tamanho do recurso ${name} inválido.`);}
    bytes.set(value,loaded);loaded+=value.length;postMessage({id,progress:{loaded,total:size}});
  }
  if(loaded!==size)throw Error(`Identidade do recurso ${name} inválida.`);
  return bytes;
}

function decodeBase64(spec,transfer){
  if(!Object.hasOwn(typed,spec.type))throw Error(`Tipo de buffer não suportado: ${spec.type}.`);
  let bytes;
  if(typeof Uint8Array.fromBase64==='function')bytes=Uint8Array.fromBase64(spec.base64);
  else{const binary=atob(spec.base64);bytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);}
  if(bytes.length!==spec.length*typed[spec.type])throw Error('Buffer de geometria incompleto.');
  delete spec.base64;spec.buffer=bytes.buffer;transfer.push(bytes.buffer);
}

// Same result as BufferGeometry.computeBoundingBox/computeBoundingSphere (all positions, no morphs).
function bounds(position){
  if(position.type!=='Float32Array'||position.itemSize!==3||position.normalized)throw Error('Posições da geometria em formato inesperado.');
  const p=new Float32Array(position.buffer),min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
  for(let i=0;i<p.length;i+=3)for(let k=0;k<3;k++){const v=p[i+k];if(v<min[k])min[k]=v;if(v>max[k])max[k]=v;}
  const center=[0,1,2].map(k=>(min[k]+max[k])*0.5);let radius=0;
  for(let i=0;i<p.length;i+=3){const x=center[0]-p[i],y=center[1]-p[i+1],z=center[2]-p[i+2];radius=Math.max(radius,x*x+y*y+z*z);}
  return {min,max,center,radius:Math.sqrt(radius)};
}

self.onmessage=async({data:request})=>{
  const {id,name,sha256,decodedSHA256,scene}=request;
  try{
    const compressed=await download(request);
    if(await sha(compressed)!==sha256)throw Error(`Identidade do recurso ${name} inválida.`);
    const bytes=new Uint8Array(await new Response(new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
    if(await sha(bytes)!==decodedSHA256)throw Error(scene?'Cena descomprimida não corresponde ao manifesto.':'Atlas RGBM corrompido.');
    if(!scene){postMessage({id,bytes},[bytes.buffer]);return;}
    const data=JSON.parse(new TextDecoder().decode(bytes)),transfer=[];
    for(const geometry of data.geometries){
      for(const attribute of Object.values(geometry.attributes))decodeBase64(attribute,transfer);
      if(geometry.index)decodeBase64(geometry.index,transfer);
      geometry.bounds=bounds(geometry.attributes.position);
    }
    for(const mesh of data.meshes)if(mesh.instances){
      decodeBase64(mesh.instances.matrix,transfer);
      if(mesh.instances.color)decodeBase64(mesh.instances.color,transfer);
    }
    postMessage({id,data},transfer);
  }catch(error){postMessage({id,error:String(error?.message||error)});}
};

import * as THREE from 'three/webgpu';
import {Fn,texture3D} from 'three/tsl';

function validate(record){
  if(record?.schema!=='liv-color-look-log3d-v1'||!Number.isInteger(record.edge)||record.edge<2||record.edge>128||
    record.bytes!==record.edge**3*16||!(/^[a-f0-9]{64}$/i.test(record.sha256||''))||
    !Number.isFinite(record.domainMinEV)||!Number.isFinite(record.domainMaxEV)||record.domainMinEV>=record.domainMaxEV||
    record.domainMinEV < -32||record.domainMaxEV>32||record.lookupExposureEV!==0||record.sourceDisplayDevice!=='sRGB'||
    !/little-endian float32 RGBA/i.test(record.encoding||'')||!/red fastest/i.test(record.axisOrder||'')||record.validationPassed===false){
    throw Error('Contrato do acabamento de cor inválido.');
  }
}

/** Instala o lookup linear aprovado. O renderer faz a conversão final para sRGB. */
export async function installInteriorLook({renderer,base,record,signal,own=value=>value,onStatus=()=>{},fetchImpl=globalThis.fetch}){
  const state={status:'default',toneMapping:'AgX',sourceLook:record?.sourceLook||null,error:null};
  const emit=()=>onStatus({...state});
  if(!record){emit();return state;}
  try{
    if(signal?.aborted)throw new DOMException('Acabamento de cor cancelado.','AbortError');
    validate(record);
    if(typeof record.path!=='string'||!(/^[a-zA-Z0-9._/-]+\.bin$/.test(record.path))||record.path.startsWith('/')||record.path.split('/').includes('..'))throw Error('Caminho do acabamento de cor inválido.');
    const path=record.path.startsWith('interiores/melhorias/')?record.path.slice('interiores/melhorias/'.length):record.path;
    const url=new URL(path,new URL('interiores/melhorias/catalogo.json',base));url.searchParams.set('v',record.sha256);
    const response=await fetchImpl(url,{signal});if(!response.ok)throw Error(`Acabamento de cor: HTTP ${response.status}.`);
    const bytes=await response.arrayBuffer();if(bytes.byteLength!==record.bytes)throw Error('Arquivo do acabamento de cor incompleto.');
    const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(value=>value.toString(16).padStart(2,'0')).join('');
    if(hash!==record.sha256.toLowerCase())throw Error('Acabamento de cor de outra revisão.');
    const view=new DataView(bytes),data=new Uint16Array(bytes.byteLength/4);
    for(let index=0;index<data.length;index++){
      const value=view.getFloat32(index*4,true);
      if(!Number.isFinite(value)||value<0||value>1.00001||(index%4===3&&value!==1))throw Error('Dados do acabamento de cor inválidos.');
      data[index]=THREE.DataUtils.toHalfFloat(value);
    }
    if(signal?.aborted)throw new DOMException('Acabamento de cor cancelado.','AbortError');
    const texture=own(new THREE.Data3DTexture(data,record.edge,record.edge,record.edge));
    texture.name='LIV · AgX Medium Low Contrast aprovado';texture.type=THREE.HalfFloatType;texture.format=THREE.RGBAFormat;
    texture.colorSpace=THREE.NoColorSpace;texture.minFilter=texture.magFilter=THREE.LinearFilter;
    texture.wrapS=texture.wrapT=texture.wrapR=THREE.ClampToEdgeWrapping;texture.generateMipmaps=false;texture.flipY=false;texture.needsUpdate=true;
    const lookup=texture3D(texture),lo=record.domainMinEV,span=record.domainMaxEV-lo,size=record.edge;
    const toneMapping=Fn(([color,exposure])=>{
      const normalized=color.mul(exposure).max(2**lo).log2().sub(lo).div(span).clamp(0,1);
      return lookup.sample(normalized.mul((size-1)/size).add(.5/size)).rgb;
    });
    if(renderer.installInteriorLook)renderer.installInteriorLook({texture,lo,span,size});
    else {renderer.library.addToneMapping(toneMapping,THREE.CustomToneMapping);
    if(renderer.library.getToneMappingFunction(THREE.CustomToneMapping)!==toneMapping)throw Error('Não foi possível registrar o acabamento de cor.');}
    renderer.toneMapping=THREE.CustomToneMapping;
    Object.assign(state,{status:'ready',toneMapping:'CustomToneMapping',edge:size,domainEV:[lo,record.domainMaxEV],storage:'RGBA16F',output:'linear-sRGB',sha256:hash});
    emit();return state;
  }catch(error){
    if(signal?.aborted||error.name==='AbortError')throw error;
    renderer.toneMapping=THREE.AgXToneMapping;state.status='fallback';state.error=String(error.message||error);emit();return state;
  }
}

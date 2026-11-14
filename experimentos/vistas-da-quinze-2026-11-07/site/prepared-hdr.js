// Exact half-float pixels produced by the pinned HDRLoader at build time.
export function decodePreparedHDR(bytes){
 if(bytes.length<16||new TextDecoder().decode(bytes.subarray(0,8))!=='LIVHDR01')throw Error('Ambiente preparado inválido.');
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),width=view.getUint32(8,true),height=view.getUint32(12,true);
 if(!width||!height||width>16384||height>16384||bytes.length!==16+width*height*8||(bytes.byteOffset+16)%2)throw Error('Dimensões do ambiente preparado inválidas.');
 return {width,height,data:new Uint16Array(bytes.buffer,bytes.byteOffset+16,width*height*4)};
}

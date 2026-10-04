import {crc32,deflateSync} from 'node:zlib';

// PNG RGBA de 8 bits, sem interlace ou transformação de cor.
// https://www.w3.org/TR/png/#11IHDR — Node 24 oferece CRC-32 nativo.
function chunk(type,data) {
  const body=Buffer.concat([Buffer.from(type,'ascii'),data]);
  const result=Buffer.alloc(body.length+8);
  result.writeUInt32BE(data.length,0);body.copy(result,4);
  result.writeUInt32BE(crc32(body),result.length-4);
  return result;
}

export function encodeRGBA({width,height,data}) {
  if(!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||width<1||height<1||width>0x7fffffff||height>0x7fffffff
    ||!Number.isSafeInteger(width*height*4))throw new RangeError('Dimensões PNG inválidas.');
  // ArrayBuffer.isView aceita os pixels produzidos pela VM em outro realm.
  if(!ArrayBuffer.isView(data)||data.BYTES_PER_ELEMENT!==1||data.byteLength!==width*height*4)
    throw new TypeError('Dados RGBA devem conter exatamente quatro bytes por pixel.');
  const pixels=Buffer.from(data.buffer,data.byteOffset,data.byteLength),stride=width*4;
  const rows=Buffer.alloc((stride+1)*height);
  for(let y=0;y<height;y++)pixels.copy(rows,y*(stride+1)+1,y*stride,(y+1)*stride);
  const header=Buffer.alloc(13);
  header.writeUInt32BE(width,0);header.writeUInt32BE(height,4);
  header[8]=8;header[9]=6;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),
    chunk('IHDR',header),chunk('IDAT',deflateSync(rows,{level:9})),chunk('IEND',Buffer.alloc(0))]);
}

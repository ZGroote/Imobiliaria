/* Leitor do formato MBN1 (ver gerador/binario.py): arrays tipados num só arquivo gzip.

   O navegador descompacta com `DecompressionStream` (nativo); onde ele não existe
   (Safari antes do 16.4) entra o fflate, carregado só nesse caso. Se algum intermediário
   já tiver descompactado a resposta, a assinatura 'MBN1' aparece logo no começo e a
   etapa é pulada. Os arrays são VISTAS sobre o mesmo buffer (nada é copiado), exceto os
   gravados como diferença, que são somados de volta numa passada. */

const TIPOS = { u8: Uint8Array, i8: Int8Array, u16: Uint16Array, i16: Int16Array, u32: Uint32Array, f32: Float32Array };

async function gunzip(buf) {
  if (typeof DecompressionStream === 'function') {
    return new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
  }
  const { gunzipSync } = await import('three/examples/jsm/libs/fflate.module.js');
  const u8 = gunzipSync(new Uint8Array(buf));
  return u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength);
}

/* Diferenças em zigue-zague (gerador/binario.py, `delta`) de volta aos valores. */
function somaDelta(z, passo, Tipo) {
  const out = new Tipo(z.length);
  for (let i = 0; i < z.length; i++) {
    const v = z[i], d = (v >>> 1) ^ -(v & 1);
    out[i] = (i >= passo ? out[i - passo] : 0) + d;
  }
  return out;
}

export function leMBN1(buf) {
  const u8 = new Uint8Array(buf);
  if (u8[0] !== 0x4D || u8[1] !== 0x42 || u8[2] !== 0x4E || u8[3] !== 0x31) throw Error('MBN1 inválido');
  const n = new DataView(buf).getUint32(4, true);
  const cab = JSON.parse(new TextDecoder().decode(u8.subarray(8, 8 + n)));
  const base = 8 + n, arrays = {};
  for (const [nome, d] of Object.entries(cab.arrays)) {
    const a = new TIPOS[d.tipo](buf, base + d.inicio, d.n);
    arrays[nome] = d.delta ? somaDelta(a, d.delta, TIPOS[d.final]) : a;
  }
  return { cab, arrays };
}

export async function carregaBinario(url) {
  const r = await fetch(url);
  if (!r.ok) throw Error(url + ' ' + r.status);
  const buf = await r.arrayBuffer();
  const u8 = new Uint8Array(buf, 0, 2);
  return leMBN1(u8[0] === 0x1F && u8[1] === 0x8B ? await gunzip(buf) : buf);
}

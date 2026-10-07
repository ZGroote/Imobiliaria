// Codifica os lightmaps (RGBA8 em escala logarítmica, sem alfa útil) em KTX2 / Basis UASTC.
//
// Por que UASTC e não ETC1S: medido nos dois atlas, ETC1S erra em média 1,7-3 códigos de
// tela e chega a 16 no percentil 99 (manchas visíveis em degradê de luz); UASTC erra 0,4 em
// média e 5 no p99, com supercompressão Zstandard. O navegador transcodifica UASTC para o
// formato nativo da GPU: ASTC 4x4 (iPhone, Android recentes), BC7 (computador), ETC2
// (qualquer Android com WebGL2) -- 1 byte por texel em vez de 4.
//
//   node gerador/codificar_ktx2.mjs entrada.rgba largura altura saida.ktx2
import fs from 'node:fs';
import { encodeToKTX2 } from 'ktx2-encoder';

const [entrada, largura, altura, saida] = process.argv.slice(2);
const raw = new Uint8Array(fs.readFileSync(entrada));
const w = Number(largura), h = Number(altura);
if (raw.length !== w * h * 4) throw new Error(`tamanho ${raw.length} != ${w}x${h}x4`);
const t = Date.now();
const ktx = await encodeToKTX2(raw, {
  isUASTC: true, needSupercompression: true, enableRDO: false,
  generateMipmap: true, isPerceptual: false, isSetKTX2SRGBTransferFunc: false, isKTX2File: true,
  imageDecoder: async () => ({ data: raw, width: w, height: h }),
});
fs.writeFileSync(saida, ktx);
console.log(JSON.stringify({ saida, bytes: ktx.length, ms: Date.now() - t }));

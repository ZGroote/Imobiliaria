// Decodifica o nível 0 de um KTX2 com o transcodificador Basis do three r168 (o mesmo que
// o navegador usa) e grava RGBA8 cru. Serve à verificação de erro em derivar.py.
//   node gerador/decodificar_ktx2.mjs arquivo.ktx2 saida.rgba
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const BASIS_DIR = path.join(AQUI, '..', 'node_modules', 'three', 'examples', 'jsm', 'libs', 'basis');
const codigo = fs.readFileSync(path.join(BASIS_DIR, 'basis_transcoder.js'), 'utf8');
const mod = { exports: {} };
vm.runInNewContext(codigo, { module: mod, exports: mod.exports, require: createRequire(import.meta.url),
  process, __filename: path.join(BASIS_DIR, 'basis_transcoder.js'), __dirname: BASIS_DIR,
  console, WebAssembly, URL, TextDecoder, setTimeout, clearTimeout, performance });
const BASIS = mod.exports;
const B = await BASIS({ wasmBinary: fs.readFileSync(path.join(BASIS_DIR, 'basis_transcoder.wasm')) });
B.initializeBasis();
const [entrada, saida] = process.argv.slice(2);
const k = new B.KTX2File(new Uint8Array(fs.readFileSync(entrada)));
if (!k.isValid()) throw new Error('KTX2 inválido: ' + entrada);
k.startTranscoding();
const RGBA32 = 13;
const dst = new Uint8Array(k.getImageTranscodedSizeInBytes(0, 0, 0, RGBA32));
if (!k.transcodeImage(dst, 0, 0, 0, RGBA32, 0, -1, -1)) throw new Error('falha ao transcodificar');
fs.writeFileSync(saida, dst);
console.log(JSON.stringify({ largura: k.getWidth(), altura: k.getHeight(), niveis: k.getLevels(),
  formato: k.isUASTC() ? 'UASTC' : 'ETC1S' }));
k.close(); k.delete();

// Servidor estático que imita o Firebase Hosting no que importa para medir:
//  - compressão automática (Brotli, ou gzip) só para tipos de texto, como o Hosting faz;
//  - os cabeçalhos de cache da configuração (HTML revalida; assets com hash, imutáveis);
//  - ETag/304, para medir a revisita.
// Uso: import { servir } from './servidor.mjs'; const s = await servir(pasta, porta);
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';

const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.wasm': 'application/wasm',
  '.webp': 'image/webp', '.png': 'image/png', '.ktx2': 'image/ktx2',
  '.gz': 'application/gzip', '.bin': 'application/octet-stream', '.glb': 'model/gltf-binary',
  '.blend': 'application/octet-stream', '.txt': 'text/plain; charset=utf-8',
};
// O Hosting comprime respostas de texto; binários já comprimidos seguem como estão.
const COMPRIMIVEL = new Set(['.html', '.js', '.mjs', '.css', '.json', '.svg', '.wasm', '.txt']);

// Mesmas regras do firebase.json da v4 (e do firebase.miniaturas.json para a versão atual):
// arquivo com versão no nome ou na pasta é imutável; o resto (HTML) revalida.
export function cacheDe(rel) {
  if (/^(app|lib)\//.test(rel) || /^assets\/.+-[0-9a-f]{12}\.[a-z0-9]+$/.test(rel) || /^assets\/cedros\//.test(rel))
    return 'public, max-age=31536000, immutable';
  return 'public, max-age=0, must-revalidate';
}

// O Hosting entrega a versão comprimida já pronta no CDN; aqui ela é feita uma vez, na
// partida, para que o tempo de compressão não entre na medida de abertura.
function preComprimir(raiz, cacheCorpo) {
  const anda = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e =>
    e.isDirectory() ? anda(path.join(d, e.name)) : [path.join(d, e.name)]);
  for (const arq of anda(raiz)) {
    const ext = path.extname(arq).toLowerCase();
    if (!COMPRIMIVEL.has(ext)) continue;
    const corpo = fs.readFileSync(arq), st = fs.statSync(arq);
    cacheCorpo.set(arq + '|br|' + st.mtimeMs, zlib.brotliCompressSync(corpo, { params: {
      [zlib.constants.BROTLI_PARAM_QUALITY]: corpo.length > 2e6 ? 9 : 11,
      [zlib.constants.BROTLI_PARAM_SIZE_HINT]: corpo.length } }));
    cacheCorpo.set(arq + '|gzip|' + st.mtimeMs, zlib.gzipSync(corpo, { level: 9 }));
  }
}

export function servir(raiz, porta = 0) {
  const cacheCorpo = new Map();
  preComprimir(raiz, cacheCorpo);
  const srv = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    let rel = decodeURIComponent(url.pathname).replace(/^\/+/, '');
    if (!rel || rel.endsWith('/')) rel += 'index.html';
    const arq = path.join(raiz, rel);
    if (!arq.startsWith(path.resolve(raiz)) || !fs.existsSync(arq) || !fs.statSync(arq).isFile()) {
      res.writeHead(404); res.end('404'); return;
    }
    const ext = path.extname(arq).toLowerCase();
    const st = fs.statSync(arq);
    const etag = '"' + crypto.createHash('sha1').update(arq + st.size + st.mtimeMs).digest('hex').slice(0, 16) + '"';
    const cab = { 'Content-Type': TIPOS[ext] || 'application/octet-stream', 'Cache-Control': cacheDe(rel),
                  'ETag': etag, 'X-Content-Type-Options': 'nosniff', 'Vary': 'Accept-Encoding' };
    if (req.headers['if-none-match'] === etag) { res.writeHead(304, cab); res.end(); return; }
    let corpo = fs.readFileSync(arq);
    const ae = String(req.headers['accept-encoding'] || '');
    if (COMPRIMIVEL.has(ext)) {
      const enc = /\bbr\b/.test(ae) ? 'br' : /\bgzip\b/.test(ae) ? 'gzip' : null;
      if (enc) {
        const k = arq + '|' + enc + '|' + st.mtimeMs;
        if (!cacheCorpo.has(k)) cacheCorpo.set(k, enc === 'br'
          ? zlib.brotliCompressSync(corpo, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11,
                                                       [zlib.constants.BROTLI_PARAM_SIZE_HINT]: corpo.length } })
          : zlib.gzipSync(corpo, { level: 9 }));
        corpo = cacheCorpo.get(k); cab['Content-Encoding'] = enc;
      }
    }
    cab['Content-Length'] = corpo.length;
    res.writeHead(200, cab); res.end(corpo);
  });
  return new Promise(ok => srv.listen(porta, '127.0.0.1', () => ok({
    url: `http://127.0.0.1:${srv.address().port}`, fechar: () => new Promise(f => srv.close(f)) })));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const s = await servir(path.resolve(process.argv[2] || '.'), Number(process.argv[3] || 8780));
  console.log('servindo', process.argv[2] || '.', 'em', s.url);
}

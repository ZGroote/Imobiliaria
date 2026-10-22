// MG-6: um build do formato novo (manifest schema 2, a maquete geral) a partir de um build do formato antigo,
// para os testes do robô sem Chrome. O tour é o de verdade; no lugar da página antiga vão arquivos do motor e
// dos dados, pequenos e de mentira, com o manifesto e o build calculados como o build_imovel.py calcula. O
// montar-preview e o montar-live (Python) conferem tudo de verdade. O exportador com o Chrome e o motor abrindo
// no navegador são do maquete/motor/qa_exportados.py e do qa_build.py.
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { gzipSync } from 'node:zlib'

const sha = (b) => createHash('sha256').update(b).digest('hex')

export async function formatoNovo(builds, imovel, build, versao = 1) {
  const de = join(builds, imovel, build)
  const arquivos = {
    'tour.html': await readFile(join(de, 'tour.html')),
    'maquete.html': Buffer.from(`<script type="module" src="casa.js"></script>\n<!-- versão ${versao} -->\n`),
    'casa.js': Buffer.from("import dados from './dados/maquete.js';\n"),
    'node_modules/three/build/three.webgpu.js': Buffer.from('export const REVISION="186";\n'),
    'dados/maquete.js': Buffer.from(`export default {imovel:${JSON.stringify(imovel)},versao:${versao}};\n`),
    'dados/exterior/scene.json.gz': gzipSync(Buffer.from(`{"versao":${versao}}`)),
  }
  const shas = Object.fromEntries(Object.entries(arquivos).map(([n, b]) => [n, sha(b)]))
  const lista = Object.keys(shas).sort().map((n) => `${n} ${shas[n]}\n`).join('')
  const novo = sha(Buffer.from(lista)).slice(0, 12)
  const antigo = JSON.parse(await readFile(join(de, 'manifest.json'), 'utf-8'))
  const manifesto = { ...antigo, schema: 2, formato: 'maquete-geral-v1', build: novo,
    entradas: { tour: 'tour.html', maquete: 'maquete.html' }, motor: sha(Buffer.from('motor de teste')),
    arquivos: Object.fromEntries(Object.keys(shas).sort().map((n) => [n, { bytes: arquivos[n].length, sha256: shas[n] }])) }
  const para = join(builds, imovel, novo)
  for (const [n, b] of Object.entries(arquivos)) {
    await mkdir(dirname(join(para, n)), { recursive: true })
    await writeFile(join(para, n), b)
  }
  await writeFile(join(para, 'manifest.json'), JSON.stringify(manifesto, null, 2) + '\n')
  return novo
}

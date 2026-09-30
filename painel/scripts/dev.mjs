// Ambiente de dev do painel (npm run painel:dev na raiz, dentro dos emuladores):
//   1. zera e popula o emulador (seed.mjs);
//   2. serve painel/exemplo/ em http://127.0.0.1:5055, fazendo o papel do site de imóveis
//      (manifest.json e estado.json do contrato §9), com CORS, como o site real terá;
//   3. sobe o next dev.
// Os exemplos ficam FORA de public/ de propósito: não chegam a painel/out em build nenhuma.
import http from 'node:http'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { semear, adminDb } from './seed.mjs'
import { getAuth } from 'firebase-admin/auth'
import { criarServidorLeituras } from '../../tools/leitura-api.mjs'

const PAINEL = fileURLToPath(new URL('..', import.meta.url))
const EXEMPLO = path.join(PAINEL, 'exemplo') + path.sep
const PORTA = 5055
const TIPOS = { '.json': 'application/json', '.html': 'text/html; charset=utf-8', '.txt': 'text/plain; charset=utf-8' }

await semear()
console.log('seed: emulador zerado e populado.')
const painelPort=process.env.PAINEL_PORT??'3000'
const origin=`http://127.0.0.1:${painelPort}`
criarServidorLeituras({db:adminDb(),auth:getAuth(),origin}).listen(5056,'127.0.0.1')

http.createServer(async (req, res) => {
  const cab = { 'access-control-allow-origin': '*', 'cache-control': 'no-store' }
  const arquivo = path.join(EXEMPLO, path.normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)))
  if (!arquivo.startsWith(EXEMPLO)) { res.writeHead(403, cab).end(); return }   // nada fora de exemplo/
  try {
    const corpo = await readFile(arquivo)
    res.writeHead(200, { ...cab, 'content-type': TIPOS[path.extname(arquivo)] ?? 'application/octet-stream' }).end(corpo)
  } catch {
    res.writeHead(404, cab).end('não encontrado')
  }
}).listen(PORTA, '127.0.0.1', () => console.log(`site de imóveis de exemplo: http://127.0.0.1:${PORTA}/`))

const next = spawn(process.execPath, [path.join(PAINEL, 'node_modules', 'next', 'dist', 'bin', 'next'), 'dev','--hostname','127.0.0.1','--port',painelPort],
  { cwd: PAINEL, stdio: 'inherit',env:{...process.env,NEXT_PUBLIC_READINGS_API_URL:'http://127.0.0.1:5056/property-readings'} })
next.on('exit', (codigo) => process.exit(codigo ?? 0))

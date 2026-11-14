import {build} from 'esbuild'
import {readFile,readdir,mkdir,writeFile} from 'node:fs/promises'
import {resolve,join} from 'node:path'
import {fileURLToPath,pathToFileURL} from 'node:url'
import {gzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'

export async function carregarPaginasPublicas(payload){
  const pages={}
  async function walk(dir){
    let entries
    try{entries=await readdir(join(payload,dir),{withFileTypes:true})}catch(e){if(e.code==='ENOENT')return;throw e}
    for(const entry of entries){
      if(entry.isSymbolicLink())throw Error('Página pública não pode ser link simbólico.')
      const name=dir+'/'+entry.name
      if(entry.isDirectory())await walk(name)
      else if(entry.isFile()&&name.endsWith('.html'))pages['/'+name]={propertyId:'liv-ipanema',source:name}
    }
  }
  for(const dir of ['maquetes/liv','liv-classico','liv-novo','b/liv-ipanema'])await walk(dir)
  if(!pages['/maquetes/liv/index.html'])throw Error('Entrada pública do LIV ausente.')
  return pages
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
const payload=process.env.PUBLICATION_PAYLOAD??fileURLToPath(new URL('../../publicacao/liv-duplo-20261017/payload',import.meta.url))
const pages=await carregarPaginasPublicas(payload)
await mkdir(new URL('lib/pages/',import.meta.url),{recursive:true})
for(const [path,page] of Object.entries(pages)){
  const bytes=gzipSync(await readFile(join(payload,page.source)),{level:9})
  const file=createHash('sha256').update(bytes).digest('hex')+'.html.gz'
  await writeFile(new URL('lib/pages/'+file,import.meta.url),bytes)
  pages[path]={propertyId:page.propertyId,file,encoding:'gzip'}
}
await writeFile(new URL('lib/public-pages.json',import.meta.url),JSON.stringify(pages))
await build({entryPoints:[fileURLToPath(new URL('index.mjs',import.meta.url))],
  outfile:new URL('lib/index.mjs',import.meta.url).pathname.replace(/^\/(?=[A-Za-z]:)/,''),
  bundle:true,platform:'node',target:'node22',format:'esm',packages:'external',sourcemap:false})
console.log(`${Object.keys(pages).length} páginas públicas com controle de disponibilidade.`)
}

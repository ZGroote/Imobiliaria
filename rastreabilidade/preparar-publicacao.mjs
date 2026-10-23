import {readFile,writeFile,mkdir} from 'node:fs/promises'
import {resolve,join,dirname} from 'node:path'
import {fileURLToPath} from 'node:url'
import {createHash} from 'node:crypto'
import {prepararLiv} from './preparar-liv.mjs'
import {montar} from '../tools/montar_rastreabilidade.mjs'

const root=resolve(fileURLToPath(new URL('..',import.meta.url)))
const release=join(root,'publicacao/liv-duplo-20261017'),payload=join(release,'payload')
const publicOrigin=process.argv[2]??'https://imobilaria-deccb-miniaturas.web.app'
const apiBase='https://southamerica-east1-imobilaria-deccb.cloudfunctions.net/conectaTracking'
const publication=await prepararLiv({release,publicOrigin})
const result=await montar({output:join(root,'publicacao/rastreabilidade','conecta-'+Date.now()),publicOrigin,apiBase})
for(const [file,expected] of Object.entries(result.manifest.files)){
  const bytes=await readFile(join(result.output,file))
  if(createHash('sha256').update(bytes).digest('hex')!==expected)throw Error('Pacote de acesso mudou durante a preparação.')
  const target=join(payload,file);await mkdir(dirname(target),{recursive:true});await writeFile(target,bytes)
}
await writeFile(join(release,'tracking-build.json'),JSON.stringify({publication,...result.manifest},null,2)+'\n')
console.log(JSON.stringify({publicOrigin,apiBase,build:publication.build,runtime:result.release},null,2))

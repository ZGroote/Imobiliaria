import {readFile,writeFile,mkdir} from 'node:fs/promises'
import {resolve,join} from 'node:path'
import {fileURLToPath} from 'node:url'
import {createHash} from 'node:crypto'

const root=resolve(fileURLToPath(new URL('..',import.meta.url)))
export async function prepararLiv({release=join(root,'publicacao/liv-duplo-20261017'),
  publicOrigin='https://imobilaria-deccb-miniaturas.web.app'}={}){
  if(new URL(publicOrigin).origin!==publicOrigin||!publicOrigin.startsWith('https://'))throw Error('Origem HTTPS exata necessária.')
  const payload=join(release,'payload'),classic=join(payload,'liv-classico')
  const [viewer,map,adapter,manifest,self]=await Promise.all([
    readFile(join(classic,'maquete-liv-ipanema.html'),'utf8'),readFile(join(classic,'mapa-liv-ipanema-5km.html'),'utf8'),
    readFile(join(classic,'mapa-retorno.js'),'utf8'),readFile(join(classic,'entrega-manifest.json'),'utf8'),readFile(fileURLToPath(import.meta.url))])
  const build=createHash('sha256').update(viewer).update(map).update(adapter).update(manifest).update(self).digest('hex').slice(0,12)
  const base='/b/liv-ipanema/'+build+'/',directory=join(payload,'b/liv-ipanema',build)
  const defaults=`<script>const livAddress=new URL(location.href);if(!livAddress.searchParams.has('geometria'))livAddress.searchParams.set('geometria','entrada');if(!livAddress.searchParams.has('unidades'))livAddress.searchParams.set('unidades','edificio');history.replaceState(null,'',livAddress.href);</script>`
  const maquete=viewer.replace('<head>','<head><base href="/liv-classico/">'+defaults)
    .replace('href="#stage"',`href="${base}maquete.html#stage"`)
    .replace('href="mapa-liv-ipanema-5km.html"',`href="${base}tour.html"`)
  const tour=map.replace('<html lang="pt-BR">','<html lang="pt-BR"><base href="/liv-classico/">'+defaults)
    .replace('src="mapa-retorno.js?rev=2026-10-12-cache"',`src="${base}mapa-retorno.js"`)
  // O mapa contém um segundo iframe. Seu botão de retorno precisa voltar ao
  // acesso com o mesmo token, inclusive quando usa target=_top.
  const mapAdapter=adapter.replace(/from '\.\//g,"from '/liv-classico/")
    .replace("destination=new URL('./maquete-liv-ipanema.html',location.href)","destination=new URL('./maquete.html',location.href)")
    .replace("const embedded=",`if(window.parent!==window&&window.parent.location.origin===location.origin&&window.parent.location.pathname==='/acesso.html'){destination.href=window.parent.location.href;destination.searchParams.set('pagina','maquete');}\nconst embedded=`)
    .replace("const mapHTML='mapa-runtime/","const mapHTML='/liv-classico/mapa-runtime/")
  if(maquete===viewer||tour===map||mapAdapter===adapter)throw Error('Formato do LIV mudou; revise a entrada rastreável.')
  await mkdir(directory,{recursive:true})
  await Promise.all([writeFile(join(directory,'maquete.html'),maquete),writeFile(join(directory,'tour.html'),tour),writeFile(join(directory,'mapa-retorno.js'),mapAdapter)])
  const config={publicOrigin,panelOrigin:'https://imobilaria-deccb-painel.web.app',
    publications:{'liv-ipanema':{pipelineUnitId:'liv-ipanema',publishedBuild:build}}}
  await writeFile(join(root,'rastreabilidade/functions/publication.json'),JSON.stringify(config,null,2)+'\n')
  await writeFile(join(release,'tracking-publication.json'),JSON.stringify(config,null,2)+'\n')
  return {build,base,...config}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))
  console.log(JSON.stringify(await prepararLiv({publicOrigin:process.argv[2]}),null,2))

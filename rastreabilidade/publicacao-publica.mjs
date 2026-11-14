const unavailable=`<!doctype html><html lang="pt-BR"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Publicação indisponível</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f8fafc;color:#0f172a;font:16px system-ui}main{max-width:34rem;padding:2rem}h1{font-size:1.5rem}p{line-height:1.6;color:#475569}a{color:#0369a1;margin-right:1rem}</style>
<main><h1>Publicação temporariamente indisponível</h1><p>Este imóvel está fora do ar no momento. Quando a imobiliária reativar a publicação, este mesmo endereço voltará a funcionar.</p>
<a href="">Tentar novamente</a><a href="/">Voltar ao site</a></main></html>`

// O HTML sai do Hosting estático: a disponibilidade é relida no servidor a cada abertura.
export function criarPublicacaoPublica({db,pages,loadPage=async page=>page.html,
  log=()=>console.error('Falha ao consultar a publicação pública.')}){
  return async(req,res)=>{
    const path=new URL(req.url,'http://localhost').pathname
    const key=Object.hasOwn(pages,path)?path:path.replace(/\/$/,'')+'/index.html'
    if(!Object.hasOwn(pages,key))return false
    const headers={'Content-Type':'text/html; charset=utf-8','Cache-Control':'private, no-store, max-age=0',
      'X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin'}
    const send=(status,body)=>{res.writeHead(status,headers).end(req.method==='HEAD'?undefined:body);return true}
    if(!['GET','HEAD'].includes(req.method)){headers.Allow='GET, HEAD';return send(405,'Método não permitido.')}
    const page=pages[key]
    try{
      const p=(await db.doc('properties/'+page.propertyId).get()).data()
      const agency=typeof p?.agencyId==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(p.agencyId)
        &&(await db.doc('agencies/'+p.agencyId).get()).data()
      if(p?.status==='active'&&p.publicationReady!==false&&agency?.active===true){
        const body=req.method==='HEAD'?undefined:await loadPage(page)
        if(page.encoding)headers['Content-Encoding']=page.encoding
        return send(200,body)
      }
    }catch{log()}
    headers['Retry-After']='300'
    headers['Content-Security-Policy']="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'self'"
    return send(503,unavailable)
  }
}

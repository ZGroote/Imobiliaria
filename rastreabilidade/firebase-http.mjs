import {Readable} from 'node:stream'

// O framework do Firebase já consumiu o stream HTTP; reutilizar apenas o rawBody
// fornecido pelo framework mantém os limites e a validação JSON do servidor.
export function encaminharFirebase(server,req,res){
  const body=Buffer.isBuffer(req.rawBody)?req.rawBody:Buffer.alloc(0)
  const input=Readable.from(body.length?[body]:[])
  Object.assign(input,{headers:req.headers,method:req.method,url:req.url,socket:req.socket})
  server.emit('request',input,res)
}

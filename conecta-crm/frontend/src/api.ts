export type Account = {id:string;address:string;role:string;connected:boolean;sync_at:string|null};
export type Profile = {id:string;locale:string;website:string;tagline:string;send_enabled:boolean};
export type Classification = {category:string;label:string;priority:string;confidence:number|null;reason?:string;evidence:string;message_id:string|null;review_required:boolean;rule_version?:string;source:'rules'|'operator';response_kind:'human'|'automatic'|'uncertain'|null;review_version:number;blocked:{address:string;reason:string}[]};
export type Thread = {id:string;subject:string;sender:string;snippet:string;last_at:string;message_count:number;unread_count:number;classification:Classification};
export type Message = {id:string;sender:string;recipient:string;subject:string;body_text:string;received_at:string;direction:'inbound'|'outbound';attachments:{id?:string;name:string;size:number|null}[]};
export type Conversation = {id:string;subject:string;messages:Message[];classification:Classification};
let sessionToken: Promise<string> | undefined;
async function request(path:string, body?:unknown, method?:'PUT'):Promise<Response> {
  sessionToken ??= fetch('/api/session').then(async r => {if(!r.ok) throw Error('Não foi possível abrir a sessão local.'); return (await r.json()).token;});
  let token:string;
  try {token = await sessionToken;} catch {sessionToken=undefined;throw Error('Não foi possível abrir a sessão local. Confira se o CRM está em execução.');}
  let response:Response;
  try {response = await fetch('/api'+path, {method:method??(body === undefined?'GET':'POST'),headers:{'X-CRM-Token':token,...(body === undefined?{}:{'Content-Type':'application/json'})},body:body === undefined?undefined:JSON.stringify(body)});}
  catch {throw Error('O CRM local não respondeu. Confira se o aplicativo está em execução.');}
  if(!response.ok) {if(response.status===401) sessionToken=undefined; const error=await response.json(); throw Error(typeof error.detail==='string'?error.detail:'Não foi possível concluir a operação.');}
  return response;
}
export async function api<T>(path:string,body?:unknown,method?:'PUT'):Promise<T>{return (await request(path,body,method)).json();}
export async function assetBlob(id:string):Promise<Blob>{return (await request('/brand-assets/'+encodeURIComponent(id))).blob();}
export async function proposalBlob(id:string,version:number,reviewed:boolean,format:'docx'|'pdf'='docx'):Promise<Blob>{return (await request('/proposals/'+encodeURIComponent(id)+'/'+format+'?version='+version+'&reviewed='+reviewed)).blob();}
export async function attachmentFile(messageId:string,attachmentId:string,accountId:string):Promise<{blob:Blob;name:string}>{
  const response=await request('/mail/messages/'+encodeURIComponent(messageId)+'/attachments/'+encodeURIComponent(attachmentId)+'/download',{account_id:accountId});
  const match=/filename\*=UTF-8''([^;]+)/i.exec(response.headers.get('Content-Disposition')||'');
  if(!match)throw Error('O CRM não retornou o nome do arquivo. Consulte o anexo novamente.');
  return {blob:await response.blob(),name:decodeURIComponent(match[1])};
}

export async function materialBlob(profile:string,kind:string,hash:string):Promise<Blob>{return (await request('/brand-materials/'+encodeURIComponent(profile)+'/'+encodeURIComponent(kind)+'/download?content_hash='+encodeURIComponent(hash))).blob();}

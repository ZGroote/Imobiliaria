export type DraftInput={account_id:string;profile_id:string;recipient:string;subject:string;body_text:string;purpose:string;thread_id:string|null;metadata:{postal_address:string;project_completed:boolean;delivery_confirmed:boolean}};
export type Draft=DraftInput&{id:string;version:number;status:string;content_hash:string;review_errors:string[];send_blockers:string[];updated_at:string;history:{version:number;action:string;actor:string;occurred_at:string}[]};
export type DraftSummary=Pick<Draft,'id'|'recipient'|'subject'|'status'|'version'|'purpose'|'account_id'|'profile_id'|'updated_at'>;
export type Template={id:string;profile_id:string;purpose:string;title:string;subject:string;body:string;required_fields:string[];source_asset_id?:string};
export type Policy={paused:boolean;timezones:Record<string,string>;mode:string;send_enabled:boolean};
export type ReplyContext={account_id:string;thread_id:string;recipient:string;profile_id:string|null;original_subject:string};
export const statusLabels:Record<string,string>={sending:'Envio em andamento',sent:'Enviado',delivery_unknown:'Tentativa incerta · conferir',draft:'Rascunho',pending_review:'Revisão necessária',approved:'Texto aprovado',scheduled:'Agendado para simulação',simulated:'Simulado; não enviado',cancelled:'Cancelado',blocked:'Bloqueado'};
export function inputFrom(draft:Draft):DraftInput{return {account_id:draft.account_id,profile_id:draft.profile_id,recipient:draft.recipient,subject:draft.subject,body_text:draft.body_text,purpose:draft.purpose,thread_id:draft.thread_id,metadata:draft.metadata};}

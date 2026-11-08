export type Campaign={id:string;name:string;version:number;paused:boolean;counts:Record<string,number>};
export type RealControl={paused:boolean;version:number;unknown_count:number;error:string;worker_active:boolean;timezones:Record<string,string>};
export type Delivery={id:string;status:string;status_label:string;error:string;approval_hash:string;draft_id:string;draft_version:number;campaign_id:string|null;scheduled_at:string;recipient_timezone:string;remote_id:string|null;remote_event:string|null;attempted_at:string|null;checked_at:string|null;
  snapshot:{account_id:string;profile_id:string;from_address:string;recipient:string;subject:string;body_text:string;purpose:string;authorization:{basis:string;note:string;observed_on:string;expires_on:string;version:number}};
  events:{action:string;note:string;occurred_at:string}[]};
export const realWhen=(value:string)=>new Date(value).toLocaleString('pt-BR');

export const deliveryStatus:Record<string,string>={prepared:'prévias aguardando autorização',approved:'envios aprovados',sending:'tentativas em andamento',sent:'aceitas pelo provedor',delivered:'entregues segundo o provedor',delayed:'entregas adiadas',bounced:'devolvidas',complained:'reclamações',suppressed:'suprimidas',rejected:'recusadas',unknown:'tentativas incertas',blocked:'bloqueadas',cancelled:'canceladas',not_sent_declared:'ausências de envio declaradas'};
export const deliveryEvent:Record<string,string>={sent:'aceita pelo provedor',delivered:'entregue',delivery_delayed:'entrega adiada',bounced:'devolvida',complained:'reclamação',suppressed:'suprimida',failed:'falha',opened:'abertura informada',clicked:'clique informado'};

import type {CommercialEvent} from './commercialTypes';
import type {ProposalPayload} from './proposalTypes';

export const projectStages:Record<string,string>={briefing:'Briefing',production:'Produção',review:'Revisão',ready:'Pronta para entrega',delivered:'Entregue',aftercare:'Pós-venda',closed:'Concluído',cancelled:'Cancelado'};
export const briefingFields:Record<string,string>={property_details:'Características do imóvel',scope:'Escopo e recursos previstos',materials:'Materiais recebidos e pendências',references:'Identidade visual e referências',schedule:'Cronograma e aprovações'};
export type ProjectPayload={title:string;stage:string;contact_name:string;owner_name:string;location:string;property_details:string;scope:string;materials:string;references:string;schedule:string;next_step:string;due_on:string|null;delivery_url:string;delivery_notes:string;delivered_on:string|null;followup_on:string|null;feedback:string;notes:string};
export type ProjectSummary={id:string;title:string;stage:string;opportunity_id:string;version:number;company_name:string;updated_at:string;next_step:string;due_on:string|null;followup_on:string|null};
export type Project=Omit<ProjectSummary,'next_step'|'due_on'|'followup_on'>&{company_id:string;opportunity_title:string;payload:ProjectPayload;source_proposal:{id:string;version:number;content_hash:string;payload:ProposalPayload}|null;history:CommercialEvent[]};

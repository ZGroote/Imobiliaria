import type {ResearchCompany} from './researchTypes';
export type DirectoryKind='contacts'|'developments';
export type DirectoryPayload={name:string;source_url:string;source_title:string;observed_at:string;confidence:number;notes:string;role?:string;email?:string;channel_url?:string;address?:string;city?:string;state?:string;building_type?:string;stage?:string;stage_as_of?:string|null};
export type DirectoryRecord={id:string;version:number;payload:DirectoryPayload;origin_candidate_id:string|null;history?:{version:number;payload:DirectoryPayload;occurred_at:string}[]};
export type DirectorySeed={payload:DirectoryPayload;origin_candidate_id:string};
export type ReviewedSource={id:string;payload:ResearchCompany};
export const developmentStages:Record<string,string>={unknown:'Estágio não confirmado',under_review:'Em análise',approved:'Aprovado',under_construction:'Em construção',completed_active_sales:'Concluído com venda ativa'};
export const buildingTypes:Record<string,string>={unknown:'Tipo não confirmado',apartments:'Apartamentos',multifamily:'Multifamily',condominium:'Condomínio',single_family:'Casas individuais'};
export const directoryLabels:Record<string,string>={name:'Nome',role:'Função ou departamento',email:'E-mail publicado',channel_url:'Canal público',address:'Endereço conhecido',city:'Cidade',state:'Estado',building_type:'Tipologia',stage:'Estágio',stage_as_of:'Data da evidência do estágio',source_title:'Título da fonte',source_url:'Fonte',observed_at:'Consulta da fonte',confidence:'Confiança declarada',notes:'Observações'};

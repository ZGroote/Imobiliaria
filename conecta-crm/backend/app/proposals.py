import hashlib
import json
import re

from fastapi import HTTPException
from sqlalchemy import text

from . import commercial
from .branding_api import catalog

TEXT_FIELDS=('project_name','contact_name','sender_name','scope','deliverables','materials','timeline','revisions','support','payment_terms')
LABELS_BR={'project_name':'Projeto','contact_name':'Destinatário','sender_name':'Responsável pela proposta','scope':'Escopo',
    'deliverables':'Entregas previstas','materials':'Materiais necessários','timeline':'Prazo e marcos','revisions':'Revisões incluídas',
    'support':'Suporte e disponibilização','payment_terms':'Condições de pagamento','exclusions':'Exclusões e observações'}
LABELS_US={'project_name':'Project','contact_name':'Recipient','sender_name':'Proposal contact','scope':'Scope',
    'deliverables':'Deliverables','materials':'Required materials','timeline':'Schedule and milestones','revisions':'Included revisions',
    'support':'Support and availability','payment_terms':'Payment terms','exclusions':'Exclusions and notes'}


def canonical(value):
    return json.dumps(value,sort_keys=True,ensure_ascii=False,separators=(',',':'))


def digest(value):
    return hashlib.sha256(canonical(value).encode()).hexdigest()


def assets():
    originals=catalog()
    return {key:next(entry['id'] for entry in originals if condition(entry)) for key,condition in {
        'letterhead':lambda e:e['name'].startswith('Papel_Timbrado_'),
        'contract':lambda e:e['name']=='Modelo_de_contrato.docx',
        'briefing':lambda e:e['commercial_stage']=='briefing'}.items()}


def opportunity_snapshot(c,opportunity_id):
    row=commercial.opportunity(c,opportunity_id)
    return dict(opportunity_id=opportunity_id,company_id=row['company_id'],company_name=row['company_name'],
        opportunity_title=row['title'],opportunity_version=row['version'],estimate_minor=row['amount_minor'],
        estimate_currency=row['currency'],source_assets=assets(),format_version=1)


def load(c,proposal_id,version=None):
    row=c.execute(text('SELECT * FROM proposals WHERE id=:id'),dict(id=proposal_id)).mappings().first()
    if not row:raise HTTPException(404,'Proposta não encontrada.')
    saved=c.execute(text('SELECT * FROM proposal_versions WHERE proposal_id=:id AND version=:v'),dict(id=proposal_id,v=version or row['version'])).mappings().first()
    if not saved:raise HTTPException(404,'Versão da proposta não encontrada.')
    value=dict(row,selected_version=saved['version'],payload=json.loads(saved['payload']),snapshot=json.loads(saved['snapshot']),content_hash=saved['content_hash'])
    if digest(dict(payload=value['payload'],snapshot=value['snapshot']))!=value['content_hash']:
        raise HTTPException(409,'O conteúdo desta versão diverge do registro de integridade. Confira o backup.')
    return value


def review_errors(row,current,day):
    payload=row['payload'];errors=[]
    labels=LABELS_BR
    for field in TEXT_FIELDS:
        if not payload[field].strip():errors.append('Preencha '+labels[field].lower()+'.')
    if payload['amount_minor'] is None:errors.append('Confira o preço e a moeda da proposta.')
    if not payload['valid_until']:errors.append('Informe a validade da proposta.')
    elif payload['valid_until']<day:errors.append('A validade da proposta terminou. Revise a data.')
    if any(re.search(r'\{\{.*?\}\}|\[(?:nome|valor|data|prazo|preencher|inserir|name|price|date)[^\]]*\]',payload[field],re.I) for field in (*TEXT_FIELDS,'exclusions')):
        errors.append('Substitua os campos de modelo ainda pendentes.')
    if row['snapshot']['opportunity_version']!=current['opportunity_version']:
        errors.append('A oportunidade mudou. Confira os dados atuais e salve uma nova revisão da proposta.')
    if row['snapshot']['source_assets']!=current['source_assets']:
        errors.append('Os materiais de referência mudaram. Salve uma nova revisão.')
    return errors


def view(c,proposal_id,day,version=None):
    row=load(c,proposal_id,version)
    current=opportunity_snapshot(c,row['opportunity_id'])
    errors=review_errors(row,current,day)
    approved=(row['status']=='approved' and row['selected_version']==row['version']==row['approved_version'] and row['content_hash']==row['approved_hash'] and not errors)
    versions=[dict(r) for r in c.execute(text('SELECT version,content_hash,created_at FROM proposal_versions WHERE proposal_id=:id ORDER BY version DESC'),dict(id=proposal_id)).mappings()]
    return dict(row,current_opportunity=current,review_errors=errors,approval_current=approved,versions=versions,send_enabled=False,client_accepted=False)


def record_version(c,proposal_id,version,payload,snapshot,when):
    hashed=digest(dict(payload=payload,snapshot=snapshot))
    c.execute(text('INSERT INTO proposal_versions VALUES(:id,:v,:p,:s,:h,:d)'),dict(id=proposal_id,v=version,p=canonical(payload),s=canonical(snapshot),h=hashed,d=when.isoformat()))
    return hashed

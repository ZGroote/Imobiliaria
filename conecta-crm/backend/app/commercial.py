"""Relacionamento comercial local, independente do transporte de e-mail."""
import json
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import text

STAGES={'qualification':'Qualificação','contact':'Contato em andamento','demo':'Demonstração',
        'proposal':'Proposta','negotiation':'Negociação','won':'Ganha','lost':'Perdida'}
FIELDS=('title','stage','amount_minor','currency','next_step','due_on','notes')


def company(c,company_id):
    row=c.execute(text('SELECT id,name,website,domain FROM companies WHERE id=:id'),dict(id=company_id)).mappings().first()
    if not row:raise HTTPException(404,'Empresa não encontrada. Cadastre-a após revisar as fontes da pesquisa.')
    return dict(row)


def opportunity(c,opportunity_id):
    row=c.execute(text('SELECT o.*,c.name company_name FROM opportunities o JOIN companies c ON c.id=o.company_id WHERE o.id=:id'),dict(id=opportunity_id)).mappings().first()
    if not row:raise HTTPException(404,'Oportunidade não encontrada.')
    return dict(row)


def event(c,company_id,action,payload,when,opportunity_id=None,actor='operator'):
    c.execute(text('''INSERT INTO commercial_events(company_id,opportunity_id,action,payload,actor,occurred_at)
        VALUES(:c,:o,:a,:p,:actor,:d)'''),dict(c=company_id,o=opportunity_id,a=action,p=json.dumps(payload,ensure_ascii=False),actor=actor,d=when.isoformat()))


def history(c,company_id,opportunity_id=None):
    clause=' AND opportunity_id=:o' if opportunity_id else ''
    return [dict(row,payload=json.loads(row['payload'])) for row in c.execute(text('SELECT * FROM commercial_events WHERE company_id=:c'+clause+' ORDER BY id DESC LIMIT 100'),dict(c=company_id,o=opportunity_id)).mappings()]


def links(c,thread_id=None,company_id=None,opportunity_id=None):
    clauses=[];params={}
    for field,value in [('thread_id',thread_id),('company_id',company_id),('opportunity_id',opportunity_id)]:
        if value is not None:clauses.append('l.'+field+'=:'+field);params[field]=value
    return [dict(r) for r in c.execute(text('''SELECT l.*,c.name company_name,t.subject,t.account_id,t.last_at,o.title opportunity_title
        FROM conversation_links l JOIN companies c ON c.id=l.company_id JOIN threads t ON t.id=l.thread_id
        LEFT JOIN opportunities o ON o.id=l.opportunity_id WHERE '''+' AND '.join(clauses)+' ORDER BY t.last_at DESC,l.id'),params).mappings()]


def merge_links(c,target,previous):
    # Cabeçalhos podem juntar threads depois de um vínculo manual; preservar todos os contextos.
    rows=c.execute(text('SELECT * FROM conversation_links WHERE thread_id=:id'),dict(id=previous)).mappings().all()
    when=datetime.now(timezone.utc)
    for row in rows:
        duplicate=c.execute(text('''SELECT id FROM conversation_links WHERE thread_id=:t AND company_id=:c
            AND opportunity_id IS :o'''),dict(t=target,c=row['company_id'],o=row['opportunity_id'])).scalar()
        if duplicate:
            c.execute(text('DELETE FROM conversation_links WHERE id=:id'),dict(id=row['id']))
        else:
            c.execute(text('UPDATE conversation_links SET thread_id=:t WHERE id=:id'),dict(t=target,id=row['id']))
        event(c,row['company_id'],'thread_links_merged',dict(from_thread=previous,to_thread=target,link_id=row['id'],consolidated=bool(duplicate)),when,row['opportunity_id'],actor='mail_sync')

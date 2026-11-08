"""Pesquisa de uma identidade pública já cadastrada; sem acesso a notas ou correio."""
import json
from typing import Literal
from urllib.parse import urlsplit
from uuid import UUID

from fastapi import APIRouter,HTTPException,Request
from sqlalchemy import text

from . import research_api as jobs
from .research_contract import Data,State,company_domain,public_url

router=APIRouter()


class Prepare(Data):
    request_id:UUID
    confirm:Literal[True]
    state:State
    agent:Literal['codex_assisted','claude_assisted']='codex_assisted'


def identity(c,company_id,state):
    company=c.execute(text('SELECT id,name,domain,website FROM companies WHERE id=:id'),dict(id=company_id)).mappings().first()
    if not company:raise HTTPException(404,'Empresa não encontrada.')
    if not c.execute(text('SELECT 1 FROM company_states WHERE company_id=:id AND state=:s'),dict(id=company_id,s=state)).first():
        raise HTTPException(409,'Escolha um estado de atuação cadastrado e conferido para esta empresa.')
    try:
        site=public_url(company['website'])
        if company_domain(site)!=company['domain'] or not company['name'].strip() or len(company['name'])>240:raise ValueError()
    except ValueError:raise HTTPException(409,'Confira o nome, domínio e site público HTTPS da empresa antes de pesquisar.') from None
    # Only the public origin is shared, never URL paths, queries or fragments.
    origin='https://'+urlsplit(site).hostname+'/'
    return dict(id=company['id'],name=company['name'],domain=company['domain'],website=origin,state=state)


def target(job):
    if job['target_company_id'] is None and job['target_snapshot'] is None:return None
    try:
        value=json.loads(job['target_snapshot'])
        if set(value)!= {'id','name','domain','website','state'} or value['id']!=job['target_company_id'] or value['state']!=job['state']:raise ValueError()
        return value
    except (ValueError,TypeError):raise HTTPException(409,'O vínculo desta pesquisa está inconsistente. Confira o registro e prepare outra tarefa.') from None


def current(c,job):
    frozen=target(job)
    if frozen is None:return True
    try:return frozen==identity(c,frozen['id'],job['state'])
    except HTTPException:return False


def guard(c,job):
    if not current(c,job):raise HTTPException(409,'A identidade pública ou o estado de atuação mudou. Preserve esta tarefa e prepare outra pesquisa com os dados atuais.')
    return target(job)


@router.post('/api/companies/{company_id}/research-jobs')
def prepare(company_id:str,body:Prepare,request:Request):
    job_id=body.request_id.hex
    with request.app.state.engine.begin() as c:
        c.exec_driver_sql('BEGIN IMMEDIATE')
        previous=c.execute(text('SELECT * FROM research_jobs WHERE id=:id'),dict(id=job_id)).mappings().first()
        if previous:
            if (previous['target_company_id'],previous['state'],previous['agent'])!=(company_id,body.state,body.agent):
                raise HTTPException(409,'Esta solicitação já foi usada com outra empresa ou parâmetros.')
            return jobs.view(c,job_id)
        frozen=identity(c,company_id,body.state)
        options=jobs.CreateJob(state=body.state,target_count=1,size_tier='any',agent=body.agent)
        return jobs.prepare_job(c,options,request.app.state.clock(),job_id,frozen)

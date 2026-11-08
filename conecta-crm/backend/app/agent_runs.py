"""Fila de agentes: somente pesquisa pública e pacotes de trechos já revisados."""
import json
from datetime import timedelta, timezone
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import AwareDatetime, Field, StrictBool, StrictInt
from sqlalchemy import text

from . import analysis_api, research_api
from .agent_sandbox import AgentError
from .analysis_contract import Data, Hash
from .mail import rows
from .research_contract import ResearchResult

router = APIRouter()
ACTIVE = ('queued', 'running')
ERRORS = {'cancelled':'Execução cancelada.', 'interrupted':'O CRM foi encerrado durante a execução. Prepare uma nova tentativa.',
          'agent_failed':'O Codex não concluiu. Confira o login local e a instalação antes de tentar novamente.',
          'timeout':'A execução atingiu o limite de 15 minutos.', 'output_too_large':'A saída excedeu o limite.',
          'invalid_result':'O resultado não passou pelo contrato de dados. Nenhum candidato ou decisão foi importado.',
          'source_changed':'O pacote mudou ou já recebeu um resultado. Prepare outra tarefa.',
          'search_limit':'A execução atingiu o limite de consultas web.',
          'unexpected_tool':'O agente tentou usar uma ferramenta não permitida.',
          'isolation_not_verified':'O isolamento não foi comprovado. A fila foi pausada.',
          'isolation_probe_unavailable':'Não foi possível preparar a sonda de isolamento.',
          'isolation_probe_cleanup_failed':'A limpeza da credencial fictícia da sonda falhou. A fila foi pausada.',
          'codex_installation_unavailable':'Instalação oficial do Codex para Windows não encontrada.'}


class Enqueue(Data):
    request_id: UUID
    input_hash: Hash
    confirm: Literal[True]
    scheduled_at: AwareDatetime | None = None


class EnqueueAnalysis(Enqueue):
    account_id: Literal['demo','contact','team']
    share_reviewed_excerpts: Literal[True]


class Control(Data):
    version: StrictInt = Field(ge=1)
    paused: StrictBool


class Confirm(Data):
    confirm: Literal[True]


def event(c, run_id, action, when):
    c.execute(text('INSERT INTO agent_run_events(run_id,action,occurred_at) VALUES(:r,:a,:d)'),
              dict(r=run_id, a=action, d=when.isoformat()))


def view(c, run_id):
    selected = rows(c,'SELECT * FROM agent_runs WHERE id=:id',id=run_id)
    if not selected:
        raise HTTPException(404,'Execução não encontrada.')
    row = selected[0]
    row['error'] = ERRORS.get(row['error_code'], 'Falha na execução.' if row['error_code'] else '')
    row['events'] = rows(c,'SELECT action,occurred_at FROM agent_run_events WHERE run_id=:id ORDER BY id DESC LIMIT 20',id=run_id)
    return row


def packet(c, kind, reference_id, account_id=None):
    if kind == 'research':
        job = research_api.load(c,reference_id)
        if job['status']=='cancelled' or job['result_hash']:
            raise HTTPException(409,'A pesquisa foi cancelada ou já tem resultado.')
        if job['agent']!='codex_assisted':
            raise HTTPException(409,'Claude continua no fluxo assistido de exportação/importação.')
        return dict(prompt=job['prompt'],schema=ResearchResult.model_json_schema(),input_hash=job['input_hash'])
    row = analysis_api.view(c,reference_id,account_id)
    if row['agent']!='codex_assisted' or row['result']:
        raise HTTPException(409,'Este pacote usa outro agente ou já tem resultado.')
    return analysis_api.packet(c,reference_id,account_id)


def enqueue(c, kind, reference_id, body, when):
    rid = body.request_id.hex
    existing = rows(c,'SELECT * FROM agent_runs WHERE id=:id',id=rid)
    account = getattr(body,'account_id',None)
    if existing:
        row = existing[0]
        if (row['kind'],row['reference_id'],row['account_id'],row['input_hash']) != (kind,reference_id,account,body.input_hash):
            raise HTTPException(409,'Esta solicitação já foi usada com outro pacote.')
        return view(c,rid)
    value = packet(c,kind,reference_id,account)
    if value['input_hash']!=body.input_hash:
        raise HTTPException(409,'O pacote mudou. Reabra a tarefa antes de executar.')
    scheduled = body.scheduled_at.astimezone(timezone.utc) if body.scheduled_at else when
    if scheduled < when-timedelta(minutes=1) or scheduled > when+timedelta(days=7):
        raise HTTPException(422,'Escolha agora ou uma data nos próximos sete dias.')
    if rows(c,"SELECT id FROM agent_runs WHERE kind=:k AND reference_id=:r AND status IN ('queued','running')",k=kind,r=reference_id):
        raise HTTPException(409,'Este pacote já tem execução aguardando ou em andamento.')
    if len(rows(c,"SELECT id FROM agent_runs WHERE status='queued'"))>=50:
        raise HTTPException(409,'A fila já tem 50 execuções aguardando. Conclua ou cancele antes de adicionar.')
    c.execute(text('''INSERT INTO agent_runs(id,kind,reference_id,account_id,input_hash,status,scheduled_at,created_at)
        VALUES(:id,:k,:r,:a,:h,'queued',:s,:d)'''),
        dict(id=rid,k=kind,r=reference_id,a=account,h=body.input_hash,s=scheduled.isoformat(),d=when.isoformat()))
    event(c,rid,'queued_after_confirmation',when)
    return view(c,rid)


def cancel_reference(c, kind, reference_id, when):
    for row in rows(c,"SELECT id FROM agent_runs WHERE kind=:k AND reference_id=:r AND status IN ('queued','running')",k=kind,r=reference_id):
        c.execute(text("UPDATE agent_runs SET status='cancelled',error_code='cancelled',finished_at=:d WHERE id=:id"),dict(id=row['id'],d=when.isoformat()))
        event(c,row['id'],'cancelled',when)


@router.get('/api/agent-runs/control')
def control(request:Request):
    with request.app.state.engine.connect() as c:
        value = rows(c,'SELECT * FROM agent_control WHERE id=1')[0]
    return dict(value,paused=bool(value['paused']),verified=bool(value['verified']),
                worker_active=request.app.state.agent_worker.owns_lock,runs_while_open=True,
                error=ERRORS.get(value['error_code'],''),worker_error=request.app.state.agent_worker.last_error,
                send_enabled=False)


@router.put('/api/agent-runs/control')
def save_control(body:Control,request:Request):
    with request.app.state.engine.begin() as c:
        c.exec_driver_sql('BEGIN IMMEDIATE')
        old = rows(c,'SELECT * FROM agent_control WHERE id=1')[0]
        if old['version']!=body.version:
            raise HTTPException(409,'O controle mudou. Atualize a fila antes de alterar.')
        if not body.paused and not old['verified']:
            raise HTTPException(409,'Confira o isolamento antes de ativar a fila.')
        c.execute(text('UPDATE agent_control SET paused=:p,version=version+1 WHERE id=1'),dict(p=int(body.paused)))
    return control(request)


@router.post('/api/agent-runs/check')
def check(body:Confirm,request:Request):
    code = None
    try:
        result = request.app.state.agent_worker.runner.check()
        if result.get('available') is not True:
            raise AgentError('isolation_not_verified')
    except AgentError as error:
        code=error.code
    with request.app.state.engine.begin() as c:
        c.execute(text('UPDATE agent_control SET verified=:v,checked_at=:d,error_code=:e,paused=CASE WHEN :v=0 THEN 1 ELSE paused END,version=version+1 WHERE id=1'),
                  dict(v=int(code is None),d=request.app.state.clock().isoformat(),e=code))
    return control(request)


@router.get('/api/agent-runs')
def listing(request:Request,kind:Literal['research','analysis']|None=None,reference_id:str=Query('',max_length=128),offset:int=Query(0,ge=0)):
    with request.app.state.engine.connect() as c:
        clause="WHERE (:k IS NULL OR kind=:k) AND (:r='' OR reference_id=:r)"
        params=dict(k=kind,r=reference_id,o=offset)
        total=c.execute(text('SELECT count(*) FROM agent_runs '+clause),params).scalar_one()
        items=rows(c,'SELECT id FROM agent_runs '+clause+' ORDER BY created_at DESC,id LIMIT 25 OFFSET :o',**params)
        return dict(total=total,items=[view(c,item['id']) for item in items],send_enabled=False)


@router.get('/api/agent-runs/{run_id}')
def detail(run_id:str,request:Request):
    with request.app.state.engine.connect() as c:return view(c,run_id)


@router.post('/api/agent-runs/{run_id}/cancel')
def cancel(run_id:str,body:Confirm,request:Request):
    with request.app.state.engine.begin() as c:
        c.exec_driver_sql('BEGIN IMMEDIATE')
        row=view(c,run_id)
        if row['status'] in ACTIVE:
            cancel_reference(c,row['kind'],row['reference_id'],request.app.state.clock())
    request.app.state.agent_worker.signal_cancel(run_id)
    with request.app.state.engine.connect() as c:return view(c,run_id)


@router.post('/api/jobs/{job_id}/run')
def run_research(job_id:str,body:Enqueue,request:Request):
    with request.app.state.engine.begin() as c:
        c.exec_driver_sql('BEGIN IMMEDIATE')
        return enqueue(c,'research',job_id,body,request.app.state.clock())


@router.post('/api/thread-analyses/{analysis_id}/run')
def run_analysis(analysis_id:str,body:EnqueueAnalysis,request:Request):
    with request.app.state.engine.begin() as c:
        c.exec_driver_sql('BEGIN IMMEDIATE')
        return enqueue(c,'analysis',analysis_id,body,request.app.state.clock())

import json
from typing import Literal

from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import Field, StrictInt, model_validator
from sqlalchemy import text

from .analysis_contract import Data, Hash
from .mail import rows
from .research_api import encoded
from .research_contract import STATES as US_STATES
from . import qualification as q

router = APIRouter(prefix='/api/qualifications')


class Weights(Data):
    relevance: StrictInt = Field(ge=1, le=96)
    stage: StrictInt = Field(ge=1, le=96)
    recurrence: StrictInt = Field(ge=1, le=96)
    evidence: StrictInt = Field(ge=1, le=96)
    demo: StrictInt = Field(ge=1, le=96)

    @model_validator(mode='after')
    def total(self):
        if sum(self.model_dump().values()) != 100:
            raise ValueError('Os cinco pesos devem somar 100 pontos.')
        return self


class PolicyInput(Data):
    version: StrictInt = Field(ge=1, le=2_147_483_647)
    weights: Weights
    note: str = Field(min_length=1, max_length=1000)


class Factor(Data):
    points: StrictInt | None = Field(None, ge=0, le=100)
    reason: str = Field('', max_length=1000)
    source_ids: list[str] = Field(default_factory=list, max_length=5)

    @model_validator(mode='after')
    def justified(self):
        if self.points is not None and (len(self.reason) < 5 or not self.source_ids):
            raise ValueError('Cada nota, inclusive zero, exige justificativa e fonte cadastrada.')
        if len(set(self.source_ids)) != len(self.source_ids) or any(not 1 <= len(s) <= 150 for s in self.source_ids):
            raise ValueError('Fontes repetidas ou inválidas.')
        return self


class Criteria(Data):
    relevance: Factor
    stage: Factor
    recurrence: Factor
    evidence: Factor
    demo: Factor


class AssessmentInput(Data):
    version: StrictInt = Field(ge=0, le=2_147_483_647)
    policy_version: StrictInt = Field(ge=1, le=2_147_483_647)
    basis_hash: Hash
    criteria: Criteria
    note: str = Field('', max_length=2000)
    sources_confirmed: Literal[True]

    @model_validator(mode='after')
    def meaningful(self):
        if not self.note and not any(f.points is not None or f.reason or f.source_ids for f in self.criteria.__dict__.values()):
            raise ValueError('Preencha ao menos uma avaliação ou observação antes de salvar.')
        return self


@router.get('/policy')
def policy(request: Request):
    with request.app.state.engine.connect() as c:
        return q.policy(c, history=True)


@router.put('/policy')
def save_policy(body: PolicyInput, request: Request):
    with request.app.state.engine.begin() as c:
        c.exec_driver_sql('BEGIN IMMEDIATE')
        current = q.policy(c)
        if current['version'] != body.version:
            raise HTTPException(409, 'Os critérios mudaram em outra tela. Reabra o modelo antes de salvar.')
        weights = body.weights.model_dump()
        if current['weights'] != weights:
            c.execute(text('INSERT INTO qualification_policy_history VALUES(:v,:w,:n,:d)'),
                      dict(v=current['version']+1, w=encoded(weights), n=body.note, d=request.app.state.clock().isoformat()))
        return q.policy(c, history=True)


@router.get('/companies/{company_id}')
def assessment(company_id: str, request: Request):
    with request.app.state.engine.connect() as c:
        return q.view(c, company_id)


@router.put('/companies/{company_id}')
def save_assessment(company_id: str, body: AssessmentInput, request: Request):
    with request.app.state.engine.begin() as c:
        c.exec_driver_sql('BEGIN IMMEDIATE')
        current = q.view(c, company_id)
        if body.version != current['assessment']['version']:
            raise HTTPException(409, 'A avaliação mudou em outra tela. Reabra antes de salvar.')
        if body.policy_version != current['policy']['version'] or body.basis_hash != current['basis_hash']:
            raise HTTPException(409, 'Os critérios ou a base cadastral mudaram. Reabra e confira as notas e fontes.')
        criteria = body.criteria.model_dump()
        catalog = {s['id']: s for s in current['sources']}
        selected = set()
        for key, factor in criteria.items():
            if factor['points'] is not None and factor['points'] > current['policy']['weights'][key]:
                raise HTTPException(422, 'A nota excede o peso atual do critério.')
            if any(s not in catalog for s in factor['source_ids']):
                raise HTTPException(422, 'Use somente fontes cadastradas para esta empresa.')
            selected.update(factor['source_ids'])
        payload = dict(criteria=criteria, note=body.note, policy_version=body.policy_version,
                       weights=current['policy']['weights'], basis_hash=body.basis_hash,
                       source_snapshot=[catalog[s] for s in sorted(selected)])
        old = rows(c, 'SELECT payload FROM company_qualifications WHERE company_id=:c', c=company_id)
        if old and json.loads(old[0]['payload']) == payload:
            return current
        version = body.version+1
        values = dict(c=company_id, v=version, p=encoded(payload), d=request.app.state.clock().isoformat())
        c.execute(text('''INSERT INTO company_qualifications VALUES(:c,:v,:p,:d)
            ON CONFLICT(company_id) DO UPDATE SET version=excluded.version,payload=excluded.payload,updated_at=excluded.updated_at'''), values)
        c.execute(text('INSERT INTO qualification_history VALUES(:c,:v,:p,:d)'), values)
        return q.view(c, company_id)


@router.get('')
def ranking(request: Request, search: str = Query('', max_length=200), state: str = '',
            status: Literal['all', 'not_assessed', 'incomplete', 'needs_review', 'complete'] = 'all',
            offset: int = Query(0, ge=0), limit: int = Query(25, ge=1, le=100)):
    if state and state not in US_STATES:
        raise HTTPException(422, 'Estado inválido.')
    with request.app.state.engine.connect() as c:
        companies = rows(c, '''SELECT c.* FROM companies c WHERE
            (:q='' OR instr(lower(c.name),lower(:q))>0 OR instr(c.domain,lower(:q))>0)
            AND (:s='' OR EXISTS(SELECT 1 FROM company_states cs WHERE cs.company_id=c.id AND cs.state=:s))''', q=search, s=state)
        current_policy = q.policy(c)
        basis = q.signatures(c, companies)
        saved = {r['company_id']: json.loads(r['payload']) for r in rows(c, 'SELECT company_id,payload FROM company_qualifications')}
        items = [dict(company, **q.metrics(saved.get(company['id']), current_policy, basis[company['id']])) for company in companies]
    counts = {key: sum(item['status'] == key for item in items) for key in q.STATES}
    items = [item for item in items if status == 'all' or item['status'] == status]
    items.sort(key=lambda item: (not item['eligible'], -(item['score'] or 0) if item['eligible'] else 0, item['name'].casefold(), item['id']))
    return dict(items=items[offset:offset+limit], total=len(items), counts=counts, policy=current_policy,
                status_labels=q.STATES, send_enabled=False, contact_authorized=False)

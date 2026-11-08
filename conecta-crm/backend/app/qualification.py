"""Qualificação manual. Nenhuma chamada externa ou decisão de contato é realizada."""
import json

from sqlalchemy import bindparam, text

from .commercial import company
from .mail import rows
from .research_api import digest

FACTORS = {'relevance': 'Relevância para a plataforma 3D', 'stage': 'Estágio comercial',
           'recurrence': 'Quantidade e recorrência de projetos', 'evidence': 'Qualidade das evidências e contatos',
           'demo': 'Adequação da demonstração'}
STATES = {'not_assessed': 'Sem avaliação', 'incomplete': 'Avaliação parcial',
          'needs_review': 'Requer nova conferência', 'complete': 'Completa na base cadastrada'}


def policy(c, history=False):
    row = rows(c, 'SELECT * FROM qualification_policy_history ORDER BY version DESC LIMIT 1')[0]
    value = dict(row, weights=json.loads(row['weights']), factors=FACTORS, send_enabled=False)
    if history:
        value['history'] = [dict(r, weights=json.loads(r['weights'])) for r in rows(c,
            'SELECT * FROM qualification_policy_history ORDER BY version DESC LIMIT 20')]
    return value


def signatures(c, companies):
    snapshots = {r['id']: dict(company={k: r[k] for k in ('id', 'name', 'website', 'domain')}, states=[], research=[], contacts=[], developments=[]) for r in companies}
    if not snapshots:
        return {}
    definitions = [
        ('states', 'SELECT company_id,state FROM company_states WHERE company_id IN :ids ORDER BY company_id,state', ('state',)),
        ('research', "SELECT company_id,id,content_hash FROM job_candidates WHERE status='approved' AND company_id IN :ids ORDER BY company_id,id", ('id', 'content_hash')),
        ('contacts', 'SELECT company_id,id,version FROM company_contacts WHERE company_id IN :ids ORDER BY company_id,id', ('id', 'version')),
        ('developments', 'SELECT company_id,id,version FROM developments WHERE company_id IN :ids ORDER BY company_id,id', ('id', 'version')),
    ]
    for kind, sql, keys in definitions:
        query = text(sql).bindparams(bindparam('ids', expanding=True))
        for row in c.execute(query, dict(ids=list(snapshots))).mappings():
            snapshots[row['company_id']][kind].append([row[k] for k in keys])
    return {cid: digest(snapshot) for cid, snapshot in snapshots.items()}


def sources(c, company_id):
    result = []

    def append(source_id, kind, item, revision, name=''):
        result.append(dict(id=source_id, kind=kind, name=name, title=item['source_title'],
                           url=item['source_url'], observed_at=item['observed_at'], revision=revision))

    for candidate in rows(c, "SELECT id,payload,content_hash FROM job_candidates WHERE company_id=:c AND status='approved' ORDER BY id", c=company_id):
        data = json.loads(candidate['payload'])
        for kind in ('evidence', 'projects', 'contacts'):
            for index, item in enumerate(data[kind]):
                append(f"research:{candidate['id']}:{kind}:{index}", 'Pesquisa aprovada', item,
                       candidate['content_hash'], item.get('name', item.get('claim', '')))
    for table, label in [('company_contacts', 'Contato cadastrado'), ('developments', 'Empreendimento cadastrado')]:
        for row in rows(c, f'SELECT id,payload,version FROM {table} WHERE company_id=:c ORDER BY id', c=company_id):
            item = json.loads(row['payload'])
            append(table+':'+row['id'], label, item, str(row['version']), item['name'])
    return result


def empty_criteria():
    return {key: dict(points=None, reason='', source_ids=[]) for key in FACTORS}


def metrics(payload, current_policy, basis_hash):
    if payload is None:
        return dict(status='not_assessed', eligible=False, score=None, known_points=0, assessed_capacity=0, pending_factors=5)
    criteria = payload['criteria']
    pending = sum(item['points'] is None for item in criteria.values())
    known = sum(item['points'] or 0 for item in criteria.values())
    capacity = sum(payload['weights'][key] for key, item in criteria.items() if item['points'] is not None)
    stale = payload['policy_version'] != current_policy['version'] or payload['basis_hash'] != basis_hash
    status = 'needs_review' if stale else 'incomplete' if pending else 'complete'
    return dict(status=status, eligible=status == 'complete', score=None if pending else known,
                known_points=known, assessed_capacity=capacity, pending_factors=pending)


def view(c, company_id):
    registered = company(c, company_id)
    current_policy = policy(c)
    basis_hash = signatures(c, [registered])[company_id]
    saved = rows(c, 'SELECT * FROM company_qualifications WHERE company_id=:c', c=company_id)
    payload = json.loads(saved[0]['payload']) if saved else None
    assessment = dict(version=saved[0]['version'], updated_at=saved[0]['updated_at'], **payload) if saved else dict(
        version=0, updated_at=None, criteria=empty_criteria(), note='', policy_version=current_policy['version'],
        weights=current_policy['weights'], basis_hash=basis_hash, source_snapshot=[])
    history = [dict(r, payload=json.loads(r['payload'])) for r in rows(c,
        'SELECT version,payload,occurred_at FROM qualification_history WHERE company_id=:c ORDER BY version DESC LIMIT 50', c=company_id)]
    return dict(company=registered, policy=current_policy, basis_hash=basis_hash, sources=sources(c, company_id),
                assessment=assessment, history=history, **metrics(payload, current_policy, basis_hash),
                send_enabled=False, contact_authorized=False)

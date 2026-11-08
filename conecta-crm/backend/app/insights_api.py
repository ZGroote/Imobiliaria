from fastapi import APIRouter, Request
from sqlalchemy import text

from .commercial import STAGES
from .commercial_api import today
from . import proposals

router=APIRouter()


@router.get('/api/insights')
def insights(request: Request):
    day=today(request)
    with request.app.state.engine.connect() as c:
        counts=dict(c.execute(text('SELECT stage,count(*) FROM opportunities GROUP BY stage')).all())
        companies=c.execute(text('SELECT count(*) FROM companies')).scalar_one()
        pending=c.execute(text("SELECT count(*) FROM job_candidates j JOIN research_jobs r ON r.id=j.job_id WHERE j.status='pending' AND r.status!='cancelled'")).scalar_one()
        overdue=c.execute(text("SELECT count(*) FROM opportunities WHERE stage NOT IN ('won','lost') AND due_on<:d"),dict(d=day)).scalar_one()
        money={currency:dict(open=0,won=0,lost=0) for currency in ('BRL','USD')}
        unpriced=c.execute(text('SELECT count(*) FROM opportunities WHERE amount_minor IS NULL')).scalar_one()
        for currency,stage,total in c.execute(text('SELECT currency,stage,sum(amount_minor) FROM opportunities WHERE currency IS NOT NULL GROUP BY currency,stage')):
            money[currency][stage if stage in ('won','lost') else 'open']+=total
        actions=[dict(row) for row in c.execute(text('''SELECT o.id,o.title,o.next_step,o.due_on,o.stage,c.name company_name
            FROM opportunities o JOIN companies c ON c.id=o.company_id
            WHERE o.stage NOT IN ('won','lost') AND o.due_on IS NOT NULL ORDER BY o.due_on,o.id LIMIT 8''')).mappings()]
        proposal_count=c.execute(text('SELECT count(*) FROM proposals')).scalar_one()
        reviewed=sum(proposals.view(c,pid,day)['approval_current'] for pid in c.execute(text("SELECT id FROM proposals WHERE status='approved'")).scalars().all())
        triage=dict(c.execute(text("""SELECT coalesce(ec.response_kind,'unreviewed'),count(*) FROM effective_classifications ec
            JOIN messages m ON m.id=ec.message_id WHERE m.account_id IN ('contact','team') GROUP BY coalesce(ec.response_kind,'unreviewed')""")).all())
    closed=counts.get('won',0)+counts.get('lost',0)
    return dict(today=day,companies=companies,pending_candidates=pending,opportunities=sum(counts.values()),
        open_opportunities=sum(n for stage,n in counts.items() if stage not in ('won','lost')),overdue_actions=overdue,
        stages={stage:counts.get(stage,0) for stage in STAGES},estimates_by_currency=money,unpriced_opportunities=unpriced,
        proposals=proposal_count,current_approved_proposals=reviewed,closed_count=closed,won_share=round(counts.get('won',0)/closed*100,1) if closed else None,next_actions=actions,
        response_reviews={kind:triage.get(kind,0) for kind in ('human','automatic','uncertain','unreviewed')},
        response_review_total=sum(triage.values()),
        note='Valores são estimativas cadastradas, não receita recebida. Respostas humanas e aceite de clientes não são inferidos.',send_enabled=False)

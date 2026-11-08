import json
import threading
from datetime import timedelta
from uuid import uuid4

from sqlalchemy import text

from test_research_jobs import setup,job,result,NOW
from test_thread_analyses import analysis,prepare as prepare_analysis,result as analysis_result
from backend.app.agent_sandbox import AgentError
from backend.app.agent_worker import AgentWorker


class FakeRunner:
    def __init__(self,output):self.output=output;self.packets=[]
    def check(self):return dict(available=True,isolation='fixture')
    def run(self,packet,cancelled,progress,**kwargs):
        self.packets.append((packet,kwargs));progress('web_search',2)
        return self.output(packet,cancelled) if callable(self.output) else self.output


def queue(client,j,**changes):
    body=dict(request_id=str(uuid4()),input_hash=j['input_hash'],confirm=True,**changes)
    return client.post('/api/jobs/'+j['id']+'/run',json=body)


def enable(client,app,output):
    app.state.agent_worker.runner=FakeRunner(output)
    value=client.post('/api/agent-runs/check',json=dict(confirm=True)).json()
    assert value['verified']
    response=client.put('/api/agent-runs/control',json=dict(version=value['version'],paused=False))
    assert response.status_code==200,response.text
    return app.state.agent_worker


def test_queue_paused_by_default_then_imports_candidates_without_business_effects(setup):
    client,app=setup;j=job(client);run=queue(client,j).json()
    assert run['status']=='queued'
    worker=app.state.agent_worker;worker.tick()
    assert client.get('/api/agent-runs/'+run['id']).json()['status']=='queued'
    worker=enable(client,app,result(job_id=j['id']));worker.tick()
    value=client.get('/api/agent-runs/'+run['id']).json()
    assert value['status']=='completed' and value['search_count']==2 and value['result_hash']
    assert client.get('/api/jobs/'+j['id']).json()['counts']==dict(pending=1,approved=0,rejected=0)
    packet,options=worker.runner.packets[0]
    assert set(packet)=={'prompt','schema','input_hash'} and options==dict(web=True)
    with app.state.engine.connect() as c:
        for table in ('companies','outbound_drafts','opportunities'):
            assert c.execute(text('SELECT count(*) FROM '+table)).scalar_one()==0


def test_queue_idempotency_duplicate_confirmation_hash_and_agent_guards(setup):
    client,app=setup;j=job(client)
    body=dict(request_id=str(uuid4()),input_hash=j['input_hash'],confirm=True)
    first=client.post('/api/jobs/'+j['id']+'/run',json=body).json()
    assert client.post('/api/jobs/'+j['id']+'/run',json=body).json()['id']==first['id']
    assert queue(client,j).status_code==409
    assert client.post('/api/jobs/'+j['id']+'/run',json=dict(body,confirm=False)).status_code==422
    assert client.post('/api/jobs/'+j['id']+'/run',json=dict(body,command='shell')).status_code==422
    client.post('/api/agent-runs/'+first['id']+'/cancel',json=dict(confirm=True))
    assert queue(client,dict(j,input_hash='0'*64)).status_code==409
    other=job(client,agent='claude_assisted')
    assert queue(client,other).status_code==409
    policy=client.get('/api/agent-runs/control').json()
    assert client.put('/api/agent-runs/control',json=dict(version=policy['version'],paused=False)).status_code==409


def test_scheduled_execution_waits_and_manual_import_requires_cancel(setup):
    client,app=setup;j=job(client)
    assert queue(client,j,scheduled_at=(NOW+timedelta(days=8)).isoformat()).status_code==422
    run=queue(client,j,scheduled_at=(NOW+timedelta(hours=1)).isoformat()).json()
    worker=enable(client,app,result(job_id=j['id']));worker.tick()
    assert worker.runner.packets==[]
    assert client.post('/api/jobs/'+j['id']+'/import',json=dict(result=result(job_id=j['id']))).status_code==409
    app.state.clock=lambda:NOW+timedelta(hours=1)
    worker.tick()
    assert client.get('/api/agent-runs/'+run['id']).json()['status']=='completed'


def test_cancel_wins_over_late_result_and_other_tick_does_not_start_second_agent(setup):
    client,app=setup;j=job(client);run=queue(client,j).json();entered=threading.Event();release=threading.Event()
    def output(packet,cancelled):entered.set();assert release.wait(5);return result(job_id=j['id'])
    worker=enable(client,app,output);thread=threading.Thread(target=worker.tick);thread.start()
    assert entered.wait(5);worker.tick()
    assert len(worker.runner.packets)==1
    assert client.post('/api/agent-runs/'+run['id']+'/cancel',json=dict(confirm=True)).json()['status']=='cancelled'
    release.set();thread.join(5);assert not thread.is_alive()
    assert client.get('/api/jobs/'+j['id']).json()['candidates']==[]
    assert worker.cancelled.is_set()


def test_cancel_whole_job_cancels_queued_execution(setup):
    client,app=setup;j=job(client);run=queue(client,j).json()
    client.post('/api/jobs/'+j['id']+'/cancel',json=dict(confirm=True))
    assert client.get('/api/agent-runs/'+run['id']).json()['status']=='cancelled'


def test_invalid_or_unavailable_agent_never_imports_and_isolation_failure_pauses(setup):
    client,app=setup;j=job(client);run=queue(client,j).json();worker=enable(client,app,dict(companies=[]));worker.tick()
    assert client.get('/api/agent-runs/'+run['id']).json()['error_code']=='invalid_result'
    assert client.get('/api/jobs/'+j['id']).json()['candidates']==[]
    def fail(*args):raise AgentError('isolation_not_verified')
    worker.runner.output=fail;run=queue(client,j).json();worker.tick()
    assert client.get('/api/agent-runs/'+run['id']).json()['error_code']=='isolation_not_verified'
    policy=client.get('/api/agent-runs/control').json();assert policy['paused'] and not policy['verified']


def test_process_lease_and_restart_preserve_interrupted_run_without_retry(setup):
    client,app=setup;j=job(client);run=queue(client,j).json();worker=app.state.agent_worker
    assert worker.acquire()
    other=AgentWorker(app,FakeRunner({}));assert not other.acquire()
    with app.state.engine.begin() as c:c.execute(text("UPDATE agent_runs SET status='running' WHERE id=:id"),dict(id=run['id']))
    worker.stop();assert other.acquire()
    assert client.get('/api/agent-runs/'+run['id']).json()['status']=='interrupted'
    other.stop()


def test_analysis_execution_transmits_only_reviewed_aliases_and_disables_web(analysis):
    client,app,_,_=analysis;j=prepare_analysis(analysis)
    worker=enable(client,app,analysis_result(j))
    body=dict(request_id=str(uuid4()),input_hash=j['input_hash'],confirm=True,account_id='contact',share_reviewed_excerpts=True)
    assert client.post('/api/thread-analyses/'+j['id']+'/run',json=dict(body,share_reviewed_excerpts=False)).status_code==422
    assert client.post('/api/thread-analyses/'+j['id']+'/run',json=dict(body,account_id='team')).status_code==404
    run=client.post('/api/thread-analyses/'+j['id']+'/run',json=body).json();worker.tick()
    assert client.get('/api/agent-runs/'+run['id']).json()['status']=='completed'
    packet,options=worker.runner.packets[0];assert options==dict(web=False)
    serialized=json.dumps(packet)
    for forbidden in ('DADO PRIVADO ORIGINAL','UNSELECTED-PRIVATE-CONTENT','person@fixture.invalid'):
        assert forbidden not in serialized
    assert client.get('/api/thread-analyses/'+j['id']+'?account_id=contact').json()['result']['suggestion']['category']=='demo_request'
    with app.state.engine.connect() as c:
        assert c.execute(text('SELECT count(*) FROM classification_reviews')).scalar_one()==0
        assert c.execute(text('SELECT count(*) FROM outbound_drafts')).scalar_one()==0

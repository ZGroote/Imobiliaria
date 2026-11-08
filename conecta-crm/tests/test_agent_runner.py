import io
import json
import threading

import pytest

from backend.app import agent_runner as r
from backend.app.agent_sandbox import AgentError, environment, permission_profile


def test_command_and_environment_cannot_inherit_provider_secrets(tmp_path, monkeypatch):
    monkeypatch.setenv('RESEND_API_KEY', 'FICTITIOUS_SECRET')
    monkeypatch.setenv('HTTP_PROXY', 'https://proxy.invalid')
    monkeypatch.setenv('PYTHONPATH', 'untrusted')
    env = environment(tmp_path)
    assert not any(key in env for key in ('RESEND_API_KEY', 'HTTP_PROXY', 'PYTHONPATH'))
    args = r.arguments(tmp_path/'codex.exe', tmp_path)
    assert '--ignore-user-config' in args and '--ignore-rules' in args and '--ephemeral' in args
    assert '--dangerously-bypass-approvals-and-sandbox' not in args
    assert 'approval_policy="never"' in args and 'windows.sandbox="mxc"' in args
    assert 'features.code_mode_host=true' in args
    for key in ('shell_tool','apps','plugins','hooks','browser_use','view_image','multi_agent'):
        assert 'features.'+key+'=false' in args
    assert 'network={enabled=false}' in permission_profile()
    assert '":root"="read"' not in permission_profile()
    assert r.arguments(tmp_path/'codex.exe', tmp_path, False).count('web_search="disabled"') == 1


def test_schema_copy_is_strict_and_does_not_mutate_contract():
    schema = dict(type='object', properties=dict(notes=dict(type='string', default='')))
    value = r.strict_schema(schema)
    assert value['required'] == ['notes'] and value['additionalProperties'] is False
    assert 'default' not in value['properties']['notes'] and schema['properties']['notes']['default'] == ''


@pytest.fixture
def fake(tmp_path, monkeypatch):
    runner = r.NativeCodex(tmp_path)
    monkeypatch.setattr(runner, 'check', lambda: dict(available=True))
    monkeypatch.setattr(r, 'executable', lambda: tmp_path/'codex.exe')
    monkeypatch.setattr(r.subprocess, 'CREATE_NO_WINDOW', 0, raising=False)
    packet = dict(prompt='Pesquisa fictícia sem conteúdo privado.', schema=dict(type='object', properties={}))
    created = []

    def process(output=b'', result='{}', code=0, cancel=None):
        class Process:
            def __init__(self, args, **kwargs):
                self.stdin = io.BytesIO();self.stdout = io.BytesIO(output);self.pid = 123
                work = args[args.index('-C')+1]
                (r.Path(work)/'result.json').write_text(result, encoding='utf-8')
                created.append((args,kwargs))
                if cancel:cancel.set()
            def poll(self):return code
            def wait(self,timeout=None):return code
        monkeypatch.setattr(r.subprocess,'Popen',Process)
    return runner,packet,process,created


def test_run_imports_only_final_json_and_reports_search_counts(fake):
    runner,packet,process,created = fake
    output = json.dumps(dict(type='item.completed',item=dict(type='web_search',query='FICTITIOUS'))).encode()+b'\n'
    process(output, '{"companies":[]}')
    progress=[]
    assert runner.run(packet,threading.Event(),lambda *event:progress.append(event)) == dict(companies=[])
    assert progress == [('web_search',1)]
    assert created[0][1]['env'].get('RESEND_API_KEY') is None


@pytest.mark.parametrize('result,output,code,error', [
    ('not-json',b'',0,'agent_failed'), ('x'*262145,b'',0,'invalid_result'),
    ('{}',b'',1,'agent_failed'),
    ('{}',b'{"item":{"type":"command_execution"}}\n',0,'unexpected_tool'),
    ('{}',b'{"item":{"type":"mcp_tool_call"}}\n',0,'unexpected_tool'),
    ('{}',b'x'*(4*1024*1024+1),0,'output_too_large'),
])
def test_failed_or_forbidden_run_returns_no_result(fake,result,output,code,error):
    runner,packet,process,_=fake;process(output,result,code)
    with pytest.raises(AgentError,match=error):runner.run(packet,threading.Event(),lambda *event:None)


def test_cancellation_before_and_during_run(fake):
    runner,packet,process,created=fake
    cancel=threading.Event();cancel.set()
    with pytest.raises(AgentError,match='cancelled'):runner.run(packet,cancel,lambda *event:None)
    assert created==[]
    cancel.clear();process(cancel=cancel)
    with pytest.raises(AgentError,match='cancelled'):runner.run(packet,cancel,lambda *event:None)

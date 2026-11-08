import io,re,zlib,base64
from pathlib import Path

import pytest
from sqlalchemy import text

from test_proposals import setup,opportunity,prepare,approve,revise


def streams(data):
    result=[]
    for body in re.findall(rb'stream\r?\n(.*?)\s*endstream',data,re.S):
        try:result.append(zlib.decompress(base64.a85decode(body,adobe=True) if body.endswith(b'~>') else body))
        except (zlib.error,ValueError):pass
    return b'\n'.join(result)


@pytest.mark.parametrize('profile',['BR','US'])
def test_pdf_requires_current_review_and_records_export_without_business_effects(setup,profile):
    client,app=setup;p=prepare(client,opportunity(client),profile_id=profile)
    url='/api/proposals/'+p['id']+'/pdf'
    assert client.get(url+'?reviewed=true').status_code==409
    draft=client.get(url);assert draft.status_code==200,draft.text
    assert draft.content.startswith(b'%PDF-') and draft.headers['content-type']=='application/pdf'
    assert draft.headers['cache-control']=='no-store' and draft.headers['content-disposition'].endswith('.pdf"')
    reviewed=approve(client,p).json();response=client.get(url+'?reviewed=true')
    assert response.status_code==200 and response.content.startswith(b'%PDF-')
    with app.state.engine.connect() as c:
        assert c.execute(text('SELECT count(*) FROM real_deliveries')).scalar_one()==0
        assert c.execute(text('SELECT count(*) FROM outbound_drafts')).scalar_one()==0
        assert c.execute(text("SELECT count(*) FROM commercial_events WHERE action='proposal_exported' AND json_extract(payload,'$.file_format')='pdf'")).scalar_one()==2
    newer=revise(client,reviewed,scope='Nova condição para rever.').json()
    assert newer['version']==2 and client.get(url+'?reviewed=true').status_code==409
    assert client.get(url+'?version=1&reviewed=true').status_code==409
    assert client.get(url+'?version=1').status_code==200


def test_pdf_uses_literal_text_without_active_links_or_embedded_remote_resources(setup):
    client,_=setup;p=prepare(client,opportunity(client),scope='<img src="https://fixture.invalid/pixel.png"/> & <script>run()</script>')
    response=client.get('/api/proposals/'+p['id']+'/pdf');assert response.status_code==200,response.text
    for dangerous in [b'/JavaScript',b'/Launch',b'/URI',b'/EmbeddedFile']:
        assert dangerous not in response.content
    assert b'fixture.invalid/pixel.png' in streams(response.content)


def test_pdf_preserves_multipage_draft_status_and_rejects_excessive_line_breaks(setup):
    client,_=setup;p=prepare(client,opportunity(client),scope=('Long fictional scope with a literal condition. '*40),deliverables=('Another fictional condition. '*60))
    response=client.get('/api/proposals/'+p['id']+'/pdf');assert response.status_code==200,response.text
    assert len(re.findall(rb'/Type\s*/Page\b',response.content))>=2
    p=revise(client,p,scope='x\n'*600,deliverables='x\n'*600).json()
    assert client.get('/api/proposals/'+p['id']+'/pdf').status_code==422


def test_pdf_missing_glyph_is_explicit_and_original_is_always_verified(setup,monkeypatch,tmp_path):
    client,_=setup;p=prepare(client,opportunity(client),scope='Unsupported \U0001f4a9 character')
    assert client.get('/api/proposals/'+p['id']+'/pdf').status_code==422
    p=revise(client,p,scope='Texto simples para conferir a fonte original.').json()
    from backend.app import proposal_docx
    original=next(proposal_docx.ASSETS.glob('Papel_Timbrado*'))
    (tmp_path/original.name).write_bytes(original.read_bytes()+b'alterado')
    monkeypatch.setattr(proposal_docx,'ASSETS',tmp_path)
    assert client.get('/api/proposals/'+p['id']+'/pdf').status_code==409

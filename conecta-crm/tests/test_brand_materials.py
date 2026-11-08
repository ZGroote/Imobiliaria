import hashlib,io
from zipfile import ZipFile
import pytest
from sqlalchemy import text
from test_branding import client


def catalog(client):
 r=client.get('/api/brand-materials');assert r.status_code==200,r.text
 return r.json()['items']


def test_materials_are_derivatives_with_explicit_market_and_stable_hash(client):
 first=catalog(client);second=catalog(client)
 assert len(first)==4 and first==second
 assert {(r['profile_id'],r['kind']) for r in first}=={(p,k) for p in ('BR','US') for k in ('letterhead','signature')}
 assert all(not r['approved'] and not r['send_enabled'] and not r['review_id'] for r in first)
 for row in first:
  r=client.get('/api/brand-materials/'+row['profile_id']+'/'+row['kind']+'/download',params={'content_hash':row['content_hash']})
  assert r.status_code==200 and hashlib.sha256(r.content).hexdigest()==row['content_hash']
  assert r.headers['cache-control']=='no-store'
  if row['kind']=='signature':
   assert 'João Groote' in r.content.decode() and 'Conecta Imóveis 3D' in r.content.decode()
   assert ('conectaimoveis3d.com.br' in r.content.decode())==(row['profile_id']=='BR')
   assert ('+55' in r.content.decode())==(row['profile_id']=='US')
  else:
   with ZipFile(io.BytesIO(r.content)) as z:
    footer=z.read('word/footer1.xml').decode()
    assert ('conectaimoveis3d.com.br' in footer)==(row['profile_id']=='BR')
    assert ('A NEW PERSPECTIVE.' in footer)==(row['profile_id']=='US')


def test_review_is_explicit_hash_bound_versioned_and_has_no_business_effect(client):
 row=catalog(client)[0];url='/api/brand-materials/'+row['profile_id']+'/'+row['kind']+'/review'
 body=dict(confirm=True,content_hash=row['content_hash'],review_id=0,action='approve')
 assert client.post(url,json=dict(body,confirm=False)).status_code==422
 assert client.post(url,json=dict(body,content_hash='0'*64)).status_code==409
 approved=client.post(url,json=body);assert approved.status_code==200,approved.text
 value=approved.json();assert value['approved'] and len(value['history'])==1
 assert client.post(url,json=body).status_code==409
 again=client.post(url,json=dict(body,review_id=value['review_id'])).json();assert len(again['history'])==1
 revoked=client.post(url,json=dict(body,review_id=value['review_id'],action='revoke')).json()
 assert not revoked['approved'] and len(revoked['history'])==2
 app=client.app
 with app.state.engine.connect() as c:
  for name in ['proposals','outbound_drafts','real_deliveries','agent_runs','companies']:
   assert c.execute(text('SELECT count(*) FROM '+name)).scalar_one()==0


def test_changed_derivative_requires_new_review_and_old_download_hash_is_refused(client,monkeypatch):
 from backend.app import brand_materials as m
 row=catalog(client)[0];url='/api/brand-materials/'+row['profile_id']+'/'+row['kind']
 client.post(url+'/review',json=dict(confirm=True,content_hash=row['content_hash'],review_id=0,action='approve'))
 original=m.material
 def changed(profile,kind):
  value=original(profile,kind);value['content']+=b'changed';value['content_hash']=hashlib.sha256(value['content']).hexdigest();return value
 monkeypatch.setattr(m,'material',changed)
 assert not catalog(client)[0]['approved']
 assert client.get(url+'/download',params={'content_hash':row['content_hash']}).status_code==409


def test_original_change_and_unknown_material_are_refused(client,monkeypatch,tmp_path):
 from backend.app import brand_materials as m
 row=catalog(client)[0]
 assert client.get('/api/brand-materials/XX/signature/download',params={'content_hash':row['content_hash']}).status_code==404
 assert client.get('/api/brand-materials/BR/file/download',params={'content_hash':row['content_hash']}).status_code==404
 original=next(m.ASSETS.glob('Papel_Timbrado*'));(tmp_path/original.name).write_bytes(original.read_bytes()+b'changed')
 monkeypatch.setattr(m,'ASSETS',tmp_path)
 assert client.get('/api/brand-materials').status_code==409

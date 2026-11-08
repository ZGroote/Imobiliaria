import copy
import json

import httpx
import pytest

from backend.app.real_transport import RealTransport,verified_status
from backend.app.resend_client import ResendError
from backend.app.test_transport import DeliveryUnknown,TestRejected

KEY='re_fictitious_transport_only'
RID='a'*32
REMOTE='00000000-0000-4000-8000-000000000003'
PAYLOAD=dict(account_id='contact',from_address='contact@conectaimoveis3d.com',recipient='owner@fixture.invalid',subject='Mensagem fictícia',body_text='Somente dados fictícios.',in_reply_to='<fixture@fixture.invalid>')


def remote():
    return dict(id=REMOTE,**{'from':'Conecta Imóveis 3D <'+PAYLOAD['from_address']+'>','to':[PAYLOAD['recipient']]},
                reply_to=[PAYLOAD['from_address']],subject=PAYLOAD['subject'],text=PAYLOAD['body_text'],cc=[],bcc=[],
                tags=[dict(name='crm_delivery',value=RID)],last_event='delivered',message_id='<sent@fixture.invalid>')


def test_send_has_one_recipient_fixed_route_tag_and_stable_idempotency():
    calls=[]
    def send(request):
        calls.append(request);assert request.method=='POST' and str(request.url)=='https://api.resend.com/emails'
        assert request.headers['authorization']=='Bearer '+KEY
        assert request.headers['idempotency-key']=='crm-real-delivery/'+RID
        value=json.loads(request.content)
        assert value['to']==[PAYLOAD['recipient']] and value['text']==PAYLOAD['body_text']
        assert value['tags']==[dict(name='crm_delivery',value=RID)]
        assert value['headers']['In-Reply-To']=='<fixture@fixture.invalid>'
        assert not any(key in value for key in ('html','cc','bcc','attachments','scheduled_at'))
        return httpx.Response(200,json=dict(id=REMOTE))
    transport=RealTransport(KEY,transport=httpx.MockTransport(send))
    try:assert transport.send(PAYLOAD,RID)==REMOTE
    finally:transport.close()
    assert len(calls)==1


@pytest.mark.parametrize('status,body,error',[(400,{},TestRejected),(429,{},TestRejected),(408,{},DeliveryUnknown),
    (409,{},DeliveryUnknown),(500,{},DeliveryUnknown),(302,{},DeliveryUnknown),(200,{},DeliveryUnknown),(200,dict(id='bad'),DeliveryUnknown)])
def test_refusal_or_uncertain_response_is_never_retried(status,body,error):
    calls=[]
    def send(request):calls.append(request);return httpx.Response(status,json=body,headers={'Location':'https://other.invalid'})
    transport=RealTransport(KEY,transport=httpx.MockTransport(send))
    try:
        with pytest.raises(error):transport.send(PAYLOAD,RID)
    finally:transport.close()
    assert len(calls)==1


def test_timeout_does_not_expose_request_or_secret():
    def send(request):raise httpx.ReadTimeout('private '+KEY,request=request)
    transport=RealTransport(KEY,transport=httpx.MockTransport(send))
    try:
        with pytest.raises(DeliveryUnknown) as caught:transport.send(PAYLOAD,RID)
        assert KEY not in str(caught.value)
    finally:transport.close()


@pytest.mark.parametrize('change',[dict(to=['other@fixture.invalid']),dict(reply_to=[]),dict(cc=['other@fixture.invalid']),
    dict(tags=[]),dict(tags=[dict(name='crm_delivery',value='b'*32)]),dict(text='Outra mensagem'),dict(subject='Outro assunto')])
def test_remote_message_must_match_attempt_not_only_email_id(change):
    value=remote();value.update(change)
    with pytest.raises(ResendError):verified_status(value,PAYLOAD,RID)


def test_get_is_read_only_and_open_event_is_not_human_read_confirmation():
    calls=[]
    def read(request):calls.append(request);assert request.method=='GET';return httpx.Response(200,json=remote())
    transport=RealTransport(KEY,transport=httpx.MockTransport(read))
    try:assert verified_status(transport.get(REMOTE),PAYLOAD,RID)['status']=='delivered'
    finally:transport.close()
    value=remote();value['last_event']='opened'
    assert verified_status(value,PAYLOAD,RID)['status']=='sent'
    assert len(calls)==1 and calls[0].url.path=='/emails/'+REMOTE

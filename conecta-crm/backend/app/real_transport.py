"""Texto simples, um destinatário, URLs fixas e reconciliação por etiqueta da tentativa."""
import json
import re
from email.utils import getaddresses

import httpx

from .resend_client import remote_id, ResendError
from .test_transport import DeliveryUnknown, TestRejected


class RealTransport:
    def __init__(self,key,transport=None):
        if not re.fullmatch(r're_[a-zA-Z0-9_]{8,200}',key):raise TestRejected('invalid_credential')
        self.key=key
        self.client=httpx.Client(base_url='https://api.resend.com',transport=transport,timeout=15,
                                follow_redirects=False,trust_env=False)

    def close(self):self.client.close()

    def send(self,payload,delivery_id):
        if not re.fullmatch(r'[a-f0-9]{32}',delivery_id) or payload['account_id'] not in ('contact','team'):
            raise TestRejected('invalid_delivery')
        body=dict(from_='Conecta Imóveis 3D <'+payload['from_address']+'>',to=[payload['recipient']],
                  reply_to=payload['from_address'],subject=payload['subject'],text=payload['body_text'],
                  tags=[dict(name='crm_delivery',value=delivery_id)])
        body['from']=body.pop('from_')
        if payload.get('in_reply_to'):
            if not re.fullmatch(r'<[^<>\s]{1,990}>',payload['in_reply_to']):raise TestRejected('invalid_reply_reference')
            body['headers']={'In-Reply-To':payload['in_reply_to'],'References':payload['in_reply_to']}
        try:
            with self.client.stream('POST','/emails',json=body,headers={'Authorization':'Bearer '+self.key,
                    'Idempotency-Key':'crm-real-delivery/'+delivery_id}) as response:
                if 400<=response.status_code<500 and response.status_code not in (408,409):
                    raise TestRejected('provider_refused_'+str(response.status_code))
                if response.status_code not in (200,201):raise DeliveryUnknown()
                data=bytearray()
                for chunk in response.iter_bytes():
                    data.extend(chunk)
                    if len(data)>16000:raise DeliveryUnknown()
                return remote_id(json.loads(data).get('id'))
        except (httpx.HTTPError,ValueError,AttributeError,ResendError):
            raise DeliveryUnknown() from None

    def get(self,email_id):
        selected=remote_id(email_id)
        try:
            with self.client.stream('GET','/emails/'+selected,headers={'Authorization':'Bearer '+self.key}) as response:
                if response.status_code!=200:raise ResendError('O provedor não disponibilizou o estado da tentativa.')
                data=bytearray()
                for chunk in response.iter_bytes():
                    data.extend(chunk)
                    if len(data)>65536:raise ResendError('Resposta de estado excedeu o limite.')
            value=json.loads(data)
            if remote_id(value.get('id'))!=selected:raise ValueError()
            return value
        except (httpx.HTTPError,ValueError,AttributeError,TypeError):
            raise ResendError('Não foi possível consultar o estado remoto. Nenhum reenvio foi feito.') from None


def addresses(value):
    if isinstance(value,str):value=[value]
    if not isinstance(value,list) or any(not isinstance(v,str) for v in value):return []
    return [address.casefold() for _,address in getaddresses(value)]


def verified_status(value,payload,delivery_id):
    tags=value.get('tags')
    matched=[t.get('value') for t in tags if isinstance(t,dict) and t.get('name')=='crm_delivery'] if isinstance(tags,list) else []
    if (matched!=[delivery_id] or addresses(value.get('from'))!=[payload['from_address'].casefold()]
            or addresses(value.get('to'))!=[payload['recipient'].casefold()]
            or addresses(value.get('reply_to'))!=[payload['from_address'].casefold()]
            or value.get('cc') or value.get('bcc') or value.get('subject')!=payload['subject']
            or value.get('text')!=payload['body_text']):
        raise ResendError('A mensagem remota não corresponde à tentativa do CRM. O estado foi preservado.',409)
    states={'sent':'sent','delivered':'delivered','delivery_delayed':'delayed','bounced':'bounced',
            'complained':'complained','suppressed':'suppressed','failed':'rejected','opened':'sent','clicked':'sent'}
    if value.get('last_event') not in states:
        raise ResendError('O provedor retornou um evento ainda não reconhecido. Confira o painel do provedor.')
    message=value.get('message_id')
    if not isinstance(message,str) or not re.fullmatch(r'<[^<>\s]{1,990}>',message):message=None
    return dict(status=states[value['last_event']],remote_event=value['last_event'],remote_message_id=message)

"""Transporte separado, usado exclusivamente pelo teste individual aprovado."""
import json
import re

import httpx

from .resend_client import remote_id, ResendError


class DeliveryUnknown(Exception):
    pass


class TestRejected(Exception):
    pass


class SenderTestTransport:
    __test__ = False

    def __init__(self,key,transport=None):
        if not re.fullmatch(r're_[a-zA-Z0-9_]{8,200}',key):
            raise TestRejected('invalid_credential')
        self.key = key
        self.client = httpx.Client(base_url='https://api.resend.com',transport=transport,timeout=15,follow_redirects=False,trust_env=False)

    def close(self):
        self.client.close()

    def send(self, payload, test_id):
        if not re.fullmatch(r'[a-f0-9]{32}',test_id) or payload.get('account_id') not in ('contact','team'):
            raise TestRejected('invalid_test')
        body = {'from':'Conecta Imóveis 3D <'+payload['from_address']+'>','to':[payload['recipient']],
                'reply_to':payload['reply_to'],'subject':payload['subject'],'text':payload['body_text']}
        try:
            with self.client.stream('POST','/emails',json=body,headers={'Authorization':'Bearer '+self.key,'Idempotency-Key':'crm-sender-test/'+test_id}) as response:
                if 400<=response.status_code<500 and response.status_code not in (408,409):
                    raise TestRejected('provider_refused_'+str(response.status_code))
                if response.status_code not in (200,201):
                    raise DeliveryUnknown()
                data = bytearray()
                for chunk in response.iter_bytes():
                    data.extend(chunk)
                    if len(data)>16000:raise DeliveryUnknown()
                return remote_id(json.loads(data).get('id'))
        except (httpx.HTTPError,ValueError,AttributeError,ResendError):
            raise DeliveryUnknown() from None

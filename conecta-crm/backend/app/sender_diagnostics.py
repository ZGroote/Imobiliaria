import json
import re

import httpx
from fastapi import HTTPException
from sqlalchemy import text

from .resend_client import ResendError


def dmarc(domain, transport=None):
    if domain not in ('conectaimoveis3d.com','conectaimoveis3d.com.br'):
        return dict(status='unknown',policy=None)
    try:
        with httpx.Client(transport=transport,timeout=8,trust_env=False,follow_redirects=False) as client:
            with client.stream('GET','https://dns.google/resolve',params={'name':'_dmarc.'+domain,'type':'TXT','edns_client_subnet':'0.0.0.0/0'}) as response:
                if response.status_code!=200:
                    return dict(status='unknown',policy=None)
                body = bytearray()
                for chunk in response.iter_bytes():
                    body.extend(chunk)
                    if len(body)>64000:
                        return dict(status='unknown',policy=None)
                result = json.loads(body)
        if result.get('Status')==3:
            return dict(status='missing',policy=None)
        if result.get('Status')!=0 or result.get('TC'):
            return dict(status='unknown',policy=None)
        records = []
        for answer in result.get('Answer',[]):
            if answer.get('type')==16 and answer.get('name','').rstrip('.').casefold()=='_dmarc.'+domain:
                value = answer.get('data','').replace('"','').strip()
                if re.match(r'^v=DMARC1\s*;',value,re.I):
                    records.append(value)
        if len(records)!=1:
            return dict(status='missing' if not records else 'invalid',policy=None)
        tags = [tag.strip().partition('=') for tag in records[0].split(';') if tag.strip()]
        policies = [value.strip().lower() for name,separator,value in tags if name.strip().lower()=='p' and separator]
        valid = len(policies)==1 and policies[0] in ('none','quarantine','reject')
        return dict(status='found' if valid else 'invalid',policy=policies[0] if valid else None)
    except (httpx.HTTPError,ValueError,AttributeError,TypeError):
        return dict(status='unknown',policy=None)


def connected_account(c, account_id):
    account = c.execute(text('SELECT * FROM accounts WHERE id=:id'),dict(id=account_id)).mappings().first()
    if not account or account_id not in ('contact','team') or not account['remote_id'] or not account['verified_at']:
        raise HTTPException(409,'Conecte a caixa de atendimento antes de validar o remetente.')
    return dict(account)


def check(account, client, resolver, now):
    address = account['address']
    domain = address.rsplit('@',1)[1].lower()
    if client.find_inbox(address)!=account['remote_id']:
        raise ResendError('A caixa não corresponde à conexão validada.',409)
    details = client.domain(domain)
    records = details.get('records',[])
    if not isinstance(records,list):
        raise ResendError('O Resend retornou registros de domínio incompatíveis.')
    statuses = {}
    for name in ('SPF','DKIM'):
        selected = [r for r in records if isinstance(r,dict) and str(r.get('record','')).upper()==name]
        statuses[name.lower()] = 'verified' if selected and all(r.get('status')=='verified' for r in selected) else 'unverified'
    dns = resolver(domain)
    capabilities = details.get('capabilities',{})
    sending = isinstance(capabilities,dict) and capabilities.get('sending')=='enabled'
    ready = (details.get('status')=='verified' and sending and statuses['spf']=='verified' and statuses['dkim']=='verified' and dns.get('status')=='found')
    issues = []
    if details.get('status')!='verified':issues.append('O domínio ainda não está verificado no Resend.')
    if not sending:issues.append('O Resend não indica envio habilitado para este domínio.')
    if statuses['spf']!='verified':issues.append('SPF ainda não foi confirmado pelo provedor.')
    if statuses['dkim']!='verified':issues.append('DKIM ainda não foi confirmado pelo provedor.')
    if dns.get('status')!='found':issues.append('DMARC ausente, inválido ou indisponível nesta consulta.')
    warnings = []
    if dns.get('policy')=='none':warnings.append('DMARC está em monitoramento (p=none). Isso não comprova entrega na caixa de entrada.')
    if details.get('open_tracking') or details.get('click_tracking'):warnings.append('O domínio tem rastreamento habilitado no provedor; o teste usa apenas texto simples.')
    return dict(account_id=account['id'],from_address=address,domain=domain,domain_status=details.get('status','unknown'),
                **statuses,dmarc_status=dns.get('status','unknown'),dmarc_policy=dns.get('policy'),ready_for_test=ready,
                campaign_send_enabled=False,checked_at=now.isoformat(),issues=issues,warnings=warnings)


def store_report(c, account_id, report, now):
    c.execute(text('''INSERT INTO sender_diagnostics VALUES(:a,:d,:r)
        ON CONFLICT(account_id) DO UPDATE SET checked_at=excluded.checked_at,report=excluded.report'''),
        dict(a=account_id,d=now.isoformat(),r=json.dumps(report,ensure_ascii=False)))

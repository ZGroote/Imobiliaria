"""Download explícito de anexos recebidos, com vínculo revalidado em cada operação."""
import hashlib
from contextlib import contextmanager
from typing import Literal
from urllib.parse import quote
from uuid import UUID, uuid4

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import Response
from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, ValidationError
from sqlalchemy import text

from .attachment_files import MAX_ATTACHMENT, safe_filename
from .classification import normalize_address
from .mail import identifier, rows
from .mail_operations import MailBusy
from .resend_client import Attachment, RemoteMail, ResendError, remote_id

router = APIRouter(prefix='/api/mail/messages')


class DownloadInput(BaseModel):
    model_config = ConfigDict(extra='forbid')
    account_id: Literal['contact', 'team']


class ReceivedMail(BaseModel):
    id: str
    sender: str = Field(alias='from', max_length=2000)
    message_id: str | None
    attachments: list[Attachment] = Field(max_length=200)


class DownloadMetadata(Attachment):
    size: int = Field(strict=True, ge=0)
    download_url: str = Field(max_length=4096)
    expires_at: AwareDatetime


@contextmanager
def source(request, message_id, account_id):
    state = request.app.state
    lock = state.mail_locks[account_id]
    if not lock.acquire(blocking=False):
        raise MailBusy()
    client = None
    try:
        with state.engine.connect() as c:
            messages = rows(c, 'SELECT * FROM messages WHERE id=:m AND account_id=:a', m=message_id, a=account_id)
            if not messages:
                raise HTTPException(404, 'Mensagem não encontrada nesta caixa.')
            cached = messages[0]
            if cached['direction'] != 'inbound' or not cached['provider_key'].startswith('resend:'):
                raise HTTPException(409, 'O download está disponível somente para anexos recebidos pelo Resend.')
            account = rows(c, 'SELECT * FROM accounts WHERE id=:a', a=account_id)[0]
            candidates = rows(c, 'SELECT remote_id FROM remote_threads WHERE account_id=:a', a=account_id)
        thread_id = next((r['remote_id'] for r in candidates if identifier(account_id, 'resend:'+r['remote_id']) == cached['thread_id']), None)
        if not thread_id or not account['verified_at'] or not account['remote_id']:
            raise HTTPException(409, 'Sincronize a caixa conectada antes de consultar este anexo.')
        key = state.credential_store.get(account_id)
        if not key:
            raise HTTPException(409, 'Reconecte a caixa para consultar anexos no provedor.')
        client = state.mail_client_factory(key)
        if client.find_inbox(account['address']) != account['remote_id']:
            raise HTTPException(409, 'A caixa remota não corresponde à conexão validada.')
        email_id = remote_id(cached['provider_key'][7:])
        try:
            raw = client.inbox_email(account['remote_id'], thread_id, email_id)
            inbox = RemoteMail.model_validate(raw)
            received = ReceivedMail.model_validate(client.received_email(email_id))
            inbox_ids = [remote_id(a.id) for a in inbox.attachments]
            received_ids = [remote_id(a.id) for a in received.attachments]
        except ValidationError:
            raise ResendError('O provedor retornou metadados de anexo incompatíveis.') from None
        sender = normalize_address(cached['sender'])
        if (remote_id(inbox.id) != email_id or remote_id(received.id) != email_id
                or raw.get('direction') != 'inbound' or not cached['message_id']
                or inbox.message_id != cached['message_id'] or received.message_id != cached['message_id']
                or not sender or normalize_address(inbox.sender) != sender or normalize_address(received.sender) != sender
                or len(inbox_ids) != len(set(inbox_ids)) or len(received_ids) != len(set(received_ids))
                or set(inbox_ids) != set(received_ids)):
            raise HTTPException(409, 'A identidade da mensagem ou o vínculo dos anexos não pôde ser confirmado.')
        for a in inbox.attachments:
            other = next(r for r in received.attachments if remote_id(r.id) == remote_id(a.id))
            if (a.size is not None and other.size is not None and a.size != other.size) or a.filename != other.filename:
                raise HTTPException(409, 'Os metadados do anexo mudaram. Consulte novamente.')
        yield client, email_id, received.attachments
    finally:
        try:
            if client:
                client.close()
        finally:
            lock.release()


@router.get('/{message_id}/attachments')
def attachments(message_id: str, account_id: Literal['contact', 'team'], request: Request):
    with source(request, message_id, account_id) as (_, _, items):
        result = [dict(id=remote_id(a.id), name=safe_filename(a.filename), size=a.size,
                       downloadable=a.size is None or a.size <= MAX_ATTACHMENT) for a in items]
    return dict(items=result, max_bytes=MAX_ATTACHMENT, send_enabled=False)


@router.post('/{message_id}/attachments/{attachment_id}/download')
def download(message_id: str, attachment_id: UUID, body: DownloadInput, request: Request):
    state = request.app.state
    aid = str(attachment_id)
    with source(request, message_id, body.account_id) as (client, email_id, items):
        item = next((a for a in items if remote_id(a.id) == aid), None)
        if item is None:
            raise HTTPException(404, 'Este anexo não pertence à mensagem selecionada.')
        if item.size is not None and item.size > MAX_ATTACHMENT:
            raise HTTPException(413, 'O anexo excede o limite de 20 MB.')
        try:
            metadata = DownloadMetadata.model_validate(client.received_attachment(email_id, aid))
        except ValidationError:
            raise ResendError('O provedor retornou dados de download incompatíveis.') from None
        if remote_id(metadata.id) != aid or metadata.filename != item.filename or (item.size is not None and metadata.size != item.size):
            raise HTTPException(409, 'O arquivo retornado não corresponde ao anexo selecionado.')
        if metadata.expires_at <= state.clock():
            raise HTTPException(409, 'O link do arquivo expirou. Consulte e baixe o anexo novamente.')
        if metadata.size > MAX_ATTACHMENT:
            raise HTTPException(413, 'O anexo excede o limite de 20 MB.')
        content = state.attachment_reader(metadata.download_url, email_id, aid, metadata.size)
        if len(content) != metadata.size or len(content) > MAX_ATTACHMENT:
            raise ResendError('O arquivo recebido não corresponde ao tamanho esperado.')
        filename = safe_filename(metadata.filename)
        with state.engine.begin() as c:
            c.execute(text('''INSERT INTO attachment_transfers VALUES(:id,:m,:a,:n,:s,:h,:d)'''),
                      dict(id=uuid4().hex, m=message_id, a=aid, n=filename, s=len(content),
                           h=hashlib.sha256(content).hexdigest(), d=state.clock().isoformat()))
    return Response(content, media_type='application/octet-stream', headers={
        'Content-Disposition': "attachment; filename=\"anexo\"; filename*=UTF-8''"+quote(filename, safe=''),
        'X-Download-Options': 'noopen', 'Content-Security-Policy': "default-src 'none'; sandbox"})

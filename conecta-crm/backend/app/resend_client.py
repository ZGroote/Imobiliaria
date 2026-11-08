"""Cliente de leitura: a API pública deste módulo só executa GETs em rotas fixas."""
import re
import json
import time
from datetime import timezone
from html.parser import HTMLParser
from uuid import UUID
from typing import Literal

import httpx
from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, ValidationError

from .provider import Mail


class ResendError(Exception):
    def __init__(self, message, status=502):
        super().__init__(message)
        self.status = status


class SyncCancelled(Exception):
    """Encerramento local: não representa falha da conexão."""


def remote_id(value):
    try:
        return str(UUID(value))
    except (ValueError, TypeError, AttributeError):
        raise ResendError("O Resend retornou um identificador inválido.") from None


class Inbox(BaseModel):
    id: str
    email_address: str


class RemoteThread(BaseModel):
    id: str
    subject: str | None = None
    email_count: int = Field(ge=0)
    received_at: AwareDatetime
    folder: str


class Attachment(BaseModel):
    id: str = Field(max_length=200)
    filename: str | None = Field(None, max_length=2000)
    size: int | None = Field(None, ge=0)


class RemoteMail(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    id: str
    sender: str = Field(alias="from", max_length=2000)
    to: list[str]
    subject: str | None = None
    message_id: str | None = None
    text: str | None = Field(None, max_length=2_000_000)
    html: str | None = Field(None, max_length=2_000_000)
    read: bool
    received_at: AwareDatetime
    attachments: list[Attachment] = []
    direction: Literal["inbound","outbound"] = "inbound"


class PlainText(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.hidden = 0
        self.quoted = 0
        self.parts = []

    def handle_starttag(self, tag, attrs):
        if tag == "blockquote":
            self.quoted += 1
            self.parts.append("\n> ")
        if tag in ("script", "style", "head"):
            self.hidden += 1
        if tag in ("p", "div", "br", "li", "tr") and not self.hidden:
            self.parts.append("\n")

    def handle_endtag(self, tag):
        if tag == "blockquote":
            self.quoted = max(0,self.quoted-1)
            self.parts.append("\n")
        if tag in ("script", "style", "head"):
            self.hidden = max(0, self.hidden - 1)

    def handle_data(self, data):
        if not self.hidden:
            self.parts.append(data.replace("\n","\n> ") if self.quoted else data)


def message(item, thread_id):
    try:
        value = RemoteMail.model_validate(item)
    except ValidationError:
        raise ResendError("Formato de mensagem incompatível; lote preservado para nova tentativa.") from None
    body = value.text
    if body is None:
        parser = PlainText()
        parser.feed(value.html or "")
        body = "".join(parser.parts).strip()
    return Mail(key="resend:"+remote_id(value.id), uid=0, message_id=value.message_id or "",
                sender=value.sender, recipient=", ".join(value.to), subject=value.subject or "(Sem assunto)",
                body=body, received_at=value.received_at.astimezone(timezone.utc).isoformat(),
                attachments=[dict(id=a.id,name=a.filename or "Anexo sem nome",size=a.size,available=False) for a in value.attachments],
                thread_key="resend:"+remote_id(thread_id), is_read=value.read, direction=value.direction)


class ResendClient:
    def __init__(self, key, transport=None, interval=0.6):
        if not re.fullmatch(r"re_[a-zA-Z0-9_]{8,200}", key):
            raise ResendError("Informe uma chave de API válida do Resend.", 422)
        self._key = key
        self._http = httpx.Client(base_url="https://api.resend.com", transport=transport,
                                  timeout=15, follow_redirects=False, trust_env=False)
        self._interval = interval
        self._last = 0
        self.cancelled = lambda: False

    def close(self):
        self._http.close()

    def _get(self, path, params):
        if self.cancelled():
            raise SyncCancelled()
        delay = self._interval - (time.monotonic()-self._last)
        if delay > 0:
            time.sleep(delay)
        if self.cancelled():
            raise SyncCancelled()
        self._last = time.monotonic()
        try:
            with self._http.stream("GET", path, params=params, headers={"Authorization":"Bearer "+self._key}) as response:
                if response.status_code != 200:
                    explanations = {401:"Chave recusada pelo Resend.",403:"A chave não permite consultar este recurso no Resend.",
                                    404:"Recurso não encontrado no Resend.",429:"Limite do Resend atingido. Aguarde e tente novamente."}
                    raise ResendError(explanations.get(response.status_code,"O Resend não concluiu a leitura."),
                                      429 if response.status_code == 429 else 502)
                data = bytearray()
                for chunk in response.iter_bytes():
                    if self.cancelled():
                        raise SyncCancelled()
                    data.extend(chunk)
                    if len(data) > 4_000_000:
                        raise ResendError("Página do Resend excedeu o limite de leitura. O cache foi preservado.")
                result = json.loads(data)
                if not isinstance(result, dict):
                    raise ValueError()
                return result
        except (httpx.HTTPError, ValueError):
            raise ResendError("Falha de comunicação com o Resend. Nenhuma alteração remota foi feita.") from None

    def _page(self, path, params):
        result = self._get(path, params)
        if not isinstance(result.get("data"), list) or not isinstance(result.get("has_more"), bool):
            raise ResendError("Paginação incompatível com a resposta do Resend.")
        if len(result["data"]) > 100 or (result["has_more"] and not result["data"]):
            raise ResendError("Paginação inválida do Resend.")
        return result

    def find_inbox(self, address):
        after = None
        seen = set()
        for _ in range(100):
            page = self._page("/inboxes", {"limit":100, **({"after":after} if after else {})})
            try:
                items = [Inbox.model_validate(item) for item in page["data"]]
            except ValidationError:
                raise ResendError("Lista de caixas incompatível com o Resend.") from None
            matches = [i for i in items if i.email_address.casefold() == address.casefold()]
            if matches:
                return remote_id(matches[0].id)
            if not page["has_more"]:
                raise ResendError("Este endereço não foi encontrado nas Inboxes acessíveis pela chave.", 409)
            after = remote_id(items[-1].id)
            if after in seen:
                break
            seen.add(after)
        raise ResendError("A listagem de caixas não pôde ser concluída.")

    def domain(self, name):
        after = None
        seen = set()
        for _ in range(100):
            page = self._page('/domains',{'limit':100,**({'after':after} if after else {})})
            for item in page['data']:
                if not isinstance(item,dict) or not isinstance(item.get('name'),str):
                    raise ResendError('Lista de domínios incompatível com o Resend.')
                if item.get('name','').casefold()==name.casefold():
                    result = self._get('/domains/'+remote_id(item.get('id')), {})
                    if not isinstance(result.get('name'),str) or result['name'].casefold()!=name.casefold():
                        raise ResendError('O domínio retornado não corresponde ao remetente.')
                    return result
            if not page['has_more']:
                raise ResendError('Domínio do remetente não encontrado nesta conta Resend.',409)
            after = remote_id(page['data'][-1].get('id'))
            if after in seen:
                break
            seen.add(after)
        raise ResendError('Não foi possível concluir a consulta de domínio.')

    def sent_email(self, email_id):
        return self._get('/emails/'+remote_id(email_id),{})

    def inbox_email(self, inbox_id, thread_id, email_id):
        return self._get(f'/inboxes/{remote_id(inbox_id)}/threads/{remote_id(thread_id)}/emails/{remote_id(email_id)}', {})

    def received_email(self, email_id):
        return self._get('/emails/receiving/'+remote_id(email_id), {'html_format': 'cid'})

    def received_attachment(self, email_id, attachment_id):
        return self._get(f'/emails/receiving/{remote_id(email_id)}/attachments/{remote_id(attachment_id)}', {})

    def threads(self, inbox_id, after=None):
        params = {"limit":10,"folders":"inbox,archive,sent,spam,trash"}
        if after:
            params["after"] = remote_id(after)
        page = self._page(f"/inboxes/{remote_id(inbox_id)}/threads",params)
        try:
            threads = [RemoteThread.model_validate(t) for t in page["data"]]
            for t in threads:
                remote_id(t.id)
        except ValidationError:
            raise ResendError("Lista de conversas incompatível com o Resend.") from None
        return threads, page["has_more"]

    def messages(self, inbox_id, thread_id):
        path = f"/inboxes/{remote_id(inbox_id)}/threads/{remote_id(thread_id)}/emails"
        after = None
        seen = set()
        result = []
        for _ in range(50):
            page = self._page(path,{"limit":100,**({"after":after} if after else {})})
            result.extend(message(m,thread_id) for m in page["data"])
            if not page["has_more"]:
                return result
            after = remote_id(page["data"][-1].get("id"))
            if after in seen:
                break
            seen.add(after)
        raise ResendError("Conversa excedeu o limite do lote ou repetiu páginas. Nenhum item dessa conversa foi importado.")

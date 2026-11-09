import json
import secrets
import threading
import asyncio
from contextlib import asynccontextmanager
from pathlib import Path
from datetime import datetime, timezone
from typing import Literal

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.exceptions import RequestValidationError
from pydantic import BaseModel, ConfigDict, SecretStr
from sqlalchemy import text

from .db import ROOT, database
from .mail import rows
from .mail_operations import synchronize as synchronize_mail
from .mail_schedule import MailWorker, router as mail_schedule_router
from .attachment_files import read_attachment
from .attachments_api import router as attachments_router
from .analysis_api import router as analysis_router
from .qualification_api import router as qualification_router
from .agent_runs import router as agent_runs_router
from .agent_worker import AgentWorker
from .recipient_authorizations import router as recipient_authorizations_router
from .real_delivery_api import router as real_delivery_router
from .real_delivery_worker import DeliveryWorker
from .real_transport import RealTransport
from .provider import MockProvider
from .resend_client import ResendClient, ResendError
from .windows_store import CredentialError, WindowsCredentials, default_cache, encrypted_backup
from .classification import CATEGORY_QUERY, LABELS, classification_view
from .classification_api import router as classification_router
from .classification_review_api import router as classification_review_router
from .directory_api import router as directory_router
from .branding_api import router as branding_router
from .brand_materials import router as brand_material_router
from .outbound_api import router as outbound_router
from .sender_api import router as sender_router
from .sender_diagnostics import dmarc
from .test_transport import SenderTestTransport
from .research_api import router as research_router
from .company_research import router as company_research_router
from .commercial_api import router as commercial_router
from .insights_api import router as insights_router
from .proposal_api import router as proposal_router
from .projects_api import router as projects_router

HOSTS = {"127.0.0.1:8765", "localhost:8765"}
ORIGINS = {f"http://{host}" for host in HOSTS}


class SyncRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    account_id: str = "demo"


class ConnectRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    account_id: Literal["contact", "team"]
    api_key: SecretStr


def create_app(db_path: Path | None = None, provider=None, credentials=None, client_factory=ResendClient,
               sender_transport_factory=SenderTestTransport,dns_resolver=dmarc, start_mail_worker=True,
               attachment_reader=read_attachment, agent_runner=None, start_agent_worker=None, real_transport_factory=RealTransport, start_delivery_worker=None):
    token = secrets.token_urlsafe(32)
    mail_provider = provider or MockProvider()
    credential_store = credentials or WindowsCredentials()
    locks = {account:threading.Lock() for account in ("demo","contact","team")}

    @asynccontextmanager
    async def lifespan(app):
        app.state.db_path = db_path or default_cache()
        app.state.engine = database(app.state.db_path)
        with app.state.engine.begin() as c:
            for account_id, address, transport, role in [
                ("demo", "demo@example.invalid", "mock", "Dados fictícios"),
                ("contact", "contact@conectaimoveis3d.com", "resend", "Atendimento"),
                ("team", "team@conectaimoveis3d.com", "resend", "Equipe e convites"),
                ("noreply", "noreply@conectaimoveis3d.com", "resend", "Notificações; não recebe respostas"),
            ]:
                c.execute(text("""INSERT INTO accounts(id,address,provider,role) VALUES(:i,:a,:p,:r)
                    ON CONFLICT(id) DO NOTHING"""), dict(i=account_id,a=address,p=transport,r=role))
            for account_id in ('contact', 'team'):
                c.execute(text('INSERT INTO mail_schedule(account_id) VALUES(:a) ON CONFLICT DO NOTHING'), dict(a=account_id))
        app.state.mail_worker = MailWorker(app)
        if start_mail_worker:
            app.state.mail_worker.start()
        app.state.agent_worker = AgentWorker(app,agent_runner)
        agent_enabled = start_mail_worker if start_agent_worker is None else start_agent_worker
        if agent_enabled:
            app.state.agent_worker.start()
        app.state.delivery_worker = DeliveryWorker(app,real_transport_factory)
        delivery_enabled = start_mail_worker if start_delivery_worker is None else start_delivery_worker
        if delivery_enabled:
            app.state.delivery_worker.start()
        try:
            yield
        finally:
            await asyncio.to_thread(app.state.delivery_worker.stop)
            await asyncio.to_thread(app.state.agent_worker.stop)
            if start_mail_worker:
                await asyncio.to_thread(app.state.mail_worker.stop)
            app.state.engine.dispose()

    app = FastAPI(title="Conecta CRM local", lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)
    app.state.clock = lambda: datetime.now(timezone.utc)
    app.state.credential_store = credential_store
    app.state.mail_client_factory = client_factory
    app.state.mail_locks = locks
    app.state.mail_provider = mail_provider
    app.state.attachment_reader = attachment_reader
    app.state.sender_transport_factory = sender_transport_factory
    app.state.dmarc_resolver = dns_resolver
    app.include_router(classification_router)
    app.include_router(classification_review_router)
    app.include_router(directory_router)
    app.include_router(branding_router)
    app.include_router(brand_material_router)
    app.include_router(outbound_router)
    app.include_router(sender_router)
    app.include_router(research_router)
    app.include_router(company_research_router)
    app.include_router(commercial_router)
    app.include_router(insights_router)
    app.include_router(proposal_router)
    app.include_router(projects_router)
    app.include_router(mail_schedule_router)
    app.include_router(attachments_router)
    app.include_router(analysis_router)
    app.include_router(qualification_router)
    app.include_router(agent_runs_router)
    app.include_router(recipient_authorizations_router)
    app.include_router(real_delivery_router)

    @app.exception_handler(RequestValidationError)
    async def validation_error(request, exc):
        # O erro padrão inclui o input; isso poderia devolver a chave ao navegador.
        return JSONResponse({"detail":"Dados inválidos. Confira os campos informados."},status_code=422)

    @app.exception_handler(ResendError)
    async def resend_error(request, exc):
        return JSONResponse({"detail":str(exc)},status_code=exc.status)

    @app.exception_handler(CredentialError)
    async def credential_error(request, exc):
        return JSONResponse({"detail":str(exc)},status_code=503)

    @app.middleware("http")
    async def local_security(request: Request, call_next):
        host = request.headers.get("host")
        origin = request.headers.get("origin")
        if host not in HOSTS or (origin and origin not in ORIGINS) or request.headers.get("sec-fetch-site") == "cross-site":
            return JSONResponse({"detail": "Origem não permitida."}, status_code=403)
        if request.url.path.startswith("/api/") and request.url.path != "/api/session":
            if not secrets.compare_digest(request.headers.get("x-crm-token", ""), token):
                return JSONResponse({"detail": "Sessão local necessária."}, status_code=401)
        if request.method in ("POST","PUT"):
            try:
                limit = 262144 if request.url.path.startswith("/api/jobs/") else 131072 if request.url.path.startswith(("/api/proposals","/api/thread-analyses")) else 65536 if request.url.path.startswith(("/api/outbound/","/api/opportunities","/api/projects","/api/contacts","/api/developments","/api/qualifications")) else 16384
                if int(request.headers.get("content-length","0")) > limit or "transfer-encoding" in request.headers:
                    return JSONResponse({"detail":"Requisição excedeu o limite permitido."},status_code=413)
            except ValueError:
                return JSONResponse({"detail":"Tamanho de requisição inválido."},status_code=400)
        response = await call_next(request)
        response.headers["Cache-Control"] = "no-store"
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "no-referrer"
        response.headers.setdefault("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; object-src 'none'")
        return response

    @app.get("/api/session")
    def session():
        return {"token": token, "send_enabled": False, "stage": "Caixa local · etapa 1"}

    @app.get("/api/mail/accounts")
    def accounts():
        with app.state.engine.connect() as c:
            result = []
            for a in rows(c,"SELECT * FROM accounts"):
                ready = a["provider"] == "mock"
                if a["id"] in ("contact","team") and a["verified_at"]:
                    try:
                        ready = bool(credential_store.get(a["id"]))
                    except CredentialError:
                        pass
                result.append(dict(a,connected=ready,send_enabled=False))
            return result

    @app.post("/api/mail/accounts/connect")
    def connect_account(body: ConnectRequest):
        if not locks[body.account_id].acquire(blocking=False):
            raise HTTPException(409,"Esta caixa já está em uma operação. Aguarde.")
        client = None
        try:
            with app.state.engine.connect() as c:
                account = rows(c,"SELECT * FROM accounts WHERE id=:a",a=body.account_id)[0]
            client = client_factory(body.api_key.get_secret_value().strip())
            inbox_id = client.find_inbox(account["address"])
            if account["remote_id"] and account["remote_id"] != inbox_id:
                raise HTTPException(409,"A caixa remota mudou. Revise a conexão antes de misturar históricos.")
            credential_store.put(body.account_id,body.api_key.get_secret_value().strip())
            from datetime import datetime, timezone
            now = datetime.now(timezone.utc).isoformat()
            with app.state.engine.begin() as c:
                c.execute(text("UPDATE accounts SET remote_id=:r,verified_at=:d WHERE id=:a"),dict(r=inbox_id,d=now,a=body.account_id))
                c.execute(text("INSERT INTO audit_events(action,account_id,occurred_at,count) VALUES('connect_read',:a,:d,0)"),dict(a=body.account_id,d=now))
            return {"connected":True,"send_enabled":False,"address":account["address"]}
        finally:
            if client:
                client.close()
            locks[body.account_id].release()

    @app.post("/api/mail/sync")
    def synchronize(body: SyncRequest):
        return synchronize_mail(app, body.account_id)

    @app.post("/api/mail/backup")
    def backup():
        try:
            return {"filename":encrypted_backup(app.state.db_path),"encrypted":True}
        except OSError:
            raise HTTPException(503,"Não foi possível criar o backup local.") from None

    @app.get("/api/mail/folders")
    def folders(account_id: str = "demo"):
        with app.state.engine.connect() as c:
            return rows(c, """SELECT f.id,f.name,COUNT(DISTINCT m.id) AS count FROM folders f
                LEFT JOIN locations l ON l.folder_id=f.id AND l.uidvalidity=f.uidvalidity
                LEFT JOIN messages m ON m.id=l.message_id
                WHERE f.account_id=:a GROUP BY f.id ORDER BY f.name""", a=account_id)

    @app.get("/api/mail/threads")
    def threads(account_id: str = "demo", folder: str = "", q: str = Query("", max_length=300), category: str = Query("",max_length=40),
                unread: bool = False, offset: int = Query(0, ge=0), limit: int = Query(25, ge=1, le=100)):
        clauses = ["t.account_id=:a"]
        params = dict(a=account_id, folder=folder, offset=offset, limit=limit)
        if category:
            if category not in (*LABELS,"unclassified"):
                raise HTTPException(422,"Categoria inválida.")
            if category == "unclassified":
                clauses.append(f"({CATEGORY_QUERY}) IS NULL")
            else:
                clauses.append(f"({CATEGORY_QUERY}) = :category")
                params["category"] = category
        if folder:
            clauses.append("""EXISTS(SELECT 1 FROM messages m JOIN locations l ON l.message_id=m.id
                JOIN folders f ON f.id=l.folder_id AND f.uidvalidity=l.uidvalidity
                WHERE m.thread_id=t.id AND f.name=:folder)""")
        if q.strip():
            # FTS recebe termos literais, nunca operadores vindos do campo de busca.
            params["query"] = " AND ".join('"' + word.replace('"', '""') + '"' for word in q.split())
            clauses.append("""EXISTS(SELECT 1 FROM messages m JOIN mail_search s ON s.message_key=m.id
                WHERE m.thread_id=t.id AND mail_search MATCH :query)""")
        if unread:
            clauses.append("EXISTS(SELECT 1 FROM messages WHERE thread_id=t.id AND is_read=0)")
        where = " AND ".join(clauses)
        with app.state.engine.connect() as c:
            total = c.execute(text(f"SELECT COUNT(*) FROM threads t WHERE {where}"), params).scalar_one()
            items = rows(c, f"""SELECT t.*, (SELECT sender FROM messages WHERE thread_id=t.id ORDER BY received_at DESC LIMIT 1) sender,
                (SELECT substr(body_text,1,140) FROM messages WHERE thread_id=t.id ORDER BY received_at DESC LIMIT 1) snippet,
                (SELECT COUNT(*) FROM messages WHERE thread_id=t.id) message_count,
                (SELECT COUNT(*) FROM messages WHERE thread_id=t.id AND is_read=0) unread_count
                FROM threads t WHERE {where} ORDER BY last_at DESC,t.id LIMIT :limit OFFSET :offset""", **params)
            for item in items:
                item["classification"] = classification_view(c,item["id"])
            return {"items": items, "total": total}

    @app.get("/api/mail/threads/{thread_id}")
    def thread(thread_id: str):
        with app.state.engine.connect() as c:
            found = rows(c, "SELECT * FROM threads WHERE id=:id", id=thread_id)
            if not found:
                raise HTTPException(404, "Conversa não encontrada.")
            messages = rows(c, "SELECT * FROM messages WHERE thread_id=:id ORDER BY received_at,id", id=thread_id)
            for message in messages:
                message["attachments"] = json.loads(message["attachments"])
            profile = c.execute(text("SELECT profile_id FROM thread_brand_profiles WHERE thread_id=:id"),dict(id=thread_id)).scalar()
            return dict(found[0], messages=messages,classification=classification_view(c,thread_id),brand_profile=profile)

    @app.post("/api/mail/threads/{thread_id}/read")
    def mark_read(thread_id: str):
        with app.state.engine.begin() as c:
            result = c.execute(text("UPDATE messages SET is_read=1 WHERE thread_id=:id"), dict(id=thread_id))
            if not result.rowcount:
                raise HTTPException(404, "Conversa não encontrada.")
        return {"local_only": True}

    @app.get("/api/brand-profiles")
    def profiles():
        with app.state.engine.connect() as c:
            return [dict(p, from_address=None, send_enabled=False) for p in rows(c, "SELECT * FROM brand_profiles ORDER BY id")]

    dist = ROOT / "frontend/dist"
    if dist.exists():
        app.mount("/assets", StaticFiles(directory=dist / "assets"), name="assets")

    @app.get("/")
    def index():
        if not (dist / "index.html").exists():
            raise HTTPException(503, "Compile o frontend antes de abrir o CRM. Veja README.md.")
        return FileResponse(dist / "index.html")

    return app

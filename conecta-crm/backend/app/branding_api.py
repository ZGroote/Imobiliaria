import hashlib
import json

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from .db import ROOT

router = APIRouter()
ASSETS = ROOT / "branding/assets/original"
TEMPLATES = {
    "BR":dict(locale="pt-BR",website="https://conectaimoveis3d.com.br",
              subject="Apresentação imobiliária para {{company_name}}",
              body="Olá,\n\nSou {{sender_name}}, da Conecta Imóveis 3D. Trabalhamos com visualização imobiliária interativa em 3D.\n\nGostaria de saber se faz sentido apresentar essa experiência à equipe da {{company_name}}.\n\nPodemos conversar brevemente?\n\n{{sender_name}}\nConecta Imóveis 3D\nUma nova perspectiva.\nhttps://conectaimoveis3d.com.br\n{{postal_address}}\n\nSe preferir não receber novas mensagens, responda pedindo a retirada da lista."),
    "US":dict(locale="en-US",website="https://conectaimoveis3d.com",
              subject="Interactive 3D visualization for {{company_name}}",
              body="Hello,\n\nI'm {{sender_name}} from Conecta Imóveis 3D. We work with interactive 3D real estate visualization.\n\nWould it make sense to introduce this experience to the team at {{company_name}}?\n\nWould you be open to a brief conversation?\n\n{{sender_name}}\nConecta Imóveis 3D\nA new perspective.\nhttps://conectaimoveis3d.com\n{{postal_address}}\n\nIf you prefer not to receive further messages, reply asking to be removed from our list."),
}


def catalog():
    entries = json.loads((ROOT / "branding/manifest.json").read_text(encoding="utf-8-sig"))
    return [dict(id=e["sha256"],name=e["name"],display_name=e.get("display_name",e["name"]),commercial_stage=e.get("commercial_stage","brand"),locale=e["locale"],kind="original",preview=e["name"].endswith(".png")) for e in entries]


@router.get("/api/brand-assets")
def assets():
    return catalog()


@router.get("/api/brand-assets/{asset_id}")
def asset(asset_id: str):
    entry = next((e for e in catalog() if e["id"] == asset_id),None)
    if not entry:
        raise HTTPException(404,"Material não encontrado.")
    path = (ASSETS / entry["name"]).resolve()
    if path.parent != ASSETS.resolve() or not path.is_file():
        raise HTTPException(404,"Material indisponível.")
    if hashlib.sha256(path.read_bytes()).hexdigest() != entry["id"]:
        raise HTTPException(409,"Este arquivo foi alterado desde o registro do original. Revise a biblioteca.")
    return FileResponse(path,filename=entry["name"],media_type="image/png" if entry["preview"] else "application/vnd.openxmlformats-officedocument.wordprocessingml.document")


@router.get("/api/email-templates")
def templates():
    return [dict(profile_id=profile,id="cold_intro_minimal",status="pending_review",send_enabled=False,
                 required_fields=["company_name","sender_name","postal_address"],**value) for profile,value in TEMPLATES.items()]

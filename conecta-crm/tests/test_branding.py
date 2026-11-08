import hashlib

import pytest
from fastapi.testclient import TestClient

from backend.app.main import create_app
from backend.app import branding_api


@pytest.fixture
def client(tmp_path):
    with TestClient(create_app(tmp_path/"cache.sqlite3"),base_url="http://127.0.0.1:8765") as client:
        client.headers["x-crm-token"] = client.get("/api/session").json()["token"]
        yield client


def test_original_library_requires_session_and_preserves_hash(client):
    assert client.get("/api/brand-assets",headers={"x-crm-token":"wrong"}).status_code == 401
    assets = client.get("/api/brand-assets").json()
    assert len(assets) == 9
    assert {asset["commercial_stage"] for asset in assets} == {"brand","briefing","delivery","after_sale"}
    assert sum(asset["preview"] for asset in assets) == 4
    for asset in assets:
        assert asset["kind"] == "original" and asset["locale"] == "pt-BR"
        response = client.get("/api/brand-assets/"+asset["id"])
        assert response.status_code == 200
        assert hashlib.sha256(response.content).hexdigest() == asset["id"]
        assert "path" not in asset
    assert client.get("/api/brand-assets/unknown").status_code == 404


def test_asset_hash_change_is_not_silently_accepted(client,monkeypatch,tmp_path):
    asset = branding_api.catalog()[0]
    monkeypatch.setattr(branding_api,"ASSETS",tmp_path)
    (tmp_path/asset["name"]).write_bytes(b"changed")
    assert client.get("/api/brand-assets/"+asset["id"]).status_code == 409


def test_catalog_cannot_escape_asset_directory(client,monkeypatch,tmp_path):
    monkeypatch.setattr(branding_api,"ASSETS",tmp_path)
    monkeypatch.setattr(branding_api,"catalog",lambda:[dict(id="test",name="../outside.docx",locale="pt-BR",kind="original",preview=False)])
    assert client.get("/api/brand-assets/test").status_code == 404


def test_market_identity_does_not_depend_on_operator_location(client):
    templates = {t["profile_id"]:t for t in client.get("/api/email-templates",headers={"Accept-Language":"pt-BR"}).json()}
    assert templates["US"]["locale"] == "en-US"
    assert templates["US"]["website"] == "https://conectaimoveis3d.com"
    assert ".com.br" not in templates["US"]["body"]
    assert templates["BR"]["website"] == "https://conectaimoveis3d.com.br"
    for template in templates.values():
        assert template["send_enabled"] is False
        assert template["status"] == "pending_review"
        assert "{{postal_address}}" in template["body"]
        assert "Conecta Imóveis 3D" in template["body"]

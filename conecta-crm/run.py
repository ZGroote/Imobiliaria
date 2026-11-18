"""Executar da pasta conecta-crm com o Python do ambiente virtual."""
import uvicorn
from backend.app.main import create_app

if __name__ == "__main__":
    uvicorn.run(create_app(), host="127.0.0.1", port=8765, access_log=False)

# -*- coding: utf-8 -*-
"""Serve uma pasta por HTTPS na rede local, para abrir no TELEFONE (estudo M1.1-A).

    python tools/servir_lan.py painel/out                         # o capturador
    python tools/servir_lan.py publicacao/m1-1a/caso-1 --porta 8814   # a maquete do smoke 3D

Por que HTTPS: o capturador usa `crypto.randomUUID`, que só existe em contexto seguro. Por
HTTP no IP da rede ele nem abre ("This page couldn't load"); em produção o Hosting já é
HTTPS, então aqui também. O certificado é autoassinado, gerado pelo openssl (o do Git
serve) para o IP desta máquina, vale 7 dias e some quando o servidor para. O telefone
mostra uma vez o aviso de conexão não privada.

URL limpa como no Hosting (`/capturador` serve `capturador.html`). Só leitura: sem upload
e sem listagem de pasta. O log de cada acesso leva o User-Agent, que é a prova de qual
aparelho abriu a página.
"""
import argparse
import http.server
import os
from pathlib import Path
import shutil
import socket
import ssl
import subprocess
import sys
import tempfile

OPENSSL_GIT = r"C:\Program Files\Git\usr\bin\openssl.exe"


def ip_da_rede():
    """IP desta máquina na rota padrão (conectar UDP não envia pacote)."""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 53))
        return s.getsockname()[0]
    finally:
        s.close()


def certificado(ip, pasta):
    openssl = shutil.which("openssl") or OPENSSL_GIT
    cert, chave = Path(pasta) / "cert.pem", Path(pasta) / "chave.pem"
    subprocess.run([openssl, "req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "7",
                    "-subj", "/CN=" + ip, "-addext", "subjectAltName=IP:%s,DNS:localhost" % ip,
                    "-keyout", str(chave), "-out", str(cert)], check=True, capture_output=True)
    return cert, chave


class Pasta(http.server.SimpleHTTPRequestHandler):
    def send_head(self):
        alvo = self.translate_path(self.path)
        if not os.path.splitext(alvo)[1] and os.path.isfile(alvo.rstrip("/\\") + ".html"):
            caminho, _, _ = self.path.partition("?")
            self.path = caminho.rstrip("/") + ".html"
        return super().send_head()

    def list_directory(self, path):
        self.send_error(404)
        return None

    def log_message(self, formato, *args):
        headers = getattr(self, "headers", None)
        agente = headers.get("User-Agent", "-") if headers else "-"
        sys.stderr.write("%s - %s | %s\n" % (self.client_address[0], formato % args, agente))


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    p.add_argument("pasta")
    p.add_argument("--porta", type=int, default=8813)
    p.add_argument("--ip", help="IP desta máquina na rede do telefone (padrão: o da rota padrão)")
    args = p.parse_args(argv)
    pasta = Path(args.pasta).resolve()
    if not pasta.is_dir():
        raise SystemExit("pasta inexistente: %s" % pasta)
    ip = args.ip or ip_da_rede()
    temp = tempfile.mkdtemp(prefix="servir-lan-")
    try:
        cert, chave = certificado(ip, temp)
        ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        ctx.load_cert_chain(str(cert), str(chave))
        handler = lambda *a, **k: Pasta(*a, directory=str(pasta), **k)
        servidor = http.server.ThreadingHTTPServer(("0.0.0.0", args.porta), handler)
        servidor.socket = ctx.wrap_socket(servidor.socket, server_side=True)
        print("servindo %s\n  no telefone: https://%s:%d/  (aviso de certificado: prosseguir)"
              % (pasta, ip, args.porta), flush=True)
        servidor.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        shutil.rmtree(temp, ignore_errors=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

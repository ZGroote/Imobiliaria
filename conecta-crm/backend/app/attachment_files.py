"""Arquivos recebidos: URL vinculada ao e-mail, tamanho limitado e nenhum envio de chave."""
import re
import time
import unicodedata
from http.client import HTTPException as HTTPProtocolError
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import HTTPRedirectHandler, ProxyHandler, Request, build_opener

from .resend_client import ResendError, remote_id

MAX_ATTACHMENT = 20 * 1024 * 1024


def safe_filename(value):
    name = unicodedata.normalize('NFC', value or 'anexo').replace('\\', '/').rsplit('/', 1)[-1]
    name = ''.join(c for c in name if not unicodedata.category(c).startswith('C') and c not in '<>:"/\\|?*')
    name = name.strip(' .')[:140].rstrip(' .') or 'anexo'
    device = unicodedata.normalize('NFKC', name.split('.')[0]).rstrip(' ')
    if re.fullmatch(r'CON|PRN|AUX|NUL|COM[0-9]|LPT[0-9]', device, re.I):
        name = 'anexo-' + name
    return name


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def read_attachment(url, email_id, attachment_id, size, *, opener=None):
    email_id, attachment_id = remote_id(email_id), remote_id(attachment_id)
    if isinstance(size, bool) or not isinstance(size, int) or not 0 <= size <= MAX_ATTACHMENT:
        raise ResendError('O anexo excede o limite de 20 MB ou tem tamanho inválido.', 413)
    try:
        parsed = urlsplit(url)
        valid = (len(url) <= 4096 and all(33 <= ord(c) < 127 for c in url)
                 and parsed.scheme == 'https' and parsed.netloc == 'inbound-cdn.resend.com'
                 and parsed.path == f'/{email_id}/attachments/{attachment_id}'
                 and bool(parsed.query) and not parsed.fragment)
    except (ValueError, TypeError):
        valid = False
    if not valid:
        raise ResendError('O provedor não retornou um endereço de arquivo compatível e vinculado à mensagem.')
    # urllib não registra a URL assinada no log HTTP de nível INFO.
    opener = opener or build_opener(ProxyHandler({}), NoRedirect())
    deadline = time.monotonic() + 60
    try:
        with opener.open(Request(url, headers={'Accept-Encoding': 'identity'}), timeout=15) as response:
            if response.status != 200 or response.headers.get('Content-Encoding', 'identity').lower() != 'identity':
                raise ResendError('O provedor não concluiu a leitura do arquivo.')
            declared = response.headers.get('Content-Length')
            if declared is not None and (not re.fullmatch(r'[0-9]{1,10}', declared) or int(declared) != size):
                raise ResendError('O tamanho anunciado não corresponde ao anexo. Consulte novamente.')
            chunks, total = [], 0
            while True:
                if time.monotonic() > deadline:
                    raise ResendError('A leitura do anexo excedeu o tempo permitido. Tente novamente.')
                chunk = response.read(65536)
                if time.monotonic() > deadline:
                    raise ResendError('A leitura do anexo excedeu o tempo permitido. Tente novamente.')
                if not chunk:
                    break
                total += len(chunk)
                if total > min(size, MAX_ATTACHMENT):
                    raise ResendError('O arquivo excedeu o tamanho esperado. Download interrompido.', 413)
                chunks.append(chunk)
            if total != size:
                raise ResendError('O arquivo chegou incompleto. Consulte o anexo novamente.')
            return b''.join(chunks)
    except (HTTPError, URLError, OSError, ValueError, HTTPProtocolError):
        raise ResendError('Não foi possível ler o arquivo no provedor. Consulte novamente; o link pode ter expirado.') from None
